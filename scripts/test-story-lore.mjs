#!/usr/bin/env node
/**
 * Headless smoke test for StoryLore branching narratives + chronicles integration.
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

globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
globalThis.localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = v;
  },
};
globalThis.getDifficultyDef = (id) => ({ label: id });
globalThis.getPlayerUnitDef = () => ({ name: 'Footman' });
globalThis.getUnitDisplayName = (u) => u.type || 'unit';
globalThis.LoreData = {
  CAMPAIGN_NARRATIVE: {
    waves: { 31: { title: 'Default', hook: 'default hook', sub: 'default sub' } },
  },
};

loadScript('chronicles.js');
loadScript('story-lore.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

StoryLore.onRunStart({ difficulty: 'normal', modeId: 'campaign' });

StoryLore.recordChoice({
  source: 'planet_event',
  choiceId: 'raid',
  label: 'Raid Storm',
  wave: 12,
  eventId: 'dominion_storm',
});
StoryLore.recordChoice({
  source: 'doctrine',
  choiceId: 'imperial_march',
  label: 'Imperial March',
  wave: 15,
});

const branch = StoryLore.getDominantBranch();
assert(branch === 'iron_crown', `expected iron_crown branch, got ${branch}`);

const wave25 = StoryLore.getWaveNarrative(25);
assert(wave25?.title === 'No Quarter', 'branch-specific wave 25 narrative');
assert(StoryLore.getWaveNarrative(31)?.title === 'Default', 'other waves fall back to the shared beat');

const snap = StoryLore.getSessionSnapshot();
assert(snap?.branchLabel === 'The Iron Hand', 'session snapshot branch label');
assert(snap.choiceCount === 2, 'two choices recorded');

const beforeChronicles = Chronicles.getAll().length;
StoryLore.onRunEnd({ victory: true, wave: 20, victoryReason: 'economy' });
assert(Chronicles.getAll().length > beforeChronicles, 'chronicles gained entries on run end');

const enc = StoryLore.getEncyclopediaEntries();
assert(
  enc.some((e) => e.cat === 'story'),
  'encyclopedia story entries'
);

const choiceEntries = Chronicles.getAll().filter((e) => e.type === 'choice');
assert(choiceEntries.length >= 2, 'choice chronicle entries');

if (failed) {
  console.error(`test-story-lore: ${failed} failure(s)`);
  process.exit(1);
}
console.log('test-story-lore: OK');
