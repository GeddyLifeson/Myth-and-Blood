/**
 * Terrain is rolled once at wave 1; night transitions must not reshuffle decorations.
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
      getContext: () => null,
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

const { sb, cvs } = boot(55);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen } = vm.runInContext(`${code}\n({ Game, SpriteGen })`, vm.createContext(sb));

SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.creativeForceDay?.();

const decoSig = () =>
  Game.getDecorationsSnapshot()
    .filter((d) => d.type === 'tree' || d.type === 'rock')
    .map((d) => `${d.type}:${Math.round(d.x)}:${Math.round(d.y)}`)
    .sort()
    .join('|');

const afterWave1 = decoSig();
ok(afterWave1.length > 0, 'wave 1 has terrain decorations');

Game.creativeClearEnemies?.();
for (let i = 0; i < 6; i++) Game.update();
Game.creativeForceNight?.();
ok(Game.isNightPhase(), 'night after wave 1');

const duringNight = decoSig();
ok(duringNight === afterWave1, 'night prep keeps same decoration layout');

Game.creativeForceDay?.();
ok(Game.getState().wave === 2, 'wave 2 started');
const afterWave2 = decoSig();
ok(afterWave2 === afterWave1, 'wave 2 dawn does not reshuffle existing terrain');

if (failed) {
  console.error(`\n${failed} terrain-persistence test(s) failed`);
  process.exit(1);
}
console.log('\nAll terrain-persistence tests passed.');