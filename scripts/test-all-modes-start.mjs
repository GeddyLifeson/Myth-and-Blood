#!/usr/bin/env node
/**
 * Every selectable game mode should call Game.start without throwing.
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
  // planet_conquest removed with macro layers
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
function mkEl(id, tag = 'div') {
  const e = {
    id,
    tagName: tag.toUpperCase(),
    style: {},
    classList: { _s: new Set(), add(x) { this._s.add(x); }, remove(x) { this._s.delete(x); }, contains(x) { return this._s.has(x); }, toggle() {} },
    textContent: '',
    innerHTML: '',
    hidden: false,
    addEventListener: noop,
    appendChild: () => e,
    replaceChildren: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: () => null,
  };
  els.set(id, e);
  return e;
}
const cvs = mkEl('game-canvas', 'canvas');
cvs.width = 1280;
cvs.height = 720;
mkEl('menu-screen').classList.add('active');
mkEl('game-modes-picker');
mkEl('modes-leaderboard');
mkEl('onboarding-panel');
mkEl('online-multiplayer-panel');
mkEl('achievement-toast');

const sb = {
  console,
  JSON,
  Math,
  Array,
  Object,
  setTimeout: (fn) => { fn(); return 0; },
  clearTimeout: noop,
  requestAnimationFrame: (fn) => { fn(); return 0; },
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; } },
  performance: { now: () => 0 },
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: noop,
  document: {
    getElementById: (id) => els.get(id) || null,
    hidden: false,
    addEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  navigator: { maxTouchPoints: 0, clipboard: null },
};
sb.window = sb;
sb.self = sb;
sb.globalThis = sb;
sb.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop });

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, GameModes, SpriteGen } = vm.runInContext(`${code}\n({ Game, GameModes, SpriteGen })`, vm.createContext(sb));
SpriteGen.prewarmCache = () => {};

Game.init(cvs);
Game.setDifficulty('normal');
GameModes.init();

for (const modeId of MODES) {
  GameModes.setMenuMode(modeId);
  if (modeId === 'seed') GameModes.setMenuSeed('test-seed-42');
  if (modeId === 'academy_era') {
    const menu = GameModes.getMenu();
    menu.academyStartWave = 105;
  }
  let threw = null;
  try {
    Game.start();
  } catch (err) {
    threw = err;
  }
  const session = GameModes.getSession();
  ok(!threw, `${modeId}: start throws — ${threw?.message || ''}`);
  ok(Game.isPlaying?.(), `${modeId}: is playing`);
  ok(session?.modeId || session?.displayModeId, `${modeId}: session exists`);
  const gs = Game.getState?.();
  ok(gs?.state === 'playing', `${modeId}: state playing (wave ${gs?.wave})`);
  Game.quitToMenu?.();
  GameModes.endSession();
}

if (failed) {
  console.error(`\n${failed} all-modes test(s) failed`);
  process.exit(1);
}
console.log('\nAll mode start tests passed.');