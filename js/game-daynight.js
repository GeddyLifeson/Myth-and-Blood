/**
 * Day and night phases, dawn payouts and the cycle tick.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameDayNight = (() => {
  const {
    countActiveEnemies,
    countGarrisoned,
    countPlayerFortifications,
    countPlayerGuilds,
    countPlayerHamlets,
    countPlayerWalls,
    enemyRotationForSide,
    gameRandom,
    getRunModeId,
    getSettlementTpBonus,
    getTotalStarCount,
    playSfx,
    releaseCombatPursuit,
    sampleHeroAlliance,
    sampleMeleeFocusedArmy,
    samplePlayerArmyMorale,
    sampleShowmanshipArmy,
    svc,
    unitCounts,
    unitDistance,
  } = GameCore;
  const GS = GameState;
  const { isHordeWave, isSiegeWave, sanitizeTactical } = GameField;
  const { ETERNAL_CRUSADE_MIN_FORTS, triggerMoraleBreak } = GameMorale;
  const { findPlayerGeneral } = GameCombat;
  const { addHighlight, applyPlayerStatMods, notifyVetStarEvent, spawnUnit } = GameArmy;
  const { getTpPerRound } = GameBuildings;
  const {
    planHostFor,
    planWaveSectors,
    prefetchSpawnQueueForWave,
    spawnPosForSector,
    startNextWave,
    syncEconomyActions,
    takeSpawnSector,
  } = GameWaves;
  let ach,
    checkRosterSynergy,
    emitNightBegin,
    floatStatus,
    getAsymmetricMods,
    getDifficulty,
    getNightPrepTicks,
    invalidateStateCache,
    refreshUnitCounts,
    setPaused,
    showMessage,
    siegeCtx,
    warCampCtx;
  function bind(api) {
    ({
      ach,
      checkRosterSynergy,
      emitNightBegin,
      floatStatus,
      getAsymmetricMods,
      getDifficulty,
      getNightPrepTicks,
      invalidateStateCache,
      refreshUnitCounts,
      setPaused,
      showMessage,
      siegeCtx,
      warCampCtx,
    } = api);
  }

  function isDayPhase() {
    return GS.timeOfDay === 'day';
  }
  function isNightPhase() {
    return GS.timeOfDay === 'night';
  }

  function getDayLightLevel() {
    if (GS.dayLightTick === GS.updateTick) return GS.dayLightCache;
    if (isNightPhase()) GS.dayLightCache = 0.32;
    else if (GS.waveEnemyTotal <= 0) GS.dayLightCache = 1;
    else {
      const remaining = GS.spawnQueue.length + unitCounts.enemy;
      const cleared = 1 - remaining / GS.waveEnemyTotal;
      GS.dayLightCache = Math.max(0.42, 1 - cleared * 0.48);
    }
    GS.dayLightTick = GS.updateTick;
    return GS.dayLightCache;
  }

  function getSightPenaltyForUnit(unit) {
    if (!unit || unit.team !== 'enemy' || unit.hp <= 0) return 0;
    const light = getDayLightLevel();
    let pen = Math.floor((1 - light) * 24);
    if (unit.lanternBlind > 0) pen += 10 + Math.floor(unit.lanternBlind / 4);
    if (isNightPhase()) pen += 28;
    if (svc('ContentExpansion')) pen += svc('ContentExpansion').getWatchtowerIntelPenalty(unit);
    for (const ally of GS.units) {
      if (
        ally.team !== 'player' ||
        !ally.isWwe ||
        ally.wweAbility !== 'corpse_candle_omen' ||
        ally.hp <= 0
      )
        continue;
      if (unitDistance(ally, unit) < 140) {
        pen += 14 + Math.floor((1 - light) * 22);
      }
    }
    return pen;
  }

  function updateChampionLanternAura() {
    if (!isDayPhase()) return;
    for (const bray of GS.units) {
      if (!bray.isWwe || bray.wweAbility !== 'corpse_candle_omen' || bray.hp <= 0) continue;
      bray.lanternPulse = (bray.lanternPulse || 0) + 1;
      if (bray.lanternPulse % 45 !== 0) continue;
      const light = getDayLightLevel();
      for (const foe of GS.units) {
        if (foe.team !== 'enemy' || foe.hp <= 0) continue;
        if (unitDistance(bray, foe) > 130) continue;
        foe.morale = Math.max(0, foe.morale - (1 + Math.floor((1 - light) * 2)));
        if (foe.morale <= 2 && !foe.fleeing) triggerMoraleBreak(foe, 'corpse_candle_omen');
      }
    }
  }

  function applyChampionWaveStartPulse() {
    for (const u of GS.units) {
      if (!u.isWwe || u.hp <= 0) continue;
      if (u.wweAbility === 'raise_the_colours') {
        GS.units
          .filter((a) => a.team === 'player' && a.hp > 0 && unitDistance(u, a) < 120)
          .forEach((a) => {
            a.demoralized = false;
            a.witnessDeaths = 0;
            a.morale = Math.min(a.maxMorale, a.morale + 4);
            a.rallyTimer = Math.max(a.rallyTimer || 0, 90);
          });
        svc('FloatingText').status(u.x, u.y, 'USA!', '#c04040');
      }
    }
  }

  /**
   * Campaign victory: clearing wave 100 wins the run. The siege is endless, so play
   * continues; this awards the victory achievements, faction trials and legacy win once.
   */
  const CAMPAIGN_VICTORY_WAVE = 100;
  function declareCampaignVictoryIfEarned() {
    if (GS.creativeMode || GS.campaignVictoryDeclared) return;
    if (GS.wave !== CAMPAIGN_VICTORY_WAVE) return;
    // Jump-in modes start at or past wave 100 and never fought their way here.
    if (getRunModeId() === 'academy_era') return;
    GS.campaignVictoryDeclared = true;
    ach('campaign_victory', {
      wave: GS.wave,
      difficulty: GS.difficultyId,
      hasCastleCompound: playerHasCastleCompound(GS.buildings),
      enemyStructuresRazed: GS.runStructuresRazed,
    });
    ach('true_victory', { bossSlain: true, wave: GS.wave });
    svc('Legacy')?.recordCampaignVictory?.();
    playSfx('victory', typeof Cosmetics !== 'undefined' ? Cosmetics.getVictoryThemeId() : null);
    addHighlight('era', 'Campaign won — wave 100 cleared');
    showMessage(
      'VICTORY — wave 100 is cleared and the realm stands. The siege is endless: fight on for score.',
      520,
      { priority: 'high', bypassQueue: true }
    );
  }

  function enterNightPhase() {
    if (isNightPhase()) return;
    GS.timeOfDay = 'night';
    GS.nightTimer = 0;
    refreshUnitCounts();
    // Before the round's TP, so a plot that just became a hamlet pays tonight.
    if (typeof Ground !== 'undefined') Ground.onNightBegin(siegeCtx);
    awardRoundTP();
    syncEconomyActions();
    // Decide now where tomorrow's host comes from, so the night can show it.
    GS.nextWavePlan = planWaveSectors(GS.wave + 1);
    // ...and who leads it, so the preview can name the faction.
    if (!GS.creativeMode) planHostFor(GS.wave + 1);
    if (typeof WarCamps !== 'undefined') WarCamps.onNightBegin(warCampCtx);
    SiegeLoop.onNightBegin(siegeCtx);
    refreshUnitCounts();
    const playerUnits = [];
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.team === 'player' && u.hp > 0) playerUnits.push(u);
    }
    const armySize = playerUnits.length;
    checkRosterSynergy(playerUnits);
    const moraleSnap = samplePlayerArmyMorale(playerUnits);
    if (moraleSnap && !GS.creativeMode) {
      ach('army_morale_sample', { wave: GS.wave, ...moraleSnap });
    }
    const meleeSnap = sampleMeleeFocusedArmy(playerUnits);
    if (meleeSnap && !GS.creativeMode) {
      ach('army_melee_sample', { wave: GS.wave, ...meleeSnap });
    }
    const standSnap = sampleHeroAlliance(playerUnits);
    if (standSnap && !GS.creativeMode) {
      ach('stand_alliance_sample', { wave: GS.wave, ...standSnap });
    }
    const showSnap = sampleShowmanshipArmy(playerUnits);
    if (showSnap && !GS.creativeMode) {
      ach('army_showmanship_sample', { wave: GS.wave, ...showSnap });
    }
    if (!GS.creativeMode) {
      ach('fortification_line_sample', {
        wave: GS.wave,
        count: countPlayerFortifications(),
        minForts: ETERNAL_CRUSADE_MIN_FORTS,
      });
    }
    if (!GS.creativeMode && GS.namedBossWave) {
      ach('named_boss_repelled', {
        wave: GS.wave,
        bossType: GS.namedBossWave.type,
        bossName: GS.namedBossWave.name,
      });
    }
    // countGarrisoned(playerUnits) is a genuine O(army size) scan (unlike the
    // countPlayer*() calls around it, which are already O(1) cached-field reads)
    // and was being run twice with the identical, unchanged playerUnits array —
    // compute it once and reuse it for both achievement checks below.
    const garrisonCount = countGarrisoned(playerUnits);
    declareCampaignVictoryIfEarned();
    ach('wave_complete', {
      wave: GS.wave,
      misses: GS.runPlayerDeaths,
      playerDeaths: GS.runPlayerDeaths,
      playerCasualtiesThisWave: GS.playerCasualtiesThisWave,
      difficulty: GS.difficultyId,
      siegeWave: isSiegeWave(),
      hordeWave: isHordeWave(),
      bossWave:
        GS.currentWaveConfig?.boss || (svc('GameDepth') && svc('GameDepth').isBossWave?.(GS.wave)),
      huntOn: GS.globalHunt,
      armySize,
      tactical: GS.tactical,
      settlementTp: getSettlementTpBonus(),
      hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(),
      wallCount: countPlayerWalls(),
      fortificationCount: countPlayerFortifications(),
      liveBuilders: unitCounts.liveBuilders,
      units: playerUnits,
      academyCount: unitCounts.academies,
      advancedMods: svc('AdvancedDifficulty') ? svc('AdvancedDifficulty').getActiveModCount() : 0,
      garrisonCount,
      namedBossWave: !!GS.namedBossWave,
      modeId: getRunModeId(),
      ironman: !!svc('GameModes')?.getSession?.()?.ironman,
    });
    ach('state_check', {
      wave: GS.wave,
      tactical: GS.tactical,
      misses: GS.runPlayerDeaths,
      playerDeaths: GS.runPlayerDeaths,
      hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(),
      wallCount: countPlayerWalls(),
      liveBuilders: unitCounts.liveBuilders,
      settlementTp: getSettlementTpBonus(),
      units: playerUnits,
      academyCount: unitCounts.academies,
      garrisonCount,
    });
    for (let i = 0; i < playerUnits.length; i++) {
      const u = playerUnits[i];
      u.experience = (u.experience || 0) + 1;
      u.morale = Math.min(u.maxMorale, u.morale + 1);
      if (!isSpecialistUnit(u)) notifyVetStarEvent(u, addVetStar(u));
    }
    GS.waveProgress = 1;
    if (typeof OnlineMultiplayer !== 'undefined') OnlineMultiplayer.onWaveComplete(GS.wave);
    if (svc('ColonyValue')) {
      const nightColony = svc('ColonyValue').compute();
      const nextPressure = svc('ColonyValue').deriveWavePressure(nightColony, GS.wave + 1);
      GS.colonySnapshot = nightColony;
      showMessage(
        svc('ColonyValue').formatNightPreview(nightColony, GS.wave + 1, nextPressure),
        260
      );
      if (svc('StrategyCounterplay')) {
        const strategies = svc('StrategyCounterplay').getActive();
        svc('StrategyCounterplay').maybeAnnounce(strategies, {
          showMessage,
          floatingText: floatStatus,
          worldW: GS.worldW,
        });
      }
    }
    const gen = findPlayerGeneral();
    if (gen?.hasTombstone && GS.fallenPool.length) {
      const limit = getTotalStarCount(gen);
      let raised = 0;
      while (GS.fallenPool.length && raised < limit) {
        const fallen = GS.fallenPool.shift();
        if (!fallen?.type || fallen.type === 'general' || fallen.type === 'doomslayer_hero')
          continue;
        const u = spawnUnit(fallen.type, gen.x + (raised % 3) * 24 - 24, GS.deployY, 'player');
        if (!u) continue;
        applyPlayerStatMods(u);
        u.hp = Math.floor(u.maxHp * 0.55);
        u.targetY = GS.rallyY;
        GS.units.push(u);
        raised++;
      }
      if (raised > 0) showMessage(`Tombstone — General resurrected ${raised} soldier(s)!`, 260);
    }
    applyNightRecovery();
    emitNightBegin(playerUnits);
    const prepSec = Math.ceil(
      getNightPrepTicks() /
        (typeof NIGHT_TICKS_PER_SECOND !== 'undefined' ? NIGHT_TICKS_PER_SECOND : 60)
    );
    showMessage(`Night falls — ${prepSec}s to prep · D starts early`, 280);
    // Build short night coaching tip for the prep card (no extra toast spam).
    if (typeof GameFeedback !== 'undefined') {
      let hasHealer = false;
      let hasRanged = false;
      let hasMelee = false;
      for (let i = 0; i < playerUnits.length; i++) {
        const u = playerUnits[i];
        if (u.combatType === 'healer' || u.type === 'healer') hasHealer = true;
        else if (
          u.combatType === 'ranged' ||
          u.type === 'archer' ||
          u.type === 'mage' ||
          u.type === 'ballista'
        )
          hasRanged = true;
        else if (u.combatType === 'melee' || u.combatType === 'cavalry') hasMelee = true;
      }
      GameFeedback.buildNightTips({
        tactical: GS.tactical,
        army: playerUnits.length,
        liveBuilders: unitCounts.liveBuilders,
        wallCount: countPlayerWalls?.() ?? 0,
        wave: GS.wave,
        hasHealer,
        hasRanged,
        hasMelee,
        lastCasualties: GS.playerCasualtiesThisWave,
      });
      if (GameFeedback.shouldAutoPauseNight?.()) {
        setPaused(true, { reason: 'night-prep', silent: true });
        showMessage('Paused for prep · Space resume · D for dawn', 260);
      }
    }
    playSfx('nightFall');
    prefetchSpawnQueueForWave(GS.wave + 1);
    svc('FloatingText')?.prune?.(true);
    svc('Particles')?.prune?.(true);
    svc('Chronicles')?.prune?.();
    // Refresh HUD so planet-event buttons unlock (canRespond + night) this frame.
    invalidateStateCache();
    // Autosave at each nightfall into its own slots (the last three are kept).
    if (typeof SaveManager !== 'undefined' && SaveManager.autosave) SaveManager.autosave();
  }

  function applyNightRecovery() {
    const homeY = GS.deployY + 40;
    const recallDist = GS.worldH * 0.42;
    for (const u of GS.units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (
        u.huntMode &&
        !u.manualOrder &&
        !u.retreatingToMed &&
        !u.atMedicalTent &&
        !u.garrisoned &&
        !u.wallGarrisoned &&
        !u.stationedKeep
      ) {
        const farFromBase =
          u.y < homeY - recallDist || Math.hypot(u.x - GS.worldW / 2, u.y - homeY) > recallDist;
        if (farFromBase && (u.combatTargetId || u.structureTargetId || u.pathTargetId)) {
          releaseCombatPursuit(u);
        }
      }
      if (!u.demoralized && u.morale < u.maxMorale) {
        u.morale = Math.min(u.maxMorale, u.morale + (u.hp / u.maxHp < 0.5 ? 2 : 1));
      }
      if (u.hp < u.maxHp && u.y > homeY - 80 && !u.retreatingToMed && !u.atMedicalTent) {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.002);
      }
    }
    for (const b of GS.buildings) {
      if (b.hp <= 0 || !b.complete || !b.moraleAura) continue;
      const radius = b.radius + 50;
      for (const u of GS.units) {
        if (u.team !== 'player' || u.hp <= 0 || u.demoralized) continue;
        if (Math.hypot(u.x - b.x, u.y - b.y) >= radius) continue;
        u.morale = Math.min(u.maxMorale, u.morale + 3);
        if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.04);
      }
    }
  }

  function getNightSecondsRemaining() {
    if (!isNightPhase()) return 0;
    const tps = typeof NIGHT_TICKS_PER_SECOND !== 'undefined' ? NIGHT_TICKS_PER_SECOND : 60;
    return Math.max(0, Math.ceil((getNightPrepTicks() - GS.nightTimer) / tps));
  }

  function beginDayPhase(manual = false) {
    if (!isNightPhase()) return;
    if (SiegeLoop.isSpoilsHeld()) return;
    const secondsLeft = getNightSecondsRemaining();
    GS.timeOfDay = 'day';
    GS.nightTimer = 0;
    // Unstick any orphaned async paths before the wave fills the spawn queue.
    for (const u of GS.units) {
      if (!u.pathPending) continue;
      u.pathPending = false;
      u.pathReqId = null;
      u.pathWaitTicks = 0;
    }
    if (svc('GameEvents')) {
      svc('GameEvents').emit(svc('GameEvents').GameEvent.DAY_BEGIN, {
        wave: GS.wave,
        nextWave: GS.wave + 1,
        manual,
      });
    }
    const earlyTp = manual ? SiegeLoop.earlyCallBonus(secondsLeft, siegeCtx) : 0;
    if (earlyTp > 0) {
      GS.tactical += earlyTp;
      sanitizeTactical();
      showMessage(`Horn sounded early — +${earlyTp} TP. The assault begins!`, 200);
    } else if (manual) showMessage('Dawn breaks — the assault begins!', 160);
    startNextWave();
    SiegeLoop.onWaveStart(siegeCtx);
    invalidateStateCache();
  }

  /**
   * Dawn pay-out of the starter works. The TP itself is part of getTpPerRound(); this shows
   * where it came from as a number over each building, pays the labs' science, and musters
   * the Barracks' free footman.
   * @returns {{tp: number, science: number, mustered: number}}
   */
  function payDawnWorks() {
    const out = { tp: 0, science: 0, mustered: 0 };
    if (GS.creativeMode && GS.creativeSettings.freeResources) return out;
    const ft = svc('FloatingText');
    const gens = GS.buildings
      .filter((b) => b.owner === 'player' && b.complete && b.hp > 0 && b.isResourceGen)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(0, 6);
    for (const b of gens) {
      const tp = BuildDefs[b.type]?.tpPerRound || b.tpPerRound || 0;
      if (tp <= 0) continue;
      out.tp += tp;
      ft?.status?.(b.x, b.y - 22, `+${tp} TP`, '#80ffa0');
    }
    if (svc('Research') && svc('Research').onWaveCleared) {
      out.science = svc('Research').onWaveCleared({
        wave: GS.wave,
        buildings: GS.buildings,
        showMessage,
      });
      if (out.science > 0) {
        for (const b of GS.buildings) {
          if (b.isResearchLab && b.owner === 'player' && b.complete && b.hp > 0) {
            ft?.status?.(
              b.x,
              b.y - 22,
              `+${EconomyRules.BUILDINGS.research_lab.dawnScience} SP`,
              '#80c0ff'
            );
          }
        }
      }
    }
    if (typeof EconomyRules !== 'undefined' && GS.wave < ACADEMY_ERA_WAVE) {
      for (const b of EconomyRules.barracksMuster(GS.buildings, GS.wave)) {
        const u = spawnUnit('footman', b.x, b.y + 26, 'player');
        if (!u) continue;
        u.targetY = GS.rallyY;
        u.huntMode = GS.globalHunt;
        GS.units.push(u);
        out.mustered++;
        ft?.status?.(b.x, b.y - 22, 'MUSTER', '#ffe080');
      }
      if (out.mustered > 0) {
        showMessage(
          `Barracks muster: ${out.mustered} footm${out.mustered === 1 ? 'an' : 'en'} report for duty.`,
          220
        );
        refreshUnitCounts();
      }
    }
    return out;
  }

  function awardRoundTP() {
    if (GS.tpAwardedForWave === GS.wave) return;
    GS.tpAwardedForWave = GS.wave;
    const eco = getSettlementTpBonus(true);
    // No arbitrary 120 ceiling — multi-hamlet / high-wave income was being clipped.
    // Bank still hard-capped by sanitizeTactical / TP_SANITY_CAP.
    const techTpMult =
      typeof TechTreeBranches !== 'undefined' && !GS.creativeMode
        ? TechTreeBranches.getCombinedEffects(GS.wave).tpIncomeMult || 1
        : 1;
    const gained = Math.max(0, Math.floor(getTpPerRound() * techTpMult + GS.pendingLevy));
    GS.tactical += gained;
    const levyPaid = GS.pendingLevy;
    GS.pendingLevy = 0;
    sanitizeTactical();
    const works = payDawnWorks();
    const ecoParts = [];
    if (eco > 0) ecoParts.push(`+${eco} from settlements`);
    if (works.tp > 0) ecoParts.push(`+${works.tp} from works`);
    if (levyPaid > 0) ecoParts.push(`+${levyPaid} levy`);
    const ecoNote = ecoParts.length ? ` (${ecoParts.join(', ')})` : '';
    // Wave summary banner (kills / TP / casualties) — richer than a single toast
    if (typeof GameFeedback !== 'undefined') {
      const fbStats = GameFeedback.getWaveStats?.() || {};
      svc('SpriteGen').celebrate?.(GS.updateTick);
      const summary = GameFeedback.onWaveClear({
        wave: GS.wave,
        tpGained: gained,
        waveKills: fbStats.kills || 0,
        casualties: GS.playerCasualtiesThisWave,
      });
      if (summary?.lines?.length) {
        showMessage(
          summary.perfect
            ? `Clean sweep! +${gained} TP · ${summary.kills} kills · 0 lost${ecoNote}`
            : `Round complete! +${gained} TP · ${summary.kills} kills · ${summary.deaths} lost${ecoNote}`,
          summary.perfect ? 340 : 280
        );
        if (svc('FloatingText')) {
          svc('FloatingText').status(GS.worldW / 2, GS.rallyY - 40, `+${gained} TP`, '#80ffa0');
          if (summary.perfect) {
            svc('FloatingText').status(GS.worldW / 2, GS.rallyY - 56, 'CLEAN SWEEP', '#c0ffa0');
          }
        }
      } else {
        showMessage(`Round complete! +${gained} Tactical Points${ecoNote}`);
      }
    } else {
      showMessage(`Round complete! +${gained} Tactical Points${ecoNote}`);
    }
  }

  function resetWaveModifiers() {
    GS.waveModifiers = GameRuntime.cloneWaveMods({
      ...GameRuntime.DEFAULT_WAVE_MODIFIERS,
      countMult: GS.pendingWaveMods.countMult,
      hpMult: GS.pendingWaveMods.hpMult,
      noElites: GS.pendingWaveMods.noElites,
      stealReduction: GS.pendingWaveMods.stealReduction,
      // Scout / Infiltrate / Bribe set this for the coming wave; dropping it here
      // meant the promised roster report never appeared at dawn.
      revealed: GS.pendingWaveMods.revealed,
      speedMult: GS.pendingWaveMods.speedMult,
      noSiege: GS.pendingWaveMods.noSiege,
      softenShare: GS.pendingWaveMods.softenShare,
    });
    GS.pendingWaveMods = { ...GameRuntime.DEFAULT_PENDING_WAVE_MODS };
  }

  function updateDayNightCycle() {
    if (GS.state !== 'playing') return;
    updateChampionLanternAura();
    if (isDayPhase() && GS.spawnQueue.length > 0) {
      GS.spawnTimer--;
      if (GS.spawnTimer <= 0) {
        // Its sector was settled at dawn with the rest of the host.
        const sector = takeSpawnSector();
        const type = GS.spawnQueue.shift();
        const side = 'north';
        // The leading faction's tactic may place this one itself (a flank lane, a rift
        // behind the line) or hold it back until its rift has opened.
        const tweak =
          typeof HostTactics !== 'undefined' ? HostTactics.spawnTweak(type, side, siegeCtx) : null;
        if (tweak && tweak.defer) {
          GS.spawnQueue.push(type);
          GS.spawnSectors.push(sector);
          GS.spawnTimer = 24;
          return;
        }
        const pos = tweak && tweak.x != null ? tweak : spawnPosForSector(sector);
        // A dash lane still enters inside the sector the markers showed.
        const mf = svc('MultiFrontSiege');
        if (tweak && tweak.tag === 'dash' && mf && mf.isSector(sector)) {
          const b = mf.sectorBounds(sector, GS.worldW);
          pos.x = Math.max(b.x0 + 6, Math.min(b.x1 - 6, pos.x));
        }
        const u = spawnUnit(type, pos.x, pos.y, 'enemy', { spawnSide: side });
        u.entrySector = sector;
        if (svc('EnemyFactions')) u.enemyFaction = svc('EnemyFactions').getUnitFaction(type);
        if (svc('MonsterBosses') && GS.namedBossWave) {
          svc('MonsterBosses').applyPackTags(u, GS.namedBossWave.type);
        }
        u.rotation = enemyRotationForSide(side);
        const cfg = GS.currentWaveConfig || getWaveConfig(GS.wave);
        const diff = getDifficulty();
        if (svc('GameDepth')) {
          svc('GameDepth').applyEnemySpawnScaling(u, GS.wave, {
            cfg,
            diff,
            waveModifiers: GS.waveModifiers,
            hordeWave: GS.currentHordeWave,
            colonyThreat: GS.colonyThreatMods,
            namedBossScale: u.isNamedBoss ? GS.namedBossWave?.scale : null,
          });
        }
        if (typeof EconomyRules !== 'undefined') {
          const label = EconomyRules.onEnemySpawn(u, GS.waveModifiers);
          if (label) svc('FloatingText')?.status?.(u.x, u.y - 14, label, '#ffb060');
        }
        if (u.isNamedBoss) {
          const title = u.bossTitle || EnemyDefs[type]?.bossTitle || '';
          svc('FloatingText').status(
            u.x,
            u.y - 32,
            (u.bossName || EnemyDefs[type]?.bossName || 'BOSS').toUpperCase(),
            '#ffd040'
          );
          if (title) svc('FloatingText').status(u.x, u.y - 18, title, '#ff8080');
          playSfx('bossWarn');
        } else if (u.isEvilOperative && !u.isNamedBoss) {
          svc('FloatingText').status(
            u.x,
            u.y - 24,
            (EnemyDefs[type]?.name || 'OPERATIVE').toUpperCase(),
            '#c060ff'
          );
        } else if (typeof isMonsterEnemy === 'function' && isMonsterEnemy(u)) {
          svc('FloatingText').status(
            u.x,
            u.y - 28,
            EnemyDefs[type]?.name?.toUpperCase() || 'MONSTER',
            '#ff4060'
          );
          playSfx('bossWarn');
        }
        u.huntMode = true;
        // The tactic decides who runs for the line when it has a say; otherwise the usual roll.
        const tacticRunners =
          typeof HostTactics !== 'undefined' &&
          HostTactics.onSpawn(u, tweak && tweak.tag, siegeCtx);
        if (!tacticRunners) SiegeLoop.tagEnemySpawn(u, siegeCtx);
        if (typeof WarCamps !== 'undefined') {
          const campLabel = WarCamps.onEnemySpawn(u);
          if (campLabel) svc('FloatingText')?.status?.(u.x, u.y - 14, campLabel, '#ff8060');
        }
        Roster.onSpawn(u, GS.creativeMode ? 0 : GS.wave);
        GS.units.push(u);
        const baseInterval =
          GS.creativeMode && GS.creativeCustomWave?.interval
            ? GS.creativeCustomWave.interval
            : cfg.interval || 90;
        const hordeMult = GS.currentHordeWave?.intervalMult || 1;
        const colonyInterval = GS.colonyThreatMods?.intervalMult || 1;
        const planetInterval = 1;
        const asymInterval = getAsymmetricMods().enemyIntervalMult || 1;
        let spawnGap = Math.max(
          8,
          Math.floor(
            baseInterval *
              (GS.creativeMode ? 1 : diff.spawnIntervalMult) *
              hordeMult *
              colonyInterval *
              planetInterval *
              asymInterval
          ) + Math.floor(gameRandom() * (GS.currentHordeWave ? 10 : GS.creativeMode ? 8 : 20))
        );
        // Enemies arrive in squads, not a trickle: a squad lands together, then a longer lull.
        const tacticSquad = typeof HostTactics !== 'undefined' ? HostTactics.squad() : null;
        const squad = GS.creativeMode
          ? 1
          : tacticSquad
            ? tacticSquad.size
            : Math.min(10, 2 + Math.floor(GS.wave / 4));
        if ((GS.spawnSquadLeft || 0) > 1) {
          GS.spawnSquadLeft--;
          spawnGap = 6;
        } else {
          GS.spawnSquadLeft = squad;
          spawnGap = Math.floor(spawnGap * squad * 0.4);
        }
        GS.spawnTimer = spawnGap;
      }
    } else if (isDayPhase() && GS.spawnQueue.length === 0 && countActiveEnemies() === 0) {
      if (!(GS.creativeMode && GS.creativeSettings.noAutoCycle)) enterNightPhase();
    } else if (isNightPhase()) {
      GS.nightTimer++;
      const nightTicks = getNightPrepTicks();
      GS.waveProgress = Math.min(1, GS.nightTimer / nightTicks);
      if (GS.nightTimer >= nightTicks && !(GS.creativeMode && GS.creativeSettings.noAutoCycle))
        beginDayPhase();
    }
  }

  return {
    bind,
    CAMPAIGN_VICTORY_WAVE,
    applyChampionWaveStartPulse,
    beginDayPhase,
    enterNightPhase,
    getDayLightLevel,
    getNightSecondsRemaining,
    getSightPenaltyForUnit,
    isDayPhase,
    isNightPhase,
    resetWaveModifiers,
    updateDayNightCycle,
  };
})();
