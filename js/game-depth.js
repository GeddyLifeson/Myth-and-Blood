/**
 * Gameplay depth — economy scaling, aura, morale, threats, hazards.
 */
const GameDepth = (() => {
  const SETTLEMENT_TP_SOFT_CAP = 18;
  const SETTLEMENT_TP_DIMINISH = 0.55;
  const POST_200_TP_WAVE_SCALE = 0.72;
  const POST_100_TP_WAVE_SCALE = 0.88;
  const ACADEMY_HYBRID_WAVES = 5;
  const GENERAL_AURA_RADIUS = 165;
  const LAST_STAND_MAX_ALLIES = 2;
  const LAST_STAND_DMG_BONUS = 0.28;
  const LAST_STAND_MIT_BONUS = 0.22;
  const MORALE_CASCADE_WINDOW = 420;
  const MORALE_CASCADE_THRESHOLD = 3;

  function scaleSettlementTp(raw) {
    if (raw <= SETTLEMENT_TP_SOFT_CAP) return raw;
    const over = raw - SETTLEMENT_TP_SOFT_CAP;
    return SETTLEMENT_TP_SOFT_CAP + over * SETTLEMENT_TP_DIMINISH;
  }

  function waveTpScale(wave) {
    if (wave > 200) return POST_200_TP_WAVE_SCALE;
    if (wave > 100) return POST_100_TP_WAVE_SCALE;
    return 1;
  }

  function isHybridAcademyDeploy() {
    return true;
  }

  function hybridDeployCostMult() {
    return 1;
  }

  function getGeneralAuraBreakdown(gen) {
    if (!gen?.stationedKeep) {
      return { strength: 0, morale: 0, accuracy: 0, meleeDmg: 0, rangedDmg: 0, mitigation: 0, radius: GENERAL_AURA_RADIUS };
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
      radius: GENERAL_AURA_RADIUS,
    };
  }

  function getNightBuildMult(wave, nightTimer, nightPrepTicks) {
    let mult = typeof NIGHT_BUILD_MULT !== 'undefined' ? NIGHT_BUILD_MULT : 1.35;
    if (wave >= 200) mult += 0.08;
    if (wave >= 100) mult += 0.05;
    const urgency = nightTimer > nightPrepTicks * 0.85 ? 0.92 : 1;
    return mult * urgency;
  }

  function countCombatAllies(units) {
    return units.filter(u =>
      u.team === 'player' && u.hp > 0 && !u.fleeing && !u.demoralized &&
      u.type !== 'builder' && u.type !== 'courier' && !u.isGeneral
    ).length;
  }

  function updateLastStand(units) {
    const n = countCombatAllies(units);
    return n > 0 && n <= LAST_STAND_MAX_ALLIES;
  }

  function lastStandDamageMult(active) {
    return active ? 1 + LAST_STAND_DMG_BONUS : 1;
  }

  function lastStandMitBonus(active) {
    return active ? LAST_STAND_MIT_BONUS : 0;
  }

  function recordMoraleCascade(state, broke) {
    if (!broke) return state;
    const now = state.tick || 0;
    const recent = (state.recentBreaks || []).filter(t => now - t < MORALE_CASCADE_WINDOW);
    recent.push(now);
    return { ...state, recentBreaks: recent, cascade: recent.length >= MORALE_CASCADE_THRESHOLD };
  }

  function weightedSpawnSide(sides, spawnIdx) {
    if (sides.length <= 1) return sides[0];
    const newest = sides[sides.length - 1];
    const roll = Math.random();
    if (roll < 0.55) return newest;
    return sides[spawnIdx % sides.length];
  }

  const NAMED_BOSS_ROSTER = [
    { type: 'boss_gorath', name: 'Gorath the Breaker', title: 'Warlord of the Ash March', tagline: 'His axe opens the way for a thousand boots.' },
    { type: 'boss_morwen', name: 'Morwen the Pale', title: 'Queen of the Bone Court', tagline: 'She counts your dead and bills you in ghouls.' },
    { type: 'boss_thokk', name: 'Thokk the Mountain', title: 'Walker of Shattered Gates', tagline: 'Walls crumble when he exhales.' },
    { type: 'boss_grimm', name: 'Grimm Ashborne', title: 'Knight of the Cinder Oath', tagline: 'Steel and flame — nothing else remains.' },
    { type: 'boss_vexis', name: 'Vexis the Hollow', title: 'Shadow That Hungers', tagline: "Your General's heartbeat is his compass." },
    { type: 'boss_karg', name: 'Iron Lord Karg', title: 'Forge-Walker', tagline: 'A walking foundry that wants your hamlets.' },
    { type: 'boss_sylvara', name: 'Sylvara Wyrm-Mother', title: 'Matriarch of the Burning Sky', tagline: 'The horizon is her throat.' },
    { type: 'boss_rotfather', name: 'The Rotfather', title: 'Pustulent Patriarch', tagline: 'Flesh obeys him, even its own.' },
    { type: 'boss_volk', name: 'Dread Marshal Volk', title: 'Hammer of the North Host', tagline: 'Siege engines kneel when he passes.' },
    { type: 'boss_malachar', name: 'Malachar the Eternal', title: 'Voice of the Endless Siege', tagline: 'Wave one hundred was only his rehearsal.' },
  ];

  function isBossWave(wave) {
    return wave >= 10 && wave % 10 === 0;
  }

  function isHordeWave(wave) {
    return wave >= 5 && wave % 5 === 0 && !isBossWave(wave);
  }

  const HORDE_FLAVORS = [
    { label: 'Goblin Tide', tagline: 'A chittering flood — break the wave or drown.' },
    { label: 'Orc Pack', tagline: 'Iron shoulders roll forward in a living ram.' },
    { label: 'Plague Swarm', tagline: 'Teeth and fever — AoE saves lives here.' },
    { label: 'Warg Run', tagline: 'Fast hooves on every flank. Hold the line.' },
    { label: 'Sapper Rush', tagline: 'They sprint for your walls while the mob distracts you.' },
    { label: 'Burrower Surge', tagline: 'The ground ripples — watch your rear.' },
    { label: 'Archer Screen', tagline: 'Cheap arrows darken the sky behind the horde.' },
    { label: 'Mixed Host', tagline: 'Everything the war camp had left — thrown at once.' },
  ];

  function buildHordeSpawnQueue(wave, pool, mods = {}, diff = {}) {
    const cfg = typeof getWaveConfig === 'function' ? getWaveConfig(wave) : { count: 12, interval: 70 };
    const eased = typeof academyProgress === 'function' ? academyProgress(wave) : Math.min(1, wave / 100);
    const post = typeof postAcademyProgress === 'function' ? postAcademyProgress(wave) : 0;

    let count = Math.floor(cfg.count * (1.28 + eased * 0.22 + post * 0.12) * (mods.countMult || 1) * (diff.enemyCountMult || 1));
    if (mods.stealReduction) count = Math.max(8, count - mods.stealReduction);

    const swarm = ['goblin', 'goblin', 'goblin', 'plague_rat', 'plague_rat', 'orc', 'orc'];
    const harass = ['warg_rider', 'orc_archer', 'goblin_sapper', 'goblin_burrower', 'harpy'];
    const unlocked = new Set(pool || []);
    swarm.forEach(t => unlocked.add(t));
    harass.forEach(t => { if (wave >= 6 || t === 'goblin_sapper') unlocked.add(t); });
    if (wave >= 9) unlocked.add('goblin_burrower');
    if (wave >= 6) unlocked.add('harpy', 'plague_rat');

    const pickSwarm = () => {
      const opts = swarm.filter(t => unlocked.has(t));
      return opts[Math.floor(Math.random() * opts.length)] || 'goblin';
    };
    const pickHarass = () => {
      const opts = harass.filter(t => unlocked.has(t));
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

    if (wave >= 40 && !mods.noElites && !diff.forceNoElites && queue.length > 10) {
      const lightElites = ['berserker', 'dark_knight', 'troll'].filter(t => unlocked.has(t));
      if (lightElites.length) {
        queue[Math.floor(Math.random() * queue.length)] = lightElites[Math.floor(Math.random() * lightElites.length)];
      }
    }

    const flavor = HORDE_FLAVORS[(Math.floor(wave / 5) - 1) % HORDE_FLAVORS.length];
    const intervalMult = Math.max(0.48, 0.7 - eased * 0.14 - post * 0.06) * (diff.spawnIntervalMult || 1);
    const hpMult = Math.max(0.82, 0.92 - eased * 0.04);
    const dmgMult = Math.max(0.85, 0.94 - eased * 0.03);

    return {
      queue,
      flavor,
      hasSiege,
      intervalMult,
      hpMult,
      dmgMult,
      count: queue.length,
    };
  }

  function getNamedBossForWave(wave) {
    if (!wave || !isBossWave(wave)) return null;
    const idx = (Math.floor(wave / 10) - 1) % NAMED_BOSS_ROSTER.length;
    const entry = NAMED_BOSS_ROSTER[idx];
    const cycle = Math.floor((wave / 10 - 1) / NAMED_BOSS_ROSTER.length);
    const post = typeof postAcademyProgress === 'function' ? postAcademyProgress(wave) : 0;
    const scale = 1 + cycle * 0.2 + post * 0.35 + Math.max(0, wave - 100) * 0.004;
    return { ...entry, scale, wave };
  }

  function bossWaveComposition(wave, pool) {
    const named = getNamedBossForWave(wave);
    const queue = named ? [named.type] : ['war_chief'];
    queue.push('dark_knight', 'dark_knight', 'berserker', 'necromancer');
    if (wave >= 14) queue.push('sky_drake');
    if (wave >= 10) queue.push('bone_summoner');
    if (wave >= 20) queue.push('abomination');
    if (wave >= 25) queue.push('behemoth');
    if (wave >= 35) queue.push('void_stalker');
    if (wave >= 40) queue.push('iron_colossus');
    if (wave >= 50) queue.push('elder_wyrm');
    const extra = Math.min(4, Math.floor((typeof academyProgress === 'function' ? academyProgress(wave) : wave / 100) * 4));
    for (let i = 0; i < extra; i++) {
      queue.push(pool[Math.floor(Math.random() * pool.length)] || 'orc');
    }
    return queue;
  }

  function pickWaveEvent(wave) {
    if (typeof ContentExpansion !== 'undefined') return ContentExpansion.pickWaveEvent(wave);
    if (wave % 13 === 0) return 'blood_moon';
    if (wave % 17 === 0) return 'supply_caravan';
    if (wave % 23 === 0) return 'siege_push';
    return null;
  }

  function formatWaveIntel(spawnQueue, sides, siege, towerEst) {
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

  function spawnHazards(worldW, worldH, territoryTier, rallyY) {
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

  function applyHazardToUnit(unit, hazards) {
    if (!unit || unit.hp <= 0 || unit.flying) return;
    unit.hazardSlow = 1;
    for (const h of hazards) {
      if (Math.hypot(unit.x - h.x, unit.y - h.y) > h.radius) continue;
      if (h.type === 'swamp') unit.hazardSlow = Math.min(unit.hazardSlow, h.slow);
      if (h.type === 'fire' && unit.team === 'player' && (unit.hazardBurnTick || 0) <= 0) {
        unit.hp = Math.max(1, unit.hp - h.damage);
        unit.hazardBurnTick = 50;
        FloatingText?.status(unit.x, unit.y, 'BURN', '#ff6040');
      }
    }
  }

  function isInsideCastleGroup(unit, buildings, groupId) {
    if (!groupId) return false;
    const keep = buildings.find(b => b.castleGroup === groupId && b.isKeep);
    if (!keep) return false;
    return Math.hypot(unit.x - keep.x, unit.y - keep.y) < CASTLE_COMPOUND_OFFSET + 20;
  }

  function specialistLateAbility(unit) {
    if (!unit || (unit.vetTier || 0) < 4) return null;
    if (unit.type === 'healer') return 'mass_mend';
    if (unit.type === 'builder') return 'rapid_repair';
    if (unit.type === 'courier') return 'twin_dispatch';
    return null;
  }

  /** Per-wave stat growth for units still alive from earlier waves (enemy scaling is stronger). */
  function getTenureMult(tenure, team) {
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

  function applyVeteranTenureScaling(units, wave) {
    let enemyBuffed = 0;
    let playerBuffed = 0;
    for (const u of units) {
      if (!u || u.hp <= 0 || u.isDoomslayer) continue;
      const spawnW = u.spawnWave ?? wave;
      if (spawnW >= wave) continue;
      const tenure = wave - spawnW;
      const prev = u.tenureApplied || 0;
      if (tenure <= prev) continue;

      const now = getTenureMult(tenure, u.team);
      const was = getTenureMult(prev, u.team);
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
      if (u.team === 'enemy') enemyBuffed++;
      else playerBuffed++;
    }
    return { enemyBuffed, playerBuffed };
  }

  return {
    SETTLEMENT_TP_SOFT_CAP, ACADEMY_HYBRID_WAVES, GENERAL_AURA_RADIUS,
    scaleSettlementTp, waveTpScale, isHybridAcademyDeploy, hybridDeployCostMult,
    getGeneralAuraBreakdown, getNightBuildMult,
    updateLastStand, lastStandDamageMult, lastStandMitBonus,
    recordMoraleCascade, weightedSpawnSide, bossWaveComposition, getNamedBossForWave, NAMED_BOSS_ROSTER,
    isBossWave, isHordeWave, buildHordeSpawnQueue, HORDE_FLAVORS,
    formatWaveIntel, spawnHazards, applyHazardToUnit, isInsideCastleGroup,
    specialistLateAbility, countCombatAllies, pickWaveEvent,
    applyVeteranTenureScaling, getTenureMult,
  };
})();