/**
 * War camps: spawn rules, the bonus applied and removed, the bounty, save and load, soldiers
 * that do not walk off to a camp on their own, the spy raid, and the trimmed Disrupt.
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
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameState, UnitDefs, BuildDefs, EnemyDefs, SpyActions,
      EconomyRules, WarCamps })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  api.sb = sb;
  return api;
}
const run = (Game, n) => {
  for (let i = 0; i < n; i++) Game.update();
};
const mine = (GS) => GS.units.filter((u) => u.team === 'player' && u.hp > 0);
const camps = (GS, W) => GS.buildings.filter((b) => W.isCamp(b) && b.hp > 0);
function deploy(api, type, x, y) {
  const GS = api.GameState;
  GS.tactical = Math.max(GS.tactical, 300);
  const before = new Set(mine(GS).map((u) => u.id));
  api.Game.selectDeploy(type);
  api.Game.handleClick(x, y);
  return mine(GS).find((u) => !before.has(u.id));
}
/** Kill what is on the field and let the game roll into night. */
function toNight(api, wave) {
  const { Game, GameState: GS } = api;
  if (wave != null) GS.wave = wave;
  for (let guard = 0; guard < 4000 && GS.timeOfDay !== 'night'; guard++) {
    GS.spawnQueue.length = 0;
    for (const u of GS.units) if (u.team === 'enemy') u.hp = 0;
    Game.update();
  }
  return GS.timeOfDay === 'night';
}

// --- 1. spawn rules ---------------------------------------------------------------------
{
  const api = start(7);
  const { Game, GameState: GS, WarCamps: W, SiegeLoop } = api;
  run(Game, 10);
  ok(toNight(api, 2), 'the game reaches a night');
  let raised = 0;
  for (let i = 0; i < 12; i++) {
    GS.timeOfDay = 'day';
    toNight(api, 3);
    raised += camps(GS, W).length;
  }
  ok(raised === 0, 'no camp is raised before the night of wave 5 (it would strengthen wave 6)');

  let nights = 0;
  let seen = 0;
  let most = 0;
  const kinds = new Set();
  const sectors = new Set();
  let badSpot = 0;
  for (let i = 0; i < 60; i++) {
    GS.timeOfDay = 'day';
    toNight(api, 8);
    nights++;
    const list = camps(GS, W);
    most = Math.max(most, list.length);
    for (const c of W.getSnapshot({ buildings: GS.buildings, wave: GS.wave }).camps) {
      kinds.add(c.kind);
      sectors.add(c.sector);
    }
    for (const b of list) {
      seen++;
      if (b.y > 90 || b.y >= GS.deployY - 200 || b.x < 20 || b.x > GS.worldW - 20) badSpot++;
      if (b.owner !== 'enemy' || b.blocksMove) badSpot++;
    }
    // Clear the field every third night so new camps keep rising.
    if (i % 3 === 2) for (const b of list) Game.warCampHooks.hit(b, 1e6);
    GS.buildings = GS.buildings.filter((b) => b.hp > 0);
  }
  ok(seen > 0 && most >= 1, `camps are raised from wave 6 (${seen} camp-nights in ${nights} nights)`);
  ok(most <= W.MAX_CAMPS, `never more than ${W.MAX_CAMPS} camps at once (most seen: ${most})`);
  ok(badSpot === 0, 'every camp sits just inside the top edge, far from the deploy zone, and blocks nothing');
  ok(kinds.size >= 3, `several kinds of camp appear (${[...kinds].join(', ')})`);
  ok(sectors.size >= 2, `camps use more than one top sector (${[...sectors].join(', ')})`);

  // The plan's sectors are honoured when the plan names them.
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  GS.nextWavePlan = { wave: GS.wave + 1, sides: ['north'], sectors: ['right'] };
  let right = 0;
  for (let i = 0; i < 6; i++) {
    GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
    const c = Game.warCampHooks.raise({});
    if (c && c.sector === 'right' && c.x > (GS.worldW * 2) / 3 - 1) right++;
  }
  ok(right === 6, "a camp rises in one of the next wave's sectors when the plan names them");
  Game.warCampHooks.ctx().refreshPreview();
  const line = SiegeLoop.previewText(SiegeLoop.getPreview());
  ok(/War camps — .+\(right\): /.test(line), `the night preview names the camp and its bonus (${line})`);
}

// --- 2. bonus applied, and removed when the camp burns ----------------------------------
{
  const api = start(11);
  const { Game, GameState: GS, WarCamps: W } = api;
  run(Game, 10);
  toNight(api, 8);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const forge = Game.warCampHooks.raise({ kind: 'forge', sector: 'left' });
  const siege = Game.warCampHooks.raise({ kind: 'siege', sector: 'right' });
  ok(forge && siege && camps(GS, W).length === 2, 'two camps stand');
  ok(Game.warCampHooks.raise({ kind: 'shrine' }) === null, 'a third is refused');
  ok(W.pendingBonuses({ buildings: GS.buildings }).length === 2, 'both bonuses are pending');
  Game.beginDayPhase(true);
  ok(W.activeBonuses().length === 2, 'at dawn both bonuses are locked in');
  ok(GS.spawnQueue.slice(0, 4).includes('siege_tower'), 'Siege yard: a siege engine joins the queue');
  const foe = { team: 'enemy', hp: 100, maxHp: 100, speed: 1, type: 'orc' };
  W.onEnemySpawn(foe);
  ok(foe.maxHp === 115 && foe.hp === 115, 'Forge: an enemy enters 15% tougher');

  // Next night: burn the forge before dawn.
  toNight(api);
  const tpBefore = GS.tactical;
  const fb = GS.buildings.find((b) => b.id === forge.id);
  ok(!!fb, 'the forge still stands the next night');
  Game.warCampHooks.hit(fb, fb.hp + 5);
  ok(!GS.buildings.includes(fb), 'the forge is destroyed');
  ok(GS.tactical - tpBefore === W.bounty(forge) && W.bounty(forge) >= 3, `it pays a small bounty (+${GS.tactical - tpBefore} TP)`);
  ok(W.pendingBonuses({ buildings: GS.buildings }).every((b) => b.kind !== 'forge'), 'its bonus is gone from the preview');
  Game.beginDayPhase(true);
  const foe2 = { team: 'enemy', hp: 100, maxHp: 100, speed: 1, type: 'orc' };
  W.onEnemySpawn(foe2);
  ok(foe2.maxHp === 100, 'the next wave is not tougher');
  ok(W.activeBonuses().some((a) => a.kind === 'siege'), 'the camp left standing still counts');

  // Each kind does what its line says.
  toNight(api);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  Game.warCampHooks.raise({ kind: 'drums' });
  Game.warCampHooks.raise({ kind: 'shrine' });
  Game.beginDayPhase(true);
  const f3 = { team: 'enemy', hp: 50, maxHp: 50, speed: 1, type: 'goblin' };
  W.onEnemySpawn(f3);
  ok(Math.abs(f3.speed - 1.15) < 1e-9, 'Drum pit: the host marches 15% faster');
  ok(f3.fightToDeath === true, 'Shrine: enemies do not rout');
  toNight(api);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  Game.warCampHooks.raise({ kind: 'kennels' });
  const qBefore = GS.spawnQueue.length;
  Game.beginDayPhase(true);
  const pack = GS.spawnQueue.filter((t) => t === 'warg_rider').length;
  ok(pack >= 2, `Kennels: runners join the queue (${pack} warg riders, queue was ${qBefore})`);
  const runner = { team: 'enemy', hp: 50, maxHp: 50, speed: 1, type: 'warg_rider' };
  ok(W.onEnemySpawn(runner) === 'KENNEL PACK' && runner.lineBreaker === true, 'and they run for the line');

  // A camp left alone packs up.
  toNight(api);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  Game.warCampHooks.raise({ kind: 'forge' });
  let stood = 0;
  for (let i = 0; i < 6 && camps(GS, W).some((b) => W.kindOf(b) === 'forge'); i++) {
    Game.beginDayPhase(true);
    stood++;
    toNight(api);
    for (const b of camps(GS, W)) if (W.kindOf(b) !== 'forge') b.hp = 0;
  }
  ok(stood === W.LIFE_WAVES, `a camp left alone strengthens ${W.LIFE_WAVES} waves, then moves on (${stood})`);
}

// --- 3. soldiers do not walk off; an order onto the camp attacks it ---------------------
{
  const api = start(5);
  const { Game, GameState: GS, WarCamps: W } = api;
  run(Game, 10);
  toNight(api, 8);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const men = [];
  for (let i = 0; i < 6; i++) men.push(deploy(api, i % 2 ? 'archer' : 'footman', 470 + i * 26, 540));
  ok(men.every(Boolean), 'six soldiers are fielded');
  const camp = Game.warCampHooks.raise({ kind: 'forge', sector: 'centre' });
  const b = GS.buildings.find((x) => x.id === camp.id);
  const hp0 = b.hp;
  const y0 = men.map((u) => u.y);
  GS.nightTimer = -100000; // hold the night open
  run(Game, 900);
  const moved = men.filter((u, i) => Math.abs(u.y - y0[i]) > 60).length;
  ok(moved === 0 && b.hp === hp0, 'left to themselves for 15 seconds, nobody walks to the camp and it is untouched');
  ok(men.every((u) => !u.structureTargetId && !u.campOrderId), 'no soldier has the camp as a target');

  // Order them onto it.
  GS.selectedUnitIds = men.map((u) => u.id);
  Game.moveSelectionToWorld(b.x, b.y);
  ok(men.every((u) => u.campOrderId === b.id), 'a move order onto the camp is an attack order');
  let hurt = false;
  for (let i = 0; i < 4000 && GS.buildings.includes(b); i++) {
    Game.update();
    if (mine(GS).some((u) => u.hp < u.maxHp)) hurt = true;
  }
  ok(!GS.buildings.includes(b), 'the ordered soldiers tear the camp down');
  ok(hurt, 'its garrison wounded some of them');
  ok(men.every((u) => !u.campOrderId), 'the order ends with the camp');

  // A plain move cancels the order.
  const camp2 = Game.warCampHooks.raise({ kind: 'drums', sector: 'left' });
  const b2 = GS.buildings.find((x) => x.id === camp2.id);
  const live = mine(GS).filter((u) => u.type === 'footman' || u.type === 'archer');
  GS.selectedUnitIds = live.map((u) => u.id);
  Game.moveSelectionToWorld(b2.x, b2.y);
  Game.moveSelectionToWorld(GS.worldW / 2, GS.deployY - 40);
  ok(live.every((u) => !u.campOrderId), 'a move elsewhere cancels the attack order');

  // Sapper: siege damage applies. A strike lands on it too.
  const sap = { type: 'sapper', team: 'player', hp: 50, damage: 20, siegeMult: 3, combatType: 'melee' };
  const foot = { type: 'footman', team: 'player', hp: 50, damage: 20, combatType: 'melee' };
  let s = 0;
  let f = 0;
  for (let i = 0; i < 40; i++) {
    s += Game.warCampHooks.damageOf(sap, b2);
    f += Game.warCampHooks.damageOf(foot, b2);
  }
  ok(s > f * 2.5, `a Sapper hits a camp far harder than a footman (${Math.round(s / 40)} vs ${Math.round(f / 40)} a blow)`);
  const hpA = b2.hp;
  W.onBlast(b2.x + 10, b2.y, 50, 40, Game.warCampHooks.ctx());
  ok(hpA - b2.hp === 80, 'a strike landing on a camp does double damage to it');
  const hpB = b2.hp;
  W.onBlast(b2.x + 300, b2.y + 300, 50, 40, Game.warCampHooks.ctx());
  ok(b2.hp === hpB, 'a strike elsewhere does not');
}

// --- 4. save and load -------------------------------------------------------------------
{
  const api = start(9);
  const { Game, GameState: GS, WarCamps: W } = api;
  run(Game, 10);
  toNight(api, 9);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const c = Game.warCampHooks.raise({ kind: 'shrine', sector: 'right' });
  const b = GS.buildings.find((x) => x.id === c.id);
  Game.warCampHooks.hit(b, 100);
  const hp = b.hp;
  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  ok(snap.warCamps.camps.length === 1 && snap.warCamps.camps[0].kind === 'shrine', 'the camp is in the save');
  ok(!snap.buildings.some((x) => /^war_camp/.test(x.type)), 'and not duplicated in the building list');
  GS.buildings = GS.buildings.filter((x) => !W.isCamp(x));
  W.resetRun();
  ok(Game.importGameState(snap) !== false, 'the save loads');
  const back = camps(GS, W);
  ok(back.length === 1 && W.kindOf(back[0]) === 'shrine', 'the camp is back after loading');
  ok(Math.abs(back[0].hp - hp) < 1 && Math.abs(back[0].x - c.x) < 1, 'with its health and place');
  ok(W.pendingBonuses({ buildings: GS.buildings })[0]?.kind === 'shrine', 'and its bonus still pending');
  ok(Game.importGameState({ ...snap, warCamps: undefined }) !== false && camps(GS, W).length === 0,
    'an older save without camps loads with none');
}

// --- 5. the spy raid --------------------------------------------------------------------
{
  const api = start(21);
  const { Game, GameState: GS, WarCamps: W, EconomyRules: R, SpyActions } = api;
  run(Game, 10);
  toNight(api, 9);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  GS.tactical = 40;
  GS.spyUsedThisWave = false;
  ok(Game.executeSpyAction('settlement_raid') === false && GS.tactical === 40 && !GS.spyUsedThisWave,
    'with no camp the raid is refused, costs nothing and does not use up the spy');
  ok(!SpyActions.settlement_raid.kingdomStage && SpyActions.settlement_raid.waveMin <= 6,
    'the raid is no longer locked behind a kingdom stage or wave 150');
  const outcomes = {};
  let paid = 0;
  let reprisals = 0;
  for (let i = 0; i < 40; i++) {
    GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
    W.resetRun();
    R.resetRun();
    const c = Game.warCampHooks.raise({ kind: 'forge', sector: 'centre' });
    const b = GS.buildings.find((x) => x.id === c.id);
    GS.tactical = 40;
    GS.spyUsedThisWave = false;
    GS.nightTimer = -100000;
    const cost = R.getCost('spy:settlement_raid', { wave: GS.wave });
    if (!Game.executeSpyAction('settlement_raid')) continue;
    if (i === 0) {
      ok(GS.tactical === 40 - cost && cost >= 6, `the raid costs TP (${cost})`);
      ok(!!W.pendingRaid() && b.hp === b.maxHp, 'the raiders are on their way; nothing has landed yet');
      GS.spyUsedThisWave = false;
      ok(Game.executeSpyAction('settlement_raid') === false, 'a second raid cannot be ordered at once');
    }
    const tp = GS.tactical;
    run(Game, 300);
    const gone = !GS.buildings.includes(b);
    const key = gone ? 'burned' : b.hp < b.maxHp ? 'damaged' : 'repulsed';
    outcomes[key] = (outcomes[key] || 0) + 1;
    if (gone && GS.tactical > tp) paid++;
    if (W.getSnapshot({ buildings: GS.buildings }).reprisal > 0) reprisals++;
  }
  ok(outcomes.burned >= 12 && outcomes.damaged >= 5, `raids burn or damage the camp (${JSON.stringify(outcomes)})`);
  ok(paid === outcomes.burned, 'a camp burned by raiders pays its bounty');
  ok(reprisals >= 1, `the risk is real: ${reprisals} of 40 raids were followed home`);

  // Reprisal bodies join the next wave.
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const c = Game.warCampHooks.raise({ kind: 'drums' });
  let tries = 0;
  while (W.getSnapshot({ buildings: GS.buildings }).reprisal === 0 && tries++ < 60) {
    if (!camps(GS, W).length) Game.warCampHooks.raise({ kind: 'drums' });
    W.orderRaid(Game.warCampHooks.ctx());
    W.resolveRaid(Game.warCampHooks.ctx());
  }
  const owed = W.getSnapshot({ buildings: GS.buildings }).reprisal;
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  const base = (() => {
    Game.beginDayPhase(true);
    return GS.spawnQueue.length;
  })();
  ok(owed >= 2 && W.getSnapshot({ buildings: GS.buildings }).reprisal === 0 && base > 0,
    `a raid that was followed adds ${owed} foes to the next wave, once`);
  void c;

  // Sabotage spikes a camp.
  toNight(api);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  R.resetRun();
  Game.warCampHooks.raise({ kind: 'siege' });
  GS.tactical = 40;
  GS.spyUsedThisWave = false;
  ok(Game.executeSpyAction('sabotage') === true, 'Sabotage is bought');
  ok(W.pendingBonuses({ buildings: GS.buildings }).length === 0, 'the Siege yard gives no bonus that wave');
  Game.beginDayPhase(true);
  ok(!GS.spawnQueue.includes('siege_tower') && W.activeBonuses().length === 0, 'and no siege engine comes');
}

// --- 6. Disrupt -------------------------------------------------------------------------
{
  const api = start(12);
  const { Game, GameState: GS, EconomyRules: R, WarCamps: W } = api;
  const q = Array.from({ length: 30 }, (_, i) => (i % 3 ? 'goblin' : 'orc'));
  const added = R.rejoinSquad(q, 0.75);
  ok(added === 5 && q.length === 35, 'of 10 foes cut from a host of 40, 5 catch up as a late squad');
  ok(R.rejoinSquad(['orc'], 1) === 0, 'an undisrupted host has no stragglers');
  run(Game, 10);
  toNight(api, 12);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const sizes = { plain: [], disrupt: [] };
  for (let i = 0; i < 6; i++) {
    for (const mode of ['plain', 'disrupt']) {
      GS.timeOfDay = 'day';
      toNight(api, 12);
      GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
      W.resetRun();
      R.resetRun();
      GS.tactical = 40;
      GS.spyUsedThisWave = false;
      if (mode === 'disrupt') Game.executeSpyAction('disrupt');
      Game.beginDayPhase(true);
      sizes[mode].push(GS.spawnQueue.length);
    }
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const ratio = avg(sizes.disrupt) / avg(sizes.plain);
  ok(ratio > 0.8 && ratio < 0.95, `a disrupted wave fields about 87% of the bodies, not 75% (${ratio.toFixed(2)})`);
}

process.exit(failures() ? 1 : 0);
