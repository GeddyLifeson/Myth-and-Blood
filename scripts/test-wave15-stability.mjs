/**
 * Wave 15 siege horde — ensure update loop stays responsive (no path/grid storm).
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

function el(id = '') {
  return {
    id,
    className: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
    style: { display: '' },
    textContent: '',
    innerHTML: '',
    hidden: false,
    dataset: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => el(),
    querySelectorAll: () => [],
    appendChild: (c) => c,
    getContext: () => null,
  };
}

function boot() {
  const noop = () => {};
  const cvs = {
    width: 1280,
    height: 720,
    getContext: () => null,
    style: {},
    addEventListener: noop,
  };
  const sb = {
    console,
    JSON,
    Math,
    Array,
    Object,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: noop,
    requestAnimationFrame: (fn) => {
      fn();
      return 0;
    },
    localStorage: { getItem: () => null, setItem: noop },
    performance: { now: () => Date.now() },
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: noop,
    document: {
      getElementById: (id) => el(id),
      hidden: false,
      querySelector: () => el(),
      querySelectorAll: () => [],
    },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs };
}

const { sb, cvs } = boot();
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen } = vm.runInContext(`${code}\n({ Game, SpriteGen })`, vm.createContext(sb));
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.creativeForceDay?.();
Game.creativeSetWave?.(15);

const cx = Game.getWorldCenter();
for (let i = 0; i < 6; i++) {
  Game.creativeSpawnEnemyAt?.('goblin_engineer', cx.x - 40 + i * 14, cx.y - 200);
  Game.creativeSpawnEnemyAt?.('goblin_sapper', cx.x + 20 + i * 12, cx.y - 180);
}
Game.creativeSpawnEnemyBuildingAt?.('enemy_trade_outpost', cx.x, 80);
for (let i = 0; i < 10; i++) {
  Game.creativeSpawnPlayerAt?.('footman', cx.x - 60 + i * 12, cx.y);
  Game.creativeSpawnPlayerAt?.('archer', cx.x - 50 + i * 12, cx.y + 20);
}
for (const u of Game.getUnitsSnapshot().filter((u) => u.team === 'player')) {
  const unit = Game.getUnitById(u.id);
  if (unit) unit.huntMode = true;
}

const t0 = performance.now();
let maxTickMs = 0;
for (let tick = 0; tick < 900; tick++) {
  const s0 = performance.now();
  Game.update();
  const dt = performance.now() - s0;
  if (dt > maxTickMs) maxTickMs = dt;
}
const elapsed = performance.now() - t0;

ok(Game.getState().wave === 15, 'wave 15 scenario');
ok(maxTickMs < 120, `max tick ${maxTickMs.toFixed(1)}ms stays under 120ms`);
ok(elapsed < 12000, `wave 15 window ${elapsed.toFixed(0)}ms total under 12s`);

if (failed) {
  console.error(`\n${failed} wave-15 stability test(s) failed`);
  process.exit(1);
}
console.log('\nAll wave-15 stability tests passed.');