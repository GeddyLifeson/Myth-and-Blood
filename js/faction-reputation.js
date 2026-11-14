/**
 * Faction grudges. Every faction keeps one number, a grudge from 0 to 100, and it only
 * moves for reasons the player can see: killing that faction's soldiers raises it, a Truce
 * lowers it. Nothing else reads it; it does not scale spawns, health or evolution.
 *
 * A full grudge has one consequence: that faction leads the next ordinary wave as a revenge
 * wave under a named avenger (EnemyFactions.planWave). Kill the avenger and the faction
 * will not lead again for three waves.
 */
const FactionReputation = (() => {
  const WAVE_MIN = 6;
  const GRUDGE_MAX = 100;
  const BAR_WAVES = 3;

  const STANCES = [
    {
      max: 24,
      id: 'unbloodied',
      label: 'Unbloodied',
      color: '#80c8a0',
      desc: 'No score to settle.',
    },
    {
      max: 59,
      id: 'bloodied',
      label: 'Bloodied',
      color: '#e0a050',
      desc: 'They are counting their dead.',
    },
    {
      max: 99,
      id: 'vengeful',
      label: 'Vengeful',
      color: '#ff7050',
      desc: 'A few more kills and they come for revenge.',
    },
    {
      max: 100,
      id: 'blood_feud',
      label: 'Blood Feud',
      color: '#ff4040',
      desc: 'Their avenger leads the next ordinary wave.',
    },
  ];

  let grudge = {};
  let truceUntil = {};
  let barredUntil = {};
  /** The revenge wave now on the field: { factionId, wave, name, slain }. */
  let avenger = null;
  let announced = false;

  function resetRun() {
    grudge = {};
    truceUntil = {};
    barredUntil = {};
    avenger = null;
    announced = false;
  }

  function isActive(wave) {
    return (wave | 0) >= WAVE_MIN;
  }

  function getActiveFactionIds(wave) {
    if (typeof EnemyFactions === 'undefined') return [];
    return EnemyFactions.getActiveFactions(wave).map((f) => f.id);
  }

  function clamp(value) {
    return Math.max(0, Math.min(GRUDGE_MAX, Math.round(value * 10) / 10));
  }

  /** The grudge, 0 to 100. (Named for the callers that predate grudges.) */
  function getHostility(factionId) {
    return Math.round(grudge[factionId] || 0);
  }

  function getStance(factionId) {
    const h = getHostility(factionId);
    return STANCES.find((s) => h <= s.max) || STANCES[STANCES.length - 1];
  }

  function addHostility(factionId, amount, _wave = 0) {
    if (!factionId || !amount) return getHostility(factionId);
    grudge[factionId] = clamp((grudge[factionId] || 0) + amount);
    return getHostility(factionId);
  }

  function reduceHostility(factionId, amount, _wave = 0) {
    if (!factionId || !amount) return getHostility(factionId);
    grudge[factionId] = clamp((grudge[factionId] || 0) - amount);
    return getHostility(factionId);
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

  function killWeight(unit) {
    if (unit.isNamedBoss || unit.type?.startsWith('boss_')) return 15;
    if (unit.type === 'war_chief') return 5;
    if (unit.type === 'siege_tower' || unit.type === 'iron_colossus') return 3;
    if (typeof isEliteEnemy === 'function' && isEliteEnemy(unit)) return 2;
    return 1;
  }

  /** About one and a half led waves' worth of kills fills a grudge, at any wave. */
  function killGain(unit, wave) {
    const cfg = typeof getWaveConfig === 'function' ? getWaveConfig(Math.max(1, wave)) : null;
    const host = Math.max(8, (cfg && cfg.count) || 20);
    return (killWeight(unit) * 70) / host;
  }

  function factionName(fid) {
    const def = typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
    return def?.name || fid;
  }

  /** No hidden effects: every multiplier is 1. The grudge and its stance are for display. */
  function getFactionModifiers(factionId, wave) {
    const stance = getStance(factionId);
    return {
      hostility: getHostility(factionId),
      stance: stance.id,
      stanceLabel: stance.label,
      stanceColor: stance.color,
      evolutionWaveOffset: 0,
      effectiveWave: wave | 0,
      spawnMult: 1,
      eliteChanceMult: 1,
      buildingIntervalMult: 1,
      buildingCapDelta: 0,
      economicFocus: false,
      counterRaidMult: 1,
      truceActive: (truceUntil[factionId] || 0) > wave,
      revengeDue: getHostility(factionId) >= GRUDGE_MAX,
      barred: (barredUntil[factionId] || 0) > wave,
    };
  }

  function getEvolutionWaveOffset() {
    return 0;
  }

  function getEffectiveWaveForTier(_factionId, wave) {
    return Math.max(1, wave | 0);
  }

  function onEnemySlain(unit, wave, ctx = {}) {
    if (!isActive(wave)) return null;
    const fid = resolveFactionId(unit);
    if (!fid) return null;
    if (unit.isAvenger && avenger && !avenger.slain && avenger.factionId === fid) {
      return onAvengerSlain(wave, ctx);
    }
    const before = getHostility(fid);
    const h = addHostility(fid, killGain(unit, wave), wave);
    if (before < GRUDGE_MAX && h >= GRUDGE_MAX) {
      ctx.hooks?.showMessage?.(
        `${factionName(fid)} swear a blood feud — their avenger will lead a wave against you.`,
        320
      );
    }
    return { factionId: fid, hostility: h, gain: h - before };
  }

  function onEnemyStructureDestroyed(building, wave, ctx = {}) {
    if (!isActive(wave) || building?.owner !== 'enemy') return null;
    const fid = resolveFactionId(building);
    if (!fid) return null;
    const h = addHostility(fid, 20, wave);
    ctx.hooks?.showMessage?.(
      `${factionName(fid)} will remember the razing — grudge ${h}/100 (${getStance(fid).label}).`,
      280
    );
    return { factionId: fid, hostility: h, gain: 20 };
  }

  function onCounterOffensive(factionId, wave) {
    if (!isActive(wave) || !factionId) return null;
    return { factionId, hostility: addHostility(factionId, 12, wave) };
  }

  function onExpedition(factionId, wave) {
    if (!isActive(wave) || !factionId) return null;
    return { factionId, hostility: addHostility(factionId, 8, wave) };
  }

  function onSettlementRaid(factionId, wave) {
    if (!isActive(wave) || !factionId) return null;
    return { factionId, hostility: addHostility(factionId, 10, wave) };
  }

  function onSpyAggression(wave, ctx = {}) {
    if (!isActive(wave)) return;
    for (const fid of getActiveFactionIds(wave)) addHostility(fid, 4, wave);
    ctx.hooks?.showMessage?.('The host notes your spies — every grudge rises by 4.', 240);
  }

  /** A Truce halves the worst grudge and holds off any revenge wave for two waves. */
  function onTruce(wave, ctx = {}) {
    if (!isActive(wave)) return null;
    const active = getActiveFactionIds(wave);
    if (!active.length) return null;
    let primary = active[0];
    for (const fid of active) if (getHostility(fid) > getHostility(primary)) primary = fid;
    const before = getHostility(primary);
    grudge[primary] = clamp(before / 2);
    for (const fid of active) truceUntil[fid] = wave + 2;
    ctx.hooks?.showMessage?.(
      `Truce reaches ${factionName(primary)} — grudge ${before} → ${getHostility(primary)}. No revenge wave for two waves.`,
      360
    );
    ctx.hooks?.floatingText?.(ctx.worldW / 2, 88, 'TRUCE', '#80c8a0');
    return { primaryFaction: primary, hostility: getHostility(primary) };
  }

  /** Grudges do not fade on their own: only a Truce or a revenge wave clears one. */
  function onWaveEnd() {}

  function checkWaveAnnouncement(wave, ctx = {}) {
    if (!isActive(wave) || announced) return;
    announced = true;
    ctx.hooks?.showMessage?.(
      'Factions keep a grudge for every soldier you kill. Fill one and that faction sends a revenge wave under a named avenger.',
      420
    );
  }

  /** The faction owed a revenge wave at `wave`, if any (the fullest grudge wins). */
  function dueRevenge(wave) {
    if (!isActive(wave)) return null;
    let best = null;
    for (const fid of getActiveFactionIds(wave)) {
      if (getHostility(fid) < GRUDGE_MAX) continue;
      if ((truceUntil[fid] || 0) > wave || (barredUntil[fid] || 0) > wave) continue;
      if (!best || (grudge[fid] || 0) > (grudge[best] || 0)) best = fid;
    }
    return best;
  }

  /** Factions that will not lead at `wave` because their avenger was killed. */
  function getBarred(wave) {
    return Object.keys(barredUntil).filter((fid) => barredUntil[fid] > wave);
  }

  /** The revenge wave has come: the grudge is spent, win or lose. */
  function onRevengeWave(factionId, wave, revenge, ctx = {}) {
    if (!factionId) return;
    grudge[factionId] = 0;
    avenger = { factionId, wave, name: revenge?.name || 'The Avenger', slain: false };
    ctx.hooks?.showMessage?.(
      `REVENGE — ${factionName(factionId)} come for blood under ${avenger.name}. Kill the avenger and they will keep away for ${BAR_WAVES} waves.`,
      420
    );
  }

  function onAvengerSlain(wave, ctx = {}) {
    if (!avenger || avenger.slain) return null;
    avenger.slain = true;
    barredUntil[avenger.factionId] = wave + BAR_WAVES + 1;
    ctx.hooks?.showMessage?.(
      `${avenger.name} is dead. ${factionName(avenger.factionId)} will not lead a wave for ${BAR_WAVES} waves.`,
      380
    );
    ctx.hooks?.floatingText?.(ctx.worldW / 2, 88, 'GRUDGE SETTLED', '#80c8a0');
    return { factionId: avenger.factionId, settled: true };
  }

  function getAvenger() {
    return avenger ? { ...avenger } : null;
  }

  function formatSummary(wave) {
    return getActiveFactionIds(wave)
      .filter((fid) => getHostility(fid) > 0)
      .map((fid) => {
        const def = typeof EnemyFactions !== 'undefined' ? EnemyFactions.getFactionDef(fid) : null;
        return `${def?.shortName || fid} grudge ${getHostility(fid)}`;
      })
      .join(' · ');
  }

  function getStateSnapshot(wave) {
    const factions = getActiveFactionIds(wave).map((fid) => {
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
        evolutionOffset: 0,
        effectiveWave: wave | 0,
        economicFocus: false,
        truceActive: mods.truceActive,
        revengeDue: mods.revengeDue,
        barred: mods.barred,
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
      summary: formatSummary(wave),
      highestHostility: highest,
      avenger: getAvenger(),
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
    dueRevenge,
    getBarred,
    onRevengeWave,
    onAvengerSlain,
    getAvenger,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FactionReputation = FactionReputation;
