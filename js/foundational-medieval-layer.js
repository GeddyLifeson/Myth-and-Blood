/**
 * Foundational Medieval Layer (Waves 1–150) — pure tactical era.
 * Tracks cultural/thematic DNA: Longbow Legacy, Arcane Dominion, Mythic Alliance.
 * Crystallized paths unlock early Crown of Ages branches.
 */
const FoundationalMedievalLayer = (() => {
  const STORAGE_KEY = 'myth-and-blood-foundational-medieval-v1';
  const WAVE_MAX = 150;
  const WAVE_MIN_TRACK = 1;
  const CRYSTALLIZE_MIN_SCORE = 18;

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
  const ARCANE_BUILDINGS = new Set([
    'research_lab',
    'academy_footman',
    'academy_archer',
    'academy_mage',
    'academy_knight',
    'academy_healer',
    'academy_builder',
    'academy_courier',
    'academy_scout',
    'academy_bard',
    'academy_ballista',
    'academy_pikeman',
    'academy_general',
    'academy_sapper',
    'academy_cavalry',
  ]);
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
    if (typeof isWweUnit === 'function' && isWweUnit(type)) return true;
    if (typeof isCrossoverUnit === 'function' && isCrossoverUnit(type)) return true;
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

  function onWaveComplete(wave, ctx = {}) {
    if (!run || run.creative) return null;
    run.wave = wave | 0;
    if (wave === 75 && run.leading) {
      const path = PATHS[run.leading];
      ctx.showMessage?.(
        `Foundational era — ${path?.label || run.leading} culture strengthens (wave ${wave}).`,
        300
      );
    }
    if (wave >= WAVE_MAX) return crystallize(ctx);
    return null;
  }

  function onWaveStart(wave, ctx = {}) {
    if (!run || run.creative) return null;
    run.wave = wave | 0;
    if (wave === WAVE_MAX && !run.crystallizedThisRun) {
      return crystallize(ctx);
    }
    return null;
  }

  function crystallize(ctx = {}) {
    if (!run || run.crystallizedThisRun) return null;
    load();
    refreshLeading();
    const pathId = run.leading;
    const score = pathId ? run.scores[pathId] || 0 : 0;
    if (!pathId || score < CRYSTALLIZE_MIN_SCORE) {
      if ((ctx.wave | 0) >= WAVE_MAX - 1) {
        ctx.showMessage?.(
          'Foundational era ends — no dominant cultural path crystallized. Invest heavily in one doctrine before wave 150.',
          340
        );
      }
      return null;
    }

    const path = PATHS[pathId];
    persistent.crystallized[pathId] = (persistent.crystallized[pathId] || 0) + 1;
    persistent.totalCrystallizations = (persistent.totalCrystallizations || 0) + 1;
    persistent.lastCrystallized = {
      pathId,
      label: path?.label,
      score,
      wave: run.wave || WAVE_MAX,
      at: Date.now(),
    };
    run.crystallizedThisRun = true;
    save();

    if (typeof EternalLegacyTree !== 'undefined') {
      EternalLegacyTree.refreshUnlocks?.();
    }

    if (!ctx.silent) {
      ctx.showMessage?.(
        `${path?.label || pathId} crystallized — Crown of Ages seed branch unlocked on the main menu.`,
        400
      );
    }
    ctx.addHighlight?.('era', path?.label || pathId);

    return { pathId, path, score, seedNodeId: path?.seedNodeId };
  }

  /**
   * Jump-in seed (§7) — act as if the player already finished the medieval foundation.
   * pathPreset: martial|arcane|tech|mythic (mapped onto Longbow/Arcane/Mythic DNA).
   */
  function bootstrapForWave(wave, ctx = {}) {
    const w = wave | 0;
    if (!run) resetRun();
    run.creative = false;
    run.wave = Math.min(WAVE_MAX, Math.max(w, WAVE_MAX));
    const preset = ctx.pathPreset || ctx.pathId || null;
    // Map eternal presets → foundational DNA ids
    const map = {
      martial: 'longbow_legacy',
      arcane: 'arcane_dominion',
      mythic: 'mythic_alliance',
      tech: 'arcane_dominion', // tech leans arcane foundation in this layer
      longbow_legacy: 'longbow_legacy',
      arcane_dominion: 'arcane_dominion',
      mythic_alliance: 'mythic_alliance',
    };
    const pathId = map[preset] || 'longbow_legacy';
    run.scores = {
      longbow_legacy: pathId === 'longbow_legacy' ? 40 : 8,
      arcane_dominion: pathId === 'arcane_dominion' ? 40 : 8,
      mythic_alliance: pathId === 'mythic_alliance' ? 40 : 8,
    };
    run.leading = pathId;
    if (w >= WAVE_MAX || w >= 100) {
      crystallize({ ...ctx, silent: true, wave: WAVE_MAX });
    }
    return { ok: true, pathId, scores: { ...run.scores }, crystallized: run.crystallizedThisRun };
  }

  function onRunEnd(ctx = {}) {
    if (!run || run.creative) return null;
    if (!run.crystallizedThisRun && run.wave >= 50) {
      return crystallize(ctx);
    }
    return null;
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

  function getPersistentSnapshot() {
    load();
    return {
      crystallized: { ...persistent.crystallized },
      lastCrystallized: persistent.lastCrystallized,
      totalCrystallizations: persistent.totalCrystallizations || 0,
      paths: getCrystallizedPaths(),
    };
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    return {
      ...getRunSnapshot(),
      persistent: getPersistentSnapshot(),
      hudLine: formatHudLine({ wave }),
      inFoundationalEra: isActiveWave(wave),
    };
  }

  function formatHudLine(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isActiveWave(wave) || !run) return '';
    refreshLeading();
    if (!run.leading) return `DNA ? · w${wave}`;
    const path = PATHS[run.leading];
    const score = run.scores[run.leading] || 0;
    return `${path?.short || 'DNA'} ${score} · w${wave}`;
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    if (!isActiveWave(wave) || !run) return '';
    if (wave === 50) return 'Foundational era — your cultural DNA is forming';
    if (wave === 100) return 'Halfway through the medieval foundation — path crystallizes at wave 150';
    if (wave === 140) return 'Ten waves to crystallize Longbow, Arcane, or Mythic path';
    if (wave >= WAVE_MAX && run.leading) {
      const path = PATHS[run.leading];
      return `${path?.label || 'Path'} crystallized — Crown of Ages seed unlocked`;
    }
    return '';
  }

  function getRunModifiers(wave = 0) {
    if (!run || run.creative || !isActiveWave(wave) || !run.leading) {
      return { archerDmgMult: 1, scienceGainMult: 1, mythicMorale: 0 };
    }
    if (run.leading === 'longbow_legacy') {
      return { archerDmgMult: 1.02, footmanHpMult: 1.02, scienceGainMult: 1, mythicMorale: 0 };
    }
    if (run.leading === 'arcane_dominion') {
      return { archerDmgMult: 1, scienceGainMult: 1.08, mythicMorale: 0 };
    }
    if (run.leading === 'mythic_alliance') {
      return { archerDmgMult: 1, scienceGainMult: 1, mythicMorale: 2 };
    }
    return { archerDmgMult: 1, scienceGainMult: 1, mythicMorale: 0 };
  }

  function getLegacyEntries() {
    const snap = getPersistentSnapshot();
    const paths =
      snap.paths.map((p) => `${p.label} (×${p.count})`).join(' · ') ||
      'None yet — dominate waves 1–150 with archers, academies, or evolved heroes.';
    return [
      {
        cat: 'legacy',
        name: 'Foundational Medieval Layer',
        body: `Pure tactical era (waves 1–150). Your empire's cultural DNA crystallizes at wave 150 into Longbow Legacy, Arcane Dominion, or Mythic Alliance — unlocking early Crown of Ages branches. Crystallized: ${paths}`,
      },
    ];
  }

  load();

  return {
    WAVE_MAX,
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
    crystallize,
    bootstrapForWave,
    hasCrystallizedPath,
    getCrystallizedPaths,
    getRunSnapshot,
    getPersistentSnapshot,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    getRunModifiers,
    getLegacyEntries,
    isActiveWave,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FoundationalMedievalLayer = FoundationalMedievalLayer;
