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
    svc,
    wallFacingRotation,
  } = GameCore;
  const GS = GameState;
  const { invalidateObstacles, sanitizeTactical } = GameField;
  const { applyGlobalHuntState } = GameStance;
  const { DRAGON_THEMED_STRIKES } = GameMorale;
  const { damageInRadius } = GameCombat;
  const { canDeployUnitType, notifyVetStarEvent, spawnUnit } = GameArmy;
  const { tryMedicalRetreat } = GameMedical;
  const { econCtx, syncEconomyActions } = GameWaves;
  const { isNightPhase } = GameDayNight;
  const { isKingdomActionUnlocked } = GameCampaign;
  let TP_SANITY_CAP,
    ach,
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
      TP_SANITY_CAP,
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
      showMessage(
        'Demolish — click a completed structure. Refunds up to 50% TP, less if damaged.',
        200
      );
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
      playSfx('magicCast');
      ach('spy', { action });
      syncInteractionState();
      return true;
    }

    if (svc('ContentExpansion') && svc('ContentExpansion').handleSpyAction) {
      const ok = svc('ContentExpansion').handleSpyAction(action);
      if (ok) {
        GS.tactical -= cost;
        GS.spyUsedThisWave = true;
        rules?.markUsed(ruleKey, GS.wave);
        syncEconomyActions();
        playSfx('magicCast');
        ach('spy', { action });
        syncInteractionState();
        return true;
      }
      // Expansion handled the action type but refused (e.g. no raid targets) — do not fall through.
      if (
        action === 'settlement_raid' ||
        action === 'tunnel' ||
        action === 'deserter' ||
        action === 'maps'
      ) {
        return false;
      }
    }

    // Base spy actions — charge only on success.
    GS.tactical -= cost;
    GS.spyUsedThisWave = true;

    if (action === 'steal') {
      GS.tactical += 4;
      GS.pendingWaveMods.stealReduction += 2;
      showMessage('Spy stole enemy war chest! +4 TP');
    } else if (action === 'disrupt') {
      // A trade, not a discount: fewer come, but the ones who do are fed first and pushed hard.
      const r = rules?.rule(ruleKey) || { countMult: 0.75, hpMult: 1.12, speedMult: 1.15 };
      GS.pendingWaveMods.countMult = r.countMult;
      GS.pendingWaveMods.hpMult = (GS.pendingWaveMods.hpMult || 1) * r.hpMult;
      GS.pendingWaveMods.speedMult = r.speedMult;
      showMessage(
        `Supply lines disrupted! Next wave: ${Math.round((1 - r.countMult) * 100)}% fewer foes in the main host, ${Math.round((r.hpMult - 1) * 100)}% tougher and ${Math.round((r.speedMult - 1) * 100)}% faster. Half of those cut off catch up as a late squad.`,
        300
      );
    } else if (action === 'assassin') {
      GS.pendingWaveMods.noElites = true;
      showMessage('Enemy captain assassinated! No elites next wave.');
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
      const report = preview
        ? SiegeLoop.previewText(preview)
        : 'Scout intel locked — roster at dawn.';
      GS.nextWaveIntel = `${report}${sectorNote}${extra}`;
      showMessage(GS.nextWaveIntel, 340);
    } else if (action === 'bribery') {
      GS.pendingWaveMods.revealed = true;
      GS.waveModifiers.revealed = true;
      if ((globalThis.simRandom || Math.random)() < 0.5) GS.pendingWaveMods.stealReduction += 3;
      else {
        GS.tactical = Math.max(0, GS.tactical - 2);
        showMessage('Informant double-crossed! -2 TP', 180);
      }
      GS.nextWaveIntel = `Bribed intel${nextSectorIntel()}`;
      showMessage(GS.nextWaveIntel, 300);
    } else if (action === 'poison') {
      GS.pendingWaveMods.hpMult = 0.8;
      showMessage('Enemy caches poisoned! Next wave -20% HP.');
    } else if (action === 'sabotage') {
      const r = rules?.rule(ruleKey) || { delayTicks: 600 };
      GS.pendingWaveMods.noSiege = true;
      GS.spawnDelayBonus = Math.max(GS.spawnDelayBonus, r.delayTicks);
      const spiked = typeof WarCamps !== 'undefined' ? WarCamps.sabotage(warCampCtx) : null;
      if (spiked) {
        showMessage(
          `Saboteurs spike the ${WarCamps.KINDS[spiked.kind].name}: no bonus from it this wave.`,
          260
        );
      }
      showMessage(
        `Siege equipment sabotaged! No towers or engineers next wave, and the host is ${Math.round(r.delayTicks / 60)} seconds late.`,
        300
      );
    } else {
      // Unknown action after expansion miss — refund.
      GS.tactical += cost;
      GS.spyUsedThisWave = false;
      showMessage('Spy action failed.');
      return false;
    }
    if (
      svc('FactionReputation') &&
      ['assassin', 'disrupt', 'poison', 'sabotage'].includes(action)
    ) {
      svc('FactionReputation').onSpyAggression(GS.wave, { hooks: { showMessage } });
    }
    rules?.markUsed(ruleKey, GS.wave);
    syncEconomyActions();
    playSfx('magicCast');
    ach('spy', { action });
    syncInteractionState();
    return true;
  }

  function applyDoctrineToArmy(def) {
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (def.moraleBoost) {
        u.morale = Math.min(u.maxMorale, u.morale + def.moraleBoost);
        u.demoralized = false;
        u.fleeing = false;
        u.witnessDeaths = 0;
      }
      if (def.duration) {
        if (def.damageMult) {
          u.doctrineDmgMult = def.damageMult;
          u.doctrineDmgTimer = Math.max(u.doctrineDmgTimer || 0, def.duration);
        }
        if (def.mitigation) {
          u.doctrineMitigation = def.mitigation;
          u.doctrineMitTimer = Math.max(u.doctrineMitTimer || 0, def.duration);
        }
        if (def.speedMult) {
          u.doctrineSpeedMult = def.speedMult;
          u.doctrineSpeedTimer = Math.max(u.doctrineSpeedTimer || 0, def.duration);
        }
        if (def.moraleBoost || def.damageMult) {
          u.rallyTimer = Math.max(u.rallyTimer || 0, def.duration);
        }
      }
      if (u.canHunt) applyGlobalHuntState(u);
    }
  }

  function executeDoctrine(id) {
    const def = typeof KINGDOM_DOCTRINES !== 'undefined' ? KINGDOM_DOCTRINES[id] : null;
    if (!def) {
      showMessage('Unknown doctrine!');
      return false;
    }
    if (!isKingdomActionUnlocked(def)) {
      const need =
        KINGDOM_EVOLUTION_STAGES?.[def.kingdomStage]?.name || `stage ${def.kingdomStage}`;
      showMessage(`${def.name} unlocks in ${need}.`);
      return false;
    }
    if (GS.doctrineUsedThisWave) {
      showMessage('Kingdom doctrine already invoked this wave!');
      return false;
    }
    if (GS.tactical < def.cost) {
      showMessage('Not enough TP for kingdom doctrine!');
      return false;
    }
    GS.tactical -= def.cost;
    GS.doctrineUsedThisWave = true;

    if (def.tpGrant) {
      GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + def.tpGrant);
    }
    applyDoctrineToArmy(def);

    const label = def.name.toUpperCase();
    svc('FloatingText').status(GS.worldW / 2, GS.worldH / 2 - 24, label, '#c0a040');
    if (def.global) {
      StrikeFX?.play?.('rally', GS.worldW / 2, GS.rallyY, Math.max(GS.worldW, GS.worldH) * 0.45);
    }
    GS.rallyTimer = Math.max(GS.rallyTimer, def.duration || 0);
    showMessage(`Kingdom Doctrine — ${def.name}: ${def.desc}`, 380);
    playSfx('reinforce');
    ach('ability', { ability: id });
    if (typeof Analytics !== 'undefined') Analytics.onKingdomDoctrine(id);
    if (typeof StoryLore !== 'undefined') {
      StoryLore.recordChoice({
        source: 'doctrine',
        choiceId: id,
        label: def.name,
        wave: GS.wave,
      });
    }
    syncInteractionState();
    return true;
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
    playSfx('magicCast');
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
    // The soldiers leave the field but stay themselves: their records are kept by the
    // expedition and put back when it returns, with name, rank and kills intact.
    for (const uid of result.expedition.unitIds) {
      const idx = GS.units.findIndex((u) => u.id === uid);
      if (idx < 0) continue;
      const [u] = GS.units.splice(idx, 1);
      if (GS.selectedUnitId === uid) GS.selectedUnitId = null;
      GS.selectedUnitIds = GS.selectedUnitIds.filter((id) => id !== uid);
      u.path = [];
      u.pathIndex = 0;
      u.combatTargetId = null;
      u.structureTargetId = null;
    }
    if (svc('FactionReputation')) {
      svc('FactionReputation').onExpedition(factionId, GS.wave, { hooks: { showMessage } });
    }
    GS.expeditionUsedThisWave = true;
    playSfx('deploy');
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
    playSfx('deploy');
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
    GS.tactical -= cost;
    GS.courierMessagesUsedThisWave++;
    rules?.markUsed(ruleKey, GS.wave);
    const courier = GS.units.find((u) => u.type === 'courier' && u.hp > 0);
    let cdMult = courier?.courierCooldownMult || 1;
    // Twin Dispatch rides 20% cooler (faster) between messages.
    if (
      courier &&
      typeof isSpecialistLateAbilityUnlocked === 'function' &&
      isSpecialistLateAbilityUnlocked(courier)
    ) {
      const twinCd =
        typeof SPECIALIST_LATE_ABILITIES !== 'undefined'
          ? SPECIALIST_LATE_ABILITIES.twin_dispatch?.cooldownMult
          : null;
      cdMult *= twinCd ?? 1 / (typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2);
    }
    GS.courierCooldown = Math.max(50, Math.floor(180 * cdMult));
    if (courier) {
      courier.courierReady = false;
      courier.animState = 'walk';
      notifyVetStarEvent(courier, trySpecialistRank(courier));
    }

    if (svc('ContentExpansion') && svc('ContentExpansion').handleCourierMessage(msg)) {
      const rem = Math.max(0, msgCap - GS.courierMessagesUsedThisWave);
      showMessage(
        rem > 0
          ? `Courier dispatched: ${def.name} (${rem} message left this wave)`
          : `Courier dispatched: ${def.name}`
      );
      playSfx('deploy');
      ach('courier', { message: msg });
      syncInteractionState({ refreshCounts: true });
      syncEconomyActions();
      return true;
    }

    if (msg === 'reinforce') GS.pendingReinforce.push('footman', 'footman');
    else if (msg === 'decree')
      GS.units
        .filter((u) => u.team === 'player')
        .forEach((u) => {
          u.morale = Math.min(u.maxMorale, u.morale + 5);
          u.demoralized = false;
          u.witnessDeaths = 0;
        });
    else if (msg === 'levy') {
      // The levy is paid by the soldiers' families: it costs morale as well as a fee.
      const r = rules?.rule(ruleKey) || { pay: 5, morale: 2 };
      GS.pendingLevy += r.pay;
      for (const u of GS.units) {
        if (u.team !== 'player' || u.hp <= 0 || !(u.maxMorale > 0)) continue;
        u.morale = Math.max(0, u.morale - r.morale);
      }
      svc('FloatingText')?.status?.(
        GS.worldW / 2,
        GS.rallyY - 40,
        `LEVY -${r.morale} MORALE`,
        '#ffb060'
      );
    } else if (msg === 'banner') {
      const u = spawnUnit('knight', 200, GS.deployY, 'player');
      u.targetY = GS.rallyY;
      GS.units.push(u);
    } else if (msg === 'supplies') {
      GS.units
        .filter((u) => u.team === 'player' && u.hp > 0)
        .forEach((u) => (u.hp = Math.min(u.maxHp, u.hp + 25)));
    } else if (msg === 'truce') {
      GS.spawnDelayBonus += 90;
      GS.units
        .filter((u) => u.team === 'player' && u.hp > 0)
        .forEach((u) => {
          u.morale = Math.min(u.maxMorale, u.morale + 8);
          u.demoralized = false;
        });
      if (svc('FactionReputation')) {
        svc('FactionReputation').onTruce(GS.wave, {
          worldW: GS.worldW,
          hooks: uiHooks(),
        });
      }
    } else if (msg === 'hunt_pact') {
      if (svc('NeutralRelations')) {
        svc('NeutralRelations').onHuntPact(GS.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          rallyY: GS.rallyY,
          territoryTier: GS.territoryTier,
          spawnUnit: (u) => GS.units.push(u),
          hooks: uiHooks(),
        });
      }
    } else if (msg === 'evacuate') {
      for (const u of GS.units) {
        if (u.team !== 'player' || u.hp <= 0 || u.hp / u.maxHp > RETREAT_HP_RATIO) continue;
        u.fightToDeath = false;
        tryMedicalRetreat(u, { silent: true });
      }
    }
    const remaining = Math.max(0, msgCap - GS.courierMessagesUsedThisWave);
    if (remaining > 0) {
      showMessage(`Courier dispatched: ${def.name} (${remaining} message left this wave)`);
    } else {
      showMessage(`Courier dispatched: ${def.name}`);
    }
    playSfx('deploy');
    ach('courier', { message: msg });
    syncInteractionState({ refreshCounts: msg === 'banner' });
    syncEconomyActions();
    return true;
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
      playSfx('reinforce');
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
    startResearch,
    useAbility,
  };
})();
