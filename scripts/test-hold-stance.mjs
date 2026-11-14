/**
 * Hold posts (Thronefall-style): a soldier ordered to hold gets an assigned station.
 * He hard-plants on station, walks back if displaced, and only leaves on player move orders.
 * Hold is a per-soldier order now (Hold here, or Shift + move); see test-hunt-hold.mjs.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(11);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen } = vm.runInContext(`${code}\n({ Game, SpriteGen })`, vm.createContext(sb));
SpriteGen.prewarmCache = () => {};
Game.init(cvs);

Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.setCreativeSetting?.('instantBuild', true);
Game.creativeForceDay?.();
Game.creativeSetWave?.(2);

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 30), 'spawn footman A');
ok(Game.creativeSpawnPlayerAt('footman', cx.x + 10, cx.y + 30), 'spawn footman B (crowding)');
const units = Game.getUnitsSnapshot().filter((u) => u.type === 'footman' && u.team === 'player');
ok(units.length >= 2, 'two footmen on field');
const a = Game.getUnitById(units[0].id);
const b = Game.getUnitById(units[1].id);

// Hunt is the default; plant residual chase state, then hold.
ok(a.huntMode && !a.holding && b.huntMode && !b.holding, 'soldiers start out hunting');

// Fake a residual combat path so hold must clear it.
a.path = [
  { x: a.x + 120, y: a.y - 80 },
  { x: a.x + 160, y: a.y - 120 },
];
a.pathIndex = 0;
a.targetX = a.x + 160;
a.targetY = a.y - 120;
a.combatTargetId = 99999;
a.huntMode = true;
a.manualOrder = false;

Game.clearSelection();
ok(Game.orderHoldHere() >= 2, 'Hold here with nothing selected holds the army');
ok(a.holding && b.holding, 'both soldiers are under a hold order');
ok(a.manualOrder && !a.huntMode, 'A enters hold stance flags');
ok(Number.isFinite(a.holdX) && Number.isFinite(a.holdY), 'A has assigned hold post');
ok(!a.path?.length || a.pathTargetId === 'hold', 'hold clears residual chase path');
ok(a.combatTargetId == null, 'hold clears combat target');

const ax0 = a.holdX ?? a.x;
const ay0 = a.holdY ?? a.y;
const bx0 = b.holdX ?? b.x;
const by0 = b.holdY ?? b.y;

// Spawn an enemy in range of chase interest — hold must not walk toward it.
Game.creativeSpawnEnemyAt?.('zombie', a.x + 90, a.y - 40);
for (let i = 0; i < 90; i++) Game.update();

const driftA = Math.hypot(a.x - ax0, a.y - ay0);
const driftB = Math.hypot(b.x - bx0, b.y - by0);
ok(driftA <= 3, `holder A stays put under crowd/enemy pressure (drift=${driftA.toFixed(2)})`);
ok(driftB <= 3, `holder B stays put under crowd pressure (drift=${driftB.toFixed(2)})`);
ok(!a.huntMode && a.manualOrder, 'A still holding after sim ticks');

// Player order must still move them.
ok(Game.selectUnit(a.id), 'select holder A');
const destX = ax0 - 70;
const destY = ay0 + 10;
ok(
  Game.moveSelectionToWorld(destX, destY, undefined, { hold: true }),
  'player Shift + move order while holding'
);
ok(a.manualOrder && !a.huntMode && a.holding, 'move-and-hold keeps manual + hunt off');
ok(a.path?.length > 0 || Math.hypot(a.x - destX, a.y - destY) > 8, 'path or progress toward order');

let moved = false;
for (let i = 0; i < 120; i++) {
  Game.update();
  if (Math.hypot(a.x - ax0, a.y - ay0) > 12) {
    moved = true;
    break;
  }
}
ok(moved, 'holder marches when player orders a move');

// After arrival he is still under the hold order: plant again.
for (let i = 0; i < 180; i++) Game.update();
const nearDest = Math.hypot(a.x - destX, a.y - destY) <= 18;
ok(nearDest || a.manualOrder, 'arrived or still finishing order');
if (nearDest) {
  const hx = a.holdX ?? a.x;
  const hy = a.holdY ?? a.y;
  for (let i = 0; i < 60; i++) Game.update();
  const postDrift = Math.hypot(a.x - hx, a.y - hy);
  ok(postDrift <= 3, `after arrival stays planted (drift=${postDrift.toFixed(2)})`);
  ok(!a.huntMode && a.holding, 'still holding, not hunting, after arrival');
}

// Thronefall return: if shoved off post, walk back home.
const stationX = a.holdX ?? a.x;
const stationY = a.holdY ?? a.y;
a.x = stationX + 55;
a.y = stationY + 40;
let returned = false;
for (let i = 0; i < 160; i++) {
  Game.update();
  if (Math.hypot(a.x - stationX, a.y - stationY) <= 6) {
    returned = true;
    break;
  }
}
ok(returned, 'displaced holder returns to assigned post');
ok(Math.hypot(a.x - stationX, a.y - stationY) <= 6, 'snapped onto hold post after return');

if (failures()) {
  console.error(`\n${failures()} hold-stance test(s) failed`);
  process.exit(1);
}
console.log('\nAll hold-stance tests passed.');
