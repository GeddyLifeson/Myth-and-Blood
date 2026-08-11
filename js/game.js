/**
 * Myth and Blood — full tactical systems.
 */
const Game = (() => {
  // Pure primitives live in js/game-core.js (loaded first); bind them locally so
  // existing call sites keep using bare names.
  const {
    cameraKeys,
    unitCounts,
    QUICKSAVE_KEY,
    DECO_GAP,
    UNIT_COLLISION,
    MELEE_STANDOFF,
    FELLOWSHIP_MORALE_HIGH_RATIO,
    MARTIAL_MELEE_FOCUS_RATIO,
    DRAGON_THEMED_ABILITIES,
    STAND_ALLIANCE_MIN_HEROES,
    KI_ENERGY_HIGH_RATIO,
    SHOWMANSHIP_HEAVY_MIN_UNITS,
    SHOWMANSHIP_HEAVY_RATIO,
    KI_ENERGY_ABILITIES,
    tacticalFoeCap,
    tacticalFoeBest,
    tacticalFoeBestD,
    svc,
    playSfx,
    wireGameServices,
    clampCameraAxis,
    getPanelInsets,
    setCameraKey,
    unitFootprint,
    overlapsPlacedDecorations,
    isPlayerFriendlyWall,
    isPlayerMarchingOrder,
    clearHoldPost,
    hasHoldPost,
    distToHoldPost,
    enemyIsAdvancing,
    getGfxQuality,
    spatialScratchQuery,
    releaseUnitRecord,
    releaseBuildingRecord,
    isKiEnergyCombatUnit,
    sampleKiEnergyArmy,
    isHeroUnit,
    sampleShowmanshipArmy,
    isMajorBossUnit,
    isDragonThemedUnit,
    sampleCrossoverHeroAlliance,
    getUnitCombatRole,
    sampleMeleeFocusedArmy,
    isMoraleCombatUnit,
    samplePlayerArmyMorale,
    moraleBreakThreshold,
    isValidCombatFoe,
    clearUnitPathAsync,
    releaseCombatPursuit,
    countActiveEnemies,
    isMeleeCombat,
    getGeneralBuffStrengthLegacy,
    getAdvancedMods,
    getFogVisionMult,
    gameRandom,
    countGarrisoned,
    countPlayerHamlets,
    countPlayerGuilds,
    getCrossoverBuildingsOnField,
    getWweOnField,
    getCrossoverOnField,
    ensurePlayerUnitDef,
    getHamletTpBonus,
    getMerchantGuildTpBonus,
    getRawSettlementTpBonus,
    getSettlementTpBonus,
    getEnemyEconomySpawnBonus,
    ensureBuildingHealth,
    getEnemyEconomyHpMult,
    isEnemyEconomyUnderConstruction,
    bootstrapEnemyEconomyForWave,
    countEnemies,
    applyCreativeUnitStats,
    applyCreativeUnitPreset,
    specialistStarColor,
    unitDistance,
    unitDistSq,
    posDistSq,
    getApproachPoint,
    slotAngleOffset,
    getMeleeRing,
    trimFoeListToNearest,
    canDeployWithTP,
    getDeployCostMult,
    enemyRotationForSide,
    isUnitProducingBuilding,
    countLivePlayerUnits,
    isPlayerEliminated,
    announceRtsEra,
    allowsCampaignEconomyVictory,
    getRunModeId,
    tryPlaceEnemyBuilding,
    updateEnemyEconomy,
    updateEnemyRTS,
    pathClearanceForUnit,
    unitBlocksMovement,
    getSpawnFillSeed,
    normalizeGameSpeed,
    hasCourier,
    getBuildingRefund,
    manualMoveReached,
    getHamletFortressWallLayout,
    strikeImpactFx,
    isPlayerMageUnit,
    isBehindWall,
    countPlayerWalls,
    countPlayerFortifications,
    shouldReleaseOutpostGarrison,
    isRangedGarrisonCandidate,
    isGeneralCandidate,
    foeThreatensWallManning,
    wallFacingRotation,
    isWallManningExcludedUnit,
    isFootmanWallCandidate,
    ensureWallSlots,
    isMedicalTentBuilding,
    getMedicalTentSlot,
    needsMedicalRetreat,
    isSiegeableStructure,
    structureEdgeDistance,
    inEnemyStructureAttackRange,
    isEnemySiegeAttacker,
    calcEnemySiegeDamage,
    isBuildingPathTarget,
    getTotalStarCount,
    countBuilderProjects,
    assignBuildingToBuilder,
    builderHasWork,
    markUpdatePhase,
    getQuickSaveMeta,
    hasQuickSave,
  } = GameCore;

  

  

  // Mutable run state lives in the shared holder from js/game-state.js. Every
  // binding below was a closure-local `let`; moving them onto an object is what
  // lets subsystems be lifted out of this IIFE into their own files.
  const GS = GameState;

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
  const CAMERA_MIN_ZOOM = 0.4;
  const CAMERA_MAX_ZOOM = 8;
  const CAMERA_ARROW_SPEED = 9;
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
  GS.grandStrategyHookFns = null;
  GS.thematicSynSnapTick = -1;
  GS.thematicSynSnapCache = null;
  GS.snapCacheTick = -1;
  const snapCache = {};
  GS.hudRevision = 0;
  GS.hudRevisionSig = '';
  GS.evolutionMeterTick = -1;
  GS.evolutionMeterCache = null;
  GS.updateThrottleCtx = null;
  GS.macroPanelRenderTick = 0;
  const MACRO_PANEL_RENDER_EVERY = 5;
  GS.castleAnchorTick = -1;
  const castleAnchorCache = new Map();
  const exportUnitsScratch = [];
  const overlapNeighborsScratch = [];
  GS.cachedSelectedSet = null;
  GS.cachedSelectionSig = '';
  GS.visibleBoundsCore = null;
  GS.state = 'menu';
  GS.units = [];
  GS.projectiles = [];
  GS.decorations = [];
  GS.buildings = [];
  GS.moveMarkers = [];
  GS.tactical = STARTING_TP;
  GS.wave = 0;
  GS.kills = 0;
  GS.misses = 0;
  GS.runPlayerDeaths = 0;
  GS.playerCasualtiesThisWave = 0;
  GS.structuresRazedThisWave = 0;
  GS.runStructuresRazed = 0;
  GS.castleBreachWarned = false;
  GS.castleBreachRecorded = false;
  GS.spawnQueue = [];
  GS.spawnTimer = 0;
  GS.waveTimer = 0;
  GS.spawnDelayBonus = 0;
  /** Set once wave 1 terrain is generated; map only grows via syncMapGrowth after that. */
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
  const PATH_BUDGET_WARN_INTERVAL = 120;
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
  GS.multiFrontPlan = null;
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

  function getMapBounds() {
    return { minX: 14, maxX: GS.worldW - 14, minY: 20, maxY: GS.worldH - 8 };
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

  function getMapViewH() {
    return GS.worldH + 50;
  }

  function resetCamera() {
    GS.cameraZoom = 1;
    GS.cameraWorldX = GS.worldW / 2;
    GS.cameraWorldY = getMapViewH() / 2;
    GS.cameraPlaced = true;
    applyCamera();
  }

  /** Pan tactical camera to a world point (sector assault focus). */
  function focusWorld(wx, wy, opts = {}) {
    if (Number.isFinite(wx)) GS.cameraWorldX = wx;
    if (Number.isFinite(wy)) GS.cameraWorldY = wy;
    if (opts.zoom != null && Number.isFinite(opts.zoom)) {
      GS.cameraZoom = Math.max(0.55, Math.min(2.2, opts.zoom));
    }
    GS.cameraPlaced = true;
    applyCamera();
  }

  function getCameraViewport() {
    const insets = getPanelInsets();
    const width = Math.max(1, GS.canvas.width - insets.left - insets.right);
    const height = Math.max(1, GS.canvas.height - insets.top - insets.bottom);
    return {
      left: insets.left,
      top: insets.top,
      width,
      height,
      centerX: insets.left + width / 2,
      centerY: insets.top + height / 2,
    };
  }

  

  function sanitizeCameraState() {
    const mapH = getMapViewH();
    if (!Number.isFinite(GS.cameraZoom) || GS.cameraZoom <= 0) GS.cameraZoom = 1;
    GS.cameraZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, GS.cameraZoom));
    if (!Number.isFinite(GS.baseViewScale) || GS.baseViewScale <= 0) {
      if (GS.canvas) {
        const insets = getPanelInsets();
        const margin = 16;
        GS.baseViewScale = Math.min(
          (GS.canvas.width - insets.left - insets.right - margin) / Math.max(1, GS.worldW),
          (GS.canvas.height - insets.top - insets.bottom - margin) / Math.max(1, mapH)
        );
      } else {
        GS.baseViewScale = 1;
      }
    }
    if (!Number.isFinite(GS.cameraWorldX)) GS.cameraWorldX = GS.worldW / 2;
    if (!Number.isFinite(GS.cameraWorldY)) GS.cameraWorldY = mapH / 2;
  }

  /** Keep zoom/pan anchors inside the playable map viewport (not HUD chrome). */
  function clampScreenToViewport(sx, sy) {
    const vp = getCameraViewport();
    return {
      sx: Math.max(vp.left, Math.min(vp.left + vp.width, sx)),
      sy: Math.max(vp.top, Math.min(vp.top + vp.height, sy)),
    };
  }

  function isScreenInMapViewport(sx, sy) {
    const vp = getCameraViewport();
    return (
      sx >= vp.left &&
      sx <= vp.left + vp.width &&
      sy >= vp.top &&
      sy <= vp.top + vp.height
    );
  }

  /** Playable map band — excludes side/top HUD only (bottom hint/unit panel counts as map). */
  function isScreenInMapArea(sx, sy) {
    if (!GS.canvas) return false;
    const insets = getPanelInsets();
    return (
      sx >= insets.left &&
      sx <= GS.canvas.width - insets.right &&
      sy >= insets.top &&
      sy <= GS.canvas.height
    );
  }

  /** Derive canvas transform from camera center + zoom (single source of truth). */
  function syncCameraTransform() {
    if (!GS.canvas) return;
    sanitizeCameraState();
    const vp = getCameraViewport();
    GS.viewScale = GS.baseViewScale * GS.cameraZoom;
    if (!Number.isFinite(GS.viewScale) || GS.viewScale <= 0) GS.viewScale = Math.max(0.01, GS.baseViewScale);
    GS.viewX = vp.centerX - GS.cameraWorldX * GS.viewScale;
    GS.viewY = vp.centerY - GS.cameraWorldY * GS.viewScale;
  }

  function isMapOverlappingViewport() {
    if (!GS.canvas) return true;
    const mapH = getMapViewH();
    const vp = getCameraViewport();
    const scale = Number.isFinite(GS.viewScale) && GS.viewScale > 0 ? GS.viewScale : GS.baseViewScale * GS.cameraZoom;
    if (!Number.isFinite(scale) || scale <= 0) return false;
    const mapRight = GS.viewX + GS.worldW * scale;
    const mapBottom = GS.viewY + mapH * scale;
    const vpRight = vp.left + vp.width;
    const vpBottom = vp.top + vp.height;
    return GS.viewX < vpRight && mapRight > vp.left && GS.viewY < vpBottom && mapBottom > vp.top;
  }

  function clampCameraToBounds() {
    if (!GS.canvas) return;
    sanitizeCameraState();
    const mapH = getMapViewH();
    const vp = getCameraViewport();
    GS.viewScale = GS.baseViewScale * GS.cameraZoom;
    const halfW = vp.width / (2 * GS.viewScale);
    const halfH = vp.height / (2 * GS.viewScale);
    const edgeMargin = 2 / Math.max(GS.viewScale, 0.01);

    GS.cameraWorldX = clampCameraAxis(GS.cameraWorldX, GS.worldW, halfW, edgeMargin);
    GS.cameraWorldY = clampCameraAxis(GS.cameraWorldY, mapH, halfH, edgeMargin);

    syncCameraTransform();
    GS.visibleBoundsCore = null;
    GS.sortedUnitsFrame = -1;
  }

  function applyCamera() {
    clampCameraToBounds();
  }

  

  function resize() {
    if (!GS.canvas) return;
    const prevW = GS.canvas.width;
    const prevH = GS.canvas.height;
    const nextW = window.innerWidth;
    const nextH = window.innerHeight;
    const sizeChanged = prevW !== nextW || prevH !== nextH;
    if (sizeChanged) {
      GS.canvas.width = nextW;
      GS.canvas.height = nextH;
    }
    const insets = getPanelInsets();
    const margin = 16;
    const nextBase = Math.min(
      (GS.canvas.width - insets.left - insets.right - margin) / GS.worldW,
      (GS.canvas.height - insets.top - insets.bottom - margin) / getMapViewH()
    );
    const baseChanged = Math.abs(nextBase - GS.baseViewScale) > 1e-6;
    GS.baseViewScale = nextBase;
    if (!GS.cameraPlaced) {
      GS.cameraWorldX = GS.worldW / 2;
      GS.cameraWorldY = getMapViewH() / 2;
      GS.cameraPlaced = true;
    }
    if (sizeChanged || baseChanged) applyCamera();
    else syncCameraTransform();
  }

  function getVisibleBoundsCore() {
    if (GS.visibleBoundsCore) return GS.visibleBoundsCore;
    if (!GS.canvas) {
      return { left: -9999, top: -9999, right: 99999, bottom: 99999 };
    }
    const vp = getCameraViewport();
    GS.visibleBoundsCore = {
      left: (vp.left - GS.viewX) / GS.viewScale,
      top: (vp.top - GS.viewY) / GS.viewScale,
      right: (vp.left + vp.width - GS.viewX) / GS.viewScale,
      bottom: (vp.top + vp.height - GS.viewY) / GS.viewScale,
    };
    return GS.visibleBoundsCore;
  }

  function getVisibleBounds(pad = 90) {
    const core = getVisibleBoundsCore();
    const m = pad / Math.max(0.25, GS.viewScale);
    return {
      left: core.left - m,
      top: core.top - m,
      right: core.right + m,
      bottom: core.bottom + m,
    };
  }

  function isInView(x, y, radius = 0, pad = 90) {
    const b = getVisibleBounds(pad);
    return (
      x + radius >= b.left && x - radius <= b.right && y + radius >= b.top && y - radius <= b.bottom
    );
  }

  function updateCamera() {
    if (GS.state !== 'playing') return;
    let moved = false;
    const step = CAMERA_ARROW_SPEED / Math.max(0.55, GS.cameraZoom);
    if (cameraKeys.up) {
      GS.cameraWorldY -= step;
      moved = true;
    }
    if (cameraKeys.down) {
      GS.cameraWorldY += step;
      moved = true;
    }
    if (cameraKeys.left) {
      GS.cameraWorldX -= step;
      moved = true;
    }
    if (cameraKeys.right) {
      GS.cameraWorldX += step;
      moved = true;
    }
    if (moved) applyCamera();
  }

  function onSettingsChanged(opts = {}) {
    GS.visibleBoundsCore = null;
    if (svc('GfxQuality') && svc('Settings')) {
      svc('GfxQuality').setMode(svc('Settings').get('performanceMode') || 'auto');
    }
    if (opts.soft && GS.canvas) {
      const insets = getPanelInsets();
      const margin = 16;
      GS.baseViewScale = Math.min(
        (GS.canvas.width - insets.left - insets.right - margin) / GS.worldW,
        (GS.canvas.height - insets.top - insets.bottom - margin) / getMapViewH()
      );
      syncCameraTransform();
      return;
    }
    resize();
  }

  function zoomCameraAt(screenX, screenY, deltaY) {
    if (GS.state !== 'playing') return;
    const zoomSpeed = svc('Settings') ? svc('Settings').getCameraZoomSpeed() : 1;
    const step = 1 + 0.11 * zoomSpeed;
    const factor = deltaY < 0 ? step : 1 / step;
    zoomCameraToScale(screenX, screenY, GS.cameraZoom * factor);
  }

  function resolveZoomAnchor(screenX, screenY) {
    const vp = getCameraViewport();
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      return { sx: vp.centerX, sy: vp.centerY };
    }
    if (isScreenInMapViewport(screenX, screenY)) {
      return { sx: screenX, sy: screenY };
    }
    return clampScreenToViewport(screenX, screenY);
  }

  function zoomCameraToScale(screenX, screenY, targetZoom) {
    if (GS.state !== 'playing' || !GS.canvas) return;
    const nextZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, targetZoom));
    if (Math.abs(nextZoom - GS.cameraZoom) < 1e-6) return;

    const vp = getCameraViewport();
    ({ sx: screenX, sy: screenY } = resolveZoomAnchor(screenX, screenY));

    const anchorWorldX = GS.cameraWorldX + (screenX - vp.centerX) / GS.viewScale;
    const anchorWorldY = GS.cameraWorldY + (screenY - vp.centerY) / GS.viewScale;

    GS.cameraZoom = nextZoom;
    GS.viewScale = GS.baseViewScale * GS.cameraZoom;
    GS.cameraWorldX = anchorWorldX - (screenX - vp.centerX) / GS.viewScale;
    GS.cameraWorldY = anchorWorldY - (screenY - vp.centerY) / GS.viewScale;

    clampCameraToBounds();
  }

  function getCameraZoom() {
    return GS.cameraZoom;
  }

  function canBoxSelectNow() {
    return (
      !GS.selectedDeploy &&
      !GS.selectedAbility &&
      !GS.selectedBuild &&
      !GS.selectedCourierMsg &&
      !GS.selectedDemolish &&
      !GS.selectedMoveBuilding &&
      !GS.selectedRotateWall &&
      !(GS.creativeMode && GS.creativeTool)
    );
  }

  function getSelectedUnitIds() {
    return GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
  }

  function getSelectedLiveUnits() {
    return getSelectedUnitIds()
      .map((id) => getUnitById(id))
      .filter((u) => u && u.hp > 0);
  }

  function moveSelectionToWorld(tx, ty, formationId = GS.selectionFormation) {
    const liveUnits =
      typeof Formations !== 'undefined'
        ? Formations.sortUnitsForFormation(getSelectedLiveUnits())
        : getSelectedLiveUnits();
    if (!liveUnits.length) return false;
    const anchor = clampPos(tx, ty);
    const offsets =
      typeof Formations !== 'undefined'
        ? Formations.computeOffsets(liveUnits.length, formationId)
        : liveUnits.map((_, i) => ({
            x: liveUnits.length > 1 ? (i % 3) * 14 - 14 : 0,
            y: liveUnits.length > 1 ? Math.floor(i / 3) * 12 : 0,
          }));
    liveUnits.forEach((unit, i) => {
      const off = offsets[i] || { x: 0, y: 0 };
      orderMove(unit, anchor.x + off.x, anchor.y + off.y, true);
    });
    syncInteractionState();
    return true;
  }

  function setSelectionFormation(id, opts = {}) {
    if (typeof Formations === 'undefined' || !Formations.FORMATIONS[id]) return false;
    GS.selectionFormation = id;
    if (typeof Analytics !== 'undefined') Analytics.onFormationUsed(id);
    if (opts.announce) {
      showMessage(`Move formation: ${Formations.getLabel(id)}`, 100);
    }
    syncInteractionState();
    return true;
  }

  function cycleSelectionFormation() {
    if (typeof Formations === 'undefined') return GS.selectionFormation;
    GS.selectionFormation = Formations.nextFormationId(GS.selectionFormation);
    if (typeof Analytics !== 'undefined') Analytics.onFormationUsed(GS.selectionFormation);
    syncInteractionState();
    return GS.selectionFormation;
  }

  function reformSelectionFormation(formationId = GS.selectionFormation) {
    const live = getSelectedLiveUnits();
    if (live.length < 2) {
      showMessage('Select 2+ units to reform.');
      return false;
    }
    if (typeof Formations !== 'undefined' && !Formations.FORMATIONS[formationId]) {
      formationId = 'box';
    }
    GS.selectionFormation = formationId;
    if (typeof Analytics !== 'undefined') Analytics.onFormationUsed(formationId);
    let cx = 0;
    let cy = 0;
    for (const u of live) {
      cx += u.x;
      cy += u.y;
    }
    cx /= live.length;
    cy /= live.length;
    moveSelectionToWorld(cx, cy, formationId);
    const label =
      typeof Formations !== 'undefined' ? Formations.getLabel(formationId) : formationId;
    showMessage(`${label} formation — ${live.length} units`, 160);
    playSfx('click');
    syncInteractionState();
    return true;
  }

  function handlePointerDown(sx, sy, button = 0, opts = {}) {
    if (GS.state !== 'playing') return;
    GS.activeDragThreshold = opts.dragThreshold ?? DRAG_THRESHOLD;
    if (button === 0 && canBoxSelectNow()) {
      const world = screenToWorld(sx, sy);
      const onPlayerUnit = !!getUnitAt(world.x, world.y, 'player');
      const hasSelection = getSelectedUnitIds().length > 0;
      const wantBox =
        !!opts.boxSelect ||
        (opts.emptyDragSelect !== false &&
          !onPlayerUnit &&
          !opts.forcePan &&
          !(hasSelection && !opts.boxSelect));
      if (wantBox && !opts.forcePan) {
        GS.boxSelect = {
          startSx: sx,
          startSy: sy,
          endSx: sx,
          endSy: sy,
          additive: !!opts.additive,
        };
        GS.isPanning = false;
        GS.panAnchor = null;
        GS.dragMoved = false;
        return;
      }
    }
    if (button !== 0 && !opts.pan) return;
    GS.isPanning = true;
    GS.dragMoved = false;
    GS.panAnchor = { sx, sy, cx: GS.cameraWorldX, cy: GS.cameraWorldY };
  }

  function trackPointer(sx, sy) {
    GS.pointerScreen = { sx, sy };
  }

  function getPointerScreen() {
    return GS.pointerScreen;
  }

  function handlePointerMove(sx, sy) {
    trackPointer(sx, sy);
    if (GS.boxSelect) {
      GS.boxSelect.endSx = sx;
      GS.boxSelect.endSy = sy;
      const dx = sx - GS.boxSelect.startSx;
      const dy = sy - GS.boxSelect.startSy;
      if (
        !GS.dragMoved &&
        (Math.abs(dx) > GS.activeDragThreshold || Math.abs(dy) > GS.activeDragThreshold)
      ) {
        GS.dragMoved = true;
        if (GS.canvas) GS.canvas.style.cursor = 'crosshair';
      }
      return;
    }
    if (!GS.isPanning || !GS.panAnchor) return;
    const dx = sx - GS.panAnchor.sx;
    const dy = sy - GS.panAnchor.sy;
    if (!GS.dragMoved && (Math.abs(dx) > GS.activeDragThreshold || Math.abs(dy) > GS.activeDragThreshold)) {
      GS.dragMoved = true;
      GS.canvas.style.cursor = 'grabbing';
    }
    if (!GS.dragMoved) return;
    GS.cameraWorldX = GS.panAnchor.cx - dx / GS.viewScale;
    GS.cameraWorldY = GS.panAnchor.cy - dy / GS.viewScale;
    applyCamera();
  }

  function finalizeBoxSelect() {
    if (!GS.boxSelect) return;
    const x1 = Math.min(GS.boxSelect.startSx, GS.boxSelect.endSx);
    const y1 = Math.min(GS.boxSelect.startSy, GS.boxSelect.endSy);
    const x2 = Math.max(GS.boxSelect.startSx, GS.boxSelect.endSx);
    const y2 = Math.max(GS.boxSelect.startSy, GS.boxSelect.endSy);
    const w1 = screenToWorld(x1, y1);
    const w2 = screenToWorld(x2, y2);
    const minX = Math.min(w1.x, w2.x);
    const maxX = Math.max(w1.x, w2.x);
    const minY = Math.min(w1.y, w2.y);
    const maxY = Math.max(w1.y, w2.y);
    const ids = GS.units
      .filter(
        (u) =>
          u.team === 'player' &&
          u.hp > 0 &&
          u.x >= minX &&
          u.x <= maxX &&
          u.y >= minY &&
          u.y <= maxY
      )
      .map((u) => u.id);
    // Click without drag — preserve selection so handleClick can issue move orders.
    if (!GS.dragMoved && ids.length === 0) return;
    if (GS.boxSelect.additive) {
      const merged = new Set([...GS.selectedUnitIds, ...ids]);
      if (GS.selectedUnitId) merged.add(GS.selectedUnitId);
      GS.selectedUnitIds = [...merged];
    } else {
      GS.selectedUnitIds = ids;
    }
    GS.selectedUnitId = GS.selectedUnitIds[GS.selectedUnitIds.length - 1] || ids[0] || null;
    if (GS.selectedUnitIds.length) {
      showMessage(`${GS.selectedUnitIds.length} unit(s) selected.`, 120);
      playSfx('click');
    }
  }

  function handlePointerUp() {
    if (GS.boxSelect) {
      if (GS.dragMoved) finalizeBoxSelect();
      GS.boxSelect = null;
      GS.isPanning = false;
      GS.panAnchor = null;
      GS.dragMoved = false;
      if (GS.canvas) GS.canvas.style.cursor = 'grab';
      return !GS.dragMoved;
    }
    const wasClick = GS.isPanning && !GS.dragMoved;
    GS.isPanning = false;
    GS.panAnchor = null;
    GS.dragMoved = false;
    if (GS.canvas) GS.canvas.style.cursor = 'grab';
    return wasClick;
  }

  

  function screenToWorld(sx, sy) {
    const vp = getCameraViewport();
    return {
      x: GS.cameraWorldX + (sx - vp.centerX) / GS.viewScale,
      y: GS.cameraWorldY + (sy - vp.centerY) / GS.viewScale,
    };
  }

  function worldToScreen(wx, wy) {
    const vp = getCameraViewport();
    return {
      x: vp.centerX + (wx - GS.cameraWorldX) * GS.viewScale,
      y: vp.centerY + (wy - GS.cameraWorldY) * GS.viewScale,
    };
  }

  function clampPos(x, y) {
    const b = getMapBounds();
    return { x: Math.max(b.minX, Math.min(b.maxX, x)), y: Math.max(b.minY, Math.min(b.maxY, y)) };
  }

  

  

  function overlapsAnyUnit(x, y, obstacleRadius, margin = DECO_GAP) {
    for (const u of GS.units) {
      if (u.hp <= 0) continue;
      const reach = obstacleRadius + unitFootprint(u) + margin;
      if (posDistSq(x, y, u.x, u.y) < reach * reach) return true;
    }
    return false;
  }

  

  function overlapsBuildings(x, y, radius) {
    for (const b of GS.buildings) {
      const br = terrainBlockRadius(b);
      if (br <= 0) continue;
      const reach = radius + br + DECO_GAP;
      if (posDistSq(x, y, b.x, b.y) < reach * reach) return true;
    }
    return false;
  }

  function isDecorationSpotClear(x, y, radius, placed) {
    return (
      !overlapsAnyUnit(x, y, radius) &&
      !overlapsPlacedDecorations(x, y, radius, placed) &&
      !overlapsBuildings(x, y, radius)
    );
  }

  function pickDecorationSpot(type, placed, maxAttempts = 50) {
    const radius = type === 'tree' ? 14 : 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = 50 + Math.random() * (GS.worldW - 100);
      const y = 80 + Math.random() * (GS.worldH - 160);
      if (isDecorationSpotClear(x, y, radius, placed)) return { x, y, radius };
    }
    return null;
  }

  function resetTerrainForNewRun() {
    GS.terrainInitialized = false;
    GS.decorations = [];
    GS.hazards = [];
  }

  function ensureInitialBattlefield(force = false) {
    if (GS.terrainInitialized && !force) return false;
    generateBattlefield();
    return true;
  }

  /**
   * After a centered expand, old content lives in [ox, oy]..[ox+prevW, oy+prevH].
   * Sample only the new north / south / east / west bands.
   */
  function pickExpansionSpot(prevW, prevH, placed, radius, maxAttempts = 30) {
    const dW = Math.max(0, GS.worldW - prevW);
    const dH = Math.max(0, GS.worldH - prevH);
    const ox = dW / 2;
    const oy = dH / 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let x;
      let y;
      const roll = Math.random();
      const northH = oy;
      const southH = dH - oy;
      const westW = ox;
      const eastW = dW - ox;
      // Weight bands that actually grew this expansion.
      const bands = [];
      if (northH > 24) bands.push('north', 'north');
      if (southH > 24) bands.push('south', 'south');
      if (westW > 24) bands.push('west');
      if (eastW > 24) bands.push('east');
      const band = bands.length ? bands[Math.floor(Math.random() * bands.length)] : null;
      if (band === 'north') {
        x = 30 + Math.random() * Math.max(40, GS.worldW - 60);
        y = 12 + Math.random() * Math.max(16, northH - 20);
      } else if (band === 'south') {
        x = 30 + Math.random() * Math.max(40, GS.worldW - 60);
        y = oy + prevH + 12 + Math.random() * Math.max(16, southH - 24);
      } else if (band === 'west') {
        x = 12 + Math.random() * Math.max(16, westW - 20);
        y = 40 + Math.random() * Math.max(40, GS.worldH - 80);
      } else if (band === 'east') {
        x = ox + prevW + 12 + Math.random() * Math.max(16, eastW - 20);
        y = 40 + Math.random() * Math.max(40, GS.worldH - 80);
      } else if (dH > 0 && roll < 0.5) {
        x = 40 + Math.random() * (GS.worldW - 80);
        y = prevH + 20 + Math.random() * Math.max(20, GS.worldH - prevH - 40);
      } else if (dW > 0) {
        const side = dW / 2;
        const left = Math.random() < 0.5;
        x = left
          ? 16 + Math.random() * Math.max(12, side - 20)
          : GS.worldW - side + 8 + Math.random() * Math.max(12, side - 20);
        y = 60 + Math.random() * Math.max(40, GS.worldH - 120);
      } else {
        x = 50 + Math.random() * (GS.worldW - 100);
        y = 80 + Math.random() * (GS.worldH - 160);
      }
      if (isDecorationSpotClear(x, y, radius, placed)) return { x, y, radius };
    }
    return null;
  }

  /** Shift all world-space objects so growth is centered (land on every side). */
  function shiftWorldEntities(dx, dy) {
    if (!dx && !dy) return;
    const shiftOne = (o) => {
      if (!o) return;
      if (Number.isFinite(o.x)) o.x += dx;
      if (Number.isFinite(o.y)) o.y += dy;
      if (Number.isFinite(o.targetX)) o.targetX += dx;
      if (Number.isFinite(o.targetY)) o.targetY += dy;
      if (Number.isFinite(o.holdX)) o.holdX += dx;
      if (Number.isFinite(o.holdY)) o.holdY += dy;
      if (Number.isFinite(o.pendingHoldX)) o.pendingHoldX += dx;
      if (Number.isFinite(o.pendingHoldY)) o.pendingHoldY += dy;
      if (Number.isFinite(o.slotX)) o.slotX += dx;
      if (Number.isFinite(o.slotY)) o.slotY += dy;
      if (Array.isArray(o.path)) {
        for (const p of o.path) {
          if (!p) continue;
          if (Number.isFinite(p.x)) p.x += dx;
          if (Number.isFinite(p.y)) p.y += dy;
        }
      }
      if (Array.isArray(o.wallSlots)) {
        for (const s of o.wallSlots) {
          if (!s) continue;
          if (Number.isFinite(s.x)) s.x += dx;
          if (Number.isFinite(s.y)) s.y += dy;
        }
      }
    };
    for (const u of GS.units) shiftOne(u);
    for (const b of GS.buildings) shiftOne(b);
    for (const d of GS.decorations) shiftOne(d);
    for (const h of GS.hazards) shiftOne(h);
    for (const p of GS.projectiles) {
      shiftOne(p);
      if (Number.isFinite(p.tx)) p.tx += dx;
      if (Number.isFinite(p.ty)) p.ty += dy;
    }
    if (Array.isArray(GS.moveMarkers)) {
      for (const m of GS.moveMarkers) shiftOne(m);
    }
    GS.cameraWorldX += dx;
    GS.cameraWorldY += dy;
  }

  function spawnExpansionFeatures(prevW, prevH, placed) {
    if (GS.territoryTier >= 1) {
      const destTypes = ['supply_crate', 'oil_barrel'];
      const destCount = 1 + Math.floor(GS.territoryTier / 3);
      for (let i = 0; i < destCount; i++) {
        const t = destTypes[i % destTypes.length];
        const spot = pickExpansionSpot(prevW, prevH, placed, 14);
        if (!spot) continue;
        const deco = {
          type: t,
          id: `dest_exp_${Date.now()}_${i}`,
          x: spot.x,
          y: spot.y,
          size: t === 'supply_crate' ? 16 : 14,
          hp: t === 'supply_crate' ? 40 : 30,
          maxHp: t === 'supply_crate' ? 40 : 30,
          blocksMove: false,
          blocksLOS: false,
          cover: 0.15,
          radius: 14,
          lootTp: t === 'supply_crate' ? 2 : 0,
          explosive: t === 'oil_barrel',
        };
        GS.decorations.push(deco);
        placed.push(deco);
      }
    }
    if (GS.territoryTier >= 1 && svc('NeutralWildlife')) {
      const denCount = 1 + Math.floor(GS.territoryTier / 4);
      for (let i = 0; i < denCount; i++) {
        const spot = pickExpansionSpot(prevW, prevH, placed, 18);
        if (!spot) continue;
        const deco = {
          type: 'neutral_den',
          id: `nden_exp_${Date.now()}_${i}`,
          x: spot.x,
          y: spot.y,
          size: 20,
          hp: 50,
          maxHp: 50,
          blocksMove: false,
          blocksLOS: false,
          cover: 0.2,
          radius: 18,
          isNeutralDen: true,
          disturbed: false,
        };
        GS.decorations.push(deco);
        placed.push(deco);
      }
    }
    if (GS.territoryTier >= 2 && svc('GameDepth')) {
      const types = ['swamp', 'fire'];
      const hazCount = 1 + Math.floor(GS.territoryTier / 2);
      for (let i = 0; i < hazCount; i++) {
        const spot = pickExpansionSpot(prevW, prevH, [], 20);
        if (!spot) continue;
        const t = types[i % types.length];
        GS.hazards.push({
          type: t,
          id: `haz_exp_${Date.now()}_${i}`,
          x: spot.x,
          y: spot.y,
          radius: 28 + Math.random() * 18,
          damage: t === 'fire' ? 0.35 : 0,
          slow: t === 'swamp' ? 0.55 : 1,
        });
      }
    }
  }

  function resolveUnitsInTerrain() {
    for (const u of GS.units) {
      if (u.hp <= 0) continue;
      if (!isTerrainBlocked(u.x, u.y, u)) continue;

      let moved = false;
      for (let ring = 16; ring <= 140 && !moved; ring += 16) {
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const pos = clampPos(u.x + Math.cos(angle) * ring, u.y + Math.sin(angle) * ring);
          if (!isTerrainBlocked(pos.x, pos.y, u) && !isBlocked(pos.x, pos.y, u, 2)) {
            u.x = pos.x;
            u.y = pos.y;
            u.path = [];
            u.pathIndex = 0;
            moved = true;
            break;
          }
        }
      }
    }
  }

  function populateNewTerritory(prevW, prevH) {
    const types = ['tree', 'tree', 'rock'];
    const placed = [...GS.decorations];
    const count = 4 + GS.territoryTier * 2;

    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const radius = t === 'tree' ? 14 : 10;
      const spot = pickExpansionSpot(prevW, prevH, placed, radius);
      if (!spot) continue;
      const deco = {
        type: t,
        id: 'deco_exp_' + Date.now() + '_' + i,
        x: spot.x,
        y: spot.y,
        size: t === 'tree' ? 18 + Math.random() * 10 : 12 + Math.random() * 6,
        hp: 999,
        blocksMove: true,
        blocksLOS: true,
        cover: t === 'rock' ? 0.3 : 0.45,
        radius,
      };
      GS.decorations.push(deco);
      placed.push(deco);
    }
    spawnExpansionFeatures(prevW, prevH, placed);
    if (svc('LivingPlanet')) {
      svc('LivingPlanet').populateBiomeDecor(
        GS.decorations,
        GS.worldW,
        GS.worldH,
        GS.territoryTier,
        GS.rallyY,
        prevW,
        prevH
      );
    }
    resolveUnitsInTerrain();
    invalidateObstacles();
  }

  function syncMapGrowth(opts = {}) {
    if (GS.wave <= 0) return false;
    const prevW = GS.worldW;
    const prevH = GS.worldH;
    applyWorldSize(GS.wave);
    const grew = GS.worldW > prevW || GS.worldH > prevH;
    if (!grew) return false;

    // Center the old map in the new bounds so new land wraps north/south/east/west.
    const shiftX = (GS.worldW - prevW) / 2;
    const shiftY = (GS.worldH - prevH) / 2;
    shiftWorldEntities(shiftX, shiftY);

    populateNewTerritory(prevW, prevH);
    resolveUnitsInTerrain();
    invalidateObstacles();
    // Immediate walk-grid rebuild so pathing is valid on the new bounds (not deferred a few ticks).
    GS.walkGridRebuildDue = true;
    GS.walkGridRebuildTick = -9999;
    maybeRebuildWalkGrids();
    if (typeof resize === 'function') resize();
    if (typeof applyCamera === 'function') applyCamera();

    // Keep non-manual troops oriented on the new rally line.
    for (const u of GS.units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (!u.manualOrder && !u.garrisoned && !u.stationedKeep && !u.wallGarrisoned) {
        u.targetY = GS.rallyY;
      }
    }

    if (opts.announce !== false) {
      const roman =
        ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][
          GS.territoryTier
        ] || String(GS.territoryTier || '');
      const label = roman ? `Land ${roman}` : `Wave ${GS.wave}`;
      addHighlight('territory', `${label} — map ${GS.worldW}×${GS.worldH} (N/E/S/W)`);
      showMessage(
        `Territory expanded on all sides! ${label} · ${GS.worldW}×${GS.worldH}`,
        300
      );
      svc('FloatingText')?.status?.(GS.worldW / 2, GS.worldH / 2, 'LAND GAINED', '#f0d060');
      svc('Particles')?.dust?.(GS.worldW / 2, GS.worldH / 2);
      playSfx('reinforce');
    }
    return true;
  }

  /** One-time full-map terrain roll (wave 1). Later growth uses populateNewTerritory only. */
  /** Pending hazard spawn opts for next generateBattlefield (e.g. conquest night 0). */
  GS.pendingHazardSpawnOpts = null;
  /** Extra waves to keep fair hazard placement (conquest night 0 + first dawn). */
  GS.conquestHazardGraceWaves = 0;

  function setHazardSpawnOpts(opts) {
    GS.pendingHazardSpawnOpts = opts || null;
  }

  function getConquestHazardGraceOpts() {
    if (GS.conquestHazardGraceWaves <= 0) return null;
    return {
      densityMult: 0.32,
      northOnly: true,
      excludeNearPlayerRally: true,
      rallyClearRadius: 140,
      maxHazards: 5,
      noSpread: true,
      noTopUp: false,
      scaleMult: 0.55,
      damageMult: 0.65,
    };
  }

  function generateBattlefield() {
    const preserved = GS.decorations.filter((d) => d.type === 'barricade' && d.hp > 0);
    GS.decorations = [...preserved];
    const types = ['tree', 'tree', 'rock'];
    const placed = [...preserved];
    const decoCount = 8 + GS.territoryTier * 3;

    for (let i = 0; i < decoCount; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const spot = pickDecorationSpot(t, placed);
      if (!spot) continue;

      const deco = {
        type: t,
        id: 'deco_' + i,
        x: spot.x,
        y: spot.y,
        size: t === 'tree' ? 18 + Math.random() * 10 : 12 + Math.random() * 6,
        hp: 999,
        blocksMove: true,
        blocksLOS: true,
        cover: t === 'rock' ? 0.3 : 0.45,
        radius: spot.radius,
      };
      GS.decorations.push(deco);
      placed.push(deco);
    }

    if (svc('GameDepth')) {
      const hazCtx = GS.pendingHazardSpawnOpts || {};
      GS.pendingHazardSpawnOpts = null;
      GS.hazards = svc('GameDepth').spawnHazards(
        GS.worldW,
        GS.worldH,
        GS.territoryTier,
        GS.rallyY,
        GS.wave,
        hazCtx
      );
    }
    if (svc('ContentExpansion')) {
      svc('ContentExpansion').spawnDestructibles(
        GS.decorations,
        GS.worldW,
        GS.worldH,
        GS.rallyY,
        GS.territoryTier
      );
    }
    if (svc('NeutralWildlife')) {
      svc('NeutralWildlife').seedDens(GS.decorations, GS.worldW, GS.worldH, GS.rallyY, GS.territoryTier);
    }
    invalidateObstacles();
    resolveUnitsInTerrain();
    GS.terrainInitialized = true;
  }

  

  function obstacleBlocksForUnit(obs, unit) {
    const ref = obs.ref || obs;
    if ((obs.hp ?? ref.hp) <= 0) return false;
    const blockR =
      typeof terrainBlockRadius === 'function' ? terrainBlockRadius(ref) : obs.radius || obs.r || 0;
    if (blockR <= 0) return false;
    if (isPlayerFriendlyWall(obs, unit)) return false;
    if ((obs.type || obs.ref?.type) === 'wall' && obs.siegeTowerId) {
      const tower = GS.units.find((u) => u.id === obs.siegeTowerId && u.hp > 0 && u.siegeDeployed);
      if (tower && unit?.team === 'enemy') return false;
    }
    return true;
  }

  // Thronefall-style hold posts: assigned station, hard plant when home, walk back if displaced.
  const HOLD_AT_DIST = 5;
  const HOLD_SNAP_DIST = 7;

  

  

  

  

  /** Standing ground: hunt off, player stance locked, not mid player click-order. */
  function isHoldStance(unit) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
    if (unit.huntMode) return false;
    if (!unit.canHunt) return false;
    if (unit.fleeing || unit.demoralized || unit.retreatingToMed || unit.atMedicalTent) return false;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) return false;
    if (hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit))
      return false;
    if (unit.isGeneral && unit.rallyTargetId) return false;
    // Mid click-to-move: still marching to an unreached destination.
    if (isPlayerMarchingOrder(unit)) return false;
    // Hold when explicitly locked (manualOrder) or hunt-disabled idle soldier.
    return !!(unit.manualOrder || !unit.huntMode);
  }

  /** On station (close enough to assigned post) — freeze position. */
  function isHoldPlanted(unit) {
    return isHoldStance(unit) && hasHoldPost(unit) && distToHoldPost(unit) <= HOLD_AT_DIST;
  }

  /** Off post and walking home. */
  function isReturningToHold(unit) {
    return isHoldStance(unit) && hasHoldPost(unit) && distToHoldPost(unit) > HOLD_AT_DIST;
  }

  /**
   * Assign / lock a hold post (Thronefall-style station).
   * @param {{ x?: number, y?: number, reassign?: boolean }} [opts]
   */
  function enterHoldStance(unit, opts = {}) {
    if (!unit || !unit.canHunt) return;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) {
      unit.huntMode = false;
      return;
    }
    if (hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit)) {
      unit.huntMode = false;
      return;
    }
    unit.huntMode = false;
    unit.manualOrder = true;
    unit.combatTargetId = null;
    unit.structureTargetId = null;
    unit.pathPending = false;
    unit.pathReqId = null;
    unit.pathWaitTicks = 0;
    unit.pathStuck = 0;
    unit.pathRecalc = 0;
    unit.stillFrames = 0;

    let hx;
    let hy;
    if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) {
      hx = opts.x;
      hy = opts.y;
    } else if (
      Number.isFinite(unit.pendingHoldX) &&
      Number.isFinite(unit.pendingHoldY)
    ) {
      hx = unit.pendingHoldX;
      hy = unit.pendingHoldY;
    } else if (!opts.reassign && hasHoldPost(unit)) {
      hx = unit.holdX;
      hy = unit.holdY;
    } else {
      hx = unit.x;
      hy = unit.y;
    }
    const pos = clampPos(hx, hy);
    unit.holdX = pos.x;
    unit.holdY = pos.y;
    unit.pendingHoldX = null;
    unit.pendingHoldY = null;
    unit.targetX = unit.holdX;
    unit.targetY = unit.holdY;
    unit.pathTargetId = 'hold';

    const d = distToHoldPost(unit);
    if (d <= HOLD_SNAP_DIST) {
      unit.x = unit.holdX;
      unit.y = unit.holdY;
      unit.path = [];
      unit.pathIndex = 0;
      unit.animState = 'idle';
    } else {
      // Walk home to the assigned post.
      unit.path = [{ x: unit.holdX, y: unit.holdY }];
      unit.pathIndex = 0;
      unit.animState = 'walk';
    }
  }

  /** Snap holders on station; steer anyone knocked off post back home. */
  function updateHoldPosts() {
    for (const unit of GS.units) {
      if (!isHoldStance(unit)) continue;
      if (!hasHoldPost(unit)) {
        unit.holdX = unit.x;
        unit.holdY = unit.y;
      }
      const d = distToHoldPost(unit);
      if (d <= HOLD_AT_DIST) {
        // Hard plant — no micro-drift from separation, combat, or float error.
        unit.x = unit.holdX;
        unit.y = unit.holdY;
        unit.targetX = unit.holdX;
        unit.targetY = unit.holdY;
        unit.pathTargetId = 'hold';
        if (unit.path?.length) {
          unit.path = [];
          unit.pathIndex = 0;
        }
        if (unit.attackAnimTimer <= 0) unit.animState = 'idle';
        continue;
      }
      // Return to assigned spot (Thronefall station).
      unit.targetX = unit.holdX;
      unit.targetY = unit.holdY;
      unit.pathTargetId = 'hold';
      unit.manualOrder = true;
      unit.huntMode = false;
      const end = unit.path?.length ? unit.path[unit.path.length - 1] : null;
      const destOk =
        end && Math.hypot(end.x - unit.holdX, end.y - unit.holdY) <= 8;
      if (!destOk) {
        unit.path = [{ x: unit.holdX, y: unit.holdY }];
        unit.pathIndex = 0;
      }
      if (unit.pinned || unit.attackAnimTimer > 0) continue;
      if (steerToward(unit, unit.holdX, unit.holdY)) {
        unit.animState = 'walk';
        // Snap once close enough after the step.
        if (distToHoldPost(unit) <= HOLD_AT_DIST) {
          unit.x = unit.holdX;
          unit.y = unit.holdY;
          unit.path = [];
          unit.pathIndex = 0;
          unit.animState = 'idle';
        }
      } else {
        unit.animState = 'walk';
      }
    }
  }

  /** Restore hunt/hold from the global HUNT toggle after posts, med, rally, etc. */
  function applyGlobalHuntState(unit) {
    if (!unit?.canHunt) return;
    if (GS.globalHunt) {
      unit.huntMode = true;
      // Don't cancel an active click-to-move destination.
      if (
        unit.manualOrder &&
        unit.pathTargetId !== 'hold' &&
        unit.targetX != null &&
        unit.targetY != null &&
        Math.hypot(unit.x - unit.targetX, unit.y - unit.targetY) > 12
      ) {
        unit.huntMode = false;
        return;
      }
      unit.manualOrder = false;
      clearHoldPost(unit);
    } else {
      enterHoldStance(unit, { reassign: !hasHoldPost(unit) });
    }
  }

  function unitHasActiveMarch(unit) {
    if (!unit || unit.hp <= 0) return false;
    // Returning to a hold post counts as a march (soft collision).
    if (isReturningToHold(unit)) return true;
    // Planted hold is not a march.
    if (isHoldStance(unit)) return false;
    return !!(
      unit.path?.length ||
      unit.huntMode ||
      unit.manualOrder ||
      unit.retreatingToMed ||
      (unit.type === 'builder' && builderHasWork(unit)) ||
      hasPendingOutpostGarrison(unit) ||
      isMarchingToKeep(unit) ||
      isMarchingToWallSlot(unit)
    );
  }

  

  GS.obstaclesCache = null;
  GS.obstaclesDirty = true;
  GS.spatialStaticDirty = true;
  GS.walkGridRebuildDue = false;
  GS.walkGridRebuildTick = -999;
  GS.losObstaclesCache = null;
  GS.incompleteBuildSig = '';
  GS.engagerCacheFrame = -1;
  const engagerCache = new Map();
  GS.unitByIdFrame = -1;
  const unitById = new Map();
  GS.tacticalCacheFrame = -1;
  const tacticalTargetCache = new Map();
  GS.auraCacheFrame = -1;
  GS.auraCache = { gen: null, aura: null, r2: 0 };

  function invalidateObstacles() {
    GS.obstaclesDirty = true;
    GS.spatialStaticDirty = true;
    GS.walkGridRebuildDue = true;
    GS.obstaclesCache = null;
    GS.losObstaclesCache = null;
    if (svc('Pathfinding')) {
      svc('Pathfinding').clearCache?.();
      svc('Pathfinding').invalidateWalkGrids?.();
    }
    const bridge = svc('PathWorkerBridge');
    if (bridge?.cancelPendingPaths) bridge.cancelPendingPaths();
    // Always clear pathPending for everyone — cancelPendingPaths drops worker results,
    // and stuck pathPending + empty path freezes movement/AI until expire (40 ticks).
    for (const u of GS.units) {
      if (u.hp <= 0) continue;
      if (u.pathPending) {
        GameRuntime.clearPathTrack(u, {
          keepTargets: true,
          keepManual: u.manualOrder,
          keepPath: false,
        });
        u.pathPending = false;
        u.pathReqId = null;
        u.pathWaitTicks = 0;
        u.pathRecalc = 0;
      } else if (u.team === 'enemy' && !u.path?.length) {
        u.pathRecalc = 0;
      }
    }
  }

  function getIncompleteBuildSig() {
    let sig = '';
    for (const b of GS.buildings) {
      if (!b.complete && b.hp > 0 && b.blocksMove !== false && buildingBlocksTerrain(b)) {
        sig += `${b.id}:${Math.floor(b.buildProgress || 0)};`;
      }
    }
    return sig;
  }

  function getLosObstacles() {
    if (!GS.obstaclesDirty && GS.losObstaclesCache) return GS.losObstaclesCache;
    allObstacles();
    return GS.losObstaclesCache;
  }

  function sanitizeTactical() {
    if (!Number.isFinite(GS.tactical)) GS.tactical = STARTING_TP;
    if (GS.tactical < 0) GS.tactical = 0;
    if (!GS.creativeMode && GS.tactical > TP_SANITY_CAP) GS.tactical = TP_SANITY_CAP;
  }

  function maybeRebuildWalkGrids() {
    const pf = svc('Pathfinding');
    if (!GS.walkGridRebuildDue || !pf?.rebuildWalkGrids) return;
    const unitCount = GS.units.length;
    const interval = unitCount > 90 ? 40 : unitCount > 55 ? 32 : unitCount > 30 ? 24 : 18;
    if (GS.updateTick - GS.walkGridRebuildTick < interval) return;
    if (unitCount > 55 && pf.rebuildWalkGridsStaggered) {
      pf.rebuildWalkGridsStaggered(isTerrainBlockedForPath, unitCount);
      if (pf.isStaggeredRebuildComplete?.()) GS.walkGridRebuildDue = false;
    } else {
      pf.rebuildWalkGrids(isTerrainBlockedForPath);
      GS.walkGridRebuildDue = false;
    }
    GS.walkGridRebuildTick = GS.updateTick;
  }

  function rebuildSpatialIndex() {
    if (!svc('Spatial')) return;
    const spatialInterval = svc('GfxQuality') ? svc('GfxQuality').get().spatialInterval || 1 : 1;
    if (spatialInterval > 1 && GS.spatialFrame >= 0 && GS.updateTick % spatialInterval !== 0) return;
    if (GS.spatialFrame === GS.updateTick) return;
    GS.spatialFrame = GS.updateTick;
    if (GS.spatialStaticDirty) {
      svc('Spatial').rebuildStatic(GS.buildings, GS.decorations);
      GS.spatialStaticDirty = false;
    }
    maybeRebuildWalkGrids();
    svc('Spatial').rebuildDynamic(GS.units);
    svc('Spatial').rebuildHazards(GS.hazards);
  }

  

  function isUnitSelected(u) {
    if (u.id === GS.selectedUnitId) return true;
    return GS.cachedSelectedSet ? GS.cachedSelectedSet.has(u.id) : GS.selectedUnitIds.includes(u.id);
  }

  function gfxOverlayFor(u, mode) {
    if (!mode) return false;
    if (svc('GfxQuality')) {
      return svc('GfxQuality').shouldDrawUnitOverlay(
        u,
        { primary: GS.selectedUnitId, list: GS.selectedUnitIds },
        mode
      );
    }
    return mode === true || mode === 'all' || (mode === 'selected' && isUnitSelected(u));
  }

  function useSpatialQueries() {
    return svc('Spatial') && (GS.units.length > 18 || GS.buildings.length > 14);
  }

  function buildUpdateThrottleCtx(unitCount, gfxQ) {
    const sig = `${GS.selectedUnitId ?? ''}|${GS.selectedUnitIds.join(',')}`;
    if (sig !== GS.cachedSelectionSig || !GS.cachedSelectedSet) {
      GS.cachedSelectedSet = new Set(GS.selectedUnitIds);
      if (GS.selectedUnitId) GS.cachedSelectedSet.add(GS.selectedUnitId);
      GS.cachedSelectionSig = sig;
    }
    return {
      unitCount,
      gfxQ,
      updateTick: GS.updateTick,
      isInView,
      selectedIds: GS.cachedSelectedSet,
      rallyY: GS.rallyY,
    };
  }

  

  function releaseAllUnits() {
    const pool = svc('EntityPool');
    if (pool) pool.releaseAllFrom(GS.units, pool.releaseUnit);
    else GS.units.length = 0;
  }

  function releaseAllBuildings() {
    const pool = svc('EntityPool');
    if (pool) pool.releaseAllFrom(GS.buildings, pool.releaseBuilding);
    else GS.buildings.length = 0;
  }

  

  

  function purgeDeadUnits() {
    for (const u of GS.units) {
      if (u.hp <= 0) {
        if (u.garrisoned) releaseFromGarrison(u);
        if (u.stationedKeep) releaseFromKeep(u);
        if (u.wallGarrisoned || isMarchingToWallSlot(u)) releaseFromWallGarrison(u);
        u.retreatingToMed = null;
        u.atMedicalTent = null;
        if (u.siegeDeployed || u.linkedWallId) clearSiegeLink(u);
        // Drop selection so UI/path markers do not hold wiped pool objects.
        if (u.id === GS.selectedUnitId) GS.selectedUnitId = null;
        if (GS.selectedUnitIds?.length) {
          const ix = GS.selectedUnitIds.indexOf(u.id);
          if (ix >= 0) GS.selectedUnitIds.splice(ix, 1);
        }
      }
    }
    const pool = svc('EntityPool');
    if (pool) pool.purgeDeadFromList(GS.units);
    else {
      let w = 0;
      for (let i = 0; i < GS.units.length; i++) {
        if (GS.units[i].hp > 0) GS.units[w++] = GS.units[i];
      }
      GS.units.length = w;
    }
    // EntityPool.wipe clears fields on dead units — invalidate id cache so callers
    // never receive a recycled empty object mid-frame.
    unitById.clear();
    GS.unitByIdFrame = -1;
  }

  function allObstacles() {
    const hasGrowing = GS.buildings.some(
      (b) => !b.complete && b.hp > 0 && b.blocksMove !== false && buildingBlocksTerrain(b)
    );
    if (!hasGrowing && !GS.obstaclesDirty && GS.obstaclesCache) return GS.obstaclesCache;
    const obs = [];
    const losObs = [];
    for (const d of GS.decorations) {
      const moveR = terrainBlockRadius(d);
      if (moveR > 0) {
        obs.push({
          type: d.type,
          id: d.id,
          x: d.x,
          y: d.y,
          radius: moveR,
          blocksMove: d.blocksMove,
          blocksLOS: d.blocksLOS,
          cover: d.cover,
          hp: d.hp,
        });
      }
      if (d.blocksLOS) {
        const losR =
          typeof terrainLosRadius === 'function' ? terrainLosRadius(d) : moveR;
        if (losR > 0) {
          losObs.push({
            type: d.type,
            id: d.id,
            x: d.x,
            y: d.y,
            radius: losR,
            blocksMove: d.blocksMove,
            blocksLOS: d.blocksLOS,
            cover: d.cover,
            hp: d.hp,
          });
        }
      }
    }
    for (const b of GS.buildings) {
      if (b.hp <= 0) continue;
      const moveR = terrainBlockRadius(b);
      if (moveR > 0) {
        obs.push({
          type: b.type,
          id: b.id,
          x: b.x,
          y: b.y,
          radius: moveR,
          blocksMove: b.blocksMove,
          blocksLOS: b.blocksLOS,
          cover: b.cover,
          hp: b.hp,
          siegeTowerId: b.siegeTowerId,
          owner: b.owner,
        });
      }
      if (b.blocksLOS) {
        const losR =
          typeof terrainLosRadius === 'function' ? terrainLosRadius(b) : moveR;
        if (losR > 0) {
          losObs.push({
            type: b.type,
            id: b.id,
            x: b.x,
            y: b.y,
            radius: losR,
            blocksMove: b.blocksMove,
            blocksLOS: b.blocksLOS,
            cover: b.cover,
            hp: b.hp,
            siegeTowerId: b.siegeTowerId,
            owner: b.owner,
          });
        }
      }
    }
    GS.obstaclesCache = obs;
    GS.losObstaclesCache = losObs;
    GS.obstaclesDirty = false;
    return obs;
  }

  
  
  const ALLY_MOVE_MARGIN = 0;
  const SURROUND_SLOTS_MELEE = 8;
  const SURROUND_SLOTS_RANGED = 6;
  const SURROUND_RING_MELEE = 18;
  const SURROUND_MIN_FILLED = 6;
  const MORALE_WITNESS_RADIUS = 150;
  const MORALE_WITNESS_CLOSE = 70;
  const MORALE_WITNESS_BREAK_COUNT = 3;
  const GENERAL_RALLY_RANGE = 40;
  const GENERAL_W2W_BUFF_TICKS = 200;
  
  
  const ETERNAL_CRUSADE_MIN_FORTS = 8;
  
  const DRAGON_THEMED_STRIKES = new Set(['fus_ro_dah', 'fire_breath', 'ice_form']);
  
  
  const PLANET_THREAT_MIN_WAVE = 200;
  
  
  

  

  

  

  

  

  

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
    if (unitDistSq(observer, dead) > MORALE_WITNESS_RADIUS * MORALE_WITNESS_RADIUS) return false;
    return lineOfSight(observer.x, observer.y, dead.x, dead.y);
  }

  function triggerMoraleBreak(unit, reason) {
    if (!isMoraleCombatUnit(unit) || unit.fleeing || unit.demoralized || unit.retreatingToMed)
      return;
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
        releaseCombatPursuit(u, { keepManual: u.manualOrder });
      }
    }
  }

  

  function isPursuableFoe(unit, foe) {
    if (!foe || foe.team === unit.team || !isValidCombatFoe(foe)) return false;
    // Player units cannot chase/fire on fog-hidden host troops (matches render + minimap).
    if (unit.team === 'player' && foe.team === 'enemy' && isEnemyHiddenByFog(foe)) return false;
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
      let moraleLoss = closeWitness ? 3 : 2;
      if (isGeneralDeath) moraleLoss += 3;
      if (isEliteDeath && observer.team === 'enemy') moraleLoss += 1;
      observer.morale = Math.max(0, observer.morale - moraleLoss);
      if (
        observer.witnessDeaths >= MORALE_WITNESS_BREAK_COUNT ||
        observer.morale <= moraleBreakThreshold(observer)
      ) {
        triggerMoraleBreak(observer, 'witness');
      }
    }
    if (deadUnit.team === 'player') {
      for (const ally of GS.units) {
        if (ally.team !== 'player' || ally.hp <= 0 || ally.id === deadUnit.id) continue;
        if (!isMoraleCombatUnit(ally)) continue;
        ally.morale = Math.max(0, ally.morale - (isGeneralDeath ? 4 : 1));
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
      if (GS.globalHunt) {
        unit.huntMode = true;
        unit.manualOrder = false;
        clearHoldPost(unit);
      } else {
        enterHoldStance(unit);
      }
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
      general.huntMode = true;
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
      if (ally.team !== 'player' || !ally.isWwe || ally.wweAbility !== 'lantern' || ally.hp <= 0)
        continue;
      if (unitDistance(ally, unit) < 140) {
        pen += 14 + Math.floor((1 - light) * 22);
      }
    }
    return pen;
  }

  function updateWweLanternAura() {
    if (!isDayPhase()) return;
    for (const bray of GS.units) {
      if (!bray.isWwe || bray.wweAbility !== 'lantern' || bray.hp <= 0) continue;
      bray.lanternPulse = (bray.lanternPulse || 0) + 1;
      if (bray.lanternPulse % 45 !== 0) continue;
      const light = getDayLightLevel();
      for (const foe of GS.units) {
        if (foe.team !== 'enemy' || foe.hp <= 0) continue;
        if (unitDistance(bray, foe) > 130) continue;
        foe.morale = Math.max(0, foe.morale - (1 + Math.floor((1 - light) * 2)));
        if (foe.morale <= 2 && !foe.fleeing) triggerMoraleBreak(foe, 'lantern');
      }
    }
  }

  function applyWweWaveStartPulse() {
    for (const u of GS.units) {
      if (!u.isWwe || u.hp <= 0) continue;
      if (u.wweAbility === 'usa') {
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
    const byType = unitCounts.livePlayerByType;
    for (const k in byType) delete byType[k];
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.hp <= 0) continue;
      if (u.team === 'player') {
        unitCounts.player++;
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
    unitCounts.hasWweAcademy = false;
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
    const hamletTpFallback =
      typeof HAMLET_TP_PER_ROUND !== 'undefined' ? HAMLET_TP_PER_ROUND : 5;
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
        if (b.isWweAcademy) unitCounts.hasWweAcademy = true;
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
    const ids = GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
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

  function enterNightPhase() {
    if (isNightPhase()) return;
    GS.timeOfDay = 'night';
    GS.nightTimer = 0;
    refreshUnitCounts();
    awardRoundTP();
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
    const standSnap = sampleCrossoverHeroAlliance(playerUnits);
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
      ach('named_boss_repelled', { wave: GS.wave, bossType: GS.namedBossWave.type, bossName: GS.namedBossWave.name });
    }
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
      garrisonCount: countGarrisoned(playerUnits),
      namedBossWave: !!GS.namedBossWave,
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
      garrisonCount: countGarrisoned(playerUnits),
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
      showMessage(svc('ColonyValue').formatNightPreview(nightColony, GS.wave + 1, nextPressure), 260);
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
        else if (u.combatType === 'ranged' || u.type === 'archer' || u.type === 'mage' || u.type === 'ballista')
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
    if (svc('IntergalacticLayer')) {
      svc('IntergalacticLayer').onWaveEnd(GS.wave, getIntergalacticCtx());
    }
    if (typeof HybridMoments !== 'undefined') {
      const hybridWin = GS.playerCasualtiesThisWave <= Math.max(2, Math.floor(GS.waveEnemyTotal * 0.35));
      HybridMoments.onWaveEnd(
        GS.wave,
        {
          wave: GS.wave,
          worldW: GS.worldW,
          showMessage,
          addHighlight,
          floatingText: floatStatus,
        },
        hybridWin
      );
    }
    if (svc('GrandStrategy')) {
      svc('GrandStrategy').onWaveEnd(GS.wave, {
        ...getGrandStrategyCtx(),
        grantReinforce: (n) => {
          let spawned = 0;
          for (let i = 0; i < n; i++) {
            const u = spawnUnit('footman', GS.worldW / 2 - 40 + i * 28, GS.deployY, 'player');
            if (!u) break;
            applyPlayerStatMods(u);
            u.targetY = GS.rallyY;
            GS.units.push(u);
            spawned++;
          }
          if (spawned > 0) {
            showMessage(`Grand Strategy levies — ${spawned} reinforcement(s) mustered!`, 240);
          }
        },
      });
    }
    prefetchSpawnQueueForWave(GS.wave + 1);
    svc('FloatingText')?.prune?.(true);
    svc('Particles')?.prune?.(true);
    svc('Chronicles')?.prune?.();
    // Refresh HUD so planet-event buttons unlock (canRespond + night) this frame.
    invalidateStateCache();
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
    if (manual) showMessage('Dawn breaks — the assault begins!', 160);
    startNextWave();
    invalidateStateCache();
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
    dmg += Math.floor((unit.experience || 0) / 3) * 2;
    dmg += (unit.vetTier || 0) * 5;
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
    if (svc('ContentExpansion')) dmg = svc('ContentExpansion').modifyCalcDamage(unit, target, dmg);
    if (svc('StrategyCounterplay')) {
      dmg = svc('StrategyCounterplay').modifyDamage(unit, target, dmg);
    }
    if (svc('FactionDepth') && (unit.isCrossover || unit.isWwe)) {
      dmg = svc('FactionDepth').modifyDamage(unit, target, dmg);
    }
    if (svc('OperativeSkillTrees') && (unit.isCrossover || unit.isWwe)) {
      dmg = svc('OperativeSkillTrees').modifyDamage(unit, target, dmg);
    }
    if (
      svc('FactionDepth') &&
      target?.team === 'player' &&
      (target.isCrossover || target.isWwe || target.isDoomslayer)
    ) {
      dmg = svc('FactionDepth').modifyDamageTaken(target, unit, dmg);
    }
    if (
      svc('OperativeSkillTrees') &&
      target?.team === 'player' &&
      (target.isCrossover || target.isWwe)
    ) {
      dmg = svc('OperativeSkillTrees').modifyDamageTaken(target, dmg);
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
    if (unit.team === 'player' && svc('IntergalacticLayer') && svc('IntergalacticLayer').isActive(GS.wave)) {
      const igDmg = svc('IntergalacticLayer').getPlanetaryDefenseMods().playerDmgMult || 1;
      dmg = Math.floor(dmg * igDmg);
      const cosmicDmg = svc('IntergalacticLayer').getCosmicUnitDmgMult?.(unit, GS.wave) || 1;
      if (cosmicDmg > 1) dmg = Math.round(dmg * cosmicDmg);
      if (svc('IntergalacticLayer').shouldCosmicFirstStandKill) {
        dmg = svc('IntergalacticLayer').shouldCosmicFirstStandKill(unit, target, dmg);
      }
    }
    if (unit.team === 'player' && svc('GrandStrategy') && svc('GrandStrategy').isActive(GS.wave)) {
      const gsDmg = svc('GrandStrategy').getTacticalModifiers(GS.wave).playerDmgMult || 1;
      if (gsDmg > 1) dmg = Math.round(dmg * gsDmg);
    }
    if (unit.team === 'player' && svc('GameDepth') && svc('GameDepth').isVanillaAlly(unit)) {
      let obsoleteMult = svc('GameDepth').getVanillaObsoleteMult(unit, GS.wave);
      const cosmicFloor = svc('IntergalacticLayer')?.getCosmicObsoleteOverride?.(unit, GS.wave);
      if (cosmicFloor != null) obsoleteMult = Math.max(obsoleteMult, cosmicFloor);
      dmg = Math.round(dmg * obsoleteMult);
    }
    const out = Math.round(dmg);
    return Number.isFinite(out) && out > 0 ? out : 1;
  }

  

  

  function announceAdvancedModifierHints() {
    if (!svc('AdvancedDifficulty')) return;
    const mods = getAdvancedMods();
    const hints = [];
    if (mods.fogOfWar) hints.push('Fog of War — scouts and watchtowers reveal hidden host units');
    if ((mods.settlementTpMult || 1) < 0.9) hints.push('Resource scarcity — hamlet and guild income reduced');
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
    if (
      svc('PlanetWarfare') &&
      svc('PlanetWarfare').isActive(GS.wave) &&
      !svc('PlanetWarfare').isPositionSpotted(unit.x, unit.y, {
        wave: GS.wave,
        worldH: GS.worldH,
        units: GS.units,
        buildings: GS.buildings,
        unit,
        visionMult: getFogVisionMult(),
        control: svc('PlanetWarfare').getControl(),
      })
    ) {
      return true;
    }
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
        factionSummary = hostSnap?.activeSummary || svc('EnemyFactions').formatActiveFactions(GS.wave);
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
      planetControl: svc('PlanetWarfare') ? svc('PlanetWarfare').getControl() : 0,
      waveSince200: Math.max(0, GS.wave - (typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200)),
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

  function getGrandStrategyHookFns() {
    if (GS.grandStrategyHookFns) return GS.grandStrategyHookFns;
    GS.grandStrategyHookFns = {
      spawnMidWaveUnits: (types) => {
        if (GS.state !== 'playing' || !isDayPhase() || !types?.length) return 0;
        let spawned = 0;
        for (let i = 0; i < types.length; i++) {
          const u = spawnUnit(
            types[i],
            60 + Math.random() * Math.max(80, GS.worldW - 120),
            GS.deployY - 10,
            'player'
          );
          if (!u) continue;
          applyPlayerStatMods(u);
          if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
          u.targetY = GS.rallyY;
          u.huntMode = GS.globalHunt && u.canHunt;
          GS.units.push(u);
          spawned++;
        }
        if (spawned > 0) playSfx('reinforce');
        return spawned;
      },
      queueReinforce: (types) => {
        if (GS.state !== 'playing' || !types?.length) return 0;
        for (const t of types) GS.pendingReinforce.push(t);
        return types.length;
      },
      healPlayerArmy: (amount) => {
        let healed = 0;
        for (const u of GS.units) {
          if (u.team !== 'player' || u.hp <= 0) continue;
          const before = u.hp;
          u.hp = Math.min(u.maxHp, u.hp + (amount || 0));
          if (u.hp > before) {
            healed++;
            svc('Particles')?.heal?.(u.x, u.y);
          }
        }
        return healed;
      },
      boostPlayerMorale: (amount) => {
        let n = 0;
        for (const u of GS.units) {
          if (u.team !== 'player' || u.hp <= 0) continue;
          u.morale = Math.min(u.maxMorale, u.morale + (amount || 0));
          u.demoralized = false;
          u.witnessDeaths = 0;
          n++;
        }
        return n;
      },
      delayEnemySpawns: (ticks) => {
        if (GS.state !== 'playing' || !isDayPhase()) return false;
        const t = Math.max(0, ticks | 0);
        GS.spawnDelayBonus += t;
        GS.spawnTimer += t;
        return true;
      },
      damageEnemyArmyPct: (pct) => {
        let n = 0;
        const p = Math.max(0, Math.min(0.5, pct || 0));
        for (const u of GS.units) {
          if (u.team !== 'enemy' || u.hp <= 0) continue;
          const dmg = Math.max(1, Math.floor(u.hp * p));
          u.hp = Math.max(1, u.hp - dmg);
          n++;
        }
        return n;
      },
    };
    return GS.grandStrategyHookFns;
  }

  function getGrandStrategyTacticalHooks() {
    return {
      phase: isNightPhase() ? 'night' : 'day',
      ...getGrandStrategyHookFns(),
    };
  }

  function getIntergalacticCtx() {
    if (GS.igCtxFrame === GS.presentationFrame && GS.igCtxCache) return GS.igCtxCache;
    const asym = getAsymmetricSnapshotLight();
    GS.igCtxCache = {
      wave: GS.wave,
      planetControl: svc('PlanetWarfare') ? svc('PlanetWarfare').getControl() : 0,
      hostThreat: asym?.hostThreatLevel ?? 0,
      creative: GS.creativeMode,
      paused: GS.paused,
      now: performance.now?.() || Date.now(),
      showMessage,
      addHighlight,
    };
    GS.igCtxFrame = GS.presentationFrame;
    return GS.igCtxCache;
  }

  function getGrandStrategyCtx() {
    if (GS.gsCtxFrame === GS.presentationFrame && GS.gsCtxCache) return GS.gsCtxCache;
    const colony = GS.colonySnapshot || getLiveColonyState()?.colony;
    const asym = getAsymmetricSnapshotLight();
    GS.gsCtxCache = {
      wave: GS.wave,
      colonyRatio: colony?.threatRatio ?? 1,
      planetControl: svc('PlanetWarfare') ? svc('PlanetWarfare').getControl() : 0,
      hostThreat: asym?.hostThreatLevel ?? 0,
      enemyBuildings: unitCounts.enemyBuildings,
      tactical: GS.tactical,
      playerArmy: unitCounts.player,
      hamlets: unitCounts.hamlets,
      buildings: GS.buildings,
      spyNetwork: GS.spyNetwork,
      creative: GS.creativeMode,
      paused: GS.paused,
      now: performance.now?.() || Date.now(),
      showMessage,
      addHighlight,
      phase: isNightPhase() ? 'night' : 'day',
      ...getGrandStrategyHookFns(),
    };
    GS.gsCtxFrame = GS.presentationFrame;
    return GS.gsCtxCache;
  }

  function getProgressionRestartCtx() {
    const runSession = svc('GameModes') ? svc('GameModes').getSession() : null;
    return {
      wave: GS.wave,
      creative: GS.creativeMode,
      modeId: runSession?.modeId || 'campaign',
      worldW: GS.worldW,
      worldH: GS.worldH,
      rallyY: GS.rallyY,
      deployY: GS.deployY,
      units: GS.units,
      getTactical: () => GS.tactical,
      setTactical: (n) => {
        GS.tactical = Math.max(0, n | 0);
        sanitizeTactical();
      },
      releaseAllUnits,
      releaseAllBuildings,
      clearProjectiles: () => {
        GS.projectiles = [];
      },
      applyWorldSize,
      generateBattlefield,
      invalidateObstacles,
      resetCamera,
      tryRtsMapExpansion,
      bootstrapPlaceComplete,
      bootstrapSpawnArmy,
      bootstrapEnemyEconomyForWave,
      grantBootstrapUnlocks: (w) => {
        if (svc('Research')) svc('Research').grantBootstrapUnlocks(w);
      },
      getResearchCompletedCount: () => (svc('Research') ? svc('Research').completedCount : 0),
      applyRunStartBonuses: () => {
        if (GS.creativeMode) {
          return { heirs: 0, startTp: 0, activePassives: 0, eternalInvested: 0 };
        }
        let legacy = { heirs: 0, startTp: 0, activePassives: 0 };
        if (svc('CrownLegacies')) {
          legacy = svc('CrownLegacies').applyRunStartBonuses({
            creative: false,
            deployY: GS.deployY,
            rallyY: GS.rallyY,
            units: GS.units,
            grantTp: (n) => {
              if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
                GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
                sanitizeTactical();
              }
            },
            spawnUnit: (type, x, y, team, opts) => spawnUnit(type, x, y, team, opts),
            pushUnit: (u) => GS.units.push(u),
            hooks: { showMessage },
          });
        }
        let eternal = { startTp: 0, invested: 0 };
        if (typeof EternalLegacyTree !== 'undefined') {
          eternal = EternalLegacyTree.applyRunStartBonuses({
            creative: false,
            units: GS.units,
            grantTp: (n) => {
              if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
                GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
                sanitizeTactical();
              }
            },
          });
        }
        return {
          ...legacy,
          startTp: (legacy.startTp || 0) + (eternal.startTp || 0),
          eternalInvested: eternal.invested || 0,
        };
      },
      grantScience: (n) => {
        if (n > 0 && svc('Research') && svc('Research').grantSciencePoints) {
          svc('Research').grantSciencePoints(n, { showMessage });
        }
      },
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
    return {
      ...base,
      enemyHpMult: base.enemyHpMult * adv.enemyHpMult,
      enemyDmgMult: base.enemyDmgMult * adv.enemyDmgMult,
      enemyCountMult: base.enemyCountMult * adv.enemyCountMult,
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

  function getMissLimit() {
    return getDifficulty().missLimit ?? getDifficultyDef(GS.difficultyId).missLimit;
  }

  

  function findLivePlayerOfType(type) {
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.team === 'player' && u.type === type && u.hp > 0) return u;
    }
    return null;
  }

  

  

  function hasWweAcademy() {
    return GS.buildings.some((b) => b.owner === 'player' && b.isWweAcademy && b.complete && b.hp > 0);
  }

  function hasCrossoverBarracks(factionId) {
    return GS.buildings.some(
      (b) =>
        b.owner === 'player' &&
        b.isCrossoverBarracks &&
        b.complete &&
        b.hp > 0 &&
        b.crossoverFaction === factionId
    );
  }

  

  

  

  

  function spawnUnit(type, x, y, team, opts = {}) {
    if (team === 'player') ensurePlayerUnitDef(type);
    // Non-finite spawn coords (NaN/Infinity from level data, mods, or creative tools)
    // produce units that are permanently unreachable and unclickable, and poison
    // distance/pathfinding math. Clamp to the world before the unit is ever created.
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (typeof ErrorReporting !== 'undefined') {
        ErrorReporting.log?.('warn', 'spawnUnit received non-finite coords — clamped', {
          kind: 'spawn-coords',
          type,
          team,
          x,
          y,
        });
      }
      x = Number.isFinite(x) ? x : GS.worldW / 2;
      y = Number.isFinite(y) ? y : GS.worldH / 2;
    }
    const u = createUnit(type, x, y, team, { spawnWave: GS.wave, ...opts });
    if (!u) {
      if (typeof ErrorReporting !== 'undefined') {
        ErrorReporting.log?.('error', `spawnUnit failed — unknown type "${type}"`, {
          kind: 'spawn-fail',
          type,
          team,
          wave: GS.wave,
        });
      }
      return null;
    }
    // Pooled objects can leave hp undefined if def was incomplete — purge would delete them.
    if (!(u.hp > 0)) {
      const d = team === 'player' ? ensurePlayerUnitDef(type) : EnemyDefs[type];
      const hp = Math.max(1, d?.hp || 50);
      u.hp = hp;
      u.maxHp = Math.max(u.maxHp || 0, hp);
    }
    if (team === 'player') {
      applyPlayerStatMods(u);
      // Ballista / siege crews: keep siegeMult from def after loadout mods.
      if (u.type === 'ballista' && !(u.siegeMult > 1)) {
        const d = ensurePlayerUnitDef('ballista');
        u.siegeMult = d?.siegeMult || 2.2;
      }
      if (u.type === 'ballista' && !u.projectile) u.projectile = 'arrow';
      if (svc('GameDepth') && svc('GameDepth').isIpOperative(u)) {
        u.baseMaxHp = null;
        u.baseDamage = null;
        svc('GameDepth').applyIpWaveScaling(u, GS.wave);
      }
    }
    return u;
  }

  function canTpVeteranUpgrade(unit) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
    if (!canSpendTpVeteranUpgrade(unit)) return false;
    const opts = getResearchOpts();
    return (
      (GS.creativeMode && GS.creativeSettings.unlockAll) ||
      (svc('Research') && svc('Research').isTpVeteranUpgradeUnlocked(opts))
    );
  }

  function refreshAcademyMentorUnlocks(unit, opts = {}) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return [];
    syncInteractionState();
    if (!isMaxLevelVeteran(unit)) {
      if (opts.announcePartial) {
        const need = MAX_VETERAN_TIER;
        const left = need - (unit.vetTier || 0);
        if (left > 0 && left <= need) {
          showMessage(
            `${getUnitDisplayName(unit)} is V${unit.vetTier || 0}/${need} — ${left} more promote${left > 1 ? 's' : ''} to unlock their academy mentor.`,
            280
          );
        }
      }
      return [];
    }
    const opened = typeof getAcademiesUnlockedByMentorType === 'function'
      ? getAcademiesUnlockedByMentorType(unit.type)
      : [];
    const mentorReady = opened.filter((t) => canBuildAcademyType(t, GS.wave, GS.units));
    if (opts.announce !== false && mentorReady.length) {
      const names = mentorReady
        .map((t) => BuildDefs[t]?.name || t)
        .slice(0, 3)
        .join(', ');
      const researchOpts = getResearchOpts();
      const needResearch = mentorReady.filter(
        (t) =>
          !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
          svc('Research') &&
          !svc('Research').isBuildUnlocked(t, researchOpts)
      );
      if (needResearch.length) {
        showMessage(
          `${getUnitDisplayName(unit)} is Immortal — mentor ready for ${names}. Research the academy charter/node to place it.`,
          360
        );
      } else {
        showMessage(
          `${getUnitDisplayName(unit)} is Immortal — ${names} unlocked for building!`,
          320
        );
      }
      svc('FloatingText').status(unit.x, unit.y - 16, 'ACADEMY MENTOR', '#80ffc0');
    }
    svc('UI')?.updateHUD?.(true);
    return mentorReady;
  }

  function upgradeSelectedVeteran() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) {
      showMessage('Select a living ally to promote.');
      return false;
    }
    if (!canSpendTpVeteranUpgrade(u)) {
      if ((u.vetTier || 0) >= MAX_VETERAN_TIER) {
        showMessage(`${getUnitDisplayName(u)} is already Immortal — their academy mentor is active if research allows.`);
        refreshAcademyMentorUnlocks(u, { announce: true });
        return false;
      }
      showMessage(
        'Not eligible yet — complete a gold-star cycle (3 gold) first, then Promote (U).'
      );
      return false;
    }
    const opts = getResearchOpts();
    const researchOk =
      (GS.creativeMode && GS.creativeSettings.unlockAll) ||
      (svc('Research') && svc('Research').isTpVeteranUpgradeUnlocked(opts));
    if (!researchOk) {
      showMessage('Research Veteran Doctrine at your Research Lab to promote core troops.');
      return false;
    }
    const cost = getVeteranUpgradeCost(u);
    if (!(GS.creativeMode && GS.creativeSettings.freeResources) && GS.tactical < cost) {
      showMessage(`Need ${cost} TP to promote ${getUnitDisplayName(u)}.`);
      return false;
    }
    if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= cost;
    u.vetUpgradeEligible = false;
    const prevTier = u.vetTier || 0;
    upgradeVeteranUnit(u);
    // notify handles FX; we own academy unlock messaging to avoid double toasts.
    if (u.honorName) {
      if (svc('VisualPolish')) svc('VisualPolish').honorFx(u);
    } else if (svc('VisualPolish')) {
      svc('VisualPolish').vetUpgradeFx(u);
    }
    const label = getVeteranLabel(u);
    svc('FloatingText').status(
      u.x,
      u.y,
      isSpecialistUnit(u) ? 'RANK UP!' : 'VETERAN!',
      VET_STAR_COLORS.gold
    );
    showMessage(`${label} — promoted to V${u.vetTier}/${MAX_VETERAN_TIER}`, 220);
    svc('Particles').heal(u.x, u.y);
    playSfx('reinforce');
    ach('vet_event', {
      event: u.honorName ? 'honored_upgrade' : 'tp_upgrade',
      unitType: u.type,
      vetTier: u.vetTier,
      tpCost: cost,
    });
    if (u.honorName) {
      ach('vet_event', { event: 'honored', unitType: u.type, honorName: u.honorName });
    }
    recordPathImmortalIfEligible(u);
    refreshAcademyMentorUnlocks(u, {
      announce: (u.vetTier || 0) >= MAX_VETERAN_TIER && prevTier < MAX_VETERAN_TIER,
      announcePartial: (u.vetTier || 0) < MAX_VETERAN_TIER,
    });
    return true;
  }

  function recruitSelectedEcho() {
    if (GS.creativeMode || typeof ThematicEraSynergies === 'undefined') return false;
    const id = GS.selectedUnitId || GS.selectedUnitIds[0];
    const u = id ? getUnitById(id) : null;
    const echoId = u?.type;
    if (!echoId) {
      showMessage('Select a champion to echo-recruit.', 180);
      return false;
    }
    const result = ThematicEraSynergies.recruitHeroEcho(echoId, {
      wave: GS.wave,
      showMessage,
      addHighlight,
    });
    if (!result.ok) {
      showMessage(result.msg || 'Cannot recruit echo.', 220);
      return false;
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      MythicPathEvolution.recordHeroEcho(echoId, GS.wave);
    }
    if (u) applyPlayerStatMods(u);
    svc('UI').updateHUD(true);
    if (svc('GrandStrategy')?.panelOpen) svc('GrandStrategy').renderPanel?.(getState());
    return true;
  }

  function applyPlayerStatMods(u) {
    if (!u || u.team !== 'player' || u.isDoomslayer) return u;
    const diff = getDifficulty();
    if (diff.allyHpMult && diff.allyHpMult !== 1) {
      u.maxHp = Math.floor(u.maxHp * diff.allyHpMult);
      u.hp = Math.min(u.hp, u.maxHp);
    }
    if (diff.allyDmgMult && diff.allyDmgMult !== 1) {
      u.damage = Math.floor(u.damage * diff.allyDmgMult);
    }
    if (diff.allyAccDelta) {
      u.accuracy = Math.max(0, Math.min(75, u.accuracy + diff.allyAccDelta));
    }
    if (diff.buildSpeedMult && diff.buildSpeedMult !== 1 && u.type === 'builder') {
      u.buildSpeedMult = (u.buildSpeedMult || 1) * diff.buildSpeedMult;
    }
    if (typeof getKingdomStageBuffs === 'function') {
      const kb = getKingdomStageBuffs(GS.wave);
      const defLine = u.type === 'footman' || u.type === 'archer' || u.type === 'pikeman';
      if (kb.defenseHpMult > 1 && defLine) {
        u.maxHp = Math.floor(u.maxHp * kb.defenseHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (kb.armyDmgMult > 1 && u.damage) {
        u.damage = Math.floor(u.damage * kb.armyDmgMult);
      }
      if (kb.siegeMult > 1 && (u.type === 'sapper' || u.type === 'ballista')) {
        u.siegeMult = (u.siegeMult || 1) * kb.siegeMult;
      }
    }
    if (svc('CrownLegacies') && !GS.creativeMode) {
      svc('CrownLegacies').applyUnitBonuses(u);
    }
    if (typeof EternalLegacyTree !== 'undefined' && !GS.creativeMode) {
      EternalLegacyTree.applyUnitBonuses(u, GS.wave);
    }
    if (typeof FoundationalMedievalLayer !== 'undefined' && !GS.creativeMode) {
      const fmods = FoundationalMedievalLayer.getRunModifiers(GS.wave);
      if (fmods.footmanHpMult > 1 && (u.type === 'footman' || u.type === 'pikeman')) {
        u.maxHp = Math.floor(u.maxHp * fmods.footmanHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (fmods.mythicMorale > 0 && u.team === 'player') {
        const mythic =
          (typeof isCrossoverUnit === 'function' && isCrossoverUnit(u.type)) ||
          (typeof isWweUnit === 'function' && isWweUnit(u.type)) ||
          u.type === 'doomslayer_hero';
        if (mythic) u.morale = Math.min(u.maxMorale, u.morale + fmods.mythicMorale);
      }
      u.foundationalDnaApplied = true;
    }
    if (typeof IntergalacticLayer !== 'undefined' && !GS.creativeMode) {
      IntergalacticLayer.applyCosmicUnitBonuses(u, GS.wave);
    }
    if (typeof AscensionSystem !== 'undefined' && !GS.creativeMode) {
      AscensionSystem.applySpawnBonusesFromBuildings(u, GS.buildings);
      AscensionSystem.reapplyAscensionBonuses(u);
    }
    if (typeof ThematicEraSynergies !== 'undefined' && !GS.creativeMode) {
      ThematicEraSynergies.applyThematicUnitBonuses(u, GS.wave);
    }
    if (typeof HybridPowerFantasy !== 'undefined' && !GS.creativeMode) {
      HybridPowerFantasy.applyUnitFantasy(u, GS.wave);
    }
    if (typeof NarrativeThread !== 'undefined' && !GS.creativeMode) {
      NarrativeThread.applyLegendBonuses(u, GS.wave);
    }
    if (typeof EternalPathFramework !== 'undefined' && !GS.creativeMode) {
      EternalPathFramework.applyPathUnitBonuses(u, GS.wave);
    }
    if (typeof MartialPathEvolution !== 'undefined' && !GS.creativeMode) {
      MartialPathEvolution.captureGeneFather(u, GS.wave);
      MartialPathEvolution.applyLegionUnitBonuses(u, GS.wave);
    }
    if (typeof ArcanePathEvolution !== 'undefined' && !GS.creativeMode) {
      ArcanePathEvolution.captureFoundingMage(u, GS.wave);
      ArcanePathEvolution.applyWeaverUnitBonuses(u, GS.wave);
    }
    if (typeof TechPathEvolution !== 'undefined' && !GS.creativeMode) {
      TechPathEvolution.captureFoundingBuilder(u, GS.wave);
      TechPathEvolution.applyFoundryUnitBonuses(u, GS.wave);
    }
    if (typeof MythicPathEvolution !== 'undefined' && !GS.creativeMode) {
      MythicPathEvolution.captureFirstChampion(u, GS.wave);
      MythicPathEvolution.applyChampionUnitBonuses(u, GS.wave);
    }
    if (typeof TechTreeBranches !== 'undefined' && !GS.creativeMode) {
      const fx = TechTreeBranches.getCombinedEffects(GS.wave);
      if (fx.footmanHpMult > 1 && (u.type === 'footman' || u.type === 'pikeman')) {
        u.maxHp = Math.floor(u.maxHp * fx.footmanHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (fx.mageDmgMult > 1 && ['mage', 'wizard', 'warlock', 'cleric', 'elemental'].includes(u.type) && u.damage) {
        u.damage = Math.floor(u.damage * fx.mageDmgMult);
      }
      if (fx.mageHpMult > 1 && ['mage', 'wizard', 'warlock', 'cleric', 'elemental', 'healer'].includes(u.type)) {
        u.maxHp = Math.floor(u.maxHp * fx.mageHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (fx.mythicHpMult > 1 && (isCrossoverUnit(u.type) || isWweUnit(u.type) || u.type === 'doomslayer_hero')) {
        u.maxHp = Math.floor(u.maxHp * fx.mythicHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (fx.mythicMorale > 0 && (isCrossoverUnit(u.type) || isWweUnit(u.type) || u.type === 'doomslayer_hero')) {
        u.morale = Math.min(u.maxMorale, u.morale + fx.mythicMorale);
      }
      if (fx.hpMult > 1) {
        u.maxHp = Math.floor(u.maxHp * fx.hpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (fx.buildSpeedMult > 1 && u.type === 'builder') {
        u.buildSpeedMult = (u.buildSpeedMult || 1) * fx.buildSpeedMult;
      }
    }
    if (typeof syncVeteranStatsToTier === 'function') syncVeteranStatsToTier(u);
    return u;
  }

  function ascendSelectedUnit() {
    if (GS.creativeMode || typeof AscensionSystem === 'undefined') return false;
    const id = GS.selectedUnitId || GS.selectedUnitIds[0];
    const u = id ? getUnitById(id) : null;
    if (!u || u.hp <= 0) {
      showMessage('Select a veteran to ascend.', 180);
      return false;
    }
    const result = AscensionSystem.tryAscendUnit(u, GS.wave, { showMessage, addHighlight });
    if (!result.ok) {
      showMessage(result.msg || 'Cannot ascend.', 220);
      return false;
    }
    svc('UI').updateHUD(true);
    svc('UX')?.showUnitInfo?.();
    return true;
  }

  function canDeployUnitType(type) {
    if (GS.creativeMode && !GS.creativeSettings.academyDeploy) {
      return type === 'doomslayer_hero' || isWweUnit(type) || isCrossoverUnit(type);
    }
    return true;
  }

  function setDifficulty(id) {
    if (DIFFICULTIES[id]) GS.difficultyId = id;
  }

  

  

  

  

  

  

  

  function scaleEnemyEconomyBuildingHp(b, waveNum) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return;
    const def = BuildDefs[b.type];
    if (!def?.isEnemySettlement) return;
    const targetWave = waveNum || GS.wave;
    const mult = getEnemyEconomyHpMult(targetWave);
    if (b._economyHpWave != null && b._economyHpWave >= targetWave) return;
    const baseHp = Math.max(1, def.hp ?? b.maxHp ?? 100);
    const ratio = b.maxHp > 0 ? Math.min(1, b.hp / b.maxHp) : 1;
    b.maxHp = Math.max(baseHp, Math.floor(baseHp * mult));
    b.hp = Math.max(1, Math.min(b.maxHp, Math.floor(b.maxHp * ratio)));
    b._economyHpWave = targetWave;
  }

  /** Legacy/engineer spawns may use player economy types with owner enemy — make them siegeable. */
  function normalizeEnemyEconomyBuilding(b) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return;
    if (b.type === 'trade_outpost' || b.type === 'quarry') {
      b.isEnemySettlement = true;
      b.isResourceGen = true;
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
      return;
    }
    if (b.type === 'enemy_trade_outpost' || b.type === 'enemy_quarry') {
      b.isEnemySettlement = true;
      b.isResourceGen = true;
      if (typeof getBuildingHitRadius === 'function') b.attackRadius = getBuildingHitRadius(b);
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
      return;
    }
    if (b.type === 'enemy_shadow_academy' || b.type === 'enemy_war_academy') {
      b.isEnemySettlement = true;
      b.isAcademy = true;
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
      if (!b.enemyFaction && svc('EnemyFactions')) {
        b.enemyFaction = svc('EnemyFactions').getBuildingFaction(b.type);
      }
    }
    if (b.isHamlet || b.isMerchantGuild) {
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
    }
  }

  function normalizeEnemyEconomyBuildings() {
    for (const b of GS.buildings) normalizeEnemyEconomyBuilding(b);
  }

  function countEnemyEconomySites(type) {
    let n = 0;
    for (let i = 0; i < GS.buildings.length; i++) {
      const b = GS.buildings[i];
      if (b.owner === 'enemy' && b.hp > 0 && b.type === type) n++;
    }
    return n;
  }

  

  /** Hamlets, guilds, and academies — campaign win targets (not mere trade posts / quarries). */
  function isNorthernHold(b) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return false;
    normalizeEnemyEconomyBuilding(b);
    if (isEnemyEconomyUnderConstruction(b)) return false;
    return !!(b.isHamlet || b.isMerchantGuild || (b.isAcademy && b.owner === 'enemy'));
  }

  function countLiveNorthernHolds() {
    normalizeEnemyEconomyBuildings();
    let n = 0;
    for (const b of GS.buildings) {
      if (isNorthernHold(b)) n++;
    }
    return n;
  }

  function countLiveEnemyEconomyBuildings() {
    normalizeEnemyEconomyBuildings();
    let n = 0;
    for (const b of GS.buildings) {
      if (isAttackableEnemyStructure(b)) n++;
    }
    return n;
  }

  function noteEnemyEconomyPresence(b) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return;
    normalizeEnemyEconomyBuilding(b);
    if (isAttackableEnemyStructure(b)) GS.enemyEconomyEverSpawned = true;
    if (isNorthernHold(b)) GS.northernHoldEverSpawned = true;
  }

  

  function getTpPerRound() {
    const waveScale = svc('GameDepth') ? svc('GameDepth').waveTpScale(GS.wave) : 1;
    const eased =
      typeof academyEase === 'function' ? academyEase(GS.wave) : Math.min(1, GS.wave / ACADEMY_ERA_WAVE);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(GS.wave) : 0;
    const bonus = Math.floor(eased * 30 * waveScale);
    const waveBonus = Math.min(5, Math.floor(eased * 5 * waveScale));
    const postBonus = Math.floor(post * 4 * waveScale);
    const diff = getDifficulty();
    const ecoGen = svc('ContentExpansion') ? svc('ContentExpansion').getEconomyTpBonus() : 0;
    const base =
      TP_PER_ROUND +
      bonus +
      waveBonus +
      postBonus +
      diff.tpPerRoundBonus +
      getSettlementTpBonus() +
      ecoGen;
    const cmdBonus = getAsymmetricMods().commanderTpRoundBonus || 0;
    return Math.floor(base * (diff.tpMult || 1)) + cmdBonus;
  }

  function isBuildSiteBlocked(wx, wy, bdef, excludeBuildingIds = null) {
    const margin = bdef?.radius ? Math.floor(bdef.radius * 0.55) : 12;
    const exclude = excludeBuildingIds
      ? new Set(Array.isArray(excludeBuildingIds) ? excludeBuildingIds : [excludeBuildingIds])
      : null;
    const snapOnHamlet = bdef?.isFortressUpgrade && exclude?.size;
    if (!snapOnHamlet && isBlocked(wx, wy, null, margin)) return true;
    for (const b of GS.buildings) {
      if (exclude?.has(b.id)) continue;
      const br = terrainBlockRadius(b);
      if (br <= 0) continue;
      const reach = (bdef?.radius || 20) + br + DECO_GAP * 2;
      if (posDistSq(wx, wy, b.x, b.y) < reach * reach) return true;
    }
    return false;
  }

  /** Snap fortress upgrade onto a nearby completed hamlet and exclude it from overlap checks. */
  function resolveFortressUpgradeSite(wx, wy, def) {
    if (!def?.isFortressUpgrade) return { x: wx, y: wy, hamlet: null };
    let best = null;
    let bestD = Infinity;
    const maxDist = def.requiresHamletNearby || 80;
    const maxDist2 = maxDist * maxDist;
    for (const b of GS.buildings) {
      if (!b.isHamlet || b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      const d2 = posDistSq(b.x, b.y, wx, wy);
      if (d2 < maxDist2 && d2 < bestD) {
        bestD = d2;
        best = b;
      }
    }
    if (!best) return null;
    return { x: best.x, y: best.y, hamlet: best };
  }

  function ach(type, data = {}) {
    if (GS.creativeMode && !GS.creativeSettings.enableAchievements) return;
    if (svc('Achievements')) svc('Achievements').onEvent(type, data);
  }

  function checkRosterSynergy(playerUnits) {
    const tags = new Set();
    for (const u of playerUnits || []) {
      if (!u.isCrossover && !u.isWwe) continue;
      tags.add(typeof getCrossoverCombatTag === 'function' ? getCrossoverCombatTag(u) : 'melee');
    }
    if (tags.has('melee') && tags.has('ranged') && tags.has('support')) ach('roster_synergy');
    if (svc('FactionDepth')) {
      const syns = svc('FactionDepth').computeSynergies(playerUnits);
      if (syns.length >= 2) ach('faction_synergy_multi', { count: syns.length });
      for (const u of playerUnits || []) svc('FactionDepth').applyToUnit(u, playerUnits);
    }
  }

  function isCreativeMode() {
    return GS.creativeMode;
  }

  function setCreativeSetting(key, value) {
    if (!(key in GS.creativeSettings)) return;
    GS.creativeSettings[key] = typeof GS.creativeSettings[key] === 'boolean' ? !!value : value;
    GS.creativeSettingsSigTick = -1;
    if (key === 'useCampaignRules' && value) {
      GS.creativeSettings.freeResources = false;
      GS.creativeSettings.noGameOver = false;
      GS.creativeSettings.noAutoCycle = false;
      GS.creativeSettings.instantBuild = false;
      GS.creativeSettings.enableAchievements = false;
    }
  }

  function applyCampaignRulesPreset(on) {
    setCreativeSetting('useCampaignRules', !!on);
    if (on) showMessage('Campaign rules ON — TP, elimination rules, and auto-cycle apply.', 260);
    else showMessage('Sandbox rules restored.', 160);
  }

  function creativeSetTool(tool, spawnType = null) {
    GS.creativeTool = tool;
    GS.creativeSpawnType = spawnType;
    if (tool && !String(tool).startsWith('level_') && typeof LevelEditor !== 'undefined') {
      LevelEditor.clearToolSelection();
    }
    if (tool) clearSelection();
    const label =
      tool === 'spawn_enemy'
        ? EnemyDefs[spawnType]?.name
        : tool === 'spawn_enemy_building'
          ? BuildDefs[spawnType]?.name
          : tool === 'spawn_player'
            ? getPlayerUnitDef(spawnType)?.name
            : tool === 'spawn_player_building'
              ? BuildDefs[spawnType]?.name
              : tool === 'spawn_squad'
                ? `Squad (${spawnType})`
                : tool?.startsWith('level_')
                  ? (typeof LevelEditor !== 'undefined'
                      ? LevelEditor.TOOLS.find((t) => t.id === tool)?.label
                      : null) || 'Level tool'
                  : null;
    if (label) showMessage(`Creative tool armed: ${label} — click the map.`, 200);
    else if (!tool) showMessage('Creative tool cleared.', 120);
  }

  function creativeFinishBuilding(b) {
    const def = BuildDefs[b.type];
    b.buildProgress = def?.buildTime || 0;
    b.complete = true;
    if (def?.waveBuildTime) {
      b.waveBuildRequired = def.waveBuildTime;
      b.waveBuildProgress = def.waveBuildTime;
    }
    onBuildingComplete(b);
  }

  function creativeInstantPlaceBuilding(type, wx, wy) {
    const def = BuildDefs[type];
    if (!def) return false;
    if (!GS.creativeSettings.freeResources && GS.tactical < def.cost) return false;
    if (
      def.isWweAcademy &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('MetaProgress').isWweUnlocked()
    )
      return false;
    if (
      def.isCrossoverBarracks &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('MetaProgress').isCrossoverFactionUnlocked(def.crossoverFaction)
    )
      return false;
    if (
      def.isPerkMachine &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('Perks').perkMachinesUnlocked()
    )
      return false;
    if (
      svc('Research') &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('Research').isBuildUnlocked(type, getResearchOpts())
    )
      return false;
    if (
      isVanillaAcademyType(type) &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !canBuildAcademyType(type, GS.wave, GS.units)
    )
      return false;
    let buildX = wx;
    let buildY = wy;
    let excludeBuildId = null;
    if (def.isFortressUpgrade) {
      const site = resolveFortressUpgradeSite(wx, wy, def);
      if (!site) {
        showMessage('Fortress upgrade must be placed on a completed settlement!');
        return false;
      }
      buildX = site.x;
      buildY = site.y;
      excludeBuildId = site.hamlet.id;
    }
    if (isBuildSiteBlocked(buildX, buildY, def, excludeBuildId)) {
      // Creative / tests: nudge off trees and rocks instead of hard-failing the spawn.
      let found = false;
      const radii = [18, 32, 48, 70, 100];
      outer: for (const r of radii) {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const px = buildX + Math.cos(ang) * r;
          const py = buildY + Math.sin(ang) * r;
          const c = clampPos(px, py);
          if (!isBuildSiteBlocked(c.x, c.y, def, excludeBuildId)) {
            buildX = c.x;
            buildY = c.y;
            found = true;
            break outer;
          }
        }
      }
      if (!found) {
        showMessage('Not enough space here!');
        return false;
      }
    }
    if (!GS.creativeSettings.freeResources) GS.tactical -= def.cost;
    GS.selectedBuild = null;
    playSfx('buildPlace');
    if (type === 'castle') {
      const groupId = Math.random().toString(36).slice(2, 9);
      getCastleCompoundLayout(wx, wy).forEach((l) => {
        const b = createBuilding(l.type, l.x, l.y, 'player', {
          facing: l.facing,
          castleGroup: groupId,
        });
        creativeFinishBuilding(b);
        GS.buildings.push(b);
      });
      invalidateObstacles();
      syncInteractionState({ refreshCounts: true });
      showMessage('Castle compound placed (instant).');
      return true;
    }
    const wallOpts = type === 'wall' ? { facing: GS.pendingWallFacing } : {};
    const b = createBuilding(type, buildX, buildY, 'player', wallOpts);
    creativeFinishBuilding(b);
    GS.buildings.push(b);
    invalidateObstacles();
    syncInteractionState({ refreshCounts: true });
    showMessage(`${def.name} placed (instant).`);
    return true;
  }

  function creativeSpawnEnemyAt(type, x, y, opts = {}) {
    const u = spawnUnit(type, x, y, 'enemy');
    if (!u) return false;
    u.rotation = opts.rotation ?? 90;
    u.huntMode = true;
    if (svc('GameDepth')) {
      const cfg = GS.currentWaveConfig || getWaveConfig(GS.wave);
      svc('GameDepth').applyEnemySpawnScaling(u, GS.wave, {
        cfg,
        diff: getDifficulty(),
        waveModifiers: GS.waveModifiers,
        hordeWave: GS.currentHordeWave,
        colonyThreat: GS.colonyThreatMods,
        namedBossScale: u.isNamedBoss ? GS.namedBossWave?.scale : null,
      });
    }
    if (opts.hpMult) {
      u.maxHp = Math.floor(u.maxHp * opts.hpMult);
      u.hp = u.maxHp;
    }
    if (opts.dmgMult) u.damage = Math.floor(u.damage * opts.dmgMult);
    if (opts.elite) {
      u.maxHp = Math.floor(u.maxHp * 1.35);
      u.hp = u.maxHp;
      u.damage = Math.floor(u.damage * 1.2);
    }
    GS.units.push(u);
    svc('Particles').dust(x, y);
    playSfx('deploy');
    svc('CreativeTools') && svc('CreativeTools').bumpStat('spawns');
    svc('CreativeTools') && svc('CreativeTools').recordFrame(`spawn:${type}`);
    return true;
  }

  function creativeSpawnPlayerAt(type, x, y) {
    if (!canDeployUnitType(type) && !GS.creativeSettings.academyDeploy) {
      showMessage('Academy deploy off — cannot spawn troop type.');
      return false;
    }
    if (
      typeof isCrossoverUnit === 'function' &&
      isCrossoverUnit(type) &&
      getCrossoverOnField().includes(type)
    ) {
      const name = typeof getCrossoverDef === 'function' ? getCrossoverDef(type)?.name : type;
      showMessage(`${name || type} is already on the field!`);
      return false;
    }
    const u = spawnUnit(type, x, y, 'player');
    if (!u) return false;
    if (typeof ensureHealerStats === 'function') ensureHealerStats(u);
    applyPlayerStatMods(u);
    if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
    if (svc('FactionDepth')) svc('FactionDepth').applyToUnit(u, GS.units);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (u.canHunt && !u.huntMode) {
      u.manualOrder = true;
      u.holdX = u.x;
      u.holdY = u.y;
      u.targetX = u.x;
      u.targetY = u.y;
      u.pathTargetId = 'hold';
    }
    GS.units.push(u);
    svc('Particles').dust(x, y);
    playSfx('deploy');
    svc('CreativeTools') && svc('CreativeTools').bumpStat('spawns');
    return true;
  }

  function creativeSpawnSquadAt(squadKey, x, y) {
    const squads = {
      line: ['footman', 'footman', 'footman', 'archer', 'archer'],
      cavalry: ['cavalry', 'cavalry', 'knight'],
      siege: ['sapper', 'ballista', 'footman', 'footman'],
      casters: ['mage', 'mage', 'healer', 'bard'],
      elites: ['knight', 'knight', 'pikeman', 'scout'],
    };
    const list = squads[squadKey] || squads.line;
    list.forEach((t, i) =>
      creativeSpawnPlayerAt(t, x + (i % 3) * 20 - 20, y + Math.floor(i / 3) * 22)
    );
    return true;
  }

  function creativeSpawnPlayerBuildingAt(type, x, y) {
    return creativeInstantPlaceBuilding(type, x, y);
  }

  function randomMapEdgePos() {
    const side = ['north', 'east', 'west', 'south'][Math.floor(Math.random() * 4)];
    const p = spawnPosForSide(side);
    return { x: p.x + (Math.random() - 0.5) * 40, y: p.y + (Math.random() - 0.5) * 20 };
  }

  function getWorldCenter() {
    return { x: GS.worldW / 2, y: (GS.deployY + GS.rallyY) / 2 };
  }

  

  function creativeSetTp(n) {
    GS.tactical = Math.max(0, Math.floor(n));
    sanitizeTactical();
    invalidateStateCache();
  }

  function creativeSpawnEnemyBuildingAt(type, x, y) {
    const def = BuildDefs[type];
    if (!def || def.owner === 'player' || !def.isEnemySettlement) return false;
    if (isBuildSiteBlocked(x, y, def)) {
      showMessage('Blocked — need open ground.');
      return false;
    }
    const b = createBuilding(type, x, y, 'enemy');
    creativeFinishBuilding(b);
    GS.buildings.push(b);
    noteEnemyEconomyPresence(b);
    invalidateObstacles();
    svc('Particles').dust(x, y);
    showMessage(`${def.name} placed.`);
    return true;
  }

  function creativeSetWave(n, opts = {}) {
    GS.wave = Math.max(0, Math.floor(n));
    const prevW = GS.worldW;
    const prevH = GS.worldH;
    applyWorldSize(GS.wave);
    const grew = GS.worldW > prevW || GS.worldH > prevH;
    if (grew) {
      // Match campaign growth: center old content so land appears on all sides.
      shiftWorldEntities((GS.worldW - prevW) / 2, (GS.worldH - prevH) / 2);
      if (!opts.skipTerrain) populateNewTerritory(prevW, prevH);
      resolveUnitsInTerrain();
      invalidateObstacles();
      // Rebuild walk grids immediately so pathing works on the new bounds this frame.
      GS.walkGridRebuildDue = true;
      GS.walkGridRebuildTick = -9999;
      maybeRebuildWalkGrids();
      if (typeof resize === 'function') resize();
      if (typeof applyCamera === 'function') applyCamera();
    } else if (!opts.skipTerrain) {
      ensureInitialBattlefield(true);
    }
    GS.spawnQueue = [];
    GS.spawnTimer = 0;
    GS.waveProgress = 0;
    showMessage(
      grew
        ? `Creative: wave ${GS.wave} · map ${GS.worldW}×${GS.worldH} (expanded all sides)`
        : `Creative: wave set to ${GS.wave}.`,
      180
    );
  }

  function creativeAddTp(amount) {
    GS.tactical += amount;
    showMessage(`Creative: +${amount} TP`, 120);
  }

  function creativeForceNight() {
    if (!isNightPhase()) enterNightPhase();
    else showMessage('Already night.', 100);
  }

  function creativeForceDay() {
    beginDayPhase(true);
  }

  function creativeStartWave() {
    if (isDayPhase() && (GS.spawnQueue.length > 0 || countActiveEnemies() > 0)) {
      showMessage('Clear current wave first or use Clear Wave Spawns.', 200);
      return;
    }
    if (isNightPhase()) beginDayPhase(true);
    else startNextWave();
  }

  function setCustomWave(spec) {
    if (!spec) {
      GS.creativeCustomWave = null;
      return;
    }
    const text = spec.text || spec;
    const queue = svc('CreativeTools') ? svc('CreativeTools').parseWaveComposer(text) : [];
    if (!queue.length) {
      showMessage('Wave composer: no valid enemies parsed.');
      return false;
    }
    GS.creativeCustomWave = {
      queue,
      interval: Math.max(12, parseInt(spec.interval, 10) || 50),
      hpMult: parseFloat(spec.hpMult) || 1,
      dmgMult: parseFloat(spec.dmgMult) || 1,
      text: typeof text === 'string' ? text : CreativeTools?.formatWaveComposer(queue),
    };
    showMessage(`Custom wave queued: ${queue.length} enemies.`, 220);
    return true;
  }

  function getCustomWave() {
    return GS.creativeCustomWave ? { ...GS.creativeCustomWave } : null;
  }

  function creativeLaunchCustomWave() {
    if (!GS.creativeCustomWave?.queue?.length) {
      showMessage('Build a custom wave in the composer first.');
      return false;
    }
    if (isDayPhase() && (GS.spawnQueue.length > 0 || countActiveEnemies() > 0)) {
      creativeClearWaveSpawns();
    }
    GS.spawnQueue = [...GS.creativeCustomWave.queue];
    GS.waveEnemyTotal = GS.spawnQueue.length;
    GS.waveProgress = 0;
    GS.spawnTimer = 8;
    GS.currentWaveConfig = {
      count: GS.spawnQueue.length,
      pool: [...new Set(GS.spawnQueue)],
      interval: GS.creativeCustomWave.interval,
      boss: GS.spawnQueue.includes('war_chief'),
      hpScale: GS.creativeCustomWave.hpMult,
      dmgScale: GS.creativeCustomWave.dmgMult,
    };
    GS.nextWaveIntel = `Custom: ${GS.creativeCustomWave.text || GS.spawnQueue.length + ' foes'}`;
    if (isNightPhase()) {
      GS.timeOfDay = 'day';
      GS.nightTimer = 0;
    }
    GS.spawnTimer = 8;
    svc('CreativeTools') && svc('CreativeTools').bumpStat('wavesLaunched');
    svc('CreativeTools') && svc('CreativeTools').recordFrame('custom_wave');
    showMessage(`Launching custom wave (${GS.spawnQueue.length})…`, 240);
    return true;
  }

  function getUnitsSnapshot() {
    return GS.units
      .filter((u) => u.hp > 0)
      .map((u) => ({
        id: u.id,
        type: u.type,
        team: u.team,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHp: u.maxHp,
        damage: u.damage,
        accuracy: u.accuracy,
        speed: u.speed,
        range: u.range,
        morale: u.morale,
        maxMorale: u.maxMorale,
        vetBronze: u.vetBronze,
        vetSilver: u.vetSilver,
        vetGold: u.vetGold,
      }));
  }

  function getBuildingsSnapshot() {
    return GS.buildings
      .filter((b) => b.hp > 0)
      .map((b) => ({
        id: b.id,
        type: b.type,
        owner: b.owner,
        x: b.x,
        y: b.y,
        hp: b.hp,
        maxHp: b.maxHp,
        complete: b.complete,
        facing: b.facing,
        radius: b.radius,
        // Flags needed by Research / academy / economy UIs that read snapshots.
        isResearchLab: !!b.isResearchLab,
        isAcademy: !!b.isAcademy,
        isHamlet: !!b.isHamlet,
        isSettlement: !!b.isSettlement,
        isResourceGen: !!b.isResourceGen,
        academyUnit: b.academyUnit || null,
      }));
  }

  function getDecorationsSnapshot() {
    return GS.decorations
      .filter((d) => d.hp > 0)
      .map((d) => ({
        type: d.type,
        x: d.x,
        y: d.y,
        size: d.size,
        hp: d.hp,
        blocksMove: d.blocksMove,
        blocksLOS: d.blocksLOS,
        cover: d.cover,
        radius: d.radius,
      }));
  }

  function getLevelSnapshot(meta = {}) {
    return {
      v: 1,
      type: 'level',
      id: meta.id || null,
      name: meta.name || 'Untitled Level',
      description: meta.description || '',
      author: meta.author || '',
      wave: GS.wave,
      worldW: GS.worldW,
      worldH: GS.worldH,
      timeOfDay: GS.timeOfDay,
      tactical: GS.tactical,
      settings: { ...GS.creativeSettings },
      customWave: getCustomWave(),
      units: getUnitsSnapshot(),
      buildings: getBuildingsSnapshot(),
      decorations: getDecorationsSnapshot(),
      createdAt: meta.createdAt || null,
      modifiedAt: new Date().toISOString(),
    };
  }

  function clearCreativeEntities(opts = {}) {
    releaseAllUnits();
    GS.spawnQueue = [];
    if (opts.buildings !== false) {
      for (let i = GS.buildings.length - 1; i >= 0; i--) {
        const b = GS.buildings[i];
        if (b.isCastle) continue;
        finalizeBuildingDestroyed(b, { silent: true, playDeath: false });
      }
    }
    if (opts.decorations !== false) GS.decorations = [];
    invalidateObstacles();
  }

  function restoreLevelEntities(frame) {
    for (const su of frame.units || []) {
      const u = spawnUnit(su.type, su.x, su.y, su.team);
      if (!u) continue;
      u.hp = su.hp ?? u.hp;
      u.maxHp = su.maxHp ?? u.maxHp;
      u.damage = su.damage ?? u.damage;
      u.accuracy = su.accuracy ?? u.accuracy;
      u.speed = su.speed ?? u.speed;
      u.range = su.range ?? u.range;
      u.morale = su.morale ?? u.morale;
      u.maxMorale = su.maxMorale ?? u.maxMorale;
      u.vetBronze = su.vetBronze || 0;
      u.vetSilver = su.vetSilver || 0;
      u.vetGold = su.vetGold || 0;
      if (su.team === 'player') {
        u.targetY = GS.rallyY;
        applyPlayerStatMods(u);
        if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
      } else u.huntMode = true;
      GS.units.push(u);
    }
    for (const sb of frame.buildings || []) {
      if (GS.buildings.some((b) => Math.hypot(b.x - sb.x, b.y - sb.y) < 8 && b.type === sb.type))
        continue;
      const b = createBuilding(sb.type, sb.x, sb.y, sb.owner || 'player', {
        facing: sb.facing,
      });
      creativeFinishBuilding(b);
      Object.assign(b, sb);
      ensureBuildingHealth(b);
      normalizeEnemyEconomyBuilding(b);
      GS.buildings.push(b);
    }
    for (const sd of frame.decorations || []) {
      GS.decorations.push({
        ...sd,
        id: sd.id || `deco_${GS.decorations.length}`,
        blocksMove: sd.blocksMove !== false,
        blocksLOS: sd.blocksLOS !== false,
      });
    }
  }

  function loadCreativeLevel(level) {
    if (!level) return false;
    if (level.settings) {
      for (const [k, v] of Object.entries(level.settings)) setCreativeSetting(k, v);
    }
    if (level.wave != null) creativeSetWave(level.wave, { skipTerrain: true });
    if (level.tactical != null) creativeSetTp(level.tactical);
    clearCreativeEntities();
    restoreLevelEntities(level);
    if (level.customWave) setCustomWave(level.customWave);
    else GS.creativeCustomWave = null;
    if (level.timeOfDay === 'night' && isDayPhase()) creativeForceNight();
    else if (level.timeOfDay === 'day' && isNightPhase()) creativeForceDay();
    invalidateObstacles();
    showMessage(`Level loaded: ${level.name || 'Untitled'}`, 220);
    return true;
  }

  function creativePlaceDecoration(type, x, y) {
    const specs = {
      tree: { size: 20 + Math.random() * 8, hp: 999, radius: 18, cover: 0.45 },
      rock: { size: 12 + Math.random() * 6, hp: 999, radius: 12, cover: 0.3 },
      barricade: { size: 16, hp: 60, radius: 16, cover: 0.4 },
    };
    const spec = specs[type];
    if (!spec) return false;
    if (isBuildSiteBlocked(x, y, { footprint: spec.radius })) {
      showMessage('Terrain blocked — try another tile.');
      return false;
    }
    GS.decorations.push({
      type,
      id: `deco_${Date.now()}_${GS.decorations.length}`,
      x,
      y,
      ...spec,
      blocksMove: true,
      blocksLOS: true,
    });
    invalidateObstacles();
    svc('Particles')?.dust?.(x, y);
    return true;
  }

  function creativeEraseAt(x, y, radius = 30) {
    let best = null;
    let bestDist2 = radius * radius;
    for (let i = GS.decorations.length - 1; i >= 0; i--) {
      const d = GS.decorations[i];
      if (d.hp <= 0) continue;
      const dist2 = posDistSq(d.x, d.y, x, y);
      if (dist2 < bestDist2) {
        best = { kind: 'deco', index: i, dist2 };
        bestDist2 = dist2;
      }
    }
    for (const u of GS.units) {
      if (u.hp <= 0) continue;
      const dist2 = posDistSq(u.x, u.y, x, y);
      if (dist2 < bestDist2) {
        best = { kind: 'unit', id: u.id, dist2 };
        bestDist2 = dist2;
      }
    }
    for (const b of GS.buildings) {
      if (b.hp <= 0 || b.isCastle) continue;
      const dist2 = posDistSq(b.x, b.y, x, y);
      if (dist2 < bestDist2) {
        best = { kind: 'building', id: b.id, dist2 };
        bestDist2 = dist2;
      }
    }
    if (!best) return false;
    if (best.kind === 'deco') GS.decorations.splice(best.index, 1);
    else if (best.kind === 'unit') {
      const u = getUnitById(best.id);
      if (u) u.hp = 0;
    } else if (best.kind === 'building') {
      const b = GS.buildings.find((bb) => bb.id === best.id);
      if (b) finalizeBuildingDestroyed(b, { silent: true, playDeath: false });
    }
    invalidateObstacles();
    return true;
  }

  function creativeMoveUnitTo(id, x, y) {
    const u = getUnitById(id);
    if (!u || u.hp <= 0) return false;
    const pos = clampPos(x, y);
    u.x = pos.x;
    u.y = pos.y;
    u.path = [];
    u.pathIndex = 0;
    u.manualOrder = false;
    return true;
  }

  function creativeMoveBuildingTo(id, x, y) {
    const b = GS.buildings.find((bb) => bb.id === id);
    if (!b || b.hp <= 0) return false;
    const pos = clampPos(x, y);
    b.x = pos.x;
    b.y = pos.y;
    invalidateObstacles();
    return true;
  }

  function creativeMoveDecorationTo(index, x, y) {
    const d = GS.decorations[index];
    if (!d || d.hp <= 0) return false;
    d.x = x;
    d.y = y;
    invalidateObstacles();
    return true;
  }

  function creativeClearDecorations() {
    GS.decorations = [];
    invalidateObstacles();
  }

  function creativeClearAllBuildings() {
    for (let i = GS.buildings.length - 1; i >= 0; i--) {
      const b = GS.buildings[i];
      if (b.isCastle) continue;
      finalizeBuildingDestroyed(b, { silent: true, playDeath: false });
    }
    invalidateObstacles();
  }

  function creativeClearAllUnits() {
    GS.units.forEach((u) => {
      u.hp = 0;
    });
  }

  function restoreCreativeSnapshot(frame) {
    if (!frame) return false;
    if (frame.wave != null) creativeSetWave(frame.wave);
    if (frame.tactical != null) creativeSetTp(frame.tactical);
    releaseAllUnits();
    for (const su of frame.units || []) {
      const u = spawnUnit(su.type, su.x, su.y, su.team);
      if (!u) continue;
      u.hp = su.hp;
      u.maxHp = su.maxHp;
      u.damage = su.damage;
      u.accuracy = su.accuracy;
      u.speed = su.speed;
      u.range = su.range;
      u.morale = su.morale;
      u.maxMorale = su.maxMorale;
      u.vetBronze = su.vetBronze || 0;
      u.vetSilver = su.vetSilver || 0;
      u.vetGold = su.vetGold || 0;
      if (su.team === 'player') {
        u.targetY = GS.rallyY;
        applyPlayerStatMods(u);
      } else u.huntMode = true;
      GS.units.push(u);
    }
    if (frame.decorations?.length) {
      GS.decorations = frame.decorations.map((d, i) => ({
        ...d,
        id: d.id || `deco_${i}`,
        blocksMove: d.blocksMove !== false,
        blocksLOS: d.blocksLOS !== false,
      }));
    }
    if (frame.buildings?.length) {
      for (let i = GS.buildings.length - 1; i >= 0; i--) {
        const b = GS.buildings[i];
        if (b.owner === 'player' && b.isCastle) continue;
        GS.buildings.splice(i, 1);
        releaseBuildingRecord(b);
      }
      for (const sb of frame.buildings) {
        if (GS.buildings.some((b) => Math.hypot(b.x - sb.x, b.y - sb.y) < 8)) continue;
        const b = createBuilding(sb.type, sb.x, sb.y, sb.owner || 'player');
        creativeFinishBuilding(b);
        Object.assign(b, sb);
        ensureBuildingHealth(b);
        normalizeEnemyEconomyBuilding(b);
        GS.buildings.push(b);
      }
      invalidateObstacles();
    }
    if (frame.timeOfDay === 'night' && isDayPhase()) creativeForceNight();
    if (frame.timeOfDay === 'day' && isNightPhase()) creativeForceDay();
    return true;
  }

  

  

  function creativeResetUnitToDef() {
    const u = getSelectedUnit();
    if (!u) {
      showMessage('Select a unit first.');
      return false;
    }
    const def = u.team === 'player' ? getPlayerUnitDef(u.type) : EnemyDefs[u.type];
    if (!def) return false;
    u.maxHp = def.hp;
    u.hp = u.maxHp;
    u.damage = def.damage;
    u.accuracy = def.accuracy;
    u.speed = def.speed;
    u.range = def.range;
    u.baseRange = def.range;
    u.morale = def.morale || 10;
    u.maxMorale = u.morale;
    showMessage(`${unitDisplayName(u)} reset to default stats.`, 160);
    return true;
  }

  function creativeApplyStatEditor() {
    const u = getSelectedUnit();
    if (!u) {
      showMessage('Select a unit for stat edit.');
      return false;
    }
    const hp = parseInt(document.getElementById('creative-stat-hp')?.value, 10);
    const dmg = parseInt(document.getElementById('creative-stat-dmg')?.value, 10);
    const acc = parseInt(document.getElementById('creative-stat-acc')?.value, 10);
    const spd = parseFloat(document.getElementById('creative-stat-spd')?.value);
    const rng = parseInt(document.getElementById('creative-stat-rng')?.value, 10);
    return applyCreativeUnitStats(u, {
      hp: Number.isFinite(hp) ? hp : undefined,
      damage: Number.isFinite(dmg) ? dmg : undefined,
      accuracy: Number.isFinite(acc) ? acc : undefined,
      speed: Number.isFinite(spd) ? spd : undefined,
      range: Number.isFinite(rng) ? rng : undefined,
    });
  }

  function creativeFillStatEditorFromSelection() {
    const u = getSelectedUnit();
    if (!u) return;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = String(v ?? '');
    };
    set('creative-stat-hp', u.maxHp);
    set('creative-stat-dmg', u.damage);
    set('creative-stat-acc', u.accuracy);
    set('creative-stat-spd', u.speed);
    set('creative-stat-rng', u.range);
  }

  function creativeRegenerateMap() {
    GS.terrainInitialized = false;
    ensureInitialBattlefield(true);
    showMessage('Battlefield regenerated (decorations & hazards refreshed).', 200);
  }

  function creativeClearWaveSpawns() {
    GS.spawnQueue = [];
    GS.units
      .filter((u) => u.team === 'enemy')
      .forEach((u) => {
        u.hp = 0;
      });
    GS.spawnTimer = 0;
    GS.waveProgress = 0;
    showMessage('Creative: wave spawns and enemies cleared.', 160);
  }

  function creativeClearEnemies() {
    GS.units
      .filter((u) => u.team === 'enemy')
      .forEach((u) => {
        u.hp = 0;
      });
    GS.spawnQueue = [];
    showMessage('All enemies removed.', 140);
  }

  function creativeClearEnemyBuildings() {
    GS.buildings = GS.buildings.filter((b) => b.owner !== 'enemy');
    invalidateObstacles();
    showMessage('Enemy buildings removed.', 140);
  }

  function creativeHealAll() {
    GS.units
      .filter((u) => u.team === 'player' && u.hp > 0)
      .forEach((u) => {
        u.hp = u.maxHp;
        u.demoralized = false;
        u.fleeing = false;
        u.witnessDeaths = 0;
      });
    showMessage('All allies healed.', 140);
  }

  function creativeMaxMorale() {
    GS.units
      .filter((u) => u.team === 'player' && u.hp > 0)
      .forEach((u) => {
        u.morale = u.maxMorale;
        u.demoralized = false;
        u.fleeing = false;
      });
    showMessage('Army morale maxed.', 140);
  }

  function getUnitById(id) {
    if (!id) return null;
    if (GS.unitByIdFrame !== GS.updateTick) {
      unitById.clear();
      for (const u of GS.units) {
        if (u && u.hp > 0 && !u._pooled) unitById.set(u.id, u);
      }
      GS.unitByIdFrame = GS.updateTick;
    }
    const cached = unitById.get(id);
    if (cached && cached.hp > 0 && !cached._pooled && cached.id === id) return cached;
    if (cached) unitById.delete(id);
    const found = GS.units.find((u) => u && u.id === id && u.hp > 0 && !u._pooled) || null;
    if (found) unitById.set(id, found);
    return found;
  }

  function getSelectedUnit() {
    return GS.selectedUnitId ? getUnitById(GS.selectedUnitId) : null;
  }

  function creativeRankUpSelected() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) {
      showMessage('Select a living ally first.');
      return;
    }
    notifyVetStarEvent(u, addVetStar(u));
    showMessage(`${unitDisplayName(u)} earned a star!`, 160);
  }

  function creativeMaxStarsSelected() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) {
      showMessage('Select a living ally first.');
      return;
    }
    let safety = 0;
    while ((u.vetGold || 0) < 3 && safety++ < 40) addVetStar(u);
    if (u.type === 'general') u.generalStars = Math.max(u.generalStars || 0, 3);
    showMessage(`${unitDisplayName(u)} maxed veteran stars!`, 180);
  }

  function creativeHealSelected() {
    const u = getSelectedUnit();
    if (!u || u.hp <= 0) {
      showMessage('Select a unit first.');
      return;
    }
    u.hp = u.maxHp;
    u.demoralized = false;
    u.fleeing = false;
    svc('FloatingText').heal(u.x, u.y, u.maxHp);
    showMessage(`${unitDisplayName(u)} fully healed.`, 140);
  }

  function creativeKillSelected() {
    const u = getSelectedUnit();
    if (!u) {
      showMessage('Select a unit first.');
      return;
    }
    u.hp = 0;
    showMessage(`${unitDisplayName(u)} removed.`, 120);
  }

  function creativePromoteSelectedGeneral() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.type !== 'footman' || u.hp <= 0) {
      showMessage('Select a living Footman to promote.');
      return;
    }
    if (findPlayerGeneral()) {
      showMessage('A General already commands the field.');
      return;
    }
    releaseFromWallGarrison(u);
    releaseFromGarrison(u);
    promoteFootmanToGeneral(u);
    recordFootmanCommandElevation(u, true);
    showMessage(`${u.honorName || 'Footman'} promoted to General!`, 200);
  }

  function startCreative(opts = {}) {
    GS.creativeSettings = { ...CREATIVE_DEFAULTS, ...opts };
    GS.creativeTool = null;
    GS.creativeSpawnType = null;
    if (typeof LevelEditor !== 'undefined') LevelEditor.onSessionStart();
    start({ creative: true });
  }

  

  function addHighlight(type, text) {
    GS.sessionHighlights.push({ type, text, wave: GS.wave, tick: GS.updateTick });
    if (GS.sessionHighlights.length > 48) GS.sessionHighlights.shift();
  }

  function recordFootmanCommandElevation(unit, promoted = false) {
    if (!unit || unit.team !== 'player') return;
    if (!promoted && unit.type !== 'footman') return;
    const key = unit.id || unit.honorName || `${unit.type}_${unit.x | 0}_${unit.y | 0}`;
    ach('footman_command_elevated', { unitKey: key, promoted: !!promoted });
    if (promoted) {
      ach('footman_promoted_general', { unitKey: key });
      ach('general_fielded', { wave: GS.wave });
    }
  }

  function announceHonorName(unit, extra = '') {
    if (!unit.honorName) return;
    if (svc('Legacy')) svc('Legacy').recordHonor(unit, GS.wave);
    addHighlight('honor', `${unit.honorName} honored by the Crown`);
    svc('FloatingText').status(unit.x, unit.y - 12, unit.honorName, '#ffd700');
    showMessage(
      `The Crown names ${unit.honorName}${extra} — gold-star devotion to the realm!`,
      320
    );
    svc('Particles').heal(unit.x, unit.y);
    playSfx('reinforce');
    ach('vet_event', { event: 'honored', unitType: unit.type, honorName: unit.honorName });
    if (unit.type === 'footman') recordFootmanCommandElevation(unit);
    if (typeof NarrativeThread !== 'undefined' && !GS.creativeMode) {
      NarrativeThread.onHeroHonored(unit, GS.wave, { showMessage, addHighlight });
    }
  }

  function notifyVetStarEvent(unit, event) {
    if (!event || unit.team !== 'player') return;
    const spec = isSpecialistUnit(unit);

    if (event === 'honored_upgrade' || event === 'honored_general_star') {
      if (svc('VisualPolish')) svc('VisualPolish').honorFx(unit);
      const label = getVeteranLabel(unit);
      svc('FloatingText').status(
        unit.x,
        unit.y,
        spec ? 'RANK UP!' : 'VETERAN!',
        VET_STAR_COLORS.gold
      );
      const bonus = unit.isGeneral
        ? `command aura +${Math.round((unit.generalStars || 0) * 4.5)}%`
        : unit.type === 'healer'
          ? '+heal, +range'
          : unit.type === 'builder'
            ? '+build speed, +range'
            : unit.type === 'courier'
              ? '+speed, faster dispatch'
              : '+HP, +damage, +speed';
      announceHonorName(unit, label ? `, now ${label}` : '');
      showMessage(`${label || getUnitDisplayName(unit)} — ${bonus}`);
    } else if (event === 'upgrade') {
      if (svc('VisualPolish')) svc('VisualPolish').vetUpgradeFx(unit);
      const label = getVeteranLabel(unit);
      svc('FloatingText').status(
        unit.x,
        unit.y,
        spec ? 'RANK UP!' : 'VETERAN!',
        VET_STAR_COLORS.gold
      );
      const bonus =
        unit.type === 'healer'
          ? '+heal, +range'
          : unit.type === 'builder'
            ? '+build speed, +range'
            : unit.type === 'courier'
              ? '+speed, faster dispatch'
              : '+HP, +damage, +speed';
      showMessage(`${label} — ${bonus}`);
      svc('Particles').heal(unit.x, unit.y);
      playSfx('reinforce');
      // Specialist auto-ranks and combat promotions — refresh academy mentor gate.
      refreshAcademyMentorUnlocks(unit, {
        announce: isMaxLevelVeteran(unit),
        announcePartial: !isMaxLevelVeteran(unit) && isSpecialistUnit(unit),
      });
    } else if (event === 'max_rank' || event === 'honored_max') {
      refreshAcademyMentorUnlocks(unit, { announce: true });
    } else if (event === 'upgrade_eligible' || event === 'honored_eligible') {
      const cost = getVeteranUpgradeCost(unit);
      const name = getUnitDisplayName(unit);
      svc('FloatingText').status(unit.x, unit.y, 'PROMOTE?', '#c0a040');
      showMessage(
        `${name} earned promotion — research Veteran Doctrine, then spend ${cost} TP (unit panel or U).`,
        340
      );
      playSfx('reinforce');
    } else if (event === 'general_star') {
      svc('FloatingText').status(unit.x, unit.y, '★ Command', VET_STAR_COLORS.gold);
      showMessage(`${getUnitDisplayName(unit)} — command star earned (+aura)`, 220);
      svc('Particles').heal(unit.x, unit.y);
    } else if (event === 'gold') {
      if (svc('VisualPolish')) svc('VisualPolish').vetUpgradeFx(unit);
      svc('FloatingText').status(unit.x, unit.y, '★ Gold', VET_STAR_COLORS.gold);
    } else if (event === 'silver') {
      svc('FloatingText').status(unit.x, unit.y, '★ Silver', VET_STAR_COLORS.silver);
    } else if (event === 'bronze') {
      svc('FloatingText').status(unit.x, unit.y, spec ? '★ Rank' : '★', specialistStarColor(unit));
    }
    if (event === 'gold' || event === 'honored_upgrade') {
      svc('Particles').heal(unit.x, unit.y);
      if ((unit.vetGold || 0) >= 3 || event === 'honored_upgrade') {
        CombatFX?.hitSpark(unit.x, unit.y - 8);
        unit.honorGlowTimer = 240;
      }
    }
    if (event !== 'honored_upgrade' && event !== 'honored_general_star') {
      ach('vet_event', { event, unitType: unit.type, vetTier: unit.vetTier });
    }
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
    return r;
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

    const maxSeek =
      unit.team === 'enemy'
        ? Math.max(maxAttackRange(unit) + 220, 450)
        : maxAttackRange(unit) + 140;
    const options = [];
    let foeList;
    if (useSpatialQueries()) {
      svc('Spatial').queryRadiusInto(
        unit.x,
        unit.y,
        maxSeek,
        (e) => e.kind === 'unit' && e.ref?.team !== unit.team && e.ref?.hp > 0 && !e.ref?.fleeing,
        svc('Spatial')._scratch
      );
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
      if (dist > maxSeek) continue;
      if (!lineOfSight(unit.x, unit.y, foe.x, foe.y)) continue;

      const engagers = getEnemyEngagersCached(foe, unit.team, unit);
      const surrounded =
        (foe.team === 'neutral' || foe.isNeutral)
          ? false
          : isFullySurrounded(foe, unit.team);
      if (surrounded && !inAttackRange(unit, foe)) continue;

      let score = dist;
      if (unit.team === 'enemy' && foe.isGeneral) {
        score -= unit.type === 'assassin' ? 1200 : 800;
        if (foe.stationedKeep && unit.type !== 'assassin') score += 400;
      }
      if (sameTypeEngaging(foe, unit)) score += 200;
      score += engagers.filter((u) => u.type === unit.type).length * 90;
      score += engagers.length * 18;
      if (foe.id === unit.combatTargetId && isPursuableFoe(unit, foe)) score -= 28;
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
        if (dist > maxSeek || !lineOfSight(unit.x, unit.y, foe.x, foe.y)) continue;
        let score = dist + (sameTypeEngaging(foe, unit) ? 120 : 0);
        options.push({ foe, score });
      }
    }

    options.sort((a, b) => a.score - b.score);
    const result = options[0]?.foe ?? null;
    tacticalTargetCache.set(unit.id, result);
    return result;
  }

  function findNearestPlayer(unit) {
    if (useSpatialQueries()) {
      return svc('Spatial').queryNearest(
        unit.x,
        unit.y,
        520,
        (e) =>
          e.kind === 'unit' &&
          e.ref?.team === 'player' &&
          e.ref?.hp > 0 &&
          !e.ref?.fleeing &&
          !e.ref?.demoralized
      );
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

  function isAcademyEraActive() {
    return isAcademyEra(GS.wave);
  }

  

  function getResearchOpts() {
    const unlockAll = GS.creativeMode && GS.creativeSettings.unlockAll;
    return {
      creativeUnlockAll: unlockAll,
      doomMetaUnlocked: unlockAll || svc('MetaProgress').isDoomslayerHeroUnlocked(),
      perksMetaUnlocked: unlockAll || (svc('Perks') && svc('Perks').perkMachinesUnlocked()),
    };
  }

  function isAnyCrossoverAccess() {
    const opts = getResearchOpts();
    if (opts.creativeUnlockAll) return true;
    if (svc('MetaProgress').isAnyCrossoverUnlocked()) return true;
    if (svc('Research')) {
      for (const f of Object.keys(CrossoverFactions || {})) {
        if (svc('Research').isFactionUnlocked(f, opts)) return true;
      }
    }
    return false;
  }

  function startResearch(id) {
    if (!svc('Research')) return false;
    const ok = svc('Research').startResearch(id, GS.wave, GS.buildings, showMessage);
    if (ok) {
      syncInteractionState();
      svc('Research').renderPanel?.(GS.wave, GS.buildings, { force: true });
    }
    return ok;
  }

  function cancelResearch() {
    if (!svc('Research')) return false;
    const ok = svc('Research').cancelResearch(showMessage);
    if (ok) {
      syncInteractionState();
      svc('Research').renderPanel?.(GS.wave, GS.buildings, { force: true });
    }
    return ok;
  }

  /** Full building list for research lab detection (flags + owner). */
  function getBuildingsForResearch() {
    return GS.buildings;
  }

  function startBranchTech(id) {
    if (GS.creativeMode || typeof TechTreeBranches === 'undefined') return false;
    const ok = TechTreeBranches.startInvest(id, GS.wave, {
      wave: GS.wave,
      buildings: GS.buildings,
      showMessage,
    });
    if (ok && svc('Research')) svc('Research').renderPanel(GS.wave, GS.buildings);
    return ok;
  }

  function cancelBranchTech() {
    if (typeof TechTreeBranches === 'undefined') return false;
    const ok = TechTreeBranches.cancelInvest({ showMessage });
    if (ok && svc('Research')) svc('Research').renderPanel(GS.wave, GS.buildings);
    return ok;
  }

  

  function spawnPosForSide(side) {
    const m = 24;
    let pos;
    switch (side) {
      case 'south':
        pos = {
          x: m + Math.random() * (GS.worldW - m * 2),
          y: GS.worldH - 28 - Math.random() * 14,
        };
        break;
      case 'east':
        pos = {
          x: GS.worldW - 28 - Math.random() * 14,
          y: 90 + Math.random() * (GS.worldH - 200),
        };
        break;
      case 'west':
        pos = {
          x: 10 + Math.random() * 18,
          y: 90 + Math.random() * (GS.worldH - 200),
        };
        break;
      default:
        pos = {
          x: m + Math.random() * (GS.worldW - m * 2),
          y: 8 + Math.random() * 20,
        };
    }
    if (svc('PlanetWarfare') && svc('PlanetWarfare').isActive(GS.wave)) {
      pos = svc('PlanetWarfare').modifySpawnPos(side, pos, {
        wave: GS.wave,
        worldW: GS.worldW,
        worldH: GS.worldH,
        control: svc('PlanetWarfare').getControl(),
      });
    }
    if (svc('BiomeSpawn')) {
      pos = svc('BiomeSpawn').biasSpawnPosition(pos, side, GS.worldW, GS.worldH, getLivingPlanetCtx());
    }
    return pos;
  }

  function getWaveAttackSides() {
    return GS.waveAttackSides.length ? GS.waveAttackSides : ['north'];
  }

  /** Pick a random non-empty subset of unlocked flanks for this wave. */
  function rollWaveAttackSides(waveNum) {
    const pool = getUnlockedAttackSides(waveNum);
    if (pool.length <= 1) return [...pool];
    const flankBias = getAsymmetricMods().multiFlankBias || 0;
    if (flankBias > 0 && gameRandom() < flankBias) return [...pool];
    const total = (1 << pool.length) - 1;
    const pick = 1 + Math.floor(gameRandom() * total);
    const chosen = [];
    for (let i = 0; i < pool.length; i++) {
      if (pick & (1 << i)) chosen.push(pool[i]);
    }
    return chosen;
  }

  function nextEnemySpawnSide(unitType) {
    const sides = getWaveAttackSides();
    if (svc('MultiFrontSiege') && GS.multiFrontPlan) {
      return svc('MultiFrontSiege').pickSpawnSide(unitType, GS.multiFrontPlan, sides, gameRandom);
    }
    if (sides.length <= 1) return sides[0] || 'north';
    return sides[Math.floor(gameRandom() * sides.length)];
  }

  

  

  function countUnitProducingBuildings() {
    let n = 0;
    for (const b of GS.buildings) {
      if (isUnitProducingBuilding(b)) n++;
    }
    return n;
  }

  

  

  function checkPlayerElimination() {
    if (GS.state !== 'playing') return;
    if (GS.creativeMode && GS.creativeSettings.noGameOver) return;
    if (!isPlayerEliminated()) return;
    showMessage('Your forces are gone — no troops or training halls remain. The realm falls.', 300);
    endGame(false);
  }

  /** Inward march goal per flank — toward map center, not a player "side". */
  function getEnemyAdvanceGoal(side) {
    const cx = GS.worldW * 0.5;
    const cy = GS.worldH * 0.5;
    switch (side) {
      case 'south':
        return { x: cx, y: Math.min(cy + 90, GS.worldH - 48) };
      case 'east':
        return { x: Math.max(cx - 90, 48), y: cy };
      case 'west':
        return { x: Math.min(cx + 90, GS.worldW - 48), y: cy };
      default:
        return { x: cx, y: Math.max(cy - 90, 48) };
    }
  }

  function getEnemyAdvancePoint(unit) {
    let hash = 0;
    for (let i = 0; i < unit.id.length; i++) hash = (hash + unit.id.charCodeAt(i) * (i + 1)) % 200;
    const spread = (hash - 100) * 0.35;
    const side = unit.spawnSide || 'north';
    const goal = getEnemyAdvanceGoal(side);
    const step = 110;
    switch (side) {
      case 'south':
        return clampPos(unit.x + spread, Math.max(unit.y - step, goal.y));
      case 'east':
        return clampPos(Math.max(unit.x - step, goal.x), unit.y + spread);
      case 'west':
        return clampPos(Math.min(unit.x + step, goal.x), unit.y + spread);
      default:
        return clampPos(unit.x + spread, Math.min(unit.y + step, goal.y));
    }
  }

  function announceAttackSides() {
    const sides = getWaveAttackSides();
    const labels = { north: 'North', east: 'East', west: 'West', south: 'South' };
    if (GS.multiFrontPlan?.assignments?.length >= 2) {
      const mode = GS.multiFrontPlan.mode === 'coordinated' ? 'Coordinated siege' : 'Competing hosts';
      showMessage(`${mode} — ${GS.multiFrontPlan.intel}`, 400);
      svc('FloatingText').status(GS.worldW / 2, 40, 'MULTI-FRONT SIEGE', '#ff7050');
      return;
    }
    if (sides.length <= 1) return;
    const text = sides.map((s) => labels[s]).join(', ');
    const pool = getUnlockedAttackSides(GS.wave);
    const poolNote =
      pool.length > sides.length
        ? ` (${pool
            .filter((s) => !sides.includes(s))
            .map((s) => labels[s])
            .join(', ')} quiet this wave)`
        : '';
    showMessage(`Enemies assault from: ${text}!${poolNote}`, 280);
    svc('FloatingText').status(GS.worldW / 2, 40, 'MULTI-FRONT', '#ff8060');
  }

  function announceAcademyEra() {
    if (GS.wave !== ACADEMY_ERA_WAVE) return;
    addHighlight('era', 'Academy Era begins — train through Academies');
    showMessage(
      'Wave 100 — Academy Era! Train free troops each round, grow your line, and weather heavier northern assaults.',
      380
    );
    svc('FloatingText').status(GS.worldW / 2, GS.worldH / 2, 'ACADEMY ERA', '#c0a040');
    playSfx('reinforce');
  }

  

  function announceEnemyRtsEra() {
    if (GS.wave !== RTS_ERA_WAVE) return;
    showMessage(
      'Wave 200 — late assault escalation. Expect denser packs and tougher foes from the north.',
      380
    );
    svc('FloatingText').status(GS.worldW / 2, 56, 'LATE WAR', '#ff8060');
    playSfx('waveStart');
  }

  function announceKingdomEvolution() {
    if (GS.creativeMode || typeof isProgressionMilestone !== 'function') return;
    if (!isProgressionMilestone(GS.wave)) return;
    const milestone = getProgressionMilestone(GS.wave);
    const evo = typeof getKingdomEvolutionStage === 'function' ? getKingdomEvolutionStage(GS.wave) : null;
    const framed = LoreData?.CAMPAIGN_NARRATIVE?.waves?.[GS.wave];
    const title = milestone?.name || evo?.name || `Wave ${GS.wave}`;
    const tagline = milestone?.tagline || evo?.tagline || '';
    addHighlight('era', title);
    if (!framed) {
      showMessage(`Chronicle — Wave ${GS.wave}: ${title}. ${tagline}`, 400);
    }
    svc('FloatingText').status(
      GS.worldW / 2,
      48,
      (milestone?.shortName || evo?.shortName || title).toUpperCase(),
      milestone?.color || evo?.color || '#c0a040'
    );
    if (GS.wave === KINGDOM_STAGE_WAVES.RISING) playSfx('reinforce');
    if (GS.wave === 150) {
      showMessage('Wave 150 — mid-war pressure rises. Expect denser packs and named threats.', 300);
    }
    if (GS.wave === KINGDOM_STAGE_WAVES.DOMINION) {
      showMessage(
        'Wave 200 — late-war escalation. Hold the northern line as assaults grow heavier.',
        320
      );
    }
  }

  function isKingdomActionUnlocked(actionDef) {
    if (actionDef?.waveMin && GS.wave < actionDef.waveMin) return false;
    if (!actionDef?.kingdomStage) return true;
    if (typeof getKingdomStageBuffs !== 'function') return false;
    return getKingdomStageBuffs(GS.wave).stage >= actionDef.kingdomStage;
  }

  function bootstrapPlaceComplete(type, x, y, owner = 'player') {
    const b = createBuilding(type, x, y, owner);
    const def = BuildDefs[type];
    b.buildProgress = def?.buildTime || 0;
    b.complete = true;
    if (def?.waveBuildTime) {
      b.waveBuildRequired = def.waveBuildTime;
      b.waveBuildProgress = def.waveBuildTime;
    }
    GS.buildings.push(b);
    onBuildingComplete(b);
    return b;
  }

  function bootstrapSpawnArmy(rows) {
    let ox = GS.worldW / 2 - 90;
    for (const { type, count } of rows) {
      for (let i = 0; i < count; i++) {
        const u = spawnUnit(
          type,
          ox + (i % 4) * 22,
          GS.deployY - 10 - Math.floor(i / 4) * 24,
          'player'
        );
        applyPlayerStatMods(u);
        u.targetY = GS.rallyY;
        u.huntMode = GS.globalHunt;
        GS.units.push(u);
      }
      ox += 34;
    }
  }

  /** Immortal veterans on field so endgame modes can found any academy type. */
  function bootstrapAcademyMentorsForEndgame() {
    const mentorTypes = [
      ...new Set(ACADEMY_BUILD_TYPES.map((t) => getAcademyMentorUnitType(t)).filter(Boolean)),
    ];
    let ox = GS.worldW / 2 - 140;
    const y = GS.deployY - 95;
    for (const type of mentorTypes) {
      const u = spawnUnit(type, ox, y, 'player');
      applyPlayerStatMods(u);
      u.vetTier = MAX_VETERAN_TIER;
      if (type === 'footman') u.honorName = u.honorName || 'Crown';
      u.targetY = GS.rallyY;
      u.huntMode = GS.globalHunt;
      GS.units.push(u);
      ox += 26;
    }
  }

  function bootstrapAcademyEraStart(targetWave) {
    const tw = Math.max(ACADEMY_ERA_WAVE, Math.min(targetWave || 105, 500));
    releaseAllUnits();
    releaseAllBuildings();
    GS.wave = tw;
    GS.tactical = tw >= RTS_ERA_WAVE ? 145 : tw >= ACADEMY_ERA_WAVE + ACADEMY_HYBRID_WAVES ? 120 : 105;
    applyWorldSize(GS.wave);
    generateBattlefield();
    invalidateObstacles();
    resetCamera();
    const cx = GS.worldW / 2;
    const wy = GS.rallyY - 50;
    for (let i = -3; i <= 3; i++) bootstrapPlaceComplete('wall', cx + i * 28, wy);
    bootstrapPlaceComplete('outpost', cx, wy - 35);
    bootstrapPlaceComplete('hamlet', cx - 130, wy - 90);
    bootstrapPlaceComplete('hamlet', cx + 130, wy - 90);
    if (tw >= ACADEMY_ERA_WAVE + 10) bootstrapPlaceComplete('merchant_guild', cx, wy - 120);
    [
      'academy_footman',
      'academy_archer',
      'academy_knight',
      'academy_mage',
      'academy_builder',
    ].forEach((t, i) => {
      bootstrapPlaceComplete(t, cx - 100 + i * 50, wy - 25);
    });

    bootstrapSpawnArmy([
      { type: 'knight', count: 5 },
      { type: 'archer', count: 6 },
      { type: 'footman', count: 4 },
      { type: 'mage', count: 2 },
      { type: 'builder', count: 3 },
      { type: 'sapper', count: 2 },
    ]);
    if (tw >= RTS_ERA_WAVE) {
      bootstrapSpawnArmy([
        { type: 'knight', count: 4 },
        { type: 'archer', count: 4 },
      ]);
    }
    if (svc('Research')) svc('Research').grantBootstrapUnlocks(tw);
    invalidateObstacles();

    GS.timeOfDay = 'night';
    GS.nightTimer = Math.floor(
      NIGHT_PREP_TICKS * (svc('GameModes') ? svc('GameModes').getNightPrepMult() : 1)
    );
    addHighlight('era', `Academy Era — wave ${tw}`);
    if (tw === ACADEMY_ERA_WAVE) {
      announceAcademyEra();
    } else {
      showMessage(
        `Academy Era — wave ${tw}. Train via academies; the realm keeps expanding on all flanks.`,
        380
      );
      svc('FloatingText').status(GS.worldW / 2, GS.worldH / 2, 'ACADEMY ERA', '#c0a040');
    }
    refreshUnitCounts();
    invalidateStateCache();
  }

  function bootstrapPlanetConquestStart() {
    const tw =
      (typeof PlanetConquest !== 'undefined' && PlanetConquest.WAVE_MIN) || 500;
    releaseAllUnits();
    releaseAllBuildings();
    GS.wave = tw;
    GS.tactical = 180;
    applyWorldSize(GS.wave);
    // Fair first night: thin northern hazards, clear of player rally (no burn carpet).
    setHazardSpawnOpts({
      densityMult: 0.28,
      northOnly: true,
      excludeNearPlayerRally: true,
      rallyClearRadius: 140,
      maxHazards: 4,
      noSpread: true,
      scaleMult: 0.55,
      damageMult: 0.65,
      noFallback: false,
    });
    // Keep fair placement through first dawn (begin day → WAVE_START) so burn carpet cannot return.
    GS.conquestHazardGraceWaves = 1;
    generateBattlefield();
    invalidateObstacles();
    resetCamera();
    tryRtsMapExpansion();

    const cx = GS.worldW / 2;
    const wy = GS.rallyY - 50;
    for (let i = -4; i <= 4; i++) bootstrapPlaceComplete('wall', cx + i * 28, wy);
    bootstrapPlaceComplete('outpost', cx, wy - 35);
    bootstrapPlaceComplete('hamlet', cx - 150, wy - 95);
    bootstrapPlaceComplete('hamlet', cx + 150, wy - 95);
    bootstrapPlaceComplete('merchant_guild', cx, wy - 125);
    [
      'academy_footman',
      'academy_archer',
      'academy_knight',
      'academy_mage',
      'academy_builder',
      'academy_sapper',
    ].forEach((t, i) => {
      bootstrapPlaceComplete(t, cx - 120 + i * 42, wy - 28);
    });

    bootstrapSpawnArmy([
      { type: 'knight', count: 8 },
      { type: 'archer', count: 8 },
      { type: 'footman', count: 6 },
      { type: 'mage', count: 3 },
      { type: 'builder', count: 4 },
      { type: 'sapper', count: 3 },
      { type: 'scout', count: 2 },
    ]);
    bootstrapSpawnArmy([
      { type: 'knight', count: 4 },
      { type: 'archer', count: 4 },
    ]);
    bootstrapEnemyEconomyForWave(tw);
    if (svc('Research')) svc('Research').grantBootstrapUnlocks(tw);
    invalidateObstacles();

    GS.timeOfDay = 'night';
    GS.nightTimer = Math.floor(
      NIGHT_PREP_TICKS * (svc('GameModes') ? svc('GameModes').getNightPrepMult() : 1)
    );
    addHighlight('era', `Planet Conquest — wave ${tw}`);
    bootstrapAcademyMentorsForEndgame();
    if (svc('PlanetConquest')) {
      svc('PlanetConquest').onWaveStart(GS.wave, getPlanetConquestCtx());
    }
    // Seed full progression + GS/IG so jump-in feels earned (§7).
    if (typeof MacroBootstrap !== 'undefined') {
      const session = svc('GameModes') ? svc('GameModes').getSession() : null;
      MacroBootstrap.bootstrapProgressionForWave(tw, {
        showMessage,
        addHighlight,
        creative: false,
        silent: true,
        pathPreset: session?.pathPreset || null,
      });
    } else {
      svc('GrandStrategy')?.bootstrapForWave?.(tw, { showMessage, addHighlight });
      svc('IntergalacticLayer')?.bootstrapForWave?.(tw, { showMessage, addHighlight });
    }
    refreshUnitCounts();
    invalidateStateCache();

    // Planet map hub first (§0.3.3) — deploy to surface enters night prep.
    // If the strategic map is unavailable (headless / missing module), stay on surface unpaused.
    showMessage(
      `Planet Conquest — wave ${tw}. Choose a sector on the planet map, then deploy to the surface.`,
      420
    );
    svc('FloatingText')?.status?.(GS.worldW / 2, 56, 'PLANET CONQUEST', '#c060ff');
    if (typeof StrategicMapView !== 'undefined' && StrategicMapView.open) {
      setPaused(true, { silent: true });
      let opened = false;
      try {
        opened = !!StrategicMapView.open({
          scale: 'planet',
          source: 'planet_conquest',
          intro: true,
          silent: true,
        });
      } catch (err) {
        opened = false;
        if (typeof console !== 'undefined') console.warn?.('Strategic map intro failed', err);
      }
      if (!opened) {
        setPaused(false, { silent: true });
        showMessage(
          `Planet Conquest — wave ${tw}. Night prep on the surface. Eliminate realms, then Worldheart.`,
          360
        );
      }
    }
  }

  /** Called when leaving conquest intro map onto the surface. */
  function onPlanetConquestSurfaceDeploy(opts = {}) {
    const fid =
      opts.factionId ||
      (typeof PlanetConquest !== 'undefined' ? PlanetConquest.getFocusedSector?.() : null);
    if (fid && typeof PlanetConquest !== 'undefined' && PlanetConquest.getSectorCenterX) {
      const sx = PlanetConquest.getSectorCenterX(fid, GS.worldW);
      if (sx != null) focusWorld(sx, GS.rallyY - 40, { zoom: 1 });
    } else {
      resetCamera();
    }
    showMessage(
      'Surface night prep — ember rings burn living troops; route around orc fire pits in the north.',
      380
    );
    if (fid) {
      const def =
        typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
      showMessage(
        `Assault focus: ${def?.name || fid} sector. Push that band when day begins.`,
        280
      );
    }
  }

  function maybeCampaignNarrative() {
    if (GS.creativeMode || typeof LoreData === 'undefined') return;
    const beats = LoreData.ERA_BEATS?.filter((b) => b.wave === GS.wave) || [];
    for (const beat of beats) addHighlight('campaign', beat.name);

    const framed =
      typeof StoryLore !== 'undefined'
        ? StoryLore.getWaveNarrative(GS.wave)
        : LoreData.CAMPAIGN_NARRATIVE?.waves?.[GS.wave];
    if (framed) {
      showMessage(`Chronicle — ${framed.hook}`, 420);
      if (framed.sub) showMessage(framed.sub, 380);
      svc('FloatingText').status(GS.worldW / 2, 64, framed.title.toUpperCase(), '#c0a040');
      if (typeof StoryLore !== 'undefined' && StoryLore.getDominantBranch) {
        StoryLore.checkBranchBeat?.(GS.wave, StoryLore.getDominantBranch());
      }
      return;
    }
    const hookBeat = beats.find((b) => [5, 25, 31, 50, 316, 1000].includes(GS.wave));
    if (hookBeat) showMessage(`Chronicle — ${hookBeat.hook}`, 380);
  }

  function onNamedBossSlain(unit) {
    if (!unit?.isNamedBoss || GS.creativeMode) return;
    const name = unit.bossName || EnemyDefs[unit.type]?.bossName || unit.type;
    const title = unit.bossTitle || EnemyDefs[unit.type]?.bossTitle || '';
    addHighlight('boss', `Warlord slain — ${name}`);
    if (!GS.campaignNarrativeFlags.firstNamedBoss) {
      GS.campaignNarrativeFlags.firstNamedBoss = true;
      const narrative = LoreData?.CAMPAIGN_NARRATIVE?.firstBoss;
      const hook =
        narrative?.hook ||
        `The Crown records your first named warlord defeated: ${name}. The host hesitates.`;
      showMessage(`Chronicle — ${hook}`, 420);
      if (narrative?.sub) showMessage(narrative.sub, 360);
      svc('FloatingText').status(
        GS.worldW / 2,
        72,
        (narrative?.title || 'WARLORD SLAIN').toUpperCase(),
        '#ffd040'
      );
      if (title) svc('FloatingText').status(GS.worldW / 2, 88, title.toUpperCase(), '#ff9070');
    } else {
      showMessage(`${name} falls!${title ? ` ${title}` : ''}`, 280);
    }
    if (svc('GameEvents')) {
      svc('GameEvents').emit(svc('GameEvents').GameEvent.BOSS_SLAIN, {
        unit,
        wave: GS.wave,
        bossType: unit.type,
        name,
        title,
      });
    }
    ach('kill', { enemyType: unit.type, elite: true, namedBoss: true, wave: GS.wave });
  }

  

  function checkCampaignEconomyVictory() {
    if (!allowsCampaignEconomyVictory() || !GS.enemyEconomyEverSpawned) return;
    const rtsWave = typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200;
    if (GS.wave >= rtsWave) {
      if (countLiveEnemyEconomyBuildings() > 0) return;
      triggerCampaignEconomyVictory();
      return;
    }
    if (!GS.northernHoldEverSpawned || GS.wave < 40) return;
    if (countLiveNorthernHolds() > 0) return;
    triggerCampaignEconomyVictory();
  }

  function triggerCampaignEconomyVictory() {
    if (GS.state !== 'playing') return;
    GS.victoryReason = 'economy';
    const narrative = LoreData?.CAMPAIGN_NARRATIVE?.economyVictory;
    addHighlight('campaign', narrative?.title || 'Northern holds fallen');
    showMessage(
      `Chronicle — ${narrative?.hook || 'All enemy northern settlements destroyed — campaign won!'}`,
      480
    );
    if (narrative?.sub) showMessage(narrative.sub, 400);
    svc('FloatingText').status(
      GS.worldW / 2,
      GS.worldH / 2 - 20,
      (narrative?.title || 'CAMPAIGN WON').toUpperCase(),
      '#80ffa0'
    );
    endGame(true);
  }

  

  function getPlanetConquestCtx(hooks = {}) {
    return {
      modeId: getRunModeId(),
      worldW: GS.worldW,
      worldH: GS.worldH,
      buildings: GS.buildings,
      units: GS.units,
      spawnUnit: (type, x, y, team, opts) => spawnUnit(type, x, y, team, opts),
      hooks: {
        showMessage,
        addHighlight,
        floatingText: floatStatus,
        ...hooks,
      },
    };
  }

  function checkPlanetConquestVictory() {
    if (GS.creativeMode || GS.state !== 'playing') return;
    const modeId = getRunModeId();
    if (!svc('PlanetConquest') || !svc('PlanetConquest').shouldUseConquestVictory(GS.wave, modeId))
      return;
    if (!svc('PlanetConquest').isVictoryReady(GS.wave, modeId)) return;
    triggerPlanetConquestVictory();
  }

  GS._gameEventBusWired = false;

  /** Register lifecycle subscribers — keeps module hooks out of game-loop call sites. */
  function wireGameEventBus() {
    if (GS._gameEventBusWired || !svc('GameEvents')) return;
    GS._gameEventBusWired = true;
    const E = svc('GameEvents').GameEvent;
    const fx = (x, y, text, color) => svc('FloatingText').status(x, y, text, color);

    svc('GameEvents').on(E.GAME_START, () => {
      if (svc('FactionDepth')) svc('FactionDepth').onGameStart();
    });

    svc('GameEvents').on(E.NIGHT_BEGIN, (p) => {
      if (svc('FactionDepth')) {
        svc('FactionDepth').checkMasteryChallenges(p.wave, p.playerUnits, {
          misses: p.misses,
          playerDeaths: p.playerDeaths,
        });
      }
      if (svc('Legacy')) {
        svc('Legacy').onWaveComplete(p.wave, { difficulty: p.difficulty });
      }
      if (typeof FoundationalMedievalLayer !== 'undefined') {
        FoundationalMedievalLayer.onWaveComplete(p.wave, {
          wave: p.wave,
          showMessage,
          addHighlight,
        });
      }
      if (svc('Chronicles')) {
        svc('Chronicles').appendWaveReport(p.wave, p.chronicleReport);
      }
      if (svc('PlanetWarfare') && svc('PlanetWarfare').isActive(p.wave)) {
        svc('PlanetWarfare').onWaveEnd(p.wave, { buildings: GS.buildings, showMessage });
      }
      if (svc('AsymmetricWarfare')) {
        const pw = svc('PlanetWarfare')
          ? svc('PlanetWarfare').getStateSnapshot(p.wave, GS.worldW, GS.worldH, GS.buildings, GS.units)
          : null;
        svc('AsymmetricWarfare').onWaveEnd(p.wave, {
          enemySitesCleared: p.enemySitesCleared,
          northernKills: pw?.northernKillsThisWave || 0,
          structuresRazed: p.structuresRazed,
        });
      }
      if (svc('SettlementRaids') && svc('SettlementRaids').isActive(p.wave)) {
        p.raidSnap =
          svc('SettlementRaids').refreshMissions(GS.buildings, p.wave, {
            isAttackable: isAttackableEnemyStructure,
          }) || [];
      }
      if (svc('FactionReputation')) {
        svc('FactionReputation').onWaveEnd(p.wave, { hooks: { showMessage } });
      }
      if (svc('NeutralRelations')) {
        svc('NeutralRelations').onWaveEnd(p.wave, { hooks: { showMessage } });
      }
      if (svc('PlanetConquest')) {
        svc('PlanetConquest').onWaveEnd(p.wave, getPlanetConquestCtx());
        checkPlanetConquestVictory();
      }
      if (svc('DynamicMapEvents')) {
        svc('DynamicMapEvents').prepareNextEvent(p.wave + 1, {
          worldW: GS.worldW,
          rallyY: GS.rallyY,
          rng: gameRandom,
          hooks: { showMessage, addHighlight, floatingText: fx },
        });
      }
    });

    svc('GameEvents').on(E.WAVE_START, (p) => {
      if (p.phase !== 'prep') return;
      if (svc('Research') && svc('Research').onWaveStart) svc('Research').onWaveStart();
      if (svc('PlayerCounterEvolution')) {
        svc('PlayerCounterEvolution').resolveExpeditions(p.wave, {
          units: GS.units,
          spawnUnit,
          applyPlayerMods: applyPlayerStatMods,
          globalHunt: GS.globalHunt,
          deployX: GS.worldW / 2,
          deployY: GS.deployY,
          rallyY: GS.rallyY,
          worldW: GS.worldW,
          grantTp: (n) => {
            if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
              GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
              sanitizeTactical();
            }
          },
          grantScience: (n) => {
            if (n > 0 && svc('Research') && svc('Research').grantSciencePoints) {
              svc('Research').grantSciencePoints(n, { showMessage });
            }
          },
          hooks: { showMessage, floatingText: fx },
        });
      }
      if (svc('FactionHazards')) {
        const graceOpts = getConquestHazardGraceOpts() || {};
        if (GS.conquestHazardGraceWaves > 0) GS.conquestHazardGraceWaves--;
        if (!p.hazards.length && p.territoryTier >= svc('FactionHazards').MIN_TERRITORY_TIER) {
          p.hazards = svc('FactionHazards').spawnInitial(
            GS.worldW,
            GS.worldH,
            p.territoryTier,
            GS.rallyY,
            p.wave,
            graceOpts
          );
        } else if (p.hazards.length) {
          const spreadResult = svc('FactionHazards').onWaveStart(p.hazards, p.wave, {
            worldW: GS.worldW,
            worldH: GS.worldH,
            rallyY: GS.rallyY,
            territoryTier: p.territoryTier,
            showMessage,
            ...graceOpts,
          });
          p.hazards = spreadResult.hazards;
        }
      }
      if (svc('NeutralWildlife')) {
        svc('NeutralWildlife').onWaveStart(p.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          rallyY: GS.rallyY,
          territoryTier: p.territoryTier,
          spawnUnit: (u) => GS.units.push(u),
          hooks: { showMessage, addHighlight, floatingText: fx },
        });
      }
      if (svc('NeutralRelations')) {
        svc('NeutralRelations').onWaveStart(p.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          rallyY: GS.rallyY,
          territoryTier: p.territoryTier,
          spawnUnit: (u) => GS.units.push(u),
          rng: gameRandom,
          hooks: { showMessage, floatingText: fx },
        });
      }
      if (svc('OperativeSkillTrees')) {
        svc('OperativeSkillTrees').onWaveStart(p.wave, GS.units);
      }
      if (svc('PlanetWarfare') && svc('PlanetWarfare').isActive(p.wave)) {
        const hostSnap = svc('EnemyFactions')
          ? svc('EnemyFactions').getStateSnapshot(p.wave, GS.buildings, GS.spawnQueue)
          : null;
        p.planetCreep = svc('PlanetWarfare').onWaveStart(p.wave, {
          buildings: GS.buildings,
          hostKingdomTotal: hostSnap?.hostKingdomTotal || 0,
          asymmetricCreepMult: getAsymmetricMods().planetCreepMult || 1,
        });
      }
      if (svc('PlanetConquest')) {
        svc('PlanetConquest').onWaveStart(p.wave, getPlanetConquestCtx());
      }
      if (svc('AsymmetricWarfare')) {
        const asymCtx = getAsymmetricContext();
        p.hostLvl = svc('AsymmetricWarfare').onWaveStart(p.wave, asymCtx);
        svc('AsymmetricWarfare').checkHostLevelAnnouncements(p.wave, {
          showMessage,
          addHighlight,
          floatingText: fx,
          worldW: GS.worldW,
          worldH: GS.worldH,
        });
        if (p.hostLvl?.delta > 0 && p.wave > 5) {
          const snap = svc('AsymmetricWarfare').getStateSnapshot(asymCtx);
          if (snap.balance === 'host_advantage') {
            showMessage(
              `Host outpaces your command — macro harder or micro the line. (${snap.hostSummary})`,
              320
            );
          }
        }
      }
    });

    svc('GameEvents').on(E.WAVE_START, (p) => {
      if (p.phase !== 'assault') return;
      if (svc('FactionDepth')) {
        svc('FactionDepth').onWaveStart(p.playerUnits);
      }
    });

    svc('GameEvents').on(E.ENEMY_SLAIN, (p) => {
      if (svc('Research') && svc('Research').onEnemySlain) {
        const eternalFx =
          typeof EternalLegacyTree !== 'undefined'
            ? EternalLegacyTree.getCombinedEffects(null, p.wave)
            : null;
        const fmods =
          typeof FoundationalMedievalLayer !== 'undefined'
            ? FoundationalMedievalLayer.getRunModifiers(p.wave)
            : null;
        svc('Research').onEnemySlain(p.unit, {
          wave: p.wave,
          buildings: GS.buildings,
          showMessage,
          floatingText: fx,
          scienceCapMult: eternalFx?.scienceCapMult,
          scienceGainMult: (eternalFx?.scienceGainMult || 1) * (fmods?.scienceGainMult || 1),
          researchSpeedMult: eternalFx?.researchSpeedMult,
        });
      }
      if (svc('PlanetWarfare')) {
        svc('PlanetWarfare').onEnemySlain(p.unit, { wave: p.wave, worldH: GS.worldH });
      }
      if (svc('FactionReputation')) {
        svc('FactionReputation').onEnemySlain(p.unit, p.wave, { hooks: { showMessage } });
      }
      if (svc('PlanetConquest')) {
        svc('PlanetConquest').onEnemySlain(p.unit, p.wave, getPlanetConquestCtx());
        if (p.unit.isPlanetBoss) {
          svc('PlanetConquest').onPlanetBossSlain(p.unit, p.wave, getPlanetConquestCtx());
        }
        checkPlanetConquestVictory();
      }
    });

    svc('GameEvents').on(E.BOSS_SLAIN, (p) => {
      if (!svc('MonsterBosses')) return;
      const evo = svc('MonsterBosses').onBossSlain(p.bossType, p.wave);
      if (evo?.nextEvolution?.label) {
        showMessage(
          `${p.name} banished — next encounter: ${evo.nextEvolution.label} cycle with a stronger pack.`,
          300
        );
      }
    });

    svc('GameEvents').on(E.BARRACKS_COMPLETE, (p) => {
      if (svc('FactionDepth')) svc('FactionDepth').onBarracksComplete(p.building);
    });
  }

  function emitNightBegin(playerUnits) {
    if (!svc('GameEvents')) return;
    const E = svc('GameEvents').GameEvent;
    const payload = {
      wave: GS.wave,
      playerUnits,
      misses: GS.runPlayerDeaths,
      playerDeaths: GS.runPlayerDeaths,
      difficulty: GS.difficultyId,
      enemySitesCleared: countLiveEnemyEconomyBuildings() === 0 && GS.enemyEconomyEverSpawned,
      structuresRazed: GS.structuresRazedThisWave,
      chronicleReport: {
        difficulty: GS.difficultyId,
        creative: GS.creativeMode,
        armySize: playerUnits.length,
        tactical: GS.tactical,
        misses: GS.runPlayerDeaths,
        playerDeaths: GS.runPlayerDeaths,
        playerCasualtiesThisWave: GS.playerCasualtiesThisWave,
        siegeWave: isSiegeWave(),
        hordeWave: isHordeWave(),
        bossWave:
          GS.currentWaveConfig?.boss || (svc('GameDepth') && svc('GameDepth').isBossWave?.(GS.wave)),
        sessionKills: GS.kills,
        units: playerUnits,
        highlights: GS.sessionHighlights,
        storyBranch:
          typeof StoryLore !== 'undefined' ? StoryLore.getDominantBranch?.() : null,
        storySummary:
          typeof StoryLore !== 'undefined' ? StoryLore.formatChoiceSummary?.(2) : '',
        planetChoice: svc('DynamicMapEvents')?.getStateSnapshot?.(GS.wave, GS.tactical, isNightPhase())
          ?.activeEvent?.choice,
      },
      raidSnap: null,
    };
    svc('GameEvents').emit(E.WAVE_CLEARED, { wave: GS.wave, playerUnits });
    svc('GameEvents').emit(E.NIGHT_BEGIN, payload);
    if (payload.raidSnap?.length && svc('SettlementRaids')) {
      const open = payload.raidSnap.filter((m) => !m.dispatched).length;
      showMessage(
        open
          ? `${open} settlement raid${open > 1 ? 's' : ''} available — select ${svc('SettlementRaids').MIN_STRIKE_FORCE}+ hunters and dispatch.`
          : `${payload.raidSnap.length} strike raid${payload.raidSnap.length > 1 ? 's' : ''} in progress.`,
        320
      );
    }
  }

  function emitWaveStartPrep() {
    if (!svc('GameEvents')) return { hazards: GS.hazards };
    const payload = {
      phase: 'prep',
      wave: GS.wave,
      hazards: GS.hazards,
      territoryTier: GS.territoryTier,
      planetCreep: null,
      hostLvl: null,
    };
    svc('GameEvents').emit(svc('GameEvents').GameEvent.WAVE_START, payload);
    return payload;
  }

  function emitWaveStartAssault(playerUnits) {
    if (!svc('GameEvents')) return;
    svc('GameEvents').emit(svc('GameEvents').GameEvent.WAVE_START, {
      phase: 'assault',
      wave: GS.wave,
      playerUnits,
    });
  }

  function triggerPlanetConquestVictory() {
    if (GS.state !== 'playing') return;
    if (!svc('PlanetConquest')?.isBossDefeated?.()) return;
    GS.victoryReason = 'planet_conquest';
    addHighlight('campaign', 'Worldheart Tyrant slain — true victory');
    const narrative = LoreData?.CAMPAIGN_NARRATIVE?.trueVictory;
    showMessage(
      narrative?.hook ||
        'Chronicle — The Worldheart Tyrant falls. True victory — the planet is yours.',
      480
    );
    if (narrative?.sub) showMessage(narrative.sub, 400);
    else showMessage('Every hostile realm is broken. Your crown rules the world.', 400);
    svc('FloatingText').status(GS.worldW / 2, GS.worldH / 2 - 20, 'TRUE VICTORY', '#80ffa0');
    ach('true_victory', { bossSlain: true, wave: GS.wave, mode: getRunModeId() });
    endGame(true);
  }

  function tryRtsMapExpansion() {
    return syncMapGrowth({ announce: GS.wave >= RTS_ERA_WAVE - 5 });
  }

  function tickSettlementWaveProgress() {
    let anyCompleted = false;
    const inProgress = [];
    for (const b of GS.buildings) {
      if (b.hp <= 0 || b.complete || !b.waveBuildRequired) continue;
      b.waveBuildProgress = (b.waveBuildProgress || 0) + 1;
      const def = BuildDefs[b.type];
      const name = def?.name || 'Settlement';
      if (b.waveBuildProgress >= b.waveBuildRequired) {
        b.complete = true;
        // Defer path-grid invalidation until all completions this dawn (avoids N× freeze thrash).
        onBuildingComplete(b, { skipInvalidate: true });
        anyCompleted = true;
        const eco = b.isHamlet
          ? ` +${b.tpBonusPerHamlet ?? def?.tpBonusPerHamlet ?? (typeof HAMLET_TP_PER_ROUND !== 'undefined' ? HAMLET_TP_PER_ROUND : 5)} TP/round`
          : '';
        const owner = b.owner === 'enemy' ? 'Enemy ' : '';
        showMessage(`${owner}${name} complete!${eco}`, 280);
        svc('Particles').dust(b.x, b.y);
        if (b.owner === 'enemy') {
          playSfx('waveStart');
          noteEnemyEconomyPresence(b);
        }
      } else if (b.owner === 'player') {
        inProgress.push(`${name} ${b.waveBuildProgress}/${b.waveBuildRequired}`);
      }
    }
    // One summary instead of N toasts (was flooding the message queue each dawn).
    if (inProgress.length === 1) {
      showMessage(`Construction — ${inProgress[0]}`, 160);
    } else if (inProgress.length > 1) {
      showMessage(`Construction — ${inProgress.length} sites (${inProgress.slice(0, 3).join(', ')}${inProgress.length > 3 ? '…' : ''})`, 200);
    }
    if (anyCompleted) invalidateObstacles();
  }

  

  

  

  function spawnAcademyUnit(academy, unitType) {
    const sx = academy.slotX ?? academy.x;
    const sy = (academy.slotY ?? academy.y) + 16;
    const u = spawnUnit(unitType, sx, sy, 'player');
    if (!u) {
      showMessage(`Academy failed to train ${unitType} — unit definition missing.`, 280);
      return null;
    }
    applyPlayerStatMods(u);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (u.canHunt && !u.huntMode) {
      u.manualOrder = true;
      u.holdX = u.x;
      u.holdY = u.y;
      u.targetX = u.x;
      u.targetY = u.y;
      u.pathTargetId = 'hold';
    }
    if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
    GS.units.push(u);
    svc('Particles').dust(sx, sy);
    return u;
  }

  function processAcademyTraining() {
    // Live roster must be fresh — requiresAbsentUnit academies (builder/courier) otherwise
    // can all fire in one pass off a stale livePlayerByType map.
    refreshUnitCounts();
    let trained = 0;
    for (const b of GS.buildings) {
      if (!b.complete || !b.isAcademy || b.hp <= 0) continue;
      const def = BuildDefs[b.type];
      const unitType = b.academyUnit || def?.academyUnit;
      if (!unitType) continue;

      if (def?.requiresAbsentUnit) {
        const need = def.requiresAbsentUnit;
        const liveCount = unitCounts.livePlayerByType[need] || 0;
        if (liveCount > 1) continue;
        if (liveCount === 1) {
          const lone = findLivePlayerOfType(need);
          if (lone && !isMaxLevelVeteran(lone)) continue;
        }
      }

      if (b.type === 'academy_general') {
        if (findPlayerGeneral()) continue;
        const footman = findPromotableFootman(GS.units);
        if (!footman) continue;
        releaseFromWallGarrison(footman);
        releaseFromGarrison(footman);
        promoteFootmanToGeneral(footman);
        recordFootmanCommandElevation(footman, true);
        footman.x = b.slotX ?? b.x;
        footman.y = (b.slotY ?? b.y) + 12;
        const honor = footman.honorName ? `${footman.honorName} ` : '';
        showMessage(
          `${honor}promoted to General — stats retained, stars reset for command aura!`,
          300
        );
        if (footman.honorName)
          svc('FloatingText').status(footman.x, footman.y - 14, footman.honorName, '#ffd700');
        trained++;
        // General promotes footman — counts change for any later requiresAbsent checks.
        refreshUnitCounts();
        svc('Particles').heal(footman.x, footman.y);
        continue;
      }

      if (unitType === 'general') continue;

      const spawned = spawnAcademyUnit(b, unitType);
      if (!spawned) continue;
      trained++;
      // Keep livePlayerByType accurate for subsequent builder/courier academies this dawn.
      unitCounts.livePlayerByType[unitType] = (unitCounts.livePlayerByType[unitType] || 0) + 1;
      unitCounts.player++;
    }
    if (trained > 0) {
      refreshUnitCounts();
      showMessage(`Academies trained ${trained} unit${trained > 1 ? 's' : ''} this round.`, 200);
      playSfx('deploy');
    }
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

  function findEnemyMoveTarget(unit) {
    if (unit.isCounterRaid && unit.raidTargetId) {
      const raidBld = GS.buildings.find(
        (b) => b.id === unit.raidTargetId && b.hp > 0 && b.owner === 'player'
      );
      if (raidBld) return { kind: 'building', target: raidBld };
    }
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
    const tactical = findTacticalTarget(unit);
    if (tactical) return { kind: 'unit', target: tactical };
    const nearest = findNearestPlayer(unit);
    if (nearest) return { kind: 'unit', target: nearest };
    return { kind: 'advance', target: null };
  }

  

  

  function isTerrainBlockedAt(x, y, unit, clearance) {
    const scanRadius = clearance + 56;
    if (useSpatialQueries()) {
      const near = spatialScratchQuery(
        x,
        y,
        scanRadius,
        (e) => e.kind === 'building' || e.kind === 'deco'
      );
      for (let ni = 0; ni < near.length; ni++) {
        const d = near[ni];
        if (!obstacleBlocksForUnit(d, unit)) continue;
        const tr = terrainBlockRadius(d);
        if (tr <= 0) continue;
        const blockR = tr + clearance;
        if (posDistSq(x, y, d.x, d.y) < blockR * blockR) return true;
      }
      return false;
    }
    for (const d of allObstacles()) {
      if (!obstacleBlocksForUnit(d, unit)) continue;
      const blockR = (d.radius || 14) + clearance;
      if (posDistSq(x, y, d.x, d.y) < blockR * blockR) return true;
    }
    return false;
  }

  function isTerrainBlockedForPath(x, y, unit) {
    return isTerrainBlockedAt(x, y, unit, pathClearanceForUnit(unit));
  }

  function isTerrainBlocked(x, y, unit) {
    return isTerrainBlockedAt(x, y, unit, UNIT_COLLISION + 2);
  }

  function isBlocked(x, y, unit, margin = ALLY_MOVE_MARGIN) {
    if (isTerrainBlocked(x, y, unit)) return true;
    // Manual click-to-move: soft-pass through allies, enemies, and neutrals.
    // Only solid terrain/buildings/props hard-block so ordered units never freeze in crowds.
    if (unit?.manualOrder) return false;
    const r = UNIT_COLLISION + margin;
    const r2 = r * r;
    const foeR2 = (r * 0.35) * (r * 0.35);
    const hordeTightR2 = foeR2;
    const hordeLooseR2 = (r * 0.55) * (r * 0.55);
    // Cache once — unitHasActiveMarch scans all walls/keeps (expensive in castle fights).
    const unitMarching = unit ? unitHasActiveMarch(unit) : false;
    const allyR = unitMarching ? r * 0.4 : r;
    const allyR2 = allyR * allyR;
    if (!useSpatialQueries()) {
      for (const u of GS.units) {
        if (u === unit || !unitBlocksMovement(u)) continue;
        const d2 = posDistSq(x, y, u.x, u.y);
        if (!unit) {
          if (d2 < r2) return true;
          continue;
        }
        if (unit.team === 'enemy' && u.team === 'player') {
          if (d2 < foeR2) return true;
          continue;
        }
        if (unit.team === 'player' && u.team === 'enemy') {
          if (d2 < foeR2) return true;
          continue;
        }
        // Hostile neutrals: soft-block like enemy so units can close to melee at map edges.
        if (
          (u.team === 'neutral' || u.isNeutral) &&
          (unit.team === 'player' || unit.team === 'enemy')
        ) {
          if (d2 < foeR2) return true;
          continue;
        }
        if (
          (unit.team === 'neutral' || unit.isNeutral) &&
          (u.team === 'player' || u.team === 'enemy')
        ) {
          if (d2 < foeR2) return true;
          continue;
        }
        if (u.team === unit.team) {
          if (d2 < allyR2) return true;
          continue;
        }
        if (unit.team === 'enemy' && u.team === 'enemy') {
          const hordeR2 =
            enemyIsAdvancing(unit) || enemyIsAdvancing(u) ? hordeTightR2 : hordeLooseR2;
          if (d2 < hordeR2) return true;
        }
      }
      return false;
    }
    let blocked = false;
    svc('Spatial').forCellsInRadius(x, y, r + 8, (entry) => {
      if (blocked || entry.kind !== 'unit') return;
      const u = entry.ref;
      if (u === unit || !unitBlocksMovement(u)) return;
      const d2 = posDistSq(x, y, u.x, u.y);
      if (!unit) {
        if (d2 < r2) blocked = true;
        return;
      }
      if (unit.team === 'enemy' && u.team === 'player') {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (unit.team === 'player' && u.team === 'enemy') {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (
        (u.team === 'neutral' || u.isNeutral) &&
        (unit.team === 'player' || unit.team === 'enemy')
      ) {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (
        (unit.team === 'neutral' || unit.isNeutral) &&
        (u.team === 'player' || u.team === 'enemy')
      ) {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (u.team === unit.team) {
        if (d2 < allyR2) blocked = true;
        return;
      }
      if (unit.team === 'enemy' && u.team === 'enemy') {
        const hordeR2 =
          enemyIsAdvancing(unit) || enemyIsAdvancing(u) ? hordeTightR2 : hordeLooseR2;
        if (d2 < hordeR2) blocked = true;
      }
    });
    return blocked;
  }

  function nudgeUnitFree(unit) {
    const solidOnly = !!unit?.manualOrder;
    const jammed =
      isTerrainBlocked(unit.x, unit.y, unit) ||
      (!solidOnly && isBlocked(unit.x, unit.y, unit, 0));
    if (!jammed) return false;
    // Prefer sliding toward the ordered destination when stuck on props/buildings.
    let preferAngle = null;
    if (unit.targetX != null && unit.targetY != null) {
      preferAngle = Math.atan2(unit.targetY - unit.y, unit.targetX - unit.x);
    }
    for (let ring = 8; ring <= 56; ring += 8) {
      for (let i = 0; i < 16; i++) {
        const base = preferAngle != null ? preferAngle + (i / 16) * Math.PI * 2 : (i / 16) * Math.PI * 2;
        const pos = clampPos(unit.x + Math.cos(base) * ring, unit.y + Math.sin(base) * ring);
        const free = solidOnly
          ? !isTerrainBlocked(pos.x, pos.y, unit)
          : !isTerrainBlocked(pos.x, pos.y, unit) && !isBlocked(pos.x, pos.y, unit, 0);
        if (free) {
          unit.x = pos.x;
          unit.y = pos.y;
          return true;
        }
      }
    }
    return false;
  }

  function separationVector(unit) {
    let sx = 0;
    let sy = 0;
    let allies;
    if (useSpatialQueries()) {
      svc('Spatial').queryRadiusInto(
        unit.x,
        unit.y,
        UNIT_COLLISION * 4,
        (e) => e.kind === 'unit' && e.ref?.team === unit.team && e.ref !== unit,
        svc('Spatial')._scratch
      );
      allies = svc('Spatial')._scratch;
    } else {
      allies = GS.units;
    }
    for (const u of allies) {
      if (u === unit || !unitBlocksMovement(u) || u.team !== unit.team) continue;
      const dx = unit.x - u.x,
        dy = unit.y - u.y;
      const d = Math.hypot(dx, dy);
      let minD = UNIT_COLLISION * (unit.team === 'enemy' ? 2.2 : 2.8);
      if (unit.team === 'enemy' && (enemyIsAdvancing(unit) || enemyIsAdvancing(u))) minD *= 0.55;
      if (unit.team === 'player' && unitHasActiveMarch(unit)) minD *= 0.55;
      if (d < minD && d > 0.01) {
        const push = (minD - d) / minD;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }
    return { x: sx, y: sy };
  }

  function steerToward(unit, tx, ty) {
    const dx = tx - unit.x,
      dy = ty - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return false;

    const doctrineSpd = (unit.doctrineSpeedTimer || 0) > 0 ? unit.doctrineSpeedMult || 1 : 1;
    const biomeSpd = getBiomeModifiersAt(unit.x, unit.y).speedMult || 1;
    let mapEvtSpd = 1;
    if (unit.team === 'player' && svc('DynamicMapEvents')) {
      mapEvtSpd = svc('DynamicMapEvents').getActiveMods().playerSpeedMult || 1;
    }
    const speed =
      unit.speed *
      (unit.hazardSlow || 1) *
      doctrineSpd *
      biomeSpd *
      mapEvtSpd *
      (unit.combatType === 'cavalry' ? 1.4 : 1.15);
    const sep = separationVector(unit);
    // Manual orders bias hard toward the click; keep light separation so crowds don't pin them.
    const sepWeight = unit.manualOrder
      ? 0.28
      : unit.team === 'enemy' && enemyIsAdvancing(unit)
        ? 0.35
        : unit.team === 'player' && unitHasActiveMarch(unit)
          ? 0.55
          : 1.4;
    let ux = dx / dist + sep.x * sepWeight;
    let uy = dy / dist + sep.y * sepWeight;
    const ulen = Math.hypot(ux, uy) || 1;
    ux /= ulen;
    uy /= ulen;

    const candidates = [{ x: ux, y: uy, w: 4 }];

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const vx = Math.cos(angle),
        vy = Math.sin(angle);
      const dot = vx * ux + vy * uy;
      if (dot > -0.35) candidates.push({ x: vx, y: vy, w: 1.5 + dot });
    }

    candidates.sort((a, b) => b.w - a.w);
    for (const c of candidates) {
      const step = Math.min(speed, dist);
      const pos = clampPos(unit.x + c.x * step, unit.y + c.y * step);
      if (!isBlocked(pos.x, pos.y, unit, 0)) {
        unit.x = pos.x;
        unit.y = pos.y;
        return true;
      }
    }
    // Slide along solid props/buildings with shorter steps (manual or any march).
    if (unit.manualOrder || unitHasActiveMarch(unit)) {
      for (const c of candidates) {
        for (const frac of [0.55, 0.3, 0.12]) {
          const step = Math.min(speed * frac, dist);
          if (step < 0.2) continue;
          const pos = clampPos(unit.x + c.x * step, unit.y + c.y * step);
          if (!isTerrainBlocked(pos.x, pos.y, unit)) {
            if (unit.manualOrder || !isBlocked(pos.x, pos.y, unit, 0)) {
              unit.x = pos.x;
              unit.y = pos.y;
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function resolveOverlaps() {
    const n = GS.units.length;
    if (n < 2) return;
    if (GS.updateTick % 2 !== 0 && n > 24) return;
    if (GS.updateTick % 4 !== 0 && n > 70) return;
    if (GS.updateTick % 6 !== 0 && n > 110) return;
    const cellSize = 36;
    const grid = new Map();
    for (let i = 0; i < n; i++) {
      const u = GS.units[i];
      if (!unitBlocksMovement(u)) continue;
      const key = `${Math.floor(u.x / cellSize)},${Math.floor(u.y / cellSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    const minSep = UNIT_COLLISION + 1;
    const seen = new Set();
    for (const [key, indices] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      overlapNeighborsScratch.length = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get(`${cx + ox},${cy + oy}`);
          if (bucket) {
            for (let bi = 0; bi < bucket.length; bi++) overlapNeighborsScratch.push(bucket[bi]);
          }
        }
      }
      const neighbors = overlapNeighborsScratch;
      for (const i of indices) {
        const a = GS.units[i];
        if (!unitBlocksMovement(a)) continue;
        for (const j of neighbors) {
          if (j <= i) continue;
          const pairKey = i < j ? `${i}:${j}` : `${j}:${i}`;
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);
          const b = GS.units[j];
          if (!unitBlocksMovement(b)) continue;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (dist >= minSep) continue;
          const aHold = isHoldPlanted(a);
          const bHold = isHoldPlanted(b);
          if (dist < 0.01) {
            // Never jitter units planted on a hold post.
            if (aHold || bHold) continue;
            a.x += (Math.random() - 0.5) * 8;
            a.y += (Math.random() - 0.5) * 8;
            continue;
          }
          const sameTeam = a.team === b.team;
          // Planted hold posts: never shove the station-keeper. Other body yields.
          if (aHold && bHold) continue;
          let push = (minSep - dist) * (sameTeam ? 0.45 : 0.25);
          if (sameTeam && (unitHasActiveMarch(a) || unitHasActiveMarch(b))) push *= 0.25;
          if (
            !sameTeam &&
            a.team === 'enemy' &&
            b.team === 'enemy' &&
            (enemyIsAdvancing(a) || enemyIsAdvancing(b))
          )
            push *= 0.3;
          // Manual orders: do not shove the mover back off their click destination.
          if (a.manualOrder || b.manualOrder) push *= 0.12;
          // Engaged pairs (incl. hostile neutrals) must not be shoved apart at map edges.
          if (
            !sameTeam &&
            (a.combatTargetId === b.id ||
              b.combatTargetId === a.id ||
              a.team === 'neutral' ||
              b.team === 'neutral' ||
              a.isNeutral ||
              b.isNeutral)
          ) {
            push *= 0.06;
          }
          const nx = dx / dist,
            ny = dy / dist;
          const ca = clampPos(a.x - nx * push, a.y - ny * push);
          const cb = clampPos(b.x + nx * push, b.y + ny * push);
          if (!aHold && !isBlocked(ca.x, ca.y, a, 0)) {
            a.x = ca.x;
            a.y = ca.y;
          }
          if (!bHold && !isBlocked(cb.x, cb.y, b, 0)) {
            b.x = cb.x;
            b.y = cb.y;
          }
        }
      }
    }
  }

  function awardRoundTP() {
    if (GS.tpAwardedForWave === GS.wave) return;
    GS.tpAwardedForWave = GS.wave;
    const eco = getSettlementTpBonus();
    // No arbitrary 120 ceiling — multi-hamlet / high-wave income was being clipped.
    // Bank still hard-capped by sanitizeTactical / TP_SANITY_CAP.
    const gained = Math.max(0, Math.floor(getTpPerRound() + GS.pendingLevy));
    GS.tactical += gained;
    GS.pendingLevy = 0;
    sanitizeTactical();
    const ecoNote = eco > 0 ? ` (+${eco} from settlements)` : '';
    // Wave summary banner (kills / TP / casualties) — richer than a single toast
    if (typeof GameFeedback !== 'undefined') {
      const fbStats = GameFeedback.getWaveStats?.() || {};
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
    });
    GS.pendingWaveMods = { ...GameRuntime.DEFAULT_PENDING_WAVE_MODS };
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
    GS.tactical = diff.startingTp;
    GS.wave = 0;
    GS.kills = 0;
    GS.misses = 0;
    GS.runPlayerDeaths = 0;
    GS.playerCasualtiesThisWave = 0;
    GS.castleBreachWarned = false;
    GS.castleBreachRecorded = false;
    GS.runStructuresRazed = 0;
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
    GS.conquestHazardGraceWaves = 0;
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
      svc('GameEvents').emit(svc('GameEvents').GameEvent.GAME_START, { difficulty: GS.difficultyId });
    } else if (svc('FactionDepth')) {
      svc('FactionDepth').onGameStart();
    }
    if (svc('ModLoader')) svc('ModLoader').onGameStart(createGameContext());
    if (svc('Research')) svc('Research').resetRun();
    // Ensure expansion unit/building defs (ballista, bard, academies…) after any data reload race.
    if (svc('ContentExpansion')?.registerDefs) svc('ContentExpansion').registerDefs();
    else if (typeof ContentExpansion !== 'undefined' && ContentExpansion.registerDefs) {
      ContentExpansion.registerDefs();
    }
    if (svc('EnemyFactions')) svc('EnemyFactions').resetRun();
    if (svc('FactionReputation')) svc('FactionReputation').resetRun();
    if (svc('PlanetWarfare')) svc('PlanetWarfare').resetRun();
    if (svc('AsymmetricWarfare')) svc('AsymmetricWarfare').resetRun();
    if (svc('SettlementRaids')) svc('SettlementRaids').resetRun();
    if (svc('MultiFrontSiege')) svc('MultiFrontSiege').resetRun();
    if (svc('MonsterBosses')) svc('MonsterBosses').resetRun();
    if (svc('PlayerCounterEvolution')) svc('PlayerCounterEvolution').resetRun();
    if (svc('LivingPlanet')) svc('LivingPlanet').resetRun();
    if (svc('FactionHazards')) svc('FactionHazards').resetRun();
    if (svc('NeutralWildlife')) svc('NeutralWildlife').resetRun();
    if (svc('NeutralRelations')) svc('NeutralRelations').resetRun();
    if (svc('OperativeSkillTrees')) svc('OperativeSkillTrees').resetRun();
    if (svc('DynamicMapEvents')) svc('DynamicMapEvents').resetRun();
    if (svc('StrategyCounterplay')) svc('StrategyCounterplay').resetRun();
    if (svc('GrandStrategy')) svc('GrandStrategy').resetRun();
    if (svc('IntergalacticLayer')) svc('IntergalacticLayer').resetRun();
    if (typeof ProgressionRestarts !== 'undefined') ProgressionRestarts.resetRun();
    if (typeof HybridMoments !== 'undefined') HybridMoments.resetRun();
    if (typeof PacingTools !== 'undefined') PacingTools.resetRun();
    if (typeof FoundationalMedievalLayer !== 'undefined') FoundationalMedievalLayer.resetRun();
    if (typeof AscensionSystem !== 'undefined') AscensionSystem.resetRun();
    if (typeof ThematicEraSynergies !== 'undefined') ThematicEraSynergies.resetRun();
    if (typeof HybridPowerFantasy !== 'undefined') HybridPowerFantasy.resetRun();
    if (typeof NarrativeThread !== 'undefined') NarrativeThread.resetRun();
    if (typeof TechTreeBranches !== 'undefined') TechTreeBranches.resetRun();
    if (typeof GrandStrategyMidBranches !== 'undefined') GrandStrategyMidBranches.resetRun();
    if (typeof IntergalacticLateBranches !== 'undefined') IntergalacticLateBranches.resetRun();
    if (typeof EternalPathFramework !== 'undefined') EternalPathFramework.resetRun();
    if (typeof MartialPathEvolution !== 'undefined') MartialPathEvolution.resetRun();
    if (typeof ArcanePathEvolution !== 'undefined') ArcanePathEvolution.resetRun();
    if (typeof TechPathEvolution !== 'undefined') TechPathEvolution.resetRun();
    if (typeof MythicPathEvolution !== 'undefined') MythicPathEvolution.resetRun();
    GS.multiFrontPlan = null;
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
    if (svc('PlanetConquest')) {
      svc('PlanetConquest').resetRun({
        forcedMode: !GS.creativeMode && runSession?.modeId === 'planet_conquest',
      });
    }
    if (typeof LayerDesign !== 'undefined') {
      LayerDesign.resetAnnouncements?.();
      LayerDesign.renderMenuJourneyPanel?.();
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
    const planetConquestMode = !GS.creativeMode && runSession?.modeId === 'planet_conquest';
    if (!GS.creativeMode && !academyEraMode && !planetConquestMode) {
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
    if (typeof GrandStrategyMidBranches !== 'undefined') {
      GrandStrategyMidBranches.resetRun();
    }
    if (svc('CrownLegacies') && !GS.creativeMode && !academyEraMode && !planetConquestMode) {
      svc('CrownLegacies').applyRunStartBonuses({
        creative: false,
        deployY: GS.deployY,
        rallyY: GS.rallyY,
        units: GS.units,
        grantTp: (n) => {
          if (n > 0) {
            GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
            sanitizeTactical();
          }
        },
        spawnUnit: (type, x, y, team, opts) => spawnUnit(type, x, y, team, opts),
        pushUnit: (u) => GS.units.push(u),
        hooks: { showMessage },
      });
    }
    if (
      typeof EternalLegacyTree !== 'undefined' &&
      !GS.creativeMode &&
      !academyEraMode &&
      !planetConquestMode
    ) {
      const eternal = EternalLegacyTree.applyRunStartBonuses({
        creative: false,
        units: GS.units,
        grantTp: (n) => {
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
      ach('game_start', { difficulty: GS.difficultyId, creative: false, mode: 'academy_era', wave: GS.wave });
    } else if (planetConquestMode) {
      bootstrapPlanetConquestStart();
      const modeNote = runSession?.ironman ? ' · IRONMAN' : '';
      showMessage(
        `${diff.label} (${getDifficultyPercent()}%) · Planet Conquest${modeNote} — night prep at wave ${GS.wave}.`,
        360
      );
      if (runSession?.mods?.length) {
        showMessage(`Active modifiers: ${runSession.mods.length}`, 260);
      }
      ach('game_start', {
        difficulty: GS.difficultyId,
        creative: false,
        mode: 'planet_conquest',
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

  function buildSiegeSpawnQueue() {
    const diff = getDifficulty();
    const wallCount = countPlayerWalls();
    const siegeProg =
      typeof academyProgress === 'function'
        ? academyProgress(GS.wave)
        : Math.min(1, GS.wave / ACADEMY_ERA_WAVE);
    const towerCount = Math.max(
      1,
      Math.floor(
        (4 + siegeProg * 16 + Math.floor(wallCount / 2)) *
          diff.siegeTowerMult *
          (diff.siegeWaveMult || 1)
      )
    );
    GS.spawnQueue = [];
    for (let i = 0; i < towerCount; i++) {
      GS.spawnQueue.push('siege_tower', 'goblin_sapper', 'orc', 'orc', 'goblin');
      if (GS.wave >= 10) GS.spawnQueue.push('shaman');
      if (GS.wave >= 15) GS.spawnQueue.push('goblin_engineer');
    }
    GS.waveEnemyTotal = GS.spawnQueue.length;
    GS.waveProgress = 0;
    showMessage(`SIEGE WAVE ${GS.wave}! ${towerCount} siege tower(s) advancing!`);
  }

  const SPAWN_ELITE_TYPES = [
    'dark_knight',
    'war_chief',
    'troll',
    'siege_tower',
    'necromancer',
    'berserker',
    'assassin',
    'sky_drake',
    'bone_summoner',
    'abomination',
    'behemoth',
    'iron_colossus',
    'void_stalker',
    'elder_wyrm',
    'hellbound_legionnaire',
    'nightmare_strider',
    'dreadborn_champion',
    'warp_prophet',
    'grim_revenant',
    'umbral_stalker',
    'cinderbound_juggernaut',
    'hellmortar_pack',
    'boss_gorath',
    'boss_morwen',
    'boss_thokk',
    'boss_grimm',
    'boss_vexis',
    'boss_karg',
    'boss_sylvara',
    'boss_rotfather',
    'boss_volk',
    'boss_malachar',
  ];

  

  function computeSpawnFillParams(waveNum) {
    const cfg = getWaveConfig(waveNum);
    const diff = getDifficulty();
    const isBoss =
      svc('GameDepth') && svc('GameDepth').isBossWave
        ? svc('GameDepth').isBossWave(waveNum)
        : cfg.boss;
    if (!isBoss && svc('GameDepth')?.isHordeWave?.(waveNum)) return null;

    const colonyAssess = assessColonyThreat(waveNum);
    const colonyPressure = colonyAssess?.pressure;

    let count = Math.max(
      1,
      Math.floor(
        cfg.count *
          GS.waveModifiers.countMult *
          diff.enemyCountMult *
          (colonyPressure?.countMult || 1)
      )
    );
    if (isRtsEra(waveNum)) {
      const rtsProg = typeof postAcademyEase === 'function' ? postAcademyEase(waveNum) : 0;
      count = Math.floor(count * (1.22 + rtsProg * 0.28));
    }
    if (isEnemyRtsEra(waveNum)) {
      const enemyRts = typeof rtsMapBlend === 'function' ? rtsMapBlend(waveNum) : 0;
      count = Math.floor(count * (1.1 + enemyRts * 0.18));
    }
    count += getEnemyEconomySpawnBonus();
    count = Math.max(1, Math.floor(count * (getAsymmetricMods().enemyCountMult || 1)));
    if (GS.waveModifiers.stealReduction) count = Math.max(1, count - GS.waveModifiers.stealReduction);

    let pool = ColonyValue?.mergePool
      ? svc('ColonyValue').mergePool([...cfg.pool], colonyPressure || {})
      : [...cfg.pool];
    if (svc('EnemyFactions')) pool = svc('EnemyFactions').enrichPool(pool, waveNum);
    let weights = ColonyValue?.mergeWeights
      ? svc('ColonyValue').mergeWeights(getDifficulty().enemyWeight || {}, colonyPressure?.weights)
      : getDifficulty().enemyWeight || {};
    if (svc('EnemyFactions')) weights = svc('EnemyFactions').mergeFactionWeights(waveNum, weights);
    if (svc('BiomeSpawn')) {
      const biomeMerge = svc('BiomeSpawn').mergeSpawnWeights(weights, waveNum, getLivingPlanetCtx());
      weights = biomeMerge.weights;
      count = svc('BiomeSpawn').adjustSpawnCount(count, waveNum, getLivingPlanetCtx());
    }

    return {
      count,
      pool,
      weights,
      elites: SPAWN_ELITE_TYPES,
      noElites: !!(GS.waveModifiers.noElites || diff.forceNoElites),
      seed: getSpawnFillSeed(waveNum),
    };
  }

  function buildWeightedSpawnFill(params) {
    const bridge = svc('PathWorkerBridge');
    const key = `${GS.wave}:${params.count}:${params.seed}`;
    const prefetched = bridge?.takePrefetchedSpawnQueue?.(GS.wave, key);
    if (prefetched) return prefetched;
    if (typeof WaveCompositionCore !== 'undefined') {
      return WaveCompositionCore.buildWeightedSpawnQueue({
        count: params.count,
        pool: params.pool,
        weights: params.weights,
        elites: params.elites,
        noElites: params.noElites,
        seed: params.seed,
      });
    }
    const queue = [];
    for (let i = 0; i < params.count; i++) {
      let pickPool = params.pool;
      if (params.noElites && params.elites.length) {
        pickPool = params.pool.filter((t) => !params.elites.includes(t));
      }
      if (!pickPool.length) pickPool = params.pool;
      if (!pickPool.length) break;
      if (Object.keys(params.weights).length) {
        const weighted = [];
        for (const t of pickPool) {
          const w = Math.max(1, Math.floor((params.weights[t] || 1) * 10));
          for (let j = 0; j < w; j++) weighted.push(t);
        }
        queue.push(weighted[Math.floor(gameRandom() * weighted.length)]);
      } else {
        queue.push(pickPool[Math.floor(gameRandom() * pickPool.length)]);
      }
    }
    return queue;
  }

  function prefetchSpawnQueueForWave(waveNum) {
    const bridge = svc('PathWorkerBridge');
    if (!bridge?.isReady?.()) return;
    const params = computeSpawnFillParams(waveNum);
    if (!params) return;
    bridge.prefetchSpawnQueue({
      wave: waveNum,
      count: params.count,
      pool: params.pool,
      weights: params.weights,
      elites: params.elites,
      noElites: params.noElites,
      seed: params.seed,
    });
  }

  function expireStalePendingPaths() {
    for (const unit of GS.units) {
      if (!unit.pathPending || unit.hp <= 0) {
        unit.pathWaitTicks = 0;
        continue;
      }
      unit.pathWaitTicks = (unit.pathWaitTicks || 0) + 1;
      // Fail faster — 40 ticks left armies frozen after grid invalidation (castle complete).
      if (unit.pathWaitTicks < 12) continue;
      unit.pathWaitTicks = 0;
      unit.pathPending = false;
      unit.pathReqId = null;
      if (unit.targetX == null || unit.targetY == null) continue;
      if (isBuildingPathTarget(unit.pathTargetId)) {
        const bld = getBuildingPursuitTarget(unit);
        if (bld) pathToEnemyStructure(unit, bld, { force: true, sync: true, recalcInterval: 0 });
        else setUnitPath(unit, unit.targetX, unit.targetY, null, { force: true, sync: true });
        continue;
      }
      const dest =
        unit.pathTargetId && unit.pathTargetId !== 'advance'
          ? getUnitById(unit.pathTargetId)
          : null;
      setUnitPath(unit, unit.targetX, unit.targetY, dest, { force: true, sync: true });
      // Any team still stuck after force sync: direct waypoint so AI never freezes mid-map.
      if (!unit.path?.length && unit.targetX != null && unit.targetY != null) {
        unit.path = [{ x: unit.targetX, y: unit.targetY }];
        unit.pathIndex = 0;
        unit.pathPending = false;
        unit.pathReqId = null;
      }
    }
  }

  function applyWorkerPathResults() {
    const bridge = svc('PathWorkerBridge');
    if (!bridge) return;
    const gridGen = bridge.getGridGen?.() ?? 0;
    for (const msg of bridge.drainPathResults()) {
      const unit = getUnitById(msg.unitId);
      if (!unit || unit.hp <= 0) continue;
      if (msg.gen != null && msg.gen !== gridGen) {
        if (unit.pathPending && (unit.pathReqId == null || unit.pathReqId === msg.id)) {
          GameRuntime.clearPathTrack(unit, { keepTargets: true, keepManual: unit.manualOrder });
          unit.pathRecalc = 0;
        }
        continue;
      }
      if (unit.pathReqId != null && unit.pathReqId !== msg.id) continue;
      let path = [];
      if (msg.path?.length) {
        if (!unit.path) unit.path = [];
        unit.path.length = 0;
        for (let pi = 0; pi < msg.path.length; pi++) {
          const p = msg.path[pi];
          unit.path.push({ x: p.x, y: p.y });
        }
        path = unit.path;
      } else if (unit.targetX != null && unit.targetY != null && svc('Pathfinding')) {
        path = svc('Pathfinding').findPath(
          unit.x,
          unit.y,
          unit.targetX,
          unit.targetY,
          unit,
          isTerrainBlockedForPath
        );
      }
      GameRuntime.applyPathToUnit(unit, path);
    }
  }

  function assessColonyThreat(targetWave = GS.wave) {
    if (!svc('ColonyValue')) {
      GS.colonySnapshot = null;
      GS.colonyThreatMods = {
        countMult: 1,
        hpMult: 1,
        dmgMult: 1,
        intervalMult: 1,
        weights: {},
        eliteSlots: 0,
      };
      return null;
    }
    GS.colonySnapshot = svc('ColonyValue').computeKingdomStrength({ wave: targetWave });
    GS.colonyThreatMods = svc('ColonyValue').deriveWavePressure(GS.colonySnapshot, targetWave);
    return { colony: GS.colonySnapshot, pressure: GS.colonyThreatMods };
  }

  function appendCounterIntel() {
    if (!svc('StrategyCounterplay')) return;
    const strategies = svc('StrategyCounterplay').getActive();
    const intel = svc('StrategyCounterplay').formatCounterIntel(strategies);
    if (intel) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${intel}` : intel;
    svc('StrategyCounterplay').maybeAnnounce(strategies, {
      showMessage,
      floatingText: floatStatus,
      worldW: GS.worldW,
    });
  }

  function buildSpawnQueue() {
    GS.currentWaveConfig = getWaveConfig(GS.wave);
    GS.currentHordeWave = null;
    const diff = getDifficulty();
    const isBoss =
      svc('GameDepth') && svc('GameDepth').isBossWave
        ? svc('GameDepth').isBossWave(GS.wave)
        : GS.currentWaveConfig.boss;
    const colonyAssess = assessColonyThreat(GS.wave);
    let colonyPressure = colonyAssess?.pressure;
    if (svc('GrandStrategy') && colonyPressure) {
      colonyPressure = svc('GrandStrategy').applyPressureMods(colonyPressure);
    }
    if (svc('IntergalacticLayer') && colonyPressure) {
      colonyPressure = svc('IntergalacticLayer').applyPressureMods(colonyPressure);
    }
    if (typeof HybridMoments !== 'undefined' && colonyPressure) {
      colonyPressure = HybridMoments.applyPressureMods(colonyPressure);
    }

    const runSession = svc('GameModes') ? svc('GameModes').getSession() : null;
    const forceHorde =
      runSession?.forceHorde ||
      (typeof OnlineMultiplayer !== 'undefined' && OnlineMultiplayer.isForceHordeMode(runSession));
    const isHorde =
      forceHorde && !isBoss
        ? GS.wave >= 1
        : !isBoss && svc('GameDepth') && svc('GameDepth').isHordeWave?.(GS.wave);

    if (isHorde) {
      const pool = ColonyValue?.mergePool
        ? svc('ColonyValue').mergePool([...(GS.currentWaveConfig.pool || [])], colonyPressure || {})
        : [...(GS.currentWaveConfig.pool || [])];
      const hordeMult =
        (runSession?.hordeCountMult || 1) *
        (typeof OnlineMultiplayer !== 'undefined'
          ? OnlineMultiplayer.getHordeCountMult(runSession)
          : 1);
      const hordeMods = {
        ...GS.waveModifiers,
        countMult: (GS.waveModifiers.countMult || 1) * (colonyPressure?.countMult || 1) * hordeMult,
      };
      GS.currentHordeWave = svc('GameDepth').buildHordeSpawnQueue(GS.wave, pool, hordeMods, diff);
      if (
        colonyPressure &&
        GS.colonySnapshot?.signals?.wallCount >= 4 &&
        GS.wave >= 7 &&
        !GS.currentHordeWave.queue.includes('siege_tower')
      ) {
        GS.currentHordeWave.queue.unshift('siege_tower', 'goblin_sapper');
        GS.currentHordeWave.hasSiege = true;
      }
      GS.spawnQueue = svc('GameDepth')
        ? svc('GameDepth').injectEvilOperativesIntoQueue(
            [...GS.currentHordeWave.queue],
            GS.wave,
            gameRandom
          )
        : [...GS.currentHordeWave.queue];
      if (svc('EnemyFactions')) {
        GS.spawnQueue = svc('EnemyFactions').biasHordeQueue(GS.spawnQueue, GS.wave, gameRandom);
        GS.spawnQueue = svc('EnemyFactions').injectSubBosses(GS.spawnQueue, GS.wave, gameRandom);
      }
      if (svc('PlanetConquest')) {
        GS.spawnQueue = svc('PlanetConquest').filterSpawnQueue(GS.spawnQueue, GS.wave);
      }
      GS.waveEnemyTotal = GS.spawnQueue.length;
      GS.waveProgress = 0;
      const towers = GS.spawnQueue.filter((t) => t === 'siege_tower').length;
      GS.nextWaveIntel =
        svc('GameDepth').formatWaveIntel(
          GS.spawnQueue,
          getWaveAttackSides(),
          GS.currentHordeWave.hasSiege,
          towers
        ) || '';
      const f = GS.currentHordeWave.flavor || svc('GameDepth')?.HORDE_FLAVORS?.[0];
      addHighlight('horde', `Horde wave ${GS.wave} — ${f?.label || 'Horde'}`);
      showMessage(`HORDE WAVE ${GS.wave}! ${f?.label || 'Horde'} — ${f?.tagline || ''}`, 360);
      const hordeI = GS.currentHordeWave.intensity ?? 0.5;
      const hordeColor = hordeI >= 0.72 ? '#ff4840' : hordeI >= 0.48 ? '#ff8040' : '#ff9040';
      svc('FloatingText').status(GS.worldW / 2, 48, 'HORDE INCOMING', hordeColor);
      svc('FloatingText').status(GS.worldW / 2, 62, (f?.label || 'Horde').toUpperCase(), '#ffc060');
      if (GS.currentHordeWave.hasSiege) {
        playSfx('siegeRumble');
        showMessage('Siege elements embedded in the horde — protect your walls!', 280);
      }
      if (GS.colonySnapshot && colonyPressure && svc('ColonyValue')) {
        const note = svc('ColonyValue').formatWaveNote(GS.colonySnapshot, colonyPressure);
        GS.nextWaveIntel = note + (GS.nextWaveIntel ? ` · ${GS.nextWaveIntel}` : '');
      }
      if (svc('EnemyFactions')) {
        const roster = svc('EnemyFactions').formatFactionRoster(GS.spawnQueue);
        if (roster) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${roster}` : roster;
      }
      if (svc('GrandStrategy')) {
        const gsNote = svc('GrandStrategy').formatIntelNote(GS.wave);
        if (gsNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${gsNote}` : gsNote;
      }
      if (svc('IntergalacticLayer')) {
        const igNote = svc('IntergalacticLayer').formatIntelNote(GS.wave);
        if (igNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${igNote}` : igNote;
      }
      if (typeof ProgressionRestarts !== 'undefined') {
        const prNote = ProgressionRestarts.formatIntelNote({ wave: GS.wave });
        if (prNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${prNote}` : prNote;
      }
      if (typeof HybridMoments !== 'undefined') {
        const hmNote = HybridMoments.formatIntelNote({ wave: GS.wave });
        if (hmNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${hmNote}` : hmNote;
      }
      if (typeof PacingTools !== 'undefined') {
        const ptNote = PacingTools.formatIntelNote({ gameSpeed: GS.gameSpeed });
        if (ptNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${ptNote}` : ptNote;
      }
      if (typeof EternalLegacyTree !== 'undefined') {
        const elNote = EternalLegacyTree.formatIntelNote({ wave: GS.wave });
        if (elNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${elNote}` : elNote;
      }
      if (typeof FoundationalMedievalLayer !== 'undefined') {
        const fmNote = FoundationalMedievalLayer.formatIntelNote({ wave: GS.wave });
        if (fmNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${fmNote}` : fmNote;
      }
      if (typeof AscensionSystem !== 'undefined') {
        const ascNote = AscensionSystem.formatIntelNote({ wave: GS.wave });
        if (ascNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${ascNote}` : ascNote;
      }
      if (typeof ThematicEraSynergies !== 'undefined') {
        const synNote = ThematicEraSynergies.formatIntelNote({ wave: GS.wave });
        if (synNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${synNote}` : synNote;
      }
      if (typeof HybridPowerFantasy !== 'undefined') {
        const pfNote = HybridPowerFantasy.formatIntelNote({ wave: GS.wave });
        if (pfNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${pfNote}` : pfNote;
      }
      if (typeof NarrativeThread !== 'undefined') {
        const crownNote = NarrativeThread.formatIntelNote({ wave: GS.wave });
        if (crownNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${crownNote}` : crownNote;
      }
      if (typeof TechTreeBranches !== 'undefined') {
        const techNote = TechTreeBranches.formatIntelNote({ wave: GS.wave });
        if (techNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${techNote}` : techNote;
      }
      if (typeof GrandStrategyMidBranches !== 'undefined') {
        const mbNote = GrandStrategyMidBranches.formatIntelNote({ wave: GS.wave });
        if (mbNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mbNote}` : mbNote;
      }
      if (typeof EternalPathFramework !== 'undefined') {
        const epfNote = EternalPathFramework.formatIntelNote({ wave: GS.wave });
        if (epfNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${epfNote}` : epfNote;
      }
      if (typeof MartialPathEvolution !== 'undefined') {
        const mpeNote = MartialPathEvolution.formatIntelNote({ wave: GS.wave });
        if (mpeNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mpeNote}` : mpeNote;
      }
      if (typeof ArcanePathEvolution !== 'undefined') {
        const apeNote = ArcanePathEvolution.formatIntelNote({ wave: GS.wave });
        if (apeNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${apeNote}` : apeNote;
      }
      if (typeof TechPathEvolution !== 'undefined') {
        const tpeNote = TechPathEvolution.formatIntelNote({ wave: GS.wave });
        if (tpeNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${tpeNote}` : tpeNote;
      }
      if (typeof MythicPathEvolution !== 'undefined') {
        const mypNote = MythicPathEvolution.formatIntelNote({ wave: GS.wave });
        if (mypNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mypNote}` : mypNote;
      }
      appendCounterIntel();
      return;
    }
    let count = Math.max(
      1,
      Math.floor(
        GS.currentWaveConfig.count *
          GS.waveModifiers.countMult *
          diff.enemyCountMult *
          (colonyPressure?.countMult || 1)
      )
    );
    if (isRtsEra(GS.wave)) {
      const rtsProg = typeof postAcademyEase === 'function' ? postAcademyEase(GS.wave) : 0;
      count = Math.floor(count * (1.22 + rtsProg * 0.28));
    }
    if (isEnemyRtsEra(GS.wave)) {
      const enemyRts = typeof rtsMapBlend === 'function' ? rtsMapBlend(GS.wave) : 0;
      count = Math.floor(count * (1.1 + enemyRts * 0.18));
    }
    count += getEnemyEconomySpawnBonus();
    count = Math.max(1, Math.floor(count * (getAsymmetricMods().enemyCountMult || 1)));
    const asymElites = getAsymmetricMods().eliteSlotBonus || 0;
    if (GS.waveModifiers.stealReduction) count = Math.max(1, count - GS.waveModifiers.stealReduction);
    const elites = SPAWN_ELITE_TYPES;
    let pool = ColonyValue?.mergePool
      ? svc('ColonyValue').mergePool([...GS.currentWaveConfig.pool], colonyPressure || {})
      : [...GS.currentWaveConfig.pool];
    if (svc('EnemyFactions')) pool = svc('EnemyFactions').enrichPool(pool, GS.wave);
    let weights = ColonyValue?.mergeWeights
      ? svc('ColonyValue').mergeWeights(getDifficulty().enemyWeight || {}, colonyPressure?.weights)
      : getDifficulty().enemyWeight || {};
    if (svc('EnemyFactions')) weights = svc('EnemyFactions').mergeFactionWeights(GS.wave, weights);
    if (svc('BiomeSpawn')) {
      const biomeMerge = svc('BiomeSpawn').mergeSpawnWeights(weights, GS.wave, getLivingPlanetCtx());
      weights = biomeMerge.weights;
      count = svc('BiomeSpawn').adjustSpawnCount(count, GS.wave, getLivingPlanetCtx());
    }
    const fillParams = {
      count,
      pool,
      weights,
      elites,
      noElites: !!(GS.waveModifiers.noElites || diff.forceNoElites),
      seed: getSpawnFillSeed(GS.wave),
    };
    GS.spawnQueue = buildWeightedSpawnFill(fillParams);
    GS.namedBossWave = svc('GameDepth') ? svc('GameDepth').getNamedBossForWave(GS.wave) : null;
    let monsterBossPrep = null;
    if (GS.namedBossWave && svc('MonsterBosses')) {
      monsterBossPrep = svc('MonsterBosses').prepareBossWave(
        GS.namedBossWave.type,
        GS.wave,
        GS.namedBossWave.scale || 1
      );
      GS.namedBossWave = {
        ...GS.namedBossWave,
        scale: monsterBossPrep.totalScale,
        evolution: monsterBossPrep.evolution,
        packSummary: monsterBossPrep.packSummary,
      };
    }
    if (isBoss && (!GS.waveModifiers.noElites || GS.namedBossWave)) {
      let bossCore = GameDepth?.bossWaveComposition(GS.wave, pool) || [
        'war_chief',
        'dark_knight',
        'dark_knight',
      ];
      if (GS.waveModifiers.noElites && GS.namedBossWave) {
        bossCore = [GS.namedBossWave.type];
      }
      GS.spawnQueue = bossCore.concat(GS.spawnQueue.slice(0, Math.max(0, count - bossCore.length)));
      if (GS.namedBossWave && svc('MonsterBosses')) {
        GS.spawnQueue = svc('MonsterBosses').injectPackIntoQueue(
          GS.spawnQueue,
          GS.namedBossWave.type,
          monsterBossPrep
        );
      }
      if (GS.namedBossWave) {
        const assassinNote = GS.waveModifiers.noElites ? ' (elites assassinated — boss remains)' : '';
        const packNote = GS.namedBossWave.packSummary ? ` · ${GS.namedBossWave.packSummary}` : '';
        addHighlight(
          'boss',
          `Boss wave ${GS.wave} — ${GS.namedBossWave.name} leads the assault${assassinNote}`
        );
        showMessage(
          `BOSS WAVE ${GS.wave}! ${GS.namedBossWave.name} — ${GS.namedBossWave.tagline}${packNote}`,
          380
        );
        svc('FloatingText').status(GS.worldW / 2, 44, GS.namedBossWave.name.toUpperCase(), '#ffd040');
        svc('FloatingText').status(GS.worldW / 2, 58, GS.namedBossWave.title.toUpperCase(), '#ff6060');
        if (svc('MonsterBosses') && GS.namedBossWave.evolution?.label) {
          svc('MonsterBosses').announceEvolution(monsterBossPrep, GS.namedBossWave, {
            showMessage,
            addHighlight,
            floatingText: floatStatus,
            worldW: GS.worldW,
          });
        }
      } else {
        addHighlight('boss', `Boss wave ${GS.wave} — War Chief leads the assault`);
        showMessage(`BOSS WAVE ${GS.wave}! War Chief leads the assault!`, 320);
        svc('FloatingText').status(GS.worldW / 2, 48, 'BOSS WAVE', '#ff4040');
      }
      playSfx('bossWarn');
    } else if (isBoss) {
      GS.namedBossWave = null;
    }
    if (typeof GameFeedback !== 'undefined') {
      GameFeedback.resetWave();
      GameFeedback.onWaveStart(GS.wave, {
        boss: !!isBoss || !!GS.namedBossWave,
        horde: !!GS.currentHordeWave,
        siege: !!GS.currentHordeWave?.hasSiege || isSiegeWave?.(),
        subtitle: GS.namedBossWave?.name || (GS.currentHordeWave ? 'Brace for the swarm' : 'Hold the line'),
      });
    }
    if (colonyPressure && svc('ColonyValue')) {
      svc('ColonyValue').injectElites(GS.spawnQueue, pool, colonyPressure, gameRandom);
    }
    const wantSiege = (GS.colonySnapshot?.signals?.wallCount || 0) >= 3 || GS.wave >= 7;
    if (
      wantSiege &&
      !GS.spawnQueue.includes('siege_tower') &&
      !GS.waveModifiers.noElites &&
      !isBoss &&
      !GS.currentHordeWave
    ) {
      GS.spawnQueue[Math.floor(gameRandom() * GS.spawnQueue.length)] = 'siege_tower';
    }
    if (GS.waveModifiers.revealed || GS.waveModifiers.nextPreview) {
      GS.nextWaveIntel =
        GameDepth?.formatWaveIntel(GS.spawnQueue, getWaveAttackSides(), false, 0) ||
        [...new Set(GS.spawnQueue.map((t) => EnemyDefs[t]?.name || t))].join(', ');
      GS.waveModifiers.nextPreview = GS.nextWaveIntel;
      showMessage(`Scout report: ${GS.nextWaveIntel}`, 360);
    }
    GS.waveEnemyTotal = GS.spawnQueue.length;
    GS.waveProgress = 0;
    GS.bossTrackId =
      GS.namedBossWave?.type ||
      [
        'boss_malachar',
        'boss_volk',
        'boss_karg',
        'boss_sylvara',
        'war_chief',
        'behemoth',
        'elder_wyrm',
        'iron_colossus',
      ].find((t) => GS.spawnQueue.includes(t)) ||
      null;
    if (svc('ContentExpansion')) {
      GS.spawnQueue = svc('ContentExpansion').applyWaveEvent(GS.wave, GS.spawnQueue);
    }
    if (svc('GameDepth')) {
      GS.spawnQueue = svc('GameDepth').injectEvilOperativesIntoQueue(GS.spawnQueue, GS.wave, gameRandom);
    }
    if (svc('EnemyFactions')) {
      GS.spawnQueue = svc('EnemyFactions').biasSpawnQueue(GS.spawnQueue, GS.wave, gameRandom);
      GS.spawnQueue = svc('EnemyFactions').injectSubBosses(GS.spawnQueue, GS.wave, gameRandom);
      if (svc('PlanetConquest')) {
        GS.spawnQueue = svc('PlanetConquest').filterSpawnQueue(GS.spawnQueue, GS.wave);
      }
    }
    if (asymElites > 0 && !GS.waveModifiers.noElites) {
      const elitePool = elites.filter((t) => pool.includes(t) || EnemyDefs[t]);
      for (let i = 0; i < asymElites && elitePool.length; i++) {
        GS.spawnQueue[Math.floor(gameRandom() * GS.spawnQueue.length)] =
          elitePool[Math.floor(gameRandom() * elitePool.length)];
      }
    }
    GS.waveEnemyTotal = GS.spawnQueue.length;
    if (GS.colonySnapshot && colonyPressure && svc('ColonyValue')) {
      const note = svc('ColonyValue').formatWaveNote(GS.colonySnapshot, colonyPressure);
      GS.nextWaveIntel = note + (GS.nextWaveIntel ? ` · ${GS.nextWaveIntel}` : '');
    }
    if (svc('EnemyFactions')) {
      const roster = svc('EnemyFactions').formatFactionRoster(GS.spawnQueue);
      if (roster) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${roster}` : roster;
    }
    if (svc('AsymmetricWarfare')) {
      const asym = getAsymmetricSnapshot();
      if (asym) {
        GS.nextWaveIntel =
          (GS.nextWaveIntel ? `${GS.nextWaveIntel} · ` : '') +
          `Cmd ${asym.commanderAuthority} vs Host Lv${asym.hostThreatLevel}`;
      }
    }
    if (GS.multiFrontPlan?.intel) {
      GS.nextWaveIntel = (GS.nextWaveIntel ? `${GS.nextWaveIntel} · ` : '') + GS.multiFrontPlan.intel;
    }
    if (GS.namedBossWave?.packSummary) {
      GS.nextWaveIntel = (GS.nextWaveIntel ? `${GS.nextWaveIntel} · ` : '') + GS.namedBossWave.packSummary;
    }
    if (svc('GrandStrategy')) {
      const gsNote = svc('GrandStrategy').formatIntelNote(GS.wave);
      if (gsNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${gsNote}` : gsNote;
    }
    if (svc('IntergalacticLayer')) {
      const igNote = svc('IntergalacticLayer').formatIntelNote(GS.wave);
      if (igNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${igNote}` : igNote;
    }
    if (typeof ProgressionRestarts !== 'undefined') {
      const prNote = ProgressionRestarts.formatIntelNote({ wave: GS.wave });
      if (prNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${prNote}` : prNote;
    }
    if (typeof HybridMoments !== 'undefined') {
      const hmNote = HybridMoments.formatIntelNote({ wave: GS.wave });
      if (hmNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${hmNote}` : hmNote;
    }
    if (typeof PacingTools !== 'undefined') {
      const ptNote = PacingTools.formatIntelNote({ gameSpeed: GS.gameSpeed });
      if (ptNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${ptNote}` : ptNote;
    }
    if (typeof EternalLegacyTree !== 'undefined') {
      const elNote = EternalLegacyTree.formatIntelNote({ wave: GS.wave });
      if (elNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${elNote}` : elNote;
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const fmNote = FoundationalMedievalLayer.formatIntelNote({ wave: GS.wave });
      if (fmNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${fmNote}` : fmNote;
    }
    if (typeof AscensionSystem !== 'undefined') {
      const ascNote = AscensionSystem.formatIntelNote({ wave: GS.wave });
      if (ascNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${ascNote}` : ascNote;
    }
    if (typeof ThematicEraSynergies !== 'undefined') {
      const synNote = ThematicEraSynergies.formatIntelNote({ wave: GS.wave });
      if (synNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${synNote}` : synNote;
    }
    if (typeof HybridPowerFantasy !== 'undefined') {
      const pfNote = HybridPowerFantasy.formatIntelNote({ wave: GS.wave });
      if (pfNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${pfNote}` : pfNote;
    }
    if (typeof NarrativeThread !== 'undefined') {
      const crownNote = NarrativeThread.formatIntelNote({ wave: GS.wave });
      if (crownNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${crownNote}` : crownNote;
    }
    if (typeof TechTreeBranches !== 'undefined') {
      const techNote = TechTreeBranches.formatIntelNote({ wave: GS.wave });
      if (techNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${techNote}` : techNote;
    }
    if (typeof GrandStrategyMidBranches !== 'undefined') {
      const mbNote = GrandStrategyMidBranches.formatIntelNote({ wave: GS.wave });
      if (mbNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mbNote}` : mbNote;
    }
    if (typeof EternalPathFramework !== 'undefined') {
      const epfNote = EternalPathFramework.formatIntelNote({ wave: GS.wave });
      if (epfNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${epfNote}` : epfNote;
    }
    if (typeof MartialPathEvolution !== 'undefined') {
      const mpeNote = MartialPathEvolution.formatIntelNote({ wave: GS.wave });
      if (mpeNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mpeNote}` : mpeNote;
    }
    if (typeof ArcanePathEvolution !== 'undefined') {
      const apeNote = ArcanePathEvolution.formatIntelNote({ wave: GS.wave });
      if (apeNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${apeNote}` : apeNote;
    }
    if (typeof TechPathEvolution !== 'undefined') {
      const tpeNote = TechPathEvolution.formatIntelNote({ wave: GS.wave });
      if (tpeNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${tpeNote}` : tpeNote;
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      const mypNote = MythicPathEvolution.formatIntelNote({ wave: GS.wave });
      if (mypNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mypNote}` : mypNote;
    }
    appendCounterIntel();
  }

  function spawnFactionCounterRaids() {
    if (GS.creativeMode || !svc('EnemyFactions')) return;
    const raids = svc('EnemyFactions').processCounterRaids(GS.wave, {
      buildings: GS.buildings,
      worldW: GS.worldW,
      worldH: GS.worldH,
      frontPlan: GS.multiFrontPlan,
      showMessage,
      floatingText: floatStatus,
      rng: gameRandom,
      spawnFn: (type, x, y, opts) => {
        const u = spawnUnit(type, x, y, 'enemy', opts);
        if (u && svc('EnemyFactions') && !u.enemyFaction) {
          u.enemyFaction = svc('EnemyFactions').getUnitFaction(type);
        }
        return u;
      },
      applyScaling: (u) => {
        if (!svc('GameDepth')) return;
        const cfg = GS.currentWaveConfig || getWaveConfig(GS.wave);
        svc('GameDepth').applyEnemySpawnScaling(u, GS.wave, {
          cfg,
          diff: getDifficulty(),
          waveModifiers: GS.waveModifiers,
          colonyThreat: GS.colonyThreatMods,
        });
      },
    });
    for (const u of raids) GS.units.push(u);
  }

  function healDoomslayerHero() {
    if (GS.wave % 2 !== 0) return;
    for (const u of GS.units) {
      if (u.team !== 'player' || !u.isDoomslayer || u.hp <= 0) continue;
      const missing = 1 - u.hp / u.maxHp;
      const heal = Math.floor(u.maxHp * missing * 0.5);
      if (heal > 0) {
        u.hp = Math.min(u.maxHp, u.hp + heal);
        svc('FloatingText').heal(u.x, u.y, heal);
        showMessage("The Doomslayer absorbs hell's wrath — massive heal!", 200);
      }
    }
  }

  function startNextWave() {
    processAcademyTraining();
    tickSettlementWaveProgress();
    GS.wave++;
    if (typeof Analytics !== 'undefined') Analytics.onWaveReached(GS.wave);
    if (typeof ProgressionRestarts !== 'undefined') {
      ProgressionRestarts.onWaveStart(GS.wave, getProgressionRestartCtx());
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      FoundationalMedievalLayer.onWaveStart(GS.wave, { wave: GS.wave, showMessage, addHighlight });
    }
    if (typeof HybridMoments !== 'undefined') {
      HybridMoments.syncFromLayers({ wave: GS.wave });
      HybridMoments.onWaveStart(GS.wave, { wave: GS.wave, showMessage, addHighlight });
    }
    if (!(GS.creativeMode && !GS.creativeSettings.useCampaignRules) && svc('GameDepth')) {
      const tenure = svc('GameDepth').applyVeteranTenureScaling(GS.units, GS.wave);
      if (tenure.enemyBuffed > 0 && GS.wave >= 6) {
        showMessage(
          `${tenure.enemyBuffed} enemy veteran${tenure.enemyBuffed > 1 ? 's' : ''} hardened (+HP/DMG from prior waves).`,
          180
        );
      }
      if (tenure.ipBuffed > 0 && GS.wave >= 30 && GS.wave % 25 === 0) {
        showMessage(
          'Evolved operatives scale with the war — promote core veterans with TP to stay competitive.',
          260
        );
      }
    }
    healDoomslayerHero();
    syncMapGrowth();
    ensureInitialBattlefield();
    const wavePrep = emitWaveStartPrep();
    GS.hazards = wavePrep.hazards;
    updateEnemyRTS();
    // Progressive flanks: unlock by wave, then roll which sides assault this wave.
    const unlockedSides = getUnlockedAttackSides(GS.wave);
    GS.waveAttackSides = rollWaveAttackSides(GS.wave);
    GS.multiFrontPlan = null;
    if (svc('MultiFrontSiege') && svc('EnemyFactions') && !GS.creativeMode) {
      const activeFactions = svc('EnemyFactions').getActiveFactions?.(GS.wave) || [];
      GS.multiFrontPlan = svc('MultiFrontSiege').buildFrontPlan(
        GS.wave,
        activeFactions,
        unlockedSides,
        gameRandom
      );
      if (GS.multiFrontPlan?.waveSides?.length) {
        const planned = GS.multiFrontPlan.waveSides.filter((s) => unlockedSides.includes(s));
        if (planned.length) GS.waveAttackSides = planned;
      }
    }
    announceAttackSides();
    if (GS.wave === 25 || GS.wave === 50 || GS.wave === 75) {
      const labels = { 25: 'East', 50: 'West', 75: 'South' };
      showMessage(
        `New attack flank unlocked: ${labels[GS.wave]}! The host can now strike from more sides.`,
        340
      );
      addHighlight('era', `${labels[GS.wave]} flank unlocked`);
    }
    announceAcademyEra();
    announceRtsEra();
    announceEnemyRtsEra();
    announceKingdomEvolution();
    if (svc('PlayerCounterEvolution') && svc('EnemyFactions')) {
      svc('PlayerCounterEvolution').checkWaveAnnouncement(GS.wave, announceHooks());
    }
    if (svc('LivingPlanet')) {
      svc('LivingPlanet').checkWaveAnnouncement(GS.wave, announceHooks());
    }
    if (svc('SettlementRaids')) {
      svc('SettlementRaids').checkWaveAnnouncement(GS.wave, announceHooks());
      if (svc('SettlementRaids').isActive(GS.wave)) {
        svc('SettlementRaids').refreshMissions(GS.buildings, GS.wave, {
          isAttackable: isAttackableEnemyStructure,
        });
      }
    }
    if (svc('EnemyFactions')) {
      svc('EnemyFactions').checkTierAnnouncements(GS.wave, announceHooks());
    }
    if (svc('FactionReputation')) {
      svc('FactionReputation').checkWaveAnnouncement(GS.wave, { hooks: uiHooks() });
    }
    maybeCampaignNarrative();
    GS.courierMessagesUsedThisWave = 0;
    GS.spyUsedThisWave = false;
    GS.doctrineUsedThisWave = false;
    GS.counterDoctrineUsedThisWave = false;
    GS.expeditionUsedThisWave = false;
    if (svc('DynamicMapEvents')) {
      svc('DynamicMapEvents').applyForWave(GS.wave, {
        worldW: GS.worldW,
        worldH: GS.worldH,
        rallyY: GS.rallyY,
        territoryTier: GS.territoryTier,
        units: GS.units,
        pendingWaveMods: GS.pendingWaveMods,
        spawnUnit: (u) => GS.units.push(u),
        grantTp: (n) => {
          if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
            GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
            sanitizeTactical();
          }
        },
        grantScience: (n) => {
          if (n > 0 && svc('Research') && svc('Research').grantSciencePoints) {
            svc('Research').grantSciencePoints(n, { showMessage });
          }
        },
        hooks: uiHooks(),
      });
    }
    GS.units
      .filter((u) => u.team === 'player')
      .forEach((u) => {
        u.specialistRankedThisWave = false;
        u._revivedThisWave = false;
      });
    resetWaveModifiers();
    GS.playerCasualtiesThisWave = 0;
    GS.structuresRazedThisWave = 0;
    if (svc('GrandStrategy')) {
      svc('GrandStrategy').onWaveStart(GS.wave, getGrandStrategyCtx());
    }
    if (svc('IntergalacticLayer')) {
      svc('IntergalacticLayer').onWaveStart(GS.wave, getIntergalacticCtx());
    }
    if (typeof AscensionSystem !== 'undefined' && !GS.creativeMode) {
      AscensionSystem.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof ThematicEraSynergies !== 'undefined' && !GS.creativeMode) {
      ThematicEraSynergies.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof HybridPowerFantasy !== 'undefined' && !GS.creativeMode) {
      HybridPowerFantasy.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof NarrativeThread !== 'undefined' && !GS.creativeMode) {
      NarrativeThread.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof TechTreeBranches !== 'undefined' && !GS.creativeMode) {
      TechTreeBranches.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof EternalPathFramework !== 'undefined' && !GS.creativeMode) {
      EternalPathFramework.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof MartialPathEvolution !== 'undefined' && !GS.creativeMode) {
      MartialPathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof ArcanePathEvolution !== 'undefined' && !GS.creativeMode) {
      ArcanePathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof TechPathEvolution !== 'undefined' && !GS.creativeMode) {
      TechPathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof MythicPathEvolution !== 'undefined' && !GS.creativeMode) {
      MythicPathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof LayerDesign !== 'undefined') {
      LayerDesign.onWaveStart(GS.wave, { showMessage, addHighlight });
    }
    buildSpawnQueue();
    if (GS.namedBossWave && svc('MonsterBosses')) {
      svc('MonsterBosses').spawnPackStructures(
        GS.namedBossWave.type,
        GS.wave,
        tryPlaceEnemyBuilding,
        null,
        {
          worldW: GS.worldW,
          worldH: GS.worldH,
          showMessage,
        }
      );
    }
    if (svc('GrandStrategy') && !GS.creativeMode) {
      const mobCtx = {
        ...getGrandStrategyCtx(),
        wave: GS.wave,
        isBoss: !!(
          GS.currentWaveConfig?.boss || (svc('GameDepth') && svc('GameDepth').isBossWave?.(GS.wave))
        ),
        isHorde: isHordeWave(),
        enemyCount: GS.spawnQueue.length,
        colonyPressure: GS.colonyThreatMods,
        namedBoss: !!GS.namedBossWave,
        multiFront: GS.multiFrontPlan,
        hasSiege: GS.spawnQueue.includes('siege_tower'),
        spawnQueue: GS.spawnQueue,
        grantTactical: (n) => {
          if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
            GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
            sanitizeTactical();
          }
        },
        applyPlayerCasualties: (n) => {
          let left = Math.max(0, n | 0);
          const victims = GS.units
            .filter(
              (u) =>
                u.team === 'player' &&
                u.hp > 0 &&
                !u.isGeneral &&
                !u.isDoomslayer &&
                !u.isNamedBoss
            )
            .sort((a, b) => (a.experience || 0) - (b.experience || 0) || a.hp - b.hp);
          for (const u of victims) {
            if (left <= 0) break;
            u.hp = 0;
            left--;
            GS.playerCasualtiesThisWave++;
            GS.runPlayerDeaths++;
          }
        },
        scratchBuilding: () => {
          const pool = GS.buildings.filter((b) => b.owner === 'player' && b.hp > 0 && b.complete);
          const b = pool[Math.floor(Math.random() * pool.length)];
          if (b) {
            b.hp = Math.max(1, b.hp - Math.floor((b.maxHp || 100) * 0.14));
            showMessage(`Routed template — ${b.type || 'hold'} took stray damage!`, 240);
          }
        },
      };
      const auto = svc('GrandStrategy').tryAutoResolveWave(GS.wave, mobCtx);
      if (auto?.resolved) {
        GS.spawnQueue = [];
        GS.waveEnemyTotal = 0;
        GS.currentHordeWave = null;
        GS.waveProgress = 1;
        showMessage(auto.summary, 380);
        addHighlight(auto.victory ? 'mobilization' : 'routed', auto.highlight);
        svc('FloatingText').status(
          GS.worldW / 2,
          52,
          auto.victory ? 'TEMPLATE VICTORY' : 'TEMPLATE ROUTED',
          auto.victory ? '#80c0ff' : '#ff8060'
        );
        enterNightPhase();
        return;
      }
      if (auto?.major) {
        showMessage(`Major battle — Wave ${GS.wave} requires your personal command (${auto.reason}).`, 320);
        if (typeof HybridMoments !== 'undefined') {
          HybridMoments.onMobilizationMajor(GS.wave, auto, {
            wave: GS.wave,
            worldW: GS.worldW,
            showMessage,
            addHighlight,
            floatingText: floatStatus,
          });
        }
      }
    }
    spawnFactionCounterRaids();
    GS.spawnTimer = 90 + GS.spawnDelayBonus;
    GS.spawnDelayBonus = 0;

    for (const t of GS.pendingReinforce) {
      const u = spawnUnit(t, 60 + Math.random() * (GS.worldW - 120), GS.deployY - 10, 'player');
      if (!u) continue;
      applyPlayerStatMods(u);
      if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
      u.targetY = GS.rallyY;
      GS.units.push(u);
    }
    GS.pendingReinforce = [];

    if (isHordeWave())
      showMessage(`HORDE ASSAULT — Wave ${GS.wave}! ${GS.currentHordeWave?.flavor?.label || ''}`);
    else if (GS.currentWaveConfig?.boss || (svc('GameDepth') && svc('GameDepth').isBossWave?.(GS.wave))) {
      showMessage(`BOSS WAVE ${GS.wave}!`);
    } else showMessage(`Dawn breaks — Wave ${GS.wave} assault begins!`);
    if (GS.wave === 1001) {
      showMessage("HELLSCAPE — even the Doomslayer's blade falters here!", 400);
      svc('FloatingText').status(GS.worldW / 2, 80, 'HELLSCAPE', '#ff2020');
    }
    applyWweWaveStartPulse();
    const assaultUnits = [];
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.team === 'player' && u.hp > 0) assaultUnits.push(u);
    }
    emitWaveStartAssault(assaultUnits);
    if (isHordeWave()) {
      playSfx('hordeWarn', GS.currentHordeWave?.intensity ?? 0.5);
    } else {
      playSfx('waveStart');
    }
  }

  function endGame(victory) {
    GS.state = victory ? 'victory' : 'defeat';
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
      playSfx(
        'victory',
        typeof Cosmetics !== 'undefined' ? Cosmetics.getVictoryThemeId() : null
      );
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
        misses: GS.runPlayerDeaths,
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
      { showMessage, addHighlight, worldW: GS.worldW, worldH: GS.worldH, wave: GS.wave, floatingText: floatStatus },
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

  function getGameSpeed() {
    return GS.gameSpeed;
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
      typeof PacingTools !== 'undefined'
        ? PacingTools.getMaxSimulationSteps(GS.gameSpeed)
        : 6;
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

  function selectDeploy(type) {
    const toggleOff = GS.selectedDeploy === type;
    clearSelection();
    if (!toggleOff) {
      const def = ensurePlayerUnitDef(type);
      if (!def) {
        showMessage(`Cannot select ${type} — unit data missing. Try restarting the run.`, 280);
        syncInteractionState();
        return;
      }
      if (!canDeployUnitType(type)) {
        showMessage('Creative mode — troop deploy disabled in lab settings (Academy Deploy off).', 280);
        syncInteractionState();
        return;
      }
      playSfx('deployConfirm');
      const researchLocked =
        svc('Research') && !svc('Research').isDeployUnlocked(type, getResearchOpts());
      if (researchLocked) {
        const need =
          type === 'ballista'
            ? 'Locked: Research Lab → Iron Weapons → Siege Engineering (wave 12+, 55 SP).'
            : type === 'bard'
              ? 'Locked: Research Lab → Morale Arts (wave 5+, 32 SP).'
              : type === 'scout' || type === 'pikeman'
                ? 'Locked: Research Lab → Iron Weapons → Advanced Infantry (wave 10+).'
                : type === 'sapper' || type === 'knight'
                  ? 'Locked: Research Lab → Iron Weapons first.'
                  : type === 'general'
                    ? 'Locked: Research Lab → Iron Weapons → Command Theory.'
                    : 'Research this unit at the Research Lab first!';
        showMessage(need, 320);
        // Still allow selection so the button highlights; map click re-checks.
      } else {
        const costMult = getDeployCostMult();
        const cost =
          GS.creativeMode && GS.creativeSettings.freeResources ? 0 : Math.ceil(def.cost * costMult);
        const costLabel = cost > 0 ? `${cost} TP` : 'free';
        showMessage(
          `${def.name || type} ready — click map (${costLabel}). Hold Shift to place more without reselecting.`,
          240
        );
      }
      GS.selectedDeploy = type;
    }
    syncInteractionState();
    playSfx('click');
  }

  function selectAbility(a) {
    const toggleOff = GS.selectedAbility === a;
    clearSelection();
    if (!toggleOff) GS.selectedAbility = a;
    syncInteractionState();
    playSfx('click');
  }

  function selectBuild(type) {
    const toggleOff = GS.selectedBuild === type;
    clearSelection();
    if (!toggleOff) {
      GS.selectedBuild = type;
      if (type === 'wall') {
        GS.pendingWallFacing = 'north';
        showMessage('Wall facing north — press R to rotate before placing.', 200);
      }
    }
    syncInteractionState();
    playSfx('click');
  }

  function cycleWallPlacementFacing() {
    if (GS.selectedBuild !== 'wall') return false;
    GS.pendingWallFacing = cycleWallFacing(GS.pendingWallFacing);
    showMessage(`Wall facing: ${GS.pendingWallFacing}`, 120);
    syncInteractionState();
    playSfx('click');
    return true;
  }

  function selectDemolish() {
    const toggleOff = GS.selectedDemolish;
    clearSelection();
    if (!toggleOff) {
      GS.selectedDemolish = true;
      showMessage('Demolish — click a completed structure. Refunds 50% TP.', 200);
    }
    syncInteractionState();
    playSfx('click');
  }

  function selectMoveBuilding() {
    const toggleOff = GS.selectedMoveBuilding;
    clearSelection();
    if (!toggleOff) {
      GS.selectedMoveBuilding = true;
      showMessage('Move building — click structure, then destination (free).', 220);
    }
    syncInteractionState();
    playSfx('click');
  }

  function selectRotateWall() {
    const toggleOff = GS.selectedRotateWall;
    clearSelection();
    if (!toggleOff) {
      GS.selectedRotateWall = true;
      showMessage('Rotate wall — click any completed wall to turn it 90° (free).', 200);
    }
    syncInteractionState();
    playSfx('click');
  }

  function rotateWall(b) {
    if (!b || b.type !== 'wall' || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const newFacing = cycleWallFacing(b.facing);
    b.facing = newFacing;
    ensureWallSlots(b);
    for (let i = 0; i < b.wallSlots.length; i++) {
      if (!b.wallSlots[i].unitId) continue;
      const wu = GS.units.find((u) => u.id === b.wallSlots[i].unitId);
      if (!wu) continue;
      wu.x = b.wallSlots[i].slotX;
      wu.y = b.wallSlots[i].slotY;
      wu.targetX = wu.x;
      wu.targetY = wu.y;
      wu.path = [];
      wu.pathIndex = 0;
      wu.wallGarrisoned = b.id;
      wu.wallSlotIndex = i;
      wu.rotation = wallFacingRotation(newFacing);
    }
    invalidateObstacles();
    svc('Particles').dust(b.x, b.y);
    showMessage(`Wall rotated — now facing ${newFacing}.`);
    playSfx('click');
    syncInteractionState();
    return true;
  }

  function selectCourierMessage(msg) {
    const toggleOff = GS.selectedCourierMsg === msg;
    clearSelection();
    if (!toggleOff) GS.selectedCourierMsg = msg;
    syncInteractionState();
    playSfx('click');
  }

  function executeSpyAction(action) {
    const def = SpyActions[action];
    const cost = svc('ContentExpansion')
      ? svc('ContentExpansion').getSpyCost(action, def?.cost ?? 99)
      : (def?.cost ?? 99);
    if (!def || GS.tactical < cost) {
      showMessage('Not enough TP or invalid action!');
      return false;
    }
    if (!isKingdomActionUnlocked(def)) {
      const need =
        typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? KINGDOM_EVOLUTION_STAGES[def.kingdomStage]?.name
          : `stage ${def.kingdomStage}`;
      showMessage(`${def.name} unlocks in ${need || 'a later kingdom stage'}.`);
      return false;
    }
    if (GS.spyUsedThisWave) {
      showMessage('Spy network already used this wave!');
      return false;
    }

    if (svc('ContentExpansion') && svc('ContentExpansion').handleSpyAction) {
      const ok = svc('ContentExpansion').handleSpyAction(action);
      if (ok) {
        GS.tactical -= cost;
        GS.spyUsedThisWave = true;
        playSfx('magicCast');
        ach('spy', { action });
        syncInteractionState();
        return true;
      }
      // Expansion handled the action type but refused (e.g. no raid targets) — do not fall through.
      if (
        action === 'settlement_raid' ||
        action === 'tunnel' ||
        action === 'deserter' ||
        action === 'maps'
      ) {
        return false;
      }
    }

    // Base spy actions — charge only on success.
    GS.tactical -= cost;
    GS.spyUsedThisWave = true;

    if (action === 'steal') {
      GS.tactical += 4;
      GS.pendingWaveMods.stealReduction += 2;
      showMessage('Spy stole enemy war chest! +4 TP');
    } else if (action === 'disrupt') {
      GS.pendingWaveMods.countMult = 0.65;
      showMessage('Supply lines disrupted! Next wave weakened.');
    } else if (action === 'assassin') {
      GS.pendingWaveMods.noElites = true;
      showMessage('Enemy captain assassinated! No elites next wave.');
    } else if (action === 'scout' || action === 'infiltrate') {
      GS.pendingWaveMods.revealed = true;
      GS.waveModifiers.revealed = true;
      const sides = getUnlockedAttackSides(GS.wave + 1);
      const nextW = GS.wave + 1;
      const horde = nextW >= 5 && nextW % 5 === 0 && !(nextW >= 10 && nextW % 10 === 0);
      const boss = nextW >= 10 && nextW % 10 === 0;
      let extra = '';
      if (boss) extra = ' Named BOSS expected.';
      else if (horde) extra = ' HORDE expected.';
      GS.nextWaveIntel = `Scout intel locked — exact roster at dawn.${sides.length > 1 ? ` Possible flanks: ${sides.join(', ')}` : ''}${extra}`;
      showMessage(GS.nextWaveIntel, 340);
    } else if (action === 'bribery') {
      GS.pendingWaveMods.revealed = true;
      GS.waveModifiers.revealed = true;
      const sides = getUnlockedAttackSides(GS.wave + 1);
      if (Math.random() < 0.5) GS.pendingWaveMods.stealReduction += 3;
      else {
        GS.tactical = Math.max(0, GS.tactical - 2);
        showMessage('Informant double-crossed! -2 TP', 180);
      }
      GS.nextWaveIntel = `Bribed intel${sides.length > 1 ? ` · Possible flanks: ${sides.join(', ')}` : ''}`;
      showMessage(GS.nextWaveIntel, 300);
    } else if (action === 'poison') {
      GS.pendingWaveMods.hpMult = 0.8;
      showMessage('Enemy caches poisoned! Next wave -20% HP.');
    } else if (action === 'sabotage') {
      GS.spawnDelayBonus = 120;
      showMessage('Siege equipment sabotaged! Enemy spawns delayed.');
    } else {
      // Unknown action after expansion miss — refund.
      GS.tactical += cost;
      GS.spyUsedThisWave = false;
      showMessage('Spy action failed.');
      return false;
    }
    if (
      svc('FactionReputation') &&
      ['assassin', 'disrupt', 'poison', 'sabotage'].includes(action)
    ) {
      svc('FactionReputation').onSpyAggression(GS.wave, { hooks: { showMessage } });
    }
    playSfx('magicCast');
    ach('spy', { action });
    syncInteractionState();
    return true;
  }

  

  function applyDoctrineToArmy(def) {
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (def.moraleBoost) {
        u.morale = Math.min(u.maxMorale, u.morale + def.moraleBoost);
        u.demoralized = false;
        u.fleeing = false;
        u.witnessDeaths = 0;
      }
      if (def.duration) {
        if (def.damageMult) {
          u.doctrineDmgMult = def.damageMult;
          u.doctrineDmgTimer = Math.max(u.doctrineDmgTimer || 0, def.duration);
        }
        if (def.mitigation) {
          u.doctrineMitigation = def.mitigation;
          u.doctrineMitTimer = Math.max(u.doctrineMitTimer || 0, def.duration);
        }
        if (def.speedMult) {
          u.doctrineSpeedMult = def.speedMult;
          u.doctrineSpeedTimer = Math.max(u.doctrineSpeedTimer || 0, def.duration);
        }
        if (def.moraleBoost || def.damageMult) {
          u.rallyTimer = Math.max(u.rallyTimer || 0, def.duration);
        }
      }
      if (u.canHunt) applyGlobalHuntState(u);
    }
  }

  function executeDoctrine(id) {
    const def = typeof KINGDOM_DOCTRINES !== 'undefined' ? KINGDOM_DOCTRINES[id] : null;
    if (!def) {
      showMessage('Unknown doctrine!');
      return false;
    }
    if (!isKingdomActionUnlocked(def)) {
      const need =
        KINGDOM_EVOLUTION_STAGES?.[def.kingdomStage]?.name || `stage ${def.kingdomStage}`;
      showMessage(`${def.name} unlocks in ${need}.`);
      return false;
    }
    if (GS.doctrineUsedThisWave) {
      showMessage('Kingdom doctrine already invoked this wave!');
      return false;
    }
    if (GS.tactical < def.cost) {
      showMessage('Not enough TP for kingdom doctrine!');
      return false;
    }
    GS.tactical -= def.cost;
    GS.doctrineUsedThisWave = true;

    if (def.tpGrant) {
      GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + def.tpGrant);
    }
    applyDoctrineToArmy(def);

    const label = def.name.toUpperCase();
    svc('FloatingText').status(GS.worldW / 2, GS.worldH / 2 - 24, label, '#c0a040');
    if (def.global) {
      StrikeFX?.play?.('rally', GS.worldW / 2, GS.rallyY, Math.max(GS.worldW, GS.worldH) * 0.45);
    }
    GS.rallyTimer = Math.max(GS.rallyTimer, def.duration || 0);
    showMessage(`Kingdom Doctrine — ${def.name}: ${def.desc}`, 380);
    playSfx('reinforce');
    ach('ability', { ability: id });
    if (typeof Analytics !== 'undefined') Analytics.onKingdomDoctrine(id);
    if (typeof StoryLore !== 'undefined') {
      StoryLore.recordChoice({
        source: 'doctrine',
        choiceId: id,
        label: def.name,
        wave: GS.wave,
      });
    }
    syncInteractionState();
    return true;
  }

  function executeCounterDoctrine(id) {
    if (!svc('PlayerCounterEvolution')) {
      showMessage('Counter-offensive unavailable.');
      return false;
    }
    const def = svc('PlayerCounterEvolution').COUNTER_DOCTRINES[id];
    if (!def) {
      showMessage('Unknown counter doctrine!');
      return false;
    }
    const kingdomStage =
      typeof getKingdomStageBuffs === 'function' ? getKingdomStageBuffs(GS.wave).stage : 1;
    if (!svc('PlayerCounterEvolution').isCounterDoctrineUnlocked(def, GS.wave, kingdomStage)) {
      showMessage(`${def.name} unlocks later — check wave and kingdom stage.`);
      return false;
    }
    if (GS.counterDoctrineUsedThisWave) {
      showMessage('Offensive counter doctrine already used this wave!');
      return false;
    }
    if (GS.tactical < def.cost) {
      showMessage('Not enough TP for counter-offensive!');
      return false;
    }
    GS.tactical -= def.cost;
    GS.counterDoctrineUsedThisWave = true;
    const result = svc('PlayerCounterEvolution').executeCounterDoctrine(id, GS.wave, kingdomStage, {
      worldW: GS.worldW,
      hooks: uiHooks(),
    });
    if (!result.ok) {
      GS.tactical += def.cost;
      GS.counterDoctrineUsedThisWave = false;
      if (result.reason === 'no_target') showMessage('No active host factions to weaken.');
      else showMessage('Counter doctrine failed.');
      return false;
    }
    if (svc('FactionReputation') && result.target?.id) {
      svc('FactionReputation').onCounterOffensive(result.target.id, GS.wave, {
        hooks: { showMessage },
      });
    }
    if (typeof Analytics !== 'undefined') Analytics.onCounterDoctrine(id);
    playSfx('magicCast');
    if (typeof StoryLore !== 'undefined') {
      StoryLore.recordChoice({
        source: 'counter',
        choiceId: id,
        label: def.name,
        wave: GS.wave,
        meta: result.target?.id,
      });
    }
    syncInteractionState();
    return true;
  }

  function dispatchExpedition(factionId) {
    if (!svc('PlayerCounterEvolution')) {
      showMessage('Expeditions unavailable.');
      return false;
    }
    if (!svc('PlayerCounterEvolution').canExpedition(GS.wave)) {
      showMessage(
        `Expeditions unlock at wave ${svc('PlayerCounterEvolution').EXPEDITION_WAVE_MIN}.`
      );
      return false;
    }
    if (!isNightPhase()) {
      showMessage('Dispatch expeditions during night prep — before dawn.');
      return false;
    }
    if (GS.expeditionUsedThisWave) {
      showMessage('One expedition per wave — troops already marching.');
      return false;
    }
    const ids = GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
    if (!ids.length) {
      showMessage(
        `Select ${svc('PlayerCounterEvolution').MIN_EXPEDITION_FORCE}–${svc('PlayerCounterEvolution').MAX_EXPEDITION_FORCE} hunters for the expedition.`
      );
      return false;
    }
    const result = svc('PlayerCounterEvolution').dispatchExpedition(factionId, ids, GS.wave, {
      units: GS.units,
      hooks: announceHooks(),
    });
    if (!result.ok) {
      if (result.reason === 'need_units') {
        showMessage(`Need ${result.need} expedition troops (have ${result.have}).`);
      } else if (result.reason === 'too_many') {
        showMessage(`Max ${result.max} troops per expedition.`);
      } else if (result.reason === 'no_target') {
        showMessage('Faction not active.');
      } else {
        showMessage('Could not dispatch expedition.');
      }
      return false;
    }
    for (const uid of result.expedition.unitIds) {
      const idx = GS.units.findIndex((u) => u.id === uid);
      if (idx >= 0) {
        const [u] = GS.units.splice(idx, 1);
        releaseUnitRecord(u);
      }
    }
    if (svc('FactionReputation')) {
      svc('FactionReputation').onExpedition(factionId, GS.wave, { hooks: { showMessage } });
    }
    GS.expeditionUsedThisWave = true;
    playSfx('deploy');
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function respondMapEvent(choiceId) {
    if (!svc('DynamicMapEvents')) {
      showMessage('Planet events unavailable.');
      return false;
    }
    if (!isNightPhase()) {
      showMessage('Respond to planet events during night prep — before dawn.', 220, {
        priority: 'critical',
        bypassQueue: true,
      });
      return false;
    }
    const cost = svc('DynamicMapEvents').getChoiceCost(choiceId);
    const freeTp = GS.creativeMode && GS.creativeSettings.freeResources;
    if (!freeTp && GS.tactical < cost) {
      showMessage(`Need ${cost} TP for this planet response (have ${Math.floor(GS.tactical)}).`, 220, {
        priority: 'critical',
        bypassQueue: true,
      });
      return false;
    }
    const result = svc('DynamicMapEvents').respond(choiceId, {
      tactical: GS.tactical,
      freeTp,
      spendTp: (n) => {
        GS.tactical -= n;
        sanitizeTactical();
      },
      hooks: uiHooks(),
    });
    if (!result.ok) {
      if (result.reason === 'need_tp') {
        showMessage(`Need ${result.cost} TP (have ${GS.tactical}).`, 220, {
          priority: 'critical',
          bypassQueue: true,
        });
      } else if (result.reason === 'none_pending') {
        showMessage('No planet event awaiting response this night.', 220, {
          priority: 'critical',
          bypassQueue: true,
        });
      } else if (result.reason === 'already_chosen') {
        showMessage('Planet response already locked for this night.', 200, {
          priority: 'critical',
          bypassQueue: true,
        });
      } else if (result.reason === 'bad_choice') {
        showMessage('Unknown planet response.');
      } else {
        showMessage('Could not record planet response.');
      }
      return false;
    }
    if (typeof StoryLore !== 'undefined' && result.event) {
      const choiceDef = result.event.choices?.find((c) => c.id === result.choice);
      StoryLore.recordChoice({
        source: 'planet_event',
        choiceId: result.choice,
        label: choiceDef?.label || result.choice,
        eventId: result.event.eventId || result.event.id,
        wave: GS.wave,
      });
    }
    playSfx('click');
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function dispatchRaidStrike(missionId) {
    if (!svc('SettlementRaids')) {
      showMessage('Settlement raids unavailable.');
      return false;
    }
    if (!svc('SettlementRaids').isActive(GS.wave)) {
      showMessage(
        `Settlement raids unlock at wave ${svc('SettlementRaids').SETTLEMENT_RAID_WAVE_MIN}.`
      );
      return false;
    }
    const ids = GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
    if (!ids.length) {
      showMessage(
        `Select ${svc('SettlementRaids').MIN_STRIKE_FORCE}+ hunters, then dispatch a raid mission.`
      );
      return false;
    }
    const result = svc('SettlementRaids').dispatchStrike(missionId, ids, {
      units: GS.units,
      hooks: uiHooks(),
    });
    if (!result.ok) {
      if (result.reason === 'need_units') {
        showMessage(`Need ${result.need} hunters for a strike force (have ${result.have}).`);
      } else if (result.reason === 'already_dispatched') {
        showMessage('Strike force already en route to that hold.');
      } else if (result.reason === 'no_mission') {
        showMessage('Raid mission expired — target already cleared.');
      } else {
        showMessage('Could not dispatch strike force.');
      }
      return false;
    }
    if (svc('FactionReputation') && result.mission?.factionId) {
      svc('FactionReputation').onSettlementRaid(result.mission.factionId, GS.wave, {
        hooks: { showMessage },
      });
    }
    playSfx('deploy');
    return true;
  }

  function getCourierMessagesPerWave() {
    if (!hasCourier()) return 0;
    for (const u of GS.units) {
      if (u.type !== 'courier' || u.hp <= 0) continue;
      if (typeof isSpecialistLateAbilityUnlocked === 'function' && isSpecialistLateAbilityUnlocked(u)) {
        return 2; // Twin Dispatch — two messages per wave
      }
      const late =
        typeof getSpecialistLateAbilityInfo === 'function'
          ? getSpecialistLateAbilityInfo(u)
          : null;
      if (late?.unlocked && late.id === 'twin_dispatch') return 2;
    }
    return 1;
  }

  function isCourierMessageCapReached() {
    return GS.courierMessagesUsedThisWave >= Math.max(1, getCourierMessagesPerWave() || 1);
  }

  function sendCourierMessage(msg) {
    const def = CourierMessages[msg];
    const cost = svc('ContentExpansion')
      ? svc('ContentExpansion').getCourierCost(msg, def?.cost ?? 99)
      : (def?.cost ?? 99);
    if (!def || GS.tactical < cost) {
      showMessage('Not enough TP!');
      return false;
    }
    if (!isKingdomActionUnlocked(def)) {
      const need =
        typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? KINGDOM_EVOLUTION_STAGES[def.kingdomStage]?.name
          : `stage ${def.kingdomStage}`;
      showMessage(`${def.name} unlocks in ${need || 'a later kingdom stage'}.`);
      return false;
    }
    if (!hasCourier()) {
      showMessage('You need a live Courier on the field!');
      return false;
    }
    const msgCap = Math.max(1, getCourierMessagesPerWave());
    if (GS.courierMessagesUsedThisWave >= msgCap) {
      showMessage(
        msgCap > 1
          ? 'Courier already sent both dispatches this wave!'
          : 'Courier already dispatched this wave!'
      );
      return false;
    }
    if (GS.courierCooldown > 0) {
      showMessage('Courier is still riding...');
      return false;
    }
    GS.tactical -= cost;
    GS.courierMessagesUsedThisWave++;
    const courier = GS.units.find((u) => u.type === 'courier' && u.hp > 0);
    let cdMult = courier?.courierCooldownMult || 1;
    // Twin Dispatch rides 20% cooler (faster) between messages.
    if (
      courier &&
      typeof isSpecialistLateAbilityUnlocked === 'function' &&
      isSpecialistLateAbilityUnlocked(courier)
    ) {
      const twinCd =
        typeof SPECIALIST_LATE_ABILITIES !== 'undefined'
          ? SPECIALIST_LATE_ABILITIES.twin_dispatch?.cooldownMult
          : null;
      cdMult *= twinCd ?? 1 / (typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2);
    }
    GS.courierCooldown = Math.max(50, Math.floor(180 * cdMult));
    if (courier) {
      courier.courierReady = false;
      courier.animState = 'walk';
      notifyVetStarEvent(courier, trySpecialistRank(courier));
    }

    if (svc('ContentExpansion') && svc('ContentExpansion').handleCourierMessage(msg)) {
      const rem = Math.max(0, msgCap - GS.courierMessagesUsedThisWave);
      showMessage(
        rem > 0
          ? `Courier dispatched: ${def.name} (${rem} message left this wave)`
          : `Courier dispatched: ${def.name}`
      );
      playSfx('deploy');
      ach('courier', { message: msg });
      syncInteractionState({ refreshCounts: true });
      return true;
    }

    if (msg === 'reinforce') GS.pendingReinforce.push('footman', 'footman');
    else if (msg === 'decree')
      GS.units
        .filter((u) => u.team === 'player')
        .forEach((u) => {
          u.morale = Math.min(u.maxMorale, u.morale + 5);
          u.demoralized = false;
          u.witnessDeaths = 0;
        });
    else if (msg === 'levy') GS.pendingLevy = 6;
    else if (msg === 'banner') {
      const u = spawnUnit('knight', 200, GS.deployY, 'player');
      u.targetY = GS.rallyY;
      GS.units.push(u);
    } else if (msg === 'supplies') {
      GS.units
        .filter((u) => u.team === 'player' && u.hp > 0)
        .forEach((u) => (u.hp = Math.min(u.maxHp, u.hp + 25)));
    } else if (msg === 'truce') {
      GS.spawnDelayBonus += 90;
      GS.units
        .filter((u) => u.team === 'player' && u.hp > 0)
        .forEach((u) => {
          u.morale = Math.min(u.maxMorale, u.morale + 8);
          u.demoralized = false;
        });
      if (svc('FactionReputation')) {
        svc('FactionReputation').onTruce(GS.wave, {
          worldW: GS.worldW,
          hooks: uiHooks(),
        });
      }
    } else if (msg === 'hunt_pact') {
      if (svc('NeutralRelations')) {
        svc('NeutralRelations').onHuntPact(GS.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          rallyY: GS.rallyY,
          territoryTier: GS.territoryTier,
          spawnUnit: (u) => GS.units.push(u),
          hooks: uiHooks(),
        });
      }
    } else if (msg === 'evacuate') {
      for (const u of GS.units) {
        if (u.team !== 'player' || u.hp <= 0 || u.hp / u.maxHp > RETREAT_HP_RATIO) continue;
        u.fightToDeath = false;
        tryMedicalRetreat(u, { silent: true });
      }
    }
    const remaining = Math.max(0, msgCap - GS.courierMessagesUsedThisWave);
    if (remaining > 0) {
      showMessage(`Courier dispatched: ${def.name} (${remaining} message left this wave)`);
    } else {
      showMessage(`Courier dispatched: ${def.name}`);
    }
    playSfx('deploy');
    ach('courier', { message: msg });
    syncInteractionState({ refreshCounts: msg === 'banner' });
    return true;
  }

  function findPlayerBuildingAt(wx, wy) {
    let best = null;
    let bestDist = Infinity;
    for (const b of GS.buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      const dist = Math.hypot(b.x - wx, b.y - wy);
      const hitR = (b.radius || 20) + 8;
      if (dist <= hitR && dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    return best;
  }

  function findBuildingAt(wx, wy) {
    return findPlayerBuildingAt(wx, wy);
  }

  

  function detachBuildingFromBuilders(b) {
    for (const u of GS.units) {
      if (u.repairTarget?.id === b.id) u.repairTarget = null;
      if (u.combatType !== 'builder' && u.type !== 'builder') continue;
      const cur = u.building;
      if (cur?.id === b.id) {
        u.building = null;
      } else if (cur?.compound && cur.parts?.some((p) => p.id === b.id)) {
        cur.parts = cur.parts.filter((p) => p.id !== b.id);
        if (cur.parts.length === 0) u.building = null;
      } else if (cur?.pending && cur.type === b.type && Math.hypot(cur.x - b.x, cur.y - b.y) < 4) {
        u.building = null;
      }
      if (u.buildQueue?.length) {
        u.buildQueue = u.buildQueue.filter((item) => {
          if (item.id === b.id) return false;
          if (item.pending && item.type === b.type && Math.hypot(item.x - b.x, item.y - b.y) < 4)
            return false;
          return true;
        });
      }
    }
  }

  function cleanupBuildingOccupants(b) {
    if (b.garrisonUnitId) {
      const gu = GS.units.find((u) => u.id === b.garrisonUnitId);
      if (gu) releaseFromGarrison(gu);
    }
    if (b.generalUnitId) {
      const gen = GS.units.find((u) => u.id === b.generalUnitId);
      if (gen) releaseFromKeep(gen);
    }
    if (b.wallSlots) {
      for (const slot of b.wallSlots) {
        if (!slot.unitId) continue;
        const wu = GS.units.find((u) => u.id === slot.unitId);
        if (wu) releaseFromWallGarrison(wu);
        slot.unitId = null;
      }
    }
    if (b.siegeTowerId) {
      const tower = GS.units.find((u) => u.id === b.siegeTowerId);
      if (tower) clearSiegeLink(tower);
    }
    if (b.isMedical) {
      for (const u of GS.units) {
        if (u.retreatingToMed === b.id || u.atMedicalTent === b.id) {
          u.retreatingToMed = null;
          u.atMedicalTent = null;
          u.fightToDeath = false;
        }
      }
    }
  }

  function removeBuildingRecord(b) {
    const idx = GS.buildings.indexOf(b);
    if (idx >= 0) {
      GS.buildings.splice(idx, 1);
      releaseBuildingRecord(b);
    }
  }

  function clearBuildingTargeting(b) {
    const bldKey = `bld:${b.id}`;
    for (const u of GS.units) {
      if (u.structureTargetId === b.id) u.structureTargetId = null;
      if (u.pathTargetId === bldKey) {
        u.pathTargetId = null;
        u.path = [];
        u.pathIndex = 0;
      }
    }
  }

  function isEnemyEconomyStructure(b) {
    if (!b || b.owner !== 'enemy') return false;
    normalizeEnemyEconomyBuilding(b);
    return !!(
      b.isEnemySettlement ||
      b.isHamlet ||
      b.isMerchantGuild ||
      b.isResourceGen ||
      b.type === 'enemy_hamlet' ||
      b.type === 'enemy_merchant_guild' ||
      b.type === 'enemy_trade_outpost' ||
      b.type === 'enemy_quarry'
    );
  }

  function finalizeBuildingDestroyed(b, opts = {}) {
    if (!b || b._destroyed) return false;
    const wasProducer = isUnitProducingBuilding(b);
    const wasEnemyEconomy = isEnemyEconomyStructure(b);
    if (
      b.owner === 'player' &&
      !opts.silent &&
      opts.attacker &&
      typeof isZombieTypeEnemy === 'function' &&
      isZombieTypeEnemy(opts.attacker.type)
    ) {
      ach('zombie_building_lost', {
        buildType: b.type,
        attackerType: opts.attacker.type,
        wave: GS.wave,
      });
    }
    b.hp = 0;
    b._destroyed = true;
    cleanupBuildingOccupants(b);
    detachBuildingFromBuilders(b);
    clearBuildingTargeting(b);
    removeBuildingRecord(b);
    invalidateObstacles();
    if (opts.message) showMessage(opts.message);
    else if (!opts.silent) {
      const name = BuildDefs[b.type]?.name || 'Structure';
      const prefix = b.owner === 'enemy' ? 'Enemy ' : '';
      showMessage(`${prefix}${name} destroyed!`);
    }
    if (!opts.silent && opts.playDeath !== false) playSfx('death');
    if (wasProducer) checkPlayerElimination();
    if (wasEnemyEconomy) {
      GS.structuresRazedThisWave++;
      GS.runStructuresRazed++;
      if (!GS.creativeMode) {
        ach('enemy_structure_razed', {
          buildType: b.type,
          wave: GS.wave,
          runTotal: GS.runStructuresRazed,
        });
      }
      if (svc('FactionReputation')) {
        svc('FactionReputation').onEnemyStructureDestroyed(b, GS.wave, { hooks: { showMessage } });
      }
      if (svc('SettlementRaids')) {
        svc('SettlementRaids').onSettlementDestroyed(b, {
          units: GS.units,
          grantTp: (n) => {
            if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
              GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
              svc('FloatingText').status(b.x, b.y - 8, `+${n} TP`, '#60c0ff');
            }
          },
          grantScience: (n) => {
            if (n > 0 && svc('Research') && svc('Research').grantSciencePoints) {
              svc('Research').grantSciencePoints(n, { showMessage });
              svc('FloatingText').status(b.x, b.y + 10, `+${n} SP`, '#a080ff');
            }
          },
          hooks: {
            showMessage,
            addHighlight,
            floatingText: floatStatus,
          },
        });
      }
      if (svc('PlanetWarfare') && svc('PlanetWarfare').isActive(GS.wave)) {
        const push = svc('PlanetWarfare').onEnemyStructureDestroyed({ wave: GS.wave, worldH: GS.worldH });
        if (push?.delta < -0.02) {
          showMessage(
            `Hostile territory pushed back — control ${Math.round(svc('PlanetWarfare').getControl() * 100)}%.`,
            280
          );
        }
      }
      if (svc('PlanetConquest')) {
        svc('PlanetConquest').onEnemyStructureDestroyed(b, GS.wave, getPlanetConquestCtx());
        checkPlanetConquestVictory();
      }
      if (svc('AsymmetricWarfare')) {
        const lvl = svc('AsymmetricWarfare').onHostStructureDestroyed();
        if (lvl?.delta < 0) {
          showMessage(
            `Host threat recedes — Level ${svc('AsymmetricWarfare').getHostThreatLevel()}.`,
            240
          );
        }
      }
      checkCampaignEconomyVictory();
    }
    return true;
  }

  function demolishBuilding(b) {
    if (!b || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const name = BuildDefs[b.type]?.name || 'Structure';
    const refund = getBuildingRefund(b);
    finalizeBuildingDestroyed(b, { silent: true });
    if (refund > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
      GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + refund);
      svc('FloatingText').status(b.x, b.y - 12, `+${refund} TP`, '#80c0ff');
    }
    svc('Particles').dust(b.x, b.y);
    showMessage(`${name} demolished${refund > 0 ? ` — +${refund} TP refunded` : ''}.`);
    playSfx('click');
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function relocateBuilding(b, wx, wy) {
    if (!b || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const def = BuildDefs[b.type];
    if (!def) return false;
    const pos = clampPos(wx, wy);
    if (isBuildSiteBlocked(pos.x, pos.y, def, b.id)) {
      showMessage('Not enough space here!');
      return false;
    }
    b.x = pos.x;
    b.y = pos.y;
    if (b.type === 'outpost') {
      b.slotX = pos.x;
      b.slotY = pos.y - 14;
    } else if (b.isKeep) {
      b.slotX = pos.x + KEEP_GENERAL_SLOT_DX;
      b.slotY = pos.y + KEEP_GENERAL_SLOT_DY;
    }
    if (b.type === 'wall') {
      ensureWallSlots(b);
      for (let i = 0; i < (b.wallSlots?.length || 0); i++) {
        if (!b.wallSlots[i].unitId) continue;
        const wu = GS.units.find((u) => u.id === b.wallSlots[i].unitId);
        if (!wu) continue;
        wu.x = b.wallSlots[i].slotX;
        wu.y = b.wallSlots[i].slotY;
        wu.targetX = wu.x;
        wu.targetY = wu.y;
        wu.path = [];
        wu.pathIndex = 0;
      }
    }
    if (b.garrisonUnitId) {
      const gu = GS.units.find((u) => u.id === b.garrisonUnitId);
      if (gu) {
        const slot = getOutpostGarrisonSlot(b, gu);
        gu.x = slot.x;
        gu.y = slot.y;
        gu.targetX = slot.x;
        gu.targetY = slot.y;
        gu.path = [];
      }
    }
    if (b.generalUnitId) {
      const gen = GS.units.find((u) => u.id === b.generalUnitId);
      if (gen) {
        const slot = getKeepGeneralSlot(b);
        gen.x = slot.x;
        gen.y = slot.y;
        gen.targetX = slot.x;
        gen.targetY = slot.y;
        gen.path = [];
      }
    }
    invalidateObstacles();
    svc('Particles').dust(pos.x, pos.y);
    showMessage(`${def.name} relocated.`);
    playSfx('deploy');
    syncInteractionState();
    return true;
  }

  function getUnitAt(wx, wy, team = 'player') {
    const hitBonus = svc('UX') ? svc('UX').getHitboxBonus() : 0;
    if (useSpatialQueries()) {
      if (svc('Perf')) svc('Perf').count('spatialQueries');
      const near = spatialScratchQuery(
        wx,
        wy,
        36 + hitBonus,
        (e) => e.kind === 'unit' && e.ref?.team === team
      );
      for (let i = near.length - 1; i >= 0; i--) {
        const u = near[i];
        const sz = (svc('SpriteGen').UNIT_STYLE[u.spriteType] || { size: 9 }).size + 10 + hitBonus;
        if (posDistSq(u.x, u.y, wx, wy) < sz * sz) return u;
      }
      return null;
    }
    for (let i = GS.units.length - 1; i >= 0; i--) {
      const u = GS.units[i];
      if (u.team !== team || u.hp <= 0) continue;
      const sz = (svc('SpriteGen').UNIT_STYLE[u.spriteType] || { size: 9 }).size + 10 + hitBonus;
      if (posDistSq(u.x, u.y, wx, wy) < sz * sz) return u;
    }
    return null;
  }

  function setUnitPath(unit, tx, ty, targetUnit = null, pathOpts = {}) {
    let destX = tx,
      destY = ty;
    if (targetUnit) {
      const slot = getSurroundSlot(unit, targetUnit);
      destX = slot.x;
      destY = slot.y;
    }
    const gfxQ = getGfxQuality();
    const throttle = svc('UpdateThrottle');
    let tier = 'full';
    if (throttle) {
      const throttleCtx =
        GS.updateThrottleCtx || buildUpdateThrottleCtx(GS.units.length, gfxQ);
      tier = throttle.getUnitTier(unit, throttleCtx);
      if (!pathOpts.force && !throttle.shouldPathfind(unit, tier, GS.updateTick)) return false;
    }
    const inView = isInView(unit.x, unit.y, 80, 0);
    const viewOffscreen = !inView;
    if (viewOffscreen && GS.pathfindBudget <= 0) return false;
    if (viewOffscreen) GS.pathfindBudget--;
    if (svc('Perf')) svc('Perf').begin('path');
    const maxNodes = throttle
      ? throttle.offscreenPathMaxNodes(tier)
      : viewOffscreen
        ? 600
        : undefined;
    const pathMaxNodes = tier === 'full' && inView ? undefined : maxNodes;
    const bridge = svc('PathWorkerBridge');
    if (unit.pathPending && !pathOpts.force && !pathOpts.sync) {
      if (svc('Perf')) svc('Perf').end('path');
      return false;
    }
    if (bridge?.shouldAsyncPath(unit, pathOpts)) {
      unit.pathReqId = bridge.requestPath({
        unitId: unit.id,
        profile: svc('Pathfinding').getWalkProfile(unit),
        sx: unit.x,
        sy: unit.y,
        ex: destX,
        ey: destY,
        maxNodes: pathMaxNodes,
      });
      unit.pathPending = true;
      unit.pathWaitTicks = 0;
      unit.path = [];
      unit.pathIndex = 0;
      unit.targetX = destX;
      unit.targetY = destY;
      if (pathOpts.buildingId) {
        unit.pathTargetId = `bld:${pathOpts.buildingId}`;
        unit.structureTargetId = pathOpts.buildingId;
      } else {
        unit.pathTargetId = targetUnit?.id ?? null;
        if (!targetUnit) unit.structureTargetId = null;
      }
      if (svc('Perf')) svc('Perf').end('path');
      return false;
    } else {
      const unitCount = GS.units.length;
      const syncCap = GameRuntime.syncPathCap(unitCount, !!GS.currentHordeWave);
      const playerSyncCap = Math.max(10, Math.min(28, Math.ceil(unitCount / 3)));
      // Hard ceiling even for force/sync — unlimited A* is a common freeze source.
      const hardSyncCap = Math.max(syncCap, playerSyncCap) + (pathOpts.critical ? 8 : 4);
      if (
        !pathOpts.force &&
        !pathOpts.sync &&
        unit.team === 'enemy' &&
        GS.syncPathfindsThisTick >= syncCap
      ) {
        if (svc('Perf')) svc('Perf').end('path');
        return false;
      }
      if (
        !pathOpts.force &&
        !pathOpts.sync &&
        unit.team === 'player' &&
        GS.syncPathfindsThisTick >= playerSyncCap
      ) {
        if (svc('Perf')) svc('Perf').end('path');
        return false;
      }
      if (GS.syncPathfindsThisTick >= hardSyncCap) {
        // Over budget: keep a direct waypoint so units still move without A*.
        unit.path = [{ x: destX, y: destY }];
        unit.pathIndex = 0;
        unit.targetX = destX;
        unit.targetY = destY;
        unit.pathPending = false;
        unit.pathReqId = null;
        if (svc('Perf')) svc('Perf').end('path');
        if (typeof ErrorReporting !== 'undefined') {
          // Throttle: this fires for every over-budget unit each tick. Emit at most
          // once per PATH_BUDGET_WARN_INTERVAL ticks and report how many were folded in.
          if (GS.updateTick - GS.pathBudgetWarnTick >= PATH_BUDGET_WARN_INTERVAL) {
            ErrorReporting.log?.('warn', 'Sync pathfind budget exceeded — direct waypoint', {
              kind: 'path-budget',
              team: unit.team,
              type: unit.type,
              syncPathfindsThisTick: GS.syncPathfindsThisTick,
              hardSyncCap,
              unitCount,
              suppressedSinceLast: GS.pathBudgetWarnSuppressed,
            });
            GS.pathBudgetWarnTick = GS.updateTick;
            GS.pathBudgetWarnSuppressed = 0;
          } else {
            GS.pathBudgetWarnSuppressed++;
          }
        }
        return true;
      }
      GS.syncPathfindsThisTick++;
      // Cap node expansion under load even for force paths.
      const loadCap =
        unitCount > 100 ? 700 : unitCount > 70 ? 1000 : unitCount > 45 ? 1400 : undefined;
      const effectiveMax =
        pathMaxNodes != null
          ? Math.min(pathMaxNodes, loadCap || pathMaxNodes)
          : loadCap;
      unit.path = svc('Pathfinding').findPath(
        unit.x,
        unit.y,
        destX,
        destY,
        unit,
        isTerrainBlockedForPath,
        { maxNodes: effectiveMax }
      );
      unit.pathPending = false;
      unit.pathReqId = null;
      unit.pathWaitTicks = 0;
      if (svc('Perf')) svc('Perf').end('path');
    }
    unit.pathIndex = 0;
    unit.targetX = destX;
    unit.targetY = destY;
    if (pathOpts.buildingId) {
      unit.pathTargetId = `bld:${pathOpts.buildingId}`;
      unit.structureTargetId = pathOpts.buildingId;
    } else {
      unit.pathTargetId = targetUnit?.id ?? null;
      if (!targetUnit) unit.structureTargetId = null;
    }
    unit.pathRecalc = 0;
    unit.pathStuck = 0;
    unit.stillFrames = 0;
    return !!(unit.path?.length);
  }

  function pathToEnemyStructure(unit, bld, opts = {}) {
    if (!bld) return;
    const ap = getBuildingApproachPoint(unit, bld);
    const bldKey = `bld:${bld.id}`;
    const destMoved =
      unit.pathTargetId !== bldKey ||
      Math.hypot(ap.x - (unit.targetX ?? 0), ap.y - (unit.targetY ?? 0)) > 24;
    if (!opts.force && !destMoved && unit.path?.length) return;
    if (!opts.force) {
      unit.structurePathRecalc = (unit.structurePathRecalc || 0) - 1;
      if (unit.structurePathRecalc > 0) return;
      unit.structurePathRecalc = opts.recalcInterval ?? 24;
    }
    setUnitPath(unit, ap.x, ap.y, null, {
      buildingId: bld.id,
      force: !!opts.force,
      sync: !!opts.sync,
    });
  }

  

  function finishManualOrder(unit) {
    if (!unit.manualOrder) return;
    if (unit.combatType === 'healer') {
      unit.manualOrder = false;
      unit.pathRecalc = 0;
      unit.healTargetId = null;
      unit.path = [];
      unit.pathIndex = 0;
      return;
    }
    if (unit.combatType === 'builder') {
      unit.manualOrder = false;
      unit.pathRecalc = 0;
      unit.path = [];
      unit.pathIndex = 0;
      return;
    }
    if (unit.canHunt) {
      if (GS.globalHunt) {
        unit.manualOrder = false;
        unit.huntMode = true;
        unit.path = [];
        unit.pathIndex = 0;
        unit.targetX = null;
        unit.targetY = null;
        unit.pathTargetId = null;
        unit.pathRecalc = 0;
        clearHoldPost(unit);
      } else {
        // Hunt off: destination becomes the assigned hold post (Thronefall station).
        const hx = Number.isFinite(unit.pendingHoldX) ? unit.pendingHoldX : unit.x;
        const hy = Number.isFinite(unit.pendingHoldY) ? unit.pendingHoldY : unit.y;
        enterHoldStance(unit, { x: hx, y: hy, reassign: true });
      }
      return;
    }
    unit.manualOrder = false;
    unit.path = [];
    unit.pathIndex = 0;
  }

  function orderMove(unit, tx, ty, manual = true) {
    const pos = clampPos(tx, ty);
    if (manual && (unit.garrisoned || hasPendingOutpostGarrison(unit))) releaseFromGarrison(unit);
    if (manual && unit.stationedKeep) releaseFromKeep(unit);
    if (manual && (unit.wallGarrisoned || isMarchingToWallSlot(unit)))
      releaseFromWallGarrison(unit);
    if (manual && unit.retreatingToMed) {
      unit.retreatingToMed = null;
      unit.atMedicalTent = null;
      unit.fightToDeath = false;
    }
    if (manual) {
      unit.manualOrder = true;
      unit.huntMode = false;
      // New click assigns a new post on arrival; clear the old station while marching.
      unit.holdX = null;
      unit.holdY = null;
      unit.pendingHoldX = pos.x;
      unit.pendingHoldY = pos.y;
      unit.combatTargetId = null;
      unit.structureTargetId = null;
      unit.pathTargetId = null;
      unit.pathRecalc = 0;
      unit.pathPending = false;
      unit.pathReqId = null;
      unit.pathWaitTicks = 0;
      unit.pinned = false;
      unit.pinTimer = 0;
      // Ready to fire on the first in-range foe while marching (no leftover attack CD).
      unit.actionTimer = 0;
      unit.attackAnimTimer = 0;
      if (unit.combatType === 'healer') {
        unit.healTargetId = null;
      }
      if (unit.combatType === 'builder') {
        unit.repairTarget = null;
      }
    }
    // Sync force path so a click always yields a path even under pathfind budget pressure.
    const ok = setUnitPath(
      unit,
      pos.x,
      pos.y,
      null,
      manual ? { force: true, sync: true, critical: true } : {}
    );
    if (manual && (!ok || !unit.path?.length)) {
      // Last resort: steer-only march so the unit is never completely stuck.
      unit.path = [{ x: pos.x, y: pos.y }];
      unit.pathIndex = 0;
      unit.targetX = pos.x;
      unit.targetY = pos.y;
      unit.pathPending = false;
    }
    GS.moveMarkers.push({ x: pos.x, y: pos.y, life: 150, unitId: unit.id });
  }

  function toggleHunt(unit) {
    if (!unit.canHunt) return;
    if (unit.huntMode) {
      enterHoldStance(unit, { reassign: true });
      showMessage('Hold post — return to station');
    } else {
      unit.huntMode = true;
      unit.manualOrder = false;
      unit.pathRecalc = 0;
      clearHoldPost(unit);
      showMessage('Unit will hunt enemies');
    }
  }

  function toggleGlobalHunt() {
    GS.globalHunt = !GS.globalHunt;
    GS.units
      .filter((u) => u.team === 'player' && u.canHunt)
      .forEach((u) => {
        if (GS.globalHunt) {
          u.huntMode = true;
          u.manualOrder = false;
          u.pathRecalc = 0;
          clearHoldPost(u);
        } else {
          enterHoldStance(u, { reassign: true });
        }
      });
    showMessage(
      GS.globalHunt ? 'All soldiers hunting!' : 'Hold posts set — units return to station'
    );
    syncInteractionState();
  }

  function updateHuntPaths() {
    if (isNightPhase()) return;
    const manyUnits = GS.units.length > 45;
    const crowded = GS.units.length > 80;
    for (const u of GS.units) {
      if (manyUnits && !isInView(u.x, u.y, 120, 0)) continue;
      if (
        u.team !== 'player' ||
        !u.canHunt ||
        !u.huntMode ||
        u.garrisoned ||
        u.wallGarrisoned ||
        hasPendingOutpostGarrison(u) ||
        isMarchingToKeep(u) ||
        isMarchingToWallSlot(u) ||
        u.retreatingToMed ||
        u.demoralized ||
        u.hp <= 0 ||
        u.pinned ||
        u.attackAnimTimer > 0
      )
        continue;
      u.pathRecalc = (u.pathRecalc || 0) - 1;
      if (u.pathRecalc > 0) continue;
      u.pathRecalc = crowded ? 70 : manyUnits ? 58 : 50;
      if (u.manualOrder) continue;

      const seekDist = getEnemyStructureSeekDist(u);
      const bld = findNearestAttackableEnemyBuilding(u, seekDist);
      const foe = findTacticalTarget(u);
      const pursueBld = shouldPrioritizeEnemyStructure(u, foe, bld);

      if (pursueBld && bld) {
        u.combatTargetId = null;
        u.structureTargetId = bld.id;
        if (inBuildingAttackRange(u, bld)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        const bldKey = `bld:${bld.id}`;
        const bldMoved =
          u.pathTargetId !== bldKey ||
          Math.hypot(bld.x - (u.targetX ?? 0), bld.y - (u.targetY ?? 0)) > 35;
        if (!u.path?.length || bldMoved) pathToEnemyStructure(u, bld);
        continue;
      }

      if (foe && isPursuableFoe(u, foe)) {
        u.structureTargetId = null;
        u.combatTargetId = foe.id;
        if (inAttackRange(u, foe)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        if (
          !(foe.team === 'neutral' || foe.isNeutral) &&
          isFullySurrounded(foe, u.team) &&
          !inAttackRange(u, foe)
        ) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        const foeMoved =
          u.pathTargetId !== foe.id ||
          Math.hypot(foe.x - (u.targetX ?? 0), foe.y - (u.targetY ?? 0)) > 30;
        if (!u.path?.length || foeMoved) setUnitPath(u, foe.x, foe.y, foe);
        continue;
      }

      if (u.pathTargetId || u.combatTargetId || u.structureTargetId) {
        releaseCombatPursuit(u, { keepManual: u.manualOrder });
        u.structureTargetId = null;
      }
    }
  }

  function updateStuckRecovery() {
    const crowded = GS.units.length > 70;
    for (const u of GS.units) {
      if (crowded && !isInView(u.x, u.y, 60, 0)) continue;
      if (
        u.hp <= 0 ||
        u.garrisoned ||
        u.wallGarrisoned ||
        hasPendingOutpostGarrison(u) ||
        isMarchingToKeep(u) ||
        isMarchingToWallSlot(u) ||
        u.retreatingToMed ||
        u.siegeDeployed ||
        (u.pinned && !(u.type === 'builder' && builderHasWork(u)))
      )
        continue;
      // Planted on hold post: do not repath or nudge.
      // Returning-to-post still uses stuck recovery so crowds can't pin them off-station.
      if (isHoldPlanted(u)) {
        u.stillFrames = 0;
        u.lastMoveX = u.x;
        u.lastMoveY = u.y;
        continue;
      }
      const moved = Math.hypot(u.x - (u.lastMoveX ?? u.x), u.y - (u.lastMoveY ?? u.y)) > 0.25;
      u.stillFrames = moved ? 0 : (u.stillFrames || 0) + 1;
      u.lastMoveX = u.x;
      u.lastMoveY = u.y;

      // Manual click-to-move recovers sooner so units don't freeze on crowds/props.
      if (u.stillFrames < (u.manualOrder ? 10 : 18)) continue;
      const needsMove = u.path?.length || u.huntMode || u.manualOrder || u.pathTargetId;
      if (!needsMove) continue;

      nudgeUnitFree(u);
      if (u.targetX != null && u.targetY != null) {
        const savedKey = u.pathTargetId;
        if (isBuildingPathTarget(savedKey)) {
          const bld = getBuildingPursuitTarget(u);
          if (bld) pathToEnemyStructure(u, bld);
          else {
            releaseCombatPursuit(u, { keepManual: u.manualOrder });
            retargetIfHunting(u);
          }
        } else {
          const dest = savedKey && savedKey !== 'advance' ? getUnitById(savedKey) : null;
          if (dest && !isPursuableFoe(u, dest)) {
            releaseCombatPursuit(u, { keepManual: u.manualOrder });
            retargetIfHunting(u);
          } else if (dest) setUnitPath(u, u.targetX, u.targetY, dest);
          else {
            setUnitPath(u, u.targetX, u.targetY, null, {
              force: !!u.manualOrder,
              sync: !!u.manualOrder,
            });
            if (savedKey === 'advance') u.pathTargetId = 'advance';
            if (savedKey === 'hold') u.pathTargetId = 'hold';
          }
        }
      }
      u.stillFrames = 0;
      u.pathStuck = 0;
    }
  }

  

  function spawnHamletFortressWalls(hamlet) {
    if (!hamlet?.isHamlet || hamlet.owner !== 'player' || hamlet.hp <= 0) return 0;
    if (hamlet.fortressWallsSpawned) return 0;
    const wallDef = BuildDefs.wall;
    if (!wallDef) return 0;

    const groupId = `hamlet_fort_${hamlet.id}`;
    let placed = 0;
    for (const slot of getHamletFortressWallLayout(hamlet)) {
      if (isBuildSiteBlocked(slot.x, slot.y, wallDef, hamlet.id)) continue;
      const overlapsHamlet =
        Math.hypot(slot.x - hamlet.x, slot.y - hamlet.y) < (hamlet.radius || 55) + 8;
      if (overlapsHamlet) continue;
      const b = createBuilding('wall', slot.x, slot.y, 'player', {
        facing: slot.facing,
        castleGroup: groupId,
      });
      b.complete = true;
      b.buildProgress = wallDef.buildTime || 1;
      b.hamletFortressRing = hamlet.id;
      GS.buildings.push(b);
      onBuildingComplete(b, { hamletFortress: true });
      placed++;
    }

    if (placed > 0) {
      hamlet.fortressWallsSpawned = true;
      invalidateObstacles();
      svc('Particles').dust(hamlet.x, hamlet.y);
      showMessage(
        `Palisade walls raised around ${BuildDefs.hamlet?.name || 'hamlet'} (${placed} segments).`,
        320
      );
    }
    return placed;
  }

  function spawnCastleCompound(cx, cy, builder) {
    const groupId = Math.random().toString(36).slice(2, 9);
    const parts = getCastleCompoundLayout(cx, cy).map((l) => {
      const b = createBuilding(l.type, l.x, l.y, 'player', {
        facing: l.facing,
        castleGroup: groupId,
      });
      GS.buildings.push(b);
      return b;
    });
    invalidateObstacles();
    builder.building = {
      compound: true,
      parts,
      x: cx,
      y: cy,
      buildTime: BuildDefs.castle.buildTime,
      buildProgress: 0,
    };
    showMessage('Erecting castle compound (4 walls, 4 outposts, Keep, med tent, mess hall)...');
    return true;
  }

  function finalizeBuild(type, wx, wy, buildOpts = {}) {
    if (GS.creativeMode && GS.creativeSettings.instantBuild) {
      return creativeInstantPlaceBuilding(type, wx, wy);
    }
    const def = BuildDefs[type];
    const buildCost = GS.creativeMode && GS.creativeSettings.freeResources ? 0 : (def?.cost ?? 0);
    if (!def) {
      showMessage(`Unknown building: ${type}`);
      return false;
    }
    if (GS.tactical < buildCost) {
      showMessage('Not enough TP!');
      return false;
    }
    if (def.requiresBuilders && countLiveBuilders(GS.units) < def.requiresBuilders) {
      showMessage(`Need ${def.requiresBuilders} live Builders on the field!`);
      return false;
    }
    if (svc('Research') && !svc('Research').isBuildUnlocked(type, getResearchOpts())) {
      showMessage(
        'Research this at the Research Lab first — click RESEARCH in the build panel.',
        280
      );
      return false;
    }
    if (def.isWweAcademy) {
      const wweOk =
        (GS.creativeMode && GS.creativeSettings.unlockAll) ||
        svc('MetaProgress').isWweUnlocked() ||
        (svc('Research') && svc('Research').isFactionUnlocked('wwe', getResearchOpts()));
      if (!wweOk) {
        showMessage(
          'Research Arena Warfare Doctrine or join the Iron Creed to unlock the Grand Coliseum!',
          300
        );
        return false;
      }
      const recHamlets = def.recommendedHamlets ?? 2;
      const recGuilds = def.recommendedGuilds ?? 1;
      if (countPlayerHamlets() < recHamlets) {
        showMessage(
          `Grand Coliseum tip: ${recHamlets}+ hamlets recommended (you have ${countPlayerHamlets()}).`,
          300
        );
      } else if (countPlayerGuilds() < recGuilds) {
        showMessage(
          `Grand Coliseum tip: ${recGuilds}+ merchant guilds recommended (you have ${countPlayerGuilds()}).`,
          300
        );
      }
    }
    if (
      def.isCrossoverBarracks &&
      !isVanillaAcademyType(type) &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll)
    ) {
      const factionOk =
        svc('MetaProgress').isCrossoverFactionUnlocked(def.crossoverFaction) ||
        (svc('Research') &&
          svc('Research').isFactionUnlocked(def.crossoverFaction, getResearchOpts()));
      if (!factionOk) {
        showMessage(`Research ${def.name} at the Research Lab (or use a faction cheat code).`, 300);
        return false;
      }
      if (svc('FactionDepth')) {
        const chk = svc('FactionDepth').canBuildBarracks(type, GS.wave, GS.buildings, GS.units);
        if (!chk.ok) {
          showMessage(chk.msg, 300);
          return false;
        }
        if (chk.warn) showMessage(chk.warn, 280);
      }
    }
    if (
      def.isPerkMachine &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('Perks').perkMachinesUnlocked() &&
      !(svc('Research') && svc('Research').isBuildUnlocked(type, getResearchOpts()))
    ) {
      showMessage('Research Tonic Stations Science at the Research Lab first!');
      return false;
    }
    const isAcademyBuild = def?.isAcademy && !def?.isCrossoverBarracks && !def?.isWweAcademy;
    if (
      isAcademyBuild &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !canBuildAcademyType(type, GS.wave, GS.units)
    ) {
      showMessage(
        getAcademyBuildBlockReason(type, GS.wave, GS.units) || 'Cannot build this academy right now.'
      );
      return false;
    }
    let buildX = wx;
    let buildY = wy;
    let excludeBuildId = null;
    if (def.isFortressUpgrade) {
      const site = resolveFortressUpgradeSite(wx, wy, def);
      if (!site) {
        showMessage('Fortress upgrade must be placed on a completed settlement!');
        return false;
      }
      buildX = site.x;
      buildY = site.y;
      excludeBuildId = site.hamlet.id;
    }
    if (isBuildSiteBlocked(buildX, buildY, def, excludeBuildId)) {
      showMessage('Not enough space — settlements need wide ground!');
      return false;
    }

    // Prefer caller-supplied builder (pending march arrival); else nearest free crew.
    const builder =
      buildOpts.builder &&
      buildOpts.builder.team === 'player' &&
      buildOpts.builder.type === 'builder' &&
      buildOpts.builder.hp > 0
        ? buildOpts.builder
        : pickBuilderForJob(buildX, buildY);
    if (!builder) {
      showMessage('Deploy a Builder first (or free a builder under max projects)!');
      return false;
    }
    if (countBuilderProjects(builder) >= BUILDER_MAX_PROJECTS) {
      showMessage(`Builder at max projects (${BUILDER_MAX_PROJECTS})!`);
      return false;
    }

    if (def.settlementWarnBefore && GS.wave < def.settlementWarnBefore) {
      showMessage(
        `Warning: ${def.name} is huge and siegeable — strongly recommended after wave ${def.settlementWarnBefore}!`,
        340
      );
    }

    if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= def.cost;
    // Pending-march completion must not wipe a different build tool the player just armed.
    if (!buildOpts.keepSelection) GS.selectedBuild = null;
    playSfx('buildPlace');

    if (type === 'castle') return spawnCastleCompound(buildX, buildY, builder);

    const wallFacing = type === 'wall' ? buildOpts.facing || GS.pendingWallFacing || 'north' : null;
    const b = createBuilding(
      type,
      buildX,
      buildY,
      'player',
      wallFacing ? { facing: wallFacing } : {}
    );
    GS.buildings.push(b);
    invalidateObstacles();

    if (def.waveBuildTime) {
      showMessage(
        `Founding ${def.name} — completes in ${def.waveBuildTime} waves (${countLiveBuilders(GS.units)} builders labor).`
      );
      syncInteractionState({ refreshCounts: true });
      return true;
    }

    assignBuildingToBuilder(builder, b);
    showMessage(`Erecting ${def.name}...`);
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function placeBuilding(wx, wy) {
    const type = GS.selectedBuild;
    if (!type) return false;
    const bdef = BuildDefs[type];
    if (!bdef) {
      showMessage(`Unknown building: ${type}`);
      return false;
    }
    const buildCost = GS.creativeMode && GS.creativeSettings.freeResources ? 0 : (bdef.cost ?? 0);
    if (GS.tactical < buildCost) {
      showMessage('Not enough TP!');
      return false;
    }
    if (GS.creativeMode && GS.creativeSettings.instantBuild) {
      return finalizeBuild(type, wx, wy);
    }
    if (bdef?.requiresBuilders && countLiveBuilders(GS.units) < bdef.requiresBuilders) {
      showMessage(`Need ${bdef.requiresBuilders} live Builders!`);
      return false;
    }
    const builder = pickBuilderForJob(wx, wy);
    if (!builder) {
      showMessage('Deploy a Builder first (or free a builder under max projects)!');
      return false;
    }
    if (bdef?.isWweAcademy) {
      if (!svc('MetaProgress').isWweUnlocked()) {
        showMessage('Join the Iron Creed first!');
        return false;
      }
      const recHamlets = bdef.recommendedHamlets ?? 2;
      const recGuilds = bdef.recommendedGuilds ?? 1;
      if (countPlayerHamlets() < recHamlets) {
        showMessage(
          `Grand Coliseum tip: ${recHamlets}+ hamlets recommended (you have ${countPlayerHamlets()}).`,
          300
        );
      } else if (countPlayerGuilds() < recGuilds) {
        showMessage(
          `Grand Coliseum tip: ${recGuilds}+ merchant guilds recommended (you have ${countPlayerGuilds()}).`,
          300
        );
      }
    }
    if (bdef?.isCrossoverBarracks && !isVanillaAcademyType(type)) {
      if (!svc('MetaProgress').isCrossoverFactionUnlocked(bdef.crossoverFaction)) {
        showMessage(`Enter the ${bdef.crossoverFaction} cheat code first!`);
        return false;
      }
      if (svc('FactionDepth')) {
        const chk = svc('FactionDepth').canBuildBarracks(type, GS.wave, GS.buildings, GS.units);
        if (!chk.ok) {
          showMessage(chk.msg, 300);
          return false;
        }
        if (chk.warn) showMessage(chk.warn, 280);
      }
    }
    if (bdef?.isPerkMachine && !svc('Perks').perkMachinesUnlocked()) {
      showMessage('Unlock a roster cheat to build Tonic Stations machines!');
      return false;
    }
    const isAcademyBuild = bdef?.isAcademy && !bdef?.isCrossoverBarracks && !bdef?.isWweAcademy;
    if (isAcademyBuild && !canBuildAcademyType(type, GS.wave, GS.units)) {
      showMessage(
        getAcademyBuildBlockReason(type, GS.wave, GS.units) || 'Cannot build this academy right now.'
      );
      return false;
    }
    if (bdef?.settlementWarnBefore && GS.wave < bdef.settlementWarnBefore) {
      showMessage(
        `Caution: build ${bdef.name} after wave ${bdef.settlementWarnBefore} unless you are confident!`,
        300
      );
    }
    const active = countBuilderProjects(builder);
    if (active >= BUILDER_MAX_PROJECTS) {
      showMessage(`Builder at max projects (${BUILDER_MAX_PROJECTS})!`);
      return false;
    }
    if (isBuildSiteBlocked(wx, wy, bdef)) {
      showMessage('Not enough space here!');
      return false;
    }
    if (Math.hypot(builder.x - wx, builder.y - wy) > builder.buildRange) {
      showMessage(`Builder marching to ${bdef.name} site...`);
      builder.manualOrder = false;
      orderMove(builder, wx, wy, false);
      const pending = { type, x: wx, y: wy, pending: true };
      if (type === 'wall') pending.facing = GS.pendingWallFacing;
      assignBuildingToBuilder(builder, pending);
      GS.selectedBuild = null;
      syncInteractionState({ refreshCounts: true });
      return true;
    }
    return finalizeBuild(type, wx, wy, {
      ...(type === 'wall' ? { facing: GS.pendingWallFacing } : {}),
      builder,
    });
  }

  function handleClick(sx, sy, opts = {}) {
    if (GS.state !== 'playing') return false;
    if (GS.paused) {
      // Recover from orphaned strong-pause (macro panels removed / tab glitch).
      if (typeof PacingTools !== 'undefined') {
        const snap = PacingTools.getSnapshot?.({ gameSpeed: 1, paused: true });
        if (snap?.macroPanels?.length || snap?.hiddenPause) {
          PacingTools.clearStrongPause?.();
          setPaused(false, { silent: true, reason: 'macro' });
        }
      }
      if (GS.paused) {
        showMessage('Game is paused — press Space or Esc to resume.', 180, {
          priority: 'critical',
          bypassQueue: true,
        });
        return false;
      }
    }
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    if (wx < 0 || wx > GS.worldW || wy < 0 || wy > GS.worldH + 40) {
      if (GS.selectedDeploy) {
        showMessage('Click inside the battlefield to place the unit.', 180);
      }
      return false;
    }
    const pos = clampPos(wx, wy);

    if (GS.creativeMode && GS.creativeTool === 'spawn_enemy') {
      creativeSpawnEnemyAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_enemy_building') {
      creativeSpawnEnemyBuildingAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_player') {
      creativeSpawnPlayerAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_player_building') {
      creativeSpawnPlayerBuildingAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_squad') {
      creativeSpawnSquadAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool?.startsWith('level_')) {
      if (typeof LevelEditor !== 'undefined') LevelEditor.onMapClick(pos.x, pos.y);
      return ackInteraction(false);
    }

    if (GS.selectedDemolish) {
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target) {
        showMessage('Click one of your completed structures.');
        return false;
      }
      demolishBuilding(target);
      GS.selectedDemolish = false;
      return true;
    }

    if (GS.selectedMoveBuilding) {
      if (GS.moveBuildingTarget) {
        if (relocateBuilding(GS.moveBuildingTarget, pos.x, pos.y)) {
          GS.moveBuildingTarget = null;
          GS.selectedMoveBuilding = false;
        }
        return true;
      }
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target) {
        showMessage('Click a completed structure to move.');
        return false;
      }
      GS.moveBuildingTarget = target;
      showMessage(
        `Moving ${BuildDefs[target.type]?.name || 'structure'} — click destination.`,
        200
      );
      playSfx('click');
      return ackInteraction(false);
    }

    if (GS.selectedRotateWall) {
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target || target.type !== 'wall') {
        showMessage('Click one of your walls.');
        return false;
      }
      rotateWall(target);
      GS.selectedRotateWall = false;
      return true;
    }

    if (GS.selectedDeploy) {
      if (!canDeployUnitType(GS.selectedDeploy)) {
        showMessage('Creative mode — troop deploy disabled in lab settings (Academy Deploy off).');
        return false;
      }
      const def = ensurePlayerUnitDef(GS.selectedDeploy);
      if (!def) {
        showMessage(`Cannot deploy ${GS.selectedDeploy} — unit data missing.`, 260);
        return false;
      }
      if (svc('Research') && !svc('Research').isDeployUnlocked(GS.selectedDeploy, getResearchOpts())) {
        const need =
          GS.selectedDeploy === 'ballista'
            ? 'Research Siege Engineering (Military tree, after Iron Weapons) first!'
            : GS.selectedDeploy === 'bard'
              ? 'Research Morale Arts first!'
              : GS.selectedDeploy === 'scout' || GS.selectedDeploy === 'pikeman'
                ? 'Research Advanced Infantry first!'
                : 'Research this unit at the Research Lab first!';
        showMessage(need, 280);
        return false;
      }
      const costMult = getDeployCostMult();
      const deployCost =
        GS.creativeMode && GS.creativeSettings.freeResources ? 0 : Math.ceil(def.cost * costMult);
      if (GS.tactical < deployCost) {
        showMessage('Not enough TP!');
        return false;
      }
      if (GS.selectedDeploy === 'general' && findPlayerGeneral()) {
        showMessage('You already have a General on the field!');
        return false;
      }
      if (GS.selectedDeploy === 'doomslayer_hero') {
        const doomOk =
          (GS.creativeMode && GS.creativeSettings.unlockAll) ||
          svc('MetaProgress').isDoomslayerHeroUnlocked() ||
          (svc('Research') && svc('Research').isDoomResearchUnlocked(getResearchOpts()));
        if (!doomOk) {
          showMessage(
            'Research Hellgate Containment or survive wave 200 on Doomslayer difficulty!'
          );
          return false;
        }
        if (GS.units.some((u) => u.isDoomslayer && u.hp > 0)) {
          showMessage('The Doomslayer already walks the field!');
          return false;
        }
      }
      const u = spawnUnit(GS.selectedDeploy, pos.x, pos.y, 'player');
      if (!u) {
        showMessage(`Failed to spawn ${def.name || GS.selectedDeploy}.`, 260);
        return false;
      }
      applyPlayerStatMods(u);
      if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
      u.targetY = GS.rallyY;
      u.huntMode = GS.globalHunt && u.canHunt;
      if (u.canHunt && !u.huntMode) {
        u.manualOrder = true;
        u.targetX = u.x;
        u.targetY = u.y;
      }
      GS.units.push(u);
      if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= deployCost;
      playSfx('deploy');
      svc('Particles').dust(pos.x, pos.y);
      ach('deploy', {
        unitType: GS.selectedDeploy,
        armySize: unitCounts.player + 1,
      });
      if (GS.selectedDeploy === 'general' || u.isGeneral) ach('general_fielded', { wave: GS.wave });
      if (svc('Legacy')) svc('Legacy').recordDeploy(GS.selectedDeploy);
      if (typeof FoundationalMedievalLayer !== 'undefined') {
        FoundationalMedievalLayer.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof MartialPathEvolution !== 'undefined') {
        MartialPathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof ArcanePathEvolution !== 'undefined') {
        ArcanePathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof TechPathEvolution !== 'undefined') {
        TechPathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof MythicPathEvolution !== 'undefined') {
        MythicPathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      // Shift-click (or selectSameType): keep deploy mode for rapid multi-place.
      const keepDeploy =
        !!(opts.shiftKey || opts.repeatDeploy || opts.selectSameType) &&
        GS.selectedDeploy !== 'general' &&
        GS.selectedDeploy !== 'doomslayer_hero';
      if (!keepDeploy) {
        GS.selectedDeploy = null;
      } else {
        const nextCost =
          GS.creativeMode && GS.creativeSettings.freeResources ? 0 : Math.ceil(def.cost * costMult);
        if (GS.tactical < nextCost) {
          GS.selectedDeploy = null;
          showMessage('Not enough TP for another — deploy cleared.', 180);
        }
      }
      return ackInteraction(true);
    }

    if (GS.selectedAbility) {
      const abilityId = GS.selectedAbility;
      const ab = Abilities[abilityId];
      const baseCost = ab?.cost ?? 99;
      const abCost =
        GS.creativeMode && GS.creativeSettings.freeResources
          ? 0
          : svc('ContentExpansion') && svc('ContentExpansion').getAbilityCost
            ? svc('ContentExpansion').getAbilityCost(abilityId, baseCost, GS.wave)
            : baseCost;
      if (GS.tactical < abCost) {
        showMessage('Not enough TP!');
        return false;
      }
      // Gate locked strikes BEFORE spending TP (voice shouts, challenge no-reinforce, etc.).
      if (!canUseAbility(abilityId)) return false;

      if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= abCost;
      const cast = useAbility(abilityId, pos.x, pos.y);
      if (!cast) {
        // Refund if cast still failed after gate (defensive).
        if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical += abCost;
        sanitizeTactical();
        return false;
      }
      GS.selectedAbility = null;
      return ackInteraction(true);
    }

    const clickedBuilding = findBuildingAt(pos.x, pos.y);
    if (clickedBuilding?.isWweAcademy && svc('MetaProgress').isWweUnlocked()) {
      WweAcademy.togglePanel();
      playSfx('click');
      return true;
    }
    if (clickedBuilding?.isCrossoverBarracks && isCrossoverBarracksType(clickedBuilding.type)) {
      CrossoverHub.togglePanel(clickedBuilding.crossoverFaction);
      playSfx('click');
      return true;
    }

    const clicked = getUnitAt(pos.x, pos.y);
    if (clicked) {
      if (clicked.team === 'player') {
        clearPlacementModes();
        if (opts.touch) {
          const selected = GS.selectedUnitIds.length
            ? GS.selectedUnitIds
            : GS.selectedUnitId
              ? [GS.selectedUnitId]
              : [];
          if (selected.includes(clicked.id)) {
            if (selected.length === 1) {
              clearSelection();
            } else {
              GS.selectedUnitIds = selected.filter((id) => id !== clicked.id);
              GS.selectedUnitId = GS.selectedUnitIds[GS.selectedUnitIds.length - 1] || null;
            }
          } else {
            GS.selectedUnitId = clicked.id;
            GS.selectedUnitIds = [clicked.id];
          }
        } else if (opts.toggleSelection) {
          if (!GS.selectedUnitIds.length && GS.selectedUnitId) GS.selectedUnitIds = [GS.selectedUnitId];
          if (GS.selectedUnitIds.includes(clicked.id)) {
            GS.selectedUnitIds = GS.selectedUnitIds.filter((id) => id !== clicked.id);
            GS.selectedUnitId = GS.selectedUnitIds.length
              ? GS.selectedUnitIds[GS.selectedUnitIds.length - 1]
              : null;
          } else {
            GS.selectedUnitIds.push(clicked.id);
            GS.selectedUnitId = clicked.id;
          }
        } else if (opts.selectSameType) {
          GS.selectedUnitIds = GS.units
            .filter((u) => u.team === 'player' && u.hp > 0 && u.type === clicked.type)
            .map((u) => u.id);
          GS.selectedUnitId = clicked.id;
          if (GS.selectedUnitIds.length > 1) {
            showMessage(
              `${GS.selectedUnitIds.length} ${clicked.type.replace(/_/g, ' ')}(s) selected.`,
              120
            );
          }
        } else {
          GS.selectedUnitId = clicked.id;
          GS.selectedUnitIds = [clicked.id];
        }
      } else {
        GS.selectedUnitId = clicked.id;
        GS.selectedUnitIds = [];
      }
      if (GS.creativeMode) creativeFillStatEditorFromSelection();
      playSfx('click');
      return ackInteraction(false);
    }

    if (getSelectedUnitIds().length) {
      moveSelectionToWorld(pos.x, pos.y);
      return true;
    }

    if (GS.selectedBuild) {
      return placeBuilding(pos.x, pos.y);
    }

    return false;
  }

  

  

  /** Nearest living player mage for Arcane Dispel range checks. */
  function findNearestPlayerMage(wx, wy) {
    let best = null;
    let bestD = Infinity;
    for (const u of GS.units) {
      if (!isPlayerMageUnit(u)) continue;
      if (u.garrisoned || u.wallGarrisoned || u.stationedKeep) continue;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best ? { mage: best, dist: bestD } : null;
  }

  function countPlayerMages() {
    let n = 0;
    for (const u of GS.units) {
      if (isPlayerMageUnit(u)) n++;
    }
    return n;
  }

  function canUseAbility(ability) {
    if (!ability || !Abilities[ability]) {
      showMessage('Unknown ability.');
      return false;
    }
    if (DRAGON_THEMED_STRIKES.has(ability)) {
      const tesOk =
        (GS.creativeMode && GS.creativeSettings.unlockAll) || svc('MetaProgress').isTesUnlocked();
      if (!tesOk) {
        showMessage(
          'Voice shouts unlock with Voicebound Pact — complete the Wyrmcaller Legacy.',
          300
        );
        return false;
      }
    }
    if (ability === 'reinforce' && svc('GameModes')?.getSession()?.noReinforceStrike) {
      showMessage('Challenge rule: Reinforcements strike disabled!');
      return false;
    }
    if (ability === 'dispel' || Abilities[ability]?.requiresMage) {
      if (countPlayerMages() <= 0) {
        showMessage('Arcane Dispel needs a living Mage on the field!', 260);
        return false;
      }
    }
    return true;
  }

  /** @returns {boolean} true if the ability was cast successfully */
  function useAbility(ability, wx, wy) {
    if (!canUseAbility(ability)) return false;
    if (svc('ContentExpansion') && svc('ContentExpansion').useAbility(ability, wx, wy)) {
      ach('ability', { ability });
      return true;
    }
    const raw = Abilities[ability];
    const ab = typeof scaleAbilityDef === 'function' ? scaleAbilityDef(raw) : raw;
    if (!ab) return false;
    const coolFx = typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2;
    // Validate mage-gated casts before spending achievement / FX budget.
    if (ability === 'dispel') {
      const mageHit = findNearestPlayerMage(wx, wy);
      if (!mageHit?.mage) {
        showMessage('Arcane Dispel needs a living Mage on the field!', 260);
        return false;
      }
      const castRange = Math.max(140, (mageHit.mage.range || 180) * 1.15);
      if (mageHit.dist > castRange) {
        showMessage('Target is out of Mage cast range — move a Mage closer.', 280);
        return false;
      }
    }
    ach('ability', { ability });
    if (ability === 'fireball') {
      playSfx('fireball');
      StrikeFX?.play?.('fireball', wx, wy, ab.radius);
      strikeImpactFx('fireball', wx, wy, ab.radius, coolFx);
      damageInRadius(wx, wy, ab.radius, ab.damage, 'player');
    } else if (ability === 'lightning') {
      playSfx('lightning');
      StrikeFX?.play?.('lightning', wx, wy, ab.radius);
      strikeImpactFx('lightning', wx, wy, ab.radius, coolFx);
      damageInRadius(wx, wy, ab.radius, ab.damage, 'player');
    } else if (ability === 'heal') {
      playSfx('heal');
      StrikeFX?.play?.('heal', wx, wy, ab.radius);
      GS.units
        .filter((u) => u.team === 'player' && Math.hypot(u.x - wx, u.y - wy) < ab.radius)
        .forEach((u) => {
          const healed = Math.min(ab.healAmount, u.maxHp - u.hp);
          u.hp = Math.min(u.maxHp, u.hp + ab.healAmount);
          svc('Particles').heal(u.x, u.y);
          CombatFX?.healPulse(u.x, u.y);
          if (healed > 0) svc('FloatingText').heal(u.x, u.y, healed);
        });
    } else if (ability === 'reinforce') {
      playSfx('reinforce');
      StrikeFX?.play?.('reinforce', wx, wy, 40);
      (ab.units || ['footman', 'footman', 'archer']).forEach((t, i) => {
        const u = spawnUnit(t, 80 + i * 50, GS.deployY, 'player');
        if (!u) return;
        u.targetY = GS.rallyY;
        u.huntMode = GS.globalHunt && u.canHunt;
        if (u.canHunt && !u.huntMode) {
          u.manualOrder = true;
          u.targetX = u.x;
          u.targetY = u.y;
        }
        GS.units.push(u);
      });
    } else if (ability === 'rally') {
      GS.rallyTimer = ab.duration;
      playSfx('reinforce');
      StrikeFX?.play?.('rally', wx, wy, 120);
      GS.units
        .filter((u) => u.team === 'player' && u.hp > 0)
        .forEach((u) => {
          u.morale = Math.min(u.maxMorale, u.morale + ab.moraleBoost);
          u.rallyTimer = ab.duration;
          u.fleeing = false;
          u.demoralized = false;
          u.witnessDeaths = 0;
          if (u.canHunt) applyGlobalHuntState(u);
          svc('FloatingText').status(u.x, u.y, 'RALLY!', '#f0c040');
        });
      showMessage('Battle Rally! All troops inspired!');
    } else if (ability === 'dispel') {
      const mageHit = findNearestPlayerMage(wx, wy);
      const mage = mageHit.mage;
      if (!svc('FactionHazards')?.dispelInRadius) {
        showMessage('Dispel unavailable.');
        return false;
      }
      const before = GS.hazards.length;
      const result = svc('FactionHazards').dispelInRadius(GS.hazards, wx, wy, ab.radius || 85);
      // Always refresh spatial hazard queries after mutate.
      svc('Spatial')?.rebuildHazards?.(GS.hazards);
      // Clean residual hazard debuffs on troops inside the purge.
      for (const u of GS.units) {
        if (u.hp <= 0) continue;
        if (Math.hypot(u.x - wx, u.y - wy) > (ab.radius || 85) + 8) continue;
        if ((u.frostTimer || 0) <= 0) u.hazardSlow = 1;
        u.hazardBurnTick = 0;
        for (const k of Object.keys(u)) {
          if (k.startsWith('hazardTick_')) u[k] = 0;
        }
      }
      mage.attackAnimTimer = Math.max(mage.attackAnimTimer || 0, 18);
      mage.animState = 'attack';
      mage.rotation = Math.round((Math.atan2(wy - mage.y, wx - mage.x) * 180) / Math.PI);
      playSfx('magicCast');
      StrikeFX?.play?.('dispel', wx, wy, ab.radius || 85);
      strikeImpactFx('heal', wx, wy, ab.radius || 85, coolFx * 0.85);
      svc('Particles')?.heal?.(wx, wy);
      svc('FloatingText')?.status?.(wx, wy, 'DISPEL', '#c0a0ff');
      if (result.purged > 0 || GS.hazards.length < before) {
        showMessage(
          `Arcane Dispel — purged ${result.purged || before - GS.hazards.length} blight zone(s)!`,
          260
        );
      } else {
        showMessage('Arcane Dispel washes the ground — no major blights in range.', 220);
      }
    } else {
      return false;
    }
    return true;
  }

  function lineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 24);
    if (steps <= 1) return true;
    const losObs = getLosObstacles();
    if (!losObs.length) return true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x1 + dx * t;
      const sy = y1 + dy * t;
      for (const d of losObs) {
        const r = (d.radius || 14) * 0.85;
        const ox = sx - d.x;
        const oy = sy - d.y;
        if (ox * ox + oy * oy < r * r) return false;
      }
    }
    return true;
  }

  function getLivingPlanetCtx() {
    if (GS.livingPlanetCtxTick === GS.updateTick) return GS.livingPlanetCtxCache;
    const pw =
      svc('PlanetWarfare') && svc('PlanetWarfare').isActive(GS.wave)
        ? cachedSnap('planetWarfare', () =>
            svc('PlanetWarfare').getStateSnapshot(GS.wave, GS.worldW, GS.worldH, GS.buildings, GS.units)
          )
        : null;
    GS.livingPlanetCtxCache = {
      worldW: GS.worldW,
      worldH: GS.worldH,
      baseW: BASE_FIELD_W,
      baseH: BASE_FIELD_H,
      territoryTier: GS.territoryTier,
      wave: GS.wave,
      hostileLineY: pw?.hostileLineY ?? null,
    };
    GS.livingPlanetCtxTick = GS.updateTick;
    return GS.livingPlanetCtxCache;
  }

  function getBiomeModifiersAt(x, y) {
    if (!svc('LivingPlanet')) {
      return {
        biome: 'plains',
        speedMult: 1,
        coverBonus: 0,
        damageTakenMult: 1,
        enemyDamageMult: 1,
      };
    }
    return svc('LivingPlanet').getModifiersAt(x, y, getLivingPlanetCtx());
  }

  function getCoverAt(x, y) {
    let cover = 0;
    for (const o of allObstacles()) {
      const r = o.radius || 14;
      if (posDistSq(x, y, o.x, o.y) < r * r) cover = Math.max(cover, o.cover || 0);
    }
    if (svc('LivingPlanet')) {
      cover = Math.min(0.65, cover + (getBiomeModifiersAt(x, y).coverBonus || 0));
    }
    return cover;
  }

  

  function getWallProtection(unit) {
    if (unit.team !== 'player' || unit.hp <= 0) return 0;
    let best = 0;
    for (const b of GS.buildings) {
      if (b.hp <= 0 || !b.complete || b.type !== 'wall' || !b.wallProtection) continue;
      if (isBehindWall(unit, b)) best = Math.max(best, b.wallProtection);
    }
    if (svc('DynamicMapEvents')) {
      best *= svc('DynamicMapEvents').getActiveMods().wallProtectionMult || 1;
    }
    if (svc('CrownLegacies') && !GS.creativeMode) {
      best += svc('CrownLegacies').getCombinedEffects().wallProtectionBonus || 0;
    }
    if (typeof EternalLegacyTree !== 'undefined' && !GS.creativeMode) {
      best += EternalLegacyTree.getCombinedEffects(null, GS.wave).wallProtectionBonus || 0;
    }
    return best;
  }

  

  

  function isSiegeWave() {
    return !!GS.currentHordeWave?.hasSiege;
  }

  function isHordeWave() {
    return !!GS.currentHordeWave;
  }

  function onBuildingComplete(b, opts = {}) {
    if (!opts.silent && !opts.skipSfx) playSfx('buildComplete');
    if (typeof FoundationalMedievalLayer !== 'undefined' && b?.type) {
      FoundationalMedievalLayer.recordBuild(b.type, GS.wave);
    }
    if (typeof MartialPathEvolution !== 'undefined' && b?.type) {
      MartialPathEvolution.recordBuild(b.type, GS.wave);
    }
    if (typeof ArcanePathEvolution !== 'undefined' && b?.type) {
      ArcanePathEvolution.recordBuild(b.type, GS.wave);
    }
    if (typeof TechPathEvolution !== 'undefined' && b?.type) {
      TechPathEvolution.recordBuild(b.type, GS.wave);
    }
    if (b.type === 'wall' && GS.firstWallWave === null) GS.firstWallWave = GS.wave;
    if (b.type === 'outpost') {
      b.slotX = b.x;
      b.slotY = b.y - 14;
    }
    if (b.isKeep) {
      const slot = getKeepGeneralSlot(b);
      b.slotX = slot.x;
      b.slotY = slot.y;
    }
    if (b.type === 'wall' && b.complete && b.owner === 'player') {
      ensureWallSlots(b);
    }
    if (b.isWweAcademy) {
      showMessage('Grand Coliseum complete! Click it to recruit Champions.', 320);
      svc('FloatingText').status(b.x, b.y - 20, 'GC', '#c04040');
    }
    if (b.isCrossoverBarracks && isCrossoverBarracksType(b.type)) {
      if (svc('GameEvents')) {
        svc('GameEvents').emit(svc('GameEvents').GameEvent.BARRACKS_COMPLETE, { building: b });
      } else if (svc('FactionDepth')) {
        svc('FactionDepth').onBarracksComplete(b);
      } else {
        showMessage(
          `${BuildDefs[b.type]?.name} ready — click to recruit evolved operatives!`,
          300
        );
        svc('FloatingText').status(b.x, b.y - 20, 'CROSSOVER', '#60a0c0');
      }
    }
    if (b.isPerkMachine) {
      showMessage(
        `${BuildDefs[b.type]?.name} installed — heroes collect matching perks at night.`,
        260
      );
    }
    if (b.isResearchLab) {
      syncInteractionState({ refreshCounts: true });
      showMessage(
        'Research Lab online — open RESEARCH to unlock new troops, buildings, and evolved barracks.',
        320
      );
      svc('FloatingText').status(b.x, b.y - 20, 'SCIENCE', '#80c0ff');
    }
    if (svc('ContentExpansion')) svc('ContentExpansion').onBuildingComplete(b);
    ach('building_complete', {
      buildType: b.type,
      wallCount: countPlayerWalls(),
      compound: !!opts.compound,
    });
    if (!opts.skipInvalidate) invalidateObstacles();
  }

  const OUTPOST_GARRISON_ENTER_DIST = 20;
  const OUTPOST_GARRISON_FORCE_DIST = 32;
  const OUTPOST_GARRISON_STUCK_SNAP_TICKS = 90;
  const OUTPOST_GARRISON_STUCK_RELEASE_TICKS = 240;

  function releaseFromGarrison(unit) {
    const op = GS.buildings.find((b) => b.id === unit.garrisoned || b.garrisonUnitId === unit.id);
    if (op?.garrisonUnitId === unit.id) op.garrisonUnitId = null;
    unit.garrisoned = null;
    unit.garrisonMarchRecalc = 0;
    unit.garrisonStuckTicks = 0;
    unit.range = unit.baseRange ?? unit.range;
    if (unit.pathTargetId?.startsWith?.('med:') || unit.retreatingToMed || unit.atMedicalTent) {
      // keep med-tent retreat path intact
    } else if (unit.fleeing || unit.demoralized) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.pathTargetId = null;
      unit.targetX = unit.x;
      unit.targetY = unit.y;
    }
    if (unit.canHunt && !unit.retreatingToMed && !unit.atMedicalTent && !unit.fleeing && !unit.demoralized) {
      applyGlobalHuntState(unit);
    }
  }

  function getPendingOutpost(unit) {
    if (!unit || unit.garrisoned) return null;
    return (
      GS.buildings.find((b) => b.type === 'outpost' && b.complete && b.garrisonUnitId === unit.id) ||
      null
    );
  }

  function hasPendingOutpostGarrison(unit) {
    return !!getPendingOutpost(unit);
  }

  function getOutpostGarrisonSlot(op, unit) {
    const baseX = op.slotX ?? op.x;
    const baseY = op.slotY ?? op.y - 14;
    // Prefer the stored slot when already assigned — avoid per-frame collision scans.
    if (unit?.garrisoned === op.id) {
      return clampPos(baseX, baseY);
    }
    const stub = unit || { team: 'player', combatType: 'ranged' };
    const offsets = [
      [0, 0],
      [0, 10],
      [0, 14],
      [-12, 6],
      [12, 6],
      [-8, 12],
      [8, 12],
      [0, -6],
    ];
    for (const [ox, oy] of offsets) {
      const pos = clampPos(baseX + ox, baseY + oy);
      // Terrain-only: unit soft-block (isBlocked) made keep courtyards unpathable and
      // re-path every frame when mages stacked near outposts — freeze-level thrash.
      if (!isTerrainBlocked(pos.x, pos.y, stub)) return pos;
    }
    return clampPos(baseX, baseY);
  }

  function outpostMarchDistSq(unit, op) {
    const slot = getOutpostGarrisonSlot(op, unit);
    return posDistSq(unit.x, unit.y, slot.x, slot.y);
  }

  function outpostMarchDist(unit, op) {
    return Math.sqrt(outpostMarchDistSq(unit, op));
  }

  

  function completeOutpostGarrison(gu, op, slot) {
    if (shouldReleaseOutpostGarrison(gu)) return;
    gu.x = slot.x;
    gu.y = slot.y;
    gu.path = [];
    gu.pathIndex = 0;
    gu.targetX = slot.x;
    gu.targetY = slot.y;
    gu.pathTargetId = null;
    gu.huntMode = false;
    gu.garrisonStuckTicks = 0;
    gu.garrisonMarchRecalc = 0;
    if (!gu.garrisoned) {
      ach('garrison', { count: unitCounts.garrisonedPlayer + 1 });
    }
    gu.garrisoned = op.id;
    gu.range = getEffectiveRange(gu);
    gu.rotation = -90;
    if (gu.attackAnimTimer <= 0) gu.animState = 'idle';
  }

  function clearSiegeLink(unit) {
    if (!unit.linkedWallId) return;
    const wall = GS.buildings.find((b) => b.id === unit.linkedWallId);
    if (wall?.siegeTowerId === unit.id) wall.siegeTowerId = null;
    unit.siegeDeployed = false;
    unit.linkedWallId = null;
  }

  function findNearestPlayerWall(from) {
    let best = null,
      bestD2 = Infinity;
    for (const b of GS.buildings) {
      if (!b.complete || b.type !== 'wall' || b.siegeTowerId) continue;
      const d2 = posDistSq(b.x, b.y, from.x, from.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = b;
      }
    }
    return best;
  }

  function deploySiege(unit, wall) {
    unit.siegeDeployed = true;
    unit.linkedWallId = wall.id;
    unit.path = [];
    unit.pathIndex = 0;
    wall.siegeTowerId = unit.id;
    unit.x = wall.x;
    unit.y = wall.y - 22;
    showMessage('Enemy siege tower is bridging the wall!');
    playSfx('waveStart');
  }

  

  function isMarchingToOutpost(unit) {
    const op = getPendingOutpost(unit);
    if (!op) return false;
    return outpostMarchDistSq(unit, op) > OUTPOST_GARRISON_ENTER_DIST * OUTPOST_GARRISON_ENTER_DIST;
  }

  function assignToOutpost(unit, op) {
    op.garrisonUnitId = unit.id;
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.combatTargetId = null;
    unit.pathTargetId = null;
    unit.perkTargetId = null;
    unit.pinned = false;
    unit.pinTimer = 0;
    unit.garrisonStuckTicks = 0;
    unit.garrisonMarchRecalc = 30;
    const slot = getOutpostGarrisonSlot(op, unit);
    setUnitPath(unit, slot.x, slot.y, null, { force: true });
  }

  function updateOutposts() {
    for (const op of GS.buildings) {
      if (!op.complete || op.type !== 'outpost') continue;

      if (op.garrisonUnitId) {
        const gu = getUnitById(op.garrisonUnitId);
        if (!gu || gu.hp <= 0) {
          op.garrisonUnitId = null;
          continue;
        }

        if (shouldReleaseOutpostGarrison(gu)) {
          op.garrisonUnitId = null;
          releaseFromGarrison(gu);
          continue;
        }

        if (gu.garrisoned && gu.garrisoned !== op.id) {
          op.garrisonUnitId = null;
          continue;
        }

        // Already manning the tower — pin in place, no path churn.
        if (gu.garrisoned === op.id) {
          const slot = getOutpostGarrisonSlot(op, gu);
          gu.x = slot.x;
          gu.y = slot.y;
          gu.path = [];
          gu.pathIndex = 0;
          gu.huntMode = false;
          gu.garrisonStuckTicks = 0;
          continue;
        }

        const slot = getOutpostGarrisonSlot(op, gu);
        const dist2 = posDistSq(gu.x, gu.y, slot.x, slot.y);
        const enterR2 = OUTPOST_GARRISON_ENTER_DIST * OUTPOST_GARRISON_ENTER_DIST;
        if (dist2 > enterR2) {
          gu.garrisonStuckTicks = (gu.garrisonStuckTicks || 0) + 1;
          gu.huntMode = false;
          gu.garrisonMarchRecalc = (gu.garrisonMarchRecalc || 0) - 1;
          const destMoved = posDistSq(gu.targetX ?? 0, gu.targetY ?? 0, slot.x, slot.y) > 36;
          // Prefer soft path; force only after repeated failure (avoids path-storm freezes).
          if (!gu.path?.length || gu.garrisonMarchRecalc <= 0 || destMoved) {
            gu.garrisonMarchRecalc = 48;
            const forced = (gu.garrisonStuckTicks || 0) > 60;
            setUnitPath(gu, slot.x, slot.y, null, { force: forced });
            if (!gu.path?.length && gu.garrisonStuckTicks > 45) {
              completeOutpostGarrison(gu, op, slot);
              continue;
            }
          }
          if (
            gu.garrisonStuckTicks > OUTPOST_GARRISON_STUCK_SNAP_TICKS &&
            dist2 < OUTPOST_GARRISON_FORCE_DIST * OUTPOST_GARRISON_FORCE_DIST
          ) {
            completeOutpostGarrison(gu, op, slot);
          } else if (gu.garrisonStuckTicks > OUTPOST_GARRISON_STUCK_RELEASE_TICKS) {
            op.garrisonUnitId = null;
            releaseFromGarrison(gu);
            gu.garrisonMarchRecalc = 0;
          }
        } else {
          completeOutpostGarrison(gu, op, slot);
        }
        continue;
      }

      let best = null,
        bestD2 = Infinity;
      const outpostR2 = 102400;
      for (const u of GS.units) {
        if (!isRangedGarrisonCandidate(u)) continue;
        if (GS.buildings.some((b) => b.garrisonUnitId === u.id)) continue;
        const d2 = posDistSq(u.x, u.y, op.x, op.y);
        if (d2 < outpostR2 && d2 < bestD2) {
          bestD2 = d2;
          best = u;
        }
      }
      if (best) assignToOutpost(best, op);
    }
  }

  function releaseFromKeep(unit) {
    const keep = GS.buildings.find((b) => b.id === unit.stationedKeep || b.generalUnitId === unit.id);
    if (keep?.generalUnitId === unit.id) keep.generalUnitId = null;
    unit.stationedKeep = null;
    unit.keepMarchRecalc = 0;
    if (unit.canHunt) applyGlobalHuntState(unit);
  }

  

  function isMarchingToKeep(unit) {
    return GS.buildings.some((b) => b.generalUnitId === unit.id && !unit.stationedKeep);
  }

  function assignToKeep(unit, keep) {
    keep.generalUnitId = unit.id;
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.combatTargetId = null;
    unit.pathTargetId = null;
    const slot = getKeepGeneralSlot(keep);
    setUnitPath(unit, slot.x, slot.y);
  }

  function updateCastleKeeps() {
    for (const keep of GS.buildings) {
      if (!keep.complete || !keep.isKeep) continue;
      if (keep.slotX === keep.x && keep.slotY === keep.y - 14) {
        const slot = getKeepGeneralSlot(keep);
        keep.slotX = slot.x;
        keep.slotY = slot.y;
      }
      const slot = getKeepGeneralSlot(keep);
      const slotX = slot.x;
      const slotY = slot.y;

      if (keep.generalUnitId) {
        const gu = getUnitById(keep.generalUnitId);
        if (!gu || gu.hp <= 0) {
          keep.generalUnitId = null;
          continue;
        }
        if (gu.rallyTargetId) continue;

        if (gu.manualOrder) {
          if (gu.stationedKeep === keep.id) releaseFromKeep(gu);
          keep.generalUnitId = null;
          continue;
        }

        // Already stationed — no path churn.
        if (gu.stationedKeep === keep.id) {
          gu.x = slotX;
          gu.y = slotY;
          gu.path = [];
          gu.pathIndex = 0;
          gu.huntMode = false;
          gu.rotation = -90;
          if (gu.attackAnimTimer <= 0) gu.animState = 'idle';
          continue;
        }

        const dist2 = posDistSq(gu.x, gu.y, slotX, slotY);
        if (dist2 > 64) {
          gu.huntMode = false;
          gu.keepMarchRecalc = (gu.keepMarchRecalc || 0) - 1;
          const destMoved = posDistSq(gu.targetX ?? 0, gu.targetY ?? 0, slotX, slotY) > 16;
          if (!gu.path?.length || gu.keepMarchRecalc <= 0 || destMoved) {
            gu.keepMarchRecalc = 48;
            setUnitPath(gu, slotX, slotY);
            // Snap if courtyard path is blocked (common after walls finish).
            if (!gu.path?.length && dist2 < 120 * 120) {
              gu.x = slotX;
              gu.y = slotY;
              gu.path = [];
              gu.pathIndex = 0;
              gu.stationedKeep = keep.id;
              showMessage('General commands from the Keep — aura active, footmen man the walls!');
              ach('general_stationed', {});
              gu.keepMarchRecalc = 0;
              gu.rotation = -90;
            }
          }
        } else {
          gu.x = slotX;
          gu.y = slotY;
          gu.path = [];
          gu.pathIndex = 0;
          gu.huntMode = false;
          if (!gu.stationedKeep) {
            gu.stationedKeep = keep.id;
            showMessage('General commands from the Keep — aura active, footmen man the walls!');
            ach('general_stationed', {});
          }
          gu.keepMarchRecalc = 0;
          gu.rotation = -90;
          if (gu.attackAnimTimer <= 0) gu.animState = 'idle';
        }
        continue;
      }

      let best = null,
        bestD2 = Infinity;
      const keepR2 = 160000;
      for (const u of GS.units) {
        if (!isGeneralCandidate(u)) continue;
        if (GS.buildings.some((b) => b.generalUnitId === u.id)) continue;
        const d2 = posDistSq(u.x, u.y, keep.x, keep.y);
        if (d2 < keepR2 && d2 < bestD2) {
          bestD2 = d2;
          best = u;
        }
      }
      if (best) assignToKeep(best, keep);
    }
  }

  function getStationedCastleGroup() {
    const gen = getStationedGeneral();
    if (!gen?.stationedKeep) return null;
    const keep = GS.buildings.find((b) => b.id === gen.stationedKeep);
    return keep?.castleGroup || null;
  }

  /** Castle group for wall manning — active once the General is marching to or stationed in a Keep. */
  function getWallManningCastleGroup() {
    const stationed = getStationedCastleGroup();
    if (stationed) return stationed;
    for (const keep of GS.buildings) {
      if (!keep.complete || !keep.isKeep || !keep.castleGroup || !keep.generalUnitId) continue;
      const gu = getUnitById(keep.generalUnitId);
      if (gu && gu.hp > 0 && !gu.manualOrder && !gu.rallyTargetId) return keep.castleGroup;
    }
    return null;
  }

  function getCastleGroupAnchor(groupId) {
    if (GS.castleAnchorTick !== GS.updateTick) {
      castleAnchorCache.clear();
      GS.castleAnchorTick = GS.updateTick;
    }
    if (castleAnchorCache.has(groupId)) return castleAnchorCache.get(groupId);
    let sx = 0,
      sy = 0,
      n = 0;
    for (let i = 0; i < GS.buildings.length; i++) {
      const b = GS.buildings[i];
      if (b.castleGroup !== groupId || !b.complete || b.hp <= 0) continue;
      sx += b.x;
      sy += b.y;
      n++;
    }
    const anchor = n ? { x: sx / n, y: sy / n } : null;
    castleAnchorCache.set(groupId, anchor);
    return anchor;
  }

  function isWallEligibleForManning(wall, groupId) {
    if (!wall || wall.type !== 'wall' || wall.owner !== 'player' || !wall.complete || wall.hp <= 0)
      return false;
    if (wall.castleGroup === groupId) return true;
    if (wall.hamletFortressRing && groupId) return true;
    if (!wall.castleGroup) {
      const anchor = getCastleGroupAnchor(groupId);
      if (!anchor) return false;
      const seek = getWallManningSeekDist();
      return posDistSq(wall.x, wall.y, anchor.x, anchor.y) <= seek * seek;
    }
    return false;
  }

  

  function isInsideCastleBounds(unit, groupId) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    let n = 0;
    for (let i = 0; i < GS.buildings.length; i++) {
      const p = GS.buildings[i];
      if (p.castleGroup !== groupId || !p.complete) continue;
      n++;
      const r = p.radius || 20;
      minX = Math.min(minX, p.x - r);
      maxX = Math.max(maxX, p.x + r);
      minY = Math.min(minY, p.y - r);
      maxY = Math.max(maxY, p.y + r);
    }
    if (!n) return false;
    const pad = 8;
    return (
      unit.x >= minX - pad && unit.x <= maxX + pad && unit.y >= minY - pad && unit.y <= maxY + pad
    );
  }

  function checkCastleCompoundBreaches() {
    if (GS.creativeMode || GS.state !== 'playing' || GS.castleBreachRecorded) return;
    if (typeof isInsideCastleInnerSanctum !== 'function' || !playerHasCastleCompound(GS.buildings)) return;
    const groups = new Set();
    for (const b of GS.buildings) {
      if (b.owner === 'player' && b.castleGroup && b.complete && b.hp > 0) groups.add(b.castleGroup);
    }
    for (const u of GS.units) {
      if (u.team !== 'enemy' || u.hp <= 0) continue;
      for (const gid of groups) {
        if (!isInsideCastleInnerSanctum(u, GS.buildings, gid)) continue;
        GS.castleBreachRecorded = true;
        ach('castle_compound_breach', { groupId: gid, enemyType: u.type, wave: GS.wave });
        if (!GS.castleBreachWarned) {
          GS.castleBreachWarned = true;
          showMessage(
            'Inner keep breached — timeline integrity compromised. First Circle sanctum challenge failed.',
            400
          );
        }
        return;
      }
    }
  }

  function releaseFromWallGarrison(unit) {
    for (const wall of GS.buildings) {
      if (!wall.wallSlots) continue;
      for (const slot of wall.wallSlots) {
        if (slot.unitId === unit.id) slot.unitId = null;
      }
    }
    unit.wallGarrisoned = null;
    unit.wallSlotIndex = null;
    if (unit.canHunt) applyGlobalHuntState(unit);
  }

  function isMarchingToWallSlot(unit) {
    if (unit.wallGarrisoned) return false;
    for (const wall of GS.buildings) {
      if (!wall.wallSlots) continue;
      for (const slot of wall.wallSlots) {
        if (slot.unitId === unit.id) return true;
      }
    }
    return false;
  }

  

  /** How far a footman will volunteer to man an empty castle wall slot (not map-wide). */
  function getWallManningSeekDist() {
    return Math.min(300, Math.max(200, 195 + GS.worldW * 0.055));
  }

  

  

  function footmanCanVolunteerForWall(u, slotX, slotY) {
    if (!isFootmanWallCandidate(u)) return false;
    if (isNightPhase()) return true;
    const foe = findNearestFoeInRange(u);
    return !foeThreatensWallManning(foe, u, slotX, slotY);
  }

  

  function updateWallGarrison() {
    const groupId = getWallManningCastleGroup();
    if (!groupId) {
      for (const u of GS.units) {
        if (u.wallGarrisoned || isMarchingToWallSlot(u)) releaseFromWallGarrison(u);
      }
      return;
    }

    const seekDist = getWallManningSeekDist();
    const seekR2 = seekDist * seekDist;

    for (const wall of GS.buildings) {
      if (!isWallEligibleForManning(wall, groupId)) continue;
      ensureWallSlots(wall);

      for (let si = 0; si < wall.wallSlots.length; si++) {
        const slot = wall.wallSlots[si];

        if (slot.unitId) {
          const fu = getUnitById(slot.unitId);
          if (!fu || fu.hp <= 0) {
            slot.unitId = null;
            continue;
          }

          if (isPlayerMarchingOrder(fu) || fu.retreatingToMed || !isFootmanWallCandidate(fu)) {
            releaseFromWallGarrison(fu);
            slot.unitId = null;
            continue;
          }

          const foe = findNearestFoeInRange(fu);
          if (foeThreatensWallManning(foe, fu, slot.slotX, slot.slotY)) {
            releaseFromWallGarrison(fu);
            slot.unitId = null;
            if (fu.canHunt) applyGlobalHuntState(fu);
            continue;
          }

          const dist2 = posDistSq(fu.x, fu.y, slot.slotX, slot.slotY);
          if (dist2 > 36) {
            fu.huntMode = false;
            fu.manualOrder = false;
            fu.combatTargetId = null;
            fu.structureTargetId = null;
            const destMoved =
              posDistSq(fu.targetX ?? 0, fu.targetY ?? 0, slot.slotX, slot.slotY) > 16;
            fu.pathRecalc = (fu.pathRecalc || 0) - 1;
            if (!fu.path?.length || destMoved || fu.pathRecalc <= 0) {
              fu.pathRecalc = 40;
              setUnitPath(fu, slot.slotX, slot.slotY);
              // Snap onto wall if path fails (crowded courtyard).
              if (!fu.path?.length && dist2 < 80 * 80) {
                fu.x = slot.slotX;
                fu.y = slot.slotY;
                fu.path = [];
                fu.pathIndex = 0;
                fu.wallGarrisoned = wall.id;
                fu.wallSlotIndex = si;
                fu.rotation = wallFacingRotation(wall.facing);
              }
            }
          } else {
            fu.x = slot.slotX;
            fu.y = slot.slotY;
            fu.path = [];
            fu.pathIndex = 0;
            fu.targetX = slot.slotX;
            fu.targetY = slot.slotY;
            fu.huntMode = false;
            fu.manualOrder = false;
            fu.wallGarrisoned = wall.id;
            fu.wallSlotIndex = si;
            fu.rotation = wallFacingRotation(wall.facing);
            if (fu.attackAnimTimer <= 0) fu.animState = 'idle';
          }
          continue;
        }

        let best = null;
        let bestD2 = Infinity;
        for (const u of GS.units) {
          if (!footmanCanVolunteerForWall(u, slot.slotX, slot.slotY)) continue;
          if (u.wallGarrisoned || isMarchingToWallSlot(u)) continue;
          let onOtherSlot = false;
          for (let wi = 0; wi < wall.wallSlots.length; wi++) {
            if (wall.wallSlots[wi].unitId === u.id) {
              onOtherSlot = true;
              break;
            }
          }
          if (onOtherSlot) continue;
          const d2 = posDistSq(u.x, u.y, slot.slotX, slot.slotY);
          if (d2 > seekR2) continue;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = u;
          }
        }
        if (best) {
          slot.unitId = best.id;
          best.huntMode = false;
          best.manualOrder = false;
          best.combatTargetId = null;
          best.structureTargetId = null;
          best.pathTargetId = null;
          best.pathRecalc = 18;
          setUnitPath(best, slot.slotX, slot.slotY);
        }
      }
    }
  }

  

  /** Global search — no distance cap; picks closest completed player med tent. */
  function findNearestMedicalTent(unit) {
    let best = null,
      bestD2 = Infinity;
    for (const b of GS.buildings) {
      if (!isMedicalTentBuilding(b)) continue;
      const d2 = posDistSq(b.x, b.y, unit.x, unit.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = b;
      }
    }
    return best;
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

  function setMedRetreatPath(unit, tent) {
    const slot = getMedicalTentSlot(tent);
    unit.pathTargetId = `med:${tent.id}`;
    unit.structureTargetId = null;
    unit.combatTargetId = null;
    unit.targetX = slot.x;
    unit.targetY = slot.y;
    if (svc('Perf')) svc('Perf').begin('path');
    unit.path = svc('Pathfinding').findPath(
      unit.x,
      unit.y,
      slot.x,
      slot.y,
      unit,
      isTerrainBlockedForPath,
      {
        maxNodes: 2400,
      }
    );
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
      setMedRetreatPath(unit, tent);
    }
    return tent;
  }

  function marchToMedicalTent(unit, tent) {
    const slot = getMedicalTentSlot(tent);
    const dist2 = posDistSq(unit.x, unit.y, slot.x, slot.y);
    if (dist2 <= 100) {
      unit.x = slot.x;
      unit.y = slot.y;
      unit.path = [];
      unit.pathIndex = 0;
      unit.targetX = slot.x;
      unit.targetY = slot.y;
      unit.atMedicalTent = tent.id;
      unit.animState = 'idle';
      return true;
    }
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
    unit.retreatingToMed = null;
    unit.atMedicalTent = null;
    unit.healerFleeing = false;
    unit.fightToDeath = false;
    unit.pathTargetId = null;
    unit.path = [];
    unit.pathIndex = 0;
    unit.healTargetId = null;
    if (unit.canHunt) applyGlobalHuntState(unit);
  }

  function updateMedicalRetreats() {
    for (const unit of GS.units) {
      if (unit.team !== 'player' || unit.hp <= 0) continue;

      if (unit.combatType === 'healer' && unit.healerFleeing && !isBeingTargeted(unit)) {
        releaseHealerMedRetreat(unit);
        svc('FloatingText').status(unit.x, unit.y, 'SAFE', '#80e080');
        continue;
      }

      if (needsMedicalRetreat(unit) && !unit.atMedicalTent && !unit.healerFleeing) {
        tryMedicalRetreat(unit, { silent: !!unit.retreatingToMed });
      }

      if (unit.retreatingToMed && !unit.atMedicalTent) {
        const tent = resolveMedicalRetreatTent(unit);
        if (!tent) {
          unit.retreatingToMed = null;
          unit.fightToDeath = true;
        }
      }

      if (!unit.atMedicalTent) continue;
      const tent = GS.buildings.find((b) => b.id === unit.atMedicalTent && isMedicalTentBuilding(b));
      if (!tent) {
        unit.atMedicalTent = null;
        unit.retreatingToMed = null;
        continue;
      }
      const nightHealMult = isNightPhase() ? 1.55 : 1;
      const healAmt = unit.maxHp * (tent.healRate || 0.14) * 0.04 * nightHealMult;
      if (healAmt > 0.3 && unit.hp < unit.maxHp) {
        const applied = Math.min(healAmt, unit.maxHp - unit.hp);
        unit.hp += applied;
        if (unit.frame === 0) {
          svc('FloatingText').heal(unit.x, unit.y, Math.max(1, Math.round(applied)));
          svc('Particles').heal(unit.x, unit.y);
        }
      }
      const healedEnough = unit.hp / unit.maxHp >= 0.72;
      const healerSafe =
        unit.combatType === 'healer' && unit.healerFleeing && !isBeingTargeted(unit);
      const hpRetreatDone = !unit.healerFleeing && healedEnough;
      if (healerSafe || hpRetreatDone) {
        if (unit.healerFleeing) releaseHealerMedRetreat(unit);
        else {
          unit.retreatingToMed = null;
          unit.atMedicalTent = null;
          unit.fightToDeath = false;
          unit.pathTargetId = null;
          if (unit.canHunt) applyGlobalHuntState(unit);
        }
        svc('FloatingText').status(unit.x, unit.y, 'READY', '#80e080');
      }
    }
  }

  

  function isAttackableEnemyStructure(b) {
    if (!b || b.owner !== 'enemy') return false;
    normalizeEnemyEconomyBuilding(b);
    if (b.hp <= 0) return false;
    return !!(
      b.isEnemySettlement ||
      b.isHamlet ||
      b.isMerchantGuild ||
      b.isResourceGen ||
      (b.isAcademy && b.owner === 'enemy')
    );
  }

  function getEnemyStructureSeekDist(unit) {
    const mapReach = Math.hypot(GS.worldW * 0.92, GS.worldH * 0.88);
    const rtsReach = isEnemyRtsEra(GS.wave) ? GS.worldH * 0.98 : 0;
    if (unit?.huntMode) return Math.max(720, mapReach, rtsReach);
    return Math.max(maxAttackRange(unit) + 200, 480);
  }

  function shouldPrioritizeEnemyStructure(unit, foe, bld) {
    if (!bld || !unit?.huntMode) return !!bld && !foe;
    if (!foe) return true;
    const foeDist = unitDistance(unit, foe);
    const bldDist = Math.hypot(bld.x - unit.x, bld.y - unit.y);
    if (isEnemyRtsEra(GS.wave)) {
      return bldDist <= foeDist * 0.92 || foeDist > 300;
    }
    return bldDist + 120 < foeDist;
  }

  function findNearestAttackableEnemyBuilding(unit, maxDist) {
    if (maxDist == null) maxDist = getEnemyStructureSeekDist(unit);
    let best = null;
    let bestScore = Infinity;
    for (const b of GS.buildings) {
      if (!isAttackableEnemyStructure(b)) continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      if (d > maxDist) continue;
      let score = d;
      if (b.isHamlet) score -= 100;
      if (b.isMerchantGuild) score -= 80;
      if (b.type === 'enemy_trade_outpost' || b.type === 'trade_outpost') score -= 60;
      if (b.type === 'enemy_quarry' || b.type === 'quarry') score -= 45;
      if (b.type === 'enemy_shadow_academy' || b.type === 'enemy_war_academy') score -= 95;
      if (!b.complete) score -= 50;
      if (unit.type === 'sapper' || (unit.siegeMult || 1) >= 2) score -= 70;
      if (svc('FactionDepth') && svc('FactionDepth').isPlanetSiegeSpecialist?.(unit, GS.wave))
        score -= 85;
      if (unit.type === 'ballista') score -= 40;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  

  function getBuildingApproachPoint(unit, b) {
    const hitR =
      typeof getBuildingHitRadius === 'function' ? getBuildingHitRadius(b) : b.radius || 28;
    const dx = unit.x - b.x;
    const dy = unit.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return { x: unit.x, y: unit.y + hitR + 12 };
    const ranged = unit.combatType === 'ranged' || unit.projectile;
    const edgeStand = ranged
      ? getEffectiveRange(unit) * 0.86
      : (unit.meleeRange || unit.range || 28) + 8;
    const reach = Math.max(hitR + 8, hitR + edgeStand - (ranged ? 2 : 5));
    const scale = Math.min(1, reach / dist);
    return { x: b.x + dx * scale, y: b.y + dy * scale };
  }

  

  

  

  function inBuildingAttackRange(unit, b) {
    const edge = structureEdgeDistance(unit, b);
    if (unit.combatType === 'ranged' || unit.projectile) {
      return edge <= getEffectiveRange(unit) * 0.92 + 6;
    }
    const standoff = (unit.meleeRange || unit.range || 28) + 12;
    return edge <= standoff;
  }

  function calcBuildingDamage(unit, b) {
    const planetSiege =
      svc('FactionDepth') && svc('FactionDepth').isPlanetSiegeSpecialist?.(unit, GS.wave);
    const op = planetSiege && svc('FactionDepth').getPlanetWarfareOp?.(unit.wweAbility);
    const siege = unit.type === 'sapper' || (unit.siegeMult || 1) >= 2 || planetSiege;
    let dmg = siege
      ? Math.floor(unit.damage * (unit.siegeMult || op?.siegeMult || 2.5))
      : Math.max(8, Math.floor(unit.damage * 0.42));
    if (unit.combatType === 'ranged' || unit.projectile) dmg = Math.floor(dmg * 0.88);
    if (unit.type === 'ballista') dmg = Math.floor(dmg * 1.35);
    if (b.isHamlet) dmg = Math.floor(dmg * 1.08);
    if (b.isMerchantGuild) dmg = Math.floor(dmg * 1.05);
    if (svc('FactionDepth') && svc('FactionDepth').modifyBuildingDamage) {
      dmg = svc('FactionDepth').modifyBuildingDamage(unit, b, dmg, GS.wave);
    }
    if (svc('StrategyCounterplay')) {
      dmg = svc('StrategyCounterplay').modifyBuildingDamage(unit, b, dmg);
    }
    if (b.owner === 'enemy' && GS.wave < 80) {
      const soften = 0.48 + Math.min(0.42, GS.wave / 115);
      dmg = Math.max(4, Math.floor(dmg * soften));
    }
    return Math.max(4, dmg + Math.floor(Math.random() * 4));
  }

  

  function getBuildingPursuitTarget(unit) {
    if (unit.raidTargetId) {
      const raidBld = GS.buildings.find((x) => x.id === unit.raidTargetId);
      if (isAttackableEnemyStructure(raidBld)) return raidBld;
      unit.raidTargetId = null;
      unit.raidMissionId = null;
    }
    const raw =
      unit.structureTargetId ||
      (isBuildingPathTarget(unit.pathTargetId) ? unit.pathTargetId.slice(4) : null);
    if (!raw) return null;
    const b = GS.buildings.find((x) => x.id === raw);
    return isAttackableEnemyStructure(b) ? b : null;
  }

  function updatePlayerStructureAttack(unit) {
    if (unit.team !== 'player' || unit.hp <= 0) return;
    if (
      unit.combatType === 'builder' ||
      unit.combatType === 'courier' ||
      unit.combatType === 'healer'
    )
      return;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) return;
    if (unit.retreatingToMed || unit.atMedicalTent || unit.pinned || unit.manualOrder) return;
    if (unit.attackAnimTimer > 0) return;

    if (findNearestFoeInRange(unit)) {
      if (!unit.raidTargetId) unit.structureTargetId = null;
      return;
    }

    let target = getBuildingPursuitTarget(unit);
    const seekDist = getEnemyStructureSeekDist(unit);
    if (!target) target = findNearestAttackableEnemyBuilding(unit, seekDist);
    if (!target) return;
    if (!inBuildingAttackRange(unit, target)) {
      if (
        !unit.manualOrder &&
        (unit.huntMode || unit.structureTargetId || unit.raidTargetId)
      ) {
        pathToEnemyStructure(unit, target);
      }
      return;
    }

    unit.structureTargetId = target.id;
    unit.path = [];
    unit.pathIndex = 0;
    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;

    const siege = unit.type === 'sapper' || (unit.siegeMult || 1) >= 2;
    unit.actionTimer = siege ? 42 : unit.combatType === 'ranged' ? 52 : 58;
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    unit.rotation = Math.round((Math.atan2(target.y - unit.y, target.x - unit.x) * 180) / Math.PI);
    const dmg = calcBuildingDamage(unit, target);
    damageBuilding(target, dmg, unit);
    if (svc('FactionDepth') && svc('FactionDepth').onPlanetStructureStrike) {
      svc('FactionDepth').onPlanetStructureStrike(unit, target, dmg, GS.wave);
    }
    if (unit.type === 'sapper') svc('FloatingText').status(target.x, target.y, 'SIEGE!', '#ff8040');
    else if (FactionDepth?.isPlanetSiegeSpecialist?.(unit, GS.wave)) {
      svc('FloatingText').status(target.x, target.y, 'RAZE', '#c0a040');
    }
    // damageBuilding already plays gateHit/impact
  }

  function updateEnemySiege(unit) {
    if (unit.hp <= 0 || unit.pinned || unit.attackAnimTimer > 0) return;
    if (!isEnemySiegeAttacker(unit)) return;

    let best = null,
      bestD = Infinity;
    for (const b of GS.buildings) {
      if (!isSiegeableStructure(b)) continue;
      if (!inEnemyStructureAttackRange(unit, b, { siege: true })) continue;
      let score = structureEdgeDistance(unit, b);
      if (b.isHamlet) score -= 40;
      if (b.isMerchantGuild) score -= 25;
      if (score < bestD) {
        bestD = score;
        best = b;
      }
    }
    if (!best) return;

    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;
    const isTower = unit.type === 'siege_tower' && unit.siegeDeployed;
    const isMonster =
      unit.type === 'iron_colossus' || unit.type === 'boss_karg' || unit.type === 'boss_volk';
    unit.actionTimer = isTower ? 70 : isMonster ? 62 : 55;
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    const dmg = calcEnemySiegeDamage(unit, best);
    damageBuilding(best, dmg, unit);
    // damageBuilding already plays gateHit/impact
  }

  function findNearestSiegeablePlayerStructure(unit, maxDist = 520) {
    let best = null;
    let bestD = Infinity;
    for (const b of GS.buildings) {
      if (!isSiegeableStructure(b)) continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      if (d > maxDist) continue;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  function updateEnemyWallAttack(unit) {
    if (unit.hp <= 0 || unit.pinned || unit.attackAnimTimer > 0) return;
    if (isEnemySiegeAttacker(unit)) return;
    if (unit.combatType === 'healer' || unit.combatType === 'builder') return;

    const general = findPlayerGeneral();
    if (general && inAttackRange(unit, general)) return;
    if (findNearestFoeInRange(unit)) return;

    let best = null,
      bestD = Infinity;
    for (const b of GS.buildings) {
      if (!isSiegeableStructure(b)) continue;
      if (!inEnemyStructureAttackRange(unit, b)) continue;
      const score = structureEdgeDistance(unit, b);
      if (score < bestD) {
        bestD = score;
        best = b;
      }
    }
    if (!best) {
      const seek = findNearestSiegeablePlayerStructure(unit);
      if (
        seek &&
        !unit.path?.length &&
        unit.pathTargetId !== `bld:${seek.id}`
      ) {
        setUnitPath(unit, seek.x, seek.y, null, { buildingId: seek.id, force: true });
        unit.pathTargetId = `bld:${seek.id}`;
      }
      return;
    }

    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;
    unit.actionTimer = unit.type === 'troll' ? 50 : 65;
    unit.animState = 'attack';
    unit.attackAnimTimer = 12;
    let dmg = unit.type === 'troll' ? 22 : unit.type === 'berserker' ? 18 : 12;
    if (best.isHamlet) dmg = Math.floor(dmg * 1.4);
    if (best.isMerchantGuild) dmg = Math.floor(dmg * 1.2);
    damageBuilding(best, dmg, unit);
    playSfx('swordHit');
  }

  function updateSiegeTower(unit) {
    if (unit.type !== 'siege_tower' || unit.hp <= 0) return false;

    if (unit.siegeDeployed) {
      unit.animState = 'idle';
      const wall = GS.buildings.find((b) => b.id === unit.linkedWallId && b.hp > 0);
      if (!wall) clearSiegeLink(unit);
      return true;
    }

    const wall = findNearestPlayerWall(unit);
    if (!wall) return false;

    const dist = Math.hypot(wall.x - unit.x, wall.y - unit.y);
    if (dist <= 48) {
      deploySiege(unit, wall);
      return true;
    }

    unit.pathRecalc = (unit.pathRecalc || 0) - 1;
    if (unit.pathRecalc <= 0) {
      unit.pathRecalc = 35;
      setUnitPath(unit, wall.x, wall.y - 18);
    }
    if (!unit.pinned && unit.attackAnimTimer <= 0) followPath(unit);
    return true;
  }

  function findNearestFoeInRange(unit) {
    const maxR = maxAttackRange(unit) + (isMeleeCombat(unit) ? 4 : 0);
    if (maxR <= 0) return null;
    let best = null;
    let bestD = Infinity;
    let foes;
    if (useSpatialQueries()) {
      svc('Spatial').queryRadiusInto(
        unit.x,
        unit.y,
        maxR,
        (e) => e.kind === 'unit' && e.ref?.team !== unit.team && e.ref?.hp > 0 && !e.ref?.fleeing,
        svc('Spatial')._scratch
      );
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
    if (unit.isWwe && unit.wweAbility === '619' && Math.random() < 0.35) {
      svc('FloatingText').status(unit.x, unit.y, 'DODGE', '#80c0ff');
      return 0;
    }
    if (unit.isWwe && unit.wweAbility === 'attitude' && unit.hp / unit.maxHp < 0.5) amount *= 0.55;
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

    if (showNums) svc('FloatingText').damage(unit.x, unit.y, actual, crit);
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
    if (!nonCombat && Math.random() * 100 > unit.morale + (unit.rallyTimer > 0 ? 15 : 0)) {
      unit.pinned = true;
      unit.pinTimer = 50;
    }
    if (unit.hp <= 0) {
      unit.hp = 0;
      let quickRevived = false;
      playSfx('death');
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
            svc('FloatingText')?.status?.(
              unit.x,
              unit.y - 22,
              streakInfo.label,
              '#ff9060'
            );
          }
        }
        if (svc('GameEvents')) {
          svc('GameEvents').emit(svc('GameEvents').GameEvent.ENEMY_SLAIN, { unit, wave: GS.wave });
        }
        if (killer) {
          killer.experience = (killer.experience || 0) + 2;
          if (svc('Legacy')) svc('Legacy').recordKill(killer.type, unit.type);
          if (typeof FoundationalMedievalLayer !== 'undefined') {
            FoundationalMedievalLayer.recordKill(killer.type, GS.wave);
          }
          notifyVetStarEvent(killer, addVetStar(killer));
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
          });
        } else {
          ach('kill', { enemyType: unit.type, elite: isEliteEnemy(unit) });
        }
        if (unit.isPlanetBoss) {
          const playerAlive = GS.units.filter(
            (u) => u.team === 'player' && u.hp > 0 && !u.garrisoned
          );
          const kiSnap = sampleKiEnergyArmy(playerAlive);
          if (GS.wave >= PLANET_THREAT_MIN_WAVE && kiSnap?.high) {
            ach('planet_boss_ki_stand', { wave: GS.wave, bossType: unit.type, ...kiSnap });
            showMessage(
              'Power overwhelming — ki warriors shield the planet as the Worldheart shatters!',
              380
            );
          }
        }
        if (isMajorBossUnit(unit)) {
          const dragonKill = checkDragonThemedBossKill(killer, unit);
          if (dragonKill) {
            ach('dragon_boss_slay', dragonKill);
            showMessage(
              `By Voice and dragon-fire — ${dragonKill.bossName} falls to the Wyrmcaller legacy!`,
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
        GS.runPlayerDeaths++;
        GS.playerCasualtiesThisWave++;
        if (typeof GameFeedback !== 'undefined') GameFeedback.onPlayerDeath();
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
        if (svc('VisualPolish')) svc('VisualPolish').registerDeath(unit);
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
    for (const u of GS.units) {
      if (u.team === team || u.hp <= 0) continue;
      const d2 = posDistSq(u.x, u.y, x, y);
      if (d2 < radius2) {
        const dist = Math.sqrt(d2);
        takeDamage(u, damage * (1 - (dist / radius) * 0.5), opts);
      }
    }
  }

  function doomslayerDamage(target) {
    if (GS.wave >= 1001) return calcDamage({ damage: 120, type: 'melee' }, target, 0);
    return Math.max(target.hp, target.maxHp * 0.95);
  }

  function updateDoomslayerAI(unit) {
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
        if (unitDistSq(unit, e) < ripR2) takeDamage(e, doomslayerDamage(e), { crit: true });
      }
      svc('FloatingText').status(unit.x, unit.y, 'RIP & TEAR', '#ff4040');
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
          takeDamage(e, doomslayerDamage(e));
          cleaveHits++;
        }
      }
    }
    if (unit.doomAbilityCd > 0) unit.doomAbilityCd--;
    if (unit.doomProtectCd > 0) unit.doomProtectCd--;
    if (unit.doomCleaveCd > 0) unit.doomCleaveCd--;
  }

  function applyCrossoverOnHit(unit, target, dmg) {
    if (!unit.isCrossover) return;
    const cDef = typeof getCrossoverDef === 'function' ? getCrossoverDef(unit.type) : null;
    if (cDef?.faction)
      ach('crossover_ability', {
        unitType: unit.type,
        faction: cDef.faction,
        ability: cDef.ability,
      });
    if (svc('FactionDepth')) svc('FactionDepth').processAbilityHit(unit, target, dmg);
  }

  

  function applyWweOnHit(unit, target, dmg) {
    if (!unit.isWwe) return;
    ach('crossover_ability', {
      unitType: unit.type,
      faction: 'wwe',
      ability: unit.wweAbility,
    });
    if (svc('FactionDepth')) svc('FactionDepth').processAbilityHit(unit, target, dmg);
  }

  function fireWeapon(unit, target) {
    const dist = unitDistance(unit, target);
    if (!inAttackRange(unit, target)) return;

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
        const dmg = unit.isDoomslayer ? doomslayerDamage(target) : calcDamage(unit, target, 12);
        takeDamage(target, dmg, {
          crit: unit.isDoomslayer,
          attackerTeam: unit.team,
          attacker: unit,
        });
        applyWweOnHit(unit, target, dmg);
        applyCrossoverOnHit(unit, target, dmg);
        if (unit.hasElementalPop)
          svc('Perks').applyElementalPopSplash(unit, target, GS.units, takeDamage);
        if (unit.hasDoubleTap && target.hp > 0 && Math.random() < 0.45) {
          takeDamage(target, Math.round(dmg * 0.55), {
            attackerTeam: unit.team,
            attacker: unit,
          });
        }
        if (unit.combatType === 'cavalry') unit.chargeTimer = 0;
        if (unit.type === 'sapper' && (target.type === 'siege_tower' || target.siegeDeployed)) {
          svc('FloatingText').status(target.x, target.y, 'SIEGE!', '#ff8040');
        }
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
      unit.projectile === 'arrow'
        ? playSfx('arrowShoot')
        : playSfx('magicCast');
    } else if (isMeleeCombat(unit) && dist <= unit.meleeRange && Math.random() * 100 <= hit) {
      CombatFX.meleeSlash(fx, fy, unit.rotation);
      takeDamage(target, calcDamage(unit, target, 10), {
        attackerTeam: unit.team,
        attacker: unit,
      });
      // Hit audio handled in takeDamage
    }
  }

  function followPath(unit) {
    // Hold posts are driven by updateHoldPosts (plant / return-to-station).
    if (isHoldStance(unit)) return;
    const pathTgt = getPursuitTarget(unit);
    if (pathTgt && !isPursuableFoe(unit, pathTgt)) {
      releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
      retargetIfHunting(unit);
      return;
    }
    if (isBuildingPathTarget(unit.pathTargetId) && !getBuildingPursuitTarget(unit)) {
      releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
      retargetIfHunting(unit);
      return;
    }
    if (manualMoveReached(unit)) {
      unit.path = [];
      unit.pathIndex = 0;
      finishManualOrder(unit);
      return;
    }
    const onBuilderJob = unit.type === 'builder' && builderHasWork(unit);
    if (!unit.path?.length || unit.pathIndex >= unit.path.length) {
      if (unit.manualOrder && unit.targetX != null && unit.targetY != null && !manualMoveReached(unit)) {
        setUnitPath(unit, unit.targetX, unit.targetY, null, { force: true, sync: true });
        // Always keep a direct waypoint so failed pathfind never cancels the order mid-map.
        if (!unit.path?.length) {
          unit.path = [{ x: unit.targetX, y: unit.targetY }];
          unit.pathIndex = 0;
        }
        // Try an immediate step this frame so the unit never idles for a tick.
        if (steerToward(unit, unit.targetX, unit.targetY)) {
          unit.animState = 'walk';
          return;
        }
        unit.animState = 'walk';
        return;
      }
      // Hunt / structure chase: repath instead of idling with a destination still set.
      if (
        !unit.manualOrder &&
        unit.targetX != null &&
        unit.targetY != null &&
        (unit.structureTargetId ||
          unit.huntMode ||
          unit.pathTargetId === 'advance' ||
          (unit.pathTargetId && !isBuildingPathTarget(unit.pathTargetId)))
      ) {
        if (isBuildingPathTarget(unit.pathTargetId) || unit.structureTargetId) {
          const bld = getBuildingPursuitTarget(unit);
          if (bld && !inBuildingAttackRange(unit, bld)) {
            pathToEnemyStructure(unit, bld, { force: true, sync: true, recalcInterval: 0 });
            if (!unit.path?.length) {
              unit.path = [{ x: unit.targetX, y: unit.targetY }];
              unit.pathIndex = 0;
            }
            if (steerToward(unit, unit.targetX, unit.targetY)) {
              unit.animState = 'walk';
              return;
            }
            unit.animState = 'walk';
            return;
          }
          // In siege range — let updatePlayerStructureAttack fire; stay idle.
          unit.animState = 'idle';
          return;
        }
        const dest =
          unit.pathTargetId && unit.pathTargetId !== 'advance'
            ? getUnitById(unit.pathTargetId)
            : null;
        if (dest && inAttackRange(unit, dest)) {
          unit.animState = 'idle';
          return;
        }
        setUnitPath(unit, unit.targetX, unit.targetY, dest, { force: true, sync: true });
        if (!unit.path?.length) {
          unit.path = [{ x: unit.targetX, y: unit.targetY }];
          unit.pathIndex = 0;
        }
        if (steerToward(unit, unit.targetX, unit.targetY)) {
          unit.animState = 'walk';
          return;
        }
        unit.animState = 'walk';
        return;
      }
      unit.animState = 'idle';
      if (!onBuilderJob) finishManualOrder(unit);
      return;
    }

    while (unit.pathIndex < unit.path.length) {
      const wp = unit.path[unit.pathIndex];
      if (Math.hypot(wp.x - unit.x, wp.y - unit.y) >= 3) break;
      unit.pathIndex++;
    }

    if (unit.pathIndex >= unit.path.length) {
      if (unit.manualOrder && unit.targetX != null && unit.targetY != null && !manualMoveReached(unit)) {
        unit.path = [{ x: unit.targetX, y: unit.targetY }];
        unit.pathIndex = 0;
        if (steerToward(unit, unit.targetX, unit.targetY)) {
          unit.animState = 'walk';
          return;
        }
        unit.animState = 'walk';
        return;
      }
      unit.animState = 'idle';
      if (!onBuilderJob) finishManualOrder(unit);
      return;
    }

    const wp = unit.path[unit.pathIndex];
    const dx = wp.x - unit.x,
      dy = wp.y - unit.y;
    unit.rotation = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

    if (steerToward(unit, wp.x, wp.y)) {
      unit.animState = 'walk';
      unit.pathStuck = 0;
      return;
    }

    // Manual march: if waypoint is jammed (prop/crowd), keep walking toward final click.
    if (unit.manualOrder && unit.targetX != null && unit.targetY != null) {
      if (steerToward(unit, unit.targetX, unit.targetY)) {
        unit.animState = 'walk';
        unit.pathStuck = 0;
        return;
      }
    }

    unit.pathStuck = (unit.pathStuck || 0) + 1;
    unit.animState = unit.pathStuck > 1 ? 'idle' : 'walk';
    if (unit.pathStuck > 2) nudgeUnitFree(unit);
    if (unit.pathStuck > 3) {
      unit.pathStuck = 0;
      unit.pathIndex = Math.min(unit.pathIndex + 1, unit.path.length);
      if (unit.targetX != null) {
        const dest =
          unit.pathTargetId && unit.pathTargetId !== 'advance'
            ? isBuildingPathTarget(unit.pathTargetId)
              ? null
              : getUnitById(unit.pathTargetId)
            : null;
        if (isBuildingPathTarget(unit.pathTargetId)) {
          const bld = getBuildingPursuitTarget(unit);
          if (bld) pathToEnemyStructure(unit, bld);
          else setUnitPath(unit, unit.targetX, unit.targetY, null, { force: true, sync: !!unit.manualOrder });
        } else {
          setUnitPath(unit, unit.targetX, unit.targetY, dest, {
            force: true,
            sync: !!unit.manualOrder,
          });
        }
      }
    }
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
        if (typeof isSpecialistLateAbilityUnlocked === 'function' && isSpecialistLateAbilityUnlocked(unit)) {
          const repairDef =
            typeof SPECIALIST_LATE_ABILITIES !== 'undefined'
              ? SPECIALIST_LATE_ABILITIES.rapid_repair
              : null;
          const cool = typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2;
          const chance = repairDef?.procChance ?? 0.02 * cool;
          const patchFrac = repairDef?.patchHpFrac ?? 0.08 * cool;
          if (Math.random() < chance) {
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
      onBuildingComplete(b);
      invalidateObstacles();
      unit.building = null;
      showMessage(`${BuildDefs[b.type].name} complete!`);
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
    if (unit.retreatingToMed || unit.atMedicalTent) return;
    if (isMarchingToOutpost(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit)) return;

    if (unit.pinned) {
      unit.pinTimer--;
      if (unit.pinTimer <= 0) unit.pinned = false;
      return;
    }

    if (unit.combatType === 'healer') return;

    // Manual click-to-move / hold post: fire at targets in range, never chase off station.
    // Hold posts return via updateHoldPosts; combat must not repath them away.
    if (unit.manualOrder || isHoldStance(unit)) {
      // Prefer enemies in range from the assigned post when planted.
      const foe = findCombatTarget(unit);
      if (foe && isPursuableFoe(unit, foe) && inAttackRange(unit, foe)) {
        unit.combatTargetId = foe.id;
        unit.actionTimer = (unit.actionTimer || 0) - 1;
        if (unit.actionTimer <= 0 && unit.attackAnimTimer <= 0) {
          fireWeapon(unit, foe);
          const baseCd = 90 - (unit.experience || 0) * 4 + Math.floor(Math.random() * 20);
          unit.actionTimer = Math.max(12, Math.floor(baseCd / (unit.attackSpeedMult || 1)));
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
        const baseCd = 90 - (unit.experience || 0) * 4 + Math.floor(Math.random() * 20);
        unit.actionTimer = Math.max(12, Math.floor(baseCd / (unit.attackSpeedMult || 1)));
      }
      return;
    }

    unit.actionTimer--;
    if (unit.actionTimer > 0) return;

    unit.combatTargetId = target.id;

    const fightingNeutral = target.team === 'neutral' || target.isNeutral;
    // Neutrals near map edges: always close in (surround logic false-positives on borders).
    if (
      isFullySurrounded(target, unit.team) &&
      unit.team === 'player' &&
      !fightingNeutral
    ) {
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

  function updateEnemyAI(unit) {
    if (unit.hp <= 0) return;
    if (svc('ContentExpansion') && svc('ContentExpansion').updateEnemyAI(unit)) return;
    if (unit.type === 'siege_tower' && updateSiegeTower(unit)) return;
    if (unit.combatType === 'healer' || unit.combatType === 'builder') return;
    if (unit.pinned) return;

    const foeInRange = findNearestFoeInRange(unit);
    if (foeInRange) {
      unit.combatTargetId = foeInRange.id;
      if (inAttackRange(unit, foeInRange)) {
        unit.path = [];
        unit.pathIndex = 0;
        unit.animState = 'idle';
        return;
      }
    }

    if (!foeInRange && unit.attackAnimTimer <= 0) {
      const siegeScanR = (unit.meleeRange || MELEE_STANDOFF) + getBuildingHitRadius({ radius: 30 }) + 48;
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

    if (unit.type === 'goblin_engineer') {
      if (Math.random() < 0.004) {
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
      const adv = getEnemyAdvancePoint(unit);
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
        ? throttle.getUnitTier(unit, GS.updateThrottleCtx || buildUpdateThrottleCtx(GS.units.length, gfxQ))
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

  function updateDayNightCycle() {
    if (GS.state !== 'playing') return;
    updateWweLanternAura();
    if (isDayPhase() && GS.spawnQueue.length > 0) {
      GS.spawnTimer--;
      if (GS.spawnTimer <= 0) {
        const type = GS.spawnQueue.shift();
        let side = nextEnemySpawnSide(type);
        if (svc('MonsterBosses') && GS.namedBossWave) {
          if (type === GS.namedBossWave.type) {
            const packSide = svc('MonsterBosses').getPackDef(GS.namedBossWave.type)?.spawnSide;
            if (packSide && getWaveAttackSides().includes(packSide)) side = packSide;
          } else if (svc('MonsterBosses').isPackMinion(type)) {
            const packSide = svc('MonsterBosses').getPackDef(GS.namedBossWave.type)?.spawnSide;
            if (packSide && getWaveAttackSides().includes(packSide)) side = packSide;
          }
        }
        const pos = spawnPosForSide(side);
        const u = spawnUnit(type, pos.x, pos.y, 'enemy', { spawnSide: side });
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
        GS.units.push(u);
        const baseInterval =
          GS.creativeMode && GS.creativeCustomWave?.interval
            ? GS.creativeCustomWave.interval
            : cfg.interval || 90;
        const hordeMult = GS.currentHordeWave?.intervalMult || 1;
        const colonyInterval = GS.colonyThreatMods?.intervalMult || 1;
        const planetInterval =
          svc('PlanetWarfare') && svc('PlanetWarfare').isActive(GS.wave)
            ? svc('PlanetWarfare').getSpawnIntervalMult()
            : 1;
        const asymInterval = getAsymmetricMods().enemyIntervalMult || 1;
        GS.spawnTimer = Math.max(
          8,
          Math.floor(
            baseInterval *
              (GS.creativeMode ? 1 : diff.spawnIntervalMult) *
              hordeMult *
              colonyInterval *
              planetInterval *
              asymInterval
          ) + Math.floor(Math.random() * (GS.currentHordeWave ? 10 : GS.creativeMode ? 8 : 20))
        );
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

  function updatePerkCollectionLocal() {
    if (!isNightPhase() || !svc('Perks') || !svc('Perks').perkMachinesUnlocked()) return;
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
    GS.updateTick++;
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
      const sceneLod = svc('SpriteLod')
        ? svc('SpriteLod').getSceneLod(unitCount, gfxQ)
        : 0;
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
    if (svc('PlanetConquest') && svc('PlanetConquest').isActive(GS.wave, getRunModeId())) {
      const bossTick = svc('PlanetConquest').tickPlanetBoss(GS.wave, getPlanetConquestCtx());
      if (bossTick?.slain) checkPlanetConquestVictory();
    }
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
          GS.hazards.length < 4 ||
          u.team === 'player' ||
          GS.updateTick % 2 === hazardPhase;
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

    const throttleCtx = svc('UpdateThrottle')
      ? buildUpdateThrottleCtx(unitCount, gfxQ)
      : null;

    markUpdatePhase('terrain-nudge');
    for (const unit of GS.units) {
      if (unit.hp <= 0) continue;
      if (GS.units.length > 40 && !isInView(unit.x, unit.y, 50, 0)) continue;
      if (isTerrainBlocked(unit.x, unit.y, unit)) nudgeUnitFree(unit);
    }

    markUpdatePhase('unit-ai', String(GS.units.length));
    for (const unit of GS.units) {
      if (unit.hp <= 0) continue;
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
          } else if (
            !unit.path?.length ||
            (unit.pathPending && (unit.pathWaitTicks || 0) >= 10)
          ) {
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
      if (unit.isDoomslayer) updateDoomslayerAI(unit);

      if (unit.combatType === 'healer') {
        if (!unit.pinned && unit.attackAnimTimer <= 0) followPath(unit);
        updateHealer(unit);
        if (unit.team === 'enemy') updateUnitCombat(unit);
      } else if (unit.team === 'player') {
        updateBuilder(unit);
        const onRallyMission = unit.isGeneral && unit.rallyTargetId;
        // Garrisoned / keep / wall: fire only (no path thrash) — but honor manual move orders.
        if (
          (unit.garrisoned || unit.stationedKeep || unit.wallGarrisoned) &&
          !unit.manualOrder
        ) {
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
          svc('Particles').trail(p.x, p.y, p.type === 'arrow' ? '#8a6030' : '#a060ff');
        }
        if (dist < p.speed) {
          const hit = getUnitById(p.targetId);
          const shooter = p.sourceId ? getUnitById(p.sourceId) : null;
          const projHit =
            p.team === 'enemy' && shooter
              ? Math.max(4, p.accuracy - getSightPenaltyForUnit(shooter))
              : p.accuracy;
          if (hit?.hp > 0 && Math.random() * 100 <= projHit) {
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
              applyWweOnHit(shooter, hit, dmg);
              applyCrossoverOnHit(shooter, hit, dmg);
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
    updateHoldPosts();
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
      svc('Research').tick({ buildings: GS.buildings, isNight: isNightPhase(), showMessage });
      if (svc('UX')) svc('UX').onResearchTick?.();
    }
    checkPlayerElimination();
  }

  /** Visual/presentation tick — runs every frame, separate from simulation logic. */
  function updatePresentation() {
    if (GS.state !== 'playing') return;
    if (typeof PacingTools !== 'undefined') {
      PacingTools.tick({
        paused: GS.paused,
        directShow: directShowMessage,
      });
    }
    const gsPanelOpen = svc('GrandStrategy')?.isPanelOpen?.();
    const igPanelOpen = svc('IntergalacticLayer')?.isPanelOpen?.();
    const gsActive = svc('GrandStrategy')?.isActive?.(GS.wave);
    const igActive = svc('IntergalacticLayer')?.isActive?.(GS.wave);
    if (gsPanelOpen || igPanelOpen) {
      GS.macroPanelRenderTick++;
      const renderMacroPanels = GS.macroPanelRenderTick % MACRO_PANEL_RENDER_EVERY === 0;
      if (svc('GrandStrategy')) {
        svc('GrandStrategy').tick(0, getGrandStrategyCtx());
        if (gsPanelOpen && renderMacroPanels) svc('GrandStrategy').renderPanel(getState());
      }
      if (svc('IntergalacticLayer')) {
        svc('IntergalacticLayer').tick(0, getIntergalacticCtx());
        if (igPanelOpen && renderMacroPanels) svc('IntergalacticLayer').renderPanel(getState());
      }
    } else if (gsActive || igActive) {
      GS.macroPanelRenderTick = 0;
      if (gsActive) svc('GrandStrategy').tick(0, getGrandStrategyCtx());
      if (igActive) svc('IntergalacticLayer').tick(0, getIntergalacticCtx());
    } else {
      GS.macroPanelRenderTick = 0;
    }
    svc('Particles').update();
    CombatFX.update();
    StrikeFX?.update?.();
    svc('FloatingText').update();
    if (typeof GameFeedback !== 'undefined') {
      GameFeedback.update();
      GameFeedback.updateDanger(GS.units, GS.worldH, GS.rallyY);
    }
    if (svc('VisualPolish')) {
      svc('VisualPolish').update();
      svc('VisualPolish').updateAudioMix({
        wave: GS.wave,
        timeOfDay: GS.timeOfDay,
        bossActive: !!GS.currentWaveConfig?.boss,
        hordeWave: GS.currentHordeWave,
        playerCount: unitCounts.player,
        enemyCount: unitCounts.activeEnemy,
        spawnQueueLen: GS.spawnQueue.length,
        projectileCount: GS.projectiles.length,
      });
    }
  }

  function getSortedAliveUnits() {
    const shift = getGfxQuality()?.sortFrameShift ?? 2;
    const frame = GS.updateTick >> shift;
    if (GS.sortedUnitsFrame === frame && GS.sortedUnitsCache.length) return GS.sortedUnitsCache;
    GS.sortedUnitsCache = [];
    for (const u of GS.units) {
      if (u.hp > 0 && isInView(u.x, u.y, 36)) GS.sortedUnitsCache.push(u);
    }
    GS.sortedUnitsCache.sort((a, b) => a.y - b.y);
    GS.sortedUnitsFrame = frame;
    return GS.sortedUnitsCache;
  }

  function draw() {
    if (!GS.canvas || !GS.ctx) return;
    GS.visibleBoundsCore = null;
    if (svc('Perf')) svc('Perf').begin('draw');
    const gfxQ = getGfxQuality();
    const light = getDayLightLevel();
    sanitizeCameraState();
    syncCameraTransform();
    if (!isMapOverlappingViewport()) clampCameraToBounds();
    const drawScale =
      Number.isFinite(GS.viewScale) && GS.viewScale > 0 ? GS.viewScale : GS.baseViewScale * GS.cameraZoom;
    GS.ctx.setTransform(1, 0, 0, 1, 0, 0);
    GS.ctx.globalAlpha = 1;
    GS.ctx.setLineDash([]);
    GS.ctx.fillStyle = '#1a1410';
    GS.ctx.fillRect(0, 0, GS.canvas.width, GS.canvas.height);
    let worldLayerDrawn = false;
    try {
      GS.ctx.save();
      const shake = svc('VisualPolish')?.getScreenShakeOffset?.() || { x: 0, y: 0, zoom: 1 };
      const punchZoom = Number.isFinite(shake.zoom) && shake.zoom > 0 ? shake.zoom : 1;
      // Zoom punch toward viewport center so kill hits feel heavier
      if (punchZoom !== 1) {
        const cx = GS.canvas.width / 2;
        const cy = GS.canvas.height / 2;
        GS.ctx.translate(cx, cy);
        GS.ctx.scale(punchZoom, punchZoom);
        GS.ctx.translate(-cx, -cy);
      }
      GS.ctx.translate(GS.viewX + (shake.x || 0), GS.viewY + (shake.y || 0));
      GS.ctx.scale(drawScale, drawScale);
      worldLayerDrawn = true;

    GS.ctx.drawImage(
      svc('SpriteGen').getBattlefieldCanvas(GS.worldW, getMapViewH(), BASE_FIELD_W, BASE_FIELD_H),
      0,
      0
    );
    if (svc('LivingPlanet') && svc('VisualPolish') && gfxQ?.drawBorders !== false) {
      svc('VisualPolish').drawBiomeRegions(
        GS.ctx,
        GS.worldW,
        getMapViewH(),
        svc('LivingPlanet').getRegionBands(getLivingPlanetCtx())
      );
    }
    if (svc('VisualPolish') && gfxQ?.drawBorders !== false) {
      svc('VisualPolish').drawTerritoryBorders(GS.ctx, GS.worldW, getMapViewH(), GS.territoryTier);
      if (getAdvancedMods().fogOfWar && gfxQ?.drawFog !== false) {
        const fogTop = Math.max(40, GS.rallyY - 40);
        const grad = GS.ctx.createLinearGradient(0, 0, 0, fogTop);
        grad.addColorStop(0, 'rgba(14, 18, 28, 0.42)');
        grad.addColorStop(0.55, 'rgba(14, 18, 28, 0.16)');
        grad.addColorStop(1, 'rgba(14, 18, 28, 0)');
        GS.ctx.fillStyle = grad;
        GS.ctx.fillRect(0, 0, GS.worldW, fogTop);
      }
      if (svc('PlanetWarfare') && svc('PlanetWarfare').isActive(GS.wave)) {
        const pw = cachedSnap('planetWarfare', () =>
          svc('PlanetWarfare').getStateSnapshot(GS.wave, GS.worldW, GS.worldH, GS.buildings, GS.units)
        );
        svc('VisualPolish').drawHostileTerritory(
          GS.ctx,
          GS.worldW,
          getMapViewH(),
          pw.hostileLineY,
          pw.hostileControl,
          pw.tier
        );
      }
      if (svc('PlanetConquest') && svc('PlanetConquest').isActive(GS.wave, getRunModeId())) {
        const pc = cachedSnap('planetConquest', () =>
          svc('PlanetConquest').getStateSnapshot(
            GS.wave,
            GS.worldW,
            GS.worldH,
            GS.buildings,
            GS.units,
            getRunModeId()
          )
        );
        svc('VisualPolish').drawConquestSectors(
          GS.ctx,
          GS.worldW,
          getMapViewH(),
          pc.sectors || [],
          pc.planetBossActive
        );
      }
    }
    svc('SpriteGen').drawAttackSideMarkers(GS.ctx, GS.worldW, getMapViewH(), getWaveAttackSides(), GS.wave, {
      unlockedSides: getUnlockedAttackSides(GS.wave),
      tick: GS.updateTick,
      phase: GS.timeOfDay,
    });

    if (gfxQ?.drawHazards !== false) {
      for (const h of GS.hazards) {
        if (!isInView(h.x, h.y, h.radius || 30)) continue;
        svc('SpriteGen').drawHazard?.(GS.ctx, h);
      }
    }
    if (svc('DynamicMapEvents') && svc('VisualPolish')) {
      const mapEvt = cachedSnap('mapEventsState', () =>
        svc('DynamicMapEvents').getStateSnapshot(GS.wave, GS.tactical, isNightPhase())
      );
      const site = mapEvt?.event?.site;
      if (site && isInView(site.x, site.y, site.radius || 60)) {
        svc('VisualPolish').drawMapEventSite(GS.ctx, site, GS.updateTick, GS.timeOfDay);
      }
    }

    const stationedGen = unitCounts.stationedGeneral;
    if (stationedGen && isInView(stationedGen.x, stationedGen.y, 200)) {
      const aura = getGeneralAura();
      GS.ctx.strokeStyle = `rgba(255, 215, 0, ${0.12 + aura.strength * 0.18})`;
      GS.ctx.lineWidth = 2 / Math.max(0.5, GS.viewScale);
      GS.ctx.beginPath();
      GS.ctx.arc(stationedGen.x, stationedGen.y, aura.radius, 0, Math.PI * 2);
      GS.ctx.stroke();
    }

    if (gfxQ?.drawDecor !== false) {
      for (const d of GS.decorations) {
        if (!isInView(d.x, d.y, d.size || 16)) continue;
        if (d.type === 'tree') svc('SpriteGen').drawTree(GS.ctx, d.x, d.y, d.size);
        else if (d.type === 'rock') svc('SpriteGen').drawRock(GS.ctx, d.x, d.y, d.size);
        else if (d.type === 'barricade') svc('SpriteGen').drawBarricade(GS.ctx, d.x, d.y);
        else if (d.type === 'neutral_den') svc('SpriteGen').drawNeutralDen?.(GS.ctx, d.x, d.y, d.size);
        else if (d.type === 'supply_crate' || d.type === 'oil_barrel')
          svc('SpriteGen').drawDestructible?.(GS.ctx, d);
      }
    }

    for (const b of GS.buildings) {
      if (b.hp <= 0 || !isInView(b.x, b.y, b.radius || 28)) continue;
      svc('SpriteGen').drawBuilding(GS.ctx, b);
      if (gfxQ?.buildingHpBars !== false) {
        const barW = b.isHamlet || b.isMerchantGuild ? 40 : 32;
        ensureBuildingHealth(b);
        const hpRatio = b.maxHp > 0 ? b.hp / b.maxHp : 0;
        svc('SpriteGen').drawHealthBar(
          GS.ctx,
          b.x,
          b.y + b.radius * 0.5,
          barW,
          hpRatio,
          b.owner === 'enemy'
        );
      }
    }

    if (
      GS.selectedBuild === 'wall' &&
      GS.pointerScreen.sx >= 0 &&
      svc('SpriteGen').drawWallPlacementGhost
    ) {
      const pw = screenToWorld(GS.pointerScreen.sx, GS.pointerScreen.sy);
      if (pw.x >= 0 && pw.x <= GS.worldW && pw.y >= 0 && pw.y <= GS.worldH + 40) {
        const pos = clampPos(pw.x, pw.y);
        const wallDef = BuildDefs.wall;
        const valid = wallDef && !isBuildSiteBlocked(pos.x, pos.y, wallDef);
        svc('SpriteGen').drawWallPlacementGhost(GS.ctx, pos.x, pos.y, GS.pendingWallFacing, {
          valid,
          radius: wallDef?.radius,
        });
      }
    }

    const sel = unitCounts.selectedLive;
    if (sel) {
      if (sel.path?.length && isInView(sel.x, sel.y, 60)) {
        GS.ctx.strokeStyle = 'rgba(100,200,255,0.4)';
        GS.ctx.lineWidth = 1.5 / Math.max(0.5, GS.viewScale);
        GS.ctx.beginPath();
        GS.ctx.moveTo(sel.x, sel.y);
        for (let i = sel.pathIndex; i < sel.path.length; i++)
          GS.ctx.lineTo(sel.path[i].x, sel.path[i].y);
        GS.ctx.stroke();
      }
    }

    const selCount = getSelectedUnitIds().length;
    if (
      selCount > 1 &&
      GS.pointerScreen.sx >= 0 &&
      typeof Formations !== 'undefined' &&
      canBoxSelectNow()
    ) {
      const preview = screenToWorld(GS.pointerScreen.sx, GS.pointerScreen.sy);
      const offsets = Formations.computeOffsets(selCount, GS.selectionFormation);
      GS.ctx.save();
      GS.ctx.fillStyle = 'rgba(100,200,255,0.35)';
      GS.ctx.strokeStyle = 'rgba(100,200,255,0.55)';
      GS.ctx.lineWidth = 1 / Math.max(0.5, GS.viewScale);
      for (const off of offsets) {
        const px = preview.x + off.x;
        const py = preview.y + off.y;
        if (!isInView(px, py, 20)) continue;
        GS.ctx.beginPath();
        GS.ctx.arc(px, py, 4 / Math.max(0.5, GS.viewScale), 0, Math.PI * 2);
        GS.ctx.fill();
        GS.ctx.stroke();
      }
      GS.ctx.restore();
    }

    for (const m of GS.moveMarkers) {
      if (isInView(m.x, m.y, 12)) svc('SpriteGen').drawMoveMarker(GS.ctx, m.x, m.y);
    }

    if (gfxQ?.drawLanternAuras !== false)
      for (const u of GS.units) {
        if (!u.isWwe || u.wweAbility !== 'lantern' || u.hp <= 0 || !isInView(u.x, u.y, 140))
          continue;
        const pulse = 0.1 + Math.sin(GS.updateTick * 0.07) * 0.05;
        const alpha = pulse * (isNightPhase() ? 0.35 : 0.55 + (1 - light) * 0.45);
        GS.ctx.fillStyle = `rgba(48,96,48,${alpha})`;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 132, 0, Math.PI * 2);
        GS.ctx.fill();
        GS.ctx.strokeStyle = `rgba(120,200,80,${alpha * 1.2})`;
        GS.ctx.lineWidth = 1.5;
        GS.ctx.setLineDash([6, 8]);
        GS.ctx.stroke();
        GS.ctx.setLineDash([]);
      }

    const sorted = getSortedAliveUnits();
    const rallyPulse = GS.updateTick * 0.08;
    const heavyScene = sorted.length > 55 || (gfxQ && gfxQ.drawMorale === false);
    const spriteLodSvc = svc('SpriteLod');
    const perfSvc = svc('Perf');
    const sceneSpriteLod = spriteLodSvc ? spriteLodSvc.getSceneLod(sorted.length, gfxQ) : 0;
    const drawSelectedIds = GS.updateThrottleCtx?.selectedIds || GS.cachedSelectedSet;
    const spriteLodCtx = spriteLodSvc
      ? {
          isInView,
          selectedIds: drawSelectedIds,
          farPad: gfxQ?.distantAiPad ?? 120,
        }
      : null;
    for (const u of sorted) {
      if (perfSvc) perfSvc.count('drawUnits');
      const unitLod = spriteLodSvc
        ? spriteLodSvc.getUnitLod(u, sceneSpriteLod, spriteLodCtx)
        : 0;
      const drawOverlays = !spriteLodSvc || spriteLodSvc.shouldDrawUnitOverlays(unitLod);
      const drawRings = !spriteLodSvc || spriteLodSvc.shouldDrawUnitRings(unitLod);
      if (u.rallyTimer > 0 && gfxQ?.rallyRings !== false && drawRings) {
        GS.ctx.strokeStyle = `rgba(240,192,64,${0.25 + Math.sin(rallyPulse) * 0.15})`;
        GS.ctx.lineWidth = 2;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
        GS.ctx.stroke();
      }
      if (
        drawRings &&
        gfxOverlayFor(u, gfxQ?.eliteRings) &&
        (isEliteEnemy(u) || u.isEvilOperative || u.type === 'war_chief' || u.isNamedBoss)
      ) {
        const monster = typeof isMonsterEnemy === 'function' && isMonsterEnemy(u);
        const named = u.isNamedBoss || (typeof isNamedBoss === 'function' && isNamedBoss(u));
        const ringR = 15 + (u.spriteScale || 1) * 4 + (named ? 10 : monster ? 6 : 0);
        GS.ctx.strokeStyle = named
          ? 'rgba(255,215,0,0.75)'
          : monster
            ? 'rgba(255,60,80,0.65)'
            : 'rgba(200,80,255,0.55)';
        GS.ctx.lineWidth = named ? 3 : monster ? 3 : 2;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, ringR, 0, Math.PI * 2);
        GS.ctx.stroke();
      }
      if (
        drawRings &&
        u.team === 'player' &&
        u.vetTier > 0 &&
        gfxQ?.drawVet !== false &&
        (!heavyScene || isUnitSelected(u))
      ) {
        GS.ctx.strokeStyle = `rgba(255,215,0,${0.35 + u.vetTier * 0.08})`;
        GS.ctx.lineWidth = 2;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 17 + u.vetTier * 2, 0, Math.PI * 2);
        GS.ctx.stroke();
      }
      if (u.type === 'siege_tower') {
        GS.ctx.fillStyle = 'rgba(160,80,40,0.35)';
        GS.ctx.fillRect(u.x - 14, u.y - 20, 28, 32);
        GS.ctx.strokeStyle = '#c06030';
        GS.ctx.lineWidth = 2;
        GS.ctx.strokeRect(u.x - 14, u.y - 20, 28, 32);
        GS.ctx.fillStyle = '#e0a060';
        GS.ctx.font = '7px Cinzel';
        GS.ctx.textAlign = 'center';
        GS.ctx.fillText('SIEGE', u.x, u.y - 24);
      }
      if (
        drawOverlays &&
        gfxQ?.chargeGlow !== false &&
        u.combatType === 'cavalry' &&
        u.chargeTimer > 30
      ) {
        GS.ctx.fillStyle = `rgba(255,180,60,${(u.chargeTimer / 90) * 0.35})`;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 13, 0, Math.PI * 2);
        GS.ctx.fill();
      }
      if (drawOverlays && gfxQ?.honorGlow !== false && (u.honorGlowTimer || 0) > 0) {
        u.honorGlowTimer--;
        const glow = u.honorGlowTimer / 240;
        GS.ctx.fillStyle = `rgba(255, 215, 0, ${0.15 + glow * 0.25})`;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 16 + glow * 4, 0, Math.PI * 2);
        GS.ctx.fill();
      }
      if (isEnemyHiddenByFog(u)) continue;
      const drawRot = svc('GfxQuality')
        ? svc('GfxQuality').quantizeRotation(u.rotation)
        : u.rotation;
      const sprScale = svc('GfxQuality')
        ? svc('GfxQuality').quantizeScale(u.spriteScale || 1)
        : Math.round((u.spriteScale || 1) * 4) / 4;
      const drawSz = 36 * sprScale;
      // spriteType is derived from type at spawn and should always be a string; fall back
      // to u.type if it ever desyncs (see sprites.js drawUnitTopDown for the last-resort
      // guard) so a bad unit renders as itself instead of a hardcoded placeholder.
      const img = svc('SpriteGen').getUnitCanvas(
        u.spriteType || u.type,
        drawRot,
        u.team,
        u.frame,
        sprScale,
        u.animState,
        unitLod
      );
      // Micro hit recoil offset
      let drawX = u.x;
      let drawY = u.y;
      if ((u.hitFlash || 0) > 0) {
        const flashT = u.hitFlash / (u.hitFlashMax || 6);
        const recoil = flashT * 1.6;
        drawX += (Math.random() - 0.5) * recoil;
        drawY += (Math.random() - 0.5) * recoil * 0.6;
      }
      if (typeof GameFeedback !== 'undefined') {
        GameFeedback.drawLowHpPulse(GS.ctx, u, GS.updateTick);
      }
      GS.ctx.drawImage(img, drawX - drawSz / 2, drawY - drawSz / 2, drawSz, drawSz);
      // Hit flash — white/red overlay so damage is instantly readable
      if ((u.hitFlash || 0) > 0) {
        const flashT = u.hitFlash / (u.hitFlashMax || 6);
        GS.ctx.save();
        GS.ctx.globalAlpha = Math.min(0.75, flashT * 0.7);
        GS.ctx.fillStyle = flashT > 0.55 ? '#ffffff' : u.team === 'enemy' ? '#ff5050' : '#ffc080';
        GS.ctx.beginPath();
        GS.ctx.arc(drawX, drawY, drawSz * 0.32, 0, Math.PI * 2);
        GS.ctx.fill();
        // Brief outline punch
        if (flashT > 0.4) {
          GS.ctx.strokeStyle = '#ffe8a0';
          GS.ctx.lineWidth = 2;
          GS.ctx.globalAlpha = flashT * 0.55;
          GS.ctx.beginPath();
          GS.ctx.arc(drawX, drawY, drawSz * 0.38, 0, Math.PI * 2);
          GS.ctx.stroke();
        }
        GS.ctx.restore();
        u.hitFlash--;
      }
      if (
        u.id === GS.selectedUnitId ||
        (drawSelectedIds ? drawSelectedIds.has(u.id) : GS.selectedUnitIds.includes(u.id))
      ) {
        svc('SpriteGen').drawSelectionRing(GS.ctx, u.x, u.y, u.id === GS.selectedUnitId ? 14 : 12);
      }
      if (u.huntMode && u.team === 'player' && !svc('VisualPolish')) {
        GS.ctx.fillStyle = '#ff4040';
        GS.ctx.font = '8px sans-serif';
        GS.ctx.textAlign = 'center';
        GS.ctx.fillText('H', u.x + 12, u.y - 14);
      }
      const hpMode = gfxQ?.unitHpBars ?? 'all';
      const showHp = hpMode === 'all' || gfxOverlayFor(u, hpMode);
      if (showHp) {
        const barW = 24 * Math.max(1, (u.spriteScale || 1) * 0.85);
        const barY = u.y - 22 - ((u.spriteScale || 1) - 1) * 10;
        svc('SpriteGen').drawHealthBar(GS.ctx, u.x, barY, barW, u.hp / u.maxHp, u.team === 'enemy');
      }
      if (drawOverlays && gfxQ?.drawMorale !== false && isMoraleCombatUnit(u) && u.maxMorale > 0) {
        svc('SpriteGen').drawMoraleBar(GS.ctx, u.x, u.y - 27, 20, u.morale / u.maxMorale);
      }
      if (u.demoralized && u.hp > 0) {
        GS.ctx.fillStyle = '#a080c0';
        GS.ctx.font = '7px Cinzel';
        GS.ctx.textAlign = 'center';
        GS.ctx.fillText('GAVE UP', u.x, u.y - 32);
      }
      if (u.fleeing && u.hp > 0) {
        GS.ctx.fillStyle = '#c06040';
        GS.ctx.font = '7px Cinzel';
        GS.ctx.textAlign = 'center';
        GS.ctx.fillText('ROUT', u.x, u.y - 32);
      }
      if (
        u.team === 'enemy' &&
        u.isNamedBoss &&
        u.hp > 0 &&
        gfxOverlayFor(u, gfxQ?.drawHonor ?? true)
      ) {
        GS.ctx.fillStyle = 'rgba(255,220,120,0.95)';
        GS.ctx.font = 'bold 7px Cinzel';
        GS.ctx.textAlign = 'center';
        const labelY = u.y - 38 - ((u.spriteScale || 1) - 1) * 12;
        GS.ctx.fillText(u.bossName || EnemyDefs[u.type]?.bossName || 'BOSS', u.x, labelY);
        const title = u.bossTitle || EnemyDefs[u.type]?.bossTitle;
        if (title) {
          GS.ctx.font = '6px Cinzel';
          GS.ctx.fillStyle = 'rgba(255,160,160,0.9)';
          GS.ctx.fillText(title, u.x, labelY + 9);
        }
      }
      if (u.team === 'player') {
        if (gfxQ?.drawVet !== false) svc('SpriteGen').drawVetStars(GS.ctx, u.x, u.y, u);
        if (u.honorName && gfxOverlayFor(u, gfxQ?.drawHonor ?? true)) {
          if (typeof repairHonorName === 'function') repairHonorName(u);
          if (u.honorName && (!heavyScene || isUnitSelected(u))) {
            GS.ctx.fillStyle = 'rgba(240,232,176,0.92)';
            GS.ctx.font = '6px Cinzel';
            GS.ctx.textAlign = 'center';
            const nameY = u.isGeneral && u.stationedKeep ? u.y - 44 : u.y - 38;
            GS.ctx.fillText(u.honorName, u.x, nameY);
          }
        }
      }
      if (u.retreatingToMed && u.hp > 0) {
        GS.ctx.fillStyle = '#60c0ff';
        GS.ctx.font = '7px Cinzel';
        GS.ctx.textAlign = 'center';
        GS.ctx.fillText('↩ MED', u.x, u.y - 30);
      }
      if (svc('VisualPolish')) {
        if (gfxOverlayFor(u, gfxQ?.drawAccent ?? true))
          svc('VisualPolish').drawFactionAccent(GS.ctx, u);
        if (gfxQ?.drawAccessibility !== false) svc('VisualPolish').drawAccessibilityCue(GS.ctx, u);
      } else if (u.isWwe && u.wweColor) {
        GS.ctx.strokeStyle = u.wweColor;
        GS.ctx.lineWidth = 2;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
        GS.ctx.stroke();
      }
      if (u.isDoomslayer && u.hp > 0) {
        GS.ctx.strokeStyle = 'rgba(255,64,32,0.85)';
        GS.ctx.lineWidth = 3;
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 18, 0, Math.PI * 2);
        GS.ctx.stroke();
        GS.ctx.fillStyle = '#ff4020';
        GS.ctx.font = '6px Cinzel';
        GS.ctx.textAlign = 'center';
        GS.ctx.fillText('DOOM', u.x, u.y - 22);
      }
      if (gfxQ?.generalOverlay !== false && u.isGeneral && u.hp > 0) {
        GS.ctx.strokeStyle = 'rgba(255,215,0,0.7)';
        GS.ctx.lineWidth = 2;
        GS.ctx.setLineDash([3, 3]);
        GS.ctx.beginPath();
        GS.ctx.arc(u.x, u.y, 20, 0, Math.PI * 2);
        GS.ctx.stroke();
        GS.ctx.setLineDash([]);
        if (u.stationedKeep) {
          const str = getGeneralBuffStrength();
          GS.ctx.fillStyle = '#ffd700';
          GS.ctx.font = '7px Cinzel';
          GS.ctx.textAlign = 'center';
          const stars = u.generalStars ? ` ★${u.generalStars}` : '';
          GS.ctx.fillText(`CMD ${Math.round(str * 100)}%${stars}`, u.x, u.y - 30);
        } else if (u.rallyTargetId) {
          GS.ctx.fillStyle = '#ffd700';
          GS.ctx.font = '7px Cinzel';
          GS.ctx.textAlign = 'center';
          GS.ctx.fillText('WALL TO WALL', u.x, u.y - 34);
        }
        if ((u.w2wBuffTimer || 0) > 0) {
          GS.ctx.strokeStyle = `rgba(255,215,0,${0.35 + Math.sin(GS.updateTick * 0.12) * 0.2})`;
          GS.ctx.lineWidth = 3;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 24, 0, Math.PI * 2);
          GS.ctx.stroke();
        }
      }
    }

    const vBounds = getVisibleBounds(140);
    if (svc('ContentExpansion') && svc('ContentExpansion').getFortifyZones) {
      StrikeFX?.drawFortifyZones?.(GS.ctx, svc('ContentExpansion').getFortifyZones(), GS.updateTick);
    }
    StrikeFX?.draw?.(GS.ctx, vBounds);
    if (GS.selectedAbility && GS.pointerScreen.sx >= 0) {
      const ab = Abilities[GS.selectedAbility];
      const pw = screenToWorld(GS.pointerScreen.sx, GS.pointerScreen.sy);
      StrikeFX?.drawTargeting?.(GS.ctx, GS.selectedAbility, pw.x, pw.y, ab?.radius || 50, GS.updateTick);
    }
    CombatFX.draw(GS.ctx, vBounds);
    for (const p of GS.projectiles) {
      if (isInView(p.x, p.y, 20, 0)) svc('SpriteGen').drawProjectile(GS.ctx, p);
    }
    if (svc('VisualPolish') && gfxQ?.drawCorpses !== false)
      svc('VisualPolish').drawDeathCorpses(GS.ctx);
    svc('Particles').draw(GS.ctx, vBounds);
    svc('FloatingText').draw(GS.ctx, vBounds);

    if (svc('VisualPolish')) {
      const atm = gfxQ?.atmosphere ?? 'full';
      if (atm === 'full') {
        svc('VisualPolish').drawAtmosphere(
          GS.ctx,
          GS.worldW,
          getMapViewH(),
          light,
          GS.timeOfDay,
          GS.wave,
          GS.updateTick,
          { weatherParticles: gfxQ?.weatherParticles !== false }
        );
      } else if (atm === 'simple') {
        svc('VisualPolish').drawAtmosphere(
          GS.ctx,
          GS.worldW,
          getMapViewH(),
          light,
          GS.timeOfDay,
          GS.wave,
          GS.updateTick,
          { simple: true }
        );
      }
      if (GS.currentHordeWave && isDayPhase() && gfxQ?.drawOverlay !== false) {
        svc('VisualPolish').drawHordeIntensity(
          GS.ctx,
          GS.worldW,
          getMapViewH(),
          GS.currentHordeWave,
          GS.updateTick
        );
      }
    } else if (isNightPhase()) {
      GS.ctx.fillStyle = 'rgba(6,10,32,0.62)';
      GS.ctx.fillRect(0, 0, GS.worldW, getMapViewH());
    } else if (light < 0.92) {
      const dusk = 1 - light;
      GS.ctx.fillStyle = `rgba(24,14,48,${dusk * 0.42})`;
      GS.ctx.fillRect(0, 0, GS.worldW, getMapViewH());
    }

      GS.ctx.globalAlpha = 1;
      GS.ctx.setLineDash([]);
    } catch (drawErr) {
      console.error('draw world layer error', drawErr);
    } finally {
      if (worldLayerDrawn) {
        try {
          GS.ctx.restore();
        } catch (_) {
          GS.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
    }

    StrikeFX?.drawScreenFx?.(GS.ctx, GS.canvas.width, GS.canvas.height);
    CombatFX?.drawScreenFlash?.(GS.ctx, GS.canvas.width, GS.canvas.height);
    if (typeof GameFeedback !== 'undefined') {
      GameFeedback.drawDangerVignette(GS.ctx, GS.canvas.width, GS.canvas.height);
      GameFeedback.drawBanner(GS.ctx, GS.canvas.width, GS.canvas.height);
    }

    if (GS.rallyTimer > 0) {
      GS.ctx.fillStyle = 'rgba(240,192,64,0.85)';
      GS.ctx.font = '11px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText('RALLY ACTIVE', GS.canvas.width / 2, GS.canvas.height - 28);
    }

    if (isNightPhase()) {
      const secLeft = getNightSecondsRemaining();
      const m = Math.floor(secLeft / 60);
      const s = String(secLeft % 60).padStart(2, '0');
      GS.ctx.fillStyle = 'rgba(140,160,220,0.92)';
      GS.ctx.font = '13px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText('NIGHT — PREPARE DEFENSES', GS.canvas.width / 2, 52);
      GS.ctx.font = '10px Cinzel';
      GS.ctx.fillStyle = 'rgba(180,190,230,0.75)';
      GS.ctx.fillText(
        `Builders +35% speed · Auto dawn ${m}:${s} · D or BEGIN DAY to skip`,
        GS.canvas.width / 2,
        68
      );
    } else if (light < 0.75) {
      GS.ctx.fillStyle = 'rgba(200,180,120,0.8)';
      GS.ctx.font = '10px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText('DUSK — visibility fading', GS.canvas.width / 2, 52);
    }

    const bossUnit = GS.units.find(
      (u) => u.team === 'enemy' && u.hp > 0 && (u.isNamedBoss || u.type === 'war_chief')
    );
    if (bossUnit) {
      const bossLabel =
        bossUnit.bossName ||
        EnemyDefs[bossUnit.type]?.bossName ||
        (bossUnit.type === 'war_chief' ? 'WAR CHIEF' : 'BOSS');
      const barW = Math.min(220, 140 + bossLabel.length * 4);
      GS.ctx.fillStyle = 'rgba(20,8,8,0.8)';
      GS.ctx.fillRect(GS.canvas.width / 2 - barW / 2, 76, barW, 16);
      GS.ctx.fillStyle = bossUnit.isNamedBoss ? '#a04020' : '#c04040';
      GS.ctx.fillRect(
        GS.canvas.width / 2 - barW / 2 + 2,
        79,
        (barW - 4) * (bossUnit.hp / bossUnit.maxHp),
        10
      );
      GS.ctx.fillStyle = bossUnit.isNamedBoss ? '#ffe8a0' : '#ffd0d0';
      GS.ctx.font = '9px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText(bossLabel.toUpperCase(), GS.canvas.width / 2, 74);
      if (bossUnit.bossTitle) {
        GS.ctx.font = '7px Cinzel';
        GS.ctx.fillStyle = 'rgba(255,180,180,0.85)';
        GS.ctx.fillText(bossUnit.bossTitle, GS.canvas.width / 2, 96);
      }
    }

    if (GS.boxSelect && GS.dragMoved) {
      const x = Math.min(GS.boxSelect.startSx, GS.boxSelect.endSx);
      const y = Math.min(GS.boxSelect.startSy, GS.boxSelect.endSy);
      const w = Math.abs(GS.boxSelect.endSx - GS.boxSelect.startSx);
      const h = Math.abs(GS.boxSelect.endSy - GS.boxSelect.startSy);
      GS.ctx.strokeStyle = 'rgba(100,200,255,0.85)';
      GS.ctx.fillStyle = 'rgba(100,200,255,0.12)';
      GS.ctx.lineWidth = 1.5;
      GS.ctx.fillRect(x, y, w, h);
      GS.ctx.strokeRect(x, y, w, h);
    }

    if (GS.creativeMode && GS.creativeTool) {
      const levelLabel =
        typeof LevelEditor !== 'undefined' ? LevelEditor.getToolOverlayLabel(getState()) : null;
      const label =
        levelLabel ||
        (GS.creativeTool === 'spawn_enemy'
          ? EnemyDefs[GS.creativeSpawnType]?.name || GS.creativeSpawnType
          : BuildDefs[GS.creativeSpawnType]?.name || GS.creativeSpawnType);
      const isLevel = !!levelLabel || GS.creativeTool.startsWith('level_');
      GS.ctx.strokeStyle = isLevel ? 'rgba(120,200,140,0.9)' : 'rgba(255,120,80,0.9)';
      GS.ctx.setLineDash([6, 4]);
      GS.ctx.lineWidth = 2;
      const cx = GS.canvas.width / 2;
      const cy = GS.canvas.height / 2;
      GS.ctx.beginPath();
      GS.ctx.moveTo(cx - 14, cy);
      GS.ctx.lineTo(cx + 14, cy);
      GS.ctx.moveTo(cx, cy - 14);
      GS.ctx.lineTo(cx, cy + 14);
      GS.ctx.stroke();
      GS.ctx.setLineDash([]);
      GS.ctx.fillStyle = isLevel ? 'rgba(120,200,140,0.92)' : 'rgba(255,120,80,0.92)';
      GS.ctx.font = '11px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText(isLevel ? label : `SPAWN: ${label}`, cx, cy + 28);
    }

    if (GS.paused) {
      const overlay =
        typeof PacingTools !== 'undefined'
          ? PacingTools.getPauseOverlay()
          : { title: 'PAUSED', subtitle: 'Space resume · Esc menu' };
      GS.ctx.fillStyle = 'rgba(0,0,0,0.52)';
      GS.ctx.fillRect(0, 0, GS.canvas.width, GS.canvas.height);
      GS.ctx.fillStyle = '#f0d890';
      GS.ctx.font = '22px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText(overlay.title || 'PAUSED', GS.canvas.width / 2, GS.canvas.height / 2 - 8);
      GS.ctx.font = '10px Cinzel';
      GS.ctx.fillStyle = 'rgba(200,180,140,0.75)';
      GS.ctx.fillText(overlay.subtitle || 'Space resume · Esc menu', GS.canvas.width / 2, GS.canvas.height / 2 + 14);
    }
    if (svc('Perf')) svc('Perf').end('draw');
  }

  function purchaseOperativeSkill(faction, nodeId) {
    if (!svc('OperativeSkillTrees')) return { ok: false, reason: 'Skill trees unavailable' };
    const result = svc('OperativeSkillTrees').purchaseNode(faction, nodeId);
    if (result.ok) {
      for (const u of GS.units) {
        if (u.team === 'player' && u.hp > 0) svc('OperativeSkillTrees').applyToUnit(u, GS.units);
      }
      const tree = svc('OperativeSkillTrees').getTree(faction);
      const node = tree?.nodes?.[nodeId];
      showMessage(`${tree?.label || faction}: ${node?.name || nodeId} unlocked!`, 260);
    } else if (result.reason) {
      showMessage(result.reason);
    }
    return result;
  }

  function recruitCrossoverOperative(id) {
    const def = CrossoverDefs[id];
    if (!def) return false;
    if (getCrossoverOnField().includes(id)) {
      showMessage(`${def.name} is already on the field!`);
      return false;
    }
    if (!hasCrossoverBarracks(def.faction)) {
      showMessage(
        `Build a ${CrossoverFactions[def.faction]?.label || 'crossover'} barracks first!`
      );
      return false;
    }
    const costMult = svc('FactionDepth')
      ? svc('FactionDepth').getDeployCostMult(def.faction, GS.wave, GS.units)
      : 1;
    const deployCost = Math.ceil(def.cost * costMult);
    if (GS.tactical < deployCost) {
      showMessage(`Need ${deployCost} TP to deploy ${def.name}!`);
      return false;
    }
    const base = GS.buildings.find(
      (b) => b.isCrossoverBarracks && b.complete && b.hp > 0 && b.crossoverFaction === def.faction
    );
    GS.tactical -= deployCost;
    const u = spawnUnit(id, base?.x ?? GS.worldW / 2, (base?.y ?? GS.rallyY) + 18, 'player');
    applyPlayerStatMods(u);
    if (svc('FactionDepth')) svc('FactionDepth').applyToUnit(u, GS.units);
    if (svc('OperativeSkillTrees')) svc('OperativeSkillTrees').onRecruit(u);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (u.canHunt && !u.huntMode) {
      u.manualOrder = true;
      u.holdX = u.x;
      u.holdY = u.y;
      u.targetX = u.x;
      u.targetY = u.y;
      u.pathTargetId = 'hold';
    }
    GS.units.push(u);
    svc('MetaProgress').recordCrossoverRecruit(id);
    if (svc('Legacy')) {
      svc('Legacy').recordFaction(def.faction);
      svc('Legacy').recordDeploy(id);
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      FoundationalMedievalLayer.recordFaction(def.faction, GS.wave);
      FoundationalMedievalLayer.recordDeploy(id, GS.wave);
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      MythicPathEvolution.recordFaction(def.faction, GS.wave);
      MythicPathEvolution.recordDeploy(id, GS.wave);
    }
    ach('crossover_recruit', { crossoverId: id });
    if (def.jojoPart === 7 || def.combatType === 'cavalry') ach('jojo_cavalry');
    playSfx('deploy');
    svc('Particles').dust(u.x, u.y);
    showMessage(`${def.name} — ${def.abilityDesc}`, 280);
    refreshUnitCounts();
    invalidateStateCache();
    return true;
  }

  function recruitWweSuperstar(id) {
    const def = WweDefs[id];
    if (!def) return false;
    if (!hasWweAcademy()) {
      showMessage('Complete a Grand Coliseum on the field first!');
      return false;
    }
    if (GS.tactical < def.cost) {
      showMessage(`Need ${def.cost} TP to sign ${def.name}!`);
      return false;
    }
    const academy = GS.buildings.find((b) => b.isWweAcademy && b.complete && b.hp > 0);
    GS.tactical -= def.cost;
    const u = spawnUnit(id, academy?.x ?? GS.worldW / 2, (academy?.y ?? GS.rallyY) + 18, 'player');
    applyPlayerStatMods(u);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (u.canHunt && !u.huntMode) {
      u.manualOrder = true;
      u.holdX = u.x;
      u.holdY = u.y;
      u.targetX = u.x;
      u.targetY = u.y;
      u.pathTargetId = 'hold';
    }
    GS.units.push(u);
    if (svc('FactionDepth')) svc('FactionDepth').applyToUnit(u, GS.units);
    if (svc('OperativeSkillTrees')) svc('OperativeSkillTrees').onRecruit(u);
    svc('MetaProgress').recordWweRecruit(id);
    if (svc('Legacy')) {
      svc('Legacy').recordFaction('wwe');
      svc('Legacy').recordDeploy(id);
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      MythicPathEvolution.recordFaction('wwe', GS.wave);
      MythicPathEvolution.recordDeploy(id, GS.wave);
    }
    ach('wwe_recruit', { wweId: id });
    playSfx('deploy');
    svc('Particles').dust(u.x, u.y);
    showMessage(`${def.name} — ${def.abilityDesc}`, 280);
    return true;
  }

  function applyCheatEffect(type, value) {
    if (GS.state !== 'playing') return;
    switch (type) {
      case 'tp':
        GS.tactical += value;
        sanitizeTactical();
        showMessage(`Cheat: +${value} TP!`, 180);
        break;
      case 'morale':
        GS.units
          .filter((u) => u.team === 'player' && u.hp > 0)
          .forEach((u) => {
            u.morale = u.maxMorale;
            u.demoralized = false;
            u.fleeing = false;
            u.witnessDeaths = 0;
          });
        showMessage('Cheat: army morale maxed!', 180);
        break;
      case 'clear_enemies':
        GS.units
          .filter((u) => u.team === 'enemy' || u.team === 'neutral' || u.isNeutral)
          .forEach((u) => {
            u.hp = 0;
          });
        purgeDeadUnits();
        refreshUnitCounts();
        GS.spawnQueue.length = 0;
        showMessage('Cheat: enemies eliminated!', 180);
        break;
      case 'deploy_all_free': {
        const types = [
          'footman',
          'archer',
          'mage',
          'cavalry',
          'healer',
          'knight',
          'sapper',
          'builder',
          'courier',
        ];
        if (!findPlayerGeneral()) types.push('general');
        types.forEach((t, i) => {
          const u = spawnUnit(t, 60 + i * 35, GS.deployY - 10, 'player');
          applyPlayerStatMods(u);
          u.targetY = GS.rallyY;
          GS.units.push(u);
        });
        showMessage('Cheat: full roster deployed!', 200);
        break;
      }
      case 'spawn_knights':
        for (let i = 0; i < (value || 1); i++) {
          const u = spawnUnit('knight', 80 + i * 40, GS.deployY - 10, 'player');
          applyPlayerStatMods(u);
          u.targetY = GS.rallyY;
          GS.units.push(u);
        }
        showMessage(`Cheat: ${value} knight(s) spawned!`, 180);
        break;
      default:
        break;
    }
    ach('state_check', {
      tactical: GS.tactical,
      wave: GS.wave,
      hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(),
      liveBuilders: countLiveBuilders(GS.units),
    });
  }

  function getSelectedUnitsInfo() {
    const ids = GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
    const synSnap = getThematicSynSnap();
    const echoCandidates = synSnap?.echoes?.candidates || [];
    const echoRecruited = synSnap?.echoes?.recruited || [];
    return ids
      .map((id) => {
        const u = getUnitById(id);
        if (!u || u.hp <= 0) return null;
        const displayName =
          typeof getUnitDisplayName === 'function' ? getUnitDisplayName(u) : u.type;
        const roleLabel =
          typeof getUnitRoleLabel === 'function'
            ? getUnitRoleLabel(u)
            : typeof getVeteranLabel === 'function'
              ? getVeteranLabel(u)
              : u.type;
        let status = '';
        if (u.demoralized) status = 'Demoralized';
        else if (u.retreatingToMed) status = 'Retreating to med tent';
        else if (u.garrisoned || u.wallGarrisoned) status = 'Garrisoned';
        else if (u.stationedKeep) status = 'Commanding Keep';
        else if (u.building && !u.building.complete) status = 'Building';
        return {
          id: u.id,
          type: u.type,
          spriteType: u.spriteType || u.type,
          displayName,
          roleLabel,
          honorName: u.honorName,
          hp: u.hp,
          maxHp: u.maxHp,
          morale: u.morale,
          maxMorale: u.maxMorale,
          vetBronze: u.vetBronze,
          vetSilver: u.vetSilver,
          vetGold: u.vetGold,
          vetTier: u.vetTier,
          vetUpgradeEligible: !!u.vetUpgradeEligible,
          vetUpgradeCost: canSpendTpVeteranUpgrade(u) ? getVeteranUpgradeCost(u) : 0,
          canVetUpgrade: canTpVeteranUpgrade(u),
          obsoletePct:
            svc('GameDepth') && svc('GameDepth').isVanillaAlly(u)
              ? Math.round(svc('GameDepth').getVanillaObsoleteMult(u, GS.wave) * 100)
              : 100,
          scaling: svc('GameDepth') ? svc('GameDepth').getUnitScalingSnapshot(u, GS.wave) : null,
          lateAbility:
            typeof getSpecialistLateAbilityInfo === 'function'
              ? getSpecialistLateAbilityInfo(u)
              : null,
          isSpecialist: typeof isSpecialistUnit === 'function' && isSpecialistUnit(u),
          perks: u.perks || [],
          huntMode: u.huntMode,
          status,
          // Combat readout for unit panel
          damage: Math.round(u.damage || 0),
          range: Math.round(u.range || u.meleeRange || 0),
          meleeRange: Math.round(u.meleeRange || 0),
          accuracy: Math.round(u.accuracy || 0),
          speed: Number((u.speed || 0).toFixed(1)),
          combatType: u.combatType || 'melee',
          experience: Math.floor(u.experience || 0),
          canPromote: u.type === 'footman' && footmanEligibleForGeneral(u) && !findPlayerGeneral(),
          ascensionOffer:
            typeof AscensionSystem !== 'undefined'
              ? AscensionSystem.getUnitAscensionOffer(u, GS.wave)
              : null,
          ascensionLabel: u.ascensionLabel || null,
          ascensionWeapon: u.ascensionWeapon || null,
          echoOffer:
            synSnap?.active && synSnap.pathId === 'mythic'
              ? echoCandidates.find(
                  (e) =>
                    e.id === u.type && !echoRecruited.some((r) => r.id === e.id)
                ) || null
              : null,
          ancestralWeapon: !!u.ancestralWeapon,
          wizardKing: !!u.wizardKing,
          honorLegion: !!u.honorLegion,
          honorMeleeOnly: !!u.honorMeleeOnly,
          crownLegend: u.crownLegend || null,
        };
      })
      .filter(Boolean);
  }

  function getMinimapData() {
    const vp = getCameraViewport();
    const halfW = vp.width / (2 * GS.viewScale);
    const halfH = vp.height / (2 * GS.viewScale);
    const pw =
      svc('PlanetWarfare') && svc('PlanetWarfare').isActive(GS.wave)
        ? svc('PlanetWarfare').getStateSnapshot(GS.wave, GS.worldW, GS.worldH, GS.buildings, GS.units)
        : null;
    const minimapUnits = [];
    for (const u of GS.units) {
      if (u.hp <= 0) continue;
      if (u.team === 'enemy' && isEnemyHiddenByFog(u)) continue;
      minimapUnits.push({ x: u.x, y: u.y, team: u.team });
    }
    const lp = svc('LivingPlanet')
      ? svc('LivingPlanet').getStateSnapshot(GS.territoryTier, GS.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          baseW: BASE_FIELD_W,
          baseH: BASE_FIELD_H,
          territoryTier: GS.territoryTier,
          wave: GS.wave,
          hostileLineY: pw?.hostileLineY ?? null,
        })
      : null;
    const mf =
      svc('MultiFrontSiege') && svc('EnemyFactions')
        ? svc('MultiFrontSiege').getStateSnapshot(GS.wave, svc('EnemyFactions').getActiveFactions(GS.wave))
        : null;
    return {
      worldW: GS.worldW,
      worldH: GS.worldH,
      territoryTier: GS.territoryTier,
      wave: GS.wave,
      rallyY: GS.rallyY,
      phase: isNightPhase() ? 'night' : 'day',
      tick: GS.updateTick,
      attackSides: getWaveAttackSides(),
      unlockedAttackSides: getUnlockedAttackSides(GS.wave),
      multiFront: mf,
      planetWarfare: pw,
      livingPlanet: lp,
      viewX: GS.cameraWorldX - halfW,
      viewY: GS.cameraWorldY - halfH,
      viewW: halfW * 2,
      viewH: halfH * 2,
      units: minimapUnits,
      buildings: GS.buildings
        .filter((b) => b.hp > 0 && (b.complete || b.isSettlement))
        .map((b) => ({
          x: b.x,
          y: b.y,
          owner: b.owner,
          isSettlement: b.isHamlet || b.isMerchantGuild,
        })),
    };
  }

  function panCameraToFraction(fx, fy) {
    GS.cameraWorldX = fx * GS.worldW;
    GS.cameraWorldY = fy * getMapViewH();
    applyCamera();
  }

  function focusSelection() {
    const ids = GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
    if (!ids.length) {
      showMessage('Select unit(s) first to focus the camera.', 140);
      return false;
    }
    let sx = 0,
      sy = 0,
      n = 0;
    ids.forEach((id) => {
      const u = getUnitById(id);
      if (u?.hp > 0) {
        sx += u.x;
        sy += u.y;
        n++;
      }
    });
    if (!n) {
      showMessage('No living units in selection to focus.', 140);
      return false;
    }
    GS.cameraWorldX = sx / n;
    GS.cameraWorldY = sy / n;
    applyCamera();
    return true;
  }

  function setSelectedHunt(on) {
    const ids = GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
    ids.forEach((id) => {
      const u = getUnitById(id);
      if (u?.hp > 0 && u.canHunt) u.huntMode = !!on;
    });
    showMessage(on ? 'Selected units hunting.' : 'Selected units holding position.', 140);
  }

  function toggleSelectedHunt() {
    const ids = GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : [];
    const anyOff = ids.some((id) => {
      const u = getUnitById(id);
      return u?.canHunt && !u.huntMode;
    });
    setSelectedHunt(anyOff);
  }

  function restartCurrentWave() {
    if (svc('GameModes') && !svc('GameModes').canRestartWave()) {
      showMessage('Wave restart disabled — Ironman run.');
      return false;
    }
    if (GS.state !== 'playing' || GS.wave < 1) {
      showMessage('No active wave to restart.');
      return false;
    }
    if (isNightPhase()) {
      showMessage('Restart wave during day assault only.');
      return false;
    }
    GS.units
      .filter((u) => u.team === 'enemy')
      .forEach((u) => {
        u.hp = 0;
      });
    GS.spawnQueue = [];
    GS.spawnTimer = 0;
    buildSpawnQueue();
    GS.waveProgress = 0;
    addHighlight('wave', `Wave ${GS.wave} restarted`);
    showMessage(`Wave ${GS.wave} restarted.`, 200);
    return true;
  }

  function serializeUnitSnap(u) {
    return {
      id: u.id,
      type: u.type,
      x: u.x,
      y: u.y,
      team: u.team,
      hp: u.hp,
      maxHp: u.maxHp,
      damage: u.damage,
      accuracy: u.accuracy,
      range: u.range,
      baseRange: u.baseRange,
      meleeRange: u.meleeRange,
      speed: u.speed,
      combatType: u.combatType,
      projectile: u.projectile || null,
      siegeMult: u.siegeMult || 1,
      antiAir: !!u.antiAir,
      antiCavalry: !!u.antiCavalry,
      healAmount: u.healAmount || 0,
      moraleAuraUnit: u.moraleAuraUnit || 0,
      revealsStealth: !!u.revealsStealth,
      vetBronze: u.vetBronze,
      vetSilver: u.vetSilver,
      vetGold: u.vetGold,
      goldStarsEarned: u.goldStarsEarned || 0,
      lateAbilityUnlocked: !!u.lateAbilityUnlocked,
      vetTier: u.vetTier,
      honorName: u.honorName,
      experience: u.experience,
      morale: u.morale,
      maxMorale: u.maxMorale,
      perks: u.perks ? [...u.perks] : [],
      huntMode: u.huntMode,
      generalStars: u.generalStars,
      isGeneral: !!u.isGeneral,
      stationedKeep: u.stationedKeep,
      garrisoned: u.garrisoned || null,
      wallGarrisoned: u.wallGarrisoned || null,
      wallSlotIndex: u.wallSlotIndex ?? null,
      targetY: u.targetY,
      spawnWave: u.spawnWave ?? GS.wave,
      tenureApplied: u.tenureApplied ?? 0,
      vetUpgradeEligible: !!u.vetUpgradeEligible,
      baseMaxHp: u.baseMaxHp ?? null,
      baseDamage: u.baseDamage ?? null,
      ipScaleWave: u.ipScaleWave ?? 0,
      isWwe: !!u.isWwe,
      isCrossover: !!u.isCrossover,
      isDoomslayer: !!u.isDoomslayer,
      wweAbility: u.wweAbility || null,
      combatTag: u.combatTag || null,
      // Builder project links (re-resolved after buildings restore).
      buildTargetId: u.building?.id || null,
      buildQueueIds: Array.isArray(u.buildQueue)
        ? u.buildQueue
            .map((item) => {
              if (!item) return null;
              if (item.id) return { id: item.id };
              if (item.pending && item.type)
                return {
                  pending: true,
                  type: item.type,
                  x: item.x,
                  y: item.y,
                  facing: item.facing || null,
                };
              return null;
            })
            .filter(Boolean)
        : null,
    };
  }

  function collectAliveUnitSnaps() {
    // Always return a fresh array — shared scratch was mutated by later exports and
    // corrupted in-memory co-op handoffs that stored the snap by reference.
    const out = [];
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.hp > 0) out.push(serializeUnitSnap(u));
    }
    return out;
  }

  function exportGameState() {
    if (GS.state !== 'playing') return null;
    return {
      version: 1,
      savedAt: Date.now(),
      wave: GS.wave,
      tactical: GS.tactical,
      kills: GS.kills,
      misses: GS.misses,
      timeOfDay: GS.timeOfDay,
      nightTimer: GS.nightTimer,
      waveProgress: GS.waveProgress,
      difficultyId: GS.difficultyId,
      territoryTier: GS.territoryTier,
      worldW: GS.worldW,
      worldH: GS.worldH,
      globalHunt: GS.globalHunt,
      builderAutoRepair: GS.builderAutoRepair,
      tpAwardedForWave: GS.tpAwardedForWave,
      spawnQueue: [...GS.spawnQueue],
      waveEnemyTotal: GS.waveEnemyTotal,
      spawnTimer: GS.spawnTimer,
      currentHordeWave: GS.currentHordeWave ? { ...GS.currentHordeWave, queue: [...GS.currentHordeWave.queue] } : null,
      currentWaveConfig: GS.currentWaveConfig ? { ...GS.currentWaveConfig, pool: [...(GS.currentWaveConfig.pool || [])] } : null,
      runPlayerDeaths: GS.runPlayerDeaths,
      pendingLevy: GS.pendingLevy,
      pendingReinforce: [...GS.pendingReinforce],
      spawnDelayBonus: GS.spawnDelayBonus,
      courierCooldown: GS.courierCooldown,
      courierMessagesUsedThisWave: GS.courierMessagesUsedThisWave,
      courierUsedThisWave: isCourierMessageCapReached(),
      spyUsedThisWave: GS.spyUsedThisWave,
      doctrineUsedThisWave: GS.doctrineUsedThisWave,
      counterDoctrineUsedThisWave: GS.counterDoctrineUsedThisWave,
      expeditionUsedThisWave: GS.expeditionUsedThisWave,
      rallyTimer: GS.rallyTimer,
      firstWallWave: GS.firstWallWave,
      namedBossWave: GS.namedBossWave ? { ...GS.namedBossWave } : null,
      loadout: svc('ContentExpansion') ? svc('ContentExpansion').getLoadout() : 'balanced',
      waveModifiers: { ...GS.waveModifiers },
      pendingWaveMods: { ...GS.pendingWaveMods },
      fallenPool: GS.fallenPool.map((f) => ({ ...f })),
      // Mid-combat projectiles (arrows/bolts still in flight).
      projectiles: GS.projectiles.map((p) => ({
        x: p.x,
        y: p.y,
        tx: p.tx,
        ty: p.ty,
        type: p.type,
        damage: p.damage,
        team: p.team,
        speed: p.speed,
        accuracy: p.accuracy,
        targetId: p.targetId,
        sourceId: p.sourceId,
        sourceType: p.sourceType,
        splash: !!p.splash,
        angle: p.angle || 0,
      })),
      units: collectAliveUnitSnaps(),
      buildings: GS.buildings.map((b) => ({
        id: b.id,
        type: b.type,
        x: b.x,
        y: b.y,
        hp: b.hp,
        maxHp: b.maxHp,
        complete: b.complete,
        owner: b.owner,
        buildProgress: b.buildProgress,
        waveBuildRequired: b.waveBuildRequired || 0,
        waveBuildProgress: b.waveBuildProgress || 0,
        facing: b.facing || null,
        isHamlet: !!b.isHamlet,
        isMerchantGuild: !!b.isMerchantGuild,
        isAcademy: !!b.isAcademy,
        isResearchLab: !!b.isResearchLab,
        isEnemySettlement: !!b.isEnemySettlement,
        isResourceGen: !!b.isResourceGen,
        isSettlement: !!b.isSettlement,
        isWatchtower: !!b.isWatchtower,
        isKeep: !!b.isKeep,
        isMedical: !!b.isMedical,
        isMessHall: !!b.isMessHall,
        isWweAcademy: !!b.isWweAcademy,
        isCrossoverBarracks: !!b.isCrossoverBarracks,
        isPerkMachine: !!b.isPerkMachine,
        academyUnit: b.academyUnit || null,
        crossoverFaction: b.crossoverFaction || null,
        fortressTier: b.fortressTier || 0,
        garrisonUnitId: b.garrisonUnitId || null,
        slotX: b.slotX,
        slotY: b.slotY,
        castleGroup: b.castleGroup || null,
        enemyFaction: b.enemyFaction || null,
      })),
      sessionHighlights: [...GS.sessionHighlights],
      research: svc('Research') ? svc('Research').getSnapshot() : null,
      progressionRestarts:
        typeof ProgressionRestarts !== 'undefined' ? ProgressionRestarts.getSnapshot() : null,
      // Mode rules + advanced difficulty — required so load/quickload keeps fog/horde/challenge.
      advancedMods: svc('AdvancedDifficulty')
        ? svc('AdvancedDifficulty').getActiveIds()
        : [],
      modeSession: svc('GameModes') ? svc('GameModes').getSession() : null,
    };
  }

  function importGameState(snap) {
    if (!snap?.version) return false;
    try {
      GS.state = 'playing';
      GS.paused = true;
      GS.wave = snap.wave;
      GS.tactical = snap.tactical;
      GS.kills = snap.kills;
      GS.misses = snap.misses;
      GS.timeOfDay = snap.timeOfDay;
      GS.nightTimer = snap.nightTimer || 0;
      GS.waveProgress = snap.waveProgress || 0;
      GS.difficultyId = snap.difficultyId || GS.difficultyId;
      // Restore challenge/mode session and modifiers before units/combat use them.
      if (svc('GameModes') && snap.modeSession) {
        svc('GameModes').restoreSession(snap.modeSession);
      } else if (svc('AdvancedDifficulty') && Array.isArray(snap.advancedMods)) {
        svc('AdvancedDifficulty').setActive(snap.advancedMods);
      }
      GS.globalHunt = snap.globalHunt ?? GS.globalHunt;
      GS.builderAutoRepair = snap.builderAutoRepair ?? GS.builderAutoRepair;
      GS.tpAwardedForWave = snap.tpAwardedForWave ?? -1;
      GS.runPlayerDeaths = snap.runPlayerDeaths ?? snap.misses ?? 0;
      GS.pendingLevy = snap.pendingLevy ?? 0;
      GS.pendingReinforce = Array.isArray(snap.pendingReinforce) ? [...snap.pendingReinforce] : [];
      GS.spawnDelayBonus = snap.spawnDelayBonus ?? 0;
      GS.courierCooldown = Math.max(0, snap.courierCooldown | 0);
      GS.courierMessagesUsedThisWave =
        snap.courierMessagesUsedThisWave != null
          ? snap.courierMessagesUsedThisWave | 0
          : snap.courierUsedThisWave
            ? 1
            : 0;
      GS.spyUsedThisWave = !!snap.spyUsedThisWave;
      GS.doctrineUsedThisWave = !!snap.doctrineUsedThisWave;
      GS.counterDoctrineUsedThisWave = !!snap.counterDoctrineUsedThisWave;
      GS.expeditionUsedThisWave = !!snap.expeditionUsedThisWave;
      GS.rallyTimer = snap.rallyTimer ?? 0;
      GS.firstWallWave = snap.firstWallWave ?? null;
      GS.namedBossWave = snap.namedBossWave ? { ...snap.namedBossWave } : null;
      if (snap.waveModifiers) GS.waveModifiers = { ...snap.waveModifiers };
      if (snap.pendingWaveMods) GS.pendingWaveMods = { ...snap.pendingWaveMods };
      GS.fallenPool = Array.isArray(snap.fallenPool) ? snap.fallenPool.map((f) => ({ ...f })) : [];
      GS.sessionHighlights = snap.sessionHighlights || [];
      applyWorldSize(GS.wave);
      releaseAllUnits();
      GS.projectiles = [];
      releaseAllBuildings();
      GS.decorations = [];
      generateBattlefield();
      for (const bs of snap.buildings || []) {
        const b = createBuilding(bs.type, bs.x, bs.y, bs.owner || 'player', {
          facing: bs.facing || undefined,
          slotX: bs.slotX,
          slotY: bs.slotY,
          castleGroup: bs.castleGroup || undefined,
        });
        if (bs.id) b.id = bs.id;
        Object.assign(b, bs);
        if (bs.complete) b.complete = true;
        // Re-assert def flags so old saves missing fields still work.
        const def = BuildDefs[b.type];
        if (def) {
          if (def.isResearchLab) b.isResearchLab = true;
          if (def.isAcademy) b.isAcademy = true;
          if (def.academyUnit) b.academyUnit = b.academyUnit || def.academyUnit;
          if (def.isEnemySettlement) b.isEnemySettlement = true;
          if (def.isResourceGen) b.isResourceGen = true;
          if (def.isHamlet) b.isHamlet = true;
          if (def.isMerchantGuild) b.isMerchantGuild = true;
          if (def.isWatchtower) b.isWatchtower = true;
          if (def.isKeep) b.isKeep = true;
          if (def.isWweAcademy) b.isWweAcademy = true;
          if (def.isCrossoverBarracks) b.isCrossoverBarracks = true;
        }
        if (b.type === 'wall' && b.facing) {
          b.wallSlots = getWallSlotPositions(b.facing, b.x, b.y);
        }
        normalizeEnemyEconomyBuilding(b);
        ensureBuildingHealth(b);
        GS.buildings.push(b);
      }
      for (const us of snap.units || []) {
        ensurePlayerUnitDef(us.type);
        const u = createUnit(us.type, us.x, us.y, us.team || 'player');
        if (!u) continue;
        if (us.id) u.id = us.id;
        Object.assign(u, us);
        if (u.spawnWave == null) u.spawnWave = GS.wave;
        if (u.tenureApplied == null) u.tenureApplied = 0;
        u.maxHp = Math.max(1, us.maxHp || u.maxHp || 1);
        u.hp = Math.min(u.maxHp, Math.max(1, us.hp || u.hp));
        if (u.isGeneral == null) u.isGeneral = u.type === 'general';
        // Siege / expansion roster combat fields can vanish on older snaps.
        if (u.type === 'ballista') {
          if (!u.projectile) u.projectile = 'arrow';
          if (!(u.siegeMult > 1)) u.siegeMult = 2.2;
          if (u.combatType !== 'ranged' && u.combatType !== 'siege') u.combatType = 'ranged';
        }
        if ((u.combatType === 'ranged' || u.combatType === 'siege') && !u.projectile) {
          u.projectile = 'arrow';
        }
        if (typeof repairHonorName === 'function') repairHonorName(u);
        if (typeof ensureHealerStats === 'function') ensureHealerStats(u);
        if (svc('GameDepth') && u.team === 'player' && svc('GameDepth').isIpOperative(u)) {
          svc('GameDepth').applyIpWaveScaling(u, GS.wave);
        }
        if (typeof syncVeteranStatsToTier === 'function') syncVeteranStatsToTier(u);
        GS.units.push(u);
      }
      // Re-link outpost garrisons from unit.garrisoned (building.garrisonUnitId may be stale).
      for (const u of GS.units) {
        if (!u.garrisoned || u.team !== 'player') continue;
        const op = GS.buildings.find((b) => b.id === u.garrisoned);
        if (op && op.hp > 0) {
          op.garrisonUnitId = u.id;
          u.range = getEffectiveRange(u);
        } else {
          u.garrisoned = null;
        }
      }
      // Re-link builder projects so mid-construction sites aren't abandoned after load.
      for (const us of snap.units || []) {
        if (us.type !== 'builder' && us.combatType !== 'builder') continue;
        const builder = GS.units.find((u) => u.id === us.id);
        if (!builder) continue;
        builder.building = null;
        builder.buildQueue = [];
        if (us.buildTargetId) {
          const site = GS.buildings.find((b) => b.id === us.buildTargetId);
          if (site && !site.complete) builder.building = site;
        }
        if (Array.isArray(us.buildQueueIds)) {
          for (const item of us.buildQueueIds) {
            if (!item) continue;
            if (item.id) {
              const site = GS.buildings.find((b) => b.id === item.id);
              if (site && !site.complete) builder.buildQueue.push(site);
            } else if (item.pending && item.type) {
              builder.buildQueue.push({
                type: item.type,
                x: item.x,
                y: item.y,
                pending: true,
                facing: item.facing || undefined,
              });
            }
          }
        }
        delete builder.buildTargetId;
        delete builder.buildQueueIds;
      }
      GS.spawnQueue = [...(snap.spawnQueue || [])];
      GS.waveEnemyTotal = snap.waveEnemyTotal || GS.spawnQueue.length;
      GS.spawnTimer = snap.spawnTimer || 0;
      GS.currentHordeWave = snap.currentHordeWave
        ? { ...snap.currentHordeWave, queue: [...(snap.currentHordeWave.queue || [])] }
        : null;
      GS.currentWaveConfig = snap.currentWaveConfig
        ? { ...snap.currentWaveConfig, pool: [...(snap.currentWaveConfig.pool || [])] }
        : getWaveConfig(GS.wave);
      sanitizeTactical();
      invalidateObstacles();
      normalizeEnemyEconomyBuildings();
      GS.enemyEconomyEverSpawned = false;
      GS.northernHoldEverSpawned = false;
      for (const b of GS.buildings) noteEnemyEconomyPresence(b);
      refreshUnitCounts();
      resetCamera();
      GS.spatialFrame = -1;
      if (svc('Research') && snap.research) svc('Research').restoreSnapshot(snap.research);
      if (typeof ProgressionRestarts !== 'undefined') {
        if (snap.progressionRestarts) {
          ProgressionRestarts.restoreSnapshot(snap.progressionRestarts);
        } else {
          ProgressionRestarts.syncFiredThroughWave(GS.wave);
        }
      }
      if (svc('ContentExpansion')?.setLoadout && snap.loadout) {
        svc('ContentExpansion').setLoadout(snap.loadout, { silent: true });
      }
      // Restore in-flight projectiles after units exist so target/source ids resolve.
      GS.projectiles = Array.isArray(snap.projectiles)
        ? snap.projectiles.map((p) => ({
            x: p.x,
            y: p.y,
            tx: p.tx,
            ty: p.ty,
            type: p.type || 'arrow',
            damage: p.damage || 10,
            team: p.team || 'player',
            speed: p.speed || 6,
            accuracy: p.accuracy ?? 40,
            targetId: p.targetId || null,
            sourceId: p.sourceId || null,
            sourceType: p.sourceType || null,
            splash: !!p.splash,
            angle: p.angle || 0,
          }))
        : [];
      wireGameContext();
      if (svc('UX')) svc('UX').onPauseChanged(true);
      syncInteractionState({ refreshCounts: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  function quickSave() {
    if (GS.creativeMode) {
      showMessage('Quick save disabled in Creative Mode.');
      return false;
    }
    if (svc('GameModes') && !svc('GameModes').canQuickSave()) {
      showMessage('Quick save disabled — Ironman or challenge run.');
      return false;
    }
    const snap = exportGameState();
    if (!snap) {
      showMessage('Cannot save now.');
      return false;
    }
    if (typeof SaveThumbnail !== 'undefined') {
      const thumb = SaveThumbnail.capture({ canvas: GS.canvas, minimapData: getMinimapData() });
      if (thumb) snap.thumbnail = thumb;
    }
    try {
      localStorage.setItem(QUICKSAVE_KEY, JSON.stringify(snap));
      showMessage(`Quick saved at wave ${GS.wave}.`, 200);
      if (svc('UX')?.updatePauseMenu) svc('UX').updatePauseMenu(getState());
      return true;
    } catch (_) {
      showMessage('Quick save failed.', 160);
      return false;
    }
  }

  

  

  function quickLoad() {
    if (svc('GameModes') && !svc('GameModes').canQuickSave()) {
      showMessage('Quick load disabled — Ironman or challenge run.');
      return false;
    }
    try {
      const raw = localStorage.getItem(QUICKSAVE_KEY);
      if (!raw) {
        showMessage('No quick save found.');
        return false;
      }
      const snap = JSON.parse(raw);
      if (!importGameState(snap)) {
        showMessage('Quick load failed.', 160);
        return false;
      }
      showMessage(`Quick load: wave ${GS.wave}.`, 240);
      return true;
    } catch (_) {
      showMessage('Quick load failed.', 160);
      return false;
    }
  }

  function quitToMenu() {
    if (GS.state === 'playing' && !GS.creativeMode && typeof Analytics !== 'undefined') {
      Analytics.onRunAbandon(GS.wave);
    }
    if (svc('GameModes')) svc('GameModes').endSession();
    GS.state = 'menu';
    GS.paused = false;
    const audio = svc('AudioEngine') || (typeof AudioEngine !== 'undefined' ? AudioEngine : null);
    try {
      audio?.stopMusic?.();
    } catch (_) {
      /* audio optional */
    }
    if (typeof UI !== 'undefined' && UI.showMainMenu) UI.showMainMenu();
    else document.getElementById('menu-screen')?.classList.add('active');
    audio
      ?.resume?.()
      ?.then?.((ok) => {
        if (ok) audio.startMenuMusic?.();
      });
    if (svc('UX')) {
      svc('UX').clearTutorialHighlights?.();
      svc('UX').onPauseChanged(false);
    }
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
    if (!svc('ColonyValue') || !svc('ColonyValue').computeEvolutionMeter || GS.state !== 'playing') {
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
    if (GS.stateFrameId === GS.presentationFrame && GS.stateFrameCache) return GS.stateFrameCache;
    const army = unitCounts.player;
    const liveColony = getLiveColonyState();
    const displayColony = liveColony.colony || GS.colonySnapshot;
    const grandStrategySnap = pathSnap('grandStrategyState', 150, () =>
      svc('GrandStrategy') ? svc('GrandStrategy').getStateSnapshot({ wave: GS.wave }) : null
    );
    const intergalacticSnap = pathSnap('intergalacticState', 400, () =>
      svc('IntergalacticLayer') ? svc('IntergalacticLayer').getStateSnapshot({ wave: GS.wave }) : null
    );
    const thematicSynergySnap = getThematicSynSnap();
    const snapshot = {
      state: GS.state,
      victoryReason: GS.victoryReason,
      tactical: GS.tactical,
      maxTactical: null,
      wave: GS.wave,
      totalWaves: null,
      infiniteWaves: true,
      enemyEconomyRemaining: unitCounts.enemyEconomy,
      enemyEconomyActive: GS.enemyEconomyEverSpawned,
      northernHoldsRemaining: unitCounts.northernHolds,
      northernHoldEverSpawned: GS.northernHoldEverSpawned,
      kills: GS.kills,
      misses: GS.runPlayerDeaths,
      playerDeaths: GS.runPlayerDeaths,
      unitProducers: unitCounts.unitProducers,
      creativeMode: GS.creativeMode,
      creativeTool: GS.creativeTool,
      creativeSpawnType: GS.creativeSpawnType,
      creativeSettings: { ...GS.creativeSettings },
      creativeSettingsSig: getCreativeSettingsSig(),
      difficulty: GS.difficultyId,
      difficultyLabel: getDifficulty().label,
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
        typeof getUnlockedKingdomDoctrines === 'function' ? getUnlockedKingdomDoctrines(GS.wave) : []
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
      planetConquest: pathSnap('planetConquest', typeof PlanetConquest !== 'undefined' ? PlanetConquest.WAVE_MIN : 500, () =>
        svc('PlanetConquest')
          ? svc('PlanetConquest').getStateSnapshot(
              GS.wave,
              GS.worldW,
              GS.worldH,
              GS.buildings,
              GS.units,
              getRunModeId()
            )
          : null
      ),
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
      grandStrategyMidBranches: pathSnap('grandStrategyMidBranches', 150, () =>
        typeof GrandStrategyMidBranches !== 'undefined'
          ? GrandStrategyMidBranches.getStateSnapshot({ wave: GS.wave })
          : null
      ),
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
        () =>
          svc('PlanetWarfare')
            ? svc('PlanetWarfare').getStateSnapshot(GS.wave, GS.worldW, GS.worldH, GS.buildings, GS.units)
            : null
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
          ? svc('MultiFrontSiege').getStateSnapshot(
              GS.wave,
              cachedSnap('enemyActiveFactions', () =>
                svc('EnemyFactions').getActiveFactions(GS.wave)
              )
            )
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
        svc('OperativeSkillTrees') ? svc('OperativeSkillTrees').getSnapshot(GS.wave, GS.units) : null
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
      hasWweAcademy: unitCounts.hasWweAcademy,
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
        svc('MetaProgress').isWweUnlocked() ||
        (svc('Research') && svc('Research').isFactionUnlocked('wwe', getResearchOpts())),
      doomslayerUnlocked:
        (GS.creativeMode && GS.creativeSettings.unlockAll) ||
        svc('MetaProgress').isDoomslayerHeroUnlocked() ||
        (svc('Research') && svc('Research').isDoomResearchUnlocked(getResearchOpts())),
      crossoverUnlocked: (GS.creativeMode && GS.creativeSettings.unlockAll) || isAnyCrossoverAccess(),
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
        svc('Achievements') ? svc('Achievements').getCount() : { unlocked: 0, total: 1450 }
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
      grandStrategy: grandStrategySnap,
      intergalactic: intergalacticSnap,
      layerModes: cachedSnap('layerModes', () =>
        typeof LayerDesign !== 'undefined'
          ? LayerDesign.getModesSnapshot({
              wave: GS.wave,
              phase: isNightPhase() ? 'night' : 'day',
              grandStrategy: grandStrategySnap,
              intergalactic: intergalacticSnap,
              planetConquest:
                svc('PlanetConquest') && svc('PlanetConquest').getStateSnapshot
                  ? svc('PlanetConquest').getStateSnapshot(GS.wave)
                  : null,
            })
          : null
      ),
      progressionRestart: cachedSnap('progressionRestart', () =>
        typeof ProgressionRestarts !== 'undefined'
          ? ProgressionRestarts.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      hybridMoments: cachedSnap('hybridMoments', () =>
        typeof HybridMoments !== 'undefined'
          ? HybridMoments.getStateSnapshot({ wave: GS.wave })
          : null
      ),
      pacingTools: cachedSnap('pacingTools', () =>
        typeof PacingTools !== 'undefined'
          ? PacingTools.getStateSnapshot({ wave: GS.wave, gameSpeed: GS.gameSpeed, paused: GS.paused })
          : null
      ),
      grandStrategyHooks:
        svc('GrandStrategy') && svc('GrandStrategy').isActive(GS.wave)
          ? getGrandStrategyTacticalHooks()
          : null,
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
      reason = 'Research the matching academy node (e.g. Academy Charter) at the Research Lab.';
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

  return {
    init,
    start,
    update,
    updatePresentation,
    draw,
    handleClick,
    isPlaying,
    selectDeploy,
    selectAbility,
    useAbility,
    selectBuild,
    selectDemolish,
    selectMoveBuilding,
    selectRotateWall,
    cycleWallPlacementFacing,
    selectCourierMessage,
    executeSpyAction,
    sendCourierMessage,
    executeDoctrine,
    executeCounterDoctrine,
    dispatchExpedition,
    dispatchRaidStrike,
    respondMapEvent,
    toggleGlobalHunt,
    toggleHunt,
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
    endGame,
    getGameSpeed,
    setGameSpeed,
    cycleGameSpeed,
    resetSimClock,
    getSimulationSteps,
    GAME_SPEED_OPTIONS:
      typeof PacingTools !== 'undefined' ? PacingTools.SPEED_OPTIONS : [1, 1.5, 2, 3, 4, 5, 6, 8, 10],
    getSelectedUnitsInfo,
    getMinimapData,
    panCameraToFraction,
    focusSelection,
    focusWorld,
    onPlanetConquestSurfaceDeploy,
    setHazardSpawnOpts,
    setSelectedHunt,
    toggleSelectedHunt,
    setSelectionFormation,
    cycleSelectionFormation,
    reformSelectionFormation,
    moveSelectionToWorld,
    restartCurrentWave,
    quickSave,
    quickLoad,
    hasQuickSave,
    getQuickSaveMeta,
    quitToMenu,
    getSessionHighlights,
    exportGameState,
    importGameState,
    setDifficulty,
    getDifficultyId: () => GS.difficultyId,
    recruitWweSuperstar,
    recruitCrossoverOperative,
    purchaseOperativeSkill,
    applyCheatEffect,
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
    creativeSpawnSquadAt,
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
    getPointerScreen,
    zoomCameraAt,
    zoomCameraToScale,
    getCameraZoom,
    isScreenInMapViewport,
    isScreenInMapArea,
    setCameraKey,
    onSettingsChanged,
    wasDragPan: () => GS.dragMoved,
    setLoadout: (id) => svc('ContentExpansion') && svc('ContentExpansion').setLoadout(id),
    getLoadout: () => (svc('ContentExpansion') ? svc('ContentExpansion').getLoadout() : 'balanced'),
    getLoadouts: () => (svc('ContentExpansion') ? svc('ContentExpansion').getLoadouts() : {}),
    startResearch,
    cancelResearch,
    startBranchTech,
    cancelBranchTech,
    upgradeSelectedVeteran,
    ascendSelectedUnit,
    recruitSelectedEcho,
    getAsymmetricMods,
    getAsymmetricSnapshot,
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
