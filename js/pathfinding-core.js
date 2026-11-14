/**
 * Grid A* pathfinding core — shared by main thread and path-worker.js.
 */
const PathfindingCore = (() => {
  const CELL = 12;
  let gridW = 0;
  let gridH = 0;

  // Open list: a binary min-heap on f, held in two parallel typed arrays (cell key, f) so a
  // search allocates no node objects. Same sift rules as the object heap it replaced, so
  // ties pop in the same order and paths are unchanged.
  let heapK = new Int32Array(1024);
  let heapF = new Float64Array(1024);
  let heapN = 0;

  function heapPush(k, f) {
    if (heapN === heapK.length) {
      const nk = new Int32Array(heapN * 2);
      const nf = new Float64Array(heapN * 2);
      nk.set(heapK);
      nf.set(heapF);
      heapK = nk;
      heapF = nf;
    }
    let i = heapN++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= f) break;
      heapK[i] = heapK[p];
      heapF[i] = heapF[p];
      i = p;
    }
    heapK[i] = k;
    heapF[i] = f;
  }

  /** Removes the smallest entry and returns its cell key (heap must not be empty). */
  function heapPop() {
    const top = heapK[0];
    const n = --heapN;
    if (n > 0) {
      const k = heapK[n];
      const f = heapF[n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        let sf = f;
        if (l < n && heapF[l] < sf) {
          s = l;
          sf = heapF[l];
        }
        if (r < n && heapF[r] < sf) s = r;
        if (s === i) break;
        heapK[i] = heapK[s];
        heapF[i] = heapF[s];
        i = s;
      }
      heapK[i] = k;
      heapF[i] = f;
    }
    return top;
  }

  let gScore = null;
  let cameFromParent = null;
  let closedGen = null;
  let openGen = null;
  let searchGen = 1;
  // Scratch for findNearestWalkableCell: a visit stamp per cell and a fixed BFS queue.
  let visitGen = null;
  let visitStamp = 1;
  const NEAR_QUEUE = 41 * 41;
  const queueCx = new Int16Array(NEAR_QUEUE);
  const queueCy = new Int16Array(NEAR_QUEUE);
  const queueDist = new Int16Array(NEAR_QUEUE);
  // Result of the last findNearestWalkableCell() that returned true.
  let nearCx = 0;
  let nearCy = 0;
  // Cells closed by the last search, for the stats in Pathfinding.getStats().
  let lastClosed = 0;

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
      visitGen = new Uint16Array(size);
      visitStamp = 1;
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

  /**
   * Nearest walkable cell to (cx, cy) by ring search. True when found; the cell is left in
   * nearCx / nearCy (no object is returned, so a search allocates nothing).
   */
  function findNearestWalkableCell(grid, cx, cy, maxRadius = 20) {
    if (!grid || !inBounds(cx, cy)) return false;
    if (!isBlocked(grid, cx, cy)) {
      nearCx = cx;
      nearCy = cy;
      return true;
    }

    // BFS ring search. Cap visits so a fully-blocked map cannot explode.
    const maxVisit = Math.min(
      gridW * gridH,
      (maxRadius * 2 + 1) * (maxRadius * 2 + 1),
      NEAR_QUEUE
    );
    ensureSearchBuffers();
    if (++visitStamp >= 65500) {
      visitGen.fill(0);
      visitStamp = 1;
    }
    let head = 0;
    let tail = 0;
    queueCx[tail] = cx;
    queueCy[tail] = cy;
    queueDist[tail] = 0;
    tail++;
    visitGen[key(cx, cy)] = visitStamp;

    while (head < tail) {
      const curCx = queueCx[head];
      const curCy = queueCy[head];
      const curDist = queueDist[head];
      head++;
      if (curDist > maxRadius) break;
      if (!isBlocked(grid, curCx, curCy)) {
        nearCx = curCx;
        nearCy = curCy;
        return true;
      }
      for (let d = 0; d < DIRS.length; d++) {
        const nx = curCx + DIRS[d][0];
        const ny = curCy + DIRS[d][1];
        if (!inBounds(nx, ny)) continue;
        const k = key(nx, ny);
        if (visitGen[k] === visitStamp) continue;
        if (tail >= maxVisit) break;
        visitGen[k] = visitStamp;
        queueCx[tail] = nx;
        queueCy[tail] = ny;
        queueDist[tail] = curDist + 1;
        tail++;
      }
    }
    return false;
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
    lastClosed = 0;
    if (!grid || !gridW || !gridH) return [];

    const sx = Number(startX);
    const sy = Number(startY);
    const ex = Number(endX);
    const ey = Number(endY);
    if (
      !Number.isFinite(sx) ||
      !Number.isFinite(sy) ||
      !Number.isFinite(ex) ||
      !Number.isFinite(ey)
    ) {
      return [];
    }

    // Clamped cell of a finite world position (toCell without the object).
    const rawSx = Math.max(0, Math.min(gridW - 1, Math.floor(sx / CELL)));
    const rawSy = Math.max(0, Math.min(gridH - 1, Math.floor(sy / CELL)));
    if (!findNearestWalkableCell(grid, rawSx, rawSy, 8)) return [];
    const startCx = nearCx;
    const startCy = nearCy;

    const rawEx = Math.max(0, Math.min(gridW - 1, Math.floor(ex / CELL)));
    const rawEy = Math.max(0, Math.min(gridH - 1, Math.floor(ey / CELL)));
    const goalValid = findNearestWalkableCell(grid, rawEx, rawEy, 20);
    const goalCx = goalValid ? nearCx : rawEx;
    const goalCy = goalValid ? nearCy : rawEy;
    // Only use exact endX/endY when that cell is walkable; otherwise aim at snapped goal center
    // (sending into a blocked tile made units repath-thrash against walls/trees).
    const exactEnd = goalValid && goalCx === rawEx && goalCy === rawEy;
    const destX = exactEnd ? ex : goalCx * CELL + CELL / 2;
    const destY = exactEnd ? ey : goalCy * CELL + CELL / 2;

    // No walkable goal and already on that cell — nowhere to go.
    if (!goalValid && startCx === goalCx && startCy === goalCy) return [];

    // Same walkable cell: go straight to the real world destination (not cell center).
    // Previously returned cell center, so short same-tile move orders stalled at mid-cell.
    if (startCx === goalCx && startCy === goalCy) {
      return [{ x: destX, y: destY }];
    }

    ensureSearchBuffers();
    if (!gScore) return [];
    bumpSearchGen();
    heapN = 0;

    // Squared distance heuristic (fast; paths are valid, not always optimal).
    const startK = key(startCx, startCy);
    const sdx = startCx - goalCx;
    const sdy = startCy - goalCy;
    heapPush(startK, sdx * sdx + sdy * sdy);
    openGen[startK] = searchGen;
    gScore[startK] = 0;
    cameFromParent[startK] = -1;

    let bestCx = startCx;
    let bestCy = startCy;
    let bestG = 0;
    const nodeCap = maxNodes > 0 ? maxNodes : defaultNodeLimit();
    let closedCount = 0;

    while (heapN > 0) {
      const curK = heapPop();
      if (closedGen[curK] === searchGen) continue;
      closedGen[curK] = searchGen;
      closedCount++;
      const curCx = curK % gridW;
      const curCy = (curK / gridW) | 0;

      const curG = gScore[curK];
      const gdx = curCx - goalCx;
      const gdy = curCy - goalCy;
      const distToGoal = gdx * gdx + gdy * gdy;
      const bdx = bestCx - goalCx;
      const bdy = bestCy - goalCy;
      const bestDist = bdx * bdx + bdy * bdy;
      if (distToGoal < bestDist || (distToGoal === bestDist && curG < bestG)) {
        bestCx = curCx;
        bestCy = curCy;
        bestG = curG;
      }

      if (curCx === goalCx && curCy === goalCy) {
        lastClosed = closedCount;
        return reconstructPath(cameFromParent, goalCx, goalCy, destX, destY);
      }

      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0];
        const dy = DIRS[d][1];
        const nx = curCx + dx;
        const ny = curCy + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        // No corner-cutting through blocked cardinal neighbors.
        if (dx && dy) {
          if (grid[curCy * gridW + nx] !== 0 || grid[ny * gridW + curCx] !== 0) continue;
        }
        const nk = ny * gridW + nx;
        if (grid[nk] !== 0) continue;

        if (closedGen[nk] === searchGen) continue;
        const stepCost = dx && dy ? 1.41 : 1;
        const tentG = curG + stepCost;
        if (openGen[nk] === searchGen && tentG >= gScore[nk]) continue;

        cameFromParent[nk] = curK;
        gScore[nk] = tentG;
        openGen[nk] = searchGen;
        const hx = nx - goalCx;
        const hy = ny - goalCy;
        heapPush(nk, tentG + hx * hx + hy * hy);
      }

      if (closedCount > nodeCap) break;
    }
    lastClosed = closedCount;

    // Partial path toward the closest explored cell when the goal was unreachable / cap hit.
    if (bestCx !== startCx || bestCy !== startCy) {
      return reconstructPath(
        cameFromParent,
        bestCx,
        bestCy,
        bestCx * CELL + CELL / 2,
        bestCy * CELL + CELL / 2
      );
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
    /** Cells closed by the most recent findPathOnGrid call. */
    get lastClosed() {
      return lastClosed;
    },
    findPathOnGrid,
    toCell,
    toWorld,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.PathfindingCore = PathfindingCore;
