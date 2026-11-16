/**
 * Campaign announcements, academy era bootstrap and event bus wiring.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameCampaign = (() => {
  const {
    allowsCampaignEconomyVictory,
    gameRandom,
    isPlayerEliminated,
    playSfx,
    releaseUnitRecord,
    svc,
  } = GameCore;
  const GS = GameState;
  const {
    clampPos,
    generateBattlefield,
    invalidateObstacles,
    isHordeWave,
    isSiegeWave,
    releaseAllBuildings,
    releaseAllUnits,
    sanitizeTactical,
  } = GameField;
  const { resetCamera } = GameCamera;
  const { addHighlight, applyPlayerStatMods, spawnUnit } = GameArmy;
  const {
    countLiveEnemyEconomyBuildings,
    countLiveNorthernHolds,
    isTargetableEnemyStructure,
    noteEnemyEconomyPresence,
    onBuildingComplete,
  } = GameBuildings;
  const { isNightPhase } = GameDayNight;
  let TP_SANITY_CAP,
    ach,
    applyWorldSize,
    endGame,
    getAsymmetricContext,
    invalidateStateCache,
    refreshUnitCounts,
    showMessage;
  function bind(api) {
    ({
      TP_SANITY_CAP,
      ach,
      applyWorldSize,
      endGame,
      getAsymmetricContext,
      invalidateStateCache,
      refreshUnitCounts,
      showMessage,
    } = api);
  }

  /** Faction hazards on the field at once; a hazard wave adds at most two. */
  const HAZARD_FIELD_CAP = 4;

  function checkPlayerElimination() {
    if (GS.state !== 'playing') return;
    if (GS.creativeMode && GS.creativeSettings.noGameOver) return;
    if (!isPlayerEliminated()) return;
    showMessage('Your forces are gone — no troops or training halls remain. The realm falls.', 300);
    endGame(false);
  }

  /** Where the host forms up before it comes on: across the field, above the middle. */
  function getEnemyAdvanceGoal(_side) {
    return { x: GS.worldW * 0.5, y: Math.max(GS.worldH * 0.5 - 90, 48) };
  }

  function getEnemyAdvancePoint(unit) {
    let hash = 0;
    for (let i = 0; i < unit.id.length; i++) hash = (hash + unit.id.charCodeAt(i) * (i + 1)) % 200;
    const spread = (hash - 100) * 0.35;
    const goal = getEnemyAdvanceGoal();
    let x = unit.x + spread;
    // While it musters, a squad stays in the third of the muster zone it entered by.
    if (unit.entrySector && !unit.mustered && svc('MultiFrontSiege')) {
      x = svc('MultiFrontSiege').clampToSector(x, unit.entrySector, GS.worldW);
    }
    return clampPos(x, Math.min(unit.y + 110, goal.y));
  }

  function announceAttackSides() {
    const plan = GS.sectorPlan;
    const mf = svc('MultiFrontSiege');
    if (!plan || !mf || plan.sectors.length <= 1) return;
    const parts = plan.sectors.map((s) => `${mf.SECTOR_LABELS[s]} ${plan.counts[s] || 0}`);
    showMessage(
      `The host enters on ${mf.describeSectors(plan.sectors)}: ${parts.join(', ')}.`,
      300
    );
  }

  function announceAcademyEra() {
    if (GS.wave !== ACADEMY_ERA_WAVE) return;
    // The era module announces wave 100 itself; one banner is enough.
    if (typeof ProgressionRestarts !== 'undefined' && !GS.creativeMode) return;
    addHighlight('era', 'Academy Era begins');
    showMessage(
      'Wave 100: Academy Era! Grow your line and weather heavier northern assaults.',
      380
    );
    svc('FloatingText').status(GS.worldW / 2, GS.worldH / 2, 'ACADEMY ERA', '#c0a040');
    playSfx('reinforce');
  }

  /** Past the victory the host grows every wave; every 25th wave says by how much. */
  function announceHostGrowth() {
    const w = GS.wave;
    if (GS.creativeMode || w <= ACADEMY_ERA_WAVE || w % 25 !== 0) return;
    const at = (n) => getWaveConfig(n);
    const hp = Math.round((at(w).hpScale / at(ACADEMY_ERA_WAVE).hpScale) * 100);
    const count = Math.round((at(w).count / at(ACADEMY_ERA_WAVE).count) * 100);
    showMessage(
      `Wave ${w}: the host fields ${count}% of its wave 100 numbers at ${hp}% of its strength.`,
      380
    );
    svc('FloatingText').status(GS.worldW / 2, 56, `HOST ${hp}%`, '#ff8060');
    playSfx('waveStart');
  }

  function announceKingdomEvolution() {
    if (GS.creativeMode || typeof isProgressionMilestone !== 'function') return;
    if (!isProgressionMilestone(GS.wave)) return;
    const milestone = getProgressionMilestone(GS.wave);
    const evo =
      typeof getKingdomEvolutionStage === 'function' ? getKingdomEvolutionStage(GS.wave) : null;
    const framed = LoreData?.CAMPAIGN_NARRATIVE?.waves?.[GS.wave];
    const title = milestone?.name || evo?.name || `Wave ${GS.wave}`;
    const tagline = milestone?.tagline || evo?.tagline || '';
    addHighlight('era', title);
    if (!framed) {
      showMessage(`Chronicle — Wave ${GS.wave}: ${title}. ${tagline}`, 400);
    }
    svc('FloatingText').status(
      GS.worldW / 2,
      48,
      (milestone?.shortName || evo?.shortName || title).toUpperCase(),
      milestone?.color || evo?.color || '#c0a040'
    );
    if (GS.wave === KINGDOM_STAGE_WAVES.RISING) playSfx('reinforce');
    if (GS.wave === 150) {
      showMessage('Wave 150 — mid-war pressure rises. Expect denser packs and named threats.', 300);
    }
    if (GS.wave === KINGDOM_STAGE_WAVES.DOMINION) {
      showMessage(
        'Wave 200 — late-war escalation. Hold the northern line as assaults grow heavier.',
        320
      );
    }
  }

  function isKingdomActionUnlocked(actionDef) {
    if (actionDef?.waveMin && GS.wave < actionDef.waveMin) return false;
    if (!actionDef?.kingdomStage) return true;
    if (typeof getKingdomStageBuffs !== 'function') return false;
    return getKingdomStageBuffs(GS.wave).stage >= actionDef.kingdomStage;
  }

  function bootstrapPlaceComplete(type, x, y, owner = 'player') {
    const b = createBuilding(type, x, y, owner);
    const def = BuildDefs[type];
    b.buildProgress = def?.buildTime || 0;
    b.complete = true;
    if (def?.waveBuildTime) {
      b.waveBuildRequired = def.waveBuildTime;
      b.waveBuildProgress = def.waveBuildTime;
    }
    GS.buildings.push(b);
    onBuildingComplete(b);
    return b;
  }

  function bootstrapSpawnArmy(rows) {
    let ox = GS.worldW / 2 - 90;
    for (const { type, count } of rows) {
      for (let i = 0; i < count; i++) {
        const u = spawnUnit(
          type,
          ox + (i % 4) * 22,
          GS.deployY - 10 - Math.floor(i / 4) * 24,
          'player'
        );
        applyPlayerStatMods(u);
        u.targetY = GS.rallyY;
        u.huntMode = !!u.canHunt;
        GS.units.push(u);
      }
      ox += 34;
    }
  }

  function bootstrapAcademyEraStart(targetWave) {
    const tw = Math.max(ACADEMY_ERA_WAVE, Math.min(targetWave || 105, 500));
    releaseAllUnits();
    releaseAllBuildings();
    GS.wave = tw;
    GS.tactical =
      tw >= RTS_ERA_WAVE ? 145 : tw >= ACADEMY_ERA_WAVE + ACADEMY_HYBRID_WAVES ? 120 : 105;
    applyWorldSize(GS.wave);
    generateBattlefield();
    invalidateObstacles();
    resetCamera();
    const cx = GS.worldW / 2;
    const wy = GS.rallyY - 50;
    for (let i = -3; i <= 3; i++) bootstrapPlaceComplete('wall', cx + i * 28, wy);
    bootstrapPlaceComplete('outpost', cx, wy - 35);
    bootstrapPlaceComplete('hamlet', cx - 130, wy - 90);
    bootstrapPlaceComplete('hamlet', cx + 130, wy - 90);
    if (tw >= ACADEMY_ERA_WAVE + 10) bootstrapPlaceComplete('merchant_guild', cx, wy - 120);
    bootstrapPlaceComplete('training_ground', cx, wy - 25);

    bootstrapSpawnArmy([
      { type: 'knight', count: 5 },
      { type: 'archer', count: 6 },
      { type: 'footman', count: 4 },
      { type: 'mage', count: 2 },
      { type: 'builder', count: 3 },
      { type: 'sapper', count: 2 },
    ]);
    if (tw >= RTS_ERA_WAVE) {
      bootstrapSpawnArmy([
        { type: 'knight', count: 4 },
        { type: 'archer', count: 4 },
      ]);
    }
    if (svc('Research')) svc('Research').grantBootstrapUnlocks(tw);
    invalidateObstacles();

    GS.timeOfDay = 'night';
    GS.nightTimer = Math.floor(
      NIGHT_PREP_TICKS * (svc('GameModes') ? svc('GameModes').getNightPrepMult() : 1)
    );
    addHighlight('era', `Academy Era, wave ${tw}`);
    if (tw === ACADEMY_ERA_WAVE) {
      announceAcademyEra();
    } else {
      showMessage(
        `Academy Era, wave ${tw}. Post ranked veterans at the Training Ground and hold the one field.`,
        380
      );
      svc('FloatingText').status(GS.worldW / 2, GS.worldH / 2, 'ACADEMY ERA', '#c0a040');
    }
    refreshUnitCounts();
    invalidateStateCache();
  }

  function maybeCampaignNarrative() {
    if (GS.creativeMode || typeof LoreData === 'undefined') return;
    const beats = LoreData.ERA_BEATS?.filter((b) => b.wave === GS.wave) || [];
    for (const beat of beats) addHighlight('campaign', beat.name);

    const framed =
      typeof StoryLore !== 'undefined'
        ? StoryLore.getWaveNarrative(GS.wave)
        : LoreData.CAMPAIGN_NARRATIVE?.waves?.[GS.wave];
    if (framed) {
      showMessage(`Chronicle — ${framed.hook}`, 420);
      if (framed.sub) showMessage(framed.sub, 380);
      svc('FloatingText').status(GS.worldW / 2, 64, framed.title.toUpperCase(), '#c0a040');
      if (typeof StoryLore !== 'undefined' && StoryLore.getDominantBranch) {
        StoryLore.checkBranchBeat?.(GS.wave, StoryLore.getDominantBranch());
      }
      return;
    }
    const hookBeat = beats.find((b) => [5, 25, 31, 50, 316, 1000].includes(GS.wave));
    if (hookBeat) showMessage(`Chronicle — ${hookBeat.hook}`, 380);
  }

  function onNamedBossSlain(unit) {
    if (!unit?.isNamedBoss || GS.creativeMode) return;
    const name = unit.bossName || EnemyDefs[unit.type]?.bossName || unit.type;
    const title = unit.bossTitle || EnemyDefs[unit.type]?.bossTitle || '';
    addHighlight('boss', `Warlord slain — ${name}`);
    if (!GS.campaignNarrativeFlags.firstNamedBoss) {
      GS.campaignNarrativeFlags.firstNamedBoss = true;
      const narrative = LoreData?.CAMPAIGN_NARRATIVE?.firstBoss;
      const hook =
        narrative?.hook ||
        `The Crown records your first named warlord defeated: ${name}. The host hesitates.`;
      showMessage(`Chronicle — ${hook}`, 420);
      if (narrative?.sub) showMessage(narrative.sub, 360);
      svc('FloatingText').status(
        GS.worldW / 2,
        72,
        (narrative?.title || 'WARLORD SLAIN').toUpperCase(),
        '#ffd040'
      );
      if (title) svc('FloatingText').status(GS.worldW / 2, 88, title.toUpperCase(), '#ff9070');
    } else {
      showMessage(`${name} falls!${title ? ` ${title}` : ''}`, 280);
    }
    if (svc('GameEvents')) {
      svc('GameEvents').emit(svc('GameEvents').GameEvent.BOSS_SLAIN, {
        unit,
        wave: GS.wave,
        bossType: unit.type,
        name,
        title,
      });
    }
    ach('kill', { enemyType: unit.type, elite: true, namedBoss: true, wave: GS.wave });
  }

  function checkCampaignEconomyVictory() {
    if (!allowsCampaignEconomyVictory() || !GS.enemyEconomyEverSpawned) return;
    const rtsWave = typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200;
    if (GS.wave >= rtsWave) {
      if (countLiveEnemyEconomyBuildings() > 0) return;
      triggerCampaignEconomyVictory();
      return;
    }
    if (!GS.northernHoldEverSpawned || GS.wave < 40) return;
    if (countLiveNorthernHolds() > 0) return;
    triggerCampaignEconomyVictory();
  }

  function triggerCampaignEconomyVictory() {
    if (GS.state !== 'playing') return;
    GS.victoryReason = 'economy';
    const narrative = LoreData?.CAMPAIGN_NARRATIVE?.economyVictory;
    addHighlight('campaign', narrative?.title || 'Northern holds fallen');
    showMessage(
      `Chronicle — ${narrative?.hook || 'All enemy northern settlements destroyed — campaign won!'}`,
      480
    );
    if (narrative?.sub) showMessage(narrative.sub, 400);
    svc('FloatingText').status(
      GS.worldW / 2,
      GS.worldH / 2 - 20,
      (narrative?.title || 'CAMPAIGN WON').toUpperCase(),
      '#80ffa0'
    );
    endGame(true);
  }

  GS._gameEventBusWired = false;

  /** Register lifecycle subscribers — keeps module hooks out of game-loop call sites. */
  function wireGameEventBus() {
    if (GS._gameEventBusWired || !svc('GameEvents')) return;
    GS._gameEventBusWired = true;
    const E = svc('GameEvents').GameEvent;
    const fx = (x, y, text, color) => svc('FloatingText').status(x, y, text, color);

    svc('GameEvents').on(E.GAME_START, () => {
      if (svc('FactionDepth')) svc('FactionDepth').onGameStart();
    });

    svc('GameEvents').on(E.NIGHT_BEGIN, (p) => {
      if (svc('FactionDepth')) {
        svc('FactionDepth').checkMasteryChallenges(p.wave, p.playerUnits, {
          misses: p.misses,
          playerDeaths: p.playerDeaths,
        });
      }
      if (svc('Legacy')) {
        svc('Legacy').onWaveComplete(p.wave, { difficulty: p.difficulty });
      }
      if (typeof FoundationalMedievalLayer !== 'undefined') {
        FoundationalMedievalLayer.onWaveComplete(p.wave, {
          wave: p.wave,
          showMessage,
          addHighlight,
        });
      }
      if (svc('Chronicles')) {
        svc('Chronicles').appendWaveReport(p.wave, p.chronicleReport);
      }
      if (svc('AsymmetricWarfare')) {
        svc('AsymmetricWarfare').onWaveEnd(p.wave, {
          enemySitesCleared: p.enemySitesCleared,
          northernKills: 0,
          structuresRazed: p.structuresRazed,
        });
      }
      if (svc('SettlementRaids') && svc('SettlementRaids').isActive(p.wave)) {
        p.raidSnap =
          svc('SettlementRaids').refreshMissions(GS.buildings, p.wave, {
            isAttackable: isTargetableEnemyStructure,
          }) || [];
      }
      if (svc('FactionReputation')) {
        svc('FactionReputation').onWaveEnd(p.wave, { hooks: { showMessage } });
      }
      if (svc('NeutralRelations')) {
        svc('NeutralRelations').onWaveEnd(p.wave, { hooks: { showMessage } });
      }
      if (svc('DynamicMapEvents')) {
        svc('DynamicMapEvents').prepareNextEvent(p.wave + 1, {
          worldW: GS.worldW,
          rallyY: GS.rallyY,
          rng: gameRandom,
          hooks: { showMessage, addHighlight, floatingText: fx },
        });
      }
    });

    svc('GameEvents').on(E.WAVE_START, (p) => {
      if (p.phase !== 'prep') return;
      if (svc('Research') && svc('Research').onWaveStart) svc('Research').onWaveStart();
      if (svc('PlayerCounterEvolution')) {
        svc('PlayerCounterEvolution').resolveExpeditions(p.wave, {
          units: GS.units,
          spawnUnit,
          applyPlayerMods: applyPlayerStatMods,
          rng: gameRandom,
          unitName: (u) =>
            typeof getUnitDisplayName === 'function' ? getUnitDisplayName(u) : u.type,
          // A soldier lost on the march is a real loss: counted, and his record released.
          loseUnit: (u) => {
            GS.runPlayerDeaths++;
            releaseUnitRecord(u);
          },
          globalHunt: GS.globalHunt,
          deployX: GS.worldW / 2,
          deployY: GS.deployY,
          rallyY: GS.rallyY,
          worldW: GS.worldW,
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
          hooks: { showMessage, floatingText: fx },
        });
      }
      // Hazards are laid only when the night's trap omen was left to stand.
      const FH = svc('FactionHazards');
      if (FH && svc('DynamicMapEvents')?.hazardsLaid(p.wave)) {
        // A full field gives up its oldest hazard, so every hazard wave lays something new.
        if (p.hazards.length >= HAZARD_FIELD_CAP) p.hazards = p.hazards.slice(1 - HAZARD_FIELD_CAP);
        const fresh = FH.spawnInitial(GS.worldW, GS.worldH, p.territoryTier, GS.rallyY, p.wave, {
          maxHazards: Math.min(2, HAZARD_FIELD_CAP - p.hazards.length),
          rng: gameRandom,
        });
        const res = FH.onWaveStart(p.hazards.concat(fresh), p.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          rallyY: GS.rallyY,
          territoryTier: p.territoryTier,
          rng: gameRandom,
          noTopUp: true,
          showMessage,
        });
        p.hazards = res.hazards;
        const names = [...new Set(fresh.map((h) => h.label))].join(' and ');
        if (names) {
          showMessage(`Field condition: ${names} laid across the field. Mages can dispel it.`, 340);
        }
      }
      if (svc('NeutralWildlife')) {
        svc('NeutralWildlife').onWaveStart(p.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          rallyY: GS.rallyY,
          territoryTier: p.territoryTier,
          spawnUnit: (u) => GS.units.push(u),
          hooks: { showMessage, addHighlight, floatingText: fx },
        });
      }
      if (svc('NeutralRelations')) {
        svc('NeutralRelations').onWaveStart(p.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          rallyY: GS.rallyY,
          territoryTier: p.territoryTier,
          spawnUnit: (u) => GS.units.push(u),
          rng: gameRandom,
          hooks: { showMessage, floatingText: fx },
        });
      }
      if (svc('CompanyTraining')) {
        svc('CompanyTraining').onWaveStart(p.wave, GS.units);
      }
      if (svc('AsymmetricWarfare')) {
        const asymCtx = getAsymmetricContext();
        p.hostLvl = svc('AsymmetricWarfare').onWaveStart(p.wave, asymCtx);
        svc('AsymmetricWarfare').checkHostLevelAnnouncements(p.wave, {
          showMessage,
          addHighlight,
          floatingText: fx,
          worldW: GS.worldW,
          worldH: GS.worldH,
        });
        if (p.hostLvl?.delta > 0 && p.wave > 5) {
          const snap = svc('AsymmetricWarfare').getStateSnapshot(asymCtx);
          if (snap.balance === 'host_advantage') {
            showMessage(
              `Host outpaces your command — macro harder or micro the line. (${snap.hostSummary})`,
              320
            );
          }
        }
      }
    });

    svc('GameEvents').on(E.WAVE_START, (p) => {
      if (p.phase !== 'assault') return;
      if (svc('FactionDepth')) {
        svc('FactionDepth').onWaveStart(p.playerUnits);
      }
    });

    svc('GameEvents').on(E.ENEMY_SLAIN, (p) => {
      if (svc('Research') && svc('Research').onEnemySlain) {
        const eternalFx =
          typeof EternalLegacyTree !== 'undefined'
            ? EternalLegacyTree.getCombinedEffects(null, p.wave)
            : null;
        const fmods =
          typeof FoundationalMedievalLayer !== 'undefined'
            ? FoundationalMedievalLayer.getRunModifiers(p.wave)
            : null;
        svc('Research').onEnemySlain(p.unit, {
          wave: p.wave,
          buildings: GS.buildings,
          showMessage,
          floatingText: fx,
          scienceCapMult: eternalFx?.scienceCapMult,
          scienceGainMult: (eternalFx?.scienceGainMult || 1) * (fmods?.scienceGainMult || 1),
          researchSpeedMult: eternalFx?.researchSpeedMult,
        });
      }
      if (svc('FactionReputation')) {
        svc('FactionReputation').onEnemySlain(p.unit, p.wave, { hooks: { showMessage } });
      }
    });

    svc('GameEvents').on(E.BOSS_SLAIN, (p) => {
      if (!svc('MonsterBosses')) return;
      const evo = svc('MonsterBosses').onBossSlain(p.bossType, p.wave);
      if (evo?.nextEvolution?.label) {
        showMessage(
          `${p.name} banished — next encounter: ${evo.nextEvolution.label} cycle with a stronger pack.`,
          300
        );
      }
    });

    svc('GameEvents').on(E.BARRACKS_COMPLETE, (p) => {
      if (svc('FactionDepth')) svc('FactionDepth').onBarracksComplete(p.building);
    });
  }

  function emitNightBegin(playerUnits) {
    if (!svc('GameEvents')) return;
    const E = svc('GameEvents').GameEvent;
    const payload = {
      wave: GS.wave,
      playerUnits,
      misses: GS.runPlayerDeaths,
      playerDeaths: GS.runPlayerDeaths,
      difficulty: GS.difficultyId,
      enemySitesCleared: countLiveEnemyEconomyBuildings() === 0 && GS.enemyEconomyEverSpawned,
      structuresRazed: GS.structuresRazedThisWave,
      chronicleReport: {
        difficulty: GS.difficultyId,
        creative: GS.creativeMode,
        armySize: playerUnits.length,
        tactical: GS.tactical,
        misses: GS.runPlayerDeaths,
        playerDeaths: GS.runPlayerDeaths,
        playerCasualtiesThisWave: GS.playerCasualtiesThisWave,
        siegeWave: isSiegeWave(),
        hordeWave: isHordeWave(),
        bossWave:
          GS.currentWaveConfig?.boss ||
          (svc('GameDepth') && svc('GameDepth').isBossWave?.(GS.wave)),
        sessionKills: GS.kills,
        units: playerUnits,
        highlights: GS.sessionHighlights,
        storyBranch: typeof StoryLore !== 'undefined' ? StoryLore.getDominantBranch?.() : null,
        storySummary: typeof StoryLore !== 'undefined' ? StoryLore.formatChoiceSummary?.(2) : '',
        planetChoice: svc('DynamicMapEvents')?.getStateSnapshot?.(
          GS.wave,
          GS.tactical,
          isNightPhase()
        )?.activeEvent?.choice,
      },
      raidSnap: null,
    };
    svc('GameEvents').emit(E.WAVE_CLEARED, { wave: GS.wave, playerUnits });
    svc('GameEvents').emit(E.NIGHT_BEGIN, payload);
    if (payload.raidSnap?.length && svc('SettlementRaids')) {
      const open = payload.raidSnap.filter((m) => !m.dispatched).length;
      showMessage(
        open
          ? `${open} settlement raid${open > 1 ? 's' : ''} available — select ${svc('SettlementRaids').MIN_STRIKE_FORCE}+ hunters and dispatch.`
          : `${payload.raidSnap.length} strike raid${payload.raidSnap.length > 1 ? 's' : ''} in progress.`,
        320
      );
    }
  }

  function emitWaveStartPrep() {
    if (!svc('GameEvents')) return { hazards: GS.hazards };
    const payload = {
      phase: 'prep',
      wave: GS.wave,
      hazards: GS.hazards,
      territoryTier: GS.territoryTier,
      planetCreep: null,
      hostLvl: null,
    };
    svc('GameEvents').emit(svc('GameEvents').GameEvent.WAVE_START, payload);
    return payload;
  }

  function emitWaveStartAssault(playerUnits) {
    if (!svc('GameEvents')) return;
    svc('GameEvents').emit(svc('GameEvents').GameEvent.WAVE_START, {
      phase: 'assault',
      wave: GS.wave,
      playerUnits,
    });
  }

  function tickSettlementWaveProgress() {
    let anyCompleted = false;
    const inProgress = [];
    for (const b of GS.buildings) {
      if (b.hp <= 0 || b.complete || !b.waveBuildRequired) continue;
      b.waveBuildProgress = (b.waveBuildProgress || 0) + 1;
      const def = BuildDefs[b.type];
      const name = def?.name || 'Settlement';
      if (b.waveBuildProgress >= b.waveBuildRequired) {
        b.complete = true;
        // Defer path-grid invalidation until all completions this dawn (avoids N× freeze thrash).
        onBuildingComplete(b, { skipInvalidate: true });
        anyCompleted = true;
        const eco = b.isHamlet
          ? ` +${b.tpBonusPerHamlet ?? def?.tpBonusPerHamlet ?? (typeof HAMLET_TP_PER_ROUND !== 'undefined' ? HAMLET_TP_PER_ROUND : 5)} TP/round`
          : '';
        const owner = b.owner === 'enemy' ? 'Enemy ' : '';
        showMessage(`${owner}${name} complete!${eco}`, 280);
        svc('Particles').dust(b.x, b.y);
        if (b.owner === 'enemy') {
          playSfx('waveStart');
          noteEnemyEconomyPresence(b);
        }
      } else if (b.owner === 'player') {
        inProgress.push(`${name} ${b.waveBuildProgress}/${b.waveBuildRequired}`);
      }
    }
    // One summary instead of N toasts (was flooding the message queue each dawn).
    if (inProgress.length === 1) {
      showMessage(`Construction — ${inProgress[0]}`, 160);
    } else if (inProgress.length > 1) {
      showMessage(
        `Construction — ${inProgress.length} sites (${inProgress.slice(0, 3).join(', ')}${inProgress.length > 3 ? '…' : ''})`,
        200
      );
    }
    if (anyCompleted) invalidateObstacles();
  }

  /** The mentor posted at a Training Ground, if alive and standing at the post. */
  function getPostedMentor(b) {
    if (!b?.mentorId) return null;
    const u = GS.units.find((x) => x.id === b.mentorId);
    if (!u || u.hp <= 0 || u.team !== 'player') return null;
    const reach = (b.radius || 24) + 24;
    return Math.hypot(u.x - b.x, u.y - b.y) <= reach ? u : null;
  }

  function findTrainingGroundAt(x, y) {
    return GS.buildings.find(
      (b) =>
        b.type === 'training_ground' &&
        b.owner === 'player' &&
        b.hp > 0 &&
        Math.hypot(x - b.x, y - b.y) <= (b.radius || 24) + 6
    );
  }

  /** A single soldier moved onto a Training Ground is posted there; returns the ground. */
  function postToTrainingGround(u, x, y) {
    const b = findTrainingGroundAt(x, y);
    if (!b || !u) return null;
    if (!isTrainingMentor(u)) {
      const why = !TRAINABLE_TYPES.has(u.type)
        ? `${getUnitDisplayName(u)} cannot drill recruits.`
        : `${getUnitDisplayName(u)} needs rank ${TRAINING_MENTOR_TIER} to drill recruits.`;
      showMessage(why, 200);
      return null;
    }
    b.mentorId = u.id;
    const where = b.complete ? 'From the next dawn' : 'Once it is built';
    showMessage(
      `${getUnitDisplayName(u)} posted to the Training Ground. ${where} they raise a recruit each dawn.`,
      260
    );
    return b;
  }

  function spawnAcademyUnit(academy, unitType) {
    // Beside the mentor's drill spot at the ground's front edge.
    const sx = academy.x + 18;
    const sy = academy.y + 30;
    const u = spawnUnit(unitType, sx, sy, 'player');
    if (!u) return null;
    applyPlayerStatMods(u);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
    GS.units.push(u);
    svc('Particles').dust(sx, sy);
    return u;
  }

  /** Recruits arrive one rank up, two with Academy Charter, and never above their mentor. */
  function recruitRank(mentor) {
    const charter = !!svc('Research')?.isResearched?.('academy_charter');
    return Math.min(mentor.vetTier || 0, charter ? 2 : 1);
  }

  /** At dawn every Training Ground with its mentor at his post raises one ranked recruit. */
  function processAcademyTraining() {
    // startNextWave relies on this dawn pass to refresh the live counts.
    refreshUnitCounts();
    let trained = 0;
    let idle = 0;
    for (const b of GS.buildings) {
      if (b.type !== 'training_ground' || b.owner !== 'player' || !b.complete || b.hp <= 0) {
        continue;
      }
      const mentor = getPostedMentor(b);
      if (!mentor || !isTrainingMentor(mentor)) {
        if (b.mentorId) idle++;
        continue;
      }
      const u = spawnAcademyUnit(b, mentor.type);
      if (!u) continue;
      u.vetTier = recruitRank(mentor);
      syncVeteranStatsToTier(u);
      trained++;
      mentor.recruitsTrained = (mentor.recruitsTrained || 0) + 1;
      showMessage(
        `${getUnitDisplayName(mentor)} raised a ${getVeteranLabel(u)} at the Training Ground.`,
        240
      );
    }
    if (idle > 0) showMessage('The Training Ground stood idle: its mentor left their post.', 220);
    if (trained > 0) {
      refreshUnitCounts();
      playSfx('deploy');
    }
    return trained;
  }

  return {
    bind,
    announceAcademyEra,
    announceAttackSides,
    announceHostGrowth,
    announceKingdomEvolution,
    bootstrapAcademyEraStart,
    bootstrapPlaceComplete,
    checkCampaignEconomyVictory,
    checkPlayerElimination,
    emitNightBegin,
    emitWaveStartAssault,
    emitWaveStartPrep,
    getEnemyAdvancePoint,
    isKingdomActionUnlocked,
    maybeCampaignNarrative,
    onNamedBossSlain,
    getPostedMentor,
    postToTrainingGround,
    processAcademyTraining,
    tickSettlementWaveProgress,
    wireGameEventBus,
  };
})();
