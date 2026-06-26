/**
 * Cheat code menu and handlers.
 */
const Cheats = (() => {
  const CODES = {
    'austin 3:16': {
      id: 'austin',
      message: 'STONE COLD SAID SO — WWE Academy unlocked!',
      apply() {
        MetaProgress.unlockWweAcademy();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('cheat_austin');
          Achievements.tryUnlock('cheat_used');
          Achievements.tryUnlock('wwe_unlock');
        }
      },
    },
    'iddqd': {
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
    'rosebud': {
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
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('deploy_all_free');
      },
    },
    'gotta catch \'em all': {
      id: 'pokemon',
      message: 'Deploy one of every troop type FREE!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('deploy_all_free');
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
    'doomslayer': {
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
      message: 'WHATCHA GONNA DO — WWE Academy unlocked!',
      apply() {
        MetaProgress.unlockWweAcademy();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('wwe_unlock');
          Achievements.tryUnlock('cheat_used');
        }
      },
    },
    'it\'s morphin time': {
      id: 'rangers',
      message: 'GO GO POWER — +5 knights spawn!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('spawn_knights', 5);
      },
    },
    'its morphin time': {
      id: 'rangers',
      message: 'GO GO POWER — +5 knights spawn!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('spawn_knights', 5);
      },
    },
    '115': {
      id: 'cod115',
      message: '115 — Tank, Richtofen, Nikolai & Takeo unlocked! Build Element 115 Barracks.',
      apply() {
        MetaProgress.unlock115();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'primus': {
      id: 'primus',
      message: 'PRIMUS — Origins crew unlocked! Build the Primis Shrine.',
      apply() {
        MetaProgress.unlockPrimus();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'halo': {
      id: 'halo',
      message: 'HALO — UNSC heroes & Spartan Academy unlocked!',
      apply() {
        MetaProgress.unlockHalo();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'gears': {
      id: 'gears',
      message: 'GEARS — COG squad & Lancer Academy unlocked!',
      apply() {
        MetaProgress.unlockGears();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'one to rule them all': {
      id: 'lotr',
      message: 'ONE TO RULE THEM ALL — Fellowship of Middle-earth unlocked!',
      apply() {
        MetaProgress.unlockLotr();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'hanma': {
      id: 'hanma',
      message: 'HANMA — Baki fighters unlocked! Build the Hanma Dojo.',
      apply() {
        MetaProgress.unlockBaki();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'ジョジョの奇妙な冒険': {
      id: 'jojo',
      message: 'ジョジョの奇妙な冒険 — JoJo heroes (Parts 1–7) unlocked! Part 7 = cavalry.',
      apply() {
        MetaProgress.unlockJojo();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'jojos bizarre adventure': {
      id: 'jojo',
      message: 'JOJO\'S BIZARRE ADVENTURE — Parts 1–7 unlocked! Steel Ball Run cavalry ready.',
      apply() {
        MetaProgress.unlockJojo();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'fotns': {
      id: 'fotns',
      message: 'FOTNS — Hokuto Shinken masters unlocked!',
      apply() {
        MetaProgress.unlockFotns();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'dragon soul': {
      id: 'dragonball',
      message: 'DRAGON SOUL — Z-Fighters unlocked! Build Capsule Corp.',
      apply() {
        MetaProgress.unlockDragonball();
        Achievements?.tryUnlock('cheat_used');
      },
    },
    'the one piece is real': {
      id: 'onepiece',
      message: 'THE ONE PIECE IS REAL — ALL cheat content unlocked! WWE, Doomslayer, every crossover roster!',
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
    return Object.keys(CODES).map(k => `"${k}"`);
  }

  function getCheatList() {
    return [
      { code: 'Austin 3:16', effect: 'Unlock WWE Academy' },
      { code: 'whatcha gonna do', effect: 'Unlock WWE Academy (alias)' },
      { code: 'hell walks / Doomslayer', effect: 'Unlock Doomslayer hero' },
      { code: '115', effect: 'Unlock Element 115 crew (Tank, Richtofen, Nikolai, Takeo)' },
      { code: 'Primus', effect: 'Unlock Primis Origins crew' },
      { code: 'Halo', effect: 'Unlock UNSC heroes + Spartan Academy' },
      { code: 'Gears', effect: 'Unlock COG squad + Lancer Academy' },
      { code: 'One to Rule Them All', effect: 'Unlock LOTR Fellowship + Rivendell Camp' },
      { code: 'Hanma', effect: 'Unlock Baki fighters + Hanma Dojo' },
      { code: 'ジョジョの奇妙な冒険', effect: 'Unlock JoJo Parts 1–7 (Pt.7 = cavalry)' },
      { code: 'FOTNS', effect: 'Unlock Fist of the North Star fighters' },
      { code: 'Dragon Soul', effect: 'Unlock Dragon Ball Z-Fighters + Capsule Corp' },
      { code: 'THE ONE PIECE IS REAL', effect: 'Unlock ALL cheat content at once' },
      { code: 'IDDQD', effect: 'In-game: +500 TP, max morale' },
      { code: 'Rosebud', effect: 'In-game: +1000 TP' },
      { code: 'there can be only one', effect: 'In-game: clear all enemies' },
      { code: 'gotta catch em all', effect: 'In-game: deploy every troop type free' },
      { code: 'it\'s morphin time', effect: 'In-game: spawn 5 knights' },
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