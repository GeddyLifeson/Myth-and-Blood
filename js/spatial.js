/**
 * Uniform-grid spatial hash for units, buildings, and obstacles.
 */
const Spatial = (() => {
  const CELL = 64;
  let gridW = 0;
  let gridH = 0;
  const buckets = new Map();

  function key(cx, cy) {
    return `${cx},${cy}`;
  }

  function toCell(x, y) {
    return {
      cx: Math.floor(x / CELL),
      cy: Math.floor(y / CELL),
    };
  }

  function inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < gridW && cy < gridH;
  }

  function init(worldW, worldH) {
    gridW = Math.ceil(worldW / CELL) + 1;
    gridH = Math.ceil(worldH / CELL) + 1;
    clear();
  }

  function clear() {
    buckets.clear();
  }

  function insert(cx, cy, entry) {
    if (!inBounds(cx, cy)) return;
    const k = key(cx, cy);
    let list = buckets.get(k);
    if (!list) {
      list = [];
      buckets.set(k, list);
    }
    list.push(entry);
  }

  function insertRadius(x, y, radius, entry) {
    const min = toCell(x - radius, y - radius);
    const max = toCell(x + radius, y + radius);
    for (let cx = min.cx; cx <= max.cx; cx++) {
      for (let cy = min.cy; cy <= max.cy; cy++) {
        insert(cx, cy, entry);
      }
    }
  }

  function rebuild(units, buildings, decorations) {
    clear();
    for (const u of units) {
      if (u.hp <= 0) continue;
      const r = (u.radius || 14) + 4;
      insertRadius(u.x, u.y, r, { kind: 'unit', ref: u, x: u.x, y: u.y, r, team: u.team });
    }
    for (const b of buildings) {
      if (b.hp <= 0) continue;
      const blocks = typeof buildingBlocksTerrain === 'function' ? buildingBlocksTerrain(b) : true;
      if (!blocks || b.blocksMove === false) continue;
      const r = typeof terrainBlockRadius === 'function' ? terrainBlockRadius(b) : (b.radius || 24);
      if (r <= 0) continue;
      insertRadius(b.x, b.y, r, {
        kind: 'building', ref: b, x: b.x, y: b.y, r,
        owner: b.owner, type: b.type, blocksMove: b.blocksMove,
      });
    }
    for (const d of decorations) {
      if (d.hp !== undefined && d.hp <= 0) continue;
      if (d.blocksMove === false) continue;
      const r = typeof terrainBlockRadius === 'function' ? terrainBlockRadius(d) : (d.radius || d.size || 12);
      if (r <= 0) continue;
      insertRadius(d.x, d.y, r, {
        kind: 'deco', ref: d, x: d.x, y: d.y, r,
        type: d.type, blocksMove: d.blocksMove,
      });
    }
  }

  function forCellsInRadius(x, y, radius, fn) {
    const min = toCell(x - radius, y - radius);
    const max = toCell(x + radius, y + radius);
    const r2 = radius * radius;
    for (let cx = min.cx; cx <= max.cx; cx++) {
      for (let cy = min.cy; cy <= max.cy; cy++) {
        if (!inBounds(cx, cy)) continue;
        const list = buckets.get(key(cx, cy));
        if (!list) continue;
        for (const entry of list) {
          const dx = entry.x - x;
          const dy = entry.y - y;
          if (dx * dx + dy * dy <= r2 + (entry.r || 0) * (entry.r || 0)) fn(entry);
        }
      }
    }
  }

  function queryRadius(x, y, radius, predicate) {
    const out = [];
    const seen = new Set();
    forCellsInRadius(x, y, radius, (entry) => {
      const id = entry.ref?.id ?? entry.ref;
      if (id !== undefined && seen.has(id)) return;
      if (id !== undefined) seen.add(id);
      if (!predicate || predicate(entry)) out.push(entry.ref);
    });
    return out;
  }

  function queryNearest(x, y, radius, predicate) {
    let best = null;
    let bestD2 = radius * radius;
    forCellsInRadius(x, y, radius, (entry) => {
      if (predicate && !predicate(entry)) return;
      const dx = entry.x - x;
      const dy = entry.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = entry.ref;
      }
    });
    return best;
  }

  function queryRect(minX, minY, maxX, maxY, predicate) {
    const min = toCell(minX, minY);
    const max = toCell(maxX, maxY);
    const out = [];
    const seen = new Set();
    for (let cx = min.cx; cx <= max.cx; cx++) {
      for (let cy = min.cy; cy <= max.cy; cy++) {
        if (!inBounds(cx, cy)) continue;
        const list = buckets.get(key(cx, cy));
        if (!list) continue;
        for (const entry of list) {
          if (entry.x < minX || entry.x > maxX || entry.y < minY || entry.y > maxY) continue;
          const id = entry.ref?.id ?? entry.ref;
          if (id !== undefined && seen.has(id)) continue;
          if (id !== undefined) seen.add(id);
          if (!predicate || predicate(entry)) out.push(entry.ref);
        }
      }
    }
    return out;
  }

  return {
    init, clear, rebuild, queryRadius, queryNearest, queryRect, CELL,
  };
})();