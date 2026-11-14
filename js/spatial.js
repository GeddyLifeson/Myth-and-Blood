/**
 * Spatial index: uniform grid for static obstacles and units, quadtree for hazards.
 * Static (buildings/deco) and dynamic (units/hazards) layers rebuild independently.
 *
 * Each grid layer is a flat table: cell index = cx + cy * gridW, and the entries of a cell
 * are a run in one Int32Array (cellStart[cell] .. cellStart[cell + 1]). An entry sits in every
 * cell its bounding square touches, and remembers its first cell, so a query reports it once
 * (from the first cell the query visits that holds it) without a Set. Positions are the ones
 * the entity had at the last rebuild, as before.
 *
 * Rebuilding is one counting pass and one fill pass over the units and allocates nothing once
 * the arrays have grown, so the unit layer is simply rebuilt each tick: a rebuild of 400 units
 * costs less than one wide query used to.
 */
const Spatial = (() => {
  const CELL = 64;
  const QT_CAPACITY = 10;
  const QT_MAX_DEPTH = 9;
  // An entry can reach into a cell from a centre up to r * sqrt(2) outside it.
  const CELL_REACH = 2.4143;

  let gridW = 0;
  let gridH = 0;
  let worldW = 0;
  let worldH = 0;
  let hazardTree = null;
  let maxHazardRadius = 0;
  const queryScratch = [];
  const hazardScratch = [];

  // Counters for the F3 overlay; plain integer adds.
  let statQueries = 0;
  let statCells = 0;
  let statTested = 0;

  function makeLayer() {
    return {
      n: 0,
      cap: 0,
      /** Entry objects ({kind, ref, x, y, r, ...}); the unit layer reuses them between rebuilds. */
      entry: [],
      ref: [],
      x: new Float64Array(0),
      y: new Float64Array(0),
      r: new Float64Array(0),
      minCx: new Int32Array(0),
      minCy: new Int32Array(0),
      maxCx: new Int32Array(0),
      maxCy: new Int32Array(0),
      cellStart: new Int32Array(1),
      cursor: new Int32Array(0),
      items: new Int32Array(0),
      itemCount: 0,
      maxR: 0,
    };
  }

  const staticLayer = makeLayer();
  const unitLayer = makeLayer();

  function growLayer(L, need) {
    if (need <= L.cap) return;
    const cap = Math.max(64, need, L.cap * 2);
    const grow = (Ctor, old) => {
      const a = new Ctor(cap);
      a.set(old);
      return a;
    };
    L.x = grow(Float64Array, L.x);
    L.y = grow(Float64Array, L.y);
    L.r = grow(Float64Array, L.r);
    L.minCx = grow(Int32Array, L.minCx);
    L.minCy = grow(Int32Array, L.minCy);
    L.maxCx = grow(Int32Array, L.maxCx);
    L.maxCy = grow(Int32Array, L.maxCy);
    L.cap = cap;
  }

  function resetLayer(L) {
    L.n = 0;
    L.itemCount = 0;
    L.maxR = 0;
    const cells = gridW * gridH;
    if (L.cellStart.length !== cells + 1) {
      L.cellStart = new Int32Array(cells + 1);
      L.cursor = new Int32Array(cells);
    } else {
      L.cellStart.fill(0);
    }
  }

  /** Drop references so a cleared layer does not keep dead units alive. */
  function dropRefs(L, keepEntries) {
    for (let i = 0; i < L.ref.length; i++) {
      L.ref[i] = null;
      if (keepEntries) {
        if (L.entry[i]) L.entry[i].ref = null;
      } else {
        L.entry[i] = null;
      }
    }
  }

  /** Reserve slot `s` for an entity at (x, y) reaching `r`; counts the cells it touches. */
  function placeEntry(L, s, x, y, r) {
    // Same cell rule as before: a non-finite corner maps to cell (0, 0).
    let c0x = 0;
    let c0y = 0;
    let c1x = 0;
    let c1y = 0;
    const lx = x - r;
    const ly = y - r;
    const hx = x + r;
    const hy = y + r;
    if (Number.isFinite(lx) && Number.isFinite(ly)) {
      c0x = Math.floor(lx / CELL);
      c0y = Math.floor(ly / CELL);
    }
    if (Number.isFinite(hx) && Number.isFinite(hy)) {
      c1x = Math.floor(hx / CELL);
      c1y = Math.floor(hy / CELL);
    }
    if (c0x < 0) c0x = 0;
    if (c0y < 0) c0y = 0;
    if (c1x > gridW - 1) c1x = gridW - 1;
    if (c1y > gridH - 1) c1y = gridH - 1;
    L.x[s] = x;
    L.y[s] = y;
    L.r[s] = r;
    L.minCx[s] = c0x;
    L.minCy[s] = c0y;
    L.maxCx[s] = c1x;
    L.maxCy[s] = c1y;
    if (r > L.maxR) L.maxR = r;
    const counts = L.cellStart;
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        counts[cx + cy * gridW + 1]++;
        L.itemCount++;
      }
    }
  }

  /** Turn the per-cell counts into runs and fill them in slot order (keeps insertion order). */
  function finishLayer(L) {
    const cells = gridW * gridH;
    const start = L.cellStart;
    const cursor = L.cursor;
    for (let c = 0; c < cells; c++) {
      start[c + 1] += start[c];
      cursor[c] = start[c];
    }
    if (L.items.length < L.itemCount) {
      L.items = new Int32Array(Math.max(256, L.itemCount * 2));
    }
    const items = L.items;
    for (let s = 0; s < L.n; s++) {
      const c1x = L.maxCx[s];
      const c1y = L.maxCy[s];
      const c0y = L.minCy[s];
      for (let cx = L.minCx[s]; cx <= c1x; cx++) {
        for (let cy = c0y; cy <= c1y; cy++) {
          items[cursor[cx + cy * gridW]++] = s;
        }
      }
    }
  }

  // ---- query window (module scratch; set by setWindow, read straight after) ----
  let wx0 = 0;
  let wy0 = 0;
  let wx1 = -1;
  let wy1 = -1;

  /** Cell window of a square query, clamped to the grid. False when it misses the grid. */
  function setWindow(minX, minY, maxX, maxY) {
    wx0 = 0;
    wy0 = 0;
    wx1 = 0;
    wy1 = 0;
    if (Number.isFinite(minX) && Number.isFinite(minY)) {
      wx0 = Math.floor(minX / CELL);
      wy0 = Math.floor(minY / CELL);
    }
    if (Number.isFinite(maxX) && Number.isFinite(maxY)) {
      wx1 = Math.floor(maxX / CELL);
      wy1 = Math.floor(maxY / CELL);
    }
    if (wx0 < 0) wx0 = 0;
    if (wy0 < 0) wy0 = 0;
    if (wx1 > gridW - 1) wx1 = gridW - 1;
    if (wy1 > gridH - 1) wy1 = gridH - 1;
    return wx0 <= wx1 && wy0 <= wy1;
  }

  /**
   * Squared distance from x to the column of cells cx, or from y to the row cy (0 inside).
   * Used to skip cells in the corners of the query square that the circle cannot reach.
   */
  function axisGap2(v, c) {
    const lo = c * CELL;
    const d = v < lo ? lo - v : v > lo + CELL ? v - lo - CELL : 0;
    return d * d;
  }

  /**
   * Visit every entry of layer L whose circle touches the query circle, once per cell it
   * sits in (the old forCellsInMap contract). fn gets the entry object.
   */
  function forEntries(L, x, y, radius, fn) {
    if (!L.n || !setWindow(x - radius, y - radius, x + radius, y + radius)) return;
    const x0 = wx0;
    const y0 = wy0;
    const x1 = wx1;
    const y1 = wy1;
    const start = L.cellStart;
    const items = L.items;
    const reach = radius + L.maxR * CELL_REACH + 1;
    const reach2 = reach * reach;
    for (let cx = x0; cx <= x1; cx++) {
      const gx2 = axisGap2(x, cx);
      for (let cy = y0; cy <= y1; cy++) {
        const cell = cx + cy * gridW;
        const end = start[cell + 1];
        let k = start[cell];
        if (k === end || gx2 + axisGap2(y, cy) > reach2) continue;
        for (; k < end; k++) {
          const s = items[k];
          const dx = L.x[s] - x;
          const dy = L.y[s] - y;
          // Circle–circle: (radius + er)², not r² + er² (missed edge contacts).
          const maxD = radius + L.r[s];
          if (dx * dx + dy * dy <= maxD * maxD) fn(L.entry[s]);
        }
      }
    }
  }

  /**
   * Collect refs from layer L in range, each once, in first-cell order.
   * mode 0: predicate(entry) (or everything when null)
   * mode 1: live foes of `team`   (ref.team !== team, hp > 0, not fleeing)
   * mode 2: units of `team` other than `exclude`
   */
  function collect(L, x, y, radius, out, mode, predicate, team, exclude) {
    if (!L.n || !setWindow(x - radius, y - radius, x + radius, y + radius)) return;
    const x0 = wx0;
    const y0 = wy0;
    const x1 = wx1;
    const y1 = wy1;
    const start = L.cellStart;
    const items = L.items;
    const ex = L.x;
    const ey = L.y;
    const er = L.r;
    const minCx = L.minCx;
    const minCy = L.minCy;
    const refs = L.ref;
    const reach = radius + L.maxR * CELL_REACH + 1;
    const reach2 = reach * reach;
    let cells = 0;
    let tested = 0;
    for (let cx = x0; cx <= x1; cx++) {
      const gx2 = axisGap2(x, cx);
      if (gx2 > reach2) continue;
      for (let cy = y0; cy <= y1; cy++) {
        const cell = cx + cy * gridW;
        const end = start[cell + 1];
        let k = start[cell];
        if (k === end) continue;
        if (gx2 + axisGap2(y, cy) > reach2) continue;
        cells++;
        tested += end - k;
        for (; k < end; k++) {
          const s = items[k];
          // Report an entry only from the first cell of the window that holds it.
          const fx = minCx[s];
          const fy = minCy[s];
          if (cx !== (fx > x0 ? fx : x0) || cy !== (fy > y0 ? fy : y0)) continue;
          const dx = ex[s] - x;
          const dy = ey[s] - y;
          const maxD = radius + er[s];
          // Written as a negated <= so a NaN position is never reported.
          if (!(dx * dx + dy * dy <= maxD * maxD)) continue;
          const ref = refs[s];
          if (mode === 1) {
            if (ref.team === team || !(ref.hp > 0) || ref.fleeing) continue;
          } else if (mode === 2) {
            if (ref.team !== team || ref === exclude) continue;
          } else if (predicate && !predicate(L.entry[s])) continue;
          out.push(ref);
        }
      }
    }
    statCells += cells;
    statTested += tested;
  }

  function circleIntersectsRect(cx, cy, r, rx, ry, rw, rh) {
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy <= r * r;
  }

  function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
  }

  class QuadTree {
    constructor(x, y, w, h, depth = 0) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.depth = depth;
      this.entries = [];
      this.divided = false;
      this.children = null;
    }

    clear() {
      this.entries.length = 0;
      this.divided = false;
      this.children = null;
    }

    subdivide() {
      const hw = this.w / 2;
      const hh = this.h / 2;
      const x = this.x;
      const y = this.y;
      const d = this.depth + 1;
      this.children = [
        new QuadTree(x, y, hw, hh, d),
        new QuadTree(x + hw, y, hw, hh, d),
        new QuadTree(x, y + hh, hw, hh, d),
        new QuadTree(x + hw, y + hh, hw, hh, d),
      ];
      this.divided = true;
    }

    insert(entry) {
      if (!pointInRect(entry.x, entry.y, this.x, this.y, this.w, this.h)) return false;
      if (this.entries.length < QT_CAPACITY || this.depth >= QT_MAX_DEPTH) {
        this.entries.push(entry);
        return true;
      }
      if (!this.divided) {
        this.subdivide();
        for (const e of this.entries) {
          for (const child of this.children) child.insert(e);
        }
        this.entries.length = 0;
      }
      for (const child of this.children) {
        if (child.insert(entry)) return true;
      }
      this.entries.push(entry);
      return true;
    }

    queryCircle(cx, cy, radius, fn) {
      if (!circleIntersectsRect(cx, cy, radius, this.x, this.y, this.w, this.h)) return;
      const reach = radius;
      for (const entry of this.entries) {
        const dx = entry.x - cx;
        const dy = entry.y - cy;
        const er = entry.r || 0;
        const maxDist = reach + er;
        if (dx * dx + dy * dy <= maxDist * maxDist) fn(entry);
      }
      if (this.divided) {
        for (const child of this.children) child.queryCircle(cx, cy, radius, fn);
      }
    }

    queryRect(minX, minY, maxX, maxY, fn) {
      if (maxX < this.x || minX > this.x + this.w || maxY < this.y || minY > this.y + this.h)
        return;
      for (const entry of this.entries) {
        if (entry.x >= minX && entry.x <= maxX && entry.y >= minY && entry.y <= maxY) fn(entry);
      }
      if (this.divided) {
        for (const child of this.children) child.queryRect(minX, minY, maxX, maxY, fn);
      }
    }
  }

  function init(wW, wH) {
    worldW = Math.max(1, Number(wW) || 1);
    worldH = Math.max(1, Number(wH) || 1);
    gridW = Math.ceil(worldW / CELL) + 1;
    gridH = Math.ceil(worldH / CELL) + 1;
    hazardTree = new QuadTree(0, 0, worldW, worldH);
    clear();
  }

  function clear() {
    resetLayer(staticLayer);
    resetLayer(unitLayer);
    dropRefs(staticLayer, false);
    dropRefs(unitLayer, true);
    hazardTree?.clear();
    maxHazardRadius = 0;
  }

  function buildingSpatialRadius(b) {
    const blocks =
      typeof buildingBlocksTerrain === 'function'
        ? buildingBlocksTerrain(b) && b.blocksMove !== false
        : b.blocksMove !== false;
    let r = 0;
    if (blocks) {
      r = typeof terrainBlockRadius === 'function' ? terrainBlockRadius(b) : b.radius || 24;
    }
    if (b.owner === 'enemy' || b.isEnemySettlement || b.isHamlet || b.isResourceGen) {
      const siegeR = b.attackRadius ?? b.radius ?? 0;
      if (siegeR > 0) r = Math.max(r, siegeR);
      else if (!blocks) r = Math.max(r, 28);
    }
    return r;
  }

  function addStatic(entry) {
    const L = staticLayer;
    const s = L.n++;
    growLayer(L, L.n);
    L.entry[s] = entry;
    L.ref[s] = entry.ref;
    placeEntry(L, s, entry.x, entry.y, entry.r);
  }

  function rebuildStatic(buildings, decorations) {
    const L = staticLayer;
    const had = L.n;
    resetLayer(L);
    for (const b of buildings) {
      if (b.hp <= 0) continue;
      const r = buildingSpatialRadius(b);
      if (r <= 0) continue;
      addStatic({
        kind: 'building',
        ref: b,
        x: b.x,
        y: b.y,
        r,
        owner: b.owner,
        type: b.type,
        blocksMove: b.blocksMove,
      });
    }
    for (const d of decorations) {
      if (d.hp !== undefined && d.hp <= 0) continue;
      if (d.blocksMove === false) continue;
      const r =
        typeof terrainBlockRadius === 'function' ? terrainBlockRadius(d) : d.radius || d.size || 12;
      if (r <= 0) continue;
      addStatic({
        kind: 'deco',
        ref: d,
        x: d.x,
        y: d.y,
        r,
        type: d.type,
        blocksMove: d.blocksMove,
      });
    }
    for (let i = L.n; i < had; i++) {
      L.entry[i] = null;
      L.ref[i] = null;
    }
    finishLayer(L);
  }

  function rebuildDynamic(units) {
    const L = unitLayer;
    const had = L.n;
    resetLayer(L);
    growLayer(L, units.length);
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.hp <= 0) continue;
      const r = (u.radius || 14) + 4;
      const s = L.n++;
      let e = L.entry[s];
      if (!e) {
        e = { kind: 'unit', ref: null, x: 0, y: 0, r: 0, team: undefined };
        L.entry[s] = e;
      }
      e.ref = u;
      e.x = u.x;
      e.y = u.y;
      e.r = r;
      e.team = u.team;
      L.ref[s] = u;
      placeEntry(L, s, u.x, u.y, r);
    }
    for (let i = L.n; i < had; i++) {
      L.ref[i] = null;
      if (L.entry[i]) L.entry[i].ref = null;
    }
    finishLayer(L);
  }

  function rebuildHazards(hazards) {
    hazardTree.clear();
    maxHazardRadius = 0;
    for (const h of hazards || []) {
      const r = h.radius || 0;
      if (r <= 0) continue;
      maxHazardRadius = Math.max(maxHazardRadius, r);
      hazardTree.insert({
        kind: 'hazard',
        ref: h,
        x: h.x,
        y: h.y,
        r,
      });
    }
  }

  function forUnitsInRadius(x, y, radius, fn) {
    forEntries(unitLayer, x, y, radius, fn);
  }

  function forCellsInRadius(x, y, radius, fn) {
    forEntries(staticLayer, x, y, radius, fn);
    forEntries(unitLayer, x, y, radius, fn);
  }

  function collectHazards(x, y, radius, predicate, out) {
    hazardTree.queryCircle(x, y, radius, (entry) => {
      if (predicate && !predicate(entry)) return;
      out.push(entry.ref);
    });
  }

  /** Everything in range that passes predicate(entry): obstacles, then units, then hazards. */
  function queryRadiusInto(x, y, radius, predicate, out) {
    out.length = 0;
    statQueries++;
    collect(staticLayer, x, y, radius, out, 0, predicate, null, null);
    collect(unitLayer, x, y, radius, out, 0, predicate, null, null);
    if (hazardTree && maxHazardRadius > 0) collectHazards(x, y, radius, predicate, out);
    return out;
  }

  function queryRadius(x, y, radius, predicate) {
    queryRadiusInto(x, y, radius, predicate, queryScratch);
    return queryScratch.slice();
  }

  /** Units only: every live, non-fleeing unit that is not on `team`. No predicate call. */
  function queryFoesInto(x, y, radius, team, out) {
    out.length = 0;
    statQueries++;
    collect(unitLayer, x, y, radius, out, 1, null, team, null);
    return out;
  }

  /** Units only: every unit on `team` except `exclude` (dead ones included, as indexed). */
  function queryTeamInto(x, y, radius, team, exclude, out) {
    out.length = 0;
    statQueries++;
    collect(unitLayer, x, y, radius, out, 2, null, team, exclude);
    return out;
  }

  /** Buildings and decorations only. */
  function queryStaticInto(x, y, radius, out) {
    out.length = 0;
    statQueries++;
    collect(staticLayer, x, y, radius, out, 0, null, null, null);
    return out;
  }

  /**
   * Nearest entry of layer L strictly inside bestD2 (first found wins a tie).
   * mode 0: predicate(entry); mode 3: unit of `team` that is alive, not fleeing, not demoralized.
   */
  let nearestD2 = 0;
  function nearestIn(L, x, y, radius, best, mode, predicate, team) {
    if (!L.n || !setWindow(x - radius, y - radius, x + radius, y + radius)) return best;
    const x0 = wx0;
    const y0 = wy0;
    const x1 = wx1;
    const y1 = wy1;
    const start = L.cellStart;
    const items = L.items;
    const ex = L.x;
    const ey = L.y;
    const pad = L.maxR * CELL_REACH + 1;
    let bestD2 = nearestD2;
    let cells = 0;
    let tested = 0;
    for (let cx = x0; cx <= x1; cx++) {
      const gx2 = axisGap2(x, cx);
      for (let cy = y0; cy <= y1; cy++) {
        const cell = cx + cy * gridW;
        const end = start[cell + 1];
        let k = start[cell];
        if (k === end) continue;
        // Nothing in a cell further off than the best so far can beat it.
        const g2 = gx2 + axisGap2(y, cy);
        if (g2 > pad * pad) {
          const g = Math.sqrt(g2) - pad;
          if (g * g >= bestD2) continue;
        }
        cells++;
        tested += end - k;
        for (; k < end; k++) {
          const s = items[k];
          const dx = ex[s] - x;
          const dy = ey[s] - y;
          const d2 = dx * dx + dy * dy;
          if (!(d2 < bestD2)) continue;
          if (mode === 3) {
            const ref = L.ref[s];
            if (ref.team !== team || !(ref.hp > 0) || ref.fleeing || ref.demoralized) continue;
          } else if (predicate && !predicate(L.entry[s])) continue;
          bestD2 = d2;
          best = L.ref[s];
        }
      }
    }
    statCells += cells;
    statTested += tested;
    nearestD2 = bestD2;
    return best;
  }

  function queryNearest(x, y, radius, predicate) {
    statQueries++;
    nearestD2 = radius * radius;
    let best = nearestIn(staticLayer, x, y, radius, null, 0, predicate, null);
    best = nearestIn(unitLayer, x, y, radius, best, 0, predicate, null);
    let d2 = nearestD2;
    if (hazardTree && maxHazardRadius > 0) {
      hazardTree.queryCircle(x, y, radius, (entry) => {
        if (predicate && !predicate(entry)) return;
        const dx = entry.x - x;
        const dy = entry.y - y;
        const e2 = dx * dx + dy * dy;
        if (e2 < d2) {
          d2 = e2;
          best = entry.ref;
        }
      });
    }
    return best;
  }

  /** Nearest unit of `team` that can be fought: alive, not fleeing, not demoralized. */
  function queryNearestFighter(x, y, radius, team) {
    statQueries++;
    nearestD2 = radius * radius;
    return nearestIn(unitLayer, x, y, radius, null, 3, null, team);
  }

  function rectCell(L, cell, cx, cy, x0, y0, minX, minY, maxX, maxY, predicate, out) {
    const end = L.cellStart[cell + 1];
    for (let k = L.cellStart[cell]; k < end; k++) {
      const s = L.items[k];
      const fx = L.minCx[s];
      const fy = L.minCy[s];
      if (cx !== (fx > x0 ? fx : x0) || cy !== (fy > y0 ? fy : y0)) continue;
      const px = L.x[s];
      const py = L.y[s];
      if (px < minX || px > maxX || py < minY || py > maxY) continue;
      if (predicate && !predicate(L.entry[s])) continue;
      out.push(L.ref[s]);
    }
  }

  /** Entries whose centre lies in the rectangle: per cell, obstacles then units; hazards last. */
  function queryRect(minX, minY, maxX, maxY, predicate) {
    const out = [];
    statQueries++;
    if (setWindow(minX, minY, maxX, maxY)) {
      const x0 = wx0;
      const y0 = wy0;
      const x1 = wx1;
      const y1 = wy1;
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const cell = cx + cy * gridW;
          if (staticLayer.n)
            rectCell(staticLayer, cell, cx, cy, x0, y0, minX, minY, maxX, maxY, predicate, out);
          if (unitLayer.n)
            rectCell(unitLayer, cell, cx, cy, x0, y0, minX, minY, maxX, maxY, predicate, out);
        }
      }
    }
    if (hazardTree && maxHazardRadius > 0) {
      hazardTree.queryRect(minX, minY, maxX, maxY, (entry) => {
        if (entry.x < minX || entry.x > maxX || entry.y < minY || entry.y > maxY) return;
        if (predicate && !predicate(entry)) return;
        out.push(entry.ref);
      });
    }
    return out;
  }

  /** Hazards whose area contains (x, y) — for per-unit hazard application. */
  function queryHazardsAtInto(x, y, out) {
    out.length = 0;
    if (!hazardTree || maxHazardRadius <= 0) return out;
    hazardTree.queryCircle(x, y, maxHazardRadius, (entry) => {
      const h = entry.ref;
      const dx = x - h.x;
      const dy = y - h.y;
      if (dx * dx + dy * dy <= h.radius * h.radius) out.push(h);
    });
    return out;
  }

  function queryHazardsAt(x, y) {
    return queryHazardsAtInto(x, y, hazardScratch).slice();
  }

  function getMaxHazardRadius() {
    return maxHazardRadius;
  }

  /** Grid figures for the F3 overlay. Query counters run since the last resetStats(). */
  function getStats() {
    return {
      cols: gridW,
      rows: gridH,
      units: unitLayer.n,
      unitCellRefs: unitLayer.itemCount,
      statics: staticLayer.n,
      staticCellRefs: staticLayer.itemCount,
      queries: statQueries,
      cellsVisited: statCells,
      entriesTested: statTested,
    };
  }

  function resetStats() {
    statQueries = 0;
    statCells = 0;
    statTested = 0;
  }

  return {
    init,
    clear,
    rebuildStatic,
    rebuildDynamic,
    rebuildHazards,
    queryRadius,
    queryRadiusInto,
    queryFoesInto,
    queryTeamInto,
    queryStaticInto,
    queryNearest,
    queryNearestFighter,
    queryRect,
    queryHazardsAt,
    queryHazardsAtInto,
    getMaxHazardRadius,
    forCellsInRadius,
    forUnitsInRadius,
    getStats,
    resetStats,
    CELL,
    _scratch: queryScratch,
    _hazardScratch: hazardScratch,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Spatial = Spatial;
