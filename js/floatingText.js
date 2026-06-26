/**
 * Floating combat numbers and status popups.
 */
const FloatingText = (() => {
  let texts = [];

  function add(x, y, text, color = '#ffe080', size = 11) {
    texts.push({
      x, y, text, color, size,
      life: 45, maxLife: 45,
      vy: -0.6 - Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.8,
    });
  }

  function damage(x, y, amount, crit = false) {
    add(x, y - 8, `-${Math.round(amount)}`, crit ? '#ff4040' : '#ffb060', crit ? 13 : 11);
  }

  function heal(x, y, amount) {
    add(x, y - 8, `+${Math.round(amount)}`, '#60e0a0', 11);
  }

  function status(x, y, text, color = '#c0b0ff') {
    add(x, y - 12, text, color, 10);
  }

  function update() {
    texts = texts.filter(t => {
      t.life--;
      t.x += t.vx;
      t.y += t.vy;
      t.vy *= 0.98;
      return t.life > 0;
    });
  }

  function draw(ctx, bounds) {
    for (const t of texts) {
      if (bounds && (t.x < bounds.left || t.x > bounds.right || t.y < bounds.top || t.y > bounds.bottom)) continue;
      const a = t.life / t.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#1a1010';
      ctx.font = `bold ${t.size}px Cinzel`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }

  function clear() { texts = []; }

  return { add, damage, heal, status, update, draw, clear };
})();