/**
 * Pure spawn-queue fill — shared by main thread and path-worker.js.
 */
const WaveCompositionCore = (() => {
  function mulberry32(seed) {
    let a = (Number(seed) || 0) >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildWeightedSpawnQueue(opts) {
    if (!opts || typeof opts !== 'object') return [];
    const count = Math.max(0, opts.count | 0);
    if (count <= 0) return [];

    const pool = Array.isArray(opts.pool) ? opts.pool.filter((t) => t != null && t !== '') : [];
    const elites = Array.isArray(opts.elites) ? opts.elites : [];
    const weights = opts.weights && typeof opts.weights === 'object' ? opts.weights : {};
    const noElites = !!opts.noElites;
    const rng = typeof opts.rng === 'function' ? opts.rng : mulberry32(opts.seed || 1);

    let pickPool = pool;
    if (noElites && elites.length) {
      const eliteSet = new Set(elites);
      pickPool = pool.filter((t) => !eliteSet.has(t));
      // Fall back to full pool if filtering wiped everything (avoids empty waves).
      if (!pickPool.length) pickPool = pool;
    }
    if (!pickPool.length) return [];

    // Cumulative weights — clamp to positive so zero/negative weight entries don't break rolls.
    const weightCaps = new Array(pickPool.length);
    let weightTotal = 0;
    let anyCustom = false;
    for (let i = 0; i < pickPool.length; i++) {
      const raw = weights[pickPool[i]];
      if (raw != null && raw !== 1) anyCustom = true;
      const w = Math.max(1, Math.floor((Number(raw) || 1) * 10));
      weightTotal += w;
      weightCaps[i] = weightTotal;
    }

    const queue = new Array(count);
    let qLen = 0;
    for (let i = 0; i < count; i++) {
      let pick = null;
      if (anyCustom && weightTotal > 0) {
        const roll = Math.floor(rng() * weightTotal);
        for (let j = 0; j < pickPool.length; j++) {
          if (roll < weightCaps[j]) {
            pick = pickPool[j];
            break;
          }
        }
        // Floating-edge: roll == weightTotal-1 always hits last cap; defensive fallback.
        if (pick == null) pick = pickPool[pickPool.length - 1];
      } else {
        const idx = Math.floor(rng() * pickPool.length);
        pick = pickPool[Math.min(pickPool.length - 1, Math.max(0, idx))];
      }
      if (pick != null) queue[qLen++] = pick;
    }
    queue.length = qLen;
    return queue;
  }

  return { buildWeightedSpawnQueue, mulberry32 };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.WaveCompositionCore = WaveCompositionCore;
