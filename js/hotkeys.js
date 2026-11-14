/**
 * Hotkeys — one key map per game state, as plain data.
 *
 * KEYMAPS[state] is a list of bindings { key, action, arg, label }. A key appears at most
 * once in a state (validate() reports any duplicate; scripts/test-hotkeys.mjs fails on one).
 * js/main.js turns a key press into a state, looks the key up here and runs the action;
 * buttons, tooltips and the "?" key sheet read the same lists, so what is shown is what works.
 *
 * Key spelling: lower-case KeyboardEvent.key ("q", "[", "escape", "space", "f3"), digits
 * taken from the physical key so Shift+digit works ("shift+1"), "shift+tab", "alt+" for Alt.
 *
 * Three keys mean the same thing wherever they are bound: Space pauses (or resumes), Tab
 * selects the next soldier, Escape cancels what is armed or selected (and only opens the
 * pause menu when there is nothing to cancel).
 *
 * Modifiers are written in the order ctrl+alt+shift+key. Controller buttons are spelled
 * "pad:a", "pad:lb", "pad:up" and live in the same maps as a second binding of an action.
 *
 * Rebinding: every binding has an id ("action:arg"). rebind() stores an override per state
 * and id, refuses a key already used in that state (and offers a swap), refuses reserved
 * keys, and saves the table in localStorage. keyFor() is the one lookup everything else uses.
 */
const Hotkeys = (() => {
  const STATES = [
    'menu',
    'night',
    'day',
    'unit_selected',
    'building_selected',
    'placement',
    'placement_wall',
    'pause',
    'spoils',
    'gameover',
    'creative',
  ];

  const STATE_LABELS = {
    menu: 'Main menu',
    night: 'Night — preparing',
    day: 'Day — under attack',
    unit_selected: 'Soldiers selected',
    building_selected: 'Building picked up',
    placement: 'Placing or aiming',
    placement_wall: 'Placing a wall',
    pause: 'Paused',
    spoils: 'Spoils of war',
    gameover: 'After the battle',
    creative: 'Creative mode',
  };

  /** Recruit buttons in panel order. Keys go to the unlocked ones (see deploySlots). */
  const DEPLOY_ORDER = [
    'footman',
    'archer',
    'crossbowman',
    'mage',
    'cavalry',
    'healer',
    'knight',
    'sapper',
    'scout',
    'bard',
    'ballista',
    'pikeman',
    'general',
    'doomslayer_hero',
    'builder',
    'courier',
  ];

  const SLOT_KEYS = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '0',
    'shift+1',
    'shift+2',
    'shift+3',
    'shift+4',
    'shift+5',
    'shift+6',
    'shift+7',
    'shift+8',
    'shift+9',
    'shift+0',
  ];

  /** Extra buildings (those with no letter of their own), in panel order, as unlocked. */
  const BUILD_SLOT_KEYS = 'asdfghjklcvbnm'.split('').map((k) => `alt+${k}`);
  /** Spy actions and courier messages, in panel order, as unlocked. */
  const SPY_SLOT_KEYS = 'qwertyuiopzxc'.split('').map((k) => `shift+${k}`);
  const COURIER_SLOT_KEYS = 'qwertyuiopzx'.split('').map((k) => `alt+${k}`);

  /** Space, Tab and Escape mean the same thing everywhere and cannot be moved or reused. */
  const FIXED_KEYS = ['space', 'tab', 'escape'];
  /** Keys the browser or the system keeps for itself. */
  const RESERVED = [
    'f1',
    'f5',
    'f11',
    'f12',
    'ctrl+w',
    'ctrl+q',
    'ctrl+shift+w',
    'ctrl+shift+t',
    'ctrl+shift+n',
    'ctrl+shift+i',
    'ctrl+shift+j',
    'ctrl+shift+c',
    'ctrl+shift+r',
    'ctrl+shift+delete',
    'ctrl+t',
    'ctrl+n',
    'ctrl+r',
    'ctrl+l',
    'ctrl+c',
    'ctrl+v',
    'ctrl+x',
    'ctrl+z',
    'ctrl+y',
    'ctrl+f',
    'ctrl+p',
    'ctrl+s',
    'ctrl+o',
    'ctrl+h',
    'ctrl+j',
    'ctrl+d',
    'ctrl+u',
    'ctrl+=',
    'ctrl+-',
    'ctrl+0',
    'ctrl+tab',
    'ctrl+shift+tab',
    'ctrl+f4',
    'ctrl+f5',
    'alt+f4',
    'alt+tab',
    'alt+space',
    'alt+arrowleft',
    'alt+arrowright',
    'alt+home',
    'contextmenu',
    'printscreen',
  ];

  const idOf = (action, arg) => `${action}:${arg ?? ''}`;
  const bind = (key, action, label, arg) => ({
    key,
    action,
    label,
    arg: arg ?? null,
    id: (String(key).startsWith('pad:') ? 'pad|' : '') + idOf(action, arg),
    pad: String(key).startsWith('pad:'),
    // F3 is read by js/perf.js itself, so moving it here would only make the list lie.
    fixed: FIXED_KEYS.includes(key) || action === 'perf',
  });

  // ---- groups ------------------------------------------------------------------------
  const GLOBAL = [
    bind('?', 'keySheet', 'Show the keys for this screen'),
    bind('v', 'mute', 'Mute / unmute sound'),
    bind('a', 'achievements', 'Achievements'),
    bind('i', 'encyclopedia', 'Encyclopedia'),
    bind('`', 'cheats', 'Cheat codes'),
    bind('f3', 'perf', 'Performance overlay'),
    bind('f10', 'bugReport', 'Bug report'),
  ];

  const CAMERA = [
    bind('arrowup', 'pan', 'Pan the map up', 'arrowup'),
    bind('arrowdown', 'pan', 'Pan the map down', 'arrowdown'),
    bind('arrowleft', 'pan', 'Pan the map left', 'arrowleft'),
    bind('arrowright', 'pan', 'Pan the map right', 'arrowright'),
  ];

  const FIELD = [
    bind('space', 'pause', 'Pause'),
    bind('tab', 'cycleSoldier', 'Select the next soldier'),
    bind('shift+tab', 'cycleSoldierBack', 'Select the previous soldier'),
    bind('shift+m', 'messageLog', 'Message log'),
    bind('ctrl+a', 'selectAll', 'Select every soldier'),
    bind('shift+g', 'centreGeneral', 'Centre on the General'),
    bind('shift+b', 'centreBreach', 'Centre on the last breach'),
    bind('=', 'speedUp', 'Game speed up'),
    bind('-', 'speedDown', 'Game speed down'),
    bind('f6', 'quickSave', 'Quick save'),
    bind('f9', 'quickLoad', 'Quick load'),
    bind('delete', 'demolish', 'Demolish a building'),
    bind('\\', 'moveBuilding', 'Move a building'),
    bind('h', 'hunt', 'Hunt: release Hold'),
    bind('shift+h', 'holdHere', 'Hold here'),
    bind('[', 'order', 'War Cry (General)', 'warCry'),
    bind(']', 'order', 'Hold the Line (General)', 'holdLine'),
    bind('z', 'loadout', 'Balanced loadout', 'balanced'),
    bind('d', 'beginDay', 'Begin the day (night only)'),
    ...CAMERA,
  ];

  const STRIKES = [
    bind('q', 'ability', 'Fireball', 'fireball'),
    bind('w', 'ability', 'Lightning', 'lightning'),
    bind('e', 'ability', 'Healing Rain', 'heal'),
    bind('r', 'ability', 'Reinforcements', 'reinforce'),
    bind('t', 'ability', 'Battle Rally', 'rally'),
    bind('f', 'ability', 'Meteor Shower', 'meteor'),
    bind('j', 'ability', 'Frost Nova', 'frost_nova'),
    bind('k', 'ability', 'Scout Flare', 'scout_flare'),
    bind('x', 'ability', 'Fortify Zone', 'fortify'),
    bind('p', 'ability', 'Arcane Dispel', 'dispel'),
    bind('s', 'ability', 'Voice Shout', 'fus_ro_dah'),
    bind(';', 'ability', 'Fire Breath', 'fire_breath'),
    bind("'", 'ability', 'Ice Form', 'ice_form'),
  ];

  const DEPLOY = SLOT_KEYS.map((key, i) => bind(key, 'deploySlot', `Recruit slot ${i + 1}`, i));

  const BUILDS = [
    bind('o', 'build', 'Outpost', 'outpost'),
    bind('l', 'build', 'Wall', 'wall'),
    bind('c', 'build', 'Castle', 'castle'),
    bind('n', 'build', 'Medical Tent', 'medical_tent'),
    bind('m', 'build', 'Mess Hall', 'mess_hall'),
    bind('g', 'build', 'Hamlet', 'hamlet'),
    bind('u', 'build', 'Merchant Guild', 'merchant_guild'),
    bind('y', 'build', 'Watchtower', 'watchtower'),
    bind('b', 'build', 'Trade Outpost', 'trade_outpost'),
  ];

  const BUILD_SLOTS = BUILD_SLOT_KEYS.map((key, i) =>
    bind(key, 'buildSlot', `Extra building ${i + 1}`, i)
  );
  const SPY_SLOTS = SPY_SLOT_KEYS.map((key, i) => bind(key, 'spySlot', `Spy action ${i + 1}`, i));
  const COURIER_SLOTS = COURIER_SLOT_KEYS.map((key, i) =>
    bind(key, 'courierSlot', `Courier message ${i + 1}`, i)
  );
  // Saving with nothing selected clears the group. A saved group takes over its digit:
  // 1-9 recall it (see deploySlot in js/main.js) until it is cleared.
  const GROUPS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
    bind(`ctrl+${n}`, 'saveGroup', `Save the selection as group ${n}`, n)
  );

  // Controller. The left stick counts as the d-pad (see padKeys).
  const PAD_FIELD = [
    bind('pad:up', 'pan', 'Pan the map up', 'arrowup'),
    bind('pad:down', 'pan', 'Pan the map down', 'arrowdown'),
    bind('pad:left', 'pan', 'Pan the map left', 'arrowleft'),
    bind('pad:right', 'pan', 'Pan the map right', 'arrowright'),
    bind('pad:rb', 'cycleSoldier', 'Select the next soldier'),
    bind('pad:lb', 'cycleSoldierBack', 'Select the previous soldier'),
    bind('pad:start', 'pause', 'Pause'),
    bind('pad:x', 'hunt', 'Hunt: release Hold'),
    bind('pad:y', 'holdHere', 'Hold here'),
  ];

  const SELECTION = [
    bind('shift+a', 'selectAllType', 'Select every soldier of this type'),
    bind('f', 'focusSelection', 'Centre the view on the selection'),
    bind('c', 'clearSelection', 'Clear the selection'),
    bind('b', 'backToPosts', 'Send them back to their posts'),
    bind('g', 'reform', 'Reform the formation (two or more)'),
    bind('u', 'promote', 'Promote the selected veteran'),
    bind('alt+1', 'formation', 'Formation: line', 'line'),
    bind('alt+2', 'formation', 'Formation: column', 'column'),
    bind('alt+3', 'formation', 'Formation: wedge', 'wedge'),
    bind('alt+4', 'formation', 'Formation: box', 'box'),
    bind('alt+5', 'formation', 'Formation: spread', 'spread'),
  ];

  const without = (list, ...keys) => list.filter((b) => !keys.includes(b.key));

  // ---- one map per state --------------------------------------------------------------
  function buildMaps() {
    const field = [
      ...GLOBAL,
      ...FIELD,
      ...STRIKES,
      ...DEPLOY,
      ...BUILDS,
      ...BUILD_SLOTS,
      ...SPY_SLOTS,
      ...COURIER_SLOTS,
      ...GROUPS,
      ...PAD_FIELD,
    ];
    const slots = [...BUILD_SLOTS, ...SPY_SLOTS, ...COURIER_SLOTS, ...GROUPS, ...PAD_FIELD];
    const padA = (action, label, arg) => bind('pad:a', action, label, arg);
    const padB = (action, label, arg) => bind('pad:b', action, label, arg);
    return {
      menu: [
        ...GLOBAL,
        bind('enter', 'startRun', 'Begin the defense'),
        bind('escape', 'closePanel', 'Close the open panel'),
        padA('startRun', 'Begin the defense'),
        padB('closePanel', 'Close the open panel'),
      ],
      night: [
        ...field,
        bind('escape', 'pauseMenu', 'Pause menu'),
        padA('beginDay', 'Begin the day (night only)'),
        padB('pauseMenu', 'Pause menu'),
      ],
      // Same keys as night; D does nothing by day and is left out of the sheet.
      day: [
        ...without(field, 'd'),
        bind('escape', 'pauseMenu', 'Pause menu'),
        padB('pauseMenu', 'Pause menu'),
      ],
      unit_selected: [
        ...GLOBAL,
        ...FIELD,
        ...without(STRIKES, 'f'),
        ...DEPLOY,
        ...without(BUILDS, 'c', 'g', 'b', 'u'),
        ...slots,
        ...SELECTION,
        bind('escape', 'clearSelection', 'Deselect'),
        padA('focusSelection', 'Centre the view on the selection'),
        padB('clearSelection', 'Deselect'),
      ],
      building_selected: [
        ...field,
        bind('escape', 'cancel', 'Put the building back'),
        padB('cancel', 'Put the building back'),
      ],
      placement: [...field, bind('escape', 'cancel', 'Cancel'), padB('cancel', 'Cancel')],
      placement_wall: [
        ...without(field, 'r'),
        bind('r', 'rotateWall', 'Turn the wall before placing'),
        bind('escape', 'cancel', 'Cancel'),
        padB('cancel', 'Cancel'),
      ],
      pause: [
        ...GLOBAL,
        bind('space', 'resume', 'Resume'),
        bind('escape', 'resume', 'Resume'),
        bind('shift+m', 'messageLog', 'Message log'),
        bind('f6', 'quickSave', 'Quick save'),
        bind('f9', 'quickLoad', 'Quick load'),
        padA('resume', 'Resume'),
        bind('pad:start', 'resume', 'Resume'),
        padB('resume', 'Resume'),
      ],
      // A modal choice: nothing else works until one reward is taken.
      spoils: [
        bind('1', 'spoilPick', 'Take the first reward', 0),
        bind('2', 'spoilPick', 'Take the second reward', 1),
        bind('3', 'spoilPick', 'Take the third reward', 2),
        bind('arrowleft', 'spoilMove', 'Previous reward', -1),
        bind('arrowup', 'spoilMove', 'Previous reward', -1),
        bind('arrowright', 'spoilMove', 'Next reward', 1),
        bind('arrowdown', 'spoilMove', 'Next reward', 1),
        bind('tab', 'spoilMove', 'Next reward', 1),
        bind('enter', 'spoilConfirm', 'Take the highlighted reward'),
        bind('pad:left', 'spoilMove', 'Previous reward', -1),
        bind('pad:right', 'spoilMove', 'Next reward', 1),
        padA('spoilConfirm', 'Take the highlighted reward'),
      ],
      gameover: [
        ...GLOBAL,
        bind('enter', 'restart', 'Fight again'),
        bind('escape', 'closePanel', 'Close the open panel'),
        padA('restart', 'Fight again'),
        padB('closePanel', 'Close the open panel'),
      ],
      creative: [
        ...GLOBAL,
        ...FIELD,
        ...without(STRIKES, 'p'),
        ...DEPLOY,
        ...BUILDS,
        ...slots,
        bind('p', 'creativePanel', 'Creative Lab panel'),
        bind('escape', 'pauseMenu', 'Pause menu'),
        padA('beginDay', 'Begin the day (night only)'),
        padB('pauseMenu', 'Pause menu'),
      ],
    };
  }

  /**
   * Things you can do that have no key on purpose. `match` is "kind:id" or "kind:*".
   * scripts/test-hotkeys.mjs checks that every button is either bound or listed here.
   */
  const UNBOUND_BY_DESIGN = [
    {
      match: 'loadout:*',
      why: 'Kingdom loadouts past Balanced (Z): a late-game panel, one click per run',
    },
    { match: 'doctrine:*', why: 'Doctrines: once per wave, from their panel' },
    {
      match: 'build:overflow',
      why: `Extra buildings past the ${BUILD_SLOT_KEYS.length} slot keys`,
    },
    { match: 'spy:overflow', why: `Spy actions past the ${SPY_SLOT_KEYS.length} slot keys` },
    {
      match: 'courier:overflow',
      why: `Courier messages past the ${COURIER_SLOT_KEYS.length} slot keys`,
    },
    {
      match: 'menu:restartWave',
      why: 'Restart wave and Main menu: they end the battle, so they stay on buttons',
    },
    {
      match: 'panel:*',
      why: 'Research, threat map and settings panels: opened from their buttons',
    },
    { match: 'creative:tools', why: 'Creative Lab tools: chosen in the Lab panel (P)' },
    { match: 'pad:place', why: 'Controller: placing a troop or building needs a pointer' },
  ];

  // ---- defaults, overrides, the live maps ----------------------------------------------
  const STORAGE_KEY = 'myth-and-blood-keys-v1';
  const DEFAULTS = buildMaps();
  /** { state: { id: key | null } } — only what differs from the defaults. */
  let overrides = {};
  const KEYMAPS = {};
  const INDEX = {};
  const listeners = [];

  function rebuild() {
    for (const s of STATES) {
      const ov = overrides[s] || {};
      const list = DEFAULTS[s].map((b) => ({ ...b, key: b.id in ov ? ov[b.id] : b.key }));
      if (!KEYMAPS[s]) KEYMAPS[s] = [];
      KEYMAPS[s].length = 0;
      KEYMAPS[s].push(...list);
      INDEX[s] = {};
      for (const b of list) if (b.key != null && !(b.key in INDEX[s])) INDEX[s][b.key] = b;
    }
  }

  function findDuplicates(maps) {
    const out = [];
    for (const s of STATES) {
      const seen = {};
      for (const b of maps[s] || []) {
        if (b.key == null) continue;
        (seen[b.key] = seen[b.key] || []).push(b);
      }
      for (const key of Object.keys(seen)) {
        if (seen[key].length > 1) {
          out.push({ state: s, key, actions: seen[key].map((b) => `${b.action}:${b.arg ?? ''}`) });
        }
      }
    }
    return out;
  }

  /** Every key bound twice in one state: [{ state, key, actions }]. Empty when sound. */
  function validate() {
    return findDuplicates(KEYMAPS);
  }

  function isReserved(key) {
    if (key == null) return false;
    if (FIXED_KEYS.includes(key) || RESERVED.includes(key)) return true;
    // Anything with the Windows / Command key, and a bare modifier, is never a binding.
    return /(^|\+)meta(\+|$)/.test(key) || /^(ctrl|alt|shift)$/.test(key);
  }

  function reservedReason(key) {
    if (key === 'escape') return 'Esc always cancels, so it cannot be bound.';
    if (key === 'space') return 'Space always pauses, so it cannot be bound.';
    if (key === 'tab') return 'Tab always selects the next soldier, so it cannot be bound.';
    return `${keyLabel(key)} belongs to the browser and cannot be bound.`;
  }

  function storage() {
    try {
      return globalThis.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  function persist() {
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify({ v: 1, overrides }));
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Read the saved table. Anything unknown, fixed, reserved or conflicting is dropped. */
  function loadSaved() {
    overrides = {};
    try {
      const raw = storage()?.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && saved.v === 1 && saved.overrides && typeof saved.overrides === 'object') {
        for (const s of STATES) {
          const ov = saved.overrides[s];
          if (!ov || typeof ov !== 'object') continue;
          for (const b of DEFAULTS[s]) {
            if (!(b.id in ov) || b.fixed) continue;
            const key = ov[b.id];
            if (key !== null && (typeof key !== 'string' || !key || isReserved(key))) continue;
            if (b.pad !== (key === null ? b.pad : key.startsWith('pad:'))) continue;
            (overrides[s] = overrides[s] || {})[b.id] = key;
          }
        }
      }
    } catch (_) {
      overrides = {};
    }
    rebuild();
    // A table that leaves a key doing two things (hand-edited, or from an older build
    // whose defaults moved) loses the overrides of the states where that happens.
    const bad = new Set(validate().map((d) => d.state));
    if (bad.size) {
      for (const s of bad) delete overrides[s];
      rebuild();
    }
  }

  function changed() {
    rebuild();
    persist();
    for (const fn of listeners.slice()) {
      try {
        fn();
      } catch (_) {
        /* a broken listener must not stop a rebind */
      }
    }
  }

  /** Call `fn` after any rebind or reset. */
  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  const bindingOf = (state, id) => (KEYMAPS[state] || []).find((b) => b.id === id) || null;
  const defaultOf = (state, id) => (DEFAULTS[state] || []).find((b) => b.id === id) || null;

  function setOverride(state, id, key) {
    const def = defaultOf(state, id);
    if (!def) return;
    if (def.key === key) {
      if (overrides[state]) delete overrides[state][id];
    } else {
      (overrides[state] = overrides[state] || {})[id] = key;
    }
    if (overrides[state] && !Object.keys(overrides[state]).length) delete overrides[state];
  }

  /**
   * Give an action a new key (null unbinds it). The change applies to `state` and to every
   * other state where the action sits on the same key, so Fireball moves everywhere at once.
   * Refused when the key is reserved, or when another action holds it in one of those
   * states — unless `opts.swap`, which hands that action the old key.
   * @returns {{ ok: boolean, reason?: string, message?: string, canSwap?: boolean,
   *   conflict?: { state: string, id: string, label: string }, states?: string[] }}
   */
  function rebind(state, id, key, opts = {}) {
    const b = bindingOf(state, id);
    if (!b) return { ok: false, reason: 'unknown', message: 'No such action.' };
    if (b.fixed) {
      return {
        ok: false,
        reason: 'fixed',
        message: `${keyLabel(b.key)} is fixed and cannot be moved.`,
      };
    }
    if (key != null) {
      if (typeof key !== 'string' || !key)
        return { ok: false, reason: 'unknown', message: 'Not a key.' };
      if (isReserved(key)) return { ok: false, reason: 'reserved', message: reservedReason(key) };
      if (b.pad !== key.startsWith('pad:')) {
        return {
          ok: false,
          reason: 'device',
          message: b.pad
            ? 'Press a controller button for this one.'
            : 'Press a keyboard key for this one.',
        };
      }
    }
    const oldKey = b.key;
    if (key === oldKey) return { ok: true, states: [] };
    const targets = STATES.filter((s) => {
      const x = bindingOf(s, id);
      return x && x.key === oldKey;
    });
    const clashes = [];
    if (key != null) {
      for (const s of targets) {
        const c = KEYMAPS[s].find((x) => x.key === key && x.id !== id);
        if (c) clashes.push({ state: s, binding: c });
      }
    }
    if (clashes.length) {
      const first = clashes.find((c) => c.state === state) || clashes[0];
      const where = first.state === state ? '' : ` (${STATE_LABELS[first.state]})`;
      const canSwap = !clashes.some((c) => c.binding.fixed);
      if (!opts.swap || !canSwap) {
        return {
          ok: false,
          reason: 'conflict',
          canSwap,
          conflict: { state: first.state, id: first.binding.id, label: first.binding.label },
          message: `${keyLabel(key)} is already “${first.binding.label}”${where}.`,
        };
      }
      for (const c of clashes) setOverride(c.state, c.binding.id, oldKey);
    }
    const before = JSON.stringify(overrides);
    for (const s of targets) setOverride(s, id, key);
    rebuild();
    if (validate().length) {
      // Should not happen; never leave a key doing two things.
      overrides = JSON.parse(before);
      if (clashes.length)
        for (const c of clashes) setOverride(c.state, c.binding.id, c.binding.key);
      rebuild();
      return {
        ok: false,
        reason: 'conflict',
        canSwap: false,
        message: 'That swap would double a key.',
      };
    }
    changed();
    return { ok: true, states: targets, swapped: clashes.length > 0 };
  }

  function resetState(state) {
    if (!DEFAULTS[state]) return false;
    delete overrides[state];
    changed();
    return true;
  }

  function resetAll() {
    overrides = {};
    changed();
    return true;
  }

  /** True when the state (or, with no argument, any state) has a moved key. */
  function isCustom(state) {
    return state ? !!overrides[state] : Object.keys(overrides).length > 0;
  }

  /** Rows for the settings screen: every binding of a state with its default. */
  function bindingsOf(state) {
    return (KEYMAPS[state] || []).map((b) => {
      const def = defaultOf(state, b.id);
      return { ...b, defaultKey: def ? def.key : null, custom: !!def && def.key !== b.key };
    });
  }

  /**
   * Which state the game is in. First match wins, so the order here is the precedence.
   * @param {{ playing?: boolean, ended?: boolean, paused?: boolean, spoils?: boolean,
   *   placing?: boolean, placingWall?: boolean, units?: number, building?: boolean,
   *   creative?: boolean, night?: boolean }} f
   */
  function stateOf(f) {
    if (f.ended) return 'gameover';
    if (!f.playing) return 'menu';
    if (f.spoils) return 'spoils';
    if (f.paused) return 'pause';
    if (f.placingWall) return 'placement_wall';
    if (f.placing) return 'placement';
    if ((f.units || 0) > 0) return 'unit_selected';
    if (f.building) return 'building_selected';
    if (f.creative) return 'creative';
    return f.night ? 'night' : 'day';
  }

  const MODIFIER_KEYS = ['shift', 'control', 'alt', 'meta', 'altgraph', 'capslock', 'os'];

  /**
   * The key of a keyboard event in this file's spelling: "q", "shift+1", "ctrl+a",
   * "alt+q". Null for a bare modifier and for anything with the Windows / Command key.
   */
  function keyOfEvent(e) {
    if (!e || e.metaKey) return null;
    const code = e.code || '';
    let key;
    let shiftable;
    if (/^Digit\d$/.test(code)) {
      // Shift+/ is "?" on most layouts; a shifted digit that types "?" is the key sheet.
      if (e.key === '?') return '?';
      key = code.slice(5);
      shiftable = true;
    } else {
      key = String(e.key || '').toLowerCase();
      if (key === ' ' || key === 'spacebar') key = 'space';
      if (key === '+') key = '=';
      if (key === '_') key = '-';
      if (key === 'del') key = 'delete';
      // Alt (Option on a Mac) and Ctrl change what a letter types: read the physical key.
      if ((e.altKey || e.ctrlKey) && /^Key[A-Z]$/.test(code)) key = code.slice(3).toLowerCase();
      // Shift is part of the name for letters and named keys; "?" or "{" already say it.
      shiftable = /^[a-z]$/.test(key) || key.length > 1;
    }
    if (!key || key === 'dead' || key === 'unidentified' || key === 'process') return null;
    if (MODIFIER_KEYS.includes(key)) return null;
    return (
      (e.ctrlKey ? 'ctrl+' : '') +
      (e.altKey ? 'alt+' : '') +
      (e.shiftKey && shiftable ? 'shift+' : '') +
      key
    );
  }

  /** The last part of a key: "shift+h" → "h". Used to release held keys. */
  function baseKey(key) {
    if (!key) return '';
    if (key.startsWith('pad:')) return key;
    return key.endsWith('+') ? '+' : key.slice(key.lastIndexOf('+') + 1);
  }

  const PAD_BUTTONS = {
    0: 'pad:a',
    1: 'pad:b',
    2: 'pad:x',
    3: 'pad:y',
    4: 'pad:lb',
    5: 'pad:rb',
    6: 'pad:lt',
    7: 'pad:rt',
    8: 'pad:back',
    9: 'pad:start',
    12: 'pad:up',
    13: 'pad:down',
    14: 'pad:left',
    15: 'pad:right',
  };

  /**
   * The controller keys held right now, from a Gamepad (standard mapping). The left stick
   * past half-way counts as the d-pad.
   * @returns {string[]}
   */
  function padKeys(pad) {
    const out = [];
    if (!pad) return out;
    const buttons = pad.buttons || [];
    for (const i of Object.keys(PAD_BUTTONS)) {
      const btn = buttons[i];
      if (btn && (btn.pressed || btn.value > 0.5)) out.push(PAD_BUTTONS[i]);
    }
    const ax = pad.axes || [];
    const add = (k) => {
      if (!out.includes(k)) out.push(k);
    };
    if (ax[0] < -0.5) add('pad:left');
    if (ax[0] > 0.5) add('pad:right');
    if (ax[1] < -0.5) add('pad:up');
    if (ax[1] > 0.5) add('pad:down');
    return out;
  }

  function lookup(state, key) {
    return (key != null && INDEX[state] && INDEX[state][key]) || null;
  }

  // ---- slots follow what is unlocked ----------------------------------------------------
  const SLOT_ACTION = {
    deploy: 'deploySlot',
    build: 'buildSlot',
    spy: 'spySlot',
    courier: 'courierSlot',
  };
  const SLOT_COUNT = {
    deploy: SLOT_KEYS.length,
    build: BUILD_SLOT_KEYS.length,
    spy: SPY_SLOT_KEYS.length,
    courier: COURIER_SLOT_KEYS.length,
  };
  const slotOrders = { deploy: [], build: [], spy: [], courier: [] };

  /**
   * Hand a panel's slot keys to what is unlocked: in panel order at first, then each new
   * unlock on the next free key. An item keeps its key once it has one (until a new run,
   * when something it holds is locked again).
   * @param {'deploy'|'build'|'spy'|'courier'} kind
   * @param {string[]} order ids in panel order
   * @param {(id: string) => boolean} isUnlocked
   * @returns {string[]} id per slot
   */
  function assignSlots(kind, order, isUnlocked) {
    if (!slotOrders[kind]) return [];
    const open = order.filter((t) => {
      try {
        return !!isUnlocked(t);
      } catch (_) {
        return false;
      }
    });
    if (slotOrders[kind].some((t) => !open.includes(t))) slotOrders[kind] = [];
    for (const t of open) if (!slotOrders[kind].includes(t)) slotOrders[kind].push(t);
    return slotOrders[kind].slice(0, SLOT_COUNT[kind]);
  }

  /** The item on a slot from the last assignSlots() call, or null. */
  function slotItemAt(kind, i) {
    return i >= 0 && i < (SLOT_COUNT[kind] || 0) ? slotOrders[kind][i] || null : null;
  }

  /** The current key of the slot an item sits on, or null. */
  function slotKey(kind, id, state = 'night') {
    const i = (slotOrders[kind] || []).indexOf(id);
    if (i < 0 || i >= SLOT_COUNT[kind]) return null;
    const b = (KEYMAPS[state] || []).find(
      (x) => !x.pad && x.action === SLOT_ACTION[kind] && x.arg === i
    );
    return b ? b.key : null;
  }

  const deploySlots = (isUnlocked) => assignSlots('deploy', DEPLOY_ORDER, isUnlocked);
  const deployTypeAt = (i) => slotItemAt('deploy', i);
  const deployKey = (type) => slotKey('deploy', type);

  function resetDeploySlots() {
    for (const k of Object.keys(slotOrders)) slotOrders[k] = [];
  }

  /**
   * THE lookup: the keyboard key bound to an action in a state, or null. Buttons, tooltips
   * and the key sheet all come through here, so they show the current binding.
   * `action` may also be a panel kind ("deploy", "build", "spy", "courier") with the item id:
   * that answers with the item's own key, or the key of the slot it sits on.
   */
  function keyFor(state, action, arg = null) {
    const list = KEYMAPS[state] || [];
    const b = list.find((x) => !x.pad && x.action === action && x.arg === arg);
    if (b) return b.key;
    if (SLOT_ACTION[action] && arg != null) return slotKey(action, arg, state);
    return null;
  }

  /** The controller button bound to an action in a state, or null. */
  function padFor(state, action, arg = null) {
    const b = (KEYMAPS[state] || []).find((x) => x.pad && x.action === action && x.arg === arg);
    return b ? b.key : null;
  }

  /** keyFor() already written for a button: "Shift+H", or "" when unbound. */
  function labelFor(state, action, arg = null) {
    return keyLabel(keyFor(state, action, arg));
  }

  /** How a key is written on a button or in the sheet. */
  function keyLabel(key) {
    if (!key) return '';
    const names = {
      space: 'Space',
      escape: 'Esc',
      enter: 'Enter',
      tab: 'Tab',
      delete: 'Del',
      backspace: 'Backspace',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
      pageup: 'PgUp',
      pagedown: 'PgDn',
      '=': '+',
      '-': '−',
    };
    if (key.startsWith('pad:')) {
      const pad = { up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →' };
      const name = key.slice(4);
      return pad[name] || `Pad ${name.toUpperCase()}`;
    }
    const base = baseKey(key);
    const mods = key
      .slice(0, key.length - base.length)
      .split('+')
      .filter(Boolean);
    return [
      ...mods.map((m) => m[0].toUpperCase() + m.slice(1)),
      names[base] ||
        (base.length === 1 ? base.toUpperCase() : base[0].toUpperCase() + base.slice(1)),
    ].join('+');
  }

  let namer = null;
  /** Tell the sheet how to name a slotted item: (kind, id) => "Quarry". */
  function setNamer(fn) {
    namer = typeof fn === 'function' ? fn : null;
  }

  const FOLDS = {
    pan: { label: 'Pan the map', compact: null },
    formation: { label: 'Formation presets', compact: 'Alt+1–5' },
    saveGroup: {
      label: 'Save the selection as a group (the digit then recalls it; save nothing to clear)',
      compact: 'Ctrl+1–9',
    },
  };
  const SLOT_VERB = {
    buildSlot: ['build', 'Build'],
    spySlot: ['spy', 'Spy:'],
    courierSlot: ['courier', 'Courier:'],
  };

  /**
   * Rows for the key sheet: the keyboard bindings of one state that have a key. Camera keys,
   * formation presets and control groups fold into one row each; a slot with nothing on it
   * is left out. `describe` may rename a row or drop it (return null).
   */
  function sheet(state, describe) {
    const rows = [];
    const folded = {};
    for (const raw of KEYMAPS[state] || []) {
      if (raw.pad || raw.key == null) continue;
      let b = raw;
      const slot = SLOT_VERB[b.action];
      if (slot) {
        const id = slotItemAt(slot[0], b.arg);
        if (!id) continue;
        b = { ...b, label: `${slot[1]} ${namer ? namer(slot[0], id) : id}` };
      }
      let label = b.label;
      if (describe) {
        label = describe(b);
        if (label == null) continue;
      }
      const fold = FOLDS[b.action];
      if (fold) {
        if (!folded[b.action]) {
          folded[b.action] = { keys: [], label: fold.label, fold, allDefault: true };
          rows.push(folded[b.action]);
        }
        folded[b.action].keys.push(keyLabel(b.key));
        const def = defaultOf(state, b.id);
        if (!def || def.key !== b.key) folded[b.action].allDefault = false;
        continue;
      }
      rows.push({ keys: [keyLabel(b.key)], label });
    }
    return rows.map((r) => ({
      keys: r.fold && r.fold.compact && r.allDefault ? r.fold.compact : r.keys.join(' '),
      label: r.label,
    }));
  }

  loadSaved();

  return {
    STATES,
    STATE_LABELS,
    KEYMAPS,
    DEFAULTS,
    DEPLOY_ORDER,
    SLOT_KEYS,
    UNBOUND_BY_DESIGN,
    STORAGE_KEY,
    validate,
    stateOf,
    keyOfEvent,
    baseKey,
    padKeys,
    lookup,
    keyFor,
    padFor,
    labelFor,
    keyLabel,
    isReserved,
    rebind,
    resetState,
    resetAll,
    isCustom,
    bindingsOf,
    onChange,
    reload: loadSaved,
    assignSlots,
    slotItemAt,
    slotKey,
    setNamer,
    deploySlots,
    resetDeploySlots,
    deployKey,
    deployTypeAt,
    sheet,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Hotkeys = Hotkeys;
