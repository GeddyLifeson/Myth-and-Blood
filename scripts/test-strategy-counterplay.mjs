/**
 * Smoke tests for strategy detection, wave pressure layering, and damage modifiers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadCounterplay() {
  const bundle = readFileSync(join(JS, 'game-data-bundle.js'), 'utf8');
  const units = readFileSync(join(JS, 'units.js'), 'utf8');
  const counter = readFileSync(join(JS, 'strategy-counterplay.js'), 'utf8');
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
  vm.runInContext(units, ctx);
  return vm.runInContext(`${counter}\n({ StrategyCounterplay })`, ctx);
}

const { StrategyCounterplay } = loadCounterplay();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

StrategyCounterplay.resetRun();

const wallColony = {
  signals: { wallCount: 6, castleValue: 120, militaryUnits: 8, liquidTp: 40 },
  tier: { label: 'Dominant' },
  threatRatio: 1.4,
};
const wallUnits = [
  { team: 'player', hp: 100, type: 'footman' },
  { team: 'player', hp: 100, type: 'sapper' },
  { team: 'player', hp: 100, type: 'ballista' },
];
const found = StrategyCounterplay.detect(wallColony, 25, wallUnits);
ok(found.some((s) => s.id === 'wall_fortress'), 'detects wall fortress strategy');

const basePressure = {
  countMult: 1.1,
  hpMult: 1,
  dmgMult: 1,
  intervalMult: 1,
  poolExtras: ['orc'],
  weights: { orc: 1.2 },
  eliteSlots: 1,
};
const layered = StrategyCounterplay.applyToPressure(basePressure, found);
ok(layered.poolExtras.includes('siege_tower'), 'pressure adds siege counters');
ok((layered.weights.siege_tower || 0) >= 2.8, 'siege tower weight boosted');
ok(layered.intervalMult < basePressure.intervalMult, 'interval tightens under counter pressure');

const siegeTarget = { team: 'enemy', hp: 100, type: 'siege_tower' };
const sapper = { team: 'player', type: 'sapper', damage: 20 };
const baseDmg = 30;
const boosted = StrategyCounterplay.modifyDamage(sapper, siegeTarget, baseDmg);
ok(boosted > baseDmg, 'sappers deal bonus vs siege targets');

const bias = StrategyCounterplay.getTargetScoreBias(sapper, siegeTarget);
ok(bias < 0, 'sappers prefer siege targets in targeting');

const intel = StrategyCounterplay.formatCounterIntel(found);
ok(intel.includes('Wall Fortress'), 'intel names detected strategy');
ok(intel.includes('Sappers'), 'intel suggests player tools');

ok(!StrategyCounterplay.STRATEGIES.cavalry_core.pool.includes('pikeman'), 'cavalry counter pool has no player units');

process.exit(failed ? 1 : 0);