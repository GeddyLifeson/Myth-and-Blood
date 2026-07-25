/**
 * Living Planet — biomes and regional modifiers that unlock as territory expands.
 * Plains → Forest → Mountains → Corrupted Hellscape.
 */
const LivingPlanet = (() => {
  const FOREST_UNLOCK_TIER = 2;
  const MOUNTAIN_UNLOCK_TIER = 5;
  const CORRUPTED_UNLOCK_TIER = 8;
  const HELLSCAPE_WAVE = 1001;

  const BIOMES = {
    plains: {
      id: 'plains',
      name: 'Plains',
      shortName: 'Plains',
      unlockTier: 0,
      speedMult: 1.05,
      coverBonus: 0,
      damageTakenMult: 1,
      tint: 'rgba(90,120,72,0.08)',
      color: '#6a9860',
      desc: 'Open rally fields — +5% march speed.',
    },
    forest: {
      id: 'forest',
      name: 'Forest Reaches',
      shortName: 'Forest',
      unlockTier: FOREST_UNLOCK_TIER,
      speedMult: 0.88,
      coverBonus: 0.14,
      damageTakenMult: 0.9,
      tint: 'rgba(32,72,38,0.22)',
      color: '#3a7048',
      desc: 'Dense canopy — +14% cover, −12% speed.',
    },
    mountains: {
      id: 'mountains',
      name: 'Mountain Frontier',
      shortName: 'Mountains',
      unlockTier: MOUNTAIN_UNLOCK_TIER,
      speedMult: 0.74,
      coverBonus: 0.08,
      damageTakenMult: 0.78,
      tint: 'rgba(72,68,58,0.28)',
      color: '#8a8478',
      desc: 'High ground — −22% damage taken, −26% speed.',
    },
    corrupted: {
      id: 'corrupted',
      name: 'Corrupted Border',
      shortName: 'Corrupted',
      unlockTier: CORRUPTED_UNLOCK_TIER,
      speedMult: 0.92,
      coverBonus: 0,
      damageTakenMult: 1.1,
      enemyDamageMult: 1.08,
      tint: 'rgba(88,24,48,0.32)',
      color: '#a04058',
      desc: 'Hostile creep — +10% damage taken, enemies hit harder.',
    },
    hellscape: {
      id: 'hellscape',
      name: 'Corrupted Hellscape',
      shortName: 'Hellscape',
      unlockWave: HELLSCAPE_WAVE,
      speedMult: 0.9,
      coverBonus: 0,
      damageTakenMult: 1.15,
      enemyDamageMult: 1.12,
      tint: 'rgba(120,20,60,0.38)',
      color: '#c03050',
      desc: 'Reality thins — brutal attrition, enemy damage surges.',
    },
  };

  const BIOME_ORDER = ['plains', 'forest', 'mountains', 'corrupted', 'hellscape'];
  let announced = { forest: false, mountains: false, corrupted: false, hellscape: false };

  function resetRun() {
    announced = { forest: false, mountains: false, corrupted: false, hellscape: false };
  }

  function buildContext(ctx = {}) {
    const baseW = ctx.baseW ?? (typeof BASE_FIELD_W !== 'undefined' ? BASE_FIELD_W : 400);
    const baseH = ctx.baseH ?? (typeof BASE_FIELD_H !== 'undefined' ? BASE_FIELD_H : 600);
    return {
      worldW: ctx.worldW || baseW,
      worldH: ctx.worldH || baseH,
      baseW,
      baseH,
      territoryTier: ctx.territoryTier ?? 0,
      wave: ctx.wave ?? 0,
      hostileLineY: ctx.hostileLineY ?? null,
    };
  }

  function isBiomeUnlocked(id, territoryTier, wave) {
    const def = BIOMES[id];
    if (!def) return false;
    if (def.unlockWave) return wave >= def.unlockWave;
    return territoryTier >= (def.unlockTier || 0);
  }

  function getUnlockedBiomes(territoryTier, wave, hostileActive = false) {
    return BIOME_ORDER.filter((id) => {
      if (id === 'corrupted') return isBiomeUnlocked(id, territoryTier, wave) || hostileActive;
      return isBiomeUnlocked(id, territoryTier, wave);
    });
  }

  function isInHomeTerritory(x, y, ctx) {
    const sideW = Math.max(0, (ctx.worldW - ctx.baseW) / 2);
    const deepH = Math.max(0, ctx.worldH - ctx.baseH);
    const inCenter = x >= sideW + 8 && x <= ctx.worldW - sideW - 8;
    if (!inCenter) return false;
    if (deepH <= 0) {
      // Fixed battlefield: southern half is home plains; north is frontier biomes.
      return y >= ctx.worldH * 0.55;
    }
    return y >= ctx.baseH - 24;
  }

  function getExpansionDepth(x, y, ctx) {
    const sideW = Math.max(0, (ctx.worldW - ctx.baseW) / 2);
    const deepH = Math.max(0, ctx.worldH - ctx.baseH);
    let depth = 0;
    if (deepH > 8 && y < ctx.baseH) {
      depth = Math.max(depth, 1 - Math.max(0, y) / ctx.baseH);
    } else if (deepH <= 0) {
      // Fixed map: depth rises toward the northern edge (spawn approaches).
      const homeLine = ctx.worldH * 0.55;
      if (y < homeLine) {
        depth = Math.max(depth, 1 - Math.max(0, y) / Math.max(1, homeLine));
      }
    }
    if (sideW > 8) {
      if (x < sideW) depth = Math.max(depth, 1 - Math.max(0, x) / sideW);
      if (x > ctx.worldW - sideW) depth = Math.max(depth, 1 - Math.max(0, ctx.worldW - x) / sideW);
    }
    return Math.max(0, Math.min(1, depth));
  }

  function getBiomeAt(x, y, rawCtx = {}) {
    const ctx = buildContext(rawCtx);
    const { territoryTier, wave, hostileLineY, worldH } = ctx;

    if (wave >= HELLSCAPE_WAVE && y < worldH * 0.46) {
      return 'hellscape';
    }
    if (
      hostileLineY != null &&
      y < hostileLineY + 18 &&
      (isBiomeUnlocked('corrupted', territoryTier, wave) ||
        wave >= (typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200))
    ) {
      return 'corrupted';
    }
    if (isInHomeTerritory(x, y, ctx)) return 'plains';

    const depth = getExpansionDepth(x, y, ctx);
    if (depth < 0.08) return 'plains';

    if (isBiomeUnlocked('mountains', territoryTier, wave) && depth >= 0.52) {
      return 'mountains';
    }
    if (isBiomeUnlocked('forest', territoryTier, wave) && depth >= 0.1) {
      return 'forest';
    }
    return 'plains';
  }

  function getBiomeDef(id) {
    return BIOMES[id] || BIOMES.plains;
  }

  function getModifiersAt(x, y, rawCtx = {}) {
    const id = getBiomeAt(x, y, rawCtx);
    const def = getBiomeDef(id);
    return {
      biome: id,
      name: def.name,
      speedMult: def.speedMult ?? 1,
      coverBonus: def.coverBonus ?? 0,
      damageTakenMult: def.damageTakenMult ?? 1,
      enemyDamageMult: def.enemyDamageMult ?? 1,
    };
  }

  function getRegionBands(rawCtx = {}) {
    const ctx = buildContext(rawCtx);
    const bands = [];
    const pushBand = (y0, y1, biomeId) => {
      const def = getBiomeDef(biomeId);
      if (!def || y1 <= y0) return;
      bands.push({
        y0,
        y1,
        biome: biomeId,
        name: def.name,
        tint: def.tint,
        color: def.color,
      });
    };

    const { worldH, baseH, territoryTier, wave, hostileLineY } = ctx;
    // Fixed battlefield: use vertical bands on the north half instead of expansion strips.
    const expanded = ctx.worldH > ctx.baseH + 4;
    const homeY = Math.max(0, expanded ? ctx.baseH - 24 : ctx.worldH * 0.72);

    if (wave >= HELLSCAPE_WAVE) {
      pushBand(0, worldH * 0.46, 'hellscape');
    }
    if (hostileLineY != null && hostileLineY > 12) {
      const corruptTop = wave >= HELLSCAPE_WAVE ? worldH * 0.46 : 0;
      pushBand(corruptTop, hostileLineY + 18, 'corrupted');
    }

    if (isBiomeUnlocked('mountains', territoryTier, wave)) {
      const mountTop = 0;
      const mountBot = expanded ? ctx.baseH * 0.52 : worldH * 0.28;
      pushBand(mountTop, mountBot, 'mountains');
    }
    if (isBiomeUnlocked('forest', territoryTier, wave)) {
      const forestTop = expanded ? Math.max(0, ctx.baseH * 0.45) : worldH * 0.22;
      const forestBot = homeY;
      pushBand(forestTop, forestBot, 'forest');
    }
    pushBand(homeY, worldH, 'plains');

    const sideW = Math.max(0, (ctx.worldW - ctx.baseW) / 2);
    if (sideW > 8 && isBiomeUnlocked('forest', territoryTier, wave)) {
      bands.push({
        x0: 0,
        x1: sideW,
        y0: 0,
        y1: worldH,
        biome: isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest',
        name: getBiomeDef(
          isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest'
        ).name,
        tint: getBiomeDef(
          isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest'
        ).tint,
        color: getBiomeDef(
          isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest'
        ).color,
        vertical: false,
      });
      bands.push({
        x0: ctx.worldW - sideW,
        x1: ctx.worldW,
        y0: 0,
        y1: worldH,
        biome: isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest',
        name: getBiomeDef(
          isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest'
        ).name,
        tint: getBiomeDef(
          isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest'
        ).tint,
        color: getBiomeDef(
          isBiomeUnlocked('mountains', territoryTier, wave) ? 'mountains' : 'forest'
        ).color,
        vertical: false,
      });
    }

    return bands;
  }

  function onTerritoryExpanded(tier, wave, hooks = {}) {
    const unlocks = [];
    if (tier >= FOREST_UNLOCK_TIER && !announced.forest) {
      announced.forest = true;
      unlocks.push(BIOMES.forest);
    }
    if (tier >= MOUNTAIN_UNLOCK_TIER && !announced.mountains) {
      announced.mountains = true;
      unlocks.push(BIOMES.mountains);
    }
    if (tier >= CORRUPTED_UNLOCK_TIER && !announced.corrupted) {
      announced.corrupted = true;
      unlocks.push(BIOMES.corrupted);
    }
    for (const biome of unlocks) {
      hooks.addHighlight?.('era', biome.name);
      hooks.showMessage?.(`${biome.name} unlocked — ${biome.desc}`, 380);
      hooks.floatingText?.(hooks.worldW / 2, 84, biome.shortName.toUpperCase(), biome.color);
    }
    return unlocks;
  }

  function checkWaveAnnouncement(wave, hooks = {}) {
    if (announced.hellscape || wave !== HELLSCAPE_WAVE) return null;
    announced.hellscape = true;
    const biome = BIOMES.hellscape;
    hooks.addHighlight?.('era', biome.name);
    hooks.showMessage?.(
      `Wave ${HELLSCAPE_WAVE} — ${biome.name} bleeds across the northern realm. ${biome.desc}`,
      440
    );
    hooks.floatingText?.(hooks.worldW / 2, 64, 'HELLSCAPE', biome.color);
    return { wave: HELLSCAPE_WAVE, biome: biome.id };
  }

  function populateBiomeDecor(
    decorations,
    worldW,
    worldH,
    territoryTier,
    rallyY,
    prevW,
    prevH,
    rng = Math.random
  ) {
    if (territoryTier < FOREST_UNLOCK_TIER) return 0;
    const placed = decorations.slice();
    let added = 0;
    const count = 3 + Math.floor(territoryTier * 0.8);
    for (let i = 0; i < count; i++) {
      let x;
      let y;
      let tries = 0;
      do {
        // Prefer newly unlocked bands (all four sides after centered expand).
        const dW = Math.max(0, worldW - prevW);
        const dH = Math.max(0, worldH - prevH);
        const ox = dW / 2;
        const oy = dH / 2;
        const roll = rng();
        if (dH > 24 && roll < 0.3) {
          // north strip
          x = 40 + rng() * (worldW - 80);
          y = 16 + rng() * Math.max(20, oy - 16);
        } else if (dH > 24 && roll < 0.55) {
          // south strip
          x = 40 + rng() * (worldW - 80);
          y = oy + prevH + 12 + rng() * Math.max(20, dH - oy - 16);
        } else if (dW > 24 && roll < 0.78) {
          const left = rng() < 0.5;
          x = left
            ? 12 + rng() * Math.max(12, ox - 16)
            : ox + prevW + 8 + rng() * Math.max(12, dW - ox - 16);
          y = 50 + rng() * Math.max(60, worldH - 100);
        } else if (worldH > prevH && rng() < 0.6) {
          x = 40 + rng() * (worldW - 80);
          y = 40 + rng() * Math.max(40, prevH - 80);
        } else if (worldW > prevW) {
          const side = (worldW - prevW) / 2;
          const left = rng() < 0.5;
          x = left ? 16 + rng() * (side - 24) : worldW - side + 8 + rng() * (side - 24);
          y = 60 + rng() * (worldH - rallyY - 40);
        } else {
          x = 50 + rng() * (worldW - 100);
          y = 50 + rng() * Math.max(60, prevH - 80);
        }
        tries++;
      } while (tries < 24 && y > rallyY - 30);

      const baseW = typeof BASE_FIELD_W !== 'undefined' ? BASE_FIELD_W : 400;
      const baseH = typeof BASE_FIELD_H !== 'undefined' ? BASE_FIELD_H : 600;
      const biome = getBiomeAt(x, y, { worldW, worldH, territoryTier, wave: 0, baseW, baseH });
      const isMountain = biome === 'mountains';
      const type = isMountain ? (rng() < 0.78 ? 'rock' : 'tree') : rng() < 0.82 ? 'tree' : 'rock';
      const radius = type === 'tree' ? 14 : 11;
      const deco = {
        type,
        id: `deco_bio_${Date.now()}_${i}`,
        x,
        y,
        size: type === 'tree' ? 18 + rng() * 12 : 14 + rng() * 8,
        hp: 999,
        blocksMove: true,
        blocksLOS: true,
        cover: type === 'rock' ? (isMountain ? 0.38 : 0.3) : 0.48,
        radius,
      };
      decorations.push(deco);
      placed.push(deco);
      added++;
    }
    return added;
  }

  function getStateSnapshot(territoryTier, wave, rawCtx = {}) {
    const ctx = buildContext({ ...rawCtx, territoryTier, wave });
    const hostileActive = typeof PlanetWarfare !== 'undefined' && PlanetWarfare.isActive(wave);
    const unlocked = getUnlockedBiomes(territoryTier, wave, hostileActive);
    const labels = unlocked.map((id) => BIOMES[id].shortName);
    const bands = getRegionBands(ctx);
    return {
      active: territoryTier > 0 || wave >= HELLSCAPE_WAVE,
      territoryTier,
      wave,
      unlocked,
      unlockedLabels: labels,
      summary: labels.length > 1 ? labels.join(' · ') : labels[0] || 'Plains',
      bands,
      biomes: BIOME_ORDER.filter((id) => unlocked.includes(id)).map((id) => ({
        id,
        ...BIOMES[id],
      })),
      forestUnlockTier: FOREST_UNLOCK_TIER,
      mountainUnlockTier: MOUNTAIN_UNLOCK_TIER,
      hellscapeWave: HELLSCAPE_WAVE,
    };
  }

  return {
    FOREST_UNLOCK_TIER,
    MOUNTAIN_UNLOCK_TIER,
    CORRUPTED_UNLOCK_TIER,
    HELLSCAPE_WAVE,
    BIOMES,
    resetRun,
    isBiomeUnlocked,
    getUnlockedBiomes,
    getBiomeAt,
    getBiomeDef,
    getModifiersAt,
    getRegionBands,
    onTerritoryExpanded,
    checkWaveAnnouncement,
    populateBiomeDecor,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.LivingPlanet = LivingPlanet;
