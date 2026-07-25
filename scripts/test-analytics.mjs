#!/usr/bin/env node
/**
 * Headless smoke test for opt-in Analytics.
 * Run: node scripts/test-analytics.mjs
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
globalThis.Settings = {
  _optIn: false,
  get(key) {
    if (key === 'analyticsOptIn') return this._optIn;
    return null;
  },
  set(key, val) {
    if (key === 'analyticsOptIn') this._optIn = val;
  },
};
globalThis.Formations = {
  getLabel: (id) => id,
};
globalThis.ContentExpansion = {
  getLoadouts: () => ({
    balanced: { label: 'Balanced' },
    shield: { label: 'Shield Wall' },
  }),
};

loadScript('analytics.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

Analytics.init();
assert(!Analytics.isEnabled(), 'disabled by default');

Settings._optIn = true;
Analytics.syncEnabled();
assert(Analytics.isEnabled(), 'sync from settings');

Analytics.onRunStart({
  modeId: 'campaign',
  difficulty: 'normal',
  difficultyPct: 100,
  loadout: 'balanced',
  formation: 'box',
});
Analytics.onWaveReached(10);
Analytics.onLoadoutChange('shield');
Analytics.onFormationUsed('wedge');
Analytics.onKingdomDoctrine('outpost_stand');
Analytics.onRunEnd({ wave: 12, victory: false });

const ins = Analytics.getInsights();
assert(ins.runs === 1, 'one run recorded');
assert(ins.outcomes.defeat === 1, 'defeat counted');
assert(ins.loadouts.some((l) => l.id === 'shield'), 'dominant loadout tracked');
assert(ins.formations.some((f) => f.id === 'wedge'), 'formation tracked');
assert(ins.dropOff.some((d) => d.id === 'w10-24' && d.count === 1), 'drop-off bucket');

Analytics.onRunStart({ modeId: 'survival', difficulty: 'chad', difficultyPct: 150, loadout: 'arrows' });
Analytics.onRunAbandon(3);
const ins2 = Analytics.getInsights();
assert(ins2.runs === 2, 'second run');
assert(ins2.outcomes.quit === 1, 'quit counted');

Analytics.clearLocal();
assert(Analytics.getInsights().runs === 0, 'clear resets aggregates');

if (failed) {
  console.error(`test-analytics: ${failed} failure(s)`);
  process.exit(1);
}
console.log('test-analytics: OK');