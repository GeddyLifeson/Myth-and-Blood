/**
 * Read-only state for the UI: highlights, colony and getState().
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameViewState = (() => {
  const { canDeployWithTP, getSettlementTpBonus, svc, unitCounts } = GameCore;
  const GS = GameState;
  const { getLivingPlanetCtx } = GameField;
  const { getGeneralAura, getGeneralBuffStrength } = GameCombat;
  const { getTpPerRound, isAttackableEnemyStructure } = GameBuildings;
  const { getWaveAttackSides } = GameWaves;
  const { getDayLightLevel, getNightSecondsRemaining, isNightPhase } = GameDayNight;
  const {
    getCourierMessagesPerWave,
    getResearchOpts,
    isAcademyEraActive,
    isAnyCompanyAccess,
    isCourierMessageCapReached,
  } = GameCommands;
  const { activeSectorPlan } = GameSave;
  let buildSelectedUnitsDigest,
    cachedSnap,
    getAsymmetricSnapshot,
    getCreativeSettingsSig,
    getDifficulty,
    getDifficultyPercent,
    getKingdomStageCached,
    getNightPrepTicks,
    getThematicSynSnap,
    pathSnap,
    siegeCtx;
  function bind(api) {
    ({
      buildSelectedUnitsDigest,
      cachedSnap,
      getAsymmetricSnapshot,
      getCreativeSettingsSig,
      getDifficulty,
      getDifficultyPercent,
      getKingdomStageCached,
      getNightPrepTicks,
      getThematicSynSnap,
      pathSnap,
      siegeCtx,
    } = api);
  }

  function getSessionHighlights() {
    const base = [...GS.sessionHighlights];
    if (typeof GameFeedback !== 'undefined') {
      const extra = GameFeedback.getHighlights?.() || [];
      for (const h of extra) {
        base.push({ type: 'feedback', text: h.text, wave: h.wave });
      }
    }
    return base;
  }

  function getLiveColonyState() {
    if (!svc('ColonyValue') || GS.state !== 'playing') {
      return { colony: null, nextPressure: null };
    }
    if (GS.liveColonyCache.tick === GS.updateTick) {
      return { colony: GS.liveColonyCache.colony, nextPressure: GS.liveColonyCache.nextPressure };
    }
    const colony = svc('ColonyValue').computeKingdomStrength({ wave: GS.wave + 1 });
    const nextPressure = svc('ColonyValue').deriveWavePressure(colony, GS.wave + 1);
    GS.liveColonyCache = { tick: GS.updateTick, colony, nextPressure };
    return { colony, nextPressure };
  }

  function getLiveEvolutionMeter() {
    if (
      !svc('ColonyValue') ||
      !svc('ColonyValue').computeEvolutionMeter ||
      GS.state !== 'playing'
    ) {
      return null;
    }
    if (GS.evolutionMeterTick === GS.updateTick) return GS.evolutionMeterCache;
    const liveColony = getLiveColonyState();
    GS.evolutionMeterCache = svc('ColonyValue').computeEvolutionMeter({
      wave: GS.wave,
      colony: liveColony.colony,
      researchCompleted: svc('Research') ? svc('Research').completedCount : 0,
      researchTotal:
        svc('Research') && svc('Research').ALL_NODES ? svc('Research').ALL_NODES.length : 24,
    });
    GS.evolutionMeterTick = GS.updateTick;
    return GS.evolutionMeterCache;
  }

  function getState() {
    // Cached per presented frame, but never across a change in TP: a snapshot showing a
    // purse the player no longer has (or does not have yet) is worse than rebuilding it.
    if (
      GS.stateFrameId === GS.presentationFrame &&
      GS.stateFrameCache &&
      GS.stateFrameCache.tactical === GS.tactical
    ) {
      return GS.stateFrameCache;
    }
    const army = unitCounts.player;
    const liveColony = getLiveColonyState();
    const displayColony = liveColony.colony || GS.colonySnapshot;
    const thematicSynergySnap = getThematicSynSnap();
    const snapshot = {
      state: GS.state,
      victoryReason: GS.victoryReason,
      tactical: GS.tactical,
      maxTactical: null,
      wave: GS.wave,
      campaignWon: !!GS.campaignVictoryDeclared,
      totalWaves: null,
      infiniteWaves: true,
      enemyEconomyRemaining: unitCounts.enemyEconomy,
      enemyEconomyActive: GS.enemyEconomyEverSpawned,
      northernHoldsRemaining: unitCounts.northernHolds,
      northernHoldEverSpawned: GS.northernHoldEverSpawned,
      kills: GS.kills,
      misses: GS.runPlayerDeaths,
      playerDeaths: GS.runPlayerDeaths,
      siegeLoop: SiegeLoop.getHudState(siegeCtx),
      unitProducers: unitCounts.unitProducers,
      creativeMode: GS.creativeMode,
      creativeTool: GS.creativeTool,
      creativeSpawnType: GS.creativeSpawnType,
      creativeSettings: { ...GS.creativeSettings },
      creativeSettingsSig: getCreativeSettingsSig(),
      difficulty: GS.difficultyId,
      // NG+ tier and the post-victory endless run ride on the label every HUD line already shows.
      difficultyLabel: [
        getDifficulty().label,
        svc('NewGamePlus')?.label(GS.ngPlusTier),
        GS.postVictoryEndless ? 'Endless' : '',
      ]
        .filter(Boolean)
        .join(' · '),
      ngPlusTier: GS.ngPlusTier || 0,
      postVictoryEndless: !!GS.postVictoryEndless,
      difficultyPercent: getDifficultyPercent(),
      gameMode: svc('GameModes') ? svc('GameModes').getSession() : null,
      scalingTips: cachedSnap('scalingTips', () =>
        svc('GameModes')
          ? svc('GameModes').getScalingAdvice(GS.wave, getDifficultyPercent(), GS.difficultyId)
          : []
      ),
      messages: GS.messages,
      selectedDeploy: GS.selectedDeploy,
      selectedAbility: GS.selectedAbility,
      selectedBuild: GS.selectedBuild,
      selectedCourierMsg: GS.selectedCourierMsg,
      selectedDemolish: GS.selectedDemolish,
      selectedMoveBuilding: GS.selectedMoveBuilding,
      selectedRotateWall: GS.selectedRotateWall,
      pendingWallFacing: GS.pendingWallFacing,
      moveBuildingTarget: GS.moveBuildingTarget?.id ?? null,
      moveBuildingType: GS.moveBuildingTarget?.type ?? null,
      selectedUnitId: GS.selectedUnitId,
      selectedUnitIds: GS.selectedUnitIds,
      selectedUnitsDigest: buildSelectedUnitsDigest(),
      selectionFormation: GS.selectionFormation,
      selectionFormationLabel:
        typeof Formations !== 'undefined' ? Formations.getLabel(GS.selectionFormation) : 'Box',
      paused: GS.paused,
      gameSpeed: GS.gameSpeed,
      globalHunt: GS.globalHunt,
      // Soldiers under a Hold order (the HUD shows the count on the HOLD button).
      heldCount: GS.units.reduce(
        (n, u) => n + (u.team === 'player' && u.hp > 0 && u.canHunt && u.holding ? 1 : 0),
        0
      ),
      mageCount: unitCounts.mageCount || 0,
      spyNetwork: GS.spyNetwork,
      courierCooldown: GS.courierCooldown,
      hasCourier: unitCounts.hasCourier,
      courierMessagesUsedThisWave: GS.courierMessagesUsedThisWave,
      courierMessagesPerWave: getCourierMessagesPerWave(),
      courierUsedThisWave: isCourierMessageCapReached(),
      spyUsedThisWave: GS.spyUsedThisWave,
      doctrineUsedThisWave: GS.doctrineUsedThisWave,
      counterDoctrineUsedThisWave: GS.counterDoctrineUsedThisWave,
      expeditionUsedThisWave: GS.expeditionUsedThisWave,
      kingdomDoctrines: typeof KINGDOM_DOCTRINES !== 'undefined' ? KINGDOM_DOCTRINES : {},
      unlockedKingdomDoctrines: cachedSnap('unlockedKingdomDoctrines', () =>
        typeof getUnlockedKingdomDoctrines === 'function'
          ? getUnlockedKingdomDoctrines(GS.wave)
          : []
      ),
      kingdomEvolutionMeter: getLiveEvolutionMeter(),
      army,
      enemyCount: unitCounts.enemy,
      buildingCount: unitCounts.buildings,
      waveProgress: GS.waveProgress,
      tpPerRound: cachedSnap('tpPerRound', () => getTpPerRound()),
      rallyActive: GS.rallyTimer > 0,
      generalBuff: Math.round(getGeneralBuffStrength() * 100),
      generalAura: getGeneralAura(),
      hasGeneral: !!unitCounts.playerGeneral,
      generalStationed: !!unitCounts.stationedGeneral,
      generalThreat: GS.generalThreatCount,
      lastStandActive: GS.lastStandActive,
      nextWaveIntel: GS.nextWaveIntel,
      nextHost: GS.timeOfDay === 'night' ? siegeCtx.nextHost : null,
      colonyValue: displayColony?.total ?? 0,
      colonyBaseline: displayColony?.baseline ?? 0,
      colonyThreatRatio: displayColony?.threatRatio ?? 1,
      colonyThreatTier: displayColony?.tier?.label ?? '—',
      colonyThreatColor: displayColony?.tier?.color ?? '#88cc88',
      colonyBreakdown: displayColony?.breakdown ?? null,
      colonyThreatMods: GS.colonyThreatMods,
      colonyNextPressure: liveColony.nextPressure,
      colonyThreatTooltip: cachedSnap('colonyThreatTooltip', () =>
        svc('ColonyValue') && svc('ColonyValue').formatThreatTooltip
          ? svc('ColonyValue').formatThreatTooltip(displayColony, liveColony.nextPressure, GS.wave)
          : ''
      ),
      colonySnapshotFrozen: GS.colonySnapshot,
      settlementTpRaw: unitCounts.hamletTpBonus + unitCounts.merchantGuildTpBonus,
      settlementTpCapped: cachedSnap('settlementTpCapped', () => getSettlementTpBonus()),
      hybridAcademy: svc('GameDepth') && svc('GameDepth').isHybridAcademyDeploy?.(),
      builderAutoRepair: GS.builderAutoRepair,
      attackSides: getWaveAttackSides(),
      unlockedAttackSides: cachedSnap('unlockedAttackSides', () => getUnlockedAttackSides(GS.wave)),
      bossActive: unitCounts.bossActive,
      namedBoss: GS.namedBossWave?.name || null,
      // territoryTier / worldW / worldH were also set here, but the same three
      // keys are assigned again further down this literal (see `worldW: GS.worldW`
      // near nightPrepSeconds), so these copies were dead — the later ones win.
      // Removing the dead copies, not the live ones, keeps evaluation order intact.
      academyEra: isAcademyEraActive(),
      canDeploy: cachedSnap('canDeploy', () => canDeployWithTP()),
      rtsEra: isRtsEra(GS.wave),
      enemyRtsEra: isEnemyRtsEra(GS.wave),
      kingdomEvolution: cachedSnap('kingdomEvolution', () =>
        typeof getKingdomEvolutionStage === 'function' ? getKingdomEvolutionStage(GS.wave) : null
      ),
      kingdomStage: getKingdomStageCached().stage,
      kingdomRaidsUnlocked:
        typeof isKingdomRaidsUnlocked === 'function' && isKingdomRaidsUnlocked(GS.wave),
      kingdomLoadoutsUnlocked:
        typeof isKingdomLoadoutsUnlocked === 'function' && isKingdomLoadoutsUnlocked(GS.wave),
      enemyFactions: cachedSnap('enemyFactions', () =>
        svc('EnemyFactions')
          ? svc('EnemyFactions').getStateSnapshot(GS.wave, GS.buildings, GS.spawnQueue)
          : null
      ),
      factionReputation: pathSnap('factionReputation', 6, () =>
        svc('FactionReputation') ? svc('FactionReputation').getStateSnapshot(GS.wave) : null
      ),
      planetConquest: pathSnap('planetConquest', 500, () => null),
      crownLegacies: cachedSnap('crownLegacies', () =>
        svc('CrownLegacies') && !GS.creativeMode ? svc('CrownLegacies').getStateSnapshot() : null
      ),
      eternalLegacy: cachedSnap('eternalLegacy', () =>
        typeof EternalLegacyTree !== 'undefined' && !GS.creativeMode
          ? EternalLegacyTree.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      foundationalMedieval: cachedSnap('foundationalMedieval', () =>
        typeof FoundationalMedievalLayer !== 'undefined' && !GS.creativeMode
          ? FoundationalMedievalLayer.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      ascension: cachedSnap('ascension', () =>
        typeof AscensionSystem !== 'undefined' && !GS.creativeMode
          ? AscensionSystem.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      thematicSynergy: thematicSynergySnap,
      powerFantasy: pathSnap('powerFantasy', 500, () =>
        typeof HybridPowerFantasy !== 'undefined'
          ? HybridPowerFantasy.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      narrativeThread: cachedSnap('narrativeThread', () =>
        typeof NarrativeThread !== 'undefined' && !GS.creativeMode
          ? NarrativeThread.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      techTreeBranches: cachedSnap('techTreeBranches', () =>
        typeof TechTreeBranches !== 'undefined' && !GS.creativeMode
          ? TechTreeBranches.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      grandStrategyMidBranches: pathSnap('grandStrategyMidBranches', 150, () => null),
      intergalacticLateBranches: pathSnap('intergalacticLateBranches', 400, () =>
        typeof IntergalacticLateBranches !== 'undefined'
          ? IntergalacticLateBranches.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      eternalPaths: cachedSnap('eternalPaths', () =>
        typeof EternalPathFramework !== 'undefined' && !GS.creativeMode
          ? EternalPathFramework.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      martialPathEvolution: pathSnap('martialPathEvolution', 150, () =>
        typeof MartialPathEvolution !== 'undefined'
          ? MartialPathEvolution.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      arcanePathEvolution: pathSnap('arcanePathEvolution', 150, () =>
        typeof ArcanePathEvolution !== 'undefined'
          ? ArcanePathEvolution.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      techPathEvolution: pathSnap('techPathEvolution', 150, () =>
        typeof TechPathEvolution !== 'undefined'
          ? TechPathEvolution.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      mythicPathEvolution: pathSnap('mythicPathEvolution', 150, () =>
        typeof MythicPathEvolution !== 'undefined'
          ? MythicPathEvolution.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      planetWarfare: pathSnap(
        'planetWarfare',
        typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200,
        () => null
      ),
      asymmetricWarfare: getAsymmetricSnapshot(),
      settlementRaids: pathSnap('settlementRaids', 150, () =>
        svc('SettlementRaids')
          ? svc('SettlementRaids').getStateSnapshot(GS.wave, GS.buildings, {
              isAttackable: isAttackableEnemyStructure,
            })
          : null
      ),
      multiFrontSiege: cachedSnap('multiFrontSiege', () =>
        svc('MultiFrontSiege') && svc('EnemyFactions')
          ? svc('MultiFrontSiege').getStateSnapshot(activeSectorPlan())
          : null
      ),
      monsterBosses: cachedSnap('monsterBosses', () =>
        svc('MonsterBosses')
          ? svc('MonsterBosses').getStateSnapshot(GS.namedBossWave?.type, GS.wave)
          : null
      ),
      counterEvolution: pathSnap('counterEvolution', 15, () =>
        svc('PlayerCounterEvolution')
          ? svc('PlayerCounterEvolution').getStateSnapshot(GS.wave, getKingdomStageCached().stage)
          : null
      ),
      livingPlanet: pathSnap(
        'livingPlanet',
        typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200,
        () =>
          svc('LivingPlanet')
            ? svc('LivingPlanet').getStateSnapshot(GS.territoryTier, GS.wave, getLivingPlanetCtx())
            : null
      ),
      factionHazards: cachedSnap('factionHazards', () =>
        svc('FactionHazards')
          ? svc('FactionHazards').getStateSnapshot(GS.hazards, GS.wave, GS.territoryTier)
          : null
      ),
      neutralWildlife: cachedSnap('neutralWildlife', () =>
        svc('NeutralWildlife') ? svc('NeutralWildlife').getStateSnapshot(GS.units, GS.wave) : null
      ),
      neutralRelations: cachedSnap('neutralRelations', () =>
        svc('NeutralRelations') ? svc('NeutralRelations').getStateSnapshot(GS.wave, GS.units) : null
      ),
      biomeSpawn: pathSnap(
        'biomeSpawn',
        typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200,
        () =>
          svc('BiomeSpawn')
            ? svc('BiomeSpawn').getStateSnapshot(GS.territoryTier, GS.wave, getLivingPlanetCtx())
            : null
      ),
      operativeSkills: cachedSnap('operativeSkills', () =>
        svc('CompanyTraining') ? svc('CompanyTraining').getSnapshot(GS.wave, GS.units) : null
      ),
      // Night after wave 11 prepares wave-12 events — do not gate on wave>=12 or creativeMode
      // (pathSnap would hide pending choices so buttons stay unusable).
      mapEvents: cachedSnap('mapEventsState', () =>
        svc('DynamicMapEvents')
          ? svc('DynamicMapEvents').getStateSnapshot(GS.wave, GS.tactical, isNightPhase())
          : null
      ),
      settlementTpBonus: getSettlementTpBonus(),
      liveBuilders: unitCounts.liveBuilders,
      hamletCount: unitCounts.hamlets,
      guildCount: unitCounts.guilds,
      hasChampionsHall: unitCounts.hasChampionsHall,
      sciencePoints: svc('Research') ? svc('Research').sciencePoints : 0,
      scienceKillStatus: cachedSnap('scienceKillStatus', () =>
        svc('Research') ? svc('Research').getKillScienceStatus(GS.wave, GS.buildings) : null
      ),
      researchActive: cachedSnap('researchActive', () =>
        svc('Research') ? svc('Research').getActiveInfo() : null
      ),
      researchLabs: unitCounts.researchLabs,
      researchCompleted: svc('Research') ? svc('Research').completedCount : 0,
      hasResearchLab: unitCounts.researchLabs > 0,
      wweUnlocked:
        (GS.creativeMode && GS.creativeSettings.unlockAll) ||
        svc('MetaProgress').isChampionsUnlocked() ||
        (svc('Research') && svc('Research').isFactionUnlocked('champions', getResearchOpts())),
      doomslayerUnlocked:
        (GS.creativeMode && GS.creativeSettings.unlockAll) ||
        svc('MetaProgress').isAbyssWalkerUnlocked() ||
        (svc('Research') && svc('Research').isDoomResearchUnlocked(getResearchOpts())),
      crossoverUnlocked: (GS.creativeMode && GS.creativeSettings.unlockAll) || isAnyCompanyAccess(),
      perksUnlocked:
        (GS.creativeMode && GS.creativeSettings.unlockAll) ||
        (svc('Perks') && svc('Perks').perkMachinesUnlocked()),
      wweOnField: unitCounts.wweOnField,
      crossoverOnField: unitCounts.crossoverOnField,
      crossoverBuildings: unitCounts.crossoverBuildings,

      timeOfDay: GS.timeOfDay,
      dayLight: getDayLightLevel(),
      nightProgress: isNightPhase() ? GS.nightTimer / getNightPrepTicks() : 0,
      nightPrepTicks: getNightPrepTicks(),
      nightSecondsLeft: getNightSecondsRemaining(),
      nightPrepSeconds: typeof NIGHT_PREP_SECONDS !== 'undefined' ? NIGHT_PREP_SECONDS : 60,
      worldW: GS.worldW,
      worldH: GS.worldH,
      territoryTier: GS.territoryTier,
      deployY: GS.deployY,
      rallyY: GS.rallyY,
      // Combat feedback / night coaching (lightweight snapshots)
      feedback: cachedSnap('feedback', () =>
        typeof GameFeedback !== 'undefined'
          ? {
              ...GameFeedback.getRunSnapshot(),
              waveStats: GameFeedback.getWaveStats(),
              nightTips: isNightPhase() ? GameFeedback.getNightTips() : [],
              dangerLevel: GameFeedback.getDangerLevel(),
            }
          : null
      ),
      buildableAcademies: cachedSnap('buildableAcademies', () =>
        ACADEMY_BUILD_TYPES.filter((t) => canBuildAcademyType(t, GS.wave, GS.units))
      ),
      loadout: svc('ContentExpansion') ? svc('ContentExpansion').getLoadout() : 'balanced',
      loadouts: cachedSnap('loadouts', () =>
        svc('ContentExpansion') ? svc('ContentExpansion').getLoadouts() : {}
      ),
      waveEvent: cachedSnap('waveEvent', () =>
        svc('ContentExpansion') ? svc('ContentExpansion').getWaveEvent() : null
      ),
      factionSynergies: cachedSnap('factionSynergies', () =>
        svc('FactionDepth')
          ? svc('FactionDepth')
              .getActiveSynergies()
              .map((s) => s.name)
          : []
      ),
      seasonalEvent: cachedSnap('seasonalEvent', () =>
        svc('FactionDepth') ? svc('FactionDepth').getSeasonalEvent()?.name : null
      ),
      achievements: cachedSnap('achievements', () =>
        svc('Achievements') ? svc('Achievements').getCount() : { unlocked: 0, total: 0 }
      ),
      factionMasteryTitles: cachedSnap('factionMasteryTitles', () =>
        svc('MetaProgress') ? svc('MetaProgress').getFactionMasteryTitles() : {}
      ),
      creativeFactionSkins: cachedSnap('creativeFactionSkins', () =>
        svc('MetaProgress') ? svc('MetaProgress').getEarnedCreativeUnlocks() : {}
      ),
      cosmetics: cachedSnap('cosmetics', () =>
        typeof Cosmetics !== 'undefined' ? Cosmetics.getSnapshot() : null
      ),
      online: cachedSnap('online', () =>
        typeof OnlineMultiplayer !== 'undefined' ? OnlineMultiplayer.getSessionOverlay() : null
      ),
      story: cachedSnap('story', () =>
        typeof StoryLore !== 'undefined' ? StoryLore.getSessionSnapshot() : null
      ),

      layerModes: cachedSnap('layerModes', () => null),
      progressionRestart: cachedSnap('progressionRestart', () =>
        typeof ProgressionRestarts !== 'undefined'
          ? ProgressionRestarts.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      hybridMoments: cachedSnap('hybridMoments', () => null),
      pacingTools: cachedSnap('pacingTools', () =>
        typeof PacingTools !== 'undefined'
          ? PacingTools.getStateSnapshot({
              wave: GS.wave,
              gameSpeed: GS.gameSpeed,
              paused: GS.paused,
            })
          : null
      ),

      creativeCustomWave: GS.creativeCustomWave
        ? { ...GS.creativeCustomWave, count: GS.creativeCustomWave.queue?.length }
        : null,
      sandboxStats: cachedSnap('sandboxStats', () =>
        svc('CreativeTools') ? svc('CreativeTools').getSandboxStats() : null
      ),
      replayInfo: cachedSnap('replayInfo', () =>
        svc('CreativeTools') ? svc('CreativeTools').getReplayInfo() : null
      ),
      units: GS.units,
      buildings: GS.buildings,
      decorations: GS.decorations,
      updateTick: GS.updateTick,
    };
    GS.stateFrameCache = snapshot;
    GS.stateFrameId = GS.presentationFrame;
    return snapshot;
  }

  return {
    bind,
    getSessionHighlights,
    getState,
  };
})();
