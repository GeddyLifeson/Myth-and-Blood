/**
 * Attack orders: a click on an enemy with soldiers selected orders them onto it. They close
 * to their own reach, strike it before nearer enemies, and a plain move cancels the order.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(7);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const {
  Game,
  SpriteGen,
  GameState: GS,
  GameInput,
} = vm.runInContext(`${code}\n({ Game, SpriteGen, GameState, GameInput })`, vm.createContext(sb));
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.creativeForceDay?.();
Game.creativeSetWave?.(2);

const c = Game.getWorldCenter();
const mine = () => GS.units.filter((u) => u.team === 'player' && u.hp > 0);
const foes = () => GS.units.filter((u) => u.team === 'enemy' && u.hp > 0);
function soldier(type, x, y) {
  const before = new Set(mine().map((u) => u.id));
  Game.creativeSpawnPlayerAt(type, x, y);
  return mine().find((u) => !before.has(u.id));
}
function foe(type, x, y, hpMult) {
  const before = new Set(foes().map((u) => u.id));
  Game.creativeSpawnEnemyAt(type, x, y, { hpMult });
  const u = foes().find((f) => !before.has(f.id));
  // Stand still: the test is about who the soldiers choose, not about the chase.
  u.speed = 0;
  u.damage = 0;
  return u;
}
const toScreen = (u) => {
  const w0 = GameInput.screenToWorld(0, 0);
  const w1 = GameInput.screenToWorld(100, 100);
  return { sx: ((u.x - w0.x) / (w1.x - w0.x)) * 100, sy: ((u.y - w0.y) / (w1.y - w0.y)) * 100 };
};

const archers = [0, 1, 2].map((i) => soldier('archer', c.x - 30 + i * 30, c.y + 150));
const foot = soldier('footman', c.x, c.y + 120);
ok(archers.every(Boolean) && foot, 'three archers and a footman are fielded');

const near = foe('orc', c.x - 20, c.y + 60, 40);
const far = foe('orc', c.x + 120, c.y - 40, 40);
ok(near && far, 'two enemies stand on the field');

GS.selectedUnitIds = [...archers, foot].map((u) => u.id);
GS.selectedUnitId = foot.id;
const s = toScreen(far);
ok(Game.handleClick(s.sx, s.sy) === true, 'a click on an enemy with soldiers selected is taken');
ok(
  [...archers, foot].every((u) => u.attackOrderId === far.id),
  'every selected soldier is ordered onto that enemy'
);
ok(GS.selectedUnitIds.length === 4, 'the selection is kept');
ok(
  GS.attackMarks.some((m) => m.unitId === far.id),
  'the enemy is marked'
);
ok(!GS.moveMarkers.length, 'no move markers are left at the stops');

const farHp = far.hp;
const nearHp = near.hp;
for (let i = 0; i < 900; i++) Game.update();
ok(far.hp < farHp, `the ordered enemy is struck (${farHp} -> ${Math.round(far.hp)})`);
ok(
  farHp - far.hp > (nearHp - near.hp) * 3,
  `it takes the blows, not the nearer one (far -${Math.round(farHp - far.hp)}, near -${Math.round(nearHp - near.hp)})`
);
const reach = Math.max(...archers.map((u) => Math.hypot(u.x - far.x, u.y - far.y)));
ok(
  archers.every((u) => Math.hypot(u.x - far.x, u.y - far.y) > 40),
  `archers stop at bow range instead of walking into it (${Math.round(reach)} away)`
);
ok(Math.hypot(foot.x - far.x, foot.y - far.y) < 60, 'the footman closes to strike');

// A plain move cancels the order.
Game.moveSelectionToWorld(c.x, c.y + 180);
ok(
  [...archers, foot].every((u) => !u.attackOrderId),
  'a move elsewhere cancels the attack order'
);

// The order ends with the enemy.
GS.selectedUnitIds = archers.map((u) => u.id);
Game.attackSelection(near);
near.hp = 0;
for (let i = 0; i < 30; i++) Game.update();
ok(
  archers.every((u) => !u.attackOrderId),
  'the order ends when the enemy falls'
);

// Builders and healers are not sent to fight.
const healer = soldier('healer', c.x + 40, c.y + 170);
GS.selectedUnitIds = [healer.id];
ok(Game.attackSelection(far) === false && !healer.attackOrderId, 'a healer takes no attack order');

// With nothing selected a click on an enemy orders nobody.
GS.selectedUnitIds = [];
GS.selectedUnitId = null;
const s2 = toScreen(far);
Game.handleClick(s2.sx, s2.sy);
ok(
  mine().every((u) => !u.attackOrderId),
  'with nothing selected, clicking an enemy orders nobody'
);

if (failures()) process.exit(1);
console.log('attack orders: all passed');
