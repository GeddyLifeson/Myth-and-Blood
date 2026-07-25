#!/usr/bin/env node
/**
 * Headless smoke test for Cosmetics — skins, banner opts, victory themes.
 * Run: node scripts/test-cosmetics.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');

function loadScript(name) {
  const src = readFileSync(join(JS, name), 'utf8');
  vm.runInThisContext(src, { filename: name });
}

globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
};
globalThis.localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = v;
  },
};

loadScript('sprites.js');
loadScript('visual-polish.js');
loadScript('meta-progress.js');
loadScript('cosmetics.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

Cosmetics.init();

assert(Cosmetics.setUnitSkin('crimson_legion'), 'crimson skin should apply');
const base = { body: '#5070a8', accent: '#c0c8e0', mark: '#8090c0', size: 9 };
const tinted = Cosmetics.applyUnitSkin(base);
assert(tinted.body === '#802030', 'skin should override body color');

Cosmetics.setBannerField('pattern', 'hellforge');
Cosmetics.setBannerField('emblem', 'dragon');
Cosmetics.setBannerField('primary', '#4080c0');
assert(Cosmetics.resolveBannerStage(1) === 4, 'hellforge pattern should force tier 4');

Cosmetics.setBannerField('pattern', 'auto');
assert(Cosmetics.resolveBannerStage(2) === 2, 'auto pattern should follow evolution stage');

Cosmetics.setVictoryTheme('crystal_hymn');
const theme = Cosmetics.getVictoryTheme();
assert(theme.backdropClass === 'theme-crystal', 'crystal theme backdrop');
assert(theme.notes.length >= 4, 'victory theme should have notes');

const copy = Cosmetics.resolveVictoryCopy('default', {
  title: 'VICTORY!',
  subtitle: 'Your banner holds.',
  crest: '✦',
});
assert(copy.crest === '◇', 'theme should override crest');

assert(!Cosmetics.isUnlockMet('creative_skin_wwe'), 'mastery skin locked without progress');

Cosmetics.setUnitSkin('royal_gold');
Cosmetics.save();
Cosmetics.load();
assert(Cosmetics.getState().unitSkin === 'royal_gold', 'persistence round-trip');

const snap = Cosmetics.getSnapshot();
assert(snap.unitSkinLabel === 'Royal Gold', 'snapshot label');

if (failed) {
  console.error(`test-cosmetics: ${failed} failure(s)`);
  process.exit(1);
}
console.log('test-cosmetics: OK');