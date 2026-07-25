/**
 * Myth and Blood — persistent player legacy (waves, favorites, honors).
 */
const Legacy = (() => {
  const STORAGE_KEY = 'myth-and-blood-legacy-v1';

  let data = {
    totalRuns: 0,
    victories: 0,
    defeats: 0,
    maxWaveEver: 0,
    maxWaveByDiff: {},
    totalKills: 0,
    totalWavesCleared: 0,
    unitKills: {},
    unitDeploys: {},
    honorNames: [],
    factionsUsed: [],
    lastRun: null,
  };

  let currentRun = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = { ...data, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      /* ignore */
    }
  }

  function unitLabel(type) {
    if (!type) return 'Unknown';
    const def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(type) : null;
    return def?.name || EnemyDefs?.[type]?.name || type;
  }

  function computeFavoriteUnit() {
    let best = null;
    let bestScore = 0;
    for (const [type, kills] of Object.entries(data.unitKills)) {
      const deploys = data.unitDeploys[type] || 0;
      const score = kills * 2 + deploys;
      if (score > bestScore) {
        bestScore = score;
        best = type;
      }
    }
    return best;
  }

  function get() {
    const favorite = computeFavoriteUnit();
    return {
      ...data,
      favoriteUnitType: favorite,
      favoriteUnitName: favorite ? unitLabel(favorite) : null,
      honorCount: data.honorNames.length,
    };
  }

  function onRunStart(opts = {}) {
    load();
    currentRun = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      difficulty: opts.difficulty || 'normal',
      creative: !!opts.creative,
      startedAt: Date.now(),
      maxWave: 0,
      kills: 0,
      honorNames: [],
      factions: new Set(),
    };
    if (!opts.creative) {
      data.totalRuns++;
      save();
    }
  }

  function recordDeploy(unitType) {
    if (!unitType || currentRun?.creative) return;
    data.unitDeploys[unitType] = (data.unitDeploys[unitType] || 0) + 1;
    save();
  }

  function recordKill(killerType, enemyType) {
    if (!killerType || currentRun?.creative) return;
    data.unitKills[killerType] = (data.unitKills[killerType] || 0) + 1;
    data.totalKills++;
    if (currentRun) currentRun.kills++;
    save();
  }

  function recordFaction(factionId) {
    if (!factionId || currentRun?.creative) return;
    if (!data.factionsUsed.includes(factionId)) {
      data.factionsUsed.push(factionId);
      save();
    }
    if (currentRun) currentRun.factions.add(factionId);
  }

  function recordHonor(unit, wave) {
    if (!unit?.honorName || currentRun?.creative) return;
    const entry = {
      name: unit.honorName,
      type: unit.type,
      wave: wave ?? 0,
      runId: currentRun?.id || null,
      at: Date.now(),
    };
    data.honorNames.push(entry);
    if (data.honorNames.length > 120) data.honorNames = data.honorNames.slice(-120);
    if (currentRun) currentRun.honorNames.push(entry.name);
    save();
  }

  function onWaveComplete(wave, stats = {}) {
    if (currentRun?.creative) return;
    data.totalWavesCleared++;
    if (wave > data.maxWaveEver) data.maxWaveEver = wave;
    const diff = stats.difficulty || currentRun?.difficulty || 'normal';
    if (wave > (data.maxWaveByDiff[diff] || 0)) data.maxWaveByDiff[diff] = wave;
    if (currentRun && wave > currentRun.maxWave) currentRun.maxWave = wave;
    save();
  }

  function onGameEnd(victory, stats = {}) {
    if (currentRun?.creative) {
      currentRun = null;
      return;
    }
    if (typeof CrownLegacies !== 'undefined') {
      CrownLegacies.refreshUnlocks(get());
    }
    if (typeof EternalLegacyTree !== 'undefined') {
      EternalLegacyTree.refreshUnlocks(get());
    }
    const runSummary = {
      id: currentRun?.id,
      victory: !!victory,
      difficulty: stats.difficulty || currentRun?.difficulty || 'normal',
      wave: stats.wave ?? currentRun?.maxWave ?? 0,
      kills: stats.kills ?? currentRun?.kills ?? 0,
      misses: stats.misses ?? 0,
      endedAt: Date.now(),
      honorNames: currentRun?.honorNames || [],
    };
    data.lastRun = runSummary;
    if (victory) data.victories++;
    else data.defeats++;
    save();
    currentRun = null;
  }

  function getLegacyEntries() {
    const leg = get();
    const diffLines =
      Object.entries(leg.maxWaveByDiff)
        .sort((a, b) => b[1] - a[1])
        .map(([d, w]) => `${getDifficultyDef?.(d)?.label || d}: wave ${w}`)
        .join(' · ') || 'No recorded runs yet.';
    const recentHonors =
      leg.honorNames
        .slice(-6)
        .reverse()
        .map((h) => `${h.name} (${unitLabel(h.type)}, W${h.wave})`)
        .join(' · ') || 'None crowned yet.';
    return [
      {
        cat: 'legacy',
        name: 'Commander Record',
        body: `Runs: ${leg.totalRuns} · Victories: ${leg.victories} · Defeats: ${leg.defeats} · Waves cleared (lifetime): ${leg.totalWavesCleared} · Total kills: ${leg.totalKills}`,
      },
      {
        cat: 'legacy',
        name: 'Peak Survival',
        body: `Highest wave reached: ${leg.maxWaveEver || '—'}. By difficulty — ${diffLines}`,
        classified:
          leg.maxWaveEver >= 200
            ? "The Crown's war council notes your name among commanders who survived the Enemy RTS era. Settlement raids and mirrored economies did not end you."
            : 'Field reports beyond wave 200 remain sealed until a commander proves the realm can endure the Enemy RTS.',
        classifiedRule: 'wave:200',
      },
      {
        cat: 'legacy',
        name: 'Favorite Unit',
        body: leg.favoriteUnitName
          ? `${leg.favoriteUnitName} leads your legacy — ${leg.unitKills[leg.favoriteUnitType] || 0} kills credited, ${leg.unitDeploys[leg.favoriteUnitType] || 0} deployments.`
          : 'Deploy troops and earn kills — your favorite will be tracked automatically.',
      },
      {
        cat: 'legacy',
        name: 'Honor Roll',
        body: `${leg.honorCount} soldiers named by the Crown. Recent: ${recentHonors}`,
        classified:
          leg.honorCount >= 3
            ? "Veteran scribes whisper that honor names are not random — each is hashed from the soldier's service ID, drawn from ancient prefix pools (Syr, Dame, Magister…) and a royal name ledger."
            : "Earn three honor names to unlock the Crown's naming cipher.",
        classifiedRule: 'honor:3',
      },
      {
        cat: 'legacy',
        name: 'Crossover Service',
        body: leg.factionsUsed.length
          ? `Factions fielded: ${leg.factionsUsed.join(', ')}.`
          : 'Recruit evolved operatives to log evolved service.',
      },
      {
        cat: 'legacy',
        name: 'Last After-Action',
        body: leg.lastRun
          ? `${leg.lastRun.victory ? 'Victory' : 'Defeat'} on ${getDifficultyDef?.(leg.lastRun.difficulty)?.label || leg.lastRun.difficulty} — wave ${leg.lastRun.wave}, ${leg.lastRun.kills} kills, ${leg.lastRun.playerDeaths ?? leg.lastRun.misses ?? 0} losses.`
          : 'Complete a run to see your last summary here.',
      },
    ];
  }

  load();

  return {
    load,
    save,
    get,
    onRunStart,
    recordDeploy,
    recordKill,
    recordFaction,
    recordHonor,
    onWaveComplete,
    onGameEnd,
    getLegacyEntries,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Legacy = Legacy;
