/**
 * Smoke tests for Foundational Medieval Layer (waves 1–150).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function mockStorage() {
  const store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = v;
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
}

function loadModules(extra = {}) {
  const eternalSrc = readFileSync(join(JS, 'eternal-legacy-tree.js'), 'utf8');
  const foundSrc = readFileSync(join(JS, 'foundational-medieval-layer.js'), 'utf8');
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
    Legacy: { get: () => ({ victories: 1, maxWaveEver: 150 }) },
    StoryLore: { getDominantBranch: () => null },
    MetaProgress: { isCrossoverType: () => false },
    isWweUnit: () => false,
    isCrossoverUnit: (t) => t === 'goku' || t === 'tank_dempsey',
    ...extra,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(`${eternalSrc}\n;\n${foundSrc}\n({ FoundationalMedievalLayer, EternalLegacyTree })`, ctx);
}

const { FoundationalMedievalLayer, EternalLegacyTree } = loadModules();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

FoundationalMedievalLayer.resetRun();
FoundationalMedievalLayer.onRunStart({ creative: false });

for (let i = 0; i < 12; i++) FoundationalMedievalLayer.recordDeploy('archer', 20);
for (let i = 0; i < 8; i++) FoundationalMedievalLayer.recordDeploy('footman', 25);
for (let i = 0; i < 5; i++) FoundationalMedievalLayer.recordKill('archer', 30);

const snap = FoundationalMedievalLayer.getRunSnapshot();
ok(snap.leading === 'longbow_legacy', 'longbow leads after archer/footman investment');
ok(snap.scores.longbow_legacy >= 18, 'longbow score meets crystallize threshold');

const messages = [];
const result = FoundationalMedievalLayer.crystallize({
  wave: 150,
  showMessage: (m) => messages.push(m),
  addHighlight: () => {},
});
ok(result?.pathId === 'longbow_legacy', 'crystallizes longbow path');
ok(FoundationalMedievalLayer.hasCrystallizedPath('longbow_legacy'), 'persists longbow crystallization');

EternalLegacyTree.investNode('crown_first_echo');
EternalLegacyTree.investNode('crown_age_mark');
const seedCheck = EternalLegacyTree.canInvest('seed_longbow_legacy');
ok(seedCheck.ok === true, 'seed_longbow unlocks after crystallization');

const arcaneRun = loadModules();
arcaneRun.FoundationalMedievalLayer.resetRun();
arcaneRun.FoundationalMedievalLayer.onRunStart({ creative: false });
for (let i = 0; i < 3; i++) arcaneRun.FoundationalMedievalLayer.recordBuild('research_lab', 40);
for (let i = 0; i < 6; i++) arcaneRun.FoundationalMedievalLayer.recordDeploy('mage', 50);
arcaneRun.FoundationalMedievalLayer.recordResearch('academy_charter', 55);
const arcSnap = arcaneRun.FoundationalMedievalLayer.getRunSnapshot();
ok(arcSnap.leading === 'arcane_dominion', 'arcane leads after academy investment');

const mythRun = loadModules();
mythRun.FoundationalMedievalLayer.resetRun();
mythRun.FoundationalMedievalLayer.onRunStart({ creative: false });
mythRun.FoundationalMedievalLayer.recordDeploy('goku', 60);
mythRun.FoundationalMedievalLayer.recordDeploy('tank_dempsey', 65);
mythRun.FoundationalMedievalLayer.recordFaction('gears', 70);
const mythSnap = mythRun.FoundationalMedievalLayer.getRunSnapshot();
ok(mythSnap.leading === 'mythic_alliance', 'mythic leads after crossover heroes');

ok(FoundationalMedievalLayer.formatIntelNote({ wave: 100 }).includes('medieval'), 'intel at wave 100');
ok(FoundationalMedievalLayer.getLegacyEntries().length >= 1, 'encyclopedia entry');

console.log(failed ? `\n${failed} test(s) failed` : '\nAll foundational-medieval-layer tests passed');
process.exit(failed ? 1 : 0);