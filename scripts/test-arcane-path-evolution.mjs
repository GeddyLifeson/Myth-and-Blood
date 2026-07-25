/**
 * Smoke tests for Arcane Path Evolution — Weavers of Fate.
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
  const lbSrc = (() => { try { return readFileSync(join(JS, 'intergalactic-late-branches.js'), 'utf8'); } catch { return '/* optional missing intergalactic-late-branches.js */'; } })();
  const igSrc = (() => { try { return readFileSync(join(JS, 'intergalactic-layer.js'), 'utf8'); } catch { return '/* optional missing intergalactic-layer.js */'; } })();
  const epfSrc = readFileSync(join(JS, 'eternal-path-framework.js'), 'utf8');
  const apeSrc = readFileSync(join(JS, 'arcane-path-evolution.js'), 'utf8');
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
    Chronicles: { appendNarrativeBeat: () => {} },
    Game: { setPaused: () => {}, showMessage: () => {}, getState: () => ({ paused: true }) },
    UI: { updateHUD: () => {} },
    isWweUnit: () => false,
    isCrossoverUnit: () => false,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(
    `${eternalSrc}\n;\n${foundSrc}\n;\n${techSrc}\n;\n${mbSrc}\n;\n${gsSrc}\n;\n${lbSrc}\n;\n${igSrc}\n;\n${epfSrc}\n;\n${apeSrc}\n({ FoundationalMedievalLayer, TechTreeBranches, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null, IntergalacticLayer: typeof IntergalacticLayer !== 'undefined' ? IntergalacticLayer : null, ArcanePathEvolution })`,
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

const { FoundationalMedievalLayer, GrandStrategy, IntergalacticLayer, ArcanePathEvolution } =
  loadModules();

function seedArcaneRun(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 3; i++) FML.recordBuild('research_lab', 40);
  for (let i = 0; i < 14; i++) FML.recordDeploy('mage', 50);
  for (let i = 0; i < 4; i++) FML.recordDeploy('wizard', 55);
}

ArcanePathEvolution.resetRun();
ok(
  ArcanePathEvolution.STAGE_DEFS.galactic.doctrine.label === 'Arcane Singularity',
  'arcane singularity doctrine'
);

seedArcaneRun(FoundationalMedievalLayer);
ok(ArcanePathEvolution.isWeaverPathActive(80), 'mage-heavy run is weaver path');

for (let i = 0; i < 5; i++) ArcanePathEvolution.recordDeploy('mage', 20);
ArcanePathEvolution.captureFoundingMage(
  { team: 'player', type: 'mage', id: 'fm-1', maxHp: 50, hp: 50, damage: 40, range: 180 },
  2
);
ok(ArcanePathEvolution.getStateSnapshot({ wave: 80 }).foundingMage?.captured, 'founding mage captured');

const mage = { team: 'player', type: 'mage', id: 'fm-1', maxHp: 50, hp: 50, damage: 40, range: 180 };
ArcanePathEvolution.applyWeaverUnitBonuses(mage, 80);
ok(mage.weaverFounder && mage.weaverLineage, 'founding mage lineage bonuses');

if (GrandStrategy) {
GrandStrategy?.resetRun?.();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
} else {
  console.log('SKIP GrandStrategy assertions (macro layer removed)');
}
ok(!GrandStrategy || GrandStrategy.getKingdomPathId() === 'arcane', 'kingdom arcane path');
ArcanePathEvolution.recordAction('edict_ley_surge', { wave: 160, label: 'Ley Surge' });
ArcanePathEvolution.recordAction('template_arcane_sentinel', { wave: 165, label: 'Arcane Sentinel' });

const kingdomMods = GrandStrategy?.getTacticalModifiers?.(170) || { hpMult: 1, playerDmgMult: 1 };
ok(!GrandStrategy || (!GrandStrategy || kingdomMods.playerDmgMult > 1), 'kingdom weaver mods buff damage');
ok(!GrandStrategy || (kingdomMods.researchSpeedMult > 1), 'kingdom weaver mods buff research');

if (IntergalacticLayer) {
IntergalacticLayer?.resetRun?.();
IntergalacticLayer?.onWaveStart?.(400, { wave: 400, showMessage: () => {} });
} else {
  console.log('SKIP IntergalacticLayer assertions (macro layer removed)');
}
ok(!IntergalacticLayer || IntergalacticLayer.getCosmicPathId() === 'aether_lords', 'arcane run resolves aether_lords');

ArcanePathEvolution.spawnTestWeaver('aether_lords');
const singularity = ArcanePathEvolution.getSingularityMods({ wave: 410, invasionActive: true });
ok(singularity.active && singularity.playerDmgMult > 1.05, 'singularity warps invasion damage');
ok(singularity.countMult < 1, 'singularity relieves enemy pressure');

const galMage = { team: 'player', type: 'wizard', maxHp: 60, hp: 60, damage: 45, range: 200 };
IntergalacticLayer?.applyCosmicUnitBonuses?.(galMage, 450);
ok(!IntergalacticLayer || (galMage.physicsRewrite || galMage.cosmicLegacyApplied || galMage.weaverLineage), 'galactic mage gets weaver bonuses');

const html = ArcanePathEvolution.renderPanelHtml({ wave: 450 });
ok(html.includes('Weavers') || html.includes('Aether'), 'panel shows weaver progression');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll arcane-path-evolution tests passed');