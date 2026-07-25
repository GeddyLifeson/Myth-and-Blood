/**
 * Threat Map / Faction Intel — active hostile realms, evolution stages, and pressure.
 */
const FactionIntel = (() => {
  const WAVE_MIN = 4;
  const STAGE_LABELS = ['Grunts', 'Elites', 'Forts', 'Kingdom'];

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

  /** Highlight a realm card when opened from planet map intel verb (§6). */
  function focusFaction(factionId) {
    focusedFactionId = factionId || null;
    openPanel();
    if (typeof Game !== 'undefined' && Game.getState) {
      renderPanel(Game.getState());
    }
    // Scroll to matching card after render.
    if (typeof document !== 'undefined' && factionId) {
      const card =
        document.querySelector(`[data-faction-intel="${factionId}"]`) ||
        document.querySelector(`[data-faction-id="${factionId}"]`);
      card?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      card?.classList?.add('intel-focused');
    }
    return focusedFactionId;
  }

  function getFocusedFaction() {
    return focusedFactionId;
  }

  function getAllFactionDefs() {
    if (typeof EnemyFactions === 'undefined') return [];
    return Object.values(EnemyFactions.FACTIONS).sort((a, b) => a.waveMin - b.waveMin);
  }

  function isEliminated(factionId, gs) {
    if (gs.planetConquest?.sectors) {
      const s = gs.planetConquest.sectors.find((sec) => sec.factionId === factionId);
      if (s?.eliminated) return true;
    }
    return typeof PlanetConquest !== 'undefined' && PlanetConquest.isFactionEliminated?.(factionId);
  }

  function buildIntelRows(gs) {
    const wave = gs.wave || 0;
    const activeMap = new Map((gs.enemyFactions?.activeFactions || []).map((f) => [f.id, f]));
    const conquestMap = new Map((gs.planetConquest?.sectors || []).map((s) => [s.factionId, s]));
    const counterMap = new Map((gs.counterEvolution?.targets || []).map((t) => [t.factionId, t]));
    const frontMap = new Map((gs.multiFrontSiege?.assignments || []).map((a) => [a.factionId, a]));
    const repMap = new Map((gs.factionReputation?.factions || []).map((f) => [f.factionId, f]));

    return getAllFactionDefs().map((def) => {
      const active = activeMap.get(def.id);
      const eliminated = isEliminated(def.id, gs);
      const dormant = wave < def.waveMin;
      const tier = active
        ? {
            stage: active.stage,
            tierLabel: active.tierLabel,
            tagline: active.tagline,
            counterRaids: active.counterRaids,
            buildingCount: active.buildingCount,
          }
        : !dormant && !eliminated && typeof EnemyFactions !== 'undefined'
          ? (() => {
              const t = EnemyFactions.getFactionTier(def.id, wave);
              return t
                ? {
                    stage: t.stage,
                    tierLabel: t.stageLabel || t.label,
                    tagline: t.tagline,
                    counterRaids: t.counterRaids,
                    buildingCount: 0,
                  }
                : null;
            })()
          : null;

      const counter = counterMap.get(def.id);
      const front = frontMap.get(def.id);
      const rep = repMap.get(def.id);
      const conquest = conquestMap.get(def.id);
      const baseStage = tier?.stage || 0;
      const effectiveStage = counter?.effectiveStage ?? baseStage;

      let status = 'dormant';
      if (eliminated) status = 'eliminated';
      else if (dormant) status = 'dormant';
      else if (active || tier) status = counter?.debuffed ? 'weakened' : 'active';

      return {
        id: def.id,
        name: def.name,
        shortName: def.shortName,
        color: def.color,
        waveMin: def.waveMin,
        status,
        stage: baseStage,
        effectiveStage,
        maxStage: 4,
        tierLabel: tier?.tierLabel || '—',
        tagline: tier?.tagline || '',
        buildingCount: tier?.buildingCount ?? 0,
        counterRaids: !!tier?.counterRaids,
        debuffed: !!counter?.debuffed,
        debuffNote: counter?.debuffNote || '',
        hostility: rep?.hostility ?? active?.hostility,
        stanceLabel: rep?.stanceLabel ?? active?.stanceLabel,
        stanceColor: rep?.stanceColor ?? active?.stanceColor,
        evolutionOffset: rep?.evolutionOffset ?? active?.evolutionOffset ?? 0,
        economicFocus: !!(rep?.economicFocus ?? active?.economicFocus),
        conquestPct: conquest?.playerControl,
        conquestEliminated: !!conquest?.eliminated,
        frontLabel: front?.frontLabel || null,
        doctrineLabel: front?.doctrineLabel || null,
        multiFrontMode: gs.multiFrontSiege?.mode || null,
      };
    });
  }

  function formatSummary(gs) {
    const rows = buildIntelRows(gs);
    const active = rows.filter((r) => r.status === 'active' || r.status === 'weakened');
    if (!active.length) {
      const next = rows.find((r) => r.status === 'dormant');
      return next
        ? `Host dormant — ${next.shortName} at wave ${next.waveMin}`
        : 'No hostile factions';
    }
    const peak = active.reduce((best, r) => (!best || r.stage > best.stage ? r : best), null);
    const weakened = active.filter((r) => r.debuffed).length;
    const raids = active.filter((r) => r.counterRaids).map((r) => r.shortName);
    let s = active
      .map((r) => `${r.shortName} S${r.debuffed ? r.effectiveStage : r.stage}`)
      .join(' · ');
    if (weakened) s += ` · ${weakened} weakened`;
    if (raids.length) s += ` · Raids: ${raids.join(', ')}`;
    if (peak?.stage >= 4) s = `Kingdom host — ${s}`;
    return s;
  }

  function drawThreatMap(canvas, rows, gs) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const visible = rows.filter((r) => r.status !== 'dormant' || (gs.wave || 0) >= r.waveMin - 8);
    const cols = Math.max(1, visible.length);
    const colW = w / cols;
    const mapTop = 18;
    const mapH = h - 36;

    ctx.font = '8px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200, 160, 120, 0.7)';
    ctx.fillText('— NORTH / HOST SECTORS —', w / 2, 10);

    for (let i = 0; i < visible.length; i++) {
      const row = visible[i];
      const cx = colW * i + colW / 2;
      const x0 = colW * i + 4;
      const barW = colW - 8;

      ctx.fillStyle = 'rgba(20, 14, 10, 0.85)';
      ctx.fillRect(x0, mapTop, barW, mapH);
      ctx.strokeStyle =
        row.status === 'eliminated'
          ? 'rgba(120, 255, 160, 0.5)'
          : hexToRgba(row.color, row.status === 'dormant' ? 0.25 : 0.55);
      ctx.lineWidth = row.counterRaids ? 2 : 1;
      ctx.strokeRect(x0, mapTop, barW, mapH);

      const stage = row.status === 'eliminated' ? 4 : row.debuffed ? row.effectiveStage : row.stage;
      const segH = mapH / 4;
      for (let s = 0; s < 4; s++) {
        const sy = mapTop + mapH - (s + 1) * segH;
        const filled = s < stage;
        ctx.fillStyle = filled
          ? hexToRgba(row.color, row.status === 'dormant' ? 0.2 : 0.55 + s * 0.08)
          : 'rgba(30, 24, 18, 0.6)';
        ctx.fillRect(x0 + 2, sy + 1, barW - 4, segH - 2);
        if (filled && s === 3 && row.counterRaids) {
          ctx.fillStyle = 'rgba(255, 80, 60, 0.35)';
          ctx.fillRect(x0 + 2, sy + 1, barW - 4, segH - 2);
        }
      }

      if (row.conquestPct != null && row.status !== 'eliminated' && gs.planetConquest?.active) {
        const conqH = mapH * (row.conquestPct / 100);
        ctx.fillStyle = 'rgba(80, 200, 120, 0.28)';
        ctx.fillRect(x0 + 2, mapTop + mapH - conqH, barW - 4, conqH);
      }

      if (row.status === 'eliminated') {
        ctx.strokeStyle = 'rgba(120, 255, 160, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 + 6, mapTop + 8);
        ctx.lineTo(x0 + barW - 6, mapTop + mapH - 8);
        ctx.moveTo(x0 + barW - 6, mapTop + 8);
        ctx.lineTo(x0 + 6, mapTop + mapH - 8);
        ctx.stroke();
      }

      ctx.font = '7px Cinzel';
      ctx.fillStyle =
        row.status === 'dormant' ? 'rgba(120, 110, 100, 0.8)' : 'rgba(255, 230, 200, 0.9)';
      const stageText =
        row.status === 'dormant'
          ? `W${row.waveMin}`
          : row.status === 'eliminated'
            ? 'FALLEN'
            : row.debuffed
              ? `S${row.effectiveStage}/${row.stage}`
              : `S${row.stage}`;
      ctx.fillText(stageText, cx, mapTop + mapH + 10);

      ctx.font = '6px Cinzel';
      ctx.fillStyle = hexToRgba(row.color, 0.95);
      const label = row.shortName.slice(0, 6).toUpperCase();
      ctx.fillText(label, cx, h - 4);
    }
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

  function renderStageBar(stage, effectiveStage, debuffed, color) {
    const s = debuffed ? effectiveStage : stage;
    const cells = [];
    for (let i = 1; i <= 4; i++) {
      const on = i <= s;
      const peak = i <= stage && debuffed && i > effectiveStage;
      cells.push(
        `<span class="intel-stage-cell${on ? ' on' : ''}${peak ? ' peak' : ''}"` +
          ` style="${on ? `background:${color}88;border-color:${color}` : ''}"` +
          ` title="${STAGE_LABELS[i - 1] || `Stage ${i}`}"></span>`
      );
    }
    return `<div class="intel-stage-bar">${cells.join('')}</div>`;
  }

  function renderFactionCard(row) {
    const fid = row.factionId || row.id;
    const focused = fid && fid === focusedFactionId;
    const statusClass = `intel-card-${row.status}${focused ? ' intel-focused' : ''}`;
    const badges = [];
    if (row.debuffed) badges.push('<span class="intel-badge intel-badge-weak">WEAKENED</span>');
    if (row.counterRaids)
      badges.push('<span class="intel-badge intel-badge-raid">COUNTER-RAIDS</span>');
    if (row.economicFocus)
      badges.push('<span class="intel-badge intel-badge-eco">ECO FOCUS</span>');
    if (row.status === 'eliminated')
      badges.push('<span class="intel-badge intel-badge-fallen">ELIMINATED</span>');
    if (row.conquestPct != null && row.status !== 'eliminated') {
      badges.push(`<span class="intel-badge intel-badge-conquest">${row.conquestPct}% SEC</span>`);
    }

    const meta = [];
    if (row.status === 'dormant') {
      meta.push(`Awakens wave ${row.waveMin}`);
    } else if (row.status !== 'eliminated') {
      if (row.buildingCount)
        meta.push(`${row.buildingCount} northern site${row.buildingCount > 1 ? 's' : ''}`);
      if (row.stanceLabel) {
        meta.push(
          `<span style="color:${row.stanceColor || '#c0a060'}">${row.stanceLabel}` +
            `${row.hostility != null ? ` (${row.hostility})` : ''}</span>`
        );
      }
      if (row.evolutionOffset) {
        meta.push(`evo ${row.evolutionOffset > 0 ? '+' : ''}${row.evolutionOffset}`);
      }
      if (row.frontLabel) meta.push(`Front: ${row.frontLabel}`);
      if (row.doctrineLabel) meta.push(row.doctrineLabel);
    }

    const stageTitle =
      row.status === 'dormant'
        ? 'Not yet active'
        : row.debuffed
          ? `Effective Stage ${row.effectiveStage} (was ${row.stage}) — ${row.tierLabel}`
          : `Stage ${row.stage} — ${row.tierLabel}`;

    return (
      `<div class="intel-faction-card ${statusClass}" data-faction-intel="${fid || ''}" style="border-left-color:${row.color}">` +
      `<div class="intel-card-head">` +
      `<span class="intel-faction-name">${row.name}</span>` +
      `<span class="intel-faction-stage" style="color:${row.color}">${stageTitle}</span>` +
      `</div>` +
      (row.status !== 'dormant' && row.status !== 'eliminated'
        ? renderStageBar(row.stage, row.effectiveStage, row.debuffed, row.color)
        : '') +
      (badges.length ? `<div class="intel-badges">${badges.join('')}</div>` : '') +
      (row.tagline && row.status !== 'dormant'
        ? `<p class="intel-tagline">${row.tagline}</p>`
        : '') +
      (meta.length ? `<p class="intel-meta">${meta.join(' · ')}</p>` : '') +
      `</div>`
    );
  }

  function renderCompactRow(row) {
    const stage = row.debuffed ? row.effectiveStage : row.stage;
    const cls = `intel-compact-row intel-compact-${row.status}`;
    const extra = row.counterRaids ? ' ⚔' : row.debuffed ? ' ↓' : '';
    const dorm = row.status === 'dormant' ? `W${row.waveMin}` : `S${stage}${extra}`;
    return (
      `<div class="${cls}" title="${row.name} — ${row.tierLabel}\n${row.tagline || ''}">` +
      `<span class="intel-compact-dot" style="background:${row.color}"></span>` +
      `<span class="intel-compact-name">${row.shortName}</span>` +
      `<span class="intel-compact-stage" style="color:${row.color}">${dorm}</span>` +
      `</div>`
    );
  }

  function renderPanel(gs) {
    const rows = buildIntelRows(gs);
    const summary = formatSummary(gs);
    const hostLevel = gs.asymmetricWarfare?.hostThreatLevel;
    const hostLabel = gs.asymmetricWarfare?.hostLevelLabel;
    const roster = gs.enemyFactions?.rosterIntel || gs.nextWaveIntel || '';

    const summaryEl = document.getElementById('faction-intel-summary');
    const listEl = document.getElementById('faction-intel-list');
    const mapCanvas = document.getElementById('faction-intel-map');
    const hostEl = document.getElementById('faction-intel-host');
    const rosterEl = document.getElementById('faction-intel-roster');
    const compactSummary = document.getElementById('faction-intel-compact-summary');
    const compactList = document.getElementById('faction-intel-compact-list');

    if (summaryEl) summaryEl.textContent = summary;
    if (hostEl) {
      hostEl.textContent = hostLevel
        ? `Host Threat Lv${hostLevel} — ${hostLabel || 'Evolving'}`
        : 'Host threat escalates as factions evolve and build in the north.';
    }
    if (rosterEl)
      rosterEl.textContent = roster || 'Roster reveals at dawn or via Scout/Infiltrate.';
    if (listEl) {
      listEl.innerHTML = rows.map(renderFactionCard).join('');
    }
    if (mapCanvas) drawThreatMap(mapCanvas, rows, gs);

    const showCompact = (gs.wave || 0) >= WAVE_MIN || rows.some((r) => r.status !== 'dormant');
    const section = document.getElementById('faction-intel-section');
    if (section) section.style.display = showCompact ? '' : 'none';
    if (compactSummary) compactSummary.textContent = summary;
    if (compactList) {
      const compactRows = rows.filter(
        (r) => r.status !== 'dormant' || (gs.wave || 0) >= r.waveMin - 6
      );
      compactList.innerHTML = compactRows.map(renderCompactRow).join('');
    }
  }

  function getStateSnapshot(gs) {
    const rows = buildIntelRows(gs);
    return {
      active: (gs.wave || 0) >= WAVE_MIN,
      waveMin: WAVE_MIN,
      summary: formatSummary(gs),
      factions: rows,
      activeCount: rows.filter((r) => r.status === 'active' || r.status === 'weakened').length,
      peakStage: rows.reduce((m, r) => Math.max(m, r.stage || 0), 0),
      kingdomHostCount: rows.filter(
        (r) => r.stage >= 4 && r.status !== 'dormant' && r.status !== 'eliminated'
      ).length,
    };
  }

  function init() {
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
    STAGE_LABELS,
    init,
    openPanel,
    closePanel,
    togglePanel,
    isPanelOpen,
    focusFaction,
    getFocusedFaction,
    selectFaction: focusFaction,
    buildIntelRows,
    formatSummary,
    drawThreatMap,
    renderPanel,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FactionIntel = FactionIntel;
