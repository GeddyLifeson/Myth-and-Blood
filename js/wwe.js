/**
 * The Champions' Hall: twenty-nine freed pit-fighters who hire out as the Bloodsand Champions.
 * Identifiers in this file (`wwe`, `Wwe…`) are save-file and DOM ids kept for compatibility;
 * none of them is shown to the player. Names, titles and text come from data/champions.json.
 */
const WWE_ACADEMY_COST = 1000;
const WWE_ACADEMY_BUILDERS = 10;
const WWE_ACADEMY_RECOMMENDED_HAMLETS = 2;
const WWE_ACADEMY_RECOMMENDED_GUILDS = 1;

/** Finishing blows that play to the crowd: these lift morale as well as doing damage. */
const WWE_SHOWMANSHIP_ABILITIES = new Set([
  'attitude',
  'woo',
  'stunner',
  'rock_bottom',
  'hulk_up',
  'elbow_drop',
  'sweet_chin',
  '619',
  'usa',
  'tombstone',
  'piper_pit',
  'lie_cheat_steal',
  'lantern',
  'spear',
  'rko',
  'curb_stomp',
  'go_to_sleep',
  'scorpion',
  'batista_bomb',
  'jackknife',
  'ora_rush',
  'king_crimson',
  'sunbreath',
  'sunlight_yellow',
  'star_platinum',
]);

function isShowmanshipAbility(abilityId) {
  return !!abilityId && WWE_SHOWMANSHIP_ABILITIES.has(abilityId);
}

function getUnitShowmanshipAbility(unit) {
  if (!unit) return null;
  if (unit.isWwe && unit.wweAbility) return unit.wweAbility;
  const def =
    (typeof getWweDef === 'function' ? getWweDef(unit.type) : null) ||
    (typeof getCrossoverDef === 'function' ? getCrossoverDef(unit.type) : null);
  return def?.ability || null;
}

function isShowmanshipUnit(unit) {
  return isShowmanshipAbility(getUnitShowmanshipAbility(unit));
}

// Roster stats live in data/champions.json (bundled by scripts/extract-game-data.mjs).
const WweDefs = GameDataBundle.champions;

function getWweDef(type) {
  return WweDefs[type] || null;
}

function isWweUnit(type) {
  return !!WweDefs[type];
}

const WweAcademy = (() => {
  let selectedId = null;

  /** Headings and button text for the screen. The markup is shared; the words live here. */
  const SCREEN_TEXT = {
    title: 'CHAMPIONS’ HALL',
    subtitle: `Freed pit-fighters of the bloodsand, for hire. Raising the hall takes ${WWE_ACADEMY_COST} TP and ${WWE_ACADEMY_BUILDERS} builders; hamlets and guilds help.`,
    build: 'RAISE THE CHAMPIONS’ HALL',
    recruit: 'HIRE SELECTED',
    empty: 'Choose a champion below.',
  };

  function renderRoster(gs) {
    const grid = document.getElementById('wwe-roster-grid');
    if (!grid) return;
    const recruited = new Set(MetaProgress.getWweRecruited());
    grid.innerHTML = Object.entries(WweDefs)
      .map(([id, def]) => {
        const onField = gs?.wweOnField?.includes(id);
        const canAfford = (gs?.tactical ?? 0) >= def.cost;
        return `
        <div class="wwe-card ${selectedId === id ? 'selected' : ''} ${!canAfford ? 'cant-afford' : ''}" data-wwe="${id}">
          <div class="wwe-card-name" style="color:${def.color}">${HeroCast.displayName(id)}</div>
          <div class="wwe-card-stats wwe-card-title"><em>${HeroCast.title(id)}</em></div>
          <div class="wwe-card-cost">${def.cost} TP</div>
          <div class="wwe-card-stats">HP ${def.hp} · DMG ${def.damage} · SPD ${def.speed}</div>
          <div class="wwe-card-ability">${def.abilityDesc}</div>
          ${recruited.has(id) ? '<div class="wwe-recruited">★ Sworn</div>' : ''}
          ${onField ? '<div class="wwe-on-field">ON FIELD</div>' : ''}
        </div>
      `;
      })
      .join('');

    grid.querySelectorAll('.wwe-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.wwe;
        renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
        AudioEngine?.SFX?.click?.();
      });
    });

    const detail = document.getElementById('wwe-selected-detail');
    if (detail && selectedId && WweDefs[selectedId]) {
      const d = WweDefs[selectedId];
      detail.innerHTML = `<strong>${HeroCast.fullName(selectedId)}</strong><br><em>${HeroCast.description(selectedId)}</em><br>${d.abilityDesc}<br>Cost: ${d.cost} TP · Press ${SCREEN_TEXT.recruit} to take their oath.`;
    }
  }

  function togglePanel() {
    const panel = document.getElementById('wwe-screen');
    if (!panel) return;
    if (!MetaProgress.isWweUnlocked()) {
      const text =
        'The Champions’ Hall is barred. Earn 316 achievements, win a campaign with champions leading most waves, or find the word that opens the door.';
      if (typeof InPageDialog !== 'undefined')
        InPageDialog.message(text, 'Champions’ Hall — barred');
      else if (typeof Game !== 'undefined') Game.showMessage?.(text, 420);
      return;
    }
    const open = panel.classList.toggle('active');
    if (open && typeof OperativeSkillTrees !== 'undefined') OperativeSkillTrees.renderPanel();
    if (open) renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
  }

  function getSelected() {
    return selectedId;
  }

  /** Select a champion without a click; used by tests and tools. */
  function select(id) {
    if (!WweDefs[id]) return false;
    selectedId = id;
    renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
    return true;
  }

  function applyScreenText() {
    const screen = document.getElementById('wwe-screen');
    if (!screen) return;
    const set = (sel, text) => {
      const el = screen.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('.wwe-title', SCREEN_TEXT.title);
    set('.wwe-subtitle', SCREEN_TEXT.subtitle);
    set('#wwe-build-btn', SCREEN_TEXT.build);
    set('#wwe-recruit-btn', SCREEN_TEXT.recruit);
    set('#wwe-selected-detail', SCREEN_TEXT.empty);
    // The detail text is several lines long; let the card grid give way, not this box.
    const detail = screen.querySelector('#wwe-selected-detail');
    if (detail) detail.style.flexShrink = '0';
  }

  function init() {
    applyScreenText();
    document.getElementById('wwe-academy-open')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      togglePanel();
    });
    document.getElementById('wwe-close')?.addEventListener('click', () => {
      document.getElementById('wwe-screen')?.classList.remove('active');
    });
    document.getElementById('wwe-recruit-btn')?.addEventListener('click', () => {
      if (!selectedId) return;
      if (typeof Game !== 'undefined') Game.recruitWweSuperstar(selectedId);
      renderRoster(Game.getState());
      UI.updateHUD(true);
    });
    document.getElementById('wwe-build-btn')?.addEventListener('click', () => {
      if (typeof Availability !== 'undefined') Availability.trySelect('build', 'wwe_academy');
      else if (typeof Game !== 'undefined') Game.selectBuild('wwe_academy');
      togglePanel();
      UI.updateHUD(true);
    });
  }

  return { init, togglePanel, renderRoster, getSelected, select, SCREEN_TEXT };
})();
