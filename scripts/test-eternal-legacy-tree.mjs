/**
 * Smoke tests for Crown of Ages — Eternal Legacy Tech Tree + Echoes of the Past.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const STORAGE = join(JS, '..', 'test-eternal-legacy-storage.json');

function mockStorage() {
  const store = {};
  return {
    getItem(k) {
      return store[k] ?? null;
    },
    setItem(k, v) {
      store[k] = v;
    },
    removeItem(k) {
      delete store[k];
    },
  };
}

function loadEternalLegacy(extra = {}) {
  const src = readFileSync(join(JS, 'eternal-legacy-tree.js'), 'utf8');
  const leg = {
    victories: 2,
    maxWaveEver: 120,
    totalKills: 500,
    totalWavesCleared: 40,
    honorCount: 3,
    factionsUsed: ['gears'],
    favoriteUnitType: 'archer',
    unitKills: { archer: 60 },
    unitDeploys: { mage: 20, healer: 25 },
    ...extra.legacy,
  };
  const sb = {
    Math,
    Object,
    Array,
    JSON,
    Set,
    Date,
    parseFloat,
    Number,
    localStorage: mockStorage(),
    Legacy: { get: () => leg },
    StoryLore: { getDominantBranch: () => 'iron_crown' },
    MetaProgress: { isCrossoverType: () => false },
    ...extra,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(`${src}\n({ EternalLegacyTree })`, ctx);
}

let { EternalLegacyTree } = loadEternalLegacy();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(EternalLegacyTree.BRANCHES.iron_crown?.label === 'Iron Crown', 'iron crown branch');
ok(Object.keys(EternalLegacyTree.TREE_NODES).length >= 20, 'tree has 20+ nodes');

const shards = EternalLegacyTree.computeEchoShards();
ok(shards >= 6, 'echo shards from mock legacy');

let r = EternalLegacyTree.investNode('crown_first_echo');
ok(r.ok === true, 'invest first echo (free)');

r = EternalLegacyTree.investNode('crown_age_mark');
ok(r.ok === true, 'invest age mark gate');

r = EternalLegacyTree.investNode('iron_volley_tradition');
ok(r.ok === true, 'invest iron volley tradition');

ok(EternalLegacyTree.isInvested('iron_volley_tradition'), 'volley is invested');

const blocked = EternalLegacyTree.investNode('iron_knight_ascendant');
ok(blocked.ok === false && blocked.reason === 'prereq', 'knight ascendant blocked by prereq');

const fx = EternalLegacyTree.getCombinedEffects(null, 120);
ok(fx.ascendDmgByType.archer > 1, 'archer ascend damage from volley');

const unit = { team: 'player', type: 'archer', damage: 100, maxHp: 100, hp: 100, morale: 10, maxMorale: 20 };
EternalLegacyTree.applyUnitBonuses(unit, 120);
ok(unit.damage > 100, 'applyUnitBonuses boosts archer damage');
ok(unit.eternalEchoTier >= 1, 'ascension tier set on unit');

const intel = EternalLegacyTree.formatIntelNote({ wave: 100 });
ok(intel.includes('ascend') || intel.includes('Echo'), 'intel note at wave 100');

const hud = EternalLegacyTree.formatHudLine({ wave: 50 });
ok(hud.includes('Crown'), 'hud line shows crown count');

const snap = EternalLegacyTree.getMenuSnapshot();
ok(snap.investedCount >= 3, 'menu snapshot invested count');
ok(snap.nodes.some((n) => n.invested), 'menu has invested nodes');

ok(EternalLegacyTree.getLegacyEntries().length >= 1, 'encyclopedia entries');

console.log(failed ? `\n${failed} test(s) failed` : '\nAll eternal-legacy-tree tests passed');
process.exit(failed ? 1 : 0);