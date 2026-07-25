/**
 * Technological progression — Research Lab accumulates Science Points (SP)
 * to unlock units, buildings, and evolved factions (cost scaled by roster power).
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
  ]);
  const STARTER_BUILD = new Set([
    'outpost',
    'wall',
    'medical_tent',
    'mess_hall',
    'research_lab',
    'enemy_hamlet',
    'enemy_merchant_guild',
    'enemy_trade_outpost',
    'enemy_quarry',
  ]);

  /** Faction crossover research — cost reflects tech tier + combat power. */
  const CROSSOVER_FACTION_RESEARCH = [
    {
      id: 'xf_gears',
      faction: 'gears',
      name: 'Iron Trench Battle Doctrine',
      cost: 85,
      wave: 1,
      tier: 1,
      desc: 'Modern infantry tactics — unlock Trench Academy construction.',
    },
    {
      id: 'xf_lotr',
      faction: 'lotr',
      name: 'March Protocols',
      cost: 85,
      wave: 1,
      tier: 1,
      desc: 'Ninefold March war council — unlock Ninefold March Camp.',
    },
    {
      id: 'xf_ultimis',
      faction: 'ultimis',
      name: 'Void Residue Studies',
      cost: 85,
      wave: 1,
      tier: 2,
      desc: 'forbidden residue science — unlock Void Residue Barracks.',
    },
    {
      id: 'xf_halo',
      faction: 'halo',
      name: 'Vanguard Augmentation',
      cost: 100,
      wave: 1,
      tier: 2,
      desc: 'Orbital powered armor — unlock Vanguard Academy.',
    },
    {
      id: 'xf_primis',
      faction: 'primis',
      name: 'First Circle Temporal Theory',
      cost: 100,
      wave: 1,
      tier: 3,
      desc: 'void-era upgrades — unlock First Circle Shrine.',
    },
    {
      id: 'xf_baki',
      faction: 'baki',
      name: 'Iron Pit Combat Genome',
      cost: 120,
      wave: 1,
      tier: 3,
      desc: 'Peak human martial arts — unlock Iron Pit Guild.',
    },
    {
      id: 'xf_fotns',
      faction: 'fotns',
      name: 'North Star Fist Archives',
      cost: 120,
      wave: 1,
      tier: 4,
      desc: 'North Star assassination art — unlock North Star Ascetic Dojo.',
    },
    {
      id: 'xf_dragonball',
      faction: 'dragonball',
      name: 'Ki Manipulation Theory',
      cost: 140,
      wave: 1,
      tier: 4,
      desc: 'skyburst fighter energy systems — unlock Skyburst Foundry.',
    },
    {
      id: 'xf_jojo',
      faction: 'jojo',
      name: 'Spirit Arrow Metallurgy',
      cost: 140,
      wave: 1,
      tier: 5,
      desc: 'Bound spirit weapons — unlock Bound Spirit Shrine.',
    },
    {
      id: 'xf_imperium',
      faction: 'imperium',
      name: 'Legion Gene-Seed Theory',
      cost: 140,
      wave: 1,
      tier: 5,
      desc: 'Transhuman legion doctrine — unlock Crimson Chapel.',
    },
    {
      id: 'xf_crystal',
      faction: 'crystal',
      name: 'Crystal Aether Studies',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'Limit-break aether theory — unlock Crystal Sanctum.',
    },
    {
      id: 'xf_warp',
      faction: 'warp',
      name: 'Warp Rift Containment',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'Forbidden chaos cults — unlock Rift Cult Shrine.',
    },
    {
      id: 'xf_wwe',
      faction: 'wwe',
      name: 'Arena Warfare Doctrine',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'The grand arena goes to war — unlock Grand Coliseum.',
    },
    {
      id: 'xf_tes',
      faction: 'tes',
      name: 'Voice & Wyrm Prophecy',
      cost: 160,
      wave: 1,
      tier: 5,
      desc: 'Voices of the wyrm — unlock Wyrmcaller Moot Hall.',
    },
    {
      id: 'doom_protocol',
      faction: null,
      name: 'Hellgate Containment',
      cost: 220,
      wave: 1,
      tier: 6,
      prereq: ['xf_jojo', 'xf_dragonball'],
      desc: 'Rip-and-tear containment theory — unlock Doomslayer deployment.',
    },
  ];

  const CORE_TREE = [
    {
      id: 'iron_weapons',
      name: 'Iron Weapons',
      cost: 35,
      wave: 3,
      category: 'military',
      desc: 'Sappers and knights. Unlocks Siege Engineering (ballista) and Advanced Infantry (scout/pikeman).',
      deploy: ['sapper', 'knight'],
    },
    {
      id: 'veteran_doctrine',
      name: 'Veteran Doctrine',
      cost: 45,
      wave: 12,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Spend TP to promote core troops — keeps vanilla ranks relevant as waves escalate.',
      feature: 'tp_veteran_upgrade',
    },
    {
      id: 'fortification',
      name: 'Fortification',
      cost: 40,
      wave: 6,
      category: 'defense',
      desc: 'Castle compounds — walls, keep, and command center.',
      build: ['castle', 'castle_keep'],
    },
    {
      id: 'field_engineering',
      name: 'Field Engineering',
      cost: 30,
      wave: 4,
      category: 'defense',
      desc: 'Scouts and traps for the battlefield.',
      build: ['watchtower', 'spike_trap'],
    },
    {
      id: 'morale_arts',
      name: 'Morale Arts',
      cost: 32,
      wave: 5,
      category: 'support',
      desc: 'Bards inspire the ranks.',
      deploy: ['bard'],
    },
    {
      id: 'command_theory',
      name: 'Command Theory',
      cost: 50,
      wave: 8,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Officers who command the whole army.',
      deploy: ['general'],
    },
    {
      id: 'advanced_infantry',
      name: 'Advanced Infantry',
      cost: 42,
      wave: 10,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Scouts and pikemen formations.',
      deploy: ['scout', 'pikeman'],
    },
    {
      id: 'siege_engineering',
      name: 'Siege Engineering',
      cost: 55,
      wave: 12,
      category: 'military',
      prereq: ['iron_weapons'],
      desc: 'Deploy ballistas (6 TP) and found Sapper/Ballista Academies.',
      deploy: ['ballista'],
      build: ['academy_sapper', 'academy_ballista'],
    },
    {
      id: 'prospecting',
      name: 'Prospecting',
      cost: 48,
      wave: 15,
      category: 'economy',
      prereq: ['field_engineering'],
      desc: 'Quarries and trade posts.',
      build: ['quarry', 'trade_outpost'],
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
      desc: 'Scout, bard, and pikeman academies (ballista academy via Siege Engineering).',
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

  const ALL_NODES = [...CORE_TREE, ...CROSSOVER_FACTION_RESEARCH];
  const BY_ID = Object.fromEntries(ALL_NODES.map((n) => [n.id, n]));

  let sciencePoints = 0;
  /** SP earned while no project was active — auto-applied when a project starts. */
  let reserveScience = 0;
  let killScienceThisWave = 0;
  let completed = new Set();
  let activeId = null;
  let activeProgress = 0;
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
    if (!node) return;
    const id = node.id;
    (node.deploy || []).forEach((t) => deployUnlocks.set(t, id));
    (node.build || []).forEach((t) => buildUnlocks.set(t, id));
    if (node.faction) factionUnlocks.add(node.faction);
    if (node.id === 'doom_protocol') doomResearchUnlocked = true;
    if (node.id === 'veteran_doctrine' || node.feature === 'tp_veteran_upgrade')
      tpVeteranUpgradeUnlocked = true;
    if (node.id === 'xf_wwe') factionUnlocks.add('wwe');
  }

  function resetRun() {
    sciencePoints = 0;
    reserveScience = 0;
    killScienceThisWave = 0;
    completed = new Set();
    activeId = null;
    activeProgress = 0;
    rebuildUnlockMaps();
  }

  /**
   * Feed progress into the active core project. Completes the node if cost is met;
   * overflow returns to reserve for the next project.
   * @returns {{ applied: number, completed: boolean, overflow: number }}
   */
  function applyProgressToActive(progress, showMessage) {
    const amount = Math.max(0, Number(progress) || 0);
    if (!activeId || amount <= 0) return { applied: 0, completed: false, overflow: 0 };
    const node = BY_ID[activeId];
    if (!node) {
      activeId = null;
      activeProgress = 0;
      return { applied: 0, completed: false, overflow: amount };
    }
    const need = Math.max(0, node.cost - activeProgress);
    const applied = Math.min(amount, need);
    const overflow = amount - applied;
    activeProgress += applied;
    if (activeProgress + 1e-9 >= node.cost) {
      const doneId = activeId;
      activeId = null;
      activeProgress = 0;
      completeResearch(doneId, showMessage);
      if (overflow > 0) reserveScience += overflow;
      return { applied, completed: true, overflow };
    }
    if (overflow > 0) reserveScience += overflow;
    return { applied, completed: false, overflow };
  }

  /** Dump reserve SP into the current project (start or mid-research catch-up). */
  function flushReserveToActive(showMessage) {
    if (!activeId || reserveScience <= 0) return { applied: 0, completed: false };
    const pool = reserveScience;
    reserveScience = 0;
    const result = applyProgressToActive(pool, showMessage);
    // If project completed with leftover, it is already back in reserveScience.
    // If project still active but applyProgressToActive returned overflow somehow, keep it.
    return result;
  }

  function onWaveStart() {
    killScienceThisWave = 0;
  }

  function getWaveKillScienceCap(wave, buildings) {
    const labs = countLabs(buildings);
    const base = 3 + Math.floor((wave || 0) / 5);
    const labBonus = labs * 2;
    return Math.min(22, base + labBonus);
  }

  /** Combat threat → SP from a single kill (fractional values accumulate). */
  function getKillScienceValue(unit) {
    if (!unit || unit.team !== 'enemy') return 0;
    const def = typeof EnemyDefs !== 'undefined' ? EnemyDefs[unit.type] : null;
    const hp = unit.maxHp || def?.hp || 40;
    const dmg = unit.damage || def?.damage || 10;
    let sp = 0.1 + Math.sqrt(hp * dmg) / 95;

    const named = typeof isNamedBoss === 'function' && isNamedBoss(unit);
    const monster = typeof isMonsterEnemy === 'function' && isMonsterEnemy(unit);
    const elite = typeof isEliteEnemy === 'function' && isEliteEnemy(unit);

    if (named || def?.isNamedBoss) sp = Math.max(sp, 3);
    else if (monster) sp = Math.max(sp, 1.5);
    else if (elite) sp = Math.max(sp, 0.75);
    else if (unit.isEvilOperative || def?.isEvilOperative) sp = Math.max(sp, 0.4);
    else if (def?.isHordeGrunt) sp = Math.max(sp, 0.18);

    if (unit.isPlanetBoss) sp *= 1.35;
    if ((unit.spriteScale || 1) >= 1.55) sp *= 1.15;
    return Math.min(5, Math.round(sp * 100) / 100);
  }

  function applyScienceGain(amount, ctx = {}) {
    const n = Math.max(0, Number(amount) || 0);
    if (n <= 0) return 0;
    const branchFx =
      typeof TechTreeBranches !== 'undefined' ? TechTreeBranches.getCombinedEffects(ctx.wave) : null;
    const gainMult = (ctx.scienceGainMult || 1) * (branchFx?.scienceGainMult || 1);
    const speedMult = (ctx.researchSpeedMult || 1) * (branchFx?.researchSpeedMult || 1);
    const granted = n * gainMult;
    sciencePoints += granted;
    // Research progress: base amount × speed mult (gain mult already folded into lifetime SP).
    // Using n*speedMult keeps gain (SP bank) and speed (project fill rate) as separate stats.
    const researchProgress = n * speedMult;
    const branchActive =
      typeof TechTreeBranches !== 'undefined' &&
      TechTreeBranches.getNodesForUI?.(ctx.wave || 0)?.activeInfo;
    if (branchActive && !activeId) {
      TechTreeBranches.applyScienceProgress(researchProgress, { ...ctx, wave: ctx.wave });
    } else if (activeId) {
      // Any leftover reserve from between projects applies first, then this gain.
      flushReserveToActive(ctx.showMessage);
      if (activeId) {
        applyProgressToActive(researchProgress, ctx.showMessage);
      } else {
        // Project finished from reserve; bank this kill's progress for the next one.
        reserveScience += researchProgress;
      }
    } else {
      // No active project — bank as reserve for the next research start.
      reserveScience += researchProgress;
    }
    // Soft HUD only — completeResearch already forces full button refresh on unlock.
    // Forcing updateHUD(true) every kill rebuilt every deploy/build button mid-combat.
    if (typeof UI !== 'undefined') UI.updateHUD?.(false);
    if (panelOpen && typeof Game !== 'undefined') {
      const blds =
        typeof Game.getBuildingsForResearch === 'function'
          ? Game.getBuildingsForResearch()
          : Game.getBuildingsSnapshot?.() || [];
      renderPanel(Game.getState?.()?.wave ?? ctx.wave ?? 0, blds);
    }
    return granted;
  }

  function onEnemySlain(unit, ctx = {}) {
    const labs = countLabs(ctx.buildings);
    if (labs <= 0) return 0;

    const cap = Math.ceil(
      getWaveKillScienceCap(ctx.wave || 0, ctx.buildings) * (ctx.scienceCapMult || 1)
    );
    const room = Math.max(0, cap - killScienceThisWave);
    if (room <= 0) return 0;

    // Cap uses base kill value; gain/speed mults applied once inside applyScienceGain.
    // (Previously scienceGainMult was applied here AND again in applyScienceGain.)
    let amount = getKillScienceValue(unit);
    amount = Math.min(amount, room);
    if (amount <= 0) return 0;

    killScienceThisWave += amount;
    const granted = applyScienceGain(amount, ctx);
    if (granted > 0 && ctx.floatingText) {
      const label = granted >= 1 ? `+${granted.toFixed(1)} SP` : `+${granted.toFixed(2)} SP`;
      ctx.floatingText(unit.x, unit.y - 14, label, '#80c0ff');
    }
    return granted;
  }

  /** Auto-complete core research through a wave (Academy Era bootstrap). */
  function grantBootstrapUnlocks(wave) {
    for (const node of CORE_TREE) {
      if ((node.wave || 0) > wave) continue;
      if (completed.has(node.id)) continue;
      completed.add(node.id);
      applyNodeUnlocks(node);
    }
  }

  function isLabBuilding(b) {
    if (!b || b.hp <= 0) return false;
    if (b.owner && b.owner !== 'player') return false;
    if (b.complete === false) return false;
    return !!(b.isResearchLab || b.type === 'research_lab');
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

  function grantSciencePoints(amount, ctx = {}) {
    return applyScienceGain(amount, ctx);
  }

  function tick() {
    /* Science is earned from combat analysis (enemy kills) and bonus loot — not passive lab ticks. */
  }

  function getKillScienceStatus(wave, buildings) {
    const cap = getWaveKillScienceCap(wave, buildings);
    return {
      earned: Math.round(killScienceThisWave * 10) / 10,
      cap,
      labs: countLabs(buildings),
    };
  }

  function completeResearch(id, showMessage) {
    if (completed.has(id)) return false;
    const node = BY_ID[id];
    if (!node) return false;
    completed.add(id);
    applyNodeUnlocks(node);
    lastRenderSig = '';
    if (typeof showMessage === 'function') {
      showMessage(`Research complete: ${node.name}!`, 280);
      AudioEngine?.SFX?.deploy?.();
    }
    if (typeof UI !== 'undefined') UI.updateHUD(true);
    if (panelOpen && typeof Game !== 'undefined') {
      renderPanel(Game.getState?.()?.wave ?? 0, Game.getBuildingsSnapshot?.() || []);
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const w = typeof Game !== 'undefined' ? Game.getState?.()?.wave || 0 : 0;
      FoundationalMedievalLayer.recordResearch(id, w);
    }
    // Bust game state cache so deploy/build unlocks update immediately.
    if (typeof Game !== 'undefined' && Game.syncInteractionState) {
      Game.syncInteractionState();
    }
    return true;
  }

  function isCompleted(id) {
    return completed.has(id);
  }

  function prereqsMet(node, wave) {
    if ((node.wave || 0) > (wave || 0)) return false;
    for (const p of node.prereq || []) {
      if (!completed.has(p)) return false;
    }
    return true;
  }

  function canStart(id, wave) {
    if (completed.has(id)) return false;
    if (activeId && activeId !== id) return false;
    const node = BY_ID[id];
    if (!node || !prereqsMet(node, wave)) return false;
    return true;
  }

  function startResearch(id, wave, buildings, showMessage) {
    if (completed.has(id)) {
      showMessage?.('Already researched.', 160);
      return false;
    }
    if (countLabs(buildings) <= 0) {
      showMessage?.('Complete a Research Lab on the field first!', 220);
      return false;
    }
    const node = BY_ID[id];
    if (!node) return false;
    if (!prereqsMet(node, wave)) {
      const reason = getLockReason(node, wave) || 'Prerequisites or wave requirement not met.';
      showMessage?.(reason, 220);
      return false;
    }
    if (activeId === id) return true;
    if (activeId && activeId !== id) {
      showMessage?.('Cancel the current project first (or finish it).', 200);
      return false;
    }
    if (
      typeof TechTreeBranches !== 'undefined' &&
      TechTreeBranches.getNodesForUI?.(wave)?.activeInfo
    ) {
      showMessage?.('Finish branch tech before starting core research.', 220);
      return false;
    }
    activeId = id;
    activeProgress = 0;
    lastRenderSig = ''; // force panel refresh
    const flush = flushReserveToActive(showMessage);
    AudioEngine?.SFX?.click?.();
    if (!activeId) {
      // Reserve finished the project immediately — completeResearch already announced.
    } else if (flush.applied > 0) {
      const pct = Math.min(100, Math.round((activeProgress / node.cost) * 100));
      showMessage?.(
        `Research started: ${node.name} — applied ${flush.applied.toFixed(1)} reserve SP (${pct}%, ${activeProgress.toFixed(1)}/${node.cost}).`,
        280
      );
    } else {
      showMessage?.(`Research started: ${node.name} (${node.cost} SP)`, 240);
    }
    if (panelOpen) {
      renderPanel(wave, buildings);
    }
    if (typeof UI !== 'undefined') UI.updateHUD(true);
    return true;
  }

  function cancelResearch(showMessage) {
    if (!activeId) return false;
    const name = BY_ID[activeId]?.name || 'Research';
    // Return partial progress to reserve so it applies to the next project.
    if (activeProgress > 0) reserveScience += activeProgress;
    activeId = null;
    activeProgress = 0;
    lastRenderSig = '';
    const reserveNote =
      reserveScience > 0 ? ` (${reserveScience.toFixed(1)} SP held in reserve)` : '';
    showMessage?.(`Cancelled: ${name}${reserveNote}`, 160);
    if (panelOpen && typeof Game !== 'undefined') {
      renderPanel(Game.getState?.()?.wave ?? 0, Game.getBuildingsSnapshot?.() || []);
    }
    if (typeof UI !== 'undefined') UI.updateHUD(true);
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
      return isFactionUnlocked('wwe', opts);
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
    if (factionId === 'wwe' && completed.has('xf_wwe')) return true;
    if (typeof MetaProgress !== 'undefined') {
      if (factionId === 'wwe') return MetaProgress.isWweUnlocked();
      return MetaProgress.isCrossoverFactionUnlocked?.(factionId);
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

  function getActiveInfo() {
    if (!activeId) return null;
    const node = BY_ID[activeId];
    if (!node) return null;
    return {
      id: activeId,
      name: node.name,
      progress: activeProgress,
      cost: node.cost,
      pct: Math.min(100, Math.round((activeProgress / node.cost) * 100)),
    };
  }

  const CAT_LABELS = {
    military: 'Military',
    defense: 'Defenses',
    support: 'Support',
    economy: 'Economy',
    academy: 'Academies',
    crossover: 'Evolved Allies',
    secret: 'Secret',
    other: 'Other',
  };

  const nameById = Object.fromEntries(ALL_NODES.map((n) => [n.id, n.name]));

  function nodeCategory(node) {
    return node.category || (node.faction ? 'crossover' : 'other');
  }

  function formatDeployUnlocks(node) {
    if (!node.deploy?.length) return '';
    const names = node.deploy.map(
      (t) => (typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(t)?.name : null) || t
    );
    return `Deploy: ${names.join(', ')}`;
  }

  function formatBuildUnlocks(node) {
    if (!node.build?.length) return '';
    const names = node.build.map(
      (t) => (typeof BuildDefs !== 'undefined' ? BuildDefs[t]?.name : null) || t
    );
    return `Build: ${names.join(', ')}`;
  }

  function formatFeatureUnlocks(node) {
    if (node.feature === 'tp_veteran_upgrade' || node.id === 'veteran_doctrine') {
      return 'Enables TP veteran promotions on core troops';
    }
    if (node.faction) {
      const label =
        node.faction === 'wwe' ? 'Grand Coliseum' : `${(node.faction || '').toUpperCase()} barracks`;
      return `Unlocks ${label} construction`;
    }
    if (node.id === 'doom_protocol') return 'Unlocks Doomslayer deployment (with meta unlock)';
    return '';
  }

  function formatUnlocksLine(node) {
    return [formatDeployUnlocks(node), formatBuildUnlocks(node), formatFeatureUnlocks(node)]
      .filter(Boolean)
      .join(' · ');
  }

  function formatPrereqLine(node, wave) {
    const parts = [];
    if (node.wave) parts.push(`Wave ${node.wave}+`);
    for (const pid of node.prereq || []) {
      const done = completed.has(pid);
      const label = nameById[pid] || pid;
      parts.push(done ? `✓ ${label}` : `○ ${label}`);
    }
    if (!parts.length) return 'No prerequisites';
    const waveBlocked = (node.wave || 0) > (wave || 0);
    if (waveBlocked && node.prereq?.length) {
      return `${parts.join(' · ')} (wave locked)`;
    }
    if (waveBlocked) return `Wave ${node.wave}+ required`;
    return parts.join(' · ');
  }

  function getLockReason(node, wave) {
    if (completed.has(node.id)) return null;
    if ((node.wave || 0) > (wave || 0)) return `Unlocks at wave ${node.wave}`;
    for (const pid of node.prereq || []) {
      if (!completed.has(pid)) return `Requires ${nameById[pid] || pid}`;
    }
    return null;
  }

  function sortNodes(a, b) {
    const waveDiff = (a.wave || 0) - (b.wave || 0);
    if (waveDiff !== 0) return waveDiff;
    return (a.name || '').localeCompare(b.name || '');
  }

  function getNodesForUI(wave) {
    return ALL_NODES.map((node) => ({
      ...node,
      done: completed.has(node.id),
      active: activeId === node.id,
      locked: !prereqsMet(node, wave) && !completed.has(node.id),
      canStart: canStart(node.id, wave) && !activeId,
      progress: activeId === node.id ? activeProgress : 0,
      category: nodeCategory(node),
      unlocksLine: formatUnlocksLine(node),
      prereqLine: formatPrereqLine(node, wave),
      lockReason: getLockReason(node, wave),
    }));
  }

  function buildCategoryPathway(cat, nodes, intro) {
    const sorted = [...nodes].sort(sortNodes);
    const chain = sorted
      .map((n) => {
        const prereq = n.prereq?.length
          ? ` ← ${n.prereq.map((id) => nameById[id] || id).join(', ')}`
          : '';
        return `W${n.wave || '?'} ${n.name} (${n.cost} SP)${prereq}`;
      })
      .join('\n');
    return { cat, intro, chain, sorted };
  }

  function getEncyclopediaEntries() {
    const entries = [
      {
        cat: 'research',
        name: 'Research Lab & Science Points',
        body: 'Build a Research Lab (starter building, no research required) to field-analyze fallen foes. Each enemy slain grants Science Points (SP) scaled to its threat — grunts ~0.2 SP, elites ~0.75 SP, monsters ~1.5 SP, named bosses ~3 SP. SP gain from kills is capped each wave (base cap rises with wave count; +2 SP cap per extra lab). Raid loot and events can grant bonus SP beyond the cap. One project at a time — progress carries if you cancel. Completed research permanently unlocks deploys, buildings, evolved barracks, veteran promotions, and perk machines for the run.',
      },
      {
        cat: 'research',
        name: 'Starter Unlocks (No Research)',
        body: `Deploy without research: ${[...STARTER_DEPLOY].map((t) => (typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(t)?.name : null) || t).join(', ')}.\n\nBuild without research: ${[
          ...STARTER_BUILD,
        ]
          .filter((t) => !t.startsWith('enemy_'))
          .map((t) => (typeof BuildDefs !== 'undefined' ? BuildDefs[t]?.name : null) || t)
          .join(', ')}.`,
      },
      {
        cat: 'research',
        name: 'Full Research Tree Overview',
        body: 'Projects gate at minimum wave thresholds and prerequisite research. Military opens sappers, knights, officers, and siege. Defense opens castles, towers, and traps. Economy runs quarry → hamlet → village → town → city → metropolis. Academies train free troops each round after Academy Charter. Evolved allies research is available from wave 1 (or instantly if the faction is meta-unlocked). SP costs scale with roster power. Secret paths: Tonic Stations Science (wave 55) and Hellgate Containment (wave 100, requires Bound Spirit + Skyburst research).',
      },
    ];

    const byCat = {};
    for (const node of ALL_NODES) {
      const cat = nodeCategory(node);
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(node);
    }

    const pathways = {
      military:
        'Iron Weapons anchors the combat branch — sappers, knights, generals, scouts, pikemen, ballistas, and Veteran Doctrine (TP promotions).',
      defense:
        'Field Engineering and Fortification open watchtowers, spike traps, castle compounds, and fortress upgrades on settlements.',
      support:
        'Morale Arts unlocks bards — required alongside infantry and siege nodes for Expansion Training academies.',
      economy:
        'Prospecting unlocks quarries and trade posts; Settlement Charter begins the hamlet ladder to Imperial Metropolis.',
      academy:
        'Academy Charter trains core troops free each round; Support Corps and Knight Order branch into specialist and officer halls.',
      crossover:
        'Meta-unlocked factions can build barracks from wave 1. Research is an alternate in-run path (wave 1+). Doomslayer still needs Hellgate Containment.',
      secret:
        'Tonic Stations Science unlocks all perk machines. Hellgate Containment is the ultimate evolved-allies capstone.',
    };

    for (const [cat, nodes] of Object.entries(byCat)) {
      const { intro, chain } = buildCategoryPathway(cat, nodes, pathways[cat]);
      entries.push({
        cat: 'research',
        name: `${CAT_LABELS[cat] || cat} — Research Path`,
        body: `${intro || ''}\n\n${chain}`.trim(),
      });
    }

    for (const node of [...ALL_NODES].sort(sortNodes)) {
      const cat = CAT_LABELS[nodeCategory(node)] || 'Other';
      const unlocks = formatUnlocksLine(node);
      const prereqNames = node.prereq?.length
        ? node.prereq.map((id) => nameById[id] || id).join(', ')
        : 'None';
      const tier = node.tier ? `Crossover tier ${node.tier}. ` : '';
      entries.push({
        cat: 'research',
        name: node.name,
        body: [
          node.desc || '',
          `Category: ${cat}. ${tier}Cost: ${node.cost} SP. Minimum wave: ${node.wave || 0}.`,
          unlocks ? `Unlocks: ${unlocks}.` : '',
          `Prerequisites: ${prereqNames}.`,
        ]
          .filter(Boolean)
          .join(' '),
        campaignWave: node.wave || undefined,
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
      if (!btn || btn.disabled || btn.classList.contains('done') || btn.classList.contains('locked'))
        return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.research;
      if (!id) return;
      if (typeof Game !== 'undefined' && Game.startResearch) {
        const ok = Game.startResearch(id);
        if (ok) {
          // startResearch already re-renders when panel is open
        }
      }
    });
  }

  function renderPanel(wave, buildings, opts = {}) {
    const tree = document.getElementById('research-tree');
    const spEl = document.getElementById('research-sp-text');
    const activeEl = document.getElementById('research-active-text');
    if (!tree) return;
    ensureTreeDelegation();

    const labs = countLabs(buildings);
    const killStatus = getKillScienceStatus(wave, buildings);
    const active = getActiveInfo();
    const branchActive =
      typeof TechTreeBranches !== 'undefined'
        ? TechTreeBranches.getNodesForUI?.(wave)?.activeInfo
        : null;

    const reserveLabel =
      reserveScience > 0.05 ? ` · Reserve ${reserveScience.toFixed(1)} SP` : '';
    // Tree rebuild only when structure changes (nodes/locks/active id). SP ticks only touch headers.
    const treeSig = [
      wave,
      labs,
      activeId || '',
      completed.size,
      branchActive?.id || '',
      opts.force ? 'f' : '',
    ].join('|');
    const updateResearchHeaders = () => {
      if (spEl) {
        spEl.textContent =
          labs > 0
            ? `Science: ${sciencePoints.toFixed(1)} SP${reserveLabel} · Wave analysis ${killStatus.earned}/${killStatus.cap}`
            : `Science: ${sciencePoints.toFixed(1)} SP${reserveLabel} · Build a Research Lab to analyze kills`;
      }
      if (activeEl) {
        if (active) {
          activeEl.textContent = `Researching: ${active.name} — ${active.pct}% (${active.progress.toFixed(1)}/${active.cost} SP)`;
        } else if (branchActive) {
          activeEl.textContent = `Branch: ${branchActive.name} — ${branchActive.pct}% (${branchActive.progress.toFixed(1)}/${branchActive.cost} SP)`;
        } else if (labs > 0) {
          activeEl.textContent =
            reserveScience > 0.05
              ? `Kill foes for SP (wave cap). ${reserveScience.toFixed(1)} reserve SP applies when you start a project.`
              : 'Kill foes to earn SP — stronger enemies yield more (wave cap applies). Click a node to begin.';
        } else {
          activeEl.textContent = 'Build & complete a Research Lab first, then start a project.';
        }
      }
    };
    if (!opts.force && treeSig === lastRenderSig && tree.childElementCount > 0) {
      updateResearchHeaders();
      return;
    }
    lastRenderSig = treeSig;

    updateResearchHeaders();

    const scrollTop = tree.scrollTop;
    const nodes = getNodesForUI(wave);
    const cats = ['military', 'defense', 'support', 'economy', 'academy', 'crossover', 'secret'];
    tree.innerHTML = cats
      .map((cat) => {
        const items = nodes.filter((n) => n.category === cat).sort(sortNodes);
        if (!items.length) return '';
        return `
        <div class="research-cat">
          <div class="research-cat-title">${escHtml(CAT_LABELS[cat] || cat)}</div>
          ${items
            .map((n) => {
              const tip = escAttr(n.lockReason || n.desc || '');
              const disabled =
                n.done || n.locked || (activeId && !n.active)
                  ? 'disabled'
                  : '';
              const cls = [
                'research-node',
                n.done ? 'done' : '',
                n.active ? 'active' : '',
                n.locked ? 'locked' : '',
                n.canStart ? 'can-start' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return `
            <button type="button" class="${cls}"
              data-research="${escAttr(n.id)}" title="${tip}"
              ${disabled}>
              <span class="research-node-name">${escHtml(n.name)}</span>
              <span class="research-node-cost">${n.done ? '✓' : `${n.cost} SP`}</span>
              <span class="research-node-desc">${escHtml(n.desc || '')}</span>
              <span class="research-node-unlocks">${escHtml(n.unlocksLine || '')}</span>
              <span class="research-node-prereq ${n.locked ? 'blocked' : ''}">${escHtml(n.prereqLine)}</span>
            </button>`;
            })
            .join('')}
        </div>`;
      })
      .join('');
    // Restore scroll so the panel doesn't jump every SP tick.
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
    document.getElementById('research-cancel')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof Game !== 'undefined') Game.cancelResearch?.();
    });
    document.getElementById('branch-cancel')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof Game !== 'undefined') Game.cancelBranchTech?.();
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
    return {
      sciencePoints,
      reserveScience,
      killScienceThisWave,
      completed: [...completed],
      activeId,
      activeProgress,
    };
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    sciencePoints = snap.sciencePoints ?? 0;
    reserveScience = snap.reserveScience ?? 0;
    killScienceThisWave = snap.killScienceThisWave ?? 0;
    completed = new Set(snap.completed || []);
    activeId = snap.activeId ?? null;
    activeProgress = snap.activeProgress ?? 0;
    rebuildUnlockMaps();
    // Old saves: no reserve field — catch up if a project is active and lifetime SP
    // exceeds progress (best-effort; new runs track reserve explicitly).
    if (snap.reserveScience == null && activeId && sciencePoints > activeProgress) {
      // Don't invent reserve from lifetime totals (would double-count past projects).
    } else if (activeId && reserveScience > 0) {
      flushReserveToActive(null);
    }
  }

  function init() {
    bindUI();
    resetRun();
  }

  return {
    init,
    resetRun,
    onWaveStart,
    onEnemySlain,
    grantBootstrapUnlocks,
    grantSciencePoints,
    tick,
    startResearch,
    cancelResearch,
    completeResearch,
    isCompleted,
    isDeployUnlocked,
    isBuildUnlocked,
    registerModUnlocks,
    clearModUnlocks,
    isFactionUnlocked,
    isDoomResearchUnlocked,
    isTpVeteranUpgradeUnlocked,
    countLabs,
    getKillScienceValue,
    getWaveKillScienceCap,
    getKillScienceStatus,
    getActiveInfo,
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
    CROSSOVER_FACTION_RESEARCH,
    STARTER_DEPLOY,
    STARTER_BUILD,
    get sciencePoints() {
      return sciencePoints;
    },
    get reserveScience() {
      return reserveScience;
    },
    get completedCount() {
      return completed.size;
    },
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Research = Research;
