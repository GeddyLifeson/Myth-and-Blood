/**
 * Smoke tests for Hybrid Power Fantasy — apex capstones for pure arcane & martial runs.
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

function loadModules() {
  const eternalSrc = readFileSync(join(JS, 'eternal-legacy-tree.js'), 'utf8');
  const foundSrc = readFileSync(join(JS, 'foundational-medieval-layer.js'), 'utf8');
  const ascSrc = readFileSync(join(JS, 'ascension-system.js'), 'utf8');
  const synSrc = readFileSync(join(JS, 'thematic-era-synergies.js'), 'utf8');
  const pfSrc = readFileSync(join(JS, 'hybrid-power-fantasy.js'), 'utf8');
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
    localStorage: mockStorage(),
    Legacy: { get: () => ({ victories: 1, maxWaveEver: 500 }) },
    StoryLore: { getDominantBranch: () => null },
    MetaProgress: { isCrossoverType: () => false },
    isWweUnit: () => false,
    isCrossoverUnit: (t) => t === 'goku' || t === 'tank_dempsey',
    MAX_VETERAN_TIER: 6,
    isValidHonorName: (n) => !!n && n.length > 2,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(
    `${eternalSrc}\n;\n${foundSrc}\n;\n${ascSrc}\n;\n${synSrc}\n;\n${pfSrc}\n;\n${gsSrc}\n({ FoundationalMedievalLayer, AscensionSystem, ThematicEraSynergies, HybridPowerFantasy, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null })`,
    ctx
  );
}

function seedPureArcane(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 4; i++) FML.recordBuild('research_lab', 40);
  for (let i = 0; i < 20; i++) FML.recordDeploy('mage', 50);
  for (let i = 0; i < 8; i++) FML.recordDeploy('wizard', 55);
  FML.recordResearch('academy_charter', 55);
  FML.recordResearch('mage_tower', 60);
  FML.recordScience(40, 80);
}

function seedPureMartial(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 30; i++) FML.recordDeploy('archer', 20);
  for (let i = 0; i < 25; i++) FML.recordDeploy('footman', 25);
  for (let i = 0; i < 15; i++) FML.recordDeploy('knight', 30);
  for (let i = 0; i < 10; i++) FML.recordKill('archer', 40);
}

function seedMixed(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 10; i++) FML.recordDeploy('archer', 20);
  for (let i = 0; i < 10; i++) FML.recordDeploy('mage', 50);
  FML.recordDeploy('goku', 60);
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { FoundationalMedievalLayer, ThematicEraSynergies, HybridPowerFantasy, GrandStrategy } =
  loadModules();

// Pure arcane → Wizard-Kings
seedPureArcane(FoundationalMedievalLayer);
ok(HybridPowerFantasy.evaluatePathPurity() === 'pure_arcane', 'pure arcane purity detected');
if (GrandStrategy) {
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
HybridPowerFantasy.resetRun();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
HybridPowerFantasy.onWaveStart(150, { wave: 150, showMessage: () => {}, addHighlight: () => {} });
} else {
  console.log('SKIP GrandStrategy assertions (macro layer removed)');
}
const pendingArcane = HybridPowerFantasy.getStateSnapshot({ wave: 400 });
ok(pendingArcane.pending && pendingArcane.fantasyId === null, 'wizard-kings pending before wave 500');
const messages = [];
HybridPowerFantasy.onWaveStart(500, { wave: 500, showMessage: (m) => messages.push(m), addHighlight: () => {} });
const arcSnap = HybridPowerFantasy.getStateSnapshot({ wave: 500 });
ok(arcSnap.active && arcSnap.fantasyId === 'wizard_kings', 'wizard-kings unlock at wave 500');
ok(arcSnap.fleetLabel === 'Reality-Warping Armada', 'wizard-kings fleet label');
const mage = { team: 'player', type: 'mage', damage: 30, range: 80, maxHp: 90, hp: 90, maxMorale: 30, morale: 30 };
HybridPowerFantasy.applyUnitFantasy(mage, 500);
ok(mage.wizardKing, 'mage becomes wizard-king');
ok(mage.damage > 30, 'wizard-king damage boost');
const arcFleet = HybridPowerFantasy.getFleetMods(500);
ok(arcFleet.realityWarp && arcFleet.fleetDmgMult > 1, 'reality-warping fleet mods');
ok(messages.some((m) => m.includes('Wizard-Kings')), 'wizard-kings announced');

// Pure martial → Honor Legion
seedPureMartial(FoundationalMedievalLayer);
ok(HybridPowerFantasy.evaluatePathPurity() === 'pure_martial', 'pure martial purity detected');
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
HybridPowerFantasy.resetRun();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
HybridPowerFantasy.onWaveStart(150, { wave: 150, showMessage: () => {}, addHighlight: () => {} });
HybridPowerFantasy.onWaveStart(500, { wave: 500, showMessage: (m) => messages.push(m), addHighlight: () => {} });
const martSnap = HybridPowerFantasy.getStateSnapshot({ wave: 500 });
ok(martSnap.active && martSnap.fantasyId === 'honor_legion', 'honor legion unlock at wave 500');
ok(martSnap.honorQuote?.includes('sword and shield'), 'honor demands the blade quote');
const knight = {
  team: 'player',
  type: 'knight',
  damage: 40,
  range: 120,
  maxHp: 200,
  hp: 200,
  maxMorale: 35,
  morale: 35,
};
HybridPowerFantasy.applyUnitFantasy(knight, 500);
ok(knight.honorLegion && knight.honorPlate, 'knight gains honor plate');
ok(knight.honorMeleeOnly && knight.range <= 58, 'honor legion keeps sword and shield range');
ok(knight.maxHp > 200, 'honor legion HP boost');
ok(messages.some((m) => m.includes('sword and shield')), 'honor quote announced');

// Mixed path blocked
seedMixed(FoundationalMedievalLayer);
HybridPowerFantasy.resetRun();
ThematicEraSynergies.resetRun();
GrandStrategy?.resetRun?.();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
HybridPowerFantasy.onWaveStart(500, { wave: 500, showMessage: () => {}, addHighlight: () => {} });
const mixedSnap = HybridPowerFantasy.getStateSnapshot({ wave: 500 });
ok(!mixedSnap.active, 'mixed path does not unlock apex fantasy');

// GS tactical merge
seedPureMartial(FoundationalMedievalLayer);
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
HybridPowerFantasy.resetRun();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
HybridPowerFantasy.onWaveStart(150, { wave: 150, showMessage: () => {}, addHighlight: () => {} });
HybridPowerFantasy.onWaveStart(500, { wave: 500, showMessage: () => {}, addHighlight: () => {} });
const finalSnap = HybridPowerFantasy.getStateSnapshot({ wave: 500 });
ok(finalSnap.active, 'final block honor legion active for intel');
const gsMods = GrandStrategy?.getTacticalModifiers?.(500) || { hpMult: 1, playerDmgMult: 1 };
ok(!GrandStrategy || gsMods.playerDmgMult > 1, 'GS merges power fantasy tactical mods');

const intel = HybridPowerFantasy.formatIntelNote({ wave: 500 });
ok(intel.toLowerCase().includes('power fantasy'), 'intel note mentions power fantasy');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll hybrid power fantasy tests passed');