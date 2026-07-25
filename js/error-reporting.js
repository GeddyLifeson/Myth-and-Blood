/**
 * Error reporting — graceful degradation, local crash log ring buffer, freeze watchdog,
 * phase markers for mid-frame freezes, manual bug reports, optional upload.
 *
 * Local logs always write to localStorage (+ Electron file when available).
 * Upload still requires Settings.errorReportingOptIn.
 */
const ErrorReporting = (() => {
  const STORAGE_KEY = 'myth-and-blood-error-log-v1';
  const VERSION = 2;
  const MAX_ENTRIES = 300;
  const SUBSYSTEM_FAIL_LIMIT = 3;
  const LOOP_FAIL_LIMIT = 8;
  const TOAST_MS = 4200;
  // Detect freezes faster so players get a diagnostic before giving up.
  const STALL_MS = 3500;
  const SLOW_FRAME_MS = 700;
  const FREEZE_FRAME_MS = 3500;
  const PHASE_RING = 24;

  const SUBSYSTEMS = [
    'simulation',
    'render',
    'pathWorker',
    'particles',
    'strikeFx',
    'audio',
    'minimap',
    'mods',
  ];

  let store = {
    sessionId: null,
    entries: [],
    crashCount: 0,
    pendingUpload: [],
    lastUploadAt: 0,
  };

  let degraded = {};
  let failCounts = {};
  let loopFailStreak = 0;
  let overlayOpen = false;
  let bugReportOpen = false;
  let uploadEnabled = false;
  let patched = false;
  let toastTimer = null;
  let watchdogWorker = null;
  let lastHeartbeatAt = 0;
  let frameStartedAt = 0;
  let pendingStall = null;
  let slowFrameStreak = 0;
  let lastPhase = 'boot';
  let lastPhaseAt = 0;
  const phaseRing = [];
  let lastPingAt = 0;
  let framePeakMs = 0;
  let simStepIndex = 0;

  function now() {
    return Date.now();
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store = { ...store, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    if (!store.sessionId) {
      store.sessionId = `sess-${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    if (!Array.isArray(store.entries)) store.entries = [];
    if (!Array.isArray(store.pendingUpload)) store.pendingUpload = [];
    store.entries = store.entries.slice(-MAX_ENTRIES);
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {
      /* ignore */
    }
  }

  function getEndpoint() {
    if (typeof window !== 'undefined' && window.MB_ERROR_ENDPOINT) {
      return String(window.MB_ERROR_ENDPOINT);
    }
    if (typeof window !== 'undefined' && window.MB_ANALYTICS_ENDPOINT) {
      return String(window.MB_ANALYTICS_ENDPOINT);
    }
    return '';
  }

  function syncUploadEnabled() {
    uploadEnabled =
      typeof Settings !== 'undefined' && Settings.get
        ? !!Settings.get('errorReportingOptIn')
        : false;
  }

  function markPhase(phase, detail) {
    lastPhase = String(phase || 'unknown');
    lastPhaseAt = now();
    phaseRing.push({
      phase: lastPhase,
      at: lastPhaseAt,
      detail: detail != null ? String(detail).slice(0, 120) : undefined,
    });
    if (phaseRing.length > PHASE_RING) phaseRing.shift();
    // Keep watchdog alive during long sim ticks / pathfinds.
    if (lastPhaseAt - lastPingAt > 250) pingWatchdog();
  }

  function getLastPhase() {
    return { phase: lastPhase, at: lastPhaseAt, ring: phaseRing.slice(-12) };
  }

  function gameContext() {
    const ctx = {
      state: 'unknown',
      wave: null,
      modeId: null,
      lastPhase,
      phaseAgeMs: lastPhaseAt ? now() - lastPhaseAt : null,
    };
    try {
      if (typeof Game !== 'undefined' && Game.getState) {
        const gs = Game.getState();
        ctx.state = gs?.state || ctx.state;
        ctx.wave = gs?.wave ?? null;
        ctx.paused = !!gs?.paused;
        ctx.creative = !!gs?.creativeMode;
        ctx.gameSpeed = gs?.gameSpeed ?? null;
        ctx.timeOfDay = gs?.timeOfDay ?? null;
        ctx.army = gs?.army ?? null;
        ctx.enemyCount = gs?.enemyCount ?? null;
        ctx.buildingCount = gs?.buildingCount ?? null;
        ctx.difficulty = gs?.difficultyLabel ?? gs?.difficulty ?? null;
        ctx.updateTick = gs?.updateTick ?? null;
        ctx.selectedUnits = gs?.selectedUnitIds?.length ?? (gs?.selectedUnitId ? 1 : 0);
      }
      if (typeof Game !== 'undefined' && Game.getRunModeId) {
        ctx.modeId = Game.getRunModeId();
      }
      if (typeof Game !== 'undefined' && Game.getDiagSnapshot) {
        Object.assign(ctx, Game.getDiagSnapshot());
      }
      if (typeof Perf !== 'undefined' && Perf.getStats) {
        const perf = Perf.getStats();
        ctx.fps = perf.fps ?? null;
        ctx.frameMs = perf.frameMs ?? null;
      }
    } catch (_) {
      /* ignore */
    }
    return ctx;
  }

  function buildGameSnapshot() {
    const snap = { ...gameContext(), at: now(), phaseRing: phaseRing.slice(-12) };
    try {
      if (typeof Game !== 'undefined' && Game.getState) {
        const gs = Game.getState();
        snap.kills = gs.kills ?? null;
        snap.tactical = gs.tactical ?? null;
        snap.bossActive = !!gs.bossActive;
        snap.waveProgress = gs.waveProgress ?? null;
        snap.territoryTier = gs.territoryTier ?? null;
        snap.globalHunt = !!gs.globalHunt;
        snap.degraded = getDegraded();
        snap.simStepIndex = simStepIndex;
        snap.framePeakMs = framePeakMs;
      }
      if (typeof PathWorkerBridge !== 'undefined' && PathWorkerBridge.getStats) {
        snap.pathWorker = PathWorkerBridge.getStats();
      }
      if (typeof performance !== 'undefined' && performance.memory) {
        snap.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
      }
    } catch (_) {
      /* ignore */
    }
    return snap;
  }

  function normalizeError(err) {
    if (err instanceof Error) {
      return {
        name: err.name || 'Error',
        message: String(err.message || err),
        stack: String(err.stack || ''),
      };
    }
    return {
      name: 'Error',
      message: String(err ?? 'unknown error'),
      stack: '',
    };
  }

  function pushEntry(entry) {
    store.entries.push(entry);
    if (store.entries.length > MAX_ENTRIES) {
      store.entries = store.entries.slice(-MAX_ENTRIES);
    }
    if (entry.level === 'error' || entry.level === 'fatal') {
      store.crashCount = (store.crashCount || 0) + 1;
      store.pendingUpload.push(entry);
      if (store.pendingUpload.length > 40) {
        store.pendingUpload = store.pendingUpload.slice(-40);
      }
    }
    save();
    if (uploadEnabled) maybeFlush();
    writeElectronLog(entry);
  }

  function log(level, message, meta = {}) {
    const entry = {
      level,
      message: String(message || ''),
      at: now(),
      meta: { ...meta, ...gameContext() },
    };
    pushEntry(entry);
    if (level === 'warn' || level === 'error' || level === 'fatal') {
      const tag = level.toUpperCase();
      console.warn(`[${tag}] ${entry.message}`, entry.meta);
    }
    return entry;
  }

  function captureException(err, context = {}) {
    const norm = normalizeError(err);
    const entry = {
      level: context.fatal ? 'fatal' : 'error',
      message: norm.message,
      at: now(),
      error: norm,
      meta: {
        ...context,
        ...gameContext(),
        subsystem: context.subsystem || null,
        label: context.label || null,
      },
    };
    pushEntry(entry);
    console.error('[ERROR]', norm.message, norm.stack || '', entry.meta);
    if (context.subsystem) registerSubsystemFailure(context.subsystem, norm.message);
    if (context.fatal || loopFailStreak >= LOOP_FAIL_LIMIT) showRecoveryOverlay(entry);
    return entry;
  }

  function registerSubsystemFailure(subsystem, reason) {
    if (!subsystem) return;
    failCounts[subsystem] = (failCounts[subsystem] || 0) + 1;
    if (failCounts[subsystem] >= SUBSYSTEM_FAIL_LIMIT && !degraded[subsystem]) {
      disableSubsystem(subsystem, reason);
    }
  }

  function disableSubsystem(subsystem, reason) {
    degraded[subsystem] = reason || 'repeated failures';
    log('warn', `Subsystem disabled: ${subsystem}`, { subsystem, reason: degraded[subsystem] });
    showDegradeToast(`${labelForSubsystem(subsystem)} paused — game continues with reduced effects.`);
    applySubsystemPatches();
  }

  function labelForSubsystem(id) {
    const labels = {
      simulation: 'Simulation',
      render: 'Rendering',
      pathWorker: 'Path worker',
      particles: 'Particles',
      strikeFx: 'Strike effects',
      audio: 'Audio',
      minimap: 'Minimap',
      mods: 'Mods',
    };
    return labels[id] || id;
  }

  function isDegraded(subsystem) {
    return !!degraded[subsystem];
  }

  function getDegraded() {
    return { ...degraded };
  }

  function resetDegradation() {
    degraded = {};
    failCounts = {};
    loopFailStreak = 0;
    applySubsystemPatches();
    renderDegradedList();
  }

  function runGuarded(label, fn, opts = {}) {
    if (opts.subsystem && isDegraded(opts.subsystem)) {
      return opts.fallback ? opts.fallback() : undefined;
    }
    const phaseLabel = opts.phase || label;
    if (phaseLabel) markPhase(phaseLabel, opts.detail);
    const t0 = now();
    try {
      const result = fn();
      if (opts.subsystem) failCounts[opts.subsystem] = 0;
      if (label === 'gameLoop' || label === 'Game.update') loopFailStreak = 0;
      const dt = now() - t0;
      if (opts.warnMs && dt >= opts.warnMs) {
        log('warn', `Slow ${label}: ${dt}ms`, {
          kind: 'slow-section',
          label,
          sectionMs: dt,
          phase: lastPhase,
          snapshot: buildGameSnapshot(),
        });
      }
      return result;
    } catch (err) {
      if (label === 'gameLoop' || label === 'Game.update') loopFailStreak += 1;
      captureException(err, {
        label,
        subsystem: opts.subsystem || null,
        fatal: opts.fatal || loopFailStreak >= LOOP_FAIL_LIMIT,
        phase: lastPhase,
        phaseRing: phaseRing.slice(-12),
        sectionMs: now() - t0,
      });
      if (typeof opts.fallback === 'function') return opts.fallback();
      return undefined;
    }
  }

  function installGlobalHandlers() {
    if (typeof window === 'undefined' || window.__mbErrorHandlersInstalled) return;
    window.__mbErrorHandlersInstalled = true;

    window.addEventListener('error', (event) => {
      captureException(event.error || event.message, {
        label: 'window.onerror',
        fatal: false,
        source: event.filename,
        line: event.lineno,
        col: event.colno,
      });
      event.preventDefault();
    });

    window.addEventListener('unhandledrejection', (event) => {
      captureException(event.reason, {
        label: 'unhandledrejection',
        fatal: false,
      });
      event.preventDefault();
    });
  }

  function applySubsystemPatches() {
    if (typeof PathWorkerBridge !== 'undefined' && isDegraded('pathWorker')) {
      PathWorkerBridge.shutdown?.();
    }
  }

  function patchMethod(target, name, label, subsystem) {
    if (!target || target[`__mbPatch_${name}`]) return;
    const orig = target[name];
    if (typeof orig !== 'function') return;
    target[name] = function patchedMethod(...args) {
      if (subsystem && isDegraded(subsystem)) return undefined;
      return runGuarded(label, () => orig.apply(target, args), { subsystem });
    };
    target[`__mbPatch_${name}`] = true;
  }

  function patchGame() {
    if (patched || typeof Game === 'undefined') return;
    patchMethod(Game, 'update', 'Game.update', 'simulation');
    patchMethod(Game, 'draw', 'Game.draw', 'render');
    patchMethod(Game, 'updatePresentation', 'Game.updatePresentation', 'render');
    patched = true;
  }

  function patchSubsystems() {
    if (typeof Particles !== 'undefined') {
      patchMethod(Particles, 'update', 'Particles.update', 'particles');
      patchMethod(Particles, 'draw', 'Particles.draw', 'particles');
    }
    if (typeof StrikeFX !== 'undefined') {
      patchMethod(StrikeFX, 'update', 'StrikeFX.update', 'strikeFx');
      patchMethod(StrikeFX, 'draw', 'StrikeFX.draw', 'strikeFx');
    }
    if (typeof ModLoader !== 'undefined') {
      patchMethod(ModLoader, 'onGameStart', 'ModLoader.onGameStart', 'mods');
    }
  }

  function showDegradeToast(text) {
    const el = document.getElementById('error-degrade-toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('visible');
      el.hidden = true;
    }, TOAST_MS);
  }

  function renderDegradedList() {
    const el = document.getElementById('error-recovery-degraded');
    if (!el) return;
    const keys = Object.keys(degraded);
    if (!keys.length) {
      el.textContent = '';
      return;
    }
    el.textContent = `Reduced features: ${keys.map((k) => labelForSubsystem(k)).join(', ')}`;
  }

  function formatOverlayDetail(entry) {
    if (!entry) return '';
    const snap = entry.meta?.snapshot || {};
    const lines = [
      entry.message,
      entry.error?.stack || '',
      entry.meta?.subsystem ? `Subsystem: ${entry.meta.subsystem}` : '',
      entry.meta?.kind ? `Kind: ${entry.meta.kind}` : '',
      entry.meta?.phase || snap.lastPhase ? `Last phase: ${entry.meta?.phase || snap.lastPhase}` : '',
      entry.meta?.stallMs ? `Stall: ${Math.round(entry.meta.stallMs)}ms` : '',
      entry.meta?.frameMs ? `Frame: ${Math.round(entry.meta.frameMs)}ms` : '',
      entry.meta?.wave != null || snap.wave != null
        ? `Wave: ${entry.meta?.wave ?? snap.wave}`
        : '',
      snap.army != null ? `Army/enemies: ${snap.army}/${snap.enemyCount ?? '?'}` : '',
      snap.pathPending != null ? `Path pending: ${snap.pathPending}` : '',
      snap.heapMB != null ? `Heap: ${snap.heapMB}MB` : '',
    ].filter(Boolean);
    return lines.join('\n').slice(0, 1600);
  }

  function showRecoveryOverlay(entry, opts = {}) {
    const overlay = document.getElementById('error-recovery-overlay');
    if (!overlay || overlayOpen || bugReportOpen) return;
    overlayOpen = true;
    overlay.hidden = false;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    const title = document.getElementById('error-recovery-title');
    const msg = document.getElementById('error-recovery-message');
    const detail = document.getElementById('error-recovery-detail');
    const kind = opts.kind || entry?.meta?.kind || 'error';
    if (title) {
      title.textContent =
        kind === 'freeze' ? 'Freeze Detected' : kind === 'stall' ? 'Game Stalled' : 'Recovery Mode';
    }
    if (msg) {
      if (kind === 'freeze' || kind === 'stall') {
        msg.textContent =
          'The game stopped responding for several seconds (main-thread freeze). A diagnostic report was saved — copy or export it so we can fix the cause. You can try to continue or return to the menu.';
      } else if (loopFailStreak >= LOOP_FAIL_LIMIT) {
        msg.textContent =
          'Repeated errors were detected. You can return to the menu or try to continue — non-critical systems may be disabled.';
      } else {
        msg.textContent =
          'An unexpected error occurred. The game will try to keep running with reduced effects.';
      }
    }
    if (detail) detail.textContent = formatOverlayDetail(entry);
    renderDegradedList();
    if (typeof Game !== 'undefined' && Game.setPaused) Game.setPaused(true);
    if (typeof UX !== 'undefined' && UX.closePauseMenu) UX.closePauseMenu(false);
  }

  function hideRecoveryOverlay() {
    const overlay = document.getElementById('error-recovery-overlay');
    if (!overlay) return;
    overlayOpen = false;
    overlay.hidden = true;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    loopFailStreak = 0;
    if (typeof Game !== 'undefined' && Game.isPlaying?.() && Game.setPaused) {
      Game.setPaused(false);
    }
  }

  function captureFreeze(reason, meta = {}) {
    const entry = {
      level: 'fatal',
      message: String(reason || 'main-thread freeze'),
      at: now(),
      meta: {
        kind: meta.kind || 'freeze',
        label: meta.label || 'freeze',
        phase: lastPhase,
        phaseAgeMs: lastPhaseAt ? now() - lastPhaseAt : null,
        ...meta,
        snapshot: buildGameSnapshot(),
        ...gameContext(),
      },
    };
    pushEntry(entry);
    console.error('[FREEZE]', entry.message, entry.meta);
    // Always surface freezes — local log is enough; no upload opt-in required.
    showRecoveryOverlay(entry, { kind: entry.meta.kind });
    return entry;
  }

  function captureSlowFrame(frameMs, label) {
    slowFrameStreak += 1;
    const entry = log('warn', `Slow frame: ${Math.round(frameMs)}ms @ ${lastPhase}`, {
      kind: 'slow-frame',
      label: label || 'gameLoop',
      frameMs,
      streak: slowFrameStreak,
      phase: lastPhase,
      snapshot: buildGameSnapshot(),
    });
    if (slowFrameStreak >= 2) {
      showDegradeToast(
        `Performance warning — ${Math.round(frameMs)}ms frames near "${lastPhase}". F10 = Report Bug · Settings → Export error log.`
      );
      slowFrameStreak = 0;
    }
    return entry;
  }

  function startWatchdog() {
    if (watchdogWorker || typeof Worker === 'undefined' || typeof Blob === 'undefined') return;
    try {
      const src = `
        const STALL_MS = ${STALL_MS};
        let lastBeat = Date.now();
        let reported = false;
        onmessage = (e) => {
          if (e.data && e.data.type === 'beat') {
            lastBeat = e.data.t || Date.now();
            reported = false;
          }
        };
        setInterval(() => {
          const gap = Date.now() - lastBeat;
          if (gap >= STALL_MS && !reported) {
            reported = true;
            postMessage({ type: 'stall', gapMs: gap, lastBeat });
          }
        }, 500);
      `;
      const blob = new Blob([src], { type: 'application/javascript' });
      watchdogWorker = new Worker(URL.createObjectURL(blob));
      watchdogWorker.onmessage = (e) => {
        const data = e.data || {};
        if (data.type !== 'stall') return;
        pendingStall = data;
        // Do not wait for next frame — main thread may be dead.
        try {
          flushPendingStall();
        } catch (_) {
          /* ignore */
        }
      };
      lastHeartbeatAt = now();
      lastPingAt = lastHeartbeatAt;
      watchdogWorker.postMessage({ type: 'beat', t: lastHeartbeatAt });
      log('info', 'Freeze watchdog started', { stallMs: STALL_MS });
    } catch (err) {
      log('warn', 'Freeze watchdog unavailable', { error: normalizeError(err).message });
    }
  }

  function stopWatchdog() {
    if (!watchdogWorker) return;
    watchdogWorker.terminate();
    watchdogWorker = null;
  }

  function pingWatchdog() {
    lastHeartbeatAt = now();
    lastPingAt = lastHeartbeatAt;
    try {
      watchdogWorker?.postMessage({ type: 'beat', t: lastHeartbeatAt });
    } catch (_) {
      /* ignore */
    }
  }

  function flushPendingStall() {
    if (!pendingStall) return;
    const data = pendingStall;
    pendingStall = null;
    captureFreeze(`Game stalled for ~${Math.round(data.gapMs)}ms (last phase: ${lastPhase})`, {
      kind: 'stall',
      label: 'watchdog',
      stallMs: data.gapMs,
      lastBeat: data.lastBeat,
      phase: lastPhase,
    });
  }

  function heartbeatBegin() {
    frameStartedAt = now();
    framePeakMs = 0;
    simStepIndex = 0;
    markPhase('frame-begin');
    pingWatchdog();
  }

  function heartbeatMid(label = 'mid-frame') {
    pingWatchdog();
    markPhase(label);
    if (frameStartedAt) {
      framePeakMs = Math.max(framePeakMs, now() - frameStartedAt);
    }
  }

  function noteSimStep(i, total) {
    simStepIndex = i;
    markPhase('sim-step', `${i + 1}/${total}`);
    if (i > 0 && i % 1 === 0) pingWatchdog();
  }

  function heartbeatEnd(label = 'gameLoop') {
    pingWatchdog();
    if (!frameStartedAt) return;
    const frameMs = now() - frameStartedAt;
    framePeakMs = Math.max(framePeakMs, frameMs);
    frameStartedAt = 0;
    markPhase('frame-end', `${Math.round(frameMs)}ms`);
    if (frameMs >= FREEZE_FRAME_MS) {
      captureFreeze(`Frame exceeded ${FREEZE_FRAME_MS}ms @ ${lastPhase}`, {
        kind: 'freeze',
        label,
        frameMs,
        phase: lastPhase,
      });
    } else if (frameMs >= SLOW_FRAME_MS) {
      captureSlowFrame(frameMs, label);
    } else {
      slowFrameStreak = 0;
    }
    if (pendingStall) flushPendingStall();
  }

  /** True if this frame has already spent too long — callers should skip extra sim steps. */
  function shouldSkipExtraSimSteps() {
    if (!frameStartedAt) return false;
    return now() - frameStartedAt >= SLOW_FRAME_MS;
  }

  function buildReport(extra = {}) {
    return {
      v: VERSION,
      app: 'myth-and-blood',
      appVersion: typeof window !== 'undefined' && window.MB_APP_VERSION ? window.MB_APP_VERSION : '1.0.0',
      sessionId: store.sessionId,
      exportedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      electron: !!(typeof window !== 'undefined' && window.electronAPI?.isElectron),
      degraded: getDegraded(),
      crashCount: store.crashCount || 0,
      snapshot: buildGameSnapshot(),
      entries: store.entries,
      ...extra,
    };
  }

  function openBugReport(opts = {}) {
    const overlay = document.getElementById('bug-report-overlay');
    if (!overlay || bugReportOpen) return false;
    bugReportOpen = true;
    overlay.hidden = false;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    const notes = document.getElementById('bug-report-notes');
    const preview = document.getElementById('bug-report-preview');
    if (notes && !opts.keepNotes) notes.value = opts.prefill || '';
    if (preview) {
      const snap = buildGameSnapshot();
      preview.textContent = JSON.stringify(snap, null, 2).slice(0, 1600);
    }
    if (typeof Game !== 'undefined' && Game.setPaused) Game.setPaused(true);
    if (typeof UX !== 'undefined' && UX.closePauseMenu) UX.closePauseMenu(false);
    log('info', 'Bug report opened', { source: opts.source || 'manual' });
    return true;
  }

  function closeBugReport() {
    const overlay = document.getElementById('bug-report-overlay');
    if (!overlay) return;
    bugReportOpen = false;
    overlay.hidden = true;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function submitBugReport(userNotes = '', opts = {}) {
    const notes = String(userNotes || '').trim();
    const entry = {
      level: 'error',
      message: notes || 'Manual bug report',
      at: now(),
      meta: {
        kind: 'user-report',
        label: opts.source || 'manual',
        userNotes: notes,
        snapshot: buildGameSnapshot(),
        ...gameContext(),
      },
    };
    pushEntry(entry);
    const payload = buildReport({ userReport: { notes, source: opts.source || 'manual' } });
    if (uploadEnabled) flush();
    if (opts.exportFile !== false) {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myth-and-blood-bug-report-${now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    showDegradeToast('Bug report saved and exported.');
    closeBugReport();
    return payload;
  }

  function exportLog() {
    const payload = buildReport();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myth-and-blood-error-log-${now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return payload;
  }

  async function copyReport() {
    const text = JSON.stringify(buildReport(), null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showDegradeToast('Error report copied to clipboard.');
        return true;
      }
    } catch (_) {
      /* fallback below */
    }
    exportLog();
    return false;
  }

  function clearLog() {
    store.entries = [];
    store.pendingUpload = [];
    store.crashCount = 0;
    save();
  }

  function writeElectronLog(entry) {
    if (typeof window === 'undefined' || !window.electronAPI?.writeErrorLog) return;
    window.electronAPI.writeErrorLog(entry).catch?.(() => {});
  }

  function maybeFlush() {
    const endpoint = getEndpoint();
    if (!endpoint || !uploadEnabled || !store.pendingUpload.length) return;
    const t = now();
    if (t - (store.lastUploadAt || 0) < 20000) return;
    flush();
  }

  function flush() {
    const endpoint = getEndpoint();
    if (!endpoint || !uploadEnabled || !store.pendingUpload.length) return false;
    const batch = {
      type: 'error_report',
      v: VERSION,
      sessionId: store.sessionId,
      at: now(),
      degraded: getDegraded(),
      events: store.pendingUpload.splice(0, 20),
    };
    const body = JSON.stringify(batch);
    let sent = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        sent = navigator.sendBeacon(endpoint, body);
      } else if (typeof fetch !== 'undefined') {
        fetch(endpoint, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {});
        sent = true;
      }
    } catch (_) {
      /* ignore */
    }
    if (sent) {
      store.lastUploadAt = now();
      save();
    }
    return sent;
  }

  function getRecent(limit = 8) {
    return store.entries.slice(-limit).reverse();
  }

  function renderSettings() {
    const root = document.getElementById('error-log-insights');
    if (!root) return;
    const recent = getRecent(6);
    const deg = Object.keys(degraded);
    if (!recent.length && !deg.length) {
      root.innerHTML = '<p class="analytics-muted">No errors recorded this session. Logs are kept locally for crash diagnosis.</p>';
      return;
    }
    const rows = recent
      .map((e) => {
        const when = new Date(e.at).toLocaleString();
        const sub = e.meta?.subsystem ? ` · ${e.meta.subsystem}` : '';
        return `<li class="error-log-item"><span class="error-log-level">${e.level}</span> ${e.message.slice(0, 80)}<span class="error-log-meta">${when}${sub}</span></li>`;
      })
      .join('');
    const degNote = deg.length
      ? `<p class="analytics-muted">Active degradations: ${deg.map((k) => labelForSubsystem(k)).join(', ')}</p>`
      : '';
    root.innerHTML = `${degNote}<ul class="error-log-list">${rows}</ul>`;
  }

  function bindUi() {
    document.getElementById('bug-report-submit')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      const notes = document.getElementById('bug-report-notes')?.value || '';
      submitBugReport(notes, { source: 'bug-report-ui' });
    });
    document.getElementById('bug-report-copy')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      const notes = document.getElementById('bug-report-notes')?.value || '';
      submitBugReport(notes, { source: 'bug-report-ui', exportFile: false });
      copyReport();
    });
    document.getElementById('bug-report-cancel')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      closeBugReport();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !bugReportOpen) return;
      e.preventDefault();
      closeBugReport();
    });
    document.getElementById('pause-report-bug-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      openBugReport({ source: 'pause-menu' });
    });
    document.getElementById('settings-report-bug-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      openBugReport({ source: 'settings' });
    });
    document.getElementById('error-recovery-continue')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      hideRecoveryOverlay();
    });
    document.getElementById('error-recovery-copy')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      copyReport();
    });
    document.getElementById('error-recovery-export')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      exportLog();
    });
    document.getElementById('error-recovery-menu')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      hideRecoveryOverlay();
      resetDegradation();
      if (typeof Game !== 'undefined') Game.quitToMenu?.();
    });
    document.getElementById('error-log-export-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      exportLog();
    });
    document.getElementById('error-log-clear-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      clearLog();
      resetDegradation();
      renderSettings();
    });
    document.getElementById('error-degrade-reset-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      resetDegradation();
      renderSettings();
      showDegradeToast('Feature degradations cleared.');
    });
  }

  function init() {
    load();
    installGlobalHandlers();
    syncUploadEnabled();
    bindUi();
    // Start freeze watchdog immediately — do not wait for settings.
    startWatchdog();
    markPhase('error-reporting-init');
    log('info', 'Error reporting initialized', {
      subsystems: SUBSYSTEMS,
      stallMs: STALL_MS,
      freezeFrameMs: FREEZE_FRAME_MS,
      version: VERSION,
    });
  }

  function onSettingsReady() {
    syncUploadEnabled();
    patchGame();
    patchSubsystems();
    renderSettings();
    if (!watchdogWorker) startWatchdog();
    log('info', 'Error reporting ready', { uploadEnabled, degraded: getDegraded() });
  }

  return {
    init,
    onSettingsReady,
    log,
    captureException,
    captureFreeze,
    runGuarded,
    isDegraded,
    getDegraded,
    disableSubsystem,
    resetDegradation,
    exportLog,
    copyReport,
    clearLog,
    flush,
    getRecent,
    renderSettings,
    patchGame,
    buildReport,
    buildGameSnapshot,
    heartbeatBegin,
    heartbeatMid,
    heartbeatEnd,
    noteSimStep,
    markPhase,
    getLastPhase,
    shouldSkipExtraSimSteps,
    startWatchdog,
    stopWatchdog,
    openBugReport,
    closeBugReport,
    submitBugReport,
    STALL_MS,
    SLOW_FRAME_MS,
    FREEZE_FRAME_MS,
  };
})();