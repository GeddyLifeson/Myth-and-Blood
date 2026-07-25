/**
 * Wave 5 horde — simulation must advance without hanging; enemies must move.
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
const { Game, SpriteGen, GameDepth } = vm.runInContext(
  `${code}\n({ Game, SpriteGen, GameDepth })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);

Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);

const cx = Game.getWorldCenter();

// Seed player army + buildings like waves 1–4 buildup.
for (let i = 0; i < 12; i++) {
  Game.creativeSpawnPlayerAt('footman', cx.x - 80 + (i % 4) * 40, cx.y + 60 + Math.floor(i / 4) * 28);
}
for (let i = 0; i < 4; i++) {
  Game.creativeSpawnPlayerAt('archer', cx.x - 60 + i * 35, cx.y + 20);
}
Game.creativePlaceBuildingAt?.('outpost', cx.x - 100, cx.y + 40);
Game.creativePlaceBuildingAt?.('watchtower', cx.x + 100, cx.y + 30);

// Jump to wave 5 horde (creativeStartWave increments wave via startNextWave).
Game.creativeSetWave(4);
Game.creativeStartWave?.();

const st0 = Game.getState();
ok(st0.wave === 5, `wave is 5 (got ${st0.wave})`);
ok(GameDepth.isHordeWave(5), 'GameDepth marks wave 5 as horde');
ok(st0.timeOfDay === 'day', 'horde assault is in day phase');

// Stress: spawn extra enemies to mimic a crowded horde assault.
for (let i = 0; i < 10; i++) {
  Game.creativeSpawnEnemyAt('goblin', cx.x - 120 + (i % 5) * 48, 64 + Math.floor(i / 5) * 24);
}

const t0 = Date.now();
const TICKS = 400;
let maxUnits = 0;
let enemiesWithPath = 0;
let enemiesMoved = 0;
let slowestTick = 0;

for (let i = 0; i < TICKS; i++) {
  const tickStart = Date.now();
  Game.update();
  const tickMs = Date.now() - tickStart;
  if (tickMs > slowestTick) slowestTick = tickMs;

  const snap = Game.getUnitsSnapshot();
  maxUnits = Math.max(maxUnits, snap.length);
  const enemies = snap.filter((u) => u.team === 'enemy' && u.hp > 0);
  if (enemies.length) {
    enemiesWithPath = enemies.filter((u) => (u.pathLen ?? 0) > 0).length;
    enemiesMoved = enemies.filter((u) => u.moved).length;
  }
}

const elapsed = Date.now() - t0;
const st1 = Game.getState();
const activeEnemies = Game.getUnitsSnapshot().filter((u) => u.team === 'enemy' && u.hp > 0);

ok(elapsed < 15000, `400 ticks complete in ${elapsed}ms (<15s)`);
ok(slowestTick < 500, `slowest single tick ${slowestTick}ms (<500ms)`);
ok(!st1.paused, 'game not paused after horde ticks');
ok(st1.timeOfDay === 'day' || activeEnemies.length > 0, 'still in combat or day phase');

const moving = activeEnemies.filter((u) => {
  const full = Game.getUnitById(u.id);
  return full && (full.path?.length > 0 || full.animState === 'walk');
});
ok(
  moving.length >= Math.min(3, activeEnemies.length) || st1.spawnQueueLen > 0,
  `enemies pathing/moving (${moving.length}/${activeEnemies.length}) or still spawning`
);

console.log(
  `stats: maxUnits=${maxUnits} activeEnemies=${activeEnemies.length} elapsed=${elapsed}ms slowestTick=${slowestTick}ms`
);

if (failed) {
  console.error(`\n${failed} horde-wave5 test(s) failed`);
  process.exit(1);
}
console.log('\nAll horde-wave5 tests passed.');