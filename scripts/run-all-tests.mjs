/**
 * Run every scripts/test-*.mjs plus headless runtime suites.
 * Usage: node scripts/run-all-tests.mjs [--skip-sim]
 */
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skipSim = process.argv.includes('--skip-sim');

const tests = readdirSync(join(root, 'scripts'))
  .filter((f) => f.startsWith('test-') && f.endsWith('.mjs'))
  .sort();

const extras = ['headless-crossover.mjs', ...(skipSim ? [] : ['headless-sim.mjs'])];

let failed = 0;
const results = [];

function run(script) {
  const path = join(root, 'scripts', script);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push({ script, ok, ms, err: r.stderr?.trim() || r.stdout?.trim() });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${script} (${ms}ms)`);
  if (!ok) {
    const tail = (r.stderr || r.stdout || '').split('\n').slice(-8).join('\n');
    if (tail) console.error(tail);
  }
}

console.log(`Running ${tests.length} unit tests${skipSim ? '' : ' + headless sim'}...\n`);

for (const t of tests) run(t);
for (const e of extras) run(e);

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
if (failed) {
  console.error(`\n${failed} suite(s) failed:`);
  for (const r of results.filter((x) => !x.ok)) console.error(`  - ${r.script}`);
  process.exit(1);
}