/**
 * General aura, damage rolls, taking damage and firing weapons.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameCombat = (() => {
  const {
    getGeneralBuffStrengthLegacy,
    getMedicalTentSlot,
    isMajorBossUnit,
    isMeleeCombat,
    isMoraleCombatUnit,
    isValidCombatFoe,
    moraleBreakThreshold,
    playSfx,
    posDistSq,
    sampleKiEnergyArmy,
    svc,
    unitCounts,
    unitDistSq,
    unitDistance,
  } = GameCore;
  const GS = GameState;
  const {
    clampPos,
    getBiomeModifiersAt,
    getCoverAt,
    getWallProtection,
    lineOfSight,
    sanitizeTactical,
    useSpatialQueries,
  } = GameField;
  const {
    applyWitnessDeath,
    checkDragonThemedBossKill,
    checkSoloHeroNamedBossKill,
    isPursuableFoe,
    restoreTroopMorale,
    triggerMoraleBreak,
  } = GameMorale;
  let CAMPAIGN_VICTORY_WAVE,
    ach,
    findNearestAttackableEnemyBuilding,
    findTacticalTarget,
    floatStatus,
    getBuildingPursuitTarget,
    getEffectiveRange,
    getEnemyStructureSeekDist,
    getSightPenaltyForUnit,
    getStationedCastleGroup,
    getUnitById,
    inAttackRange,
    isDayPhase,
    isEnemyHiddenByFog,
    maxAttackRange,
    notifyVetStarEvent,
    onNamedBossSlain,
    releaseFromGarrison,
    releaseFromKeep,
    shouldPrioritizeEnemyStructure,
    showMessage,
    siegeCtx,
    tryHealerMedicalRetreat,
    tryMedicalRetreat,
    uiHooks,
    warCampCtx;
  function bind(api) {
    ({
      CAMPAIGN_VICTORY_WAVE,
      ach,
      findNearestAttackableEnemyBuilding,
      findTacticalTarget,
      floatStatus,
      getBuildingPursuitTarget,
      getEffectiveRange,
      getEnemyStructureSeekDist,
      getSightPenaltyForUnit,
      getStationedCastleGroup,
      getUnitById,
      inAttackRange,
      isDayPhase,
      isEnemyHiddenByFog,
      maxAttackRange,
      notifyVetStarEvent,
      onNamedBossSlain,
      releaseFromGarrison,
      releaseFromKeep,
      shouldPrioritizeEnemyStructure,
      showMessage,
      siegeCtx,
      tryHealerMedicalRetreat,
      tryMedicalRetreat,
      uiHooks,
      warCampCtx,
    } = api);
  }

  function findPlayerGeneral() {
    let best = null;
    for (const u of GS.units) {
      if (u.team !== 'player' || u.hp <= 0 || !u.isGeneral) continue;
      best = u;
      break;
    }
    return best;
  }

  function getStationedGeneral() {
    for (const u of GS.units) {
      if (u.team === 'player' && u.hp > 0 && u.isGeneral && u.stationedKeep) return u;
    }
    return null;
  }

  function getGeneralAura() {
    refreshAuraCache();
    if (GS.auraCache.aura) return GS.auraCache.aura;
    const gen = unitCounts.stationedGeneral;
    const str = gen ? getGeneralBuffStrengthLegacy(gen) : 0;
    return {
      strength: str,
      morale: 0.04 * str,
      accuracy: 18 * str,
      meleeDmg: 0.45 * str,
      rangedDmg: 0.38 * str,
      mitigation: 0.2 * str,
      compoundBonus: 0,
      radius: 150,
    };
  }

  function getGeneralBuffStrength() {
    return getGeneralAura().strength;
  }

  function refreshAuraCache() {
    if (GS.auraCacheFrame === GS.updateTick) return;
    GS.auraCacheFrame = GS.updateTick;
    const gen = unitCounts.stationedGeneral;
    if (!gen) {
      GS.auraCache = { gen: null, aura: null, r2: 0 };
      return;
    }
    const aura =
      svc('GameDepth') && svc('GameDepth').getGeneralAuraBreakdown
        ? svc('GameDepth').getGeneralAuraBreakdown(gen)
        : (() => {
            const str = getGeneralBuffStrengthLegacy(gen);
            return {
              strength: str,
              morale: 0.04 * str,
              accuracy: 18 * str,
              meleeDmg: 0.45 * str,
              rangedDmg: 0.38 * str,
              mitigation: 0.2 * str,
              compoundBonus: 0,
              radius: 150,
            };
          })();
    const r = aura.radius || 150;
    GS.auraCache = { gen, aura, r2: r * r };
  }

  function isInGeneralAura(unit) {
    refreshAuraCache();
    if (!GS.auraCache.gen) return false;
    const dx = unit.x - GS.auraCache.gen.x;
    const dy = unit.y - GS.auraCache.gen.y;
    return dx * dx + dy * dy <= GS.auraCache.r2;
  }

  function applyGeneralAura() {
    const aura = getGeneralAura();
    if (aura.strength <= 0) return;
    const groupId = getStationedCastleGroup();
    for (const u of GS.units) {
      if (u.team !== 'player' || u.hp <= 0 || u.isGeneral || u.demoralized) continue;
      if (!isInGeneralAura(u)) continue;
      u.morale = Math.min(u.maxMorale, u.morale + aura.morale);
      if (groupId && GameDepth?.isInsideCastleGroup(u, GS.buildings, groupId)) {
        u.morale = Math.min(u.maxMorale, u.morale + aura.compoundBonus * 0.5);
      }
    }
  }

  function calcDamage(unit, target, baseRand = 10) {
    let dmg = unit.damage + Math.floor(Math.random() * baseRand);
    dmg += getExperienceDamageBonus(unit.experience);
    dmg += (unit.vetTier || 0) * DIFFICULTY_TUNING.tierFlatDamage;
    if (unit.team === 'player' && !unit.isGeneral && isInGeneralAura(unit)) {
      const aura = getGeneralAura();
      const typeMult =
        unit.combatType === 'ranged' || unit.projectile ? aura.rangedDmg : aura.meleeDmg;
      dmg = Math.round(dmg * (1 + typeMult));
    }
    if (GS.lastStandActive && unit.team === 'player') {
      dmg = Math.round(dmg * (GameDepth?.lastStandDamageMult(true) || 1.28));
    }
    if (unit.combatType === 'cavalry' && unit.chargeTimer > 0) dmg *= 1.55;
    if (unit.rallyTimer > 0) dmg *= 1.12;
    if (unit.doctrineDmgMult > 1 && (unit.doctrineDmgTimer || 0) > 0) dmg *= unit.doctrineDmgMult;
    if (unit.isGeneral && (unit.w2wBuffTimer || 0) > 0) dmg *= 1.75;
    if (
      (unit.type === 'war_chief' || unit.type === 'behemoth' || unit.isNamedBoss) &&
      unit.hp / unit.maxHp < 0.4
    ) {
      dmg = Math.round(dmg * 1.35);
    }
    if (target) {
      dmg = SiegeLoop.modifyDamage(unit, target, dmg, GS.updateTick);
      dmg = Roster.modifyDamage(unit, target, dmg, siegeCtx);
    }
    if (svc('ContentExpansion')) dmg = svc('ContentExpansion').modifyCalcDamage(unit, target, dmg);
    if (svc('StrategyCounterplay')) {
      dmg = svc('StrategyCounterplay').modifyDamage(unit, target, dmg);
    }
    if (svc('FactionDepth') && (unit.isCrossover || unit.isWwe)) {
      dmg = svc('FactionDepth').modifyDamage(unit, target, dmg);
    }
    if (svc('CompanyTraining') && (unit.isCrossover || unit.isWwe)) {
      dmg = svc('CompanyTraining').modifyDamage(unit, target, dmg);
    }
    if (
      svc('FactionDepth') &&
      target?.team === 'player' &&
      (target.isCrossover || target.isWwe || target.isDoomslayer)
    ) {
      dmg = svc('FactionDepth').modifyDamageTaken(target, unit, dmg);
    }
    if (
      svc('CompanyTraining') &&
      target?.team === 'player' &&
      (target.isCrossover || target.isWwe)
    ) {
      dmg = svc('CompanyTraining').modifyDamageTaken(target, dmg);
    }
    if (svc('DynamicMapEvents')) {
      dmg = Math.round(dmg * svc('DynamicMapEvents').getCombatDamageMult(unit));
    }
    if (unit.team === 'player' && !GS.creativeMode) {
      if (svc('CrownLegacies')) {
        dmg = Math.round(dmg * (svc('CrownLegacies').getCombinedEffects().playerDmgMult || 1));
      }
      if (typeof EternalLegacyTree !== 'undefined') {
        dmg = Math.round(
          dmg * (EternalLegacyTree.getCombinedEffects(null, GS.wave).playerDmgMult || 1)
        );
      }
      if (typeof FoundationalMedievalLayer !== 'undefined') {
        const fmods = FoundationalMedievalLayer.getRunModifiers(GS.wave);
        if (unit.type === 'archer' && fmods.archerDmgMult > 1) {
          dmg = Math.round(dmg * fmods.archerDmgMult);
        }
      }
    }
    if (unit.team === 'player' && svc('GameDepth') && svc('GameDepth').isVanillaAlly(unit)) {
      let obsoleteMult = svc('GameDepth').getVanillaObsoleteMult(unit, GS.wave);
      dmg = Math.round(dmg * obsoleteMult);
    }
    const out = Math.round(dmg);
    return Number.isFinite(out) && out > 0 ? out : 1;
  }

  /**
   * Stretcher bearers: once per wave, a soldier struck down near a Medical Tent is carried
   * in alive instead of dying.
   */
  function tryStretcherSave(unit) {
    if (typeof EconomyRules === 'undefined' || !unit || unit.team !== 'player') return false;
    if (unit.isDoomslayer || unit.isGeneral || !isDayPhase() || GS.creativeMode) return false;
    const tent = EconomyRules.claimStretcher(unit.x, unit.y, GS.buildings, GS.wave);
    if (!tent) return false;
    const r = EconomyRules.BUILDINGS.medical_tent;
    releaseFromGarrison(unit);
    unit.hp = Math.max(1, Math.ceil(unit.maxHp * r.saveHp));
    const slot = getMedicalTentSlot(tent);
    unit.x = slot.x;
    unit.y = slot.y;
    unit.path = [];
    unit.pathIndex = 0;
    unit.combatTargetId = null;
    unit.structureTargetId = null;
    unit.fleeing = false;
    unit.pinned = false;
    unit.fightToDeath = false;
    unit.stretcherSaves = (unit.stretcherSaves || 0) + 1;
    tryMedicalRetreat(unit, { silent: true });
    const name = typeof getUnitDisplayName === 'function' ? getUnitDisplayName(unit) : unit.type;
    ach('tally', { k: 'medSaves' });
    svc('FloatingText')?.status?.(tent.x, tent.y - 24, 'SAVED', '#80ffa0');
    showMessage(`${name} was carried to the medical tent alive.`, 220);
    return true;
  }

  function findNearestFoeInRange(unit) {
    const maxR = maxAttackRange(unit) + (isMeleeCombat(unit) ? 4 : 0);
    if (maxR <= 0) return null;
    let best = null;
    let bestD = Infinity;
    let foes;
    if (useSpatialQueries()) {
      svc('Spatial').queryFoesInto(unit.x, unit.y, maxR, unit.team, svc('Spatial')._scratch);
      foes = svc('Spatial')._scratch;
    } else {
      foes = GS.units;
    }
    for (const f of foes) {
      if (f.team === unit.team || !isValidCombatFoe(f)) continue;
      // Adjacent engagement was bypassing fog (combat while unit is invisible).
      if (unit.team === 'player' && isEnemyHiddenByFog(f)) continue;
      if (svc('ContentExpansion') && !svc('ContentExpansion').canTargetUnit(unit, f)) continue;
      const d = unitDistance(unit, f);
      if (d > maxR) continue;
      if (d < bestD && lineOfSight(unit.x, unit.y, f.x, f.y)) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  function findCombatTarget(unit) {
    const locked = unit.combatTargetId ? getUnitById(unit.combatTargetId) : null;
    if (locked && !isPursuableFoe(unit, locked)) unit.combatTargetId = null;
    const adjacent = findNearestFoeInRange(unit);
    if (adjacent) {
      unit.structureTargetId = null;
      return adjacent;
    }
    const seekDist = getEnemyStructureSeekDist(unit);
    const bld =
      getBuildingPursuitTarget(unit) ||
      (unit.huntMode ? findNearestAttackableEnemyBuilding(unit, seekDist) : null);
    const tactical = findTacticalTarget(unit);
    if (bld && unit.huntMode && shouldPrioritizeEnemyStructure(unit, tactical, bld)) {
      unit.combatTargetId = null;
      return null;
    }
    if (tactical) unit.structureTargetId = null;
    return tactical;
  }

  function takeDamage(unit, amount, opts = {}) {
    if (!unit || !(unit.hp > 0)) return 0;
    // Guard NaN/Infinity from broken damage chains (undefined unit.damage, etc.).
    amount = Number(amount);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if (unit.isDoomslayer && unit.team === 'player') amount *= 0.08;
    if (unit.isGeneral && (unit.w2wBuffTimer || 0) > 0) amount *= 0.42;
    if (unit.isWwe && unit.wweAbility === 'rope_dancers_leap' && Math.random() < 0.35) {
      svc('FloatingText').status(unit.x, unit.y, 'DODGE', '#80c0ff');
      return 0;
    }
    if (unit.isWwe && unit.wweAbility === 'sworn_stand' && unit.hp / unit.maxHp < 0.5)
      amount *= 0.55;
    let mitigation = 1 - getCoverAt(unit.x, unit.y) - getWallProtection(unit);
    if (unit.type === 'knight') mitigation -= 0.22;
    if (unit.team === 'player' && !unit.isGeneral && isInGeneralAura(unit)) {
      mitigation -= getGeneralAura().mitigation;
    }
    if (GS.lastStandActive && unit.team === 'player') {
      mitigation -= GameDepth?.lastStandMitBonus(true) || 0.22;
    }
    if (unit.rallyTimer > 0) mitigation -= 0.1;
    if ((unit.doctrineMitTimer || 0) > 0) mitigation -= unit.doctrineMitigation || 0.15;
    if (isEliteEnemy(unit) && unit.team === 'enemy') mitigation -= 0.08;
    const biomeMods = getBiomeModifiersAt(unit.x, unit.y);
    let actual = amount * Math.max(0.12, mitigation) * (biomeMods.damageTakenMult || 1);
    if (unit.team === 'player' && svc('DynamicMapEvents')) {
      actual *= svc('DynamicMapEvents').getActiveMods().playerDamageTakenMult || 1;
    }
    if (unit.team === 'player') actual = SiegeLoop.modifyDamageTaken(unit, actual, GS.updateTick);
    actual = Roster.modifyDamageTaken(unit, actual, opts, siegeCtx);
    actual *= Veterans.damageMult(opts.attacker, unit);
    if (!(actual > 0)) return 0;
    // Only blood drawn from the enemy counts as a fight in progress. An archer sniping
    // from out of reach must not hold a wave open forever, nor a stream of raised minions.
    if (actual > 0 && unit.team === 'enemy' && !unit.summoned) {
      SiegeLoop.noteCombat(GS.updateTick);
      GS.huntQuietTicks = 0; // an enemy was hurt: the army is not idle
    } else if (actual > 0 && unit.team === 'player') SiegeLoop.noteBlood(GS.updateTick);
    if (unit.team === 'player' && svc('CrownLegacies') && !GS.creativeMode) {
      actual *= svc('CrownLegacies').getCombinedEffects().damageTakenMult || 1;
    }
    if (unit.team === 'player' && typeof EternalLegacyTree !== 'undefined' && !GS.creativeMode) {
      actual *= EternalLegacyTree.getCombinedEffects(null, GS.wave).damageTakenMult || 1;
    }
    if (unit.team === 'enemy' && unit.isPlanetBoss && unit.damageTakenMult) {
      actual *= unit.damageTakenMult;
    }
    if (opts.attackerTeam === 'enemy' && biomeMods.enemyDamageMult > 1) {
      actual *= biomeMods.enemyDamageMult;
    }
    if (opts.dragonStrike && unit.team === 'enemy' && isMajorBossUnit(unit)) {
      unit.dragonStrikeHitWave = GS.wave;
    }
    // Impact Ward: ignore explosive/splash damage and retaliate once.
    if (
      unit.hasPhdFlopper &&
      unit.team === 'player' &&
      (opts.explosion || opts.splash || opts.elementalPop)
    ) {
      if ((unit.phdFlopperCd || 0) <= 0 && opts.attacker) {
        unit.phdFlopperCd = 90;
        const blast = Math.max(8, Math.round((unit.damage || 20) * 0.55));
        damageInRadius(unit.x, unit.y, 48, blast, 'player', { explosion: true });
        svc('FloatingText')?.status?.(unit.x, unit.y, 'WARD', '#80c0ff');
      }
      return 0;
    }
    if ((unit.phdFlopperCd || 0) > 0) unit.phdFlopperCd--;
    if (!Number.isFinite(actual) || actual <= 0) return 0;
    unit.hp -= actual;
    const crit = opts.crit || amount >= 45;
    const willDie = unit.hp <= 0;
    // Hit flash + micro knock for readability
    unit.hitFlash = Math.max(unit.hitFlash || 0, crit ? 10 : willDie ? 8 : actual >= 25 ? 7 : 5);
    unit.hitFlashMax = unit.hitFlash;
    if (
      opts.attacker &&
      Number.isFinite(opts.attacker.x) &&
      !unit.garrisoned &&
      !unit.stationedKeep &&
      !unit.atMedicalTent
    ) {
      const kdx = unit.x - opts.attacker.x;
      const kdy = unit.y - opts.attacker.y;
      const klen = Math.hypot(kdx, kdy) || 1;
      const knock = crit ? 2.8 : willDie ? 2.2 : Math.min(2.2, 0.6 + actual / 35);
      const kn = clampPos(unit.x + (kdx / klen) * knock, unit.y + (kdy / klen) * knock);
      unit.x = kn.x;
      unit.y = kn.y;
    }

    const fb = typeof GameFeedback !== 'undefined' ? GameFeedback : null;
    const showNums = !fb || fb.allowDamageNumbers();
    const allowGore = !fb || fb.allowGore();
    const allowShake = !fb || fb.allowShake();
    const allowHitStop = !fb || fb.allowHitStop();

    if (showNums) svc('FloatingText').damage(unit.x, unit.y, actual, crit, unit, opts);
    const bloodMult = crit ? 1.6 : willDie ? 1.4 : Math.min(1.8, 0.7 + actual / 30);
    if (allowGore && svc('Particles')) {
      if (opts.attacker && svc('Particles').bloodSpray) {
        const ang = Math.atan2(unit.y - opts.attacker.y, unit.x - opts.attacker.x);
        svc('Particles').bloodSpray(unit.x, unit.y, ang, bloodMult);
      } else {
        svc('Particles').blood(unit.x, unit.y, { mult: bloodMult });
      }
      if (actual >= 18) svc('Particles').impactDust?.(unit.x, unit.y, crit ? 1.4 : 1);
      if (crit) svc('Particles').critBurst?.(unit.x, unit.y);
    }
    if (CombatFX?.impact) {
      // Temporarily gate hit-stop via CombatFX when disabled
      if (!allowHitStop && (crit || willDie)) {
        CombatFX.hitSpark?.(unit.x, unit.y, {
          scale: crit ? 1.5 : 1.2,
          color: crit ? '#ff5050' : '#ffd060',
        });
      } else {
        CombatFX.impact(unit.x, unit.y, { damage: actual, crit, kill: willDie });
      }
    } else {
      CombatFX?.hitSpark?.(unit.x, unit.y);
    }

    // Audio tiers — throttled inside AudioEngine
    if (crit) playSfx('impact', 'crit');
    else if (willDie) playSfx('impact', 'kill');
    else if (actual >= 28) playSfx('impact', 'heavy');
    else if (actual >= 10) playSfx('impact', 'medium');
    else playSfx('impact', 'light');

    // Camera punch on meaningful hits
    if (allowShake && svc('VisualPolish')) {
      if (crit) {
        svc('VisualPolish').addKillPunch?.(0.28);
        svc('VisualPolish').addScreenShake(3.5);
      } else if (willDie && (isEliteEnemy(unit) || unit.isNamedBoss || unit.isPlanetBoss)) {
        svc('VisualPolish').addKillPunch?.(unit.isNamedBoss || unit.isPlanetBoss ? 0.55 : 0.32);
      } else if (actual >= 40) {
        svc('VisualPolish').addScreenShake(2.2);
      }
    }

    const nonCombat =
      unit.combatType === 'builder' ||
      unit.combatType === 'courier' ||
      unit.combatType === 'healer';
    if (
      !nonCombat &&
      !Roster.blocksPin(unit) &&
      !unit.isNamedBoss &&
      !(unit.team === 'enemy' && (unit.pinImmuneUntil || 0) > GS.updateTick) &&
      Math.random() * 100 > unit.morale + (unit.rallyTimer > 0 ? 15 : 0)
    ) {
      unit.pinned = true;
      unit.pinTimer = 50;
      // A volley can stop an enemy once; massed archers can no longer hold it in place forever.
      if (unit.team === 'enemy') unit.pinImmuneUntil = GS.updateTick + 290;
    }
    if (unit.hp <= 0 && unit.team === 'player' && tryStretcherSave(unit)) return actual;
    if (unit.hp <= 0) {
      unit.hp = 0;
      let quickRevived = false;
      unit.deathCause = Roster.deathCause(unit, opts, actual, GS.updateTick);
      playSfx(
        'deathVar',
        unit.deathCause === 'fall'
          ? isMajorBossUnit(unit) || isMonsterEnemy(unit)
            ? 'big'
            : 'small'
          : unit.deathCause
      );
      if (unit.team === 'neutral' || unit.isNeutral) {
        if (svc('NeutralWildlife')) {
          svc('NeutralWildlife').onSlain(unit, {
            units: GS.units,
            grantTp: (n) => {
              GS.tactical += n;
              sanitizeTactical();
            },
            hooks: {
              floatingText: floatStatus,
            },
          });
        }
        if (svc('NeutralRelations')) {
          svc('NeutralRelations').onWildlifeSlain(unit, {
            wave: GS.wave,
            units: GS.units,
            hooks: { showMessage },
          });
        }
      } else if (unit.team === 'enemy') {
        GS.kills++;
        // Prefer the unit that landed the killing blow (melee/ranged/projectile).
        // Fall back to whoever still has this foe locked as combat target.
        let killer =
          opts.attacker &&
          opts.attacker.team === 'player' &&
          opts.attacker.hp > 0 &&
          !opts.attacker.isNeutral
            ? opts.attacker
            : null;
        if (!killer) {
          killer = GS.units.find(
            (u) => u.combatTargetId === unit.id && u.team === 'player' && u.hp > 0
          );
        }
        if (typeof GameFeedback !== 'undefined') {
          const streakInfo = GameFeedback.onEnemyKilled(unit, {
            killerName: killer?.honorName || killer?.type,
            wave: GS.wave,
          });
          if (streakInfo?.label && streakInfo.streak >= 3 && streakInfo.streak < 18) {
            svc('FloatingText')?.status?.(unit.x, unit.y - 22, streakInfo.label, '#ff9060');
          }
        }
        if (svc('GameEvents')) {
          svc('GameEvents').emit(svc('GameEvents').GameEvent.ENEMY_SLAIN, { unit, wave: GS.wave });
        }
        SiegeLoop.onUnitDeath(unit, killer, siegeCtx);
        Roster.onDeath(unit, killer, siegeCtx);
        if (killer) {
          killer.experience =
            (killer.experience || 0) + DIFFICULTY_TUNING.xpPerKill + SiegeLoop.killXpBonus();
          if (svc('Legacy')) svc('Legacy').recordKill(killer.type, unit.type);
          if (typeof FoundationalMedievalLayer !== 'undefined') {
            FoundationalMedievalLayer.recordKill(killer.type, GS.wave);
          }
          notifyVetStarEvent(killer, addVetStar(killer));
          GameArmy.notifyTraits(killer, Veterans.recordKill(killer, unit, GS.wave));
          if (killer.hasVultureAid && Math.random() < 0.35) {
            GS.tactical += 1;
            svc('FloatingText').status(killer.x, killer.y, '+1 TP', '#c0ffa0');
          }
          ach('kill', {
            enemyType: unit.type,
            elite: isEliteEnemy(unit),
            killerType: killer.type,
            siege: unit.type === 'siege_tower' || unit.siegeDeployed,
            charging: killer.combatType === 'cavalry' && (killer.chargeTimer || 0) > 20,
            runner: !!unit.lineBreaker,
            boss: !!unit.isNamedBoss,
            cause: unit.deathCause,
            held: Number.isFinite(killer.holdX),
            hunting: !!killer.huntMode,
            killerKills: killer.kills || 0,
            killerHonored: !!killer.honorName,
            killerGeneral: !!killer.isGeneral,
          });
        } else {
          ach('kill', {
            enemyType: unit.type,
            elite: isEliteEnemy(unit),
            runner: !!unit.lineBreaker,
            cause: unit.deathCause,
          });
        }
        if (unit.isNamedBoss && GS.wave >= CAMPAIGN_VICTORY_WAVE) {
          const playerAlive = GS.units.filter(
            (u) => u.team === 'player' && u.hp > 0 && !u.garrisoned
          );
          const kiSnap = sampleKiEnergyArmy(playerAlive);
          if (kiSnap?.high) {
            ach('planet_boss_ki_stand', { wave: GS.wave, bossType: unit.type, ...kiSnap });
            showMessage('Power overwhelming — Emberblood warriors break the warlord!', 380);
          }
        }
        if (isMajorBossUnit(unit)) {
          const dragonKill = checkDragonThemedBossKill(killer, unit);
          if (dragonKill) {
            ach('dragon_boss_slay', dragonKill);
            showMessage(
              `By Voice and dragon-fire — ${dragonKill.bossName} falls to the Rimehowl legacy!`,
              360
            );
          }
        }
        if (unit.isNamedBoss) {
          if (killer) {
            const soloKill = checkSoloHeroNamedBossKill(killer, unit, GS.units);
            if (soloKill) {
              ach('solo_hero_boss_kill', soloKill);
              showMessage(
                `Your fate was sealed before the strike — ${soloKill.bossName} falls to a lone hero!`,
                340
              );
            }
          }
          onNamedBossSlain(unit);
        }
        if (svc('NeutralWildlife')) {
          svc('NeutralWildlife').onCombatDeath(GS.wave, {
            worldW: GS.worldW,
            worldH: GS.worldH,
            rallyY: GS.rallyY,
            territoryTier: GS.territoryTier,
            spawnUnit: (u) => GS.units.push(u),
            hooks: uiHooks(),
          });
        }
      }
      if (unit.team === 'player') {
        SiegeLoop.onUnitDeath(unit, null, siegeCtx);
        Roster.onDeath(unit, null, siegeCtx);
        GS.runPlayerDeaths++;
        GS.playerCasualtiesThisWave++;
        if (typeof GameFeedback !== 'undefined') GameFeedback.onPlayerDeath();
        GameArmy.notifyHallDeath(unit, Veterans.onDeath(unit, GS.wave));
        if (unit.isGeneral) {
          releaseFromKeep(unit);
          ach('general_fell', { wave: GS.wave });
          showMessage(
            'The General has fallen! Command aura lost — Vanguard command challenge failed.',
            300
          );
        } else if (!unit.isDoomslayer && svc('Perks') && svc('Perks').handleQuickRevive(unit)) {
          quickRevived = true;
          const def = getPlayerUnitDef(unit.type);
          showMessage(`${def?.name || unit.type} revived with Field Revival!`, 180);
        } else if (!unit.isDoomslayer && unit.type !== 'builder' && unit.type !== 'courier') {
          GS.fallenPool.push({ type: unit.type, x: unit.x, y: unit.y });
        }
        if (svc('NeutralWildlife')) {
          svc('NeutralWildlife').onCombatDeath(GS.wave, {
            worldW: GS.worldW,
            worldH: GS.worldH,
            rallyY: GS.rallyY,
            territoryTier: GS.territoryTier,
            spawnUnit: (u) => GS.units.push(u),
            hooks: uiHooks(),
          });
        }
      }
      if (!quickRevived) {
        if (svc('VisualPolish')) svc('VisualPolish').registerDeath(unit, opts?.attacker);
        applyWitnessDeath(unit);
      }
    } else if (unit.team === 'player' && unit.hp > 0) {
      if (unit.combatType === 'healer' && actual > 0) tryHealerMedicalRetreat(unit);
      else tryMedicalRetreat(unit);
    }
    if (
      unit.hp > 0 &&
      unit.hp < unit.maxHp * 0.25 &&
      isMoraleCombatUnit(unit) &&
      unit.rallyTimer <= 0 &&
      !unit.fightToDeath &&
      !unit.retreatingToMed &&
      !unit.atMedicalTent
    ) {
      unit.morale -= 2;
      if (unit.morale <= moraleBreakThreshold(unit)) triggerMoraleBreak(unit, 'wounded');
    }
    return actual;
  }

  function damageInRadius(x, y, radius, damage, team, opts = {}) {
    const radius2 = radius * radius;
    const hurtAll = () => {
      for (const u of GS.units) {
        if (u.team === team || u.hp <= 0) continue;
        const d2 = posDistSq(u.x, u.y, x, y);
        if (d2 < radius2) {
          const dist = Math.sqrt(d2);
          takeDamage(u, damage * (1 - (dist / radius) * 0.5), opts);
        }
      }
    };
    // One summed number per blast.
    const ft = svc('FloatingText');
    if (ft?.summed) ft.summed(hurtAll);
    else hurtAll();
    // The player's strikes and blasts also fall on war camps.
    if (team === 'player' && typeof WarCamps !== 'undefined') {
      WarCamps.onBlast(x, y, radius, damage, warCampCtx);
    }
  }

  function abyssWalkerDamage(target) {
    if (GS.wave >= 1001) return calcDamage({ damage: 120, type: 'melee' }, target, 0);
    return Math.max(target.hp, target.maxHp * 0.95);
  }

  function updateAbyssWalkerAI(unit) {
    if (!unit.isDoomslayer || unit.hp <= 0) return;
    let foesOnAllies = 0;
    let onMe = 0;
    const onMeR2 = 2500;
    for (let i = 0; i < GS.units.length; i++) {
      const e = GS.units[i];
      if (e.team !== 'enemy' || e.hp <= 0) continue;
      if (e.combatTargetId === unit.id || unitDistSq(e, unit) < onMeR2) {
        onMe++;
        continue;
      }
      if (e.combatTargetId) {
        const tgt = getUnitById(e.combatTargetId);
        if (tgt && tgt.team === 'player' && !tgt.isDoomslayer) foesOnAllies++;
      }
    }

    if (onMe >= 4 && (unit.doomAbilityCd || 0) <= 0) {
      unit.doomAbilityCd = 120;
      const ripR2 = 8100;
      for (let i = 0; i < GS.units.length; i++) {
        const e = GS.units[i];
        if (e.team !== 'enemy' || e.hp <= 0) continue;
        if (unitDistSq(unit, e) < ripR2) takeDamage(e, abyssWalkerDamage(e), { crit: true });
      }
      svc('FloatingText').status(unit.x, unit.y, 'REND & RUIN', '#ff4040');
      svc('Particles').dust(unit.x, unit.y);
    } else if (foesOnAllies >= 3 && (unit.doomProtectCd || 0) <= 0) {
      unit.doomProtectCd = 90;
      for (let i = 0; i < GS.units.length; i++) {
        const a = GS.units[i];
        if (a.team !== 'player' || a.hp <= 0) continue;
        a.hp = Math.min(a.maxHp, a.hp + 40);
        a.rallyTimer = Math.max(a.rallyTimer || 0, 60);
        if (a.demoralized) restoreTroopMorale(a, 8);
      }
      svc('FloatingText').status(unit.x, unit.y, 'GUARDIAN', '#80ff80');
    } else if (unitCounts.enemy >= 8 && (unit.doomCleaveCd || 0) <= 0) {
      unit.doomCleaveCd = 70;
      const cleaveR2 = 4900;
      let cleaveHits = 0;
      for (let i = 0; i < GS.units.length && cleaveHits < 5; i++) {
        const e = GS.units[i];
        if (e.team !== 'enemy' || e.hp <= 0) continue;
        if (unitDistSq(unit, e) < cleaveR2) {
          takeDamage(e, abyssWalkerDamage(e));
          cleaveHits++;
        }
      }
    }
    if (unit.doomAbilityCd > 0) unit.doomAbilityCd--;
    if (unit.doomProtectCd > 0) unit.doomProtectCd--;
    if (unit.doomCleaveCd > 0) unit.doomCleaveCd--;
  }

  function applyHeroOnHit(unit, target, dmg) {
    if (!unit.isCrossover) return;
    const cDef = typeof getHeroDef === 'function' ? getHeroDef(unit.type) : null;
    if (cDef?.faction)
      ach('crossover_ability', {
        unitType: unit.type,
        faction: cDef.faction,
        ability: cDef.ability,
      });
    if (svc('FactionDepth')) svc('FactionDepth').processAbilityHit(unit, target, dmg);
  }

  function applyChampionOnHit(unit, target, dmg) {
    if (!unit.isWwe) return;
    ach('crossover_ability', {
      unitType: unit.type,
      faction: 'champions',
      ability: unit.wweAbility,
    });
    if (svc('FactionDepth')) svc('FactionDepth').processAbilityHit(unit, target, dmg);
  }

  function fireWeapon(unit, target) {
    const dist = unitDistance(unit, target);
    if (!inAttackRange(unit, target)) return;
    // A Sapper throws a satchel charge instead of shooting; up close he falls through to a knife.
    if (unit.type === 'sapper' && typeof SapperKit !== 'undefined') {
      if (SapperKit.fire(unit, target, siegeCtx)) return;
    }

    let hit = unit.accuracy;
    if (unit.team === 'player' && !unit.isGeneral && isInGeneralAura(unit)) {
      hit += getGeneralAura().accuracy;
    }
    if (unit.isGeneral && (unit.w2wBuffTimer || 0) > 0) hit += 22;
    if (unit.synergyAcc) hit += unit.synergyAcc;
    if (unit.skillAcc) hit += unit.skillAcc;
    if (unit.team === 'enemy') {
      let accPenalty = getSightPenaltyForUnit(unit);
      if (svc('DynamicMapEvents')) {
        accPenalty += svc('DynamicMapEvents').getActiveMods().enemyAccuracyPenalty || 0;
      }
      hit = Math.max(4, hit - accPenalty);
    }
    const effRange = getEffectiveRange(unit);
    if (unit.combatType === 'ranged' && dist > effRange * 0.8) hit *= 0.6;

    unit.rotation = Math.round((Math.atan2(target.y - unit.y, target.x - unit.x) * 180) / Math.PI);
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    unit.combatTargetId = target.id;
    // Manual click-to-move: keep the march path. Clearing it every shot forced full
    // repath thrash (mage bolt spam especially) and felt like a mid-wave freeze.
    if (!unit.manualOrder) {
      unit.path = [];
      unit.pathIndex = 0;
    }

    const aimRad = (unit.rotation * Math.PI) / 180;
    const fx = unit.x + Math.cos(aimRad) * 12;
    const fy = unit.y + Math.sin(aimRad) * 12;

    const useMelee = dist <= unit.meleeRange + (isMeleeCombat(unit) ? 4 : 0);

    if (useMelee && (isMeleeCombat(unit) || unit.combatType === 'ranged')) {
      CombatFX.meleeSlash(fx, fy, unit.rotation);
      const meleeHit = unit.isDoomslayer || Math.random() * 100 <= hit;
      if (meleeHit) {
        const dmg = unit.isDoomslayer ? abyssWalkerDamage(target) : calcDamage(unit, target, 12);
        takeDamage(target, dmg, {
          crit: unit.isDoomslayer,
          attackerTeam: unit.team,
          attacker: unit,
        });
        applyChampionOnHit(unit, target, dmg);
        applyHeroOnHit(unit, target, dmg);
        if (unit.hasElementalPop)
          svc('Perks').applyElementalPopSplash(unit, target, GS.units, takeDamage);
        if (unit.hasDoubleTap && target.hp > 0 && Math.random() < 0.45) {
          takeDamage(target, Math.round(dmg * 0.55), {
            attackerTeam: unit.team,
            attacker: unit,
          });
        }
        if (unit.combatType === 'cavalry') unit.chargeTimer = 0;
      } else {
        // Miss swing whoosh — hit SFX is layered inside takeDamage on connect
        playSfx('whoosh');
      }
      return;
    }

    const isRangedAttack = unit.combatType === 'ranged' || unit.combatType === 'siege';
    const attackRange = unit.combatType === 'siege' ? unit.range : getEffectiveRange(unit);
    if (isRangedAttack && dist <= attackRange) {
      if (unit.projectile === 'arrow') CombatFX.arrowLoose(fx, fy, unit.rotation);
      else CombatFX.spellCast(fx, fy);
      GS.projectiles.push({
        x: unit.x,
        y: unit.y,
        tx: target.x,
        ty: target.y,
        type: unit.projectile || 'arrow',
        damage: unit.damage,
        team: unit.team,
        speed:
          unit.type === 'mage' || unit.type === 'dark_mage'
            ? 7
            : unit.type === 'siege_tower'
              ? 4.5
              : 6,
        accuracy: hit,
        targetId: target.id,
        sourceId: unit.id,
        sourceType: unit.type,
        splash: unit.type === 'mage' || unit.type === 'dark_mage' || unit.type === 'necromancer',
        angle: Math.atan2(target.y - unit.y, target.x - unit.x),
      });
      unit.projectile === 'arrow' ? playSfx('arrowShoot') : playSfx('magicCast');
    } else if (isMeleeCombat(unit) && dist <= unit.meleeRange && Math.random() * 100 <= hit) {
      CombatFX.meleeSlash(fx, fy, unit.rotation);
      takeDamage(target, calcDamage(unit, target, 10), {
        attackerTeam: unit.team,
        attacker: unit,
      });
      // Hit audio handled in takeDamage
    }
  }

  return {
    bind,
    applyHeroOnHit,
    applyGeneralAura,
    applyChampionOnHit,
    calcDamage,
    damageInRadius,
    findCombatTarget,
    findNearestFoeInRange,
    findPlayerGeneral,
    fireWeapon,
    getGeneralAura,
    getGeneralBuffStrength,
    getStationedGeneral,
    refreshAuraCache,
    takeDamage,
    updateAbyssWalkerAI,
  };
})();
