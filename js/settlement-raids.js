/**
 * Enemy Settlement Raids — after wave 150, hostile factions raise northern outposts/hamlets.
 * Player receives raid missions: dispatch a strike force to raze them for big TP and science loot.
 */
const SettlementRaids = (() => {
  const SETTLEMENT_RAID_WAVE_MIN = 150;
  const SETTLEMENT_RAID_WAVE_PEAK = 200;
  const MIN_STRIKE_FORCE = 2;
  const MAX_STRIKE_FORCE = 6;
  const MAX_ACTIVE_MISSIONS = 6;

  const TIER_REWARDS = {
    outpost: { tp: 10, science: 1, label: 'Outpost' },
    hamlet: { tp: 18, science: 2, label: 'Hamlet' },
    guild: { tp: 26, science: 3, label: 'Guild' },
    academy: { tp: 32, science: 4, label: 'Academy' },
  };

  let missions = [];
  let raidsAnnounced = false;
  let totalRaidsCompleted = 0;
  let totalLootTp = 0;

  function resetRun() {
    missions = [];
    raidsAnnounced = false;
    totalRaidsCompleted = 0;
    totalLootTp = 0;
  }

  function isActive(wave) {
    return (wave | 0) >= SETTLEMENT_RAID_WAVE_MIN;
  }

  function isUnlocked(wave) {
    return isActive(wave);
  }

  function getRaidIntensity(wave) {
    const w = wave | 0;
    if (w < SETTLEMENT_RAID_WAVE_MIN) return 0;
    if (w >= SETTLEMENT_RAID_WAVE_PEAK) return 1;
    return (w - SETTLEMENT_RAID_WAVE_MIN) / (SETTLEMENT_RAID_WAVE_PEAK - SETTLEMENT_RAID_WAVE_MIN);
  }

  /** Boost enemy faction northern building after wave 150. */
  function getFactionBuildBoost(wave) {
    const t = getRaidIntensity(wave);
    if (t <= 0) return {};
    return {
      capBonus: t >= 1 ? 2 : 1,
      intervalMult: t >= 1 ? 0.5 : 0.72,
      forceStage3: t > 0 && t < 0.5,
    };
  }

  function classifySettlement(building) {
    if (!building) return 'outpost';
    if (building.isHamlet || building.type === 'enemy_hamlet') return 'hamlet';
    if (building.isMerchantGuild || building.type === 'enemy_merchant_guild') return 'guild';
    if (building.type === 'enemy_shadow_academy' || building.type === 'enemy_war_academy')
      return 'academy';
    return 'outpost';
  }

  function computeReward(building, wave) {
    const tier = classifySettlement(building);
    const base = TIER_REWARDS[tier] || TIER_REWARDS.outpost;
    const intensity = 0.85 + getRaidIntensity(wave) * 0.35;
    const stageBoost =
      building.enemyFaction && typeof EnemyFactions !== 'undefined'
        ? (EnemyFactions.getFactionTier(building.enemyFaction, wave)?.stage || 1) * 0.06
        : 0;
    const tp = Math.round(base.tp * intensity * (1 + stageBoost));
    const science = base.science + (getRaidIntensity(wave) >= 1 ? 1 : 0);
    return { tier, tp, science, label: base.label };
  }

  function formatMissionLabel(building, reward, factionId) {
    const defName = typeof BuildDefs !== 'undefined' ? BuildDefs[building.type]?.name : 'Hold';
    const faction =
      factionId && typeof EnemyFactions !== 'undefined'
        ? EnemyFactions.getFactionDef(factionId)?.shortName
        : null;
    const prefix = faction ? `${faction} ` : '';
    return `${prefix}${reward.label || defName}`;
  }

  function createMission(building, wave) {
    const reward = computeReward(building, wave);
    const factionId =
      building.enemyFaction ||
      (typeof EnemyFactions !== 'undefined'
        ? EnemyFactions.getBuildingFaction(building.type)
        : null);
    return {
      id: `raid:${building.id}`,
      buildingId: building.id,
      buildingType: building.type,
      factionId,
      label: formatMissionLabel(building, reward, factionId),
      tier: reward.tier,
      rewardTp: reward.tp,
      rewardScience: reward.science,
      dispatched: false,
      dispatchedUnitIds: [],
      completed: false,
      x: building.x,
      y: building.y,
    };
  }

  function refreshMissions(buildings, wave, ctx = {}) {
    if (!isActive(wave)) {
      missions = [];
      return [];
    }
    const isAttackable =
      ctx.isAttackable ||
      ((b) =>
        b &&
        b.owner === 'enemy' &&
        b.hp > 0 &&
        (b.isEnemySettlement || b.isHamlet || b.isMerchantGuild));
    const targets = (buildings || []).filter(isAttackable);
    const liveIds = new Set(targets.map((b) => b.id));

    missions = missions.filter((m) => liveIds.has(m.buildingId) && !m.completed);

    for (const b of targets) {
      if (missions.length >= MAX_ACTIVE_MISSIONS) break;
      if (missions.some((m) => m.buildingId === b.id)) continue;
      missions.push(createMission(b, wave));
    }

    for (const m of missions) {
      const b = targets.find((t) => t.id === m.buildingId);
      if (!b) continue;
      const reward = computeReward(b, wave);
      m.rewardTp = reward.tp;
      m.rewardScience = reward.science;
      m.x = b.x;
      m.y = b.y;
    }
    return missions;
  }

  function getMissions() {
    return missions.filter((m) => !m.completed);
  }

  function getMission(missionId) {
    return missions.find((m) => m.id === missionId && !m.completed) || null;
  }

  function isStrikeUnit(unit) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) return false;
    if (
      unit.combatType === 'builder' ||
      unit.combatType === 'courier' ||
      unit.combatType === 'healer'
    )
      return false;
    return !!unit.canHunt;
  }

  function canDispatch(missionId, unitIds, units) {
    const mission = getMission(missionId);
    if (!mission) return { ok: false, reason: 'no_mission' };
    if (mission.dispatched) return { ok: false, reason: 'already_dispatched' };
    const fighters = (unitIds || [])
      .map((id) => units?.find((u) => u.id === id))
      .filter(isStrikeUnit);
    if (fighters.length < MIN_STRIKE_FORCE) {
      return { ok: false, reason: 'need_units', need: MIN_STRIKE_FORCE, have: fighters.length };
    }
    return { ok: true, mission, fighters: fighters.slice(0, MAX_STRIKE_FORCE) };
  }

  function dispatchStrike(missionId, unitIds, ctx = {}) {
    const check = canDispatch(missionId, unitIds, ctx.units);
    if (!check.ok) return check;

    const { mission, fighters } = check;
    mission.dispatched = true;
    mission.dispatchedUnitIds = fighters.map((u) => u.id);

    for (const u of fighters) {
      u.raidMissionId = mission.id;
      u.raidTargetId = mission.buildingId;
      u.structureTargetId = mission.buildingId;
      u.huntMode = true;
      u.manualOrder = false;
      u.path = [];
      u.pathIndex = 0;
    }

    const hooks = ctx.hooks || {};
    hooks.showMessage?.(
      `Strike force dispatched — ${fighters.length} hunters raid ${mission.label} (+${mission.rewardTp} TP on raze).`,
      360
    );
    hooks.floatingText?.(mission.x, mission.y - 24, 'STRIKE RAID', '#ff9040');
    hooks.addHighlight?.('raid', `${mission.label} — strike force en route`);

    return { ok: true, mission, count: fighters.length };
  }

  function clearRaidFlagsFromUnits(units, missionId) {
    for (const u of units || []) {
      if (u.raidMissionId === missionId) {
        u.raidMissionId = null;
        u.raidTargetId = null;
        if (
          u.structureTargetId &&
          missions.find((m) => m.id === missionId)?.buildingId === u.structureTargetId
        ) {
          u.structureTargetId = null;
        }
      }
    }
  }

  function onSettlementDestroyed(building, ctx = {}) {
    const mission = missions.find((m) => m.buildingId === building?.id);
    if (!mission || mission.completed) return null;

    mission.completed = true;
    clearRaidFlagsFromUnits(ctx.units, mission.id);

    const hooks = ctx.hooks || {};
    let rewardTp = 0;
    let rewardScience = 0;

    if (mission.dispatched) {
      rewardTp = mission.rewardTp;
      rewardScience = mission.rewardScience;
      totalRaidsCompleted++;
      totalLootTp += rewardTp;
      ctx.grantTp?.(rewardTp);
      if (rewardScience > 0) ctx.grantScience?.(rewardScience);
      hooks.showMessage?.(
        `Raid success — ${mission.label} razed! +${rewardTp} TP${rewardScience ? `, +${rewardScience} science` : ''}.`,
        400
      );
      hooks.floatingText?.(building.x, building.y, `LOOT +${rewardTp} TP`, '#60c0ff');
      hooks.addHighlight?.('raid', `Raid complete — +${rewardTp} TP`);
      return { mission, rewardTp, rewardScience, strikeBonus: true };
    }

    rewardTp = Math.max(2, Math.floor(mission.rewardTp * 0.3));
    totalLootTp += rewardTp;
    ctx.grantTp?.(rewardTp);
    hooks.showMessage?.(`Enemy ${mission.label} destroyed — scavenged +${rewardTp} TP.`, 260);
    return { mission, rewardTp, partial: true };
  }

  function checkWaveAnnouncement(wave, hooks = {}) {
    if (raidsAnnounced || wave !== SETTLEMENT_RAID_WAVE_MIN) return null;
    raidsAnnounced = true;
    hooks.addHighlight?.('era', 'Settlement Raids');
    hooks.showMessage?.(
      'Wave 150 — Settlement Raids! Enemy factions raise northern outposts and hamlets. Select hunters and dispatch strike forces for big TP loot.',
      420
    );
    hooks.floatingText?.(hooks.worldW / 2, 64, 'RAIDS OPEN', '#ff9040');
    return { wave: SETTLEMENT_RAID_WAVE_MIN };
  }

  function getStateSnapshot(wave, buildings, ctx = {}) {
    const active = isActive(wave);
    const list = active ? refreshMissions(buildings, wave, ctx) : [];
    const pending = list.filter((m) => !m.dispatched);
    const inFlight = list.filter((m) => m.dispatched);
    return {
      active,
      unlocked: active,
      waveMin: SETTLEMENT_RAID_WAVE_MIN,
      intensity: getRaidIntensity(wave),
      missions: list.map((m) => ({ ...m })),
      pendingCount: pending.length,
      inFlightCount: inFlight.length,
      summary: active
        ? list.length
          ? `${list.length} raid${list.length > 1 ? 's' : ''} · ${pending.length} open`
          : 'Scan north for holds'
        : `Unlocks wave ${SETTLEMENT_RAID_WAVE_MIN}`,
      totalCompleted: totalRaidsCompleted,
      totalLootTp,
      minStrikeForce: MIN_STRIKE_FORCE,
    };
  }

  return {
    SETTLEMENT_RAID_WAVE_MIN,
    SETTLEMENT_RAID_WAVE_PEAK,
    MIN_STRIKE_FORCE,
    MAX_STRIKE_FORCE,
    resetRun,
    isActive,
    isUnlocked,
    getRaidIntensity,
    getFactionBuildBoost,
    classifySettlement,
    computeReward,
    refreshMissions,
    getMissions,
    getMission,
    isStrikeUnit,
    canDispatch,
    dispatchStrike,
    onSettlementDestroyed,
    checkWaveAnnouncement,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SettlementRaids = SettlementRaids;
