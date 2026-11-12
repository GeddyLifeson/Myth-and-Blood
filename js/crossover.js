const CrossoverFactions = {
  ultimis: {
    id: 'ultimis',
    label: 'Void Residue Crew',
    building: 'element_barracks',
    unlockKey: 'is115Unlocked',
  },
  primis: {
    id: 'primis',
    label: 'First Circle',
    building: 'primis_shrine',
    unlockKey: 'isPrimusUnlocked',
  },
  halo: {
    id: 'halo',
    label: 'Orbital Vanguard',
    building: 'spartan_academy',
    unlockKey: 'isHaloUnlocked',
  },
  gears: {
    id: 'gears',
    label: 'Iron Trench Coalition',
    building: 'cog_academy',
    unlockKey: 'isGearsUnlocked',
  },
  lotr: {
    id: 'lotr',
    label: 'Ninefold March',
    building: 'rivendell_camp',
    unlockKey: 'isLotrUnlocked',
  },
  baki: {
    id: 'baki',
    label: 'Iron Pit Guild',
    building: 'hanma_dojo',
    unlockKey: 'isBakiUnlocked',
  },
  jojo: {
    id: 'jojo',
    label: 'Bound Spirit Court',
    building: 'stand_arrow_shrine',
    unlockKey: 'isJojoUnlocked',
  },
  fotns: {
    id: 'fotns',
    label: 'North Star Ascetics',
    building: 'north_star_dojo',
    unlockKey: 'isFotnsUnlocked',
  },
  dragonball: {
    id: 'dragonball',
    label: 'Skyburst Order',
    building: 'capsule_corp',
    unlockKey: 'isDragonballUnlocked',
  },
  imperium: {
    id: 'imperium',
    label: 'Crimson Legions',
    building: 'astartes_chapel',
    unlockKey: 'isImperiumUnlocked',
  },
  crystal: {
    id: 'crystal',
    label: 'Crystal Vanguard',
    building: 'crystal_sanctum',
    unlockKey: 'isCrystalUnlocked',
  },
  warp: {
    id: 'warp',
    label: 'Rift Cult',
    building: 'warp_shrine',
    unlockKey: 'isWarpUnlocked',
  },
  tes: {
    id: 'tes',
    label: 'Voicebound Pact',
    building: 'dragon_moot',
    unlockKey: 'isTesUnlocked',
  },
};

// Roster stats live in data/operatives.json (bundled by scripts/extract-game-data.mjs).
const CrossoverDefs = GameDataBundle.operatives;

function getCrossoverDef(type) {
  return CrossoverDefs[type] || null;
}

function isCrossoverUnit(type) {
  return !!CrossoverDefs[type];
}

function getCrossoverCombatTag(unit) {
  if (!unit) return 'melee';
  if (unit.combatTag) return unit.combatTag;
  const def =
    getCrossoverDef(unit.type) || (typeof getWweDef === 'function' ? getWweDef(unit.type) : null);
  if (def?.combatTag) return def.combatTag;
  if (def?.type === 'ranged') return 'ranged';
  if (unit.combatType === 'healer' || unit.type === 'healer') return 'support';
  if (
    unit.combatType === 'builder' ||
    unit.combatType === 'courier' ||
    unit.combatType === 'general'
  )
    return 'support';
  if (unit.combatType === 'ranged' || unit.projectile) return 'ranged';
  return 'melee';
}

function isFactionUnlocked(factionId) {
  const f = CrossoverFactions[factionId];
  if (!f || typeof MetaProgress === 'undefined') return false;
  const fn = MetaProgress[f.unlockKey];
  return typeof fn === 'function' ? fn() : false;
}

function getUnlockedFactions() {
  return Object.values(CrossoverFactions).filter((f) => isFactionUnlocked(f.id));
}

const CROSSOVER_FACTION_TAB_ORDER = [
  'ultimis',
  'primis',
  'halo',
  'gears',
  'lotr',
  'baki',
  'jojo',
  'fotns',
  'dragonball',
  'imperium',
  'crystal',
  'warp',
  'tes',
];

const CrossoverHub = (() => {
  let selectedId = null;
  let activeFaction = 'ultimis';

  function rosterForFaction(fid) {
    return Object.entries(CrossoverDefs).filter(([, d]) => d.faction === fid);
  }

  function getFeaturedOperativeId(fid, wave = 0) {
    const roster = rosterForFaction(fid);
    if (!roster.length) return null;
    const seed = (wave || 0) + [...fid].reduce((n, c) => n + c.charCodeAt(0), 0);
    return roster[seed % roster.length][0];
  }

  function sortUnlockedFactions(unlocked) {
    const order = CROSSOVER_FACTION_TAB_ORDER;
    return [...unlocked].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }

  function hasFactionBuilding(fid, gs) {
    const f = CrossoverFactions[fid];
    if (!f) return false;
    return !!gs?.crossoverBuildings?.includes(f.building);
  }

  function renderRoster(gs) {
    const grid = document.getElementById('crossover-roster-grid');
    if (!grid) return;
    const unlocked = sortUnlockedFactions(getUnlockedFactions());
    if (unlocked.length && !unlocked.find((f) => f.id === activeFaction)) {
      activeFaction = unlocked[0].id;
    }

    const tabs = document.getElementById('crossover-faction-tabs');
    if (tabs) {
      tabs.innerHTML = unlocked
        .map((f) => {
          const count = rosterForFaction(f.id).length;
          return `
        <button class="crossover-tab ${f.id === activeFaction ? 'active' : ''}" data-faction="${f.id}" title="${count} operatives">${f.label} (${count})</button>
      `;
        })
        .join('');
      tabs.querySelectorAll('.crossover-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeFaction = btn.dataset.faction;
          selectedId = null;
          renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
          AudioEngine?.SFX?.click?.();
        });
      });
    }

    const entries = rosterForFaction(activeFaction);
    const featuredId = getFeaturedOperativeId(activeFaction, gs?.wave || 0);
    const sortedEntries = featuredId
      ? [...entries].sort((a, b) => (a[0] === featuredId ? -1 : b[0] === featuredId ? 1 : 0))
      : entries;
    const recruited = new Set(MetaProgress.getCrossoverRecruited?.() || []);
    grid.innerHTML =
      sortedEntries
        .map(([id, def]) => {
          const onField = gs?.crossoverOnField?.includes(id);
          const canAfford = (gs?.tactical ?? 0) >= def.cost;
          const hasBase = hasFactionBuilding(activeFaction, gs);
          const isFeatured = id === featuredId;
          return `
        <div class="wwe-card crossover-card ${selectedId === id ? 'selected' : ''} ${isFeatured ? 'crossover-featured' : ''} ${!canAfford || !hasBase || onField ? 'cant-afford' : ''}" data-crossover="${id}">
          ${isFeatured ? '<div class="crossover-featured-badge">Featured</div>' : ''}
          <div class="wwe-card-name" style="color:${def.color}">${def.name}</div>
          <div class="wwe-card-cost">${def.cost} TP</div>
          <div class="wwe-card-stats">HP ${def.hp} · DMG ${def.damage} · ${def.type}${def.jojoPart ? ` · Pt.${def.jojoPart}` : ''}</div>
          <div class="wwe-card-ability">${def.abilityDesc}</div>
          ${recruited.has(id) ? '<div class="wwe-recruited">★ Signed</div>' : ''}
          ${onField ? '<div class="wwe-on-field">ON FIELD</div>' : ''}
          ${!hasBase ? '<div class="crossover-need-base">Need barracks on field</div>' : ''}
        </div>
      `;
        })
        .join('') || '<p class="crossover-empty">No operatives available for this faction yet.</p>';

    grid.querySelectorAll('.crossover-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.crossover;
        renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
        AudioEngine?.SFX?.click?.();
      });
    });

    const detail = document.getElementById('crossover-selected-detail');
    const prof =
      typeof FactionDepth !== 'undefined' ? FactionDepth.getProfile(activeFaction) : null;
    const mastery =
      typeof FactionDepth !== 'undefined' ? FactionDepth.getMasteryPoints(activeFaction) : 0;
    const title =
      typeof FactionDepth !== 'undefined' ? FactionDepth.getMasteryTitle(activeFaction) : null;
    const seasonals = typeof FactionDepth !== 'undefined' ? FactionDepth.getSeasonalEvents() : [];
    const seasonal =
      seasonals.find((e) => e.factions?.includes(activeFaction)) || seasonals[0] || null;
    const synHint =
      typeof FactionDepth !== 'undefined'
        ? FactionDepth.SYNERGIES.filter((s) => s.factions.includes(activeFaction))
            .slice(0, 2)
            .map((s) => s.name)
            .join(', ')
        : '';
    const recruitBtn = document.getElementById('crossover-recruit-btn');
    if (recruitBtn) {
      if (!selectedId) {
        recruitBtn.disabled = true;
      } else {
        const selOnField = gs?.crossoverOnField?.includes(selectedId);
        const selDef = CrossoverDefs[selectedId];
        const selAfford = selDef && (gs?.tactical ?? 0) >= selDef.cost;
        const selBase = hasFactionBuilding(activeFaction, gs);
        recruitBtn.disabled = !!(selOnField || !selAfford || !selBase);
      }
    }

    if (detail && selectedId && CrossoverDefs[selectedId]) {
      const d = CrossoverDefs[selectedId];
      const costNote =
        typeof FactionDepth !== 'undefined' && gs
          ? ` (≈${Math.ceil(d.cost * FactionDepth.getDeployCostMult(activeFaction, gs.wave || 0))} TP)`
          : '';
      const fieldNote = gs?.crossoverOnField?.includes(selectedId)
        ? '<br><em>Already deployed — wait until they fall to recruit again.</em>'
        : '';
      detail.innerHTML = `<strong>${d.name}</strong> — ${d.abilityDesc}<br>Cost: ${d.cost} TP${costNote} · Tag: ${d.combatTag}${fieldNote}`;
    } else if (detail) {
      if (prof) {
        detail.innerHTML = `<strong>${prof.label}</strong>${title ? ` · <em>${title}</em>` : ''}<br>
          Mastery: ${mastery} pts · ${prof.identity}<br>
          <span class="crossover-weakness">Weakness: ${prof.weakness}</span><br>
          ${synHint ? `Synergies: ${synHint}` : ''}${seasonal?.factions?.includes(activeFaction) ? `<br>🎉 ${seasonal.name}` : ''}`;
      } else {
        detail.textContent = unlocked.length
          ? 'Select a evolved operative below.'
          : 'Unlock a evolved roster first — then build its barracks and recruit operatives here.';
      }
    }
  }

  function togglePanel(factionId) {
    const panel = document.getElementById('crossover-screen');
    if (!panel) return;
    if (factionId) activeFaction = factionId;
    const open = panel.classList.toggle('active');
    if (open) {
      renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
      if (typeof OperativeSkillTrees !== 'undefined') OperativeSkillTrees.renderPanel();
    }
  }

  function getSelected() {
    return selectedId;
  }

  function init() {
    document.getElementById('crossover-hub-open')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      const unlocked =
        (typeof MetaProgress !== 'undefined' && MetaProgress.isAnyCrossoverUnlocked?.()) ||
        (typeof Research !== 'undefined' &&
          Object.keys(CrossoverFactions || {}).some((f) => Research.isFactionUnlocked?.(f, {})));
      if (!unlocked) {
        // Prefer in-game toast if HUD is live.
        if (typeof UI !== 'undefined' && UI.updateHUD) {
          const box = document.getElementById('message-box');
          if (box) {
            box.textContent =
              'No evolved factions unlocked — Iron Creed unlocks or Research → Evolved Allies.';
            box.classList.add('show');
            setTimeout(() => box.classList.remove('show'), 2800);
          }
        }
        return;
      }
      togglePanel();
    });
    document.getElementById('crossover-close')?.addEventListener('click', () => {
      document.getElementById('crossover-screen')?.classList.remove('active');
    });
    document.getElementById('crossover-recruit-btn')?.addEventListener('click', () => {
      if (!selectedId) return;
      const gs = typeof Game !== 'undefined' ? Game.getState() : null;
      if (gs?.crossoverOnField?.includes(selectedId)) return;
      if (typeof Game !== 'undefined') Game.recruitCrossoverOperative(selectedId);
      renderRoster(Game.getState());
      UI.updateHUD(true);
    });
    document.getElementById('crossover-build-btn')?.addEventListener('click', () => {
      const f = CrossoverFactions[activeFaction];
      if (f && typeof Game !== 'undefined') Game.selectBuild(f.building);
      togglePanel();
      UI.updateHUD(true);
    });
  }

  return {
    init,
    togglePanel,
    renderRoster,
    getSelected,
    rosterForFaction,
  };
})();
