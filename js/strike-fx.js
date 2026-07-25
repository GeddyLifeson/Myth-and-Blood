/**
 * Tactical strike sprites and battlefield animations.
 */
const StrikeFX = (() => {
  const MAX_STRIKES = 24;
  const MAX_SHOCKS = 16;
  const MAX_FLASHES = 6;
  let strikes = [];
  let shockwaves = [];
  let screenFlashes = [];
  let debris = [];

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

  function setFxLife(map) {
    if (map && typeof map === 'object') LIFE = { ...map };
  }

  function inBounds(s, b) {
    if (!b) return true;
    const pad = s.radius || 60;
    return (
      s.x + pad >= b.left && s.x - pad <= b.right && s.y + pad >= b.top && s.y - pad <= b.bottom
    );
  }

  function play(type, x, y, radius = 50, opts = {}) {
    const life = opts.life || LIFE[type] || 40;
    strikes.push({
      type,
      x,
      y,
      radius: radius || 50,
      life,
      maxLife: life,
      seed: Math.random() * 1000,
      ...opts,
    });
    if (strikes.length > MAX_STRIKES) strikes = strikes.slice(-MAX_STRIKES);
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
    if (debris.length > 80) debris = debris.slice(-80);
  }

  function impact(type, x, y, radius = 50, intensity = 1) {
    const mult = Math.max(0.5, Math.min(2, intensity));
    shockwaves.push({
      x,
      y,
      radius: radius * mult,
      life: 22,
      maxLife: 22,
      color: strikeColor(type),
      width: 2 + mult,
    });
    if (shockwaves.length > MAX_SHOCKS) shockwaves = shockwaves.slice(-MAX_SHOCKS);

    const flashColors = {
      fireball: 'rgba(255,140,60,0.22)',
      meteor: 'rgba(255,120,50,0.28)',
      lightning: 'rgba(220,240,255,0.2)',
      frost_nova: 'rgba(180,230,255,0.18)',
      heal: 'rgba(80,220,160,0.12)',
      rally: 'rgba(240,200,80,0.14)',
    };
    const flashLife = Math.max(6, Math.round(10 + mult * 4));
    screenFlashes.push({
      color: flashColors[type] || 'rgba(255,255,255,0.12)',
      life: flashLife,
      maxLife: flashLife,
    });
    if (screenFlashes.length > MAX_FLASHES) screenFlashes = screenFlashes.slice(-MAX_FLASHES);

    if (type === 'fireball' || type === 'meteor') {
      spawnDebris(x, y, Math.round(10 * mult), ['#ff6020', '#ff9040', '#4a2820', '#ffe080']);
      if (typeof Particles !== 'undefined') {
        Particles.strikeFire?.(x, y, mult);
        if (mult >= 1.2) Particles.explosion(x, y);
      }
    } else if (type === 'lightning') {
      spawnDebris(x, y, Math.round(6 * mult), ['#e0f0ff', '#a0c0ff', '#6080c0']);
      Particles?.strikeLightning?.(x, y, mult);
    } else if (type === 'frost_nova') {
      spawnDebris(x, y, Math.round(8 * mult), ['#d0f0ff', '#a0d8ff', '#ffffff']);
      Particles?.strikeFrost?.(x, y, mult);
    } else if (type === 'heal') {
      Particles?.strikeHeal?.(x, y);
    }
  }

  function purgeLife(list, tickFn) {
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (tickFn(item)) list[w++] = item;
    }
    list.length = w;
  }

  function update() {
    purgeLife(strikes, (s) => {
      s.life--;
      return s.life > 0;
    });
    purgeLife(shockwaves, (s) => {
      s.life--;
      return s.life > 0;
    });
    purgeLife(screenFlashes, (s) => {
      s.life--;
      return s.life > 0;
    });
    purgeLife(debris, (d) => {
      d.life--;
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.12;
      return d.life > 0;
    });
  }

  function drawFireball(ctx, s, prog) {
    const { x, y, radius } = s;
    if (prog < 0.32) {
      const t = prog / 0.32;
      const fy = y - 90 * (1 - t);
      const r = 5 + t * 9;
      const g = ctx.createRadialGradient(x, fy, 0, x, fy, r);
      g.addColorStop(0, '#fff8c0');
      g.addColorStop(0.35, '#ff9040');
      g.addColorStop(1, '#c02010');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, fy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,80,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, fy + r);
      ctx.quadraticCurveTo(x, fy + r * 2.2, x + r * 0.5, fy + r);
      ctx.stroke();
    } else {
      const t = (prog - 0.32) / 0.68;
      const r = radius * (0.15 + t * 0.95);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,240,160,${0.9 * (1 - t * 0.5)})`);
      g.addColorStop(0.4, `rgba(255,100,30,${0.75 * (1 - t * 0.3)})`);
      g.addColorStop(1, 'rgba(180,30,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,160,60,${0.8 * (1 - t)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      if (t < 0.2) {
        ctx.fillStyle = `rgba(255,255,220,${0.7 * (1 - t / 0.2)})`;
        ctx.beginPath();
        ctx.arc(x, y, 12 + t * 40, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(60,20,10,${0.35 * (1 - t)})`;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, r * 0.55, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLightning(ctx, s, prog) {
    const { x, y, radius } = s;
    const flash = prog < 0.15 ? 1 : Math.max(0, 1 - (prog - 0.15) * 2.5);
    if (flash > 0.05) {
      ctx.strokeStyle = `rgba(255,240,120,${flash})`;
      ctx.lineWidth = 2 + flash * 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      let cx = x,
        cy = 0;
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        cy += y / segs;
        cx += (Math.sin(s.seed + i * 2.1) * 0.5 + 0.5) * radius * 0.35 - radius * 0.175;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${flash * 0.9})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const ring = Math.min(1, prog * 2.5) * radius * 0.55;
    ctx.strokeStyle = `rgba(200,220,255,${0.7 * (1 - prog)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,200,${0.35 * (1 - prog)})`;
    ctx.beginPath();
    ctx.arc(x, y, ring * 0.35, 0, Math.PI * 2);
    ctx.fill();
    if (flash > 0.2) {
      for (let b = 0; b < 4; b++) {
        const bx = x + Math.sin(s.seed + b * 1.7) * radius * 0.4;
        const by = y + Math.cos(s.seed + b * 2.3) * radius * 0.25;
        ctx.strokeStyle = `rgba(200,230,255,${flash * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        let cx = x,
          cy = y - 8;
        for (let i = 0; i < 4; i++) {
          cy += 12;
          cx += Math.sin(s.seed + b + i) * 10;
          ctx.lineTo(cx, cy);
        }
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(220,240,255,${flash * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHeal(ctx, s, prog) {
    const { x, y, radius } = s;
    const pulse = 0.5 + Math.sin(prog * Math.PI * 4) * 0.5;
    ctx.strokeStyle = `rgba(64,224,160,${0.35 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(x, y, radius * (0.55 + prog * 0.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + s.seed;
      const dist = radius * (0.2 + ((i * 0.17 + prog) % 1) * 0.75);
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * dist - prog * 18;
      ctx.fillStyle = `rgba(100,255,180,${0.5 * (1 - ((i * 0.17 + prog) % 1))})`;
      ctx.fillRect(px - 1, py, 2, 5);
    }
    ctx.fillStyle = '#40e0a0';
    ctx.fillRect(x - 8, y - 2, 16, 4);
    ctx.fillRect(x - 2, y - 8, 4, 16);
  }

  function drawReinforce(ctx, s, prog) {
    const { x, y } = s;
    const gateW = 36 + prog * 12;
    const gateH = 28;
    ctx.fillStyle = `rgba(96,112,160,${0.5 + prog * 0.3})`;
    ctx.fillRect(x - gateW / 2, y - gateH, gateW, gateH);
    ctx.strokeStyle = '#e0c060';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - gateW / 2, y - gateH, gateW, gateH);
    for (let i = 0; i < 3; i++) {
      const t = Math.max(0, Math.min(1, (prog - i * 0.12) * 2.5));
      if (t <= 0) continue;
      const sx = x - 16 + i * 16;
      const sy = y - 6 - t * 8;
      ctx.fillStyle = '#6070a0';
      ctx.fillRect(sx - 4, sy - 10, 8, 10);
      ctx.fillStyle = '#c0a060';
      ctx.beginPath();
      ctx.arc(sx, sy - 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,220,120,${0.4 * (1 - prog)})`;
    ctx.beginPath();
    ctx.arc(x, y - gateH / 2, 8 + prog * 20, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRally(ctx, s, prog) {
    const { x, y, radius } = s;
    for (let ring = 0; ring < 3; ring++) {
      const t = Math.max(0, prog - ring * 0.12);
      if (t <= 0) continue;
      const r = radius * 0.35 * t;
      ctx.strokeStyle = `rgba(240,192,64,${0.65 * (1 - t)})`;
      ctx.lineWidth = 3 - ring;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#c04040';
    ctx.fillRect(x - 2, y - 22, 4, 18);
    ctx.fillStyle = '#e8d5b0';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 20);
    ctx.lineTo(x + 14, y - 14);
    ctx.lineTo(x + 2, y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x, y - 4);
    ctx.stroke();
  }

  function drawMeteor(ctx, s, prog) {
    const { x, y, radius } = s;
    if (prog < 0.45) {
      const t = prog / 0.45;
      const mx = x + 60 * (1 - t);
      const my = y - 100 * (1 - t);
      ctx.fillStyle = '#4a3830';
      ctx.beginPath();
      ctx.ellipse(mx, my, 10, 7, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,40,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mx + 8, my - 4);
      ctx.lineTo(mx + 40, my - 30);
      ctx.stroke();
    } else {
      const t = (prog - 0.45) / 0.55;
      for (const [ox, oy, sc] of [
        [0, 0, 1],
        [0, -30, 0.65],
      ]) {
        const r = radius * sc * (0.2 + t * 0.9);
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, `rgba(255,200,100,${0.85 * (1 - t * 0.4)})`);
        g.addColorStop(0.5, `rgba(255,80,20,${0.6 * (1 - t * 0.3)})`);
        g.addColorStop(1, 'rgba(80,20,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawFrostNova(ctx, s, prog) {
    const { x, y, radius } = s;
    const r = radius * prog;
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(200,240,255,0.55)');
    g.addColorStop(0.6, 'rgba(120,200,255,0.25)');
    g.addColorStop(1, 'rgba(80,140,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(220,245,255,${0.85 * (1 - prog * 0.5)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + s.seed * 0.01;
      const ix = x + Math.cos(ang) * r * 0.92;
      const iy = y + Math.sin(ang) * r * 0.92;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r * 0.55, y + Math.sin(ang) * r * 0.55);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      ctx.fillStyle = '#d0f0ff';
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix + Math.cos(ang + 0.4) * 8, iy + Math.sin(ang + 0.4) * 8);
      ctx.lineTo(ix + Math.cos(ang - 0.4) * 8, iy + Math.sin(ang - 0.4) * 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawScoutFlare(ctx, s, prog) {
    const { x, y, radius } = s;
    if (prog < 0.55) {
      const t = prog / 0.55;
      const fx = x - radius * 0.3 * (1 - t);
      const fy = y + 40 * (1 - t);
      const tx = x;
      const ty = y - 50 * t;
      ctx.strokeStyle = `rgba(255,200,80,${0.9 * (1 - t * 0.3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(x, y - 20, tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#ff4040';
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const t = (prog - 0.55) / 0.45;
      const g = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, radius * 0.5);
      g.addColorStop(0, `rgba(255,240,160,${0.9 * (1 - t)})`);
      g.addColorStop(0.4, `rgba(255,200,80,${0.5 * (1 - t)})`);
      g.addColorStop(1, 'rgba(255,160,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - 30, radius * 0.5 * (0.3 + t), 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.strokeStyle = `rgba(255,220,100,${0.6 * (1 - t)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 30);
        ctx.lineTo(x + Math.cos(ang) * radius * 0.35, y - 30 + Math.sin(ang) * radius * 0.35);
        ctx.stroke();
      }
    }
  }

  function drawFortify(ctx, s, prog) {
    const { x, y, radius } = s;
    const pulse = 0.5 + Math.sin(prog * Math.PI * 3) * 0.5;
    ctx.strokeStyle = `rgba(128,176,224,${0.5 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(80,120,180,${0.12 + pulse * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a0c0e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x - 10, y + 6);
    ctx.lineTo(x + 10, y + 6);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `rgba(160,200,240,${0.25 + pulse * 0.2})`;
    ctx.fill();
  }

  function drawDispel(ctx, s, prog) {
    const { x, y, radius } = s;
    const expand = radius * (0.55 + prog * 0.55);
    const alpha = 1 - prog;
    ctx.strokeStyle = `rgba(192,144,255,${0.75 * alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, expand, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(232,208,255,${0.55 * alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, expand * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(160,100,255,${0.12 * alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, expand, 0, Math.PI * 2);
    ctx.fill();
    // Wash rays
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + prog * 2;
      ctx.strokeStyle = `rgba(220,180,255,${0.4 * alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * expand * 0.2, y + Math.sin(ang) * expand * 0.2);
      ctx.lineTo(x + Math.cos(ang) * expand * 0.95, y + Math.sin(ang) * expand * 0.95);
      ctx.stroke();
    }
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
      const r = s.radius * (0.2 + prog * 1.1);
      const alpha = (1 - prog) * 0.85;
      ctx.strokeStyle = s.color.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.lineWidth = s.width * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawDebris(ctx, bounds) {
    for (const d of debris) {
      if (bounds && (d.x < bounds.left || d.x > bounds.right || d.y < bounds.top || d.y > bounds.bottom))
        continue;
      ctx.globalAlpha = d.life / d.maxLife;
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, bounds) {
    drawShockwaves(ctx, bounds);
    for (const s of strikes) {
      if (!inBounds(s, bounds)) continue;
      const prog = 1 - s.life / s.maxLife;
      const drawer = DRAWERS[s.type];
      if (!drawer) continue;
      ctx.save();
      drawer(ctx, s, prog);
      ctx.restore();
    }
    drawDebris(ctx, bounds);
  }

  function drawScreenFx(ctx, w, h) {
    for (const f of screenFlashes) {
      const a = (f.life / f.maxLife) * 0.85;
      ctx.fillStyle = f.color.replace(/[\d.]+\)$/, `${a})`);
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawFortifyZones(ctx, zones, tick) {
    if (!zones?.length) return;
    for (const z of zones) {
      const pulse = 0.5 + Math.sin((tick + z.x) * 0.08) * 0.5;
      const fade = Math.min(1, z.timer / 90);
      ctx.save();
      ctx.globalAlpha = 0.4 + pulse * 0.15;
      ctx.strokeStyle = `rgba(100,160,220,${0.6 * fade})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(60,100,160,${0.12 * fade})`;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#90b0d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(z.x, z.y - 10);
      ctx.lineTo(z.x - 8, z.y + 5);
      ctx.lineTo(z.x + 8, z.y + 5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  function strikeColor(type) {
    const colors = {
      fireball: 'rgba(255,120,40,0.35)',
      lightning: 'rgba(200,220,255,0.35)',
      heal: 'rgba(64,224,160,0.3)',
      reinforce: 'rgba(160,180,220,0.3)',
      rally: 'rgba(240,192,64,0.3)',
      meteor: 'rgba(255,100,40,0.35)',
      frost_nova: 'rgba(160,220,255,0.35)',
      scout_flare: 'rgba(255,220,100,0.35)',
      fortify: 'rgba(100,160,220,0.3)',
      dispel: 'rgba(180,120,255,0.32)',
    };
    return colors[type] || 'rgba(255,255,255,0.25)';
  }

  function drawTargeting(ctx, type, x, y, radius, tick) {
    if (!type || x == null || y == null) return;
    const pulse = 0.85 + Math.sin(tick * 0.12) * 0.15;
    ctx.save();
    ctx.strokeStyle = strikeColor(type).replace('0.3', '0.55').replace('0.35', '0.55');
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, (radius || 50) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = strikeColor(type);
    ctx.beginPath();
    ctx.arc(x, y, (radius || 50) * pulse, 0, Math.PI * 2);
    ctx.fill();
    if (typeof SpriteGen !== 'undefined' && SpriteGen.drawAbilityIcon) {
      ctx.save();
      ctx.translate(x - 16, y - 16);
      const iconType = type === 'heal' ? 'heal_rain' : type;
      SpriteGen.drawAbilityIcon(ctx, iconType);
      ctx.restore();
    }
    ctx.restore();
  }

  function clear() {
    strikes = [];
    shockwaves = [];
    screenFlashes = [];
    debris = [];
  }

  return {
    play,
    impact,
    update,
    draw,
    drawScreenFx,
    drawTargeting,
    drawFortifyZones,
    clear,
    setFxLife,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.StrikeFX = StrikeFX;
