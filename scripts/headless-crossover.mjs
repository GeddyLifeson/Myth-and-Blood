/**
 * Headless runtime tests for crossover UI, abilities, synergies, and perk machines.
 * Run: node scripts/headless-crossover.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');

const FILES = [
  'floatingText.js', 'pathfinding.js', 'spatial.js', 'gfx-quality.js', 'sprites.js', 'visual-polish.js', 'audio.js', 'particles.js', 'effects.js', 'strike-fx.js',
  'units.js', 'meta-progress.js', 'crossover.js', 'faction-depth.js', 'perks.js', 'content-expansion.js', 'wwe.js',
  'achievements-data.js', 'achievements.js', 'cheats.js', 'advanced-difficulty.js',
  'legacy.js', 'chronicles.js', 'lore-data.js', 'game-modes.js',
  'encyclopedia.js', 'creative-tools.js', 'game-depth.js', 'colony-value.js', 'game.js',
];

const issues = [];
function fail(msg) { issues.push(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }

const noop = () => {};
function ctx2d() {
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', globalAlpha: 1,
    setLineDash: noop, save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, beginPath: noop,
    closePath: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop, arc: noop, fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    fillText: noop, drawImage: noop, ellipse: noop, rect: noop, clip: noop, clearRect: noop,
    measureText: () => ({ width: 10 }), getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop, createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
  };
}

function el(id = '') {
  const listeners = new Map();
  let _html = '';
  const childEls = [];
  return {
    id, className: '', classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
    style: {}, textContent: '', value: '', dataset: {},
    get innerHTML() { return _html; },
    set innerHTML(v) {
      _html = v;
      childEls.length = 0;
      const re = /data-(?:faction|crossover)="([^"]+)"/g;
      let m;
      while ((m = re.exec(v))) {
        const attr = m[0].includes('faction') ? 'faction' : 'crossover';
        const e = el(`${attr}-${m[1]}`);
        e.dataset[attr] = m[1];
        e.className = v.includes(`data-${attr}="${m[1]}"`) && v.includes('selected') ? 'selected crossover-card' : 'crossover-card';
        childEls.push(e);
      }
      const tabRe = /data-faction="([^"]+)"/g;
      while ((m = tabRe.exec(v))) {
        const e = el(`tab-${m[1]}`);
        e.dataset.faction = m[1];
        e.className = v.includes(`data-faction="${m[1]}"`) && v.includes('active') ? 'crossover-tab active' : 'crossover-tab';
        if (!childEls.find(c => c.dataset.faction === m[1])) childEls.push(e);
      }
    },
    addEventListener: (ev, fn) => { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); },
    removeEventListener: noop,
    click: noop,
    appendChild: (c) => c,
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel === '.crossover-tab' || sel === '.crossover-card') {
        return childEls.filter(c => sel === '.crossover-tab' ? c.dataset.faction : c.dataset.crossover);
      }
      return childEls;
    },
    getContext: (t) => (t === '2d' ? ctx2d() : null),
    width: 64, height: 64,
  };
}

function boot(seed = 1) {
  const store = new Map();
  const ids = new Map();
  const mk = (id) => { const e = el(id); ids.set(id, e); return e; };
  [
    'achievement-toast', 'ach-toast-name', 'ach-toast-desc', 'menu-screen',
    'crossover-roster-grid', 'crossover-faction-tabs', 'crossover-selected-detail',
    'crossover-screen', 'crossover-recruit-btn', 'crossover-build-btn', 'crossover-hub-open', 'crossover-close',
  ].forEach(mk);

  let rng = seed;
  const M = Object.create(Math);
  M.random = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };

  const cvs = { width: 1280, height: 720, style: {}, getContext: (t) => (t === '2d' ? ctx2d() : null), addEventListener: noop };
  const sb = {
    console, JSON, Array, Object, String, Number, Boolean, Map, Set, parseInt, parseFloat,
    isNaN, isFinite, undefined, NaN, Infinity, Math: M,
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: (fn) => { fn(); return 0; }, cancelAnimationFrame: noop,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() },
    performance: { now: () => 0, memory: null }, AudioContext: null, innerWidth: 1280, innerHeight: 720,
    addEventListener: noop, removeEventListener: noop,
    document: { getElementById: (id) => ids.get(id) || mk(id), querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: () => el(), hidden: false },
    canvas: cvs,
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  return { sb, cvs, ids };
}

function loadGame() {
  const { sb, cvs } = boot(42);
  const code = FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
  const exp = vm.runInContext(
    `${code}\n({ Game, Cheats, MetaProgress, FactionDepth, CrossoverHub, Perks, GameModes, FloatingText, SpriteGen, StrikeFX, ColonyValue, createUnit, perkMachinesUnlocked, ACADEMY_ERA_WAVE, BuildDefs })`,
    vm.createContext(sb),
  );
  exp.Game.init(cvs);
  return { ...exp, sb };
}

function makeMockCtx(units = []) {
  const damageLog = [];
  return {
    units,
    damageLog,
    unitDistance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    takeDamage: (u, amt, opts = {}) => {
      damageLog.push({ id: u.id, amt, crit: !!opts.crit, hpBefore: u.hp });
      u.hp = Math.max(0, u.hp - amt);
    },
    damageInRadius: (x, y, r, amt, team) => {
      for (const e of units) {
        if (e.team !== 'enemy' || e.hp <= 0) continue;
        if (Math.hypot(e.x - x, e.y - y) <= r) {
          damageLog.push({ id: e.id, amt, aoe: true });
          e.hp = Math.max(0, e.hp - amt);
        }
      }
    },
    ach: noop,
    showMessage: noop,
    getStarCount: () => 0,
  };
}

function mkUnit(createUnitFn, type, x, y, team = 'player', extra = {}) {
  const u = createUnitFn(type, x, y, team);
  Object.assign(u, extra);
  return u;
}

// --- Perk machines ---
function testPerkMachines(MP, perksUnlocked) {
  MP.reset();
  assert(!perksUnlocked(), 'perk machines should be locked before any crossover unlock');
  MP.unlock115();
  assert(perksUnlocked(), 'perk machines should unlock after Element 115');
  MP.reset();
  MP.unlockWweAcademy();
  assert(perksUnlocked(), 'perk machines should unlock after WWE');
}

// --- Crossover HQ UI ---
function testCrossoverHubUI(MP, Hub, doc) {
  MP.unlockAllCheatContent();
  Hub.init();

  const gsNoBase = {
    tactical: 500,
    wave: 100,
    crossoverBuildings: [],
    crossoverOnField: [],
  };
  Hub.renderRoster(gsNoBase);
  const grid = doc.getElementById('crossover-roster-grid');
  const tabs = doc.getElementById('crossover-faction-tabs');
  assert(tabs.innerHTML.includes('Element 115') || tabs.innerHTML.includes('Ultimis'), 'faction tabs should render unlocked factions');
  assert(grid.innerHTML.includes('Tank Dempsey'), 'roster grid should list Tank Dempsey');
  assert(grid.innerHTML.includes('Need barracks on field'), 'cards should show barracks prerequisite');

  const gsWithBase = {
    tactical: 500,
    wave: 100,
    crossoverBuildings: ['element_barracks'],
    crossoverOnField: [],
  };
  Hub.renderRoster(gsWithBase);
  assert(!grid.innerHTML.includes('Need barracks on field') || grid.innerHTML.includes('Tank Dempsey'),
    'ultimis roster should not show need-base when barracks on field');

  const buildBtn = doc.getElementById('crossover-build-btn');
  assert(typeof buildBtn.addEventListener === 'function', 'build button should be wired in init');

  const ultimisRoster = Hub.rosterForFaction('ultimis');
  assert(ultimisRoster.some(([id]) => id === 'tank_dempsey'), 'rosterForFaction ultimis includes tank_dempsey');
}

// --- Ability procs ---
function testAbilityProcs(FD, createUnitFn) {
  const ctx = makeMockCtx([]);
  FD.bind(ctx);

  // Frag Out — splash on clustered foes
  const dempsey = mkUnit(createUnitFn, 'tank_dempsey', 100, 200);
  dempsey.wweAbility = 'frag_out';
  const primary = mkUnit(createUnitFn, 'goblin', 200, 200, 'enemy');
  const cluster1 = mkUnit(createUnitFn, 'goblin', 215, 205, 'enemy');
  const cluster2 = mkUnit(createUnitFn, 'goblin', 220, 198, 'enemy');
  const far = mkUnit(createUnitFn, 'goblin', 400, 200, 'enemy');
  ctx.units = [dempsey, primary, cluster1, cluster2, far];
  FD.applyToUnit(dempsey, ctx.units);
  ctx.damageLog.length = 0;
  FD.processAbilityHit(dempsey, primary, 50);
  const splashed = ctx.damageLog.filter(d => d.id !== primary.id);
  assert(splashed.length >= 2, `frag_out should splash clustered foes (got ${splashed.length})`);

  // Star Platinum — bonus on pinned foe
  const jotaro = mkUnit(createUnitFn, 'jotaro_kujo', 100, 300);
  jotaro.wweAbility = 'star_platinum';
  const pinned = mkUnit(createUnitFn, 'orc', 130, 300, 'enemy', { pinned: true, hp: 80, maxHp: 100 });
  ctx.units = [jotaro, pinned];
  ctx.damageLog.length = 0;
  FD.processAbilityHit(jotaro, pinned, 40);
  assert(ctx.damageLog.some(d => d.crit && d.amt >= 28), 'star_platinum should crit pinned foe');

  // Hakai — executes wounded foes
  const beerus = mkUnit(createUnitFn, 'beerus', 100, 400);
  beerus.wweAbility = 'hakai';
  const wounded = mkUnit(createUnitFn, 'troll', 130, 400, 'enemy', { hp: 20, maxHp: 200 });
  ctx.units = [beerus, wounded];
  ctx.damageLog.length = 0;
  FD.processAbilityHit(beerus, wounded, 35);
  assert(ctx.damageLog.some(d => d.crit && d.amt >= 35), 'hakai should crit-delete wounded foe');

  // ORA rush alias — oorah wave-start buff (Johnson-style halo)
  const johnson = mkUnit(createUnitFn, 'sgt_johnson', 200, 200);
  johnson.wweAbility = 'oorah';
  johnson.isCrossover = true;
  const ally = mkUnit(createUnitFn, 'footman', 210, 205, 'player', { morale: 10, maxMorale: 30 });
  ctx.units = [johnson, ally];
  const moraleBefore = ally.morale;
  FD.onWaveStart(ctx.units);
  assert(ally.morale > moraleBefore, 'oorah wave start should buff nearby allies');

  FD.bind(null);
}

// --- Synergies & mastery during waves ---
function testSynergiesAndMastery(FD, createUnitFn) {
  const dempsey = mkUnit(createUnitFn, 'tank_dempsey', 100, 200);
  const primisNik = mkUnit(createUnitFn, 'primis_nikolai', 120, 200);
  dempsey.isCrossover = true;
  primisNik.isCrossover = true;
  const army = [dempsey, primisNik];

  const syns = FD.computeSynergies(army);
  assert(syns.some(s => s.id === 'temporal_paradox'), 'ultimis+primis should activate temporal_paradox');

  FD.applyToUnit(dempsey, army);
  assert((dempsey.synergyAbility || 0) >= 0.12, 'temporal_paradox should grant +12% ability damage');

  const mod = FD.modifyDamage(dempsey, mkUnit(createUnitFn, 'goblin', 150, 200, 'enemy'), 100);
  assert(mod > 100, 'synergy ability damage should amplify crossover hits');

  const guestArmy = [
    mkUnit(createUnitFn, 'stone_cold', 50, 50),
    mkUnit(createUnitFn, 'tank_dempsey', 80, 50),
  ];
  guestArmy[0].isWwe = true;
  guestArmy[1].isCrossover = true;
  const guestSyns = FD.computeSynergies(guestArmy);
  assert(guestSyns.some(s => s.id === 'guest_star'), 'WWE + second faction should trigger guest_star');

  const moraleUnit = mkUnit(createUnitFn, 'footman', 100, 100, 'player', { morale: 12, maxMorale: 30 });
  const waveArmy = [moraleUnit, guestArmy[0], guestArmy[1]];
  guestArmy[0].wweAbility = 'attitude';
  FD.onWaveStart(waveArmy);
  assert(moraleUnit.morale >= 18, 'guest_star wave morale should apply on wave start');
}

// --- Strike sprites & battlefield FX ---
function testStrikeFX(StrikeFX, SpriteGen) {
  const types = ['fireball', 'lightning', 'heal', 'reinforce', 'rally', 'meteor', 'frost_nova', 'scout_flare', 'fortify'];
  const ctx = ctx2d();
  for (const type of types) {
    assert(typeof SpriteGen.drawAbilityIcon === 'function', 'SpriteGen.drawAbilityIcon should exist');
    SpriteGen.drawAbilityIcon(ctx, type);
    StrikeFX.clear();
    StrikeFX.play(type, 200, 300, 60);
    assert(StrikeFX.play, 'StrikeFX.play should exist');
    StrikeFX.update();
    StrikeFX.draw(ctx, null);
    StrikeFX.drawTargeting(ctx, type, 200, 300, 60, 0);
  }
  StrikeFX.drawFortifyZones(ctx, [{ x: 100, y: 100, radius: 50, timer: 120 }], 10);
  StrikeFX.clear();
}

// --- Full game recruit + barracks build flow ---
function testGameRecruitFlow(exp) {
  const { Game, MetaProgress, Cheats } = exp;
  MetaProgress.reset();
  MetaProgress.unlockAllCheatContent();
  if (typeof GameModes !== 'undefined') {
    GameModes.setMenuMode('academy_era');
    GameModes.getMenu(); // ensure menu exists
  }
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.creativeSetTp?.(8000);
  Game.creativeSetWave?.(100);

  const cx = Game.getWorldCenter?.() || { x: 400, y: 300 };
  const placed = Game.creativeSpawnPlayerBuildingAt?.('element_barracks', cx.x, cx.y - 60);
  assert(placed, 'element_barracks should place in creative mode');

  const before = Game.getState().tactical;
  const recruited = Game.recruitCrossoverOperative('tank_dempsey');
  assert(recruited, 'recruitCrossoverOperative(tank_dempsey) should succeed with barracks');
  const after = Game.getState();
  assert(after.tactical < before, 'recruit should spend TP');
  assert(after.crossoverOnField?.includes('tank_dempsey'), 'tank_dempsey should be on field');

  const tpBeforeDup = Game.getState().tactical;
  const dup = Game.recruitCrossoverOperative('tank_dempsey');
  assert(!dup, 'recruitCrossoverOperative should block duplicate named crossover on field');
  assert(Game.getState().tactical === tpBeforeDup, 'duplicate recruit should not spend TP');

  Cheats.submit('115');
  assert(MetaProgress.is115Unlocked(), 'cheat 115 should unlock ultimis meta');
}

// --- Academy Era mode bootstrap ---
function testAcademyEraMode(exp, academyWave) {
  const { Game, GameModes } = exp;
  if (!GameModes?.MODES?.some(m => m.id === 'academy_era')) {
    fail('GameModes.MODES missing academy_era');
    return;
  }
  GameModes.setMenuMode('academy_era');
  const menu = GameModes.getMenu();
  if (menu.academyStartWave == null) {
    // beginSession will default it
  }
  Game.setDifficulty('normal');
  Game.start();
  const s = Game.getState();
  assert(s.wave >= academyWave, `academy era should start at wave >= ${academyWave} (got ${s.wave})`);
  assert(s.timeOfDay === 'night', 'academy era should begin in night prep');
  assert(s.army >= 10, `academy era should bootstrap a mixed army (got ${s.army})`);
  assert(s.buildingCount >= 10, `academy era should place walls, academies, and settlements (got ${s.buildingCount})`);
  assert(s.hamletCount >= 2, `academy era should place hamlets (got ${s.hamletCount})`);
  assert(s.academyEra, 'academy era flag should be active');
  assert(s.tactical >= 80, 'academy era should grant meaningful starter TP');
}

function testFairRepresentation(FD, BuildDefs) {
  const audit = FD.auditFairRepresentation();
  assert(audit.ok, `fair representation audit failed: ${audit.issues.join('; ')}`);
  for (const f of Object.keys(audit.synergyCount)) {
    assert((audit.synergyCount[f] || 0) >= 2, `${f} should appear in at least 2 synergies`);
    assert(FD.MASTERY_CHALLENGES.some(c => c.faction === f), `${f} should have a mastery challenge`);
    assert(FD.SEASONAL_EVENTS.some(e => e.factions.includes(f)), `${f} should have a seasonal event`);
  }
  const def = BuildDefs.element_barracks;
  assert(def.cost === FD.STANDARD_BARRACKS_COST, 'ultimis barracks cost should be normalized');
  assert(def.requiresBuilders === FD.STANDARD_BARRACKS_BUILDERS, 'ultimis barracks builders should be normalized');
}

function testColonyValue(exp) {
  const { Game, ColonyValue } = exp;
  if (!ColonyValue) {
    fail('ColonyValue module missing');
    return;
  }
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.creativeSetTp?.(500);
  const colony = ColonyValue.compute();
  assert(colony.total > 0, 'colony value should be positive in creative start');
  assert(colony.baseline > 0, 'wave baseline should be positive');
  assert(colony.threatRatio > 0, 'threat ratio should be positive');
  const pressure = ColonyValue.deriveWavePressure(colony, Game.getState().wave || 1);
  assert(pressure.countMult >= 0.7 && pressure.countMult <= 1.55, 'count mult should stay in colony band');
  assert(pressure.hpMult >= 0.9 && pressure.hpMult <= 1.14, 'hp mult should stay modest vs wave scaling');
  Game.beginDayPhase?.(true);
  const after = Game.getState();
  assert(after.colonyValue > 0, 'getState should expose colonyValue');
  assert(after.colonyThreatMods?.countMult, 'getState should expose colony threat mods after wave build');
}

console.log('Headless crossover runtime tests\n');

let exp = loadGame();
const { MetaProgress, FactionDepth, CrossoverHub, SpriteGen, StrikeFX, createUnit, perkMachinesUnlocked, ACADEMY_ERA_WAVE, sb } = exp;
if (SpriteGen) SpriteGen.prewarmCache = noop;
MetaProgress.load();

testPerkMachines(MetaProgress, perkMachinesUnlocked);
testCrossoverHubUI(MetaProgress, CrossoverHub, sb.document);
testAbilityProcs(FactionDepth, createUnit);
testSynergiesAndMastery(FactionDepth, createUnit);
testFairRepresentation(FactionDepth, exp.BuildDefs);
testStrikeFX(StrikeFX, SpriteGen);
testGameRecruitFlow(exp);
testColonyValue(exp);
testAcademyEraMode(exp, ACADEMY_ERA_WAVE);

if (issues.length) {
  console.log(`FAILED (${issues.length}):`);
  issues.forEach((i) => console.log(`  ✗ ${i}`));
  process.exit(1);
}
console.log('\nAll headless crossover runtime tests passed.');
process.exit(0);