/**
 * Starter works: either/or upgrades for Wall, Med Tent, Mess Hall, Watchtower and Spike Trap,
 * income sites that pay only when no enemy reached them, demolish refund by health, the
 * income-site cap before TP is spent, and the six tonic stations with their costs.
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
    `${code}\n({ Game, SpriteGen, Research, GameState, BuildDefs, EconomyRules, GameBuildings,
      GameCore, ContentExpansion, Perks, createBuilding, createUnit })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  for (let i = 0; i < 20; i++) api.Game.update();
  return api;
}

function place(api, type, x, y) {
  const b = api.createBuilding(type, x, y, 'player');
  b.complete = true;
  b.buildProgress = b.buildTime;
  api.GameState.buildings.push(b);
  return b;
}

/** Build the upgrade's scaffolding on the host and let it finish. */
function upgrade(api, host, type) {
  const s = api.createBuilding(type, host.x, host.y, 'player');
  s.complete = true;
  api.GameState.buildings.push(s);
  api.GameBuildings.onBuildingComplete(s, { silent: true });
  return !api.GameState.buildings.includes(s);
}

// --- 1. every starter building takes one of two upgrades, once ------------------------------
{
  const api = start(41);
  const { GameState: GS, BuildDefs, GameBuildings, EconomyRules: R, Research } = api;
  const hosts = ['outpost', 'wall', 'medical_tent', 'mess_hall', 'watchtower', 'spike_trap'];
  for (const host of hosts) {
    const ups = Object.keys(BuildDefs).filter((k) => BuildDefs[k].upgradeOf === host);
    ok(ups.length === 2, `${host} has exactly two upgrades`);
    for (const k of ups) {
      ok(!!BuildDefs[k].upgradeId && !!BuildDefs[k].upgradeNote, `${k} names what it does`);
    }
  }
  ok(Research.isBuildUnlocked('wall_rampart'), 'a Wall upgrade opens with the Wall');
  ok(!Research.isBuildUnlocked('spike_trap_barbed'), 'a Spike Trap upgrade waits for the trap');
  Research.completeResearch('field_engineering');
  ok(Research.isBuildUnlocked('spike_trap_barbed'), 'and opens with it');

  const wall = place(api, 'wall', 300, 400);
  const hp0 = wall.maxHp;
  ok(GameBuildings.upgradeHosts(BuildDefs.wall_snare).length === 1, 'a bare Wall can be upgraded');
  ok(upgrade(api, wall, 'wall_rampart'), 'the Rampart scaffolding is consumed');
  ok(wall.upgrade === 'rampart' && wall.wallProtection === 0.65, 'the Wall is now a Rampart');
  ok(wall.maxHp === hp0 + 150, 'with 150 more HP');
  ok(GameBuildings.upgradeHosts(BuildDefs.wall_snare).length === 0, 'and takes no second upgrade');

  const snare = place(api, 'wall', 600, 400);
  upgrade(api, snare, 'wall_snare');
  let held = 0;
  for (let i = 0; i < 8; i++) {
    const runner = { x: snare.x + 10, y: snare.y, hp: 50, lineBreaker: true };
    if (R.tryHoldRunner(runner, [snare], 7)) held++;
  }
  ok(held === 6, `a Snare Line holds 6 runners a wave (held ${held})`);

  const tent = place(api, 'medical_tent', 300, 600);
  upgrade(api, tent, 'medical_tent_triage');
  const saves = [1, 2, 3].filter(() => R.claimStretcher(tent.x, tent.y, [tent], 7)).length;
  ok(saves === 2, `Triage carries in 2 a wave (saved ${saves})`);
  const tent2 = place(api, 'medical_tent', 900, 600);
  upgrade(api, tent2, 'medical_tent_surgery');
  ok(tent2.healRate > BuildDefs.medical_tent.healRate * 2, 'Surgery heals faster');

  const hall = place(api, 'mess_hall', 500, 700);
  upgrade(api, hall, 'mess_hall_kitchens');
  ok(R.freeArmyBonus(GS.buildings) === 4, 'Kitchens feed 4 more before the surcharge');
  const hall2 = place(api, 'mess_hall', 700, 700);
  upgrade(api, hall2, 'mess_hall_tavern');
  ok(hall2.moraleAura === 2 * BuildDefs.mess_hall.moraleAura, 'a Tavern doubles the aura');

  const tower = place(api, 'watchtower', 300, 200);
  upgrade(api, tower, 'watchtower_spotter');
  const foe = { team: 'enemy', x: tower.x + 50, y: tower.y };
  ok(
    api.ContentExpansion.getWatchtowerIntelPenalty(foe) === 16,
    "a Spotter's Perch takes 16 accuracy"
  );

  const trap = place(api, 'spike_trap', 800, 200);
  upgrade(api, trap, 'spike_trap_hair');
  ok(trap.trapReset === 35 && trap.trapDamage === BuildDefs.spike_trap.trapDamage, 'Hair Trigger');

  const lone = api.createBuilding('wall_snare', 1000, 900, 'player');
  GS.buildings.push(lone);
  const tp = GS.tactical;
  api.GameBuildings.onBuildingComplete(lone, { silent: true });
  ok(GS.tactical === tp + BuildDefs.wall_snare.cost, 'a lost host refunds the upgrade');
}

// --- 2. income sites pay only when no enemy came within reach -------------------------------
{
  const api = start(42);
  const { GameState: GS, GameBuildings } = api;
  GS.wave = 5;
  GS.timeOfDay = 'day';
  const base = GameBuildings.getTpPerRound();
  const q = place(api, 'quarry', 400, 500);
  ok(GameBuildings.getTpPerRound() === base + 3, 'an untouched Quarry pays 3');
  const foe = api.createUnit('goblin', q.x + 200, q.y, 'enemy');
  GS.units.push(foe);
  GS.updateTick = 10;
  GameBuildings.updateIncomeSiteThreat();
  ok(GameBuildings.getPayingIncomeSites().length === 1, 'an enemy out of reach changes nothing');
  foe.x = q.x + 60;
  GameBuildings.updateIncomeSiteThreat();
  ok(GameBuildings.getPayingIncomeSites().length === 0, 'an enemy within reach raids it');
  ok(GameBuildings.getTpPerRound() === base, 'so it pays nothing this wave');
  GS.wave = 6;
  ok(GameBuildings.getPayingIncomeSites().length === 1, 'and pays again the next clean wave');
}

// --- 3. income-site cap is checked before the TP is spent ---------------------------------
{
  const api = start(43);
  const { GameState: GS, GameBuildings, Research } = api;
  Research.completeResearch('prospecting');
  for (let i = 0; i < 6; i++) place(api, 'quarry', 150 + i * 120, 300);
  GS.units.push(api.createUnit('builder', 500, 600, 'player'));
  GS.tactical = 100;
  const n = GS.buildings.length;
  ok(!GameBuildings.finalizeBuild('trade_outpost', 500, 650), 'a seventh site is refused');
  ok(GS.tactical === 100 && GS.buildings.length === n, 'and costs nothing');
}

// --- 4. demolish refund follows health -------------------------------------------------------
{
  const api = start(44);
  const b = place(api, 'mess_hall', 400, 400);
  const full = api.GameCore.getBuildingRefund(b);
  b.hp = b.maxHp / 2;
  const half = api.GameCore.getBuildingRefund(b);
  b.hp = 0;
  ok(full === 2 && half === 1, `refund falls with health (${full} then ${half})`);
  ok(api.GameCore.getBuildingRefund(b) === 0, 'a wrecked building returns nothing');
}

// --- 5. tonic stations: six left, each with a cost; research alone lets heroes drink -------
{
  const api = start(45);
  const { GameState: GS, Perks, Research, GameBuildings } = api;
  ok(Perks.PerkBuildTypes.length === 6, 'six tonic stations are brewed');
  ok(Perks.isRetiredStation('perk_stamin_up'), 'the rest are retired');
  GS.tactical = 100;
  ok(!GameBuildings.finalizeBuild('perk_stamin_up', 500, 500), 'a retired station is refused');
  GS.units.push(api.createUnit('builder', 400, 600, 'player'));
  GS.units.push(api.createUnit('builder', 420, 600, 'player'));
  const n = GS.buildings.length;
  ok(!GameBuildings.finalizeBuild('hamlet', 400, 650), 'a Hamlet is no longer built by hand');
  ok(GS.buildings.length === n && GS.tactical === 100, 'and costs nothing');
  ok(/plots/.test(GameBuildings.retiredBuildReason('metropolis')), 'the reason names the plots');
  for (const t of Perks.PerkBuildTypes) {
    const id = t.replace('perk_', '');
    ok(/but /.test(Perks.PerkDefs[id].desc), `${id} says what it costs`);
  }
  Research.completeResearch('perk_science');
  const st = place(api, 'perk_jugger_nog', 500, 500);
  const gen = api.createUnit('general', st.x, st.y - 8, 'player');
  GS.units.push(gen);
  const hp = gen.maxHp;
  const speed = gen.speed;
  GS.timeOfDay = 'night';
  for (let i = 0; i < 60 && !(gen.perks || []).length; i++) api.Game.update();
  ok((gen.perks || []).includes('jugger_nog'), 'a General drinks with research alone');
  ok(gen.maxHp > hp && gen.speed < speed, 'Ironbrew: more health, slower feet');
}

if (failures()) process.exit(1);
console.log('building works OK');
