/**
 * Spatial index: uniform grid for static obstacles and units, quadtree for hazards.
 * Static (buildings/deco) and dynamic (units/hazards) layers rebuild independently.
 */
const Spatial = (() => {
  const CELL = 64;
  const QT_CAPACITY = 10;
  const QT_MAX_DEPTH = 9;

  let gridW = 0;
  let gridH = 0;
  let worldW = 0;
  let worldH = 0;
  const staticBuckets = new Map();
  const unitBuckets = new Map();
  let hazardTree = null;
  let maxHazardRadius = 0;
  const querySeen = new Set();
  const queryScratch = [];
  const hazardScratch = [];

  function key(cx, cy) {
    return cx + ',' + cy;
  }

  function toCell(x, y) {
    const fx = Number(x);
    const fy = Number(y);
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) return { cx: 0, cy: 0 };
    return {
      cx: Math.floor(fx / CELL),
      cy: Math.floor(fy / CELL),
    };
  }

  function inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < gridW && cy < gridH;
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
    staticBuckets.clear();
    unitBuckets.clear();
    hazardTree?.clear();
    maxHazardRadius = 0;
  }

  function insertInto(map, cx, cy, entry) {
    if (!inBounds(cx, cy)) return;
    const k = key(cx, cy);
    let list = map.get(k);
    if (!list) {
      list = [];
      map.set(k, list);
    }
    list.push(entry);
  }

  function insertRadiusInto(map, x, y, radius, entry) {
    const min = toCell(x - radius, y - radius);
    const max = toCell(x + radius, y + radius);
    for (let cx = min.cx; cx <= max.cx; cx++) {
      for (let cy = min.cy; cy <= max.cy; cy++) {
        insertInto(map, cx, cy, entry);
      }
    }
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

  function rebuildStatic(buildings, decorations) {
    staticBuckets.clear();
    for (const b of buildings) {
      if (b.hp <= 0) continue;
      const r = buildingSpatialRadius(b);
      if (r <= 0) continue;
      insertRadiusInto(staticBuckets, b.x, b.y, r, {
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
      insertRadiusInto(staticBuckets, d.x, d.y, r, {
        kind: 'deco',
        ref: d,
        x: d.x,
        y: d.y,
        r,
        type: d.type,
        blocksMove: d.blocksMove,
      });
    }
  }

  function rebuildDynamic(units) {
    unitBuckets.clear();
    for (const u of units) {
      if (u.hp <= 0) continue;
      const r = (u.radius || 14) + 4;
      insertRadiusInto(unitBuckets, u.x, u.y, r, {
        kind: 'unit',
        ref: u,
        x: u.x,
        y: u.y,
        r,
        team: u.team,
      });
    }
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

  function rebuild(units, buildings, decorations, hazards) {
    rebuildStatic(buildings, decorations);
    rebuildDynamic(units);
    rebuildHazards(hazards);
  }

  function forCellsInMap(map, x, y, radius, fn) {
    const min = toCell(x - radius, y - radius);
    const max = toCell(x + radius, y + radius);
    const r2 = radius * radius;
    for (let cx = min.cx; cx <= max.cx; cx++) {
      for (let cy = min.cy; cy <= max.cy; cy++) {
        if (!inBounds(cx, cy)) continue;
        const list = map.get(key(cx, cy));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const entry = list[i];
          const dx = entry.x - x;
          const dy = entry.y - y;
          const er = entry.r || 0;
          // Circle–circle: (radius + er)², not r² + er² (missed edge contacts).
          const maxD = radius + er;
          if (dx * dx + dy * dy <= maxD * maxD) fn(entry);
        }
      }
    }
  }

  function forUnitsInRadius(x, y, radius, fn) {
    forCellsInMap(unitBuckets, x, y, radius, fn);
  }

  // `seen` is injectable so callers that must stay reentrant (queryRect) can pass
  // their own Set instead of sharing the module-level querySeen scratch.
  function collectEntry(entry, predicate, out, seen = querySeen) {
    if (predicate && !predicate(entry)) return;
    const id = entry.ref?.id ?? entry.ref;
    if (id !== undefined && seen.has(id)) return;
    if (id !== undefined) seen.add(id);
    out.push(entry.ref);
  }

  function forCellsInRadius(x, y, radius, fn) {
    forCellsInMap(staticBuckets, x, y, radius, fn);
    forUnitsInRadius(x, y, radius, fn);
  }

  function queryRadiusInto(x, y, radius, predicate, out) {
    out.length = 0;
    querySeen.clear();
    forCellsInMap(staticBuckets, x, y, radius, (entry) => collectEntry(entry, predicate, out));
    forUnitsInRadius(x, y, radius, (entry) => collectEntry(entry, predicate, out));
    if (hazardTree && maxHazardRadius > 0) {
      hazardTree.queryCircle(x, y, radius, (entry) => collectEntry(entry, predicate, out));
    }
    return out;
  }

  function queryRadius(x, y, radius, predicate) {
    queryRadiusInto(x, y, radius, predicate, queryScratch);
    return queryScratch.slice();
  }

  function queryNearest(x, y, radius, predicate) {
    let best = null;
    let bestD2 = radius * radius;
    const consider = (entry) => {
      if (predicate && !predicate(entry)) return;
      const dx = entry.x - x;
      const dy = entry.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = entry.ref;
      }
    };
    forCellsInMap(staticBuckets, x, y, radius, consider);
    forUnitsInRadius(x, y, radius, consider);
    if (hazardTree && maxHazardRadius > 0) {
      hazardTree.queryCircle(x, y, radius, consider);
    }
    return best;
  }

  function queryRect(minX, minY, maxX, maxY, predicate) {
    const out = [];
    // Local Set (not the shared querySeen) so a predicate that runs another
    // Spatial query cannot clobber this one's dedup state.
    const seen = new Set();
    const visit = (entry) => {
      if (entry.x < minX || entry.x > maxX || entry.y < minY || entry.y > maxY) return;
      collectEntry(entry, predicate, out, seen);
    };
    const min = toCell(minX, minY);
    const max = toCell(maxX, maxY);
    for (let cx = min.cx; cx <= max.cx; cx++) {
      for (let cy = min.cy; cy <= max.cy; cy++) {
        if (!inBounds(cx, cy)) continue;
        const k = key(cx, cy);
        const list = staticBuckets.get(k);
        if (list) {
          for (let i = 0; i < list.length; i++) visit(list[i]);
        }
        const ulist = unitBuckets.get(k);
        if (ulist) {
          for (let i = 0; i < ulist.length; i++) visit(ulist[i]);
        }
      }
    }
    if (hazardTree && maxHazardRadius > 0) {
      hazardTree.queryRect(minX, minY, maxX, maxY, visit);
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

  return {
    init,
    clear,
    rebuild,
    rebuildStatic,
    rebuildDynamic,
    rebuildHazards,
    queryRadius,
    queryRadiusInto,
    queryNearest,
    queryRect,
    queryHazardsAt,
    queryHazardsAtInto,
    getMaxHazardRadius,
    forCellsInRadius,
    forUnitsInRadius,
    CELL,
    _scratch: queryScratch,
    _hazardScratch: hazardScratch,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Spatial = Spatial;
