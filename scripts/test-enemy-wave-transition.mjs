/**
 * Enemies must keep pathfinding after wave 1 ends, night prep, and wave 2 begins.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(77);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen } = vm.runInContext(`${code}\n({ Game, SpriteGen })`, vm.createContext(sb));

SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);

// Creative boot is night at wave 0 — dawn starts wave 1.
Game.creativeForceDay?.();
ok(Game.getState().wave === 1, 'wave 1 day phase started');

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 80), 'player bait wave 1');
ok(Game.creativeSpawnEnemyAt('goblin', cx.x, 80), 'enemy on wave 1');

const w1Enemy = Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.hp > 0);
ok(w1Enemy, 'wave 1 enemy exists');
const w1 = Game.getUnitById(w1Enemy.id);
const w1x0 = w1.x;
const w1y0 = w1.y;
for (let i = 0; i < 120; i++) Game.update();
ok(w1.path?.length > 0 || Math.hypot(w1.x - w1x0, w1.y - w1y0) > 12, 'wave 1 enemy paths or moves');

// End wave 1 — night invalidates walk grids (regression trigger).
Game.creativeClearEnemies?.();
for (let i = 0; i < 8; i++) Game.update();
Game.creativeForceNight?.();
ok(Game.isNightPhase(), 'entered night after wave 1');

// Dawn wave 2 — same path as campaign wave 1 → night → wave 2.
Game.creativeForceDay?.();
ok(Game.getState().wave === 2, 'wave 2 day phase started');

ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 60), 'player bait wave 2');
ok(Game.creativeSpawnEnemyAt('goblin', cx.x + 20, 76), 'enemy on wave 2');

const w2Snap = Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.hp > 0);
ok(w2Snap, 'wave 2 enemy exists');
const w2 = Game.getUnitById(w2Snap.id);
const x0 = w2.x;
const y0 = w2.y;
for (let i = 0; i < 150; i++) Game.update();

ok(
  w2.path?.length > 0 || Math.hypot(w2.x - x0, w2.y - y0) > 8,
  'wave 2 enemy receives path after transition'
);
ok(Math.hypot(w2.x - x0, w2.y - y0) > 12, 'wave 2 enemy advances toward player');

if (failures()) {
  console.error(`\n${failures()} enemy-wave-transition test(s) failed`);
  process.exit(1);
}
console.log('\nAll enemy-wave-transition tests passed.');
