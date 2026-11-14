/**
 * WarCamps — the enemy's structures, in a small form.
 *
 * From about wave 6 the host may raise a camp at nightfall, just inside the top edge, in one
 * of the three top sectors. A camp that still stands at dawn gives the coming wave one named
 * bonus, shown in the night preview and on the camp itself. Burn it before dawn and the
 * bonus is gone, for a small TP bounty and a chance at a marked supply crate.
 *
 *   - A camp is a real enemy building (type `war_camp_*`), so damage, rubble, the health bar,
 *     Sapper blasts and siege multipliers all go through the ordinary building code.
 *   - Soldiers never walk off to a camp on their own. A camp is attacked only by soldiers the
 *     player has ordered onto it (a move order that lands on the camp), by blasts and strikes
 *     that land on it, and by the spy's Settlement Raid.
 *   - Each camp has a few guards. They do not leave the camp; they throw at any soldier of
 *     yours within reach, and they fall as the camp is torn down.
 *   - At most two camps stand at once. A camp that is left alone packs up after a few waves.
 *
 * Hooked from Game: enterNightPhase, beginDayPhase (after the spawn queue is built), the
 * enemy spawn loop, moveSelectionToWorld, damageInRadius, finalizeBuildingDestroyed, the
 * world draw pass, save and load. The drawings register with BuildingArt.
 */
const WarCamps = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const EMBER = '#ff8a30';

  /** First wave a camp can strengthen (so the first camp can rise the night before it). */
  const FROM_WAVE = 6;
  const MAX_CAMPS = 2;
  /** Chance per eligible nightfall that a camp is raised. */
  const RAISE_CHANCE = 0.5;
  /** Waves a camp strengthens before it packs up and moves on. */
  const LIFE_WAVES = 3;
  const CAMP_RADIUS = 24;
  /** How far inside the top edge a camp sits. */
  const TOP_MIN = 46;
  const TOP_MAX = 64;
  const GUARD_REACH = 104;
  const GUARD_EVERY = 56;
  /** Strikes and blasts that are not a Sapper's (those go through the building code). */
  const STRIKE_MULT = 2;
  const CRATE_CHANCE = 0.35;
  const RAID_TICKS = 240;

  const SECTORS = ['left', 'centre', 'right'];
  const SECTOR_LABEL = { left: 'left', centre: 'centre', right: 'right' };

  /**
   * One bonus per kind. `line` is the text the preview and the camp both show.
   *  - forge: every enemy of the wave has 15% more health (forged plate).
   *  - drums: every enemy marches 15% faster.
   *  - kennels: a small pack of runners joins and goes for the line.
   *  - shrine: the host fights to the death; nobody routs.
   *  - siege: one siege engine joins.
   */
  const KINDS = {
    forge: {
      type: 'war_camp_forge',
      name: 'Forge',
      line: 'enemies are 15% tougher',
      hpMult: 1.15,
    },
    drums: {
      type: 'war_camp_drums',
      name: 'Drum pit',
      line: 'the host marches 15% faster',
      speedMult: 1.15,
    },
    kennels: {
      type: 'war_camp_kennels',
      name: 'Kennels',
      line: 'a pack of runners joins',
      runnerType: 'warg_rider',
      runnerFallback: 'goblin',
    },
    shrine: {
      type: 'war_camp_shrine',
      name: 'Shrine',
      line: 'enemies do not rout',
      noRout: true,
    },
    siege: {
      type: 'war_camp_siege',
      name: 'Siege yard',
      line: 'a siege engine joins',
      engine: 'siege_tower',
      fromWave: 7,
    },
  };
  const KIND_IDS = Object.keys(KINDS);
  const TYPE_TO_KIND = {};
  for (const id of KIND_IDS) TYPE_TO_KIND[KINDS[id].type] = id;

  let state = fresh();

  function fresh() {
    return {
      /** {id, kind, sector, raisedWave, x, y, sabotaged} — `id` is the building's id. */
      camps: [],
      /** Bonuses locked in at dawn for the wave being fought: {kind, name, line}. */
      active: [],
      /** Runners the Kennels still owe this wave. */
      runnersLeft: 0,
      /** Pending spy raid: {campId, at, resolved}. */
      raid: null,
      /** Reprisal runners owed to the next wave after a raid that was seen. */
      reprisal: 0,
      /** Short-lived drawings: guard javelins, raid torches, burn marks. */
      fx: [],
      razed: 0,
    };
  }

  function resetRun() {
    state = fresh();
  }

  // ------------------------------------------------------------------- defs
  function campDef(kind, wave) {
    const w = Math.max(1, wave || 1);
    return {
      name: `${KINDS[kind].name} (war camp)`,
      cost: 0,
      hp: 240 + 14 * w,
      cover: 0,
      radius: CAMP_RADIUS,
      attackRadius: CAMP_RADIUS + 4,
      blocksMove: false,
      blocksLOS: false,
      buildTime: 1,
      isWarCamp: true,
      campKind: kind,
    };
  }

  /** The building table is replaced when data reloads, so the camp types are re-added on use. */
  function ensureDefs() {
    if (typeof BuildDefs === 'undefined' || !BuildDefs) return false;
    for (const id of KIND_IDS) {
      if (!BuildDefs[KINDS[id].type]) BuildDefs[KINDS[id].type] = campDef(id, 1);
    }
    return true;
  }

  function isCampType(type) {
    return !!TYPE_TO_KIND[type];
  }

  function isCamp(b) {
    return !!b && isCampType(b.type);
  }

  function kindOf(b) {
    return b ? TYPE_TO_KIND[b.type] || null : null;
  }

  // ---------------------------------------------------------------- lookups
  function buildingOf(camp, ctx) {
    const list = (ctx && ctx.buildings) || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === camp.id && list[i].hp > 0) return list[i];
    }
    return null;
  }

  /** Drop records whose building is gone (destroyed, or cleared by a restart). */
  function prune(ctx) {
    if (!state.camps.length) return;
    state.camps = state.camps.filter((c) => !!buildingOf(c, ctx));
  }

  function standing(ctx) {
    if (ctx) prune(ctx);
    return state.camps.slice();
  }

  function campAt(x, y, ctx, pad = 12) {
    for (const c of state.camps) {
      const b = buildingOf(c, ctx);
      if (!b) continue;
      const r = (b.radius || CAMP_RADIUS) + pad;
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= r * r) return c;
    }
    return null;
  }

  // ---------------------------------------------------------------- sectors
  /** Normalise whatever the wave plan calls a sector to 'left' | 'centre' | 'right'. */
  function sectorId(s) {
    if (s == null) return null;
    if (typeof s === 'number') return SECTORS[Math.max(0, Math.min(2, Math.floor(s)))];
    if (typeof s === 'object') return sectorId(s.id ?? s.sector ?? s.name ?? s.index);
    const t = String(s).toLowerCase();
    if (t === 'center' || t === 'centre' || t === 'middle' || t === 'mid') return 'centre';
    if (t === 'left' || t === 'west') return 'left';
    if (t === 'right' || t === 'east') return 'right';
    return null;
  }

  /** Sectors the next wave will use, when the plan names them; otherwise null. */
  function planSectors(plan) {
    if (!plan) return null;
    const raw = plan.sectors || plan.topSectors || plan.multiFrontPlan?.sectors || null;
    if (!Array.isArray(raw) || !raw.length) return null;
    const out = [];
    for (const s of raw) {
      const id = sectorId(s);
      if (id && !out.includes(id)) out.push(id);
    }
    return out.length ? out : null;
  }

  function sectorRange(sector, worldW) {
    const third = worldW / 3;
    const i = Math.max(0, SECTORS.indexOf(sector));
    return { x0: third * i, x1: third * (i + 1) };
  }

  function sectorOfX(x, worldW) {
    return SECTORS[Math.max(0, Math.min(2, Math.floor((x / Math.max(1, worldW)) * 3)))];
  }

  /**
   * Where a new camp goes: inside the chosen third of the top edge, clear of the other camp,
   * and always far above the player's deploy line.
   */
  function pickSite(sector, ctx) {
    const { x0, x1 } = sectorRange(sector, ctx.worldW);
    const pad = CAMP_RADIUS + 14;
    const lo = Math.max(pad, x0 + pad * 0.5);
    const hi = Math.min(ctx.worldW - pad, x1 - pad * 0.5);
    for (let tries = 0; tries < 8; tries++) {
      const x = lo + ctx.rng() * Math.max(1, hi - lo);
      const y = TOP_MIN + ctx.rng() * (TOP_MAX - TOP_MIN);
      let clear = true;
      for (const c of state.camps) {
        const dx = c.x - x;
        const dy = c.y - y;
        if (dx * dx + dy * dy < (CAMP_RADIUS * 3) ** 2) clear = false;
      }
      if (clear && (!ctx.blocked || !ctx.blocked(x, y, null))) return { x, y };
    }
    return null;
  }

  // ------------------------------------------------------------------ raise
  function canRaise(ctx) {
    if (!ctx || ctx.creative) return false;
    if ((ctx.wave || 0) + 1 < FROM_WAVE) return false;
    prune(ctx);
    return state.camps.length < MAX_CAMPS;
  }

  /**
   * Put a camp on the field. `opts.kind` and `opts.sector` are chosen at random when absent.
   * @returns {object|null} the camp record
   */
  function raiseCamp(ctx, opts = {}) {
    if (!ctx || !ctx.createCamp || !ensureDefs()) return null;
    prune(ctx);
    if (state.camps.length >= MAX_CAMPS && !opts.force) return null;
    const nextWave = (ctx.wave || 0) + 1;
    const held = new Set(state.camps.map((c) => c.kind));
    let kind = opts.kind;
    if (!kind) {
      const pool = KIND_IDS.filter(
        (id) => !held.has(id) && nextWave >= (KINDS[id].fromWave || FROM_WAVE)
      );
      if (!pool.length) return null;
      kind = pool[Math.floor(ctx.rng() * pool.length)];
    }
    if (!KINDS[kind]) return null;
    let sector = sectorId(opts.sector);
    if (!sector) {
      const used = new Set(state.camps.map((c) => c.sector));
      const planned = planSectors(ctx.nextPlan);
      let pool = (planned || SECTORS).filter((s) => !used.has(s));
      if (!pool.length) pool = SECTORS.filter((s) => !used.has(s));
      if (!pool.length) pool = SECTORS;
      sector = pool[Math.floor(ctx.rng() * pool.length)];
    }
    const site = opts.x != null && opts.y != null ? { x: opts.x, y: opts.y } : pickSite(sector, ctx);
    if (!site) return null;
    // The camp's health follows the wave it was raised for.
    BuildDefs[KINDS[kind].type] = campDef(kind, nextWave);
    const b = ctx.createCamp(KINDS[kind].type, site.x, site.y);
    if (!b) return null;
    const camp = {
      id: b.id,
      kind,
      sector,
      raisedWave: nextWave,
      x: b.x,
      y: b.y,
      sabotaged: false,
    };
    state.camps.push(camp);
    if (!opts.silent) {
      const k = KINDS[kind];
      ctx.showMessage(
        `The enemy raises a ${k.name} on the ${SECTOR_LABEL[sector]} of the top edge. Unless it burns before dawn, ${k.line}.`,
        340
      );
      ctx.float(b.x, b.y - 30, `${k.name.toUpperCase()} RAISED`, '#ff8060');
      ctx.playSfx('musterDrums');
    }
    return camp;
  }

  function onNightBegin(ctx) {
    if (!ctx) return null;
    state.active = [];
    state.runnersLeft = 0;
    prune(ctx);
    // A camp left alone for long enough packs up.
    for (const c of state.camps.slice()) {
      if ((ctx.wave || 0) + 1 - c.raisedWave >= LIFE_WAVES) {
        const b = buildingOf(c, ctx);
        if (b && ctx.removeCamp) ctx.removeCamp(b);
        state.camps = state.camps.filter((x) => x !== c);
        ctx.showMessage(`The ${KINDS[c.kind].name} strikes its tents and moves on.`, 220);
      } else c.sabotaged = false;
    }
    if (state.raid && !state.raid.resolved && state.raid.at == null) {
      // A raid ordered by day rides at nightfall.
      state.raid.at = (ctx.tick || 0) + RAID_TICKS;
    }
    if (!canRaise(ctx)) return null;
    if (ctx.rng() >= RAISE_CHANCE) return null;
    return raiseCamp(ctx);
  }

  // ------------------------------------------------------------------ bonus
  /** Bonuses the next wave will get if nothing changes, for the preview. */
  function pendingBonuses(ctx) {
    prune(ctx);
    return state.camps
      .filter((c) => !c.sabotaged)
      .map((c) => ({
        kind: c.kind,
        name: KINDS[c.kind].name,
        line: KINDS[c.kind].line,
        sector: c.sector,
      }));
  }

  /** One sentence for the night preview, or '' when no camp stands. */
  function previewLine(ctx) {
    const list = pendingBonuses(ctx);
    if (!list.length) return '';
    return list.map((b) => `${b.name} (${SECTOR_LABEL[b.sector]}): ${b.line}`).join(' · ');
  }

  function runnerCount(wave) {
    return wave >= 20 ? 3 : 2;
  }

  /**
   * Dawn. Lock in the bonuses of the camps still standing and add their extra bodies to the
   * queue. Called after the spawn queue is built and before Sabotage strips siege engines.
   */
  function onWaveStart(ctx) {
    state.active = [];
    state.runnersLeft = 0;
    if (!ctx || ctx.creative) return state.active;
    prune(ctx);
    const queue = ctx.spawnQueue;
    for (const c of state.camps) {
      if (c.sabotaged) continue;
      const k = KINDS[c.kind];
      state.active.push({ kind: c.kind, name: k.name, line: k.line });
      if (k.engine && queue) {
        queue.splice(Math.min(queue.length, 2), 0, k.engine);
      }
      if (k.runnerType && queue) {
        const type =
          typeof EnemyDefs !== 'undefined' && EnemyDefs[k.runnerType] ? k.runnerType : k.runnerFallback;
        const n = runnerCount(ctx.wave);
        for (let i = 0; i < n; i++) queue.splice(Math.min(queue.length, 3 + i * 2), 0, type);
        state.runnersLeft += n;
        state.runnerType = type;
      }
    }
    if (state.reprisal > 0 && queue) {
      const type = typeof EnemyDefs !== 'undefined' && EnemyDefs.goblin ? 'goblin' : queue[0];
      for (let i = 0; i < state.reprisal; i++) queue.push(type);
      ctx.showMessage(
        `Reprisal: ${state.reprisal} more foes follow last night's raiders home.`,
        240
      );
      state.reprisal = 0;
    }
    if (state.active.length) {
      ctx.showMessage(
        `War camps stand: ${state.active.map((a) => `${a.name} — ${a.line}`).join('; ')}.`,
        320
      );
    }
    return state.active;
  }

  function has(kind) {
    for (const a of state.active) if (a.kind === kind) return true;
    return false;
  }

  /** Applied to each enemy as it enters the field, after runners have been tagged. */
  function onEnemySpawn(unit) {
    if (!unit || unit.team !== 'enemy' || !state.active.length) return null;
    let label = null;
    if (has('forge') && !unit.isNamedBoss) {
      unit.maxHp = Math.round(unit.maxHp * KINDS.forge.hpMult);
      unit.hp = Math.round(unit.hp * KINDS.forge.hpMult);
    }
    if (has('drums') && unit.speed) unit.speed *= KINDS.drums.speedMult;
    if (has('shrine')) unit.fightToDeath = true;
    if (state.runnersLeft > 0 && unit.type === state.runnerType && !unit.lineBreaker) {
      state.runnersLeft--;
      unit.lineBreaker = true;
      unit.stormLine = true;
      unit.speed *= 1.3;
      label = 'KENNEL PACK';
    }
    return label;
  }

  // ----------------------------------------------------------------- orders
  /**
   * The player moved soldiers. A move that lands on a camp is an order to attack it; any
   * other move cancels that order.
   */
  function onMoveOrder(units, x, y, ctx) {
    const camp = state.camps.length ? campAt(x, y, ctx) : null;
    let sent = 0;
    for (const u of units || []) {
      if (!u || u.team !== 'player') continue;
      if (camp && u.combatType !== 'builder' && u.combatType !== 'courier') {
        u.campOrderId = camp.id;
        u.campCd = 0;
        sent++;
      } else u.campOrderId = null;
    }
    if (camp && sent && ctx) {
      ctx.float(camp.x, camp.y - 34, 'ATTACK THE CAMP', '#ffd080');
    }
    return camp && sent ? camp : null;
  }

  function inReach(u, b) {
    const d = Math.hypot(u.x - b.x, u.y - b.y) - (b.radius || CAMP_RADIUS);
    if (u.combatType === 'ranged' || u.projectile) return d <= (u.range || 60) * 0.92 + 6;
    return d <= (u.meleeRange || u.range || 28) + 14;
  }

  function guardCount(camp, b) {
    const max = 2 + Math.min(2, Math.floor(camp.raisedWave / 12));
    return Math.max(0, Math.ceil(max * Math.min(1, b.hp / Math.max(1, b.maxHp))));
  }

  function guardDamage(camp) {
    return 5 + Math.round(camp.raisedWave * 0.45);
  }

  function update(ctx) {
    if (!ctx) return;
    const tick = ctx.tick || 0;
    if (state.fx.length) {
      for (const f of state.fx) f.age++;
      state.fx = state.fx.filter((f) => f.age < f.life);
    }
    if (state.raid && !state.raid.resolved && state.raid.at != null && tick >= state.raid.at) {
      resolveRaid(ctx);
    }
    if (!state.camps.length) return;
    if (tick % 2 !== 0) return;
    const units = ctx.units;
    const live = [];
    for (const c of state.camps) {
      const b = buildingOf(c, ctx);
      if (b) live.push([c, b]);
    }
    if (live.length !== state.camps.length) prune(ctx);
    if (!live.length) return;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.team !== 'player' || u.hp <= 0 || !u.campOrderId) continue;
      let pair = null;
      for (const p of live) if (p[0].id === u.campOrderId) pair = p;
      if (!pair) {
        u.campOrderId = null;
        continue;
      }
      const b = pair[1];
      if (b.hp <= 0 || !inReach(u, b)) continue;
      if (u.fleeing || u.demoralized || u.retreatingToMed || u.pinned || u.garrisoned) continue;
      if (u.combatType === 'healer' || u.combatType === 'builder') continue;
      u.campCd = (u.campCd || 0) - 2;
      if (u.campCd > 0 || u.attackAnimTimer > 0) continue;
      // A foe within reach comes first; the camp does not hit back as hard as a sword.
      if (ctx.foeInReach && ctx.foeInReach(u)) continue;
      const siege = u.type === 'sapper' || (u.siegeMult || 1) >= 2;
      u.campCd = siege ? 42 : u.combatType === 'ranged' ? 52 : 58;
      u.animState = 'attack';
      u.attackAnimTimer = 14;
      u.rotation = Math.round((Math.atan2(b.y - u.y, b.x - u.x) * 180) / Math.PI);
      const dmg = ctx.campDamage ? ctx.campDamage(u, b) : Math.max(4, (u.damage || 10) * 0.4);
      ctx.hurtBuilding(b, dmg, u);
      if (siege) ctx.float(b.x, b.y - 20, 'SIEGE!', '#ff8040');
    }
    // The garrison throws at whoever comes close.
    for (const [c, b] of live) {
      if (b.hp <= 0) continue;
      c.guardCd = (c.guardCd || 0) - 2;
      if (c.guardCd > 0) continue;
      c.guardCd = GUARD_EVERY;
      const guards = guardCount(c, b);
      if (!guards) continue;
      const near = [];
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.team !== 'player' || u.hp <= 0) continue;
        const dx = u.x - b.x;
        const dy = u.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= GUARD_REACH * GUARD_REACH) near.push([d2, u]);
      }
      if (!near.length) continue;
      near.sort((a, z) => a[0] - z[0]);
      for (let g = 0; g < guards; g++) {
        const u = near[g % near.length][1];
        if (u.hp <= 0) continue;
        const a = guardSpot(b, g);
        state.fx.push({ k: 'javelin', x1: a.x, y1: a.y, x2: u.x, y2: u.y - 6, age: 0, life: 14 });
        ctx.hurt(u, guardDamage(c), null);
      }
      ctx.playSfx('arrowShoot');
    }
  }

  // ----------------------------------------------------------------- damage
  /** A strike or a blast landed at (x, y). Sapper blasts reach camps through the building code. */
  function onBlast(x, y, radius, damage, ctx) {
    if (!state.camps.length || !ctx || !(damage > 0)) return 0;
    let hit = 0;
    for (const c of state.camps.slice()) {
      const b = buildingOf(c, ctx);
      if (!b) continue;
      const reach = radius + (b.radius || CAMP_RADIUS);
      const dx = b.x - x;
      const dy = b.y - y;
      if (dx * dx + dy * dy > reach * reach) continue;
      ctx.hurtBuilding(b, damage * STRIKE_MULT, null);
      hit++;
    }
    return hit;
  }

  function bounty(camp) {
    return 3 + Math.floor((camp?.raisedWave || FROM_WAVE) / 8);
  }

  /** Called by the building code when a camp's health reaches zero. */
  function onDestroyed(b, attacker, ctx, opts = {}) {
    const camp = state.camps.find((c) => c.id === b.id);
    if (!camp) return null;
    state.camps = state.camps.filter((c) => c !== camp);
    state.razed++;
    const k = KINDS[camp.kind];
    const tp = opts.noBounty ? 0 : bounty(camp);
    const wasActive = state.active.some((a) => a.kind === camp.kind);
    let crate = false;
    if (ctx) {
      if (tp > 0) {
        ctx.addTp(tp);
        ctx.float(b.x, b.y - 26, `+${tp} TP`, '#80ffa0');
      }
      if (!opts.noCrate && ctx.rng() < CRATE_CHANCE && ctx.markCrate) crate = !!ctx.markCrate();
      ctx.burst('explosion', b.x, b.y);
      ctx.shake(4);
      state.fx.push({ k: 'burn', x: b.x, y: b.y, age: 0, life: 150 });
      // Whoever was sent here goes back to his line instead of standing in the ashes.
      for (const u of ctx.units) if (u.campOrderId === b.id) u.campOrderId = null;
      const lost = wasActive
        ? ' Too late for today: the host already marched with its help.'
        : ` The next wave loses its bonus (${k.line}).`;
      ctx.showMessage(
        `${k.name} destroyed!${tp ? ` +${tp} TP.` : ''}${lost}${crate ? ' Its stores were carried off: a marked crate lands at dawn.' : ''}`,
        320
      );
      if (ctx.refreshPreview) ctx.refreshPreview();
    }
    return { kind: camp.kind, tp, crate };
  }

  // ------------------------------------------------------------------- raid
  /** @returns {{ok: boolean, reason?: string, camp?: object}} */
  function canRaid(ctx) {
    prune(ctx);
    if (!state.camps.length) {
      return { ok: false, reason: 'No war camp stands. A raid needs a camp to burn.' };
    }
    if (state.raid && !state.raid.resolved) {
      return { ok: false, reason: 'A raid is already riding.' };
    }
    return { ok: true };
  }

  /**
   * Spy: Settlement Raid. A party rides off the field and falls on the weakest camp. Ordered
   * at night it lands a few seconds later; ordered by day it rides at nightfall.
   */
  function orderRaid(ctx) {
    const gate = canRaid(ctx);
    if (!gate.ok) return gate;
    let target = null;
    let worst = Infinity;
    for (const c of state.camps) {
      const b = buildingOf(c, ctx);
      const r = b.hp / Math.max(1, b.maxHp);
      if (r < worst) {
        worst = r;
        target = c;
      }
    }
    state.raid = {
      campId: target.id,
      at: ctx.isNight ? (ctx.tick || 0) + RAID_TICKS : null,
      from: ctx.rng() < 0.5 ? 'left' : 'right',
      ordered: ctx.tick || 0,
      resolved: false,
    };
    const k = KINDS[target.kind];
    ctx.showMessage(
      ctx.isNight
        ? `Raiders ride for the ${k.name}. They strike in a few seconds.`
        : `Raiders will ride for the ${k.name} at nightfall.`,
      260
    );
    ctx.float(target.x, target.y - 34, 'RAID COMING', '#ffb060');
    return { ok: true, camp: target };
  }

  /**
   * The raid lands. 55%: the camp burns. 35%: it is badly damaged. 10%: the raiders are driven
   * off. In every case but a clean burn there is a 50% chance the garrison follows them home,
   * and a few more foes join the next wave.
   */
  function resolveRaid(ctx) {
    const raid = state.raid;
    if (!raid || raid.resolved) return null;
    raid.resolved = true;
    const camp = state.camps.find((c) => c.id === raid.campId);
    const b = camp ? buildingOf(camp, ctx) : null;
    if (!camp || !b) {
      ctx.showMessage('The raiders found only ashes: the camp was already gone.', 220);
      state.raid = null;
      return { outcome: 'gone' };
    }
    const k = KINDS[camp.kind];
    const roll = ctx.rng();
    let outcome;
    ctx.burst('explosion', b.x, b.y);
    ctx.shake(5);
    ctx.playSfx('firebomb');
    state.fx.push({ k: 'burn', x: b.x, y: b.y, age: 0, life: 150 });
    if (roll < 0.55) {
      outcome = 'burned';
      ctx.float(b.x, b.y - 30, 'RAID! CAMP BURNS', '#ff8040');
      // The building code calls onDestroyed, which pays the bounty.
      ctx.hurtBuilding(b, b.hp + 1, null);
    } else if (roll < 0.9) {
      outcome = 'damaged';
      const dmg = Math.round(b.maxHp * 0.6);
      ctx.float(b.x, b.y - 30, 'RAID!', '#ff8040');
      ctx.hurtBuilding(b, dmg, null);
      if (buildingOf(camp, ctx)) {
        ctx.showMessage(
          `The raid tore through the ${k.name} but it still stands. Finish it before dawn.`,
          280
        );
      }
    } else {
      outcome = 'repulsed';
      ctx.float(b.x, b.y - 30, 'RAID DRIVEN OFF', '#ff4040');
      ctx.showMessage(`The ${k.name}'s guards drove the raiders off.`, 260);
    }
    let reprisal = 0;
    if (outcome !== 'burned' && ctx.rng() < 0.5) {
      reprisal = 2 + Math.min(2, Math.floor((ctx.wave || 0) / 15));
      state.reprisal += reprisal;
      ctx.showMessage(`The raiders were followed: ${reprisal} more foes join the next wave.`, 260);
    }
    state.raid = null;
    return { outcome, reprisal };
  }

  /** Spy: Sabotage also spikes one camp for the coming wave (Siege yard first, then Forge). */
  function sabotage(ctx) {
    prune(ctx);
    const order = ['siege', 'forge', 'drums', 'kennels', 'shrine'];
    for (const kind of order) {
      const c = state.camps.find((x) => x.kind === kind && !x.sabotaged);
      if (!c) continue;
      c.sabotaged = true;
      if (ctx) {
        ctx.float(c.x, c.y - 30, 'SABOTAGED', '#ffb060');
        if (ctx.refreshPreview) ctx.refreshPreview();
      }
      return c;
    }
    return null;
  }

  // ------------------------------------------------------------------- draw
  function guardSpot(b, i) {
    const spots = [
      [-0.95, 0.55],
      [0.95, 0.55],
      [-0.35, 1.05],
      [0.45, 1.05],
    ];
    const s = spots[i % spots.length];
    const r = b.radius || CAMP_RADIUS;
    return { x: b.x + s[0] * r, y: b.y + s[1] * r };
  }

  function drawGuard(g, x, y, k, tick, seed) {
    const bob = Math.sin((tick + seed * 37) / 26) * 0.6;
    g.save();
    g.translate(x, y + bob);
    g.lineJoin = 'round';
    // spear
    g.strokeStyle = INK;
    g.lineWidth = 2.2 * k;
    g.beginPath();
    g.moveTo(4 * k, 4 * k);
    g.lineTo(4 * k, -13 * k);
    g.stroke();
    g.strokeStyle = BONE;
    g.lineWidth = 1 * k;
    g.beginPath();
    g.moveTo(4 * k, -10 * k);
    g.lineTo(4 * k, -13.5 * k);
    g.stroke();
    // body: a hunched cloak, inked
    g.fillStyle = '#2a2327';
    g.strokeStyle = INK;
    g.lineWidth = 1.4 * k;
    g.beginPath();
    g.moveTo(-4 * k, 5 * k);
    g.lineTo(-3 * k, -3 * k);
    g.lineTo(3 * k, -3 * k);
    g.lineTo(4.4 * k, 5 * k);
    g.closePath();
    g.fill();
    g.stroke();
    // head and a blood-red eye slit
    g.fillStyle = '#5b6b3c';
    g.beginPath();
    g.arc(0, -5.6 * k, 2.9 * k, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = BLOOD;
    g.fillRect(-1.8 * k, -6.2 * k, 3.6 * k, 1 * k);
    g.restore();
  }

  function drawLabel(g, x, y, head, sub, k, dim) {
    g.font = `bold ${Math.round(11 * k)}px Georgia, serif`;
    g.textAlign = 'center';
    const wHead = g.measureText(head).width;
    g.font = `${Math.round(9.5 * k)}px Georgia, serif`;
    const wSub = sub ? g.measureText(sub).width : 0;
    const wide = Math.max(wHead, wSub) + 14 * k;
    const tall = (sub ? 30 : 18) * k;
    g.globalAlpha = dim ? 0.75 : 1;
    g.fillStyle = INK;
    g.fillRect(x - wide / 2, y - tall, wide, tall);
    g.strokeStyle = BLOOD;
    g.lineWidth = 1.5 * k;
    g.strokeRect(x - wide / 2, y - tall, wide, tall);
    g.fillStyle = BONE;
    g.font = `bold ${Math.round(11 * k)}px Georgia, serif`;
    g.fillText(head, x, y - tall + 13 * k);
    if (sub) {
      g.fillStyle = dim ? '#9a9382' : '#f0b070';
      g.font = `${Math.round(9.5 * k)}px Georgia, serif`;
      g.fillText(sub, x, y - 5 * k);
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
  }

  /** Guards, labels, raid torches and javelins. Drawn over the buildings, in world space. */
  function draw(g, ctx, tick) {
    if (!g || !ctx) return;
    const k = 1 / Math.max(0.5, ctx.viewScale || 1);
    for (const c of state.camps) {
      const b = buildingOf(c, ctx);
      if (!b) continue;
      const guards = guardCount(c, b);
      for (let i = 0; i < guards; i++) {
        const p = guardSpot(b, i);
        drawGuard(g, p.x, p.y, 1, tick, i + c.x);
      }
      const kd = KINDS[c.kind];
      const live = state.active.some((a) => a.kind === c.kind);
      const sub = c.sabotaged
        ? 'sabotaged: no bonus this wave'
        : ctx.isNight
          ? `next wave: ${kd.line}`
          : live
            ? `this wave: ${kd.line}`
            : `next wave: ${kd.line}`;
      // Below the camp: the top bar covers anything drawn above a building this close to the edge.
      drawLabel(
        g,
        b.x,
        b.y + (b.radius || CAMP_RADIUS) + 40 * k,
        kd.name.toUpperCase(),
        sub,
        k,
        c.sabotaged
      );
    }
    const raid = state.raid;
    if (raid && !raid.resolved && raid.at != null) {
      const camp = state.camps.find((c) => c.id === raid.campId);
      if (camp) {
        const span = Math.max(1, raid.at - raid.ordered);
        const t = Math.max(0, Math.min(1, 1 - (raid.at - tick) / span));
        const sx = raid.from === 'left' ? -10 : ctx.worldW + 10;
        const sy = camp.y + 90;
        for (let i = 0; i < 4; i++) {
          const lag = Math.max(0, t - i * 0.05);
          const x = sx + (camp.x - sx) * lag;
          const y = sy + (camp.y + 16 - sy) * lag + Math.sin((tick + i * 20) / 6) * 1.5;
          g.fillStyle = INK;
          g.beginPath();
          g.arc(x, y, 4.2, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = (tick + i * 5) % 8 < 4 ? EMBER : '#ffd27a';
          g.beginPath();
          g.arc(x, y - 4, 2.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    for (const f of state.fx) {
      const a = 1 - f.age / f.life;
      if (f.k === 'javelin') {
        const t = Math.min(1, f.age / 8);
        const x = f.x1 + (f.x2 - f.x1) * t;
        const y = f.y1 + (f.y2 - f.y1) * t;
        const px = f.x1 + (f.x2 - f.x1) * Math.max(0, t - 0.25);
        const py = f.y1 + (f.y2 - f.y1) * Math.max(0, t - 0.25);
        g.globalAlpha = Math.max(0.2, a);
        g.strokeStyle = INK;
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(x, y);
        g.stroke();
        g.strokeStyle = BONE;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(x, y);
        g.stroke();
        g.globalAlpha = 1;
      } else if (f.k === 'burn') {
        g.globalAlpha = a * 0.85;
        for (let i = 0; i < 7; i++) {
          const ang = i * 0.9 + f.x;
          const rr = 6 + ((i * 7 + f.age * 0.6) % 22);
          const x = f.x + Math.cos(ang) * rr * 0.9;
          const y = f.y + Math.sin(ang) * rr * 0.5 - f.age * 0.12;
          g.fillStyle = i % 2 ? EMBER : '#ffd27a';
          g.beginPath();
          g.arc(x, y, 3.2 * a + 1, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
    }
  }

  // -------------------------------------------------------------------- art
  /** Shared base: trampled ground, a low stake ring and the fire that marks a camp by night. */
  function registerArt() {
    if (typeof BuildingArt === 'undefined' || !BuildingArt.kit || !BuildingArt.register) return;
    const K = BuildingArt.kit;
    const C = K.C;
    const base = (g) => {
      K.ell(g, 0, 5, 27, 14, 'rgba(30,20,22,0.62)', 0);
      K.hatchEll?.(g, 0, 5, 25, 12, 4, 0.6, 0.25, 0.6);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        K.stake(g, Math.cos(a) * 25, 5 + Math.sin(a) * 12, 6.5, i % 2 ? C.hideD : C.woodDD);
      }
    };
    const front = (g) => {
      for (let i = 0; i < 6; i++) {
        const a = 0.16 * Math.PI + (i / 5) * 0.68 * Math.PI;
        if (i === 2 || i === 3) continue; // the gate
        K.stake(g, Math.cos(a) * 25, 5 + Math.sin(a) * 12, 6.5, i % 2 ? C.woodDD : C.hideD);
      }
    };
    const fire = (g, A, x, y) => {
      K.ell(g, x, y, 5.4, 2.8, C.dark, 1);
      K.beam(g, x - 4, y + 1, x + 3, y - 1.6, 1.3, C.woodD);
      K.beam(g, x + 4, y + 1, x - 3, y - 1.6, 1.3, C.woodD);
      A('torch', x, y - 1, { s: 1.35, r: 78 });
      A('smoke', x, y - 8, { s: 1.1, dark: 1 });
    };
    const scaled = (fn) => (g, r, o, fx) => {
      const s = (r || CAMP_RADIUS) / CAMP_RADIUS;
      const A = (kind, x, y, e) => {
        const ex = e ? Object.assign({}, e) : {};
        if (ex.r) ex.r *= s;
        ex.s = (ex.s || 1) * s;
        fx(kind, x * s, y * s, ex);
      };
      g.save();
      g.scale(s, s);
      base(g);
      fn(g, A);
      front(g);
      g.restore();
      return { shadow: [0, 8 * s, 26 * s, 9 * s] };
    };
    const tent = (g, x, y, r, rise) =>
      K.hideTent(g, x, y, r, rise, { roof: C.hideD, stripes: 'rgba(160,16,24,0.55)' });

    // Forge: an anvil block, a bellows hide, a quench barrel and a rack of blades.
    BuildingArt.register(
      'war_camp_forge',
      scaled((g, A) => {
        tent(g, -13, -3, 8.5, 12);
        K.block(g, 5, -6, 13, 8, 7, { fill: C.ewall, top: C.ewallD });
        K.rect(g, 8, -18, 4.6, 7, C.ewallD, 1.2);
        A('smoke', 10.3, -19, { s: 1.5, dark: 1 });
        A('torch', 9, -5, { s: 0.9, r: 54 });
        K.rect(g, -4.4, 6.4, 8.8, 3, C.iron, 1.2);
        K.rect(g, -2.4, 9.4, 4.8, 3.4, C.ironD, 1.2);
        K.barrel(g, 15, 8, 0.9, C.woodD);
        for (let i = 0; i < 4; i++) K.line(g, -17 + i * 2.2, 13, -15.6 + i * 2.2, 4, 1, C.iron);
        K.beam(g, -18.6, 13.4, -9, 13.4, 1.4, C.woodD);
        fire(g, A, 2, 15);
      })
    );

    // Drum pit: three hide drums round the fire and a horn pole.
    BuildingArt.register(
      'war_camp_drums',
      scaled((g, A) => {
        tent(g, 0, -8, 9.5, 13);
        K.drum(g, -13, 4, 6, 6.4, { fill: C.hide, top: C.canvasD });
        K.drum(g, 13, 4, 6, 6.4, { fill: C.hide, top: C.canvasD });
        K.drum(g, 0, 13, 5.2, 5.6, { fill: C.hideD, top: C.canvas });
        K.line(g, -16, -3, -11, 1, 1.2, C.woodL);
        K.line(g, 16, -3, 11, 1, 1.2, C.woodL);
        K.pole(g, 20, 10, 15);
        A('banner', 20.4, -4, { len: 7, h: 5, col: BLOOD, mark: INK, tail: 1 });
        fire(g, A, 0, 3);
      })
    );

    // Kennels: a stake cage, a chain post, gnawed bones.
    BuildingArt.register(
      'war_camp_kennels',
      scaled((g, A) => {
        tent(g, -14, -5, 8, 11.4);
        K.rect(g, 0, -9, 19, 12, 'rgba(21,16,17,0.85)', 1.3);
        for (let i = 0; i <= 6; i++) K.line(g, 0.6 + i * 3, -9, 0.6 + i * 3, 3, 1.1, C.woodD);
        K.beam(g, -0.6, -9, 19.6, -9, 1.6, C.woodDD);
        K.beam(g, -0.6, 3, 19.6, 3, 1.6, C.woodDD);
        // eyes in the dark of the cage
        g.fillStyle = BLOOD;
        g.fillRect(5, -3.4, 1.4, 1);
        g.fillRect(8, -3.4, 1.4, 1);
        g.fillRect(13.2, -1.2, 1.4, 1);
        g.fillRect(15.8, -1.2, 1.4, 1);
        K.pole(g, -4, 13, 9);
        K.line(g, -4, 5.4, 3, 11, 0.9, C.iron);
        K.skull(g, 12, 12, 0.8);
        K.line(g, 15, 13.6, 20, 12, 1.3, BONE);
        K.line(g, 5.4, 14.6, 9.4, 15.4, 1.2, BONE);
        fire(g, A, -11, 11);
      })
    );

    // Shrine: a standing stone ringed with skulls and a blood banner.
    BuildingArt.register(
      'war_camp_shrine',
      scaled((g, A) => {
        K.totem(g, -15, 2, 14);
        K.totem(g, 15, 2, 14);
        K.poly(
          g,
          [
            [-5.4, 4],
            [-4.2, -17],
            [0, -21],
            [4.4, -16],
            [5.6, 4],
          ],
          C.ewall,
          1.4
        );
        K.line(g, -2.4, -12, 2.6, -12, 1.1, BLOOD);
        K.line(g, 0, -15.6, 0, -6, 1.1, BLOOD);
        K.line(g, -2.4, -6, 2.6, -9, 1, BLOOD);
        K.skull(g, -9, 8, 0.85);
        K.skull(g, 9, 8, 0.85);
        K.skull(g, -4, 12.6, 0.75);
        K.skull(g, 4.6, 12.6, 0.75);
        A('banner', -15, -11, { len: 6, h: 5, col: BLOOD, mark: INK, tail: 1 });
        A('banner', 15, -11, { len: 6, h: 5, col: BLOOD, mark: INK, tail: 1 });
        fire(g, A, 0, 10);
      })
    );

    // Siege yard: a half-built tower frame, a timber stack and a cart.
    BuildingArt.register(
      'war_camp_siege',
      scaled((g, A) => {
        K.logPile(g, -15, 9, 1.05);
        K.beam(g, -3, 6, -3, -20, 1.8, C.woodD);
        K.beam(g, 9, 6, 9, -20, 1.8, C.woodD);
        K.beam(g, -3, -20, 9, -20, 1.8, C.woodDD);
        K.beam(g, -3, -11, 9, -11, 1.4, C.woodD);
        K.beam(g, -3, -2, 9, -2, 1.4, C.woodD);
        K.beam(g, -3, -2, 9, -11, 1.1, C.woodL);
        K.beam(g, -3, -11, 9, -20, 1.1, C.woodL);
        K.rect(g, -4.4, -24.6, 14.8, 4.6, C.hideD, 1.3);
        K.cart(g, 17, 11, 0.8);
        K.skull(g, 3, -22.6, 0.7);
        tent(g, -15, -6, 7.6, 10.6);
        fire(g, A, 3, 13);
      })
    );
  }

  // ------------------------------------------------------------------- save
  function exportState(ctx) {
    prune(ctx);
    return {
      camps: state.camps.map((c) => {
        const b = buildingOf(c, ctx);
        return {
          kind: c.kind,
          sector: c.sector,
          raisedWave: c.raisedWave,
          x: c.x,
          y: c.y,
          sabotaged: !!c.sabotaged,
          hp: b ? b.hp : 0,
          maxHp: b ? b.maxHp : 0,
        };
      }),
      active: state.active.map((a) => a.kind),
      runnersLeft: state.runnersLeft,
      runnerType: state.runnerType || null,
      reprisal: state.reprisal,
      razed: state.razed,
      raid:
        state.raid && !state.raid.resolved
          ? {
              campIndex: state.camps.findIndex((c) => c.id === state.raid.campId),
              // Ticks left; a raid waiting for nightfall keeps waiting.
              left: state.raid.at == null ? null : Math.max(1, state.raid.at - (ctx?.tick || 0)),
              from: state.raid.from,
            }
          : null,
    };
  }

  /** Rebuild the camps as buildings. Call after the saved buildings have been restored. */
  function importState(snap, ctx) {
    state = fresh();
    if (!snap || typeof snap !== 'object' || !ctx || !ctx.createCamp || !ensureDefs()) return;
    for (const s of Array.isArray(snap.camps) ? snap.camps.slice(0, MAX_CAMPS) : []) {
      if (!KINDS[s.kind] || !(s.hp > 0)) continue;
      BuildDefs[KINDS[s.kind].type] = campDef(s.kind, s.raisedWave);
      const b = ctx.createCamp(KINDS[s.kind].type, s.x, s.y);
      if (!b) continue;
      if (s.maxHp > 0) b.maxHp = s.maxHp;
      b.hp = Math.min(b.maxHp, s.hp);
      state.camps.push({
        id: b.id,
        kind: s.kind,
        sector: sectorId(s.sector) || sectorOfX(b.x, ctx.worldW),
        raisedWave: s.raisedWave || FROM_WAVE,
        x: b.x,
        y: b.y,
        sabotaged: !!s.sabotaged,
      });
    }
    for (const kind of Array.isArray(snap.active) ? snap.active : []) {
      if (KINDS[kind]) state.active.push({ kind, name: KINDS[kind].name, line: KINDS[kind].line });
    }
    state.runnersLeft = Math.max(0, Number(snap.runnersLeft) || 0);
    state.runnerType = snap.runnerType || null;
    state.reprisal = Math.max(0, Number(snap.reprisal) || 0);
    state.razed = Math.max(0, Number(snap.razed) || 0);
    if (snap.raid && state.camps[snap.raid.campIndex]) {
      const tick = ctx.tick || 0;
      state.raid = {
        campId: state.camps[snap.raid.campIndex].id,
        at: snap.raid.left == null ? null : tick + snap.raid.left,
        from: snap.raid.from === 'left' ? 'left' : 'right',
        ordered: tick,
        resolved: false,
      };
    }
  }

  // ------------------------------------------------------------------ panel
  /** What the Threat Map and the HUD show. */
  function getSnapshot(ctx) {
    prune(ctx);
    return {
      fromWave: FROM_WAVE,
      max: MAX_CAMPS,
      razed: state.razed,
      camps: state.camps.map((c) => {
        const b = buildingOf(c, ctx);
        return {
          kind: c.kind,
          name: KINDS[c.kind].name,
          line: KINDS[c.kind].line,
          sector: c.sector,
          x: c.x,
          y: c.y,
          hp: b ? Math.max(0, Math.round(b.hp)) : 0,
          maxHp: b ? Math.round(b.maxHp) : 0,
          guards: b ? guardCount(c, b) : 0,
          sabotaged: !!c.sabotaged,
          wavesLeft: Math.max(0, c.raisedWave + LIFE_WAVES - 1 - (ctx?.wave || 0)),
          bounty: bounty(c),
        };
      }),
      active: state.active.map((a) => ({ ...a })),
      raid: state.raid && !state.raid.resolved ? { waiting: state.raid.at == null } : null,
      reprisal: state.reprisal,
    };
  }

  registerArt();
  ensureDefs();

  return {
    FROM_WAVE,
    MAX_CAMPS,
    LIFE_WAVES,
    RAISE_CHANCE,
    CRATE_CHANCE,
    KINDS,
    SECTORS,
    resetRun,
    ensureDefs,
    isCamp,
    isCampType,
    kindOf,
    standing,
    campAt,
    planSectors,
    sectorOfX,
    canRaise,
    raiseCamp,
    onNightBegin,
    pendingBonuses,
    previewLine,
    onWaveStart,
    onEnemySpawn,
    onMoveOrder,
    update,
    onBlast,
    bounty,
    onDestroyed,
    canRaid,
    orderRaid,
    resolveRaid,
    sabotage,
    draw,
    exportState,
    importState,
    getSnapshot,
    activeBonuses: () => state.active.map((a) => ({ ...a })),
    pendingRaid: () => (state.raid && !state.raid.resolved ? { ...state.raid } : null),
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.WarCamps = WarCamps;
