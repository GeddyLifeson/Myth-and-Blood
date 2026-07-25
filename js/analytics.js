/**
 * Opt-in anonymous analytics — popular strategies and drop-off waves.
 * No account, no names, no save data. Aggregates locally; optional beacon upload.
 */
const Analytics = (() => {
  const STORAGE_KEY = 'myth-and-blood-analytics-v1';
  const VERSION = 1;
  const FUNNEL_WAVES = [5, 10, 25, 50, 100, 200, 500];
  const DROP_BUCKETS = [
    { id: 'w1-9', min: 1, max: 9, label: 'Waves 1–9' },
    { id: 'w10-24', min: 10, max: 24, label: 'Waves 10–24' },
    { id: 'w25-49', min: 25, max: 49, label: 'Waves 25–49' },
    { id: 'w50-99', min: 50, max: 99, label: 'Waves 50–99' },
    { id: 'w100-199', min: 100, max: 199, label: 'Waves 100–199' },
    { id: 'w200-499', min: 200, max: 499, label: 'Waves 200–499' },
    { id: 'w500+', min: 500, max: Infinity, label: 'Wave 500+' },
  ];

  let store = {
    cohortId: null,
    runs: 0,
    outcomes: { victory: 0, defeat: 0, quit: 0 },
    dropOff: {},
    funnel: {},
    loadouts: {},
    formations: {},
    kingdomDoctrines: {},
    counterDoctrines: {},
    pendingEvents: [],
    lastFlushAt: 0,
  };

  let session = null;
  let enabled = false;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store = { ...store, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    if (!store.cohortId) {
      store.cohortId = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    ensureBuckets();
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {
      /* ignore */
    }
  }

  function ensureBuckets() {
    for (const b of DROP_BUCKETS) {
      if (!store.dropOff[b.id]) store.dropOff[b.id] = 0;
    }
    for (const w of FUNNEL_WAVES) {
      const key = String(w);
      if (!store.funnel[key]) store.funnel[key] = 0;
    }
  }

  function bump(map, key, n = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + n;
  }

  function dropBucket(wave) {
    const w = Math.max(1, Math.floor(wave || 1));
    for (const b of DROP_BUCKETS) {
      if (w >= b.min && w <= b.max) return b.id;
    }
    return 'w500+';
  }

  function getEndpoint() {
    if (typeof window !== 'undefined' && window.MB_ANALYTICS_ENDPOINT) {
      return String(window.MB_ANALYTICS_ENDPOINT);
    }
    return '';
  }

  function isEnabled() {
    return enabled;
  }

  function syncEnabled() {
    enabled =
      typeof Settings !== 'undefined' && Settings.get
        ? !!Settings.get('analyticsOptIn')
        : false;
    if (!enabled) session = null;
  }

  function init() {
    load();
    syncEnabled();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) session = null;
  }

  function beginSession(ctx = {}) {
    if (!enabled || ctx.creative) return;
    session = {
      startedAt: Date.now(),
      modeId: ctx.modeId || 'campaign',
      difficulty: ctx.difficulty || 'normal',
      difficultyPct: Math.round(ctx.difficultyPct || 100),
      maxWave: 0,
      loadouts: {},
      formations: {},
      kingdomDoctrines: [],
      counterDoctrines: [],
      funnelReached: {},
      loadout: ctx.loadout || 'balanced',
    };
    bump(session.loadouts, session.loadout);
    bump(session.formations, ctx.formation || 'box');
  }

  function onRunStart(ctx = {}) {
    if (!enabled) return;
    beginSession(ctx);
    queueEvent('run_start', {
      modeId: ctx.modeId,
      difficulty: ctx.difficulty,
      difficultyPct: ctx.difficultyPct,
    });
  }

  function onWaveReached(wave) {
    if (!enabled || !session) return;
    const w = Math.max(0, Math.floor(wave || 0));
    session.maxWave = Math.max(session.maxWave, w);
    for (const milestone of FUNNEL_WAVES) {
      const key = String(milestone);
      if (w >= milestone && !session.funnelReached[key]) {
        session.funnelReached[key] = true;
        bump(store.funnel, key);
      }
    }
  }

  function onFormationUsed(id) {
    if (!enabled || !session || !id) return;
    bump(session.formations, id);
  }

  function onLoadoutChange(id) {
    if (!enabled || !session || !id) return;
    session.loadout = id;
    bump(session.loadouts, id);
  }

  function onKingdomDoctrine(id) {
    if (!enabled || !session || !id) return;
    if (!session.kingdomDoctrines.includes(id)) session.kingdomDoctrines.push(id);
  }

  function onCounterDoctrine(id) {
    if (!enabled || !session || !id) return;
    if (!session.counterDoctrines.includes(id)) session.counterDoctrines.push(id);
  }

  function finalizeRun(payload = {}) {
    if (!enabled || !session) return;
    const wave = Math.max(session.maxWave, Math.floor(payload.wave || 0));
    const reason = payload.reason || (payload.victory ? 'victory' : 'defeat');

    store.runs += 1;
    bump(store.outcomes, reason);
    bump(store.dropOff, dropBucket(wave));

    let topLoadout = session.loadout || 'balanced';
    let topLoadoutCount = session.loadouts[topLoadout] || 0;
    for (const [id, count] of Object.entries(session.loadouts)) {
      if (count > topLoadoutCount) {
        topLoadout = id;
        topLoadoutCount = count;
      }
    }
    bump(store.loadouts, topLoadout);

    let topFormation = 'box';
    let topFormationCount = 0;
    let lastFormation = 'box';
    for (const [id, count] of Object.entries(session.formations)) {
      if (count >= topFormationCount) {
        topFormation = id;
        topFormationCount = count;
        lastFormation = id;
      }
    }
    if (topFormationCount <= 1) topFormation = lastFormation;
    bump(store.formations, topFormation);

    for (const id of session.kingdomDoctrines) bump(store.kingdomDoctrines, id);
    for (const id of session.counterDoctrines) bump(store.counterDoctrines, id);

    queueEvent('run_end', {
      reason,
      wave,
      modeId: session.modeId,
      difficulty: session.difficulty,
      difficultyPct: session.difficultyPct,
      loadout: topLoadout,
      formation: topFormation,
      kingdomDoctrines: session.kingdomDoctrines,
      counterDoctrines: session.counterDoctrines,
      victoryReason: payload.victoryReason || null,
    });

    session = null;
    save();
    maybeFlush();
  }

  function onRunEnd(stats = {}) {
    if (!enabled) return;
    finalizeRun({
      wave: stats.wave,
      victory: stats.victory,
      reason: stats.victory ? 'victory' : 'defeat',
      victoryReason: stats.victoryReason,
    });
  }

  function onRunAbandon(wave) {
    if (!enabled || !session) return;
    finalizeRun({ wave, reason: 'quit' });
  }

  function queueEvent(type, data) {
    store.pendingEvents.push({ type, at: Date.now(), ...data });
    if (store.pendingEvents.length > 80) store.pendingEvents = store.pendingEvents.slice(-80);
    save();
  }

  function maybeFlush() {
    const endpoint = getEndpoint();
    if (!endpoint || !enabled || !store.pendingEvents.length) return;
    const now = Date.now();
    if (now - (store.lastFlushAt || 0) < 15000) return;
    flush();
  }

  function flush() {
    const endpoint = getEndpoint();
    if (!endpoint || !enabled || !store.pendingEvents.length) return false;
    const batch = {
      v: VERSION,
      cohortId: store.cohortId,
      aggregates: {
        runs: store.runs,
        outcomes: store.outcomes,
        dropOff: store.dropOff,
        loadouts: store.loadouts,
        formations: store.formations,
      },
      events: store.pendingEvents.splice(0, 40),
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
      store.lastFlushAt = Date.now();
      save();
    }
    return sent;
  }

  function clearLocal() {
    const cohortId = store.cohortId;
    store = {
      cohortId,
      runs: 0,
      outcomes: { victory: 0, defeat: 0, quit: 0 },
      dropOff: {},
      funnel: {},
      loadouts: {},
      formations: {},
      kingdomDoctrines: {},
      counterDoctrines: {},
      pendingEvents: [],
      lastFlushAt: 0,
    };
    ensureBuckets();
    session = null;
    save();
  }

  function topEntries(map, limit = 5) {
    return Object.entries(map || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function formatLoadout(id) {
    const lo =
      typeof ContentExpansion !== 'undefined' ? ContentExpansion.getLoadouts()?.[id] : null;
    return lo?.label || id;
  }

  function formatFormation(id) {
    return typeof Formations !== 'undefined' ? Formations.getLabel(id) : id;
  }

  function getInsights() {
    const dropTotal = Object.values(store.dropOff).reduce((a, b) => a + b, 0) || 1;
    const dropOff = DROP_BUCKETS.map((b) => ({
      id: b.id,
      label: b.label,
      count: store.dropOff[b.id] || 0,
      pct: Math.round(((store.dropOff[b.id] || 0) / dropTotal) * 100),
    }));
    const funnel = FUNNEL_WAVES.map((w) => ({
      wave: w,
      count: store.funnel[String(w)] || 0,
      pct: store.runs ? Math.round(((store.funnel[String(w)] || 0) / store.runs) * 100) : 0,
    }));
    return {
      enabled,
      runs: store.runs,
      outcomes: { ...store.outcomes },
      dropOff,
      funnel,
      loadouts: topEntries(store.loadouts).map(([id, count]) => ({
        id,
        label: formatLoadout(id),
        count,
      })),
      formations: topEntries(store.formations).map(([id, count]) => ({
        id,
        label: formatFormation(id),
        count,
      })),
      kingdomDoctrines: topEntries(store.kingdomDoctrines, 4),
      counterDoctrines: topEntries(store.counterDoctrines, 4),
      hasEndpoint: !!getEndpoint(),
    };
  }

  function renderSettings() {
    const root = document.getElementById('analytics-insights');
    if (!root) return;
    if (!enabled) {
      root.innerHTML =
        '<p class="analytics-muted">Enable anonymous analytics above to contribute strategy and drop-off trends. No personal data is collected.</p>';
      return;
    }
    const ins = getInsights();
    if (!ins.runs) {
      root.innerHTML =
        '<p class="analytics-muted">No runs recorded yet — finish or abandon a campaign to populate local trends.</p>';
      return;
    }
    const bar = (pct) => {
      const w = Math.max(4, Math.min(100, pct));
      return `<span class="analytics-bar" style="width:${w}%"></span>`;
    };
    const dropRows = ins.dropOff
      .filter((d) => d.count > 0)
      .map(
        (d) =>
          `<div class="analytics-row"><span class="analytics-label">${d.label}</span><span class="analytics-bar-wrap">${bar(d.pct)}</span><span class="analytics-val">${d.count} (${d.pct}%)</span></div>`
      )
      .join('');
    const loadoutRows = ins.loadouts
      .map((l) => `<li>${l.label} — ${l.count} run${l.count === 1 ? '' : 's'}</li>`)
      .join('');
    const formationRows = ins.formations
      .map((f) => `<li>${f.label} — ${f.count} run${f.count === 1 ? '' : 's'}</li>`)
      .join('');
    const funnelRows = ins.funnel
      .map(
        (f) =>
          `<div class="analytics-row"><span class="analytics-label">Wave ${f.wave}+</span><span class="analytics-bar-wrap">${bar(f.pct)}</span><span class="analytics-val">${f.pct}%</span></div>`
      )
      .join('');
    root.innerHTML = `
      <p class="analytics-summary">${ins.runs} anonymous run${ins.runs === 1 ? '' : 's'} · ${ins.outcomes.victory} wins · ${ins.outcomes.defeat} defeats · ${ins.outcomes.quit} quits</p>
      <div class="analytics-section"><div class="analytics-section-head">Drop-off waves</div>${dropRows || '<p class="analytics-muted">No drop-offs yet.</p>'}</div>
      <div class="analytics-section"><div class="analytics-section-head">Survival funnel</div>${funnelRows}</div>
      <div class="analytics-section"><div class="analytics-section-head">Popular loadouts</div><ul class="analytics-list">${loadoutRows || '<li>—</li>'}</ul></div>
      <div class="analytics-section"><div class="analytics-section-head">Popular formations</div><ul class="analytics-list">${formationRows || '<li>—</li>'}</ul></div>
      ${ins.hasEndpoint ? '<p class="analytics-muted">Aggregates may sync anonymously when online.</p>' : ''}
    `;
  }

  function bindSettings() {
    document.getElementById('analytics-clear-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      clearLocal();
      renderSettings();
    });
    document.getElementById('analytics-export-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      const payload = { v: VERSION, cohortId: store.cohortId, ...getInsights(), store };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'myth-and-blood-analytics-export.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return {
    init,
    isEnabled,
    setEnabled,
    syncEnabled,
    onRunStart,
    onWaveReached,
    onFormationUsed,
    onLoadoutChange,
    onKingdomDoctrine,
    onCounterDoctrine,
    onRunEnd,
    onRunAbandon,
    getInsights,
    renderSettings,
    bindSettings,
    clearLocal,
    flush,
  };
})();