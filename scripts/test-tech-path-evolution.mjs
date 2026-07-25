/**
 * Smoke tests for Tech Path Evolution — Engineers to Synthetic Ascension.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const eternalSrc = readFileSync(join(JS, 'eternal-legacy-tree.js'), 'utf8');
  const foundSrc = readFileSync(join(JS, 'foundational-medieval-layer.js'), 'utf8');
  const techSrc = readFileSync(join(JS, 'tech-tree-branches.js'), 'utf8');
  const mbSrc = (() => { try { return readFileSync(join(JS, 'grand-strategy-mid-branches.js'), 'utf8'); } catch { return '/* optional missing grand-strategy-mid-branches.js */'; } })();
  const gsSrc = (() => { try { return readFileSync(join(JS, 'grand-strategy.js'), 'utf8'); } catch { return '/* optional missing grand-strategy.js */'; } })();
  const tpeSrc = readFileSync(join(JS, 'tech-path-evolution.js'), 'utf8');
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
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    Legacy: { get: () => ({ victories: 1, maxWaveEver: 500 }) },
    StoryLore: { getDominantBranch: () => null },
    isWweUnit: () => false,
    isCrossoverUnit: () => false,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(
    `${eternalSrc}\n;\n${foundSrc}\n;\n${techSrc}\n;\n${mbSrc}\n;\n${gsSrc}\n;\n${tpeSrc}\n({ FoundationalMedievalLayer, TechTreeBranches, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null, TechPathEvolution })`,
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

const { FoundationalMedievalLayer, TechTreeBranches, GrandStrategy, TechPathEvolution } =
  loadModules();

function seedTechRun(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 4; i++) FML.recordBuild('quarry', 30);
  for (let i = 0; i < 2; i++) FML.recordBuild('research_lab', 32);
  for (let i = 0; i < 10; i++) FML.recordDeploy('sapper', 40);
  for (let i = 0; i < 6; i++) FML.recordDeploy('ballista', 45);
  for (let i = 0; i < 8; i++) FML.recordDeploy('builder', 50);
  FML.recordScience(60, 45);
}

TechPathEvolution.resetRun();
ok(TechPathEvolution.STAGE_DEFS.medieval.label === 'Engineers & Quarries', 'medieval engineers stage');
ok(TechPathEvolution.STAGE_DEFS.kingdom.label === 'Industrial Revolution', 'kingdom industrial stage');
ok(TechPathEvolution.STAGE_DEFS.galactic.label === 'Synthetic Ascension', 'galactic synthetic stage');
ok(TechPathEvolution.STAGE_DEFS.galactic.doctrine.label === 'Dyson Mandate', 'dyson mandate doctrine');

seedTechRun(FoundationalMedievalLayer);
ok(TechPathEvolution.isFoundryPathActive(80), 'engineer-heavy run is foundry path');

TechPathEvolution.recordBuild('quarry', 5);
ok(TechPathEvolution.getStateSnapshot({ wave: 80 }).firstHammer?.quarryStruck, 'first hammer struck at quarry');

for (let i = 0; i < 4; i++) TechPathEvolution.recordDeploy('builder', 20);
TechPathEvolution.captureFirstHammer(
  { team: 'player', type: 'builder', id: 'fb-1', maxHp: 80, hp: 80 },
  6
);
ok(TechPathEvolution.getStateSnapshot({ wave: 80 }).firstHammer?.unitId === 'fb-1', 'first hammer bearer');

const builder = { team: 'player', type: 'builder', id: 'fb-1', maxHp: 80, hp: 80, buildSpeedMult: 1 };
TechPathEvolution.applyFoundryUnitBonuses(builder, 80);
ok(builder.firstHammerBearer && builder.firstHammerLineage, 'first hammer lineage');

TechTreeBranches.resetRun();
TechTreeBranches.onWaveStart(50, { wave: 50, showMessage: () => {} });
ok(TechTreeBranches.getRootId() === 'tech', 'tech root locks from engineer score');

TechPathEvolution.recordAction('order_logistics', { wave: 90, label: 'Logistics' });
TechPathEvolution.recordAction('district_foundry', { wave: 95, label: 'Foundry district' });
const kingdomMods = GrandStrategy?.getTacticalModifiers?.(160) || { hpMult: 1, playerDmgMult: 1 };
ok(!GrandStrategy || kingdomMods.hpMult > 1 || kingdomMods.playerDmgMult > 1, 'industrial revolution buffs combat');

TechPathEvolution.spawnTestFoundry('stellar');
const dyson = TechPathEvolution.getDysonMandateMods({ wave: 420, invasionActive: true });
ok(dyson.active && dyson.droneSwarm, 'dyson mandate deploys drone relief');
ok(dyson.intervalMult < 1, 'dyson mandate speeds invasion pacing');

const machineBuilder = {
  team: 'player',
  type: 'builder',
  id: 'mb-1',
  maxHp: 80,
  hp: 80,
  buildSpeedMult: 1,
};
TechPathEvolution.applyFoundryUnitBonuses(machineBuilder, 450);
ok(machineBuilder.machineGod && machineBuilder.honorsFirstHammer, 'galactic builder becomes machine god');

const html = TechPathEvolution.renderPanelHtml({ wave: 420 });
ok(html.includes('Synthetic') || html.includes('Dyson') || html.includes('hammer'), 'panel shows tech fantasy');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tech-path-evolution tests passed');