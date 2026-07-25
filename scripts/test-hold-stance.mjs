/**
 * Hold posts (Thronefall-style): with HUNT off, soldiers get an assigned station.
 * They hard-plant on station, walk back if displaced, and only leave on player move orders.
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

const { sb, cvs } = boot(11);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen } = vm.runInContext(
  `${code}\n({ Game, SpriteGen })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);

Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.setCreativeSetting?.('instantBuild', true);
Game.creativeForceDay?.();
Game.creativeSetWave?.(2);

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 30), 'spawn footman A');
ok(Game.creativeSpawnPlayerAt('footman', cx.x + 10, cx.y + 30), 'spawn footman B (crowding)');
const units = Game.getUnitsSnapshot().filter((u) => u.type === 'footman' && u.team === 'player');
ok(units.length >= 2, 'two footmen on field');
const a = Game.getUnitById(units[0].id);
const b = Game.getUnitById(units[1].id);

// Ensure hunt is on first, then plant residual chase state, then hold.
if (!Game.getState().globalHunt) Game.toggleGlobalHunt();
ok(Game.getState().globalHunt, 'hunt starts ON');

// Fake a residual combat path so hold must clear it.
a.path = [
  { x: a.x + 120, y: a.y - 80 },
  { x: a.x + 160, y: a.y - 120 },
];
a.pathIndex = 0;
a.targetX = a.x + 160;
a.targetY = a.y - 120;
a.combatTargetId = 99999;
a.huntMode = true;
a.manualOrder = false;

Game.toggleGlobalHunt();
ok(!Game.getState().globalHunt, 'global hunt OFF = hold');
ok(a.manualOrder && !a.huntMode, 'A enters hold stance flags');
ok(Number.isFinite(a.holdX) && Number.isFinite(a.holdY), 'A has assigned hold post');
ok(!a.path?.length || a.pathTargetId === 'hold', 'hold clears residual chase path');
ok(a.combatTargetId == null, 'hold clears combat target');

const ax0 = a.holdX ?? a.x;
const ay0 = a.holdY ?? a.y;
const bx0 = b.holdX ?? b.x;
const by0 = b.holdY ?? b.y;

// Spawn an enemy in range of chase interest — hold must not walk toward it.
Game.creativeSpawnEnemyAt?.('zombie', a.x + 90, a.y - 40);
for (let i = 0; i < 90; i++) Game.update();

const driftA = Math.hypot(a.x - ax0, a.y - ay0);
const driftB = Math.hypot(b.x - bx0, b.y - by0);
ok(driftA <= 3, `holder A stays put under crowd/enemy pressure (drift=${driftA.toFixed(2)})`);
ok(driftB <= 3, `holder B stays put under crowd pressure (drift=${driftB.toFixed(2)})`);
ok(!a.huntMode && a.manualOrder, 'A still holding after sim ticks');

// Player order must still move them.
ok(Game.selectUnit(a.id), 'select holder A');
const destX = ax0 - 70;
const destY = ay0 + 10;
ok(Game.moveSelectionToWorld(destX, destY), 'player move order while holding');
ok(a.manualOrder && !a.huntMode, 'move order keeps manual + hunt off');
ok(a.path?.length > 0 || Math.hypot(a.x - destX, a.y - destY) > 8, 'path or progress toward order');

let moved = false;
for (let i = 0; i < 120; i++) {
  Game.update();
  if (Math.hypot(a.x - ax0, a.y - ay0) > 12) {
    moved = true;
    break;
  }
}
ok(moved, 'holder marches when player orders a move');

// After arrival with hunt still off, plant again.
for (let i = 0; i < 180; i++) Game.update();
const nearDest = Math.hypot(a.x - destX, a.y - destY) <= 18;
ok(nearDest || a.manualOrder, 'arrived or still finishing order');
if (nearDest) {
  const hx = a.holdX ?? a.x;
  const hy = a.holdY ?? a.y;
  for (let i = 0; i < 60; i++) Game.update();
  const postDrift = Math.hypot(a.x - hx, a.y - hy);
  ok(postDrift <= 3, `after arrival stays planted (drift=${postDrift.toFixed(2)})`);
  ok(!a.huntMode, 'still not hunting after arrival with hunt off');
}

// Thronefall return: if shoved off post, walk back home.
const stationX = a.holdX ?? a.x;
const stationY = a.holdY ?? a.y;
a.x = stationX + 55;
a.y = stationY + 40;
let returned = false;
for (let i = 0; i < 160; i++) {
  Game.update();
  if (Math.hypot(a.x - stationX, a.y - stationY) <= 6) {
    returned = true;
    break;
  }
}
ok(returned, 'displaced holder returns to assigned post');
ok(Math.hypot(a.x - stationX, a.y - stationY) <= 6, 'snapped onto hold post after return');

if (failed) {
  console.error(`\n${failed} hold-stance test(s) failed`);
  process.exit(1);
}
console.log('\nAll hold-stance tests passed.');
