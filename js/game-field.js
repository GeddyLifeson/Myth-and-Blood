/**
 * Battlefield generation, terrain checks, obstacle and spatial caches, line of sight.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameField = (() => {
  const {
    DECO_GAP,
    isBehindWall,
    isPlayerFriendlyWall,
    overlapsPlacedDecorations,
    posDistSq,
    svc,
    unitFootprint,
  } = GameCore;
  const GS = GameState;
  let TP_SANITY_CAP,
    applyWorldSize,
    clearSiegeLink,
    isBlocked,
    isInView,
    isMarchingToWallSlot,
    isTerrainBlocked,
    isTerrainBlockedForPath,
    releaseFromGarrison,
    releaseFromKeep,
    releaseFromWallGarrison;
  function bind(api) {
    ({
      TP_SANITY_CAP,
      applyWorldSize,
      clearSiegeLink,
      isBlocked,
      isInView,
      isMarchingToWallSlot,
      isTerrainBlocked,
      isTerrainBlockedForPath,
      releaseFromGarrison,
      releaseFromKeep,
      releaseFromWallGarrison,
    } = api);
  }

  function getMapBounds() {
    return { minX: 14, maxX: GS.worldW - 14, minY: 20, maxY: GS.worldH - 8 };
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
      const x = 50 + (globalThis.simRandom || Math.random)() * (GS.worldW - 100);
      const y = 80 + (globalThis.simRandom || Math.random)() * (GS.worldH - 160);
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
   * A clear spot in no-man's-land: between the muster zone's top and the ground the
   * player builds on, away from the field edges.
   */
  function pickFieldSpot(placed, radius, maxAttempts = 30) {
    const top = 70;
    const bottom = Math.max(top + 60, GS.rallyY - 130);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = 40 + (globalThis.simRandom || Math.random)() * (GS.worldW - 80);
      const y = top + (globalThis.simRandom || Math.random)() * (bottom - top);
      if (isDecorationSpotClear(x, y, radius, placed)) return { x, y, radius };
    }
    return null;
  }

  /** Moves every world-space object by (dx, dy). Used to fit a save from a grown map. */
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
      if (Number.isFinite(o.postX)) o.postX += dx;
      if (Number.isFinite(o.postY)) o.postY += dy;
      if (Array.isArray(o.postPath)) {
        for (const p of o.postPath) {
          p.x += dx;
          p.y += dy;
        }
      }
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
    if (typeof SapperKit !== 'undefined') SapperKit.shift(dx, dy);
    GS.cameraWorldX += dx;
    GS.cameraWorldY += dy;
  }

  /**
   * The field does not grow, but the war still changes it: each new land tier leaves a
   * few crates, barrels and a beast den in no-man's-land. Each kind is capped so the one
   * field never silts up.
   */
  function seedTerritoryFeatures() {
    const placed = [...GS.decorations];
    const live = (test) => GS.decorations.filter((d) => d.hp > 0 && test(d)).length;
    if (GS.territoryTier >= 1) {
      const destTypes = ['supply_crate', 'oil_barrel'];
      const room = 4 - live((d) => destTypes.includes(d.type));
      const destCount = Math.min(room, 1 + Math.floor(GS.territoryTier / 3));
      for (let i = 0; i < destCount; i++) {
        const t = destTypes[i % destTypes.length];
        const spot = pickFieldSpot(placed, 14);
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
      const room = 2 - live((d) => d.isNeutralDen);
      const denCount = Math.min(room, 1 + Math.floor(GS.territoryTier / 4));
      for (let i = 0; i < denCount; i++) {
        const spot = pickFieldSpot(placed, 18);
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
    invalidateObstacles();
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

  /**
   * The field is one size for the whole run. What changes with the waves is the land
   * tier, which gates hazards, wildlife and the features left in no-man's-land.
   */
  function syncTerritory(opts = {}) {
    if (GS.wave <= 0) return false;
    const prevTier = GS.territoryTier;
    applyWorldSize(GS.wave);
    if (GS.territoryTier <= prevTier) return false;
    if (!opts.skipTerrain) seedTerritoryFeatures();
    return true;
  }

  /** One-time full-field terrain roll (wave 1). The field keeps this size and terrain. */
  function generateBattlefield() {
    const preserved = GS.decorations.filter((d) => d.type === 'barricade' && d.hp > 0);
    GS.decorations = [...preserved];
    const types = ['tree', 'tree', 'rock'];
    const placed = [...preserved];
    const decoCount = 8 + GS.territoryTier * 3;

    for (let i = 0; i < decoCount; i++) {
      const t = types[Math.floor((globalThis.simRandom || Math.random)() * types.length)];
      const spot = pickDecorationSpot(t, placed);
      if (!spot) continue;

      const deco = {
        type: t,
        id: 'deco_' + i,
        x: spot.x,
        y: spot.y,
        size:
          t === 'tree'
            ? 18 + (globalThis.simRandom || Math.random)() * 10
            : 12 + (globalThis.simRandom || Math.random)() * 6,
        hp: 999,
        blocksMove: true,
        blocksLOS: true,
        cover: t === 'rock' ? 0.3 : 0.45,
        radius: spot.radius,
      };
      GS.decorations.push(deco);
      placed.push(deco);
    }

    if (typeof ProcGenObstacles !== 'undefined') {
      const session = svc('GameModes') ? svc('GameModes').getSession() : null;
      const rocks = ProcGenObstacles.fieldOutcrops({
        worldW: GS.worldW,
        rallyY: GS.rallyY,
        seed: session?.seed ?? Math.floor((globalThis.simRandom || Math.random)() * 1e9),
        placed,
      });
      GS.decorations.push(...rocks);
      placed.push(...rocks);
    }

    if (svc('GameDepth')) {
      const hazCtx = {};
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
      svc('NeutralWildlife').seedDens(
        GS.decorations,
        GS.worldW,
        GS.worldH,
        GS.rallyY,
        GS.territoryTier
      );
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
    if (spatialInterval > 1 && GS.spatialFrame >= 0 && GS.updateTick % spatialInterval !== 0)
      return;
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
    return GS.cachedSelectedSet
      ? GS.cachedSelectedSet.has(u.id)
      : GS.selectedUnitIds.includes(u.id);
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
        const losR = typeof terrainLosRadius === 'function' ? terrainLosRadius(d) : moveR;
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
        const losR = typeof terrainLosRadius === 'function' ? terrainLosRadius(b) : moveR;
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
    GS.livingPlanetCtxCache = {
      worldW: GS.worldW,
      worldH: GS.worldH,
      baseW: BASE_FIELD_W,
      baseH: BASE_FIELD_H,
      territoryTier: GS.territoryTier,
      wave: GS.wave,
      hostileLineY: null,
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

  return {
    bind,
    allObstacles,
    buildUpdateThrottleCtx,
    clampPos,
    engagerCache,
    ensureInitialBattlefield,
    generateBattlefield,
    getBiomeModifiersAt,
    getCoverAt,
    getIncompleteBuildSig,
    getLivingPlanetCtx,
    getWallProtection,
    gfxOverlayFor,
    invalidateObstacles,
    isHordeWave,
    isSiegeWave,
    isUnitSelected,
    lineOfSight,
    obstacleBlocksForUnit,
    purgeDeadUnits,
    rebuildSpatialIndex,
    releaseAllBuildings,
    releaseAllUnits,
    resetTerrainForNewRun,
    resolveUnitsInTerrain,
    sanitizeTactical,
    shiftWorldEntities,
    syncTerritory,
    tacticalTargetCache,
    unitById,
    useSpatialQueries,
  };
})();
