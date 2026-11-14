/**
 * SapperKit — the Sapper's trade: buried mines, satchel charges and the blasts they make.
 *
 * The numbers live in the Sapper's roster profile (Roster.TROOPS.sapper.mines / .satchel),
 * so the text a player reads and the engine agree. This module owns everything else:
 *
 *   - MINES. Each night a Sapper buries charges in front of his post, towards the side the
 *     next host comes from. The player sees them as small inked studs; the enemy does not
 *     path around them. The first ground enemy to step on one sets it off. Mines last from
 *     wave to wave and are saved with the siege. Shift+click with a Sapper selected at night
 *     re-sites one of his mines.
 *   - SATCHEL CHARGES. By day he lobs a fused charge at the thickest knot of enemies in
 *     reach. It lands on the ground, so there is no hit roll: it is aimed where the knot
 *     will be when the fuse burns down.
 *   - BLASTS go through armour: they skip braced lines, tower shields, plate and flat
 *     resistance (opts.demolition in Roster.modifyDamageTaken). They never touch the
 *     player's soldiers or buildings, and they cannot reach flyers.
 *   - KNIFE. Up close he has a knife and little else, so he gives ground instead.
 *
 * Hooked from: Roster.update / Roster.drawOverlays, SiegeLoop.startRun / drawGround /
 * exportState / importState, and Game.fireWeapon / handleClick / shiftWorldEntities.
 */
const SapperKit = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const EMBER = '#ff8a30';

  /** Used when the roster profile is missing (a stripped-down test, a mod that removed it). */
  const FALLBACK = {
    mines: { perNight: 2, cap: 4, r: 46, dmg: 80, runner: 1.25 },
    satchel: { reach: 110, cd: 300, r: 40, dmg: 46 },
  };
  const TRIGGER_R = 15; // how close a boot must come to a buried mine
  const MINE_GAP = 40; // mines are never buried closer together than this
  const LAY_REACH = 190; // how far from his post a Sapper will bury a charge
  const FLIGHT = 22; // ticks a satchel spends in the air
  const FUSE = 34; // ticks it lies on the ground before it blows
  const FUSE_VET = 8; // ticks shaved off the fuse per veteran grade
  const CD_VET = 30; // ticks shaved off the reload per veteran grade
  const KNIFE_CD = 100; // ticks between knife jabs
  const STAGGER_MINE = 50;
  const STAGGER_SATCHEL = 30;
  const HEAVY_MULT = 1.5; // armour, shields and monsters
  const STRUCTURE_MULT = 2.5; // enemy structures, when a mode has them
  const KITE_TICKS = 40;
  const KITE_CD = 150;
  const MAX_MINES = 60;
  const VET_NIGHTS = [4, 9];
  const VET_KILLS = [8, 20];

  const HEAVY = {
    dark_knight: 1,
    troll: 1,
    war_chief: 1,
    orc_shieldbearer: 1,
    dreadborn_champion: 1,
    cinderbound_juggernaut: 1,
  };
  const ENGINES = { siege_tower: 1, iron_colossus: 1, hellmortar_pack: 1 };

  let state = fresh();
  let lastTick = 0;

  function fresh() {
    return { mines: [], satchels: [], blasts: [], scorches: [], laid: {}, nextId: 1 };
  }

  function reset() {
    state = fresh();
  }

  function cfg() {
    const p = typeof Roster !== 'undefined' && Roster.TROOPS ? Roster.TROOPS.sapper : null;
    return {
      mines: (p && p.mines) || FALLBACK.mines,
      satchel: (p && p.satchel) || FALLBACK.satchel,
    };
  }

  function isSapper(u) {
    return !!u && u.type === 'sapper' && u.team === 'player' && u.hp > 0;
  }

  /** 0, 1 or 2: nights survived or kills made. Each grade is one more mine and a quicker hand. */
  function gradeOf(unit) {
    if (!unit) return 0;
    const nights = unit.wavesSurvived || 0;
    const kills = unit.kills || 0;
    let g = 0;
    for (let i = 0; i < 2; i++) if (nights >= VET_NIGHTS[i] || kills >= VET_KILLS[i]) g = i + 1;
    return g;
  }

  function isGround(u) {
    return u.team === 'enemy' && u.hp > 0 && !u.flying;
  }

  function isBig(u) {
    return (
      u.isNamedBoss ||
      u.isPlanetBoss ||
      (typeof isMonsterEnemy === 'function' && isMonsterEnemy(u)) ||
      (typeof isEliteEnemy === 'function' && isEliteEnemy(u))
    );
  }

  function mustering(u) {
    return typeof SiegeLoop !== 'undefined' && SiegeLoop.isMustering(u);
  }

  function ownerOf(id, ctx) {
    if (id == null) return null;
    const units = ctx.units;
    for (let i = 0; i < units.length; i++) if (units[i].id === id) return units[i];
    return null;
  }

  // ------------------------------------------------------------------ blast
  /** Brief stagger. Bosses, monsters and elites shake most of it off; the unpinnable all of it. */
  function stagger(u, ticks) {
    if (u.hp <= 0) return;
    if (typeof Roster !== 'undefined' && Roster.blocksPin(u)) return;
    const t = isBig(u) ? Math.round(ticks / 3) : ticks;
    u.pinned = true;
    u.pinTimer = Math.max(u.pinTimer || 0, t);
  }

  /** How hard a blast of `dmg` lands on one enemy at `dist` from its centre. */
  function blastDamage(u, dmg, dist, radius, owner, runnerMult) {
    // Full force out to half the radius, easing to 60% at the rim.
    const k = dist <= radius * 0.5 ? 1 : 1 - ((dist - radius * 0.5) / (radius * 0.5)) * 0.4;
    let amt = dmg * k;
    if (ENGINES[u.type]) amt *= Math.max(1, (owner && owner.siegeMult) || 2);
    else if (HEAVY[u.type] || (typeof isMonsterEnemy === 'function' && isMonsterEnemy(u))) {
      amt *= HEAVY_MULT;
    }
    if (runnerMult > 1 && (u.lineBreaker || u.stormLine)) amt *= runnerMult;
    return amt;
  }

  /**
   * Set off a charge at (x, y). Hurts ground enemies only. Returns the number hurt.
   * `kind` is 'mine' or 'satchel'.
   */
  function blast(x, y, radius, dmg, owner, ctx, kind) {
    const live = owner && owner.hp > 0 ? owner : null;
    const runnerMult = kind === 'mine' ? cfg().mines.runner || 1 : 1;
    const units = ctx.units;
    const r2 = radius * radius;
    // Collect first: a death can call back into the unit list.
    const caught = [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!isGround(u)) continue;
      const dx = u.x - x;
      const dy = u.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) caught.push([u, Math.sqrt(d2)]);
    }
    for (const [u, dist] of caught) {
      if (u.hp <= 0) continue;
      ctx.hurt(u, blastDamage(u, dmg, dist, radius, live, runnerMult), live, true, {
        demolition: true,
      });
      stagger(u, kind === 'mine' ? STAGGER_MINE : STAGGER_SATCHEL);
    }
    const blds = ctx.buildings;
    if (blds && ctx.hurtBuilding) {
      for (let i = 0; i < blds.length; i++) {
        const b = blds[i];
        if (!b || b.owner !== 'enemy' || !(b.hp > 0)) continue;
        const reach = radius + (b.radius || 16);
        const dx = b.x - x;
        const dy = b.y - y;
        if (dx * dx + dy * dy <= reach * reach) ctx.hurtBuilding(b, dmg * STRUCTURE_MULT, live);
      }
    }
    state.blasts.push({ x, y, r: radius, age: 0, big: kind === 'mine' });
    state.scorches.push({ x, y, r: radius * 0.42, age: 0, tilt: (x * 7 + y * 3) % 3 });
    if (state.scorches.length > 28) state.scorches.shift();
    // Sound: `firebomb` stands in. Cues wanted: `mineBlast` (deep thump) and `satchelBlast`.
    ctx.playSfx('firebomb');
    ctx.shake(kind === 'mine' ? 5 : 3.5);
    ctx.burst('explosion', x, y);
    ctx.burst('dust', x, y);
    if (caught.length) ctx.float(x, y - 16, kind === 'mine' ? 'MINE!' : 'BLAST', '#ff8040');
    return caught.length;
  }

  // ------------------------------------------------------------------ mines
  function ownedMines(id) {
    let n = 0;
    for (const m of state.mines) if (m.o === id) n++;
    return n;
  }

  function spotFree(x, y, ctx, skip) {
    if (x < 30 || y < 30 || x > ctx.worldW - 30 || y > ctx.worldH - 70) return false;
    if (ctx.blocked && ctx.blocked(x, y)) return false;
    for (const m of state.mines) {
      if (m === skip) continue;
      const dx = m.x - x;
      const dy = m.y - y;
      if (dx * dx + dy * dy < MINE_GAP * MINE_GAP) return false;
    }
    return true;
  }

  function postOf(unit) {
    return Number.isFinite(unit.postX) && Number.isFinite(unit.postY)
      ? { x: unit.postX, y: unit.postY }
      : { x: unit.x, y: unit.y };
  }

  /** Unit vector from the line towards the side the next host comes from. */
  function frontOf(ctx) {
    const sides = ctx.nextSides;
    const side = sides && sides.length ? sides[0] : 'north';
    if (side === 'south') return { x: 0, y: 1 };
    if (side === 'west') return { x: -1, y: 0 };
    if (side === 'east') return { x: 1, y: 0 };
    return { x: 0, y: -1 };
  }

  // Forward and sideways offsets from the post, in the order a Sapper tries them: a pair
  // ahead, one further out, then the shoulders. Together they make a short belt.
  const LAY_PATTERN = [
    [92, -32],
    [92, 32],
    [138, 0],
    [62, -74],
    [62, 74],
    [138, -62],
    [138, 62],
    [176, -30],
    [176, 30],
    [46, 0],
  ];

  function addMine(x, y, owner, ctx) {
    const m = { id: state.nextId++, x, y, o: owner.id, w: ctx.wave, placed: false };
    state.mines.push(m);
    if (state.mines.length > MAX_MINES) state.mines.shift();
    return m;
  }

  /** One Sapper buries his night's charges. Returns how many went in. */
  function layFor(unit, ctx) {
    const c = cfg().mines;
    const g = gradeOf(unit);
    const cap = c.cap + g;
    let want = Math.min(c.perNight + g, cap - ownedMines(unit.id));
    if (want <= 0) return 0;
    const post = postOf(unit);
    const f = frontOf(ctx);
    const side = { x: -f.y, y: f.x };
    let laid = 0;
    for (let i = 0; i < LAY_PATTERN.length && want > 0; i++) {
      const [fw, lat] = LAY_PATTERN[i];
      const x = post.x + f.x * fw + side.x * lat;
      const y = post.y + f.y * fw + side.y * lat;
      if (!spotFree(x, y, ctx)) continue;
      addMine(x, y, unit, ctx);
      ctx.burst('dust', x, y);
      laid++;
      want--;
    }
    if (laid > 0) {
      ctx.float(unit.x, unit.y - 18, laid === 1 ? 'MINE LAID' : `${laid} MINES LAID`, BONE);
    }
    return laid;
  }

  /** Night work: every Sapper who has not yet laid for this night does so (new arrivals too). */
  function layForNight(ctx) {
    if (!ctx.isNight) return 0;
    let total = 0;
    const units = ctx.units;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!isSapper(u) || u.fleeing || u.demoralized) continue;
      if (state.laid[u.id] === ctx.wave) continue;
      state.laid[u.id] = ctx.wave;
      total += layFor(u, ctx);
    }
    if (total > 0) ctx.playSfx('crateOpen');
    return total;
  }

  /**
   * Shift+click at night with Sappers selected: the nearest one in reach re-sites a mine to
   * the clicked spot (one he has not placed by hand yet, else his oldest). Returns true when
   * the click was a mine order, so the caller does not also treat it as a move order.
   */
  function orderMine(ids, x, y, ctx) {
    if (!ctx.isNight || !ids || !ids.length) return false;
    let best = null;
    let bestD = Infinity;
    let any = false;
    for (const id of ids) {
      const u = ownerOf(id, ctx);
      if (!isSapper(u)) continue;
      any = true;
      if (!ownedMines(u.id)) continue;
      const p = postOf(u);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= LAY_REACH && d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (!any) return false;
    if (!best) {
      ctx.showMessage(`Too far — a Sapper buries charges within ${LAY_REACH} of his post.`, 180);
      return true;
    }
    const mine = state.mines.filter((m) => m.o === best.id);
    const pick = mine.find((m) => !m.placed) || mine[0];
    if (!spotFree(x, y, ctx, pick)) {
      ctx.showMessage('No room for a charge there.', 140);
      return true;
    }
    pick.x = x;
    pick.y = y;
    pick.placed = true;
    // Hand-placed mines go to the back of the queue, so repeated orders cycle through them.
    state.mines.splice(state.mines.indexOf(pick), 1);
    state.mines.push(pick);
    ctx.burst('dust', x, y);
    ctx.playSfx('crateOpen');
    ctx.float(x, y - 12, 'MINE', BONE);
    return true;
  }

  function updateMines(ctx) {
    if (!state.mines.length) return;
    const units = ctx.units;
    const t2 = TRIGGER_R * TRIGGER_R;
    for (let mi = state.mines.length - 1; mi >= 0; mi--) {
      const m = state.mines[mi];
      let tripped = false;
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (!isGround(u)) continue;
        const dx = u.x - m.x;
        const dy = u.y - m.y;
        if (dx * dx + dy * dy <= t2) {
          tripped = true;
          break;
        }
      }
      if (!tripped) continue;
      state.mines.splice(mi, 1);
      const c = cfg().mines;
      blast(m.x, m.y, c.r, c.dmg, ownerOf(m.o, ctx), ctx, 'mine');
    }
  }

  // ---------------------------------------------------------------- satchel
  /** Where the thickest knot in reach will be when the fuse burns down, or null. */
  function pickCluster(unit, ctx, lead) {
    const c = cfg().satchel;
    const units = ctx.units;
    const reach2 = (c.reach + 8) * (c.reach + 8);
    const near = [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!isGround(u) || mustering(u)) continue;
      const dx = u.x - unit.x;
      const dy = u.y - unit.y;
      // Anything within a blast radius of the reach can still be caught by a charge.
      if (dx * dx + dy * dy <= (c.reach + c.r) * (c.reach + c.r)) near.push(u);
    }
    let best = null;
    let bestScore = 0;
    for (const a of near) {
      const ax = a.x - unit.x;
      const ay = a.y - unit.y;
      if (ax * ax + ay * ay > reach2) continue;
      let score = 0;
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const b of near) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy > c.r * c.r * 0.7) continue;
        score += 1 + (HEAVY[b.type] || ENGINES[b.type] ? 0.6 : 0) + (b.lineBreaker ? 0.5 : 0);
        sx += b.x + (b.skVx || 0) * lead;
        sy += b.y + (b.skVy || 0) * lead;
        n++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x: sx / n, y: sy / n, n };
      }
    }
    if (!best) return null;
    // He cannot throw further than his reach, however far the knot will have run.
    const dx = best.x - unit.x;
    const dy = best.y - unit.y;
    const d = Math.hypot(dx, dy);
    if (d > c.reach) {
      best.x = unit.x + (dx / d) * c.reach;
      best.y = unit.y + (dy / d) * c.reach;
    }
    return best;
  }

  function cooldownOf(unit) {
    return Math.max(120, cfg().satchel.cd - gradeOf(unit) * CD_VET);
  }

  function fuseOf(unit) {
    return Math.max(12, FUSE - gradeOf(unit) * FUSE_VET);
  }

  /**
   * Called from Game.fireWeapon. Returns true when the Sapper's attack was handled here
   * (a charge thrown, or nothing to do yet); false lets the engine make a knife jab.
   */
  function fire(unit, target, ctx) {
    if (!unit || unit.type !== 'sapper' || unit.team !== 'player') return false;
    const tick = ctx.tick;
    const dist = target ? Math.hypot(target.x - unit.x, target.y - unit.y) : Infinity;
    if (dist <= (unit.meleeRange || 22) + 2) {
      if (tick < (unit.knifeReadyAt || 0)) return true;
      unit.knifeReadyAt = tick + KNIFE_CD;
      return false;
    }
    if (tick < (unit.satchelReadyAt || 0)) return true;
    const fuse = fuseOf(unit);
    const aim = pickCluster(unit, ctx, FLIGHT + fuse);
    if (!aim) return true;
    unit.satchelReadyAt = tick + cooldownOf(unit);
    unit.rotation = Math.round((Math.atan2(aim.y - unit.y, aim.x - unit.x) * 180) / Math.PI);
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    state.satchels.push({
      x0: unit.x,
      y0: unit.y - 6,
      x: aim.x,
      y: aim.y,
      t0: tick,
      land: tick + FLIGHT,
      blow: tick + FLIGHT + fuse,
      o: unit.id,
    });
    // Sound: `whoosh` stands in for the throw. Cue wanted: `fuseHiss` while it lies burning.
    ctx.playSfx('whoosh');
    return true;
  }

  function updateSatchels(ctx) {
    if (!state.satchels.length) return;
    const tick = ctx.tick;
    for (let i = state.satchels.length - 1; i >= 0; i--) {
      const s = state.satchels[i];
      if (!s.landed && tick >= s.land) {
        s.landed = true;
        ctx.burst('dust', s.x, s.y);
      }
      if (tick < s.blow) continue;
      state.satchels.splice(i, 1);
      const c = cfg().satchel;
      blast(s.x, s.y, c.r, c.dmg, ownerOf(s.o, ctx), ctx, 'satchel');
    }
  }

  // ------------------------------------------------------------------- kite
  function freeToMove(u) {
    return !(
      u.fleeing ||
      u.demoralized ||
      u.pinned ||
      u.garrisoned ||
      u.stationedKeep ||
      u.wallGarrisoned ||
      u.retreatingToMed ||
      u.atMedicalTent ||
      u.manualOrder ||
      u.attackAnimTimer > 0
    );
  }

  function kiteStep(u, ctx) {
    const sp = u.speed || 0.9;
    const tries = [0, 0.9, -0.9, 1.6, -1.6];
    for (const turn of tries) {
      const cs = Math.cos(turn);
      const sn = Math.sin(turn);
      const dx = u.kiteDx * cs - u.kiteDy * sn;
      const dy = u.kiteDx * sn + u.kiteDy * cs;
      const nx = u.x + dx * sp;
      const ny = u.y + dy * sp;
      if (nx < 24 || ny < 24 || nx > ctx.worldW - 24 || ny > ctx.worldH - 72) continue;
      if (ctx.blocked && ctx.blocked(nx, ny, u)) continue;
      u.x = nx;
      u.y = ny;
      u.rotation = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      u.animState = 'walk';
      u.path = [];
      u.pathIndex = 0;
      return true;
    }
    return false;
  }

  /** A Sapper with an enemy in knife range backs off instead of brawling. */
  function updateKite(u, ctx) {
    if (!freeToMove(u)) {
      u.kiteMove = 0;
      if (u.manualOrder) u.kiteAway = false;
      return;
    }
    if ((u.kiteMove || 0) > 0) {
      u.kiteMove--;
      if (!kiteStep(u, ctx)) u.kiteMove = 0;
      return;
    }
    u.kiteCd = (u.kiteCd || 0) - 1;
    if (u.kiteAway && !u.canHunt && u.kiteCd < KITE_CD - KITE_TICKS - 30) returnToPost(u, ctx);
    if (u.kiteCd > 0) return;
    const kiteD = typeof Roster !== 'undefined' ? Roster.kiteDistance(u) : 50;
    if (!(kiteD > 0)) return;
    let foe = null;
    let best = kiteD * kiteD;
    const units = ctx.units;
    for (let i = 0; i < units.length; i++) {
      const e = units[i];
      if (!isGround(e)) continue;
      const dx = e.x - u.x;
      const dy = e.y - u.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        foe = e;
      }
    }
    if (!foe) {
      u.kiteCd = 6;
      return;
    }
    const d = Math.max(1, Math.sqrt(best));
    u.kiteDx = (u.x - foe.x) / d;
    u.kiteDy = (u.y - foe.y) / d;
    u.kiteMove = KITE_TICKS;
    u.kiteCd = KITE_CD;
    u.kiteAway = true;
  }

  /**
   * The engine walks a hunting soldier back to his post. For one who cannot hunt (a mod, an
   * era rule) nothing does, so once nothing is close he goes back a step at a time.
   */
  function returnToPost(u, ctx) {
    const post = postOf(u);
    const dx = post.x - u.x;
    const dy = post.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 3 || u.path?.length) {
      u.kiteAway = false;
      return;
    }
    const safe = ((typeof Roster !== 'undefined' ? Roster.kiteDistance(u) : 50) + 30) ** 2;
    const units = ctx.units;
    for (let i = 0; i < units.length; i++) {
      const e = units[i];
      if (!isGround(e)) continue;
      if ((e.x - u.x) ** 2 + (e.y - u.y) ** 2 < safe) return;
    }
    u.kiteDx = dx / d;
    u.kiteDy = dy / d;
    if (!kiteStep(u, ctx)) u.kiteAway = false;
  }

  // ----------------------------------------------------------------- update
  function update(ctx) {
    // The engine still ticks this hook while paused; fuses must not burn then.
    if (ctx.paused) return;
    const tick = ctx.tick;
    lastTick = tick;
    for (let i = state.blasts.length - 1; i >= 0; i--) {
      if (++state.blasts[i].age > 30) state.blasts.splice(i, 1);
    }
    if (tick % 6 === 0) {
      for (let i = state.scorches.length - 1; i >= 0; i--) {
        state.scorches[i].age += 6;
        if (state.scorches[i].age > 60 * 50) state.scorches.splice(i, 1);
      }
    }
    if (ctx.isNight && tick % 4 === 0) layForNight(ctx);
    if (tick % 2 === 0) updateMines(ctx);
    updateSatchels(ctx);
    if (ctx.isNight) return;
    const units = ctx.units;
    let sappers = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!isSapper(u)) continue;
      sappers++;
      updateKite(u, ctx);
    }
    // Track how enemies are moving, so a charge can be thrown where they will be.
    if (sappers > 0 && tick % 6 === 0) {
      for (let i = 0; i < units.length; i++) {
        const e = units[i];
        if (e.team !== 'enemy' || e.hp <= 0) continue;
        if (e.skT === tick - 6) {
          e.skVx = (e.x - e.skX) / 6;
          e.skVy = (e.y - e.skY) / 6;
        } else {
          e.skVx = 0;
          e.skVy = 0;
        }
        e.skX = e.x;
        e.skY = e.y;
        e.skT = tick;
      }
    }
  }

  /** The map grew: everything on the ground moves with it. */
  function shift(dx, dy) {
    for (const list of [state.mines, state.satchels, state.blasts, state.scorches]) {
      for (const o of list) {
        o.x += dx;
        o.y += dy;
        if (o.x0 != null) {
          o.x0 += dx;
          o.y0 += dy;
        }
      }
    }
  }

  // ------------------------------------------------------------ save and load
  function exportState() {
    return {
      mines: state.mines.map((m) => ({ x: m.x, y: m.y, o: m.o, w: m.w, placed: !!m.placed })),
      laid: { ...state.laid },
    };
  }

  function importState(snap) {
    state = fresh();
    if (!snap) return;
    if (Array.isArray(snap.mines)) {
      for (const m of snap.mines) {
        if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
        state.mines.push({
          id: state.nextId++,
          x: m.x,
          y: m.y,
          o: m.o ?? null,
          w: m.w || 0,
          placed: !!m.placed,
        });
      }
    }
    if (snap.laid && typeof snap.laid === 'object') state.laid = { ...snap.laid };
  }

  // ------------------------------------------------------------------- draw
  function drawMine(c, m, tick, mine) {
    c.fillStyle = INK;
    c.beginPath();
    c.arc(m.x, m.y, 5.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = BONE;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(m.x, m.y, 4, 0, Math.PI * 2);
    c.stroke();
    // Four studs and a red pin: reads as a pressure plate at any zoom.
    c.fillStyle = BONE;
    c.fillRect(m.x - 0.75, m.y - 7.5, 1.5, 3);
    c.fillRect(m.x - 0.75, m.y + 4.5, 1.5, 3);
    c.fillRect(m.x - 7.5, m.y - 0.75, 3, 1.5);
    c.fillRect(m.x + 4.5, m.y - 0.75, 3, 1.5);
    c.fillStyle = BLOOD;
    c.fillRect(m.x - 1.25, m.y - 1.25, 2.5, 2.5);
    if (mine) {
      c.strokeStyle = `rgba(228,220,196,${0.3 + Math.sin(tick / 16 + m.id) * 0.08})`;
      c.lineWidth = 1;
      c.setLineDash([4, 5]);
      c.beginPath();
      c.arc(m.x, m.y, cfg().mines.r, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
  }

  /** Scorch marks and buried mines, under the soldiers. `selected` is a list of unit ids. */
  function drawGround(c, selected) {
    if (!state.mines.length && !state.scorches.length) return;
    const tick = lastTick;
    c.save();
    for (const s of state.scorches) {
      const fade = Math.max(0, 1 - s.age / (60 * 50));
      c.globalAlpha = 0.6 * fade;
      c.fillStyle = '#141012';
      c.beginPath();
      c.ellipse(s.x, s.y, s.r * 1.5, s.r * 0.8, s.tilt, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 0.8 * fade;
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(s.x - 1, s.y - 1, s.r * 0.8, s.r * 0.42, s.tilt * 2, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    const sel = selected && selected.length ? selected : null;
    for (const m of state.mines) drawMine(c, m, tick, !!sel && sel.includes(m.o));
    c.restore();
  }

  function drawSatchel(c, s, tick) {
    const c2 = cfg().satchel;
    let x = s.x;
    let y = s.y;
    let lift = 0;
    if (tick < s.land) {
      const k = Math.max(0, Math.min(1, (tick - s.t0) / (s.land - s.t0)));
      x = s.x0 + (s.x - s.x0) * k;
      y = s.y0 + (s.y - s.y0) * k;
      lift = Math.sin(k * Math.PI) * 30;
      // Shadow on the ground under the arc.
      c.fillStyle = 'rgba(7,5,10,0.35)';
      c.beginPath();
      c.ellipse(x, y + 3, 4, 1.8, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      // The fuse is burning: show the ground it is about to clear.
      const k = (tick - s.land) / Math.max(1, s.blow - s.land);
      c.strokeStyle = `rgba(255,138,48,${0.35 + k * 0.45})`;
      c.lineWidth = 1.5;
      c.setLineDash([5, 4]);
      c.beginPath();
      c.arc(s.x, s.y, c2.r, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    const py = y - lift;
    c.fillStyle = INK;
    c.fillRect(x - 6.5, py - 5.5, 13, 11);
    c.fillStyle = '#8a6638';
    c.fillRect(x - 5, py - 4, 10, 8);
    c.fillStyle = BONE;
    c.fillRect(x - 5, py - 0.75, 10, 1.5);
    c.fillRect(x - 0.75, py - 4, 1.5, 8);
    // Fuse and spark.
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + 3, py - 3);
    c.lineTo(x + 6, py - 7);
    c.stroke();
    const flick = (tick + s.t0) % 4 < 2;
    c.fillStyle = flick ? '#fff2b0' : EMBER;
    c.beginPath();
    c.arc(x + 6, py - 7, flick ? 3.4 : 2.4, 0, Math.PI * 2);
    c.fill();
    if (flick) {
      c.strokeStyle = EMBER;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 6, py - 11);
      c.lineTo(x + 6, py - 13);
      c.moveTo(x + 10, py - 7);
      c.lineTo(x + 12, py - 7);
      c.moveTo(x + 9, py - 10);
      c.lineTo(x + 10.5, py - 11.5);
      c.stroke();
    }
  }

  function drawBlast(c, b) {
    const k = b.age / 30;
    const r = b.r * (0.25 + 0.75 * Math.min(1, k * 2.2));
    if (k < 0.45) {
      const a = 1 - k / 0.45;
      c.fillStyle = `rgba(255,236,170,${0.85 * a})`;
      c.beginPath();
      c.arc(b.x, b.y, r * 0.55, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(255,138,48,${0.6 * a})`;
      c.beginPath();
      c.arc(b.x, b.y, r * 0.85, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = `rgba(7,5,10,${0.9 * (1 - k)})`;
    c.lineWidth = (b.big ? 5 : 4) * (1 - k) + 1;
    c.beginPath();
    c.arc(b.x, b.y, r, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = `rgba(255,138,48,${0.9 * (1 - k)})`;
    c.lineWidth = 2 * (1 - k) + 0.5;
    c.beginPath();
    c.arc(b.x, b.y, r * 0.86, 0, Math.PI * 2);
    c.stroke();
    // Clods of earth thrown outward.
    c.strokeStyle = `rgba(7,5,10,${1 - k})`;
    c.lineWidth = 2;
    const n = b.big ? 10 : 7;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + b.x;
      const r0 = r * (0.5 + k * 0.5);
      const r1 = r0 + 7 + (i % 3) * 3;
      c.moveTo(b.x + Math.cos(ang) * r0, b.y + Math.sin(ang) * r0 * 0.8 - k * 6);
      c.lineTo(b.x + Math.cos(ang) * r1, b.y + Math.sin(ang) * r1 * 0.8 - k * 10);
    }
    c.stroke();
  }

  /** Charges in the air or burning, and blasts, over the soldiers. */
  function drawOver(c, tick) {
    if (!state.satchels.length && !state.blasts.length) return;
    c.save();
    for (const s of state.satchels) drawSatchel(c, s, tick);
    for (const b of state.blasts) drawBlast(c, b);
    c.restore();
  }

  return {
    reset,
    update,
    fire,
    blast,
    layFor,
    layForNight,
    orderMine,
    gradeOf,
    cooldownOf,
    fuseOf,
    shift,
    exportState,
    importState,
    drawGround,
    drawOver,
    getMines: () => state.mines,
    getSatchels: () => state.satchels,
    getBlasts: () => state.blasts,
    getScorches: () => state.scorches,
    TRIGGER_R,
    LAY_REACH,
    FLIGHT,
    FUSE,
    KNIFE_CD,
    HEAVY_MULT,
  };
})();

// Published for GameServices.registerFromGlobals(), like the other modules.
globalThis.SapperKit = SapperKit;
