/**
 * The dawn ledger: every income and standing cost settles in one line at wave clear, a big
 * army pays wages instead of dearer recruits, a clean wave pays a bounty, the early horn is
 * a bet that brings part of the next host forward, and the spoils carry trade-offs.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameState, EconomyRules, SaveFormat })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}

/** Clear the current wave by hand (nobody lost, nothing through) and stop at nightfall. */
function toNight(Game, GS) {
  for (let i = 0; i < 20000 && GS.timeOfDay !== 'night'; i++) {
    for (const u of GS.units) {
      if (u.team === 'player') u.hp = u.maxHp;
      else u.hp = 0;
    }
    GS.spawnQueue.length = 0;
    Game.update();
  }
  Game.updatePresentation?.();
  return GS.timeOfDay === 'night';
}

const army = (GS) =>
  GS.units.filter(
    (u) => u.team === 'player' && u.hp > 0 && u.type !== 'builder' && u.type !== 'courier'
  ).length;

// --- the rules on their own ----------------------------------------------------------------
{
  const { EconomyRules: R, SiegeLoop } = start(31);
  const l = R.buildLedger([
    { label: 'crown', tp: 7 },
    { label: 'works', tp: 2 },
    { label: 'levy', tp: 0 },
    { label: 'wages', tp: -4 },
  ]);
  ok(l.text === '+7 crown, +2 works, -4 wages = 5', `one readable line: ${l.text}`);
  ok(l.total === 5 && l.lines.length === 3, 'zero entries are left out of the line');
  ok(
    [14, 15, 16, 17, 24].map((n) => R.dawnWages(n)).join() === '0,1,1,2,5',
    'every 2 soldiers past 14 cost 1 TP at dawn'
  );
  ok(R.cleanBounty(3) === 2 && R.cleanBounty(25) === 4, 'the clean bounty is small and grows');
  const E = SiegeLoop.EDICTS;
  ok(E.war_levy.fx.breachLimit < 0, 'War Levy costs a breach');
  ok(E.sharpened_steel.fx.dawnCost > 0, 'Sharpened Steel costs TP at every dawn');
  ok(E.veterans_due.fx.dawnCost >= 2, "Veterans' Due is paid for");
  ok(E.early_horn.maxStacks === 1, 'Early Horn is held once at most');
  ok(E.war_chest.instantTp(20) > E.war_chest.instantTp(5), 'War Chest grows with the wave');
}

// --- a run: bounty, wages, the bet, unpaid wages, an old save ------------------------------
{
  const { Game, GameState: GS, SiegeLoop, SaveFormat } = start(32);
  ok(toNight(Game, GS), 'reached the first night');
  let ledger = Game.getState().siegeLoop.ledger;
  ok(/\+\d+ crown/.test(ledger) && /clean bounty/.test(ledger), `first dawn: ${ledger}`);

  // A big army: recruits stay at list price, the wages come at dawn.
  GS.tactical = 5000;
  for (let i = 0; i < 44; i++) {
    Game.selectDeploy('footman');
    Game.handleClick(420 + ((i * 37) % 360), 520 + ((i * 53) % 90));
  }
  Game.update();
  const wages = SiegeLoop.dawnWages({ upkeepArmy: army(GS) });
  ok(wages >= 12, `${army(GS)} soldiers owe ${wages} TP a dawn`);
  ok(Game.getDeployCost('footman') === 3, 'and a footman still costs 3');

  // The early horn: TP now, and part of the next host marches with this wave.
  const before = GS.tactical;
  Game.beginDayPhase(true);
  ok(GS.tactical > before, `the horn pays (${before} -> ${GS.tactical})`);
  ok(GS.pendingWaveMods.stealReduction > 0, 'the vanguard is taken off the next wave');
  ok(GS.waveEnemyTotal === GS.spawnQueue.length, 'and added to this one');

  // Unpaid wages: an empty purse, more wages than income.
  GS.tactical = 0;
  for (const u of GS.units) if (u.team === 'player') u.morale = u.maxMorale;
  ok(toNight(Game, GS), 'reached the second night');
  ledger = Game.getState().siegeLoop.ledger;
  ok(new RegExp(`-${wages} wages`).test(ledger), `wages in the ledger: ${ledger}`);
  ok(/= -\d+$/.test(ledger) && GS.tactical === 0, 'the purse cannot go below 0');
  const shaken = GS.units.filter((u) => u.team === 'player' && u.morale <= u.maxMorale - 8);
  ok(shaken.length > 0, 'unpaid troops lose morale');

  // A save from before the ledger: no waveBreaches, two Early Horns, the old War Chest.
  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  const sl = snap.modules && snap.modules.SiegeLoop;
  ok(!!sl, 'the save has a siege section');
  delete sl.data.waveBreaches;
  sl.data.edicts = ['war_chest', 'early_horn', 'early_horn', 'veterans_due'];
  ok(Game.importGameState(SaveFormat.seal(snap)), 'an old save loads');
  Game.updatePresentation?.();
  ok(Game.getState().siegeLoop.edicts.length === 4, 'with its spoils kept');
}

process.exit(failures() ? 1 : 0);
