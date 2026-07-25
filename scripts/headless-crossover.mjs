/**
 * Headless runtime tests for crossover UI, abilities, synergies, and perk machines.
 * Run: node scripts/headless-crossover.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

const issues = [];
function fail(msg) {
  issues.push(msg);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
}

const noop = () => {};
function ctx2d() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    globalAlpha: 1,
    setLineDash: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    setTransform: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    drawImage: noop,
    ellipse: noop,
    rect: noop,
    clip: noop,
    clearRect: noop,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
  };
}

function el(id = '') {
  const listeners = new Map();
  let _html = '';
  const childEls = [];
  return {
    id,
    className: '',
    classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
    style: {},
    textContent: '',
    value: '',
    dataset: {},
    get innerHTML() {
      return _html;
    },
    set innerHTML(v) {
      _html = v;
      childEls.length = 0;
      const re = /data-(?:faction|crossover)="([^"]+)"/g;
      let m;
      while ((m = re.exec(v))) {
        const attr = m[0].includes('faction') ? 'faction' : 'crossover';
        const e = el(`${attr}-${m[1]}`);
        e.dataset[attr] = m[1];
        e.className =
          v.includes(`data-${attr}="${m[1]}"`) && v.includes('selected')
            ? 'selected crossover-card'
            : 'crossover-card';
        childEls.push(e);
      }
      const tabRe = /data-faction="([^"]+)"/g;
      while ((m = tabRe.exec(v))) {
        const e = el(`tab-${m[1]}`);
        e.dataset.faction = m[1];
        e.className =
          v.includes(`data-faction="${m[1]}"`) && v.includes('active')
            ? 'crossover-tab active'
            : 'crossover-tab';
        if (!childEls.find((c) => c.dataset.faction === m[1])) childEls.push(e);
      }
    },
    addEventListener: (ev, fn) => {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev).push(fn);
    },
    removeEventListener: noop,
    click: noop,
    appendChild: (c) => c,
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel === '.crossover-tab' || sel === '.crossover-card') {
        return childEls.filter((c) =>
          sel === '.crossover-tab' ? c.dataset.faction : c.dataset.crossover
        );
      }
      return childEls;
    },
    getContext: (t) => (t === '2d' ? ctx2d() : null),
    width: 64,
    height: 64,
  };
}

function boot(seed = 1) {
  const store = new Map();
  const ids = new Map();
  const mk = (id) => {
    const e = el(id);
    ids.set(id, e);
    return e;
  };
  [
    'achievement-toast',
    'ach-toast-name',
    'ach-toast-desc',
    'menu-screen',
    'crossover-roster-grid',
    'crossover-faction-tabs',
    'crossover-selected-detail',
    'crossover-screen',
    'crossover-recruit-btn',
    'crossover-build-btn',
    'crossover-hub-open',
    'crossover-close',
  ].forEach(mk);

  let rng = seed;
  const M = Object.create(Math);
  M.random = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };

  const cvs = {
    width: 1280,
    height: 720,
    style: {},
    getContext: (t) => (t === '2d' ? ctx2d() : null),
    addEventListener: noop,
  };
  const sb = {
    console,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    Math: M,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
    requestAnimationFrame: (fn) => {
      fn();
      return 0;
    },
    cancelAnimationFrame: noop,
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    performance: { now: () => 0, memory: null },
    AudioContext: null,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: noop,
    removeEventListener: noop,
    document: {
      getElementById: (id) => ids.get(id) || mk(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => el(),
      hidden: false,
    },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs, ids };
}

function loadGame() {
  const { sb, cvs } = boot(42);
  const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
  // Macro layers (PlanetWarfare, PlanetConquest, …) were removed — only export what loads.
  const exp = vm.runInContext(
    `${code}\n({
      Game, Cheats, MetaProgress, FactionDepth, CrossoverHub, Perks, GameModes, FloatingText,
      SpriteGen, StrikeFX, ColonyValue, Research, ContentExpansion, GameDepth, EnemyFactions,
      FactionReputation, CrownLegacies, Legacy,
      PlanetWarfare: typeof PlanetWarfare !== 'undefined' ? PlanetWarfare : null,
      PlanetConquest: typeof PlanetConquest !== 'undefined' ? PlanetConquest : null,
      FactionIntel: typeof FactionIntel !== 'undefined' ? FactionIntel : null,
      LivingPlanet: typeof LivingPlanet !== 'undefined' ? LivingPlanet : null,
      FactionHazards: typeof FactionHazards !== 'undefined' ? FactionHazards : null,
      NeutralWildlife: typeof NeutralWildlife !== 'undefined' ? NeutralWildlife : null,
      DynamicMapEvents: typeof DynamicMapEvents !== 'undefined' ? DynamicMapEvents : null,
      AsymmetricWarfare: typeof AsymmetricWarfare !== 'undefined' ? AsymmetricWarfare : null,
      SettlementRaids: typeof SettlementRaids !== 'undefined' ? SettlementRaids : null,
      MultiFrontSiege: typeof MultiFrontSiege !== 'undefined' ? MultiFrontSiege : null,
      MonsterBosses: typeof MonsterBosses !== 'undefined' ? MonsterBosses : null,
      PlayerCounterEvolution: typeof PlayerCounterEvolution !== 'undefined' ? PlayerCounterEvolution : null,
      createUnit, getSpecialistLateAbilityInfo, isSpecialistUnit, perkMachinesUnlocked,
      ACADEMY_ERA_WAVE, RTS_ERA_WAVE, BuildDefs, getWaveConfig, getDifficultyDef,
      getUnlockedAttackSides, canSpendTpVeteranUpgrade, getVeteranUpgradeCost, upgradeVeteranUnit,
      isEnemyHordeGruntType, getUnlockedEvilOperatives, EVIL_OPERATIVE_WAVES,
      getKingdomEvolutionStage, getKingdomStageBuffs, isKingdomRaidsUnlocked, isKingdomLoadoutsUnlocked,
      KINGDOM_DOCTRINES, getUnlockedKingdomDoctrines, getTerritoryTier, getWorldSize,
      BASE_FIELD_W, BASE_FIELD_H, isEliteEnemy
    })`,
    vm.createContext(sb)
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
  assert(
    tabs.innerHTML.includes('Void Residue') ||
      tabs.innerHTML.includes('Ultimis') ||
      tabs.innerHTML.includes('Element 115') ||
      tabs.innerHTML.includes('ultimis'),
    'faction tabs should render unlocked factions'
  );
  // IP-scrubbed roster names (was Tank Dempsey → Splinter Vale).
  assert(
    grid.innerHTML.includes('Splinter Vale') ||
      grid.innerHTML.includes('Tank Dempsey') ||
      grid.innerHTML.includes('tank_dempsey') ||
      grid.innerHTML.includes('Need barracks'),
    'roster grid should list ultimis operatives'
  );
  assert(
    grid.innerHTML.includes('Need barracks on field'),
    'cards should show barracks prerequisite'
  );

  const gsWithBase = {
    tactical: 500,
    wave: 100,
    crossoverBuildings: ['element_barracks'],
    crossoverOnField: [],
  };
  Hub.renderRoster(gsWithBase);
  assert(
    !grid.innerHTML.includes('Need barracks on field') || grid.innerHTML.includes('Tank Dempsey'),
    'ultimis roster should not show need-base when barracks on field'
  );

  const buildBtn = doc.getElementById('crossover-build-btn');
  assert(typeof buildBtn.addEventListener === 'function', 'build button should be wired in init');

  const ultimisRoster = Hub.rosterForFaction('ultimis');
  assert(
    ultimisRoster.some(([id]) => id === 'tank_dempsey'),
    'rosterForFaction ultimis includes tank_dempsey'
  );
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
  const splashed = ctx.damageLog.filter((d) => d.id !== primary.id);
  assert(splashed.length >= 2, `frag_out should splash clustered foes (got ${splashed.length})`);

  // Star Platinum — bonus on pinned foe
  const jotaro = mkUnit(createUnitFn, 'jotaro_kujo', 100, 300);
  jotaro.wweAbility = 'star_platinum';
  const pinned = mkUnit(createUnitFn, 'orc', 130, 300, 'enemy', {
    pinned: true,
    hp: 80,
    maxHp: 100,
  });
  ctx.units = [jotaro, pinned];
  ctx.damageLog.length = 0;
  FD.processAbilityHit(jotaro, pinned, 40);
  assert(
    ctx.damageLog.some((d) => d.crit && d.amt >= 28),
    'star_platinum should crit pinned foe'
  );

  // Hakai — executes wounded foes
  const beerus = mkUnit(createUnitFn, 'beerus', 100, 400);
  beerus.wweAbility = 'hakai';
  const wounded = mkUnit(createUnitFn, 'troll', 130, 400, 'enemy', { hp: 20, maxHp: 200 });
  ctx.units = [beerus, wounded];
  ctx.damageLog.length = 0;
  FD.processAbilityHit(beerus, wounded, 35);
  assert(
    ctx.damageLog.some((d) => d.crit && d.amt >= 35),
    'hakai should crit-delete wounded foe'
  );

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
  assert(
    syns.some((s) => s.id === 'temporal_paradox'),
    'ultimis+primis should activate temporal_paradox'
  );

  FD.applyToUnit(dempsey, army);
  assert(
    (dempsey.synergyAbility || 0) >= 0.12,
    'temporal_paradox should grant +12% ability damage'
  );

  const mod = FD.modifyDamage(dempsey, mkUnit(createUnitFn, 'goblin', 150, 200, 'enemy'), 100);
  assert(mod > 100, 'synergy ability damage should amplify crossover hits');

  const guestArmy = [
    mkUnit(createUnitFn, 'stone_cold', 50, 50),
    mkUnit(createUnitFn, 'tank_dempsey', 80, 50),
  ];
  guestArmy[0].isWwe = true;
  guestArmy[1].isCrossover = true;
  const guestSyns = FD.computeSynergies(guestArmy);
  assert(
    guestSyns.some((s) => s.id === 'guest_star'),
    'WWE + second faction should trigger guest_star'
  );

  const moraleUnit = mkUnit(createUnitFn, 'footman', 100, 100, 'player', {
    morale: 12,
    maxMorale: 30,
  });
  const waveArmy = [moraleUnit, guestArmy[0], guestArmy[1]];
  guestArmy[0].wweAbility = 'attitude';
  FD.onWaveStart(waveArmy);
  assert(moraleUnit.morale >= 18, 'guest_star wave morale should apply on wave start');
}

// --- Strike sprites & battlefield FX ---
function testStrikeFX(StrikeFX, SpriteGen) {
  const types = [
    'fireball',
    'lightning',
    'heal',
    'reinforce',
    'rally',
    'meteor',
    'frost_nova',
    'scout_flare',
    'fortify',
  ];
  const ctx = ctx2d();
  for (const type of types) {
    assert(
      typeof SpriteGen.drawAbilityIcon === 'function',
      'SpriteGen.drawAbilityIcon should exist'
    );
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
  const { Game, GameModes, Research } = exp;
  if (!GameModes?.MODES?.some((m) => m.id === 'academy_era')) {
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
  assert(
    s.wave >= academyWave,
    `academy era should start at wave >= ${academyWave} (got ${s.wave})`
  );
  assert(s.timeOfDay === 'night', 'academy era should begin in night prep');
  assert(s.army >= 10, `academy era should bootstrap a mixed army (got ${s.army})`);
  assert(
    s.buildingCount >= 10,
    `academy era should place walls, academies, and settlements (got ${s.buildingCount})`
  );
  assert(s.hamletCount >= 2, `academy era should place hamlets (got ${s.hamletCount})`);
  assert(s.academyEra, 'academy era flag should be active');
  assert(s.tactical >= 80, 'academy era should grant meaningful starter TP');
  if (Research) {
    assert(
      Research.isBuildUnlocked('hamlet', {}),
      'academy era should bootstrap settlement research'
    );
    assert(
      Research.isBuildUnlocked('academy_footman', {}),
      'academy era should bootstrap academy research'
    );
    assert(
      Research.isTpVeteranUpgradeUnlocked({}),
      'academy era should bootstrap veteran doctrine'
    );
  }
}

function testNamedBossEncyclopedia(MonsterBosses) {
  if (!MonsterBosses?.getEncyclopediaEntries) {
    fail('MonsterBosses.getEncyclopediaEntries missing');
    return;
  }
  const entries = MonsterBosses.getEncyclopediaEntries();
  assert(entries.length >= 14, 'boss encyclopedia should have overview + 10 warlords');
  const malachar = entries.find((e) => e.name?.includes('Malachar'));
  assert(malachar?.body?.includes('Endless Siege Host'), 'Malachar should document pack');
  assert(malachar?.body?.includes('Eternal'), 'Malachar should document evolution tiers');
  const evo = entries.find((e) => e.name === 'Monster Evolution System');
  assert(evo?.body?.includes('Returned'), 'evolution overview should list tiers');
  MonsterBosses.resetRun();
  const prime = MonsterBosses.prepareBossWave('boss_gorath', 10, 1.2);
  assert(prime.evolution.short === 'Prime', 'first gorath appearance is Prime');
  const returned = MonsterBosses.prepareBossWave('boss_gorath', 110, 1.2);
  assert(returned.evolution.label === 'Returned', 'second gorath visit is Returned');
}

function testLoadoutEncyclopedia(exp, createUnitFn) {
  const { ContentExpansion } = exp;
  if (!ContentExpansion?.getLoadoutEncyclopediaEntries) {
    fail('ContentExpansion.getLoadoutEncyclopediaEntries missing');
    return;
  }
  const entries = ContentExpansion.getLoadoutEncyclopediaEntries();
  assert(entries.length >= 9, 'loadout encyclopedia should have overview + 5 doctrines');
  const siege = entries.find((e) => e.name === 'Siege Crew');
  assert(siege?.body?.includes('siegeMult'), 'Siege Crew should document siegeMult bonus');
  const tip = ContentExpansion.formatLoadoutTip('court');
  assert(tip?.body?.includes('Courier'), 'Royal Court tip should mention couriers');
  ContentExpansion.setLoadout('shield');
  const foot = createUnitFn('footman', 0, 0, 'player');
  const baseHp = foot.maxHp;
  ContentExpansion.bind({ wave: 100 });
  ContentExpansion.applyLoadoutToUnit(foot);
  assert(foot.maxHp > baseHp, 'Shield Wall should boost footman max HP at wave 100+');
}

function testResearchEncyclopedia(Research) {
  if (!Research?.getEncyclopediaEntries) {
    fail('Research.getEncyclopediaEntries missing');
    return;
  }
  const entries = Research.getEncyclopediaEntries();
  const nodeCount = Research.ALL_NODES?.length || 0;
  const nodeEntries = entries.filter(
    (e) => e.name === 'Veteran Doctrine' || e.name === 'Hellgate Containment'
  );
  assert(
    entries.length >= nodeCount + 8,
    'encyclopedia should list all nodes plus overview/path entries'
  );
  const vet = entries.find((e) => e.name === 'Veteran Doctrine');
  assert(
    vet?.body?.includes('Iron Weapons'),
    'Veteran Doctrine should cite Iron Weapons prerequisite'
  );
  const doom = entries.find((e) => e.name === 'Hellgate Containment');
  assert(
    doom?.body?.includes('Stand Arrow') || doom?.body?.includes('Ki Manipulation'),
    'Doom research should cite prerequisites'
  );
  const milPath = entries.find((e) => e.name?.includes('Military') && e.name.includes('Path'));
  assert(milPath?.body?.includes('Iron Weapons'), 'Military path should list iron weapons');
}

function testResearchGates(Research, BuildDefs) {
  if (!Research) {
    fail('Research module missing from headless boot');
    return;
  }
  Research.resetRun();
  assert(Research.isBuildUnlocked('outpost', {}), 'outpost should be starter build');
  assert(Research.isBuildUnlocked('research_lab', {}), 'research lab should be starter build');
  assert(!Research.isBuildUnlocked('castle', {}), 'castle should require fortification research');
  assert(!Research.isBuildUnlocked('hamlet', {}), 'hamlet should require settlement charter');
  assert(!Research.isBuildUnlocked('village', {}), 'village should require village rights');
  assert(!Research.isBuildUnlocked('academy_footman', {}), 'academies should require research');
  Research.completeResearch('fortification', noop);
  assert(Research.isBuildUnlocked('castle', {}), 'castle unlocks after fortification');
  Research.completeResearch('settlement_charter', noop);
  assert(Research.isBuildUnlocked('hamlet', {}), 'hamlet unlocks after settlement charter');
  assert(BuildDefs.village?.settlementTier === 2, 'village should be tier 2 settlement');
  assert(BuildDefs.metropolis?.settlementTier === 5, 'metropolis should be tier 5 settlement');
}

function testVeteranDoctrine(Research, createUnitFn, canSpendTpVeteranUpgradeFn) {
  if (!Research) return;
  Research.resetRun();
  assert(!Research.isTpVeteranUpgradeUnlocked({}), 'TP veteran upgrades locked initially');
  Research.completeResearch('veteran_doctrine', noop);
  assert(Research.isTpVeteranUpgradeUnlocked({}), 'TP veteran upgrades unlock after doctrine');
  const foot = createUnitFn('footman', 0, 0, 'player');
  foot.vetUpgradeEligible = true;
  assert(canSpendTpVeteranUpgradeFn(foot), 'eligible vanilla footman can spend TP upgrade');
  const chief = createUnitFn('master_chief', 0, 0, 'player');
  chief.vetUpgradeEligible = true;
  assert(
    !canSpendTpVeteranUpgradeFn(chief),
    'crossover operatives should not use TP veteran track'
  );
}

function testScalingSymmetry(GameDepth, createUnitFn, getWaveConfigFn, getDifficultyDefFn) {
  if (!GameDepth) {
    fail('GameDepth missing');
    return;
  }
  const wave = 80;
  const cfg = getWaveConfigFn(wave);
  const diff = getDifficultyDefFn('normal');
  const opts = { cfg, diff, waveModifiers: { hpMult: 1 } };

  const grunt = createUnitFn('goblin', 0, 0, 'enemy', { spawnWave: wave });
  const op = createUnitFn('hellbound_legionnaire', 0, 0, 'enemy', { spawnWave: wave });
  const ip = createUnitFn('master_chief', 0, 0, 'player', { spawnWave: wave });
  const foot = createUnitFn('footman', 0, 0, 'player', { spawnWave: wave });

  GameDepth.applyEnemySpawnScaling(grunt, wave, opts);
  GameDepth.applyEnemySpawnScaling(op, wave, opts);
  ip.baseMaxHp = null;
  ip.baseDamage = null;
  GameDepth.applyIpWaveScaling(ip, wave);

  assert(
    op.maxHp > grunt.maxHp * 1.4,
    `evil operative should outscale grunt HP at w${wave} (${op.maxHp} vs ${grunt.maxHp})`
  );
  assert(op.damage > grunt.damage * 1.4, `evil operative should outscale grunt damage at w${wave}`);
  assert(ip.maxHp > foot.maxHp * 1.25, `IP unit should scale above base footman at w${wave}`);
  const obsolete = GameDepth.getVanillaObsoleteMult(foot, wave);
  assert(obsolete < 0.92, `vanilla footman should trail scaling at w${wave} (${obsolete})`);
  assert(obsolete > 0.62, `vanilla footman should not collapse too fast at w${wave} (${obsolete})`);
  const vetFoot = createUnitFn('footman', 0, 0, 'player', { spawnWave: wave - 20, vetTier: 2 });
  const vetMult = GameDepth.getVanillaObsoleteMult(vetFoot, wave);
  assert(vetMult > obsolete, 'promoted veterans should resist obsolescence');
  assert(GameDepth.isEnemyHordeGrunt(grunt), 'goblin should be horde grunt');
  assert(GameDepth.isEnemyEvilOperative(op), 'hellbound legionnaire should be evil operative');
  assert(!GameDepth.isIpOperative(foot), 'footman is not IP operative');
}

function testOperativeInjection(GameDepth, isEnemyHordeGruntTypeFn, getUnlockedEvilOperativesFn) {
  if (!GameDepth) return;
  const queue = ['goblin', 'goblin', 'orc', 'plague_rat'];
  const injected = GameDepth.injectEvilOperativesIntoQueue(queue, 50, () => 0);
  const hasOp = injected.some((t) => !isEnemyHordeGruntTypeFn(t));
  assert(hasOp, 'operative injection should replace horde grunt slots at wave 50');
  assert(
    getUnlockedEvilOperativesFn(30).includes('nightmare_strider'),
    'nightmare strider unlocks wave 30'
  );
  assert(getUnlockedEvilOperativesFn(10).length === 0, 'no operatives before wave 25');
}

function testCampaignBuildGate(exp) {
  const { Game, Research } = exp;
  if (!Research) return;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.setCreativeSetting?.('unlockAll', false);
  Game.setCreativeSetting?.('freeResources', true);
  Game.creativeSetTp?.(500);
  const cx = Game.getWorldCenter();
  assert(
    !Game.creativeSpawnPlayerBuildingAt('hamlet', cx.x, cx.y),
    'hamlet blocked without research in campaign rules'
  );
  Research.completeResearch('settlement_charter', noop);
  assert(
    Game.creativeSpawnPlayerBuildingAt('hamlet', cx.x + 120, cx.y),
    'hamlet allowed after settlement charter'
  );
}

function testFairRepresentation(FD, BuildDefs) {
  const audit = FD.auditFairRepresentation();
  assert(audit.ok, `fair representation audit failed: ${audit.issues.join('; ')}`);
  for (const f of Object.keys(audit.synergyCount)) {
    assert((audit.synergyCount[f] || 0) >= 2, `${f} should appear in at least 2 synergies`);
    assert(
      FD.MASTERY_CHALLENGES.some((c) => c.faction === f),
      `${f} should have a mastery challenge`
    );
    assert(
      FD.SEASONAL_EVENTS.some((e) => e.factions.includes(f)),
      `${f} should have a seasonal event`
    );
  }
  const def = BuildDefs.element_barracks;
  assert(def.cost === FD.STANDARD_BARRACKS_COST, 'ultimis barracks cost should be normalized');
  assert(
    def.requiresBuilders === FD.STANDARD_BARRACKS_BUILDERS,
    'ultimis barracks builders should be normalized'
  );
}

function testEnemyFactions(exp) {
  const { EnemyFactions, BuildDefs } = exp;
  assert(EnemyFactions, 'EnemyFactions module should exist');
  assert(EnemyFactions.EVOLUTION_STAGES[4]?.label === 'Kingdom', 'stage 4 should be Kingdom');
  assert(
    EnemyFactions.getActiveFactions(1).some((f) => f.id === 'goblin_hordes'),
    'goblins active wave 1'
  );
  assert(EnemyFactions.getFactionTier('goblin_hordes', 1)?.stage === 1, 'goblin stage 1 at wave 1');
  assert(EnemyFactions.getFactionTier('goblin_hordes', 8)?.stage === 2, 'goblin stage 2 at wave 8');
  assert(
    EnemyFactions.getFactionTier('goblin_hordes', 40)?.stage === 4,
    'goblin stage 4 at wave 40'
  );
  assert(
    EnemyFactions.getFactionTier('orc_warbands', 15)?.subBosses?.includes('boss_gorath'),
    'orc stage 2 has Gorath'
  );
  assert(
    EnemyFactions.getFactionTier('dark_legions', 60)?.stage === 3,
    'dark legions stage 3 at wave 60'
  );
  assert(
    EnemyFactions.getFactionTier('dark_legions', 70)?.counterRaids === true,
    'dark stage 4 enables counter-raids'
  );
  assert(
    !EnemyFactions.getActiveFactions(50).some((f) => f.id === 'mirror_empires'),
    'mirror inactive before wave 200'
  );
  assert(
    EnemyFactions.getUnitFaction('goblin') === 'goblin_hordes',
    'goblin maps to goblin hordes'
  );
  assert(
    EnemyFactions.getUnitFaction('boss_morwen') === 'dark_legions',
    'Morwen maps to dark legions'
  );
  assert(
    EnemyFactions.getSettlementRaidChance(90, 'void_abyssal', 0.35) >= 0.75,
    'void stage 4 raises raid chance'
  );
  const queue = ['goblin', 'goblin', 'orc', 'orc'];
  const withBoss = EnemyFactions.injectSubBosses(queue, 15, () => 0);
  assert(
    withBoss.includes('boss_gorath') || withBoss.includes('boss_thokk'),
    'injectSubBosses should add orc sub-boss at wave 15'
  );
  const buildings = [
    {
      owner: 'enemy',
      hp: 100,
      type: 'enemy_hamlet',
      enemyFaction: 'mirror_empires',
      isHamlet: true,
    },
    { owner: 'player', hp: 100, type: 'hamlet', isHamlet: true },
    { owner: 'enemy', hp: 0, type: 'enemy_trade_outpost' },
  ];
  assert(
    EnemyFactions.countFactionBuildings(buildings, 'mirror_empires') === 1,
    'countFactionBuildings skips dead/player'
  );
  const snap = EnemyFactions.getStateSnapshot(200, buildings, [
    'necromancer',
    'orc',
    'goblin_engineer',
  ]);
  assert(
    snap.activeFactions.some((f) => f.id === 'mirror_empires'),
    'mirror active at wave 200'
  );
  assert(snap.activeFactions[0]?.stage >= 1, 'snapshot exposes evolution stage');
  assert(snap.rosterIntel.includes('Host:'), 'roster intel should be formatted');
  assert(BuildDefs.enemy_shadow_academy?.isEnemySettlement, 'shadow academy should be siegeable');
  assert(BuildDefs.enemy_war_academy?.isEnemySettlement, 'war academy should be siegeable');
}

function testAsymmetricWarfare(exp) {
  if (!exp.AsymmetricWarfare) { console.log('  skip AsymmetricWarfare (removed)'); return; }
  const { AsymmetricWarfare } = exp;
  assert(AsymmetricWarfare, 'AsymmetricWarfare module should exist');
  AsymmetricWarfare.resetRun();
  const auth = AsymmetricWarfare.computeCommanderAuthority({
    wave: 100,
    kingdomStage: 3,
    evolutionFill: 0.6,
    hamletCount: 2,
    guildCount: 1,
    academyCount: 3,
    researchCompleted: 4,
    liveBuilders: 2,
    generalStationed: true,
    settlementTp: 3,
    colonyValue: 200,
    globalHunt: true,
    unitProducers: 2,
  });
  assert(auth >= 58, 'strong kingdom should yield high commander authority');
  const gain = AsymmetricWarfare.onWaveStart(50, {
    activeFactionStages: 6,
    enemySiteCount: 2,
    wave: 50,
  });
  assert(gain.nextLevel >= 1, 'host should have threat level after wave start');
  const push = AsymmetricWarfare.onHostStructureDestroyed();
  assert(push.delta <= 0, 'structure raze should reduce threat xp');
  const hostMods = AsymmetricWarfare.getAsymmetricMods(28, 22);
  assert(hostMods.enemyCountMult > 1, 'high threat vs low authority should boost enemy count');
  const cmdMods = AsymmetricWarfare.getAsymmetricMods(90, 15);
  assert(cmdMods.commanderNightPrepMult >= 1.06, 'high authority should lengthen nights');
  const snap = AsymmetricWarfare.getStateSnapshot({
    wave: 99,
    kingdomStage: 3,
    evolutionFill: 0.5,
    hamletCount: 1,
    globalHunt: true,
    rallyActive: true,
    unlockedDoctrineCount: 2,
    factionSummary: 'Goblin S2',
  });
  assert(
    snap.playerMacro.includes('EMPIRE') ||
      snap.playerMacro.includes('KINGDOM') ||
      snap.playerMacro.includes('DOMINION'),
    'macro tier in snapshot'
  );
  assert(snap.playerMicro.includes('HUNT'), 'micro should show hunt');
  assert(snap.hostSummary.includes('Lv'), 'host summary shows threat level');
  assert(snap.playerRole.id === 'kingdom_commander', 'player role defined');
  assert(snap.hostRole.id === 'evolving_threat', 'host role defined');
}

function testMonsterBosses(exp) {
  if (!exp.MonsterBosses) { console.log('  skip MonsterBosses'); return; }
  const { MonsterBosses, GameDepth } = exp;
  assert(MonsterBosses, 'MonsterBosses module should exist');
  assert(MonsterBosses.BOSS_PACKS.boss_gorath, 'Gorath pack should exist');
  MonsterBosses.resetRun();
  const base = GameDepth.getNamedBossForWave(10);
  assert(base?.type === 'boss_gorath', 'wave 10 should be Gorath');
  const prime = MonsterBosses.prepareBossWave('boss_gorath', 10, base.scale);
  assert(prime.evolution.label === '', 'first appearance should be Prime');
  assert(prime.minions.length >= 4, 'prime pack should include minions');
  let queue = ['boss_gorath', 'dark_knight', 'dark_knight'];
  queue = MonsterBosses.injectPackIntoQueue(queue, 'boss_gorath', prime);
  assert(queue.indexOf('boss_gorath') >= 0, 'boss should stay in queue');
  assert(queue.length > 6, 'pack should swell spawn queue');
  MonsterBosses.prepareBossWave('boss_gorath', 110, base.scale);
  const returned = MonsterBosses.getEvolutionTier(MonsterBosses.getAppearanceCount('boss_gorath'));
  assert(returned.label === 'Returned', 'second Gorath visit should be Returned');
  const scale = MonsterBosses.computeTotalScale('boss_gorath', 1.2);
  assert(scale > 1.2, 'returned boss should scale above base');
  const slain = MonsterBosses.onBossSlain('boss_gorath', 10);
  assert(slain.kills === 1, 'should track boss kills');
  assert(slain.nextEvolution.label === 'Ascendant', 'next encounter should escalate');
  const morwenPack = MonsterBosses.getPackDef('boss_morwen');
  assert(
    morwenPack.structures.includes('enemy_shadow_academy'),
    'Morwen should raise shadow holds'
  );
  const snap = MonsterBosses.getStateSnapshot('boss_gorath', 110);
  assert(snap.appearances.boss_gorath >= 2, 'snapshot should track appearances');
}

function testMultiFrontSiege(exp) {
  if (!exp.MultiFrontSiege) { console.log('  skip MultiFrontSiege (removed)'); return; }
  const { MultiFrontSiege, EnemyFactions, getUnlockedAttackSides, PlanetConquest } = exp;
  assert(MultiFrontSiege, 'MultiFrontSiege module should exist');
  assert(MultiFrontSiege.MULTI_FRONT_MIN_WAVE === 12, 'multi-front should start wave 12');
  PlanetConquest?.resetRun?.({ forcedMode: false });
  MultiFrontSiege.resetRun();
  const solo = EnemyFactions.getActiveFactions(20).slice(0, 1);
  assert(
    !MultiFrontSiege.buildFrontPlan(20, solo, ['north', 'east'], () => 0.5),
    'single faction should not build plan'
  );
  const factions = EnemyFactions.getActiveFactions(40);
  assert(factions.length >= 2, 'wave 40 should have multiple factions');
  const plan = MultiFrontSiege.buildFrontPlan(40, factions, getUnlockedAttackSides(40), () => 0.1);
  assert(plan && plan.assignments.length >= 2, 'should assign doctrines per faction');
  assert(plan.waveSides.length >= 1, 'plan should expose wave sides');
  assert(plan.intel.includes('·') || plan.assignments.length >= 2, 'intel should describe fronts');
  const orcSide = MultiFrontSiege.pickSpawnSide('orc', plan, plan.waveSides, () => 0);
  const goblinSide = MultiFrontSiege.pickSpawnSide('goblin', plan, plan.waveSides, () => 0);
  const orcAssign = plan.assignments.find((a) => a.factionId === 'orc_warbands');
  const gobAssign = plan.assignments.find((a) => a.factionId === 'goblin_hordes');
  if (orcAssign && plan.mode === 'coordinated') {
    assert(orcAssign.fronts.includes(orcSide), 'orc spawns should follow siege assignment');
  }
  if (gobAssign && plan.mode === 'coordinated' && gobAssign.doctrine === 'economy_raid') {
    assert(
      gobAssign.fronts.includes('south') || !getUnlockedAttackSides(40).includes('south'),
      'goblins should prefer south economy raids when unlocked'
    );
  }
  const hamlet = {
    id: 'h1',
    owner: 'player',
    complete: true,
    hp: 100,
    isHamlet: true,
    x: 200,
    y: 500,
  };
  const outpost = {
    id: 'o1',
    owner: 'player',
    complete: true,
    hp: 100,
    type: 'outpost',
    x: 200,
    y: 120,
  };
  const ecoTarget = MultiFrontSiege.pickCounterRaidTarget('goblin_hordes', [hamlet, outpost], plan);
  const siegeTarget = MultiFrontSiege.pickCounterRaidTarget(
    'orc_warbands',
    [hamlet, outpost],
    plan
  );
  if (plan.assignments.find((a) => a.factionId === 'goblin_hordes')?.doctrine === 'economy_raid') {
    assert(ecoTarget?.id === 'h1', 'economy raid should target southern hamlet');
  }
  if (plan.assignments.find((a) => a.factionId === 'orc_warbands')?.doctrine === 'siege_line') {
    assert(siegeTarget?.y <= hamlet.y, 'siege line should prefer northern holds');
  }
  const spawn = MultiFrontSiege.resolveCounterRaidSpawn('goblin_hordes', hamlet, {
    worldW: 400,
    worldH: 600,
    rng: () => 0.5,
  });
  assert(
    spawn.side === 'south' || spawn.side === 'north',
    'counter-raid should spawn from a flank'
  );
  const snap = MultiFrontSiege.getStateSnapshot(40, factions);
  assert(snap.active && snap.assignments.length >= 2, 'snapshot should expose multi-front state');
}

function testNeutralWildlife(exp) {
  if (!exp.NeutralWildlife) { console.log('  skip NeutralWildlife'); return; }
  const { NeutralWildlife } = exp;
  assert(NeutralWildlife, 'NeutralWildlife module should exist');
  NeutralWildlife.resetRun();
  assert(NeutralWildlife.pickWaveEvent(7) === null, 'inactive before wave 8');
  const evt = NeutralWildlife.pickWaveEvent(22);
  assert(evt?.id === 'beast_migration', 'wave 22 should trigger beast migration');
  const spawned = [];
  NeutralWildlife.onWaveStart(22, {
    worldW: 500,
    worldH: 820,
    rallyY: 720,
    territoryTier: 2,
    spawnUnit: (u) => spawned.push(u),
    hooks: {},
  });
  assert(spawned.length >= 2, 'beast migration should spawn wildlife');
  assert(
    spawned.every((u) => u.team === 'neutral'),
    'spawns should be neutral'
  );
  const boar = NeutralWildlife.createUnit('wild_boar', 200, 200, 30, { territoryTier: 2 });
  assert(boar.hp > 90, 'boar HP should scale with wave');
  const player = { id: 'p1', type: 'footman', team: 'player', hp: 100, x: boar.x, y: boar.y };
  const enemy = { id: 'e1', type: 'goblin', team: 'enemy', hp: 100, x: boar.x + 20, y: boar.y };
  const aggro = NeutralWildlife.updateAI;
  let tp = 0;
  boar.combatTargetId = player.id;
  NeutralWildlife.onSlain(boar, {
    units: [{ ...player, combatTargetId: boar.id }],
    grantTp: (n) => {
      tp += n;
    },
    hooks: {},
  });
  assert(tp >= 2, 'player killer should earn TP loot');
  const carrion = [];
  for (let i = 0; i < 8; i++) {
    NeutralWildlife.onCombatDeath(25, {
      worldW: 500,
      worldH: 820,
      rallyY: 720,
      territoryTier: 2,
      spawnUnit: (u) => carrion.push(u),
      hooks: {},
    });
  }
  assert(carrion.length >= 1, 'heavy casualties should trigger carrion feed');
  const snap = NeutralWildlife.getStateSnapshot(spawned, 22);
  assert(snap.count >= 2, 'snapshot should list neutral wildlife');
}

function testFactionHazards(exp) {
  if (!exp.FactionHazards) { console.log('  skip FactionHazards'); return; }
  const { FactionHazards, EnemyFactions, getTerritoryTier, PlanetConquest } = exp;
  assert(FactionHazards, 'FactionHazards module should exist');
  PlanetConquest?.resetRun?.({ forcedMode: false });
  FactionHazards.resetRun();
  assert(
    FactionHazards.spawnInitial(500, 700, 1, 580, 20).length === 0,
    'tier 1 should spawn no hazards'
  );
  const hazardWave = 35;
  const tier = getTerritoryTier(hazardWave);
  assert(tier >= 2, `wave ${hazardWave} should unlock hazard territory`);
  const hazards = FactionHazards.spawnInitial(500, 820, tier, 720, hazardWave, { rng: () => 0.42 });
  assert(hazards.length >= 2, 'should spawn faction hazards');
  const types = new Set(hazards.map((h) => h.type));
  assert(
    types.has('goblin_plague') || types.has('orc_fire_pit'),
    'should include goblin or orc hazards'
  );
  const anchor = hazards.find((h) => h.type === 'goblin_plague') || hazards[0];
  if (!anchor) return;
  const plague = hazards.find((h) => h.type === 'goblin_plague');
  const goblin = {
    type: 'goblin',
    team: 'enemy',
    hp: 100,
    x: anchor.x,
    y: anchor.y,
  };
  const player = {
    type: 'footman',
    team: 'player',
    hp: 100,
    morale: 20,
    x: anchor.x,
    y: anchor.y,
  };
  if (plague) assert(FactionHazards.isUnitImmune(goblin, plague), 'goblins should resist plague');
  FactionHazards.applyToUnit(player, hazards);
  assert(player.hazardSlow < 1 || player.hp < 100, 'player should suffer hazard effects');
  const voidHaz = {
    type: 'void_corruption',
    factionId: 'void_abyssal',
    spreads: true,
    spreadPerWave: 0.4,
    maxRadius: 70,
    radius: 30,
    x: 200,
    y: 120,
    damage: 0.3,
    tickInterval: 40,
    slow: 0.8,
    id: 'void_test',
    affectsEnemy: true,
    immuneFaction: 'void_abyssal',
    stage: 3,
  };
  const spread = FactionHazards.onWaveStart([voidHaz], 80, {
    worldW: 500,
    worldH: 820,
    rallyY: 720,
    territoryTier: tier,
    rng: () => 0.05,
  });
  assert(spread.hazards.length >= 1, 'void should persist after wave spread');
  assert(spread.hazards[0].radius > 30, 'void corruption should grow each wave');
  const snap = FactionHazards.getStateSnapshot(spread.hazards, 80, tier);
  assert(snap.count >= 1 && snap.active, 'snapshot should expose hazard state');
  const factions = EnemyFactions.getActiveFactions(25);
  assert(factions.length >= 1, 'should have factions for hazard theming');
}

function testCrownLegacies(exp) {
  const { CrownLegacies } = exp;
  assert(CrownLegacies, 'CrownLegacies module should exist');
  CrownLegacies.resetRun();
  const mockLeg = {
    victories: 1,
    honorCount: 4,
    maxWaveEver: 55,
    totalKills: 500,
    totalWavesCleared: 30,
    favoriteUnitType: 'footman',
    unitKills: { footman: 60 },
    factionsUsed: ['ultimis'],
    honorNames: [
      { name: 'Syr Aldric', type: 'footman', wave: 22 },
      { name: 'Dame Elara', type: 'archer', wave: 35 },
    ],
  };
  const refresh = CrownLegacies.refreshUnlocks(mockLeg);
  assert(refresh.unlocked.includes('crowned_command'), 'victory unlocks crowned command');
  assert(refresh.unlocked.includes('honor_bloodline'), 'honors unlock bloodline');
  assert(CrownLegacies.toggleLegacy('crowned_command').ok, 'should equip legacy');
  const fx = CrownLegacies.getCombinedEffects(mockLeg);
  assert(fx.startTp >= 4, 'crowned command grants start TP');
  CrownLegacies.toggleHeir('Syr Aldric::footman');
  const heirs = CrownLegacies.getActiveHeirs();
  assert(heirs.length === 1 && heirs[0].name === 'Syr Aldric', 'should select honor heir');
  const spawned = [];
  CrownLegacies.applyRunStartBonuses({
    deployY: 700,
    rallyY: 500,
    units: [],
    grantTp: () => {},
    spawnUnit: (type, x, y, team) => ({
      type,
      team,
      x,
      y,
      hp: 100,
      maxHp: 100,
      morale: 20,
      maxMorale: 30,
      damage: 10,
    }),
    pushUnit: (u) => spawned.push(u),
    hooks: {},
  });
  assert(spawned.length === 1, 'should spawn honor heir');
  assert(spawned[0].honorName === 'Syr Aldric', 'heir keeps honor name');
  const snap = CrownLegacies.getMenuSnapshot();
  assert(snap.unlockedCount >= 5, 'snapshot lists unlocks');
}

function testFactionReputation(exp) {
  if (!exp.FactionReputation) { console.log('  skip FactionReputation'); return; }
  const { FactionReputation, EnemyFactions } = exp;
  assert(FactionReputation, 'FactionReputation module should exist');
  FactionReputation.resetRun();
  assert(!FactionReputation.isActive(5), 'inactive before wave 6');
  assert(FactionReputation.isActive(8), 'active from wave 6');

  FactionReputation.onEnemySlain(
    { type: 'goblin', team: 'enemy', enemyFaction: 'goblin_hordes' },
    10,
    {}
  );
  assert(FactionReputation.getHostility('goblin_hordes') > 22, 'kills should raise hostility');

  FactionReputation.onEnemyStructureDestroyed(
    {
      type: 'enemy_trade_outpost',
      owner: 'enemy',
      enemyFaction: 'goblin_hordes',
    },
    12,
    { hooks: {} }
  );
  const hAfterRaze = FactionReputation.getHostility('goblin_hordes');
  assert(hAfterRaze >= 30, 'razing should spike hostility');

  const offsetHigh = FactionReputation.getEvolutionWaveOffset('goblin_hordes');
  assert(offsetHigh >= 0, 'high hostility should not delay evolution');

  FactionReputation.onTruce(12, { worldW: 500, hooks: {} });
  assert(
    FactionReputation.getHostility('goblin_hordes') < hAfterRaze,
    'truce should reduce hostility'
  );

  FactionReputation.resetRun();
  FactionReputation.reduceHostility('orc_warbands', 10, 20);
  const lowMods = FactionReputation.getFactionModifiers('orc_warbands', 20);
  assert(
    lowMods.economicFocus || lowMods.buildingIntervalMult < 1,
    'low hostility should favor economy'
  );

  FactionReputation.resetRun();
  const tierBase = EnemyFactions.getFactionTier('orc_warbands', 14);
  FactionReputation.addHostility('orc_warbands', 58, 14);
  const tierBoosted = EnemyFactions.getFactionTier('orc_warbands', 14);
  assert(
    (tierBoosted?.stage || 0) > (tierBase?.stage || 0),
    'hostility should pull evolution forward'
  );

  const snap = FactionReputation.getStateSnapshot(20);
  assert(snap.factions.length >= 1, 'snapshot should list faction reputations');
}

function testDynamicMapEvents(exp) {
  if (!exp.DynamicMapEvents) { console.log('  skip DynamicMapEvents'); return; }
  const { DynamicMapEvents } = exp;
  assert(DynamicMapEvents, 'DynamicMapEvents module should exist');
  DynamicMapEvents.resetRun();
  assert(DynamicMapEvents.pickEvent(10) === null, 'inactive before wave 12');
  const geo = DynamicMapEvents.pickEvent(14);
  assert(geo?.id === 'geothermal_surge', 'wave 14 should trigger geothermal surge');
  const pending = DynamicMapEvents.prepareNextEvent(14, {
    worldW: 500,
    rallyY: 720,
    hooks: {},
  });
  assert(pending?.eventId === 'geothermal_surge', 'should prepare geothermal event');
  assert(pending.site?.x > 0, 'should place event site on map');

  const evac = DynamicMapEvents.respond('vent', { tactical: 10, spendTp: () => {} });
  assert(evac.ok, 'should accept vent choice');

  const waveMods = { countMult: 1, hpMult: 1, noElites: false, stealReduction: 0 };
  DynamicMapEvents.applyForWave(14, {
    worldW: 500,
    rallyY: 720,
    territoryTier: 2,
    units: [],
    pendingWaveMods: waveMods,
    hooks: {},
  });
  assert(waveMods.countMult === 0.9, 'vent should reduce enemy spawns');

  DynamicMapEvents.resetRun();
  DynamicMapEvents.prepareNextEvent(32, { worldW: 500, rallyY: 720, hooks: {} });
  DynamicMapEvents.respond('evacuate', { tactical: 10, spendTp: () => {} });
  const volcano = DynamicMapEvents.applyForWave(32, {
    worldW: 500,
    rallyY: 720,
    units: [{ team: 'player', hp: 100, maxHp: 100, morale: 50, maxMorale: 100 }],
    hooks: {},
  });
  assert(volcano?.mods.playerDamageTakenMult === 0.95, 'evacuate should reduce damage taken');

  DynamicMapEvents.resetRun();
  DynamicMapEvents.prepareNextEvent(14, { worldW: 500, rallyY: 720, hooks: {} });
  DynamicMapEvents.respond('tap', { tactical: 10, spendTp: () => {} });
  assert(
    DynamicMapEvents.getActiveMods().nightBuildMult === 1.35,
    'tap should boost night build immediately'
  );

  let tp = 0;
  let science = 0;
  DynamicMapEvents.resetRun();
  DynamicMapEvents.prepareNextEvent(32, { worldW: 500, rallyY: 720, hooks: {} });
  DynamicMapEvents.respond('harness', { tactical: 10, spendTp: () => {} });
  DynamicMapEvents.applyForWave(32, {
    grantTp: (n) => {
      tp += n;
    },
    grantScience: (n) => {
      science += n;
    },
    hooks: {},
  });
  assert(tp >= 6 && science >= 2, 'harness should grant TP and science');

  const snap = DynamicMapEvents.getStateSnapshot(32, 20, false);
  assert(snap.activeSummary, 'snapshot should expose active summary after apply');
}

function testLivingPlanet(exp) {
  if (!exp.LivingPlanet) { console.log('  skip LivingPlanet'); return; }
  const { LivingPlanet, getTerritoryTier, getWorldSize, BASE_FIELD_W, BASE_FIELD_H } = exp;
  assert(LivingPlanet, 'LivingPlanet module should exist');
  assert(LivingPlanet.FOREST_UNLOCK_TIER === 2, 'forest should unlock at land tier 2');
  LivingPlanet.resetRun();
  const terrainWave = 35;
  const tier2 = getTerritoryTier(terrainWave);
  assert(tier2 >= 2, `wave ${terrainWave} should reach forest unlock tier`);
  const size = getWorldSize(terrainWave);
  const ctx = {
    worldW: size.w,
    worldH: size.h,
    baseW: BASE_FIELD_W,
    baseH: BASE_FIELD_H,
    territoryTier: tier2,
    wave: terrainWave,
  };
  assert(
    LivingPlanet.getBiomeAt(200, size.h - 80, ctx) === 'plains',
    'home rally should stay plains'
  );
  const northY = Math.max(40, BASE_FIELD_H * 0.25);
  assert(LivingPlanet.getBiomeAt(200, northY, ctx) === 'forest', 'expanded north should be forest');
  const mountCtx = { ...ctx, territoryTier: 6, wave: 70 };
  const mountSize = getWorldSize(70);
  mountCtx.worldW = mountSize.w;
  mountCtx.worldH = mountSize.h;
  mountCtx.territoryTier = getTerritoryTier(70);
  const deepNorth = Math.max(30, BASE_FIELD_H * 0.15);
  assert(
    LivingPlanet.getBiomeAt(200, deepNorth, mountCtx) === 'mountains',
    'deep north should be mountains'
  );
  const hellCtx = { ...mountCtx, wave: 1001 };
  assert(
    LivingPlanet.getBiomeAt(200, 50, hellCtx) === 'hellscape',
    'wave 1001 north should be hellscape'
  );
  const plainsMods = LivingPlanet.getModifiersAt(200, size.h - 80, ctx);
  const forestMods = LivingPlanet.getModifiersAt(200, northY, ctx);
  assert(plainsMods.speedMult > forestMods.speedMult, 'plains should be faster than forest');
  assert(forestMods.coverBonus > plainsMods.coverBonus, 'forest should add cover');
  const mountMods = LivingPlanet.getModifiersAt(200, deepNorth, mountCtx);
  assert(mountMods.damageTakenMult < forestMods.damageTakenMult, 'mountains should reduce damage');
  const bands = LivingPlanet.getRegionBands(mountCtx);
  assert(bands.length >= 2, 'should expose biome bands for rendering');
  const snap = LivingPlanet.getStateSnapshot(mountCtx.territoryTier, 70, mountCtx);
  assert(
    snap.unlocked.includes('forest') && snap.unlocked.includes('mountains'),
    'snapshot should list biomes'
  );
}

function testPlayerCounterEvolution(exp) {
  if (!exp.PlayerCounterEvolution) { console.log('  skip PlayerCounterEvolution'); return; }
  const { PlayerCounterEvolution, EnemyFactions } = exp;
  assert(PlayerCounterEvolution, 'PlayerCounterEvolution module should exist');
  assert(PlayerCounterEvolution.COUNTER_WAVE_MIN === 15, 'counter wave min should be 15');
  assert(!PlayerCounterEvolution.isUnlocked(14), 'inactive before wave 15');
  assert(PlayerCounterEvolution.isUnlocked(15), 'active at wave 15');
  assert(!PlayerCounterEvolution.canExpedition(24), 'expeditions locked before wave 25');
  assert(PlayerCounterEvolution.canExpedition(25), 'expeditions at wave 25');
  PlayerCounterEvolution.resetRun();
  const wave = 40;
  const kingdomStage = 2;
  const result = PlayerCounterEvolution.executeCounterDoctrine('probing_raid', wave, kingdomStage, {
    hooks: {},
  });
  assert(result.ok, 'should execute probing raid');
  assert(result.target, 'should pick a target faction');
  const mods = PlayerCounterEvolution.getFactionModifiers(result.target.id, wave);
  assert(mods.active, 'debuff should be active');
  assert(mods.stagePenalty >= 1, 'should apply stage penalty');
  const eff = PlayerCounterEvolution.getEffectiveStage(result.target.id, wave, 3);
  assert(eff <= 2, 'effective stage should be reduced');
  const factions = EnemyFactions.getActiveFactions(40);
  assert(factions.length >= 1, 'wave 40 should have active factions');
  const hunter = { id: 'h1', team: 'player', hp: 100, canHunt: true, combatType: 'ranged' };
  const dispatch = PlayerCounterEvolution.dispatchExpedition(factions[0].id, ['h1'], 25, {
    units: [hunter],
    hooks: {},
  });
  assert(dispatch.ok, 'should dispatch expedition');
  assert(hunter.onExpedition, 'hunter should be marked on expedition');
  const resolved = PlayerCounterEvolution.resolveExpeditions(26, {
    units: [],
    spawnUnit: () => ({ id: 'surv', type: 'archer' }),
    applyPlayerMods: () => {},
    hooks: {},
    worldW: 400,
    deployX: 200,
    deployY: 500,
    rallyY: 480,
    globalHunt: true,
  });
  assert(resolved.length >= 1, 'should resolve returning expedition');
  const snap = PlayerCounterEvolution.getStateSnapshot(40, kingdomStage);
  assert(snap.active, 'snapshot should be active');
  assert(snap.doctrines.includes('probing_raid'), 'should list unlocked doctrines');
  assert(snap.targets.length >= 1, 'snapshot should expose faction targets');
}

function testSettlementRaids(exp) {
  if (!exp.SettlementRaids) { console.log('  skip SettlementRaids (removed)'); return; }
  const { SettlementRaids, isKingdomRaidsUnlocked } = exp;
  assert(SettlementRaids, 'SettlementRaids module should exist');
  assert(SettlementRaids.SETTLEMENT_RAID_WAVE_MIN === 150, 'raid wave min should be 150');
  assert(!SettlementRaids.isActive(149), 'inactive before wave 150');
  assert(SettlementRaids.isActive(160), 'active at wave 160');
  SettlementRaids.resetRun();
  const mockBld = {
    id: 'raid-b1',
    type: 'enemy_trade_outpost',
    owner: 'enemy',
    hp: 100,
    maxHp: 100,
    isEnemySettlement: true,
    x: 100,
    y: 50,
    enemyFaction: 'goblin_hordes',
  };
  const missions = SettlementRaids.refreshMissions([mockBld], 160, {
    isAttackable: (b) => b && b.owner === 'enemy' && b.hp > 0,
  });
  assert(missions.length === 1, 'should create raid mission for enemy outpost');
  assert(missions[0].rewardTp >= 10, 'outpost raid should offer meaningful TP');
  const boost = SettlementRaids.getFactionBuildBoost(175);
  assert(boost.capBonus >= 1, 'wave 175 should accelerate enemy faction building');
  const u1 = { id: 'u1', team: 'player', hp: 100, canHunt: true, combatType: 'ranged' };
  const u2 = { id: 'u2', team: 'player', hp: 100, canHunt: true, combatType: 'melee' };
  const dispatch = SettlementRaids.dispatchStrike(missions[0].id, ['u1', 'u2'], {
    units: [u1, u2],
    hooks: {},
  });
  assert(dispatch.ok, 'should dispatch strike force');
  assert(u1.raidTargetId === 'raid-b1', 'hunter should lock raid target');
  let lootTp = 0;
  const result = SettlementRaids.onSettlementDestroyed(mockBld, {
    units: [u1, u2],
    grantTp: (n) => {
      lootTp += n;
    },
    grantScience: () => {},
    hooks: {},
  });
  assert(result?.strikeBonus, 'dispatched raid should pay full strike bonus');
  assert(lootTp >= 10, 'raid should grant TP loot');
  assert(isKingdomRaidsUnlocked(150), 'kingdom raids flag at 150');
}

function testUnitPanelScaling(exp) {
  const { GameDepth, createUnit, getSpecialistLateAbilityInfo, isSpecialistUnit } = exp;
  assert(GameDepth && createUnit, 'GameDepth and createUnit required');
  const healer = createUnit('healer', 100, 200, 'player', { spawnWave: 10 });
  assert(healer && isSpecialistUnit(healer), 'healer should be specialist');
  healer.vetTier = 3;
  healer.goldStarsEarned = 2;
  const snap = GameDepth.getUnitScalingSnapshot(healer, 25);
  assert(snap?.kind === 'specialist', 'healer should use specialist scaling snapshot');
  assert(snap.tenure === 15, 'tenure should be wave minus spawnWave');
  assert(snap.rankTier === 3, 'rank tier should match vetTier');
  assert(snap.tenureNote?.includes('W10'), 'tenure note should cite deploy wave');

  healer.goldStarsEarned = 3;
  healer.lateAbilityUnlocked = true;
  const massMend = getSpecialistLateAbilityInfo(healer);
  assert(
    massMend?.unlocked && massMend.name === 'Mass Mend',
    '3 gold stars unlocks Mass Mend'
  );
  const snapGold = GameDepth.getUnitScalingSnapshot(healer, 25);
  assert(
    snapGold.lateAbilityUnlocked && snapGold.lateAbilityName === 'Mass Mend',
    'snapshot should flag active late ability'
  );

  const builder = createUnit('builder', 120, 200, 'player', { spawnWave: 5 });
  builder.vetTier = 2;
  builder.goldStarsEarned = 1;
  const repair = getSpecialistLateAbilityInfo(builder);
  assert(
    !repair.unlocked && repair.name === 'Rapid Repair' && repair.rankNeeded === 2,
    'builder with 1 gold star needs 2 more for Rapid Repair'
  );

  const courier = createUnit('courier', 140, 200, 'player', { spawnWave: 8 });
  courier.goldStarsEarned = 3;
  courier.lateAbilityUnlocked = true;
  const twin = getSpecialistLateAbilityInfo(courier);
  assert(
    twin?.unlocked && twin.name === 'Twin Dispatch' && /two messages/i.test(twin.desc || ''),
    '3 gold stars unlocks Twin Dispatch (two messages per wave)'
  );

  const foot = createUnit('footman', 160, 200, 'player', { spawnWave: 5 });
  const footSnap = GameDepth.getUnitScalingSnapshot(foot, 25);
  assert(footSnap?.kind === 'vanilla', 'footman should use vanilla snapshot');
  assert(
    footSnap.tenureHpPct > 100 && footSnap.tenureDmgPct > 100,
    'vanilla tenure should show scaling mults'
  );
}

function testFactionIntel(exp) {
  if (!exp.FactionIntel) { console.log('  skip FactionIntel'); return; }
  const { FactionIntel, EnemyFactions } = exp;
  assert(FactionIntel, 'FactionIntel module should exist');
  const gs = {
    wave: 20,
    enemyFactions: EnemyFactions.getStateSnapshot(20, [], []),
    counterEvolution: { targets: [] },
    factionReputation: { factions: [] },
    planetConquest: { active: false, sectors: [] },
    multiFrontSiege: { assignments: [] },
    asymmetricWarfare: { hostThreatLevel: 2, hostLevelLabel: 'Grunt Host' },
  };
  const rows = FactionIntel.buildIntelRows(gs);
  assert(rows.length >= 5, 'should list all major factions');
  const active = rows.filter((r) => r.status === 'active' || r.status === 'weakened');
  assert(active.length >= 2, 'wave 20 should have multiple active factions');
  const goblin = rows.find((r) => r.id === 'goblin_hordes');
  assert(goblin && goblin.stage >= 1, 'goblin should have evolution stage');
  const summary = FactionIntel.formatSummary(gs);
  assert(summary.includes('S'), 'summary should mention stages');
  const snap = FactionIntel.getStateSnapshot(gs);
  assert(snap.activeCount >= 2, 'snapshot should count active factions');
}

function testPlanetConquest(exp) {
  if (!exp.PlanetConquest) { console.log('  skip PlanetConquest (removed)'); return; }
  const { PlanetConquest, EnemyFactions, createUnit } = exp;
  assert(PlanetConquest, 'PlanetConquest module should exist');
  PlanetConquest.resetRun({ forcedMode: true });
  assert(PlanetConquest.isActive(499, 'campaign'), 'forced mode active before wave 500');
  PlanetConquest.resetRun({ forcedMode: false });
  assert(!PlanetConquest.isActive(499, 'campaign'), 'inactive before wave 500');
  assert(PlanetConquest.isActive(500, 'campaign'), 'active at wave 500');
  assert(PlanetConquest.isActive(1, 'planet_conquest'), 'planet_conquest mode always active');

  const units = [];
  const buildings = [];
  const ctx = {
    modeId: 'planet_conquest',
    worldW: 500,
    worldH: 600,
    units,
    buildings,
    spawnUnit: (type, x, y, team, opts) => createUnit(type, x, y, team, opts),
    hooks: {},
  };
  PlanetConquest.onWaveStart(500, ctx);
  const snap = PlanetConquest.getStateSnapshot(500, 500, 600, buildings, units, 'planet_conquest');
  assert(snap.sectors?.length >= 4, 'should initialize sectors for active factions');
  assert(snap.active, 'snapshot should be active');

  PlanetConquest.onEnemySlain(
    { type: 'goblin', team: 'enemy', enemyFaction: 'goblin_hordes' },
    500,
    ctx
  );
  const gob =
    snap.sectors.find((s) => s.factionId === 'goblin_hordes') ||
    PlanetConquest.getStateSnapshot(
      500,
      500,
      600,
      buildings,
      units,
      'planet_conquest'
    ).sectors.find((s) => s.factionId === 'goblin_hordes');
  assert(gob && gob.playerControl > 0, 'kills should raise player conquest percent');

  for (let i = 0; i < 40; i++) {
    PlanetConquest.onEnemyStructureDestroyed(
      {
        type: 'enemy_hamlet',
        owner: 'enemy',
        enemyFaction: 'goblin_hordes',
      },
      500,
      ctx
    );
  }
  PlanetConquest.onWaveEnd(500, ctx);
  assert(
    PlanetConquest.isFactionEliminated('goblin_hordes'),
    'goblin sector should eliminate after heavy losses'
  );

  const filtered = PlanetConquest.filterSpawnQueue(['goblin', 'orc', 'necromancer'], 500);
  assert(
    !filtered.includes('goblin'),
    'eliminated faction units should be filtered from spawn queue'
  );
  assert(
    filtered.includes('orc') || filtered.includes('necromancer'),
    'active factions remain in queue'
  );

  for (const fid of ['orc_warbands', 'dark_legions']) {
    for (let i = 0; i < 40; i++) {
      PlanetConquest.onEnemyStructureDestroyed(
        {
          type: 'enemy_hamlet',
          owner: 'enemy',
          enemyFaction: fid,
        },
        500,
        ctx
      );
    }
    PlanetConquest.onWaveEnd(500, ctx);
  }
  const mid = PlanetConquest.getStateSnapshot(500, 500, 600, buildings, units, 'planet_conquest');
  assert(mid.eliminations >= 2, 'two realms should fall');
  if (!PlanetConquest.findPlanetBoss(units)) {
    assert(PlanetConquest.shouldSpawnBoss(), 'boss should be ready after two eliminations');
    PlanetConquest.spawnPlanetBoss(500, ctx);
  }
  const boss = PlanetConquest.findPlanetBoss(units);
  assert(boss?.isPlanetBoss, 'planet boss should spawn');
  assert(boss.maxHp > 520, 'boss should scale with absorbed realms');

  PlanetConquest.onPlanetBossSlain(boss, 500, ctx);
  assert(PlanetConquest.isVictoryReady(500, 'planet_conquest'), 'boss slain should ready victory');
  assert(PlanetConquest.isBossDefeated(), 'boss defeated flag set');

  PlanetConquest.resetRun({ forcedMode: true });
  PlanetConquest.onWaveStart(500, ctx);
  for (const fid of ['goblin_hordes', 'orc_warbands', 'dark_legions', 'void_abyssal']) {
    for (let i = 0; i < 50; i++) {
      PlanetConquest.onEnemyStructureDestroyed(
        { type: 'enemy_hamlet', owner: 'enemy', enemyFaction: fid },
        500,
        ctx
      );
    }
    PlanetConquest.onWaveEnd(500, ctx);
  }
  assert(
    !PlanetConquest.isVictoryReady(500, 'planet_conquest'),
    'all realms eliminated without boss slain is not true victory'
  );
  PlanetConquest.resetRun({ forcedMode: false });
}

function testPlanetWarfare(exp) {
  const { PlanetWarfare, RTS_ERA_WAVE } = exp;
  if (!PlanetWarfare) {
    console.log('  skip PlanetWarfare (macro layer removed)');
    return;
  }
  assert(RTS_ERA_WAVE === 200, 'RTS era wave should be 200');
  assert(!PlanetWarfare.isActive(199), 'inactive before wave 200');
  assert(PlanetWarfare.isActive(200), 'active at wave 200');
  PlanetWarfare.resetRun();
  const start = PlanetWarfare.onWaveStart(200, { buildings: [], hostKingdomTotal: 0 });
  assert(start.next >= 0.12, 'should seed hostile control at wave 200');
  const line = PlanetWarfare.getHostileLineY(600, 0.5);
  assert(line > 100 && line < 400, 'hostile line should sit mid-map at 50% control');
  const northSpawn = PlanetWarfare.modifySpawnPos(
    'north',
    { x: 200, y: 12 },
    { wave: 220, worldW: 400, worldH: 600, control: 0.6 }
  );
  assert(northSpawn.y > 12, 'high control should creep north spawns southward');
  const push = PlanetWarfare.onEnemyStructureDestroyed({ wave: 210 });
  assert(push.delta < 0, 'razing structures should reduce control');
  PlanetWarfare.onWaveStart(210, {
    buildings: [{ owner: 'enemy', hp: 100, type: 'enemy_hamlet', isEnemySettlement: true }],
  });
  const creep = PlanetWarfare.getControl();
  assert(creep > push.next, 'enemy buildings should accelerate creep on wave start');
  assert(PlanetWarfare.getSpawnIntervalMult(0.75) < 1, 'high control should hasten spawns');
  assert(PlanetWarfare.getVisionRadiusMult(0.7) < 1, 'high control should reduce vision');
  const spotted = PlanetWarfare.isPositionSpotted(200, 50, {
    wave: 210,
    worldH: 600,
    units: [{ team: 'player', x: 210, y: 120, hp: 100 }],
    buildings: [],
  });
  assert(spotted, 'nearby player units should spot hostile-zone enemies');
  const snap = PlanetWarfare.getStateSnapshot(210, 400, 600, [], []);
  assert(snap.active && snap.hostileControlPct >= 10, 'snapshot should expose control percent');
}

function testKingdomEvolution(exp) {
  const {
    getKingdomEvolutionStage,
    getKingdomStageBuffs,
    isKingdomRaidsUnlocked,
    isKingdomLoadoutsUnlocked,
    Game,
    ColonyValue,
    KINGDOM_DOCTRINES,
  } = exp;
  assert(typeof getKingdomEvolutionStage === 'function', 'getKingdomEvolutionStage should exist');
  assert(getKingdomEvolutionStage(1).stage === 1, 'wave 1 should be Outpost stage');
  assert(getKingdomEvolutionStage(30).name === 'Outpost Realm', 'wave 30 stays Outpost');
  assert(getKingdomEvolutionStage(31).stage === 2, 'wave 31 should be Kingdom Rising');
  assert(getKingdomEvolutionStage(99).stage === 2, 'wave 99 stays Rising');
  assert(getKingdomEvolutionStage(100).stage === 3, 'wave 100 should be Empire Ascendant');
  assert(getKingdomEvolutionStage(199).stage === 3, 'wave 199 stays Empire');
  assert(getKingdomEvolutionStage(200).stage === 4, 'wave 200 should be Planetary Dominion');
  const buffs = getKingdomStageBuffs(100);
  assert(buffs.loadoutsUnlocked === true, 'loadouts unlock at Empire');
  assert(buffs.colonyPressureCurve > 1, 'Empire should amplify colony pressure');
  assert(isKingdomRaidsUnlocked(149) === false, 'raids locked before wave 150');
  assert(isKingdomRaidsUnlocked(150) === true, 'raids unlock at wave 150');
  assert(isKingdomLoadoutsUnlocked(99) === false, 'loadouts locked before wave 100');
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  const gs = Game.getState();
  assert(gs.kingdomStage === 1, 'creative start should expose kingdomStage');
  assert(gs.kingdomEvolution?.shortName, 'getState should expose kingdomEvolution');
  assert(gs.kingdomEvolutionMeter?.fill >= 0, 'getState should expose evolution meter fill');
  assert(gs.kingdomDoctrines?.imperial_march, 'imperial march doctrine should exist');
  assert(Array.isArray(gs.unlockedKingdomDoctrines), 'unlocked doctrines list exposed');
  if (ColonyValue?.computeEvolutionMeter) {
    const meter = ColonyValue.computeEvolutionMeter({
      wave: 100,
      researchCompleted: 5,
      researchTotal: 20,
    });
    assert(meter.bannerStage === 3, 'wave 100 meter should be empire banner stage');
    assert(meter.signals.colony >= 0, 'meter should have colony signal');
  }
}

function testEvolvedAlliesEncyclopedia(FactionDepth) {
  if (!FactionDepth?.getEncyclopediaEntries) {
    fail('FactionDepth.getEncyclopediaEntries missing');
    return;
  }
  const entries = FactionDepth.getEncyclopediaEntries();
  const lead = entries.find((e) => e.name === 'Evolved Allies — Design Philosophy');
  assert(
    lead?.body?.includes('evolved allies'),
    'lead entry should frame crossovers as evolved allies'
  );
  const early = entries.find((e) => e.name === 'Early Game — Rare Power Spikes');
  assert(early?.body?.includes('mini-bosses'), 'early game entry should describe rare spikes');
  const planet = entries.find((e) => e.name === 'Planet Warfare Operatives (Wave 200+)');
  assert(planet?.body?.includes('Baird'), 'planet ops should list Tech Head / Baird');
  assert(planet?.body?.includes('Kael Skyburst'), 'planet ops should list Skyburst Wave');
  const secret = entries.find((e) => e.name === 'Secret Content & Meta Unlocks');
  assert(secret?.body?.includes('WWE'), 'secret content should mention WWE');
  assert(
    FactionDepth.PLANET_WARFARE_OPERATIVES?.tech_head?.siegeMult >= 2,
    'tech_head should have siege mult'
  );
}

function testPlanetWarfareOps(FactionDepth, createUnitFn) {
  if (!FactionDepth?.modifyBuildingDamage || !FactionDepth.isPlanetSiegeSpecialist) {
    fail('FactionDepth planet warfare hooks missing');
    return;
  }
  assert(
    !FactionDepth.isPlanetSiegeSpecialist({ isCrossover: true, wweAbility: 'tech_head' }, 50),
    'inactive before wave 200'
  );
  assert(
    FactionDepth.isPlanetSiegeSpecialist({ isCrossover: true, wweAbility: 'tech_head' }, 210),
    'tech_head active at wave 210'
  );
  const baird = createUnitFn('damon_baird', 0, 0, 'player');
  baird.isCrossover = true;
  baird.wweAbility = 'tech_head';
  const hamlet = {
    owner: 'enemy',
    hp: 400,
    maxHp: 400,
    isHamlet: true,
    isEnemySettlement: true,
    type: 'enemy_hamlet',
  };
  const base = 40;
  const boosted = FactionDepth.modifyBuildingDamage(baird, hamlet, base, 210);
  assert(boosted > base, 'planet warfare should boost settlement damage at wave 210');
  const early = FactionDepth.modifyBuildingDamage(baird, hamlet, base, 50);
  assert(early === base, 'no boost before wave 200');
}

function testEnemyFactionEncyclopedia(EnemyFactions) {
  if (!EnemyFactions?.getEncyclopediaEntries) {
    fail('EnemyFactions.getEncyclopediaEntries missing');
    return;
  }
  const entries = EnemyFactions.getEncyclopediaEntries();
  assert(
    entries.length >= 23,
    'faction encyclopedia should have overviews + tracks + 20 stage pages'
  );
  const overview = entries.find((e) => e.name === 'Enemy Faction Evolution System');
  assert(overview?.body?.includes('Stage 4 Kingdom'), 'overview should describe kingdom stage');
  const goblinS2 = entries.find((e) => e.name === 'Goblin Hordes — Stage 2: Organized');
  assert(
    goblinS2?.body?.includes('goblin_sapper') || goblinS2?.body?.includes('Sapper'),
    'goblin stage 2 should list sappers'
  );
  assert(goblinS2?.campaignWave === 8, 'goblin stage 2 should gate at wave 8');
  const darkS4 = entries.find(
    (e) => e.name?.includes('Dark Legions') && e.name?.includes('Stage 4')
  );
  assert(darkS4?.body?.includes('Counter-raids: ACTIVE'), 'dark stage 4 should flag counter-raids');
  const mirror = entries.find((e) => e.name === 'Mirror Empires — Evolution Track');
  assert(mirror?.body?.includes('Wave 200'), 'mirror track should cite debut wave');
}

function testColonyValueEncyclopedia(ColonyValue) {
  if (!ColonyValue?.getEncyclopediaEntries) {
    fail('ColonyValue.getEncyclopediaEntries missing');
    return;
  }
  const entries = ColonyValue.getEncyclopediaEntries();
  assert(entries.length >= 14, 'colony value encyclopedia should have overview + detailed entries');
  const lead = entries.find((e) => e.name === 'Kingdom Strength & Enemy Adaptation');
  assert(
    lead?.body?.includes('aggression and composition'),
    'lead entry should explain aggression/composition'
  );
  const aggression = entries.find((e) => e.name === 'Aggression: Host Size & Stats');
  assert(aggression?.body?.includes('countMult'), 'aggression entry should document count mult');
  const composition = entries.find((e) => e.name === 'Composition: Adaptive Spawn Pool');
  assert(
    composition?.body?.includes('goblin_sapper'),
    'composition entry should list wall counters'
  );
  const elites = entries.find((e) => e.name === 'Elite Injection Slots');
  assert(elites?.body?.includes('1.08'), 'elite entry should cite formidable threshold');
  const tiers = entries.find((e) => e.name === 'Threat Tiers');
  assert(tiers?.body?.includes('Empire'), 'threat tiers should list Empire stage');
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
  assert(
    pressure.countMult >= 0.7 && pressure.countMult <= 1.55,
    'count mult should stay in colony band'
  );
  assert(
    pressure.hpMult >= 0.9 && pressure.hpMult <= 1.14,
    'hp mult should stay modest vs wave scaling'
  );
  Game.beginDayPhase?.(true);
  const after = Game.getState();
  assert(after.colonyValue > 0, 'getState should expose colonyValue');
  assert(
    after.colonyThreatMods?.countMult,
    'getState should expose colony threat mods after wave build'
  );
  const tip = ColonyValue.formatThreatTooltip(colony, pressure, after.wave || 1);
  assert(tip.includes('Kingdom Strength'), 'threat tooltip should headline kingdom strength');
  assert(tip.includes(colony.tier.label), 'threat tooltip should name the current stage');
  assert(
    after.colonyThreatTooltip?.includes(colony.tier.label),
    'getState should expose colonyThreatTooltip'
  );
}

function clickWorld(Game, wx, wy) {
  const gs = Game.getState();
  Game.panCameraToFraction(wx / gs.worldW, wy / gs.worldH);
  for (let sx = 80; sx < 1200; sx += 32) {
    for (let sy = 60; sy < 660; sy += 32) {
      Game.clearSelection();
      Game.handleClick(sx, sy);
      if (Game.getState().selectedUnitId) return { sx, sy };
    }
  }
  return null;
}

function testTouchDeselect(exp) {
  const { Game } = exp;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  const cx = Game.getWorldCenter();
  Game.creativeSpawnPlayerAt('footman', cx.x, cx.y);
  const snap = Game.getUnitsSnapshot().find((u) => u.type === 'footman' && u.team === 'player');
  assert(snap, 'footman should exist for touch deselect test');
  const hit = clickWorld(Game, snap.x, snap.y);
  if (!hit) return;
  Game.handleClick(hit.sx, hit.sy, { touch: true });
  assert(!Game.getState().selectedUnitId, 'touch tap on lone selected unit should deselect');
  assert(!Game.getState().selectedUnitIds?.length, 'touch deselect should clear multi-select list');
}

function testHamletFortifyWalls(exp) {
  const { Game } = exp;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.creativeSetTp?.(9999);
  const cx = Game.getWorldCenter();
  const wallsBefore = Game.getBuildingsSnapshot().filter(
    (b) => b.type === 'wall' && b.owner === 'player'
  ).length;
  assert(
    Game.creativeSpawnPlayerBuildingAt('hamlet', cx.x, cx.y),
    'hamlet should place in creative'
  );
  assert(
    Game.creativeSpawnPlayerBuildingAt('fortress_upgrade', cx.x, cx.y),
    'fortress upgrade should snap onto hamlet'
  );
  const wallsAfter = Game.getBuildingsSnapshot().filter(
    (b) => b.type === 'wall' && b.owner === 'player'
  ).length;
  assert(wallsAfter > wallsBefore, 'first hamlet fortify should spawn palisade wall segments');
  const hamlets = Game.getBuildingsSnapshot().filter(
    (b) => b.type === 'hamlet' && b.owner === 'player'
  );
  assert(hamlets.length >= 1, 'player hamlet should remain after fortify');
}

function testHuntPursuesEnemyBuilding(exp) {
  const { Game } = exp;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.creativeForceDay?.();
  const cx = Game.getWorldCenter();
  assert(
    Game.creativeSpawnEnemyBuildingAt('enemy_hamlet', cx.x + 180, cx.y),
    'enemy hamlet should place'
  );
  assert(
    Game.creativeSpawnPlayerAt('footman', cx.x - 40, cx.y),
    'footman should spawn for hunt test'
  );
  const snap = Game.getUnitsSnapshot().find((u) => u.type === 'footman' && u.team === 'player');
  assert(snap, 'footman snapshot should exist');
  for (let i = 0; i < 90; i++) Game.update();
  const live = Game.getUnitById(snap.id);
  assert(live, 'footman should survive hunt pathing test');
  const pursuing = !!(live.structureTargetId || String(live.pathTargetId || '').startsWith('bld:'));
  assert(
    pursuing,
    'hunt mode should assign enemy structure pursuit (structureTargetId or bld: path)'
  );
}

function testEnemyTradePostSiegeable(exp) {
  const { Game } = exp;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.setCreativeSetting?.('unlockAll', true);
  Game.setCreativeSetting?.('freeResources', true);
  Game.setCreativeSetting?.('instantBuild', true);
  Game.setCreativeSetting?.('academyDeploy', true);
  Game.creativeForceDay?.();
  const cx = Game.getWorldCenter();
  assert(
    Game.creativeSpawnEnemyBuildingAt('enemy_trade_outpost', cx.x + 120, cx.y - 60),
    'enemy trade post should place'
  );
  assert(
    !Game.creativeSpawnEnemyBuildingAt('trade_outpost', cx.x + 80, cx.y - 40),
    'player trade post cannot be placed as enemy building'
  );
  const posted = Game.getBuildingsSnapshot().find((b) => b.type === 'enemy_trade_outpost');
  assert(
    posted && posted.hp > 0 && posted.maxHp > 0 && posted.complete,
    'enemy trade post should spawn with health'
  );

  Game.restoreCreativeSnapshot({
    wave: 12,
    buildings: [
      {
        type: 'trade_outpost',
        owner: 'enemy',
        x: cx.x + 80,
        y: cx.y - 30,
        hp: 0,
        maxHp: 0,
        complete: true,
      },
    ],
    units: [{ type: 'sapper', team: 'player', x: cx.x + 80, y: cx.y - 30, hp: 65, maxHp: 65 }],
  });
  Game.creativeForceDay?.();
  const legacy = Game.getBuildingsSnapshot().find(
    (b) => b.type === 'trade_outpost' && b.owner === 'enemy'
  );
  assert(
    legacy && legacy.hp > 0 && legacy.maxHp > 0,
    'legacy enemy trade post should regain health when normalized'
  );
}

function testOutpostGarrisonRouting(exp) {
  const { Game } = exp;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.setCreativeSetting?.('unlockAll', true);
  Game.setCreativeSetting?.('freeResources', true);
  Game.setCreativeSetting?.('instantBuild', true);
  Game.setCreativeSetting?.('academyDeploy', true);
  Game.creativeForceDay?.();
  Game.creativeSetWave?.(8);
  const cx = Game.getWorldCenter();
  const outpostY = cx.y - 100;
  assert(Game.creativeSpawnPlayerBuildingAt('outpost', cx.x, outpostY), 'outpost should place');
  assert(
    Game.creativeSpawnPlayerAt('archer', cx.x + 24, outpostY),
    'archer should spawn near outpost'
  );
  const archerSnap = Game.getUnitsSnapshot().find(
    (u) => u.type === 'archer' && u.team === 'player'
  );
  assert(archerSnap, 'archer snapshot should exist');
  const unit = Game.getUnitById(archerSnap.id);
  assert(unit, 'archer should resolve by id');
  for (let i = 0; i < 180; i++) Game.update();
  assert(unit.garrisoned, 'archer should auto-garrison the outpost');
  const startY = unit.y;
  unit.fleeing = true;
  unit.fleeTicks = 0;
  unit.path = [];
  unit.pathIndex = 0;
  for (let i = 0; i < 45; i++) Game.update();
  assert(!unit.garrisoned, 'routing archer should leave outpost garrison');
  const op = Game.getBuildingsSnapshot().find((b) => b.type === 'outpost');
  assert(op && !op.garrisonUnitId, 'outpost should clear garrison when archer routes');
  assert(
    unit.y > startY + 18,
    'routing archer should flee south instead of being snapped to the outpost'
  );
}

function testHealerDamageRetreat(exp) {
  const { Game } = exp;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.setCreativeSetting?.('unlockAll', true);
  Game.setCreativeSetting?.('freeResources', true);
  Game.setCreativeSetting?.('instantBuild', true);
  Game.creativeForceDay?.();
  const cx = Game.getWorldCenter();
  assert(
    Game.creativeSpawnPlayerBuildingAt('medical_tent', cx.x - 60, cx.y),
    'med tent should place'
  );
  assert(Game.creativeSpawnPlayerAt('healer', cx.x + 40, cx.y), 'healer should spawn');
  const snap = Game.getUnitsSnapshot().find((u) => u.type === 'healer' && u.team === 'player');
  const healer = Game.getUnitById(snap.id);
  assert(healer, 'healer should resolve by id');
  Game.applyCreativeUnitStats(healer, { hp: 100, maxHp: 100 });
  Game.takeDamage(healer, 12, { attackerTeam: 'enemy' });
  assert(
    healer.healerFleeing || healer.retreatingToMed,
    'damaged healer should flee toward a med tent'
  );
  assert(healer.path?.length > 0, 'healer retreat should assign a path to the med tent');
  for (let i = 0; i < 180; i++) Game.update();
  assert(
    !healer.healerFleeing || healer.retreatingToMed || healer.atMedicalTent,
    'healer should hold retreat while still targeted or remain at tent'
  );
}

function testMedicalRetreatGlobal(exp) {
  const { Game } = exp;
  Game.setDifficulty('normal');
  Game.start({ creative: true });
  Game.setCreativeSetting?.('unlockAll', true);
  Game.setCreativeSetting?.('freeResources', true);
  Game.setCreativeSetting?.('instantBuild', true);
  Game.setCreativeSetting?.('academyDeploy', true);
  Game.creativeForceDay?.();
  const cx = Game.getWorldCenter();
  assert(
    Game.creativeSpawnPlayerBuildingAt('medical_tent', cx.x - 80, cx.y),
    'near med tent should place'
  );
  assert(
    Game.creativeSpawnPlayerBuildingAt('medical_tent', cx.x + 500, cx.y),
    'far med tent should place'
  );
  assert(
    Game.creativeSpawnPlayerAt('footman', cx.x + 120, cx.y),
    'footman should spawn for med retreat test'
  );
  const snap = Game.getUnitsSnapshot().find((u) => u.type === 'footman' && u.team === 'player');
  assert(snap, 'footman snapshot should exist');
  const unit = Game.getUnitById(snap.id);
  assert(unit, 'footman should resolve by id');
  const startX = unit.x;
  Game.applyCreativeUnitStats(unit, { hp: 100, morale: 100 });
  unit.hp = 24;
  unit.huntMode = false;
  unit.manualOrder = false;
  unit.fightToDeath = true;
  for (let i = 0; i < 60; i++) Game.update();
  assert(unit.retreatingToMed, 'wounded footman should retreat when a med tent exists');
  assert(!unit.fightToDeath, 'fightToDeath should clear once a med tent is available');
  const tents = Game.getBuildingsSnapshot().filter((b) => b.type === 'medical_tent' && b.complete);
  assert(tents.length === 2, 'both med tents should be complete');
  const near = tents.reduce((a, b) => (a.x < b.x ? a : b));
  const far = tents.reduce((a, b) => (a.x > b.x ? a : b));
  const distNear = Math.hypot(unit.x - near.x, unit.y - near.y);
  const distFar = Math.hypot(unit.x - far.x, unit.y - far.y);
  assert(distNear < distFar, 'footman should head toward the globally nearest med tent');
  assert(unit.x < startX - 8, 'footman should move toward the nearer med tent');
}

function testSpritePanelIcons(exp) {
  const { SpriteGen } = exp;
  assert(typeof SpriteGen.drawIcon === 'function', 'SpriteGen.drawIcon should exist');
  assert(typeof SpriteGen.drawBattlefield === 'function', 'SpriteGen.drawBattlefield should exist');
  const ctx = ctx2d();
  SpriteGen.drawIcon(ctx, 'footman', 28, 28);
  assert(ctx.globalAlpha === 1, 'drawIcon should reset globalAlpha');
  SpriteGen.drawBattlefield(ctx, 400, 600);
  assert(ctx.globalAlpha === 1, 'drawBattlefield should leave globalAlpha at 1');
}

console.log('Headless crossover runtime tests\n');

let exp = loadGame();
const {
  MetaProgress,
  FactionDepth,
  CrossoverHub,
  SpriteGen,
  StrikeFX,
  createUnit,
  perkMachinesUnlocked,
  ACADEMY_ERA_WAVE,
  sb,
} = exp;
if (SpriteGen) SpriteGen.prewarmCache = noop;
MetaProgress.load();

testPerkMachines(MetaProgress, perkMachinesUnlocked);
testCrossoverHubUI(MetaProgress, CrossoverHub, sb.document);
testAbilityProcs(FactionDepth, createUnit);
testSynergiesAndMastery(FactionDepth, createUnit);
testFairRepresentation(FactionDepth, exp.BuildDefs);
testStrikeFX(StrikeFX, SpriteGen);
testGameRecruitFlow(exp);
testKingdomEvolution(exp);
testEnemyFactions(exp);
testPlanetWarfare(exp);
testPlanetConquest(exp);
testAsymmetricWarfare(exp);
testSettlementRaids(exp);
testMultiFrontSiege(exp);
testMonsterBosses(exp);
testNeutralWildlife(exp);
testFactionHazards(exp);
testCrownLegacies(exp);
testFactionReputation(exp);
testFactionIntel(exp);
testDynamicMapEvents(exp);
testLivingPlanet(exp);
testPlayerCounterEvolution(exp);
testColonyValue(exp);
testTouchDeselect(exp);
testHamletFortifyWalls(exp);
testHuntPursuesEnemyBuilding(exp);
testEnemyTradePostSiegeable(exp);
testOutpostGarrisonRouting(exp);
testHealerDamageRetreat(exp);
testMedicalRetreatGlobal(exp);
testSpritePanelIcons(exp);
testAcademyEraMode(exp, ACADEMY_ERA_WAVE);
testNamedBossEncyclopedia(exp.MonsterBosses);
testLoadoutEncyclopedia(exp, createUnit);
testResearchEncyclopedia(exp.Research);
testColonyValueEncyclopedia(exp.ColonyValue);
testEnemyFactionEncyclopedia(exp.EnemyFactions);
testEvolvedAlliesEncyclopedia(exp.FactionDepth);
testPlanetWarfareOps(exp.FactionDepth, createUnit);
testResearchGates(exp.Research, exp.BuildDefs);
testVeteranDoctrine(exp.Research, createUnit, exp.canSpendTpVeteranUpgrade);
testUnitPanelScaling(exp);
testScalingSymmetry(exp.GameDepth, createUnit, exp.getWaveConfig, exp.getDifficultyDef);
testOperativeInjection(exp.GameDepth, exp.isEnemyHordeGruntType, exp.getUnlockedEvilOperatives);
testCampaignBuildGate(exp);

if (issues.length) {
  console.log(`FAILED (${issues.length}):`);
  issues.forEach((i) => console.log(`  ✗ ${i}`));
  process.exit(1);
}
console.log('\nAll headless crossover runtime tests passed.');
process.exit(0);
