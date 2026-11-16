/**
 * Per-unit AI: healers, builders, combat, flyers, enemies, cavalry.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameUnitAi = (() => {
  const {
    MELEE_STANDOFF,
    builderHasWork,
    countBuilderProjects,
    countPlayerWalls,
    getApproachPoint,
    getGfxQuality,
    inEnemyStructureAttackRange,
    isSiegeableStructure,
    playSfx,
    releaseCombatPursuit,
    spatialScratchQuery,
    svc,
    tryPlaceEnemyBuilding,
    unitDistance,
  } = GameCore;
  const GS = GameState;
  const { buildUpdateThrottleCtx, clampPos, invalidateObstacles, isSiegeWave, useSpatialQueries } =
    GameField;
  const { isHoldStance } = GameStance;
  const {
    isCrowdedOut,
    isPursuableFoe,
    isPursuingEnemyStructure,
    retargetIfHunting,
    sanitizeUnitPursuit,
  } = GameMorale;
  const { findCombatTarget, findNearestFoeInRange, fireWeapon } = GameCombat;
  const { findEnemyMoveTarget, findNearestPlayer, findPreferredPlayer, inAttackRange } =
    GameTargeting;
  const { followPath, orderMove, setUnitPath } = GameMovement;
  const { notifyVetStarEvent } = GameArmy;
  const { countEnemyEconomySites, finalizeBuild, onBuildingComplete, updateSiegeTower } =
    GameBuildings;
  const { isMarchingToKeep, isMarchingToOutpost, isMarchingToWallSlot } = GameGarrison;
  let ach, getEnemyAdvancePoint, isNightPhase, showMessage, siegeCtx;
  function bind(api) {
    ({ ach, getEnemyAdvancePoint, isNightPhase, showMessage, siegeCtx } = api);
  }

  function healerCoversTarget(target, excludeHealer) {
    for (const h of GS.units) {
      if (h === excludeHealer || h.hp <= 0 || h.combatType !== 'healer' || h.team !== target.team)
        continue;
      if (Math.hypot(h.x - target.x, h.y - target.y) >= h.range) continue;
      if (target.combatType === 'healer') {
        if (h.healTargetId === target.id) return true;
        continue;
      }
      return true;
    }
    return false;
  }

  function findHealTarget(healer) {
    const wounded = GS.units
      .filter((u) => u.team === healer.team && u.hp > 0 && u.hp < u.maxHp)
      .sort((a, b) => {
        const aPri = (a.combatType === 'healer' ? -0.5 : 0) + (a.retreatingToMed ? -0.35 : 0);
        const bPri = (b.combatType === 'healer' ? -0.5 : 0) + (b.retreatingToMed ? -0.35 : 0);
        return a.hp / a.maxHp + aPri - (b.hp / b.maxHp + bPri);
      });

    for (const candidate of wounded) {
      if (!healerCoversTarget(candidate, healer)) return candidate;
    }
    return null;
  }

  function updateHealer(unit) {
    if (unit.hp <= 0 || unit.fleeing || unit.combatType !== 'healer') return;
    if (unit.retreatingToMed || unit.atMedicalTent) return;

    if (unit.pinned) {
      unit.pinTimer--;
      if (unit.pinTimer <= 0) unit.pinned = false;
      return;
    }

    if (
      typeof isSpecialistLateAbilityUnlocked === 'function' &&
      isSpecialistLateAbilityUnlocked(unit) &&
      GS.updateTick % 200 === 0
    ) {
      const mendMult =
        (typeof SPECIALIST_LATE_ABILITIES !== 'undefined' &&
          SPECIALIST_LATE_ABILITIES.mass_mend?.healMult) ||
        0.6 * (typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2);
      let massHeal = 0;
      for (const ally of GS.units) {
        if (ally.team !== 'player' || ally.hp <= 0 || ally.id === unit.id) continue;
        if (unitDistance(unit, ally) > unit.range * 1.1) continue;
        if (ally.hp >= ally.maxHp * 0.92) continue;
        const h = Math.min(unit.healAmount * mendMult, ally.maxHp - ally.hp);
        ally.hp += h;
        massHeal += h;
      }
      if (massHeal > 0) {
        CombatFX.healPulse(unit.x, unit.y);
        svc('FloatingText').status(unit.x, unit.y, 'MASS MEND', '#80ffb0');
        notifyVetStarEvent(unit, trySpecialistRank(unit));
      }
    }

    const target = unit.manualOrder ? null : findHealTarget(unit);
    unit.healTargetId = target?.id ?? null;

    if (target) {
      const dist = Math.hypot(target.x - unit.x, target.y - unit.y);
      if (dist <= unit.range) {
        unit.path = [];
        unit.pathIndex = 0;
        unit.actionTimer--;
        if (unit.actionTimer <= 0) {
          const healed = Math.min(unit.healAmount, target.maxHp - target.hp);
          target.hp = Math.min(target.maxHp, target.hp + unit.healAmount);
          unit.actionTimer = 70;
          unit.animState = 'attack';
          unit.attackAnimTimer = 12;
          playSfx('heal');
          globalThis.ProjectileArt?.mote?.('heal', unit.x, unit.y, target.x, target.y);
          CombatFX.healPulse(target.x, target.y);
          if (healed > 0) {
            svc('FloatingText').heal(target.x, target.y, healed);
            notifyVetStarEvent(unit, trySpecialistRank(unit));
          }
        }
        return;
      }

      if (!unit.manualOrder) {
        unit.pathRecalc = (unit.pathRecalc || 0) - 1;
        if (unit.pathRecalc <= 0) {
          unit.pathRecalc = 30;
          const standoff = Math.min(unit.range * 0.75, 70);
          const ap = getApproachPoint(unit, target, standoff);
          setUnitPath(unit, ap.x, ap.y);
        }
      }
    } else if (unit.team === 'enemy') {
      // Nobody to mend: an enemy healer follows the host down the field instead of
      // standing where it spawned (which left a wave unfinishable once the rest had died).
      unit.pathRecalc = (unit.pathRecalc || 0) - 1;
      if (unit.pathRecalc <= 0 || !unit.path?.length) {
        unit.pathRecalc = 45;
        const alone = !GS.units.some(
          (o) => o.team === 'enemy' && o.hp > 0 && o !== unit && o.combatType !== 'healer'
        );
        if (alone && SiegeLoop.unopposedBreaks(siegeCtx)) unit.lineBreaker = true;
        const adv = unit.lineBreaker
          ? SiegeLoop.breachGoal(unit, siegeCtx)
          : getEnemyAdvancePoint(unit);
        if (Math.hypot(adv.x - unit.x, adv.y - unit.y) > 12) setUnitPath(unit, adv.x, adv.y);
      }
    } else if (!unit.manualOrder) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.animState = 'idle';
    }
  }

  /**
   * Pick a live builder for a job. Prefer a specific unit (e.g. who finished a march),
   * then nearest free capacity. Previously always used units.find first builder, so
   * multi-builder armies never handed work to the second crew.
   */
  function pickBuilderForJob(wx, wy, opts = {}) {
    const prefer = opts.preferUnit || null;
    if (prefer && prefer.team === 'player' && prefer.type === 'builder' && prefer.hp > 0) {
      if (opts.ignoreCap || countBuilderProjects(prefer) < BUILDER_MAX_PROJECTS) return prefer;
    }
    let best = null;
    let bestScore = Infinity;
    for (const u of GS.units) {
      if (u.team !== 'player' || u.type !== 'builder' || u.hp <= 0) continue;
      const projects = countBuilderProjects(u);
      if (projects >= BUILDER_MAX_PROJECTS) continue;
      const d = wx != null && wy != null ? Math.hypot(u.x - wx, u.y - wy) : 0;
      // Prefer idle/low queue, then closer to site.
      const score = d + projects * 220;
      if (score < bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return best;
  }

  function findRepairTarget(builder) {
    let best = null,
      bestScore = Infinity;
    for (const b of GS.buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0 || b.hp >= b.maxHp) continue;
      const ratio = b.hp / b.maxHp;
      if (ratio > 0.92) continue;
      const d = Math.hypot(b.x - builder.x, b.y - builder.y);
      let score = d + (1 - ratio) * -200;
      if (b.type === 'wall') score -= isSiegeWave() ? 80 : 35;
      if (b.isHamlet) score -= 45;
      if (isNightPhase()) score -= 60;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  function builderMarchTo(unit, tx, ty) {
    const dist = Math.hypot(unit.x - tx, unit.y - ty);
    if (dist <= unit.buildRange) return false;
    if (builderHasWork(unit)) unit.manualOrder = false;
    unit.pathRecalc = (unit.pathRecalc || 0) - 1;
    const destMoved = unit.targetX == null || Math.hypot(tx - unit.targetX, ty - unit.targetY) > 12;
    const needsPath =
      !unit.path?.length || unit.pathRecalc <= 0 || destMoved || (unit.pathStuck || 0) > 3;
    if (needsPath) {
      unit.pathRecalc = 22;
      unit.pathStuck = 0;
      orderMove(unit, tx, ty, false);
    }
    if (unit.attackAnimTimer <= 0) followPath(unit);
    return true;
  }

  function updateBuilder(unit) {
    if (unit.type !== 'builder' || unit.hp <= 0) return;
    if (unit.retreatingToMed || unit.atMedicalTent) return;
    if (unit.manualOrder && !builderHasWork(unit)) return;
    if (builderHasWork(unit)) unit.manualOrder = false;

    if (!unit.buildQueue) unit.buildQueue = [];
    unit.hazardSlow = 1;
    if (unit.hazardBurnTick > 0) unit.hazardBurnTick--;

    if (
      GS.builderAutoRepair &&
      !unit.building &&
      unit.buildQueue.length === 0 &&
      countBuilderProjects(unit) < BUILDER_MAX_PROJECTS
    ) {
      const repair = findRepairTarget(unit);
      if (repair && !unit.repairTarget) unit.repairTarget = repair;
    }

    if (unit.repairTarget) {
      const rt = unit.repairTarget;
      if (!rt.complete || rt.hp <= 0 || rt.hp >= rt.maxHp) {
        unit.repairTarget = null;
      } else if (builderMarchTo(unit, rt.x, rt.y)) {
        return;
      } else {
        unit.animState = 'attack';
        notifyVetStarEvent(unit, trySpecialistRank(unit));
        rt.hp = Math.min(rt.maxHp, rt.hp + getBuilderBuildTicks(unit, true));
        if (rt.hp >= rt.maxHp) {
          unit.repairTarget = null;
          svc('Particles').dust(rt.x, rt.y);
        }
        if (
          typeof isSpecialistLateAbilityUnlocked === 'function' &&
          isSpecialistLateAbilityUnlocked(unit)
        ) {
          const repairDef =
            typeof SPECIALIST_LATE_ABILITIES !== 'undefined'
              ? SPECIALIST_LATE_ABILITIES.rapid_repair
              : null;
          const cool = typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2;
          const chance = repairDef?.procChance ?? 0.02 * cool;
          const patchFrac = repairDef?.patchHpFrac ?? 0.08 * cool;
          if ((globalThis.simRandom || Math.random)() < chance) {
            rt.hp = Math.min(rt.maxHp, rt.hp + rt.maxHp * patchFrac);
            svc('FloatingText').status(rt.x, rt.y, 'PATCH', '#80c0ff');
          }
        }
        return;
      }
    }

    if (unit.building?.pending) {
      const site = unit.building;
      if (builderMarchTo(unit, site.x, site.y)) return;
      // Throttle re-attempts so "Not enough TP/space" does not toast every tick.
      if ((unit.pendingBuildRetry || 0) > 0) {
        unit.pendingBuildRetry--;
        return;
      }
      // Free this builder's pending slot so capacity check in finalizeBuild can succeed,
      // then re-assign the real structure to THIS crew (not units.find first builder).
      unit.building = null;
      const ok = finalizeBuild(site.type, site.x, site.y, {
        ...(site.facing ? { facing: site.facing } : {}),
        builder: unit,
        keepSelection: true,
      });
      if (!ok) {
        // Keep the order if TP/space failed at arrival — retry after a short wait.
        unit.building = site;
        unit.pendingBuildRetry = 45;
        unit.pendingBuildFailTicks = (unit.pendingBuildFailTicks || 0) + 1;
        if (unit.pendingBuildFailTicks >= 8) {
          unit.building = null;
          unit.pendingBuildRetry = 0;
          unit.pendingBuildFailTicks = 0;
          showMessage(
            `Build cancelled — still blocked or not enough TP for ${BuildDefs[site.type]?.name || 'structure'}.`,
            240
          );
        }
      } else {
        unit.pendingBuildRetry = 0;
        unit.pendingBuildFailTicks = 0;
      }
      return;
    }

    if (!unit.building && unit.buildQueue.length > 0) {
      unit.building = unit.buildQueue.shift();
    }

    const b = unit.building;
    if (!b || b.complete) return;

    if (b.compound) {
      if (builderMarchTo(unit, b.x, b.y)) return;
      unit.animState = 'attack';
      notifyVetStarEvent(unit, trySpecialistRank(unit));
      const ticks = getBuilderBuildTicks(unit);
      b.buildProgress += ticks;
      for (const p of b.parts) p.buildProgress = b.buildProgress;
      if (b.buildProgress >= b.buildTime) {
        // Defer obstacle invalidation until all parts finish — avoid 11× path/grid rebuilds.
        for (const p of b.parts) {
          p.complete = true;
          onBuildingComplete(p, { compound: true, skipInvalidate: true });
          svc('Particles').dust(p.x, p.y);
        }
        invalidateObstacles();
        ach('building_complete', {
          buildType: 'castle',
          compound: true,
          wallCount: countPlayerWalls(),
        });
        unit.building = null;
        showMessage('Castle compound complete — station your General to man the walls!');
      }
      return;
    }

    if (builderMarchTo(unit, b.x, b.y)) return;
    unit.animState = 'attack';
    notifyVetStarEvent(unit, trySpecialistRank(unit));
    b.buildProgress += getBuilderBuildTicks(unit);
    if (b.buildProgress >= b.buildTime) {
      b.complete = true;
      // An upgrade's scaffolding is consumed (and its record recycled) inside the hook.
      const doneName = BuildDefs[b.type]?.name || 'Building';
      const consumed = !!b.isOutpostUpgrade;
      onBuildingComplete(b);
      invalidateObstacles();
      unit.building = null;
      if (!consumed) showMessage(`${doneName} complete!`);
      svc('Particles').dust(b.x, b.y);
    }
  }

  function updateUnitCombat(unit) {
    if (
      unit.hp <= 0 ||
      unit.fleeing ||
      unit.demoralized ||
      unit.combatType === 'builder' ||
      unit.combatType === 'courier'
    )
      return;
    const medWaiting = !!unit.medQueued && !!unit.retreatingToMed && !unit.atMedicalTent;
    if ((unit.retreatingToMed || unit.atMedicalTent) && !medWaiting) return;
    if (isMarchingToOutpost(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit)) return;

    if (unit.pinned) {
      unit.pinTimer--;
      if (unit.pinTimer <= 0) unit.pinned = false;
      return;
    }

    if (unit.combatType === 'healer') return;

    // Manual click-to-move / hold post: fire at targets in range, never chase off station.
    // Hold posts return via updateHoldPosts; combat must not repath them away.
    if (unit.manualOrder || medWaiting || isHoldStance(unit)) {
      // Prefer enemies in range from the assigned post when planted.
      const foe = findCombatTarget(unit);
      if (foe && isPursuableFoe(unit, foe) && inAttackRange(unit, foe)) {
        unit.combatTargetId = foe.id;
        unit.actionTimer = (unit.actionTimer || 0) - 1;
        if (unit.actionTimer <= 0 && unit.attackAnimTimer <= 0) {
          fireWeapon(unit, foe);
          const baseCd =
            getAttackBaseTicks(unit.experience) +
            Math.floor((globalThis.simRandom || Math.random)() * 20);
          unit.actionTimer = Math.max(
            12,
            Math.floor((baseCd * (unit.reloadMult || 1)) / (unit.attackSpeedMult || 1))
          );
        }
      } else {
        unit.combatTargetId = null;
      }
      return;
    }

    sanitizeUnitPursuit(unit);
    const target = findCombatTarget(unit);
    if (!target || !isPursuableFoe(unit, target)) {
      if (isPursuingEnemyStructure(unit)) {
        unit.combatTargetId = null;
        return;
      }
      releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
      unit.actionTimer = 8;
      retargetIfHunting(unit);
      return;
    }
    if (inAttackRange(unit, target)) {
      unit.combatTargetId = target.id;
      unit.path = [];
      unit.pathIndex = 0;
      unit.pathTargetId = null;
      unit.actionTimer--;
      if (unit.actionTimer <= 0) {
        fireWeapon(unit, target);
        const baseCd =
          getAttackBaseTicks(unit.experience) +
          Math.floor((globalThis.simRandom || Math.random)() * 20);
        unit.actionTimer = Math.max(
          12,
          Math.floor((baseCd * (unit.reloadMult || 1)) / (unit.attackSpeedMult || 1))
        );
      }
      return;
    }

    unit.actionTimer--;
    if (unit.actionTimer > 0) return;

    unit.combatTargetId = target.id;

    const fightingNeutral = target.team === 'neutral' || target.isNeutral;
    // Neutrals near map edges: always close in (surround logic false-positives on borders).
    if (unit.team === 'player' && !fightingNeutral && isCrowdedOut(unit, target)) {
      releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
      unit.actionTimer = 10;
      retargetIfHunting(unit);
    } else if (unit.huntMode || fightingNeutral) {
      const targetMoved =
        unit.pathTargetId !== target.id ||
        Math.hypot(target.x - (unit.targetX ?? 0), target.y - (unit.targetY ?? 0)) > 30;
      if (!unit.path?.length || targetMoved) setUnitPath(unit, target.x, target.y, target);
      unit.actionTimer = 12;
    } else {
      unit.actionTimer = 20;
    }
  }

  /**
   * Flyers ignore terrain and go straight at what they want: the line if they are
   * line-breakers, support troops if they are raiders, otherwise the nearest soldier.
   * They used to drift to a fixed hover point and wait there, which could stall a wave.
   */
  function updateFlyerAI(unit) {
    if (unit.pinned || unit.attackAnimTimer > 0) return;
    let dest = null;
    if (!unit.lineBreaker) {
      const prey =
        (typeof HostTactics !== 'undefined' && HostTactics.preyFor(unit)) ||
        (Roster.preference(unit) === 'support' && findPreferredPlayer(unit, Roster.isSupport)) ||
        findNearestPlayer(unit);
      if (prey) {
        unit.combatTargetId = prey.id;
        if (inAttackRange(unit, prey)) {
          unit.animState = 'idle';
          return;
        }
        dest = prey;
      } else if (SiegeLoop.unopposedBreaks(siegeCtx)) {
        unit.lineBreaker = true;
      } else {
        dest = getEnemyAdvancePoint(unit);
      }
    }
    if (!dest) dest = SiegeLoop.breachGoal(unit, siegeCtx);
    const dx = dest.x - unit.x;
    const dy = dest.y - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    const step = Math.min(dist, unit.speed);
    const pos = clampPos(unit.x + (dx / dist) * step, unit.y + (dy / dist) * step);
    unit.x = pos.x;
    unit.y = pos.y;
    unit.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
    unit.animState = 'walk';
  }

  const ENEMY_ENGINEER_WORKS = false;

  function updateEnemyAI(unit) {
    if (unit.hp <= 0) return;
    // A tactic that moves this enemy itself (a dash down the field edge).
    if (unit.dash && typeof HostTactics !== 'undefined' && HostTactics.drive(unit, siegeCtx))
      return;
    if (unit.flying && unit.combatType !== 'siege' && GS.state === 'playing' && !GS.creativeMode) {
      updateFlyerAI(unit);
      return;
    }
    if (svc('ContentExpansion') && svc('ContentExpansion').updateEnemyAI(unit)) return;
    if (unit.type === 'siege_tower' && updateSiegeTower(unit)) return;
    // Healers move in updateHealer. Enemy builders (Goblin Engineer) march with the host:
    // they used to return here and stand at the map edge for good, so a wave whose last
    // enemy was an engineer never ended.
    if (unit.combatType === 'healer') return;
    if (unit.pinned) return;

    // An enemy storming the line does not stop to trade blows.
    const foeInRange = unit.stormLine ? null : findNearestFoeInRange(unit);
    if (foeInRange) {
      unit.combatTargetId = foeInRange.id;
      // Skirmishers give ground when a soldier closes in, then turn and shoot again.
      const kiteD = Roster.kiteDistance(unit);
      if (kiteD > 0 && unit.attackAnimTimer <= 0) {
        unit.kiteCd = (unit.kiteCd || 0) - 1;
        const gap = unitDistance(unit, foeInRange);
        if (gap < kiteD && unit.kiteCd <= 0) {
          const away = clampPos(
            unit.x + ((unit.x - foeInRange.x) / Math.max(1, gap)) * 70,
            unit.y + ((unit.y - foeInRange.y) / Math.max(1, gap)) * 70
          );
          unit.kiteCd = 150;
          if (setUnitPath(unit, away.x, away.y)) {
            unit.pathTargetId = 'kite';
            unit.kiteMove = 40;
          }
        }
        if ((unit.kiteMove || 0) > 0 && unit.path?.length) {
          unit.kiteMove--;
          followPath(unit);
          return;
        }
      }
      if (inAttackRange(unit, foeInRange)) {
        unit.path = [];
        unit.pathIndex = 0;
        unit.animState = 'idle';
        return;
      }
    }

    if (!foeInRange && unit.attackAnimTimer <= 0 && !unit.stormLine) {
      const siegeScanR =
        (unit.meleeRange || MELEE_STANDOFF) + getBuildingHitRadius({ radius: 30 }) + 48;
      if (useSpatialQueries()) {
        const nearBld = spatialScratchQuery(
          unit.x,
          unit.y,
          siegeScanR,
          (e) => e.kind === 'building' && isSiegeableStructure(e.ref)
        );
        for (let bi = 0; bi < nearBld.length; bi++) {
          const b = nearBld[bi];
          if (inEnemyStructureAttackRange(unit, b)) {
            unit.path = [];
            unit.pathIndex = 0;
            unit.pathTargetId = null;
            unit.animState = 'idle';
            return;
          }
        }
      } else {
        for (const b of GS.buildings) {
          if (!isSiegeableStructure(b)) continue;
          if (inEnemyStructureAttackRange(unit, b)) {
            unit.path = [];
            unit.pathIndex = 0;
            unit.pathTargetId = null;
            unit.animState = 'idle';
            return;
          }
        }
      }
    }

    if (unit.attackAnimTimer > 0) return;

    // Engineer field works (barricades, raid trade posts) never ran while engineers stood
    // still. They stay off until the owner decides whether enemy structures come back.
    if (ENEMY_ENGINEER_WORKS && unit.type === 'goblin_engineer') {
      if ((globalThis.simRandom || Math.random)() < 0.004) {
        GS.decorations.push({
          type: 'barricade',
          x: unit.x,
          y: unit.y + 20,
          size: 16,
          hp: 60,
          blocksMove: true,
          blocksLOS: true,
          cover: 0.4,
          radius: 16,
        });
        invalidateObstacles();
      }
      if (GS.wave >= 10) {
        unit.econBuildCd = (unit.econBuildCd ?? 200) - 1;
        if (unit.econBuildCd <= 0) {
          const tradeCap = 1 + Math.floor((GS.wave - 10) / 20);
          const placed =
            countEnemyEconomySites('enemy_trade_outpost') < tradeCap &&
            tryPlaceEnemyBuilding('enemy_trade_outpost', unit.x, unit.y);
          unit.econBuildCd = placed ? 280 : 70;
          if (placed) svc('FloatingText').status(unit.x, unit.y, 'RAID TRADE', '#ff6060');
        }
      }
    }

    sanitizeUnitPursuit(unit);
    let moveTarget = findEnemyMoveTarget(unit);
    let target = moveTarget.kind === 'unit' ? moveTarget.target : null;
    let buildTarget = moveTarget.kind === 'building' ? moveTarget.target : null;
    if (target && !isPursuableFoe(unit, target)) {
      releaseCombatPursuit(unit);
      moveTarget = findEnemyMoveTarget(unit);
      target = moveTarget.kind === 'unit' ? moveTarget.target : null;
      buildTarget = moveTarget.kind === 'building' ? moveTarget.target : null;
    }
    unit.combatTargetId = target?.id ?? null;

    unit.pathRecalc = (unit.pathRecalc || 0) - 1;
    const pathKey = target?.id ?? buildTarget?.id ?? 'advance';
    let destX,
      destY,
      destUnit = null;

    if (buildTarget) {
      destX = buildTarget.x;
      destY = buildTarget.y;
    } else if (target) {
      destUnit = target;
      destX = target.x;
      destY = target.y;
    } else {
      // Nothing left to fight: the enemy walks through the line.
      if (!unit.lineBreaker && SiegeLoop.unopposedBreaks(siegeCtx)) unit.lineBreaker = true;
      const adv = unit.lineBreaker
        ? SiegeLoop.breachGoal(unit, siegeCtx)
        : getEnemyAdvancePoint(unit);
      destX = adv.x;
      destY = adv.y;
    }

    const destShift = target
      ? Math.hypot(target.x - (unit.targetX ?? 0), target.y - (unit.targetY ?? 0)) > 30
      : buildTarget
        ? Math.hypot(buildTarget.x - (unit.targetX ?? 0), buildTarget.y - (unit.targetY ?? 0)) > 35
        : Math.hypot(destX - (unit.targetX ?? 0), destY - (unit.targetY ?? 0)) > 25;

    const needPath =
      !unit.path?.length ||
      unit.pathRecalc <= 0 ||
      unit.pathTargetId !== pathKey ||
      destShift ||
      (unit.pathPending && !unit.path?.length);

    if (needPath) {
      const gfxQ = getGfxQuality();
      const throttle = svc('UpdateThrottle');
      const tier = throttle
        ? throttle.getUnitTier(
            unit,
            GS.updateThrottleCtx || buildUpdateThrottleCtx(GS.units.length, gfxQ)
          )
        : 'full';
      const recalcInterval = throttle ? throttle.pathRecalcInterval(tier, gfxQ) : 40;
      let pathed = false;
      if (buildTarget) {
        pathed = setUnitPath(unit, destX, destY, null, {
          buildingId: buildTarget.id,
          force: true,
        });
        if (pathed) unit.pathTargetId = `bld:${buildTarget.id}`;
      } else if (destUnit) pathed = setUnitPath(unit, destX, destY, destUnit);
      else {
        pathed = setUnitPath(unit, destX, destY);
        if (pathed) unit.pathTargetId = 'advance';
      }
      unit.pathRecalc = pathed ? recalcInterval : Math.min(recalcInterval, 10);
    }

    followPath(unit);
  }

  function updateCavalryCharge(unit) {
    if (unit.combatType !== 'cavalry' || unit.hp <= 0 || unit.garrisoned) return;
    const fighting =
      unit.combatTargetId &&
      GS.units.some((u) => u.id === unit.combatTargetId && u.hp > 0 && inAttackRange(unit, u));
    const prev = unit.chargeTimer || 0;
    if (unit.animState === 'walk' && !fighting && unit.path?.length) {
      unit.chargeTimer = Math.min(90, prev + 1);
      // Thunder of hooves once charge is up (throttle per unit via flag).
      if (prev < 42 && unit.chargeTimer >= 42 && !unit._chargeSfx) {
        unit._chargeSfx = true;
        playSfx('horseCharge');
      }
    } else {
      unit.chargeTimer = Math.max(0, prev - 3);
      if (unit.chargeTimer < 20) unit._chargeSfx = false;
    }
  }

  return {
    bind,
    pickBuilderForJob,
    updateBuilder,
    updateCavalryCharge,
    updateEnemyAI,
    updateHealer,
    updateUnitCombat,
  };
})();
