/**
 * Floating combat numbers and status popups.
 * Crits pop, big hits scale, motion eases for readable juice.
 */
const FloatingText = (() => {
  let texts = [];
  let MAX_TEXTS = 96;

  function setBudget(unitsOnField, qualityMult = 1, spriteLod = 0) {
    const base = unitsOnField > 80 ? 40 : unitsOnField > 50 ? 64 : 96;
    const lodMult =
      typeof SpriteLod !== 'undefined' ? SpriteLod.particleMultForLod(spriteLod) : 1;
    MAX_TEXTS = Math.max(20, Math.floor(base * Math.max(0.2, qualityMult) * lodMult));
    trim();
  }

  function trim() {
    if (texts.length <= MAX_TEXTS) return;
    texts = texts.slice(-MAX_TEXTS);
  }

  function prune(aggressive = false) {
    const fadeCut = aggressive ? 0.4 : 0.12;
    let w = 0;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (t.life > t.maxLife * fadeCut) texts[w++] = t;
    }
    texts.length = w;
    trim();
  }

  function formatAmount(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const r = Math.round(n);
    return r > 0 ? r : 1;
  }

  function pushText(entry) {
    if (texts.length >= MAX_TEXTS) texts.shift();
    texts.push(entry);
  }

  function add(x, y, text, color = '#ffe080', size = 11, opts = {}) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const label = text == null ? '' : String(text);
    if (!label) return;

    const life = opts.life || 48;
    pushText({
      x: px + (opts.jitterX != null ? opts.jitterX : (Math.random() - 0.5) * 6),
      y: py,
      text: label,
      color: color || '#ffe080',
      size: size > 0 ? size : 11,
      baseSize: size > 0 ? size : 11,
      life,
      maxLife: life,
      vy: opts.vy != null ? opts.vy : -0.75 - Math.random() * 0.35,
      vx: opts.vx != null ? opts.vx : (Math.random() - 0.5) * 0.9,
      pop: opts.pop || 0,
      crit: !!opts.crit,
      outline: opts.outline || '#1a1010',
    });
  }

  function damage(x, y, amount, crit = false) {
    const shown = formatAmount(amount);
    if (shown <= 0) return;

    const big = shown >= 40;
    const huge = shown >= 80;
    const size = crit ? 16 : huge ? 14 : big ? 12 : 11;
    const color = crit ? '#ff3a3a' : huge ? '#ff8040' : big ? '#ffb060' : '#ffc878';
    const life = crit ? 58 : big ? 52 : 46;

    add(x, y - 8, crit ? `-${shown}!` : `-${shown}`, color, size, {
      crit,
      pop: crit ? 1.55 : huge ? 1.25 : big ? 1.1 : 0.85,
      life,
      vy: crit ? -1.05 : -0.8,
      outline: crit ? '#3a0808' : '#1a1010',
    });

    if (crit) {
      add(x, y - 20, 'CRIT', '#ffd0a0', 9, {
        life: 36,
        pop: 1.1,
        vy: -0.45,
        vx: (Math.random() - 0.5) * 0.4,
      });
    }
  }

  function heal(x, y, amount) {
    const shown = formatAmount(amount);
    if (shown <= 0) return;
    const big = shown >= 30;
    add(x, y - 8, `+${shown}`, big ? '#40f0b0' : '#60e0a0', big ? 13 : 11, {
      pop: big ? 1.15 : 0.9,
      vy: -0.7,
      life: 50,
    });
  }

  function status(x, y, text, color = '#c0b0ff') {
    if (text == null || text === '') return;
    add(x, y - 12, text, color, 10, {
      pop: 0.7,
      life: 42,
      vy: -0.55,
      vx: (Math.random() - 0.5) * 0.5,
    });
  }

  function update() {
    let w = 0;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      t.life--;
      t.x += t.vx;
      t.y += t.vy;
      // Ease upward drift then settle
      t.vy *= 0.975;
      t.vx *= 0.985;
      // Pop scale decays toward 1
      if (t.pop > 0) t.pop *= 0.88;
      if (t.life > 0) texts[w++] = t;
    }
    texts.length = w;
    if (texts.length > MAX_TEXTS * 0.85) prune(false);
    else trim();
  }

  function draw(ctx, bounds) {
    if (!ctx || !texts.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (
        bounds &&
        (t.x < bounds.left || t.x > bounds.right || t.y < bounds.top || t.y > bounds.bottom)
      ) {
        continue;
      }
      const progress = t.maxLife > 0 ? t.life / t.maxLife : 0;
      // Hold opacity longer, then fade
      const a = progress > 0.35 ? 1 : Math.max(0, progress / 0.35);
      if (a <= 0) continue;

      const popBoost = 1 + (t.pop || 0) * 0.55;
      const size = Math.max(8, (t.baseSize || t.size) * popBoost);
      ctx.globalAlpha = a;
      ctx.font = `bold ${size.toFixed(1)}px Cinzel`;

      if (t.crit) {
        ctx.shadowColor = 'rgba(255,60,40,0.65)';
        ctx.shadowBlur = 8 * (t.pop || 0.5);
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = t.outline || '#1a1010';
      ctx.fillText(t.text, t.x + 1.2, t.y + 1.2);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);

      if (t.crit && progress > 0.7) {
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.text, t.x, t.y);
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function clear() {
    texts = [];
  }

  function getCount() {
    return texts.length;
  }

  return { add, damage, heal, status, update, draw, clear, setBudget, prune, trim, getCount };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FloatingText = FloatingText;
