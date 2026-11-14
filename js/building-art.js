/**
 * Building art for Myth and Blood: inked structures seen from the field's raised viewpoint.
 *
 * Every building type is drawn once per state onto an offscreen canvas and blitted each
 * frame; only the small moving parts (banners, smoke, flames, a turning engine) are drawn
 * live on top. States: three construction stages, intact, battered, ruined. A destroyed
 * building plays a short collapse and leaves rubble that fades.
 *
 * The per-type drawings live in js/building-art-types.js and register through
 * BuildingArt.register(); this file owns the drawing kit, the cache and the animation.
 */
const BuildingArt = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const TAU = Math.PI * 2;

  /** Muted colour set: bone stone, dark timber, a little slate, tile and cloth. */
  const C = {
    stone: '#a39d8c',
    stoneL: '#c4bea9',
    stoneD: '#777266',
    stoneDD: '#4c4841',
    wood: '#80613f',
    woodL: '#a07e56',
    woodD: '#553e2b',
    woodDD: '#34261b',
    thatch: '#b7a064',
    thatchD: '#8c7843',
    slate: '#565462',
    slateD: '#383641',
    tile: '#93402f',
    tileD: '#63271f',
    canvas: '#e0d7bc',
    canvasD: '#b8ae91',
    iron: '#60606a',
    ironD: '#37373e',
    green: '#647349',
    greenD: '#424e32',
    blue: '#4d6079',
    blueD: '#35435c',
    purple: '#644e7e',
    purpleD: '#403153',
    gold: '#bd9a3e',
    dirt: '#45362c',
    dirtD: '#2c221c',
    dark: '#151011',
    hide: '#80614a',
    hideD: '#513b2b',
    ewall: '#40363b',
    ewallD: '#2a2327',
    eroof: '#231c22',
    ember: '#d0591f',
    flame: '#ecc66c',
  };

  // ------------------------------------------------------------------ helpers
  function mulberry(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // -------------------------------------------------------------- drawing kit
  function trace(g, pts, close = true) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    if (close) g.closePath();
  }

  function ink(g, lw = 1.3) {
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }

  /** Filled polygon with a black ink edge. `lw` 0 leaves the edge off. */
  function poly(g, pts, fill, lw = 1.3) {
    trace(g, pts);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (lw) ink(g, lw);
  }

  function rect(g, x, y, w, h, fill, lw = 1.3) {
    poly(g, [x, y, x + w, y, x + w, y + h, x, y + h], fill, lw);
  }

  function line(g, x1, y1, x2, y2, lw = 1, col = INK) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineWidth = lw;
    g.strokeStyle = col;
    g.lineCap = 'round';
    g.stroke();
  }

  /** Open ink polyline. */
  function stroke(g, pts, lw = 1, col = INK) {
    trace(g, pts, false);
    g.lineWidth = lw;
    g.strokeStyle = col;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }

  function ell(g, cx, cy, rx, ry, fill, lw = 1.3) {
    g.beginPath();
    g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (lw) ink(g, lw);
  }

  /** Diagonal ink hatching clipped to a polygon: the shadow side of things. */
  function hatch(g, pts, step = 2.4, slope = 0.8, alpha = 0.6, lw = 0.6) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]);
      x1 = Math.max(x1, pts[i]);
      y0 = Math.min(y0, pts[i + 1]);
      y1 = Math.max(y1, pts[i + 1]);
    }
    const hgt = y1 - y0;
    const lean = hgt * slope;
    g.save();
    trace(g, pts);
    g.clip();
    g.beginPath();
    for (let c = x0 - Math.abs(lean); c < x1 + Math.abs(lean); c += step) {
      g.moveTo(c + lean, y0);
      g.lineTo(c, y1);
    }
    g.globalAlpha *= alpha;
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
  }

  function ellPts(cx, cy, rx, ry, n = 20) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    return pts;
  }

  function hatchEll(g, cx, cy, rx, ry, step, slope, alpha, lw) {
    hatch(g, ellPts(cx, cy, rx, ry), step, slope, alpha, lw);
  }

  function hatchRect(g, x, y, w, h, step, slope, alpha, lw) {
    hatch(g, [x, y, x + w, y, x + w, y + h, x, y + h], step, slope, alpha, lw);
  }

  /** Surface marks clipped to a polygon. kind: stone, wood, plankH, thatch, shingle, slate. */
  function tex(g, pts, kind, seed = 1) {
    if (!kind) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]);
      x1 = Math.max(x1, pts[i]);
      y0 = Math.min(y0, pts[i + 1]);
      y1 = Math.max(y1, pts[i + 1]);
    }
    const rnd = mulberry(seed * 7919 + Math.round(x0 * 13 + y0 * 31));
    g.save();
    trace(g, pts);
    g.clip();
    g.beginPath();
    if (kind === 'stone') {
      let row = 0;
      for (let y = y1 - 3.2; y > y0; y -= 3.2, row++) {
        for (let x = x0 + (row % 2) * 2.6; x < x1; x += 5.2) {
          if (rnd() < 0.5) continue;
          g.moveTo(x, y);
          g.lineTo(x + 3.2, y);
          if (rnd() < 0.5) {
            g.moveTo(x, y);
            g.lineTo(x, y + 2);
          }
        }
      }
    } else if (kind === 'wood') {
      for (let x = x0 + 2.4; x < x1; x += 2.8) {
        const a = y0 + rnd() * 2;
        g.moveTo(x, a);
        g.lineTo(x, y1 - rnd() * 1.5);
      }
    } else if (kind === 'plankH') {
      for (let y = y0 + 2.4; y < y1; y += 2.8) {
        g.moveTo(x0 + rnd() * 2, y);
        g.lineTo(x1 - rnd() * 2, y);
      }
    } else if (kind === 'thatch') {
      for (let y = y0 + 1; y < y1; y += 2.6) {
        for (let x = x0 + rnd() * 2; x < x1; x += 1.9 + rnd() * 1.4) {
          g.moveTo(x, y);
          g.lineTo(x + (rnd() - 0.5) * 0.8, y + 1.6 + rnd() * 1.2);
        }
      }
    } else if (kind === 'shingle') {
      let row = 0;
      for (let y = y0 + 2.6; y < y1 + 2; y += 2.9, row++) {
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        for (let x = x0 + (row % 2) * 1.7; x < x1; x += 3.4) {
          g.moveTo(x, y);
          g.lineTo(x, y - 2.9);
        }
      }
    } else if (kind === 'slate') {
      for (let y = y0 + 2.4; y < y1; y += 2.6) {
        g.moveTo(x0, y);
        g.lineTo(x1, y);
      }
    }
    g.globalAlpha *= kind === 'shingle' || kind === 'slate' ? 0.42 : 0.55;
    g.lineWidth = 0.55;
    g.strokeStyle = INK;
    g.lineCap = 'round';
    g.stroke();
    g.restore();
  }

  /**
   * A block standing on the footprint (x, y, w, d) and rising h: front wall plus top face.
   * o: wall, top, tex, door, slits, noShade.
   */
  function block(g, x, y, w, d, h, o = {}) {
    const wall = o.wall || C.stone;
    const fy = y + d - h;
    rect(g, x, fy, w, h, wall);
    tex(g, [x, fy, x + w, fy, x + w, fy + h, x, fy + h], o.tex === undefined ? 'stone' : o.tex, w);
    if (!o.noShade) hatchRect(g, x + w * 0.62, fy, w * 0.38, h, 2.2, 0.7, 0.55);
    if (o.door) door(g, x + w / 2 + (o.doorX || 0), y + d, o.door, Math.min(h - 1.5, o.door * 1.5));
    if (o.slits) {
      for (let i = 0; i < o.slits; i++) {
        const sx = x + (w * (i + 1)) / (o.slits + 1);
        if (o.door && Math.abs(sx - (x + w / 2)) < o.door) continue;
        rect(g, sx - 0.6, fy + h * 0.25, 1.2, Math.min(4, h * 0.4), INK, 0);
      }
    }
    rect(g, x, y - h, w, d, o.top || C.stoneL);
  }

  /** Arched doorway standing on (cx, baseY). */
  function door(g, cx, baseY, w, h, fill = C.dark) {
    g.beginPath();
    g.moveTo(cx - w / 2, baseY);
    g.lineTo(cx - w / 2, baseY - h + w / 2);
    g.arc(cx, baseY - h + w / 2, w / 2, Math.PI, 0);
    g.lineTo(cx + w / 2, baseY);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    ink(g, 1);
  }

  /** Merlons round the top of a block made with block(). sides: string of n, s, e, w. */
  function crenel(g, x, y, w, d, h, o = {}) {
    const fill = o.fill || C.stoneL;
    const sides = o.sides || 'nsew';
    const ty = y - h;
    const m = o.m || 3.2;
    const nx = Math.max(2, Math.round(w / (m * 1.9)));
    const nd = Math.max(1, Math.round(d / (m * 1.9)));
    if (sides.includes('n')) {
      for (let i = 0; i < nx; i++) {
        const mx = x + (i + 0.5) * (w / nx) - m / 2;
        rect(g, mx, ty - m * 0.9, m, m * 0.9 + 1, fill, 0.9);
      }
    }
    for (let i = 0; i < nd; i++) {
      const my = ty + (i + 0.5) * (d / nd) - m / 2;
      if (sides.includes('w')) rect(g, x - 0.6, my - 1, m * 0.8, m, fill, 0.9);
      if (sides.includes('e')) rect(g, x + w - m * 0.8 + 0.6, my - 1, m * 0.8, m, fill, 0.9);
    }
    if (sides.includes('s')) {
      for (let i = 0; i < nx; i++) {
        const mx = x + (i + 0.5) * (w / nx) - m / 2;
        rect(g, mx, ty + d - m * 0.9, m, m * 1.5, fill, 0.9);
      }
    }
  }

  /** A battlemented block: block() with a darker walk on top and merlons. */
  function keepBlock(g, x, y, w, d, h, o = {}) {
    block(g, x, y, w, d, h, o);
    if (w > 9 && d > 7) rect(g, x + 2.4, y - h + 2, w - 4.8, d - 4, o.walk || C.stoneD, 0.7);
    crenel(g, x, y, w, d, h, { fill: o.merlon || o.top || C.stoneL, sides: o.sides, m: o.m });
  }

  /** Round tower: wall of a cylinder standing on (cx, cy), flat top. o: wall, top, crenel. */
  function drum(g, cx, cy, r, h, o = {}) {
    const ry = r * (o.squash || 0.6);
    const wall = o.wall || C.stone;
    g.beginPath();
    g.moveTo(cx - r, cy - h);
    g.lineTo(cx - r, cy);
    g.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true);
    g.lineTo(cx + r, cy - h);
    g.closePath();
    g.fillStyle = wall;
    g.fill();
    ink(g);
    g.save();
    g.clip();
    tex(
      g,
      [cx - r, cy - h, cx + r, cy - h, cx + r, cy + ry, cx - r, cy + ry],
      o.tex === undefined ? 'stone' : o.tex,
      r
    );
    hatchRect(g, cx + r * 0.25, cy - h, r * 0.8, h + ry, 2.2, 0.7, 0.55);
    g.restore();
    if (o.door) door(g, cx, cy + ry - 0.6, o.door, o.door * 1.5);
    if (o.slit) rect(g, cx - r * 0.45, cy - h * 0.62, 1.2, Math.min(4, h * 0.3), INK, 0);
    if (o.open) return;
    ell(g, cx, cy - h, r, ry, o.top || C.stoneL);
    if (o.crenel !== false) {
      const n = Math.max(6, Math.round(r * 1.5));
      const fill = o.merlon || o.top || C.stoneL;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.2;
        const mx = cx + Math.cos(a) * r * 0.93;
        const my = cy - h + Math.sin(a) * ry * 0.93;
        rect(g, mx - 1.4, my - 2.6, 2.8, 3, fill, 0.8);
      }
      ell(g, cx, cy - h, r * 0.58, ry * 0.58, o.walk || C.stoneD, 0.7);
    }
  }

  /** Cone roof over a round tower whose wall top sits at (cx, cy). */
  function cone(g, cx, cy, r, rise, o = {}) {
    const ry = r * (o.squash || 0.6);
    const roof = o.roof || C.slate;
    g.beginPath();
    g.moveTo(cx, cy - rise);
    g.lineTo(cx - r, cy);
    g.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true);
    g.closePath();
    g.fillStyle = roof;
    g.fill();
    ink(g);
    hatch(
      g,
      [cx, cy - rise, cx + r, cy, cx + r * 0.9, cy + ry, cx + r * 0.15, cy + ry],
      2,
      0.5,
      0.6
    );
    g.beginPath();
    for (const k of [-0.55, -0.1, 0.4]) {
      g.moveTo(cx, cy - rise);
      g.lineTo(cx + k * r, cy + ry * Math.sqrt(Math.max(0, 1 - k * k)));
    }
    g.globalAlpha *= 0.5;
    g.lineWidth = 0.6;
    g.strokeStyle = INK;
    g.stroke();
    g.globalAlpha /= 0.5;
    if (o.stripes) {
      g.save();
      g.beginPath();
      g.moveTo(cx, cy - rise);
      g.lineTo(cx - r, cy);
      g.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true);
      g.closePath();
      g.clip();
      g.fillStyle = o.stripes;
      for (let i = -3; i <= 3; i += 2) {
        g.beginPath();
        g.moveTo(cx, cy - rise);
        g.lineTo(cx + ((i - 0.5) / 3.5) * r, cy + ry + 1);
        g.lineTo(cx + ((i + 0.5) / 3.5) * r, cy + ry + 1);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.beginPath();
      g.moveTo(cx, cy - rise);
      g.lineTo(cx - r, cy);
      g.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true);
      g.closePath();
      ink(g);
      hatch(
        g,
        [cx, cy - rise, cx + r, cy, cx + r * 0.9, cy + ry, cx + r * 0.15, cy + ry],
        2,
        0.5,
        0.5
      );
    }
  }

  /**
   * House body with a roof ridge running east-west: the front wall and the front roof
   * slope face the viewer. o: wall, roof, roofD, tex, rtex, ov, door, slits.
   */
  function gableEW(g, x, y, w, d, h, rise, o = {}) {
    const ov = o.ov === undefined ? 1.6 : o.ov;
    const fy = y + d - h;
    rect(g, x, fy, w, h, o.wall || C.wood);
    tex(g, [x, fy, x + w, fy, x + w, fy + h, x, fy + h], o.tex === undefined ? 'wood' : o.tex, w);
    hatchRect(g, x + w * 0.62, fy, w * 0.38, h, 2.2, 0.7, 0.5);
    if (o.door) door(g, x + w / 2 + (o.doorX || 0), y + d, o.door, Math.min(h - 1.2, o.door * 1.5));
    if (o.slits) {
      for (let i = 0; i < o.slits; i++) {
        const sx = x + (w * (i + 1)) / (o.slits + 1);
        if (o.door && Math.abs(sx - (x + w / 2 + (o.doorX || 0))) < o.door * 0.9) continue;
        rect(g, sx - 1, fy + h * 0.3, 2, Math.min(3, h * 0.4), C.dark, 0.6);
      }
    }
    const ridge = y + d / 2 - h - rise;
    const back = y - h - ov * 0.5;
    const front = fy + ov;
    if (ridge > back + 0.5) {
      const bp = [x - ov, back, x + w + ov, back, x + w + ov, ridge, x - ov, ridge];
      poly(g, bp, o.roofD || C.thatchD);
      hatch(g, bp, 2, 0.8, 0.6);
    }
    const fp = [x - ov, ridge, x + w + ov, ridge, x + w + ov, front, x - ov, front];
    poly(g, fp, o.roof || C.thatch);
    tex(g, fp, o.rtex === undefined ? 'thatch' : o.rtex, w + 3);
    hatch(g, [x + w * 0.7, ridge, x + w + ov, ridge, x + w + ov, front, x + w * 0.82, front], 2.2);
    line(g, x - ov, ridge, x + w + ov, ridge, 1.6);
  }

  /** House body with the ridge running north-south: the gable end faces the viewer. */
  function gableNS(g, x, y, w, d, h, rise, o = {}) {
    const ov = o.ov === undefined ? 1.6 : o.ov;
    const fy = y + d - h;
    const cx = x + w / 2;
    const gp = [x, y + d, x, fy, cx, fy - rise, x + w, fy, x + w, y + d];
    poly(g, gp, o.wall || C.wood);
    tex(g, gp, o.tex === undefined ? 'wood' : o.tex, w);
    hatch(
      g,
      [cx + w * 0.12, y + d, cx + w * 0.12, fy - rise, x + w, fy, x + w, y + d],
      2.2,
      0.7,
      0.5
    );
    if (o.door) door(g, cx, y + d, o.door, Math.min(h + rise * 0.3, o.door * 1.6));
    if (o.eye) ell(g, cx, fy - rise * 0.35, o.eye, o.eye, C.dark, 0.8);
    const lp = [cx, y - h - rise, cx, fy - rise + ov * 0.6, x - ov, fy + ov * 0.6, x - ov, y - h];
    const rp = [
      cx,
      y - h - rise,
      cx,
      fy - rise + ov * 0.6,
      x + w + ov,
      fy + ov * 0.6,
      x + w + ov,
      y - h,
    ];
    poly(g, rp, o.roofD || C.thatchD);
    tex(g, rp, o.rtex === undefined ? 'thatch' : o.rtex, w + 5);
    hatch(g, rp, 2, 0.8, 0.6);
    poly(g, lp, o.roof || C.thatch);
    tex(g, lp, o.rtex === undefined ? 'thatch' : o.rtex, w + 3);
    line(g, cx, y - h - rise, cx, fy - rise + ov * 0.6, 1.6);
  }

  /** Four-sided roof meeting at a point (or a short ridge of length `ridge`). */
  function hip(g, x, y, w, d, h, rise, o = {}) {
    const ov = o.ov === undefined ? 1.6 : o.ov;
    const fy = y + d - h;
    if (!o.noWall) {
      const wh = o.wallH || h;
      rect(g, x, fy, w, wh, o.wall || C.wood);
      tex(
        g,
        [x, fy, x + w, fy, x + w, fy + wh, x, fy + wh],
        o.tex === undefined ? 'wood' : o.tex,
        w
      );
      hatchRect(g, x + w * 0.62, fy, w * 0.38, wh, 2.2, 0.7, 0.5);
      if (o.door) door(g, x + w / 2, fy + wh, o.door, Math.min(wh - 1.2, o.door * 1.5));
    }
    const rl = Math.min(w * 0.8, o.ridge || 0) / 2;
    const cx = x + w / 2;
    const cy = y + d / 2 - h - rise;
    const ax = x - ov;
    const ay = y - h - ov * 0.5;
    const bx = x + w + ov;
    const dy = fy + ov;
    poly(g, [ax, ay, bx, ay, cx + rl, cy, cx - rl, cy], o.roofD || C.thatchD);
    hatch(g, [ax, ay, bx, ay, cx + rl, cy, cx - rl, cy], 2, 0.8, 0.6);
    poly(g, [bx, ay, bx, dy, cx + rl, cy], o.roofD || C.thatchD);
    hatch(g, [bx, ay, bx, dy, cx + rl, cy], 2, 0.8, 0.6);
    poly(g, [ax, ay, ax, dy, cx - rl, cy], o.roof || C.thatch);
    tex(g, [ax, ay, ax, dy, cx - rl, cy], o.rtex === undefined ? 'thatch' : o.rtex, w);
    const fp = [ax, dy, bx, dy, cx + rl, cy, cx - rl, cy];
    poly(g, fp, o.roofL || o.roof || C.thatch);
    tex(g, fp, o.rtex === undefined ? 'thatch' : o.rtex, w + 2);
    if (rl > 0) line(g, cx - rl, cy, cx + rl, cy, 1.6);
  }

  /** Ridge tent: cloth slopes run to the ground, the open end faces the viewer. */
  function tent(g, cx, cy, w, d, h, o = {}) {
    const cloth = o.cloth || C.canvas;
    const clothD = o.clothD || C.canvasD;
    const y0 = cy - d / 2;
    const y1 = cy + d / 2;
    const rp = [cx, y0 - h, cx, y1 - h, cx + w / 2, y1, cx + w / 2, y0];
    poly(g, rp, clothD);
    hatch(g, rp, 2.2, 0.8, 0.5);
    poly(g, [cx, y0 - h, cx, y1 - h, cx - w / 2, y1, cx - w / 2, y0], cloth);
    poly(g, [cx - w / 2, y1, cx, y1 - h, cx + w / 2, y1], cloth);
    poly(g, [cx - w * 0.16, y1, cx, y1 - h * 0.72, cx + w * 0.16, y1], o.flap || C.dark, 0.9);
    line(g, cx, y0 - h, cx, y1 - h, 1.6);
    line(g, cx, y1 - h, cx, y1 - h - 2.4, 1.2);
    if (o.ropes !== false) {
      line(g, cx - w / 2, y1, cx - w / 2 - 3, y1 + 2, 0.6);
      line(g, cx + w / 2, y1, cx + w / 2 + 3, y1 + 2, 0.6);
      line(g, cx - w / 2, y0, cx - w / 2 - 3, y0 - 1, 0.6);
    }
  }

  /** Round hide tent with poles through the smoke hole. */
  function hideTent(g, cx, cy, r, rise, o = {}) {
    cone(g, cx, cy, r, rise, { roof: o.roof || C.hide, squash: 0.5, stripes: o.stripes });
    poly(
      g,
      [cx - r * 0.2, cy + r * 0.5, cx, cy - rise * 0.25, cx + r * 0.2, cy + r * 0.5],
      C.dark,
      0.9
    );
    line(g, cx, cy - rise, cx - 2.2, cy - rise - 3.4, 0.9);
    line(g, cx, cy - rise, cx + 2, cy - rise - 3.6, 0.9);
    line(g, cx, cy - rise, cx + 0.2, cy - rise - 4.2, 0.9);
  }

  /** Row of pointed stakes from (x1, y1) to (x2, y2). */
  function palisade(g, x1, y1, x2, y2, o = {}) {
    const hgt = o.h || 6.5;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.round(len / (o.gap || 2.7)));
    const rnd = mulberry(Math.round(x1 * 7 + y1 * 13 + x2 * 3) + 5);
    const order = y2 >= y1 ? 1 : -1;
    for (let k = 0; k <= n; k++) {
      const i = order === 1 ? k : n - k;
      const px = x1 + ((x2 - x1) * i) / n;
      const py = y1 + ((y2 - y1) * i) / n;
      stake(
        g,
        px,
        py,
        hgt + (rnd() - 0.5) * 1.6,
        rnd() < 0.5 ? o.fill || C.wood : o.fill2 || C.woodL
      );
    }
  }

  function stake(g, px, py, hgt, fill, w = 1.35) {
    poly(
      g,
      [px - w, py, px - w, py - hgt + 1.6, px, py - hgt, px + w, py - hgt + 1.6, px + w, py],
      fill,
      0.8
    );
  }

  /** Stakes round an ellipse. part: 'back' (upper half) or 'front'. gap: half-width of a gate, radians, at the south. */
  function palisadeRing(g, cx, cy, rx, ry, part, o = {}) {
    const n = Math.round(((rx + ry) * Math.PI) / (o.gap2 || 2.8));
    const rnd = mulberry(Math.round(rx * 17 + ry * 5) + (part === 'back' ? 1 : 2));
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const s = Math.sin(a);
      if (part === 'back' ? s > 0.05 : s <= 0.05) continue;
      if (o.gate && Math.abs(a - Math.PI / 2) < o.gate) continue;
      list.push([cx + Math.cos(a) * rx, cy + s * ry]);
    }
    list.sort((p, q) => p[1] - q[1]);
    for (const [px, py] of list) {
      stake(
        g,
        px,
        py,
        (o.h || 6.5) + (rnd() - 0.5) * 1.6,
        rnd() < 0.5 ? o.fill || C.wood : o.fill2 || C.woodL
      );
    }
  }

  function fence(g, x1, y1, x2, y2, hgt = 3.4) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(len / 5));
    line(g, x1, y1 - hgt * 0.75, x2, y2 - hgt * 0.75, 0.9);
    line(g, x1, y1 - hgt * 0.3, x2, y2 - hgt * 0.3, 0.7);
    for (let i = 0; i <= n; i++) {
      const px = x1 + ((x2 - x1) * i) / n;
      const py = y1 + ((y2 - y1) * i) / n;
      line(g, px, py, px, py - hgt, 1.3);
    }
  }

  // ----------------------------------------------------------------- props
  function barrel(g, x, y, s = 1, fill = C.wood) {
    rect(g, x - 2 * s, y - 3.4 * s, 4 * s, 3.4 * s, fill, 0.9);
    ell(g, x, y - 3.4 * s, 2 * s, 1.1 * s, C.woodL, 0.9);
    line(g, x - 2 * s, y - 1.7 * s, x + 2 * s, y - 1.7 * s, 0.6);
  }

  function crate(g, x, y, s = 1, fill = C.woodL) {
    rect(g, x - 2.4 * s, y - 2.6 * s, 4.8 * s, 2.6 * s, C.wood, 0.9);
    rect(g, x - 2.4 * s, y - 4.6 * s, 4.8 * s, 2.2 * s, fill, 0.9);
    line(g, x - 2.4 * s, y - 4.6 * s, x + 2.4 * s, y - 2.6 * s, 0.5);
  }

  function sack(g, x, y, s = 1) {
    ell(g, x, y - 1.6 * s, 2.2 * s, 1.8 * s, C.canvasD, 0.9);
    line(g, x - 0.6 * s, y - 3.2 * s, x + 0.8 * s, y - 3.6 * s, 0.9);
  }

  function logPile(g, x, y, s = 1) {
    for (const [dx, dy] of [
      [-2.6, 0],
      [0, 0],
      [2.6, 0],
      [-1.3, -2],
      [1.3, -2],
    ]) {
      ell(g, x + dx * s, y + dy * s - 1.2 * s, 1.3 * s, 1.2 * s, C.woodL, 0.8);
    }
  }

  function stoneBlocks(g, x, y, s = 1) {
    rect(g, x - 4 * s, y - 2.6 * s, 4 * s, 2.6 * s, C.stone, 0.9);
    rect(g, x + 0.4 * s, y - 2.4 * s, 3.4 * s, 2.4 * s, C.stoneL, 0.9);
    rect(g, x - 2 * s, y - 5 * s, 3.8 * s, 2.4 * s, C.stoneL, 0.9);
  }

  function hay(g, x, y, s = 1) {
    g.beginPath();
    g.moveTo(x - 3.4 * s, y);
    g.quadraticCurveTo(x - 3 * s, y - 5.4 * s, x, y - 5.6 * s);
    g.quadraticCurveTo(x + 3 * s, y - 5.4 * s, x + 3.4 * s, y);
    g.closePath();
    g.fillStyle = C.thatch;
    g.fill();
    ink(g, 0.9);
    stroke(g, [x - 1.4 * s, y - 1, x - 1 * s, y - 4 * s], 0.5);
    stroke(g, [x + 1.2 * s, y - 1, x + 0.8 * s, y - 4.2 * s], 0.5);
  }

  function well(g, x, y, s = 1) {
    drum(g, x, y, 3.4 * s, 2.6 * s, { crenel: false, top: C.dark, tex: null });
    line(g, x - 3.4 * s, y - 2.6 * s, x - 3.4 * s, y - 8 * s, 1.1);
    line(g, x + 3.4 * s, y - 2.6 * s, x + 3.4 * s, y - 8 * s, 1.1);
    poly(g, [x - 4.6 * s, y - 7.6 * s, x, y - 10.4 * s, x + 4.6 * s, y - 7.6 * s], C.woodD, 0.9);
  }

  function cart(g, x, y, s = 1) {
    rect(g, x - 5 * s, y - 4.6 * s, 10 * s, 3 * s, C.wood, 0.9);
    line(g, x + 5 * s, y - 3 * s, x + 9 * s, y - 1.6 * s, 0.9);
    ell(g, x - 2.6 * s, y - 1.3 * s, 1.9 * s, 1.9 * s, C.woodD, 0.9);
    ell(g, x + 2.8 * s, y - 1.3 * s, 1.9 * s, 1.9 * s, C.woodD, 0.9);
    ell(g, x - 2.6 * s, y - 1.3 * s, 0.5 * s, 0.5 * s, BONE, 0);
    ell(g, x + 2.8 * s, y - 1.3 * s, 0.5 * s, 0.5 * s, BONE, 0);
  }

  /** Straw training dummy on a post. */
  function dummy(g, x, y, s = 1) {
    line(g, x, y, x, y - 7 * s, 1.3);
    line(g, x - 3 * s, y - 5 * s, x + 3 * s, y - 5 * s, 1.3);
    ell(g, x, y - 4.2 * s, 1.9 * s, 2.3 * s, C.thatch, 0.9);
    ell(g, x, y - 7.6 * s, 1.4 * s, 1.4 * s, C.canvasD, 0.9);
  }

  /** Archery butt: bone and blood rings on a stand. */
  function target(g, x, y, s = 1) {
    line(g, x - 2.4 * s, y, x - 0.8 * s, y - 5 * s, 1.1);
    line(g, x + 2.4 * s, y, x + 0.8 * s, y - 5 * s, 1.1);
    ell(g, x, y - 5.4 * s, 3.8 * s, 3.8 * s, BONE, 1.1);
    ell(g, x, y - 5.4 * s, 2.4 * s, 2.4 * s, BLOOD, 0.6);
    ell(g, x, y - 5.4 * s, 1 * s, 1 * s, BONE, 0.5);
  }

  function skull(g, x, y, s = 1) {
    ell(g, x, y - 1.1 * s, 2 * s, 1.9 * s, BONE, 0.9);
    rect(g, x - 1.1 * s, y + 0.2 * s, 2.2 * s, 1.5 * s, BONE, 0.8);
    rect(g, x - 1.3 * s, y - 1.5 * s, 0.9 * s, 1.1 * s, INK, 0);
    rect(g, x + 0.4 * s, y - 1.5 * s, 0.9 * s, 1.1 * s, INK, 0);
  }

  /** Skull on a pole, the enemy's marker. */
  function totem(g, x, y, hgt = 10) {
    line(g, x, y, x, y - hgt, 1.4);
    line(g, x - 2.6, y - hgt * 0.62, x + 2.6, y - hgt * 0.62, 1);
    skull(g, x, y - hgt - 0.6, 0.9);
  }

  /** Bare pole for a banner; the cloth is animated. Returns the pole top. */
  function pole(g, x, y, hgt) {
    line(g, x, y, x, y - hgt, 1.4);
    ell(g, x, y - hgt, 0.9, 0.9, C.gold, 0.6);
    return [x, y - hgt];
  }

  function torchPost(g, x, y, hgt = 7) {
    line(g, x, y, x, y - hgt, 1.5);
    rect(g, x - 1.1, y - hgt - 1.4, 2.2, 1.8, C.ironD, 0.7);
  }

  /** Timber: an ink line with a wood line laid over it. */
  function beam(g, x1, y1, x2, y2, lw = 1.2, col = C.woodL) {
    line(g, x1, y1, x2, y2, lw + 1.2, INK);
    line(g, x1, y1, x2, y2, lw, col);
  }

  /**
   * Curtain wall along part of an ellipse (angles in radians, 0 = east, PI/2 = south).
   * Drawn as stacked strokes: ink edge, stone face, lighter walk, merlon dashes.
   */
  function ringWall(g, cx, cy, rx, ry, a0, a1, hgt = 6, o = {}) {
    const arc = (dy, lw, col, dash) => {
      g.beginPath();
      g.ellipse(cx, cy + dy, rx, ry, 0, a0, a1);
      g.lineWidth = lw;
      g.strokeStyle = col;
      g.lineCap = 'butt';
      g.setLineDash(dash || []);
      g.stroke();
      g.setLineDash([]);
    };
    arc(-hgt / 2, hgt + 4.4, INK);
    arc(-hgt / 2, hgt + 2, o.wall || C.stone);
    arc(-hgt - 0.2, 4.2, INK);
    arc(-hgt - 0.2, 2.4, o.top || C.stoneL);
    arc(-hgt - 2.4, 2.6, INK, [2.6, 2.2]);
    arc(-hgt - 2.4, 1.3, o.top || C.stoneL, [2.6, 2.2]);
  }

  /** Small weapon or trade silhouettes used as the device that names an academy. */
  function emblem(g, kind, x, y, s = 1, col = BONE) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    const ol = 0.8 / s;
    switch (kind) {
      case 'sword':
        poly(g, [-0.7, 3, -0.7, -3.6, 0, -5, 0.7, -3.6, 0.7, 3], col, ol);
        rect(g, -2.2, 3, 4.4, 1, col, ol);
        rect(g, -0.6, 4, 1.2, 1.8, col, ol);
        break;
      case 'bow':
        g.beginPath();
        g.arc(-1, 0, 4.6, -1.15, 1.15);
        g.lineWidth = 1.5;
        g.strokeStyle = INK;
        g.stroke();
        g.lineWidth = 0.8;
        g.strokeStyle = col;
        g.stroke();
        line(g, 0.9, -4.2, 0.9, 4.2, 0.5, col);
        line(g, -3.4, 0, 4.4, 0, 0.9, col);
        break;
      case 'star':
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU - Math.PI / 2;
          const rr = i % 2 ? 1.5 : i % 4 === 0 ? 5 : 3;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = col;
        g.fill();
        ink(g, ol);
        break;
      case 'horseshoe':
        g.beginPath();
        g.arc(0, -0.6, 3.4, Math.PI * 0.82, Math.PI * 0.18, false);
        g.lineWidth = 2.6;
        g.strokeStyle = INK;
        g.lineCap = 'butt';
        g.stroke();
        g.lineWidth = 1.5;
        g.strokeStyle = col;
        g.stroke();
        break;
      case 'shield':
        poly(g, [-3.2, -4, 3.2, -4, 3.2, 0.6, 0, 4.6, -3.2, 0.6], col, ol);
        line(g, 0, -4, 0, 4.4, 0.7 / s, BLOOD);
        line(g, -3.2, -1, 3.2, -1, 0.7 / s, BLOOD);
        break;
      case 'bomb':
        ell(g, 0, 1, 3.3, 3.3, C.dark, ol);
        rect(g, -0.9, -3.4, 1.8, 1.6, C.ironD, ol);
        stroke(g, [0, -3.4, 1.4, -5, 2.8, -4.6], 0.7, col);
        ell(g, 2.9, -4.7, 0.9, 0.9, C.ember, 0);
        break;
      case 'cross':
        rect(g, -1.1, -4, 2.2, 8, col, ol);
        rect(g, -4, -1.1, 8, 2.2, col, ol);
        rect(g, -1.1, -1.1, 2.2, 2.2, col, 0);
        break;
      case 'hammer':
        rect(g, -0.6, -2.4, 1.2, 7, C.woodL, ol);
        rect(g, -3.2, -4.6, 6.4, 2.6, col, ol);
        break;
      case 'scroll':
        rect(g, -3.4, -2.4, 6.8, 4.8, col, ol);
        ell(g, -3.4, 0, 1, 2.4, col, ol);
        ell(g, 3.4, 0, 1, 2.4, col, ol);
        line(g, -1.8, -0.8, 1.8, -0.8, 0.5);
        line(g, -1.8, 0.8, 1.2, 0.8, 0.5);
        break;
      case 'eye':
        g.beginPath();
        g.moveTo(-4.6, 0);
        g.quadraticCurveTo(0, -4, 4.6, 0);
        g.quadraticCurveTo(0, 4, -4.6, 0);
        g.fillStyle = col;
        g.fill();
        ink(g, ol);
        ell(g, 0, 0, 1.6, 1.9, INK, 0);
        break;
      case 'lute':
        ell(g, 0, 2, 2.8, 3.2, col, ol);
        rect(g, -0.6, -5.4, 1.2, 5, C.woodL, ol);
        ell(g, 0, 1.6, 0.9, 0.9, INK, 0);
        break;
      case 'pike':
        line(g, 0, 5, 0, -3.6, 1.6);
        line(g, 0, 5, 0, -3.6, 0.7, C.woodL);
        poly(g, [-1.2, -3.4, 0, -6.4, 1.2, -3.4], col, ol);
        break;
      case 'crown':
        poly(g, [-4, 2.4, -4, -2, -2, 0, 0, -3.4, 2, 0, 4, -2, 4, 2.4], col, ol);
        break;
      case 'gear':
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          const rr = i % 2 ? 4.6 : 3.4;
          g.lineTo(Math.cos(a - 0.1) * rr, Math.sin(a - 0.1) * rr);
          g.lineTo(Math.cos(a + 0.1) * rr, Math.sin(a + 0.1) * rr);
        }
        g.closePath();
        g.fillStyle = col;
        g.fill();
        ink(g, ol);
        ell(g, 0, 0, 1.5, 1.5, INK, 0);
        break;
      case 'scales':
        line(g, 0, -4, 0, 4, 0.9, col);
        line(g, -4, -3, 4, -3, 0.9, col);
        poly(g, [-5.4, 0, -2.6, 0, -4, 1.8], col, ol);
        poly(g, [2.6, 0, 5.4, 0, 4, 1.8], col, ol);
        break;
      case 'fist':
        rect(g, -2.4, -2.6, 4.8, 4.4, col, ol);
        rect(g, -1.4, 1.8, 2.8, 3, col, ol);
        line(g, -1, -2.6, -1, 0, 0.5);
        line(g, 0.6, -2.6, 0.6, 0, 0.5);
        break;
      case 'boot':
        poly(g, [-2, -4, 0.6, -4, 0.6, 1, 3.6, 2, 3.6, 4, -2, 4], col, ol);
        poly(g, [-2, -2.6, -5, -4.6, -4, -1.4, -2, -0.6], col, ol);
        break;
      case 'drop':
        g.beginPath();
        g.moveTo(0, -4.6);
        g.quadraticCurveTo(4, 1, 0, 4.2);
        g.quadraticCurveTo(-4, 1, 0, -4.6);
        g.fillStyle = col;
        g.fill();
        ink(g, ol);
        break;
      default:
        ell(g, 0, 0, 3, 3, col, ol);
    }
    g.restore();
  }

  /** Hanging sign on a post carrying an emblem. */
  function sign(g, x, y, kind, o = {}) {
    const hgt = o.h || 11;
    line(g, x, y, x, y - hgt, 1.4);
    line(g, x, y - hgt + 0.8, x + 5.4, y - hgt + 0.8, 1.2);
    rect(g, x + 1, y - hgt + 1.6, 6.4, 6.4, o.fill || C.dark, 1);
    emblem(g, kind, x + 4.2, y - hgt + 4.8, 0.52, o.col || BONE);
  }

  const kit = {
    INK,
    BONE,
    BLOOD,
    C,
    TAU,
    mulberry,
    trace,
    ink,
    poly,
    rect,
    line,
    stroke,
    ell,
    hatch,
    hatchRect,
    hatchEll,
    tex,
    block,
    door,
    crenel,
    keepBlock,
    drum,
    cone,
    gableEW,
    gableNS,
    hip,
    tent,
    hideTent,
    palisade,
    palisadeRing,
    stake,
    fence,
    barrel,
    crate,
    sack,
    logPile,
    stoneBlocks,
    hay,
    well,
    cart,
    dummy,
    target,
    skull,
    totem,
    pole,
    beam,
    ringWall,
    torchPost,
    emblem,
    sign,
    lookup: (type) => drawers.get(type),
  };

  // ------------------------------------------------------------- registry
  /** type -> draw(g, r, o, fx). `fx(kind, x, y, extra)` records a moving part. */
  const drawers = new Map();
  /** Resolves a type that has no drawing of its own to a family drawing. */
  let fallback = null;

  function register(type, fn) {
    drawers.set(type, fn);
  }

  function setFallback(fn) {
    fallback = fn;
  }

  function drawerFor(b) {
    return drawers.get(b.type) || (fallback ? fallback(b) : null) || drawers.get('_generic');
  }

  // ------------------------------------------------------------- sprite cache
  const CACHE_MAX = 220;
  const cache = new Map();

  function spriteScale(r) {
    return r > 60 ? 2 : r > 34 ? 2.5 : 3;
  }

  function extents(r) {
    return { l: r + 16, rt: r + 16, up: Math.max(r * 1.55 + 14, 58), dn: r * 0.9 + 14 };
  }

  /** Alpha scan of a body layer: opaque bounds and the top edge per column, in local units. */
  function scan(cv, sc, ext) {
    const g = cv.getContext('2d');
    const w = cv.width;
    const h = cv.height;
    const data = g.getImageData(0, 0, w, h).data;
    const step = Math.max(1, Math.round(sc));
    const tops = [];
    let x0 = w;
    let x1 = 0;
    let y0 = h;
    let y1 = 0;
    for (let x = 0; x < w; x += step) {
      let top = -1;
      let bot = -1;
      for (let y = 0; y < h; y += step) {
        if (data[(y * w + x) * 4 + 3] > 120) {
          if (top < 0) top = y;
          bot = y;
        }
      }
      if (top >= 0) {
        tops.push([x / sc - ext.l, top / sc - ext.up]);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, top);
        y1 = Math.max(y1, bot);
      }
    }
    if (!tops.length) return { tops: [[0, 0]], x0: -4, x1: 4, y0: -4, y1: 4 };
    return {
      tops,
      x0: x0 / sc - ext.l,
      x1: x1 / sc - ext.l,
      y0: y0 / sc - ext.up,
      y1: y1 / sc - ext.up,
    };
  }

  /** Crops a canvas to its non-transparent pixels. Returns the crop and its offset. */
  function trim(cv) {
    const w = cv.width;
    const h = cv.height;
    const data = cv.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4 + 3;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4] > 4) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { cv, x: 0, y: 0 };
    x0 = Math.max(0, x0 - 1);
    y0 = Math.max(0, y0 - 1);
    const out = makeCanvas(Math.min(w, x1 + 2) - x0, Math.min(h, y1 + 2) - y0);
    out.getContext('2d').drawImage(cv, -x0, -y0);
    return { cv: out, x: x0, y: y0 };
  }

  function jagged(rnd, cx, cy, rad, n = 7) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.5;
      const rr = rad * (0.6 + rnd() * 0.7);
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85);
    }
    return pts;
  }

  /** Cracks, bites out of the roofline, soot, stuck arrows; at level 2 a hole in the roof. */
  function applyDamage(g, sc2, level, seed, fxOut) {
    const rnd = mulberry(seed + level * 101);
    const span = Math.max(8, sc2.x1 - sc2.x0);
    const tall = Math.max(8, sc2.y1 - sc2.y0);
    const unit = Math.max(3.2, Math.min(span, tall) * 0.13);
    const tops = sc2.tops;
    const pickTop = () => tops[Math.floor(rnd() * tops.length)];
    const bites = [];
    const nb = level === 2 ? 5 : 2;
    for (let i = 0; i < nb; i++) {
      const t = pickTop();
      bites.push([
        t[0],
        t[1] + unit * 0.2,
        unit * (level === 2 ? 1.1 + rnd() * 0.7 : 0.7 + rnd() * 0.5),
      ]);
    }
    g.save();
    g.globalCompositeOperation = 'source-atop';
    // soot
    const ns = level === 2 ? 4 : 1;
    for (let i = 0; i < ns; i++) {
      const sx = sc2.x0 + span * (0.15 + rnd() * 0.7);
      const sy = sc2.y0 + tall * (0.1 + rnd() * 0.6);
      const blob = jagged(rnd, sx, sy, unit * (1.6 + rnd()), 9);
      trace(g, blob);
      g.fillStyle = level === 2 ? 'rgba(10,7,9,0.62)' : 'rgba(10,7,9,0.34)';
      g.fill();
      hatch(g, blob, 1.8, -0.7, 0.8, 0.6);
    }
    if (level === 2) {
      const hx = sc2.x0 + span * (0.38 + rnd() * 0.24);
      const hy = sc2.y0 + tall * (0.22 + rnd() * 0.16);
      const hole = jagged(rnd, hx, hy, Math.min(span, tall) * 0.2, 9);
      poly(g, hole, '#0d090a', 1.2);
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI;
        const rr = Math.min(span, tall) * 0.2;
        g.save();
        trace(g, hole);
        g.clip();
        line(
          g,
          hx - Math.cos(a) * rr,
          hy - Math.sin(a) * rr,
          hx + Math.cos(a) * rr,
          hy + Math.sin(a) * rr,
          1.6,
          INK
        );
        line(
          g,
          hx - Math.cos(a) * rr,
          hy - Math.sin(a) * rr,
          hx + Math.cos(a) * rr,
          hy + Math.sin(a) * rr,
          0.8,
          C.woodD
        );
        g.restore();
      }
      fxOut.push({ k: 'fire', x: hx, y: hy, s: Math.max(0.8, Math.min(2.2, span / 30)) });
      fxOut.push({ k: 'smoke', x: hx + 1, y: hy - 3, s: 1.5, dark: 1 });
      if (span > 60) {
        const fx2 = sc2.x0 + span * (rnd() < 0.5 ? 0.2 : 0.78);
        fxOut.push({ k: 'fire', x: fx2, y: sc2.y0 + tall * 0.45, s: 1.1 });
      }
    } else {
      fxOut.push({ k: 'smoke', x: bites[0][0], y: bites[0][1], s: 0.9, dark: 1 });
    }
    // cracks
    const nc = level === 2 ? 7 : 4;
    for (let i = 0; i < nc; i++) {
      let x = i < bites.length ? bites[i][0] : sc2.x0 + span * (0.1 + rnd() * 0.8);
      let y = i < bites.length ? bites[i][1] : sc2.y0 + tall * (0.2 + rnd() * 0.5);
      const pts = [x, y];
      const segs = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < segs; k++) {
        x += (rnd() - 0.5) * unit * 1.5;
        y += unit * (0.5 + rnd() * 0.8);
        pts.push(x, y);
        if (k === 1) stroke(g, [x, y, x + (rnd() - 0.5) * unit * 2, y + unit * 0.8], 0.7);
      }
      stroke(g, pts, level === 2 ? 1.2 : 0.95);
    }
    // arrows left in the walls
    const na = level === 2 ? 4 : 3;
    for (let i = 0; i < na; i++) {
      const ax = sc2.x0 + span * (0.12 + rnd() * 0.76);
      const ay = sc2.y0 + tall * (0.45 + rnd() * 0.4);
      const dx = (rnd() - 0.5) * 3;
      line(g, ax, ay, ax + dx, ay - 4.4, 0.8);
      line(g, ax + dx - 0.9, ay - 4.2, ax + dx + 0.9, ay - 4.8, 1, BONE);
    }
    g.restore();
    // bites out of the top edge, then an ink edge on what is left
    for (const [bx, by, br] of bites) {
      const shape = jagged(rnd, bx, by, br, 8);
      g.save();
      g.globalCompositeOperation = 'destination-out';
      trace(g, shape);
      g.fill();
      g.globalCompositeOperation = 'source-atop';
      trace(g, shape);
      ink(g, 1.5);
      g.restore();
    }
  }

  /**
   * Poles, ledgers and a ladder round a building going up. Everything is sized from the
   * building's own drawn height and width, so a wall or a perk stand gets a light frame of
   * two poles and a hall gets a full one.
   */
  function drawScaffold(g, sc2, cutY, side, seed) {
    const rnd = mulberry(seed + 77);
    const wide = sc2.x1 - sc2.x0;
    const tall = sc2.y1 - sc2.y0;
    const k = Math.max(0.38, Math.min(1, Math.min(wide, tall * 1.3) / 40));
    const pad = 2.5 * k;
    const x0 = sc2.x0 - pad;
    const x1 = side === 'left' ? sc2.x0 + wide * 0.45 : sc2.x1 + pad;
    const base = sc2.y1 + 0.5;
    // never taller than the finished building
    const top = Math.max(sc2.y0 - 1.5 * k, Math.min(base - 8 * k, cutY - 5 * k));
    const span = x1 - x0;
    const lw = 0.55 + 0.45 * k;
    const two = (a, b, c, d, w) => {
      line(g, a, b, c, d, w * lw + 0.5 + 0.6 * k, INK);
      line(g, a, b, c, d, w * lw, C.woodL);
    };
    if (k < 0.8) {
      // A small job: a pole at each end and one plank between them at the working height,
      // so the thing being built stays in plain view.
      const ty = Math.max(sc2.y0, Math.min(base - 5 * k, cutY - 2 * k));
      two(x0, base, x0, ty - 2 * k, 0.9);
      if (side !== 'left') two(x1, base, x1, ty - 2 * k, 0.9);
      two(x0 - k, ty + 1.5 * k, x1 + k, ty + 1.5 * k, 0.8);
      return;
    }
    const nPoles = Math.max(2, Math.round(span / 9));
    const step = 7.5 * k;
    for (let y = base - step * 0.93; y > top; y -= step) {
      two(x0 - k, y, x1 + k, y + (rnd() - 0.5) * k, 0.9);
    }
    for (let i = 0; i <= nPoles; i++) {
      const px = x0 + (span * i) / nPoles;
      two(px, base, px + (rnd() - 0.5) * 1.2 * k, top - rnd() * 3 * k, 1);
      if (i < nPoles && rnd() < 0.7) {
        const nx = x0 + (span * (i + 1)) / nPoles;
        two(px, base - 1, nx, Math.max(top, base - 14 * k), 0.6);
      }
    }
    // ladder, once there is room for one
    if (base - top < 9) return;
    const lx = side === 'left' ? x1 + 3 * k : x0 + span * 0.72;
    two(lx, base, lx + 3 * k, top + 2, 0.7);
    two(lx + 2.6 * k, base, lx + 5.6 * k, top + 2, 0.7);
    for (let y = base - 3; y > top + 3; y -= 3) {
      const t = (base - y) / Math.max(1, base - top - 2);
      line(g, lx + 3 * k * t, y, lx + 2.6 * k + 3 * k * t, y, 0.7, INK);
    }
  }

  function drawPlot(g, r, seed) {
    const rnd = mulberry(seed + 9);
    const rx = r * 0.86;
    const ry = Math.max(6, r * 0.46);
    const cy = r * 0.18;
    ell(g, 0, cy, rx, ry, C.dirt, 1.1);
    hatch(
      g,
      [-rx, cy - ry, rx, cy - ry, rx, cy + ry, -rx, cy + ry].map((v, i) => (i % 2 ? v : v * 0.9)),
      3,
      0.9,
      0.35
    );
    ell(g, 0, cy, rx * 0.74, ry * 0.7, C.dirtD, 0.7);
    const corners = [
      [-rx * 0.8, cy - ry * 0.5],
      [rx * 0.8, cy - ry * 0.5],
      [rx * 0.8, cy + ry * 0.55],
      [-rx * 0.8, cy + ry * 0.55],
    ];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[(i + 1) % 4];
      line(g, ax, ay - 3.4 * Math.max(0.42, Math.min(1, r / 22)), bx, by - 3.4 * Math.max(0.42, Math.min(1, r / 22)), 0.5, BONE);
    }
    // stakes, stores and the spade shrink with the plot
    const ps = Math.max(0.42, Math.min(1, r / 22));
    for (const [sx, sy] of corners) stake(g, sx, sy, 5 * ps, C.woodL, 0.6 + 0.4 * ps);
    const stock = Math.min(1.5, (0.8 + r / 60) * ps);
    logPile(g, -rx * 0.42 + rnd() * 3 * ps, cy + ry * 0.2, stock);
    stoneBlocks(g, rx * 0.34, cy + ry * 0.36, stock);
    line(g, rx * 0.05, cy + ry * 0.1, rx * 0.05 + 1.6 * ps, cy + ry * 0.1 - 7 * ps, 1.2 * ps);
    poly(
      g,
      [
        rx * 0.05 - 0.8,
        cy + ry * 0.1 + 0.6,
        rx * 0.05 + 2.6,
        cy + ry * 0.1 + 0.6,
        rx * 0.05 + 1,
        cy + ry * 0.1 + 2.4,
      ],
      C.iron,
      0.7
    );
  }

  function variantOf(b) {
    let v = '';
    if (b.isTrap && (b.trapCooldown || 0) > 0) v += 's';
    if (b.fortressTier) v += 'f' + Math.min(3, b.fortressTier);
    return v;
  }

  function stateOf(b) {
    if (!b.complete) {
      const prog = progressOf(b);
      return prog < 0.34 ? 'c0' : prog < 0.67 ? 'c1' : 'c2';
    }
    const ratio = b.maxHp > 0 ? b.hp / b.maxHp : 1;
    return ratio > 0.66 ? 'ok' : ratio > 0.33 ? 'hurt' : 'ruin';
  }

  function progressOf(b) {
    if (b.complete) return 1;
    if (b.waveBuildRequired) return (b.waveBuildProgress || 0) / b.waveBuildRequired;
    return (b.buildProgress || 0) / Math.max(1, b.buildTime || 1);
  }

  function buildSprite(b, state) {
    const r = Math.max(8, b.radius || 18);
    const ext = extents(r);
    const sc = spriteScale(r);
    const w = (ext.l + ext.rt) * sc;
    const h = (ext.up + ext.dn) * sc;
    const seed = hashStr(b.type || 'x');
    const body = makeCanvas(w, h);
    const g = body.getContext('2d');
    g.setTransform(sc, 0, 0, sc, ext.l * sc, ext.up * sc);
    const fx = [];
    const add = (k, x, y, extra) => fx.push(Object.assign({ k, x, y }, extra));
    const o = {
      enemy: b.owner === 'enemy',
      facing: b.facing || 'north',
      sprung: b.isTrap && (b.trapCooldown || 0) > 0,
      fortTier: b.fortressTier || 0,
      def: b,
      state,
    };
    const fn = drawerFor(b);
    let info = null;
    try {
      info = fn ? fn(g, r, o, add) : null;
    } catch (err) {
      console.error('BuildingArt draw failed for', b.type, err);
    }
    info = info || {};
    const sc2 = scan(body, sc, ext);

    const out = makeCanvas(w, h);
    const og = out.getContext('2d');
    og.setTransform(sc, 0, 0, sc, ext.l * sc, ext.up * sc);
    const sh =
      info.shadow === undefined ? [0, r * 0.3, r * 0.98, Math.max(5, r * 0.42)] : info.shadow;
    const drawShadow = () => {
      if (!sh) return;
      og.globalAlpha = 0.42;
      ell(og, sh[0] + 1.5, sh[1] + 1, sh[2], sh[3], INK, 0);
      og.globalAlpha = 1;
    };
    const blit = (alpha) => {
      og.save();
      og.setTransform(1, 0, 0, 1, 0, 0);
      og.globalAlpha = alpha;
      og.drawImage(body, 0, 0);
      og.restore();
    };

    let liveFx = fx;
    if (state === 'ok') {
      drawShadow();
      blit(1);
    } else if (state === 'ruin' && info.ownRuin) {
      // The drawer has drawn its own wreck; no generic bites and soot over it.
      drawShadow();
      blit(1);
    } else if (state === 'hurt' || state === 'ruin') {
      const extra = [];
      applyDamage(g, sc2, state === 'ruin' ? 2 : 1, seed, extra);
      drawShadow();
      blit(1);
      // A ruin has lost its cloth and its working parts.
      liveFx = (
        state === 'ruin' ? fx.filter((f) => f.k === 'light' || f.k === 'torch') : fx
      ).concat(extra);
    } else {
      // construction: plot, then walls rising inside a scaffold
      liveFx = [];
      drawPlot(og, r, seed);
      const frac = state === 'c0' ? 0 : state === 'c1' ? 0.5 : 0.84;
      const cutY = sc2.y1 - (sc2.y1 - sc2.y0) * frac;
      blit(state === 'c0' ? 0.1 : 0.16);
      if (frac > 0) {
        og.save();
        const rnd = mulberry(seed + 3);
        og.beginPath();
        og.moveTo(sc2.x0 - 6, sc2.y1 + 6);
        og.lineTo(sc2.x0 - 6, cutY);
        for (let x = sc2.x0 - 6; x <= sc2.x1 + 6; x += 3.5) {
          og.lineTo(x, cutY + (rnd() - 0.5) * 3.4);
        }
        og.lineTo(sc2.x1 + 6, sc2.y1 + 6);
        og.closePath();
        og.clip();
        blit(1);
        og.restore();
      }
      drawScaffold(
        og,
        sc2,
        state === 'c0' ? sc2.y1 - 12 : cutY,
        state === 'c2' ? 'left' : 'all',
        seed
      );
    }
    // Blit only the inked area: the empty margin costs fill every frame.
    const t = trim(out);
    return {
      cv: t.cv,
      ox: ext.l - t.x / sc,
      oy: ext.up - t.y / sc,
      w: t.cv.width / sc,
      h: t.cv.height / sc,
      fx: liveFx,
      box: sc2,
      r,
      info,
    };
  }

  const memo = new WeakMap();
  let cacheGen = 0;

  function spriteFor(b, state) {
    const st = state || stateOf(b);
    const v = variantOf(b);
    // Per-building memo: the usual frame finds its sprite without building a key string.
    const m = state ? null : memo.get(b);
    if (
      m &&
      m.st === st &&
      m.v === v &&
      m.f === b.facing &&
      m.r === b.radius &&
      m.o === b.owner &&
      m.t === b.type &&
      m.gen === cacheGen
    ) {
      return m.e;
    }
    const key = `${b.type}|${b.owner === 'enemy' ? 'e' : 'p'}|${b.facing || ''}|${st}|${v}|${b.radius || 0}`;
    let e = cache.get(key);
    if (!e) {
      e = buildSprite(b, st);
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(key, e);
    }
    if (!state) {
      memo.set(b, { st, v, f: b.facing, r: b.radius, o: b.owner, t: b.type, gen: cacheGen, e });
    }
    return e;
  }

  function invalidate() {
    cacheGen++;
    cache.clear();
    rubbleCache.clear();
  }

  // ---------------------------------------------------------- moving parts
  function drawBanner(ctx, f, tick, bx, by) {
    const x = bx + f.x;
    const y = by + f.y;
    const len = f.len || 7;
    const hgt = f.h || 4.5;
    const ph = tick * 0.09 + (bx + f.x) * 0.31;
    const n = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      ctx.lineTo(x + len * t, y + Math.sin(ph - t * 3.2) * 1.3 * t);
    }
    if (f.tail) {
      ctx.lineTo(x + len * 0.72, y + hgt * 0.5 + Math.sin(ph - 2.4) * 1.1);
    }
    for (let i = n; i >= 1; i--) {
      const t = i / n;
      ctx.lineTo(x + len * t, y + hgt + Math.sin(ph - t * 3.2 + 0.5) * 1.3 * t);
    }
    ctx.lineTo(x, y + hgt);
    ctx.closePath();
    ctx.fillStyle = f.col || C.blue;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (f.mark) {
      ctx.fillStyle = f.mark;
      ctx.fillRect(x + len * 0.3, y + hgt * 0.32 + Math.sin(ph - 1.4) * 0.5, len * 0.3, hgt * 0.36);
    }
  }

  function drawSmoke(ctx, f, tick, bx, by) {
    const s = f.s || 1;
    for (let i = 0; i < 3; i++) {
      const ph = (((tick * 0.011 + i / 3 + (bx + f.x) * 0.013) % 1) + 1) % 1;
      const px = bx + f.x + Math.sin(ph * 5 + i * 2.1) * 2.4 * s + ph * 3 * s;
      const py = by + f.y - ph * 17 * s;
      const rad = (1.4 + ph * 3.4) * s;
      ctx.globalAlpha = (1 - ph) * (f.dark ? 0.62 : 0.5);
      ctx.fillStyle = f.dark ? '#1a1516' : '#cfc8b4';
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = (1 - ph) * 0.8;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(px, py, rad, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** A comic flame: jagged teardrop, blood-orange with a pale core. */
  function drawFlame(ctx, x, y, s, tick, seed) {
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
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 0.9 * s, y - 0.2 * s);
    ctx.quadraticCurveTo(x - 0.9 * s, y - 2 * s, x + a * 0.3 * s, y - 3.2 * s - b * 0.3 * s);
    ctx.quadraticCurveTo(x + 1 * s, y - 1.6 * s, x + 0.9 * s, y - 0.2 * s);
    ctx.closePath();
    ctx.fillStyle = C.flame;
    ctx.fill();
  }

  function drawGlow(ctx, f, tick, bx, by) {
    const pulse = 0.7 + Math.sin(tick * 0.07 + f.x) * 0.3;
    const x = bx + f.x;
    const y = by + f.y + (f.bob ? Math.sin(tick * 0.05 + f.x) * f.bob : 0);
    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = f.col || '#b9a2e8';
    ctx.beginPath();
    ctx.arc(x, y, (f.r || 4) * 1.8, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, (f.r || 4) * 0.55, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  /** The engine on the ballista academy's platform; it tracks slowly from side to side. */
  function drawBallista(ctx, f, tick, bx, by) {
    const s = f.s || 1;
    const ang = -Math.PI / 2 + Math.sin(tick * 0.012 + bx * 0.1) * 0.7;
    ctx.save();
    ctx.translate(bx + f.x, by + f.y);
    ctx.scale(s, s * 0.82);
    ctx.rotate(ang);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const two = (pts, lw, col) => {
      trace(ctx, pts, false);
      ctx.lineWidth = lw + 1.2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.strokeStyle = col;
      ctx.stroke();
    };
    two([-5, 0, 7.5, 0], 2, C.wood);
    two([3.4, -7, 5.4, -2.6, 5.4, 2.6, 3.4, 7], 1.4, C.woodL);
    trace(ctx, [3.4, -7, -3.6, 0, 3.4, 7], false);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = BONE;
    ctx.stroke();
    two([-3.6, 0, 9.5, 0], 0.7, BONE);
    poly(ctx, [9, -1.3, 12, 0, 9, 1.3], C.iron, 0.7);
    ctx.restore();
  }

  function drawSails(ctx, f, tick, bx, by) {
    const s = f.s || 1;
    ctx.save();
    ctx.translate(bx + f.x, by + f.y);
    ctx.rotate(tick * 0.012);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      line(ctx, 0, 0, 0, -8.4 * s, 1.1);
      poly(
        ctx,
        [0.6 * s, -2.4 * s, 3 * s, -2.8 * s, 3 * s, -8 * s, 0.6 * s, -8 * s],
        C.canvas,
        0.7
      );
    }
    ctx.restore();
    ell(ctx, bx + f.x, by + f.y, 1, 1, C.woodD, 0.6);
  }

  function drawFx(ctx, e, b, tick, env) {
    const fx = e.fx;
    for (let i = 0; i < fx.length; i++) {
      const f = fx[i];
      switch (f.k) {
        case 'banner':
          drawBanner(ctx, f, tick, b.x, b.y);
          break;
        case 'smoke':
          if (!env.lowDetail) drawSmoke(ctx, f, tick, b.x, b.y);
          break;
        case 'torch':
          drawFlame(
            ctx,
            b.x + f.x,
            b.y + f.y,
            (f.s || 0.62) * (env.dark > 0.2 ? 1.25 : 1),
            tick,
            f.x * 3 + b.x
          );
          break;
        case 'fire':
          drawFlame(ctx, b.x + f.x - 2.2 * f.s, b.y + f.y + 1, f.s * 0.8, tick, f.x + 4);
          drawFlame(ctx, b.x + f.x + 2 * f.s, b.y + f.y + 1.4, f.s * 0.7, tick, f.x + 9);
          drawFlame(ctx, b.x + f.x, b.y + f.y + 2, f.s * 1.25, tick, f.x);
          break;
        case 'glow':
          drawGlow(ctx, f, tick, b.x, b.y);
          break;
        case 'ballista':
          drawBallista(ctx, f, tick, b.x, b.y);
          break;
        case 'sails':
          drawSails(ctx, f, tick, b.x, b.y);
          break;
        default:
          break;
      }
    }
  }

  // ----------------------------------------------------------- per-frame draw
  function drawProgress(ctx, b, e) {
    const prog = progressOf(b);
    const barW = b.radius > 40 ? 64 : 32;
    const y = b.y + e.box.y1 + 4;
    ctx.fillStyle = INK;
    ctx.fillRect(b.x - barW / 2 - 1, y - 1, barW + 2, 4.4);
    ctx.fillStyle = b.owner === 'enemy' ? BLOOD : BONE;
    ctx.fillRect(b.x - barW / 2, y, barW * Math.max(0, Math.min(1, prog)), 2.4);
    if (b.waveBuildRequired) {
      ctx.font = '6px Cinzel';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      const txt = `WAVE ${b.waveBuildProgress || 0}/${b.waveBuildRequired}`;
      ctx.strokeText(txt, b.x, y + 11);
      ctx.fillStyle = BONE;
      ctx.fillText(txt, b.x, y + 11);
    }
  }

  function drawOccupancy(ctx, b) {
    if (b.type === 'wall') {
      const slots = b.wallSlots;
      if (slots) {
        for (const s of slots) {
          ctx.beginPath();
          ctx.arc(s.slotX, s.slotY, s.unitId ? 3.4 : 2.6, 0, TAU);
          if (s.unitId) {
            ctx.fillStyle = C.blue;
            ctx.fill();
          }
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = s.unitId ? INK : 'rgba(228,220,196,0.5)';
          ctx.stroke();
        }
      }
      if (b.siegeTowerId) {
        const v = b.facing === 'east' || b.facing === 'west';
        ctx.lineWidth = 2;
        ctx.strokeStyle = BLOOD;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        if (v) {
          const sx = b.facing === 'east' ? 12 : -12;
          ctx.moveTo(b.x + sx, b.y - 22);
          ctx.lineTo(b.x + sx, b.y + 22);
        } else {
          const sy = b.facing === 'south' ? 12 : -20;
          ctx.moveTo(b.x - 22, b.y + sy);
          ctx.lineTo(b.x + 22, b.y + sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (b.garrisonUnitId && b.type === 'outpost') {
      ell(ctx, b.x, b.y - 17, 2.6, 2.6, C.blue, 0.9);
      ell(ctx, b.x, b.y - 17.6, 1.1, 1.1, BONE, 0);
    } else if (b.generalUnitId && b.type === 'castle_keep') {
      const gx = b.slotX ?? b.x;
      const gy = b.slotY ?? b.y - 30;
      emblem(ctx, 'crown', gx, gy, 0.9, C.gold);
    }
    if (b.fortressTier > 0 && b.owner !== 'enemy') {
      for (let i = 0; i < Math.min(5, b.fortressTier); i++) {
        emblem(
          ctx,
          'shield',
          b.x - (Math.min(5, b.fortressTier) - 1) * 3.5 + i * 7,
          b.y - (b.radius || 55) - 4,
          0.6,
          BONE
        );
      }
    }
  }

  let nameCache = null;
  function drawName(ctx, b, e, k) {
    const name = (typeof BuildDefs !== 'undefined' && BuildDefs[b.type]?.name) || b.name || '';
    if (!name) return;
    const px = Math.max(5, 9 * k);
    ctx.save();
    ctx.font = `${px}px Cinzel`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!nameCache || nameCache.name !== name || nameCache.px !== px) {
      nameCache = { name, px, w: ctx.measureText(name).width };
    }
    const w = nameCache.w + px * 1.2;
    const y = b.y + e.box.y0 - px * 1.1;
    ctx.fillStyle = 'rgba(7,5,10,0.86)';
    ctx.fillRect(b.x - w / 2, y - px * 0.8, w, px * 1.6);
    ctx.strokeStyle = b.owner === 'enemy' ? BLOOD : BONE;
    ctx.lineWidth = Math.max(0.5, k);
    ctx.strokeRect(b.x - w / 2, y - px * 0.8, w, px * 1.6);
    ctx.fillStyle = BONE;
    ctx.fillText(name, b.x, y + px * 0.06);
    ctx.restore();
  }

  /**
   * Draws one building. env: { dark (0..1), hoverX, hoverY, k (1 / view scale), lowDetail }.
   */
  function draw(ctx, b, tick = 0, env = {}) {
    const e = spriteFor(b);
    let yOff = 0;
    if (b.isTrap && (b.trapCooldown || 0) > 0) {
      const max = (typeof BuildDefs !== 'undefined' && BuildDefs.spike_trap?.trapCooldown) || 90;
      const since = max - b.trapCooldown;
      if (since < 8) yOff = -Math.sin((since / 8) * Math.PI) * 4;
    }
    ctx.drawImage(e.cv, b.x - e.ox, b.y - e.oy + yOff, e.w, e.h);
    if (e.fx.length) drawFx(ctx, e, b, tick, env);
    if (!b.complete) drawProgress(ctx, b, e);
    drawOccupancy(ctx, b);
    if (env.hoverX != null) {
      const dx = env.hoverX - b.x;
      const dy = env.hoverY - b.y;
      const rr = (b.radius || 18) + 4;
      if (dx * dx + dy * dy < rr * rr) hovered = { b, e };
    }
  }

  let hovered = null;
  /** Name plate (and reach rings) for the building under the pointer; call after the loop. */
  function drawHover(ctx, env = {}) {
    const h = hovered;
    hovered = null;
    if (!h) return;
    const { b, e } = h;
    const k = env.k || 1;
    const ring = b.visionRadius || b.hamletAuraRadius || 0;
    if (ring && b.owner !== 'enemy') {
      ctx.save();
      ctx.setLineDash([5 * k, 4 * k]);
      ctx.lineWidth = 1.2 * k;
      ctx.strokeStyle = 'rgba(228,220,196,0.55)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, ring, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    drawName(ctx, b, e, k);
  }

  /** Light sources for the night map: [x, y, radius, warmth] per call to `out`. */
  function lightsFor(b, out) {
    if (b.hp <= 0) return;
    const e = spriteFor(b);
    const enemy = b.owner === 'enemy';
    let any = false;
    for (const f of e.fx) {
      if (f.k === 'torch' || f.k === 'light') {
        out(b.x + f.x, b.y + f.y, f.r || (enemy ? 26 : 40), enemy ? 2 : 1);
        any = true;
      } else if (f.k === 'fire') {
        out(b.x + f.x, b.y + f.y, 46, 1);
        any = true;
      } else if (f.k === 'glow') {
        out(b.x + f.x, b.y + f.y, (f.r || 4) * 6, 3);
      }
    }
    if (!any && b.complete && !b.isTrap && b.type !== 'wall') {
      out(b.x, b.y, Math.max(26, (b.radius || 18) * (enemy ? 0.9 : 1.5)), enemy ? 2 : 1);
    }
  }

  // ---------------------------------------------------- collapse and rubble
  const COLLAPSE_TICKS = 46;
  const RUBBLE_HOLD = 1500;
  const RUBBLE_FADE = 420;
  const RUBBLE_MAX = 28;
  const wrecks = [];
  const rubbleCache = new Map();
  let lastTick = 0;

  function rubbleSprite(r, enemy, seed) {
    const bucket = Math.round(r / 6) * 6;
    const key = `${bucket}|${enemy ? 1 : 0}|${seed % 3}`;
    let e = rubbleCache.get(key);
    if (e) return e;
    const sc = spriteScale(bucket);
    const half = bucket + 10;
    const cv = makeCanvas(half * 2 * sc, half * 1.4 * sc);
    const g = cv.getContext('2d');
    g.setTransform(sc, 0, 0, sc, half * sc, half * 0.8 * sc);
    const rnd = mulberry((seed % 3) + bucket * 31 + 5);
    const rx = bucket * 0.9;
    const ry = Math.max(5, bucket * 0.42);
    g.globalAlpha = 0.5;
    ell(g, 0, 2, rx, ry, INK, 0);
    g.globalAlpha = 1;
    hatchEll(g, 0, 2, rx, ry, 2.6, 0.8, 0.5);
    const n = Math.round(10 + bucket * 0.7);
    const items = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const d = Math.sqrt(rnd());
      items.push([Math.cos(a) * rx * 0.86 * d, Math.sin(a) * ry * 0.8 * d, rnd(), rnd()]);
    }
    items.sort((p, q) => p[1] - q[1]);
    for (const [x, y, t, u] of items) {
      const s = (1.6 + u * 2.6) * Math.min(1.8, 0.8 + bucket / 50);
      if (t < 0.28) {
        const a = u * Math.PI;
        const len = s * 2.6;
        line(
          g,
          x - Math.cos(a) * len,
          y - Math.sin(a) * len * 0.5,
          x + Math.cos(a) * len,
          y + Math.sin(a) * len * 0.5,
          2.6,
          INK
        );
        line(
          g,
          x - Math.cos(a) * len,
          y - Math.sin(a) * len * 0.5,
          x + Math.cos(a) * len,
          y + Math.sin(a) * len * 0.5,
          1.4,
          enemy ? C.hideD : C.woodD
        );
      } else {
        const pts = jagged(rnd, x, y - s * 0.4, s, 5 + Math.floor(u * 3));
        poly(
          g,
          pts,
          enemy
            ? t < 0.6
              ? C.ewall
              : C.stoneDD
            : t < 0.55
              ? C.stoneD
              : t < 0.85
                ? C.stone
                : C.stoneL,
          1
        );
        if (u > 0.5) hatch(g, pts, 1.6, 0.7, 0.6);
      }
    }
    if (enemy) skull(g, rx * 0.3, -ry * 0.2, 1);
    e = { cv, ox: half, oy: half * 0.8, w: half * 2, h: half * 1.4 };
    rubbleCache.set(key, e);
    return e;
  }

  /** Call when a building is destroyed: starts its collapse and leaves rubble. */
  function noteDestroyed(b, tick = 0) {
    if (!b || typeof document === 'undefined') return;
    let sprite;
    try {
      sprite = spriteFor(Object.assign({}, b, { complete: true, hp: 0, maxHp: 1 }), 'ruin');
    } catch (_) {
      sprite = null;
    }
    wrecks.push({
      x: b.x,
      y: b.y,
      r: b.radius || 18,
      enemy: b.owner === 'enemy',
      seed: hashStr(b.type || 'x') + Math.round(b.x * 3 + b.y * 7),
      t0: tick,
      sprite,
    });
    if (wrecks.length > RUBBLE_MAX) wrecks.shift();
  }

  function syncTick(tick) {
    if (tick + 5 < lastTick) wrecks.length = 0;
    lastTick = tick;
  }

  /** Rubble under the buildings and units. */
  function drawRubble(ctx, tick = 0) {
    syncTick(tick);
    for (let i = wrecks.length - 1; i >= 0; i--) {
      const w = wrecks[i];
      const age = tick - w.t0;
      if (age > RUBBLE_HOLD + RUBBLE_FADE) {
        wrecks.splice(i, 1);
        continue;
      }
      if (age < COLLAPSE_TICKS * 0.35) continue;
      const e = rubbleSprite(w.r, w.enemy, w.seed);
      const rise = Math.min(1, (age - COLLAPSE_TICKS * 0.35) / (COLLAPSE_TICKS * 0.5));
      const fade = age > RUBBLE_HOLD ? 1 - (age - RUBBLE_HOLD) / RUBBLE_FADE : 1;
      ctx.globalAlpha = Math.max(0, rise * fade);
      ctx.drawImage(e.cv, w.x - e.ox, w.y - e.oy + w.r * 0.2, e.w, e.h);
      // embers die down over the first seconds
      if (age < 260 && age > COLLAPSE_TICKS) {
        ctx.globalAlpha = (1 - age / 260) * 0.9;
        const rnd = mulberry(w.seed);
        ctx.fillStyle = C.ember;
        for (let k = 0; k < 6; k++) {
          const ex = w.x + (rnd() - 0.5) * w.r * 1.3;
          const ey = w.y + w.r * 0.2 + (rnd() - 0.5) * w.r * 0.5;
          if (Math.sin(tick * 0.2 + k * 1.9) > -0.2) ctx.fillRect(ex, ey, 1.4, 1.4);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The falling building, its dust and its debris; drawn over the standing buildings. */
  function drawCollapses(ctx, tick = 0) {
    for (const w of wrecks) {
      const age = tick - w.t0;
      if (age < 0 || age > COLLAPSE_TICKS + 24) continue;
      const t = Math.min(1, age / COLLAPSE_TICKS);
      const rnd = mulberry(w.seed);
      const e = w.sprite;
      if (e && t < 1) {
        const ground = w.y + e.box.y1 + 1;
        const sink = t * t * (e.box.y1 - e.box.y0) * 0.9;
        const shake = Math.sin(age * 2.1) * (1 - t) * 2.2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(w.x - e.ox, w.y - e.oy - 10, e.w, ground - (w.y - e.oy - 10));
        ctx.clip();
        ctx.translate(w.x + shake, ground);
        ctx.rotate((rnd() - 0.5) * 0.24 * t);
        ctx.globalAlpha = 1 - t * 0.3;
        ctx.drawImage(e.cv, -e.ox, -e.oy - e.box.y1 - 1 + sink, e.w, e.h);
        ctx.restore();
      }
      // debris thrown out
      const nd = Math.round(6 + w.r * 0.16);
      for (let i = 0; i < nd; i++) {
        const a = -Math.PI * (0.1 + rnd() * 0.8);
        const sp = (0.5 + rnd()) * (w.r * 0.9 + 14);
        const tt = Math.min(1, age / (COLLAPSE_TICKS * (0.6 + rnd() * 0.5)));
        const sz = 1.2 + rnd() * 2.2;
        if (tt >= 1) continue;
        const px = w.x + Math.cos(a) * sp * tt;
        const py =
          w.y +
          Math.sin(a) * sp * tt * 0.7 +
          tt * tt * (w.r * 0.9 + 16) * 0.75 -
          w.r * 0.2 * (1 - tt);
        ctx.fillStyle = i % 3 === 0 ? C.woodD : w.enemy ? C.ewall : C.stone;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = INK;
        ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      // dust: comic puffs with an ink rim on the upper side
      const np = Math.round(5 + w.r * 0.12);
      const dt = Math.min(1, age / (COLLAPSE_TICKS + 24));
      for (let i = 0; i < np; i++) {
        const a = (i / np) * TAU + rnd();
        const d = w.r * (0.35 + dt * 0.75) * (0.7 + rnd() * 0.5);
        const px = w.x + Math.cos(a) * d;
        const py = w.y + w.r * 0.25 + Math.sin(a) * d * 0.45 - dt * 6;
        const rad = (3 + rnd() * 3 + w.r * 0.08) * (0.5 + dt * 0.9);
        ctx.globalAlpha = Math.max(0, (1 - dt) * 0.78);
        ctx.fillStyle = '#b9b09a';
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ctx.arc(px, py, rad, Math.PI * 0.95, Math.PI * 1.95);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Wall preview while placing: the real wall sprite, ghosted, with its garrison posts. */
  function drawWallGhost(ctx, x, y, facing, opts = {}) {
    const valid = opts.valid !== false;
    const radius = opts.radius || 28;
    const e = spriteFor(
      {
        type: 'wall',
        owner: 'player',
        facing: facing || 'north',
        complete: true,
        hp: 1,
        maxHp: 1,
        radius,
      },
      'ok'
    );
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = valid ? BONE : BLOOD;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = valid ? 0.62 : 0.4;
    ctx.drawImage(e.cv, x - e.ox, y - e.oy, e.w, e.h);
    ctx.globalAlpha = 1;
    const slots =
      typeof getWallSlotPositions === 'function'
        ? getWallSlotPositions(facing || 'north', x, y)
        : [];
    for (const s of slots) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = valid ? BONE : BLOOD;
      ctx.beginPath();
      ctx.arc(s.x ?? s.slotX, s.y ?? s.slotY, 4.5, 0, TAU);
      ctx.stroke();
    }
    // arrow on the side that faces the enemy
    const dir = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[
      facing || 'north'
    ] || [0, -1];
    const ax = x + dir[0] * 20;
    const ay = y + dir[1] * 20 - (dir[1] < 0 ? 8 : 0);
    poly(
      ctx,
      [
        ax + dir[0] * 7,
        ay + dir[1] * 7,
        ax - dir[1] * 5,
        ay + dir[0] * 5,
        ax + dir[1] * 5,
        ay - dir[0] * 5,
      ],
      valid ? BONE : BLOOD,
      1
    );
    ctx.restore();
  }

  return {
    kit,
    register,
    setFallback,
    draw,
    drawHover,
    drawRubble,
    drawCollapses,
    drawWallGhost,
    noteDestroyed,
    lightsFor,
    spriteFor,
    stateOf,
    invalidate,
    drawFlame,
    trim,
    cacheSize: () => cache.size,
  };
})();

globalThis.BuildingArt = BuildingArt;
