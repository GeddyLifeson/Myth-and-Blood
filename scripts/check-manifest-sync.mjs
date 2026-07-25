#!/usr/bin/env node
/**
 * index.html is the ground truth for script load order — it is the configuration
 * that actually runs in the browser. The production bundle (build-manifest.mjs)
 * and the headless VM boot (headless-manifest.mjs) both re-declare that order,
 * and both have silently drifted from it before:
 *
 *   - `game-core.js` and `game-feedback.js` were in index.html but absent from
 *     GAME_SCRIPTS, so `npm run build` shipped a dist bundle missing them.
 *   - `game-runtime.js` sat at a different position in GAME_SCRIPTS than in
 *     index.html, i.e. the bundle concatenated scripts in an order no browser
 *     had ever executed.
 *
 * Neither is caught by verify-build.mjs, which only checks that output files
 * exist. This check compares the lists directly and fails loudly.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GAME_SCRIPTS, WORKER_SCRIPTS } from './build-manifest.mjs';
import { HEADLESS_FILES } from './headless-manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const htmlOrder = [...html.matchAll(/src="js\/([A-Za-z0-9._-]+\.js)"/g)].map((m) => m[1]);

let failed = 0;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failed++;
};

if (!htmlOrder.length) fail('no <script src="js/..."> tags found in index.html');

// --- production bundle must match index.html exactly ------------------------
{
  const a = htmlOrder;
  const b = GAME_SCRIPTS;
  const sa = new Set(a);
  const sb = new Set(b);
  for (const f of a) if (!sb.has(f)) fail(`GAME_SCRIPTS is missing ${f} (present in index.html)`);
  for (const f of b) if (!sa.has(f)) fail(`GAME_SCRIPTS has ${f}, absent from index.html`);
  if (sa.size === sb.size && a.every((f) => sb.has(f))) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        fail(
          `GAME_SCRIPTS order diverges at index ${i}: index.html has ${a[i]}, manifest has ${b[i]}`
        );
        break;
      }
    }
  }
}

// --- headless boot: membership only ----------------------------------------
// HEADLESS_FILES is a deliberate subset (no DOM/UI layer) and its order is NOT
// required to match index.html — it intentionally loads content-expansion.js
// after perks.js rather than before meta-progress.js. That ordering is baked
// into the sim's deterministic baseline, so it is checked for membership only:
// every headless script must still be a script the real app actually loads.
{
  const known = new Set([...htmlOrder, ...WORKER_SCRIPTS]);
  for (const f of HEADLESS_FILES)
    if (!known.has(f)) fail(`HEADLESS_FILES has ${f}, which index.html never loads`);
}

if (failed) {
  console.error(`check-manifest-sync: ${failed} failure(s)`);
  process.exit(1);
}
console.log(`check-manifest-sync: OK (${htmlOrder.length} scripts)`);
