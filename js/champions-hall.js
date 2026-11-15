/**
 * The Champions' Hall: twenty-nine freed pit-fighters who hire out as the Bloodsand Champions.
 * Identifiers in this file (`champions`, `Wwe…`) are save-file and DOM ids kept for compatibility;
 * none of them is shown to the player. Names, titles and text come from data/champions.json.
 */
const CHAMPIONS_HALL_COST = 1000;
const CHAMPIONS_HALL_BUILDERS = 10;
const CHAMPIONS_HALL_RECOMMENDED_HAMLETS = 2;
const CHAMPIONS_HALL_RECOMMENDED_GUILDS = 1;

/** Finishing blows that play to the crowd: these lift morale as well as doing damage. */
const CHAMPION_SHOWMANSHIP_ABILITIES = new Set([
  'sworn_stand',
  'heralds_boast',
  'keystone_blow',
  'cairn_fall',
  'stubborn_blood',
  'stooping_cast',
  'spinning_heel',
  'rope_dancers_leap',
  'raise_the_colours',
  'passing_bell',
  'barbed_tongue',
  'magpies_due',
  'corpse_candle_omen',
  'shoulder_ram',
  'sudden_fall',
  'poachers_cast',
  'last_word',
  'chain_hold',
  'goring_sweep',
  'roof_fall',
  'ora_rush',
  'final_amen',
  'sunbreath',
  'mending_verse',
  'hammered_verse',
]);

function isShowmanshipAbility(abilityId) {
  return !!abilityId && CHAMPION_SHOWMANSHIP_ABILITIES.has(abilityId);
}

function getUnitShowmanshipAbility(unit) {
  if (!unit) return null;
  if (unit.isWwe && unit.wweAbility) return unit.wweAbility;
  const def =
    (typeof getChampionDef === 'function' ? getChampionDef(unit.type) : null) ||
    (typeof getHeroDef === 'function' ? getHeroDef(unit.type) : null);
  return def?.ability || null;
}

function isShowmanshipUnit(unit) {
  return isShowmanshipAbility(getUnitShowmanshipAbility(unit));
}

// Roster stats live in data/champions.json (bundled by scripts/extract-game-data.mjs).
const ChampionDefs = GameDataBundle.champions;

function getChampionDef(type) {
  return ChampionDefs[type] || null;
}

function isChampionUnit(type) {
  return !!ChampionDefs[type];
}

const ChampionsHall = (() => {
  let selectedId = null;

  /** Headings and button text for the screen. The markup is shared; the words live here. */
  const SCREEN_TEXT = {
    title: 'CHAMPIONS’ HALL',
    subtitle: `Freed pit-fighters of the bloodsand, for hire. Raising the hall takes ${CHAMPIONS_HALL_COST} TP and ${CHAMPIONS_HALL_BUILDERS} builders; hamlets and guilds help.`,
    build: 'RAISE THE CHAMPIONS’ HALL',
    recruit: 'HIRE SELECTED',
    empty: 'Choose a champion below.',
  };

  function renderRoster(gs) {
    const grid = document.getElementById('champions-roster-grid');
    if (!grid) return;
    const recruited = new Set(MetaProgress.getChampionsRecruited());
    grid.innerHTML = Object.entries(ChampionDefs)
      .map(([id, def]) => {
        const onField = gs?.wweOnField?.includes(id);
        const canAfford = (gs?.tactical ?? 0) >= def.cost;
        return `
        <div class="hero-card ${selectedId === id ? 'selected' : ''} ${!canAfford ? 'cant-afford' : ''}" data-wwe="${id}">
          <div class="hero-card-name" style="color:${def.color}">${HeroCast.displayName(id)}</div>
          <div class="hero-card-stats hero-card-title"><em>${HeroCast.title(id)}</em></div>
          <div class="hero-card-cost">${def.cost} TP</div>
          <div class="hero-card-stats">HP ${def.hp} · DMG ${def.damage} · SPD ${def.speed}</div>
          <div class="hero-card-ability">${def.abilityDesc}</div>
          ${recruited.has(id) ? '<div class="hero-recruited">★ Sworn</div>' : ''}
          ${onField ? '<div class="hero-on-field">ON FIELD</div>' : ''}
        </div>
      `;
      })
      .join('');

    grid.querySelectorAll('.hero-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.wwe;
        renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
        AudioEngine?.SFX?.click?.();
      });
    });

    const detail = document.getElementById('champions-selected-detail');
    if (detail && selectedId && ChampionDefs[selectedId]) {
      const d = ChampionDefs[selectedId];
      detail.innerHTML = `<strong>${HeroCast.fullName(selectedId)}</strong><br><em>${HeroCast.description(selectedId)}</em><br>${d.abilityDesc}<br>Cost: ${d.cost} TP · Press ${SCREEN_TEXT.recruit} to take their oath.`;
    }
  }

  function togglePanel() {
    const panel = document.getElementById('champions-screen');
    if (!panel) return;
    if (!MetaProgress.isChampionsUnlocked()) {
      const text =
        'The Champions’ Hall is barred. Earn 316 achievements, win a campaign with champions leading most waves, or find the word that opens the door.';
      if (typeof InPageDialog !== 'undefined')
        InPageDialog.message(text, 'Champions’ Hall — barred');
      else if (typeof Game !== 'undefined') Game.showMessage?.(text, 420);
      return;
    }
    const open = panel.classList.toggle('active');
    if (open && typeof CompanyTraining !== 'undefined') CompanyTraining.renderPanel();
    if (open) renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
  }

  function getSelected() {
    return selectedId;
  }

  /** Select a champion without a click; used by tests and tools. */
  function select(id) {
    if (!ChampionDefs[id]) return false;
    selectedId = id;
    renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
    return true;
  }

  function applyScreenText() {
    const screen = document.getElementById('champions-screen');
    if (!screen) return;
    const set = (sel, text) => {
      const el = screen.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('.hero-title', SCREEN_TEXT.title);
    set('.hero-subtitle', SCREEN_TEXT.subtitle);
    set('#champions-build-btn', SCREEN_TEXT.build);
    set('#champions-recruit-btn', SCREEN_TEXT.recruit);
    set('#champions-selected-detail', SCREEN_TEXT.empty);
    // The detail text is several lines long; let the card grid give way, not this box.
    const detail = screen.querySelector('#champions-selected-detail');
    if (detail) detail.style.flexShrink = '0';
  }

  function init() {
    applyScreenText();
    document.getElementById('champions-hall-open')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      togglePanel();
    });
    document.getElementById('champions-close')?.addEventListener('click', () => {
      document.getElementById('champions-screen')?.classList.remove('active');
    });
    document.getElementById('champions-recruit-btn')?.addEventListener('click', () => {
      if (!selectedId) return;
      if (typeof Game !== 'undefined') Game.hireChampion(selectedId);
      renderRoster(Game.getState());
      UI.updateHUD(true);
    });
    document.getElementById('champions-build-btn')?.addEventListener('click', () => {
      if (typeof Availability !== 'undefined') Availability.trySelect('build', 'champions_hall');
      else if (typeof Game !== 'undefined') Game.selectBuild('champions_hall');
      togglePanel();
      UI.updateHUD(true);
    });
  }

  return { init, togglePanel, renderRoster, getSelected, select, SCREEN_TEXT };
})();
