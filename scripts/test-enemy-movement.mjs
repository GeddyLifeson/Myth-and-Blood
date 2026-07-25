/**
 * Enemy units must receive paths and move after spawning (wave 2 scenario).
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

const { sb, cvs } = boot(99);
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
Game.creativeSetWave?.(2);

ok(
  Pathfinding.getWalkProfile({ team: 'enemy', combatType: 'melee', type: 'goblin' }) === 'ES',
  'enemy walk profile matches worker grid key'
);

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 80), 'player bait on field');
ok(Game.creativeSpawnEnemyAt('goblin', cx.x, 80), 'spawn enemy on wave 2 map');

const enemySnap = Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.hp > 0);
const enemy = Game.getUnitById(enemySnap.id);
ok(enemy, 'resolve spawned enemy');

const x0 = enemy.x;
const y0 = enemy.y;
for (let i = 0; i < 120; i++) Game.update();

ok(enemy.path?.length > 0 || Math.hypot(enemy.x - x0, enemy.y - y0) > 8, 'enemy gets a path or moves toward player');
ok(Math.hypot(enemy.x - x0, enemy.y - y0) > 12, 'enemy advances after spawn ticks');

// Simulate outpost/build invalidation between waves (walk grids rebuilt on main thread).
Game.creativeSpawnPlayerAt('footman', cx.x + 120, cx.y + 40);
const enemy2Snap = Game.getUnitsSnapshot().find(
  (u) => u.team === 'enemy' && u.hp > 0 && u.id !== enemySnap.id
);
if (!enemy2Snap) {
  ok(Game.creativeSpawnEnemyAt('goblin', cx.x + 40, 72), 'second enemy for invalidation test');
}
const enemyB = Game.getUnitById(
  (enemy2Snap || Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.id !== enemySnap.id))
    ?.id
);
if (enemyB) {
  const bx0 = enemyB.x;
  const by0 = enemyB.y;
  Game.creativePlaceBuildingAt?.('outpost', cx.x - 60, cx.y + 20);
  for (let i = 0; i < 90; i++) Game.update();
  ok(
    enemyB.path?.length > 0 || Math.hypot(enemyB.x - bx0, enemyB.y - by0) > 8,
    'enemy still pathfinds after obstacle invalidation'
  );
} else {
  ok(false, 'second enemy for invalidation test');
}

if (failed) {
  console.error(`\n${failed} enemy-movement test(s) failed`);
  process.exit(1);
}
console.log('\nAll enemy-movement tests passed.');