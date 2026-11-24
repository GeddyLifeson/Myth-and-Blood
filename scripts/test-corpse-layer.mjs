/**
 * Render order: the dead and dying must be drawn beneath living units and buildings.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

// A 2d context that accepts any call, so the whole draw pass can run headless.
function mkCtx() {
  const base = {
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(base, {
    get: (o, k) =>
      k in o ? o[k] : typeof k === 'string' && /^[a-z]/.test(k) ? () => {} : undefined,
    set: (o, k, v) => {
      o[k] = v;
      return true;
    },
  });
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
      getContext: (t) => (t === '2d' ? mkCtx() : null),
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
    performance: { now: () => Date.now(), memory: null },
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

const { sb, cvs } = boot(42);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, GameRender, SpriteGen, VisualPolish } = vm.runInContext(
  `${code}\n({ Game, GameRender, SpriteGen, VisualPolish })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);

const cx = Game.getWorldCenter();
Game.creativeSpawnPlayerAt('footman', cx.x, cx.y);
Game.creativeSpawnPlayerBuildingAt('outpost', cx.x + 60, cx.y);
VisualPolish.registerDeath({ x: cx.x, y: cx.y + 4, type: 'goblin', team: 'enemy', hp: 0 });

const order = [];
const wrap = (obj, name, tag) => {
  const fn = obj[name];
  obj[name] = function (...a) {
    order.push(typeof tag === 'function' ? tag(...a) : tag);
    return fn.apply(this, a);
  };
};
wrap(VisualPolish, 'drawDeathCorpses', 'dead');
wrap(SpriteGen, 'drawBuilding', 'building');
wrap(SpriteGen, 'getUnitCanvas', (...args) =>
  String(args[5]).startsWith('die_') ? 'dead-frame' : 'unit'
);
if (globalThis.BuildingArt) wrap(BuildingArt, 'draw', 'building');

let threw = null;
try {
  GameRender.draw();
} catch (err) {
  threw = err;
}
ok(!threw, `draw ran without throwing ${threw?.message || ''}`);
const dead = order.indexOf('dead');
const firstUnit = order.indexOf('unit');
const firstBuilding = order.indexOf('building');
ok(dead >= 0, 'corpses were drawn');
ok(firstUnit >= 0, 'living unit was drawn');
ok(firstBuilding >= 0, 'building was drawn');
ok(dead < firstUnit, `corpses before living units (dead ${dead}, unit ${firstUnit})`);
ok(dead < firstBuilding, `corpses before buildings (dead ${dead}, building ${firstBuilding})`);

if (failures()) {
  console.error(`\n${failures()} corpse-layer test(s) failed`);
  process.exit(1);
}
console.log('\nAll corpse-layer tests passed.');
