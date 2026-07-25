/**
 * Static contract audit — every overhaul plan section §0–§9 against source.
 * Complements behavioral tests in test-section-audit.mjs.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const gs = read('js/grand-strategy.js');
const ig = read('js/intergalactic-layer.js');
const smv = read('js/strategic-map-view.js');
const game = read('js/game.js');
const fh = read('js/faction-hazards.js');
const mb = read('js/macro-bootstrap.js');
const ld = read('js/layer-design.js');
const ui = read('js/ui.js');
const pw = read('js/planet-warfare.js');
const pc = read('js/planet-conquest.js');
const fi = read('js/faction-intel.js');
const fm = read('js/foundational-medieval-layer.js');
const epf = read('js/eternal-path-framework.js');
const modes = read('js/game-modes.js');
const onb = read('js/onboarding.js');
const idx = read('index.html');
const css = read('css/style.css');
const hm = read('scripts/headless-manifest.mjs');

console.log('\n=== §0 Immediate feel-breakers ===');
const gsOpen = gs.match(/function openPanel\(\)[\s\S]{0,900}/)?.[0] || '';
const igOpen = ig.match(/function openPanel\(\)[\s\S]{0,900}/)?.[0] || '';
ok(gsOpen.includes('macro-command-dock') && gsOpen.includes('StrategicMapView.open'), '0.1 GS openPanel docks + map');
ok(!/StrategicMapView\.open\([^)]*\);\s*return;/.test(gsOpen), '0.1 GS no early-return after map');
ok(igOpen.includes('macro-command-dock') && igOpen.includes('StrategicMapView.open'), '0.1 IG openPanel docks + map');
ok(css.includes('macro-command-dock') && css.includes('strategic-map-actions'), '0.1 CSS dock + action bar');
ok(
  ['Fortify', 'Recruit', 'Campaign', 'Diplomacy', 'Logistics'].every((v) => smv.includes(v)),
  '0.2 kingdom verbs'
);
ok(['Patrol', 'Survey', 'Blockade', 'Invade'].every((v) => smv.includes(v)), '0.2 galaxy verbs');
ok(
  ['Assault focus', 'Consolidate', 'Deploy', 'Intel'].every((v) => smv.includes(v)),
  '0.2 planet verbs'
);
ok(idx.includes('strategic-map-actions') && idx.includes('strategic-map-intro'), '0.2/0.3 map HUD DOM');
ok(game.includes('intro: true') && game.includes('planet_conquest'), '0.3 conquest intro open');
ok(smv.includes('deployToSurface') && smv.includes('if (!canvas) return false'), '0.3 deploy + fail-closed open (no canvas)');
ok(smv.includes('if (!ctx) return false'), '0.3 fail-closed open (no 2d context)');
ok(
  fh.includes('densityMult') && fh.includes('northOnly') && fh.includes('excludeNearPlayerRally'),
  '0.4 hazard opts'
);
ok(game.includes('setHazardSpawnOpts') && game.includes('densityMult: 0.28'), '0.4 conquest fair spawn');
ok(game.includes('ember rings') || game.includes('orc fire'), '0.4 surface burn toast');
ok(mb.includes('bootstrapMacroStateForWave') && mb.includes('bootstrapProgressionForWave'), '0.5 macro bootstrap');
ok(gs.includes('function bootstrapForWave') && ig.includes('function bootstrapForWave'), '0.5 GS/IG bootstrap');

console.log('\n=== §1 Layer identity ===');
ok(ld.includes('ERA_DEFS') && ld.includes('One Crown, Five Eras'), '1 era journey SSOT');
ok(
  ['defense', 'expansion', 'kingdom', 'galaxy', 'conquest'].every((e) => ld.includes(e)),
  '1 five era ids'
);
ok(ld.includes('openLayer') && ld.includes('renderStackMarkup') && ld.includes('renderEraBarMarkup'), '1 chips/open');
ok(idx.includes('era-journey-panel') && idx.includes('era-journey-bar'), '1 menu+HUD journey UI');
ok(ld.includes('getEncyclopediaEntries'), '1 encyclopedia hooks');
ok(ld.includes('pauseContract') || ld.includes('pauseContract'), '1 pause contract documented');

console.log('\n=== §2 Wave defense polish ===');
ok(ui.includes('gsUnlocked') && ui.includes('igUnlocked'), '2 soft-lock flags');
ok(ui.includes('layer-btn-locked'), '2 soft-lock CSS class on buttons (visible+disabled)');
ok(ld.includes('locked') && (ld.includes('data-layer-locked') || ld.includes('layer-mode-chip')), '2 locked chips');
ok(onb.includes('onboarding-journey') || onb.includes('Defend'), '2 onboarding guided start');

console.log('\n=== §3 AoE / foundations ===');
ok(pw.includes('push north') || pw.includes('Hostile front'), '3 front announcement');
ok(gs.includes('maybeForceFirstDecision'), '3 first GS decision');
ok(game.includes('bootstrapAcademyEraStart') && game.includes('bootstrapProgressionForWave'), '3 academy seed');

console.log('\n=== §4 Kingdom map play ===');
ok(smv.includes('drawArmyToken') && smv.includes('drawOrderArrow'), '4 tokens + arrows');
ok(smv.includes('routes') || smv.includes('trade') || smv.includes('Granary') || smv.includes('route'), '4 trade lines');
ok(gs.includes('Tactical effect:') && gs.includes('getOrdersSnapshot') && gs.includes('armyTokens'), '4 feedback+snapshots');
ok(gs.includes('unrest') && smv.includes('unrest'), '4 unrest on map');

console.log('\n=== §5 Galaxy map play ===');
ok(smv.includes('fleets') && smv.includes('scienceShips') && smv.includes('surveyProgress'), '5 fleet/science/survey');
ok(ig.includes('maybeForceFirstInvasionTutorial'), '5 first invasion tutorial');
ok(ig.includes('queueFleetOrder') && ig.includes('queueSurveyOrder'), '5 fleet/survey APIs');

console.log('\n=== §6 Planet conquest ===');
ok(pc.includes('consolidateSector') && pc.includes('setFocusedSector') && pc.includes('getSectorCenterX'), '6 sector APIs');
ok(fi.includes('focusFaction'), '6 intel focus');
ok(smv.includes('WORLDHEART') || smv.includes('PLANET SECURED'), '6 boss/secured chrome');
ok(game.includes('onPlanetConquestSurfaceDeploy'), '6 surface deploy hook');

console.log('\n=== §7 Continuity ===');
ok(fm.includes('function bootstrapForWave'), '7 FM bootstrap real');
ok(epf.includes('function bootstrapForWave'), '7 EPF bootstrap real');
ok(modes.includes('pathPreset') && modes.includes('PATH_PRESETS'), '7 path presets');
ok(game.includes('getSession()') && game.includes('pathPreset'), '7 session pathPreset safe');
ok(read('js/martial-path-evolution.js').includes('bootstrapForWave'), '7 martial path bootstrap');
ok(read('js/arcane-path-evolution.js').includes('bootstrapForWave'), '7 arcane path bootstrap');
ok(read('js/tech-path-evolution.js').includes('bootstrapForWave'), '7 tech path bootstrap');
ok(read('js/mythic-path-evolution.js').includes('bootstrapForWave'), '7 mythic path bootstrap');
ok(game.includes('conquestHazardGraceWaves'), '0/7 durable conquest hazard grace');

console.log('\n=== §8 Teaching ===');
ok(onb.includes('onboarding-journey'), '8 onboarding journey');
ok(idx.includes('Shift+G') || idx.includes('THE JOURNEY') || idx.includes('era-journey'), '8 menu/how-to journey');
ok(ld.includes('getEncyclopediaEntries'), '8 encyclopedia');

console.log('\n=== §9 Tests & wiring ===');
ok(existsSync(join(ROOT, 'scripts/test-section-audit.mjs')), '9 section audit test');
ok(existsSync(join(ROOT, 'scripts/test-macro-section0.mjs')), '9 macro test');
ok(
  hm.includes('macro-bootstrap.js') &&
    hm.includes('strategic-map-view.js') &&
    hm.includes('grand-strategy.js') &&
    hm.includes('layer-design.js') &&
    hm.includes('martial-path-evolution.js') &&
    hm.includes('mythic-path-evolution.js'),
  '9 headless strategy stack (+ path evolution)'
);
ok(idx.includes('macro-bootstrap.js') && idx.includes('strategic-map-view.js'), '9 index.html has map+bootstrap');
// Path modules must load before macro-bootstrap so jump-in can seed them.
const idxMartial = idx.indexOf('martial-path-evolution.js');
const idxMacro = idx.indexOf('macro-bootstrap.js');
ok(idxMartial > 0 && idxMacro > idxMartial, '9 index.html: path evolution before macro-bootstrap');
ok(smv.includes('const G = ()') || smv.includes('typeof Game !=='), '9 safe Game access');

if (failed) {
  console.error(`\n${failed} contract check(s) failed`);
  process.exit(1);
}
console.log('\nAll plan section contracts present in source.');
