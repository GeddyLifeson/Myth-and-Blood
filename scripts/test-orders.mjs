/**
 * Orders rework: the Courier rides three orders off the field and back, the spy network's
 * four actions, the General's order bar (Advance, Fall Back, stances, promotion after he
 * falls), Mark the Warlord, and a save made before the rework loading cleanly.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, ROOT, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, GameState, SpyActions, CourierMessages, EconomyRules,
      GeneralOrders, GameCombat, promoteFootmanToGeneral, spawnUnit: GameArmy.spawnUnit })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}

const run = (Game, n) => {
  for (let i = 0; i < n; i++) Game.update();
};
const mine = (GS) => GS.units.filter((u) => u.team === 'player' && u.hp > 0);
function toNight(Game, GS) {
  if (GS.timeOfDay === 'night') Game.beginDayPhase(true);
  for (let i = 0; i < 20000; i++) {
    if (GS.timeOfDay === 'night' && i > 5) return true;
    for (const u of GS.units) {
      if (u.team === 'player') u.hp = u.maxHp;
      else u.hp = 0;
    }
    GS.spawnQueue.length = 0;
    Game.update();
  }
  return false;
}
function addCourier(api) {
  const { Game, GameState: GS } = api;
  GS.tactical = Math.max(GS.tactical, 200);
  Game.selectDeploy('courier');
  Game.handleClick(620, 600);
  run(Game, 3);
  return mine(GS).find((u) => u.type === 'courier');
}
/** Ticks the game until the ride is over (or the budget runs out). */
function rideOut(api, max = 3600) {
  const { Game, GameState: GS } = api;
  let t = 0;
  while (GS.courierRide && t++ < max) {
    for (const u of GS.units) if (u.team === 'enemy') u.hp = 0;
    Game.update();
  }
  return t;
}

// --- 1. the spy network: four actions, each seen on the field ---------------------------------
{
  const { SpyActions } = start(21);
  ok(
    Object.keys(SpyActions).sort().join() === 'assassin,infiltrate,scout,settlement_raid,turncoats',
    `spy network has five actions: ${Object.keys(SpyActions).sort().join(', ')}`
  );
  ok(SpyActions.scout.nightOnly === true, 'Scout Report is a night action');
}

// --- 2. the Courier rides out and back; the order lands when he returns ------------------------
{
  const api = start(22);
  const { Game, GameState: GS, CourierMessages } = api;
  ok(toNight(Game, GS), 'first night');
  const courier = addCourier(api);
  ok(!!courier, 'a Courier is on the field');
  const startY = courier.y;
  const before = mine(GS).length;
  GS.tactical = 50;
  ok(Game.sendCourierMessage('reinforce') === true, 'Reinforcements are ordered');
  ok(GS.tactical < 50, 'and paid for');
  ok(!!GS.courierRide && GS.courierRide.msg === 'reinforce', 'the Courier is riding');
  ok(mine(GS).length === before, 'nobody has arrived yet');
  GS.courierMessagesUsedThisWave = 0;
  ok(Game.sendCourierMessage('arrows') === false, 'he cannot carry a second order while riding');
  run(Game, 120);
  ok(courier.y > startY + 20, `he rides for the bottom edge (y ${startY | 0} -> ${courier.y | 0})`);
  const t = rideOut(api);
  ok(!GS.courierRide, `the ride is over after ${t} ticks (about ${Math.round(t / 60)} s)`);
  ok(t >= 15 * 60 && t <= 32 * 60, 'about 20 seconds');
  const added = mine(GS).length - before;
  ok(added === 3, `two footmen and an archer marched in (${added})`);
  ok(Math.abs(courier.y - startY) < 30, 'the Courier is back at the muster line');
  run(Game, 3);
  ok(courier.courierReady === true && GS.courierCooldown === 0, 'and ready to ride again');
  void CourierMessages;

  // Fresh Arrows: ranged troops shoot faster, then go back to normal.
  ok(toNight(Game, GS), 'second night');
  const archer = mine(GS).find((u) => u.projectile);
  const base = archer.attackSpeedMult || 1;
  GS.tactical = 50;
  ok(Game.sendCourierMessage('arrows') === true, 'Fresh Arrows ordered');
  rideOut(api);
  ok(Math.abs(archer.attackSpeedMult - base * 1.35) < 1e-9, 'archers shoot 35% faster');
  run(Game, 20 * 60 + 5);
  ok(Math.abs(archer.attackSpeedMult - base) < 1e-9, 'and back to normal after 20 seconds');

  // If he falls on the road, the order is lost.
  ok(toNight(Game, GS), 'third night');
  GS.tactical = 50;
  const wounded = mine(GS).find((u) => u.canHunt);
  wounded.hp = 1;
  ok(Game.sendCourierMessage('surgeons') === true, 'Field Surgeons ordered');
  run(Game, 30);
  courier.hp = 0;
  run(Game, 5);
  ok(!GS.courierRide, 'the ride ends when the Courier dies');
  run(Game, 600);
  ok(!(wounded.surgeonUntil > 0), 'and no surgeons came');
}

// --- 3. Field Surgeons heal the wounded at the muster line -------------------------------------
{
  const api = start(23);
  const { Game, GameState: GS } = api;
  ok(toNight(Game, GS), 'first night');
  addCourier(api);
  const hurt = mine(GS).find((u) => u.canHunt);
  hurt.y = GS.rallyY;
  hurt.hp = Math.ceil(hurt.maxHp * 0.3);
  GS.tactical = 50;
  ok(Game.sendCourierMessage('surgeons') === true, 'Field Surgeons ordered');
  rideOut(api);
  ok(hurt.surgeonUntil > GS.updateTick, 'the wounded soldier is being tended');
  const hp0 = hurt.hp;
  run(Game, 15 * 60);
  ok(hurt.hp > hp0 + hurt.maxHp * 0.3, `he healed (${hp0 | 0} -> ${hurt.hp | 0})`);
}

// --- 4. the General's order bar ------------------------------------------------------------
{
  const api = start(24);
  const { Game, GameState: GS, GeneralOrders: GO, promoteFootmanToGeneral } = api;
  ok(toNight(Game, GS), 'first night');
  ok(Game.executeDoctrine('advance') === false, 'no General, no orders');
  const foot = mine(GS).filter((u) => u.type === 'footman');
  const gen = foot[0];
  promoteFootmanToGeneral(gen);
  gen.x = 400;
  gen.y = GS.rallyY;
  // Two soldiers stand ahead of the muster line, next to him.
  foot.slice(1, 3).forEach((u, i) => {
    u.x = gen.x - 30 + i * 60;
    u.y = GS.rallyY - 60;
  });
  run(Game, 2);
  const near = foot.slice(1).filter((u) => Math.hypot(u.x - gen.x, u.y - gen.y) < GO.orderRadius());
  ok(near.length > 0, `${near.length} soldiers stand in his reach`);
  const y0 = near.map((u) => u.y);
  ok(Game.executeDoctrine('advance') === true, 'Advance is given');
  ok(
    near.every((u, i) => Math.abs(u.postY - (y0[i] - GO.RANK)) < 2),
    'each soldier in reach is posted one rank forward'
  );
  ok(Game.executeDoctrine('advance') === false, 'Advance has a cooldown');
  run(Game, 240);
  ok(Game.executeDoctrine('fall_back') === true, 'Fall Back is given');
  ok(
    near.filter((u) => u.y < GS.rallyY - 10).every((u) => u.postY >= GS.rallyY - 15),
    'everyone in reach is sent back to the muster line'
  );

  const rear = GO.getState();
  ok(rear.stance === 'rear' && rear.cooldownMult === 0.6, 'from the rear, orders recharge faster');
  ok(Game.executeDoctrine('stance') === true, 'stance switched');
  const front = GO.getState();
  ok(
    front.stance === 'front' && front.radius > rear.radius && gen.leadsFromFront === true,
    `from the front his reach grows (${rear.radius} -> ${front.radius}) and the enemy goes for him`
  );

  // War Cry recharge follows the stance.
  Game.beginDayPhase(true);
  run(Game, 2);
  Game.executeDoctrine('stance');
  ok(Game.executeDoctrine('war_cry') === true, 'War Cry is given from the bar');
  const cry = Game.getState().siegeLoop?.warCryReady ?? null;
  ok(
    cry != null && cry - GS.updateTick <= 45 * 60 * 0.6 + 1 && cry - GS.updateTick > 20 * 60,
    'from the rear it recharges in 27 s'
  );

  // He falls: the bar is lost until a veteran is promoted.
  gen.hp = 0;
  run(Game, 3);
  ok(GO.getState().fallen === true, 'the General has fallen');
  ok(Game.executeDoctrine('advance') === false, 'his orders are gone');
  ok(/Promote a veteran/.test(GO.lostReason()), `the bar says why: ${GO.lostReason()}`);
  const vet = mine(GS).find((u) => u.type === 'footman');
  vet.vetTier = 0;
  vet.honorName = null;
  for (const u of mine(GS)) if (u.type === 'footman') u.vetTier = 0;
  for (const u of mine(GS)) if (u.type === 'footman') u.honorName = null;
  ok(Game.executeDoctrine('promote') === false, 'no veteran, no promotion');
  vet.vetTier = 1;
  ok(Game.executeDoctrine('promote') === true, 'a veteran footman is promoted');
  ok(vet.isGeneral && GO.getState().fallen === false, 'he is the General and the bar is back');
  run(Game, 800);
  ok(Game.executeDoctrine('advance') === true, 'orders work again');
}

// --- 5. Mark the Warlord ----------------------------------------------------------------------
{
  const api = start(25);
  const { Game, GameState: GS, GameCombat, spawnUnit } = api;
  ok(toNight(Game, GS), 'first night');
  GS.tactical = 50;
  ok(Game.executeSpyAction('assassin') === true, 'the warlord is marked for tomorrow');
  Game.beginDayPhase(true);
  for (let i = 0; i < 60; i++) Game.update();
  const big = spawnUnit('troll', 300, 100, 'enemy');
  const small = spawnUnit('goblin', 340, 100, 'enemy');
  GS.units.push(big, small);
  run(Game, 20);
  ok(
    big.warlordMarked === true && !small.warlordMarked,
    'the elite troll is outlined, not the goblin'
  );
  const twin = spawnUnit('troll', 300, 100, 'enemy');
  twin.x = big.x;
  twin.y = big.y;
  const hp1 = big.hp;
  const hp2 = twin.hp;
  GameCombat.takeDamage(big, 40);
  GameCombat.takeDamage(twin, 40);
  const ratio = (hp1 - big.hp) / Math.max(1, hp2 - twin.hp);
  ok(Math.abs(ratio - 1.25) < 0.08, `he takes 25% more damage (x${ratio.toFixed(2)})`);
}

// --- 5b. Turncoats -----------------------------------------------------------------------
{
  const api = start(27);
  const { Game, GameState: GS, GeneralOrders: GO, spawnUnit } = api;
  ok(toNight(Game, GS), 'first night');
  GS.tactical = 50;
  ok(Game.executeSpyAction('turncoats') === true, 'turncoats are bought in tomorrow’s host');
  const n = GO.getState().turncoatsLeft;
  ok(n >= 3 && n <= 5, `${n} of them`);
  Game.beginDayPhase(true);
  run(Game, 30);
  const far = spawnUnit('goblin', 300, 80, 'enemy');
  const elite = spawnUnit('troll', 340, GS.rallyY, 'enemy');
  const near = [0, 1, 2, 3, 4, 5].map((i) =>
    spawnUnit('goblin', 200 + i * 30, GS.rallyY - 20, 'enemy')
  );
  GS.units.push(far, elite, ...near);
  ok(GS.timeOfDay !== 'night', 'still day');
  const before = mine(GS).length;
  // Only the goblins placed at the line may turn: the rest of the host is kept back.
  for (const u of GS.units) if (u.team === 'enemy' && !near.includes(u) && u !== elite) u.y = 60;
  run(Game, 12);
  // Units are pooled once gone, so count by what is left on each side.
  const still = near.filter((u) => u.team === 'enemy' && u.hp > 0).length;
  const turned = mine(GS).filter((u) => u.turncoat).length;
  ok(turned === n && still === near.length - n, `${turned} goblins at the line changed sides`);
  ok(
    far.team === 'enemy' && far.hp > 0 && elite.hp > 0,
    'not the one still far off, nor the elite'
  );
  ok(mine(GS).length === before + n, 'each one stands with you as a footman');
  ok(GO.getState().turncoatsLeft === 0, 'and no more turn');
}

// --- 6. saves: the order state round-trips; a save from before the rework loads ---------------
{
  const api = start(26);
  const { Game, GameState: GS, GeneralOrders: GO, EconomyRules: R } = api;
  ok(toNight(Game, GS), 'first night');
  addCourier(api);
  GS.tactical = 50;
  Game.sendCourierMessage('reinforce');
  run(Game, 60);
  GO.setStance('front');
  const snap = Game.exportGameState();
  ok(snap.modules?.GeneralOrders?.data?.courierRide?.msg === 'reinforce', 'the ride is saved');
  ok(Game.importGameState(snap) === true, 'and loads');
  GS.paused = false;
  ok(
    GS.courierRide?.msg === 'reinforce' && GO.getState().stance === 'front',
    'ride and stance kept'
  );
  const before = mine(GS).length;
  rideOut(api);
  ok(mine(GS).length === before + 3, 'the loaded ride still brings the squad');

  const old = JSON.parse(
    readFileSync(join(ROOT, 'scripts', 'fixtures', 'saves', 'v4-cut-orders.json'), 'utf8')
  );
  const rw = old.snap.modules.EconomyRules.data.readyWave;
  ok(rw['courier:levy'] && rw['spy:disrupt'], 'the fixture used Tax Levy and Disrupt');
  ok(Game.importGameState(old.snap) === true, 'a save made before the rework loads');
  GS.paused = false;
  ok(
    R.cooldownLeft('courier:levy', GS.wave) === 0 && R.cooldownLeft('spy:disrupt', GS.wave) === 0,
    'the cut actions left no cooldowns behind'
  );
  ok(!R.exportState().readyWave['courier:levy'], 'and are not written into new saves');
  ok(!GS.courierRide, 'no ride was under way');
  run(Game, 200);
  ok(GS.courierCooldown === 0, 'the old courier cooldown ran out');
  ok(toNight(Game, GS), 'the loaded run plays on to the next night');
  GS.tactical = 50;
  ok(Game.executeSpyAction('assassin') === true, 'the spy network works after the load');
  ok(Game.sendCourierMessage('arrows') === true, 'and so does the Courier');
}

if (failures()) {
  console.error(`\n${failures()} orders test(s) failed`);
  process.exit(1);
}
console.log('\nAll orders tests passed.');
