/**
 * Enemies must keep pathfinding after wave 1 ends, night prep, and wave 2 begins.
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

const { sb, cvs } = boot(77);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen } = vm.runInContext(`${code}\n({ Game, SpriteGen })`, vm.createContext(sb));

SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);

// Creative boot is night at wave 0 — dawn starts wave 1.
Game.creativeForceDay?.();
ok(Game.getState().wave === 1, 'wave 1 day phase started');

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 80), 'player bait wave 1');
ok(Game.creativeSpawnEnemyAt('goblin', cx.x, 80), 'enemy on wave 1');

const w1Enemy = Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.hp > 0);
ok(w1Enemy, 'wave 1 enemy exists');
const w1 = Game.getUnitById(w1Enemy.id);
const w1x0 = w1.x;
const w1y0 = w1.y;
for (let i = 0; i < 120; i++) Game.update();
ok(
  w1.path?.length > 0 || Math.hypot(w1.x - w1x0, w1.y - w1y0) > 12,
  'wave 1 enemy paths or moves'
);

// End wave 1 — night invalidates walk grids (regression trigger).
Game.creativeClearEnemies?.();
for (let i = 0; i < 8; i++) Game.update();
Game.creativeForceNight?.();
ok(Game.isNightPhase(), 'entered night after wave 1');

// Dawn wave 2 — same path as campaign wave 1 → night → wave 2.
Game.creativeForceDay?.();
ok(Game.getState().wave === 2, 'wave 2 day phase started');

ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 60), 'player bait wave 2');
ok(Game.creativeSpawnEnemyAt('goblin', cx.x + 20, 76), 'enemy on wave 2');

const w2Snap = Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.hp > 0);
ok(w2Snap, 'wave 2 enemy exists');
const w2 = Game.getUnitById(w2Snap.id);
const x0 = w2.x;
const y0 = w2.y;
for (let i = 0; i < 150; i++) Game.update();

ok(
  w2.path?.length > 0 || Math.hypot(w2.x - x0, w2.y - y0) > 8,
  'wave 2 enemy receives path after transition'
);
ok(Math.hypot(w2.x - x0, w2.y - y0) > 12, 'wave 2 enemy advances toward player');

if (failed) {
  console.error(`\n${failed} enemy-wave-transition test(s) failed`);
  process.exit(1);
}
console.log('\nAll enemy-wave-transition tests passed.');