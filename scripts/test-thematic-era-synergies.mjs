/**
 * Smoke tests for Thematic Era Synergies — arcane tech, ancestral arms, hero echoes.
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
    Legacy: { get: () => ({ victories: 1, maxWaveEver: 150 }) },
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
    `${eternalSrc}\n;\n${foundSrc}\n;\n${ascSrc}\n;\n${synSrc}\n;\n${gsSrc}\n({ FoundationalMedievalLayer, AscensionSystem, ThematicEraSynergies, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null })`,
    ctx
  );
}

function seedMartial(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 12; i++) FML.recordDeploy('archer', 20);
  for (let i = 0; i < 8; i++) FML.recordDeploy('footman', 25);
}

function seedArcane(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 3; i++) FML.recordBuild('research_lab', 40);
  for (let i = 0; i < 6; i++) FML.recordDeploy('mage', 50);
  FML.recordResearch('academy_charter', 55);
}

function seedMythic(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  FML.recordDeploy('goku', 60);
  FML.recordDeploy('tank_dempsey', 65);
  FML.recordFaction('gears', 70);
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { FoundationalMedievalLayer, AscensionSystem, ThematicEraSynergies, GrandStrategy } =
  loadModules();

// Martial — Ancestral Weapons
seedMartial(FoundationalMedievalLayer);
if (GrandStrategy) {
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
} else {
  console.log('SKIP GrandStrategy assertions (macro layer removed)');
}
const martialSnap = ThematicEraSynergies.getStateSnapshot({ wave: 200 });
ok(martialSnap.active && martialSnap.pathId === 'martial', 'martial synergy activates at 150');
ok(martialSnap.pathLabel === 'Ancestral Weapons', 'martial label is Ancestral Weapons');
const footman = { team: 'player', type: 'footman', damage: 20, maxHp: 100, hp: 100, vetTier: 4 };
const archer = { team: 'player', type: 'archer', damage: 18, maxHp: 80, hp: 80, vetTier: 3 };
const m200 = ThematicEraSynergies.getAncestralWeaponMult(footman, 200);
const m400 = ThematicEraSynergies.getAncestralWeaponMult(footman, 400);
ok(m400 > m200, 'ancestral weapons scale infinitely with wave');
ThematicEraSynergies.applyThematicUnitBonuses(footman, 200);
ok(footman.damage > 20, 'ancestral bonus applied to footman damage');
ok(footman.ancestralWeapon, 'footman flagged ancestral weapon');

// Arcane — Arcane-Infused Technology
seedArcane(FoundationalMedievalLayer);
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
ThematicEraSynergies.onWaveStart(400, { wave: 400, units: [], showMessage: () => {}, addHighlight: () => {} });
const arcSnap = ThematicEraSynergies.getStateSnapshot({ wave: 400 });
ok(arcSnap.active && arcSnap.pathId === 'arcane', 'arcane synergy activates');
ok(arcSnap.techTreeLabel === 'Arcane-Infused Technology', 'arcane tech tree label');
ok(arcSnap.arcaneInfusionTier >= 3, 'arcane infusion tier grows at galactic era');
const arcMods = ThematicEraSynergies.getArcaneInfusionMods(400);
ok(arcMods.researchSpeedMult > 1 && arcMods.fleetDmgMult > 1, 'arcane infusion buffs research and fleet');
ok(ThematicEraSynergies.getArcaneFleetRuneMult(400) > 1, 'rune hulls boost fleet at tier 3+');

// Mythic — Hero Echoes
seedMythic(FoundationalMedievalLayer);
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
AscensionSystem.resetRun();
AscensionSystem.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
const units = [
  { team: 'player', type: 'goku', hp: 100, honorName: null },
  { team: 'player', type: 'tank_dempsey', hp: 100 },
];
ThematicEraSynergies.onWaveStart(150, { wave: 150, units, showMessage: () => {}, addHighlight: () => {} });
const mythSnap = ThematicEraSynergies.getStateSnapshot({ wave: 150 });
ok(mythSnap.active && mythSnap.pathId === 'mythic', 'mythic synergy activates');
ok(mythSnap.echoes.candidates.length >= 2, 'echo candidates seeded from mythic heroes');
const beforeLp = AscensionSystem.getStateSnapshot({ wave: 150 }).legacyPoints;
const recruit = ThematicEraSynergies.recruitHeroEcho('goku', { wave: 150, showMessage: () => {}, addHighlight: () => {} });
ok(recruit.ok, 'recruit goku echo succeeds');
const afterLp = AscensionSystem.getStateSnapshot({ wave: 150 }).legacyPoints;
ok(afterLp === beforeLp - 16, 'legacy points spent once for echo');
const echoMods = ThematicEraSynergies.getHeroEchoMods();
ok(echoMods.playerDmgMult > 1, 'recruited echo boosts damage');
ok(echoMods.fleetReadiness > 0, 'goku echo boosts fleet readiness');

// GS tactical merge
seedMartial(FoundationalMedievalLayer);
GrandStrategy?.resetRun?.();
ThematicEraSynergies.resetRun();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
ThematicEraSynergies.onWaveStart(200, { wave: 200, units: [], showMessage: () => {}, addHighlight: () => {} });
const gsMods = GrandStrategy?.getTacticalModifiers?.(200);
ok(gsMods.playerDmgMult >= 1, 'GS merges synergy tactical mods');

const intel = ThematicEraSynergies.formatIntelNote({ wave: 200 });
ok(intel.includes('Synergy'), 'intel note mentions synergy');

const hud = ThematicEraSynergies.formatHudLine({ wave: 200 });
ok(hud.includes('%') || hud.includes('Echo') || hud.includes('T'), 'hud line populated');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll thematic era synergy tests passed');