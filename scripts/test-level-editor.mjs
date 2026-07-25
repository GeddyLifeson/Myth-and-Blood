#!/usr/bin/env node
/**
 * Headless smoke test for Level Editor serialization.
 * Run: node scripts/test-level-editor.mjs
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
  getElementById: (id) => {
    const store = {
      'level-editor-name': { value: 'Test Arena' },
      'level-editor-desc': { value: 'Smoke test' },
      'level-editor-library': { value: '', innerHTML: '' },
      'level-editor-grid': { checked: true },
    };
    const el = store[id] || { value: '', innerHTML: '', checked: false };
    el.toggleAttribute = () => {};
    el.addEventListener = () => {};
    return el;
  },
  querySelectorAll: () => [],
  createElement: () => ({ click() {}, href: '' }),
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
globalThis.UI = { updateHUD() {} };
globalThis.AudioEngine = { SFX: { click() {} } };

const decorations = [{ type: 'tree', x: 100, y: 200, hp: 999, size: 20, radius: 18 }];
const units = [{ id: 'u1', type: 'footman', team: 'player', x: 50, y: 60, hp: 10, maxHp: 10 }];
const buildings = [];

globalThis.Game = {
  getState() {
    return {
      creativeMode: true,
      creativeTool: 'level_paint_tree',
      wave: 5,
      worldW: 1280,
      worldH: 800,
      units,
      buildings,
      decorations,
    };
  },
  isCreativeMode() {
    return true;
  },
  creativeSetTool() {},
  getLevelSnapshot(meta) {
    return {
      v: 1,
      type: 'level',
      name: meta.name,
      description: meta.description,
      wave: 5,
      units: [{ type: 'footman', team: 'player', x: 50, y: 60, hp: 10, maxHp: 10 }],
      buildings: [],
      decorations: [{ type: 'tree', x: 100, y: 200, hp: 999, size: 20, radius: 18 }],
    };
  },
  loadCreativeLevel(level) {
    this._loaded = level;
    return true;
  },
  creativePlaceDecoration() {
    return true;
  },
  creativeEraseAt() {
    return true;
  },
  showMessage() {},
  getWorldCenter() {
    return { x: 400, y: 300 };
  },
  setCustomWave() {},
};

loadScript('level-editor.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

LevelEditor.init();
const snap = LevelEditor.snapPos(103, 117);
assert(snap.x % 16 === 0 && snap.y % 16 === 0, 'grid snap');

LevelEditor.saveToLibrary();
const lib = JSON.parse(localStorage.getItem('myth-and-blood-level-library-v1'));
assert(lib.length === 1, 'library save');
assert(lib[0].name === 'Test Arena', 'level name persisted');

const imported = LevelEditor.importLevel(JSON.stringify(lib[0]));
assert(imported.ok, 'import round-trip');
assert(Game._loaded?.decorations?.length === 1, 'decorations in load');

LevelEditor.onMapClick(128, 128);
assert(true, 'map click handled');

if (failed) {
  console.error(`test-level-editor: ${failed} failure(s)`);
  process.exit(1);
}
console.log('test-level-editor: OK');