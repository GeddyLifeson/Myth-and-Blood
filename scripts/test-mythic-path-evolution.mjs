/**
 * Smoke tests for Mythic Path Evolution — Crossover (starts locked).
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
  const mypSrc = readFileSync(join(JS, 'mythic-path-evolution.js'), 'utf8');
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
    isWweUnit: (t) => t === 'john_cena',
    isCrossoverUnit: (t) => t === 'goku' || t === 'tank_dempsey',
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(
    `${eternalSrc}\n;\n${foundSrc}\n;\n${techSrc}\n;\n${mbSrc}\n;\n${gsSrc}\n;\n${lbSrc}\n;\n${igSrc}\n;\n${epfSrc}\n;\n${mypSrc}\n({ FoundationalMedievalLayer, TechTreeBranches, GrandStrategy: typeof GrandStrategy !== 'undefined' ? GrandStrategy : null, IntergalacticLayer: typeof IntergalacticLayer !== 'undefined' ? IntergalacticLayer : null, MythicPathEvolution })`,
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

const { FoundationalMedievalLayer, GrandStrategy, IntergalacticLayer, MythicPathEvolution } =
  loadModules();

function seedMythicRun(FML) {
  FML.resetRun();
  FML.onRunStart({ creative: false });
  FML.recordDeploy('goku', 40);
  FML.recordDeploy('tank_dempsey', 45);
  FML.recordFaction('gears', 50);
}

MythicPathEvolution.resetRun();
ok(MythicPathEvolution.getStateSnapshot({ wave: 10 }).locked, 'mythic path starts locked');
ok(!MythicPathEvolution.isPantheonPathActive(10), 'inactive while locked');

const lockedHtml = MythicPathEvolution.renderPanelHtml({ wave: 5 });
ok(lockedHtml.includes('Locked'), 'locked panel shows');
const intelLocked = MythicPathEvolution.formatIntelNote({ wave: 5 });
ok(intelLocked.includes('locked'), 'intel mentions locked state');

MythicPathEvolution.recordDeploy('goku', 12);
ok(!MythicPathEvolution.getStateSnapshot({ wave: 12 }).locked, 'unlocks on crossover deploy');
ok(MythicPathEvolution.isPantheonPathActive(12), 'active after unlock');

seedMythicRun(FoundationalMedievalLayer);
for (let i = 0; i < 4; i++) MythicPathEvolution.recordDeploy('goku', 30);
MythicPathEvolution.captureFirstChampion(
  { team: 'player', type: 'goku', id: 'ch-1', maxHp: 120, hp: 120, damage: 50 },
  12
);
ok(MythicPathEvolution.getStateSnapshot({ wave: 60 }).firstChampion?.captured, 'first champion captured');

const hero = { team: 'player', type: 'goku', id: 'ch-1', maxHp: 120, hp: 120, damage: 50 };
MythicPathEvolution.applyChampionUnitBonuses(hero, 60);
ok(hero.firstChampion && hero.championLineage, 'first champion bonuses');

if (GrandStrategy) {
GrandStrategy?.resetRun?.();
GrandStrategy?.onWaveStart?.(150, { wave: 150, showMessage: () => {} });
} else {
  console.log('SKIP GrandStrategy assertions (macro layer removed)');
}
ok(!GrandStrategy || GrandStrategy.getKingdomPathId() === 'mythic', 'kingdom mythic path');
MythicPathEvolution.recordAction('edict_heroic_muster', { wave: 155, label: 'Heroic Muster' });
MythicPathEvolution.recordAction('recruit_hero_echo', { wave: 160, label: 'Echo' });

const kingdomMods = GrandStrategy?.getTacticalModifiers?.(165) || { hpMult: 1, playerDmgMult: 1 };
ok(!GrandStrategy || kingdomMods.playerDmgMult > 1, 'bloodline mods buff damage');
ok(!GrandStrategy || kingdomMods.eliteSlots > 0, 'bloodline grants elite slots');

if (IntergalacticLayer) {
IntergalacticLayer?.resetRun?.();
IntergalacticLayer?.onWaveStart?.(400, { wave: 400, showMessage: () => {} });
} else {
  console.log('SKIP IntergalacticLayer assertions (macro layer removed)');
}
ok(!IntergalacticLayer || IntergalacticLayer.getCosmicPathId() === 'pantheon_ascendant', 'mythic resolves pantheon');

MythicPathEvolution.spawnTestPantheon('pantheon');
const armada = MythicPathEvolution.getGodbloodArmadaMods({ wave: 410, invasionActive: true });
ok(armada.active && armada.eternalChampion, 'godblood armada active');
ok(armada.countMult < 1, 'armada relieves enemy pressure');

const galHero = { team: 'player', type: 'goku', id: 'ch-1', maxHp: 200, hp: 200, damage: 60 };
IntergalacticLayer?.applyCosmicUnitBonuses?.(galHero, 450);
ok(!IntergalacticLayer || (galHero.eternalChampion || galHero.pantheonAscendant || galHero.cosmicLegacyApplied), 'galactic god champion');

MythicPathEvolution.spawnTestPantheon('pantheon');
const html = MythicPathEvolution.renderPanelHtml({ wave: 450 });
ok(html.includes('Pantheon') || html.includes('Bloodlines'), 'unlocked panel shows progression');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll mythic-path-evolution tests passed');