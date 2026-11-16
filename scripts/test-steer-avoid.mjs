/**
 * Units curve around trees and around standing people instead of walking into them.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(5);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const {
  Game,
  SpriteGen,
  GameState: GS,
} = vm.runInContext(`${code}\n({ Game, SpriteGen, GameState })`, vm.createContext(sb));
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.creativeForceDay?.();
const cx = Game.getWorldCenter();
const midY = 300;

function reset() {
  Game.creativeClearAllUnits?.();
  Game.creativeClearEnemies?.();
  Game.creativeClearDecorations?.();
}
function spawn(x, y) {
  const before = new Set(GS.units.map((u) => u.id));
  Game.creativeSpawnPlayerAt('footman', x, y);
  return GS.units.find((u) => !before.has(u.id));
}
function order(u, x, y) {
  Game.selectUnit(u.id);
  Game.moveSelectionToWorld(x, y);
}

// 1. Walking straight at a tree: the unit should swing wide of the trunk, not scrape it.
reset();
Game.creativePlaceDecoration('tree', cx.x, midY);
const tree = GS.decorations[0];
const walker = spawn(cx.x + 1, midY + 110);
order(walker, cx.x + 1, midY - 110);
let treeGap = 1e9;
let t = 0;
for (; t < 500 && Math.hypot(walker.x - (cx.x + 1), walker.y - (midY - 110)) > 12; t++) {
  Game.update();
  treeGap = Math.min(treeGap, Math.hypot(walker.x - tree.x, walker.y - tree.y) - tree.radius);
}
console.log(`tree: closest edge gap ${treeGap.toFixed(1)}, ${t} ticks`);
ok(t < 500, 'walker reaches the far side of the tree');
ok(treeGap > 16, `walker keeps clear of the trunk (gap ${treeGap.toFixed(1)} > 16)`);

// 2. Walking at a soldier standing still: go around him instead of shoving into him.
reset();
const stander = spawn(cx.x, midY);
for (let i = 0; i < 5; i++) Game.update();
const sx = stander.x,
  sy = stander.y;
const mover = spawn(sx + 1, sy + 110);
order(mover, sx + 1, sy - 110);
let personGap = 1e9;
for (t = 0; t < 500 && Math.hypot(mover.x - (sx + 1), mover.y - (sy - 110)) > 12; t++) {
  Game.update();
  personGap = Math.min(personGap, Math.hypot(mover.x - stander.x, mover.y - stander.y));
}
console.log(`person: closest ${personGap.toFixed(1)}, ${t} ticks`);
ok(t < 500, 'mover reaches the far side of the standing soldier');
ok(
  personGap > 24,
  `mover passes the standing soldier with room (closest ${personGap.toFixed(1)} > 24)`
);

// 3. Two soldiers walking at each other pass by, neither stalls.
reset();
const a = spawn(cx.x, midY + 110);
const b = spawn(cx.x + 1, midY - 110);
order(a, cx.x, midY - 110);
order(b, cx.x + 1, midY + 110);
let passGap = 1e9;
for (t = 0; t < 500; t++) {
  Game.update();
  passGap = Math.min(passGap, Math.hypot(a.x - b.x, a.y - b.y));
  if (a.y < midY - 95 && b.y > midY + 95) break;
}
console.log(`head-on: closest ${passGap.toFixed(1)}, ${t} ticks`);
ok(t < 500, 'two soldiers walking at each other both get past');
ok(passGap > 20, `they sidestep each other (closest ${passGap.toFixed(1)} > 20)`);

// 4. Charging a foe on the far side of a tree: the soldier swings round the trunk.
reset();
Game.creativePlaceDecoration('tree', cx.x, midY);
const tree2 = GS.decorations[0];
const hunter = spawn(cx.x + 1, midY + 70);
Game.creativeSpawnEnemyAt('goblin', cx.x + 1, midY - 60);
let chaseGap = 1e9;
for (t = 0; t < 300; t++) {
  Game.update();
  chaseGap = Math.min(chaseGap, Math.hypot(hunter.x - tree2.x, hunter.y - tree2.y) - tree2.radius);
}
console.log(`chase: closest edge gap ${chaseGap.toFixed(1)}`);
ok(chaseGap > 10, `charging soldier keeps off the trunk (gap ${chaseGap.toFixed(1)} > 10)`);

if (failures()) {
  console.error(`\n${failures()} steer-avoid test(s) failed`);
  process.exit(1);
}
console.log('\nAll steer-avoid tests passed.');
