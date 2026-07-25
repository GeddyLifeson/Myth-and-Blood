/**
 * Outpost garrison — ranged allies must reach slots on blocksMove:false outposts.
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
    performance: { now: () => 0 },
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: noop,
    document: { getElementById: () => cvs, hidden: false },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs };
}

const { sb, cvs } = boot();
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const ctx = vm.runInContext(
  `${code}\n({ Game, SpriteGen, terrainBlockRadius, terrainLosRadius })`,
  vm.createContext(sb)
);
const { Game, SpriteGen, terrainBlockRadius, terrainLosRadius } = ctx;
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.setCreativeSetting?.('instantBuild', true);
Game.creativeForceDay?.();

const outpostObs = {
  radius: 22,
  blocksMove: false,
  blocksLOS: true,
  complete: true,
  buildProgress: 120,
  buildTime: 120,
  hp: 200,
};
ok(terrainBlockRadius(outpostObs) === 0, 'outpost does not block movement');
ok(terrainLosRadius(outpostObs) > 0, 'outpost still blocks LOS');

const cx = Game.getWorldCenter();
const outpostY = cx.y - 100;
ok(Game.creativeSpawnPlayerBuildingAt('outpost', cx.x, outpostY), 'spawn outpost');
const op = Game.getBuildingsSnapshot().find((b) => b.type === 'outpost' && b.owner === 'player');
ok(op?.complete, 'outpost complete');

ok(Game.creativeSpawnPlayerAt('archer', cx.x + 90, outpostY + 50), 'spawn archer');
const archerSnap = Game.getUnitsSnapshot().find((u) => u.type === 'archer' && u.team === 'player');
const archerId = archerSnap?.id;
ok(archerId, 'archer on field');
const archer = archerId ? Game.getUnitById(archerId) : null;
ok(archer, 'archer resolves by id');

let garrisoned = false;
if (archer && op) {
  for (let i = 0; i < 800; i++) {
    Game.update();
    if (archer.garrisoned === op.id) {
      garrisoned = true;
      break;
    }
  }
}
ok(garrisoned, 'archer garrisons outpost within 800 ticks');

// Mage flee / retreat must not rubber-band against outpost snap logic
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.setCreativeSetting?.('instantBuild', true);
Game.creativeForceDay?.();
const cx2 = Game.getWorldCenter();
const opY = cx2.y - 100;
ok(Game.creativeSpawnPlayerBuildingAt('outpost', cx2.x, opY), 'spawn outpost for mage flee test');
ok(Game.creativeSpawnPlayerBuildingAt('medical_tent', cx2.x - 120, cx2.y), 'spawn med tent');
ok(Game.creativeSpawnPlayerAt('mage', cx2.x + 24, opY), 'spawn mage');
const mage = Game.getUnitById(Game.getUnitsSnapshot().find((u) => u.type === 'mage' && u.team === 'player')?.id);
ok(mage, 'mage resolves by id');
for (let i = 0; i < 180; i++) Game.update();
ok(mage.garrisoned, 'mage garrisons outpost');

const startY = mage.y;
mage.fleeing = true;
mage.fleeTicks = 0;
mage.path = [];
mage.pathIndex = 0;
const fleeYs = [];
for (let i = 0; i < 40; i++) {
  Game.update();
  fleeYs.push(mage.y);
}
ok(!mage.garrisoned, 'fleeing mage leaves outpost garrison');
ok(mage.y > startY + 18, 'fleeing mage moves south');
ok(
  fleeYs.filter((y, i) => i > 0 && y < fleeYs[i - 1] - 0.5).length === 0,
  'fleeing mage does not rubber-band'
);

Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.setCreativeSetting?.('instantBuild', true);
Game.creativeForceDay?.();
const cx3 = Game.getWorldCenter();
const opY3 = cx3.y - 100;
Game.creativeSpawnPlayerBuildingAt('outpost', cx3.x, opY3);
Game.creativeSpawnPlayerBuildingAt('medical_tent', cx3.x - 120, cx3.y);
Game.creativeSpawnPlayerAt('mage', cx3.x + 24, opY3);
const mage2 = Game.getUnitById(
  Game.getUnitsSnapshot().find((u) => u.type === 'mage' && u.team === 'player')?.id
);
for (let i = 0; i < 180; i++) Game.update();
mage2.hp = Math.floor(mage2.maxHp * 0.2);
Game.takeDamage(mage2, 1);
const retreatYs = [mage2.y];
for (let i = 0; i < 60; i++) {
  Game.update();
  retreatYs.push(mage2.y);
}
ok(mage2.retreatingToMed, 'wounded garrisoned mage begins med retreat');
ok(!mage2.garrisoned, 'retreating mage is not re-snapped to garrison');
ok(
  retreatYs[retreatYs.length - 1] > retreatYs[0] + 12,
  'retreating mage marches away from outpost'
);
ok(
  retreatYs.filter((y, i) => i > 0 && y < retreatYs[i - 1] - 0.5).length === 0,
  'retreating mage does not rubber-band'
);

if (failed) {
  console.error(`\n${failed} outpost-garrison test(s) failed`);
  process.exit(1);
}
console.log('\nAll outpost-garrison tests passed.');