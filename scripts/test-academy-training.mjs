/**
 * A finished Training Ground with a posted mentor trains one soldier of the mentor's kind at
 * dawn, and the upkeep count rises with it.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(7);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const {
  Game,
  SpriteGen,
  GameState: GS,
  GameCampaign,
  GameCore,
  createBuilding,
  createUnit,
} = vm.runInContext(
  `${code}\n({ Game, SpriteGen, GameState, GameCampaign, GameCore, createBuilding, createUnit })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start();

const cx = Game.getWorldCenter();
GS.wave = 10;
const academy = createBuilding('training_ground', cx.x, cx.y + 40, 'player');
academy.complete = true;
academy.buildProgress = academy.buildTime;
GS.buildings.push(academy);
const mentor = createUnit('footman', academy.x - 18, academy.y + 30, 'player');
mentor.vetTier = 2;
GS.units.push(mentor);
ok(GameCampaign.postToTrainingGround(mentor, academy.x, academy.y), 'a rank 2 footman is posted');
GameCampaign.processAcademyTraining();
const upkeepBefore = GameCore.unitCounts.upkeepArmy;

const footmen = () =>
  GS.units.filter((u) => u.team === 'player' && u.hp > 0 && u.type === 'footman').length;
const before = footmen();

let threw = null;
try {
  GameCampaign.processAcademyTraining();
} catch (e) {
  threw = e;
}
ok(!threw, `academy training runs without error${threw ? `: ${threw.message}` : ''}`);
ok(footmen() === before + 1, 'the Training Ground trains one footman');
ok(
  GameCore.unitCounts.upkeepArmy === upkeepBefore + 1,
  `the upkeep count rises with the recruit (${upkeepBefore} -> ${GameCore.unitCounts.upkeepArmy})`
);

if (failures()) process.exit(1);
console.log('academy training: ok');
