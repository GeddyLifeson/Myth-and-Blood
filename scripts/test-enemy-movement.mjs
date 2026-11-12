/**
 * Enemy units must receive paths and move after spawning (wave 2 scenario).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(99);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen, Pathfinding } = vm.runInContext(
  `${code}\n({ Game, SpriteGen, Pathfinding })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);

Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.creativeForceDay?.();
Game.creativeSetWave?.(2);

ok(
  Pathfinding.getWalkProfile({ team: 'enemy', combatType: 'melee', type: 'goblin' }) === 'ES',
  'enemy walk profile matches worker grid key'
);

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 80), 'player bait on field');
ok(Game.creativeSpawnEnemyAt('goblin', cx.x, 80), 'spawn enemy on wave 2 map');

const enemySnap = Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.hp > 0);
const enemy = Game.getUnitById(enemySnap.id);
ok(enemy, 'resolve spawned enemy');

const x0 = enemy.x;
const y0 = enemy.y;
for (let i = 0; i < 120; i++) Game.update();

ok(
  enemy.path?.length > 0 || Math.hypot(enemy.x - x0, enemy.y - y0) > 8,
  'enemy gets a path or moves toward player'
);
ok(Math.hypot(enemy.x - x0, enemy.y - y0) > 12, 'enemy advances after spawn ticks');

// Simulate outpost/build invalidation between waves (walk grids rebuilt on main thread).
Game.creativeSpawnPlayerAt('footman', cx.x + 120, cx.y + 40);
const enemy2Snap = Game.getUnitsSnapshot().find(
  (u) => u.team === 'enemy' && u.hp > 0 && u.id !== enemySnap.id
);
if (!enemy2Snap) {
  ok(Game.creativeSpawnEnemyAt('goblin', cx.x + 40, 72), 'second enemy for invalidation test');
}
const enemyB = Game.getUnitById(
  (enemy2Snap || Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.id !== enemySnap.id))
    ?.id
);
if (enemyB) {
  const bx0 = enemyB.x;
  const by0 = enemyB.y;
  Game.creativePlaceBuildingAt?.('outpost', cx.x - 60, cx.y + 20);
  for (let i = 0; i < 90; i++) Game.update();
  ok(
    enemyB.path?.length > 0 || Math.hypot(enemyB.x - bx0, enemyB.y - by0) > 8,
    'enemy still pathfinds after obstacle invalidation'
  );
} else {
  ok(false, 'second enemy for invalidation test');
}

if (failures()) {
  console.error(`\n${failures()} enemy-movement test(s) failed`);
  process.exit(1);
}
console.log('\nAll enemy-movement tests passed.');
