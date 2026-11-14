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
 * Rebinding is not built. To add it, apply a { "action:arg": key } override table inside
 * bind() below and re-run buildMaps(); nothing else reads raw keys.
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

  const bind = (key, action, label, arg) => ({ key, action, label, arg: arg ?? null });

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
    bind('shift+tab', 'messageLog', 'Message log'),
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

  const SELECTION = [
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
    const field = [...GLOBAL, ...FIELD, ...STRIKES, ...DEPLOY, ...BUILDS];
    return {
      menu: [
        ...GLOBAL,
        bind('enter', 'startRun', 'Begin the defense'),
        bind('escape', 'closePanel', 'Close the open panel'),
      ],
      night: [...field, bind('escape', 'pauseMenu', 'Pause menu')],
      // Same keys as night; D does nothing by day and is left out of the sheet.
      day: [...without(field, 'd'), bind('escape', 'pauseMenu', 'Pause menu')],
      unit_selected: [
        ...GLOBAL,
        ...FIELD,
        ...without(STRIKES, 'f'),
        ...DEPLOY,
        ...without(BUILDS, 'c', 'g', 'b', 'u'),
        ...SELECTION,
        bind('escape', 'clearSelection', 'Deselect'),
      ],
      building_selected: [...field, bind('escape', 'cancel', 'Put the building back')],
      placement: [...field, bind('escape', 'cancel', 'Cancel')],
      placement_wall: [
        ...without(field, 'r'),
        bind('r', 'rotateWall', 'Turn the wall before placing'),
        bind('escape', 'cancel', 'Cancel'),
      ],
      pause: [
        ...GLOBAL,
        bind('space', 'resume', 'Resume'),
        bind('escape', 'resume', 'Resume'),
        bind('shift+tab', 'messageLog', 'Message log'),
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
      ],
      gameover: [
        ...GLOBAL,
        bind('enter', 'restart', 'Fight again'),
        bind('escape', 'closePanel', 'Close the open panel'),
      ],
      creative: [
        ...GLOBAL,
        ...FIELD,
        ...without(STRIKES, 'p'),
        ...DEPLOY,
        ...BUILDS,
        bind('p', 'creativePanel', 'Creative Lab panel'),
        bind('escape', 'pauseMenu', 'Pause menu'),
      ],
    };
  }

  const KEYMAPS = buildMaps();
  const INDEX = {};
  for (const s of STATES) {
    INDEX[s] = {};
    for (const b of KEYMAPS[s]) if (!(b.key in INDEX[s])) INDEX[s][b.key] = b;
  }

  /** Every key bound twice in one state: [{ state, key, actions }]. Empty when sound. */
  function validate() {
    const out = [];
    for (const s of STATES) {
      const seen = {};
      for (const b of KEYMAPS[s] || []) (seen[b.key] = seen[b.key] || []).push(b);
      for (const key of Object.keys(seen)) {
        if (seen[key].length > 1) {
          out.push({ state: s, key, actions: seen[key].map((b) => `${b.action}:${b.arg ?? ''}`) });
        }
      }
    }
    return out;
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

  /** The key of a keyboard event in this file's spelling, or null for a browser shortcut. */
  function keyOfEvent(e) {
    if (!e || e.ctrlKey || e.metaKey) return null;
    const code = e.code || '';
    let key;
    let digit = false;
    if (/^Digit\d$/.test(code)) {
      key = code.slice(5);
      digit = true;
      // Shift+/ is "?" on most layouts; a shifted digit that types "?" is the key sheet.
      if (e.key === '?') return '?';
    } else {
      key = String(e.key || '').toLowerCase();
      if (key === ' ' || key === 'spacebar') key = 'space';
    }
    if (!key) return null;
    const shifted = e.shiftKey && (digit || key === 'tab');
    return (e.altKey ? 'alt+' : '') + (shifted ? 'shift+' : '') + key;
  }

  function lookup(state, key) {
    return (key != null && INDEX[state] && INDEX[state][key]) || null;
  }

  /** The key bound to an action in a state, or null. */
  function keyFor(state, action, arg = null) {
    const b = (KEYMAPS[state] || []).find((x) => x.action === action && x.arg === arg);
    return b ? b.key : null;
  }

  /** How a key is written on a button or in the sheet. */
  function keyLabel(key) {
    if (!key) return '';
    const names = {
      space: 'Space',
      escape: 'Esc',
      enter: 'Enter',
      tab: 'Tab',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
    };
    return key
      .split('+')
      .map((part) => {
        if (part === 'shift') return 'Shift';
        if (part === 'alt') return 'Alt';
        if (names[part]) return names[part];
        return part.length === 1 ? part.toUpperCase() : part.toUpperCase();
      })
      .join('+');
  }

  // ---- recruit slots follow what is unlocked -------------------------------------------
  let slotOrder = [];

  /**
   * Recruit keys go to unlocked troops: the starting roster in panel order, then each new
   * unlock on the next free key. A troop keeps its key once it has one (until a new run).
   * @param {(type: string) => boolean} isUnlocked
   * @returns {string[]} type per slot
   */
  function deploySlots(isUnlocked) {
    const open = DEPLOY_ORDER.filter((t) => {
      try {
        return !!isUnlocked(t);
      } catch (_) {
        return false;
      }
    });
    if (slotOrder.some((t) => !open.includes(t))) slotOrder = [];
    for (const t of open) if (!slotOrder.includes(t)) slotOrder.push(t);
    return slotOrder.slice(0, SLOT_KEYS.length);
  }

  function resetDeploySlots() {
    slotOrder = [];
  }

  /** The troop on a recruit slot from the last deploySlots() call, or null. */
  function deployTypeAt(i) {
    return i >= 0 && i < SLOT_KEYS.length ? slotOrder[i] || null : null;
  }

  /** The recruit key of a troop type from the last deploySlots() call, or null. */
  function deployKey(type) {
    const i = slotOrder.indexOf(type);
    return i >= 0 && i < SLOT_KEYS.length ? SLOT_KEYS[i] : null;
  }

  /**
   * Rows for the key sheet: the bindings of one state, with camera keys and formation
   * presets folded into one row each. `describe` may rename a row or drop it (return null).
   */
  function sheet(state, describe) {
    const rows = [];
    const folded = {};
    for (const b of KEYMAPS[state] || []) {
      let label = b.label;
      if (describe) {
        label = describe(b);
        if (label == null) continue;
      }
      const fold =
        b.action === 'pan' ? 'Pan the map' : b.action === 'formation' ? 'Formation presets' : null;
      if (fold) {
        if (!folded[fold]) {
          folded[fold] = { keys: [], label: fold };
          rows.push(folded[fold]);
        }
        folded[fold].keys.push(keyLabel(b.key));
        continue;
      }
      rows.push({ keys: [keyLabel(b.key)], label });
    }
    return rows.map((r) => ({
      keys: r.label === 'Formation presets' ? 'Alt+1–5' : r.keys.join(' '),
      label: r.label,
    }));
  }

  return {
    STATES,
    STATE_LABELS,
    KEYMAPS,
    DEPLOY_ORDER,
    SLOT_KEYS,
    validate,
    stateOf,
    keyOfEvent,
    lookup,
    keyFor,
    keyLabel,
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
