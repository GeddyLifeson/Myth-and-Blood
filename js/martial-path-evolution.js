/**
 * Martial Path Evolution — "The Eternal Legion"
 * Medieval footmen & walls → kingdom honor host → galactic gene-forged legion.
 */
const MartialPathEvolution = (() => {
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;

  const STAGE_DEFS = {
    medieval: {
      id: 'medieval',
      label: 'Footmen & Walls',
      short: 'Footmen',
      epithet: 'Heavy reliance on footmen, knights, generals, and walls.',
      fantasy: 'The first footman you field will one day father an immortal legion.',
    },
    kingdom: {
      id: 'kingdom',
      label: 'Honor Host',
      short: 'Honor Host',
      epithet: 'Professional standing armies, knightly orders, honor codes, fortified provinces.',
      fantasy: 'Sworn captains drill the host that will outlive its kings.',
    },
    galactic: {
      id: 'galactic',
      label: 'Eternal Legion',
      short: 'Eternal Legion',
      epithet: 'Gene-forged super-soldiers in ancestral power armor — shield walls against star fleets.',
      fantasy: 'Your founding footman becomes gene-father to legionnaires who still fight in formation.',
      doctrine: {
        id: 'unbreaking_line',
        label: 'The Unbreaking Line',
        epithet: 'Defensive stands become galaxy-shaking last stands.',
      },
    },
  };

  const LEGION_UNIT_TYPES = new Set(['footman', 'pikeman', 'knight', 'paladin', 'general']);
  const WALL_BUILD_TYPES = new Set(['wall', 'castle', 'keep', 'tower', 'watchtower']);

  const ACTION_SIGNALS = {
    deploy_footman: 3,
    deploy_knight: 4,
    deploy_pikeman: 2,
    deploy_general: 5,
    build_wall: 4,
    order_fortify: 3,
    template_shield_wall: 5,
    template_professional_host: 4,
    edict_honor_oath_edict: 4,
    edict_discipline_drill: 3,
    infra_watchtower: 2,
    infra_barracks: 2,
    fleet_legion_dread: 4,
    decree_legion_oath: 5,
    defensive_invasion: 6,
    crisis_honor: 3,
  };

  const TIER_THRESHOLDS = [18, 40, 68, 100];
  const UNBREAKING_THRESHOLDS = [12, 28, 48, 72];

  let state = null;

  function defaultState() {
    return {
      score: 0,
      defensiveScore: 0,
      signals: {},
      geneFather: { captured: false, foundingWave: 0, unitId: null },
      unbreakingLine: { active: false, tier: 0 },
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

  function bumpDefensive(amount = 1) {
    if (!state) return;
    state.defensiveScore += amount;
    state.score += Math.floor(amount * 0.5);
    refreshUnbreakingLine();
  }

  function scoreTier(score, thresholds = TIER_THRESHOLDS) {
    let tier = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (score >= thresholds[i]) tier = i + 1;
    }
    return Math.min(4, tier);
  }

  function getFootmanHeavyFromMedieval() {
    if (typeof FoundationalMedievalLayer === 'undefined') return false;
    const run = FoundationalMedievalLayer.getRunSnapshot?.();
    if (!run?.deploys) return false;
    const foot =
      (run.deploys.footman || 0) + (run.deploys.knight || 0) + (run.deploys.pikeman || 0);
    const archer = run.deploys.archer || 0;
    return foot > archer;
  }

  function isLegionPathActive(wave = 0) {
    if ((wave | 0) >= GALACTIC_WAVE && typeof IntergalacticLayer !== 'undefined') {
      const cosmic = IntergalacticLayer.getCosmicPathId?.();
      if (cosmic === 'eternal_legion') return true;
    }
    if ((wave | 0) >= KINGDOM_WAVE && typeof GrandStrategy !== 'undefined') {
      if (GrandStrategy.getKingdomPathId?.() === 'martial') return true;
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const run = FoundationalMedievalLayer.getRunSnapshot?.();
      if (run?.leading === 'longbow_legacy' && getFootmanHeavyFromMedieval()) return true;
    }
    return getFootmanHeavyFromMedieval();
  }

  function getCurrentStageId(wave = 0) {
    if ((wave | 0) >= GALACTIC_WAVE) return 'galactic';
    if ((wave | 0) >= KINGDOM_WAVE) return 'kingdom';
    return 'medieval';
  }

  function getStageDef(wave = 0) {
    return STAGE_DEFS[getCurrentStageId(wave)] || STAGE_DEFS.medieval;
  }

  function refreshUnbreakingLine() {
    if (!state) return;
    const wave = state._lastWave || 0;
    const galactic = (wave | 0) >= GALACTIC_WAVE;
    const eternalLegion =
      typeof IntergalacticLayer !== 'undefined' &&
      IntergalacticLayer.getCosmicPathId?.() === 'eternal_legion';
    const tier = scoreTier(state.defensiveScore, UNBREAKING_THRESHOLDS);
    state.unbreakingLine.tier = tier;
    state.unbreakingLine.active =
      galactic && isLegionPathActive(wave) && (eternalLegion || tier >= 1);
  }

  function recordAction(actionKey, detail = {}) {
    if (!state || !isLegionPathActive(detail.wave || state._lastWave || 0)) return;
    const amount = ACTION_SIGNALS[actionKey];
    if (!amount) return;
    bumpSignal(actionKey, amount);
    if (
      actionKey === 'order_fortify' ||
      actionKey === 'template_shield_wall' ||
      actionKey === 'build_wall' ||
      actionKey === 'defensive_invasion' ||
      actionKey === 'decree_legion_oath'
    ) {
      bumpDefensive(amount);
    }
    if (detail.label) {
      state.log.unshift({ at: Date.now(), text: `${detail.label} → Eternal Legion` });
      if (state.log.length > 10) state.log.length = 10;
    }
  }

  function recordDeploy(type, wave = 0) {
    if (!state || !type || !isLegionPathActive(wave)) return;
    if (type === 'footman') recordAction('deploy_footman', { wave });
    else if (type === 'knight') recordAction('deploy_knight', { wave });
    else if (type === 'pikeman') recordAction('deploy_pikeman', { wave });
    else if (type === 'general') recordAction('deploy_general', { wave });
  }

  function recordBuild(buildType, wave = 0) {
    if (!state || !buildType || !isLegionPathActive(wave)) return;
    if (WALL_BUILD_TYPES.has(buildType) || buildType.includes('wall')) {
      recordAction('build_wall', { wave, label: 'Fortified wall' });
    }
  }

  function captureGeneFather(unit, wave = 0) {
    if (!state || !unit || unit.team !== 'player' || unit.type !== 'footman') return;
    if (state.geneFather.captured) return;
    state.geneFather = {
      captured: true,
      foundingWave: wave | 0,
      unitId: unit.id || null,
    };
    bumpSignal('gene_father', 8);
    state.log.unshift({
      at: Date.now(),
      text: `Gene-father footman sworn at wave ${wave} — the Eternal Legion remembers.`,
    });
    if (state.log.length > 10) state.log.length = 10;
  }

  function getPathTier(wave = 0) {
    if (!state || !isLegionPathActive(wave)) return 0;
    return scoreTier(state.score);
  }

  function getUnbreakingTier(wave = 0) {
    if (!state || !isLegionPathActive(wave)) return 0;
    refreshUnbreakingLine();
    return state.unbreakingLine.active ? state.unbreakingLine.tier : 0;
  }

  function getTacticalMods(wave = 0) {
    if (!isLegionPathActive(wave)) {
      return {
        countMult: 1,
        hpMult: 1,
        playerDmgMult: 1,
        eliteSlots: 0,
        note: '',
      };
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
      mods.hpMult = 1 + 0.012 * tier;
      mods.playerDmgMult = 1 + 0.01 * tier;
    } else if (stage === 'kingdom') {
      mods.hpMult = 1 + 0.018 * tier;
      mods.playerDmgMult = 1 + 0.014 * tier;
      mods.eliteSlots = tier >= 3 ? 1 : 0;
    } else {
      mods.hpMult = 1 + 0.022 * tier;
      mods.playerDmgMult = 1 + 0.016 * tier;
      mods.countMult = 1 - 0.008 * tier;
      mods.eliteSlots = Math.min(2, Math.floor(tier / 2));
    }
    mods.note = `${STAGE_DEFS[stage].short} T${tier}`;
    return mods;
  }

  function getUnbreakingLineMods(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isLegionPathActive(wave)) {
      return { countMult: 1, hpMult: 1, playerDmgMult: 1, note: '', active: false };
    }
    const tier = getUnbreakingTier(wave);
    if (tier <= 0 || !ctx.defensive) {
      return { countMult: 1, hpMult: 1, playerDmgMult: 1, note: '', active: false };
    }
    const lastStand = !!ctx.lastStandActive;
    const mods = {
      countMult: 1 - 0.01 * tier,
      hpMult: 1 + 0.03 * tier,
      playerDmgMult: 1 + 0.02 * tier + (lastStand ? 0.04 * tier : 0),
      note: STAGE_DEFS.galactic.doctrine.label.toLowerCase(),
      active: true,
      lastStandBonus: lastStand,
    };
    return mods;
  }

  function applyLegionUnitBonuses(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || unit.legionEvolutionApplied) return;
    if (!isLegionPathActive(wave)) return;
    if (!LEGION_UNIT_TYPES.has(unit.type)) return;

    const tier = getPathTier(wave);
    if (tier <= 0) return;

    const stage = getCurrentStageId(wave);
    const geneFather = state?.geneFather?.captured;
    const isFounder = geneFather && unit.id && unit.id === state.geneFather.unitId;

    if (geneFather && (unit.type === 'footman' || unit.type === 'knight' || unit.type === 'pikeman')) {
      const ancestry = 1 + 0.015 * tier + (stage === 'galactic' ? 0.02 * tier : 0);
      if (unit.maxHp) {
        unit.maxHp = Math.floor(unit.maxHp * ancestry);
        unit.hp = Math.min(unit.hp, unit.maxHp);
      }
      if (unit.damage) unit.damage = Math.floor(unit.damage * (1 + 0.012 * tier));
      unit.legionAncestry = true;
    }

    if (isFounder) {
      unit.legionGeneFather = true;
      unit.honorName = unit.honorName || 'Gene-Father';
    }

    if (stage === 'galactic' && tier >= 2) {
      unit.legionShieldWall = true;
      unit.honorFormation = true;
      if (unit.type === 'footman' || unit.type === 'knight' || unit.type === 'pikeman') {
        unit.ascensionWeapon = unit.ascensionWeapon || 'Legion Aegis';
        const cap = 52;
        if ((unit.range || 0) > cap && unit._legionRangeBefore == null) {
          unit._legionRangeBefore = unit.range;
          unit.range = cap;
          unit.honorMeleeOnly = true;
        }
      }
    }

    if (stage === 'kingdom' && tier >= 2 && (unit.type === 'knight' || unit.type === 'general')) {
      unit.honorOath = true;
    }

    unit.legionEvolutionApplied = true;
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state || ctx.creative) return null;
    state._lastWave = wave | 0;
    refreshUnbreakingLine();
    if (!isLegionPathActive(wave)) return null;

    if ((wave | 0) === KINGDOM_WAVE && getFootmanHeavyFromMedieval()) {
      ctx.showMessage?.(
        'Martial Path — Footmen & Walls ascend into the Honor Host: professional armies and sworn oaths.',
        400
      );
    }
    if ((wave | 0) === GALACTIC_WAVE) {
      const cosmic = typeof IntergalacticLayer !== 'undefined' ? IntergalacticLayer.getCosmicPathId?.() : null;
      if (cosmic === 'eternal_legion') {
        ctx.showMessage?.(
          'The Eternal Legion rises — gene-forged knights in power armor still fight shield-wall formation against star fleets.',
          440
        );
        if (state.unbreakingLine.tier >= 1) {
          ctx.showMessage?.(
            `Doctrine unlocked: ${STAGE_DEFS.galactic.doctrine.label} — defensive stands shake the galaxy.`,
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
    refreshUnbreakingLine();
    const active = isLegionPathActive(wave);
    const stage = getStageDef(wave);
    const tier = getPathTier(wave);
    const chain = [
      STAGE_DEFS.medieval.label,
      STAGE_DEFS.kingdom.label,
      STAGE_DEFS.galactic.label,
    ].join(' → ');
    return {
      active,
      stageId: stage.id,
      stageLabel: stage.label,
      stageEpithet: stage.epithet,
      stageFantasy: stage.fantasy,
      tier,
      score: state?.score || 0,
      defensiveScore: state?.defensiveScore || 0,
      chain,
      geneFather: state?.geneFather ? { ...state.geneFather } : null,
      unbreakingLine: state?.unbreakingLine ? { ...state.unbreakingLine } : null,
      doctrineLabel: STAGE_DEFS.galactic.doctrine.label,
      doctrineEpithet: STAGE_DEFS.galactic.doctrine.epithet,
      mods: getTacticalMods(wave),
      hudLine: formatHudLine(ctx),
      log: (state?.log || []).slice(0, 6),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isLegionPathActive(wave)) return '';
    const stage = getStageDef(wave);
    const tier = getPathTier(wave);
    if (tier <= 0) return 'Legion forming';
    if ((wave | 0) >= GALACTIC_WAVE && getUnbreakingTier(wave) >= 1) {
      return `Legion T${tier} · Line`;
    }
    return `${stage.short} T${tier}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isLegionPathActive(wave)) return '';
    const tier = getPathTier(wave);
    const parts = [`eternal legion T${tier}`];
    if (state?.geneFather?.captured) parts.push('gene-father');
    if (getUnbreakingTier(wave) >= 1) parts.push(STAGE_DEFS.galactic.doctrine.label.toLowerCase());
    return `Martial Evolution: ${parts.join(', ')}`;
  }

  function renderPanelHtml(ctx = {}) {
    const snap = getStateSnapshot(ctx);
    if (!snap.active) return '';
    const geneLine = snap.geneFather?.captured
      ? `<p class="gs-synergy-stat">Gene-father sworn wave <strong>${snap.geneFather.foundingWave}</strong> — every legionnaire carries his line.</p>`
      : '<p class="gs-mob-hint">Field your first footman — he will become gene-father of the immortal legion.</p>';
    const doctrineLine =
      snap.unbreakingLine?.active && snap.unbreakingLine.tier > 0
        ? `<p class="gs-synergy-stat"><strong>${snap.doctrineLabel}</strong> T${snap.unbreakingLine.tier} — ${snap.doctrineEpithet}</p>`
        : (ctx.wave | 0) >= GALACTIC_WAVE
          ? '<p class="gs-mob-hint">Fortify provinces and accept defensive invasions to awaken The Unbreaking Line.</p>'
          : '';
    const modLine = snap.mods?.note
      ? `<p class="gs-synergy-stat">${snap.mods.note}${snap.mods.hpMult > 1 ? ` · HP ×${snap.mods.hpMult.toFixed(2)}` : ''}</p>`
      : '';
    return `
      <div class="mpe-legion-panel">
        <div class="gs-province-head">MARTIAL EVOLUTION — <span style="color:#68a878">${snap.stageLabel}</span></div>
        <p class="gs-kingdom-desc">${snap.stageEpithet}</p>
        <p class="gs-kingdom-desc"><em>${snap.stageFantasy}</em></p>
        <p class="gs-synergy-stat">Progression <strong>${snap.chain}</strong> · Tier <strong>${snap.tier}</strong>/4</p>
        ${geneLine}
        ${doctrineLine}
        ${modLine}
      </div>`;
  }

  function spawnTestLegion(preset = 'eternal_legion') {
    if (!state) resetRun();
    state.score = 85;
    state.defensiveScore = 55;
    state.geneFather = { captured: true, foundingWave: 1, unitId: 'test-footman' };
    state.unbreakingLine = { active: true, tier: 3 };
    state._lastWave = GALACTIC_WAVE;
    if (preset === 'medieval') {
      state.score = 25;
      state.defensiveScore = 8;
      state.unbreakingLine = { active: false, tier: 0 };
      state._lastWave = 80;
    }
  }

  /** Jump-in seed for §7 progression bootstrap. */
  function bootstrapForWave(wave, ctx = {}) {
    const w = wave | 0;
    if (w < KINGDOM_WAVE) spawnTestLegion('medieval');
    else spawnTestLegion('eternal_legion');
    if (w < GALACTIC_WAVE && state) {
      state.unbreakingLine = { active: w >= KINGDOM_WAVE, tier: w >= KINGDOM_WAVE ? 2 : 0 };
      state._lastWave = w;
    }
    return { ok: true, path: 'martial', wave: w, score: state?.score || 0 };
  }

  return {
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    STAGE_DEFS,
    resetRun,
    isLegionPathActive,
    recordAction,
    recordDeploy,
    recordBuild,
    captureGeneFather,
    getPathTier,
    getUnbreakingTier,
    getTacticalMods,
    getUnbreakingLineMods,
    applyLegionUnitBonuses,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    renderPanelHtml,
    spawnTestLegion,
    bootstrapForWave,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MartialPathEvolution = MartialPathEvolution;
