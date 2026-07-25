/**
 * Headless tests for ModLoader JSON injection and research unlocks.
 * Run: node scripts/test-mod-loader.mjs
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
  head: { appendChild: () => {} },
  createElement: () => ({ appendChild: () => {}, dataset: {} }),
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
globalThis.fetch = async () => ({ ok: false, status: 404 });

loadScript('game-data-bundle.js');
loadScript('game-data.js');
loadScript('sprites.js');
loadScript('research.js');
loadScript('mod-loader.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

const manifest = {
  id: 'test_mod',
  name: 'Test Mod',
  version: '0.0.1',
  deploy: ['test_troop'],
  build: ['test_tower'],
};

const units = {
  test_troop: {
    name: 'Test Troop',
    cost: 5,
    hp: 90,
    accuracy: 35,
    damage: 22,
    range: 22,
    meleeRange: 22,
    speed: 1,
    type: 'melee',
    morale: 12,
    experience: 5,
    sprite: { body: '#404040', accent: '#808080', mark: '#c0c0c0', size: 8 },
  },
};

const buildings = {
  test_tower: {
    name: 'Test Tower',
    cost: 7,
    hp: 200,
    radius: 20,
    buildTime: 120,
    cover: 0.4,
    blocksMove: false,
    blocksLOS: true,
  },
};

ModLoader.injectMod(manifest, units, buildings);

assert(UnitDefs.test_troop?.name === 'Test Troop', 'unit merged into UnitDefs');
assert(UnitDefs.test_troop?.modId === 'test_mod', 'unit tagged with modId');
assert(BuildDefs.test_tower?.name === 'Test Tower', 'building merged into BuildDefs');
assert(Research.isDeployUnlocked('test_troop'), 'mod deploy unlock registered');
assert(Research.isBuildUnlocked('test_tower'), 'mod build unlock registered');
assert(SpriteGen.UNIT_STYLE.test_troop?.body === '#404040', 'sprite style registered');

ModLoader.injectMod(
  { id: 'bad_mod', deploy: [] },
  { bad_unit: { name: 'Bad', cost: 1, hp: 1 } },
  {}
);
const bad = ModLoader.getLoaded().find((m) => m.id === 'bad_mod');
assert(bad?.errors?.length > 0, 'invalid unit def records error');

if (failed) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log('All mod-loader tests passed.');