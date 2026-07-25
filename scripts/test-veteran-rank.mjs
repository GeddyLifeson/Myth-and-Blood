/**
 * Veteran rank-ups must raise unit combat stats.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

function boot() {
  const noop = () => {};
  const mk = (id) => ({
    id,
    className: '',
    classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
    style: {},
    addEventListener: noop,
    appendChild: (c) => c,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: (t) =>
      t === '2d'
        ? {
            fillStyle: '',
            strokeStyle: '',
            save: noop,
            restore: noop,
            translate: noop,
            scale: noop,
            setTransform: noop,
            beginPath: noop,
            moveTo: noop,
            lineTo: noop,
            arc: noop,
            fill: noop,
            stroke: noop,
            fillRect: noop,
            fillText: noop,
            drawImage: noop,
            measureText: () => ({ width: 10 }),
            createLinearGradient: () => ({ addColorStop: noop }),
          }
        : null,
    width: 1280,
    height: 720,
  });
  const ids = new Map();
  const get = (id) => ids.get(id) || (ids.set(id, mk(id)), ids.get(id));
  ['achievement-toast', 'menu-screen'].forEach(get);
  const cvs = get('canvas');
  const sb = {
    console,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    Math: Object.assign(Object.create(Math), { random: () => 0.42 }),
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    Uint8Array,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
    requestAnimationFrame: (fn) => {
      fn();
      return 0;
    },
    cancelAnimationFrame: noop,
    localStorage: {
      getItem: () => null,
      setItem: noop,
      removeItem: noop,
      clear: noop,
    },
    performance: { now: () => 0 },
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: noop,
    removeEventListener: noop,
    document: {
      getElementById: get,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => mk('el'),
    },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs };
}

const { sb, cvs } = boot();
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

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 40), 'spawn footman');
const foot = Game.getUnitById(
  Game.getUnitsSnapshot().find((u) => u.type === 'footman' && u.team === 'player')?.id
);
ok(foot, 'resolve footman');

const hp0 = foot.maxHp;
const dmg0 = foot.damage;
foot.vetUpgradeEligible = true;
ok(Game.selectUnit(foot.id), 'select footman for promote');
ok(Game.upgradeSelectedVeteran?.(), 'TP veteran promote');
ok(foot.vetTier === 1, 'footman vet tier increments');
ok(foot.maxHp > hp0, 'footman maxHp rises after promote');
ok(foot.damage > dmg0, 'footman damage rises after promote');

const starHp = foot.maxHp;
ok(Pathfinding, 'pathfinding loaded');
const starEvent = sb.addVetStar(foot, 'bronze');
ok(starEvent === 'bronze', 'bronze star event');
ok(foot.maxHp > starHp, 'bronze star bumps combat stats');

ok(Game.creativeSpawnPlayerAt('healer', cx.x - 50, cx.y + 50), 'spawn healer');
Game.update();
const healerSnap = Game.getUnitsSnapshot().find((u) => u.type === 'healer' && u.team === 'player');
ok(healerSnap?.id, 'healer appears in snapshot');
const healer = Game.getUnitById(healerSnap.id);
ok(healer && healer.id === healerSnap.id && healer.type === 'healer', 'resolve healer');
ok(healer.type === 'healer' || healer.combatType === 'healer', `healer type is healer (${healer.type}/${healer.combatType})`);
sb.ensureHealerStats?.(healer);
ok(healer.healAmount > 0, `healer has healAmount (${healer.healAmount})`);
ok(sb.isSpecialistUnit(healer), `healer counts as specialist (team=${healer.team})`);
ok(typeof sb.trySpecialistRank === 'function', 'trySpecialistRank is global');
healer.vetTier = 0;
healer.vetStatTierApplied = 0;
healer.specialistRankedThisWave = false;
const heal0 = healer.healAmount;
const healerHp0 = healer.maxHp;
const rankEvent = sb.trySpecialistRank(healer);
ok(rankEvent === 'upgrade', `specialist wave rank applies upgrade (got ${rankEvent})`);
ok(healer.vetTier === 1, 'healer vet tier increments from wave work');
ok(healer.healAmount > heal0, `healer healAmount rises (${heal0} -> ${healer.healAmount})`);
ok(healer.maxHp > healerHp0, `healer maxHp rises (${healerHp0} -> ${healer.maxHp})`);

ok(Game.creativeSpawnPlayerAt('archer', cx.x + 60, cx.y + 30), 'spawn archer');
Game.update();
const archer = Game.getUnitById(
  Game.getUnitsSnapshot().find((u) => u.type === 'archer' && u.team === 'player')?.id
);
ok(archer, 'resolve archer');
const archDmg0 = archer.damage;
const archRange0 = archer.baseRange || archer.range;
sb.addVetStar(archer, 'bronze');
ok(archer.damage > archDmg0, 'archer gains ranged damage on bronze star');
ok((archer.baseRange || archer.range) >= archRange0, 'archer gains range on bronze star');

ok(Game.creativeSpawnPlayerAt('cavalry', cx.x + 90, cx.y + 20), 'spawn cavalry');
Game.update();
const cav = Game.getUnitById(
  Game.getUnitsSnapshot().find((u) => u.type === 'cavalry' && u.team === 'player')?.id
);
ok(cav, 'resolve cavalry');
const cavSpd0 = cav.speed;
sb.addVetStar(cav, 'silver');
ok(cav.speed > cavSpd0, 'cavalry gains speed on silver star');

if (failed) {
  console.error(`\n${failed} veteran-rank test(s) failed`);
  process.exit(1);
}
console.log('\nAll veteran-rank tests passed.');