/**
 * Buildings are battlefield obstacles and siege targets (player vs enemy).
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

function boot() {
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
      createElement: () => ({ getContext: () => ctx2d(), style: {}, classList: { add: noop, remove: noop } }),
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
Game.setCreativeSetting?.('freeResources', true);
Game.setCreativeSetting?.('instantBuild', true);
Game.creativeForceDay?.();
Game.creativeSetWave?.(15);

const cx = Game.getWorldCenter();
ok(Game.creativeSpawnEnemyBuildingAt('enemy_trade_outpost', cx.x, 80), 'spawn enemy trade post');
const enemySnap = Game.getBuildingsSnapshot().find((b) => b.type === 'enemy_trade_outpost');
ok(enemySnap?.id, 'enemy building on field');
const enemyId = enemySnap.id;
const hp0 = enemySnap.hp;

ok(Game.creativeSpawnPlayerAt('footman', cx.x, 200), 'spawn footman south of enemy site');
const foot = Game.getUnitById(
  Game.getUnitsSnapshot().find((u) => u.type === 'footman' && u.team === 'player')?.id
);
ok(foot, 'resolve footman');
foot.huntMode = true;
foot.manualOrder = false;
// Place closer so path/combat budget is reliable under headless mocks.
foot.x = enemySnap.x;
foot.y = enemySnap.y + 50;

for (let i = 0; i < 400; i++) Game.update();
const enemyAfter = Game.getBuildingsSnapshot().find((b) => b.id === enemyId);
ok(enemyAfter && enemyAfter.hp < hp0, 'hunt-mode footman sieges enemy building from distance');

foot.hp = 0;
for (let i = 0; i < 8; i++) Game.update();

ok(Game.creativeSpawnPlayerBuildingAt('outpost', cx.x - 40, cx.y - 100), 'place player outpost');
const outSnap = Game.getBuildingsSnapshot().find((b) => b.type === 'outpost' && b.owner === 'player');
ok(outSnap?.complete, 'player outpost complete');

if (outSnap) {
  ok(Game.creativeSpawnEnemyAt('goblin', outSnap.x + 4, outSnap.y + 28), 'spawn enemy on outpost');
  const gob = Game.getUnitById(
    Game.getUnitsSnapshot().find((u) => u.team === 'enemy' && u.type === 'goblin')?.id
  );
  ok(gob, 'resolve goblin');
  if (gob) {
    gob.x = outSnap.x + 4;
    gob.y = outSnap.y + 26;
    gob.actionTimer = 0;
    gob.attackAnimTimer = 0;
    const opHp0 = outSnap.hp;
    for (let i = 0; i < 240; i++) Game.update();
    const outAfter = Game.getBuildingsSnapshot().find((b) => b.id === outSnap.id);
    ok(outAfter && outAfter.hp < opHp0, 'enemy damages player outpost in range');
  }
} else {
  ok(false, 'spawn enemy on outpost');
  ok(false, 'resolve goblin');
  ok(false, 'enemy damages player outpost in range');
}

if (failed) {
  console.error(`\n${failed} building-combat test(s) failed`);
  process.exit(1);
}
console.log('\nAll building-combat tests passed.');