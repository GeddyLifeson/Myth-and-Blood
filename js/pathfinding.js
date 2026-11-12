/**
 * Grid A* pathfinding — terrain blocking, LRU cache, walk grids for worker offload.
 */
const Pathfinding = (() => {
  const CELL = PathfindingCore.CELL;
  let gridW = 0;
  let gridH = 0;
  let cacheGen = 0;
  const pathCache = new Map();
  const PATH_CACHE_MAX = 1024;
  const walkGrids = {};
  let walkGridGen = 0;
  let staggerPhase = 0;
  const PROFILE_KEYS = ['PS', 'PL', 'ES', 'EL'];
  const STAGGER_BATCHES = [
    ['PS', 'PL'],
    ['ES', 'EL'],
  ];

  const PROFILE_UNITS = {
    PS: { team: 'player', combatType: 'melee' },
    PL: { team: 'player', combatType: 'cavalry' },
    ES: { team: 'enemy', combatType: 'melee' },
    EL: { team: 'enemy', type: 'siege_tower', combatType: 'melee' },
  };

  function init(worldW, worldH) {
    const dims = PathfindingCore.init(worldW, worldH);
    gridW = dims.gridW;
    gridH = dims.gridH;
    clearCache();
    invalidateWalkGrids();
  }

  function clearCache() {
    cacheGen++;
    pathCache.clear();
  }

  function invalidateWalkGrids() {
    walkGridGen++;
    staggerPhase = 0;
    for (const k of PROFILE_KEYS) delete walkGrids[k];
  }

  /** Canonical keys must match PROFILE_UNITS and path-worker walk grids (PS/PL/ES/EL). */
  function getWalkProfile(unit) {
    const large = unit?.combatType === 'cavalry' || unit?.type === 'siege_tower';
    if (unit?.team === 'player') return large ? 'PL' : 'PS';
    return large ? 'EL' : 'ES';
  }

  function toCell(x, y) {
    return PathfindingCore.toCell(x, y);
  }

  function toWorld(cx, cy) {
    return PathfindingCore.toWorld(cx, cy);
  }

  function cacheKey(sx, sy, ex, ey, unit) {
    const s = toCell(sx, sy);
    const e = toCell(ex, ey);
    const footprint = unit?.combatType === 'cavalry' || unit?.type === 'siege_tower' ? 'L' : 'S';
    const wallPass = unit?.team === 'player' ? 'P' : 'B';
    return `${cacheGen}|${walkGridGen}|${s.cx},${s.cy}|${e.cx},${e.cy}|${footprint}|${wallPass}`;
  }

  function storeCache(k, path) {
    if (pathCache.size >= PATH_CACHE_MAX && !pathCache.has(k)) {
      const first = pathCache.keys().next().value;
      pathCache.delete(first);
    }
    // Re-set moves key to newest position (true LRU, not FIFO).
    if (pathCache.has(k)) pathCache.delete(k);
    pathCache.set(k, path);
  }

  function touchCache(k) {
    if (!pathCache.has(k)) return null;
    const path = pathCache.get(k);
    pathCache.delete(k);
    pathCache.set(k, path);
    return path;
  }

  function clonePath(path) {
    if (!path?.length) return [];
    // Fresh points — callers mutate unit.path freely; never share cache storage.
    const out = new Array(path.length);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      out[i] = { x: p.x, y: p.y };
    }
    return out;
  }

  function buildWalkGrid(isTerrainBlockedFn, unit) {
    if (!gridW || !gridH || typeof isTerrainBlockedFn !== 'function') {
      return new Uint8Array(0);
    }
    const blocked = new Uint8Array(gridW * gridH);
    for (let cy = 0; cy < gridH; cy++) {
      const row = cy * gridW;
      for (let cx = 0; cx < gridW; cx++) {
        const { x, y } = toWorld(cx, cy);
        if (isTerrainBlockedFn(x, y, unit)) blocked[row + cx] = 1;
      }
    }
    return blocked;
  }

  function rebuildWalkGrids(isTerrainBlockedFn, opts = {}) {
    if (!isTerrainBlockedFn || !gridW || !gridH) return null;
    const profiles = opts.profiles || PROFILE_KEYS;
    const stagger = !!opts.stagger;
    for (const profile of profiles) {
      const stub = PROFILE_UNITS[profile] || PROFILE_UNITS.ES;
      walkGrids[profile] = buildWalkGrid(isTerrainBlockedFn, stub);
    }
    if (!stagger || profiles.length >= PROFILE_KEYS.length) {
      walkGridGen++;
      staggerPhase = 0;
      if (typeof PathWorkerBridge !== 'undefined' && PathWorkerBridge.isReady()) {
        PathWorkerBridge.postWalkGrids(walkGrids, walkGridGen);
      }
    } else {
      // Partial batch: do not bump walkGridGen until a full cycle completes,
      // so cache keys stay coherent with the mixed new/old profile set.
      staggerPhase = (staggerPhase + 1) % STAGGER_BATCHES.length;
      if (staggerPhase === 0) {
        walkGridGen++;
        if (typeof PathWorkerBridge !== 'undefined' && PathWorkerBridge.isReady()) {
          PathWorkerBridge.postWalkGrids(walkGrids, walkGridGen);
        }
      }
      // Mid-cycle: still push partial grids so the worker can path PS/PL early,
      // but keep pathGridGen stable until full set is ready (bridge uses gen arg).
      else if (typeof PathWorkerBridge !== 'undefined' && PathWorkerBridge.isReady()) {
        PathWorkerBridge.postWalkGrids(walkGrids, walkGridGen);
      }
    }
    return walkGrids;
  }

  function rebuildWalkGridsStaggered(isTerrainBlockedFn, unitCount = 0) {
    if (unitCount > 55) {
      const batch = STAGGER_BATCHES[staggerPhase % STAGGER_BATCHES.length];
      return rebuildWalkGrids(isTerrainBlockedFn, { profiles: batch, stagger: true });
    }
    return rebuildWalkGrids(isTerrainBlockedFn);
  }

  function walkGridUsable(grid) {
    if (!grid || !grid.length) return false;
    if (grid.length < gridW * gridH) return false;
    try {
      const buf = grid.buffer;
      return buf && buf.byteLength >= grid.byteLength;
    } catch {
      return false;
    }
  }

  function ensureWalkGrid(profile, unit, isTerrainBlockedFn) {
    if (!walkGridUsable(walkGrids[profile])) {
      // Prefer canonical profile stub so on-demand grids match rebuildWalkGrids.
      const stub = PROFILE_UNITS[profile] || unit;
      walkGrids[profile] = buildWalkGrid(isTerrainBlockedFn, stub);
    }
    return walkGrids[profile];
  }

  function findPath(startX, startY, endX, endY, unit, isTerrainBlockedFn, opts = {}) {
    if (typeof isTerrainBlockedFn !== 'function' || !gridW || !gridH) return [];
    const ck = cacheKey(startX, startY, endX, endY, unit);
    if (!opts.skipCache) {
      const hit = touchCache(ck);
      if (hit) return clonePath(hit);
    }

    const profile = getWalkProfile(unit);
    const grid = ensureWalkGrid(profile, unit, isTerrainBlockedFn);
    if (!walkGridUsable(grid)) return [];

    const path = PathfindingCore.findPathOnGrid(grid, startX, startY, endX, endY, opts.maxNodes);
    if (path.length) storeCache(ck, path);
    return clonePath(path);
  }

  function isStaggeredRebuildComplete() {
    return staggerPhase === 0;
  }

  return {
    init,
    findPath,
    clearCache,
    invalidateWalkGrids,
    rebuildWalkGrids,
    rebuildWalkGridsStaggered,
    isStaggeredRebuildComplete,
    getWalkProfile,
    CELL,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Pathfinding = Pathfinding;
