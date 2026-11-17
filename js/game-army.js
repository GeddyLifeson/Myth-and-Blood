/**
 * Spawning units, veteran upgrades, player stat mods and star events.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameArmy = (() => {
  const { ensurePlayerUnitDef, playSfx, specialistStarColor, svc } = GameCore;
  const GS = GameState;
  const { recordPathImmortalIfEligible } = GameMorale;
  let ach,
    getDifficulty,
    getResearchOpts,
    getSelectedUnit,
    getUnitById,
    showMessage,
    syncInteractionState;
  function bind(api) {
    ({
      ach,
      getDifficulty,
      getResearchOpts,
      getSelectedUnit,
      getUnitById,
      showMessage,
      syncInteractionState,
    } = api);
  }

  function findLivePlayerOfType(type) {
    for (let i = 0; i < GS.units.length; i++) {
      const u = GS.units[i];
      if (u.team === 'player' && u.type === type && u.hp > 0) return u;
    }
    return null;
  }

  function hasChampionsHall() {
    return GS.buildings.some(
      (b) => b.owner === 'player' && b.isWweAcademy && b.complete && b.hp > 0
    );
  }

  function hasCompanyHall(factionId) {
    return GS.buildings.some(
      (b) =>
        b.owner === 'player' &&
        b.isCrossoverBarracks &&
        b.complete &&
        b.hp > 0 &&
        b.crossoverFaction === factionId
    );
  }

  function spawnUnit(type, x, y, team, opts = {}) {
    if (team === 'player') ensurePlayerUnitDef(type);
    // Non-finite spawn coords (NaN/Infinity from level data, mods, or creative tools)
    // produce units that are permanently unreachable and unclickable, and poison
    // distance/pathfinding math. Clamp to the world before the unit is ever created.
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (typeof ErrorReporting !== 'undefined') {
        ErrorReporting.log?.('warn', 'spawnUnit received non-finite coords — clamped', {
          kind: 'spawn-coords',
          type,
          team,
          x,
          y,
        });
      }
      x = Number.isFinite(x) ? x : GS.worldW / 2;
      y = Number.isFinite(y) ? y : GS.worldH / 2;
    }
    const u = createUnit(type, x, y, team, { spawnWave: GS.wave, ...opts });
    if (!u) {
      if (typeof ErrorReporting !== 'undefined') {
        ErrorReporting.log?.('error', `spawnUnit failed — unknown type "${type}"`, {
          kind: 'spawn-fail',
          type,
          team,
          wave: GS.wave,
        });
      }
      return null;
    }
    // Pooled objects can leave hp undefined if def was incomplete — purge would delete them.
    if (!(u.hp > 0)) {
      const d = team === 'player' ? ensurePlayerUnitDef(type) : EnemyDefs[type];
      const hp = Math.max(1, d?.hp || 50);
      u.hp = hp;
      u.maxHp = Math.max(u.maxHp || 0, hp);
    }
    if (team === 'player') {
      applyPlayerStatMods(u);
      // Ballista / siege crews: keep siegeMult from def after loadout mods.
      if (u.type === 'ballista' && !(u.siegeMult > 1)) {
        const d = ensurePlayerUnitDef('ballista');
        u.siegeMult = d?.siegeMult || 2.2;
      }
      if (u.type === 'ballista' && !u.projectile) u.projectile = 'arrow';
      if (svc('GameDepth') && svc('GameDepth').isIpHero(u)) {
        u.baseMaxHp = null;
        u.baseDamage = null;
        svc('GameDepth').applyIpWaveScaling(u, GS.wave);
      }
    }
    return u;
  }

  function canTpVeteranUpgrade(unit) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
    if (!canSpendTpVeteranUpgrade(unit)) return false;
    const opts = getResearchOpts();
    return (
      (GS.creativeMode && GS.creativeSettings.unlockAll) ||
      (svc('Research') && svc('Research').isTpVeteranUpgradeUnlocked(opts))
    );
  }

  function refreshAcademyMentorUnlocks(unit, opts = {}) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return [];
    syncInteractionState();
    if (!isMaxLevelVeteran(unit)) {
      if (opts.announcePartial) {
        const need = MAX_VETERAN_TIER;
        const left = need - (unit.vetTier || 0);
        if (left > 0 && left <= need) {
          showMessage(
            `${getUnitDisplayName(unit)} is V${unit.vetTier || 0}/${need} — ${left} more promote${left > 1 ? 's' : ''} to unlock their academy mentor.`,
            280
          );
        }
      }
      return [];
    }
    const opened =
      typeof getAcademiesUnlockedByMentorType === 'function'
        ? getAcademiesUnlockedByMentorType(unit.type)
        : [];
    const mentorReady = opened.filter((t) => canBuildAcademyType(t, GS.wave, GS.units));
    if (opts.announce !== false && mentorReady.length) {
      const names = mentorReady
        .map((t) => BuildDefs[t]?.name || t)
        .slice(0, 3)
        .join(', ');
      const researchOpts = getResearchOpts();
      const needResearch = mentorReady.filter(
        (t) =>
          !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
          svc('Research') &&
          !svc('Research').isBuildUnlocked(t, researchOpts)
      );
      if (needResearch.length) {
        showMessage(
          `${getUnitDisplayName(unit)} is Immortal — mentor ready for ${names}. Research the academy charter/node to place it.`,
          360
        );
      } else {
        showMessage(
          `${getUnitDisplayName(unit)} is Immortal — ${names} unlocked for building!`,
          320
        );
      }
      svc('FloatingText').status(unit.x, unit.y - 16, 'ACADEMY MENTOR', '#80ffc0');
    }
    svc('UI')?.updateHUD?.(true);
    return mentorReady;
  }

  function upgradeSelectedVeteran() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) {
      showMessage('Select a living ally to promote.');
      return false;
    }
    if (!canSpendTpVeteranUpgrade(u)) {
      if ((u.vetTier || 0) >= MAX_VETERAN_TIER) {
        showMessage(
          `${getUnitDisplayName(u)} is already Immortal — their academy mentor is active if research allows.`
        );
        refreshAcademyMentorUnlocks(u, { announce: true });
        return false;
      }
      showMessage(
        'Not eligible yet — complete a gold-star cycle (3 gold) first, then Promote (U).'
      );
      return false;
    }
    const opts = getResearchOpts();
    const researchOk =
      (GS.creativeMode && GS.creativeSettings.unlockAll) ||
      (svc('Research') && svc('Research').isTpVeteranUpgradeUnlocked(opts));
    if (!researchOk) {
      showMessage('Research Veteran Doctrine at your Research Lab to promote core troops.');
      return false;
    }
    const cost = getVeteranUpgradeCost(u);
    if (!(GS.creativeMode && GS.creativeSettings.freeResources) && GS.tactical < cost) {
      showMessage(`Need ${cost} TP to promote ${getUnitDisplayName(u)}.`);
      return false;
    }
    if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= cost;
    u.vetUpgradeEligible = false;
    const prevTier = u.vetTier || 0;
    upgradeVeteranUnit(u);
    // notify handles FX; we own academy unlock messaging to avoid double toasts.
    if (u.honorName) {
      if (svc('VisualPolish')) svc('VisualPolish').honorFx(u);
    } else if (svc('VisualPolish')) {
      svc('VisualPolish').vetUpgradeFx(u);
    }
    const label = getVeteranLabel(u);
    svc('FloatingText').status(
      u.x,
      u.y,
      isSpecialistUnit(u) ? 'RANK UP!' : 'VETERAN!',
      VET_STAR_COLORS.gold
    );
    showMessage(`${label} — promoted to V${u.vetTier}/${MAX_VETERAN_TIER}`, 220);
    svc('Particles').heal(u.x, u.y);
    playSfx('promotion');
    ach('vet_event', {
      event: u.honorName ? 'honored_upgrade' : 'tp_upgrade',
      unitType: u.type,
      vetTier: u.vetTier,
      tpCost: cost,
    });
    if (u.honorName) {
      ach('vet_event', { event: 'honored', unitType: u.type, honorName: u.honorName });
    }
    recordPathImmortalIfEligible(u);
    refreshAcademyMentorUnlocks(u, {
      announce: (u.vetTier || 0) >= MAX_VETERAN_TIER && prevTier < MAX_VETERAN_TIER,
      announcePartial: (u.vetTier || 0) < MAX_VETERAN_TIER,
    });
    return true;
  }

  function recruitSelectedEcho() {
    if (GS.creativeMode || typeof ThematicEraSynergies === 'undefined') return false;
    const id = GS.selectedUnitId || GS.selectedUnitIds[0];
    const u = id ? getUnitById(id) : null;
    const echoId = u?.type;
    if (!echoId) {
      showMessage('Select a champion to echo-recruit.', 180);
      return false;
    }
    const result = ThematicEraSynergies.recruitHeroEcho(echoId, {
      wave: GS.wave,
      showMessage,
      addHighlight,
    });
    if (!result.ok) {
      showMessage(result.msg || 'Cannot recruit echo.', 220);
      return false;
    }
    if (typeof MythicPathEvolution !== 'undefined') {
      MythicPathEvolution.recordHeroEcho(echoId, GS.wave);
    }
    if (u) applyPlayerStatMods(u);
    svc('UI').updateHUD(true);
    return true;
  }

  function applyPlayerStatMods(u) {
    if (!u || u.team !== 'player' || u.isDoomslayer) return u;
    // These multiply stats in place, and spawnUnit plus several callers both run this,
    // so without a guard difficulty, kingdom and legacy bonuses stacked twice.
    if (u.statModsApplied) return u;
    u.statModsApplied = true;
    SiegeLoop.applySpawnMods(u);
    const diff = getDifficulty();
    if (diff.allyHpMult && diff.allyHpMult !== 1) {
      u.maxHp = Math.floor(u.maxHp * diff.allyHpMult);
      u.hp = Math.min(u.hp, u.maxHp);
    }
    if (diff.allyDmgMult && diff.allyDmgMult !== 1) {
      u.damage = Math.floor(u.damage * diff.allyDmgMult);
    }
    if (diff.allyAccDelta) {
      u.accuracy = Math.max(0, Math.min(75, u.accuracy + diff.allyAccDelta));
    }
    if (diff.buildSpeedMult && diff.buildSpeedMult !== 1 && u.type === 'builder') {
      u.buildSpeedMult = (u.buildSpeedMult || 1) * diff.buildSpeedMult;
    }
    if (typeof getKingdomStageBuffs === 'function') {
      const kb = getKingdomStageBuffs(GS.wave);
      const defLine = u.type === 'footman' || u.type === 'archer' || u.type === 'pikeman';
      if (kb.defenseHpMult > 1 && defLine) {
        u.maxHp = Math.floor(u.maxHp * kb.defenseHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (kb.armyDmgMult > 1 && u.damage) {
        u.damage = Math.floor(u.damage * kb.armyDmgMult);
      }
      if (kb.siegeMult > 1 && (u.type === 'sapper' || u.type === 'ballista')) {
        u.siegeMult = (u.siegeMult || 1) * kb.siegeMult;
      }
    }
    if (svc('CrownLegacies') && !GS.creativeMode) {
      svc('CrownLegacies').applyUnitBonuses(u);
    }
    if (typeof EternalLegacyTree !== 'undefined' && !GS.creativeMode) {
      EternalLegacyTree.applyUnitBonuses(u, GS.wave);
    }
    if (typeof NarrativeThread !== 'undefined' && !GS.creativeMode) {
      NarrativeThread.applyLegendBonuses(u, GS.wave);
    }
    if (typeof RunPath !== 'undefined' && !GS.creativeMode) RunPath.applyUnit(u);
    if (typeof Honours !== 'undefined' && !GS.creativeMode) Honours.onRecruit(u);
    if (typeof TechTreeBranches !== 'undefined' && !GS.creativeMode) {
      const fx = TechTreeBranches.getCombinedEffects(GS.wave);
      // These four were shown on the tree ("Dmg ×1.xx") but never applied.
      if (fx.playerDmgMult > 1 && u.damage) u.damage = Math.floor(u.damage * fx.playerDmgMult);
      if (fx.hpMult > 1) {
        u.maxHp = Math.floor(u.maxHp * fx.hpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (fx.archerDmgMult > 1 && u.type === 'archer' && u.damage) {
        u.damage = Math.floor(u.damage * fx.archerDmgMult);
      }
      if (fx.siegeMult > 1 && (u.type === 'sapper' || u.type === 'ballista')) {
        u.siegeMult = (u.siegeMult || 1) * fx.siegeMult;
      }
      if (fx.footmanHpMult > 1 && (u.type === 'footman' || u.type === 'pikeman')) {
        u.maxHp = Math.floor(u.maxHp * fx.footmanHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (
        fx.mageDmgMult > 1 &&
        ['mage', 'wizard', 'warlock', 'cleric', 'elemental'].includes(u.type) &&
        u.damage
      ) {
        u.damage = Math.floor(u.damage * fx.mageDmgMult);
      }
      if (
        fx.mageHpMult > 1 &&
        ['mage', 'wizard', 'warlock', 'cleric', 'elemental', 'healer'].includes(u.type)
      ) {
        u.maxHp = Math.floor(u.maxHp * fx.mageHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (
        fx.mythicHpMult > 1 &&
        (isCompanyHeroUnit(u.type) || isChampionUnit(u.type) || u.type === 'doomslayer_hero')
      ) {
        u.maxHp = Math.floor(u.maxHp * fx.mythicHpMult);
        u.hp = Math.min(u.hp, u.maxHp);
      }
      if (
        fx.mythicMorale > 0 &&
        (isCompanyHeroUnit(u.type) || isChampionUnit(u.type) || u.type === 'doomslayer_hero')
      ) {
        u.morale = Math.min(u.maxMorale, u.morale + fx.mythicMorale);
      }
      // fx.hpMult is applied once, above; it used to be applied here a second time.
      if (fx.buildSpeedMult > 1 && u.type === 'builder') {
        u.buildSpeedMult = (u.buildSpeedMult || 1) * fx.buildSpeedMult;
      }
    }
    if (typeof syncVeteranStatsToTier === 'function') syncVeteranStatsToTier(u);
    return u;
  }

  function notifyTraits(unit, ids) {
    for (const id of ids || []) {
      const t = Veterans.TRAITS[id];
      svc('FloatingText')?.status?.(
        unit.x,
        unit.y - 18,
        t.name.toUpperCase(),
        VET_STAR_COLORS.gold
      );
      showMessage(`${getUnitDisplayName(unit)} earned ${t.name}: ${t.gain}, ${t.cost}.`, 260);
    }
  }

  function notifyHallDeath(unit, entry) {
    if (!entry) return;
    showMessage(
      `${entry.name} has fallen. The name stays on the Hall of Veterans roll and can be raised there.`,
      300
    );
  }

  function forgetSelectedTrait(id) {
    const u = getSelectedUnit();
    if (!u || !Veterans.TRAITS[id]) return false;
    const before = [...(u.traits || [])];
    if (!Veterans.forgetTrait(u, id, GS.wave)) return false;
    showMessage(`${getUnitDisplayName(u)} gave up ${Veterans.TRAITS[id].name}.`, 200);
    notifyTraits(
      u,
      u.traits.filter((t) => !before.includes(t))
    );
    return true;
  }

  function standingHall() {
    return (
      GS.buildings.find(
        (b) => b.owner === 'player' && b.type === 'hall_of_veterans' && b.complete && b.hp > 0
      ) || null
    );
  }

  function raiseBlock(entry) {
    if (!entry.fallen) return 'still on the field';
    if (!standingHall()) return 'needs a standing Hall of Veterans';
    if (GS.hallRaisedWave === GS.wave) return 'the Hall raises one veteran a wave';
    const cost = Veterans.raiseCost(entry);
    if (GS.tactical < cost) return `needs ${cost} TP`;
    return null;
  }

  function getHallRoll() {
    return Veterans.getHall().map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      fallen: !!e.fallen,
      deaths: e.deaths || 0,
      fellWave: e.fellWave,
      traits: (e.traits || []).map((id) => Veterans.TRAITS[id]?.name).filter(Boolean),
      cost: Veterans.raiseCost(e),
      block: raiseBlock(e),
    }));
  }

  function raiseVeteran(id) {
    const entry = Veterans.getHall().find((e) => e.id === id);
    if (!entry) return false;
    const block = raiseBlock(entry);
    if (block) {
      showMessage(`Cannot raise ${entry.name}: ${block}.`, 200);
      return false;
    }
    const hall = standingHall();
    const u = spawnUnit(entry.type, hall.x, hall.y + (hall.radius || 24) + 14, 'player');
    if (!u) return false;
    GS.tactical -= Veterans.raiseCost(entry);
    GS.hallRaisedWave = GS.wave;
    Veterans.restore(u, entry);
    GS.units.push(u);
    svc('FloatingText')?.status?.(u.x, u.y - 18, 'RAISED', VET_STAR_COLORS.gold);
    showMessage(
      `${entry.name} walks out of the Hall at rank ${Veterans.RAISED_TIER}, weaker for the grave.`,
      280
    );
    return true;
  }

  function ascendSelectedUnit(honourId) {
    if (GS.creativeMode || typeof Honours === 'undefined') return false;
    const id = GS.selectedUnitId || GS.selectedUnitIds[0];
    const u = id ? getUnitById(id) : null;
    if (!u || u.hp <= 0) {
      showMessage('Select a veteran to honour.', 180);
      return false;
    }
    const result = Honours.give(u, honourId, { showMessage, addHighlight });
    if (!result.ok) {
      showMessage(result.msg || 'Cannot honour him.', 220);
      return false;
    }
    svc('UI').updateHUD(true);
    svc('UX')?.showUnitInfo?.();
    return true;
  }

  function canDeployUnitType(type) {
    if (GS.creativeMode && !GS.creativeSettings.academyDeploy) {
      return type === 'doomslayer_hero' || isChampionUnit(type) || isCompanyHeroUnit(type);
    }
    return true;
  }

  function addHighlight(type, text) {
    GS.sessionHighlights.push({ type, text, wave: GS.wave, tick: GS.updateTick });
    if (GS.sessionHighlights.length > 48) GS.sessionHighlights.shift();
  }

  function recordFootmanCommandElevation(unit, promoted = false) {
    if (!unit || unit.team !== 'player') return;
    if (!promoted && unit.type !== 'footman') return;
    const key = unit.id || unit.honorName || `${unit.type}_${unit.x | 0}_${unit.y | 0}`;
    ach('footman_command_elevated', { unitKey: key, promoted: !!promoted });
    if (promoted) {
      ach('footman_promoted_general', { unitKey: key });
      ach('general_fielded', { wave: GS.wave });
    }
  }

  function announceHonorName(unit, extra = '') {
    if (!unit.honorName) return;
    if (svc('Legacy')) svc('Legacy').recordHonor(unit, GS.wave);
    addHighlight('honor', `${unit.honorName} honored by the Crown`);
    svc('FloatingText').status(unit.x, unit.y - 12, unit.honorName, '#ffd700');
    showMessage(
      `The Crown names ${unit.honorName}${extra} — gold-star devotion to the realm!`,
      320
    );
    svc('Particles').heal(unit.x, unit.y);
    playSfx('honorName');
    ach('vet_event', { event: 'honored', unitType: unit.type, honorName: unit.honorName });
    if (unit.type === 'footman') recordFootmanCommandElevation(unit);
    if (typeof NarrativeThread !== 'undefined' && !GS.creativeMode) {
      NarrativeThread.onHeroHonored(unit, GS.wave, { showMessage, addHighlight });
    }
  }

  function notifyVetStarEvent(unit, event) {
    if (!event || unit.team !== 'player') return;
    const spec = isSpecialistUnit(unit);

    if (event === 'honored_upgrade' || event === 'honored_general_star') {
      if (svc('VisualPolish')) svc('VisualPolish').honorFx(unit);
      const label = getVeteranLabel(unit);
      svc('FloatingText').status(
        unit.x,
        unit.y,
        spec ? 'RANK UP!' : 'VETERAN!',
        VET_STAR_COLORS.gold
      );
      const bonus = unit.isGeneral
        ? `command aura +${Math.round((unit.generalStars || 0) * 4.5)}%`
        : unit.type === 'healer'
          ? '+heal, +range'
          : unit.type === 'builder'
            ? '+build speed, +range'
            : unit.type === 'courier'
              ? '+speed, faster dispatch'
              : '+HP, +damage, +speed';
      announceHonorName(unit, label ? `, now ${label}` : '');
      showMessage(`${label || getUnitDisplayName(unit)} — ${bonus}`);
    } else if (event === 'upgrade') {
      if (svc('VisualPolish')) svc('VisualPolish').vetUpgradeFx(unit);
      const label = getVeteranLabel(unit);
      svc('FloatingText').status(
        unit.x,
        unit.y,
        spec ? 'RANK UP!' : 'VETERAN!',
        VET_STAR_COLORS.gold
      );
      const bonus =
        unit.type === 'healer'
          ? '+heal, +range'
          : unit.type === 'builder'
            ? '+build speed, +range'
            : unit.type === 'courier'
              ? '+speed, faster dispatch'
              : '+HP, +damage, +speed';
      showMessage(`${label} — ${bonus}`);
      svc('Particles').heal(unit.x, unit.y);
      playSfx('promotion');
      // Specialist auto-ranks and combat promotions — refresh academy mentor gate.
      refreshAcademyMentorUnlocks(unit, {
        announce: isMaxLevelVeteran(unit),
        announcePartial: !isMaxLevelVeteran(unit) && isSpecialistUnit(unit),
      });
    } else if (event === 'max_rank' || event === 'honored_max') {
      refreshAcademyMentorUnlocks(unit, { announce: true });
    } else if (event === 'upgrade_eligible' || event === 'honored_eligible') {
      const cost = getVeteranUpgradeCost(unit);
      const name = getUnitDisplayName(unit);
      svc('FloatingText').status(unit.x, unit.y, 'PROMOTE?', '#c0a040');
      showMessage(
        `${name} earned promotion — research Veteran Doctrine, then spend ${cost} TP (unit panel or U).`,
        340
      );
      playSfx('promotionReady');
    } else if (event === 'general_star') {
      svc('FloatingText').status(unit.x, unit.y, '★ Command', VET_STAR_COLORS.gold);
      showMessage(`${getUnitDisplayName(unit)} — command star earned (+aura)`, 220);
      svc('Particles').heal(unit.x, unit.y);
    } else if (event === 'gold') {
      if (svc('VisualPolish')) svc('VisualPolish').vetUpgradeFx(unit);
      svc('FloatingText').status(unit.x, unit.y, '★ Gold', VET_STAR_COLORS.gold);
    } else if (event === 'silver') {
      svc('FloatingText').status(unit.x, unit.y, '★ Silver', VET_STAR_COLORS.silver);
    } else if (event === 'bronze') {
      svc('FloatingText').status(unit.x, unit.y, spec ? '★ Rank' : '★', specialistStarColor(unit));
    }
    if (event === 'gold' || event === 'honored_upgrade') {
      svc('Particles').heal(unit.x, unit.y);
      if ((unit.vetGold || 0) >= 3 || event === 'honored_upgrade') {
        CombatFX?.hitSpark(unit.x, unit.y - 8);
        unit.honorGlowTimer = 240;
      }
    }
    if (event !== 'honored_upgrade' && event !== 'honored_general_star') {
      ach('vet_event', { event, unitType: unit.type, vetTier: unit.vetTier });
    }
  }

  return {
    bind,
    addHighlight,
    applyPlayerStatMods,
    ascendSelectedUnit,
    canDeployUnitType,
    canTpVeteranUpgrade,
    findLivePlayerOfType,
    hasCompanyHall,
    hasChampionsHall,
    forgetSelectedTrait,
    getHallRoll,
    notifyHallDeath,
    notifyTraits,
    notifyVetStarEvent,
    raiseVeteran,
    recordFootmanCommandElevation,
    recruitSelectedEcho,
    spawnUnit,
    upgradeSelectedVeteran,
  };
})();
