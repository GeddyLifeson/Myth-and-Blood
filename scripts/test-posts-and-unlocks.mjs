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
{
  const { Game, SiegeLoop, GameState: GS } = start(9);
  Game.updatePresentation?.();
  let fs = Game.getState().siegeLoop.firstSteps;
  ok(fs.active, 'a first run is staged');
  ok(fs.unlocked.deploy && !fs.unlocked.strikes && !fs.unlocked.intel, 'wave 1 shows deploy only');
  run(Game, 300);
  ok(
    GS.messages.some((m) => /hunt on their own/.test(m.text) && /Shift\+click/.test(m.text)),
    'wave 1 prompt: deploying, hunting and Shift+click to hold'
  );
  const wantAt = { crates: 2, breach: 3, orders: 4, spoils: 5, strikes: 6, intel: 8 };
  for (const id in wantAt) {
    const step = SiegeLoop.FIRST_STEPS.find((s) => s.id === id);
    ok(step && step.wave === wantAt[id], `${id} is introduced for wave ${wantAt[id]}`);
  }
  // Nothing is blocked: a strike can still be picked while its tab is dimmed.
  const tpBefore = GS.tactical;
  GS.tactical = 50;
  Game.selectAbility('fireball');
  ok(Game.getState().selectedAbility === 'fireball', 'dimmed is not locked: fireball can be armed');
  Game.clearPlacementMode();
  GS.tactical = tpBefore;

  // Day 6: strikes are in, spy and courier still wait.
  GS.wave = 6;
  GS.timeOfDay = 'day';
  Game.updatePresentation?.();
  fs = SiegeLoop.getHudState({ wave: 6, isNight: false, missLimit: 10 }).firstSteps;
  ok(fs.unlocked.strikes && !fs.unlocked.intel, 'by wave 6 strikes are shown, spy and courier not');
  // The night before wave 8 already shows them.
  fs = SiegeLoop.getHudState({ wave: 7, isNight: true, missLimit: 10 }).firstSteps;
  ok(fs.unlocked.intel, 'the night before wave 8 shows spy and courier');

  ok(SiegeLoop.skipIntroduction(), 'the introduction can be skipped');
  fs = SiegeLoop.getHudState({ wave: 1, isNight: false, missLimit: 10 }).firstSteps;
  ok(!fs.active && fs.unlocked.intel, 'after skipping, everything shows at once');
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
  const { Game } = start(11, 'normal', { [STEPS_KEY]: JSON.stringify({ veteran: true }) });
  Game.updatePresentation?.();
  const fs = Game.getState().siegeLoop.firstSteps;
  ok(!fs.active && fs.unlocked.intel && fs.unlocked.strikes, 'a returning commander sees it all');
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
