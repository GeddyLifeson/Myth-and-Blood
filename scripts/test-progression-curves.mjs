/**
 * Smoke tests for smoothed wave 100/200 progression curves and milestones.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadUnits() {
  const bundle = readFileSync(join(JS, 'game-data-bundle.js'), 'utf8');
  const units = readFileSync(join(JS, 'units.js'), 'utf8');
  const sb = { Math, Object, Array, Set, Map, JSON };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(bundle, ctx);
  vm.runInContext(
    `const UnitDefs = GameDataBundle.units;
     const BuildDefs = GameDataBundle.buildings;
     const EnemyDefs = GameDataBundle.enemies;`,
    ctx
  );
  return vm.runInContext(
    `${units}\n({
      smoothstep, academyEase, postAcademyEase, academyThresholdBlend, rtsMapBlend,
      getWorldSize, getTerritoryTier, getWaveConfig, PROGRESSION_MILESTONES, getProgressionMilestone,
      isProgressionMilestone, ACADEMY_ERA_WAVE, RTS_ERA_WAVE
    })`,
    ctx
  );
}

const U = loadUnits();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(U.smoothstep(0) === 0 && U.smoothstep(1) === 1, 'smoothstep endpoints');
ok(U.academyThresholdBlend(85) === 0 && U.academyThresholdBlend(115) === 1, 'academy threshold blend range');
ok(U.rtsMapBlend(174) === 0 && U.rtsMapBlend(205) === 1, 'RTS map blend range');

const w99 = U.getWorldSize(99);
const w100 = U.getWorldSize(100);
const w101 = U.getWorldSize(101);
// Fixed battlefield: wave defense uses a constant map size (no RTS map expand).
ok(w100.w === w99.w && w100.h === w99.h, 'map size stable into wave 100 (fixed field)');
ok(w101.w === w100.w && w101.h === w100.h, 'no map cliff at wave 100');
ok(!!w100.fixedBattlefield, 'getWorldSize marks fixedBattlefield');
// Soft territory tier still climbs for content (hazards/biomes) without growing the map.
ok(w100.tier >= w99.tier, 'content tier non-decreasing into wave 100');
ok(U.getTerritoryTier(35) >= 2, 'wave 35 reaches hazard/forest content tier');

const w199 = U.getWorldSize(199);
const w200 = U.getWorldSize(200);
const w201 = U.getWorldSize(201);
ok(w200.w === w199.w && w201.w === w200.w, 'map size stable through wave 200 (fixed field)');
ok(w200.h === w199.h && w201.h === w200.h, 'map height stable through wave 200');
ok(w200.tier >= w199.tier, 'content tier non-decreasing through wave 200');

const c99 = U.getWaveConfig(99).count;
const c100 = U.getWaveConfig(100).count;
const c101 = U.getWaveConfig(101).count;
ok(c100 >= c99 && c101 >= c100, 'spawn count climbs smoothly across wave 100');

ok(U.isProgressionMilestone(50), 'wave 50 is a milestone');
ok(U.isProgressionMilestone(85), 'wave 85 is a milestone');
ok(U.isProgressionMilestone(115), 'wave 115 is a milestone');
ok(U.isProgressionMilestone(175), 'wave 175 is a milestone');
ok(!U.isProgressionMilestone(42), 'wave 42 is not a milestone');
ok(U.PROGRESSION_MILESTONES.length >= 10, 'milestone list has intermediate beats');

const depthCode = readFileSync(join(JS, 'game-depth.js'), 'utf8');
const depthSb = { Math, Object, Array, Set, academyThresholdBlend: U.academyThresholdBlend, rtsMapBlend: U.rtsMapBlend };
depthSb.window = depthSb;
depthSb.globalThis = depthSb;
const { GameDepth } = vm.runInContext(`${depthCode}\n({ GameDepth })`, vm.createContext(depthSb));
const tp99 = GameDepth.waveTpScale(99);
const tp100 = GameDepth.waveTpScale(100);
const tp101 = GameDepth.waveTpScale(101);
ok(tp100 <= tp99 && tp101 <= tp100, 'TP scale eases down across wave 100');
const tp199 = GameDepth.waveTpScale(199);
const tp200 = GameDepth.waveTpScale(200);
const tp201 = GameDepth.waveTpScale(201);
ok(tp200 <= tp199 && tp201 <= tp200, 'TP scale eases down across wave 200');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll progression-curve smoke tests passed');