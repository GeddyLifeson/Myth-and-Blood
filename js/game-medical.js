/**
 * Medical tents and wounded retreats.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameMedical = (() => {
  const {
    getMedicalTentSlot,
    isMedicalTentBuilding,
    isPlayerMarchingOrder,
    needsMedicalRetreat,
    posDistSq,
    svc,
  } = GameCore;
  const GS = GameState;
  const { clampPos } = GameField;
  const { POST_IDLE_TICKS, applyGlobalHuntState, stopPostReturn } = GameStance;
  const { findNearestFoeInRange } = GameCombat;
  const { followPath, isTerrainBlockedForPath, nudgeUnitFree, steerToward } = GameMovement;
  const {
    hasPendingOutpostGarrison,
    isMarchingToKeep,
    isMarchingToWallSlot,
    releaseFromGarrison,
    releaseFromKeep,
    releaseFromWallGarrison,
  } = GameGarrison;
  let isNightPhase;
  function bind(api) {
    ({ isNightPhase } = api);
  }

  // ---------------------------------------------------------------- med tent rule
  // With a finished med tent on the field, a wounded soldier goes to it before anything
  // else. These are the owner's knobs.
  /** Out of a fight, he goes at any missing health (1 = anything below full). */
  const MED_SEEK_HP_RATIO = 1;
  /** In an active exchange he fights on while above this share of health, then breaks off. */
  const MED_FIGHT_BREAK_RATIO = 0.5;
  /** An enemy targeting him inside this distance counts as an active exchange (px). */
  const MED_THREAT_DIST = 60;
  /** Soldiers one tent treats at a time; the rest queue outside. */
  const MED_TENT_CAPACITY = 4;
  /** The walk to the tent bends round enemies closer than this to the straight route. */
  const MED_AVOID_DIST = 70;
  const MED_QUEUE_RING = 30;

  function medTentOccupants(tent, except = null) {
    let n = 0;
    for (const u of GS.units) {
      if (u !== except && u.hp > 0 && u.team === 'player' && u.atMedicalTent === tent.id) n++;
    }
    return n;
  }

  function medTentHasRoom(tent, unit) {
    return medTentOccupants(tent, unit) < MED_TENT_CAPACITY;
  }

  /**
   * The tent a wounded soldier should use: the nearest with a free bed, else the nearest
   * at all (he queues outside it). A soldier already queueing stays with his tent unless
   * another one has a bed, so he does not walk back and forth between two full tents.
   */
  function findNearestMedicalTent(unit) {
    let best = null,
      bestD2 = Infinity,
      roomy = null,
      roomyD2 = Infinity,
      current = null;
    for (const b of GS.buildings) {
      if (!isMedicalTentBuilding(b)) continue;
      const d2 = posDistSq(b.x, b.y, unit.x, unit.y);
      if (b.id === unit.retreatingToMed) current = b;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = b;
      }
      if (d2 < roomyD2 && medTentHasRoom(b, unit)) {
        roomyD2 = d2;
        roomy = b;
      }
    }
    if (roomy) return roomy;
    return current || best;
  }

  /** Where the n-th patient lies, so four soldiers are not drawn on one spot. */
  function medBedPos(tent, idx) {
    const slot = getMedicalTentSlot(tent);
    const col = idx % 2 ? 1 : -1;
    const row = Math.floor(idx / 2);
    return idx <= 0 ? slot : { x: slot.x + col * 9 * (row || 1), y: slot.y + row * 7 };
  }

  /** Where the n-th waiting soldier stands: an arc on the home side of the tent. */
  function medQueuePos(tent, idx) {
    const r = (tent.radius || 24) + MED_QUEUE_RING + Math.floor(idx / 5) * 16;
    const a = Math.PI * (0.2 + 0.15 * (idx % 5));
    return clampPos(tent.x + Math.cos(a) * r, tent.y + Math.sin(a) * r);
  }

  /** Lowest bed (queued = false) or queue place (queued = true) nobody else has. */
  function freeMedIndex(tent, unit, queued) {
    const used = new Set();
    for (const u of GS.units) {
      if (u === unit || u.hp <= 0 || u.team !== 'player') continue;
      if (queued) {
        if (u.medQueued && u.retreatingToMed === tent.id) used.add(u.medQueueIdx);
      } else if (u.atMedicalTent === tent.id) used.add(u.medBedIdx);
    }
    let i = 0;
    while (used.has(i)) i++;
    return i;
  }

  /** In a fight right now: an enemy inside his weapon range, or one close and after him. */
  function inActiveExchange(unit) {
    if (findNearestFoeInRange(unit)) return true;
    const r2 = MED_THREAT_DIST * MED_THREAT_DIST;
    for (const foe of GS.units) {
      if (foe.team === unit.team || foe.hp <= 0 || foe.fleeing) continue;
      if (foe.combatTargetId !== unit.id && foe.pathTargetId !== unit.id) continue;
      if (posDistSq(foe.x, foe.y, unit.x, unit.y) <= r2) return true;
    }
    return false;
  }

  /**
   * The med tent rule: should this soldier leave for the tent now? Only asked when a
   * finished tent stands. The General, the Doomslayer, temporary troops, soldiers under
   * cover (outpost, wall, keep), routing or broken men and soldiers still marching on a
   * move order are left to their own rules.
   */
  function wantsMedTent(unit) {
    if (unit.team !== 'player' || unit.hp <= 0) return false;
    if (unit.retreatingToMed || unit.atMedicalTent || unit.healerFleeing) return false;
    if (unit.isGeneral || unit.isDoomslayer || unit.temporary || unit.summoned) return false;
    if (unit.combatType === 'courier') return false;
    if (unit.fleeing || unit.demoralized) return false;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep || unit.siegeDeployed)
      return false;
    if (hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit))
      return false;
    if (unit.raidTargetId || unit.raidMissionId) return false;
    const ratio = unit.hp / unit.maxHp;
    if (ratio >= MED_SEEK_HP_RATIO || unit.maxHp - unit.hp < 0.5) return false;
    // Wounded means he has lost health. A maximum that grew (field tenure, promotion)
    // leaves a gap too, and that alone does not send the whole army to the tent.
    if (!unit.medHurt) return false;
    // A move order is finished first.
    if (unit.manualOrder && isPlayerMarchingOrder(unit)) return false;
    if (ratio > MED_FIGHT_BREAK_RATIO && inActiveExchange(unit)) return false;
    return true;
  }

  /** Back to duty after the tent (healed, tent lost, no tent left): hunt or hold as before. */
  function endMedicalRetreat(unit) {
    // Step out of the tent first: a bed lies inside its walls.
    if (unit.atMedicalTent) nudgeUnitFree(unit);
    unit.retreatingToMed = null;
    unit.atMedicalTent = null;
    unit.medQueued = false;
    unit.medQueueIdx = null;
    unit.medBedIdx = null;
    unit.healerFleeing = false;
    if (unit.pathTargetId?.startsWith?.('med:')) {
      unit.pathTargetId = null;
      unit.path = [];
      unit.pathIndex = 0;
    }
    if (unit.canHunt) {
      applyGlobalHuntState(unit);
      // Walk home now, not after the usual two idle seconds.
      if (!unit.holding) unit.postIdle = POST_IDLE_TICKS;
    }
  }

  function isBeingTargeted(unit) {
    if (!unit || unit.hp <= 0) return false;
    for (const foe of GS.units) {
      if (foe.team === unit.team || foe.hp <= 0 || foe.fleeing) continue;
      if (foe.combatTargetId === unit.id || foe.pathTargetId === unit.id) return true;
    }
    for (const p of GS.projectiles) {
      if (p.targetId === unit.id) return true;
    }
    return false;
  }

  /** Closest a route passes to any enemy that is not already on top of the walker. */
  function routeClearance(unit, path, foes) {
    let min = Infinity;
    let px = unit.x;
    let py = unit.y;
    for (const wp of path) {
      for (const f of foes) {
        // distance from the foe to the segment (px,py)-(wp)
        const dx = wp.x - px;
        const dy = wp.y - py;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((f.x - px) * dx + (f.y - py) * dy) / len2));
        const d = Math.hypot(f.x - (px + dx * t), f.y - (py + dy * t));
        if (d < min) min = d;
      }
      px = wp.x;
      py = wp.y;
    }
    return min;
  }

  /**
   * Route to the tent. If the plain route brushes past an enemy, try going round on
   * either side and take whichever keeps furthest from them.
   */
  function planMedPath(unit, slot) {
    const pf = svc('Pathfinding');
    const leg = (ax, ay, bx, by) =>
      pf.findPath(ax, ay, bx, by, unit, isTerrainBlockedForPath, { maxNodes: 2400 }) || [];
    const direct = leg(unit.x, unit.y, slot.x, slot.y);
    const foes = [];
    for (const f of GS.units) {
      if (f.team === unit.team || f.hp <= 0 || f.fleeing) continue;
      if (f.team === 'neutral' || f.isNeutral) continue;
      // An enemy already on top of him cannot be walked round.
      if (posDistSq(f.x, f.y, unit.x, unit.y) < MED_AVOID_DIST * MED_AVOID_DIST) continue;
      foes.push(f);
    }
    if (!direct.length || !foes.length) return direct;
    let best = direct;
    let bestClear = routeClearance(unit, direct, foes);
    if (bestClear >= MED_AVOID_DIST) return direct;
    const dx = slot.x - unit.x;
    const dy = slot.y - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len < MED_AVOID_DIST * 1.5) return direct;
    for (const side of [1, -1]) {
      const via = clampPos(
        unit.x + dx * 0.5 + (-dy / len) * side * MED_AVOID_DIST * 1.8,
        unit.y + dy * 0.5 + (dx / len) * side * MED_AVOID_DIST * 1.8
      );
      if (isTerrainBlockedForPath(via.x, via.y, unit)) continue;
      const a = leg(unit.x, unit.y, via.x, via.y);
      const b = a.length ? leg(via.x, via.y, slot.x, slot.y) : [];
      if (!a.length || !b.length) continue;
      const route = a.concat(b);
      const clear = routeClearance(unit, route, foes);
      if (clear > bestClear + 8) {
        bestClear = clear;
        best = route;
      }
    }
    return best;
  }

  function setMedRetreatPath(unit, tent) {
    const slot = getMedicalTentSlot(tent);
    unit.pathTargetId = `med:${tent.id}`;
    unit.structureTargetId = null;
    unit.combatTargetId = null;
    unit.targetX = slot.x;
    unit.targetY = slot.y;
    if (svc('Perf')) svc('Perf').begin('path');
    unit.path = planMedPath(unit, slot);
    if (svc('Perf')) svc('Perf').end('path');
    unit.pathIndex = 0;
    if (!unit.path?.length) unit.path = [{ x: slot.x, y: slot.y }];
    unit.pathRecalc = 28;
    unit.pathStuck = 0;
    unit.stillFrames = 0;
  }

  function beginMedicalRetreat(unit, tent, opts = {}) {
    releaseFromWallGarrison(unit);
    releaseFromGarrison(unit);
    if (unit.stationedKeep) releaseFromKeep(unit);
    unit.retreatingToMed = tent.id;
    unit.atMedicalTent = null;
    unit.medQueued = false;
    unit.medQueueIdx = null;
    unit.medBedIdx = null;
    stopPostReturn(unit);
    unit.fightToDeath = false;
    unit.fleeing = false;
    unit.fledBattle = false;
    unit.demoralized = false;
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.healerFleeing = !!opts.healerFleeing;
    unit.healTargetId = null;
    unit.pinned = false;
    unit.pinTimer = 0;
    setMedRetreatPath(unit, tent);
    if (!opts.silent) {
      svc('FloatingText').status(
        unit.x,
        unit.y,
        opts.healerFleeing ? 'HEALER FLEE' : 'RETREAT',
        '#60c0ff'
      );
    }
  }

  /** Healers break for the nearest med tent on any damage; hold until foes stop targeting them. */
  function tryHealerMedicalRetreat(unit, opts = {}) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0 || unit.combatType !== 'healer')
      return false;
    if (unit.atMedicalTent && !isBeingTargeted(unit)) return false;
    const tent = findNearestMedicalTent(unit);
    if (!tent) return false;
    unit.fightToDeath = false;
    if (unit.retreatingToMed !== tent.id || !unit.path?.length) {
      beginMedicalRetreat(unit, tent, { ...opts, healerFleeing: true });
    } else {
      unit.healerFleeing = true;
      unit.combatTargetId = null;
      unit.structureTargetId = null;
      unit.healTargetId = null;
      unit.fleeing = false;
      unit.demoralized = false;
      unit.pinned = false;
      unit.pinTimer = 0;
    }
    return true;
  }

  /** Route wounded allies (≤25% HP) to the nearest med tent — on damage and as a per-tick safety net. */
  function tryMedicalRetreat(unit, opts = {}) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0 || unit.isDoomslayer) return false;
    if (unit.atMedicalTent) return false;
    if (unit.healerFleeing) return false;
    if (unit.hp / unit.maxHp > RETREAT_HP_RATIO) return false;
    const tent = findNearestMedicalTent(unit);
    if (!tent) {
      unit.fightToDeath = true;
      return false;
    }
    unit.fightToDeath = false;
    if (unit.retreatingToMed !== tent.id || !unit.path?.length) {
      beginMedicalRetreat(unit, tent, opts);
    } else {
      unit.combatTargetId = null;
      unit.structureTargetId = null;
      unit.fleeing = false;
      unit.demoralized = false;
      unit.pinned = false;
      unit.pinTimer = 0;
    }
    return true;
  }

  function resolveMedicalRetreatTent(unit) {
    const tent = findNearestMedicalTent(unit);
    if (!tent) return null;
    if (unit.retreatingToMed !== tent.id) {
      unit.retreatingToMed = tent.id;
      unit.medQueued = false;
      unit.medQueueIdx = null;
      setMedRetreatPath(unit, tent);
    }
    return tent;
  }

  function marchToMedicalTent(unit, tent) {
    const slot = getMedicalTentSlot(tent);
    const dist2 = posDistSq(unit.x, unit.y, slot.x, slot.y);
    const room = medTentHasRoom(tent, unit);
    const queueR = (tent.radius || 24) + MED_QUEUE_RING + 14;
    if (room && (dist2 <= 100 || (unit.medQueued && dist2 <= queueR * queueR * 1.6))) {
      // A bed is free: in he goes.
      unit.medBedIdx = freeMedIndex(tent, unit, false);
      const bed = medBedPos(tent, unit.medBedIdx);
      unit.x = bed.x;
      unit.y = bed.y;
      unit.path = [];
      unit.pathIndex = 0;
      unit.targetX = bed.x;
      unit.targetY = bed.y;
      unit.atMedicalTent = tent.id;
      unit.medQueued = false;
      unit.medQueueIdx = null;
      unit.animState = 'idle';
      return true;
    }
    if (!room && (unit.medQueued || dist2 <= queueR * queueR)) {
      // Tent full: wait outside, in line, and do not wander.
      if (!unit.medQueued) {
        unit.medQueued = true;
        unit.medQueueIdx = freeMedIndex(tent, unit, true);
        svc('FloatingText').status(unit.x, unit.y, 'WAITING', '#e0b060');
      }
      const q = medQueuePos(tent, unit.medQueueIdx || 0);
      unit.huntMode = false;
      unit.manualOrder = false;
      unit.structureTargetId = null;
      unit.path = [];
      unit.pathIndex = 0;
      unit.targetX = q.x;
      unit.targetY = q.y;
      if (unit.attackAnimTimer > 0) return false;
      if (posDistSq(unit.x, unit.y, q.x, q.y) > 16) {
        if (steerToward(unit, q.x, q.y)) unit.animState = 'walk';
      } else if (unit.animState === 'walk') unit.animState = 'idle';
      return false;
    }
    unit.medQueued = false;
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.combatTargetId = null;
    unit.structureTargetId = null;
    unit.pathRecalc = (unit.pathRecalc || 0) - 1;
    const destMoved = posDistSq(unit.targetX ?? 0, unit.targetY ?? 0, slot.x, slot.y) > 36;
    const needsPath =
      unit.pathTargetId !== `med:${tent.id}` ||
      !unit.path?.length ||
      destMoved ||
      unit.pathRecalc <= 0 ||
      (unit.pathStuck || 0) > 3;
    if (needsPath) setMedRetreatPath(unit, tent);
    if (unit.path?.length && unit.pathIndex < unit.path.length) {
      followPath(unit);
    } else {
      unit.rotation = Math.round((Math.atan2(slot.y - unit.y, slot.x - unit.x) * 180) / Math.PI);
      if (steerToward(unit, slot.x, slot.y)) unit.animState = 'walk';
    }
    return false;
  }

  function releaseHealerMedRetreat(unit) {
    unit.fightToDeath = false;
    unit.pathTargetId = null;
    unit.path = [];
    unit.pathIndex = 0;
    unit.healTargetId = null;
    endMedicalRetreat(unit);
  }

  function updateMedicalRetreats() {
    let anyTent = false;
    for (const b of GS.buildings) {
      if (isMedicalTentBuilding(b)) {
        anyTent = true;
        break;
      }
    }
    for (const unit of GS.units) {
      if (unit.team !== 'player' || unit.hp <= 0) continue;

      // Note who has actually been hurt since he was last at full health.
      if (unit.hp < (unit.medPrevHp ?? unit.hp) - 0.01) unit.medHurt = true;
      else if (unit.maxHp - unit.hp < 0.5) unit.medHurt = false;
      unit.medPrevHp = unit.hp;

      if (unit.combatType === 'healer' && unit.healerFleeing && !isBeingTargeted(unit)) {
        // Safe again. If he is hurt and a tent stands, the med tent rule sends him on.
        releaseHealerMedRetreat(unit);
        svc('FloatingText').status(unit.x, unit.y, 'SAFE', '#80e080');
      }

      if (needsMedicalRetreat(unit) && !unit.atMedicalTent && !unit.healerFleeing) {
        tryMedicalRetreat(unit, { silent: !!unit.retreatingToMed });
      }

      // The med tent rule: with a tent on the field, the wounded go before anything else.
      if (anyTent && wantsMedTent(unit)) {
        const tent = findNearestMedicalTent(unit);
        if (tent) beginMedicalRetreat(unit, tent, { silent: unit.hp / unit.maxHp > 0.9 });
      }

      if (unit.retreatingToMed && !unit.atMedicalTent) {
        const tent = resolveMedicalRetreatTent(unit);
        if (!tent) {
          // The tent is gone: back to duty.
          endMedicalRetreat(unit);
          unit.fightToDeath = unit.hp / unit.maxHp <= RETREAT_HP_RATIO;
        }
      }

      if (!unit.atMedicalTent) continue;
      const tent = GS.buildings.find(
        (b) => b.id === unit.atMedicalTent && isMedicalTentBuilding(b)
      );
      if (!tent) {
        endMedicalRetreat(unit);
        continue;
      }
      const nightHealMult = isNightPhase() ? 1.55 : 1;
      const healAmt = unit.maxHp * (tent.healRate || 0.03) * 0.04 * nightHealMult;
      if (healAmt > 0 && unit.hp < unit.maxHp) {
        const applied = Math.min(healAmt, unit.maxHp - unit.hp);
        unit.hp += applied;
        if (unit.frame === 0) {
          svc('FloatingText').heal(unit.x, unit.y, Math.max(1, Math.round(applied)));
          svc('Particles').heal(unit.x, unit.y);
        }
      }
      // He leaves healed to full (a tent that cannot heal lets him go at once).
      const healed = unit.hp >= unit.maxHp - 0.01 || healAmt <= 0;
      const healerSafe =
        unit.combatType === 'healer' && unit.healerFleeing && !isBeingTargeted(unit);
      if (healed && (!unit.healerFleeing || healerSafe)) {
        if (unit.hp >= unit.maxHp - 0.01) unit.hp = unit.maxHp;
        unit.fightToDeath = false;
        if (unit.combatType === 'healer') releaseHealerMedRetreat(unit);
        else endMedicalRetreat(unit);
        svc('FloatingText').status(unit.x, unit.y, 'READY', '#80e080');
      }
    }
  }

  return {
    bind,
    endMedicalRetreat,
    marchToMedicalTent,
    resolveMedicalRetreatTent,
    tryHealerMedicalRetreat,
    tryMedicalRetreat,
    updateMedicalRetreats,
  };
})();
