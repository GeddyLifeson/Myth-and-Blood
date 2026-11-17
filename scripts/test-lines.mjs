/**
 * Troop lines and combat rules: every line has a job, matchups and star growth in the data,
 * and the rules the combat audit found broken now do what they say.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb, cvs } = boot(4000);
const api = vm.runInContext(
  `${code}\n({ Game, SpriteGen, GameState, GameCore, GameCombat, GameMorale, Formations,
    createUnit, addVetStar, UnitDefs, EnemyDefs })`,
  vm.createContext(sb)
);
const { Game, GameState: GS, GameCore, GameCombat, GameMorale, Formations } = api;
const { UnitDefs, EnemyDefs } = api;
api.SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start();
Game.beginDayPhase(true);
for (let i = 0; i < 5; i++) Game.update();
GS.spawnQueue = [];
for (const u of GS.units) u.hp = 0;
Game.update();
// One inert enemy in a corner keeps the wave, and so the unit loop, running.
const anchor = api.createUnit('orc', 6, 6, 'enemy');
Object.assign(anchor, { speed: 0, damage: 0, maxHp: 1e7, hp: 1e7 });
GS.units.push(anchor);
Game.beginDayPhase(true);
GS.spawnQueue = [];

// Hit-stop frames freeze the sim, so count ticks, not update calls.
const tick = (n = 1) => {
  const end = GS.updateTick + n;
  while (GS.updateTick < end) Game.update();
};

const unit = (type, team, x, y, set = {}) => {
  const u = api.createUnit(type, x, y, team, { spawnWave: GS.wave });
  Object.assign(u, set);
  GS.units.push(u);
  return u;
};
// An enemy that stands still, never strikes and keeps the wave open.
const dummy = (type, x, y, set = {}) =>
  unit(type, 'enemy', x, y, { speed: 0, damage: 0, maxHp: 1e6, hp: 1e6, mustered: true, ...set });
const still = { canHunt: false, huntMode: false };

// ---------------------------------------------------------------- identity in the data
const troops = Object.keys(UnitDefs).filter((t) => t !== 'doomslayer_hero');
ok(troops.length === 15, `15 troop lines (${troops.length})`);
const noJob = troops.filter((t) => !UnitDefs[t].job || !UnitDefs[t].stars);
ok(noJob.length === 0, `every troop line has a job and a star path ${noJob.join(',')}`);
const coreEnemies = JSON.parse(readFileSync(join(JS, '..', 'data', 'enemies.json'), 'utf8'));
const jobless = Object.keys(coreEnemies).filter((t) => !EnemyDefs[t].job);
ok(jobless.length === 0, `every core enemy has a job ${jobless.join(',')}`);
const badBeats = [];
for (const t of troops)
  for (const k in UnitDefs[t].beats || {}) if (!EnemyDefs[k]) badBeats.push(`${t}>${k}`);
for (const t in coreEnemies)
  for (const k in EnemyDefs[t].beats || {}) if (!UnitDefs[k]) badBeats.push(`${t}>${k}`);
ok(badBeats.length === 0, `every matchup names a real unit ${badBeats.join(',')}`);

// ---------------------------------------------------------------- matchups and crits
const xbow = unit('crossbowman', 'player', 300, 300, still);
const foot = unit('footman', 'player', 320, 300, still);
const knightE = dummy('dark_knight', 300, 200);
const mageM = api.createUnit('mage', 0, 0, 'player');
ok(GameCombat.counterMult(mageM, knightE) === 1.3, 'a mage beats a dark knight by 30%');
ok(GameCombat.counterMult(foot, knightE) === 1, 'a footman has no edge on a dark knight');
const card = GameCombat.describeLine(xbow);
ok(card.job && card.beats.includes('Dark Knight') && card.stars, 'the card names job and matchups');

knightE.hitFlash = 0;
GameCombat.takeDamage(knightE, 60, { attacker: foot, attackerTeam: 'player' });
ok(knightE.hitFlash < 10, 'a heavy blow from the wrong line is not a crit');
knightE.hitFlash = 0;
GameCombat.takeDamage(knightE, 5, { attacker: xbow, attackerTeam: 'player' });
ok(knightE.hitFlash === 10, 'a blow from the line that beats it is a crit');

// ---------------------------------------------------------------- missiles use the live shooter
const mage = unit('mage', 'player', 340, 300, still);
const base = GameCombat.calcDamage(mage, knightE, 0, 1);
ok(mage.swingN === 1, "a missile's damage is worked out on the mage himself (Arcane Burst counts)");
ok(base < mage.damage, 'and uses the damage the missile left with');
GS.projectiles.push({
  x: knightE.x,
  y: knightE.y + 2,
  tx: knightE.x,
  ty: knightE.y,
  type: 'bolt',
  damage: mage.damage,
  team: 'player',
  speed: 7,
  accuracy: 100,
  targetId: knightE.id,
  sourceId: mage.id,
  sourceType: 'mage',
});
tick();
ok(mage.swingN === 2, 'a bolt landing in the game loop counts on the live mage too');

// ---------------------------------------------------------------- pins last what they say
const pinned = dummy('orc', 500, 200, { pinned: true, pinTimer: 25 });
tick(24);
ok(pinned.pinned, 'a 25-tick pin still holds after 24 ticks');
tick();
ok(!pinned.pinned, 'and ends on tick 25');

// ---------------------------------------------------------------- kill credit
const striker = unit('footman', 'player', 60, 500, still);
const bystander = unit('footman', 'player', 90, 500, still);
const victim = dummy('goblin', 75, 470, { maxHp: 30, hp: 30 });
bystander.combatTargetId = victim.id;
GameCombat.takeDamage(victim, 1, { attacker: striker, attackerTeam: 'player' });
const [xpS, xpB] = [striker.experience, bystander.experience];
GameCombat.takeDamage(victim, 500, {});
ok(victim.hp <= 0 && striker.experience > xpS, 'a poison kill goes to the last soldier to strike');
ok(bystander.experience === xpB, 'not to a bystander who only had it targeted');
const unseen = dummy('goblin', 75, 440, { maxHp: 30, hp: 30 });
bystander.combatTargetId = unseen.id;
GameCombat.takeDamage(unseen, 500, {});
ok(bystander.experience === xpB, 'a kill nobody struck credits nobody');

// ---------------------------------------------------------------- riding down routers
const cav = unit('cavalry', 'player', 400, 400);
const foot2 = unit('footman', 'player', 410, 400);
const router = dummy('orc', 400, 380, { fleeing: true });
ok(GameMorale.isPursuableFoe(cav, router), 'cavalry may strike a routing enemy');
ok(!GameMorale.isPursuableFoe(foot2, router), 'a footman may not');
router.hp = 0;

// ---------------------------------------------------------------- deserters are losses
const lostBefore = GS.runPlayerDeaths;
unit('footman', 'player', 200, GS.worldH + 40, { fleeing: true });
tick(3);
// His unit object goes back to the pool once he is off the field, so only the count is checked.
ok(GS.runPlayerDeaths === lostBefore + 1, 'a deserter counts as a loss');

// ---------------------------------------------------------------- stars lift ranged morale
const archer = unit('archer', 'player', 360, 300, still);
const m0 = archer.maxMorale;
api.addVetStar(archer);
ok(archer.maxMorale > m0, `an archer's first star lifts morale (${m0} to ${archer.maxMorale})`);
const r0 = xbow.reloadMult;
api.addVetStar(xbow);
ok(xbow.reloadMult < r0, "a crossbowman's stars shorten his reload");

// ---------------------------------------------------------------- mid-wave spawns are scaled
GS.wave = 20;
const plain = api.createUnit('goblin', 10, 10, 'enemy');
const scaled = GameCombat.scaleMidWaveSpawn(api.createUnit('goblin', 10, 10, 'enemy'));
ok(
  scaled.maxHp > plain.maxHp && scaled.accuracy > plain.accuracy,
  `a wave-20 summon is scaled (${plain.maxHp} to ${scaled.maxHp} health)`
);
GS.wave = 1;

// ---------------------------------------------------------------- formations
Formations.assign([foot, foot2], 'box');
ok(foot.formation === 'box' && foot2.formation === 'box', 'two soldiers take a formation order');
ok(Formations.takenMult(foot, {}) === 0.88, 'a box takes 12% less');
const hpBox = dummy('orc', 320, 280);
const before = foot.hp;
GameCombat.takeDamage(foot, 20, { attacker: hpBox, attackerTeam: 'enemy' });
const lostBox = before - foot.hp;
foot.hp = before;
Formations.assign([foot], 'box');
ok(foot.formation === null, 'a lone soldier has no formation');
GameCombat.takeDamage(foot, 20, { attacker: hpBox, attackerTeam: 'enemy' });
ok(lostBox < before - foot.hp, 'the box soaked part of the same blow');
Formations.assign([xbow, archer], 'line');
ok(Formations.aimBonus(archer) === 8, 'shooters in a line aim better');
ok(Formations.blockedReason(1) !== '' && Formations.blockedReason(2) === '', 'needs two soldiers');

// ---------------------------------------------------------------- elimination
GameCore.unitCounts.player = 0;
GameCore.unitCounts.unitProducers = 0;
GS.tactical = UnitDefs.footman.cost;
ok(!GameCore.isPlayerEliminated(), 'no soldiers but TP for one: the run goes on');
GS.tactical = 0;
ok(GameCore.isPlayerEliminated(), 'no soldiers and no TP: eliminated');

process.exit(failures() ? 1 : 0);
