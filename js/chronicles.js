/**
 * Myth and Blood — Chronicles / after-action reports.
 */
const Chronicles = (() => {
  const STORAGE_KEY = 'myth-and-blood-chronicles-v1';
  const MAX_ENTRIES = 24;
  const MAX_WAVE_ENTRIES = 18;
  const MAX_RUN_ENTRIES = 8;
  const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
  const MAX_SUMMARY_LEN = 720;

  let entries = [];

  function compactEntry(entry) {
    return {
      id: entry.id,
      at: entry.at,
      type: entry.type,
      wave: entry.wave,
      difficulty: entry.difficulty,
      victory: entry.victory,
      title: entry.title,
      summary:
        entry.summary?.length > MAX_SUMMARY_LEN
          ? `${entry.summary.slice(0, MAX_SUMMARY_LEN - 1)}…`
          : entry.summary,
      kills: entry.kills,
      armySize: entry.armySize,
      storyBranch: entry.storyBranch || null,
    };
  }

  function prune(now = Date.now()) {
    const before = entries.length;
    entries = entries.filter((e) => now - (e.at || 0) < MAX_AGE_MS);
    const runs = entries.filter((e) => e.type === 'run');
    const waves = entries.filter((e) => e.type !== 'run');
    const keptRuns = runs.slice(-MAX_RUN_ENTRIES);
    const keptWaves = waves.slice(-MAX_WAVE_ENTRIES);
    const keepIds = new Set([...keptRuns, ...keptWaves].map((e) => e.id));
    entries = entries.filter((e) => keepIds.has(e.id));
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    entries = entries.map(compactEntry);
    if (entries.length !== before) save();
    return entries.length;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) entries = JSON.parse(raw) || [];
    } catch (_) {
      entries = [];
    }
    prune();
  }

  function save() {
    try {
      const payload = entries.slice(-MAX_ENTRIES).map(compactEntry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      /* ignore */
    }
  }

  function formatRoster(units) {
    if (!units?.length) return '—';
    const counts = {};
    for (const u of units) {
      const name =
        typeof getUnitDisplayName === 'function'
          ? getUnitDisplayName(u)
          : getPlayerUnitDef?.(u.type)?.name || u.type;
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([n, c]) => `${n}×${c}`)
      .join(', ');
  }

  function pickHighlights(highlights, limit = 4) {
    if (!highlights?.length) return [];
    return highlights.slice(-limit).map((h) => `W${h.wave}: ${h.text}`);
  }

  function append(entry) {
    entries.push(
      compactEntry({
        ...entry,
        id: entry.id || `${Date.now()}-${entries.length}`,
        at: entry.at ?? Date.now(),
      })
    );
    prune();
    save();
  }

  function appendChoiceReport(choice = {}) {
    const branchLabel =
      typeof StoryLore !== 'undefined'
        ? StoryLore.BRANCHES?.[choice.branch]?.label || choice.branch
        : choice.branch;
    const src =
      choice.source === 'planet_event'
        ? 'Planet'
        : choice.source === 'doctrine'
          ? 'Doctrine'
          : choice.source === 'counter'
            ? 'Counter'
            : 'Choice';
    append({
      type: 'choice',
      wave: choice.wave,
      title: `${src} — ${choice.label || choice.choiceId}`,
      summary: `Wave ${choice.wave}: ${choice.label || choice.choiceId}${choice.eventId ? ` (${choice.eventId})` : ''}. Story thread: ${branchLabel || 'undecided'}.`,
      storyBranch: choice.branch,
      choiceId: choice.choiceId,
    });
  }

  function appendNarrativeBeat(beat = {}) {
    append({
      type: beat.type || 'narrative',
      wave: beat.wave,
      victory: beat.victory,
      title: beat.title || 'Narrative Beat',
      summary: beat.summary || '',
      storyBranch: beat.branch,
    });
  }

  function appendWaveReport(wave, stats = {}) {
    if (stats.creative) return;
    const highlights = pickHighlights(stats.highlights, 3);
    const roster = formatRoster(stats.units);
    const diffLabel = getDifficultyDef?.(stats.difficulty)?.label || stats.difficulty || 'Normal';
    const story =
      stats.storySummary ||
      (typeof StoryLore !== 'undefined' ? StoryLore.formatChoiceSummary?.(2) : '');
    const branchLabel = stats.storyBranch
      ? typeof StoryLore !== 'undefined'
        ? StoryLore.BRANCHES?.[stats.storyBranch]?.label || stats.storyBranch
        : stats.storyBranch
      : null;
    const lines = [
      `Wave ${wave} secured on ${diffLabel}.`,
      `Army: ${stats.armySize ?? '?'} · TP: ${stats.tactical ?? '?'} · Losses: ${stats.playerDeaths ?? stats.misses ?? 0}`,
      `Roster: ${roster}`,
    ];
    if (branchLabel) lines.push(`Story thread: ${branchLabel}.`);
    if (story) lines.push(`Recent choices: ${story}.`);
    if (stats.hordeWave)
      lines.push(`Horde assault repelled${stats.siegeWave ? ' (siege elements)' : ''}.`);
    else if (stats.siegeWave) lines.push('Siege assault repelled.');
    if (stats.bossWave) lines.push('Boss wave defeated.');
    if (stats.planetChoice) lines.push(`Planet response: ${stats.planetChoice}.`);
    if (highlights.length) lines.push(`Notable: ${highlights.join(' · ')}`);
    append({
      type: 'wave',
      wave,
      difficulty: stats.difficulty,
      title: `After-Action — Wave ${wave}`,
      summary: lines.join(' '),
      kills: stats.sessionKills,
      armySize: stats.armySize,
      storyBranch: stats.storyBranch,
    });
  }

  function appendRunReport(stats = {}) {
    if (stats.creative) return;
    const diffLabel = getDifficultyDef?.(stats.difficulty)?.label || stats.difficulty || 'Normal';
    const outcome = stats.victory ? 'VICTORY' : 'DEFEAT';
    const highlights = pickHighlights(stats.highlights, 6);
    const branchLabel = stats.storyBranch
      ? typeof StoryLore !== 'undefined'
        ? StoryLore.BRANCHES?.[stats.storyBranch]?.label || stats.storyBranch
        : stats.storyBranch
      : null;
    const lines = [
      `${outcome} — ${diffLabel}. Survived ${stats.wave ?? 0} waves.`,
      `Kills: ${stats.kills ?? 0} · Losses: ${stats.playerDeaths ?? stats.misses ?? 0}`,
    ];
    if (branchLabel) lines.push(`Dominant story path: ${branchLabel}.`);
    if (stats.storyChoiceCount) lines.push(`${stats.storyChoiceCount} branching choices recorded.`);
    if (stats.victory && stats.victoryReason === 'economy') {
      lines.push('Northern purge complete — all enemy economy structures destroyed.');
    }
    if (stats.honorNames?.length) {
      lines.push(`Honored: ${stats.honorNames.slice(-5).join(', ')}`);
    }
    if (highlights.length) {
      lines.push(`Chronicle highlights: ${highlights.join(' · ')}`);
    }
    append({
      type: 'run',
      wave: stats.wave,
      difficulty: stats.difficulty,
      victory: !!stats.victory,
      title: `Campaign Chronicle — ${outcome}`,
      summary: lines.join(' '),
      kills: stats.kills,
    });
  }

  function getAll() {
    return [...entries].reverse();
  }

  function getEncyclopediaEntries() {
    const list = getAll();
    if (!list.length) {
      return [
        {
          cat: 'chronicles',
          name: 'No Chronicles Yet',
          body: "Clear waves and finish runs — the Crown's scribes will record after-action reports here automatically.",
        },
      ];
    }
    return list.slice(0, 24).map((e, i) => ({
      cat: 'chronicles',
      name: e.title || (e.type === 'run' ? 'Run Report' : `Wave ${e.wave}`),
      body: e.summary,
      chronicleMeta: new Date(e.at).toLocaleDateString(),
      chronicleType: e.type,
      storyBranch: e.storyBranch,
      classifiedRule: i >= 8 ? 'waves_cleared:20' : null,
      classified:
        i >= 8
          ? `Archive entry #${list.length - i} — full tactical appendix retained in royal storage.`
          : null,
    }));
  }

  load();

  return {
    load,
    save,
    prune,
    getAll,
    appendWaveReport,
    appendRunReport,
    appendChoiceReport,
    appendNarrativeBeat,
    getEncyclopediaEntries,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Chronicles = Chronicles;
