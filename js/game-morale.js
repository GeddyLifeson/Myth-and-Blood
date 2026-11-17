/**
 * Morale breaks, hunt leash and sweep, pursuit, general rally.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameMorale = (() => {
  const {
    isBuildingPathTarget,
    isDragonThemedUnit,
    isHeroUnit,
    isMajorBossUnit,
    isMoraleCombatUnit,
    isValidCombatFoe,
    moraleBreakThreshold,
    playSfx,
    posDistSq,
    releaseCombatPursuit,
    svc,
    unitDistSq,
    unitDistance,
  } = GameCore;
  const GS = GameState;
  const { lineOfSight } = GameField;
  const { applyGlobalHuntState, hasPost } = GameStance;
  let ach,
    findNearestAttackableEnemyBuilding,
    findPlayerGeneral,
    findTacticalTarget,
    getBuildingPursuitTarget,
    getEnemyEngagersCached,
    getEnemyStructureSeekDist,
    inAttackRange,
    inBuildingAttackRange,
    isEnemyHiddenByFog,
    isFullySurrounded,
    isNightPhase,
    maxAttackRange,
    pathToEnemyStructure,
    releaseFromGarrison,
    releaseFromKeep,
    setUnitPath,
    shouldPrioritizeEnemyStructure,
    showMessage;
  function bind(api) {
    ({
      ach,
      findNearestAttackableEnemyBuilding,
      findPlayerGeneral,
      findTacticalTarget,
      getBuildingPursuitTarget,
      getEnemyEngagersCached,
      getEnemyStructureSeekDist,
      inAttackRange,
      inBuildingAttackRange,
      isEnemyHiddenByFog,
      isFullySurrounded,
      isNightPhase,
      maxAttackRange,
      pathToEnemyStructure,
      releaseFromGarrison,
      releaseFromKeep,
      setUnitPath,
      shouldPrioritizeEnemyStructure,
      showMessage,
    } = api);
  }

  const ALLY_MOVE_MARGIN = 0;
  const SURROUND_SLOTS_MELEE = 8;
  const SURROUND_SLOTS_RANGED = 6;
  const SURROUND_RING_MELEE = 18;
  const SURROUND_MIN_FILLED = 6;
  const MORALE_WITNESS_RADIUS = 150;
  const MORALE_WITNESS_CLOSE = 70;
  const OPENING_RESOLVE_WAVES = 2;
  const GENERAL_RALLY_RANGE = 40;
  const GENERAL_W2W_BUFF_TICKS = 200;

  const ETERNAL_CRUSADE_MIN_FORTS = 8;

  const DRAGON_THEMED_STRIKES = new Set(['fus_ro_dah', 'fire_breath', 'ice_form']);

  function checkDragonThemedBossKill(killer, bossUnit) {
    if (!bossUnit || !isMajorBossUnit(bossUnit) || GS.creativeMode) return null;
    const dragonStrike =
      bossUnit.dragonStrikeHitWave != null && bossUnit.dragonStrikeHitWave === GS.wave;
    const heroKill = killer && isDragonThemedUnit(killer);
    if (!dragonStrike && !heroKill) return null;
    return {
      bossType: bossUnit.type,
      bossName: bossUnit.name || bossUnit.type,
      killerType: killer?.type || null,
      viaStrike: dragonStrike,
      viaHero: heroKill,
      wave: GS.wave,
    };
  }

  function recordPathImmortalIfEligible(unit) {
    if (!unit || GS.creativeMode) return;
    const maxTier = typeof MAX_VETERAN_TIER !== 'undefined' ? MAX_VETERAN_TIER : 6;
    if ((unit.vetTier || 0) < maxTier) return;
    const pathId =
      typeof EternalPathFramework !== 'undefined'
        ? EternalPathFramework.getPathForUnit?.(unit.type, unit)
        : null;
    if (pathId) {
      ach('path_immortal_reached', {
        pathId,
        unitType: unit.type,
        vetTier: unit.vetTier,
        wave: GS.wave,
      });
    }
  }

  function checkSoloHeroNamedBossKill(killer, bossUnit, allUnits) {
    if (!bossUnit?.isNamedBoss || GS.creativeMode) return null;
    if (!killer || killer.team !== 'player' || killer.hp <= 0) return null;
    if (!isHeroUnit(killer)) return null;
    const alive = (allUnits || []).filter((u) => u.team === 'player' && u.hp > 0 && !u.garrisoned);
    if (alive.length !== 1 || alive[0].id !== killer.id) return null;
    const bossName = bossUnit.bossName || EnemyDefs[bossUnit.type]?.bossName || bossUnit.type;
    return {
      solo: true,
      heroType: killer.type,
      bossType: bossUnit.type,
      bossName,
      wave: GS.wave,
    };
  }

  function canWitnessDeath(observer, dead) {
    if (
      !observer ||
      !dead ||
      observer.team !== dead.team ||
      observer.hp <= 0 ||
      observer.id === dead.id
    )
      return false;
    if (!isMoraleCombatUnit(observer)) return false;
    if (globalThis.Honours?.shieldsMorale(observer)) return false;
    if (unitDistSq(observer, dead) > MORALE_WITNESS_RADIUS * MORALE_WITNESS_RADIUS) return false;
    return lineOfSight(observer.x, observer.y, dead.x, dead.y);
  }

  function triggerMoraleBreak(unit, reason) {
    if (!isMoraleCombatUnit(unit) || unit.fleeing || unit.demoralized || unit.retreatingToMed)
      return;
    if (unit.team === 'enemy' && (unit.isNamedBoss || svc('GameDepth')?.isEnemyEvilHero(unit))) {
      // A broken operative that fights at range would hang back for good: it runs for the line.
      if (!unit.isNamedBoss && unit.combatType !== 'melee' && !unit.stormLine) {
        unit.lineBreaker = true;
        unit.stormLine = true;
        unit.path = [];
        unit.pathIndex = 0;
        unit.combatTargetId = null;
      }
      return;
    }
    if (unit.team === 'player') {
      GS.moraleCascadeState =
        GameDepth?.recordMoraleCascade({ ...GS.moraleCascadeState, tick: GS.updateTick }, true) ||
        GS.moraleCascadeState;
      if (GS.moraleCascadeState.cascade && GS.moraleAlertCooldown <= 0) {
        showMessage('Morale cascade! Rally troops or send a Royal Decree.', 260);
        GS.moraleAlertCooldown = 480;
        svc('FloatingText').status(GS.worldW / 2, GS.rallyY - 20, 'CASCADE', '#c080ff');
      }
    }
    // The opening garrison has nowhere to run to: in the first two waves soldiers waver
    // but stand. A run cannot end on wave 1 or 2 because the last men walked off the field.
    if (unit.team === 'player' && GS.wave <= OPENING_RESOLVE_WAVES && !GS.creativeMode) {
      unit.morale = Math.max(unit.morale, moraleBreakThreshold(unit) + 1);
      unit.witnessDeaths = 0;
      if ((unit.resolveNoteTick || 0) + 300 < GS.updateTick) {
        unit.resolveNoteTick = GS.updateTick;
        svc('FloatingText')?.status?.(unit.x, unit.y, 'STANDS FIRM', '#e4dcc4');
      }
      return;
    }
    if (unit.team === 'player' && GS.wave >= ACADEMY_ERA_WAVE) {
      unit.demoralized = true;
      releaseFromGarrison(unit);
      unit.huntMode = false;
      unit.manualOrder = false;
      unit.combatTargetId = null;
      unit.path = [];
      unit.pathIndex = 0;
      unit.animState = 'idle';
      svc('FloatingText').status(unit.x, unit.y, 'GAVE UP', '#a080c0');
      if (GS.moraleAlertCooldown <= 0) {
        showMessage('Soldiers lose heart — the General must rally them!', 220);
        GS.moraleAlertCooldown = 360;
      }
      playSfx('moraleBreak');
      return;
    }
    unit.fleeing = true;
    unit.fleeTicks = 0;
    releaseFromGarrison(unit);
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.combatTargetId = null;
    unit.path = [];
    unit.pathIndex = 0;
    unit.fledBattle = true;
    clearPursuersOf(unit);
    svc('FloatingText').status(unit.x, unit.y, 'ROUT!', '#c06040');
    playSfx('moraleBreak');
  }

  function clearPursuersOf(unit) {
    for (const u of GS.units) {
      if (u.combatTargetId === unit.id || u.pathTargetId === unit.id) {
        if (unit.hp > 0 && canRideDown(u, unit)) continue;
        releaseCombatPursuit(u, { keepManual: u.manualOrder });
      }
    }
  }

  // ---------------------------------------------------------------- hunt leash
  // Hunt is tied to the post. A soldier leaves it only this far to reach an enemy, so a
  // chase cannot string him across the field one target at a time.
  const HUNT_LEASH_MELEE = 240; // how far a melee soldier walks from his post
  const HUNT_LEASH_RANGED = 140; // ranged step forward only far enough to shoot
  const HUNT_LEASH_RUNNER_MULT = 1.5; // line-breakers are chased further
  const HUNT_LEASH_KEEP_MULT = 1.2; // a target already engaged is kept a little longer
  const HUNT_LEASH_STRUCTURE_MULT = 2; // enemy buildings do not run away
  const HUNT_HEAR_DIST = 130; // this close, an enemy is noticed without a clear line of sight

  // The leash must not leave a wave unfinishable or slow it to a crawl. Once the whole
  // host is on the field and formed up, if no enemy has been hurt and none has come any
  // closer for this long, the hunters nearest the enemy go out as a party to finish them.
  // The rest of the line, and every held soldier, stays.
  const HUNT_SWEEP_QUIET_TICKS = 600; // ten seconds
  const HUNT_SWEEP_MIN_PARTY = 3;
  const HUNT_SWEEP_STRENGTH = 2; // the party's health against the enemy's
  GS.huntSweep = false;
  GS.huntQuietTicks = 0;
  GS.huntFront = Infinity;

  function isSweeping(unit) {
    return (
      GS.huntSweep &&
      unit.team === 'player' &&
      (unit.sweepUntil || 0) > GS.updateTick &&
      !!unit.huntMode &&
      !unit.manualOrder &&
      !unit.holding
    );
  }

  function sweepCandidates() {
    return GS.units.filter(
      (u) =>
        u.team === 'player' &&
        u.hp > 0 &&
        u.canHunt &&
        u.huntMode &&
        !u.holding &&
        !u.manualOrder &&
        !u.garrisoned &&
        !u.wallGarrisoned &&
        !u.stationedKeep
    );
  }

  function updateHuntSweep() {
    if (isNightPhase() || GS.creativeMode) {
      GS.huntSweep = false;
      GS.huntQuietTicks = 0;
      GS.huntFront = Infinity;
      return;
    }
    const stragglers = [];
    let foes = 0;
    let foeHp = 0;
    for (const u of GS.units) {
      if (u.hp <= 0 || u.team !== 'enemy' || u.fleeing) continue;
      foes++;
      foeHp += u.hp;
      if (!SiegeLoop.isMustering(u) && !isEnemyHiddenByFog(u)) stragglers.push(u);
    }
    // More of the host still to come, or still forming up: not a standstill yet.
    if (!foes || GS.spawnQueue.length > 0 || stragglers.length < foes) {
      GS.huntSweep = false;
      GS.huntQuietTicks = 0;
      GS.huntFront = Infinity;
      return;
    }
    if (GS.updateTick % 30 !== 0) {
      if (!GS.huntSweep) GS.huntQuietTicks++;
      return;
    }
    const hunters = sweepCandidates();
    if (!hunters.length) return;
    if (!GS.huntSweep) {
      // An enemy still closing on the posts is on his way to the fight; wait for him.
      let front = Infinity;
      for (const f of stragglers) {
        for (const h of hunters) {
          const d = posDistSq(f.x, f.y, h.postX ?? h.x, h.postY ?? h.y);
          if (d < front) front = d;
        }
      }
      front = Math.sqrt(front);
      if (front < GS.huntFront - 6) GS.huntQuietTicks = 0;
      GS.huntFront = front;
      // Quiet = no enemy hurt (takeDamage resets the count) and none coming closer. A
      // soldier locked on to an enemy he cannot reach does not count as fighting.
      if (++GS.huntQuietTicks < HUNT_SWEEP_QUIET_TICKS) return;
      GS.huntSweep = true;
      showMessage('The enemy hangs back: a party goes out to finish them.', 200);
    }
    // Re-pick the party twice a second: the hunters nearest the stragglers, enough of
    // them to outweigh what is left (a boss draws the whole line, one goblin three men).
    const target = stragglers[0];
    hunters.sort(
      (a, b) => posDistSq(a.x, a.y, target.x, target.y) - posDistSq(b.x, b.y, target.x, target.y)
    );
    let weight = 0;
    let n = 0;
    for (const h of hunters) {
      if (n >= HUNT_SWEEP_MIN_PARTY && weight >= foeHp * HUNT_SWEEP_STRENGTH) break;
      weight += h.hp;
      n++;
      h.sweepUntil = GS.updateTick + 60;
    }
  }

  /** True for a player soldier whose targets are limited to the leash round his post. */
  function isLeashed(unit) {
    return (
      unit.team === 'player' &&
      !!unit.canHunt &&
      hasPost(unit) &&
      !unit.raidTargetId &&
      !unit.raidMissionId &&
      !unit.garrisoned &&
      !unit.wallGarrisoned &&
      !unit.stationedKeep
    );
  }

  /** How far from the post he may stand while fighting. */
  function huntLeashOf(unit) {
    const base =
      unit.combatType === 'ranged' || unit.combatType === 'siege'
        ? HUNT_LEASH_RANGED
        : HUNT_LEASH_MELEE;
    return base * Formations.leashMult(unit);
  }

  /** Can he strike this point without standing further than `mult` leashes from his post? */
  function pointInHuntLeash(unit, x, y, mult = 1, extraReach = 0) {
    const reach = huntLeashOf(unit) * mult + maxAttackRange(unit) + extraReach;
    return posDistSq(unit.postX, unit.postY, x, y) <= reach * reach;
  }

  function foeInHuntLeash(unit, foe) {
    if (!isLeashed(unit) || isSweeping(unit)) return true;
    let mult = foe.lineBreaker ? HUNT_LEASH_RUNNER_MULT : 1;
    if (foe.id === unit.combatTargetId) mult *= HUNT_LEASH_KEEP_MULT;
    return pointInHuntLeash(unit, foe.x, foe.y, mult) || inAttackRange(unit, foe);
  }

  /** An enemy that has got past this soldier's post, towards what he is guarding. */
  function foeIsPastPost(unit, foe) {
    if (!hasPost(unit)) return false;
    switch (foe.spawnSide || 'north') {
      case 'south':
        return foe.y < unit.postY;
      case 'east':
        return foe.x < unit.postX;
      case 'west':
        return foe.x > unit.postX;
      default:
        return foe.y > unit.postY;
    }
  }

  /**
   * Enough comrades are already striking this enemy that one more would only queue
   * behind them. Counts blows, not intentions: five men all walking towards the same
   * orc used to count as "surrounded" and every one of them stopped short.
   */
  function isCrowdedOut(unit, foe) {
    if (foe.team === 'neutral' || foe.isNeutral) return false;
    if (!isFullySurrounded(foe, unit.team)) return false;
    if (unit.team !== 'player') return true;
    let striking = 0;
    for (const e of getEnemyEngagersCached(foe, unit.team, unit)) {
      if (inAttackRange(e, foe) && ++striking >= 3) return true;
    }
    return false;
  }

  /** Cavalry and scouts (`ridesDown` in data/units.json) may strike an enemy that has routed. */
  function canRideDown(unit, foe) {
    return (
      unit.team === 'player' &&
      foe.team === 'enemy' &&
      foe.hp > 0 &&
      !!foe.fleeing &&
      !!getPlayerUnitDef(unit.type)?.ridesDown
    );
  }

  function isPursuableFoe(unit, foe) {
    if (!foe || foe.team === unit.team) return false;
    if (!isValidCombatFoe(foe) && !canRideDown(unit, foe)) return false;
    if (!foeInHuntLeash(unit, foe)) return false;
    // Player units cannot chase/fire on fog-hidden host troops (matches render + minimap).
    if (unit.team === 'player' && foe.team === 'enemy' && isEnemyHiddenByFog(foe)) return false;
    // Troops do not charge the spot where the enemy appears; they engage once a squad
    // has formed up and advanced, or when it is already on top of them.
    if (
      unit.team === 'player' &&
      SiegeLoop.isMustering(foe) &&
      posDistSq(unit.x, unit.y, foe.x, foe.y) > 140 * 140
    ) {
      return false;
    }
    // A Sapper's charges cannot reach flyers, so he neither chases nor "engages" them.
    if (unit.type === 'sapper' && unit.team === 'player' && foe.flying) return false;
    return true;
  }

  function getPursuitTarget(unit) {
    if (
      !unit.pathTargetId ||
      unit.pathTargetId === 'advance' ||
      isBuildingPathTarget(unit.pathTargetId)
    )
      return null;
    const t = GS.units.find((u) => u.id === unit.pathTargetId);
    return t && t.hp > 0 ? t : null;
  }

  function retargetIfHunting(unit) {
    if (unit.manualOrder || unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep)
      return null;
    if (unit.team === 'player' && !unit.huntMode) return null;
    const seekDist = getEnemyStructureSeekDist(unit);
    const bld = findNearestAttackableEnemyBuilding(unit, seekDist);
    const foe = findTacticalTarget(unit);
    const pursueBld = shouldPrioritizeEnemyStructure(unit, foe, bld);
    if (pursueBld && bld) {
      unit.combatTargetId = null;
      unit.structureTargetId = bld.id;
      if (!inBuildingAttackRange(unit, bld)) pathToEnemyStructure(unit, bld);
      return null;
    }
    if (foe) {
      unit.structureTargetId = null;
      unit.combatTargetId = foe.id;
      if (!inAttackRange(unit, foe)) setUnitPath(unit, foe.x, foe.y, foe);
      return foe;
    }
    return null;
  }

  function isPursuingEnemyStructure(unit) {
    if (!unit?.huntMode || unit.manualOrder) return false;
    return !!getBuildingPursuitTarget(unit) || isBuildingPathTarget(unit.pathTargetId);
  }

  function sanitizeUnitPursuit(unit) {
    const locked = unit.combatTargetId ? GS.units.find((u) => u.id === unit.combatTargetId) : null;
    const pathTgt = getPursuitTarget(unit);
    const badLocked = locked && !isPursuableFoe(unit, locked);
    const badPath = pathTgt && !isPursuableFoe(unit, pathTgt);
    if (!badLocked && !badPath) return false;
    releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
    retargetIfHunting(unit);
    return true;
  }

  function applyWitnessDeath(deadUnit) {
    const isGeneralDeath = deadUnit.isGeneral;
    const isEliteDeath = isEliteEnemy(deadUnit);
    for (const observer of GS.units) {
      if (!canWitnessDeath(observer, deadUnit)) continue;
      const closeWitness =
        unitDistSq(observer, deadUnit) < MORALE_WITNESS_CLOSE * MORALE_WITNESS_CLOSE;
      observer.witnessDeaths = (observer.witnessDeaths || 0) + 1;
      const enemyWitness = observer.team === 'enemy';
      const t = DIFFICULTY_TUNING;
      let moraleLoss = enemyWitness
        ? closeWitness
          ? t.enemyWitnessLossClose
          : t.enemyWitnessLossFar
        : closeWitness
          ? t.soldierWitnessLossClose
          : t.soldierWitnessLossFar;
      if (isGeneralDeath) moraleLoss += 3;
      if (isEliteDeath && observer.team === 'enemy') moraleLoss += 1;
      observer.morale = Math.max(0, observer.morale - moraleLoss);
      if (observer.morale <= moraleBreakThreshold(observer)) {
        triggerMoraleBreak(observer, 'witness');
      }
    }
    if (deadUnit.team === 'player') {
      for (const ally of GS.units) {
        if (ally.team !== 'player' || ally.hp <= 0 || ally.id === deadUnit.id) continue;
        if (!isMoraleCombatUnit(ally)) continue;
        ally.morale = Math.max(
          0,
          ally.morale - (isGeneralDeath ? 4 : DIFFICULTY_TUNING.armyLossPerDeath)
        );
        if (ally.morale <= moraleBreakThreshold(ally) && !ally.demoralized && !ally.fleeing) {
          triggerMoraleBreak(ally, 'casualty');
        }
      }
    }
  }

  function updateFleeingUnit(unit) {
    unit.fleeTicks = (unit.fleeTicks || 0) + 1;
    const speed = unit.speed * 1.35;
    const side = unit.spawnSide || 'north';
    const edgeMargin = 32;
    if (unit.team === 'enemy') {
      switch (side) {
        case 'south':
          unit.y += speed;
          unit.rotation = 90;
          break;
        case 'east':
          unit.x += speed;
          unit.rotation = 0;
          break;
        case 'west':
          unit.x -= speed;
          unit.rotation = 180;
          break;
        default:
          unit.y -= speed;
          unit.rotation = -90;
          break;
      }
    } else {
      unit.y += speed;
      unit.rotation = 90;
    }
    unit.animState = 'walk';
    let offMap = false;
    if (unit.team === 'enemy') {
      offMap =
        side === 'south'
          ? unit.y > GS.worldH - edgeMargin
          : side === 'east'
            ? unit.x > GS.worldW - edgeMargin
            : side === 'west'
              ? unit.x < edgeMargin
              : unit.y < edgeMargin;
      if (!offMap && unit.fleeTicks > 180) offMap = true;
    } else {
      offMap = unit.y > GS.worldH + 36;
    }
    if (offMap) {
      unit.hp = 0;
      unit.fleeing = false;
      unit.fledBattle = true;
      clearPursuersOf(unit);
      if (unit.team === 'player') {
        // He never went through takeDamage, so the run's losses are counted here.
        unit.deathCause = 'deserted';
        GS.runPlayerDeaths++;
        GS.playerCasualtiesThisWave++;
        const troopName = unit.honorName || getPlayerUnitDef(unit.type)?.name || 'A soldier';
        showMessage(`${troopName} deserted the field!`, 160);
      }
    }
  }

  function findDemoralizedTroop(general) {
    const gen = general || findPlayerGeneral();
    let best = null,
      bestD = Infinity;
    for (const u of GS.units) {
      if (u.team !== 'player' || u.hp <= 0 || !u.demoralized) continue;
      if (!isMoraleCombatUnit(u)) continue;
      const d = gen ? unitDistance(gen, u) : Math.hypot(u.x, u.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  function restoreTroopMorale(unit, amount = 14) {
    unit.demoralized = false;
    unit.fleeing = false;
    unit.fledBattle = false;
    unit.witnessDeaths = 0;
    unit.morale = Math.min(unit.maxMorale, (unit.morale || 0) + amount);
    unit.rallyTimer = Math.max(unit.rallyTimer || 0, 150);
    if (unit.canHunt) {
      unit.manualOrder = false;
      applyGlobalHuntState(unit);
    }
  }

  function deliverWallToWall(general, target) {
    restoreTroopMorale(target, 16);
    svc('FloatingText').status(target.x, target.y, 'WALL TO WALL!', '#ffd700');
    svc('Particles').dust(general.x, general.y);
    playSfx('reinforce');
    for (const ally of GS.units) {
      if (ally.team !== 'player' || ally.hp <= 0) continue;
      if (unitDistance(general, ally) > 55) continue;
      if (ally.demoralized) restoreTroopMorale(ally, 10);
      else ally.morale = Math.min(ally.maxMorale, ally.morale + 4);
    }
    general.rallyTargetId = null;
    general.rallyCooldown = 45;
    const troopName = target.honorName || getPlayerUnitDef(target.type)?.name || 'A soldier';
    showMessage(`${troopName} stands tall again!`, 180);
  }

  function updateGeneralRallyMission(general) {
    if (!general?.isGeneral || general.hp <= 0) return;
    if ((general.rallyCooldown || 0) > 0) {
      general.rallyCooldown--;
      return;
    }

    const target = general.rallyTargetId
      ? GS.units.find((u) => u.id === general.rallyTargetId && u.hp > 0 && u.demoralized)
      : null;

    if (!target) {
      general.rallyTargetId = null;
      const next = findDemoralizedTroop(general);
      if (!next) {
        general.w2wBuffTimer = Math.max(0, (general.w2wBuffTimer || 0) - 2);
        return;
      }
      if (general.stationedKeep) releaseFromKeep(general);
      general.rallyTargetId = next.id;
      // The General never hunts (canHunt is false); the rally walk is its own path.
      general.huntMode = false;
      general.manualOrder = false;
      general.combatTargetId = null;
      general.w2wBuffTimer = GENERAL_W2W_BUFF_TICKS;
      setUnitPath(general, next.x, next.y, next);
      showMessage('The General rallies his men — wall to wall!', 240);
      return;
    }

    general.w2wBuffTimer = GENERAL_W2W_BUFF_TICKS;
    const dist = unitDistance(general, target);
    if (dist <= GENERAL_RALLY_RANGE) {
      deliverWallToWall(general, target);
      return;
    }

    general.huntMode = false;
    general.pathRecalc = (general.pathRecalc || 0) - 1;
    const destShift =
      Math.hypot(target.x - (general.targetX ?? 0), target.y - (general.targetY ?? 0)) > 24;
    if (
      !general.path?.length ||
      general.pathRecalc <= 0 ||
      general.pathTargetId !== target.id ||
      destShift
    ) {
      general.pathRecalc = 28;
      setUnitPath(general, target.x, target.y, target);
    }
  }

  function decayMoraleWitnesses() {
    for (const u of GS.units) {
      if (u.hp <= 0 || !isMoraleCombatUnit(u)) continue;
      if ((u.witnessDeaths || 0) > 0) u.witnessDeaths = Math.max(0, u.witnessDeaths - 0.004);
      if (u.demoralized && u.team === 'player' && GS.wave < ACADEMY_ERA_WAVE) {
        u.demoralized = false;
      }
    }
  }

  return {
    bind,
    ALLY_MOVE_MARGIN,
    DRAGON_THEMED_STRIKES,
    ETERNAL_CRUSADE_MIN_FORTS,
    HUNT_HEAR_DIST,
    HUNT_LEASH_STRUCTURE_MULT,
    SURROUND_MIN_FILLED,
    SURROUND_RING_MELEE,
    SURROUND_SLOTS_MELEE,
    SURROUND_SLOTS_RANGED,
    applyWitnessDeath,
    canRideDown,
    checkDragonThemedBossKill,
    checkSoloHeroNamedBossKill,
    decayMoraleWitnesses,
    foeInHuntLeash,
    foeIsPastPost,
    getPursuitTarget,
    isCrowdedOut,
    isLeashed,
    isPursuableFoe,
    isPursuingEnemyStructure,
    isSweeping,
    pointInHuntLeash,
    recordPathImmortalIfEligible,
    restoreTroopMorale,
    retargetIfHunting,
    sanitizeUnitPursuit,
    triggerMoraleBreak,
    updateFleeingUnit,
    updateGeneralRallyMission,
    updateHuntSweep,
  };
})();
