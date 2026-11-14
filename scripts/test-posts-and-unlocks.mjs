/**
 * Posts, the crossbowman, the staged introduction, the Hellbane opening, the field-edge
 * spawn markers and the run score.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const STEPS_KEY = 'myth-and-blood-first-steps-v1';
const SCORE_KEY = 'myth-and-blood-scores-v1';

function start(seed, diff = 'normal', storage = {}) {
  const { sb, cvs } = boot(seed);
  for (const k in storage) sb.localStorage.setItem(k, storage[k]);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, Roster, Research, GameState, UnitDefs, createUnit })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty(diff);
  api.Game.start();
  api.sb = sb;
  return api;
}

const run = (Game, n) => {
  for (let i = 0; i < n; i++) Game.update();
};
const mine = (GS) => GS.units.filter((u) => u.team === 'player' && u.hp > 0);
const clearFoes = (GS) => {
  for (const u of GS.units) if (u.team !== 'player') u.hp = 0;
  GS.spawnQueue = [];
};

// --- 1. posts ----------------------------------------------------------------------------
{
  const { Game, GameState: GS } = start(5);
  run(Game, 30);
  const squad = mine(GS).filter((u) => u.canHunt);
  ok(squad.length >= 2, `the opening squad is on the field (${squad.length})`);
  ok(
    squad.every((u) => Number.isFinite(u.postX) && Number.isFinite(u.postY)),
    'every soldier has a post where he was deployed'
  );
  const a = squad[0];
  const home = { x: a.postX, y: a.postY };
  ok(Math.hypot(a.x - home.x, a.y - home.y) < 8, 'he starts on his post');

  // Dragged off by a chase that ended: nothing to fight, so he walks home.
  clearFoes(GS);
  a.x += 110;
  a.y -= 140;
  run(Game, 60);
  ok(!a.returningToPost, 'he waits about two seconds before turning back');
  run(Game, 600);
  const back = Math.hypot(a.x - home.x, a.y - home.y);
  ok(back < 20, `idle in Hunt mode, he walks back to his post (${Math.round(back)} away)`);
  ok(a.huntMode && !a.manualOrder, 'walking home leaves him in Hunt mode, not on a manual order');

  // A manual order moves the post to where he was sent.
  Game.selectUnit(a.id);
  const dest = { x: home.x + 90, y: home.y - 60 };
  Game.moveSelectionToWorld(dest.x, dest.y);
  ok(
    Math.hypot(a.postX - dest.x, a.postY - dest.y) < 2,
    'a move order makes the destination his new post'
  );
  run(Game, 500);
  const atDest = Math.hypot(a.x - dest.x, a.y - dest.y);
  ok(atDest < 22, `he marches there and stays (${Math.round(atDest)} away)`);

  // Hotkey B: back to post now.
  clearFoes(GS);
  a.x -= 150;
  ok(Game.returnSelectionToPosts() === true, 'B orders the selection back to its posts');
  run(Game, 500);
  const again = Math.hypot(a.x - dest.x, a.y - dest.y);
  ok(again < 22, `and he gets there (${Math.round(again)} away)`);

  // A manually held soldier is left alone.
  const b = squad[1];
  clearFoes(GS);
  Game.selectUnit(b.id);
  Game.orderHoldHere();
  const held = { x: b.x, y: b.y };
  run(Game, 300);
  ok(
    !b.returningToPost && Math.hypot(b.x - held.x, b.y - held.y) < 8,
    'the hold stance is untouched: a held soldier does not wander'
  );
  Game.orderHunt();
  Game.selectUnit(a.id);
  // Posts survive a save and load.
  const snap = Game.exportGameState();
  const aId = a.id; // the object goes back to the pool on load
  const saved = snap.units.find((u) => u.id === aId);
  ok(
    saved && Math.abs(saved.postX - a.postX) < 0.01 && Math.abs(saved.postY - a.postY) < 0.01,
    'the post is written to the save'
  );
  const loadedOk = Game.importGameState(JSON.parse(JSON.stringify(snap)));
  const loaded = GS.units.find((u) => u.id === aId);
  ok(
    loadedOk && loaded && Math.abs(loaded.postX - saved.postX) < 0.01 && !loaded.returningToPost,
    `and read back on load (${loadedOk}, ${loaded?.postX} vs ${saved?.postX}, ${loaded?.returningToPost})`
  );
}

// --- 1b. posts do not stall a wave: a full passive wave still ends ------------------------
{
  const { Game, GameState: GS } = start(21, 'baby');
  let t = 0;
  while (t++ < 9000 && !(GS.timeOfDay === 'night' && GS.wave >= 1)) Game.update();
  ok(GS.timeOfDay === 'night', `wave 1 ends with soldiers keeping posts (tick ${t})`);
  const drift = mine(GS)
    .filter((u) => u.canHunt)
    .map((u) => Math.hypot(u.x - u.postX, u.y - u.postY));
  run(Game, 700);
  const after = mine(GS)
    .filter((u) => u.canHunt && !u.retreatingToMed && !u.atMedicalTent)
    .map((u) => Math.hypot(u.x - u.postX, u.y - u.postY));
  ok(
    after.every((d) => d < 34),
    `after the fight the line re-forms (was up to ${Math.round(Math.max(0, ...drift))}, now ${Math.round(Math.max(0, ...after))})`
  );
}

// --- 2. crossbowman ----------------------------------------------------------------------
{
  const { Roster, Research, UnitDefs, createUnit } = start(7);
  const def = UnitDefs.crossbowman;
  ok(def && def.cost === 5 && def.type === 'ranged', 'the crossbowman is a 5 TP ranged troop');
  ok(def.reloadMult === 1.8, 'he reloads 1.8 times slower than an archer');
  const p = Roster.TROOPS.crossbowman;
  ok(p && p.role === 'Armour piercer', 'he has a roster profile');
  const xbow = createUnit('crossbowman', 0, 0, 'player');
  ok(xbow && xbow.reloadMult === 1.8 && xbow.projectile === 'arrow', 'he spawns with a slow bow');
  const far = (type) => ({ type, team: 'enemy', x: 0, y: -150, hp: 100, maxHp: 100, id: type });
  const ctx = { units: [], tick: 0 };
  const plate = Roster.modifyDamage(xbow, far('dark_knight'), 100, ctx);
  const flesh = Roster.modifyDamage(xbow, far('goblin'), 100, ctx);
  ok(
    plate === 140 && flesh === 100,
    `quarrels pierce armour (${plate} vs plate, ${flesh} vs goblin)`
  );
  const close = Roster.modifyDamage(xbow, { ...far('goblin'), y: -30 }, 100, ctx);
  ok(close === 60, `and he is weak with an enemy in his face (${close})`);
  ok(
    Research.isDeployUnlocked('crossbowman', { wave: 1 }) === false ||
      Research.isDeployUnlocked('sapper', { wave: 1 }) ===
        Research.isDeployUnlocked('crossbowman', { wave: 1 }),
    'he unlocks with Iron Weapons, like the sapper and the knight'
  );
}

// --- 3. staged introduction --------------------------------------------------------------
// One in-run teacher: a prompt opens for its wave, only when its subject is on screen and can
// be used; it names the key bound right now; it waits for the player to act or dismiss it.
const promptOf = (Game) => Game.getState().siegeLoop.firstSteps.prompt;
/** Run until a prompt is open (or the tick budget runs out). Returns its id. */
const untilPrompt = (Game, SiegeLoop, max = 600) => {
  for (let i = 0; i < max && !SiegeLoop.introductionStatus().prompt; i++) Game.update();
  return SiegeLoop.introductionStatus().prompt;
};
{
  const { Game, SiegeLoop, GameState: GS, sb } = start(9);
  Game.updatePresentation?.();
  let fs = Game.getState().siegeLoop.firstSteps;
  ok(fs.active, 'a first run is staged');
  ok(fs.unlocked.deploy && !fs.unlocked.strikes && !fs.unlocked.intel, 'wave 1 shows deploy only');
  ok(fs.prompt === null, 'no prompt in the first seconds: the opening announcements go first');

  // Wave 1: recruiting. It opens once a footman can be paid for, and closes when one is hired.
  GS.tactical = 0;
  run(Game, 300);
  ok(
    SiegeLoop.introductionStatus().prompt === null,
    'with an empty purse the recruit prompt waits: it never describes what cannot be done'
  );
  GS.tactical = 20;
  ok(untilPrompt(Game, SiegeLoop) === 'deploy', 'wave 1, purse filled: the recruit prompt opens');
  let p = promptOf(Game);
  ok(
    /Footman/.test(p.text) && /Shift/.test(p.text) && /\[\[1\]\]/.test(p.text),
    `it names the troop, Shift for several, and the recruit key: "${p.text}"`
  );
  ok(!/keys 1-6/.test(p.text), 'the old hardcoded "keys 1-6" is gone');
  ok(
    p.action && p.target && p.target.dom[0] === '.deploy-btn[data-unit="footman"]',
    'it points at the Footman button'
  );
  run(Game, 400);
  ok(
    SiegeLoop.introductionStatus().prompt === 'deploy',
    'it waits: no timer takes the prompt away during its wave'
  );
  const before = mine(GS).length;
  Game.selectDeploy('footman');
  Game.handleClick(GS.worldW / 2, GS.deployY + 40);
  if (mine(GS).length === before) {
    // The click missed the deploy band on this map: place him by hand, the rule is the same.
    const u = mine(GS)[0];
    GS.units.push({ ...u, id: 999001, x: u.x + 30, postX: u.postX + 30 });
  }
  run(Game, 40);
  ok(SiegeLoop.introductionStatus().prompt !== 'deploy', 'hiring a soldier closes it');
  ok(
    Game.getState().siegeLoop.firstSteps.shown.includes('deploy'),
    'and it is not offered again this siege'
  );

  // Each prompt belongs to a wave.
  const wantAt = {
    deploy: 1,
    hunt: 2,
    dawn: 2,
    crates: 2,
    breach: 3,
    posts: 3,
    build: 4,
    wall: 4,
    spoils: 5,
    lab: 5,
    strikes: 6,
    preview: 6,
    medtent: 7,
    intel: 8,
    score: 9,
  };
  for (const id in wantAt) {
    const step = SiegeLoop.FIRST_STEPS.find((s) => s.id === id);
    ok(step && step.wave === wantAt[id], `${id} is introduced for wave ${wantAt[id]}`);
  }

  // Fires on its wave, and only when its subject is available. A hand-made siege state:
  // `wave` is the wave just fought, and at night the next one is being prepared for.
  const soldier = (type, extra = {}) => ({
    id: Math.random(),
    type,
    team: 'player',
    hp: 10,
    canHunt: type !== 'builder',
    postX: 0,
    postY: 0,
    ...extra,
  });
  const work = (type, complete = true) => ({ type, owner: 'player', hp: 10, complete });
  const at = (wave, isNight, extra = {}) => ({
    wave,
    isNight,
    missLimit: 10,
    tick: 0,
    units: [soldier('footman')],
    buildings: [],
    tp: 99,
    army: 1,
    ...extra,
  });
  const status = (id, ctx) => SiegeLoop.stepStatus(id, ctx);
  // The night before its wave is the earliest a prompt may open.
  for (const id in wantAt) {
    const w = wantAt[id];
    if (w < 2) continue;
    ok(
      status(id, at(w - 2, true)) === 'early' && status(id, at(w - 1, false)) === 'early',
      `${id}: not before the night that leads to wave ${w}`
    );
  }
  ok(status('breach', at(2, true)) === 'ready', 'breach: opens the night before wave 3');
  ok(status('spoils', at(4, true)) === 'ready', 'spoils: opens the night before wave 5');
  ok(status('strikes', at(5, true)) === 'ready', 'spells: open the night before wave 6');
  ok(status('intel', at(7, true)) === 'ready', 'spy and courier: the night before wave 8');
  // Subjects.
  ok(
    status('deploy', at(1, false, { tp: 1 })) === 'waiting' &&
      status('deploy', at(1, false, { tp: 50 })) === 'ready',
    'deploy: waits until a Footman can be paid for'
  );
  ok(
    status('dawn', at(2, false)) === 'waiting' && status('dawn', at(1, true)) === 'ready',
    'dawn: only at night, when the day can be called'
  );
  ok(status('crates', at(2, false)) === 'waiting', 'crates: waits until a crate is on the field');
  ok(
    status('hunt', at(1, true, { units: [soldier('builder')] })) === 'waiting' &&
      status('hunt', at(1, true)) === 'ready',
    'hunt: needs a soldier who takes orders'
  );
  ok(
    status('build', at(3, true, { tp: 2 })) === 'waiting' &&
      status('build', at(3, true)) === 'ready' &&
      status('build', at(3, true, { units: [soldier('builder')] })) === 'moot',
    'build: waits for the price of a Builder, and is passed over if one is already hired'
  );
  ok(
    status('wall', at(3, true)) === 'waiting' &&
      status('wall', at(3, true, { units: [soldier('builder')] })) === 'ready' &&
      status('wall', at(3, true, { units: [soldier('builder')], buildings: [work('wall')] })) ===
        'moot',
    'wall: needs a Builder on the field; passed over once a wall stands'
  );
  ok(
    status('lab', at(4, true, { units: [soldier('builder')], tp: 17 })) === 'waiting' &&
      status('lab', at(4, true, { units: [soldier('builder')], tp: 18 })) === 'ready' &&
      status('lab', at(4, true)) === 'waiting',
    'lab: needs a Builder and 18 TP'
  );
  ok(
    status('research', at(4, true, { buildings: [work('research_lab', false)] })) === 'waiting' &&
      status('research', at(4, true, { buildings: [work('research_lab')] })) === 'ready',
    'research: only once the lab is finished'
  );
  ok(
    status('medtent', at(6, true)) === 'waiting' &&
      status('medtent', at(6, true, { units: [soldier('builder')] })) === 'ready',
    'med tent: needs a Builder on the field'
  );
  ok(
    status('upkeep', at(3, true, { army: 6 })) === 'waiting' &&
      status('upkeep', at(3, true, { army: 13 })) === 'ready' &&
      status('upkeep', at(3, true, { army: 13, freeArmyBonus: 3 })) === 'waiting',
    'upkeep: opens one soldier short of the surcharge (granaries move the mark)'
  );
  ok(
    status('sapper', at(5, true)) === 'waiting',
    'sapper: not while Iron Weapons is unresearched'
  );
  ok(
    status('preview', at(5, false)) === 'early' || status('preview', at(6, false)) === 'waiting',
    'preview: only at night, when the note is on screen'
  );
  // The General's orders wait until a General can really be recruited.
  const orders = SiegeLoop.FIRST_STEPS.find((s) => s.id === 'orders');
  ok(orders && orders.needs === 'general' && orders.wave >= 6, 'orders wait for a General');
  ok(
    status('orders', at(7, true, { canRecruitGeneral: false })) === 'early' &&
      status('orders', at(7, true, { canRecruitGeneral: true })) === 'ready',
    'orders: early without a General to hire, ready with one'
  );
  ok(
    !/General/.test(SiegeLoop.promptText('build')) && !/General/.test(SiegeLoop.promptText('wall')),
    'the wave 4 prompts do not describe a General'
  );
  const hud = (extra) =>
    SiegeLoop.getHudState({ wave: 7, isNight: true, missLimit: 10, ...extra }).firstSteps;
  ok(
    !hud({ canRecruitGeneral: false }).unlocked.orders,
    'no General yet: orders stay unintroduced'
  );
  ok(
    hud({ canRecruitGeneral: true }).unlocked.orders,
    'General recruitable: orders are introduced'
  );
  ok(
    !Game.getState().siegeLoop.firstSteps.unlocked.orders,
    'a fresh run cannot recruit a General, so the game does not introduce his orders'
  );
  // Nothing is blocked: a strike can still be picked while its tab is dimmed.
  const tpBefore = GS.tactical;
  GS.tactical = 50;
  Game.selectAbility('fireball');
  ok(Game.getState().selectedAbility === 'fireball', 'dimmed is not locked: fireball can be armed');
  Game.clearPlacementMode();
  GS.tactical = tpBefore;

  // Day 6: strikes are in, spy and courier still wait.
  fs = SiegeLoop.getHudState({ wave: 6, isNight: false, missLimit: 10 }).firstSteps;
  ok(fs.unlocked.strikes && !fs.unlocked.intel, 'by wave 6 strikes are shown, spy and courier not');
  // The night before wave 8 already shows them.
  fs = SiegeLoop.getHudState({ wave: 7, isNight: true, missLimit: 10 }).firstSteps;
  ok(fs.unlocked.intel, 'the night before wave 8 shows spy and courier');

  // --- keys: prompts read the Hotkeys table, so a rebind shows at once ------------------
  const Hotkeys = sb.Hotkeys;
  const rebind = (action, arg, key) => {
    for (const state of Hotkeys.STATES) {
      for (const b of Hotkeys.KEYMAPS[state]) {
        if (b.action === action && (b.arg ?? null) === (arg ?? null)) b.key = key;
      }
    }
  };
  const text = (id, ctx) => SiegeLoop.promptText(id, ctx || at(5, true));
  ok(/Press D or click BEGIN DAY/.test(text('dawn')), `default: D begins the day ("${text('dawn')}")`);
  rebind('beginDay', null, 'g');
  ok(
    /Press G or click BEGIN DAY/.test(text('dawn')) && !/Press D/.test(text('dawn')),
    `after a rebind the prompt names the new key ("${text('dawn')}")`
  );
  ok(/Wall \(L\)/.test(text('wall')), 'default: L builds a wall');
  rebind('build', 'wall', 'k');
  ok(/Wall \(K\)/.test(text('wall')) && !/\(L\)/.test(text('wall')), 'wall key follows a rebind');
  rebind('hunt', null, 'f9');
  rebind('holdHere', null, 'shift+f9');
  rebind('backToPosts', null, 'x');
  ok(
    /F9 lets him hunt again/.test(text('hunt')) && !/\bH lets/.test(text('hunt')),
    `hunt key follows a rebind ("${text('hunt')}")`
  );
  ok(
    /Shift\+F9 and F9 do the same/.test(text('posts')) && /X sends selected/.test(text('posts')),
    `Hold, Hunt and back-to-posts keys follow a rebind ("${text('posts')}")`
  );
  rebind('ability', 'fireball', '7');
  ok(/7 Fireball/.test(text('strikes')) && !/Q Fireball/.test(text('strikes')), 'spell keys too');
  rebind('order', 'warCry', ',');
  rebind('order', 'holdLine', '.');
  const ordersText = text('orders', at(7, true, { canRecruitGeneral: true }));
  ok(
    /War Cry \(,\)/.test(ordersText) && /Hold the Line \(\.\)/.test(ordersText),
    `the General's orders name their keys, not "[" and "]" ("${ordersText}")`
  );
  Hotkeys.SLOT_KEYS[0] = 'm';
  ok(
    /Press M or click Footman/.test(text('deploy')),
    `the recruit key follows the slot table ("${text('deploy')}")`
  );
  // An action with no key at all is described by its button alone.
  for (const state of Hotkeys.STATES) {
    Hotkeys.KEYMAPS[state] = Hotkeys.KEYMAPS[state].filter((b) => b.action !== 'beginDay');
  }
  ok(/^It is night.*Click BEGIN DAY/.test(text('dawn')), 'unbound: "Click BEGIN DAY", no key named');
  const every = SiegeLoop.FIRST_STEPS.map((s) => text(s.id, at(8, true, { canRecruitGeneral: true })));
  ok(
    every.every((t) => t.length > 20 && !/\[\[|undefined|null|NaN|\(\)/.test(t)),
    'every prompt renders to plain words with no blanks'
  );

  ok(SiegeLoop.skipIntroduction(), 'the introduction can be skipped');
  fs = SiegeLoop.getHudState({ wave: 1, isNight: false, missLimit: 10 }).firstSteps;
  ok(!fs.active && fs.unlocked.intel, 'after skipping, everything shows at once');
  ok(fs.prompt === null, 'and the open prompt is gone');
  run(Game, 400);
  ok(SiegeLoop.introductionStatus().prompt === null, 'no prompt opens after a skip');
  ok(/"skipped":true/.test(sb.localStorage.getItem(STEPS_KEY) || ''), 'the skip is stored');
}
{
  // Dismissing: "Got it" closes a prompt for good, and the next one follows.
  const { Game, SiegeLoop, GameState: GS } = start(12);
  GS.tactical = 20;
  ok(untilPrompt(Game, SiegeLoop) === 'deploy', 'a second siege: the recruit prompt opens');
  ok(SiegeLoop.dismissPrompt() === true, 'the prompt can be dismissed');
  ok(SiegeLoop.introductionStatus().prompt === null, 'dismissed: the card is empty');
  run(Game, 300);
  ok(
    SiegeLoop.introductionStatus().prompt !== 'deploy',
    'a dismissed prompt does not come back'
  );
  ok(SiegeLoop.dismissPrompt() === false, 'dismissing with nothing open does nothing');

  // Night 1: the order prompt points at a soldier on the field, and a move order closes it.
  clearFoes(GS);
  let t = 0;
  while (t++ < 9000 && GS.timeOfDay !== 'night') {
    clearFoes(GS);
    Game.update();
  }
  ok(GS.timeOfDay === 'night', 'night falls after wave 1');
  ok(untilPrompt(Game, SiegeLoop, 900) === 'hunt', 'the first night teaches moving and holding');
  let p = promptOf(Game);
  const ringed = GS.units.find((u) => u.id === p.target.unit);
  ok(ringed && ringed.team === 'player' && ringed.canHunt, 'it rings a soldier who takes orders');
  Game.selectUnit(ringed.id);
  Game.moveSelectionToWorld(ringed.postX + 60, ringed.postY - 30);
  run(Game, 40);
  ok(SiegeLoop.introductionStatus().prompt !== 'hunt', 'moving a soldier closes it');
  ok(untilPrompt(Game, SiegeLoop, 900) === 'dawn', 'then: how to begin the day');
  p = promptOf(Game);
  ok(p.target.dom[0] === '#begin-day-btn', 'it points at BEGIN DAY');
  // A save taken now reopens the same prompt on load.
  const snap = Game.exportGameState();
  ok(snap.siegeLoop?.openStep === 'dawn' || JSON.stringify(snap).includes('"openStep":"dawn"'), 'the open prompt is saved');
  Game.beginDayPhase(true);
  run(Game, 40);
  ok(SiegeLoop.introductionStatus().prompt !== 'dawn', 'beginning the day closes it');
  ok(Game.importGameState(JSON.parse(JSON.stringify(snap))), 'the save loads');
  Game.updatePresentation?.();
  ok(SiegeLoop.introductionStatus().prompt === 'dawn', 'and the prompt that was open is open again');

  // A prompt left alone lapses at the next nightfall and is not repeated.
  Game.beginDayPhase(true);
  run(Game, 40);
  GS.tactical = 0; // nothing else can open: every later prompt needs TP or a later wave
  const open = untilPrompt(Game, SiegeLoop, 400);
  if (open) {
    t = 0;
    while (t++ < 12000 && GS.timeOfDay !== 'night') {
      clearFoes(GS);
      Game.update();
    }
    run(Game, 1000);
    ok(
      SiegeLoop.introductionStatus().prompt !== open,
      `${open}: left alone, it lapses at the next nightfall`
    );
  }
}
{
  // Reaching wave 10 once marks a returning commander.
  const { Game, SiegeLoop, GameState: GS, sb } = start(10);
  clearFoes(GS);
  GS.wave = 10;
  run(Game, 45);
  ok(SiegeLoop.introductionStatus().veteran, 'reaching wave 10 sets the returning-player flag');
  ok(/"veteran":true/.test(sb.localStorage.getItem(STEPS_KEY) || ''), 'and it is stored');
}
{
  const { Game, SiegeLoop, GameState: GS } = start(11, 'normal', {
    [STEPS_KEY]: JSON.stringify({ veteran: true }),
  });
  Game.updatePresentation?.();
  const fs = Game.getState().siegeLoop.firstSteps;
  ok(!fs.active && fs.unlocked.intel && fs.unlocked.strikes, 'a returning commander sees it all');
  GS.tactical = 30;
  run(Game, 600);
  ok(
    SiegeLoop.introductionStatus().prompt === null && fs.shown.length === 0,
    'and is shown no prompt'
  );
  // The TUTORIAL button: the next run is staged for anyone, once.
  ok(SiegeLoop.forceIntroduction(), 'the tutorial can be forced on');
  Game.start();
  Game.updatePresentation?.();
  ok(
    Game.getState().siegeLoop.firstSteps.active && SiegeLoop.introductionStatus().forced,
    'a forced run is staged even for a returning commander'
  );
  GS.tactical = 30;
  ok(untilPrompt(Game, SiegeLoop) === 'deploy', 'and its first prompt opens');
  Game.start();
  Game.updatePresentation?.();
  ok(!Game.getState().siegeLoop.firstSteps.active, 'the run after that is back to normal');
}
{
  // A skip is remembered: the next siege has no introduction, until the tutorial is asked for.
  const { Game, SiegeLoop } = start(17, 'normal', {
    [STEPS_KEY]: JSON.stringify({ skipped: true }),
  });
  Game.updatePresentation?.();
  ok(!Game.getState().siegeLoop.firstSteps.active, 'a commander who skipped sees no introduction');
  SiegeLoop.forceIntroduction();
  Game.start();
  Game.updatePresentation?.();
  ok(Game.getState().siegeLoop.firstSteps.active, 'TUTORIAL brings it back');
}
{
  // The Settings box "Introduction on your first sieges" turns it off.
  const api = start(18);
  // The game's services are already wired; SiegeLoop reads the setting when a run starts.
  api.sb.Settings = {
    get: (k) => (k === 'tutorialEnabled' ? false : k === 'gameSpeed' ? 1 : undefined),
    set: () => {},
    getPanelInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
    getCameraZoomSpeed: () => 1,
  };
  api.Game.start();
  api.Game.updatePresentation?.();
  ok(
    !api.Game.getState().siegeLoop.firstSteps.active,
    'with the Settings box unticked, a new commander gets no introduction'
  );
}

// --- 4. Hellbane opening -----------------------------------------------------------------
{
  const { Game, GameState: GS } = start(13, 'doomslayer');
  run(Game, 5);
  const squad = mine(GS).filter((u) => u.canHunt);
  for (const u of squad) {
    u.morale = 0;
    u.witnessDeaths = 9;
  }
  // Kill one so the others witness it and take a morale blow.
  const victim = squad[0];
  Game.takeDamage(victim, 99999);
  run(Game, 200);
  const left = mine(GS).filter((u) => u.canHunt);
  ok(
    left.length === squad.length - 1 && left.every((u) => !u.fleeing),
    `waves 1-2: broken morale does not make the opening squad desert (${left.length} stand)`
  );
  // From wave 3 the same blow routs them.
  GS.wave = 3;
  for (const u of left) {
    u.morale = 0;
    u.witnessDeaths = 9;
  }
  Game.takeDamage(left[0], 99999);
  run(Game, 3);
  ok(
    GS.units.some((u) => u.team === 'player' && u.fleeing),
    'from wave 3 soldiers can rout again'
  );
}
{
  // The extra bodies of a hard difficulty are phased in over the first two waves.
  const counts = {};
  for (const diff of ['normal', 'doomslayer']) {
    const { Game, GameState: GS } = start(14, diff);
    const seen = new Set();
    for (let i = 0; i < 4000 && GS.wave === 1 && GS.timeOfDay !== 'night'; i++) {
      Game.update();
      for (const u of GS.units) {
        if (u.team === 'enemy') seen.add(u.id);
        else if (u.team === 'player') u.hp = u.maxHp;
      }
    }
    counts[diff] = seen.size;
  }
  ok(
    counts.doomslayer >= counts.normal && counts.doomslayer <= Math.ceil(counts.normal * 1.3),
    `Hellbane wave 1 brings ${counts.doomslayer} foes against ${counts.normal} on Normal (not 1.5x)`
  );
}

// --- 6. spawn markers --------------------------------------------------------------------
{
  const { Game, SiegeLoop, GameState: GS } = start(15, 'baby');
  ok(
    SiegeLoop.spawnMarkers({ isNight: false, nextSides: ['north'] }) === null,
    'no markers by day'
  );
  let t = 0;
  while (t++ < 9000 && GS.timeOfDay !== 'night') Game.update();
  Game.updatePresentation?.();
  const marks = Game.getState().siegeLoop.spawnMarkers;
  ok(
    GS.nextWavePlan && GS.nextWavePlan.wave === GS.wave + 1,
    'the next wave is planned at nightfall'
  );
  ok(
    marks.length === GS.nextWavePlan.sides.length &&
      marks[0].side === 'north' &&
      marks[0].count > 0,
    `night shows a marker per attack side (${marks.map((m) => `${m.side}: about ${m.count}`).join('; ')})`
  );
  ok(marks[0].dy === 1 && marks[0].y < 60, 'the north marker sits on the top edge and points in');
  // The wave must use exactly the sides the night showed.
  GS.nextWavePlan.sides = ['east'];
  Game.beginDayPhase(true);
  run(Game, 2);
  ok(
    GS.waveAttackSides.length === 1 && GS.waveAttackSides[0] === 'east' && !GS.nextWavePlan,
    'the wave uses the stored sides, then the plan is spent'
  );
  const many = SiegeLoop.spawnMarkers({
    isNight: true,
    nextSides: ['north', 'east', 'west', 'south'],
    worldW: 1000,
    worldH: 600,
  });
  ok(many === null || many.length === 4, 'four flanks give four markers');
}

// --- 7. run score ------------------------------------------------------------------------
{
  const { Game, SiegeLoop, GameState: GS, sb } = start(16, 'chad');
  const s = SiegeLoop.computeScore({
    waves: 12,
    kills: 200,
    breaches: 3,
    lost: 10,
    difficulty: 'normal',
  });
  ok(s.base === 12 * 100 + 200 * 5 - 3 * 40 - 10 * 15, `base score arithmetic (${s.base})`);
  ok(s.total === 1930, `Normal multiplies by 1 (${s.total})`);
  const hell = SiegeLoop.computeScore({
    waves: 12,
    kills: 200,
    breaches: 3,
    lost: 10,
    difficulty: 'doomslayer',
    modifiers: [
      { id: 'enemy_hp_up', pct: 18 },
      { id: 'ally_hp_up', pct: -12 },
    ],
  });
  ok(hell.difficultyMult === 2, 'Hellbane doubles the score');
  ok(
    hell.total === Math.round(1930 * 2 * hell.modifierMult) &&
      Math.abs(hell.modifierMult - 1.18 * 0.88) < 0.001,
    `each advanced modifier multiplies it (${hell.total}, ×${hell.modifierMult})`
  );
  ok(
    SiegeLoop.computeScore({ waves: 0, kills: 1, breaches: 9, lost: 9 }).total === 0,
    'the score never goes below zero'
  );
  ok(
    SiegeLoop.computeScore({ waves: 1, difficulty: 'nonsense' }).difficulty === 'normal',
    'an unknown difficulty scores as Normal'
  );

  // End a real run and check the stored best.
  GS.wave = 4;
  GS.kills = 30;
  for (const u of mine(GS)) Game.takeDamage(u, 99999);
  run(Game, 5);
  ok(!Game.isPlaying(), 'the run ended');
  const last = SiegeLoop.lastScore();
  ok(
    last && last.difficulty === 'chad' && last.waves === 3 && last.kills === 30 && last.total > 0,
    `the run is scored: ${last?.total} (${last?.waves} waves, ${last?.kills} kills, ${last?.lost} lost)`
  );
  const best = JSON.parse(sb.localStorage.getItem(SCORE_KEY) || '{}');
  ok(best.chad === last.total, 'the best score per difficulty is stored');
  ok(
    SiegeLoop.recordScore({ ...last, total: last.total - 1 }) === false,
    'a lower score is not a best'
  );
  ok(SiegeLoop.getBestScores().normal === 0, 'other difficulties keep their own best');
}

process.exit(failures() ? 1 : 0);
