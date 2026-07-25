/**
 * Multi-front Siege Warfare — when multiple enemy factions are active, they coordinate
 * or compete across flanks: one faction sieges north while another raids economy south.
 */
const MultiFrontSiege = (() => {
  const MULTI_FRONT_MIN_FACTIONS = 2;
  const MULTI_FRONT_MIN_WAVE = 12;

  const FRONT_LABELS = { north: 'North', east: 'East', west: 'West', south: 'South' };

  const SIEGE_DOCTRINES = {
    siege_line: {
      id: 'siege_line',
      label: 'Siege Line',
      preferredFronts: ['north'],
      counterRaidFront: 'north',
      targetPriority: 'line',
      competeWeight: 0.85,
    },
    economy_raid: {
      id: 'economy_raid',
      label: 'Economy Raid',
      preferredFronts: ['south'],
      counterRaidFront: 'south',
      targetPriority: 'economy',
      competeWeight: 1.12,
    },
    wide_flank: {
      id: 'wide_flank',
      label: 'Wide Flank',
      preferredFronts: ['east', 'west'],
      counterRaidFront: 'east',
      targetPriority: 'flank',
      competeWeight: 0.95,
    },
    opportunist: {
      id: 'opportunist',
      label: 'Opportunist',
      preferredFronts: null,
      counterRaidFront: null,
      targetPriority: 'compete',
      competeWeight: 1.2,
    },
  };

  /** Default doctrine preferences per faction archetype. */
  const FACTION_DOCTRINES = {
    goblin_hordes: ['economy_raid', 'wide_flank', 'opportunist'],
    orc_warbands: ['siege_line', 'wide_flank'],
    dark_legions: ['wide_flank', 'siege_line'],
    void_abyssal: ['economy_raid', 'opportunist'],
    mirror_empires: ['siege_line', 'economy_raid'],
  };

  let currentPlan = null;
  let announcedMultiFront = false;

  function resetRun() {
    currentPlan = null;
    announcedMultiFront = false;
  }

  function getDoctrine(id) {
    return SIEGE_DOCTRINES[id] || SIEGE_DOCTRINES.opportunist;
  }

  function pickFrontsForDoctrine(doc, unlockedSides, takenFronts, rng, allowOverlap = false) {
    const pool = doc.preferredFronts || unlockedSides;
    let available = pool.filter((s) => unlockedSides.includes(s));
    if (!allowOverlap && takenFronts?.size) {
      const fresh = available.filter((s) => !takenFronts.has(s));
      if (fresh.length) available = fresh;
    }
    if (!available.length) {
      const fallback = unlockedSides.filter((s) => allowOverlap || !takenFronts?.has(s));
      available = fallback.length ? fallback : unlockedSides;
    }
    if (!available.length) return ['north'];
    return [available[Math.floor(rng() * available.length)]];
  }

  function chooseDoctrine(factionId, mode, takenDoctrines, rng) {
    const prefs = FACTION_DOCTRINES[factionId] || ['opportunist'];
    if (mode === 'coordinated') {
      for (const pid of prefs) {
        if (!takenDoctrines.has(pid)) return pid;
      }
    }
    return prefs[Math.floor(rng() * prefs.length)];
  }

  function formatAssignmentLine(a) {
    const front = a.fronts.map((f) => FRONT_LABELS[f] || f).join('/');
    if (a.doctrine === 'economy_raid') return `${a.factionName} raids ${front}`;
    if (a.doctrine === 'siege_line') return `${a.factionName} sieges ${front}`;
    if (a.doctrine === 'wide_flank') return `${a.factionName} flanks ${front}`;
    return `${a.factionName} probes ${front}`;
  }

  function formatIntel(assignments, mode) {
    const lines = assignments.map(formatAssignmentLine);
    if (mode === 'competing') {
      const byFront = {};
      for (const a of assignments) {
        const key = a.fronts[0] || 'north';
        byFront[key] = byFront[key] || [];
        byFront[key].push(a.factionName);
      }
      const clashes = Object.entries(byFront).filter(([, names]) => names.length > 1);
      if (clashes.length) {
        const clashNote = clashes
          .map(([f, names]) => `${names.join(' vs ')} on ${FRONT_LABELS[f] || f}`)
          .join('; ');
        return `${lines.join(' · ')} (${clashNote})`;
      }
    }
    return lines.join(' · ');
  }

  function buildFrontPlan(wave, activeFactions, unlockedSides, rng = Math.random) {
    const factions = (activeFactions || []).filter((f) => f?.currentTier);
    if (factions.length < MULTI_FRONT_MIN_FACTIONS || wave < MULTI_FRONT_MIN_WAVE) {
      currentPlan = null;
      return null;
    }
    const sides = unlockedSides?.length ? unlockedSides : ['north'];
    const academyBlend =
      typeof academyThresholdBlend === 'function' ? academyThresholdBlend(wave) : wave >= 100 ? 1 : 0;
    const coordChance = 0.52 + Math.min(0.28, factions.length * 0.05) + academyBlend * 0.12;
    const mode = rng() < coordChance ? 'coordinated' : 'competing';
    const takenFronts = new Set();
    const takenDoctrines = new Set();
    const sorted = [...factions].sort(
      (a, b) =>
        (b.currentTier?.stage || 0) - (a.currentTier?.stage || 0) ||
        (b.currentTier?.weight || 0) - (a.currentTier?.weight || 0)
    );

    const assignments = [];
    for (const f of sorted) {
      const doctrineId = chooseDoctrine(f.id, mode, takenDoctrines, rng);
      const doc = getDoctrine(doctrineId);
      if (mode === 'coordinated') takenDoctrines.add(doctrineId);
      const fronts = pickFrontsForDoctrine(
        doc,
        sides,
        mode === 'coordinated' ? takenFronts : null,
        rng,
        mode === 'competing'
      );
      if (mode === 'coordinated') fronts.forEach((fr) => takenFronts.add(fr));
      assignments.push({
        factionId: f.id,
        factionName: f.shortName || f.name,
        color: f.color,
        doctrine: doctrineId,
        doctrineLabel: doc.label,
        fronts,
        spawnWeight: doc.competeWeight * (f.currentTier?.weight || 1),
        targetPriority: doc.targetPriority,
        stage: f.currentTier?.stage || 1,
      });
    }

    const waveSides = [...new Set(assignments.flatMap((a) => a.fronts))];
    const intel = formatIntel(assignments, mode);
    currentPlan = {
      wave,
      mode,
      assignments,
      waveSides: waveSides.length ? waveSides : sides,
      intel,
      summary: mode === 'coordinated' ? `Coordinated — ${intel}` : `Competing — ${intel}`,
    };
    return currentPlan;
  }

  function getCurrentPlan() {
    return currentPlan;
  }

  function pickSpawnSide(unitType, plan, activeSides, rng = Math.random) {
    const sides = activeSides?.length ? activeSides : plan?.waveSides || ['north'];
    if (!plan?.assignments?.length) {
      return sides[Math.floor(rng() * sides.length)] || 'north';
    }
    const factionId =
      typeof EnemyFactions !== 'undefined' ? EnemyFactions.getUnitFaction(unitType) : null;
    const assignment = plan.assignments.find((a) => a.factionId === factionId);
    if (assignment?.fronts?.length) {
      const valid = assignment.fronts.filter((f) => sides.includes(f));
      if (valid.length) return valid[Math.floor(rng() * valid.length)];
    }
    if (plan.mode === 'competing' && assignment) {
      const doc = getDoctrine(assignment.doctrine);
      const pref = pickFrontsForDoctrine(doc, sides, null, rng, true);
      if (pref.length) return pref[0];
    }
    return sides[Math.floor(rng() * sides.length)] || 'north';
  }

  function pickCounterRaidTarget(factionId, buildings, plan) {
    const settlements = (buildings || []).filter(
      (b) => b.owner === 'player' && b.complete && b.hp > 0 && (b.isHamlet || b.isMerchantGuild)
    );
    const lineTargets = (buildings || []).filter(
      (b) =>
        b.owner === 'player' &&
        b.complete &&
        b.hp > 0 &&
        (b.type === 'outpost' || b.type === 'wall' || b.isHamlet)
    );
    if (!settlements.length && !lineTargets.length) return null;

    const assignment = plan?.assignments?.find((a) => a.factionId === factionId);
    const priority = assignment?.targetPriority || 'economy';

    if (priority === 'line' || assignment?.doctrine === 'siege_line') {
      const pool = lineTargets.length ? lineTargets : settlements;
      return pool.slice().sort((a, b) => a.y - b.y)[0];
    }
    if (priority === 'economy' || assignment?.doctrine === 'economy_raid') {
      const pool = settlements.length ? settlements : lineTargets;
      return pool.slice().sort((a, b) => b.y - a.y)[0];
    }
    const pool = settlements.length ? settlements : lineTargets;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function resolveCounterRaidSpawn(factionId, target, ctx = {}) {
    const { worldW = 800, worldH = 600, rng = Math.random } = ctx;
    const assignment = currentPlan?.assignments?.find((a) => a.factionId === factionId);
    const doc = getDoctrine(assignment?.doctrine || 'economy_raid');
    let side = assignment?.fronts?.[0] || doc.counterRaidFront || 'south';

    if (assignment?.doctrine === 'siege_line') side = 'north';
    else if (assignment?.doctrine === 'economy_raid') side = 'south';
    else if (assignment?.doctrine === 'wide_flank') side = rng() < 0.5 ? 'east' : 'west';

    const tx = target?.x ?? worldW / 2;
    const ty = target?.y ?? worldH / 2;
    let x;
    let y;

    switch (side) {
      case 'north':
        x = tx + (rng() - 0.5) * 120;
        y = Math.max(28, ty - 140 - rng() * 80);
        break;
      case 'south':
        x = tx + (rng() - 0.5) * 120;
        y = Math.min(worldH - 24, ty + 120 + rng() * 60);
        break;
      case 'east':
        x = Math.min(worldW - 24, tx + 140 + rng() * 40);
        y = ty + (rng() - 0.5) * 90;
        break;
      case 'west':
        x = Math.max(24, tx - 140 - rng() * 40);
        y = ty + (rng() - 0.5) * 90;
        break;
      default:
        x = tx + (rng() - 0.5) * 160;
        y = ty + (rng() - 0.5) * 100;
    }

    return {
      side,
      x: Math.max(24, Math.min(worldW - 24, x)),
      y: Math.max(24, Math.min(worldH - 24, y)),
      doctrine: assignment?.doctrine || doc.id,
    };
  }

  function mergeWaveSides(plan, rolledSides) {
    if (!plan?.waveSides?.length) return rolledSides;
    if (plan.waveSides.length >= 2) return plan.waveSides;
    const merged = [...new Set([...(rolledSides || []), ...plan.waveSides])];
    return merged.length ? merged : rolledSides;
  }

  function checkWaveAnnouncement(wave, activeCount, hooks = {}) {
    if (
      announcedMultiFront ||
      wave !== MULTI_FRONT_MIN_WAVE ||
      activeCount < MULTI_FRONT_MIN_FACTIONS
    )
      return null;
    announcedMultiFront = true;
    hooks.addHighlight?.('host', 'Multi-Front Siege');
    hooks.showMessage?.(
      'Wave 12 — Multi-front siege! With several hostile factions active, they coordinate or compete: one may siege north while another raids your economy south.',
      420
    );
    hooks.floatingText?.(hooks.worldW / 2, 60, 'MULTI-FRONT', '#ff7050');
    return { wave: MULTI_FRONT_MIN_WAVE };
  }

  function getStateSnapshot(wave, activeFactions) {
    const count = (activeFactions || []).length;
    const active = count >= MULTI_FRONT_MIN_FACTIONS && wave >= MULTI_FRONT_MIN_WAVE;
    const plan = currentPlan?.wave === wave ? currentPlan : null;
    return {
      active,
      minWave: MULTI_FRONT_MIN_WAVE,
      minFactions: MULTI_FRONT_MIN_FACTIONS,
      factionCount: count,
      mode: plan?.mode || null,
      intel: plan?.intel || null,
      summary: plan?.summary || (active ? 'Multi-faction fronts forming' : null),
      assignments:
        plan?.assignments?.map((a) => ({
          factionId: a.factionId,
          factionName: a.factionName,
          doctrine: a.doctrine,
          doctrineLabel: a.doctrineLabel,
          fronts: a.fronts,
          frontLabel: a.fronts.map((f) => FRONT_LABELS[f] || f).join('/'),
        })) || [],
      waveSides: plan?.waveSides || null,
    };
  }

  return {
    MULTI_FRONT_MIN_WAVE,
    MULTI_FRONT_MIN_FACTIONS,
    FRONT_LABELS,
    SIEGE_DOCTRINES,
    FACTION_DOCTRINES,
    resetRun,
    buildFrontPlan,
    getCurrentPlan,
    pickSpawnSide,
    pickCounterRaidTarget,
    resolveCounterRaidSpawn,
    mergeWaveSides,
    checkWaveAnnouncement,
    getStateSnapshot,
    formatIntel,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MultiFrontSiege = MultiFrontSiege;
