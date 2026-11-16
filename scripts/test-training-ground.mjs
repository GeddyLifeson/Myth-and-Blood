/**
 * Training Ground: opens at wave 10, one per field, a posted rank 2+ mentor raises one ranked
 * recruit of their type at dawn, the collapse hurts them, and old academy saves load as one.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(11);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const api = vm.runInContext(
  `${code}\n({ Game, SpriteGen, GameState, GameCampaign, GameBuildings, Research, Availability,
    createUnit, createBuilding, syncVeteranStatsToTier, getAcademyBuildBlockReason })`,
  vm.createContext(sb)
);
const { Game, GameState: GS, GameCampaign: GC, GameBuildings: GB } = api;
api.SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start();

const reason = (wave, buildings = []) =>
  api.getAcademyBuildBlockReason('training_ground', wave, buildings);
ok(reason(9) === 'Opens at wave 10.', `closed before wave 10 (${reason(9)})`);
ok(reason(10) === null, 'open at wave 10');

GS.wave = 10;
const cx = GS.worldW / 2;
const gy = GS.rallyY + 40;
const ground = api.createBuilding('training_ground', cx, gy, 'player');
ground.complete = true;
GS.buildings.push(ground);
ok(/^Only 1 Training Ground/.test(reason(10, GS.buildings) || ''), 'only one on the field');
const av = api.Availability.check('build', 'training_ground');
ok(!av.ok && /only 1 Training Ground/.test(av.reason || ''), `menu greys it: ${av.reason}`);

function soldier(type, tier, x = cx, y = gy) {
  const u = api.createUnit(type, x, y, 'player');
  u.vetTier = tier;
  api.syncVeteranStatsToTier(u);
  GS.units.push(u);
  return u;
}

const green = soldier('footman', 1, cx + 60);
ok(!GC.postToTrainingGround(green, cx, gy), 'rank 1 cannot be posted');
const builder = soldier('builder', 3, cx + 70);
ok(!GC.postToTrainingGround(builder, cx, gy), 'a builder cannot drill recruits');
const mentor = soldier('footman', 2);
ok(!GC.postToTrainingGround(mentor, cx + 200, gy), 'a move elsewhere does not post');
ok(GC.postToTrainingGround(mentor, cx, gy), 'rank 2 footman posted');
ok(ground.mentorId === mentor.id, 'ground remembers its mentor');

const fresh = api.createUnit('footman', 0, 0, 'player');
let before = GS.units.length;
ok(GC.processAcademyTraining() === 1, 'dawn raises one recruit');
const recruit = GS.units[GS.units.length - 1];
ok(GS.units.length === before + 1 && recruit.type === 'footman', 'the recruit is a footman');
ok(recruit.vetTier === 1, `recruit arrives at rank 1 (got ${recruit.vetTier})`);
ok(recruit.maxHp > fresh.maxHp, 'rank stats applied to the recruit');

api.Research.completeResearch('academy_charter');
GC.processAcademyTraining();
ok(GS.units[GS.units.length - 1].vetTier === 2, 'Academy Charter: recruits at rank 2');

mentor.x = cx + 300;
before = GS.units.length;
ok(GC.processAcademyTraining() === 0 && GS.units.length === before, 'no recruit off post');
mentor.x = cx;

const hp = mentor.maxHp;
GB.finalizeBuildingDestroyed(ground, {});
ok(mentor.hp <= hp * 0.4 + 1, `collapse hurts the mentor (${mentor.hp}/${hp})`);

// A demolished ground lets its mentor walk away unhurt.
const ground2 = api.createBuilding('training_ground', cx, gy, 'player');
ground2.complete = true;
GS.buildings.push(ground2);
const m2 = soldier('archer', 3);
ok(GC.postToTrainingGround(m2, cx, gy), 'archer posted');
GB.finalizeBuildingDestroyed(ground2, { silent: true });
ok(m2.hp === m2.maxHp, 'demolish does not hurt the mentor');

// An old save with academies loads them as Training Grounds.
const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
snap.buildings.push({
  id: 987654,
  type: 'academy_knight',
  academyUnit: 'knight',
  x: cx,
  y: gy,
  hp: 210,
  maxHp: 210,
  owner: 'player',
  complete: true,
});
sb.SaveFormat.seal(snap);
ok(
  Game.importGameState(snap),
  `save with an old academy loads ${JSON.stringify(Game.getLastLoadReport?.())}`
);
ok(
  GS.buildings.some((b) => b.id === 987654 && b.type === 'training_ground'),
  'old academy became a Training Ground'
);

const n = failures();
if (n) process.exit(1);
console.log('test-training-ground: all passed');
