/**
 * Smoke tests for save thumbnail helpers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const code = readFileSync(join(JS, 'save-thumbnail.js'), 'utf8');
const sb = {
  console,
  document: {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            font: '',
            textAlign: '',
            textBaseline: '',
            fillRect() {},
            strokeRect() {},
            drawImage() {},
            createLinearGradient() {
              return { addColorStop() {} };
            },
            setLineDash() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            stroke() {},
            fillText() {},
          };
        },
        toDataURL() {
          return 'data:image/jpeg;base64,TEST';
        },
      };
    },
    getElementById: () => null,
  },
};
sb.window = sb;
sb.globalThis = sb;

const { SaveThumbnail } = vm.runInContext(`${code}\n({ SaveThumbnail })`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(typeof SaveThumbnail?.formatSavedAt === 'function', 'SaveThumbnail exported');
const when = SaveThumbnail.formatSavedAt(Date.UTC(2026, 6, 7, 14, 30));
ok(when.includes('2026') || when.includes('Jul') || when.length > 4, 'formatSavedAt');

const lines = SaveThumbnail.buildMetaLines({
  wave: 12,
  tactical: 45.7,
  army: 18,
  timeOfDay: 'night',
  savedAt: Date.now(),
});
ok(lines.join(' ').includes('Wave 12') && lines.join(' ').includes('45 TP'), 'buildMetaLines');

const thumb = SaveThumbnail.captureFromMinimapData({
  worldW: 800,
  worldH: 600,
  wave: 5,
  phase: 'day',
  buildings: [{ x: 100, y: 200, owner: 'player' }],
  units: [{ x: 120, y: 220, team: 'player' }],
  viewX: 0,
  viewY: 0,
  viewW: 200,
  viewH: 150,
});
ok(thumb?.startsWith('data:image/jpeg'), 'minimap thumbnail capture');

process.exit(failed ? 1 : 0);