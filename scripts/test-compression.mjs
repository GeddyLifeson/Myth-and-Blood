#!/usr/bin/env node
/**
 * Verify dist compression sidecars and JSON minification.
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gunzipSync, brotliDecompressSync } from 'zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

if (!existsSync(DIST)) {
  console.error('Run npm run build first');
  process.exit(1);
}

const unitsPath = join(DIST, 'data', 'units.json');
const unitsBr = `${unitsPath}.br`;
const unitsGz = `${unitsPath}.gz`;

ok(existsSync(unitsBr), 'units.json.br exists');
ok(existsSync(unitsGz), 'units.json.gz exists');

const raw = readFileSync(unitsPath);
const fromBr = brotliDecompressSync(readFileSync(unitsBr));
const fromGz = gunzipSync(readFileSync(unitsGz));
ok(fromBr.equals(raw), 'brotli round-trip matches raw');
ok(fromGz.equals(raw), 'gzip round-trip matches raw');

const parsed = JSON.parse(raw.toString('utf8'));
ok(typeof parsed === 'object' && Object.keys(parsed).length > 0, 'units.json parses');

const info = JSON.parse(readFileSync(join(DIST, 'build-info.json'), 'utf8'));
const compression = info.files?.compression ?? info.compression;
ok(compression?.brotliPct > 50, `brotli savings ${compression?.brotliPct}%`);

const bundleBr = join(DIST, 'js', 'game.bundle.min.js.br');
ok(existsSync(bundleBr), 'game bundle .br exists');
ok(statSync(bundleBr).size < statSync(join(DIST, 'js', 'game.bundle.min.js')).size, 'bundle br smaller');

if (failed) {
  console.error(`test-compression: ${failed} failure(s)`);
  process.exit(1);
}
console.log('test-compression: OK');