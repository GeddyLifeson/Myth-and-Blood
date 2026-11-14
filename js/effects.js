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
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const BLOOD_HI = '#c8141c';
  const FLASH_CAP = 0.22;

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

  /**
   * Impact package for a damage event: spark, ring, crit or kill burst.
   * Hit-stop is kept for blows that matter (a crit; a heavy kill) and is rationed, so a big
   * fight never turns into a stutter. A crit tints the screen only faintly.
   */
  function impact(x, y, opts = {}) {
    const dmg = Math.max(0, Number(opts.damage) || 0);
    const crit = !!opts.crit;
    const kill = !!opts.kill;
    const scale = crit ? 1.55 : kill ? 1.35 : Math.min(1.8, 0.7 + dmg / 40);
    const color = crit ? BLOOD_HI : kill ? BONE : opts.color || '#f0a850';

    hitSpark(x, y, { scale, color });
    add({
      type: 'impact_flash',
      x,
      y,
      life: crit ? 8 : 5,
      scale: scale * (crit ? 1.3 : 1),
      color: BONE,
    });

    const allowStop =
      typeof GameFeedback === 'undefined' || GameFeedback.allowHitStop?.() !== false;
    if (crit) {
      add({ type: 'crit_burst', x, y, life: 14, scale: 1.4, color: BLOOD_HI });
      if (allowStop) requestHitStop(dmg >= 80 ? 2 : 1);
      flashScreen(0.08, BLOOD);
    } else if (kill) {
      add({ type: 'kill_burst', x, y, life: 14, scale: 1.2, color: BONE });
      if (allowStop && dmg >= 60) requestHitStop(1);
    } else if (dmg >= 30) {
      add({ type: 'impact_ring', x, y, life: 10, scale: 1.1, color });
    }
  }

  function healPulse(x, y) {
    add({ type: 'heal_pulse', x, y, life: 26 });
  }

  // Hit-stop ration: at most HITSTOP_BUDGET frozen frames in any HITSTOP_WINDOW ticks.
  const HITSTOP_BUDGET = 3;
  const HITSTOP_WINDOW = 45;
  let hitStopSpent = 0;
  let hitStopCool = 0;

  function requestHitStop(frames = 1) {
    const want = Math.min(2, frames | 0);
    const room = HITSTOP_BUDGET - hitStopSpent - hitStopFrames;
    if (room <= 0) return;
    hitStopFrames = Math.max(hitStopFrames, Math.min(want, room));
  }

  function consumeHitStop() {
    if (hitStopFrames <= 0) return false;
    hitStopFrames--;
    hitStopSpent++;
    hitStopCool = HITSTOP_WINDOW;
    return true;
  }

  /** Brief screen tint. Never above FLASH_CAP, and not at all under reduced motion. */
  function flashScreen(alpha = 0.1, color = BONE) {
    if (typeof Settings !== 'undefined' && Settings.get?.('reducedMotion')) return;
    flashOverlay.a = Math.max(flashOverlay.a, Math.min(FLASH_CAP, alpha));
    flashOverlay.color = color || BONE;
  }

  function update() {
    if (hitStopCool > 0 && --hitStopCool === 0) hitStopSpent = 0;
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

  /** An ink line with a colour laid over it. The path must already be built. */
  function inkStroke(ctx, color, width) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function rays(ctx, n, r0, r1, turn) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + turn;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      ctx.moveTo(c * r0, s * r0);
      ctx.lineTo(c * r1, s * r1);
    }
  }

  // Flat ink shapes throughout: no gradients are built per frame.
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
      ctx.translate(e.x, e.y);
      ctx.lineCap = 'round';

      if (e.type === 'slash') {
        // A brush-stroke crescent: thick in the middle of the swing, gone by the end.
        ctx.rotate(((e.rotation + 90) * Math.PI) / 180);
        const sweep = 0.95 * Math.min(1, (1 - a) * 2.4 + 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, 16 * e.scale, -sweep, sweep);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5.5 * a + 1;
        ctx.stroke();
        ctx.strokeStyle = e.color || BONE;
        ctx.lineWidth = 2.6 * a + 0.4;
        ctx.stroke();
      } else if (e.type === 'muzzle') {
        ctx.rotate(((e.rotation + 90) * Math.PI) / 180);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(-8, -3);
        ctx.lineTo(8, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = e.color || '#f0a850';
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(-5, -5);
        ctx.lineTo(5, -5);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'cast') {
        const r = 9 + (1 - a) * 9;
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        inkStroke(ctx, e.color || '#8a5cc0', 1.6);
        rays(ctx, 6, r + 2, r + 5 + (1 - a) * 4, (1 - a) * 2.2);
        inkStroke(ctx, BONE, 1.2);
      } else if (e.type === 'arrow_loose') {
        // The string snaps forward: two short ink ticks off the bow.
        ctx.rotate(((e.rotation + 90) * Math.PI) / 180);
        ctx.globalAlpha = a;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-5, -4 - (1 - a) * 6);
        ctx.lineTo(-2, -9 - (1 - a) * 6);
        ctx.moveTo(5, -4 - (1 - a) * 6);
        ctx.lineTo(2, -9 - (1 - a) * 6);
        ctx.stroke();
      } else if (e.type === 'spark') {
        const sc = e.scale || 1;
        const len = (6 + sc * 5) * (0.4 + (1 - a) * 0.8);
        rays(ctx, 5, len * 0.45, len, e.x * 0.37 + e.y * 0.61);
        ctx.globalAlpha = Math.min(1, a * 2);
        inkStroke(ctx, e.color || '#f0a850', 1 + sc * 0.5);
      } else if (e.type === 'impact_flash') {
        const r = 3.2 * (e.scale || 1) * (0.6 + (1 - a) * 0.6);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(0, 0, r + 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = e.color || BONE;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'impact_ring') {
        const r = 7 * (e.scale || 1) + (1 - a) * 12;
        ctx.globalAlpha = Math.min(1, a * 1.8);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        inkStroke(ctx, e.color || '#f0a850', 1.4 * a + 0.4);
      } else if (e.type === 'crit_burst') {
        // A jagged ink star with a blood core.
        const r = 9 + (1 - a) * 12;
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2 + e.x * 0.1;
          const rr = i % 2 ? r * 0.45 : r;
          if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
          else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fillStyle = INK;
        ctx.fill();
        ctx.strokeStyle = BLOOD_HI;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else if (e.type === 'kill_burst') {
        const r = 10 + (1 - a) * 16;
        ctx.globalAlpha = Math.min(1, a * 1.8);
        rays(ctx, 8, r * 0.6, r, 0.4);
        inkStroke(ctx, e.color || BONE, 1.5);
      } else if (e.type === 'heal_pulse') {
        const r = 7 + (1 - a) * 12;
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        inkStroke(ctx, '#7fd49a', 1.4);
        // Bone cross rising out of the ring.
        const cy = -4 - (1 - a) * 8;
        ctx.beginPath();
        ctx.moveTo(0, cy - 4);
        ctx.lineTo(0, cy + 4);
        ctx.moveTo(-3, cy - 1);
        ctx.lineTo(3, cy - 1);
        inkStroke(ctx, BONE, 1.6);
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
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
    hitStopSpent = 0;
    hitStopCool = 0;
  }

  return {
    add,
    meleeSlash,
    spellCast,
    arrowLoose,
    hitSpark,
    impact,
    healPulse,
    requestHitStop,
    consumeHitStop,
    update,
    draw,
    flashScreen,
    drawScreenFlash,
    clear,
  };
})();
