/**
 * Asymmetric Large-Scale Warfare — Evolve-style opposing playstyles:
 *   Player = Kingdom builder + field commander (macro economy + micro orders)
 *   Host    = Evolving map threat that levels up and pressures the whole realm
 */
const AsymmetricWarfare = (() => {
  const PLAYER_ROLE = {
    id: 'kingdom_commander',
    name: 'Kingdom Commander',
    macro: 'Build settlements, academies, research, and TP economy during night.',
    micro: 'Hunt, rally, garrison, doctrines, courier/spy — direct your army.',
  };

  const HOST_ROLE = {
    id: 'evolving_threat',
    name: 'Evolving Host',
    macro: 'Faction kingdoms, northern structures, and planet territory creep.',
    micro: 'Auto-spawn hordes, counter-raids, sub-bosses — no builder phase.',
  };

  const HOST_LEVEL_THRESHOLDS = [
    { level: 1, label: 'Grunt Host', tagline: 'Filler swarms — the host probes your line.' },
    {
      level: 5,
      label: 'Elite Host',
      tagline: 'Veterans and sub-bosses — the host learns to break you.',
    },
    { level: 10, label: 'Fortified Host', tagline: 'Northern forts rise — economy war begins.' },
    {
      level: 15,
      label: 'Kingdom Host',
      tagline: 'Settlements and counter-raids — the map is contested.',
    },
    {
      level: 20,
      label: 'Planetary Threat',
      tagline: 'Full map pressure — spawns creep from every flank.',
    },
    {
      level: 25,
      label: 'Dominion Nemesis',
      tagline: 'The host threatens your entire realm — push back or drown.',
    },
  ];

  const COMMANDER_TIERS = [
    { min: 0, label: 'Outpost Commander', short: 'OUTPOST', color: '#88aa88' },
    { min: 32, label: 'Kingdom Commander', short: 'KINGDOM', color: '#c0a040' },
    { min: 58, label: 'Empire Commander', short: 'EMPIRE', color: '#e08040' },
    { min: 82, label: 'Dominion Commander', short: 'DOMINION', color: '#ff6060' },
  ];

  const XP_PER_LEVEL = 22;
  let hostThreatXp = 0;
  let announcedHostLevels = new Set();
  let lastWavePushback = 0;

  function resetRun() {
    hostThreatXp = 0;
    announcedHostLevels = new Set();
    lastWavePushback = 0;
  }

  function getHostThreatLevel(xp = hostThreatXp) {
    return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
  }

  function getHostLevelDef(level = getHostThreatLevel()) {
    let def = HOST_LEVEL_THRESHOLDS[0];
    for (const t of HOST_LEVEL_THRESHOLDS) {
      if (level >= t.level) def = t;
    }
    return { ...def, level };
  }

  function getCommanderTier(authority) {
    let tier = COMMANDER_TIERS[0];
    for (const t of COMMANDER_TIERS) {
      if (authority >= t.min) tier = t;
    }
    return tier;
  }

  function computeCommanderAuthority(ctx = {}) {
    const {
      wave = 1,
      kingdomStage = 1,
      evolutionFill = 0,
      hamletCount = 0,
      guildCount = 0,
      academyCount = 0,
      researchCompleted = 0,
      liveBuilders = 0,
      generalStationed = false,
      generalAuraStrength = 0,
      settlementTp = 0,
      colonyValue = 0,
      globalHunt = true,
      unitProducers = 0,
    } = ctx;

    let score = 8 + kingdomStage * 14;
    score += Math.round((evolutionFill || 0) * 28);
    score += hamletCount * 7 + guildCount * 5 + academyCount * 6;
    score += Math.min(14, researchCompleted * 1.4);
    score += liveBuilders * 3.5;
    score += Math.min(10, settlementTp * 1.8);
    score += generalStationed ? 16 : generalAuraStrength > 0 ? 9 : 0;
    score += Math.min(12, Math.floor((colonyValue || 0) / 80));
    score += globalHunt ? 5 : 0;
    score += Math.min(8, unitProducers * 2);
    const academyBlend =
      typeof academyThresholdBlend === 'function' ? academyThresholdBlend(wave) : wave >= 100 ? 1 : 0;
    const rtsBlend = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : wave >= 200 ? 1 : 0;
    score += academyBlend * 6 + rtsBlend * 8;
    return Math.round(score);
  }

  function computeThreatXpGain(wave, ctx = {}) {
    const {
      activeFactionStages = 0,
      hostKingdomTotal = 0,
      enemySiteCount = 0,
      planetControl = 0,
      waveSince200 = 0,
    } = ctx;
    let gain = 3 + wave * 0.06;
    gain += activeFactionStages * 1.8;
    gain += Math.min(12, hostKingdomTotal / 120);
    gain += enemySiteCount * 2.2;
    gain += planetControl * 14;
    const rtsBlend = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : wave >= 200 ? 1 : 0;
    gain += rtsBlend * (4 + waveSince200 * 0.15);
    return gain;
  }

  function addThreatXp(amount, reason) {
    const prevLevel = getHostThreatLevel();
    hostThreatXp = Math.max(0, hostThreatXp + amount);
    const nextLevel = getHostThreatLevel();
    return { prevLevel, nextLevel, delta: nextLevel - prevLevel, reason, xp: hostThreatXp };
  }

  function onWaveStart(wave, ctx = {}) {
    const gain = computeThreatXpGain(wave, ctx);
    const push = Math.max(0, lastWavePushback);
    lastWavePushback = 0;
    return addThreatXp(gain - push * 0.6, 'wave_start');
  }

  function onWaveEnd(wave, ctx = {}) {
    let push = 0;
    if (ctx.enemySitesCleared) push += 14;
    push += Math.min(10, (ctx.northernKills || 0) * 0.35);
    push += Math.min(8, (ctx.structuresRazed || 0) * 4);
    if (ctx.planetControlDelta < -0.02) push += 6;
    lastWavePushback = push;
    if (push > 4) {
      return addThreatXp(-push * 0.45, 'wave_pushback');
    }
    return null;
  }

  function onHostStructureDestroyed() {
    return addThreatXp(-5, 'structure_raze');
  }

  function getAsymmetricMods(authority, threatLevel = getHostThreatLevel()) {
    const authNorm = Math.max(12, authority) / 20;
    const threatNorm = threatLevel / 8;
    const ratio = threatNorm / authNorm;

    return {
      ratio,
      enemyCountMult: Math.max(0.9, Math.min(1.38, 0.94 + ratio * 0.14)),
      enemyIntervalMult: Math.max(0.72, Math.min(1.08, 1.04 - ratio * 0.08)),
      planetCreepMult: Math.max(1, Math.min(1.45, 1 + (ratio - 1) * 0.18)),
      eliteSlotBonus: Math.max(0, Math.floor((threatLevel - 4) / 5)),
      multiFlankBias: threatLevel >= 8 ? Math.min(0.55, 0.12 + (threatLevel - 8) * 0.025) : 0,
      commanderNightPrepMult:
        authority >= 82 ? 1.1 : authority >= 58 ? 1.06 : authority >= 32 ? 1.03 : 1,
      commanderBuilderMult:
        authority >= 82 ? 1.12 : authority >= 58 ? 1.08 : authority >= 32 ? 1.04 : 1,
      commanderTpRoundBonus: authority >= 82 ? 2 : authority >= 58 ? 1 : 0,
    };
  }

  function formatPlayerMicro(ctx = {}) {
    const parts = [];
    if (ctx.globalHunt) parts.push('HUNT');
    if (ctx.rallyActive) parts.push('RALLY');
    if (!ctx.doctrineUsedThisWave && (ctx.unlockedDoctrineCount || 0) > 0) parts.push('DOC');
    if (ctx.spyNetwork && !ctx.spyUsedThisWave && ctx.wave >= 200) parts.push('SPY');
    if (ctx.hasCourier && !ctx.courierUsedThisWave) parts.push('MSG');
    return parts.length ? parts.join('·') : 'HOLD';
  }

  function formatPlayerMacro(authority, tier) {
    return `${tier?.short || 'CMD'} ${authority}`;
  }

  function formatHostSummary(threatLevel, factionSummary) {
    const def = getHostLevelDef(threatLevel);
    const factions = factionSummary ? ` · ${factionSummary}` : '';
    return `Lv${threatLevel}${factions}`;
  }

  function checkHostLevelAnnouncements(wave, hooks = {}) {
    const { showMessage, addHighlight, floatingText, worldW, worldH } = hooks;
    const level = getHostThreatLevel();
    let newest = null;
    for (const t of HOST_LEVEL_THRESHOLDS) {
      const key = `host:${t.level}`;
      if (announcedHostLevels.has(key) || level < t.level) continue;
      announcedHostLevels.add(key);
      newest = t;
    }
    if (!newest) return null;
    addHighlight?.('host', `${HOST_ROLE.name} — ${newest.label}`);
    showMessage?.(
      `Host levels up — Threat Level ${level}: ${newest.label}. ${newest.tagline}`,
      400
    );
    floatingText?.(worldW / 2, 88, `HOST LEVEL ${level}`, '#ff5050');
    return newest;
  }

  function getStateSnapshot(ctx = {}) {
    const authority = computeCommanderAuthority(ctx);
    const threatLevel = getHostThreatLevel();
    const commanderTier = getCommanderTier(authority);
    const hostDef = getHostLevelDef(threatLevel);
    const mods = getAsymmetricMods(authority, threatLevel);
    const playerMicro = formatPlayerMicro(ctx);
    const playerMacro = formatPlayerMacro(authority, commanderTier);

    let balance = 'contested';
    if (mods.ratio >= 1.25) balance = 'host_advantage';
    else if (mods.ratio <= 0.82) balance = 'player_advantage';

    return {
      playerRole: PLAYER_ROLE,
      hostRole: HOST_ROLE,
      commanderAuthority: authority,
      commanderTier: commanderTier.label,
      commanderTierShort: commanderTier.short,
      commanderTierColor: commanderTier.color,
      playerMacro,
      playerMicro,
      hostThreatLevel: threatLevel,
      hostThreatXp,
      hostLevelLabel: hostDef.label,
      hostLevelTagline: hostDef.tagline,
      hostSummary: formatHostSummary(threatLevel, ctx.factionSummary),
      asymmetricRatio: mods.ratio,
      balance,
      mods,
      playerBarPct: Math.min(100, Math.round((authority / 110) * 100)),
      hostBarPct: Math.min(100, Math.round((threatLevel / 28) * 100)),
    };
  }

  return {
    PLAYER_ROLE,
    HOST_ROLE,
    HOST_LEVEL_THRESHOLDS,
    resetRun,
    getHostThreatLevel,
    getHostLevelDef,
    getCommanderTier,
    computeCommanderAuthority,
    addThreatXp,
    onWaveStart,
    onWaveEnd,
    onHostStructureDestroyed,
    getAsymmetricMods,
    formatPlayerMicro,
    formatPlayerMacro,
    formatHostSummary,
    checkHostLevelAnnouncements,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.AsymmetricWarfare = AsymmetricWarfare;
