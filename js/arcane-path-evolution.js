/**
 * Arcane Path Evolution — "Weavers of Fate"
 * Medieval mages & academies → kingdom ley-weave → galactic reality-warping sorcerers.
 */
const ArcanePathEvolution = (() => {
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;

  const STAGE_DEFS = {
    medieval: {
      id: 'medieval',
      label: 'Mages & Academies',
      short: 'Academies',
      epithet: 'Mages, academies, and enchanted structures anchor scholarch power.',
      fantasy: 'Your first mage will one day rewrite physics on cosmic battlefields.',
    },
    kingdom: {
      id: 'kingdom',
      label: 'Arcane Crown',
      short: 'Arcane Crown',
      epithet: 'Royal mages, ley-line networks, and reality-editing edicts.',
      fantasy: 'Ley grids thread every province — the Crown edits local laws of war.',
    },
    galactic: {
      id: 'galactic',
      label: 'Aether Lords',
      short: 'Aether Lords',
      epithet: 'Aether-tech hybrids and reality-warping fleets — physics obeys the scholarchs.',
      fantasy: 'Early mages become cosmic sorcerers who literally rewrite battlefield physics.',
      doctrine: {
        id: 'arcane_singularity',
        label: 'Arcane Singularity',
        epithet: 'Megastructures collapse enemy waves into singularities of arcane fire.',
      },
    },
  };

  const WEAVER_UNIT_TYPES = new Set(['mage', 'wizard', 'warlock', 'cleric', 'elemental', 'healer']);
  const ARCANE_BUILD_TYPES = new Set([
    'research_lab',
    'academy_mage',
    'academy_healer',
    'mage_tower',
  ]);

  const ACTION_SIGNALS = {
    deploy_mage: 4,
    deploy_wizard: 5,
    deploy_warlock: 5,
    deploy_cleric: 3,
    deploy_healer: 3,
    deploy_elemental: 4,
    build_academy: 5,
    build_research_lab: 6,
    template_arcane_sentinel: 5,
    edict_ley_surge: 5,
    edict_mage_tower_draft: 4,
    edict_reality_edict: 5,
    infra_mage_tower: 5,
    infra_market: 1,
    governor_engineer: 2,
    fleet_aether_host: 4,
    decree_warp_edict: 5,
    offensive_invasion: 4,
    crisis_medicate: 2,
  };

  const TIER_THRESHOLDS = [18, 40, 68, 100];
  const SINGULARITY_THRESHOLDS = [10, 26, 46, 70];

  let state = null;

  function defaultState() {
    return {
      score: 0,
      warpScore: 0,
      signals: {},
      foundingMage: { captured: false, foundingWave: 0, unitId: null },
      singularity: { active: false, tier: 0 },
      log: [],
    };
  }

  function resetRun() {
    state = defaultState();
  }

  function bumpSignal(key, amount = 1) {
    if (!state) return;
    state.signals[key] = (state.signals[key] || 0) + amount;
    state.score += amount;
  }

  function bumpWarp(amount = 1) {
    if (!state) return;
    state.warpScore += amount;
    state.score += Math.floor(amount * 0.5);
    refreshSingularity();
  }

  function scoreTier(score, thresholds = TIER_THRESHOLDS) {
    let tier = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (score >= thresholds[i]) tier = i + 1;
    }
    return Math.min(4, tier);
  }

  function getMageHeavyFromMedieval() {
    if (typeof FoundationalMedievalLayer === 'undefined') return false;
    const run = FoundationalMedievalLayer.getRunSnapshot?.();
    if (!run?.deploys && !run?.scores) return false;
    const mage =
      (run.deploys?.mage || 0) +
      (run.deploys?.wizard || 0) +
      (run.deploys?.warlock || 0) +
      (run.deploys?.cleric || 0) +
      (run.deploys?.healer || 0);
    const martial =
      (run.deploys?.footman || 0) + (run.deploys?.archer || 0) + (run.deploys?.knight || 0);
    if (mage > martial) return true;
    return (run.scores?.arcane_dominion || 0) >= (run.scores?.longbow_legacy || 0);
  }

  function isWeaverPathActive(wave = 0) {
    if ((wave | 0) >= GALACTIC_WAVE && typeof IntergalacticLayer !== 'undefined') {
      if (IntergalacticLayer.getCosmicPathId?.() === 'aether_lords') return true;
    }
    if ((wave | 0) >= KINGDOM_WAVE && typeof GrandStrategy !== 'undefined') {
      if (GrandStrategy.getKingdomPathId?.() === 'arcane') return true;
    }
    if (typeof TechTreeBranches !== 'undefined' && TechTreeBranches.getRootId?.() === 'arcane') {
      return true;
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const run = FoundationalMedievalLayer.getRunSnapshot?.();
      if (run?.leading === 'arcane_dominion') return true;
    }
    return getMageHeavyFromMedieval();
  }

  function getCurrentStageId(wave = 0) {
    if ((wave | 0) >= GALACTIC_WAVE) return 'galactic';
    if ((wave | 0) >= KINGDOM_WAVE) return 'kingdom';
    return 'medieval';
  }

  function getStageDef(wave = 0) {
    return STAGE_DEFS[getCurrentStageId(wave)] || STAGE_DEFS.medieval;
  }

  function refreshSingularity() {
    if (!state) return;
    const wave = state._lastWave || 0;
    const galactic = (wave | 0) >= GALACTIC_WAVE;
    const aetherLords =
      typeof IntergalacticLayer !== 'undefined' &&
      IntergalacticLayer.getCosmicPathId?.() === 'aether_lords';
    const tier = scoreTier(state.warpScore, SINGULARITY_THRESHOLDS);
    state.singularity.tier = tier;
    state.singularity.active = galactic && isWeaverPathActive(wave) && (aetherLords || tier >= 1);
  }

  function recordAction(actionKey, detail = {}) {
    if (!state || !isWeaverPathActive(detail.wave || state._lastWave || 0)) return;
    const amount = ACTION_SIGNALS[actionKey];
    if (!amount) return;
    bumpSignal(actionKey, amount);
    if (
      actionKey === 'edict_ley_surge' ||
      actionKey === 'edict_reality_edict' ||
      actionKey === 'decree_warp_edict' ||
      actionKey === 'fleet_aether_host' ||
      actionKey === 'offensive_invasion' ||
      actionKey === 'template_arcane_sentinel'
    ) {
      bumpWarp(amount);
    }
    if (detail.label) {
      state.log.unshift({ at: Date.now(), text: `${detail.label} → Weavers of Fate` });
      if (state.log.length > 10) state.log.length = 10;
    }
  }

  function recordDeploy(type, wave = 0) {
    if (!state || !type || !isWeaverPathActive(wave)) return;
    if (type === 'mage') recordAction('deploy_mage', { wave });
    else if (type === 'wizard') recordAction('deploy_wizard', { wave });
    else if (type === 'warlock') recordAction('deploy_warlock', { wave });
    else if (type === 'cleric') recordAction('deploy_cleric', { wave });
    else if (type === 'healer') recordAction('deploy_healer', { wave });
    else if (type === 'elemental') recordAction('deploy_elemental', { wave });
  }

  function recordBuild(buildType, wave = 0) {
    if (!state || !buildType || !isWeaverPathActive(wave)) return;
    if (buildType === 'research_lab') recordAction('build_research_lab', { wave, label: 'Research Lab' });
    else if (ARCANE_BUILD_TYPES.has(buildType) || buildType.includes('academy')) {
      recordAction('build_academy', { wave, label: 'Enchanted academy' });
    }
  }

  function captureFoundingMage(unit, wave = 0) {
    if (!state || !unit || unit.team !== 'player' || !WEAVER_UNIT_TYPES.has(unit.type)) return;
    if (state.foundingMage.captured) return;
    if (unit.type === 'healer' && (state.score || 0) < 10) return;
    state.foundingMage = {
      captured: true,
      foundingWave: wave | 0,
      unitId: unit.id || null,
      type: unit.type,
    };
    bumpSignal('founding_mage', 8);
    state.log.unshift({
      at: Date.now(),
      text: `Founding mage sworn at wave ${wave} — the Weavers of Fate remember.`,
    });
    if (state.log.length > 10) state.log.length = 10;
  }

  function getPathTier(wave = 0) {
    if (!state || !isWeaverPathActive(wave)) return 0;
    return scoreTier(state.score);
  }

  function getSingularityTier(wave = 0) {
    if (!state || !isWeaverPathActive(wave)) return 0;
    refreshSingularity();
    return state.singularity.active ? state.singularity.tier : 0;
  }

  function getTacticalMods(wave = 0) {
    if (!isWeaverPathActive(wave)) {
      return {
        countMult: 1,
        hpMult: 1,
        playerDmgMult: 1,
        researchSpeedMult: 1,
        scienceGainMult: 1,
        note: '',
      };
    }
    const tier = getPathTier(wave);
    if (tier <= 0) {
      return {
        countMult: 1,
        hpMult: 1,
        playerDmgMult: 1,
        researchSpeedMult: 1,
        scienceGainMult: 1,
        note: '',
      };
    }
    const stage = getCurrentStageId(wave);
    const mods = {
      countMult: 1,
      hpMult: 1,
      playerDmgMult: 1,
      researchSpeedMult: 1,
      scienceGainMult: 1,
      note: '',
    };
    if (stage === 'medieval') {
      mods.playerDmgMult = 1 + 0.014 * tier;
      mods.researchSpeedMult = 1 + 0.012 * tier;
    } else if (stage === 'kingdom') {
      mods.playerDmgMult = 1 + 0.02 * tier;
      mods.researchSpeedMult = 1 + 0.018 * tier;
      mods.scienceGainMult = 1 + 0.012 * tier;
    } else {
      mods.playerDmgMult = 1 + 0.024 * tier;
      mods.researchSpeedMult = 1 + 0.022 * tier;
      mods.scienceGainMult = 1 + 0.016 * tier;
      mods.countMult = 1 - 0.01 * tier;
    }
    mods.note = `${STAGE_DEFS[stage].short} T${tier}`;
    return mods;
  }

  function getSingularityMods(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isWeaverPathActive(wave)) {
      return { countMult: 1, playerDmgMult: 1, intervalMult: 1, note: '', active: false };
    }
    const tier = getSingularityTier(wave);
    if (tier <= 0 || !ctx.invasionActive) {
      return { countMult: 1, playerDmgMult: 1, intervalMult: 1, note: '', active: false };
    }
    return {
      countMult: 1 - 0.012 * tier,
      playerDmgMult: 1 + 0.028 * tier,
      intervalMult: 1 - 0.008 * tier,
      note: STAGE_DEFS.galactic.doctrine.label.toLowerCase(),
      active: true,
      realityWarp: true,
    };
  }

  function applyWeaverUnitBonuses(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || unit.weaverEvolutionApplied) return;
    if (!isWeaverPathActive(wave)) return;
    if (!WEAVER_UNIT_TYPES.has(unit.type)) return;

    const tier = getPathTier(wave);
    if (tier <= 0) return;

    const stage = getCurrentStageId(wave);
    const founder = state?.foundingMage?.captured;
    const isFounder = founder && unit.id && unit.id === state.foundingMage.unitId;

    if (founder) {
      const lineage = 1 + 0.018 * tier + (stage === 'galactic' ? 0.025 * tier : 0);
      if (unit.damage) unit.damage = Math.floor(unit.damage * lineage);
      if (unit.range) unit.range = Math.floor(unit.range + 2 * tier);
      unit.weaverLineage = true;
    }

    if (isFounder) {
      unit.weaverFounder = true;
      unit.honorName = unit.honorName || 'Fate-Weaver';
    }

    if (stage === 'kingdom' && tier >= 2) {
      unit.leyAttuned = true;
      if (unit.damage) unit.damage = Math.floor(unit.damage * (1 + 0.01 * tier));
    }

    if (stage === 'galactic' && tier >= 2) {
      unit.physicsRewrite = true;
      unit.realityWarp = true;
      unit.ascensionWeapon = unit.ascensionWeapon || 'Singularity Scepter';
      if (unit.range) unit.range = Math.floor(unit.range + 4 * tier);
      if (unit.damage) unit.damage = Math.floor(unit.damage * (1 + 0.015 * tier));
    }

    unit.weaverEvolutionApplied = true;
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state || ctx.creative) return null;
    state._lastWave = wave | 0;
    refreshSingularity();
    if (!isWeaverPathActive(wave)) return null;

    if ((wave | 0) === KINGDOM_WAVE && getMageHeavyFromMedieval()) {
      ctx.showMessage?.(
        'Arcane Path — Mages & Academies ascend into the Arcane Crown: ley-lines and reality-editing edicts.',
        400
      );
    }
    if ((wave | 0) === GALACTIC_WAVE) {
      const cosmic = typeof IntergalacticLayer !== 'undefined' ? IntergalacticLayer.getCosmicPathId?.() : null;
      if (cosmic === 'aether_lords') {
        ctx.showMessage?.(
          'Weavers of Fate ascend — early mages become cosmic sorcerers rewriting physics among the stars.',
          440
        );
        if (state.singularity.tier >= 1) {
          ctx.showMessage?.(
            `Doctrine unlocked: ${STAGE_DEFS.galactic.doctrine.label} — megastructures warp entire battlefields.`,
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
    refreshSingularity();
    const stage = getStageDef(wave);
    const chain = [
      STAGE_DEFS.medieval.label,
      STAGE_DEFS.kingdom.label,
      STAGE_DEFS.galactic.label,
    ].join(' → ');
    return {
      active: isWeaverPathActive(wave),
      stageId: stage.id,
      stageLabel: stage.label,
      stageEpithet: stage.epithet,
      stageFantasy: stage.fantasy,
      tier: getPathTier(wave),
      score: state?.score || 0,
      warpScore: state?.warpScore || 0,
      chain,
      foundingMage: state?.foundingMage ? { ...state.foundingMage } : null,
      singularity: state?.singularity ? { ...state.singularity } : null,
      doctrineLabel: STAGE_DEFS.galactic.doctrine.label,
      doctrineEpithet: STAGE_DEFS.galactic.doctrine.epithet,
      mods: getTacticalMods(wave),
      hudLine: formatHudLine(ctx),
      log: (state?.log || []).slice(0, 6),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isWeaverPathActive(wave)) return '';
    const stage = getStageDef(wave);
    const tier = getPathTier(wave);
    if (tier <= 0) return 'Weavers forming';
    if ((wave | 0) >= GALACTIC_WAVE && getSingularityTier(wave) >= 1) {
      return `Weavers T${tier} · Singularity`;
    }
    return `${stage.short} T${tier}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isWeaverPathActive(wave)) return '';
    const tier = getPathTier(wave);
    const parts = [`weavers of fate T${tier}`];
    if (state?.foundingMage?.captured) parts.push('founding mage');
    if (getSingularityTier(wave) >= 1) parts.push(STAGE_DEFS.galactic.doctrine.label.toLowerCase());
    return `Arcane Evolution: ${parts.join(', ')}`;
  }

  function renderPanelHtml(ctx = {}) {
    const snap = getStateSnapshot(ctx);
    if (!snap.active) return '';
    const founderLine = snap.foundingMage?.captured
      ? `<p class="gs-synergy-stat">Founding mage sworn wave <strong>${snap.foundingMage.foundingWave}</strong> — every spell carries their lineage.</p>`
      : '<p class="gs-mob-hint">Field your first mage — they will become a cosmic sorcerer who rewrites physics.</p>';
    const doctrineLine =
      snap.singularity?.active && snap.singularity.tier > 0
        ? `<p class="gs-synergy-stat"><strong>${snap.doctrineLabel}</strong> T${snap.singularity.tier} — ${snap.doctrineEpithet}</p>`
        : (ctx.wave | 0) >= GALACTIC_WAVE
          ? '<p class="gs-mob-hint">Ley edicts and reality-warping fleets awaken the Arcane Singularity.</p>'
          : '';
    const modLine = snap.mods?.note
      ? `<p class="gs-synergy-stat">${snap.mods.note}${snap.mods.playerDmgMult > 1 ? ` · Dmg ×${snap.mods.playerDmgMult.toFixed(2)}` : ''}</p>`
      : '';
    return `
      <div class="ape-weaver-panel">
        <div class="gs-province-head">ARCANE EVOLUTION — <span style="color:#9070f0">${snap.stageLabel}</span></div>
        <p class="gs-kingdom-desc">${snap.stageEpithet}</p>
        <p class="gs-kingdom-desc"><em>${snap.stageFantasy}</em></p>
        <p class="gs-synergy-stat">Progression <strong>${snap.chain}</strong> · Tier <strong>${snap.tier}</strong>/4</p>
        ${founderLine}
        ${doctrineLine}
        ${modLine}
      </div>`;
  }

  function spawnTestWeaver(preset = 'aether_lords') {
    if (!state) resetRun();
    state.score = 88;
    state.warpScore = 52;
    state.foundingMage = { captured: true, foundingWave: 2, unitId: 'test-mage', type: 'mage' };
    state.singularity = { active: true, tier: 3 };
    state._lastWave = GALACTIC_WAVE;
    if (preset === 'medieval') {
      state.score = 28;
      state.warpScore = 6;
      state.singularity = { active: false, tier: 0 };
      state._lastWave = 80;
    }
  }

  /** Jump-in seed for §7 progression bootstrap. */
  function bootstrapForWave(wave, ctx = {}) {
    const w = wave | 0;
    if (w < KINGDOM_WAVE) spawnTestWeaver('medieval');
    else spawnTestWeaver('aether_lords');
    if (w < GALACTIC_WAVE && state) {
      state.singularity = { active: w >= KINGDOM_WAVE, tier: w >= KINGDOM_WAVE ? 2 : 0 };
      state._lastWave = w;
    }
    return { ok: true, path: 'arcane', wave: w, score: state?.score || 0 };
  }

  return {
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    STAGE_DEFS,
    resetRun,
    isWeaverPathActive,
    recordAction,
    recordDeploy,
    recordBuild,
    captureFoundingMage,
    getPathTier,
    getSingularityTier,
    getTacticalMods,
    getSingularityMods,
    applyWeaverUnitBonuses,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    renderPanelHtml,
    spawnTestWeaver,
    bootstrapForWave,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.ArcanePathEvolution = ArcanePathEvolution;
