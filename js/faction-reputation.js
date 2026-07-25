/**
 * Faction Reputation / Hostility — light memory per hostile realm.
 * Aggressive play raises hostility (earlier evolution, harder spawns).
 * Truces and restraint lower it (economic northern pressure instead).
 */
const FactionReputation = (() => {
  const WAVE_MIN = 6;
  const DEFAULT_HOSTILITY = 22;
  const HOSTILITY_MAX = 100;
  const HOSTILITY_MIN = 0;

  const STANCES = [
    {
      max: 18,
      id: 'cordial',
      label: 'Cordial',
      color: '#80c8a0',
      desc: 'Economic probes — trade posts multiply in the north.',
    },
    { max: 34, id: 'wary', label: 'Wary', color: '#a0b0c0', desc: 'Standard evolution pace.' },
    {
      max: 52,
      id: 'hostile',
      label: 'Hostile',
      color: '#e0a050',
      desc: 'Heavier spawns and faster military evolution.',
    },
    {
      max: 72,
      id: 'vengeful',
      label: 'Vengeful',
      color: '#ff7050',
      desc: 'Elites arrive early — counter-raids more likely.',
    },
    {
      max: 100,
      id: 'blood_feud',
      label: 'Blood Feud',
      color: '#ff4040',
      desc: 'Full evolution rush — maximum host pressure.',
    },
  ];

  let hostility = {};
  let engagedThisWave = {};
  let truceUntil = {};
  let announced = false;

  function resetRun() {
    hostility = {};
    engagedThisWave = {};
    truceUntil = {};
    announced = false;
  }

  function isActive(wave) {
    return (wave | 0) >= WAVE_MIN;
  }

  function getActiveFactionIds(wave) {
    if (typeof EnemyFactions === 'undefined') return [];
    return EnemyFactions.getActiveFactions(wave).map((f) => f.id);
  }

  function ensureFaction(factionId, wave = 0) {
    if (!factionId) return;
    if (hostility[factionId] == null) {
      hostility[factionId] = DEFAULT_HOSTILITY;
    }
    if (wave >= WAVE_MIN && !announced && Object.keys(hostility).length >= 1) {
      announced = true;
    }
  }

  function clampHostility(value) {
    return Math.max(HOSTILITY_MIN, Math.min(HOSTILITY_MAX, Math.round(value)));
  }

  function getHostility(factionId) {
    if (!factionId) return DEFAULT_HOSTILITY;
    return hostility[factionId] ?? DEFAULT_HOSTILITY;
  }

  function getStance(factionId) {
    const h = getHostility(factionId);
    return STANCES.find((s) => h <= s.max) || STANCES[STANCES.length - 1];
  }

  function addHostility(factionId, amount, wave = 0) {
    if (!factionId || !amount) return getHostility(factionId);
    ensureFaction(factionId, wave);
    if (truceUntil[factionId] > wave) amount *= 0.35;
    hostility[factionId] = clampHostility(getHostility(factionId) + amount);
    engagedThisWave[factionId] = true;
    return hostility[factionId];
  }

  function reduceHostility(factionId, amount, wave = 0) {
    if (!factionId || !amount) return getHostility(factionId);
    ensureFaction(factionId, wave);
    hostility[factionId] = clampHostility(getHostility(factionId) - amount);
    return hostility[factionId];
  }

  function resolveFactionId(entity) {
    if (!entity) return null;
    if (entity.enemyFaction) return entity.enemyFaction;
    if (entity.type && typeof EnemyFactions !== 'undefined') {
      return (
        EnemyFactions.getUnitFaction(entity.type) || EnemyFactions.getBuildingFaction(entity.type)
      );
    }
    return null;
  }

  function killHostilityGain(unit) {
    if (unit.isNamedBoss || unit.type?.startsWith('boss_')) return 14;
    if (unit.type === 'war_chief' || unit.isNamedBoss) return 8;
    if (unit.type === 'siege_tower' || unit.type === 'iron_colossus') return 5;
    if (typeof isEliteEnemy === 'function' && isEliteEnemy(unit)) return 4;
    return 2;
  }

  function structureHostilityGain(building) {
    const type = building?.type || '';
    if (type === 'enemy_hamlet' || type === 'enemy_merchant_guild') return 16;
    if (type === 'enemy_shadow_academy' || type === 'enemy_war_academy') return 18;
    if (type === 'enemy_quarry') return 11;
    if (type === 'enemy_trade_outpost') return 8;
    return 6;
  }

  function getEvolutionWaveOffset(factionId) {
    const h = getHostility(factionId);
    if (h >= 55) return Math.min(14, Math.floor((h - 50) / 3) + 2);
    if (h >= 38) return Math.floor((h - 38) / 4);
    if (h <= 16) return -Math.min(10, Math.floor((20 - h) / 2));
    return 0;
  }

  function getEffectiveWaveForTier(factionId, wave) {
    return Math.max(1, (wave | 0) + getEvolutionWaveOffset(factionId));
  }

  function getFactionModifiers(factionId, wave) {
    const h = getHostility(factionId);
    const stance = getStance(factionId);
    let spawnMult = 1;
    let eliteChanceMult = 1;
    let buildingIntervalMult = 1;
    let buildingCapDelta = 0;
    let economicFocus = false;
    let counterRaidMult = 1;

    if (h >= 42) {
      spawnMult = 1 + (h - 42) * 0.006;
      eliteChanceMult = 1 + (h - 42) * 0.008;
      buildingCapDelta = h >= 60 ? -1 : 0;
      buildingIntervalMult = 1.12;
    } else if (h <= 20) {
      spawnMult = 1 - (20 - h) * 0.005;
      buildingIntervalMult = 0.72;
      buildingCapDelta = h <= 14 ? 1 : 0;
      economicFocus = h <= 18;
      counterRaidMult = h <= 12 ? 0.45 : 0.7;
    }

    if (truceUntil[factionId] > wave) {
      spawnMult *= 0.88;
      counterRaidMult *= 0.5;
    }

    return {
      hostility: h,
      stance: stance.id,
      stanceLabel: stance.label,
      stanceColor: stance.color,
      evolutionWaveOffset: getEvolutionWaveOffset(factionId),
      effectiveWave: getEffectiveWaveForTier(factionId, wave),
      spawnMult,
      eliteChanceMult,
      buildingIntervalMult,
      buildingCapDelta,
      economicFocus,
      counterRaidMult,
      truceActive: (truceUntil[factionId] || 0) > wave,
    };
  }

  function onEnemySlain(unit, wave, ctx = {}) {
    if (!isActive(wave)) return null;
    const fid = resolveFactionId(unit);
    if (!fid) return null;
    const gain = killHostilityGain(unit);
    const h = addHostility(fid, gain, wave);
    if (gain >= 8 && ctx.hooks?.showMessage) {
      const def = typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
      ctx.hooks.showMessage(
        `${def?.shortName || fid} hostility rises — ${getStance(fid).label} (${h}).`,
        220
      );
    }
    return { factionId: fid, hostility: h, gain };
  }

  function onEnemyStructureDestroyed(building, wave, ctx = {}) {
    if (!isActive(wave) || building?.owner !== 'enemy') return null;
    const fid = resolveFactionId(building);
    if (!fid) return null;
    const gain = structureHostilityGain(building);
    const h = addHostility(fid, gain, wave);
    const def = typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
    ctx.hooks?.showMessage?.(
      `${def?.shortName || fid} remembers the razing — hostility ${h} (${getStance(fid).label}).`,
      280
    );
    return { factionId: fid, hostility: h, gain };
  }

  function onCounterOffensive(factionId, wave, ctx = {}) {
    if (!isActive(wave) || !factionId) return null;
    const h = addHostility(factionId, 12, wave);
    const def =
      typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(factionId) : null;
    ctx.hooks?.showMessage?.(
      `${def?.shortName || factionId} marks your counter-offensive — hostility ${h}.`,
      260
    );
    return { factionId, hostility: h };
  }

  function onExpedition(factionId, wave, ctx = {}) {
    if (!isActive(wave) || !factionId) return null;
    const h = addHostility(factionId, 8, wave);
    return { factionId, hostility: h };
  }

  function onSettlementRaid(factionId, wave, ctx = {}) {
    if (!isActive(wave) || !factionId) return null;
    const h = addHostility(factionId, 10, wave);
    return { factionId, hostility: h };
  }

  function onSpyAggression(wave, ctx = {}) {
    if (!isActive(wave)) return;
    for (const fid of getActiveFactionIds(wave)) {
      addHostility(fid, 4, wave);
    }
    ctx.hooks?.showMessage?.('Host factions note your spy aggression — hostility ticks up.', 240);
  }

  function onTruce(wave, ctx = {}) {
    if (!isActive(wave)) return null;
    const active = getActiveFactionIds(wave);
    if (!active.length) return null;

    let primary = active[0];
    let peak = -1;
    for (const fid of active) {
      const h = getHostility(fid);
      if (h > peak) {
        peak = h;
        primary = fid;
      }
    }

    reduceHostility(primary, 18, wave);
    truceUntil[primary] = wave + 2;
    for (const fid of active) {
      if (fid === primary) continue;
      reduceHostility(fid, 8, wave);
      truceUntil[fid] = wave + 1;
    }

    const def = typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(primary) : null;
    const stance = getStance(primary);
    ctx.hooks?.showMessage?.(
      `Truce courier reaches ${def?.shortName || primary} — hostility −18 (${stance.label}, ${getHostility(primary)}). Other realms ease slightly.`,
      360
    );
    ctx.hooks?.floatingText?.(ctx.worldW / 2, 88, 'TRUCE', '#80c8a0');
    return { primaryFaction: primary, hostility: getHostility(primary) };
  }

  function onWaveEnd(wave, ctx = {}) {
    if (!isActive(wave)) return;
    const active = getActiveFactionIds(wave);
    const notes = [];
    for (const fid of active) {
      ensureFaction(fid, wave);
      if (!engagedThisWave[fid]) {
        const before = getHostility(fid);
        reduceHostility(fid, 2, wave);
        if (before > 20 && getHostility(fid) < before) {
          const def =
            typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
          notes.push(`${def?.shortName || fid} −2`);
        }
      }
    }
    engagedThisWave = {};
    if (notes.length && wave >= 10 && ctx.hooks?.showMessage && Math.random() < 0.35) {
      ctx.hooks.showMessage(`Quiet wave — ${notes.slice(0, 2).join(', ')} hostility eases.`, 220);
    }
  }

  function checkWaveAnnouncement(wave, ctx = {}) {
    if (!isActive(wave) || announced) return;
    if (wave !== WAVE_MIN) return;
    announced = true;
    ctx.hooks?.showMessage?.(
      'Faction reputation active — realms remember how hard you fight them. Truces and restraint shift threats toward economy vs evolution.',
      420
    );
  }

  function formatHostilitySummary(wave) {
    const active = getActiveFactionIds(wave);
    if (!active.length) return '';
    return active
      .map((fid) => {
        const def = typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
        const stance = getStance(fid);
        return `${def?.shortName || fid} ${stance.label[0]}${getHostility(fid)}`;
      })
      .join(' · ');
  }

  function getStateSnapshot(wave) {
    const active = getActiveFactionIds(wave);
    const factions = active.map((fid) => {
      const def = typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
      const mods = getFactionModifiers(fid, wave);
      const stance = getStance(fid);
      return {
        factionId: fid,
        name: def?.shortName || fid,
        color: def?.color || '#c08060',
        hostility: mods.hostility,
        stance: stance.id,
        stanceLabel: stance.label,
        stanceColor: stance.color,
        evolutionOffset: mods.evolutionWaveOffset,
        effectiveWave: mods.effectiveWave,
        economicFocus: mods.economicFocus,
        truceActive: mods.truceActive,
        desc: stance.desc,
      };
    });
    const highest = factions.reduce(
      (best, f) => (!best || f.hostility > best.hostility ? f : best),
      null
    );
    return {
      active: isActive(wave),
      waveMin: WAVE_MIN,
      summary: formatHostilitySummary(wave),
      highestHostility: highest,
      factions,
    };
  }

  return {
    WAVE_MIN,
    STANCES,
    resetRun,
    isActive,
    getHostility,
    getStance,
    addHostility,
    reduceHostility,
    getEvolutionWaveOffset,
    getEffectiveWaveForTier,
    getFactionModifiers,
    onEnemySlain,
    onEnemyStructureDestroyed,
    onCounterOffensive,
    onExpedition,
    onSettlementRaid,
    onSpyAggression,
    onTruce,
    onWaveEnd,
    checkWaveAnnouncement,
    getStateSnapshot,
    formatHostilitySummary,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FactionReputation = FactionReputation;
