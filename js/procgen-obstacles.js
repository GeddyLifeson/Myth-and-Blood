/**
 * WFC-shaped obstacle clusters, ported from the standalone procgen-lab
 * project (C:\Users\imarl\procgen-lab). Unlike Miami Vice RTS's integration,
 * this game has no discrete terrain grid to write into -- buildings and
 * decorations are free-floating circles (x, y, radius) in a continuous
 * world (see js/spatial.js). So the adapter here is a blob->circle
 * conversion: run the dungeon tileset's WFC solve over a region, flood-fill
 * each contiguous "wall" blob, and emit one decoration-shaped circle per
 * blob at its centroid, sized to the blob's footprint.
 *
 * This is a STANDALONE UTILITY, not wired into the live spawn pipeline
 * (populateNewTerritory etc.) -- deciding where WFC-shaped obstacle
 * clusters fit into existing spawn budgets/pacing is a game-balance call,
 * not this adapter's to make. Call ProcGenObstacles.generateClusters(...)
 * and push the results into GS.decorations yourself where it makes sense.
 *
 * Example:
 *   const clusters = ProcGenObstacles.generateClusters({
 *     originX: 400, originY: 400, worldWidth: 600, worldHeight: 600,
 *     seed: 'territory-tier-3-north',
 *   });
 *   GS.decorations.push(...clusters);
 */
const ProcGenObstacles = (() => {
  const DIRS = {
    N: { dx: 0, dy: -1, opposite: 'S' },
    E: { dx: 1, dy: 0, opposite: 'W' },
    S: { dx: 0, dy: 1, opposite: 'N' },
    W: { dx: -1, dy: 0, opposite: 'E' },
  };
  const DIR_KEYS = Object.keys(DIRS);

  // Dungeon tileset: 'w' (wall-facing) / 'f' (floor-facing) edges. See
  // procgen-lab/js/tiles/dungeon.js for the full writeup.
  const TILES = [
    { id: 'floor', weight: 8, tag: 'floor', edges: { N: 'f', E: 'f', S: 'f', W: 'f' } },
    { id: 'wall_solid', weight: 5, tag: 'wall', edges: { N: 'w', E: 'w', S: 'w', W: 'w' } },
    { id: 'wall_n', weight: 3, tag: 'wall', edges: { N: 'w', E: 'f', S: 'f', W: 'f' } },
    { id: 'wall_s', weight: 3, tag: 'wall', edges: { N: 'f', E: 'f', S: 'w', W: 'f' } },
    { id: 'wall_e', weight: 3, tag: 'wall', edges: { N: 'f', E: 'w', S: 'f', W: 'f' } },
    { id: 'wall_w', weight: 3, tag: 'wall', edges: { N: 'f', E: 'f', S: 'f', W: 'w' } },
    { id: 'corner_ne', weight: 2, tag: 'wall', edges: { N: 'w', E: 'w', S: 'f', W: 'f' } },
    { id: 'corner_se', weight: 2, tag: 'wall', edges: { N: 'f', E: 'w', S: 'w', W: 'f' } },
    { id: 'corner_sw', weight: 2, tag: 'wall', edges: { N: 'f', E: 'f', S: 'w', W: 'w' } },
    { id: 'corner_nw', weight: 2, tag: 'wall', edges: { N: 'w', E: 'f', S: 'f', W: 'w' } },
  ];

  function buildCompatibility(tiles) {
    const compat = {};
    for (const a of tiles) {
      compat[a.id] = {};
      for (const dirKey of DIR_KEYS) {
        const opp = DIRS[dirKey].opposite;
        compat[a.id][dirKey] = new Set(
          tiles.filter((b) => a.edges[dirKey] === b.edges[opp]).map((b) => b.id)
        );
      }
    }
    return compat;
  }
  function weightedPick(rng, items) {
    const total = items.reduce((s, it) => s + it.weight, 0);
    let r = rng() * total;
    for (const it of items) {
      r -= it.weight;
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  // xmur3 + mulberry32 -- deterministic string-seeded RNG, same as
  // procgen-lab/js/rng.js and Miami Vice RTS's own hashSeed/mulberry32 (so
  // this behaves the same way seeds already do elsewhere in this codebase).
  function makeRng(seedStr) {
    let h = 1779033703 ^ String(seedStr).length;
    for (let i = 0; i < String(seedStr).length; i++) {
      h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    let a = h >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function collapseTags(w, h, rng, maxAttempts) {
    const compat = buildCompatibility(TILES);
    const allIds = TILES.map((t) => t.id);
    const tileById = Object.fromEntries(TILES.map((t) => [t.id, t]));
    const idx = (x, y) => y * w + x;

    for (let attempt = 0; attempt < (maxAttempts || 25); attempt++) {
      const possibilities = new Array(w * h);
      for (let i = 0; i < possibilities.length; i++) possibilities[i] = new Set(allIds);
      const queue = [];
      let failed = false;

      const propagateFrom = (x, y) => {
        queue.push([x, y]);
        while (queue.length) {
          const [cx, cy] = queue.shift();
          const cellSet = possibilities[idx(cx, cy)];
          for (const dirKey of DIR_KEYS) {
            const { dx, dy } = DIRS[dirKey];
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const neighborSet = possibilities[idx(nx, ny)];
            if (neighborSet.size <= 1) continue;
            const allowed = new Set();
            for (const id of cellSet) for (const okId of compat[id][dirKey]) allowed.add(okId);
            let changed = false;
            for (const id of [...neighborSet]) {
              if (!allowed.has(id)) {
                neighborSet.delete(id);
                changed = true;
              }
            }
            if (neighborSet.size === 0) return false;
            if (changed) queue.push([nx, ny]);
          }
        }
        return true;
      };

      while (!failed) {
        let best = -1;
        let bestSize = Infinity;
        for (let i = 0; i < possibilities.length; i++) {
          const s = possibilities[i].size;
          if (s > 1 && s < bestSize) {
            bestSize = s;
            best = i;
          }
        }
        if (best === -1) break;
        const set = possibilities[best];
        const candidates = TILES.filter((t) => set.has(t.id));
        const chosen = weightedPick(rng, candidates);
        possibilities[best] = new Set([chosen.id]);
        const x = best % w;
        const y = Math.floor(best / w);
        if (!propagateFrom(x, y)) failed = true;
      }
      if (failed) continue;

      const tags = new Array(w * h);
      for (let i = 0; i < possibilities.length; i++) {
        tags[i] = tileById[[...possibilities[i]][0]].tag;
      }
      return tags;
    }
    return null;
  }

  function floodFillBlobs(tags, w, h, tag) {
    const visited = new Array(tags.length).fill(false);
    const blobs = [];
    for (let start = 0; start < tags.length; start++) {
      if (tags[start] !== tag || visited[start]) continue;
      const cells = [];
      const stack = [start];
      visited[start] = true;
      while (stack.length) {
        const c = stack.pop();
        cells.push(c);
        const cx = c % w;
        const cy = Math.floor(c / w);
        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited[ni] || tags[ni] !== tag) continue;
          visited[ni] = true;
          stack.push(ni);
        }
      }
      blobs.push(cells);
    }
    return blobs;
  }

  /**
   * Returns an array of decoration-shaped objects (type 'rock',
   * blocksMove/blocksLOS true) -- one per contiguous wall blob in a WFC
   * dungeon solve over the given world-space rectangle. Does NOT push
   * anything into GS.decorations itself.
   */
  function generateClusters(opts) {
    const originX = opts.originX || 0;
    const originY = opts.originY || 0;
    const worldWidth = opts.worldWidth || 400;
    const worldHeight = opts.worldHeight || 400;
    const cellSize = opts.cellSize || 24; // world units per WFC cell
    const seed = opts.seed != null ? opts.seed : String(Date.now());
    const minBlobCells = opts.minBlobCells || 2; // drop lone single-cell specks

    const w = Math.max(4, Math.round(worldWidth / cellSize));
    const h = Math.max(4, Math.round(worldHeight / cellSize));
    const rng = makeRng(seed);
    const tags = collapseTags(w, h, rng, 25);
    if (!tags) return [];

    const blobs = floodFillBlobs(tags, w, h, 'wall').filter((b) => b.length >= minBlobCells);

    return blobs.map((cells, i) => {
      let sumX = 0,
        sumY = 0,
        minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const c of cells) {
        const cx = c % w;
        const cy = Math.floor(c / w);
        sumX += cx;
        sumY += cy;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
      }
      const cxAvg = sumX / cells.length;
      const cyAvg = sumY / cells.length;
      const worldX = originX + (cxAvg + 0.5) * cellSize;
      const worldY = originY + (cyAvg + 0.5) * cellSize;
      const spanCells = Math.max(maxX - minX + 1, maxY - minY + 1);
      const radius = Math.max(10, (spanCells * cellSize) / 2);
      return {
        type: 'rock',
        id: `wfc_obstacle_${seed}_${i}`,
        x: worldX,
        y: worldY,
        size: radius,
        hp: 999,
        maxHp: 999,
        blocksMove: true,
        blocksLOS: true,
        cover: 0.4,
        radius,
      };
    });
  }

  return { generateClusters };
})();
