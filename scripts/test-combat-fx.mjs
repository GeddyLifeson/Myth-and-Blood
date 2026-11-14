/**
 * Smoke tests for strike impact FX.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const strikeCode = readFileSync(join(JS, 'strike-fx.js'), 'utf8');
const sb = {
  console,
  Math,
  Object,
  Array,
  Particles: {
    strikeFire: () => {},
    strikeLightning: () => {},
    strikeFrost: () => {},
    strikeHeal: () => {},
    explosion: () => {},
  },
};
sb.window = sb;
sb.globalThis = sb;

const { StrikeFX } = vm.runInContext(`${strikeCode}\n({ StrikeFX })`, vm.createContext(sb));

ok(typeof StrikeFX?.impact === 'function', 'StrikeFX.impact exported');
ok(typeof StrikeFX?.drawScreenFx === 'function', 'StrikeFX.drawScreenFx exported');
StrikeFX.impact('fireball', 100, 100, 60, 1);
StrikeFX.impact('lightning', 50, 50, 40, 1);
StrikeFX.update();
ok(true, 'strike impact updates without throw');

const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  fillRect() {},
  beginPath() {},
  arc() {},
  stroke() {},
};
StrikeFX.drawScreenFx(mockCtx, 800, 600);
ok(true, 'drawScreenFx runs');

// The full-canvas flash is a brief, low tint: never above 0.22 alpha, one fill per frame
// however many strikes land together, and gone within a quarter of a second.
{
  StrikeFX.clear();
  for (let i = 0; i < 6; i++) StrikeFX.impact('fireball', 100 + i, 100, 60, 2);
  StrikeFX.impact('meteor', 100, 100, 80, 2);
  let peak = 0;
  let maxFills = 0;
  let frames = 0;
  for (let f = 0; f < 60; f++) {
    const fills = [];
    const ctx = {
      set fillStyle(v) {
        this._fs = v;
      },
      fillRect(x, y, w, h) {
        if (w === 800 && h === 600) fills.push(this._fs);
      },
    };
    StrikeFX.drawScreenFx(ctx, 800, 600);
    maxFills = Math.max(maxFills, fills.length);
    for (const c of fills) {
      const a = parseFloat(/([\d.]+)\)$/.exec(c)[1]);
      peak = Math.max(peak, a);
    }
    if (fills.length) frames = f + 1;
    StrikeFX.update();
  }
  ok(peak > 0.02 && peak <= 0.22, `seven stacked fire strikes flash at most 0.22 alpha (${peak})`);
  ok(maxFills === 1, `stacked flashes share one canvas fill per frame (${maxFills})`);
  ok(frames > 0 && frames <= 15, `the flash is over within 15 frames (${frames})`);
}

process.exit(failures() ? 1 : 0);
