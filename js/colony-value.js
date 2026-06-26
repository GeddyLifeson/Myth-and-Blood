/**
 * RimWorld-style kingdom strength assessment — measures military, structures,
 * and economy to scale the next wave's size, composition, and minor stat pressure.
 * Wave hpScale/dmgScale from getWaveConfig() remain the primary enemy stat growth.
 */
const ColonyValue = (() => {
  let ctx = null;

  const THREAT_TIERS = [
    { min: 0, label: 'Humble', color: '#88cc88' },
    { min: 0.72, label: 'Rising', color: '#b8c848' },
    { min: 0.95, label: 'Formidable', color: '#e8a040' },
    { min: 1.3, label: 'Dominant', color: '#e86040' },
    { min: 1.7, label: 'Empire', color: '#ff4040' },
  ];

  function bind(api) {
    ctx = api;
  }

  function getThreatTier(ratio) {
    let tier = THREAT_TIERS[0];
    for (const t of THREAT_TIERS) {
      if (ratio >= t.min) tier = t;
    }
    return tier;
  }

  /** Expected kingdom value if the player kept pace with campaign escalation. */
  function getWaveBaseline(wave) {
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyProgress === 'function' ? postAcademyProgress(wave) : 0;
    const military = 28 + eased * 340 + post * 200;
    const structures = 45 + eased * 460 + post * 300 + Math.min(wave, 35) * 9;
    const economy = 35 + eased * 110 + post * 75;
    // Opening waves assume a bootstrapped kingdom (walls, academies, starter TP).
    const earlyPad = wave <= 12 ? 220 + wave * 28 : wave <= 30 ? 120 + (30 - wave) * 5 : 0;
    return Math.floor(military + structures + economy + earlyPad);
  }

  function unitMilitaryValue(u) {
    const def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(u.type) : null;
    let base = def?.cost || 3;
    if (u.isDoomslayer) base = Math.min(180, base * 0.018);
    const hpFactor = 0.55 + 0.45 * (u.hp / Math.max(1, u.maxHp));
    const starMult = 1
      + (u.vetGold || 0) * 0.42
      + (u.vetSilver || 0) * 0.24
      + (u.vetBronze || 0) * 0.1;
    const roleMult = u.type === 'general' ? 2.4
      : u.isCrossover ? 2.1
        : u.isWwe ? 1.9
          : u.type === 'knight' ? 1.35
            : 1;
    const dmgBase = Math.max(1, def?.damage || u.damage || 10);
    const dmgFactor = 0.88 + 0.12 * Math.min(2.2, (u.damage || dmgBase) / dmgBase);
    const moraleFactor = 0.92 + Math.min(0.12, ((u.morale || 10) / Math.max(1, u.maxMorale || 20)) * 0.12);
    return base * hpFactor * starMult * roleMult * dmgFactor * moraleFactor;
  }

  function buildingWealthValue(b) {
    const def = typeof BuildDefs !== 'undefined' ? BuildDefs[b.type] : null;
    let cost = def?.cost || 0;
    if (!cost) cost = Math.floor((def?.hp || b.maxHp || 200) / 18);
    const hpRatio = b.hp / Math.max(1, b.maxHp || def?.hp || 1);
    let mult = 1;
    if (b.isHamlet) mult = 1.85;
    else if (b.isMerchantGuild) mult = 2.05;
    else if (b.isAcademy) mult = 1.45;
    else if (b.isCrossoverBarracks) mult = 1.55;
    else if (b.isWweAcademy) mult = 1.65;
    else if (b.type === 'wall') mult = 0.82;
    else if (b.type === 'castle' || b.type === 'keep') mult = 1.25;
    return cost * hpRatio * mult;
  }

  function computeKingdomStrength(overrides = {}) {
    if (!ctx) {
      return {
        total: 0, baseline: 100, threatRatio: 1, tier: THREAT_TIERS[0],
        breakdown: { military: 0, structures: 0, economy: 0 },
        signals: {},
      };
    }

    const units = overrides.units ?? ctx.units ?? [];
    const buildings = overrides.buildings ?? ctx.buildings ?? [];
    const tactical = overrides.tactical ?? ctx.tactical ?? 0;
    const wave = overrides.wave ?? ctx.wave ?? 0;

    let military = 0;
    const signals = {
      militaryUnits: 0,
      wallCount: 0,
      academyCount: 0,
      hamletCount: 0,
      guildCount: 0,
      crossoverCount: 0,
      crossoverFactions: {},
      wweCount: 0,
      wallGarrison: 0,
      liquidTp: tactical,
      castleValue: 0,
      builderCount: 0,
    };

    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      signals.militaryUnits++;
      military += unitMilitaryValue(u);
      if (u.isCrossover) {
        signals.crossoverCount++;
        const cf = typeof getCrossoverDef === 'function' ? getCrossoverDef(u.type)?.faction : null;
        if (cf) signals.crossoverFactions[cf] = (signals.crossoverFactions[cf] || 0) + 1;
      }
      if (u.isWwe) signals.wweCount++;
      if (u.wallGarrisoned || u.garrisoned) signals.wallGarrison++;
      if (u.type === 'builder') signals.builderCount++;
    }

    let structures = 0;
    for (const b of buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      const v = buildingWealthValue(b);
      structures += v;
      if (b.type === 'wall') signals.wallCount++;
      if (b.isAcademy) signals.academyCount++;
      if (b.isHamlet) signals.hamletCount++;
      if (b.isMerchantGuild) signals.guildCount++;
      if (b.type === 'castle' || b.type === 'keep') signals.castleValue += v;
    }

    if (ctx.countPlayerWalls) signals.wallCount = Math.max(signals.wallCount, ctx.countPlayerWalls());
    if (ctx.countPlayerHamlets) signals.hamletCount = Math.max(signals.hamletCount, ctx.countPlayerHamlets());
    if (ctx.countPlayerGuilds) signals.guildCount = Math.max(signals.guildCount, ctx.countPlayerGuilds());

    const settlementTp = ctx.getSettlementTpBonus?.() || 0;
    const tpPerRound = ctx.getTpPerRound?.() || 8;
    const economy = tactical * 0.38 + settlementTp * 9.5 + tpPerRound * 3.8;

    const total = Math.floor(military + structures + economy);
    const baseline = getWaveBaseline(wave);
    const threatRatio = Math.max(0.5, Math.min(2.25, total / Math.max(50, baseline)));

    return {
      total,
      baseline,
      threatRatio,
      tier: getThreatTier(threatRatio),
      breakdown: {
        military: Math.floor(military),
        structures: Math.floor(structures),
        economy: Math.floor(economy),
      },
      signals,
    };
  }

  function compute() {
    return computeKingdomStrength();
  }

  /**
   * Convert kingdom strength into wave pressure. Stat multipliers stay modest because
   * getWaveConfig().hpScale/dmgScale already escalates enemies with wave number.
   */
  function deriveWavePressure(colony, wave) {
    const ratio = colony?.threatRatio || 1;
    const countCurve = wave < 10 ? 0.38 : wave < 25 ? 0.48 : 0.55;
    const countMult = Math.max(0.7, Math.min(1.55, Math.pow(ratio, countCurve)));
    const statPressure = 1 + (ratio - 1) * 0.08;
    const hpMult = Math.max(0.9, Math.min(1.14, statPressure));
    const dmgMult = Math.max(0.9, Math.min(1.12, statPressure));

    const tpSignal = colony?.signals?.liquidTp || 0;
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const tpBaseline = 24 + eased * 140;
    const intervalMult = Math.max(0.8, Math.min(1.12, 1 - (tpSignal / Math.max(40, tpBaseline)) * 0.1));

    const poolExtras = [];
    const weights = {};
    const signals = colony?.signals || {};
    const breakdown = colony?.breakdown || {};

    if (signals.wallCount >= 8) {
      poolExtras.push('siege_tower', 'siege_tower', 'goblin_sapper', 'goblin_engineer');
      weights.siege_tower = 3;
      weights.goblin_sapper = 2.2;
      weights.goblin_engineer = 1.8;
    } else if (signals.wallCount >= 4) {
      poolExtras.push('siege_tower', 'goblin_sapper');
      weights.siege_tower = 2;
      weights.goblin_sapper = 1.7;
    } else if (signals.wallCount >= 2) {
      poolExtras.push('goblin_sapper');
      weights.goblin_sapper = 1.4;
    }

    if (breakdown.military >= (colony?.baseline || 100) * 0.42) {
      poolExtras.push('berserker', 'dark_knight', 'war_chief', 'assassin');
      weights.berserker = 1.9;
      weights.dark_knight = 1.7;
      weights.war_chief = 1.5;
      weights.assassin = 1.4;
    }

    if (signals.academyCount >= 4) {
      poolExtras.push('necromancer', 'shaman', 'dark_mage');
      weights.necromancer = 1.6;
      weights.shaman = 1.3;
    } else if (signals.academyCount >= 2) {
      poolExtras.push('dark_mage', 'shaman');
      weights.dark_mage = 1.35;
    }

    const activeCrossoverFactions = new Set(Object.keys(signals.crossoverFactions || {}));
    if (signals.wweCount > 0) activeCrossoverFactions.add('wwe');
    if (activeCrossoverFactions.size > 0 && typeof FactionDepth !== 'undefined') {
      for (const [enemyType, counter] of Object.entries(FactionDepth.ENEMY_COUNTERS || {})) {
        const hits = (counter.weakFactions || []).filter(f => activeCrossoverFactions.has(f));
        if (!hits.length) continue;
        poolExtras.push(enemyType);
        weights[enemyType] = Math.max(weights[enemyType] || 1, 1.2 + hits.length * 0.15);
      }
    }
    if (signals.crossoverCount + signals.wweCount >= 2) {
      poolExtras.push('troll', 'berserker', 'assassin');
      weights.troll = Math.max(weights.troll || 0, 1.75);
      if (wave >= 20) poolExtras.push('abomination');
      if (wave >= 35) poolExtras.push('void_stalker');
    }

    if (signals.hamletCount + signals.guildCount >= 2) {
      poolExtras.push('goblin_engineer', 'orc', 'orc');
      weights.goblin_engineer = 1.55;
    }

    if (signals.wallGarrison >= 4) {
      poolExtras.push('siege_tower', 'goblin_sapper', 'warg_rider');
      weights.warg_rider = 1.35;
    }

    let eliteSlots = 0;
    if (ratio >= 1.65) eliteSlots = 3;
    else if (ratio >= 1.35) eliteSlots = 2;
    else if (ratio >= 1.08) eliteSlots = 1;

    return {
      countMult,
      hpMult,
      dmgMult,
      intervalMult,
      poolExtras,
      weights,
      eliteSlots,
      ratio,
      tier: colony?.tier || THREAT_TIERS[0],
    };
  }

  function mergePool(pool, pressure) {
    const seen = new Set(pool);
    const merged = [...pool];
    for (const t of pressure.poolExtras || []) {
      if (typeof EnemyDefs !== 'undefined' && !EnemyDefs[t]) continue;
      merged.push(t);
      seen.add(t);
    }
    return merged;
  }

  function mergeWeights(baseWeights, pressureWeights) {
    const out = { ...(baseWeights || {}) };
    for (const [t, w] of Object.entries(pressureWeights || {})) {
      out[t] = Math.max(out[t] || 1, w);
    }
    return out;
  }

  function injectElites(spawnQueue, pool, pressure, rng) {
    const eliteTypes = [
      'dark_knight', 'war_chief', 'troll', 'berserker', 'assassin', 'necromancer',
      'abomination', 'behemoth', 'void_stalker',
    ];
    const slots = pressure?.eliteSlots || 0;
    if (!slots || !spawnQueue.length) return;
    const avail = eliteTypes.filter(t => pool.includes(t));
    if (!avail.length) return;
    for (let i = 0; i < slots; i++) {
      const idx = Math.floor(rng() * spawnQueue.length);
      spawnQueue[idx] = avail[Math.floor(rng() * avail.length)];
    }
  }

  function formatKingdomSummary(colony) {
    if (!colony) return 'Kingdom strength unknown';
    const b = colony.breakdown;
    return `Kingdom ${colony.total} (${colony.tier.label} · ${colony.threatRatio.toFixed(2)}×) — `
      + `Army ${b.military} · Works ${b.structures} · Treasury ${b.economy}`;
  }

  function formatWaveNote(colony, pressure) {
    if (!colony || !pressure) return '';
    const pct = Math.round((pressure.countMult - 1) * 100);
    const sizeNote = pct > 4 ? `+${pct}% host` : pct < -4 ? `${pct}% host` : 'matched host';
    return `Kingdom ${colony.total} (${colony.tier.label} ${colony.threatRatio.toFixed(2)}×, ${sizeNote})`;
  }

  function formatNightPreview(colony, nextWave, pressure) {
    const baseline = getWaveBaseline(nextWave);
    const sizePct = Math.round((pressure.countMult - 1) * 100);
    const sizeWord = sizePct > 6 ? 'larger' : sizePct < -6 ? 'lighter' : 'standard';
    return `Kingdom value ${colony.total} vs wave ${nextWave} baseline ${baseline} — `
      + `${colony.tier.label} threat (${colony.threatRatio.toFixed(2)}×) expects a ${sizeWord} assault.`;
  }

  return {
    bind,
    compute,
    computeKingdomStrength,
    getWaveBaseline,
    getThreatTier,
    deriveWavePressure,
    mergePool,
    mergeWeights,
    injectElites,
    formatKingdomSummary,
    formatWaveNote,
    formatNightPreview,
    THREAT_TIERS,
  };
})();