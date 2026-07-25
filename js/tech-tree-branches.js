/**
 * Giant Branching Tech Tree — root path decided early (Martial / Arcane / Mythic / Tech).
 * Same Crown, different stellar inheritance. Branch nodes invest Science Points for era-spanning power.
 */
const TechTreeBranches = (() => {
  const ROOT_LOCK_WAVE = 50;
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;
  const APEX_WAVE = 500;

  const ROOT_BRANCHES = {
    martial: {
      id: 'martial',
      label: 'Martial Path',
      short: 'Martial',
      color: '#68a878',
      epithet: 'the Volley Host',
      desc: 'Archers, footmen, and sworn steel — ancestral arms carried into the void.',
      foundationId: 'longbow_legacy',
      kingdomPath: 'martial',
    },
    arcane: {
      id: 'arcane',
      label: 'Arcane Path',
      short: 'Arcane',
      color: '#9070f0',
      epithet: 'the Scholarch Dominion',
      desc: 'Ley lines, mage towers, and reality-warping science — magic becomes infrastructure.',
      foundationId: 'arcane_dominion',
      kingdomPath: 'arcane',
      techTreeLabel: 'Arcane-Infused Technology',
    },
    mythic: {
      id: 'mythic',
      label: 'Mythic Path',
      short: 'Mythic',
      color: '#e8b050',
      epithet: 'the Crossover Alliance',
      desc: 'Champions from beyond — heroes become gods, fleets, and immortal advisors.',
      foundationId: 'mythic_alliance',
      kingdomPath: 'mythic',
    },
    tech: {
      id: 'tech',
      label: 'Tech Path',
      short: 'Tech',
      color: '#70b0d8',
      epithet: 'the First Hammer',
      desc: 'Engineers, quarries, and industry — from medieval sappers to synthetic ascension and Dyson spheres.',
      foundationId: null,
      kingdomPath: null,
      techTreeLabel: 'Stellar Engineering Tree',
    },
  };

  /** Giant branching nodes — only the locked root branch is investable. */
  const BRANCH_NODES = [
    // ── Martial ──
    {
      id: 'martial_root',
      branch: 'martial',
      tier: 1,
      name: 'Martial Root',
      cost: 40,
      wave: ROOT_LOCK_WAVE,
      desc: 'Commit the Crown to volley culture and sworn hosts.',
      effects: { playerDmgMult: 1.03 },
    },
    {
      id: 'martial_volley',
      branch: 'martial',
      tier: 2,
      name: 'Volley Doctrine',
      cost: 55,
      wave: 55,
      prereq: ['martial_root'],
      desc: 'Longbow spirits stack on every rank.',
      effects: { playerDmgMult: 1.04, archerDmgMult: 1.06 },
    },
    {
      id: 'martial_honor',
      branch: 'martial',
      tier: 2,
      name: 'Honor Oath',
      cost: 58,
      wave: 60,
      prereq: ['martial_root'],
      desc: 'Footmen and pikemen hold the line with sworn HP.',
      effects: { footmanHpMult: 1.06, hpMult: 1.03 },
    },
    {
      id: 'martial_siege',
      branch: 'martial',
      tier: 2,
      name: 'Siege Mastery',
      cost: 62,
      wave: 65,
      prereq: ['martial_volley'],
      desc: 'Ballista and sapper academies sharpen siege.',
      effects: { siegeMult: 1.1 },
    },
    {
      id: 'martial_host',
      branch: 'martial',
      tier: 3,
      name: 'Professional Host Theory',
      cost: 85,
      wave: 90,
      prereq: ['martial_honor', 'martial_volley'],
      desc: 'Mobilization templates favor disciplined cores.',
      effects: { playerDmgMult: 1.05, hpMult: 1.04 },
    },
    {
      id: 'martial_ancestral',
      branch: 'martial',
      tier: 3,
      name: 'Ancestral Forge',
      cost: 95,
      wave: 120,
      prereq: ['martial_host'],
      desc: 'Ancestral weapons scale faster — preview of kingdom synergy.',
      effects: { playerDmgMult: 1.06, ancestralBonus: 0.004 },
    },
    {
      id: 'martial_kingdom',
      branch: 'martial',
      tier: 4,
      name: 'Legion Inheritance',
      cost: 120,
      wave: KINGDOM_WAVE,
      prereq: ['martial_ancestral'],
      desc: 'Kingdom era — the same host inherits imperial rank.',
      effects: { playerDmgMult: 1.08, hpMult: 1.06 },
    },
    {
      id: 'martial_honor_plate',
      branch: 'martial',
      tier: 5,
      name: 'Honor Plate Theory',
      cost: 160,
      wave: GALACTIC_WAVE,
      prereq: ['martial_kingdom'],
      desc: 'Power armor, sword and shield — honor demands the blade.',
      effects: { playerDmgMult: 1.1, hpMult: 1.1, honorPlate: true },
    },
    {
      id: 'martial_apex',
      branch: 'martial',
      tier: 6,
      name: 'Eternal Blade Mandate',
      cost: 200,
      wave: APEX_WAVE,
      prereq: ['martial_honor_plate'],
      desc: 'Apex capstone — hyper-evolved knights never break formation.',
      effects: { playerDmgMult: 1.12, hpMult: 1.12 },
    },

    // ── Arcane ──
    {
      id: 'arcane_root',
      branch: 'arcane',
      tier: 1,
      name: 'Arcane Root',
      cost: 40,
      wave: ROOT_LOCK_WAVE,
      desc: 'Commit the Crown to ley science and scholarch rule.',
      effects: { scienceGainMult: 1.06, researchSpeedMult: 1.04 },
    },
    {
      id: 'arcane_ley',
      branch: 'arcane',
      tier: 2,
      name: 'Ley Sensitivity',
      cost: 52,
      wave: 55,
      prereq: ['arcane_root'],
      desc: 'Kill analysis yields richer science from arcane foes.',
      effects: { scienceGainMult: 1.08 },
    },
    {
      id: 'arcane_tower',
      branch: 'arcane',
      tier: 2,
      name: 'Mage Tower Theory',
      cost: 58,
      wave: 60,
      prereq: ['arcane_root'],
      desc: 'Mages and wizards gain range and damage.',
      effects: { mageDmgMult: 1.08, playerDmgMult: 1.03 },
    },
    {
      id: 'arcane_enchant',
      branch: 'arcane',
      tier: 2,
      name: 'Enchanted Plating',
      cost: 60,
      wave: 65,
      prereq: ['arcane_ley'],
      desc: 'Arcane troops gain protective wards.',
      effects: { mageHpMult: 1.08, hpMult: 1.03 },
    },
    {
      id: 'arcane_scholarch',
      branch: 'arcane',
      tier: 3,
      name: 'Scholarch Council',
      cost: 88,
      wave: 90,
      prereq: ['arcane_tower', 'arcane_enchant'],
      desc: 'Research speed compounds — academies steer the realm.',
      effects: { researchSpeedMult: 1.1, scienceGainMult: 1.06 },
    },
    {
      id: 'arcane_infusion',
      branch: 'arcane',
      tier: 3,
      name: 'Arcane Infusion',
      cost: 100,
      wave: 120,
      prereq: ['arcane_scholarch'],
      desc: 'Tech tree becomes arcane-infused stellar science.',
      effects: { researchSpeedMult: 1.08, fleetDmgMult: 1.05 },
      techTreeLabel: 'Arcane-Infused Technology',
    },
    {
      id: 'arcane_kingdom',
      branch: 'arcane',
      tier: 4,
      name: 'Reality Weave Prep',
      cost: 125,
      wave: KINGDOM_WAVE,
      prereq: ['arcane_infusion'],
      desc: 'Kingdom era — wizard-kings inherit the scholarch crown.',
      effects: { playerDmgMult: 1.08, fleetDmgMult: 1.08 },
    },
    {
      id: 'arcane_wizard_king',
      branch: 'arcane',
      tier: 5,
      name: 'Wizard-King Protocol',
      cost: 165,
      wave: GALACTIC_WAVE,
      prereq: ['arcane_kingdom'],
      desc: 'Reality-warping fleets bend assault composition.',
      effects: { fleetDmgMult: 1.12, fleetCountRelief: 0.02, playerDmgMult: 1.1 },
    },
    {
      id: 'arcane_apex',
      branch: 'arcane',
      tier: 6,
      name: 'Cosmic Sorcery',
      cost: 210,
      wave: APEX_WAVE,
      prereq: ['arcane_wizard_king'],
      desc: 'Apex capstone — local physics obeys the Crown.',
      effects: { playerDmgMult: 1.14, fleetDmgMult: 1.15, researchSpeedMult: 1.12 },
    },

    // ── Mythic (Crossover) ──
    {
      id: 'mythic_root',
      branch: 'mythic',
      tier: 1,
      name: 'Mythic Root',
      cost: 45,
      wave: ROOT_LOCK_WAVE,
      desc: 'Commit the Crown to crossover champions and living legends.',
      effects: { mythicMorale: 3, playerDmgMult: 1.04 },
    },
    {
      id: 'mythic_charter',
      branch: 'mythic',
      tier: 2,
      name: 'Crossover Charter',
      cost: 60,
      wave: 55,
      prereq: ['mythic_root'],
      desc: 'Faction research costs −8% — alliances form faster.',
      effects: { crossoverCostMult: 0.92 },
    },
    {
      id: 'mythic_embassy',
      branch: 'mythic',
      tier: 2,
      name: 'Faction Embassy',
      cost: 65,
      wave: 60,
      prereq: ['mythic_root'],
      desc: 'Crossover operatives gain morale and HP.',
      effects: { mythicMorale: 4, mythicHpMult: 1.06 },
    },
    {
      id: 'mythic_legend',
      branch: 'mythic',
      tier: 3,
      name: 'Living Legend Doctrine',
      cost: 90,
      wave: 80,
      prereq: ['mythic_charter', 'mythic_embassy'],
      desc: 'Early heroes canonize faster into mythic figures.',
      effects: { legendPowerMult: 1.15, playerDmgMult: 1.05 },
    },
    {
      id: 'mythic_echo',
      branch: 'mythic',
      tier: 3,
      name: 'Hero Echo Protocol',
      cost: 105,
      wave: 120,
      prereq: ['mythic_legend'],
      desc: 'Kingdom era preview — echo recruitment discounts.',
      effects: { echoCostMult: 0.9, fleetReadiness: 4 },
    },
    {
      id: 'mythic_kingdom',
      branch: 'mythic',
      tier: 4,
      name: 'Pantheon Compact',
      cost: 130,
      wave: KINGDOM_WAVE,
      prereq: ['mythic_echo'],
      desc: 'Champions lead armies as mythic advisors.',
      effects: { playerDmgMult: 1.1, mythicMorale: 5 },
    },
    {
      id: 'mythic_fleet',
      branch: 'mythic',
      tier: 5,
      name: 'Dimensional Fleet Treaty',
      cost: 170,
      wave: GALACTIC_WAVE,
      prereq: ['mythic_kingdom'],
      desc: 'Fleet legends command battle groups across the void.',
      effects: { fleetStrength: 0.1, fleetReadiness: 8 },
    },
    {
      id: 'mythic_apex',
      branch: 'mythic',
      tier: 6,
      name: 'Godblood Dynasty',
      cost: 220,
      wave: APEX_WAVE,
      prereq: ['mythic_fleet'],
      desc: 'Apex capstone — crossover gods advise the eternal Crown.',
      effects: { playerDmgMult: 1.12, fleetDmgMult: 1.1, mythicMorale: 6 },
    },

    // ── Tech ──
    {
      id: 'tech_root',
      branch: 'tech',
      tier: 1,
      name: 'Tech Root',
      cost: 38,
      wave: ROOT_LOCK_WAVE,
      desc: 'Commit the Crown to labs, logistics, and stellar industry.',
      effects: { researchSpeedMult: 1.06, scienceGainMult: 1.05 },
    },
    {
      id: 'tech_industrial',
      branch: 'tech',
      tier: 2,
      name: 'Industrial Survey',
      cost: 50,
      wave: 55,
      prereq: ['tech_root'],
      desc: 'Quarries and trade posts yield bonus science.',
      effects: { scienceGainMult: 1.08 },
    },
    {
      id: 'tech_logistics',
      branch: 'tech',
      tier: 2,
      name: 'Logistics Grid',
      cost: 54,
      wave: 60,
      prereq: ['tech_root'],
      desc: 'Builders and couriers move faster — macro efficiency.',
      effects: { buildSpeedMult: 1.12, tpBonus: 1 },
    },
    {
      id: 'tech_automation',
      branch: 'tech',
      tier: 2,
      name: 'Automation Theory',
      cost: 58,
      wave: 65,
      prereq: ['tech_industrial'],
      desc: 'Academy output +1 cadence on tech-aligned halls.',
      effects: { academyBonus: 1, researchSpeedMult: 1.05 },
    },
    {
      id: 'tech_macro',
      branch: 'tech',
      tier: 3,
      name: 'Macro Doctrine',
      cost: 82,
      wave: 90,
      prereq: ['tech_logistics', 'tech_automation'],
      desc: 'Settlement ladder grants +5% TP income.',
      effects: { tpIncomeMult: 1.05, researchSpeedMult: 1.08 },
    },
    {
      id: 'tech_stellar',
      branch: 'tech',
      tier: 3,
      name: 'Stellar Engineering',
      cost: 98,
      wave: 120,
      prereq: ['tech_macro'],
      desc: 'Stellar engineering tree unlocks — pure applied science.',
      effects: { researchSpeedMult: 1.1, scienceGainMult: 1.08 },
      techTreeLabel: 'Stellar Engineering Tree',
    },
    {
      id: 'tech_kingdom',
      branch: 'tech',
      tier: 4,
      name: 'Imperial Foundry',
      cost: 118,
      wave: KINGDOM_WAVE,
      prereq: ['tech_stellar'],
      desc: 'Kingdom era — macro empire runs on industrial doctrine.',
      effects: { researchSpeedMult: 1.12, scienceGainMult: 1.1 },
    },
    {
      id: 'tech_megastructure',
      branch: 'tech',
      tier: 5,
      name: 'Megastructure Protocol',
      cost: 155,
      wave: GALACTIC_WAVE,
      prereq: ['tech_kingdom'],
      desc: 'Fleet readiness and hull efficiency from pure engineering.',
      effects: { fleetReadiness: 10, fleetDmgMult: 1.08 },
    },
    {
      id: 'tech_apex',
      branch: 'tech',
      tier: 6,
      name: 'Singularity Crown',
      cost: 205,
      wave: APEX_WAVE,
      prereq: ['tech_megastructure'],
      desc: 'Apex capstone — the Crown as a civilization-scale machine.',
      effects: { researchSpeedMult: 1.15, scienceGainMult: 1.15, fleetDmgMult: 1.12 },
    },
  ];

  const BY_ID = Object.fromEntries(BRANCH_NODES.map((n) => [n.id, n]));

  let state = null;
  let rootAnnounced = false;

  function defaultState() {
    return {
      rootId: null,
      rootLocked: false,
      lockedAtWave: 0,
      invested: new Set(),
      activeId: null,
      activeProgress: 0,
      log: [],
    };
  }

  function resetRun() {
    state = defaultState();
    state.invested = new Set();
    rootAnnounced = false;
  }

  function getTechScore() {
    let score = 0;
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const snap = FoundationalMedievalLayer.getRunSnapshot?.();
      if (snap?.builds?.research_lab) score += (snap.builds.research_lab || 0) * 14;
      if (snap?.scienceEarned) score += Math.floor(snap.scienceEarned * 0.5);
      for (const b of ['quarry', 'hamlet', 'trade_outpost', 'merchant_guild', 'village', 'town']) {
        if (snap?.builds?.[b]) score += (snap.builds[b] || 0) * 6;
      }
      const research = snap?.researchCount || snap?.research?.length || 0;
      score += research * 6;
    }
    if (typeof Research !== 'undefined') {
      score += (Research.completedCount || 0) * 5;
    }
    return score;
  }

  function evaluateRootScores() {
    const scores = { martial: 0, arcane: 0, mythic: 0, tech: 0 };
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const snap = FoundationalMedievalLayer.getRunSnapshot?.();
      if (snap?.scores) {
        scores.martial = snap.scores.longbow_legacy || 0;
        scores.arcane = snap.scores.arcane_dominion || 0;
        scores.mythic = snap.scores.mythic_alliance || 0;
      }
    }
    scores.tech = getTechScore();
    return scores;
  }

  function pickLeadingRoot(scores) {
    let best = 'tech';
    let bestScore = -1;
    for (const [id, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    if (bestScore < 8) return 'martial';
    return best;
  }

  function lockRootBranch(rootId, wave, ctx = {}) {
    if (!state || state.rootLocked || !ROOT_BRANCHES[rootId]) return null;
    state.rootId = rootId;
    state.rootLocked = true;
    state.lockedAtWave = wave;
    const def = ROOT_BRANCHES[rootId];
    const msg = `Tech tree root locked — ${def.label}. ${def.desc}`;
    state.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 420);
    ctx.addHighlight?.('milestone', `${def.short} root — giant branch unlocked`);
    if (typeof TechPathEvolution !== 'undefined' && rootId === 'tech') {
      TechPathEvolution.recordRootLock(wave);
    }
    return def;
  }

  function resolveRootAtWave(wave, ctx = {}) {
    if (!state || state.rootLocked || wave < ROOT_LOCK_WAVE) return null;
    const scores = evaluateRootScores();
    const rootId = pickLeadingRoot(scores);
    return lockRootBranch(rootId, wave, ctx);
  }

  function getRootId() {
    return state?.rootId || null;
  }

  function getRootDef() {
    const id = getRootId();
    return id ? ROOT_BRANCHES[id] : null;
  }

  function getNodesForBranch(branchId = null) {
    const root = branchId || getRootId();
    if (!root) return [];
    return BRANCH_NODES.filter((n) => n.branch === root);
  }

  function prereqsMet(node, wave) {
    if ((node.wave || 0) > (wave | 0)) return false;
    if (!state?.rootLocked || node.branch !== state.rootId) return false;
    for (const p of node.prereq || []) {
      if (!state.invested.has(p)) return false;
    }
    return true;
  }

  function getCombinedEffects(wave = 0) {
    const out = {
      playerDmgMult: 1,
      hpMult: 1,
      archerDmgMult: 1,
      footmanHpMult: 1,
      mageDmgMult: 1,
      mageHpMult: 1,
      mythicHpMult: 1,
      mythicMorale: 0,
      researchSpeedMult: 1,
      scienceGainMult: 1,
      fleetDmgMult: 1,
      fleetReadiness: 0,
      fleetStrength: 0,
      fleetCountRelief: 0,
      siegeMult: 1,
      buildSpeedMult: 1,
      tpIncomeMult: 1,
      crossoverCostMult: 1,
      echoCostMult: 1,
      legendPowerMult: 1,
      ancestralBonus: 0,
      techTreeLabel: null,
    };
    if (!state?.rootLocked) return out;
    for (const id of state.invested) {
      const node = BY_ID[id];
      if (!node?.effects) continue;
      const e = node.effects;
      if (e.playerDmgMult) out.playerDmgMult *= e.playerDmgMult;
      if (e.hpMult) out.hpMult *= e.hpMult;
      if (e.archerDmgMult) out.archerDmgMult *= e.archerDmgMult;
      if (e.footmanHpMult) out.footmanHpMult *= e.footmanHpMult;
      if (e.mageDmgMult) out.mageDmgMult *= e.mageDmgMult;
      if (e.mageHpMult) out.mageHpMult *= e.mageHpMult;
      if (e.mythicHpMult) out.mythicHpMult *= e.mythicHpMult;
      if (e.mythicMorale) out.mythicMorale += e.mythicMorale;
      if (e.researchSpeedMult) out.researchSpeedMult *= e.researchSpeedMult;
      if (e.scienceGainMult) out.scienceGainMult *= e.scienceGainMult;
      if (e.fleetDmgMult) out.fleetDmgMult *= e.fleetDmgMult;
      if (e.fleetReadiness) out.fleetReadiness += e.fleetReadiness;
      if (e.fleetStrength) out.fleetStrength += e.fleetStrength;
      if (e.fleetCountRelief) out.fleetCountRelief += e.fleetCountRelief;
      if (e.siegeMult) out.siegeMult *= e.siegeMult;
      if (e.buildSpeedMult) out.buildSpeedMult *= e.buildSpeedMult;
      if (e.tpIncomeMult) out.tpIncomeMult *= e.tpIncomeMult;
      if (e.crossoverCostMult) out.crossoverCostMult *= e.crossoverCostMult;
      if (e.echoCostMult) out.echoCostMult *= e.echoCostMult;
      if (e.legendPowerMult) out.legendPowerMult *= e.legendPowerMult;
      if (e.ancestralBonus) out.ancestralBonus += e.ancestralBonus;
      if (node.techTreeLabel) out.techTreeLabel = node.techTreeLabel;
    }
    const root = getRootDef();
    if (!out.techTreeLabel && root?.techTreeLabel) out.techTreeLabel = root.techTreeLabel;
    return out;
  }

  function getTechTreeLabel() {
    return getCombinedEffects().techTreeLabel || getRootDef()?.techTreeLabel || null;
  }

  function applyScienceProgress(amount, ctx = {}) {
    if (!state?.activeId || amount <= 0) return false;
    const node = BY_ID[state.activeId];
    if (!node) {
      state.activeId = null;
      state.activeProgress = 0;
      return false;
    }
    state.activeProgress += amount;
    if (state.activeProgress >= node.cost) {
      completeInvest(state.activeId, ctx);
      state.activeId = null;
      state.activeProgress = 0;
      return true;
    }
    return false;
  }

  function completeInvest(id, ctx = {}) {
    if (!state || state.invested.has(id)) return false;
    const node = BY_ID[id];
    if (!node) return false;
    state.invested.add(id);
    const msg = `Branch tech — ${node.name} invested. ${node.desc}`;
    state.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 320);
    if (typeof TechPathEvolution !== 'undefined') {
      TechPathEvolution.recordBranchInvest(id, ctx.wave);
    }
    if (typeof UI !== 'undefined') UI.updateHUD?.(true);
    return true;
  }

  function startInvest(id, wave, ctx = {}) {
    if (!state?.rootLocked) {
      ctx.showMessage?.('Root branch locks at wave 50.', 220);
      return false;
    }
    if (state.invested.has(id)) return false;
    if (state.activeId && state.activeId !== id) {
      ctx.showMessage?.('Finish or cancel the current branch project first.', 220);
      return false;
    }
    if (typeof Research !== 'undefined' && Research.getActiveInfo?.()) {
      ctx.showMessage?.('Finish core research before starting branch tech.', 220);
      return false;
    }
    const node = BY_ID[id];
    if (!node || !prereqsMet(node, wave)) {
      ctx.showMessage?.('Branch prerequisites or wave not met.', 200);
      return false;
    }
    if (typeof Research !== 'undefined' && Research.countLabs?.(ctx.buildings) <= 0) {
      ctx.showMessage?.('Build a Research Lab to invest branch tech.', 220);
      return false;
    }
    state.activeId = id;
    state.activeProgress = 0;
    ctx.showMessage?.(`Branch tech started: ${node.name} (${node.cost} SP)`, 260);
    return true;
  }

  function cancelInvest(ctx = {}) {
    if (!state?.activeId) return false;
    const name = BY_ID[state.activeId]?.name || 'Branch tech';
    state.activeId = null;
    state.activeProgress = 0;
    ctx.showMessage?.(`Cancelled branch: ${name}`, 160);
    return true;
  }

  function getNodesForUI(wave) {
    const root = getRootDef();
    const allRoots = Object.values(ROOT_BRANCHES);
    const activeBranch = getNodesForBranch();
    const otherRoots = state?.rootLocked
      ? allRoots.filter((r) => r.id !== state.rootId)
      : allRoots;

    const branchNodes = activeBranch.map((node) => {
      const done = state?.invested?.has(node.id);
      const active = state?.activeId === node.id;
      const locked = !done && !prereqsMet(node, wave);
      return {
        ...node,
        done,
        active,
        locked,
        progress: active ? state.activeProgress : 0,
        pct: active && node.cost ? Math.min(100, Math.round((state.activeProgress / node.cost) * 100)) : 0,
        category: 'branch',
        tierLabel: `T${node.tier}`,
        prereqLine: node.prereq?.length
          ? `Requires: ${node.prereq.map((id) => BY_ID[id]?.name || id).join(', ')}`
          : 'Root node',
      };
    });

    return {
      root,
      rootLocked: !!state?.rootLocked,
      pendingRoot: !state?.rootLocked && wave >= ROOT_LOCK_WAVE - 10,
      scores: evaluateRootScores(),
      branchNodes,
      otherRoots,
      activeInfo: state?.activeId
        ? {
            id: state.activeId,
            name: BY_ID[state.activeId]?.name,
            progress: state.activeProgress,
            cost: BY_ID[state.activeId]?.cost,
            pct: Math.min(
              100,
              Math.round((state.activeProgress / (BY_ID[state.activeId]?.cost || 1)) * 100)
            ),
          }
        : null,
      effects: getCombinedEffects(wave),
    };
  }

  function renderBranchPanel(wave, buildings) {
    const mount = document.getElementById('tech-branch-tree');
    if (!mount) return;
    const ui = getNodesForUI(wave);
    const rootLine = ui.rootLocked
      ? `<p class="tech-branch-root locked" style="border-color:${ui.root?.color}">ROOT: <strong>${ui.root?.label}</strong> — ${ui.root?.epithet}</p>`
      : `<p class="tech-branch-root pending">Root locks wave <strong>${ROOT_LOCK_WAVE}</strong> — leading: ${Object.entries(ui.scores)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${ROOT_BRANCHES[k]?.short || k} ${v}`)
          .join(' · ')}</p>`;

    const tiers = [1, 2, 3, 4, 5, 6];
    const tierBlocks = tiers
      .map((tier) => {
        const items = ui.branchNodes.filter((n) => n.tier === tier);
        if (!items.length) return '';
        return `
        <div class="tech-branch-tier">
          <div class="tech-branch-tier-label">Tier ${tier}</div>
          <div class="tech-branch-tier-nodes">
            ${items
              .map(
                (n) => `
              <button type="button" class="tech-branch-node ${n.done ? 'done' : ''} ${n.active ? 'active' : ''} ${n.locked ? 'locked' : ''}"
                data-branch-tech="${n.id}" ${n.done || n.locked || (state?.activeId && !n.active) ? 'disabled' : ''}
                title="${n.desc || ''}">
                <span class="tech-branch-node-name">${n.name}</span>
                <span class="tech-branch-node-cost">${n.done ? '✓' : `${n.cost} SP`}</span>
                <span class="tech-branch-node-desc">${n.desc || ''}</span>
              </button>`
              )
              .join('')}
          </div>
        </div>`;
      })
      .join('');

    const roadsNotTaken = ui.rootLocked
      ? `<p class="tech-branch-roads">Roads not taken: ${ui.otherRoots.map((r) => r.short).join(', ')}</p>`
      : `<div class="tech-branch-preview">${ui.otherRoots
          .map(
            (r) =>
              `<span class="tech-branch-preview-chip" style="border-color:${r.color}">${r.short}</span>`
          )
          .join('')}</div>`;

    const fx = ui.effects;
    const fxLine = ui.rootLocked
      ? [
          fx.researchSpeedMult > 1 ? `Research ×${fx.researchSpeedMult.toFixed(2)}` : null,
          fx.playerDmgMult > 1 ? `Dmg ×${fx.playerDmgMult.toFixed(2)}` : null,
          fx.techTreeLabel ? fx.techTreeLabel : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

    mount.innerHTML = `
      <div class="tech-branch-head">GIANT BRANCHING TECH</div>
      ${rootLine}
      ${fxLine ? `<p class="tech-branch-fx">${fxLine}</p>` : ''}
      ${roadsNotTaken}
      <div class="tech-branch-tiers">${tierBlocks || '<p class="tech-branch-hint">Root locks at wave 50.</p>'}</div>`;

    mount.querySelectorAll('[data-branch-tech]').forEach((btn) => {
      btn.onclick = () => {
        if (typeof Game !== 'undefined' && Game.startBranchTech) {
          Game.startBranchTech(btn.dataset.branchTech);
        }
      };
    });
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state) resetRun();
    if (ctx.creative) return null;
    if (wave === ROOT_LOCK_WAVE && !state.rootLocked) {
      resolveRootAtWave(wave, ctx);
      rootAnnounced = true;
    }
    if (wave > ROOT_LOCK_WAVE && !state.rootLocked) resolveRootAtWave(wave, ctx);
    return getStateSnapshot({ wave });
  }

  function onRunStart(ctx = {}) {
    resetRun();
    if (!ctx.creative) {
      ctx.showMessage?.(
        'Giant tech tree — Martial, Arcane, Mythic, or Tech root locks at wave 50 from your early choices.',
        400
      );
    }
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    const ui = getNodesForUI(wave);
    return {
      rootId: state?.rootId || null,
      rootLabel: ui.root?.label || null,
      rootColor: ui.root?.color || null,
      rootLocked: !!state?.rootLocked,
      investedCount: state?.invested?.size || 0,
      techTreeLabel: getTechTreeLabel(),
      effects: getCombinedEffects(wave),
      scores: ui.scores,
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!state?.rootLocked) {
      if (wave >= ROOT_LOCK_WAVE - 15) return 'Root ?';
      return '';
    }
    const def = getRootDef();
    const n = state.invested?.size || 0;
    return `${def?.short || 'Branch'} ${n}/${getNodesForBranch().length}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!state?.rootLocked) {
      if (wave >= ROOT_LOCK_WAVE - 5) return `Tech root locks wave ${ROOT_LOCK_WAVE}`;
      return '';
    }
    const label = getTechTreeLabel();
    const parts = [`${getRootDef()?.short || state.rootId} tech`];
    if (label) parts.push(label.toLowerCase());
    if (state.invested?.size) parts.push(`${state.invested.size} branch node(s)`);
    return `Tech: ${parts.join(', ')}`;
  }

  resetRun();

  return {
    ROOT_BRANCHES,
    BRANCH_NODES,
    ROOT_LOCK_WAVE,
    resetRun,
    onRunStart,
    onWaveStart,
    evaluateRootScores,
    lockRootBranch,
    resolveRootAtWave,
    getRootId,
    getRootDef,
    getNodesForBranch,
    getCombinedEffects,
    getTechTreeLabel,
    applyScienceProgress,
    startInvest,
    cancelInvest,
    completeInvest,
    getNodesForUI,
    renderBranchPanel,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.TechTreeBranches = TechTreeBranches;
