/**
 * Smoke tests for strike impact FX.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

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

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

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

process.exit(failed ? 1 : 0);