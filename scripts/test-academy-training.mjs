/**
 * A finished academy trains one soldier of its kind at dawn, and the upkeep count rises with it.
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
  createBuilding,
} = vm.runInContext(
  `${code}\n({ Game, SpriteGen, GameState, GameCampaign, createBuilding })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start();

const cx = Game.getWorldCenter();
const academy = createBuilding('academy_footman', cx.x, cx.y + 40, 'player');
academy.complete = true;
academy.buildProgress = academy.buildTime;
GS.buildings.push(academy);

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
ok(footmen() === before + 1, 'the footman academy trains one footman');

if (failures()) process.exit(1);
console.log('academy training: ok');
