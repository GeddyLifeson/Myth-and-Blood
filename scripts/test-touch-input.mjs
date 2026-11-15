/**
 * Touch on a phone-sized window: real TouchEvents on the canvas in Electron (scripts/lib/
 * touch-harness.js) must select, move, hold, box-select, pan and pinch-zoom the field.
 */
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ok, failures } from './lib/harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// The electron package's main export is the path of its binary.
const electron = createRequire(import.meta.url)('electron');

function run(w, h) {
  const env = { ...process.env, TOUCH_W: String(w), TOUCH_H: String(h) };
  // Set by some parent tools; Electron would then start as plain Node.
  delete env.ELECTRON_RUN_AS_NODE;
  // Linux CI: the setuid sandbox helper is not root-owned and there is no display.
  const linux = process.platform === 'linux';
  const args = [...(linux ? ['--no-sandbox'] : []), join(here, 'lib', 'touch-harness.js')];
  const [cmd, argv] =
    linux && !process.env.DISPLAY ? ['xvfb-run', ['-a', electron, ...args]] : [electron, args];
  const r = spawnSync(cmd, argv, {
    env,
    encoding: 'utf8',
    timeout: 120000,
  });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('TOUCH_RESULT '));
  if (!line) {
    console.error((r.stdout || '') + (r.stderr || ''));
    return null;
  }
  return JSON.parse(line.slice('TOUCH_RESULT '.length));
}

for (const [w, h] of [
  [390, 844],
  [844, 390],
]) {
  const res = run(w, h);
  const at = `${w}x${h}`;
  ok(res && !res.failed, `${at}: harness ran (${res?.failed || 'ok'})`);
  if (!res || res.failed) continue;
  console.log(`${at}:`, JSON.stringify(res));
  ok(res.mobile, `${at}: phone layout is on`);
  ok(res.fieldFills, `${at}: the field covers the whole view at the start`);
  ok(res.haveUnit, `${at}: a soldier is on screen to tap`);
  ok(res.selectedAfterTap, `${at}: tapping a soldier selects him`);
  ok(res.moved, `${at}: tapping the ground moves him there (${res.moveCloser})`);
  ok(res.notHeldAfterTap, `${at}: a plain tap does not hold him`);
  ok(res.heldAfterLongPress, `${at}: a long press on the ground holds him there`);
  ok(res.boxSelected, `${at}: SELECT then a drag box-selects him`);
  ok(res.selectModeOffAfterBox, `${at}: SELECT turns itself off after one box`);
  ok(res.placedTwo === 2, `${at}: PLACE MORE, then two taps place two soldiers (${res.placedTwo})`);
  ok(res.stillArmed, `${at}: PLACE MORE keeps the card armed`);
  ok(res.cancelled, `${at}: CANCEL disarms`);
  ok(res.panned, `${at}: one finger pans the field (${res.pan})`);
  ok(res.noSelectionFromPan, `${at}: a pan selects nothing`);
  ok(res.pinchedIn, `${at}: spreading two fingers zooms in (${res.pinchZoom})`);
  ok(res.pinchedOut, `${at}: pinching two fingers zooms out`);
  ok(res.pageStill, `${at}: the page itself never scrolls or zooms`);
  ok(res.pageErrors.length === 0, `${at}: no page errors (${res.pageErrors.slice(0, 2)})`);
}

process.exit(failures() ? 1 : 0);
