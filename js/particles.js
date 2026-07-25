/**
 * Particle and visual effect system.
 */
const Particles = (() => {
  let particles = [];
  let MAX_PARTICLES = 350;
  let lodSpawnScale = 1;

  function setBudget(unitsOnField, qualityMult = 1, spriteLod = 0) {
    const base = unitsOnField > 80 ? 160 : unitsOnField > 50 ? 220 : 280;
    const lodMult =
      typeof SpriteLod !== 'undefined' ? SpriteLod.particleMultForLod(spriteLod) : 1;
    lodSpawnScale = lodMult;
    MAX_PARTICLES = Math.max(40, Math.floor(base * Math.max(0.2, qualityMult) * lodMult));
    trim(true);
  }

  function trim(dropLowLife = false) {
    if (particles.length <= MAX_PARTICLES) return;
    if (dropLowLife) {
      particles.sort((a, b) => a.life - b.life);
      particles = particles.slice(-MAX_PARTICLES);
      return;
    }
    particles = particles.slice(-MAX_PARTICLES);
  }

  function prune(aggressive = false) {
    const fadeCut = aggressive ? 0.35 : 0.1;
    particles = particles.filter((p) => p.life > p.maxLife * fadeCut);
    trim(true);
  }

  function spawn(x, y, config) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const count = Math.max(1, Math.floor((config.count || 8) * lodSpawnScale));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (config.speed || 2) * (0.5 + Math.random());
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (config.rise || 0),
        life: config.life || 30,
        maxLife: config.life || 30,
        color: config.colors
          ? config.colors[Math.floor(Math.random() * config.colors.length)]
          : '#ffffff',
        size: config.size || 3,
        gravity: config.gravity || 0,
        type: config.type || 'dot',
      });
    }
    trim();
  }

  function blood(x, y, opts = {}) {
    const mult = Math.max(0.5, opts.mult || 1);
    const count = Math.max(3, Math.round((opts.count || 6) * mult * lodSpawnScale));
    spawn(x, y, {
      count,
      speed: 2.8 + mult * 1.4,
      life: 16 + Math.round(mult * 8),
      colors: opts.colors || ['#6a1818', '#8a2020', '#c03030', '#4a1010', '#e04040'],
      size: opts.size || 2.2,
      gravity: 0.12,
    });
    // Small ground pool flecks
    if (mult >= 0.9 && particles.length < MAX_PARTICLES - 2) {
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + 3 + Math.random() * 3,
          vx: (Math.random() - 0.5) * 0.4,
          vy: 0,
          life: 22,
          maxLife: 22,
          color: '#5a1414',
          size: 2.5 + Math.random(),
          type: 'dot',
          gravity: 0,
        });
      }
      trim();
    }
  }

  /** Directional blood spray from a hit vector (attacker → target). */
  function bloodSpray(x, y, angleRad, mult = 1) {
    const n = Math.max(4, Math.round(7 * mult * lodSpawnScale));
    for (let i = 0; i < n; i++) {
      if (particles.length >= MAX_PARTICLES) break;
      const spread = (Math.random() - 0.5) * 1.1;
      const ang = angleRad + spread;
      const speed = (2.5 + Math.random() * 4) * mult;
      particles.push({
        x: x + (Math.random() - 0.5) * 3,
        y: y + (Math.random() - 0.5) * 3,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 0.5,
        life: 14 + Math.random() * 12,
        maxLife: 26,
        color: ['#8a2020', '#c03030', '#e04040', '#4a1010'][i % 4],
        size: 1.8 + Math.random() * 1.6,
        type: 'dot',
        gravity: 0.14,
      });
    }
    trim();
  }

  function impactDust(x, y, mult = 1) {
    spawn(x, y + 2, {
      count: Math.round(5 * mult),
      speed: 1.6 + mult,
      life: 14,
      colors: ['#8a7a60', '#6a5a40', '#a09070', '#c0b090'],
      size: 2,
      gravity: 0.06,
    });
  }

  function critBurst(x, y) {
    spawn(x, y, {
      count: 16,
      speed: 6,
      life: 22,
      colors: ['#ff4040', '#ff8040', '#ffe080', '#ffffff', '#ff6060'],
      size: 3.5,
      gravity: 0.05,
    });
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 14,
      maxLife: 14,
      type: 'ring',
      color: '#ff5050',
      size: 8,
    });
    trim();
  }

  function explosion(x, y) {
    spawn(x, y, {
      count: 14,
      speed: 5.5,
      life: 26,
      colors: ['#ff6020', '#ff9040', '#ffe080', '#ff3010'],
      size: 4,
      gravity: 0.04,
    });
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 16,
      maxLife: 16,
      type: 'ring',
      color: '#ff6020',
      size: 6,
    });
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 10,
      maxLife: 10,
      type: 'ring',
      color: '#ffe080',
      size: 3,
    });
    trim();
  }

  function magic(x, y, color = '#8040ff') {
    spawn(x, y, {
      count: 12,
      speed: 2.5,
      life: 35,
      colors: [color, '#c080ff', '#ffe080'],
      size: 3,
      rise: 1,
      gravity: -0.04,
    });
  }

  function heal(x, y) {
    spawn(x, y, {
      count: 10,
      speed: 1.5,
      life: 40,
      colors: ['#40e0a0', '#80ffc0', '#c0ffe0'],
      size: 3,
      rise: 1.5,
      gravity: -0.06,
    });
  }

  function lightning(x, y) {
    const width = 30 + Math.random() * 20;
    const segments = new Array(6);
    let cx = x;
    for (let i = 0; i < 6; i++) {
      cx += (Math.random() - 0.5) * width;
      segments[i] = cx;
    }
    particles.push({
      x,
      y: 0,
      vx: 0,
      vy: 0,
      life: 10,
      maxLife: 10,
      color: '#ffe040',
      size: 3,
      type: 'bolt',
      targetY: y,
      width,
      boltSeg: segments,
    });
    trim();
  }

  function dust(x, y) {
    spawn(x, y, {
      count: 5,
      speed: 1.2,
      life: 18,
      colors: ['#8a7a60', '#6a5a40'],
      size: 2,
      gravity: -0.02,
    });
  }

  function trail(x, y, color) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 6,
      maxLife: 6,
      color,
      size: 2,
      type: 'dot',
      gravity: 0,
    });
    trim();
  }

  function deathBurst(x, y, team) {
    const colors =
      team === 'enemy'
        ? ['#8a2020', '#c03030', '#4a1818', '#606060', '#2a1010']
        : ['#2040a0', '#4080c0', '#c0a060', '#e8d5b0', '#304878'];
    spawn(x, y, { count: 14, speed: 4.5, life: 26, colors, size: 3, gravity: 0.08 });
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 4,
        vx: 0,
        vy: 0,
        life: 10 + i * 4,
        maxLife: 18,
        type: 'ring',
        color: colors[i % colors.length],
        size: 6 + i * 3,
      });
    }
    trim();
  }

  function strikeFire(x, y, mult = 1) {
    const n = Math.round(18 * mult);
    spawn(x, y, {
      count: n,
      speed: 6,
      life: 28,
      colors: ['#ff6020', '#ff9040', '#ffe080', '#ff3010'],
      size: 4,
      gravity: 0.03,
    });
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 18,
      maxLife: 18,
      type: 'ring',
      color: '#ff6020',
      size: 10 * mult,
    });
    trim();
  }

  function strikeLightning(x, y, mult = 1) {
    spawn(x, y, {
      count: Math.round(14 * mult),
      speed: 5,
      life: 20,
      colors: ['#e8f0ff', '#a0c8ff', '#ffffff', '#80a0ff'],
      size: 3,
      rise: 0.5,
      gravity: -0.02,
    });
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 14,
      maxLife: 14,
      type: 'ring',
      color: '#c0e0ff',
      size: 14 * mult,
    });
    trim();
  }

  function strikeFrost(x, y, mult = 1) {
    spawn(x, y, {
      count: Math.round(16 * mult),
      speed: 3,
      life: 32,
      colors: ['#d0f0ff', '#a0d8ff', '#ffffff'],
      size: 3,
      rise: 0.3,
      gravity: 0.02,
    });
    trim();
  }

  function strikeHeal(x, y) {
    spawn(x, y, {
      count: 20,
      speed: 2,
      life: 36,
      colors: ['#40e0a0', '#80ffc0', '#c0ffe0'],
      size: 3,
      rise: 1.2,
      gravity: -0.04,
    });
    trim();
  }

  function vetSpark(x, y) {
    spawn(x, y - 8, {
      count: 14,
      speed: 2.5,
      life: 32,
      colors: ['#ffd700', '#ffe080', '#fff8c0'],
      size: 3,
      rise: 1.2,
      gravity: -0.03,
    });
  }

  function honorBurst(x, y, color = '#ffd700') {
    spawn(x, y, {
      count: 16,
      speed: 3,
      life: 40,
      colors: [color, '#fff8c0', '#ffffff'],
      size: 4,
      rise: 0.8,
      gravity: -0.02,
    });
    particles.push({ x, y, vx: 0, vy: -1, life: 20, maxLife: 20, type: 'ring', color, size: 12 });
    trim();
  }

  function weatherRain(x, y) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x,
      y,
      vx: -0.8,
      vy: 5 + Math.random() * 2,
      life: 18,
      maxLife: 18,
      color: 'rgba(160,200,255,0.55)',
      size: 1,
      type: 'streak',
      gravity: 0.1,
    });
    trim();
  }

  function weatherAsh(x, y) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.4 + Math.random(),
      life: 35,
      maxLife: 35,
      color: 'rgba(120,80,70,0.5)',
      size: 2,
      type: 'dot',
      gravity: -0.01,
    });
    trim();
  }

  function update() {
    let w = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life--;
      if (p.type === 'bolt' || p.type === 'ring') {
        if (p.life > 0) particles[w++] = p;
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.vx *= 0.96;
      if (p.life > 0) particles[w++] = p;
    }
    particles.length = w;
    if (particles.length > MAX_PARTICLES) trim(true);
    else if (particles.length > MAX_PARTICLES * 0.9) prune(false);
  }

  function inBounds(p, b) {
    if (!b) return true;
    return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
  }

  function draw(ctx, bounds) {
    for (const p of particles) {
      if (!inBounds(p, bounds)) continue;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;

      if (p.type === 'bolt') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        const seg = p.boltSeg;
        const stepY = p.targetY / 6;
        if (seg?.length === 6) {
          let cy = 0;
          for (let i = 0; i < 6; i++) {
            cy += stepY;
            ctx.lineTo(seg[i], cy);
          }
        } else {
          let cx = p.x;
          let cy = 0;
          for (let i = 0; i < 6; i++) {
            cy += stepY;
            cx += (Math.random() - 0.5) * (p.width || 30);
            ctx.lineTo(cx, cy);
          }
        }
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - alpha) * 30, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'streak') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 3, p.y + 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function clear() {
    particles = [];
  }

  function getCount() {
    return particles.length;
  }

  return {
    spawn,
    blood,
    bloodSpray,
    impactDust,
    critBurst,
    explosion,
    magic,
    heal,
    lightning,
    dust,
    trail,
    deathBurst,
    strikeFire,
    strikeLightning,
    strikeFrost,
    strikeHeal,
    vetSpark,
    honorBurst,
    weatherRain,
    weatherAsh,
    update,
    draw,
    clear,
    setBudget,
    prune,
    trim,
    getCount,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Particles = Particles;
