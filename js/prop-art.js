/**
 * Prop art for Myth and Blood: the small things on the field that are not buildings.
 *
 * - Hazards: plague bog, fire pit, void tear, grave miasma, mirror rift. Each is a ground
 *   decal sized to its real radius, cached per kind and size, with a few live strokes
 *   (flames, bubbles, wisps) on top.
 * - Barricades, beast dens, supply crates and oil barrels, each with a hurt state, and a
 *   wreck that stays on the ground for a while once it is opened, burst or broken.
 *
 * Everything is inked once into an offscreen canvas and blitted. Uses the drawing kit from
 * js/building-art.js; without it this module does not publish itself and the game falls
 * back to the old drawings.
 */
const PropArt = (() => {
  const K = typeof BuildingArt !== 'undefined' ? BuildingArt.kit : null;
  if (!K || typeof document === 'undefined') return null;
  const { INK, BONE, BLOOD, C, TAU, mulberry, poly, rect, line, stroke, ell, hatch, beam } = K;
  const SC = 3;
  const CACHE_MAX = 160;
  const cache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /** A cached sprite. ext = [left, up, right, down] in world units from the prop's origin. */
  function sprite(key, ext, paint) {
    let e = cache.get(key);
    if (e) return e;
    const [l, u, r, d] = ext;
    const cv = makeCanvas((l + r) * SC, (u + d) * SC);
    const g = cv.getContext('2d');
    g.setTransform(SC, 0, 0, SC, l * SC, u * SC);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    try {
      paint(g);
    } catch (err) {
      console.error('PropArt paint failed for', key, err);
    }
    e = { cv, ox: l, oy: u, w: l + r, h: u + d };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, e);
    return e;
  }

  function blit(ctx, e, x, y) {
    ctx.drawImage(e.cv, x - e.ox, y - e.oy, e.w, e.h);
  }

  function hashOf(d) {
    const s = String(d.id || '') + '|' + (d.type || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0) % 3;
  }

  /** A ragged closed outline round an ellipse, as a flat point list. */
  function ragged(rnd, rx, ry, n, rough) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 - rough + rnd() * rough * 2;
      pts.push(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
    }
    return pts;
  }

  function smooth(g, pts) {
    const n = pts.length / 2;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[((i + 1) % n) * 2];
      const y1 = pts[((i + 1) % n) * 2 + 1];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      if (i === 0) g.moveTo(mx, my);
      else g.quadraticCurveTo(x0, y0, mx, my);
    }
    g.quadraticCurveTo(pts[0], pts[1], (pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2);
    g.closePath();
  }

  function pool(g, pts, fill, lw, alpha) {
    smooth(g, pts);
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.fillStyle = fill;
    g.fill();
    g.globalAlpha = 1;
    if (lw) {
      g.lineWidth = lw;
      g.strokeStyle = INK;
      g.stroke();
    }
  }

  /** The reach of a hazard: a broken ring in its own colour over an ink ring. */
  function reach(g, rx, ry, col) {
    g.setLineDash([5, 4]);
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, TAU);
    g.lineWidth = 2.2;
    g.strokeStyle = 'rgba(7,5,10,0.7)';
    g.stroke();
    g.lineWidth = 1.1;
    g.strokeStyle = col;
    g.stroke();
    g.setLineDash([]);
  }

  function smallBone(g, x, y, len, ang) {
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    line(g, x, y, x + dx, y + dy, 2, INK);
    line(g, x, y, x + dx, y + dy, 1, BONE);
  }

  function skullAt(g, x, y, s) {
    ell(g, x, y - 1.1 * s, 2 * s, 1.9 * s, BONE, 0.9);
    rect(g, x - 1.1 * s, y + 0.2 * s, 2.2 * s, 1.5 * s, BONE, 0.8);
    rect(g, x - 1.3 * s, y - 1.5 * s, 0.9 * s, 1.1 * s, INK, 0);
    rect(g, x + 0.4 * s, y - 1.5 * s, 0.9 * s, 1.1 * s, INK, 0);
  }

  // ----------------------------------------------------------------- hazards
  const YSQ = 0.82; // the ground is seen from above and a little south

  const HAZ = {
    // Plague bog: black-green water, reeds, a drowned skull.
    plague(g, r, rnd) {
      const ry = r * YSQ;
      pool(g, ragged(rnd, r * 0.98, ry * 0.98, 16, 0.12), '#1c2a1c', 0, 0.55);
      pool(g, ragged(rnd, r * 0.82, ry * 0.8, 14, 0.14), '#2e4a2a', 1.3, 0.92);
      pool(g, ragged(rnd, r * 0.56, ry * 0.5, 11, 0.2), '#16221a', 0.8, 0.9);
      for (let i = 0; i < 5; i++) {
        const a = rnd() * TAU;
        const d = 0.2 + rnd() * 0.5;
        const x = Math.cos(a) * r * d;
        const y = Math.sin(a) * ry * d;
        const w = 2.5 + rnd() * r * 0.14;
        stroke(g, [x - w, y, x - w * 0.3, y - 1, x + w * 0.4, y + 0.4, x + w, y - 0.4], 0.7, '#7fae5a');
      }
      for (let i = 0; i < 7; i++) {
        const a = rnd() * TAU;
        const x = Math.cos(a) * r * 0.78;
        const y = Math.sin(a) * ry * 0.76;
        for (let k = -1; k <= 1; k++) {
          line(g, x + k * 1.2, y, x + k * 2.4, y - 5 - rnd() * 3, 1.5, INK);
          line(g, x + k * 1.2, y, x + k * 2.4, y - 5 - rnd() * 3, 0.7, '#8a9a4a');
        }
      }
      skullAt(g, -r * 0.3, ry * 0.2, 0.9);
      smallBone(g, r * 0.25, ry * 0.3, 5, 0.4);
      reach(g, r, ry, '#8fd060');
    },
    // Fire pit: scorched ground split by glowing cracks round a ring of stones and coals.
    fire(g, r, rnd) {
      const ry = r * YSQ;
      pool(g, ragged(rnd, r * 0.98, ry * 0.98, 16, 0.14), '#100a0a', 0, 0.8);
      pool(g, ragged(rnd, r * 0.7, ry * 0.68, 13, 0.16), '#090606', 1.1, 0.92);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + rnd() * 0.5;
        const pts = [Math.cos(a) * r * 0.3, Math.sin(a) * ry * 0.3];
        let d = 0.3;
        let aa = a;
        while (d < 0.86) {
          d += 0.14 + rnd() * 0.1;
          aa += (rnd() - 0.5) * 0.5;
          pts.push(Math.cos(aa) * r * d, Math.sin(aa) * ry * d);
        }
        stroke(g, pts, 2.2, INK);
        stroke(g, pts, 1.1, i % 2 ? '#f07a28' : '#f8b850');
      }
      const pr = Math.max(6, r * 0.3);
      ell(g, 0, 0, pr, pr * 0.62, '#2a100c', 1.3);
      ell(g, 0, 0, pr * 0.66, pr * 0.4, C.ember, 0.7);
      ell(g, -pr * 0.15, 0, pr * 0.3, pr * 0.18, C.flame, 0);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        ell(g, Math.cos(a) * pr, Math.sin(a) * pr * 0.62, 1.9, 1.5, i % 3 ? C.stoneD : C.stone, 0.8);
      }
      reach(g, r, ry, '#f08030');
    },
    // Void tear: a split in the ground, violet inside, the earth lifting round it in shards.
    void(g, r, rnd) {
      const ry = r * YSQ;
      pool(g, ragged(rnd, r * 0.98, ry * 0.98, 16, 0.12), '#1a0f26', 0, 0.6);
      for (const k of [0.8, 0.56]) {
        g.setLineDash([r * 0.3, r * 0.14]);
        g.lineDashOffset = k * 40;
        ell(g, 0, 0, r * k, ry * k, null, 1.1);
        g.setLineDash([]);
      }
      const tear = [];
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        tear.push(-r * 0.62 + t * r * 1.24, (rnd() - 0.5) * ry * 0.16 - Math.sin(t * Math.PI) * ry * 0.22);
      }
      for (let i = n; i >= 0; i--) {
        const t = i / n;
        tear.push(-r * 0.62 + t * r * 1.24, (rnd() - 0.5) * ry * 0.16 + Math.sin(t * Math.PI) * ry * 0.24);
      }
      poly(g, tear, '#3c1a66', 1.5);
      const inner = tear.map((v, i) => (i % 2 ? v * 0.5 : v * 0.8));
      poly(g, inner, '#9a5ae0', 0);
      poly(g, inner.map((v, i) => (i % 2 ? v * 0.4 : v * 0.6)), '#e4c8ff', 0);
      for (let i = 0; i < 6; i++) {
        const a = rnd() * TAU;
        const d = 0.5 + rnd() * 0.3;
        const x = Math.cos(a) * r * d;
        const y = Math.sin(a) * ry * d;
        const s = 2 + rnd() * 2.4;
        poly(g, [x - s, y, x - s * 0.2, y - s * 2.2, x + s, y], '#2c2038', 1);
        line(g, x - s * 0.2, y - s * 2.2, x + s * 0.2, y, 0.6, '#9a5ae0');
      }
      reach(g, r, ry, '#b070ff');
    },
    // Grave miasma: turned earth, leaning markers and bones under a pale standing fog.
    miasma(g, r, rnd) {
      const ry = r * YSQ;
      pool(g, ragged(rnd, r * 0.98, ry * 0.98, 16, 0.12), '#1a242a', 0, 0.58);
      pool(g, ragged(rnd, r * 0.72, ry * 0.7, 13, 0.16), '#27343a', 1, 0.8);
      hatch(g, ragged(rnd, r * 0.7, ry * 0.68, 12, 0.1), 3, 0.6, 0.5);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.6 + rnd() * 0.6;
        const x = Math.cos(a) * r * 0.42;
        const y = Math.sin(a) * ry * 0.4;
        const lean = (rnd() - 0.5) * 2.4;
        poly(
          g,
          [x - 2.4, y + 2, x - 2.4 + lean, y - 4, x + lean, y - 6.4, x + 2.4 + lean, y - 4, x + 2.4, y + 2],
          C.stoneD,
          1
        );
        line(g, x + lean * 0.6, y - 4.4, x + lean * 0.4, y - 0.6, 0.6);
        line(g, x - 1.2 + lean * 0.5, y - 3, x + 1.2 + lean * 0.5, y - 3, 0.6);
      }
      skullAt(g, r * 0.1, ry * 0.42, 0.85);
      smallBone(g, -r * 0.4, ry * 0.36, 5, -0.3);
      smallBone(g, r * 0.36, -ry * 0.1, 4, 1.1);
      reach(g, r, ry, '#a8c8d8');
    },
    // Mirror rift: a sheet of broken glass lying in the dirt, shards standing at its rim.
    rift(g, r, rnd) {
      const ry = r * YSQ;
      pool(g, ragged(rnd, r * 0.98, ry * 0.98, 16, 0.1), '#141c28', 0, 0.55);
      const glass = ragged(rnd, r * 0.7, ry * 0.62, 9, 0.16);
      poly(g, glass, '#56789c', 1.3);
      g.save();
      K.trace(g, glass);
      g.clip();
      poly(g, [-r, -ry, r * 0.1, -ry, -r * 0.5, ry, -r, ry], '#86aacc', 0);
      for (let i = 0; i < 6; i++) {
        const a = rnd() * TAU;
        stroke(
          g,
          [0, 0, Math.cos(a) * r * 0.3, Math.sin(a) * ry * 0.3 + rnd() * 2, Math.cos(a + 0.2) * r * 0.8, Math.sin(a + 0.2) * ry * 0.8],
          0.8
        );
      }
      line(g, -r * 0.4, -ry * 0.3, -r * 0.1, -ry * 0.44, 1, '#e8f2ff');
      g.restore();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rnd() * 0.5;
        const x = Math.cos(a) * r * 0.76;
        const y = Math.sin(a) * ry * 0.7;
        const s = 2 + rnd() * 2;
        poly(g, [x - s, y, x + s * 0.3, y - s * 2.6, x + s, y], '#9cc0e0', 1);
        line(g, x + s * 0.3, y - s * 2.6, x, y, 0.5);
      }
      reach(g, r, ry, '#a0d0ff');
    },
    // Anything unknown: a blood-ringed bad patch.
    other(g, r, rnd) {
      const ry = r * YSQ;
      pool(g, ragged(rnd, r * 0.96, ry * 0.96, 14, 0.12), '#1c1012', 1, 0.6);
      hatch(g, ragged(rnd, r * 0.8, ry * 0.8, 12, 0.1), 3, 0.7, 0.5);
      skullAt(g, 0, 0, 1);
      reach(g, r, ry, BLOOD);
    },
  };

  function hazardKind(h) {
    const t = h.drawType || h.type || '';
    if (t === 'plague' || t === 'swamp' || h.type === 'goblin_plague') return 'plague';
    if (t === 'fire' || h.type === 'orc_fire_pit') return 'fire';
    if (t === 'void' || h.type === 'void_corruption') return 'void';
    if (t === 'miasma' || h.type === 'undead_miasma') return 'miasma';
    if (t === 'rift' || h.type === 'mirror_rift_zone') return 'rift';
    return 'other';
  }

  function flame(ctx, x, y, s, tick, seed) {
    const a = Math.sin(tick * 0.31 + seed) * 0.9;
    const b = Math.sin(tick * 0.23 + seed * 1.7) * 0.7;
    ctx.beginPath();
    ctx.moveTo(x - 1.9 * s, y);
    ctx.quadraticCurveTo(x - 2.6 * s, y - 2.6 * s, x - 0.9 * s + a * 0.4 * s, y - 3.6 * s);
    ctx.lineTo(x - 0.5 * s + a * s * 0.6, y - 5.8 * s - b * s * 0.6);
    ctx.lineTo(x + 0.3 * s, y - 4 * s);
    ctx.lineTo(x + 1.2 * s + b * s * 0.5, y - 4.9 * s);
    ctx.quadraticCurveTo(x + 2.6 * s, y - 2.2 * s, x + 1.9 * s, y);
    ctx.closePath();
    ctx.fillStyle = C.ember;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 0.9 * s, y - 0.2 * s);
    ctx.quadraticCurveTo(x - 0.9 * s, y - 2 * s, x + a * 0.3 * s, y - 3.2 * s - b * 0.3 * s);
    ctx.quadraticCurveTo(x + 1 * s, y - 1.6 * s, x + 0.9 * s, y - 0.2 * s);
    ctx.closePath();
    ctx.fillStyle = C.flame;
    ctx.fill();
  }

  /** The moving part of a hazard: a handful of strokes, placed from the tick. */
  function hazardLive(ctx, kind, h, r, tick) {
    const ry = r * YSQ;
    const seed = h.x * 0.37 + h.y * 0.11;
    if (kind === 'fire') {
      const s = Math.max(1, r * 0.045);
      flame(ctx, h.x - r * 0.1, h.y + 1, s * 1.25, tick, seed);
      flame(ctx, h.x + r * 0.1, h.y + 2, s, tick, seed + 2);
      // sparks climbing off the cracks
      ctx.fillStyle = '#f0a040';
      for (let i = 0; i < 4; i++) {
        const t = (tick * 0.02 + i * 0.25 + seed) % 1;
        const a = seed + i * 1.7;
        ctx.globalAlpha = 1 - t;
        ctx.fillRect(h.x + Math.cos(a) * r * 0.55, h.y + Math.sin(a) * ry * 0.5 - t * 12, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'plague') {
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const t = (tick * 0.012 + i * 0.27 + seed) % 1;
        const gen = Math.floor(tick * 0.012 + i * 0.27 + seed);
        const a = gen * 2.4 + i;
        const x = h.x + Math.cos(a) * r * 0.4;
        const y = h.y + Math.sin(a) * ry * 0.36;
        const br = 0.8 + t * 2.2;
        ctx.globalAlpha = t < 0.85 ? 1 : (1 - t) / 0.15;
        ctx.beginPath();
        ctx.arc(x, y, br, 0, TAU);
        ctx.fillStyle = '#9fe070';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'void') {
      const p = 0.5 + 0.5 * Math.sin(tick * 0.08 + seed);
      ctx.globalAlpha = 0.25 + 0.3 * p;
      ctx.fillStyle = '#e4c8ff';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, r * (0.3 + 0.08 * p), ry * 0.07, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c090ff';
      for (let i = 0; i < 5; i++) {
        const t = (tick * 0.015 + i * 0.2 + seed) % 1;
        const a = seed + i * 1.3;
        ctx.globalAlpha = 1 - t;
        const d = r * (0.7 - t * 0.6);
        ctx.fillRect(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * YSQ - t * 6, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'miasma') {
      ctx.strokeStyle = 'rgba(200,220,230,0.5)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const y = h.y - ry * 0.5 + i * ry * 0.3;
        const off = Math.sin(tick * 0.02 + i * 1.9 + seed) * r * 0.2;
        const w = r * (0.5 - Math.abs(i - 1.5) * 0.08);
        ctx.moveTo(h.x - w + off, y);
        ctx.quadraticCurveTo(h.x + off, y - 3 + Math.sin(tick * 0.03 + i) * 2, h.x + w + off, y);
      }
      ctx.stroke();
    } else if (kind === 'rift') {
      const t = (tick * 0.01 + seed) % 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.9;
      const gx = h.x - r * 0.5 + t * r;
      ctx.beginPath();
      ctx.moveTo(gx - 3, h.y + ry * 0.2);
      ctx.lineTo(gx + 3, h.y - ry * 0.3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawHazard(ctx, h, tick = 0, env = {}) {
    if (!h) return false;
    const kind = hazardKind(h);
    const r = Math.max(10, Math.round((h.radius || 30) / 3) * 3);
    const v = hashOf(h);
    const e = sprite(`hz|${kind}|${r}|${v}`, [r + 5, r * YSQ + 12, r + 5, r * YSQ + 5], (g) =>
      HAZ[kind](g, r, mulberry(r * 31 + v * 977 + kind.length))
    );
    blit(ctx, e, h.x, h.y);
    if (!env.lowDetail) hazardLive(ctx, kind, h, r, tick);
    return true;
  }

  // ------------------------------------------------------------------- props
  function shadow(g, x, y, rx, ry) {
    g.globalAlpha = 0.4;
    ell(g, x + 1, y + 0.6, rx, ry, INK, 0);
    g.globalAlpha = 1;
  }

  /** A spiked timber: ink, wood, and a bone-pale point. */
  function spar(g, x1, y1, x2, y2, lw) {
    beam(g, x1, y1, x2, y2, lw, C.woodL);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    line(g, x2 - (dx / len) * 4, y2 - (dy / len) * 4, x2, y2, lw, BONE);
  }

  const PROP = {
    // Barricade: a log rail on trestles with sharpened stakes angled out at the enemy.
    barricade(g, st, rnd) {
      shadow(g, 0, 5, 19, 4.4);
      if (st === 2) {
        // broken: the rail snapped, stakes thrown down
        beam(g, -17, 3, -5, 4.4, 2.2, C.woodD);
        beam(g, 4, 5, 15, 2, 2, C.woodD);
        for (let i = 0; i < 5; i++) {
          const x = -14 + i * 7 + rnd() * 3;
          const a = rnd() * Math.PI;
          spar(g, x, 4 + rnd() * 3, x + Math.cos(a) * 7, 4 + rnd() * 3 - Math.abs(Math.sin(a)) * 2.4, 1);
        }
        poly(g, [-3, 2, 0, -2.4, 1.4, 2.4], C.woodL, 0.8);
        return;
      }
      for (const x of [-13, 0, 13]) {
        beam(g, x - 3.4, 5.4, x + 0.6, -3, 1.5, C.woodD);
        beam(g, x + 3.4, 5.4, x - 0.6, -3, 1.5, C.woodD);
      }
      beam(g, -18, -1, 18, -1, 2.8, C.woodL);
      line(g, -17, -1.8, 17, -1.8, 0.7, C.thatch);
      const gone = st === 1 ? 3 : -1;
      for (let i = 0; i < 9; i++) {
        const x = -16 + i * 4;
        if (st === 1 && (i === gone || i === gone + 3)) {
          beam(g, x, 0, x + 1.2, -4, 1.1, C.woodD);
          continue;
        }
        spar(g, x, 2.6, x + (i % 2 ? 1 : -1) * 0.8, -11 - (i % 3) * 1.2, 1.5);
      }
      for (const x of [-9, 9]) {
        stroke(g, [x - 1.6, -2.6, x + 1.6, 0.6, x - 1.6, 0.6, x + 1.6, -2.6], 0.6, BONE);
      }
      if (st === 1) {
        stroke(g, [-2, -2.6, -0.6, -0.6, -2.2, 0.8], 0.8);
        line(g, 6, 3, 9, -5, 0.8);
        line(g, 8.4, -5.6, 9.8, -4.4, 1, BONE);
      }
    },
    // Beast den: an earth mound with a black mouth, bones dragged to the door.
    den(g, st, rnd, s) {
      const k = (s || 20) / 20;
      g.save();
      g.scale(k, k);
      shadow(g, 0, 7, 21, 6);
      const mound = [-20, 7, -17, -3, -9, -11, 2, -13.4, 12, -9, 19, -1, 20, 7];
      poly(g, mound, C.dirt, 1.5);
      hatch(g, [2, -13.4, 12, -9, 19, -1, 20, 7, 6, 7], 2.2, 0.7, 0.7);
      for (let i = 0; i < 6; i++) {
        const x = -15 + rnd() * 30;
        const y = -6 + rnd() * 9;
        line(g, x, y, x + 2 + rnd() * 2, y + 0.6, 0.6);
      }
      // roots and tufts on the crown
      for (const x of [-11, -4, 6, 13]) {
        line(g, x, -8.4 + Math.abs(x) * 0.3, x - 1.4, -12.4 + Math.abs(x) * 0.3, 1.6, INK);
        line(g, x, -8.4 + Math.abs(x) * 0.3, x - 1.4, -12.4 + Math.abs(x) * 0.3, 0.7, C.green);
      }
      if (st === 0) {
        const mouth = [-8, 7, -7.4, 0.4, -3.4, -3.6, 2.6, -3.8, 6.6, 0, 7.6, 7];
        poly(g, mouth, '#0a0708', 1.4);
        // teeth of stone round the mouth
        for (const [x, y] of [[-6.6, 1.4], [-2.8, -2.6], [2.4, -2.8], [6, 1]]) {
          poly(g, [x - 1.2, y, x, y + 3, x + 1.2, y], C.stoneL, 0.7);
        }
      } else {
        // dug out and caved in: the roof down, the mouth choked with spoil
        poly(g, [-9, 7, -8, 1, -3, -2, 3, -1, 8, 2, 9, 7], C.dirtD, 1.3);
        poly(g, [-5, 7, -3.6, 3, 0, 1.6, 3.4, 3.4, 5, 7], C.dirt, 0.9);
        ell(g, -2, 4.6, 1.8, 1.2, C.stoneD, 0.7);
        ell(g, 2.6, 5.4, 1.4, 1, C.stone, 0.7);
        stroke(g, [-12, -4, -9, 2, -10, 6], 0.9);
        stroke(g, [10, -5, 8, 0, 9.6, 5], 0.9);
        for (const x of [11, 13, 15]) line(g, x, -3, x - 2.4, 3, 0.8);
      }
      smallBone(g, -15, 8.4, 5.4, 0.2);
      smallBone(g, 9, 9, 4.6, -0.5);
      skullAt(g, 14.6, 8.4, 0.8);
      if (st === 0) smallBone(g, -3, 9.6, 4, 0.1);
      g.restore();
    },
    // Supply crate: banded, roped, branded with a coin.
    crate(g, st) {
      shadow(g, 0, 6.4, 12.4, 3.6);
      if (st === 2) {
        // opened: lid thrown off, straw and nothing else
        rect(g, -10, -1, 20, 7.4, C.wood, 1.3);
        rect(g, -8.6, -3.4, 17.2, 4, '#1a1210', 1);
        for (let x = -7; x < 8; x += 2.6) {
          line(g, x, -0.2, x + 1, -4.6 - ((x * 7) & 3) * 0.6, 0.7, C.thatch);
        }
        line(g, -10, 2.6, 10, 2.6, 0.7);
        line(g, -3.4, -1, -3.4, 6.4, 0.6);
        line(g, 3.4, -1, 3.4, 6.4, 0.6);
        poly(g, [9, 7.6, 12, 1.4, 19.4, 3.4, 16.6, 9.6], C.woodL, 1.1);
        line(g, 10.6, 4.6, 18, 6.6, 0.6);
        stroke(g, [-12, 6, -14, 8, -11, 8.6], 0.8, BONE);
        return;
      }
      rect(g, -10, -1.6, 20, 8, C.wood, 1.3);
      poly(g, [-10, -1.6, -8, -6.4, 8, -6.4, 10, -1.6], C.woodL, 1.3);
      hatch(g, [2, -1.6, 10, -1.6, 10, 6.4, 2, 6.4], 2, 0.6, 0.6);
      line(g, -3.4, -1.6, -3.4, 6.4, 0.6);
      line(g, 3.4, -1.6, 3.4, 6.4, 0.6);
      line(g, -2.8, -6.4, -3.4, -1.6, 0.6);
      line(g, 2.8, -6.4, 3.4, -1.6, 0.6);
      rect(g, -10, 0.2, 20, 1.5, C.ironD, 0.6);
      rect(g, -10, 4, 20, 1.5, C.ironD, 0.6);
      // rope over the lid and the coin brand
      stroke(g, [-6.4, -6.4, -7.4, -1.6, -7.4, 6.4], 1.1, BONE);
      stroke(g, [6.4, -6.4, 7.4, -1.6, 7.4, 6.4], 1.1, BONE);
      ell(g, 0, -4, 2.6, 1.5, C.gold, 0.8);
      ell(g, 0, 2.9, 2.2, 2.2, C.gold, 0.8);
      line(g, 0, 1.6, 0, 4.2, 0.6);
      if (st === 1) {
        poly(g, [-9.6, -1.4, -5.6, -3, -4.4, 1.4, -8, 2.4], '#1a1210', 0.9);
        stroke(g, [-4.4, 1.4, -2, 3.4, -3, 6], 0.8);
        line(g, 5, -6, 8.6, -11, 0.8);
        line(g, 8, -11.6, 9.4, -10.4, 1, BONE);
      }
    },
    // Oil barrel: tarred staves, a blood-red band and a flame mark.
    barrel(g, st, rnd) {
      if (st === 2) {
        // burst: a burn on the ground, staves and hoops thrown out
        g.globalAlpha = 0.75;
        pool(g, ragged(rnd, 15, 9, 12, 0.2), '#0c0809', 0);
        g.globalAlpha = 1;
        hatch(g, ragged(rnd, 12, 7, 10, 0.1), 2.2, -0.7, 0.7);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + rnd();
          const d = 5 + rnd() * 6;
          const x = Math.cos(a) * d;
          const y = Math.sin(a) * d * 0.6;
          beam(g, x, y, x + Math.cos(a) * 5, y + Math.sin(a) * 3, 1.2, C.woodDD);
        }
        g.beginPath();
        g.ellipse(2, 1, 4.4, 2, 0.3, 0.4, 4.6);
        g.lineWidth = 1.4;
        g.strokeStyle = INK;
        g.stroke();
        g.lineWidth = 0.6;
        g.strokeStyle = C.iron;
        g.stroke();
        ell(g, -4, -1, 1.2, 0.8, C.ember, 0.5);
        return;
      }
      shadow(g, 0, 7, 9, 3.2);
      if (st === 1) {
        g.globalAlpha = 0.85;
        pool(g, [3, 5, 9, 4.4, 15, 6.6, 13, 10, 5, 10.4, 1, 8], '#0c0809', 0.7);
        g.globalAlpha = 1;
        line(g, 6, 7.4, 11, 7.8, 0.6, C.stoneD);
      }
      g.beginPath();
      g.moveTo(-6.6, -7);
      g.quadraticCurveTo(-8.6, 0, -6.6, 7);
      g.quadraticCurveTo(0, 9.6, 6.6, 7);
      g.quadraticCurveTo(8.6, 0, 6.6, -7);
      g.closePath();
      g.fillStyle = C.woodDD;
      g.fill();
      K.ink(g, 1.3);
      hatch(g, [1.6, -7, 8.6, -7, 8.6, 9, 1.6, 9], 1.8, 0.5, 0.75);
      for (const x of [-3.6, 0, 3.6]) line(g, x, -6, x * 1.12, 8, 0.5);
      for (const y of [-4.2, 4.6]) {
        g.beginPath();
        g.moveTo(-7.4, y);
        g.quadraticCurveTo(0, y + 2.4, 7.4, y);
        g.lineWidth = 2.6;
        g.strokeStyle = INK;
        g.stroke();
        g.lineWidth = 1.4;
        g.strokeStyle = y < 0 ? BLOOD : C.iron;
        g.stroke();
      }
      ell(g, 0, -7, 6.6, 2.6, C.wood, 1.2);
      ell(g, 0, -7, 4.4, 1.6, '#1a1210', 0.6);
      // flame mark
      poly(g, [-2, 3.4, -2.4, 0.6, -0.8, 1.4, 0, -1.6, 1, 1.2, 2.4, 0.2, 2, 3.4], '#e07030', 0.7);
      if (st === 1) {
        stroke(g, [3, -5, 4.4, -1, 3.4, 2, 5, 5.4], 0.9);
        line(g, 4.4, 6, 5.6, 8, 1.6, '#0c0809');
      }
    },
  };

  const KIND = {
    barricade: { fn: 'barricade', ext: [22, 16, 22, 12], maxHp: 60 },
    neutral_den: { fn: 'den', ext: [24, 18, 24, 14], maxHp: 50 },
    supply_crate: { fn: 'crate', ext: [16, 14, 22, 12], maxHp: 40 },
    oil_barrel: { fn: 'barrel', ext: [18, 12, 18, 13], maxHp: 30 },
  };

  function propSprite(type, st, v, size) {
    const k = KIND[type];
    const sc = k.fn === 'den' ? Math.max(0.7, Math.min(1.6, (size || 20) / 20)) : 1;
    const ext = sc === 1 ? k.ext : k.ext.map((n) => n * sc);
    return sprite(`pr|${type}|${st}|${v}|${sc.toFixed(2)}`, ext, (g) =>
      PROP[k.fn](g, st, mulberry(v * 131 + st * 17 + type.length), 20 * sc)
    );
  }

  // --------------------------------------------------------------- wreckage
  const WRECK_HOLD = 2400;
  const WRECK_FADE = 400;
  const WRECK_MAX = 24;
  const tracked = new Map();
  const wrecks = [];
  let lastTick = -1;
  let sweptAt = -1e9;

  function sweep(tick) {
    if (tick + 5 < lastTick) {
      tracked.clear();
      wrecks.length = 0;
      sweptAt = -1e9;
    }
    lastTick = tick;
    if (tick - sweptAt < 6) return;
    sweptAt = tick;
    for (const [d, seen] of tracked) {
      if (d.hp <= 0) {
        tracked.delete(d);
        if (d.type !== 'neutral_den') {
          wrecks.push({ type: d.type, x: d.x, y: d.y, v: hashOf(d), at: tick });
          if (wrecks.length > WRECK_MAX) wrecks.shift();
        }
      } else if (tick - seen > 4000 || tracked.size > 400) tracked.delete(d);
    }
  }

  /** What is left of opened crates, burst barrels and broken barricades. Call once a frame. */
  function drawWrecks(ctx, tick = 0, inView) {
    sweep(tick);
    for (let i = wrecks.length - 1; i >= 0; i--) {
      const w = wrecks[i];
      const age = tick - w.at;
      if (age > WRECK_HOLD + WRECK_FADE) {
        wrecks.splice(i, 1);
        continue;
      }
      if (inView && !inView(w.x, w.y, 24)) continue;
      const a = age > WRECK_HOLD ? 1 - (age - WRECK_HOLD) / WRECK_FADE : 1;
      if (a < 1) ctx.globalAlpha = a;
      blit(ctx, propSprite(w.type, 2, w.v), w.x, w.y);
      if (a < 1) ctx.globalAlpha = 1;
    }
  }

  function stateOf(d, k) {
    if (d.type === 'neutral_den') return d.disturbed || d.hp <= 0 ? 1 : 0;
    if (d.hp <= 0) return 2;
    const max = d.maxHp || k.maxHp;
    return d.hp < max * 0.999 ? 1 : 0;
  }

  /** Draws a barricade, den, crate or barrel. Returns false for anything else. */
  function drawDecor(ctx, d, tick = 0) {
    const k = d && KIND[d.type];
    if (!k) return false;
    const st = stateOf(d, k);
    if (d.type !== 'neutral_den' && d.hp > 0) tracked.set(d, tick);
    blit(ctx, propSprite(d.type, st, hashOf(d), d.size), d.x, d.y);
    if (d.type === 'neutral_den' && st === 0) {
      // something is home: eyes in the mouth, blinking
      const sc = Math.max(0.7, Math.min(1.6, (d.size || 20) / 20));
      const blink = (tick + Math.round(d.x * 3)) % 150 < 8;
      if (!blink) {
        ctx.fillStyle = '#ff2a22';
        ctx.fillRect(d.x - 2.6 * sc, d.y + 1.4 * sc, 1.5 * sc, 1.1 * sc);
        ctx.fillRect(d.x + 1.1 * sc, d.y + 1.4 * sc, 1.5 * sc, 1.1 * sc);
      }
    } else if (st === 1 && d.type !== 'neutral_den') {
      const max = d.maxHp || k.maxHp;
      const w = 16;
      ctx.fillStyle = INK;
      ctx.fillRect(d.x - w / 2 - 0.6, d.y + 9.4, w + 1.2, 2.8);
      ctx.fillStyle = BLOOD;
      ctx.fillRect(d.x - w / 2, d.y + 10, w * Math.max(0, Math.min(1, d.hp / max)), 1.6);
    }
    return true;
  }

  function invalidate() {
    cache.clear();
  }

  return { drawHazard, drawDecor, drawWrecks, invalidate, hazardKind };
})();

if (PropArt) globalThis.PropArt = PropArt;
