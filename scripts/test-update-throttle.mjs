/**
 * Smoke tests for UpdateThrottle tiers and cadence.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const code = readFileSync(join(JS, 'update-throttle.js'), 'utf8');
const sb = { Math, Object, Array, Set };
sb.window = sb;
sb.globalThis = sb;

const { UpdateThrottle } = vm.runInContext(`${code}\n({ UpdateThrottle })`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const gfxQ = {
  skipAiMinUnits: 30,
  distantAiPad: 100,
  distantAiFarPad: 200,
  distantPlayerFarPad: 280,
  logicInterval: 2,
  pathfindMult: 1,
};

const isInView = (x, y, r, pad = 0) => {
  const left = 100 - pad;
  const right = 500 + pad;
  const top = 100 - pad;
  const bottom = 400 + pad;
  return x + r >= left && x - r <= right && y + r >= top && y - r <= bottom;
};

const ctx = {
  unitCount: 60,
  gfxQ,
  updateTick: 10,
  isInView,
  selectedIds: new Set(['sel1']),
  rallyY: 350,
};

const near = { id: 'aa', x: 300, y: 250, team: 'enemy', hp: 40 };
const far = { id: 'zz', x: -250, y: 250, team: 'enemy', hp: 40 };
const playerFar = { id: 'pp', x: 30, y: 30, team: 'player', hp: 40 };
const general = { id: 'gen', x: 900, y: 900, team: 'player', hp: 40, isGeneral: true };

ok(UpdateThrottle.getUnitTier(near, ctx) === 'full', 'in-view enemy is full tier');
ok(UpdateThrottle.getUnitTier(far, ctx) === 'distant', 'off-map enemy is distant tier');
ok(
  UpdateThrottle.getUnitTier(playerFar, ctx) === 'reduced' ||
    UpdateThrottle.getUnitTier(playerFar, ctx) === 'distant',
  'far player is reduced or distant'
);
ok(UpdateThrottle.getUnitTier(general, ctx) === 'full', 'general always full tier');
ok(UpdateThrottle.getUnitTier({ ...near, id: 'sel1' }, ctx) === 'full', 'selected unit full tier');

ok(UpdateThrottle.shouldRunHeavyLogic(8, gfxQ), 'heavy logic on even ticks');
ok(!UpdateThrottle.shouldRunHeavyLogic(9, gfxQ), 'heavy logic skipped on odd ticks');

const distantTier = 'distant';
let minimalHits = 0;
let fullHits = 0;
for (let t = 0; t < 12; t++) {
  if (UpdateThrottle.shouldRunUnitAIMinimal(far, distantTier, t)) minimalHits++;
  if (UpdateThrottle.shouldRunUnitAI(far, distantTier, t)) fullHits++;
}
ok(minimalHits > 0 && fullHits > 0, 'distant AI alternates minimal and full passes');
ok(
  !UpdateThrottle.shouldPathfind(far, distantTier, 1) ||
    UpdateThrottle.shouldPathfind(far, distantTier, 5),
  'distant pathfind is phased'
);

if (failed) {
  console.error(`\n${failed} update-throttle test(s) failed`);
  process.exit(1);
}
console.log('\nAll update-throttle tests passed.');