/**
 * Gameplay depth — economy scaling, aura, morale, threats, hazards.
 */
/**
 * Core gameplay depth: economy curves, morale, wave types, unit scaling.
 * @class GameDepthSystem
 * @see GameDepth — singleton used across game loop
 *
 * API:
 * - scaleSettlementTp / waveTpScale — TP economy
 * - getGeneralAuraBreakdown / getNightBuildMult — general & build pacing
 * - isBossWave / isHordeWave / buildHordeSpawnQueue — wave taxonomy
 * - applyEnemySpawnScaling / injectEvilOperativesIntoQueue — host stat growth
 * - applyIpWaveScaling / getVanillaObsoleteMult / getUnitScalingSnapshot — ally scaling
 * - applyVeteranTenureScaling / getTenureMult — tenure growth
 * - spawnHazards / applyHazardToUnit — battlefield hazards
 */
class GameDepthSystem {
  static SETTLEMENT_TP_SOFT_CAP = 18;

  static SETTLEMENT_TP_DIMINISH = 0.55;

  static POST_200_TP_WAVE_SCALE = 0.72;

  static POST_100_TP_WAVE_SCALE = 0.88;

  static ACADEMY_HYBRID_WAVES = 5;

  static GENERAL_AURA_RADIUS = 165;

  static LAST_STAND_MAX_ALLIES = 2;

  static LAST_STAND_DMG_BONUS = 0.28;

  static LAST_STAND_MIT_BONUS = 0.22;

  static MORALE_CASCADE_WINDOW = 420;

  static MORALE_CASCADE_THRESHOLD = 3;

  static NAMED_BOSS_ROSTER = [
    {
      type: 'boss_gorath',
      name: 'Gorath the Breaker',
      title: 'Warlord of the Ash March',
      tagline: 'His axe opens the way for a thousand boots.',
    },
    {
      type: 'boss_morwen',
      name: 'Morwen the Pale',
      title: 'Queen of the Bone Court',
      tagline: 'She counts your dead and bills you in ghouls.',
    },
    {
      type: 'boss_thokk',
      name: 'Thokk the Mountain',
      title: 'Walker of Shattered Gates',
      tagline: 'Walls crumble when he exhales.',
    },
    {
      type: 'boss_grimm',
      name: 'Grimm Ashborne',
      title: 'Knight of the Cinder Oath',
      tagline: 'Steel and flame — nothing else remains.',
    },
    {
      type: 'boss_vexis',
      name: 'Vexis the Hollow',
      title: 'Shadow That Hungers',
      tagline: "Your General's heartbeat is his compass.",
    },
    {
      type: 'boss_karg',
      name: 'Iron Lord Karg',
      title: 'Forge-Walker',
      tagline: 'A walking foundry that wants your hamlets.',
    },
    {
      type: 'boss_sylvara',
      name: 'Sylvara Wyrm-Mother',
      title: 'Matriarch of the Burning Sky',
      tagline: 'The horizon is her throat.',
    },
    {
      type: 'boss_rotfather',
      name: 'The Rotfather',
      title: 'Pustulent Patriarch',
      tagline: 'Flesh obeys him, even its own.',
    },
    {
      type: 'boss_volk',
      name: 'Dread Marshal Volk',
      title: 'Hammer of the North Host',
      tagline: 'Siege engines kneel when he passes.',
    },
    {
      type: 'boss_malachar',
      name: 'Malachar the Eternal',
      title: 'Voice of the Endless Siege',
      tagline: 'Wave one hundred was only his rehearsal.',
    },
  ];

  static HORDE_FLAVORS = [
    { label: 'Goblin Tide', tagline: 'A chittering flood — break the wave or drown.' },
    { label: 'Orc Pack', tagline: 'Iron shoulders roll forward in a living ram.' },
    { label: 'Plague Swarm', tagline: 'Teeth and fever — AoE saves lives here.' },
    { label: 'Warg Run', tagline: 'Fast hooves on every flank. Stay alive.' },
    { label: 'Sapper Rush', tagline: 'They sprint for your walls while the mob distracts you.' },
    { label: 'Burrower Surge', tagline: 'The ground ripples — watch your rear.' },
    { label: 'Archer Screen', tagline: 'Cheap arrows darken the sky behind the horde.' },
    { label: 'Mixed Host', tagline: 'Everything the war camp had left — thrown at once.' },
  ];

  constructor() {
    this._ctx = null;
    this.SETTLEMENT_TP_SOFT_CAP = GameDepthSystem.SETTLEMENT_TP_SOFT_CAP;
    this.ACADEMY_HYBRID_WAVES = GameDepthSystem.ACADEMY_HYBRID_WAVES;
    this.GENERAL_AURA_RADIUS = GameDepthSystem.GENERAL_AURA_RADIUS;
    this.NAMED_BOSS_ROSTER = GameDepthSystem.NAMED_BOSS_ROSTER;
    this.HORDE_FLAVORS = GameDepthSystem.HORDE_FLAVORS;
  }

  scaleSettlementTp(raw) {
    if (raw <= this.SETTLEMENT_TP_SOFT_CAP) return raw;
    const over = raw - this.SETTLEMENT_TP_SOFT_CAP;
    return this.SETTLEMENT_TP_SOFT_CAP + over * GameDepthSystem.SETTLEMENT_TP_DIMINISH;
  }

  waveTpScale(wave) {
    const academyBlend =
      typeof academyThresholdBlend === 'function' ? academyThresholdBlend(wave) : wave >= 100 ? 1 : 0;
    const rtsBlend = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : wave >= 200 ? 1 : 0;
    const mid = GameDepthSystem.POST_100_TP_WAVE_SCALE;
    const late = GameDepthSystem.POST_200_TP_WAVE_SCALE;
    const afterAcademy = 1 + (mid - 1) * academyBlend;
    return afterAcademy + (late - afterAcademy) * rtsBlend;
  }

  isHybridAcademyDeploy() {
    return true;
  }

  hybridDeployCostMult() {
    return 1;
  }

  getGeneralAuraBreakdown(gen) {
    if (!gen?.stationedKeep) {
      return {
        strength: 0,
        morale: 0,
        accuracy: 0,
        meleeDmg: 0,
        rangedDmg: 0,
        mitigation: 0,
        radius: this.GENERAL_AURA_RADIUS,
      };
    }
    const minutes = (gen.generalAliveTimer || 0) / 3600;
    const starBuff = (gen.generalStars || 0) * 0.045;
    const strength = Math.min(1, 0.08 + minutes * 0.18 + starBuff);
    return {
      strength,
      morale: 0.04 * strength,
      accuracy: 18 * strength,
      meleeDmg: 0.5 * strength,
      rangedDmg: 0.38 * strength,
      mitigation: 0.22 * strength,
      compoundBonus: 0.12 * strength,
      radius: this.GENERAL_AURA_RADIUS,
    };
  }

  getNightBuildMult(wave, nightTimer, nightPrepTicks) {
    let mult = typeof NIGHT_BUILD_MULT !== 'undefined' ? NIGHT_BUILD_MULT : 1.35;
    const academyBlend =
      typeof academyThresholdBlend === 'function' ? academyThresholdBlend(wave) : wave >= 100 ? 1 : 0;
    const rtsBlend = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : wave >= 200 ? 1 : 0;
    mult += academyBlend * 0.05 + rtsBlend * 0.08;
    const urgency = nightTimer > nightPrepTicks * 0.85 ? 0.92 : 1;
    return mult * urgency;
  }

  countCombatAllies(units) {
    return units.filter(
      (u) =>
        u.team === 'player' &&
        u.hp > 0 &&
        !u.fleeing &&
        !u.demoralized &&
        u.type !== 'builder' &&
        u.type !== 'courier' &&
        !u.isGeneral
    ).length;
  }

  updateLastStand(units) {
    const n = this.countCombatAllies(units);
    return n > 0 && n <= GameDepthSystem.LAST_STAND_MAX_ALLIES;
  }

  lastStandDamageMult(active) {
    return active ? 1 + GameDepthSystem.LAST_STAND_DMG_BONUS : 1;
  }

  lastStandMitBonus(active) {
    return active ? GameDepthSystem.LAST_STAND_MIT_BONUS : 0;
  }

  recordMoraleCascade(state, broke) {
    if (!broke) return state;
    const now = state.tick || 0;
    const recent = (state.recentBreaks || []).filter(
      (t) => now - t < GameDepthSystem.MORALE_CASCADE_WINDOW
    );
    recent.push(now);
    return {
      ...state,
      recentBreaks: recent,
      cascade: recent.length >= GameDepthSystem.MORALE_CASCADE_THRESHOLD,
    };
  }

  weightedSpawnSide(sides, spawnIdx) {
    if (sides.length <= 1) return sides[0];
    const newest = sides[sides.length - 1];
    const roll = Math.random();
    if (roll < 0.55) return newest;
    return sides[spawnIdx % sides.length];
  }

  isBossWave(wave) {
    return wave >= 10 && wave % 10 === 0;
  }

  isHordeWave(wave) {
    return wave >= 5 && wave % 5 === 0 && !this.isBossWave(wave);
  }

  buildHordeSpawnQueue(wave, pool, mods = {}, diff = {}) {
    const cfg =
      typeof getWaveConfig === 'function' ? getWaveConfig(wave) : { count: 12, interval: 70 };
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(wave) : 0;

    let count = Math.floor(
      cfg.count *
        (1.28 + eased * 0.22 + post * 0.12) *
        (mods.countMult || 1) *
        (diff.enemyCountMult || 1)
    );
    if (mods.stealReduction) count = Math.max(8, count - mods.stealReduction);

    const swarm = ['goblin', 'goblin', 'goblin', 'plague_rat', 'plague_rat', 'orc', 'orc'];
    const harass = [
      'warg_rider',
      'orc_archer',
      'goblin_sapper',
      'goblin_burrower',
      'harpy',
      'hellbound_legionnaire',
      'nightmare_strider',
      'warp_prophet',
      'grim_revenant',
    ];
    const unlocked = new Set(pool || []);
    swarm.forEach((t) => unlocked.add(t));
    harass.forEach((t) => {
      if (wave >= 6 || t === 'goblin_sapper') unlocked.add(t);
    });
    if (wave >= 9) unlocked.add('goblin_burrower');
    if (wave >= 6) unlocked.add('harpy', 'plague_rat');

    const pickSwarm = () => {
      const opts = swarm.filter((t) => unlocked.has(t));
      return opts[Math.floor(Math.random() * opts.length)] || 'goblin';
    };
    const pickHarass = () => {
      const opts = harass.filter((t) => unlocked.has(t));
      return opts.length ? opts[Math.floor(Math.random() * opts.length)] : pickSwarm();
    };

    const queue = [];
    for (let i = 0; i < count; i++) {
      queue.push(Math.random() < 0.12 ? pickHarass() : pickSwarm());
    }

    let hasSiege = false;
    if (wave >= 15 && wave % 15 === 0) {
      queue.unshift('siege_tower', 'goblin_sapper', 'goblin_sapper');
      hasSiege = true;
    } else if (wave >= 20 && wave % 10 === 5) {
      queue.push('goblin_sapper', 'goblin_sapper');
    }

    if (wave >= 25) {
      ['hellbound_legionnaire', 'nightmare_strider', 'dreadborn_champion'].forEach((t) => {
        if (
          wave >= (typeof EVIL_OPERATIVE_WAVES !== 'undefined' ? EVIL_OPERATIVE_WAVES[t] || 99 : 99)
        )
          unlocked.add(t);
      });
    }
    if (wave >= 40 && !mods.noElites && !diff.forceNoElites && queue.length > 10) {
      const lightElites = [
        'berserker',
        'dark_knight',
        'troll',
        'dreadborn_champion',
        'warp_prophet',
      ].filter((t) => unlocked.has(t));
      if (lightElites.length) {
        queue[Math.floor(Math.random() * queue.length)] =
          lightElites[Math.floor(Math.random() * lightElites.length)];
      }
    }

    const flavorIdx = Math.max(0, Math.floor(wave / 5) - 1) % this.HORDE_FLAVORS.length;
    const flavor = this.HORDE_FLAVORS[flavorIdx];
    const intervalMult =
      Math.max(0.48, 0.7 - eased * 0.14 - post * 0.06) * (diff.spawnIntervalMult || 1);
    const hpMult = Math.max(0.82, 0.92 - eased * 0.04);
    const dmgMult = Math.max(0.85, 0.94 - eased * 0.03);
    const intensity = this.computeHordeIntensity(wave, queue.length, intervalMult, hasSiege, cfg);

    return {
      queue,
      flavor,
      hasSiege,
      intervalMult,
      hpMult,
      dmgMult,
      count: queue.length,
      intensity,
    };
  }

  /** 0→1 severity cue for horde waves — scales with swarm size, spawn pace, and siege. */
  computeHordeIntensity(wave, queueLen, intervalMult, hasSiege, cfg) {
    const baseline = Math.max(8, (cfg?.count || 12) * 1.15);
    const countRatio = queueLen / baseline;
    const spawnPace = 1 / Math.max(0.42, intervalMult);
    const siegeBoost = hasSiege ? 0.14 : 0;
    const waveBoost = Math.min(0.12, (typeof academyEase === 'function' ? academyEase(wave) : wave / 100) * 0.12);
    const raw = (countRatio - 0.82) * 0.5 + (spawnPace - 0.95) * 0.38 + siegeBoost + waveBoost;
    return Math.max(0.28, Math.min(1, raw));
  }

  getNamedBossForWave(wave) {
    if (!wave || !this.isBossWave(wave)) return null;
    const idx = (Math.floor(wave / 10) - 1) % this.NAMED_BOSS_ROSTER.length;
    const entry = this.NAMED_BOSS_ROSTER[idx];
    const cycle = Math.floor((wave / 10 - 1) / this.NAMED_BOSS_ROSTER.length);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(wave) : 0;
    const rtsBlend = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : 0;
    const scale = 1 + cycle * 0.2 + post * 0.35 + rtsBlend * 0.4;
    return { ...entry, scale, wave };
  }

  bossWaveComposition(wave, pool) {
    const named = this.getNamedBossForWave(wave);
    const queue = named ? [named.type] : ['war_chief'];
    queue.push('dark_knight', 'dark_knight', 'berserker', 'necromancer');
    if (wave >= 14) queue.push('sky_drake');
    if (wave >= 10) queue.push('bone_summoner');
    if (wave >= 25) queue.push('hellbound_legionnaire', 'dreadborn_champion');
    if (wave >= 35) queue.push('warp_prophet', 'grim_revenant');
    if (wave >= 45) queue.push('umbral_stalker', 'hellmortar_pack');
    if (wave >= 55) queue.push('cinderbound_juggernaut');
    if (wave >= 20) queue.push('abomination');
    if (wave >= 25) queue.push('behemoth');
    if (wave >= 35) queue.push('void_stalker');
    if (wave >= 40) queue.push('iron_colossus');
    if (wave >= 50) queue.push('elder_wyrm');
    const extra = Math.min(
      4,
      Math.floor((typeof academyEase === 'function' ? academyEase(wave) : wave / 100) * 4)
    );
    for (let i = 0; i < extra; i++) {
      queue.push(pool[Math.floor(Math.random() * pool.length)] || 'orc');
    }
    return queue;
  }

  pickWaveEvent(wave) {
    if (typeof ContentExpansion !== 'undefined') return ContentExpansion.pickWaveEvent(wave);
    if (wave % 13 === 0) return 'blood_moon';
    if (wave % 17 === 0) return 'supply_caravan';
    if (wave % 23 === 0) return 'siege_push';
    return null;
  }

  formatWaveIntel(spawnQueue, sides, siege, towerEst) {
    const counts = {};
    for (const t of spawnQueue) counts[t] = (counts[t] || 0) + 1;
    const parts = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t, n]) => `${n}× ${EnemyDefs[t]?.name || t}`);
    const flank = sides?.length > 1 ? ` · Flanks: ${sides.join(', ')}` : '';
    const siegeNote = siege ? ` · SIEGE (~${towerEst || '?'} towers)` : '';
    return `${spawnQueue.length} foes: ${parts.join(', ')}${flank}${siegeNote}`;
  }

  spawnHazards(worldW, worldH, territoryTier, rallyY, wave = 0, ctx = {}) {
    if (typeof FactionHazards !== 'undefined') {
      return FactionHazards.spawnInitial(worldW, worldH, territoryTier, rallyY, wave, ctx);
    }
    const hazards = [];
    if (territoryTier < 2) return hazards;
    const types = ['swamp', 'fire'];
    const count = 2 + territoryTier;
    for (let i = 0; i < count; i++) {
      const t = types[i % types.length];
      hazards.push({
        type: t,
        id: `haz_${i}_${Date.now()}`,
        x: 80 + Math.random() * (worldW - 160),
        y: rallyY - 120 + Math.random() * (worldH - rallyY - 80),
        radius: 28 + Math.random() * 18,
        damage: t === 'fire' ? 0.35 : 0,
        slow: t === 'swamp' ? 0.55 : 1,
      });
    }
    return hazards;
  }

  applyHazardToUnit(unit, hazards, spatial) {
    if (typeof FactionHazards !== 'undefined') {
      FactionHazards.applyToUnit(unit, hazards, spatial);
      return;
    }
    if (!unit || unit.hp <= 0 || unit.flying) return;
    const frostFloor =
      (unit.frostTimer || 0) > 0 ? Math.min(1, unit.frostSlow || unit._frostSlow || 0.55) : 1;
    unit.hazardSlow = frostFloor;
    for (const h of hazards) {
      const dx = unit.x - h.x;
      const dy = unit.y - h.y;
      const r = h.radius || 0;
      if (dx * dx + dy * dy > r * r) continue;
      if (h.type === 'swamp') unit.hazardSlow = Math.min(unit.hazardSlow, h.slow);
      if (h.type === 'fire' && unit.team === 'player' && (unit.hazardBurnTick || 0) <= 0) {
        unit.hp = Math.max(1, unit.hp - h.damage);
        unit.hazardBurnTick = 50;
        FloatingText?.status(unit.x, unit.y, 'BURN', '#ff6040');
      }
    }
  }

  isInsideCastleGroup(unit, buildings, groupId) {
    if (!groupId) return false;
    const keep = buildings.find((b) => b.castleGroup === groupId && b.isKeep);
    if (!keep) return false;
    return Math.hypot(unit.x - keep.x, unit.y - keep.y) < CASTLE_COMPOUND_OFFSET + 20;
  }

  specialistLateAbility(unit) {
    if (typeof getSpecialistLateAbilityInfo === 'function') {
      const info = getSpecialistLateAbilityInfo(unit);
      return info?.unlocked ? info.id : null;
    }
    if (!unit || typeof isSpecialistLateAbilityUnlocked !== 'function') return null;
    if (!isSpecialistLateAbilityUnlocked(unit)) return null;
    if (unit.type === 'healer') return 'mass_mend';
    if (unit.type === 'builder') return 'rapid_repair';
    if (unit.type === 'courier') return 'twin_dispatch';
    return null;
  }

  isIpOperative(unit) {
    return !!(unit?.isCrossover || unit?.isWwe || unit?.isDoomslayer);
  }

  isVanillaAlly(unit) {
    return unit?.team === 'player' && unit.hp > 0 && !this.isIpOperative(unit);
  }

  isEnemyHordeGrunt(unit) {
    return (
      unit?.team === 'enemy' &&
      (unit.isHordeGrunt ||
        (typeof isEnemyHordeGruntType === 'function' && isEnemyHordeGruntType(unit.type)))
    );
  }

  isEnemyEvilOperative(unit) {
    return (
      unit?.team === 'enemy' &&
      (unit.isEvilOperative ||
        unit.isNamedBoss ||
        (typeof isEnemyEvilOperativeType === 'function' && isEnemyEvilOperativeType(unit.type)))
    );
  }

  ensureEnemyBaseStats(unit) {
    if (!unit || unit.team !== 'enemy') return;
    if (unit.baseMaxHp == null) unit.baseMaxHp = unit.maxHp;
    if (unit.baseDamage == null) unit.baseDamage = unit.damage || 0;
  }

  /** Horde grunts scale slowly — filler that falls behind crossover-grade threats. */
  getHordeGruntWaveScale(wave) {
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(wave) : 0;
    return {
      hp: 1 + eased * 0.58 + post * 0.32,
      dmg: 1 + eased * 0.38 + post * 0.2,
    };
  }

  /** Evil operatives mirror crossover IP scaling — the host's answer to your champions. */
  getEvilOperativeWaveScale(wave) {
    return this.getIpWaveScale(wave);
  }

  applyEvilOperativeWaveScaling(unit, wave) {
    if (!this.isEnemyEvilOperative(unit) || unit.hp <= 0) return false;
    this.ensureEnemyBaseStats(unit);
    const spawnW = unit.spawnWave ?? wave;
    const tenure = Math.max(0, wave - spawnW);
    const waveS = this.getEvilOperativeWaveScale(wave);
    const tenS = this.getTenureMult(tenure, 'enemy');
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
    unit.maxHp = Math.max(1, Math.floor(unit.baseMaxHp * waveS.hp * tenS.hp));
    unit.hp = Math.max(1, Math.min(unit.maxHp, Math.floor(unit.maxHp * hpRatio)));
    if (unit.baseDamage > 0) {
      unit.damage = Math.max(1, Math.floor(unit.baseDamage * waveS.dmg * tenS.dmg));
    }
    unit.tenureApplied = tenure;
    return true;
  }

  injectEvilOperativesIntoQueue(queue, wave, rng = Math.random) {
    if (!queue?.length || wave < 30 || typeof getUnlockedEvilOperatives !== 'function')
      return queue;
    const ops = getUnlockedEvilOperatives(wave);
    if (!ops.length) return queue;
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const replaceChance = Math.min(0.3, 0.04 + eased * 0.18);
    return queue.map((t) => {
      if (!(typeof isEnemyHordeGruntType === 'function' && isEnemyHordeGruntType(t))) return t;
      return rng() < replaceChance ? ops[Math.floor(rng() * ops.length)] : t;
    });
  }

  applyEnemySpawnScaling(unit, wave, opts = {}) {
    if (!unit || unit.team !== 'enemy') return unit;
    const cfg = opts.cfg || {};
    const diff = opts.diff || {};
    const waveMods = opts.waveModifiers || {};
    const horde = opts.hordeWave;
    const colony = opts.colonyThreat;
    const accProg = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(wave) : 0;

    this.ensureEnemyBaseStats(unit);

    if (this.isEnemyHordeGrunt(unit)) {
      const grunt = this.getHordeGruntWaveScale(wave);
      unit.maxHp = Math.floor(
        unit.baseMaxHp * grunt.hp * (diff.enemyHpMult || 1) * (waveMods.hpMult || 1)
      );
      unit.hp = unit.maxHp;
      unit.damage = Math.floor(
        unit.baseDamage * grunt.dmg * (diff.waveDmgScaleMult || 1) * (diff.enemyDmgMult || 1)
      );
    } else if (this.isEnemyEvilOperative(unit)) {
      this.applyEvilOperativeWaveScaling(unit, wave);
      unit.maxHp = Math.floor(unit.maxHp * (diff.enemyHpMult || 1) * (waveMods.hpMult || 1));
      unit.hp = unit.maxHp;
      unit.damage = Math.floor(
        unit.damage * (diff.waveDmgScaleMult || 1) * (diff.enemyDmgMult || 1)
      );
    } else {
      unit.maxHp = Math.floor(
        unit.maxHp *
          (waveMods.hpMult || 1) *
          (cfg.hpScale || 1) *
          (diff.waveHpScaleMult || 1) *
          (diff.enemyHpMult || 1)
      );
      unit.hp = unit.maxHp;
      unit.damage = Math.floor(
        unit.damage * (cfg.dmgScale || 1) * (diff.waveDmgScaleMult || 1) * (diff.enemyDmgMult || 1)
      );
    }

    unit.accuracy = Math.min(65, unit.accuracy + Math.floor(accProg * 18) + Math.floor(post * 6));

    if (horde) {
      unit.maxHp = Math.floor(unit.maxHp * (horde.hpMult || 1));
      unit.hp = unit.maxHp;
      unit.damage = Math.floor(unit.damage * (horde.dmgMult || 1));
    }
    const eliteTier = typeof ELITE_ENEMIES !== 'undefined' && ELITE_ENEMIES.includes(unit.type);
    if (eliteTier && !this.isEnemyHordeGrunt(unit)) {
      const eliteMult = 1.28 * (diff.eliteChanceMult || 1);
      unit.maxHp = Math.floor(unit.maxHp * eliteMult);
      unit.hp = unit.maxHp;
      unit.damage = Math.floor(unit.damage * (1.18 * (diff.eliteChanceMult || 1)));
      unit.accuracy = Math.min(65, unit.accuracy + 5);
    }
    if (unit.type === 'siege_tower' || unit.type === 'hellmortar_pack') {
      unit.maxHp = Math.floor(unit.maxHp * 1.15);
      unit.hp = unit.maxHp;
    }
    if (unit.isNamedBoss && opts.namedBossScale) {
      const mult = opts.namedBossScale;
      unit.maxHp = Math.floor(unit.maxHp * mult);
      unit.hp = unit.maxHp;
      unit.damage = Math.floor(unit.damage * mult);
      unit.accuracy = Math.min(68, unit.accuracy + Math.floor((mult - 1) * 8));
    }
    if (colony?.hpMult && colony.hpMult !== 1) {
      unit.maxHp = Math.floor(unit.maxHp * colony.hpMult);
      unit.hp = unit.maxHp;
      unit.damage = Math.floor(unit.damage * (colony.dmgMult || 1));
    }
    return unit;
  }

  /** Evolved / Coliseum / Doomslayer scale with wave progression; vanilla troops do not. */
  getIpWaveScale(wave) {
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(wave) : 0;
    return {
      hp: 1 + eased * 1.2 + post * 0.8,
      dmg: 1 + eased * 0.85 + post * 0.55,
    };
  }

  ensureIpBaseStats(unit) {
    if (!unit || unit.isDoomslayer) return;
    if (unit.baseMaxHp == null) unit.baseMaxHp = unit.maxHp;
    if (unit.baseDamage == null) unit.baseDamage = unit.damage || 0;
  }

  applyIpWaveScaling(unit, wave) {
    if (!unit || unit.hp <= 0 || !this.isIpOperative(unit) || unit.isDoomslayer) return false;
    this.ensureIpBaseStats(unit);
    const spawnW = unit.spawnWave ?? wave;
    const tenure = Math.max(0, wave - spawnW);
    const waveS = this.getIpWaveScale(wave);
    const tenS = this.getTenureMult(tenure, 'player');
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
    const newMax = Math.max(1, Math.floor(unit.baseMaxHp * waveS.hp * tenS.hp));
    unit.maxHp = newMax;
    unit.hp = Math.max(1, Math.min(unit.maxHp, Math.floor(unit.maxHp * hpRatio)));
    if (unit.baseDamage > 0) {
      unit.damage = Math.max(1, Math.floor(unit.baseDamage * waveS.dmg * tenS.dmg));
    }
    unit.tenureApplied = tenure;
    unit.ipScaleWave = wave;
    return true;
  }

  /** HUD snapshot for selected-unit tenure / wave scaling. */
  getUnitScalingSnapshot(unit, wave) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return null;
    const spawnW = unit.spawnWave ?? wave;
    const tenure = Math.max(0, wave - spawnW);
    const snap = { tenure, spawnWave: spawnW };

    if (unit.isDoomslayer) {
      snap.kind = 'doomslayer';
      return snap;
    }
    if (this.isIpOperative(unit)) {
      const waveS = this.getIpWaveScale(wave);
      const tenS = this.getTenureMult(tenure, 'player');
      snap.kind = 'ip';
      snap.waveHpPct = Math.round(waveS.hp * 100);
      snap.waveDmgPct = Math.round(waveS.dmg * 100);
      snap.tenureHpPct = Math.round(tenS.hp * 100);
      snap.tenureDmgPct = Math.round(tenS.dmg * 100);
      snap.tenureCapPct = 215;
      snap.tenureDmgCapPct = 175;
      snap.hpPct = Math.round(waveS.hp * tenS.hp * 100);
      snap.dmgPct = Math.round(waveS.dmg * tenS.dmg * 100);
      return snap;
    }
    if (typeof isSpecialistUnit === 'function' && isSpecialistUnit(unit)) {
      const ranks = typeof SPECIALIST_RANKS !== 'undefined' ? SPECIALIST_RANKS[unit.type] : [];
      const rankTier = unit.vetTier || 0;
      const maxRankTier = typeof MAX_VETERAN_TIER !== 'undefined' ? MAX_VETERAN_TIER : 6;
      const rankLabel = ranks[rankTier] || (rankTier ? `Rank ${rankTier}` : 'Unranked');
      const lateDef =
        typeof getSpecialistLateAbilityInfo === 'function'
          ? getSpecialistLateAbilityInfo(unit)
          : null;
      snap.kind = 'specialist';
      snap.rankLabel = rankLabel;
      snap.rankTier = rankTier;
      snap.maxRankTier = maxRankTier;
      snap.rankProgressPct = maxRankTier > 0 ? Math.round((rankTier / maxRankTier) * 100) : 0;
      snap.lateAbilityTier = lateDef?.unlockGoldStars || lateDef?.unlockTier || 3;
      snap.lateAbilityName = lateDef?.name || '';
      snap.lateAbilityUnlocked = !!lateDef?.unlocked;
      snap.lateAbilityGoldStars = lateDef?.goldStarsEarned || 0;
      if (tenure > 0) {
        snap.tenureNote = `Deployed W${spawnW} · ${tenure} wave${tenure > 1 ? 's' : ''} in field`;
      } else {
        snap.tenureNote = `Deployed W${spawnW} · fresh specialist`;
      }
      return snap;
    }
    if (this.isVanillaAlly(unit)) {
      snap.kind = 'vanilla';
      snap.combatPct = Math.round(this.getVanillaObsoleteMult(unit, wave) * 100);
      if (tenure > 0) {
        const tenS = this.getTenureMult(tenure, 'player');
        snap.tenureHpPct = Math.round(tenS.hp * 100);
        snap.tenureDmgPct = Math.round(tenS.dmg * 100);
        snap.tenureCombatBonus = Math.round(Math.min(10, tenure * 0.6));
        snap.tenureCapPct = 215;
        snap.tenureDmgCapPct = 175;
      }
      if (unit.vetTier) snap.vetOffsetPct = Math.round((unit.vetTier || 0) * 14);
      return snap;
    }
    return null;
  }

  /** Vanilla allies fall behind enemy wave scaling unless promoted with TP + research. */
  getVanillaObsoleteMult(unit, wave) {
    if (!this.isVanillaAlly(unit) || unit.isGeneral) return 1;
    const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(wave) : 0;
    const pressure = eased * 0.34 + post * 0.16;
    const offset = (unit.vetTier || 0) * 0.14;
    const tenure = unit.spawnWave != null ? Math.max(0, wave - unit.spawnWave) : 0;
    const tenureOffset = Math.min(0.1, tenure * 0.006);
    return Math.max(0.5, 1 - Math.max(0, pressure - offset - tenureOffset));
  }

  /** Per-wave stat growth for enemies and IP operatives only — vanilla allies never auto-scale. */
  getTenureMult(tenure, team) {
    if (tenure <= 0) return { hp: 1, dmg: 1 };
    const enemy = team === 'enemy';
    const hpRate = enemy ? 0.1 : 0.038;
    const dmgRate = enemy ? 0.072 : 0.028;
    const hpCap = enemy ? 4.2 : 2.15;
    const dmgCap = enemy ? 3.4 : 1.75;
    return {
      hp: Math.min(hpCap, 1 + tenure * hpRate),
      dmg: Math.min(dmgCap, 1 + tenure * dmgRate),
    };
  }

  applyVeteranTenureScaling(units, wave) {
    let enemyBuffed = 0;
    let ipBuffed = 0;
    for (const u of units) {
      if (!u || u.hp <= 0 || u.isDoomslayer) continue;
      if (u.team === 'player') {
        if (this.isIpOperative(u)) {
          if (this.applyIpWaveScaling(u, wave)) ipBuffed++;
        }
        continue;
      }
      if (this.isEnemyHordeGrunt(u)) continue;
      if (this.isEnemyEvilOperative(u)) {
        if (this.applyEvilOperativeWaveScaling(u, wave)) enemyBuffed++;
        continue;
      }
      const spawnW = u.spawnWave ?? wave;
      if (spawnW >= wave) continue;
      const tenure = wave - spawnW;
      const prev = u.tenureApplied || 0;
      if (tenure <= prev) continue;

      const now = this.getTenureMult(tenure, u.team);
      const was = this.getTenureMult(prev, u.team);
      const hpRatio = now.hp / was.hp;
      const dmgRatio = now.dmg / was.dmg;

      if (hpRatio > 1.001) {
        const oldMax = Math.max(1, u.maxHp);
        u.maxHp = Math.max(1, Math.floor(u.maxHp * hpRatio));
        u.hp = Math.max(1, Math.min(u.maxHp, Math.floor(u.hp * (u.maxHp / oldMax))));
      }
      if (dmgRatio > 1.001 && (u.damage || 0) > 0) {
        u.damage = Math.max(1, Math.floor(u.damage * dmgRatio));
      }
      u.tenureApplied = tenure;
      enemyBuffed++;
    }
    return { enemyBuffed, playerBuffed: ipBuffed, ipBuffed };
  }
}

/** Singleton — preserves legacy `GameDepth.method()` API. */
const GameDepth = new GameDepthSystem();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.GameDepth = GameDepth;
