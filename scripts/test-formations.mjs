/**
 * Smoke tests for formation offset layouts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const code = readFileSync(join(JS, 'formations.js'), 'utf8');
const F = vm.runInContext(`${code}; Formations;`, vm.createContext({ Math, Object, Array }));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const line = F.computeOffsets(5, 'line');
ok(line.length === 5 && line[0].x < line[4].x && line.every((o) => o.y === 0), 'line is horizontal');

const col = F.computeOffsets(4, 'column');
ok(col.length === 4 && col.every((o) => o.x === 0) && col[0].y < col[3].y, 'column is vertical');

const wedge = F.computeOffsets(6, 'wedge');
ok(wedge.length === 6 && wedge[0].y === 0, 'wedge front row at anchor');

const spread = F.computeOffsets(8, 'spread');
ok(spread.length === 8 && Math.abs(spread[1].x - spread[0].x) > 20, 'spread has wide spacing');

ok(F.nextFormationId('line') === 'column', 'formation cycle');

process.exit(failed ? 1 : 0);