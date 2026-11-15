/**
 * Fixes from the 2026-11 overhaul audit that can be checked without a browser:
 * one recruit price (shown = charged, with army upkeep), versioned saves that carry the
 * next-wave spawn plan, and the cheats-used mark on a run (which voids its score, ribbon
 * progress and achievements).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed, extra = '') {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameState, UnitDefs, Cheats${extra ? `, ${extra}` : ''} })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}

/** Clear the current wave by hand and stop at the following night. */
function toNight(Game, GS) {
  for (let i = 0; i < 20000 && GS.timeOfDay !== 'night'; i++) {
    for (const u of GS.units) {
      if (u.team === 'player') u.hp = u.maxHp;
      else u.hp = 0;
    }
    GS.spawnQueue.length = 0;
    Game.update();
  }
  return GS.timeOfDay === 'night';
}

// --- 1. one price -------------------------------------------------------------------------
{
  const { Game, GameState: GS, SiegeLoop, UnitDefs } = start(11);
  ok(typeof Game.getDeployCost === 'function', 'Game.getDeployCost is exported');
  ok(toNight(Game, GS), 'reached the first night');
  const armyOf = () => GS.units.filter((u) => u.team === 'player' && u.hp > 0).length;
  ok(
    Game.getDeployCost('footman') === UnitDefs.footman.cost,
    `a small army pays the base price (${Game.getDeployCost('footman')})`
  );
  // Grow the army well past the free 14 so upkeep applies.
  GS.tactical = 5000;
  for (let i = 0; i < 26; i++) {
    Game.selectDeploy('footman');
    Game.handleClick(420 + ((i * 37) % 360), 520 + ((i * 53) % 90));
  }
  Game.update();
  const army = armyOf();
  ok(army >= 24, `army grown to ${army}`);
  const mult = SiegeLoop.deployCostMult(army);
  ok(mult > 1.5, `upkeep multiplier applies (×${mult.toFixed(2)})`);
  for (const type of ['footman', 'archer', 'healer']) {
    const want = Math.ceil(UnitDefs[type].cost * SiegeLoop.deployCostMult(armyOf()));
    const shown = Game.getDeployCost(type);
    ok(shown === want && shown > UnitDefs[type].cost, `${type}: shared price ${shown} = ${want}`);
    // One TP short: the purchase is refused and nothing is spent.
    GS.tactical = shown - 1;
    let before = armyOf();
    Game.selectDeploy(type);
    Game.handleClick(500, 560);
    ok(armyOf() === before && GS.tactical === shown - 1, `${type}: ${shown - 1} TP is not enough`);
    // Exactly the shown price: the purchase goes through and costs exactly that.
    GS.tactical = shown;
    before = armyOf();
    Game.clearSelection(); // the refused attempt left the unit selected; selecting again would toggle it off
    Game.selectDeploy(type);
    Game.handleClick(505, 565);
    ok(
      armyOf() === before + 1 && GS.tactical === 0,
      `${type}: ${shown} TP buys one and leaves ${GS.tactical}`
    );
    Game.update();
  }
  GS.creativeMode = true;
  GS.creativeSettings.freeResources = true;
  ok(Game.getDeployCost('footman') === 0, 'free-resources creative shows a price of 0');
}

// --- 2. saves: version check and the next-wave plan ----------------------------------------
{
  const { Game, GameState: GS } = start(23);
  ok(toNight(Game, GS), 'reached the first night');
  ok(
    GS.nextWavePlan && GS.nextWavePlan.wave === GS.wave + 1 && GS.nextWavePlan.sectors.length > 0,
    'the night has an entry-sector plan for the coming wave'
  );
  // Force a plan the dice would rarely give, so a fresh roll cannot pass for the saved one.
  const total = GS.nextWavePlan.total;
  Object.assign(GS.nextWavePlan, {
    sectors: ['right'],
    main: 'right',
    shares: { right: 1 },
    counts: { right: total },
    types: { right: ['goblin'] },
    byType: null,
    bossSector: null,
  });
  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  ok(snap.version === Game.SAVE_VERSION && snap.version === 2, `save version ${snap.version}`);
  ok(
    snap.nextWavePlan &&
      snap.nextWavePlan.wave === GS.wave + 1 &&
      snap.nextWavePlan.sectors.join() === 'right' &&
      snap.nextWavePlan.counts.right === total,
    'the save holds the next-wave entry-sector plan'
  );
  const wave = GS.wave;
  GS.nextWavePlan = null;
  ok(Game.importGameState(JSON.parse(JSON.stringify(snap))), 'the save loads');
  ok(
    GS.wave === wave &&
      GS.nextWavePlan &&
      GS.nextWavePlan.wave === wave + 1 &&
      GS.nextWavePlan.sectors.join() === 'right' &&
      GS.nextWavePlan.counts.right === total &&
      GS.nextWavePlan.types.right[0] === 'goblin',
    'loading restores the plan'
  );
  // A save from before the three sectors named flanks here; it is rolled again, not trusted.
  const legacy = JSON.parse(JSON.stringify(snap));
  legacy.nextWavePlan = { wave: wave + 1, sides: ['east'], multiFrontPlan: null };
  ok(Game.importGameState(legacy), 'a save with the old flank plan loads');
  ok(
    GS.nextWavePlan && GS.nextWavePlan.wave === wave + 1 && GS.nextWavePlan.sectors.length > 0,
    'and gets a fresh entry-sector plan'
  );
  ok(Game.importGameState(JSON.parse(JSON.stringify(snap))), 'the save loads again');
  Game.togglePause?.();
  if (GS.paused) GS.paused = false;
  Game.beginDayPhase(true);
  ok(
    GS.wave === wave + 1 &&
      GS.sectorPlan.sectors.join() === 'right' &&
      GS.spawnSectors.length === GS.spawnQueue.length &&
      GS.spawnSectors.every((x) => x === 'right'),
    `the next wave enters by the saved sector (${GS.sectorPlan.sectors.join(',')})`
  );

  // Unknown versions are refused before anything is touched.
  const tp = GS.tactical;
  const w2 = GS.wave;
  for (const v of [99, 3, 0, -1, 1.5, '2', null, undefined, NaN]) {
    const bad = { ...JSON.parse(JSON.stringify(snap)), version: v, wave: 77, tactical: 1 };
    if (v === undefined) delete bad.version;
    ok(
      Game.importGameState(bad) === false &&
        GS.wave === w2 &&
        GS.tactical === tp &&
        Game.isPlaying(),
      `version ${String(v)} is refused and the run is untouched`
    );
  }
  ok(!Game.isSupportedSaveVersion(99) && Game.isSupportedSaveVersion(1), 'version check exported');

  // A version 1 save (no plan field) still loads; at night it gets a fresh plan.
  const v1 = JSON.parse(JSON.stringify(snap));
  v1.version = 1;
  delete v1.nextWavePlan;
  delete v1.cheatsUsed;
  ok(Game.importGameState(v1), 'a version 1 save still loads');
  ok(
    GS.timeOfDay === 'night' && GS.nextWavePlan && GS.nextWavePlan.wave === GS.wave + 1,
    'an old night save rolls a plan for the coming wave'
  );
  // A plan for the wrong wave, or naming a sector that does not exist, is dropped, not trusted.
  const odd = JSON.parse(JSON.stringify(snap));
  odd.nextWavePlan = { wave: 40, sectors: ['up'], counts: { up: 9 } };
  ok(Game.importGameState(odd), 'a save with a damaged plan loads');
  ok(
    GS.nextWavePlan &&
      GS.nextWavePlan.wave === GS.wave + 1 &&
      !GS.nextWavePlan.sectors.includes('up'),
    'the damaged plan is replaced'
  );
}

// --- 3. cheats mark the run -----------------------------------------------------------------
{
  const { Game, GameState: GS, Cheats } = start(31);
  ok(Game.cheatsUsed() === false, 'a clean run is not marked');
  ok(toNight(Game, GS), 'reached the first night');
  ok(Game.exportGameState().cheatsUsed === false, 'a clean save is not marked');
  Cheats.submit('war chest');
  ok(Game.cheatsUsed() === true, 'an in-run cheat code marks the run');
  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  ok(snap.cheatsUsed === true, 'the mark is saved');
  GS.cheatsUsed = false;
  ok(Game.importGameState(snap) && Game.cheatsUsed() === true, 'the mark survives a load');
  Game.start();
  ok(Game.cheatsUsed() === false, 'the next run starts clean');
  Game.applyCheatEffect('tp', 5);
  ok(Game.cheatsUsed() === true, 'a direct cheat effect marks the run too');
  Game.quitToMenu?.();
  Cheats.submit('first circle'); // an unlock code typed on the menu
  Game.start();
  ok(Game.cheatsUsed() === true, 'a code entered on the menu marks the run it leads into');
  Game.start();
  ok(Game.cheatsUsed() === false, 'and only that run');
  ok(
    Cheats.submit('not a code') === false && Game.cheatsUsed() === false,
    'a wrong code marks nothing'
  );
}

// --- 4. a cheat voids the run: no score, no ribbon progress, no achievements ------------------
{
  const achCount = (A) => {
    const c = A.getCount();
    return typeof c === 'number' ? c : c.unlocked;
  };
  /** Play six waves (recruiting, killing), then end the run. */
  const playAndEnd = (cheat) => {
    const { Game, GameState: GS, Cheats, SiegeLoop, Achievements } = start(47, 'Achievements');
    const ach0 = achCount(Achievements);
    const best0 = JSON.stringify(SiegeLoop.getBestScores());
    const ribbons0 = JSON.stringify(SiegeLoop.getRibbons());
    if (cheat) Cheats.submit('war chest');
    const achAfterCheat = achCount(Achievements);
    for (let w = 0; w < 6; w++) {
      GS.tactical = Math.max(GS.tactical, 40);
      Game.selectDeploy(w % 2 ? 'archer' : 'footman');
      Game.handleClick(500 + w * 30, 560);
      Game.clearPlacementMode();
      toNight(Game, GS);
      Game.beginDayPhase(true);
    }
    const recorded = SiegeLoop.isRecorded();
    const wave = GS.wave;
    // Lose: with nobody on the field the host walks through until the breach limit falls.
    for (let i = 0; i < 80000 && Game.isPlaying(); i++) {
      for (const u of GS.units) if (u.team === 'player') u.hp = 0;
      if (GS.timeOfDay === 'night') Game.beginDayPhase(true);
      Game.update();
    }
    ok(GS.state === 'defeat', `the run ends in defeat (wave ${GS.wave})`);
    return {
      recorded,
      cheats: cheat,
      score: SiegeLoop.lastScore(),
      bestChanged: JSON.stringify(SiegeLoop.getBestScores()) !== best0,
      ribbonsChanged: JSON.stringify(SiegeLoop.getRibbons()) !== ribbons0,
      achGained: achCount(Achievements) - achAfterCheat,
      achFromCode: achAfterCheat - ach0,
      wave,
    };
  };
  const clean = playAndEnd(false);
  ok(
    clean.recorded && clean.score && clean.score.total > 0,
    `a clean run is scored (${clean.score?.total})`
  );
  ok(clean.bestChanged, 'a clean run sets a best score');
  ok(clean.achGained > 0, `a clean run earns achievements (${clean.achGained})`);
  const voided = playAndEnd(true);
  ok(voided.wave === clean.wave, `the cheated run played the same ${voided.wave} waves`);
  ok(!voided.recorded, 'a run with a cheat is not recorded');
  ok(voided.score === null, 'it has no score');
  ok(!voided.bestChanged, 'it sets no best score');
  ok(!voided.ribbonsChanged, 'it makes no ribbon progress and earns no ribbon');
  ok(voided.achGained === 0, `it earns no achievements after the cheat (${voided.achGained})`);
}

if (failures()) {
  console.error(`\n${failures()} p2-fix test(s) failed`);
  process.exit(1);
}
console.log('\nAll p2-fix tests passed.');
