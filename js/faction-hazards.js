/**
 * Faction-themed environmental hazards — scale with territory and host evolution.
 * Goblin plague zones, orc fire pits, void corruption that spreads.
 */
const FactionHazards = (() => {
  const MIN_TERRITORY_TIER = 2;
  const TICK_SPREAD_EVERY = 90;

  const HAZARD_TYPES = {
    goblin_plague: {
      id: 'goblin_plague',
      factionId: 'goblin_hordes',
      drawType: 'plague',
      label: 'Plague Zone',
      slow: 0.58,
      damage: 0.2,
      tickInterval: 48,
      moraleHit: 4,
      radiusBase: 26,
      radiusPerStage: 4,
      damagePerStage: 0.06,
      immuneFaction: 'goblin_hordes',
      affectsEnemy: false,
      color: '#70b848',
      desc: 'Goblin plague — slows march, drains morale, chips HP.',
    },
    orc_fire_pit: {
      id: 'orc_fire_pit',
      factionId: 'orc_warbands',
      drawType: 'fire',
      label: 'Orc Fire Pit',
      slow: 0.94,
      damage: 0.42,
      tickInterval: 42,
      radiusBase: 24,
      radiusPerStage: 5,
      damagePerStage: 0.1,
      immuneFaction: 'orc_warbands',
      affectsEnemy: false,
      color: '#c07048',
      desc: 'Orc war-pyre — burns player troops caught in the ash ring.',
    },
    void_corruption: {
      id: 'void_corruption',
      factionId: 'void_abyssal',
      drawType: 'void',
      label: 'Void Corruption',
      waveMin: 32,
      slow: 0.8,
      damage: 0.26,
      tickInterval: 38,
      radiusBase: 22,
      radiusPerStage: 6,
      damagePerStage: 0.08,
      immuneFaction: 'void_abyssal',
      affectsEnemy: true,
      spreads: true,
      spreadPerWave: 0.35,
      spreadSatelliteChance: 0.4,
      maxRadius: 78,
      tickGrow: 0.04,
      color: '#7040b0',
      desc: 'Void corruption — creeps outward each wave, wounds all non-void units.',
    },
    undead_miasma: {
      id: 'undead_miasma',
      factionId: 'dark_legions',
      drawType: 'miasma',
      label: 'Undead Miasma',
      waveMin: 28,
      slow: 0.72,
      damage: 0.18,
      tickInterval: 44,
      moraleHit: 5,
      radiusBase: 28,
      radiusPerStage: 5,
      damagePerStage: 0.07,
      immuneFaction: 'dark_legions',
      affectsEnemy: false,
      color: '#506878',
      desc: 'Undead miasma — chills morale and saps living troops in the blight.',
    },
    mirror_rift_zone: {
      id: 'mirror_rift_zone',
      factionId: 'mirror_empires',
      drawType: 'rift',
      label: 'Mirror Rift',
      waveMin: 90,
      slow: 0.86,
      damage: 0.32,
      tickInterval: 40,
      radiusBase: 24,
      radiusPerStage: 4,
      damagePerStage: 0.09,
      immuneFaction: 'mirror_empires',
      affectsEnemy: true,
      color: '#80a8c8',
      desc: 'Mirror rift — reflected hostility wounds both armies caught in the tear.',
    },
  };

  const FACTION_HAZARD_MAP = {
    goblin_hordes: 'goblin_plague',
    orc_warbands: 'orc_fire_pit',
    void_abyssal: 'void_corruption',
    dark_legions: 'undead_miasma',
    mirror_empires: 'mirror_rift_zone',
  };
  const FACTION_HAZARD_ORDER = Object.values(FACTION_HAZARD_MAP);
  let spreadMessages = 0;

  function resetRun() {
    spreadMessages = 0;
  }

  function getHazardDef(type) {
    return HAZARD_TYPES[type] || null;
  }

  function getActiveFactions(wave) {
    if (typeof EnemyFactions === 'undefined') return [];
    return EnemyFactions.getActiveFactions(wave);
  }

  function scaleForWave(wave, stage) {
    const academy =
      typeof academyThresholdBlend === 'function' ? academyThresholdBlend(wave) : wave >= 100 ? 1 : 0;
    const rts = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : wave >= 200 ? 1 : 0;
    const w = Math.min(2.25, 1 + (wave || 0) / 120 + academy * 0.22 + rts * 0.35);
    const s = 1 + ((stage || 1) - 1) * 0.18;
    return w * s;
  }

  function pickSpawnPoint(worldW, worldH, rallyY, wave, factionId, rng = Math.random, opts = {}) {
    const northOnly = !!opts.northOnly;
    const northCeiling = northOnly
      ? Math.min(worldH * 0.42, Math.max(80, rallyY - 160))
      : rallyY - 80 + rng() * Math.max(80, rallyY - 120);
    const northFloor = 50;
    let x = 70 + rng() * (worldW - 140);
    let y = Math.max(northFloor, Math.min(worldH - 100, northCeiling - rng() * 40));
    if (factionId === 'void_abyssal') y = Math.min(y, northOnly ? northCeiling : rallyY - 140 + rng() * 80);
    if (factionId === 'goblin_hordes')
      y = Math.min(y, northOnly ? northCeiling : rallyY - 60 + rng() * (rallyY * 0.45));
    if (factionId === 'orc_warbands')
      y = Math.min(y, northOnly ? northCeiling : rallyY - 40 + rng() * (rallyY * 0.55));
    if (northOnly) y = Math.min(y, northCeiling);
    return { x, y };
  }

  function buildHazard(type, faction, wave, worldW, worldH, rallyY, rng = Math.random, opts = {}) {
    const def = HAZARD_TYPES[type];
    if (!def) return null;
    const stage = faction?.currentTier?.stage || faction?.stage || 1;
    const scale = scaleForWave(wave, stage) * (opts.scaleMult ?? 1);
    const spot = pickSpawnPoint(worldW, worldH, rallyY, wave, def.factionId, rng, opts);
    const radius =
      (def.radiusBase + def.radiusPerStage * (stage - 1)) * Math.min(1.35, scale) * (opts.radiusMult ?? 1);
    return {
      type: def.id,
      drawType: def.drawType,
      factionId: def.factionId,
      factionName: faction?.shortName || def.label,
      id: `haz_${def.id}_${Date.now()}_${Math.floor(rng() * 9999)}`,
      x: spot.x,
      y: spot.y,
      radius,
      maxRadius: def.maxRadius || 64,
      damage: (def.damage + (def.damagePerStage || 0) * (stage - 1)) * scale * (opts.damageMult ?? 1),
      slow: def.slow,
      tickInterval: def.tickInterval,
      moraleHit: def.moraleHit || 0,
      spreads: !!def.spreads && !opts.noSpread,
      spreadPerWave: def.spreadPerWave || 0,
      tickGrow: def.tickGrow || 0,
      immuneFaction: def.immuneFaction,
      affectsEnemy: !!def.affectsEnemy,
      stage,
      label: def.label,
      color: def.color,
    };
  }

  function countForFaction(faction, territoryTier, wave, densityMult = 1) {
    const stage = faction?.currentTier?.stage || faction?.stage || 1;
    let n = stage >= 4 ? 2 : 1;
    if (territoryTier >= 4) n += 1;
    if (territoryTier >= 7) n += 1;
    const academyBlend =
      typeof academyThresholdBlend === 'function' ? academyThresholdBlend(wave) : wave >= 100 ? 1 : 0;
    const rtsBlend = typeof rtsMapBlend === 'function' ? rtsMapBlend(wave) : wave >= 200 ? 1 : 0;
    n += Math.round(academyBlend + rtsBlend);
    n = Math.max(0, Math.round(n * densityMult));
    return n;
  }

  function tooCloseToRally(h, rallyY, worldW, opts = {}) {
    if (!opts.excludeNearPlayerRally) return false;
    const clearR = opts.rallyClearRadius ?? 110;
    const rallyX = worldW / 2;
    const dx = h.x - rallyX;
    const dy = h.y - rallyY;
    const minDist = clearR + (h.radius || 0);
    return dx * dx + dy * dy < minDist * minDist;
  }

  /**
   * @param {object} [ctx]
   * @param {number} [ctx.densityMult] — 1 = normal; 0.25–0.4 for conquest night 0
   * @param {boolean} [ctx.northOnly] — keep hazards on enemy half
   * @param {boolean} [ctx.excludeNearPlayerRally] — reject hazards near rally
   * @param {number} [ctx.rallyClearRadius]
   * @param {number} [ctx.maxHazards] — hard cap
   * @param {boolean} [ctx.noFallback] — skip dual plague+fire fallback
   * @param {boolean} [ctx.noSpread]
   */
  function spawnInitial(worldW, worldH, territoryTier, rallyY, wave = 0, ctx = {}) {
    const hazards = [];
    if (territoryTier < MIN_TERRITORY_TIER) return hazards;

    const factions = getActiveFactions(wave);
    const rng = ctx.rng || Math.random;
    const densityMult = ctx.densityMult != null ? ctx.densityMult : 1;
    const maxHazards = ctx.maxHazards != null ? ctx.maxHazards : 99;
    const opts = {
      northOnly: !!ctx.northOnly,
      excludeNearPlayerRally: !!ctx.excludeNearPlayerRally,
      rallyClearRadius: ctx.rallyClearRadius,
      noSpread: !!ctx.noSpread,
      scaleMult: ctx.scaleMult,
      radiusMult: ctx.radiusMult,
      damageMult: ctx.damageMult,
    };

    for (const faction of factions) {
      if (hazards.length >= maxHazards) break;
      const hazardType = FACTION_HAZARD_MAP[faction.id];
      if (!hazardType || !HAZARD_TYPES[hazardType]) continue;
      const waveMin = HAZARD_TYPES[hazardType].waveMin || 0;
      if (wave < waveMin) continue;

      const count = countForFaction(faction, territoryTier, wave, densityMult);
      for (let i = 0; i < count && hazards.length < maxHazards; i++) {
        let placed = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          const h = buildHazard(hazardType, faction, wave, worldW, worldH, rallyY, rng, opts);
          if (h && !tooCloseToRally(h, rallyY, worldW, opts)) {
            placed = h;
            break;
          }
        }
        if (placed) hazards.push(placed);
      }
    }

    if (!hazards.length && territoryTier >= MIN_TERRITORY_TIER && !ctx.noFallback) {
      const fallback = buildHazard(
        'goblin_plague',
        { id: 'goblin_hordes', shortName: 'Goblin', stage: 1 },
        wave,
        worldW,
        worldH,
        rallyY,
        rng,
        opts
      );
      if (fallback && !tooCloseToRally(fallback, rallyY, worldW, opts)) hazards.push(fallback);
      if (hazards.length < maxHazards && densityMult >= 0.5) {
        const fire = buildHazard(
          'orc_fire_pit',
          { id: 'orc_warbands', shortName: 'Orc', stage: 1 },
          wave,
          worldW,
          worldH,
          rallyY,
          rng,
          opts
        );
        if (fire && !tooCloseToRally(fire, rallyY, worldW, opts)) hazards.push(fire);
      }
    }

    return hazards.slice(0, maxHazards);
  }

  function isUnitImmune(unit, hazard) {
    if (!unit || !hazard) return true;
    if (unit.flying) return true;
    if (unit.team === 'player') return false;
    if (!hazard.affectsEnemy && unit.team === 'enemy') return true;
    if (typeof EnemyFactions !== 'undefined' && hazard.immuneFaction) {
      const fid = EnemyFactions.getUnitFaction(unit.type);
      if (fid === hazard.immuneFaction) return true;
    }
    return false;
  }

  function applyToUnit(unit, hazards, spatial) {
    if (!unit || unit.hp <= 0 || unit.flying) return;
    // Preserve ability frost slow (frostTimer) — was wiped every hazard tick.
    const frostFloor =
      (unit.frostTimer || 0) > 0 ? Math.min(1, unit.frostSlow || unit._frostSlow || 0.55) : 1;
    unit.hazardSlow = frostFloor;
    let list = hazards;
    if (spatial?.queryHazardsAtInto && spatial.getMaxHazardRadius?.() > 0) {
      list = spatial.queryHazardsAtInto(unit.x, unit.y, spatial._hazardScratch || []);
    }
    for (const h of list) {
      const dx = unit.x - h.x;
      const dy = unit.y - h.y;
      const r = h.radius || 0;
      if (dx * dx + dy * dy > r * r) continue;
      if (isUnitImmune(unit, h)) continue;

      if (h.slow < 1) unit.hazardSlow = Math.min(unit.hazardSlow, h.slow);

      const tickKey = `hazardTick_${h.id}`;
      const interval = h.tickInterval || 45;
      if ((unit[tickKey] || 0) > 0) {
        unit[tickKey]--;
        continue;
      }

      if (h.damage > 0 && (unit.team === 'player' || (h.affectsEnemy && unit.team === 'enemy'))) {
        const dmg = h.damage;
        if (dmg >= 0.2) {
          unit.hp = Math.max(h.affectsEnemy ? 0 : 1, unit.hp - dmg);
          const label =
            h.type === 'orc_fire_pit'
              ? 'BURN'
              : h.type === 'goblin_plague'
                ? 'PLAGUE'
                : h.type === 'void_corruption'
                  ? 'VOID'
                  : 'HAZARD';
          const color = h.color || '#ff6040';
          if (typeof FloatingText !== 'undefined')
            FloatingText.status(unit.x, unit.y, label, color);
        }
        unit[tickKey] = interval;
      }

      if (h.moraleHit && unit.team === 'player' && unit.morale != null) {
        unit.morale = Math.max(0, unit.morale - h.moraleHit * 0.15);
      }
    }
  }

  function trySatelliteSpread(source, hazards, worldW, worldH, rallyY, rng = Math.random) {
    const def = HAZARD_TYPES.void_corruption;
    const angle = rng() * Math.PI * 2;
    const dist = source.radius * 0.85 + 20 + rng() * 36;
    const x = Math.max(40, Math.min(worldW - 40, source.x + Math.cos(angle) * dist));
    const y = Math.max(40, Math.min(worldH - 80, source.y + Math.sin(angle) * dist));
    if (y > rallyY - 30) return null;
    const overlap = hazards.some((h) => Math.hypot(h.x - x, h.y - y) < h.radius + 18);
    if (overlap) return null;
    return {
      ...source,
      id: `haz_void_spread_${Date.now()}_${Math.floor(rng() * 9999)}`,
      x,
      y,
      radius: Math.max(def.radiusBase * 0.75, source.radius * 0.55),
      maxRadius: def.maxRadius,
      stage: source.stage,
    };
  }

  function onWaveStart(hazards, wave, ctx = {}) {
    if (!hazards?.length && (ctx.territoryTier || 0) < MIN_TERRITORY_TIER)
      return { hazards, spread: 0 };

    const { worldW, worldH, rallyY, territoryTier } = ctx;
    const rng = ctx.rng || Math.random;
    let spread = 0;
    const list = [...(hazards || [])];
    // Optional spawn constraints (e.g. conquest grace nights keep fire north of the rally).
    const spawnOpts = {
      northOnly: !!ctx.northOnly,
      excludeNearPlayerRally: !!ctx.excludeNearPlayerRally,
      rallyClearRadius: ctx.rallyClearRadius,
      noSpread: !!ctx.noSpread,
      scaleMult: ctx.scaleMult,
      radiusMult: ctx.radiusMult,
      damageMult: ctx.damageMult,
    };
    const maxHazards = ctx.maxHazards != null ? ctx.maxHazards : 99;
    const allowTopUp = !ctx.noTopUp;
    const allowSpread = !ctx.noSpread;

    const factions = getActiveFactions(wave);
    if (allowTopUp && list.length < 2 && territoryTier >= MIN_TERRITORY_TIER) {
      for (const f of factions) {
        if (list.length >= maxHazards) break;
        const type = FACTION_HAZARD_ORDER.find((t) => HAZARD_TYPES[t].factionId === f.id);
        if (!type || list.some((h) => h.factionId === f.id)) continue;
        let placed = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          const h = buildHazard(type, f, wave, worldW, worldH, rallyY, rng, spawnOpts);
          if (h && !tooCloseToRally(h, rallyY, worldW, spawnOpts)) {
            placed = h;
            break;
          }
        }
        if (placed) list.push(placed);
      }
    }

    for (const h of list) {
      if (!allowSpread || !h.spreads) continue;
      const def = HAZARD_TYPES.void_corruption;
      const grow = (h.spreadPerWave || def.spreadPerWave || 0.3) * (1 + (h.stage || 1) * 0.08);
      h.radius = Math.min(h.maxRadius || def.maxRadius, h.radius + grow);
      spread++;

      if (rng() < (def.spreadSatelliteChance || 0.35)) {
        const sat = trySatelliteSpread(h, list, worldW, worldH, rallyY, rng);
        if (sat) {
          list.push(sat);
          spread++;
        }
      }
    }

    if (spread > 0 && spreadMessages < 4 && ctx.showMessage) {
      spreadMessages++;
      ctx.showMessage('Void corruption spreads across the northern realm — purge the blight!', 280);
    }

    return { hazards: list, spread };
  }

  function tick(hazards, updateTick, ctx = {}) {
    if (!hazards?.length || updateTick % TICK_SPREAD_EVERY !== 0) return;
    for (const h of hazards) {
      if (!h.spreads || !h.tickGrow) continue;
      h.radius = Math.min(h.maxRadius || 78, h.radius + h.tickGrow);
    }
  }

  /**
   * Mage Arcane Dispel — remove faction hazard zones whose footprint meets the purge radius.
   * @returns {{ purged: number, types: string[] }}
   */
  function dispelInRadius(hazards, x, y, radius) {
    if (!hazards?.length || !Number.isFinite(x) || !Number.isFinite(y)) {
      return { purged: 0, types: [] };
    }
    const r = Math.max(8, radius || 60);
    const types = [];
    let purged = 0;
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      if (!h) continue;
      const hr = h.radius || 0;
      const d = Math.hypot((h.x || 0) - x, (h.y || 0) - y);
      // Full clear if the zone center is inside the purge, or the purge covers most of the zone.
      if (d <= r || d <= hr * 0.55 + r * 0.45) {
        types.push(h.type || h.drawType || 'hazard');
        hazards.splice(i, 1);
        purged++;
      } else if (d < r + hr) {
        // Edge graze: shrink instead of full remove so partial casts still help.
        const next = Math.max(10, hr * 0.45);
        if (next < hr - 2) {
          h.radius = next;
          types.push(`${h.type || 'hazard'}:shrunk`);
          purged += 0.5;
        }
      }
    }
    return { purged: Math.floor(purged), types };
  }

  function getStateSnapshot(hazards, wave, territoryTier) {
    const counts = {};
    for (const h of hazards || []) {
      counts[h.type] = (counts[h.type] || 0) + 1;
    }
    const parts = Object.entries(counts).map(([type, n]) => {
      const def = HAZARD_TYPES[type];
      return `${n}× ${def?.label || type}`;
    });
    const voidSpreading = (hazards || []).some(
      (h) => h.spreads && h.radius > (h.maxRadius || 78) * 0.45
    );
    return {
      active: (hazards || []).length > 0,
      count: (hazards || []).length,
      byType: counts,
      summary: parts.length ? parts.join(' · ') : null,
      voidSpreading,
      territoryMin: MIN_TERRITORY_TIER,
      types: Object.values(HAZARD_TYPES).map((d) => ({
        id: d.id,
        label: d.label,
        factionId: d.factionId,
        desc: d.desc,
        color: d.color,
      })),
    };
  }

  return {
    MIN_TERRITORY_TIER,
    HAZARD_TYPES,
    resetRun,
    getHazardDef,
    spawnInitial,
    applyToUnit,
    onWaveStart,
    tick,
    dispelInRadius,
    getStateSnapshot,
    isUnitImmune,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FactionHazards = FactionHazards;
