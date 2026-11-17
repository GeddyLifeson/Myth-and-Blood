/**
 * Save, load and quicksave.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameSave = (() => {
  const { QUICKSAVE_KEY, ensureBuildingHealth, ensurePlayerUnitDef, svc } = GameCore;
  const GS = GameState;
  const {
    clampPos,
    generateBattlefield,
    invalidateObstacles,
    releaseAllBuildings,
    releaseAllUnits,
    resolveUnitsInTerrain,
    sanitizeTactical,
    shiftWorldEntities,
  } = GameField;
  const { resetCamera } = GameCamera;
  const { stopPostReturn } = GameStance;
  const { getEffectiveRange } = GameTargeting;
  const {
    normalizeEnemyEconomyBuilding,
    normalizeEnemyEconomyBuildings,
    noteEnemyEconomyPresence,
  } = GameBuildings;
  const { planWaveSectors } = GameWaves;
  const { CAMPAIGN_VICTORY_WAVE, isNightPhase } = GameDayNight;
  const { isCourierMessageCapReached } = GameCommands;
  const { getMinimapData } = GameRosterUi;
  let applyWorldSize,
    getState,
    refreshUnitCounts,
    showMessage,
    siegeCtx,
    syncInteractionState,
    warCampCtx,
    wireGameContext;
  function bind(api) {
    ({
      applyWorldSize,
      getState,
      refreshUnitCounts,
      showMessage,
      siegeCtx,
      syncInteractionState,
      warCampCtx,
      wireGameContext,
    } = api);
  }

  function serializeUnitSnap(u) {
    const out = {
      kills: u.kills || 0,
      wavesSurvived: u.wavesSurvived || 0,
      lineBreaker: !!u.lineBreaker,
      stormLine: !!u.stormLine,
      id: u.id,
      type: u.type,
      x: u.x,
      y: u.y,
      team: u.team,
      hp: u.hp,
      maxHp: u.maxHp,
      damage: u.damage,
      accuracy: u.accuracy,
      range: u.range,
      baseRange: u.baseRange,
      meleeRange: u.meleeRange,
      speed: u.speed,
      combatType: u.combatType,
      projectile: u.projectile || null,
      siegeMult: u.siegeMult || 1,
      antiAir: !!u.antiAir,
      antiCavalry: !!u.antiCavalry,
      healAmount: u.healAmount || 0,
      moraleAuraUnit: u.moraleAuraUnit || 0,
      revealsStealth: !!u.revealsStealth,
      vetBronze: u.vetBronze,
      vetSilver: u.vetSilver,
      vetGold: u.vetGold,
      goldStarsEarned: u.goldStarsEarned || 0,
      lateAbilityUnlocked: !!u.lateAbilityUnlocked,
      vetTier: u.vetTier,
      statModsApplied: u.statModsApplied,
      honorName: u.honorName,
      soldierName: u.soldierName,
      traits: u.traits ? [...u.traits] : [],
      forgot: u.forgot ? [...u.forgot] : [],
      deeds: u.deeds ? JSON.parse(JSON.stringify(u.deeds)) : null,
      hallId: u.hallId || null,
      timesRaised: u.timesRaised || 0,
      vetStatTierApplied: u.vetStatTierApplied || 0,
      experience: u.experience,
      morale: u.morale,
      maxMorale: u.maxMorale,
      perks: u.perks ? [...u.perks] : [],
      // Perk effects that are flags or multipliers rather than plain stats; without them
      // a loaded unit still listed the perk but had lost what it does.
      hasQuickRevive: u.hasQuickRevive,
      hasElementalPop: u.hasElementalPop,
      hasPhdFlopper: u.hasPhdFlopper,
      hasVultureAid: u.hasVultureAid,
      hasTombstone: u.hasTombstone,
      attackSpeedMult: u.attackSpeedMult,
      huntMode: u.huntMode,
      holding: !!u.holding,
      generalStars: u.generalStars,
      isGeneral: !!u.isGeneral,
      stationedKeep: u.stationedKeep,
      garrisoned: u.garrisoned || null,
      wallGarrisoned: u.wallGarrisoned || null,
      wallSlotIndex: u.wallSlotIndex ?? null,
      targetY: u.targetY,
      postX: Number.isFinite(u.postX) ? u.postX : null,
      postY: Number.isFinite(u.postY) ? u.postY : null,
      spawnWave: u.spawnWave ?? GS.wave,
      tenureApplied: u.tenureApplied ?? 0,
      vetUpgradeEligible: !!u.vetUpgradeEligible,
      baseMaxHp: u.baseMaxHp ?? null,
      baseDamage: u.baseDamage ?? null,
      ipScaleWave: u.ipScaleWave ?? 0,
      isWwe: !!u.isWwe,
      isCrossover: !!u.isCrossover,
      isDoomslayer: !!u.isDoomslayer,
      wweAbility: u.wweAbility || null,
      combatTag: u.combatTag || null,
      // Builder project links (re-resolved after buildings restore).
      buildTargetId: u.building?.id || null,
      buildQueueIds: Array.isArray(u.buildQueue)
        ? u.buildQueue
            .map((item) => {
              if (!item) return null;
              if (item.id) return { id: item.id };
              if (item.pending && item.type)
                return {
                  pending: true,
                  type: item.type,
                  x: item.x,
                  y: item.y,
                  facing: item.facing || null,
                };
              return null;
            })
            .filter(Boolean)
        : null,
    };
    // Everything else a unit carries (muster state, timers, flags, boss names, fields other
    // modules add) is copied as it stands, so a new field is saved without touching this list.
    return captureSaveFields(u, out, UNIT_SAVE_SKIP);
  }

  // Live fields that are rebuilt on load, or are links to live objects (saved as ids above).
  const UNIT_SAVE_SKIP = new Set([
    'path',
    'pathIndex',
    'pathRecalc',
    'pathPending',
    'pathReqId',
    'pathWaitTicks',
    'postPath',
    'postPathIndex',
    'building',
    'buildQueue',
    // Drawing state only.
    'frame',
    'frameTimer',
    'hitFlash',
    'hitFlashMax',
    'blockFlash',
  ]);
  const BUILDING_SAVE_SKIP = new Set(['wallSlots']);

  /** Plain JSON data only: no functions, no live units or buildings, nothing deep or huge. */
  function isPlainSaveData(v, depth = 0) {
    if (v === null) return true;
    const t = typeof v;
    if (t === 'string' || t === 'boolean') return true;
    if (t === 'number') return Number.isFinite(v);
    if (t !== 'object' || depth > 5) return false;
    if (Array.isArray(v)) {
      if (v.length > 400) return false;
      for (let i = 0; i < v.length; i++) if (!isPlainSaveData(v[i], depth + 1)) return false;
      return true;
    }
    if (Object.prototype.toString.call(v) !== '[object Object]') return false;
    // A live unit or canvas, not data.
    if ('spriteType' in v || 'getContext' in v) return false;
    const keys = Object.keys(v);
    if (keys.length > 400) return false;
    for (let i = 0; i < keys.length; i++) if (!isPlainSaveData(v[keys[i]], depth + 1)) return false;
    return true;
  }

  /** Copy every saveable own field of `src` that `out` does not already have. */
  function captureSaveFields(src, out, skip) {
    for (const k of Object.keys(src)) {
      if (k in out || (skip && skip.has(k))) continue;
      const v = src[k];
      if (v === undefined || typeof v === 'function') continue;
      if (typeof v === 'number' && !Number.isFinite(v)) continue;
      if (v !== null && typeof v === 'object') {
        if (isPlainSaveData(v)) out[k] = JSON.parse(JSON.stringify(v));
      } else out[k] = v;
    }
    return out;
  }

  function collectAliveUnitSnaps() {
    // Always return a fresh array — shared scratch was mutated by later exports and
    // corrupted in-memory co-op handoffs that stored the snap by reference.
    const out = [];
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.hp > 0) out.push(serializeUnitSnap(u));
    }
    return out;
  }

  // Save format: version, checksum, migration chain and validation live in
  // js/save-registry.js (SaveFormat). Module state goes through SaveRegistry sections.
  const SAVE_VERSION = SaveFormat.VERSION;

  function isSupportedSaveVersion(v) {
    return SaveFormat.isSupportedVersion(v);
  }

  /**
   * A saved entry-sector plan is used only if it is for the coming wave and names real
   * sectors. Saves from before the three sectors stored flanks here; those are dropped and
   * the plan is rolled again.
   */
  function restoreNextWavePlan(plan, wave) {
    const mf = svc('MultiFrontSiege');
    if (!mf || !plan) return null;
    let copy = null;
    try {
      copy = JSON.parse(JSON.stringify(plan));
    } catch (_) {
      return null;
    }
    return mf.restorePlan(copy, wave + 1);
  }

  /** " · Enters top edge: left 12 · right 9" for tomorrow's host, or '' if not rolled. */
  function nextSectorIntel() {
    const plan = GS.nextWavePlan;
    const mf = svc('MultiFrontSiege');
    if (!mf || !plan || plan.wave !== GS.wave + 1) return '';
    return ` · ${mf.formatIntel(plan)}`;
  }

  /** The plan the HUD should describe: tomorrow's at night, today's by day. */
  function activeSectorPlan() {
    if (isNightPhase() && GS.nextWavePlan && GS.nextWavePlan.wave === GS.wave + 1) {
      return GS.nextWavePlan;
    }
    return GS.sectorPlan;
  }

  // Run state on GS that has no better home in the save. Each is plain data.
  const SAVE_RUN_FIELDS = [
    'bossTrackId',
    'campaignNarrativeFlags',
    'castleBreachRecorded',
    'castleBreachWarned',
    'colonyThreatMods',
    'generalThreatCd',
    'generalThreatCount',
    'hallRaisedWave',
    'hazards',
    'huntQuietTicks',
    'huntSweep',
    'lastStandActive',
    'mapsRevealed',
    'moraleAlertCooldown',
    'multiFrontPlan',
    'nextWaveIntel',
    'playerCasualtiesThisWave',
    'runStructuresRazed',
    'spawnSquadLeft',
    'spyNetwork',
    'structuresRazedThisWave',
    'unmannedWallWarned',
    'victoryReason',
    'waveAttackSides',
    'waveTimer',
  ];

  // Module state the game saves on behalf of modules that already had an export/import pair.
  SaveRegistry.setClock(() => GS.updateTick);
  SaveRegistry.register('SiegeLoop', {
    save: () => SiegeLoop.exportState(),
    load: (data) => SiegeLoop.importState(data, siegeCtx),
  });
  SaveRegistry.register('EconomyRules', {
    save: () => (typeof EconomyRules !== 'undefined' ? EconomyRules.exportState() : null),
    load(data) {
      if (typeof EconomyRules === 'undefined') return;
      EconomyRules.importState(data);
      // A loaded run has already had its starting bonus.
      if (!data) EconomyRules.grantStartTp(EconomyRules.START_TP_BONUS_CAP);
    },
  });
  SaveRegistry.register('Research', {
    save: () => (svc('Research') ? svc('Research').getSnapshot() : null),
    load(data) {
      const research = svc('Research');
      if (!research) return;
      if (data) research.restoreSnapshot(data);
      else research.resetRun?.();
    },
  });
  SaveRegistry.register('ProgressionRestarts', {
    save: () =>
      typeof ProgressionRestarts !== 'undefined' ? ProgressionRestarts.getSnapshot() : null,
    load(data) {
      if (typeof ProgressionRestarts === 'undefined') return;
      if (data) ProgressionRestarts.restoreSnapshot(data);
      else {
        ProgressionRestarts.resetRun();
        ProgressionRestarts.syncFiredThroughWave(GS.wave);
      }
    },
  });

  function exportGameState() {
    if (GS.state !== 'playing') return null;
    const run = {};
    for (const key of SAVE_RUN_FIELDS) {
      const v = GS[key];
      if (v === undefined) continue;
      if (v === null || typeof v !== 'object') run[key] = v;
      else if (isPlainSaveData(v)) run[key] = JSON.parse(JSON.stringify(v));
    }
    const away = svc('PlayerCounterEvolution')?.getAwayUnits?.() || [];
    const snap = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      simTick: GS.updateTick,
      wave: GS.wave,
      nextWavePlan: restoreNextWavePlan(GS.nextWavePlan, GS.wave),
      cheatsUsed: !!GS.cheatsUsed,
      tactical: GS.tactical,
      kills: GS.kills,
      misses: GS.misses,
      timeOfDay: GS.timeOfDay,
      nightTimer: GS.nightTimer,
      waveProgress: GS.waveProgress,
      difficultyId: GS.difficultyId,
      territoryTier: GS.territoryTier,
      worldW: GS.worldW,
      worldH: GS.worldH,
      globalHunt: GS.globalHunt,
      builderAutoRepair: GS.builderAutoRepair,
      tpAwardedForWave: GS.tpAwardedForWave,
      spawnQueue: JSON.parse(JSON.stringify(GS.spawnQueue)),
      spawnSectors: [...(GS.spawnSectors || [])],
      sectorPlan: GS.sectorPlan ? JSON.parse(JSON.stringify(GS.sectorPlan)) : null,
      lastSectorMain: GS.lastSectorMain || null,
      waveEnemyTotal: GS.waveEnemyTotal,
      spawnTimer: GS.spawnTimer,
      currentHordeWave: GS.currentHordeWave
        ? { ...GS.currentHordeWave, queue: [...GS.currentHordeWave.queue] }
        : null,
      currentWaveConfig: GS.currentWaveConfig
        ? { ...GS.currentWaveConfig, pool: [...(GS.currentWaveConfig.pool || [])] }
        : null,
      runPlayerDeaths: GS.runPlayerDeaths,
      pendingLevy: GS.pendingLevy,
      warCamps: typeof WarCamps !== 'undefined' ? WarCamps.exportState(warCampCtx) : null,
      scoutedWave: GS.scoutedWave ?? -1,
      pendingReinforce: [...GS.pendingReinforce],
      spawnDelayBonus: GS.spawnDelayBonus,
      courierCooldown: GS.courierCooldown,
      courierMessagesUsedThisWave: GS.courierMessagesUsedThisWave,
      courierUsedThisWave: isCourierMessageCapReached(),
      spyUsedThisWave: GS.spyUsedThisWave,
      doctrineUsedThisWave: GS.doctrineUsedThisWave,
      counterDoctrineUsedThisWave: GS.counterDoctrineUsedThisWave,
      expeditionUsedThisWave: GS.expeditionUsedThisWave,
      rallyTimer: GS.rallyTimer,
      firstWallWave: GS.firstWallWave,
      namedBossWave: GS.namedBossWave ? { ...GS.namedBossWave } : null,
      loadout: svc('ContentExpansion') ? svc('ContentExpansion').getLoadout() : 'balanced',
      waveModifiers: { ...GS.waveModifiers },
      pendingWaveMods: { ...GS.pendingWaveMods },
      fallenPool: GS.fallenPool.map((f) => ({ ...f })),
      hallOfVeterans: Veterans.exportHall(),
      // Mid-combat projectiles (arrows/bolts still in flight).
      projectiles: GS.projectiles.map((p) => captureSaveFields(p, {}, null)),
      units: collectAliveUnitSnaps(),
      // Soldiers away on an expedition keep their own list; the expedition itself is in
      // the PlayerCounterEvolution section and gets them back on load.
      expeditionAway: away.filter((u) => u.hp > 0).map((u) => serializeUnitSnap(u)),
      // War camps are saved by WarCamps (kind, health, sector) and rebuilt on load.
      buildings: GS.buildings
        .filter((b) => typeof WarCamps === 'undefined' || !WarCamps.isCamp(b))
        .map((b) =>
          captureSaveFields(
            b,
            {
              id: b.id,
              type: b.type,
              x: b.x,
              y: b.y,
              hp: b.hp,
              maxHp: b.maxHp,
              complete: b.complete,
              owner: b.owner,
              buildProgress: b.buildProgress,
              waveBuildRequired: b.waveBuildRequired || 0,
              waveBuildProgress: b.waveBuildProgress || 0,
              facing: b.facing || null,
              isHamlet: !!b.isHamlet,
              isMerchantGuild: !!b.isMerchantGuild,
              isAcademy: !!b.isAcademy,
              isResearchLab: !!b.isResearchLab,
              isEnemySettlement: !!b.isEnemySettlement,
              isResourceGen: !!b.isResourceGen,
              isSettlement: !!b.isSettlement,
              isWatchtower: !!b.isWatchtower,
              isKeep: !!b.isKeep,
              isMedical: !!b.isMedical,
              isMessHall: !!b.isMessHall,
              isWweAcademy: !!b.isWweAcademy,
              isCrossoverBarracks: !!b.isCrossoverBarracks,
              isPerkMachine: !!b.isPerkMachine,
              academyUnit: b.academyUnit || null,
              crossoverFaction: b.crossoverFaction || null,
              fortressTier: b.fortressTier || 0,
              upgrade: b.upgrade || null,
              upgradeName: b.upgradeName || null,
              garrisonUnitId: b.garrisonUnitId || null,
              slotX: b.slotX,
              slotY: b.slotY,
              castleGroup: b.castleGroup || null,
              enemyFaction: b.enemyFaction || null,
            },
            BUILDING_SAVE_SKIP
          )
        ),
      // The field itself: trees, rocks, barricades, crates and barrels exactly where they are.
      terrain: {
        initialized: !!GS.terrainInitialized,
        decorations: GS.decorations.map((d) => captureSaveFields(d, {}, null)),
      },
      run,
      // Position in the seeded stream (seeded runs only; other rolls use Math.random).
      rng: svc('GameModes')?.getRngState?.() ?? null,
      sessionHighlights: GS.sessionHighlights.map((h) => ({ ...h })),
      campaignVictoryDeclared: !!GS.campaignVictoryDeclared,
      postVictoryEndless: !!GS.postVictoryEndless,
      ngPlusTier: GS.ngPlusTier || 0,
      // Mode rules + advanced difficulty — required so load/quickload keeps fog/horde/challenge.
      advancedMods: svc('AdvancedDifficulty') ? svc('AdvancedDifficulty').getActiveIds() : [],
      modeSession: svc('GameModes') ? svc('GameModes').getSession() : null,
      modules: SaveRegistry.saveAll(),
    };
    return SaveFormat.seal(snap);
  }

  /**
   * A save made when the map still grew holds positions on a larger field. Growth was
   * centred, so the home ground sits in the middle of that field: everything is moved
   * back by the growth offset, which puts the base where it was built, and whatever stood
   * on the added land is brought in to the nearest point of the field. Shots in flight
   * are dropped.
   */
  function fitSaveToField(snap) {
    const legacy = typeof getLegacyWorldSize === 'function' ? getLegacyWorldSize(snap.wave) : null;
    const oldW = Number.isFinite(snap.worldW) ? snap.worldW : legacy?.w || GS.worldW;
    const oldH = Number.isFinite(snap.worldH) ? snap.worldH : legacy?.h || GS.worldH;
    if (oldW <= GS.worldW && oldH <= GS.worldH) return false;
    // The terrain was rolled for this field a moment ago; only what the save carried moves.
    const terrain = GS.decorations;
    const hazards = GS.hazards;
    GS.decorations = [];
    GS.hazards = [];
    GS.projectiles = [];
    shiftWorldEntities(-(oldW - GS.worldW) / 2, -(oldH - GS.worldH) / 2);
    GS.decorations = terrain;
    GS.hazards = hazards;
    for (const u of GS.units) {
      const at = clampPos(u.x, u.y);
      u.x = at.x;
      u.y = at.y;
      if (Number.isFinite(u.postX) && Number.isFinite(u.postY)) {
        const post = clampPos(u.postX, u.postY);
        u.postX = post.x;
        u.postY = post.y;
      }
      if (Number.isFinite(u.holdX) && Number.isFinite(u.holdY)) {
        const hold = clampPos(u.holdX, u.holdY);
        u.holdX = hold.x;
        u.holdY = hold.y;
      }
      if (Number.isFinite(u.targetX)) u.targetX = Math.max(14, Math.min(GS.worldW - 14, u.targetX));
      if (Number.isFinite(u.targetY)) u.targetY = Math.max(20, Math.min(GS.worldH - 8, u.targetY));
      u.path = [];
      u.pathIndex = 0;
      u.spawnSide = u.team === 'enemy' ? 'north' : u.spawnSide;
    }
    for (const b of GS.buildings) {
      const x = Math.max(30, Math.min(GS.worldW - 30, b.x));
      const y = Math.max(44, Math.min(GS.worldH - 30, b.y));
      const dx = x - b.x;
      const dy = y - b.y;
      if (!dx && !dy) continue;
      b.x = x;
      b.y = y;
      if (Number.isFinite(b.slotX)) b.slotX += dx;
      if (Number.isFinite(b.slotY)) b.slotY += dy;
      for (const slot of b.wallSlots || []) {
        if (!slot) continue;
        if (Number.isFinite(slot.x)) slot.x += dx;
        if (Number.isFinite(slot.y)) slot.y += dy;
      }
    }
    invalidateObstacles();
    resolveUnitsInTerrain();
    resetCamera();
    return true;
  }

  /** Build one unit from its saved record. Null when this game has no such unit type. */
  function restoreUnitFromSnap(us, legacy) {
    ensurePlayerUnitDef(us.type);
    const u = createUnit(us.type, us.x, us.y, us.team || 'player');
    if (!u) return null;
    if (us.id) u.id = us.id;
    Object.assign(u, us);
    if (u.team === 'player' && u.soldierName) SoldierNames.remember(u.soldierName);
    else if (u.team === 'player' && !(typeof HeroCast !== 'undefined' && HeroCast.isHero(u.type)))
      u.soldierName = SoldierNames.roll();
    if (legacy) stopPostReturn(u);
    if (u.team === 'player') {
      if (legacy) {
        // Saves before format 3 did not hold a march in progress or the med-tent state:
        // the soldier walks to his post (the order's destination).
        u.manualOrder = false;
        u.medHurt = u.hp < u.maxHp * 0.97;
        u.medPrevHp = u.hp;
      }
      u.holding = !!u.canHunt && !!us.holding;
      // Format 3 saves hunt as it was (a rout or a med-tent walk turns it off); older saves derive it.
      if (legacy)
        u.huntMode = !!u.canHunt && !u.holding && !(u.manualOrder && us.huntMode === false);
      else u.huntMode = !!u.canHunt && !!us.huntMode;
      if (
        u.holding &&
        !u.garrisoned &&
        !u.wallGarrisoned &&
        !u.stationedKeep &&
        !(Number.isFinite(u.holdX) && Number.isFinite(u.holdY))
      ) {
        const hp = clampPos(u.postX ?? u.x, u.postY ?? u.y);
        u.holdX = hp.x;
        u.holdY = hp.y;
      }
    }
    if (u.spawnWave == null) u.spawnWave = GS.wave;
    if (u.tenureApplied == null) u.tenureApplied = 0;
    u.maxHp = Math.max(1, us.maxHp || u.maxHp || 1);
    u.hp = Math.min(u.maxHp, Math.max(1, us.hp || u.hp));
    if (u.isGeneral == null) u.isGeneral = u.type === 'general';
    // Siege / expansion roster combat fields can vanish on older snaps.
    if (u.type === 'ballista') {
      if (!u.projectile) u.projectile = 'arrow';
      if (!(u.siegeMult > 1)) u.siegeMult = 2.2;
      if (u.combatType !== 'ranged' && u.combatType !== 'siege') u.combatType = 'ranged';
    }
    if ((u.combatType === 'ranged' || u.combatType === 'siege') && !u.projectile) {
      u.projectile = 'arrow';
    }
    if (typeof ensureHealerStats === 'function') ensureHealerStats(u);
    if (legacy) {
      if (typeof repairHonorName === 'function') repairHonorName(u);
      if (svc('GameDepth') && u.team === 'player' && svc('GameDepth').isIpHero(u)) {
        svc('GameDepth').applyIpWaveScaling(u, GS.wave);
      }
      if (typeof syncVeteranStatsToTier === 'function') syncVeteranStatsToTier(u);
    }
    // Saves from before deeds existed: a veteran keeps its rank and starts its record now.
    if (us.deeds === undefined) {
      u.deeds = null;
      Veterans.migrate(u);
    }
    // Paths are never saved; the unit asks for a new one on its next step.
    u.path = [];
    u.pathIndex = 0;
    return u;
  }

  /**
   * Put a checked, current-version save on the field. Throws if anything is wrong; the
   * caller (importGameState) then restores what was there before. Returns warnings to show.
   */
  function applySnapshot(snap) {
    const warnings = [];
    const legacy = !!snap.legacy;
    GS.state = 'playing';
    GS.paused = true;
    GS.wave = snap.wave;
    GS.nextWavePlan = null;
    GS.cheatsUsed = !!snap.cheatsUsed;
    GS.tactical = snap.tactical;
    GS.kills = snap.kills || 0;
    GS.misses = snap.misses || 0;
    GS.timeOfDay = snap.timeOfDay;
    GS.nightTimer = snap.nightTimer || 0;
    GS.waveProgress = snap.waveProgress || 0;
    GS.difficultyId = snap.difficultyId || GS.difficultyId;
    // Restore challenge/mode session and modifiers before units/combat use them.
    if (svc('GameModes') && snap.modeSession) {
      svc('GameModes').restoreSession(snap.modeSession);
      // A seeded run carries on from where its stream was, not from the start of it.
      if (Number.isInteger(snap.rng)) svc('GameModes').setRngState?.(snap.rng);
    } else if (svc('AdvancedDifficulty') && Array.isArray(snap.advancedMods)) {
      svc('AdvancedDifficulty').setActive(snap.advancedMods);
    }
    GS.globalHunt = true;
    GS.builderAutoRepair = snap.builderAutoRepair ?? GS.builderAutoRepair;
    GS.tpAwardedForWave = snap.tpAwardedForWave ?? -1;
    GS.runPlayerDeaths = snap.runPlayerDeaths ?? snap.misses ?? 0;
    GS.pendingLevy = snap.pendingLevy ?? 0;
    GS.scoutedWave = snap.scoutedWave ?? -1;
    GS.pendingReinforce = Array.isArray(snap.pendingReinforce) ? [...snap.pendingReinforce] : [];
    GS.spawnDelayBonus = snap.spawnDelayBonus ?? 0;
    GS.courierCooldown = Math.max(0, snap.courierCooldown | 0);
    GS.courierMessagesUsedThisWave = snap.courierMessagesUsedThisWave | 0;
    GS.spyUsedThisWave = !!snap.spyUsedThisWave;
    GS.doctrineUsedThisWave = !!snap.doctrineUsedThisWave;
    GS.counterDoctrineUsedThisWave = !!snap.counterDoctrineUsedThisWave;
    GS.expeditionUsedThisWave = !!snap.expeditionUsedThisWave;
    GS.rallyTimer = snap.rallyTimer ?? 0;
    GS.firstWallWave = snap.firstWallWave ?? null;
    GS.namedBossWave = snap.namedBossWave ? { ...snap.namedBossWave } : null;
    if (snap.waveModifiers) GS.waveModifiers = { ...snap.waveModifiers };
    if (snap.pendingWaveMods) GS.pendingWaveMods = { ...snap.pendingWaveMods };
    GS.fallenPool = Array.isArray(snap.fallenPool) ? snap.fallenPool.map((f) => ({ ...f })) : [];
    Veterans.setHall(snap.hallOfVeterans);
    GS.sessionHighlights = Array.isArray(snap.sessionHighlights)
      ? snap.sessionHighlights.map((h) => ({ ...h }))
      : [];
    // Older saves past wave 100 predate the flag; treat them as already won.
    GS.campaignVictoryDeclared =
      snap.campaignVictoryDeclared ?? (snap.wave || 0) > CAMPAIGN_VICTORY_WAVE;
    // Saves from before the victory choice kept playing past 100, which is an endless run.
    GS.postVictoryEndless =
      snap.postVictoryEndless ??
      (!!GS.campaignVictoryDeclared && (snap.wave || 0) > CAMPAIGN_VICTORY_WAVE);
    GS.ngPlusTier = Math.max(0, Math.floor(Number(snap.ngPlusTier) || 0));
    // Short-lived state that is not saved starts clean.
    GS.moraleCascadeState = { recentBreaks: [], cascade: false, tick: 0 };
    GS.huntSweep = false;
    GS.huntQuietTicks = 0;
    GS.huntFront = Infinity;
    GS.moveMarkers = [];
    GS.attackMarks = [];
    GS.selectedUnitId = null;
    GS.selectedUnitIds = [];
    GS.bossTrackId = null;
    GS.multiFrontPlan = null;
    GS.spawnSquadLeft = 0;
    // Run fields with no column of their own (see SAVE_RUN_FIELDS).
    const run = snap.run && typeof snap.run === 'object' ? snap.run : {};
    for (const key of SAVE_RUN_FIELDS) {
      if (!(key in run) || key === 'hazards') continue;
      const v = run[key];
      GS[key] = v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
    }
    applyWorldSize(GS.wave);
    releaseAllUnits();
    GS.projectiles = [];
    releaseAllBuildings();
    if (snap.terrain && Array.isArray(snap.terrain.decorations)) {
      // The saved field, exactly: nothing is rolled again.
      GS.decorations = snap.terrain.decorations.map((d) => JSON.parse(JSON.stringify(d)));
      GS.hazards = Array.isArray(run.hazards) ? JSON.parse(JSON.stringify(run.hazards)) : [];
      GS.terrainInitialized = snap.terrain.initialized !== false;
    } else {
      // A save from before format 3 has no terrain in it.
      GS.decorations = [];
      generateBattlefield();
    }
    let droppedBuildings = 0;
    for (const bs of snap.buildings || []) {
      if (!BuildDefs[bs.type]) {
        droppedBuildings++;
        continue;
      }
      const b = createBuilding(bs.type, bs.x, bs.y, bs.owner || 'player', {
        facing: bs.facing || undefined,
        slotX: bs.slotX,
        slotY: bs.slotY,
        castleGroup: bs.castleGroup || undefined,
      });
      if (bs.id) b.id = bs.id;
      Object.assign(b, bs);
      if (bs.complete) b.complete = true;
      // Re-assert def flags so old saves missing fields still work.
      const def = BuildDefs[b.type];
      if (def) {
        if (def.isResearchLab) b.isResearchLab = true;
        if (def.isAcademy) b.isAcademy = true;
        if (def.academyUnit) b.academyUnit = b.academyUnit || def.academyUnit;
        if (def.isEnemySettlement) b.isEnemySettlement = true;
        if (def.isResourceGen) b.isResourceGen = true;
        if (def.isHamlet) b.isHamlet = true;
        if (def.isMerchantGuild) b.isMerchantGuild = true;
        if (def.isWatchtower) b.isWatchtower = true;
        if (def.isKeep) b.isKeep = true;
        if (def.isWweAcademy) b.isWweAcademy = true;
        if (def.isCrossoverBarracks) b.isCrossoverBarracks = true;
      }
      if (b.type === 'wall' && b.facing) {
        b.wallSlots = getWallSlotPositions(b.facing, b.x, b.y);
      }
      normalizeEnemyEconomyBuilding(b);
      ensureBuildingHealth(b);
      GS.buildings.push(b);
    }
    let droppedUnits = 0;
    for (const us of snap.units || []) {
      const u = restoreUnitFromSnap(us, legacy);
      if (!u) {
        droppedUnits++;
        continue;
      }
      GS.units.push(u);
    }
    // Re-link wall slots: walls are rebuilt with empty slots, so a saved wall garrison
    // would otherwise stand frozen while other footmen marched to the same slot.
    for (const u of GS.units) {
      if (!u.wallGarrisoned || u.team !== 'player') continue;
      const wall = GS.buildings.find((b) => b.id === u.wallGarrisoned);
      const slot = wall && wall.hp > 0 ? wall.wallSlots?.[u.wallSlotIndex] : null;
      if (slot && !slot.unitId) slot.unitId = u.id;
      else {
        u.wallGarrisoned = null;
        u.wallSlotIndex = null;
      }
    }
    // Re-link outpost garrisons from unit.garrisoned (building.garrisonUnitId may be stale).
    for (const u of GS.units) {
      if (!u.garrisoned || u.team !== 'player') continue;
      const op = GS.buildings.find((b) => b.id === u.garrisoned);
      if (op && op.hp > 0) {
        op.garrisonUnitId = u.id;
        if (legacy) u.range = getEffectiveRange(u);
      } else {
        u.garrisoned = null;
      }
    }
    // Re-link builder projects so mid-construction sites aren't abandoned after load.
    for (const us of snap.units || []) {
      if (us.type !== 'builder' && us.combatType !== 'builder') continue;
      const builder = GS.units.find((u) => u.id === us.id);
      if (!builder) continue;
      builder.building = null;
      builder.buildQueue = [];
      if (us.buildTargetId) {
        const site = GS.buildings.find((b) => b.id === us.buildTargetId);
        if (site && !site.complete) builder.building = site;
      }
      if (Array.isArray(us.buildQueueIds)) {
        for (const item of us.buildQueueIds) {
          if (!item) continue;
          if (item.id) {
            const site = GS.buildings.find((b) => b.id === item.id);
            if (site && !site.complete) builder.buildQueue.push(site);
          } else if (item.pending && item.type) {
            builder.buildQueue.push({
              type: item.type,
              x: item.x,
              y: item.y,
              pending: true,
              facing: item.facing || undefined,
            });
          }
        }
      }
    }
    for (const u of GS.units) {
      delete u.buildTargetId;
      delete u.buildQueueIds;
    }
    GS.spawnQueue = JSON.parse(JSON.stringify(snap.spawnQueue || []));
    {
      // Today's sectors. A save from before the three sectors has none: the enemies
      // still queued are given sectors when the first of them spawns.
      const mf = svc('MultiFrontSiege');
      GS.sectorPlan = mf && snap.sectorPlan ? mf.restorePlan(snap.sectorPlan, GS.wave) : null;
      const saved = Array.isArray(snap.spawnSectors) ? snap.spawnSectors : [];
      GS.spawnSectors =
        mf && GS.sectorPlan && saved.length === GS.spawnQueue.length && saved.every(mf.isSector)
          ? [...saved]
          : [];
      GS.lastSectorMain = mf?.isSector(snap.lastSectorMain) ? snap.lastSectorMain : null;
      mf?.setCurrentPlan(GS.sectorPlan);
    }
    GS.waveEnemyTotal = snap.waveEnemyTotal || GS.spawnQueue.length;
    GS.spawnTimer = snap.spawnTimer || 0;
    GS.currentHordeWave = snap.currentHordeWave
      ? { ...snap.currentHordeWave, queue: [...(snap.currentHordeWave.queue || [])] }
      : null;
    GS.currentWaveConfig = snap.currentWaveConfig
      ? { ...snap.currentWaveConfig, pool: [...(snap.currentWaveConfig.pool || [])] }
      : getWaveConfig(GS.wave);
    sanitizeTactical();
    invalidateObstacles();
    GS.spatialStaticDirty = true;
    normalizeEnemyEconomyBuildings();
    GS.enemyEconomyEverSpawned = false;
    GS.northernHoldEverSpawned = false;
    for (const b of GS.buildings) noteEnemyEconomyPresence(b);
    refreshUnitCounts();
    resetCamera();
    GS.spatialFrame = -1;
    if (svc('ContentExpansion')?.setLoadout && snap.loadout) {
      svc('ContentExpansion').setLoadout(snap.loadout, { silent: true });
    }
    // Modules keep tick stamps with 0 meaning "never": run the clock on from the saved tick so
    // restored stamps stay above 0. Never wound back, so live stamps in other modules stay valid.
    GS.updateTick = Math.max(GS.updateTick | 0, Number(snap.simTick) || 0, 1);
    // Every registered module section (siege loop, research, economy, factions, ...).
    const loaded = SaveRegistry.loadAll(snap.modules, siegeCtx);
    if (!loaded.ok) {
      const first = loaded.errors[0];
      throw new Error(`${first.name}: ${first.message}`);
    }
    // Soldiers who were away on an expedition go back to their party, off the field.
    const awaySnaps = Array.isArray(snap.expeditionAway) ? snap.expeditionAway : [];
    if (awaySnaps.length) {
      const awayUnits = [];
      for (const us of awaySnaps) {
        const u = restoreUnitFromSnap(us, legacy);
        if (u) awayUnits.push(u);
        else droppedUnits++;
      }
      const stray = svc('PlayerCounterEvolution')?.attachAway
        ? svc('PlayerCounterEvolution').attachAway(awayUnits)
        : awayUnits;
      // No party to rejoin (module missing, or the party is gone): they stand at the muster.
      stray.forEach((u, i) => {
        u.x = GS.worldW / 2 + (i - (stray.length - 1) / 2) * 18;
        u.y = GS.deployY;
        GS.units.push(u);
      });
      if (stray.length) refreshUnitCounts();
    }
    // Restore in-flight projectiles after units exist so target/source ids resolve.
    GS.projectiles = Array.isArray(snap.projectiles)
      ? snap.projectiles.map((p) => ({
          ...p,
          type: p.type || 'arrow',
          damage: p.damage || 10,
          team: p.team || 'player',
          speed: p.speed || 6,
          accuracy: p.accuracy ?? 40,
          targetId: p.targetId || null,
          sourceId: p.sourceId || null,
          sourceType: p.sourceType || null,
          splash: !!p.splash,
          angle: p.angle || 0,
        }))
      : [];
    if (typeof WarCamps !== 'undefined') WarCamps.importState(snap.warCamps || null, warCampCtx);
    fitSaveToField(snap);
    wireGameContext();
    // Tomorrow's host: the saved plan, or for an older save made at night a fresh roll,
    // so the field-edge markers still tell the truth.
    GS.nextWavePlan = restoreNextWavePlan(snap.nextWavePlan, GS.wave);
    if (GS.cheatsUsed) SiegeLoop.voidRun();
    const rolledAnew = !GS.nextWavePlan && isNightPhase();
    if (rolledAnew) GS.nextWavePlan = planWaveSectors(GS.wave + 1);
    // A saved preview is kept as it was, unless the plan behind it was just rolled again.
    if (rolledAnew || !snap.modules?.SiegeLoop?.data?.preview) SiegeLoop.refreshPreview(siegeCtx);
    if (svc('UX')) svc('UX').onPauseChanged(true);
    syncInteractionState({ refreshCounts: true });
    const modNote = svc('ModLoader')?.missingWarning?.();
    if (modNote) warnings.push(modNote);
    if (droppedUnits) {
      warnings.push(
        `${droppedUnits} soldier${droppedUnits === 1 ? '' : 's'} in this save belong${droppedUnits === 1 ? 's' : ''} to content that is not loaded (a mod that is off?) and ${droppedUnits === 1 ? 'was' : 'were'} left out.`
      );
    }
    if (droppedBuildings) {
      warnings.push(
        `${droppedBuildings} building${droppedBuildings === 1 ? '' : 's'} in this save belong${droppedBuildings === 1 ? 's' : ''} to content that is not loaded and ${droppedBuildings === 1 ? 'was' : 'were'} left out.`
      );
    }
    return warnings;
  }

  let lastLoadReport = { ok: true, error: null, warnings: [], fromVersion: null };

  /** What the last importGameState() did: { ok, error, warnings, fromVersion }. */
  function getLastLoadReport() {
    return { ...lastLoadReport, warnings: [...lastLoadReport.warnings] };
  }

  /**
   * Load a save. It is checked first (version, checksum, migration to the current format,
   * shape) and refused with a reason before anything is touched. If applying it still
   * fails, the game that was running is put back. Returns true or false; the reason is in
   * getLastLoadReport().error.
   */
  function importGameState(raw) {
    const prep = SaveFormat.prepare(raw);
    if (!prep.ok) {
      lastLoadReport = { ok: false, error: prep.error, warnings: [], fromVersion: null };
      return false;
    }
    const before = { state: GS.state, paused: GS.paused };
    let backup = null;
    if (GS.state === 'playing') {
      try {
        backup = exportGameState();
      } catch (_) {
        backup = null;
      }
    }
    try {
      const warnings = applySnapshot(prep.snap);
      lastLoadReport = { ok: true, error: null, warnings, fromVersion: prep.fromVersion };
      for (const w of warnings) showMessage(w, 360);
      return true;
    } catch (e) {
      let restored = false;
      if (backup) {
        try {
          const back = SaveFormat.prepare(backup);
          if (back.ok) {
            applySnapshot(back.snap);
            restored = true;
          }
        } catch (_) {
          restored = false;
        }
      }
      GS.state = before.state;
      GS.paused = before.paused;
      if (!restored && before.state === 'playing') {
        // Nothing to go back to: leave an empty, consistent field, not half of a save.
        releaseAllUnits();
        releaseAllBuildings();
        GS.projectiles = [];
        GS.spawnQueue = [];
        refreshUnitCounts();
      }
      const why = e && e.message ? e.message : 'unknown error';
      lastLoadReport = {
        ok: false,
        error: `This save could not be loaded (${why}).${restored ? ' Your game was put back as it was.' : ''}`,
        warnings: [],
        fromVersion: prep.fromVersion,
      };
      console.warn('Save load failed:', e);
      return false;
    }
  }

  /** Why this run may not be saved right now, in words for the player; null when it may. */
  function getSaveBlockReason() {
    if (GS.state !== 'playing') return 'There is no game in progress to save.';
    if (GS.creativeMode) return 'Saving is off in Creative Mode.';
    if (svc('GameModes') && !svc('GameModes').canQuickSave()) {
      return 'Saving is off in Ironman and challenge runs.';
    }
    return null;
  }

  function quickSave() {
    if (GS.creativeMode) {
      showMessage('Quick save disabled in Creative Mode.');
      return false;
    }
    if (svc('GameModes') && !svc('GameModes').canQuickSave()) {
      showMessage('Quick save disabled — Ironman or challenge run.');
      return false;
    }
    const snap = exportGameState();
    if (!snap) {
      showMessage('Cannot save now.');
      return false;
    }
    if (typeof SaveThumbnail !== 'undefined') {
      const thumb = SaveThumbnail.capture({ canvas: GS.canvas, minimapData: getMinimapData() });
      if (thumb) snap.thumbnail = thumb;
    }
    try {
      localStorage.setItem(QUICKSAVE_KEY, JSON.stringify(snap));
      showMessage(`Quick saved at wave ${GS.wave}.`, 200);
      if (svc('UX')?.updatePauseMenu) svc('UX').updatePauseMenu(getState());
      return true;
    } catch (_) {
      showMessage('Quick save failed.', 160);
      return false;
    }
  }

  function quickLoad() {
    if (svc('GameModes') && !svc('GameModes').canQuickSave()) {
      showMessage('Quick load disabled — Ironman or challenge run.');
      return false;
    }
    try {
      const raw = localStorage.getItem(QUICKSAVE_KEY);
      if (!raw) {
        showMessage('No quick save found.');
        return false;
      }
      const snap = JSON.parse(raw);
      if (!importGameState(snap)) {
        showMessage(lastLoadReport.error || 'Quick load failed.', 360);
        return false;
      }
      showMessage(`Quick load: wave ${GS.wave}.`, 240);
      return true;
    } catch (_) {
      showMessage('Quick load failed.', 160);
      return false;
    }
  }

  return {
    bind,
    SAVE_VERSION,
    activeSectorPlan,
    exportGameState,
    getLastLoadReport,
    getSaveBlockReason,
    importGameState,
    isSupportedSaveVersion,
    nextSectorIntel,
    quickLoad,
    quickSave,
  };
})();
