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

  function getAllFactionDefs() {
    if (typeof EnemyFactions === 'undefined') return [];
    return Object.values(EnemyFactions.FACTIONS).sort((a, b) => a.waveMin - b.waveMin);
  }

  function isEliminated(factionId, gs) {
    return false;
  }

  function buildIntelRows(gs) {
    const wave = gs.wave || 0;
    const activeMap = new Map((gs.enemyFactions?.activeFactions || []).map((f) => [f.id, f]));
    const conquestMap = new Map([].map((s) => [s.factionId, s]));
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
    const plan =
      GameState.timeOfDay === 'night'
        ? GameState.nextWavePlan
        : { sectors: GameState.waveSectors || GameState.multiFrontPlan?.sectors };
    return WarCamps.planSectors(plan);
  }

  function threatSummary(gs) {
    const night = gs.timeOfDay === 'night';
    const preview = typeof SiegeLoop !== 'undefined' ? SiegeLoop.getPreview?.() : null;
    if (night && preview) return SiegeLoop.previewText(preview);
    return night ? `Wave ${(gs.wave || 0) + 1} is gathering.` : `Wave ${gs.wave || 0} is on the field.`;
  }

  function sectorLine(gs) {
    const sectors = activeSectors();
    const night = gs.timeOfDay === 'night';
    if (sectors) {
      return `${night ? 'The next wave enters' : 'This wave entered'} by the ${sectors.join(' and ')} of the top edge.`;
    }
    const sides =
      (typeof GameState !== 'undefined' &&
        (night ? GameState.nextWavePlan?.sides : GameState.waveAttackSides)) ||
      [];
    const other = sides.filter((x) => x !== 'north');
    return other.length
      ? `${night ? 'The next wave comes' : 'This wave came'} from the north and the ${other.join(', ')}.`
      : `${night ? 'The next wave comes' : 'This wave came'} from the top edge.`;
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
        `${SECTOR_IDS[i].toUpperCase()}${sectors ? (on ? ' — host enters' : ' — quiet') : ''}`,
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

  function renderPanel(gs) {
    const camps = campState();
    const list = camps ? camps.camps : [];
    const sectors = activeSectors();
    const summary = threatSummary(gs);

    const summaryEl = document.getElementById('faction-intel-summary');
    const listEl = document.getElementById('faction-intel-list');
    const mapCanvas = document.getElementById('faction-intel-map');
    const hostEl = document.getElementById('faction-intel-host');
    const rosterEl = document.getElementById('faction-intel-roster');
    const compactSummary = document.getElementById('faction-intel-compact-summary');
    const compactList = document.getElementById('faction-intel-compact-list');
    const legendEl = document.querySelector?.('.faction-intel-map-legend');

    if (summaryEl) summaryEl.textContent = summary;
    if (hostEl) hostEl.textContent = sectorLine(gs);
    if (legendEl) {
      legendEl.textContent =
        'The top edge in three sectors. Red: the host enters there. A tent with a fire: a war camp.';
    }
    const fromWave = camps ? camps.fromWave : 6;
    const none =
      (gs.wave || 0) + 1 < fromWave
        ? `No war camps yet. From wave ${fromWave} the enemy may raise one at nightfall.`
        : 'No war camp stands tonight.';
    if (listEl) {
      listEl.innerHTML = list.length
        ? list.map(renderCampCard).join('')
        : `<p class="intel-tagline">${none}</p>`;
    }
    if (rosterEl) {
      const how =
        'A camp is attacked only on your order: select soldiers and move them onto it (cavalry get there first, Sappers hit hardest), land a strike on it, or send the spy’s raid. Burn it before dawn and its bonus is gone.';
      const live = camps && camps.active.length
        ? ` In force this wave: ${camps.active.map((a) => `${a.name} — ${a.line}`).join('; ')}.`
        : '';
      const raid = camps && camps.raid
        ? camps.raid.waiting
          ? ' A raid rides at nightfall.'
          : ' Raiders are on their way.'
        : '';
      const names = (gs.enemyFactions?.activeFactions || []).map((f) => f.shortName || f.name);
      rosterEl.textContent = `${how}${live}${raid}${names.length ? ` Hosts in the field: ${names.join(', ')}.` : ''}`;
    }
    if (mapCanvas) drawSectorMap(mapCanvas, list, sectors);

    const section = document.getElementById('faction-intel-section');
    if (section) section.style.display = (gs.wave || 0) >= WAVE_MIN ? '' : 'none';
    if (compactSummary) compactSummary.textContent = sectorLine(gs);
    if (compactList) {
      compactList.innerHTML = list.length
        ? list
            .map(
              (c) =>
                `<div class="intel-compact-row intel-compact-active"><span class="intel-compact-dot" style="background:#a01018"></span>` +
                `<span class="intel-compact-name">${c.name} (${c.sector})</span>` +
                `<span class="intel-compact-stage">${c.sabotaged ? 'sabotaged' : c.line}</span></div>`
            )
            .join('')
        : `<div class="intel-compact-row"><span class="intel-compact-name">${none}</span></div>`;
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
    init,
    openPanel,
    closePanel,
    togglePanel,
    isPanelOpen,
    focusFaction,
    buildIntelRows,
    formatSummary,
    renderPanel,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FactionIntel = FactionIntel;
