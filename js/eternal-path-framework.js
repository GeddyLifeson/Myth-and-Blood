/**
 * Eternal Path Framework — four parallel paths across all layers.
 * Martial · Arcane · Tech · Mythic
 * Medieval → Kingdom → Intergalactic — early investment strengthens later tiers.
 */
const EternalPathFramework = (() => {
  const ROOT_LOCK_WAVE = 50;
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;

  const PATH_IDS = ['martial', 'arcane', 'tech', 'mythic'];

  const ETERNAL_PATHS = {
    martial: {
      id: 'martial',
      label: 'Martial Path',
      short: 'Martial',
      color: '#68a878',
      desc: 'Physical prowess, discipline, and conquest — the blade endures every era.',
      foundationId: 'longbow_legacy',
      kingdomPathId: 'martial',
      cosmicPaths: ['void_rangers', 'eternal_legion'],
      techBranch: 'martial',
      eras: {
        medieval: {
          label: 'Footmen & Walls',
          short: 'Footmen',
          epithet: 'Footmen, knights, generals, and walls — seed of the Eternal Legion',
        },
        kingdom: {
          label: 'Honor Host',
          short: 'Honor Host',
          epithet: 'Professional armies, knightly orders, and fortified provinces',
        },
        galactic: {
          void_rangers: { label: 'Void Rangers', short: 'Void Rangers', epithet: 'Transhuman snipers among the stars' },
          eternal_legion: {
            label: 'Eternal Legion',
            short: 'Eternal Legion',
            epithet: 'Gene-forged legionnaires — The Unbreaking Line holds against star fleets',
          },
        },
      },
      modsPerTier: { hpMult: 0.012, playerDmgMult: 0.014 },
      unitTypes: new Set(['footman', 'archer', 'pikeman', 'knight', 'paladin', 'general', 'ballista', 'scout']),
    },
    arcane: {
      id: 'arcane',
      label: 'Arcane Path',
      short: 'Arcane',
      color: '#9070f0',
      desc: 'Magic, mysticism, and reality manipulation — scholarch power compounds forever.',
      foundationId: 'arcane_dominion',
      kingdomPathId: 'arcane',
      cosmicPaths: ['aether_lords'],
      techBranch: 'arcane',
      eras: {
        medieval: {
          label: 'Mages & Academies',
          short: 'Academies',
          epithet: 'Mages, academies, and enchanted structures',
        },
        kingdom: {
          label: 'Arcane Crown',
          short: 'Arcane Crown',
          epithet: 'Royal mages, ley-line networks, and reality-editing edicts',
        },
        galactic: {
          aether_lords: {
            label: 'Aether Lords',
            short: 'Aether Lords',
            epithet: 'Weavers of Fate — Arcane Singularity megastructures warp physics',
          },
        },
      },
      modsPerTier: { playerDmgMult: 0.016, researchSpeedMult: 0.018, scienceGainMult: 0.012 },
      unitTypes: new Set(['mage', 'wizard', 'warlock', 'cleric', 'elemental', 'healer']),
    },
    tech: {
      id: 'tech',
      label: 'Tech Path',
      short: 'Tech',
      color: '#70b0d8',
      desc: 'Engineering, industry, and innovation — the Crown becomes a civilization-scale machine.',
      foundationId: null,
      kingdomPathId: null,
      cosmicPaths: ['stellar_foundry'],
      techBranch: 'tech',
      eras: {
        medieval: {
          label: 'Engineers & Quarries',
          short: 'Engineers',
          epithet: 'Sappers, ballistae, quarries — the first hammer shapes every era',
        },
        kingdom: {
          label: 'Industrial Revolution',
          short: 'Industry',
          epithet: 'Gunpowder, steam, and automated defenses',
        },
        galactic: {
          stellar_foundry: {
            label: 'Synthetic Ascension',
            short: 'Synthetic',
            epithet: 'Drone swarms, AI overlords, Dyson spheres — the first hammer endures',
          },
        },
      },
      modsPerTier: { researchSpeedMult: 0.02, scienceGainMult: 0.016, intervalMult: -0.008 },
      unitTypes: new Set(['builder', 'sapper', 'ballista']),
    },
    mythic: {
      id: 'mythic',
      label: 'Mythic Path',
      short: 'Mythic',
      color: '#e8b050',
      desc: 'Crossover heroes, legends, and otherworldly power — champions echo across cosmic time.',
      foundationId: 'mythic_alliance',
      kingdomPathId: 'mythic',
      cosmicPaths: ['pantheon_ascendant'],
      techBranch: 'mythic',
      eras: {
        medieval: {
          label: 'Powerful Heroes',
          short: 'Heroes',
          epithet: 'Individual crossover champions — the path starts locked until one arrives',
        },
        kingdom: {
          label: 'Heroic Bloodlines',
          short: 'Bloodlines',
          epithet: 'Heroic bloodlines and pantheons sworn to the Crown',
        },
        galactic: {
          pantheon_ascendant: {
            label: 'Pantheon Ascendant',
            short: 'Pantheon',
            epithet: 'Literal gods and eternal champions lead fleets across the void',
          },
        },
      },
      modsPerTier: { playerDmgMult: 0.018, eliteSlots: 0.25 },
      unitTypes: null,
    },
  };

  const TIER_THRESHOLDS = [12, 28, 48, 72];
  const ERA_ALIGNMENT_BONUS = 8;
  const ERA_MISMATCH_PENALTY = 3;

  let state = null;

  function defaultState() {
    return {
      investment: { martial: 0, arcane: 0, tech: 0, mythic: 0 },
      dominantPathId: null,
      alignment: 0,
      eras: {
        medieval: { pathId: null, variantId: null, label: null, tier: 0, wave: 0 },
        kingdom: { pathId: null, variantId: null, label: null, tier: 0, wave: 0 },
        galactic: { pathId: null, variantId: null, label: null, tier: 0, wave: 0 },
      },
      lastSyncWave: 0,
      log: [],
    };
  }

  function resetRun() {
    state = defaultState();
  }

  function mapFoundationToPath(foundationId) {
    if (foundationId === 'longbow_legacy') return 'martial';
    if (foundationId === 'arcane_dominion') return 'arcane';
    if (foundationId === 'mythic_alliance') return 'mythic';
    return null;
  }

  function mapKingdomToPath(kingdomPathId) {
    if (kingdomPathId === 'martial' || kingdomPathId === 'arcane' || kingdomPathId === 'mythic') {
      return kingdomPathId;
    }
    return null;
  }

  function mapCosmicToPath(cosmicPathId) {
    if (!cosmicPathId) return null;
    for (const pathId of PATH_IDS) {
      const def = ETERNAL_PATHS[pathId];
      if (def.cosmicPaths?.includes(cosmicPathId)) return pathId;
    }
    if (cosmicPathId === 'stellar_foundry') return 'tech';
    return null;
  }

  function mapTechRootToPath(rootId) {
    if (PATH_IDS.includes(rootId)) return rootId;
    return null;
  }

  function investmentTier(score) {
    let tier = 0;
    for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
      if (score >= TIER_THRESHOLDS[i]) tier = i + 1;
    }
    return Math.min(4, tier);
  }

  function getDominantPathId() {
    if (!state) return null;
    // Always recompute from current investment — sticky dominantPathId froze the path forever
    // after first non-zero spend and blocked later re-leads.
    let best = null;
    let bestScore = 0;
    for (const id of PATH_IDS) {
      const s = state.investment[id] || 0;
      if (s > bestScore) {
        bestScore = s;
        best = id;
      }
    }
    return bestScore > 0 ? best : null;
  }

  function recordEraResolution(era, pathId, variantId, label, wave) {
    if (!state || !PATH_IDS.includes(pathId)) return;
    if (state.eras[era]?.pathId) return;
    state.eras[era] = {
      pathId,
      variantId: variantId || null,
      label: label || ETERNAL_PATHS[pathId]?.eras?.[era]?.label || pathId,
      tier: 0,
      wave: wave | 0,
    };
    state.log.unshift({
      at: Date.now(),
      text: `${ETERNAL_PATHS[pathId].short} — ${era} era: ${label || pathId}`,
    });
    if (state.log.length > 10) state.log.length = 10;
  }

  function syncMedievalEraLabel(snap) {
    const leading = snap?.leading ? mapFoundationToPath(snap.leading) : null;
    if (!leading || state.eras.medieval.pathId) return;
    const medieval = ETERNAL_PATHS[leading]?.eras?.medieval;
    recordEraResolution('medieval', leading, snap.leading, medieval?.label, snap.wave || 1);
  }

  function syncKingdomEra(wave) {
    if ((wave | 0) < KINGDOM_WAVE) return;
    if (state.eras.kingdom.pathId) return;
    if (typeof GrandStrategy === 'undefined') return;
    const kingdomId = GrandStrategy.getKingdomPathId?.();
    const pathId = mapKingdomToPath(kingdomId);
    if (pathId) {
      const label = ETERNAL_PATHS[pathId]?.eras?.kingdom?.label;
      recordEraResolution('kingdom', pathId, kingdomId, label, wave);
    }
    const techRoot = typeof TechTreeBranches !== 'undefined' ? TechTreeBranches.getRootId?.() : null;
    if (techRoot === 'tech' && !state.eras.kingdom.pathId) {
      recordEraResolution('kingdom', 'tech', 'engineering', ETERNAL_PATHS.tech.eras.kingdom.label, wave);
    }
  }

  function syncGalacticEra(wave) {
    if ((wave | 0) < GALACTIC_WAVE) return;
    if (state.eras.galactic.pathId) return;
    if (typeof IntergalacticLayer === 'undefined') return;
    const cosmicId = IntergalacticLayer.getCosmicPathId?.();
    const pathId = mapCosmicToPath(cosmicId);
    if (pathId && cosmicId) {
      const galDef = ETERNAL_PATHS[pathId]?.eras?.galactic?.[cosmicId];
      recordEraResolution('galactic', pathId, cosmicId, galDef?.label || cosmicId, wave);
    }
    if (
      !state.eras.galactic.pathId &&
      typeof TechTreeBranches !== 'undefined' &&
      TechTreeBranches.getRootId?.() === 'tech'
    ) {
      recordEraResolution(
        'galactic',
        'tech',
        'stellar_foundry',
        ETERNAL_PATHS.tech.eras.galactic.stellar_foundry.label,
        wave
      );
    }
  }

  function recomputeAlignment() {
    if (!state) return;
    let align = 0;
    const m = state.eras.medieval.pathId;
    const k = state.eras.kingdom.pathId;
    const g = state.eras.galactic.pathId;
    if (m && k && m === k) align += 1;
    if (k && g && k === g) align += 1;
    if (m && g && m === g) align += 1;
    state.alignment = align;
  }

  function recomputeInvestment(wave = 0) {
    const inv = { martial: 0, arcane: 0, tech: 0, mythic: 0 };
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const snap = FoundationalMedievalLayer.getRunSnapshot?.();
      if (snap?.scores) {
        inv.martial += Math.floor((snap.scores.longbow_legacy || 0) * 0.5);
        inv.arcane += Math.floor((snap.scores.arcane_dominion || 0) * 0.5);
        inv.mythic += Math.floor((snap.scores.mythic_alliance || 0) * 0.5);
        const leading = snap.leading ? mapFoundationToPath(snap.leading) : null;
        if (leading) inv[leading] += 6;
      }
      const labs = snap?.builds?.research_lab || 0;
      const science = snap?.scienceEarned || 0;
      inv.tech += Math.floor(labs * 5 + science * 0.35);
    }
    if (typeof TechTreeBranches !== 'undefined') {
      const rootId = TechTreeBranches.getRootId?.();
      const pathId = mapTechRootToPath(rootId);
      if (pathId && TechTreeBranches.getStateSnapshot?.({ wave })?.rootLocked) {
        inv[pathId] += 14;
      }
      const invested = TechTreeBranches.getStateSnapshot?.({ wave })?.investedCount || 0;
      if (pathId && invested > 0) inv[pathId] += Math.min(24, invested * 3);
    }
    if (typeof ThematicEraSynergies !== 'undefined') {
      const p = ThematicEraSynergies.getPathId?.();
      if (PATH_IDS.includes(p) && (wave | 0) >= KINGDOM_WAVE) inv[p] += 6;
    }
    if (typeof HybridPowerFantasy !== 'undefined' && (wave | 0) >= 500) {
      const snap = HybridPowerFantasy.getStateSnapshot?.({ wave });
      if (snap?.fantasyId === 'wizard_kings') inv.arcane += 10;
      if (snap?.fantasyId === 'honor_legion') inv.martial += 10;
    }
    if (typeof MartialPathEvolution !== 'undefined' && MartialPathEvolution.isLegionPathActive?.(wave)) {
      inv.martial += MartialPathEvolution.getPathTier(wave) * 4;
      if (MartialPathEvolution.getUnbreakingTier?.(wave) >= 1) inv.martial += 6;
    }
    if (typeof ArcanePathEvolution !== 'undefined' && ArcanePathEvolution.isWeaverPathActive?.(wave)) {
      inv.arcane += ArcanePathEvolution.getPathTier(wave) * 4;
      if (ArcanePathEvolution.getSingularityTier?.(wave) >= 1) inv.arcane += 6;
    }
    if (typeof TechPathEvolution !== 'undefined' && TechPathEvolution.isFoundryPathActive?.(wave)) {
      inv.tech += TechPathEvolution.getPathTier(wave) * 5;
      if ((TechPathEvolution.getDysonTier?.(wave) || TechPathEvolution.getAssemblyTier?.(wave) || 0) >= 1) {
        inv.tech += 8;
      }
    }
    if (typeof MythicPathEvolution !== 'undefined' && MythicPathEvolution.isUnlocked?.()) {
      if (MythicPathEvolution.isPantheonPathActive?.(wave)) {
        inv.mythic += MythicPathEvolution.getPathTier(wave) * 4;
        if (MythicPathEvolution.getArmadaTier?.(wave) >= 1) inv.mythic += 6;
      }
    }
    for (const era of ['medieval', 'kingdom', 'galactic']) {
      const pid = state.eras[era]?.pathId;
      if (pid) inv[pid] += ERA_ALIGNMENT_BONUS;
    }
    state.investment = inv;
    for (const era of ['medieval', 'kingdom', 'galactic']) {
      const pid = state.eras[era]?.pathId;
      if (pid) state.eras[era].tier = investmentTier(inv[pid] || 0);
    }
  }

  function syncFromLayers(wave = 0) {
    if (!state) resetRun();
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      syncMedievalEraLabel(FoundationalMedievalLayer.getRunSnapshot?.());
    }
    syncKingdomEra(wave);
    syncGalacticEra(wave);
    recomputeAlignment();
    recomputeInvestment(wave);
    state.dominantPathId = getDominantPathId();
    state.lastSyncWave = wave | 0;
  }

  function getCurrentEra(wave = 0) {
    if ((wave | 0) >= GALACTIC_WAVE) return 'galactic';
    if ((wave | 0) >= KINGDOM_WAVE) return 'kingdom';
    return 'medieval';
  }

  function getPathTier(pathId, wave = 0) {
    if (!state || !pathId) return 0;
    const invTier = investmentTier(state.investment[pathId] || 0);
    const era = getCurrentEra(wave);
    let eraTier = 0;
    if (era === 'medieval' && state.eras.medieval.pathId === pathId) eraTier = state.eras.medieval.tier || 1;
    if (era === 'kingdom' && state.eras.kingdom.pathId === pathId) eraTier = Math.max(eraTier, state.eras.kingdom.tier || 1);
    if (era === 'galactic' && state.eras.galactic.pathId === pathId) eraTier = Math.max(eraTier, state.eras.galactic.tier || 1);
    return Math.min(4, Math.max(invTier, eraTier));
  }

  function getDominantTier(wave = 0) {
    const id = getDominantPathId();
    return id ? getPathTier(id, wave) : 0;
  }

  function getAlignmentMult() {
    const a = state?.alignment || 0;
    return 1 + Math.min(0.15, a * 0.04);
  }

  function getFrameworkMods(wave = 0) {
    syncFromLayers(wave);
    const pathId = getDominantPathId();
    const tier = getDominantTier(wave);
    if (!pathId || tier <= 0) {
      return {
        countMult: 1,
        hpMult: 1,
        playerDmgMult: 1,
        eliteSlots: 0,
        intervalMult: 1,
        researchSpeedMult: 1,
        scienceGainMult: 1,
        note: '',
      };
    }
    const def = ETERNAL_PATHS[pathId];
    const per = def.modsPerTier || {};
    const align = getAlignmentMult();
    const mods = {
      countMult: 1,
      hpMult: 1,
      playerDmgMult: 1,
      eliteSlots: 0,
      intervalMult: 1,
      researchSpeedMult: 1,
      scienceGainMult: 1,
      note: `${def.short} T${tier}`,
    };
    if (per.hpMult) mods.hpMult = 1 + per.hpMult * tier * align;
    if (per.playerDmgMult) mods.playerDmgMult = 1 + per.playerDmgMult * tier * align;
    if (per.researchSpeedMult) mods.researchSpeedMult = 1 + per.researchSpeedMult * tier * align;
    if (per.scienceGainMult) mods.scienceGainMult = 1 + per.scienceGainMult * tier * align;
    if (per.intervalMult) mods.intervalMult = 1 + per.intervalMult * tier * align;
    if (per.eliteSlots) mods.eliteSlots = Math.floor(per.eliteSlots * tier);
    if (state.alignment >= 2) mods.note += ' · aligned';
    return mods;
  }

  function getPathForUnit(unitType, unit = {}) {
    if (!unitType) return null;
    if (typeof isCrossoverUnit === 'function' && isCrossoverUnit(unitType)) return 'mythic';
    if (typeof isWweUnit === 'function' && isWweUnit(unitType)) return 'mythic';
    if (unitType === 'doomslayer_hero' || unit.honorName) return 'mythic';
    for (const pathId of PATH_IDS) {
      if (pathId === 'mythic') continue;
      if (ETERNAL_PATHS[pathId].unitTypes?.has(unitType)) return pathId;
    }
    return null;
  }

  function applyPathUnitBonuses(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || unit.eternalPathBonus) return;
    syncFromLayers(wave);
    const pathId = getDominantPathId();
    const tier = getDominantTier(wave);
    if (!pathId || tier <= 0) return;
    const def = ETERNAL_PATHS[pathId];
    let matches = false;
    if (pathId === 'mythic') {
      matches =
        (typeof isCrossoverUnit === 'function' && isCrossoverUnit(unit.type)) ||
        (typeof isWweUnit === 'function' && isWweUnit(unit.type)) ||
        unit.type === 'doomslayer_hero' ||
        unit.honorName ||
        (unit.vetTier || 0) >= 4;
    } else if (def.unitTypes?.has(unit.type)) {
      matches = true;
    }
    if (!matches) return;
    const align = getAlignmentMult();
    const dmgBoost = 1 + 0.02 * tier * align;
    const hpBoost = 1 + 0.025 * tier * align;
    if (def.modsPerTier?.hpMult && unit.maxHp) {
      unit.maxHp = Math.floor(unit.maxHp * hpBoost);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    if (unit.damage) unit.damage = Math.floor(unit.damage * dmgBoost);
    unit.eternalPathBonus = pathId;
  }

  function getPathProgression(pathId) {
    const def = ETERNAL_PATHS[pathId];
    if (!def || !state) return null;
    const inv = state.investment[pathId] || 0;
    const tier = investmentTier(inv);
    const m = state.eras.medieval.pathId === pathId ? state.eras.medieval.label : '—';
    const k = state.eras.kingdom.pathId === pathId ? state.eras.kingdom.label : '—';
    let g = '—';
    if (state.eras.galactic.pathId === pathId) {
      g = state.eras.galactic.label || '—';
    }
    return {
      id: pathId,
      label: def.label,
      short: def.short,
      color: def.color,
      investment: inv,
      tier,
      chain: { medieval: m, kingdom: k, galactic: g },
      isDominant: getDominantPathId() === pathId,
    };
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state || ctx.creative) return null;
    syncFromLayers(wave);
    if ((wave | 0) === KINGDOM_WAVE && state.eras.kingdom.pathId) {
      const k = state.eras.kingdom;
      ctx.showMessage?.(
        `Eternal Path — ${ETERNAL_PATHS[k.pathId]?.label || k.pathId} enters the Kingdom era as ${k.label}.`,
        380
      );
    }
    if ((wave | 0) === GALACTIC_WAVE && state.eras.galactic.pathId) {
      const g = state.eras.galactic;
      ctx.showMessage?.(
        `Eternal Path — ${ETERNAL_PATHS[g.pathId]?.label || g.pathId} ascends to ${g.label} among the stars.`,
        400
      );
    }
    return getFrameworkMods(wave);
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    syncFromLayers(wave);
    const dominant = getDominantPathId();
    return {
      dominantPathId: dominant,
      dominantLabel: dominant ? ETERNAL_PATHS[dominant]?.label : null,
      dominantColor: dominant ? ETERNAL_PATHS[dominant]?.color : null,
      dominantTier: getDominantTier(wave),
      alignment: state?.alignment || 0,
      era: getCurrentEra(wave),
      paths: PATH_IDS.map((id) => getPathProgression(id)),
      eras: { ...state?.eras },
      investment: { ...state?.investment },
      mods: getFrameworkMods(wave),
      hudLine: formatHudLine(ctx),
      log: (state?.log || []).slice(0, 5),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    syncFromLayers(wave);
    const id = getDominantPathId();
    if (!id) return wave >= ROOT_LOCK_WAVE ? 'Path ?' : '';
    const def = ETERNAL_PATHS[id];
    const tier = getDominantTier(wave);
    const era = getCurrentEra(wave);
    const short = def.short;
    if (era === 'medieval') return `${short} T${tier}`;
    const chain = getPathProgression(id)?.chain;
    if (era === 'kingdom' && chain?.kingdom !== '—') return `${short} · ${chain.kingdom.split(' ')[0]}`;
    if (era === 'galactic' && chain?.galactic !== '—') return `${short} · ${chain.galactic.split(' ')[0]}`;
    return `${short} T${tier}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    syncFromLayers(wave);
    const id = getDominantPathId();
    if (!id) return '';
    const tier = getDominantTier(wave);
    const def = ETERNAL_PATHS[id];
    const parts = [`${def.label.toLowerCase()} T${tier}`];
    if (state.alignment >= 2) parts.push('aligned');
    return `Eternal Paths: ${parts.join(', ')}`;
  }

  function renderPanelHtml(ctx = {}) {
    const snap = getStateSnapshot(ctx);
    if (!snap.paths?.length) return '';
    const rows = snap.paths
      .map((p) => {
        const dominant = p.isDominant ? ' dominant' : '';
        const chain = `${p.chain.medieval} → ${p.chain.kingdom} → ${p.chain.galactic}`;
        return `<div class="epf-path-row${dominant}">
          <span class="epf-path-label" style="color:${p.color}">${p.short}</span>
          <span class="epf-path-tier">T${p.tier}</span>
          <span class="epf-path-chain">${chain}</span>
        </div>`;
      })
      .join('');
    const alignLine =
      snap.alignment >= 2
        ? `<p class="epf-align-note">Cross-era alignment <strong>×${getAlignmentMult().toFixed(2)}</strong> — same path strengthens every layer.</p>`
        : '<p class="epf-align-note">Stay on one path from medieval through kingdom to galactic for alignment bonuses.</p>';
    return `
      <div class="epf-framework-panel">
        <div class="gs-province-head">ETERNAL PATHS</div>
        <p class="gs-kingdom-desc">Four parallel paths — Martial, Arcane, Tech, Mythic — evolve Medieval → Kingdom → Intergalactic.</p>
        <p class="gs-synergy-stat">Dominant <strong style="color:${snap.dominantColor}">${snap.dominantLabel || '—'}</strong> · Tier <strong>${snap.dominantTier}</strong> · Era <strong>${snap.era}</strong></p>
        <div class="epf-path-list">${rows}</div>
        ${alignLine}
      </div>`;
  }

  function spawnTestInvestment(preset = 'martial') {
    if (!state) resetRun();
    const presets = {
      martial: { martial: 80, arcane: 12, tech: 8, mythic: 10 },
      arcane: { martial: 10, arcane: 85, tech: 15, mythic: 8 },
      tech: { martial: 8, arcane: 12, tech: 90, mythic: 6 },
      mythic: { martial: 10, arcane: 8, tech: 6, mythic: 88 },
    };
    const inv = presets[preset] || presets.martial;
    state.investment = { martial: 0, arcane: 0, tech: 0, mythic: 0, ...inv };
    state.dominantPathId = preset;
    state.alignment = 3;
    state.eras = {
      medieval: { pathId: preset, variantId: null, label: ETERNAL_PATHS[preset].eras.medieval.label, tier: 3, wave: 100 },
      kingdom: { pathId: preset, variantId: preset, label: ETERNAL_PATHS[preset].eras.kingdom?.label, tier: 3, wave: 150 },
      galactic: {
        pathId: preset,
        variantId: ETERNAL_PATHS[preset].cosmicPaths?.[0] || 'stellar_foundry',
        label: preset === 'martial' ? 'Void Rangers' : ETERNAL_PATHS[preset].eras.galactic?.[ETERNAL_PATHS[preset].cosmicPaths?.[0]]?.label,
        tier: 3,
        wave: 400,
      },
    };
  }

  /**
   * Jump-in seed (§7) — scale investment by wave and path preset.
   */
  function bootstrapForWave(wave, ctx = {}) {
    const w = wave | 0;
    if (!state) resetRun();
    const preset = PATH_IDS.includes(ctx.pathPreset) ? ctx.pathPreset : PATH_IDS.includes(ctx.pathId) ? ctx.pathId : 'martial';
    // Scale investment so mid-game jump-ins get partial tiers, endgame full.
    const scale = w >= 400 ? 1 : w >= 150 ? 0.65 : w >= 100 ? 0.4 : 0.2;
    spawnTestInvestment(preset);
    for (const id of PATH_IDS) {
      state.investment[id] = Math.round((state.investment[id] || 0) * scale);
    }
    // Ensure dominant path still leads after scale.
    state.investment[preset] = Math.max(state.investment[preset], Math.round(48 * scale) + 10);
    state.dominantPathId = preset;
    if (w < KINGDOM_WAVE) {
      state.eras.kingdom = { pathId: null, variantId: null, label: null, tier: 0, wave: 0 };
      state.eras.galactic = { pathId: null, variantId: null, label: null, tier: 0, wave: 0 };
    } else if (w < GALACTIC_WAVE) {
      state.eras.galactic = { pathId: null, variantId: null, label: null, tier: 0, wave: 0 };
    }
    state.lastSyncWave = w;
    return {
      ok: true,
      pathId: preset,
      investment: { ...state.investment },
      dominantTier: getDominantTier?.() ?? investmentTier(state.investment[preset]),
    };
  }

  return {
    ROOT_LOCK_WAVE,
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    PATH_IDS,
    ETERNAL_PATHS,
    resetRun,
    mapFoundationToPath,
    mapKingdomToPath,
    mapCosmicToPath,
    syncFromLayers,
    onWaveStart,
    getDominantPathId,
    getPathTier,
    getDominantTier,
    getFrameworkMods,
    getPathForUnit,
    applyPathUnitBonuses,
    getPathProgression,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    renderPanelHtml,
    spawnTestInvestment,
    bootstrapForWave,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.EternalPathFramework = EternalPathFramework;
