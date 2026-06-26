/**
 * Combat visual effects — slashes, muzzle flashes, spell bursts, trails.
 */
const CombatFX = (() => {
  let effects = [];

  function add(effect) {
    effects.push({ ...effect, life: effect.life || 20, maxLife: effect.life || 20 });
  }

  function meleeSlash(x, y, rotation, color = '#e8e8f0') {
    add({ type: 'slash', x, y, rotation, color, life: 12, scale: 1 });
  }

  function muzzleFlash(x, y, rotation, color = '#ffe080') {
    add({ type: 'muzzle', x, y, rotation, color, life: 8, scale: 1 });
  }

  function spellCast(x, y, color = '#a080ff') {
    add({ type: 'cast', x, y, color, life: 18, scale: 1 });
  }

  function arrowLoose(x, y, rotation) {
    add({ type: 'arrow_loose', x, y, rotation, life: 10 });
  }

  function hitSpark(x, y) {
    add({ type: 'spark', x, y, life: 14 });
  }

  function healPulse(x, y) {
    add({ type: 'heal_pulse', x, y, life: 24 });
  }

  function update() {
    effects = effects.filter(e => {
      e.life--;
      if (e.type === 'slash') e.scale = 1 + (1 - e.life / e.maxLife) * 0.6;
      return e.life > 0;
    });
  }

  function draw(ctx, bounds) {
    for (const e of effects) {
      if (bounds && (e.x < bounds.left || e.x > bounds.right || e.y < bounds.top || e.y > bounds.bottom)) continue;
      const a = e.life / e.maxLife;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(e.x, e.y);

      if (e.type === 'slash') {
        ctx.rotate((e.rotation + 90) * Math.PI / 180);
        const grad = ctx.createLinearGradient(0, -20, 0, 10);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.5, e.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 14 * e.scale, -0.8, 0.8);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      } else if (e.type === 'muzzle') {
        ctx.rotate((e.rotation + 90) * Math.PI / 180);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(-6, -4);
        ctx.lineTo(6, -4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,200,0.6)';
        ctx.beginPath();
        ctx.arc(0, -8, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'cast') {
        const r = 12 + (1 - a) * 10;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = e.color + '44';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + (1 - a) * 2;
          ctx.fillStyle = '#ffe080';
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.type === 'arrow_loose') {
        ctx.rotate((e.rotation + 90) * Math.PI / 180);
        ctx.strokeStyle = '#8a6030';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -14);
        ctx.stroke();
      } else if (e.type === 'spark') {
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          ctx.strokeStyle = i % 2 ? '#ffe080' : '#ff8040';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * 10 * a, Math.sin(ang) * 10 * a);
          ctx.stroke();
        }
      } else if (e.type === 'heal_pulse') {
        ctx.strokeStyle = '#40e0a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8 + (1 - a) * 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function clear() {
    effects = [];
  }

  return { add, meleeSlash, muzzleFlash, spellCast, arrowLoose, hitSpark, healPulse, update, draw, clear };
})();