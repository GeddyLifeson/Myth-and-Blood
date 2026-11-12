/**
 * Smoke tests for Eternal Path Framework — four paths across all layers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

function loadModules() {
  const eternalSrc = readFileSync(join(JS, 'eternal-legacy-tree.js'), 'utf8');
  const foundSrc = readFileSync(join(JS, 'foundational-medieval-layer.js'), 'utf8');
  const techSrc = readFileSync(join(JS, 'tech-tree-branches.js'), 'utf8');
  const mbSrc = (() => {
    try {
      return readFileSync(join(JS, 'grand-strategy-mid-branches.js'), 'utf8');
    } catch {
      return '/* optional missing grand-strategy-mid-branches.js */';
    }
  })();
  const gsSrc = (() => {
    try {
      return readFileSync(join(JS, 'grand-strategy.js'), 'utf8');
    } catch {
      return '/* optional missing grand-strategy.js */';
    }
  })();
  const lbSrc = (() => {
    try {
      return readFileSync(join(JS, 'intergalactic-late-branches.js'), 'utf8');
    } catch {
      return '/* optional missing intergalactic-late-branches.js */';
    }
  })();
  const igSrc = (() => {
    try {
      return readFileSync(join(JS, 'intergalactic-layer.js'), 'utf8');
    } catch {
      return '/* optional missing intergalactic-layer.js */';
    }
  })();
  const epfSrc = readFileSync(join(JS, 'eternal-path-framework.js'), 'utf8');
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
    isCrossoverUnit: (t) => t === 'goku',
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(
    `${eternalSrc}\n;\n${foundSrc}\n;\n${techSrc}\n;\n${mbSrc}\n;\n${gsSrc}\n;\n${lbSrc}\n;\n${igSrc}\n;\n${epfSrc}\n({ FoundationalMedievalLayer, TechTreeBranches, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null, IntergalacticLayer: typeof IntergalacticLayer !== 'undefined' ? IntergalacticLayer : null, EternalPathFramework })`,
    ctx
  );
}

const { FoundationalMedievalLayer, GrandStrategy, IntergalacticLayer, EternalPathFramework } =
  loadModules();

EternalPathFramework.resetRun();
ok(EternalPathFramework.PATH_IDS.length === 4, 'four eternal paths');
ok(
  EternalPathFramework.mapFoundationToPath('longbow_legacy') === 'martial',
  'foundation maps to martial'
);
ok(EternalPathFramework.mapCosmicToPath('aether_lords') === 'arcane', 'cosmic maps to arcane');

FoundationalMedievalLayer.resetRun();
FoundationalMedievalLayer.onRunStart({ creative: false });
for (let i = 0; i < 15; i++) FoundationalMedievalLayer.recordDeploy('archer', 25);

EternalPathFramework.onWaveStart(400, { wave: 400, showMessage: () => {} });
const snap = EternalPathFramework.getStateSnapshot({ wave: 400 });
ok(snap.dominantPathId === 'martial', 'martial archers dominate investment');
ok(snap.eras.medieval.pathId === 'martial', 'medieval era recorded martial');
ok(!GrandStrategy || snap.eras.kingdom.pathId === 'martial', 'kingdom era recorded martial');
ok(
  !IntergalacticLayer || snap.eras.galactic.pathId === 'martial',
  'galactic era recorded void rangers martial'
);

const martialProg = snap.paths.find((p) => p.id === 'martial');
ok(martialProg?.chain.medieval !== '—', 'martial shows medieval chain');

const mods = EternalPathFramework.getFrameworkMods(400);
ok(mods.playerDmgMult > 1, 'framework mods buff damage');
const gsMods = GrandStrategy?.getTacticalModifiers?.(400) || { hpMult: 1, playerDmgMult: 1 };
ok(!GrandStrategy || gsMods.playerDmgMult > 1, 'grand strategy merges eternal path mods');

const footman = { team: 'player', type: 'footman', maxHp: 100, hp: 100, damage: 20 };
EternalPathFramework.applyPathUnitBonuses(footman, 400);
ok(footman.eternalPathBonus === 'martial', 'martial footman receives path bonus');

const intel = EternalPathFramework.formatIntelNote({ wave: 400 });
ok(intel.includes('martial'), 'intel mentions martial path');

EternalPathFramework.spawnTestInvestment('arcane');
const arcHud = EternalPathFramework.formatHudLine({ wave: 400 });
ok(arcHud.includes('Arcane'), 'hud shows arcane dominant');

const html = EternalPathFramework.renderPanelHtml({ wave: 400 });
ok(html.includes('ETERNAL PATHS'), 'panel html renders');
ok(html.includes('Medieval'), 'panel shows era chain');

if (failures()) {
  console.error(`\n${failures()} test(s) failed`);
  process.exit(1);
}
console.log('\nAll eternal-path-framework tests passed');
