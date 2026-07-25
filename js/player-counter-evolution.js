/**
 * Player Counter-Evolution — offensive doctrines and off-map expeditions that
 * weaken enemy factions before they reach full evolution strength.
 */
const PlayerCounterEvolution = (() => {
  const COUNTER_WAVE_MIN = 15;
  const EXPEDITION_WAVE_MIN = 25;
  const MIN_EXPEDITION_FORCE = 1;
  const MAX_EXPEDITION_FORCE = 4;

  const EXPEDITION_LOOT = {
    baseTp: 6,
    baseScience: 1,
    perSurvivorTp: 3,
    perStageTp: 4,
    perStageScience: 1,
    fullPartyScience: 1,
  };

  const COUNTER_DOCTRINES = {
    probing_raid: {
      id: 'probing_raid',
      name: 'Probing Raid',
      cost: 3,
      kingdomStage: 1,
      waveMin: 15,
      desc: 'Scouts harass the weakest host faction — −1 effective stage for 2 waves.',
      stagePenalty: 1,
      durationWaves: 2,
      spawnMult: 0.92,
    },
    border_sortie: {
      id: 'border_sortie',
      name: 'Border Sortie',
      cost: 5,
      kingdomStage: 2,
      waveMin: 35,
      desc: 'Cavalry sortie — target faction spawns −18% and skips northern builds 1 wave.',
      stagePenalty: 1,
      durationWaves: 2,
      spawnMult: 0.82,
      buildingSkipWaves: 1,
    },
    northern_campaign: {
      id: 'northern_campaign',
      name: 'Northern Campaign',
      cost: 7,
      kingdomStage: 3,
      waveMin: 60,
      desc: 'Full campaign — −2 effective stages, −25% spawns, 2-wave build halt.',
      stagePenalty: 2,
      durationWaves: 3,
      spawnMult: 0.75,
      buildingSkipWaves: 2,
      threatPush: 6,
    },
    dominion_offensive: {
      id: 'dominion_offensive',
      name: 'Dominion Offensive',
      cost: 9,
      kingdomStage: 4,
      waveMin: 120,
      desc: 'Realm-wide push — cripple a faction (−2 stages, −30% spawns) and −10 host threat.',
      stagePenalty: 2,
      durationWaves: 4,
      spawnMult: 0.7,
      buildingSkipWaves: 3,
      threatPush: 10,
    },
  };

  let factionDebuffs = {};
  let activeExpeditions = [];
  let counterAnnounced = false;
  let totalExpeditions = 0;
  let totalDoctrines = 0;

  function resetRun() {
    factionDebuffs = {};
    activeExpeditions = [];
    counterAnnounced = false;
    totalExpeditions = 0;
    totalDoctrines = 0;
  }

  function isUnlocked(wave) {
    return (wave | 0) >= COUNTER_WAVE_MIN;
  }

  function canExpedition(wave) {
    return (wave | 0) >= EXPEDITION_WAVE_MIN;
  }

  function isCounterDoctrineUnlocked(def, wave, kingdomStage) {
    if (!def) return false;
    if (def.waveMin && wave < def.waveMin) return false;
    return kingdomStage >= (def.kingdomStage || 1);
  }

  function getUnlockedCounterDoctrines(wave, kingdomStage) {
    return Object.values(COUNTER_DOCTRINES).filter((d) =>
      isCounterDoctrineUnlocked(d, wave, kingdomStage)
    );
  }

  function getActiveFactions(wave) {
    if (typeof EnemyFactions === 'undefined') return [];
    return EnemyFactions.getActiveFactions(wave);
  }

  function pickWeakestFaction(wave, excludeId = null) {
    const factions = getActiveFactions(wave)
      .filter((f) => f.id !== excludeId)
      .sort((a, b) => (a.currentTier?.stage || 0) - (b.currentTier?.stage || 0));
    return factions[0] || null;
  }

  function applyDebuff(factionId, wave, effect = {}) {
    const existing = factionDebuffs[factionId];
    const expires = wave + (effect.durationWaves || 2);
    factionDebuffs[factionId] = {
      factionId,
      appliedWave: wave,
      expiresWave: Math.max(expires, existing?.expiresWave || 0),
      stagePenalty: Math.max(effect.stagePenalty || 0, existing?.stagePenalty || 0),
      spawnMult: Math.min(effect.spawnMult ?? 1, existing?.spawnMult ?? 1),
      buildingSkipWaves: Math.max(effect.buildingSkipWaves || 0, existing?.buildingSkipWaves || 0),
      buildingSkipUntil: Math.max(
        wave + Math.max(effect.buildingSkipWaves || 0, 0),
        existing?.buildingSkipUntil || 0
      ),
      label: effect.label || existing?.label,
    };
    return factionDebuffs[factionId];
  }

  function pruneDebuffs(wave) {
    for (const id of Object.keys(factionDebuffs)) {
      if (factionDebuffs[id].expiresWave <= wave) delete factionDebuffs[id];
    }
  }

  function getFactionModifiers(factionId, wave) {
    pruneDebuffs(wave);
    const d = factionDebuffs[factionId];
    if (!d || d.expiresWave <= wave) {
      return { stagePenalty: 0, spawnMult: 1, skipBuilding: false, active: false };
    }
    return {
      stagePenalty: d.stagePenalty || 0,
      spawnMult: d.spawnMult ?? 1,
      skipBuilding: (d.buildingSkipUntil || 0) > wave,
      active: true,
      expiresWave: d.expiresWave,
      label: d.label,
    };
  }

  function getEffectiveStage(factionId, wave, baseStage) {
    const mods = getFactionModifiers(factionId, wave);
    return Math.max(1, (baseStage || 1) - (mods.stagePenalty || 0));
  }

  function isExpeditionUnit(unit) {
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

  function getExpeditionLootScale(wave) {
    const academy =
      typeof academyThresholdBlend === 'function' ? academyThresholdBlend(wave) : wave >= 100 ? 1 : 0;
    const rts = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : wave >= 200 ? 1 : 0;
    return 1 + academy * 0.35 + rts * 0.55;
  }

  function computeExpeditionLoot(expedition, survivors, wave) {
    const stage = expedition.targetStage || 1;
    const scale = getExpeditionLootScale(wave);
    let tp = Math.round(
      (EXPEDITION_LOOT.baseTp +
        survivors * EXPEDITION_LOOT.perSurvivorTp +
        stage * EXPEDITION_LOOT.perStageTp) *
        scale
    );
    let science = Math.round(
      (EXPEDITION_LOOT.baseScience + stage * EXPEDITION_LOOT.perStageScience) * scale
    );
    if (survivors >= expedition.unitIds.length) science += EXPEDITION_LOOT.fullPartyScience;
    return { tp, science };
  }

  function buildExpeditionTargets(wave) {
    return getActiveFactions(wave).map((f) => {
      const mods = getFactionModifiers(f.id, wave);
      const debuffed = mods.active;
      return {
        factionId: f.id,
        name: f.shortName || f.name,
        color: f.color,
        stage: f.currentTier?.stage || 1,
        effectiveStage: getEffectiveStage(f.id, wave, f.currentTier?.stage),
        tierLabel: f.currentTier?.stageLabel || `S${f.currentTier?.stage}`,
        debuffed,
        debuffNote: debuffed
          ? ` weakened to S${getEffectiveStage(f.id, wave, f.currentTier?.stage)}`
          : '',
      };
    });
  }

  function executeCounterDoctrine(doctrineId, wave, kingdomStage, ctx = {}) {
    const def = COUNTER_DOCTRINES[doctrineId];
    if (!def) return { ok: false, reason: 'unknown' };
    if (!isCounterDoctrineUnlocked(def, wave, kingdomStage)) return { ok: false, reason: 'locked' };
    const target = ctx.factionId
      ? getActiveFactions(wave).find((f) => f.id === ctx.factionId)
      : pickWeakestFaction(wave);
    if (!target) return { ok: false, reason: 'no_target' };

    const debuff = applyDebuff(target.id, wave, {
      stagePenalty: def.stagePenalty,
      durationWaves: def.durationWaves,
      spawnMult: def.spawnMult,
      buildingSkipWaves: def.buildingSkipWaves || 0,
      label: def.name,
    });
    totalDoctrines++;

    if (def.threatPush && typeof AsymmetricWarfare !== 'undefined') {
      AsymmetricWarfare.addThreatXp(-def.threatPush, 'counter_offensive');
    }

    const hooks = ctx.hooks || {};
    hooks.showMessage?.(
      `${def.name} — ${target.shortName} set back to S${getEffectiveStage(target.id, wave, target.currentTier?.stage)} for ${def.durationWaves} wave(s).`,
      380
    );
    hooks.addHighlight?.('counter', `${def.name} vs ${target.shortName}`);
    hooks.floatingText?.(ctx.worldW / 2, 76, 'COUNTER', '#60a0ff');

    return { ok: true, doctrine: def, target, debuff };
  }

  function dispatchExpedition(factionId, unitIds, wave, ctx = {}) {
    if (!canExpedition(wave)) return { ok: false, reason: 'locked' };
    const target = getActiveFactions(wave).find((f) => f.id === factionId);
    if (!target) return { ok: false, reason: 'no_target' };

    const fighters = (unitIds || [])
      .map((id) => ctx.units?.find((u) => u.id === id))
      .filter(isExpeditionUnit);
    if (fighters.length < MIN_EXPEDITION_FORCE) {
      return { ok: false, reason: 'need_units', need: MIN_EXPEDITION_FORCE, have: fighters.length };
    }
    if (fighters.length > MAX_EXPEDITION_FORCE) {
      return { ok: false, reason: 'too_many', max: MAX_EXPEDITION_FORCE };
    }

    const returnWave = wave + 1;
    const stage = target.currentTier?.stage || 1;
    const lootPreview = computeExpeditionLoot(
      { targetStage: stage, unitIds: fighters.map((u) => u.id) },
      fighters.length,
      returnWave
    );
    const expedition = {
      id: `exp:${factionId}:${wave}`,
      factionId,
      factionName: target.shortName,
      dispatchWave: wave,
      returnWave,
      targetStage: stage,
      unitIds: fighters.map((u) => u.id),
      unitTypes: fighters.map((u) => u.type),
      stagePenalty: stage >= 4 ? 2 : stage >= 3 ? 1 : 1,
      spawnMult: stage >= 4 ? 0.78 : 0.85,
      buildingSkipWaves: stage >= 3 ? 2 : 1,
      durationWaves: 2,
      lootPreview,
    };

    for (const u of fighters) {
      u.onExpedition = expedition.id;
      u.expeditionTarget = factionId;
    }
    activeExpeditions.push(expedition);
    totalExpeditions++;

    const hooks = ctx.hooks || {};
    hooks.showMessage?.(
      `Expedition dispatched — ${fighters.length} troops march off-map against ${target.shortName}. Returns wave ${returnWave} with ~${lootPreview.tp} TP / ${lootPreview.science} SP loot.`,
      400
    );
    hooks.floatingText?.(ctx.worldW / 2, 92, 'EXPEDITION', '#5080d0');
    hooks.addHighlight?.('counter', `Expedition → ${target.shortName}`);

    return { ok: true, expedition, count: fighters.length };
  }

  function resolveExpeditions(wave, ctx = {}) {
    const hooks = ctx.hooks || {};
    const resolved = [];
    const remaining = [];

    for (const exp of activeExpeditions) {
      if (exp.returnWave > wave) {
        remaining.push(exp);
        continue;
      }
      const debuff = applyDebuff(exp.factionId, wave, {
        stagePenalty: exp.stagePenalty,
        durationWaves: exp.durationWaves,
        spawnMult: exp.spawnMult,
        buildingSkipWaves: exp.buildingSkipWaves,
        label: 'Expedition',
      });

      const survivalRate = 0.72 + Math.min(0.2, exp.unitIds.length * 0.05);
      let survivors = 0;
      for (const type of exp.unitTypes) {
        if (Math.random() > survivalRate) continue;
        const u = ctx.spawnUnit?.(type, ctx.deployX, ctx.deployY, 'player');
        if (!u) continue;
        ctx.applyPlayerMods?.(u);
        u.targetY = ctx.rallyY;
        u.huntMode = ctx.globalHunt ?? true;
        ctx.units?.push(u);
        survivors++;
      }

      const baseStage =
        typeof EnemyFactions !== 'undefined'
          ? EnemyFactions.getFactionTier(exp.factionId, wave)?.stage || 1
          : 1;
      const loot = computeExpeditionLoot(exp, survivors, wave);
      if (loot.tp > 0) ctx.grantTp?.(loot.tp);
      if (loot.science > 0) ctx.grantScience?.(loot.science);

      const effStage = getEffectiveStage(exp.factionId, wave, baseStage);
      hooks.showMessage?.(
        `Expedition returns from ${exp.factionName} — ${survivors}/${exp.unitIds.length} survivors, +${loot.tp} TP, +${loot.science} SP. ${exp.factionName} set back to S${effStage}.`,
        400
      );
      hooks.floatingText?.(ctx.worldW / 2, 108, 'EXPEDITION HOME', '#80c0ff');
      if (loot.tp > 0) {
        hooks.floatingText?.(ctx.worldW / 2, 122, `+${loot.tp} TP`, '#e0c040');
      }

      if (typeof AsymmetricWarfare !== 'undefined') {
        AsymmetricWarfare.addThreatXp(-4 - exp.stagePenalty * 2, 'expedition_return');
      }

      resolved.push({ expedition: exp, debuff, survivors, loot });
    }

    activeExpeditions = remaining;
    return resolved;
  }

  function checkWaveAnnouncement(wave, hooks = {}) {
    if (counterAnnounced || wave !== COUNTER_WAVE_MIN) return null;
    counterAnnounced = true;
    hooks.addHighlight?.('era', 'Counter-Evolution');
    hooks.showMessage?.(
      'Wave 15 — Counter-Offensive unlocked! Use offensive doctrines and night expeditions to weaken host factions before they evolve.',
      420
    );
    hooks.floatingText?.(hooks.worldW / 2, 68, 'COUNTER-EVO', '#60a0ff');
    return { wave: COUNTER_WAVE_MIN };
  }

  function getStateSnapshot(wave, kingdomStage) {
    pruneDebuffs(wave);
    const targets = buildExpeditionTargets(wave);
    const debuffed = Object.keys(factionDebuffs).length;
    return {
      active: isUnlocked(wave),
      expeditionUnlocked: canExpedition(wave),
      waveMin: COUNTER_WAVE_MIN,
      expeditionWaveMin: EXPEDITION_WAVE_MIN,
      doctrines: getUnlockedCounterDoctrines(wave, kingdomStage).map((d) => d.id),
      targets,
      debuffedFactions: debuffed,
      activeExpeditions: activeExpeditions.map((e) => ({
        factionId: e.factionId,
        factionName: e.factionName,
        returnWave: e.returnWave,
        unitCount: e.unitIds.length,
      })),
      summary: debuffed
        ? `${debuffed} faction${debuffed > 1 ? 's' : ''} weakened`
        : targets.length
          ? `${targets.length} host factions — strike before they evolve`
          : null,
      totalExpeditions,
      totalDoctrines,
      minExpeditionForce: MIN_EXPEDITION_FORCE,
    };
  }

  return {
    COUNTER_WAVE_MIN,
    EXPEDITION_WAVE_MIN,
    MIN_EXPEDITION_FORCE,
    MAX_EXPEDITION_FORCE,
    COUNTER_DOCTRINES,
    resetRun,
    isUnlocked,
    canExpedition,
    isCounterDoctrineUnlocked,
    getUnlockedCounterDoctrines,
    getFactionModifiers,
    getEffectiveStage,
    buildExpeditionTargets,
    executeCounterDoctrine,
    dispatchExpedition,
    resolveExpeditions,
    computeExpeditionLoot,
    getExpeditionLootScale,
    checkWaveAnnouncement,
    getStateSnapshot,
    isExpeditionUnit,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.PlayerCounterEvolution = PlayerCounterEvolution;
