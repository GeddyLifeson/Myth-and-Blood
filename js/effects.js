/**
 * Combat visual effects — slashes, muzzle flashes, spell bursts, impacts, crits.
 * Tuned for readable, punchy battlefield feedback at all army sizes.
 */
const CombatFX = (() => {
  let effects = [];
  const pool = [];
  const POOL_MAX = 160;
  let hitStopFrames = 0;
  let flashOverlay = { a: 0, color: '#ffffff' };

  function acquire() {
    return pool.pop() || {};
  }

  function release(e) {
    if (pool.length < POOL_MAX) pool.push(e);
  }

  function add(effect) {
    const e = acquire();
    e.type = effect.type;
    e.x = effect.x;
    e.y = effect.y;
    e.rotation = effect.rotation ?? 0;
    e.color = effect.color;
    e.scale = effect.scale ?? 1;
    e.life = effect.life || 20;
    e.maxLife = e.life;
    e.vx = effect.vx || 0;
    e.vy = effect.vy || 0;
    e.extra = effect.extra || 0;
    effects.push(e);
  }

  function meleeSlash(x, y, rotation, color = '#e8e8f0') {
    add({ type: 'slash', x, y, rotation, color, life: 14, scale: 1 });
  }

  function muzzleFlash(x, y, rotation, color = '#ffe080') {
    add({ type: 'muzzle', x, y, rotation, color, life: 9, scale: 1 });
  }

  function spellCast(x, y, color = '#a080ff') {
    add({ type: 'cast', x, y, color, life: 20, scale: 1 });
  }

  function arrowLoose(x, y, rotation) {
    add({ type: 'arrow_loose', x, y, rotation, life: 11 });
  }

  function hitSpark(x, y, opts = {}) {
    const scale = opts.scale || 1;
    add({ type: 'spark', x, y, life: 12 + Math.round(scale * 4), scale, color: opts.color });
    if (scale >= 1.2) {
      add({ type: 'impact_ring', x, y, life: 10, scale, color: opts.color || '#ffb060' });
    }
  }

  /** Full impact package for a damage event — spark, ring, optional crit burst. */
  function impact(x, y, opts = {}) {
    const dmg = Math.max(0, Number(opts.damage) || 0);
    const crit = !!opts.crit;
    const kill = !!opts.kill;
    const scale = crit ? 1.55 : kill ? 1.35 : Math.min(1.8, 0.7 + dmg / 40);
    const color = crit ? '#ff5050' : kill ? '#ffd060' : opts.color || '#ffb060';

    hitSpark(x, y, { scale, color });
    add({
      type: 'impact_flash',
      x,
      y,
      life: crit ? 10 : 7,
      scale: scale * (crit ? 1.3 : 1),
      color: crit ? '#ff8080' : '#ffe8c0',
    });

    const allowStop =
      typeof GameFeedback === 'undefined' || GameFeedback.allowHitStop?.() !== false;
    if (crit) {
      add({ type: 'crit_burst', x, y, life: 16, scale: 1.4, color: '#ff4040' });
      add({ type: 'impact_ring', x, y, life: 14, scale: 1.6, color: '#ff6060' });
      if (allowStop) requestHitStop(2);
      flashScreen(0.18, '#ff4040');
    } else if (kill) {
      add({ type: 'kill_burst', x, y, life: 18, scale: 1.2, color: '#ffd080' });
      add({ type: 'impact_ring', x, y, life: 12, scale: 1.3, color: '#ffe080' });
      if (allowStop) requestHitStop(1);
    } else if (dmg >= 30) {
      add({ type: 'impact_ring', x, y, life: 10, scale: 1.1, color });
    }
  }

  function healPulse(x, y) {
    add({ type: 'heal_pulse', x, y, life: 26 });
  }

  function requestHitStop(frames = 1) {
    hitStopFrames = Math.max(hitStopFrames, Math.min(4, frames | 0));
  }

  function consumeHitStop() {
    if (hitStopFrames <= 0) return false;
    hitStopFrames--;
    return true;
  }

  function getHitStopFrames() {
    return hitStopFrames;
  }

  function flashScreen(alpha = 0.15, color = '#ffffff') {
    flashOverlay.a = Math.max(flashOverlay.a, Math.min(0.45, alpha));
    flashOverlay.color = color || '#ffffff';
  }

  function update() {
    if (flashOverlay.a > 0.001) {
      flashOverlay.a *= 0.72;
      if (flashOverlay.a < 0.01) flashOverlay.a = 0;
    }

    let w = 0;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      e.life--;
      e.x += e.vx || 0;
      e.y += e.vy || 0;
      if (e.type === 'slash') e.scale = 1 + (1 - e.life / e.maxLife) * 0.75;
      if (e.type === 'impact_ring' || e.type === 'kill_burst') {
        e.scale = (e.scale || 1) * 1.06;
      }
      if (e.life > 0) {
        effects[w++] = e;
      } else {
        release(e);
      }
    }
    effects.length = w;
  }

  function draw(ctx, bounds) {
    for (const e of effects) {
      if (
        bounds &&
        (e.x < bounds.left || e.x > bounds.right || e.y < bounds.top || e.y > bounds.bottom)
      )
        continue;
      const a = e.maxLife > 0 ? e.life / e.maxLife : 0;
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(e.x, e.y);

      if (e.type === 'slash') {
        ctx.rotate(((e.rotation + 90) * Math.PI) / 180);
        const grad = ctx.createLinearGradient(0, -22, 0, 12);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.45, e.color || '#e8e8f0');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 16 * e.scale, -0.95, 0.95);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(0, 0, 14 * e.scale, -0.7, 0.7);
        ctx.stroke();
      } else if (e.type === 'muzzle') {
        ctx.rotate(((e.rotation + 90) * Math.PI) / 180);
        ctx.fillStyle = e.color || '#ffe080';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-7, -4);
        ctx.lineTo(7, -4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,200,0.7)';
        ctx.beginPath();
        ctx.arc(0, -8, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'cast') {
        const r = 12 + (1 - a) * 12;
        ctx.strokeStyle = e.color || '#a080ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = (e.color || '#a080ff') + '44';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + (1 - a) * 2.2;
          ctx.fillStyle = '#ffe080';
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.type === 'arrow_loose') {
        ctx.rotate(((e.rotation + 90) * Math.PI) / 180);
        ctx.strokeStyle = '#8a6030';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -16);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,240,180,0.55)';
        ctx.beginPath();
        ctx.arc(0, -6, 4 * a, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'spark') {
        const sc = e.scale || 1;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + a * 0.4;
          const len = (8 + sc * 6) * a;
          ctx.strokeStyle = i % 2 ? e.color || '#ffe080' : '#ff9040';
          ctx.lineWidth = 1.5 + sc * 0.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * 2, Math.sin(ang) * 2);
          ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,240,200,${0.55 * a})`;
        ctx.beginPath();
        ctx.arc(0, 0, 3 * sc * a, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'impact_flash') {
        const r = 6 * (e.scale || 1) * (0.6 + (1 - a) * 0.8);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * a})`);
        g.addColorStop(0.35, `rgba(255,232,192,${0.55 * a})`);
        g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'impact_ring') {
        const r = 8 * (e.scale || 1) + (1 - a) * 18;
        ctx.strokeStyle = e.color || '#ffb060';
        ctx.lineWidth = 2.2 * a + 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'crit_burst') {
        const r = 10 + (1 - a) * 22;
        ctx.strokeStyle = '#ff4040';
        ctx.lineWidth = 3 * a;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,200,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const len = r * 0.9;
          ctx.strokeStyle = i % 2 ? '#ff6060' : '#ffe080';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * 4, Math.sin(ang) * 4);
          ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
          ctx.stroke();
        }
      } else if (e.type === 'kill_burst') {
        const r = 12 + (1 - a) * 28;
        ctx.strokeStyle = e.color || '#ffd080';
        ctx.lineWidth = 2.5 * a;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,220,120,${0.2 * a})`;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'heal_pulse') {
        ctx.strokeStyle = '#40e0a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8 + (1 - a) * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(64,224,160,${0.18 * a})`;
        ctx.beginPath();
        ctx.arc(0, 0, 6 + (1 - a) * 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /** Full-screen flash (crits / boss hits) drawn in screen space after camera. */
  function drawScreenFlash(ctx, w, h) {
    if (!ctx || flashOverlay.a < 0.01) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = flashOverlay.a;
    ctx.fillStyle = flashOverlay.color || '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function clear() {
    for (let i = 0; i < effects.length; i++) release(effects[i]);
    effects.length = 0;
    hitStopFrames = 0;
    flashOverlay.a = 0;
  }

  return {
    add,
    meleeSlash,
    muzzleFlash,
    spellCast,
    arrowLoose,
    hitSpark,
    impact,
    healPulse,
    requestHitStop,
    consumeHitStop,
    getHitStopFrames,
    flashScreen,
    update,
    draw,
    drawScreenFlash,
    clear,
  };
})();
