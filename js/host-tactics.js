/**
 * Host tactics: the small hooks that make a led wave behave the way its faction's row in
 * EnemyFactions.TACTICS says. Nothing here knows about a particular faction; each hook
 * reads one key of the active tactic.
 *
 *   key        hook                         where it is called from
 *   squad      squad()                      spawn loop (js/game.js)
 *   runners    onSpawn()                    spawn loop, in place of the default runner roll
 *   formation  update(): shield line pace, the charge, the falter
 *   dash       spawnTweak() + drive()       spawn loop; updateEnemyAI
 *   rise       onDeath() + update()         Roster.onDeath
 *   ambush     spawnTweak()                 spawn loop (rift opens, then they step out)
 *   dive       preyFor() + update()         updateFlyerAI
 *   burn       onHit() + update()           Roster.modifyDamage
 *   rush       onSpawn()
 *   bossPhase  onBossPhase()                Roster.runPhase
 *
 * Everything a tactic does is drawn (drawOver) or announced, so the player can see it.
 * `fired` counts each hook's uses in the current wave, for tests and for the Intel panel.
 */
const HostTactics = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#c0202a';
  const EMBER = '#f08024';
  const VIOLET = '#a070d8';
  const EARTH = '#8a6a3a';
  /** Killers that put the dead down for good, besides fire and blast. */
  const HOLY = { healer: 1, bard: 1 };
  const FIRE = { sky_drake: 1, elder_wyrm: 1, goblin_firebrand: 1, cinderbound_juggernaut: 1 };

  function fresh() {
    return {
      active: false,
      plan: null,
      tactic: null,
      crest: BONE,
      leadTypes: new Set(),
      spawned: 0,
      total: 0,
      startTick: 0,
      wall: null,
      dash: null,
      dashSide: 0,
      dashTurnY: null,
      ambush: null,
      rifts: [],
      rises: [],
      patches: [],
      prey: null,
      surgeUntil: 0,
      avenger: null,
      avengerUnit: null,
      announced: {},
      fired: {},
    };
  }

  let st = fresh();

  function resetRun() {
    st = fresh();
  }

  function fire(key, n = 1) {
    st.fired[key] = (st.fired[key] || 0) + n;
  }

  function sayOnce(key, ctx, text, ticks = 300) {
    if (st.announced[key]) return;
    st.announced[key] = true;
    ctx.showMessage?.(text, ticks);
  }

  function factionOf(plan) {
    return typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(plan.leadId) : null;
  }

  // -------------------------------------------------------------- wave start
  /**
   * A wave begins: read its plan and set up whatever its tactic needs.
   * @param plan  EnemyFactions plan   @param comp  the composed host (queue, leadTypes)
   */
  function beginWave(plan, comp, ctx) {
    st = fresh();
    if (!plan || typeof EnemyFactions === 'undefined' || ctx.creative) return null;
    const tactic = EnemyFactions.tacticForPlan(plan);
    if (!tactic) return null;
    st.active = true;
    st.plan = plan;
    st.tactic = tactic;
    st.crest = factionOf(plan)?.color || BONE;
    st.leadTypes = new Set(comp?.leadTypes || []);
    st.total = comp?.queue?.length || 0;
    st.startTick = ctx.tick;
    const queue = comp?.queue || [];
    if (tactic.formation) {
      const f = tactic.formation;
      st.wall = {
        f,
        state: 'forming',
        lineY: 0,
        since: ctx.tick,
        until: 0,
        hadShields: false,
        hadHorn: queue.some((t) => f.horn.includes(t)),
      };
    }
    if (tactic.dash) st.dash = tactic.dash;
    if (tactic.ambush) {
      const a = tactic.ambush;
      const eligible = queue.filter((t) => a.types.includes(t)).length;
      st.ambush = {
        a,
        left: Math.min(eligible, Math.max(1, Math.round(queue.length * a.share))),
        after: Math.floor(queue.length * 0.2),
        rift: null,
        opened: 0,
        scouted: (ctx.watchtowers || 0) > 0,
      };
      // A standing Watchtower sees where they will come out before anyone does.
      if (st.ambush.scouted && st.ambush.left > 0) {
        openRift(ctx, true);
        sayOnce(
          'watch',
          ctx,
          a.style === 'tunnel'
            ? 'Your Watchtower marks a tunnel mouth behind the line.'
            : 'Your Watchtower marks a rift behind the line.',
          320
        );
      }
    }
    if (plan.revenge) st.avenger = { ...plan.revenge };
    if (plan.wave >= 4 || plan.kind !== 'ordinary') {
      ctx.float?.(ctx.worldW / 2, 76, String(tactic.name || '').toUpperCase(), st.crest);
    }
    return tactic;
  }

  /** Night, a restart or a defeat: nothing carries over. */
  function endWave() {
    if (!st.active) return;
    st.active = false;
    st.rises.length = 0;
    st.patches.length = 0;
    st.rifts.length = 0;
    st.prey = null;
  }

  // ------------------------------------------------------------------- rifts
  function clampSite(x, y, ctx) {
    const sx = Math.max(50, Math.min(ctx.worldW - 50, x));
    let sy = Math.max(ctx.worldH * 0.45, Math.min(ctx.worldH - 96, y));
    for (let i = 0; i < 4 && ctx.blocked && ctx.blocked(sx, sy, null); i++) sy -= 22;
    return { x: sx, y: sy };
  }

  /** Where the unseen come out: by the Medical Tent, behind the General, behind the line. */
  function riftSite(ctx, n) {
    const sites = [];
    for (const b of ctx.buildings || []) {
      if (b.owner !== 'player' || !(b.hp > 0) || b.complete === false) continue;
      if (b.type === 'medical_tent' || b.isMedical) sites.push({ x: b.x, y: b.y + 40, at: 'tent' });
    }
    const g = ctx.general;
    if (g && g.hp > 0) sites.push({ x: g.x, y: g.y + 48, at: 'general' });
    let rear = 0;
    let sumX = 0;
    let n2 = 0;
    for (const u of ctx.units) {
      if (u.team !== 'player' || u.hp <= 0 || u.garrisoned) continue;
      if (u.y > rear) rear = u.y;
      sumX += u.x;
      n2++;
    }
    const midX = n2 ? sumX / n2 : ctx.worldW / 2;
    const rearY = (rear || ctx.rallyY || ctx.worldH * 0.7) + 44;
    sites.push({ x: midX - ctx.worldW * 0.18, y: rearY, at: 'rear' });
    sites.push({ x: midX + ctx.worldW * 0.18, y: rearY, at: 'rear' });
    const pick = sites[n % sites.length];
    return { ...clampSite(pick.x, pick.y, ctx), at: pick.at };
  }

  function openRift(ctx, early) {
    const am = st.ambush;
    const site = riftSite(ctx, am ? am.opened : 0);
    const warn = am ? am.a.warn : 0;
    const rift = {
      x: site.x,
      y: site.y,
      at: site.at,
      born: ctx.tick,
      openAt: ctx.tick + (early ? Math.max(warn, 420) : warn),
      used: 0,
      cap: am ? am.a.perRift : 1,
      style: am ? am.a.style : 'rift',
      closeAt: 0,
    };
    st.rifts.push(rift);
    if (am) {
      am.rift = rift;
      am.opened++;
    }
    fire('rift');
    ctx.playSfx?.('ambush');
    ctx.float?.(
      rift.x,
      rift.y - 26,
      rift.style === 'tunnel' ? 'THE GROUND STIRS' : 'A RIFT OPENS',
      rift.style === 'tunnel' ? EARTH : VIOLET
    );
    return rift;
  }

  // ------------------------------------------------------------------- spawn
  /**
   * Asked before each enemy is placed. Returns null (spawn as usual), { defer: true } (not
   * yet: put it back in the queue) or { x, y, tag } (place it here instead).
   */
  function spawnTweak(type, side, ctx) {
    if (!st.active) return null;
    const north = !side || side === 'north';
    const am = st.ambush;
    if (am && am.left > 0 && north && st.spawned >= am.after && am.a.types.includes(type)) {
      let rift = am.rift;
      if (!rift || rift.used >= rift.cap) {
        rift = openRift(ctx, false);
        sayOnce(
          'ambush',
          ctx,
          rift.style === 'tunnel'
            ? 'Burrowers are digging up behind your line — watch the tunnel mouth!'
            : 'Shadows gather behind your line — a rift is opening!',
          320
        );
      }
      if (ctx.tick < rift.openAt) return { defer: true };
      rift.used++;
      if (rift.used >= rift.cap) rift.closeAt = ctx.tick + 90;
      am.left--;
      const a = ctx.rng() * Math.PI * 2;
      const r = 8 + ctx.rng() * 18;
      const pos = clampSite(rift.x + Math.cos(a) * r, rift.y + Math.sin(a) * r * 0.6, ctx);
      return { x: pos.x, y: pos.y, tag: 'ambush' };
    }
    const d = st.dash;
    if (d && north && d.types.includes(type) && ctx.rng() < d.share) {
      st.dashSide ^= 1;
      const x = st.dashSide ? ctx.worldW - d.lane - ctx.rng() * 10 : d.lane + ctx.rng() * 10;
      return { x, y: 12 + ctx.rng() * 14, tag: 'dash' };
    }
    return null;
  }

  function runnerEligible(u, ctx) {
    if (ctx.wave < 3 || u.isNamedBoss || u.isAvenger) return false;
    if (u.type === 'siege_tower' || u.type === 'goblin_engineer') return false;
    if (typeof isMonsterEnemy === 'function' && isMonsterEnemy(u)) return false;
    return (u.range || 0) <= 60;
  }

  /**
   * Called once an enemy has been created and scaled. Tags it for the tactic.
   * @returns {boolean} true when the tactic has decided whether this one is a runner, so the
   *   default line-breaker roll must be skipped.
   */
  function onSpawn(u, tag, ctx) {
    if (!st.active || !u) return false;
    st.spawned++;
    const t = st.tactic;
    const lead = st.leadTypes.has(u.type);
    u.tacBase = u.speed;
    if (lead) {
      u.hostLead = true;
      u.hostTactic = t.id;
    }
    if (st.avenger && !st.avengerUnit && u.type === st.avenger.type) {
      u.isAvenger = true;
      u.avengerName = st.avenger.name;
      u.maxHp = Math.round(u.maxHp * 1.6);
      u.hp = u.maxHp;
      u.fightToDeath = true;
      st.avengerUnit = u;
      ctx.float?.(u.x, u.y - 30, st.avenger.name.toUpperCase(), st.crest);
      fire('avenger');
    }
    if (tag === 'ambush') {
      u.mustered = true;
      u.ambusher = true;
      u.rotation = -90;
      ctx.float?.(u.x, u.y - 16, 'AMBUSH', st.ambush?.a.style === 'tunnel' ? EARTH : VIOLET);
      ctx.burst?.('dust', u.x, u.y + 4);
      fire('ambush');
      return true;
    }
    if (tag === 'dash') {
      u.dash = { x: u.x };
      u.mustered = true;
      u.speed = u.tacBase * st.dash.speed;
      fire('dash');
      sayOnce('dash', ctx, 'Riders are breaking down both edges of the field — cover your flanks!');
      return true;
    }
    if (!lead) return false;
    if (t.fearless) u.fightToDeath = true;
    if (t.rush) {
      u.speed = u.tacBase * t.rush.speed;
      u.tacBase = u.speed;
      fire('rush');
    }
    if (t.dive && u.flying) {
      u.diver = true;
      u.mustered = true;
      fire('dive');
    }
    if (st.wall && (!u.spawnSide || u.spawnSide === 'north') && !u.isAvenger) {
      const f = st.wall.f;
      u.wallRole = f.front.includes(u.type) ? 'shield' : f.back.includes(u.type) ? 'back' : 'rank';
      if (u.wallRole === 'shield') st.wall.hadShields = true;
      fire('wall');
    }
    if (typeof t.runners === 'number') {
      if (t.runners > 0 && !u.wallRole && runnerEligible(u, ctx) && ctx.rng() < t.runners) {
        u.lineBreaker = true;
        u.stormLine = true;
        u.speed *= 1.3;
        u.tacBase = u.speed;
        u.maxHp = Math.max(1, Math.floor(u.maxHp * 0.9));
        u.hp = u.maxHp;
        ctx.playSfx?.('runnerShriek');
        fire('runners');
      }
      return true;
    }
    return false;
  }

  /** Bodies that arrive together under this tactic, or null for the usual squad size. */
  function squad() {
    return st.active && st.tactic.squad ? st.tactic.squad : null;
  }

  // ---------------------------------------------------------------- movement
  function releaseDash(u) {
    u.dash = null;
    u.speed = u.tacBase || u.speed;
    u.path = [];
    u.pathIndex = 0;
    u.pathTargetId = null;
  }

  /**
   * Movement a tactic takes over completely. True means "handled, skip the usual AI".
   * Only the flank dash needs it: a straight run down the field edge.
   */
  function drive(u, ctx) {
    if (!u.dash) return false;
    if (!st.active || u.pinned || u.fleeing || u.stormLine) {
      releaseDash(u);
      return false;
    }
    const turnY = st.dashTurnY != null ? st.dashTurnY : ctx.rallyY || ctx.worldH * 0.6;
    if (u.y >= turnY - 6) {
      releaseDash(u);
      ctx.float?.(u.x, u.y - 14, 'FLANK', st.crest);
      return false;
    }
    if ((ctx.tick + (u.id | 0)) % 10 === 0) {
      for (const p of ctx.units) {
        if (p.team !== 'player' || p.hp <= 0) continue;
        const dx = p.x - u.x;
        const dy = p.y - u.y;
        if (dx * dx + dy * dy < 64 * 64) {
          releaseDash(u);
          return false;
        }
      }
    }
    const ny = u.y + u.speed;
    const nx = u.x + Math.max(-0.5, Math.min(0.5, u.dash.x - u.x));
    if (ctx.blocked && ctx.blocked(nx, ny, u)) {
      releaseDash(u);
      return false;
    }
    u.x = nx;
    u.y = ny;
    u.rotation = 90;
    u.animState = 'walk';
    if ((ctx.tick + (u.id | 0)) % 14 === 0) ctx.burst?.('dust', u.x, u.y + 6);
    return true;
  }

  /** The soldier a diving flyer goes for, or null to let it choose as usual. */
  function preyFor(u) {
    if (!st.active || !u.diver) return null;
    const p = st.prey;
    return p && p.hp > 0 && p.team === 'player' ? p : null;
  }

  // ------------------------------------------------------------- shield wall
  function median(values) {
    const v = values.slice().sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  }

  function wallMembers(ctx) {
    const out = [];
    for (const u of ctx.units) {
      if (u.team === 'enemy' && u.hp > 0 && u.wallRole && !u.stormLine && !u.lineBreaker) {
        out.push(u);
      }
    }
    return out;
  }

  function endWall(members) {
    for (const u of members) u.speed = u.tacBase || u.speed;
    st.wall.state = 'done';
  }

  function soundCharge(members, ctx, why) {
    const w = st.wall;
    const f = w.f;
    const horn = members.some((u) => f.horn.includes(u.type));
    let cx = 0;
    for (const u of members) cx += u.x;
    cx = members.length ? cx / members.length : ctx.worldW / 2;
    if (w.hadHorn && !horn && why !== 'boss') {
      endWall(members);
      ctx.float?.(cx, w.lineY - 18, 'NO HORN — THE WALL FALTERS', BONE);
      ctx.showMessage?.(
        'Their War Chief is dead: no horn sounds, and the shield wall breaks up.',
        300
      );
      fire('falter');
      return;
    }
    for (const u of members) u.speed = (u.tacBase || u.speed) * f.chargeSpeed;
    w.state = 'charge';
    w.until = ctx.tick + f.chargeTicks;
    ctx.float?.(cx, w.lineY - 18, 'CHARGE!', BLOOD);
    ctx.playSfx?.('bossRoar');
    ctx.shake?.(4);
    sayOnce('charge', ctx, 'The horn sounds — the shield wall charges!', 260);
    fire('charge');
  }

  function updateWall(ctx) {
    const w = st.wall;
    if (!w || w.state === 'done') return;
    const members = wallMembers(ctx);
    if (w.state === 'charge') {
      if (ctx.tick >= w.until) endWall(members);
      return;
    }
    if (!members.length) return;
    const shields = members.filter((u) => u.wallRole === 'shield');
    if (!shields.length) {
      // No line to form behind (too early for shields, or every shield is dead).
      if (w.hadShields) {
        endWall(members);
        ctx.float?.(members[0].x, members[0].y - 18, 'THE WALL IS BROKEN', BONE);
        ctx.showMessage?.(
          'Every shieldbearer is down — the wall is broken and they come on piecemeal.',
          280
        );
        fire('broken');
      }
      return;
    }
    const f = w.f;
    w.lineY = median(shields.map((u) => u.y));
    let xs = Infinity;
    let xe = -Infinity;
    for (const u of shields) {
      if (Math.abs(u.y - w.lineY) > 40) continue;
      if (u.x < xs) xs = u.x;
      if (u.x > xe) xe = u.x;
    }
    w.x0 = xs;
    w.x1 = xe;
    for (const u of members) {
      const base = u.tacBase || u.speed;
      const limit =
        u.wallRole === 'shield'
          ? w.lineY + 10
          : u.wallRole === 'back'
            ? w.lineY - 44
            : w.lineY - 16;
      if (u.y > limit) u.speed = 0.02;
      else if (u.y < limit - 60) u.speed = Math.min(base * 1.3, f.pace * 1.7);
      else u.speed = Math.min(base, f.pace);
    }
    if (w.state === 'forming') {
      w.state = 'advance';
      sayOnce('wall', ctx, 'A shield wall is forming — arrows will not stop it.', 280);
    }
    let front = Infinity;
    for (const p of ctx.units) {
      if (p.team !== 'player' || p.hp <= 0 || p.garrisoned) continue;
      if (p.y > w.lineY - 20 && p.y < front) front = p.y;
    }
    if (front - w.lineY <= f.chargeAt) soundCharge(members, ctx, 'contact');
    else if (ctx.tick - w.since > f.patience) soundCharge(members, ctx, 'patience');
  }

  // --------------------------------------------------------- dive, dash, fire
  function updatePrey(ctx) {
    const d = st.tactic.dive;
    if (!d) return;
    const mine = [];
    for (const u of ctx.units) {
      if (u.team === 'player' && u.hp > 0 && !u.garrisoned && !u.wallGarrisoned) mine.push(u);
    }
    let best = null;
    let bestN = Infinity;
    const r2 = d.alone * d.alone;
    for (const u of mine) {
      let n = 0;
      for (const o of mine) {
        if (o === u) continue;
        const dx = o.x - u.x;
        const dy = o.y - u.y;
        if (dx * dx + dy * dy <= r2) n++;
      }
      if (n < bestN || (n === bestN && best && u.y < best.y)) {
        best = u;
        bestN = n;
      }
    }
    st.prey = best;
    st.preyAlone = bestN;
    if (!best) return;
    const w2 = d.within * d.within;
    for (const u of ctx.units) {
      if (u.team !== 'enemy' || u.hp <= 0 || !u.diver) continue;
      const dx = best.x - u.x;
      const dy = best.y - u.y;
      const near = dx * dx + dy * dy <= w2;
      u.speed = (u.tacBase || u.speed) * (near ? d.speed : 1);
      if (near && !u.diving) {
        u.diving = true;
        ctx.float?.(u.x, u.y - 14, 'DIVE', st.crest);
        ctx.playSfx?.('whoosh');
        fire('diveStrike');
      } else if (!near) u.diving = false;
    }
  }

  function updateDashTurn(ctx) {
    if (!st.dash) return;
    let sum = 0;
    let n = 0;
    for (const u of ctx.units) {
      if (u.team !== 'player' || u.hp <= 0 || u.garrisoned) continue;
      if ((u.range || 0) > 60 || u.combatType === 'healer') {
        sum += u.y;
        n++;
      }
    }
    st.dashTurnY = n ? sum / n : ctx.rallyY || ctx.worldH * 0.6;
  }

  function addPatch(x, y, ctx) {
    const b = st.tactic.burn;
    for (const p of st.patches) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < b.r * b.r) {
        p.until = ctx.tick + b.ticks;
        return p;
      }
    }
    if (st.patches.length >= b.max) st.patches.shift();
    const p = { x, y, r: b.r, born: ctx.tick, until: ctx.tick + b.ticks };
    st.patches.push(p);
    fire('burn');
    sayOnce(
      'burn',
      ctx,
      'Their fire is leaving burning ground — move your soldiers off the embers.'
    );
    return p;
  }

  function updatePatches(ctx) {
    if (!st.patches.length) return;
    const b = st.tactic.burn || { dps: 5 };
    st.patches = st.patches.filter((p) => p.until > ctx.tick);
    for (const p of st.patches) {
      const r2 = p.r * p.r;
      for (const u of ctx.units) {
        if (u.team !== 'player' || u.hp <= 0 || u.garrisoned) continue;
        const dx = u.x - p.x;
        const dy = u.y - p.y;
        if (dx * dx + dy * dy > r2) continue;
        u.burnUntil = ctx.tick + 45;
        ctx.hurt(u, b.dps * 0.5, null, true);
        fire('burnTick');
      }
    }
  }

  // --------------------------------------------------------------- the risen
  function updateRises(ctx) {
    if (!st.rises.length) return;
    const due = [];
    st.rises = st.rises.filter((r) => {
      if (r.at > ctx.tick) return true;
      due.push(r);
      return false;
    });
    for (const r of due) {
      const u = ctx.spawnEnemy(r.type, r.x, r.y);
      if (!u) continue;
      if (typeof Roster !== 'undefined') Roster.onSpawn(u, ctx.wave);
      u.maxHp = r.maxHp;
      u.hp = Math.max(1, Math.round(r.maxHp * r.hp));
      u.damage = r.damage;
      u.risen = true;
      u.hostLead = true;
      u.hostTactic = st.tactic.id;
      u.enemyFaction = r.faction;
      u.fightToDeath = true;
      u.tacBase = u.speed;
      ctx.float?.(u.x, u.y - 16, 'RISES', BONE);
      ctx.burst?.('dust', u.x, u.y + 4);
      fire('rise');
    }
    if (due.length) ctx.playSfx?.('wraithWail');
  }

  function onDeath(unit, killer, ctx) {
    if (!st.active || !unit || unit.team !== 'enemy') return;
    if (unit === st.avengerUnit) st.avengerUnit = null;
    const rise = st.tactic.rise;
    if (!rise || !unit.hostLead || unit.risen || unit.breachedLine) return;
    if (unit.isNamedBoss || unit.isAvenger || unit.type === 'siege_tower') return;
    const cause = unit.deathCause;
    const destroyed =
      cause === 'burn' ||
      cause === 'blast' ||
      (killer && (HOLY[killer.type] || killer.combatType === 'healer'));
    if (destroyed) {
      ctx.float?.(unit.x, unit.y - 12, 'LAID TO REST', BONE);
      fire('laidToRest');
      return;
    }
    st.rises.push({
      type: unit.type,
      x: unit.x,
      y: unit.y,
      born: ctx.tick,
      at: ctx.tick + rise.delay,
      hp: rise.hp,
      maxHp: unit.maxHp,
      damage: unit.damage,
      faction: unit.enemyFaction,
    });
    fire('fallen');
    sayOnce(
      'rise',
      ctx,
      'The dead do not stay down: a fallen foe rises once unless a mage, ballista, sapper or healer finishes it.',
      360
    );
  }

  /** Fire attacks from a host that burns the ground leave embers where they land. */
  function onHit(attacker, target, ctx) {
    if (!st.active || !st.tactic.burn || !attacker.hostLead || target.team !== 'player') return;
    if (!((attacker.range || 0) > 60 || FIRE[attacker.type] || attacker.isNamedBoss)) return;
    if ((attacker.patchAt || 0) > ctx.tick) return;
    attacker.patchAt = ctx.tick + 150;
    addPatch(target.x, target.y, ctx);
  }

  // -------------------------------------------------------------- boss phase
  /** A boss at half health does what his faction does, harder. */
  function onBossPhase(boss, ctx) {
    if (!st.active || !boss || !boss.hostLead) return null;
    const kind = st.tactic.bossPhase;
    const host = [];
    for (const u of ctx.units) if (u.team === 'enemy' && u.hp > 0 && u.hostLead) host.push(u);
    if (kind === 'charge') {
      if (st.wall && st.wall.state !== 'done' && st.wall.state !== 'charge') {
        soundCharge(wallMembers(ctx), ctx, 'boss');
      } else {
        for (const u of host) if (!u.dash) u.speed = (u.tacBase || u.speed) * 1.5;
        st.surgeUntil = ctx.tick + 420;
        ctx.float?.(boss.x, boss.y - 48, 'SOUNDS THE CHARGE', BLOOD);
        ctx.playSfx?.('bossRoar');
        fire('charge');
      }
    } else if (kind === 'stampede') {
      for (const u of host) if (!u.dash) u.speed = (u.tacBase || u.speed) * 1.4;
      st.surgeUntil = ctx.tick + 480;
      ctx.float?.(boss.x, boss.y - 48, 'STAMPEDE', st.crest);
      fire('stampede');
    } else if (kind === 'raise') {
      for (const r of st.rises) r.at = ctx.tick;
      for (const u of host) if (u.risen) u.risen = false;
      ctx.float?.(boss.x, boss.y - 48, 'RAISES THE FALLEN', BONE);
      fire('raise');
    } else if (kind === 'vanish') {
      const site = riftSite(ctx, st.rifts.length);
      st.rifts.push({
        x: site.x,
        y: site.y,
        at: site.at,
        born: ctx.tick,
        openAt: ctx.tick,
        used: 1,
        cap: 1,
        style: 'rift',
        closeAt: ctx.tick + 150,
      });
      ctx.float?.(boss.x, boss.y - 48, 'VANISHES', VIOLET);
      boss.x = site.x;
      boss.y = site.y;
      boss.path = [];
      boss.pathIndex = 0;
      boss.pathTargetId = null;
      boss.mustered = true;
      ctx.float?.(boss.x, boss.y - 30, 'BEHIND YOU', VIOLET);
      ctx.playSfx?.('ambush');
      fire('vanish');
    } else if (kind === 'burn' && st.tactic.burn) {
      addPatch(boss.x, boss.y, ctx);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        addPatch(boss.x + Math.cos(a) * 64, boss.y + Math.sin(a) * 64, ctx);
      }
      ctx.float?.(boss.x, boss.y - 48, 'RING OF FIRE', EMBER);
      ctx.playSfx?.('firebomb');
      fire('ring');
    } else return null;
    fire('bossPhase');
    return kind;
  }

  // ------------------------------------------------------------------ update
  function update(ctx) {
    const tick = ctx.tick;
    if (!st.active) {
      // A loaded save or a cancelled wave: nobody is left walking at formation pace.
      if (tick % 60 === 0) {
        for (const u of ctx.units) {
          if (u.team === 'enemy' && u.wallRole && u.tacBase) {
            u.speed = u.tacBase;
            u.wallRole = null;
          }
          if (u.dash) releaseDash(u);
        }
      }
      return;
    }
    if (ctx.isNight) {
      endWave();
      return;
    }
    if (tick % 15 === 0) {
      updateWall(ctx);
      updateRises(ctx);
      if (st.surgeUntil && tick >= st.surgeUntil) {
        st.surgeUntil = 0;
        for (const u of ctx.units) {
          if (u.team === 'enemy' && u.hp > 0 && u.hostLead && !u.dash && u.tacBase) {
            u.speed = u.tacBase;
          }
        }
      }
      st.rifts = st.rifts.filter((r) => !r.closeAt || tick < r.closeAt + 60);
    }
    if (tick % 30 === 0) {
      updatePrey(ctx);
      updatePatches(ctx);
    }
    if (tick % 60 === 0) updateDashTurn(ctx);
  }

  // -------------------------------------------------------------------- draw
  function stroke2(c, color, lw) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = INK;
    c.lineWidth = lw + 2.5;
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.stroke();
  }

  function drawRift(c, r, tick) {
    const open = tick >= r.openAt;
    const span = Math.max(1, r.openAt - r.born);
    const k = open ? 1 : Math.max(0.15, (tick - r.born) / span);
    const fade = r.closeAt && tick > r.closeAt ? Math.max(0, 1 - (tick - r.closeAt) / 60) : 1;
    const rx = 26 * k;
    const ry = 13 * k;
    c.save();
    c.globalAlpha = fade;
    c.translate(r.x, r.y);
    if (r.style === 'tunnel') {
      // A mound of thrown earth with a black mouth.
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, 2, rx + 6, ry + 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = EARTH;
      c.beginPath();
      c.ellipse(0, 0, rx + 3, ry + 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, 1, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + ((tick + i * 17) % 40) / 40;
        c.fillStyle = EARTH;
        c.fillRect(
          Math.cos(a) * (rx + 6),
          Math.sin(a) * (ry + 4) - ((tick + i * 9) % 20) * 0.4,
          3,
          3
        );
      }
    } else {
      // A tear: black heart, violet rim, turning hooks.
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      stroke2(c, VIOLET, 2);
      const spin = tick * 0.06;
      for (let i = 0; i < 4; i++) {
        const a = spin + (i / 4) * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * rx, Math.sin(a) * ry);
        c.quadraticCurveTo(
          Math.cos(a + 0.5) * (rx + 10),
          Math.sin(a + 0.5) * (ry + 8),
          Math.cos(a + 0.9) * (rx + 4),
          Math.sin(a + 0.9) * (ry + 3)
        );
        stroke2(c, open ? BLOOD : VIOLET, 1.5);
      }
    }
    if (!open) {
      // Count down to the moment they step out.
      c.beginPath();
      c.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - (tick - r.born) / span));
      stroke2(c, BONE, 1.5);
    }
    c.restore();
  }

  function drawPatch(c, p, tick) {
    const left = p.until - tick;
    const a = Math.min(1, left / 90);
    c.save();
    c.translate(p.x, p.y);
    c.globalAlpha = 0.55 * a;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = a;
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + i;
      const d = p.r * (0.25 + ((i * 37) % 60) / 100);
      const fx = Math.cos(ang) * d;
      const fy = Math.sin(ang) * d * 0.55;
      const h = 7 + ((tick + i * 13) % 16) * 0.55;
      c.beginPath();
      c.moveTo(fx - 3.5, fy);
      c.quadraticCurveTo(fx - 1, fy - h * 0.5, fx, fy - h);
      c.quadraticCurveTo(fx + 1.5, fy - h * 0.4, fx + 3.5, fy);
      c.closePath();
      c.fillStyle = i % 2 ? EMBER : BLOOD;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();
  }

  function drawBones(c, r, tick) {
    const k = Math.min(1, (tick - r.born) / Math.max(1, r.at - r.born));
    c.save();
    c.translate(r.x, r.y);
    c.strokeStyle = INK;
    c.fillStyle = BONE;
    c.lineWidth = 1;
    // Skull and two crossed bones.
    c.beginPath();
    c.arc(0, -2, 4.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    c.fillRect(-2.5, -3, 1.6, 1.6);
    c.fillRect(1, -3, 1.6, 1.6);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(-7 * s, 3);
      c.lineTo(7 * s, 7);
      stroke2(c, BONE, 1.6);
    }
    c.beginPath();
    c.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    stroke2(c, k > 0.75 ? BLOOD : BONE, 1.5);
    c.restore();
  }

  function drawPrey(c, p, tick) {
    const bob = Math.sin(tick * 0.15) * 2;
    c.save();
    c.translate(p.x, p.y - 26 + bob);
    // Three talons closing on the soldier below.
    for (const s of [-1, 0, 1]) {
      c.beginPath();
      c.moveTo(s * 7, -9);
      c.quadraticCurveTo(s * 9, -2, s * 3, 5);
      stroke2(c, BLOOD, 2);
    }
    c.restore();
    c.beginPath();
    c.ellipse(p.x, p.y + 6, 13, 6, 0, 0, Math.PI * 2);
    stroke2(c, BLOOD, 1.2);
  }

  function drawOver(c, tick) {
    if (!st.active) return;
    for (const p of st.patches) drawPatch(c, p, tick);
    for (const r of st.rifts) drawRift(c, r, tick);
    for (const r of st.rises) drawBones(c, r, tick);
    const w = st.wall;
    if (w && w.state === 'advance' && w.x1 > w.x0) {
      // The line the shields are holding.
      c.setLineDash?.([7, 5]);
      c.beginPath();
      c.moveTo(w.x0 - 8, w.lineY + 12);
      c.lineTo(w.x1 + 8, w.lineY + 12);
      stroke2(c, st.crest, 1.6);
      c.setLineDash?.([]);
    }
    if (st.tactic.dive && st.prey && st.prey.hp > 0) drawPrey(c, st.prey, tick);
    const a = st.avengerUnit;
    if (a && a.hp > 0) {
      c.beginPath();
      c.ellipse(a.x, a.y + 7, 17, 8, 0, 0, Math.PI * 2);
      stroke2(c, st.crest, 2.2);
      c.beginPath();
      c.moveTo(a.x, a.y - 30);
      c.lineTo(a.x + 6, a.y - 22);
      c.lineTo(a.x, a.y - 14);
      c.lineTo(a.x - 6, a.y - 22);
      c.closePath();
      c.fillStyle = st.crest;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.5;
      c.stroke();
    }
  }

  /** What the active tactic has done so far this wave. */
  function getState() {
    return {
      active: st.active,
      tacticId: st.tactic ? st.tactic.id : null,
      leadId: st.plan ? st.plan.leadId : null,
      fired: { ...st.fired },
      wall: st.wall ? st.wall.state : null,
      rifts: st.rifts.length,
      patches: st.patches.length,
      pendingRises: st.rises.length,
      prey: st.prey ? st.prey.id : null,
      ambushLeft: st.ambush ? st.ambush.left : 0,
    };
  }

  return {
    resetRun,
    beginWave,
    endWave,
    spawnTweak,
    onSpawn,
    squad,
    drive,
    preyFor,
    onDeath,
    onHit,
    onBossPhase,
    update,
    drawOver,
    getState,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.HostTactics = HostTactics;
