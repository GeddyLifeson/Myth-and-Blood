/**
 * Options > Left drag pans the map. Off (the default): a left drag box-selects and never moves
 * the view, even over a soldier or with one selected; middle drag still pans. On: the old pan.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const flags = { leftDragPan: false };
const { sb, cvs } = boot(11);
sb.Settings = {
  get: (k) => flags[k],
  getPanelInsets: () => ({ left: 60, right: 56, top: 46, bottom: 36 }),
};
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen, GameState } = vm.runInContext(
  `${code}\n({ Game, SpriteGen, GameState })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.creativeForceDay?.();

// Zoomed in so the camera has room to move; the soldier stands in the middle of the view.
Game.zoomCameraToScale(640, 360, 2.5);
Game.panCameraToFraction(0.5, 0.5);
ok(
  Game.creativeSpawnPlayerAt('footman', GameState.cameraWorldX, GameState.cameraWorldY),
  'spawn footman'
);
const foot = Game.getUnitById(
  Game.getUnitsSnapshot().find((u) => u.type === 'footman' && u.team === 'player').id
);
// Centre of the field between the default panel insets (60/56 sides, 46/36 top and bottom).
const mid = [642, 365];

const cam = () => ({ x: GameState.cameraWorldX, y: GameState.cameraWorldY });
const moved = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > 1;
const drag = (button, opts, from, to) => {
  Game.handlePointerDown(from[0], from[1], button, opts);
  Game.handlePointerMove((from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  Game.handlePointerMove(to[0], to[1]);
  return Game.handlePointerUp();
};
const mouseLeft = { emptyDragSelect: true, dragThreshold: 14 };
const middle = { pan: true, dragThreshold: 14 };

Game.selectUnit(foot.id);
let c0 = cam();
drag(0, mouseLeft, [300, 300], [700, 500]);
ok(!moved(c0, cam()), 'off: left drag on empty ground with a selection does not pan');

c0 = cam();
drag(0, mouseLeft, mid, [900, 600]);
ok(!moved(c0, cam()), 'off: left drag starting on a soldier does not pan');

Game.clearSelection();
drag(0, mouseLeft, [100, 100], [1200, 700]);
ok(Game.getSelectedUnitsInfo().length >= 1, 'off: left drag box-selects the soldier');

Game.clearSelection();
Game.handlePointerDown(mid[0], mid[1], 0, mouseLeft);
ok(Game.handlePointerUp() === true, 'off: an unmoved left press still counts as a click');

c0 = cam();
drag(0, middle, mid, [400, 200]);
ok(moved(c0, cam()), `off: middle drag still pans (${JSON.stringify([c0, cam()])})`);

flags.leftDragPan = true;
Game.selectUnit(foot.id);
c0 = cam();
drag(0, mouseLeft, [700, 400], [500, 300]);
ok(moved(c0, cam()), 'on: left drag with a selection pans as before');

if (failures()) process.exit(1);
console.log('left-click-select: all ok');
