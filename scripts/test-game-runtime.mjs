/**
 * Smoke tests for GameRuntime shared defs.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

const JS = join(process.cwd(), 'js');
const src = readFileSync(join(JS, 'game-runtime.js'), 'utf8');
const sb = { Object, Array, Map, Set };
sb.window = sb;
sb.globalThis = sb;
const { GameRuntime } = vm.runInContext(`${src}\n({ GameRuntime })`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const unit = {
  path: [{ x: 1, y: 2 }],
  pathIndex: 3,
  pathPending: true,
  pathReqId: 9,
  pathWaitTicks: 4,
  targetX: 10,
  targetY: 20,
  pathTargetId: 'u1',
  manualOrder: false,
};

GameRuntime.clearPathTrack(unit);
ok(!unit.path.length && unit.pathIndex === 0, 'clearPathTrack clears path');
ok(!unit.pathPending && unit.pathReqId == null, 'clearPathTrack clears async');
ok(unit.targetX == null && unit.pathTargetId == null, 'clearPathTrack clears targets');

GameRuntime.clearPathTrack(unit, { keepPath: true, keepTargets: true });
ok(unit.path.length === 0, 'keepPath still clears when already empty');

ok(GameRuntime.pathfindBudgetFor(90, { hordeActive: true }) >= 20, 'horde path budget boost');
ok(GameRuntime.syncPathCap(90, true) === 20, 'horde sync cap');
ok(GameRuntime.syncPathCap(90, false) === 12, 'crowded sync cap');

let called = false;
const ft = GameRuntime.makeFloatStatus({
  status: () => {
    called = true;
  },
});
ft(1, 2, 'x', '#fff');
ok(called, 'makeFloatStatus invokes floating text');

const hooks = GameRuntime.makeAnnounceHooks({
  showMessage: () => {},
  addHighlight: () => {},
  worldW: 100,
  worldH: 80,
  wave: 5,
  floatingText: ft,
});
ok(hooks.worldW === 100 && hooks.wave === 5, 'makeAnnounceHooks bundles world + wave');

ok(
  GameRuntime.cloneWaveMods({ countMult: 2 }).countMult === 2,
  'cloneWaveMods preserves overrides'
);

if (failed) process.exit(1);
console.log('\nAll game-runtime tests passed.');