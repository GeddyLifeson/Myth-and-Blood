/**
 * Narrative Thread — the names the line remembers.
 * Soldiers who last long enough become legends, and a legend strengthens everyone who
 * serves after him. Also speaks the opening lines of a run and a few late milestones.
 */
const NarrativeThread = (() => {
  const LONG_WATCH_WAVE = 150;
  const DEEP_SIEGE_WAVE = 400;
  const LAST_LIGHT_WAVE = 500;

  /** Short, field-level lines. No numbers, no system names: this is what the watch sees. */
  const SIEGE_BEATS = {
    1: {
      title: 'The Watch Fire',
      hook: 'The watch fire is lit. North of it, nothing answers.',
      sub: 'Learn their names while you can. The line remembers the ones who last.',
    },
    150: {
      title: 'The Long Watch',
      hook: 'Nobody on the wall remembers the first dawn. The names are still read each night.',
      sub: 'The dead are spoken of as if they stood here. Some nights it feels as if they do.',
    },
    400: {
      title: 'The Deep Siege',
      hook: 'The ground is more bone than soil now. The line stands on what it has killed.',
      sub: 'Old names are cut into every shield. The young ones touch them before the horn.',
    },
    500: {
      title: 'Last Light',
      hook: 'The north has no end. Neither, it seems, does the watch.',
      sub: 'Every name kept is a blade lent to the living.',
    },
  };

  const LEGEND_KINDS = {
    honored: {
      id: 'honored',
      label: 'Named',
      short: 'Honored',
      power: 1.35,
      desc: 'Given a name by the line. The rest stand straighter for it.',
    },
    champion: {
      id: 'champion',
      label: 'Old Blood',
      short: 'Old Blood',
      power: 1.15,
      desc: 'A veteran who would not die. Every rank is harder for watching him.',
    },
    mythic: {
      id: 'mythic',
      label: 'Sworn Champion',
      short: 'Champion',
      power: 1.45,
      desc: 'A champion from outside the realm, sworn to this line.',
    },
    ascended: {
      id: 'ascended',
      label: 'Beyond the Grave',
      short: 'Unburied',
      power: 1.55,
      desc: 'Past dying. The watch counts him among its dead and its living both.',
    },
  };

  let state = null;
  const beatsShown = new Set();

  function defaultState() {
    return {
      crownEpithet: 'the line',
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
      if (snap?.leadingLabel) return `the line of ${snap.leadingLabel}`;
    }
    return 'the line';
  }

  function tickEra(wave) {
    if (!state) return;
    if (wave >= LAST_LIGHT_WAVE) state.era = 'apex';
    else if (wave >= DEEP_SIEGE_WAVE) state.era = 'deep';
    else if (wave >= LONG_WATCH_WAVE) state.era = 'long_watch';
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
    const msg = `A name for the wall: ${entry.label} (${def?.short || kind}). ${def?.desc || ''}`;
    state.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 360);
    ctx.addHighlight?.('legend', `${entry.label} — a name the line keeps`);
    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendNarrativeBeat({
        type: 'legend',
        wave,
        title: `Name kept — ${entry.label}`,
        summary: `${entry.label} is cut into the wall as ${def?.label || kind}. Those who serve after fight harder for it.`,
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
    if (wave >= LAST_LIGHT_WAVE) return 1.55;
    if (wave >= DEEP_SIEGE_WAVE) return 1.35;
    if (wave >= LONG_WATCH_WAVE) return 1.2;
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
      note: `${n} name${n > 1 ? 's' : ''} kept`,
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
    const beat = SIEGE_BEATS[wave];
    if (!beat || beatsShown.has(wave)) return;
    beatsShown.add(wave);
    ctx.showMessage?.(`Chronicle — ${beat.hook}`, 440);
    if (beat.sub) ctx.showMessage?.(beat.sub, 400);
    ctx.addHighlight?.('milestone', `${beat.title} — ${state?.crownEpithet || 'the line'}`);
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
    state.crownEpithet = 'the line';
    const beat = SIEGE_BEATS[1];
    ctx.showMessage?.(beat.hook, 480);
    if (beat.sub) ctx.showMessage?.(beat.sub, 420);
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state) resetRun();
    if (ctx.creative) return null;
    tickEra(wave);
    announceEraBeat(wave, ctx);
    if (wave % 25 === 0 || wave === LONG_WATCH_WAVE - 10) {
      scanLegends(ctx.units || [], wave, ctx);
    } else if (wave >= LONG_WATCH_WAVE) {
      scanLegends(ctx.units || [], wave, ctx);
    }
    return getStateSnapshot({ wave });
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    tickEra(wave);
    const mods = getLegendPowerMods(wave);
    return {
      crownEpithet: state?.crownEpithet || 'the line',
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
    if (n <= 0 && wave < 31) return 'The watch';
    if (n <= 0) return 'The watch · no names kept';
    return `The watch · ${n} name${n > 1 ? 's' : ''} kept`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    const n = state?.legends?.length || 0;
    if (n > 0) {
      return `Names kept: ${n}. The line fights harder for its legends.`;
    }
    if (wave >= 31 && wave <= LONG_WATCH_WAVE) {
      return 'No names kept yet. Veterans who last become legends.';
    }
    if (wave > LONG_WATCH_WAVE) {
      return 'The old names are still read at dusk.';
    }
    return '';
  }

  resetRun();

  return {
    LONG_WATCH_WAVE,
    DEEP_SIEGE_WAVE,
    LAST_LIGHT_WAVE,
    resetRun,
    onRunStart,
    onWaveStart,
    onHeroHonored,
    scanLegends,
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
