/**
 * The key maps (js/hotkeys.js): one map per game state, and no key bound twice in a state.
 * Also checks that every action named in a map has a handler in js/main.js, that recruit
 * keys follow what is unlocked, and that the README key list matches the map.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { ROOT, JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

/** A localStorage stand-in; pass the same one to a second load to act as a page reload. */
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

/** Load js/hotkeys.js fresh, as a page load would, against the given storage. */
function loadHotkeys(storage) {
  const sb = { console };
  if (storage) sb.localStorage = storage;
  sb.globalThis = sb;
  return vm.runInContext(
    `${readFileSync(join(JS, 'hotkeys.js'), 'utf8')}\nHotkeys`,
    vm.createContext(sb)
  );
}

const Hotkeys = loadHotkeys(fakeStorage());

// --- every listed state has a map, and no key is bound twice in it --------------------------
const WANT = [
  'menu',
  'night',
  'day',
  'unit_selected',
  'building_selected',
  'placement',
  'pause',
  'spoils',
  'gameover',
  'creative',
];
for (const s of WANT) {
  ok(Array.isArray(Hotkeys.KEYMAPS[s]) && Hotkeys.KEYMAPS[s].length > 0, `state "${s}" has a map`);
}
ok(
  Hotkeys.STATES.every((s) => Hotkeys.KEYMAPS[s]) &&
    Object.keys(Hotkeys.KEYMAPS).every((s) => Hotkeys.STATES.includes(s)),
  'STATES and KEYMAPS list the same states'
);
const dups = Hotkeys.validate();
ok(
  dups.length === 0,
  `no key does two things in one state${dups.length ? ` — ${JSON.stringify(dups)}` : ''}`
);
// Checked independently of validate(), so a broken validate() cannot hide a duplicate.
for (const s of Hotkeys.STATES) {
  const keys = Hotkeys.KEYMAPS[s].map((b) => b.key);
  const twice = keys.filter((k, i) => keys.indexOf(k) !== i);
  ok(
    twice.length === 0,
    `${s}: ${keys.length} keys, all distinct${twice.length ? ` — twice: ${twice}` : ''}`
  );
}
// validate() does report one when there is one.
{
  const map = Hotkeys.KEYMAPS.pause;
  map.push({ key: 'space', action: 'pause', arg: null, label: 'x' });
  const found = Hotkeys.validate();
  ok(
    found.length === 1 && found[0].state === 'pause' && found[0].key === 'space',
    'a duplicate key in a state is reported'
  );
  map.pop();
  ok(Hotkeys.validate().length === 0, 'and gone again once removed');
}

// --- the specific keys the audit named ---------------------------------------------------------
const at = (state, key) => Hotkeys.lookup(state, key);
for (const s of ['night', 'day', 'unit_selected', 'placement', 'creative']) {
  ok(
    at(s, '[')?.action === 'order' && at(s, '[').arg === 'warCry' && at(s, ']')?.arg === 'holdLine',
    `${s}: [ is War Cry and ] is Hold the Line`
  );
}
for (const s of ['night', 'day', 'unit_selected', 'placement', 'creative']) {
  ok(
    at(s, '=')?.action === 'speedUp' && at(s, '-')?.action === 'speedDown',
    `${s}: + speeds the game up and - slows it down`
  );
}
ok(
  Hotkeys.keyOfEvent({ key: '+', code: 'Equal', shiftKey: true }) === '=' &&
    Hotkeys.keyOfEvent({ key: '+', code: 'NumpadAdd' }) === '=' &&
    Hotkeys.keyLabel('=') === '+',
  'the + key is read with or without Shift, and from the number pad'
);
ok(
  Hotkeys.STATES.every((s) => !at(s, 'v') || at(s, 'v').action === 'mute'),
  'V is mute wherever it is bound'
);
ok(
  at('night', 's')?.action === 'ability' && at('night', 's').arg === 'fus_ro_dah',
  'Voice Shout has a key of its own (S)'
);
ok(
  at('night', 'u')?.action === 'build' && at('unit_selected', 'u')?.action === 'promote',
  'U: Merchant Guild with nothing selected, promote with soldiers selected'
);
ok(
  at('night', 'p')?.arg === 'dispel' && at('creative', 'p')?.action === 'creativePanel',
  'P: Arcane Dispel in a campaign, the Creative Lab panel in Creative mode'
);
ok(
  at('placement', 'r')?.arg === 'reinforce' && at('placement_wall', 'r')?.action === 'rotateWall',
  'R: Reinforcements, or turn the wall while a wall is being placed'
);
ok(
  at('day', 'd') === null && at('night', 'd')?.action === 'beginDay',
  'D begins the day at night only'
);
{
  const spoils = Hotkeys.KEYMAPS.spoils;
  ok(
    spoils.every((b) => /^spoil/.test(b.action)),
    'spoils choice: every key is a spoils key, everything else is inert'
  );
  ok(
    at('spoils', '1')?.arg === 0 &&
      at('spoils', '3')?.arg === 2 &&
      at('spoils', 'enter') &&
      !at('spoils', 'escape'),
    'spoils choice: 1/2/3 and Enter choose, Escape does nothing'
  );
}
// The three fixed keys.
for (const s of [
  'night',
  'day',
  'placement',
  'placement_wall',
  'building_selected',
  'unit_selected',
  'creative',
]) {
  ok(at(s, 'space')?.action === 'pause', `${s}: Space pauses`);
  ok(at(s, 'tab')?.action === 'cycleSoldier', `${s}: Tab selects the next soldier`);
  ok(
    at(s, 'shift+tab')?.action === 'cycleSoldierBack',
    `${s}: Shift+Tab selects the previous soldier`
  );
  ok(at(s, 'shift+m')?.action === 'messageLog', `${s}: Shift+M opens the message log`);
}
ok(
  at('placement', 'escape')?.action === 'cancel' &&
    at('placement_wall', 'escape')?.action === 'cancel',
  'Escape cancels a placement'
);
ok(at('building_selected', 'escape')?.action === 'cancel', 'Escape puts a picked-up building back');
ok(at('unit_selected', 'escape')?.action === 'clearSelection', 'Escape deselects soldiers');
ok(
  at('night', 'escape')?.action === 'pauseMenu',
  'with nothing to cancel, Escape opens the pause menu'
);
ok(
  Hotkeys.keyOfEvent({ key: 'Tab', code: 'Tab', shiftKey: true }) === 'shift+tab',
  'Shift+Tab is its own key'
);
ok(
  at('pause', 'space')?.action === 'resume' && at('pause', 'q') === null,
  'pause: Space resumes, strikes are off'
);
ok(at('gameover', 'enter')?.action === 'restart', 'game over: Enter fights again');
ok(at('menu', 'enter')?.action === 'startRun', 'main menu: Enter begins');
for (const s of Hotkeys.STATES.filter((x) => x !== 'spoils')) {
  ok(at(s, '?')?.action === 'keySheet', `${s}: ? opens the key sheet`);
}

// --- state resolution ----------------------------------------------------------------------------
const st = (f) => Hotkeys.stateOf(f);
ok(st({}) === 'menu', 'not playing: menu');
ok(st({ ended: true }) === 'gameover', 'run over: gameover');
ok(
  st({ playing: true, night: true }) === 'night' && st({ playing: true }) === 'day',
  'night and day'
);
ok(st({ playing: true, paused: true, units: 3 }) === 'pause', 'pause beats a selection');
ok(
  st({ playing: true, spoils: true, paused: true }) === 'spoils',
  'the spoils choice beats everything in play'
);
ok(st({ playing: true, placing: true, units: 2 }) === 'placement', 'placing beats a selection');
ok(st({ playing: true, placing: true, placingWall: true }) === 'placement_wall', 'placing a wall');
ok(st({ playing: true, units: 1, creative: true }) === 'unit_selected', 'soldiers selected');
ok(st({ playing: true, building: true }) === 'building_selected', 'building picked up');
ok(st({ playing: true, creative: true, night: true }) === 'creative', 'creative mode');

// --- key spelling ----------------------------------------------------------------------------------
const ev = (o) => Hotkeys.keyOfEvent({ key: '', code: '', ...o });
ok(ev({ key: 'Q', code: 'KeyQ' }) === 'q', 'letters are lower-cased');
ok(
  ev({ key: '!', code: 'Digit1', shiftKey: true }) === 'shift+1',
  'Shift+1 is read from the physical key'
);
ok(ev({ key: '1', code: 'Digit1', altKey: true }) === 'alt+1', 'Alt+1');
ok(
  ev({ key: ' ', code: 'Space' }) === 'space' && ev({ key: 'Escape' }) === 'escape',
  'Space and Escape'
);
ok(ev({ key: '?', code: 'Slash', shiftKey: true }) === '?', '? is Shift+/');
ok(
  ev({ key: 'c', code: 'KeyC', ctrlKey: true }) === 'ctrl+c' &&
    Hotkeys.isReserved('ctrl+c') &&
    Hotkeys.STATES.every((s) => !at(s, 'ctrl+c')),
  'Ctrl+C is spelled ctrl+c, is reserved, and is bound nowhere (the browser keeps it)'
);
ok(ev({ key: 'h', code: 'KeyH', metaKey: true }) === null, 'the Windows / Command key is ignored');
ok(ev({ key: 'H', code: 'KeyH', shiftKey: true }) === 'shift+h', 'Shift+H is its own key');
ok(
  at('night', 'shift+h')?.action === 'holdHere' && at('night', 'h')?.action === 'hunt',
  'H is Hunt and Shift+H is Hold here'
);
ok(ev({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }) === null, 'a bare modifier is no key');
ok(
  ev({ key: 'å', code: 'KeyA', altKey: true }) === 'alt+a',
  'Alt+letter is read from the physical key (Option on a Mac types another letter)'
);
ok(ev({ key: '1', code: 'Digit1', ctrlKey: true }) === 'ctrl+1', 'Ctrl+1');

// --- recruit keys follow what is unlocked ---------------------------------------------------------
{
  const starters = ['footman', 'archer', 'mage', 'cavalry', 'healer', 'builder', 'courier'];
  const open = new Set(starters);
  Hotkeys.resetDeploySlots();
  let slots = Hotkeys.deploySlots((t) => open.has(t));
  ok(slots.join() === starters.join(), `the starting roster takes keys 1-7 (${slots.join(' ')})`);
  ok(Hotkeys.deployKey('crossbowman') === null, 'a locked troop has no key');
  for (const t of ['crossbowman', 'knight', 'sapper']) open.add(t);
  slots = Hotkeys.deploySlots((t) => open.has(t));
  ok(
    Hotkeys.deployKey('crossbowman') === '8' &&
      Hotkeys.deployKey('knight') === '9' &&
      Hotkeys.deployKey('sapper') === '0',
    'Iron Weapons troops take the next keys: Crossbowman 8, Knight 9, Sapper 0'
  );
  ok(
    Hotkeys.deployKey('footman') === '1' && Hotkeys.deployKey('courier') === '7',
    'earlier troops keep their keys'
  );
  for (const t of ['scout', 'pikeman', 'general']) open.add(t);
  Hotkeys.deploySlots((t) => open.has(t));
  ok(
    Hotkeys.deployKey('scout') === 'shift+1' && Hotkeys.deployKey('general') === 'shift+3',
    'past ten: Shift+1 onwards'
  );
  ok(Hotkeys.deployTypeAt(7) === 'crossbowman' && Hotkeys.deployTypeAt(19) === null, 'slot lookup');
  // A new run (something is locked again) starts the keys over.
  slots = Hotkeys.deploySlots((t) => starters.includes(t));
  ok(slots.join() === starters.join(), 'a new run resets the keys');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const buttons = [
    ...html.matchAll(/class="deploy-btn[^"]*"\s+data-unit="([a-z_]+)"|data-unit="([a-z_]+)"/g),
  ]
    .map((m) => m[1] || m[2])
    .filter((v, i, a) => a.indexOf(v) === i);
  ok(
    buttons.join() === [...Hotkeys.DEPLOY_ORDER].join(),
    `DEPLOY_ORDER lists the recruit buttons in panel order (${buttons.length})`
  );
  ok(
    Hotkeys.SLOT_KEYS.length >= Hotkeys.DEPLOY_ORDER.length,
    'there is a key for every recruit button'
  );
}

// --- every action has a handler; every bound spell/building exists as a button or is known --------
{
  const main = readFileSync(join(JS, 'main.js'), 'utf8');
  const block = main.slice(
    main.indexOf('const HOTKEY_ACTIONS = {'),
    main.indexOf('// Shift-click placed')
  );
  const handlers = new Set([...block.matchAll(/^ {6}([a-zA-Z]+): /gm)].map((m) => m[1]));
  const used = new Set();
  for (const s of Hotkeys.STATES) for (const b of Hotkeys.KEYMAPS[s]) used.add(b.action);
  const missing = [...used].filter((a) => !handlers.has(a));
  ok(
    missing.length === 0,
    `every action has a handler in main.js${missing.length ? ` — missing ${missing}` : ''}`
  );
  ok(
    !/cycleGameSpeed/.test(block) && !/DEPLOY_HOTKEYS|ABILITY_HOTKEYS|BUILD_HOTKEYS/.test(main),
    'the old key tables and the dead speed binding are gone'
  );
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const b of Hotkeys.KEYMAPS.night) {
    if (b.action === 'build')
      ok(html.includes(`data-build="${b.arg}"`), `build key ${b.key} has a button (${b.arg})`);
  }
}

// --- every action has a key, or is listed as unbound by design -------------------------------------
{
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const main = readFileSync(join(JS, 'main.js'), 'utf8');
  const ids = (attr) => [
    ...new Set([...html.matchAll(new RegExp(`data-${attr}="([a-zA-Z_]+)"`, 'g'))].map((m) => m[1])),
  ];
  const unbound = (match) => Hotkeys.UNBOUND_BY_DESIGN.some((u) => u.match === match);
  const key = (action, arg = null, state = 'night') => Hotkeys.keyFor(state, action, arg);

  ok(
    Hotkeys.STATES.every((s) =>
      Hotkeys.DEFAULTS[s].every((b) => typeof b.key === 'string' && b.key)
    ),
    'every binding in every state has a default key'
  );
  ok(
    Hotkeys.UNBOUND_BY_DESIGN.length > 0 &&
      Hotkeys.UNBOUND_BY_DESIGN.every((u) => u.match && u.why),
    'the unbound-by-design list gives a reason for each entry'
  );

  // Named actions the owner asked for.
  const wanted = [
    ['hunt'],
    ['holdHere'],
    ['order', 'warCry'],
    ['order', 'holdLine'],
    ['pause'],
    ['beginDay'],
    ['speedUp'],
    ['speedDown'],
    ['cycleSoldier'],
    ['cycleSoldierBack'],
    ['selectAll'],
    ['centreGeneral'],
    ['centreBreach'],
    ['keySheet'],
    ['mute'],
    ['encyclopedia'],
    ['backToPosts', null, 'unit_selected'],
    ['promote', null, 'unit_selected'],
    ['selectAllType', null, 'unit_selected'],
    ['reform', null, 'unit_selected'],
  ];
  for (const [action, arg = null, state = 'night'] of wanted) {
    ok(
      !!key(action, arg, state),
      `${action}${arg ? `:${arg}` : ''} has a key (${key(action, arg, state)})`
    );
  }
  for (let n = 1; n <= 9; n++) {
    ok(key('saveGroup', n) === `ctrl+${n}`, `control group ${n} is saved with Ctrl+${n}`);
    ok(
      at('night', String(n))?.action === 'deploySlot' && at('night', String(n)).arg === n - 1,
      `…and ${n} recalls it (the recruit-slot key, taken over while the group exists)`
    );
  }
  ok(
    /deploySlot: \(slot\) => \{\s*if \(recallGroup\(slot \+ 1\)\) return true;/.test(main),
    'a saved group takes over its digit in main.js'
  );

  // Everything with a button in the panels.
  for (const f of ids('formation')) {
    ok(!!key('formation', f, 'unit_selected'), `formation ${f} has a key`);
  }
  for (const a of ids('ability')) ok(!!key('ability', a), `spell / strike ${a} has a key`);
  ok(
    ids('unit').every((u) => Hotkeys.DEPLOY_ORDER.includes(u)),
    'every troop button is on a recruit slot'
  );
  const lettered = new Set(
    Hotkeys.DEFAULTS.night.filter((b) => b.action === 'build').map((b) => b.arg)
  );
  const extraBuilds = ids('build').filter((b) => !lettered.has(b));
  const slotCount = (action) => Hotkeys.DEFAULTS.night.filter((b) => b.action === action).length;
  ok(
    lettered.size >= 9 && slotCount('buildSlot') >= 14,
    `buildings: ${lettered.size} lettered, ${slotCount('buildSlot')} slot keys for the other ${extraBuilds.length}`
  );
  ok(
    slotCount('buildSlot') >= extraBuilds.length || unbound('build:overflow'),
    'buildings past the slot keys are unbound by design'
  );
  ok(
    slotCount('spySlot') >= ids('spy').length || unbound('spy:overflow'),
    `every spy action can take a slot key (${ids('spy').length} actions, ${slotCount('spySlot')} keys)`
  );
  ok(
    slotCount('courierSlot') >= ids('courier').length || unbound('courier:overflow'),
    `every courier message can take a slot key (${ids('courier').length} messages, ${slotCount('courierSlot')} keys)`
  );
  for (const l of ids('loadout'))
    ok(
      !!key('loadout', l) || unbound('loadout:*'),
      `loadout ${l} has a key or is unbound by design`
    );
  for (const d of ids('doctrine'))
    ok(
      !!key('doctrine', d) || unbound('doctrine:*'),
      `doctrine ${d} has a key or is unbound by design`
    );

  // Slots follow what is unlocked, for the extra buildings as for troops.
  Hotkeys.resetDeploySlots();
  const open = new Set(['quarry']);
  Hotkeys.assignSlots('build', extraBuilds, (id) => open.has(id));
  ok(key('build', 'quarry') === 'alt+a', 'the first extra building unlocked takes Alt+A');
  ok(key('build', 'research_lab') === null, 'a locked building has no key');
  open.add('research_lab');
  Hotkeys.assignSlots('build', extraBuilds, (id) => open.has(id));
  ok(
    key('build', 'quarry') === 'alt+a' && key('build', 'research_lab') === 'alt+s',
    'the next unlock takes the next key; the first keeps its own'
  );
  ok(
    key('build', 'wall') === 'l',
    'a lettered building answers with its letter through the same lookup'
  );
  Hotkeys.assignSlots('spy', ids('spy'), () => true);
  ok(key('spy', ids('spy')[0]) === 'shift+q', 'spy actions sit on Shift+Q onwards');
  Hotkeys.setNamer((kind, id) => `<${id}>`);
  const rows = Hotkeys.sheet('night');
  ok(
    rows.some((r) => r.keys === 'Alt+A' && r.label === 'Build <quarry>'),
    'the key sheet names what is on a slot'
  );
  ok(!rows.some((r) => /Extra building/.test(r.label)), 'and leaves empty slots out');
  ok(
    rows.some((r) => r.keys === 'Ctrl+1–9'),
    'control groups are one row'
  );
  Hotkeys.resetDeploySlots();
}

// --- rebinding ----------------------------------------------------------------------------------------
{
  const store = fakeStorage();
  const H = loadHotkeys(store);
  const noDups = (h, when) => {
    const d = h.validate();
    ok(
      d.length === 0,
      `no key does two things in one state ${when}${d.length ? ` — ${JSON.stringify(d)}` : ''}`
    );
    for (const s of h.STATES) {
      const keys = h.KEYMAPS[s].map((b) => b.key).filter((k) => k != null);
      const twice = keys.filter((k, i) => keys.indexOf(k) !== i);
      if (twice.length) ok(false, `${s}: ${twice} bound twice ${when}`);
    }
  };
  noDups(H, 'with the defaults');
  ok(!H.isCustom(), 'nothing is customised to begin with');

  // A free key: accepted, and it follows the action onto every state that had the old key.
  let r = H.rebind('night', 'ability:fireball', 'ctrl+e');
  ok(
    r.ok && r.states.includes('day') && r.states.includes('placement'),
    'Fireball moves to Ctrl+E on every screen it was Q'
  );
  ok(
    H.keyFor('night', 'ability', 'fireball') === 'ctrl+e' &&
      H.keyFor('day', 'ability', 'fireball') === 'ctrl+e',
    'keyFor answers with the new key'
  );
  ok(
    H.lookup('night', 'ctrl+e')?.arg === 'fireball' && H.lookup('night', 'q') === null,
    'the new key works and the old one is free'
  );
  ok(H.labelFor('night', 'ability', 'fireball') === 'Ctrl+E', 'labelFor writes the current key');
  ok(H.isCustom('night') && !H.isCustom('menu'), 'the changed screens are marked');
  noDups(H, 'after a rebind');

  // A taken key: refused, naming the holder, with a swap on offer.
  r = H.rebind('night', 'ability:lightning', 'e');
  ok(!r.ok && r.reason === 'conflict', 'a key already used in the state is refused');
  ok(
    r.conflict?.id === 'ability:heal' && /Healing Rain/.test(r.message) && r.canSwap === true,
    `the refusal names the action that holds it and offers a swap ("${r.message}")`
  );
  ok(
    H.keyFor('night', 'ability', 'lightning') === 'w' &&
      H.keyFor('night', 'ability', 'heal') === 'e',
    'a refused rebind changes nothing'
  );
  r = H.rebind('night', 'ability:lightning', 'e', { swap: true });
  ok(r.ok && r.swapped, 'the swap is accepted');
  ok(
    H.keyFor('night', 'ability', 'lightning') === 'e' &&
      H.keyFor('night', 'ability', 'heal') === 'w',
    'after the swap Lightning is E and Healing Rain is W'
  );
  ok(
    H.keyFor('creative', 'ability', 'lightning') === 'e' &&
      H.keyFor('creative', 'ability', 'heal') === 'w',
    'on the other screens too'
  );
  noDups(H, 'after a swap');

  // A conflict that exists only on another screen is still refused (F is "centre on selection" there).
  r = H.rebind('night', 'hunt:', 'f');
  ok(!r.ok && r.reason === 'conflict', 'H cannot become F: Meteor Shower holds it');
  r = H.rebind('unit_selected', 'promote:', 'c');
  ok(
    !r.ok && r.conflict?.id === 'clearSelection:',
    'conflicts are judged inside the state being changed'
  );
  r = H.rebind('unit_selected', 'promote:', 'o');
  ok(
    !r.ok && /Outpost/.test(r.message),
    'a build key cannot be taken by a selection order in the same state'
  );

  // Reserved and fixed keys.
  for (const k of ['escape', 'f5', 'ctrl+w', 'ctrl+t', 'ctrl+r', 'f12', 'alt+f4', 'space', 'tab']) {
    r = H.rebind('night', 'hunt:', k);
    ok(!r.ok && r.reason === 'reserved' && r.message, `${k} cannot be bound`);
  }
  r = H.rebind('night', 'pause:', 'p');
  ok(!r.ok && r.reason === 'fixed', 'Space (pause) cannot be moved');
  r = H.rebind('night', 'pauseMenu:', 'p');
  ok(!r.ok && r.reason === 'fixed', 'Escape cannot be moved');
  r = H.rebind('night', 'hunt:', 'pad:a');
  ok(!r.ok && r.reason === 'device', 'a keyboard action does not take a controller button');
  ok(H.keyFor('night', 'hunt') === 'h', 'refusals leave the key alone');

  // Unbinding.
  r = H.rebind('night', 'mute:', null);
  ok(
    r.ok && H.keyFor('night', 'mute') === null && H.lookup('menu', 'v') === null,
    'an action can be left with no key'
  );
  ok(!H.sheet('night').some((x) => /Mute/.test(x.label)), 'and then it is not on the key sheet');
  noDups(H, 'after an unbind');

  // Persistence round-trip: a fresh load against the same storage.
  ok(
    typeof store.data[H.STORAGE_KEY] === 'string' && /-v\d+$/.test(H.STORAGE_KEY),
    `saved under a versioned key (${H.STORAGE_KEY})`
  );
  ok(JSON.parse(store.data[H.STORAGE_KEY]).v === 1, 'the saved table carries its version');
  const H2 = loadHotkeys(store);
  ok(
    H2.keyFor('night', 'ability', 'fireball') === 'ctrl+e' &&
      H2.keyFor('day', 'ability', 'lightning') === 'e' &&
      H2.keyFor('night', 'ability', 'heal') === 'w' &&
      H2.keyFor('pause', 'mute') === null,
    'a reload brings the rebinds back'
  );
  noDups(H2, 'after a reload');

  // Reset one state, then all.
  H2.resetState('night');
  ok(
    H2.keyFor('night', 'ability', 'fireball') === 'q' &&
      H2.keyFor('day', 'ability', 'fireball') === 'ctrl+e',
    'resetting one screen leaves the others'
  );
  noDups(H2, 'after resetting one state');
  H2.resetAll();
  ok(
    !H2.isCustom() &&
      H2.keyFor('day', 'ability', 'fireball') === 'q' &&
      H2.keyFor('menu', 'mute') === 'v',
    'reset all restores every default'
  );
  ok(
    JSON.stringify(H2.KEYMAPS) === JSON.stringify(loadHotkeys(fakeStorage()).KEYMAPS),
    'and the maps equal a clean install'
  );
  ok(!loadHotkeys(store).isCustom(), 'the reset is saved too');

  // Bad stored data never breaks the maps.
  const junk = [
    '{not json',
    JSON.stringify({ v: 99, overrides: { night: { 'hunt:': 'q' } } }),
    JSON.stringify({ v: 1, overrides: { night: { 'hunt:': 'q' } } }), // doubles Q
    JSON.stringify({
      v: 1,
      overrides: { night: { 'hunt:': 'f5', 'pause:': 'p', 'nope:': 'x', 'mute:': 7 } },
    }),
  ];
  for (const raw of junk) {
    const h = loadHotkeys(fakeStorage({ 'myth-and-blood-keys-v1': raw }));
    ok(
      h.validate().length === 0 &&
        h.keyFor('night', 'hunt') === 'h' &&
        h.keyFor('night', 'pause') === 'space',
      `bad saved keys are dropped (${raw.slice(0, 40)})`
    );
  }
  // No storage at all (private mode): still works, just does not persist.
  const blocked = loadHotkeys({
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  });
  ok(blocked.rebind('night', 'hunt:', 'ctrl+h').ok === false, 'ctrl+h is reserved');
  ok(
    blocked.rebind('night', 'hunt:', 'ctrl+g').ok && blocked.keyFor('night', 'hunt') === 'ctrl+g',
    'rebinding works when storage is blocked'
  );
  ok(loadHotkeys(null).validate().length === 0, 'and with no localStorage at all');
}

// --- controller -----------------------------------------------------------------------------------------
{
  const btn = (...on) =>
    Array.from({ length: 16 }, (_, i) => ({
      pressed: on.includes(i),
      value: on.includes(i) ? 1 : 0,
    }));
  ok(Hotkeys.padKeys(null).length === 0, 'no controller: no keys');
  ok(
    Hotkeys.padKeys({ buttons: btn(0, 5), axes: [0, 0] }).join() === 'pad:a,pad:rb',
    'A and the right bumper'
  );
  ok(
    Hotkeys.padKeys({ buttons: btn(), axes: [-0.9, 0.8] })
      .sort()
      .join() === 'pad:down,pad:left',
    'the left stick counts as the d-pad'
  );
  ok(
    Hotkeys.padKeys({ buttons: btn(14), axes: [-0.9, 0] }).join() === 'pad:left',
    'd-pad and stick together are one key'
  );
  ok(
    at('night', 'pad:rb')?.action === 'cycleSoldier' &&
      at('night', 'pad:lb')?.action === 'cycleSoldierBack',
    'bumpers walk through the soldiers'
  );
  ok(
    at('placement', 'pad:b')?.action === 'cancel' &&
      at('unit_selected', 'pad:b')?.action === 'clearSelection',
    'B cancels'
  );
  ok(
    at('spoils', 'pad:a')?.action === 'spoilConfirm' &&
      at('menu', 'pad:a')?.action === 'startRun' &&
      at('night', 'pad:a')?.action === 'beginDay',
    'A confirms'
  );
  ok(
    at('night', 'pad:up')?.action === 'pan' &&
      Hotkeys.padFor('night', 'pan', 'arrowup') === 'pad:up',
    'the d-pad pans, in the same table'
  );
  ok(
    Hotkeys.keyFor('night', 'pan', 'arrowup') === 'arrowup',
    'keyFor still answers with the keyboard key'
  );
  for (const s of Hotkeys.STATES) {
    ok(
      at(s, 'pad:b')?.action === at(s, 'escape')?.action || s === 'spoils',
      `${s}: B does what Escape does`
    );
  }
}

// --- the key sheet lists a state's keys once each -------------------------------------------------
{
  const rows = Hotkeys.sheet('pause');
  ok(
    rows.some((r) => r.keys === 'Space' && r.label === 'Resume'),
    'pause sheet lists Space: Resume'
  );
  ok(!rows.some((r) => /Fireball/.test(r.label)), 'pause sheet does not list strikes');
  const night = Hotkeys.sheet('night', (b) => (b.action === 'deploySlot' ? null : b.label));
  ok(
    night.filter((r) => r.label === 'Pan the map').length === 1,
    'the four arrow keys are one row'
  );
  ok(
    !night.some((r) => /Recruit slot/.test(r.label)),
    'a row can be dropped (empty recruit slots)'
  );
}

// --- README ------------------------------------------------------------------------------------------
{
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  ok(!/Cycle game speed/.test(readme), 'README no longer lists a speed key');
  ok(
    /War Cry/.test(readme) && /Hold the Line/.test(readme),
    "README lists the General's orders on [ and ]"
  );
  ok(/\| \? +\|/.test(readme), 'README lists the ? key sheet');
}

if (failures()) {
  console.error(`\n${failures()} hotkey test(s) failed`);
  process.exit(1);
}
console.log('\nAll hotkey tests passed.');
