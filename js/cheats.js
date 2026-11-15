/**
 * Cheat code menu and handlers.
 */
const Cheats = (() => {
  const CODES = {
    'quarry oath': {
      id: 'austin',
      message: 'THE QUARRYMAN’S OATH HOLDS — Champions’ Hall unlocked!',
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
      message: 'THE ARENA CALLS — Champions’ Hall unlocked!',
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
        'POWDERHORN COMPANY — Dunmar Fusewick, Aldous Verdigris, Otmar Caskwright & Isen Quillon unlocked! Build Powderhorn Barracks.',
      apply() {
        MetaProgress.unlock115();
      },
    },
    'first circle': {
      id: 'primus',
      message: 'PALE VIGIL — crew unlocked! Build the Pale Vigil Shrine.',
      apply() {
        MetaProgress.unlockPrimus();
      },
    },
    'orbital vanguard': {
      id: 'halo',
      message: 'GREYWATCH — Greywatch wardens & Greywatch Academy unlocked!',
      apply() {
        MetaProgress.unlockHalo();
      },
    },
    'iron trench': {
      id: 'gears',
      message: 'SAWTOOTH — Sawtooth crew & Sawtooth Academy unlocked!',
      apply() {
        MetaProgress.unlockGears();
      },
    },
    'ninefold march': {
      id: 'lotr',
      message: 'THE THORNROAD COMPANY — march company unlocked!',
      apply() {
        MetaProgress.unlockLotr();
      },
    },
    'iron pit': {
      id: 'hanma',
      message: 'KNUCKLEBONE — lodge fighters unlocked! Build the Knucklebone Lodge.',
      apply() {
        MetaProgress.unlockBaki();
      },
    },
    'bound spirit': {
      id: 'jojo',
      message:
        'Marrow Choir sigil — Marrow Choir heroes (Cohorts 1–7) unlocked! Cohort 7 = cavalry.',
      apply() {
        MetaProgress.unlockJojo();
      },
    },
    'spirit court': {
      id: 'jojo',
      message: 'THE MARROW CHOIR — Cohorts 1–7 unlocked! Gilded Derby cavalry ready.',
      apply() {
        MetaProgress.unlockJojo();
      },
    },
    'north star': {
      id: 'fotns',
      message: 'QUIET HAND — Seven Star Fist masters unlocked!',
      apply() {
        MetaProgress.unlockFotns();
      },
    },
    skyburst: {
      id: 'dragonball',
      message: 'EMBERBLOOD — Emberblood fighters unlocked! Build Emberblood Foundry.',
      apply() {
        MetaProgress.unlockDragonball();
      },
    },
    'crimson legions': {
      id: 'imperium',
      message: 'IRON PSALM — Iron Psalm brothers unlocked! Build the Iron Psalm Chapel.',
      apply() {
        MetaProgress.unlockImperium();
      },
    },
    'crystal light': {
      id: 'crystal',
      message: 'SALTGLASS — Saltglass Guild unlocked! Build the Saltglass Sanctum.',
      apply() {
        MetaProgress.unlockCrystal();
      },
    },
    'rift cult': {
      id: 'warp',
      message: 'OPEN WOUND — unlocked! Build the Open Wound Shrine.',
      apply() {
        MetaProgress.unlockWarp();
      },
    },
    'eternal crusade': {
      id: 'warhammer',
      message:
        'ETERNAL MARCH — Iron Psalm and Cult of the Open Wound unlocked! Faith & Rift. Build the Iron Psalm Chapel and Open Wound Shrine.',
      apply() {
        MetaProgress.unlockWarhammer();
      },
    },
    voicebound: {
      id: 'tes',
      message:
        'RIMEHOWL LEGACY — Rimehowl Pact roster unlocked! Voice shouts await. Build the Rimehowl Moot Hall.',
      apply() {
        MetaProgress.unlockTes();
      },
    },
    'open every gate': {
      id: 'onepiece',
      message:
        'ALL FRACTURES UNSEALED — ALL cheat content unlocked! Champions’ Hall, Hellbane, every evolved roster!',
      apply() {
        MetaProgress.unlockAllCheatContent();
        Achievements?.tryUnlock('doom_hero_unlock');
      },
    },
  };
  // Codes renamed with their places; players who learned the old words can still type them.
  const OLD_CODES = { 'iron creed': 'quarry oath' };

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
    const typed = normalize(code);
    const cheat = CODES[OLD_CODES[typed] || typed];
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
