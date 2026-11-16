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
      EconomyRules, WarCamps, DynamicMapEvents, ContentExpansion, NeutralWildlife, SaveFormat })`,
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
  ok(
    seen > 0 && most >= 1,
    `camps are raised from wave 6 (${seen} camp-nights in ${nights} nights)`
  );
  ok(most <= W.MAX_CAMPS, `never more than ${W.MAX_CAMPS} camps at once (most seen: ${most})`);
  ok(
    badSpot === 0,
    'every camp sits just inside the top edge, far from the deploy zone, and blocks nothing'
  );
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
  ok(
    /War camps: .+\(right\): /.test(line),
    `the night preview names the camp and its bonus (${line})`
  );
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
  ok(
    GS.spawnQueue.slice(0, 4).includes('siege_tower'),
    'Siege yard: a siege engine joins the queue'
  );
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
  ok(
    GS.tactical - tpBefore === W.bounty(forge) && W.bounty(forge) >= 3,
    `it pays a small bounty (+${GS.tactical - tpBefore} TP)`
  );
  ok(
    W.pendingBonuses({ buildings: GS.buildings }).every((b) => b.kind !== 'forge'),
    'its bonus is gone from the preview'
  );
  Game.beginDayPhase(true);
  const foe2 = { team: 'enemy', hp: 100, maxHp: 100, speed: 1, type: 'orc' };
  W.onEnemySpawn(foe2);
  ok(foe2.maxHp === 100, 'the next wave is not tougher');
  ok(
    W.activeBonuses().some((a) => a.kind === 'siege'),
    'the camp left standing still counts'
  );

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
  ok(
    W.onEnemySpawn(runner) === 'KENNEL PACK' && runner.lineBreaker === true,
    'and they run for the line'
  );

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
  ok(
    stood === W.LIFE_WAVES,
    `a camp left alone strengthens ${W.LIFE_WAVES} waves, then moves on (${stood})`
  );
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
  for (let i = 0; i < 6; i++)
    men.push(deploy(api, i % 2 ? 'archer' : 'footman', 470 + i * 26, 540));
  ok(men.every(Boolean), 'six soldiers are fielded');
  const camp = Game.warCampHooks.raise({ kind: 'forge', sector: 'centre' });
  const b = GS.buildings.find((x) => x.id === camp.id);
  const hp0 = b.hp;
  const y0 = men.map((u) => u.y);
  GS.nightTimer = -100000; // hold the night open
  run(Game, 900);
  const moved = men.filter((u, i) => Math.abs(u.y - y0[i]) > 60).length;
  ok(
    moved === 0 && b.hp === hp0,
    'left to themselves for 15 seconds, nobody walks to the camp and it is untouched'
  );
  ok(
    men.every((u) => !u.structureTargetId && !u.campOrderId),
    'no soldier has the camp as a target'
  );

  // Order them onto it.
  GS.selectedUnitIds = men.map((u) => u.id);
  Game.moveSelectionToWorld(b.x, b.y);
  ok(
    men.every((u) => u.campOrderId === b.id),
    'a move order onto the camp is an attack order'
  );
  let hurt = false;
  for (let i = 0; i < 4000 && GS.buildings.includes(b); i++) {
    Game.update();
    if (mine(GS).some((u) => u.hp < u.maxHp)) hurt = true;
  }
  ok(!GS.buildings.includes(b), 'the ordered soldiers tear the camp down');
  ok(hurt, 'its garrison wounded some of them');
  ok(
    men.every((u) => !u.campOrderId),
    'the order ends with the camp'
  );

  // A plain move cancels the order.
  const camp2 = Game.warCampHooks.raise({ kind: 'drums', sector: 'left' });
  const b2 = GS.buildings.find((x) => x.id === camp2.id);
  const live = mine(GS).filter((u) => u.type === 'footman' || u.type === 'archer');
  GS.selectedUnitIds = live.map((u) => u.id);
  Game.moveSelectionToWorld(b2.x, b2.y);
  Game.moveSelectionToWorld(GS.worldW / 2, GS.deployY - 40);
  ok(
    live.every((u) => !u.campOrderId),
    'a move elsewhere cancels the attack order'
  );

  // Sapper: siege damage applies. A strike lands on it too.
  const sap = {
    type: 'sapper',
    team: 'player',
    hp: 50,
    damage: 20,
    siegeMult: 3,
    combatType: 'melee',
  };
  const foot = { type: 'footman', team: 'player', hp: 50, damage: 20, combatType: 'melee' };
  let s = 0;
  let f = 0;
  for (let i = 0; i < 40; i++) {
    s += Game.warCampHooks.damageOf(sap, b2);
    f += Game.warCampHooks.damageOf(foot, b2);
  }
  ok(
    s > f * 2.5,
    `a Sapper hits a camp far harder than a footman (${Math.round(s / 40)} vs ${Math.round(f / 40)} a blow)`
  );
  const hpA = b2.hp;
  W.onBlast(b2.x + 10, b2.y, 50, 40, Game.warCampHooks.ctx());
  ok(hpA - b2.hp === 80, 'a strike landing on a camp does double damage to it');
  const hpB = b2.hp;
  W.onBlast(b2.x + 300, b2.y + 300, 50, 40, Game.warCampHooks.ctx());
  ok(b2.hp === hpB, 'a strike elsewhere does not');
}

// --- 3b. soldiers already beside a camp strike it without an order ----------------------
{
  const api = start(11);
  const { Game, GameState: GS, WarCamps: W } = api;
  run(Game, 10);
  toNight(api, 8);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const camp = Game.warCampHooks.raise({ kind: 'forge', sector: 'centre' });
  const b = GS.buildings.find((x) => x.id === camp.id);
  const men = [];
  for (let i = 0; i < 4; i++) men.push(deploy(api, 'footman', 470 + i * 26, 540));
  ok(men.every(Boolean), 'four footmen are fielded');
  men.forEach((u, i) => {
    u.x = b.x - 30 + i * 20;
    u.y = b.y + (b.radius || 24) + 14;
    u.path = [];
    u.manualOrder = false;
  });
  const hp0 = b.hp;
  GS.nightTimer = -100000;
  run(Game, 600);
  ok(b.hp < hp0, `footmen standing at the camp's edge hit it unordered (${hp0} -> ${b.hp})`);
  // Each blow lands once: the camp is not struck twice per swing by two attack loops.
  const swings = men.reduce((n, u) => n + (u.hp > 0 ? 1 : 0), 0) * Math.ceil(600 / 58);
  const blow = Game.warCampHooks.damageOf(men[0], b);
  ok(
    hp0 - b.hp <= swings * (blow + 4),
    `no blow is counted twice (${hp0 - b.hp} dealt, at most ${swings * (blow + 4)})`
  );
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
  ok(
    snap.warCamps.camps.length === 1 && snap.warCamps.camps[0].kind === 'shrine',
    'the camp is in the save'
  );
  ok(
    !snap.buildings.some((x) => /^war_camp/.test(x.type)),
    'and not duplicated in the building list'
  );
  GS.buildings = GS.buildings.filter((x) => !W.isCamp(x));
  W.resetRun();
  ok(Game.importGameState(snap) !== false, 'the save loads');
  const back = camps(GS, W);
  ok(back.length === 1 && W.kindOf(back[0]) === 'shrine', 'the camp is back after loading');
  ok(Math.abs(back[0].hp - hp) < 1 && Math.abs(back[0].x - c.x) < 1, 'with its health and place');
  ok(
    W.pendingBonuses({ buildings: GS.buildings })[0]?.kind === 'shrine',
    'and its bonus still pending'
  );
  ok(
    Game.importGameState(api.SaveFormat.seal({ ...snap, warCamps: undefined })) !== false &&
      camps(GS, W).length === 0,
    'an older save without camps loads with none'
  );
}

// --- 6. camps behave: a first night, digging in, raiders, the sortie --------------------
{
  let certain = 0;
  let early = 0;
  let warned = 0;
  for (const seed of [3, 14, 27, 31, 40]) {
    const api = start(seed);
    const { Game, GameState: GS, WarCamps: W, sb } = api;
    const said = [];
    const show = sb.UI?.showMessage;
    run(Game, 10);
    const ctx = Game.warCampHooks.ctx();
    const base = Object.getPrototypeOf(ctx);
    const orig = base.showMessage;
    base.showMessage = (t, d, o) => {
      said.push(String(t));
      return orig(t, d, o);
    };
    toNight(api, 4);
    if (camps(GS, W).length) early++;
    if (said.some((t) => /axes in the north/.test(t))) warned++;
    GS.timeOfDay = 'day';
    toNight(api, 5);
    if (camps(GS, W).length === 1 && said.some((t) => /The enemy digs in/.test(t))) certain++;
    base.showMessage = orig;
    void show;
  }
  ok(early === 0 && warned === 5, 'the night before, scouts warn that camps are coming');
  ok(
    certain === 5,
    `the first camp always rises on the first eligible night, announced (${certain}/5)`
  );

  const api = start(17);
  const { Game, GameState: GS, WarCamps: W } = api;
  run(Game, 10);
  toNight(api, 8);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const forge = Game.warCampHooks.raise({ kind: 'forge', sector: 'centre' });
  const fb = GS.buildings.find((b) => b.id === forge.id);
  const hp1 = fb.maxHp;
  const snap1 = W.getSnapshot({ buildings: GS.buildings, wave: GS.wave }).camps[0];
  ok(snap1.level === 1 && snap1.name === 'Forge', 'a new camp is level I');
  Game.beginDayPhase(true);
  ok(
    GS.units.every((u) => !u.isCounterRaid),
    'a level I camp sends no raiders'
  );
  toNight(api);
  for (const b of camps(GS, W)) if (b.id !== forge.id) b.hp = 0;
  GS.buildings = GS.buildings.filter((b) => b.hp > 0);
  const snap2 = W.getSnapshot({ buildings: GS.buildings, wave: GS.wave }).camps[0];
  ok(
    snap2.level === 2 && snap2.name === 'Forge II' && fb.maxHp === Math.round(hp1 * 1.25),
    `left standing a night it digs in: ${snap2.name}, ${hp1} -> ${fb.maxHp} health`
  );
  ok(fb.hp === fb.maxHp, 'the new palisade comes at full strength');
  ok(/20% tougher/.test(snap2.line), `its bonus grows (${snap2.line})`);
  ok(snap2.guards > snap1.guards, `and so does its garrison (${snap1.guards} -> ${snap2.guards})`);

  // Dawn with a building of the player's on the field: raiders are sent at it.
  const hut = {
    id: 'hut-test',
    type: 'hamlet',
    owner: 'player',
    complete: true,
    hp: 100,
    x: 500,
    y: 500,
  };
  const queue = ['orc', 'orc', 'orc', 'orc', 'orc', 'orc'];
  const ctx = Object.create(Game.warCampHooks.ctx(), {
    buildings: { value: [...GS.buildings, hut] },
    spawnQueue: { value: queue },
  });
  W.onWaveStart(ctx);
  ok(queue.length === 8, `a level II camp adds two raiders to the wave (${queue.length - 6})`);
  const raiderType = queue[4];
  const foe = { team: 'enemy', hp: 100, maxHp: 100, speed: 1, type: raiderType };
  const tag = W.onEnemySpawn(foe);
  ok(foe.maxHp === 120, 'Forge II: an enemy enters 20% tougher');
  ok(
    tag === 'CAMP RAIDERS' && foe.isCounterRaid === true && foe.raidTargetId === 'hut-test',
    'a raider is sent straight at the building'
  );
  W.onEnemySpawn({ team: 'enemy', hp: 1, maxHp: 1, speed: 1, type: raiderType });
  const third = { team: 'enemy', hp: 1, maxHp: 1, speed: 1, type: raiderType };
  W.onEnemySpawn(third);
  ok(!third.isCounterRaid, 'only as many raiders as the camp sent');
  const noHut = ['orc', 'orc', 'orc', 'orc', 'orc', 'orc'];
  W.onWaveStart(
    Object.create(Game.warCampHooks.ctx(), {
      buildings: { value: GS.buildings.filter((b) => b.owner !== 'player') },
      spawnQueue: { value: noHut },
    })
  );
  ok(noHut.length === 6, 'with nothing of yours to raid, no raiders come');

  // Level III is the top; the save keeps the level.
  W.fortify(forge, Game.warCampHooks.ctx());
  W.fortify(forge, Game.warCampHooks.ctx());
  ok(forge.level === W.MAX_LEVEL, `a camp digs in no further than level ${W.MAX_LEVEL}`);
  const saved = JSON.parse(JSON.stringify(Game.exportGameState()));
  ok(saved.warCamps.camps[0].level === 3 && saved.warCamps.begun === true, 'the level is saved');
  GS.buildings = GS.buildings.filter((x) => !W.isCamp(x));
  W.resetRun();
  ok(Game.importGameState(saved) !== false, 'the save loads');
  ok(
    W.getSnapshot({ buildings: GS.buildings, wave: GS.wave }).camps[0]?.name === 'Forge III',
    'and the camp comes back dug in'
  );
  const old = JSON.parse(JSON.stringify(saved));
  delete old.warCamps.begun;
  for (const c of old.warCamps.camps) {
    delete c.level;
    delete c.sallied;
  }
  ok(Game.importGameState(api.SaveFormat.seal(old)) !== false, 'a save from before levels loads');
  const oldSnap = W.getSnapshot({ buildings: GS.buildings, wave: GS.wave });
  ok(
    oldSnap.camps[0]?.level === 1 && oldSnap.begun === true,
    'its camp is level I and the camp war is not announced again'
  );
}

// --- 7. the garrison comes out when soldiers strike the camp ----------------------------
{
  const api = start(23);
  const { Game, GameState: GS, WarCamps: W } = api;
  run(Game, 10);
  toNight(api, 8);
  GS.buildings = GS.buildings.filter((b) => !W.isCamp(b));
  W.resetRun();
  const camp = Game.warCampHooks.raise({ kind: 'drums', sector: 'centre' });
  const b = GS.buildings.find((x) => x.id === camp.id);
  GS.nightTimer = -100000;
  const foes = () => GS.units.filter((u) => u.team === 'enemy' && u.hp > 0);
  Game.warCampHooks.hit(b, 20);
  run(Game, 10);
  ok(foes().length === 0 && !camp.sallied, 'a strike with no soldier near draws nobody out');
  const men = [];
  for (let i = 0; i < 6; i++) men.push(deploy(api, 'footman', 470 + i * 26, 540));
  GS.selectedUnitIds = men.map((u) => u.id);
  Game.moveSelectionToWorld(b.x, b.y);
  let out = 0;
  for (let i = 0; i < 3000 && !out; i++) {
    Game.update();
    out = foes().filter((u) => u.campDefender).length;
  }
  ok(
    out === 2 && camp.sallied,
    `struck by soldiers, the garrison comes out as real enemies (${out})`
  );
  ok(
    W.getSnapshot({ buildings: GS.buildings, wave: GS.wave }).camps[0]?.guards === 0,
    'nobody is left on the palisade to throw'
  );
  for (let i = 0; i < 4000 && GS.buildings.includes(b); i++) Game.update();
  ok(foes().filter((u) => u.campDefender).length <= out, 'it sallies once a night');
  ok(!GS.buildings.includes(b), 'the soldiers beat the garrison and burn the camp');
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
  ok(
    Game.executeSpyAction('settlement_raid') === false && GS.tactical === 40 && !GS.spyUsedThisWave,
    'with no camp the raid is refused, costs nothing and does not use up the spy'
  );
  ok(
    !SpyActions.settlement_raid.kingdomStage && SpyActions.settlement_raid.waveMin <= 6,
    'the raid is no longer locked behind a kingdom stage or wave 150'
  );
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
      ok(
        !!W.pendingRaid() && b.hp === b.maxHp,
        'the raiders are on their way; nothing has landed yet'
      );
      GS.spyUsedThisWave = false;
      ok(
        Game.executeSpyAction('settlement_raid') === false,
        'a second raid cannot be ordered at once'
      );
    }
    const tp = GS.tactical;
    run(Game, 300);
    const gone = !GS.buildings.includes(b);
    const key = gone ? 'burned' : b.hp < b.maxHp ? 'damaged' : 'repulsed';
    outcomes[key] = (outcomes[key] || 0) + 1;
    if (gone && GS.tactical > tp) paid++;
    if (W.getSnapshot({ buildings: GS.buildings }).reprisal > 0) reprisals++;
  }
  ok(
    outcomes.burned >= 12 && outcomes.damaged >= 5,
    `raids burn or damage the camp (${JSON.stringify(outcomes)})`
  );
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
  ok(
    owed >= 2 && W.getSnapshot({ buildings: GS.buildings }).reprisal === 0 && base > 0,
    `a raid that was followed adds ${owed} foes to the next wave, once`
  );
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
  ok(
    W.pendingBonuses({ buildings: GS.buildings }).length === 0,
    'the Siege yard gives no bonus that wave'
  );
  Game.beginDayPhase(true);
  ok(
    !GS.spawnQueue.includes('siege_tower') && W.activeBonuses().length === 0,
    'and no siege engine comes'
  );
}

// --- 6. Disrupt -------------------------------------------------------------------------
{
  const api = start(12);
  const { Game, GameState: GS, EconomyRules: R, WarCamps: W } = api;
  const q = Array.from({ length: 30 }, (_, i) => (i % 3 ? 'goblin' : 'orc'));
  const added = R.rejoinSquad(q, 0.75);
  ok(
    added === 5 && q.length === 35,
    'of 10 foes cut from a host of 40, 5 catch up as a late squad'
  );
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
  ok(
    ratio > 0.8 && ratio < 0.95,
    `a disrupted wave fields about 87% of the bodies, not 75% (${ratio.toFixed(2)})`
  );
}

// --- 8. events: about one wave in four ------------------------------------------------------
{
  const { DynamicMapEvents: D, ContentExpansion: C, NeutralWildlife: N } = start(11);
  const seen = { planet: 0, field: 0, wildlife: 0, hazard: 0 };
  let heraldMissed = 0;
  let evWaves = 0;
  let total = 0;
  let worstGap = 0;
  let mismatched = 0;
  for (let seed = 1; seed <= 20; seed++) {
    let n = 0;
    D.resetRun(`seed-${seed}`);
    let last = 0;
    for (let wave = 1; wave <= 300; wave++) {
      const hits = [
        D.pickEvent(wave) && 'planet',
        C.pickWaveEvent(wave) && 'field',
        N.pickWaveEvent(wave) && 'wildlife',
        D.eventSlot(wave) === 'hazard' && 'hazard',
      ].filter(Boolean);
      if (!C.heraldNews(wave) !== !hits.length) heraldMissed++;
      total++;
      if (
        hits.length > 1 ||
        (hits.length === 1) !== (D.eventSlot(wave) !== null && hits[0] === D.eventSlot(wave))
      )
        mismatched++;
      if (hits.length) {
        n++;
        evWaves++;
        seen[hits[0]]++;
        worstGap = Math.max(worstGap, wave - last);
        last = wave;
      }
    }
    if (seed === 1) ok(n > 50 && n < 100, `one seeded run of 300 waves has ${n} event waves`);
  }
  const share = evWaves / total;
  ok(
    share > 0.2 && share < 0.28,
    `events fire on ${(share * 100).toFixed(1)}% of waves over 6000 (about one in four)`
  );
  ok(mismatched === 0, 'one event system speaks per event wave, and only in its own slot');
  ok(worstGap <= 8, `never more than ${worstGap} waves between events`);
  ok(
    seen.planet > 0 && seen.field > 0 && seen.wildlife > 0 && seen.hazard > 0,
    `all four kinds appear (${JSON.stringify(seen)})`
  );
  ok(
    heraldMissed === 0,
    `the herald names the deck's event on every event wave, and only then (${heraldMissed} off)`
  );
  const planet = Object.values(D.EVENTS).every((e) => e.choices.length >= 2);
  ok(planet, 'every planet event offers a real choice');
}

// --- 9. faction hazards change only on the deck's hazard waves -------------------------------
{
  const api = start(13);
  const { Game, GameState: GS, DynamicMapEvents: D } = api;
  run(Game, 10);
  D.resetRun('hazard-seed');
  let changed = 0;
  let offDeck = 0;
  let hazardWaves = 0;
  for (let wave = 20; wave <= 70; wave++) {
    toNight(api, wave);
    const before = JSON.stringify(GS.hazards.map((h) => [h.id, Math.round(h.radius * 100)]));
    Game.beginDayPhase(true);
    const after = JSON.stringify(GS.hazards.map((h) => [h.id, Math.round(h.radius * 100)]));
    const due = D.eventSlot(GS.wave) === 'hazard';
    if (due) hazardWaves++;
    if (before !== after) {
      changed++;
      if (!due) offDeck++;
    }
  }
  ok(
    hazardWaves > 0 && changed === hazardWaves,
    `every hazard wave lays hazards (${changed} of ${hazardWaves})`
  );
  ok(offDeck === 0, `no hazard appears or spreads off the deck (${offDeck} waves)`);
  ok(GS.hazards.length <= 4, `at most four hazards on the field (${GS.hazards.length})`);
}

process.exit(failures() ? 1 : 0);
