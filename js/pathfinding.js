/**
 * Grid A* pathfinding — terrain blocking, binary heap open set, LRU path cache.
 */
const Pathfinding = (() => {
  const CELL = 12;
  let gridW = 0;
  let gridH = 0;
  let cacheGen = 0;
  const pathCache = new Map();
  const PATH_CACHE_MAX = 1024;

  class MinHeap {
    constructor() { this.data = []; }
    push(n) {
      const a = this.data;
      a.push(n);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.data;
      if (!a.length) return null;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        while (true) {
          let l = i * 2 + 1;
          let r = l + 1;
          let s = i;
          if (l < a.length && a[l].f < a[s].f) s = l;
          if (r < a.length && a[r].f < a[s].f) s = r;
          if (s === i) break;
          [a[s], a[i]] = [a[i], a[s]];
          i = s;
        }
      }
      return top;
    }
    get length() { return this.data.length; }
  }

  function init(worldW, worldH) {
    gridW = Math.ceil(worldW / CELL);
    gridH = Math.ceil(worldH / CELL);
    clearCache();
  }

  function clearCache() {
    cacheGen++;
    pathCache.clear();
  }

  function toCell(x, y) {
    return {
      cx: Math.max(0, Math.min(gridW - 1, Math.floor(x / CELL))),
      cy: Math.max(0, Math.min(gridH - 1, Math.floor(y / CELL))),
    };
  }

  function toWorld(cx, cy) {
    return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
  }

  function key(cx, cy) {
    return `${cx},${cy}`;
  }

  function cacheKey(sx, sy, ex, ey, unit) {
    const s = toCell(sx, sy);
    const e = toCell(ex, ey);
    const footprint = unit?.combatType === 'cavalry' || unit?.type === 'siege_tower' ? 'L' : 'S';
    // Player allies pass through friendly walls; enemy paths must not be reused for them.
    const wallPass = unit?.team === 'player' ? 'P' : 'B';
    return `${cacheGen}|${s.cx},${s.cy}|${e.cx},${e.cy}|${footprint}|${wallPass}`;
  }

  function storeCache(k, path) {
    if (pathCache.size >= PATH_CACHE_MAX) {
      const first = pathCache.keys().next().value;
      pathCache.delete(first);
    }
    pathCache.set(k, path.map(p => ({ x: p.x, y: p.y })));
  }

  function isWalkable(cx, cy, unit, isTerrainBlockedFn) {
    const { x, y } = toWorld(cx, cy);
    return !isTerrainBlockedFn(x, y, unit);
  }

  function findNearestWalkableCell(cx, cy, unit, isTerrainBlockedFn, maxRadius = 20) {
    if (isWalkable(cx, cy, unit, isTerrainBlockedFn)) return { cx, cy };

    const visited = new Set();
    const queue = [{ cx, cy, dist: 0 }];
    visited.add(key(cx, cy));

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.dist > maxRadius) break;
      if (isWalkable(cur.cx, cur.cy, unit, isTerrainBlockedFn)) {
        return { cx: cur.cx, cy: cur.cy };
      }
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = cur.cx + dx;
        const ny = cur.cy + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        const k = key(nx, ny);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ cx: nx, cy: ny, dist: cur.dist + 1 });
      }
    }
    return null;
  }

  function findNearestWalkable(endX, endY, unit, isTerrainBlockedFn) {
    const end = toCell(endX, endY);
    const cell = findNearestWalkableCell(end.cx, end.cy, unit, isTerrainBlockedFn);
    if (!cell) return { x: endX, y: endY, cx: end.cx, cy: end.cy, valid: false };
    const w = toWorld(cell.cx, cell.cy);
    return { x: w.x, y: w.y, cx: cell.cx, cy: cell.cy, valid: true };
  }

  function reconstructPath(cameFrom, endCx, endCy, endX, endY) {
    const path = [];
    let node = { cx: endCx, cy: endCy };
    let k = key(node.cx, node.cy);
    while (cameFrom.has(k)) {
      path.unshift(toWorld(node.cx, node.cy));
      node = cameFrom.get(k);
      k = key(node.cx, node.cy);
    }
    if (path.length === 0 || Math.hypot(path[path.length - 1].x - endX, path[path.length - 1].y - endY) > 2) {
      path.push({ x: endX, y: endY });
    }
    return smoothPath(path);
  }

  function smoothPath(path) {
    if (path.length <= 2) return path;
    const out = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const prev = out[out.length - 1];
      const cur = path[i];
      const next = path[i + 1];
      const dx1 = cur.x - prev.x;
      const dy1 = cur.y - prev.y;
      const dx2 = next.x - cur.x;
      const dy2 = next.y - cur.y;
      const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
      if (cross > 80) out.push(cur);
    }
    out.push(path[path.length - 1]);
    return out;
  }

  function nodeLimit() {
    return Math.min(2400, 800 + Math.floor((gridW * gridH) / 80));
  }

  function findPath(startX, startY, endX, endY, unit, isTerrainBlockedFn, opts = {}) {
    const ck = cacheKey(startX, startY, endX, endY, unit);
    if (!opts.skipCache && pathCache.has(ck)) {
      return pathCache.get(ck).map(p => ({ x: p.x, y: p.y }));
    }

    const rawStart = toCell(startX, startY);
    const startCell = findNearestWalkableCell(rawStart.cx, rawStart.cy, unit, isTerrainBlockedFn, 8);
    if (!startCell) return [];

    const goal = findNearestWalkable(endX, endY, unit, isTerrainBlockedFn);
    if (!goal.valid && startCell.cx === goal.cx && startCell.cy === goal.cy) return [];

    if (startCell.cx === goal.cx && startCell.cy === goal.cy) {
      const shortPath = [{ x: goal.x, y: goal.y }];
      storeCache(ck, shortPath);
      return shortPath;
    }

    const open = new MinHeap();
    const cameFrom = new Map();
    const gScore = new Map();
    const closed = new Set();
    const inOpen = new Map();

    const h = (cx, cy) => Math.hypot(cx - goal.cx, cy - goal.cy);
    const startK = key(startCell.cx, startCell.cy);
    const startNode = { cx: startCell.cx, cy: startCell.cy, f: h(startCell.cx, startCell.cy) };
    open.push(startNode);
    inOpen.set(startK, startNode);
    gScore.set(startK, 0);

    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    let bestSeen = { cx: startCell.cx, cy: startCell.cy, g: 0 };
    const maxNodes = opts.maxNodes || nodeLimit();

    while (open.length > 0) {
      const cur = open.pop();
      const curK = key(cur.cx, cur.cy);
      if (closed.has(curK)) continue;
      closed.add(curK);
      inOpen.delete(curK);

      const curG = gScore.get(curK) ?? Infinity;
      const distToGoal = Math.hypot(cur.cx - goal.cx, cur.cy - goal.cy);
      const bestDist = Math.hypot(bestSeen.cx - goal.cx, bestSeen.cy - goal.cy);
      if (distToGoal < bestDist || (distToGoal === bestDist && curG < bestSeen.g)) {
        bestSeen = { cx: cur.cx, cy: cur.cy, g: curG };
      }

      if (cur.cx === goal.cx && cur.cy === goal.cy) {
        const path = reconstructPath(cameFrom, goal.cx, goal.cy, goal.x, goal.y);
        storeCache(ck, path);
        return path;
      }

      for (const [dx, dy] of dirs) {
        const nx = cur.cx + dx;
        const ny = cur.cy + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        if (dx && dy) {
          if (!isWalkable(cur.cx + dx, cur.cy, unit, isTerrainBlockedFn) ||
              !isWalkable(cur.cx, cur.cy + dy, unit, isTerrainBlockedFn)) continue;
        }
        if (!isWalkable(nx, ny, unit, isTerrainBlockedFn)) continue;

        const nk = key(nx, ny);
        const stepCost = dx && dy ? 1.41 : 1;
        const tentG = curG + stepCost;
        if (tentG >= (gScore.get(nk) ?? Infinity)) continue;

        cameFrom.set(nk, { cx: cur.cx, cy: cur.cy });
        gScore.set(nk, tentG);
        const f = tentG + h(nx, ny);
        const existing = inOpen.get(nk);
        if (existing) {
          if (f < existing.f) existing.f = f;
        } else {
          const node = { cx: nx, cy: ny, f };
          open.push(node);
          inOpen.set(nk, node);
        }
      }

      if (closed.size > maxNodes) break;
    }

    let path = [];
    if (bestSeen.cx !== startCell.cx || bestSeen.cy !== startCell.cy) {
      const w = toWorld(bestSeen.cx, bestSeen.cy);
      path = reconstructPath(cameFrom, bestSeen.cx, bestSeen.cy, w.x, w.y);
    }
    if (path.length) storeCache(ck, path);
    return path;
  }

  return { init, findPath, findNearestWalkable, clearCache, CELL };
})();