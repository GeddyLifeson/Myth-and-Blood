/**
 * Walk the staged introduction from the first prompt to the last, as a player would: each
 * action prompt is done (hire, move, build, research, open a crate), each note is dismissed.
 * Fails if a prompt never opens, or if doing what an action prompt asks does not close it.
 * The run is a returning commander's, started through the TUTORIAL path (forced on).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

const { sb, cvs } = boot(11);
// A veteran: without the TUTORIAL path this run would not be staged at all.
sb.localStorage.setItem('myth-and-blood-first-steps-v1', JSON.stringify({ veteran: true }));
const {
  Game,
  SiegeLoop,
  Research,
  GameState: GS,
  SpriteGen,
} = vm.runInContext(
  `${code}\n({ Game, SiegeLoop, Research, GameState, SpriteGen })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
SiegeLoop.forceIntroduction();
Game.start();
ok(SiegeLoop.introductionStatus().staged, 'the TUTORIAL path stages a veteran run');

const mine = () => GS.units.filter((u) => u.team === 'player' && u.hp > 0);
const hunter = () => mine().find((u) => u.canHunt && !u.isGeneral);

/** Hire one of a troop by clicking the field, trying spots until one takes. */
function hire(type) {
  const n = mine().length;
  for (let y = 520; y <= 680; y += 40) {
    for (let x = 300; x <= 1000; x += 70) {
      Game.selectDeploy(type);
      Game.handleClick(x, y);
      Game.clearPlacementMode();
      if (mine().length > n) return true;
    }
  }
  return false;
}

/** Order a building on the field, trying spots until one takes; it is finished at once. */
function build(type) {
  const n = GS.buildings.length;
  // Spots within the builder's reach first: a site out of reach only sends him walking.
  const b0 = mine().find((u) => u.type === 'builder');
  const spots = [];
  if (b0) {
    for (let r = 30; r <= 90; r += 30) {
      for (let a = 0; a < 12; a++) {
        const wx = b0.x + Math.cos((a / 12) * Math.PI * 2) * r;
        const wy = b0.y + Math.sin((a / 12) * Math.PI * 2) * r;
        spots.push([GS.viewX + wx * GS.viewScale, GS.viewY + wy * GS.viewScale]);
      }
    }
  }
  for (let y = 480; y <= 660; y += 45) for (let x = 300; x <= 1000; x += 80) spots.push([x, y]);
  for (const [x, y] of spots) {
    Game.selectBuild(type);
    Game.handleClick(x, y);
    Game.clearPlacementMode();
    if (GS.buildings.length > n) {
      const b = GS.buildings[GS.buildings.length - 1];
      // Waiting out the build time teaches nothing here.
      b.complete = true;
      b.buildProgress = b.buildTime || 1;
      return true;
    }
  }
  return false;
}

const ACTIONS = {
  deploy: () => hire('footman'),
  hunt: () => {
    const u = hunter();
    Game.selectUnit(u.id);
    Game.moveSelectionToWorld(u.postX + 60, u.postY - 40);
    return true;
  },
  dawn: () => (Game.beginDayPhase(true), true),
  crates: () => {
    const c = Game.getState().siegeLoop.crates[0];
    const u = hunter();
    u.x = c.x;
    u.y = c.y;
    return true;
  },
  build: () => hire('builder'),
  wall: () => build('wall'),
  lab: () => build('research_lab'),
  research: () => Research.startResearch('iron_weapons', GS.wave, GS.buildings) !== false,
  medtent: () => build('medical_tent'),
  sapper: () => hire('sapper'),
};

const ids = SiegeLoop.stepIds();
const opened = [];
const closedByAction = [];
const stuck = [];
let lastId = null;
let actedAt = -1;
let nightIdle = 0;
let dayTicks = 0;

for (let t = 0; t < 200000 && GS.wave < 10 && Game.isPlaying(); t++) {
  // The purse never holds a prompt back, and nobody dies: this walk is about the teaching.
  GS.tactical = Math.max(GS.tactical, 300);
  for (const u of GS.units) if (u.team === 'player') u.hp = u.maxHp;

  // Unlock what the later prompts are about, at the waves a player would have them.
  if (GS.wave >= 4 && !Research.isResearched('iron_weapons') && Research.getActiveInfo()) {
    Research.completeResearch('iron_weapons');
  }
  if (GS.wave >= 5 && Research.isResearched('iron_weapons')) {
    if (!Research.isResearched('command_theory')) Research.completeResearch('command_theory');
  }
  // A big army, so the upkeep note has a reason to open.
  if (GS.wave >= 6 && GS.timeOfDay === 'night' && mine().length < 15) hire('footman');

  const open = SiegeLoop.introductionStatus().prompt;
  if (open && open !== lastId) {
    lastId = open;
    opened.push(open);
    const text = SiegeLoop.promptText(open);
    ok(
      text && !/undefined|NaN|\[\[|null/.test(text),
      `${open}: the prompt reads cleanly: "${text}"`
    );
    if (ACTIONS[open]) {
      ok(ACTIONS[open](), `${open}: the player can do what it asks`);
      actedAt = t;
    } else {
      SiegeLoop.dismissPrompt();
    }
  }
  if (open && ACTIONS[open] && actedAt >= 0 && t - actedAt > 300) {
    stuck.push(open);
    SiegeLoop.dismissPrompt();
    actedAt = -1;
  }
  if (!open && lastId && ACTIONS[lastId] && actedAt >= 0) {
    closedByAction.push(lastId);
    actedAt = -1;
  }

  Game.update();

  if (GS.timeOfDay === 'night') {
    dayTicks = 0;
    nightIdle = SiegeLoop.introductionStatus().prompt ? 0 : nightIdle + 1;
    if (nightIdle > 400) Game.beginDayPhase(true);
  } else {
    nightIdle = 0;
    dayTicks++;
    // Hold the day long enough for a crate to land, then end the wave.
    const crateDue = GS.wave >= 2 && !opened.includes('crates');
    if (dayTicks > (crateDue ? 2400 : 600)) {
      for (const u of GS.units) if (u.team !== 'player') u.hp = 0;
      GS.spawnQueue.length = 0;
    }
  }
}

ok(GS.wave >= 10 && Game.isPlaying(), `the siege reached wave 10 (wave ${GS.wave})`);
const missing = ids.filter((id) => !opened.includes(id));
ok(missing.length === 0, `every prompt opened (${opened.join(', ')}); missing: ${missing}`);
ok(stuck.length === 0, `every action prompt closed when done; stuck: ${stuck}`);
const actions = Object.keys(ACTIONS).filter((id) => opened.includes(id));
ok(
  actions.every((id) => closedByAction.includes(id)),
  `the action prompts closed by the action: ${closedByAction.join(', ')}`
);
ok(!SiegeLoop.introductionStatus().prompt, 'no prompt is left open at the end');

if (failures()) {
  console.error(`\n${failures()} introduction walk check(s) failed`);
  process.exit(1);
}
console.log('\nThe introduction walks from start to finish.');
