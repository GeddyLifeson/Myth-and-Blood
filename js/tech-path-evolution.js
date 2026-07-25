/**
 * Tech Path Evolution — "The Stellar Foundry"
 * Medieval engineers & quarries → industrial revolution → synthetic ascension among the stars.
 */
const TechPathEvolution = (() => {
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;
  const ROOT_LOCK_WAVE = 50;

  const STAGE_DEFS = {
    medieval: {
      id: 'medieval',
      label: 'Engineers & Quarries',
      short: 'Engineers',
      epithet: 'Early engineers, sappers, ballistae, and quarries — the Crown learns to shape stone and steel.',
      fantasy: 'The first hammer struck at the quarry will echo in every Dyson sphere.',
    },
    kingdom: {
      id: 'kingdom',
      label: 'Industrial Revolution',
      short: 'Industry',
      epithet: 'Automated defenses, gunpowder and steam equivalents — provinces become factory floors.',
      fantasy: 'Steam hisses behind every wall; ballista crews fire with industrial precision.',
    },
    galactic: {
      id: 'galactic',
      label: 'Synthetic Ascension',
      short: 'Synthetic',
      epithet: 'Full synthetic ascension — drone swarms, AI overlords, and Dyson spheres harvest the void.',
      fantasy: 'Builders evolve into machine gods who still honor the first hammer of the medieval quarry.',
      doctrine: {
        id: 'dyson_mandate',
        label: 'Dyson Mandate',
        epithet: 'AI overlords and drone swarms — suns become forges; the first hammer still rings.',
      },
    },
  };

  const TECH_UNIT_TYPES = new Set(['builder', 'sapper', 'ballista', 'scout']);
  const INDUSTRY_BUILD_TYPES = new Set([
    'research_lab',
    'quarry',
    'hamlet',
    'trade_outpost',
    'merchant_guild',
    'village',
    'town',
  ]);

  const ACTION_SIGNALS = {
    deploy_builder: 4,
    deploy_sapper: 4,
    deploy_ballista: 3,
    build_quarry: 7,
    build_research_lab: 5,
    build_industry: 3,
    order_logistics: 3,
    order_fortify: 3,
    infra_market: 2,
    infra_road: 2,
    infra_watchtower: 2,
    governor_engineer: 4,
    template_shield_wall: 3,
    edict_discipline_drill: 2,
    tech_branch_invest: 5,
    tech_root_lock: 8,
    district_generator: 4,
    district_foundry: 6,
    district_research: 4,
    patron_technocrats: 4,
    pop_technocrat: 3,
    pop_industrial: 3,
    decree_trade_league: 3,
    fleet_stellar_foundry: 4,
    offensive_invasion: 3,
    synthetic_ascension: 8,
  };

  const TIER_THRESHOLDS = [16, 38, 64, 96];
  const DYSON_THRESHOLDS = [14, 32, 54, 78];

  let state = null;

  function defaultState() {
    return {
      score: 0,
      industryScore: 0,
      signals: {},
      firstHammer: {
        captured: false,
        quarryWave: 0,
        hammerWave: 0,
        unitId: null,
        quarryStruck: false,
      },
      dysonMandate: { active: false, tier: 0 },
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

  function bumpIndustry(amount = 1) {
    if (!state) return;
    state.industryScore += amount;
    state.score += Math.floor(amount * 0.45);
    refreshDysonMandate();
  }

  function scoreTier(score, thresholds = TIER_THRESHOLDS) {
    let tier = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (score >= thresholds[i]) tier = i + 1;
    }
    return Math.min(4, tier);
  }

  function getEngineerScoreFromMedieval() {
    if (typeof FoundationalMedievalLayer === 'undefined') return 0;
    const snap = FoundationalMedievalLayer.getRunSnapshot?.();
    if (!snap) return 0;
    let score = 0;
    if (snap.builds?.quarry) score += (snap.builds.quarry || 0) * 12;
    if (snap.builds?.research_lab) score += (snap.builds.research_lab || 0) * 8;
    if (snap.deploys?.builder) score += (snap.deploys.builder || 0) * 3;
    if (snap.deploys?.sapper) score += (snap.deploys.sapper || 0) * 4;
    if (snap.deploys?.ballista) score += (snap.deploys.ballista || 0) * 4;
    if (snap.scienceEarned) score += Math.floor(snap.scienceEarned * 0.35);
    return score;
  }

  function isEngineerHeavyFromMedieval() {
    const score = getEngineerScoreFromMedieval();
    if (score < 18) return false;
    if (typeof FoundationalMedievalLayer === 'undefined') return score >= 28;
    const snap = FoundationalMedievalLayer.getRunSnapshot?.();
    const martial =
      (snap?.deploys?.footman || 0) +
      (snap?.deploys?.archer || 0) +
      (snap?.deploys?.knight || 0);
    const arcane =
      (snap?.deploys?.mage || 0) +
      (snap?.deploys?.wizard || 0) +
      (snap?.deploys?.warlock || 0);
    const engineer =
      (snap?.deploys?.builder || 0) +
      (snap?.deploys?.sapper || 0) +
      (snap?.deploys?.ballista || 0) +
      (snap?.builds?.quarry || 0) * 2;
    return engineer >= martial && engineer >= arcane;
  }

  function isFoundryPathActive(wave = 0) {
    if (typeof TechTreeBranches !== 'undefined' && TechTreeBranches.getRootId?.() === 'tech') {
      return true;
    }
    if ((wave | 0) >= KINGDOM_WAVE && typeof EternalPathFramework !== 'undefined') {
      if (EternalPathFramework.getDominantPathId?.() === 'tech') return true;
    }
    if (
      (wave | 0) >= GALACTIC_WAVE &&
      typeof IntergalacticLateBranches !== 'undefined' &&
      IntergalacticLateBranches.getStateSnapshot?.({ wave })?.ascensionId === 'synthetic'
    ) {
      return true;
    }
    return isEngineerHeavyFromMedieval() || getEngineerScoreFromMedieval() >= 30;
  }

  function getCurrentStageId(wave = 0) {
    if ((wave | 0) >= GALACTIC_WAVE) return 'galactic';
    if ((wave | 0) >= KINGDOM_WAVE) return 'kingdom';
    return 'medieval';
  }

  function getStageDef(wave = 0) {
    return STAGE_DEFS[getCurrentStageId(wave)] || STAGE_DEFS.medieval;
  }

  function hasSyntheticAscension(wave = 0) {
    if (typeof IntergalacticLateBranches === 'undefined') return false;
    const snap = IntergalacticLateBranches.getStateSnapshot?.({ wave });
    return snap?.resolved && snap?.ascensionId === 'synthetic';
  }

  function refreshDysonMandate() {
    if (!state) return;
    const wave = state._lastWave || 0;
    const galactic = (wave | 0) >= GALACTIC_WAVE;
    const techRoot =
      typeof TechTreeBranches !== 'undefined' && TechTreeBranches.getRootId?.() === 'tech';
    const tier = scoreTier(state.industryScore, DYSON_THRESHOLDS);
    state.dysonMandate.tier = tier;
    state.dysonMandate.active =
      galactic &&
      isFoundryPathActive(wave) &&
      (techRoot || hasSyntheticAscension(wave) || tier >= 1);
  }

  function recordAction(actionKey, detail = {}) {
    if (!state || !isFoundryPathActive(detail.wave || state._lastWave || 0)) return;
    const amount = ACTION_SIGNALS[actionKey];
    if (!amount) return;
    bumpSignal(actionKey, amount);
    if (
      actionKey === 'build_quarry' ||
      actionKey === 'build_research_lab' ||
      actionKey === 'build_industry' ||
      actionKey === 'district_foundry' ||
      actionKey === 'district_generator' ||
      actionKey === 'tech_branch_invest' ||
      actionKey === 'order_logistics' ||
      actionKey === 'patron_technocrats' ||
      actionKey === 'synthetic_ascension'
    ) {
      bumpIndustry(amount);
    }
    if (detail.label) {
      state.log.unshift({ at: Date.now(), text: `${detail.label} → Stellar Foundry` });
      if (state.log.length > 10) state.log.length = 10;
    }
  }

  function recordDeploy(type, wave = 0) {
    if (!state || !type || !isFoundryPathActive(wave)) return;
    if (type === 'builder') recordAction('deploy_builder', { wave });
    else if (type === 'sapper') recordAction('deploy_sapper', { wave });
    else if (type === 'ballista') recordAction('deploy_ballista', { wave });
  }

  function strikeFirstHammer(wave = 0) {
    if (!state || state.firstHammer.quarryStruck) return;
    state.firstHammer.quarryStruck = true;
    state.firstHammer.quarryWave = wave | 0;
    if (!state.firstHammer.captured) {
      state.firstHammer.captured = true;
      state.firstHammer.hammerWave = wave | 0;
    }
    bumpSignal('first_hammer_quarry', 10);
    state.log.unshift({
      at: Date.now(),
      text: `First hammer struck the quarry at wave ${wave} — machine gods will remember.`,
    });
    if (state.log.length > 10) state.log.length = 10;
  }

  function recordBuild(buildType, wave = 0) {
    if (!state || !buildType || !isFoundryPathActive(wave)) return;
    if (buildType === 'quarry') {
      strikeFirstHammer(wave);
      recordAction('build_quarry', { wave, label: 'Quarry' });
    } else if (buildType === 'research_lab') {
      recordAction('build_research_lab', { wave, label: 'Research Lab' });
    } else if (INDUSTRY_BUILD_TYPES.has(buildType)) {
      recordAction('build_industry', { wave, label: 'Industrial structure' });
    }
  }

  function recordBranchInvest(nodeId, wave = 0) {
    if (!state) return;
    recordAction('tech_branch_invest', { wave, label: nodeId || 'Branch tech' });
    if (typeof TechTreeBranches !== 'undefined' && TechTreeBranches.getRootId?.() === 'tech') {
      bumpIndustry(3);
    }
  }

  function recordRootLock(wave = 0) {
    if (!state) return;
    if (typeof TechTreeBranches !== 'undefined' && TechTreeBranches.getRootId?.() === 'tech') {
      recordAction('tech_root_lock', { wave, label: 'Tech root locked' });
    }
  }

  function recordSyntheticAscension(wave = 0) {
    if (!state) return;
    recordAction('synthetic_ascension', { wave, label: 'Synthetic Ascension' });
    refreshDysonMandate();
  }

  function captureFirstHammer(unit, wave = 0) {
    if (!state || !unit || unit.team !== 'player') return;
    if (unit.type !== 'builder' && unit.type !== 'sapper') return;
    if (!state.firstHammer.quarryStruck && (state.score || 0) < 8) return;
    if (state.firstHammer.unitId) return;
    state.firstHammer.captured = true;
    state.firstHammer.hammerWave = wave | 0;
    state.firstHammer.unitId = unit.id || null;
    bumpSignal('first_hammer', 8);
    state.log.unshift({
      at: Date.now(),
      text: `First hammer bearer fielded at wave ${wave} — engineers inherit the quarry's oath.`,
    });
    if (state.log.length > 10) state.log.length = 10;
  }

  function captureFoundingBuilder(unit, wave = 0) {
    captureFirstHammer(unit, wave);
  }

  function getPathTier(wave = 0) {
    if (!state || !isFoundryPathActive(wave)) return 0;
    return scoreTier(state.score);
  }

  function getDysonTier(wave = 0) {
    if (!state || !isFoundryPathActive(wave)) return 0;
    refreshDysonMandate();
    return state.dysonMandate.active ? state.dysonMandate.tier : 0;
  }

  function getAssemblyTier(wave = 0) {
    return getDysonTier(wave);
  }

  function getTacticalMods(wave = 0) {
    if (!isFoundryPathActive(wave)) {
      return {
        countMult: 1,
        hpMult: 1,
        playerDmgMult: 1,
        intervalMult: 1,
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
        intervalMult: 1,
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
      intervalMult: 1,
      researchSpeedMult: 1,
      scienceGainMult: 1,
      note: '',
    };
    if (stage === 'medieval') {
      mods.playerDmgMult = 1 + 0.01 * tier;
      mods.scienceGainMult = 1 + 0.01 * tier;
    } else if (stage === 'kingdom') {
      mods.playerDmgMult = 1 + 0.016 * tier;
      mods.hpMult = 1 + 0.012 * tier;
      mods.intervalMult = 1 - 0.005 * tier;
      mods.researchSpeedMult = 1 + 0.014 * tier;
    } else {
      mods.playerDmgMult = 1 + 0.02 * tier;
      mods.researchSpeedMult = 1 + 0.024 * tier;
      mods.scienceGainMult = 1 + 0.018 * tier;
      mods.intervalMult = 1 - 0.012 * tier;
      mods.countMult = 1 - 0.01 * tier;
      if (hasSyntheticAscension(wave)) {
        mods.countMult *= 1 - 0.006 * tier;
        mods.intervalMult *= 1 - 0.004 * tier;
      }
    }
    mods.note = `${STAGE_DEFS[stage].short} T${tier}`;
    return mods;
  }

  function getDysonMandateMods(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isFoundryPathActive(wave)) {
      return {
        countMult: 1,
        playerDmgMult: 1,
        intervalMult: 1,
        researchSpeedMult: 1,
        scienceGainMult: 1,
        note: '',
        active: false,
      };
    }
    const tier = getDysonTier(wave);
    if (tier <= 0 || !ctx.invasionActive) {
      return {
        countMult: 1,
        playerDmgMult: 1,
        intervalMult: 1,
        researchSpeedMult: 1,
        scienceGainMult: 1,
        note: '',
        active: false,
      };
    }
    const synthetic = hasSyntheticAscension(wave);
    const droneRelief = 0.01 * tier + (synthetic ? 0.006 * tier : 0);
    return {
      countMult: 1 - droneRelief,
      playerDmgMult: 1 + 0.018 * tier + (synthetic ? 0.01 * tier : 0),
      intervalMult: 1 - 0.014 * tier,
      researchSpeedMult: 1 + 0.022 * tier,
      scienceGainMult: 1 + 0.016 * tier,
      note: STAGE_DEFS.galactic.doctrine.label.toLowerCase(),
      active: true,
      droneSwarm: true,
      syntheticAscension: synthetic,
    };
  }

  function getAssemblyMods(ctx = {}) {
    return getDysonMandateMods(ctx);
  }

  function applyFoundryUnitBonuses(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || unit.foundryEvolutionApplied) return;
    if (!isFoundryPathActive(wave)) return;
    if (!TECH_UNIT_TYPES.has(unit.type)) return;

    const tier = getPathTier(wave);
    if (tier <= 0) return;

    const stage = getCurrentStageId(wave);
    const hammer = state?.firstHammer?.captured || state?.firstHammer?.quarryStruck;
    const isHammerBearer = hammer && unit.id && unit.id === state.firstHammer.unitId;

    if (hammer) {
      const lineage = 1 + 0.012 * tier + (stage === 'galactic' ? 0.02 * tier : 0);
      if (unit.type === 'builder' || unit.type === 'sapper') {
        unit.buildSpeedMult = (unit.buildSpeedMult || 1) * lineage;
      }
      if (unit.damage) unit.damage = Math.floor(unit.damage * (1 + 0.014 * tier));
      if (unit.maxHp && (unit.type === 'sapper' || unit.type === 'builder')) {
        unit.maxHp = Math.floor(unit.maxHp * (1 + 0.01 * tier));
        unit.hp = Math.min(unit.hp, unit.maxHp);
      }
      unit.firstHammerLineage = true;
    }

    if (isHammerBearer) {
      unit.firstHammerBearer = true;
      unit.honorName = unit.honorName || 'First Hammer';
    }

    if (stage === 'kingdom' && tier >= 2) {
      if (unit.type === 'ballista') {
        unit.gunpowderDrill = true;
        unit.siegeMult = (unit.siegeMult || 1) * (1 + 0.05 * tier);
        if (unit.damage) unit.damage = Math.floor(unit.damage * (1 + 0.02 * tier));
      }
      if (unit.type === 'sapper') {
        unit.automatedSiege = true;
        unit.siegeMult = (unit.siegeMult || 1) * (1 + 0.045 * tier);
      }
    }

    if (stage === 'galactic' && tier >= 2) {
      if (unit.type === 'builder') {
        unit.machineGod = true;
        unit.aiOverlord = true;
        unit.ascensionWeapon = unit.ascensionWeapon || 'Dyson Hammer';
        unit.buildSpeedMult = (unit.buildSpeedMult || 1) * (1 + 0.035 * tier);
        if (state?.firstHammer?.quarryStruck) unit.honorsFirstHammer = true;
      }
      if (unit.type === 'ballista') {
        unit.droneSwarm = true;
        if (unit.range) unit.range = Math.floor(unit.range + 3 * tier);
      }
      if (unit.type === 'sapper' && hasSyntheticAscension(wave)) {
        unit.syntheticAscension = true;
      }
    }

    unit.foundryEvolutionApplied = true;
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state || ctx.creative) return null;
    state._lastWave = wave | 0;
    refreshDysonMandate();
    if (!isFoundryPathActive(wave)) return null;

    if ((wave | 0) === ROOT_LOCK_WAVE) {
      if (typeof TechTreeBranches !== 'undefined' && TechTreeBranches.getRootId?.() === 'tech') {
        recordRootLock(wave);
        ctx.showMessage?.(
          'Tech Path — Engineers & Quarries crystallize into industrial inheritance.',
          400
        );
      }
    }
    if ((wave | 0) === KINGDOM_WAVE) {
      ctx.showMessage?.(
        'Tech Path — Industrial Revolution: gunpowder, steam, and automated defenses remake the realm.',
        400
      );
    }
    if ((wave | 0) === GALACTIC_WAVE && isFoundryPathActive(wave)) {
      ctx.showMessage?.(
        'Synthetic Ascension — builders become machine gods; drone swarms and Dyson spheres harvest the void.',
        440
      );
      if (state.dysonMandate.tier >= 1) {
        ctx.showMessage?.(
          `Doctrine unlocked: ${STAGE_DEFS.galactic.doctrine.label} — the first hammer still rings in every megastructure.`,
          420
        );
      }
    }
    if ((wave | 0) >= 425 && hasSyntheticAscension(wave) && !state.signals.synthetic_ascension) {
      recordSyntheticAscension(wave);
    }
    return getTacticalMods(wave);
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    state._lastWave = wave;
    refreshDysonMandate();
    const stage = getStageDef(wave);
    const chain = [
      STAGE_DEFS.medieval.label,
      STAGE_DEFS.kingdom.label,
      STAGE_DEFS.galactic.label,
    ].join(' → ');
    return {
      active: isFoundryPathActive(wave),
      stageId: stage.id,
      stageLabel: stage.label,
      stageEpithet: stage.epithet,
      stageFantasy: stage.fantasy,
      tier: getPathTier(wave),
      score: state?.score || 0,
      industryScore: state?.industryScore || 0,
      chain,
      firstHammer: state?.firstHammer ? { ...state.firstHammer } : null,
      foundingBuilder: state?.firstHammer
        ? {
            captured: state.firstHammer.captured,
            foundingWave: state.firstHammer.hammerWave || state.firstHammer.quarryWave,
            unitId: state.firstHammer.unitId,
          }
        : null,
      dysonMandate: state?.dysonMandate ? { ...state.dysonMandate } : null,
      assembly: state?.dysonMandate ? { ...state.dysonMandate } : null,
      doctrineLabel: STAGE_DEFS.galactic.doctrine.label,
      doctrineEpithet: STAGE_DEFS.galactic.doctrine.epithet,
      syntheticAscension: hasSyntheticAscension(wave),
      mods: getTacticalMods(wave),
      hudLine: formatHudLine(ctx),
      log: (state?.log || []).slice(0, 6),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isFoundryPathActive(wave)) return '';
    const stage = getStageDef(wave);
    const tier = getPathTier(wave);
    if (tier <= 0) return 'Foundry forming';
    if ((wave | 0) >= GALACTIC_WAVE && getDysonTier(wave) >= 1) {
      return `Tech T${tier} · Dyson`;
    }
    return `${stage.short} T${tier}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isFoundryPathActive(wave)) return '';
    const tier = getPathTier(wave);
    const parts = [`synthetic foundry T${tier}`];
    if (state?.firstHammer?.quarryStruck) parts.push('first hammer');
    if (getDysonTier(wave) >= 1) parts.push(STAGE_DEFS.galactic.doctrine.label.toLowerCase());
    if (hasSyntheticAscension(wave)) parts.push('synthetic ascension');
    return `Tech Evolution: ${parts.join(', ')}`;
  }

  function renderPanelHtml(ctx = {}) {
    const snap = getStateSnapshot(ctx);
    if (!snap.active) return '';
    const hammerLine = snap.firstHammer?.quarryStruck
      ? `<p class="gs-synergy-stat">First hammer struck wave <strong>${snap.firstHammer.quarryWave}</strong>${snap.firstHammer.unitId ? ` · bearer sworn wave <strong>${snap.firstHammer.hammerWave}</strong>` : ''} — machine gods still honor the quarry.</p>`
      : '<p class="gs-mob-hint">Raise a quarry — the first hammer will echo through every Dyson sphere.</p>';
    const doctrineLine =
      snap.dysonMandate?.active && snap.dysonMandate.tier > 0
        ? `<p class="gs-synergy-stat"><strong>${snap.doctrineLabel}</strong> T${snap.dysonMandate.tier} — ${snap.doctrineEpithet}</p>`
        : (ctx.wave | 0) >= GALACTIC_WAVE
          ? '<p class="gs-mob-hint">Foundries, technocrat patronage, and synthetic ascension awaken the Dyson Mandate.</p>'
          : '';
    const syntheticLine = snap.syntheticAscension
      ? '<p class="gs-synergy-stat">Synthetic Ascension active — drone swarms and AI overlords command the void.</p>'
      : '';
    const modLine = snap.mods?.note
      ? `<p class="gs-synergy-stat">${snap.mods.note}${snap.mods.playerDmgMult > 1 ? ` · Dmg ×${snap.mods.playerDmgMult.toFixed(2)}` : ''}</p>`
      : '';
    return `
      <div class="tpe-foundry-panel">
        <div class="gs-province-head">TECH EVOLUTION — <span style="color:#70b0d8">${snap.stageLabel}</span></div>
        <p class="gs-kingdom-desc">${snap.stageEpithet}</p>
        <p class="gs-kingdom-desc"><em>${snap.stageFantasy}</em></p>
        <p class="gs-synergy-stat">Progression <strong>${snap.chain}</strong> · Tier <strong>${snap.tier}</strong>/4</p>
        ${hammerLine}
        ${doctrineLine}
        ${syntheticLine}
        ${modLine}
      </div>`;
  }

  function spawnTestFoundry(preset = 'stellar') {
    if (!state) resetRun();
    state.score = 82;
    state.industryScore = 58;
    state.firstHammer = {
      captured: true,
      quarryWave: 2,
      hammerWave: 3,
      unitId: 'test-builder',
      quarryStruck: true,
    };
    state.dysonMandate = { active: true, tier: 3 };
    state._lastWave = GALACTIC_WAVE;
    if (preset === 'medieval') {
      state.score = 22;
      state.industryScore = 10;
      state.dysonMandate = { active: false, tier: 0 };
      state._lastWave = 70;
    }
  }

  return {
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    ROOT_LOCK_WAVE,
    STAGE_DEFS,
    resetRun,
    isFoundryPathActive,
    recordAction,
    recordDeploy,
    recordBuild,
    recordBranchInvest,
    recordRootLock,
    recordSyntheticAscension,
    strikeFirstHammer,
    captureFirstHammer,
    captureFoundingBuilder,
    getPathTier,
    getDysonTier,
    getAssemblyTier,
    getTacticalMods,
    getDysonMandateMods,
    getAssemblyMods,
    applyFoundryUnitBonuses,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    renderPanelHtml,
    spawnTestFoundry,
    bootstrapForWave,
  };

  /** Jump-in seed for §7 progression bootstrap. */
  function bootstrapForWave(wave, ctx = {}) {
    const w = wave | 0;
    if (w < KINGDOM_WAVE) spawnTestFoundry('medieval');
    else spawnTestFoundry('stellar');
    if (w < GALACTIC_WAVE && state) {
      state.dysonMandate = { active: w >= KINGDOM_WAVE, tier: w >= KINGDOM_WAVE ? 2 : 0 };
      state._lastWave = w;
    }
    return { ok: true, path: 'tech', wave: w, score: state?.score || 0 };
  }
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.TechPathEvolution = TechPathEvolution;
