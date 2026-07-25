/**
 * Mage Arcane Dispel — purge void/fire/plague hazards for TP.
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

function boot(seed) {
  const noop = () => {};
  const store = new Map();
  const ids = new Map();
  const mk = (id) => {
    const e = {
      id,
      className: '',
      classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
      style: {},
      textContent: '',
      innerHTML: '',
      value: '',
      dataset: {},
      addEventListener: noop,
      removeEventListener: noop,
      click: noop,
      appendChild: (c) => c,
      querySelector: () => null,
      querySelectorAll: () => [],
      getContext: (t) =>
        t === '2d'
          ? {
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 1,
              font: '',
              textAlign: 'left',
              globalAlpha: 1,
              setLineDash: noop,
              save: noop,
              restore: noop,
              translate: noop,
              scale: noop,
              rotate: noop,
              setTransform: noop,
              beginPath: noop,
              moveTo: noop,
              lineTo: noop,
              arc: noop,
              fill: noop,
              stroke: noop,
              fillRect: noop,
              strokeRect: noop,
              fillText: noop,
              drawImage: noop,
              createLinearGradient: () => ({ addColorStop: noop }),
              measureText: () => ({ width: 10 }),
            }
          : null,
      width: 1280,
      height: 720,
    };
    ids.set(id, e);
    return e;
  };
  ['achievement-toast', 'menu-screen'].forEach(mk);
  let rng = seed;
  const M = Object.create(Math);
  M.random = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };
  const cvs = mk('canvas');
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
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    Math: M,
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
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    performance: { now: () => 0, memory: null },
    AudioContext: null,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: noop,
    removeEventListener: noop,
    document: {
      getElementById: (id) => ids.get(id) || mk(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => mk('el'),
      hidden: false,
    },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs };
}

// Isolation: FactionHazards.dispelInRadius
{
  const hazCode = readFileSync(join(JS, 'faction-hazards.js'), 'utf8');
  const hazSb = {
    console,
    Math,
    Date,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Infinity,
    NaN,
    undefined,
  };
  const { FactionHazards } = vm.runInContext(
    `${hazCode}\n({ FactionHazards })`,
    vm.createContext(hazSb)
  );
  const hazards = [
    { id: '1', type: 'orc_fire_pit', x: 100, y: 100, radius: 30 },
    { id: '2', type: 'void_corruption', x: 120, y: 110, radius: 28 },
    { id: '3', type: 'goblin_plague', x: 400, y: 400, radius: 26 },
  ];
  const r = FactionHazards.dispelInRadius(hazards, 110, 105, 85);
  ok(r.purged >= 2, `purged nearby burn+void (got ${r.purged})`);
  ok(hazards.length === 1 && hazards[0].type === 'goblin_plague', 'distant plague remains');
  ok(hazards.every((h) => h.type !== 'orc_fire_pit'), 'fire pit cleared');
  ok(hazards.every((h) => h.type !== 'void_corruption'), 'void cleared');
}

const { sb, cvs } = boot(19);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen, Abilities } = vm.runInContext(
  `${code}\n({ Game, SpriteGen, Abilities })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);

ok(Abilities?.dispel, 'dispel ability registered');
ok(Abilities.dispel.cost === 5, 'dispel costs 5 TP');
ok(Abilities.dispel.requiresMage, 'dispel requires mage flag');
ok(typeof Game.useAbility === 'function', 'useAbility exported');

Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.setCreativeSetting?.('instantBuild', true);
Game.creativeForceDay?.();
Game.creativeSetWave?.(40);

const cx = Game.getWorldCenter();

// Without mage, cast must fail.
ok(!Game.useAbility('dispel', cx.x, cx.y), 'dispel fails with no mage on field');

ok(Game.creativeSpawnPlayerAt('mage', cx.x, cx.y + 20), 'spawn mage');
for (let i = 0; i < 5; i++) Game.update();
const st = Game.getState();
ok((st.mageCount || 0) >= 1, `mageCount tracked (${st.mageCount})`);

ok(Game.useAbility('dispel', cx.x, cx.y + 20), 'dispel cast succeeds with mage nearby');
ok(!Game.useAbility('dispel', cx.x + 900, cx.y - 900), 'dispel fails outside mage cast range');

if (failed) {
  console.error(`\n${failed} mage-dispel test(s) failed`);
  process.exit(1);
}
console.log('\nAll mage-dispel tests passed.');
