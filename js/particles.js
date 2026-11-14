/**
 * Particle system, drawn in the ink style: flat colour, black edge, no soft fades.
 *
 * Particles live in a fixed pool (no allocation while playing). Blood is thrown as inked
 * drops that land and settle into small ground flecks; fire leaves black smoke and a scorch.
 * Everything scales with the quality tier through setBudget().
 */
const Particles = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const BLOOD_HI = '#c8141c';
  const BLOOD_DARK = '#5a0a0e';
  const EMBER = ['#e0762a', '#f0a030', '#c8141c', '#f4d070'];
  const DUST = ['#8a7a60', '#6a5a40', '#a09070'];

  const POOL_SIZE = 420;
  const pool = new Array(POOL_SIZE);
  for (let i = 0; i < POOL_SIZE; i++) pool[i] = { boltSeg: null };
  let live = 0;
  let MAX_PARTICLES = 350;
  let lodSpawnScale = 1;
  let quality = 1;

  // Settled marks on the ground: blood flecks and scorch. A ring buffer, drawn under the units.
  const GROUND_MAX = 260;
  const GROUND_LIFE = 1500;
  const ground = new Array(GROUND_MAX);
  for (let i = 0; i < GROUND_MAX; i++) ground[i] = { x: 0, y: 0, r: 0, tilt: 0, kind: 0, life: 0 };
  let groundHead = 0;
  let groundLive = 0;
  let groundCap = GROUND_MAX;

  function setBudget(unitsOnField, qualityMult = 1, spriteLod = 0) {
    const base = unitsOnField > 80 ? 160 : unitsOnField > 50 ? 220 : 280;
    const lodMult = typeof SpriteLod !== 'undefined' ? SpriteLod.particleMultForLod(spriteLod) : 1;
    lodSpawnScale = lodMult;
    quality = Math.max(0.2, qualityMult) * lodMult;
    MAX_PARTICLES = Math.min(
      POOL_SIZE,
      Math.max(40, Math.floor(base * Math.max(0.2, qualityMult) * lodMult))
    );
    // Potato keeps no settled blood at all; reduced keeps a third.
    groundCap = quality < 0.35 ? 0 : quality < 0.6 ? 80 : quality < 0.8 ? 160 : GROUND_MAX;
    trim(true);
  }

  function kill(i) {
    live--;
    if (i !== live) {
      const dead = pool[i];
      pool[i] = pool[live];
      pool[live] = dead;
    }
  }

  /** Drop the particles nearest the end of their life until the pool is inside budget. */
  function trim(dropLowLife = false) {
    if (live <= MAX_PARTICLES) return;
    if (!dropLowLife) {
      // Oldest sit lowest in the pool: discard from the front by swapping in the newest.
      while (live > MAX_PARTICLES) kill(0);
      return;
    }
    while (live > MAX_PARTICLES) {
      let worst = 0;
      let worstLife = Infinity;
      // A bounded scan: good enough to shed the faintest, cheap when far over budget.
      const step = Math.max(1, Math.floor(live / 24));
      for (let i = 0; i < live; i += step) {
        if (pool[i].life < worstLife) {
          worstLife = pool[i].life;
          worst = i;
        }
      }
      kill(worst);
    }
  }

  function prune(aggressive = false) {
    const fadeCut = aggressive ? 0.35 : 0.1;
    for (let i = live - 1; i >= 0; i--) {
      const p = pool[i];
      if (p.life <= p.maxLife * fadeCut) kill(i);
    }
    trim(true);
  }

  /** Take a particle from the pool, recycling the oldest when the budget is spent. */
  function take() {
    if (live >= MAX_PARTICLES || live >= POOL_SIZE) {
      if (live === 0) return null;
      kill(0);
    }
    const p = pool[live++];
    p.gravity = 0;
    p.settle = 0;
    p.spin = 0;
    p.rot = 0;
    p.grow = 0;
    p.drag = 0.96;
    return p;
  }

  function put(type, x, y, vx, vy, life, color, size) {
    const p = take();
    if (!p) return null;
    p.type = type;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    return p;
  }

  function spawn(x, y, config) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const count = Math.max(1, Math.floor((config.count || 8) * lodSpawnScale));
    const colors = config.colors;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (config.speed || 2) * (0.5 + Math.random());
      const p = put(
        config.type || 'dot',
        px,
        py,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - (config.rise || 0),
        config.life || 30,
        colors ? colors[Math.floor(Math.random() * colors.length)] : BONE,
        config.size || 3
      );
      if (!p) return;
      p.gravity = config.gravity || 0;
    }
  }

  // ------------------------------------------------------------------ ground
  function groundMark(x, y, r, kind = 0, life = GROUND_LIFE) {
    if (groundCap <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const g = ground[groundHead];
    groundHead = (groundHead + 1) % GROUND_MAX;
    if (g.life <= 0) groundLive++;
    g.x = x;
    g.y = y;
    g.r = r;
    g.tilt = ((x * 7 + y * 13) % 10) / 10 - 0.5;
    g.kind = kind;
    g.life = life;
    g.maxLife = life;
  }

  function updateGround() {
    if (groundLive <= 0) return;
    let n = 0;
    for (let i = 0; i < GROUND_MAX; i++) {
      const g = ground[i];
      if (g.life <= 0) continue;
      g.life--;
      if (g.life > 0) n++;
    }
    // Over the tier's cap: age the marks quickly instead of popping them.
    if (n > groundCap) {
      for (let i = 0; i < GROUND_MAX; i++) {
        const g = ground[i];
        if (g.life > 90) g.life = Math.max(90, g.life - 40);
      }
    }
    groundLive = n;
  }

  /**
   * Settled blood and scorch, under the units. Two fills for the lot: marks shrink as they
   * dry instead of fading, so nothing needs its own alpha.
   */
  function drawGround(ctx, bounds) {
    if (groundLive > 0) {
      for (let kind = 0; kind < 2; kind++) {
        let any = false;
        for (let i = 0; i < GROUND_MAX; i++) {
          const g = ground[i];
          if (g.life <= 0 || g.kind !== kind) continue;
          if (
            bounds &&
            (g.x < bounds.left || g.x > bounds.right || g.y < bounds.top || g.y > bounds.bottom)
          )
            continue;
          const dry = g.life < 240 ? g.life / 240 : 1;
          const r = g.r * (0.35 + 0.65 * dry);
          if (!any) {
            ctx.beginPath();
            any = true;
          }
          ctx.moveTo(g.x + r * 1.5, g.y);
          ctx.ellipse(g.x, g.y, r * 1.5, r * 0.62, g.tilt, 0, Math.PI * 2);
        }
        if (any) {
          ctx.globalAlpha = kind === 1 ? 0.7 : 0.82;
          ctx.fillStyle = kind === 1 ? '#120e10' : BLOOD_DARK;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    // The other ground layers of the effects family ride on this one call.
    globalThis.StrikeFX?.drawGround?.(ctx, bounds);
    globalThis.ProjectileArt?.drawGround?.(ctx, bounds);
  }

  // ------------------------------------------------------------------- blood
  function drop(x, y, vx, vy, life, size) {
    const p = put('drop', x, y, vx, vy, life, BLOOD, size);
    if (!p) return;
    p.gravity = 0.1;
    p.drag = 0.93;
    p.settle = 1;
  }

  /** Undirected spatter, as from a blow with no known direction. */
  function blood(x, y, opts = {}) {
    const mult = Math.max(0.5, opts.mult || 1);
    const count = Math.max(2, Math.round((opts.count || 5) * mult * lodSpawnScale));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = (1.2 + Math.random() * 2.4) * (0.7 + mult * 0.4);
      drop(
        x + (Math.random() - 0.5) * 4,
        y + (Math.random() - 0.5) * 4,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed * 0.8,
        9 + Math.random() * 9,
        1 + Math.random() * 0.9
      );
    }
    if (mult >= 1.2) groundMark(x + (Math.random() - 0.5) * 6, y + 4, 2 + mult, 0);
  }

  /** Directional spray along the blow, attacker to target. */
  function bloodSpray(x, y, angleRad, mult = 1) {
    const n = Math.max(2, Math.round(5 * mult * lodSpawnScale));
    for (let i = 0; i < n; i++) {
      const ang = angleRad + (Math.random() - 0.5) * 0.9;
      const speed = (2 + Math.random() * 3.4) * (0.75 + mult * 0.3);
      drop(
        x + (Math.random() - 0.5) * 3,
        y + (Math.random() - 0.5) * 3,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed,
        8 + Math.random() * 10,
        0.9 + Math.random() * 1.1
      );
    }
  }

  function impactDust(x, y, mult = 1) {
    spawn(x, y + 2, {
      count: Math.round(4 * mult),
      speed: 1.4 + mult,
      life: 14,
      colors: DUST,
      size: 2,
      gravity: 0.05,
    });
  }

  function ring(x, y, color, size, life, grow = 30) {
    const p = put('ring', x, y, 0, 0, life, color, size);
    if (p) p.grow = grow;
  }

  function critBurst(x, y) {
    // Four ink splinters and a short blood ring: a crit reads without colouring the screen.
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.random() * 0.7;
      shard(x, y, ang, 3.2 + Math.random() * 1.6, i % 2 ? BONE : BLOOD_HI, 7);
    }
    ring(x, y, BLOOD_HI, 6, 12, 16);
  }

  // -------------------------------------------------------- fire, smoke, wood
  function smoke(x, y, count = 3, size = 5) {
    const n = Math.max(1, Math.round(count * lodSpawnScale));
    for (let i = 0; i < n; i++) {
      const p = put(
        'smoke',
        x + (Math.random() - 0.5) * size * 1.6,
        y + (Math.random() - 0.5) * size,
        (Math.random() - 0.5) * 0.5,
        -0.35 - Math.random() * 0.5,
        26 + Math.floor(Math.random() * 22),
        i % 3 === 0 ? '#2a2226' : INK,
        size * (0.7 + Math.random() * 0.6)
      );
      if (!p) return;
      p.drag = 0.97;
      p.gravity = -0.012;
    }
  }

  function embers(x, y, count = 8, speed = 4) {
    const n = Math.max(1, Math.round(count * lodSpawnScale));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      const p = put(
        'dot',
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd - 0.6,
        14 + Math.floor(Math.random() * 14),
        EMBER[i % EMBER.length],
        1.6 + Math.random() * 1.4
      );
      if (!p) return;
      p.gravity = 0.05;
    }
  }

  /** A thin spinning sliver: wood splinters, bone chips, ice. */
  function shard(x, y, ang, speed, color, len = 6) {
    const p = put(
      'shard',
      x,
      y,
      Math.cos(ang) * speed,
      Math.sin(ang) * speed,
      12 + Math.floor(Math.random() * 10),
      color,
      len
    );
    if (!p) return;
    p.rot = ang;
    p.spin = (Math.random() - 0.5) * 0.9;
    p.gravity = 0.06;
    p.drag = 0.92;
  }

  /** Splinters flying back along the line a missile came in on. */
  function splinter(x, y, angleRad = 0, count = 4, color = '#b08a52') {
    const n = Math.max(1, Math.round(count * lodSpawnScale));
    for (let i = 0; i < n; i++) {
      const ang = angleRad + Math.PI + (Math.random() - 0.5) * 1.8;
      shard(x, y, ang, 1.6 + Math.random() * 2.4, i % 3 === 2 ? INK : color, 4 + Math.random() * 4);
    }
  }

  function explosion(x, y) {
    embers(x, y, 12, 5);
    smoke(x, y, 4, 6);
    ring(x, y, EMBER[0], 6, 14, 26);
    groundMark(x, y + 2, 7, 1, 900);
  }

  function heal(x, y) {
    spawn(x, y, {
      count: 6,
      speed: 1.1,
      life: 34,
      colors: ['#5fbf8a', '#9fe0b8', BONE],
      size: 2.4,
      rise: 1.3,
      gravity: -0.05,
    });
  }

  function lightning(x, y) {
    const width = 30 + Math.random() * 20;
    const p = put('bolt', x, 0, 0, 0, 10, BONE, 3);
    if (!p) return;
    if (!p.boltSeg) p.boltSeg = new Array(6);
    let cx = x;
    for (let i = 0; i < 6; i++) {
      cx += (Math.random() - 0.5) * width;
      p.boltSeg[i] = cx;
    }
    p.targetY = y;
    p.width = width;
  }

  function dust(x, y) {
    spawn(x, y, {
      count: 4,
      speed: 1.1,
      life: 18,
      colors: DUST,
      size: 2,
      gravity: -0.02,
    });
  }

  function trail(x, y, color) {
    put('dot', x, y, 0, 0, 6, color, 1.6);
  }

  /**
   * A death: a heavy burst of blood that lands as stains, a few chips of what the dead
   * thing was wearing, and a mark on the ground where it fell.
   */
  function deathBurst(x, y, team) {
    const n = Math.max(4, Math.round(11 * lodSpawnScale));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 3.6;
      drop(
        x,
        y,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed * 0.8,
        10 + Math.random() * 12,
        1.2 + Math.random() * 1.3
      );
    }
    const chip = team === 'enemy' ? '#3a3034' : BONE;
    for (let i = 0; i < 3; i++) {
      shard(x, y, Math.random() * Math.PI * 2, 2 + Math.random() * 2, i ? chip : INK, 5);
    }
    groundMark(x + (Math.random() - 0.5) * 8, y + 5, 4.5, 0);
    groundMark(x + (Math.random() - 0.5) * 14, y + 2 + Math.random() * 6, 2.6, 0);
  }

  /**
   * Fire landing. A full strike asks for mult >= 1; a firebomb thrown by a unit asks for
   * about half, and gets a pot bursting: shards, a lick of flame, smoke and a scorch.
   */
  function strikeFire(x, y, mult = 1) {
    embers(x, y, Math.round(14 * mult), 4 + mult * 2);
    smoke(x, y, Math.round(2 + 3 * mult), 4 + mult * 3);
    ring(x, y, EMBER[0], 8 * mult, 16, 22 * mult);
    if (mult < 0.8) {
      for (let i = 0; i < 4; i++)
        shard(x, y, Math.random() * Math.PI * 2, 2.5 + Math.random() * 2, '#6a4a34', 4);
    }
    groundMark(x, y + 2, 5 + mult * 5, 1, 900);
  }

  function strikeLightning(x, y, mult = 1) {
    const n = Math.round(8 * mult);
    for (let i = 0; i < n; i++) {
      shard(x, y, Math.random() * Math.PI * 2, 3 + Math.random() * 3, i % 3 ? BONE : '#b9c6e0', 6);
    }
    smoke(x, y, 2, 4);
    ring(x, y, BONE, 10 * mult, 12, 20);
  }

  function strikeFrost(x, y, mult = 1) {
    const n = Math.round(12 * mult);
    for (let i = 0; i < n; i++) {
      shard(x, y, (i / n) * Math.PI * 2, 2.5 + Math.random() * 2.5, i % 2 ? '#b9d6dc' : BONE, 7);
    }
  }

  function strikeHeal(x, y) {
    spawn(x, y, {
      count: 14,
      speed: 1.8,
      life: 36,
      colors: ['#5fbf8a', '#9fe0b8', BONE],
      size: 2.6,
      rise: 1.2,
      gravity: -0.04,
    });
  }

  function vetSpark(x, y) {
    spawn(x, y - 8, {
      count: 10,
      speed: 2.2,
      life: 30,
      colors: ['#d9a93a', '#f0d080', BONE],
      size: 2.6,
      rise: 1.2,
      gravity: -0.03,
    });
  }

  function honorBurst(x, y, color = '#d9a93a') {
    spawn(x, y, {
      count: 12,
      speed: 2.8,
      life: 36,
      colors: [color, '#f0d080', BONE],
      size: 3,
      rise: 0.8,
      gravity: -0.02,
    });
    ring(x, y, color, 12, 20, 30);
  }

  function weatherRain(x, y) {
    if (live >= MAX_PARTICLES) return;
    const p = put('streak', x, y, -0.8, 5 + Math.random() * 2, 18, 'rgba(160,200,255,0.55)', 1);
    if (p) {
      p.gravity = 0.1;
      p.drag = 1;
    }
  }

  function weatherAsh(x, y) {
    if (live >= MAX_PARTICLES) return;
    const p = put(
      'dot',
      x,
      y,
      (Math.random() - 0.5) * 0.6,
      0.4 + Math.random(),
      35,
      '#5a4640',
      1.6
    );
    if (p) p.gravity = -0.01;
  }

  /** Drifting snow: slow, no gravity, long life. */
  function weatherSnow(x, y) {
    if (live >= MAX_PARTICLES) return;
    put(
      'dot',
      x,
      y,
      (Math.random() - 0.5) * 0.5,
      0.5 + Math.random() * 0.6,
      70,
      '#eef4f8',
      1 + Math.random() * 1.2
    );
  }

  function update() {
    for (let i = live - 1; i >= 0; i--) {
      const p = pool[i];
      p.life--;
      if (p.life <= 0) {
        // Blood that has finished flying lands and stays.
        if (p.settle && Math.random() < 0.55 * Math.min(1, quality + 0.2)) {
          groundMark(p.x, p.y, p.size * (0.9 + Math.random() * 0.8), 0);
        }
        kill(i);
        continue;
      }
      if (p.type === 'bolt' || p.type === 'ring') continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      if (p.type === 'drop') p.vy *= p.drag;
      else if (p.type === 'shard') p.rot += p.spin;
      else if (p.type === 'smoke') p.size *= 1.012;
    }
    if (live > MAX_PARTICLES) trim(true);
    updateGround();
    globalThis.ProjectileArt?.update?.();
  }

  function visible(p, b) {
    return !b || (p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom);
  }

  /**
   * Batched by kind: all blood is two strokes, all smoke one fill, all shards two strokes.
   * Only loose dots, rings and bolts set a style of their own.
   */
  function draw(ctx, bounds) {
    if (!live) return;
    let drops = 0;
    let smokes = 0;
    let shards = 0;
    let other = 0;
    for (let i = 0; i < live; i++) {
      const t = pool[i].type;
      if (t === 'drop') drops++;
      else if (t === 'smoke') smokes++;
      else if (t === 'shard') shards++;
      else other++;
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';

    if (smokes) {
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      for (let i = 0; i < live; i++) {
        const p = pool[i];
        if (p.type !== 'smoke' || !visible(p, bounds)) continue;
        const k = p.life / p.maxLife;
        const r = p.size * (k > 0.7 ? (1 - k) / 0.3 + 0.35 : Math.min(1.35, k / 0.7 + 0.1));
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (drops) {
      // Ink edge first, blood on top; a drop is a short stroke along its flight.
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? INK : BLOOD_HI;
        ctx.beginPath();
        let w = 0;
        for (let i = 0; i < live; i++) {
          const p = pool[i];
          if (p.type !== 'drop' || !visible(p, bounds)) continue;
          ctx.moveTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5);
          ctx.lineTo(p.x + 0.01, p.y + 0.01);
          w += p.size;
        }
        ctx.lineWidth = pass === 0 ? (w / drops) * 2 + 1.5 : (w / drops) * 2;
        ctx.stroke();
      }
    }

    if (shards) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i < live; i++) {
        const p = pool[i];
        if (p.type !== 'shard' || !visible(p, bounds)) continue;
        const h = (p.size * Math.min(1, (p.life / p.maxLife) * 1.6)) / 2;
        const c = Math.cos(p.rot) * h;
        const s = Math.sin(p.rot) * h;
        ctx.moveTo(p.x - c, p.y - s);
        ctx.lineTo(p.x + c, p.y + s);
      }
      ctx.stroke();
      ctx.lineWidth = 1.2;
      let last = null;
      for (let i = 0; i < live; i++) {
        const p = pool[i];
        if (p.type !== 'shard' || p.color === INK || !visible(p, bounds)) continue;
        if (p.color !== last) {
          if (last) ctx.stroke();
          ctx.strokeStyle = p.color;
          ctx.beginPath();
          last = p.color;
        }
        const h = (p.size * Math.min(1, (p.life / p.maxLife) * 1.6)) / 2;
        const c = Math.cos(p.rot) * h;
        const s = Math.sin(p.rot) * h;
        ctx.moveTo(p.x - c, p.y - s);
        ctx.lineTo(p.x + c, p.y + s);
      }
      if (last) ctx.stroke();
    }

    if (!other) return;
    let lastFill = null;
    for (let i = 0; i < live; i++) {
      const p = pool[i];
      const t = p.type;
      if (t === 'drop' || t === 'smoke' || t === 'shard' || !visible(p, bounds)) continue;
      const k = p.life / p.maxLife;
      if (t === 'bolt') {
        const seg = p.boltSeg;
        const stepY = p.targetY / 6;
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? INK : p.color;
          ctx.lineWidth = pass === 0 ? 5 * k + 1.5 : 2.4 * k + 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, 0);
          for (let j = 0, cy = 0; j < 6; j++) {
            cy += stepY;
            ctx.lineTo(seg[j], cy);
          }
          ctx.stroke();
        }
      } else if (t === 'ring') {
        const r = p.size + (1 - k) * p.grow;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.4 * k + 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6 * k + 0.3;
        ctx.stroke();
      } else if (t === 'streak') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 3, p.y + 6);
        ctx.stroke();
      } else {
        // Loose dots shrink as they die; small ones are squares, which cost no path.
        const r = p.size * (0.35 + 0.65 * k);
        if (p.color !== lastFill) {
          ctx.fillStyle = p.color;
          lastFill = p.color;
        }
        if (r < 1.7) {
          ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function clear() {
    live = 0;
    for (let i = 0; i < GROUND_MAX; i++) ground[i].life = 0;
    groundLive = 0;
    groundHead = 0;
    globalThis.ProjectileArt?.clear?.();
  }

  function getCount() {
    return live;
  }

  function getGroundCount() {
    return groundLive;
  }

  return {
    blood,
    bloodSpray,
    impactDust,
    critBurst,
    explosion,
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
    weatherSnow,
    smoke,
    embers,
    shard,
    splinter,
    ring,
    groundMark,
    update,
    draw,
    drawGround,
    clear,
    setBudget,
    prune,
    trim,
    getCount,
    getGroundCount,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Particles = Particles;
