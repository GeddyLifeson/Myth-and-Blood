/**
 * Rain and storm streaks spread evenly across the whole field at every height, so the
 * slant never leaves a dry wedge on one side (the overlay used to sit shifted right).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const sb = { Math, console };
vm.createContext(sb);
vm.runInContext(readFileSync(join(JS, 'field-art.js'), 'utf8'), sb);
const FieldArt = sb.FieldArt;

/** Records the start of every streak drawn: the first path of moveTo calls before a stroke. */
function streaks(type, w, h, tick) {
  const pts = [];
  let strokes = 0;
  const g = new Proxy(
    {
      moveTo: (x, y) => strokes === 0 && pts.push([x, y]),
      stroke: () => strokes++,
    },
    { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true }
  );
  FieldArt.drawWeather(g, w, h, 1, tick, { type });
  return pts;
}

for (const type of ['rain', 'storm']) {
  for (const [w, h] of [
    [400, 650],
    [900, 650],
    [300, 1200],
  ]) {
    const cols = 4;
    // Top and bottom thirds of the field, each cut into four columns.
    for (const [band, y0, y1] of [
      ['top', 0, h / 3],
      ['bottom', (2 * h) / 3, h],
    ]) {
      const count = new Array(cols).fill(0);
      for (const tick of [100, 160, 220, 280, 340]) {
        for (const [x, y] of streaks(type, w, h, tick)) {
          if (y < y0 || y >= y1 || x < 0 || x >= w) continue;
          count[Math.floor((x * cols) / w)]++;
        }
      }
      const lo = Math.min(...count);
      const hi = Math.max(...count);
      ok(
        lo > 0 && lo / hi > 0.6,
        `${type} ${w}x${h} ${band}: streaks even across the width (${count.join(', ')})`
      );
    }
  }
}

if (failures()) process.exit(1);
console.log('rain cover: ok');
