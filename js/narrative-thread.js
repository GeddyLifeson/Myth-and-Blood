/**
 * Narrative Thread — the Ancient Crown endures across cosmic time.
 * Early heroes become mythic figures whose legends grant real power.
 */
const NarrativeThread = (() => {
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;
  const APEX_WAVE = 500;

  const CROWN_ERA_BEATS = {
    1: {
      title: 'The Ancient Crown',
      hook: 'The Crown is older than memory — you do not replace the medieval kingdom, you evolve the same realm across cosmic time.',
      sub: 'Every champion you field may become legend. Their deeds will grant real power to those who follow.',
    },
    31: {
      title: 'Kingdom Unbroken',
      hook: 'Wave thirty-one — the realm rises, but it is still the same Crown that held the first outpost.',
      sub: 'Scribes already whisper of heroes whose names may outlive the stars.',
    },
    150: {
      title: 'Succession of Ages',
      hook: 'Grand Strategy opens — not a new empire, but the medieval kingdom stepping into its imperial inheritance.',
      sub: 'Founding champions canonized in the chronicle now echo through edict, army, and fleet.',
    },
    400: {
      title: 'Cosmic Inheritance',
      hook: 'The galactic era begins — wizard-kings and honor legions inherit one unbroken Crown.',
      sub: 'Mythic figures from the early war grant strength to fleets and veterans light-years from their first stand.',
    },
    500: {
      title: 'Eternal Chronicle',
      hook: 'Apex war — the ancient realm faces the Worldheart Tyrant as a civilization that never fell, only ascended.',
      sub: 'Every legend sworn to the Crown sharpens the whole host.',
    },
  };

  const LEGEND_KINDS = {
    honored: {
      id: 'honored',
      label: 'Crown-Honored',
      short: 'Honored',
      power: 1.35,
      desc: 'Named by the Crown — their devotion becomes doctrine.',
    },
    champion: {
      id: 'champion',
      label: 'Champion of the Host',
      short: 'Champion',
      power: 1.15,
      desc: 'Immortal veteran whose example hardens every rank.',
    },
    mythic: {
      id: 'mythic',
      label: 'Mythic Figure',
      short: 'Mythic',
      power: 1.45,
      desc: 'Crossover champion whose legend breaches eras.',
    },
    ascended: {
      id: 'ascended',
      label: 'Ascended Legend',
      short: 'Ascended',
      power: 1.55,
      desc: 'Ascended beyond mortality — the Crown records them as eternal.',
    },
  };

  let state = null;
  const beatsShown = new Set();

  function defaultState() {
    return {
      crownEpithet: 'the Ancient Crown',
      era: 'founding',
      legends: [],
      legendPower: 0,
      log: [],
    };
  }

  function resetRun() {
    state = defaultState();
    beatsShown.clear();
  }

  function isMythicType(type) {
    if (!type) return false;
    if (type === 'doomslayer_hero') return true;
    if (typeof isWweUnit === 'function' && isWweUnit(type)) return true;
    if (typeof isCrossoverUnit === 'function' && isCrossoverUnit(type)) return true;
    return type.startsWith('xf_');
  }

  function classifyLegend(unit) {
    if (!unit || unit.team !== 'player') return null;
    if (unit.ascensionStageId) return 'ascended';
    if (unit.honorName) return 'honored';
    if (isMythicType(unit.type)) return 'mythic';
    if ((unit.vetTier || 0) >= 4) return 'champion';
    if ((unit.vetTier || 0) >= 3 && unit.foundingWave != null && unit.foundingWave <= 75) {
      return 'champion';
    }
    return null;
  }

  function legendKey(unit) {
    if (unit.honorName) return `honor:${unit.honorName}`;
    if (unit.ascensionStageId) return `asc:${unit.id}:${unit.ascensionStageId}`;
    return `unit:${unit.id}`;
  }

  function legendLabel(unit, kind) {
    if (unit.honorName) return unit.honorName;
    if (unit.ascensionLabel) return unit.ascensionLabel;
    if (typeof getUnitDisplayName === 'function') return getUnitDisplayName(unit);
    return unit.type;
  }

  function resolveCrownEpithet() {
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const snap = FoundationalMedievalLayer.getRunSnapshot?.();
      if (snap?.leadingLabel) return `the Ancient Crown of ${snap.leadingLabel}`;
    }
    if (typeof GrandStrategy !== 'undefined') {
      const path = GrandStrategy.getKingdomEvolutionSnapshot?.();
      if (path?.pathLabel) return `the Ancient Crown — ${path.pathLabel}`;
    }
    return 'the Ancient Crown';
  }

  function tickEra(wave) {
    if (!state) return;
    if (wave >= APEX_WAVE) state.era = 'apex';
    else if (wave >= GALACTIC_WAVE) state.era = 'galactic';
    else if (wave >= KINGDOM_WAVE) state.era = 'kingdom';
    else if (wave >= 31) state.era = 'rising';
    else state.era = 'founding';
    state.crownEpithet = resolveCrownEpithet();
  }

  function recomputeLegendPower() {
    if (!state) return 0;
    let power = 0;
    for (const leg of state.legends) {
      const kind = LEGEND_KINDS[leg.kind];
      power += kind?.power || 1;
    }
    state.legendPower = Math.round(power * 10) / 10;
    return state.legendPower;
  }

  function canonizeLegend(unit, kind, wave, ctx = {}) {
    if (!state || !kind) return null;
    const key = legendKey(unit);
    if (state.legends.some((l) => l.key === key)) return null;
    const def = LEGEND_KINDS[kind];
    const entry = {
      key,
      kind,
      kindLabel: def?.label || kind,
      label: legendLabel(unit, kind),
      unitType: unit.type,
      canonizedWave: wave,
      power: def?.power || 1,
      ascensionStageId: unit.ascensionStageId || null,
    };
    state.legends.unshift(entry);
    recomputeLegendPower();
    const msg = `Mythic figure — ${entry.label} (${def?.short || kind}). ${def?.desc || ''}`;
    state.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 360);
    ctx.addHighlight?.('legend', `${entry.label} — legend of the Crown`);
    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendNarrativeBeat({
        type: 'legend',
        wave,
        title: `Legend Canonized — ${entry.label}`,
        summary: `${entry.label} enters the eternal chronicle as ${def?.label || kind}. Their legend now grants real power to the realm.`,
      });
    }
    return entry;
  }

  function scanLegends(units = [], wave = 0, ctx = {}) {
    if (!state || ctx.creative) return [];
    const added = [];
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      const kind = classifyLegend(u);
      if (!kind) continue;
      const leg = canonizeLegend(u, kind, wave, ctx);
      if (leg) added.push(leg);
    }
    return added;
  }

  function onHeroHonored(unit, wave, ctx = {}) {
    if (!state || !unit?.honorName) return null;
    return canonizeLegend(unit, 'honored', wave, ctx);
  }

  function getEraMult(wave = 0) {
    if (wave >= APEX_WAVE) return 1.55;
    if (wave >= GALACTIC_WAVE) return 1.35;
    if (wave >= KINGDOM_WAVE) return 1.2;
    if (wave >= 31) return 1.08;
    return 1;
  }

  function getLegendPowerMods(wave = 0) {
    if (!state?.legends?.length) {
      return { playerDmgMult: 1, hpMult: 1, morale: 0, scienceGainMult: 1, note: '' };
    }
    const n = state.legends.length;
    const power = state.legendPower || recomputeLegendPower();
    const era = getEraMult(wave);
    const scale = (power / Math.max(n, 1)) * n * 0.01 * era;
    return {
      playerDmgMult: 1 + scale,
      hpMult: 1 + scale * 0.72,
      morale: Math.min(12, Math.floor(n * 0.55 * era)),
      scienceGainMult: 1 + Math.min(0.12, n * 0.008 * era),
      note: `${n} crown legend(s)`,
    };
  }

  function getTacticalMods(wave = 0) {
    const mods = getLegendPowerMods(wave);
    return {
      playerDmgMult: mods.playerDmgMult,
      note: mods.note,
    };
  }

  function applyLegendBonuses(unit, wave = 0) {
    if (!state?.legends?.length || !unit || unit.team !== 'player') return unit;
    if (unit.narrativeThreadApplied) return unit;
    const mods = getLegendPowerMods(wave);
    const matching = state.legends.filter((l) => l.unitType === unit.type);
    const matchBoost = matching.length ? 1 + matching.length * 0.012 : 1;
    if (mods.hpMult > 1) {
      const hpMult = 1 + (mods.hpMult - 1) * matchBoost;
      unit.maxHp = Math.floor(unit.maxHp * hpMult);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    if (mods.playerDmgMult > 1 && unit.damage) {
      const dmgMult = 1 + (mods.playerDmgMult - 1) * matchBoost;
      unit.damage = Math.floor(unit.damage * dmgMult);
    }
    if (mods.morale > 0) {
      unit.morale = Math.min(unit.maxMorale, unit.morale + Math.floor(mods.morale / 3));
    }
    if (matching.length) unit.crownLegend = matching[0].label;
    unit.narrativeThreadApplied = true;
    return unit;
  }

  function getMythicLegendIds() {
    return (state?.legends || [])
      .filter((l) => l.kind === 'mythic' || l.kind === 'honored')
      .map((l) => l.unitType)
      .filter(Boolean);
  }

  function announceEraBeat(wave, ctx = {}) {
    const beat = CROWN_ERA_BEATS[wave];
    if (!beat || beatsShown.has(wave)) return;
    beatsShown.add(wave);
    ctx.showMessage?.(`Chronicle — ${beat.hook}`, 440);
    if (beat.sub) ctx.showMessage?.(beat.sub, 400);
    ctx.addHighlight?.('milestone', `${beat.title} — ${state?.crownEpithet || 'the Ancient Crown'}`);
    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendNarrativeBeat({
        type: 'narrative',
        wave,
        title: beat.title,
        summary: `${beat.hook} ${beat.sub || ''}`.trim(),
      });
    }
  }

  function onRunStart(ctx = {}) {
    resetRun();
    if (ctx.creative) return;
    state.crownEpithet = 'the Ancient Crown';
    const beat = CROWN_ERA_BEATS[1];
    ctx.showMessage?.(beat.hook, 480);
    if (beat.sub) ctx.showMessage?.(beat.sub, 420);
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state) resetRun();
    if (ctx.creative) return null;
    tickEra(wave);
    announceEraBeat(wave, ctx);
    if (wave % 25 === 0 || wave === KINGDOM_WAVE - 10) {
      scanLegends(ctx.units || [], wave, ctx);
    } else if (wave >= KINGDOM_WAVE) {
      scanLegends(ctx.units || [], wave, ctx);
    }
    return getStateSnapshot({ wave });
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    tickEra(wave);
    const mods = getLegendPowerMods(wave);
    return {
      crownEpithet: state?.crownEpithet || 'the Ancient Crown',
      era: state?.era || 'founding',
      legendCount: state?.legends?.length || 0,
      legendPower: state?.legendPower || 0,
      legends: state?.legends || [],
      mods,
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    const n = state?.legends?.length || 0;
    if (n <= 0 && wave < 31) return 'Ancient Crown';
    if (n <= 0) return 'Crown · 0 legends';
    return `Crown · ${n} legend${n > 1 ? 's' : ''}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    const n = state?.legends?.length || 0;
    if (n > 0) {
      return `Crown legends: ${n} mythic figure(s)`;
    }
    if (wave >= 31 && wave <= KINGDOM_WAVE) {
      return 'Ancient Crown — heroes may become legend';
    }
    if (wave > KINGDOM_WAVE) {
      return 'Ancient Crown — legends echo across eras';
    }
    return '';
  }

  resetRun();

  return {
    CROWN_ERA_BEATS,
    LEGEND_KINDS,
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    APEX_WAVE,
    resetRun,
    onRunStart,
    onWaveStart,
    onHeroHonored,
    scanLegends,
    canonizeLegend,
    classifyLegend,
    getLegendPowerMods,
    getTacticalMods,
    applyLegendBonuses,
    getMythicLegendIds,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.NarrativeThread = NarrativeThread;
