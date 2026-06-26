/**
 * Myth and Blood — full tactical systems.
 */
const Game = (() => {
  let worldW = BASE_FIELD_W, worldH = BASE_FIELD_H;
  let territoryTier = 0;
  let deployY = getDeployY(BASE_FIELD_H);
  let rallyY = getDefaultRallyY(BASE_FIELD_H);

  let canvas, ctx, viewX = 0, viewY = 0, viewScale = 1;
  let baseViewScale = 1;
  let cameraZoom = 1;
  let cameraWorldX = 0;
  let cameraWorldY = 0;
  let cameraPlaced = false;
  const CAMERA_MIN_ZOOM = 0.4;
  const CAMERA_MAX_ZOOM = 8;
  const CAMERA_ARROW_SPEED = 9;
  const DRAG_THRESHOLD = 7;
  let isPanning = false;
  let dragMoved = false;
  let panAnchor = null;
  const cameraKeys = { up: false, down: false, left: false, right: false };
  let sortedUnitsCache = [];
  let sortedUnitsFrame = -1;
  let updateTick = 0;
  let visibleBoundsCache = null;
  let state = 'menu', units = [], projectiles = [], decorations = [], buildings = [];
  let moveMarkers = [], tactical = STARTING_TP, wave = 0, kills = 0, misses = 0;
  let spawnQueue = [], spawnTimer = 0, waveTimer = 0, spawnDelayBonus = 0;
  let selectedDeploy = null, selectedAbility = null, selectedBuild = null;
  let selectedDemolish = false, selectedMoveBuilding = false, moveBuildingTarget = null;
  let selectedRotateWall = false, pendingWallFacing = 'north';
  let selectedUnitId = null, selectedUnitIds = [], selectedCourierMsg = null, paused = false, messages = [];
  const GAME_SPEED_OPTIONS = [1, 1.5, 2, 3, 4];
  let gameSpeed = 1;
  let speedAccumulator = 0;
  let boxSelect = null;
  let sessionHighlights = [];
  const QUICKSAVE_KEY = 'myth-and-blood-quicksave';
  let tpAwardedForWave = -1;
  let pathfindBudget = 24;
  let spatialFrame = -1;
  const TP_SANITY_CAP = 500000;
  let spyNetwork = true;
  let waveModifiers = { countMult: 1, hpMult: 1, noElites: false, revealed: false, nextPreview: '' };
  let pendingWaveMods = { countMult: 1, hpMult: 1, noElites: false, stealReduction: 0 };
  let pendingReinforce = [], pendingLevy = 0, courierCooldown = 0, courierUsedThisWave = false;
  let spyUsedThisWave = false, currentWaveConfig = null;
  let difficultyId = 'normal';
  let globalHunt = true;
  let firstWallWave = null;
  let rallyTimer = 0;
  let waveProgress = 0;
  let waveEnemyTotal = 0;
  let waveAttackSides = ['north'];
  let pointerScreen = { sx: -1, sy: -1 };
  let moraleAlertCooldown = 0;
  let moraleCascadeState = { recentBreaks: [], cascade: false, tick: 0 };
  let lastStandActive = false;
  let nextWaveIntel = '';
  let colonySnapshot = null;
  let colonyThreatMods = { countMult: 1, hpMult: 1, dmgMult: 1, intervalMult: 1, weights: {}, eliteSlots: 0 };
  let bossTrackId = null;
  let namedBossWave = null;
  let currentHordeWave = null;
  let hazards = [];
  let mapsRevealed = false;
  let builderAutoRepair = true;
  let generalThreatCount = 0;
  let unmannedWallWarned = false;
  let timeOfDay = 'day';
  let nightTimer = 0;
  let fallenPool = [];
  let creativeMode = false;
  let creativeTool = null;
  let creativeSpawnType = null;
  const CREATIVE_DEFAULTS = {
    freeResources: true, noGameOver: true, noAutoCycle: true,
    instantBuild: true, unlockAll: true, academyDeploy: true,
    enableAchievements: false, useCampaignRules: false,
    startTp: 9999, startWave: 0,
  };
  let creativeSettings = { ...CREATIVE_DEFAULTS };
  let creativeCustomWave = null;

  function init(cvs) {
    if (!cvs) {
      console.warn('Game.init: no canvas');
      return false;
    }
    canvas = cvs;
    ctx = canvas.getContext('2d');
    if (!ctx) return false;
    applyWorldSize(0);
    resetCamera();
    window.addEventListener('resize', resize);
    bindContentExpansion();
    return true;
  }

  function getMapBounds() {
    return { minX: 14, maxX: worldW - 14, minY: 20, maxY: worldH - 8 };
  }

  function applyWorldSize(waveNum) {
    const size = getWorldSize(waveNum);
    worldW = size.w;
    worldH = size.h;
    territoryTier = size.tier;
    deployY = getDeployY(worldH);
    rallyY = getDefaultRallyY(worldH);
    Pathfinding.init(worldW, worldH);
    if (typeof Spatial !== 'undefined') Spatial.init(worldW, worldH);
    return size;
  }

  function bindContentExpansion() {
    if (typeof ContentExpansion === 'undefined') return;
    ContentExpansion.bind({
      get units() { return units; },
      get buildings() { return buildings; },
      get decorations() { return decorations; },
      get worldW() { return worldW; },
      get deployY() { return deployY; },
      get rallyY() { return rallyY; },
      get wave() { return wave; },
      get tactical() { return tactical; },
      set tactical(v) { tactical = v; },
      get pendingWaveMods() { return pendingWaveMods; },
      get updateTick() { return updateTick; },
      get mapsRevealed() { return mapsRevealed; },
      set mapsRevealed(v) { mapsRevealed = v; },
      showMessage,
      damageInRadius,
      takeDamage,
      createUnit(type, x, y, team, opts = {}) {
        return spawnUnit(type, x, y, team, opts);
      },
      invalidateObstacles,
      getEnemyAdvancePoint,
      ach,
    });
    if (typeof FactionDepth !== 'undefined') {
      FactionDepth.bind({
        get units() { return units; },
        showMessage,
        damageInRadius,
        takeDamage,
        unitDistance,
        ach,
        getStarCount: getTotalStarCount,
        getDayLight: getDayLightLevel,
        addTactical(amount) {
          tactical += amount;
          sanitizeTactical();
        },
      });
    }
    if (typeof ColonyValue !== 'undefined') {
      ColonyValue.bind({
        get units() { return units; },
        get buildings() { return buildings; },
        get tactical() { return tactical; },
        get wave() { return wave; },
        getSettlementTpBonus,
        getTpPerRound,
        countPlayerWalls,
        countPlayerHamlets,
        countPlayerGuilds,
      });
    }
  }

  function getMapViewH() {
    return worldH + 50;
  }

  function resetCamera() {
    cameraZoom = 1;
    cameraWorldX = worldW / 2;
    cameraWorldY = getMapViewH() / 2;
    cameraPlaced = true;
    applyCamera();
  }

  function getCameraViewport() {
    const insets = getPanelInsets();
    const width = Math.max(1, canvas.width - insets.left - insets.right);
    const height = Math.max(1, canvas.height - insets.top - insets.bottom);
    return {
      left: insets.left,
      top: insets.top,
      width,
      height,
      centerX: insets.left + width / 2,
      centerY: insets.top + height / 2,
    };
  }

  function clampCameraToBounds() {
    if (!canvas) return;
    const mapH = getMapViewH();
    const vp = getCameraViewport();
    const halfW = vp.width / (2 * viewScale);
    const halfH = vp.height / (2 * viewScale);

    if (worldW <= vp.width / viewScale) cameraWorldX = worldW / 2;
    else cameraWorldX = Math.max(halfW, Math.min(worldW - halfW, cameraWorldX));

    if (mapH <= vp.height / viewScale) cameraWorldY = mapH / 2;
    else cameraWorldY = Math.max(halfH, Math.min(mapH - halfH, cameraWorldY));

    viewX = vp.centerX - cameraWorldX * viewScale;
    viewY = vp.centerY - cameraWorldY * viewScale;
    visibleBoundsCache = null;
  }

  function applyCamera() {
    viewScale = baseViewScale * cameraZoom;
    clampCameraToBounds();
  }

  function getPanelInsets() {
    if (typeof Settings !== 'undefined') return Settings.getPanelInsets();
    return { left: 84, right: 78, top: 52, bottom: 40 };
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const insets = getPanelInsets();
    const margin = 16;
    baseViewScale = Math.min(
      (canvas.width - insets.left - insets.right - margin) / worldW,
      (canvas.height - insets.top - insets.bottom - margin) / getMapViewH()
    );
    if (!cameraPlaced) {
      cameraWorldX = worldW / 2;
      cameraWorldY = getMapViewH() / 2;
      cameraPlaced = true;
    }
    applyCamera();
  }

  function getVisibleBounds(pad = 90) {
    if (visibleBoundsCache) return visibleBoundsCache;
    if (!canvas) {
      return { left: -9999, top: -9999, right: 99999, bottom: 99999 };
    }
    const vp = getCameraViewport();
    const m = pad / Math.max(0.25, viewScale);
    visibleBoundsCache = {
      left: (vp.left - viewX) / viewScale - m,
      top: (vp.top - viewY) / viewScale - m,
      right: (vp.left + vp.width - viewX) / viewScale + m,
      bottom: (vp.top + vp.height - viewY) / viewScale + m,
    };
    return visibleBoundsCache;
  }

  function isInView(x, y, radius = 0, pad = 90) {
    const b = getVisibleBounds(pad);
    return x + radius >= b.left && x - radius <= b.right &&
      y + radius >= b.top && y - radius <= b.bottom;
  }

  function updateCamera() {
    if (state !== 'playing') return;
    let moved = false;
    const step = CAMERA_ARROW_SPEED / Math.max(0.55, cameraZoom);
    if (cameraKeys.up) { cameraWorldY -= step; moved = true; }
    if (cameraKeys.down) { cameraWorldY += step; moved = true; }
    if (cameraKeys.left) { cameraWorldX -= step; moved = true; }
    if (cameraKeys.right) { cameraWorldX += step; moved = true; }
    if (moved) applyCamera();
  }

  function onSettingsChanged() {
    visibleBoundsCache = null;
    if (typeof GfxQuality !== 'undefined' && typeof Settings !== 'undefined') {
      GfxQuality.setMode(Settings.get('performanceMode') || 'auto');
    }
    resize();
  }

  function zoomCameraAt(screenX, screenY, deltaY) {
    if (state !== 'playing') return;
    const before = screenToWorld(screenX, screenY);
    const zoomSpeed = typeof Settings !== 'undefined' ? Settings.getCameraZoomSpeed() : 1;
    const step = 1 + 0.11 * zoomSpeed;
    const factor = deltaY < 0 ? step : 1 / step;
    cameraZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, cameraZoom * factor));
    applyCamera();
    const after = screenToWorld(screenX, screenY);
    cameraWorldX += before.x - after.x;
    cameraWorldY += before.y - after.y;
    applyCamera();
  }

  function canBoxSelectNow() {
    return !selectedDeploy && !selectedAbility && !selectedBuild && !selectedCourierMsg
      && !selectedDemolish && !selectedMoveBuilding && !selectedRotateWall
      && !(creativeMode && creativeTool);
  }

  function handlePointerDown(sx, sy, button = 0, opts = {}) {
    if (state !== 'playing') return;
    if (!opts.pan && button === 0 && canBoxSelectNow()) {
      boxSelect = { startSx: sx, startSy: sy, endSx: sx, endSy: sy };
      isPanning = false;
      panAnchor = null;
      dragMoved = false;
      return;
    }
    if (button !== 0 && !opts.pan) return;
    isPanning = true;
    dragMoved = false;
    panAnchor = { sx, sy, cx: cameraWorldX, cy: cameraWorldY };
  }

  function handlePointerMove(sx, sy) {
    pointerScreen = { sx, sy };
    if (boxSelect) {
      boxSelect.endSx = sx;
      boxSelect.endSy = sy;
      const dx = sx - boxSelect.startSx;
      const dy = sy - boxSelect.startSy;
      if (!dragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        dragMoved = true;
        if (canvas) canvas.style.cursor = 'crosshair';
      }
      return;
    }
    if (!isPanning || !panAnchor) return;
    const dx = sx - panAnchor.sx;
    const dy = sy - panAnchor.sy;
    if (!dragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      dragMoved = true;
      canvas.style.cursor = 'grabbing';
    }
    if (!dragMoved) return;
    cameraWorldX = panAnchor.cx - dx / viewScale;
    cameraWorldY = panAnchor.cy - dy / viewScale;
    applyCamera();
  }

  function finalizeBoxSelect() {
    if (!boxSelect) return;
    const x1 = Math.min(boxSelect.startSx, boxSelect.endSx);
    const y1 = Math.min(boxSelect.startSy, boxSelect.endSy);
    const x2 = Math.max(boxSelect.startSx, boxSelect.endSx);
    const y2 = Math.max(boxSelect.startSy, boxSelect.endSy);
    const w1 = screenToWorld(x1, y1);
    const w2 = screenToWorld(x2, y2);
    const minX = Math.min(w1.x, w2.x);
    const maxX = Math.max(w1.x, w2.x);
    const minY = Math.min(w1.y, w2.y);
    const maxY = Math.max(w1.y, w2.y);
    const ids = units.filter(u =>
      u.team === 'player' && u.hp > 0 &&
      u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY
    ).map(u => u.id);
    selectedUnitIds = ids;
    selectedUnitId = ids[0] || null;
    if (ids.length) {
      showMessage(`${ids.length} unit(s) selected.`, 120);
      AudioEngine.SFX.click();
    }
  }

  function handlePointerUp() {
    if (boxSelect) {
      if (dragMoved) finalizeBoxSelect();
      boxSelect = null;
      isPanning = false;
      panAnchor = null;
      dragMoved = false;
      if (canvas) canvas.style.cursor = 'grab';
      return !dragMoved;
    }
    const wasClick = isPanning && !dragMoved;
    isPanning = false;
    panAnchor = null;
    dragMoved = false;
    if (canvas) canvas.style.cursor = 'grab';
    return wasClick;
  }

  function setCameraKey(key, pressed) {
    switch (key) {
      case 'arrowup': cameraKeys.up = pressed; break;
      case 'arrowdown': cameraKeys.down = pressed; break;
      case 'arrowleft': cameraKeys.left = pressed; break;
      case 'arrowright': cameraKeys.right = pressed; break;
      default: break;
    }
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - viewX) / viewScale, y: (sy - viewY) / viewScale };
  }

  function clampPos(x, y) {
    const b = getMapBounds();
    return { x: Math.max(b.minX, Math.min(b.maxX, x)), y: Math.max(b.minY, Math.min(b.maxY, y)) };
  }

  const DECO_GAP = 8;

  function unitFootprint(unit) {
    const scale = unit.spriteScale || 1;
    return ((SpriteGen.UNIT_STYLE[unit.spriteType] || { size: 9 }).size + UNIT_COLLISION + 6) * scale;
  }

  function overlapsAnyUnit(x, y, obstacleRadius, margin = DECO_GAP) {
    for (const u of units) {
      if (u.hp <= 0) continue;
      if (Math.hypot(x - u.x, y - u.y) < obstacleRadius + unitFootprint(u) + margin) return true;
    }
    return false;
  }

  function overlapsPlacedDecorations(x, y, radius, placed) {
    for (const d of placed) {
      if (Math.hypot(x - d.x, y - d.y) < radius + d.radius + DECO_GAP) return true;
    }
    return false;
  }

  function overlapsBuildings(x, y, radius) {
    for (const b of buildings) {
      const br = terrainBlockRadius(b);
      if (br <= 0) continue;
      if (Math.hypot(x - b.x, y - b.y) < radius + br + DECO_GAP) return true;
    }
    return false;
  }

  function isDecorationSpotClear(x, y, radius, placed) {
    return !overlapsAnyUnit(x, y, radius) &&
      !overlapsPlacedDecorations(x, y, radius, placed) &&
      !overlapsBuildings(x, y, radius);
  }

  function pickDecorationSpot(type, placed, maxAttempts = 50) {
    const radius = type === 'tree' ? 14 : 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = 50 + Math.random() * (worldW - 100);
      const y = 80 + Math.random() * (worldH - 160);
      if (isDecorationSpotClear(x, y, radius, placed)) return { x, y, radius };
    }
    return null;
  }

  function resolveUnitsInTerrain() {
    for (const u of units) {
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
    const placed = [...decorations];
    const count = 4 + territoryTier * 2;

    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      let x, y, tries = 0;
      do {
        if (worldH > prevH && Math.random() < 0.55) {
          x = 40 + Math.random() * (worldW - 80);
          y = prevH + 20 + Math.random() * (worldH - prevH - 70);
        } else if (worldW > prevW) {
          const side = (worldW - prevW) / 2;
          const left = Math.random() < 0.5;
          x = left ? 20 + Math.random() * (side - 30) : worldW - side + 10 + Math.random() * (side - 30);
          y = 80 + Math.random() * (worldH - 160);
        } else {
          x = 50 + Math.random() * (worldW - 100);
          y = 80 + Math.random() * (worldH - 160);
        }
        tries++;
      } while (tries < 30 && !isDecorationSpotClear(x, y, t === 'tree' ? 14 : 10, placed));

      if (tries >= 30) continue;
      const radius = t === 'tree' ? 14 : 10;
      const deco = {
        type: t, id: 'deco_exp_' + Date.now() + '_' + i,
        x, y,
        size: t === 'tree' ? 18 + Math.random() * 10 : 12 + Math.random() * 6,
        hp: 999, blocksMove: true, blocksLOS: true,
        cover: t === 'rock' ? 0.3 : 0.45,
        radius,
      };
      decorations.push(deco);
      placed.push(deco);
    }
    invalidateObstacles();
  }

  function tryExpandTerritory() {
    if (wave <= 0 || wave % MAP_EXPAND_EVERY !== 0) return false;
    const prevW = worldW, prevH = worldH;
    applyWorldSize(wave);
    if (worldW === prevW && worldH === prevH) return false;

    SpriteGen.invalidateBattlefieldCache();
    populateNewTerritory(prevW, prevH);
    resize();
    applyCamera();

    units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
      if (!u.manualOrder && !u.garrisoned && !u.stationedKeep && !u.wallGarrisoned) {
        u.targetY = rallyY;
      }
    });

    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][territoryTier] || String(territoryTier);
    addHighlight('territory', `Land ${roman} unlocked — map now ${worldW}×${worldH}`);
    showMessage(`Territory expanded! Realm now spans Land ${roman} (${worldW}×${worldH})`, 300);
    FloatingText.status(worldW / 2, worldH / 2, 'LAND GAINED', '#f0d060');
    Particles.dust(worldW / 2, worldH - 40);
    AudioEngine.SFX.reinforce();
    return true;
  }

  function generateBattlefield() {
    const preserved = decorations.filter(d => d.type === 'barricade' && d.hp > 0);
    decorations = [...preserved];
    const types = ['tree', 'tree', 'rock'];
    const placed = [...preserved];
    const decoCount = 8 + territoryTier * 3;

    for (let i = 0; i < decoCount; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const spot = pickDecorationSpot(t, placed);
      if (!spot) continue;

      const deco = {
        type: t, id: 'deco_' + i,
        x: spot.x, y: spot.y,
        size: t === 'tree' ? 18 + Math.random() * 10 : 12 + Math.random() * 6,
        hp: 999, blocksMove: true, blocksLOS: true,
        cover: t === 'rock' ? 0.3 : 0.45,
        radius: spot.radius,
      };
      decorations.push(deco);
      placed.push(deco);
    }

    if (typeof GameDepth !== 'undefined') {
      hazards = GameDepth.spawnHazards(worldW, worldH, territoryTier, rallyY);
    }
    if (typeof ContentExpansion !== 'undefined') {
      ContentExpansion.spawnDestructibles(decorations, worldW, worldH, rallyY, territoryTier);
    }
    invalidateObstacles();
    resolveUnitsInTerrain();
  }

  function isPlayerFriendlyWall(obs, unit) {
    if (!obs || unit?.team !== 'player') return false;
    const wallType = obs.type || obs.ref?.type;
    if (wallType !== 'wall') return false;
    const owner = obs.owner ?? obs.ref?.owner;
    return owner !== 'enemy';
  }

  function obstacleBlocksForUnit(obs, unit) {
    if (obs.hp <= 0 || obs.blocksMove === false) return false;
    if (isPlayerFriendlyWall(obs, unit)) return false;
    if ((obs.type || obs.ref?.type) === 'wall' && obs.siegeTowerId) {
      const tower = units.find(u => u.id === obs.siegeTowerId && u.hp > 0 && u.siegeDeployed);
      if (tower && unit?.team === 'enemy') return false;
    }
    return true;
  }

  function unitHasActiveMarch(unit) {
    if (!unit || unit.hp <= 0) return false;
    return !!(unit.path?.length || unit.huntMode || unit.manualOrder || unit.retreatingToMed ||
      (unit.type === 'builder' && builderHasWork(unit)) ||
      hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit));
  }

  function enemyIsAdvancing(unit) {
    return unit?.team === 'enemy' && unit.hp > 0 &&
      (!!unit.path?.length || (unit.targetY != null && unit.y < unit.targetY - 6));
  }

  let obstaclesCache = null;
  let obstaclesDirty = true;
  let losObstaclesCache = null;
  let incompleteBuildSig = '';
  let engagerCacheFrame = -1;
  const engagerCache = new Map();
  let unitByIdFrame = -1;
  const unitById = new Map();

  function invalidateObstacles() {
    obstaclesDirty = true;
    obstaclesCache = null;
    losObstaclesCache = null;
    if (typeof Pathfinding !== 'undefined') Pathfinding.clearCache?.();
  }

  function getIncompleteBuildSig() {
    let sig = '';
    for (const b of buildings) {
      if (!b.complete && b.hp > 0 && b.blocksMove !== false && buildingBlocksTerrain(b)) {
        sig += `${b.id}:${Math.floor(b.buildProgress || 0)};`;
      }
    }
    return sig;
  }

  function getLosObstacles() {
    if (!obstaclesDirty && losObstaclesCache) return losObstaclesCache;
    const obs = allObstacles();
    losObstaclesCache = obs.filter(o => o.blocksLOS);
    return losObstaclesCache;
  }

  function sanitizeTactical() {
    if (!Number.isFinite(tactical)) tactical = STARTING_TP;
    if (tactical < 0) tactical = 0;
    if (!creativeMode && tactical > TP_SANITY_CAP) tactical = TP_SANITY_CAP;
  }

  function rebuildSpatialIndex() {
    if (typeof Spatial === 'undefined') return;
    const spatialInterval = typeof GfxQuality !== 'undefined' ? (GfxQuality.get().spatialInterval || 1) : 1;
    if (spatialInterval > 1 && spatialFrame >= 0 && updateTick % spatialInterval !== 0) return;
    if (spatialFrame === updateTick) return;
    spatialFrame = updateTick;
    Spatial.rebuild(units, buildings, decorations);
  }

  function getGfxQuality() {
    return typeof GfxQuality !== 'undefined' ? GfxQuality.get() : null;
  }

  function isUnitSelected(u) {
    return u.id === selectedUnitId || selectedUnitIds.includes(u.id);
  }

  function gfxOverlayFor(u, mode) {
    if (!mode) return false;
    if (typeof GfxQuality !== 'undefined') {
      return GfxQuality.shouldDrawUnitOverlay(u, { primary: selectedUnitId, list: selectedUnitIds }, mode);
    }
    return mode === true || mode === 'all' || (mode === 'selected' && isUnitSelected(u));
  }

  function useSpatialQueries() {
    return typeof Spatial !== 'undefined' && (units.length > 18 || buildings.length > 14);
  }

  function allObstacles() {
    const hasGrowing = buildings.some(b =>
      !b.complete && b.hp > 0 && b.blocksMove !== false && buildingBlocksTerrain(b)
    );
    if (!hasGrowing && !obstaclesDirty && obstaclesCache) return obstaclesCache;
    const obs = [];
    for (const d of decorations) {
      const r = terrainBlockRadius(d);
      if (r <= 0) continue;
      obs.push({
        type: d.type, id: d.id,
        x: d.x, y: d.y, radius: r,
        blocksMove: d.blocksMove, blocksLOS: d.blocksLOS,
        cover: d.cover, hp: d.hp,
      });
    }
    for (const b of buildings) {
      if (b.hp <= 0) continue;
      const r = terrainBlockRadius(b);
      if (r <= 0) continue;
      obs.push({
        type: b.type, id: b.id,
        x: b.x, y: b.y, radius: r,
        blocksMove: b.blocksMove, blocksLOS: b.blocksLOS,
        cover: b.cover, hp: b.hp, siegeTowerId: b.siegeTowerId,
        owner: b.owner,
      });
    }
    obstaclesCache = obs;
    obstaclesDirty = false;
    return obs;
  }

  const UNIT_COLLISION = 10;
  const MELEE_STANDOFF = 16;
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

  function isMoraleCombatUnit(unit) {
    if (!unit || unit.hp <= 0) return false;
    if (unit.isGeneral || unit.isDoomslayer) return false;
    if (unit.combatType === 'builder' || unit.combatType === 'courier' || unit.combatType === 'healer') return false;
    return true;
  }

  function moraleBreakThreshold(unit) {
    return Math.max(4, Math.floor((unit.maxMorale || 10) * 0.28));
  }

  function canWitnessDeath(observer, dead) {
    if (!observer || !dead || observer.team !== dead.team || observer.hp <= 0 || observer.id === dead.id) return false;
    if (!isMoraleCombatUnit(observer)) return false;
    const dist = Math.hypot(observer.x - dead.x, observer.y - dead.y);
    if (dist > MORALE_WITNESS_RADIUS) return false;
    return lineOfSight(observer.x, observer.y, dead.x, dead.y);
  }

  function triggerMoraleBreak(unit, reason) {
    if (!isMoraleCombatUnit(unit) || unit.fleeing || unit.demoralized || unit.retreatingToMed) return;
    if (unit.team === 'player') {
      moraleCascadeState = GameDepth?.recordMoraleCascade(
        { ...moraleCascadeState, tick: updateTick },
        true
      ) || moraleCascadeState;
      if (moraleCascadeState.cascade && moraleAlertCooldown <= 0) {
        showMessage('Morale cascade! Rally troops or send a Royal Decree.', 260);
        moraleAlertCooldown = 480;
        FloatingText.status(worldW / 2, rallyY - 20, 'CASCADE', '#c080ff');
      }
    }
    if (unit.team === 'player' && wave >= ACADEMY_ERA_WAVE) {
      unit.demoralized = true;
      unit.huntMode = false;
      unit.manualOrder = false;
      unit.combatTargetId = null;
      unit.path = [];
      unit.pathIndex = 0;
      unit.animState = 'idle';
      FloatingText.status(unit.x, unit.y, 'GAVE UP', '#a080c0');
      if (moraleAlertCooldown <= 0) {
        showMessage('Soldiers lose heart — the General must rally them!', 220);
        moraleAlertCooldown = 360;
      }
      AudioEngine.SFX.moraleBreak();
      return;
    }
    unit.fleeing = true;
    unit.fleeTicks = 0;
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.combatTargetId = null;
    unit.path = [];
    unit.pathIndex = 0;
    unit.fledBattle = true;
    clearPursuersOf(unit);
    FloatingText.status(unit.x, unit.y, 'ROUT!', '#c06040');
    AudioEngine.SFX.moraleBreak();
  }

  function clearPursuersOf(unit) {
    for (const u of units) {
      if (u.combatTargetId === unit.id || u.pathTargetId === unit.id) {
        releaseCombatPursuit(u, { keepManual: u.manualOrder });
      }
    }
  }

  function isValidCombatFoe(foe) {
    return foe && foe.hp > 0 && !foe.fleeing;
  }

  function isPursuableFoe(unit, foe) {
    return foe && foe.team !== unit.team && isValidCombatFoe(foe);
  }

  function getPursuitTarget(unit) {
    if (!unit.pathTargetId || unit.pathTargetId === 'advance' || isBuildingPathTarget(unit.pathTargetId)) return null;
    const t = units.find(u => u.id === unit.pathTargetId);
    return t && t.hp > 0 ? t : null;
  }

  function releaseCombatPursuit(unit, opts = {}) {
    const keepManual = opts.keepManual && unit.manualOrder;
    unit.combatTargetId = null;
    unit.structureTargetId = null;
    if (!keepManual) {
      unit.pathTargetId = null;
      unit.path = [];
      unit.pathIndex = 0;
      unit.targetX = null;
      unit.targetY = null;
      unit.pathStuck = 0;
    }
  }

  function retargetIfHunting(unit) {
    if (unit.manualOrder || unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) return null;
    if (unit.team === 'player' && !unit.huntMode) return null;
    const next = findTacticalTarget(unit);
    if (next) {
      unit.structureTargetId = null;
      unit.combatTargetId = next.id;
      if (!inAttackRange(unit, next)) setUnitPath(unit, next.x, next.y, next);
      return next;
    }
    const bld = findNearestAttackableEnemyBuilding(unit);
    if (!bld) return null;
    unit.combatTargetId = null;
    unit.structureTargetId = bld.id;
    if (!inBuildingAttackRange(unit, bld)) {
      setUnitPath(unit, bld.x, bld.y);
      unit.pathTargetId = `bld:${bld.id}`;
    }
    return null;
  }

  function sanitizeUnitPursuit(unit) {
    const locked = unit.combatTargetId ? units.find(u => u.id === unit.combatTargetId) : null;
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
    for (const observer of units) {
      if (!canWitnessDeath(observer, deadUnit)) continue;
      const dist = Math.hypot(observer.x - deadUnit.x, observer.y - deadUnit.y);
      observer.witnessDeaths = (observer.witnessDeaths || 0) + 1;
      let moraleLoss = dist < MORALE_WITNESS_CLOSE ? 3 : 2;
      if (isGeneralDeath) moraleLoss += 3;
      if (isEliteDeath && observer.team === 'enemy') moraleLoss += 1;
      observer.morale = Math.max(0, observer.morale - moraleLoss);
      if (observer.witnessDeaths >= MORALE_WITNESS_BREAK_COUNT
          || observer.morale <= moraleBreakThreshold(observer)) {
        triggerMoraleBreak(observer, 'witness');
      }
    }
    if (deadUnit.team === 'player') {
      for (const ally of units) {
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
        case 'south': unit.y += speed; unit.rotation = 90; break;
        case 'east': unit.x += speed; unit.rotation = 0; break;
        case 'west': unit.x -= speed; unit.rotation = 180; break;
        default: unit.y -= speed; unit.rotation = -90; break;
      }
    } else {
      unit.y += speed;
      unit.rotation = 90;
    }
    unit.animState = 'walk';
    let offMap = false;
    if (unit.team === 'enemy') {
      offMap = side === 'south' ? unit.y > worldH - edgeMargin
        : side === 'east' ? unit.x > worldW - edgeMargin
          : side === 'west' ? unit.x < edgeMargin
            : unit.y < edgeMargin;
      if (!offMap && unit.fleeTicks > 180) offMap = true;
    } else {
      offMap = unit.y > worldH + 36;
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
    let best = null, bestD = Infinity;
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0 || !u.demoralized) continue;
      if (!isMoraleCombatUnit(u)) continue;
      const d = gen ? unitDistance(gen, u) : Math.hypot(u.x, u.y);
      if (d < bestD) { bestD = d; best = u; }
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
    if (unit.canHunt) unit.huntMode = globalHunt;
    unit.manualOrder = !globalHunt;
  }

  function deliverWallToWall(general, target) {
    restoreTroopMorale(target, 16);
    FloatingText.status(target.x, target.y, 'WALL TO WALL!', '#ffd700');
    Particles.dust(general.x, general.y);
    AudioEngine.SFX.reinforce();
    for (const ally of units) {
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
      ? units.find(u => u.id === general.rallyTargetId && u.hp > 0 && u.demoralized)
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
    const destShift = Math.hypot(target.x - (general.targetX ?? 0), target.y - (general.targetY ?? 0)) > 24;
    if (!general.path?.length || general.pathRecalc <= 0 || general.pathTargetId !== target.id || destShift) {
      general.pathRecalc = 28;
      setUnitPath(general, target.x, target.y, target);
    }
  }

  function decayMoraleWitnesses() {
    for (const u of units) {
      if (u.hp <= 0 || !isMoraleCombatUnit(u)) continue;
      if ((u.witnessDeaths || 0) > 0) u.witnessDeaths = Math.max(0, u.witnessDeaths - 0.004);
      if (u.demoralized && u.team === 'player' && wave < ACADEMY_ERA_WAVE) {
        u.demoralized = false;
      }
    }
  }

  function isDayPhase() { return timeOfDay === 'day'; }
  function isNightPhase() { return timeOfDay === 'night'; }

  function getDayLightLevel() {
    if (isNightPhase()) return 0.32;
    if (waveEnemyTotal <= 0) return 1;
    const alive = units.filter(u => u.team === 'enemy' && u.hp > 0).length;
    const remaining = spawnQueue.length + alive;
    const cleared = waveEnemyTotal > 0 ? 1 - remaining / waveEnemyTotal : 0;
    return Math.max(0.42, 1 - cleared * 0.48);
  }

  function getSightPenaltyForUnit(unit) {
    if (!unit || unit.team !== 'enemy' || unit.hp <= 0) return 0;
    const light = getDayLightLevel();
    let pen = Math.floor((1 - light) * 24);
    if (unit.lanternBlind > 0) pen += 10 + Math.floor(unit.lanternBlind / 4);
    if (isNightPhase()) pen += 28;
    if (typeof ContentExpansion !== 'undefined') pen += ContentExpansion.getWatchtowerIntelPenalty(unit);
    for (const ally of units) {
      if (ally.team !== 'player' || !ally.isWwe || ally.wweAbility !== 'lantern' || ally.hp <= 0) continue;
      if (unitDistance(ally, unit) < 140) {
        pen += 14 + Math.floor((1 - light) * 22);
      }
    }
    return pen;
  }

  function updateWweLanternAura() {
    if (!isDayPhase()) return;
    for (const bray of units) {
      if (!bray.isWwe || bray.wweAbility !== 'lantern' || bray.hp <= 0) continue;
      bray.lanternPulse = (bray.lanternPulse || 0) + 1;
      if (bray.lanternPulse % 45 !== 0) continue;
      const light = getDayLightLevel();
      for (const foe of units) {
        if (foe.team !== 'enemy' || foe.hp <= 0) continue;
        if (unitDistance(bray, foe) > 130) continue;
        foe.morale = Math.max(0, foe.morale - (1 + Math.floor((1 - light) * 2)));
        if (foe.morale <= 2 && !foe.fleeing) triggerMoraleBreak(foe, 'lantern');
      }
    }
  }

  function applyWweWaveStartPulse() {
    for (const u of units) {
      if (!u.isWwe || u.hp <= 0) continue;
      if (u.wweAbility === 'usa') {
        units.filter(a => a.team === 'player' && a.hp > 0 && unitDistance(u, a) < 120).forEach(a => {
          a.demoralized = false;
          a.witnessDeaths = 0;
          a.morale = Math.min(a.maxMorale, a.morale + 4);
          a.rallyTimer = Math.max(a.rallyTimer || 0, 90);
        });
        FloatingText.status(u.x, u.y, 'USA!', '#c04040');
      }
    }
  }

  function countActiveEnemies() {
    return units.filter(u => u.team === 'enemy' && u.hp > 0 && !u.fleeing).length;
  }

  function enterNightPhase() {
    if (isNightPhase()) return;
    timeOfDay = 'night';
    nightTimer = 0;
    awardRoundTP();
    generateBattlefield();
    const armySize = units.filter(u => u.team === 'player' && u.hp > 0).length;
    const playerUnits = units.filter(u => u.team === 'player' && u.hp > 0);
    checkRosterSynergy(playerUnits);
    if (typeof FactionDepth !== 'undefined') {
      FactionDepth.checkMasteryChallenges(wave, playerUnits, { misses });
    }
    ach('wave_complete', {
      wave,
      misses,
      difficulty: difficultyId,
      siegeWave: isSiegeWave(),
      hordeWave: isHordeWave(),
      bossWave: currentWaveConfig?.boss || (typeof GameDepth !== 'undefined' && GameDepth.isBossWave?.(wave)),
      huntOn: globalHunt,
      armySize,
      tactical,
      settlementTp: getSettlementTpBonus(),
      hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(),
      wallCount: countPlayerWalls(),
      liveBuilders: countLiveBuilders(units),
      units: playerUnits,
      academyCount: buildings.filter(b => b.isAcademy && b.complete && b.hp > 0).length,
      advancedMods: typeof AdvancedDifficulty !== 'undefined' ? AdvancedDifficulty.getActiveModCount() : 0,
      garrisonCount: playerUnits.filter(u => u.garrisoned).length,
    });
    if (typeof Legacy !== 'undefined') {
      Legacy.onWaveComplete(wave, { difficulty: difficultyId });
    }
    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendWaveReport(wave, {
        difficulty: difficultyId,
        creative: creativeMode,
        armySize,
        tactical,
        misses,
        siegeWave: isSiegeWave(),
        hordeWave: isHordeWave(),
        bossWave: currentWaveConfig?.boss || (typeof GameDepth !== 'undefined' && GameDepth.isBossWave?.(wave)),
        sessionKills: kills,
        units: playerUnits,
        highlights: sessionHighlights,
      });
    }
    ach('state_check', {
      wave, tactical, misses,
      hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(),
      wallCount: countPlayerWalls(),
      liveBuilders: countLiveBuilders(units),
      settlementTp: getSettlementTpBonus(),
      units: playerUnits,
      academyCount: buildings.filter(b => b.isAcademy && b.complete && b.hp > 0).length,
      garrisonCount: playerUnits.filter(u => u.garrisoned).length,
    });
    units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
      u.experience = (u.experience || 0) + 1;
      u.morale = Math.min(u.maxMorale, u.morale + 1);
      if (!isSpecialistUnit(u)) notifyVetStarEvent(u, addVetStar(u));
    });
    waveProgress = 1;
    if (typeof ColonyValue !== 'undefined') {
      const nightColony = ColonyValue.compute();
      const nextPressure = ColonyValue.deriveWavePressure(nightColony, wave + 1);
      colonySnapshot = nightColony;
      showMessage(ColonyValue.formatNightPreview(nightColony, wave + 1, nextPressure), 260);
    }
    const gen = findPlayerGeneral();
    if (gen?.hasTombstone && fallenPool.length) {
      const limit = getTotalStarCount(gen);
      let raised = 0;
      while (fallenPool.length && raised < limit) {
        const fallen = fallenPool.shift();
        if (!fallen?.type || fallen.type === 'general' || fallen.type === 'doomslayer_hero') continue;
        const u = spawnUnit(fallen.type, gen.x + (raised % 3) * 24 - 24, deployY, 'player');
        if (!u) continue;
        applyPlayerStatMods(u);
        u.hp = Math.floor(u.maxHp * 0.55);
        u.targetY = rallyY;
        units.push(u);
        raised++;
      }
      if (raised > 0) showMessage(`Tombstone — General resurrected ${raised} soldier(s)!`, 260);
    }
    const prepSec = Math.ceil(getNightPrepTicks() / (typeof NIGHT_TICKS_PER_SECOND !== 'undefined' ? NIGHT_TICKS_PER_SECOND : 60));
    showMessage(`Night falls — ${prepSec}s to prepare (builders +35% speed). Press D or BEGIN DAY to start early.`, 360);
  }

  function getNightSecondsRemaining() {
    if (!isNightPhase()) return 0;
    const tps = typeof NIGHT_TICKS_PER_SECOND !== 'undefined' ? NIGHT_TICKS_PER_SECOND : 60;
    return Math.max(0, Math.ceil((getNightPrepTicks() - nightTimer) / tps));
  }

  function beginDayPhase(manual = false) {
    if (!isNightPhase()) return;
    timeOfDay = 'day';
    nightTimer = 0;
    if (manual) showMessage('Dawn breaks — the assault begins!', 160);
    startNextWave();
  }

  function isMeleeCombat(unit) {
    return unit.combatType === 'melee' || unit.combatType === 'rifle' || unit.type === 'sapper'
      || unit.type === 'general';
  }

  function findPlayerGeneral() {
    let best = null;
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0 || !u.isGeneral) continue;
      best = u;
      break;
    }
    return best;
  }

  function getStationedGeneral() {
    for (const u of units) {
      if (u.team === 'player' && u.hp > 0 && u.isGeneral && u.stationedKeep) return u;
    }
    return null;
  }

  function getGeneralAura() {
    const gen = getStationedGeneral();
    if (!gen || typeof GameDepth === 'undefined') {
      const str = gen ? getGeneralBuffStrengthLegacy(gen) : 0;
      return { strength: str, morale: 0.04 * str, accuracy: 18 * str, meleeDmg: 0.45 * str, rangedDmg: 0.38 * str, mitigation: 0.2 * str, compoundBonus: 0, radius: 150 };
    }
    return GameDepth.getGeneralAuraBreakdown(gen);
  }

  function getGeneralBuffStrengthLegacy(gen) {
    const minutes = (gen.generalAliveTimer || 0) / 3600;
    const starBuff = (gen.generalStars || 0) * 0.045;
    return Math.min(1, 0.08 + minutes * 0.18 + starBuff);
  }

  function getGeneralBuffStrength() {
    return getGeneralAura().strength;
  }

  function isInGeneralAura(unit) {
    const gen = getStationedGeneral();
    if (!gen) return false;
    const aura = getGeneralAura();
    return unitDistance(gen, unit) <= aura.radius;
  }

  function applyGeneralAura() {
    const aura = getGeneralAura();
    if (aura.strength <= 0) return;
    const groupId = getStationedCastleGroup();
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0 || u.isGeneral || u.demoralized) continue;
      if (!isInGeneralAura(u)) continue;
      u.morale = Math.min(u.maxMorale, u.morale + aura.morale);
      if (groupId && GameDepth?.isInsideCastleGroup(u, buildings, groupId)) {
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
      const typeMult = unit.combatType === 'ranged' || unit.projectile ? aura.rangedDmg : aura.meleeDmg;
      dmg = Math.round(dmg * (1 + typeMult));
    }
    if (lastStandActive && unit.team === 'player') {
      dmg = Math.round(dmg * (GameDepth?.lastStandDamageMult(true) || 1.28));
    }
    if (unit.combatType === 'cavalry' && unit.chargeTimer > 0) dmg *= 1.55;
    if (unit.rallyTimer > 0) dmg *= 1.12;
    if (unit.isGeneral && (unit.w2wBuffTimer || 0) > 0) dmg *= 1.75;
    if ((unit.type === 'war_chief' || unit.type === 'behemoth' || unit.isNamedBoss) && unit.hp / unit.maxHp < 0.4) {
      dmg = Math.round(dmg * 1.35);
    }
    if (typeof ContentExpansion !== 'undefined') dmg = ContentExpansion.modifyCalcDamage(unit, target, dmg);
    if (typeof FactionDepth !== 'undefined' && (unit.isCrossover || unit.isWwe)) {
      dmg = FactionDepth.modifyDamage(unit, target, dmg);
    }
    return Math.round(dmg);
  }

  function getAdvancedMods() {
    return typeof AdvancedDifficulty !== 'undefined' ? AdvancedDifficulty.getCombinedMods() : {
      allyHpMult: 1, allyDmgMult: 1, tpMult: 1, enemyHpMult: 1, enemyDmgMult: 1,
      enemyCountMult: 1, spawnIntervalMult: 1, eliteChanceMult: 1,
      enemyWeight: {}, missLimitDelta: 0, playerMoraleDelta: 0,
      allyAccDelta: 0, nightPrepMult: 1, buildSpeedMult: 1,
      siegeWaveMult: 1, forceNoElites: false,
    };
  }

  function gameRandom() {
    return typeof GameModes !== 'undefined' ? GameModes.random() : Math.random();
  }

  function getNightPrepTicks() {
    const adv = getAdvancedMods();
    const modeMult = typeof GameModes !== 'undefined' ? GameModes.getNightPrepMult() : 1;
    return Math.max(120, Math.floor(NIGHT_PREP_TICKS * (adv.nightPrepMult || 1) * modeMult));
  }

  function getDifficulty() {
    const base = getDifficultyDef(difficultyId);
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
      tpMult: (adv.tpMult || 1) * (typeof GameModes !== 'undefined' && GameModes.getSession()?.tpTight ? 0.85 : 1),
      allyAccDelta: adv.allyAccDelta || 0,
      buildSpeedMult: adv.buildSpeedMult || 1,
      forceNoElites: !!adv.forceNoElites,
      siegeWaveMult: adv.siegeWaveMult || 1,
      enemyWeight: adv.enemyWeight || {},
    };
  }

  function getDifficultyPercent() {
    if (typeof AdvancedDifficulty !== 'undefined') return AdvancedDifficulty.getDifficultyPercent(difficultyId);
    return DIFFICULTY_BASE_PERCENT[difficultyId] ?? 100;
  }

  function getMissLimit() {
    return getDifficulty().missLimit ?? getDifficultyDef(difficultyId).missLimit;
  }

  function countPlayerHamlets() {
    return buildings.filter(b => b.owner === 'player' && b.complete && b.isHamlet && b.hp > 0).length;
  }

  function countPlayerGuilds() {
    return buildings.filter(b => b.owner === 'player' && b.complete && b.isMerchantGuild && b.hp > 0).length;
  }

  function hasWweAcademy() {
    return buildings.some(b => b.owner === 'player' && b.isWweAcademy && b.complete && b.hp > 0);
  }

  function hasCrossoverBarracks(factionId) {
    return buildings.some(b =>
      b.owner === 'player' && b.isCrossoverBarracks && b.complete && b.hp > 0 &&
      b.crossoverFaction === factionId
    );
  }

  function getCrossoverBuildingsOnField() {
    return buildings
      .filter(b => b.owner === 'player' && b.isCrossoverBarracks && b.complete && b.hp > 0)
      .map(b => b.type);
  }

  function getWweOnField() {
    return units.filter(u => u.team === 'player' && u.isWwe && u.hp > 0).map(u => u.type);
  }

  function getCrossoverOnField() {
    return units.filter(u => u.team === 'player' && u.isCrossover && u.hp > 0).map(u => u.type);
  }

  function spawnUnit(type, x, y, team, opts = {}) {
    return createUnit(type, x, y, team, { spawnWave: wave, ...opts });
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
    return u;
  }

  function canDeployUnitType(type) {
    if (creativeMode && !creativeSettings.academyDeploy) {
      return type === 'doomslayer_hero' || isWweUnit(type) || isCrossoverUnit(type);
    }
    return true;
  }

  function setDifficulty(id) {
    if (DIFFICULTIES[id]) difficultyId = id;
  }

  function getHamletTpBonus() {
    const fallback = typeof HAMLET_TP_PER_ROUND !== 'undefined' ? HAMLET_TP_PER_ROUND : 5;
    return buildings.filter(b => b.owner === 'player' && b.complete && b.isHamlet && b.hp > 0)
      .reduce((sum, b) => sum + (b.tpBonusPerHamlet ?? BuildDefs[b.type]?.tpBonusPerHamlet ?? fallback), 0);
  }

  function getMerchantGuildTpBonus() {
    const hamlets = buildings.filter(b => b.owner === 'player' && b.complete && b.isHamlet && b.hp > 0);
    if (!hamlets.length) return 0;
    let bonus = 0;
    for (const g of buildings) {
      if (g.owner !== 'player' || !g.complete || !g.isMerchantGuild || g.hp <= 0) continue;
      const aura = g.hamletAuraRadius || HAMLET_AURA_RADIUS;
      if (hamlets.some(h => Math.hypot(h.x - g.x, h.y - g.y) <= aura + h.radius)) {
        bonus += BuildDefs[g.type]?.tpBonusInHamlet || 1;
      }
    }
    return bonus;
  }

  function getRawSettlementTpBonus() {
    return getHamletTpBonus() + getMerchantGuildTpBonus();
  }

  function getSettlementTpBonus() {
    const raw = getRawSettlementTpBonus();
    return typeof GameDepth !== 'undefined' ? GameDepth.scaleSettlementTp(raw) : raw;
  }

  function getEnemyEconomySpawnBonus() {
    const hamlets = buildings.filter(b => b.owner === 'enemy' && b.complete && b.isHamlet && b.hp > 0).length;
    const guilds = buildings.filter(b => b.owner === 'enemy' && b.complete && b.isMerchantGuild && b.hp > 0).length;
    return hamlets + guilds;
  }

  function getTpPerRound() {
    const waveScale = typeof GameDepth !== 'undefined' ? GameDepth.waveTpScale(wave) : 1;
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / ACADEMY_ERA_WAVE);
    const post = typeof postAcademyProgress === 'function' ? postAcademyProgress(wave) : 0;
    const bonus = Math.floor(eased * 30 * waveScale);
    const waveBonus = Math.min(5, Math.floor(eased * 5 * waveScale));
    const postBonus = Math.floor(post * 4 * waveScale);
    const diff = getDifficulty();
    const ecoGen = typeof ContentExpansion !== 'undefined' ? ContentExpansion.getEconomyTpBonus() : 0;
    const base = TP_PER_ROUND + bonus + waveBonus + postBonus + diff.tpPerRoundBonus + getSettlementTpBonus() + ecoGen;
    return Math.floor(base * (diff.tpMult || 1));
  }

  function isBuildSiteBlocked(wx, wy, bdef, excludeBuildingIds = null) {
    const margin = bdef?.radius ? Math.floor(bdef.radius * 0.55) : 12;
    if (isBlocked(wx, wy, null, margin)) return true;
    const exclude = excludeBuildingIds
      ? new Set(Array.isArray(excludeBuildingIds) ? excludeBuildingIds : [excludeBuildingIds])
      : null;
    for (const b of buildings) {
      if (exclude?.has(b.id)) continue;
      const br = terrainBlockRadius(b);
      if (br <= 0) continue;
      if (Math.hypot(wx - b.x, wy - b.y) < (bdef?.radius || 20) + br + DECO_GAP * 2) return true;
    }
    return false;
  }

  function ach(type, data = {}) {
    if (creativeMode && !creativeSettings.enableAchievements) return;
    if (typeof Achievements !== 'undefined') Achievements.onEvent(type, data);
  }

  function checkRosterSynergy(playerUnits) {
    const tags = new Set();
    for (const u of playerUnits || []) {
      if (!u.isCrossover && !u.isWwe) continue;
      tags.add(typeof getCrossoverCombatTag === 'function' ? getCrossoverCombatTag(u) : 'melee');
    }
    if (tags.has('melee') && tags.has('ranged') && tags.has('support')) ach('roster_synergy');
    if (typeof FactionDepth !== 'undefined') {
      const syns = FactionDepth.computeSynergies(playerUnits);
      if (syns.length >= 2) ach('faction_synergy_multi', { count: syns.length });
      for (const u of playerUnits || []) FactionDepth.applyToUnit(u, playerUnits);
    }
  }

  function isCreativeMode() { return creativeMode; }

  function setCreativeSetting(key, value) {
    if (!(key in creativeSettings)) return;
    creativeSettings[key] = typeof creativeSettings[key] === 'boolean' ? !!value : value;
    if (key === 'useCampaignRules' && value) {
      creativeSettings.freeResources = false;
      creativeSettings.noGameOver = false;
      creativeSettings.noAutoCycle = false;
      creativeSettings.instantBuild = false;
      creativeSettings.enableAchievements = false;
    }
  }

  function applyCampaignRulesPreset(on) {
    setCreativeSetting('useCampaignRules', !!on);
    if (on) showMessage('Campaign rules ON — TP, misses, and auto-cycle apply.', 260);
    else showMessage('Sandbox rules restored.', 160);
  }

  function creativeSetTool(tool, spawnType = null) {
    creativeTool = tool;
    creativeSpawnType = spawnType;
    if (tool) clearSelection();
    const label = tool === 'spawn_enemy' ? EnemyDefs[spawnType]?.name
      : tool === 'spawn_enemy_building' ? BuildDefs[spawnType]?.name
      : tool === 'spawn_player' ? getPlayerUnitDef(spawnType)?.name
      : tool === 'spawn_player_building' ? BuildDefs[spawnType]?.name
      : tool === 'spawn_squad' ? `Squad (${spawnType})` : null;
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
    if (!creativeSettings.freeResources && tactical < def.cost) return false;
    if (def.isWweAcademy && !(creativeMode && creativeSettings.unlockAll) && !MetaProgress.isWweUnlocked()) return false;
    if (def.isCrossoverBarracks && !(creativeMode && creativeSettings.unlockAll) &&
        !MetaProgress.isCrossoverFactionUnlocked(def.crossoverFaction)) return false;
    if (def.isPerkMachine && !(creativeMode && creativeSettings.unlockAll) && !Perks.perkMachinesUnlocked()) return false;
    if (isVanillaAcademyType(type) && !(creativeMode && creativeSettings.unlockAll) && !canBuildAcademyType(type, wave, units)) return false;
    if (isBuildSiteBlocked(wx, wy, def)) { showMessage('Not enough space here!'); return false; }
    if (!creativeSettings.freeResources) tactical -= def.cost;
    selectedBuild = null;
    AudioEngine.SFX.deploy();
    if (type === 'castle') {
      const groupId = Math.random().toString(36).slice(2, 9);
      getCastleCompoundLayout(wx, wy).forEach(l => {
        const b = createBuilding(l.type, l.x, l.y, 'player', { facing: l.facing, castleGroup: groupId });
        creativeFinishBuilding(b);
        buildings.push(b);
      });
      invalidateObstacles();
      showMessage('Castle compound placed (instant).');
      return true;
    }
    const wallOpts = type === 'wall' ? { facing: pendingWallFacing } : {};
    const b = createBuilding(type, wx, wy, 'player', wallOpts);
    creativeFinishBuilding(b);
    buildings.push(b);
    invalidateObstacles();
    showMessage(`${def.name} placed (instant).`);
    return true;
  }

  function creativeSpawnEnemyAt(type, x, y, opts = {}) {
    const u = spawnUnit(type, x, y, 'enemy');
    if (!u) return false;
    u.rotation = opts.rotation ?? 90;
    u.huntMode = true;
    if (opts.hpMult) { u.maxHp = Math.floor(u.maxHp * opts.hpMult); u.hp = u.maxHp; }
    if (opts.dmgMult) u.damage = Math.floor(u.damage * opts.dmgMult);
    if (opts.elite) {
      u.maxHp = Math.floor(u.maxHp * 1.35);
      u.hp = u.maxHp;
      u.damage = Math.floor(u.damage * 1.2);
    }
    units.push(u);
    Particles.dust(x, y);
    AudioEngine.SFX.deploy();
    typeof CreativeTools !== 'undefined' && CreativeTools.bumpStat('spawns');
    typeof CreativeTools !== 'undefined' && CreativeTools.recordFrame(`spawn:${type}`);
    return true;
  }

  function creativeSpawnPlayerAt(type, x, y) {
    if (!canDeployUnitType(type) && !creativeSettings.academyDeploy) {
      showMessage('Academy deploy off — cannot spawn troop type.');
      return false;
    }
    if (typeof isCrossoverUnit === 'function' && isCrossoverUnit(type) && getCrossoverOnField().includes(type)) {
      const name = typeof getCrossoverDef === 'function' ? getCrossoverDef(type)?.name : type;
      showMessage(`${name || type} is already on the field!`);
      return false;
    }
    const u = spawnUnit(type, x, y, 'player');
    if (!u) return false;
    applyPlayerStatMods(u);
    if (typeof ContentExpansion !== 'undefined') ContentExpansion.applyLoadoutToUnit(u);
    if (typeof FactionDepth !== 'undefined') FactionDepth.applyToUnit(u, units);
    u.targetY = rallyY;
    u.huntMode = globalHunt && u.canHunt;
    units.push(u);
    Particles.dust(x, y);
    AudioEngine.SFX.deploy();
    typeof CreativeTools !== 'undefined' && CreativeTools.bumpStat('spawns');
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
    list.forEach((t, i) => creativeSpawnPlayerAt(t, x + (i % 3) * 20 - 20, y + Math.floor(i / 3) * 22));
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
    return { x: worldW / 2, y: (deployY + rallyY) / 2 };
  }

  function countEnemies() {
    return units.filter(u => u.team === 'enemy' && u.hp > 0).length;
  }

  function creativeSetTp(n) {
    tactical = Math.max(0, Math.floor(n));
    sanitizeTactical();
  }

  function creativeSpawnEnemyBuildingAt(type, x, y) {
    const def = BuildDefs[type];
    if (!def || def.owner === 'player') return false;
    if (isBuildSiteBlocked(x, y, def)) { showMessage('Blocked — need open ground.'); return false; }
    const b = createBuilding(type, x, y, 'enemy');
    creativeFinishBuilding(b);
    buildings.push(b);
    invalidateObstacles();
    Particles.dust(x, y);
    showMessage(`${def.name} placed.`);
    return true;
  }

  function creativeSetWave(n) {
    wave = Math.max(0, Math.floor(n));
    applyWorldSize(wave);
    generateBattlefield();
    invalidateObstacles();
    spawnQueue = [];
    spawnTimer = 0;
    waveProgress = 0;
    showMessage(`Creative: wave set to ${wave}.`, 180);
  }

  function creativeAddTp(amount) {
    tactical += amount;
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
    if (isDayPhase() && (spawnQueue.length > 0 || countActiveEnemies() > 0)) {
      showMessage('Clear current wave first or use Clear Wave Spawns.', 200);
      return;
    }
    if (isNightPhase()) beginDayPhase(true);
    else startNextWave();
  }

  function setCustomWave(spec) {
    if (!spec) { creativeCustomWave = null; return; }
    const text = spec.text || spec;
    const queue = typeof CreativeTools !== 'undefined'
      ? CreativeTools.parseWaveComposer(text)
      : [];
    if (!queue.length) {
      showMessage('Wave composer: no valid enemies parsed.');
      return false;
    }
    creativeCustomWave = {
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
    return creativeCustomWave ? { ...creativeCustomWave } : null;
  }

  function creativeLaunchCustomWave() {
    if (!creativeCustomWave?.queue?.length) {
      showMessage('Build a custom wave in the composer first.');
      return false;
    }
    if (isDayPhase() && (spawnQueue.length > 0 || countActiveEnemies() > 0)) {
      creativeClearWaveSpawns();
    }
    spawnQueue = [...creativeCustomWave.queue];
    waveEnemyTotal = spawnQueue.length;
    waveProgress = 0;
    spawnTimer = 8;
    currentWaveConfig = {
      count: spawnQueue.length,
      pool: [...new Set(spawnQueue)],
      interval: creativeCustomWave.interval,
      boss: spawnQueue.includes('war_chief'),
      hpScale: creativeCustomWave.hpMult,
      dmgScale: creativeCustomWave.dmgMult,
    };
    nextWaveIntel = `Custom: ${creativeCustomWave.text || spawnQueue.length + ' foes'}`;
    if (isNightPhase()) {
      timeOfDay = 'day';
      nightTimer = 0;
    }
    spawnTimer = 8;
    typeof CreativeTools !== 'undefined' && CreativeTools.bumpStat('wavesLaunched');
    typeof CreativeTools !== 'undefined' && CreativeTools.recordFrame('custom_wave');
    showMessage(`Launching custom wave (${spawnQueue.length})…`, 240);
    return true;
  }

  function getUnitsSnapshot() {
    return units.filter(u => u.hp > 0).map(u => ({
      id: u.id, type: u.type, team: u.team, x: u.x, y: u.y,
      hp: u.hp, maxHp: u.maxHp, damage: u.damage, accuracy: u.accuracy,
      speed: u.speed, range: u.range, morale: u.morale, maxMorale: u.maxMorale,
      vetBronze: u.vetBronze, vetSilver: u.vetSilver, vetGold: u.vetGold,
    }));
  }

  function getBuildingsSnapshot() {
    return buildings.filter(b => b.hp > 0).map(b => ({
      type: b.type, owner: b.owner, x: b.x, y: b.y, hp: b.hp, complete: b.complete,
    }));
  }

  function restoreCreativeSnapshot(frame) {
    if (!frame) return false;
    if (frame.wave != null) creativeSetWave(frame.wave);
    if (frame.tactical != null) creativeSetTp(frame.tactical);
    units = [];
    for (const su of frame.units || []) {
      const u = spawnUnit(su.type, su.x, su.y, su.team);
      if (!u) continue;
      u.hp = su.hp; u.maxHp = su.maxHp;
      u.damage = su.damage; u.accuracy = su.accuracy;
      u.speed = su.speed; u.range = su.range;
      u.morale = su.morale; u.maxMorale = su.maxMorale;
      u.vetBronze = su.vetBronze || 0; u.vetSilver = su.vetSilver || 0; u.vetGold = su.vetGold || 0;
      if (su.team === 'player') { u.targetY = rallyY; applyPlayerStatMods(u); }
      else u.huntMode = true;
      units.push(u);
    }
    if (frame.buildings?.length) {
      buildings = buildings.filter(b => b.owner === 'player' && b.isCastle);
      for (const sb of frame.buildings) {
        if (buildings.some(b => Math.hypot(b.x - sb.x, b.y - sb.y) < 8)) continue;
        const b = createBuilding(sb.type, sb.x, sb.y, sb.owner || 'player');
        creativeFinishBuilding(b);
        b.hp = sb.hp ?? b.hp;
        buildings.push(b);
      }
      invalidateObstacles();
    }
    if (frame.timeOfDay === 'night' && isDayPhase()) creativeForceNight();
    if (frame.timeOfDay === 'day' && isNightPhase()) creativeForceDay();
    return true;
  }

  function applyCreativeUnitStats(unit, stats) {
    if (!unit) return false;
    if (stats.hp != null) { unit.maxHp = Math.max(1, Math.floor(stats.hp)); unit.hp = unit.maxHp; }
    if (stats.damage != null) unit.damage = Math.max(1, Math.floor(stats.damage));
    if (stats.accuracy != null) unit.accuracy = Math.min(99, Math.max(1, Math.floor(stats.accuracy)));
    if (stats.speed != null) unit.speed = Math.max(0.2, parseFloat(stats.speed));
    if (stats.range != null) { unit.range = Math.floor(stats.range); unit.baseRange = unit.range; }
    if (stats.morale != null) {
      unit.maxMorale = Math.max(1, Math.floor(stats.morale));
      unit.morale = unit.maxMorale;
    }
    FloatingText.status(unit.x, unit.y, 'STATS', '#80c0ff');
    return true;
  }

  function applyCreativeUnitPreset(unit, preset) {
    if (!unit || !preset) return false;
    const def = unit.team === 'player' ? getPlayerUnitDef(unit.type) : EnemyDefs[unit.type];
    const baseHp = def?.hp || unit.maxHp;
    const baseDmg = def?.damage || unit.damage;
    if (preset.hpMult) {
      unit.maxHp = Math.floor(baseHp * preset.hpMult);
      unit.hp = unit.maxHp;
    } else if (preset.hp != null) {
      unit.maxHp = preset.hp;
      unit.hp = unit.maxHp;
    }
    if (preset.damageMult) unit.damage = Math.floor(baseDmg * preset.damageMult);
    else if (preset.dmgMult) unit.damage = Math.floor(baseDmg * preset.dmgMult);
    else if (preset.damage != null) unit.damage = preset.damage;
    if (preset.accuracy != null) unit.accuracy = preset.accuracy;
    if (preset.speedMult) unit.speed = (def?.speed || unit.speed) * preset.speedMult;
    else if (preset.speed != null) unit.speed = preset.speed;
    if (preset.rangeMult && unit.range) {
      unit.range = Math.floor((def?.range || unit.range) * preset.rangeMult);
      unit.baseRange = unit.range;
    }
    if (preset.vetGold) {
      unit.vetGold = preset.vetGold;
      unit.vetSilver = 0;
      unit.vetBronze = 0;
    }
    FloatingText.status(unit.x, unit.y, preset.label || 'PRESET', '#ffd080');
    return true;
  }

  function creativeResetUnitToDef() {
    const u = getSelectedUnit();
    if (!u) { showMessage('Select a unit first.'); return false; }
    const def = u.team === 'player' ? getPlayerUnitDef(u.type) : EnemyDefs[u.type];
    if (!def) return false;
    u.maxHp = def.hp; u.hp = u.maxHp;
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
    if (!u) { showMessage('Select a unit for stat edit.'); return false; }
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
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v ?? ''); };
    set('creative-stat-hp', u.maxHp);
    set('creative-stat-dmg', u.damage);
    set('creative-stat-acc', u.accuracy);
    set('creative-stat-spd', u.speed);
    set('creative-stat-rng', u.range);
  }

  function creativeRegenerateMap() {
    generateBattlefield();
    invalidateObstacles();
    showMessage('Battlefield regenerated (decorations & hazards refreshed).', 200);
  }

  function creativeClearWaveSpawns() {
    spawnQueue = [];
    units.filter(u => u.team === 'enemy').forEach(u => { u.hp = 0; });
    spawnTimer = 0;
    waveProgress = 0;
    showMessage('Creative: wave spawns and enemies cleared.', 160);
  }

  function creativeClearEnemies() {
    units.filter(u => u.team === 'enemy').forEach(u => { u.hp = 0; });
    spawnQueue = [];
    showMessage('All enemies removed.', 140);
  }

  function creativeClearEnemyBuildings() {
    buildings = buildings.filter(b => b.owner !== 'enemy');
    invalidateObstacles();
    showMessage('Enemy buildings removed.', 140);
  }

  function creativeHealAll() {
    units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
      u.hp = u.maxHp;
      u.demoralized = false;
      u.fleeing = false;
      u.witnessDeaths = 0;
    });
    showMessage('All allies healed.', 140);
  }

  function creativeMaxMorale() {
    units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
      u.morale = u.maxMorale;
      u.demoralized = false;
      u.fleeing = false;
    });
    showMessage('Army morale maxed.', 140);
  }

  function getUnitById(id) {
    if (!id) return null;
    if (unitByIdFrame !== updateTick) {
      unitById.clear();
      for (const u of units) unitById.set(u.id, u);
      unitByIdFrame = updateTick;
    }
    const cached = unitById.get(id);
    if (cached) return cached;
    const found = units.find(u => u.id === id) || null;
    if (found) unitById.set(id, found);
    return found;
  }

  function getSelectedUnit() {
    return selectedUnitId ? getUnitById(selectedUnitId) : null;
  }

  function creativeRankUpSelected() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) { showMessage('Select a living ally first.'); return; }
    notifyVetStarEvent(u, addVetStar(u));
    showMessage(`${unitDisplayName(u)} earned a star!`, 160);
  }

  function creativeMaxStarsSelected() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) { showMessage('Select a living ally first.'); return; }
    let safety = 0;
    while ((u.vetGold || 0) < 3 && safety++ < 40) addVetStar(u);
    if (u.type === 'general') u.generalStars = Math.max(u.generalStars || 0, 3);
    showMessage(`${unitDisplayName(u)} maxed veteran stars!`, 180);
  }

  function creativeHealSelected() {
    const u = getSelectedUnit();
    if (!u || u.hp <= 0) { showMessage('Select a unit first.'); return; }
    u.hp = u.maxHp;
    u.demoralized = false;
    u.fleeing = false;
    FloatingText.heal(u.x, u.y, u.maxHp);
    showMessage(`${unitDisplayName(u)} fully healed.`, 140);
  }

  function creativeKillSelected() {
    const u = getSelectedUnit();
    if (!u) { showMessage('Select a unit first.'); return; }
    u.hp = 0;
    showMessage(`${unitDisplayName(u)} removed.`, 120);
  }

  function creativePromoteSelectedGeneral() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.type !== 'footman' || u.hp <= 0) {
      showMessage('Select a living Footman to promote.');
      return;
    }
    if (findPlayerGeneral()) { showMessage('A General already commands the field.'); return; }
    releaseFromWallGarrison(u);
    releaseFromGarrison(u);
    promoteFootmanToGeneral(u);
    showMessage(`${u.honorName || 'Footman'} promoted to General!`, 200);
  }

  function startCreative(opts = {}) {
    creativeSettings = { ...CREATIVE_DEFAULTS, ...opts };
    creativeTool = null;
    creativeSpawnType = null;
    start({ creative: true });
  }

  function specialistStarColor(unit) {
    if (unit.type === 'healer') return '#60c080';
    if (unit.type === 'builder') return '#c0a060';
    if (unit.type === 'courier') return '#e0c080';
    return VET_STAR_COLORS.bronze;
  }

  function addHighlight(type, text) {
    sessionHighlights.push({ type, text, wave, tick: updateTick });
    if (sessionHighlights.length > 48) sessionHighlights.shift();
  }

  function announceHonorName(unit, extra = '') {
    if (!unit.honorName) return;
    if (typeof Legacy !== 'undefined') Legacy.recordHonor(unit, wave);
    addHighlight('honor', `${unit.honorName} honored by the Crown`);
    FloatingText.status(unit.x, unit.y - 12, unit.honorName, '#ffd700');
    showMessage(`The Crown names ${unit.honorName}${extra} — gold-star devotion to the realm!`, 320);
    Particles.heal(unit.x, unit.y);
    AudioEngine.SFX.reinforce();
    ach('vet_event', { event: 'honored', unitType: unit.type, honorName: unit.honorName });
  }

  function notifyVetStarEvent(unit, event) {
    if (!event || unit.team !== 'player') return;
    const spec = isSpecialistUnit(unit);

    if (event === 'honored_upgrade' || event === 'honored_general_star') {
      if (typeof VisualPolish !== 'undefined') VisualPolish.honorFx(unit);
      const label = getVeteranLabel(unit);
      FloatingText.status(unit.x, unit.y, spec ? 'RANK UP!' : 'VETERAN!', VET_STAR_COLORS.gold);
      const bonus = unit.isGeneral
        ? `command aura +${Math.round((unit.generalStars || 0) * 4.5)}%`
        : unit.type === 'healer' ? '+heal, +range'
        : unit.type === 'builder' ? '+build speed, +range'
        : unit.type === 'courier' ? '+speed, faster dispatch'
        : '+HP, +damage, +speed';
      announceHonorName(unit, label ? `, now ${label}` : '');
      showMessage(`${label || getUnitDisplayName(unit)} — ${bonus}`);
    } else if (event === 'upgrade') {
      if (typeof VisualPolish !== 'undefined') VisualPolish.vetUpgradeFx(unit);
      const label = getVeteranLabel(unit);
      FloatingText.status(unit.x, unit.y, spec ? 'RANK UP!' : 'VETERAN!', VET_STAR_COLORS.gold);
      const bonus = unit.type === 'healer' ? '+heal, +range'
        : unit.type === 'builder' ? '+build speed, +range'
        : unit.type === 'courier' ? '+speed, faster dispatch'
        : '+HP, +damage, +speed';
      showMessage(`${label} — ${bonus}`);
      Particles.heal(unit.x, unit.y);
      AudioEngine.SFX.reinforce();
    } else if (event === 'general_star') {
      FloatingText.status(unit.x, unit.y, '★ Command', VET_STAR_COLORS.gold);
      showMessage(`${getUnitDisplayName(unit)} — command star earned (+aura)`, 220);
      Particles.heal(unit.x, unit.y);
    } else if (event === 'gold') {
      if (typeof VisualPolish !== 'undefined') VisualPolish.vetUpgradeFx(unit);
      FloatingText.status(unit.x, unit.y, '★ Gold', VET_STAR_COLORS.gold);
    } else if (event === 'silver') {
      FloatingText.status(unit.x, unit.y, '★ Silver', VET_STAR_COLORS.silver);
    } else if (event === 'bronze') {
      FloatingText.status(unit.x, unit.y, spec ? '★ Rank' : '★', specialistStarColor(unit));
    }
    if (event === 'gold' || event === 'honored_upgrade') {
      Particles.heal(unit.x, unit.y);
      if ((unit.vetGold || 0) >= 3 || event === 'honored_upgrade') {
        CombatFX?.hitSpark(unit.x, unit.y - 8);
        unit.honorGlowTimer = 240;
      }
    }
    if (event !== 'honored_upgrade' && event !== 'honored_general_star') {
      ach('vet_event', { event, unitType: unit.type, vetTier: unit.vetTier });
    }
  }

  function damageBuilding(b, amount) {
    if (!b || b.hp <= 0) return;
    b.hp -= amount;
    FloatingText.damage(b.x, b.y - 8, amount);
    Particles.dust(b.x, b.y);
    if (b.hp <= 0) finalizeBuildingDestroyed(b);
  }

  function getEffectiveRange(unit) {
    if (unit.combatType !== 'ranged') return unit.range;
    let r = unit.baseRange ?? unit.range;
    if (unit.garrisoned) {
      const op = buildings.find(b => b.id === unit.garrisoned && b.complete);
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

  function unitDistance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function inAttackRange(unit, target) {
    const buffer = isMeleeCombat(unit) ? 4 : 0;
    return unitDistance(unit, target) <= maxAttackRange(unit) + buffer;
  }

  function getApproachPoint(from, target, standoff = MELEE_STANDOFF) {
    const dx = from.x - target.x, dy = from.y - target.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= standoff || dist < 0.01) return { x: from.x, y: from.y };
    const scale = (dist - standoff) / dist;
    return { x: target.x + dx * scale, y: target.y + dy * scale };
  }

  function slotAngleOffset(unitId, slotIndex) {
    let h = 0;
    for (let i = 0; i < unitId.length; i++) h = (h + unitId.charCodeAt(i) * (i + 1)) % 997;
    return ((h % 5) - 2) * 0.08 + slotIndex * 0.02;
  }

  function getEnemyEngagers(enemy, team, exclude = null) {
    if (!enemy || enemy.hp <= 0 || enemy.fleeing) return [];
    const list = [];
    const scanR = 100;
    const candidates = useSpatialQueries()
      ? Spatial.queryRadius(enemy.x, enemy.y, scanR, e =>
        e.kind === 'unit' && e.ref?.team === team && e.ref?.hp > 0 &&
        e.ref?.combatType !== 'healer' && e.ref?.combatType !== 'builder'
      ).filter(u => u !== exclude)
      : units.filter(u =>
        u !== exclude && u.team === team && u.hp > 0 &&
        u.combatType !== 'healer' && u.combatType !== 'builder'
      );
    for (const u of candidates) {
      const committed = u.pathTargetId === enemy.id || u.combatTargetId === enemy.id;
      const closing = committed && Math.hypot(u.x - enemy.x, u.y - enemy.y) < scanR;
      const fighting = inAttackRange(u, enemy);
      if (fighting || closing) list.push(u);
    }
    return list;
  }

  function getEnemyEngagersCached(enemy, team, exclude = null) {
    if (engagerCacheFrame !== updateTick) {
      engagerCache.clear();
      engagerCacheFrame = updateTick;
    }
    const ck = `${enemy.id}:${team}:${exclude?.id ?? ''}`;
    if (engagerCache.has(ck)) return engagerCache.get(ck);
    const result = getEnemyEngagers(enemy, team, exclude);
    engagerCache.set(ck, result);
    return result;
  }

  function sameTypeEngaging(enemy, unit) {
    return getEnemyEngagersCached(enemy, unit.team, unit).some(u => u.type === unit.type);
  }

  function countFilledSurroundSlots(enemy, team) {
    const engagers = getEnemyEngagersCached(enemy, team);
    const ring = SURROUND_RING_MELEE + 2;
    let filled = 0;
    for (let i = 0; i < SURROUND_SLOTS_MELEE; i++) {
      const angle = (i / SURROUND_SLOTS_MELEE) * Math.PI * 2;
      const sx = enemy.x + Math.cos(angle) * ring;
      const sy = enemy.y + Math.sin(angle) * ring;
      const taken = engagers.some(u =>
        Math.hypot(u.x - sx, u.y - sy) < 18 ||
        (u.targetX != null && Math.hypot(u.targetX - sx, u.targetY - sy) < 16)
      );
      if (taken) filled++;
    }
    return filled;
  }

  function isFullySurrounded(enemy, team) {
    const engagers = getEnemyEngagersCached(enemy, team);
    const meleeNear = engagers.filter(u => isMeleeCombat(u)).length;
    return countFilledSurroundSlots(enemy, team) >= SURROUND_MIN_FILLED || meleeNear >= 5;
  }

  function getMeleeRing(unit) {
    return Math.max(14, (unit.meleeRange || MELEE_STANDOFF) - 4);
  }

  function getSurroundSlot(unit, enemy) {
    const melee = isMeleeCombat(unit);
    const ring = melee ? getMeleeRing(unit) : Math.min(getEffectiveRange(unit) * 0.72, 85);
    const slotCount = melee ? SURROUND_SLOTS_MELEE : SURROUND_SLOTS_RANGED;
    const candidates = [];

    for (let i = 0; i < slotCount; i++) {
      const angle = (i / slotCount) * Math.PI * 2 + slotAngleOffset(unit.id, i);
      let sx = enemy.x + Math.cos(angle) * ring;
      let sy = enemy.y + Math.sin(angle) * ring;
      const pos = clampPos(sx, sy);
      let score = Math.hypot(pos.x - unit.x, pos.y - unit.y);

      const nearbyAllies = useSpatialQueries()
        ? Spatial.queryRadius(pos.x, pos.y, 28, e => e.kind === 'unit' && e.ref?.team === unit.team && e.ref?.hp > 0)
        : units.filter(u => u !== unit && u.hp > 0 && u.team === unit.team && Math.hypot(u.x - pos.x, u.y - pos.y) < 28);
      for (const u of nearbyAllies) {
        if (u === unit) continue;
        if (u.pathTargetId === enemy.id && u.targetX != null && Math.hypot(u.targetX - pos.x, u.targetY - pos.y) < 18) {
          score += 220;
        }
        if (Math.hypot(u.x - pos.x, u.y - pos.y) < UNIT_COLLISION + 4) score += 160;
      }
      if (isTerrainBlockedForPath(pos.x, pos.y, unit)) score += 300;

      candidates.push({ x: pos.x, y: pos.y, score });
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0] || getApproachPoint(unit, enemy, melee ? MELEE_STANDOFF : ring * 0.9);
  }

  function findTacticalTarget(unit) {
    const maxSeek = unit.team === 'enemy'
      ? Math.max(maxAttackRange(unit) + 220, 450)
      : maxAttackRange(unit) + 140;
    const options = [];
    let foeList = useSpatialQueries()
      ? Spatial.queryRadius(unit.x, unit.y, maxSeek, e => e.kind === 'unit' && e.ref?.team !== unit.team && e.ref?.hp > 0 && !e.ref?.fleeing).map(e => e)
      : units.filter(u => u.team !== unit.team && u.hp > 0 && !u.fleeing);
    if (foeList.length > 36) {
      foeList.sort((a, b) => unitDistance(unit, a) - unitDistance(unit, b));
      foeList = foeList.slice(0, 36);
    }

    for (const foe of foeList) {
      if (foe.team === unit.team || !isValidCombatFoe(foe)) continue;
      if (typeof ContentExpansion !== 'undefined' && !ContentExpansion.canTargetUnit(unit, foe)) continue;
      const dist = unitDistance(unit, foe);
      if (dist > maxSeek) continue;
      if (!lineOfSight(unit.x, unit.y, foe.x, foe.y)) continue;

      const engagers = getEnemyEngagersCached(foe, unit.team, unit);
      const surrounded = isFullySurrounded(foe, unit.team);
      if (surrounded && !inAttackRange(unit, foe)) continue;

      let score = dist;
      if (unit.team === 'enemy' && foe.isGeneral) {
        score -= unit.type === 'assassin' ? 1200 : 800;
        if (foe.stationedKeep && unit.type !== 'assassin') score += 400;
      }
      if (sameTypeEngaging(foe, unit)) score += 200;
      score += engagers.filter(u => u.type === unit.type).length * 90;
      score += engagers.length * 18;
      if (foe.id === unit.combatTargetId && isPursuableFoe(unit, foe)) score -= 28;

      options.push({ foe, score });
    }

    if (options.length === 0) {
      for (const foe of foeList) {
        if (foe.team === unit.team || !isValidCombatFoe(foe)) continue;
        const dist = unitDistance(unit, foe);
        if (dist > maxSeek || !lineOfSight(unit.x, unit.y, foe.x, foe.y)) continue;
        let score = dist + (sameTypeEngaging(foe, unit) ? 120 : 0);
        options.push({ foe, score });
      }
    }

    options.sort((a, b) => a.score - b.score);
    return options[0]?.foe ?? null;
  }

  function findNearestPlayer(unit) {
    let best = null, bestD = Infinity;
    for (const p of units) {
      if (p.team !== 'player' || p.hp <= 0 || p.fleeing || p.demoralized) continue;
      const d = Math.hypot(p.x - unit.x, p.y - unit.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function isAcademyEraActive() {
    return isAcademyEra(wave);
  }

  function canDeployWithTP() {
    return true;
  }

  function getDeployCostMult() {
    return 1;
  }

  function spawnPosForSide(side) {
    const m = 24;
    switch (side) {
      case 'south':
        return {
          x: m + Math.random() * (worldW - m * 2),
          y: worldH - 28 - Math.random() * 14,
        };
      case 'east':
        return {
          x: worldW - 28 - Math.random() * 14,
          y: 90 + Math.random() * (worldH - 200),
        };
      case 'west':
        return {
          x: 10 + Math.random() * 18,
          y: 90 + Math.random() * (worldH - 200),
        };
      default:
        return {
          x: m + Math.random() * (worldW - m * 2),
          y: 8 + Math.random() * 20,
        };
    }
  }

  function getWaveAttackSides() {
    return waveAttackSides.length ? waveAttackSides : ['north'];
  }

  /** Pick a random non-empty subset of unlocked flanks for this wave. */
  function rollWaveAttackSides(waveNum) {
    const pool = getUnlockedAttackSides(waveNum);
    if (pool.length <= 1) return [...pool];
    const total = (1 << pool.length) - 1;
    const pick = 1 + Math.floor(gameRandom() * total);
    const chosen = [];
    for (let i = 0; i < pool.length; i++) {
      if (pick & (1 << i)) chosen.push(pool[i]);
    }
    return chosen;
  }

  function nextEnemySpawnSide() {
    const sides = getWaveAttackSides();
    if (sides.length <= 1) return sides[0] || 'north';
    return sides[Math.floor(gameRandom() * sides.length)];
  }

  function enemyRotationForSide(side) {
    switch (side) {
      case 'south': return -90;
      case 'east': return 180;
      case 'west': return 0;
      default: return 90;
    }
  }

  function enemyBrokeThrough(unit) {
    const side = unit.spawnSide || 'north';
    switch (side) {
      case 'south': return unit.y < 28;
      case 'east': return unit.x < 32;
      case 'west': return unit.x > worldW - 32;
      default: return unit.y > worldH - 12;
    }
  }

  /** Advance goal per flank — must match enemyBrokeThrough thresholds (not rallyY). */
  function getBreakthroughGoal(side) {
    switch (side) {
      case 'south': return { x: worldW * 0.5, y: 24 };
      case 'east': return { x: 24, y: rallyY };
      case 'west': return { x: worldW - 24, y: rallyY };
      default: return { x: worldW * 0.5, y: deployY };
    }
  }

  function getEnemyAdvancePoint(unit) {
    let hash = 0;
    for (let i = 0; i < unit.id.length; i++) hash = (hash + unit.id.charCodeAt(i) * (i + 1)) % 200;
    const spread = (hash - 100) * 0.35;
    const side = unit.spawnSide || 'north';
    const goal = getBreakthroughGoal(side);
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
    if (sides.length <= 1) return;
    const labels = { north: 'North', east: 'East', west: 'West', south: 'South' };
    const text = sides.map(s => labels[s]).join(', ');
    const pool = getUnlockedAttackSides(wave);
    const poolNote = pool.length > sides.length
      ? ` (${pool.filter(s => !sides.includes(s)).map(s => labels[s]).join(', ')} quiet this wave)`
      : '';
    showMessage(`Enemies assault from: ${text}!${poolNote}`, 280);
    FloatingText.status(worldW / 2, 40, 'MULTI-FRONT', '#ff8060');
  }

  function announceAcademyEra() {
    if (wave !== ACADEMY_ERA_WAVE) return;
    addHighlight('era', 'Academy Era begins — train through Academies');
    showMessage('Wave 100 — Academy Era escalates! Enemy pressure surges; protect hamlets, guilds, and academies.', 380);
    FloatingText.status(worldW / 2, worldH / 2, 'ACADEMY ERA', '#c0a040');
    AudioEngine.SFX.reinforce();
  }

  function announceRtsEra() {
    if (wave !== ACADEMY_ERA_WAVE) return;
    showMessage('Wave 100 — RTS Era! Enemy hordes swell. Hamlets & guilds extend your economy — but they can be sieged.', 380);
    FloatingText.status(worldW / 2, worldH / 2 - 36, 'RTS ERA', '#ff8060');
  }

  function announceEnemyRtsEra() {
    if (wave !== RTS_ERA_WAVE) return;
    showMessage('Wave 200 — Enemy RTS! The map widens; foes raise hamlets and guilds of their own.', 400);
    FloatingText.status(worldW / 2, 56, 'ENEMY RTS', '#ff4040');
    AudioEngine.SFX.waveStart();
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
    buildings.push(b);
    onBuildingComplete(b);
    return b;
  }

  function bootstrapSpawnArmy(rows) {
    let ox = worldW / 2 - 90;
    for (const { type, count } of rows) {
      for (let i = 0; i < count; i++) {
        const u = spawnUnit(type, ox + (i % 4) * 22, deployY - 10 - Math.floor(i / 4) * 24, 'player');
        applyPlayerStatMods(u);
        u.targetY = rallyY;
        u.huntMode = globalHunt;
        units.push(u);
      }
      ox += 34;
    }
  }

  function bootstrapAcademyEraStart(targetWave) {
    const tw = Math.max(ACADEMY_ERA_WAVE, Math.min(targetWave || 105, 500));
    units = [];
    buildings = [];
    wave = tw;
    tactical = tw >= RTS_ERA_WAVE ? 145 : (tw >= ACADEMY_ERA_WAVE + ACADEMY_HYBRID_WAVES ? 120 : 105);
    applyWorldSize(wave);
    generateBattlefield();
    invalidateObstacles();
    resetCamera();
    if (wave >= RTS_ERA_WAVE) tryRtsMapExpansion();

    const cx = worldW / 2;
    const wy = rallyY - 50;
    for (let i = -3; i <= 3; i++) bootstrapPlaceComplete('wall', cx + i * 28, wy);
    bootstrapPlaceComplete('outpost', cx, wy - 35);
    bootstrapPlaceComplete('hamlet', cx - 130, wy - 90);
    bootstrapPlaceComplete('hamlet', cx + 130, wy - 90);
    if (tw >= ACADEMY_ERA_WAVE + 10) bootstrapPlaceComplete('merchant_guild', cx, wy - 120);
    ['academy_footman', 'academy_archer', 'academy_knight', 'academy_mage', 'academy_builder'].forEach((t, i) => {
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
      bootstrapSpawnArmy([{ type: 'knight', count: 4 }, { type: 'archer', count: 4 }]);
      bootstrapPlaceComplete('enemy_hamlet', Math.floor(worldW * 0.75), Math.floor(worldH * 0.25), 'enemy');
    }
    invalidateObstacles();

    timeOfDay = 'night';
    nightTimer = Math.floor(NIGHT_PREP_TICKS * (typeof GameModes !== 'undefined' ? GameModes.getNightPrepMult() : 1));
    addHighlight('era', `Academy Era — wave ${tw}`);
    if (tw === ACADEMY_ERA_WAVE) {
      announceAcademyEra();
      announceRtsEra();
    } else if (tw >= RTS_ERA_WAVE) {
      showMessage(`Academy Era mode — wave ${tw}. Enemy RTS: wider map, foe settlements — hunt their economy!`, 400);
      FloatingText.status(worldW / 2, 56, 'ENEMY RTS', '#ff4040');
    } else {
      showMessage(`Academy Era mode — wave ${tw}. Deploy troops and train through academies; hamlets & guilds fuel your economy.`, 380);
      FloatingText.status(worldW / 2, worldH / 2, 'ACADEMY ERA', '#c0a040');
    }
  }

  function maybeCampaignNarrative() {
    if (typeof LoreData === 'undefined' || !LoreData.ERA_BEATS) return;
    const beats = LoreData.ERA_BEATS.filter(b => b.wave === wave);
    for (const beat of beats) {
      addHighlight('campaign', beat.name);
    }
    const hookBeat = beats.find(b => [10, 25, 50, 100, 200, 1000].includes(wave));
    if (hookBeat) showMessage(`Chronicle — ${hookBeat.hook}`, 380);
  }

  function tryRtsMapExpansion() {
    if (wave !== RTS_ERA_WAVE) return false;
    const prevW = worldW, prevH = worldH;
    applyWorldSize(wave);
    if (worldW === prevW && worldH === prevH) return false;
    SpriteGen.invalidateBattlefieldCache();
    populateNewTerritory(prevW, prevH);
    resize();
    applyCamera();
    return true;
  }

  function tickSettlementWaveProgress() {
    for (const b of buildings) {
      if (b.hp <= 0 || b.complete || !b.waveBuildRequired) continue;
      b.waveBuildProgress = (b.waveBuildProgress || 0) + 1;
      const def = BuildDefs[b.type];
      const name = def?.name || 'Settlement';
      if (b.waveBuildProgress >= b.waveBuildRequired) {
        b.complete = true;
        onBuildingComplete(b);
        const eco = b.isHamlet
          ? ` +${b.tpBonusPerHamlet ?? def?.tpBonusPerHamlet ?? (typeof HAMLET_TP_PER_ROUND !== 'undefined' ? HAMLET_TP_PER_ROUND : 5)} TP/round`
          : '';
        const owner = b.owner === 'enemy' ? 'Enemy ' : '';
        showMessage(`${owner}${name} complete!${eco}`, 280);
        Particles.dust(b.x, b.y);
        if (b.owner === 'enemy') AudioEngine.SFX.waveStart();
      } else if (b.owner === 'player') {
        showMessage(`${name} construction — wave ${b.waveBuildProgress}/${b.waveBuildRequired}`, 160);
      }
    }
  }

  function tryPlaceEnemyBuilding(type) {
    const def = BuildDefs[type];
    if (!def) return false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 50 + Math.random() * (worldW - 100);
      const y = 36 + Math.random() * Math.max(80, worldH * 0.32);
      if (isBuildSiteBlocked(x, y, def)) continue;
      const b = createBuilding(type, x, y, 'enemy');
      buildings.push(b);
      invalidateObstacles();
      showMessage(`Enemy ${def.name} rising in the north!`, 260);
      return true;
    }
    return false;
  }

  function updateEnemyRTS() {
    if (creativeMode) return;
    if (!isEnemyRtsEra(wave)) return;
    const enemyHamlets = buildings.filter(b => b.owner === 'enemy' && b.isHamlet && b.hp > 0).length;
    const enemyGuilds = buildings.filter(b => b.owner === 'enemy' && b.isMerchantGuild && b.hp > 0).length;
    if (wave % 8 === 0 && enemyHamlets < Math.floor(academyProgress(wave) * 2.5) + 1) {
      tryPlaceEnemyBuilding('enemy_hamlet');
    }
    if (wave % 12 === 0 && enemyGuilds < Math.floor(postAcademyProgress(wave) * 2.5) + 1) {
      tryPlaceEnemyBuilding('enemy_merchant_guild');
    }
  }

  function spawnAcademyUnit(academy, unitType) {
    const sx = academy.slotX ?? academy.x;
    const sy = (academy.slotY ?? academy.y) + 16;
    const u = spawnUnit(unitType, sx, sy, 'player');
    u.targetY = rallyY;
    u.huntMode = globalHunt && u.canHunt;
    if (typeof ContentExpansion !== 'undefined') ContentExpansion.applyLoadoutToUnit(u);
    units.push(u);
    Particles.dust(sx, sy);
    return u;
  }

  function processAcademyTraining() {
    let trained = 0;
    for (const b of buildings) {
      if (!b.complete || !b.isAcademy || b.hp <= 0) continue;
      const def = BuildDefs[b.type];
      const unitType = b.academyUnit || def?.academyUnit;
      if (!unitType) continue;

      if (def?.requiresAbsentUnit) {
        const live = units.filter(u =>
          u.team === 'player' && u.type === def.requiresAbsentUnit && u.hp > 0
        );
        if (live.length > 1) continue;
        if (live.length === 1 && !isMaxLevelVeteran(live[0])) continue;
      }

      if (b.type === 'academy_general') {
        if (findPlayerGeneral()) continue;
        const footman = findPromotableFootman(units);
        if (!footman) continue;
        releaseFromWallGarrison(footman);
        releaseFromGarrison(footman);
        promoteFootmanToGeneral(footman);
        footman.x = (b.slotX ?? b.x);
        footman.y = (b.slotY ?? b.y) + 12;
        const honor = footman.honorName ? `${footman.honorName} ` : '';
        showMessage(`${honor}promoted to General — stats retained, stars reset for command aura!`, 300);
        if (footman.honorName) FloatingText.status(footman.x, footman.y - 14, footman.honorName, '#ffd700');
        trained++;
        Particles.heal(footman.x, footman.y);
        continue;
      }

      if (unitType === 'general') continue;

      spawnAcademyUnit(b, unitType);
      trained++;
    }
    if (trained > 0) {
      showMessage(`Academies trained ${trained} unit${trained > 1 ? 's' : ''} this round.`, 200);
      AudioEngine.SFX.deploy();
    }
  }

  function findNearestPlayerSettlement(from) {
    let best = null, bestScore = Infinity;
    for (const b of buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      if (!b.isHamlet && !b.isMerchantGuild) continue;
      const d = Math.hypot(b.x - from.x, b.y - from.y);
      if (d > 520) continue;
      let score = d;
      if (b.isHamlet) score -= 180;
      if (b.isMerchantGuild) score -= 120;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best;
  }

  function findEnemyMoveTarget(unit) {
    const general = findPlayerGeneral();
    if (general && (unit.type === 'assassin' || unit.type === 'void_stalker' || EnemyDefs[unit.type]?.huntsGeneral)) {
      return { kind: 'unit', target: general };
    }
    if (general && (!general.stationedKeep || Math.random() < 0.55)) {
      return { kind: 'unit', target: general };
    }
    const settlement = findNearestPlayerSettlement(unit);
    if (settlement && Math.random() < (isRtsEra(wave) ? 0.72 : 0.35)) {
      return { kind: 'building', target: settlement };
    }
    const tactical = findTacticalTarget(unit);
    if (tactical) return { kind: 'unit', target: tactical };
    const nearest = findNearestPlayer(unit);
    if (nearest) return { kind: 'unit', target: nearest };
    return { kind: 'advance', target: null };
  }

  function pathClearanceForUnit(unit) {
    if (unit?.spriteScale >= 1.5 || unit?.type === 'behemoth' || unit?.type === 'iron_colossus') {
      return UNIT_COLLISION + 14;
    }
    if (unit?.combatType === 'cavalry' || unit?.type === 'siege_tower') return UNIT_COLLISION + 8;
    return UNIT_COLLISION + 2;
  }

  function unitBlocksMovement(u) {
    if (!u || u.hp <= 0) return false;
    if (u.garrisoned || u.stationedKeep || u.wallGarrisoned) return false;
    if (u.siegeDeployed) return false;
    return true;
  }

  function isTerrainBlockedAt(x, y, unit, clearance) {
    const scanRadius = clearance + 56;
    if (useSpatialQueries()) {
      const near = Spatial.queryRadius(x, y, scanRadius, e => e.kind === 'building' || e.kind === 'deco');
      for (const d of near) {
        if (!obstacleBlocksForUnit(d, unit)) continue;
        const tr = terrainBlockRadius(d);
        if (tr <= 0) continue;
        if (Math.hypot(x - d.x, y - d.y) < tr + clearance) return true;
      }
      return false;
    }
    for (const d of allObstacles()) {
      if (!obstacleBlocksForUnit(d, unit)) continue;
      if (Math.hypot(x - d.x, y - d.y) < (d.radius || 14) + clearance) return true;
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
    const r = UNIT_COLLISION + margin;
    const near = useSpatialQueries()
      ? Spatial.queryRadius(x, y, r + 8, e => e.kind === 'unit')
      : units;
    for (const u of near) {
      if (u === unit || !unitBlocksMovement(u)) continue;
      const d = Math.hypot(x - u.x, y - u.y);
      if (!unit) {
        if (d < r) return true;
        continue;
      }
      // Enemies press through player lines to attack — only hard-block on overlap
      if (unit.team === 'enemy' && u.team === 'player') {
        if (d < r * 0.35) return true;
        continue;
      }
      if (unit.team === 'player' && u.team === 'enemy') {
        if (d < r * 0.35) return true;
        continue;
      }
      if (u.team === unit.team) {
        const allyR = unitHasActiveMarch(unit) ? r * 0.4 : r;
        if (d < allyR) return true;
        continue;
      }
      if (unit.team === 'enemy' && u.team === 'enemy') {
        const hordeR = (enemyIsAdvancing(unit) || enemyIsAdvancing(u)) ? r * 0.35 : r * 0.55;
        if (d < hordeR) return true;
      }
    }
    return false;
  }

  function nudgeUnitFree(unit) {
    if (!isTerrainBlocked(unit.x, unit.y, unit) && !isBlocked(unit.x, unit.y, unit, 0)) return false;
    for (let ring = 8; ring <= 56; ring += 8) {
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const pos = clampPos(unit.x + Math.cos(angle) * ring, unit.y + Math.sin(angle) * ring);
        if (!isTerrainBlocked(pos.x, pos.y, unit) && !isBlocked(pos.x, pos.y, unit, 0)) {
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
    const allies = useSpatialQueries()
      ? Spatial.queryRadius(unit.x, unit.y, UNIT_COLLISION * 4, e => e.kind === 'unit' && e.ref?.team === unit.team && e.ref !== unit)
        .map(e => e)
      : units;
    for (const u of allies) {
      if (u === unit || !unitBlocksMovement(u) || u.team !== unit.team) continue;
      const dx = unit.x - u.x, dy = unit.y - u.y;
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
    const dx = tx - unit.x, dy = ty - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return false;

    const speed = unit.speed * (unit.hazardSlow || 1) * (unit.combatType === 'cavalry' ? 1.4 : 1.15);
    const sep = separationVector(unit);
    const sepWeight = unit.team === 'enemy' && enemyIsAdvancing(unit) ? 0.35
      : unit.team === 'player' && unitHasActiveMarch(unit) ? 0.55
      : 1.4;
    let ux = dx / dist + sep.x * sepWeight;
    let uy = dy / dist + sep.y * sepWeight;
    const ulen = Math.hypot(ux, uy) || 1;
    ux /= ulen;
    uy /= ulen;

    const candidates = [{ x: ux, y: uy, w: 4 }];

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const vx = Math.cos(angle), vy = Math.sin(angle);
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
    return false;
  }

  function resolveOverlaps() {
    const n = units.length;
    if (n < 2) return;
    if (updateTick % 2 !== 0 && n > 24) return;
    if (updateTick % 4 !== 0 && n > 70) return;
    if (updateTick % 6 !== 0 && n > 110) return;
    const cellSize = 36;
    const grid = new Map();
    for (let i = 0; i < n; i++) {
      const u = units[i];
      if (!unitBlocksMovement(u)) continue;
      const key = `${Math.floor(u.x / cellSize)},${Math.floor(u.y / cellSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    const minSep = UNIT_COLLISION + 1;
    const seen = new Set();
    for (const [key, indices] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      const neighbors = [];
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get(`${cx + ox},${cy + oy}`);
          if (bucket) neighbors.push(...bucket);
        }
      }
      for (const i of indices) {
        const a = units[i];
        if (!unitBlocksMovement(a)) continue;
        for (const j of neighbors) {
          if (j <= i) continue;
          const pairKey = i < j ? `${i}:${j}` : `${j}:${i}`;
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);
          const b = units[j];
          if (!unitBlocksMovement(b)) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (dist >= minSep) continue;
          if (dist < 0.01) {
            a.x += (Math.random() - 0.5) * 8;
            a.y += (Math.random() - 0.5) * 8;
            continue;
          }
          const sameTeam = a.team === b.team;
          let push = (minSep - dist) * (sameTeam ? 0.45 : 0.25);
          if (sameTeam && (unitHasActiveMarch(a) || unitHasActiveMarch(b))) push *= 0.25;
          if (!sameTeam && a.team === 'enemy' && b.team === 'enemy' &&
              (enemyIsAdvancing(a) || enemyIsAdvancing(b))) push *= 0.3;
          const nx = dx / dist, ny = dy / dist;
          const ca = clampPos(a.x - nx * push, a.y - ny * push);
          const cb = clampPos(b.x + nx * push, b.y + ny * push);
          if (!isBlocked(ca.x, ca.y, a, 0)) { a.x = ca.x; a.y = ca.y; }
          if (!isBlocked(cb.x, cb.y, b, 0)) { b.x = cb.x; b.y = cb.y; }
        }
      }
    }
  }

  function awardRoundTP() {
    if (tpAwardedForWave === wave) return;
    tpAwardedForWave = wave;
    const eco = getSettlementTpBonus();
    const gained = Math.min(120, getTpPerRound() + pendingLevy);
    tactical += gained;
    pendingLevy = 0;
    sanitizeTactical();
    const ecoNote = eco > 0 ? ` (+${eco} from settlements)` : '';
    showMessage(`Round complete! +${gained} Tactical Points${ecoNote}`);
  }

  function resetWaveModifiers() {
    waveModifiers = {
      countMult: pendingWaveMods.countMult,
      hpMult: pendingWaveMods.hpMult,
      noElites: pendingWaveMods.noElites,
      stealReduction: pendingWaveMods.stealReduction,
      revealed: false, nextPreview: '',
    };
    pendingWaveMods = { countMult: 1, hpMult: 1, noElites: false, stealReduction: 0 };
  }

  function start(opts = {}) {
    if (!opts.creative) {
      creativeMode = false;
      creativeTool = null;
      creativeSpawnType = null;
    } else {
      creativeMode = true;
    }
    const diff = getDifficulty();
    state = 'playing';
    units = []; projectiles = []; buildings = []; moveMarkers = [];
    tactical = diff.startingTp; wave = 0; kills = 0; misses = 0;
    spawnQueue = []; spawnDelayBonus = 0; pendingReinforce = []; pendingLevy = 0;
    selectedDeploy = null; selectedAbility = null; selectedBuild = null;
    selectedDemolish = false; selectedMoveBuilding = false; moveBuildingTarget = null;
    selectedRotateWall = false; pendingWallFacing = 'north';
    selectedUnitId = null; selectedUnitIds = []; selectedCourierMsg = null; paused = false;
    applyGameSpeedFromSettings();
    sessionHighlights = []; boxSelect = null;
    tpAwardedForWave = -1;
    spatialFrame = -1;
    globalHunt = true; spyNetwork = true; courierCooldown = 0; courierUsedThisWave = false;
    spyUsedThisWave = false; currentWaveConfig = null; firstWallWave = null;
    rallyTimer = 0; waveProgress = 0; waveEnemyTotal = 0; waveAttackSides = ['north'];
    namedBossWave = null; bossTrackId = null; currentHordeWave = null;
    timeOfDay = 'day'; nightTimer = 0; fallenPool = [];
    moraleCascadeState = { recentBreaks: [], cascade: false, tick: 0 };
    lastStandActive = false;
    nextWaveIntel = '';
    colonySnapshot = null;
    colonyThreatMods = { countMult: 1, hpMult: 1, dmgMult: 1, intervalMult: 1, weights: {}, eliteSlots: 0 };
    hazards = [];
    mapsRevealed = false;
    generalThreatCount = 0;
    unmannedWallWarned = false;
    builderAutoRepair = true;
    Particles.clear(); CombatFX.clear(); StrikeFX?.clear?.(); FloatingText.clear();
    resetWaveModifiers();
    bindContentExpansion();
    if (typeof FactionDepth !== 'undefined') FactionDepth.onGameStart();
    applyWorldSize(0);
    generateBattlefield();
    invalidateObstacles();
    SpriteGen.prewarmCache();
    resetCamera();
    if (canvas) canvas.style.cursor = 'grab';
    AudioEngine.startMusic();
    MetaProgress.load();
    let modeDifficulty = difficultyId;
    let runSession = null;
    if (!creativeMode && typeof GameModes !== 'undefined') {
      const begun = GameModes.beginSession(difficultyId);
      runSession = begun?.session ?? GameModes.getSession();
      if (begun?.difficulty) {
        modeDifficulty = begun.difficulty;
        difficultyId = modeDifficulty;
      }
    }
    const academyEraMode = !creativeMode && runSession?.modeId === 'academy_era';
    if (!creativeMode && !academyEraMode) {
      for (let i = 0; i < 4; i++) {
        const u = spawnUnit('footman', 80 + i * 70, deployY, 'player');
        u.targetY = rallyY;
        if (diff.playerMoraleBonus) {
          u.morale = Math.max(1, Math.min(u.maxMorale, u.morale + diff.playerMoraleBonus));
          if (diff.playerMoraleBonus > 0) u.maxMorale = Math.min(40, u.maxMorale + diff.playerMoraleBonus);
        }
        units.push(u);
      }
    }
    if (typeof Legacy !== 'undefined') {
      Legacy.onRunStart({ difficulty: difficultyId, creative: creativeMode });
    }
    if (creativeMode) {
      wave = creativeSettings.startWave || 0;
      tactical = creativeSettings.startTp || 9999;
      spawnQueue = [];
      timeOfDay = 'night';
      nightTimer = NIGHT_PREP_TICKS;
      applyWorldSize(wave);
      generateBattlefield();
      invalidateObstacles();
      showMessage('CREATIVE MODE — sandbox active. Press P for the lab panel.', 320);
      typeof CreativeTools !== 'undefined' && CreativeTools.onSessionStart();
    } else if (academyEraMode) {
      bootstrapAcademyEraStart(runSession?.academyStartWave ?? 105);
      const modeNote = runSession?.ironman ? ' · IRONMAN' : '';
      showMessage(`${diff.label} (${getDifficultyPercent()}%) · Academy Era${modeNote} — night prep at wave ${wave}.`, 360);
      if (runSession?.mods?.length) {
        showMessage(`Active modifiers: ${runSession.mods.length}`, 260);
      }
      ach('game_start', { difficulty: difficultyId, creative: false, mode: 'academy_era', wave });
    } else {
      const mode = typeof GameModes !== 'undefined' ? GameModes.getSession() : null;
      const modeNote = mode?.challengeLabel || (mode?.modeId && mode.modeId !== 'campaign' ? ` · ${mode.modeId}` : '');
      const ironNote = mode?.ironman ? ' · IRONMAN' : '';
      showMessage(`${diff.label} (${getDifficultyPercent()}%)${modeNote}${ironNote} — defend the realm!`, 320);
      if (mode?.mods?.length) {
        showMessage(`Active modifiers: ${mode.mods.length}${mode.seed ? ` · Seed ${mode.seed}` : ''}`, 260);
      }
      ach('game_start', { difficulty: difficultyId, creative: false });
      startNextWave();
    }
  }

  function buildSiegeSpawnQueue() {
    const diff = getDifficulty();
    const wallCount = countPlayerWalls();
    const siegeProg = typeof academyProgress === 'function' ? academyProgress(wave) : Math.min(1, wave / ACADEMY_ERA_WAVE);
    const towerCount = Math.max(1, Math.floor((4 + siegeProg * 16 + Math.floor(wallCount / 2)) * diff.siegeTowerMult * (diff.siegeWaveMult || 1)));
    spawnQueue = [];
    for (let i = 0; i < towerCount; i++) {
      spawnQueue.push('siege_tower', 'goblin_sapper', 'orc', 'orc', 'goblin');
      if (wave >= 10) spawnQueue.push('shaman');
      if (wave >= 15) spawnQueue.push('goblin_engineer');
    }
    waveEnemyTotal = spawnQueue.length;
    waveProgress = 0;
    showMessage(`SIEGE WAVE ${wave}! ${towerCount} siege tower(s) advancing!`);
  }

  function assessColonyThreat(targetWave = wave) {
    if (typeof ColonyValue === 'undefined') {
      colonySnapshot = null;
      colonyThreatMods = { countMult: 1, hpMult: 1, dmgMult: 1, intervalMult: 1, weights: {}, eliteSlots: 0 };
      return null;
    }
    colonySnapshot = ColonyValue.computeKingdomStrength({ wave: targetWave });
    colonyThreatMods = ColonyValue.deriveWavePressure(colonySnapshot, targetWave);
    return { colony: colonySnapshot, pressure: colonyThreatMods };
  }

  function buildSpawnQueue() {
    currentWaveConfig = getWaveConfig(wave);
    currentHordeWave = null;
    const diff = getDifficulty();
    const isBoss = typeof GameDepth !== 'undefined' && GameDepth.isBossWave
      ? GameDepth.isBossWave(wave)
      : currentWaveConfig.boss;
    const colonyAssess = assessColonyThreat(wave);
    const colonyPressure = colonyAssess?.pressure;

    if (!isBoss && typeof GameDepth !== 'undefined' && GameDepth.isHordeWave?.(wave)) {
      const pool = ColonyValue?.mergePool
        ? ColonyValue.mergePool([...(currentWaveConfig.pool || [])], colonyPressure || {})
        : [...(currentWaveConfig.pool || [])];
      const hordeMods = {
        ...waveModifiers,
        countMult: (waveModifiers.countMult || 1) * (colonyPressure?.countMult || 1),
      };
      currentHordeWave = GameDepth.buildHordeSpawnQueue(wave, pool, hordeMods, diff);
      if (colonyPressure && colonySnapshot?.signals?.wallCount >= 4 && wave >= 7
        && !currentHordeWave.queue.includes('siege_tower')) {
        currentHordeWave.queue.unshift('siege_tower', 'goblin_sapper');
        currentHordeWave.hasSiege = true;
      }
      spawnQueue = [...currentHordeWave.queue];
      waveEnemyTotal = spawnQueue.length;
      waveProgress = 0;
      const towers = spawnQueue.filter(t => t === 'siege_tower').length;
      nextWaveIntel = GameDepth.formatWaveIntel(spawnQueue, getWaveAttackSides(), currentHordeWave.hasSiege, towers) || '';
      const f = currentHordeWave.flavor;
      addHighlight('horde', `Horde wave ${wave} — ${f.label}`);
      showMessage(`HORDE WAVE ${wave}! ${f.label} — ${f.tagline}`, 360);
      FloatingText.status(worldW / 2, 48, 'HORDE INCOMING', '#ff9040');
      FloatingText.status(worldW / 2, 62, f.label.toUpperCase(), '#ffc060');
      if (currentHordeWave.hasSiege) {
        AudioEngine.SFX.siegeRumble?.();
        showMessage('Siege elements embedded in the horde — protect your walls!', 280);
      }
      if (colonySnapshot && colonyPressure && typeof ColonyValue !== 'undefined') {
        const note = ColonyValue.formatWaveNote(colonySnapshot, colonyPressure);
        nextWaveIntel = note + (nextWaveIntel ? ` · ${nextWaveIntel}` : '');
      }
      return;
    }
    let count = Math.max(1, Math.floor(currentWaveConfig.count * waveModifiers.countMult * diff.enemyCountMult
      * (colonyPressure?.countMult || 1)));
    if (isRtsEra(wave)) {
      const rtsProg = typeof postAcademyProgress === 'function' ? postAcademyProgress(wave) : 0;
      count = Math.floor(count * (1.22 + rtsProg * 0.28));
    }
    if (isEnemyRtsEra(wave)) {
      const enemyRts = typeof postAcademyProgress === 'function' ? postAcademyProgress(wave) : 0;
      count = Math.floor(count * (1.1 + enemyRts * 0.18));
    }
    count += getEnemyEconomySpawnBonus();
    if (waveModifiers.stealReduction) count = Math.max(1, count - waveModifiers.stealReduction);
    spawnQueue = [];
    const elites = ['dark_knight','war_chief','troll','siege_tower','necromancer','berserker','assassin',
      'sky_drake','bone_summoner','abomination','behemoth','iron_colossus','void_stalker','elder_wyrm',
      'boss_gorath','boss_morwen','boss_thokk','boss_grimm','boss_vexis','boss_karg',
      'boss_sylvara','boss_rotfather','boss_volk','boss_malachar'];
    const pool = ColonyValue?.mergePool
      ? ColonyValue.mergePool([...currentWaveConfig.pool], colonyPressure || {})
      : [...currentWaveConfig.pool];
    const weights = ColonyValue?.mergeWeights
      ? ColonyValue.mergeWeights(getDifficulty().enemyWeight || {}, colonyPressure?.weights)
      : (getDifficulty().enemyWeight || {});
    for (let i = 0; i < count; i++) {
      let pickPool = pool;
      if (waveModifiers.noElites || diff.forceNoElites) pickPool = pool.filter(t => !elites.includes(t));
      if (!pickPool.length) pickPool = pool;
      if (Object.keys(weights).length) {
        const weighted = [];
        for (const t of pickPool) {
          const w = Math.max(1, Math.floor((weights[t] || 1) * 10));
          for (let j = 0; j < w; j++) weighted.push(t);
        }
        spawnQueue.push(weighted[Math.floor(gameRandom() * weighted.length)]);
      } else {
        spawnQueue.push(pickPool[Math.floor(gameRandom() * pickPool.length)]);
      }
    }
    namedBossWave = typeof GameDepth !== 'undefined' ? GameDepth.getNamedBossForWave(wave) : null;
    if (isBoss && (!waveModifiers.noElites || namedBossWave)) {
      let bossCore = GameDepth?.bossWaveComposition(wave, pool) || ['war_chief', 'dark_knight', 'dark_knight'];
      if (waveModifiers.noElites && namedBossWave) {
        bossCore = [namedBossWave.type];
      }
      spawnQueue = bossCore.concat(spawnQueue.slice(0, Math.max(0, count - bossCore.length)));
      if (namedBossWave) {
        const assassinNote = waveModifiers.noElites ? ' (elites assassinated — boss remains)' : '';
        addHighlight('boss', `Boss wave ${wave} — ${namedBossWave.name} leads the assault${assassinNote}`);
        showMessage(`BOSS WAVE ${wave}! ${namedBossWave.name} — ${namedBossWave.tagline}`, 380);
        FloatingText.status(worldW / 2, 44, namedBossWave.name.toUpperCase(), '#ffd040');
        FloatingText.status(worldW / 2, 58, namedBossWave.title.toUpperCase(), '#ff6060');
      } else {
        addHighlight('boss', `Boss wave ${wave} — War Chief leads the assault`);
        showMessage(`BOSS WAVE ${wave}! War Chief leads the assault!`, 320);
        FloatingText.status(worldW / 2, 48, 'BOSS WAVE', '#ff4040');
      }
      AudioEngine.SFX.bossWarn?.();
    } else if (isBoss) {
      namedBossWave = null;
    }
    if (colonyPressure && typeof ColonyValue !== 'undefined') {
      ColonyValue.injectElites(spawnQueue, pool, colonyPressure, gameRandom);
    }
    const wantSiege = (colonySnapshot?.signals?.wallCount || 0) >= 3 || wave >= 7;
    if (wantSiege && !spawnQueue.includes('siege_tower') && !waveModifiers.noElites && !isBoss && !currentHordeWave) {
      spawnQueue[Math.floor(gameRandom() * spawnQueue.length)] = 'siege_tower';
    }
    if (waveModifiers.revealed || waveModifiers.nextPreview) {
      nextWaveIntel = GameDepth?.formatWaveIntel(spawnQueue, getWaveAttackSides(), false, 0)
        || [...new Set(spawnQueue.map(t => EnemyDefs[t]?.name || t))].join(', ');
      waveModifiers.nextPreview = nextWaveIntel;
      showMessage(`Scout report: ${nextWaveIntel}`, 360);
    }
    waveEnemyTotal = spawnQueue.length;
    waveProgress = 0;
    bossTrackId = namedBossWave?.type
      || ['boss_malachar', 'boss_volk', 'boss_karg', 'boss_sylvara', 'war_chief', 'behemoth', 'elder_wyrm', 'iron_colossus']
        .find(t => spawnQueue.includes(t))
      || null;
    if (typeof ContentExpansion !== 'undefined') {
      spawnQueue = ContentExpansion.applyWaveEvent(wave, spawnQueue);
      waveEnemyTotal = spawnQueue.length;
    }
    if (colonySnapshot && colonyPressure && typeof ColonyValue !== 'undefined') {
      const note = ColonyValue.formatWaveNote(colonySnapshot, colonyPressure);
      nextWaveIntel = note + (nextWaveIntel ? ` · ${nextWaveIntel}` : '');
    }
  }

  function healDoomslayerHero() {
    if (wave % 2 !== 0) return;
    for (const u of units) {
      if (u.team !== 'player' || !u.isDoomslayer || u.hp <= 0) continue;
      const missing = 1 - u.hp / u.maxHp;
      const heal = Math.floor(u.maxHp * missing * 0.5);
      if (heal > 0) {
        u.hp = Math.min(u.maxHp, u.hp + heal);
        FloatingText.heal(u.x, u.y, heal);
        showMessage('The Doomslayer absorbs hell\'s wrath — massive heal!', 200);
      }
    }
  }

  function startNextWave() {
    processAcademyTraining();
    tickSettlementWaveProgress();
    wave++;
    if (!(creativeMode && !creativeSettings.useCampaignRules) && typeof GameDepth !== 'undefined') {
      const tenure = GameDepth.applyVeteranTenureScaling(units, wave);
      if (tenure.enemyBuffed > 0 && wave >= 6) {
        showMessage(
          `${tenure.enemyBuffed} enemy veteran${tenure.enemyBuffed > 1 ? 's' : ''} hardened (+HP/DMG from prior waves).`,
          180,
        );
      }
    }
    healDoomslayerHero();
    tryExpandTerritory();
    tryRtsMapExpansion();
    updateEnemyRTS();
    waveAttackSides = rollWaveAttackSides(wave);
    announceAttackSides();
    announceAcademyEra();
    announceRtsEra();
    announceEnemyRtsEra();
    maybeCampaignNarrative();
    courierUsedThisWave = false;
    spyUsedThisWave = false;
    units.filter(u => u.team === 'player').forEach(u => {
      u.specialistRankedThisWave = false;
      u._revivedThisWave = false;
    });
    resetWaveModifiers();
    buildSpawnQueue();
    spawnTimer = 90 + spawnDelayBonus;
    spawnDelayBonus = 0;

    for (const t of pendingReinforce) {
      const u = spawnUnit(t, 60 + Math.random() * (worldW - 120), deployY - 10, 'player');
      if (!u) continue;
      applyPlayerStatMods(u);
      if (typeof ContentExpansion !== 'undefined') ContentExpansion.applyLoadoutToUnit(u);
      u.targetY = rallyY;
      units.push(u);
    }
    pendingReinforce = [];

    if (isHordeWave()) showMessage(`HORDE ASSAULT — Wave ${wave}! ${currentHordeWave?.flavor?.label || ''}`);
    else if (currentWaveConfig?.boss || (typeof GameDepth !== 'undefined' && GameDepth.isBossWave?.(wave))) {
      showMessage(`BOSS WAVE ${wave}!`);
    }
    else showMessage(`Dawn breaks — Wave ${wave} assault begins!`);
    if (wave === 1001) {
      showMessage('HELLSCAPE — even the Doomslayer\'s blade falters here!', 400);
      FloatingText.status(worldW / 2, 80, 'HELLSCAPE', '#ff2020');
    }
    applyWweWaveStartPulse();
    if (typeof FactionDepth !== 'undefined') {
      FactionDepth.onWaveStart(units.filter(u => u.team === 'player' && u.hp > 0));
    }
    AudioEngine.SFX.waveStart();
  }

  function endGame(victory) {
    state = victory ? 'victory' : 'defeat';
    if (typeof UX !== 'undefined') UX.clearTutorialHighlights?.();
    AudioEngine.stopMusic();
    victory ? AudioEngine.SFX.victory() : AudioEngine.SFX.defeat();
    const honorNames = units
      .filter(u => u.team === 'player' && u.honorName)
      .map(u => u.honorName);
    if (typeof Legacy !== 'undefined') {
      Legacy.onGameEnd(victory, {
        difficulty: difficultyId,
        wave,
        kills,
        misses,
        creative: creativeMode,
      });
    }
    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendRunReport({
        victory,
        difficulty: difficultyId,
        wave,
        kills,
        misses,
        creative: creativeMode,
        highlights: sessionHighlights,
        honorNames,
      });
    }
    if (!creativeMode && typeof GameModes !== 'undefined') {
      GameModes.recordResult(wave, kills, victory, getDifficultyPercent());
      GameModes.endSession();
    }
  }

  function showMessage(text, duration = 220) {
    messages.push({ text, life: duration });
    if (typeof UX !== 'undefined') UX.onMessage(text);
  }

  function clearPlacementMode() {
    const had = !!(selectedDeploy || selectedAbility || selectedBuild || selectedCourierMsg
      || selectedDemolish || selectedMoveBuilding || moveBuildingTarget || selectedRotateWall);
    selectedDeploy = null;
    selectedAbility = null;
    selectedBuild = null;
    selectedCourierMsg = null;
    selectedDemolish = false;
    selectedMoveBuilding = false;
    moveBuildingTarget = null;
    selectedRotateWall = false;
    if (had) showMessage('Order cancelled.', 90);
    return had;
  }

  function clearSelection() {
    selectedDeploy = null;
    selectedAbility = null;
    selectedBuild = null;
    selectedCourierMsg = null;
    selectedDemolish = false;
    selectedMoveBuilding = false;
    moveBuildingTarget = null;
    selectedRotateWall = false;
    pendingWallFacing = 'north';
    selectedUnitId = null;
    selectedUnitIds = [];
  }

  function normalizeGameSpeed(speed) {
    const n = parseFloat(speed);
    return GAME_SPEED_OPTIONS.includes(n) ? n : 1;
  }

  function setGameSpeed(speed, opts = {}) {
    gameSpeed = normalizeGameSpeed(speed);
    speedAccumulator = 0;
    if (!opts.silent) showMessage(`Game speed ${gameSpeed}×`, 90);
    if (!opts.skipSettings && typeof Settings !== 'undefined') Settings.set('gameSpeed', gameSpeed);
    if (typeof UI !== 'undefined') UI.updateSpeedControl?.(gameSpeed);
  }

  function getGameSpeed() {
    return gameSpeed;
  }

  function cycleGameSpeed() {
    const idx = GAME_SPEED_OPTIONS.indexOf(gameSpeed);
    const next = GAME_SPEED_OPTIONS[(idx + 1) % GAME_SPEED_OPTIONS.length];
    setGameSpeed(next, { silent: true });
  }

  function applyGameSpeedFromSettings() {
    const saved = typeof Settings !== 'undefined' ? Settings.get('gameSpeed') : 1;
    setGameSpeed(saved, { silent: true, skipSettings: true });
  }

  /** How many simulation ticks to run this frame (1× = 1, 4× = up to 4). */
  function getSimulationSteps() {
    if (state !== 'playing' || paused || gameSpeed <= 1) {
      speedAccumulator = 0;
      return 1;
    }
    speedAccumulator += gameSpeed;
    let steps = Math.floor(speedAccumulator);
    speedAccumulator -= steps;
    return Math.min(Math.max(1, steps), 6);
  }

  function setPaused(value) {
    if (state !== 'playing') return;
    paused = !!value;
    if (paused) speedAccumulator = 0;
    if (typeof UX !== 'undefined') UX.onPauseChanged(paused);
    showMessage(paused ? 'Paused' : 'Resumed', 90);
  }

  function togglePause() {
    if (state !== 'playing') return;
    setPaused(!paused);
  }

  function selectDeploy(type) {
    const toggleOff = selectedDeploy === type;
    clearSelection();
    if (!toggleOff) selectedDeploy = type;
    AudioEngine.SFX.click();
  }

  function selectAbility(a) {
    const toggleOff = selectedAbility === a;
    clearSelection();
    if (!toggleOff) selectedAbility = a;
    AudioEngine.SFX.click();
  }

  function selectBuild(type) {
    const toggleOff = selectedBuild === type;
    clearSelection();
    if (!toggleOff) {
      selectedBuild = type;
      if (type === 'wall') {
        pendingWallFacing = 'north';
        showMessage('Wall facing north — press R to rotate before placing.', 200);
      }
    }
    AudioEngine.SFX.click();
  }

  function cycleWallPlacementFacing() {
    if (selectedBuild !== 'wall') return false;
    pendingWallFacing = cycleWallFacing(pendingWallFacing);
    showMessage(`Wall facing: ${pendingWallFacing}`, 120);
    AudioEngine.SFX.click();
    return true;
  }

  function selectDemolish() {
    const toggleOff = selectedDemolish;
    clearSelection();
    if (!toggleOff) {
      selectedDemolish = true;
      showMessage('Demolish — click a completed structure. Refunds 50% TP.', 200);
    }
    AudioEngine.SFX.click();
  }

  function selectMoveBuilding() {
    const toggleOff = selectedMoveBuilding;
    clearSelection();
    if (!toggleOff) {
      selectedMoveBuilding = true;
      showMessage('Move building — click structure, then destination (free).', 220);
    }
    AudioEngine.SFX.click();
  }

  function selectRotateWall() {
    const toggleOff = selectedRotateWall;
    clearSelection();
    if (!toggleOff) {
      selectedRotateWall = true;
      showMessage('Rotate wall — click a wall to turn it 90° (free).', 200);
    }
    AudioEngine.SFX.click();
  }

  function rotateWall(b) {
    if (!b || b.type !== 'wall' || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const newFacing = cycleWallFacing(b.facing);
    b.facing = newFacing;
    const oldSlots = b.wallSlots || [];
    b.wallSlots = getWallSlotPositions(newFacing, b.x, b.y);
    for (let i = 0; i < oldSlots.length && i < b.wallSlots.length; i++) {
      b.wallSlots[i].unitId = oldSlots[i].unitId;
      if (!oldSlots[i].unitId) continue;
      const wu = units.find(u => u.id === oldSlots[i].unitId);
      if (!wu) continue;
      wu.x = b.wallSlots[i].slotX;
      wu.y = b.wallSlots[i].slotY;
      wu.targetX = wu.x;
      wu.targetY = wu.y;
      wu.path = [];
      wu.wallSlotIndex = i;
      wu.rotation = wallFacingRotation(newFacing);
    }
    Particles.dust(b.x, b.y);
    showMessage(`Wall rotated — now facing ${newFacing}.`);
    AudioEngine.SFX.click();
    return true;
  }

  function selectCourierMessage(msg) {
    const toggleOff = selectedCourierMsg === msg;
    clearSelection();
    if (!toggleOff) selectedCourierMsg = msg;
    AudioEngine.SFX.click();
  }

  function executeSpyAction(action) {
    const def = SpyActions[action];
    const cost = typeof ContentExpansion !== 'undefined'
      ? ContentExpansion.getSpyCost(action, def?.cost ?? 99)
      : (def?.cost ?? 99);
    if (!def || tactical < cost) { showMessage('Not enough TP or invalid action!'); return false; }
    if (spyUsedThisWave) { showMessage('Spy network already used this wave!'); return false; }
    tactical -= cost;
    spyUsedThisWave = true;

    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.handleSpyAction(action)) {
      AudioEngine.SFX.magicCast();
      ach('spy', { action });
      return true;
    }

    if (action === 'steal') {
      tactical += 4;
      pendingWaveMods.stealReduction += 2;
      showMessage('Spy stole enemy war chest! +4 TP');
    } else if (action === 'disrupt') {
      pendingWaveMods.countMult = 0.65;
      showMessage('Supply lines disrupted! Next wave weakened.');
    } else if (action === 'assassin') {
      pendingWaveMods.noElites = true;
      showMessage('Enemy captain assassinated! No elites next wave.');
    } else if (action === 'scout' || action === 'infiltrate') {
      pendingWaveMods.revealed = true;
      waveModifiers.revealed = true;
      const sides = getUnlockedAttackSides(wave + 1);
      const nextW = wave + 1;
      const horde = nextW >= 5 && nextW % 5 === 0 && !(nextW >= 10 && nextW % 10 === 0);
      const boss = nextW >= 10 && nextW % 10 === 0;
      let extra = '';
      if (boss) extra = ' Named BOSS expected.';
      else if (horde) extra = ' HORDE expected.';
      nextWaveIntel = `Scout intel locked — exact roster at dawn.${sides.length > 1 ? ` Possible flanks: ${sides.join(', ')}` : ''}${extra}`;
      showMessage(nextWaveIntel, 340);
    } else if (action === 'bribery') {
      pendingWaveMods.revealed = true;
      waveModifiers.revealed = true;
      const sides = getUnlockedAttackSides(wave + 1);
      if (Math.random() < 0.5) pendingWaveMods.stealReduction += 3;
      else { tactical = Math.max(0, tactical - 2); showMessage('Informant double-crossed! -2 TP', 180); }
      nextWaveIntel = `Bribed intel${sides.length > 1 ? ` · Possible flanks: ${sides.join(', ')}` : ''}`;
      showMessage(nextWaveIntel, 300);
    } else if (action === 'poison') {
      pendingWaveMods.hpMult = 0.8;
      showMessage('Enemy caches poisoned! Next wave -20% HP.');
    } else if (action === 'sabotage') {
      spawnDelayBonus = 120;
      showMessage('Siege equipment sabotaged! Enemy spawns delayed.');
    }
    AudioEngine.SFX.magicCast();
    ach('spy', { action });
    return true;
  }

  function hasCourier() {
    return units.some(u => u.team === 'player' && u.type === 'courier' && u.hp > 0 && u.courierReady);
  }

  function sendCourierMessage(msg) {
    const def = CourierMessages[msg];
    const cost = typeof ContentExpansion !== 'undefined'
      ? ContentExpansion.getCourierCost(msg, def?.cost ?? 99)
      : (def?.cost ?? 99);
    if (!def || tactical < cost) { showMessage('Not enough TP!'); return false; }
    if (courierUsedThisWave) { showMessage('Courier already dispatched this wave!'); return false; }
    if (!hasCourier()) { showMessage('You need a live Courier on the field!'); return false; }
    if (courierCooldown > 0) { showMessage('Courier is still riding...'); return false; }
    tactical -= cost;
    courierUsedThisWave = true;
    const courier = units.find(u => u.type === 'courier' && u.hp > 0);
    courierCooldown = Math.max(60, Math.floor(180 * (courier?.courierCooldownMult || 1)));
    if (courier) {
      courier.courierReady = false;
      courier.animState = 'walk';
      notifyVetStarEvent(courier, trySpecialistRank(courier));
    }

    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.handleCourierMessage(msg)) {
      showMessage(`Courier dispatched: ${def.name}`);
      AudioEngine.SFX.deploy();
      ach('courier', { message: msg });
      return true;
    }

    if (msg === 'reinforce') pendingReinforce.push('footman', 'footman');
    else if (msg === 'decree') units.filter(u => u.team === 'player').forEach(u => {
      u.morale = Math.min(u.maxMorale, u.morale + 5);
      u.demoralized = false;
      u.witnessDeaths = 0;
    });
    else if (msg === 'levy') pendingLevy = 6;
    else if (msg === 'banner') {
      const u = spawnUnit('knight', 200, deployY, 'player');
      u.targetY = rallyY;
      units.push(u);
    } else if (msg === 'supplies') {
      units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => u.hp = Math.min(u.maxHp, u.hp + 25));
    } else if (msg === 'truce') {
      spawnDelayBonus += 90;
      units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
        u.morale = Math.min(u.maxMorale, u.morale + 8);
        u.demoralized = false;
      });
    } else if (msg === 'evacuate') {
      for (const u of units) {
        if (u.team !== 'player' || u.hp <= 0 || u.hp / u.maxHp >= RETREAT_HP_RATIO) continue;
        const tent = findNearestMedicalTent(u);
        if (tent) {
          releaseFromWallGarrison(u);
          releaseFromGarrison(u);
          u.retreatingToMed = tent.id;
          u.fightToDeath = false;
          u.huntMode = false;
        }
      }
    }
    if (courier && (courier.vetTier || 0) >= 4 && msg !== 'levy') {
      courierCooldown = Math.max(30, Math.floor(courierCooldown * 0.75));
    }
    showMessage(`Courier dispatched: ${def.name}`);
    AudioEngine.SFX.deploy();
    ach('courier', { message: msg });
    return true;
  }

  function findPlayerBuildingAt(wx, wy) {
    let best = null;
    let bestDist = Infinity;
    for (const b of buildings) {
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

  function getBuildingRefund(b) {
    return Math.floor((BuildDefs[b.type]?.cost ?? 0) * 0.5);
  }

  function detachBuildingFromBuilders(b) {
    for (const u of units) {
      if (u.repairTarget?.id === b.id) u.repairTarget = null;
      if (u.combatType !== 'builder' && u.type !== 'builder') continue;
      const cur = u.building;
      if (cur?.id === b.id) {
        u.building = null;
      } else if (cur?.compound && cur.parts?.some(p => p.id === b.id)) {
        cur.parts = cur.parts.filter(p => p.id !== b.id);
        if (cur.parts.length === 0) u.building = null;
      } else if (cur?.pending && cur.type === b.type && Math.hypot(cur.x - b.x, cur.y - b.y) < 4) {
        u.building = null;
      }
      if (u.buildQueue?.length) {
        u.buildQueue = u.buildQueue.filter(item => {
          if (item.id === b.id) return false;
          if (item.pending && item.type === b.type && Math.hypot(item.x - b.x, item.y - b.y) < 4) return false;
          return true;
        });
      }
    }
  }

  function cleanupBuildingOccupants(b) {
    if (b.garrisonUnitId) {
      const gu = units.find(u => u.id === b.garrisonUnitId);
      if (gu) releaseFromGarrison(gu);
    }
    if (b.generalUnitId) {
      const gen = units.find(u => u.id === b.generalUnitId);
      if (gen) releaseFromKeep(gen);
    }
    if (b.wallSlots) {
      for (const slot of b.wallSlots) {
        if (!slot.unitId) continue;
        const wu = units.find(u => u.id === slot.unitId);
        if (wu) releaseFromWallGarrison(wu);
        slot.unitId = null;
      }
    }
    if (b.siegeTowerId) {
      const tower = units.find(u => u.id === b.siegeTowerId);
      if (tower) clearSiegeLink(tower);
    }
    if (b.isMedical) {
      for (const u of units) {
        if (u.retreatingToMed === b.id || u.atMedicalTent === b.id) {
          u.retreatingToMed = null;
          u.atMedicalTent = null;
          u.fightToDeath = false;
        }
      }
    }
  }

  function removeBuildingRecord(b) {
    const idx = buildings.indexOf(b);
    if (idx >= 0) buildings.splice(idx, 1);
  }

  function clearBuildingTargeting(b) {
    const bldKey = `bld:${b.id}`;
    for (const u of units) {
      if (u.structureTargetId === b.id) u.structureTargetId = null;
      if (u.pathTargetId === bldKey) {
        u.pathTargetId = null;
        u.path = [];
        u.pathIndex = 0;
      }
    }
  }

  function finalizeBuildingDestroyed(b, opts = {}) {
    if (!b || b._destroyed) return false;
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
    if (!opts.silent && opts.playDeath !== false) AudioEngine.SFX.death();
    return true;
  }

  function demolishBuilding(b) {
    if (!b || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const name = BuildDefs[b.type]?.name || 'Structure';
    const refund = getBuildingRefund(b);
    finalizeBuildingDestroyed(b, { silent: true });
    if (refund > 0 && !(creativeMode && creativeSettings.freeResources)) {
      tactical = Math.min(TP_SANITY_CAP, tactical + refund);
      FloatingText.status(b.x, b.y - 12, `+${refund} TP`, '#80c0ff');
    }
    Particles.dust(b.x, b.y);
    showMessage(`${name} demolished${refund > 0 ? ` — +${refund} TP refunded` : ''}.`);
    AudioEngine.SFX.click();
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
    if (b.type === 'wall' && b.wallSlots) {
      const oldSlots = b.wallSlots;
      b.wallSlots = getWallSlotPositions(b.facing, pos.x, pos.y);
      for (let i = 0; i < oldSlots.length && i < b.wallSlots.length; i++) {
        b.wallSlots[i].unitId = oldSlots[i].unitId;
        if (oldSlots[i].unitId) {
          const wu = units.find(u => u.id === oldSlots[i].unitId);
          if (wu) {
            wu.x = b.wallSlots[i].slotX;
            wu.y = b.wallSlots[i].slotY;
            wu.targetX = wu.x;
            wu.targetY = wu.y;
            wu.path = [];
          }
        }
      }
    }
    if (b.garrisonUnitId) {
      const gu = units.find(u => u.id === b.garrisonUnitId);
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
      const gen = units.find(u => u.id === b.generalUnitId);
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
    Particles.dust(pos.x, pos.y);
    showMessage(`${def.name} relocated.`);
    AudioEngine.SFX.deploy();
    return true;
  }

  function getUnitAt(wx, wy, team = 'player') {
    const hitBonus = typeof UX !== 'undefined' ? UX.getHitboxBonus() : 0;
    if (useSpatialQueries()) {
      if (typeof Perf !== 'undefined') Perf.count('spatialQueries');
      const near = Spatial.queryRadius(wx, wy, 36 + hitBonus, e => e.kind === 'unit' && e.ref?.team === team);
      for (let i = near.length - 1; i >= 0; i--) {
        const u = near[i];
        const sz = (SpriteGen.UNIT_STYLE[u.spriteType] || { size: 9 }).size + 10 + hitBonus;
        if (Math.hypot(u.x - wx, u.y - wy) < sz) return u;
      }
      return null;
    }
    const list = units.filter(u => u.team === team && u.hp > 0);
    for (let i = list.length - 1; i >= 0; i--) {
      const u = list[i];
      const sz = (SpriteGen.UNIT_STYLE[u.spriteType] || { size: 9 }).size + 10 + hitBonus;
      if (Math.hypot(u.x - wx, u.y - wy) < sz) return u;
    }
    return null;
  }

  function setUnitPath(unit, tx, ty, targetUnit = null) {
    let destX = tx, destY = ty;
    if (targetUnit) {
      const slot = getSurroundSlot(unit, targetUnit);
      destX = slot.x;
      destY = slot.y;
    }
    const offscreen = !isInView(unit.x, unit.y, 80, 0);
    if (offscreen && pathfindBudget <= 0) return;
    if (offscreen) pathfindBudget--;
    if (typeof Perf !== 'undefined') Perf.begin('path');
    unit.path = Pathfinding.findPath(unit.x, unit.y, destX, destY, unit, isTerrainBlockedForPath, {
      maxNodes: offscreen ? 600 : undefined,
    });
    if (typeof Perf !== 'undefined') Perf.end('path');
    unit.pathIndex = 0;
    unit.targetX = destX;
    unit.targetY = destY;
    unit.pathTargetId = targetUnit?.id ?? null;
    unit.pathRecalc = 0;
    unit.pathStuck = 0;
    unit.stillFrames = 0;
  }

  function finishManualOrder(unit) {
    if (!unit.manualOrder) return;
    unit.manualOrder = false;
    if (unit.canHunt) {
      unit.huntMode = globalHunt;
      unit.pathRecalc = 0;
    }
  }

  function orderMove(unit, tx, ty, manual = true) {
    const pos = clampPos(tx, ty);
    if (manual && (unit.garrisoned || hasPendingOutpostGarrison(unit))) releaseFromGarrison(unit);
    if (manual && unit.stationedKeep) releaseFromKeep(unit);
    if (manual && (unit.wallGarrisoned || isMarchingToWallSlot(unit))) releaseFromWallGarrison(unit);
    if (manual && unit.retreatingToMed) {
      unit.retreatingToMed = null;
      unit.atMedicalTent = null;
      unit.fightToDeath = false;
    }
    setUnitPath(unit, pos.x, pos.y);
    if (manual) {
      unit.manualOrder = true;
      unit.huntMode = false;
      unit.combatTargetId = null;
      unit.pathTargetId = null;
      unit.pathRecalc = 0;
      if (unit.combatType === 'healer') {
        unit.healerFleeing = false;
        unit.healTargetId = null;
      }
      if (unit.combatType === 'builder') {
        unit.repairTarget = null;
      }
    }
    moveMarkers.push({ x: pos.x, y: pos.y, life: 150, unitId: unit.id });
  }

  function toggleHunt(unit) {
    if (!unit.canHunt) return;
    unit.huntMode = !unit.huntMode;
    unit.manualOrder = !unit.huntMode;
    showMessage(unit.huntMode ? 'Unit will hunt enemies' : 'Hunt mode off');
  }

  function toggleGlobalHunt() {
    globalHunt = !globalHunt;
    units.filter(u => u.team === 'player' && u.canHunt).forEach(u => {
      u.huntMode = globalHunt;
      u.manualOrder = !globalHunt;
    });
    showMessage(globalHunt ? 'All soldiers hunting!' : 'Hunt mode disabled');
  }

  function updateHuntPaths() {
    const manyUnits = units.length > 45;
    const crowded = units.length > 80;
    for (const u of units) {
      if (manyUnits && !isInView(u.x, u.y, 120, 0)) continue;
      if (u.team !== 'player' || !u.canHunt || !u.huntMode || u.garrisoned || u.wallGarrisoned ||
          hasPendingOutpostGarrison(u) || isMarchingToKeep(u) || isMarchingToWallSlot(u) ||
          u.retreatingToMed || u.healerFleeing || u.demoralized || u.hp <= 0 || u.pinned || u.attackAnimTimer > 0) continue;
      u.pathRecalc = (u.pathRecalc || 0) - 1;
      if (u.pathRecalc > 0) continue;
      u.pathRecalc = crowded ? 70 : manyUnits ? 58 : 50;
      const foe = findTacticalTarget(u);
      if (foe && isPursuableFoe(u, foe)) {
        u.structureTargetId = null;
        u.combatTargetId = foe.id;
        if (inAttackRange(u, foe)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        if (isFullySurrounded(foe, u.team) && !inAttackRange(u, foe)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        const foeMoved = u.pathTargetId !== foe.id ||
          Math.hypot(foe.x - (u.targetX ?? 0), foe.y - (u.targetY ?? 0)) > 30;
        if (!u.path?.length || foeMoved) setUnitPath(u, foe.x, foe.y, foe);
        continue;
      }

      const bld = findNearestAttackableEnemyBuilding(u);
      if (bld) {
        u.combatTargetId = null;
        u.structureTargetId = bld.id;
        if (inBuildingAttackRange(u, bld)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        const bldKey = `bld:${bld.id}`;
        const bldMoved = u.pathTargetId !== bldKey ||
          Math.hypot(bld.x - (u.targetX ?? 0), bld.y - (u.targetY ?? 0)) > 35;
        if (!u.path?.length || bldMoved) {
          setUnitPath(u, bld.x, bld.y);
          u.pathTargetId = bldKey;
        }
        continue;
      }

      if (u.pathTargetId || u.combatTargetId || u.structureTargetId) {
        releaseCombatPursuit(u, { keepManual: u.manualOrder });
        u.structureTargetId = null;
      }
    }
  }

  function updateStuckRecovery() {
    const crowded = units.length > 70;
    for (const u of units) {
      if (crowded && !isInView(u.x, u.y, 60, 0)) continue;
      if (u.hp <= 0 || u.garrisoned || u.wallGarrisoned || hasPendingOutpostGarrison(u) ||
          isMarchingToKeep(u) || isMarchingToWallSlot(u) || u.retreatingToMed ||
          u.siegeDeployed || (u.pinned && !(u.type === 'builder' && builderHasWork(u)))) continue;
      const moved = Math.hypot(u.x - (u.lastMoveX ?? u.x), u.y - (u.lastMoveY ?? u.y)) > 0.25;
      u.stillFrames = moved ? 0 : (u.stillFrames || 0) + 1;
      u.lastMoveX = u.x;
      u.lastMoveY = u.y;

      if (u.stillFrames < 18) continue;
      const needsMove = u.path?.length || u.huntMode || u.manualOrder || u.pathTargetId;
      if (!needsMove) continue;

      nudgeUnitFree(u);
      if (u.targetX != null && u.targetY != null) {
        const savedKey = u.pathTargetId;
        if (isBuildingPathTarget(savedKey)) {
          const bld = getBuildingPursuitTarget(u);
          if (bld) setUnitPath(u, bld.x, bld.y);
          else {
            releaseCombatPursuit(u, { keepManual: u.manualOrder });
            retargetIfHunting(u);
          }
        } else {
          const dest = savedKey && savedKey !== 'advance'
            ? getUnitById(savedKey)
            : null;
          if (dest && !isPursuableFoe(u, dest)) {
            releaseCombatPursuit(u, { keepManual: u.manualOrder });
            retargetIfHunting(u);
          } else if (dest) setUnitPath(u, u.targetX, u.targetY, dest);
          else {
            setUnitPath(u, u.targetX, u.targetY);
            if (savedKey === 'advance') u.pathTargetId = 'advance';
          }
        }
      }
      u.stillFrames = 0;
      u.pathStuck = 0;
    }
  }

  function spawnCastleCompound(cx, cy, builder) {
    const groupId = Math.random().toString(36).slice(2, 9);
    const parts = getCastleCompoundLayout(cx, cy).map(l => {
      const b = createBuilding(l.type, l.x, l.y, 'player', { facing: l.facing, castleGroup: groupId });
      buildings.push(b);
      return b;
    });
    invalidateObstacles();
    builder.building = {
      compound: true, parts, x: cx, y: cy,
      buildTime: BuildDefs.castle.buildTime, buildProgress: 0,
    };
    showMessage('Erecting castle compound (4 walls, 4 outposts, Keep, med tent, mess hall)...');
    return true;
  }

  function finalizeBuild(type, wx, wy, buildOpts = {}) {
    if (creativeMode && creativeSettings.instantBuild) {
      return creativeInstantPlaceBuilding(type, wx, wy);
    }
    const def = BuildDefs[type];
    const buildCost = creativeMode && creativeSettings.freeResources ? 0 : (def?.cost ?? 0);
    if (!def) {
      showMessage(`Unknown building: ${type}`);
      return false;
    }
    if (tactical < buildCost) {
      showMessage('Not enough TP!');
      return false;
    }
    if (def.requiresBuilders && countLiveBuilders(units) < def.requiresBuilders) {
      showMessage(`Need ${def.requiresBuilders} live Builders on the field!`);
      return false;
    }
    if (def.isWweAcademy) {
      if (!(creativeMode && creativeSettings.unlockAll) && !MetaProgress.isWweUnlocked()) {
        showMessage('Join the 316 Club (or Austin 3:16) to reveal the WWE Academy!');
        return false;
      }
      const recHamlets = def.recommendedHamlets ?? 2;
      const recGuilds = def.recommendedGuilds ?? 1;
      if (countPlayerHamlets() < recHamlets) {
        showMessage(`WWE Academy tip: ${recHamlets}+ hamlets recommended (you have ${countPlayerHamlets()}).`, 300);
      } else if (countPlayerGuilds() < recGuilds) {
        showMessage(`WWE Academy tip: ${recGuilds}+ merchant guilds recommended (you have ${countPlayerGuilds()}).`, 300);
      }
    }
    if (def.isCrossoverBarracks && !isVanillaAcademyType(type) && !(creativeMode && creativeSettings.unlockAll)) {
      if (!MetaProgress.isCrossoverFactionUnlocked(def.crossoverFaction)) {
        showMessage(`Enter cheat code to unlock ${def.name}!`);
        return false;
      }
      if (typeof FactionDepth !== 'undefined') {
        const chk = FactionDepth.canBuildBarracks(type, wave, buildings, units);
        if (!chk.ok) { showMessage(chk.msg, 300); return false; }
        if (chk.warn) showMessage(chk.warn, 280);
      }
    }
    if (def.isPerkMachine && !(creativeMode && creativeSettings.unlockAll) && !Perks.perkMachinesUnlocked()) {
      showMessage('Unlock WWE, Doomslayer, or a crossover cheat to build Perk-a-Cola machines!');
      return false;
    }
    const isAcademyBuild = def?.isAcademy && !def?.isCrossoverBarracks && !def?.isWweAcademy;
    if (isAcademyBuild && !(creativeMode && creativeSettings.unlockAll) && !canBuildAcademyType(type, wave, units)) {
      showMessage(getAcademyBuildBlockReason(type, wave, units) || 'Cannot build this academy right now.');
      return false;
    }
    const builder = units.find(u => u.team === 'player' && u.type === 'builder' && u.hp > 0);
    if (!builder) {
      showMessage('Deploy a Builder first!');
      return false;
    }
    if (countBuilderProjects(builder) >= BUILDER_MAX_PROJECTS) {
      showMessage(`Builder at max projects (${BUILDER_MAX_PROJECTS})!`);
      return false;
    }
    if (isBuildSiteBlocked(wx, wy, def)) { showMessage('Not enough space — settlements need wide ground!'); return false; }

    if (def.isFortressUpgrade) {
      const nearHamlet = buildings.some(b =>
        b.isHamlet && b.owner === 'player' && b.complete && b.hp > 0 &&
        Math.hypot(b.x - wx, b.y - wy) < (def.requiresHamletNearby || 80)
      );
      if (!nearHamlet) {
        showMessage('Fortress upgrade must be placed on a completed hamlet!');
        return false;
      }
    }

    if (def.settlementWarnBefore && wave < def.settlementWarnBefore) {
      showMessage(`Warning: ${def.name} is huge and siegeable — strongly recommended after wave ${def.settlementWarnBefore}!`, 340);
    }

    if (!(creativeMode && creativeSettings.freeResources)) tactical -= def.cost;
    selectedBuild = null;
    AudioEngine.SFX.deploy();

    if (type === 'castle') return spawnCastleCompound(wx, wy, builder);

    const wallFacing = type === 'wall' ? (buildOpts.facing || pendingWallFacing || 'north') : null;
    const b = createBuilding(type, wx, wy, 'player', wallFacing ? { facing: wallFacing } : {});
    buildings.push(b);
    invalidateObstacles();

    if (def.waveBuildTime) {
      showMessage(`Founding ${def.name} — completes in ${def.waveBuildTime} waves (${countLiveBuilders(units)} builders labor).`);
      return true;
    }

    if (!builder.building || builder.building.complete || builder.building.pending) {
      builder.building = b;
    } else if (!builder.buildQueue) {
      builder.buildQueue = [b];
    } else {
      builder.buildQueue.push(b);
    }
    showMessage(`Erecting ${def.name}...`);
    return true;
  }

  function placeBuilding(wx, wy) {
    const type = selectedBuild;
    if (!type) return false;
    const bdef = BuildDefs[type];
    if (!bdef) {
      showMessage(`Unknown building: ${type}`);
      return false;
    }
    const buildCost = creativeMode && creativeSettings.freeResources ? 0 : (bdef.cost ?? 0);
    if (tactical < buildCost) {
      showMessage('Not enough TP!');
      return false;
    }
    if (creativeMode && creativeSettings.instantBuild) {
      return finalizeBuild(type, wx, wy);
    }
    const builder = units.find(u => u.team === 'player' && u.type === 'builder' && u.hp > 0);
    if (!builder) { showMessage('Deploy a Builder first!'); return false; }
    if (bdef?.requiresBuilders && countLiveBuilders(units) < bdef.requiresBuilders) {
      showMessage(`Need ${bdef.requiresBuilders} live Builders!`);
      return false;
    }
    if (bdef?.isWweAcademy) {
      if (!MetaProgress.isWweUnlocked()) { showMessage('Join the 316 Club first!'); return false; }
      const recHamlets = bdef.recommendedHamlets ?? 2;
      const recGuilds = bdef.recommendedGuilds ?? 1;
      if (countPlayerHamlets() < recHamlets) {
        showMessage(`WWE Academy tip: ${recHamlets}+ hamlets recommended (you have ${countPlayerHamlets()}).`, 300);
      } else if (countPlayerGuilds() < recGuilds) {
        showMessage(`WWE Academy tip: ${recGuilds}+ merchant guilds recommended (you have ${countPlayerGuilds()}).`, 300);
      }
    }
    if (bdef?.isCrossoverBarracks && !isVanillaAcademyType(type)) {
      if (!MetaProgress.isCrossoverFactionUnlocked(bdef.crossoverFaction)) {
        showMessage(`Enter the ${bdef.crossoverFaction} cheat code first!`);
        return false;
      }
      if (typeof FactionDepth !== 'undefined') {
        const chk = FactionDepth.canBuildBarracks(type, wave, buildings, units);
        if (!chk.ok) { showMessage(chk.msg, 300); return false; }
        if (chk.warn) showMessage(chk.warn, 280);
      }
    }
    if (bdef?.isPerkMachine && !Perks.perkMachinesUnlocked()) {
      showMessage('Unlock a roster cheat to build Perk-a-Cola machines!');
      return false;
    }
    const isAcademyBuild = bdef?.isAcademy && !bdef?.isCrossoverBarracks && !bdef?.isWweAcademy;
    if (isAcademyBuild && !canBuildAcademyType(type, wave, units)) {
      showMessage(getAcademyBuildBlockReason(type, wave, units) || 'Cannot build this academy right now.');
      return false;
    }
    if (bdef?.settlementWarnBefore && wave < bdef.settlementWarnBefore) {
      showMessage(`Caution: build ${bdef.name} after wave ${bdef.settlementWarnBefore} unless you are confident!`, 300);
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
      if (type === 'wall') pending.facing = pendingWallFacing;
      if (!builder.building || builder.building.complete) builder.building = pending;
      else if (!builder.buildQueue) builder.buildQueue = [pending];
      else builder.buildQueue.push(pending);
      selectedBuild = null;
      return true;
    }
    return finalizeBuild(type, wx, wy, type === 'wall' ? { facing: pendingWallFacing } : {});
  }

  function handleClick(sx, sy, opts = {}) {
    if (state !== 'playing' || paused) return false;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    if (wx < 0 || wx > worldW || wy < 0 || wy > worldH + 40) return false;
    const pos = clampPos(wx, wy);

    if (creativeMode && creativeTool === 'spawn_enemy') {
      creativeSpawnEnemyAt(creativeSpawnType, pos.x, pos.y);
      return true;
    }
    if (creativeMode && creativeTool === 'spawn_enemy_building') {
      creativeSpawnEnemyBuildingAt(creativeSpawnType, pos.x, pos.y);
      return true;
    }
    if (creativeMode && creativeTool === 'spawn_player') {
      creativeSpawnPlayerAt(creativeSpawnType, pos.x, pos.y);
      return true;
    }
    if (creativeMode && creativeTool === 'spawn_player_building') {
      creativeSpawnPlayerBuildingAt(creativeSpawnType, pos.x, pos.y);
      return true;
    }
    if (creativeMode && creativeTool === 'spawn_squad') {
      creativeSpawnSquadAt(creativeSpawnType, pos.x, pos.y);
      return true;
    }

    if (selectedBuild) {
      placeBuilding(pos.x, pos.y);
      return true;
    }

    if (selectedDemolish) {
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target) {
        showMessage('Click one of your completed structures.');
        return false;
      }
      demolishBuilding(target);
      selectedDemolish = false;
      return true;
    }

    if (selectedMoveBuilding) {
      if (moveBuildingTarget) {
        if (relocateBuilding(moveBuildingTarget, pos.x, pos.y)) {
          moveBuildingTarget = null;
          selectedMoveBuilding = false;
        }
        return true;
      }
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target) {
        showMessage('Click a completed structure to move.');
        return false;
      }
      moveBuildingTarget = target;
      showMessage(`Moving ${BuildDefs[target.type]?.name || 'structure'} — click destination.`, 200);
      AudioEngine.SFX.click();
      return true;
    }

    if (selectedRotateWall) {
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target || target.type !== 'wall') {
        showMessage('Click one of your walls.');
        return false;
      }
      rotateWall(target);
      selectedRotateWall = false;
      return true;
    }

    if (selectedDeploy) {
      if (!canDeployUnitType(selectedDeploy)) {
        showMessage('Creative mode — troop deploy disabled in lab settings.');
        return false;
      }
      const def = getPlayerUnitDef(selectedDeploy);
      if (!def) return false;
      const costMult = getDeployCostMult();
      const deployCost = creativeMode && creativeSettings.freeResources ? 0 : Math.ceil(def.cost * costMult);
      if (tactical < deployCost) { showMessage('Not enough TP!'); return false; }
      if (selectedDeploy === 'general' && findPlayerGeneral()) {
        showMessage('You already have a General on the field!');
        return false;
      }
      if (selectedDeploy === 'doomslayer_hero') {
        if (!(creativeMode && creativeSettings.unlockAll) && !MetaProgress.isDoomslayerHeroUnlocked()) {
          showMessage('Survive to wave 200 on Doomslayer difficulty to unlock!');
          return false;
        }
        if (units.some(u => u.isDoomslayer && u.hp > 0)) {
          showMessage('The Doomslayer already walks the field!');
          return false;
        }
      }
      const u = spawnUnit(selectedDeploy, pos.x, pos.y, 'player');
      applyPlayerStatMods(u);
      if (typeof ContentExpansion !== 'undefined') ContentExpansion.applyLoadoutToUnit(u);
      u.targetY = rallyY;
      u.huntMode = globalHunt && u.canHunt;
      units.push(u);
      if (!(creativeMode && creativeSettings.freeResources)) tactical -= deployCost;
      AudioEngine.SFX.deploy();
      Particles.dust(pos.x, pos.y);
      ach('deploy', {
        unitType: selectedDeploy,
        armySize: units.filter(x => x.team === 'player' && x.hp > 0).length,
      });
      if (typeof Legacy !== 'undefined') Legacy.recordDeploy(selectedDeploy);
      selectedDeploy = null;
      return true;
    }

    if (selectedAbility) {
      const ab = Abilities[selectedAbility];
      const baseCost = ab?.cost ?? 99;
      const abCost = creativeMode && creativeSettings.freeResources ? 0
        : (typeof ContentExpansion !== 'undefined' && ContentExpansion.getAbilityCost
          ? ContentExpansion.getAbilityCost(selectedAbility, baseCost, wave)
          : baseCost);
      if (tactical < abCost) { showMessage('Not enough TP!'); return false; }

      if (!(creativeMode && creativeSettings.freeResources)) tactical -= abCost;
      useAbility(selectedAbility, pos.x, pos.y);
      selectedAbility = null;
      return true;
    }

    const clickedBuilding = findBuildingAt(pos.x, pos.y);
    if (clickedBuilding?.isWweAcademy && MetaProgress.isWweUnlocked()) {
      WweAcademy.togglePanel();
      AudioEngine.SFX.click();
      return true;
    }
    if (clickedBuilding?.isCrossoverBarracks && isCrossoverBarracksType(clickedBuilding.type)) {
      CrossoverHub.togglePanel(clickedBuilding.crossoverFaction);
      AudioEngine.SFX.click();
      return true;
    }

    const clicked = getUnitAt(pos.x, pos.y);
    if (clicked) {
      if (clicked.team === 'player') {
        if (opts.toggleSelection) {
          if (!selectedUnitIds.length && selectedUnitId) selectedUnitIds = [selectedUnitId];
          if (selectedUnitIds.includes(clicked.id)) {
            selectedUnitIds = selectedUnitIds.filter(id => id !== clicked.id);
            selectedUnitId = selectedUnitIds.length ? selectedUnitIds[selectedUnitIds.length - 1] : null;
          } else {
            selectedUnitIds.push(clicked.id);
            selectedUnitId = clicked.id;
          }
        } else if (opts.selectSameType) {
          selectedUnitIds = units
            .filter(u => u.team === 'player' && u.hp > 0 && u.type === clicked.type)
            .map(u => u.id);
          selectedUnitId = clicked.id;
          if (selectedUnitIds.length > 1) {
            showMessage(`${selectedUnitIds.length} ${clicked.type.replace(/_/g, ' ')}(s) selected.`, 120);
          }
        } else {
          selectedUnitId = clicked.id;
          selectedUnitIds = [clicked.id];
        }
      } else {
        selectedUnitId = clicked.id;
        selectedUnitIds = [];
      }
      if (creativeMode) creativeFillStatEditorFromSelection();
      AudioEngine.SFX.click();
      return true;
    }

    const moveIds = selectedUnitIds.length ? selectedUnitIds
      : (selectedUnitId ? [selectedUnitId] : []);
    if (moveIds.length) {
      moveIds.forEach((id, i) => {
        const unit = units.find(u => u.id === id);
        if (unit?.hp > 0) {
          const ox = moveIds.length > 1 ? (i % 3) * 14 - 14 : 0;
          const oy = moveIds.length > 1 ? Math.floor(i / 3) * 12 : 0;
          orderMove(unit, pos.x + ox, pos.y + oy, true);
        }
      });
      return true;
    }
    return false;
  }

  function useAbility(ability, wx, wy) {
    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.useAbility(ability, wx, wy)) {
      ach('ability', { ability });
      return;
    }
    const ab = Abilities[ability];
    ach('ability', { ability });
    if (ability === 'fireball') {
      AudioEngine.SFX.fireball();
      StrikeFX?.play?.('fireball', wx, wy, ab.radius);
      Particles.explosion(wx, wy);
      damageInRadius(wx, wy, ab.radius, ab.damage, 'player');
    } else if (ability === 'lightning') {
      AudioEngine.SFX.lightning();
      StrikeFX?.play?.('lightning', wx, wy, ab.radius);
      Particles.lightning(wx, wy);
      damageInRadius(wx, wy, ab.radius, ab.damage, 'player');
    } else if (ability === 'heal') {
      AudioEngine.SFX.heal();
      StrikeFX?.play?.('heal', wx, wy, ab.radius);
      units.filter(u => u.team === 'player' && Math.hypot(u.x - wx, u.y - wy) < ab.radius)
        .forEach(u => {
          const healed = Math.min(ab.healAmount, u.maxHp - u.hp);
          u.hp = Math.min(u.maxHp, u.hp + ab.healAmount);
          Particles.heal(u.x, u.y);
          CombatFX?.healPulse(u.x, u.y);
          if (healed > 0) FloatingText.heal(u.x, u.y, healed);
        });
    } else if (ability === 'reinforce') {
      if (typeof GameModes !== 'undefined' && GameModes.getSession()?.noReinforceStrike) {
        showMessage('Challenge rule: Reinforcements strike disabled!');
        return;
      }
      AudioEngine.SFX.reinforce();
      StrikeFX?.play?.('reinforce', wx, wy, 40);
      (ab.units || ['footman', 'footman', 'archer']).forEach((t, i) => {
        const u = spawnUnit(t, 80 + i * 50, deployY, 'player');
        u.targetY = rallyY;
        u.huntMode = globalHunt && u.canHunt;
        units.push(u);
      });
    } else if (ability === 'rally') {
      rallyTimer = ab.duration;
      AudioEngine.SFX.reinforce();
      StrikeFX?.play?.('rally', wx, wy, 120);
      units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
        u.morale = Math.min(u.maxMorale, u.morale + ab.moraleBoost);
        u.rallyTimer = ab.duration;
        u.fleeing = false;
        u.demoralized = false;
        u.witnessDeaths = 0;
        if (u.canHunt) u.huntMode = globalHunt;
        FloatingText.status(u.x, u.y, 'RALLY!', '#f0c040');
      });
      showMessage('Battle Rally! All troops inspired!');
    }
  }

  function lineOfSight(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / 24);
    if (steps <= 1) return true;
    const losObs = getLosObstacles();
    if (!losObs.length) return true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps, sx = x1 + (x2 - x1) * t, sy = y1 + (y2 - y1) * t;
      for (const d of losObs) {
        if (Math.hypot(sx - d.x, sy - d.y) < (d.radius || 14) * 0.85) return false;
      }
    }
    return true;
  }

  function getCoverAt(x, y) {
    let cover = 0;
    for (const o of allObstacles()) {
      if (Math.hypot(x - o.x, y - o.y) < (o.radius || 14)) cover = Math.max(cover, o.cover || 0);
    }
    return cover;
  }

  function isBehindWall(unit, wall) {
    const margin = 10;
    const span = wall.radius + 6;
    switch (wall.facing || 'north') {
      case 'north': return unit.y > wall.y + margin && Math.abs(unit.x - wall.x) < span;
      case 'south': return unit.y < wall.y - margin && Math.abs(unit.x - wall.x) < span;
      case 'east':  return unit.x < wall.x - margin && Math.abs(unit.y - wall.y) < span;
      case 'west':  return unit.x > wall.x + margin && Math.abs(unit.y - wall.y) < span;
      default: return false;
    }
  }

  function getWallProtection(unit) {
    if (unit.team !== 'player' || unit.hp <= 0) return 0;
    let best = 0;
    for (const b of buildings) {
      if (b.hp <= 0 || !b.complete || b.type !== 'wall' || !b.wallProtection) continue;
      if (isBehindWall(unit, b)) best = Math.max(best, b.wallProtection);
    }
    return best;
  }

  function countPlayerWalls() {
    return buildings.filter(b => b.hp > 0 && b.complete && b.type === 'wall').length;
  }

  function isSiegeWave() {
    return !!currentHordeWave?.hasSiege;
  }

  function isHordeWave() {
    return !!currentHordeWave;
  }

  function onBuildingComplete(b, opts = {}) {
    if (b.type === 'wall' && firstWallWave === null) firstWallWave = wave;
    if (b.type === 'outpost') {
      b.slotX = b.x;
      b.slotY = b.y - 14;
    }
    if (b.isKeep) {
      const slot = getKeepGeneralSlot(b);
      b.slotX = slot.x;
      b.slotY = slot.y;
    }
    if (b.isWweAcademy) {
      showMessage('WWE Academy complete! Click it to recruit Superstars.', 320);
      FloatingText.status(b.x, b.y - 20, 'WWE', '#c04040');
    }
    if (b.isCrossoverBarracks && isCrossoverBarracksType(b.type)) {
      if (typeof FactionDepth !== 'undefined') FactionDepth.onBarracksComplete(b);
      else {
        showMessage(`${BuildDefs[b.type]?.name} ready — click to recruit crossover operatives!`, 300);
        FloatingText.status(b.x, b.y - 20, 'CROSSOVER', '#60a0c0');
      }
    }
    if (b.isPerkMachine) {
      showMessage(`${BuildDefs[b.type]?.name} installed — heroes collect matching perks at night.`, 260);
    }
    if (typeof ContentExpansion !== 'undefined') ContentExpansion.onBuildingComplete(b);
    ach('building_complete', {
      buildType: b.type,
      wallCount: countPlayerWalls(),
      compound: !!opts.compound,
    });
  }

  const OUTPOST_GARRISON_ENTER_DIST = 20;
  const OUTPOST_GARRISON_FORCE_DIST = 32;
  const OUTPOST_GARRISON_STUCK_SNAP_TICKS = 90;
  const OUTPOST_GARRISON_STUCK_RELEASE_TICKS = 240;

  function releaseFromGarrison(unit) {
    const op = buildings.find(b => b.id === unit.garrisoned || b.garrisonUnitId === unit.id);
    if (op?.garrisonUnitId === unit.id) op.garrisonUnitId = null;
    unit.garrisoned = null;
    unit.garrisonMarchRecalc = 0;
    unit.garrisonStuckTicks = 0;
    unit.range = unit.baseRange ?? unit.range;
    if (unit.canHunt) unit.huntMode = globalHunt;
  }

  function getPendingOutpost(unit) {
    if (!unit || unit.garrisoned) return null;
    return buildings.find(b => b.type === 'outpost' && b.complete && b.garrisonUnitId === unit.id) || null;
  }

  function hasPendingOutpostGarrison(unit) {
    return !!getPendingOutpost(unit);
  }

  function getOutpostGarrisonSlot(op, unit) {
    const baseX = op.slotX ?? op.x;
    const baseY = op.slotY ?? op.y - 14;
    const stub = unit || { team: 'player', combatType: 'ranged' };
    const offsets = [
      [0, 0], [0, 10], [0, 14], [-12, 6], [12, 6], [-8, 12], [8, 12], [0, -6],
    ];
    for (const [ox, oy] of offsets) {
      const pos = clampPos(baseX + ox, baseY + oy);
      if (!isTerrainBlocked(pos.x, pos.y, stub) && !isBlocked(pos.x, pos.y, stub, 2)) return pos;
    }
    return clampPos(baseX, baseY);
  }

  function outpostMarchDist(unit, op) {
    const slot = getOutpostGarrisonSlot(op, unit);
    return Math.hypot(unit.x - slot.x, unit.y - slot.y);
  }

  function completeOutpostGarrison(gu, op, slot) {
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
      ach('garrison', { count: units.filter(x => x.garrisoned).length + 1 });
    }
    gu.garrisoned = op.id;
    gu.range = getEffectiveRange(gu);
    gu.rotation = -90;
    if (gu.attackAnimTimer <= 0) gu.animState = 'idle';
  }

  function clearSiegeLink(unit) {
    if (!unit.linkedWallId) return;
    const wall = buildings.find(b => b.id === unit.linkedWallId);
    if (wall?.siegeTowerId === unit.id) wall.siegeTowerId = null;
    unit.siegeDeployed = false;
    unit.linkedWallId = null;
  }

  function findNearestPlayerWall(from) {
    let best = null, bestD = Infinity;
    for (const b of buildings) {
      if (!b.complete || b.type !== 'wall' || b.siegeTowerId) continue;
      const d = Math.hypot(b.x - from.x, b.y - from.y);
      if (d < bestD) { bestD = d; best = b; }
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
    AudioEngine.SFX.waveStart();
  }

  function isRangedGarrisonCandidate(u) {
    return u.team === 'player' && u.hp > 0 && u.combatType === 'ranged' &&
      !u.garrisoned && !u.manualOrder && !u.fleeing && !u.pinned;
  }

  function isMarchingToOutpost(unit) {
    const op = getPendingOutpost(unit);
    if (!op) return false;
    return outpostMarchDist(unit, op) > OUTPOST_GARRISON_ENTER_DIST;
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
    setUnitPath(unit, slot.x, slot.y);
  }

  function updateOutposts() {
    for (const op of buildings) {
      if (!op.complete || op.type !== 'outpost') continue;

      if (op.garrisonUnitId) {
        const gu = units.find(u => u.id === op.garrisonUnitId && u.hp > 0);
        if (!gu) { op.garrisonUnitId = null; continue; }

        if (gu.manualOrder) {
          releaseFromGarrison(gu);
          continue;
        }

        if (gu.garrisoned && gu.garrisoned !== op.id) {
          op.garrisonUnitId = null;
          continue;
        }

        const slot = getOutpostGarrisonSlot(op, gu);
        const dist = Math.hypot(gu.x - slot.x, gu.y - slot.y);
        if (dist > OUTPOST_GARRISON_ENTER_DIST) {
          gu.garrisonStuckTicks = (gu.garrisonStuckTicks || 0) + 1;
          gu.huntMode = false;
          gu.garrisonMarchRecalc = (gu.garrisonMarchRecalc || 0) - 1;
          const destMoved = Math.hypot((gu.targetX ?? 0) - slot.x, (gu.targetY ?? 0) - slot.y) > 6;
          if (!gu.path?.length || gu.garrisonMarchRecalc <= 0 || destMoved) {
            gu.garrisonMarchRecalc = 30;
            setUnitPath(gu, slot.x, slot.y);
          }
          if (gu.garrisonStuckTicks > OUTPOST_GARRISON_STUCK_SNAP_TICKS && dist < OUTPOST_GARRISON_FORCE_DIST) {
            completeOutpostGarrison(gu, op, slot);
          } else if (gu.garrisonStuckTicks > OUTPOST_GARRISON_STUCK_RELEASE_TICKS) {
            op.garrisonUnitId = null;
            gu.garrisonStuckTicks = 0;
            gu.garrisonMarchRecalc = 0;
            if (gu.canHunt) gu.huntMode = globalHunt;
          }
        } else {
          completeOutpostGarrison(gu, op, slot);
        }
        continue;
      }

      let best = null, bestD = Infinity;
      for (const u of units) {
        if (!isRangedGarrisonCandidate(u)) continue;
        if (buildings.some(b => b.garrisonUnitId === u.id)) continue;
        const d = Math.hypot(u.x - op.x, u.y - op.y);
        if (d < 320 && d < bestD) { bestD = d; best = u; }
      }
      if (best) assignToOutpost(best, op);
    }
  }

  function releaseFromKeep(unit) {
    const keep = buildings.find(b => b.id === unit.stationedKeep || b.generalUnitId === unit.id);
    if (keep?.generalUnitId === unit.id) keep.generalUnitId = null;
    unit.stationedKeep = null;
    unit.keepMarchRecalc = 0;
    if (unit.canHunt) unit.huntMode = globalHunt;
  }

  function isGeneralCandidate(u) {
    return u.team === 'player' && u.hp > 0 && u.isGeneral &&
      !u.stationedKeep && !u.manualOrder && !u.fleeing && !u.pinned && !u.rallyTargetId;
  }

  function isMarchingToKeep(unit) {
    return buildings.some(b => b.generalUnitId === unit.id && !unit.stationedKeep);
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
    for (const keep of buildings) {
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
        const gu = units.find(u => u.id === keep.generalUnitId && u.hp > 0);
        if (!gu) { keep.generalUnitId = null; continue; }
        if (gu.rallyTargetId) continue;

        if (gu.manualOrder) {
          if (gu.stationedKeep === keep.id) releaseFromKeep(gu);
          keep.generalUnitId = null;
          continue;
        }

        const dist = Math.hypot(gu.x - slotX, gu.y - slotY);
        if (dist > 8) {
          gu.huntMode = false;
          gu.keepMarchRecalc = (gu.keepMarchRecalc || 0) - 1;
          const destMoved = Math.hypot((gu.targetX ?? 0) - slotX, (gu.targetY ?? 0) - slotY) > 4;
          if (!gu.path?.length || gu.keepMarchRecalc <= 0 || destMoved) {
            gu.keepMarchRecalc = 30;
            setUnitPath(gu, slotX, slotY);
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

      let best = null, bestD = Infinity;
      for (const u of units) {
        if (!isGeneralCandidate(u)) continue;
        if (buildings.some(b => b.generalUnitId === u.id)) continue;
        const d = Math.hypot(u.x - keep.x, u.y - keep.y);
        if (d < 400 && d < bestD) { bestD = d; best = u; }
      }
      if (best) assignToKeep(best, keep);
    }
  }

  function getStationedCastleGroup() {
    const gen = getStationedGeneral();
    if (!gen?.stationedKeep) return null;
    const keep = buildings.find(b => b.id === gen.stationedKeep);
    return keep?.castleGroup || null;
  }

  function isInsideCastleBounds(unit, groupId) {
    const parts = buildings.filter(b => b.castleGroup === groupId && b.complete);
    if (!parts.length) return false;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of parts) {
      const r = p.radius || 20;
      minX = Math.min(minX, p.x - r);
      maxX = Math.max(maxX, p.x + r);
      minY = Math.min(minY, p.y - r);
      maxY = Math.max(maxY, p.y + r);
    }
    const pad = 8;
    return unit.x >= minX - pad && unit.x <= maxX + pad &&
      unit.y >= minY - pad && unit.y <= maxY + pad;
  }

  function releaseFromWallGarrison(unit) {
    for (const wall of buildings) {
      if (!wall.wallSlots) continue;
      for (const slot of wall.wallSlots) {
        if (slot.unitId === unit.id) slot.unitId = null;
      }
    }
    unit.wallGarrisoned = null;
    unit.wallSlotIndex = null;
    if (unit.canHunt) unit.huntMode = globalHunt;
  }

  function isMarchingToWallSlot(unit) {
    if (unit.wallGarrisoned) return false;
    for (const wall of buildings) {
      if (!wall.wallSlots) continue;
      for (const slot of wall.wallSlots) {
        if (slot.unitId === unit.id) return true;
      }
    }
    return false;
  }

  function wallFacingRotation(facing) {
    switch (facing) {
      case 'north': return -90;
      case 'south': return 90;
      case 'east': return 0;
      case 'west': return 180;
      default: return -90;
    }
  }

  function isFootmanWallCandidate(u) {
    return u.team === 'player' && u.hp > 0 && u.type === 'footman' &&
      !u.garrisoned && !u.stationedKeep && !u.manualOrder && !u.fleeing &&
      !u.demoralized && !u.pinned && !u.retreatingToMed && !u.fightToDeath;
  }

  function updateWallGarrison() {
    const groupId = getStationedCastleGroup();
    if (!groupId) {
      for (const u of units) {
        if (u.wallGarrisoned || isMarchingToWallSlot(u)) releaseFromWallGarrison(u);
      }
      return;
    }

    for (const wall of buildings) {
      if (!wall.complete || wall.type !== 'wall' || wall.castleGroup !== groupId) continue;
      if (!wall.wallSlots) {
        wall.wallSlots = getWallSlotPositions(wall.facing, wall.x, wall.y);
      }

      for (let si = 0; si < wall.wallSlots.length; si++) {
        const slot = wall.wallSlots[si];

        if (slot.unitId) {
          const fu = units.find(u => u.id === slot.unitId && u.hp > 0);
          if (!fu) { slot.unitId = null; continue; }

          if (fu.manualOrder || fu.retreatingToMed) {
            releaseFromWallGarrison(fu);
            slot.unitId = null;
            continue;
          }

          const dist = Math.hypot(fu.x - slot.slotX, fu.y - slot.slotY);
          if (dist > 6) {
            fu.huntMode = false;
            const destMoved = Math.hypot((fu.targetX ?? 0) - slot.slotX, (fu.targetY ?? 0) - slot.slotY) > 4;
            fu.pathRecalc = (fu.pathRecalc || 0) - 1;
          if (!fu.path?.length || destMoved || fu.pathRecalc <= 0) {
            fu.pathRecalc = 18;
            setUnitPath(fu, slot.slotX, slot.slotY);
          }
          } else {
            fu.x = slot.slotX;
            fu.y = slot.slotY;
            fu.path = [];
            fu.pathIndex = 0;
            fu.huntMode = false;
            fu.wallGarrisoned = wall.id;
            fu.wallSlotIndex = si;
            fu.rotation = wallFacingRotation(wall.facing);
            if (fu.attackAnimTimer <= 0) fu.animState = 'idle';
          }
          continue;
        }

        let best = null, bestD = Infinity;
        for (const u of units) {
          if (!isFootmanWallCandidate(u)) continue;
          if (u.wallGarrisoned || isMarchingToWallSlot(u)) continue;
          if (wall.wallSlots.some(s => s.unitId === u.id)) continue;
          if (!isInsideCastleBounds(u, groupId)) continue;
          const d = Math.hypot(u.x - slot.slotX, u.y - slot.slotY);
          if (d < bestD) { bestD = d; best = u; }
        }
        if (best) {
          slot.unitId = best.id;
          best.huntMode = false;
          best.manualOrder = false;
          best.combatTargetId = null;
          setUnitPath(best, slot.slotX, slot.slotY);
        }
      }
    }
  }

  function findNearestMedicalTent(unit) {
    let best = null, bestD = Infinity;
    for (const b of buildings) {
      if (!b.complete || !b.isMedical || b.hp <= 0) continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function updateMedicalRetreats() {
    for (const unit of units) {
      if (unit.team !== 'player' || unit.hp <= 0) continue;

      if (unit.retreatingToMed) {
        const tent = buildings.find(b => b.id === unit.retreatingToMed && b.complete && b.hp > 0);
        if (!tent) {
          unit.retreatingToMed = null;
          unit.atMedicalTent = null;
          unit.fightToDeath = true;
          continue;
        }
        const tx = tent.slotX ?? tent.x;
        const ty = tent.slotY ?? tent.y - 8;
        const dist = Math.hypot(unit.x - tx, unit.y - ty);
        if (dist > 10) {
          unit.huntMode = false;
          const destMoved = Math.hypot((unit.targetX ?? 0) - tx, (unit.targetY ?? 0) - ty) > 4;
          if (!unit.path?.length || destMoved) setUnitPath(unit, tx, ty);
          continue;
        }
        unit.x = tx;
        unit.y = ty;
        unit.path = [];
        unit.pathIndex = 0;
        unit.atMedicalTent = tent.id;
      }

      if (!unit.atMedicalTent) continue;
      const tent = buildings.find(b => b.id === unit.atMedicalTent && b.complete && b.hp > 0);
      if (!tent) {
        unit.atMedicalTent = null;
        unit.retreatingToMed = null;
        continue;
      }
      const healAmt = unit.maxHp * (tent.healRate || 0.14) * 0.04;
      if (healAmt > 0.3 && unit.hp < unit.maxHp) {
        const applied = Math.min(healAmt, unit.maxHp - unit.hp);
        unit.hp += applied;
        if (unit.frame === 0) {
          FloatingText.heal(unit.x, unit.y, Math.max(1, Math.round(applied)));
          Particles.heal(unit.x, unit.y);
        }
      }
      if (unit.hp / unit.maxHp >= 0.72) {
        unit.retreatingToMed = null;
        unit.atMedicalTent = null;
        unit.fightToDeath = false;
        if (unit.canHunt) unit.huntMode = globalHunt;
        FloatingText.status(unit.x, unit.y, 'READY', '#80e080');
      }
    }
  }

  function isSiegeableStructure(b) {
    return b.owner === 'player' && b.complete && b.hp > 0 &&
      (b.type === 'wall' || b.isHamlet || b.isMerchantGuild);
  }

  function isAttackableEnemyStructure(b) {
    return !!b && b.owner === 'enemy' && b.hp > 0 &&
      (b.isEnemySettlement || b.isHamlet || b.isMerchantGuild);
  }

  function findNearestAttackableEnemyBuilding(unit, maxDist = 520) {
    let best = null;
    let bestScore = Infinity;
    for (const b of buildings) {
      if (!isAttackableEnemyStructure(b)) continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      if (d > maxDist) continue;
      let score = d;
      if (b.isHamlet) score -= 100;
      if (b.isMerchantGuild) score -= 80;
      if (!b.complete) score -= 50;
      if (unit.type === 'sapper' || (unit.siegeMult || 1) >= 2) score -= 70;
      if (unit.type === 'ballista') score -= 40;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  function inBuildingAttackRange(unit, b) {
    const dist = Math.hypot(b.x - unit.x, b.y - unit.y);
    const pad = (b.radius || 40) + 6;
    if (unit.combatType === 'ranged' || unit.projectile) {
      return dist <= Math.max(unit.meleeRange + pad, getEffectiveRange(unit) * 0.92);
    }
    return dist <= unit.meleeRange + pad;
  }

  function calcBuildingDamage(unit, b) {
    const siege = unit.type === 'sapper' || (unit.siegeMult || 1) >= 2;
    let dmg = siege
      ? Math.floor(unit.damage * (unit.siegeMult || 2.5))
      : Math.max(8, Math.floor(unit.damage * 0.42));
    if (unit.combatType === 'ranged' || unit.projectile) dmg = Math.floor(dmg * 0.88);
    if (unit.type === 'ballista') dmg = Math.floor(dmg * 1.35);
    if (b.isHamlet) dmg = Math.floor(dmg * 1.08);
    if (b.isMerchantGuild) dmg = Math.floor(dmg * 1.05);
    return Math.max(6, dmg + Math.floor(Math.random() * 5));
  }

  function isBuildingPathTarget(id) {
    return typeof id === 'string' && id.startsWith('bld:');
  }

  function getBuildingPursuitTarget(unit) {
    const raw = unit.structureTargetId || (isBuildingPathTarget(unit.pathTargetId) ? unit.pathTargetId.slice(4) : null);
    if (!raw) return null;
    const b = buildings.find(x => x.id === raw);
    return isAttackableEnemyStructure(b) ? b : null;
  }

  function updatePlayerStructureAttack(unit) {
    if (unit.team !== 'player' || unit.hp <= 0) return;
    if (unit.combatType === 'builder' || unit.combatType === 'courier' || unit.combatType === 'healer') return;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) return;
    if (unit.retreatingToMed || unit.atMedicalTent || unit.pinned || unit.manualOrder) return;
    if (unit.attackAnimTimer > 0) return;

    if (findNearestFoeInRange(unit)) {
      unit.structureTargetId = null;
      return;
    }

    let target = getBuildingPursuitTarget(unit);
    const seekDist = unit.huntMode ? 500 : maxAttackRange(unit) + 80;
    if (!target) target = findNearestAttackableEnemyBuilding(unit, seekDist);
    if (!target || !inBuildingAttackRange(unit, target)) return;

    unit.structureTargetId = target.id;
    unit.path = [];
    unit.pathIndex = 0;
    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;

    const siege = unit.type === 'sapper' || (unit.siegeMult || 1) >= 2;
    unit.actionTimer = siege ? 42 : unit.combatType === 'ranged' ? 52 : 58;
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    unit.rotation = Math.round(Math.atan2(target.y - unit.y, target.x - unit.x) * 180 / Math.PI);
    const dmg = calcBuildingDamage(unit, target);
    damageBuilding(target, dmg);
    if (unit.type === 'sapper') FloatingText.status(target.x, target.y, 'SIEGE!', '#ff8040');
    AudioEngine.SFX.swordHit();
  }

  function updateEnemySiege(unit) {
    if (unit.hp <= 0 || unit.pinned || unit.attackAnimTimer > 0) return;
    const isSapper = unit.type === 'goblin_sapper';
    const isTower = unit.type === 'siege_tower' && unit.siegeDeployed;
    if (!isSapper && !isTower) return;

    let best = null, bestD = Infinity;
    const reach = isTower ? 52 : 36;
    for (const b of buildings) {
      if (!isSiegeableStructure(b)) continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      let score = d;
      if (b.isHamlet) score -= 40;
      if (b.isMerchantGuild) score -= 25;
      if (score < reach && score < bestD) { bestD = score; best = b; }
    }
    if (!best) return;

    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;
    unit.actionTimer = isTower ? 70 : 55;
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    const dmg = isTower ? 18 : best.isHamlet ? 32 : best.isMerchantGuild ? 26 : 28;
    damageBuilding(best, dmg);
    AudioEngine.SFX.swordHit();
  }

  function updateEnemyWallAttack(unit) {
    if (unit.hp <= 0 || unit.pinned || unit.attackAnimTimer > 0) return;
    if (unit.type === 'goblin_sapper' || unit.type === 'siege_tower' || unit.type === 'iron_colossus'
      || unit.type === 'boss_karg' || unit.type === 'boss_volk') return;
    if (unit.combatType === 'healer' || unit.combatType === 'builder') return;

    const general = findPlayerGeneral();
    if (general && inAttackRange(unit, general)) return;

    let best = null, bestD = Infinity;
    for (const b of buildings) {
      if (!isSiegeableStructure(b)) continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      const reach = b.isHamlet || b.isMerchantGuild ? 40 : 34;
      if (d < reach && d < bestD) { bestD = d; best = b; }
    }
    if (!best) return;

    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;
    unit.actionTimer = unit.type === 'troll' ? 50 : 65;
    unit.animState = 'attack';
    unit.attackAnimTimer = 12;
    let dmg = unit.type === 'troll' ? 22 : unit.type === 'berserker' ? 18 : 12;
    if (best.isHamlet) dmg = Math.floor(dmg * 1.4);
    if (best.isMerchantGuild) dmg = Math.floor(dmg * 1.2);
    damageBuilding(best, dmg);
    AudioEngine.SFX.swordHit();
  }

  function updateSiegeTower(unit) {
    if (unit.type !== 'siege_tower' || unit.hp <= 0) return false;

    if (unit.siegeDeployed) {
      unit.animState = 'idle';
      const wall = buildings.find(b => b.id === unit.linkedWallId && b.hp > 0);
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
    const foes = useSpatialQueries()
      ? Spatial.queryRadius(unit.x, unit.y, maxR, e => e.kind === 'unit' && e.ref?.team !== unit.team && e.ref?.hp > 0 && !e.ref?.fleeing).map(e => e)
      : units;
    for (const f of foes) {
      if (f.team === unit.team || !isValidCombatFoe(f)) continue;
      if (typeof ContentExpansion !== 'undefined' && !ContentExpansion.canTargetUnit(unit, f)) continue;
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
    const tactical = findTacticalTarget(unit);
    if (tactical) unit.structureTargetId = null;
    return tactical;
  }

  function takeDamage(unit, amount, opts = {}) {
    if (unit.isDoomslayer && unit.team === 'player') amount *= 0.08;
    if (unit.isGeneral && (unit.w2wBuffTimer || 0) > 0) amount *= 0.42;
    if (unit.isWwe && unit.wweAbility === '619' && Math.random() < 0.35) {
      FloatingText.status(unit.x, unit.y, 'DODGE', '#80c0ff');
      return 0;
    }
    if (unit.isWwe && unit.wweAbility === 'attitude' && unit.hp / unit.maxHp < 0.5) amount *= 0.55;
    let mitigation = 1 - getCoverAt(unit.x, unit.y) - getWallProtection(unit);
    if (unit.type === 'knight') mitigation -= 0.22;
    if (unit.team === 'player' && !unit.isGeneral && isInGeneralAura(unit)) {
      mitigation -= getGeneralAura().mitigation;
    }
    if (lastStandActive && unit.team === 'player') {
      mitigation -= GameDepth?.lastStandMitBonus(true) || 0.22;
    }
    if (unit.rallyTimer > 0) mitigation -= 0.1;
    if (isEliteEnemy(unit) && unit.team === 'enemy') mitigation -= 0.08;
    const actual = amount * Math.max(0.12, mitigation);
    unit.hp -= actual;
    const crit = opts.crit || amount >= 45;
    FloatingText.damage(unit.x, unit.y, actual, crit);
    Particles.blood(unit.x, unit.y);
    CombatFX.hitSpark(unit.x, unit.y);
    const nonCombat = unit.combatType === 'builder' || unit.combatType === 'courier' || unit.combatType === 'healer';
    if (!nonCombat && Math.random() * 100 > unit.morale + (unit.rallyTimer > 0 ? 15 : 0)) {
      unit.pinned = true;
      unit.pinTimer = 50;
    }
    if (unit.hp <= 0) {
      unit.hp = 0;
      let quickRevived = false;
      AudioEngine.SFX.death();
      if (unit.team === 'enemy') {
        kills++;
        const killer = units.find(u => u.combatTargetId === unit.id && u.team === 'player' && u.hp > 0);
        if (killer) {
          killer.experience = (killer.experience || 0) + 2;
          if (typeof Legacy !== 'undefined') Legacy.recordKill(killer.type, unit.type);
          notifyVetStarEvent(killer, addVetStar(killer));
          if (killer.hasVultureAid && Math.random() < 0.35) {
            tactical += 1;
            FloatingText.status(killer.x, killer.y, '+1 TP', '#c0ffa0');
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
      }
      if (unit.team === 'player') {
        if (unit.isGeneral) {
          releaseFromKeep(unit);
          showMessage('The General has fallen! Command aura lost.', 300);
        } else if (!unit.isDoomslayer && typeof Perks !== 'undefined' && Perks.handleQuickRevive(unit)) {
          quickRevived = true;
          const def = getPlayerUnitDef(unit.type);
          showMessage(`${def?.name || unit.type} revived with Quick Revive!`, 180);
        } else if (!unit.isDoomslayer && unit.type !== 'builder' && unit.type !== 'courier') {
          fallenPool.push({ type: unit.type, x: unit.x, y: unit.y });
        }
      }
      if (!quickRevived) {
        if (typeof VisualPolish !== 'undefined') VisualPolish.registerDeath(unit);
        applyWitnessDeath(unit);
      }
    } else if (unit.team === 'player' && unit.hp > 0 && !unit.retreatingToMed && !unit.fightToDeath &&
        unit.type !== 'builder' && unit.type !== 'courier' &&
        !unit.isGeneral && !unit.isDoomslayer) {
      const ratio = unit.hp / unit.maxHp;
      if (ratio < RETREAT_HP_RATIO) {
        const tent = findNearestMedicalTent(unit);
        if (tent) {
          releaseFromWallGarrison(unit);
          releaseFromGarrison(unit);
          unit.retreatingToMed = tent.id;
          unit.huntMode = false;
          unit.manualOrder = false;
          unit.combatTargetId = null;
          unit.pathTargetId = null;
          const tx = tent.slotX ?? tent.x;
          const ty = tent.slotY ?? tent.y - 8;
          setUnitPath(unit, tx, ty);
          FloatingText.status(unit.x, unit.y, 'RETREAT', '#60c0ff');
        } else {
          unit.fightToDeath = true;
        }
      }
    } else if (unit.hp < unit.maxHp * 0.25 && isMoraleCombatUnit(unit) && unit.rallyTimer <= 0 && !unit.fightToDeath) {
      unit.morale -= 2;
      if (unit.morale <= moraleBreakThreshold(unit)) triggerMoraleBreak(unit, 'wounded');
    }
    return actual;
  }

  function damageInRadius(x, y, radius, damage, team) {
    for (const u of units) {
      if (u.team === team || u.hp <= 0) continue;
      if (Math.hypot(u.x - x, u.y - y) < radius) takeDamage(u, damage * (1 - Math.hypot(u.x - x, u.y - y) / radius * 0.5));
    }
  }

  function doomslayerDamage(target) {
    if (wave >= 1001) return calcDamage({ damage: 120, type: 'melee' }, target, 0);
    return Math.max(target.hp, target.maxHp * 0.95);
  }

  function updateDoomslayerAI(unit) {
    if (!unit.isDoomslayer || unit.hp <= 0) return;
    const enemies = units.filter(u => u.team === 'enemy' && u.hp > 0);
    const foesOnAllies = enemies.filter(e => {
      const tgt = units.find(p => p.id === e.combatTargetId);
      return tgt && tgt.team === 'player' && !tgt.isDoomslayer;
    }).length;
    const onMe = enemies.filter(e => e.combatTargetId === unit.id || unitDistance(e, unit) < 50).length;

    if (onMe >= 4 && (unit.doomAbilityCd || 0) <= 0) {
      unit.doomAbilityCd = 120;
      for (const e of enemies) {
        if (unitDistance(unit, e) < 90) takeDamage(e, doomslayerDamage(e), { crit: true });
      }
      FloatingText.status(unit.x, unit.y, 'RIP & TEAR', '#ff4040');
      Particles.dust(unit.x, unit.y);
    } else if (foesOnAllies >= 3 && (unit.doomProtectCd || 0) <= 0) {
      unit.doomProtectCd = 90;
      units.filter(u => u.team === 'player' && u.hp > 0).forEach(a => {
        a.hp = Math.min(a.maxHp, a.hp + 40);
        a.rallyTimer = Math.max(a.rallyTimer || 0, 60);
        if (a.demoralized) restoreTroopMorale(a, 8);
      });
      FloatingText.status(unit.x, unit.y, 'GUARDIAN', '#80ff80');
    } else if (enemies.length >= 8 && (unit.doomCleaveCd || 0) <= 0) {
      unit.doomCleaveCd = 70;
      const near = enemies.filter(e => unitDistance(unit, e) < 70).slice(0, 5);
      near.forEach(e => takeDamage(e, doomslayerDamage(e)));
    }
    if (unit.doomAbilityCd > 0) unit.doomAbilityCd--;
    if (unit.doomProtectCd > 0) unit.doomProtectCd--;
    if (unit.doomCleaveCd > 0) unit.doomCleaveCd--;
  }

  function applyCrossoverOnHit(unit, target, dmg) {
    if (!unit.isCrossover) return;
    const cDef = typeof getCrossoverDef === 'function' ? getCrossoverDef(unit.type) : null;
    if (cDef?.faction) ach('crossover_ability', { unitType: unit.type, faction: cDef.faction });
    if (typeof FactionDepth !== 'undefined') FactionDepth.processAbilityHit(unit, target, dmg);
  }

  function getTotalStarCount(unit) {
    return (unit.vetBronze || 0) + (unit.vetSilver || 0) * 3 + (unit.vetGold || 0) * 9 +
      (unit.generalStars || 0) * 9;
  }

  function applyWweOnHit(unit, target, dmg) {
    if (!unit.isWwe) return;
    ach('crossover_ability', { unitType: unit.type, faction: 'wwe' });
    if (typeof FactionDepth !== 'undefined') FactionDepth.processAbilityHit(unit, target, dmg);
  }

  function fireWeapon(unit, target) {
    const dist = unitDistance(unit, target);
    if (!inAttackRange(unit, target)) return;

    let hit = unit.accuracy;
    if (unit.team === 'player' && !unit.isGeneral && isInGeneralAura(unit)) {
      hit += getGeneralAura().accuracy;
    }
    if (unit.isGeneral && (unit.w2wBuffTimer || 0) > 0) hit += 22;
    if (unit.team === 'enemy') hit = Math.max(4, hit - getSightPenaltyForUnit(unit));
    const effRange = getEffectiveRange(unit);
    if (unit.combatType === 'ranged' && dist > effRange * 0.8) hit *= 0.6;

    unit.rotation = Math.round(Math.atan2(target.y - unit.y, target.x - unit.x) * 180 / Math.PI);
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    unit.combatTargetId = target.id;
    unit.path = [];
    unit.pathIndex = 0;

    const aimRad = unit.rotation * Math.PI / 180;
    const fx = unit.x + Math.cos(aimRad) * 12;
    const fy = unit.y + Math.sin(aimRad) * 12;

    const useMelee = dist <= unit.meleeRange + (isMeleeCombat(unit) ? 4 : 0);

    if (useMelee && (isMeleeCombat(unit) || unit.combatType === 'ranged')) {
      CombatFX.meleeSlash(fx, fy, unit.rotation);
      if (Math.random() * 100 <= hit || unit.isDoomslayer) {
        const dmg = unit.isDoomslayer ? doomslayerDamage(target) : calcDamage(unit, target, 12);
        takeDamage(target, dmg, { crit: unit.isDoomslayer });
        applyWweOnHit(unit, target, dmg);
        applyCrossoverOnHit(unit, target, dmg);
        if (unit.hasElementalPop) Perks.applyElementalPopSplash(unit, target, units, takeDamage);
        if (unit.hasDoubleTap && target.hp > 0 && Math.random() < 0.45) {
          takeDamage(target, Math.round(dmg * 0.55));
        }
        if (unit.combatType === 'cavalry') unit.chargeTimer = 0;
        if (unit.type === 'sapper' && (target.type === 'siege_tower' || target.siegeDeployed)) {
          FloatingText.status(target.x, target.y, 'SIEGE!', '#ff8040');
        }
      }
      AudioEngine.SFX.swordHit();
      return;
    }

    const isRangedAttack = unit.combatType === 'ranged' || unit.combatType === 'siege';
    const attackRange = unit.combatType === 'siege' ? unit.range : getEffectiveRange(unit);
    if (isRangedAttack && dist <= attackRange) {
      if (unit.projectile === 'arrow') CombatFX.arrowLoose(fx, fy, unit.rotation);
      else CombatFX.spellCast(fx, fy);
      projectiles.push({
        x: unit.x, y: unit.y, tx: target.x, ty: target.y,
        type: unit.projectile || 'arrow', damage: unit.damage, team: unit.team,
        speed: unit.type === 'mage' || unit.type === 'dark_mage' ? 7 : unit.type === 'siege_tower' ? 4.5 : 6,
        accuracy: hit, targetId: target.id, sourceId: unit.id,
        sourceType: unit.type,
        splash: unit.type === 'mage' || unit.type === 'dark_mage' || unit.type === 'necromancer',
        angle: Math.atan2(target.y - unit.y, target.x - unit.x),
      });
      unit.projectile === 'arrow' ? AudioEngine.SFX.arrowShoot() : AudioEngine.SFX.magicCast();
    } else if (isMeleeCombat(unit) && dist <= unit.meleeRange && Math.random() * 100 <= hit) {
      CombatFX.meleeSlash(fx, fy, unit.rotation);
      takeDamage(target, calcDamage(unit, target, 10));
      AudioEngine.SFX.swordHit();
    }
  }

  function followPath(unit) {
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
    const onBuilderJob = unit.type === 'builder' && builderHasWork(unit);
    if (!unit.path?.length || unit.pathIndex >= unit.path.length) {
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
      unit.animState = 'idle';
      if (!onBuilderJob) finishManualOrder(unit);
      return;
    }

    const wp = unit.path[unit.pathIndex];
    const dx = wp.x - unit.x, dy = wp.y - unit.y;
    unit.rotation = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);

    if (steerToward(unit, wp.x, wp.y)) {
      unit.animState = 'walk';
      unit.pathStuck = 0;
      return;
    }

    unit.pathStuck = (unit.pathStuck || 0) + 1;
    unit.animState = unit.pathStuck > 1 ? 'idle' : 'walk';
    if (unit.pathStuck > 2) nudgeUnitFree(unit);
    if (unit.pathStuck > 4) {
      unit.pathStuck = 0;
      unit.pathIndex = Math.min(unit.pathIndex + 1, unit.path.length);
      if (unit.targetX != null) setUnitPath(unit, unit.targetX, unit.targetY);
    }
  }

  function healerCoversTarget(target, excludeHealer) {
    for (const h of units) {
      if (h === excludeHealer || h.hp <= 0 || h.combatType !== 'healer' || h.team !== target.team) continue;
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
    const wounded = units
      .filter(u => u.team === healer.team && u.hp > 0 && u.hp < u.maxHp)
      .sort((a, b) => {
        const aPri = a.combatType === 'healer' ? -0.5 : 0;
        const bPri = b.combatType === 'healer' ? -0.5 : 0;
        return (a.hp / a.maxHp + aPri) - (b.hp / b.maxHp + bPri);
      });

    for (const candidate of wounded) {
      if (!healerCoversTarget(candidate, healer)) return candidate;
    }
    return null;
  }

  function isHealerThreatNear(healer, foe, dangerDist = 110) {
    if (foe.team === healer.team || !isValidCombatFoe(foe)) return false;
    const d = Math.hypot(foe.x - healer.x, foe.y - healer.y);
    if (d > dangerDist) return false;
    if (inAttackRange(foe, healer)) return true;
    if ((foe.combatTargetId === healer.id || foe.pathTargetId === healer.id) && d < 85) return true;
    if (foe.targetX != null && Math.hypot(foe.targetX - healer.x, foe.targetY - healer.y) < 40 && d < 90) return true;
    return false;
  }

  function isHealerTargeted(healer) {
    for (const foe of units) {
      if (isHealerThreatNear(healer, foe)) return true;
    }
    return false;
  }

  function getHealerFleePoint(healer) {
    let fleeX = 0, fleeY = 0;
    let threats = 0;
    for (const foe of units) {
      if (foe.team === healer.team || !isValidCombatFoe(foe)) continue;
      const dx = healer.x - foe.x, dy = healer.y - foe.y;
      const d = Math.hypot(dx, dy);
      if (d > 130 || d < 0.01) continue;
      const weight = (130 - d) / 130;
      fleeX += (dx / d) * weight;
      fleeY += (dy / d) * weight;
      threats++;
    }
    if (threats === 0) {
      return clampPos(healer.x, healer.team === 'player' ? healer.y + 60 : healer.y - 60);
    }
    fleeY += healer.team === 'player' ? 1.4 : -1.4;
    const len = Math.hypot(fleeX, fleeY) || 1;
    return clampPos(healer.x + (fleeX / len) * 75, healer.y + (fleeY / len) * 75);
  }

  function updateHealer(unit) {
    if (unit.hp <= 0 || unit.fleeing || unit.combatType !== 'healer') return;
    if (unit.retreatingToMed || unit.atMedicalTent) return;

    if (unit.pinned) {
      unit.pinTimer--;
      if (unit.pinTimer <= 0) unit.pinned = false;
      return;
    }

    if (!unit.manualOrder && isHealerTargeted(unit)) {
      unit.healerFleeing = true;
      unit.healTargetId = null;
      unit.pathRecalc = (unit.pathRecalc || 0) - 1;
      if (!unit.path?.length || unit.pathRecalc <= 0) {
        unit.pathRecalc = 18;
        const flee = getHealerFleePoint(unit);
        setUnitPath(unit, flee.x, flee.y);
      }
      unit.animState = 'walk';
      return;
    }
    if (unit.healerFleeing) {
      unit.healerFleeing = false;
      unit.pathRecalc = 0;
      if (!unit.manualOrder) {
        unit.path = [];
        unit.pathIndex = 0;
      }
    }

    if ((unit.vetTier || 0) >= 4 && updateTick % 200 === 0) {
      let massHeal = 0;
      for (const ally of units) {
        if (ally.team !== 'player' || ally.hp <= 0 || ally.id === unit.id) continue;
        if (unitDistance(unit, ally) > unit.range * 1.1) continue;
        if (ally.hp >= ally.maxHp * 0.92) continue;
        const h = Math.min(unit.healAmount * 0.6, ally.maxHp - ally.hp);
        ally.hp += h;
        massHeal += h;
      }
      if (massHeal > 0) {
        CombatFX.healPulse(unit.x, unit.y);
        FloatingText.status(unit.x, unit.y, 'MASS MEND', '#80ffb0');
        notifyVetStarEvent(unit, trySpecialistRank(unit));
      }
    }

    const target = findHealTarget(unit);
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
          AudioEngine.SFX.heal();
          CombatFX.healPulse(target.x, target.y);
          if (healed > 0) {
            FloatingText.heal(target.x, target.y, healed);
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

  function countBuilderProjects(builder) {
    let n = 0;
    if (builder.building && !builder.building.complete && !builder.building.pending) n++;
    if (builder.building?.pending) n++;
    if (builder.buildQueue?.length) n += builder.buildQueue.length;
    if (builder.repairTarget) n++;
    return n;
  }

  function findRepairTarget(builder) {
    let best = null, bestScore = Infinity;
    for (const b of buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0 || b.hp >= b.maxHp) continue;
      const ratio = b.hp / b.maxHp;
      if (ratio > 0.92) continue;
      const d = Math.hypot(b.x - builder.x, b.y - builder.y);
      let score = d + (1 - ratio) * -200;
      if (b.type === 'wall' && isSiegeWave()) score -= 80;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best;
  }

  function builderHasWork(unit) {
    return !!(unit.building?.pending
      || (unit.building && !unit.building.complete)
      || unit.buildQueue?.length
      || unit.repairTarget);
  }

  function builderMarchTo(unit, tx, ty) {
    const dist = Math.hypot(unit.x - tx, unit.y - ty);
    if (dist <= unit.buildRange) return false;
    if (builderHasWork(unit)) unit.manualOrder = false;
    unit.pathRecalc = (unit.pathRecalc || 0) - 1;
    const destMoved = unit.targetX == null || Math.hypot(tx - unit.targetX, ty - unit.targetY) > 12;
    const needsPath = !unit.path?.length || unit.pathRecalc <= 0 || destMoved || (unit.pathStuck || 0) > 3;
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
    if (unit.manualOrder && !builderHasWork(unit)) return;
    if (builderHasWork(unit)) unit.manualOrder = false;

    if (!unit.buildQueue) unit.buildQueue = [];
    unit.hazardSlow = 1;
    if (unit.hazardBurnTick > 0) unit.hazardBurnTick--;

    if (builderAutoRepair && !unit.building && unit.buildQueue.length === 0 && countBuilderProjects(unit) < BUILDER_MAX_PROJECTS) {
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
          Particles.dust(rt.x, rt.y);
        }
        if ((unit.vetTier || 0) >= 4 && Math.random() < 0.02) {
          rt.hp = Math.min(rt.maxHp, rt.hp + rt.maxHp * 0.08);
          FloatingText.status(rt.x, rt.y, 'PATCH', '#80c0ff');
        }
        return;
      }
    }

    if (unit.building?.pending) {
      const site = unit.building;
      if (builderMarchTo(unit, site.x, site.y)) return;
      const t = site.type;
      unit.building = null;
      finalizeBuild(t, site.x, site.y, site.facing ? { facing: site.facing } : {});
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
        for (const p of b.parts) {
          p.complete = true;
          onBuildingComplete(p, { compound: true });
          Particles.dust(p.x, p.y);
        }
        ach('building_complete', { buildType: 'castle', compound: true, wallCount: countPlayerWalls() });
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
      unit.building = null;
      showMessage(`${BuildDefs[b.type].name} complete!`);
      Particles.dust(b.x, b.y);
    }
  }

  function updateUnitCombat(unit) {
    if (unit.hp <= 0 || unit.fleeing || unit.demoralized || unit.combatType === 'builder' || unit.combatType === 'courier') return;
    if (unit.retreatingToMed || unit.atMedicalTent) return;
    if (isMarchingToOutpost(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit)) return;

    if (unit.pinned) {
      unit.pinTimer--;
      if (unit.pinTimer <= 0) unit.pinned = false;
      return;
    }

    if (unit.combatType === 'healer') return;

    sanitizeUnitPursuit(unit);
    const target = findCombatTarget(unit);
    if (!target || !isPursuableFoe(unit, target)) {
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

    if (isFullySurrounded(target, unit.team) && unit.team === 'player') {
      releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
      unit.actionTimer = 10;
      retargetIfHunting(unit);
    } else if (unit.huntMode) {
      const targetMoved = unit.pathTargetId !== target.id ||
        Math.hypot(target.x - (unit.targetX ?? 0), target.y - (unit.targetY ?? 0)) > 30;
      if (!unit.path?.length || targetMoved) setUnitPath(unit, target.x, target.y, target);
      unit.actionTimer = 12;
    } else {
      unit.actionTimer = 20;
    }
  }

  function updateEnemyAI(unit) {
    if (unit.hp <= 0) return;
    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.updateEnemyAI(unit)) return;
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

    if (unit.attackAnimTimer > 0) return;

    if (unit.type === 'goblin_engineer' && Math.random() < 0.01) {
      decorations.push({ type: 'barricade', x: unit.x, y: unit.y + 20, size: 16, hp: 60, blocksMove: true, blocksLOS: true, cover: 0.4, radius: 16 });
      invalidateObstacles();
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
    let destX, destY, destUnit = null;

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

    const needPath = !unit.path?.length || unit.pathRecalc <= 0 ||
      unit.pathTargetId !== pathKey || destShift;

    if (needPath) {
      const offscreenMin = getGfxQuality()?.offscreenEnemyMinUnits ?? 45;
      const offscreen = units.length > offscreenMin && !isInView(unit.x, unit.y, 80, 0);
      unit.pathRecalc = offscreen ? 72 : 40;
      if (destUnit) setUnitPath(unit, destX, destY, destUnit);
      else {
        setUnitPath(unit, destX, destY);
        unit.pathTargetId = 'advance';
      }
    }

    followPath(unit);

    if (!unit.fledBattle && enemyBrokeThrough(unit)) {
      misses++;
      unit.hp = 0;
      const flank = unit.spawnSide && unit.spawnSide !== 'north' ? ` (${unit.spawnSide} flank)` : '';
      showMessage(`Enemy broke through${flank}! (${misses}/${getMissLimit()})`);
      if (!(creativeMode && creativeSettings.noGameOver) && misses >= getMissLimit()) endGame(false);
    }
  }

  function updateCavalryCharge(unit) {
    if (unit.combatType !== 'cavalry' || unit.hp <= 0 || unit.garrisoned) return;
    const fighting = unit.combatTargetId && units.some(u => u.id === unit.combatTargetId && u.hp > 0 && inAttackRange(unit, u));
    if (unit.animState === 'walk' && !fighting && unit.path?.length) {
      unit.chargeTimer = Math.min(90, (unit.chargeTimer || 0) + 1);
    } else {
      unit.chargeTimer = Math.max(0, (unit.chargeTimer || 0) - 3);
    }
  }

  function updateDayNightCycle() {
    if (state !== 'playing') return;
    updateWweLanternAura();
    if (isDayPhase() && spawnQueue.length > 0) {
      spawnTimer--;
      if (spawnTimer <= 0) {
        const type = spawnQueue.shift();
        const side = nextEnemySpawnSide();
        const pos = spawnPosForSide(side);
        const u = spawnUnit(type, pos.x, pos.y, 'enemy', { spawnSide: side });
        u.rotation = enemyRotationForSide(side);
        const cfg = currentWaveConfig || getWaveConfig(wave);
        const diff = getDifficulty();
        u.maxHp = Math.floor(u.maxHp * waveModifiers.hpMult * cfg.hpScale
          * diff.waveHpScaleMult * diff.enemyHpMult);
        u.hp = u.maxHp;
        u.damage = Math.floor(u.damage * cfg.dmgScale * diff.waveDmgScaleMult * diff.enemyDmgMult);
        const accProg = typeof academyProgress === 'function' ? academyProgress(wave) : Math.min(1, wave / ACADEMY_ERA_WAVE);
        u.accuracy = Math.min(65, u.accuracy + Math.floor(accProg * 18) + Math.floor((postAcademyProgress?.(wave) || 0) * 6));
        if (currentHordeWave) {
          u.maxHp = Math.floor(u.maxHp * (currentHordeWave.hpMult || 1));
          u.hp = u.maxHp;
          u.damage = Math.floor(u.damage * (currentHordeWave.dmgMult || 1));
        }
        if (isEliteEnemy(u)) {
          const eliteMult = 1.28 * diff.eliteChanceMult;
          u.maxHp = Math.floor(u.maxHp * eliteMult);
          u.hp = u.maxHp;
          u.damage = Math.floor(u.damage * (1.18 * diff.eliteChanceMult));
          u.accuracy = Math.min(65, u.accuracy + 5);
        }
        if (type === 'siege_tower') {
          u.maxHp = Math.floor(u.maxHp * 1.15);
          u.hp = u.maxHp;
        }
        if (u.isNamedBoss) {
          const title = u.bossTitle || EnemyDefs[type]?.bossTitle || '';
          FloatingText.status(u.x, u.y - 32, (u.bossName || EnemyDefs[type]?.bossName || 'BOSS').toUpperCase(), '#ffd040');
          if (title) FloatingText.status(u.x, u.y - 18, title, '#ff8080');
          AudioEngine.SFX.bossWarn?.();
        } else if (typeof isMonsterEnemy === 'function' && isMonsterEnemy(u)) {
          FloatingText.status(u.x, u.y - 28, EnemyDefs[type]?.name?.toUpperCase() || 'MONSTER', '#ff4060');
          AudioEngine.SFX.bossWarn?.();
        }
        if (u.isNamedBoss && namedBossWave?.scale) {
          const mult = namedBossWave.scale;
          u.maxHp = Math.floor(u.maxHp * mult);
          u.hp = u.maxHp;
          u.damage = Math.floor(u.damage * mult);
          u.accuracy = Math.min(68, u.accuracy + Math.floor((mult - 1) * 8));
        }
        if (colonyThreatMods?.hpMult && colonyThreatMods.hpMult !== 1) {
          u.maxHp = Math.floor(u.maxHp * colonyThreatMods.hpMult);
          u.hp = u.maxHp;
          u.damage = Math.floor(u.damage * (colonyThreatMods.dmgMult || 1));
        }
        u.huntMode = true;
        units.push(u);
        const baseInterval = creativeMode && creativeCustomWave?.interval
          ? creativeCustomWave.interval
          : (cfg.interval || 90);
        const hordeMult = currentHordeWave?.intervalMult || 1;
        const colonyInterval = colonyThreatMods?.intervalMult || 1;
        spawnTimer = Math.max(8, Math.floor(baseInterval * (creativeMode ? 1 : diff.spawnIntervalMult) * hordeMult * colonyInterval)
          + Math.floor(Math.random() * (currentHordeWave ? 10 : creativeMode ? 8 : 20)));
      }
    } else if (isDayPhase() && spawnQueue.length === 0 && countActiveEnemies() === 0) {
      if (!(creativeMode && creativeSettings.noAutoCycle)) enterNightPhase();
    } else if (isNightPhase()) {
      nightTimer++;
      const nightTicks = getNightPrepTicks();
      waveProgress = Math.min(1, nightTimer / nightTicks);
      if (nightTimer >= nightTicks && !(creativeMode && creativeSettings.noAutoCycle)) beginDayPhase();
    }
  }

  function updatePerkCollectionLocal() {
    if (!isNightPhase() || typeof Perks === 'undefined' || !Perks.perkMachinesUnlocked()) return;
    for (const unit of units) {
      if (!Perks.isEligibleForPerks(unit) || unit.hp <= 0) continue;
      if (unit.building || unit.garrisoned || unit.wallGarrisoned || hasPendingOutpostGarrison(unit)) continue;
      const slots = Perks.getPerkSlots(unit);
      if ((unit.perks || []).length >= slots) continue;
      const target = Perks.findBestPerkBuilding(unit, buildings);
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
      if (Perks.applyPerkToUnit(unit, perkId)) {
        unit.perkTargetId = null;
        FloatingText.status(unit.x, unit.y, PerkDefs[perkId].name, '#c0ffa0');
      }
    }
  }

  function update() {
    updateTick++;
    if (typeof Perf !== 'undefined') {
      Perf.setUpdateTick(updateTick);
      Perf.begin('update');
    }
    const unitCount = units.length;
    const gfxQ = getGfxQuality();
    const pathMult = gfxQ?.pathfindMult ?? 1;
    let pathBase = unitCount > 120 ? 6 : unitCount > 80 ? 10 : unitCount > 60 ? 14 : unitCount > 35 ? 20 : 28;
    pathfindBudget = Math.max(4, Math.floor(pathBase * pathMult));
    if (typeof Particles !== 'undefined') {
      Particles.setBudget?.(unitCount, gfxQ?.particleMult ?? 1);
    }
    const buildSig = getIncompleteBuildSig();
    if (buildSig && buildSig !== incompleteBuildSig) {
      Pathfinding.clearCache?.();
      incompleteBuildSig = buildSig;
    } else if (!buildSig) {
      incompleteBuildSig = '';
    }
    rebuildSpatialIndex();
    updateCamera();
    if (state !== 'playing') return;
    if (!paused && typeof GameModes !== 'undefined') GameModes.tickElapsed(16);

    if (spawnQueue.length > 0 || countActiveEnemies() > 0) {
      const alive = countActiveEnemies();
      const remaining = spawnQueue.length + alive;
      if (waveEnemyTotal > 0) waveProgress = Math.max(0, Math.min(1, 1 - remaining / waveEnemyTotal));
    }

    updateDayNightCycle();
    if (creativeMode && typeof CreativeTools !== 'undefined') {
      CreativeTools.tickStress();
      CreativeTools.tickRecord();
    }
    if (paused) return;

    if (rallyTimer > 0) rallyTimer--;

    if (courierCooldown > 0) {
      courierCooldown--;
      if (courierCooldown <= 0) units.filter(u => u.type === 'courier').forEach(u => u.courierReady = true);
    }

    if (updateTick % 3 === 0) {
      for (const b of buildings) {
        if (b.hp <= 0 || !b.complete || !b.moraleAura) continue;
        const rate = 0.018 * (b.moraleAura || 1);
        const radius = b.radius + 30;
        const targets = useSpatialQueries()
          ? Spatial.queryRadius(b.x, b.y, radius, e =>
            e.kind === 'unit' && e.ref?.team === 'player' && !e.ref?.demoralized
          )
          : units.filter(u =>
            u.team === 'player' && !u.demoralized && Math.hypot(u.x - b.x, u.y - b.y) < radius
          );
        for (const u of targets) {
          u.morale = Math.min(u.maxMorale, u.morale + rate);
        }
      }
    }
    if (typeof ContentExpansion !== 'undefined') ContentExpansion.updatePerTick();
    applyGeneralAura();
    lastStandActive = GameDepth?.updateLastStand(units) || false;
    if (lastStandActive && updateTick % 120 === 0) {
      FloatingText.status(worldW / 2, rallyY - 30, 'LAST STAND', '#ffd700');
    }
    decayMoraleWitnesses();
    if (moraleAlertCooldown > 0) moraleAlertCooldown--;
    const playerGeneral = findPlayerGeneral();
    if (playerGeneral) updateGeneralRallyMission(playerGeneral);
    if (playerGeneral && updateTick % 45 === 0) {
      let threat = 0;
      for (const e of units) {
        if (e.team !== 'enemy' || e.hp <= 0) continue;
        if (unitCount > 50 && !isInView(e.x, e.y, 100, 160)) continue;
        const tgt = findEnemyMoveTarget(e);
        if (tgt.kind === 'unit' && tgt.target?.id === playerGeneral.id) threat++;
      }
      generalThreatCount = threat;
    }
    if (playerGeneral && generalThreatCount >= 2 && updateTick % 90 === 0) {
      showMessage(`General threatened by ${generalThreatCount} foes!`, 120);
    }
    for (const u of units) {
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
      if (hazards.length) GameDepth?.applyHazardToUnit(u, hazards);
    }
    const castleGroup = getStationedCastleGroup();
    if (castleGroup && !unmannedWallWarned) {
      let slots = 0, filled = 0;
      for (const wall of buildings) {
        if (wall.castleGroup !== castleGroup || !wall.wallSlots) continue;
        for (const s of wall.wallSlots) {
          slots++;
          if (s.unitId) filled++;
        }
      }
      if (slots > 0 && filled < slots * 0.5) {
        unmannedWallWarned = true;
        showMessage('Castle walls understaffed — deploy more footmen!', 220);
      }
    }

    for (const u of units) {
      if ((u.lanternBlind || 0) > 0) u.lanternBlind--;
    }

    updateOutposts();
    updateCastleKeeps();
    updateWallGarrison();
    updateMedicalRetreats();
    updateHuntPaths();
    updatePerkCollectionLocal();

    for (const unit of units) {
      if (unit.hp <= 0) continue;
      if (units.length > 40 && !isInView(unit.x, unit.y, 50, 0)) continue;
      if (isTerrainBlocked(unit.x, unit.y, unit)) nudgeUnitFree(unit);
    }

    for (const unit of units) {
      if (unit.hp <= 0) continue;
      const offscreenMin = gfxQ?.offscreenEnemyMinUnits ?? 45;
      const offscreenEnemy = unit.team === 'enemy' && unitCount > offscreenMin && !isInView(unit.x, unit.y, 70, 0);
      if (offscreenEnemy) {
        const phase = unit.aiPhase ?? (unit.aiPhase = unit.id.charCodeAt(0) % 3);
        if (unit.attackAnimTimer > 0) unit.attackAnimTimer--;
        if (unit.fleeing) { updateFleeingUnit(unit); continue; }
        if (unit.demoralized) continue;
        if (updateTick % 3 !== phase) {
          if (unit.path?.length && unit.attackAnimTimer <= 0 && !unit.pinned) followPath(unit);
          if (unit.combatTargetId) updateUnitCombat(unit);
          continue;
        }
      }
      if (unit.pinned) {
        unit.pinTimer = (unit.pinTimer || 0) - 1;
        if (unit.pinTimer <= 0) unit.pinned = false;
      }
      if (unit.attackAnimTimer > 0) { unit.attackAnimTimer--; if (unit.attackAnimTimer <= 0) unit.animState = 'idle'; }
      if (!offscreenEnemy) {
        unit.frameTimer++;
        if (unit.frameTimer > 6) { unit.frame = (unit.frame + 1) % 4; unit.frameTimer = 0; }
      }

      if (unit.rallyTimer > 0) unit.rallyTimer--;
      if (unit.isGeneral && unit.hp > 0) {
        unit.generalAliveTimer = (unit.generalAliveTimer || 0) + 1;
        if ((unit.w2wBuffTimer || 0) > 0) unit.w2wBuffTimer--;
      }

      if (unit.fleeing) { updateFleeingUnit(unit); continue; }
      if (unit.demoralized) { unit.animState = 'idle'; continue; }
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
        const marchingToOutpost = hasPendingOutpostGarrison(unit);
        const marchingToKeep = isMarchingToKeep(unit);
        const marchingToWall = isMarchingToWallSlot(unit);
        if (onRallyMission) {
          if (unit.attackAnimTimer <= 0 && !unit.pinned) followPath(unit);
        } else if (unit.type !== 'builder' || !unit.building) {
          const foe = findCombatTarget(unit);
          const fighting = foe && inAttackRange(unit, foe);
          const mayWalk = !fighting && !unit.garrisoned && !unit.stationedKeep && !unit.wallGarrisoned &&
            !marchingToOutpost && !marchingToKeep && !marchingToWall &&
            !unit.retreatingToMed && !unit.atMedicalTent &&
            unit.attackAnimTimer <= 0 && !unit.pinned;
          if (mayWalk || marchingToOutpost || marchingToKeep || marchingToWall || unit.retreatingToMed) {
            followPath(unit);
          }
        }
        updatePlayerStructureAttack(unit);
        if (!unit.retreatingToMed && !unit.atMedicalTent && !onRallyMission) updateUnitCombat(unit);
      } else {
        updateEnemyAI(unit);
        updateEnemySiege(unit);
        updateEnemyWallAttack(unit);
        updateUnitCombat(unit);
      }
    }

    const prevBuildings = buildings.length;
    for (let i = buildings.length - 1; i >= 0; i--) {
      if (buildings[i].hp <= 0) {
        finalizeBuildingDestroyed(buildings[i], { silent: true, playDeath: false });
      }
    }
    if (buildings.length !== prevBuildings) invalidateObstacles();

    projectiles = projectiles.filter(p => {
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
      if (dist < 0.01) return false;
      p.angle = Math.atan2(dy, dx);
      const trailOk = typeof GfxQuality === 'undefined' || GfxQuality.allowProjectileTrails(projectiles.length);
      const trailEvery = gfxQ?.trailEveryN ?? 1;
      if (trailOk && updateTick % trailEvery === 0) {
        Particles.trail(p.x, p.y, p.type === 'arrow' ? '#8a6030' : '#a060ff');
      }
      if (dist < p.speed) {
        const hit = getUnitById(p.targetId);
        const shooter = p.sourceId ? getUnitById(p.sourceId) : null;
        const projHit = p.team === 'enemy' && shooter
          ? Math.max(4, p.accuracy - getSightPenaltyForUnit(shooter))
          : p.accuracy;
        if (hit?.hp > 0 && Math.random() * 100 <= projHit) {
          const src = { damage: p.damage, experience: 0, type: p.sourceType || 'archer' };
          const dmg = calcDamage(src, hit, 8);
          takeDamage(hit, dmg);
          if (p.splash) {
            Particles.explosion(hit.x, hit.y);
            let splashHits = 0;
            const splashTargets = useSpatialQueries()
              ? Spatial.queryRadius(hit.x, hit.y, 40, e =>
                e.kind === 'unit' && e.ref?.team !== hit.team && e.ref?.hp > 0 && e.ref?.id !== hit.id
              )
              : units.filter(u => u.team !== hit.team && u.hp > 0 && u.id !== hit.id);
            for (const u of splashTargets) {
              if (Math.hypot(u.x - hit.x, u.y - hit.y) < 40) {
                takeDamage(u, Math.round(dmg * 0.45));
                splashHits++;
              }
            }
            if (splashHits >= 1) ach('mage_splash', { hitCount: splashHits + 1 });
          }
          if (shooter?.hasDoubleTap && hit.hp > 0 && Math.random() < 0.4) {
            takeDamage(hit, Math.round(dmg * 0.55));
          }
        }
        return false;
      }
      p.x += (dx / dist) * p.speed;
      p.y += (dy / dist) * p.speed;
      return true;
    });

    updateStuckRecovery();

    for (const u of units) {
      if (u.hp <= 0) {
        if (u.garrisoned) releaseFromGarrison(u);
        if (u.stationedKeep) releaseFromKeep(u);
        if (u.wallGarrisoned || isMarchingToWallSlot(u)) releaseFromWallGarrison(u);
        u.retreatingToMed = null;
        u.atMedicalTent = null;
        if (u.siegeDeployed || u.linkedWallId) clearSiegeLink(u);
      }
    }
    units = units.filter(u => u.hp > 0);
    resolveOverlaps();
    moveMarkers = moveMarkers.filter(m => { m.life--; return m.life > 0; });
    messages = messages.filter(m => { m.life--; return m.life > 0; });
    if (messages.length > 24) messages.length = 24;
    if (fallenPool.length > 48) fallenPool.splice(0, fallenPool.length - 48);
    Particles.update();
    CombatFX.update();
    StrikeFX?.update?.();
    FloatingText.update();
    sanitizeTactical();
    if (typeof VisualPolish !== 'undefined') {
      VisualPolish.update();
      VisualPolish.updateAudioMix({
        wave, timeOfDay, bossActive: !!currentWaveConfig?.boss,
        units, spawnQueue, projectiles,
      });
    }
    if (typeof GfxQuality !== 'undefined') {
      const alive = units.filter(u => u.hp > 0).length;
      const fps = typeof Perf !== 'undefined' ? Perf.getStats().fps : 60;
      GfxQuality.tick(fps, alive);
    }
    if (typeof Perf !== 'undefined') {
      Perf.end('update');
      Perf.tick({
        army: units.filter(u => u.team === 'player' && u.hp > 0).length,
        enemyCount: units.filter(u => u.team === 'enemy' && u.hp > 0).length,
        buildingCount: buildings.length,
      });
    }
  }

  function getSortedAliveUnits() {
    const shift = getGfxQuality()?.sortFrameShift ?? 2;
    const frame = updateTick >> shift;
    if (sortedUnitsFrame === frame && sortedUnitsCache.length) return sortedUnitsCache;
    sortedUnitsCache = [];
    for (const u of units) {
      if (u.hp > 0 && isInView(u.x, u.y, 36)) sortedUnitsCache.push(u);
    }
    sortedUnitsCache.sort((a, b) => a.y - b.y);
    sortedUnitsFrame = frame;
    return sortedUnitsCache;
  }

  function draw() {
    if (!canvas || !ctx) return;
    if (typeof Perf !== 'undefined') Perf.begin('draw');
    const gfxQ = getGfxQuality();
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewX, viewY);
    ctx.scale(viewScale, viewScale);

    ctx.drawImage(SpriteGen.getBattlefieldCanvas(worldW, getMapViewH(), BASE_FIELD_W, BASE_FIELD_H), 0, 0);
    if (typeof VisualPolish !== 'undefined' && (gfxQ?.drawBorders !== false)) {
      VisualPolish.drawTerritoryBorders(ctx, worldW, getMapViewH(), territoryTier);
    }
    SpriteGen.drawAttackSideMarkers(ctx, worldW, getMapViewH(), getWaveAttackSides(), wave);

    if (gfxQ?.drawHazards !== false) {
      for (const h of hazards) {
        if (!isInView(h.x, h.y, h.radius || 30)) continue;
        SpriteGen.drawHazard?.(ctx, h);
      }
    }

    const stationedGen = getStationedGeneral();
    if (stationedGen && isInView(stationedGen.x, stationedGen.y, 200)) {
      const aura = getGeneralAura();
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.12 + aura.strength * 0.18})`;
      ctx.lineWidth = 2 / Math.max(0.5, viewScale);
      ctx.beginPath();
      ctx.arc(stationedGen.x, stationedGen.y, aura.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (gfxQ?.drawDecor !== false) {
      for (const d of decorations) {
        if (!isInView(d.x, d.y, d.size || 16)) continue;
        if (d.type === 'tree') SpriteGen.drawTree(ctx, d.x, d.y, d.size);
        else if (d.type === 'rock') SpriteGen.drawRock(ctx, d.x, d.y, d.size);
        else if (d.type === 'barricade') SpriteGen.drawBarricade(ctx, d.x, d.y);
        else if (d.type === 'supply_crate' || d.type === 'oil_barrel') SpriteGen.drawDestructible?.(ctx, d);
      }
    }

    for (const b of buildings) {
      if (b.hp <= 0 || !isInView(b.x, b.y, b.radius || 28)) continue;
      SpriteGen.drawBuilding(ctx, b);
      if (gfxQ?.buildingHpBars !== false) {
        const barW = b.isHamlet || b.isMerchantGuild ? 40 : 32;
        SpriteGen.drawHealthBar(ctx, b.x, b.y + b.radius * 0.5, barW, b.hp / b.maxHp, b.owner === 'enemy');
      }
    }

    if (selectedUnitId) {
      const sel = units.find(u => u.id === selectedUnitId && u.hp > 0);
      if (sel?.path?.length && isInView(sel.x, sel.y, 60)) {
        ctx.strokeStyle = 'rgba(100,200,255,0.4)';
        ctx.lineWidth = 1.5 / Math.max(0.5, viewScale);
        ctx.beginPath();
        ctx.moveTo(sel.x, sel.y);
        for (let i = sel.pathIndex; i < sel.path.length; i++) ctx.lineTo(sel.path[i].x, sel.path[i].y);
        ctx.stroke();
      }
    }

    for (const m of moveMarkers) {
      if (isInView(m.x, m.y, 12)) SpriteGen.drawMoveMarker(ctx, m.x, m.y);
    }

    const light = getDayLightLevel();
    if (gfxQ?.drawLanternAuras !== false) for (const u of units) {
      if (!u.isWwe || u.wweAbility !== 'lantern' || u.hp <= 0 || !isInView(u.x, u.y, 140)) continue;
      const pulse = 0.1 + Math.sin(updateTick * 0.07) * 0.05;
      const alpha = pulse * (isNightPhase() ? 0.35 : (0.55 + (1 - light) * 0.45));
      ctx.fillStyle = `rgba(48,96,48,${alpha})`;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 132, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(120,200,80,${alpha * 1.2})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const sorted = getSortedAliveUnits();
    const rallyPulse = updateTick * 0.08;
    const heavyScene = sorted.length > 55 || (gfxQ && gfxQ.drawMorale === false);
    for (const u of sorted) {
      if (typeof Perf !== 'undefined') Perf.count('drawUnits');
      if (u.rallyTimer > 0 && gfxQ?.rallyRings !== false) {
        ctx.strokeStyle = `rgba(240,192,64,${0.25 + Math.sin(rallyPulse) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (gfxOverlayFor(u, gfxQ?.eliteRings) && (isEliteEnemy(u) || u.type === 'war_chief' || u.isNamedBoss)) {
        const monster = typeof isMonsterEnemy === 'function' && isMonsterEnemy(u);
        const named = u.isNamedBoss || (typeof isNamedBoss === 'function' && isNamedBoss(u));
        const ringR = 15 + (u.spriteScale || 1) * 4 + (named ? 10 : monster ? 6 : 0);
        ctx.strokeStyle = named ? 'rgba(255,215,0,0.75)' : monster ? 'rgba(255,60,80,0.65)' : 'rgba(200,80,255,0.55)';
        ctx.lineWidth = named ? 3 : monster ? 3 : 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (u.team === 'player' && u.vetTier > 0 && gfxQ?.drawVet !== false && (!heavyScene || isUnitSelected(u))) {
        ctx.strokeStyle = `rgba(255,215,0,${0.35 + u.vetTier * 0.08})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 17 + u.vetTier * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (u.type === 'siege_tower') {
        ctx.fillStyle = 'rgba(160,80,40,0.35)';
        ctx.fillRect(u.x - 14, u.y - 20, 28, 32);
        ctx.strokeStyle = '#c06030';
        ctx.lineWidth = 2;
        ctx.strokeRect(u.x - 14, u.y - 20, 28, 32);
        ctx.fillStyle = '#e0a060';
        ctx.font = '7px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText('SIEGE', u.x, u.y - 24);
      }
      if (gfxQ?.chargeGlow !== false && u.combatType === 'cavalry' && u.chargeTimer > 30) {
        ctx.fillStyle = `rgba(255,180,60,${u.chargeTimer / 90 * 0.35})`;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 13, 0, Math.PI * 2);
        ctx.fill();
      }
      if (gfxQ?.honorGlow !== false && (u.honorGlowTimer || 0) > 0) {
        u.honorGlowTimer--;
        const glow = u.honorGlowTimer / 240;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.15 + glow * 0.25})`;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 16 + glow * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      const drawRot = typeof GfxQuality !== 'undefined' ? GfxQuality.quantizeRotation(u.rotation) : u.rotation;
      const sprScale = u.spriteScale || 1;
      const drawSz = 36 * sprScale;
      const img = SpriteGen.getUnitCanvas(u.spriteType, drawRot, u.team, u.frame, sprScale, u.animState);
      ctx.drawImage(img, u.x - drawSz / 2, u.y - drawSz / 2, drawSz, drawSz);
      if (u.id === selectedUnitId || selectedUnitIds.includes(u.id)) {
        SpriteGen.drawSelectionRing(ctx, u.x, u.y, u.id === selectedUnitId ? 14 : 12);
      }
      if (u.huntMode && u.team === 'player' && typeof VisualPolish === 'undefined') {
        ctx.fillStyle = '#ff4040';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('H', u.x + 12, u.y - 14);
      }
      const hpMode = gfxQ?.unitHpBars ?? 'all';
      const showHp = hpMode === 'all' || gfxOverlayFor(u, hpMode);
      if (showHp) {
        const barW = 24 * Math.max(1, (u.spriteScale || 1) * 0.85);
        const barY = u.y - 22 - ((u.spriteScale || 1) - 1) * 10;
        SpriteGen.drawHealthBar(ctx, u.x, barY, barW, u.hp / u.maxHp, u.team === 'enemy');
      }
      if (gfxQ?.drawMorale !== false && isMoraleCombatUnit(u) && u.maxMorale > 0) {
        SpriteGen.drawMoraleBar(ctx, u.x, u.y - 27, 20, u.morale / u.maxMorale);
      }
      if (u.demoralized && u.hp > 0) {
        ctx.fillStyle = '#a080c0';
        ctx.font = '7px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText('GAVE UP', u.x, u.y - 32);
      }
      if (u.fleeing && u.hp > 0) {
        ctx.fillStyle = '#c06040';
        ctx.font = '7px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText('ROUT', u.x, u.y - 32);
      }
      if (u.team === 'enemy' && u.isNamedBoss && u.hp > 0 && gfxOverlayFor(u, gfxQ?.drawHonor ?? true)) {
        ctx.fillStyle = 'rgba(255,220,120,0.95)';
        ctx.font = 'bold 7px Cinzel';
        ctx.textAlign = 'center';
        const labelY = u.y - 38 - ((u.spriteScale || 1) - 1) * 12;
        ctx.fillText(u.bossName || EnemyDefs[u.type]?.bossName || 'BOSS', u.x, labelY);
        const title = u.bossTitle || EnemyDefs[u.type]?.bossTitle;
        if (title) {
          ctx.font = '6px Cinzel';
          ctx.fillStyle = 'rgba(255,160,160,0.9)';
          ctx.fillText(title, u.x, labelY + 9);
        }
      }
      if (u.team === 'player') {
        if (gfxQ?.drawVet !== false) SpriteGen.drawVetStars(ctx, u.x, u.y, u);
        if (u.honorName && gfxOverlayFor(u, gfxQ?.drawHonor ?? true)) {
          if (typeof repairHonorName === 'function') repairHonorName(u);
          if (u.honorName && (!heavyScene || isUnitSelected(u))) {
            ctx.fillStyle = 'rgba(240,232,176,0.92)';
            ctx.font = '6px Cinzel';
            ctx.textAlign = 'center';
            const nameY = u.isGeneral && u.stationedKeep ? u.y - 44 : u.y - 38;
            ctx.fillText(u.honorName, u.x, nameY);
          }
        }
      }
      if (u.retreatingToMed && u.hp > 0) {
        ctx.fillStyle = '#60c0ff';
        ctx.font = '7px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText('↩ MED', u.x, u.y - 30);
      }
      if (typeof VisualPolish !== 'undefined') {
        if (gfxOverlayFor(u, gfxQ?.drawAccent ?? true)) VisualPolish.drawFactionAccent(ctx, u);
        if (gfxQ?.drawAccessibility !== false) VisualPolish.drawAccessibilityCue(ctx, u);
      } else if (u.isWwe && u.wweColor) {
        ctx.strokeStyle = u.wweColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (u.isDoomslayer && u.hp > 0) {
        ctx.strokeStyle = 'rgba(255,64,32,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ff4020';
        ctx.font = '6px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText('DOOM', u.x, u.y - 22);
      }
      if (gfxQ?.generalOverlay !== false && u.isGeneral && u.hp > 0) {
        ctx.strokeStyle = 'rgba(255,215,0,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(u.x, u.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (u.stationedKeep) {
          const str = getGeneralBuffStrength();
          ctx.fillStyle = '#ffd700';
          ctx.font = '7px Cinzel';
          ctx.textAlign = 'center';
          const stars = u.generalStars ? ` ★${u.generalStars}` : '';
          ctx.fillText(`CMD ${Math.round(str * 100)}%${stars}`, u.x, u.y - 30);
        } else if (u.rallyTargetId) {
          ctx.fillStyle = '#ffd700';
          ctx.font = '7px Cinzel';
          ctx.textAlign = 'center';
          ctx.fillText('WALL TO WALL', u.x, u.y - 34);
        }
        if ((u.w2wBuffTimer || 0) > 0) {
          ctx.strokeStyle = `rgba(255,215,0,${0.35 + Math.sin(updateTick * 0.12) * 0.2})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(u.x, u.y, 24, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    const vBounds = getVisibleBounds(60);
    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.getFortifyZones) {
      StrikeFX?.drawFortifyZones?.(ctx, ContentExpansion.getFortifyZones(), updateTick);
    }
    StrikeFX?.draw?.(ctx, vBounds);
    if (selectedAbility && pointerScreen.sx >= 0) {
      const ab = Abilities[selectedAbility];
      const pw = screenToWorld(pointerScreen.sx, pointerScreen.sy);
      StrikeFX?.drawTargeting?.(ctx, selectedAbility, pw.x, pw.y, ab?.radius || 50, updateTick);
    }
    CombatFX.draw(ctx, vBounds);
    for (const p of projectiles) {
      if (isInView(p.x, p.y, 20, 0)) SpriteGen.drawProjectile(ctx, p);
    }
    if (typeof VisualPolish !== 'undefined' && gfxQ?.drawCorpses !== false) VisualPolish.drawDeathCorpses(ctx);
    Particles.draw(ctx, vBounds);
    FloatingText.draw(ctx, vBounds);

    if (typeof VisualPolish !== 'undefined') {
      const atm = gfxQ?.atmosphere ?? 'full';
      if (atm === 'full') {
        VisualPolish.drawAtmosphere(ctx, worldW, getMapViewH(), light, timeOfDay, wave, updateTick, { weatherParticles: gfxQ?.weatherParticles !== false });
      } else if (atm === 'simple') {
        VisualPolish.drawAtmosphere(ctx, worldW, getMapViewH(), light, timeOfDay, wave, updateTick, { simple: true });
      }
    } else if (isNightPhase()) {
      ctx.fillStyle = 'rgba(6,10,32,0.62)';
      ctx.fillRect(0, 0, worldW, getMapViewH());
    } else if (light < 0.92) {
      const dusk = 1 - light;
      ctx.fillStyle = `rgba(24,14,48,${dusk * 0.42})`;
      ctx.fillRect(0, 0, worldW, getMapViewH());
    }

    for (let i = 0; i < misses; i++) {
      ctx.fillStyle = '#c04040';
      ctx.beginPath();
      ctx.moveTo(20 + i * 14, 8);
      ctx.lineTo(26 + i * 14, 20);
      ctx.lineTo(14 + i * 14, 20);
      ctx.fill();
    }
    ctx.restore();

    if (rallyTimer > 0) {
      ctx.fillStyle = 'rgba(240,192,64,0.85)';
      ctx.font = '11px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('RALLY ACTIVE', canvas.width / 2, canvas.height - 28);
    }

    if (isNightPhase()) {
      const secLeft = getNightSecondsRemaining();
      const m = Math.floor(secLeft / 60);
      const s = String(secLeft % 60).padStart(2, '0');
      ctx.fillStyle = 'rgba(140,160,220,0.92)';
      ctx.font = '13px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('NIGHT — PREPARE DEFENSES', canvas.width / 2, 52);
      ctx.font = '10px Cinzel';
      ctx.fillStyle = 'rgba(180,190,230,0.75)';
      ctx.fillText(`Builders +35% speed · Auto dawn ${m}:${s} · D or BEGIN DAY to skip`, canvas.width / 2, 68);
    } else if (light < 0.75) {
      ctx.fillStyle = 'rgba(200,180,120,0.8)';
      ctx.font = '10px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('DUSK — visibility fading', canvas.width / 2, 52);
    }

    const bossUnit = units.find(u => u.team === 'enemy' && u.hp > 0 && (u.isNamedBoss || u.type === 'war_chief'));
    if (bossUnit) {
      const bossLabel = bossUnit.bossName || EnemyDefs[bossUnit.type]?.bossName
        || (bossUnit.type === 'war_chief' ? 'WAR CHIEF' : 'BOSS');
      const barW = Math.min(220, 140 + (bossLabel.length * 4));
      ctx.fillStyle = 'rgba(20,8,8,0.8)';
      ctx.fillRect(canvas.width / 2 - barW / 2, 76, barW, 16);
      ctx.fillStyle = bossUnit.isNamedBoss ? '#a04020' : '#c04040';
      ctx.fillRect(canvas.width / 2 - barW / 2 + 2, 79, (barW - 4) * (bossUnit.hp / bossUnit.maxHp), 10);
      ctx.fillStyle = bossUnit.isNamedBoss ? '#ffe8a0' : '#ffd0d0';
      ctx.font = '9px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(bossLabel.toUpperCase(), canvas.width / 2, 74);
      if (bossUnit.bossTitle) {
        ctx.font = '7px Cinzel';
        ctx.fillStyle = 'rgba(255,180,180,0.85)';
        ctx.fillText(bossUnit.bossTitle, canvas.width / 2, 96);
      }
    }

    if (boxSelect && dragMoved) {
      const x = Math.min(boxSelect.startSx, boxSelect.endSx);
      const y = Math.min(boxSelect.startSy, boxSelect.endSy);
      const w = Math.abs(boxSelect.endSx - boxSelect.startSx);
      const h = Math.abs(boxSelect.endSy - boxSelect.startSy);
      ctx.strokeStyle = 'rgba(100,200,255,0.85)';
      ctx.fillStyle = 'rgba(100,200,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    if (creativeMode && creativeTool) {
      const label = creativeTool === 'spawn_enemy'
        ? (EnemyDefs[creativeSpawnType]?.name || creativeSpawnType)
        : (BuildDefs[creativeSpawnType]?.name || creativeSpawnType);
      ctx.strokeStyle = 'rgba(255,120,80,0.9)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy);
      ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,120,80,0.92)';
      ctx.font = '11px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(`SPAWN: ${label}`, cx, cy + 28);
    }

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f0d890';
      ctx.font = '22px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 8);
      ctx.font = '10px Cinzel';
      ctx.fillStyle = 'rgba(200,180,140,0.75)';
      ctx.fillText('Space resume · Esc menu', canvas.width / 2, canvas.height / 2 + 14);
    }
    if (typeof Perf !== 'undefined') Perf.end('draw');
  }

  function recruitCrossoverOperative(id) {
    const def = CrossoverDefs[id];
    if (!def) return false;
    if (getCrossoverOnField().includes(id)) {
      showMessage(`${def.name} is already on the field!`);
      return false;
    }
    if (!hasCrossoverBarracks(def.faction)) {
      showMessage(`Build a ${CrossoverFactions[def.faction]?.label || 'crossover'} barracks first!`);
      return false;
    }
    const costMult = typeof FactionDepth !== 'undefined' ? FactionDepth.getDeployCostMult(def.faction, wave) : 1;
    const deployCost = Math.ceil(def.cost * costMult);
    if (tactical < deployCost) {
      showMessage(`Need ${deployCost} TP to deploy ${def.name}!`);
      return false;
    }
    const base = buildings.find(b =>
      b.isCrossoverBarracks && b.complete && b.hp > 0 && b.crossoverFaction === def.faction
    );
    tactical -= deployCost;
    const u = spawnUnit(id, base?.x ?? worldW / 2, (base?.y ?? rallyY) + 18, 'player');
    applyPlayerStatMods(u);
    if (typeof FactionDepth !== 'undefined') FactionDepth.applyToUnit(u, units);
    u.targetY = rallyY;
    u.huntMode = globalHunt;
    units.push(u);
    MetaProgress.recordCrossoverRecruit(id);
    if (typeof Legacy !== 'undefined') {
      Legacy.recordFaction(def.faction);
      Legacy.recordDeploy(id);
    }
    ach('crossover_recruit', { crossoverId: id });
    if (def.jojoPart === 7 || def.combatType === 'cavalry') ach('jojo_cavalry');
    AudioEngine.SFX.deploy();
    Particles.dust(u.x, u.y);
    showMessage(`${def.name} — ${def.abilityDesc}`, 280);
    return true;
  }

  function recruitWweSuperstar(id) {
    const def = WweDefs[id];
    if (!def) return false;
    if (!hasWweAcademy()) {
      showMessage('Complete a WWE Academy on the field first!');
      return false;
    }
    if (tactical < def.cost) {
      showMessage(`Need ${def.cost} TP to sign ${def.name}!`);
      return false;
    }
    const academy = buildings.find(b => b.isWweAcademy && b.complete && b.hp > 0);
    tactical -= def.cost;
    const u = spawnUnit(id, academy?.x ?? worldW / 2, (academy?.y ?? rallyY) + 18, 'player');
    applyPlayerStatMods(u);
    u.targetY = rallyY;
    u.huntMode = globalHunt;
    units.push(u);
    if (typeof FactionDepth !== 'undefined') FactionDepth.applyToUnit(u, units);
    MetaProgress.recordWweRecruit(id);
    if (typeof Legacy !== 'undefined') {
      Legacy.recordFaction('wwe');
      Legacy.recordDeploy(id);
    }
    ach('wwe_recruit', { wweId: id });
    AudioEngine.SFX.deploy();
    Particles.dust(u.x, u.y);
    showMessage(`${def.name} — ${def.abilityDesc}`, 280);
    return true;
  }

  function applyCheatEffect(type, value) {
    if (state !== 'playing') return;
    switch (type) {
      case 'tp':
        tactical += value;
        sanitizeTactical();
        showMessage(`Cheat: +${value} TP!`, 180);
        break;
      case 'morale':
        units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
          u.morale = u.maxMorale;
          u.demoralized = false;
          u.fleeing = false;
          u.witnessDeaths = 0;
        });
        showMessage('Cheat: army morale maxed!', 180);
        break;
      case 'clear_enemies':
        units.filter(u => u.team === 'enemy').forEach(u => { u.hp = 0; });
        showMessage('Cheat: enemies eliminated!', 180);
        break;
      case 'deploy_all_free': {
        const types = ['footman','archer','mage','cavalry','healer','knight','sapper','builder','courier'];
        if (!findPlayerGeneral()) types.push('general');
        types.forEach((t, i) => {
          const u = spawnUnit(t, 60 + i * 35, deployY - 10, 'player');
          applyPlayerStatMods(u);
          u.targetY = rallyY;
          units.push(u);
        });
        showMessage('Cheat: full roster deployed!', 200);
        break;
      }
      case 'spawn_knights':
        for (let i = 0; i < (value || 1); i++) {
          const u = spawnUnit('knight', 80 + i * 40, deployY - 10, 'player');
          applyPlayerStatMods(u);
          u.targetY = rallyY;
          units.push(u);
        }
        showMessage(`Cheat: ${value} knight(s) spawned!`, 180);
        break;
      default:
        break;
    }
    ach('state_check', {
      tactical, wave, hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(), liveBuilders: countLiveBuilders(units),
    });
  }

  function getSelectedUnitsInfo() {
    const ids = selectedUnitIds.length ? selectedUnitIds : (selectedUnitId ? [selectedUnitId] : []);
    return ids.map(id => {
      const u = getUnitById(id);
      if (!u || u.hp <= 0) return null;
      const displayName = typeof getUnitDisplayName === 'function' ? getUnitDisplayName(u) : u.type;
      const roleLabel = typeof getUnitRoleLabel === 'function'
        ? getUnitRoleLabel(u)
        : (typeof getVeteranLabel === 'function' ? getVeteranLabel(u) : u.type);
      let status = '';
      if (u.demoralized) status = 'Demoralized';
      else if (u.retreatingToMed) status = 'Retreating to med tent';
      else if (u.garrisoned || u.wallGarrisoned) status = 'Garrisoned';
      else if (u.stationedKeep) status = 'Commanding Keep';
      else if (u.building && !u.building.complete) status = 'Building';
      return {
        id: u.id, type: u.type, spriteType: u.spriteType || u.type,
        displayName, roleLabel, honorName: u.honorName,
        hp: u.hp, maxHp: u.maxHp, morale: u.morale, maxMorale: u.maxMorale,
        vetBronze: u.vetBronze, vetSilver: u.vetSilver, vetGold: u.vetGold, vetTier: u.vetTier,
        perks: u.perks || [], huntMode: u.huntMode, status,
        canPromote: u.type === 'footman' && footmanEligibleForGeneral(u) && !findPlayerGeneral(),
      };
    }).filter(Boolean);
  }

  function getMinimapData() {
    const halfW = (canvas.width / viewScale) * 0.5;
    const halfH = (canvas.height / viewScale) * 0.5;
    return {
      worldW, worldH, territoryTier,
      viewX: cameraWorldX - halfW,
      viewY: cameraWorldY - halfH,
      viewW: halfW * 2,
      viewH: halfH * 2,
      units: units.filter(u => u.hp > 0).map(u => ({ x: u.x, y: u.y, team: u.team })),
      buildings: buildings.filter(b => b.hp > 0 && (b.complete || b.isSettlement)).map(b => ({
        x: b.x, y: b.y, owner: b.owner, isSettlement: b.isHamlet || b.isMerchantGuild,
      })),
    };
  }

  function panCameraToFraction(fx, fy) {
    cameraWorldX = fx * worldW;
    cameraWorldY = fy * worldH;
    applyCamera();
  }

  function focusSelection() {
    const ids = selectedUnitIds.length ? selectedUnitIds : (selectedUnitId ? [selectedUnitId] : []);
    if (!ids.length) return;
    let sx = 0, sy = 0, n = 0;
    ids.forEach(id => {
      const u = getUnitById(id);
      if (u?.hp > 0) { sx += u.x; sy += u.y; n++; }
    });
    if (!n) return;
    cameraWorldX = sx / n;
    cameraWorldY = sy / n;
    applyCamera();
  }

  function setSelectedHunt(on) {
    const ids = selectedUnitIds.length ? selectedUnitIds : (selectedUnitId ? [selectedUnitId] : []);
    ids.forEach(id => {
      const u = getUnitById(id);
      if (u?.hp > 0 && u.canHunt) u.huntMode = !!on;
    });
    showMessage(on ? 'Selected units hunting.' : 'Selected units holding position.', 140);
  }

  function toggleSelectedHunt() {
    const ids = selectedUnitIds.length ? selectedUnitIds : (selectedUnitId ? [selectedUnitId] : []);
    const anyOff = ids.some(id => { const u = getUnitById(id); return u?.canHunt && !u.huntMode; });
    setSelectedHunt(anyOff);
  }

  function restartCurrentWave() {
    if (typeof GameModes !== 'undefined' && !GameModes.canRestartWave()) {
      showMessage('Wave restart disabled — Ironman run.');
      return false;
    }
    if (state !== 'playing' || wave < 1) { showMessage('No active wave to restart.'); return false; }
    if (isNightPhase()) { showMessage('Restart wave during day assault only.'); return false; }
    units.filter(u => u.team === 'enemy').forEach(u => { u.hp = 0; });
    spawnQueue = [];
    spawnTimer = 0;
    buildSpawnQueue();
    waveProgress = 0;
    addHighlight('wave', `Wave ${wave} restarted`);
    showMessage(`Wave ${wave} restarted.`, 200);
    return true;
  }

  function serializeUnitSnap(u) {
    return {
      type: u.type, x: u.x, y: u.y, team: u.team, hp: u.hp, maxHp: u.maxHp,
      vetBronze: u.vetBronze, vetSilver: u.vetSilver, vetGold: u.vetGold, vetTier: u.vetTier,
      honorName: u.honorName, experience: u.experience, morale: u.morale, maxMorale: u.maxMorale,
      perks: u.perks ? [...u.perks] : [], huntMode: u.huntMode, generalStars: u.generalStars,
      stationedKeep: u.stationedKeep, targetY: u.targetY,
      spawnWave: u.spawnWave ?? wave, tenureApplied: u.tenureApplied ?? 0,
    };
  }

  function exportGameState() {
    if (state !== 'playing') return null;
    return {
      version: 1, savedAt: Date.now(),
      wave, tactical, kills, misses, timeOfDay, nightTimer, waveProgress,
      difficultyId, territoryTier, worldW, worldH, globalHunt, builderAutoRepair,
      tpAwardedForWave, spawnQueue: [...spawnQueue], waveEnemyTotal, spawnTimer,
      units: units.filter(u => u.hp > 0).map(serializeUnitSnap),
      buildings: buildings.map(b => ({
        type: b.type, x: b.x, y: b.y, hp: b.hp, maxHp: b.maxHp,
        complete: b.complete, owner: b.owner, buildProgress: b.buildProgress,
        isHamlet: b.isHamlet, isMerchantGuild: b.isMerchantGuild, isAcademy: b.isAcademy,
      })),
      sessionHighlights: [...sessionHighlights],
    };
  }

  function importGameState(snap) {
    if (!snap?.version) return false;
    try {
      state = 'playing';
      paused = true;
      wave = snap.wave;
      tactical = snap.tactical;
      kills = snap.kills;
      misses = snap.misses;
      timeOfDay = snap.timeOfDay;
      nightTimer = snap.nightTimer || 0;
      waveProgress = snap.waveProgress || 0;
      difficultyId = snap.difficultyId || difficultyId;
      globalHunt = snap.globalHunt ?? globalHunt;
      builderAutoRepair = snap.builderAutoRepair ?? builderAutoRepair;
      tpAwardedForWave = snap.tpAwardedForWave ?? wave;
      sessionHighlights = snap.sessionHighlights || [];
      applyWorldSize(wave);
      units = [];
      projectiles = [];
      buildings = [];
      decorations = [];
      generateBattlefield();
      for (const bs of snap.buildings || []) {
        const b = createBuilding(bs.type, bs.x, bs.y, bs.owner || 'player');
        Object.assign(b, bs);
        if (bs.complete) b.complete = true;
        buildings.push(b);
      }
      for (const us of snap.units || []) {
        const u = createUnit(us.type, us.x, us.y, us.team || 'player');
        Object.assign(u, us);
        if (u.spawnWave == null) u.spawnWave = wave;
        if (u.tenureApplied == null) u.tenureApplied = 0;
        u.hp = Math.min(u.maxHp, us.hp);
        if (u.isGeneral == null) u.isGeneral = u.type === 'general';
        if (typeof repairHonorName === 'function') repairHonorName(u);
        units.push(u);
      }
      spawnQueue = [...(snap.spawnQueue || [])];
      waveEnemyTotal = snap.waveEnemyTotal || spawnQueue.length;
      spawnTimer = snap.spawnTimer || 0;
      sanitizeTactical();
      invalidateObstacles();
      resetCamera();
      spatialFrame = -1;
      if (typeof UX !== 'undefined') UX.onPauseChanged(true);
      return true;
    } catch (_) {
      return false;
    }
  }

  function quickSave() {
    if (creativeMode) {
      showMessage('Quick save disabled in Creative Mode.');
      return false;
    }
    if (typeof GameModes !== 'undefined' && !GameModes.canQuickSave()) {
      showMessage('Quick save disabled — Ironman or challenge run.');
      return false;
    }
    const snap = exportGameState();
    if (!snap) { showMessage('Cannot save now.'); return false; }
    try {
      localStorage.setItem(QUICKSAVE_KEY, JSON.stringify(snap));
      showMessage(`Quick saved at wave ${wave}.`, 200);
      return true;
    } catch (_) {
      showMessage('Quick save failed.', 160);
      return false;
    }
  }

  function getQuickSaveMeta() {
    try {
      const raw = localStorage.getItem(QUICKSAVE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      return { wave: snap.wave, savedAt: snap.savedAt };
    } catch (_) { return null; }
  }

  function hasQuickSave() {
    return !!getQuickSaveMeta();
  }

  function quickLoad() {
    if (typeof GameModes !== 'undefined' && !GameModes.canQuickSave()) {
      showMessage('Quick load disabled — Ironman or challenge run.');
      return false;
    }
    try {
      const raw = localStorage.getItem(QUICKSAVE_KEY);
      if (!raw) { showMessage('No quick save found.'); return false; }
      const snap = JSON.parse(raw);
      if (!importGameState(snap)) { showMessage('Quick load failed.', 160); return false; }
      showMessage(`Quick load: wave ${wave}.`, 240);
      return true;
    } catch (_) {
      showMessage('Quick load failed.', 160);
      return false;
    }
  }

  function quitToMenu() {
    if (typeof GameModes !== 'undefined') GameModes.endSession();
    state = 'menu';
    paused = false;
    AudioEngine.stopMusic();
    document.getElementById('menu-screen')?.classList.add('active');
    AudioEngine.resume().then((ok) => { if (ok) AudioEngine.startMenuMusic?.(); });
    if (typeof UX !== 'undefined') {
      UX.clearTutorialHighlights?.();
      UX.onPauseChanged(false);
    }
  }

  function getSessionHighlights() {
    return [...sessionHighlights];
  }

  function getState() {
    const army = units.filter(u => u.team === 'player' && u.hp > 0).length;
    return {
      state, tactical, maxTactical: null, wave, totalWaves: null, infiniteWaves: true,
      kills, misses,
      missLimit: creativeMode && creativeSettings.noGameOver ? 999 : getMissLimit(),
      creativeMode, creativeTool, creativeSpawnType,
      creativeSettings: { ...creativeSettings },
      difficulty: difficultyId,
      difficultyLabel: getDifficulty().label,
      difficultyPercent: getDifficultyPercent(),
      gameMode: typeof GameModes !== 'undefined' ? GameModes.getSession() : null,
      scalingTips: typeof GameModes !== 'undefined'
        ? GameModes.getScalingAdvice(wave, getDifficultyPercent(), difficultyId)
        : [],
      messages,
      selectedDeploy, selectedAbility, selectedBuild, selectedCourierMsg,
      selectedDemolish, selectedMoveBuilding, selectedRotateWall, pendingWallFacing,
      moveBuildingTarget: moveBuildingTarget?.id ?? null,
      moveBuildingType: moveBuildingTarget?.type ?? null,
      selectedUnitId, selectedUnitIds, paused, gameSpeed, globalHunt, spyNetwork, courierCooldown,
      hasCourier: hasCourier(),
      courierUsedThisWave, spyUsedThisWave,
      army,
      enemyCount: units.filter(u => u.team === 'enemy' && u.hp > 0).length,
      buildingCount: buildings.filter(b => b.hp > 0).length,
      waveProgress, tpPerRound: getTpPerRound(), rallyActive: rallyTimer > 0,
      generalBuff: Math.round(getGeneralBuffStrength() * 100),
      generalAura: getGeneralAura(),
      hasGeneral: !!findPlayerGeneral(),
      generalStationed: !!getStationedGeneral(),
      generalThreat: generalThreatCount,
      lastStandActive,
      nextWaveIntel,
      colonyValue: colonySnapshot?.total ?? 0,
      colonyThreatRatio: colonySnapshot?.threatRatio ?? 1,
      colonyThreatTier: colonySnapshot?.tier?.label ?? '—',
      colonyBreakdown: colonySnapshot?.breakdown ?? null,
      colonyThreatMods,
      settlementTpRaw: getRawSettlementTpBonus(),
      settlementTpCapped: getSettlementTpBonus(),
      hybridAcademy: typeof GameDepth !== 'undefined' && GameDepth.isHybridAcademyDeploy?.(),
      builderAutoRepair,
      attackSides: getWaveAttackSides(),
      unlockedAttackSides: getUnlockedAttackSides(wave),
      bossActive: units.some(u => u.team === 'enemy' && u.hp > 0 &&
        (u.isNamedBoss || u.type === 'war_chief' || (typeof isMonsterEnemy === 'function' && isMonsterEnemy(u)))),
      namedBoss: namedBossWave?.name || null,
      territoryTier, worldW, worldH,
      academyEra: isAcademyEraActive(), canDeploy: canDeployWithTP(),
      rtsEra: isRtsEra(wave), enemyRtsEra: isEnemyRtsEra(wave),
      settlementTpBonus: getSettlementTpBonus(),
      liveBuilders: countLiveBuilders(units),
      hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(),
      hasWweAcademy: hasWweAcademy(),
      wweUnlocked: (creativeMode && creativeSettings.unlockAll) || MetaProgress.isWweUnlocked(),
      doomslayerUnlocked: (creativeMode && creativeSettings.unlockAll) || MetaProgress.isDoomslayerHeroUnlocked(),
      crossoverUnlocked: (creativeMode && creativeSettings.unlockAll) || MetaProgress.isAnyCrossoverUnlocked(),
      perksUnlocked: (creativeMode && creativeSettings.unlockAll) ||
        (typeof Perks !== 'undefined' && Perks.perkMachinesUnlocked()),
      wweOnField: getWweOnField(),
      crossoverOnField: getCrossoverOnField(),
      crossoverBuildings: getCrossoverBuildingsOnField(),

      timeOfDay, dayLight: getDayLightLevel(),
      nightProgress: isNightPhase() ? nightTimer / getNightPrepTicks() : 0,
      nightPrepTicks: getNightPrepTicks(),
      nightSecondsLeft: getNightSecondsRemaining(),
      nightPrepSeconds: typeof NIGHT_PREP_SECONDS !== 'undefined' ? NIGHT_PREP_SECONDS : 60,
      buildableAcademies: ACADEMY_BUILD_TYPES.filter(t => canBuildAcademyType(t, wave, units)),
      loadout: typeof ContentExpansion !== 'undefined' ? ContentExpansion.getLoadout() : 'balanced',
      loadouts: typeof ContentExpansion !== 'undefined' ? ContentExpansion.getLoadouts() : {},
      waveEvent: typeof ContentExpansion !== 'undefined' ? ContentExpansion.getWaveEvent() : null,
      factionSynergies: typeof FactionDepth !== 'undefined' ? FactionDepth.getActiveSynergies().map(s => s.name) : [],
      seasonalEvent: typeof FactionDepth !== 'undefined' ? FactionDepth.getSeasonalEvent()?.name : null,
      achievements: typeof Achievements !== 'undefined' ? Achievements.getCount() : { unlocked: 0, total: 1450 },
      factionMasteryTitles: typeof MetaProgress !== 'undefined' ? MetaProgress.getFactionMasteryTitles() : {},
      creativeFactionSkins: typeof MetaProgress !== 'undefined' ? MetaProgress.getEarnedCreativeUnlocks() : {},
      creativeCustomWave: creativeCustomWave ? { ...creativeCustomWave, count: creativeCustomWave.queue?.length } : null,
      sandboxStats: typeof CreativeTools !== 'undefined' ? CreativeTools.getSandboxStats() : null,
      replayInfo: typeof CreativeTools !== 'undefined' ? CreativeTools.getReplayInfo() : null,
      updateTick,
      enemyCount: countEnemies(),
      buildingCount: buildings.filter(b => b.hp > 0).length,
    };
  }

  function isPlaying() {
    return state === 'playing';
  }

  function toggleBuilderAutoRepair() {
    builderAutoRepair = !builderAutoRepair;
    showMessage(`Builder auto-repair: ${builderAutoRepair ? 'ON' : 'OFF'}`, 160);
    return builderAutoRepair;
  }

  return {
    init, start, update, draw, handleClick, isPlaying,
    selectDeploy, selectAbility, selectBuild, selectDemolish, selectMoveBuilding, selectRotateWall,
    cycleWallPlacementFacing, selectCourierMessage,
    executeSpyAction, sendCourierMessage, toggleGlobalHunt, toggleHunt,
    toggleBuilderAutoRepair,
    clearSelection, clearPlacementMode, togglePause, setPaused, getState, endGame,
    getGameSpeed, setGameSpeed, cycleGameSpeed, getSimulationSteps, GAME_SPEED_OPTIONS,
    getSelectedUnitsInfo, getMinimapData, panCameraToFraction, focusSelection,
    setSelectedHunt, toggleSelectedHunt, restartCurrentWave,
    quickSave, quickLoad, hasQuickSave, getQuickSaveMeta, quitToMenu, getSessionHighlights,
    exportGameState, importGameState,
    setDifficulty, getDifficultyId: () => difficultyId,
    recruitWweSuperstar, recruitCrossoverOperative, applyCheatEffect, getDifficultyPercent,
    beginDayPhase, isDayPhase, isNightPhase,
    isCreativeMode, startCreative, setCreativeSetting, applyCampaignRulesPreset,
    creativeSetTool, creativeSetWave, creativeSetTp, creativeAddTp,
    creativeForceNight, creativeForceDay, creativeStartWave, creativeLaunchCustomWave,
    setCustomWave, getCustomWave,
    creativeClearWaveSpawns, creativeClearEnemies, creativeClearEnemyBuildings,
    creativeHealAll, creativeMaxMorale, creativeRankUpSelected, creativeMaxStarsSelected,
    creativeHealSelected, creativeKillSelected, creativePromoteSelectedGeneral,
    creativeSpawnEnemyAt, creativeSpawnPlayerAt, creativeSpawnPlayerBuildingAt, creativeSpawnSquadAt,
    creativeResetUnitToDef, creativeApplyStatEditor, creativeFillStatEditorFromSelection,
    creativeRegenerateMap,
    applyCreativeUnitPreset, applyCreativeUnitStats,
    getUnitsSnapshot, getBuildingsSnapshot, restoreCreativeSnapshot,
    getWorldCenter, randomMapEdgePos, countEnemies, showMessage,
    getUnitById,
    handlePointerDown, handlePointerMove, handlePointerUp, zoomCameraAt, setCameraKey, onSettingsChanged,
    wasDragPan: () => dragMoved,
    setLoadout: (id) => typeof ContentExpansion !== 'undefined' && ContentExpansion.setLoadout(id),
    getLoadout: () => typeof ContentExpansion !== 'undefined' ? ContentExpansion.getLoadout() : 'balanced',
    getLoadouts: () => typeof ContentExpansion !== 'undefined' ? ContentExpansion.getLoadouts() : {},
  };
})();