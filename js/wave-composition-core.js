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

  /** Fisher-Yates with the caller's rng, in place. */
  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  }

  /**
   * Split `total` bodies between weighted entries by largest remainder, so the same
   * weights always give the same head count. Every entry gets at least one body while
   * there are bodies to give; `cap` (optional, per entry) is a hard ceiling.
   * @param {{type: string, w: number, cap?: number}[]} entries
   * @returns {Object<string, number>} head count by type
   */
  function apportion(entries, total) {
    const out = {};
    const live = (entries || []).filter((e) => e && e.type && e.w > 0);
    let left = Math.max(0, total | 0);
    if (!live.length || left <= 0) return out;
    const sum = live.reduce((a, e) => a + e.w, 0);
    const rows = live.map((e, i) => {
      const exact = (e.w / sum) * left;
      const cap = e.cap > 0 ? e.cap : Infinity;
      return { e, i, n: Math.min(cap, Math.floor(exact)), frac: exact - Math.floor(exact), cap };
    });
    let used = rows.reduce((a, r) => a + r.n, 0);
    // A type that is in the host at all shows up at least once.
    for (const r of rows) {
      if (used >= left) break;
      if (r.n === 0 && r.cap >= 1) {
        r.n = 1;
        used++;
      }
    }
    const byFrac = rows.slice().sort((a, b) => b.frac - a.frac || a.i - b.i);
    let guard = left * 4 + 8;
    while (used < left && guard-- > 0) {
      let gave = false;
      for (const r of byFrac) {
        if (used >= left) break;
        if (r.n >= r.cap) continue;
        r.n++;
        used++;
        gave = true;
      }
      if (!gave) break;
    }
    for (const r of rows) if (r.n > 0) out[r.e.type] = r.n;
    return out;
  }

  /**
   * Build a host led by one faction, with at most one ally in support.
   *   lead / ally: [{ type, w, cap? }]   allyShare: share of the host (at most maxAllyShare, 0.4)
   *   front: types that march first (a shield line); rear: types that come last (siege)
   *   head: types placed at the very start, in order (a boss and his guard)
   * The same options and seed always give the same queue.
   * @returns {{queue: string[], leadCount: number, allyCount: number, counts: Object<string, number>}}
   */
  function composeHost(opts) {
    const o = opts || {};
    const rng = typeof o.rng === 'function' ? o.rng : mulberry32(o.seed || 1);
    const head = Array.isArray(o.head) ? o.head.filter(Boolean) : [];
    const total = Math.max(0, (o.count | 0) - head.length);
    const ally = (o.ally || []).filter((e) => e && e.w > 0);
    const maxShare = o.maxAllyShare > 0 ? Math.min(0.9, o.maxAllyShare) : 0.4;
    const share = ally.length ? Math.max(0, Math.min(maxShare, Number(o.allyShare) || 0)) : 0;
    const allyCount = Math.min(total, Math.round(total * share));
    const leadCount = total - allyCount;
    const leadN = apportion(o.lead, leadCount);
    const allyN = apportion(ally, allyCount);
    const front = new Set(o.front || []);
    const rear = new Set(o.rear || []);
    const first = [];
    const body = [];
    const last = [];
    for (const [type, n] of Object.entries(leadN)) {
      const bucket = front.has(type) ? first : rear.has(type) ? last : body;
      for (let i = 0; i < n; i++) bucket.push(type);
    }
    const allies = [];
    for (const [type, n] of Object.entries(allyN)) for (let i = 0; i < n; i++) allies.push(type);
    shuffle(body, rng);
    shuffle(allies, rng);
    // Allies march as their own squads, spread through the column, never mixed man for man.
    const chunk = Math.max(2, o.allySquad | 0 || 4);
    const out = [];
    const slots = Math.ceil(allies.length / chunk);
    const stride = slots > 0 ? Math.max(1, Math.floor(body.length / (slots + 1))) : body.length;
    let bi = 0;
    let ai = 0;
    while (bi < body.length || ai < allies.length) {
      for (let k = 0; k < stride && bi < body.length; k++) out.push(body[bi++]);
      for (let k = 0; k < chunk && ai < allies.length; k++) out.push(allies[ai++]);
      if (bi >= body.length) while (ai < allies.length) out.push(allies[ai++]);
    }
    const queue = head.concat(first, out, last);
    const counts = {};
    for (const t of queue) counts[t] = (counts[t] || 0) + 1;
    return { queue, leadCount: leadCount + head.length, allyCount, counts };
  }

  return { buildWeightedSpawnQueue, mulberry32, shuffle, apportion, composeHost };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.WaveCompositionCore = WaveCompositionCore;
