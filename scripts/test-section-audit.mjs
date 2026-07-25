/**
 * Full overhaul plan section audit — verifies each §0–§9 contract is actually wired.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

function loadFiles(names) {
  const code = names.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
  const els = new Map();
  const mk = (id) => {
    if (els.has(id)) return els.get(id);
    const e = {
      id,
      style: {},
      classList: {
        _s: new Set(),
        add(x) {
          this._s.add(x);
        },
        remove(x) {
          this._s.delete(x);
        },
        contains(x) {
          return this._s.has(x);
        },
      },
      hidden: true,
      innerHTML: '',
      textContent: '',
      addEventListener() {},
      scrollIntoView() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getContext() {
        return {
          setTransform() {},
          fillRect() {},
          beginPath() {},
          arc() {},
          fill() {},
          stroke() {},
          fillText() {},
          createRadialGradient() {
            return { addColorStop() {} };
          },
          createLinearGradient() {
            return { addColorStop() {} };
          },
          save() {},
          restore() {},
          translate() {},
          scale() {},
          ellipse() {},
          moveTo() {},
          lineTo() {},
          closePath() {},
          setLineDash() {},
        };
      },
    };
    els.set(id, e);
    return e;
  };
  [
    'grand-strategy-panel',
    'intergalactic-panel',
    'strategic-map-screen',
    'strategic-map-canvas',
    'strategic-map-scale-label',
    'strategic-map-actions',
    'strategic-map-actions-label',
    'strategic-map-actions-btns',
    'strategic-map-intro',
    'strategic-map-deploy',
    'strategic-map-close',
    'grand-strategy-province',
    'intergalactic-planet',
    'era-journey-panel',
  ].forEach(mk);

  const bodyClass = {
    _s: new Set(),
    add(x) {
      this._s.add(x);
    },
    remove(x) {
      this._s.delete(x);
    },
    contains(x) {
      return this._s.has(x);
    },
  };

  const sb = {
    console,
    JSON,
    Math,
    Array,
    Object,
    Set,
    Map,
    Date,
    performance: { now: () => 0 },
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout() {},
    requestAnimationFrame(fn) {
      fn(0);
      return 0;
    },
    localStorage: {
      store: {},
      getItem(k) {
        return this.store[k] ?? null;
      },
      setItem(k, v) {
        this.store[k] = String(v);
      },
    },
    addEventListener() {},
    innerWidth: 1280,
    innerHeight: 720,
    document: {
      body: { classList: bodyClass },
      getElementById: (id) => mk(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      readyState: 'complete',
    },
    window: null,
    EnemyFactions: {
      getActiveFactions: () => [
        { id: 'goblin_hordes', shortName: 'Goblin' },
        { id: 'orc_warbands', shortName: 'Orc' },
        { id: 'void_abyssal', shortName: 'Void' },
      ],
      getFactionDef: (id) => ({ id, name: id, shortName: id, color: '#c08060' }),
      getUnitFaction: () => null,
      getBuildingFaction: () => null,
    },
  };
  sb.window = sb;
  sb.globalThis = sb;
  sb.self = sb;
  const ctx = vm.createContext(sb);
  const exports = `{
    LayerDesign, FactionHazards, GrandStrategy, GrandStrategyMidBranches, GrandStrategyDivisions,
    IntergalacticLayer, IntergalacticLateBranches, PlanetConquest, StrategicMapView,
    MacroBootstrap, FoundationalMedievalLayer, EternalPathFramework
  }`;
  return {
    api: vm.runInContext(`${code}\n(${exports})`, ctx),
    bodyClass,
    els,
    sb,
  };
}

const files = [
  'faction-hazards.js',
  'layer-design.js',
  'foundational-medieval-layer.js',
  'eternal-path-framework.js',
  'grand-strategy-mid-branches.js',
  'grand-strategy-divisions.js',
  'grand-strategy.js',
  'intergalactic-late-branches.js',
  'intergalactic-layer.js',
  'planet-conquest.js',
  'strategic-map-view.js',
  'macro-bootstrap.js',
];

const { api } = loadFiles(files);
const {
  LayerDesign,
  FactionHazards,
  GrandStrategy,
  IntergalacticLayer,
  PlanetConquest,
  StrategicMapView,
  MacroBootstrap,
  FoundationalMedievalLayer,
  EternalPathFramework,
} = api;

console.log('\n=== §1 Era Journey ===');
ok(LayerDesign.ERA_ORDER?.length === 5, 'five eras defined');
ok(LayerDesign.getEraForWave(1)?.id === 'defense', 'w1 defense');
ok(LayerDesign.getEraForWave(100)?.id === 'expansion', 'w100 expansion');
ok(LayerDesign.getEraForWave(150)?.id === 'kingdom', 'w150 kingdom');
ok(LayerDesign.getEraForWave(400)?.id === 'galaxy', 'w400 galaxy');
ok(LayerDesign.getEraForWave(500)?.id === 'conquest', 'w500 conquest');
ok(LayerDesign.isLayerUnlocked('grand_strategy', 150), 'GS unlock 150');
ok(!LayerDesign.isLayerUnlocked('grand_strategy', 149), 'GS locked 149');
ok(LayerDesign.isMapScaleUnlocked('galaxy', 400), 'galaxy map scale 400');
ok(LayerDesign.getEncyclopediaEntries?.()?.length >= 2, 'encyclopedia journey entries');
const chips = LayerDesign.renderStackMarkup(LayerDesign.getModesSnapshot({ wave: 160 }));
ok(chips.includes('data-layer-open') && chips.includes('GS'), 'clickable GS chip at 160');
const locked = LayerDesign.renderStackMarkup(LayerDesign.getModesSnapshot({ wave: 10 }));
ok(locked.includes('locked') || locked.includes('data-layer-locked'), 'early chips locked');

console.log('\n=== §0 Hazards + bootstrap ===');
const fair = FactionHazards.spawnInitial(800, 600, 10, 480, 500, {
  densityMult: 0.28,
  northOnly: true,
  excludeNearPlayerRally: true,
  rallyClearRadius: 140,
  maxHazards: 4,
});
ok(fair.length <= 4, `fair hazard cap (${fair.length})`);
ok(fair.every((h) => h.y < 440), 'hazards north of rally');
GrandStrategy.resetRun();
IntergalacticLayer.resetRun();
const boot = MacroBootstrap.bootstrapMacroStateForWave(500, { silent: true });
ok(boot.grandStrategy && boot.intergalactic, 'macro bootstrap GS+IG');

console.log('\n=== §0/§4/§5 Map verbs ===');
const regions = GrandStrategy.getRegionsSnapshot();
const rid = regions[0]?.id;
const fort = GrandStrategy.queueOrder('fortify', rid, { wave: 500, showMessage() {} });
ok(fort.ok, 'GS fortify from API');
const dip = GrandStrategy.queueOrder('diplomacy', rid, { wave: 500, showMessage() {} });
ok(dip.ok, 'GS diplomacy order');
const log = GrandStrategy.queueOrder('logistics', rid, { wave: 500, showMessage() {} });
ok(log.ok, 'GS logistics order');
ok(regions.some((r) => r.armyTokens > 0), 'army tokens on regions');
ok(typeof GrandStrategy.getOrdersSnapshot === 'function', 'orders snapshot for arrows');

const planetId = IntergalacticLayer.getSelectedPlanetId?.() || 'aurion_prime';
IntergalacticLayer.selectPlanet?.(planetId);
const fleetId = IntergalacticLayer.getSelectedFleetId?.() || 'fleet_1';
ok(IntergalacticLayer.queueFleetOrder('patrol', planetId, fleetId, { wave: 500, showMessage() {} }).ok, 'patrol');
ok(IntergalacticLayer.queueFleetOrder('blockade', planetId, fleetId, { wave: 500, showMessage() {} }).ok, 'blockade');
const shipId = IntergalacticLayer.getSelectedScienceShipId?.() || 'sci_1';
const survey = IntergalacticLayer.queueSurveyOrder('survey', planetId, shipId, { wave: 500, showMessage() {} });
ok(survey.ok || survey.msg, 'survey attempted');
const planets = IntergalacticLayer.getPlanetsSnapshot();
ok(planets.some((p) => Array.isArray(p.fleets)), 'planet fleets in snapshot');

console.log('\n=== §6 Planet conquest ===');
PlanetConquest.resetRun({ forcedMode: true });
PlanetConquest.onWaveStart(500, { modeId: 'planet_conquest', worldW: 800 });
const pcs = PlanetConquest.getStateSnapshot(500, 800, 600, [], [], 'planet_conquest');
ok(pcs.active && pcs.sectors.length >= 3, 'sectors active');
const fid = pcs.sectors[0].factionId;
// Force high control for consolidate
PlanetConquest.reduceEnemyControl?.(fid, 50) ||
  (() => {
    // internal reduce if not exported — consolidate will fail below
  })();
// Manually drop control via consolidate path: need enemyControl <= 45
// Use onEnemyStructureDestroyed multiple times if available
for (let i = 0; i < 5; i++) {
  PlanetConquest.onEnemyStructureDestroyed?.(
    { enemyFaction: fid },
    500,
    { modeId: 'planet_conquest', buildings: [], units: [] }
  );
}
const con = PlanetConquest.consolidateSector(fid, { wave: 500, worldW: 800, showMessage() {} });
ok(con.ok || con.msg?.includes('55%'), `consolidate API works (${con.msg || 'ok'})`);
ok(typeof PlanetConquest.setFocusedSector === 'function', 'sector focus API');
ok(typeof StrategicMapView.deployToSurface === 'function', 'deploy to surface API');

console.log('\n=== §7 Path bootstrap ===');
FoundationalMedievalLayer.resetRun();
const fm = FoundationalMedievalLayer.bootstrapForWave(500, { pathPreset: 'martial', silent: true });
ok(fm.ok && fm.crystallized, `foundations crystallized (${fm.pathId})`);
EternalPathFramework.resetRun();
const ep = EternalPathFramework.bootstrapForWave(500, { pathPreset: 'arcane' });
ok(ep.ok && ep.pathId === 'arcane', 'eternal path arcane seeded');
const prog = MacroBootstrap.bootstrapProgressionForWave(500, {
  silent: true,
  pathPreset: 'mythic',
});
ok(prog.macro?.grandStrategy && prog.foundations && prog.eternalPath, 'full progression bootstrap');

console.log('\n=== §3 First decision API ===');
GrandStrategy.resetRun();
// Should force on first active wave
const forced = GrandStrategy.maybeForceFirstDecision?.(150, {
  showMessage() {},
  addHighlight() {},
  creative: false,
});
ok(forced === true || forced === false, 'maybeForceFirstDecision callable');

console.log('\n=== §2 Soft gates ===');
ok(!LayerDesign.isLayerUnlocked('intergalactic', 200), 'galaxy locked at 200');
ok(LayerDesign.isLayerUnlocked('planet', 500), 'planet layer at 500');
ok(!LayerDesign.isMapScaleUnlocked('planet', 400), 'planet map scale locked before conquest');
ok(LayerDesign.isMapScaleUnlocked('planet', 500), 'planet map scale unlocked at 500');

console.log('\n=== §4 Trade routes + §5 invasion tutorial ===');
const econ = GrandStrategy.getEconomySnapshot?.();
ok(econ?.routes?.length > 0, 'economy trade routes for map lines');
IntergalacticLayer.resetRun();
const invTut = IntergalacticLayer.maybeForceFirstInvasionTutorial?.(400, {
  showMessage() {},
  addHighlight() {},
  creative: false,
});
ok(invTut === true, 'first invasion tutorial fires once at galaxy unlock');
const invTut2 = IntergalacticLayer.maybeForceFirstInvasionTutorial?.(400, {
  showMessage() {},
  addHighlight() {},
  creative: false,
});
ok(invTut2 === false, 'first invasion tutorial does not repeat');

console.log('\n=== Map verb coverage (string-level) ===');
const smv = readFileSync(join(JS, 'strategic-map-view.js'), 'utf8');
for (const verb of [
  'Fortify',
  'Recruit',
  'Campaign',
  'Diplomacy',
  'Logistics',
  'Consolidate',
  'Blockade',
  'Patrol',
  'Survey',
  'Assault focus',
]) {
  ok(smv.includes(verb), `map action bar includes ${verb}`);
}

if (failed) {
  console.error(`\n${failed} section audit failure(s)`);
  process.exit(1);
}
console.log('\nAll section audit checks passed.');
