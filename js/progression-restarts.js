/**
 * Eras. The run is fought on one field from the first wave to the last: reaching wave 100
 * or 200 no longer wipes the field or hands out a fresh base. An era is a milestone. It is
 * announced once, pays a small science grant for the research already done, and names what
 * the war opens up from that wave on. Soldiers, veterans, buildings, mines and posts are
 * not touched.
 *
 * The global keeps its old name, `ProgressionRestarts`, because saves, the HUD and the
 * state snapshot refer to it.
 */
const ProgressionRestarts = (() => {
  const ERAS = [
    {
      wave: 100,
      id: 'empire',
      name: 'Empire Ascendant',
      shortName: 'Empire',
      tagline:
        'The host comes on heavier from here. Your field, your walls and your veterans stand.',
      color: '#e8a040',
      scienceBonus: 6,
      opens: [
        'heavier hosts and elite packs',
        'the wave-100 research tier',
        'academies for every troop with an Immortal mentor',
      ],
    },
    {
      wave: 200,
      id: 'dominion',
      name: 'Planetary Dominion',
      shortName: 'Dominion',
      tagline: 'The late war begins. Nothing is taken from you; everything is asked of you.',
      color: '#ff6060',
      scienceBonus: 14,
      opens: [
        'late-war hosts and named threats',
        'the wave-200 research tier',
        'late-war decrees and loadouts',
      ],
    },
  ];

  /** Modes that begin inside an era have nothing to announce. */
  const SKIP_MODES = new Set(['academy_era']);

  let fired = new Set();
  let lastEra = null;

  function getEraDef(wave) {
    return ERAS.find((d) => d.wave === (wave | 0)) || null;
  }

  function isEscalationWave(wave) {
    return !!getEraDef(wave);
  }

  function shouldSkip(ctx = {}) {
    if (ctx.creative) return true;
    if (SKIP_MODES.has(ctx.modeId)) return true;
    return false;
  }

  function resetRun() {
    fired = new Set();
    lastEra = null;
  }

  /** A save from before eras were recorded: every era at or below its wave has passed. */
  function syncFiredThroughWave(wave) {
    for (const def of ERAS) {
      if ((wave | 0) >= def.wave) {
        fired.add(def.wave);
        lastEra = { wave: def.wave, id: def.id, name: def.name, shortName: def.shortName };
      }
    }
  }

  function restoreSnapshot(snap) {
    fired = new Set((snap?.fired || []).filter((w) => getEraDef(w)));
    // Older saves called this `lastRestart` and stored what the wipe handed out with it.
    const last = snap?.lastEra || snap?.lastRestart || null;
    lastEra = last
      ? {
          wave: last.wave,
          id: last.id,
          name: last.name,
          shortName: last.shortName,
          science: last.science ?? last.imported?.science ?? 0,
        }
      : null;
  }

  function getSnapshot() {
    return {
      fired: [...fired],
      lastEra: lastEra ? { ...lastEra } : null,
    };
  }

  /**
   * Called at every dawn. On an era wave it announces the era, once; it never removes or
   * adds a soldier or a building.
   */
  function enterEra(wave, ctx = {}) {
    const def = getEraDef(wave);
    if (!def || fired.has(def.wave) || shouldSkip(ctx)) return null;

    const researchDone = ctx.getResearchCompletedCount?.() || 0;
    const science = def.scienceBonus + Math.min(12, Math.floor(researchDone / 2));
    if (science > 0) ctx.grantScience?.(science);

    fired.add(def.wave);
    lastEra = { wave: def.wave, id: def.id, name: def.name, shortName: def.shortName, science };

    ctx.addHighlight?.('era', `${def.name} — wave ${def.wave}`);
    ctx.showMessage?.(`Wave ${def.wave} — ${def.name}. ${def.tagline}`, 440);
    ctx.showMessage?.(`Now open: ${def.opens.join('; ')}.`, 380);
    if (science > 0) {
      ctx.showMessage?.(`Your scholars mark the new era: +${science} science.`, 300);
    }
    ctx.floatingText?.((ctx.worldW || 400) / 2, 56, def.shortName.toUpperCase(), def.color);
    ctx.playSfx?.('reinforce');

    return { performed: true, wiped: false, def, snapshot: { ...lastEra } };
  }

  function onWaveStart(wave, ctx = {}) {
    return enterEra(wave, ctx);
  }

  function getStateSnapshot(ctx = {}) {
    const next = ERAS.find((d) => !fired.has(d.wave) && (ctx.wave | 0) < d.wave);
    return {
      fired: [...fired],
      firedCount: fired.size,
      totalGates: ERAS.length,
      lastEra,
      lastRestart: lastEra,
      nextGate: next ? { wave: next.wave, name: next.name, shortName: next.shortName } : null,
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine() {
    return lastEra ? `${lastEra.shortName} era` : '';
  }

  function formatIntelNote(ctx = {}) {
    const next = ERAS.find((d) => !fired.has(d.wave) && (ctx.wave | 0) < d.wave);
    if (next && (ctx.wave | 0) >= next.wave - 5) {
      return `Wave ${next.wave}: ${next.name} — heavier hosts, your field stands`;
    }
    return '';
  }

  return {
    ERAS,
    ESCALATION_RESTARTS: ERAS,
    isEscalationWave,
    shouldSkip,
    resetRun,
    syncFiredThroughWave,
    restoreSnapshot,
    getSnapshot,
    enterEra,
    performRestart: enterEra,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
  };
})();

// Published for headless runs and GameServices.registerFromGlobals(): a top-level `const`
// in a classic script is not a property of globalThis.
globalThis.ProgressionRestarts = ProgressionRestarts;
