/**
 * Hybrid Power Fantasy — endgame capstones when medieval DNA stays pure into the stars.
 * Pure Arcane → Wizard-Kings commanding reality-warping fleets.
 * Pure Martial → Honor Legion knights in power armor, sword & shield — honor demands it.
 */
const HybridPowerFantasy = (() => {
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;
  const APEX_WAVE = 500;

  const PURE_RATIO_MIN = 1.35;
  const PURE_MYTHIC_MAX = 0;
  const PURE_ARCANE_SHARE_MAX = 0.22;

  const FANTASY_DEFS = {
    wizard_kings: {
      id: 'wizard_kings',
      pathId: 'arcane',
      purityId: 'pure_arcane',
      label: 'Wizard-Kings of the Void',
      short: 'Wizard-Kings',
      color: '#a080ff',
      motto: 'Reality bends to the crown.',
      desc: 'A fully magic-focused playthrough culminates in scholarch sovereigns commanding reality-warping fleets.',
      fleetLabel: 'Reality-Warping Armada',
      honorQuote: null,
      unitTypes: new Set(['mage', 'wizard', 'warlock', 'cleric', 'elemental', 'healer']),
      fleetCountReliefPerTier: 0.014,
      fleetDmgPerTier: 0.04,
      playerDmgPerTier: 0.035,
      rangeBonusPerTier: 4,
    },
    honor_legion: {
      id: 'honor_legion',
      pathId: 'martial',
      purityId: 'pure_martial',
      label: 'Honor Legion',
      short: 'Honor Legion',
      color: '#78c888',
      motto: 'Honor demands the blade.',
      desc: 'A pure medieval martial run ends with hyper-evolved knights in power armor who still fight with sword and shield.',
      fleetLabel: 'Sworn Dread Line',
      honorQuote: 'Power armor, sword and shield — honor demands it.',
      unitTypes: new Set(['knight', 'footman', 'pikeman', 'paladin', 'general', 'ballista']),
      honorMeleeCap: 58,
      hpPerTier: 0.045,
      playerDmgPerTier: 0.038,
      moralePerTier: 2,
    },
  };

  const HONOR_MELEE_TYPES = new Set(['knight', 'footman', 'pikeman', 'paladin', 'general']);

  let state = null;
  let apexAnnounced = false;

  function defaultState() {
    return {
      purity: null,
      fantasyId: null,
      active: false,
      unlockedAtWave: 0,
      tier: 0,
      log: [],
    };
  }

  function resetRun() {
    state = defaultState();
    apexAnnounced = false;
  }

  function getFoundationScores() {
    if (typeof FoundationalMedievalLayer === 'undefined') return null;
    return FoundationalMedievalLayer.getRunSnapshot?.() || null;
  }

  function evaluatePathPurity() {
    const snap = getFoundationScores();
    if (!snap?.scores) return 'mixed';
    const scores = snap.scores;
    const leading = snap.leading;
    if (!leading) return 'mixed';
    const leadScore = scores[leading] || 0;
    const second = Math.max(
      ...Object.entries(scores)
        .filter(([id]) => id !== leading)
        .map(([, v]) => v),
      0
    );
    const ratio = leadScore / Math.max(second, 1);
    const mythicHeroes = snap.mythicHeroes?.length || 0;
    const total = Object.values(scores).reduce((sum, v) => sum + v, 0) || 1;

    if (
      leading === 'arcane_dominion' &&
      ratio >= PURE_RATIO_MIN &&
      mythicHeroes <= PURE_MYTHIC_MAX
    ) {
      return 'pure_arcane';
    }
    if (leading === 'longbow_legacy' && ratio >= PURE_RATIO_MIN && mythicHeroes <= PURE_MYTHIC_MAX) {
      const arcaneShare = (scores.arcane_dominion || 0) / total;
      if (arcaneShare <= PURE_ARCANE_SHARE_MAX) return 'pure_martial';
    }
    return 'mixed';
  }

  function resolveThematicPathId() {
    if (typeof ThematicEraSynergies !== 'undefined') {
      return ThematicEraSynergies.getPathId?.() || ThematicEraSynergies.resolveThematicPath?.();
    }
    if (typeof GrandStrategy !== 'undefined') return GrandStrategy.getKingdomPathId?.();
    const snap = getFoundationScores();
    if (snap?.leading === 'arcane_dominion') return 'arcane';
    if (snap?.leading === 'mythic_alliance') return 'mythic';
    if (snap?.leading === 'longbow_legacy') return 'martial';
    return null;
  }

  function matchFantasyForRun() {
    const purity = state?.purity || evaluatePathPurity();
    const pathId = resolveThematicPathId();
    for (const def of Object.values(FANTASY_DEFS)) {
      if (def.pathId === pathId && def.purityId === purity) return def;
    }
    return null;
  }

  function tickFantasyTier(wave) {
    if (!state?.active) return;
    let tier = 0;
    if (wave >= APEX_WAVE) tier = 1;
    if (wave >= 600) tier = 2;
    if (wave >= 700) tier = 3;
    state.tier = tier;
  }

  function unlockPowerFantasy(wave, ctx = {}) {
    const def = matchFantasyForRun();
    if (!def || state?.active) return null;
    state.purity = evaluatePathPurity();
    state.fantasyId = def.id;
    state.active = true;
    state.unlockedAtWave = wave;
    tickFantasyTier(wave);
    const msg = `Hybrid Power Fantasy — ${def.label}. ${def.desc}`;
    state.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 460);
    ctx.addHighlight?.('milestone', `${def.short} — apex power fantasy`);
    if (def.honorQuote) {
      ctx.showMessage?.(def.honorQuote, 420);
    }
    if (def.id === 'wizard_kings') {
      ctx.showMessage?.(
        `${def.fleetLabel} online — wizard-kings bend reality across the void.`,
        400
      );
    }
    return def;
  }

  function capturePurityAtKingdom(wave) {
    if (!state || state.purity) return;
    state.purity = evaluatePathPurity();
  }

  function getFantasyDef() {
    const id = state?.fantasyId;
    return id ? FANTASY_DEFS[id] : null;
  }

  function isActive(wave = 0) {
    return !!state?.active && (wave | 0) >= APEX_WAVE;
  }

  function getFantasyTier(wave = 0) {
    if (!isActive(wave)) return 0;
    return state?.tier || 0;
  }

  function getFleetMods(wave = 0) {
    const def = getFantasyDef();
    if (!isActive(wave) || !def) {
      return { countMult: 1, fleetDmgMult: 1, fleetReadiness: 0, note: '' };
    }
    const t = getFantasyTier(wave);
    if (t <= 0) return { countMult: 1, fleetDmgMult: 1, fleetReadiness: 0, note: '' };
    if (def.id === 'wizard_kings') {
      return {
        countMult: 1 - (def.fleetCountReliefPerTier || 0) * t,
        fleetDmgMult: 1 + (def.fleetDmgPerTier || 0) * t,
        fleetReadiness: t * 3,
        realityWarp: true,
        note: 'reality-warping fleets',
      };
    }
    if (def.id === 'honor_legion') {
      return {
        countMult: 1,
        fleetDmgMult: 1 + 0.02 * t,
        fleetReadiness: t * 2,
        note: 'sworn dread line',
      };
    }
    return { countMult: 1, fleetDmgMult: 1, fleetReadiness: 0, note: '' };
  }

  function getTacticalMods(wave = 0) {
    const def = getFantasyDef();
    if (!isActive(wave) || !def) return { playerDmgMult: 1, note: '' };
    const t = getFantasyTier(wave);
    if (t <= 0) return { playerDmgMult: 1, note: '' };
    return {
      playerDmgMult: 1 + (def.playerDmgPerTier || 0) * t,
      note: def.short?.toLowerCase() || def.id,
    };
  }

  function applyUnitFantasy(unit, wave = 0) {
    if (unit?.powerFantasyApplied) return unit;
    const def = getFantasyDef();
    if (!isActive(wave) || !def || !unit || unit.team !== 'player' || !def.unitTypes.has(unit.type)) {
      return unit;
    }
    const t = getFantasyTier(wave);
    if (t <= 0) return unit;

    if (def.id === 'wizard_kings') {
      unit.wizardKing = true;
      unit.powerFantasyApplied = true;
      if (unit.damage && def.playerDmgPerTier) {
        unit.damage = Math.floor(unit.damage * (1 + def.playerDmgPerTier * t));
      }
      if (unit.range && def.rangeBonusPerTier) {
        unit.range = Math.floor(unit.range + def.rangeBonusPerTier * t);
      }
      if (!unit.ascensionWeapon) unit.ascensionWeapon = 'Reality Scepter';
      return unit;
    }

    if (def.id === 'honor_legion') {
      unit.honorLegion = true;
      unit.honorPlate = true;
      unit.powerFantasyApplied = true;
      const hpMult = 1 + (def.hpPerTier || 0) * t;
      unit.maxHp = Math.floor(unit.maxHp * hpMult);
      unit.hp = Math.min(unit.hp, unit.maxHp);
      if (unit.damage && def.playerDmgPerTier) {
        unit.damage = Math.floor(unit.damage * (1 + def.playerDmgPerTier * t));
      }
      if (def.moralePerTier) {
        unit.morale = Math.min(unit.maxMorale, unit.morale + def.moralePerTier * t);
      }
      if (HONOR_MELEE_TYPES.has(unit.type)) {
        const cap = def.honorMeleeCap || 58;
        if ((unit.range || 0) > cap) {
          if (unit._honorRangeBefore == null) unit._honorRangeBefore = unit.range;
          unit.range = cap;
          unit.honorMeleeOnly = true;
        }
        unit.ascensionWeapon = unit.ascensionWeapon || 'Honor Blade';
        unit.honorShield = 'Aegis Plate';
      }
      return unit;
    }

    return unit;
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state) resetRun();
    if (ctx.creative) return null;
    if (wave >= KINGDOM_WAVE) capturePurityAtKingdom(wave);
    if (wave >= APEX_WAVE && !state.active) {
      const purity = evaluatePathPurity();
      state.purity = purity;
      const def = matchFantasyForRun();
      if (def) unlockPowerFantasy(wave, ctx);
    }
    if (state.active) tickFantasyTier(wave);
    if (wave === APEX_WAVE && !apexAnnounced && state.active) {
      apexAnnounced = true;
      const def = getFantasyDef();
      if (def?.motto) ctx.addHighlight?.('milestone', def.motto);
    }
    return getStateSnapshot({ wave });
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    const def = getFantasyDef();
    const pending = !state?.active && wave >= KINGDOM_WAVE ? matchFantasyForRun() : null;
    return {
      active: isActive(wave),
      pending: !!pending && wave >= KINGDOM_WAVE && wave < APEX_WAVE,
      pendingLabel: pending?.label || null,
      purity: state?.purity || (wave >= KINGDOM_WAVE ? evaluatePathPurity() : null),
      fantasyId: state?.fantasyId || null,
      fantasyLabel: def?.label || pending?.label || null,
      fantasyDesc: def?.desc || pending?.desc || null,
      fantasyColor: def?.color || pending?.color || null,
      motto: def?.motto || null,
      honorQuote: def?.honorQuote || null,
      fleetLabel: def?.fleetLabel || null,
      tier: getFantasyTier(wave),
      fleet: getFleetMods(wave),
      tactical: getTacticalMods(wave),
      unlockedAtWave: state?.unlockedAtWave || 0,
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    const def = getFantasyDef();
    const pending = !state?.active && wave >= KINGDOM_WAVE ? matchFantasyForRun() : null;
    if (isActive(wave) && def?.label) {
      return `${def.label.split(' ')[0]} T${getFantasyTier(wave)}`;
    }
    if (pending && wave < APEX_WAVE) {
      const purity = state?.purity || evaluatePathPurity();
      return `Apex ${purity === 'pure_arcane' ? 'Arcane' : 'Martial'}?`;
    }
    return '';
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    const def = getFantasyDef();
    const pending = !state?.active && wave >= KINGDOM_WAVE ? matchFantasyForRun() : null;
    if (isActive(wave)) {
      return `Power fantasy: ${def?.label?.toLowerCase() || state?.fantasyId} T${getFantasyTier(wave)}`;
    }
    if (pending && wave >= GALACTIC_WAVE) {
      const purity = state?.purity || evaluatePathPurity();
      return `Pure ${purity?.replace('_', ' ')} — apex fantasy at wave ${APEX_WAVE}`;
    }
    return '';
  }

  resetRun();

  return {
    FANTASY_DEFS,
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    APEX_WAVE,
    resetRun,
    evaluatePathPurity,
    matchFantasyForRun,
    getFantasyDef,
    isActive,
    getFantasyTier,
    getFleetMods,
    getTacticalMods,
    applyUnitFantasy,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.HybridPowerFantasy = HybridPowerFantasy;
