/**
 * Tactical strike sprites and battlefield animations.
 */
const StrikeFX = (() => {
  const MAX_STRIKES = 24;
  let strikes = [];

  const LIFE = {
    fireball: 48,
    lightning: 32,
    heal: 55,
    reinforce: 50,
    rally: 65,
    meteor: 58,
    frost_nova: 46,
    scout_flare: 42,
    fortify: 40,
  };

  function inBounds(s, b) {
    if (!b) return true;
    const pad = s.radius || 60;
    return s.x + pad >= b.left && s.x - pad <= b.right &&
      s.y + pad >= b.top && s.y - pad <= b.bottom;
  }

  function play(type, x, y, radius = 50, opts = {}) {
    const life = opts.life || LIFE[type] || 40;
    strikes.push({
      type, x, y,
      radius: radius || 50,
      life,
      maxLife: life,
      seed: Math.random() * 1000,
      ...opts,
    });
    if (strikes.length > MAX_STRIKES) strikes = strikes.slice(-MAX_STRIKES);
  }

  function update() {
    strikes = strikes.filter(s => {
      s.life--;
      return s.life > 0;
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
      let cx = x, cy = 0;
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
      for (const [ox, oy, sc] of [[0, 0, 1], [0, -30, 0.65]]) {
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
  };

  function draw(ctx, bounds) {
    for (const s of strikes) {
      if (!inBounds(s, bounds)) continue;
      const prog = 1 - s.life / s.maxLife;
      const drawer = DRAWERS[s.type];
      if (!drawer) continue;
      ctx.save();
      drawer(ctx, s, prog);
      ctx.restore();
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
  }

  return { play, update, draw, drawTargeting, drawFortifyZones, clear };
})();