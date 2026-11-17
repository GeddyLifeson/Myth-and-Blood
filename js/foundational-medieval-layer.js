/**
 * Foundational Medieval Layer: what the player has fielded, built and researched this run.
 * It grants nothing in battle. TechTreeBranches reads the tally to pick its root, the
 * crown thread names the line after it, and the Crown of Ages seed branches unlock when a
 * chosen path is completed (RunPath calls markCrystallized).
 */
const FoundationalMedievalLayer = (() => {
  const STORAGE_KEY = 'myth-and-blood-foundational-medieval-v1';
  const WAVE_MAX = 150;
  const WAVE_MIN_TRACK = 1;

  const PATHS = {
    longbow_legacy: {
      id: 'longbow_legacy',
      label: 'Longbow Legacy',
      short: 'LONGBOW',
      epithet: 'the Longbow Legacy',
      desc: 'Heavy archer & footman investment — volley culture endures every era.',
      color: '#60a060',
      eternalBranch: 'iron_crown',
      seedNodeId: 'seed_longbow_legacy',
    },
    arcane_dominion: {
      id: 'arcane_dominion',
      label: 'Arcane Dominion',
      short: 'ARCANE',
      epithet: 'the Arcane Dominion',
      desc: 'Magic academies & research — scholarly power compounds forever.',
      color: '#8060e0',
      eternalBranch: 'arcane_scholar',
      seedNodeId: 'seed_arcane_dominion',
    },
    mythic_alliance: {
      id: 'mythic_alliance',
      label: 'Mythic Alliance',
      short: 'MYTHIC',
      epithet: 'the Mythic Alliance',
      desc: 'Crossover heroes & mythic champions — alliances echo across ages.',
      color: '#e0a040',
      eternalBranch: 'pragmatist',
      seedNodeId: 'seed_mythic_alliance',
    },
  };

  const LONGBOW_TYPES = new Set(['footman', 'archer', 'pikeman', 'ballista', 'scout']);
  const ARCANE_TYPES = new Set(['mage', 'wizard', 'warlock', 'elemental', 'cleric', 'healer']);
  const ARCANE_BUILDINGS = new Set(['research_lab', 'training_ground']);
  const ARCANE_RESEARCH = new Set([
    'academy_charter',
    'academy_knights',
    'academy_support',
    'academy_elite',
    'academy_command',
    'arcane_weapons',
    'mage_tower',
  ]);

  let persistent = {
    crystallized: {},
    lastCrystallized: null,
    totalCrystallizations: 0,
  };

  let run = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) persistent = { ...persistent, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    if (!persistent.crystallized || typeof persistent.crystallized !== 'object') {
      persistent.crystallized = {};
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent));
    } catch (_) {
      /* ignore */
    }
  }

  function resetRun() {
    run = {
      wave: 0,
      deploys: {},
      kills: {},
      builds: {},
      research: [],
      scienceEarned: 0,
      mythicHeroes: {},
      factions: new Set(),
      scores: { longbow_legacy: 0, arcane_dominion: 0, mythic_alliance: 0 },
      leading: null,
      crystallizedThisRun: false,
      creative: false,
    };
  }

  function isActiveWave(wave) {
    return (wave | 0) >= WAVE_MIN_TRACK && (wave | 0) <= WAVE_MAX;
  }

  function isMythicType(type) {
    if (!type) return false;
    if (type === 'doomslayer_hero') return true;
    if (typeof isChampionUnit === 'function' && isChampionUnit(type)) return true;
    if (typeof isCompanyHeroUnit === 'function' && isCompanyHeroUnit(type)) return true;
    return type.startsWith('xf_');
  }

  function bumpScore(pathId, amount) {
    if (!run || run.creative || !pathId) return;
    run.scores[pathId] = (run.scores[pathId] || 0) + amount;
    refreshLeading();
  }

  function refreshLeading() {
    if (!run) return null;
    let best = null;
    let bestScore = 0;
    for (const [id, score] of Object.entries(run.scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    run.leading = bestScore >= 6 ? best : null;
    return run.leading;
  }

  function recordDeploy(type, wave = 0) {
    if (!run || run.creative || !isActiveWave(wave)) return;
    run.deploys[type] = (run.deploys[type] || 0) + 1;
    if (LONGBOW_TYPES.has(type)) bumpScore('longbow_legacy', 2);
    if (ARCANE_TYPES.has(type)) bumpScore('arcane_dominion', 3);
    if (isMythicType(type)) {
      run.mythicHeroes[type] = (run.mythicHeroes[type] || 0) + 1;
      bumpScore('mythic_alliance', 5);
    }
  }

  function recordKill(killerType, wave = 0) {
    if (!run || run.creative || !isActiveWave(wave) || !killerType) return;
    run.kills[killerType] = (run.kills[killerType] || 0) + 1;
    if (LONGBOW_TYPES.has(killerType)) bumpScore('longbow_legacy', 1);
    if (ARCANE_TYPES.has(killerType)) bumpScore('arcane_dominion', 1);
    if (isMythicType(killerType)) bumpScore('mythic_alliance', 2);
  }

  function recordBuild(buildType, wave = 0) {
    if (!run || run.creative || !isActiveWave(wave) || !buildType) return;
    run.builds[buildType] = (run.builds[buildType] || 0) + 1;
    if (buildType === 'research_lab') bumpScore('arcane_dominion', 8);
    if (ARCANE_BUILDINGS.has(buildType)) bumpScore('arcane_dominion', 5);
  }

  function recordResearch(researchId, wave = 0) {
    if (!run || run.creative || !isActiveWave(wave) || !researchId) return;
    if (run.research.includes(researchId)) return;
    run.research.push(researchId);
    if (ARCANE_RESEARCH.has(researchId)) bumpScore('arcane_dominion', 6);
    if (researchId.startsWith('xf_')) bumpScore('mythic_alliance', 4);
  }

  function recordScience(amount, wave = 0) {
    if (!run || run.creative || !isActiveWave(wave)) return;
    const n = Math.max(0, Number(amount) || 0);
    run.scienceEarned += n;
    bumpScore('arcane_dominion', Math.floor(n * 0.4));
  }

  function recordFaction(factionId, wave = 0) {
    if (!run || run.creative || !isActiveWave(wave) || !factionId) return;
    if (run.factions.has(factionId)) return;
    run.factions.add(factionId);
    bumpScore('mythic_alliance', 8);
  }

  function onRunStart(ctx = {}) {
    load();
    resetRun();
    run.creative = !!ctx.creative;
  }

  function onWaveStart(wave) {
    if (run && !run.creative) run.wave = wave | 0;
  }

  /** Record a completed path; unlocks its Crown of Ages seed branch on the main menu. */
  function markCrystallized(pathId) {
    if (!PATHS[pathId] || run?.crystallizedThisRun) return false;
    load();
    persistent.crystallized[pathId] = (persistent.crystallized[pathId] || 0) + 1;
    persistent.totalCrystallizations = (persistent.totalCrystallizations || 0) + 1;
    persistent.lastCrystallized = { pathId, label: PATHS[pathId].label, wave: run?.wave || 0 };
    if (run) run.crystallizedThisRun = true;
    save();
    if (typeof EternalLegacyTree !== 'undefined') EternalLegacyTree.refreshUnlocks?.();
    return true;
  }

  function hasCrystallizedPath(pathId) {
    load();
    return (persistent.crystallized[pathId] || 0) > 0;
  }

  function getCrystallizedPaths() {
    load();
    return Object.entries(persistent.crystallized)
      .filter(([, n]) => n > 0)
      .map(([id, count]) => ({ id, count, ...PATHS[id] }));
  }

  function getRunSnapshot() {
    if (!run) return { active: false };
    refreshLeading();
    const leading = run.leading ? PATHS[run.leading] : null;
    return {
      active: isActiveWave(run.wave),
      wave: run.wave,
      scores: { ...run.scores },
      deploys: { ...run.deploys },
      kills: { ...run.kills },
      builds: { ...run.builds },
      scienceEarned: run.scienceEarned || 0,
      leading: run.leading,
      leadingLabel: leading?.label || null,
      leadingShort: leading?.short || null,
      leadingColor: leading?.color || null,
      mythicHeroes: Object.keys(run.mythicHeroes),
      researchCount: run.research?.length || 0,
      crystallizedThisRun: run.crystallizedThisRun,
    };
  }

  function getRunSnapshot() {
    if (!run) return { active: false };
    refreshLeading();
    const leading = run.leading ? PATHS[run.leading] : null;
    return {
      active: isActiveWave(run.wave),
      wave: run.wave,
      scores: { ...run.scores },
      deploys: { ...run.deploys },
      kills: { ...run.kills },
      builds: { ...run.builds },
      scienceEarned: run.scienceEarned || 0,
      leading: run.leading,
      leadingLabel: leading?.label || null,
      leadingShort: leading?.short || null,
      leadingColor: leading?.color || null,
      mythicHeroes: Object.keys(run.mythicHeroes),
      researchCount: run.research?.length || 0,
      crystallizedThisRun: run.crystallizedThisRun,
    };
  }

  // Battle effects moved to RunPath; these stay so older callers read neutral values.
  const NEUTRAL = Object.freeze({ archerDmgMult: 1, scienceGainMult: 1, mythicMorale: 0 });
  const getRunModifiers = () => NEUTRAL;
  const onWaveComplete = () => null;
  const onRunEnd = () => null;
  const getStateSnapshot = () => null;
  const formatHudLine = () => '';
  const formatIntelNote = () => '';

  load();

  // Run state in saves: see js/save-registry.js. The shape is unchanged from version 1.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('FoundationalMedievalLayer', {
      save: () => ({ run }),
      load(data) {
        resetRun();
        if (!data) return;
        if (data.run && typeof data.run === 'object') run = { ...run, ...data.run };
      },
    });
  }

  return {
    PATHS,
    resetRun,
    onRunStart,
    onWaveComplete,
    onWaveStart,
    onRunEnd,
    recordDeploy,
    recordKill,
    recordBuild,
    recordResearch,
    recordScience,
    recordFaction,
    markCrystallized,
    hasCrystallizedPath,
    getCrystallizedPaths,
    getRunSnapshot,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    getRunModifiers,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FoundationalMedievalLayer = FoundationalMedievalLayer;
