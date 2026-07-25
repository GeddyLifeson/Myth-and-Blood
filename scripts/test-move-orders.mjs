/**
 * Move-order contracts — build mode must not block moves when units are selected.
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

/** Mirrors handleClick ground-click priority after demolish/move-building/rotate. */
function resolveGroundClickIntent({ hasUnitSelection, selectedBuild }) {
  if (hasUnitSelection) return 'move';
  if (selectedBuild) return 'build';
  return 'noop';
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

{
  ok(
    resolveGroundClickIntent({ hasUnitSelection: true, selectedBuild: 'outpost' }) === 'move',
    'ground click with selection moves even if build mode is armed'
  );
  ok(
    resolveGroundClickIntent({ hasUnitSelection: false, selectedBuild: 'outpost' }) === 'build',
    'ground click without selection still places buildings'
  );
}

const { sb, cvs } = boot(7);
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
ok(Game.creativeSpawnPlayerAt('footman', cx.x, cx.y + 40), 'spawn footman');
const snap = Game.getUnitsSnapshot().find((u) => u.type === 'footman' && u.team === 'player');
const foot = Game.getUnitById(snap.id);
ok(foot, 'resolve footman');

ok(Game.selectUnit(foot.id), 'select footman');
ok(Game.moveSelectionToWorld(cx.x - 80, cx.y + 20), 'move order applies to selection');
ok(foot.manualOrder, 'footman received manual order');
ok(foot.path?.length > 0, 'footman path assigned');

const x0 = foot.x;
const y0 = foot.y;
for (let i = 0; i < 90; i++) Game.update();
ok(Math.hypot(foot.x - x0, foot.y - y0) > 6, 'footman actually moves along path');

Game.selectBuild('outpost');
ok(Game.getState().selectedBuild === 'outpost', 'build mode armed');
ok(Game.selectUnit(foot.id), 'selecting unit clears stale build mode');
ok(Game.getState().selectedBuild === null, 'selectUnit clears build placement mode');

ok(Game.creativeSpawnPlayerAt('healer', cx.x - 40, cx.y + 60), 'spawn healer');
const healerSnap = Game.getUnitsSnapshot().find((u) => u.type === 'healer' && u.team === 'player');
const healer = Game.getUnitById(healerSnap?.id);
ok(healer, 'resolve healer');
ok(Game.creativeSpawnPlayerAt('footman', cx.x + 50, cx.y + 50), 'spawn wounded bait');
const baitSnap = Game.getUnitsSnapshot().find(
  (u) => u.type === 'footman' && u.team === 'player' && u.id !== snap?.id
);
const bait = Game.getUnitById(baitSnap?.id);
ok(bait, 'resolve wounded bait');
Game.takeDamage(bait, Math.floor(bait.maxHp * 0.45));
ok(bait.hp < bait.maxHp, 'bait is wounded');

ok(Game.selectUnit(healer.id), 'select healer');
ok(Game.moveSelectionToWorld(cx.x - 120, cx.y - 40), 'manual move healer away from wounded');
ok(healer.manualOrder, 'healer has manual order');

let manualCleared = false;
for (let i = 0; i < 120; i++) {
  Game.update();
  if (!healer.manualOrder) {
    manualCleared = true;
    break;
  }
}
ok(manualCleared, 'healer manual order clears after reaching destination');

let resumedHealPath = false;
const baitX = bait.x;
const baitY = bait.y;
for (let i = 0; i < 120; i++) {
  Game.update();
  if (healer.path?.length > 0 && healer.healTargetId === bait.id) {
    resumedHealPath = true;
    break;
  }
  if (Math.hypot(healer.x - baitX, healer.y - baitY) < (healer.range || 80) * 0.95) {
    resumedHealPath = true;
    break;
  }
}
ok(resumedHealPath, 'healer auto-paths toward wounded ally after manual move');

// Click-to-move: ground click must not clear selection before handleClick runs.
Game.selectUnit(foot.id);
const selBefore = Game.getSelectedUnitsInfo?.()?.length ?? 1;
const clickSx = 640;
const clickSy = 360;
Game.handlePointerDown(clickSx, clickSy, 0, { emptyDragSelect: true });
const wasClick = Game.handlePointerUp();
ok(wasClick, 'ground tap registers as click not drag');
const selAfterUp = Game.getSelectedUnitsInfo?.()?.length ?? 0;
ok(selAfterUp >= selBefore, 'selection survives ground click for move order');
ok(Game.handleClick(clickSx, clickSy), 'handleClick issues move on ground');
ok(foot.manualOrder, 'click move sets manual order');
const fx0 = foot.x;
const fy0 = foot.y;
for (let i = 0; i < 90; i++) Game.update();
ok(Math.hypot(foot.x - fx0, foot.y - fy0) > 6, 'click-issued move advances unit');

// Manual orders must soft-pass through allies, enemies, and props — not freeze mid-route.
const marcherOk = Game.creativeSpawnPlayerAt('footman', cx.x - 100, cx.y + 100);
ok(marcherOk, 'spawn crowd-march footman');
const marcherSnap = Game.getUnitsSnapshot().find(
  (u) => u.type === 'footman' && u.team === 'player' && u.id !== foot.id && u.id !== bait?.id
);
const marcher = Game.getUnitById(marcherSnap?.id);
ok(marcher, 'resolve crowd-march footman');

// Pack allies and enemies in a corridor between start and destination.
const gateY = marcher.y - 50;
for (let i = 0; i < 6; i++) {
  Game.creativeSpawnPlayerAt('footman', marcher.x - 18 + i * 8, gateY);
}
for (let i = 0; i < 4; i++) {
  Game.creativeSpawnEnemyAt('zombie', marcher.x - 10 + i * 10, gateY - 18);
}
// Solid-ish props near the line of march.
Game.placeDecorationSnapshot?.({
  type: 'rock',
  x: marcher.x + 24,
  y: gateY - 8,
  radius: 16,
  blocksMove: true,
  hp: 999,
});

const destX = marcher.x;
const destY = marcher.y - 160;
const mx0 = marcher.x;
const my0 = marcher.y;
ok(Game.selectUnit(marcher.id), 'select crowd-march footman');
ok(Game.moveSelectionToWorld(destX, destY), 'order march through crowd');
ok(marcher.manualOrder, 'crowd march has manual order');

let advancedThroughCrowd = false;
let maxProgress = 0;
for (let i = 0; i < 220; i++) {
  Game.update();
  const progress = my0 - marcher.y; // destination is north (lower y)
  if (progress > maxProgress) maxProgress = progress;
  if (progress > 40) {
    advancedThroughCrowd = true;
    break;
  }
}
ok(
  advancedThroughCrowd,
  `manual march advances through allies/enemies (progress=${maxProgress.toFixed(1)})`
);
ok(
  marcher.manualOrder || Math.hypot(marcher.x - destX, marcher.y - destY) <= 18,
  'manual order still active or unit reached destination through crowd'
);

if (failed) {
  console.error(`\n${failed} move-order test(s) failed`);
  process.exit(1);
}
console.log('\nAll move-order tests passed.');