/**
 * RimWorld-style kingdom strength assessment — measures military, structures,
 * and economy to scale the next wave's size, composition, and minor stat pressure.
 * Wave hpScale/dmgScale from getWaveConfig() remain the primary enemy stat growth.
 */
/**
 * Kingdom strength scoring and adaptive wave pressure.
 * @class ColonyValueSystem
 * @see ColonyValue — singleton used by Game/UI
 *
 * API:
 * - bind(ctx) — wire live game state + svc/service locator
 * - compute() / computeKingdomStrength(overrides?) — score army + works + treasury
 * - deriveWavePressure(colony, wave) — host size/stats/composition modifiers
 * - mergePool / mergeWeights / injectElites — spawn-queue integration
 * - computeEvolutionMeter(overrides?) — banner growth meter
 * - formatThreatTooltip / formatNightPreview / formatWaveNote — HUD copy
 * - getEncyclopediaEntries() — codex entries
 * - THREAT_TIERS — ratio thresholds (Humble → Empire)
 */
class ColonyValueSystem {
  static THREAT_TIERS = [
    {
      min: 0,
      label: 'Humble',
      short: 'I',
      color: '#88cc88',
      desc: 'Underbuilt for this wave — the host may probe with lighter assaults until you shore up walls, troops, and economy.',
    },
    {
      min: 0.72,
      label: 'Rising',
      short: 'II',
      color: '#b8c848',
      desc: 'Keeping pace with campaign escalation — expect standard host scaling on the next assault.',
    },
    {
      min: 0.95,
      label: 'Formidable',
      short: 'III',
      color: '#e8a040',
      desc: 'A strong kingdom — the host swells spawn counts and may inject extra elites to match your power.',
    },
    {
      min: 1.3,
      label: 'Dominant',
      short: 'IV',
      color: '#e86040',
      desc: 'Overbuilt relative to the wave — heavy host pressure, siege counters, and faction-specific answers.',
    },
    {
      min: 1.7,
      label: 'Empire',
      short: 'V',
      color: '#ff4040',
      desc: 'Maximum threat tier — the host throws its fullest toolkit, including multiple elite slots and faster cadence.',
    },
  ];

  constructor() {
    this.ctx = null;
    this.THREAT_TIERS = ColonyValueSystem.THREAT_TIERS;
  }

  bind(api) {
    this.ctx = api;
  }

  _svc(id) {
    if (this.ctx?.svc) return this.ctx.svc(id);
    if (this.ctx?.services?.get) return this.ctx.services.get(id);
    return typeof globalThis !== 'undefined' ? (globalThis[id] ?? null) : null;
  }

  getThreatTier(ratio) {
    let tier = this.THREAT_TIERS[0];
    for (const t of this.THREAT_TIERS) {
      if (ratio >= t.min) tier = t;
    }
    return tier;
  }

  /** Expected kingdom value if the player kept pace with campaign escalation. */
  getWaveBaseline(wave) {
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(wave) : 0;
    const military = 28 + eased * 340 + post * 200;
    const structures = 45 + eased * 460 + post * 300 + Math.min(wave, 35) * 9;
    const economy = 35 + eased * 110 + post * 75;
    // Opening waves assume a bootstrapped kingdom (walls, academies, starter TP).
    const earlyPad = wave <= 12 ? 220 + wave * 28 : wave <= 30 ? 120 + (30 - wave) * 5 : 0;
    return Math.floor(military + structures + economy + earlyPad);
  }

  unitMilitaryValue(u) {
    const def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(u.type) : null;
    let base = def?.cost || 3;
    if (u.isDoomslayer) base = Math.min(180, base * 0.018);
    const hpFactor = 0.55 + 0.45 * (u.hp / Math.max(1, u.maxHp));
    const starMult =
      1 + (u.vetGold || 0) * 0.42 + (u.vetSilver || 0) * 0.24 + (u.vetBronze || 0) * 0.1;
    const roleMult =
      u.type === 'general'
        ? 2.4
        : u.isCrossover
          ? 2.1
          : u.isWwe
            ? 1.9
            : u.type === 'knight'
              ? 1.35
              : 1;
    const dmgBase = Math.max(1, def?.damage || u.damage || 10);
    const dmgFactor = 0.88 + 0.12 * Math.min(2.2, (u.damage || dmgBase) / dmgBase);
    const moraleFactor =
      0.92 + Math.min(0.12, ((u.morale || 10) / Math.max(1, u.maxMorale || 20)) * 0.12);
    return base * hpFactor * starMult * roleMult * dmgFactor * moraleFactor;
  }

  buildingWealthValue(b) {
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

  computeKingdomStrength(overrides = {}) {
    if (!this.ctx) {
      return {
        total: 0,
        baseline: 100,
        threatRatio: 1,
        tier: this.THREAT_TIERS[0],
        breakdown: { military: 0, structures: 0, economy: 0 },
        signals: {},
      };
    }

    const units = overrides.units ?? this.ctx.units ?? [];
    const buildings = overrides.buildings ?? this.ctx.buildings ?? [];
    const tactical = overrides.tactical ?? this.ctx.tactical ?? 0;
    const wave = overrides.wave ?? this.ctx.wave ?? 0;

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
      military += this.unitMilitaryValue(u);
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
      const v = this.buildingWealthValue(b);
      structures += v;
      if (b.type === 'wall') signals.wallCount++;
      if (b.isAcademy) signals.academyCount++;
      if (b.isHamlet) signals.hamletCount++;
      if (b.isMerchantGuild) signals.guildCount++;
      if (b.type === 'castle' || b.type === 'keep') signals.castleValue += v;
    }

    if (this.ctx.countPlayerWalls)
      signals.wallCount = Math.max(signals.wallCount, this.ctx.countPlayerWalls());
    if (this.ctx.countPlayerHamlets)
      signals.hamletCount = Math.max(signals.hamletCount, this.ctx.countPlayerHamlets());
    if (this.ctx.countPlayerGuilds)
      signals.guildCount = Math.max(signals.guildCount, this.ctx.countPlayerGuilds());

    const settlementTp = this.ctx.getSettlementTpBonus?.() || 0;
    const tpPerRound = this.ctx.getTpPerRound?.() || 8;
    const economy = tactical * 0.38 + settlementTp * 9.5 + tpPerRound * 3.8;

    const total = Math.floor(military + structures + economy);
    const baseline = this.getWaveBaseline(wave);
    const threatRatio = Math.max(0.5, Math.min(2.25, total / Math.max(50, baseline)));

    return {
      total,
      baseline,
      threatRatio,
      tier: this.getThreatTier(threatRatio),
      breakdown: {
        military: Math.floor(military),
        structures: Math.floor(structures),
        economy: Math.floor(economy),
      },
      signals,
    };
  }

  compute() {
    return this.computeKingdomStrength();
  }

  /**
   * Convert kingdom strength into wave pressure. Stat multipliers stay modest because
   * getWaveConfig().hpScale/dmgScale already escalates enemies with wave number.
   */
  deriveWavePressure(colony, wave) {
    const ratio = colony?.threatRatio || 1;
    let countCurve = wave < 10 ? 0.38 : wave < 25 ? 0.48 : 0.55;
    if (typeof getKingdomStageBuffs === 'function') {
      const kb = getKingdomStageBuffs(wave);
      if (kb.colonyPressureCurve > 1) {
        countCurve = Math.min(0.78, countCurve * kb.colonyPressureCurve);
      }
    }
    const countMult = Math.max(0.7, Math.min(1.55, Math.pow(ratio, countCurve)));
    const statPressure = 1 + (ratio - 1) * 0.08;
    const hpMult = Math.max(0.9, Math.min(1.14, statPressure));
    const dmgMult = Math.max(0.9, Math.min(1.12, statPressure));

    const tpSignal = colony?.signals?.liquidTp || 0;
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const tpBaseline = 24 + eased * 140;
    const intervalMult = Math.max(
      0.8,
      Math.min(1.12, 1 - (tpSignal / Math.max(40, tpBaseline)) * 0.1)
    );

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
    const factionDepth = this._svc('FactionDepth');
    if (activeCrossoverFactions.size > 0 && factionDepth) {
      const armyUnits = this.ctx?.units ?? [];
      const synergyCount = armyUnits.length
        ? (factionDepth.computeSynergies(armyUnits) || []).length
        : 0;
      for (const [enemyType, counter] of Object.entries(factionDepth.ENEMY_COUNTERS || {})) {
        const hits = (counter.weakFactions || []).filter((f) => activeCrossoverFactions.has(f));
        if (!hits.length) continue;
        poolExtras.push(enemyType);
        weights[enemyType] = Math.max(
          weights[enemyType] || 1,
          1.2 + hits.length * 0.15 + synergyCount * 0.06
        );
      }
      if (synergyCount >= 3) {
        poolExtras.push('harpy', 'assassin');
        weights.harpy = Math.max(weights.harpy || 1, 1.28 + synergyCount * 0.05);
        weights.assassin = Math.max(weights.assassin || 1, 1.32 + synergyCount * 0.05);
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

    let pressure = {
      countMult,
      hpMult,
      dmgMult,
      intervalMult,
      poolExtras,
      weights,
      eliteSlots,
      ratio,
      tier: colony?.tier || this.THREAT_TIERS[0],
    };

    const counter = this._svc('StrategyCounterplay');
    if (counter) {
      const units = this.ctx?.units ?? [];
      counter.detect(colony, wave, units);
      pressure = counter.applyToPressure(pressure);
    }

    return pressure;
  }

  mergePool(pool, pressure) {
    const seen = new Set(pool);
    const merged = [...pool];
    for (const t of pressure.poolExtras || []) {
      if (typeof EnemyDefs !== 'undefined' && !EnemyDefs[t]) continue;
      merged.push(t);
      seen.add(t);
    }
    return merged;
  }

  mergeWeights(baseWeights, pressureWeights) {
    const out = { ...(baseWeights || {}) };
    for (const [t, w] of Object.entries(pressureWeights || {})) {
      out[t] = Math.max(out[t] || 1, w);
    }
    return out;
  }

  injectElites(spawnQueue, pool, pressure, rng) {
    const eliteTypes = [
      'dark_knight',
      'war_chief',
      'troll',
      'berserker',
      'assassin',
      'necromancer',
      'abomination',
      'behemoth',
      'void_stalker',
      'hellbound_legionnaire',
      'dreadborn_champion',
      'grim_revenant',
      'umbral_stalker',
      'cinderbound_juggernaut',
      'hellmortar_pack',
      'warp_prophet',
      'nightmare_strider',
    ];
    const slots = pressure?.eliteSlots || 0;
    if (!slots || !spawnQueue.length) return;
    const avail = eliteTypes.filter((t) => pool.includes(t));
    if (!avail.length) return;
    for (let i = 0; i < slots; i++) {
      const idx = Math.floor(rng() * spawnQueue.length);
      spawnQueue[idx] = avail[Math.floor(rng() * avail.length)];
    }
  }

  formatKingdomSummary(colony) {
    if (!colony) return 'Kingdom strength unknown';
    const b = colony.breakdown;
    return (
      `Kingdom ${colony.total} (${colony.tier.label} · ${colony.threatRatio.toFixed(2)}×) — ` +
      `Army ${b.military} · Works ${b.structures} · Treasury ${b.economy}`
    );
  }

  formatWaveNote(colony, pressure) {
    if (!colony || !pressure) return '';
    const pct = Math.round((pressure.countMult - 1) * 100);
    const sizeNote = pct > 4 ? `+${pct}% host` : pct < -4 ? `${pct}% host` : 'matched host';
    return `Kingdom ${colony.total} (${colony.tier.label} ${colony.threatRatio.toFixed(2)}×, ${sizeNote})`;
  }

  /**
   * Kingdom Evolution meter — blends colony strength, works, veterans, and research
   * into a 0–1 stage fill that drives the HUD banner growth.
   */
  computeEvolutionMeter(overrides = {}) {
    const colony =
      overrides.colony ??
      (this.ctx ? this.computeKingdomStrength(overrides) : { threatRatio: 1, total: 0 });
    const wave = overrides.wave ?? this.ctx?.wave ?? 0;
    const buildings = overrides.buildings ?? this.ctx?.buildings ?? [];
    const units = overrides.units ?? this.ctx?.units ?? [];
    const researchCompleted = overrides.researchCompleted ?? 0;
    const researchTotal = Math.max(1, overrides.researchTotal ?? 24);

    const evo =
      typeof getKingdomEvolutionStage === 'function'
        ? getKingdomEvolutionStage(wave)
        : { stage: 1, progress: 0 };
    const stage = evo.stage;

    const colonySig = Math.max(0, Math.min(1, (colony.threatRatio - 0.6) / 0.75));
    const bldCount = buildings.filter((b) => b.owner === 'player' && b.complete && b.hp > 0).length;
    const bldExpected = 4 + Math.min(36, wave * 0.32) + (stage >= 3 ? 10 : stage >= 2 ? 4 : 0);
    const buildingSig = Math.min(1, bldCount / Math.max(5, bldExpected));

    let vetScore = 0;
    let veteranUnits = 0;
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      const stars = (u.vetGold || 0) + (u.vetSilver || 0) + (u.vetBronze || 0);
      if (stars > 0 || (u.vetTier || 0) > 0 || u.honorName) veteranUnits++;
      vetScore += (u.vetTier || 0) * 2.2;
      vetScore += (u.vetGold || 0) * 1.6 + (u.vetSilver || 0) * 0.9 + (u.vetBronze || 0) * 0.35;
      if (u.honorName) vetScore += 2.5;
    }
    const vetExpected = 2 + stage * 5 + Math.min(18, wave * 0.12);
    const veteranSig = Math.min(1, vetScore / Math.max(4, vetExpected));

    const researchSig = Math.min(1, researchCompleted / researchTotal);

    const fill = colonySig * 0.35 + buildingSig * 0.25 + veteranSig * 0.25 + researchSig * 0.15;
    const stageProgress = Math.round(fill * 100);
    const overall = Math.min(399, (stage - 1) * 100 + stageProgress);
    const bannerTiers = ['pennant', 'crest', 'empire', 'hellforge'];

    return {
      fill,
      stageProgress,
      overall,
      bannerStage: stage,
      bannerTier: bannerTiers[stage - 1] || 'pennant',
      evolution: evo,
      signals: {
        colony: colonySig,
        buildings: buildingSig,
        veterans: veteranSig,
        research: researchSig,
      },
      breakdown: {
        colonyPct: Math.round(colonySig * 100),
        buildingPct: Math.round(buildingSig * 100),
        veteranPct: Math.round(veteranSig * 100),
        researchPct: Math.round(researchSig * 100),
        buildingCount: bldCount,
        veteranUnits,
        vetScore: Math.round(vetScore * 10) / 10,
        researchCompleted,
        researchTotal,
        colonyRatio: colony.threatRatio,
      },
    };
  }

  getThreatStageIndex(ratio) {
    let idx = 0;
    for (let i = 0; i < this.THREAT_TIERS.length; i++) {
      if (ratio >= this.THREAT_TIERS[i].min) idx = i;
    }
    return idx;
  }

  formatThreatTooltip(colony, pressure, wave = 0) {
    if (!colony?.total) {
      return (
        'Kingdom Strength — live score of army, works, and treasury vs the next wave baseline.\n' +
        '1.00× at the gold tick = on-pace. Above swells the host; below eases assaults.'
      );
    }
    const ratio = colony.threatRatio || 1;
    const tier = this.getThreatTier(ratio);
    const b = colony.breakdown || {};
    const baseline = colony.baseline || this.getWaveBaseline(wave);
    const nextWave = (wave | 0) + 1;
    const stageIdx = this.getThreatStageIndex(ratio);
    const nextTier = this.THREAT_TIERS[stageIdx + 1];
    const lines = [
      `Kingdom Strength — ${tier.label} (Stage ${tier.short || stageIdx + 1}) · ${ratio.toFixed(2)}×`,
      tier.desc || '',
      '',
      `Total ${colony.total} vs wave ${nextWave} baseline ${baseline}`,
      `Army ${b.military ?? 0} · Works ${b.structures ?? 0} · Treasury ${b.economy ?? 0}`,
    ];
    if (pressure) {
      const hostPct = Math.round((pressure.countMult - 1) * 100);
      const hostWord =
        hostPct > 4 ? `+${hostPct}% larger` : hostPct < -4 ? `${hostPct}% lighter` : 'matched';
      lines.push('', `Next wave host pressure: ${hostWord} assault`);
      lines.push(
        `Spawn HP ×${(pressure.hpMult || 1).toFixed(2)} · Damage ×${(pressure.dmgMult || 1).toFixed(2)}`
      );
      if (pressure.eliteSlots) {
        lines.push(
          `${pressure.eliteSlots} extra elite slot${pressure.eliteSlots > 1 ? 's' : ''} likely in the queue`
        );
      }
      if (pressure.poolExtras?.length) {
        lines.push(`Counters brewing: ${[...new Set(pressure.poolExtras)].slice(0, 5).join(', ')}`);
      }
    }
    if (nextTier && ratio < nextTier.min) {
      const need = nextTier.min - ratio;
      lines.push(
        '',
        `Next stage ${nextTier.label} at ${nextTier.min.toFixed(2)}× (need +${need.toFixed(2)}×)`
      );
    }
    lines.push(
      '',
      'Gold tick on the bar = 1.00× on-pace. Night snapshot locks wave pressure; bar updates live.'
    );
    return lines.join('\n');
  }

  formatNightPreview(colony, nextWave, pressure) {
    const sizePct = Math.round(((pressure?.countMult || 1) - 1) * 100);
    const sizeWord = sizePct > 6 ? 'larger' : sizePct < -6 ? 'lighter' : 'matched';
    const tier = colony?.tier?.label || 'On-pace';
    if (sizeWord === 'matched') return `Wave ${nextWave}: ${tier} threat · matched assault.`;
    return `Wave ${nextWave}: ${tier} threat · expect a ${sizeWord} assault.`;
  }

  formatThreatTierTable() {
    return this.THREAT_TIERS.map((t, i) => {
      const stage = t.short || String(i + 1);
      return `${t.label} (Stage ${stage}, ${t.min}×+): ${t.desc || ''}`;
    }).join('\n\n');
  }

  formatCompositionTable() {
    const rows = [
      'Walls (2+): goblin_sapper (weight 1.4)',
      'Walls (4+): + siege_tower (2.0), goblin_sapper (1.7)',
      'Walls (8+): + siege_tower ×2, goblin_engineer (1.8) — full siege toolkit',
      'Army ledger ≥ 42% of baseline: berserker (1.9), dark_knight (1.7), war_chief (1.5), assassin (1.4)',
      'Academies (2+): dark_mage (1.35), shaman (1.3)',
      'Academies (4+): + necromancer (1.6)',
      'Evolved/Coliseum (2+ field): troll (1.75), berserker, assassin; wave 20+ abomination; wave 35+ void_stalker',
      'Hamlets + guilds (2+ total): goblin_engineer (1.55), orc ×2',
      'Wall garrisons (4+): siege_tower, goblin_sapper, warg_rider (1.35)',
    ];
    return rows.join('\n');
  }

  formatFactionCounterTable() {
    const counters = this._svc('FactionDepth')?.ENEMY_COUNTERS || {};
    const lines = Object.entries(counters).map(([enemy, c]) => {
      const factions = (c.weakFactions || []).join(', ');
      const note = c.note ? ` — ${c.note}` : '';
      return `${enemy} (×${c.mult || 1} weight vs ${factions})${note}`;
    });
    return lines.length
      ? lines.join('\n')
      : 'Evolved operatives on the field add faction-specific counter weights from FactionDepth.ENEMY_COUNTERS (necromancer, shaman, harpy, sky_drake, war_chief, assassin, dark_mage, troll, berserker, goblin_sapper).';
  }

  getEncyclopediaEntries() {
    const tierText = this.THREAT_TIERS.map((t) => `${t.label} (${t.min}×+)`).join(' → ');

    return [
      {
        cat: 'colony',
        name: 'Kingdom Strength & Enemy Adaptation',
        body: [
          "Your kingdom's strength directly shapes the enemy's aggression and composition.",
          '',
          'Every live unit, completed structure, and hoarded TP point feeds a RimWorld-style kingdom score. Each night the game compares your total to the expected baseline for the upcoming wave. The ratio becomes threat pressure — the host swells spawn counts, tightens cadence, injects elites, and tilts the spawn pool toward counters for whatever you built or fielded.',
          '',
          'Wave hpScale/dmgScale from getWaveConfig() still drives the core stat curve by wave number. Kingdom strength layers adaptive aggression and composition on top — your success trains the next assault.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'What Is Kingdom Strength?',
        body: 'Kingdom strength (colony value) is a live score of how powerful your realm is right now. Three ledgers sum into one total: Army (fielded troops), Works (completed structures), and Treasury (liquid TP and income). The STRENGTH HUD in the top bar shows your threat ratio vs the next-wave baseline. At 1.00× you are on-pace; above swells the host; below eases assaults. Night intel locks pressure into the spawn queue; the bar updates live during the day.',
      },
      {
        cat: 'colony',
        name: 'The Three Ledgers',
        body: [
          'Army — every live player unit weighted by:',
          '• Deploy cost (Doomslayer capped)',
          '• HP factor: 0.55 + 0.45 × (current HP ÷ max HP)',
          '• Star mult: +42% gold, +24% silver, +10% bronze per star',
          '• Role mult: General ×2.4, evolved ×2.1, coliseum ×1.9, knight ×1.35',
          '• Damage factor: 0.88–1.0 vs base; morale factor up to +12%',
          '',
          'Works — completed player structures by build cost × HP ratio × type mult:',
          '• Hamlet ×1.85 · Merchant guild ×2.05 · Academy ×1.45',
          '• Evolved barracks ×1.55 · Grand Coliseum ×1.65',
          '• Castle/keep ×1.25 · Wall ×0.82',
          '',
          'Treasury — liquid TP ×0.38 + settlement TP bonus ×9.5 + wave TP income ×3.8.',
          'Hoarding TP raises Treasury and can tighten enemy spawn intervals (see Aggression).',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Baseline & Threat Ratio',
        body: [
          'Expected baseline = military + structures + economy curves scaled by academyEase and postAcademyProgress for the target wave:',
          '• Military: 28 + eased×340 + post×200',
          '• Structures: 45 + eased×460 + post×300 + min(wave,35)×9',
          '• Economy: 35 + eased×110 + post×75',
          '• Early pad (waves 1–12): 220 + wave×28; waves 13–30: 120 + (30−wave)×5',
          '',
          'Threat ratio = your total ÷ baseline, clamped 0.5×–2.25×.',
          'The HUD bar maps ratio to fill; gold tick at 1.00× = on-pace for that wave.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Threat Tiers',
        body: [
          `Tier labels from ratio: ${tierText}.`,
          'Tier color drives the STRENGTH bar fill and stage pill (Humble I → Empire V).',
          '',
          this.formatThreatTierTable(),
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Aggression: Host Size & Stats',
        body: [
          'From threat ratio each night, this.deriveWavePressure() shapes aggression:',
          '',
          'Host count — ratio raised to a curve that steepens with wave band:',
          '• Waves 1–9: exponent 0.38 · 10–24: 0.48 · 25+: 0.55',
          '• Kingdom stage buffs can raise the curve (capped at 0.78)',
          '• Result: countMult clamped 0.7×–1.55× (~−30% to +55% host size)',
          '',
          'Enemy stats — modest layer on top of wave hpScale/dmgScale:',
          '• statPressure = 1 + (ratio − 1) × 0.08',
          '• HP mult clamped 0.9×–1.14× · Damage mult 0.9×–1.12×',
          '',
          'Spawn cadence — bloated Treasury tightens intervals:',
          '• intervalMult = 1 − (liquid TP ÷ TP baseline) × 0.1, clamped 0.8×–1.12×',
          '• TP baseline ≈ 24 + academyEase×140',
          '',
          'Night preview and STRENGTH tooltip show host size %, HP/DMG mults, and elite forecast.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Composition: Adaptive Spawn Pool',
        body: [
          'Composition counters read battlefield signals from this.computeKingdomStrength(). Extra enemy types merge into the wave pool with boosted spawn weights:',
          '',
          this.formatCompositionTable(),
          '',
          'Extras only inject if the type exists in EnemyDefs. this.mergePool() and this.mergeWeights() fold pressure into the nightly spawn queue before elite injection.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Faction Counter Weights',
        body: [
          'When evolved or coliseum operatives are on the field, the host scans active factions against FactionDepth.ENEMY_COUNTERS. Matching weakFactions add counter types to the pool with weight = max(existing, 1.2 + 0.15 per matching faction):',
          '',
          this.formatFactionCounterTable(),
          '',
          'Diversify evolved rosters or expect the host to field answers. Spy and faction intel help preview which realms are hostile.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Elite Injection Slots',
        body: [
          'High threat ratios reserve extra elite slots in the spawn queue (injectElites replaces random queue entries):',
          '• 1 slot at ratio ≥ 1.08× (Formidable threshold)',
          '• 2 slots at ratio ≥ 1.35× (Dominant)',
          '• 3 slots at ratio ≥ 1.65× (near Empire)',
          '',
          'Elite pool: dark_knight, war_chief, troll, berserker, assassin, necromancer, abomination, behemoth, void_stalker, hellbound_legionnaire, dreadborn_champion, grim_revenant, umbral_stalker, cinderbound_juggernaut, hellmortar_pack, warp_prophet, nightmare_strider.',
          'Only types already in the merged pool can be injected.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'STRENGTH HUD (Top Bar)',
        body: [
          'After WAVE, the STRENGTH block shows:',
          '• Stage pill — Humble I through Empire V',
          '• Colored bar with gold tick at 1.00× on-pace',
          '• Live ratio (e.g. 1.12×)',
          '',
          'Hover tooltip (formatThreatTooltip): tier description, Army/Works/Treasury breakdown, total vs baseline, next-wave host size preview, spawn HP/DMG mults, elite slot forecast, counter types brewing, and distance to the next threat stage.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Night Lock & Day Preview',
        body: [
          'At night end the game snapshots kingdom strength for wave N+1 and derives pressure into colonyThreatMods.',
          'formatNightPreview announces a short line: threat tier and whether the assault is larger, lighter, or matched.',
          '',
          'During the day the STRENGTH bar recomputes live against the upcoming wave baseline so you can see spending or losses move the needle before the next night lock.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Strategic Implications',
        body: [
          'Growing fast earns TP, veterans, and evolution fill — but invites heavier aggression and targeted composition.',
          '• Spend TP before peaks rather than hoarding (Treasury raises intervals)',
          '• Wall-heavy turtles trigger sapper/tower/engineer packs',
          '• Crossover-heavy rosters trigger faction counters',
          '• Academy spam draws casters and necromancers',
          '• Hamlet/guild economies draw goblin engineers',
          '',
          'Underbuilt kingdoms (ratio < 0.85) see lighter hosts — viable when recovering from a wipe.',
          'Balance Army, Works, and Treasury instead of maxing one ledger.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Evolution Meter vs Kingdom Strength',
        body: [
          'Kingdom strength (threat ratio) feeds wave pressure — how hard and how cleverly the host hits.',
          'The evolution meter (banner growth) feeds unlocked doctrines and visual stage — how far you have grown within the current evolution tier.',
          '',
          'this.computeEvolutionMeter() blends four signals:',
          '• Colony value 35% — threat ratio mapped 0.6×–1.35× to 0–100%',
          '• Buildings 25% — completed structures vs wave-expected count',
          '• Veterans 25% — stars, ranks, honor names on the field',
          '• Research 15% — completed projects vs total tree',
          '',
          'Banner tiers: pennant → crest → empire → hellforge. A tall wall line with honored veterans can fill the meter even before threat ratio spikes.',
        ].join('\n'),
      },
      {
        cat: 'colony',
        name: 'Threat Map & Faction Intel',
        body: 'Open via 🗺 top bar, FACTION INTEL right panel, or HOST HUD click. North-sector map plus per-realm cards: evolution stage, hostility, counter-offensive debuffs, multi-front assignment, conquest sector %, and dormant/eliminated status. Combine with STRENGTH tooltip and night wave intel before dawn.',
      },
      {
        cat: 'colony',
        name: 'Reading the HUD',
        body: 'STRENGTH — primary kingdom threat readout (see STRENGTH HUD entry). Kingdom panel — evolution stage and meter fill. HOST HUD — threat level and faction roster; click to open Threat Map. THREAT compass — active multi-front flanks (▲▶◀▼). CONQUEST HUD — sector % per realm after wave 500. Combine with night wave intel before dawn.',
      },
    ];
  }
}

/** Singleton — preserves legacy `ColonyValue.method()` API. */
const ColonyValue = new ColonyValueSystem();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.ColonyValue = ColonyValue;
