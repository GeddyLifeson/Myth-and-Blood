/**
 * Smoke tests for EntityPool — acquire, release, reuse, purge dead.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const code = readFileSync(join(JS, 'entity-pool.js'), 'utf8');
const sb = { Math, Object, Array, Map, Set };
sb.window = sb;
sb.globalThis = sb;

const { EntityPool } = vm.runInContext(`${code}\n({ EntityPool })`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

function spawnMockUnit(x, y, team) {
  const u = EntityPool.acquireUnit();
  u.id = Math.random().toString(36).slice(2, 9);
  u.x = x;
  u.y = y;
  u.team = team;
  u.hp = 40;
  u.maxHp = 40;
  u.path = [];
  u.perks = [];
  return u;
}

const u1 = spawnMockUnit(10, 20, 'player');
const u1Ref = u1;
u1.hazardSlow = 0.5;
u1.hazardTick_haz1 = 12;
u1.structureTargetId = 'x';
EntityPool.releaseUnit(u1);

const u2 = spawnMockUnit(30, 40, 'enemy');
ok(u2 === u1Ref, 'acquired unit reuses released object');
ok(u2.hazardSlow === undefined, 'release wipes ephemeral hazardSlow');
ok(u2.hazardTick_haz1 === undefined, 'release wipes hazardTick_* keys');
ok(u2.structureTargetId === undefined, 'release wipes structureTargetId');

u2.hp = 0;
const list = [u2];
EntityPool.purgeDeadFromList(list);
ok(list.length === 0, 'purgeDeadFromList removes and pools dead units');
ok(EntityPool.getStats().unitPool >= 1, 'dead unit returned to pool');

const b1 = EntityPool.acquireBuilding();
b1.id = 'b1';
b1.type = 'wall';
b1.hp = 80;
EntityPool.releaseBuilding(b1);
const b2 = EntityPool.acquireBuilding();
ok(b2 === b1, 'acquired building reuses released object');

EntityPool.reset();
ok(EntityPool.getStats().unitPool === 0, 'reset clears unit pool');
ok(EntityPool.getStats().buildingPool === 0, 'reset clears building pool');

if (failed) {
  console.error(`\n${failed} entity-pool test(s) failed`);
  process.exit(1);
}
console.log('\nAll entity-pool tests passed.');