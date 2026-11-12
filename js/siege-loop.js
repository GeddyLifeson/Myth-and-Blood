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
    lastCombatTick: 0,
    lastEnemyCount: 0,
    nextId: 1,
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
    run.warband = ctx.menuModeId === 'warband';
    fx = computeFx();
    hideSpoils();
    syncHud(ctx);
    return run.counted ? fx.startTp : 0;
  }

  function isWarband() {
    return !!run.warband;
  }

  /** Warband: half as many soldiers, each worth far more. */
  function deployCostMult() {
    return run.warband ? 2 : 1;
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
    const chance = Math.min(0.36, (quick ? 0.2 : 0.1) + ctx.wave * 0.004);
    if (ctx.rng() >= chance) return;
    unit.lineBreaker = true;
    unit.stormLine = true;
    // Runners travel light: quicker than the rest of the host, and easier to cut down.
    unit.speed *= 1.3 * Math.max(0.5, 1 - fx.runnerSlow);
    unit.maxHp = Math.max(1, Math.floor(unit.maxHp * 0.8));
    unit.hp = unit.maxHp;
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
    ctx.playSfx('gateHit');
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
    ctx.playSfx('reinforce');
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
    const count = Math.max(1, Math.round((cfg.count || 0) * (ctx.enemyCountMult || 1)));
    let kind = '';
    if (cfg.boss) kind = 'Boss wave';
    else if (typeof GameDepth !== 'undefined' && GameDepth.isHordeWave?.(next)) kind = 'Horde';
    return { wave: next, count, names, kind, runners: next >= RUNNER_FROM_WAVE };
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
    if (ctx.boss) showBossCard(ctx.boss.name, ctx.boss.title);
    syncHud(ctx);
  }

  // ------------------------------------------------------------------ crates
  function dropCrate(ctx) {
    const x = 60 + ctx.rng() * (ctx.worldW - 120);
    const top = Math.max(120, ctx.worldH * 0.3);
    const y = top + ctx.rng() * Math.max(40, ctx.deployY - 30 - top);
    run.crates.push({ id: run.nextId++, x, y, age: 0, spent: false });
    ctx.float(x, y - 14, 'SUPPLIES', '#e8dcc0');
  }

  function openCrate(crate, opener, ctx) {
    crate.spent = true;
    if (run.counted) {
      store.stats.crates++;
      checkRibbons(ctx);
      saveStore();
    }
    const roll = ctx.rng();
    if (roll < 0.14 && !fx.safeCrates && ctx.wave >= 3) {
      ctx.float(crate.x, crate.y - 14, 'AMBUSH!', '#ff4040');
      ctx.showMessage('The crate was bait — goblins spring the ambush!', 200);
      ctx.playSfx('bossWarn');
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
    ctx.playSfx('deployConfirm');
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
          if (u.lineBreaker && hasBreached(u, ctx)) recordBreach(u, ctx);
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
    if (tick % 20 === 0) syncHud(ctx);
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
      ctx.playSfx('horseCharge');
    } else {
      run.holdLineReady = tick + HOLD_LINE_COOLDOWN;
      ctx.float(general.x, general.y - 30, 'HOLD THE LINE', '#c0d8ff');
      ctx.playSfx('reinforce');
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
      if (ctx) {
        ctx.showMessage(`Ribbon earned: ${r.name} — ${r.perk} on every future run.`, 320);
        ctx.playSfx('buildComplete');
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
    };
  }

  function importState(snap, ctx) {
    run = freshRun();
    run.active = true;
    run.counted = snap ? snap.counted !== false : !ctx.creative;
    run.warband = snap ? !!snap.warband : ctx.modeId === 'warband';
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

  function endRun() {
    run.active = false;
    hideSpoils();
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
      '<span id="siege-edicts" class="siege-chip siege-edicts"></span>';
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
    const limit = breachLimit(ctx);
    const b = el('siege-breaches');
    if (b) {
      b.textContent = `Breaches ${run.breaches}/${limit}`;
      b.className = 'siege-chip' + (run.breaches >= limit - 1 ? ' danger' : '');
      b.hidden = ctx.creative || ctx.wave < RUNNER_FROM_WAVE - 1;
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
      btn.hidden = !hasGeneral;
      const wait = Math.ceil((readyAt - ctx.tick) / 60);
      btn.disabled = wait > 0 || ctx.isNight;
      btn.textContent = wait > 0 ? `${label} ${wait}s` : label;
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
      ctx2d.globalAlpha = 0.5;
      ctx2d.fillStyle = s.enemy ? '#4a0c0c' : '#5a1420';
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
  function drawWorld(ctx2d, units, tick) {
    if (!run.active) return;
    ctx2d.save();
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
    };
  }

  loadStore();
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', renderRibbonList);
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
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SiegeLoop = SiegeLoop;
