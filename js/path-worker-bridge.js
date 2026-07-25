/**
 * Main-thread bridge to path-worker.js — async pathfinding and spawn prefetch.
 */
const PathWorkerBridge = (() => {
  const MAX_ASYNC_PATHS = 24;
  const PROFILE_ORDER = ['PS', 'PL', 'ES', 'EL'];

  let worker = null;
  let ready = false;
  let gridsReady = false;
  let gridGen = 0;
  let pathGridGen = 0;
  let reqId = 0;

  const pendingPaths = new Set();
  const pathResults = [];
  const pendingSpawn = new Map();
  let prefetchedSpawn = null;

  function workerUrl() {
    if (typeof document !== 'undefined') {
      const scripts = document.querySelectorAll('script[src]');
      for (const s of scripts) {
        const src = s.getAttribute('src') || '';
        if (
          src.includes('path-worker-bridge') ||
          src.includes('game.js') ||
          src.includes('game.bundle')
        ) {
          const base = src.replace(/[^/]+$/, '');
          return `${base}path-worker.js`;
        }
      }
    }
    return 'js/path-worker.js';
  }

  function isSupported() {
    return typeof Worker !== 'undefined';
  }

  function init(worldW, worldH) {
    if (!isSupported()) return false;
    // Re-init (map resize / load) must kill the previous worker or orphan threads
    // keep posting into handleMessage and corrupt path results.
    if (worker) shutdown();
    try {
      worker = new Worker(workerUrl());
      worker.onmessage = handleMessage;
      worker.onerror = (err) => {
        if (typeof ErrorReporting !== 'undefined') {
          ErrorReporting.captureException(err?.message || 'path-worker error', {
            subsystem: 'pathWorker',
            label: 'PathWorkerBridge.onerror',
          });
          ErrorReporting.disableSubsystem('pathWorker', 'worker crashed');
        }
        shutdown();
      };
      worker.postMessage({ type: 'init', worldW, worldH });
      return true;
    } catch {
      worker = null;
      ready = false;
      return false;
    }
  }

  function handleMessage(e) {
    const msg = e.data;
    if (msg.type === 'ready') ready = true;
    if (msg.type === 'gridsAck') {
      gridsReady = true;
      gridGen = msg.gen || gridGen;
    }
    if (msg.type === 'path') {
      pendingPaths.delete(msg.id);
      pathResults.push({ ...msg, gen: msg.gen ?? pathGridGen });
    }
    if (msg.type === 'spawnQueue') {
      const pending = pendingSpawn.get(msg.id);
      if (pending) {
        pendingSpawn.delete(msg.id);
        prefetchedSpawn = { wave: msg.wave, queue: msg.queue, key: pending.key };
        pending.resolve?.(msg.queue);
      }
    }
  }

  function isReady() {
    return !!worker && ready;
  }

  function gridsAreReady() {
    return isReady() && gridsReady;
  }

  function postWalkGrids(grids, gen) {
    if (!worker || !ready) return;
    const payload = {};
    const transfers = [];
    for (const profile of PROFILE_ORDER) {
      const grid = grids[profile];
      if (!grid) continue;
      // Clone before transfer — posting detaches buffers and would break main-thread sync paths.
      const copy = new Uint8Array(grid);
      payload[profile] = copy.buffer;
      transfers.push(copy.buffer);
    }
    pathGridGen = gen || pathGridGen + 1;
    gridGen = pathGridGen;
    // Drop in-flight path jobs; game.js must clear unit.pathPending when this runs.
    pendingPaths.clear();
    pathResults.length = 0;
    gridsReady = false;
    worker.postMessage({ type: 'setGrids', grids: payload, gen: pathGridGen }, transfers);
  }

  function cancelPendingPaths() {
    // Caller (invalidateObstacles) clears unit.pathPending — worker jobs are orphaned here.
    pendingPaths.clear();
    pathResults.length = 0;
  }

  function getGridGen() {
    return pathGridGen;
  }

  function shouldAsyncPath(unit, pathOpts = {}) {
    if (!gridsAreReady()) return false;
    if (pathOpts.force || pathOpts.sync) return false;
    if (!unit || unit.hp <= 0) return false;
    // Enemy AI must path synchronously — async results are dropped across wave/grid
    // invalidation and leave units pathPending with empty paths for dozens of ticks.
    if (unit.team === 'enemy') return false;
    if (unit.team === 'player' || unit.manualOrder) return false;
    if (pendingPaths.size >= MAX_ASYNC_PATHS) return false;
    return true;
  }

  function normalizeWalkProfile(profile) {
    const legacy = { BS: 'ES', BL: 'EL', PS: 'PS', PL: 'PL', ES: 'ES', EL: 'EL' };
    return legacy[profile] || profile;
  }

  function requestPath(opts) {
    if (!worker || !ready) return 0;
    const id = ++reqId;
    pendingPaths.add(id);
    worker.postMessage({
      type: 'findPath',
      id,
      unitId: opts.unitId,
      profile: normalizeWalkProfile(opts.profile),
      sx: opts.sx,
      sy: opts.sy,
      ex: opts.ex,
      ey: opts.ey,
      maxNodes: opts.maxNodes,
      gen: pathGridGen,
    });
    return id;
  }

  function drainPathResults() {
    if (!pathResults.length) return [];
    const out = pathResults.slice();
    pathResults.length = 0;
    return out;
  }

  function prefetchSpawnQueue(payload) {
    if (!worker || !ready) return null;
    const id = ++reqId;
    const key = `${payload.wave}:${payload.count}:${payload.seed}`;
    pendingSpawn.set(id, { key });
    worker.postMessage({
      type: 'buildSpawnQueue',
      id,
      wave: payload.wave,
      count: payload.count,
      pool: payload.pool,
      weights: payload.weights,
      elites: payload.elites,
      noElites: payload.noElites,
      seed: payload.seed,
    });
    return id;
  }

  function takePrefetchedSpawnQueue(wave, key) {
    if (!prefetchedSpawn || prefetchedSpawn.wave !== wave) return null;
    if (key && prefetchedSpawn.key !== key) return null;
    const queue = prefetchedSpawn.queue;
    prefetchedSpawn = null;
    return queue;
  }

  function shutdown() {
    if (worker) worker.terminate();
    worker = null;
    ready = false;
    gridsReady = false;
    pendingPaths.clear();
    pathResults.length = 0;
    pendingSpawn.clear();
    prefetchedSpawn = null;
  }

  return {
    init,
    shutdown,
    isSupported,
    isReady,
    gridsAreReady,
    postWalkGrids,
    cancelPendingPaths,
    getGridGen,
    shouldAsyncPath,
    requestPath,
    drainPathResults,
    prefetchSpawnQueue,
    takePrefetchedSpawnQueue,
    PROFILE_ORDER,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.PathWorkerBridge = PathWorkerBridge;
