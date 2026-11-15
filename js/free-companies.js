/**
 * The Free Companies: thirteen orders, warbands, cults, guilds and mercenary companies that
 * can be hired onto the field. The keys are save-file ids and are never shown to the player;
 * everything a player reads comes from `label`, `kind` and `lore`.
 */
const FreeCompanies = {
  powderhorn: {
    id: 'powderhorn',
    label: 'Powderhorn Company',
    short: 'Powderhorn',
    kind: 'mercenary company',
    crest: '#c06030',
    lore: 'Four sellswords who learned black powder from a mine that killed everyone else in it. They hire out to any wall that can pay, and leave before the smoke clears.',
    building: 'powderhorn_magazine',
    unlockKey: 'isPowderhornUnlocked',
  },
  pale_vigil: {
    id: 'pale_vigil',
    label: 'The Pale Vigil',
    short: 'Pale Vigil',
    kind: 'knightly order',
    crest: '#d8d0b8',
    lore: 'An order of knights sworn to watch the old barrows so that nothing climbs out. When the dead began to march anyway, the Vigil came down to meet them.',
    building: 'pale_vigil_shrine',
    unlockKey: 'isPaleVigilUnlocked',
  },
  greywatch: {
    id: 'greywatch',
    label: 'The Greywatch',
    short: 'Greywatch',
    kind: 'citadel order',
    crest: '#708090',
    lore: 'The Greywatch has held one mountain citadel for three hundred years and has never opened its gate to an enemy. Its wardens come down only when a wall elsewhere is about to fail.',
    building: 'greywatch_hall',
    unlockKey: 'isGreywatchUnlocked',
  },
  sawtooth: {
    id: 'sawtooth',
    label: 'Sawtooth Company',
    short: 'Sawtooth',
    kind: 'mercenary company',
    crest: '#8a5a30',
    lore: 'A mercenary company that has fought every war from the bottom of a ditch. Its saw-backed glaives were made for cutting stakes and turned out to cut goblins as well.',
    building: 'sawtooth_camp',
    unlockKey: 'isSawtoothUnlocked',
  },
  thornroad: {
    id: 'thornroad',
    label: 'Thornroad Company',
    short: 'Thornroad',
    kind: 'free company',
    crest: '#4a7040',
    lore: 'Seven guards-for-hire who keep the pilgrim road through the thorn country. The shrines they were paid to protect are burning, so they have come to the source.',
    building: 'thornroad_camp',
    unlockKey: 'isThornroadUnlocked',
  },
  knucklebone: {
    id: 'knucklebone',
    label: 'Knucklebone Lodge',
    short: 'Knucklebone',
    kind: 'fighting guild',
    crest: '#b89868',
    lore: 'A fighting guild that settles rank by bouts and marks it in knucklebones worn at the belt. The lodge treats your siege as one more bout, and it does not forfeit.',
    building: 'knucklebone_lodge',
    unlockKey: 'isKnuckleboneUnlocked',
  },
  marrow_choir: {
    id: 'marrow_choir',
    label: 'The Marrow Choir',
    short: 'Marrow Choir',
    kind: 'relic cult',
    crest: '#8050a0',
    lore: "A cult that carries its saints' bones into battle and sings over them. The hymns work, which is the only reason the church has not burned the choir.",
    building: 'marrow_reliquary',
    unlockKey: 'isMarrowChoirUnlocked',
  },
  quiet_hand: {
    id: 'quiet_hand',
    label: 'Order of the Quiet Hand',
    short: 'Quiet Hand',
    kind: 'ascetic order',
    crest: '#506898',
    lore: 'An ascetic order that gave up weapons and then found it did not need them. Its monks speak rarely and strike once.',
    building: 'quiet_hand_cloister',
    unlockKey: 'isQuietHandUnlocked',
  },
  emberblood: {
    id: 'emberblood',
    label: 'Emberblood Warband',
    short: 'Emberblood',
    kind: 'hill warband',
    crest: '#e07030',
    lore: 'A hill warband whose blood runs hot enough to scorch. They follow whoever burns brightest, and they came south because the cold was leaving them.',
    building: 'emberblood_hearth',
    unlockKey: 'isEmberbloodUnlocked',
  },
  iron_psalm: {
    id: 'iron_psalm',
    label: 'Order of the Iron Psalm',
    short: 'Iron Psalm',
    kind: 'militant order',
    crest: '#802828',
    lore: 'A church order that sings its psalms in armour and counts every enemy an unbeliever. It tithes its levies from villages that would rather not be asked.',
    building: 'iron_psalm_chapel',
    unlockKey: 'isIronPsalmUnlocked',
  },
  saltglass: {
    id: 'saltglass',
    label: 'Saltglass Guild',
    short: 'Saltglass',
    kind: 'craft guild',
    crest: '#60b0c0',
    lore: 'The glassmakers of the salt coast guard their furnace secrets with hired blades and their own burned hands. A lens that can light a ship at a mile lights a goblin just as well.',
    building: 'saltglass_furnace',
    unlockKey: 'isSaltglassUnlocked',
  },
  open_wound: {
    id: 'open_wound',
    label: 'Cult of the Open Wound',
    short: 'Open Wound',
    kind: 'blood cult',
    crest: '#903050',
    lore: 'The cult believes the world has a wound that must be kept open, and that it bleeds power for those who tend it. It fights beside you because the host would close the wound for good.',
    building: 'open_wound_shrine',
    unlockKey: 'isOpenWoundUnlocked',
  },
  rimehowl: {
    id: 'rimehowl',
    label: 'Rimehowl Warband',
    short: 'Rimehowl',
    kind: 'northern warband',
    crest: '#4068a0',
    lore: 'A warband from the ice coast whose war-skalds howl before the charge. The howl carries a mile over snow, and what hears it tends not to wait.',
    building: 'rimehowl_longhouse',
    unlockKey: 'isRimehowlUnlocked',
  },
};

/** The champions are not a hired company; they have a hall of their own (js/champions-hall.js). */
const CHAMPION_FACTION = {
  id: 'champions',
  label: 'Bloodsand Champions',
  short: 'Champions',
  kind: 'champions’ hall',
  crest: '#b03028',
  lore: 'Every champion in the hall won freedom on the bloodsand and sold it again for a better price. They fight for the name carved on the wall, and the siege is one more bout.',
};

// Roster stats live in data/operatives.json (bundled by scripts/extract-game-data.mjs).
const HeroDefs = GameDataBundle.operatives;

function getHeroDef(type) {
  return HeroDefs[type] || null;
}

function isCompanyHeroUnit(type) {
  return !!HeroDefs[type];
}

/**
 * Display helpers for the cast. An internal id (a unit type, a faction key, a combat tag) must
 * never reach the screen: every caller that needs a name for one goes through HeroCast, which
 * answers from the data and falls back to a plain word, never to the id.
 */
const HeroCast = (() => {
  const TAG_LABELS = {
    melee: 'melee',
    ranged: 'ranged',
    support: 'support',
    ember: 'ember-blooded',
    skald: 'war-skald',
  };
  const TYPE_LABELS = { melee: 'Melee', ranged: 'Ranged', cavalry: 'Mounted', healer: 'Healer' };

  function def(id) {
    return (
      HeroDefs[id] ||
      (typeof GameDataBundle !== 'undefined' ? GameDataBundle.champions?.[id] : null) ||
      null
    );
  }
  function isHero(id) {
    return !!def(id);
  }
  function displayName(id) {
    const d = def(id);
    return d ? d.displayName || d.name || 'Unnamed hero' : 'Unknown hero';
  }
  function title(id) {
    return def(id)?.title || '';
  }
  function description(id) {
    return def(id)?.description || '';
  }
  /** "Name, Title", the form used on cards and in messages. */
  function fullName(id) {
    const t = title(id);
    return t ? `${displayName(id)}, ${t}` : displayName(id);
  }
  function factionId(id) {
    if (HeroDefs[id]) return HeroDefs[id].faction;
    return def(id) ? CHAMPION_FACTION.id : null;
  }
  function faction(fid) {
    return fid === CHAMPION_FACTION.id ? CHAMPION_FACTION : FreeCompanies[fid] || null;
  }
  function factionLabel(fid) {
    return faction(fid)?.label || 'Unknown company';
  }
  function factionShort(fid) {
    return faction(fid)?.short || 'Company';
  }
  function factionOf(id) {
    return factionLabel(factionId(id));
  }
  function tagLabel(tag) {
    return TAG_LABELS[tag] || 'fighter';
  }
  function typeLabel(type) {
    return TYPE_LABELS[type] || 'Fighter';
  }
  /** The Marrow Choir's four riders count toward the Outriders challenge; say so on the card. */
  function cohortLabel(id) {
    return def(id)?.jojoPart === 7 ? 'Outrider' : '';
  }
  return {
    isHero,
    displayName,
    title,
    description,
    fullName,
    factionId,
    faction,
    factionLabel,
    factionShort,
    factionOf,
    tagLabel,
    typeLabel,
    cohortLabel,
  };
})();

function getHeroCombatTag(unit) {
  if (!unit) return 'melee';
  if (unit.combatTag) return unit.combatTag;
  const def =
    getHeroDef(unit.type) ||
    (typeof getChampionDef === 'function' ? getChampionDef(unit.type) : null);
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
  const f = FreeCompanies[factionId];
  if (!f || typeof MetaProgress === 'undefined') return false;
  const fn = MetaProgress[f.unlockKey];
  return typeof fn === 'function' ? fn() : false;
}

function getUnlockedFactions() {
  return Object.values(FreeCompanies).filter((f) => isFactionUnlocked(f.id));
}

const COMPANY_TAB_ORDER = [
  'powderhorn',
  'pale_vigil',
  'greywatch',
  'sawtooth',
  'thornroad',
  'knucklebone',
  'marrow_choir',
  'quiet_hand',
  'emberblood',
  'iron_psalm',
  'saltglass',
  'open_wound',
  'rimehowl',
];

const FreeCompaniesScreen = (() => {
  let selectedId = null;
  let activeFaction = 'powderhorn';

  function rosterForFaction(fid) {
    return Object.entries(HeroDefs).filter(([, d]) => d.faction === fid);
  }

  function getFeaturedHeroId(fid, wave = 0) {
    const roster = rosterForFaction(fid);
    if (!roster.length) return null;
    const seed = (wave || 0) + [...fid].reduce((n, c) => n + c.charCodeAt(0), 0);
    return roster[seed % roster.length][0];
  }

  function sortUnlockedFactions(unlocked) {
    const order = COMPANY_TAB_ORDER;
    return [...unlocked].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }

  function hasFactionBuilding(fid, gs) {
    const f = FreeCompanies[fid];
    if (!f) return false;
    return !!gs?.crossoverBuildings?.includes(f.building);
  }

  function renderRoster(gs) {
    const grid = document.getElementById('companies-roster-grid');
    if (!grid) return;
    const unlocked = sortUnlockedFactions(getUnlockedFactions());
    if (unlocked.length && !unlocked.find((f) => f.id === activeFaction)) {
      activeFaction = unlocked[0].id;
    }

    const tabs = document.getElementById('companies-tabs');
    if (tabs) {
      tabs.innerHTML = unlocked
        .map((f) => {
          const count = rosterForFaction(f.id).length;
          return `
        <button class="company-tab ${f.id === activeFaction ? 'active' : ''}" data-faction="${f.id}" title="${f.kind} · ${count} heroes" style="border-color:${f.crest}">${f.label} (${count})</button>
      `;
        })
        .join('');
      tabs.querySelectorAll('.company-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeFaction = btn.dataset.faction;
          selectedId = null;
          renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
          AudioEngine?.SFX?.click?.();
        });
      });
    }

    const entries = rosterForFaction(activeFaction);
    const featuredId = getFeaturedHeroId(activeFaction, gs?.wave || 0);
    const sortedEntries = featuredId
      ? [...entries].sort((a, b) => (a[0] === featuredId ? -1 : b[0] === featuredId ? 1 : 0))
      : entries;
    const recruited = new Set(MetaProgress.getHeroesRecruited?.() || []);
    grid.innerHTML =
      sortedEntries
        .map(([id, def]) => {
          const onField = gs?.crossoverOnField?.includes(id);
          const canAfford = (gs?.tactical ?? 0) >= def.cost;
          const hasBase = hasFactionBuilding(activeFaction, gs);
          const isFeatured = id === featuredId;
          return `
        <div class="hero-card company-card ${selectedId === id ? 'selected' : ''} ${isFeatured ? 'company-featured' : ''} ${!canAfford || !hasBase || onField ? 'cant-afford' : ''}" data-crossover="${id}">
          ${isFeatured ? '<div class="company-featured-badge">Featured</div>' : ''}
          <div class="hero-card-name" style="color:${def.color}">${HeroCast.displayName(id)}</div>
          <div class="hero-card-stats hero-card-title"><em>${HeroCast.title(id)}</em></div>
          <div class="hero-card-cost">${def.cost} TP</div>
          <div class="hero-card-stats">HP ${def.hp} · DMG ${def.damage} · ${HeroCast.typeLabel(def.type)}${HeroCast.cohortLabel(id) ? ` · ${HeroCast.cohortLabel(id)}` : ''}</div>
          <div class="hero-card-ability">${def.abilityDesc}</div>
          ${recruited.has(id) ? '<div class="hero-recruited">★ Signed</div>' : ''}
          ${onField ? '<div class="hero-on-field">ON FIELD</div>' : ''}
          ${!hasBase ? '<div class="company-need-base">Needs its hall on the field</div>' : ''}
        </div>
      `;
        })
        .join('') || '<p class="company-empty">No heroes of this company can be hired yet.</p>';

    grid.querySelectorAll('.company-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.crossover;
        renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
        AudioEngine?.SFX?.click?.();
      });
    });

    const detail = document.getElementById('companies-selected-detail');
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
    const recruitBtn = document.getElementById('companies-recruit-btn');
    if (recruitBtn) {
      if (!selectedId) {
        recruitBtn.disabled = true;
      } else {
        const selOnField = gs?.crossoverOnField?.includes(selectedId);
        const selDef = HeroDefs[selectedId];
        const selAfford = selDef && (gs?.tactical ?? 0) >= selDef.cost;
        const selBase = hasFactionBuilding(activeFaction, gs);
        recruitBtn.disabled = !!(selOnField || !selAfford || !selBase);
      }
    }

    if (detail && selectedId && HeroDefs[selectedId]) {
      const d = HeroDefs[selectedId];
      const costNote =
        typeof FactionDepth !== 'undefined' && gs
          ? ` (≈${Math.ceil(d.cost * FactionDepth.getDeployCostMult(activeFaction, gs.wave || 0))} TP)`
          : '';
      const fieldNote = gs?.crossoverOnField?.includes(selectedId)
        ? '<br><em>Already on the field — they can be hired again only after they fall.</em>'
        : '';
      detail.innerHTML = `<strong>${HeroCast.fullName(selectedId)}</strong> · ${HeroCast.factionOf(selectedId)}<br><em>${HeroCast.description(selectedId)}</em><br>${d.abilityDesc}<br>Cost: ${d.cost} TP${costNote} · ${HeroCast.tagLabel(d.combatTag)}${fieldNote}`;
    } else if (detail) {
      if (prof) {
        const company = HeroCast.faction(activeFaction);
        detail.innerHTML = `<strong style="color:${company?.crest || 'inherit'}">${prof.label}</strong>${title ? ` · <em>${title}</em>` : ''}<br>
          ${company?.lore || ''}<br>
          Mastery: ${mastery} pts · ${prof.identity}<br>
          <span class="company-weakness">Weakness: ${prof.weakness}</span><br>
          ${synHint ? `Synergies: ${synHint}` : ''}${seasonal?.factions?.includes(activeFaction) ? `<br>In season: ${seasonal.name}` : ''}`;
      } else {
        detail.textContent = unlocked.length
          ? 'Choose a hero below.'
          : 'Unlock a free company first, then build its hall and hire its heroes here.';
      }
    }
  }

  function togglePanel(factionId) {
    const panel = document.getElementById('companies-screen');
    if (!panel) return;
    if (factionId) activeFaction = factionId;
    const open = panel.classList.toggle('active');
    if (open) {
      renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
      if (typeof CompanyTraining !== 'undefined') CompanyTraining.renderPanel();
    }
  }

  function getSelected() {
    return selectedId;
  }

  /** Select a hero (and show their company's tab) without a click; used by tests and tools. */
  function select(id) {
    const d = HeroDefs[id];
    if (!d) return false;
    activeFaction = d.faction;
    selectedId = id;
    renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
    return true;
  }

  /** Headings and button text for the screen. The markup is shared; the words live here. */
  const SCREEN_TEXT = {
    title: 'FREE COMPANIES',
    subtitle:
      'Orders, warbands, guilds and sellswords for hire. Raise a company’s hall on the field, then hire its heroes here.',
    build: 'RAISE THIS COMPANY’S HALL',
    recruit: 'HIRE SELECTED',
    empty: 'Choose a hero below.',
  };

  function applyScreenText() {
    const screen = document.getElementById('companies-screen');
    if (!screen) return;
    const set = (sel, text) => {
      const el = screen.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('.hero-title', SCREEN_TEXT.title);
    set('.hero-subtitle', SCREEN_TEXT.subtitle);
    set('#companies-build-btn', SCREEN_TEXT.build);
    set('#companies-recruit-btn', SCREEN_TEXT.recruit);
    set('#companies-selected-detail', SCREEN_TEXT.empty);
    // The detail text is several lines long; let the card grid give way, not this box.
    const detail = screen.querySelector('#companies-selected-detail');
    if (detail) detail.style.flexShrink = '0';
  }

  function init() {
    applyScreenText();
    document.getElementById('companies-open')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      const unlocked =
        (typeof MetaProgress !== 'undefined' && MetaProgress.isAnyCompanyUnlocked?.()) ||
        (typeof Research !== 'undefined' &&
          Object.keys(FreeCompanies || {}).some((f) => Research.isFactionUnlocked?.(f, {})));
      if (!unlocked) {
        // Prefer in-game toast if HUD is live.
        if (typeof UI !== 'undefined' && UI.updateHUD) {
          const box = document.getElementById('message-box');
          if (box) {
            box.textContent =
              'No free company has answered yet. Earn one through achievements or research.';
            box.classList.add('show');
            setTimeout(() => box.classList.remove('show'), 2800);
          }
        }
        return;
      }
      togglePanel();
    });
    document.getElementById('companies-close')?.addEventListener('click', () => {
      document.getElementById('companies-screen')?.classList.remove('active');
    });
    document.getElementById('companies-recruit-btn')?.addEventListener('click', () => {
      if (!selectedId) return;
      const gs = typeof Game !== 'undefined' ? Game.getState() : null;
      if (gs?.crossoverOnField?.includes(selectedId)) return;
      if (typeof Game !== 'undefined') Game.hireHero(selectedId);
      renderRoster(Game.getState());
      UI.updateHUD(true);
    });
    document.getElementById('companies-build-btn')?.addEventListener('click', () => {
      const f = FreeCompanies[activeFaction];
      if (f && typeof Availability !== 'undefined') Availability.trySelect('build', f.building);
      else if (f && typeof Game !== 'undefined') Game.selectBuild(f.building);
      togglePanel();
      UI.updateHUD(true);
    });
  }

  return {
    init,
    togglePanel,
    renderRoster,
    getSelected,
    select,
    rosterForFaction,
    SCREEN_TEXT,
  };
})();
