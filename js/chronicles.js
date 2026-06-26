/**
 * Myth and Blood — Chronicles / after-action reports.
 */
const Chronicles = (() => {
  const STORAGE_KEY = 'myth-and-blood-chronicles-v1';
  const MAX_ENTRIES = 50;

  let entries = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) entries = JSON.parse(raw) || [];
    } catch (_) {
      entries = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch (_) { /* ignore */ }
  }

  function formatRoster(units) {
    if (!units?.length) return '—';
    const counts = {};
    for (const u of units) {
      const name = typeof getUnitDisplayName === 'function'
        ? getUnitDisplayName(u)
        : (getPlayerUnitDef?.(u.type)?.name || u.type);
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
    return highlights.slice(-limit).map(h => `W${h.wave}: ${h.text}`);
  }

  function append(entry) {
    entries.push({ ...entry, id: `${Date.now()}-${entries.length}`, at: Date.now() });
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    save();
  }

  function appendWaveReport(wave, stats = {}) {
    if (stats.creative) return;
    const highlights = pickHighlights(stats.highlights, 3);
    const roster = formatRoster(stats.units);
    const diffLabel = getDifficultyDef?.(stats.difficulty)?.label || stats.difficulty || 'Normal';
    const lines = [
      `Wave ${wave} secured on ${diffLabel}.`,
      `Army: ${stats.armySize ?? '?'} · TP: ${stats.tactical ?? '?'} · Breakthroughs: ${stats.misses ?? 0}`,
      `Roster: ${roster}`,
    ];
    if (stats.hordeWave) lines.push(`Horde assault repelled${stats.siegeWave ? ' (siege elements)' : ''}.`);
    else if (stats.siegeWave) lines.push('Siege assault repelled.');
    if (stats.bossWave) lines.push('Boss wave defeated.');
    if (highlights.length) lines.push(`Notable: ${highlights.join(' · ')}`);
    append({
      type: 'wave',
      wave,
      difficulty: stats.difficulty,
      title: `After-Action — Wave ${wave}`,
      summary: lines.join(' '),
      kills: stats.sessionKills,
      armySize: stats.armySize,
    });
  }

  function appendRunReport(stats = {}) {
    if (stats.creative) return;
    const diffLabel = getDifficultyDef?.(stats.difficulty)?.label || stats.difficulty || 'Normal';
    const outcome = stats.victory ? 'VICTORY' : 'DEFEAT';
    const highlights = pickHighlights(stats.highlights, 6);
    const lines = [
      `${outcome} — ${diffLabel}. Survived ${stats.wave ?? 0} waves.`,
      `Kills: ${stats.kills ?? 0} · Breakthroughs: ${stats.misses ?? 0}`,
    ];
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
      return [{
        cat: 'chronicles',
        name: 'No Chronicles Yet',
        body: 'Clear waves and finish runs — the Crown\'s scribes will record after-action reports here automatically.',
      }];
    }
    return list.slice(0, 24).map((e, i) => ({
      cat: 'chronicles',
      name: e.title || (e.type === 'run' ? 'Run Report' : `Wave ${e.wave}`),
      body: e.summary,
      chronicleMeta: new Date(e.at).toLocaleDateString(),
      chronicleType: e.type,
      classifiedRule: i >= 8 ? 'waves_cleared:20' : null,
      classified: i >= 8
        ? `Archive entry #${list.length - i} — full tactical appendix retained in royal storage.`
        : null,
    }));
  }

  load();

  return {
    load, save, getAll, appendWaveReport, appendRunReport, getEncyclopediaEntries,
  };
})();