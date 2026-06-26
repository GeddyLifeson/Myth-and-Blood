/**
 * Particle and visual effect system.
 */
const Particles = (() => {
  let particles = [];
  let MAX_PARTICLES = 350;

  function setBudget(unitsOnField, qualityMult = 1) {
    const base = unitsOnField > 80 ? 220 : unitsOnField > 50 ? 280 : 350;
    MAX_PARTICLES = Math.max(80, Math.floor(base * Math.max(0.2, qualityMult)));
  }

  function trim() {
    if (particles.length <= MAX_PARTICLES) return;
    particles = particles.slice(-MAX_PARTICLES);
  }

  function spawn(x, y, config) {
    const count = config.count || 8;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (config.speed || 2) * (0.5 + Math.random());
      particles.push({
        x, y,
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

  function blood(x, y) {
    spawn(x, y, { count: 4, speed: 3, life: 18, colors: ['#8a2020', '#c03030'], size: 2, gravity: 0.1 });
  }

  function explosion(x, y) {
    spawn(x, y, { count: 12, speed: 5, life: 24, colors: ['#ff6020', '#ff9040', '#ffe080'], size: 4, gravity: 0.04 });
    particles.push({ x, y, vx: 0, vy: 0, life: 15, maxLife: 15, type: 'ring', color: '#ff6020', size: 5 });
  }

  function magic(x, y, color = '#8040ff') {
    spawn(x, y, { count: 12, speed: 2.5, life: 35, colors: [color, '#c080ff', '#ffe080'], size: 3, rise: 1, gravity: -0.04 });
  }

  function heal(x, y) {
    spawn(x, y, { count: 10, speed: 1.5, life: 40, colors: ['#40e0a0', '#80ffc0', '#c0ffe0'], size: 3, rise: 1.5, gravity: -0.06 });
  }

  function lightning(x, y) {
    particles.push({
      x, y: 0, vx: 0, vy: 0, life: 10, maxLife: 10,
      color: '#ffe040', size: 3, type: 'bolt', targetY: y, width: 30 + Math.random() * 20,
    });
  }

  function dust(x, y) {
    spawn(x, y, { count: 5, speed: 1.2, life: 18, colors: ['#8a7a60', '#6a5a40'], size: 2, gravity: -0.02 });
  }

  function trail(x, y, color) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x, y, vx: 0, vy: 0, life: 6, maxLife: 6,
      color, size: 2, type: 'dot', gravity: 0,
    });
  }

  function deathBurst(x, y, team) {
    const colors = team === 'enemy'
      ? ['#8a2020', '#c03030', '#4a1818', '#606060']
      : ['#2040a0', '#4080c0', '#c0a060', '#e8d5b0'];
    spawn(x, y, { count: 10, speed: 4, life: 22, colors, size: 3, gravity: 0.08 });
    particles.push({ x, y, vx: 0, vy: 0, life: 12, maxLife: 12, type: 'ring', color: colors[0], size: 8 });
  }

  function vetSpark(x, y) {
    spawn(x, y - 8, { count: 14, speed: 2.5, life: 32, colors: ['#ffd700', '#ffe080', '#fff8c0'], size: 3, rise: 1.2, gravity: -0.03 });
  }

  function honorBurst(x, y, color = '#ffd700') {
    spawn(x, y, { count: 16, speed: 3, life: 40, colors: [color, '#fff8c0', '#ffffff'], size: 4, rise: 0.8, gravity: -0.02 });
    particles.push({ x, y, vx: 0, vy: -1, life: 20, maxLife: 20, type: 'ring', color, size: 12 });
  }

  function weatherRain(x, y) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x, y, vx: -0.8, vy: 5 + Math.random() * 2, life: 18, maxLife: 18,
      color: 'rgba(160,200,255,0.55)', size: 1, type: 'streak', gravity: 0.1,
    });
  }

  function weatherAsh(x, y) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x, y, vx: (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random(), life: 35, maxLife: 35,
      color: 'rgba(120,80,70,0.5)', size: 2, type: 'dot', gravity: -0.01,
    });
  }

  function update() {
    particles = particles.filter(p => {
      p.life--;
      if (p.type === 'bolt' || p.type === 'ring') return p.life > 0;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.vx *= 0.96;
      return p.life > 0;
    });
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
        let cx = p.x, cy = 0;
        for (let i = 0; i < 6; i++) {
          cy += p.targetY / 6;
          cx += (Math.random() - 0.5) * p.width;
          ctx.lineTo(cx, cy);
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

  function clear() { particles = []; }

  return {
    spawn, blood, explosion, magic, heal, lightning, dust, trail,
    deathBurst, vetSpark, honorBurst, weatherRain, weatherAsh,
    update, draw, clear, setBudget,
  };
})();