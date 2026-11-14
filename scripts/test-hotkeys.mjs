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

const sb = { console };
sb.globalThis = sb;
const Hotkeys = vm.runInContext(
  `${readFileSync(join(JS, 'hotkeys.js'), 'utf8')}\nHotkeys`,
  vm.createContext(sb)
);

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
ok(
  Hotkeys.STATES.every((s) => Hotkeys.KEYMAPS[s].every((b) => !/speed/i.test(b.action))),
  'no key is bound to game speed'
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
  ok(at(s, 'shift+tab')?.action === 'messageLog', `${s}: Shift+Tab opens the message log`);
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
  ev({ key: 'c', code: 'KeyC', ctrlKey: true }) === null,
  'Ctrl shortcuts are left to the browser'
);

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
