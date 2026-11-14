/**
 * Siege loop — the run-shaping layer on top of the wave defense:
 * line-breakers and the breach limit, spoils of war, the early-call bonus,
 * next-wave scouting, supply crates, class counters and rear attacks,
 * the General's orders, veteran records, ribbons and the Warband mode.
 *
 * The battle stays one continuous field. Nothing here pauses the siege.
 */
const SiegeLoop = (() => {
  const RIBBON_KEY = 'myth-and-blood-ribbons-v1';
  const SPOILS_EVERY = 5;
  const RUNNER_FROM_WAVE = 3;
  const CRATE_FROM_WAVE = 2;
  const WAR_CRY_COOLDOWN = 45 * 60;
  const HOLD_LINE_COOLDOWN = 60 * 60;
  const ORDER_RADIUS = 190;
  const REAR_ATTACK_MULT = 1.25;
  const MAX_EDICT_STACKS = 3;
  const ARMY_FREE = 14;
  const ARMY_UPKEEP = 0.07;

  // ---------------------------------------------------------------- edicts
  const EDICTS = {
    sharpened_steel: {
      name: 'Sharpened Steel',
      desc: 'Your troops deal 10% more damage.',
      fx: { dmgMult: 0.1 },
    },
    hardened_shields: {
      name: 'Hardened Shields',
      desc: 'Your troops take 8% less damage.',
      fx: { dmgTakenMult: -0.08 },
    },
    war_levy: {
      name: 'War Levy',
      desc: '+2 TP for every wave you clear.',
      fx: { tpPerWave: 2 },
    },
    second_wall: {
      name: 'Second Wall',
      desc: 'The realm survives 2 more breaches.',
      fx: { breachLimit: 2 },
    },
    field_surgeons: {
      name: 'Field Surgeons',
      desc: 'Troops recover an extra 15% health every nightfall.',
      fx: { nightHeal: 0.15 },
    },
    steady_hearts: {
      name: 'Steady Hearts',
      desc: '+10 morale every nightfall. Breaches shake your troops half as much.',
      fx: { nightMorale: 10, breachShock: -0.5 },
    },
    veterans_due: {
      name: 'Veterans’ Due',
      desc: 'Every kill earns one extra point of experience.',
      fx: { xpBonus: 1 },
    },
    scavengers: {
      name: 'Scavengers',
      desc: 'Supply crates land more often and are never trapped.',
      fx: { crateRate: 0.6, safeCrates: 1 },
    },
    caltrops: {
      name: 'Caltrops',
      desc: 'Line-breakers move 20% slower.',
      fx: { runnerSlow: 0.2 },
    },
    giant_killers: {
      name: 'Giant Killers',
      desc: '+20% damage against bosses and elites.',
      fx: { bossDmg: 0.2 },
    },
    war_chest: {
      name: 'War Chest',
      desc: '+15 TP right now.',
      instantTp: 15,
      fx: {},
    },
    flanking_drill: {
      name: 'Flanking Drill',
      desc: 'Attacks from behind hit 20% harder still.',
      fx: { rearBonus: 0.2 },
    },
    early_horn: {
      name: 'Early Horn',
      desc: 'Calling a wave early pays double.',
      fx: { earlyCallMult: 1 },
    },
  };

  // --------------------------------------------------------------- ribbons
  const RIBBONS = [
    {
      id: 'first_blood',
      name: 'First Blood',
      how: 'Clear wave 1.',
      perk: '+1 starting TP',
      test: (s) => s.maxWave >= 1,
      fx: { startTp: 1 },
    },
    {
      id: 'ten_dawns',
      name: 'Ten Dawns',
      how: 'Clear wave 10.',
      perk: '+2 starting TP',
      test: (s) => s.maxWave >= 10,
      fx: { startTp: 2 },
    },
    {
      id: 'quarter_siege',
      name: 'Quarter Siege',
      how: 'Clear wave 25.',
      perk: '+3 starting TP',
      test: (s) => s.maxWave >= 25,
      fx: { startTp: 3 },
    },
    {
      id: 'half_siege',
      name: 'Half Siege',
      how: 'Clear wave 50.',
      perk: '+1 breach limit',
      test: (s) => s.maxWave >= 50,
      fx: { breachLimit: 1 },
    },
    {
      id: 'the_hundred',
      name: 'The Hundred',
      how: 'Clear wave 100.',
      perk: '+1 TP per cleared wave',
      test: (s) => s.maxWave >= 100,
      fx: { tpPerWave: 1 },
    },
    {
      id: 'bosskiller',
      name: 'Bosskiller',
      how: 'Slay 5 named bosses.',
      perk: '+10% damage to bosses and elites',
      test: (s) => s.bosses >= 5,
      fx: { bossDmg: 0.1 },
    },
    {
      id: 'unbroken_line',
      name: 'Unbroken Line',
      how: 'Clear 10 waves in one run without a breach.',
      perk: '+1 breach limit',
      test: (s) => s.bestCleanStreak >= 10,
      fx: { breachLimit: 1 },
    },
    {
      id: 'clean_hands',
      name: 'Clean Hands',
      how: 'Clear 5 waves in one run without losing a soldier.',
      perk: 'Troops take 3% less damage',
      test: (s) => s.bestFlawless >= 5,
      fx: { dmgTakenMult: -0.03 },
    },
    {
      id: 'quartermaster',
      name: 'Quartermaster',
      how: 'Recover 25 supply crates.',
      perk: 'Crates land more often',
      test: (s) => s.crates >= 25,
      fx: { crateRate: 0.3 },
    },
    {
      id: 'early_riser',
      name: 'Early Riser',
      how: 'Call 20 waves early.',
      perk: '+1 TP on every early call',
      test: (s) => s.earlyCalls >= 20,
      fx: { earlyCallFlat: 1 },
    },
    {
      id: 'old_guard',
      name: 'Old Guard',
      how: 'Keep one soldier alive for 20 waves.',
      perk: 'Kills earn +1 experience',
      test: (s) => s.oldestVeteran >= 20,
      fx: { xpBonus: 1 },
    },
    {
      id: 'butcher',
      name: 'Butcher',
      how: 'Kill 1,000 enemies.',
      perk: '+3% damage',
      test: (s) => s.kills >= 1000,
      fx: { dmgMult: 0.03 },
    },
    {
      id: 'reaper',
      name: 'Reaper',
      how: 'Kill 10,000 enemies.',
      perk: '+3% damage',
      test: (s) => s.kills >= 10000,
      fx: { dmgMult: 0.03 },
    },
    {
      id: 'gatekeeper',
      name: 'Gatekeeper',
      how: 'Cut down 100 line-breakers.',
      perk: 'Line-breakers move 10% slower',
      test: (s) => s.runnersKilled >= 100,
      fx: { runnerSlow: 0.1 },
    },
    {
      id: 'council_seat',
      name: 'Council Seat',
      how: 'Claim 10 spoils of war.',
      perk: '+2 starting TP',
      test: (s) => s.edicts >= 10,
      fx: { startTp: 2 },
    },
    {
      id: 'warband_oath',
      name: 'Warband Oath',
      how: 'Clear wave 15 in Warband mode.',
      perk: 'Troops take 3% less damage',
      test: (s) => s.warbandWave >= 15,
      fx: { dmgTakenMult: -0.03 },
    },
  ];

  const emptyStats = () => ({
    maxWave: 0,
    bosses: 0,
    bestCleanStreak: 0,
    bestFlawless: 0,
    crates: 0,
    earlyCalls: 0,
    oldestVeteran: 0,
    kills: 0,
    runnersKilled: 0,
    edicts: 0,
    warbandWave: 0,
  });

  let store = { stats: emptyStats(), earned: [] };

  function loadStore() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RIBBON_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        store = {
          stats: { ...emptyStats(), ...(parsed.stats || {}) },
          earned: Array.isArray(parsed.earned) ? parsed.earned : [],
        };
      }
    } catch (_) {
      /* storage unavailable */
    }
  }

  function saveStore() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(RIBBON_KEY, JSON.stringify(store));
      }
    } catch (_) {
      /* storage unavailable */
    }
  }

  // ------------------------------------------------------------ first steps
  // A new commander meets one system per early wave. Nothing is locked: the parts of the
  // HUD that belong to a later step are hidden or dimmed, and each step gets one line.
  const FIRST_STEPS_KEY = 'myth-and-blood-first-steps-v1';
  const FIRST_STEPS_DONE_WAVE = 10;
  const FIRST_STEPS = [
    {
      id: 'deploy',
      wave: 1,
      text: 'Pick a troop on the left (keys 1-6) and click the field to deploy. Soldiers hunt on their own and walk back to their posts. Select one and click to move him; Shift+click sends him there to hold.',
    },
    {
      id: 'crates',
      wave: 2,
      text: 'Press D to call the next wave early for bonus TP. From wave 2, supply crates land by day: walk a soldier onto one.',
    },
    {
      id: 'breach',
      wave: 3,
      text: 'Enemies with a red pennant are line-breakers: they run past your troops. Each one that gets through is a breach, counted at the top.',
    },
    {
      id: 'orders',
      wave: 4,
      text: "The General's orders: with a General on the field, War Cry ([) and Hold the Line (]) steel the soldiers near him.",
    },
    {
      id: 'spoils',
      wave: 5,
      text: 'Every fifth wave pays spoils: after this wave, choose one of three rewards to keep for the rest of the siege.',
    },
    {
      id: 'strikes',
      wave: 6,
      text: 'Spells and strikes are open: the Spells tab on the left (Q, W, E...) spends TP on fire, lightning and healing.',
    },
    {
      id: 'intel',
      wave: 8,
      text: 'Spy and courier are open: the right panel scouts the next wave and sends one royal message per wave.',
    },
  ];

  let steps = { veteran: false, skipped: false };

  function loadSteps() {
    try {
      const raw =
        typeof localStorage !== 'undefined' ? localStorage.getItem(FIRST_STEPS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        steps = { veteran: !!parsed.veteran, skipped: !!parsed.skipped };
      }
    } catch (_) {
      /* storage unavailable */
    }
  }

  function saveSteps() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FIRST_STEPS_KEY, JSON.stringify(steps));
      }
    } catch (_) {
      /* storage unavailable */
    }
  }

  /** True while this run is introducing systems one wave at a time. */
  function firstStepsActive(ctx) {
    return !!(run.active && run.staged && !steps.skipped && !(ctx && ctx.creative));
  }

  /** The wave the player is preparing for: at night that is the one about to arrive. */
  function upcomingWave(ctx) {
    return Math.max(1, (ctx.wave || 0) + (ctx.isNight ? 1 : 0));
  }

  function stepReached(step, ctx) {
    return upcomingWave(ctx) >= step.wave;
  }

  /** Which systems the HUD shows. Everything is shown once the introduction is over. */
  function firstStepsState(ctx) {
    const active = firstStepsActive(ctx);
    const unlocked = {};
    for (const step of FIRST_STEPS) unlocked[step.id] = !active || stepReached(step, ctx);
    return { active, unlocked, shown: run.stepsShown ? [...run.stepsShown] : [] };
  }

  function updateFirstSteps(ctx) {
    if (!run.active || ctx.creative) return;
    if (!steps.veteran && ctx.wave >= FIRST_STEPS_DONE_WAVE) {
      steps.veteran = true;
      saveSteps();
    }
    if (!firstStepsActive(ctx)) return;
    if (ctx.tick < (run.stepNextTick || 0)) return;
    for (const step of FIRST_STEPS) {
      if (run.stepsShown.includes(step.id) || !stepReached(step, ctx)) continue;
      run.stepsShown.push(step.id);
      // One line at a time, with room to read it before the next.
      run.stepNextTick = ctx.tick + 420;
      // Straight to the banner: a queued line could arrive a wave late or be dropped.
      ctx.showMessage(step.text, 420, { priority: 'high', bypassQueue: true });
      break;
    }
  }

  /** Menu control: show the whole HUD now and stop the one-line prompts for good. */
  function skipIntroduction() {
    steps.skipped = true;
    saveSteps();
    if (hudCtx) syncHud(hudCtx());
    return true;
  }

  /** For tests and the settings reset: start the introduction over. */
  function resetIntroduction() {
    steps = { veteran: false, skipped: false };
    saveSteps();
  }

  function introductionStatus() {
    return { veteran: steps.veteran, skipped: steps.skipped, staged: !!run.staged };
  }

  // ------------------------------------------------------------- run state
  const freshRun = () => ({
    active: false,
    counted: true,
    warband: false,
    breaches: 0,
    edicts: [],
    drafts: [],
    crates: [],
    crateTimer: 0,
    stains: [],
    fallen: [],
    preview: null,
    cleanStreak: 0,
    flawless: 0,
    warCryReady: 0,
    holdLineReady: 0,
    slowMo: 0,
    rings: [],
    tally: { runners: 0, crates: 0, earlyCalls: 0, ribbons: [], bosses: 0, bestVeteran: null },
    lastCombatTick: 0,
    lastEnemyCount: 0,
    nextId: 1,
    staged: false,
    stepsShown: [],
    stepNextTick: 0,
  });

  let run = freshRun();
  let fx = computeFx();

  function computeFx() {
    const out = {
      dmgMult: 0,
      dmgTakenMult: 0,
      tpPerWave: 0,
      breachLimit: 0,
      nightHeal: 0,
      nightMorale: 0,
      breachShock: 0,
      xpBonus: 0,
      crateRate: 0,
      safeCrates: 0,
      runnerSlow: 0,
      bossDmg: 0,
      rearBonus: 0,
      earlyCallMult: 0,
      earlyCallFlat: 0,
      startTp: 0,
    };
    const add = (src) => {
      for (const k in src) out[k] = (out[k] || 0) + src[k];
    };
    if (run && run.counted) {
      for (const r of RIBBONS) if (store.earned.includes(r.id)) add(r.fx);
    }
    if (run) for (const id of run.edicts) if (EDICTS[id]) add(EDICTS[id].fx);
    return out;
  }

  // ------------------------------------------------------------ run events
  /** Called once when a battle begins. Returns bonus starting TP. */
  function startRun(ctx) {
    run = freshRun();
    run.active = true;
    run.counted = !ctx.creative;
    run.creativeRun = !!ctx.creative;
    run.warband = ctx.menuModeId === 'warband';
    // Returning commanders (wave 10 reached once) and creative runs see everything at once.
    run.staged = !ctx.creative && !steps.veteran && !steps.skipped;
    // Let the opening announcements pass before the first line of the introduction.
    run.stepNextTick = (ctx.tick || 0) + 240;
    fx = computeFx();
    hideSpoils();
    syncHud(ctx);
    ctx.ambience(ctx.isNight ? 'night' : 'day');
    return run.counted ? fx.startTp : 0;
  }

  function isWarband() {
    return !!run.warband;
  }

  /** Warband: half as many soldiers, each worth far more. */
  function deployCostMult(army = 0) {
    // A big host is hard to feed: past 14 soldiers every recruit costs 7% more per head.
    const upkeep =
      run.active && !run.creativeRun ? 1 + Math.max(0, army - ARMY_FREE) * ARMY_UPKEEP : 1;
    return (run.warband ? 2 : 1) * upkeep;
  }

  function applySpawnMods(unit) {
    if (!run.warband || !unit || unit.team !== 'player' || unit.isDoomslayer) return;
    unit.maxHp = Math.floor(unit.maxHp * 1.7);
    unit.hp = unit.maxHp;
    if (unit.damage) unit.damage = Math.floor(unit.damage * 1.35);
  }

  function breachLimit(ctx) {
    return Math.max(1, (ctx.missLimit || 10) + fx.breachLimit);
  }

  // ---------------------------------------------------------- line-breakers
  function isRunnerCandidate(unit) {
    if (!unit || unit.team !== 'enemy') return false;
    if (unit.isNamedBoss || unit.isPlanetBoss || unit.isEvilOperative || unit.isCounterRaid) {
      return false;
    }
    if (unit.type === 'siege_tower' || unit.type === 'goblin_engineer') return false;
    if (typeof isMonsterEnemy === 'function' && isMonsterEnemy(unit)) return false;
    if ((unit.range || 0) > 60) return false;
    return true;
  }

  /** Some enemies ignore your troops and run for the line. */
  function tagEnemySpawn(unit, ctx) {
    if (!run.active || ctx.creative || ctx.wave < RUNNER_FROM_WAVE) return;
    if (!isRunnerCandidate(unit)) return;
    const quick = (unit.speed || 0) >= 0.65;
    // A bigger host draws more runners: the enemy probes for gaps instead of fighting it head-on.
    const crowd = Math.min(0.25, Math.max(0, (ctx.army || 0) - ARMY_FREE) * 0.005);
    const chance = Math.min(0.55, (quick ? 0.2 : 0.1) + ctx.wave * 0.004 + crowd);
    if (ctx.rng() >= chance) return;
    unit.lineBreaker = true;
    unit.stormLine = true;
    ctx.playSfx('runnerShriek');
    // Runners travel light: quicker than the rest of the host, and easier to cut down.
    unit.speed *= 1.3 * Math.max(0.5, 1 - fx.runnerSlow);
    unit.maxHp = Math.max(1, Math.floor(unit.maxHp * 0.9));
    unit.hp = unit.maxHp;
  }

  /**
   * The enemy forms up at the edge of the field before it advances. Your troops hold
   * their ground until a squad has left that muster zone, so battles are fought in the
   * open field and not at the spot where enemies appear.
   */
  function inMusterZone(u, ctx) {
    const side = u.spawnSide || 'north';
    const deep = side === 'north' || side === 'south';
    const depth = (deep ? ctx.worldH : ctx.worldW) * 0.42;
    if (side === 'north') return u.y < depth;
    if (side === 'south') return u.y > ctx.worldH - depth;
    if (side === 'west') return u.x < depth;
    return u.x > ctx.worldW - depth;
  }

  /** True while an enemy is still forming up and should be left alone by auto-targeting. */
  function isMustering(foe) {
    return run.active && !run.creativeRun && foe.team === 'enemy' && !foe.mustered;
  }

  /** With no defender left to fight, every enemy goes for the line. */
  function unopposedBreaks(ctx) {
    return run.active && !ctx.creative && ctx.wave >= 1;
  }

  function noteCombat(tick) {
    run.lastCombatTick = tick;
  }

  /**
   * A standoff cannot last. If the whole host is on the field and nobody has drawn
   * blood for about a minute, the enemy stops waiting and storms the line.
   */
  function checkStandoff(ctx, enemies) {
    if (ctx.isNight || ctx.creative || enemies === 0 || ctx.queueLeft > 0) {
      run.lastCombatTick = ctx.tick;
      return;
    }
    if (ctx.tick - run.lastCombatTick < 1800 + ctx.worldH * 3) return;
    run.lastCombatTick = ctx.tick;
    let stormed = 0;
    for (const u of ctx.units) {
      if (u.team !== 'enemy' || u.hp <= 0 || u.fleeing || u.type === 'siege_tower') continue;
      u.lineBreaker = true;
      u.stormLine = true;
      u.path = [];
      u.pathIndex = 0;
      u.pathTargetId = null;
      u.combatTargetId = null;
      stormed++;
    }
    if (stormed > 0) {
      ctx.showMessage('The enemy tires of waiting and storms the line!', 260);
      ctx.playSfx('bossWarn');
    }
  }

  /**
   * Enemies that spawn on a side flank can wedge against the map edge and never move,
   * which leaves the wave unfinishable. One that has not moved for ten seconds while
   * hugging an edge is walked a few steps into the field and re-pathed.
   */
  function unstickFromEdge(u, ctx) {
    const margin = 44;
    const nearEdge =
      u.x < margin || u.x > ctx.worldW - margin || u.y < margin || u.y > ctx.worldH - margin;
    if (!nearEdge || u.fleeing) {
      u.edgeStill = 0;
      return;
    }
    if (Math.abs(u.x - (u.edgeX || 0)) > 3 || Math.abs(u.y - (u.edgeY || 0)) > 3) {
      u.edgeX = u.x;
      u.edgeY = u.y;
      u.edgeStill = 0;
      return;
    }
    u.edgeStill = (u.edgeStill || 0) + 6;
    if (u.edgeStill < 600) return;
    u.edgeStill = 0;
    u.x = Math.max(margin + 16, Math.min(ctx.worldW - margin - 16, u.x));
    u.y = Math.max(margin + 16, Math.min(ctx.worldH - margin - 16, u.y));
    u.path = [];
    u.pathIndex = 0;
    u.pathTargetId = null;
    u.pathPending = false;
    u.pinned = false;
  }

  /** Where a line-breaker is headed. */
  function breachGoal(unit, ctx) {
    if ((unit.spawnSide || 'north') === 'north') {
      return { x: Math.max(30, Math.min(ctx.worldW - 30, unit.x)), y: ctx.worldH - 36 };
    }
    return { x: ctx.worldW / 2, y: ctx.rallyY };
  }

  function hasBreached(unit, ctx) {
    if ((unit.spawnSide || 'north') === 'north') return unit.y >= ctx.worldH - 58;
    const dx = unit.x - ctx.worldW / 2;
    const dy = unit.y - ctx.rallyY;
    return dx * dx + dy * dy <= 44 * 44;
  }

  function recordBreach(unit, ctx) {
    unit.hp = 0;
    unit.breachedLine = true;
    run.breaches++;
    run.cleanStreak = 0;
    const limit = breachLimit(ctx);
    const left = limit - run.breaches;
    ctx.float(unit.x, unit.y - 18, 'BREACH', '#ff3030');
    ctx.shake(7);
    ctx.playSfx('breachHorn');
    ctx.burst('dust', unit.x, unit.y);
    flashBreach();
    const shock = Math.max(0, 4 * (1 + fx.breachShock));
    if (shock > 0) {
      for (const u of ctx.units) {
        if (u.team === 'player' && u.hp > 0 && u.maxMorale > 0 && !u.isGeneral) {
          u.morale = Math.max(0, u.morale - shock);
        }
      }
    }
    if (left < 0) {
      ctx.showMessage('The line is broken. Too many got through — the realm falls.', 320);
      ctx.defeat();
    } else if (left === 0) {
      ctx.showMessage('BREACH! One more through the line and the realm falls.', 260);
    } else {
      ctx.showMessage(`BREACH! The realm can bear ${left} more.`, 200);
    }
    syncHud(ctx);
  }

  // ------------------------------------------------------------------ spoils
  function rollSpoils(ctx) {
    const held = {};
    for (const id of run.edicts) held[id] = (held[id] || 0) + 1;
    for (const d of run.drafts) for (const id of d) held[id] = (held[id] || 0) + 1;
    let pool = Object.keys(EDICTS).filter((id) => (held[id] || 0) < MAX_EDICT_STACKS);
    if (pool.length < 3) pool = ['war_chest', 'war_chest', 'war_chest'];
    const picks = [];
    while (picks.length < 3 && pool.length) {
      const i = Math.floor(ctx.rng() * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }
    return picks;
  }

  function claimSpoils(index, ctx) {
    const draft = run.drafts[0];
    if (!draft) return false;
    const id = draft[index];
    const def = EDICTS[id];
    if (!def) return false;
    run.drafts.shift();
    run.edicts.push(id);
    fx = computeFx();
    if (def.instantTp) ctx.addTp(def.instantTp);
    if (run.counted) {
      store.stats.edicts++;
      checkRibbons(ctx);
      saveStore();
    }
    ctx.showMessage(`Spoils claimed: ${def.name}. ${def.desc}`, 240);
    ctx.playSfx('spoilsClaim');
    renderSpoils(ctx);
    syncHud(ctx);
    return true;
  }

  // -------------------------------------------------------------- next wave
  function buildPreview(ctx) {
    if (typeof getWaveConfig !== 'function') return null;
    const next = ctx.wave + 1;
    const cfg = getWaveConfig(next);
    if (!cfg) return null;
    const weights = {};
    for (const t of cfg.pool || []) weights[t] = (weights[t] || 0) + 1;
    const prevPool = new Set((getWaveConfig(Math.max(1, ctx.wave)) || {}).pool || []);
    const names = Object.keys(weights)
      .sort((a, b) => weights[b] - weights[a])
      .slice(0, 4)
      .map((t) => {
        const name = (typeof EnemyDefs !== 'undefined' && EnemyDefs[t]?.name) || t;
        return prevPool.has(t) || ctx.wave < 1 ? name : `${name} (new)`;
      });
    const countMult = ctx.countMultFor ? ctx.countMultFor(next) : ctx.enemyCountMult || 1;
    const count = Math.max(1, Math.round((cfg.count || 0) * countMult));
    let kind = '';
    if (cfg.boss) kind = 'Boss wave';
    else if (typeof GameDepth !== 'undefined' && GameDepth.isHordeWave?.(next)) kind = 'Horde';
    return {
      wave: next,
      count,
      names,
      kind,
      boss: !!cfg.boss,
      runners: next >= RUNNER_FROM_WAVE,
    };
  }

  /**
   * What the night shows on each edge the next wave will use: where to draw the marker,
   * which way it points, and a rough share of the host. Null when the sides are not known.
   */
  function spawnMarkers(ctx) {
    const sides = ctx && ctx.isNight ? ctx.nextSides : null;
    if (!sides || !sides.length || !run.preview) return null;
    const w = ctx.worldW;
    const h = ctx.worldH;
    const share = Math.max(1, Math.round(run.preview.count / sides.length));
    const names = run.preview.names.slice(0, 2).map((n) => n.replace(' (new)', ''));
    const at = {
      north: { x: w / 2, y: 30, dx: 0, dy: 1 },
      south: { x: w / 2, y: h - 30, dx: 0, dy: -1 },
      east: { x: w - 30, y: h / 2, dx: -1, dy: 0 },
      west: { x: 30, y: h / 2, dx: 1, dy: 0 },
    };
    return sides
      .filter((side) => at[side])
      .map((side) => ({ side, ...at[side], count: share, names, boss: !!run.preview.boss }));
  }

  function previewText(p) {
    if (!p) return '';
    const parts = [`Wave ${p.wave}: about ${p.count} foes`];
    if (p.kind) parts.push(p.kind);
    if (p.names.length) parts.push(p.names.join(', '));
    if (p.runners) parts.push('line-breakers likely');
    return parts.join(' · ');
  }

  // ------------------------------------------------------------- night / day
  function onNightBegin(ctx) {
    if (!run.active) return;
    let lost = ctx.casualties || 0;
    let oldest = 0;
    for (const u of ctx.units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      u.wavesSurvived = (u.wavesSurvived || 0) + 1;
      if (u.wavesSurvived > oldest && !u.isDoomslayer) oldest = u.wavesSurvived;
      if (fx.nightHeal > 0) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * fx.nightHeal);
      if (fx.nightMorale > 0 && u.maxMorale > 0) {
        u.morale = Math.min(u.maxMorale, u.morale + fx.nightMorale);
      }
    }
    run.cleanStreak++;
    run.flawless = lost === 0 ? run.flawless + 1 : 0;
    if (fx.tpPerWave > 0) ctx.addTp(fx.tpPerWave);
    if (ctx.wave > 0 && ctx.wave % SPOILS_EVERY === 0 && !ctx.creative) {
      run.drafts.push(rollSpoils(ctx));
      ctx.showMessage('Spoils of war — choose one reward before the next assault.', 260);
    }
    run.preview = buildPreview(ctx);
    ctx.ambience('night');
    run.crates = run.crates.filter((c) => !c.spent);
    if (run.counted) {
      const s = store.stats;
      s.maxWave = Math.max(s.maxWave, ctx.wave);
      s.bestCleanStreak = Math.max(s.bestCleanStreak, run.cleanStreak);
      s.bestFlawless = Math.max(s.bestFlawless, run.flawless);
      s.oldestVeteran = Math.max(s.oldestVeteran, oldest);
      if (run.warband) s.warbandWave = Math.max(s.warbandWave, ctx.wave);
      checkRibbons(ctx);
      saveStore();
    }
    renderSpoils(ctx);
    syncHud(ctx);
  }

  /** TP for sounding the horn before the night runs out. */
  function earlyCallBonus(secondsLeft, ctx) {
    if (!run.active || ctx.creative || ctx.wave < 1) return 0;
    const base = Math.min(5, Math.floor(secondsLeft / 10));
    if (base <= 0) return 0;
    const bonus = base * (1 + fx.earlyCallMult) + fx.earlyCallFlat;
    run.tally.earlyCalls++;
    if (run.counted) {
      store.stats.earlyCalls++;
      checkRibbons(ctx);
      saveStore();
    }
    return bonus;
  }

  function onWaveStart(ctx) {
    if (!run.active) return;
    // Yesterday's dead sink into the mud; unclaimed spoils are picked for you.
    if (run.stains.length > 70) run.stains.splice(0, run.stains.length - 70);
    while (run.drafts.length) claimSpoils(Math.floor(ctx.rng() * 3), ctx);
    run.preview = null;
    run.crateTimer = 300 + Math.floor(ctx.rng() * 500);
    run.lastCombatTick = ctx.tick;
    if (ctx.boss) {
      showBossCard(ctx.boss.name, ctx.boss.title);
      ctx.playSfx('bossRoar');
    } else if (ctx.wave >= 2) {
      ctx.playSfx('musterDrums');
    }
    ctx.ambience('day');
    syncHud(ctx);
  }

  // ------------------------------------------------------------------ crates
  function dropCrate(ctx) {
    const x = 60 + ctx.rng() * (ctx.worldW - 120);
    const top = Math.max(120, ctx.worldH * 0.3);
    const y = top + ctx.rng() * Math.max(40, ctx.deployY - 30 - top);
    run.crates.push({ id: run.nextId++, x, y, age: 0, spent: false });
    ctx.float(x, y - 14, 'SUPPLIES', '#e8dcc0');
    ctx.burst('dust', x, y);
    ctx.playSfx('whoosh');
  }

  function openCrate(crate, opener, ctx) {
    crate.spent = true;
    run.tally.crates++;
    if (run.counted) {
      store.stats.crates++;
      checkRibbons(ctx);
      saveStore();
    }
    const roll = ctx.rng();
    if (roll < 0.14 && !fx.safeCrates && ctx.wave >= 3) {
      ctx.float(crate.x, crate.y - 14, 'AMBUSH!', '#ff4040');
      ctx.showMessage('The crate was bait — goblins spring the ambush!', 200);
      ctx.playSfx('ambush');
      ctx.burst('dust', crate.x, crate.y);
      for (let i = 0; i < 2 + Math.min(2, Math.floor(ctx.wave / 12)); i++) {
        ctx.spawnEnemy('goblin', crate.x - 24 + i * 16, crate.y - 26);
      }
      return;
    }
    if (roll < 0.55) {
      const tp = 3 + Math.floor(ctx.rng() * 3) + Math.min(6, Math.floor(ctx.wave / 10));
      ctx.addTp(tp);
      ctx.float(crate.x, crate.y - 14, `+${tp} TP`, '#80ffa0');
    } else if (roll < 0.8) {
      for (const u of ctx.units) {
        if (u.team !== 'player' || u.hp <= 0) continue;
        const dx = u.x - crate.x;
        const dy = u.y - crate.y;
        if (dx * dx + dy * dy <= 150 * 150) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.35);
      }
      ctx.float(crate.x, crate.y - 14, 'BANDAGES', '#80ffa0');
      ctx.playSfx('heal');
    } else {
      for (const u of ctx.units) {
        if (u.team === 'player' && u.hp > 0 && u.maxMorale > 0) {
          u.morale = Math.min(u.maxMorale, u.morale + 12);
        }
      }
      ctx.float(crate.x, crate.y - 14, 'RATIONS · MORALE UP', '#ffd080');
    }
    if (opener) opener.experience = (opener.experience || 0) + 1;
    ctx.playSfx('crateOpen');
    ctx.burst('vetSpark', crate.x, crate.y);
  }

  // ------------------------------------------------------------------ update
  function update(ctx) {
    if (!run.active) return;
    const tick = ctx.tick;

    if (!ctx.isNight && !ctx.creative) {
      if (ctx.wave >= CRATE_FROM_WAVE && run.crates.length < 3) {
        run.crateTimer -= 1 + fx.crateRate;
        if (run.crateTimer <= 0) {
          dropCrate(ctx);
          run.crateTimer = 900 + Math.floor(ctx.rng() * 900);
        }
      }
    }

    if (tick % 6 === 0) {
      const units = ctx.units;
      const liveCrates = run.crates.filter((c) => !c.spent);
      let enemies = 0;
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.hp <= 0) continue;
        if (u.team === 'enemy') {
          enemies++;
          // Line-breakers kick up dust as they run.
          if (u.lineBreaker && tick % 18 === 0) ctx.burst('dust', u.x, u.y + 6);
          if (!u.mustered) {
            // The approach lasts until the squad crosses into your half, or 25 seconds at most.
            u.musterAge = (u.musterAge || 0) + 6;
            if (u.musterAge >= 1500 || !inMusterZone(u, ctx)) u.mustered = true;
          }
          if (u.lineBreaker && hasBreached(u, ctx)) recordBreach(u, ctx);
          else unstickFromEdge(u, ctx);
        } else if (u.team === 'player' && liveCrates.length) {
          for (const c of liveCrates) {
            if (c.spent) continue;
            const dx = u.x - c.x;
            const dy = u.y - c.y;
            if (dx * dx + dy * dy <= 26 * 26) openCrate(c, u, ctx);
          }
        }
      }
      for (const c of run.crates) c.age += 6;
      run.crates = run.crates.filter((c) => !c.spent && c.age < 60 * 75);
      run.lastEnemyCount = enemies;
      checkStandoff(ctx, enemies);
    }
    if (tick % 20 === 0) {
      updateFirstSteps(ctx);
      syncHud(ctx);
    }
  }

  /** True on frames the simulation should skip — the last kill of a wave lands slowly. */
  function consumeSlowMoSkip() {
    if (run.slowMo <= 0) return false;
    run.slowMo--;
    return run.slowMo % 2 === 1;
  }

  // ------------------------------------------------------------------ combat
  const MOUNTED = { warg_rider: 1, dark_knight: 1 };
  const SHOOTERS = { orc_archer: 1, dark_mage: 1, shaman: 1, necromancer: 1 };
  const ARMOURED = { dark_knight: 1, troll: 1, war_chief: 1, siege_tower: 1 };
  const SWARM = { goblin: 1, goblin_sapper: 1, plague_rat: 1 };

  /** Class counters. Returns a damage multiplier and never less than 0.75. */
  function counterMult(attacker, target) {
    const a = attacker.type;
    const t = target.type;
    if (attacker.team === 'player') {
      if (a === 'pikeman' && MOUNTED[t]) return 1.6;
      if ((a === 'cavalry' || a === 'knight' || a === 'scout') && SHOOTERS[t]) return 1.4;
      if (a === 'archer' && SWARM[t]) return 1.25;
      if (a === 'archer' && ARMOURED[t]) return 0.8;
      if ((a === 'mage' || a === 'ballista' || a === 'sapper') && ARMOURED[t]) return 1.35;
      if (a === 'footman' && t === 'berserker') return 1.2;
      return 1;
    }
    if (attacker.team === 'enemy') {
      if (MOUNTED[a] && (t === 'archer' || t === 'mage' || t === 'healer' || t === 'bard')) {
        return 1.3;
      }
      if (MOUNTED[a] && t === 'pikeman') return 0.75;
      if (a === 'troll' && (t === 'footman' || t === 'pikeman')) return 1.2;
    }
    return 1;
  }

  const COUNTER_NOTES = {
    pikeman: 'Strong against riders',
    cavalry: 'Strong against archers and casters',
    knight: 'Strong against archers and casters',
    scout: 'Strong against archers and casters',
    archer: 'Strong against goblins and rats · weak against armour',
    crossbowman: 'Strong against armour',
    mage: 'Strong against armour',
    ballista: 'Strong against armour',
    sapper: 'Strong against armour',
    footman: 'Strong against berserkers',
  };

  function isBehind(attacker, target) {
    if (target.rotation == null) return false;
    const rad = (target.rotation * Math.PI) / 180;
    const fxv = Math.cos(rad);
    const fyv = Math.sin(rad);
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return false;
    return (dx * fxv + dy * fyv) / len < -0.5;
  }

  function isBigTarget(target) {
    return (
      target.isNamedBoss ||
      target.isPlanetBoss ||
      (typeof isEliteEnemy === 'function' && isEliteEnemy(target))
    );
  }

  function modifyDamage(attacker, target, dmg, tick) {
    if (!run.active || !attacker || !target || !(dmg > 0)) return dmg;
    // An enemy that opens fire is in the fight, wherever it stands.
    if (attacker.team === 'enemy') attacker.mustered = true;
    let mult = counterMult(attacker, target);
    if (attacker.team !== target.team && isBehind(attacker, target)) {
      mult *= REAR_ATTACK_MULT + (attacker.team === 'player' ? fx.rearBonus : 0);
      if (target.maxMorale > 0 && !target.isGeneral && target.morale > 0) {
        target.morale = Math.max(0, target.morale - 1.5);
      }
    }
    if (attacker.team === 'player') {
      mult *= 1 + fx.dmgMult;
      if ((attacker.warCryUntil || 0) > tick) mult *= 1.2;
      if (fx.bossDmg > 0 && isBigTarget(target)) {
        mult *= 1 + fx.bossDmg;
      }
    }
    return mult === 1 ? dmg : Math.max(1, Math.round(dmg * mult));
  }

  function modifyDamageTaken(unit, amount, tick) {
    if (!run.active || unit.team !== 'player') return amount;
    let mult = Math.max(0.5, 1 + fx.dmgTakenMult);
    if ((unit.holdLineUntil || 0) > tick) mult *= 0.6;
    return amount * mult;
  }

  function killXpBonus() {
    return run.active ? fx.xpBonus : 0;
  }

  // --------------------------------------------------------- deaths and kills
  function veteranLabel(unit, ctx) {
    return unit.honorName || ctx.unitName(unit);
  }

  function onUnitDeath(unit, killer, ctx) {
    if (!run.active) return;
    if (unit.breachedLine) return;
    if (run.stains.length >= 160) run.stains.shift();
    run.stains.push({
      scorch: unit.deathCause === 'burn' || unit.deathCause === 'blast',
      x: unit.x,
      y: unit.y + 6,
      r: unit.isNamedBoss ? 16 : 6 + ((unit.x * 7 + unit.y * 3) % 5),
      enemy: unit.team === 'enemy',
      tilt: ((unit.x + unit.y) % 9) / 9 - 0.5,
    });
    if (unit.team === 'enemy') {
      if (killer) killer.kills = (killer.kills || 0) + 1;
      if (run.counted) {
        store.stats.kills++;
        if (unit.lineBreaker) store.stats.runnersKilled++;
        if (unit.isNamedBoss) store.stats.bosses++;
      }
      if (unit.lineBreaker) run.tally.runners++;
      if (unit.isNamedBoss) run.tally.bosses++;
      if (killer && killer.team === 'player' && !killer.isDoomslayer) {
        const best = run.tally.bestVeteran;
        if (!best || killer.kills > best.kills) {
          run.tally.bestVeteran = { name: veteranLabel(killer, ctx), kills: killer.kills };
        }
      }
      if (ctx.enemiesLeft <= 1 && ctx.queueLeft === 0 && !ctx.isNight) run.slowMo = 46;
      return;
    }
    if (unit.team !== 'player' || unit.isGeneral || unit.isDoomslayer) return;
    const kills = unit.kills || 0;
    const waves = unit.wavesSurvived || 0;
    if (kills >= 8 || waves >= 5 || unit.honorName) {
      const name = veteranLabel(unit, ctx);
      run.fallen.push({ name, kills, waves, wave: ctx.wave });
      if (run.fallen.length > 12) run.fallen.shift();
      ctx.playSfx('veteranFallen');
      ctx.showMessage(
        `${name} has fallen — ${kills} kill${kills === 1 ? '' : 's'} across ${waves} wave${waves === 1 ? '' : 's'}.`,
        260
      );
    }
  }

  // ---------------------------------------------------------- general orders
  function castOrder(kind, ctx) {
    if (!run.active || ctx.isNight) return false;
    const general = ctx.general;
    if (!general || general.hp <= 0) {
      ctx.showMessage('No General on the field to give the order.', 160);
      return false;
    }
    const tick = ctx.tick;
    const readyAt = kind === 'warCry' ? run.warCryReady : run.holdLineReady;
    if (tick < readyAt) {
      ctx.showMessage(`Not ready — ${Math.ceil((readyAt - tick) / 60)}s.`, 120);
      return false;
    }
    let reached = 0;
    for (const u of ctx.units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      const dx = u.x - general.x;
      const dy = u.y - general.y;
      if (dx * dx + dy * dy > ORDER_RADIUS * ORDER_RADIUS) continue;
      reached++;
      if (kind === 'warCry') {
        u.warCryUntil = tick + 8 * 60;
        if (u.maxMorale > 0) u.morale = Math.min(u.maxMorale, u.morale + 20);
      } else {
        u.holdLineUntil = tick + 7 * 60;
      }
    }
    if (kind === 'warCry') {
      run.warCryReady = tick + WAR_CRY_COOLDOWN;
      ctx.float(general.x, general.y - 30, 'WAR CRY', '#ffb060');
      ctx.playSfx('warCry');
      run.rings.push({
        x: general.x,
        y: general.y,
        max: ORDER_RADIUS,
        age: 0,
        color: '255,150,60',
      });
    } else {
      run.holdLineReady = tick + HOLD_LINE_COOLDOWN;
      ctx.float(general.x, general.y - 30, 'HOLD THE LINE', '#c0d8ff');
      ctx.playSfx('holdLine');
      run.rings.push({
        x: general.x,
        y: general.y,
        max: ORDER_RADIUS,
        age: 0,
        color: '170,200,255',
      });
    }
    ctx.shake(3);
    ctx.showMessage(
      kind === 'warCry'
        ? `War Cry — ${reached} soldiers strike 20% harder for 8 seconds.`
        : `Hold the Line — ${reached} soldiers take 40% less damage for 7 seconds.`,
      200
    );
    syncHud(ctx);
    return true;
  }

  // ----------------------------------------------------------------- ribbons
  function checkRibbons(ctx) {
    for (const r of RIBBONS) {
      if (store.earned.includes(r.id) || !r.test(store.stats)) continue;
      store.earned.push(r.id);
      if (run.active) run.tally.ribbons.push(r.name);
      if (ctx) {
        ctx.showMessage(`Ribbon earned: ${r.name} — ${r.perk} on every future run.`, 320);
        ctx.playSfx('ribbonEarned');
      }
    }
  }

  function getRibbons() {
    return RIBBONS.map((r) => ({
      id: r.id,
      name: r.name,
      how: r.how,
      perk: r.perk,
      earned: store.earned.includes(r.id),
    }));
  }

  function renderRibbonList() {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('ribbon-list');
    if (!host) return;
    const list = getRibbons();
    const count = document.getElementById('ribbon-count');
    if (count) count.textContent = `${list.filter((r) => r.earned).length}/${list.length}`;
    host.innerHTML = list
      .map(
        (r) =>
          `<div class="ribbon-row${r.earned ? ' earned' : ''}"><span class="ribbon-name">${r.name}</span><span class="ribbon-how">${r.how}</span><span class="ribbon-perk">${r.perk}</span></div>`
      )
      .join('');
  }

  // -------------------------------------------------------------------- score
  const SCORE_KEY = 'myth-and-blood-scores-v1';
  const SCORE_DIFFICULTY = { baby: 0.5, normal: 1, chad: 1.5, doomslayer: 2 };
  const SCORE_LABELS = { baby: 'Baby', normal: 'Normal', chad: 'Chad', doomslayer: 'Hellbane' };
  const SCORE_PER_WAVE = 100;
  const SCORE_PER_KILL = 5;
  const SCORE_PER_BREACH = 40;
  const SCORE_PER_LOSS = 15;

  /**
   * Run score. Waves and kills earn points, breaches and dead soldiers cost them, and the
   * total is multiplied for the difficulty and for every Advanced Difficulty modifier
   * (a modifier worth +18% difficulty multiplies by 1.18, one worth -12% by 0.88).
   * @param {{ waves?: number, kills?: number, breaches?: number, lost?: number,
   *   difficulty?: string, modifiers?: { id?: string, label?: string, pct?: number }[] }} input
   */
  function computeScore(input) {
    const waves = Math.max(0, Math.floor(input.waves || 0));
    const kills = Math.max(0, Math.floor(input.kills || 0));
    const breaches = Math.max(0, Math.floor(input.breaches || 0));
    const lost = Math.max(0, Math.floor(input.lost || 0));
    const earned = waves * SCORE_PER_WAVE + kills * SCORE_PER_KILL;
    const penalty = breaches * SCORE_PER_BREACH + lost * SCORE_PER_LOSS;
    const base = Math.max(0, earned - penalty);
    const difficulty = SCORE_DIFFICULTY[input.difficulty] ? input.difficulty : 'normal';
    const difficultyMult = SCORE_DIFFICULTY[difficulty];
    const modifiers = (input.modifiers || []).map((m) => ({
      label: m.label || m.id || 'Modifier',
      mult: Math.max(0.5, 1 + (Number(m.pct) || 0) / 100),
    }));
    let modifierMult = 1;
    for (const m of modifiers) modifierMult *= m.mult;
    modifierMult = Math.round(modifierMult * 1000) / 1000;
    return {
      waves,
      kills,
      breaches,
      lost,
      wavePoints: waves * SCORE_PER_WAVE,
      killPoints: kills * SCORE_PER_KILL,
      breachPenalty: breaches * SCORE_PER_BREACH,
      lossPenalty: lost * SCORE_PER_LOSS,
      base,
      difficulty,
      difficultyMult,
      modifiers,
      modifierMult,
      total: Math.round(base * difficultyMult * modifierMult),
    };
  }

  function loadScores() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SCORE_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function getBestScores() {
    const saved = loadScores();
    const out = {};
    for (const id in SCORE_DIFFICULTY) out[id] = Math.max(0, Math.floor(saved[id] || 0));
    return out;
  }

  /** Keep the best score for a difficulty. Returns true when this one is a new best. */
  function recordScore(score) {
    const best = getBestScores();
    if (!(score.total > (best[score.difficulty] || 0))) return false;
    best[score.difficulty] = score.total;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SCORE_KEY, JSON.stringify(best));
      }
    } catch (_) {
      /* storage unavailable */
    }
    return true;
  }

  function activeScoreModifiers() {
    if (typeof AdvancedDifficulty === 'undefined' || !AdvancedDifficulty.getActiveIds) return [];
    const ids = AdvancedDifficulty.getActiveIds();
    const defs = AdvancedDifficulty.getModifiers ? AdvancedDifficulty.getModifiers() : [];
    return ids.map((id) => defs.find((m) => m.id === id)).filter(Boolean);
  }

  /** Score the run that is ending. Creative runs are not scored. */
  function scoreRun(ctx) {
    if (!ctx || ctx.creative || !run.counted) return null;
    return computeScore({
      // The wave in progress when the realm fell does not count as cleared.
      waves: Math.max(0, (ctx.wave || 0) - (ctx.isNight ? 0 : 1)),
      kills: ctx.kills || 0,
      breaches: run.breaches,
      lost: ctx.soldiersLost || 0,
      difficulty: ctx.difficultyId || 'normal',
      modifiers: activeScoreModifiers(),
    });
  }

  function renderBestScores() {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('best-score-list');
    if (!host) return;
    const best = getBestScores();
    host.innerHTML = Object.keys(SCORE_DIFFICULTY)
      .map(
        (id) =>
          `<div class="ribbon-row${best[id] ? ' earned' : ''}"><span class="ribbon-name">${SCORE_LABELS[id]}</span><span class="ribbon-how">×${SCORE_DIFFICULTY[id]} score</span><span class="ribbon-perk">${best[id] ? best[id].toLocaleString('en-US') : '—'}</span></div>`
      )
      .join('');
  }

  // ------------------------------------------------------------ save and load
  function exportState() {
    return {
      breaches: run.breaches,
      edicts: [...run.edicts],
      drafts: run.drafts.map((d) => [...d]),
      cleanStreak: run.cleanStreak,
      flawless: run.flawless,
      warband: run.warband,
      counted: run.counted,
      fallen: run.fallen.slice(),
      stepsShown: [...run.stepsShown],
    };
  }

  function importState(snap, ctx) {
    run = freshRun();
    run.active = true;
    run.counted = snap ? snap.counted !== false : !ctx.creative;
    run.staged = !ctx.creative && !steps.veteran && !steps.skipped;
    // A loaded siege does not repeat lines the player has already been through.
    run.stepsShown = Array.isArray(snap?.stepsShown)
      ? snap.stepsShown.filter((id) => FIRST_STEPS.some((st) => st.id === id))
      : FIRST_STEPS.filter((st) => st.wave <= (ctx.wave || 0)).map((st) => st.id);
    run.warband = snap ? !!snap.warband : ctx.modeId === 'warband';
    run.creativeRun = !!ctx.creative;
    if (snap) {
      run.breaches = snap.breaches || 0;
      run.edicts = (snap.edicts || []).filter((id) => EDICTS[id]);
      run.drafts = (snap.drafts || []).filter((d) => Array.isArray(d) && d.length);
      run.cleanStreak = snap.cleanStreak || 0;
      run.flawless = snap.flawless || 0;
      run.fallen = Array.isArray(snap.fallen) ? snap.fallen : [];
    }
    fx = computeFx();
    if (ctx.isNight) run.preview = buildPreview(ctx);
    renderSpoils(ctx);
    syncHud(ctx);
  }

  /** The after-action report on the game-over screen: what this run was made of. */
  function renderAfterAction(ctx) {
    const host = el('result-siege');
    if (!host) return;
    const esc = (t) => String(t).replace(/[<>&]/g, '');
    const t = run.tally;
    const lines = [];
    if (ctx) lines.push(`Breaches: ${run.breaches} of ${breachLimit(ctx)} allowed`);
    lines.push(`Line-breakers cut down: ${t.runners}`);
    if (t.bosses) lines.push(`Warlords slain: ${t.bosses}`);
    lines.push(`Crates recovered: ${t.crates} · Waves called early: ${t.earlyCalls}`);
    if (run.edicts.length) {
      lines.push(`Spoils: ${run.edicts.map((id) => EDICTS[id].name).join(', ')}`);
    }
    if (t.bestVeteran) {
      lines.push(`Deadliest soldier: ${esc(t.bestVeteran.name)} — ${t.bestVeteran.kills} kills`);
    }
    let html = '';
    const score = run.score;
    if (score) {
      const n = (v) => v.toLocaleString('en-US');
      const rows = [
        `Waves cleared: ${score.waves} × ${SCORE_PER_WAVE} = +${n(score.wavePoints)}`,
        `Kills: ${score.kills} × ${SCORE_PER_KILL} = +${n(score.killPoints)}`,
        `Breaches conceded: ${score.breaches} × ${SCORE_PER_BREACH} = −${n(score.breachPenalty)}`,
        `Soldiers lost: ${score.lost} × ${SCORE_PER_LOSS} = −${n(score.lossPenalty)}`,
        `${SCORE_LABELS[score.difficulty]} difficulty: ×${score.difficultyMult}`,
      ];
      for (const m of score.modifiers) rows.push(`${m.label}: ×${m.mult.toFixed(2)}`);
      html +=
        `<h3>Score: ${n(score.total)}${run.scoreIsBest ? ' — new best' : ''}</h3>` +
        rows.map((l) => `<div>${esc(l)}</div>`).join('') +
        (run.scoreIsBest || !run.scoreBest
          ? ''
          : `<div>Best on ${SCORE_LABELS[score.difficulty]}: ${n(run.scoreBest)}</div>`);
    }
    html += '<h3>The siege in brief</h3>' + lines.map((l) => `<div>${esc(l)}</div>`).join('');
    if (run.fallen.length) {
      html +=
        '<h3>The fallen</h3>' +
        run.fallen
          .slice(-6)
          .map(
            (f) =>
              `<div>${esc(f.name)} — wave ${f.wave}, ${f.kills} kill${f.kills === 1 ? '' : 's'}, ${f.waves} wave${f.waves === 1 ? '' : 's'} served</div>`
          )
          .join('');
    }
    if (t.ribbons.length) {
      html += '<h3>Ribbons earned</h3>' + t.ribbons.map((n) => `<div>${esc(n)}</div>`).join('');
    }
    host.innerHTML = html;
  }

  function endRun(ctx) {
    if (ctx && ctx.ambience) ctx.ambience('off');
    if (run.active) {
      run.score = scoreRun(ctx);
      if (run.score) {
        run.scoreBest = getBestScores()[run.score.difficulty] || 0;
        run.scoreIsBest = recordScore(run.score);
      }
      try {
        renderBestScores();
        renderAfterAction(ctx);
      } catch (_) {
        /* partial DOM (headless harness) */
      }
    }
    run.active = false;
    run.staged = false;
    hideSpoils();
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('first-steps');
      for (const step of FIRST_STEPS) document.body.classList.remove(`fs-wait-${step.id}`);
    }
    if (typeof document !== 'undefined') {
      const strip = document.getElementById('siege-strip');
      if (strip) strip.hidden = true;
    }
    saveStore();
  }

  // --------------------------------------------------------------------- HUD
  let hudCtx = null;

  function el(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  function ensureHud() {
    if (typeof document === 'undefined' || !document.body) return null;
    let strip = el('siege-strip');
    if (strip) return strip;
    strip = document.createElement('div');
    strip.id = 'siege-strip';
    strip.hidden = true;
    strip.innerHTML =
      '<span id="siege-breaches" class="siege-chip" title="Enemies that got through your line. Pass the limit and the realm falls."></span>' +
      '<span id="siege-preview" class="siege-chip siege-preview"></span>' +
      '<button id="siege-warcry" class="siege-order" title="War Cry ([): soldiers near the General strike 20% harder for 8 seconds">War Cry</button>' +
      '<button id="siege-holdline" class="siege-order" title="Hold the Line (]): soldiers near the General take 40% less damage for 7 seconds">Hold the Line</button>' +
      '<span id="siege-edicts" class="siege-chip siege-edicts"></span>' +
      '<span id="siege-upkeep" class="siege-chip" title="A big host is hard to feed. Past 14 soldiers, every recruit costs 7% more per head."></span>';
    document.body.appendChild(strip);
    const spoils = document.createElement('div');
    spoils.id = 'spoils-panel';
    spoils.hidden = true;
    document.body.appendChild(spoils);
    const flash = document.createElement('div');
    flash.id = 'breach-flash';
    document.body.appendChild(flash);
    const card = document.createElement('div');
    card.id = 'boss-card';
    card.hidden = true;
    document.body.appendChild(card);
    strip.addEventListener('click', (e) => {
      const id = e.target && e.target.id;
      if (!hudCtx) return;
      if (id === 'siege-warcry') castOrder('warCry', hudCtx());
      else if (id === 'siege-holdline') castOrder('holdLine', hudCtx());
    });
    spoils.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-spoil]') : null;
      if (btn && hudCtx) claimSpoils(Number(btn.dataset.spoil), hudCtx());
    });
    return strip;
  }

  /** Give the HUD a way to reach live game data for button clicks. */
  function bindContext(getCtx) {
    hudCtx = getCtx;
  }

  function syncHud(ctx) {
    try {
      syncHudDom(ctx);
    } catch (_) {
      /* partial DOM (headless harness) */
    }
  }

  function syncHudDom(ctx) {
    const strip = ensureHud();
    if (!strip) return;
    strip.hidden = !run.active;
    if (!run.active) return;
    const intro = firstStepsState(ctx);
    const limit = breachLimit(ctx);
    const b = el('siege-breaches');
    if (b) {
      b.textContent = `Breaches ${run.breaches}/${limit}`;
      b.className = 'siege-chip' + (run.breaches >= limit - 1 ? ' danger' : '');
      b.hidden = ctx.creative || ctx.wave < RUNNER_FROM_WAVE - 1 || !intro.unlocked.breach;
    }
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      const cl = document.body.classList;
      cl.toggle('first-steps', intro.active);
      for (const step of FIRST_STEPS) cl.toggle(`fs-wait-${step.id}`, !intro.unlocked[step.id]);
    }
    const skipBtn = el('pause-skip-intro');
    if (skipBtn) skipBtn.hidden = !intro.active;
    // One breach from defeat: the edges of the screen stay red.
    const flash = el('breach-flash');
    if (flash && flash.classList) {
      flash.classList.toggle(
        'danger',
        !ctx.creative && run.breaches >= limit - 1 && run.breaches > 0
      );
    }
    const p = el('siege-preview');
    if (p) {
      const text = ctx.isNight ? previewText(run.preview) : '';
      p.textContent = text;
      p.hidden = !text;
    }
    const hasGeneral = !!ctx.general && ctx.general.hp > 0;
    const orders = [
      ['siege-warcry', 'War Cry', run.warCryReady],
      ['siege-holdline', 'Hold the Line', run.holdLineReady],
    ];
    for (const [id, label, readyAt] of orders) {
      const btn = el(id);
      if (!btn) continue;
      btn.hidden = !hasGeneral || !intro.unlocked.orders;
      const wait = Math.ceil((readyAt - ctx.tick) / 60);
      btn.disabled = wait > 0 || ctx.isNight;
      btn.textContent = wait > 0 ? `${label} ${wait}s` : label;
    }
    const up = el('siege-upkeep');
    if (up) {
      const pct = Math.round((deployCostMult(ctx.army || 0) / (run.warband ? 2 : 1) - 1) * 100);
      up.hidden = pct <= 0;
      up.textContent = `Recruit cost +${pct}%`;
    }
    const e = el('siege-edicts');
    if (e) {
      e.hidden = !run.edicts.length;
      e.textContent = `Spoils ${run.edicts.length}`;
      e.title = run.edicts.map((id) => `${EDICTS[id].name}: ${EDICTS[id].desc}`).join('\n');
    }
  }

  function renderSpoils() {
    try {
      renderSpoilsDom();
    } catch (_) {
      /* partial DOM (headless harness) */
    }
  }

  function renderSpoilsDom() {
    const panel = el('spoils-panel') || (ensureHud() && el('spoils-panel'));
    if (!panel) return;
    const draft = run.active ? run.drafts[0] : null;
    if (!draft) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    panel.innerHTML =
      '<div class="spoils-title">Spoils of war — choose one</div><div class="spoils-row">' +
      draft
        .map(
          (id, i) =>
            `<button class="spoils-card" data-spoil="${i}"><strong>${EDICTS[id].name}</strong><span>${EDICTS[id].desc}</span></button>`
        )
        .join('') +
      '</div><div class="spoils-note">The siege does not wait. Unclaimed spoils are chosen for you at dawn.</div>';
  }

  function hideSpoils() {
    const panel = el('spoils-panel');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
    }
  }

  function restartAnimation(node, cls) {
    try {
      node.classList.remove(cls);
      void node.offsetWidth;
      node.classList.add(cls);
    } catch (_) {
      /* partial DOM (headless harness) */
    }
  }

  function flashBreach() {
    const flash = el('breach-flash');
    if (flash && flash.classList) restartAnimation(flash, 'on');
  }

  function showBossCard(name, title) {
    const card = el('boss-card');
    if (!card || !card.classList) return;
    const safe = (t) => String(t || '').replace(/[<>&]/g, '');
    card.innerHTML = `<div class="boss-card-name">${safe(name) || 'Warlord'}</div><div class="boss-card-title">${safe(title)}</div>`;
    card.hidden = false;
    restartAnimation(card, 'on');
  }

  // ----------------------------------------------------------------- drawing
  /** Blood and remains that stay on the field. Drawn under the units. */
  function drawGround(ctx2d) {
    if (!run.active || !run.stains.length) return;
    ctx2d.save();
    for (const s of run.stains) {
      ctx2d.globalAlpha = s.scorch ? 0.62 : 0.5;
      ctx2d.fillStyle = s.scorch ? '#141012' : s.enemy ? '#4a0c0c' : '#5a1420';
      ctx2d.beginPath();
      ctx2d.ellipse(s.x, s.y, s.r * 1.5, s.r * 0.55, s.tilt, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.globalAlpha = 0.75;
      ctx2d.fillStyle = '#07050a';
      ctx2d.beginPath();
      ctx2d.ellipse(s.x - 1, s.y - 2, s.r * 0.8, s.r * 0.3, s.tilt * 2, 0, Math.PI * 2);
      ctx2d.fill();
    }
    ctx2d.restore();
  }

  /** Crates and the red pennants that mark line-breakers. */
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';

  /** Night: red chevrons on each edge the next wave will come from, with what to expect. */
  function drawSpawnMarkers(ctx2d, tick) {
    const ctx = hudCtx ? hudCtx() : null;
    const marks = ctx ? spawnMarkers(ctx) : null;
    if (!marks) return;
    const k = 1 / Math.max(0.5, ctx.viewScale || 1);
    const pulse = (tick % 90) / 90;
    for (const m of marks) {
      // perpendicular to the direction of advance
      const px = -m.dy;
      const py = m.dx;
      for (let i = 0; i < 3; i++) {
        // Past the label, so the top bar never covers them.
        const lead = (88 + i * 13 + pulse * 13) * k;
        const cx = m.x + m.dx * lead;
        const cy = m.y + m.dy * lead;
        const half = (16 - i * 3) * k;
        const back = 9 * k;
        ctx2d.globalAlpha = Math.max(0.15, 1 - (i + pulse) / 3);
        for (const [color, width] of [
          [INK, 6 * k],
          [BLOOD, 3 * k],
        ]) {
          ctx2d.strokeStyle = color;
          ctx2d.lineWidth = width;
          ctx2d.beginPath();
          ctx2d.moveTo(cx + px * half - m.dx * back, cy + py * half - m.dy * back);
          ctx2d.lineTo(cx, cy);
          ctx2d.lineTo(cx - px * half - m.dx * back, cy - py * half - m.dy * back);
          ctx2d.stroke();
        }
      }
      ctx2d.globalAlpha = 1;
      // The label sits inside the edge, clear of the HUD; the chevrons lead on from it.
      const lx = m.x + m.dx * 60 * k;
      const ly = m.y + m.dy * 60 * k;
      const head = `about ${m.count}`;
      const sub = m.names.join(', ');
      ctx2d.font = `bold ${Math.round(12 * k)}px Georgia, serif`;
      ctx2d.textAlign = 'center';
      const wide =
        Math.max(ctx2d.measureText(head).width, sub ? ctx2d.measureText(sub).width : 0) + 16 * k;
      const tall = (sub ? 34 : 20) * k;
      ctx2d.fillStyle = INK;
      ctx2d.fillRect(lx - wide / 2, ly - tall / 2, wide, tall);
      ctx2d.strokeStyle = BLOOD;
      ctx2d.lineWidth = 1.5 * k;
      ctx2d.strokeRect(lx - wide / 2, ly - tall / 2, wide, tall);
      ctx2d.fillStyle = BONE;
      ctx2d.fillText(head, lx, ly + (sub ? -3 : 4) * k);
      if (sub) {
        ctx2d.font = `${Math.round(10 * k)}px Georgia, serif`;
        ctx2d.fillText(sub, lx, ly + 11 * k);
      }
      if (m.boss) drawSkull(ctx2d, lx - px * (wide / 2 + 14 * k), ly - py * (tall / 2 + 14 * k), k);
    }
    ctx2d.textAlign = 'left';
  }

  function drawSkull(ctx2d, x, y, k) {
    ctx2d.fillStyle = BONE;
    ctx2d.strokeStyle = INK;
    ctx2d.lineWidth = 2 * k;
    ctx2d.beginPath();
    ctx2d.arc(x, y - 2 * k, 8 * k, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.stroke();
    ctx2d.fillRect(x - 4.5 * k, y + 3 * k, 9 * k, 6 * k);
    ctx2d.strokeRect(x - 4.5 * k, y + 3 * k, 9 * k, 6 * k);
    ctx2d.fillStyle = INK;
    ctx2d.fillRect(x - 5 * k, y - 4 * k, 3.5 * k, 4 * k);
    ctx2d.fillRect(x + 1.5 * k, y - 4 * k, 3.5 * k, 4 * k);
    ctx2d.fillStyle = BLOOD;
    ctx2d.fillRect(x - 0.8 * k, y + 0.5 * k, 1.6 * k, 2.5 * k);
  }

  function drawWorld(ctx2d, units, tick) {
    if (!run.active) return;
    ctx2d.save();
    drawSpawnMarkers(ctx2d, tick);
    // Shockwave rings from the General's orders.
    for (let i = run.rings.length - 1; i >= 0; i--) {
      const ring = run.rings[i];
      ring.age++;
      const k = ring.age / 36;
      if (k >= 1) {
        run.rings.splice(i, 1);
        continue;
      }
      ctx2d.strokeStyle = `rgba(${ring.color},${(1 - k) * 0.8})`;
      ctx2d.lineWidth = 4 * (1 - k) + 1;
      ctx2d.beginPath();
      ctx2d.arc(ring.x, ring.y, ring.max * (0.15 + 0.85 * k), 0, Math.PI * 2);
      ctx2d.stroke();
    }
    for (const c of run.crates) {
      if (c.spent) continue;
      const bob = Math.sin((tick + c.id * 40) / 18) * 1.5;
      ctx2d.fillStyle = '#07050a';
      ctx2d.fillRect(c.x - 10, c.y - 9 + bob, 20, 18);
      ctx2d.fillStyle = '#6a4a2a';
      ctx2d.fillRect(c.x - 8, c.y - 7 + bob, 16, 14);
      ctx2d.strokeStyle = '#e8dcc0';
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      ctx2d.moveTo(c.x - 8, c.y - 7 + bob);
      ctx2d.lineTo(c.x + 8, c.y + 7 + bob);
      ctx2d.moveTo(c.x + 8, c.y - 7 + bob);
      ctx2d.lineTo(c.x - 8, c.y + 7 + bob);
      ctx2d.stroke();
    }
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u.lineBreaker || u.hp <= 0) continue;
      const top = u.y - 30;
      ctx2d.strokeStyle = '#07050a';
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.moveTo(u.x, u.y - 14);
      ctx2d.lineTo(u.x, top);
      ctx2d.stroke();
      ctx2d.fillStyle = '#c01818';
      ctx2d.beginPath();
      ctx2d.moveTo(u.x, top);
      ctx2d.lineTo(u.x + 11, top + 4);
      ctx2d.lineTo(u.x, top + 8);
      ctx2d.closePath();
      ctx2d.fill();
      ctx2d.stroke();
    }
    ctx2d.restore();
  }

  function getHudState(ctx) {
    return {
      breaches: run.breaches,
      breachLimit: breachLimit(ctx),
      edicts: run.edicts.map((id) => EDICTS[id]?.name || id),
      pendingSpoils: run.drafts.length,
      spoilsChoices: run.drafts[0] ? [...run.drafts[0]] : [],
      preview: previewText(run.preview),
      crates: run.crates.filter((c) => !c.spent).map((c) => ({ x: c.x, y: c.y })),
      fallen: run.fallen.slice(),
      warband: run.warband,
      warCryReady: run.warCryReady,
      holdLineReady: run.holdLineReady,
      firstSteps: firstStepsState(ctx),
      spawnMarkers: spawnMarkers(ctx) || [],
    };
  }

  loadStore();
  loadSteps();
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', renderRibbonList);
    document.addEventListener('DOMContentLoaded', renderBestScores);
  }

  return {
    EDICTS,
    COUNTER_NOTES,
    startRun,
    endRun,
    isWarband,
    deployCostMult,
    applySpawnMods,
    tagEnemySpawn,
    unopposedBreaks,
    isMustering,
    noteCombat,
    breachGoal,
    onNightBegin,
    earlyCallBonus,
    onWaveStart,
    update,
    consumeSlowMoSkip,
    counterMult,
    modifyDamage,
    modifyDamageTaken,
    killXpBonus,
    onUnitDeath,
    castOrder,
    order: (kind) => (hudCtx ? castOrder(kind, hudCtx()) : false),
    claimSpoils,
    getRibbons,
    renderRibbonList,
    exportState,
    importState,
    bindContext,
    drawGround,
    drawWorld,
    getHudState,
    FIRST_STEPS,
    spawnMarkers,
    computeScore,
    getBestScores,
    recordScore,
    renderBestScores,
    lastScore: () => run.score || null,
    skipIntroduction,
    resetIntroduction,
    introductionStatus,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SiegeLoop = SiegeLoop;
