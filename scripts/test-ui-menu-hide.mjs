#!/usr/bin/env node
/**
 * Menu overlay must hide when starting any game mode (UI.hideMenusForPlay + Game.start).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

const MODES = [
  'campaign',
  'survival',
  'roguelike',
  'timed',
  'seed',
  'academy_era',
  'planet_conquest',
  'pve_horde',
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const noop = () => {};
const els = new Map();
const rafQueue = [];
const timeoutQueue = [];
function drainRaf() {
  while (rafQueue.length) {
    const batch = rafQueue.splice(0, rafQueue.length);
    for (const fn of batch) fn();
  }
  while (timeoutQueue.length) {
    const batch = timeoutQueue.splice(0, timeoutQueue.length);
    for (const fn of batch) fn();
  }
}

function mkEl(id, tag = 'div') {
  const e = {
    id,
    tagName: tag.toUpperCase(),
    style: {},
    classList: {
      _s: new Set(),
      add(x) {
        this._s.add(x);
      },
      remove(x) {
        this._s.delete(x);
      },
      contains(x) {
        return this._s.has(x);
      },
      toggle(x, force) {
        if (force === false) this._s.delete(x);
        else if (force === true) this._s.add(x);
        else this._s.has(x) ? this._s.delete(x) : this._s.add(x);
      },
    },
    textContent: '',
    innerHTML: '',
    hidden: false,
    addEventListener: noop,
    appendChild: () => e,
    replaceChildren: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: () => null,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  };
  els.set(id, e);
  return e;
}

const body = {
  classList: {
    _s: new Set(),
    add(x) {
      this._s.add(x);
    },
    remove(x) {
      this._s.delete(x);
    },
    contains(x) {
      return this._s.has(x);
    },
    toggle(x, force) {
      if (force === false) this._s.delete(x);
      else if (force === true) this._s.add(x);
      else this._s.has(x) ? this._s.delete(x) : this._s.add(x);
    },
  },
  getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
};

const cvs = mkEl('game-canvas', 'canvas');
cvs.width = 1280;
cvs.height = 720;
mkEl('menu-screen', 'div').classList.add('active');
mkEl('pause-screen');
mkEl('gameover-screen');
mkEl('settings-screen');
mkEl('achievements-screen');
mkEl('advanced-diff-screen');
mkEl('cheats-screen');
mkEl('encyclopedia-screen');
mkEl('crossover-screen');
mkEl('wwe-screen');
mkEl('howto-panel');
mkEl('game-modes-picker');
mkEl('modes-leaderboard');
mkEl('onboarding-panel');
mkEl('online-multiplayer-panel');
mkEl('achievement-toast');
mkEl('diff-tagline');
mkEl('advanced-diff-pct');
mkEl('title-art', 'canvas');

const OVERLAY_SCREEN_IDS = [
  'menu-screen',
  'pause-screen',
  'gameover-screen',
  'settings-screen',
  'achievements-screen',
  'advanced-diff-screen',
  'cheats-screen',
  'encyclopedia-screen',
  'crossover-screen',
  'wwe-screen',
];

function dismissMenuScreen() {
  const menu = els.get('menu-screen');
  if (!menu) return;
  menu.classList.remove('active');
  menu.classList.add('menu-dismissed');
  menu.hidden = true;
  menu.style.display = 'none';
}

function hideMenusForPlay() {
  body.classList.toggle('game-playing', true);
  body.classList.toggle('menu-dismissed', true);
  dismissMenuScreen();
  for (const id of OVERLAY_SCREEN_IDS) {
    els.get(id)?.classList.remove('active');
  }
}

function ensureMenuDismissedForPlay() {
  if (!Game.isPlaying?.()) return;
  body.classList.toggle('game-playing', true);
  body.classList.toggle('menu-dismissed', true);
  dismissMenuScreen();
}

function showMainMenu() {
  for (const id of OVERLAY_SCREEN_IDS) {
    els.get(id)?.classList.remove('active');
  }
  body.classList.toggle('game-playing', false);
  body.classList.toggle('menu-dismissed', false);
  const menu = els.get('menu-screen');
  menu?.classList.remove('menu-dismissed');
  menu.hidden = false;
  menu.style.display = '';
  menu?.classList.add('active');
}

const sb = {
  console,
  JSON,
  Math,
  Array,
  Object,
  setTimeout: (fn) => {
    timeoutQueue.push(fn);
    return timeoutQueue.length;
  },
  clearTimeout: noop,
  requestAnimationFrame: (fn) => {
    rafQueue.push(fn);
    return rafQueue.length;
  },
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; } },
  performance: { now: () => 0 },
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: noop,
  document: {
    body,
    getElementById: (id) => els.get(id) || null,
    hidden: false,
    addEventListener: noop,
    querySelector: (sel) => {
      if (sel === '.diff-btn.selected') return { dataset: { diff: 'normal' } };
      return null;
    },
    querySelectorAll: () => [],
  },
  navigator: { maxTouchPoints: 0, clipboard: null },
  UI: { hideMenusForPlay, ensureMenuDismissedForPlay, showMainMenu },
};
sb.window = sb;
sb.self = sb;
sb.globalThis = sb;
sb.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop });

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, GameModes, SpriteGen } = vm.runInContext(
  `${code}\n({ Game, GameModes, SpriteGen })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};

Game.init(cvs);
Game.setDifficulty('normal');
GameModes.init();

function menuHidden() {
  const menu = els.get('menu-screen');
  return (
    !menu?.classList.contains('active') &&
    menu?.classList.contains('menu-dismissed') &&
    menu?.style.display === 'none' &&
    body.classList.contains('game-playing')
  );
}

for (const modeId of MODES) {
  GameModes.setMenuMode(modeId);
  if (modeId === 'seed') GameModes.setMenuSeed('test-seed-42');
  if (modeId === 'academy_era') GameModes.getMenu().academyStartWave = 105;

  els.get('menu-screen')?.classList.add('active');
  body.classList.toggle('game-playing', false);

  hideMenusForPlay();
  ok(menuHidden(), `${modeId}: hideMenusForPlay clears menu`);

  let threw = null;
  try {
    Game.start();
  } catch (err) {
    threw = err;
  }
  ok(!threw, `${modeId}: Game.start — ${threw?.message || ''}`);
  ok(menuHidden(), `${modeId}: menu still hidden after Game.start`);

  Game.quitToMenu?.();
  GameModes.endSession();
  ok(els.get('menu-screen')?.classList.contains('active'), `${modeId}: quitToMenu restores menu`);
}

// beginDefense path uses rAF + setTimeout(0) before Game.start
els.get('menu-screen')?.classList.add('active');
body.classList.toggle('game-playing', false);
GameModes.setMenuMode('planet_conquest');
hideMenusForPlay();
ok(menuHidden(), 'planet_conquest: pre-start menu hidden');
drainRaf();
drainRaf();
ok(menuHidden(), 'planet_conquest: menu hidden after paint defer frames');

// Partial boot: state=playing before throw must not restore the menu (regression guard).
GameModes.setMenuMode('planet_conquest');
els.get('menu-screen')?.classList.add('active');
els.get('menu-screen').classList.remove('menu-dismissed');
els.get('menu-screen').style.display = '';
body.classList.toggle('game-playing', false);
hideMenusForPlay();
const realStart = Game.start;
Game.start = () => {
  realStart();
  throw new Error('simulated post-bootstrap fault');
};
let partialErr = null;
try {
  Game.start();
} catch (err) {
  partialErr = err;
}
ok(!!partialErr, 'partial boot: simulated throw');
ok(Game.isPlaying?.(), 'partial boot: still playing after throw');
if (Game.isPlaying?.()) ensureMenuDismissedForPlay();
ok(menuHidden(), 'partial boot: menu stays hidden after mid-start throw');
Game.start = realStart;
Game.quitToMenu?.();
GameModes.endSession();

// Settings opened mid-run must not be closed by per-frame menu guard (planet conquest regression).
GameModes.setMenuMode('planet_conquest');
els.get('menu-screen')?.classList.add('active');
body.classList.toggle('game-playing', false);
hideMenusForPlay();
Game.start();
els.get('settings-screen')?.classList.add('active');
if (Game.isPlaying?.()) ensureMenuDismissedForPlay();
ok(
  els.get('settings-screen')?.classList.contains('active'),
  'planet_conquest: settings overlay stays open during play'
);
ok(menuHidden(), 'planet_conquest: menu still hidden while settings open');
Game.quitToMenu?.();
GameModes.endSession();

if (failed) {
  console.error(`\n${failed} UI menu-hide test(s) failed`);
  process.exit(1);
}
console.log('\nAll UI menu-hide tests passed.');