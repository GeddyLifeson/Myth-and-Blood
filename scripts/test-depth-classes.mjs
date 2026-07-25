/**
 * Smoke tests for ColonyValue, FactionDepth, GameDepth class refactor.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const sb = {
  console,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Map,
  Set,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  undefined,
  NaN,
  Infinity,
  setTimeout: (fn) => {
    fn();
    return 0;
  },
  clearTimeout: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
sb.window = sb;
sb.globalThis = sb;

const { ColonyValue, FactionDepth, GameDepth, GameEvents, GameServices, createUnit } =
  vm.runInContext(
    `${code}\n({ ColonyValue, FactionDepth, GameDepth, GameEvents, GameServices, createUnit })`,
    vm.createContext(sb)
  );

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(
  ColonyValue?.constructor?.name === 'ColonyValueSystem',
  'ColonyValue is ColonyValueSystem instance'
);
ok(typeof ColonyValue.bind === 'function', 'ColonyValue.bind');
ok(ColonyValue.THREAT_TIERS?.length === 5, 'ColonyValue.THREAT_TIERS');
const colony = ColonyValue.computeKingdomStrength({
  wave: 10,
  units: [],
  buildings: [],
  tactical: 40,
});
ok(colony.total >= 0 && colony.tier?.label, 'ColonyValue.computeKingdomStrength');
const pressure = ColonyValue.deriveWavePressure(colony, 10);
ok(pressure.countMult > 0, 'ColonyValue.deriveWavePressure');

ok(FactionDepth.PROFILES?.halo?.label?.includes('Orbital'), 'FactionDepth.PROFILES');
ok(typeof FactionDepth.getProfile === 'function', 'FactionDepth.getProfile');
ok(
  FactionDepth.getProfile('halo')?.building === 'spartan_academy',
  'FactionDepth.getProfile(halo)'
);
FactionDepth.bind({
  units: [],
  buildings: [],
  wave: 50,
  unitDistance: () => 0,
  takeDamage: () => {},
  damageInRadius: () => {},
});
const dempsey = createUnit('tank_dempsey', 0, 0, 'player');
dempsey.wweAbility = 'frag_out';
FactionDepth.processAbilityHit(dempsey, { id: 1, team: 'enemy', hp: 10, x: 0, y: 0 }, 20);
ok(true, 'FactionDepth.processAbilityHit with bound ctx');

ok(GameDepth.isBossWave(10), 'GameDepth.isBossWave');
ok(GameDepth.scaleSettlementTp(25) < 25, 'GameDepth.scaleSettlementTp soft cap');
ok(GameDepth.getNamedBossForWave(10)?.name, 'GameDepth.getNamedBossForWave');
const grunt = createUnit('goblin', 0, 0, 'enemy');
GameDepth.applyEnemySpawnScaling(grunt, 30, { cfg: { hpScale: 1, dmgScale: 1 }, diff: {} });
ok(grunt.maxHp > 0, 'GameDepth.applyEnemySpawnScaling');

ok(GameServices?.constructor?.name === 'GameServicesSystem', 'GameServices singleton');
ok(GameServices.get('FactionDepth') === FactionDepth, 'GameServices registers FactionDepth');
ok(GameServices.get('ColonyValue') === ColonyValue, 'GameServices registers ColonyValue');

ok(GameEvents?.constructor?.name === 'GameEventsSystem', 'GameEvents singleton');
let busFired = false;
GameEvents.once(GameEvents.GameEvent.WAVE_START, (p) => {
  busFired = p.phase === 'prep';
});
GameEvents.emit(GameEvents.GameEvent.WAVE_START, { phase: 'prep', wave: 1 });
ok(busFired, 'GameEvents.emit/on');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nAll depth-class smoke tests passed.');
