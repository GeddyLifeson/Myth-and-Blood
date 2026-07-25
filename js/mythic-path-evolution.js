/**
 * Mythic Path Evolution — Crossover
 * Starts locked until a champion arrives — heroes → bloodlines → gods among the stars.
 */
const MythicPathEvolution = (() => {
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;
  const UNLOCK_MIN_SCORE = 6;

  const STAGE_DEFS = {
    medieval: {
      id: 'medieval',
      label: 'Powerful Heroes',
      short: 'Heroes',
      epithet: 'Individual crossover champions — lone heroes who bend battles by presence alone.',
      fantasy: 'One legendary recruit can unlock a path the mortal foundations never imagined.',
    },
    kingdom: {
      id: 'kingdom',
      label: 'Heroic Bloodlines',
      short: 'Bloodlines',
      epithet: 'Heroic bloodlines and pantheons — dynasties echo with dimensional champions.',
      fantasy: 'Named legends become royal bloodlines sworn to the Crown across provinces.',
    },
    galactic: {
      id: 'galactic',
      label: 'Pantheon Ascendant',
      short: 'Pantheon',
      epithet: 'Literal gods and eternal champions lead fleets across the void.',
      fantasy: 'Medieval heroes ascend into god-kings who command armadas by divine right.',
      doctrine: {
        id: 'godblood_armada',
        label: 'Godblood Armada',
        epithet: 'Eternal champions thin enemy waves — orbital frag doctrine obeys living legends.',
      },
    },
  };

  const ACTION_SIGNALS = {
    deploy_crossover: 6,
    deploy_wwe: 5,
    deploy_doomslayer: 7,
    ally_faction: 5,
    template_legend_host: 4,
    edict_heroic_muster: 5,
    recruit_hero_echo: 6,
    narrative_echo: 3,
    decree_pantheon_proclamation: 5,
    fleet_pantheon_armada: 5,
    template_pantheon_armada: 4,
    crisis_honor: 2,
    offensive_invasion: 3,
    defensive_invasion: 3,
  };

  const TIER_THRESHOLDS = [14, 36, 62, 92];
  const ARMADA_THRESHOLDS = [10, 28, 50, 74];

  let state = null;

  function defaultState() {
    return {
      locked: true,
      unlockedAtWave: 0,
      unlockReason: null,
      score: 0,
      legendScore: 0,
      signals: {},
      firstChampion: { captured: false, foundingWave: 0, unitId: null, type: null },
      godbloodArmada: { active: false, tier: 0 },
      log: [],
    };
  }

  function resetRun() {
    state = defaultState();
  }

  function isMythicUnitType(type) {
    if (!type) return false;
    if (type === 'doomslayer_hero') return true;
    if (typeof isWweUnit === 'function' && isWweUnit(type)) return true;
    if (typeof isCrossoverUnit === 'function' && isCrossoverUnit(type)) return true;
    return type.startsWith('xf_');
  }

  function bumpSignal(key, amount = 1) {
    if (!state) return;
    state.signals[key] = (state.signals[key] || 0) + amount;
    state.score += amount;
  }

  function bumpLegend(amount = 1) {
    if (!state) return;
    state.legendScore += amount;
    state.score += Math.floor(amount * 0.5);
    refreshGodbloodArmada();
  }

  function scoreTier(score, thresholds = TIER_THRESHOLDS) {
    let tier = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (score >= thresholds[i]) tier = i + 1;
    }
    return Math.min(4, tier);
  }

  function getMythicScoreFromMedieval() {
    if (typeof FoundationalMedievalLayer === 'undefined') return 0;
    const snap = FoundationalMedievalLayer.getRunSnapshot?.();
    if (!snap) return 0;
    let score = snap.scores?.mythic_alliance || 0;
    if (snap.mythicHeroes) {
      for (const n of Object.values(snap.mythicHeroes)) score += (n || 0) * 3;
    }
    if (snap.factions?.size) score += snap.factions.size * 6;
    return score;
  }

  function canUnlockFromMedieval() {
    return getMythicScoreFromMedieval() >= UNLOCK_MIN_SCORE;
  }

  function unlockPath(wave = 0, reason = 'champion') {
    if (!state || !state.locked) return false;
    state.locked = false;
    state.unlockedAtWave = wave | 0;
    state.unlockReason = reason;
    bumpSignal('path_unlocked', 10);
    state.log.unshift({
      at: Date.now(),
      text: `Mythic Path unlocked at wave ${wave} — ${reason}. Crossover evolution begins.`,
    });
    if (state.log.length > 10) state.log.length = 10;
    return true;
  }

  function isUnlocked() {
    return !!state && !state.locked;
  }

  function isPantheonPathActive(wave = 0) {
    if (!isUnlocked()) return false;
    if ((wave | 0) >= GALACTIC_WAVE && typeof IntergalacticLayer !== 'undefined') {
      if (IntergalacticLayer.getCosmicPathId?.() === 'pantheon_ascendant') return true;
    }
    if ((wave | 0) >= KINGDOM_WAVE && typeof GrandStrategy !== 'undefined') {
      if (GrandStrategy.getKingdomPathId?.() === 'mythic') return true;
    }
    if (typeof TechTreeBranches !== 'undefined' && TechTreeBranches.getRootId?.() === 'mythic') {
      return true;
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const snap = FoundationalMedievalLayer.getRunSnapshot?.();
      if (snap?.leading === 'mythic_alliance') return true;
    }
    if ((state?.score || 0) >= UNLOCK_MIN_SCORE) return true;
    return canUnlockFromMedieval();
  }

  function getCurrentStageId(wave = 0) {
    if ((wave | 0) >= GALACTIC_WAVE) return 'galactic';
    if ((wave | 0) >= KINGDOM_WAVE) return 'kingdom';
    return 'medieval';
  }

  function getStageDef(wave = 0) {
    return STAGE_DEFS[getCurrentStageId(wave)] || STAGE_DEFS.medieval;
  }

  function refreshGodbloodArmada() {
    if (!state) return;
    const wave = state._lastWave || 0;
    const galactic = (wave | 0) >= GALACTIC_WAVE;
    const pantheon =
      typeof IntergalacticLayer !== 'undefined' &&
      IntergalacticLayer.getCosmicPathId?.() === 'pantheon_ascendant';
    const tier = scoreTier(state.legendScore, ARMADA_THRESHOLDS);
    state.godbloodArmada.tier = tier;
    state.godbloodArmada.active =
      galactic && isPantheonPathActive(wave) && (pantheon || tier >= 1);
  }

  function isChampionUnlockReason(reason) {
    return (
      reason === 'champion' ||
      reason === 'crossover champion' ||
      reason === 'first champion' ||
      reason === 'hero echo' ||
      reason === 'dimensional alliance'
    );
  }

  function tryUnlock(wave = 0, reason = 'champion') {
    if (!state?.locked) return false;
    if (isChampionUnlockReason(reason) || canUnlockFromMedieval()) {
      return unlockPath(wave, reason);
    }
    return false;
  }

  function recordAction(actionKey, detail = {}) {
    if (!state || !isPantheonPathActive(detail.wave || state._lastWave || 0)) return;
    const amount = ACTION_SIGNALS[actionKey];
    if (!amount) return;
    bumpSignal(actionKey, amount);
    if (
      actionKey === 'recruit_hero_echo' ||
      actionKey === 'edict_heroic_muster' ||
      actionKey === 'decree_pantheon_proclamation' ||
      actionKey === 'fleet_pantheon_armada' ||
      actionKey === 'narrative_echo'
    ) {
      bumpLegend(amount);
    }
    if (detail.label) {
      state.log.unshift({ at: Date.now(), text: `${detail.label} → Mythic Path` });
      if (state.log.length > 10) state.log.length = 10;
    }
  }

  function recordDeploy(type, wave = 0) {
    if (!state || !type) return;
    if (!isMythicUnitType(type)) return;
    tryUnlock(wave, 'crossover champion');
    if (!isPantheonPathActive(wave)) return;
    if (type === 'doomslayer_hero') recordAction('deploy_doomslayer', { wave });
    else if (typeof isWweUnit === 'function' && isWweUnit(type)) recordAction('deploy_wwe', { wave });
    else recordAction('deploy_crossover', { wave });
  }

  function recordFaction(factionId, wave = 0) {
    if (!state || !factionId) return;
    tryUnlock(wave, 'dimensional alliance');
    if (!isPantheonPathActive(wave)) return;
    recordAction('ally_faction', { wave, label: factionId });
  }

  function recordHeroEcho(echoId, wave = 0) {
    if (!state) return;
    tryUnlock(wave, 'hero echo');
    if (!isPantheonPathActive(wave)) return;
    recordAction('recruit_hero_echo', { wave, label: echoId || 'Hero echo' });
  }

  function captureFirstChampion(unit, wave = 0) {
    if (!state || !unit || unit.team !== 'player' || !isMythicUnitType(unit.type)) return;
    tryUnlock(wave, 'first champion');
    if (state.firstChampion.captured) return;
    state.firstChampion = {
      captured: true,
      foundingWave: wave | 0,
      unitId: unit.id || null,
      type: unit.type,
    };
    bumpSignal('first_champion', 10);
    bumpLegend(4);
    state.log.unshift({
      at: Date.now(),
      text: `First champion sworn at wave ${wave} — the pantheon remembers their name.`,
    });
    if (state.log.length > 10) state.log.length = 10;
  }

  function getPathTier(wave = 0) {
    if (!isPantheonPathActive(wave)) return 0;
    return scoreTier(state.score);
  }

  function getArmadaTier(wave = 0) {
    if (!isPantheonPathActive(wave)) return 0;
    refreshGodbloodArmada();
    return state.godbloodArmada.active ? state.godbloodArmada.tier : 0;
  }

  function getTacticalMods(wave = 0) {
    if (!isPantheonPathActive(wave)) {
      return { countMult: 1, hpMult: 1, playerDmgMult: 1, eliteSlots: 0, note: '' };
    }
    const tier = getPathTier(wave);
    if (tier <= 0) return { countMult: 1, hpMult: 1, playerDmgMult: 1, eliteSlots: 0, note: '' };
    const stage = getCurrentStageId(wave);
    const mods = {
      countMult: 1,
      hpMult: 1,
      playerDmgMult: 1,
      eliteSlots: 0,
      note: '',
    };
    if (stage === 'medieval') {
      mods.playerDmgMult = 1 + 0.018 * tier;
      mods.eliteSlots = tier >= 2 ? 1 : 0;
    } else if (stage === 'kingdom') {
      mods.playerDmgMult = 1 + 0.024 * tier;
      mods.hpMult = 1 + 0.012 * tier;
      mods.eliteSlots = Math.min(2, Math.floor(tier / 2) + 1);
    } else {
      mods.playerDmgMult = 1 + 0.03 * tier;
      mods.hpMult = 1 + 0.016 * tier;
      mods.countMult = 1 - 0.009 * tier;
      mods.eliteSlots = Math.min(3, tier);
    }
    mods.note = `${STAGE_DEFS[stage].short} T${tier}`;
    return mods;
  }

  function getGodbloodArmadaMods(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isPantheonPathActive(wave)) {
      return { countMult: 1, playerDmgMult: 1, hpMult: 1, eliteSlots: 0, note: '', active: false };
    }
    const tier = getArmadaTier(wave);
    if (tier <= 0 || !ctx.invasionActive) {
      return { countMult: 1, playerDmgMult: 1, hpMult: 1, eliteSlots: 0, note: '', active: false };
    }
    return {
      countMult: 1 - 0.011 * tier,
      playerDmgMult: 1 + 0.026 * tier,
      hpMult: 1 + 0.014 * tier,
      eliteSlots: Math.floor(tier / 2),
      note: STAGE_DEFS.galactic.doctrine.label.toLowerCase(),
      active: true,
      eternalChampion: true,
    };
  }

  function applyChampionUnitBonuses(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || unit.mythicEvolutionApplied) return;
    if (!isPantheonPathActive(wave)) return;

    const isMythic =
      isMythicUnitType(unit.type) ||
      unit.honorName ||
      (unit.vetTier || 0) >= 4 ||
      unit.type === 'knight' ||
      unit.type === 'paladin';
    if (!isMythic) return;

    const tier = getPathTier(wave);
    if (tier <= 0) return;

    const stage = getCurrentStageId(wave);
    const champion = state?.firstChampion?.captured;
    const isFounder = champion && unit.id && unit.id === state.firstChampion.unitId;

    if (champion && isMythicUnitType(unit.type)) {
      const lineage = 1 + 0.02 * tier + (stage === 'galactic' ? 0.028 * tier : 0);
      if (unit.damage) unit.damage = Math.floor(unit.damage * lineage);
      if (unit.maxHp) {
        unit.maxHp = Math.floor(unit.maxHp * (1 + 0.015 * tier));
        unit.hp = Math.min(unit.hp, unit.maxHp);
      }
      unit.championLineage = true;
    }

    if (isFounder) {
      unit.firstChampion = true;
      unit.honorName = unit.honorName || 'First Champion';
    }

    if (stage === 'kingdom' && tier >= 2 && (isMythicUnitType(unit.type) || unit.type === 'knight')) {
      unit.heroicBloodline = true;
      if (unit.morale != null) unit.morale = Math.min(unit.maxMorale || 40, (unit.morale || 0) + tier);
    }

    if (stage === 'galactic' && tier >= 2 && isMythicUnitType(unit.type)) {
      unit.eternalChampion = true;
      unit.pantheonAscendant = true;
      unit.ascensionWeapon = unit.ascensionWeapon || 'Godblood Relic';
      if (unit.cosmicOrbitalStrike == null && unit.wweAbility === 'frag_out') {
        unit.cosmicOrbitalStrike = true;
      }
    }

    unit.mythicEvolutionApplied = true;
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state || ctx.creative) return null;
    state._lastWave = wave | 0;

    if (state.locked && canUnlockFromMedieval()) {
      tryUnlock(wave, 'mythic foundation');
    }
    refreshGodbloodArmada();
    if (!isPantheonPathActive(wave)) return null;

    if ((wave | 0) === state.unlockedAtWave && state.unlockedAtWave > 0) {
      ctx.showMessage?.(
        'Mythic Path unlocked — crossover champions now evolve across every era.',
        400
      );
    }
    if ((wave | 0) === KINGDOM_WAVE) {
      ctx.showMessage?.(
        'Mythic Path — Powerful Heroes ascend into Heroic Bloodlines and sworn pantheons.',
        400
      );
    }
    if ((wave | 0) === GALACTIC_WAVE) {
      const cosmic = typeof IntergalacticLayer !== 'undefined' ? IntergalacticLayer.getCosmicPathId?.() : null;
      if (cosmic === 'pantheon_ascendant') {
        ctx.showMessage?.(
          'Pantheon Ascendant — literal gods and eternal champions now lead fleets across the void.',
          440
        );
        if (state.godbloodArmada.tier >= 1) {
          ctx.showMessage?.(
            `Doctrine unlocked: ${STAGE_DEFS.galactic.doctrine.label} — living legends command orbital war.`,
            420
          );
        }
      }
    }
    return getTacticalMods(wave);
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    state._lastWave = wave;
    refreshGodbloodArmada();
    const stage = getStageDef(wave);
    const chain = [
      STAGE_DEFS.medieval.label,
      STAGE_DEFS.kingdom.label,
      STAGE_DEFS.galactic.label,
    ].join(' → ');
    return {
      locked: !!state?.locked,
      unlockedAtWave: state?.unlockedAtWave || 0,
      unlockReason: state?.unlockReason || null,
      active: isPantheonPathActive(wave),
      stageId: stage.id,
      stageLabel: stage.label,
      stageEpithet: stage.epithet,
      stageFantasy: stage.fantasy,
      tier: getPathTier(wave),
      score: state?.score || 0,
      legendScore: state?.legendScore || 0,
      chain,
      firstChampion: state?.firstChampion ? { ...state.firstChampion } : null,
      godbloodArmada: state?.godbloodArmada ? { ...state.godbloodArmada } : null,
      doctrineLabel: STAGE_DEFS.galactic.doctrine.label,
      doctrineEpithet: STAGE_DEFS.galactic.doctrine.epithet,
      mods: getTacticalMods(wave),
      hudLine: formatHudLine(ctx),
      log: (state?.log || []).slice(0, 6),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!state || state.locked) return 'Mythic 🔒';
    if (!isPantheonPathActive(wave)) return '';
    const stage = getStageDef(wave);
    const tier = getPathTier(wave);
    if (tier <= 0) return 'Champions forming';
    if ((wave | 0) >= GALACTIC_WAVE && getArmadaTier(wave) >= 1) {
      return `Mythic T${tier} · Armada`;
    }
    return `${stage.short} T${tier}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!state || state.locked) return 'Mythic Path locked — field a crossover champion';
    if (!isPantheonPathActive(wave)) return '';
    const tier = getPathTier(wave);
    const parts = [`mythic crossover T${tier}`];
    if (state?.firstChampion?.captured) parts.push('first champion');
    if (getArmadaTier(wave) >= 1) parts.push(STAGE_DEFS.galactic.doctrine.label.toLowerCase());
    return `Mythic Evolution: ${parts.join(', ')}`;
  }

  function renderPanelHtml(ctx = {}) {
    if (!state || state.locked) {
      return `
      <div class="mype-mythic-panel locked">
        <div class="gs-province-head">MYTHIC EVOLUTION — <span style="color:#908070">Locked</span></div>
        <p class="gs-kingdom-desc">The crossover path begins only when a powerful hero joins your banner.</p>
        <p class="gs-mob-hint">Recruit a evolved operative, coliseum champion, or mythic champion to unlock Powerful Heroes → Bloodlines → Pantheon Ascendant.</p>
      </div>`;
    }
    const snap = getStateSnapshot(ctx);
    if (!snap.active && snap.tier <= 0) return '';
    const championLine = snap.firstChampion?.captured
      ? `<p class="gs-synergy-stat">First champion sworn wave <strong>${snap.firstChampion.foundingWave}</strong> — every legend carries their echo.</p>`
      : '<p class="gs-mob-hint">Field your first crossover champion — they will father a pantheon.</p>';
    const doctrineLine =
      snap.godbloodArmada?.active && snap.godbloodArmada.tier > 0
        ? `<p class="gs-synergy-stat"><strong>${snap.doctrineLabel}</strong> T${snap.godbloodArmada.tier} — ${snap.doctrineEpithet}</p>`
        : (ctx.wave | 0) >= GALACTIC_WAVE
          ? '<p class="gs-mob-hint">Hero echoes and pantheon fleets awaken the Godblood Armada.</p>'
          : '';
    const modLine = snap.mods?.note
      ? `<p class="gs-synergy-stat">${snap.mods.note}${snap.mods.playerDmgMult > 1 ? ` · Dmg ×${snap.mods.playerDmgMult.toFixed(2)}` : ''}</p>`
      : '';
    return `
      <div class="mype-mythic-panel">
        <div class="gs-province-head">MYTHIC EVOLUTION — <span style="color:#e8b050">${snap.stageLabel}</span></div>
        <p class="gs-kingdom-desc">${snap.stageEpithet}</p>
        <p class="gs-kingdom-desc"><em>${snap.stageFantasy}</em></p>
        <p class="gs-synergy-stat">Progression <strong>${snap.chain}</strong> · Tier <strong>${snap.tier}</strong>/4 · Unlocked wave <strong>${snap.unlockedAtWave || '—'}</strong></p>
        ${championLine}
        ${doctrineLine}
        ${modLine}
      </div>`;
  }

  function spawnTestPantheon(preset = 'pantheon') {
    if (!state) resetRun();
    state.locked = false;
    state.unlockedAtWave = 5;
    state.unlockReason = 'test';
    state.score = 78;
    state.legendScore = 48;
    state.firstChampion = { captured: true, foundingWave: 5, unitId: 'test-goku', type: 'goku' };
    state.godbloodArmada = { active: true, tier: 3 };
    state._lastWave = GALACTIC_WAVE;
    if (preset === 'locked') {
      state.locked = true;
      state.score = 0;
      state.godbloodArmada = { active: false, tier: 0 };
    }
  }

  return {
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    STAGE_DEFS,
    resetRun,
    isMythicUnitType,
    isUnlocked,
    isPantheonPathActive,
    tryUnlock,
    unlockPath,
    recordAction,
    recordDeploy,
    recordFaction,
    recordHeroEcho,
    captureFirstChampion,
    getPathTier,
    getArmadaTier,
    getTacticalMods,
    getGodbloodArmadaMods,
    applyChampionUnitBonuses,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    renderPanelHtml,
    spawnTestPantheon,
    bootstrapForWave,
  };

  /** Jump-in seed for §7 progression bootstrap. */
  function bootstrapForWave(wave, ctx = {}) {
    const w = wave | 0;
    if (w < 5) spawnTestPantheon('locked');
    else spawnTestPantheon('pantheon');
    if (w < GALACTIC_WAVE && state) {
      state.godbloodArmada = { active: w >= KINGDOM_WAVE, tier: w >= KINGDOM_WAVE ? 2 : 0 };
      state._lastWave = w;
    }
    return { ok: true, path: 'mythic', wave: w, score: state?.score || 0 };
  }
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MythicPathEvolution = MythicPathEvolution;
