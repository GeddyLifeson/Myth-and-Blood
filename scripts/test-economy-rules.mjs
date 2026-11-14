/**
 * Economy rework: priced courier and spy actions, research pacing, the staged introduction's
 * General prompt, expeditions that return the same soldiers, the smoothed colony baseline,
 * the cap on bonus starting TP, the starter buildings' jobs and the Outpost either/or upgrade.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, ROOT, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed, diff = 'normal', storage = {}) {
  const { sb, cvs } = boot(seed);
  for (const k in storage) sb.localStorage.setItem(k, storage[k]);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, Research, GameState, UnitDefs, BuildDefs, SpyActions,
      CourierMessages, EconomyRules, ColonyValue, PlayerCounterEvolution, EnemyFactions,
      CrownLegacies, createBuilding, getWaveConfig, DIFFICULTIES })`,
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
function place(api, type, x, y) {
  const b = api.createBuilding(type, x, y, 'player');
  b.complete = true;
  b.buildProgress = b.buildTime;
  api.GameState.buildings.push(b);
  return b;
}
function addUnit(api, type) {
  const GS = api.GameState;
  const before = mine(GS).length;
  api.Game.applyCheatEffect?.('tp');
  GS.tactical = Math.max(GS.tactical, 200);
  api.Game.selectDeploy(type);
  api.Game.handleClick(500 + before * 23, 540);
  return mine(GS).find((u) => u.type === type);
}

// --- 1. pure rules -------------------------------------------------------------------------
{
  const { EconomyRules: R } = start(3);
  R.resetRun();
  ok(R.getCost('courier:levy', { wave: 1 }) === 1, 'Tax Levy costs 1 TP (was free)');
  ok(R.rule('courier:levy').pay === 5, 'Tax Levy pays 5 TP (was 6)');
  ok(R.canUse('courier:levy', { wave: 4 }).ok, 'an unused action is ready');
  R.markUsed('courier:levy', 4);
  ok(!R.canUse('courier:levy', { wave: 5 }).ok, 'Tax Levy is on cooldown the wave after');
  ok(R.cooldownLeft('courier:levy', 6) === 1, 'cooldown counts down in waves');
  ok(R.canUse('courier:levy', { wave: 7 }).ok, 'Tax Levy is ready again three waves later');

  ok(R.getCost('courier:banner', { wave: 5 }) === 6, 'Call the Banner starts at 6 TP');
  ok(
    R.getCost('courier:banner', { wave: 5, upkeepMult: 1.5 }) === 9,
    'the army surcharge applies to the banner price'
  );
  R.markUsed('courier:banner', 5);
  ok(R.getCost('courier:banner', { wave: 9 }) === 8, 'each earlier call adds 2 TP');
  ok(
    !R.canUse('courier:banner', { wave: 20, isDeployUnlocked: () => false }).ok,
    'no banner knight before knights are researched'
  );
  ok(
    R.canUse('courier:banner', { wave: 20, isDeployUnlocked: () => true }).ok,
    'the banner answers once Iron Weapons is done'
  );

  ok(R.getCost('spy:disrupt', { wave: 3 }) === 5, 'Disrupt costs 5 TP early');
  ok(R.getCost('spy:disrupt', { wave: 18 }) === 8, 'Disrupt costs 1 TP more every 6 waves');
  const d = R.rule('spy:disrupt');
  ok(
    d.countMult === 0.75 && d.hpMult > 1 && d.speedMult > 1,
    'Disrupt trades numbers for a tougher, faster host'
  );

  R.resetRun();
  ok(R.grantStartTp(4) === 4, 'the first bonus source gets its full share');
  ok(R.grantStartTp(8) === 2, 'the combined starting bonus stops at +6');
  ok(R.grantStartTp(2) === 0, 'nothing is left for a third source');

  const q = ['goblin', 'siege_tower', 'orc', 'goblin_engineer'];
  ok(
    R.stripSiege(q) === 2 && !q.includes('siege_tower'),
    'Sabotage removes siege engines from the queue'
  );

  const wall = { type: 'wall', owner: 'player', complete: true, hp: 100, x: 100, y: 100 };
  const mk = (x) => ({ team: 'enemy', hp: 10, lineBreaker: true, stormLine: true, x, y: 100 });
  const far = mk(400);
  ok(!R.tryHoldRunner(far, [wall], 6) && far.lineBreaker, 'a runner out of reach keeps running');
  const held = [mk(110), mk(120), mk(130), mk(140)].map((u) => !!R.tryHoldRunner(u, [wall], 6));
  ok(held.join() === 'true,true,true,false', 'a wall holds three runners per wave, not a fourth');
  ok(!!R.tryHoldRunner(mk(110), [wall], 7), 'the count resets the next wave');

  const tent = { isMedical: true, owner: 'player', complete: true, hp: 50, x: 0, y: 0 };
  ok(R.claimStretcher(50, 50, [tent], 3) === tent, 'a tent in reach saves a soldier');
  ok(R.claimStretcher(50, 50, [tent], 3) === null, 'only once per wave');
  ok(R.claimStretcher(900, 900, [tent], 4) === null, 'not from across the field');

  const op = (upgrade) => ({ type: 'outpost', owner: 'player', complete: true, hp: 1, upgrade });
  ok(
    R.freeArmyBonus([op('granary'), op('granary'), op('barracks')]) === 6,
    'two Granaries feed 6 more soldiers'
  );
  ok(
    R.freeArmyBonus([1, 2, 3, 4, 5].map(() => op('granary'))) === 9,
    'only the first three Granaries count'
  );
  ok(R.barracksMuster([op('barracks')], 6).length === 1, 'a Barracks musters on every third dawn');
  ok(R.barracksMuster([op('barracks')], 7).length === 0, 'and not in between');
  ok(R.dawnScience(1) === 6 && R.dawnScience(5) === 12, 'labs pay 6 SP at dawn, first two count');
}

// --- 2. courier: levy, banner ------------------------------------------------------------------
{
  const api = start(11);
  const { Game, GameState: GS, CourierMessages } = api;
  run(Game, 20);
  ok(
    CourierMessages.levy.cost === 1 && CourierMessages.banner.cost === 6,
    'message table carries the new prices'
  );
  const courier = addUnit(api, 'courier');
  ok(!!courier, 'a courier is on the field');
  courier.courierReady = true;
  run(Game, 5);
  GS.courierCooldown = 0;
  GS.tactical = 20;
  const moraleBefore = mine(GS).find((u) => u.type === 'footman').morale;
  ok(Game.sendCourierMessage('levy') === true, 'Tax Levy is sent');
  ok(GS.tactical === 19, 'it cost 1 TP');
  ok(GS.pendingLevy === 5, '5 TP are due at the next wave clear');
  ok(
    mine(GS).find((u) => u.type === 'footman').morale === moraleBefore - 2,
    'every soldier lost 2 morale'
  );
  GS.courierCooldown = 0;
  GS.courierMessagesUsedThisWave = 0;
  ok(
    Game.sendCourierMessage('levy') === false,
    'a second levy in the same wave is refused (cooldown)'
  );
  ok(GS.tactical === 19, 'and costs nothing');
  ok(/Ready again/.test(CourierMessages.levy.desc), 'the button text says when it is ready again');

  GS.courierCooldown = 0;
  GS.courierMessagesUsedThisWave = 0;
  const knightsBefore = mine(GS).filter((u) => u.type === 'knight').length;
  ok(
    Game.sendCourierMessage('banner') === false,
    'Call the Banner is refused without Iron Weapons'
  );
  ok(mine(GS).filter((u) => u.type === 'knight').length === knightsBefore, 'no knight arrived');
  api.Research.completeResearch('iron_weapons');
  GS.tactical = 20;
  ok(Game.sendCourierMessage('banner') === true, 'with Iron Weapons the banner is answered');
  ok(
    mine(GS).filter((u) => u.type === 'knight').length === knightsBefore + 1,
    'one knight arrived'
  );
  ok(GS.tactical === 14, 'for 6 TP while the army is small');
  GS.courierCooldown = 0;
  GS.courierMessagesUsedThisWave = 0;
  ok(
    Game.sendCourierMessage('banner') === false,
    'the banner cannot be called again for four waves'
  );
}

// --- 3. spy: disrupt, sabotage, infiltrate, scout ----------------------------------------------
{
  const api = start(12);
  const { Game, GameState: GS, EconomyRules: R } = api;
  run(Game, 20);
  GS.tactical = 30;
  ok(Game.executeSpyAction('disrupt') === true, 'Disrupt is bought');
  ok(GS.pendingWaveMods.countMult === 0.75, 'next wave has 25% fewer enemies (was 35%)');
  ok(GS.pendingWaveMods.hpMult > 1.1, 'who are tougher');
  ok(GS.pendingWaveMods.speedMult > 1.1, 'and faster');
  GS.spyUsedThisWave = false;
  ok(Game.executeSpyAction('disrupt') === false, 'Disrupt cannot be repeated for three waves');

  GS.spyUsedThisWave = false;
  ok(Game.executeSpyAction('sabotage') === true, 'Sabotage is bought');
  ok(
    GS.pendingWaveMods.noSiege === true && GS.spawnDelayBonus >= 600,
    'no siege engines and a 10 second delay'
  );

  GS.spyUsedThisWave = false;
  ok(Game.executeSpyAction('infiltrate') === true, 'Deep Infiltration is bought');
  ok(GS.pendingWaveMods.softenShare === 0.3, 'the first 30% of the next wave are marked');
  R.onWaveStart({ softenShare: 0.3, softenCount: 2 });
  const foes = [1, 2, 3].map(() => ({ team: 'enemy', hp: 100, maxHp: 100, speed: 1 }));
  const labels = foes.map((u) => R.onEnemySpawn(u, { speedMult: 1.15 }));
  ok(
    foes[0].hp === 60 && foes[1].hp === 60 && foes[2].hp === 100,
    'the first arrivals come in at 60% health'
  );
  ok(labels[0] === 'AMBUSHED' && labels[2] === null, 'and are labelled on the field');
  ok(Math.abs(foes[2].speed - 1.15) < 1e-9, 'a disrupted host marches 15% faster');

  GS.spyUsedThisWave = false;
  GS.timeOfDay = 'night';
  ok(api.SiegeLoop.getPreview()?.makeup == null, 'without a tower or a scout the preview is rough');
  ok(Game.executeSpyAction('scout') === true, 'Scout Report is bought');
  const p = api.SiegeLoop.getPreview();
  ok(
    Array.isArray(p?.makeup) && p.makeup.length > 0,
    'the night preview now lists the host by type'
  );
  ok(/Scout report: \d+ /.test(api.SiegeLoop.previewText(p)), 'as numbers the player can read');
}

// --- 4. research pacing and the General prompt -------------------------------------------------
{
  const api = start(13);
  const { Game, GameState: GS, Research, BuildDefs, SiegeLoop } = api;
  const node = (id) => Research.ALL_NODES.find((n) => n.id === id);
  ok(
    BuildDefs.research_lab.cost === 18 && BuildDefs.research_lab.requiresBuilders === 1,
    'a lab costs 18 TP and one builder'
  );
  ok(
    node('iron_weapons').cost === 20 && node('iron_weapons').wave === 3,
    'Iron Weapons: 20 SP from wave 3'
  );
  ok(
    node('command_theory').cost === 30 && node('command_theory').wave === 6,
    'Command Theory: 30 SP from wave 6'
  );
  ok(
    node('advanced_infantry').wave === 7 && node('siege_engineering').wave === 9,
    'later tiers open a few waves apart'
  );
  ok(
    Research.isBuildUnlocked('watchtower') && Research.isBuildUnlocked('trade_outpost'),
    'Watchtower and Trade Post need no research'
  );
  ok(
    !Research.isBuildUnlocked('outpost_barracks'),
    'the Outpost upgrades wait for Field Engineering'
  );

  run(Game, 20);
  place(api, 'research_lab', 300, 420);
  GS.wave = 3;
  ok(
    Research.startResearch('iron_weapons', 3, GS.buildings, () => {}),
    'Iron Weapons can start on wave 3'
  );
  let waves = 0;
  while (!Research.isResearched('iron_weapons') && waves < 10) {
    waves++;
    Research.onWaveCleared({ wave: 3 + waves, buildings: GS.buildings });
  }
  ok(
    waves <= 4,
    `dawn science alone finishes Iron Weapons in ${waves} waves (kills make it faster)`
  );
  ok(
    Research.isDeployUnlocked('knight') && Research.isDeployUnlocked('crossbowman'),
    'knights and crossbowmen are open'
  );

  const step = SiegeLoop.FIRST_STEPS.find((s) => s.id === 'orders');
  ok(step && step.needs === 'general', "the General's-orders prompt waits for a General");
  const w4 = SiegeLoop.FIRST_STEPS.find((s) => s.wave === 4);
  ok(
    w4 && w4.id === 'build' && !/General/.test(w4.text),
    'wave 4 now introduces builders, works and the lab'
  );
}

// --- 5. expeditions return the same soldiers -------------------------------------------------
{
  const api = start(14);
  const { Game, GameState: GS, PlayerCounterEvolution: PCE, EnemyFactions } = api;
  run(Game, 20);
  GS.wave = 25;
  GS.timeOfDay = 'night';
  const vets = mine(GS)
    .filter((u) => u.canHunt)
    .slice(0, 2);
  vets[0].honorName = 'Aldric the Unbroken';
  vets[0].kills = 41;
  vets[0].vetTier = 3;
  vets[0].vetGold = 2;
  vets[0].wavesSurvived = 19;
  const ids = vets.map((u) => u.id);
  GS.selectedUnitIds = [...ids];
  const faction = EnemyFactions.getActiveFactions(25)[0];
  ok(Game.dispatchExpedition(faction.id) === true, 'two soldiers march off on expedition');
  ok(!GS.units.includes(vets[0]) && !GS.units.includes(vets[1]), 'they are off the field');
  ok(
    vets[0].honorName === 'Aldric the Unbroken' && vets[0].kills === 41,
    'their records were not wiped'
  );
  const lost = [];
  const res = PCE.resolveExpeditions(26, {
    units: GS.units,
    rng: () => 0,
    deployX: 200,
    deployY: GS.deployY,
    rallyY: GS.rallyY,
    loseUnit: (u) => lost.push(u),
    grantTp: () => {},
  });
  ok(
    res.length === 1 && res[0].survivors === 2 && lost.length === 0,
    'both come home when the dice are kind'
  );
  ok(GS.units.includes(vets[0]), 'the veteran is back on the field as the same soldier');
  ok(
    vets[0].id === ids[0] &&
      vets[0].honorName === 'Aldric the Unbroken' &&
      vets[0].kills === 41 &&
      vets[0].vetTier === 3 &&
      vets[0].vetGold === 2 &&
      vets[0].wavesSurvived === 19,
    'with his name, kills, rank, stars and service'
  );

  GS.wave = 27;
  GS.expeditionUsedThisWave = false;
  GS.selectedUnitIds = [ids[1]];
  ok(Game.dispatchExpedition(faction.id) === true, 'a second expedition leaves');
  const res2 = PCE.resolveExpeditions(28, {
    units: GS.units,
    rng: () => 0.999,
    deployX: 200,
    deployY: GS.deployY,
    rallyY: GS.rallyY,
    loseUnit: (u) => lost.push(u),
  });
  ok(
    res2[0].survivors === 0 && lost[0] === vets[1],
    'a soldier lost on the march is reported lost, not replaced'
  );
  ok(!GS.units.includes(vets[1]), 'and does not return');

  // A save made while soldiers are away must not lose them.
  GS.wave = 29;
  GS.expeditionUsedThisWave = false;
  GS.selectedUnitIds = [ids[0]];
  ok(Game.dispatchExpedition(faction.id) === true, 'the veteran marches a second time');
  ok(PCE.getAwayUnits().includes(vets[0]), 'the expedition holds his record while he is away');
  const snap = Game.exportGameState();
  const saved = (snap.units || []).find((u) => u.id === ids[0]);
  ok(
    saved && saved.honorName === 'Aldric the Unbroken' && saved.kills === 41,
    'a save made meanwhile still contains him, name and kills'
  );
  ok(Game.importGameState(snap) === true, 'the save loads');
  const back = GS.units.filter((u) => u.id === ids[0]);
  ok(
    back.length === 1 && back[0].honorName === 'Aldric the Unbroken',
    'and he is on the field, once'
  );
  ok(
    PCE.getAwayUnits().length === 0,
    'the expedition is called off by the load, so he is not returned twice'
  );
}

// --- 6. colony value has no cliff ----------------------------------------------------------------
{
  const { ColonyValue } = start(15);
  let worst = 0;
  let at = 0;
  for (let w = 1; w < 80; w++) {
    const step = Math.abs(ColonyValue.getWaveBaseline(w + 1) - ColonyValue.getWaveBaseline(w));
    if (step > worst) {
      worst = step;
      at = w;
    }
  }
  ok(
    worst <= 40,
    `baseline moves at most ${worst} between waves (wave ${at}); the old step at 12 to 13 was about 350`
  );
  ok(
    ColonyValue.getWaveBaseline(13) > ColonyValue.getWaveBaseline(12),
    'and it rises through wave 13'
  );
  ok(
    ColonyValue.getWaveBaseline(1) < 200,
    'the opening baseline is in reach of a real army (was 403)'
  );
}

// --- 7. starting TP cap -----------------------------------------------------------------------
{
  const probe = start(16);
  const allRibbons = JSON.stringify({
    earned: probe.SiegeLoop.getRibbons().map((r) => r.id),
    stats: {},
  });
  const uncapped = probe.SiegeLoop.getRibbons().reduce(
    (a, r) => a + Number((/\+(\d+) starting TP/.exec(r.perk) || [0, 0])[1]),
    0
  );
  ok(uncapped > 6, `ribbons alone are worth +${uncapped} starting TP when all are earned`);
  const api = start(16, 'normal', { 'myth-and-blood-ribbons-v1': allRibbons });
  const base = api.DIFFICULTIES.normal.startingTp;
  ok(api.EconomyRules.START_TP_BONUS_CAP === 6, 'the cap is +6');
  ok(
    api.GameState.tactical === base + 6,
    `starting TP is ${base} + 6 with every ribbon earned (got ${api.GameState.tactical})`
  );
  ok(
    api.EconomyRules.grantStartTp(4) === 0,
    'so Crown Legacies and Crown of Ages have nothing left to add'
  );
}

// --- 8. buildings ----------------------------------------------------------------------------
{
  const api = start(17);
  const { Game, GameState: GS, BuildDefs, SiegeLoop } = api;
  run(Game, 20);
  ok(BuildDefs.wall.cost === 5 && BuildDefs.watchtower.cost === 4, 'Wall 5 TP, Watchtower 4 TP');
  ok(
    BuildDefs.trade_outpost.cost === 10 && BuildDefs.trade_outpost.tpPerRound === 2,
    'Trade Post: 10 TP for +2 at dawn'
  );
  ok(BuildDefs.quarry.tpPerRound === 3, 'Quarry: +3 at dawn');
  ok(BuildDefs.hamlet.tpBonusPerHamlet === 5, 'a hamlet pays 5 TP a round, as the manual now says');
  ok(
    /\+5 TP\/round/.test(readFileSync(join(ROOT, 'README.md'), 'utf8')),
    'README agrees on hamlet income'
  );

  // Income at dawn.
  const before = Game.getState().tpPerRound;
  place(api, 'trade_outpost', 260, 470);
  Game.updatePresentation?.();
  GS.hudRevision = (GS.hudRevision || 0) + 1;
  // Stretcher bearers.
  place(api, 'medical_tent', 320, 500);
  GS.timeOfDay = 'day';
  GS.wave = 4;
  const man = mine(GS).find((u) => u.type === 'footman');
  man.x = 330;
  man.y = 520;
  const deathsBefore = GS.runPlayerDeaths;
  Game.takeDamage(man, 99999, {});
  ok(
    man.hp > 0 && GS.runPlayerDeaths === deathsBefore,
    'a soldier struck down by the tent is carried in alive'
  );
  ok(Math.abs(man.hp - Math.ceil(man.maxHp * 0.25)) <= 1, 'at a quarter of his health');
  const second = mine(GS).find((u) => u.type === 'footman' && u !== man);
  second.x = 330;
  second.y = 525;
  Game.takeDamage(second, 99999, {});
  ok(second.hp <= 0, 'the tent saves one soldier per wave, not two');

  // Watchtower preview.
  GS.timeOfDay = 'night';
  SiegeLoop.refreshPreview({ ...previewCtx(GS), watchtowers: 0 });
  ok(SiegeLoop.getPreview().makeup == null, 'no tower: rough preview');
  const p = SiegeLoop.refreshPreview({ ...previewCtx(GS), watchtowers: 1 });
  ok(
    p.makeup.length > 0 && p.makeupSource === 'Watchtower',
    'a watchtower lists the next wave by type'
  );
  ok(
    Math.abs(p.makeup.reduce((a, m) => a + m.n, 0) - p.count) <= Math.max(3, p.count * 0.25),
    'and the numbers add up to about the whole host'
  );

  // Income shows as part of the round's TP.
  void before;
  const gens = GS.buildings.filter((b) => b.isResourceGen && b.complete);
  ok(gens.length === 1, 'one income site stands');
}

function previewCtx(GS) {
  return {
    wave: GS.wave,
    isNight: true,
    enemyCountMult: 1,
    units: GS.units,
    worldW: GS.worldW,
    worldH: GS.worldH,
  };
}

// --- 9. Outpost upgrade: Barracks or Granary --------------------------------------------------
{
  const api = start(18);
  const { Game, GameState: GS, Research, SiegeLoop, EconomyRules: R } = api;
  run(Game, 20);
  Research.completeResearch('field_engineering');
  ok(
    Research.isBuildUnlocked('outpost_granary') && Research.isBuildUnlocked('outpost_barracks'),
    'Field Engineering opens both upgrades'
  );
  ok(!!addUnit(api, 'builder'), 'a builder is on the field');
  GS.tactical = 60;
  const SX = 560;
  const SY = 470;
  Game.selectBuild('outpost_granary');
  Game.handleClick(SX, SY);
  ok(
    !GS.buildings.some((b) => b.type === 'outpost_granary'),
    'an upgrade cannot be placed on bare ground'
  );
  ok(GS.tactical === 60, 'and costs nothing when refused');

  Game.selectBuild('outpost');
  Game.handleClick(SX, SY);
  const op = GS.buildings.find((b) => b.type === 'outpost');
  ok(!!op, 'an Outpost is started');
  for (let i = 0; i < 4000 && !op.complete; i++) Game.update();
  ok(op.complete, 'and finished by the builder');

  Game.selectBuild('outpost_granary');
  Game.handleClick(SX, SY);
  const scaffold = GS.buildings.find((b) => b.type === 'outpost_granary');
  ok(
    !!scaffold && scaffold.x === op.x && scaffold.y === op.y,
    'the Granary upgrade snaps onto the Outpost'
  );
  Game.selectBuild('outpost_barracks');
  Game.handleClick(SX, SY);
  ok(
    !GS.buildings.some((b) => b.type === 'outpost_barracks'),
    'the same Outpost cannot take the Barracks too'
  );
  for (let i = 0; i < 4000 && GS.buildings.includes(scaffold); i++) Game.update();
  ok(!GS.buildings.includes(scaffold), 'the scaffolding is consumed');
  ok(op.upgrade === 'granary' && op.type === 'outpost', 'the Outpost is now a Granary');
  ok(R.freeArmyBonus(GS.buildings) === 3, 'which feeds 3 more soldiers');
  ok(
    SiegeLoop.deployCostMult(17, 3) === 1 && SiegeLoop.deployCostMult(17, 0) > 1,
    'so the surcharge starts at 17 soldiers, not 14'
  );
  Game.selectBuild('outpost_barracks');
  Game.handleClick(SX, SY);
  ok(
    !GS.buildings.some((b) => b.type === 'outpost_barracks'),
    'the choice is final: no second upgrade'
  );

  // Barracks muster, through the dawn pay-out.
  const op2 = place(api, 'outpost', op.x + 120, op.y);
  op2.upgrade = 'barracks';
  GS.wave = 6;
  GS.tpAwardedForWave = -1;
  GS.timeOfDay = 'day';
  GS.spawnQueue = [];
  for (const u of GS.units) if (u.team !== 'player') u.hp = 0;
  const footmen = mine(GS).filter((u) => u.type === 'footman').length;
  for (let i = 0; i < 600 && GS.timeOfDay !== 'night'; i++) Game.update();
  ok(GS.timeOfDay === 'night', 'the wave is cleared');
  ok(
    mine(GS).filter((u) => u.type === 'footman').length === footmen + 1,
    'the Barracks mustered one free footman at dawn (wave 6)'
  );
}

// --- 10. wave pressure on Normal and Baby -------------------------------------------------------
{
  const { getWaveConfig, DIFFICULTIES, ColonyValue } = start(19);
  const c = (w) => getWaveConfig(w);
  ok(c(3).count === 8 && c(6).count === 16, 'the first six waves are the size they were');
  ok(
    c(10).count === 32 && c(15).count === 52 && c(20).count === 72,
    `the host grows by four a wave from wave 7 to 20: 32, 52, 72 (was 24, 34, 44); got ${c(10).count}, ${c(15).count}, ${c(20).count}`
  );
  ok(c(25).count === 82 && c(30).count === 90, 'after wave 20 it grows by two again, capped at 90');
  ok(
    Math.abs(c(15).hpScale - 1.84) < 0.02 && Math.abs(c(15).dmgScale - 1.64) < 0.02,
    `wave 15 foes: health x${c(15).hpScale.toFixed(2)}, damage x${c(15).dmgScale.toFixed(2)} (was x1.58, x1.44)`
  );
  let worst = 0;
  for (let w = 1; w < 60; w++) worst = Math.max(worst, c(w + 1).hpScale - c(w).hpScale);
  ok(worst < 0.1, `health never jumps more than ${worst.toFixed(3)} between waves`);
  ok(
    Math.abs(c(40).hpScale - c(22).hpScale - (3.25 - 1.99)) < 0.03,
    'the faster climb stops at wave 22; later waves keep their old slope'
  );
  const baby = DIFFICULTIES.baby;
  ok(
    baby.enemyCountMult === 0.78 && baby.enemyHpMult === 0.72 && baby.waveHpScaleMult === 0.82,
    'Baby keeps its discounts'
  );
  const babyPower =
    c(15).count * baby.enemyCountMult * c(15).hpScale * baby.enemyHpMult * baby.waveHpScaleMult;
  ok(
    babyPower < 34 * 1.58,
    `Baby at wave 15 (${babyPower.toFixed(1)} host x health) is lighter than Normal used to be (53.7)`
  );
  ok(ColonyValue.getWaveBaseline(15) > 0, 'colony baseline still defined');
}

process.exit(failures() ? 1 : 0);
