/**
 * Field art for Myth and Blood: the ground, the line, the dark and the weather.
 *
 * - Ground: one cached canvas of inked dirt (hatching, ruts, tufts, bones) that differs by
 *   biome, with feathered edges where biomes meet.
 * - Props: trees and rocks as cached ink sprites, by biome.
 * - The line: the staked rope across the south that enemies must not cross. It flashes on
 *   a breach and keeps a broken stake where each one happened.
 * - Light: at dusk, night and dawn one small offscreen light map is filled with darkness,
 *   pools of light are cut out of it at torches, fires and casters, and it is laid over
 *   the field in a single draw. Enemy eyes are dotted on top.
 * - Weather: rain, snow, fog bands and ash as batched strokes.
 *
 * Uses the drawing kit from js/building-art.js.
 */
const FieldArt = (() => {
  const kit = typeof BuildingArt !== 'undefined' ? BuildingArt.kit : null;
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const TAU = Math.PI * 2;
  /** Enemies heading south have breached once they pass worldH - LINE_INSET. */
  const LINE_INSET = 58;

  function mulberry(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function seg(g, x1, y1, x2, y2) {
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }

  // ------------------------------------------------------------------ ground
  const BIOME = {
    plains: { base: '#4d3e2f', lo: '#3a2d22', hi: '#66543d', tuft: '#5f6a3c' },
    forest: { base: '#35392a', lo: '#23271c', hi: '#4a5234', tuft: '#56683a' },
    mountains: { base: '#57544d', lo: '#3d3b37', hi: '#77736a', tuft: '#6a6a55' },
    corrupted: { base: '#372b3c', lo: '#1e1622', hi: '#524058', tuft: '#5a4862' },
    hellscape: { base: '#3b1e19', lo: '#1c0f0d', hi: '#5c2a21', tuft: '#6a3226' },
  };
  const BIOME_RANK = { plains: 0, forest: 1, mountains: 2, corrupted: 3, hellscape: 4 };

  /** Mottle: soft irregular patches of the biome's light and dark tone. */
  function mottle(g, w, h, pal, rnd, density) {
    const n = Math.round(((w * h) / 2600) * density);
    for (let i = 0; i < n; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rx = 10 + rnd() * 26;
      const ry = 5 + rnd() * 12;
      g.globalAlpha = 0.16 + rnd() * 0.2;
      g.fillStyle = rnd() < 0.55 ? pal.lo : pal.hi;
      g.beginPath();
      g.ellipse(x, y, rx, ry, (rnd() - 0.5) * 0.8, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /** Short parallel ink strokes in clumps: the shadow side of every dip in the ground. */
  function hatchPatches(g, w, h, rnd, count, alpha) {
    g.strokeStyle = INK;
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const n = 4 + Math.floor(rnd() * 7);
      const len = 3 + rnd() * 5;
      const slope = 0.5 + rnd() * 0.5;
      g.globalAlpha = alpha * (0.5 + rnd() * 0.5);
      g.lineWidth = 0.45 + rnd() * 0.35;
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const ox = x + k * 1.9;
        const oy = y + Math.sin(k * 1.3) * 1.2;
        const l = len * (0.6 + rnd() * 0.6);
        seg(g, ox, oy, ox - l * slope, oy + l);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function speckle(g, w, h, rnd, count, col, alpha) {
    g.fillStyle = col;
    g.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const s = 0.4 + rnd() * 0.8;
      g.fillRect(rnd() * w, rnd() * h, s, s);
    }
    g.globalAlpha = 1;
  }

  function tuft(g, x, y, s, col, rnd) {
    const n = 3 + Math.floor(rnd() * 3);
    g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.42;
        const l = s * (2.4 + ((k * 7) % 3) * 0.7);
        seg(g, x + (k - (n - 1) / 2) * 0.7, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      g.strokeStyle = pass === 0 ? INK : col;
      g.lineWidth = pass === 0 ? 1.5 : 0.7;
      g.stroke();
    }
  }

  function bone(g, x, y, len, ang) {
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len * 0.6;
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass === 0 ? INK : BONE;
      g.lineWidth = pass === 0 ? 2.2 : 1;
      g.lineCap = 'round';
      g.beginPath();
      seg(g, x - dx, y - dy, x + dx, y + dy);
      g.stroke();
      g.fillStyle = pass === 0 ? INK : BONE;
      const r = pass === 0 ? 1.35 : 0.8;
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.arc(x + sgn * dx - dy * 0.25, y + sgn * dy + dx * 0.15, r, 0, TAU);
        g.arc(x + sgn * dx + dy * 0.25, y + sgn * dy - dx * 0.15, r, 0, TAU);
        g.fill();
      }
    }
  }

  function ribs(g, x, y, s) {
    g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass === 0 ? INK : BONE;
      g.lineWidth = pass === 0 ? 1.9 : 0.8;
      g.beginPath();
      seg(g, x - 4 * s, y, x + 4 * s, y);
      for (let k = -2; k <= 2; k++) {
        g.moveTo(x + k * 1.6 * s, y);
        g.quadraticCurveTo(
          x + k * 1.6 * s + 1.2 * s,
          y - 2.6 * s,
          x + k * 1.6 * s + 0.2 * s,
          y - 3.6 * s
        );
      }
      g.stroke();
    }
  }

  function stone(g, x, y, s, fill, rnd) {
    const pts = [];
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.5;
      const rr = s * (0.65 + rnd() * 0.6);
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
    }
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 0.8;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
    g.globalAlpha = 0.55;
    g.lineWidth = 0.45;
    g.beginPath();
    seg(g, x - s * 0.1, y + s * 0.4, x + s * 0.6, y - s * 0.1);
    seg(g, x + s * 0.15, y + s * 0.45, x + s * 0.7, y + s * 0.1);
    g.stroke();
    g.globalAlpha = 1;
  }

  /** A wandering ink line; `fork` > 0 lets it branch (roots, veins, cracks). */
  function crack(g, x, y, ang, len, rnd, fork, lw, col) {
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x, y);
    let a = ang;
    const steps = Math.max(2, Math.round(len / 4));
    const kids = [];
    for (let i = 0; i < steps; i++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 4;
      y += Math.sin(a) * 4 * 0.7;
      g.lineTo(x, y);
      if (fork > 0 && rnd() < 0.24) kids.push([x, y, a + (rnd() < 0.5 ? -0.9 : 0.9)]);
    }
    g.stroke();
    for (const k of kids) crack(g, k[0], k[1], k[2], len * 0.45, rnd, fork - 1, lw * 0.7, col);
  }

  /** Wagon ruts: a pair of broken ink lines running roughly north to south. */
  function ruts(g, w, h, rnd, count) {
    for (let i = 0; i < count; i++) {
      let x = w * (0.15 + rnd() * 0.7);
      let y = rnd() * h * 0.7;
      const len = 60 + rnd() * 140;
      const gap = 5 + rnd() * 2;
      let drift = (rnd() - 0.5) * 0.5;
      g.strokeStyle = INK;
      g.lineCap = 'round';
      for (let s = 0; s < len; s += 7) {
        drift += (rnd() - 0.5) * 0.16;
        const nx = x + drift * 7;
        const ny = y + 7;
        if (rnd() < 0.78) {
          g.globalAlpha = 0.34 + rnd() * 0.26;
          g.lineWidth = 0.7 + rnd() * 0.7;
          g.beginPath();
          seg(g, x, y, nx, ny);
          seg(g, x + gap, y, nx + gap, ny);
          g.stroke();
        }
        x = nx;
        y = ny;
      }
    }
    g.globalAlpha = 1;
  }

  const PAINT = {
    plains(g, w, h, rnd) {
      const pal = BIOME.plains;
      mottle(g, w, h, pal, rnd, 1);
      ruts(g, w, h, rnd, Math.max(2, Math.round(w / 150)));
      hatchPatches(g, w, h, rnd, Math.round((w * h) / 900), 0.5);
      speckle(g, w, h, rnd, Math.round((w * h) / 60), '#15100c', 0.5);
      speckle(g, w, h, rnd, Math.round((w * h) / 110), '#8a7758', 0.45);
      for (let i = 0, n = Math.round((w * h) / 2100); i < n; i++) {
        tuft(g, rnd() * w, rnd() * h, 0.8 + rnd() * 0.6, rnd() < 0.3 ? '#857a48' : pal.tuft, rnd);
      }
      for (let i = 0, n = Math.round((w * h) / 9000); i < n; i++) {
        stone(g, rnd() * w, rnd() * h, 1.6 + rnd() * 2, rnd() < 0.5 ? '#77705f' : '#8f8873', rnd);
      }
    },
    forest(g, w, h, rnd) {
      const pal = BIOME.forest;
      mottle(g, w, h, pal, rnd, 1.5);
      // roots
      for (let i = 0, n = Math.round((w * h) / 3600); i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        crack(g, x, y, rnd() * TAU, 16 + rnd() * 22, rnd, 2, 1.8, INK);
      }
      hatchPatches(g, w, h, rnd, Math.round((w * h) / 600), 0.6);
      // leaf litter: small ticks in two tones
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? '#15170f' : '#7d7a43';
        g.globalAlpha = pass === 0 ? 0.7 : 0.6;
        g.lineWidth = 0.7;
        g.beginPath();
        for (let i = 0, n = Math.round((w * h) / 70); i < n; i++) {
          const x = rnd() * w;
          const y = rnd() * h;
          const a = rnd() * TAU;
          seg(g, x, y, x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.1);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      for (let i = 0, n = Math.round((w * h) / 1100); i < n; i++) {
        tuft(g, rnd() * w, rnd() * h, 0.9 + rnd() * 0.8, rnd() < 0.5 ? pal.tuft : '#6f7f45', rnd);
      }
      // toadstools
      for (let i = 0, n = Math.round((w * h) / 9000); i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        g.fillStyle = INK;
        g.fillRect(x - 0.5, y, 1, 2);
        g.beginPath();
        g.ellipse(x, y, 2, 1.2, 0, Math.PI, TAU);
        g.fillStyle = rnd() < 0.5 ? BLOOD : BONE;
        g.fill();
        g.lineWidth = 0.6;
        g.strokeStyle = INK;
        g.stroke();
      }
    },
    mountains(g, w, h, rnd) {
      const pal = BIOME.mountains;
      mottle(g, w, h, pal, rnd, 1.2);
      // ledges: long hatched shelves
      for (let i = 0, n = Math.round((w * h) / 5200); i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = 18 + rnd() * 36;
        g.strokeStyle = INK;
        g.lineWidth = 1.1;
        g.globalAlpha = 0.8;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + len * 0.4, y - 2 - rnd() * 2);
        g.lineTo(x + len, y + (rnd() - 0.5) * 3);
        g.stroke();
        g.globalAlpha = 0.5;
        g.lineWidth = 0.5;
        g.beginPath();
        for (let k = 2; k < len; k += 2.2)
          seg(g, x + k, y + 0.6, x + k - 2.4, y + 3.5 + rnd() * 2.5);
        g.stroke();
      }
      g.globalAlpha = 1;
      // scree
      for (let i = 0, n = Math.round((w * h) / 520); i < n; i++) {
        const t = rnd();
        stone(
          g,
          rnd() * w,
          rnd() * h,
          0.9 + rnd() * 2.6,
          t < 0.4 ? '#6b675e' : t < 0.8 ? '#89857a' : '#a8a394',
          rnd
        );
      }
      for (let i = 0, n = Math.round((w * h) / 6000); i < n; i++) {
        crack(g, rnd() * w, rnd() * h, rnd() * TAU, 14 + rnd() * 18, rnd, 1, 0.8, INK);
      }
      speckle(g, w, h, rnd, Math.round((w * h) / 70), '#1a1917', 0.55);
    },
    corrupted(g, w, h, rnd) {
      const pal = BIOME.corrupted;
      mottle(g, w, h, pal, rnd, 1.5);
      hatchPatches(g, w, h, rnd, Math.round((w * h) / 420), 0.7);
      // black veins with a sick violet thread inside
      for (let i = 0, n = Math.round((w * h) / 2300); i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const a = rnd() * TAU;
        const len = 26 + rnd() * 40;
        const sub = mulberry(Math.floor(rnd() * 1e9));
        const sub2 = mulberry(1);
        crack(g, x, y, a, len, sub, 2, 2.6, INK);
        g.globalAlpha = 0.5;
        crack(g, x, y, a, len * 0.5, sub2, 0, 0.7, '#7a4c86');
        g.globalAlpha = 1;
      }
      // pustules
      for (let i = 0, n = Math.round((w * h) / 5200); i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 1.6 + rnd() * 2.2;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.7, 0, 0, TAU);
        g.fillStyle = '#5b3a66';
        g.fill();
        g.lineWidth = 0.9;
        g.strokeStyle = INK;
        g.stroke();
        g.fillStyle = BONE;
        g.globalAlpha = 0.7;
        g.fillRect(x - r * 0.4, y - r * 0.35, 0.9, 0.7);
        g.globalAlpha = 1;
      }
      for (let i = 0, n = Math.round((w * h) / 2600); i < n; i++) {
        tuft(g, rnd() * w, rnd() * h, 0.7 + rnd() * 0.6, '#544458', rnd);
      }
      speckle(g, w, h, rnd, Math.round((w * h) / 80), '#07050a', 0.6);
    },
    hellscape(g, w, h, rnd) {
      const pal = BIOME.hellscape;
      mottle(g, w, h, pal, rnd, 1.4);
      hatchPatches(g, w, h, rnd, Math.round((w * h) / 380), 0.75);
      // cracks: black with an ember line down the middle
      for (let i = 0, n = Math.round((w * h) / 2600); i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const a = rnd() * TAU;
        const len = 22 + rnd() * 44;
        const seed = Math.floor(rnd() * 1e9);
        crack(g, x, y, a, len, mulberry(seed), 2, 3, INK);
        // kept dull and thin: the cracks are ground, and must sit behind the red rope,
        // fire pits and blood on top of them
        crack(g, x, y, a, len, mulberry(seed), 2, 0.9, '#8f2814');
        g.globalAlpha = 0.6;
        crack(g, x, y, a, len * 0.5, mulberry(seed), 0, 0.4, '#d88a48');
        g.globalAlpha = 1;
      }
      // cinders
      speckle(g, w, h, rnd, Math.round((w * h) / 60), '#07050a', 0.7);
      speckle(g, w, h, rnd, Math.round((w * h) / 260), '#d0591f', 0.8);
      speckle(g, w, h, rnd, Math.round((w * h) / 200), '#8d8478', 0.5);
      for (let i = 0, n = Math.round((w * h) / 6500); i < n; i++) {
        stone(g, rnd() * w, rnd() * h, 1.6 + rnd() * 2.4, '#1c1213', rnd);
      }
    },
  };

  /** The dead: bones, ribs and skulls, thicker toward the north and in the bad lands. */
  function remains(g, w, h, rnd, biomeAtY) {
    const n = Math.round((w * h) / 3800);
    for (let i = 0; i < n; i++) {
      const x = 6 + rnd() * (w - 12);
      const y = 8 + Math.pow(rnd(), 1.4) * (h - 16);
      const bio = biomeAtY(x, y);
      const grim = bio === 'corrupted' || bio === 'hellscape';
      const t = rnd();
      if (!grim && rnd() < 0.35) continue;
      if (t < 0.5) bone(g, x, y, 2.2 + rnd() * 2, rnd() * Math.PI);
      else if (t < 0.72 && kit) kit.skull(g, x, y, 0.75 + rnd() * 0.35);
      else if (t < 0.86) ribs(g, x, y, 0.8 + rnd() * 0.4);
      else {
        // old blood, dried black-red
        g.globalAlpha = 0.5;
        g.fillStyle = '#3a0a0c';
        g.beginPath();
        g.ellipse(x, y, 4 + rnd() * 5, 1.6 + rnd() * 2, rnd(), 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  /** Enemy standards along the north edge, where they come from. */
  function northEdge(g, w, rnd) {
    const grad = g.createLinearGradient(0, 0, 0, 34);
    grad.addColorStop(0, 'rgba(7,5,10,0.78)');
    grad.addColorStop(0.5, 'rgba(60,8,12,0.3)');
    grad.addColorStop(1, 'rgba(60,8,12,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, 34);
    g.save();
    g.beginPath();
    g.rect(0, 0, w, 20);
    g.clip();
    g.globalAlpha = 0.55;
    g.strokeStyle = INK;
    g.lineWidth = 0.7;
    g.beginPath();
    for (let x = -20; x < w + 20; x += 2.6) seg(g, x + 9, 0, x, 20);
    g.stroke();
    g.restore();
    const n = Math.max(3, Math.round(w / 58));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w + (rnd() - 0.5) * 14;
      const y = 22 + rnd() * 5;
      const hgt = 13 + rnd() * 5;
      if (i % 2 === 0 && kit) {
        kit.totem(g, x, y, hgt);
      } else {
        g.strokeStyle = INK;
        g.lineWidth = 1.5;
        g.lineCap = 'round';
        g.beginPath();
        seg(g, x, y, x, y - hgt);
        g.stroke();
        // torn red standard
        g.beginPath();
        g.moveTo(x, y - hgt);
        g.lineTo(x + 8, y - hgt + 1.2);
        g.lineTo(x + 5.6, y - hgt + 3.4);
        g.lineTo(x + 8.4, y - hgt + 5.6);
        g.lineTo(x + 4.2, y - hgt + 6);
        g.lineTo(x + 2.6, y - hgt + 8.2);
        g.lineTo(x, y - hgt + 6.4);
        g.closePath();
        g.fillStyle = BLOOD;
        g.fill();
        g.lineWidth = 0.9;
        g.lineJoin = 'round';
        g.stroke();
      }
    }
  }

  let groundCv = null;
  let groundKey = '';
  let groundSize = '';
  let groundCheckedAt = -1e9;
  let groundBands = [];

  function bandsKey(bands) {
    let k = '';
    for (const b of bands || []) {
      k += `${b.biome}:${Math.round(b.x0 ?? -1)},${Math.round(b.y0)},${Math.round(b.x1 ?? -1)},${Math.round(b.y1)};`;
    }
    return k;
  }

  function biomeAt(x, y) {
    let best = 'plains';
    let rank = -1;
    for (const b of groundBands) {
      if (y < b.y0 || y > b.y1) continue;
      if (b.x0 != null && (x < b.x0 || x > b.x1)) continue;
      const r = BIOME_RANK[b.biome] ?? 0;
      if (r > rank) {
        rank = r;
        best = b.biome;
      }
    }
    return best;
  }

  function buildGround(w, h, bands) {
    const S = Math.max(1, Math.min(2, 2200 / Math.max(w, h)));
    const cv = makeCanvas(w * S, h * S);
    const g = cv.getContext('2d');
    g.setTransform(S, 0, 0, S, 0, 0);
    g.fillStyle = BIOME.plains.base;
    g.fillRect(0, 0, w, h);
    PAINT.plains(g, w, h, mulberry(11 + w * 3 + h));

    const ordered = (bands || [])
      .filter((b) => b.biome && b.biome !== 'plains' && PAINT[b.biome])
      .sort((p, q) => (BIOME_RANK[p.biome] ?? 0) - (BIOME_RANK[q.biome] ?? 0));
    for (const b of ordered) {
      const x0 = b.x0 != null ? b.x0 : -40;
      const x1 = b.x1 != null ? b.x1 : w + 40;
      const y0 = b.y0 <= 0 ? -40 : b.y0;
      const y1 = b.y1 >= h ? h + 40 : b.y1;
      const layer = makeCanvas(w * S, h * S);
      const lg = layer.getContext('2d');
      lg.setTransform(S, 0, 0, S, 0, 0);
      lg.fillStyle = BIOME[b.biome].base;
      lg.fillRect(0, 0, w, h);
      PAINT[b.biome](lg, w, h, mulberry(97 + (BIOME_RANK[b.biome] ?? 0) * 131 + w));
      const mask = makeCanvas(w * S, h * S);
      const mg = mask.getContext('2d');
      mg.setTransform(S, 0, 0, S, 0, 0);
      // mask: the band with a ragged, hard edge, like a torn sheet laid on the one below
      const rnd = mulberry(Math.round(y0 * 7 + y1 * 3 + x0) + 5);
      const edge = [];
      let drift = 0;
      const jit = () => {
        drift = drift * 0.6 + (rnd() - 0.5) * 9;
        return drift + (rnd() - 0.5) * 3;
      };
      for (let x = x0; x <= x1; x += 5) edge.push(x, y0 + jit());
      for (let y = y0; y <= y1; y += 5) edge.push(x1 + jit(), y);
      for (let x = x1; x >= x0; x -= 5) edge.push(x, y1 + jit());
      for (let y = y1; y >= y0; y -= 5) edge.push(x0 + jit(), y);
      const tracePath = (c) => {
        c.beginPath();
        c.moveTo(edge[0], edge[1]);
        for (let k = 2; k < edge.length; k += 2) c.lineTo(edge[k], edge[k + 1]);
        c.closePath();
      };
      mg.fillStyle = '#fff';
      tracePath(mg);
      mg.fill();
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.globalCompositeOperation = 'destination-in';
      lg.drawImage(mask, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(layer, 0, 0);
      g.setTransform(S, 0, 0, S, 0, 0);
      // the seam: a broken ink line with a thinner echo inside it, and short ticks across
      g.save();
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = INK;
      g.globalAlpha = 0.78;
      g.lineWidth = 1.5;
      g.setLineDash([17, 4, 6, 5]);
      tracePath(g);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 0.5;
      g.lineWidth = 0.7;
      g.beginPath();
      for (let k = 0; k + 3 < edge.length; k += 2) {
        if (rnd() > 0.45) continue;
        const ax = edge[k];
        const ay = edge[k + 1];
        const dx = edge[k + 2] - ax;
        const dy = edge[k + 3] - ay;
        const len = Math.hypot(dx, dy) || 1;
        // normal pointing into the band (the outline runs clockwise)
        const nx = -dy / len;
        const ny = dx / len;
        const t = 2.5 + rnd() * 3.5;
        g.moveTo(ax + nx * 1.2, ay + ny * 1.2);
        g.lineTo(ax + nx * t + dx * 0.3, ay + ny * t + dy * 0.3);
      }
      g.stroke();
      g.restore();
      g.setTransform(S, 0, 0, S, 0, 0);
    }

    groundBands = bands || [];
    remains(g, w, h, mulberry(41 + w), biomeAt);
    northEdge(g, w, mulberry(7 + w));

    // edge vignette, heavier at the corners
    const vg = g.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.42,
      w / 2,
      h / 2,
      Math.hypot(w, h) * 0.56
    );
    vg.addColorStop(0, 'rgba(7,5,10,0)');
    vg.addColorStop(1, 'rgba(7,5,10,0.5)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    return cv;
  }

  /**
   * The ground canvas for a w x h world. `bandsFn` returns the biome bands; it is only
   * asked every couple of seconds, and the canvas is only repainted when they change.
   */
  function ground(w, h, tick, bandsFn) {
    const sw = Math.max(1, Math.floor(w));
    const sh = Math.max(1, Math.floor(h));
    const size = `${sw}x${sh}`;
    if (groundCv && size === groundSize && Math.abs(tick - groundCheckedAt) < 120) return groundCv;
    groundCheckedAt = tick;
    let bands;
    try {
      bands = (bandsFn && bandsFn()) || [];
    } catch (_) {
      bands = [];
    }
    const key = size + '|' + bandsKey(bands);
    if (groundCv && key === groundKey) return groundCv;
    groundCv = buildGround(sw, sh, bands);
    groundKey = key;
    groundSize = size;
    decorSprite = new WeakMap();
    return groundCv;
  }

  function drawGround(ctx, w, h, tick, bandsFn) {
    const sw = Math.max(1, Math.floor(w));
    const sh = Math.max(1, Math.floor(h));
    ctx.drawImage(ground(w, h, tick, bandsFn), 0, 0, sw, sh);
  }

  // ------------------------------------------------------------------- props
  const propCache = new Map();
  let decorSprite = new WeakMap();
  const PROP_SCALE = 2.5;

  function blob(g, cx, cy, rx, ry, rnd, fill, lw) {
    const n = 11;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = 0.82 + ((i * 37) % 5) * 0.06 + rnd() * 0.12;
      const x = cx + Math.cos(a) * rx * rr;
      const y = cy + Math.sin(a) * ry * rr;
      if (i === 0) g.moveTo(x, y);
      else {
        const am = ((i - 0.5) / n) * TAU;
        g.quadraticCurveTo(cx + Math.cos(am) * rx * 1.22, cy + Math.sin(am) * ry * 1.22, x, y);
      }
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
  }

  function shadowEll(g, x, y, rx, ry) {
    g.globalAlpha = 0.4;
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }

  function trunk(g, s, lean, top) {
    g.beginPath();
    g.moveTo(-s * 0.16, 0);
    g.quadraticCurveTo(-s * 0.1 + lean * 0.5, top * 0.5, lean - s * 0.07, top);
    g.lineTo(lean + s * 0.07, top);
    g.quadraticCurveTo(s * 0.1 + lean * 0.5, top * 0.5, s * 0.18, 0);
    g.closePath();
    g.fillStyle = '#2c2019';
    g.fill();
    g.lineWidth = 1.1;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
  }

  function paintTree(g, s, rnd, kind) {
    shadowEll(g, s * 0.2, s * 0.05, s * 0.62, s * 0.2);
    const lean = (rnd() - 0.5) * s * 0.2;
    if (kind === 'dead') {
      trunk(g, s, lean, -s * 0.9);
      g.lineCap = 'round';
      const limb = (x, y, a, len, lw, depth) => {
        const x2 = x + Math.cos(a) * len;
        const y2 = y + Math.sin(a) * len;
        g.strokeStyle = INK;
        g.lineWidth = lw;
        g.beginPath();
        seg(g, x, y, x2, y2);
        g.stroke();
        if (depth > 0) {
          limb(x2, y2, a - 0.5 - rnd() * 0.4, len * 0.62, lw * 0.65, depth - 1);
          limb(x2, y2, a + 0.4 + rnd() * 0.5, len * 0.55, lw * 0.65, depth - 1);
        }
      };
      limb(lean, -s * 0.85, -Math.PI / 2 - 0.5, s * 0.42, 1.9, 2);
      limb(lean, -s * 0.85, -Math.PI / 2 + 0.55, s * 0.4, 1.9, 2);
      limb(lean * 0.6, -s * 0.5, -Math.PI / 2 + 1.1, s * 0.3, 1.4, 1);
      if (rnd() < 0.5) {
        // a hanged man's rope
        g.lineWidth = 0.6;
        g.beginPath();
        seg(g, lean + s * 0.3, -s * 0.72, lean + s * 0.3, -s * 0.48);
        g.stroke();
      }
      return;
    }
    if (kind === 'pine') {
      trunk(g, s * 0.8, lean * 0.4, -s * 0.5);
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const y0 = -s * (0.25 + i * 0.3);
        const wHalf = s * (0.46 - i * 0.11);
        const tip = y0 - s * 0.5;
        g.beginPath();
        g.moveTo(lean * 0.4 - wHalf, y0);
        g.lineTo(lean * 0.4 - wHalf * 0.5, y0 - s * 0.05);
        g.lineTo(lean * 0.4, tip);
        g.lineTo(lean * 0.4 + wHalf * 0.5, y0 - s * 0.05);
        g.lineTo(lean * 0.4 + wHalf, y0);
        g.lineTo(lean * 0.4 + wHalf * 0.3, y0 + s * 0.06);
        g.lineTo(lean * 0.4, y0 - s * 0.02);
        g.lineTo(lean * 0.4 - wHalf * 0.3, y0 + s * 0.06);
        g.closePath();
        g.fillStyle = i % 2 ? '#34432c' : '#2a3725';
        g.fill();
        g.lineWidth = 1.1;
        g.strokeStyle = INK;
        g.lineJoin = 'round';
        g.stroke();
        if (kit) {
          kit.hatch(
            g,
            [lean * 0.4, tip, lean * 0.4 + wHalf, y0, lean * 0.4, y0],
            1.8,
            0.7,
            0.7,
            0.5
          );
        }
      }
      return;
    }
    // broadleaf: three inked masses, the lower right in shadow
    trunk(g, s, lean, -s * 0.55);
    const leaf =
      kind === 'dark' ? ['#2b3524', '#39482d', '#48592f'] : ['#3a4a2c', '#4c5d33', '#64733e'];
    blob(g, lean + s * 0.24, -s * 0.62, s * 0.36, s * 0.27, rnd, leaf[0], 1.2);
    blob(g, lean - s * 0.26, -s * 0.7, s * 0.36, s * 0.28, rnd, leaf[1], 1.2);
    blob(g, lean, -s * 0.98, s * 0.42, s * 0.32, rnd, leaf[2], 1.3);
    if (kit) {
      kit.hatchEll(g, lean + s * 0.2, -s * 0.6, s * 0.4, s * 0.3, 1.9, 0.8, 0.75, 0.55);
      kit.hatchEll(g, lean + s * 0.14, -s * 0.9, s * 0.26, s * 0.22, 2.2, 0.8, 0.45, 0.5);
    }
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = lean + (rnd() - 0.5) * s * 0.7;
      const y = -s * (0.6 + rnd() * 0.55);
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 1.6, y - 1.6, x + 3.2, y);
    }
    g.stroke();
  }

  function paintRock(g, s, rnd, kind) {
    shadowEll(g, s * 0.15, s * 0.12, s * 0.85, s * 0.3);
    const dark = kind === 'dead' || kind === 'dark';
    const face = dark ? '#4b444b' : '#8d8776';
    const top = dark ? '#6a626a' : '#b5ae99';
    const pts = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const rr = s * (0.7 + rnd() * 0.3);
      pts.push(Math.cos(a) * rr, Math.sin(a) * rr * 0.95);
    }
    g.beginPath();
    g.moveTo(-s * 0.78, s * 0.14);
    for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.lineTo(s * 0.8, s * 0.14);
    g.closePath();
    g.fillStyle = face;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
    // lit top facet
    g.beginPath();
    g.moveTo(pts[2], pts[3]);
    g.lineTo(pts[4], pts[5]);
    g.lineTo(pts[6], pts[7]);
    g.lineTo(pts[8], pts[9]);
    g.lineTo(s * 0.1, -s * 0.28);
    g.lineTo(-s * 0.3, -s * 0.22);
    g.closePath();
    g.fillStyle = top;
    g.fill();
    g.lineWidth = 0.7;
    g.stroke();
    if (kit) {
      kit.hatch(
        g,
        [s * 0.1, -s * 0.3, s * 0.85, -s * 0.3, s * 0.85, s * 0.14, s * 0.0, s * 0.14],
        1.7,
        0.7,
        0.75,
        0.5
      );
    }
    g.lineWidth = 0.6;
    g.beginPath();
    seg(g, -s * 0.36, -s * 0.2, -s * 0.44, s * 0.1);
    g.stroke();
    if (kind === 'dead' && rnd() < 0.6 && kit) kit.skull(g, -s * 0.5, s * 0.16, 0.7);
  }

  function propSprite(type, size, kind, variant) {
    const bucket = Math.max(6, Math.round(size / 3) * 3);
    const key = `${type}|${bucket}|${kind}|${variant}`;
    let e = propCache.get(key);
    if (e) return e;
    const s = type === 'tree' ? bucket * 1.15 : bucket * 0.62;
    const halfW = s * 1.1 + 4;
    const up = type === 'tree' ? s * 1.45 + 4 : s * 1.1 + 3;
    const dn = s * 0.4 + 3;
    const cv = makeCanvas(halfW * 2 * PROP_SCALE, (up + dn) * PROP_SCALE);
    const g = cv.getContext('2d');
    g.setTransform(PROP_SCALE, 0, 0, PROP_SCALE, halfW * PROP_SCALE, up * PROP_SCALE);
    const rnd = mulberry(bucket * 31 + variant * 977 + (type === 'tree' ? 3 : 9));
    if (type === 'tree') paintTree(g, s, rnd, kind);
    else paintRock(g, s, rnd, kind);
    const t = typeof BuildingArt !== 'undefined' ? BuildingArt.trim(cv) : { cv, x: 0, y: 0 };
    e = {
      cv: t.cv,
      ox: halfW - t.x / PROP_SCALE,
      oy: up - t.y / PROP_SCALE,
      w: t.cv.width / PROP_SCALE,
      h: t.cv.height / PROP_SCALE,
    };
    if (propCache.size > 160) propCache.clear();
    propCache.set(key, e);
    return e;
  }

  const TREE_KIND = {
    plains: 'leaf',
    forest: 'dark',
    mountains: 'pine',
    corrupted: 'dead',
    hellscape: 'dead',
  };

  /** Draws a tree or rock decoration from a cached sprite. Returns false for other types. */
  function drawDecor(ctx, d) {
    if (d.type !== 'tree' && d.type !== 'rock') return false;
    let e = decorSprite.get(d);
    if (!e) {
      const bio = biomeAt(d.x, d.y);
      const variant = Math.abs(Math.round(d.x * 7 + d.y * 13)) % 3;
      let kind = TREE_KIND[bio] || 'leaf';
      if (d.type === 'tree' && bio === 'forest' && variant === 2) kind = 'pine';
      e = propSprite(d.type, d.size || 14, kind, variant);
      decorSprite.set(d, e);
    }
    ctx.drawImage(e.cv, d.x - e.ox, d.y - e.oy, e.w, e.h);
    return true;
  }

  // ---------------------------------------------------------------- the line
  const LINE_SCALE = 3;
  const LINE_UP = 20;
  const LINE_DN = 8;
  const POST_GAP = 56;
  const FLASH_TICKS = 70;
  let lineCv = null;
  let lineKey = 0;
  let linePosts = [];
  const breachMarks = [];
  let lastBreachTick = -1e9;
  let lineTick = 0;

  function lineY(worldH) {
    return worldH - LINE_INSET + 6;
  }

  /** Two crossed sharpened stakes, the nearer one over the farther. */
  function crossStakes(g, x, y, s, rnd) {
    const lean = 3.4 * s;
    const hgt = (7.5 + rnd() * 2) * s;
    for (const dir of [-1, 1]) {
      const bx = x - dir * lean;
      const tx = x + dir * lean * 0.9;
      const ty = y - hgt;
      const nx = (ty - y) / Math.hypot(tx - bx, ty - y);
      const ny = -(tx - bx) / Math.hypot(tx - bx, ty - y);
      const hw = 1.05 * s;
      g.beginPath();
      g.moveTo(bx - nx * hw, y - ny * hw);
      g.lineTo(tx - nx * hw * 0.9 - (tx - bx) * 0.12, ty - ny * hw * 0.9 + hgt * 0.12);
      g.lineTo(tx, ty);
      g.lineTo(tx + nx * hw * 0.9 - (tx - bx) * 0.12, ty + ny * hw * 0.9 + hgt * 0.12);
      g.lineTo(bx + nx * hw, y + ny * hw);
      g.closePath();
      g.fillStyle = dir < 0 ? '#6b5236' : '#8f7450';
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = INK;
      g.lineJoin = 'round';
      g.stroke();
      // pale cut tip
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx - nx * hw * 0.7 - (tx - bx) * 0.09, ty - ny * hw * 0.7 + hgt * 0.09);
      g.lineTo(tx + nx * hw * 0.7 - (tx - bx) * 0.09, ty + ny * hw * 0.7 + hgt * 0.09);
      g.closePath();
      g.fillStyle = BONE;
      g.fill();
      g.lineWidth = 0.5;
      g.stroke();
    }
  }

  function ropeY(x, x0, x1, top) {
    const t = (x - x0) / Math.max(1, x1 - x0);
    return top + Math.sin(t * Math.PI) * 4.2;
  }

  function buildLine(w) {
    const cv = makeCanvas(w * LINE_SCALE, (LINE_UP + LINE_DN) * LINE_SCALE);
    const g = cv.getContext('2d');
    g.setTransform(LINE_SCALE, 0, 0, LINE_SCALE, 0, LINE_UP * LINE_SCALE);
    const rnd = mulberry(w * 13 + 3);
    // trodden strip with hatching under the stakes
    // a dark bed behind the whole fence, so the rope reads on red, violet or pale ground
    g.fillStyle = INK;
    g.globalAlpha = 0.16;
    g.fillRect(0, -17, w, 25);
    g.globalAlpha = 0.3;
    g.fillRect(0, -13.5, w, 12);
    g.globalAlpha = 0.5;
    g.fillRect(0, -1.5, w, 5.5);
    g.globalAlpha = 0.6;
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.beginPath();
    for (let x = -4; x < w + 4; x += 2.4) seg(g, x + 3, -3, x, 6.5);
    g.stroke();
    g.globalAlpha = 1;

    const n = Math.max(2, Math.round(w / POST_GAP));
    linePosts = [];
    for (let i = 0; i <= n; i++) linePosts.push(Math.max(7, Math.min(w - 7, (i / n) * w)));

    // sharpened stakes between the posts, pointing at the enemy
    for (let x = 6; x < w - 4; x += 8.5) {
      let nearPost = false;
      for (const p of linePosts) if (Math.abs(p - x) < 5) nearPost = true;
      if (nearPost) continue;
      crossStakes(g, x + (rnd() - 0.5) * 1.6, 2 + (rnd() - 0.5) * 1.4, 0.85 + rnd() * 0.2, rnd);
    }
    // rope: black under, blood red over, sagging between posts
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (let i = 0; i < linePosts.length - 1; i++) {
        const x0 = linePosts[i];
        const x1 = linePosts[i + 1];
        for (let x = x0; x <= x1; x += 2) {
          const y = ropeY(x, x0, x1, -11.5);
          if (x === x0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.lineTo(x1, -11.5);
      }
      g.strokeStyle = pass === 0 ? INK : '#d01822';
      g.lineWidth = pass === 0 ? 3.8 : 2;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.stroke();
      if (pass === 1) {
        // bone flecks along the rope: the binding, and a light edge against dark ground
        g.setLineDash([1.2, 5.2]);
        g.strokeStyle = BONE;
        g.lineWidth = 2;
        g.lineCap = 'butt';
        g.stroke();
        g.setLineDash([]);
      }
    }
    // posts: stout, bone-capped, bound in red
    for (const p of linePosts) {
      g.fillStyle = '#7d6242';
      g.beginPath();
      g.rect(p - 1.7, -14.5, 3.4, 18);
      g.fill();
      g.lineWidth = 1.1;
      g.strokeStyle = INK;
      g.stroke();
      if (kit) kit.hatch(g, [p, -14.5, p + 1.7, -14.5, p + 1.7, 3.5, p, 3.5], 1.4, 0.6, 0.8, 0.5);
      g.fillStyle = BLOOD;
      g.fillRect(p - 1.7, -12.6, 3.4, 2.2);
      g.strokeRect(p - 1.7, -12.6, 3.4, 2.2);
      if (kit) kit.skull(g, p, -16, 0.8);
    }
    return cv;
  }

  function resetLine() {
    breachMarks.length = 0;
    lastBreachTick = -1e9;
  }

  /** Call when an enemy gets through: flashes the line and breaks a stake at x. */
  function noteBreach(x, tick) {
    const t = Number.isFinite(tick) ? tick : lineTick;
    lastBreachTick = t;
    if (Number.isFinite(x)) {
      breachMarks.push({ x, t });
      if (breachMarks.length > 24) breachMarks.shift();
    }
  }

  function drawPennant(ctx, x, y, tick, i, col) {
    const ph = tick * 0.16 + i * 1.7;
    const a = Math.sin(ph) * 1.3;
    const b = Math.sin(ph + 1.2) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3.2, y + 0.6 + a, x + 8.5, y + 2.6 + b);
    ctx.quadraticCurveTo(x + 3.6, y + 3.4 + a, x, y + 5);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * The breach line. opts: { dark (0..1), breachesLeft, lowDetail }.
   * Enemies that cross it are through; the line shows where that is, day and night.
   */
  function drawLine(ctx, worldW, worldH, tick, opts = {}) {
    const w = Math.max(40, Math.floor(worldW));
    if (tick + 5 < lineTick) resetLine();
    lineTick = tick;
    if (!lineCv || lineKey !== w) {
      lineCv = buildLine(w);
      lineKey = w;
    }
    const y = lineY(worldH);
    const since = tick - lastBreachTick;
    const flashing = since >= 0 && since < FLASH_TICKS;
    ctx.drawImage(lineCv, 0, y - LINE_UP, w, LINE_UP + LINE_DN);

    // broken stakes and blood where they got through
    for (const m of breachMarks) {
      const rnd = mulberry(Math.round(m.x * 31));
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#5a0a10';
      ctx.beginPath();
      ctx.ellipse(m.x, y + 5, 9, 3.2, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      // the gap: trampled dirt where the stakes and rope were
      ctx.fillStyle = '#3a2d22';
      ctx.fillRect(m.x - 7, y - 14.5, 14, 13);
      ctx.fillStyle = '#241a14';
      ctx.fillRect(m.x - 7, y - 2.5, 14, 5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let k = -6; k < 7; k += 2.2) seg(ctx, m.x + k + 1.5, y - 2.5, m.x + k, y + 2.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let k = 0; k < 3; k++) {
        const bx = m.x - 5 + k * 5 + rnd() * 2;
        ctx.beginPath();
        ctx.moveTo(bx - 1.2, y + 2);
        ctx.lineTo(bx - 0.9, y - 3 - rnd() * 2);
        ctx.lineTo(bx + 0.2, y - 1.5 - rnd() * 2);
        ctx.lineTo(bx + 1.1, y - 4 - rnd() * 2);
        ctx.lineTo(bx + 1.3, y + 2);
        ctx.closePath();
        ctx.fillStyle = '#8f7450';
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      // rope ends hanging
      ctx.strokeStyle = '#c0141e';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x - 7, y - 9);
      ctx.quadraticCurveTo(m.x - 5, y - 4, m.x - 6, y + 1);
      ctx.moveTo(m.x + 7, y - 9);
      ctx.quadraticCurveTo(m.x + 5.5, y - 5, m.x + 6.5, y);
      ctx.stroke();
    }

    // pennants on the posts; the last-chance line flies them black
    const last = opts.breachesLeft != null && opts.breachesLeft <= 0;
    for (let i = 0; i < linePosts.length; i++) {
      const p = linePosts[i];
      if (i % 2 === 0) drawPennant(ctx, p + 1.2, y - 24, tick, i, last ? INK : BLOOD);
      else if (typeof BuildingArt !== 'undefined') {
        // torch
        ctx.fillStyle = INK;
        ctx.fillRect(p - 0.7, y - 22, 1.4, 5);
        BuildingArt.drawFlame(ctx, p, y - 21.5, opts.dark > 0.2 ? 0.95 : 0.7, tick, i * 5.1);
      }
      if (i % 2 === 0) {
        ctx.fillStyle = INK;
        ctx.fillRect(p - 0.6, y - 25, 1.2, 8);
      }
    }

    if (flashing) {
      const k = 1 - since / FLASH_TICKS;
      const pulse = 0.5 + 0.5 * Math.sin(since * 0.7);
      ctx.save();
      ctx.globalAlpha = k * (0.35 + 0.45 * pulse);
      ctx.fillStyle = '#e01822';
      ctx.fillRect(0, y - 15, w, 20);
      ctx.globalAlpha = k * pulse;
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < linePosts.length - 1; i++) {
        const x0 = linePosts[i];
        const x1 = linePosts[i + 1];
        ctx.moveTo(x0, y - 11.5);
        ctx.quadraticCurveTo((x0 + x1) / 2, y - 11.5 + 8.4, x1, y - 11.5);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------- light
  const LIGHT_MAX = 170;
  const lights = new Float32Array(LIGHT_MAX * 4);
  let lightN = 0;
  let mapCv = null;
  let mapG = null;
  let holeCv = null;
  let warmCv = [];
  let prevPhase = '';
  let dawnAt = -1e9;
  let duskAt = -1e9;
  let dark = 0;
  let lightTick = -1;
  const DAWN_TICKS = 200;
  const NIGHTFALL_TICKS = 70;
  const casterMemo = new Map();

  function addLight(x, y, r, kind) {
    if (lightN >= LIGHT_MAX) return;
    const i = lightN * 4;
    lights[i] = x;
    lights[i + 1] = y;
    lights[i + 2] = r;
    lights[i + 3] = kind || 1;
    lightN++;
  }

  function buildLightSprites() {
    // The hole cut out of the dark: a full core, then two ink-wash steps to nothing.
    holeCv = makeCanvas(128, 128);
    let g = holeCv.getContext('2d');
    let rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.34, 'rgba(255,255,255,0.96)');
    rg.addColorStop(0.42, 'rgba(255,255,255,0.7)');
    rg.addColorStop(0.62, 'rgba(255,255,255,0.62)');
    rg.addColorStop(0.7, 'rgba(255,255,255,0.3)');
    rg.addColorStop(0.9, 'rgba(255,255,255,0.2)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    // Tints laid back into the hole: 1 torch amber, 2 enemy blood, 3 arcane violet, 4 moon bone.
    const tint = { 1: '236,150,60', 2: '200,30,30', 3: '150,110,220', 4: '200,205,220' };
    warmCv = [];
    for (const k of [1, 2, 3, 4]) {
      const cv = makeCanvas(64, 64);
      g = cv.getContext('2d');
      rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, `rgba(${tint[k]},0.34)`);
      rg.addColorStop(0.5, `rgba(${tint[k]},0.16)`);
      rg.addColorStop(1, `rgba(${tint[k]},0)`);
      g.fillStyle = rg;
      g.fillRect(0, 0, 64, 64);
      warmCv[k] = cv;
    }
  }

  function isCaster(type) {
    let v = casterMemo.get(type);
    if (v === undefined) {
      v = /mage|necro|shaman|summoner|prophet|warlock|wizard|sorcer|priest|healer|lich/.test(
        type || ''
      );
      casterMemo.set(type, v);
    }
    return v;
  }

  /** How dark the field is (0 day .. 1 night) and what colour the dark is. */
  function phaseState(phase, light, tick) {
    if (phase !== prevPhase) {
      if (prevPhase === 'night' && phase !== 'night') dawnAt = tick;
      if (prevPhase && prevPhase !== 'night' && phase === 'night') duskAt = tick;
      prevPhase = phase;
    }
    if (tick + 5 < lightTick) {
      dawnAt = -1e9;
      duskAt = -1e9;
    }
    lightTick = tick;
    const sinceDawn = tick - dawnAt;
    const sinceDusk = tick - duskAt;
    let r = 6;
    let g = 8;
    let b = 22;
    let a = 0;
    let mode = 'day';
    if (phase === 'night') {
      const k = Math.min(1, Math.max(0, sinceDusk / NIGHTFALL_TICKS));
      // nightfall: the red of dusk drains to blue-black
      r = 40 + (6 - 40) * k;
      g = 12 + (8 - 12) * k;
      b = 28 + (24 - 28) * k;
      a = 0.36 + 0.42 * k;
      dark = 0.6 + 0.4 * k;
      mode = k < 1 ? 'nightfall' : 'night';
    } else if (sinceDawn >= 0 && sinceDawn < DAWN_TICKS) {
      const k = sinceDawn / DAWN_TICKS;
      // dawn: blue-black thins to a cold rose, then clears
      r = 6 + (120 - 6) * k;
      g = 8 + (62 - 8) * k;
      b = 22 + (70 - 22) * k;
      a = 0.84 * (1 - k) * (1 - k) + 0.16 * Math.sin(k * Math.PI);
      dark = 1 - k;
      mode = 'dawn';
    } else if (light < 0.97) {
      // dusk deepens as the day's fight wears on
      const k = Math.min(1, (1 - light) / 0.58);
      r = 70 - 26 * k;
      g = 22 - 10 * k;
      b = 30 - 4 * k;
      a = 0.05 + 0.3 * k;
      dark = k * 0.62;
      mode = 'dusk';
    } else {
      dark = 0;
    }
    return { r, g, b, a, mode };
  }

  /**
   * Darkness and light for the whole field, in one offscreen map.
   * env: { light, phase, tick, buildings, units, hazards, simple, eyes }
   */
  function drawLight(ctx, worldW, mapH, env) {
    const tick = env.tick || 0;
    const st = phaseState(env.phase, env.light ?? 1, tick);
    if (st.a < 0.015) return;
    const w = Math.max(1, Math.floor(worldW));
    const h = Math.max(1, Math.floor(mapH));
    const ms = Math.min(0.5, 640 / Math.max(w, h));
    const mw = Math.ceil(w * ms);
    const mh = Math.ceil(h * ms);
    if (!mapCv || mapCv.width !== mw || mapCv.height !== mh) {
      mapCv = makeCanvas(mw, mh);
      mapG = mapCv.getContext('2d');
    }
    if (!holeCv) buildLightSprites();

    // gather lights
    lightN = 0;
    const lit = dark > 0.25;
    if (lit) {
      const out = addLight;
      const worldH = mapH - 50;
      const ly = lineY(worldH);
      for (let i = 1; i < linePosts.length; i += 2) addLight(linePosts[i], ly - 20, 44, 1);
      // Your own soldiers come first and are lit in every quality mode: a moonlit pool under
      // each one, wherever it stands, so the army never drops out of sight in the dark.
      if (env.units) {
        const units = env.units;
        for (let i = 0; i < units.length && lightN < LIGHT_MAX - 60; i++) {
          const u = units[i];
          if (u.hp <= 0 || u.team !== 'player') continue;
          const burning = u.burnUntil && u.burnUntil > tick;
          if (u.isGeneral) addLight(u.x, u.y, 48, 1);
          else if (isCaster(u.type)) addLight(u.x, u.y, 38, 3);
          else addLight(u.x, u.y, burning ? 36 : 30, burning ? 1 : 4);
        }
      }
      // Buried mines keep a faint pool too, so the Sapper's work can be found at night.
      if (typeof SapperKit !== 'undefined' && SapperKit.getMines) {
        const mines = SapperKit.getMines();
        for (let i = 0; i < mines.length && i < 24; i++) addLight(mines[i].x, mines[i].y, 17, 4);
      }
      if (typeof BuildingArt !== 'undefined' && env.buildings) {
        for (const b of env.buildings) {
          if (b.hp > 0) BuildingArt.lightsFor(b, out);
        }
      }
      if (env.hazards && !env.simple) {
        for (const hz of env.hazards) {
          const fire = /fire|ember|lava|burn/.test(hz.type || '');
          const voidy = /void|rift|corrupt/.test(hz.type || '');
          if (fire || voidy) addLight(hz.x, hz.y, (hz.radius || 30) * 1.5 + 14, fire ? 1 : 3);
        }
      }
      if (env.units && !env.simple) {
        const units = env.units;
        for (let i = 0; i < units.length && lightN < LIGHT_MAX - 8; i++) {
          const u = units[i];
          if (u.hp <= 0) continue;
          const burning = u.burnUntil && u.burnUntil > tick;
          if (u.team === 'player') continue;
          if (burning) addLight(u.x, u.y, 30, 1);
          else if (u.isBoss) addLight(u.x, u.y, 40, 2);
          else if (isCaster(u.type)) addLight(u.x, u.y, 24, 3);
        }
      }
    }

    // fill with dark, cut the pools, lay the tints back in
    const g = mapG;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy';
    g.globalAlpha = 1;
    g.fillStyle = `rgba(${st.r | 0},${st.g | 0},${st.b | 0},${st.a.toFixed(3)})`;
    g.fillRect(0, 0, mw, mh);
    if (st.mode === 'dusk' || st.mode === 'nightfall' || st.mode === 'dawn') {
      // a low sun: a band of colour from the horizon
      g.globalCompositeOperation = 'source-over';
      const band = st.mode === 'dawn' ? 'rgba(226,150,110,' : 'rgba(190,60,30,';
      const k =
        st.mode === 'dawn'
          ? Math.sin(Math.min(1, (tick - dawnAt) / DAWN_TICKS) * Math.PI)
          : st.mode === 'nightfall'
            ? 1 - Math.min(1, (tick - duskAt) / NIGHTFALL_TICKS)
            : Math.min(1, st.a * 2.4);
      const lg = g.createLinearGradient(0, 0, 0, mh * 0.5);
      lg.addColorStop(0, band + (0.34 * k).toFixed(3) + ')');
      lg.addColorStop(1, band + '0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, mw, mh * 0.5);
    }
    if (lightN) {
      const flick = dark;
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < lightN; i++) {
        const j = i * 4;
        const kind = lights[j + 3];
        const wob =
          kind === 4
            ? 1
            : 1 + Math.sin(tick * 0.21 + lights[j] * 0.37 + lights[j + 1] * 0.11) * 0.05;
        const r = lights[j + 2] * wob * ms;
        g.globalAlpha = (kind === 4 ? 0.84 : kind === 2 ? 0.7 : 0.92) * Math.min(1, flick * 1.4);
        g.drawImage(holeCv, lights[j] * ms - r, lights[j + 1] * ms - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = Math.min(1, dark * 1.2);
      for (let i = 0; i < lightN; i++) {
        const j = i * 4;
        const kind = lights[j + 3];
        if (kind === 4) continue;
        const r = lights[j + 2] * 0.9 * ms;
        g.drawImage(
          warmCv[kind] || warmCv[1],
          lights[j] * ms - r,
          lights[j + 1] * ms - r,
          r * 2,
          r * 2
        );
      }
      g.globalAlpha = 1;
    }
    ctx.drawImage(mapCv, 0, 0, w, h);

    // eyes in the dark
    if (env.units && env.eyes !== false && dark > 0.4) {
      const units = env.units;
      const inView = env.inView;
      ctx.fillStyle = '#ff2a22';
      let n = 0;
      for (let i = 0; i < units.length && n < 160; i++) {
        const u = units[i];
        if (u.team !== 'enemy' || u.hp <= 0) continue;
        if (inView && !inView(u.x, u.y, 12)) continue;
        n++;
        const s = Math.max(0.8, Math.min(2.4, (u.radius || 8) / 8));
        const rot = ((u.rotation ?? 90) * Math.PI) / 180;
        const fx = Math.cos(rot);
        const fy = Math.sin(rot);
        const cx = u.x + fx * 1.6 * s;
        const cy = u.y + fy * 1.6 * s;
        const e = 1.7 * s;
        const d = 0.95 * s;
        ctx.globalAlpha = Math.min(1, dark * 1.3) * (0.75 + 0.25 * Math.sin(tick * 0.13 + i));
        ctx.fillRect(cx - fy * e - d / 2, cy + fx * e - d / 2, d, d);
        ctx.fillRect(cx + fy * e - d / 2, cy - fx * e - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ----------------------------------------------------------------- weather
  /** Mirrors VisualPolish.pickWeather so the drawn layer matches the game's weather clock. */
  function weatherAt(wave, tick) {
    if (wave >= 1001) return 'ash';
    if (wave >= 200) return 'mist';
    if (tick % 2400 < 400) return Math.floor(tick / 2400) % 3 === 0 ? 'storm' : 'rain';
    if (tick % 5400 < 450) return 'snow';
    return 'clear';
  }

  let fogCv = null;
  function fogSprite() {
    if (fogCv) return fogCv;
    fogCv = makeCanvas(256, 64);
    const g = fogCv.getContext('2d');
    const rnd = mulberry(77);
    g.filter = 'blur(6px)';
    g.fillStyle = '#d9d6cc';
    for (let i = 0; i < 16; i++) {
      g.globalAlpha = 0.25 + rnd() * 0.3;
      g.beginPath();
      g.ellipse(64 + rnd() * 128, 24 + rnd() * 16, 18 + rnd() * 26, 5 + rnd() * 7, 0, 0, TAU);
      g.fill();
    }
    g.filter = 'none';
    return fogCv;
  }

  function frac(v) {
    return v - Math.floor(v);
  }

  /**
   * The visible weather layer. opts: { type (override), bounds {x0,y0,x1,y1}, lowDetail }.
   * Everything is positioned from the tick, so it holds still when the game is paused.
   */
  function drawWeather(ctx, worldW, mapH, wave, tick, opts = {}) {
    const type = opts.type || weatherAt(wave || 0, tick || 0);
    if (type === 'clear') return type;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, worldW, mapH);
    ctx.clip();
    paintWeather(ctx, type, worldW, mapH, tick || 0, opts.lowDetail ? 0.5 : 1);
    ctx.restore();
    return type;
  }

  function paintWeather(ctx, type, w, h, tick, dense) {
    if (type === 'rain' || type === 'storm') {
      const storm = type === 'storm';
      ctx.fillStyle = storm ? 'rgba(10,12,22,0.26)' : 'rgba(14,16,26,0.15)';
      ctx.fillRect(0, 0, w, h);
      const n = Math.round(((w * h) / (storm ? 900 : 1300)) * dense);
      const len = storm ? 19 : 15;
      const slant = storm ? -0.42 : -0.22;
      const speed = storm ? 11 : 8;
      ctx.lineCap = 'round';
      // Each streak is an ink stroke with a bone one laid over it, so it shows on pale
      // ground as well as dark; a third of them are nearer and heavier.
      const path = (from, step) => {
        ctx.beginPath();
        for (let i = from; i < n; i += step) {
          const near = i % 3 === 0 ? 1.35 : 1;
          const sx = frac(i * 0.6180339 + 0.13) * (w + 80);
          const ph = frac(i * 0.7548776);
          const y = frac(ph + (tick * speed * near * (0.8 + ph * 0.4)) / (h + 40)) * (h + 40) - 20;
          const x = sx + (y - h) * slant - 20;
          seg(ctx, x, y, x + len * near * slant, y + len * near);
        }
      };
      path(0, 1);
      ctx.strokeStyle = 'rgba(7,5,10,0.5)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(236,232,216,0.9)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // splash rings where drops land
      ctx.strokeStyle = 'rgba(236,232,216,0.7)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const rings = Math.round(n * 0.16);
      for (let i = 0; i < rings; i++) {
        const life = frac(i * 0.37 + tick / 22);
        const gen = Math.floor(i * 0.37 + tick / 22);
        const x = frac(Math.sin(i * 12.9898 + gen * 78.233) * 43758.5453) * w;
        const y = frac(Math.sin(i * 39.346 + gen * 11.135) * 24634.6345) * h;
        const r = 0.8 + life * 4;
        ctx.moveTo(x + r, y);
        ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU);
      }
      ctx.stroke();
      return;
    }
    if (type === 'snow') {
      ctx.fillStyle = 'rgba(214,222,236,0.1)';
      ctx.fillRect(0, 0, w, h);
      const n = Math.round(((w * h) / 2300) * dense);
      ctx.fillStyle = 'rgba(240,238,228,0.88)';
      for (let i = 0; i < n; i++) {
        const ph = frac(i * 0.7548776);
        const sp = 0.7 + ph * 0.9;
        const y = frac(ph + (tick * sp) / (h + 20)) * (h + 20) - 10;
        const x = frac(i * 0.6180339) * w + Math.sin(tick * 0.03 + i) * 6;
        const s = 0.9 + frac(i * 0.37) * 1.3;
        ctx.fillRect(x, y, s, s);
      }
      return;
    }
    if (type === 'mist') {
      const fog = fogSprite();
      const bands = dense < 1 ? 4 : 7;
      for (let i = 0; i < bands; i++) {
        const by = ((i + 0.3) / bands) * h + Math.sin(tick * 0.004 + i * 2.1) * 14;
        const bw = w * (1.3 + (i % 3) * 0.3);
        const bh = 70 + (i % 2) * 34;
        const dir = i % 2 ? 1 : -1;
        const off = frac((tick * 0.0009 * (1 + (i % 3) * 0.4) + i * 0.31) * dir) * bw;
        ctx.globalAlpha = 0.3 + 0.08 * Math.sin(tick * 0.01 + i);
        const stepX = bw * 0.55;
        for (let x = (off % stepX) - bw; x < w; x += stepX) {
          ctx.drawImage(fog, x, by - bh / 2, bw, bh);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (type === 'ash') {
      ctx.fillStyle = 'rgba(60,20,16,0.16)';
      ctx.fillRect(0, 0, w, h);
      // Pale flakes with an ink shadow under each, embers among them; batched by colour.
      const n = Math.round(((w * h) / 1000) * dense);
      const cols = ['rgba(7,5,10,0.6)', 'rgba(214,206,192,0.95)', 'rgba(240,120,44,0.95)'];
      for (let pass = 0; pass < 3; pass++) {
        ctx.fillStyle = cols[pass];
        for (let i = 0; i < n; i++) {
          const ember = i % 5 === 0;
          if (pass === 1 ? ember : pass === 2 ? !ember : false) continue;
          const ph = frac(i * 0.7548776);
          const y = frac(ph + (tick * (0.35 + ph * 0.5)) / (h + 20)) * (h + 20) - 10;
          const x = frac(i * 0.6180339) * w + Math.sin(tick * 0.02 + i * 1.3) * 10;
          const s = 1.5 + frac(i * 0.37) * 2;
          if (pass === 0) ctx.fillRect(x - 0.5, y - 0.3, s + 1.2, s * 0.7 + 1.2);
          else ctx.fillRect(x, y, s, s * 0.7);
        }
      }
    }
  }

  // -------------------------------------------------------------- fog of war
  let fowGrad = null;
  let fowKey = -1;
  /** The fog-of-war veil over the north; the gradient is built once per height. */
  function drawFogOfWar(ctx, worldW, fogTop) {
    const key = Math.round(fogTop);
    if (!fowGrad || fowKey !== key) {
      fowGrad = ctx.createLinearGradient(0, 0, 0, key);
      fowGrad.addColorStop(0, 'rgba(14, 18, 28, 0.42)');
      fowGrad.addColorStop(0.55, 'rgba(14, 18, 28, 0.16)');
      fowGrad.addColorStop(1, 'rgba(14, 18, 28, 0)');
      fowKey = key;
    }
    ctx.fillStyle = fowGrad;
    ctx.fillRect(0, 0, worldW, key);
  }

  function invalidate() {
    groundCv = null;
    groundKey = '';
    lineCv = null;
    propCache.clear();
    decorSprite = new WeakMap();
  }

  return {
    LINE_INSET,
    ground,
    drawGround,
    drawDecor,
    drawLine,
    lineY,
    noteBreach,
    drawLight,
    drawWeather,
    weatherAt,
    drawFogOfWar,
    biomeAt,
    invalidate,
    darkness: () => dark,
  };
})();

globalThis.FieldArt = FieldArt;
