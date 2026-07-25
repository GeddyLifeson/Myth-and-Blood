#!/usr/bin/env node
/**
 * Assert eslint.globals.mjs is exactly what gen-eslint-globals.mjs produces.
 *
 * The committed file had drifted from its generator: seven entries had been added
 * by hand, so anyone running `npm run gen:eslint-globals` would have silently
 * deleted them. This check makes that drift impossible to land.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eslint.globals.mjs');

const committed = readFileSync(OUT, 'utf8');
const backup = mkdtempSync(join(tmpdir(), 'eslint-globals-'));
const saved = join(backup, 'eslint.globals.mjs');
writeFileSync(saved, committed);

let regenerated;
try {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'gen-eslint-globals.mjs')], {
    stdio: 'ignore',
  });
  regenerated = readFileSync(OUT, 'utf8');
} finally {
  writeFileSync(OUT, committed); // always restore, even on throw
  rmSync(backup, { recursive: true, force: true });
}

if (regenerated !== committed) {
  const names = (s) => {
    const m = /\[([\s\S]*?)\]\.map/.exec(s);
    return new Set(m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []);
  };
  const a = names(committed);
  const b = names(regenerated);
  console.error('FAIL: eslint.globals.mjs is not what gen-eslint-globals.mjs produces.');
  const onlyCommitted = [...a].filter((n) => !b.has(n));
  const onlyGenerated = [...b].filter((n) => !a.has(n));
  if (onlyCommitted.length)
    console.error(`  hand-added, would be deleted: ${onlyCommitted.join(', ')}`);
  if (onlyGenerated.length)
    console.error(`  missing from committed file:  ${onlyGenerated.join(', ')}`);
  if (!onlyCommitted.length && !onlyGenerated.length)
    console.error('  same names, formatting differs — run the generator and commit the result.');
  console.error('  Fix: node scripts/gen-eslint-globals.mjs && git add eslint.globals.mjs');
  process.exit(1);
}
console.log(`check-eslint-globals: OK (${committed.match(/"/g).length / 2} globals)`);
