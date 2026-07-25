/**
 * Smoke tests for SpriteLod tiers and particle scaling.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const code = readFileSync(join(JS, 'sprite-lod.js'), 'utf8');
const sb = { Math, Object, Array, Set };
sb.globalThis = sb;

const { SpriteLod } = vm.runInContext(`${code}\n({ SpriteLod })`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const gfxQ = {
  spriteLodFloor: 1,
  spriteLodThresholds: [40, 70, 95, 120],
};

ok(SpriteLod.getSceneLod(30, gfxQ) === 1, 'scene LOD respects gfx floor');
ok(SpriteLod.getSceneLod(75, gfxQ) === 2, 'scene LOD bumps at threshold');
ok(SpriteLod.getSceneLod(130, gfxQ) === 3, 'scene LOD caps at minimal');

const isInView = (x, y, r, pad = 0) => {
  const left = 100 - pad;
  const right = 500 + pad;
  const top = 100 - pad;
  const bottom = 400 + pad;
  return x + r >= left && x - r <= right && y + r >= top && y - r <= bottom;
};

const near = { id: 'a1', x: 300, y: 250, team: 'enemy', hp: 10 };
const far = { id: 'z9', x: -250, y: 250, team: 'enemy', hp: 10 };
const boss = { id: 'b1', x: -250, y: 250, team: 'enemy', hp: 10, isNamedBoss: true };

ok(
  SpriteLod.getUnitLod(near, 2, { isInView, selectedIds: new Set() }) <= 2,
  'near unit stays at or below scene LOD'
);
ok(
  SpriteLod.getUnitLod(far, 1, { isInView, selectedIds: new Set(), farPad: 100 }) >= 2,
  'far unit gets higher LOD'
);
ok(
  SpriteLod.getUnitLod(boss, 3, { isInView, selectedIds: new Set(), farPad: 100 }) <= 1,
  'boss capped at medium LOD'
);

ok(SpriteLod.shouldDrawUnitOverlays(1), 'medium tier keeps overlays');
ok(!SpriteLod.shouldDrawUnitOverlays(2), 'low tier skips overlays');
ok(SpriteLod.particleMultForLod(3) < SpriteLod.particleMultForLod(0), 'particles scale down');

ok(
  SpriteLod.cacheAnimForLod(3, 'attack') === 'attack',
  'attack anim preserved at minimal LOD'
);
ok(
  SpriteLod.cacheFrameForLod(3, 2, 'attack') === 2,
  'attack frame preserved at minimal LOD'
);
ok(
  SpriteLod.getUnitLod(
    { id: 'e1', x: -250, y: 250, team: 'enemy', hp: 10, attackAnimTimer: 8, animState: 'attack' },
    3,
    { isInView, selectedIds: new Set(), farPad: 100 }
  ) <= 1,
  'attacking unit capped at medium LOD even when far'
);

if (failed) {
  console.error(`\n${failed} sprite-lod test(s) failed`);
  process.exit(1);
}
console.log('\nAll sprite-lod tests passed.');