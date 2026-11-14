/**
 * Floating combat text: damage, crits, heals, TP, rank-ups, misses and status words.
 *
 * One inked type style for all of it (bold face, black edge, flat fill). Text keeps the same
 * size on screen whatever the zoom, new text is pushed clear of text already there, repeated
 * words merge ("RALLY! x12", "+3 TP"), a unit shows at most a few numbers a second (the rest
 * are added into its last number), and a Sapper's blast shows one summed number.
 */
const FloatingText = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const STYLE = {
    dmg: { color: '#f0d9a0', size: 13, life: 44 },
    big: { color: '#f0a850', size: 15, life: 50 },
    crit: { color: '#e0362c', size: 19, life: 58 },
    heal: { color: '#7fd49a', size: 13, life: 48 },
    tp: { color: '#e6b84a', size: 13, life: 52 },
    rank: { color: '#f0d080', size: 15, life: 64 },
    miss: { color: '#9a938a', size: 11, life: 34 },
    status: { color: BONE, size: 12, life: 44 },
    blast: { color: '#f08a3a', size: 20, life: 66 },
  };
  const FACE = 'Cinzel, Georgia, serif';

  let texts = [];
  let MAX_TEXTS = 96;
  let clock = 0;

  // Per unit (or per patch of ground when no unit is given): how many texts this second.
  const PER_UNIT_PER_SECOND = 3;
  const SECOND = 60;
  const recent = new Map();

  // A Sapper's blast: every wound it deals in one tick is collected here.
  let blast = null;

  function setBudget(unitsOnField, qualityMult = 1, spriteLod = 0) {
    const base = unitsOnField > 80 ? 40 : unitsOnField > 50 ? 64 : 96;
    const lodMult = typeof SpriteLod !== 'undefined' ? SpriteLod.particleMultForLod(spriteLod) : 1;
    MAX_TEXTS = Math.max(20, Math.floor(base * Math.max(0.2, qualityMult) * lodMult));
    trim();
  }

  function trim() {
    if (texts.length <= MAX_TEXTS) return;
    texts.splice(0, texts.length - MAX_TEXTS);
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

  function reducedMotion() {
    return typeof Settings !== 'undefined' && !!Settings.get?.('reducedMotion');
  }

  function formatAmount(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const r = Math.round(n);
    return r > 0 ? r : 1;
  }

  /** Has this unit (or this patch of ground) had its share of text for the second? */
  function overCap(key) {
    let r = recent.get(key);
    if (!r || clock - r.start >= SECOND) {
      if (!r) {
        r = { start: clock, n: 0 };
        recent.set(key, r);
      } else {
        r.start = clock;
        r.n = 0;
      }
    }
    r.n++;
    return r.n > PER_UNIT_PER_SECOND;
  }

  function keyFor(unit, x, y) {
    if (unit && unit.id != null) return unit.id;
    return `g${Math.round(x / 18)},${Math.round(y / 18)}`;
  }

  /** Move a new text up until it is clear of the ones already rising there. */
  function stagger(x, y, size) {
    const w = size * 2.4;
    const h = size * 0.95;
    let py = y;
    for (let tries = 0; tries < 5; tries++) {
      let hit = false;
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        if (Math.abs(t.x - x) < w && Math.abs(t.y - py) < h) {
          hit = true;
          break;
        }
      }
      if (!hit) break;
      py -= h;
    }
    return py;
  }

  function push(kind, x, y, text, opts = {}) {
    const st = STYLE[kind] || STYLE.status;
    const calm = reducedMotion();
    const size = opts.size || st.size;
    const life = opts.life || st.life;
    const entry = {
      kind,
      x: x + (opts.still ? 0 : (Math.random() - 0.5) * 4),
      y: stagger(x, y, size),
      text,
      base: opts.base || text,
      amount: opts.amount || 0,
      count: 1,
      color: opts.color || st.color,
      size,
      life,
      maxLife: life,
      vy: calm ? -0.3 : kind === 'crit' || kind === 'blast' ? -0.85 : -0.62,
      pop: calm ? 0 : kind === 'crit' || kind === 'blast' ? 1 : kind === 'miss' ? 0 : 0.55,
      key: opts.key == null ? null : opts.key,
    };
    if (texts.length >= MAX_TEXTS) texts.shift();
    texts.push(entry);
    return entry;
  }

  function refresh(t, pop = 0.6) {
    t.life = Math.max(t.life, Math.round(t.maxLife * 0.8));
    if (!reducedMotion()) t.pop = Math.max(t.pop, pop);
  }

  /** Generic entry point kept for callers that set their own colour and size. */
  function add(x, y, text, color = BONE, size = 12, opts = {}) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const label = text == null ? '' : String(text);
    if (!label) return;
    push(opts.crit ? 'crit' : 'status', px, py, label, {
      color: color || BONE,
      size: size > 0 ? size : 12,
      life: opts.life,
    });
  }

  function lastOf(key, kindA, kindB) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (t.key === key && (t.kind === kindA || t.kind === kindB)) return t;
    }
    return null;
  }

  /**
   * A wound. `unit` (optional) keys the per-unit cap; `opts.demolition` marks a Sapper's
   * blast, whose wounds are summed into one number for the whole blast.
   */
  function damage(x, y, amount, crit = false, unit = null, opts = null) {
    const shown = formatAmount(amount);
    if (shown <= 0) return;
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;

    if (opts && opts.demolition) {
      if (!blast) blast = { sum: 0, n: 0, x: 0, y: 0 };
      blast.sum += shown;
      blast.n++;
      blast.x += px;
      blast.y += py;
      return;
    }

    const key = keyFor(unit, px, py);
    if (overCap(key)) {
      // Over the cap: nothing new appears, the amount goes into this unit's last number.
      const last = lastOf(key, 'dmg', 'crit') || lastOf(key, 'big', 'big');
      if (last) {
        last.amount += shown;
        last.text = last.kind === 'crit' ? `-${last.amount}!` : `-${last.amount}`;
        refresh(last, 0.4);
      }
      return;
    }
    const kind = crit ? 'crit' : shown >= 40 ? 'big' : 'dmg';
    push(kind, px, py - 8, crit ? `-${shown}!` : `-${shown}`, { amount: shown, key });
  }

  function heal(x, y, amount, unit = null) {
    const shown = formatAmount(amount);
    if (shown <= 0) return;
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const key = keyFor(unit, px, py);
    const last = lastOf(key, 'heal', 'heal');
    // Heals that tick on one soldier add up instead of stacking a column of +3s.
    if (last && last.life > last.maxLife * 0.45) {
      last.amount += shown;
      last.text = `+${last.amount}`;
      refresh(last, 0.3);
      return;
    }
    if (overCap(key)) return;
    push('heal', px, py - 8, `+${shown}`, { amount: shown, key });
  }

  function miss(x, y) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    if (overCap(keyFor(null, px, py))) return;
    push('miss', px, py - 10, 'miss');
  }

  const GAIN = /^([+-])(\d+)\s*([A-Za-z]{1,4})$/;
  const RANK = /RANK UP|VETERAN|PROMOT|LEVEL UP|ASCEND/i;
  const BLAST_LABEL = /^(MINE!|BLAST)$/;

  function flushBlast(label, x, y, color) {
    const b = blast;
    blast = null;
    if (!b || b.sum <= 0) return false;
    const bx = Number.isFinite(x) ? x : b.x / b.n;
    const by = Number.isFinite(y) ? y : b.y / b.n - 10;
    const word = label ? `${String(label).replace(/!$/, '')} ` : '';
    push('blast', bx, by, `${word}-${b.sum}`, { amount: b.sum, color, still: true });
    return true;
  }

  /**
   * A word over the field. The text decides the style: "+4 TP" is a gain, "RANK UP!" a
   * promotion, "MINE!"/"BLAST" closes a Sapper's blast with its summed damage.
   */
  function status(x, y, text, color = BONE) {
    if (text == null || text === '') return;
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const label = String(text);

    if (BLAST_LABEL.test(label) && flushBlast(label, px, py, undefined)) return;

    const gain = GAIN.exec(label);
    const kind = gain ? 'tp' : RANK.test(label) ? 'rank' : /^miss/i.test(label) ? 'miss' : 'status';

    // The same word close by and still fresh: count it instead of printing it again.
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (t.kind !== kind || t.life < t.maxLife * 0.4) continue;
      if (Math.abs(t.x - px) > 64 || Math.abs(t.y - (py - 12)) > 64) continue;
      if (gain) {
        const g = GAIN.exec(t.base);
        if (!g || g[1] !== gain[1] || g[3] !== gain[3]) continue;
        t.amount += Number(gain[2]);
        t.text = `${gain[1]}${t.amount} ${gain[3]}`;
        refresh(t);
        return;
      }
      if (t.base !== label) continue;
      t.count++;
      t.text = `${t.base} x${t.count}`;
      refresh(t);
      return;
    }
    if (kind !== 'rank' && overCap(keyFor(null, px, py))) return;
    push(kind, px, py - 12, label, {
      color: kind === 'status' ? color || BONE : gain && gain[1] === '-' ? '#e0362c' : undefined,
      amount: gain ? Number(gain[2]) : 0,
      base: label,
    });
  }

  function update() {
    clock++;
    if (blast) flushBlast('', NaN, NaN, undefined);
    let w = 0;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      t.life--;
      t.y += t.vy;
      t.vy *= 0.972;
      if (t.pop > 0) t.pop = t.pop < 0.04 ? 0 : t.pop * 0.8;
      if (t.life > 0) texts[w++] = t;
    }
    texts.length = w;
    if (texts.length > MAX_TEXTS * 0.85) prune(false);
    if (clock % 240 === 0) {
      for (const [k, r] of recent) if (clock - r.start >= SECOND) recent.delete(k);
    }
  }

  let lastFontPx = -1;
  let lastFontCtx = null;

  function draw(ctx, bounds) {
    if (!ctx || !texts.length) return;
    // Text is sized in screen pixels: divide out whatever zoom the world is drawn at.
    let zoom = 1;
    if (ctx.getTransform) {
      const m = ctx.getTransform();
      zoom = Math.hypot(m.a, m.b) || 1;
    }
    // Keep some growth when zoomed right in, none of the shrink when zoomed out.
    const k = 1 / Math.max(0.6, Math.min(zoom, 1.25 + (zoom - 1.25) * 0.35));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    lastFontPx = -1;
    lastFontCtx = ctx;
    const canStroke = typeof ctx.strokeText === 'function';
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (
        bounds &&
        (t.x < bounds.left || t.x > bounds.right || t.y < bounds.top || t.y > bounds.bottom)
      ) {
        continue;
      }
      const progress = t.life / t.maxLife;
      const a = progress > 0.25 ? 1 : progress / 0.25;
      if (a <= 0.02) continue;
      // Whole-pixel sizes, so the font string is only rebuilt when the size really changes.
      const px = Math.max(7, Math.round(t.size * k * (1 + t.pop * 0.5)));
      if (px !== lastFontPx || ctx !== lastFontCtx) {
        ctx.font = `bold ${px}px ${FACE}`;
        ctx.lineWidth = Math.max(2, px * 0.26);
        lastFontPx = px;
      }
      ctx.globalAlpha = a;
      if (canStroke) ctx.strokeText(t.text, t.x, t.y);
      else {
        ctx.fillStyle = INK;
        ctx.fillText(t.text, t.x + 1, t.y + 1);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  function clear() {
    texts = [];
    recent.clear();
    blast = null;
  }

  function getCount() {
    return texts.length;
  }

  /** For tests and tools: the texts now showing. */
  function list() {
    return texts.map((t) => ({ kind: t.kind, text: t.text, x: t.x, y: t.y, life: t.life }));
  }

  return {
    add,
    damage,
    heal,
    miss,
    status,
    update,
    draw,
    clear,
    setBudget,
    prune,
    trim,
    getCount,
    list,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FloatingText = FloatingText;
