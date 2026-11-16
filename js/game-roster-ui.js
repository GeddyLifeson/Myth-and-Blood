/**
 * Operative recruiting, cheats, selection info and minimap data.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameRosterUi = (() => {
  const { countPlayerGuilds, countPlayerHamlets, getHeroesOnField, playSfx, svc } = GameCore;
  const GS = GameState;
  const { purgeDeadUnits, sanitizeTactical } = GameField;
  const { applyCamera, getCameraViewport, getMapViewH } = GameCamera;
  const { getSelectedLiveUnits, getSelectedUnitIds } = GameInput;
  const { findPlayerGeneral } = GameCombat;
  const { orderHoldHere, orderHunt } = GameMovement;
  const {
    addHighlight,
    applyPlayerStatMods,
    canTpVeteranUpgrade,
    hasCompanyHall,
    hasChampionsHall,
    spawnUnit,
  } = GameArmy;
  const { applyEconomyWaveMods, assignWaveSectors, buildSpawnQueue, getWaveAttackSides } =
    GameWaves;
  const { isNightPhase } = GameDayNight;
  const { getUnitById } = GameCreative;
  let ach,
    activeSectorPlan,
    getThematicSynSnap,
    invalidateStateCache,
    isEnemyHiddenByFog,
    refreshUnitCounts,
    showMessage;
  function bind(api) {
    ({
      ach,
      activeSectorPlan,
      getThematicSynSnap,
      invalidateStateCache,
      isEnemyHiddenByFog,
      refreshUnitCounts,
      showMessage,
    } = api);
  }

  /** opts.fromCamp: a Mercenary Camp hire, at listed price and without the company's hall. */
  function hireHero(id, opts = {}) {
    const def = HeroDefs[id];
    if (!def) return false;
    if (getHeroesOnField().includes(id)) {
      showMessage(`${def.name} is already on the field!`);
      return false;
    }
    if (!opts.fromCamp && !hasCompanyHall(def.faction)) {
      showMessage(`Build a ${FreeCompanies[def.faction]?.label || 'crossover'} barracks first!`);
      return false;
    }
    const costMult = opts.fromCamp
      ? 1
      : svc('FactionDepth')
        ? svc('FactionDepth').getDeployCostMult(def.faction, GS.wave, GS.units)
        : 1;
    const deployCost = Math.ceil(def.cost * costMult);
    if (GS.tactical < deployCost) {
      showMessage(`Need ${deployCost} TP to deploy ${def.name}!`);
      return false;
    }
    const base = GS.buildings.find(
      (b) => b.isCrossoverBarracks && b.complete && b.hp > 0 && b.crossoverFaction === def.faction
    );
    GS.tactical -= deployCost;
    const u = spawnUnit(id, base?.x ?? GS.worldW / 2, (base?.y ?? GS.rallyY) + 18, 'player');
    applyPlayerStatMods(u);
    if (svc('FactionDepth')) svc('FactionDepth').applyToUnit(u, GS.units);
    if (svc('CompanyTraining')) svc('CompanyTraining').onRecruit(u);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (u.canHunt && !u.huntMode) {
      u.manualOrder = true;
      u.holdX = u.x;
      u.holdY = u.y;
      u.targetX = u.x;
      u.targetY = u.y;
      u.pathTargetId = 'hold';
    }
    GS.units.push(u);
    svc('MetaProgress').recordHeroRecruit(id);
    if (svc('Legacy')) {
      svc('Legacy').recordFaction(def.faction);
      svc('Legacy').recordDeploy(id);
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      FoundationalMedievalLayer.recordFaction(def.faction, GS.wave);
      FoundationalMedievalLayer.recordDeploy(id, GS.wave);
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      MythicPathEvolution.recordFaction(def.faction, GS.wave);
      MythicPathEvolution.recordDeploy(id, GS.wave);
    }
    ach('crossover_recruit', { crossoverId: id });
    if (def.jojoPart === 7 || def.combatType === 'cavalry') ach('jojo_cavalry');
    playSfx('deploy');
    svc('Particles').dust(u.x, u.y);
    showMessage(`${def.name} — ${def.abilityDesc}`, 280);
    refreshUnitCounts();
    invalidateStateCache();
    return true;
  }

  function hireChampion(id) {
    const def = ChampionDefs[id];
    if (!def) return false;
    if (!hasChampionsHall()) {
      showMessage('Complete a Champions’ Hall on the field first!');
      return false;
    }
    if (GS.tactical < def.cost) {
      showMessage(`Need ${def.cost} TP to sign ${def.name}!`);
      return false;
    }
    const academy = GS.buildings.find((b) => b.isWweAcademy && b.complete && b.hp > 0);
    GS.tactical -= def.cost;
    const u = spawnUnit(id, academy?.x ?? GS.worldW / 2, (academy?.y ?? GS.rallyY) + 18, 'player');
    applyPlayerStatMods(u);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (u.canHunt && !u.huntMode) {
      u.manualOrder = true;
      u.holdX = u.x;
      u.holdY = u.y;
      u.targetX = u.x;
      u.targetY = u.y;
      u.pathTargetId = 'hold';
    }
    GS.units.push(u);
    if (svc('FactionDepth')) svc('FactionDepth').applyToUnit(u, GS.units);
    if (svc('CompanyTraining')) svc('CompanyTraining').onRecruit(u);
    svc('MetaProgress').recordChampionRecruit(id);
    if (svc('Legacy')) {
      svc('Legacy').recordFaction('champions');
      svc('Legacy').recordDeploy(id);
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      MythicPathEvolution.recordFaction('champions', GS.wave);
      MythicPathEvolution.recordDeploy(id, GS.wave);
    }
    ach('wwe_recruit', { wweId: id });
    playSfx('deploy');
    svc('Particles').dust(u.x, u.y);
    showMessage(`${def.name} — ${def.abilityDesc}`, 280);
    return true;
  }

  /** Any cheat voids the run; the after-action report says "cheats used — run not recorded". */
  function markCheatsUsed() {
    if (GS.state !== 'playing') return false;
    GS.cheatsUsed = true;
    // Voided: no score, no ribbon progress, no achievements for the rest of this run.
    SiegeLoop.voidRun();
    return true;
  }

  function applyCheatEffect(type, value) {
    if (GS.state !== 'playing') return;
    markCheatsUsed();
    switch (type) {
      case 'tp':
        GS.tactical += value;
        sanitizeTactical();
        showMessage(`Cheat: +${value} TP!`, 180);
        break;
      case 'morale':
        GS.units
          .filter((u) => u.team === 'player' && u.hp > 0)
          .forEach((u) => {
            u.morale = u.maxMorale;
            u.demoralized = false;
            u.fleeing = false;
            u.witnessDeaths = 0;
          });
        showMessage('Cheat: army morale maxed!', 180);
        break;
      case 'clear_enemies':
        GS.units
          .filter((u) => u.team === 'enemy' || u.team === 'neutral' || u.isNeutral)
          .forEach((u) => {
            u.hp = 0;
          });
        purgeDeadUnits();
        refreshUnitCounts();
        GS.spawnQueue.length = 0;
        showMessage('Cheat: enemies eliminated!', 180);
        break;
      case 'deploy_all_free': {
        const types = [
          'footman',
          'archer',
          'mage',
          'cavalry',
          'healer',
          'knight',
          'sapper',
          'builder',
          'courier',
        ];
        if (!findPlayerGeneral()) types.push('general');
        types.forEach((t, i) => {
          const u = spawnUnit(t, 60 + i * 35, GS.deployY - 10, 'player');
          applyPlayerStatMods(u);
          u.targetY = GS.rallyY;
          GS.units.push(u);
        });
        showMessage('Cheat: full roster deployed!', 200);
        break;
      }
      case 'spawn_knights':
        for (let i = 0; i < (value || 1); i++) {
          const u = spawnUnit('knight', 80 + i * 40, GS.deployY - 10, 'player');
          applyPlayerStatMods(u);
          u.targetY = GS.rallyY;
          GS.units.push(u);
        }
        showMessage(`Cheat: ${value} knight(s) spawned!`, 180);
        break;
      default:
        break;
    }
    ach('state_check', {
      tactical: GS.tactical,
      wave: GS.wave,
      hamletCount: countPlayerHamlets(),
      guildCount: countPlayerGuilds(),
      liveBuilders: countLiveBuilders(GS.units),
    });
  }

  function getSelectedUnitsInfo() {
    const ids = GS.selectedUnitIds.length
      ? GS.selectedUnitIds
      : GS.selectedUnitId
        ? [GS.selectedUnitId]
        : [];
    const synSnap = getThematicSynSnap();
    const echoCandidates = synSnap?.echoes?.candidates || [];
    const echoRecruited = synSnap?.echoes?.recruited || [];
    return ids
      .map((id) => {
        const u = getUnitById(id);
        if (!u || u.hp <= 0) return null;
        const displayName =
          typeof getUnitDisplayName === 'function' ? getUnitDisplayName(u) : u.type;
        const shownName =
          u.soldierName && !u.honorName ? `${u.soldierName}, ${displayName}` : displayName;
        const roleLabel =
          typeof getUnitRoleLabel === 'function'
            ? getUnitRoleLabel(u)
            : typeof getVeteranLabel === 'function'
              ? getVeteranLabel(u)
              : u.type;
        let status = '';
        if (u.demoralized) status = 'Demoralized';
        else if (u.atMedicalTent) status = 'In the med tent';
        else if (u.retreatingToMed)
          status = u.medQueued ? 'Waiting at the med tent' : 'Going to the med tent';
        else if (u.garrisoned || u.wallGarrisoned) status = 'Garrisoned';
        else if (u.stationedKeep) status = 'Commanding Keep';
        else if (u.building && !u.building.complete) status = 'Building';
        else if (u.canHunt && u.holding) status = 'Holding position';
        return {
          id: u.id,
          type: u.type,
          spriteType: u.spriteType || u.type,
          displayName: shownName,
          roleLabel,
          honorName: u.honorName,
          kills: u.kills || 0,
          wavesSurvived: u.wavesSurvived || 0,
          counterNote: SiegeLoop.COUNTER_NOTES[u.type] || '',
          roster: Roster.describe(u),
          hp: u.hp,
          maxHp: u.maxHp,
          morale: u.morale,
          maxMorale: u.maxMorale,
          vetBronze: u.vetBronze,
          vetSilver: u.vetSilver,
          vetGold: u.vetGold,
          vetTier: u.vetTier,
          vet: Veterans.describe(u),
          timesRaised: u.timesRaised || 0,
          onHallRoll: !!u.hallId,
          vetUpgradeEligible: !!u.vetUpgradeEligible,
          vetUpgradeCost: canSpendTpVeteranUpgrade(u) ? getVeteranUpgradeCost(u) : 0,
          canVetUpgrade: canTpVeteranUpgrade(u),
          obsoletePct:
            svc('GameDepth') && svc('GameDepth').isVanillaAlly(u)
              ? Math.round(svc('GameDepth').getVanillaObsoleteMult(u, GS.wave) * 100)
              : 100,
          scaling: svc('GameDepth') ? svc('GameDepth').getUnitScalingSnapshot(u, GS.wave) : null,
          lateAbility:
            typeof getSpecialistLateAbilityInfo === 'function'
              ? getSpecialistLateAbilityInfo(u)
              : null,
          isSpecialist: typeof isSpecialistUnit === 'function' && isSpecialistUnit(u),
          perks: u.perks || [],
          huntMode: u.huntMode,
          holding: !!(u.canHunt && u.holding),
          canHold: !!u.canHunt,
          status,
          // Combat readout for unit panel
          damage: Math.round(u.damage || 0),
          range: Math.round(u.range || u.meleeRange || 0),
          meleeRange: Math.round(u.meleeRange || 0),
          accuracy: Math.round(u.accuracy || 0),
          speed: Number((u.speed || 0).toFixed(1)),
          combatType: u.combatType || 'melee',
          experience: Math.floor(u.experience || 0),
          canPromote: u.type === 'footman' && footmanEligibleForGeneral(u) && !findPlayerGeneral(),
          ascensionOffer:
            typeof AscensionSystem !== 'undefined'
              ? AscensionSystem.getUnitAscensionOffer(u, GS.wave)
              : null,
          ascensionLabel: u.ascensionLabel || null,
          ascensionWeapon: u.ascensionWeapon || null,
          echoOffer:
            synSnap?.active && synSnap.pathId === 'mythic'
              ? echoCandidates.find(
                  (e) => e.id === u.type && !echoRecruited.some((r) => r.id === e.id)
                ) || null
              : null,
          ancestralWeapon: !!u.ancestralWeapon,
          wizardKing: !!u.wizardKing,
          honorLegion: !!u.honorLegion,
          honorMeleeOnly: !!u.honorMeleeOnly,
          crownLegend: u.crownLegend || null,
        };
      })
      .filter(Boolean);
  }

  function getMinimapData() {
    const vp = getCameraViewport();
    const halfW = vp.width / (2 * GS.viewScale);
    const halfH = vp.height / (2 * GS.viewScale);
    const minimapUnits = [];
    for (const u of GS.units) {
      if (u.hp <= 0) continue;
      if (u.team === 'enemy' && isEnemyHiddenByFog(u)) continue;
      minimapUnits.push({ x: u.x, y: u.y, team: u.team });
    }
    const lp = svc('LivingPlanet')
      ? svc('LivingPlanet').getStateSnapshot(GS.territoryTier, GS.wave, {
          worldW: GS.worldW,
          worldH: GS.worldH,
          baseW: BASE_FIELD_W,
          baseH: BASE_FIELD_H,
          territoryTier: GS.territoryTier,
          wave: GS.wave,
          hostileLineY: null,
        })
      : null;
    const mf =
      svc('MultiFrontSiege') && svc('EnemyFactions')
        ? svc('MultiFrontSiege').getStateSnapshot(activeSectorPlan())
        : null;
    return {
      worldW: GS.worldW,
      worldH: GS.worldH,
      territoryTier: GS.territoryTier,
      wave: GS.wave,
      rallyY: GS.rallyY,
      phase: isNightPhase() ? 'night' : 'day',
      tick: GS.updateTick,
      attackSides: getWaveAttackSides(),
      unlockedAttackSides: getUnlockedAttackSides(GS.wave),
      multiFront: mf,

      livingPlanet: lp,
      viewX: GS.cameraWorldX - halfW,
      viewY: GS.cameraWorldY - halfH,
      viewW: halfW * 2,
      viewH: halfH * 2,
      units: minimapUnits,
      buildings: GS.buildings
        .filter((b) => b.hp > 0 && (b.complete || b.isSettlement))
        .map((b) => ({
          x: b.x,
          y: b.y,
          owner: b.owner,
          isSettlement: b.isHamlet || b.isMerchantGuild,
        })),
    };
  }

  function panCameraToFraction(fx, fy) {
    GS.cameraWorldX = fx * GS.worldW;
    GS.cameraWorldY = fy * getMapViewH();
    applyCamera();
  }

  function focusSelection() {
    const ids = GS.selectedUnitIds.length
      ? GS.selectedUnitIds
      : GS.selectedUnitId
        ? [GS.selectedUnitId]
        : [];
    if (!ids.length) {
      showMessage('Select unit(s) first to focus the camera.', 140);
      return false;
    }
    let sx = 0,
      sy = 0,
      n = 0;
    ids.forEach((id) => {
      const u = getUnitById(id);
      if (u?.hp > 0) {
        sx += u.x;
        sy += u.y;
        n++;
      }
    });
    if (!n) {
      showMessage('No living units in selection to focus.', 140);
      return false;
    }
    GS.cameraWorldX = sx / n;
    GS.cameraWorldY = sy / n;
    applyCamera();
    return true;
  }

  /** Selection card: on = Hunt (release hold), off = Hold here. */
  function setSelectedHunt(on) {
    if (!getSelectedUnitIds().length) return 0;
    return on ? orderHunt() : orderHoldHere();
  }

  function toggleSelectedHunt() {
    const anyHeld = getSelectedLiveUnits().some((u) => u.canHunt && u.holding);
    return setSelectedHunt(anyHeld);
  }

  function restartCurrentWave() {
    if (svc('GameModes') && !svc('GameModes').canRestartWave()) {
      showMessage('Wave restart disabled — Ironman run.');
      return false;
    }
    if (GS.state !== 'playing' || GS.wave < 1) {
      showMessage('No active wave to restart.');
      return false;
    }
    if (isNightPhase()) {
      showMessage('Restart wave during day assault only.');
      return false;
    }
    GS.units
      .filter((u) => u.team === 'enemy')
      .forEach((u) => {
        u.hp = 0;
      });
    GS.spawnQueue = [];
    GS.spawnTimer = 0;
    buildSpawnQueue();
    applyEconomyWaveMods();
    assignWaveSectors();
    GS.waveProgress = 0;
    addHighlight('wave', `Wave ${GS.wave} restarted`);
    showMessage(`Wave ${GS.wave} restarted.`, 200);
    return true;
  }

  return {
    bind,
    applyCheatEffect,
    focusSelection,
    getMinimapData,
    getSelectedUnitsInfo,
    markCheatsUsed,
    panCameraToFraction,
    hireHero,
    hireChampion,
    restartCurrentWave,
    setSelectedHunt,
    toggleSelectedHunt,
  };
})();
