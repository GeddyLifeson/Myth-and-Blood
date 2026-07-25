/**
 * Macro layers (GS / IG / planet map / RTS map expansion) were removed.
 * Ensure they are not present in live js/ and not referenced by index.html.
 */
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL:', m);
    failed++;
  } else console.log('OK:', m);
}

const removed = [
  'grand-strategy.js',
  'grand-strategy-mid-branches.js',
  'grand-strategy-divisions.js',
  'intergalactic-layer.js',
  'intergalactic-late-branches.js',
  'strategic-map-view.js',
  'macro-bootstrap.js',
  'layer-design.js',
  'hybrid-moments.js',
  'planet-warfare.js',
  'planet-conquest.js',
];

for (const f of removed) {
  ok(!existsSync(join(root, 'js', f)), `js/ does not contain removed macro module ${f}`);
}

ok(!existsSync(join(root, 'shelved')), 'shelved/ archive folder removed');

const html = readFileSync(join(root, 'index.html'), 'utf8');
ok(!html.includes('js/grand-strategy.js'), 'index.html no grand-strategy script');
ok(!html.includes('js/intergalactic-layer.js'), 'index.html no intergalactic script');
ok(!html.includes('js/planet-conquest.js'), 'index.html no planet-conquest script');
ok(!html.includes('id="grand-strategy-btn"'), 'index.html no crown button');
ok(html.includes('js/crossover.js'), 'index.html still loads crossover.js');
ok(existsSync(join(root, 'js/crossover.js')), 'crossover.js remains in live js/');
ok(existsSync(join(root, 'js/wwe.js')), 'wwe.js remains in live js/');

const missing = [];
for (const m of html.matchAll(/src="(js\/[^"]+)"/g)) {
  if (!existsSync(join(root, m[1]))) missing.push(m[1]);
}
ok(missing.length === 0, missing.length ? `missing scripts: ${missing.join(', ')}` : 'all index.html scripts exist');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nRemoved-macro verification passed; crossover intact.');
