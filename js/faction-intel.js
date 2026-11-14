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

  // ------------------------------------------------------------ what is true now
  /**
   * The Threat Map shows what exists: where the next wave enters, the war camps standing at
   * the top edge and what each adds. The old stage bars and building counts described a
   * northern kingdom that is never built, so they are gone from the panel.
   */
  const SECTOR_IDS = ['left', 'centre', 'right'];

  function campState() {
    if (typeof WarCamps === 'undefined' || typeof GameState === 'undefined') return null;
    return WarCamps.getSnapshot({ buildings: GameState.buildings, wave: GameState.wave });
  }

  /** Sectors the coming (night) or current (day) wave uses; null when the plan has none. */
  function activeSectors() {
    if (typeof WarCamps === 'undefined' || typeof GameState === 'undefined') return null;
    return WarCamps.planSectors(
      GameState.timeOfDay === 'night' ? GameState.nextWavePlan : GameState.sectorPlan
    );
  }

  function sectorLine(gs) {
    const sectors = activeSectors();
    const night = gs.timeOfDay === 'night';
    if (sectors) {
      return `${night ? 'The next wave enters' : 'This wave entered'} by the ${sectors.join(' and ')} of the top edge.`;
    }
    return `${night ? 'The next wave comes' : 'This wave came'} from the top edge.`;
  }

  function drawSectorMap(canvas, camps, sectors) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const INK = '#07050a';
    const BONE = '#e4dcc4';
    const BLOOD = '#a01018';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#14100f';
    ctx.fillRect(0, 0, w, h);
    const third = w / 3;
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const on = !sectors || sectors.includes(SECTOR_IDS[i]);
      ctx.fillStyle = on ? 'rgba(160,16,24,0.34)' : 'rgba(228,220,196,0.05)';
      ctx.fillRect(i * third + 2, 2, third - 4, h - 20);
      ctx.strokeStyle = on ? BLOOD : '#4c4841';
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(i * third + 2, 2, third - 4, h - 20);
      ctx.fillStyle = on ? BONE : '#777266';
      ctx.fillText(
        `${SECTOR_IDS[i].toUpperCase()}${sectors ? (on ? ': host enters' : ': quiet') : ''}`,
        i * third + third / 2,
        h - 6
      );
      if (on) {
        // chevrons pointing down the field
        ctx.strokeStyle = BLOOD;
        ctx.lineWidth = 2;
        for (let c = 0; c < 2; c++) {
          const cy = h - 40 + c * 8;
          ctx.beginPath();
          ctx.moveTo(i * third + third / 2 - 9, cy - 5);
          ctx.lineTo(i * third + third / 2, cy);
          ctx.lineTo(i * third + third / 2 + 9, cy - 5);
          ctx.stroke();
        }
      }
    }
    const worldW = (typeof GameState !== 'undefined' && GameState.worldW) || 1;
    for (const c of camps) {
      const x = Math.max(34, Math.min(w - 34, (c.x / worldW) * w));
      const y = 24;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x - 11, y + 9);
      ctx.lineTo(x, y - 10);
      ctx.lineTo(x + 11, y + 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#ff8a30';
      ctx.beginPath();
      ctx.arc(x, y + 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BONE;
      ctx.fillText(c.name, x, y + 24);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 20, y + 29, 40, 5);
      ctx.fillStyle = BLOOD;
      ctx.fillRect(x - 20, y + 29, 40 * (c.maxHp ? c.hp / c.maxHp : 0), 5);
    }
    ctx.textAlign = 'left';
  }

  function renderCampCard(c) {
    const line = c.sabotaged ? 'sabotaged: no bonus this wave' : c.line;
    return (
      `<div class="intel-faction-card intel-card-active" style="border-left-color:#a01018">` +
      `<div class="intel-card-head"><span class="intel-faction-name">${c.name}</span>` +
      `<span class="intel-faction-stage" style="color:#e4dcc4">${c.sector} of the top edge</span></div>` +
      `<p class="intel-tagline">Next wave: ${line}.</p>` +
      `<p class="intel-meta">Health ${c.hp}/${c.maxHp} · ${c.guards} guard${c.guards === 1 ? '' : 's'} · ` +
      `bounty ${c.bounty} TP · ${c.wavesLeft > 0 ? `stands ${c.wavesLeft} more wave${c.wavesLeft === 1 ? '' : 's'}` : 'packs up after this wave'}</p>` +
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
    const camps = campState();
    const list = camps ? camps.camps : [];
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('faction-intel-summary', summary);
    set('faction-intel-host', `${hostDetail(gs)} ${sectorLine(gs)}`);
    set('faction-intel-roster', makeupLine(gs));
    const legendEl = document.querySelector?.('.faction-intel-map-legend');
    if (legendEl) {
      legendEl.textContent =
        'The top edge in three sectors. Red: the host enters there. A tent with a fire: a war camp.';
    }
    const fromWave = camps ? camps.fromWave : 6;
    const none =
      (gs.wave || 0) + 1 < fromWave
        ? `No war camps yet. From wave ${fromWave} the enemy may raise one at nightfall.`
        : 'No war camp stands tonight.';
    const how =
      'A camp is attacked only on your order: select soldiers and move them onto it (cavalry get there first, Sappers hit hardest), land a strike on it, or send the spy’s raid. Burn it before dawn and its bonus is gone.';
    const live =
      camps && camps.active.length
        ? ` In force this wave: ${camps.active.map((a) => `${a.name}: ${a.line}`).join('; ')}.`
        : '';
    const raid =
      camps && camps.raid
        ? camps.raid.waiting
          ? ' A raid rides at nightfall.'
          : ' Raiders are on their way.'
        : '';
    const listEl = document.getElementById('faction-intel-list');
    if (listEl) {
      listEl.innerHTML =
        (list.length ? list.map(renderCampCard).join('') : `<p class="intel-tagline">${none}</p>`) +
        `<p class="intel-meta">${how}${live}${raid}</p>` +
        rows.map(renderFactionCard).join('');
    }
    drawSectorMap(document.getElementById('faction-intel-map'), list, activeSectors());

    const section = document.getElementById('faction-intel-section');
    if (section) section.style.display = (gs.wave || 0) >= WAVE_MIN ? '' : 'none';
    set('faction-intel-compact-summary', summary);
    const compactList = document.getElementById('faction-intel-compact-list');
    if (compactList) {
      compactList.innerHTML =
        list
          .map(
            (c) =>
              `<div class="intel-compact-row intel-compact-active"><span class="intel-compact-dot" style="background:#a01018"></span>` +
              `<span class="intel-compact-name">${c.name} (${c.sector})</span>` +
              `<span class="intel-compact-stage">${c.sabotaged ? 'sabotaged' : c.line}</span></div>`
          )
          .join('') +
        rows
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
