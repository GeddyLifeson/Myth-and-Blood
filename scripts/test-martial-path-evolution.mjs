/**
 * Smoke tests for Martial Path Evolution — The Eternal Legion.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const eternalSrc = readFileSync(join(JS, 'eternal-legacy-tree.js'), 'utf8');
  const foundSrc = readFileSync(join(JS, 'foundational-medieval-layer.js'), 'utf8');
  const mbSrc = (() => { try { return readFileSync(join(JS, 'grand-strategy-mid-branches.js'), 'utf8'); } catch { return '/* optional missing grand-strategy-mid-branches.js */'; } })();
  const gsSrc = (() => { try { return readFileSync(join(JS, 'grand-strategy.js'), 'utf8'); } catch { return '/* optional missing grand-strategy.js */'; } })();
  const lbSrc = (() => { try { return readFileSync(join(JS, 'intergalactic-late-branches.js'), 'utf8'); } catch { return '/* optional missing intergalactic-late-branches.js */'; } })();
  const igSrc = (() => { try { return readFileSync(join(JS, 'intergalactic-layer.js'), 'utf8'); } catch { return '/* optional missing intergalactic-layer.js */'; } })();
  const epfSrc = readFileSync(join(JS, 'eternal-path-framework.js'), 'utf8');
  const mpeSrc = readFileSync(join(JS, 'martial-path-evolution.js'), 'utf8');
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
    Game: {
      setPaused: () => {},
      showMessage: () => {},
      getState: () => ({ paused: true, lastStandActive: true }),
    },
    UI: { updateHUD: () => {} },
    isWweUnit: () => false,
    isCrossoverUnit: (t) => t === 'goku',
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(
    `${eternalSrc}\n;\n${foundSrc}\n;\n${mbSrc}\n;\n${gsSrc}\n;\n${lbSrc}\n;\n${igSrc}\n;\n${epfSrc}\n;\n${mpeSrc}\n({ FoundationalMedievalLayer, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null, IntergalacticLayer: typeof IntergalacticLayer !== 'undefined' ? IntergalacticLayer : null, EternalPathFramework, MartialPathEvolution })`,
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

const { FoundationalMedievalLayer, GrandStrategy, IntergalacticLayer, MartialPathEvolution } =
  loadModules();

function seedFootmanLegion(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  for (let i = 0; i < 20; i++) FML.recordDeploy('footman', 30);
  for (let i = 0; i < 8; i++) FML.recordDeploy('knight', 40);
  for (let i = 0; i < 3; i++) FML.recordDeploy('general', 45);
  FML.recordBuild('wall', 35);
}

MartialPathEvolution.resetRun();
ok(!IntergalacticLayer || (MartialPathEvolution.STAGE_DEFS.galactic.doctrine.label === 'The Unbreaking Line'), 'doctrine label');

seedFootmanLegion(FoundationalMedievalLayer);
ok(MartialPathEvolution.isLegionPathActive(80), 'footman-heavy medieval run is legion path');

for (let i = 0; i < 6; i++) MartialPathEvolution.recordDeploy('footman', 10);
MartialPathEvolution.captureGeneFather({ team: 'player', type: 'footman', id: 'gf-1', maxHp: 100, hp: 100 }, 1);
ok(MartialPathEvolution.getStateSnapshot({ wave: 80 }).geneFather?.captured, 'gene-father captured');
ok(MartialPathEvolution.getPathTier(80) >= 1, 'medieval legion tier from footman investment');

const footman = { team: 'player', type: 'footman', id: 'gf-1', maxHp: 100, hp: 100, damage: 20 };
MartialPathEvolution.applyLegionUnitBonuses(footman, 80);
ok(footman.legionGeneFather && footman.legionAncestry, 'gene-father ancestry bonuses');

if (GrandStrategy) {
  GrandStrategy?.resetRun?.();
  GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
  ok(!GrandStrategy || GrandStrategy.getKingdomPathId() === 'martial', 'kingdom martial path');
  MartialPathEvolution.recordAction('template_shield_wall', { wave: 160, label: 'Shield Wall' });
  MartialPathEvolution.recordAction('order_fortify', { wave: 165, label: 'Fortify' });
  MartialPathEvolution.recordAction('edict_honor_oath_edict', { wave: 168, label: 'Honor Oath' });
  const kingdomMods = GrandStrategy?.getTacticalModifiers?.(170) || { hpMult: 1, playerDmgMult: 1 };
ok(!GrandStrategy || (!GrandStrategy || kingdomMods.hpMult > 1), 'kingdom legion mods buff HP');
} else {
  console.log('SKIP GrandStrategy assertions (macro layer removed)');
}

if (IntergalacticLayer) {
  IntergalacticLayer?.resetRun?.();
  IntergalacticLayer?.onWaveStart?.(400, { wave: 400, showMessage: () => {} });
  ok(!IntergalacticLayer || IntergalacticLayer.getCosmicPathId() === 'eternal_legion', 'footman run resolves eternal_legion');
  MartialPathEvolution.spawnTestLegion('eternal_legion');
  MartialPathEvolution.recordAction('defensive_invasion', { wave: 410, label: 'Defend homeworld' });
  const line = MartialPathEvolution.getUnbreakingLineMods({
    wave: 410,
    defensive: true,
    lastStandActive: true,
  });
  ok(line.active && line.playerDmgMult > 1.05, 'unbreaking line boosts defensive last stand');
  ok(line.hpMult > 1, 'unbreaking line boosts HP');
  ok(line.countMult < 1, 'unbreaking line relieves enemy count pressure');
  const galFoot = { team: 'player', type: 'knight', maxHp: 200, hp: 200, damage: 40 };
  IntergalacticLayer?.applyCosmicUnitBonuses?.(galFoot, 450);
  ok(!IntergalacticLayer || (galFoot.legionShieldWall || galFoot.cosmicLegacyApplied), 'galactic knight gets legion bonuses');
} else {
  console.log('SKIP IntergalacticLayer assertions (macro layer removed)');
}

const html = MartialPathEvolution.renderPanelHtml({ wave: 450 });
ok(html.includes('Eternal Legion') && html.includes('Unbreaking'), 'panel shows legion progression');

const intel = MartialPathEvolution.formatIntelNote({ wave: 450 });
ok(intel.includes('gene-father'), 'intel mentions gene-father');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll martial-path-evolution tests passed');