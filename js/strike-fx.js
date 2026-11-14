/**
 * Tactical strikes on the field, in the ink style (flat fills, black edge, bone and blood
 * with one accent colour each).
 *
 * Every strike has three beats:
 *   wind-up   a reticle inked on the ground at the true radius, and the thing on its way;
 *   strike    the blow itself, when the damage lands;
 *   aftermath a mark that stays on the ground for a while (scorch, crater, frost, char).
 *
 * cast() takes the damage as a callback and runs it when the wind-up ends, so numbers and
 * blast arrive together. play() + impact() on the same tick (older callers) still works:
 * the impact visuals wait for the wind-up.
 */
const StrikeFX = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD_HI = '#c8141c';
  const EMBER = '#e0762a';
  const GOLD = '#d9a93a';
  const FROST = '#b9d6dc';
  const GREEN = '#7fd49a';
  const VIOLET = '#8a5cc0';
  const STEEL = '#8fa6bc';

  const MAX_STRIKES = 24;
  const MAX_SHOCKS = 16;
  const MAX_FLASHES = 6;
  const MAX_DEBRIS = 80;
  const MAX_MARKS = 22;
  const strikes = [];
  const shockwaves = [];
  const screenFlashes = [];
  const debris = [];
  const marks = [];

  let LIFE =
    typeof GameData !== 'undefined' && GameData.fxLife
      ? { ...GameData.fxLife }
      : {
          fireball: 48,
          lightning: 32,
          heal: 55,
          reinforce: 50,
          rally: 65,
          meteor: 58,
          frost_nova: 46,
          scout_flare: 42,
          fortify: 40,
          dispel: 42,
        };

  /** Ticks of warning before the blow lands. */
  const WIND = {
    fireball: 16,
    lightning: 8,
    meteor: 28,
    frost_nova: 6,
    heal: 6,
    dispel: 5,
    rally: 0,
    reinforce: 0,
    scout_flare: 0,
    fortify: 0,
  };

  const ACCENT = {
    fireball: EMBER,
    meteor: EMBER,
    lightning: BONE,
    frost_nova: FROST,
    heal: GREEN,
    reinforce: STEEL,
    rally: GOLD,
    scout_flare: GOLD,
    fortify: STEEL,
    dispel: VIOLET,
  };

  // Screen tint per strike: "r,g,b" and peak alpha. Never above MAX_FLASH_ALPHA.
  const FLASH = {
    fireball: ['200,70,30', 0.2],
    meteor: ['200,60,24', 0.22],
    lightning: ['228,220,196', 0.18],
    frost_nova: ['185,214,220', 0.14],
    heal: ['95,191,138', 0.1],
    rally: ['217,169,58', 0.12],
  };
  const MAX_FLASH_ALPHA = 0.22;
  const MAX_FLASH_LIFE = 14;

  function setFxLife(map) {
    if (map && typeof map === 'object') LIFE = { ...map };
  }

  function reducedMotion() {
    return typeof Settings !== 'undefined' && !!Settings.get?.('reducedMotion');
  }

  function inBounds(s, b) {
    if (!b) return true;
    const pad = (s.radius || 60) + 40;
    return (
      s.x + pad >= b.left && s.x - pad <= b.right && s.y + pad >= b.top && s.y - pad <= b.bottom
    );
  }

  function cap(list, max) {
    if (list.length > max) list.splice(0, list.length - max);
  }

  function play(type, x, y, radius = 50, opts = {}) {
    const life = opts.life || LIFE[type] || 40;
    const wind = opts.wind != null ? opts.wind : WIND[type] || 0;
    const s = {
      type,
      x,
      y,
      radius: radius || 50,
      wind,
      age: 0,
      landed: wind <= 0,
      land: typeof opts.land === 'function' ? opts.land : null,
      pending: null,
      life,
      maxLife: life,
      seed: Math.random() * 1000,
    };
    strikes.push(s);
    cap(strikes, MAX_STRIKES);
    if (s.landed) landed(s);
    return s;
  }

  /**
   * A strike whose effect lands with the blow. `land` runs once, when the wind-up ends.
   * Returns true: the caller must not apply the effect itself.
   */
  function cast(type, x, y, radius, land) {
    play(type, x, y, radius, { land });
    return true;
  }

  function addMark(kind, x, y, r, life) {
    marks.push({ kind, x, y, r, seed: (x * 13 + y * 7) % 100, life, maxLife: life });
    cap(marks, MAX_MARKS);
  }

  /** The blow has landed: run the caller's effect, the held impact, and leave a mark. */
  function landed(s) {
    s.landed = true;
    if (s.land) {
      const fn = s.land;
      s.land = null;
      try {
        fn();
      } catch (err) {
        console.error('strike landing failed', err);
      }
    }
    if (s.pending != null) {
      const i = s.pending;
      s.pending = null;
      burst(s.type, s.x, s.y, s.radius, i);
    }
    const P = typeof Particles !== 'undefined' ? Particles : null;
    if (s.type === 'fireball') {
      addMark('scorch', s.x, s.y, s.radius * 0.62, 2400);
      P?.smoke?.(s.x, s.y, 5, 8);
    } else if (s.type === 'meteor') {
      addMark('crater', s.x, s.y, s.radius * 0.55, 3600);
      P?.smoke?.(s.x, s.y - 6, 7, 10);
    } else if (s.type === 'lightning') {
      addMark('char', s.x, s.y, s.radius * 0.5, 1500);
    } else if (s.type === 'frost_nova') {
      addMark('frost', s.x, s.y, s.radius * 0.9, 420);
    }
  }

  function spawnDebris(x, y, count, colors) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 5;
      debris.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.5,
        life: 16 + Math.floor(Math.random() * 14),
        maxLife: 28,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1.5 + Math.random() * 2.5,
      });
    }
    cap(debris, MAX_DEBRIS);
  }

  /** Shockwave, screen tint, debris and particles of a blow. */
  function burst(type, x, y, radius, intensity) {
    const mult = Math.max(0.5, Math.min(2, intensity));
    shockwaves.push({
      x,
      y,
      radius: radius * mult,
      life: 20,
      maxLife: 20,
      color: ACCENT[type] || BONE,
      width: 1.5 + mult,
    });
    cap(shockwaves, MAX_SHOCKS);

    if (!reducedMotion()) {
      const f = FLASH[type];
      const flashLife = Math.min(MAX_FLASH_LIFE, Math.max(6, Math.round(8 + mult * 2)));
      screenFlashes.push({
        rgb: f ? f[0] : '228,220,196',
        a: Math.min(MAX_FLASH_ALPHA, f ? f[1] : 0.1),
        life: flashLife,
        maxLife: flashLife,
      });
      cap(screenFlashes, MAX_FLASHES);
    }

    const P = typeof Particles !== 'undefined' ? Particles : null;
    if (type === 'fireball' || type === 'meteor') {
      spawnDebris(x, y, Math.round(10 * mult), [EMBER, BLOOD_HI, INK, '#f0d080']);
      P?.strikeFire?.(x, y, mult);
      if (mult >= 1.2) P?.explosion?.(x, y);
    } else if (type === 'lightning') {
      spawnDebris(x, y, Math.round(6 * mult), [BONE, '#b9c6e0', INK]);
      P?.strikeLightning?.(x, y, mult);
    } else if (type === 'frost_nova') {
      spawnDebris(x, y, Math.round(8 * mult), [FROST, BONE, '#ffffff']);
      P?.strikeFrost?.(x, y, mult);
    } else if (type === 'heal') {
      P?.strikeHeal?.(x, y);
    }
  }

  function impact(type, x, y, radius = 50, intensity = 1) {
    // A strike of this kind still winding up at this spot: hold the impact for its landing.
    for (let i = strikes.length - 1; i >= 0; i--) {
      const s = strikes[i];
      if (s.landed || s.type !== type || s.pending != null) continue;
      if (Math.abs(s.x - x) < 2 && Math.abs(s.y - y) < 2) {
        s.pending = intensity;
        return;
      }
    }
    burst(type, x, y, radius, intensity);
  }

  function purgeLife(list) {
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (--item.life > 0) list[w++] = item;
    }
    list.length = w;
  }

  // Wind-ups count simulation ticks, not frames: a strike lands at the same moment of the
  // battle at any game speed or frame rate, and in a headless run with no frames at all.
  let simDriven = false;

  function windTick() {
    for (let i = 0; i < strikes.length; i++) {
      const s = strikes[i];
      if (s.landed) continue;
      s.age++;
      if (s.age >= s.wind) landed(s);
    }
  }

  /** One simulation tick. Called by the engine's update; lands strikes that are due. */
  function simTick() {
    simDriven = true;
    if (strikes.length) windTick();
  }

  /** One presentation frame. */
  function update() {
    if (!simDriven) windTick();
    let w = 0;
    for (let i = 0; i < strikes.length; i++) {
      const s = strikes[i];
      if (s.landed) {
        s.age++;
        s.life--;
      }
      if (s.life > 0) strikes[w++] = s;
    }
    strikes.length = w;
    purgeLife(shockwaves);
    purgeLife(screenFlashes);
    purgeLife(marks);
    w = 0;
    for (let i = 0; i < debris.length; i++) {
      const d = debris[i];
      d.life--;
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.12;
      if (d.life > 0) debris[w++] = d;
    }
    debris.length = w;
  }

  // ------------------------------------------------------------ ink helpers
  function ink(ctx, color, width) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + 2.2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function inkFill(ctx, color, edge = 1.6) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = edge;
    ctx.stroke();
  }

  /** A jagged burst outline: `n` spikes between r*inner and r, wobbling with the seed. */
  function jag(ctx, x, y, r, n, inner, seed, turn = 0) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const ang = (i / (n * 2)) * Math.PI * 2 + turn;
      const wob = 0.82 + 0.18 * Math.sin(seed + i * 2.7);
      const rr = (i % 2 ? r * inner : r) * wob;
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /** A soft-edged ink blot (scorch, shadow): a wobbly closed curve. */
  function blot(ctx, x, y, rx, ry, seed) {
    ctx.beginPath();
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const wob = 0.8 + 0.2 * Math.sin(seed + (i % n) * 1.9);
      const px = x + Math.cos(ang) * rx * wob;
      const py = y + Math.sin(ang) * ry * wob;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function rays(ctx, x, y, n, r0, r1, turn = 0) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + turn;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      ctx.moveTo(x + c * r0, y + s * r0);
      ctx.lineTo(x + c * r1, y + s * r1);
    }
  }

  /**
   * The wind-up marker: the true radius inked on the ground, four ticks, and a ring that
   * closes on the centre as the blow comes in. `t` runs 0..1.
   */
  function reticle(ctx, x, y, radius, t, accent) {
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ink(ctx, accent, 1.4);
    rays(ctx, x, y, 4, radius * 0.8, radius * 1.1, Math.PI / 4);
    ink(ctx, BONE, 1.6);
    const rr = radius * (1 - 0.8 * t);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ink(ctx, BLOOD_HI, 1.8);
  }

  function shadow(ctx, x, y, r) {
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Flame tongues trailing behind something falling along (dx,dy). */
  function flameTail(ctx, x, y, dx, dy, len, w, seed) {
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const nx = -uy;
    const ny = ux;
    for (let pass = 0; pass < 3; pass++) {
      const k = pass === 0 ? 1 : pass === 1 ? 0.72 : 0.4;
      const flick = 0.85 + 0.15 * Math.sin(seed * 3 + pass * 2.1);
      ctx.beginPath();
      ctx.moveTo(x + nx * w * k, y + ny * w * k);
      ctx.lineTo(x - ux * len * k * flick, y - uy * len * k * flick);
      ctx.lineTo(x - nx * w * k, y - ny * w * k);
      ctx.closePath();
      ctx.fillStyle = pass === 0 ? INK : pass === 1 ? BLOOD_HI : EMBER;
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------- wind-ups
  function windFireball(ctx, s, t) {
    reticle(ctx, s.x, s.y, s.radius, t, EMBER);
    shadow(ctx, s.x, s.y, 4 + t * 10);
    const fx = s.x + 46 * (1 - t);
    const fy = s.y - 150 * (1 - t);
    flameTail(ctx, fx, fy, -46, 150, 30, 6, s.seed + t * 20);
    ctx.beginPath();
    ctx.arc(fx, fy, 6.5, 0, Math.PI * 2);
    inkFill(ctx, EMBER, 2);
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.arc(fx - 1, fy + 1, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function windMeteor(ctx, s, t) {
    reticle(ctx, s.x, s.y, s.radius, t, EMBER);
    shadow(ctx, s.x, s.y, 6 + t * t * s.radius * 0.5);
    const mx = s.x + 150 * (1 - t);
    const my = s.y - 270 * (1 - t);
    flameTail(ctx, mx, my, -150, 270, 62, 11, s.seed + t * 30);
    jag(ctx, mx, my, 12, 7, 0.78, s.seed, t * 3);
    inkFill(ctx, '#2a2024', 2.4);
    ctx.strokeStyle = EMBER;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(mx, my, 8.5, 0.9, 2.9);
    ctx.stroke();
  }

  function windLightning(ctx, s, t) {
    reticle(ctx, s.x, s.y, s.radius, t, BONE);
    // The air prickles: short bone ticks jumping round the centre.
    rays(ctx, s.x, s.y, 6, 3 + t * 3, 8 + t * 6, s.seed + s.age * 1.3);
    ink(ctx, BONE, 1.2);
  }

  function windFrost(ctx, s, t) {
    reticle(ctx, s.x, s.y, s.radius, t, FROST);
  }

  function windHeal(ctx, s, t) {
    ctx.globalAlpha = 0.5 + t * 0.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
    ink(ctx, GREEN, 1.2);
    ctx.globalAlpha = 1;
  }

  function windDispel(ctx, s, t) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius * (1 - 0.5 * t), 0, Math.PI * 2);
    ink(ctx, VIOLET, 1.4);
  }

  const WINDUPS = {
    fireball: windFireball,
    meteor: windMeteor,
    lightning: windLightning,
    frost_nova: windFrost,
    heal: windHeal,
    dispel: windDispel,
  };

  // ----------------------------------------------------------------- strikes
  /** A flat comic blast: ink, blood, ember, bone, each a jagged star inside the last. */
  function fireBurst(ctx, x, y, radius, prog, seed) {
    const grow = Math.min(1, prog / 0.22);
    const out = radius * (0.35 + 0.7 * grow);
    const die = prog < 0.3 ? 1 : Math.max(0, 1 - (prog - 0.3) / 0.5);
    if (die <= 0) return;
    const turn = seed + prog * 1.2;
    jag(ctx, x, y, out, 11, 0.72, seed, turn);
    ctx.fillStyle = INK;
    ctx.fill();
    jag(ctx, x, y, out * 0.86 * die, 11, 0.7, seed + 1, turn);
    ctx.fillStyle = BLOOD_HI;
    ctx.fill();
    jag(ctx, x, y, out * 0.62 * die, 9, 0.66, seed + 2, -turn);
    ctx.fillStyle = EMBER;
    ctx.fill();
    jag(ctx, x, y, out * 0.34 * die, 7, 0.6, seed + 3, turn * 2);
    ctx.fillStyle = BONE;
    ctx.fill();
  }

  function drawFireball(ctx, s, prog) {
    fireBurst(ctx, s.x, s.y, s.radius, prog, s.seed);
  }

  function drawMeteor(ctx, s, prog) {
    fireBurst(ctx, s.x, s.y - 30, s.radius * 0.7, Math.max(0, prog - 0.08), s.seed + 5);
    fireBurst(ctx, s.x, s.y, s.radius * 1.05, prog, s.seed);
    // Earth thrown up round the rim.
    if (prog < 0.5) {
      const k = prog / 0.5;
      rays(ctx, s.x, s.y, 12, s.radius * (0.7 + k * 0.5), s.radius * (0.85 + k * 0.6), s.seed);
      ctx.globalAlpha = 1 - k;
      ink(ctx, '#6a5a40', 1.6);
      ctx.globalAlpha = 1;
    }
  }

  function boltPath(ctx, x0, y0, x1, y1, segs, sway, seed) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < segs; i++) {
      const k = i / segs;
      const off = Math.sin(seed + i * 2.3) * sway * (1 - Math.abs(k - 0.5));
      ctx.lineTo(x0 + (x1 - x0) * k + off, y0 + (y1 - y0) * k);
    }
    ctx.lineTo(x1, y1);
  }

  function drawLightning(ctx, s, prog) {
    const { x, y, radius } = s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // The bolt holds for the first third, then flickers out.
    const lit = prog < 0.3 || (prog < 0.5 && (s.age & 1) === 0);
    if (lit) {
      const top = Math.min(0, y - 420);
      const lean = Math.sin(s.seed) * 40;
      boltPath(ctx, x + lean, top, x, y, 9, radius * 0.5, s.seed);
      ink(ctx, BONE, 3.4);
      for (let b = 0; b < 3; b++) {
        const k = 0.35 + b * 0.2;
        const bx = x + lean * (1 - k) + Math.sin(s.seed + b) * 6;
        const by = top + (y - top) * k;
        const side = b % 2 ? 1 : -1;
        boltPath(ctx, bx, by, bx + side * radius * 0.7, by + 46, 4, 10, s.seed + b * 7);
        ink(ctx, BONE, 1.4);
      }
      jag(ctx, x, y, radius * 0.34, 8, 0.45, s.seed, 0);
      inkFill(ctx, BONE, 2);
    }
    // Ground arcs crawling outward.
    if (prog < 0.8) {
      const k = prog / 0.8;
      ctx.globalAlpha = 1 - k;
      rays(ctx, x, y, 7, radius * (0.2 + k * 0.4), radius * (0.45 + k * 0.6), s.seed);
      ink(ctx, BONE, 1.2);
      ctx.globalAlpha = 1;
    }
  }

  function drawHeal(ctx, s, prog) {
    const { x, y, radius } = s;
    const fade = prog > 0.75 ? (1 - prog) / 0.25 : 1;
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    // The reach of the rain: a dashed ring in ink with a thin green line.
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(x, y, radius * (0.9 + prog * 0.1), 0, Math.PI * 2);
    ink(ctx, GREEN, 1.2);
    ctx.setLineDash([]);
    // Falling drops, as short green strokes with an ink edge.
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + s.seed;
      const dist = radius * (0.15 + ((i * 0.37) % 1) * 0.75);
      const fall = ((i * 0.19 + prog * 1.6) % 1) * 26;
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * dist - 20 + fall;
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + 5);
    }
    ink(ctx, GREEN, 1.2);
    // A bone cross lifting off the ground, a thin green halo behind it.
    const cy = y - 4 - prog * 10;
    ctx.beginPath();
    ctx.arc(x, cy, 13, 0, Math.PI * 2);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, cy - 9);
    ctx.lineTo(x, cy + 9);
    ctx.moveTo(x - 6, cy - 3);
    ctx.lineTo(x + 6, cy - 3);
    ink(ctx, BONE, 3.2);
    ctx.globalAlpha = 1;
  }

  /** A small soldier in silhouette: ink body, bone helm. */
  function figure(ctx, x, y, step) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 3, y - 9);
    ctx.lineTo(x + 3, y - 9);
    ctx.lineTo(x + 4, y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 11, 3.2, 0, Math.PI * 2);
    inkFill(ctx, BONE, 1.4);
    // spear
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + step);
    ctx.lineTo(x + 5, y - 17);
    ctx.stroke();
  }

  function drawReinforce(ctx, s, prog) {
    const { x, y } = s;
    const fade = prog > 0.8 ? (1 - prog) / 0.2 : 1;
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    // Three figures march up from the south under a blood pennant.
    for (let i = 0; i < 3; i++) {
      const t = Math.max(0, Math.min(1, (prog - i * 0.1) * 2.2));
      const sx = x - 16 + i * 16;
      const sy = y + 34 * (1 - t);
      figure(ctx, sx, sy, Math.sin(prog * 40 + i) > 0 ? 1 : 0);
    }
    const py = y + 34 * (1 - Math.min(1, prog * 2.2));
    ctx.beginPath();
    ctx.moveTo(x, py - 2);
    ctx.lineTo(x, py - 30);
    ink(ctx, BONE, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, py - 30);
    ctx.lineTo(x + 14, py - 26 + Math.sin(prog * 30) * 1.5);
    ctx.lineTo(x, py - 21);
    ctx.closePath();
    inkFill(ctx, BLOOD_HI, 1.4);
    // Chevrons pointing up the field.
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const cy = y - 34 - i * 8 - prog * 8;
      ctx.moveTo(x - 7, cy + 5);
      ctx.lineTo(x, cy);
      ctx.lineTo(x + 7, cy + 5);
    }
    ink(ctx, STEEL, 1.6);
    ctx.globalAlpha = 1;
  }

  function drawRally(ctx, s, prog) {
    const { x, y, radius } = s;
    ctx.lineCap = 'round';
    // Gold on black, sweeping out to the real reach of the rally.
    for (let ring = 0; ring < 2; ring++) {
      const t = Math.max(0, Math.min(1, (prog - ring * 0.18) / 0.7));
      if (t <= 0 || t >= 1) continue;
      const ease = 1 - (1 - t) * (1 - t);
      ctx.globalAlpha = 1 - t * t;
      ctx.beginPath();
      ctx.arc(x, y, radius * ease, 0, Math.PI * 2);
      ink(ctx, GOLD, ring ? 1.4 : 2.4);
    }
    ctx.globalAlpha = prog > 0.8 ? (1 - prog) / 0.2 : 1;
    // The banner drops and plants.
    const drop = prog < 0.12 ? (1 - prog / 0.12) * 26 : 0;
    const by = y - drop;
    if (drop === 0 && prog < 0.3) {
      rays(ctx, x, y, 6, 4, 9 + (prog - 0.12) * 40, 0.5);
      ink(ctx, '#6a5a40', 1.2);
    }
    ctx.beginPath();
    ctx.moveTo(x, by + 2);
    ctx.lineTo(x, by - 30);
    ink(ctx, BONE, 1.8);
    const wave = Math.sin(prog * 26) * 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, by - 30);
    ctx.lineTo(x + 19, by - 27 + wave);
    ctx.lineTo(x + 14, by - 22 + wave);
    ctx.lineTo(x + 19, by - 16 + wave);
    ctx.lineTo(x + 1, by - 14);
    ctx.closePath();
    inkFill(ctx, BLOOD_HI, 1.6);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x + 8, by - 22 + wave * 0.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFrostNova(ctx, s, prog) {
    const { x, y, radius } = s;
    const reach = radius * Math.sqrt(Math.min(1, prog / 0.4));
    const die = prog < 0.55 ? 1 : Math.max(0, 1 - (prog - 0.55) / 0.45);
    ctx.lineJoin = 'miter';
    // Bone shards thrown out from the centre, pale frost on their lit side.
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + s.seed;
      const len = reach * (0.75 + 0.25 * Math.sin(s.seed + i * 3.1));
      const w = (5 + (i % 3) * 2) * die;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const bx = x + c * len * 0.25;
      const by = y + sn * len * 0.25;
      ctx.beginPath();
      ctx.moveTo(bx - sn * w, by + c * w);
      ctx.lineTo(x + c * len, y + sn * len);
      ctx.lineTo(bx + sn * w, by - c * w);
      ctx.closePath();
      inkFill(ctx, i % 2 ? FROST : BONE, 1.6);
    }
    ctx.globalAlpha = die;
    ctx.beginPath();
    ctx.arc(x, y, reach, 0, Math.PI * 2);
    ink(ctx, FROST, 1.4);
    ctx.globalAlpha = 1;
  }

  function drawScoutFlare(ctx, s, prog) {
    const { x, y, radius } = s;
    ctx.lineCap = 'round';
    if (prog < 0.4) {
      // The flare climbs from the line on a leaning arc.
      const t = prog / 0.4;
      const sx = x - radius * 0.35;
      const sy = y + 70;
      const hx = sx + (x - sx) * t;
      const hy = sy + (y - sy) * t - Math.sin(t * Math.PI) * 50;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + (x - sx) * 0.5 * t, sy - 60 * t, hx, hy);
      ink(ctx, GOLD, 1.4);
      jag(ctx, hx, hy, 6, 5, 0.5, s.seed, t * 5);
      inkFill(ctx, BLOOD_HI, 1.6);
      return;
    }
    const t = (prog - 0.4) / 0.6;
    // The lit ground: the whole revealed circle, faint, with a hard ink rim.
    ctx.globalAlpha = 0.1 * (1 - t);
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.arc(x, y, radius * Math.min(1, 0.3 + t * 1.4), 0, Math.PI * 2);
    ink(ctx, GOLD, 1.6);
    rays(ctx, x, y, 10, 10 + t * 10, 22 + t * 26, s.seed);
    ink(ctx, BONE, 1.4);
    jag(ctx, x, y, 9 * (1 - t) + 2, 6, 0.5, s.seed, t * 2);
    inkFill(ctx, GOLD, 1.6);
    ctx.globalAlpha = 1;
  }

  function shield(ctx, x, y, k) {
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y - 10 * k);
    ctx.lineTo(x + 9 * k, y - 10 * k);
    ctx.lineTo(x + 9 * k, y);
    ctx.lineTo(x, y + 11 * k);
    ctx.lineTo(x - 9 * k, y);
    ctx.closePath();
    inkFill(ctx, BONE, 2);
    ctx.fillStyle = BLOOD_HI;
    ctx.fillRect(x - 1.5 * k, y - 8 * k, 3 * k, 14 * k);
    ctx.fillRect(x - 7 * k, y - 4 * k, 14 * k, 3 * k);
  }

  function drawFortify(ctx, s, prog) {
    const { x, y, radius } = s;
    const fade = prog > 0.7 ? (1 - prog) / 0.3 : 1;
    ctx.globalAlpha = fade;
    ctx.lineCap = 'butt';
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.arc(x, y, radius * Math.min(1, 0.4 + prog * 2.4), 0, Math.PI * 2);
    ink(ctx, STEEL, 1.6);
    ctx.setLineDash([]);
    const pop = prog < 0.15 ? 0.6 + (prog / 0.15) * 0.6 : 1.2 - Math.min(0.2, (prog - 0.15) * 2);
    shield(ctx, x, y - 2, pop);
    ctx.globalAlpha = 1;
  }

  function drawDispel(ctx, s, prog) {
    const { x, y, radius } = s;
    const r = radius * (0.5 + prog * 0.6);
    ctx.globalAlpha = 1 - prog;
    ctx.lineCap = 'round';
    // Two broken rings turning against each other, and the wash thrown outward.
    for (let ring = 0; ring < 2; ring++) {
      const rr = r * (ring ? 0.68 : 1);
      const turn = (ring ? -1 : 1) * prog * 3 + s.seed;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a0 = turn + (i / 4) * Math.PI * 2;
        ctx.moveTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
        ctx.arc(x, y, rr, a0, a0 + 1.05);
      }
      ink(ctx, ring ? BONE : VIOLET, ring ? 1.2 : 2);
    }
    rays(ctx, x, y, 8, r * 0.2, r * 0.5, prog * 2);
    ink(ctx, VIOLET, 1.2);
    ctx.globalAlpha = 1;
  }

  const DRAWERS = {
    fireball: drawFireball,
    lightning: drawLightning,
    heal: drawHeal,
    reinforce: drawReinforce,
    rally: drawRally,
    meteor: drawMeteor,
    frost_nova: drawFrostNova,
    scout_flare: drawScoutFlare,
    fortify: drawFortify,
    dispel: drawDispel,
  };

  function drawShockwaves(ctx, bounds) {
    for (const s of shockwaves) {
      if (!inBounds(s, bounds)) continue;
      const prog = 1 - s.life / s.maxLife;
      const r = s.radius * (0.25 + prog * 0.95);
      ctx.globalAlpha = 1 - prog * prog;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ink(ctx, s.color, s.width * (1 - prog * 0.7));
    }
    ctx.globalAlpha = 1;
  }

  function drawDebris(ctx, bounds) {
    let last = null;
    for (const d of debris) {
      if (
        bounds &&
        (d.x < bounds.left || d.x > bounds.right || d.y < bounds.top || d.y > bounds.bottom)
      )
        continue;
      const sz = d.size * Math.min(1, (d.life / d.maxLife) * 1.5);
      if (d.color !== last) {
        ctx.fillStyle = d.color;
        last = d.color;
      }
      ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
  }

  function draw(ctx, bounds) {
    drawShockwaves(ctx, bounds);
    for (const s of strikes) {
      if (!inBounds(s, bounds)) continue;
      ctx.save();
      if (!s.landed) {
        const wind = WINDUPS[s.type];
        if (wind) wind(ctx, s, Math.min(1, s.age / Math.max(1, s.wind)));
      } else {
        const drawer = DRAWERS[s.type];
        if (drawer) drawer(ctx, s, 1 - s.life / s.maxLife);
      }
      ctx.restore();
    }
    drawDebris(ctx, bounds);
  }

  // -------------------------------------------------------------- aftermath
  /** What a strike leaves behind, drawn on the ground under the units. */
  function drawGround(ctx, bounds) {
    if (!marks.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (const m of marks) {
      if (bounds && !inBounds({ x: m.x, y: m.y, radius: m.r }, bounds)) continue;
      const fade = Math.min(1, m.life / 300);
      if (m.kind === 'scorch' || m.kind === 'crater') {
        ctx.globalAlpha = 0.58 * fade;
        ctx.fillStyle = '#120e10';
        blot(ctx, m.x, m.y, m.r, m.r * 0.78, m.seed);
        ctx.fill();
        ctx.globalAlpha = 0.75 * fade;
        ctx.fillStyle = INK;
        blot(ctx, m.x, m.y + 1, m.r * 0.55, m.r * 0.42, m.seed + 4);
        ctx.fill();
        // Soot thrown outward.
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.5 * fade;
        rays(ctx, m.x, m.y, 9, m.r * 0.85, m.r * 1.25, m.seed);
        ctx.stroke();
        if (m.kind === 'crater') {
          // A pit: lit bone rim on the far lip, cracks running out.
          ctx.globalAlpha = 0.85 * fade;
          ctx.beginPath();
          ctx.ellipse(m.x, m.y, m.r * 0.6, m.r * 0.44, 0, Math.PI * 1.05, Math.PI * 1.95);
          ctx.strokeStyle = '#b8ae96';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(m.x, m.y, m.r * 0.6, m.r * 0.44, 0, 0, Math.PI);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.6;
          ctx.stroke();
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const ang = m.seed + i * 1.07;
            const r0 = m.r * 0.66;
            const r1 = m.r * (1.0 + 0.3 * Math.sin(m.seed + i));
            ctx.moveTo(m.x + Math.cos(ang) * r0, m.y + Math.sin(ang) * r0 * 0.74);
            ctx.lineTo(
              m.x + Math.cos(ang + 0.15) * (r0 + r1) * 0.5,
              m.y + Math.sin(ang + 0.15) * (r0 + r1) * 0.37
            );
            ctx.lineTo(m.x + Math.cos(ang) * r1, m.y + Math.sin(ang) * r1 * 0.74);
          }
          ctx.stroke();
        }
      } else if (m.kind === 'char') {
        // Lightning burns a small black star with long thin branches.
        ctx.globalAlpha = 0.7 * fade;
        ctx.fillStyle = INK;
        jag(ctx, m.x, m.y, m.r * 0.5, 7, 0.4, m.seed, m.seed);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = m.seed + i * 1.26;
          const r1 = m.r * (0.9 + 0.3 * Math.sin(m.seed * 2 + i));
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(
            m.x + Math.cos(ang + 0.3) * r1 * 0.5,
            m.y + Math.sin(ang + 0.3) * r1 * 0.5 * 0.8
          );
          ctx.lineTo(m.x + Math.cos(ang) * r1, m.y + Math.sin(ang) * r1 * 0.8);
        }
        ctx.stroke();
      } else if (m.kind === 'frost') {
        // Rime: a pale ring and cracks, gone when the slow wears off.
        const f = Math.min(1, m.life / 120);
        ctx.globalAlpha = 0.6 * f;
        ctx.strokeStyle = FROST;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        for (let i = 0; i < 10; i++) {
          const ang = m.seed + i * 0.63;
          const r0 = m.r * 0.25;
          const r1 = m.r * (0.7 + 0.25 * Math.sin(m.seed + i * 2));
          ctx.moveTo(m.x + Math.cos(ang) * r0, m.y + Math.sin(ang) * r0);
          ctx.lineTo(m.x + Math.cos(ang) * r1, m.y + Math.sin(ang) * r1);
          ctx.lineTo(
            m.x + Math.cos(ang + 0.22) * r1 * 1.12,
            m.y + Math.sin(ang + 0.22) * r1 * 1.12
          );
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Alpha of one screen flash this frame: its own peak, faded out, capped. */
  function flashAlpha(f) {
    const t = Math.max(0, Math.min(1, f.life / (f.maxLife || 1)));
    return Math.min(MAX_FLASH_ALPHA, f.a) * t * t;
  }

  function drawScreenFx(ctx, w, h) {
    // A flash is a brief tint, never a flood: stacked flashes share one fill, capped.
    let best = null;
    let bestA = 0;
    for (const f of screenFlashes) {
      const a = flashAlpha(f);
      if (a > bestA) {
        bestA = a;
        best = f;
      }
    }
    if (!best || bestA <= 0.004) return;
    ctx.fillStyle = `rgba(${best.rgb},${bestA.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }

  function drawFortifyZones(ctx, zones, tick) {
    if (!zones?.length) return;
    ctx.save();
    ctx.lineCap = 'butt';
    for (const z of zones) {
      const fade = Math.min(1, z.timer / 90);
      ctx.globalAlpha = 0.07 * fade;
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9 * fade;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -(tick * 0.25);
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ink(ctx, STEEL, 1.4);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      shield(ctx, z.x, z.y - 2, 0.8);
    }
    ctx.restore();
  }

  /** The aiming reticle shown while a strike is armed. */
  function drawTargeting(ctx, type, x, y, radius, tick) {
    if (!type || x == null || y == null) return;
    const r = radius || 50;
    const accent = ACCENT[type] || BONE;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -(tick * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ink(ctx, accent, 1.5);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    rays(ctx, x, y, 4, r * 0.82, r * 1.12, Math.PI / 4);
    ink(ctx, BONE, 1.6);
    rays(ctx, x, y, 4, 3, 8, 0);
    ink(ctx, BLOOD_HI, 1.4);
    if (typeof SpriteGen !== 'undefined' && SpriteGen.drawAbilityIcon) {
      ctx.save();
      ctx.translate(x - 16, y - 16 - r * 0.45);
      SpriteGen.drawAbilityIcon(ctx, type === 'heal' ? 'heal_rain' : type);
      ctx.restore();
    }
    ctx.restore();
  }

  function clear() {
    strikes.length = 0;
    shockwaves.length = 0;
    screenFlashes.length = 0;
    debris.length = 0;
    marks.length = 0;
  }

  return {
    play,
    cast,
    impact,
    simTick,
    update,
    draw,
    drawGround,
    drawScreenFx,
    drawTargeting,
    drawFortifyZones,
    clear,
    setFxLife,
    WIND,
    /** For tests and tools. */
    counts: () => ({ strikes: strikes.length, marks: marks.length, flashes: screenFlashes.length }),
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.StrikeFX = StrikeFX;
