#!/usr/bin/env node
/**
 * Smoke-check dist/ after npm run build.
 */
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

let failed = 0;
function need(path, label) {
  if (!existsSync(path)) {
    console.error(`FAIL: missing ${label} (${path})`);
    failed++;
    return false;
  }
  return true;
}

need(join(DIST, 'index.html'), 'index.html');
need(join(DIST, 'js', 'game.bundle.min.js'), 'game bundle');
need(join(DIST, 'js', 'path-worker.js'), 'path worker');
need(join(DIST, 'css', 'style.min.css'), 'css');
need(join(DIST, 'data', 'units.json'), 'data');
need(join(DIST, 'mods', 'manifest.json'), 'mods manifest');

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
if (html.includes('<script src="js/floatingText.js">')) {
  console.error('FAIL: dist/index.html still references unbundled scripts');
  failed++;
}
if (!html.includes('game.bundle')) {
  console.error('FAIL: dist/index.html missing game bundle script');
  failed++;
}

const bundle = readFileSync(join(DIST, 'js', 'game.bundle.min.js'), 'utf8');
if (!bundle.includes('Myth and Blood') && !bundle.includes('Game')) {
  console.error('FAIL: bundle looks empty or corrupt');
  failed++;
}

for (const rel of ['js/game.bundle.min.js', 'css/style.min.css', 'data/units.json']) {
  if (!existsSync(join(DIST, `${rel}.gz`))) {
    console.error(`FAIL: missing gzip sidecar for ${rel}`);
    failed++;
  }
  if (!existsSync(join(DIST, `${rel}.br`))) {
    console.error(`FAIL: missing brotli sidecar for ${rel}`);
    failed++;
  }
}

const buildInfo = JSON.parse(readFileSync(join(DIST, 'build-info.json'), 'utf8'));
const compression = buildInfo.files?.compression ?? buildInfo.compression;
if (!compression?.brotliPct) {
  console.error('FAIL: build-info missing compression stats');
  failed++;
}

if (failed) {
  console.error(`verify-build: ${failed} failure(s)`);
  process.exit(1);
}
console.log('verify-build: OK');