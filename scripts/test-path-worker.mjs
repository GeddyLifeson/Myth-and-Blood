/**
 * Smoke tests for pathfinding-core, wave-composition-core, and path-worker-bridge.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function bootSandbox() {
  const sb = { Math, Object, Array, Set, Map, Uint8Array, Worker: undefined };
  sb.window = sb;
  sb.globalThis = sb;
  return vm.createContext(sb);
}

function loadInto(ctx, file, exportsKey) {
  const code = readFileSync(join(JS, file), 'utf8');
  return vm.runInContext(`${code}\n({ ${exportsKey} })`, ctx)[exportsKey];
}

const ctx = bootSandbox();
const PathfindingCore = loadInto(ctx, 'pathfinding-core.js', 'PathfindingCore');
const WaveCompositionCore = loadInto(ctx, 'wave-composition-core.js', 'WaveCompositionCore');
loadInto(ctx, 'path-worker-bridge.js', 'PathWorkerBridge');
const Pathfinding = loadInto(ctx, 'pathfinding.js', 'Pathfinding');
const PathWorkerBridge = vm.runInContext('PathWorkerBridge', ctx);

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

PathfindingCore.init(640, 480);
const gridW = Math.ceil(640 / PathfindingCore.CELL);
const gridH = Math.ceil(480 / PathfindingCore.CELL);
const grid = new Uint8Array(gridW * gridH);
grid[gridH * gridW - 1] = 1;
const path = PathfindingCore.findPathOnGrid(grid, 20, 20, 600, 400);
ok(path.length > 0, 'pathfinding-core finds route on open grid');
ok(path[0].x >= 0 && path[0].y >= 0, 'path nodes have world coordinates');

const q1 = WaveCompositionCore.buildWeightedSpawnQueue({
  count: 12,
  pool: ['goblin', 'orc', 'troll'],
  weights: { goblin: 3, orc: 1, troll: 0.2 },
  elites: ['troll'],
  noElites: false,
  seed: 42,
});
const q2 = WaveCompositionCore.buildWeightedSpawnQueue({
  count: 12,
  pool: ['goblin', 'orc', 'troll'],
  weights: { goblin: 3, orc: 1, troll: 0.2 },
  elites: ['troll'],
  noElites: false,
  seed: 42,
});
ok(q1.length === 12 && q2.length === 12, 'wave-composition fills requested count');
ok(q1.every((t) => ['goblin', 'orc', 'troll'].includes(t)), 'wave-composition picks from pool');
ok(q1.join(',') === q2.join(','), 'seeded wave-composition is deterministic');

Pathfinding.init(640, 480);
ok(Pathfinding.getWalkProfile({ team: 'enemy', combatType: 'melee' }) === 'ES', 'enemy melee uses ES worker grid');
ok(Pathfinding.getWalkProfile({ team: 'enemy', type: 'siege_tower', combatType: 'melee' }) === 'EL', 'enemy siege uses EL worker grid');
ok(Pathfinding.getWalkProfile({ team: 'player', combatType: 'melee' }) === 'PS', 'player melee uses PS worker grid');
ok(Pathfinding.getWalkProfile({ team: 'player', combatType: 'cavalry' }) === 'PL', 'player cavalry uses PL worker grid');

ok(!PathWorkerBridge.isSupported(), 'bridge reports no Worker in headless VM');
ok(!PathWorkerBridge.isReady(), 'bridge not ready without worker');
ok(PathWorkerBridge.drainPathResults().length === 0, 'drainPathResults empty initially');
ok(PathWorkerBridge.takePrefetchedSpawnQueue(1) === null, 'no prefetched queue without worker');

Pathfinding.init(640, 480);
const blockFn = () => false;
const grids = Pathfinding.rebuildWalkGrids(blockFn);
ok(grids?.ES?.length > 0, 'rebuildWalkGrids produces enemy melee grid');
const pathAfterRebuild = Pathfinding.findPath(40, 40, 500, 360, { team: 'enemy', combatType: 'melee' }, blockFn);
ok(pathAfterRebuild.length > 0, 'sync findPath works after walk grid rebuild');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll path-worker smoke tests passed');