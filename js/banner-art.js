/**
 * Field banners, drawn on the canvas in one inked style: a torn black bar across the field,
 * a blood rule, bone lettering.
 *
 * Wave start, boss arrival (name card), nightfall, dawn, breach, spoils, a veteran fallen,
 * wave clear, defeat and victory all come through here. They queue, so two never overlap;
 * a click on the bar or Escape skips the one showing; under the "reduce motion" setting they
 * fade in place and stay about half as long.
 *
 * Timing runs on the wall clock, so a banner plays the same whether the game is paused,
 * slowed or fast-forwarded.
 */
const BannerArt = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const BLOOD_HI = '#c8141c';
  const GOLD = '#d9a93a';
  const TITLE_FACE = "'Pirata One', Cinzel, Georgia, serif";
  const TEXT_FACE = 'Cinzel, Georgia, serif';

  /**
   * ms on screen, queue rank (higher goes first and may cut in front), and look.
   * `tall` is the name-card size; `minor` banners are dropped when anything else is waiting.
   */
  const KINDS = {
    wave: { ms: 1700, rank: 2, ink: BONE, glyph: 'sun' },
    horde: { ms: 1900, rank: 2, ink: BLOOD_HI, glyph: 'skull' },
    siege: { ms: 1900, rank: 2, ink: BONE, glyph: 'tower' },
    boss: { ms: 3200, rank: 4, ink: BONE, tall: true, glyph: 'skull' },
    night: { ms: 1900, rank: 2, ink: BONE, glyph: 'moon' },
    dawn: { ms: 1500, rank: 2, ink: BONE, glyph: 'sun' },
    breach: { ms: 1300, rank: 3, ink: BLOOD_HI, glyph: 'slash' },
    spoils: { ms: 1900, rank: 2, ink: GOLD, glyph: 'chest' },
    fallen: { ms: 2400, rank: 3, ink: BONE, glyph: 'cross' },
    clear: { ms: 1700, rank: 1, ink: BONE, glyph: 'none' },
    perfect: { ms: 2000, rank: 1, ink: GOLD, glyph: 'none' },
    streak: { ms: 1000, rank: 0, ink: BLOOD_HI, glyph: 'none', minor: true },
    info: { ms: 1500, rank: 1, ink: BONE, glyph: 'none' },
    defeat: { ms: 2800, rank: 9, ink: BLOOD_HI, tall: true, glyph: 'skull', final: true },
    victory: { ms: 2800, rank: 9, ink: GOLD, tall: true, glyph: 'crown', final: true },
  };
  const QUEUE_MAX = 4;
  const STALE_MS = 7000;
  const IN_MS = 220;
  const OUT_MS = 260;

  const queue = [];
  let current = null;
  let lastNow = 0;
  let bandRect = null; // screen rect of the bar now showing, for the skip click

  function now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function reducedMotion() {
    return typeof Settings !== 'undefined' && !!Settings.get?.('reducedMotion');
  }

  /**
   * Queue a banner. `opts`: { title, sub, tag }.
   * Returns false when it was dropped (a minor banner with something already showing).
   */
  function show(kind, opts = {}) {
    const def = KINDS[kind] || KINDS.info;
    const title = String(opts.title || '').toUpperCase();
    if (!title) return false;
    if (def.minor && (current || queue.length)) return false;
    const item = {
      kind: KINDS[kind] ? kind : 'info',
      def,
      title,
      sub: String(opts.sub || ''),
      tag: String(opts.tag || '').toUpperCase(),
      born: now(),
      t: 0,
      skipped: false,
      seed: (title.length * 37 + title.charCodeAt(0) * 11) % 97,
    };
    // One of a kind at a time: a second breach replaces the one still waiting.
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].kind === item.kind) {
        queue[i] = item;
        return true;
      }
    }
    if (current && current.kind === item.kind && current.title === item.title) return false;
    // Keep the queue in rank order; equal ranks keep arrival order.
    let at = queue.length;
    while (at > 0 && queue[at - 1].def.rank < def.rank) at--;
    queue.splice(at, 0, item);
    while (queue.length > QUEUE_MAX) {
      // Shed the least important, latest first.
      let worst = queue.length - 1;
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].def.rank < queue[worst].def.rank) worst = i;
      }
      queue.splice(worst, 1);
    }
    // A minor banner showing gives way at once to anything that matters.
    if (current && current.def.minor) skip();
    if (def.final) {
      // The end of the run clears the stage.
      for (let i = queue.length - 1; i >= 0; i--) if (!queue[i].def.final) queue.splice(i, 1);
      if (current && !current.def.final) skip();
      runFinale();
    }
    return true;
  }

  /** Send the banner now showing straight to its exit. */
  function skip() {
    if (!current || current.skipped) return false;
    current.skipped = true;
    const life = lifeOf(current);
    current.t = Math.max(current.t, life - OUT_MS);
    return true;
  }

  function lifeOf(b) {
    return reducedMotion() ? Math.round(b.def.ms * 0.55) : b.def.ms;
  }

  function advance(dtMs) {
    if (!current) {
      const t = now();
      while (queue.length) {
        const next = queue.shift();
        if (!next.def.final && next.def.rank < 4 && t - next.born > STALE_MS) continue;
        current = next;
        current.t = 0;
        break;
      }
      if (!current) return;
    }
    current.t += dtMs;
    if (current.t >= lifeOf(current)) {
      current = null;
      bandRect = null;
    }
  }

  // ------------------------------------------------------------------ glyphs
  function glyph(ctx, name, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.1);
    if (name === 'moon') {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.62, 0.6, Math.PI * 2 - 0.6);
      ctx.arc(s * 0.3, 0, s * 0.5, Math.PI * 2 - 1.05, 1.05, true);
      ctx.closePath();
      ctx.fill();
    } else if (name === 'sun') {
      ctx.beginPath();
      ctx.arc(0, s * 0.3, s * 0.4, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        ctx.moveTo(Math.cos(a) * s * 0.55, s * 0.3 + Math.sin(a) * s * 0.55);
        ctx.lineTo(Math.cos(a) * s * 0.85, s * 0.3 + Math.sin(a) * s * 0.85);
      }
      ctx.moveTo(-s * 0.9, s * 0.3);
      ctx.lineTo(s * 0.9, s * 0.3);
      ctx.stroke();
    } else if (name === 'skull') {
      ctx.beginPath();
      ctx.arc(0, -s * 0.12, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-s * 0.28, s * 0.2, s * 0.56, s * 0.34);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(-s * 0.2, -s * 0.1, s * 0.14, 0, Math.PI * 2);
      ctx.arc(s * 0.2, -s * 0.1, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-s * 0.04, s * 0.12, s * 0.08, s * 0.16);
      ctx.fillRect(-s * 0.14, s * 0.36, s * 0.05, s * 0.2);
      ctx.fillRect(s * 0.09, s * 0.36, s * 0.05, s * 0.2);
    } else if (name === 'cross') {
      ctx.lineWidth = s * 0.2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.7);
      ctx.lineTo(0, s * 0.7);
      ctx.moveTo(-s * 0.42, -s * 0.25);
      ctx.lineTo(s * 0.42, -s * 0.25);
      ctx.stroke();
    } else if (name === 'slash') {
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(-s * 0.5 + i * s * 0.32, -s * 0.6);
        ctx.lineTo(s * 0.1 + i * s * 0.32, s * 0.6);
      }
      ctx.stroke();
    } else if (name === 'chest') {
      ctx.fillRect(-s * 0.55, -s * 0.1, s * 1.1, s * 0.55);
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.18);
      ctx.lineTo(-s * 0.4, -s * 0.5);
      ctx.lineTo(s * 0.4, -s * 0.5);
      ctx.lineTo(s * 0.55, -s * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillRect(-s * 0.08, -s * 0.05, s * 0.16, s * 0.24);
    } else if (name === 'tower') {
      ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.9);
      for (let i = -1; i <= 1; i++)
        ctx.fillRect(i * s * 0.26 - s * 0.1, -s * 0.55, s * 0.2, s * 0.3);
      ctx.fillStyle = INK;
      ctx.fillRect(-s * 0.08, s * 0.2, s * 0.16, s * 0.4);
    } else if (name === 'crown') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, s * 0.4);
      ctx.lineTo(-s * 0.6, -s * 0.3);
      ctx.lineTo(-s * 0.3, s * 0.05);
      ctx.lineTo(0, -s * 0.5);
      ctx.lineTo(s * 0.3, s * 0.05);
      ctx.lineTo(s * 0.6, -s * 0.3);
      ctx.lineTo(s * 0.6, s * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** The torn bar: a black band whose long edges are ragged, tapering at both ends. */
  function tornBar(ctx, x0, x1, cy, h, seed) {
    const n = Math.max(8, Math.round((x1 - x0) / 26));
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = x0 + (x1 - x0) * k;
      const taper = Math.min(1, Math.min(k, 1 - k) * 9);
      const rag = Math.sin(seed + i * 2.3) * 0.09 + Math.sin(seed * 2 + i * 5.1) * 0.05;
      const y = cy - h * (0.5 + rag) * (0.25 + 0.75 * taper);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const k = i / n;
      const x = x0 + (x1 - x0) * k;
      const taper = Math.min(1, Math.min(k, 1 - k) * 9);
      const rag = Math.sin(seed * 1.7 + i * 2.9) * 0.09 + Math.sin(seed + i * 4.3) * 0.05;
      ctx.lineTo(x, cy + h * (0.5 + rag) * (0.25 + 0.75 * taper));
    }
    ctx.closePath();
  }

  function fitFont(ctx, text, px, face, maxW, bold) {
    let size = px;
    ctx.font = `${bold ? 'bold ' : ''}${Math.round(size)}px ${face}`;
    if (ctx.measureText) {
      const w = ctx.measureText(text).width;
      if (w > maxW) {
        size = Math.max(10, (size * maxW) / w);
        ctx.font = `${bold ? 'bold ' : ''}${Math.round(size)}px ${face}`;
      }
    }
    return size;
  }

  /**
   * Draw one banner at time `t` ms of its `life`, on a canvas `w` x `h` in pixels.
   * Returns the bar's rect.
   */
  function paint(ctx, b, w, h, t, life) {
    const calm = reducedMotion();
    const def = b.def;
    const unit = Math.max(0.62, Math.min(1.5, Math.min(w / 900, h / 620)));
    const barH = (def.tall ? 118 : 74) * unit;
    const cy = def.final ? h * 0.42 : Math.max(h * 0.24, 96 * unit + barH / 2);
    const tin = Math.min(1, t / IN_MS);
    const tout = Math.min(1, Math.max(0, (life - t) / OUT_MS));
    const ease = (k) => 1 - (1 - k) * (1 - k);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (def.final) {
      ctx.globalAlpha = 0.55 * Math.min(tin, tout);
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, h);
    }

    // The bar is brushed on from the left and wiped off to the right.
    let x0 = 0;
    let x1 = w;
    let alpha = 1;
    if (calm) alpha = Math.min(tin, tout);
    else {
      x1 = w * ease(tin);
      x0 = w * (1 - ease(tout));
      if (x1 - x0 < 8) {
        ctx.restore();
        return null;
      }
    }
    ctx.globalAlpha = 0.93 * alpha;
    ctx.fillStyle = INK;
    tornBar(ctx, x0 - 30, x1 + 30, cy, barH, b.seed);
    ctx.fill();

    // Everything on the bar is clipped to the part of it that is inked so far.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, cy - barH, Math.max(0, x1 - x0), barH * 2);
    ctx.clip();
    ctx.globalAlpha = alpha;

    // Blood rule under the lettering, with a drip.
    const ruleY = cy + barH * (def.tall ? 0.12 : 0.1);
    const ruleW = Math.min(w * 0.6, 520 * unit);
    ctx.strokeStyle = BLOOD_HI;
    ctx.lineWidth = Math.max(2, 3 * unit);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2 - ruleW / 2, ruleY);
    ctx.lineTo(w / 2 + ruleW / 2, ruleY);
    ctx.moveTo(w / 2 - ruleW * 0.31, ruleY);
    ctx.lineTo(w / 2 - ruleW * 0.31, ruleY + 7 * unit);
    ctx.stroke();

    // The lettering is stamped: it lands a little large and settles.
    const stamp = calm ? 1 : 1 + 0.16 * Math.max(0, 1 - (t - IN_MS * 0.6) / 160);
    const titlePx = (def.tall ? 50 : 36) * unit;
    const titleY = cy - barH * (def.tall ? 0.14 : 0.16);
    ctx.save();
    ctx.translate(w / 2, titleY);
    ctx.scale(stamp, stamp);
    const size = fitFont(ctx, b.title, titlePx, TITLE_FACE, w * 0.86, false);
    ctx.fillStyle = BLOOD;
    ctx.fillText(b.title, size * 0.045, size * 0.06);
    ctx.fillStyle = def.ink;
    ctx.fillText(b.title, 0, 0);
    const half = ctx.measureText
      ? ctx.measureText(b.title).width / 2
      : size * b.title.length * 0.25;
    if (def.glyph !== 'none') {
      const gs = size * 0.42;
      glyph(ctx, def.glyph, -half - gs * 1.5, 0, gs, def.ink);
      glyph(ctx, def.glyph, half + gs * 1.5, 0, gs, def.ink);
    }
    ctx.restore();

    if (b.tag) {
      ctx.font = `bold ${Math.round(11 * unit)}px ${TEXT_FACE}`;
      ctx.fillStyle = BLOOD_HI;
      ctx.fillText(b.tag.split('').join(' '), w / 2, cy - barH * (def.tall ? 0.4 : 0.42));
    }
    if (b.sub) {
      fitFont(ctx, b.sub, (def.tall ? 17 : 14) * unit, TEXT_FACE, w * 0.86, true);
      // A brighter blood than the rule, so it reads on the black bar.
      ctx.fillStyle = def.tall ? '#e8564c' : BONE;
      ctx.fillText(b.sub, w / 2, cy + barH * (def.tall ? 0.3 : 0.3));
    }
    ctx.restore();
    ctx.restore();
    return { x: 0, y: cy - barH * 0.6, w, h: barH * 1.2 };
  }

  /** Draw the banner now showing. Called once a frame from the game's draw. */
  function draw(ctx, w, h) {
    const t = now();
    const dt = lastNow ? Math.min(100, Math.max(0, t - lastNow)) : 16;
    lastNow = t;
    advance(dt);
    if (!current || !ctx || current.def.final) return;
    bandRect = paint(ctx, current, w, h, current.t, lifeOf(current));
  }

  // ----------------------------------------------------------------- finale
  // Defeat and victory outlive the game's own draw loop (it stops when the run ends), so
  // they play on a canvas of their own laid over the page, above the result screen.
  let finaleEl = null;
  let finaleRaf = 0;

  function runFinale() {
    if (typeof document === 'undefined' || !document.body || finaleRaf) return;
    if (typeof requestAnimationFrame === 'undefined') return;
    if (!finaleEl) {
      finaleEl = document.createElement('canvas');
      finaleEl.id = 'banner-finale';
      finaleEl.style.cssText =
        'position:fixed;left:0;top:0;width:100%;height:100%;z-index:9000;pointer-events:none;';
    }
    document.body.appendChild(finaleEl);
    const step = () => {
      const t = now();
      const dt = lastNow ? Math.min(100, Math.max(0, t - lastNow)) : 16;
      lastNow = t;
      advance(dt);
      const w = (finaleEl.width = window.innerWidth || 800);
      const h = (finaleEl.height = window.innerHeight || 600);
      const c = finaleEl.getContext('2d');
      c.clearRect(0, 0, w, h);
      if (current && current.def.final) {
        bandRect = paint(c, current, w, h, current.t, lifeOf(current));
        finaleRaf = requestAnimationFrame(step);
      } else {
        finaleRaf = 0;
        finaleEl.remove();
      }
    };
    finaleRaf = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------- watching
  // What the banners follow, read once a tick from the game. Edges, not states: a banner is
  // raised when something changes.
  const seen = {
    phase: null,
    breaches: 0,
    spoils: 0,
    fallenKey: '',
    tick: -1,
    dawnAt: 0,
    waveAt: 0,
    primed: false,
  };
  let siegeCtx = null;
  let bossCard = null;

  function observe(GS, ctx) {
    if (!GS) return;
    siegeCtx = ctx || siegeCtx;
    const tick = GS.updateTick || 0;
    if (tick < seen.tick) reset();
    seen.tick = tick;

    const phase = GS.timeOfDay;
    if (phase !== seen.phase) {
      const first = seen.phase == null;
      seen.phase = phase;
      if (!first && GS.state === 'playing') {
        if (phase === 'night') {
          show('night', { title: 'Nightfall', sub: 'Mend, build and muster before the horn' });
        } else if (phase === 'day' && now() - seen.waveAt > 1500) {
          seen.dawnAt = now();
        }
      }
    }
    // Dawn is announced on its own only when no wave banner comes with it.
    if (seen.dawnAt && now() - seen.dawnAt > 350) {
      seen.dawnAt = 0;
      show('dawn', { title: 'Dawn', sub: 'They come from the north' });
    }

    // The boss banner is the name card: the page's own card stays down.
    if (bossCard == null && typeof document !== 'undefined') {
      bossCard = document.getElementById?.('boss-card') || false;
    }
    if (bossCard && !bossCard.hidden) bossCard.hidden = true;

    if (tick % 5 !== 0 || typeof SiegeLoop === 'undefined' || !siegeCtx) return;
    let hud;
    try {
      hud = SiegeLoop.getHudState(siegeCtx);
    } catch (_) {
      return;
    }
    if (!hud) return;
    const limit = hud.breachLimit || 0;
    // The first reading (a new run, a loaded save) only sets the baseline.
    const primed = seen.primed;
    seen.primed = true;
    if (primed && hud.breaches > seen.breaches && GS.state === 'playing') {
      const left = limit - hud.breaches;
      show('breach', {
        title: 'Breach',
        sub:
          left < 0
            ? 'The line is broken'
            : left === 0
              ? 'One more and the realm falls'
              : `The realm can bear ${left} more`,
      });
      globalThis.GameFeedback?.onBreach?.();
    }
    seen.breaches = hud.breaches || 0;
    globalThis.GameFeedback?.setBreachState?.(seen.breaches, limit);

    const spoils = hud.pendingSpoils || 0;
    if (primed && spoils > seen.spoils) {
      show('spoils', { title: 'Spoils of War', sub: 'Choose one reward before the next assault' });
    }
    seen.spoils = spoils;

    const f = hud.fallen && hud.fallen.length ? hud.fallen[hud.fallen.length - 1] : null;
    const key = f ? `${f.name}|${f.wave}|${f.kills}|${hud.fallen.length}` : '';
    if (primed && key && key !== seen.fallenKey && GS.state === 'playing') {
      show('fallen', {
        title: `${f.name} has fallen`,
        sub: `${f.kills} kill${f.kills === 1 ? '' : 's'} across ${f.waves} wave${f.waves === 1 ? '' : 's'}`,
        tag: 'Veteran',
      });
    }
    seen.fallenKey = key;
  }

  /** Wave start. Carries the dawn with it, and the boss's name card on a boss wave. */
  function waveStart(wave, opts = {}) {
    // The wave banner carries the dawn when the day has only just broken.
    const dawn = seen.dawnAt > 0 || seen.phase === 'night';
    seen.dawnAt = 0;
    seen.waveAt = now();
    const boss = opts.boss ? siegeCtx?.boss || null : null;
    if (opts.boss) {
      const name = boss?.name || opts.subtitle || 'The Warlord';
      show('boss', {
        title: name,
        sub: boss?.title || '',
        tag: `Wave ${wave} · Boss`,
      });
      return;
    }
    const kind = opts.horde ? 'horde' : opts.siege ? 'siege' : 'wave';
    show(kind, {
      title: opts.horde
        ? `Horde · Wave ${wave}`
        : opts.siege
          ? `Siege · Wave ${wave}`
          : `Wave ${wave}`,
      sub: opts.subtitle || 'Hold the line',
      tag: dawn ? 'Dawn' : '',
    });
  }

  function reset() {
    queue.length = 0;
    current = null;
    bandRect = null;
    seen.phase = null;
    seen.breaches = 0;
    seen.spoils = 0;
    seen.fallenKey = '';
    seen.tick = -1;
    seen.dawnAt = 0;
    seen.waveAt = 0;
    seen.primed = false;
  }

  // A click on the bar, or Escape, skips the banner showing. The click is not consumed.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!current || !bandRect) return;
        const el = current.def.final ? finaleEl : e.target;
        if (!el || !el.getBoundingClientRect || (!current.def.final && el.tagName !== 'CANVAS'))
          return;
        const r = el.getBoundingClientRect();
        const sy = ((e.clientY - r.top) / Math.max(1, r.height)) * (el.height || r.height);
        if (sy >= bandRect.y && sy <= bandRect.y + bandRect.h) skip();
      },
      true
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && current) skip();
    });
  }

  return {
    KINDS,
    show,
    skip,
    draw,
    paint,
    advance,
    observe,
    waveStart,
    reset,
    current: () => current,
    pending: () => queue.length,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.BannerArt = BannerArt;
