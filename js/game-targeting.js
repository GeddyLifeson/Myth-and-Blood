/**
 * Attack range, engagers, surround slots and target picking.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameTargeting = (() => {
  const {
    MELEE_STANDOFF,
    UNIT_COLLISION,
    ensureBuildingHealth,
    getApproachPoint,
    getMeleeRing,
    isMeleeCombat,
    isSiegeableStructure,
    isValidCombatFoe,
    playSfx,
    posDistSq,
    slotAngleOffset,
    spatialScratchQuery,
    svc,
    tacticalFoeCap,
    trimFoeListToNearest,
    unitDistSq,
    unitDistance,
  } = GameCore;
  const GS = GameState;
  const { clampPos, engagerCache, lineOfSight, tacticalTargetCache, useSpatialQueries } = GameField;
  const {
    HUNT_HEAR_DIST,
    SURROUND_MIN_FILLED,
    SURROUND_RING_MELEE,
    SURROUND_SLOTS_MELEE,
    SURROUND_SLOTS_RANGED,
    foeInHuntLeash,
    foeIsPastPost,
    isCrowdedOut,
    isLeashed,
    isPursuableFoe,
    isSweeping,
  } = GameMorale;
  const { findPlayerGeneral } = GameCombat;
  let finalizeBuildingDestroyed, getUnitById, isEnemyHiddenByFog, isTerrainBlockedForPath;
  function bind(api) {
    ({ finalizeBuildingDestroyed, getUnitById, isEnemyHiddenByFog, isTerrainBlockedForPath } = api);
  }

  function damageBuilding(b, amount, attacker = null) {
    if (!b || b.hp <= 0) return;
    amount = Number(amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    ensureBuildingHealth(b);
    b.hp -= amount;
    svc('FloatingText').damage(b.x, b.y - 8, amount);
    svc('Particles').dust(b.x, b.y);
    // Wall / keep hits get heavy timber thud; other structures use impact tiers.
    if (b.type === 'wall' || b.isKeep || b.type === 'castle' || b.type === 'outpost') {
      playSfx('gateHit');
    } else if (amount >= 28) {
      playSfx('impact', 'heavy');
    } else {
      playSfx('impact', 'medium');
    }
    if (b.hp <= 0) finalizeBuildingDestroyed(b, { attacker });
  }

  function getEffectiveRange(unit) {
    if (unit.combatType !== 'ranged') return unit.range;
    let r = unit.baseRange ?? unit.range;
    if (unit.garrisoned) {
      const op = GS.buildings.find((b) => b.id === unit.garrisoned && b.complete);
      if (op) r += op.rangeBonus || BuildDefs.outpost.rangeBonus;
    }
    return svc('DynamicMapEvents') ? r * svc('DynamicMapEvents').rangeMult(unit) : r;
  }

  function maxAttackRange(unit) {
    if (unit.combatType === 'ranged') return getEffectiveRange(unit);
    if (unit.combatType === 'siege') return unit.range;
    if (isMeleeCombat(unit)) return unit.meleeRange;
    return 0;
  }

  function inAttackRange(unit, target) {
    const buffer = isMeleeCombat(unit) ? 4 : 0;
    return unitDistance(unit, target) <= maxAttackRange(unit) + buffer;
  }

  function getEnemyEngagers(enemy, team, exclude = null) {
    if (!enemy || enemy.hp <= 0 || enemy.fleeing) return [];
    const list = [];
    const scanR2 = 10000;
    const candidates = useSpatialQueries()
      ? (() => {
          const scratch = spatialScratchQuery(enemy.x, enemy.y, 100, (e) => {
            const u = e.ref;
            return (
              e.kind === 'unit' &&
              u?.team === team &&
              u?.hp > 0 &&
              u?.combatType !== 'healer' &&
              u?.combatType !== 'builder' &&
              u !== exclude
            );
          });
          return scratch;
        })()
      : GS.units.filter(
          (u) =>
            u !== exclude &&
            u.team === team &&
            u.hp > 0 &&
            u.combatType !== 'healer' &&
            u.combatType !== 'builder'
        );
    for (const u of candidates) {
      const committed = u.pathTargetId === enemy.id || u.combatTargetId === enemy.id;
      const closing = committed && unitDistSq(u, enemy) < scanR2;
      const fighting = inAttackRange(u, enemy);
      if (fighting || closing) list.push(u);
    }
    return list;
  }

  function getEnemyEngagersCached(enemy, team, exclude = null) {
    if (GS.engagerCacheFrame !== GS.updateTick) {
      engagerCache.clear();
      GS.engagerCacheFrame = GS.updateTick;
    }
    const ck = `${enemy.id}:${team}:${exclude?.id ?? ''}`;
    if (engagerCache.has(ck)) return engagerCache.get(ck);
    const result = getEnemyEngagers(enemy, team, exclude);
    engagerCache.set(ck, result);
    return result;
  }

  function sameTypeEngaging(enemy, unit) {
    return getEnemyEngagersCached(enemy, unit.team, unit).some((u) => u.type === unit.type);
  }

  function countFilledSurroundSlots(enemy, team) {
    const engagers = getEnemyEngagersCached(enemy, team);
    const ring = SURROUND_RING_MELEE + 2;
    const slotTakenR2 = 324;
    const slotTargetR2 = 256;
    let filled = 0;
    for (let i = 0; i < SURROUND_SLOTS_MELEE; i++) {
      const angle = (i / SURROUND_SLOTS_MELEE) * Math.PI * 2;
      const sx = enemy.x + Math.cos(angle) * ring;
      const sy = enemy.y + Math.sin(angle) * ring;
      const taken = engagers.some(
        (u) =>
          posDistSq(u.x, u.y, sx, sy) < slotTakenR2 ||
          (u.targetX != null && posDistSq(u.targetX, u.targetY, sx, sy) < slotTargetR2)
      );
      if (taken) filled++;
    }
    return filled;
  }

  function isFullySurrounded(enemy, team) {
    const engagers = getEnemyEngagersCached(enemy, team);
    const meleeNear = engagers.filter((u) => isMeleeCombat(u)).length;
    return countFilledSurroundSlots(enemy, team) >= SURROUND_MIN_FILLED || meleeNear >= 5;
  }

  function getSurroundSlot(unit, enemy) {
    const melee = isMeleeCombat(unit);
    const ring = melee ? getMeleeRing(unit) : Math.min(getEffectiveRange(unit) * 0.72, 85);
    const slotCount = melee ? SURROUND_SLOTS_MELEE : SURROUND_SLOTS_RANGED;
    const candidates = [];
    // Direct line approach is reliable near map borders where ring slots collapse.
    const direct = getApproachPoint(unit, enemy, melee ? MELEE_STANDOFF : ring * 0.9);
    const directClamped = clampPos(direct.x, direct.y);

    for (let i = 0; i < slotCount; i++) {
      const angle = (i / slotCount) * Math.PI * 2 + slotAngleOffset(unit.id, i);
      let sx = enemy.x + Math.cos(angle) * ring;
      let sy = enemy.y + Math.sin(angle) * ring;
      const pos = clampPos(sx, sy);
      let score = Math.sqrt(posDistSq(unit.x, unit.y, pos.x, pos.y));
      // Edge fix: slots outside the map clamp onto the border and stack on one point.
      const clampDist = Math.hypot(pos.x - sx, pos.y - sy);
      if (clampDist > 1.5) score += 90 + clampDist * 5;
      const distToEnemy = Math.hypot(pos.x - enemy.x, pos.y - enemy.y);
      // Collapsed onto the target (or past them into the wall) — unusable approach.
      if (distToEnemy < ring * 0.4) score += 420;
      const allyNearR2 = 784;
      const slotTargetR2 = 324;
      const allyCollideR2 = (UNIT_COLLISION + 4) * (UNIT_COLLISION + 4);

      const nearbyAllies = useSpatialQueries()
        ? spatialScratchQuery(
            pos.x,
            pos.y,
            28,
            (e) => e.kind === 'unit' && e.ref?.team === unit.team && e.ref?.hp > 0
          )
        : GS.units.filter(
            (u) =>
              u !== unit &&
              u.hp > 0 &&
              u.team === unit.team &&
              posDistSq(u.x, u.y, pos.x, pos.y) < allyNearR2
          );
      for (const u of nearbyAllies) {
        if (u === unit) continue;
        if (
          u.pathTargetId === enemy.id &&
          u.targetX != null &&
          posDistSq(u.targetX, u.targetY, pos.x, pos.y) < slotTargetR2
        ) {
          score += 220;
        }
        if (posDistSq(u.x, u.y, pos.x, pos.y) < allyCollideR2) score += 160;
      }
      if (isTerrainBlockedForPath(pos.x, pos.y, unit)) score += 300;

      candidates.push({ x: pos.x, y: pos.y, score });
    }

    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    // Prefer direct approach when ring slots are crushed against the map edge.
    if (!best || best.score > 380) {
      return directClamped;
    }
    return best;
  }

  function findTacticalTarget(unit) {
    if (GS.tacticalCacheFrame !== GS.updateTick) {
      tacticalTargetCache.clear();
      GS.tacticalCacheFrame = GS.updateTick;
    }
    if (tacticalTargetCache.has(unit.id)) return tacticalTargetCache.get(unit.id);

    let maxSeek =
      unit.team === 'enemy'
        ? Math.max(maxAttackRange(unit) + 220, 450)
        : maxAttackRange(unit) + 140;
    const options = [];
    // A soldier sent out after stragglers looks across the whole field.
    const sweeping = isSweeping(unit);
    if (sweeping) maxSeek = Math.hypot(GS.worldW, GS.worldH);
    // Leashed hunters look for line-breakers a little further out than for the rest.
    const runnerSeek = isLeashed(unit) && unit.huntMode && !sweeping ? maxSeek + 110 : maxSeek;
    let foeList;
    if (useSpatialQueries()) {
      svc('Spatial').queryFoesInto(unit.x, unit.y, runnerSeek, unit.team, svc('Spatial')._scratch);
      foeList = trimFoeListToNearest(unit, svc('Spatial')._scratch);
    } else {
      foeList = GS.units.filter((u) => u.team !== unit.team && u.hp > 0 && !u.fleeing);
      if (foeList.length > tacticalFoeCap) trimFoeListToNearest(unit, foeList);
    }

    for (const foe of foeList) {
      if (foe.team === unit.team || !isValidCombatFoe(foe)) continue;
      if (unit.team === 'player' && isEnemyHiddenByFog(foe)) continue;
      if (svc('ContentExpansion') && !svc('ContentExpansion').canTargetUnit(unit, foe)) continue;
      const dist = unitDistance(unit, foe);
      if (dist > (foe.lineBreaker ? runnerSeek : maxSeek)) continue;
      // Sight is needed to pick a target, not to keep one: a soldier who lost sight of
      // his enemy behind a tree one step into the chase used to stop and stand there.
      // Nor to notice an enemy this close: a tree between them left him standing idle
      // with an orc a few strides away.
      const chasing =
        unit.team === 'player' &&
        (sweeping ||
          foe.id === unit.combatTargetId ||
          foe.id === unit.pathTargetId ||
          dist <= HUNT_HEAR_DIST);
      if (!chasing && !lineOfSight(unit.x, unit.y, foe.x, foe.y)) continue;

      // Never lock on to what cannot be pursued (still mustering, beyond the leash):
      // a soldier that did stood frozen on it while a reachable enemy walked past.
      if (unit.team === 'player' && !isPursuableFoe(unit, foe)) continue;

      const engagers = getEnemyEngagersCached(foe, unit.team, unit);
      if (isCrowdedOut(unit, foe) && !inAttackRange(unit, foe)) continue;

      let score = dist;
      if (unit.team === 'player' && foe.team === 'enemy') {
        // Runners first, then whatever has got past his post.
        if (foe.lineBreaker) score -= 160;
        else if (foeIsPastPost(unit, foe)) score -= 70;
      }
      if (unit.team === 'enemy' && foe.isGeneral) {
        score -= unit.type === 'assassin' ? 1200 : 800;
        if (foe.stationedKeep && unit.type !== 'assassin') score += 400;
        // Lead from the front (js/general-orders.js): he draws the enemy to him.
        if (foe.leadsFromFront) score -= 300;
      }
      if (sameTypeEngaging(foe, unit)) score += 200;
      score += engagers.filter((u) => u.type === unit.type).length * 90;
      score += engagers.length * 18;
      if (foe.id === unit.combatTargetId && isPursuableFoe(unit, foe)) score -= 28;
      // An attack order outweighs everything else he can see.
      if (foe.id === unit.attackOrderId) score -= 2000;
      if (svc('StrategyCounterplay')) {
        score += svc('StrategyCounterplay').getTargetScoreBias(unit, foe);
      }

      options.push({ foe, score });
    }

    if (options.length === 0) {
      for (const foe of foeList) {
        if (foe.team === unit.team || !isValidCombatFoe(foe)) continue;
        // Same fog gate as primary pass — otherwise units snipe invisible enemies as a fallback.
        if (unit.team === 'player' && isEnemyHiddenByFog(foe)) continue;
        if (svc('ContentExpansion') && !svc('ContentExpansion').canTargetUnit(unit, foe)) continue;
        const dist = unitDistance(unit, foe);
        if (dist > (foe.lineBreaker ? runnerSeek : maxSeek)) continue;
        if (!lineOfSight(unit.x, unit.y, foe.x, foe.y)) continue;
        if (unit.team === 'player' && !isPursuableFoe(unit, foe)) continue;
        let score = dist + (sameTypeEngaging(foe, unit) ? 120 : 0);
        options.push({ foe, score });
      }
    }

    options.sort((a, b) => a.score - b.score);
    let result = options[0]?.foe ?? null;
    if (!result && unit.team === 'player') result = findSquadAssistTarget(unit);
    tacticalTargetCache.set(unit.id, result);
    return result;
  }

  const SQUAD_ASSIST_ALLY_DIST = 260;
  const SQUAD_ASSIST_FOE_DIST = 420;

  /**
   * A soldier with nothing in sight goes to help a comrade who is fighting close by.
   * Posts spread the line out, and without this each man would meet the enemy alone.
   */
  function findSquadAssistTarget(unit) {
    if (!unit.huntMode || unit.manualOrder || !unit.canHunt || unit.holding) return null;
    let best = null;
    let bestD = SQUAD_ASSIST_FOE_DIST * SQUAD_ASSIST_FOE_DIST;
    const allyR2 = SQUAD_ASSIST_ALLY_DIST * SQUAD_ASSIST_ALLY_DIST;
    for (const ally of GS.units) {
      if (ally === unit || ally.team !== 'player' || ally.hp <= 0 || !ally.combatTargetId) continue;
      if (ally.fleeing || ally.demoralized) continue;
      if (posDistSq(unit.x, unit.y, ally.x, ally.y) > allyR2) continue;
      const foe = getUnitById(ally.combatTargetId);
      if (!foe || foe.team === unit.team || !isPursuableFoe(unit, foe)) continue;
      if (foe.team === 'neutral' || foe.isNeutral) continue;
      if (svc('ContentExpansion') && !svc('ContentExpansion').canTargetUnit(unit, foe)) continue;
      const d = posDistSq(unit.x, unit.y, foe.x, foe.y);
      if (d < bestD) {
        bestD = d;
        best = foe;
      }
    }
    return best;
  }

  /** True while a formed-up enemy is close enough that the fight is not over yet. */
  function enemyNearPost(unit, dist) {
    const r2 = dist * dist;
    for (const foe of GS.units) {
      if (foe.team !== 'enemy' || foe.hp <= 0 || foe.fleeing) continue;
      if (posDistSq(unit.x, unit.y, foe.x, foe.y) > r2) continue;
      if (SiegeLoop.isMustering(foe) || isEnemyHiddenByFog(foe)) continue;
      // Only an enemy he may actually go for keeps him out. One beyond his leash used
      // to hold him standing in the open, neither attacking nor going home.
      if (!foeInHuntLeash(unit, foe)) continue;
      return true;
    }
    return false;
  }

  function findNearestPlayer(unit) {
    if (useSpatialQueries()) {
      return svc('Spatial').queryNearestFighter(unit.x, unit.y, 520, 'player');
    }
    let best = null,
      bestD = Infinity;
    for (const p of GS.units) {
      if (p.team !== 'player' || p.hp <= 0 || p.fleeing || p.demoralized) continue;
      const d = Math.hypot(p.x - unit.x, p.y - unit.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function findNearestPlayerSettlement(from) {
    let best = null,
      bestScore = Infinity;
    for (const b of GS.buildings) {
      if (b.owner !== 'player' || b.hp <= 0) continue;
      if (!isSiegeableStructure(b)) continue;
      const d2 = posDistSq(b.x, b.y, from.x, from.y);
      if (d2 > 270400) continue;
      const d = Math.sqrt(d2);
      let score = d;
      if (b.isHamlet) score -= 180;
      if (b.isMerchantGuild) score -= 120;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  /** Nearest living player unit matching `want`, re-checked about once a second per enemy. */
  function findPreferredPlayer(unit, want) {
    if ((unit.preyUntil || 0) > GS.updateTick && unit.preyId) {
      const kept = getUnitById(unit.preyId);
      if (kept && kept.hp > 0 && !kept.fleeing && !kept.garrisoned) return kept;
    }
    let best = null;
    let bestD = 420 * 420;
    for (const p of GS.units) {
      if (p.team !== 'player' || p.hp <= 0 || p.fleeing || p.demoralized || p.garrisoned) continue;
      if (!want(p)) continue;
      const d = posDistSq(p.x, p.y, unit.x, unit.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    unit.preyId = best ? best.id : null;
    unit.preyUntil = GS.updateTick + 60;
    return best;
  }

  function findNearestPlayerStructure(unit) {
    let best = null;
    let bestD = 460 * 460;
    for (const b of GS.buildings) {
      if (b.owner !== 'player' || !(b.hp > 0) || !isSiegeableStructure(b)) continue;
      const d = posDistSq(b.x, b.y, unit.x, unit.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  function findEnemyMoveTarget(unit) {
    if (unit.isCounterRaid && unit.raidTargetId) {
      const raidBld = GS.buildings.find(
        (b) => b.id === unit.raidTargetId && b.hp > 0 && b.owner === 'player'
      );
      if (raidBld) return { kind: 'building', target: raidBld };
    }
    // Line-breakers ignore the army and run for the line; they only fight what blocks them.
    if (unit.lineBreaker) return { kind: 'advance', target: null };
    const general = findPlayerGeneral();
    if (
      general &&
      (unit.type === 'assassin' ||
        unit.type === 'void_stalker' ||
        EnemyDefs[unit.type]?.huntsGeneral)
    ) {
      return { kind: 'unit', target: general };
    }
    if (general && (!general.stationedKeep || Math.random() < 0.55)) {
      return { kind: 'unit', target: general };
    }
    const settlement = findNearestPlayerSettlement(unit);
    const raidChance = svc('EnemyFactions')
      ? svc('EnemyFactions').getSettlementRaidChance(
          GS.wave,
          unit.enemyFaction,
          isRtsEra(GS.wave) ? 0.72 : 0.35
        )
      : isRtsEra(GS.wave)
        ? 0.72
        : 0.35;
    if (settlement && Math.random() < raidChance) {
      return { kind: 'building', target: settlement };
    }
    const want = Roster.preference(unit);
    if (want === 'support') {
      const prey = findPreferredPlayer(unit, Roster.isSupport);
      if (prey) return { kind: 'unit', target: prey };
    } else if (want === 'building') {
      const site = findNearestPlayerStructure(unit);
      if (site) return { kind: 'building', target: site };
    }
    const tactical = findTacticalTarget(unit);
    if (tactical) return { kind: 'unit', target: tactical };
    const nearest = findNearestPlayer(unit);
    if (nearest) return { kind: 'unit', target: nearest };
    return { kind: 'advance', target: null };
  }

  return {
    bind,
    damageBuilding,
    enemyNearPost,
    findEnemyMoveTarget,
    findNearestPlayer,
    findPreferredPlayer,
    findTacticalTarget,
    getEffectiveRange,
    getEnemyEngagersCached,
    getSurroundSlot,
    inAttackRange,
    isFullySurrounded,
    maxAttackRange,
  };
})();
