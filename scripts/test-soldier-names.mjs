/** Soldier name pools: large, clean, unique per roll, and short enough for the honour label. */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const src = readFileSync(join(JS, 'soldier-names.js'), 'utf8');
const SoldierNames = vm.runInNewContext(`${src}\nSoldierNames`, { Math, Set });
const { FIRST, LAST } = SoldierNames;

ok(FIRST.length >= 200 && LAST.length >= 150, 'pools are large');
ok(new Set(FIRST).size === FIRST.length, 'no repeated first names');
ok(new Set(LAST).size === LAST.length, 'no repeated surnames');
ok(
  [...FIRST, ...LAST].every((n) => /^[A-Z][a-z]+$/.test(n)),
  'names are plain letters'
);
ok(
  Math.max(...FIRST.map((n) => n.length)) + Math.max(...LAST.map((n) => n.length)) <= 24,
  'pair length bounded'
);

const seen = new Set();
for (let i = 0; i < 3000; i++) seen.add(SoldierNames.roll());
ok(seen.size === 3000, '3000 rolls give 3000 different full names');
ok(
  [...seen].every((n) => n.split(' ').length === 2),
  'every name is a first and a last'
);

ok(HEADLESS_FILES.includes('soldier-names.js'), 'headless boot loads the module');
ok(
  readFileSync(join(JS, '..', 'index.html'), 'utf8').includes('js/soldier-names.js'),
  'index loads the module'
);
ok(/soldierName/.test(readFileSync(join(JS, 'game-save.js'), 'utf8')), 'saves carry the name');

// Game boot: every spawned soldier gets a name, and a veteran's title wraps it.
const noop = () => {};
const ctx2d = () =>
  new Proxy(
    {
      canvas: { width: 64, height: 64 },
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    },
    { get: (t, p) => (p in t ? t[p] : noop) }
  );
const cvs = {
  width: 1280,
  height: 720,
  getContext: () => ctx2d(),
  style: {},
  addEventListener: noop,
};
const sb = {
  console,
  JSON,
  Math,
  Array,
  Object,
  Set,
  Map,
  setTimeout: (fn) => (fn(), 0),
  clearTimeout: noop,
  requestAnimationFrame: (fn) => (fn(), 0),
  localStorage: { getItem: () => null, setItem: noop },
  performance: { now: () => 0 },
  AudioContext: null,
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: noop,
  document: {
    getElementById: () => cvs,
    hidden: false,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      getContext: () => ctx2d(),
      style: {},
      classList: { add: noop, remove: noop },
    }),
  },
  canvas: cvs,
  Image: function Image() {
    this.src = '';
  },
  OffscreenCanvas: function (w, h) {
    this.width = w;
    this.height = h;
    this.getContext = () => ctx2d();
  },
};
sb.window = sb;
sb.self = sb;
sb.globalThis = sb;
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join(';\n');
const { Game, SpriteGen, rollHonorName } = vm.runInContext(
  `${code}\n({ Game, SpriteGen, rollHonorName })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('freeResources', true);
Game.creativeForceDay?.();
const c = Game.getWorldCenter();
for (let i = 0; i < 6; i++)
  Game.creativeSpawnPlayerAt(i % 2 ? 'archer' : 'footman', c.x + i * 30, 300);
const mine = Game.getUnitsSnapshot().filter((u) => u.team === 'player');
ok(mine.length >= 6, 'soldiers spawned');
const names = mine.map((u) => Game.getUnitById(u.id).soldierName);
ok(
  names.every((n) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(n)),
  'every soldier has a first and last name'
);
ok(new Set(names).size === names.length, 'no two soldiers share a full name');
const honor = rollHonorName(Game.getUnitById(mine[0].id));
ok(
  honor.endsWith(names[0]) && honor.length <= 40,
  `honour name keeps the soldier's name: ${honor}`
);

process.exit(failures() ? 1 : 0);
