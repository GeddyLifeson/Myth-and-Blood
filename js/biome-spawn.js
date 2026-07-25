/**
 * Territory & biome influence on enemy spawn weights and wildlife placement.
 */
const BiomeSpawn = (() => {
  const BIOME_PROFILES = {
    plains: {
      enemyWeightMult: { goblin: 1.12, footman: 1.05, orc: 1.0 },
      wildlifeBias: ['wild_boar'],
      wildlifeMult: 1.0,
      spawnDepth: 0.28,
      countMult: 1.0,
    },
    forest: {
      enemyWeightMult: { archer: 1.18, assassin: 1.12, troll: 1.1, harpy: 1.08 },
      wildlifeBias: ['wild_stalker', 'wild_boar'],
      wildlifeMult: 1.35,
      spawnDepth: 0.48,
      countMult: 1.04,
    },
    mountains: {
      enemyWeightMult: { troll: 1.22, siege_tower: 1.15, berserker: 1.12, war_chief: 1.08 },
      wildlifeBias: ['wild_stalker'],
      wildlifeMult: 0.85,
      spawnDepth: 0.58,
      countMult: 1.08,
    },
    corrupted: {
      enemyWeightMult: { necromancer: 1.28, dark_mage: 1.2, abomination: 1.1 },
      wildlifeBias: ['wild_harpy'],
      wildlifeMult: 0.65,
      spawnDepth: 0.72,
      countMult: 1.12,
    },
    hellscape: {
      enemyWeightMult: { berserker: 1.3, abomination: 1.22, void_stalker: 1.15 },
      wildlifeBias: ['wild_harpy'],
      wildlifeMult: 0.45,
      spawnDepth: 0.82,
      countMult: 1.15,
    },
  };

  function getBiomeAt(x, y, ctx) {
    if (typeof LivingPlanet !== 'undefined') {
      return LivingPlanet.getBiomeAt(x, y, ctx);
    }
    return 'plains';
  }

  function getProfileForBiome(biomeId) {
    return BIOME_PROFILES[biomeId] || BIOME_PROFILES.plains;
  }

  function getSpawnProfileAt(x, y, rawCtx = {}) {
    const biome = getBiomeAt(x, y, rawCtx);
    const profile = getProfileForBiome(biome);
    const tier = rawCtx.territoryTier ?? 0;
    const tierMult = 1 + Math.min(0.2, tier * 0.025);
    return {
      biome,
      ...profile,
      wildlifeMult: profile.wildlifeMult * tierMult,
      countMult: profile.countMult * (1 + Math.min(0.12, tier * 0.015)),
      territoryTier: tier,
    };
  }

  function getDominantProfile(ctx = {}) {
    const { worldW, worldH, rallyY, territoryTier, wave } = ctx;
    if (!worldW || !worldH) return getSpawnProfileAt(0, 0, ctx);

    const samples = [
      { x: worldW * 0.5, y: 40 },
      { x: worldW * 0.25, y: Math.max(60, (rallyY || worldH * 0.7) * 0.35) },
      { x: worldW * 0.75, y: Math.max(60, (rallyY || worldH * 0.7) * 0.35) },
      { x: worldW * 0.5, y: Math.max(80, (rallyY || worldH * 0.7) * 0.2) },
    ];

    const counts = {};
    let totalWild = 0;
    let totalCount = 0;
    for (const s of samples) {
      const p = getSpawnProfileAt(s.x, s.y, { worldW, worldH, rallyY, territoryTier, wave });
      counts[p.biome] = (counts[p.biome] || 0) + 1;
      totalWild += p.wildlifeMult;
      totalCount += p.countMult;
    }

    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'plains';
    const base = getProfileForBiome(dominant);
    const n = samples.length;
    return {
      biome: dominant,
      ...base,
      wildlifeMult: totalWild / n,
      countMult: totalCount / n,
      territoryTier: territoryTier ?? 0,
      blended: true,
    };
  }

  function applyWeightBiases(weights, profile) {
    if (!weights || !profile?.enemyWeightMult) return weights;
    const out = { ...weights };
    for (const [type, mult] of Object.entries(profile.enemyWeightMult)) {
      if (out[type] != null) out[type] = Math.max(0.01, out[type] * mult);
    }
    return out;
  }

  function mergeSpawnWeights(weights, wave, ctx = {}) {
    const profile = getDominantProfile(ctx);
    let merged = applyWeightBiases(weights, profile);

    if (typeof NeutralRelations !== 'undefined' && NeutralRelations.isActive?.(wave)) {
      const wildMult = NeutralRelations.getWildlifeSpawnMult(wave);
      if (wildMult !== 1) {
        merged = { ...merged };
        for (const key of Object.keys(merged)) {
          if (['harpy', 'troll', 'warg_rider'].includes(key)) {
            merged[key] = Math.max(0.01, (merged[key] || 1) * (0.9 + (wildMult - 1) * 0.5));
          }
        }
      }
    }

    return { weights: merged, profile };
  }

  function adjustSpawnCount(count, wave, ctx = {}) {
    const profile = getDominantProfile(ctx);
    let c = Math.max(1, Math.floor(count * (profile.countMult || 1)));
    if (profile.biome === 'corrupted' || profile.biome === 'hellscape') {
      c = Math.max(1, c + Math.floor((ctx.territoryTier || 0) * 0.15));
    }
    return c;
  }

  function biasSpawnPosition(pos, side, worldW, worldH, rawCtx = {}) {
    if (!pos) return pos;
    const profile = getSpawnProfileAt(pos.x, pos.y, {
      ...rawCtx,
      worldW,
      worldH,
    });
    const depth = profile.spawnDepth ?? 0.35;
    const out = { ...pos };

    if (side === 'north' || !side || side === 'default') {
      const targetY = 12 + depth * Math.max(40, (rawCtx.rallyY || worldH * 0.7) * 0.55);
      out.y = out.y * 0.55 + targetY * 0.45;
    } else if (side === 'south') {
      out.y = out.y * 0.7 + (worldH - 24 - depth * 20) * 0.3;
    } else if (side === 'east' || side === 'west') {
      const midY = (rawCtx.rallyY || worldH * 0.65) * (0.35 + depth * 0.4);
      out.y = out.y * 0.6 + midY * 0.4;
    }
    return out;
  }

  function pickWildlifeType(wave, rawCtx = {}, rng = Math.random) {
    const x = rawCtx.worldW ? 40 + rng() * (rawCtx.worldW - 80) : 200;
    const y = rawCtx.rallyY
      ? 50 + rng() * Math.max(80, rawCtx.rallyY - 100)
      : 50 + rng() * 200;
    const profile = getSpawnProfileAt(x, y, rawCtx);
    const bias = profile.wildlifeBias || ['wild_boar'];
    let type = bias[Math.floor(rng() * bias.length)];
    if (wave >= 40 && rng() < 0.25 && profile.biome === 'forest') type = 'wild_treant';
    if (wave >= 25 && profile.biome === 'corrupted' && rng() < 0.35) type = 'wild_harpy';
    return { type, profile };
  }

  function getStateSnapshot(territoryTier, wave, ctx = {}) {
    const profile = getDominantProfile({ ...ctx, territoryTier, wave });
    const def =
      typeof LivingPlanet !== 'undefined' ? LivingPlanet.getBiomeDef(profile.biome) : null;
    return {
      active: (territoryTier || 0) >= 1 || (wave || 0) >= 12,
      biome: profile.biome,
      biomeName: def?.shortName || profile.biome,
      biomeColor: def?.color || '#70a878',
      wildlifeMult: Math.round(profile.wildlifeMult * 100) / 100,
      countMult: Math.round(profile.countMult * 100) / 100,
      spawnDepth: profile.spawnDepth,
      summary: `${def?.shortName || profile.biome} spawns ×${profile.countMult.toFixed(2)}`,
      desc: `Biome ${def?.name || profile.biome} biases enemy types and wildlife density.`,
      profiles: Object.keys(BIOME_PROFILES),
    };
  }

  return {
    BIOME_PROFILES,
    getBiomeAt,
    getSpawnProfileAt,
    getDominantProfile,
    applyWeightBiases,
    mergeSpawnWeights,
    adjustSpawnCount,
    biasSpawnPosition,
    pickWildlifeType,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.BiomeSpawn = BiomeSpawn;
