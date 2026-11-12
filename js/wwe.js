/**
 * Grand Coliseum champions — secret academy roster.
 */
const WWE_ACADEMY_COST = 1000;
const WWE_ACADEMY_BUILDERS = 10;
const WWE_ACADEMY_RECOMMENDED_HAMLETS = 2;
const WWE_ACADEMY_RECOMMENDED_GUILDS = 1;

/** Coliseum showmanship finishers — entertainment, larger-than-life charisma. */
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
          <div class="wwe-card-name" style="color:${def.color}">${def.name}</div>
          <div class="wwe-card-cost">${def.cost} TP</div>
          <div class="wwe-card-stats">HP ${def.hp} · DMG ${def.damage} · SPD ${def.speed}</div>
          <div class="wwe-card-ability">${def.abilityDesc}</div>
          ${recruited.has(id) ? '<div class="wwe-recruited">★ Signed</div>' : ''}
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
      detail.innerHTML = `<strong>${d.name}</strong> — ${d.abilityDesc}<br>Cost: ${d.cost} TP · Click RECRUIT to sign.`;
    }
  }

  function togglePanel() {
    const panel = document.getElementById('wwe-screen');
    if (!panel) return;
    if (!MetaProgress.isWweUnlocked()) {
      alert(
        'Join the Iron Creed (316 achievements), win with Grand Coliseum champions dominating most waves — or discover the right cheat code — to access the Grand Coliseum.'
      );
      return;
    }
    const open = panel.classList.toggle('active');
    if (open && typeof OperativeSkillTrees !== 'undefined') OperativeSkillTrees.renderPanel();
    if (open) renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
  }

  function getSelected() {
    return selectedId;
  }

  function init() {
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
      if (typeof Game !== 'undefined') Game.selectBuild('wwe_academy');
      togglePanel();
      UI.updateHUD(true);
    });
  }

  return { init, togglePanel, renderRoster, getSelected };
})();
