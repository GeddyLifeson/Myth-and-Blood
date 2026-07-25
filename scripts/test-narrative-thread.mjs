/**
 * Smoke tests for Narrative Thread — Ancient Crown continuity and legend power.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const eternalSrc = readFileSync(join(JS, 'eternal-legacy-tree.js'), 'utf8');
  const foundSrc = readFileSync(join(JS, 'foundational-medieval-layer.js'), 'utf8');
  const ascSrc = readFileSync(join(JS, 'ascension-system.js'), 'utf8');
  const synSrc = readFileSync(join(JS, 'thematic-era-synergies.js'), 'utf8');
  const ntSrc = readFileSync(join(JS, 'narrative-thread.js'), 'utf8');
  const gsSrc = (() => { try { return readFileSync(join(JS, 'grand-strategy.js'), 'utf8'); } catch { return '/* optional missing grand-strategy.js */'; } })();
  const sb = {
    Math,
    Object,
    Array,
    Set,
    Map,
    JSON,
    Date,
    parseFloat,
    Number,
    performance: { now: () => 1000 },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    Legacy: { get: () => ({ victories: 1, maxWaveEver: 150 }) },
    StoryLore: { getDominantBranch: () => null },
    MetaProgress: { isCrossoverType: () => false },
    isWweUnit: () => false,
    isCrossoverUnit: (t) => t === 'goku' || t === 'tank_dempsey',
    MAX_VETERAN_TIER: 6,
    isValidHonorName: (n) => !!n && n.length > 2,
    Chronicles: { appendNarrativeBeat: () => {} },
    getUnitDisplayName: (u) => u.honorName || u.type,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(
    `${eternalSrc}\n;\n${foundSrc}\n;\n${ascSrc}\n;\n${synSrc}\n;\n${ntSrc}\n;\n${gsSrc}\n({ FoundationalMedievalLayer, AscensionSystem, ThematicEraSynergies, NarrativeThread, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null })`,
    ctx
  );
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { FoundationalMedievalLayer, ThematicEraSynergies, NarrativeThread, GrandStrategy } =
  loadModules();

const messages = [];
NarrativeThread.resetRun();
NarrativeThread.onRunStart({ creative: false, showMessage: (m) => messages.push(m) });
ok(messages.some((m) => m.includes('Ancient Crown') || m.includes('cosmic time')), 'run start frames ancient crown');

NarrativeThread.resetRun();
const honored = {
  id: 'u1',
  team: 'player',
  type: 'footman',
  honorName: 'Sir Aldric',
  hp: 100,
  maxHp: 100,
  damage: 20,
  maxMorale: 30,
  morale: 30,
  vetTier: 4,
};
const leg = NarrativeThread.onHeroHonored(honored, 80, { showMessage: () => {}, addHighlight: () => {} });
ok(leg?.kind === 'honored', 'honored veteran canonized as legend');
ok(NarrativeThread.getStateSnapshot({ wave: 80 }).legendCount === 1, 'legend count tracked');

const champion = {
  id: 'u2',
  team: 'player',
  type: 'archer',
  hp: 80,
  maxHp: 80,
  damage: 18,
  maxMorale: 30,
  morale: 30,
  vetTier: 4,
};
NarrativeThread.scanLegends([honored, champion], 100, { showMessage: () => {}, addHighlight: () => {} });
ok(NarrativeThread.getStateSnapshot({ wave: 100 }).legendCount === 2, 'champion scanned into legends');

const mythic = { id: 'u3', team: 'player', type: 'goku', hp: 200, maxHp: 200, damage: 40, maxMorale: 40, morale: 40 };
NarrativeThread.scanLegends([mythic], 120, { showMessage: () => {}, addHighlight: () => {} });
ok(NarrativeThread.getMythicLegendIds().includes('goku'), 'mythic legend id exposed for echoes');

const mods100 = NarrativeThread.getLegendPowerMods(100);
const mods400 = NarrativeThread.getLegendPowerMods(400);
ok(mods400.playerDmgMult > mods100.playerDmgMult, 'legend power scales with era');

NarrativeThread.applyLegendBonuses(honored, 150);
ok(
  honored.maxHp > 100 && honored.crownLegend === 'Sir Aldric',
  'legend bonuses apply to units with matching legend'
);

FoundationalMedievalLayer.resetRun();
FoundationalMedievalLayer.onRunStart({ creative: false });
FoundationalMedievalLayer.recordDeploy('goku', 60);
FoundationalMedievalLayer.recordDeploy('tank_dempsey', 65);
if (GrandStrategy) {
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
NarrativeThread.resetRun();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(150, { wave: 150, units: [mythic], showMessage: () => {}, addHighlight: () => {} });
NarrativeThread.scanLegends([mythic], 150, { showMessage: () => {}, addHighlight: () => {} });
} else {
  console.log('SKIP GrandStrategy assertions (macro layer removed)');
}
const echoSnap = ThematicEraSynergies.getStateSnapshot({ wave: 150 });
ok(
  echoSnap.echoes.candidates.some((c) => c.id === 'goku'),
  'narrative legends feed mythic echo candidates'
);

NarrativeThread.resetRun();
NarrativeThread.onWaveStart(150, { wave: 150, units: [], showMessage: (m) => messages.push(m), addHighlight: () => {} });
ok(messages.some((m) => m.includes('medieval kingdom') || m.includes('imperial')), 'wave 150 succession beat');

const intel = NarrativeThread.formatIntelNote({ wave: 150 });
ok(intel.toLowerCase().includes('legend') || intel.toLowerCase().includes('crown'), 'intel mentions crown legends');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll narrative thread tests passed');