/**
 * Myth and Blood — full tactical systems.
 */
const Game = (() => {
  // Pure primitives live in js/game-core.js (loaded first); bind them locally so
  // existing call sites keep using bare names.
  const {
    unitCounts,
    svc,
    playSfx,
    wireGameServices,
    setCameraKey,
    getGfxQuality,
    spatialScratchQuery,
    releaseBuildingRecord,
    countActiveEnemies,
    getAdvancedMods,
    getFogVisionMult,
    gameRandom,
    countPlayerHamlets,
    countPlayerGuilds,
    getSettlementTpBonus,
    ensureBuildingHealth,
    countEnemies,
    applyCreativeUnitStats,
    applyCreativeUnitPreset,
    unitDistance,
    posDistSq,
    getDeployCostMult,
    isUnitProducingBuilding,
    getRunModeId,
    normalizeGameSpeed,
    manualMoveReached,
    countPlayerWalls,
    getTotalStarCount,
    markUpdatePhase,
    getQuickSaveMeta,
    hasQuickSave,
  } = GameCore;

  // Mutable run state lives in the shared holder from js/game-state.js. Every
  // binding below was a closure-local `let`; moving them onto an object is what
  // lets subsystems be lifted out of this IIFE into their own files.
  const GS = GameState;
  const {
    buildUpdateThrottleCtx,
    clampPos,
    ensureInitialBattlefield,
    getIncompleteBuildSig,
    invalidateObstacles,
    lineOfSight,
    purgeDeadUnits,
    rebuildSpatialIndex,
    releaseAllBuildings,
    releaseAllUnits,
    resetTerrainForNewRun,
    sanitizeTactical,
    useSpatialQueries,
  } = GameField;
  const {
    getCameraZoom,
    isInView,
    isScreenInMapArea,
    onSettingsChanged,
    resetCamera,
    resize,
    updateCamera,
    zoomCameraAt,
    zoomCameraToScale,
  } = GameCamera;
  const {
    getSelectedUnitIds,
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    moveSelectionToWorld,
    attackSelection,
    reformSelectionFormation,
    setSelectionFormation,
    trackPointer,
  } = GameInput;
  const { returnSelectionToPosts, updateHoldPosts, updateManualMarches, updatePostReturn } =
    GameStance;
  const {
    decayMoraleWitnesses,
    sanitizeUnitPursuit,
    updateFleeingUnit,
    updateGeneralRallyMission,
    updateHuntSweep,
  } = GameMorale;
  const {
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
    refreshAuraCache,
    takeDamage,
    updateAbyssWalkerAI,
  } = GameCombat;
  const { damageBuilding, findEnemyMoveTarget, inAttackRange } = GameTargeting;
  const {
    applyWorkerPathResults,
    expireStalePendingPaths,
    finishManualOrder,
    followPath,
    isTerrainBlocked,
    nudgeUnitFree,
    orderHoldHere,
    orderHunt,
    resolveOverlaps,
    setUnitPath,
    steerToward,
    updateHuntPaths,
    updateStuckRecovery,
  } = GameMovement;
  const {
    addHighlight,
    applyPlayerStatMods,
    ascendSelectedUnit,
    recruitSelectedEcho,
    spawnUnit,
    upgradeSelectedVeteran,
  } = GameArmy;
  const {
    calcBuildingDamage,
    finalizeBuildingDestroyed,
    getTpPerRound,
    isAttackableEnemyStructure,
    isBuildSiteBlocked,
    isNorthernHold,
    normalizeEnemyEconomyBuildings,
    spawnHamletFortressWalls,
    updateEnemySiege,
    updateEnemyWallAttack,
    updatePlayerStructureAttack,
  } = GameBuildings;
  const {
    checkCastleCompoundBreaches,
    getStationedCastleGroup,
    hasPendingOutpostGarrison,
    isMarchingToKeep,
    isMarchingToWallSlot,
    releaseFromGarrison,
    releaseFromKeep,
    releaseFromWallGarrison,
    updateCastleKeeps,
    updateOutposts,
    updateWallGarrison,
  } = GameGarrison;
  const { marchToMedicalTent, resolveMedicalRetreatTent, updateMedicalRetreats } = GameMedical;
  const { updateBuilder, updateCavalryCharge, updateEnemyAI, updateHealer, updateUnitCombat } =
    GameUnitAi;
  const { hostPreviewFor, openingCountMult, startNextWave } = GameWaves;
  const {
    beginDayPhase,
    getDayLightLevel,
    isDayPhase,
    isNightPhase,
    resetWaveModifiers,
    updateDayNightCycle,
  } = GameDayNight;
  const {
    bootstrapAcademyEraStart,
    bootstrapPlaceComplete,
    checkPlayerElimination,
    getEnemyAdvancePoint,
    wireGameEventBus,
  } = GameCampaign;
  const {
    cancelBranchTech,
    cancelResearch,
    cycleWallPlacementFacing,
    dispatchExpedition,
    dispatchRaidStrike,
    executeCounterDoctrine,
    executeDoctrine,
    executeSpyAction,
    getBuildingsForResearch,
    getCourierMessagesPerWave,
    getDeployCost,
    getResearchOpts,
    respondMapEvent,
    selectAbility,
    selectBuild,
    selectDemolish,
    selectDeploy,
    selectMoveBuilding,
    selectRotateWall,
    sendCourierMessage,
    startBranchTech,
    startResearch,
    useAbility,
  } = GameCommands;
  const {
    applyCampaignRulesPreset,
    creativeAddTp,
    creativeApplyStatEditor,
    creativeClearAllBuildings,
    creativeClearAllUnits,
    creativeClearDecorations,
    creativeClearEnemies,
    creativeClearEnemyBuildings,
    creativeClearWaveSpawns,
    creativeEraseAt,
    creativeFillStatEditorFromSelection,
    creativeForceDay,
    creativeForceNight,
    creativeHealAll,
    creativeHealSelected,
    creativeKillSelected,
    creativeLaunchCustomWave,
    creativeMaxMorale,
    creativeMaxStarsSelected,
    creativeMoveBuildingTo,
    creativeMoveDecorationTo,
    creativeMoveUnitTo,
    creativePlaceDecoration,
    creativePromoteSelectedGeneral,
    creativeRankUpSelected,
    creativeRegenerateMap,
    creativeResetUnitToDef,
    creativeSetTool,
    creativeSetTp,
    creativeSetWave,
    creativeSpawnEnemyAt,
    creativeSpawnEnemyBuildingAt,
    creativeSpawnPlayerAt,
    creativeSpawnPlayerBuildingAt,
    creativeStartWave,
    getBuildingsSnapshot,
    getCustomWave,
    getDecorationsSnapshot,
    getLevelSnapshot,
    getUnitById,
    getUnitsSnapshot,
    getWorldCenter,
    isCreativeMode,
    loadCreativeLevel,
    randomMapEdgePos,
    restoreCreativeSnapshot,
    setCreativeSetting,
    setCustomWave,
    startCreative,
  } = GameCreative;
  const { draw, updatePresentation } = GameRender;
  const {
    applyCheatEffect,
    focusSelection,
    getMinimapData,
    getSelectedUnitsInfo,
    markCheatsUsed,
    panCameraToFraction,
    hireHero,
    hireChampion,
    restartCurrentWave,
    setSelectedHunt,
    toggleSelectedHunt,
  } = GameRosterUi;
  const {
    SAVE_VERSION,
    exportGameState,
    getLastLoadReport,
    getSaveBlockReason,
    importGameState,
    isSupportedSaveVersion,
    quickLoad,
    quickSave,
  } = GameSave;
  const { getSessionHighlights, getState } = GameViewState;

  GS.worldW = BASE_FIELD_W;
  GS.worldH = BASE_FIELD_H;
  GS.territoryTier = 0;
  GS.deployY = getDeployY(BASE_FIELD_H);
  GS.rallyY = getDefaultRallyY(BASE_FIELD_H);

  GS.canvas = undefined;
  GS.ctx = undefined;
  GS.viewX = 0;
  GS.viewY = 0;
  GS.viewScale = 1;
  GS.baseViewScale = 1;
  GS.cameraZoom = 1;
  GS.cameraWorldX = 0;
  GS.cameraWorldY = 0;
  GS.cameraPlaced = false;
  const DRAG_THRESHOLD = 7;
  GS.activeDragThreshold = DRAG_THRESHOLD;
  GS.isPanning = false;
  GS.dragMoved = false;
  GS.panAnchor = null;

  GS.sortedUnitsCache = [];
  GS.sortedUnitsFrame = -1;
  GS.updateTick = 0;
  GS.presentationFrame = 0;
  GS.stateFrameCache = null;
  GS.stateFrameId = -1;

  GS.creativeSettingsSigCache = '';
  GS.creativeSettingsSigTick = -1;
  GS.kingdomStageTick = -1;
  GS.kingdomStageCache = null;
  GS.livingPlanetCtxTick = -1;
  GS.livingPlanetCtxCache = null;
  GS.dayLightTick = -1;
  GS.dayLightCache = 1;
  GS.gsCtxFrame = -1;
  GS.gsCtxCache = null;
  GS.igCtxFrame = -1;
  GS.igCtxCache = null;
  GS.thematicSynSnapTick = -1;
  GS.thematicSynSnapCache = null;
  GS.snapCacheTick = -1;
  const snapCache = {};
  GS.hudRevision = 0;
  GS.hudRevisionSig = '';
  GS.evolutionMeterTick = -1;
  GS.evolutionMeterCache = null;
  GS.updateThrottleCtx = null;
  GS.castleAnchorTick = -1;
  GS.cachedSelectedSet = null;
  GS.cachedSelectionSig = '';
  GS.visibleBoundsCore = null;
  GS.state = 'menu';
  GS.units = [];
  GS.projectiles = [];
  GS.decorations = [];
  GS.buildings = [];
  GS.moveMarkers = [];
  GS.attackMarks = [];
  GS.tactical = STARTING_TP;
  GS.wave = 0;
  GS.kills = 0;
  GS.misses = 0;
  GS.runPlayerDeaths = 0;
  GS.playerCasualtiesThisWave = 0;
  GS.structuresRazedThisWave = 0;
  GS.runStructuresRazed = 0;
  GS.campaignVictoryDeclared = false;
  GS.postVictoryEndless = false;
  GS.ngPlusTier = 0;
  GS.castleBreachWarned = false;
  GS.castleBreachRecorded = false;
  GS.spawnQueue = [];
  GS.spawnTimer = 0;
  GS.waveTimer = 0;
  GS.spawnDelayBonus = 0;
  /** Set once wave 1 terrain is generated; the field is not rolled again during a run. */
  GS.terrainInitialized = false;
  GS.selectedDeploy = null;
  GS.selectedAbility = null;
  GS.selectedBuild = null;
  GS.selectedDemolish = false;
  GS.selectedMoveBuilding = false;
  GS.moveBuildingTarget = null;
  GS.selectedRotateWall = false;
  GS.pendingWallFacing = 'north';
  GS.selectedUnitId = null;
  GS.selectedUnitIds = [];
  GS.selectedCourierMsg = null;
  GS.paused = false;
  GS.messages = [];
  GS.gameSpeed = 1;
  /** Fractional sim ticks owed (fixed 60 TPS wall-clock, not frame-count). */
  GS.speedAccumulator = 0;
  /** Last wall time used for sim stepping; 0 = re-anchor next frame. */
  GS.lastSimWallMs = 0;
  GS.boxSelect = null;
  GS.selectionFormation = 'box';
  GS.sessionHighlights = [];
  GS.enemyEconomyEverSpawned = false;
  GS.northernHoldEverSpawned = false;
  GS.campaignNarrativeFlags = { firstNamedBoss: false };
  GS.victoryReason = null;

  GS.tpAwardedForWave = -1;
  GS.pathfindBudget = 24;
  GS.syncPathfindsThisTick = 0;
  // Path-budget warnings fire per over-budget unit; under heavy load that is dozens
  // of allocations + console lines per tick in the hottest path. Throttle + aggregate.
  GS.pathBudgetWarnTick = -1e9;
  GS.pathBudgetWarnSuppressed = 0;
  GS.spatialFrame = -1;
  const TP_SANITY_CAP = 500000;
  GS.spyNetwork = true;
  GS.waveModifiers = { ...GameRuntime.DEFAULT_WAVE_MODIFIERS };
  GS.pendingWaveMods = { ...GameRuntime.DEFAULT_PENDING_WAVE_MODS };
  GS.pendingReinforce = [];
  GS.pendingLevy = 0;
  GS.courierCooldown = 0;
  GS.courierMessagesUsedThisWave = 0;
  GS.spyUsedThisWave = false;
  GS.doctrineUsedThisWave = false;
  GS.counterDoctrineUsedThisWave = false;
  GS.expeditionUsedThisWave = false;
  GS.currentWaveConfig = null;
  GS.difficultyId = 'normal';
  GS.globalHunt = true;
  GS.firstWallWave = null;
  GS.rallyTimer = 0;
  GS.waveProgress = 0;
  GS.waveEnemyTotal = 0;
  GS.waveAttackSides = ['north'];
  GS.sectorPlan = null;
  GS.spawnSectors = [];
  GS.lastSectorMain = null;
  GS.nextWavePlan = null;
  GS.pointerScreen = { sx: -1, sy: -1 };
  GS.moraleAlertCooldown = 0;
  GS.moraleCascadeState = { recentBreaks: [], cascade: false, tick: 0 };
  GS.lastStandActive = false;
  GS.nextWaveIntel = '';
  GS.colonySnapshot = null;
  GS.colonyThreatMods = {
    countMult: 1,
    hpMult: 1,
    dmgMult: 1,
    intervalMult: 1,
    weights: {},
    eliteSlots: 0,
  };
  GS.liveColonyCache = { tick: -1, colony: null, nextPressure: null };
  GS.bossTrackId = null;
  GS.namedBossWave = null;
  GS.currentHordeWave = null;
  GS.hazards = [];
  GS.mapsRevealed = false;
  GS.builderAutoRepair = true;
  GS.generalThreatCount = 0;
  GS.generalThreatCd = 0;
  GS.unmannedWallWarned = false;
  GS.timeOfDay = 'day';
  GS.nightTimer = 0;
  GS.fallenPool = [];
  GS.creativeMode = false;
  GS.creativeTool = null;
  GS.creativeSpawnType = null;
  const CREATIVE_DEFAULTS = {
    freeResources: true,
    noGameOver: true,
    noAutoCycle: true,
    instantBuild: true,
    unlockAll: true,
    academyDeploy: true,
    enableAchievements: false,
    useCampaignRules: false,
    startTp: 9999,
    startWave: 0,
  };
  GS.creativeSettings = { ...CREATIVE_DEFAULTS };
  GS.creativeCustomWave = null;

  function init(cvs) {
    if (!cvs) {
      console.warn('Game.init: no canvas');
      return false;
    }
    GS.canvas = cvs;
    GS.ctx = GS.canvas.getContext('2d');
    if (!GS.ctx) return false;
    applyWorldSize(0);
    resetCamera();
    window.addEventListener('resize', resize);
    wireGameServices();
    wireGameContext();
    wireGameEventBus();
    return true;
  }

  function applyWorldSize(waveNum) {
    const size = getWorldSize(waveNum);
    GS.worldW = size.w;
    GS.worldH = size.h;
    GS.territoryTier = size.tier;
    GS.deployY = getDeployY(GS.worldH);
    GS.rallyY = getDefaultRallyY(GS.worldH);
    svc('Pathfinding').init(GS.worldW, GS.worldH);
    if (svc('PathWorkerBridge')) svc('PathWorkerBridge').init(GS.worldW, GS.worldH);
    if (svc('Spatial')) svc('Spatial').init(GS.worldW, GS.worldH);
    return size;
  }

  function createGameContext() {
    return {
      services: typeof GameServices !== 'undefined' ? GameServices : null,
      svc,
      get units() {
        return GS.units;
      },
      get buildings() {
        return GS.buildings;
      },
      get decorations() {
        return GS.decorations;
      },
      get worldW() {
        return GS.worldW;
      },
      get deployY() {
        return GS.deployY;
      },
      get rallyY() {
        return GS.rallyY;
      },
      get wave() {
        return GS.wave;
      },
      get tactical() {
        return GS.tactical;
      },
      set tactical(v) {
        GS.tactical = v;
      },
      get pendingWaveMods() {
        return GS.pendingWaveMods;
      },
      get updateTick() {
        return GS.updateTick;
      },
      get mapsRevealed() {
        return GS.mapsRevealed;
      },
      set mapsRevealed(v) {
        GS.mapsRevealed = v;
      },
      showMessage,
      damageInRadius,
      takeDamage,
      damageBuilding,
      unitDistance,
      ach,
      getStarCount: getTotalStarCount,
      getDayLight: getDayLightLevel,
      addTactical(amount) {
        GS.tactical += amount;
        sanitizeTactical();
      },
      getSettlementTpBonus,
      getTpPerRound,
      countPlayerWalls,
      countPlayerHamlets,
      countPlayerGuilds,
      createUnit(type, x, y, team, opts = {}) {
        return spawnUnit(type, x, y, team, opts);
      },
      releaseBuilding(b) {
        releaseBuildingRecord(b);
      },
      invalidateObstacles,
      getEnemyAdvancePoint,
      spawnHamletFortressWalls,
      isAttackableEnemyStructure,
      placeCompleteBuilding(type, x, y, owner = 'player') {
        const def = BuildDefs[type];
        if (!def || isBuildSiteBlocked(x, y, def)) return null;
        return bootstrapPlaceComplete(type, x, y, owner);
      },
      queueReinforce(...types) {
        GS.pendingReinforce.push(...types);
      },
    };
  }

  function wireGameContext() {
    if (typeof GameServices === 'undefined') return;
    const ctx = createGameContext();
    GameServices.setContext(ctx);
    for (const id of ['ContentExpansion', 'FactionDepth', 'ColonyValue']) {
      const mod = svc(id);
      if (mod?.bind) mod.bind(ctx);
    }
  }

  /** Live view of the battle for the SiegeLoop module. */
  const siegeCtx = {
    ach,
    get wave() {
      return GS.wave;
    },
    get tick() {
      return GS.updateTick;
    },
    get units() {
      return GS.units;
    },
    get worldW() {
      return GS.worldW;
    },
    get worldH() {
      return GS.worldH;
    },
    get rallyY() {
      return GS.rallyY;
    },
    get deployY() {
      return GS.deployY;
    },
    get isNight() {
      return GS.timeOfDay === 'night';
    },
    get creative() {
      return !!GS.creativeMode;
    },
    get cheatsUsed() {
      return !!GS.cheatsUsed;
    },
    get ngPlusTier() {
      return GS.ngPlusTier || 0;
    },
    get postVictoryEndless() {
      return !!GS.postVictoryEndless;
    },
    get modeId() {
      return getRunModeId();
    },
    /** Mode picked on the menu; the session for a new run is created after the army spawns. */
    get menuModeId() {
      return svc('GameModes')?.getMenu?.().modeId || 'campaign';
    },
    get missLimit() {
      return getDifficulty().missLimit;
    },
    get enemyCountMult() {
      return getDifficulty().enemyCountMult;
    },
    /** Enemy count multiplier for a given wave (the first two waves are eased in). */
    countMultFor: (waveNum) => openingCountMult(getDifficulty().enemyCountMult, waveNum),
    /** The host always comes from the top edge. */
    get nextSides() {
      return GS.timeOfDay === 'night' ? ['north'] : null;
    },
    /** Tomorrow's entry-sector plan; known only at night, after it has been rolled. */
    get nextSectorPlan() {
      const plan = GS.nextWavePlan;
      return GS.timeOfDay === 'night' && plan && plan.wave === GS.wave + 1 ? plan : null;
    },
    /** Tomorrow's host for the night preview: lead faction, tactic, head count. */
    get nextHost() {
      if (GS.timeOfDay !== 'night') return null;
      let towers = 0;
      for (const b of GS.buildings) {
        if (b.isWatchtower && b.owner === 'player' && b.complete && b.hp > 0) towers++;
      }
      const scouted = towers > 0 || GS.scoutedWave === GS.wave + 1;
      // The panel reads this every frame; the host only changes with the army, so once a second.
      const key = `${GS.wave}:${scouted}:${Math.floor((GS.updateTick || 0) / 60)}`;
      if (!hostPreviewCache || hostPreviewCache.key !== key) {
        hostPreviewCache = { key, value: hostPreviewFor(GS.wave + 1, scouted) };
      }
      return hostPreviewCache.value;
    },
    get viewScale() {
      return GS.viewScale || 1;
    },
    get kills() {
      return GS.kills || 0;
    },
    get soldiersLost() {
      return GS.runPlayerDeaths || 0;
    },
    get difficultyId() {
      return GS.difficultyId || 'normal';
    },
    get general() {
      return findPlayerGeneral();
    },
    get casualties() {
      return GS.playerCasualtiesThisWave;
    },
    get army() {
      return unitCounts.player;
    },
    get upkeepArmy() {
      return unitCounts.upkeepArmy ?? unitCounts.player;
    },
    get freeArmyBonus() {
      return unitCounts.freeArmyBonus || 0;
    },
    /** The purse, for the introduction: a prompt waits until its subject can be paid for. */
    get tp() {
      return GS.tactical;
    },
    /** Complete player walls: each holds a few line-breakers per wave. */
    get walls() {
      return GS.buildings;
    },
    /** Standing watchtowers turn the night preview into a head count by type. */
    get watchtowers() {
      let n = 0;
      for (const b of GS.buildings) {
        if (b.isWatchtower && b.owner === 'player' && b.complete && b.hp > 0) n++;
      }
      return n;
    },
    /** A Scout Report bought tonight does the same for one wave. */
    get scoutedNext() {
      return GS.scoutedWave === GS.wave + 1;
    },
    /** The General can be recruited (Command Theory researched, or everything unlocked). */
    get canRecruitGeneral() {
      if (GS.units.some((u) => u.isGeneral && u.team === 'player' && u.hp > 0)) return true;
      return !svc('Research') || svc('Research').isDeployUnlocked('general', getResearchOpts());
    },
    get enemiesLeft() {
      return countActiveEnemies();
    },
    get queueLeft() {
      return GS.spawnQueue.length;
    },
    get boss() {
      // namedBossWave lingers after its wave, so only announce on the boss wave itself.
      return GS.namedBossWave && GS.wave % 10 === 0
        ? { name: GS.namedBossWave.name, title: GS.namedBossWave.title }
        : null;
    },
    rng: () => gameRandom(),
    showMessage: (text, duration, opts) => showMessage(text, duration, opts),
    float: (x, y, text, color) => svc('FloatingText')?.status?.(x, y, text, color),
    playSfx: (name) => playSfx(name),
    shake: (n) => svc('VisualPolish')?.addScreenShake?.(n),
    ambience: (mode) => svc('AudioEngine')?.setAmbience?.(mode),
    burst: (kind, x, y, arg) => svc('Particles')?.[kind]?.(x, y, arg),
    addTp: (n) => {
      GS.tactical += n;
      sanitizeTactical();
    },
    spawnEnemy: (type, x, y) => {
      const pos = clampPos(x, y);
      const u = spawnUnit(type, pos.x, pos.y, 'enemy', { spawnSide: 'north' });
      u.huntMode = true;
      u.mustered = true;
      GS.units.push(u);
      return u;
    },
    unitName: (u) => (typeof getUnitDisplayName === 'function' ? getUnitDisplayName(u) : u.type),
    /** Secondary damage from traits (splash, thorns, poison). Never triggers traits again. */
    hurt: (u, amount, attacker, echo, extra) =>
      takeDamage(u, amount, {
        attacker: attacker || null,
        attackerTeam: attacker ? attacker.team : u.team === 'player' ? 'enemy' : 'player',
        rosterEcho: !!echo,
        splash: true,
        ...extra,
      }),
    // For SapperKit: terrain test, enemy structures, and whose mines to ring.
    blocked: (x, y, u) => isTerrainBlocked(x, y, u),
    get buildings() {
      return GS.buildings;
    },
    hurtBuilding: (b, amount, attacker) => damageBuilding(b, amount, attacker || null),
    get selectedIds() {
      return getSelectedUnitIds();
    },
    get paused() {
      return !!GS.paused;
    },
    defeat: () => {
      if (GS.state === 'playing') endGame(false);
    },
  };
  SiegeLoop.bindContext(() => siegeCtx);

  /** What WarCamps needs on top of the siege context: the building code and the wave plan. */
  const warCampCtx = Object.create(siegeCtx, {
    nextPlan: { get: () => GS.nextWavePlan },
    spawnQueue: { get: () => GS.spawnQueue },
    createCamp: {
      value: (type, x, y) => {
        const b = createBuilding(type, x, y, 'enemy');
        if (!b) return null;
        b.complete = true;
        b.buildProgress = b.buildTime || 1;
        ensureBuildingHealth(b);
        GS.buildings.push(b);
        return b;
      },
    },
    removeCamp: { value: (b) => finalizeBuildingDestroyed(b, { silent: true, packedUp: true }) },
    // A garrison that sallies is as strong as the wave's own troops of that type.
    spawnDefender: {
      value: (type, x, y) => {
        const u = siegeCtx.spawnEnemy(type, x, y);
        if (u && svc('GameDepth')) {
          svc('GameDepth').applyEnemySpawnScaling(u, Math.max(1, GS.wave), {
            cfg: GS.currentWaveConfig || getWaveConfig(Math.max(1, GS.wave)),
            diff: getDifficulty(),
            waveModifiers: GS.waveModifiers,
          });
        }
        return u;
      },
    },
    campDamage: { value: (unit, b) => calcBuildingDamage(unit, b) },
    foeInReach: { value: (unit) => !!findNearestFoeInRange(unit) },
    markCrate: { value: () => SiegeLoop.forgeMaps() },
    refreshPreview: { value: () => SiegeLoop.refreshPreview?.(siegeCtx) },
  });

  function cachedSnap(key, factory) {
    if (GS.snapCacheTick !== GS.updateTick) {
      GS.snapCacheTick = GS.updateTick;
      for (const k of Object.keys(snapCache)) delete snapCache[k];
    }
    if (!Object.prototype.hasOwnProperty.call(snapCache, key)) {
      snapCache[key] = factory();
    }
    return snapCache[key];
  }

  function pathSnap(key, minWave, factory) {
    if (GS.creativeMode || GS.wave < minWave) return null;
    return cachedSnap(key, factory);
  }

  function getCreativeSettingsSig() {
    if (GS.creativeSettingsSigTick === GS.updateTick) return GS.creativeSettingsSigCache;
    GS.creativeSettingsSigCache = [
      GS.creativeSettings.freeResources,
      GS.creativeSettings.noGameOver,
      GS.creativeSettings.noAutoCycle,
      GS.creativeSettings.instantBuild,
      GS.creativeSettings.unlockAll,
      GS.creativeSettings.academyDeploy,
      GS.creativeSettings.enableAchievements,
      GS.creativeSettings.useCampaignRules,
      GS.creativeSettings.startTp,
      GS.creativeSettings.startWave,
    ].join('|');
    GS.creativeSettingsSigTick = GS.updateTick;
    return GS.creativeSettingsSigCache;
  }

  function getKingdomStageCached() {
    if (GS.kingdomStageTick === GS.updateTick) return GS.kingdomStageCache;
    GS.kingdomStageCache =
      typeof getKingdomStageBuffs === 'function' ? getKingdomStageBuffs(GS.wave) : { stage: 1 };
    GS.kingdomStageTick = GS.updateTick;
    return GS.kingdomStageCache;
  }

  function bumpHudRevision() {
    const sig = [
      GS.state,
      GS.tactical,
      GS.wave,
      unitCounts.player,
      unitCounts.enemy,
      unitCounts.bossActive,
      GS.generalThreatCount,
      GS.waveProgress,
      GS.messages.length,
      GS.paused,
      GS.selectedDeploy,
      GS.selectedAbility,
      GS.selectedBuild,
      GS.selectedUnitId,
      GS.selectedUnitIds.length,
      GS.selectionFormation,
      GS.timeOfDay,
      GS.nightTimer,
      GS.hazards.length,
      svc('Research')?.getActiveInfo?.()?.pct ?? '',
      svc('Research')?.sciencePoints ?? 0,
      unitCounts.wweOnField.join(','),
      unitCounts.crossoverOnField.join(','),
      buildSelectedUnitsDigest(),
    ].join('|');
    if (sig !== GS.hudRevisionSig) {
      GS.hudRevisionSig = sig;
      GS.hudRevision++;
    }
  }

  function getHudRevision() {
    return GS.hudRevision;
  }

  function refreshUnitCounts() {
    unitCounts.player = 0;
    unitCounts.enemy = 0;
    unitCounts.activeEnemy = 0;
    unitCounts.bossActive = false;
    unitCounts.liveBuilders = 0;
    unitCounts.hasCourier = false;
    unitCounts.playerGeneral = null;
    unitCounts.stationedGeneral = null;
    unitCounts.wweOnField.length = 0;
    unitCounts.crossoverOnField.length = 0;
    unitCounts.garrisonedPlayer = 0;
    unitCounts.mageCount = 0;
    unitCounts.upkeepArmy = 0;
    unitCounts.freeArmyBonus =
      typeof EconomyRules !== 'undefined' ? EconomyRules.freeArmyBonus(GS.buildings) : 0;
    const byType = unitCounts.livePlayerByType;
    for (const k in byType) delete byType[k];
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.hp <= 0) continue;
      if (u.team === 'player') {
        unitCounts.player++;
        // Specialists do not raise the recruit surcharge.
        if (u.type !== 'builder' && u.type !== 'courier') unitCounts.upkeepArmy++;
        byType[u.type] = (byType[u.type] || 0) + 1;
        if (u.garrisoned) unitCounts.garrisonedPlayer++;
        if (u.type === 'builder') unitCounts.liveBuilders++;
        if (u.type === 'courier' && u.courierReady) unitCounts.hasCourier = true;
        if (u.type === 'mage') unitCounts.mageCount++;
        if (u.isWwe) unitCounts.wweOnField.push(u.type);
        if (u.isCrossover) unitCounts.crossoverOnField.push(u.type);
        if (u.isGeneral) {
          if (!unitCounts.playerGeneral) unitCounts.playerGeneral = u;
          if (u.stationedKeep) unitCounts.stationedGeneral = u;
        }
      } else if (u.team === 'enemy') {
        // Neutrals must NOT count as activeEnemy or day never ends (soft-lock).
        unitCounts.enemy++;
        if (!u.fleeing) unitCounts.activeEnemy++;
        if (
          !unitCounts.bossActive &&
          (u.isNamedBoss ||
            u.type === 'war_chief' ||
            (typeof isMonsterEnemy === 'function' && isMonsterEnemy(u)))
        ) {
          unitCounts.bossActive = true;
        }
      }
    }
    normalizeEnemyEconomyBuildings();
    let aliveBuildings = 0;
    unitCounts.unitProducers = 0;
    unitCounts.hamlets = 0;
    unitCounts.guilds = 0;
    unitCounts.enemyEconomy = 0;
    unitCounts.northernHolds = 0;
    unitCounts.hasChampionsHall = false;
    unitCounts.academies = 0;
    unitCounts.enemyBuildings = 0;
    unitCounts.researchLabs = 0;
    unitCounts.crossoverBuildings.length = 0;
    unitCounts.playerWalls = 0;
    unitCounts.playerFortifications = 0;
    unitCounts.enemyHamlets = 0;
    unitCounts.enemyGuilds = 0;
    unitCounts.enemyEconomySpawnBonus = 0;
    unitCounts.hamletTpBonus = 0;
    unitCounts.merchantGuildTpBonus = 0;
    const hamletTpFallback = typeof HAMLET_TP_PER_ROUND !== 'undefined' ? HAMLET_TP_PER_ROUND : 5;
    const hamletRefs = [];
    let enemyEconBonus = 0;
    for (let i = 0; i < GS.buildings.length; i++) {
      const b = GS.buildings[i];
      if (b.hp <= 0) continue;
      aliveBuildings++;
      if (isUnitProducingBuilding(b)) unitCounts.unitProducers++;
      if (b.owner === 'enemy') {
        unitCounts.enemyBuildings++;
        if (b.isHamlet) unitCounts.enemyHamlets++;
        if (b.isMerchantGuild) unitCounts.enemyGuilds++;
        if (b.complete) {
          if (b.isHamlet) enemyEconBonus++;
          else if (b.isMerchantGuild) enemyEconBonus++;
          else if (
            b.isEnemySettlement &&
            (b.type === 'enemy_trade_outpost' || b.type === 'enemy_quarry')
          ) {
            enemyEconBonus++;
          } else if (b.type === 'enemy_shadow_academy' || b.type === 'enemy_war_academy') {
            enemyEconBonus += 2;
          }
        }
      }
      if (b.owner === 'player' && b.complete) {
        if (b.isHamlet) {
          unitCounts.hamlets++;
          unitCounts.hamletTpBonus +=
            b.tpBonusPerHamlet ?? BuildDefs[b.type]?.tpBonusPerHamlet ?? hamletTpFallback;
          hamletRefs.push({
            x: b.x,
            y: b.y,
            radius: b.radius || terrainBlockRadius(b) || 14,
          });
        }
        if (b.isMerchantGuild) unitCounts.guilds++;
        if (b.isWweAcademy) unitCounts.hasChampionsHall = true;
        if (b.isAcademy) unitCounts.academies++;
        if (b.isResearchLab || b.type === 'research_lab') unitCounts.researchLabs++;
        if (b.isCrossoverBarracks) unitCounts.crossoverBuildings.push(b.type);
        if (b.type === 'wall') unitCounts.playerWalls++;
        if (
          b.type === 'wall' ||
          b.type === 'outpost' ||
          b.isKeep ||
          b.type === 'castle' ||
          (b.isHamlet && ((b.fortressTier || 0) > 0 || b.fortressWallsSpawned))
        ) {
          unitCounts.playerFortifications++;
        }
      }
      if (isAttackableEnemyStructure(b)) unitCounts.enemyEconomy++;
      if (isNorthernHold(b)) unitCounts.northernHolds++;
    }
    for (let i = 0; i < GS.buildings.length; i++) {
      const g = GS.buildings[i];
      if (g.owner !== 'player' || !g.complete || !g.isMerchantGuild || g.hp <= 0) continue;
      const aura = g.hamletAuraRadius || HAMLET_AURA_RADIUS;
      for (let j = 0; j < hamletRefs.length; j++) {
        const h = hamletRefs[j];
        const reach = aura + h.radius;
        if (posDistSq(h.x, h.y, g.x, g.y) <= reach * reach) {
          unitCounts.merchantGuildTpBonus += BuildDefs[g.type]?.tpBonusInHamlet || 1;
          break;
        }
      }
    }
    unitCounts.enemyEconomySpawnBonus = enemyEconBonus;
    unitCounts.buildings = aliveBuildings;
    if (GS.selectedUnitId) {
      const sel = getUnitById(GS.selectedUnitId);
      unitCounts.selectedLive = sel?.hp > 0 ? sel : null;
    } else unitCounts.selectedLive = null;
    refreshAuraCache();
    GS.dayLightTick = -1;
    bumpHudRevision();
  }

  function getThematicSynSnap() {
    if (GS.thematicSynSnapTick === GS.updateTick) return GS.thematicSynSnapCache;
    GS.thematicSynSnapTick = GS.updateTick;
    GS.thematicSynSnapCache =
      typeof ThematicEraSynergies !== 'undefined' && !GS.creativeMode
        ? ThematicEraSynergies.getStateSnapshot({ wave: GS.wave })
        : null;
    return GS.thematicSynSnapCache;
  }

  function buildSelectedUnitsDigest() {
    const ids = GS.selectedUnitIds.length
      ? GS.selectedUnitIds
      : GS.selectedUnitId
        ? [GS.selectedUnitId]
        : [];
    if (!ids.length) return '';
    const parts = [];
    for (let i = 0; i < ids.length; i++) {
      const u = getUnitById(ids[i]);
      if (!u || u.hp <= 0) continue;
      parts.push(`${u.id}:${Math.floor(u.hp)}:${Math.floor(u.morale ?? 0)}`);
    }
    return parts.join(',');
  }

  function beginPresentationFrame() {
    GS.presentationFrame++;
    SiegeLoop.notePresentationFrame();
    GS.gsCtxFrame = -1;
    GS.igCtxFrame = -1;
  }

  function invalidateStateCache() {
    GS.stateFrameCache = null;
    GS.stateFrameId = -1;
    GS.snapCacheTick = -1;
    GS.liveColonyCache.tick = -1;
    GS.evolutionMeterTick = -1;
  }

  /** User interaction — refresh HUD/getState immediately (same presentation frame). */
  function syncInteractionState(opts = {}) {
    if (opts.refreshCounts) refreshUnitCounts();
    else bumpHudRevision();
    invalidateStateCache();
  }

  function ackInteraction(refreshCounts = false) {
    syncInteractionState({ refreshCounts });
    return true;
  }

  function announceAdvancedModifierHints() {
    if (!svc('AdvancedDifficulty')) return;
    const mods = getAdvancedMods();
    const hints = [];
    if (mods.fogOfWar) hints.push('Fog of War — scouts and watchtowers reveal hidden host units');
    if ((mods.settlementTpMult || 1) < 0.9)
      hints.push('Resource scarcity — hamlet and guild income reduced');
    if ((mods.tpMult || 1) < 0.92 && (mods.settlementTpMult || 1) >= 0.9) {
      hints.push('Tight treasury — TP income penalized');
    }
    if ((mods.nightPrepMult || 1) < 0.9) hints.push('Harsh winter — shorter night prep');
    for (const hint of hints) showMessage(hint, 320);
  }

  function isEnemyHiddenByFog(unit) {
    if (!unit || unit.team !== 'enemy' || unit.hp <= 0) return false;
    const fogCtx = {
      units: GS.units,
      buildings: GS.buildings,
      rallyY: GS.rallyY,
      isDayPhase: isDayPhase(),
      visionMult: getFogVisionMult(),
    };
    if (svc('AdvancedDifficulty') && svc('AdvancedDifficulty').isEnemyFogHidden) {
      return svc('AdvancedDifficulty').isEnemyFogHidden(unit, fogCtx);
    }
    return false;
  }

  function getAsymmetricContext(light = false) {
    let activeStages = 0;
    let hostKingdomTotal = 0;
    let factionSummary = '';
    if (svc('EnemyFactions')) {
      const active = cachedSnap('enemyActiveFactions', () =>
        svc('EnemyFactions').getActiveFactions(GS.wave)
      );
      activeStages = active.reduce((s, f) => s + (f.currentTier?.stage || 0), 0);
      if (light) {
        factionSummary = svc('EnemyFactions').formatActiveFactions(GS.wave);
        hostKingdomTotal = active.reduce(
          (s, f) =>
            s +
            svc('EnemyFactions').countFactionBuildings(GS.buildings, f.id) *
              (12 + (f.currentTier?.stage || 1) * 8),
          0
        );
      } else {
        const hostSnap = cachedSnap('enemyFactions', () =>
          svc('EnemyFactions').getStateSnapshot(GS.wave, GS.buildings, GS.spawnQueue)
        );
        hostKingdomTotal = hostSnap?.hostKingdomTotal || 0;
        factionSummary =
          hostSnap?.activeSummary || svc('EnemyFactions').formatActiveFactions(GS.wave);
      }
    }
    const evolutionFill = cachedSnap('asymEvolutionFill', () =>
      svc('ColonyValue') && svc('ColonyValue').computeEvolutionMeter
        ? (svc('ColonyValue').computeEvolutionMeter({
            wave: GS.wave,
            colony: GS.colonySnapshot || { threatRatio: 1, total: 0 },
            buildings: GS.buildings,
            units: GS.units,
            researchCompleted: svc('Research') ? svc('Research').completedCount : 0,
            researchTotal:
              svc('Research') && svc('Research').ALL_NODES ? svc('Research').ALL_NODES.length : 24,
          })?.fill ?? 0)
        : 0
    );
    return {
      wave: GS.wave,
      kingdomStage: getKingdomStageCached().stage,
      evolutionFill,
      hamletCount: unitCounts.hamlets,
      guildCount: unitCounts.guilds,
      academyCount: unitCounts.academies,
      researchCompleted: svc('Research') ? svc('Research').completedCount : 0,
      liveBuilders: unitCounts.liveBuilders,
      generalStationed: !!unitCounts.stationedGeneral,
      generalAuraStrength: getGeneralAura()?.strength || 0,
      settlementTp: getSettlementTpBonus(),
      colonyValue: GS.colonySnapshot?.total || 0,
      globalHunt: GS.globalHunt,
      unitProducers: unitCounts.unitProducers,
      activeFactionStages: activeStages,
      hostKingdomTotal,
      enemySiteCount: unitCounts.enemyEconomy,
      planetControl: 0,
      waveSince200: Math.max(
        0,
        GS.wave - (typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200)
      ),
      factionSummary,
      rallyActive: GS.rallyTimer > 0,
      doctrineUsedThisWave: GS.doctrineUsedThisWave,
      counterDoctrineUsedThisWave: GS.counterDoctrineUsedThisWave,
      expeditionUsedThisWave: GS.expeditionUsedThisWave,
      spyUsedThisWave: GS.spyUsedThisWave,
      courierMessagesUsedThisWave: GS.courierMessagesUsedThisWave,
      courierMessagesPerWave: getCourierMessagesPerWave(),
      courierUsedThisWave: GS.courierMessagesUsedThisWave >= getCourierMessagesPerWave(),
      unlockedDoctrineCount:
        typeof getUnlockedKingdomDoctrines === 'function'
          ? getUnlockedKingdomDoctrines(GS.wave).length
          : 0,
      spyNetwork: GS.spyNetwork,
      hasCourier: unitCounts.hasCourier,
    };
  }

  function getAsymmetricSnapshot() {
    if (!svc('AsymmetricWarfare')) return null;
    return cachedSnap('asymmetricWarfare', () =>
      svc('AsymmetricWarfare').getStateSnapshot(getAsymmetricContext(false))
    );
  }

  function getAsymmetricSnapshotLight() {
    if (!svc('AsymmetricWarfare')) return null;
    return cachedSnap('asymmetricWarfareLight', () =>
      svc('AsymmetricWarfare').getStateSnapshot(getAsymmetricContext(true))
    );
  }

  /** What an era milestone may touch: messages and a science grant. Never the field. */
  function getProgressionRestartCtx() {
    const runSession = svc('GameModes') ? svc('GameModes').getSession() : null;
    return {
      wave: GS.wave,
      creative: GS.creativeMode,
      modeId: runSession?.modeId || 'campaign',
      worldW: GS.worldW,
      worldH: GS.worldH,
      getResearchCompletedCount: () => (svc('Research') ? svc('Research').completedCount : 0),
      grantScience: (n) => {
        if (n > 0 && svc('Research') && svc('Research').grantSciencePoints) {
          svc('Research').grantSciencePoints(n, { showMessage });
        }
      },
      playSfx: (name) => playSfx(name),
      ...uiHooks(),
    };
  }

  function getAsymmetricMods() {
    if (!svc('AsymmetricWarfare')) {
      return {
        enemyCountMult: 1,
        enemyIntervalMult: 1,
        planetCreepMult: 1,
        eliteSlotBonus: 0,
        multiFlankBias: 0,
        commanderNightPrepMult: 1,
        commanderBuilderMult: 1,
        commanderTpRoundBonus: 0,
      };
    }
    const snap = getAsymmetricSnapshotLight();
    return (
      snap?.mods || {
        enemyCountMult: 1,
        enemyIntervalMult: 1,
        planetCreepMult: 1,
        eliteSlotBonus: 0,
        multiFlankBias: 0,
        commanderNightPrepMult: 1,
        commanderBuilderMult: 1,
        commanderTpRoundBonus: 0,
      }
    );
  }

  function getNightPrepTicks() {
    const adv = getAdvancedMods();
    const modeMult = svc('GameModes') ? svc('GameModes').getNightPrepMult() : 1;
    const cmdMult = getAsymmetricMods().commanderNightPrepMult || 1;
    return Math.max(
      120,
      Math.floor(NIGHT_PREP_TICKS * (adv.nightPrepMult || 1) * modeMult * cmdMult)
    );
  }

  function getDifficulty() {
    const base = getDifficultyDef(GS.difficultyId);
    const adv = getAdvancedMods();
    const ng = svc('NewGamePlus')?.enemyMods(GS.ngPlusTier) || {};
    return {
      ...base,
      enemyHpMult: base.enemyHpMult * adv.enemyHpMult * (ng.enemyHpMult || 1),
      enemyDmgMult: base.enemyDmgMult * adv.enemyDmgMult * (ng.enemyDmgMult || 1),
      enemyCountMult: base.enemyCountMult * adv.enemyCountMult * (ng.enemyCountMult || 1),
      spawnIntervalMult: base.spawnIntervalMult * adv.spawnIntervalMult,
      eliteChanceMult: base.eliteChanceMult * adv.eliteChanceMult,
      tpPerRoundBonus: base.tpPerRoundBonus,
      missLimit: Math.max(3, base.missLimit + (adv.missLimitDelta || 0)),
      playerMoraleBonus: base.playerMoraleBonus + (adv.playerMoraleDelta || 0),
      allyHpMult: adv.allyHpMult || 1,
      allyDmgMult: adv.allyDmgMult || 1,
      tpMult:
        (adv.tpMult || 1) * (svc('GameModes') && svc('GameModes').getSession()?.tpTight ? 0.85 : 1),
      allyAccDelta: adv.allyAccDelta || 0,
      buildSpeedMult: adv.buildSpeedMult || 1,
      forceNoElites: !!adv.forceNoElites,
      siegeWaveMult: adv.siegeWaveMult || 1,
      enemyWeight: adv.enemyWeight || {},
    };
  }

  function getDifficultyPercent() {
    if (svc('AdvancedDifficulty'))
      return svc('AdvancedDifficulty').getDifficultyPercent(GS.difficultyId);
    return DIFFICULTY_BASE_PERCENT[GS.difficultyId] ?? 100;
  }

  function setDifficulty(id) {
    if (DIFFICULTIES[id]) GS.difficultyId = id;
  }

  function ach(type, data = {}) {
    if (GS.creativeMode && !GS.creativeSettings.enableAchievements) return;
    // A run in which a cheat was used earns no achievements.
    if (GS.cheatsUsed) return;
    if (svc('Achievements')) svc('Achievements').onEvent(type, data);
  }

  function checkRosterSynergy(playerUnits) {
    const tags = new Set();
    for (const u of playerUnits || []) {
      if (!u.isCrossover && !u.isWwe) continue;
      tags.add(typeof getHeroCombatTag === 'function' ? getHeroCombatTag(u) : 'melee');
    }
    if (tags.has('melee') && tags.has('ranged') && tags.has('support')) ach('roster_synergy');
    if (svc('FactionDepth')) {
      const syns = svc('FactionDepth').computeSynergies(playerUnits);
      if (syns.length >= 2) ach('faction_synergy_multi', { count: syns.length });
      for (const u of playerUnits || []) svc('FactionDepth').applyToUnit(u, playerUnits);
    }
  }

  function start(opts = {}) {
    if (!opts.creative) {
      GS.creativeMode = false;
      GS.creativeTool = null;
      GS.creativeSpawnType = null;
    } else {
      GS.creativeMode = true;
    }
    const diff = getDifficulty();
    GS.state = 'playing';
    if (typeof UI !== 'undefined' && UI.hideMenusForPlay) {
      UI.hideMenusForPlay({ showLaunch: false });
    }
    beginPresentationFrame();
    invalidateStateCache();
    GS.kingdomStageTick = -1;
    if (typeof GameFeedback !== 'undefined') GameFeedback.resetRun();
    releaseAllUnits();
    GS.projectiles = [];
    releaseAllBuildings();
    refreshUnitCounts();
    GS.moveMarkers = [];
    GS.attackMarks = [];
    // Ribbons, Crown Legacies and Crown of Ages all add starting TP. Together they are capped
    // (EconomyRules.START_TP_BONUS_CAP); each still grants its own share, first come first served.
    if (typeof EconomyRules !== 'undefined') EconomyRules.resetRun();
    if (typeof WarCamps !== 'undefined') WarCamps.resetRun();
    const ribbonStartTp = SiegeLoop.startRun(siegeCtx);
    GS.tactical =
      diff.startingTp +
      (typeof EconomyRules !== 'undefined'
        ? EconomyRules.grantStartTp(ribbonStartTp)
        : ribbonStartTp);
    GS.wave = 0;
    GS.kills = 0;
    GS.misses = 0;
    GS.runPlayerDeaths = 0;
    // A cheat code entered on the menu (unlock codes) marks the run it leads into.
    GS.cheatsUsed = !!(svc('Cheats') && svc('Cheats').takePendingRunMark?.());
    if (GS.cheatsUsed) SiegeLoop.voidRun();
    GS.playerCasualtiesThisWave = 0;
    GS.castleBreachWarned = false;
    GS.castleBreachRecorded = false;
    GS.runStructuresRazed = 0;
    GS.campaignVictoryDeclared = false;
    GS.postVictoryEndless = false;
    GS.ngPlusTier = 0;
    GS.spawnQueue = [];
    GS.spawnDelayBonus = 0;
    GS.pendingReinforce = [];
    GS.pendingLevy = 0;
    GS.selectedDeploy = null;
    GS.selectedAbility = null;
    GS.selectedBuild = null;
    GS.selectedDemolish = false;
    GS.selectedMoveBuilding = false;
    GS.moveBuildingTarget = null;
    GS.selectedRotateWall = false;
    GS.pendingWallFacing = 'north';
    GS.selectedUnitId = null;
    GS.selectedUnitIds = [];
    GS.selectedCourierMsg = null;
    GS.paused = false;
    if (typeof PacingTools !== 'undefined') {
      PacingTools.resetRun?.();
      PacingTools.clearStrongPause?.();
    }
    applyGameSpeedFromSettings();
    GS.sessionHighlights = [];
    GS.boxSelect = null;
    GS.enemyEconomyEverSpawned = false;
    GS.northernHoldEverSpawned = false;
    GS.campaignNarrativeFlags = { firstNamedBoss: false };
    GS.victoryReason = null;
    GS.tpAwardedForWave = -1;
    GS.spatialFrame = -1;
    GS.spatialStaticDirty = true;
    GS.globalHunt = true;
    GS.spyNetwork = true;
    GS.courierCooldown = 0;
    GS.courierMessagesUsedThisWave = 0;
    GS.doctrineUsedThisWave = false;
    GS.counterDoctrineUsedThisWave = false;
    GS.expeditionUsedThisWave = false;
    GS.spyUsedThisWave = false;
    GS.currentWaveConfig = null;
    GS.firstWallWave = null;
    GS.rallyTimer = 0;
    GS.waveProgress = 0;
    GS.waveEnemyTotal = 0;
    GS.waveAttackSides = ['north'];
    GS.sectorPlan = null;
    GS.spawnSectors = [];
    GS.lastSectorMain = null;
    GS.nextWavePlan = null;
    GS.namedBossWave = null;
    GS.bossTrackId = null;
    GS.currentHordeWave = null;
    GS.timeOfDay = 'day';
    GS.nightTimer = 0;
    GS.fallenPool = [];
    GS.moraleCascadeState = { recentBreaks: [], cascade: false, tick: 0 };
    GS.lastStandActive = false;
    GS.nextWaveIntel = '';
    GS.colonySnapshot = null;
    GS.colonyThreatMods = {
      countMult: 1,
      hpMult: 1,
      dmgMult: 1,
      intervalMult: 1,
      weights: {},
      eliteSlots: 0,
    };
    GS.hazards = [];
    GS.mapsRevealed = false;
    GS.generalThreatCount = 0;
    GS.generalThreatCd = 0;
    GS.unmannedWallWarned = false;
    GS.builderAutoRepair = true;
    svc('Particles').clear();
    CombatFX.clear();
    StrikeFX?.clear?.();
    svc('FloatingText').clear();
    svc('Chronicles')?.prune?.();
    resetWaveModifiers();
    wireGameContext();
    if (svc('GameEvents')) {
      svc('GameEvents').emit(svc('GameEvents').GameEvent.GAME_START, {
        difficulty: GS.difficultyId,
      });
    } else if (svc('FactionDepth')) {
      svc('FactionDepth').onGameStart();
    }
    if (svc('ModLoader')) svc('ModLoader').onGameStart(createGameContext());
    if (svc('Research')) svc('Research').resetRun();
    Veterans.setHall([]);
    // Ensure expansion unit/building defs (ballista, bard, academies…) after any data reload race.
    if (svc('ContentExpansion')?.registerDefs) svc('ContentExpansion').registerDefs();
    else if (typeof ContentExpansion !== 'undefined' && ContentExpansion.registerDefs) {
      ContentExpansion.registerDefs();
    }
    if (svc('EnemyFactions')) svc('EnemyFactions').resetRun();
    if (typeof HostTactics !== 'undefined') HostTactics.resetRun();
    if (svc('FactionReputation')) svc('FactionReputation').resetRun();
    if (svc('AsymmetricWarfare')) svc('AsymmetricWarfare').resetRun();
    if (svc('SettlementRaids')) svc('SettlementRaids').resetRun();
    if (svc('MultiFrontSiege')) svc('MultiFrontSiege').resetRun();
    if (svc('MonsterBosses')) svc('MonsterBosses').resetRun();
    if (svc('PlayerCounterEvolution')) svc('PlayerCounterEvolution').resetRun();
    GS.scoutedWave = -1;
    if (svc('LivingPlanet')) svc('LivingPlanet').resetRun();
    if (svc('FactionHazards')) svc('FactionHazards').resetRun();
    if (svc('NeutralWildlife')) svc('NeutralWildlife').resetRun();
    if (svc('NeutralRelations')) svc('NeutralRelations').resetRun();
    if (svc('CompanyTraining')) svc('CompanyTraining').resetRun();
    if (svc('DynamicMapEvents'))
      svc('DynamicMapEvents').resetRun(svc('GameModes')?.getSession?.()?.seed);
    if (svc('StrategyCounterplay')) svc('StrategyCounterplay').resetRun();
    if (typeof ProgressionRestarts !== 'undefined') ProgressionRestarts.resetRun();
    if (typeof PacingTools !== 'undefined') PacingTools.resetRun();
    if (typeof FoundationalMedievalLayer !== 'undefined') FoundationalMedievalLayer.resetRun();
    if (typeof AscensionSystem !== 'undefined') AscensionSystem.resetRun();
    if (typeof ThematicEraSynergies !== 'undefined') ThematicEraSynergies.resetRun();
    if (typeof HybridPowerFantasy !== 'undefined') HybridPowerFantasy.resetRun();
    if (typeof NarrativeThread !== 'undefined') NarrativeThread.resetRun();
    if (typeof TechTreeBranches !== 'undefined') TechTreeBranches.resetRun();
    if (typeof EternalPathFramework !== 'undefined') EternalPathFramework.resetRun();
    if (typeof MartialPathEvolution !== 'undefined') MartialPathEvolution.resetRun();
    if (typeof ArcanePathEvolution !== 'undefined') ArcanePathEvolution.resetRun();
    if (typeof TechPathEvolution !== 'undefined') TechPathEvolution.resetRun();
    if (typeof MythicPathEvolution !== 'undefined') MythicPathEvolution.resetRun();
    if (svc('PathWorkerBridge')) svc('PathWorkerBridge').shutdown();
    resetTerrainForNewRun();
    applyWorldSize(0);
    invalidateObstacles();
    svc('SpriteGen').prewarmCache();
    resetCamera();
    if (GS.canvas) GS.canvas.style.cursor = 'grab';
    try {
      svc('AudioEngine')?.startMusic?.();
    } catch (_) {
      /* audio optional */
    }
    svc('MetaProgress').load();
    let modeDifficulty = GS.difficultyId;
    let runSession = null;
    if (!GS.creativeMode && svc('GameModes')) {
      const begun = svc('GameModes').beginSession(GS.difficultyId);
      runSession = begun?.session ?? svc('GameModes').getSession();
      if (begun?.difficulty) {
        modeDifficulty = begun.difficulty;
        GS.difficultyId = modeDifficulty;
      }
    }
    if (typeof Onboarding !== 'undefined') {
      Onboarding.onRunStarted({ creative: GS.creativeMode, session: runSession });
    }
    if (!GS.creativeMode && typeof Analytics !== 'undefined') {
      Analytics.onRunStart({
        modeId: runSession?.displayModeId || runSession?.modeId || 'campaign',
        difficulty: GS.difficultyId,
        difficultyPct: getDifficultyPercent(),
        loadout: svc('ContentExpansion') ? svc('ContentExpansion').getLoadout() : 'balanced',
        formation: GS.selectionFormation,
      });
    }
    if (!GS.creativeMode && typeof StoryLore !== 'undefined') {
      StoryLore.onRunStart({
        difficulty: GS.difficultyId,
        modeId: runSession?.displayModeId || runSession?.modeId || 'campaign',
      });
    }
    const academyEraMode = !GS.creativeMode && runSession?.modeId === 'academy_era';
    if (!GS.creativeMode && !academyEraMode) {
      for (let i = 0; i < 4; i++) {
        const u = spawnUnit('footman', 80 + i * 70, GS.deployY, 'player');
        applyPlayerStatMods(u);
        u.targetY = GS.rallyY;
        if (diff.playerMoraleBonus) {
          u.morale = Math.max(1, Math.min(u.maxMorale, u.morale + diff.playerMoraleBonus));
          if (diff.playerMoraleBonus > 0)
            u.maxMorale = Math.min(40, u.maxMorale + diff.playerMoraleBonus);
        }
        GS.units.push(u);
      }
    }
    if (svc('Legacy')) {
      svc('Legacy').onRunStart({ difficulty: GS.difficultyId, creative: GS.creativeMode });
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      FoundationalMedievalLayer.onRunStart({ creative: GS.creativeMode });
    }
    if (typeof AscensionSystem !== 'undefined') {
      AscensionSystem.onRunStart({ creative: GS.creativeMode });
    }
    if (typeof NarrativeThread !== 'undefined') {
      NarrativeThread.onRunStart({ creative: GS.creativeMode, showMessage });
    }
    if (typeof TechTreeBranches !== 'undefined') {
      TechTreeBranches.onRunStart({ creative: GS.creativeMode, showMessage });
    }
    if (svc('CrownLegacies') && !GS.creativeMode && !academyEraMode) {
      svc('CrownLegacies').applyRunStartBonuses({
        creative: false,
        deployY: GS.deployY,
        rallyY: GS.rallyY,
        units: GS.units,
        grantTp: (n) => {
          if (typeof EconomyRules !== 'undefined') n = EconomyRules.grantStartTp(n);
          if (n > 0) {
            GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
            sanitizeTactical();
          }
        },
        spendTp: (n) => {
          GS.tactical = Math.max(0, GS.tactical - n);
          sanitizeTactical();
        },
        spawnUnit: (type, x, y, team, opts) => spawnUnit(type, x, y, team, opts),
        pushUnit: (u) => GS.units.push(u),
        hooks: { showMessage },
      });
    }
    if (svc('NewGamePlus')) {
      GS.ngPlusTier = svc('NewGamePlus').applyRunStart({
        creative: GS.creativeMode,
        jumpIn: academyEraMode,
        deployY: GS.deployY,
        rallyY: GS.rallyY,
        spawnUnit: (type, x, y, team) => {
          const u = spawnUnit(type, x, y, team);
          if (u) applyPlayerStatMods(u);
          return u;
        },
        pushUnit: (u) => GS.units.push(u),
        showMessage,
      });
    }
    if (typeof EternalLegacyTree !== 'undefined' && !GS.creativeMode && !academyEraMode) {
      const eternal = EternalLegacyTree.applyRunStartBonuses({
        creative: false,
        units: GS.units,
        grantTp: (n) => {
          if (typeof EconomyRules !== 'undefined') n = EconomyRules.grantStartTp(n);
          if (n > 0) {
            GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
            sanitizeTactical();
          }
        },
      });
      if (eternal.invested > 0) {
        showMessage(`Echoes of the Past — ${eternal.invested} crown age(s) resonate.`, 280);
      }
    }
    if (GS.creativeMode) {
      GS.wave = GS.creativeSettings.startWave || 0;
      GS.tactical = GS.creativeSettings.startTp || 9999;
      GS.spawnQueue = [];
      GS.timeOfDay = 'night';
      GS.nightTimer = NIGHT_PREP_TICKS;
      applyWorldSize(GS.wave);
      ensureInitialBattlefield();
      showMessage('CREATIVE MODE — sandbox active. Press P for the lab panel.', 320);
      svc('CreativeTools') && svc('CreativeTools').onSessionStart();
    } else if (academyEraMode) {
      bootstrapAcademyEraStart(runSession?.academyStartWave ?? 105);
      const modeNote = runSession?.ironman ? ' · IRONMAN' : '';
      showMessage(
        `${diff.label} (${getDifficultyPercent()}%) · Academy Era${modeNote} — night prep at wave ${GS.wave}.`,
        360
      );
      if (runSession?.mods?.length) {
        showMessage(`Active modifiers: ${runSession.mods.length}`, 260);
        announceAdvancedModifierHints();
      }
      ach('game_start', {
        difficulty: GS.difficultyId,
        creative: false,
        mode: 'academy_era',
        wave: GS.wave,
      });
    } else {
      const mode = svc('GameModes') ? svc('GameModes').getSession() : null;
      const modeLabel =
        mode?.displayModeId ||
        mode?.challengeLabel ||
        (mode?.modeId && mode.modeId !== 'campaign' ? mode.modeId : '');
      const modeNote = modeLabel ? ` · ${modeLabel}` : '';
      const ironNote = mode?.ironman ? ' · IRONMAN' : '';
      showMessage(
        `${diff.label} (${getDifficultyPercent()}%)${modeNote}${ironNote} — hold the line! Waves grow denser and stronger from the north.`,
        360
      );
      if (mode?.mods?.length) {
        showMessage(
          `Active modifiers: ${mode.mods.length}${mode.seed ? ` · Seed ${mode.seed}` : ''}`,
          260
        );
        announceAdvancedModifierHints();
      }
      ach('game_start', { difficulty: GS.difficultyId, creative: false });
      const pending =
        typeof OnlineMultiplayer !== 'undefined' ? OnlineMultiplayer.consumePendingImport() : null;
      if (pending) {
        if (importGameState(pending)) {
          showMessage(`Shared kingdom loaded — wave ${GS.wave}.`, 320);
          if (mode?.displayModeId === 'async_coop' || mode?.onlineCoop) {
            showMessage(
              typeof OnlineMultiplayer !== 'undefined' && OnlineMultiplayer.isMyCoopTurn()
                ? 'Your turn — defend the shared kingdom!'
                : 'Kingdom loaded — confirm it is your turn before playing.',
              280
            );
          }
        } else {
          showMessage('Shared kingdom import failed — starting fresh.', 260);
          startNextWave();
        }
      } else {
        startNextWave();
      }
    }
  }

  let hostPreviewCache = null;

  function endGame(victory) {
    GS.state = victory ? 'victory' : 'defeat';
    globalThis.BannerArt?.show?.(victory ? 'victory' : 'defeat', {
      title: victory ? 'The Line Held' : 'The Realm Falls',
      sub: `Wave ${GS.wave}`,
    });
    // getState() is cached per presented frame; the HUD must not read 'playing' from it.
    invalidateStateCache();
    SiegeLoop.endRun(siegeCtx);
    if (!GS.creativeMode) {
      ach('game_end', {
        victory,
        creative: GS.creativeMode,
        wave: GS.wave,
        difficulty: GS.difficultyId,
        victoryReason: GS.victoryReason,
        hasCastleCompound: playerHasCastleCompound(GS.buildings),
        enemyStructuresRazed: GS.runStructuresRazed,
      });
    }
    if (typeof Onboarding !== 'undefined') Onboarding.onRunEnded();
    if (svc('UX')) svc('UX').clearTutorialHighlights?.();
    try {
      svc('AudioEngine')?.stopMusic?.();
    } catch (_) {
      /* audio optional */
    }
    if (victory) {
      playSfx('victory', typeof Cosmetics !== 'undefined' ? Cosmetics.getVictoryThemeId() : null);
    } else {
      playSfx('defeat');
    }
    const honorNames = GS.units
      .filter((u) => u.team === 'player' && u.honorName)
      .map((u) => u.honorName);
    if (svc('Legacy')) {
      svc('Legacy').onGameEnd(victory, {
        difficulty: GS.difficultyId,
        wave: GS.wave,
        kills: GS.kills,
        breaches: typeof SiegeLoop !== 'undefined' ? SiegeLoop.exportState().breaches : 0,
        playerDeaths: GS.runPlayerDeaths,
        creative: GS.creativeMode,
      });
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      FoundationalMedievalLayer.onRunEnd({ wave: GS.wave, showMessage, addHighlight });
    }
    let storyBranch = null;
    let storyChoiceCount = 0;
    if (!GS.creativeMode && typeof StoryLore !== 'undefined') {
      storyBranch = StoryLore.getDominantBranch?.();
      storyChoiceCount = StoryLore.getRecentChoices?.(99).length || 0;
      StoryLore.onRunEnd({
        victory,
        victoryReason: GS.victoryReason,
        wave: GS.wave,
        kills: GS.kills,
      });
    }
    if (svc('Chronicles')) {
      svc('Chronicles').appendRunReport({
        victory,
        victoryReason: GS.victoryReason,
        difficulty: GS.difficultyId,
        wave: GS.wave,
        kills: GS.kills,
        misses: GS.runPlayerDeaths,
        playerDeaths: GS.runPlayerDeaths,
        creative: GS.creativeMode,
        highlights: GS.sessionHighlights,
        honorNames,
        storyBranch,
        storyChoiceCount,
        ngPlusTier: GS.ngPlusTier || 0,
        postVictoryEndless: !!GS.postVictoryEndless,
      });
    }
    if (!GS.creativeMode && typeof Analytics !== 'undefined') {
      Analytics.onRunEnd({
        victory,
        victoryReason: GS.victoryReason,
        wave: GS.wave,
        kills: GS.kills,
        modeId: getRunModeId(),
        difficulty: GS.difficultyId,
      });
    }
    if (!GS.creativeMode && svc('GameModes')) {
      svc('GameModes').recordResult(GS.wave, GS.kills, victory, getDifficultyPercent());
      if (typeof OnlineMultiplayer !== 'undefined') {
        const sess = svc('GameModes').getSession();
        const match = OnlineMultiplayer.getActivePvpMatch();
        if (sess?.onlinePvp && match) {
          if (match.status === 'resolved' && match.entries?.length) {
            showMessage(`PvP match resolved — ${match.entries[0].name} wins!`, 360);
          } else {
            showMessage('PvP score submitted — share PVPDATA with your opponent.', 300);
          }
        }
      }
      svc('GameModes').endSession();
    }
  }

  function showMessage(text, duration = 220, opts = {}) {
    if (typeof PacingTools !== 'undefined') {
      const result = PacingTools.processMessage(text, duration, {
        paused: GS.paused,
        visibleCount: GS.messages.length,
        priority: opts.priority,
        bypassQueue: opts.bypassQueue,
      });
      if (result.queued) return;
    }
    GS.messages.push({ text, life: duration });
    if (svc('UX')) svc('UX').onMessage(text);
  }

  function directShowMessage(text, duration = 220) {
    GS.messages.push({ text, life: duration });
    if (svc('UX')) svc('UX').onMessage(text);
  }

  const floatStatus = GameRuntime.makeFloatStatus(() => svc('FloatingText'));

  /** Layer subsystem hooks — world-scoped announcements. */
  function announceHooks(extra = {}) {
    return GameRuntime.makeAnnounceHooks(
      {
        showMessage,
        addHighlight,
        worldW: GS.worldW,
        worldH: GS.worldH,
        wave: GS.wave,
        floatingText: floatStatus,
      },
      extra
    );
  }

  /** Lighter UI hooks without world dimensions. */
  function uiHooks(extra = {}) {
    return GameRuntime.makeLayerHooks(
      { showMessage, addHighlight, wave: GS.wave, floatingText: floatStatus },
      extra
    );
  }

  function clearPlacementModes() {
    GS.selectedDeploy = null;
    GS.selectedAbility = null;
    GS.selectedBuild = null;
    GS.selectedCourierMsg = null;
    syncInteractionState();
  }

  function clearPlacementMode() {
    const had = !!(
      GS.selectedDeploy ||
      GS.selectedAbility ||
      GS.selectedBuild ||
      GS.selectedCourierMsg ||
      GS.selectedDemolish ||
      GS.selectedMoveBuilding ||
      GS.moveBuildingTarget ||
      GS.selectedRotateWall
    );
    clearPlacementModes();
    GS.selectedCourierMsg = null;
    GS.selectedDemolish = false;
    GS.selectedMoveBuilding = false;
    GS.moveBuildingTarget = null;
    GS.selectedRotateWall = false;
    if (had) showMessage('Order cancelled.', 90);
    return had;
  }

  function clearSelection() {
    GS.selectedDeploy = null;
    GS.selectedAbility = null;
    GS.selectedBuild = null;
    GS.selectedCourierMsg = null;
    GS.selectedDemolish = false;
    GS.selectedMoveBuilding = false;
    GS.moveBuildingTarget = null;
    GS.selectedRotateWall = false;
    GS.pendingWallFacing = 'north';
    GS.selectedUnitId = null;
    GS.selectedUnitIds = [];
  }

  function selectUnit(id, opts = {}) {
    const u = getUnitById(id);
    if (!u || u.hp <= 0) return false;
    if (opts.addToSelection) {
      if (!GS.selectedUnitIds.length && GS.selectedUnitId) GS.selectedUnitIds = [GS.selectedUnitId];
      if (!GS.selectedUnitIds.includes(u.id)) GS.selectedUnitIds.push(u.id);
      GS.selectedUnitId = u.id;
    } else {
      GS.selectedUnitId = u.id;
      GS.selectedUnitIds = [u.id];
    }
    clearPlacementModes();
    syncInteractionState();
    return true;
  }

  function resetSimClock() {
    GS.speedAccumulator = 0;
    GS.lastSimWallMs = 0;
  }

  function setGameSpeed(speed, opts = {}) {
    GS.gameSpeed = normalizeGameSpeed(speed);
    resetSimClock();
    if (!opts.silent) {
      showMessage(`Game speed ${GS.gameSpeed}×`, 90, { priority: 'low' });
    }
    if (!opts.skipSettings && svc('Settings')) svc('Settings').set('gameSpeed', GS.gameSpeed);
    if (svc('UI')) svc('UI').updateSpeedControl?.(GS.gameSpeed);
  }

  function cycleGameSpeed() {
    const next =
      typeof PacingTools !== 'undefined'
        ? PacingTools.cycleSpeed(GS.gameSpeed)
        : GS.gameSpeed >= 4
          ? 1
          : GS.gameSpeed + 1;
    setGameSpeed(next, { silent: true });
  }

  function applyGameSpeedFromSettings() {
    const saved = svc('Settings') ? svc('Settings').get('gameSpeed') : 1;
    setGameSpeed(saved, { silent: true, skipSettings: true });
  }

  /**
   * How many simulation ticks to run this frame.
   * Uses a fixed 60 TPS wall-clock base (NIGHT_TICKS_PER_SECOND) so 1× is the same
   * on 60 Hz and 144+ Hz displays. gameSpeed multiplies target TPS (2× → 120 TPS).
   */
  function getSimulationSteps() {
    if (GS.state !== 'playing' || GS.paused) {
      resetSimClock();
      return 0;
    }
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    if (!GS.lastSimWallMs) {
      GS.lastSimWallMs = now;
      // First frame after start / resume / speed change — one tick so the game feels live.
      return 1;
    }
    let dtSec = (now - GS.lastSimWallMs) / 1000;
    GS.lastSimWallMs = now;
    if (dtSec < 0) dtSec = 0;
    // Cap catch-up after tab focus / stalls (avoid spiral-of-death freezes).
    const MAX_FRAME_SEC = 0.1;
    if (dtSec > MAX_FRAME_SEC) dtSec = MAX_FRAME_SEC;

    const tps =
      typeof NIGHT_TICKS_PER_SECOND !== 'undefined' && NIGHT_TICKS_PER_SECOND > 0
        ? NIGHT_TICKS_PER_SECOND
        : 60;
    const speed = GS.gameSpeed > 0 ? GS.gameSpeed : 1;
    GS.speedAccumulator += dtSec * tps * speed;
    let steps = Math.floor(GS.speedAccumulator);
    GS.speedAccumulator -= steps;

    let cap =
      typeof PacingTools !== 'undefined' ? PacingTools.getMaxSimulationSteps(GS.gameSpeed) : 6;
    // At 1× allow 0–2 steps/frame (fractional accumulation); keep a modest floor-free cap.
    if (speed <= 1) cap = Math.min(cap, 2);
    const load = GS.units.length;
    const gfxTier = svc('GfxQuality')?.getTier?.() ?? 'normal';
    if (load > 90) cap = Math.min(cap, 4);
    if (load > 120) cap = Math.min(cap, 3);
    if (load > 150) cap = Math.min(cap, 2);
    if (gfxTier === 'reduced') cap = Math.min(cap, 4);
    if (gfxTier === 'potato') cap = Math.min(cap, 2);
    if (GS.currentHordeWave) cap = Math.min(cap, Math.max(2, cap - 1));
    return Math.min(Math.max(0, steps), cap);
  }

  function setPaused(value, opts = {}) {
    if (GS.state !== 'playing') return;
    GS.paused = !!value;
    if (GS.paused) resetSimClock();
    if (typeof PacingTools !== 'undefined') {
      PacingTools.onPauseChanged(GS.paused, {
        paused: GS.paused,
        directShow: directShowMessage,
        reason: opts.reason || 'user',
      });
    }
    if (svc('UX')) svc('UX').onPauseChanged(GS.paused);
    if (!opts.silent) {
      showMessage(GS.paused ? 'Paused' : 'Resumed', 90, {
        priority: 'low',
        bypassQueue: true,
      });
    }
    syncInteractionState();
  }

  function togglePause() {
    if (GS.state !== 'playing') return;
    setPaused(!GS.paused);
  }

  function updatePerkCollectionLocal() {
    // Tonics open either between runs (MetaProgress) or by researching Tonic Stations
    // Science. The research path could build stations nobody was allowed to drink from.
    if (!isNightPhase() || !svc('Perks')) return;
    if (
      !svc('Perks').perkMachinesUnlocked() &&
      !(svc('Research') && svc('Research').isResearched?.('perk_science')) &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll)
    )
      return;
    for (const unit of GS.units) {
      if (!svc('Perks').isEligibleForPerks(unit) || unit.hp <= 0) continue;
      if (
        unit.building ||
        unit.garrisoned ||
        unit.wallGarrisoned ||
        hasPendingOutpostGarrison(unit)
      )
        continue;
      const slots = svc('Perks').getPerkSlots(unit);
      if ((unit.perks || []).length >= slots) continue;
      const target = svc('Perks').findBestPerkBuilding(unit, GS.buildings);
      if (!target) continue;
      const dist = Math.hypot(unit.x - target.x, unit.y - target.y);
      if (dist > 36) {
        if (unit.perkTargetId !== target.id) {
          unit.perkTargetId = target.id;
          unit.manualOrder = false;
          setUnitPath(unit, target.x, target.y - 8);
        }
        continue;
      }
      const perkId = target.perkId;
      if (svc('Perks').applyPerkToUnit(unit, perkId)) {
        unit.perkTargetId = null;
        svc('FloatingText').status(unit.x, unit.y, PerkDefs[perkId].name, '#c0ffa0');
      }
    }
  }

  function getDiagSnapshot() {
    let pathPending = 0;
    let manualOrders = 0;
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (!u || u.hp <= 0) continue;
      if (u.pathPending) pathPending++;
      if (u.manualOrder) manualOrders++;
    }
    return {
      updateTick: GS.updateTick,
      unitCount: GS.units.length,
      projectileCount: GS.projectiles.length,
      pathPending,
      manualOrders,
      syncPathfindsThisTick: GS.syncPathfindsThisTick,
      pathfindBudget: GS.pathfindBudget,
      walkGridRebuildDue: !!GS.walkGridRebuildDue,
      timeOfDay: GS.timeOfDay,
      wave: GS.wave,
      paused: !!GS.paused,
      gameSpeed: GS.gameSpeed,
    };
  }

  function update() {
    // Micro hit-stop freezes sim for 1–2 frames on crits/kills — pure juice, no logic skip of draw
    if (
      typeof CombatFX !== 'undefined' &&
      (typeof GameFeedback === 'undefined' || GameFeedback.allowHitStop()) &&
      CombatFX.consumeHitStop?.()
    ) {
      CombatFX.update();
      svc('FloatingText')?.update?.();
      svc('Particles')?.update?.();
      if (svc('VisualPolish')) svc('VisualPolish').update();
      if (typeof GameFeedback !== 'undefined') GameFeedback.update();
      return;
    }
    // The last kill of a wave lands in slow motion.
    if (
      (typeof GameFeedback === 'undefined' || GameFeedback.allowHitStop()) &&
      SiegeLoop.consumeSlowMoSkip()
    ) {
      svc('FloatingText')?.update?.();
      svc('Particles')?.update?.();
      if (svc('VisualPolish')) svc('VisualPolish').update();
      return;
    }
    // The spoils choice is a modal: nothing advances until the player has chosen.
    if (GS.state === 'playing' && SiegeLoop.holdForSpoils(siegeCtx)) return;
    GS.updateTick++;
    if (GS.state === 'playing') {
      SiegeLoop.update(siegeCtx);
      if (typeof WarCamps !== 'undefined') WarCamps.update(warCampCtx);
      Roster.update(siegeCtx);
    }
    markUpdatePhase('update-begin', `w${GS.wave} u${GS.units.length}`);
    if (svc('Perf')) {
      svc('Perf').setUpdateTick(GS.updateTick);
      svc('Perf').begin('update');
    }
    const unitCount = GS.units.length;
    const gfxQ = getGfxQuality();
    GS.updateThrottleCtx = buildUpdateThrottleCtx(unitCount, gfxQ);
    GS.syncPathfindsThisTick = 0;
    GS.pathfindBudget = GameRuntime.pathfindBudgetFor(unitCount, {
      pathMult: gfxQ?.pathfindMult ?? 1,
      hordeActive: !!GS.currentHordeWave,
    });
    if (svc('Particles') || svc('FloatingText')) {
      const sceneLod = svc('SpriteLod') ? svc('SpriteLod').getSceneLod(unitCount, gfxQ) : 0;
      const fxMult = gfxQ?.particleMult ?? 1;
      svc('Particles')?.setBudget?.(unitCount, fxMult, sceneLod);
      svc('FloatingText')?.setBudget?.(unitCount, fxMult, sceneLod);
    }
    if (GS.updateTick % 90 === 0) {
      svc('FloatingText')?.prune?.(false);
      svc('Particles')?.prune?.(false);
    }
    if (GS.updateTick % 600 === 0) svc('Chronicles')?.prune?.();
    const buildSig = getIncompleteBuildSig();
    if (buildSig !== GS.incompleteBuildSig) {
      if (buildSig) {
        svc('Pathfinding').clearCache?.();
        GS.walkGridRebuildDue = true;
      }
      invalidateObstacles();
      GS.incompleteBuildSig = buildSig;
    }
    markUpdatePhase('paths-expire');
    expireStalePendingPaths();
    markUpdatePhase('paths-worker');
    applyWorkerPathResults();
    markUpdatePhase('spatial');
    rebuildSpatialIndex();
    updateCamera();
    if (GS.state !== 'playing') return;
    if (!GS.paused && svc('GameModes')) svc('GameModes').tickElapsed(16);

    if (GS.paused) return;

    const activeEnemies = countActiveEnemies();
    if (GS.spawnQueue.length > 0 || activeEnemies > 0) {
      const remaining = GS.spawnQueue.length + activeEnemies;
      if (GS.waveEnemyTotal > 0)
        GS.waveProgress = Math.max(0, Math.min(1, 1 - remaining / GS.waveEnemyTotal));
    }

    updateDayNightCycle();
    if (GS.wave >= 10 && GS.updateTick % 45 === 0) normalizeEnemyEconomyBuildings();
    if (GS.creativeMode && svc('CreativeTools')) {
      svc('CreativeTools').tickStress();
      svc('CreativeTools').tickRecord();
    }

    if (GS.rallyTimer > 0) GS.rallyTimer--;
    for (const u of GS.units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (u.doctrineDmgTimer > 0) u.doctrineDmgTimer--;
      if (u.doctrineMitTimer > 0) u.doctrineMitTimer--;
      if (u.doctrineSpeedTimer > 0) u.doctrineSpeedTimer--;
    }

    if (GS.courierCooldown > 0) {
      GS.courierCooldown--;
      if (GS.courierCooldown <= 0) {
        for (let i = 0; i < GS.units.length; i++) {
          const cu = GS.units[i];
          if (cu.type === 'courier') cu.courierReady = true;
        }
      }
    }

    if (GS.updateTick % 3 === 0) {
      for (const b of GS.buildings) {
        if (b.hp <= 0 || !b.complete || !b.moraleAura) continue;
        const rate = 0.018 * (b.moraleAura || 1);
        const radius = b.radius + 30;
        if (useSpatialQueries()) {
          const targets = spatialScratchQuery(
            b.x,
            b.y,
            radius,
            (e) => e.kind === 'unit' && e.ref?.team === 'player' && !e.ref?.demoralized
          );
          for (let ti = 0; ti < targets.length; ti++) {
            const u = targets[ti];
            u.morale = Math.min(u.maxMorale, u.morale + rate);
          }
        } else {
          const r2 = radius * radius;
          for (let i = 0; i < GS.units.length; i++) {
            const u = GS.units[i];
            if (u.team === 'player' && !u.demoralized && posDistSq(u.x, u.y, b.x, b.y) < r2) {
              u.morale = Math.min(u.maxMorale, u.morale + rate);
            }
          }
        }
      }
    }
    if (svc('ContentExpansion')) svc('ContentExpansion').updatePerTick();
    applyGeneralAura();
    GS.lastStandActive = GameDepth?.updateLastStand(GS.units) || false;
    if (GS.lastStandActive && GS.updateTick % 120 === 0) {
      svc('FloatingText').status(GS.worldW / 2, GS.rallyY - 30, 'LAST STAND', '#ffd700');
    }
    decayMoraleWitnesses();
    if (GS.moraleAlertCooldown > 0) GS.moraleAlertCooldown--;
    const playerGeneral = findPlayerGeneral();
    if (playerGeneral) updateGeneralRallyMission(playerGeneral);
    if (playerGeneral && GS.updateTick % 45 === 0) {
      let threat = 0;
      for (const e of GS.units) {
        if (e.team !== 'enemy' || e.hp <= 0) continue;
        if (unitCount > 50 && !isInView(e.x, e.y, 100, 160)) continue;
        const tgt = findEnemyMoveTarget(e);
        if (tgt.kind === 'unit' && tgt.target?.id === playerGeneral.id) threat++;
      }
      GS.generalThreatCount = threat;
    }
    // Cooldown so multi-foe combat does not thrash the message queue every 1.5s.
    if (playerGeneral && GS.generalThreatCount >= 2 && GS.generalThreatCd <= 0) {
      showMessage(`General threatened by ${GS.generalThreatCount} foes!`, 160);
      GS.generalThreatCd = 280;
    }
    if (GS.generalThreatCd > 0) GS.generalThreatCd--;
    for (const u of GS.units) {
      if (u.team === 'player' && u.demoralized && u.hp > 0 && playerGeneral && !u.garrisoned) {
        const d = unitDistance(u, playerGeneral);
        if (d > 55 && !u.manualOrder) {
          u.huntMode = false;
          if (!u.path?.length || u.pathTargetId !== playerGeneral.id) {
            setUnitPath(u, playerGeneral.x, playerGeneral.y, playerGeneral);
            u.pathTargetId = playerGeneral.id;
          }
        }
      }
      if (u.hazardBurnTick > 0) u.hazardBurnTick--;
      if (u.frostTimer > 0) {
        u.frostTimer--;
        if (u.frostTimer <= 0) u.hazardSlow = 1;
      }
      if (GS.hazards.length) {
        const hazardPhase =
          svc('UpdateThrottle')?.unitPhase?.(u, 2) ??
          ((u.id?.charCodeAt(0) || 0) + (u.id?.charCodeAt(1) || 0)) % 2;
        const hazardTick =
          GS.hazards.length < 4 || u.team === 'player' || GS.updateTick % 2 === hazardPhase;
        if (!hazardTick) continue;
        GameDepth?.applyHazardToUnit(u, GS.hazards, svc('Spatial'));
      }
    }
    if (GS.hazards.length && svc('FactionHazards')) {
      svc('FactionHazards').tick(GS.hazards, GS.updateTick);
    }
    if (svc('NeutralWildlife')) {
      svc('NeutralWildlife').tick(GS.updateTick, GS.wave, {
        worldW: GS.worldW,
        worldH: GS.worldH,
        rallyY: GS.rallyY,
        territoryTier: GS.territoryTier,
        decorations: GS.decorations,
        units: GS.units,
        spawnUnit: (u) => GS.units.push(u),
        hooks: uiHooks(),
      });
    }
    if (svc('DynamicMapEvents')) {
      svc('DynamicMapEvents').tick(GS.updateTick, GS.wave, {
        worldW: GS.worldW,
        rallyY: GS.rallyY,
        units: GS.units,
        buildings: GS.buildings,
        damageUnit: (u, frac, opts = {}) => {
          if (u.hp <= 0) return;
          takeDamage(u, Math.max(1, u.maxHp * frac), opts);
        },
        hooks: {
          floatingText: floatStatus,
        },
      });
    }
    const castleGroup = getStationedCastleGroup();
    if (castleGroup && !GS.unmannedWallWarned) {
      let slots = 0,
        filled = 0;
      for (const wall of GS.buildings) {
        if (wall.castleGroup !== castleGroup || !wall.wallSlots) continue;
        for (const s of wall.wallSlots) {
          slots++;
          if (s.unitId) filled++;
        }
      }
      if (slots > 0 && filled < slots * 0.5) {
        GS.unmannedWallWarned = true;
        showMessage('Castle walls understaffed — deploy more footmen!', 220);
      }
    }

    for (const u of GS.units) {
      if ((u.lanternBlind || 0) > 0) u.lanternBlind--;
    }

    markUpdatePhase('garrisons');
    updateOutposts();
    updateCastleKeeps();
    updateWallGarrison();
    updateMedicalRetreats();
    const heavyLogic =
      !svc('UpdateThrottle') || svc('UpdateThrottle').shouldRunHeavyLogic(GS.updateTick, gfxQ);
    if (heavyLogic) {
      markUpdatePhase('hunt-paths');
      updateHuntPaths();
      updatePerkCollectionLocal();
    }

    const throttleCtx = svc('UpdateThrottle') ? buildUpdateThrottleCtx(unitCount, gfxQ) : null;

    markUpdatePhase('terrain-nudge');
    for (const unit of GS.units) {
      if (unit.hp <= 0) continue;
      if (GS.units.length > 40 && !isInView(unit.x, unit.y, 50, 0)) continue;
      if (isTerrainBlocked(unit.x, unit.y, unit)) nudgeUnitFree(unit);
    }

    markUpdatePhase('unit-ai', String(GS.units.length));
    for (const unit of GS.units) {
      if (unit.hp <= 0) continue;
      // Hit flash and honor glow count down here, once per tick, not in draw().
      if (unit.hitFlash > 0) unit.hitFlash--;
      if (unit.honorGlowTimer > 0) unit.honorGlowTimer--;
      const tier = throttleCtx ? svc('UpdateThrottle').getUnitTier(unit, throttleCtx) : 'full';
      const throttle = svc('UpdateThrottle');
      if (throttle?.shouldRunUnitAIMinimal(unit, tier, GS.updateTick)) {
        if (unit.attackAnimTimer > 0) {
          unit.attackAnimTimer--;
          unit.frameTimer++;
          if (unit.frameTimer > 6) {
            unit.frame = (unit.frame + 1) % 4;
            unit.frameTimer = 0;
          }
        }
        if (unit.fleeing) {
          updateFleeingUnit(unit);
          continue;
        }
        if (unit.demoralized) continue;
        if (unit.combatType === 'healer') {
          if (manualMoveReached(unit)) {
            unit.path = [];
            unit.pathIndex = 0;
            finishManualOrder(unit);
          }
          if (!unit.pinned && unit.attackAnimTimer <= 0) followPath(unit);
          updateHealer(unit);
        } else if (unit.team === 'enemy') {
          if (unit.path?.length && unit.attackAnimTimer <= 0 && !unit.pinned) {
            followPath(unit);
          } else if (!unit.path?.length || (unit.pathPending && (unit.pathWaitTicks || 0) >= 10)) {
            updateEnemyAI(unit);
          }
        } else if (unit.path?.length && unit.attackAnimTimer <= 0 && !unit.pinned) {
          followPath(unit);
        }
        if (unit.combatTargetId) updateUnitCombat(unit);
        continue;
      }
      if (unit.pinned) {
        unit.pinTimer = (unit.pinTimer || 0) - 1;
        if (unit.pinTimer <= 0) unit.pinned = false;
      }
      if (unit.attackAnimTimer > 0) {
        unit.attackAnimTimer--;
        if (unit.attackAnimTimer <= 0) unit.animState = 'idle';
      }
      if (!throttle || throttle.shouldAnimateUnit(tier, unit)) {
        unit.frameTimer++;
        if (unit.frameTimer > 6) {
          unit.frame = (unit.frame + 1) % 4;
          unit.frameTimer = 0;
        }
      }

      if (unit.rallyTimer > 0) unit.rallyTimer--;
      if (unit.isGeneral && unit.hp > 0) {
        unit.generalAliveTimer = (unit.generalAliveTimer || 0) + 1;
        if ((unit.w2wBuffTimer || 0) > 0) unit.w2wBuffTimer--;
      }

      if (unit.team === 'player' && (unit.retreatingToMed || unit.atMedicalTent)) {
        if (unit.atMedicalTent) {
          unit.animState = 'idle';
          continue;
        }
        const tent = resolveMedicalRetreatTent(unit);
        if (tent) marchToMedicalTent(unit, tent);
        // Waiting outside a full tent, he still strikes whatever comes within reach.
        if (unit.medQueued && !unit.atMedicalTent) updateUnitCombat(unit);
        continue;
      }

      if (unit.fleeing) {
        updateFleeingUnit(unit);
        continue;
      }
      if (unit.demoralized) {
        unit.animState = 'idle';
        continue;
      }
      if (unit.combatTargetId || unit.pathTargetId) sanitizeUnitPursuit(unit);

      updateCavalryCharge(unit);
      if (unit.isDoomslayer) updateAbyssWalkerAI(unit);

      if (unit.combatType === 'healer') {
        if (!unit.pinned && unit.attackAnimTimer <= 0) followPath(unit);
        updateHealer(unit);
        if (unit.team === 'enemy') updateUnitCombat(unit);
      } else if (unit.team === 'player') {
        updateBuilder(unit);
        const onRallyMission = unit.isGeneral && unit.rallyTargetId;
        // Garrisoned / keep / wall: fire only (no path thrash) — but honor manual move orders.
        if ((unit.garrisoned || unit.stationedKeep || unit.wallGarrisoned) && !unit.manualOrder) {
          if (!unit.retreatingToMed && !unit.atMedicalTent && !onRallyMission) {
            updateUnitCombat(unit);
          }
          continue;
        }
        if (unit.manualOrder && (unit.garrisoned || unit.stationedKeep || unit.wallGarrisoned)) {
          // Safety: click-to-move should always eject from posts.
          if (unit.garrisoned || hasPendingOutpostGarrison(unit)) releaseFromGarrison(unit);
          if (unit.stationedKeep) releaseFromKeep(unit);
          if (unit.wallGarrisoned || isMarchingToWallSlot(unit)) releaseFromWallGarrison(unit);
        }
        const marchingToOutpost = hasPendingOutpostGarrison(unit);
        const marchingToKeep = isMarchingToKeep(unit);
        const marchingToWall = isMarchingToWallSlot(unit);
        if (onRallyMission) {
          if (unit.attackAnimTimer <= 0 && !unit.pinned) followPath(unit);
        } else if (unit.type !== 'builder' || !unit.building) {
          // Manual click-to-move always walks (even while enemies are in range) so units
          // don't freeze on characters/enemies mid-order.
          if (unit.manualOrder && !unit.pinned) {
            followPath(unit);
          } else {
            const foe = findCombatTarget(unit);
            const fighting = foe && inAttackRange(unit, foe);
            const mayWalk =
              !fighting &&
              !marchingToOutpost &&
              !marchingToKeep &&
              !marchingToWall &&
              !unit.retreatingToMed &&
              !unit.atMedicalTent &&
              unit.attackAnimTimer <= 0 &&
              !unit.pinned;
            if (
              mayWalk ||
              marchingToOutpost ||
              marchingToKeep ||
              marchingToWall ||
              unit.retreatingToMed
            ) {
              followPath(unit);
            }
          }
        }
        updatePlayerStructureAttack(unit);
        if (!unit.retreatingToMed && !unit.atMedicalTent && !onRallyMission) updateUnitCombat(unit);
      } else if (unit.team === 'neutral') {
        if (svc('NeutralWildlife')) {
          svc('NeutralWildlife').updateAI(unit, {
            wave: GS.wave,
            units: GS.units,
            steerToward,
            inAttackRange,
            fireWeapon,
            lineOfSight,
          });
        }
      } else {
        updateEnemyAI(unit);
        updateEnemySiege(unit);
        updateEnemyWallAttack(unit);
        updateUnitCombat(unit);
      }
    }

    markUpdatePhase('buildings-breach');
    checkCastleCompoundBreaches();

    const prevBuildings = GS.buildings.length;
    for (let i = GS.buildings.length - 1; i >= 0; i--) {
      if (GS.buildings[i].hp <= 0) {
        finalizeBuildingDestroyed(GS.buildings[i], { silent: true, playDeath: false });
      }
    }
    if (GS.buildings.length !== prevBuildings) invalidateObstacles();

    markUpdatePhase('projectiles', String(GS.projectiles.length));
    StrikeFX?.simTick?.();
    for (let pi = GS.projectiles.length - 1; pi >= 0; pi--) {
      const p = GS.projectiles[pi];
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      let remove = dist < 0.01;
      if (!remove) {
        p.angle = Math.atan2(dy, dx);
        const trailOk =
          !svc('GfxQuality') || svc('GfxQuality').allowProjectileTrails(GS.projectiles.length);
        const trailEvery = gfxQ?.trailEveryN ?? 1;
        if (trailOk && GS.updateTick % trailEvery === 0) {
          if (globalThis.ProjectileArt) globalThis.ProjectileArt.trail(p, GS.updateTick);
          else svc('Particles').trail(p.x, p.y, p.type === 'arrow' ? '#8a6030' : '#a060ff');
        }
        if (dist < p.speed) {
          const hit = getUnitById(p.targetId);
          const shooter = p.sourceId ? getUnitById(p.sourceId) : null;
          // p.accuracy already paid the enemy sight penalty when the shot was fired.
          if (hit?.hp > 0 && Math.random() * 100 <= p.accuracy) {
            p.landed = true;
            // Prefer live shooter so vet/aura/crossover/WWE modifiers apply (not a bare damage stub).
            const src =
              shooter && shooter.hp > 0
                ? shooter
                : {
                    damage: p.damage,
                    experience: 0,
                    type: p.sourceType || 'archer',
                    team: p.team,
                    combatType: 'ranged',
                    projectile: p.type || 'arrow',
                  };
            // Snapshot projectile damage at fire time when shooter still lives.
            const dmgSrc =
              shooter && shooter.hp > 0 ? { ...shooter, damage: p.damage ?? shooter.damage } : src;
            const dmg = calcDamage(dmgSrc, hit, 8);
            takeDamage(hit, dmg, { attackerTeam: p.team, attacker: shooter || null });
            if (shooter && shooter.hp > 0) {
              applyChampionOnHit(shooter, hit, dmg);
              applyHeroOnHit(shooter, hit, dmg);
              if (shooter.hasElementalPop && svc('Perks')?.applyElementalPopSplash) {
                svc('Perks').applyElementalPopSplash(shooter, hit, GS.units, takeDamage);
              }
            }
            if (p.splash) {
              svc('Particles').explosion(hit.x, hit.y);
              let splashHits = 0;
              // Splash must hit foes of the *projectile owner*, not allies of the primary hit.
              // (Using hit.team inverted mage splash onto friendlies.)
              const splashTargets = useSpatialQueries()
                ? spatialScratchQuery(
                    hit.x,
                    hit.y,
                    40,
                    (e) =>
                      e.kind === 'unit' &&
                      e.ref?.team !== p.team &&
                      e.ref?.hp > 0 &&
                      e.ref?.id !== hit.id
                  )
                : GS.units.filter((u) => u.team !== p.team && u.hp > 0 && u.id !== hit.id);
              const splashR2 = 1600;
              for (let si = 0; si < splashTargets.length; si++) {
                const u = splashTargets[si];
                if (posDistSq(u.x, u.y, hit.x, hit.y) < splashR2) {
                  takeDamage(u, Math.round(dmg * 0.45), {
                    attackerTeam: p.team,
                    splash: true,
                    attacker: shooter || null,
                  });
                  splashHits++;
                }
              }
              if (splashHits >= 1) ach('mage_splash', { hitCount: splashHits + 1 });
            }
            if (shooter?.hasDoubleTap && hit.hp > 0 && Math.random() < 0.4) {
              takeDamage(hit, Math.round(dmg * 0.55), { attackerTeam: p.team });
            }
          }
          globalThis.ProjectileArt?.impact?.(p, hit);
          remove = true;
        } else {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
        }
      }
      if (remove) {
        GS.projectiles[pi] = GS.projectiles[GS.projectiles.length - 1];
        GS.projectiles.pop();
      }
    }

    if (heavyLogic) {
      markUpdatePhase('stuck-recovery');
      updateStuckRecovery();
    }

    markUpdatePhase('purge-dead');
    purgeDeadUnits();
    refreshUnitCounts();
    markUpdatePhase('overlaps');
    resolveOverlaps();
    // After overlaps: hard-plant holders on station / walk anyone displaced back home.
    markUpdatePhase('hold-posts');
    updateHuntSweep();
    updateManualMarches();
    updateHoldPosts();
    updatePostReturn();
    for (let mi = GS.attackMarks.length - 1; mi >= 0; mi--) {
      if (--GS.attackMarks[mi].life <= 0) GS.attackMarks.splice(mi, 1);
    }
    for (let mi = GS.moveMarkers.length - 1; mi >= 0; mi--) {
      if (--GS.moveMarkers[mi].life <= 0) {
        GS.moveMarkers[mi] = GS.moveMarkers[GS.moveMarkers.length - 1];
        GS.moveMarkers.pop();
      }
    }
    for (let mi = GS.messages.length - 1; mi >= 0; mi--) {
      if (--GS.messages[mi].life <= 0) {
        GS.messages[mi] = GS.messages[GS.messages.length - 1];
        GS.messages.pop();
      }
    }
    if (GS.messages.length > 24) GS.messages.length = 24;
    if (GS.fallenPool.length > 48) GS.fallenPool.splice(0, GS.fallenPool.length - 48);
    sanitizeTactical();
    if (svc('GfxQuality')) {
      const alive = unitCounts.player + unitCounts.enemy;
      const fps = svc('Perf') ? svc('Perf').getStats().fps : 60;
      svc('GfxQuality').tick(fps, alive);
    }
    if (svc('Perf')) {
      svc('Perf').end('update');
      svc('Perf').tick({
        army: unitCounts.player,
        enemyCount: unitCounts.enemy,
        buildingCount: GS.buildings.length,
      });
    }
    markUpdatePhase('update-end', `syncPaths=${GS.syncPathfindsThisTick}`);
    if (svc('Research')) {
      svc('Research').tick({
        wave: GS.wave,
        buildings: GS.buildings,
        isNight: isNightPhase(),
        showMessage,
      });
      if (svc('UX')) svc('UX').onResearchTick?.();
    }
    checkPlayerElimination();
  }

  function quitToMenu() {
    if (GS.state === 'playing' && !GS.creativeMode && typeof Analytics !== 'undefined') {
      Analytics.onRunAbandon(GS.wave);
    }
    if (svc('GameModes')) svc('GameModes').endSession();
    GS.state = 'menu';
    SiegeLoop.endRun();
    GS.paused = false;
    const audio = svc('AudioEngine') || (typeof AudioEngine !== 'undefined' ? AudioEngine : null);
    try {
      audio?.stopMusic?.();
    } catch (_) {
      /* audio optional */
    }
    if (typeof UI !== 'undefined' && UI.showMainMenu) UI.showMainMenu();
    else document.getElementById('menu-screen')?.classList.add('active');
    audio?.resume?.()?.then?.((ok) => {
      if (ok) audio.startMenuMusic?.();
    });
    if (svc('UX')) {
      svc('UX').clearTutorialHighlights?.();
      svc('UX').onPauseChanged(false);
    }
  }

  function isPlaying() {
    return GS.state === 'playing';
  }

  function toggleBuilderAutoRepair() {
    GS.builderAutoRepair = !GS.builderAutoRepair;
    showMessage(`Builder auto-repair: ${GS.builderAutoRepair ? 'ON' : 'OFF'}`, 160);
    syncInteractionState();
    return GS.builderAutoRepair;
  }

  function getAcademyBuildStatus(type) {
    const mentorType = getAcademyMentorUnitType(type);
    const mentorName = mentorType
      ? getPlayerUnitDef(mentorType)?.name || formatUnitTypeName(mentorType)
      : '';
    const mentorRank = mentorType ? getMaxVeteranRankName(mentorType) : '';
    const hasMentor = hasAcademyMentorOnField(type, GS.units);
    const mentorOk = canBuildAcademyType(type, GS.wave, GS.units);
    const researchOpts = getResearchOpts();
    const researchOk =
      (GS.creativeMode && GS.creativeSettings.unlockAll) ||
      !svc('Research') ||
      svc('Research').isBuildUnlocked(type, researchOpts);
    let reason = getAcademyBuildBlockReason(type, GS.wave, GS.units);
    if (!reason && !researchOk) {
      reason = `Not open yet: ${svc('Research').getLockReason('build', type) || 'its charter has not arrived'}.`;
    }
    // Best on-field progress toward mentor for tooltips
    let mentorProgress = 0;
    if (mentorType) {
      for (const u of GS.units) {
        if (u.team !== 'player' || u.hp <= 0 || u.type !== mentorType) continue;
        mentorProgress = Math.max(mentorProgress, u.vetTier || 0);
      }
    }
    return {
      canBuild: mentorOk && researchOk,
      hasMentor,
      mentorOk,
      researchOk,
      reason,
      mentorType,
      mentorName,
      mentorRank,
      mentorProgress,
      mentorNeed: MAX_VETERAN_TIER,
    };
  }

  // Split modules call back into this file and each other through these names.
  const internals = Object.assign(
    {},
    GameField,
    GameCamera,
    GameInput,
    GameStance,
    GameMorale,
    GameCombat,
    GameTargeting,
    GameMovement,
    GameArmy,
    GameBuildings,
    GameGarrison,
    GameMedical,
    GameUnitAi,
    GameWaves,
    GameDayNight,
    GameCampaign,
    GameCommands,
    GameCreative,
    GameRender,
    GameRosterUi,
    GameSave,
    GameViewState,
    {
      CREATIVE_DEFAULTS,
      DRAG_THRESHOLD,
      TP_SANITY_CAP,
      ach,
      ackInteraction,
      announceHooks,
      applyWorldSize,
      buildSelectedUnitsDigest,
      cachedSnap,
      checkRosterSynergy,
      clearPlacementModes,
      clearSelection,
      directShowMessage,
      endGame,
      floatStatus,
      getAsymmetricContext,
      getAsymmetricMods,
      getAsymmetricSnapshot,
      getCreativeSettingsSig,
      getDifficulty,
      getDifficultyPercent,
      getKingdomStageCached,
      getNightPrepTicks,
      getProgressionRestartCtx,
      getThematicSynSnap,
      invalidateStateCache,
      isEnemyHiddenByFog,
      pathSnap,
      refreshUnitCounts,
      setPaused,
      showMessage,
      siegeCtx,
      start,
      syncInteractionState,
      uiHooks,
      warCampCtx,
      wireGameContext,
    }
  );
  for (const mod of [
    GameField,
    GameCamera,
    GameInput,
    GameStance,
    GameMorale,
    GameCombat,
    GameTargeting,
    GameMovement,
    GameArmy,
    GameBuildings,
    GameGarrison,
    GameMedical,
    GameUnitAi,
    GameWaves,
    GameDayNight,
    GameCampaign,
    GameCommands,
    GameCreative,
    GameRender,
    GameRosterUi,
    GameSave,
    GameViewState,
  ]) {
    mod.bind(internals);
  }

  return {
    init,
    start,
    update,
    updatePresentation,
    draw,
    handleClick,
    isPlaying,
    selectDeploy,
    getDeployCost,
    getDeployCostMult,
    getTactical: () => GS.tactical,
    selectAbility,
    useAbility,
    selectBuild,
    selectDemolish,
    selectMoveBuilding,
    selectRotateWall,
    cycleWallPlacementFacing,
    executeSpyAction,
    sendCourierMessage,
    executeDoctrine,
    executeCounterDoctrine,
    dispatchExpedition,
    dispatchRaidStrike,
    respondMapEvent,
    orderHunt,
    orderHoldHere,
    toggleBuilderAutoRepair,
    clearSelection,
    selectUnit,
    clearPlacementMode,
    togglePause,
    setPaused,
    beginPresentationFrame,
    getHudRevision,
    getState,
    getDiagSnapshot,
    setGameSpeed,
    cycleGameSpeed,
    resetSimClock,
    getSimulationSteps,
    getSelectedUnitsInfo,
    getMinimapData,
    panCameraToFraction,
    focusSelection,
    returnSelectionToPosts,
    setSelectedHunt,
    toggleSelectedHunt,
    setSelectionFormation,
    reformSelectionFormation,
    moveSelectionToWorld,
    attackSelection,
    /** War camps: test and creative hooks (raise one, hit one, read the damage a soldier does). */
    warCampHooks: {
      ctx: () => warCampCtx,
      raise: (opts) =>
        typeof WarCamps !== 'undefined' ? WarCamps.raiseCamp(warCampCtx, opts) : null,
      hit: (b, amount) => damageBuilding(b, amount, null),
      damageOf: (unit, b) => calcBuildingDamage(unit, b),
    },
    restartCurrentWave,
    quickSave,
    quickLoad,
    hasQuickSave,
    getQuickSaveMeta,
    quitToMenu,
    getSessionHighlights,
    exportGameState,
    SAVE_VERSION,
    isSupportedSaveVersion,
    importGameState,
    getLastLoadReport,
    getSaveBlockReason,
    setDifficulty,
    hireChampion,
    hireHero,
    applyCheatEffect,
    markCheatsUsed,
    cheatsUsed: () => !!GS.cheatsUsed,
    getDifficulty,
    getDifficultyPercent,
    beginDayPhase,
    isDayPhase,
    isNightPhase,
    isCreativeMode,
    startCreative,
    setCreativeSetting,
    applyCampaignRulesPreset,
    creativeSetTool,
    creativeSetWave,
    creativeSetTp,
    creativeAddTp,
    creativeForceNight,
    creativeForceDay,
    creativeStartWave,
    creativeLaunchCustomWave,
    setCustomWave,
    getCustomWave,
    creativeClearWaveSpawns,
    creativeClearEnemies,
    creativeClearEnemyBuildings,
    creativeHealAll,
    creativeMaxMorale,
    creativeRankUpSelected,
    creativeMaxStarsSelected,
    creativeHealSelected,
    creativeKillSelected,
    creativePromoteSelectedGeneral,
    creativeSpawnEnemyAt,
    creativeSpawnPlayerAt,
    creativeSpawnPlayerBuildingAt,
    creativeSpawnEnemyBuildingAt,
    creativeResetUnitToDef,
    creativeApplyStatEditor,
    creativeFillStatEditorFromSelection,
    creativeRegenerateMap,
    getLevelSnapshot,
    loadCreativeLevel,
    getDecorationsSnapshot,
    creativePlaceDecoration,
    creativeEraseAt,
    creativeMoveUnitTo,
    creativeMoveBuildingTo,
    creativeMoveDecorationTo,
    creativeClearDecorations,
    creativeClearAllBuildings,
    creativeClearAllUnits,
    applyCreativeUnitPreset,
    applyCreativeUnitStats,
    takeDamage,
    getUnitsSnapshot,
    getBuildingsSnapshot,
    getBuildingsForResearch,
    restoreCreativeSnapshot,
    getWorldCenter,
    randomMapEdgePos,
    countEnemies,
    showMessage,
    getUnitById,
    getAcademyBuildStatus,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    trackPointer,
    zoomCameraAt,
    zoomCameraToScale,
    getCameraZoom,
    isScreenInMapArea,
    setCameraKey,
    onSettingsChanged,
    setLoadout: (id) => svc('ContentExpansion') && svc('ContentExpansion').setLoadout(id),
    getLoadouts: () => (svc('ContentExpansion') ? svc('ContentExpansion').getLoadouts() : {}),
    startResearch,
    cancelResearch,
    startBranchTech,
    cancelBranchTech,
    upgradeSelectedVeteran,
    raiseVeteran: (id) => GameArmy.raiseVeteran(id),
    forgetSelectedTrait: (id) => GameArmy.forgetSelectedTrait(id),
    ascendSelectedUnit,
    recruitSelectedEcho,
    getAsymmetricMods,
  };
})();

if (typeof GameServices !== 'undefined') {
  GameServices.registerFromGlobals();
  if (typeof GameData !== 'undefined') {
    GameServices.registerDefs({
      units: GameData.units,
      buildings: GameData.buildings,
      enemies: GameData.enemies,
      abilities: GameData.abilities,
      spyActions: GameData.spyActions,
      fxLife: GameData.fxLife,
      synergies: GameData.synergies,
    });
  }
  if (typeof Game !== 'undefined') GameServices.register('Game', Game);
}

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Game = Game;
