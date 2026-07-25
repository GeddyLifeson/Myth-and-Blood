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
  'hamon',
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

const WweDefs = {
  stone_cold: {
    name: 'The Stonebreaker',
    cost: 85,
    hp: 220,
    accuracy: 55,
    damage: 55,
    range: 28,
    meleeRange: 28,
    speed: 1.1,
    type: 'melee',
    morale: 30,
    experience: 12,
    canHunt: true,
    ability: 'stunner',
    abilityDesc: 'Stonebreaker — bonus damage vs elites, brief pin.',
    color: '#404040',
  },
  the_rock: {
    name: 'The Mountain King',
    cost: 90,
    hp: 210,
    accuracy: 52,
    damage: 50,
    range: 30,
    meleeRange: 30,
    speed: 1.05,
    type: 'melee',
    morale: 32,
    experience: 12,
    canHunt: true,
    ability: 'rock_bottom',
    abilityDesc: 'Mountain Slam — smashes nearby foes on kill streak.',
    color: '#c04040',
  },
  ric_flair: {
    name: 'The Nature Lord',
    cost: 75,
    hp: 180,
    accuracy: 48,
    damage: 42,
    range: 26,
    meleeRange: 26,
    speed: 1.0,
    type: 'melee',
    morale: 35,
    experience: 14,
    canHunt: true,
    ability: 'woo',
    abilityDesc: "Nature Lord's Cry — boosts ally morale in aura.",
    color: '#6080c0',
  },
  hulk_hogan: {
    name: 'The Titan',
    cost: 95,
    hp: 280,
    accuracy: 40,
    damage: 48,
    range: 30,
    meleeRange: 30,
    speed: 0.85,
    type: 'melee',
    morale: 40,
    experience: 10,
    canHunt: true,
    ability: 'hulk_up',
    abilityDesc: 'Titan Surge — heals when below 40% HP.',
    color: '#e0c040',
  },
  macho_man: {
    name: 'Sky Elbow Ace',
    cost: 80,
    hp: 195,
    accuracy: 50,
    damage: 52,
    range: 200,
    meleeRange: 26,
    speed: 1.0,
    type: 'ranged',
    projectile: 'arrow',
    morale: 28,
    experience: 11,
    canHunt: true,
    ability: 'elbow_drop',
    abilityDesc: 'Sky Elbow — crit from high ground.',
    color: '#c060a0',
  },
  sting: {
    name: 'The Crow Sentinel',
    cost: 88,
    hp: 200,
    accuracy: 54,
    damage: 46,
    range: 32,
    meleeRange: 32,
    speed: 1.15,
    type: 'melee',
    morale: 26,
    experience: 12,
    canHunt: true,
    ability: 'scorpion',
    abilityDesc: 'Sentinel Lock — pins wounded foes.',
    color: '#404080',
  },
  john_cena: {
    name: 'The Patriot',
    cost: 92,
    hp: 240,
    accuracy: 45,
    damage: 44,
    range: 28,
    meleeRange: 28,
    speed: 0.95,
    type: 'melee',
    morale: 38,
    experience: 10,
    canHunt: true,
    ability: 'attitude',
    abilityDesc: 'Patriot Resolve — damage reduction under 50% HP.',
    color: '#2060a0',
  },
  bautista: {
    name: 'The Animal Lord',
    cost: 86,
    hp: 230,
    accuracy: 46,
    damage: 58,
    range: 30,
    meleeRange: 30,
    speed: 1.0,
    type: 'melee',
    morale: 24,
    experience: 11,
    canHunt: true,
    ability: 'batista_bomb',
    abilityDesc: 'Animal Slam — AoE slam on attack.',
    color: '#505050',
  },
  roman_reigns: {
    name: 'The Tribal Chief',
    cost: 94,
    hp: 250,
    accuracy: 48,
    damage: 54,
    range: 30,
    meleeRange: 30,
    speed: 0.9,
    type: 'melee',
    morale: 34,
    experience: 12,
    canHunt: true,
    ability: 'spear',
    abilityDesc: 'Tribal Charge — charge attack with knockback.',
    color: '#303030',
  },
  shawn_michaels: {
    name: 'Sweet Chin Ace',
    cost: 82,
    hp: 175,
    accuracy: 58,
    damage: 48,
    range: 26,
    meleeRange: 26,
    speed: 1.2,
    type: 'melee',
    morale: 22,
    experience: 13,
    canHunt: true,
    ability: 'sweet_chin',
    abilityDesc: 'Sweet Chin Kick — high crit finisher.',
    color: '#c0a060',
  },
  bret_hart: {
    name: 'The Hitman',
    cost: 78,
    hp: 190,
    accuracy: 56,
    damage: 45,
    range: 26,
    meleeRange: 26,
    speed: 1.0,
    type: 'melee',
    morale: 28,
    experience: 14,
    canHunt: true,
    ability: 'sharpshooter',
    abilityDesc: 'Hitman Lock — locks down one target.',
    color: '#c04060',
  },
  undertaker: {
    name: 'The Grave Walker',
    cost: 110,
    hp: 300,
    accuracy: 50,
    damage: 60,
    range: 32,
    meleeRange: 32,
    speed: 0.8,
    type: 'melee',
    morale: 35,
    experience: 15,
    canHunt: true,
    ability: 'tombstone',
    abilityDesc: 'Grave Drop — terrifies nearby enemies (-morale).',
    color: '#302040',
  },
  kane: {
    name: 'The Inferno Brother',
    cost: 88,
    hp: 260,
    accuracy: 44,
    damage: 56,
    range: 30,
    meleeRange: 30,
    speed: 0.85,
    type: 'melee',
    morale: 20,
    experience: 11,
    canHunt: true,
    ability: 'chokeslam',
    abilityDesc: 'Inferno Slam — bonus vs larger foes.',
    color: '#802020',
  },
  andre_giant: {
    name: 'The Colossus',
    cost: 100,
    hp: 400,
    accuracy: 35,
    damage: 65,
    range: 34,
    meleeRange: 34,
    speed: 0.6,
    type: 'melee',
    morale: 30,
    experience: 8,
    canHunt: true,
    ability: 'giant_strength',
    abilityDesc: 'Colossus Might — splash damage, siege bonus.',
    color: '#706050',
  },
  razor_ramon: {
    name: 'The Razor Duke',
    cost: 76,
    hp: 185,
    accuracy: 50,
    damage: 46,
    range: 28,
    meleeRange: 28,
    speed: 1.0,
    type: 'melee',
    morale: 26,
    experience: 11,
    canHunt: true,
    ability: 'razors_edge',
    abilityDesc: 'Razor Edge — steady DPS boost.',
    color: '#c0c0c0',
  },
  kevin_nash: {
    name: 'The Diesel Tower',
    cost: 84,
    hp: 245,
    accuracy: 42,
    damage: 52,
    range: 32,
    meleeRange: 32,
    speed: 0.88,
    type: 'melee',
    morale: 22,
    experience: 10,
    canHunt: true,
    ability: 'jackknife',
    abilityDesc: 'Tower Drop — power bomb splash.',
    color: '#304060',
  },
  roddy_piper: {
    name: 'The Pit Piper',
    cost: 74,
    hp: 170,
    accuracy: 52,
    damage: 44,
    range: 26,
    meleeRange: 26,
    speed: 1.1,
    type: 'melee',
    morale: 30,
    experience: 12,
    canHunt: true,
    ability: 'piper_pit',
    abilityDesc: 'Pit Talk — buffs allies when he scores.',
    color: '#c06030',
  },
  hacksaw_duggan: {
    name: 'The Hacksaw Patriot',
    cost: 70,
    hp: 200,
    accuracy: 38,
    damage: 40,
    range: 28,
    meleeRange: 28,
    speed: 0.95,
    type: 'melee',
    morale: 32,
    experience: 9,
    canHunt: true,
    ability: 'usa',
    abilityDesc: 'Hacksaw Rally — rally pulse on wave start.',
    color: '#c04040',
  },
  junkyard_dog: {
    name: 'The Junkyard Bruiser',
    cost: 72,
    hp: 210,
    accuracy: 42,
    damage: 46,
    range: 28,
    meleeRange: 28,
    speed: 0.9,
    type: 'melee',
    morale: 28,
    experience: 10,
    canHunt: true,
    ability: 'headbutt',
    abilityDesc: 'Bruiser Headbutt — stuns on crit.',
    color: '#806040',
  },
  rey_mysterio: {
    name: 'The Luchador Phantom',
    cost: 78,
    hp: 140,
    accuracy: 55,
    damage: 38,
    range: 24,
    meleeRange: 24,
    speed: 1.45,
    type: 'melee',
    morale: 24,
    experience: 13,
    canHunt: true,
    ability: '619',
    abilityDesc: 'Luchador Spring — evasion, hard to pin.',
    color: '#4060c0',
  },
  eddie_guerrero: {
    name: 'The Latino Liege',
    cost: 80,
    hp: 165,
    accuracy: 54,
    damage: 44,
    range: 26,
    meleeRange: 26,
    speed: 1.15,
    type: 'melee',
    morale: 26,
    experience: 13,
    canHunt: true,
    ability: 'lie_cheat_steal',
    abilityDesc: "Liege's Gambit — steals TP on elite kill.",
    color: '#c0a040',
  },
  chris_benoit: {
    name: 'The Crippler Ace',
    cost: 82,
    hp: 175,
    accuracy: 56,
    damage: 50,
    range: 26,
    meleeRange: 26,
    speed: 1.1,
    type: 'melee',
    morale: 22,
    experience: 14,
    canHunt: true,
    ability: 'crippler',
    abilityDesc: 'Crippler Lock — high single-target DPS.',
    color: '#404040',
  },
  oba_femi: {
    name: 'The Rising Champion',
    cost: 86,
    hp: 220,
    accuracy: 48,
    damage: 54,
    range: 30,
    meleeRange: 30,
    speed: 1.0,
    type: 'melee',
    morale: 28,
    experience: 11,
    canHunt: true,
    ability: 'nigerian_nightmare',
    abilityDesc: 'Rising Fury — bonus damage when surrounded.',
    color: '#208040',
  },
  brock_lesnar: {
    name: 'The Beast Incarnate',
    cost: 105,
    hp: 290,
    accuracy: 46,
    damage: 68,
    range: 32,
    meleeRange: 32,
    speed: 0.95,
    type: 'melee',
    morale: 20,
    experience: 12,
    canHunt: true,
    ability: 'f5',
    abilityDesc: 'Beast Toss — deletes wounded targets.',
    color: '#c04040',
  },
  cm_punk: {
    name: 'The Straightedge Rebel',
    cost: 84,
    hp: 180,
    accuracy: 52,
    damage: 48,
    range: 26,
    meleeRange: 26,
    speed: 1.1,
    type: 'melee',
    morale: 30,
    experience: 13,
    canHunt: true,
    ability: 'go_to_sleep',
    abilityDesc: 'Rebel Sleeper — finisher on low HP targets.',
    color: '#303030',
  },
  seth_rollins: {
    name: 'The Architect',
    cost: 88,
    hp: 185,
    accuracy: 54,
    damage: 50,
    range: 180,
    meleeRange: 26,
    speed: 1.15,
    type: 'ranged',
    projectile: 'arrow',
    morale: 26,
    experience: 12,
    canHunt: true,
    ability: 'curb_stomp',
    abilityDesc: 'Architect Stomp — burst ranged finisher.',
    color: '#c04080',
  },
  sheamus: {
    name: 'The Celtic Warrior',
    cost: 80,
    hp: 220,
    accuracy: 44,
    damage: 52,
    range: 30,
    meleeRange: 30,
    speed: 0.9,
    type: 'melee',
    morale: 24,
    experience: 10,
    canHunt: true,
    ability: 'brogue_kick',
    abilityDesc: 'Celtic Kick — line cleave.',
    color: '#40a040',
  },
  bray_wyatt: {
    name: 'The Lantern Prophet',
    cost: 95,
    hp: 230,
    accuracy: 48,
    damage: 55,
    range: 150,
    meleeRange: 28,
    speed: 0.85,
    type: 'ranged',
    projectile: 'bolt',
    morale: 32,
    experience: 14,
    canHunt: true,
    ability: 'lantern',
    abilityDesc: 'Lantern Prophecy — fear aura blinds enemies; strongest when darkness falls.',
    color: '#304030',
  },
  randy_orton: {
    name: 'The Apex Predator',
    cost: 91,
    hp: 205,
    accuracy: 53,
    damage: 52,
    range: 28,
    meleeRange: 28,
    speed: 1.05,
    type: 'melee',
    morale: 27,
    experience: 13,
    canHunt: true,
    ability: 'rko',
    abilityDesc: 'Apex Drop — outta nowhere. Finisher devastates wounded foes.',
    color: '#304860',
  },
};

function getWweDef(type) {
  return WweDefs[type] || null;
}

function isWweUnit(type) {
  return !!WweDefs[type];
}

const WweAcademy = (() => {
  let selectedId = null;

  function canBuildAcademy(gs) {
    return (
      MetaProgress.isWweUnlocked() &&
      (gs.tactical ?? 0) >= WWE_ACADEMY_COST &&
      (gs.liveBuilders ?? 0) >= WWE_ACADEMY_BUILDERS
    );
  }

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

  return { init, togglePanel, renderRoster, canBuildAcademy, getSelected };
})();