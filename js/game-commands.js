/**
 * Player commands: research, deploy and build picks, spies, doctrines, expeditions, couriers, abilities.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameCommands = (() => {
  const {
    ensurePlayerUnitDef,
    ensureWallSlots,
    getDeployCostMult,
    hasCourier,
    isPlayerMageUnit,
    playSfx,
    strikeImpactFx,
    gameRandom,
    svc,
    wallFacingRotation,
  } = GameCore;
  const GS = GameState;
  const { invalidateObstacles, sanitizeTactical } = GameField;
  const { applyGlobalHuntState } = GameStance;
  const { DRAGON_THEMED_STRIKES } = GameMorale;
  const { damageInRadius, takeDamage: damageUnit } = GameCombat;
  const { canDeployUnitType, notifyVetStarEvent, spawnUnit } = GameArmy;
  const { orderMove } = GameMovement;
  const { econCtx, syncEconomyActions } = GameWaves;
  const { isNightPhase } = GameDayNight;
  const { isKingdomActionUnlocked } = GameCampaign;
  let ach,
    announceHooks,
    clearSelection,
    nextSectorIntel,
    showMessage,
    siegeCtx,
    syncInteractionState,
    uiHooks,
    warCampCtx;
  function bind(api) {
    ({
      ach,
      announceHooks,
      clearSelection,
      nextSectorIntel,
      showMessage,
      siegeCtx,
      syncInteractionState,
      uiHooks,
      warCampCtx,
    } = api);
  }

  function isAcademyEraActive() {
    return isAcademyEra(GS.wave);
  }

  function getResearchOpts() {
    const unlockAll = GS.creativeMode && GS.creativeSettings.unlockAll;
    return {
      creativeUnlockAll: unlockAll,
      doomMetaUnlocked: unlockAll || svc('MetaProgress').isAbyssWalkerUnlocked(),
      perksMetaUnlocked: unlockAll || (svc('Perks') && svc('Perks').perkMachinesUnlocked()),
    };
  }

  function isAnyCompanyAccess() {
    const opts = getResearchOpts();
    if (opts.creativeUnlockAll) return true;
    if (svc('MetaProgress').isAnyCompanyUnlocked()) return true;
    if (svc('Research')) {
      for (const f of Object.keys(FreeCompanies || {})) {
        if (svc('Research').isFactionUnlocked(f, opts)) return true;
      }
    }
    return false;
  }

  function startResearch(id) {
    if (!svc('Research')) return false;
    const ok = svc('Research').startResearch(id, GS.wave, GS.buildings, showMessage);
    if (ok) {
      syncInteractionState();
      svc('Research').renderPanel?.(GS.wave, GS.buildings, { force: true });
    }
    return ok;
  }

  function cancelResearch() {
    if (!svc('Research')) return false;
    const ok = svc('Research').cancelResearch(showMessage);
    if (ok) {
      syncInteractionState();
      svc('Research').renderPanel?.(GS.wave, GS.buildings, { force: true });
    }
    return ok;
  }

  /** Full building list for research lab detection (flags + owner). */
  function getBuildingsForResearch() {
    return GS.buildings;
  }

  function startBranchTech(id) {
    if (GS.creativeMode || typeof TechTreeBranches === 'undefined') return false;
    const ok = TechTreeBranches.startInvest(id, GS.wave, {
      wave: GS.wave,
      buildings: GS.buildings,
      showMessage,
    });
    if (ok && svc('Research')) svc('Research').renderPanel(GS.wave, GS.buildings);
    return ok;
  }

  function cancelBranchTech() {
    if (typeof TechTreeBranches === 'undefined') return false;
    const ok = TechTreeBranches.cancelInvest({ showMessage });
    if (ok && svc('Research')) svc('Research').renderPanel(GS.wave, GS.buildings);
    return ok;
  }

  function selectDeploy(type) {
    const toggleOff = GS.selectedDeploy === type;
    clearSelection();
    if (!toggleOff) {
      const def = ensurePlayerUnitDef(type);
      if (!def) {
        showMessage(`Cannot select ${type} — unit data missing. Try restarting the run.`, 280);
        syncInteractionState();
        return;
      }
      if (!canDeployUnitType(type)) {
        showMessage(
          'Creative mode — troop deploy disabled in lab settings (Academy Deploy off).',
          280
        );
        syncInteractionState();
        return;
      }
      playSfx('deployConfirm');
      const researchLocked =
        svc('Research') && !svc('Research').isDeployUnlocked(type, getResearchOpts());
      if (researchLocked) {
        const need =
          type === 'ballista'
            ? 'Locked: Research Lab → Iron Weapons → Siege Engineering (wave 9+, 34 SP).'
            : type === 'bard'
              ? 'Locked: Research Lab → Morale Arts (wave 4+, 18 SP).'
              : type === 'scout' || type === 'pikeman'
                ? 'Locked: Research Lab → Iron Weapons → Advanced Infantry (wave 7+, 26 SP).'
                : type === 'sapper' || type === 'knight' || type === 'crossbowman'
                  ? 'Locked: Research Lab → Iron Weapons first.'
                  : type === 'general'
                    ? 'Locked: Research Lab → Iron Weapons → Command Theory.'
                    : 'Research this unit at the Research Lab first!';
        showMessage(need, 320);
        // Still allow selection so the button highlights; map click re-checks.
      } else {
        const cost = getDeployCost(type);
        const costLabel = cost > 0 ? `${cost} TP` : 'free';
        showMessage(
          `${def.name || type} ready — click map (${costLabel}). Hold Shift to place more without reselecting.`,
          240
        );
      }
      GS.selectedDeploy = type;
    }
    syncInteractionState();
    playSfx('click');
  }

  /**
   * The one price of a recruit: base cost times army upkeep (and Warband), rounded up.
   * Buttons, tooltips, the "ready" banner and the charge itself all read this.
   */
  function getDeployCost(type) {
    const def = getPlayerUnitDef(type) || UnitDefs[type];
    if (!def || !Number.isFinite(def.cost)) return 0;
    if (GS.creativeMode && GS.creativeSettings && GS.creativeSettings.freeResources) return 0;
    return Math.ceil(def.cost * getDeployCostMult());
  }

  function selectAbility(a) {
    const toggleOff = GS.selectedAbility === a;
    clearSelection();
    if (!toggleOff) GS.selectedAbility = a;
    syncInteractionState();
    playSfx('click');
  }

  function selectBuild(type) {
    const toggleOff = GS.selectedBuild === type;
    clearSelection();
    if (!toggleOff) {
      GS.selectedBuild = type;
      if (type === 'wall') {
        GS.pendingWallFacing = 'north';
        showMessage('Wall facing north — press R to rotate before placing.', 200);
      }
    }
    syncInteractionState();
    playSfx('click');
  }

  function cycleWallPlacementFacing() {
    if (GS.selectedBuild !== 'wall') return false;
    GS.pendingWallFacing = cycleWallFacing(GS.pendingWallFacing);
    showMessage(`Wall facing: ${GS.pendingWallFacing}`, 120);
    syncInteractionState();
    playSfx('click');
    return true;
  }

  function selectDemolish() {
    const toggleOff = GS.selectedDemolish;
    clearSelection();
    if (!toggleOff) {
      GS.selectedDemolish = true;
      showMessage('Demolish — click a completed structure. Refunds 50% TP.', 200);
    }
    syncInteractionState();
    playSfx('click');
  }

  function selectMoveBuilding() {
    const toggleOff = GS.selectedMoveBuilding;
    clearSelection();
    if (!toggleOff) {
      GS.selectedMoveBuilding = true;
      showMessage('Move building — click structure, then destination (free).', 220);
    }
    syncInteractionState();
    playSfx('click');
  }

  function selectRotateWall() {
    const toggleOff = GS.selectedRotateWall;
    clearSelection();
    if (!toggleOff) {
      GS.selectedRotateWall = true;
      showMessage('Rotate wall — click any completed wall to turn it 90° (free).', 200);
    }
    syncInteractionState();
    playSfx('click');
  }

  function rotateWall(b) {
    if (!b || b.type !== 'wall' || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const newFacing = cycleWallFacing(b.facing);
    b.facing = newFacing;
    ensureWallSlots(b);
    for (let i = 0; i < b.wallSlots.length; i++) {
      if (!b.wallSlots[i].unitId) continue;
      const wu = GS.units.find((u) => u.id === b.wallSlots[i].unitId);
      if (!wu) continue;
      wu.x = b.wallSlots[i].slotX;
      wu.y = b.wallSlots[i].slotY;
      wu.targetX = wu.x;
      wu.targetY = wu.y;
      wu.path = [];
      wu.pathIndex = 0;
      wu.wallGarrisoned = b.id;
      wu.wallSlotIndex = i;
      wu.rotation = wallFacingRotation(newFacing);
    }
    invalidateObstacles();
    svc('Particles').dust(b.x, b.y);
    showMessage(`Wall rotated — now facing ${newFacing}.`);
    playSfx('click');
    syncInteractionState();
    return true;
  }

  function executeSpyAction(action) {
    const def = SpyActions[action];
    const ruleKey = `spy:${action}`;
    const rules = typeof EconomyRules !== 'undefined' ? EconomyRules : null;
    rules?.patchCampActions?.();
    const baseCost = rules?.getCost(ruleKey, econCtx()) ?? def?.cost ?? 99;
    const cost = svc('ContentExpansion')
      ? svc('ContentExpansion').getSpyCost(action, baseCost)
      : baseCost;
    if (!def || GS.tactical < cost) {
      showMessage('Not enough TP or invalid action!');
      return false;
    }
    const gate = rules?.canUse(ruleKey, econCtx());
    if (gate && !gate.ok) {
      showMessage(`${def.name}: ${gate.reason}`);
      return false;
    }
    if (!isKingdomActionUnlocked(def)) {
      const need =
        typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? KINGDOM_EVOLUTION_STAGES[def.kingdomStage]?.name
          : `stage ${def.kingdomStage}`;
      showMessage(`${def.name} unlocks in ${need || 'a later kingdom stage'}.`);
      return false;
    }
    if (GS.spyUsedThisWave) {
      showMessage('Spy network already used this wave!');
      return false;
    }
    // By day the night preview is gone, and the report used to arrive at dawn, too late.
    if (def.nightOnly && !isNightPhase()) {
      showMessage(`${def.name}: scouts ride out at night, before the host marches.`);
      return false;
    }

    if (action === 'settlement_raid' && typeof WarCamps !== 'undefined') {
      // The raid goes for a war camp. No camp, no raid, and nothing is charged.
      const res = WarCamps.orderRaid(warCampCtx);
      if (!res.ok) {
        showMessage(`${def.name}: ${res.reason}`);
        return false;
      }
      GS.tactical -= cost;
      GS.spyUsedThisWave = true;
      rules?.markUsed(ruleKey, GS.wave);
      syncEconomyActions();
      playSfx('spyAction');
      ach('spy', { action });
      syncInteractionState();
      return true;
    }

    GS.tactical -= cost;
    GS.spyUsedThisWave = true;

    if (action === 'assassin') {
      // The mark lands on the field: the warlord is outlined and every blow on him bites deeper.
      if (typeof GeneralOrders !== 'undefined') GeneralOrders.markWarlord(GS.wave + 1);
      showMessage(
        'Assassins mark the warlord: when the next wave comes, its strongest foe is outlined in blood and takes 25% more damage.',
        300
      );
    } else if (action === 'turncoats') {
      const n = typeof GeneralOrders !== 'undefined' ? GeneralOrders.buyTurncoats(GS.wave + 1) : 0;
      showMessage(
        `Gold changes hands: ${n} of the next wave's rabble will throw down their colours at your line and fight for you.`,
        300
      );
    } else if (action === 'infiltrate') {
      // Used to run the same code as Scout Report. Now it is an ambush on the road.
      const r = rules?.rule(ruleKey) || { softenShare: 0.3, softenHp: 0.6 };
      GS.pendingWaveMods.softenShare = r.softenShare;
      showMessage(
        `Infiltrators lie in wait: the first ${Math.round(r.softenShare * 100)}% of the next wave will arrive at ${Math.round(r.softenHp * 100)}% health.`,
        300
      );
    } else if (action === 'scout') {
      GS.scoutedWave = GS.wave + 1;
      GS.pendingWaveMods.revealed = true;
      GS.waveModifiers.revealed = true;
      const sectorNote = nextSectorIntel();
      const nextW = GS.wave + 1;
      const horde = nextW >= 5 && nextW % 5 === 0 && !(nextW >= 10 && nextW % 10 === 0);
      const boss = nextW >= 10 && nextW % 10 === 0;
      let extra = '';
      if (boss) extra = ' Named BOSS expected.';
      else if (horde) extra = ' HORDE expected.';
      // The head count by type goes into the night preview now, not at dawn when it is too late.
      const preview = SiegeLoop.refreshPreview?.(siegeCtx);
      const report = preview ? SiegeLoop.previewText(preview) : 'Scouts saw the host gather.';
      GS.nextWaveIntel = `${report}${sectorNote}${extra}`;
      showMessage(GS.nextWaveIntel, 340);
    } else {
      // Not a spy action any more (cut in the orders rework): refund.
      GS.tactical += cost;
      GS.spyUsedThisWave = false;
      showMessage('Spy action failed.');
      return false;
    }
    if (svc('FactionReputation') && action === 'assassin') {
      svc('FactionReputation').onSpyAggression(GS.wave, { hooks: { showMessage } });
    }
    rules?.markUsed(ruleKey, GS.wave);
    syncEconomyActions();
    playSfx('spyAction');
    ach('spy', { action });
    syncInteractionState();
    return true;
  }

  /** Kingdom doctrines became the General's orders: war_cry, hold_line, advance, fall_back. */
  function executeDoctrine(id) {
    if (typeof GeneralOrders === 'undefined') return false;
    const ok = GeneralOrders.issue(id, { showMessage, playSfx });
    if (ok) syncInteractionState();
    return ok;
  }

  function executeCounterDoctrine(id) {
    if (!svc('PlayerCounterEvolution')) {
      showMessage('Counter-offensive unavailable.');
      return false;
    }
    const def = svc('PlayerCounterEvolution').COUNTER_DOCTRINES[id];
    if (!def) {
      showMessage('Unknown counter doctrine!');
      return false;
    }
    const kingdomStage =
      typeof getKingdomStageBuffs === 'function' ? getKingdomStageBuffs(GS.wave).stage : 1;
    if (!svc('PlayerCounterEvolution').isCounterDoctrineUnlocked(def, GS.wave, kingdomStage)) {
      showMessage(`${def.name} unlocks later — check wave and kingdom stage.`);
      return false;
    }
    if (GS.counterDoctrineUsedThisWave) {
      showMessage('Offensive counter doctrine already used this wave!');
      return false;
    }
    if (GS.tactical < def.cost) {
      showMessage('Not enough TP for counter-offensive!');
      return false;
    }
    GS.tactical -= def.cost;
    GS.counterDoctrineUsedThisWave = true;
    const result = svc('PlayerCounterEvolution').executeCounterDoctrine(id, GS.wave, kingdomStage, {
      worldW: GS.worldW,
      hooks: uiHooks(),
    });
    if (!result.ok) {
      GS.tactical += def.cost;
      GS.counterDoctrineUsedThisWave = false;
      if (result.reason === 'no_target') showMessage('No active host factions to weaken.');
      else showMessage('Counter doctrine failed.');
      return false;
    }
    if (svc('FactionReputation') && result.target?.id) {
      svc('FactionReputation').onCounterOffensive(result.target.id, GS.wave, {
        hooks: { showMessage },
      });
    }
    if (typeof Analytics !== 'undefined') Analytics.onCounterDoctrine(id);
    playSfx('dispel');
    if (typeof StoryLore !== 'undefined') {
      StoryLore.recordChoice({
        source: 'counter',
        choiceId: id,
        label: def.name,
        wave: GS.wave,
        meta: result.target?.id,
      });
    }
    syncInteractionState();
    return true;
  }

  function dispatchExpedition(factionId) {
    if (!svc('PlayerCounterEvolution')) {
      showMessage('Expeditions unavailable.');
      return false;
    }
    if (!svc('PlayerCounterEvolution').canExpedition(GS.wave)) {
      showMessage(
        `Expeditions unlock at wave ${svc('PlayerCounterEvolution').EXPEDITION_WAVE_MIN}.`
      );
      return false;
    }
    if (!isNightPhase()) {
      showMessage('Dispatch expeditions during night prep — before dawn.');
      return false;
    }
    if (GS.expeditionUsedThisWave) {
      showMessage('One expedition per wave — troops already marching.');
      return false;
    }
    const ids = GS.selectedUnitIds.length
      ? GS.selectedUnitIds
      : GS.selectedUnitId
        ? [GS.selectedUnitId]
        : [];
    if (!ids.length) {
      showMessage(
        `Select ${svc('PlayerCounterEvolution').MIN_EXPEDITION_FORCE}–${svc('PlayerCounterEvolution').MAX_EXPEDITION_FORCE} hunters for the expedition.`
      );
      return false;
    }
    const result = svc('PlayerCounterEvolution').dispatchExpedition(factionId, ids, GS.wave, {
      units: GS.units,
      hooks: announceHooks(),
    });
    if (!result.ok) {
      if (result.reason === 'need_units') {
        showMessage(`Need ${result.need} expedition troops (have ${result.have}).`);
      } else if (result.reason === 'too_many') {
        showMessage(`Max ${result.max} troops per expedition.`);
      } else if (result.reason === 'no_target') {
        showMessage('Faction not active.');
      } else {
        showMessage('Could not dispatch expedition.');
      }
      return false;
    }
    // A sortie on the field: the squad marches to the top edge, fights the vanguard where
    // the player can see it, and whoever lives walks home, the same soldiers.
    result.expedition.away = [];
    startSortie(result.expedition);
    if (svc('FactionReputation')) {
      svc('FactionReputation').onExpedition(factionId, GS.wave, { hooks: { showMessage } });
    }
    GS.expeditionUsedThisWave = true;
    playSfx('expeditionSent');
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function respondMapEvent(choiceId) {
    if (!svc('DynamicMapEvents')) {
      showMessage('Omens unavailable.');
      return false;
    }
    if (!isNightPhase()) {
      showMessage('Answer the omen at night, before dawn.', 220, {
        priority: 'critical',
        bypassQueue: true,
      });
      return false;
    }
    const cost = svc('DynamicMapEvents').getChoiceCost(choiceId);
    const freeTp = GS.creativeMode && GS.creativeSettings.freeResources;
    if (!freeTp && GS.tactical < cost) {
      showMessage(`Need ${cost} TP for this answer (have ${Math.floor(GS.tactical)}).`, 220, {
        priority: 'critical',
        bypassQueue: true,
      });
      return false;
    }
    const result = svc('DynamicMapEvents').respond(choiceId, {
      tactical: GS.tactical,
      freeTp,
      spendTp: (n) => {
        GS.tactical -= n;
        sanitizeTactical();
      },
      hooks: uiHooks(),
    });
    if (!result.ok) {
      if (result.reason === 'need_tp') {
        showMessage(`Need ${result.cost} TP (have ${GS.tactical}).`, 220, {
          priority: 'critical',
          bypassQueue: true,
        });
      } else if (result.reason === 'none_pending') {
        showMessage('No omen is waiting for an answer tonight.', 220, {
          priority: 'critical',
          bypassQueue: true,
        });
      } else if (result.reason === 'already_chosen') {
        showMessage('Planet response already locked for this night.', 200, {
          priority: 'critical',
          bypassQueue: true,
        });
      } else if (result.reason === 'bad_choice') {
        showMessage('Unknown planet response.');
      } else {
        showMessage('Could not record planet response.');
      }
      return false;
    }
    if (typeof StoryLore !== 'undefined' && result.event) {
      const choiceDef = result.event.choices?.find((c) => c.id === result.choice);
      StoryLore.recordChoice({
        source: 'planet_event',
        choiceId: result.choice,
        label: choiceDef?.label || result.choice,
        eventId: result.event.eventId || result.event.id,
        wave: GS.wave,
      });
    }
    playSfx('click');
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function dispatchRaidStrike(missionId) {
    if (!svc('SettlementRaids')) {
      showMessage('Settlement raids unavailable.');
      return false;
    }
    if (!svc('SettlementRaids').isActive(GS.wave)) {
      showMessage(
        `Settlement raids unlock at wave ${svc('SettlementRaids').SETTLEMENT_RAID_WAVE_MIN}.`
      );
      return false;
    }
    const ids = GS.selectedUnitIds.length
      ? GS.selectedUnitIds
      : GS.selectedUnitId
        ? [GS.selectedUnitId]
        : [];
    if (!ids.length) {
      showMessage(
        `Select ${svc('SettlementRaids').MIN_STRIKE_FORCE}+ hunters, then dispatch a raid mission.`
      );
      return false;
    }
    const result = svc('SettlementRaids').dispatchStrike(missionId, ids, {
      units: GS.units,
      hooks: uiHooks(),
    });
    if (!result.ok) {
      if (result.reason === 'need_units') {
        showMessage(`Need ${result.need} hunters for a strike force (have ${result.have}).`);
      } else if (result.reason === 'already_dispatched') {
        showMessage('Strike force already en route to that hold.');
      } else if (result.reason === 'no_mission') {
        showMessage('Raid mission expired — target already cleared.');
      } else {
        showMessage('Could not dispatch strike force.');
      }
      return false;
    }
    if (svc('FactionReputation') && result.mission?.factionId) {
      svc('FactionReputation').onSettlementRaid(result.mission.factionId, GS.wave, {
        hooks: { showMessage },
      });
    }
    playSfx('raidSent');
    return true;
  }

  function getCourierMessagesPerWave() {
    if (!hasCourier()) return 0;
    for (const u of GS.units) {
      if (u.type !== 'courier' || u.hp <= 0) continue;
      if (
        typeof isSpecialistLateAbilityUnlocked === 'function' &&
        isSpecialistLateAbilityUnlocked(u)
      ) {
        return 2; // Twin Dispatch — two messages per wave
      }
      const late =
        typeof getSpecialistLateAbilityInfo === 'function' ? getSpecialistLateAbilityInfo(u) : null;
      if (late?.unlocked && late.id === 'twin_dispatch') return 2;
    }
    return 1;
  }

  function isCourierMessageCapReached() {
    return GS.courierMessagesUsedThisWave >= Math.max(1, getCourierMessagesPerWave() || 1);
  }

  function sendCourierMessage(msg) {
    const def = CourierMessages[msg];
    const ruleKey = `courier:${msg}`;
    const rules = typeof EconomyRules !== 'undefined' ? EconomyRules : null;
    const baseCost = rules?.getCost(ruleKey, econCtx()) ?? def?.cost ?? 99;
    const cost = svc('ContentExpansion')
      ? svc('ContentExpansion').getCourierCost(msg, baseCost)
      : baseCost;
    if (!def || GS.tactical < cost) {
      showMessage('Not enough TP!');
      return false;
    }
    const gate = rules?.canUse(ruleKey, econCtx());
    if (gate && !gate.ok) {
      showMessage(`${def.name}: ${gate.reason}`);
      return false;
    }
    if (!isKingdomActionUnlocked(def)) {
      const need =
        typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? KINGDOM_EVOLUTION_STAGES[def.kingdomStage]?.name
          : `stage ${def.kingdomStage}`;
      showMessage(`${def.name} unlocks in ${need || 'a later kingdom stage'}.`);
      return false;
    }
    if (!hasCourier()) {
      showMessage('You need a live Courier on the field!');
      return false;
    }
    const msgCap = Math.max(1, getCourierMessagesPerWave());
    if (GS.courierMessagesUsedThisWave >= msgCap) {
      showMessage(
        msgCap > 1
          ? 'Courier already sent both dispatches this wave!'
          : 'Courier already dispatched this wave!'
      );
      return false;
    }
    if (GS.courierCooldown > 0) {
      showMessage('Courier is still riding...');
      return false;
    }
    const courier = GS.units.find((u) => u.type === 'courier' && u.hp > 0 && u.courierReady);
    if (!courier || GS.courierRide) {
      showMessage('Courier is still riding...');
      return false;
    }
    GS.tactical -= cost;
    GS.courierMessagesUsedThisWave++;
    rules?.markUsed(ruleKey, GS.wave);
    let cdMult = courier.courierCooldownMult || 1;
    // Twin Dispatch rides 20% cooler (faster) between messages.
    if (
      typeof isSpecialistLateAbilityUnlocked === 'function' &&
      isSpecialistLateAbilityUnlocked(courier)
    ) {
      const twinCd =
        typeof SPECIALIST_LATE_ABILITIES !== 'undefined'
          ? SPECIALIST_LATE_ABILITIES.twin_dispatch?.cooldownMult
          : null;
      cdMult *= twinCd ?? 1 / (typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2);
    }
    courier.courierReady = false;
    notifyVetStarEvent(courier, trySpecialistRank(courier));
    startCourierRide(courier, msg, cdMult);
    showMessage(
      `The Courier rides for the rear: ${def.name} when he is back, in about 20 seconds. If he falls on the road, the order is lost.`,
      300
    );
    playSfx('courierSent');
    ach('courier', { message: msg });
    syncInteractionState();
    syncEconomyActions();
    return true;
  }

  /** Ticks the Courier waits off the field before riding back (scaled by his cooldown mult). */
  const COURIER_AWAY_TICKS = 16 * 60;
  /** A leg that takes longer than this is cut short (blocked path): he is placed at the end. */
  const COURIER_LEG_TICKS = 12 * 60;
  /** Keeps Availability's "still riding" until the ride resolves. */
  const COURIER_RIDING = 99999;
  const SURGEON_TICKS = 15 * 60;
  const ARROW_TICKS = 20 * 60;
  const ARROW_MULT = 1.35;

  function startCourierRide(courier, msg, cdMult = 1) {
    GS.courierRide = {
      msg,
      courierId: courier.id,
      phase: 'out',
      t: 0,
      awayTicks: Math.max(4 * 60, Math.round(COURIER_AWAY_TICKS * cdMult)),
      homeX: courier.x,
      homeY: courier.y,
    };
    GS.courierCooldown = COURIER_RIDING;
    courier.animState = 'walk';
    orderMove(courier, courier.x, GS.worldH - 4, true);
  }

  function endCourierRide() {
    GS.courierRide = null;
    // One more tick lets game.js mark the Courier ready again.
    GS.courierCooldown = 1;
  }

  function isInMusterZone(u) {
    return u.y >= GS.rallyY - 40;
  }

  /** The order lands where the Courier came back: at the muster line. */
  function resolveCourierOrder(msg, courier) {
    const tick = GS.updateTick;
    if (msg === 'reinforce') {
      const squad = ['footman', 'footman', 'archer'];
      squad.forEach((type, i) => {
        const u = spawnUnit(type, courier.x + (i - 1) * 18, GS.deployY, 'player');
        u.targetY = GS.rallyY;
        GS.units.push(u);
      });
      svc('FloatingText')?.status?.(courier.x, GS.rallyY - 20, 'REINFORCEMENTS', '#e8dcc0');
      showMessage('Reinforcements march in at the muster line: two footmen and an archer.', 240);
      syncInteractionState({ refreshCounts: true });
    } else if (msg === 'surgeons') {
      let n = 0;
      for (const u of GS.units) {
        if (u.team !== 'player' || u.hp <= 0 || u.hp >= u.maxHp || !isInMusterZone(u)) continue;
        u.surgeonUntil = tick + SURGEON_TICKS;
        n++;
      }
      svc('FloatingText')?.status?.(courier.x, GS.rallyY - 20, 'FIELD SURGEONS', '#c04040');
      showMessage(`Field surgeons reach the muster line: ${n} wounded tended for 15 seconds.`, 240);
    } else if (msg === 'arrows') {
      let n = 0;
      for (const u of GS.units) {
        if (u.team !== 'player' || u.hp <= 0 || !u.projectile) continue;
        if (!(u.freshArrowsUntil > tick)) u.attackSpeedMult = (u.attackSpeedMult || 1) * ARROW_MULT;
        u.freshArrowsUntil = tick + ARROW_TICKS;
        n++;
      }
      svc('FloatingText')?.status?.(courier.x, GS.rallyY - 20, 'FRESH ARROWS', '#e8dcc0');
      showMessage(
        `Fresh arrows handed out: ${n} ranged soldiers shoot faster for 20 seconds.`,
        240
      );
    }
  }

  function tickCourierRide() {
    const ride = GS.courierRide;
    if (!ride) return;
    const c = GS.units.find((u) => u.id === ride.courierId);
    ride.t++;
    if (!c || c.hp <= 0) {
      const name = CourierMessages[ride.msg]?.name || 'the order';
      showMessage(`The Courier fell on the road: ${name} is lost.`, 260);
      endCourierRide();
      return;
    }
    if (ride.phase === 'out') {
      if (c.y >= GS.worldH - 14 || ride.t > COURIER_LEG_TICKS) {
        ride.phase = 'away';
        ride.t = 0;
      }
    } else if (ride.phase === 'away') {
      if (ride.t >= ride.awayTicks) {
        ride.phase = 'back';
        ride.t = 0;
        orderMove(c, ride.homeX, ride.homeY, true);
      }
    } else if (Math.hypot(c.x - ride.homeX, c.y - ride.homeY) < 20 || ride.t > COURIER_LEG_TICKS) {
      resolveCourierOrder(ride.msg, c);
      endCourierRide();
    }
  }

  const SORTIE_LEG_TICKS = 18 * 60;
  const SORTIE_FIGHT_TICKS = 8 * 60;
  /** Where the sortie meets the vanguard: just under the top edge. */
  const SORTIE_Y = 46;

  function startSortie(exp) {
    const homes = {};
    for (const id of exp.unitIds) {
      const u = GS.units.find((x) => x.id === id);
      if (!u) continue;
      homes[id] = { x: u.x, y: u.y };
      orderMove(u, u.x, SORTIE_Y, true, { hold: 'keep' });
    }
    const odds = svc('PlayerCounterEvolution').getExpeditionSurvivalRate(exp.unitIds.length);
    // Each soldier's fate is drawn now, so a save mid-fight cannot reroll it.
    const doomed = exp.unitIds.filter(() => gameRandom() > odds);
    GS.sortie = {
      expId: exp.id,
      unitIds: [...exp.unitIds],
      homes,
      doomed,
      fallen: 0,
      phase: 'out',
      t: 0,
    };
  }

  function sortieMen() {
    const s = GS.sortie;
    return s.unitIds.map((id) => GS.units.find((u) => u.id === id)).filter((u) => u && u.hp > 0);
  }

  function endSortie() {
    const s = GS.sortie;
    const men = sortieMen();
    for (const u of men) {
      u.onExpedition = null;
      u.expeditionTarget = null;
      u.expeditions = (u.expeditions || 0) + 1;
    }
    svc('PlayerCounterEvolution').completeSortie(s.expId, men.length, GS.wave, {
      grantScience: (n) => svc('Research')?.grantSciencePoints?.(n, { showMessage }),
      hooks: uiHooks(),
    });
    GS.sortie = null;
  }

  function goHome(men) {
    const s = GS.sortie;
    for (const u of men) {
      const h = s.homes[u.id] || { x: u.x, y: GS.rallyY };
      orderMove(u, h.x, h.y, true, { hold: 'keep' });
    }
  }

  function tickSortie() {
    const s = GS.sortie;
    if (!s) return;
    s.t++;
    const men = sortieMen();
    if (!men.length) {
      endSortie();
      return;
    }
    // Dawn calls everyone home at once: the fight is over.
    if (!isNightPhase() && s.phase !== 'back') {
      s.phase = 'back';
      goHome(men);
    }
    if (s.phase === 'out') {
      if (men.every((u) => u.y <= SORTIE_Y + 30) || s.t > SORTIE_LEG_TICKS) {
        s.phase = 'fight';
        s.t = 0;
        showMessage('The sortie meets the enemy vanguard at the top of the field.', 200);
      }
    } else if (s.phase === 'fight') {
      if (s.t % 20 === 0) {
        const u = men[s.t % men.length];
        svc('Particles')?.blood?.(u.x + (s.t % 3) * 8 - 8, u.y - 6);
      }
      if (s.t % 90 === 0) {
        const u = men[((s.t / 90) % men.length) | 0];
        svc('FloatingText')?.status?.(u.x, u.y - 22, 'CLASH', '#a01818');
      }
      // The doomed fall one by one through the fight.
      const due = Math.floor((s.t / SORTIE_FIGHT_TICKS) * s.doomed.length + 0.5);
      while (s.fallen < due) {
        s.fallen++;
        const victim = GS.units.find((u) => u.id === s.doomed[s.fallen - 1] && u.hp > 0);
        if (victim) damageUnit(victim, victim.hp * 10 + 999);
      }
      if (s.t >= SORTIE_FIGHT_TICKS) {
        s.phase = 'back';
        s.t = 0;
        goHome(sortieMen());
      }
    } else if (
      men.every((u) => Math.hypot(u.x - s.homes[u.id]?.x, u.y - s.homes[u.id]?.y) < 26) ||
      s.t > SORTIE_LEG_TICKS
    ) {
      endSortie();
    }
  }

  /** Per-tick upkeep of orders on the field: the courier's ride, surgeons, arrows, sorties. */
  function tickOrders() {
    tickCourierRide();
    tickSortie();
    const tick = GS.updateTick;
    for (const u of GS.units) {
      if (u.team !== 'player') continue;
      if (u.surgeonUntil) {
        if (u.hp <= 0 || u.surgeonUntil <= tick) u.surgeonUntil = 0;
        else {
          u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * 0.5) / SURGEON_TICKS);
          if (tick % 45 === 0) svc('Particles')?.heal?.(u.x, u.y);
        }
      }
      if (u.freshArrowsUntil && u.freshArrowsUntil <= tick) {
        u.attackSpeedMult = (u.attackSpeedMult || ARROW_MULT) / ARROW_MULT;
        u.freshArrowsUntil = 0;
      }
    }
    if (typeof GeneralOrders !== 'undefined') GeneralOrders.tick({ showMessage, playSfx });
  }

  /** Nearest living player mage for Arcane Dispel range checks. */
  function findNearestPlayerMage(wx, wy) {
    let best = null;
    let bestD = Infinity;
    for (const u of GS.units) {
      if (!isPlayerMageUnit(u)) continue;
      if (u.garrisoned || u.wallGarrisoned || u.stationedKeep) continue;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best ? { mage: best, dist: bestD } : null;
  }

  function countPlayerMages() {
    let n = 0;
    for (const u of GS.units) {
      if (isPlayerMageUnit(u)) n++;
    }
    return n;
  }

  function canUseAbility(ability) {
    if (!ability || !Abilities[ability]) {
      showMessage('Unknown ability.');
      return false;
    }
    if (DRAGON_THEMED_STRIKES.has(ability)) {
      const rimehowlOk =
        (GS.creativeMode && GS.creativeSettings.unlockAll) ||
        svc('MetaProgress').isRimehowlUnlocked();
      if (!rimehowlOk) {
        showMessage('Voice shouts unlock with Rimehowl Pact — complete the Rimehowl Legacy.', 300);
        return false;
      }
    }
    if (ability === 'reinforce' && svc('GameModes')?.getSession()?.noReinforceStrike) {
      showMessage('Challenge rule: Reinforcements strike disabled!');
      return false;
    }
    if (ability === 'dispel' || Abilities[ability]?.requiresMage) {
      if (countPlayerMages() <= 0) {
        showMessage('Arcane Dispel needs a living Mage on the field!', 260);
        return false;
      }
    }
    return true;
  }

  /** @returns {boolean} true if the ability was cast successfully */
  function useAbility(ability, wx, wy) {
    if (!canUseAbility(ability)) return false;
    if (svc('ContentExpansion') && svc('ContentExpansion').useAbility(ability, wx, wy)) {
      ach('ability', { ability });
      return true;
    }
    const raw = Abilities[ability];
    const ab = typeof scaleAbilityDef === 'function' ? scaleAbilityDef(raw) : raw;
    if (!ab) return false;
    const coolFx = typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2;
    // Validate mage-gated casts before spending achievement / FX budget.
    if (ability === 'dispel') {
      const mageHit = findNearestPlayerMage(wx, wy);
      if (!mageHit?.mage) {
        showMessage('Arcane Dispel needs a living Mage on the field!', 260);
        return false;
      }
      const castRange = Math.max(140, (mageHit.mage.range || 180) * 1.15);
      if (mageHit.dist > castRange) {
        showMessage('Target is out of Mage cast range — move a Mage closer.', 280);
        return false;
      }
    }
    ach('ability', { ability });
    if (ability === 'fireball') {
      playSfx('fireball');
      // The damage lands with the blast, when the wind-up ends.
      const land = () => {
        strikeImpactFx('fireball', wx, wy, ab.radius, coolFx);
        damageInRadius(wx, wy, ab.radius, ab.damage, 'player');
      };
      if (!StrikeFX?.cast?.('fireball', wx, wy, ab.radius, land)) land();
    } else if (ability === 'lightning') {
      playSfx('lightning');
      const land = () => {
        strikeImpactFx('lightning', wx, wy, ab.radius, coolFx);
        damageInRadius(wx, wy, ab.radius, ab.damage, 'player');
      };
      if (!StrikeFX?.cast?.('lightning', wx, wy, ab.radius, land)) land();
    } else if (ability === 'heal') {
      playSfx('heal');
      StrikeFX?.play?.('heal', wx, wy, ab.radius);
      GS.units
        .filter((u) => u.team === 'player' && Math.hypot(u.x - wx, u.y - wy) < ab.radius)
        .forEach((u) => {
          const healed = Math.min(ab.healAmount, u.maxHp - u.hp);
          u.hp = Math.min(u.maxHp, u.hp + ab.healAmount);
          svc('Particles').heal(u.x, u.y);
          CombatFX?.healPulse(u.x, u.y);
          if (healed > 0) svc('FloatingText').heal(u.x, u.y, healed);
        });
    } else if (ability === 'reinforce') {
      playSfx('reinforce');
      StrikeFX?.play?.('reinforce', wx, wy, 40);
      (ab.units || ['footman', 'footman', 'archer']).forEach((t, i) => {
        const u = spawnUnit(t, 80 + i * 50, GS.deployY, 'player');
        if (!u) return;
        u.targetY = GS.rallyY;
        u.huntMode = GS.globalHunt && u.canHunt;
        if (u.canHunt && !u.huntMode) {
          u.manualOrder = true;
          u.targetX = u.x;
          u.targetY = u.y;
        }
        GS.units.push(u);
      });
    } else if (ability === 'rally') {
      GS.rallyTimer = ab.duration;
      playSfx('rallyHorn');
      StrikeFX?.play?.('rally', wx, wy, 120);
      GS.units
        .filter((u) => u.team === 'player' && u.hp > 0)
        .forEach((u) => {
          u.morale = Math.min(u.maxMorale, u.morale + ab.moraleBoost);
          u.rallyTimer = ab.duration;
          u.fleeing = false;
          u.demoralized = false;
          u.witnessDeaths = 0;
          if (u.canHunt) applyGlobalHuntState(u);
          svc('FloatingText').status(u.x, u.y, 'RALLY!', '#f0c040');
        });
      showMessage('Battle Rally! All troops inspired!');
    } else if (ability === 'dispel') {
      const mageHit = findNearestPlayerMage(wx, wy);
      const mage = mageHit.mage;
      if (!svc('FactionHazards')?.dispelInRadius) {
        showMessage('Dispel unavailable.');
        return false;
      }
      const before = GS.hazards.length;
      const result = svc('FactionHazards').dispelInRadius(GS.hazards, wx, wy, ab.radius || 85);
      // Always refresh spatial hazard queries after mutate.
      svc('Spatial')?.rebuildHazards?.(GS.hazards);
      // Clean residual hazard debuffs on troops inside the purge.
      for (const u of GS.units) {
        if (u.hp <= 0) continue;
        if (Math.hypot(u.x - wx, u.y - wy) > (ab.radius || 85) + 8) continue;
        if ((u.frostTimer || 0) <= 0) u.hazardSlow = 1;
        u.hazardBurnTick = 0;
        for (const k of Object.keys(u)) {
          if (k.startsWith('hazardTick_')) u[k] = 0;
        }
      }
      mage.attackAnimTimer = Math.max(mage.attackAnimTimer || 0, 18);
      mage.animState = 'attack';
      mage.rotation = Math.round((Math.atan2(wy - mage.y, wx - mage.x) * 180) / Math.PI);
      playSfx('magicCast');
      StrikeFX?.play?.('dispel', wx, wy, ab.radius || 85);
      strikeImpactFx('heal', wx, wy, ab.radius || 85, coolFx * 0.85);
      svc('Particles')?.heal?.(wx, wy);
      svc('FloatingText')?.status?.(wx, wy, 'DISPEL', '#c0a0ff');
      if (result.purged > 0 || GS.hazards.length < before) {
        showMessage(
          `Arcane Dispel — purged ${result.purged || before - GS.hazards.length} blight zone(s)!`,
          260
        );
      } else {
        showMessage('Arcane Dispel washes the ground — no major blights in range.', 220);
      }
    } else {
      return false;
    }
    return true;
  }

  return {
    bind,
    canUseAbility,
    cancelBranchTech,
    cancelResearch,
    cycleWallPlacementFacing,
    dispatchExpedition,
    dispatchRaidStrike,
    executeCounterDoctrine,
    executeDoctrine,
    executeSpyAction,
    getBuildingsForResearch,
    getCourierMessagesPerWave,
    getDeployCost,
    getResearchOpts,
    isAcademyEraActive,
    isAnyCompanyAccess,
    isCourierMessageCapReached,
    respondMapEvent,
    rotateWall,
    selectAbility,
    selectBuild,
    selectDemolish,
    selectDeploy,
    selectMoveBuilding,
    selectRotateWall,
    sendCourierMessage,
    startBranchTech,
    tickOrders,
    startResearch,
    useAbility,
  };
})();
