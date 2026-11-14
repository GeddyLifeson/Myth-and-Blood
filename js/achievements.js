/**
 * Achievements: counters fed by game events, unlocks, the toast queue and the grouped panel.
 * The list lives in js/achievements-data.js; every entry is a counter and a goal.
 */
const Achievements = (() => {
  const STORAGE_KEY = 'myth-and-blood-achievements-v3';
  const SAVE_VERSION = 4;
  const LIST = ACHIEVEMENT_LIST;
  const BY_ID = new Map(LIST.map((a) => [a.id, a]));
  const FAMILIES = ACHIEVEMENT_FAMILIES;
  const STRIKES = ['fireball', 'lightning', 'heal', 'reinforce', 'rally', 'dispel'];
  const CHAD_PLUS = new Set(['chad', 'doomslayer']);

  // Entries by counter, so an event only re-checks the achievements it can change.
  const BY_COUNTER = new Map();
  const X_RULES = [];
  for (const a of LIST) {
    if (a.s === 'x') X_RULES.push(a);
    else {
      const key = `${a.s}:${a.k}`;
      if (!BY_COUNTER.has(key)) BY_COUNTER.set(key, []);
      BY_COUNTER.get(key).push(a);
    }
  }

  let unlocked = new Set();
  let retired = new Set();
  let recentUnlocked = [];
  let life = {};
  let lifeSets = {};
  let lifetimeEnemyKills = {};
  let lifetimeKills = 0;
  let lifetimeWavesCleared = 0;
  let lifetimeTrueVictories = 0;
  let crossoverKills = {};
  let crossoverAbilities = {};
  let crossoverMastery = {};
  let doomLifetimeKills = 0;
  let doomMaxAliveWaves = 0;
  let doomAliveWaves = 0;
  let hiddenMilestones = 0;
  let quiet = false;
  const touched = new Set();
  const written = new Set();

  let run = {};
  let runSets = {};
  let wave = {};
  let session = {};
  let lastSiege = null;

  // Panel state.
  let searchQuery = '';
  let unlockedOnly = false;
  let openGroups = null;

  // ------------------------------------------------------------------ counters
  function touch(k) {
    for (const key of [`r:${k}`, `l:${k}`]) {
      touched.add(key);
      written.add(key);
    }
  }

  /** Add to a counter in this run and in the save. */
  function add(k, n = 1) {
    run[k] = (run[k] || 0) + n;
    life[k] = (life[k] || 0) + n;
    touch(k);
  }

  /** Keep the best value seen, per run and across runs. */
  function best(k, v) {
    if (v > (run[k] || 0)) run[k] = v;
    if (v > (life[k] || 0)) life[k] = v;
    touch(k);
  }

  /** Count distinct members of a set, per run and across runs. */
  function member(k, id) {
    (runSets[k] ||= new Set()).add(id);
    (lifeSets[k] ||= new Set()).add(id);
    run[k] = runSets[k].size;
    life[k] = lifeSets[k].size;
    touch(k);
  }

  function value(s, k) {
    if (s === 'l') {
      if (k === 'kills') return lifetimeKills;
      if (k === 'waves') return lifetimeWavesCleared;
      if (k === 'victories') return lifetimeTrueVictories;
      if (k.startsWith('mastery.')) return crossoverMastery[k.slice(8)] || 0;
      return life[k] || 0;
    }
    return run[k] || 0;
  }

  function freshRun() {
    run = {};
    runSets = {};
    wave = { breaches: 0, runnerKills: 0, blastKills: 0, medSaves: 0, orders: new Set() };
    lastSiege = null;
    session = {
      kills: 0,
      maxWave: 0,
      deployedTypes: new Set(),
      flags: new Set(),
      currentDiff: 'normal',
      currentMisses: 0,
      footmanGeneralPipeline: new Set(),
      enemyStructuresRazed: 0,
      moraleSamplesTotal: 0,
      moraleSamplesHigh: 0,
      meleeSamplesTotal: 0,
      meleeSamplesFocused: 0,
      crossoverHeroRecruits: new Set(),
      standAllianceSamplesTotal: 0,
      standAllianceSamplesAllied: 0,
      standAllianceMultiFactionSamples: 0,
      showmanshipAbilityUses: 0,
      showmanshipSamplesTotal: 0,
      showmanshipSamplesHeavy: 0,
      planetBossKiRatio: 0,
      namedBossWavesRepelled: 0,
      pathImmortals: new Set(),
    };
    doomAliveWaves = 0;
  }

  // --------------------------------------------------------------- save / load
  function load() {
    let data;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) {
        const v2 = JSON.parse(localStorage.getItem('myth-and-blood-achievements-v2') || 'null');
        if (v2) data = { unlocked: v2.unlocked, lifetimeSpy: v2.lifetimeSpy, ...v2 };
      }
    } catch (_) {
      data = null;
    }
    if (!data) return;
    life = data.life || {};
    lifeSets = {};
    for (const [k, arr] of Object.entries(data.lifeSets || {})) lifeSets[k] = new Set(arr);
    if (data.lifetimeSpy?.length && !lifeSets.spy) {
      lifeSets.spy = new Set(data.lifetimeSpy);
      life.spy = lifeSets.spy.size;
    }
    recentUnlocked = data.recentUnlocked || [];
    lifetimeEnemyKills = data.lifetimeEnemyKills || {};
    lifetimeKills = data.lifetimeKills || 0;
    lifetimeWavesCleared = data.lifetimeWavesCleared || 0;
    lifetimeTrueVictories = data.lifetimeTrueVictories || 0;
    crossoverKills = data.crossoverKills || {};
    crossoverAbilities = data.crossoverAbilities || {};
    crossoverMastery = data.crossoverMastery || {};
    doomLifetimeKills = data.doomLifetimeKills || 0;
    doomMaxAliveWaves = data.doomMaxAliveWaves || 0;
    hiddenMilestones = data.hiddenMilestones || 0;
    retired = new Set(data.retired || []);
    unlocked = new Set();
    for (const id of data.unlocked || []) {
      if (BY_ID.has(id) && (data.v || 0) >= SAVE_VERSION) unlocked.add(id);
      else carryOver(id);
    }
    if ((data.v || 0) < SAVE_VERSION) {
      // Old counters may already satisfy new lifetime goals; credit them without a toast.
      quiet = true;
      for (const a of LIST) if (a.s === 'l') touched.add(`l:${a.k}`);
      checkTouched();
      quiet = false;
      save();
    }
  }

  /** An id from the old 1,450 list: kept if it maps onto the new list, retired if not. */
  function carryOver(id) {
    const mapped = mapLegacyAchievementId(id);
    if (mapped.length) for (const m of mapped) unlocked.add(m);
    else retired.add(id);
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: SAVE_VERSION,
          unlocked: [...unlocked],
          retired: [...retired],
          recentUnlocked: recentUnlocked.slice(0, 12),
          life,
          lifeSets: Object.fromEntries(Object.entries(lifeSets).map(([k, s]) => [k, [...s]])),
          lifetimeEnemyKills,
          lifetimeKills,
          lifetimeWavesCleared,
          lifetimeTrueVictories,
          crossoverKills,
          crossoverAbilities,
          crossoverMastery,
          doomLifetimeKills,
          doomMaxAliveWaves,
          hiddenMilestones,
        })
      );
    } catch (_) {
      /* storage unavailable */
    }
  }

  // ----------------------------------------------------------------- unlocking
  /** A run with a cheat or in the sandbox earns nothing, whoever asks. */
  function isVoid() {
    if (typeof Game === 'undefined') return false;
    return !!(Game.cheatsUsed?.() || Game.isCreativeMode?.());
  }

  function unlock(id) {
    if (unlocked.has(id)) return null;
    const ach = BY_ID.get(id);
    if (!ach || isVoid()) return null;
    unlocked.add(id);
    recentUnlocked = [
      { id, name: ach.name, tier: ach.tier, at: Date.now() },
      ...recentUnlocked.filter((r) => r.id !== id),
    ].slice(0, 12);
    save();
    if (!quiet) queueToast(ach);
    return ach;
  }

  function tryUnlock(id) {
    return unlock(id);
  }

  function checkTouched() {
    for (const key of touched) {
      for (const a of BY_COUNTER.get(key) || []) {
        if (!unlocked.has(a.id) && value(a.s, a.k) >= a.n) unlock(a.id);
      }
    }
    touched.clear();
  }

  function checkRules() {
    for (const a of X_RULES) if (!unlocked.has(a.id) && evaluateRule(a.k)) unlock(a.id);
  }

  // --------------------------------------------------------------------- toasts
  const toastQueue = [];
  let toastBusy = false;
  const TOAST_MS = 2600;
  const TOAST_GAP_MS = 300;

  function queueToast(ach) {
    toastQueue.push(ach);
    if (!toastBusy) showNextToast();
  }

  function showNextToast() {
    const ach = toastQueue.shift();
    const el =
      typeof document !== 'undefined' ? document.getElementById('achievement-toast') : null;
    if (!ach || !el) {
      toastBusy = false;
      toastQueue.length = 0;
      return;
    }
    toastBusy = true;
    const set = (sel, text) => {
      const n = el.querySelector(sel);
      if (n) n.textContent = text;
    };
    set('.ach-toast-label', 'ACHIEVEMENT');
    set('.ach-toast-name', fill(ach.name));
    set('.ach-toast-desc', fill(ach.desc));
    const tierEl = el.querySelector('.ach-toast-tier');
    if (tierEl) {
      tierEl.textContent = ach.tier ? ACHIEVEMENT_TIERS[ach.tier] : '';
      tierEl.className = `ach-toast-tier${ach.tier ? ` tier-${ach.tier}` : ''}`;
      tierEl.style.display = ach.tier ? '' : 'none';
    }
    set('.ach-toast-reward', ach.reward ? `Reward: ${rewardText(ach.reward)}` : '');
    const rewardEl = el.querySelector('.ach-toast-reward');
    if (rewardEl) rewardEl.style.display = ach.reward ? '' : 'none';
    const c = getCount();
    set('.ach-toast-progress', `${c.unlocked} / ${c.total}`);
    el.classList.toggle('toast-gold', ach.tier === 'gold');
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show', 'toast-gold');
      setTimeout(showNextToast, TOAST_GAP_MS);
    }, TOAST_MS);
  }

  function rewardText(r) {
    if (r.type === 'title') return `title "${r.label}"`;
    if (r.type === 'skin') return 'a unit skin';
    if (r.type === 'theme') return 'a victory theme';
    return 'an order title';
  }

  // ------------------------------------------------------------- name filling
  const NAMES = {
    unit: (id) => globalThis.UnitDefs?.[id]?.name,
    enemy: (id) => globalThis.EnemyDefs?.[id]?.name,
    build: (id) => globalThis.BuildDefs?.[id]?.name,
    boss: (id) => globalThis.MonsterBosses?.BOSS_ROSTER?.find((b) => b.type === id)?.name,
    faction: (id) => globalThis.EnemyFactions?.getFactionDef?.(id)?.name,
    diff: (id) => globalThis.DIFFICULTIES?.[id]?.label,
    mode: (id) => globalThis.GameModes?.MODES?.find((m) => m.id === id)?.label,
    order: (id) => globalThis.FactionDepth?.constructor?.PROFILES?.[id]?.label,
    edict: (id) => globalThis.SiegeLoop?.EDICTS?.[id]?.name,
  };

  function nameOf(kind, id) {
    let v;
    try {
      v = NAMES[kind]?.(id);
    } catch (_) {
      v = null;
    }
    return v || id.replace(/_/g, ' ');
  }

  /** Fill {kind:id} tokens from the game data so a rename shows up by itself. */
  function fill(text) {
    return String(text).replace(/\{([a-z]+):([a-z0-9_]+)\}/g, (_, kind, id) => nameOf(kind, id));
  }

  // ------------------------------------------------------------------- mastery
  function addMastery(faction, pts) {
    crossoverMastery[faction] = (crossoverMastery[faction] || 0) + pts;
    hiddenMilestones = Math.floor(Object.values(crossoverMastery).reduce((s, v) => s + v, 0) / 500);
    touch(`mastery.${faction}`);
  }

  function getUnitFaction(unitType) {
    if (typeof isWweUnit === 'function' && isWweUnit(unitType)) return 'wwe';
    if (unitType === 'doomslayer_hero') return 'doom';
    const def = typeof getCrossoverDef === 'function' ? getCrossoverDef(unitType) : null;
    return def?.faction || null;
  }

  function countField(units) {
    const factions = new Set();
    for (const u of units || []) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      const f = getUnitFaction(u.type);
      if (f) factions.add(f);
    }
    return factions;
  }

  // -------------------------------------------------------------------- events
  function onKill(d) {
    session.kills++;
    lifetimeKills++;
    add('kills');
    if (d.elite) add('elites');
    if (d.enemyType) lifetimeEnemyKills[d.enemyType] = (lifetimeEnemyKills[d.enemyType] || 0) + 1;
    wave.killedTypes ||= {};
    if (d.enemyType) wave.killedTypes[d.enemyType] = (wave.killedTypes[d.enemyType] || 0) + 1;
    const t = d.killerType;
    if (d.boss) {
      add('bossKills');
      if (d.enemyType) {
        add(`boss.${d.enemyType}`);
        member('bossKinds', d.enemyType);
      }
      if (t === 'sapper' && d.cause === 'blast') add('bossBlastKills');
    }
    if (d.runner) {
      add('runnerKills');
      wave.runnerKills++;
      best('waveRunnerKills', wave.runnerKills);
      if (d.held) add('runnerHeldKills');
      if (d.cause === 'blast') add('runnerBlastKills');
      if (d.killerGeneral) add('generalRunnerKills');
    }
    if (d.held) add('heldKills');
    if (d.hunting) add('huntKills');
    if (d.killerHonored && d.killerKills) best('namedVetKills', d.killerKills);
    if (t && d.killerKills && t !== 'doomslayer_hero') best('vetKills', d.killerKills);
    if (t) {
      add(`typeKills.${t}`);
      const sig = ACHIEVEMENT_SIGNATURES[t];
      if (sig) {
        const hit =
          (sig.types && sig.types.includes(d.enemyType)) ||
          (sig.runner && d.runner) ||
          (sig.charge && d.charging);
        if (hit) add(`sig.${t}`);
      }
      if (t === 'sapper' && d.cause === 'blast') {
        add('blastKills');
        wave.blastKills++;
        best('waveBlastKills', wave.blastKills);
      }
      if (
        t === 'sapper' &&
        (d.siege || d.enemyType === 'iron_colossus' || d.enemyType === 'hellmortar_pack')
      ) {
        add('sapperSiege');
      }
      if (t === 'cavalry' && d.charging) session.flags.add('cavalry_charge');
    }
    const kf = getUnitFaction(t);
    if (kf) {
      crossoverKills[kf] = (crossoverKills[kf] || 0) + 1;
      addMastery(kf, 1);
    }
    if (t === 'doomslayer_hero') {
      doomLifetimeKills++;
      addMastery('doom', 2);
    }
    touch('kills');
  }

  function onWaveComplete(d) {
    const w = d.wave || 0;
    session.maxWave = Math.max(session.maxWave, w);
    session.currentMisses = d.playerDeaths ?? d.misses ?? 0;
    lifetimeWavesCleared++;
    touch('waves');
    best('wave', w);
    const units = (d.units || []).filter((u) => u.team === 'player' && u.hp > 0);
    const diff = d.difficulty || session.currentDiff;
    best(`diff.${diff}`, w);
    if (d.modeId) {
      best(`mode.${d.modeId}`, w);
      if (d.modeId === 'academy_era') add('modeCleared.academy_era');
    }
    if (d.ironman) best('ironmanWave', w);
    if (w >= 15) best('modsAtWave15', d.advancedMods || 0);
    if (d.bossWave) session.flags.add('boss_clear');
    if (d.armySize === 1) {
      session.flags.add('last_stand');
      add('lastOneWaves');
    }

    // Line: breaches, brink and recovery.
    const leaked = wave.breaches;
    const siege = lastSiege;
    if (siege) {
      best('cleanStreak', siege.cleanStreak);
      best('flawlessStreak', siege.flawless);
      if (siege.left === 0) {
        run.brinkStreak = (run.brinkStreak || 0) + 1;
        add('brinkClears');
      } else run.brinkStreak = 0;
      best('brinkStreak', run.brinkStreak || 0);
      if (run.hadBreach && leaked === 0) run.recover = (run.recover || 0) + 1;
      else run.recover = 0;
      best('recoverStreak', run.recover);
      if (d.bossWave && leaked === 0) {
        add('bossCleanWaves');
        if (!(d.playerCasualtiesThisWave > 0)) add('bossFlawlessWaves');
      }
    }
    if (leaked === 0) add('cleanWaves');
    if (leaked >= 3) add('leakyWaves');
    wave.breaches = 0;

    // Veterans and the army as it stands at dawn.
    let oldest = 0;
    let topKills = 0;
    let vets10 = 0;
    let healerOldest = 0;
    let held = 0;
    let generalAlive = false;
    const kinds = new Set();
    for (const u of units) {
      if (u.isDoomslayer) continue;
      const ws = u.wavesSurvived || 0;
      if (u.isGeneral) generalAlive = true;
      else kinds.add(u.type);
      if (!u.isGeneral) {
        oldest = Math.max(oldest, ws);
        topKills = Math.max(topKills, u.kills || 0);
        if (ws >= 10) vets10++;
        if (u.type === 'healer') healerOldest = Math.max(healerOldest, ws);
        if (u.stretcherSaves > 0 && ws >= 10) life.secondWind = Math.max(life.secondWind || 0, 1);
      }
      if (Number.isFinite(u.holdX)) held++;
    }
    best('vetOldest', oldest);
    best('vetKills', topKills);
    best('vets10', vets10);
    best('healerOldest', healerOldest);
    touch('secondWind');
    if (held >= 5) add('holdWaves');
    if (generalAlive) add('generalWaves');
    if (session.flags.has('general_fell')) add('wavesAfterGeneralFell');
    if (w > 8 && units.length >= 8 && kinds.size === 1) add('oneKindWaves');
    best('walls', d.wallCount || 0);
    if (wave.orders.has('warCry') && wave.orders.has('holdLine')) add('bothOrders');
    wave.orders = new Set();
    wave.medSaves = 0;

    // Enemy hosts met this wave.
    const seenFactions = {};
    for (const [type, n] of Object.entries(wave.killedTypes || {})) {
      const f = globalThis.EnemyFactions?.getUnitFaction?.(type);
      if (f) seenFactions[f] = (seenFactions[f] || 0) + n;
    }
    for (const [f, n] of Object.entries(seenFactions)) if (n >= 5) add(`faction.${f}`);
    wave.killedTypes = {};

    // Research is counted from the research tree at dawn.
    try {
      const done = globalThis.Research?.getSnapshot?.().completed || [];
      best('research', done.length);
      for (const id of done) member('researchKinds', id);
    } catch (_) {
      /* research optional */
    }

    // Allied orders: mastery for each order on the field, and the Doomslayer trial.
    const field = countField(d.units);
    session.maxCrossoverFactions = Math.max(session.maxCrossoverFactions || 0, field.size);
    for (const f of field) addMastery(f, 10);
    if (w >= 200 && diff === 'doomslayer') {
      MetaProgress.unlockDoomslayerHero();
      session.flags.add('doom_trial');
    }
    if (w >= 150 && diff === 'doomslayer' && !session.flags.has('zombie_building_lost')) {
      MetaProgress.unlock115();
    }
    const doomOn = d.units?.some((u) => u.type === 'doomslayer_hero' && u.hp > 0);
    if (doomOn) {
      doomAliveWaves++;
      doomMaxAliveWaves = Math.max(doomMaxAliveWaves, doomAliveWaves);
    } else doomAliveWaves = 0;
    showWaveSummary();
  }

  /** Open an order's building when its trial is won (unchanged from the old rules). */
  function onVictory(data, type) {
    session.flags.add('run_victory');
    if (data.hasCastleCompound) session.flags.add('has_castle_compound');
    const s = session;
    const ratio = (a, b) => b >= 8 && a / b >= 0.55;
    const castle = s.flags.has('has_castle_compound') && !s.flags.has('castle_compound_breached');
    if (castle) MetaProgress.unlockPrimus();
    if (
      s.flags.has('had_general') &&
      !s.flags.has('general_fell') &&
      s.flags.has('footman_promoted_general') &&
      s.footmanGeneralPipeline.size >= 5
    ) {
      MetaProgress.unlockHalo();
    }
    if (s.enemyStructuresRazed >= 12) MetaProgress.unlockGears();
    if (ratio(s.moraleSamplesHigh, s.moraleSamplesTotal)) MetaProgress.unlockLotr();
    if (CHAD_PLUS.has(s.currentDiff) && ratio(s.meleeSamplesFocused, s.meleeSamplesTotal)) {
      MetaProgress.unlockBaki();
    }
    if (
      s.crossoverHeroRecruits.size >= 3 &&
      ratio(s.standAllianceSamplesAllied, s.standAllianceSamplesTotal)
    ) {
      MetaProgress.unlockJojo();
    }
    if (s.flags.has('solo_hero_named_boss')) MetaProgress.unlockFotns();
    if (s.flags.has('planet_boss_high_ki')) MetaProgress.unlockDragonball();
    if (ratio(s.showmanshipSamplesHeavy, s.showmanshipSamplesTotal))
      MetaProgress.unlockWweAcademy();
    if (
      CHAD_PLUS.has(s.currentDiff) &&
      s.flags.has('fort_line_established') &&
      !s.flags.has('fort_line_breached') &&
      s.flags.has('had_general') &&
      !s.flags.has('general_fell') &&
      s.namedBossWavesRepelled >= 3
    ) {
      MetaProgress.unlockWarhammer();
    }
    if (
      s.maxWave >= 100 &&
      ['martial', 'arcane', 'tech', 'mythic'].every((p) => s.pathImmortals.has(p)) &&
      s.flags.has('dragon_boss_slay')
    ) {
      MetaProgress.unlockTes();
    }
    if (type === 'campaign_victory') {
      lifetimeTrueVictories++;
      touch('victories');
    }
  }

  function onEvent(type, data = {}) {
    if (isVoid()) return;
    switch (type) {
      case 'game_start':
        freshRun();
        session.currentDiff = data.difficulty || 'normal';
        break;

      case 'kill':
        if (data.namedBoss) break;
        onKill(data);
        break;

      case 'breach':
        wave.breaches++;
        run.hadBreach = true;
        add('breaches');
        break;

      case 'siege_wave':
        lastSiege = data;
        break;

      case 'wave_complete':
        onWaveComplete(data);
        break;

      case 'tally':
        if (data.k) {
          add(data.k, data.n || 1);
          if (data.k === 'medSaves') {
            wave.medSaves++;
            best('waveMedSaves', wave.medSaves);
          }
          if (data.k === 'warCry' || data.k === 'holdLine') wave.orders.add(data.k);
        }
        break;

      case 'edict':
        if (data.id) {
          add('edicts');
          member('edictKinds', data.id);
          best('edictStack', data.stacks || 1);
          add(`edict.${data.id}`);
        }
        break;

      case 'deploy':
        session.deployedTypes.add(data.unitType);
        if (data.unitType) member('deployTypes', data.unitType);
        if (data.unitType === 'doomslayer_hero') session.flags.add('deploy_doomslayer_hero');
        break;

      case 'building_complete':
        if (data.buildType) {
          member('buildTypes', data.buildType);
          add(`build.${data.buildType}`);
        }
        if (data.buildType === 'castle' || data.compound) session.flags.add('has_castle_compound');
        break;

      case 'vet_event':
        if (data.event === 'honored' || data.event === 'honored_upgrade') add('honored');
        if (
          (data.vetTier || 0) >= (typeof MAX_VETERAN_TIER !== 'undefined' ? MAX_VETERAN_TIER : 6)
        ) {
          add('immortals');
          const pathId = globalThis.EternalPathFramework?.getPathForUnit?.(data.unitType, data);
          if (pathId) session.pathImmortals.add(pathId);
        }
        break;

      case 'castle_compound_breach':
        session.flags.add('castle_compound_breached');
        break;

      case 'footman_command_elevated':
        if (data.unitKey) session.footmanGeneralPipeline.add(data.unitKey);
        break;

      case 'footman_promoted_general':
        add('footmanGenerals');
        session.flags.add('footman_promoted_general');
        if (data.unitKey) session.footmanGeneralPipeline.add(data.unitKey);
        break;

      case 'general_fielded':
        session.flags.add('had_general');
        break;

      case 'general_fell':
        session.flags.add('general_fell');
        break;

      case 'general_stationed':
        add('generalStationed');
        break;

      case 'enemy_structure_razed':
        session.enemyStructuresRazed = Math.max(
          session.enemyStructuresRazed,
          data.runTotal ?? session.enemyStructuresRazed + 1
        );
        add('warCamps');
        break;

      case 'army_morale_sample':
        session.moraleSamplesTotal++;
        if (data.high) session.moraleSamplesHigh++;
        break;

      case 'army_melee_sample':
        session.meleeSamplesTotal++;
        if (data.focused) session.meleeSamplesFocused++;
        break;

      case 'stand_alliance_sample':
        session.standAllianceSamplesTotal++;
        if (data.allied) session.standAllianceSamplesAllied++;
        if (data.multiFaction) session.standAllianceMultiFactionSamples++;
        break;

      case 'army_showmanship_sample':
        session.showmanshipSamplesTotal++;
        if (data.heavy) session.showmanshipSamplesHeavy++;
        break;

      case 'solo_hero_boss_kill':
        if (data.solo) session.flags.add('solo_hero_named_boss');
        break;

      case 'planet_boss_ki_stand':
        if (data.high && (data.wave || 0) >= 200) {
          session.flags.add('planet_boss_high_ki');
          session.planetBossKiRatio = Math.max(session.planetBossKiRatio, data.ratio || 0);
        }
        break;

      case 'fortification_line_sample': {
        const count = data.count ?? 0;
        const minForts = data.minForts ?? 8;
        if (count >= minForts) session.flags.add('fort_line_established');
        if (session.flags.has('fort_line_established') && count < minForts) {
          session.flags.add('fort_line_breached');
        }
        break;
      }

      case 'named_boss_repelled':
        if (!session.flags.has('general_fell')) session.namedBossWavesRepelled++;
        break;

      case 'path_immortal_reached':
        if (data.pathId && (data.vetTier || 0) >= (globalThis.MAX_VETERAN_TIER || 6)) {
          session.pathImmortals.add(data.pathId);
        }
        break;

      case 'dragon_boss_slay':
        session.flags.add('dragon_boss_slay');
        break;

      case 'zombie_building_lost':
        session.flags.add('zombie_building_lost');
        break;

      case 'ability':
        if (STRIKES.includes(data.ability)) member('strikes', data.ability);
        break;

      case 'crossover_ability': {
        const f = data.faction || getUnitFaction(data.unitType);
        if (f) {
          crossoverAbilities[f] = (crossoverAbilities[f] || 0) + 1;
          addMastery(f, 3);
        }
        if (typeof isShowmanshipAbility === 'function' && isShowmanshipAbility(data.ability))
          session.showmanshipAbilityUses++;
        break;
      }

      case 'spy':
        if (data.action) member('spy', data.action);
        break;

      case 'mage_splash':
        if ((data.hitCount ?? 0) >= 3) add('mageSplash3');
        break;

      case 'wwe_recruit':
        if (data.wweId) session.crossoverHeroRecruits.add(data.wweId);
        MetaProgress.recordWweRecruit(data.wweId);
        addMastery('wwe', 15);
        break;

      case 'crossover_mastery_challenge':
        if (data.faction) addMastery(data.faction, 25);
        break;

      case 'crossover_recruit': {
        if (data.crossoverId) session.crossoverHeroRecruits.add(data.crossoverId);
        MetaProgress.recordCrossoverRecruit(data.crossoverId);
        const def = getCrossoverDef?.(data.crossoverId);
        if (def?.faction) addMastery(def.faction, 15);
        break;
      }

      case 'true_victory':
        break;

      case 'campaign_victory':
        onVictory(data, type);
        break;

      case 'game_end': {
        const total = globalThis.SiegeLoop?.lastScore?.()?.total || 0;
        if (total) best('score', total);
        if (data.victory) onVictory(data, type);
        else if ((data.wave || 0) < 2) add('fellEarly');
        break;
      }
    }
    checkTouched();
    if (type !== 'kill') checkRules();
    if (type === 'wave_complete' || type === 'game_end' || type === 'campaign_victory') save();
  }

  // ----------------------------------------------------------------- order rules
  const isChadPlus = (d) => CHAD_PLUS.has(d);

  function evaluateRule(rule) {
    if (!rule) return false;
    const [kind, ...rest] = rule.split(':');
    const s = session;
    const num = (i, d) => parseFloat(rest[i] ?? d);
    const ratio = (a, b, need) => b >= num(0, 8) && a / b >= need;
    switch (kind) {
      case 'run_doom_trial':
        return s.flags?.has('doom_trial');
      case 'diff_zombie_fortress':
        return (
          s.currentDiff === rest[0] && s.maxWave >= num(1) && !s.flags.has('zombie_building_lost')
        );
      case 'run_sanctum_victory':
        return (
          s.flags.has('run_victory') &&
          s.flags.has('has_castle_compound') &&
          !s.flags.has('castle_compound_breached')
        );
      case 'sanctum_intact':
        return (
          s.maxWave >= num(0) &&
          s.flags.has('has_castle_compound') &&
          !s.flags.has('castle_compound_breached')
        );
      case 'run_spartan_command':
        return (
          s.flags.has('run_victory') &&
          s.flags.has('had_general') &&
          !s.flags.has('general_fell') &&
          s.flags.has('footman_promoted_general') &&
          s.footmanGeneralPipeline.size >= num(0, 5)
        );
      case 'run_siege_victory':
        return s.flags.has('run_victory') && s.enemyStructuresRazed >= num(0, 12);
      case 'run_fellowship_morale':
        return (
          s.flags.has('run_victory') &&
          ratio(s.moraleSamplesHigh, s.moraleSamplesTotal, num(1, 0.55))
        );
      case 'run_martial_melee':
        return (
          s.flags.has('run_victory') &&
          isChadPlus(s.currentDiff) &&
          ratio(s.meleeSamplesFocused, s.meleeSamplesTotal, num(1, 0.55))
        );
      case 'run_stand_alliance':
        return (
          s.flags.has('run_victory') &&
          s.crossoverHeroRecruits.size >= num(2, 3) &&
          ratio(s.standAllianceSamplesAllied, s.standAllianceSamplesTotal, num(1, 0.55))
        );
      case 'run_hokuto_solo':
        return s.flags.has('run_victory') && s.flags.has('solo_hero_named_boss');
      case 'run_dragonball_ki':
        return (
          s.flags.has('run_victory') &&
          s.flags.has('planet_boss_high_ki') &&
          s.maxWave >= num(0, 200) &&
          s.planetBossKiRatio >= num(1, 0.55)
        );
      case 'run_wwe_showmanship':
        return (
          s.flags.has('run_victory') &&
          ratio(s.showmanshipSamplesHeavy, s.showmanshipSamplesTotal, num(1, 0.55))
        );
      case 'run_eternal_crusade':
        return (
          s.flags.has('run_victory') &&
          isChadPlus(s.currentDiff) &&
          s.flags.has('fort_line_established') &&
          !s.flags.has('fort_line_breached') &&
          s.flags.has('had_general') &&
          !s.flags.has('general_fell') &&
          s.namedBossWavesRepelled >= num(0, 3)
        );
      case 'run_dragonborn_legacy':
        return (
          s.flags.has('run_victory') &&
          s.maxWave >= num(0, 100) &&
          s.flags.has('dragon_boss_slay') &&
          ['martial', 'arcane', 'tech', 'mythic'].every((p) => s.pathImmortals.has(p))
        );
      // Hero-unlock milestones: no achievement uses them, the unlock tests read them.
      case 'enemy_structures_razed':
        return s.enemyStructuresRazed >= num(0);
      case 'morale_high_waves':
        return s.moraleSamplesHigh >= num(0);
      case 'melee_focus_waves':
        return s.meleeSamplesFocused >= num(0);
      case 'stand_alliance_waves':
        return s.standAllianceSamplesAllied >= num(0);
      case 'stand_multi_faction_waves':
        return s.standAllianceMultiFactionSamples >= num(0);
      case 'showmanship_heavy_waves':
        return s.showmanshipSamplesHeavy >= num(0);
      case 'showmanship_ability_uses':
        return s.showmanshipAbilityUses >= num(0);
      case 'named_boss_repels':
        return (s.namedBossWavesRepelled || 0) >= num(0);
      case 'solo_hero_named_boss':
      case 'planet_boss_high_ki':
      case 'dragon_boss_slay':
        return s.flags.has(kind);
      case 'unlock': {
        const name = { ultimis: '115', 115: '115', primis: 'Primus', primus: 'Primus' }[rest[0]];
        const key = name || rest[0].replace(/(^|_)(\w)/g, (_, _u, c) => c.toUpperCase());
        const fn = key === 'DoomHero' ? 'isDoomslayerHeroUnlocked' : `is${key}Unlocked`;
        return !!MetaProgress[fn]?.();
      }
      default:
        return false;
    }
  }

  // ------------------------------------------------------------------- queries
  function getAll() {
    return LIST.map((a) => ({
      ...a,
      unlocked: unlocked.has(a.id),
      visible: !a.hidden || unlocked.has(a.id),
    }));
  }

  function getCount() {
    return { unlocked: unlocked.size, total: LIST.length, target: ACHIEVEMENT_TARGET };
  }

  /** Cosmetics asks this so a skin reward is really granted. */
  function skinEarned(skinId) {
    return LIST.some(
      (a) => a.reward?.type === 'skin' && a.reward.id === skinId && unlocked.has(a.id)
    );
  }

  function earnedTitles() {
    return LIST.filter((a) => a.reward?.type === 'title' && unlocked.has(a.id)).map(
      (a) => a.reward.label
    );
  }

  function isUnlocked(id) {
    return unlocked.has(id);
  }

  function progressOf(a) {
    if (a.s === 'x') return unlocked.has(a.id) ? 1 : 0;
    return Math.min(1, value(a.s, a.k) / a.n);
  }

  /** Bronze / silver / gold steps of one ladder share a card; a lone entry is its own. */
  function cardsFor(familyId) {
    const cards = [];
    const byLadder = new Map();
    for (const a of getAll()) {
      if (a.family !== familyId) continue;
      if (a.ladder) {
        if (!byLadder.has(a.ladder)) {
          const card = { id: a.ladder, steps: [] };
          byLadder.set(a.ladder, card);
          cards.push(card);
        }
        byLadder.get(a.ladder).steps.push(a);
      } else cards.push({ id: a.id, steps: [a] });
    }
    return cards;
  }

  // --------------------------------------------------------------------- panel
  const esc = (t) =>
    String(t).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
    );

  function cardHtml(card, q) {
    const steps = card.steps;
    const shown = steps.filter((a) => a.visible);
    if (!shown.length) return '';
    const next = steps.find((a) => !a.unlocked) || steps[steps.length - 1];
    const doneCount = steps.filter((a) => a.unlocked).length;
    const target = next.visible ? next : shown[shown.length - 1];
    const text = `${fill(target.name)} ${fill(target.desc)}`.toLowerCase();
    if (q && !text.includes(q)) return '';
    if (unlockedOnly && !doneCount) return '';
    const done = doneCount === steps.length;
    const pct = Math.round(progressOf(target) * 100);
    const val =
      target.s === 'x'
        ? ''
        : `${Math.min(value(target.s, target.k), target.n).toLocaleString('en-US')} / ${target.n.toLocaleString('en-US')}`;
    const pips =
      steps.length > 1
        ? `<div class="ach2-pips">${steps
            .map(
              (a) =>
                `<span class="ach2-pip tier-${a.tier || 'none'}${a.unlocked ? ' on' : ''}" title="${esc(a.tier || '')}"></span>`
            )
            .join('')}</div>`
        : '';
    const hiddenLock = target.hidden && !target.unlocked;
    return `<div class="ach2-card ${done ? 'done' : doneCount ? 'part' : 'todo'}${target.tier ? ` tier-${target.tier}` : ''}" data-id="${esc(card.id)}">
      <div class="ach2-name">${hiddenLock ? 'Hidden' : esc(fill(target.name))}${pips}</div>
      <div class="ach2-desc">${hiddenLock ? 'Shown once earned.' : esc(fill(target.desc))}</div>
      ${done || hiddenLock ? '' : `<div class="ach2-bar"><div class="ach2-fill" style="width:${pct}%"></div></div><div class="ach2-val">${esc(val)}</div>`}
    </div>`;
  }

  function renderPanel() {
    const host = document.getElementById('achievements-grid');
    if (!host) return;
    const c = getCount();
    const pct = Math.round((c.unlocked / c.total) * 100);
    const set = (id, fn) => {
      const el = document.getElementById(id);
      if (el) fn(el);
    };
    set('achievements-count', (el) => (el.textContent = `${c.unlocked} / ${c.total}`));
    set('achievements-progress-fill', (el) => (el.style.width = `${pct}%`));
    set('achievements-progress-text', (el) => (el.textContent = `${pct}% complete`));
    for (const id of [
      'achievements-tabs',
      'achievements-crossover-tabs',
      'achievements-tier-filter',
    ]) {
      set(id, (el) => (el.style.display = 'none'));
    }
    set('achievements-recent', (el) => {
      el.innerHTML = recentUnlocked.length
        ? recentUnlocked
            .slice(0, 6)
            .map(
              (r) =>
                `<div class="ach-recent-card unlocked"><strong>${esc(fill(r.name))}</strong></div>`
            )
            .join('')
        : '<p class="ach-recent-empty">Nothing earned yet.</p>';
      const titles = earnedTitles();
      if (titles.length)
        el.innerHTML += `<p class="ach2-titles">Titles: ${titles.map(esc).join(', ')}</p>`;
    });
    const q = searchQuery.trim().toLowerCase();
    if (!openGroups) openGroups = new Set(FAMILIES.slice(0, 2).map((f) => f.id));
    const all = getAll();
    let html = '';
    let shownCards = 0;
    for (const fam of FAMILIES) {
      const members = all.filter((a) => a.family === fam.id);
      const got = members.filter((a) => a.unlocked).length;
      const visible = members.filter((a) => a.visible).length;
      const famPct = members.length ? Math.round((got / members.length) * 100) : 0;
      const cards = cardsFor(fam.id)
        .map((card) => cardHtml(card, q))
        .filter(Boolean);
      if ((q || unlockedOnly) && !cards.length) continue;
      shownCards += cards.length;
      const open = openGroups.has(fam.id) || !!q;
      html += `<section class="ach2-group${open ? ' open' : ''}" data-family="${fam.id}">
        <button type="button" class="ach2-head" aria-expanded="${open}">
          <span class="ach2-gname">${esc(fam.name)}</span>
          <span class="ach2-gcount">${got} / ${members.length}</span>
          <span class="ach2-gbar"><span class="ach2-gfill" style="width:${famPct}%"></span></span>
        </button>
        <p class="ach2-blurb">${esc(fam.blurb)}${visible < members.length ? ` ${members.length - visible} hidden.` : ''}</p>
        <div class="ach2-cards">${cards.join('')}</div>
      </section>`;
    }
    host.innerHTML = html || '<p class="ach-recent-empty">No achievement matches.</p>';
    set('ach-filter-count', (el) => (el.textContent = `Showing ${shownCards} achievement(s)`));
    host.querySelectorAll('.ach2-head').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fam = btn.parentElement.dataset.family;
        if (openGroups.has(fam)) openGroups.delete(fam);
        else openGroups.add(fam);
        renderPanel();
      });
    });
  }

  function showWaveSummary() {
    const el = document.getElementById('wave-summary-ach');
    if (!el) return;
    const c = getCount();
    const pct = Math.round((c.unlocked / c.total) * 100);
    const recent = recentUnlocked.slice(0, 3);
    el.innerHTML = `<div class="wave-sum-progress"><span>Achievements ${c.unlocked}/${c.total}</span>
      <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct}%"></div></div></div>
      ${recent.length ? `<div class="wave-sum-recent">Recent: ${recent.map((r) => esc(fill(r.name))).join(' · ')}</div>` : ''}`;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 4000);
  }

  function updateTopBar() {
    const c = getCount();
    const top = document.getElementById('ach-top-count');
    const fillEl = document.getElementById('ach-top-progress-fill');
    if (top) top.textContent = `${c.unlocked}/${c.total}`;
    if (fillEl) fillEl.style.width = `${Math.round((c.unlocked / c.total) * 100)}%`;
  }

  function togglePanel() {
    const panel = document.getElementById('achievements-screen');
    if (!panel) return;
    if (panel.classList.toggle('active')) renderPanel();
  }

  function init() {
    MetaProgress.load();
    freshRun();
    load();
    updateTopBar();
    const click = () => globalThis.AudioEngine?.SFX?.click?.();
    for (const id of ['achievements-btn', 'menu-achievements-btn']) {
      document.getElementById(id)?.addEventListener('click', () => {
        click();
        togglePanel();
      });
    }
    document.getElementById('achievements-close')?.addEventListener('click', () => {
      document.getElementById('achievements-screen')?.classList.remove('active');
    });
    document.getElementById('achievements-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPanel();
    });
    document.getElementById('achievements-unlocked-only')?.addEventListener('change', (e) => {
      unlockedOnly = e.target.checked;
      renderPanel();
    });
  }

  freshRun();

  return {
    init,
    onEvent,
    tryUnlock,
    isUnlocked,
    skinEarned,
    earnedTitles,
    getAll,
    getCount,
    renderPanel,
    togglePanel,
    resetSession: freshRun,
    evaluateRule,
    updateTopBar,
    fill,
    /** Counters the event handlers have written to, for the reachability test. */
    writtenCounters: () => new Set(written),
    /** Test hooks: the retired list and the toast queue length. */
    retiredIds: () => [...retired],
    pendingToasts: () => toastQueue.length,
    reload: load,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Achievements = Achievements;
