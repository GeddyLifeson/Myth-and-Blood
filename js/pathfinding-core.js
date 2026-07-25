/**
 * Grid A* pathfinding core — shared by main thread and path-worker.js.
 */
const PathfindingCore = (() => {
  const CELL = 12;
  let gridW = 0;
  let gridH = 0;

  class MinHeap {
    constructor() {
      this.data = [];
    }
    clear() {
      this.data.length = 0;
    }
    push(n) {
      const a = this.data;
      a.push(n);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        const tmp = a[p];
        a[p] = a[i];
        a[i] = tmp;
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
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let s = i;
          if (l < a.length && a[l].f < a[s].f) s = l;
          if (r < a.length && a[r].f < a[s].f) s = r;
          if (s === i) break;
          const tmp = a[s];
          a[s] = a[i];
          a[i] = tmp;
          i = s;
        }
      }
      return top;
    }
    get length() {
      return this.data.length;
    }
  }

  const openHeap = new MinHeap();
  let gScore = null;
  let cameFromParent = null;
  let closedGen = null;
  let openGen = null;
  let searchGen = 1;

  // 8-connected neighbor deltas (cardinal then diagonal).
  const DIRS = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  function ensureSearchBuffers() {
    const size = gridW * gridH;
    if (size <= 0) return;
    if (!gScore || gScore.length < size) {
      gScore = new Float32Array(size);
      cameFromParent = new Int32Array(size);
      closedGen = new Uint16Array(size);
      openGen = new Uint16Array(size);
    }
  }

  function bumpSearchGen() {
    searchGen++;
    if (searchGen >= 65500) {
      if (closedGen) closedGen.fill(0);
      if (openGen) openGen.fill(0);
      searchGen = 1;
    }
  }

  function init(worldW, worldH) {
    const w = Math.max(0, Number(worldW) || 0);
    const h = Math.max(0, Number(worldH) || 0);
    gridW = Math.ceil(w / CELL) || 0;
    gridH = Math.ceil(h / CELL) || 0;
    ensureSearchBuffers();
    return { gridW, gridH, CELL };
  }

  function toCell(x, y) {
    if (!gridW || !gridH) return { cx: 0, cy: 0 };
    const fx = Number(x);
    const fy = Number(y);
    // Non-finite coords clamp to origin rather than NaN indices.
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) return { cx: 0, cy: 0 };
    return {
      cx: Math.max(0, Math.min(gridW - 1, Math.floor(fx / CELL))),
      cy: Math.max(0, Math.min(gridH - 1, Math.floor(fy / CELL))),
    };
  }

  function toWorld(cx, cy) {
    return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
  }

  function key(cx, cy) {
    return cy * gridW + cx;
  }

  function inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < gridW && cy < gridH;
  }

  function isBlocked(grid, cx, cy) {
    if (!grid || !inBounds(cx, cy)) return true;
    return grid[cy * gridW + cx] !== 0;
  }

  function findNearestWalkableCell(grid, cx, cy, maxRadius = 20) {
    if (!grid || !inBounds(cx, cy)) return null;
    if (!isBlocked(grid, cx, cy)) return { cx, cy };

    // BFS ring search. Cap visits so a fully-blocked map cannot explode.
    const maxVisit = Math.min(gridW * gridH, (maxRadius * 2 + 1) * (maxRadius * 2 + 1));
    const visited = new Uint8Array(gridW * gridH);
    const queueCx = new Int16Array(maxVisit);
    const queueCy = new Int16Array(maxVisit);
    const queueDist = new Int16Array(maxVisit);
    let head = 0;
    let tail = 0;
    queueCx[tail] = cx;
    queueCy[tail] = cy;
    queueDist[tail] = 0;
    tail++;
    visited[key(cx, cy)] = 1;

    while (head < tail) {
      const curCx = queueCx[head];
      const curCy = queueCy[head];
      const curDist = queueDist[head];
      head++;
      if (curDist > maxRadius) break;
      if (!isBlocked(grid, curCx, curCy)) return { cx: curCx, cy: curCy };
      for (let d = 0; d < DIRS.length; d++) {
        const nx = curCx + DIRS[d][0];
        const ny = curCy + DIRS[d][1];
        if (!inBounds(nx, ny)) continue;
        const k = key(nx, ny);
        if (visited[k]) continue;
        if (tail >= maxVisit) break;
        visited[k] = 1;
        queueCx[tail] = nx;
        queueCy[tail] = ny;
        queueDist[tail] = curDist + 1;
        tail++;
      }
    }
    return null;
  }

  function reconstructPath(cameFrom, endCx, endCy, endX, endY) {
    const path = [];
    let cx = endCx;
    let cy = endCy;
    let k = key(cx, cy);
    // Guard against corrupt parent chains (should not happen in normal search).
    const hopCap = gridW * gridH + 2;
    let hops = 0;
    while (cameFrom[k] >= 0 && hops < hopCap) {
      hops++;
      path.push(toWorld(cx, cy));
      const pk = cameFrom[k];
      cx = pk % gridW;
      cy = (pk / gridW) | 0;
      k = pk;
    }
    path.reverse();
    // Always snap the last waypoint to the true world destination when it differs.
    if (
      path.length === 0 ||
      Math.hypot(path[path.length - 1].x - endX, path[path.length - 1].y - endY) > 2
    ) {
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

  function defaultNodeLimit() {
    if (!gridW || !gridH) return 800;
    return Math.min(2400, 800 + Math.floor((gridW * gridH) / 80));
  }

  function findPathOnGrid(grid, startX, startY, endX, endY, maxNodes) {
    if (!grid || !gridW || !gridH) return [];

    const sx = Number(startX);
    const sy = Number(startY);
    const ex = Number(endX);
    const ey = Number(endY);
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(ex) || !Number.isFinite(ey)) {
      return [];
    }

    const rawStart = toCell(sx, sy);
    const startCell = findNearestWalkableCell(grid, rawStart.cx, rawStart.cy, 8);
    if (!startCell) return [];

    const rawEnd = toCell(ex, ey);
    const endCell = findNearestWalkableCell(grid, rawEnd.cx, rawEnd.cy, 20);
    const goal = endCell
      ? { cx: endCell.cx, cy: endCell.cy, ...toWorld(endCell.cx, endCell.cy), valid: true }
      : { cx: rawEnd.cx, cy: rawEnd.cy, ...toWorld(rawEnd.cx, rawEnd.cy), valid: false };
    // Only use exact endX/endY when that cell is walkable; otherwise aim at snapped goal center
    // (sending into a blocked tile made units repath-thrash against walls/trees).
    const exactEnd =
      !!endCell && endCell.cx === rawEnd.cx && endCell.cy === rawEnd.cy;
    const destX = exactEnd ? ex : goal.x;
    const destY = exactEnd ? ey : goal.y;

    // No walkable goal and already on that cell — nowhere to go.
    if (!goal.valid && startCell.cx === goal.cx && startCell.cy === goal.cy) return [];

    // Same walkable cell: go straight to the real world destination (not cell center).
    // Previously returned cell center, so short same-tile move orders stalled at mid-cell.
    if (startCell.cx === goal.cx && startCell.cy === goal.cy) {
      return [{ x: destX, y: destY }];
    }

    ensureSearchBuffers();
    if (!gScore) return [];
    bumpSearchGen();
    openHeap.clear();

    // Squared distance heuristic (fast; paths are valid, not always optimal).
    const h = (cx, cy) => {
      const dx = cx - goal.cx;
      const dy = cy - goal.cy;
      return dx * dx + dy * dy;
    };
    const startK = key(startCell.cx, startCell.cy);
    openHeap.push({ cx: startCell.cx, cy: startCell.cy, f: h(startCell.cx, startCell.cy) });
    openGen[startK] = searchGen;
    gScore[startK] = 0;
    cameFromParent[startK] = -1;

    let bestSeen = { cx: startCell.cx, cy: startCell.cy, g: 0 };
    const nodeCap = maxNodes > 0 ? maxNodes : defaultNodeLimit();
    let closedCount = 0;

    while (openHeap.length > 0) {
      const cur = openHeap.pop();
      const curK = key(cur.cx, cur.cy);
      if (closedGen[curK] === searchGen) continue;
      closedGen[curK] = searchGen;
      closedCount++;

      const curG = gScore[curK];
      const gdx = cur.cx - goal.cx;
      const gdy = cur.cy - goal.cy;
      const distToGoal = gdx * gdx + gdy * gdy;
      const bdx = bestSeen.cx - goal.cx;
      const bdy = bestSeen.cy - goal.cy;
      const bestDist = bdx * bdx + bdy * bdy;
      if (distToGoal < bestDist || (distToGoal === bestDist && curG < bestSeen.g)) {
        bestSeen = { cx: cur.cx, cy: cur.cy, g: curG };
      }

      if (cur.cx === goal.cx && cur.cy === goal.cy) {
        return reconstructPath(cameFromParent, goal.cx, goal.cy, destX, destY);
      }

      for (let d = 0; d < DIRS.length; d++) {
        const dx = DIRS[d][0];
        const dy = DIRS[d][1];
        const nx = cur.cx + dx;
        const ny = cur.cy + dy;
        if (!inBounds(nx, ny)) continue;
        // No corner-cutting through blocked cardinal neighbors.
        if (dx && dy) {
          if (isBlocked(grid, cur.cx + dx, cur.cy) || isBlocked(grid, cur.cx, cur.cy + dy)) continue;
        }
        if (isBlocked(grid, nx, ny)) continue;

        const nk = key(nx, ny);
        if (closedGen[nk] === searchGen) continue;
        const stepCost = dx && dy ? 1.41 : 1;
        const tentG = curG + stepCost;
        if (openGen[nk] === searchGen && tentG >= gScore[nk]) continue;

        cameFromParent[nk] = curK;
        gScore[nk] = tentG;
        openGen[nk] = searchGen;
        openHeap.push({ cx: nx, cy: ny, f: tentG + h(nx, ny) });
      }

      if (closedCount > nodeCap) break;
    }

    // Partial path toward the closest explored cell when the goal was unreachable / cap hit.
    if (bestSeen.cx !== startCell.cx || bestSeen.cy !== startCell.cy) {
      const w = toWorld(bestSeen.cx, bestSeen.cy);
      return reconstructPath(cameFromParent, bestSeen.cx, bestSeen.cy, w.x, w.y);
    }
    return [];
  }

  return {
    CELL,
    init,
    get gridW() {
      return gridW;
    },
    get gridH() {
      return gridH;
    },
    findPathOnGrid,
    toCell,
    toWorld,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.PathfindingCore = PathfindingCore;
