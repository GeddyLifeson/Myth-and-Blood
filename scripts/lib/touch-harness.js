// Electron main for scripts/test-touch-input.mjs: loads index.html at phone size with touch
// events on, plays real TouchEvents on the canvas and prints one line `TOUCH_RESULT {json}`.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.join(__dirname, '..', '..');
const width = Number(process.env.TOUCH_W) || 390;
const height = Number(process.env.TOUCH_H) || 844;

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'mb-touch-')));
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('touch-events', 'enabled');
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const PAGE = String.raw`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { errors: [] };
const GS = GameState;
const canvas = document.getElementById('game-canvas');
let nextId = 1;
const mk = (id, x, y) => new Touch({ identifier: id, target: canvas, clientX: x, clientY: y });
function fire(type, active, changed) {
  canvas.dispatchEvent(
    new TouchEvent(type, {
      touches: active, targetTouches: active, changedTouches: changed,
      bubbles: true, cancelable: true,
    })
  );
}
async function tap(x, y, holdMs = 40) {
  const t = mk(nextId++, x, y);
  fire('touchstart', [t], [t]);
  await sleep(holdMs);
  fire('touchend', [], [t]);
  await sleep(60);
}
async function drag(x0, y0, x1, y1, steps = 8) {
  const id = nextId++;
  let t = mk(id, x0, y0);
  fire('touchstart', [t], [t]);
  for (let i = 1; i <= steps; i++) {
    t = mk(id, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    fire('touchmove', [t], [t]);
    await sleep(16);
  }
  fire('touchend', [], [t]);
  await sleep(60);
}
async function pinch(cx, cy, d0, d1, steps = 8) {
  const a = nextId++, b = nextId++;
  const pts = (d) => [mk(a, cx - d / 2, cy), mk(b, cx + d / 2, cy)];
  let p = pts(d0);
  fire('touchstart', [p[0]], [p[0]]);
  fire('touchstart', p, [p[1]]);
  for (let i = 1; i <= steps; i++) {
    p = pts(d0 + ((d1 - d0) * i) / steps);
    fire('touchmove', p, p);
    await sleep(16);
  }
  fire('touchend', [p[0]], [p[1]]);
  fire('touchend', [], [p[0]]);
  await sleep(60);
}
const toScreen = (u) => ({ x: GS.viewX + u.x * GS.viewScale, y: GS.viewY + u.y * GS.viewScale });
const selected = () => (GS.selectedUnitIds.length ? GS.selectedUnitIds : GS.selectedUnitId ? [GS.selectedUnitId] : []);

Game.setDifficulty('normal');
Game.start();
await sleep(700);
document.getElementById('tutorial-dismiss')?.click();
GS.spawnQueue.length = 0;
for (const u of GS.units) if (u.team === 'enemy') u.hp = 0;
for (let i = 0; i < 400 && GS.timeOfDay !== 'night'; i++) await sleep(100);
await sleep(600);
for (const el of document.querySelectorAll('.tutorial-callout, #achievement-toast')) el.style.display = 'none';

out.mobile = MobileUI.isActive();
out.zoomAtStart = Game.getCameraZoom();
const vp = Settings.getPanelInsets();
const mapBottom = GS.viewY + (GS.worldH + 50) * GS.viewScale;
out.fieldFills =
  GS.viewX <= vp.left + 1 &&
  GS.viewX + GS.worldW * GS.viewScale >= canvas.width - vp.right - 1 &&
  GS.viewY <= vp.top + 1 &&
  mapBottom >= canvas.height - vp.bottom - 1;

// Select: tap a soldier.
const u = GS.units.find((x) => x.team === 'player' && x.hp > 0 && toScreen(x).y > vp.top + 130 && toScreen(x).y < canvas.height - vp.bottom - 20 && toScreen(x).x > vp.left + 60 && toScreen(x).x < canvas.width - vp.right - 60);
out.haveUnit = !!u;
if (u) {
  Game.clearSelection();
  const p = toScreen(u);
  await tap(p.x, p.y);
  out.selectedAfterTap = selected().includes(u.id);

  // Move: tap open ground above him; he walks toward it.
  const goal = { x: p.x, y: p.y - 110 };
  const w = { x: (goal.x - GS.viewX) / GS.viewScale, y: (goal.y - GS.viewY) / GS.viewScale };
  const d0 = Math.hypot(u.x - w.x, u.y - w.y);
  await tap(goal.x, goal.y);
  await sleep(1500);
  const d1 = Math.hypot(u.x - w.x, u.y - w.y);
  out.moveCloser = [Math.round(d0), Math.round(d1)];
  out.moved = d1 < d0 - 10;
  out.notHeldAfterTap = !u.holding;

  // Hold: a long press on the ground orders him there and holds.
  const q = toScreen(u);
  await tap(q.x + 40, q.y + 30, 600);
  await sleep(100);
  out.heldAfterLongPress = !!u.holding;

  // Box-select: SELECT, then drag a box around him.
  Game.clearSelection();
  MobileUI.setSelectMode(true);
  const r = toScreen(u);
  await drag(r.x - 50, r.y - 50, r.x + 50, r.y + 50);
  out.boxSelected = selected().includes(u.id);
  out.selectModeOffAfterBox = !MobileUI.isSelectMode();
}

// Place more: armed with PLACE MORE on, two taps place two and it stays armed; CANCEL disarms.
Game.clearSelection();
GS.tactical = 60;
Game.selectDeploy('footman');
await sleep(300);
document.getElementById('m-place-more').click();
const alive = () => GS.units.filter((x) => x.team === 'player' && x.hp > 0).length;
const armyBefore = alive();
const py = canvas.height - vp.bottom - 50;
await tap(canvas.width / 2 - 40, py);
await tap(canvas.width / 2 + 40, py);
await sleep(100);
out.placedTwo = alive() - armyBefore;
out.stillArmed = GS.selectedDeploy === 'footman';
await sleep(300);
document.getElementById('m-cancel').click();
out.cancelled = !GS.selectedDeploy;

// Pan: with nothing selected, one finger moves the camera, not a selection box.
Game.clearSelection();
await sleep(50);
const cx0 = GS.cameraWorldX, cy0 = GS.cameraWorldY;
// Fingers down and right: the opening view sits on the bottom edge, so the camera can go up.
await drag(canvas.width / 2, canvas.height / 2, canvas.width / 2 + 60, canvas.height / 2 + 120);
out.pan = [Math.round(GS.cameraWorldX - cx0), Math.round(GS.cameraWorldY - cy0)];
out.panned = Math.abs(GS.cameraWorldX - cx0) + Math.abs(GS.cameraWorldY - cy0) > 5;
out.noSelectionFromPan = selected().length === 0;

// Pinch: fingers spread to twice the distance, the zoom roughly doubles (within the cap).
const z0 = Game.getCameraZoom();
await pinch(canvas.width / 2, canvas.height / 2, 80, 160);
const z1 = Game.getCameraZoom();
out.pinchZoom = [+z0.toFixed(2), +z1.toFixed(2)];
out.pinchedIn = z1 > z0 * 1.4;
await pinch(canvas.width / 2, canvas.height / 2, 160, 80);
out.pinchedOut = Game.getCameraZoom() < z1 * 0.7;

// No page scroll or page zoom from any of it.
out.pageStill = window.scrollX === 0 && window.scrollY === 0 && (window.visualViewport?.scale ?? 1) === 1;
return out;
`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  const wc = win.webContents;
  wc.setFrameRate(30);
  const errors = [];
  wc.on('console-message', (e) => {
    if (e.level === 'error') errors.push(e.message);
  });
  let code = 0;
  try {
    await win.loadFile(path.join(repo, 'index.html'));
    await new Promise((r) => setTimeout(r, 1000));
    const result = await wc.executeJavaScript(`(async () => { ${PAGE}\n })()`, true);
    result.pageErrors = errors;
    console.log('TOUCH_RESULT ' + JSON.stringify(result));
  } catch (err) {
    console.log('TOUCH_RESULT ' + JSON.stringify({ failed: err.message, pageErrors: errors }));
    code = 1;
  }
  app.exit(code);
});
