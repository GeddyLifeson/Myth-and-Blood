/**
 * Cheat code menu and handlers.
 */
const Cheats = (() => {
  const CODES = {
    'iron creed': {
      id: 'austin',
      message: 'THE IRON CREED HOLDS — Grand Coliseum unlocked!',
      apply() {
        MetaProgress.unlockWweAcademy();
      },
    },
    'kings ransom': {
      id: 'godmode',
      message: 'KING\u2019S RANSOM — +500 TP and full morale!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) {
          Game.applyCheatEffect('tp', 500);
          Game.applyCheatEffect('morale', 99);
        }
      },
    },
    'war chest': {
      id: 'rosebud',
      message: 'WAR CHEST — +1000 TP!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('tp', 1000);
      },
    },
    'clear the field': {
      id: 'highlander',
      message: 'FIELD CLEARED — all enemies on field eliminated!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying()) Game.applyCheatEffect('clear_enemies');
      },
    },
    'muster all': {
      id: 'pokemon',
      message: 'Deploy one of every troop type FREE!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying())
          Game.applyCheatEffect('deploy_all_free');
      },
    },
    'muster everyone': {
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
      message: 'HELL WALKS — Hellbane hero unlocked!',
      apply() {
        MetaProgress.unlockDoomslayerHero();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('doom_hero_unlock');
        }
      },
    },
    hellbane: {
      id: 'doomslayer',
      message: 'HELLBANE — The hero walks among mortals!',
      apply() {
        MetaProgress.unlockDoomslayerHero();
        if (typeof Achievements !== 'undefined') {
          Achievements.tryUnlock('doom_hero_unlock');
        }
      },
    },
    'arena calls': {
      id: 'wwe',
      message: 'THE ARENA CALLS — Grand Coliseum unlocked!',
      apply() {
        MetaProgress.unlockWweAcademy();
      },
    },
    'knights assemble': {
      id: 'rangers',
      message: 'KNIGHTS ASSEMBLE — +5 knights spawn!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying())
          Game.applyCheatEffect('spawn_knights', 5);
      },
    },
    'knights, assemble': {
      id: 'rangers',
      message: 'KNIGHTS ASSEMBLE — +5 knights spawn!',
      inGameOnly: true,
      apply() {
        if (typeof Game !== 'undefined' && Game.isPlaying())
          Game.applyCheatEffect('spawn_knights', 5);
      },
    },
    'void residue': {
      id: 'cod115',
      message:
        'POWDERHORN COMPANY — Dunmar Fusewick, Aldous Verdigris, Otmar Caskwright & Isen Quillon unlocked! Build Void Residue Barracks.',
      apply() {
        MetaProgress.unlock115();
      },
    },
    'first circle': {
      id: 'primus',
      message: 'FIRST CIRCLE — crew unlocked! Build the First Circle Shrine.',
      apply() {
        MetaProgress.unlockPrimus();
      },
    },
    'orbital vanguard': {
      id: 'halo',
      message: 'ORBITAL VANGUARD — Orbital heroes & Vanguard Academy unlocked!',
      apply() {
        MetaProgress.unlockHalo();
      },
    },
    'iron trench': {
      id: 'gears',
      message: 'IRON TRENCH — Trench squad & Trenchsaw Academy unlocked!',
      apply() {
        MetaProgress.unlockGears();
      },
    },
    'ninefold march': {
      id: 'lotr',
      message: 'THE NINEFOLD MARCH — march company unlocked!',
      apply() {
        MetaProgress.unlockLotr();
      },
    },
    'iron pit': {
      id: 'hanma',
      message: 'IRON PIT — pit fighters unlocked! Build the Iron Pit Guild.',
      apply() {
        MetaProgress.unlockBaki();
      },
    },
    'bound spirit': {
      id: 'jojo',
      message:
        'Spirit Court sigil — bound spirit heroes (Cohorts 1–7) unlocked! Cohort 7 = cavalry.',
      apply() {
        MetaProgress.unlockJojo();
      },
    },
    'spirit court': {
      id: 'jojo',
      message: 'BOUND SPIRIT COURT — Cohorts 1–7 unlocked! Gilded Derby cavalry ready.',
      apply() {
        MetaProgress.unlockJojo();
      },
    },
    'north star': {
      id: 'fotns',
      message: 'NORTH STAR — Seven Star Fist masters unlocked!',
      apply() {
        MetaProgress.unlockFotns();
      },
    },
    skyburst: {
      id: 'dragonball',
      message: 'SKYBURST SOUL — skyburst fighters unlocked! Build Skyburst Foundry.',
      apply() {
        MetaProgress.unlockDragonball();
      },
    },
    'crimson legions': {
      id: 'imperium',
      message: 'FOR THE CRIMSON THRONE — crimson legion unlocked! Build the Crimson Chapel.',
      apply() {
        MetaProgress.unlockImperium();
      },
    },
    'crystal light': {
      id: 'crystal',
      message: 'CRYSTAL LIGHT — Crystal Vanguard unlocked! Build the Crystal Sanctum.',
      apply() {
        MetaProgress.unlockCrystal();
      },
    },
    'rift cult': {
      id: 'warp',
      message: 'RIFT CULT — unlocked! Build the Rift Cult Shrine.',
      apply() {
        MetaProgress.unlockWarp();
      },
    },
    'eternal crusade': {
      id: 'warhammer',
      message:
        'ETERNAL MARCH — Crimson Legions and Rift Cult unlocked! Faith & Rift. Build the Crimson Chapel and Warp Shrine.',
      apply() {
        MetaProgress.unlockWarhammer();
      },
    },
    voicebound: {
      id: 'tes',
      message:
        'WYRM CALLER LEGACY — Voicebound Pact roster unlocked! Voice shouts await. Build the Wyrmcaller Moot Hall.',
      apply() {
        MetaProgress.unlockTes();
      },
    },
    'open every gate': {
      id: 'onepiece',
      message:
        'ALL FRACTURES UNSEALED — ALL cheat content unlocked! Coliseum, Hellbane, every evolved roster!',
      apply() {
        MetaProgress.unlockAllCheatContent();
        Achievements?.tryUnlock('doom_hero_unlock');
      },
    },
  };

  let lastMessage = '';
  let pendingRunMark = false;

  /** Read once by Game.start(): was a code entered on the menu since the last run began? */
  function takePendingRunMark() {
    const marked = pendingRunMark;
    pendingRunMark = false;
    return marked;
  }

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
    // Every code voids a run: the one in progress, or (for a code entered on the menu) the
    // next one started. A voided run records no score, ribbon progress or achievements.
    if (wasPlaying && Game.markCheatsUsed) Game.markCheatsUsed();
    else pendingRunMark = true;
    cheat.apply();
    if (cheat.inGameOnly && !wasPlaying) {
      lastMessage = `${cheat.message} (Start a battle first — this code only works in-game.)`;
    } else {
      lastMessage = cheat.message;
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

  function togglePanel() {
    const panel = document.getElementById('cheats-screen');
    if (!panel) return;
    panel.classList.toggle('active');
    const msg = document.getElementById('cheat-result');
    if (msg) msg.textContent = lastMessage || 'Enter a cheat code above.';
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

  return {
    init,
    submit,
    togglePanel,
    getLastMessage,
    getCodeHints,
    normalize,
    takePendingRunMark,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Cheats = Cheats;
