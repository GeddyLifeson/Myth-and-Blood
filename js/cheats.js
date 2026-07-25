/**
 * Cheat code menu and handlers.
 */
const Cheats = (() => {
  const CODES = {
    'austin 3:16': {
      id: 'austin',
      message: 'THE STONEBREAKER SAID SO — Grand Coliseum unlocked!',
      apply() {
        MetaProgress.unlockWweAcademy();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('cheat_austin');
          Achievements.tryUnlock('cheat_used');
          Achievements.tryUnlock('wwe_unlock');
        }
      },
    },
    iddqd: {
      id: 'godmode',
      message: 'IDDQD — +500 TP and full morale!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) {
          Game.applyCheatEffect('tp', 500);
          Game.applyCheatEffect('morale', 99);
        }
      },
    },
    rosebud: {
      id: 'rosebud',
      message: 'ROSEBUD — +1000 Simoleons... I mean TP!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('tp', 1000);
      },
    },
    'there can be only one': {
      id: 'highlander',
      message: 'THERE CAN BE ONLY ONE — all enemies on field eliminated!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('clear_enemies');
      },
    },
    'gotta catch em all': {
      id: 'pokemon',
      message: 'Deploy one of every troop type FREE!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying())
          Game.applyCheatEffect('deploy_all_free');
      },
    },
    "gotta catch 'em all": {
      id: 'pokemon',
      message: 'Deploy one of every troop type FREE!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying())
          Game.applyCheatEffect('deploy_all_free');
      },
    },
    'hell walks': {
      id: 'doomhero',
      message: 'HELL WALKS — Doomslayer hero unlocked!',
      apply() {
        MetaProgress.unlockDoomslayerHero();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('doom_hero_unlock');
          Achievements.tryUnlock('cheat_used');
        }
      },
    },
    doomslayer: {
      id: 'doomslayer',
      message: 'DOOMSLAYER — The hero walks among mortals!',
      apply() {
        MetaProgress.unlockDoomslayerHero();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('doom_hero_unlock');
          Achievements.tryUnlock('cheat_used');
        }
      },
    },
    'whatcha gonna do': {
      id: 'wwe',
      message: 'WHAT ARE YOU GONNA DO — Grand Coliseum unlocked!',
      apply() {
        MetaProgress.unlockWweAcademy();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('wwe_unlock');
          Achievements.tryUnlock('cheat_used');
        }
      },
    },
    "it's morphin time": {
      id: 'rangers',
      message: 'GO GO POWER — +5 knights spawn!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying())
          Game.applyCheatEffect('spawn_knights', 5);
      },
    },
    'its morphin time': {
      id: 'rangers',
      message: 'GO GO POWER — +5 knights spawn!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying())
          Game.applyCheatEffect('spawn_knights', 5);
      },
    },
    115: {
      id: 'cod115',
      message: '115 — Splinter Vale, Dr. Volkov, Brass Kozlov & Blade Sato unlocked! Build Void Residue Barracks.',
      apply() {
        MetaProgress.unlock115();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('ultimis_unlock');
      },
    },
    primus: {
      id: 'primus',
      message: 'PRIMUS — First Circle crew unlocked! Build the First Circle Shrine.',
      apply() {
        MetaProgress.unlockPrimus();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('primis_unlock');
      },
    },
    halo: {
      id: 'halo',
      message: 'ORBITAL VANGUARD — Orbital heroes & Vanguard Academy unlocked!',
      apply() {
        MetaProgress.unlockHalo();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('halo_unlock');
      },
    },
    gears: {
      id: 'gears',
      message: 'IRON TRENCH — Trench squad & Lancer Academy unlocked!',
      apply() {
        MetaProgress.unlockGears();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('gears_unlock');
      },
    },
    'one to rule them all': {
      id: 'lotr',
      message: 'NINE RINGS FALL — Fellowship of Ninefold March unlocked!',
      apply() {
        MetaProgress.unlockLotr();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('lotr_unlock');
      },
    },
    hanma: {
      id: 'hanma',
      message: 'HANMA — pit fighters unlocked! Build the Iron Pit Guild.',
      apply() {
        MetaProgress.unlockBaki();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('baki_unlock');
      },
    },
    'ジョジョの奇妙な冒険': {
      id: 'jojo',
      message: 'Spirit Court sigil — bound spirit heroes (Parts 1–7) unlocked! Part 7 = cavalry.',
      apply() {
        MetaProgress.unlockJojo();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('jojo_unlock');
      },
    },
    'jojos bizarre adventure': {
      id: 'jojo',
      message: 'BOUND SPIRIT COURT — Parts 1–7 unlocked! Golden Ball Run cavalry ready.',
      apply() {
        MetaProgress.unlockJojo();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('jojo_unlock');
      },
    },
    fotns: {
      id: 'fotns',
      message: 'FOTNS — North Star Fist masters unlocked!',
      apply() {
        MetaProgress.unlockFotns();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('fotns_unlock');
      },
    },
    'dragon soul': {
      id: 'dragonball',
      message: 'SKYBURST SOUL — skyburst fighters unlocked! Build Skyburst Foundry.',
      apply() {
        MetaProgress.unlockDragonball();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('dragonball_unlock');
      },
    },
    'for the emperor': {
      id: 'imperium',
      message: "FOR THE CRIMSON THRONE — crimson legion unlocked! Build the Crimson Chapel.",
      apply() {
        MetaProgress.unlockImperium();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'crystal light': {
      id: 'crystal',
      message: 'CRYSTAL LIGHT — Crystal Vanguard unlocked! Build the Crystal Sanctum.',
      apply() {
        MetaProgress.unlockCrystal();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'let the galaxy burn': {
      id: 'warp',
      message: 'LET THE GALAXY BURN — Rift Cult unlocked! Build the Rift Cult Shrine.',
      apply() {
        MetaProgress.unlockWarp();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'eternal crusade': {
      id: 'warhammer',
      message:
        "ETERNAL MARCH — Crimson Legions and Rift Cult unlocked! Faith & Rift. Build the Crimson Chapel and Warp Shrine.",
      apply() {
        MetaProgress.unlockWarhammer();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('warhammer_unlock');
      },
    },
    'dragonborn legacy': {
      id: 'tes',
      message:
        "WYRM CALLER LEGACY — Voicebound Pact roster unlocked! Voice shouts await. Build the Wyrmcaller Moot Hall.",
      apply() {
        MetaProgress.unlockTes();
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('tes_unlock');
      },
    },
    'the one piece is real': {
      id: 'onepiece',
      message:
        'ALL FRACTURES UNSEALED — ALL cheat content unlocked! Coliseum, Doomslayer, every evolved roster!',
      apply() {
        MetaProgress.unlockAllCheatContent();
        Achievements?.tryUnlock('wwe_unlock');
        Achievements?.tryUnlock('doom_hero_unlock');
        Achievements?.tryUnlock('cheat_used');
        Achievements?.tryUnlock('one_piece_real');
      },
    },
  };

  let lastMessage = '';

  function normalize(code) {
    return code.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function submit(code) {
    const key = normalize(code);
    const cheat = CODES[key];
    if (!cheat) {
      lastMessage = 'Unknown cheat code.';
      return false;
    }
    MetaProgress.recordCheat(cheat.id);
    const wasPlaying = typeof Game !== 'undefined' && Game.isPlaying();
    cheat.apply();
    if (cheat.inGameOnly && !wasPlaying) {
      lastMessage = `${cheat.message} (Start a battle first — this code only works in-game.)`;
    } else {
      lastMessage = cheat.message;
    }
    if (typeof Achievements !== 'undefined' && cheat.id !== 'austin') {
      Achievements.tryUnlock('cheat_used');
    }
    AudioEngine?.SFX?.reinforce?.();
    return true;
  }

  function getLastMessage() {
    return lastMessage;
  }

  function getCodeHints() {
    return Object.keys(CODES).map((k) => `"${k}"`);
  }

  function getCheatList() {
    return [
      { code: 'Austin 3:16', effect: 'Unlock Grand Coliseum' },
      { code: 'whatcha gonna do', effect: 'Unlock Grand Coliseum (alias)' },
      { code: 'hell walks / Doomslayer', effect: 'Unlock Doomslayer hero' },
      { code: '115', effect: 'Unlock Void Residue crew (Splinter Vale, Dr. Volkov, Brass Kozlov, Blade Sato)' },
      { code: 'Primus', effect: 'Unlock First Circle crew' },
      { code: 'Halo', effect: 'Unlock Orbital heroes + Vanguard Academy' },
      { code: 'Gears', effect: 'Unlock Trench squad + Lancer Academy' },
      { code: 'One to Rule Them All', effect: 'Unlock Ninefold Fellowship + March Camp' },
      { code: 'Hanma', effect: 'Unlock pit fighters + Iron Pit Guild' },
      { code: 'Spirit Court sigil', effect: 'Unlock Bound Spirit Court (Parts 1–7) (Pt.7 = cavalry)' },
      { code: 'FOTNS', effect: 'Unlock North Star Ascetic fighters' },
      { code: 'Dragon Soul', effect: 'Unlock Skyburst Order + Skyburst Foundry' },
      { code: 'ALL FRACTURES UNSEALED', effect: 'Unlock ALL cheat content at once' },
      { code: 'IDDQD', effect: 'In-game: +500 TP, max morale' },
      { code: 'Rosebud', effect: 'In-game: +1000 TP' },
      { code: 'there can be only one', effect: 'In-game: clear all enemies' },
      { code: 'gotta catch em all', effect: 'In-game: deploy every troop type free' },
      { code: "it's morphin time", effect: 'In-game: spawn 5 knights' },
    ];
  }

  function togglePanel() {
    const panel = document.getElementById('cheats-screen');
    if (!panel) return;
    panel.classList.toggle('active');
    const msg = document.getElementById('cheat-result');
    if (msg) msg.textContent = lastMessage || 'Enter a cheat code below.';
  }

  function init() {
    MetaProgress.load();
    document.getElementById('menu-cheats-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      togglePanel();
    });
    document.getElementById('cheats-close')?.addEventListener('click', () => {
      document.getElementById('cheats-screen')?.classList.remove('active');
    });
    document.getElementById('cheat-submit')?.addEventListener('click', () => {
      const input = document.getElementById('cheat-input');
      if (!input) return;
      submit(input.value);
      const msg = document.getElementById('cheat-result');
      if (msg) msg.textContent = lastMessage;
      input.value = '';
      AudioEngine?.SFX?.click?.();
    });
    document.getElementById('cheat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('cheat-submit')?.click();
    });
  }

  return { init, submit, togglePanel, getLastMessage, getCodeHints, getCheatList, normalize };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Cheats = Cheats;
