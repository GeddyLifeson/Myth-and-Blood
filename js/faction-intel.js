/**
 * Host intel: who leads tomorrow's wave and how they fight, and each faction's grudge.
 * It reads only what the wave builder decided, so everything it says is true.
 */
const FactionIntel = (() => {
  const WAVE_MIN = 4;

  function isPanelOpen() {
    return document.getElementById('faction-intel-panel')?.classList.contains('open');
  }

  let focusedFactionId = null;

  function openPanel() {
    document.getElementById('faction-intel-panel')?.classList.add('open');
    AudioEngine?.SFX?.click?.();
  }

  function closePanel() {
    document.getElementById('faction-intel-panel')?.classList.remove('open');
  }

  function togglePanel() {
    if (isPanelOpen()) closePanel();
    else openPanel();
  }

  /** Highlight a faction's card when opened from elsewhere. */
  function focusFaction(factionId) {
    focusedFactionId = factionId || null;
    openPanel();
    if (typeof Game !== 'undefined' && Game.getState) {
      renderPanel(Game.getState());
    }
    if (typeof document !== 'undefined' && factionId) {
      const card =
        document.querySelector(`[data-faction-intel="${factionId}"]`) ||
        document.querySelector(`[data-faction-id="${factionId}"]`);
      card?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      card?.classList?.add('intel-focused');
    }
    return focusedFactionId;
  }

  function getAllFactionDefs() {
    if (typeof EnemyFactions === 'undefined') return [];
    return Object.values(EnemyFactions.FACTIONS).sort((a, b) => a.waveMin - b.waveMin);
  }

  /** The night preview's host report: the plan's description plus the lead's grudge. */
  function hostReport(plan, comp, scouted) {
    const d = EnemyFactions.describeHost(plan, comp, scouted);
    if (!d) return null;
    const rep = typeof FactionReputation !== 'undefined' ? FactionReputation : null;
    d.grudge = rep ? rep.getHostility(plan.leadId) : 0;
    d.stance = rep ? rep.getStance(plan.leadId).label : '';
    return d;
  }

  /** One row per faction for the panel: when it wakes, how it fights, how angry it is. */
  function buildIntelRows(gs) {
    const wave = gs.wave || 0;
    const snap = gs.enemyFactions || {};
    const activeMap = new Map((snap.activeFactions || []).map((f) => [f.id, f]));
    const repMap = new Map((gs.factionReputation?.factions || []).map((f) => [f.factionId, f]));
    return getAllFactionDefs().map((def) => {
      const active = activeMap.get(def.id);
      const rep = repMap.get(def.id);
      const tactic =
        typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionTactic(def.id) : null;
      const dormant = wave < def.waveMin;
      return {
        id: def.id,
        name: def.name,
        shortName: def.shortName,
        color: def.color,
        waveMin: def.waveMin,
        status: dormant ? 'dormant' : 'active',
        tacticName: tactic?.name || '',
        tacticDesc: tactic?.desc || '',
        counter: tactic?.counter || '',
        leadsToday: !!active?.leadsToday,
        leadsTomorrow: !!active?.leadsTomorrow,
        hostility: rep?.hostility ?? active?.hostility ?? 0,
        stanceLabel: rep?.stanceLabel ?? active?.stanceLabel ?? '',
        stanceColor: rep?.stanceColor ?? active?.stanceColor ?? '',
      };
    });
  }

  function leaderLine(gs) {
    const host = gs.nextHost;
    if (host) {
      const ally = host.allyName ? `, ${host.allyName} in support` : '';
      return `Tomorrow: ${host.factionName} lead${ally} · ${host.countText} foes`;
    }
    const today = gs.enemyFactions?.leadToday;
    const def =
      today && typeof EnemyFactions !== 'undefined'
        ? EnemyFactions.getFactionDef(today.leadId)
        : null;
    if (def) return `Today: ${def.name} lead`;
    const awake = getAllFactionDefs()
      .filter((f) => (gs.wave || 0) >= f.waveMin)
      .map((f) => f.shortName);
    return awake.length ? `Awake: ${awake.join(', ')}` : 'None';
  }

  function formatSummary(gs) {
    return leaderLine(gs);
  }

  function hexToRgba(hex, alpha = 1) {
    const h = String(hex || '#888').replace('#', '');
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(128,128,128,${alpha})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  /** One bar per faction: how full its grudge is. A full bar means it leads a revenge wave. */
  function drawGrudges(canvas, rows) {
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const shown = rows.filter((r) => r.status !== 'dormant');
    const cols = Math.max(1, shown.length);
    const colW = w / cols;
    ctx.font = '8px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200, 160, 120, 0.7)';
    ctx.fillText('GRUDGES', w / 2, 10);
    const top = 18;
    const barH = h - 36;
    shown.forEach((row, i) => {
      const x0 = colW * i + 4;
      const barW = colW - 8;
      ctx.fillStyle = 'rgba(20, 14, 10, 0.85)';
      ctx.fillRect(x0, top, barW, barH);
      const fill = (Math.max(0, Math.min(100, row.hostility)) / 100) * barH;
      ctx.fillStyle = hexToRgba(row.color, 0.7);
      ctx.fillRect(x0, top + barH - fill, barW, fill);
      ctx.strokeStyle = hexToRgba(row.color, row.leadsTomorrow ? 1 : 0.5);
      ctx.lineWidth = row.leadsTomorrow ? 2 : 1;
      ctx.strokeRect(x0, top, barW, barH);
      ctx.font = '7px Cinzel';
      ctx.fillStyle = 'rgba(255, 230, 200, 0.9)';
      ctx.fillText(String(row.hostility), colW * i + colW / 2, top + barH + 10);
      ctx.font = '6px Cinzel';
      ctx.fillStyle = hexToRgba(row.color, 0.95);
      ctx.fillText(row.shortName.slice(0, 6).toUpperCase(), colW * i + colW / 2, h - 4);
    });
  }

  function renderFactionCard(row) {
    const focused = row.id && row.id === focusedFactionId;
    const badges = [];
    if (row.leadsTomorrow)
      badges.push('<span class="intel-badge intel-badge-raid">TOMORROW</span>');
    else if (row.leadsToday) badges.push('<span class="intel-badge intel-badge-raid">TODAY</span>');
    const meta =
      row.status === 'dormant'
        ? `Wakes at wave ${row.waveMin}`
        : `<span style="color:${row.stanceColor || '#c0a060'}">${row.stanceLabel} (grudge ${row.hostility})</span>`;
    return (
      `<div class="intel-faction-card intel-card-${row.status}${focused ? ' intel-focused' : ''}" data-faction-intel="${row.id}" style="border-left-color:${row.color}">` +
      `<div class="intel-card-head">` +
      `<span class="intel-faction-name">${row.name}</span>` +
      `<span class="intel-faction-stage" style="color:${row.color}">${row.tacticName}</span>` +
      `</div>` +
      (badges.length ? `<div class="intel-badges">${badges.join('')}</div>` : '') +
      (row.status !== 'dormant' && row.counter
        ? `<p class="intel-tagline">Counter: ${row.counter}</p>`
        : '') +
      `<p class="intel-meta">${meta}</p>` +
      `</div>`
    );
  }

  function renderCompactRow(row) {
    const tag = row.status === 'dormant' ? `W${row.waveMin}` : row.leadsTomorrow ? 'next' : '';
    return (
      `<div class="intel-compact-row intel-compact-${row.status}" title="${row.name}: ${row.tacticName}\n${row.tacticDesc}">` +
      `<span class="intel-compact-dot" style="background:${row.color}"></span>` +
      `<span class="intel-compact-name">${row.shortName}</span>` +
      `<span class="intel-compact-stage" style="color:${row.color}">${tag}</span>` +
      `</div>`
    );
  }

  /** Tactic, silhouette and counter for tomorrow's host, or what is known of today's. */
  function hostDetail(gs) {
    const host = gs.nextHost;
    if (!host) {
      return 'The host is picked at nightfall. Build a Watchtower or buy a Scout Report to learn its tactic and head count.';
    }
    const how = host.scouted
      ? `${host.tacticName}: ${host.tacticDesc}`
      : `Unscouted: ${host.silhouette}. A Watchtower or a Scout Report names the tactic.`;
    return host.counter ? `${how} Counter: ${host.counter}` : how;
  }

  function makeupLine(gs) {
    const host = gs.nextHost;
    if (host && host.scouted && host.makeup.length) {
      return host.makeup.map((m) => `${m.n} ${m.name}`).join(', ');
    }
    return host ? 'Exact head count by kind needs a Watchtower or a Scout Report.' : '';
  }

  function renderPanel(gs) {
    const rows = buildIntelRows(gs);
    const summary = leaderLine(gs);
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('faction-intel-summary', summary);
    set('faction-intel-host', hostDetail(gs));
    set('faction-intel-roster', makeupLine(gs));
    const listEl = document.getElementById('faction-intel-list');
    if (listEl) listEl.innerHTML = rows.map(renderFactionCard).join('');
    drawGrudges(document.getElementById('faction-intel-map'), rows);

    const section = document.getElementById('faction-intel-section');
    if (section) section.style.display = (gs.wave || 0) >= WAVE_MIN ? '' : 'none';
    set('faction-intel-compact-summary', summary);
    const compactList = document.getElementById('faction-intel-compact-list');
    if (compactList) {
      compactList.innerHTML = rows
        .filter((r) => r.status !== 'dormant' || (gs.wave || 0) >= r.waveMin - 6)
        .map(renderCompactRow)
        .join('');
    }
  }

  function getStateSnapshot(gs) {
    const rows = buildIntelRows(gs);
    return {
      active: (gs.wave || 0) >= WAVE_MIN,
      waveMin: WAVE_MIN,
      summary: leaderLine(gs),
      factions: rows,
      activeCount: rows.filter((r) => r.status === 'active').length,
    };
  }

  /** The panel's fixed labels live in index.html; this renames them to what the panel now shows. */
  function relabel() {
    const text = (sel, value) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = value;
    };
    text('.faction-intel-title', "TOMORROW'S HOST");
    text(
      '.faction-intel-map-legend',
      'Bars show each faction’s grudge. A full bar means it leads a revenge wave.'
    );
    text('#faction-intel-section .panel-header', 'TOMORROW');
    text('#faction-intel-open-btn', 'HOST DETAILS');
  }

  function init() {
    relabel();
    document.getElementById('faction-intel-btn')?.addEventListener('click', () => {
      togglePanel();
      if (isPanelOpen() && typeof Game !== 'undefined') {
        renderPanel(Game.getState());
      }
    });
    document.getElementById('faction-intel-open-btn')?.addEventListener('click', () => {
      openPanel();
      if (typeof Game !== 'undefined') renderPanel(Game.getState());
    });
    document.getElementById('faction-intel-close')?.addEventListener('click', () => {
      closePanel();
      AudioEngine?.SFX?.click?.();
    });
    document.getElementById('host-faction-text')?.addEventListener('click', () => {
      if (!Game?.isPlaying?.()) return;
      openPanel();
      renderPanel(Game.getState());
    });
  }

  return {
    WAVE_MIN,
    init,
    openPanel,
    closePanel,
    togglePanel,
    isPanelOpen,
    focusFaction,
    buildIntelRows,
    formatSummary,
    hostReport,
    renderPanel,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FactionIntel = FactionIntel;
