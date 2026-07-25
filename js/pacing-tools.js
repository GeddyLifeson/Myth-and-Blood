/**
 * Pacing Tools — strong pause, simulation speed (1×–10×), and notification queuing.
 */
const PacingTools = (() => {
  const SPEED_OPTIONS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  const MAX_SIM_STEPS = 10;
  const MAX_QUEUE = 48;
  const DEFAULTS = {
    queueWhilePaused: true,
    maxHudMessages: 3,
    queueDrainTicks: 24,
    strongPauseOnMacroPanel: true,
    pauseOnTabHidden: true,
  };

  let config = { ...DEFAULTS };
  let queue = [];
  let drainCooldown = 0;
  let strongPauseReason = null;
  let userPaused = false;
  let macroPanels = new Set();
  let hiddenPause = false;
  let stats = { queued: 0, shown: 0, dropped: 0, drains: 0 };

  function resetRun() {
    queue = [];
    drainCooldown = 0;
    strongPauseReason = null;
    userPaused = false;
    macroPanels = new Set();
    hiddenPause = false;
    stats = { queued: 0, shown: 0, dropped: 0, drains: 0 };
    config = { ...DEFAULTS };
  }

  function normalizeSpeed(speed) {
    const n = parseFloat(speed);
    if (!Number.isFinite(n)) return 1;
    if (SPEED_OPTIONS.includes(n)) return n;
    let best = 1;
    let bestDist = Infinity;
    for (const opt of SPEED_OPTIONS) {
      const d = Math.abs(opt - n);
      if (d < bestDist) {
        bestDist = d;
        best = opt;
      }
    }
    return best;
  }

  function getMaxSimulationSteps(speed) {
    const s = normalizeSpeed(speed);
    if (s <= 1) return 1;
    return Math.min(MAX_SIM_STEPS, Math.ceil(s));
  }

  function getSpeedOptions() {
    return [...SPEED_OPTIONS];
  }

  function cycleSpeed(current) {
    const cur = normalizeSpeed(current);
    const idx = SPEED_OPTIONS.indexOf(cur);
    return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
  }

  function shouldQueue(priority, ctx = {}) {
    if (priority === 'critical' || ctx.bypassQueue) return false;
    if (ctx.paused && config.queueWhilePaused) return true;
    if ((ctx.visibleCount | 0) >= config.maxHudMessages) return true;
    return false;
  }

  function processMessage(text, duration = 220, ctx = {}) {
    const priority = ctx.priority || 'normal';
    if (!text) return { queued: false, shown: false };
    if (shouldQueue(priority, ctx)) {
      queue.push({
        text,
        duration: duration | 0,
        priority,
        at: Date.now(),
      });
      stats.queued += 1;
      while (queue.length > MAX_QUEUE) {
        queue.shift();
        stats.dropped += 1;
      }
      return { queued: true, shown: false };
    }
    return { queued: false, shown: true, text, duration };
  }

  function tick(ctx = {}) {
    if (ctx.paused || !queue.length) return null;
    drainCooldown -= 1;
    if (drainCooldown > 0) return null;
    const next = queue.shift();
    if (!next) return null;
    drainCooldown = config.queueDrainTicks;
    stats.drains += 1;
    ctx.directShow?.(next.text, next.duration);
    return next;
  }

  function flushQueue(ctx = {}, max = 6) {
    let n = 0;
    while (queue.length && n < max && !ctx.paused) {
      const next = queue.shift();
      if (!next) break;
      ctx.directShow?.(next.text, next.duration);
      n += 1;
      stats.drains += 1;
    }
    return n;
  }

  function shouldHoldPause() {
    return userPaused || hiddenPause || macroPanels.size > 0;
  }

  function onPauseChanged(paused, ctx = {}) {
    const reason = ctx.reason || 'user';
    if (reason === 'user') userPaused = !!paused;
    if (!paused) {
      drainCooldown = 0;
      flushQueue(ctx, 4);
    }
    refreshPauseReason();
  }

  function onMacroPanelOpen(layerId, ctx = {}) {
    if (!config.strongPauseOnMacroPanel) return;
    macroPanels.add(layerId);
    refreshPauseReason();
    if (!ctx.alreadyPaused && ctx.setPaused) {
      ctx.setPaused(true, { reason: 'macro', silent: true });
    }
  }

  function onMacroPanelClose(layerId, ctx = {}) {
    macroPanels.delete(layerId);
    refreshPauseReason();
    if (!shouldHoldPause() && ctx.setPaused) {
      ctx.setPaused(false, { reason: 'macro', silent: true });
    }
  }

  /** Drop orphaned macro/tab pause holds (e.g. after shelving GS/IG mid-session). */
  function clearStrongPause() {
    macroPanels = new Set();
    hiddenPause = false;
    refreshPauseReason();
  }

  function onVisibilityHidden(ctx = {}) {
    if (!config.pauseOnTabHidden || !ctx.isPlaying) return;
    hiddenPause = true;
    refreshPauseReason();
    ctx.setPaused?.(true, { reason: 'hidden', silent: true });
  }

  function onVisibilityVisible(ctx = {}) {
    if (!hiddenPause) return;
    hiddenPause = false;
    refreshPauseReason();
    if (!shouldHoldPause() && ctx.setPaused) {
      ctx.setPaused(false, { reason: 'hidden', silent: true });
    }
  }

  function refreshPauseReason() {
    if (userPaused) {
      strongPauseReason = 'Player pause';
      return;
    }
    if (hiddenPause) {
      strongPauseReason = 'Tab hidden';
      return;
    }
    if (macroPanels.has('intergalactic')) {
      strongPauseReason = 'Galaxy command';
      return;
    }
    if (macroPanels.has('grand_strategy')) {
      strongPauseReason = 'Empire planning';
      return;
    }
    strongPauseReason = null;
  }

  function getPauseOverlay() {
    if (!strongPauseReason) return { title: 'PAUSED', subtitle: 'Space resume · Esc menu' };
    const q = queue.length;
    const qNote = q > 0 ? ` · ${q} queued` : '';
    return {
      title: 'STRONG PAUSE',
      subtitle: `${strongPauseReason}${qNote} — Space resume`,
    };
  }

  function getQueueDepth() {
    return queue.length;
  }

  function getSnapshot(ctx = {}) {
    return {
      speed: normalizeSpeed(ctx.gameSpeed ?? 1),
      speedOptions: SPEED_OPTIONS,
      queueDepth: queue.length,
      strongPauseReason,
      userPaused,
      macroPanels: [...macroPanels],
      hiddenPause,
      stats: { ...stats },
      config: { ...config },
    };
  }

  function getStateSnapshot(ctx = {}) {
    const snap = getSnapshot(ctx);
    return {
      ...snap,
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    const speed = normalizeSpeed(ctx.gameSpeed ?? 1);
    const parts = [`${speed}×`];
    if (ctx.paused) parts.push('PAUSED');
    if (queue.length) parts.push(`${queue.length} queued`);
    if (strongPauseReason && !ctx.paused) parts.push(strongPauseReason);
    return parts.join(' · ');
  }

  function formatIntelNote(ctx = {}) {
    if (queue.length >= 6) return `Pacing: ${queue.length} messages queued`;
    if ((ctx.gameSpeed | 0) >= 8) return `Simulation ${normalizeSpeed(ctx.gameSpeed)}×`;
    return '';
  }

  function renderSpeedButtons(containerSelector, activeSpeed, onPick) {
    if (typeof document === 'undefined') return;
    const el = document.querySelector(containerSelector);
    if (!el) return;
    const speed = normalizeSpeed(activeSpeed);
    el.innerHTML = SPEED_OPTIONS.map(
      (s) =>
        `<button type="button" class="speed-btn${s === speed ? ' active' : ''}" data-speed="${s}">${s}×</button>`
    ).join('');
    el.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.onclick = () => {
        const v = parseFloat(btn.dataset.speed);
        if (Number.isFinite(v)) onPick?.(v);
      };
    });
  }

  return {
    SPEED_OPTIONS,
    MAX_SIM_STEPS,
    DEFAULTS,
    resetRun,
    normalizeSpeed,
    getMaxSimulationSteps,
    getSpeedOptions,
    cycleSpeed,
    processMessage,
    tick,
    flushQueue,
    onPauseChanged,
    onMacroPanelOpen,
    onMacroPanelClose,
    clearStrongPause,
    onVisibilityHidden,
    onVisibilityVisible,
    shouldHoldPause,
    getPauseOverlay,
    getQueueDepth,
    getSnapshot,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    renderSpeedButtons,
  };
})();