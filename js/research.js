/**
 * Doctrines and charters. After every tenth wave the player takes one of two doctrines for
 * the rest of the run; buildings beyond the starters open by charter when their wave comes.
 * Every troop can be recruited from wave 1.
 */
const Research = (() => {
  const STARTER_DEPLOY = new Set([
    'footman',
    'archer',
    'mage',
    'cavalry',
    'healer',
    'builder',
    'courier',
    'crossbowman',
    'knight',
    'sapper',
    'scout',
    'pikeman',
    'bard',
    'ballista',
    'general',
  ]);
  const STARTER_BUILD = new Set([
    'outpost',
    'wall',
    'medical_tent',
    'mess_hall',
    'research_lab',
    'hall_of_veterans',
    'watchtower',
    'trade_outpost',
    'enemy_hamlet',
    'enemy_merchant_guild',
    'enemy_trade_outpost',
    'enemy_quarry',
  ]);

  /** Faction crossover research — cost reflects tech tier + combat power. */
  const COMPANY_RESEARCH = [
    {
      id: 'xf_gears',
      faction: 'sawtooth',
      name: 'Sawtooth Ditch Doctrine',
      cost: 85,
      wave: 1,
      tier: 1,
      desc: 'Modern infantry tactics — unlock Trench Academy construction.',
    },
    {
      id: 'xf_lotr',
      faction: 'thornroad',
      name: 'March Protocols',
      cost: 85,
      wave: 1,
      tier: 1,
      desc: 'Thornroad war council — unlock Thornroad Camp.',
    },
    {
      id: 'xf_ultimis',
      faction: 'powderhorn',
      name: 'Powderhorn Studies',
      cost: 85,
      wave: 1,
      tier: 2,
      desc: 'black-powder mining lore — unlock Powderhorn Barracks.',
    },
    {
      id: 'xf_halo',
      faction: 'greywatch',
      name: 'Vanguard Augmentation',
      cost: 100,
      wave: 1,
      tier: 2,
      desc: 'Orbital powered armor — unlock Vanguard Academy.',
    },
    {
      id: 'xf_primis',
      faction: 'pale_vigil',
      name: 'Pale Vigil Barrow Lore',
      cost: 100,
      wave: 1,
      tier: 3,
      desc: 'barrow-watch rites — unlock Pale Vigil Shrine.',
    },
    {
      id: 'xf_baki',
      faction: 'knucklebone',
      name: 'Knucklebone Fighting Lore',
      cost: 120,
      wave: 1,
      tier: 3,
      desc: 'Bare-knuckle pit craft — unlock Knucklebone Lodge.',
    },
    {
      id: 'xf_fotns',
      faction: 'quiet_hand',
      name: 'Seven Star Fist Archives',
      cost: 120,
      wave: 1,
      tier: 4,
      desc: 'Quiet Hand assassination art — unlock Quiet Hand Dojo.',
    },
    {
      id: 'xf_dragonball',
      faction: 'emberblood',
      name: 'Ki Manipulation Theory',
      cost: 140,
      wave: 1,
      tier: 4,
      desc: 'Emberblood fire-forging — unlock Emberblood Foundry.',
    },
    {
      id: 'xf_jojo',
      faction: 'marrow_choir',
      name: 'Spirit Arrow Metallurgy',
      cost: 140,
      wave: 1,
      tier: 5,
      desc: 'Marrow Choir weapons — unlock Marrow Choir Shrine.',
    },
    {
      id: 'xf_imperium',
      faction: 'iron_psalm',
      name: 'Legion Gene-Seed Theory',
      cost: 140,
      wave: 1,
      tier: 5,
      desc: 'Psalm-bound plate doctrine — unlock Iron Psalm Chapel.',
    },
    {
      id: 'xf_crystal',
      faction: 'saltglass',
      name: 'Crystal Aether Studies',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'Saltglass lens theory — unlock Saltglass Sanctum.',
    },
    {
      id: 'xf_warp',
      faction: 'open_wound',
      name: 'Warp Rift Containment',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'Forbidden wound rites — unlock Open Wound Shrine.',
    },
    {
      id: 'xf_wwe',
      faction: 'champions',
      name: 'Arena Warfare Doctrine',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'The grand arena goes to war — unlock Champions’ Hall.',
    },
    {
      id: 'xf_tes',
      faction: 'rimehowl',
      name: 'Voice & Wyrm Prophecy',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'Voices of the wyrm — unlock Rimehowl Moot Hall.',
    },
    {
      id: 'doom_protocol',
      faction: null,
      name: 'Hellgate Containment',
      cost: 220,
      wave: 1,
      tier: 6,
      prereq: ['xf_jojo', 'xf_dragonball'],
      desc: 'Rend-and-ruin containment theory — unlock Hellbane deployment.',
    },
  ];

  const CORE_TREE = [
    {
      id: 'iron_weapons',
      name: 'Iron Weapons',
      cost: 20,
      wave: 3,
      category: 'military',
      desc: 'Sappers, knights and crossbowmen.',
      deploy: ['sapper', 'knight', 'crossbowman'],
    },
    {
      id: 'veteran_doctrine',
      name: 'Veteran Doctrine',
      cost: 34,
      wave: 10,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Spend TP to promote core troops — keeps vanilla ranks relevant as waves escalate.',
      feature: 'tp_veteran_upgrade',
    },
    {
      id: 'fortification',
      name: 'Fortification',
      cost: 30,
      wave: 6,
      category: 'defense',
      desc: 'Castle compounds — walls, keep, and command center.',
      build: ['castle', 'castle_keep'],
    },
    {
      id: 'field_engineering',
      name: 'Field Engineering',
      cost: 18,
      wave: 3,
      category: 'defense',
      desc: 'Spike traps, and the Outpost upgrades: Barracks or Granary.',
      build: ['spike_trap', 'outpost_barracks', 'outpost_granary'],
    },
    {
      id: 'morale_arts',
      name: 'Morale Arts',
      cost: 18,
      wave: 4,
      category: 'support',
      desc: 'Bards inspire the ranks.',
      deploy: ['bard'],
    },
    {
      id: 'command_theory',
      name: 'Command Theory',
      cost: 30,
      wave: 6,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Officers who command the whole army.',
      deploy: ['general'],
    },
    {
      id: 'advanced_infantry',
      name: 'Advanced Infantry',
      cost: 26,
      wave: 7,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Scouts and pikemen formations.',
      deploy: ['scout', 'pikeman'],
    },
    {
      id: 'siege_engineering',
      name: 'Siege Engineering',
      cost: 34,
      wave: 9,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Sapper and Ballista Academies.',
      deploy: ['ballista'],
      build: ['academy_sapper', 'academy_ballista'],
    },
    {
      id: 'prospecting',
      name: 'Prospecting',
      cost: 30,
      wave: 8,
      category: 'economy',
      prereq: ['field_engineering'],
      desc: 'Quarries: +3 TP at dawn each.',
      build: ['quarry'],
    },
    {
      id: 'academy_charter',
      name: 'Academy Charter',
      cost: 65,
      wave: 20,
      category: 'academy',
      prereq: ['iron_weapons'],
      desc: 'Train core troops each round.',
      build: ['academy_footman', 'academy_archer', 'academy_mage', 'academy_cavalry'],
    },
    {
      id: 'knight_order',
      name: 'Knight Order',
      cost: 52,
      wave: 25,
      category: 'academy',
      prereq: ['academy_charter'],
      desc: 'Elite knight training halls.',
      build: ['academy_knight'],
    },
    {
      id: 'support_corps',
      name: 'Support Corps',
      cost: 48,
      wave: 22,
      category: 'academy',
      prereq: ['academy_charter'],
      desc: 'Healer, builder, and courier academies.',
      build: ['academy_healer', 'academy_builder', 'academy_courier'],
    },
    {
      id: 'expansion_training',
      name: 'Expansion Training',
      cost: 55,
      wave: 28,
      category: 'academy',
      prereq: ['advanced_infantry', 'morale_arts', 'siege_engineering'],
      desc: 'Scout, bard, and pikeman academies.',
      build: ['academy_scout', 'academy_bard', 'academy_pikeman'],
    },
    {
      id: 'officer_training',
      name: 'Officer Training',
      cost: 72,
      wave: 35,
      category: 'academy',
      prereq: ['command_theory', 'knight_order'],
      desc: 'Promote generals from immortal footmen.',
      build: ['academy_general'],
    },
    {
      id: 'settlement_charter',
      name: 'Settlement Charter',
      cost: 85,
      wave: 40,
      category: 'economy',
      prereq: ['prospecting'],
      desc: 'Raise hamlets — first step toward a realm.',
      build: ['hamlet'],
    },
    {
      id: 'merchant_charter',
      name: 'Merchant Charter',
      cost: 70,
      wave: 45,
      category: 'economy',
      prereq: ['settlement_charter'],
      desc: 'Trade guilds within settlement aura.',
      build: ['merchant_guild'],
    },
    {
      id: 'fortress_engineering',
      name: 'Fortress Engineering',
      cost: 60,
      wave: 48,
      category: 'defense',
      prereq: ['settlement_charter', 'fortification'],
      desc: 'Palisade rings and fortified settlements.',
      build: ['fortress_upgrade'],
    },
    {
      id: 'village_rights',
      name: 'Village Rights',
      cost: 95,
      wave: 55,
      category: 'economy',
      prereq: ['settlement_charter', 'merchant_charter'],
      desc: 'Expand hamlets into villages.',
      build: ['village'],
    },
    {
      id: 'town_charter',
      name: 'Town Charter',
      cost: 110,
      wave: 70,
      category: 'economy',
      prereq: ['village_rights'],
      desc: 'Grant town status — greater TP yield.',
      build: ['town'],
    },
    {
      id: 'urban_planning',
      name: 'Urban Planning',
      cost: 125,
      wave: 85,
      category: 'economy',
      prereq: ['town_charter'],
      desc: 'Cities anchor regional economy.',
      build: ['city'],
    },
    {
      id: 'imperial_metropolis',
      name: 'Imperial Metropolis',
      cost: 145,
      wave: 100,
      category: 'economy',
      prereq: ['urban_planning'],
      desc: 'Crown-jewel settlements — maximum TP.',
      build: ['metropolis'],
    },
    {
      id: 'perk_science',
      name: 'Tonic Stations Science',
      cost: 95,
      wave: 55,
      category: 'secret',
      prereq: ['village_rights'],
      desc: 'Night-collectible combat enhancers.',
      build: [
        'perk_jugger_nog',
        'perk_quick_revive',
        'perk_speed_cola',
        'perk_stamin_up',
        'perk_deadshot_daiquiri',
        'perk_elemental_pop',
        'perk_phd_flopper',
        'perk_melee_macchiato',
        'perk_vulture_aid',
        'perk_tombstone',
        'perk_double_tap',
        'perk_mule_kick',
        'perk_sleight',
      ],
    },
  ];

  const ALL_NODES = [...CORE_TREE, ...COMPANY_RESEARCH];
  const BY_ID = Object.fromEntries(ALL_NODES.map((n) => [n.id, n]));

  /** Company charters carry a tier, not a wave: one tier arrives every ten waves. */
  const charterWave = (node) => (node.tier ? node.tier * 10 : node.wave || 0);

  const DOCTRINE_STEP = 10;
  /** A standing Research Lab brings every doctrine choice forward by this many waves. */
  const LAB_HEAD_START = 5;
  /** Science points (SP) from raids, sorties and omens: this many bring the next choice a wave sooner. */
  const STUDY_PER_WAVE = 3;

  // One pair per boss wave. Taking one side closes the other for the run.
  // `types` limits the change to those troops (absent: every soldier); hp, dmg, speed,
  // build and siege multiply a soldier's stats; tp multiplies dawn income.
  const DOCTRINES = [
    [
      {
        id: 'pike_and_shot',
        name: 'Pike and Shot',
        path: 'tech',
        desc: 'Pikemen and crossbowmen deal 15% more damage.',
        types: ['pikeman', 'crossbowman'],
        dmg: 1.15,
      },
      {
        id: 'heavy_horse',
        name: 'Heavy Horse',
        path: 'martial',
        desc: 'Cavalry and knights have 15% more health.',
        types: ['cavalry', 'knight'],
        hp: 1.15,
      },
    ],
    [
      {
        id: 'field_works',
        name: 'Field Works',
        path: 'tech',
        desc: 'Builders raise everything 50% faster.',
        types: ['builder'],
        build: 1.5,
      },
      {
        id: 'flying_column',
        name: 'Flying Column',
        path: 'martial',
        desc: 'Every soldier moves 12% faster.',
        speed: 1.12,
      },
    ],
    [
      {
        id: 'massed_bows',
        name: 'Massed Bows',
        path: 'martial',
        desc: 'Archers deal 18% more damage.',
        types: ['archer'],
        dmg: 1.18,
      },
      {
        id: 'war_magic',
        name: 'War Magic',
        path: 'arcane',
        desc: 'Mages deal 18% more damage. Mages and healers have 15% more health.',
        types: ['mage', 'healer'],
        hp: 1.15,
        dmgTypes: ['mage'],
        dmg: 1.18,
      },
    ],
    [
      {
        id: 'shield_wall',
        name: 'Shield Wall',
        path: 'martial',
        desc: 'Footmen and pikemen have 20% more health.',
        types: ['footman', 'pikeman'],
        hp: 1.2,
      },
      {
        id: 'siege_train',
        name: 'Siege Train',
        path: 'tech',
        desc: 'Sappers and ballistas deal 15% more damage, and 25% more against buildings.',
        types: ['sapper', 'ballista'],
        dmg: 1.15,
        siege: 1.25,
      },
    ],
    [
      {
        id: 'crown_levy',
        name: 'Crown Levy',
        path: 'tech',
        desc: 'Dawn income rises by 15%.',
        types: [],
        tp: 1.15,
      },
      {
        id: 'blooded_ranks',
        name: 'Blooded Ranks',
        path: 'martial',
        desc: 'Every soldier deals 6% more damage.',
        dmg: 1.06,
      },
    ],
    [
      {
        id: 'iron_discipline',
        name: 'Iron Discipline',
        path: 'martial',
        desc: 'Every soldier has 8% more health.',
        hp: 1.08,
      },
      {
        id: 'sworn_companies',
        name: 'Sworn Companies',
        path: 'mythic',
        desc: 'Company heroes and champions have 20% more health.',
        heroes: true,
        hp: 1.2,
      },
    ],
    [
      {
        id: 'forced_march',
        name: 'Forced March',
        path: 'martial',
        desc: 'Scouts, cavalry and couriers move 20% faster.',
        types: ['scout', 'cavalry', 'courier'],
        speed: 1.2,
      },
      {
        id: 'chirurgeons',
        name: 'Chirurgeons',
        path: 'arcane',
        desc: 'Healers and bards have 30% more health.',
        types: ['healer', 'bard'],
        hp: 1.3,
      },
    ],
    [
      {
        id: 'quarry_rights',
        name: 'Quarry Rights',
        path: 'tech',
        desc: 'Dawn income rises by a further 15%.',
        types: [],
        tp: 1.15,
      },
      {
        id: 'knightly_orders',
        name: 'Knightly Orders',
        path: 'martial',
        desc: 'Knights and the General deal 20% more damage.',
        types: ['knight', 'general'],
        dmg: 1.2,
      },
    ],
    [
      {
        id: 'arcane_colleges',
        name: 'Arcane Colleges',
        path: 'arcane',
        desc: 'Mages deal a further 20% more damage.',
        types: ['mage'],
        dmg: 1.2,
      },
      {
        id: 'legends_walk',
        name: 'Legends Walk',
        path: 'mythic',
        desc: 'Company heroes and champions deal 15% more damage.',
        heroes: true,
        dmg: 1.15,
      },
    ],
    [
      {
        id: 'last_muster',
        name: 'Last Muster',
        path: 'martial',
        desc: 'Every soldier has 10% more health and deals 5% more damage.',
        hp: 1.1,
        dmg: 1.05,
      },
      {
        id: 'engines_of_war',
        name: 'Engines of War',
        path: 'tech',
        desc: 'Ballistas deal 30% more damage. Builders raise everything 30% faster.',
        types: ['ballista', 'builder'],
        dmgTypes: ['ballista'],
        dmg: 1.3,
        build: 1.3,
      },
    ],
  ];
  const DOCTRINE_BY_ID = {};
  DOCTRINES.forEach((pair, tier) =>
    pair.forEach((opt) => {
      opt.tier = tier;
      DOCTRINE_BY_ID[opt.id] = opt;
    })
  );

  let completed = new Set();
  /** Doctrine ids taken this run, one per tier, in order. */
  let picks = [];
  /** SP gathered toward the next doctrine; spent when one is taken. */
  let study = 0;
  let clearedWave = 0;
  let labsStanding = 0;
  let lastTickKey = -1;
  let panelOpen = false;
  let lastRenderSig = '';
  let treeDelegated = false;

  const deployUnlocks = new Map();
  const buildUnlocks = new Map();
  const factionUnlocks = new Set();
  const modDeployUnlocks = new Set();
  const modBuildUnlocks = new Set();
  let doomResearchUnlocked = false;
  let tpVeteranUpgradeUnlocked = false;

  function rebuildUnlockMaps() {
    deployUnlocks.clear();
    buildUnlocks.clear();
    factionUnlocks.clear();
    doomResearchUnlocked = false;
    tpVeteranUpgradeUnlocked = false;
    for (const id of completed) {
      applyNodeUnlocks(BY_ID[id]);
    }
  }

  function applyNodeUnlocks(node) {
    // A retired charter keeps its id so old saves load, and opens nothing.
    if (!node || node.retired) return;
    const id = node.id;
    (node.deploy || []).forEach((t) => deployUnlocks.set(t, id));
    (node.build || []).forEach((t) => buildUnlocks.set(t, id));
    if (node.faction) factionUnlocks.add(node.faction);
    if (node.id === 'doom_protocol') doomResearchUnlocked = true;
    if (node.id === 'veteran_doctrine' || node.feature === 'tp_veteran_upgrade')
      tpVeteranUpgradeUnlocked = true;
    if (node.id === 'xf_wwe') factionUnlocks.add('champions');
  }

  function resetRun() {
    completed = new Set();
    picks = [];
    study = 0;
    clearedWave = 0;
    labsStanding = 0;
    lastTickKey = -1;
    lastRenderSig = '';
    rebuildUnlockMaps();
  }

  function refreshGame() {
    lastRenderSig = '';
    if (typeof UI !== 'undefined') UI.updateHUD?.(true);
    // Bust the game state cache so deploy and build locks update at once.
    if (typeof Game !== 'undefined' && Game.syncInteractionState) Game.syncInteractionState();
  }

  /** Grant every charter whose wave has come. @returns {object[]} the charters just granted */
  function grantChartersThrough(wave, nodes = ALL_NODES) {
    const fresh = [];
    for (const node of nodes) {
      if (node.retired || charterWave(node) > wave || completed.has(node.id)) continue;
      completed.add(node.id);
      applyNodeUnlocks(node);
      fresh.push(node);
      if (typeof FoundationalMedievalLayer !== 'undefined') {
        FoundationalMedievalLayer.recordResearch?.(node.id, wave);
      }
    }
    return fresh;
  }

  /** Auto-complete core charters through a wave (Academy Era bootstrap). */
  function grantBootstrapUnlocks(wave) {
    grantChartersThrough(wave, CORE_TREE);
  }

  function isLabBuilding(b) {
    if (!b || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    if (b.isResearchLab) return true;
    if (b.type === 'research_lab') return true;
    return !!(typeof BuildDefs !== 'undefined' && BuildDefs[b.type]?.isResearchLab);
  }

  function countLabs(buildings) {
    let n = 0;
    for (const b of buildings || []) {
      if (isLabBuilding(b)) n++;
    }
    return n;
  }

  function escAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ---- doctrines ----------------------------------------------------------------------
  function doctrinesDue() {
    return Math.min(
      DOCTRINES.length,
      Math.floor((clearedWave + headStart(picks.length)) / DOCTRINE_STEP)
    );
  }

  /** Waves by which tier `tier` comes early: the lab, and study for the next choice only. */
  function headStart(tier) {
    const lab = labsStanding > 0 ? LAB_HEAD_START : 0;
    return lab + (tier === picks.length ? Math.floor(study / STUDY_PER_WAVE) : 0);
  }

  /** The pair waiting for a choice, or null. */
  function pendingDoctrine() {
    return picks.length < doctrinesDue() ? DOCTRINES[picks.length] : null;
  }

  /** The wave after which tier `tier` (0-based) is offered. */
  function doctrineWave(tier) {
    return Math.max(0, (tier + 1) * DOCTRINE_STEP - headStart(tier));
  }

  function isHero(u) {
    return (
      (typeof isCompanyHeroUnit === 'function' && isCompanyHeroUnit(u.type)) ||
      (typeof isChampionUnit === 'function' && isChampionUnit(u.type)) ||
      u.type === 'doomslayer_hero'
    );
  }

  function applyOption(u, opt) {
    if (opt.heroes ? !isHero(u) : opt.types && !opt.types.includes(u.type)) return;
    if (opt.hp) {
      u.maxHp = Math.floor(u.maxHp * opt.hp);
      u.hp = Math.min(u.maxHp, Math.ceil(u.hp * opt.hp));
      // Veterancy recomputes from the base figure, so the base has to move too.
      if (u.baseMaxHp != null) u.baseMaxHp = Math.floor(u.baseMaxHp * opt.hp);
    }
    if (opt.dmg && u.damage && (!opt.dmgTypes || opt.dmgTypes.includes(u.type))) {
      u.damage = Math.floor(u.damage * opt.dmg);
      if (u.baseDamage != null) u.baseDamage = Math.floor(u.baseDamage * opt.dmg);
    }
    if (opt.speed && u.speed) u.speed = Math.round(u.speed * opt.speed * 100) / 100;
    if (opt.build && u.type === 'builder') u.buildSpeedMult = (u.buildSpeedMult || 1) * opt.build;
    if (opt.siege) u.siegeMult = (u.siegeMult || 1) * opt.siege;
  }

  /** A new recruit takes every doctrine held. Soldiers already serving got theirs at the pick. */
  function applyDoctrines(u) {
    for (const id of picks) applyOption(u, DOCTRINE_BY_ID[id]);
  }

  function getDoctrineEffects() {
    let tpIncomeMult = 1;
    for (const id of picks) tpIncomeMult *= DOCTRINE_BY_ID[id].tp || 1;
    return { tpIncomeMult };
  }

  /** The path most doctrines belong to; the earliest pick wins a tie. */
  function getDoctrinePath() {
    const n = {};
    let best = null;
    for (const id of picks) {
      const p = DOCTRINE_BY_ID[id].path;
      n[p] = (n[p] || 0) + 1;
      if (!best || n[p] > n[best]) best = p;
    }
    return best;
  }

  /**
   * Take one side of the waiting pair.
   * @param {object[]} [units] living units; the player's soldiers among them change at once
   */
  function pickDoctrine(id, units, showMessage) {
    const pair = pendingDoctrine();
    const opt = pair && pair.find((o) => o.id === id);
    if (!opt) return false;
    picks.push(opt.id);
    study = 0;
    for (const u of units || []) {
      if (u && u.team === 'player' && u.hp > 0) applyOption(u, opt);
    }
    if (typeof showMessage === 'function') {
      showMessage(`Doctrine adopted: ${opt.name}. ${opt.desc}`, 280);
      AudioEngine?.SFX?.deploy?.();
    }
    refreshGame();
    return true;
  }

  /** Raids, sorties and omens pay SP. It is study: it brings the next doctrine sooner. */
  function grantSciencePoints(amount) {
    const n = Math.max(0, Number(amount) || 0);
    if (!n) return 0;
    study += n;
    refreshGame();
    return n;
  }

  /** Kept under its old name: the panel and Game.startResearch call it with a doctrine id. */
  function startResearch(id, _wave, buildings, showMessage, units) {
    if (buildings) labsStanding = countLabs(buildings);
    return pickDoctrine(id, units, showMessage);
  }

  /**
   * Called every update. Work happens only when the wave or the phase changes: charters
   * whose wave has come are granted and a doctrine that has fallen due is announced.
   */
  function tick(ctx = {}) {
    if (ctx.wave == null) return;
    const key = ctx.wave * 2 + (ctx.isNight ? 1 : 0);
    if (key === lastTickKey) return;
    // The first pass after a start or a load catches up without announcing anything.
    const quiet = lastTickKey < 0;
    lastTickKey = key;
    const wasPending = !!pendingDoctrine();
    clearedWave = ctx.isNight ? ctx.wave : ctx.wave - 1;
    labsStanding = countLabs(ctx.buildings);
    const fresh = grantChartersThrough(ctx.wave);
    const say = quiet ? null : ctx.showMessage;
    if (fresh.length && say) {
      // Charters that only ever opened troops grant nothing now and are not announced.
      const named = fresh.filter(formatUnlocksLine).map((n) => n.name);
      if (named.length) say(`Charter granted: ${named.join(', ')}.`, 260);
    }
    if (!wasPending && pendingDoctrine() && say) {
      say('A doctrine is ready. Open DOCTRINES and choose one of the two.', 320);
    }
    if (fresh.length || wasPending !== !!pendingDoctrine()) refreshGame();
  }

  function completeResearch(id, showMessage) {
    if (completed.has(id)) return false;
    const node = BY_ID[id];
    if (!node) return false;
    completed.add(id);
    applyNodeUnlocks(node);
    if (typeof showMessage === 'function') {
      showMessage(`Charter granted: ${node.name}.`, 280);
      AudioEngine?.SFX?.deploy?.();
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const w = typeof Game !== 'undefined' ? Game.getState?.()?.wave || 0 : 0;
      FoundationalMedievalLayer.recordResearch(id, w);
    }
    refreshGame();
    if (panelOpen && typeof Game !== 'undefined') {
      renderPanel(Game.getState?.()?.wave ?? 0, Game.getBuildingsSnapshot?.() || []);
    }
    return true;
  }

  function registerModUnlocks(modId, deploy = [], build = []) {
    for (const t of deploy) modDeployUnlocks.add(t);
    for (const t of build) modBuildUnlocks.add(t);
  }

  function clearModUnlocks() {
    modDeployUnlocks.clear();
    modBuildUnlocks.clear();
  }

  function isDeployUnlocked(type, opts = {}) {
    if (opts.creativeUnlockAll) return true;
    if (STARTER_DEPLOY.has(type)) return true;
    if (modDeployUnlocks.has(type)) return true;
    if (type === 'doomslayer_hero') {
      return doomResearchUnlocked || !!opts.doomMetaUnlocked;
    }
    return deployUnlocks.has(type);
  }

  function isBuildUnlocked(type, opts = {}) {
    if (opts.creativeUnlockAll) return true;
    if (STARTER_BUILD.has(type)) return true;
    if (modBuildUnlocks.has(type)) return true;
    if (BuildDefs[type]?.isCrossoverBarracks) {
      const f = BuildDefs[type].crossoverFaction;
      return isFactionUnlocked(f, opts);
    }
    if (BuildDefs[type]?.isWweAcademy) {
      return isFactionUnlocked('champions', opts);
    }
    if (BuildDefs[type]?.isPerkMachine) {
      return completed.has('perk_science') || !!opts.perksMetaUnlocked;
    }
    return buildUnlocks.has(type);
  }

  function isFactionUnlocked(factionId, opts = {}) {
    if (!factionId) return false;
    if (opts.creativeUnlockAll) return true;
    if (factionUnlocks.has(factionId)) return true;
    if (factionId === 'champions' && completed.has('xf_wwe')) return true;
    if (typeof MetaProgress !== 'undefined') {
      if (factionId === 'champions') return MetaProgress.isChampionsUnlocked();
      return MetaProgress.isCompanyUnlocked?.(factionId);
    }
    return false;
  }

  function isDoomResearchUnlocked(opts = {}) {
    return doomResearchUnlocked || !!opts.doomMetaUnlocked;
  }

  function isTpVeteranUpgradeUnlocked(opts = {}) {
    if (opts.creativeUnlockAll) return true;
    return tpVeteranUpgradeUnlocked;
  }

  /** Non-null while a doctrine waits for a choice; the HUD button and the teacher read it. */
  function getActiveInfo() {
    const pair = pendingDoctrine();
    if (!pair) return null;
    return { id: pair[0].id, name: 'Doctrine ready', progress: 0, cost: 0, pct: 100, ready: true };
  }

  /** Why a troop ("deploy") or building ("build") is still closed, for a greyed button. */
  function getLockReason(field, id) {
    const node = ALL_NODES.find(
      (n) => !n.retired && Array.isArray(n[field]) && n[field].includes(id)
    );
    return node ? `arrives at wave ${charterWave(node)} (${node.name})` : '';
  }

  const CAT_LABELS = {
    military: 'Military',
    defense: 'Defenses',
    support: 'Support',
    economy: 'Economy',
    academy: 'Academies',
    crossover: 'Companies',
    secret: 'Secret',
    other: 'Other',
  };

  function nodeCategory(node) {
    return node.category || (node.faction ? 'crossover' : 'other');
  }

  function unitName(t) {
    return (typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(t)?.name : null) || t;
  }

  function buildName(t) {
    return (typeof BuildDefs !== 'undefined' ? BuildDefs[t]?.name : null) || t;
  }

  function formatUnlocksLine(node) {
    if (node.retired) return '';
    const bits = [];
    // A building that has since become a starter is no longer this charter's to open.
    const builds = (node.build || []).filter((t) => !STARTER_BUILD.has(t));
    if (builds.length) bits.push(builds.map(buildName).join(', '));
    if (node.faction) bits.push('company barracks');
    if (node.feature === 'tp_veteran_upgrade') bits.push('TP veteran promotions');
    if (node.id === 'doom_protocol') bits.push('Hellbane');
    return bits.join(' · ');
  }

  function sortNodes(a, b) {
    return charterWave(a) - charterWave(b) || String(a.name).localeCompare(String(b.name));
  }

  function getNodesForUI(wave) {
    return ALL_NODES.map((node) => {
      const done = completed.has(node.id);
      return {
        ...node,
        wave: charterWave(node),
        done,
        active: false,
        locked: !done,
        canStart: false,
        progress: 0,
        category: nodeCategory(node),
        unlocksLine: formatUnlocksLine(node),
        prereqLine: done ? 'Granted' : `Arrives at wave ${charterWave(node)}`,
        lockReason: done || charterWave(node) <= wave ? '' : `Arrives at wave ${charterWave(node)}`,
      };
    });
  }

  /** The ten pairs with their state: taken, passed over, waiting for a choice, or still ahead. */
  function getDoctrinesForUI() {
    const pending = pendingDoctrine();
    return DOCTRINES.map((pair, tier) => ({
      tier,
      wave: doctrineWave(tier),
      pending: pair === pending,
      options: pair.map((opt) => ({
        ...opt,
        taken: picks[tier] === opt.id,
        passed: tier < picks.length && picks[tier] !== opt.id,
      })),
    }));
  }

  function getEncyclopediaEntries() {
    const entries = [
      {
        cat: 'research',
        name: 'Doctrines',
        body: `After every tenth wave you choose one of two doctrines. The one you take lasts for the rest of the siege and the other is closed. Soldiers already on the field change at once, and every later recruit arrives with it. A standing Research Lab brings each choice forward by ${LAB_HEAD_START} waves, so the first comes after wave ${DOCTRINE_STEP - LAB_HEAD_START}. Raids, sorties and omens pay science points (SP): every ${STUDY_PER_WAVE} bring the next choice one wave sooner, and they are spent when you choose. Open DOCTRINES to choose; a choice not yet made waits for you.`,
      },
      {
        cat: 'research',
        name: 'Charters',
        body: `Every troop can be recruited from the first wave; the price is the only gate. Buildings beyond the starters come by charter, and a charter is granted when its wave arrives. There is nothing to research and nothing to pay.\n\nBuild from the start: ${[
          ...STARTER_BUILD,
        ]
          .filter((t) => !t.startsWith('enemy_'))
          .map(buildName)
          .join(', ')}.`,
      },
    ];

    DOCTRINES.forEach((pair, tier) => {
      entries.push({
        cat: 'research',
        name: `${pair[0].name} or ${pair[1].name}`,
        body: `Doctrine choice after wave ${(tier + 1) * DOCTRINE_STEP}. ${pair
          .map((o) => `${o.name}: ${o.desc}`)
          .join(' ')}`,
        campaignWave: (tier + 1) * DOCTRINE_STEP,
      });
    });

    for (const node of [...ALL_NODES].sort(sortNodes)) {
      const unlocks = formatUnlocksLine(node);
      if (!unlocks) continue;
      entries.push({
        cat: 'research',
        name: node.name,
        body: [
          node.desc || '',
          `${CAT_LABELS[nodeCategory(node)] || 'Other'} charter, granted at wave ${charterWave(node)}.`,
          unlocks ? `Opens: ${unlocks}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
        campaignWave: charterWave(node) || undefined,
      });
    }

    return entries;
  }

  function ensureTreeDelegation() {
    if (treeDelegated) return;
    const tree = document.getElementById('research-tree');
    if (!tree) return;
    treeDelegated = true;
    tree.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-research]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof Game !== 'undefined' && Game.startResearch)
        Game.startResearch(btn.dataset.research);
    });
  }

  function doctrineRowHtml(row) {
    const state = row.pending
      ? 'Choose one'
      : row.options.some((o) => o.taken)
        ? 'Chosen'
        : `After wave ${row.wave}`;
    const cards = row.options
      .map((o) => {
        const cls = ['research-node', 'doctrine-card'];
        if (o.taken) cls.push('done');
        else if (row.pending) cls.push('can-start');
        else cls.push('locked');
        const why = o.taken
          ? 'Adopted'
          : o.passed
            ? 'Passed over'
            : row.pending
              ? 'Click to adopt'
              : `Offered after wave ${row.wave}`;
        return `
            <button type="button" class="${cls.join(' ')}" data-research="${escAttr(o.id)}"
              title="${escAttr(why)}" ${row.pending ? '' : 'disabled'}>
              <span class="research-node-name">${escHtml(o.name)}</span>
              <span class="research-node-cost">${o.taken ? '✓' : ''}</span>
              <span class="research-node-desc">${escHtml(o.desc)}</span>
              <span class="research-node-prereq ${o.passed ? 'blocked' : ''}">${escHtml(why)}</span>
            </button>`;
      })
      .join('');
    return `
        <div class="research-cat doctrine-row${row.pending ? ' pending' : ''}">
          <div class="research-cat-title">Doctrine ${row.tier + 1} · ${escHtml(state)}</div>
          ${cards}
        </div>`;
  }

  function charterHtml(n) {
    const cls = ['research-node', 'charter', n.done ? 'done' : 'locked'].join(' ');
    return `
            <div class="${cls}" title="${escAttr(n.prereqLine)}">
              <span class="research-node-name">${escHtml(n.name)}</span>
              <span class="research-node-cost">${n.done ? '✓' : `Wave ${n.wave}`}</span>
              <span class="research-node-desc">${escHtml(n.desc || '')}</span>
              <span class="research-node-unlocks">${escHtml(n.unlocksLine || '')}</span>
            </div>`;
  }

  function renderPanel(wave, buildings, opts = {}) {
    const tree = document.getElementById('research-tree');
    const headEl = document.getElementById('research-sp-text');
    const hintEl = document.getElementById('research-active-text');
    if (!tree) return;
    ensureTreeDelegation();
    if (buildings) labsStanding = countLabs(buildings);

    const pending = pendingDoctrine();
    const sig = [wave, labsStanding, picks.length, completed.size, pending ? 1 : 0, study].join(
      '|'
    );
    if (!opts.force && sig === lastRenderSig && tree.childElementCount > 0) return;
    lastRenderSig = sig;

    if (headEl) {
      headEl.textContent = `Doctrines adopted: ${picks.length} of ${DOCTRINES.length} · Study ${study} SP`;
    }
    if (hintEl) {
      hintEl.textContent = pending
        ? 'A doctrine is ready. Choose one of the two; the other is closed for this siege.'
        : picks.length >= DOCTRINES.length
          ? 'Every doctrine is chosen.'
          : `The next choice comes after wave ${doctrineWave(picks.length)}.${
              labsStanding > 0
                ? ''
                : ` A Research Lab would bring it ${LAB_HEAD_START} waves sooner.`
            } Every ${STUDY_PER_WAVE} SP from raids, sorties and omens brings it one wave sooner.`;
    }

    const scrollTop = tree.scrollTop;
    const nodes = getNodesForUI(wave);
    const cats = ['military', 'defense', 'support', 'economy', 'academy', 'crossover', 'secret'];
    tree.innerHTML =
      getDoctrinesForUI().map(doctrineRowHtml).join('') +
      cats
        .map((cat) => {
          const items = nodes.filter((n) => n.category === cat && n.unlocksLine).sort(sortNodes);
          if (!items.length) return '';
          return `
        <div class="research-cat">
          <div class="research-cat-title">${escHtml(CAT_LABELS[cat] || cat)} charters</div>
          ${items.map(charterHtml).join('')}
        </div>`;
        })
        .join('');
    tree.scrollTop = scrollTop;

    if (typeof TechTreeBranches !== 'undefined') {
      TechTreeBranches.renderBranchPanel(wave, buildings);
    }
  }

  function openPanel() {
    panelOpen = true;
    lastRenderSig = '';
    const panel = document.getElementById('research-panel');
    if (panel) {
      panel.classList.add('open');
      panel.setAttribute?.('aria-hidden', 'false');
    }
    if (typeof Game !== 'undefined') {
      // Prefer live buildings (with flags); fall back to snapshot.
      const blds =
        typeof Game.getBuildingsForResearch === 'function'
          ? Game.getBuildingsForResearch()
          : Game.getBuildingsSnapshot?.() || [];
      renderPanel(Game.getState?.()?.wave ?? 0, blds, { force: true });
    }
    AudioEngine?.SFX?.click?.();
  }

  function closePanel() {
    panelOpen = false;
    const panel = document.getElementById('research-panel');
    if (panel) {
      panel.classList.remove('open');
      panel.setAttribute?.('aria-hidden', 'true');
    }
  }

  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  function isPanelOpen() {
    return panelOpen;
  }

  function bindUI() {
    document.getElementById('research-open')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
    document.getElementById('research-close')?.addEventListener('click', (e) => {
      e.preventDefault();
      closePanel();
    });
    // Click backdrop to close
    document.getElementById('research-panel')?.addEventListener('click', (e) => {
      if (e.target?.id === 'research-panel') closePanel();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panelOpen) {
        e.preventDefault();
        closePanel();
      }
    });
  }

  function getSnapshot() {
    return { completed: [...completed], doctrines: [...picks], study };
  }

  // Saves from before doctrines carry science points and an active project; both are
  // dropped. Their completed list is kept, and doctrines owed for waves already cleared
  // are offered one a night from the first tick.
  function restoreSnapshot(snap) {
    if (!snap) return;
    completed = new Set((snap.completed || []).filter((id) => BY_ID[id]));
    picks = [];
    for (const id of snap.doctrines || []) {
      if (DOCTRINE_BY_ID[id]?.tier === picks.length) picks.push(id);
    }
    study = Math.max(0, Number(snap.study) || 0);
    lastTickKey = -1;
    lastRenderSig = '';
    rebuildUnlockMaps();
  }

  function init() {
    bindUI();
    resetRun();
  }

  return {
    init,
    resetRun,
    grantBootstrapUnlocks,
    tick,
    startResearch,
    pickDoctrine,
    grantSciencePoints,
    applyDoctrines,
    getDoctrineEffects,
    getDoctrinePath,
    getDoctrinesForUI,
    completeResearch,
    isDeployUnlocked,
    isBuildUnlocked,
    isResearched: (id) => completed.has(id),
    registerModUnlocks,
    clearModUnlocks,
    isFactionUnlocked,
    isDoomResearchUnlocked,
    isTpVeteranUpgradeUnlocked,
    countLabs,
    getActiveInfo,
    getLockReason,
    getNodesForUI,
    renderPanel,
    openPanel,
    closePanel,
    togglePanel,
    isPanelOpen,
    getSnapshot,
    restoreSnapshot,
    getEncyclopediaEntries,
    ALL_NODES,
    COMPANY_RESEARCH,
    DOCTRINES,
    STARTER_DEPLOY,
    STARTER_BUILD,
    // Science points are gone; these stay so older callers read zero instead of failing.
    cancelResearch: () => false,
    onWaveStart: () => {},
    onEnemySlain: () => 0,
    onWaveCleared: () => 0,
    getKillScienceStatus: () => ({ earned: 0, cap: 0, labs: labsStanding }),
    get sciencePoints() {
      return study;
    },
    reserveScience: 0,
    get completedCount() {
      return completed.size;
    },
    get doctrineCount() {
      return picks.length;
    },
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Research = Research;
