/**
 * Wave sectors, host composition, spawn queue and starting a wave.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameWaves = (() => {
  const {
    announceRtsEra,
    gameRandom,
    getDeployCostMult,
    getEnemyEconomySpawnBonus,
    getSpawnFillSeed,
    playSfx,
    svc,
    tryPlaceEnemyBuilding,
    updateEnemyRTS,
  } = GameCore;
  const GS = GameState;
  const {
    ensureInitialBattlefield,
    getLivingPlanetCtx,
    isHordeWave,
    isSiegeWave,
    sanitizeTactical,
    syncTerritory,
  } = GameField;
  const { addHighlight, applyPlayerStatMods, spawnUnit } = GameArmy;
  const { isTargetableEnemyStructure } = GameBuildings;
  let TP_SANITY_CAP,
    announceAcademyEra,
    announceAttackSides,
    announceHostGrowth,
    announceHooks,
    announceKingdomEvolution,
    applyChampionWaveStartPulse,
    emitWaveStartAssault,
    emitWaveStartPrep,
    floatStatus,
    getAsymmetricMods,
    getDifficulty,
    getProgressionRestartCtx,
    getResearchOpts,
    maybeCampaignNarrative,
    processAcademyTraining,
    resetWaveModifiers,
    showMessage,
    siegeCtx,
    tickSettlementWaveProgress,
    uiHooks,
    warCampCtx;
  function bind(api) {
    ({
      TP_SANITY_CAP,
      announceAcademyEra,
      announceAttackSides,
      announceHostGrowth,
      announceHooks,
      announceKingdomEvolution,
      applyChampionWaveStartPulse,
      emitWaveStartAssault,
      emitWaveStartPrep,
      floatStatus,
      getAsymmetricMods,
      getDifficulty,
      getProgressionRestartCtx,
      getResearchOpts,
      maybeCampaignNarrative,
      processAcademyTraining,
      resetWaveModifiers,
      showMessage,
      siegeCtx,
      tickSettlementWaveProgress,
      uiHooks,
      warCampCtx,
    } = api);
  }

  /** Where an enemy appears: on the top edge, inside its entry sector. */
  function spawnPosForSector(sector) {
    const mf = svc('MultiFrontSiege');
    const m = 24;
    let pos = {
      x:
        mf && mf.isSector(sector)
          ? mf.spawnX(sector, GS.worldW, globalThis.simRandom || Math.random)
          : m + (globalThis.simRandom || Math.random)() * (GS.worldW - m * 2),
      y: 8 + (globalThis.simRandom || Math.random)() * 20,
    };
    if (svc('BiomeSpawn')) {
      pos = svc('BiomeSpawn').biasSpawnPosition(
        pos,
        'north',
        GS.worldW,
        GS.worldH,
        getLivingPlanetCtx()
      );
    }
    return pos;
  }

  /** Kept for callers that still name an edge: every edge is the top edge now. */
  function spawnPosForSide(_side) {
    return spawnPosForSector(null);
  }

  function getWaveAttackSides() {
    return ['north'];
  }

  function sectorWaveKind(waveNum) {
    const gd = svc('GameDepth');
    const cfg = getWaveConfig(waveNum) || {};
    const boss = gd?.isBossWave ? gd.isBossWave(waveNum) : !!cfg.boss;
    const horde = !boss && !!gd?.isHordeWave?.(waveNum);
    return { boss, horde, cfg };
  }

  /** True for the enemy the skull on the markers stands for, and for its pack. */
  function sectorBossPredicate(waveNum, boss) {
    if (!boss) return null;
    const named = svc('GameDepth')?.getNamedBossForWave?.(waveNum);
    return (t) =>
      (named && t === named.type) ||
      !!EnemyDefs[t]?.isNamedBoss ||
      (!named && t === 'war_chief') ||
      (GS.wave === waveNum && !!svc('MonsterBosses')?.isPackMinion?.(t));
  }

  /**
   * Tonight's best reading of tomorrow's host, as a list of enemy types. Built from the
   * same seed and weights the dawn uses, so on a quiet night it is the host itself; wave
   * events, late elites and sub-bosses are only known at dawn. Null when it cannot be read.
   */
  function forecastSpawnQueue(waveNum) {
    try {
      if (!svc('EnemyFactions')?.composeWave) return null;
      const hp = hostBuildParams(waveNum);
      const plan = planHostFor(waveNum, hp);
      if (!plan) return null;
      const guard = hp.isBoss && !hp.noElites ? bossGuardFor(waveNum) : [];
      const comp = composeHost(waveNum, hp, plan, guard);
      return comp && comp.queue.length ? comp.queue.slice() : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Rolls the plan for a wave: which of the three top-edge sectors the host uses, what
   * share each gets, and which enemies go where. Rolled at nightfall so the night markers
   * tell the truth; `assignWaveSectors` settles it against the real host at dawn.
   */
  function planWaveSectors(waveNum) {
    const mf = svc('MultiFrontSiege');
    if (!mf) return null;
    const { boss, horde, cfg } = sectorWaveKind(waveNum);
    const kind = mf.waveKind({ boss, horde });
    const queue = GS.creativeMode ? null : forecastSpawnQueue(waveNum);
    const tally = {};
    for (const t of cfg.pool || []) tally[t] = (tally[t] || 0) + 1;
    const poolTypes = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
    const count = Math.max(
      1,
      Math.round((cfg.count || 1) * openingCountMult(getDifficulty().enemyCountMult, waveNum))
    );
    return mf.buildPlan({
      wave: waveNum,
      kind,
      queue,
      count,
      poolTypes,
      isBossType: sectorBossPredicate(waveNum, boss),
      rng: gameRandom,
      prevMain: GS.lastSectorMain || null,
      spreadBias: getAsymmetricMods().multiFlankBias || 0,
    });
  }

  /** Dawn: every queued enemy gets its sector, in queue order. */
  function assignWaveSectors() {
    const mf = svc('MultiFrontSiege');
    if (!mf) {
      GS.spawnSectors = [];
      return;
    }
    if (!GS.sectorPlan || GS.sectorPlan.wave !== GS.wave) GS.sectorPlan = planWaveSectors(GS.wave);
    const boss = sectorWaveKind(GS.wave).boss || !!GS.namedBossWave;
    GS.spawnSectors = mf.assignQueue(
      GS.sectorPlan,
      GS.spawnQueue,
      sectorBossPredicate(GS.wave, boss)
    );
    GS.lastSectorMain = GS.sectorPlan.main;
    mf.setCurrentPlan(GS.sectorPlan);
  }

  /** The sector of the enemy about to leave the queue. */
  function takeSpawnSector() {
    // The queue can be rewritten outside the dawn (a custom wave, a loaded older save).
    if (!Array.isArray(GS.spawnSectors) || GS.spawnSectors.length !== GS.spawnQueue.length) {
      assignWaveSectors();
    }
    return GS.spawnSectors.shift() || GS.sectorPlan?.main || 'centre';
  }

  const SPAWN_ELITE_TYPES = [
    'dark_knight',
    'war_chief',
    'troll',
    'siege_tower',
    'necromancer',
    'berserker',
    'assassin',
    'sky_drake',
    'bone_summoner',
    'abomination',
    'behemoth',
    'iron_colossus',
    'void_stalker',
    'elder_wyrm',
    'hellbound_legionnaire',
    'nightmare_strider',
    'dreadborn_champion',
    'warp_prophet',
    'grim_revenant',
    'umbral_stalker',
    'cinderbound_juggernaut',
    'hellmortar_pack',
  ];

  // Named bosses belong to boss waves (every 10th). They are not ordinary elites: listing
  // them above let host-threat elite slots drop wave-100 bosses into wave 27.

  /**
   * Last step of building a wave: on an ordinary wave any named boss that an injector
   * (faction sub-bosses, elite slots, events) put in the queue is swapped for a plain elite.
   * On a boss wave it makes sure the wave's own boss is still in the queue.
   */
  function stripStrayNamedBosses(queue, waveNum) {
    if (!Array.isArray(queue) || !queue.length) return queue;
    const bossWave =
      svc('GameDepth') && svc('GameDepth').isBossWave
        ? svc('GameDepth').isBossWave(waveNum)
        : waveNum > 0 && waveNum % 10 === 0;
    if (bossWave) {
      // The random elite/faction swaps above can overwrite the boss himself; put him back.
      const own = GS.namedBossWave?.type;
      if (own && EnemyDefs[own] && !queue.includes(own)) queue[0] = own;
      return queue;
    }
    const standIns = ['dark_knight', 'troll', 'war_chief'].filter((t) => EnemyDefs[t]);
    let n = 0;
    return queue.map((t) =>
      EnemyDefs[t]?.isNamedBoss ? standIns[n++ % Math.max(1, standIns.length)] || 'orc' : t
    );
  }

  /**
   * Hard difficulties send extra bodies, but the first two waves arrive before the player
   * has earned anything to answer them with. The surplus is phased in: a third of it on
   * wave 1, two thirds on wave 2, all of it from wave 3.
   */
  function openingCountMult(mult, waveNum) {
    if (!(mult > 1) || waveNum >= 3) return mult;
    return 1 + (mult - 1) * (waveNum <= 1 ? 1 / 3 : 2 / 3);
  }

  /** True when this wave is a horde (every fifth wave, or every wave in a forced-horde mode). */
  function isHordeWaveFor(waveNum, isBoss) {
    const runSession = svc('GameModes') ? svc('GameModes').getSession() : null;
    const forceHorde =
      runSession?.forceHorde ||
      (typeof OnlineMultiplayer !== 'undefined' && OnlineMultiplayer.isForceHordeMode(runSession));
    if (isBoss) return false;
    if (forceHorde) return waveNum >= 1;
    return !!(svc('GameDepth') && svc('GameDepth').isHordeWave?.(waveNum));
  }

  /**
   * Everything that sizes a wave: how many bodies it would have, which elites are allowed,
   * and what the player's build is pulling towards it. Shared by the dawn builder and the
   * night preview, so the preview's head count is the one that would spawn if dawn came now.
   */
  function hostBuildParams(waveNum) {
    const cfg = getWaveConfig(waveNum);
    const diff = getDifficulty();
    const isBoss =
      svc('GameDepth') && svc('GameDepth').isBossWave
        ? svc('GameDepth').isBossWave(waveNum)
        : cfg.boss;
    const isHorde = isHordeWaveFor(waveNum, isBoss);
    const colonyPressure = assessColonyThreat(waveNum)?.pressure;
    const mods = GS.waveModifiers || {};
    const asym = getAsymmetricMods();
    let count;
    let hordeInfo = null;
    if (isHorde) {
      const runSession = svc('GameModes') ? svc('GameModes').getSession() : null;
      const hordeMult =
        (runSession?.hordeCountMult || 1) *
        (typeof OnlineMultiplayer !== 'undefined'
          ? OnlineMultiplayer.getHordeCountMult(runSession)
          : 1);
      // GameDepth still owns the horde's numbers (size, pace, health); the host itself is
      // composed by the leading faction's flavour.
      hordeInfo = svc('GameDepth').buildHordeSpawnQueue(
        waveNum,
        [],
        {
          ...mods,
          countMult: (mods.countMult || 1) * (colonyPressure?.countMult || 1) * hordeMult,
        },
        diff
      );
      count = hordeInfo.queue.length;
    } else {
      count = Math.max(
        1,
        Math.floor(
          cfg.count *
            (mods.countMult || 1) *
            openingCountMult(diff.enemyCountMult, waveNum) *
            (colonyPressure?.countMult || 1)
        )
      );
      count += getEnemyEconomySpawnBonus();
      count = Math.max(1, Math.floor(count * (asym.enemyCountMult || 1)));
      if (mods.stealReduction) count = Math.max(1, count - mods.stealReduction);
      if (svc('BiomeSpawn')) {
        count = svc('BiomeSpawn').adjustSpawnCount(count, waveNum, getLivingPlanetCtx());
      }
    }
    const typeWeights = diff.enemyWeight || {};
    return {
      cfg,
      diff,
      isBoss,
      isHorde,
      hordeInfo,
      colonyPressure,
      count,
      noElites: !!(mods.noElites || diff.forceNoElites),
      typeWeights,
      pressureWeights: ColonyValue?.mergeWeights
        ? svc('ColonyValue').mergeWeights(typeWeights, colonyPressure?.weights)
        : typeWeights,
      eliteSlots: (colonyPressure?.eliteSlots || 0) + (asym.eliteSlotBonus || 0),
      strategies: svc('StrategyCounterplay') ? svc('StrategyCounterplay').getActive() : [],
    };
  }

  /**
   * Who leads a wave. Made once (normally at nightfall, so the night can show it) and kept
   * until the wave is fought.
   */
  function planHostFor(waveNum, params) {
    const factions = svc('EnemyFactions');
    if (!factions || !factions.planFor) return null;
    const hp = params || hostBuildParams(waveNum);
    const kind = hp.isBoss ? 'boss' : hp.isHorde ? 'horde' : 'ordinary';
    const cached = factions.getPlan(waveNum);
    if (cached && cached.kind === kind) return cached;
    if (cached) factions.forgetPlan(waveNum);
    const rep = svc('FactionReputation');
    const session = svc('GameModes') ? svc('GameModes').getSession() : null;
    return factions.planFor(waveNum, {
      seed: getSpawnFillSeed(waveNum),
      seeded: !!session?.seed,
      boss: hp.isBoss && svc('GameDepth') ? svc('GameDepth').getNamedBossForWave(waveNum) : null,
      horde: hp.isHorde,
      revenge: kind === 'ordinary' && rep?.dueRevenge ? rep.dueRevenge(waveNum) : null,
      barred: rep?.getBarred ? rep.getBarred(waveNum) : [],
      strategies: hp.strategies,
      pressureWeights: hp.pressureWeights,
    });
  }

  /** One composition for the night forecast, the preview and the dawn, so they agree. */
  function composeHost(waveNum, hp, plan, guard) {
    return svc('EnemyFactions').composeWave(plan, {
      count: hp.count + guard.length,
      noElites: hp.noElites,
      typeWeights: hp.typeWeights,
      eliteSlots: hp.eliteSlots,
      strategies: hp.strategies,
      packMinions: guard,
      template: waveNum < 4 ? hp.cfg.pool : null,
    });
  }

  /** The boss's own guard for a boss wave, without counting it as an appearance. */
  function bossGuardFor(waveNum) {
    const named = svc('GameDepth') ? svc('GameDepth').getNamedBossForWave(waveNum) : null;
    const pack = named && svc('MonsterBosses') ? svc('MonsterBosses').getPackDef(named.type) : null;
    return pack ? pack.minions.filter((t) => EnemyDefs[t]) : [];
  }

  /**
   * Tomorrow's host as the night shows it: the plan, and the host it would be if dawn came
   * now. `scouted` (a Watchtower, a Scout Report) decides how much of it is told.
   */
  function hostPreviewFor(waveNum, scouted) {
    const factions = svc('EnemyFactions');
    if (!factions || !factions.composeWave || GS.creativeMode) return null;
    const hp = hostBuildParams(waveNum);
    const plan = planHostFor(waveNum, hp);
    if (!plan) return null;
    const guard = hp.isBoss && !hp.noElites ? bossGuardFor(waveNum) : [];
    const comp = composeHost(waveNum, hp, plan, guard);
    return typeof FactionIntel !== 'undefined' && FactionIntel.hostReport
      ? FactionIntel.hostReport(plan, comp, scouted)
      : factions.describeHost(plan, comp, scouted);
  }

  /** The host is composed on the main thread now (it is a few dozen entries); nothing to prefetch. */
  function prefetchSpawnQueueForWave() {}

  function assessColonyThreat(targetWave = GS.wave) {
    if (!svc('ColonyValue')) {
      GS.colonySnapshot = null;
      GS.colonyThreatMods = {
        countMult: 1,
        hpMult: 1,
        dmgMult: 1,
        intervalMult: 1,
        weights: {},
        eliteSlots: 0,
      };
      return null;
    }
    GS.colonySnapshot = svc('ColonyValue').computeKingdomStrength({ wave: targetWave });
    GS.colonyThreatMods = svc('ColonyValue').deriveWavePressure(GS.colonySnapshot, targetWave);
    return { colony: GS.colonySnapshot, pressure: GS.colonyThreatMods };
  }

  function appendCounterIntel() {
    if (!svc('StrategyCounterplay')) return;
    const strategies = svc('StrategyCounterplay').getActive();
    const intel = svc('StrategyCounterplay').formatCounterIntel(strategies);
    if (intel) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${intel}` : intel;
    svc('StrategyCounterplay').maybeAnnounce(strategies, {
      showMessage,
      floatingText: floatStatus,
      worldW: GS.worldW,
    });
  }

  /** What the priced actions need to know about the run right now. */
  function econCtx() {
    return {
      wave: GS.wave,
      upkeepMult: getDeployCostMult(),
      isDeployUnlocked: (type) =>
        !svc('Research') || svc('Research').isDeployUnlocked(type, getResearchOpts()),
    };
  }

  /** Refresh action prices and cooldown labels (night start, after a use, after a load). */
  function syncEconomyActions() {
    if (typeof EconomyRules !== 'undefined') EconomyRules.syncActionDefs(econCtx());
  }

  /**
   * Spy trade-offs that shape the queue once it is built: Sabotage removes siege engines,
   * Deep Infiltration weakens the first arrivals. Disrupt's forced march is applied per
   * enemy as it spawns.
   */
  function applyEconomyWaveMods() {
    if (typeof EconomyRules === 'undefined') return;
    const mods = GS.waveModifiers || {};
    if (mods.noSiege) {
      const cut = EconomyRules.stripSiege(GS.spawnQueue);
      showMessage(
        cut > 0
          ? `Sabotage: ${cut} siege engine${cut === 1 ? '' : 's'} never left camp.`
          : 'Sabotage: the host brought no siege engines today.',
        260
      );
    }
    if (mods.softenShare > 0) {
      mods.softenCount = EconomyRules.softenCountFor(GS.spawnQueue.length);
      showMessage(`Ambush on the road: the first ${mods.softenCount} foes arrive wounded.`, 260);
    }
    if ((mods.speedMult || 1) > 1) {
      // Disrupt: the foes cut off on the road are late, not gone.
      const late =
        (mods.countMult || 1) < 1 ? EconomyRules.rejoinSquad(GS.spawnQueue, mods.countMult) : 0;
      showMessage(
        late > 0
          ? `Disrupted host: fewer of them, tougher and on a forced march. ${late} stragglers will catch up late in the wave.`
          : 'Disrupted host: fewer of them, but tougher and on a forced march.',
        280
      );
    }
    EconomyRules.onWaveStart(mods);
  }

  /** Notes other systems add after the host line of the wave intel. */
  function appendModuleIntelNotes() {
    if (typeof ProgressionRestarts !== 'undefined') {
      const prNote = ProgressionRestarts.formatIntelNote({ wave: GS.wave });
      if (prNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${prNote}` : prNote;
    }
    if (typeof EternalLegacyTree !== 'undefined') {
      const elNote = EternalLegacyTree.formatIntelNote({ wave: GS.wave });
      if (elNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${elNote}` : elNote;
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const fmNote = FoundationalMedievalLayer.formatIntelNote({ wave: GS.wave });
      if (fmNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${fmNote}` : fmNote;
    }
    if (typeof AscensionSystem !== 'undefined') {
      const ascNote = AscensionSystem.formatIntelNote({ wave: GS.wave });
      if (ascNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${ascNote}` : ascNote;
    }
    if (typeof ThematicEraSynergies !== 'undefined') {
      const synNote = ThematicEraSynergies.formatIntelNote({ wave: GS.wave });
      if (synNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${synNote}` : synNote;
    }
    if (typeof HybridPowerFantasy !== 'undefined') {
      const pfNote = HybridPowerFantasy.formatIntelNote({ wave: GS.wave });
      if (pfNote) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${pfNote}` : pfNote;
    }
    if (typeof NarrativeThread !== 'undefined') {
      const crownNote = NarrativeThread.formatIntelNote({ wave: GS.wave });
      if (crownNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${crownNote}` : crownNote;
    }
    if (typeof TechTreeBranches !== 'undefined') {
      const techNote = TechTreeBranches.formatIntelNote({ wave: GS.wave });
      if (techNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${techNote}` : techNote;
    }
    if (typeof EternalPathFramework !== 'undefined') {
      const epfNote = EternalPathFramework.formatIntelNote({ wave: GS.wave });
      if (epfNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${epfNote}` : epfNote;
    }
    if (typeof MartialPathEvolution !== 'undefined') {
      const mpeNote = MartialPathEvolution.formatIntelNote({ wave: GS.wave });
      if (mpeNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mpeNote}` : mpeNote;
    }
    if (typeof ArcanePathEvolution !== 'undefined') {
      const apeNote = ArcanePathEvolution.formatIntelNote({ wave: GS.wave });
      if (apeNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${apeNote}` : apeNote;
    }
    if (typeof TechPathEvolution !== 'undefined') {
      const tpeNote = TechPathEvolution.formatIntelNote({ wave: GS.wave });
      if (tpeNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${tpeNote}` : tpeNote;
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      const mypNote = MythicPathEvolution.formatIntelNote({ wave: GS.wave });
      if (mypNote)
        GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${mypNote}` : mypNote;
    }
  }

  /**
   * Build the wave. One faction leads it (chosen at nightfall by planHostFor) and at most
   * one ally marches in support; EnemyFactions.composeWave turns that into the queue and
   * HostTactics is told which tactic to play. Boss waves are led by the boss's own faction;
   * horde waves by the flavour's faction.
   */
  function buildSpawnQueue() {
    GS.currentWaveConfig = getWaveConfig(GS.wave);
    GS.currentHordeWave = null;
    // Rebuilt from nothing every wave: it used to grow by one prepended note a day.
    GS.nextWaveIntel = '';
    const factions = svc('EnemyFactions');
    const hp = hostBuildParams(GS.wave);
    const { isBoss, isHorde, colonyPressure } = hp;

    GS.namedBossWave =
      isBoss && svc('GameDepth') ? svc('GameDepth').getNamedBossForWave(GS.wave) : null;
    let monsterBossPrep = null;
    if (GS.namedBossWave && svc('MonsterBosses')) {
      monsterBossPrep = svc('MonsterBosses').prepareBossWave(
        GS.namedBossWave.type,
        GS.wave,
        GS.namedBossWave.scale || 1
      );
      GS.namedBossWave = {
        ...GS.namedBossWave,
        scale: monsterBossPrep.totalScale,
        evolution: monsterBossPrep.evolution,
        packSummary: monsterBossPrep.packSummary,
      };
    }

    const plan = planHostFor(GS.wave, hp);
    const guard = isBoss && !hp.noElites ? monsterBossPrep?.minions || [] : [];
    const comp = plan ? composeHost(GS.wave, hp, plan, guard) : null;
    // No faction module (a stripped build): fall back to a plain draw from the wave's pool.
    GS.spawnQueue = comp
      ? comp.queue.slice()
      : WaveCompositionCore.buildWeightedSpawnQueue({
          count: hp.count,
          pool: GS.currentWaveConfig.pool,
          weights: hp.typeWeights,
          elites: SPAWN_ELITE_TYPES,
          noElites: hp.noElites,
          seed: getSpawnFillSeed(GS.wave),
        });
    const lead = plan ? factions.getFactionDef(plan.leadId) : null;
    const tactic = plan ? factions.tacticForPlan(plan) : null;

    if (isHorde) {
      const flavor = { label: tactic?.name || 'Horde', tagline: tactic?.desc || '' };
      GS.currentHordeWave = {
        ...hp.hordeInfo,
        queue: GS.spawnQueue,
        count: GS.spawnQueue.length,
        flavor,
        hasSiege: GS.spawnQueue.includes('siege_tower'),
      };
      addHighlight('horde', `Horde wave ${GS.wave}: ${flavor.label}`);
      showMessage(`HORDE WAVE ${GS.wave}! ${flavor.label}. ${flavor.tagline}`, 360);
      const hordeI = GS.currentHordeWave.intensity ?? 0.5;
      const hordeColor = hordeI >= 0.72 ? '#ff4840' : hordeI >= 0.48 ? '#ff8040' : '#ff9040';
      svc('FloatingText').status(GS.worldW / 2, 48, 'HORDE INCOMING', hordeColor);
      svc('FloatingText').status(GS.worldW / 2, 62, flavor.label.toUpperCase(), '#ffc060');
    } else if (isBoss && GS.namedBossWave) {
      const assassinNote = hp.noElites ? ' (guard assassinated, boss remains)' : '';
      const packNote = GS.namedBossWave.packSummary ? ` · ${GS.namedBossWave.packSummary}` : '';
      const hostNote = lead ? ` · ${lead.name}` : '';
      addHighlight(
        'boss',
        `Boss wave ${GS.wave}: ${GS.namedBossWave.name} leads the assault${assassinNote}`
      );
      showMessage(
        `BOSS WAVE ${GS.wave}! ${GS.namedBossWave.name}. ${GS.namedBossWave.tagline}${hostNote}${packNote}`,
        380
      );
      svc('FloatingText').status(GS.worldW / 2, 44, GS.namedBossWave.name.toUpperCase(), '#ffd040');
      svc('FloatingText').status(
        GS.worldW / 2,
        58,
        GS.namedBossWave.title.toUpperCase(),
        '#ff6060'
      );
      if (svc('MonsterBosses') && GS.namedBossWave.evolution?.label) {
        svc('MonsterBosses').announceEvolution(monsterBossPrep, GS.namedBossWave, {
          showMessage,
          addHighlight,
          floatingText: floatStatus,
          worldW: GS.worldW,
        });
      }
      playSfx('bossWarn');
    } else if (lead && tactic && GS.wave >= 4) {
      addHighlight('host', `Wave ${GS.wave}: ${lead.name} lead (${tactic.name})`);
      showMessage(`${lead.name} lead today: ${tactic.name}. ${tactic.counter}`, 380);
      svc('FloatingText').status(GS.worldW / 2, 48, lead.name.toUpperCase(), lead.color);
      svc('AudioEngine')?.factionArrival?.(plan.leadId);
    }
    if (typeof GameFeedback !== 'undefined') {
      GameFeedback.resetWave();
      GameFeedback.onWaveStart(GS.wave, {
        boss: !!isBoss || !!GS.namedBossWave,
        horde: !!GS.currentHordeWave,
        siege: !!GS.currentHordeWave?.hasSiege || isSiegeWave?.(),
        subtitle:
          GS.namedBossWave?.name ||
          (GS.currentHordeWave
            ? 'Brace for the swarm'
            : lead && tactic
              ? tactic.name
              : 'Hold the line'),
      });
    }
    if (!isHorde && svc('ContentExpansion')) {
      GS.spawnQueue = svc('ContentExpansion').applyWaveEvent(GS.wave, GS.spawnQueue);
    }
    if (svc('ModLoader')) GS.spawnQueue = svc('ModLoader').applyModWaves(GS.wave, GS.spawnQueue);
    GS.spawnQueue = stripStrayNamedBosses(GS.spawnQueue, GS.wave);
    if (GS.currentHordeWave) GS.currentHordeWave.queue = GS.spawnQueue;
    GS.waveEnemyTotal = GS.spawnQueue.length;
    GS.waveProgress = 0;
    GS.bossTrackId =
      GS.namedBossWave?.type ||
      ['war_chief', 'behemoth', 'elder_wyrm', 'iron_colossus'].find((t) =>
        GS.spawnQueue.includes(t)
      ) ||
      null;

    // The intel line: who leads and how they fight, then what other systems add.
    const scouted = !!(GS.waveModifiers.revealed || GS.waveModifiers.nextPreview);
    if (plan && comp) {
      const report = factions.describeHost(plan, comp, true);
      GS.nextWaveIntel = factions.formatHostLine(report);
      if (scouted) {
        GS.waveModifiers.nextPreview = GS.nextWaveIntel;
        showMessage(`Scout report: ${GS.nextWaveIntel}`, 360);
      }
    }
    if (GS.colonySnapshot && colonyPressure && svc('ColonyValue')) {
      const note = svc('ColonyValue').formatWaveNote(GS.colonySnapshot, colonyPressure);
      if (note) GS.nextWaveIntel = GS.nextWaveIntel ? `${GS.nextWaveIntel} · ${note}` : note;
    }
    if (GS.namedBossWave?.packSummary) {
      GS.nextWaveIntel =
        (GS.nextWaveIntel ? `${GS.nextWaveIntel} · ` : '') + GS.namedBossWave.packSummary;
    }
    appendModuleIntelNotes();
    appendCounterIntel();

    // Hand the wave to its tactic, and let the rotation and the grudges know it is here.
    if (plan && comp) {
      if (typeof HostTactics !== 'undefined') {
        HostTactics.beginWave(plan, { ...comp, queue: GS.spawnQueue }, siegeCtx);
      }
      factions.commitPlan(plan);
      if (plan.revenge && svc('FactionReputation')?.onRevengeWave) {
        svc('FactionReputation').onRevengeWave(plan.leadId, GS.wave, plan.revenge, {
          hooks: uiHooks(),
          worldW: GS.worldW,
        });
      }
    }
  }

  function spawnFactionCounterRaids() {
    if (GS.creativeMode || !svc('EnemyFactions')) return;
    const raids = svc('EnemyFactions').processCounterRaids(GS.wave, {
      buildings: GS.buildings,
      worldW: GS.worldW,
      worldH: GS.worldH,
      frontPlan: GS.sectorPlan,
      showMessage,
      floatingText: floatStatus,
      rng: gameRandom,
      spawnFn: (type, x, y, opts) => {
        const u = spawnUnit(type, x, y, 'enemy', opts);
        if (u && svc('EnemyFactions') && !u.enemyFaction) {
          u.enemyFaction = svc('EnemyFactions').getUnitFaction(type);
        }
        return u;
      },
      applyScaling: (u) => {
        if (!svc('GameDepth')) return;
        const cfg = GS.currentWaveConfig || getWaveConfig(GS.wave);
        svc('GameDepth').applyEnemySpawnScaling(u, GS.wave, {
          cfg,
          diff: getDifficulty(),
          waveModifiers: GS.waveModifiers,
          colonyThreat: GS.colonyThreatMods,
        });
      },
    });
    for (const u of raids) GS.units.push(u);
  }

  function healAbyssWalkerHero() {
    if (GS.wave % 2 !== 0) return;
    for (const u of GS.units) {
      if (u.team !== 'player' || !u.isDoomslayer || u.hp <= 0) continue;
      const missing = 1 - u.hp / u.maxHp;
      const heal = Math.floor(u.maxHp * missing * 0.5);
      if (heal > 0) {
        u.hp = Math.min(u.maxHp, u.hp + heal);
        svc('FloatingText').heal(u.x, u.y, heal);
        showMessage("The Hellbane absorbs hell's wrath — massive heal!", 200);
      }
    }
  }

  function startNextWave() {
    processAcademyTraining();
    tickSettlementWaveProgress();
    GS.wave++;
    if (typeof Analytics !== 'undefined') Analytics.onWaveReached(GS.wave);
    if (typeof ProgressionRestarts !== 'undefined') {
      ProgressionRestarts.onWaveStart(GS.wave, getProgressionRestartCtx());
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      FoundationalMedievalLayer.onWaveStart(GS.wave, { wave: GS.wave, showMessage, addHighlight });
    }
    if (!(GS.creativeMode && !GS.creativeSettings.useCampaignRules) && svc('GameDepth')) {
      const tenure = svc('GameDepth').applyVeteranTenureScaling(GS.units, GS.wave);
      if (tenure.enemyBuffed > 0 && GS.wave >= 6) {
        showMessage(
          `${tenure.enemyBuffed} enemy veteran${tenure.enemyBuffed > 1 ? 's' : ''} hardened (+HP/DMG from prior waves).`,
          180
        );
      }
      if (tenure.ipBuffed > 0 && GS.wave >= 30 && GS.wave % 25 === 0) {
        showMessage(
          'Evolved operatives scale with the war — promote core veterans with TP to stay competitive.',
          260
        );
      }
    }
    healAbyssWalkerHero();
    syncTerritory();
    ensureInitialBattlefield();
    const wavePrep = emitWaveStartPrep();
    GS.hazards = wavePrep.hazards;
    updateEnemyRTS();
    // The entry sectors were usually rolled at nightfall so the markers told the truth; a
    // wave that starts without a night (first wave, cheats) rolls them now. The host gets
    // its sectors once the queue is built, in startWaveSpawns.
    GS.sectorPlan =
      GS.nextWavePlan && GS.nextWavePlan.wave === GS.wave
        ? GS.nextWavePlan
        : planWaveSectors(GS.wave);
    GS.nextWavePlan = null;
    GS.spawnSectors = [];
    announceAcademyEra();
    announceRtsEra();
    announceHostGrowth();
    announceKingdomEvolution();
    if (svc('PlayerCounterEvolution') && svc('EnemyFactions')) {
      svc('PlayerCounterEvolution').checkWaveAnnouncement(GS.wave, announceHooks());
    }
    if (svc('LivingPlanet')) {
      svc('LivingPlanet').checkWaveAnnouncement(GS.wave, announceHooks());
    }
    if (svc('SettlementRaids')) {
      svc('SettlementRaids').checkWaveAnnouncement(GS.wave, announceHooks());
      if (svc('SettlementRaids').isActive(GS.wave)) {
        svc('SettlementRaids').refreshMissions(GS.buildings, GS.wave, {
          isAttackable: isTargetableEnemyStructure,
        });
      }
    }
    if (svc('EnemyFactions')) {
      svc('EnemyFactions').checkTierAnnouncements(GS.wave, announceHooks());
    }
    if (svc('FactionReputation')) {
      svc('FactionReputation').checkWaveAnnouncement(GS.wave, { hooks: uiHooks() });
    }
    maybeCampaignNarrative();
    GS.courierMessagesUsedThisWave = 0;
    GS.spyUsedThisWave = false;
    GS.doctrineUsedThisWave = false;
    GS.counterDoctrineUsedThisWave = false;
    GS.expeditionUsedThisWave = false;
    if (svc('DynamicMapEvents')) {
      svc('DynamicMapEvents').applyForWave(GS.wave, {
        worldW: GS.worldW,
        worldH: GS.worldH,
        rallyY: GS.rallyY,
        territoryTier: GS.territoryTier,
        units: GS.units,
        pendingWaveMods: GS.pendingWaveMods,
        spawnUnit: (u) => GS.units.push(u),
        grantTp: (n) => {
          if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
            GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
            sanitizeTactical();
          }
        },
        grantScience: (n) => {
          if (n > 0 && svc('Research') && svc('Research').grantSciencePoints) {
            svc('Research').grantSciencePoints(n, { showMessage });
          }
        },
        hooks: uiHooks(),
      });
    }
    GS.units
      .filter((u) => u.team === 'player')
      .forEach((u) => {
        u.specialistRankedThisWave = false;
        u._revivedThisWave = false;
      });
    resetWaveModifiers();
    GS.playerCasualtiesThisWave = 0;
    GS.structuresRazedThisWave = 0;
    if (typeof AscensionSystem !== 'undefined' && !GS.creativeMode) {
      AscensionSystem.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof ThematicEraSynergies !== 'undefined' && !GS.creativeMode) {
      ThematicEraSynergies.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof HybridPowerFantasy !== 'undefined' && !GS.creativeMode) {
      HybridPowerFantasy.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof NarrativeThread !== 'undefined' && !GS.creativeMode) {
      NarrativeThread.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof TechTreeBranches !== 'undefined' && !GS.creativeMode) {
      TechTreeBranches.onWaveStart(GS.wave, {
        wave: GS.wave,
        units: GS.units,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof EternalPathFramework !== 'undefined' && !GS.creativeMode) {
      EternalPathFramework.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof MartialPathEvolution !== 'undefined' && !GS.creativeMode) {
      MartialPathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof ArcanePathEvolution !== 'undefined' && !GS.creativeMode) {
      ArcanePathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof TechPathEvolution !== 'undefined' && !GS.creativeMode) {
      TechPathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    if (typeof MythicPathEvolution !== 'undefined' && !GS.creativeMode) {
      MythicPathEvolution.onWaveStart(GS.wave, {
        wave: GS.wave,
        showMessage,
        addHighlight,
        creative: GS.creativeMode,
      });
    }
    buildSpawnQueue();
    // Camps still standing at dawn add their bodies before Sabotage strips siege engines.
    if (typeof WarCamps !== 'undefined') WarCamps.onWaveStart(warCampCtx);
    applyEconomyWaveMods();
    assignWaveSectors();
    announceAttackSides();
    if (GS.namedBossWave && svc('MonsterBosses')) {
      svc('MonsterBosses').spawnPackStructures(
        GS.namedBossWave.type,
        GS.wave,
        tryPlaceEnemyBuilding,
        null,
        {
          worldW: GS.worldW,
          worldH: GS.worldH,
          showMessage,
        }
      );
    }
    spawnFactionCounterRaids();
    GS.spawnTimer = 90 + GS.spawnDelayBonus;
    GS.spawnDelayBonus = 0;

    for (const t of GS.pendingReinforce) {
      const u = spawnUnit(
        t,
        60 + (globalThis.simRandom || Math.random)() * (GS.worldW - 120),
        GS.deployY - 10,
        'player'
      );
      if (!u) continue;
      applyPlayerStatMods(u);
      if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
      u.targetY = GS.rallyY;
      GS.units.push(u);
    }
    GS.pendingReinforce = [];

    if (isHordeWave())
      showMessage(`HORDE ASSAULT — Wave ${GS.wave}! ${GS.currentHordeWave?.flavor?.label || ''}`);
    else if (
      GS.currentWaveConfig?.boss ||
      (svc('GameDepth') && svc('GameDepth').isBossWave?.(GS.wave))
    ) {
      showMessage(`BOSS WAVE ${GS.wave}!`);
    } else showMessage(`Dawn breaks — Wave ${GS.wave} assault begins!`);
    if (GS.wave === 1001) {
      showMessage("HELLSCAPE — even the Hellbane's blade falters here!", 400);
      svc('FloatingText').status(GS.worldW / 2, 80, 'HELLSCAPE', '#ff2020');
    }
    applyChampionWaveStartPulse();
    const assaultUnits = [];
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.team === 'player' && u.hp > 0) assaultUnits.push(u);
    }
    emitWaveStartAssault(assaultUnits);
    if (isHordeWave()) {
      playSfx('hordeWarn', GS.currentHordeWave?.intensity ?? 0.5);
    } else {
      playSfx('waveStart');
    }
  }

  return {
    bind,
    applyEconomyWaveMods,
    assignWaveSectors,
    buildSpawnQueue,
    econCtx,
    getWaveAttackSides,
    hostPreviewFor,
    openingCountMult,
    planHostFor,
    planWaveSectors,
    prefetchSpawnQueueForWave,
    spawnPosForSector,
    spawnPosForSide,
    startNextWave,
    syncEconomyActions,
    takeSpawnSector,
  };
})();
