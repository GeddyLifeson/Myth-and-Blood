/**
 * The wave 100 victory choice: Continue marks an endless run, New Game+ queues a harder
 * run carrying the best veterans; NG+ tier reaches enemy stats, the HUD label, the score
 * and saves; waves past 200 keep escalating.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const KEY = 'myth-and-blood-ngplus-v1';

function start(storage = {}) {
  const { sb, cvs } = boot(7);
  for (const k in storage) sb.localStorage.setItem(k, storage[k]);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, GameState, GameDayNight, NewGamePlus, SiegeLoop, SaveFormat, getWaveConfig, getEnemyWaveScale })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  api.sb = sb;
  return api;
}

// Pure rules.
{
  const { NewGamePlus: N } = start();
  ok(N.enemyMods(0).enemyHpMult === 1, 'tier 0 leaves enemies alone');
  ok(N.enemyMods(2).enemyHpMult > N.enemyMods(1).enemyHpMult, 'each tier adds enemy health');
  ok(N.enemyMods(99).enemyHpMult === N.enemyMods(N.MAX_TIER).enemyHpMult, 'tier is capped');
  ok(N.scoreModifier(0) === null && N.scoreModifier(2).pct === 30, 'NG+ pays a score bonus');
  const units = [
    { team: 'player', hp: 5, type: 'footman', vetTier: 1, kills: 3 },
    { team: 'player', hp: 5, type: 'archer', vetTier: 3, kills: 1 },
    { team: 'player', hp: 0, type: 'knight', vetTier: 5, kills: 9 },
    { team: 'player', hp: 5, type: 'pikeman', vetTier: 0, kills: 40 },
    { team: 'enemy', hp: 5, type: 'troll', vetTier: 4 },
    { team: 'player', hp: 5, type: 'footman', vetTier: 1, kills: 8 },
    { team: 'player', hp: 5, type: 'footman', vetTier: 1, kills: 1 },
  ];
  const picked = N.pickVeterans(units);
  ok(picked.length === N.CARRY_VETERANS, `carries at most ${N.CARRY_VETERANS} veterans`);
  ok(
    picked[0].type === 'archer' && picked[1].kills === 8 && picked[2].kills === 3,
    'rank first, kills break ties; the dead, raw recruits and enemies stay behind'
  );
}

// Continue: the run keeps going and is marked endless.
{
  const api = start();
  const GS = api.GameState;
  GS.wave = 100;
  await api.GameDayNight.offerPostVictoryChoice();
  ok(
    GS.state === 'playing' && GS.postVictoryEndless,
    'Continue keeps the run and marks it endless'
  );
  ok(/Endless/.test(api.Game.getState().difficultyLabel), 'HUD label says Endless');
  ok(api.NewGamePlus.getPending() === null, 'Continue queues no New Game+');
  const snap = api.Game.exportGameState();
  const raw = typeof snap === 'string' ? JSON.parse(snap) : snap;
  delete raw.postVictoryEndless;
  delete raw.ngPlusTier;
  raw.campaignVictoryDeclared = true;
  raw.wave = 140;
  raw.checksum = api.SaveFormat.checksum(raw);
  GS.postVictoryEndless = false;
  ok(
    api.Game.importGameState(typeof snap === 'string' ? JSON.stringify(raw) : raw),
    'old save loads'
  );
  ok(
    GS.postVictoryEndless === true && GS.ngPlusTier === 0,
    'old save past 100 reads as endless, tier 0'
  );
}

// New Game+: ends the run as a victory, the next run starts harder with the veterans.
{
  const api = start();
  const GS = api.GameState;
  const vet = GS.units.find((u) => u.team === 'player');
  vet.vetTier = 2;
  vet.kills = 12;
  vet.honorName = 'Old Harl';
  const baseHp = api.Game.getDifficulty().enemyHpMult;
  GS.wave = 100;
  // No document in the harness, so drive the NG+ branch through the module directly.
  api.NewGamePlus.offerVictoryChoice = (o) => (o.onNewGamePlus(), Promise.resolve('ngplus'));
  await api.GameDayNight.offerPostVictoryChoice();
  ok(GS.state === 'victory', 'New Game+ ends this run as a victory');
  const pending = api.NewGamePlus.getPending();
  ok(
    pending?.tier === 1 && pending.veterans[0]?.name === 'Old Harl',
    'NG+ 1 queued with the veteran'
  );
  ok(JSON.parse(api.sb.localStorage.getItem(KEY)).pending.tier === 1, 'queue survives a reload');

  api.Game.start();
  ok(GS.ngPlusTier === 1, 'next run plays at NG+ 1');
  ok(api.NewGamePlus.getPending() === null, 'the queued run is used up');
  const back = GS.units.find((u) => u.ngPlusVeteran);
  ok(back && back.honorName === 'Old Harl' && back.vetTier === 2, 'the veteran marches again');
  ok(api.Game.getDifficulty().enemyHpMult > baseHp, 'enemies are tougher at NG+ 1');
  ok(/NG\+1/.test(api.Game.getState().difficultyLabel), 'HUD label shows NG+1');
  const saved = api.Game.exportGameState();
  GS.ngPlusTier = 0;
  api.Game.importGameState(saved);
  ok(GS.ngPlusTier === 1, 'NG+ tier survives save and load');
}

// Waves past 200 keep escalating.
{
  const api = start();
  const s200 = api.getEnemyWaveScale(200);
  const s300 = api.getEnemyWaveScale(300);
  ok(s300.hp > s200.hp && s300.dmg > s200.dmg, 'enemy stats grow past wave 200');
  ok(api.getWaveConfig(300).count > api.getWaveConfig(200).count, 'host grows past wave 200');
  ok(
    api.getWaveConfig(5000).count - api.getWaveConfig(200).count <= 41,
    'endless headcount growth is capped'
  );
  const s150 = api.getEnemyWaveScale(150);
  ok(s150.hp < s200.hp, 'waves 100 to 200 are unchanged in shape');
}

if (failures()) {
  console.error(`\n${failures()} check(s) failed`);
  process.exit(1);
}
console.log('\nnew game plus: all checks passed');
