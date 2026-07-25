/**
 * Smoke tests for Giant Branching Tech Tree — Martial / Arcane / Mythic / Tech roots.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const foundSrc = readFileSync(join(JS, 'foundational-medieval-layer.js'), 'utf8');
  const ttSrc = readFileSync(join(JS, 'tech-tree-branches.js'), 'utf8');
  const sb = {
    Math,
    Object,
    Array,
    Set,
    JSON,
    Date,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    Legacy: { get: () => ({}) },
    Research: { completedCount: 0, countLabs: () => 1, getActiveInfo: () => null },
    isWweUnit: () => false,
    isCrossoverUnit: (t) => t === 'goku' || t === 'tank_dempsey',
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  const mods = vm.runInContext(
    `${foundSrc}\n;\n${ttSrc}\n({ FoundationalMedievalLayer, TechTreeBranches, Research })`,
    ctx
  );
  return { ...mods, researchStub: sb.Research };
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { FoundationalMedievalLayer, TechTreeBranches, researchStub } = loadModules();

// Martial root
FoundationalMedievalLayer.resetRun();
FoundationalMedievalLayer.onRunStart({ creative: false });
for (let i = 0; i < 20; i++) FoundationalMedievalLayer.recordDeploy('archer', 20);
for (let i = 0; i < 15; i++) FoundationalMedievalLayer.recordDeploy('footman', 25);
TechTreeBranches.resetRun();
TechTreeBranches.onWaveStart(50, { wave: 50, showMessage: () => {}, addHighlight: () => {} });
const martialSnap = TechTreeBranches.getStateSnapshot({ wave: 50 });
ok(martialSnap.rootLocked && martialSnap.rootId === 'martial', 'martial root locks at wave 50');
ok(TechTreeBranches.getNodesForBranch().length === 9, 'martial branch has 9 nodes');

// Arcane root
FoundationalMedievalLayer.resetRun();
FoundationalMedievalLayer.onRunStart({ creative: false });
for (let i = 0; i < 4; i++) FoundationalMedievalLayer.recordBuild('research_lab', 40);
for (let i = 0; i < 15; i++) FoundationalMedievalLayer.recordDeploy('mage', 50);
TechTreeBranches.resetRun();
TechTreeBranches.onWaveStart(50, { wave: 50, showMessage: () => {}, addHighlight: () => {} });
ok(TechTreeBranches.getRootId() === 'arcane', 'arcane root from academies and mages');
TechTreeBranches.completeInvest('arcane_root', {});
const fx = TechTreeBranches.getCombinedEffects(60);
ok(fx.scienceGainMult > 1 && fx.researchSpeedMult > 1, 'arcane root grants science and research mods');

// Mythic root
FoundationalMedievalLayer.resetRun();
FoundationalMedievalLayer.onRunStart({ creative: false });
FoundationalMedievalLayer.recordDeploy('goku', 60);
FoundationalMedievalLayer.recordDeploy('tank_dempsey', 65);
TechTreeBranches.resetRun();
TechTreeBranches.onWaveStart(50, { wave: 50, showMessage: () => {}, addHighlight: () => {} });
ok(TechTreeBranches.getRootId() === 'mythic', 'mythic root from crossover heroes');

// Tech root
FoundationalMedievalLayer.resetRun();
FoundationalMedievalLayer.onRunStart({ creative: false });
for (let i = 0; i < 5; i++) FoundationalMedievalLayer.recordBuild('research_lab', 40);
for (let i = 0; i < 4; i++) FoundationalMedievalLayer.recordBuild('quarry', 45);
FoundationalMedievalLayer.recordResearch('prospecting', 46);
FoundationalMedievalLayer.recordResearch('iron_weapons', 47);
researchStub.completedCount = 8;
TechTreeBranches.resetRun();
TechTreeBranches.onWaveStart(50, { wave: 50, showMessage: () => {}, addHighlight: () => {} });
ok(TechTreeBranches.getRootId() === 'tech', 'tech root from labs and industry');

TechTreeBranches.completeInvest('tech_root', {});
TechTreeBranches.completeInvest('tech_industrial', {});
TechTreeBranches.completeInvest('tech_logistics', {});
TechTreeBranches.completeInvest('tech_automation', {});
TechTreeBranches.completeInvest('tech_macro', {});
TechTreeBranches.completeInvest('tech_stellar', {});
ok(
  TechTreeBranches.getTechTreeLabel() === 'Stellar Engineering Tree',
  'tech path exposes stellar engineering label'
);

const intel = TechTreeBranches.formatIntelNote({ wave: 120 });
ok(intel.toLowerCase().includes('tech'), 'intel mentions tech branch');

const fourRoots = Object.keys(TechTreeBranches.ROOT_BRANCHES);
ok(fourRoots.length === 4 && fourRoots.includes('tech'), 'four root branches defined');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tech tree branch tests passed');