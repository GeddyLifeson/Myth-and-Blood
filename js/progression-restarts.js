/**
 * Progression Restarts — major escalation gates reset the tactical map while
 * importing crown legacies, research, kingdom bonuses, and partial TP carryover.
 */
const ProgressionRestarts = (() => {
  const ESCALATION_RESTARTS = [
    {
      wave: 100,
      id: 'empire',
      name: 'Empire Ascendant',
      shortName: 'Empire',
      tagline: 'The frontier is redrawn — academies and settlements seed a new defensive realm.',
      color: '#e8a040',
      tpCarryPct: 0.35,
      baseTp: 110,
      scienceBonus: 6,
      wallSpan: 3,
      hamlets: 2,
      guild: true,
      researchLab: false,
      academies: [
        'academy_footman',
        'academy_archer',
        'academy_knight',
        'academy_mage',
        'academy_builder',
      ],
      army: [
        { type: 'knight', count: 5 },
        { type: 'archer', count: 6 },
        { type: 'footman', count: 4 },
        { type: 'mage', count: 2 },
        { type: 'builder', count: 3 },
        { type: 'sapper', count: 2 },
      ],
      extraArmy: [],
    },
    {
      wave: 150,
      id: 'raid_authority',
      name: 'Raid Authority',
      shortName: 'Raids',
      tagline: 'Grand Strategy opens — the battlefield resets but your crown remembers.',
      color: '#f08040',
      tpCarryPct: 0.3,
      baseTp: 125,
      scienceBonus: 10,
      wallSpan: 4,
      hamlets: 2,
      guild: true,
      researchLab: true,
      academies: [
        'academy_footman',
        'academy_archer',
        'academy_knight',
        'academy_mage',
        'academy_builder',
        'academy_sapper',
      ],
      army: [
        { type: 'knight', count: 6 },
        { type: 'archer', count: 7 },
        { type: 'footman', count: 5 },
        { type: 'mage', count: 2 },
        { type: 'builder', count: 3 },
        { type: 'sapper', count: 2 },
        { type: 'scout', count: 1 },
      ],
      extraArmy: [],
    },
    {
      wave: 200,
      id: 'dominion',
      name: 'Planetary Dominion',
      shortName: 'Dominion',
      tagline: 'Mirror war at scale — northern holds respawn against your imported veterans.',
      color: '#ff6060',
      tpCarryPct: 0.28,
      baseTp: 140,
      scienceBonus: 14,
      wallSpan: 4,
      hamlets: 2,
      guild: true,
      researchLab: true,
      academies: [
        'academy_footman',
        'academy_archer',
        'academy_knight',
        'academy_mage',
        'academy_builder',
        'academy_sapper',
      ],
      army: [
        { type: 'knight', count: 7 },
        { type: 'archer', count: 7 },
        { type: 'footman', count: 6 },
        { type: 'mage', count: 3 },
        { type: 'builder', count: 4 },
        { type: 'sapper', count: 3 },
        { type: 'scout', count: 2 },
      ],
      extraArmy: [
        { type: 'knight', count: 3 },
        { type: 'archer', count: 3 },
      ],
    },
    {
      wave: 400,
      id: 'intergalactic',
      name: 'Intergalactic Threshold',
      shortName: 'Galaxy',
      tagline: 'Centuries widen above — the tactical map clears for a galactic-era bastion.',
      color: '#a888d8',
      tpCarryPct: 0.25,
      baseTp: 160,
      scienceBonus: 20,
      wallSpan: 5,
      hamlets: 3,
      guild: true,
      researchLab: true,
      academies: [
        'academy_footman',
        'academy_archer',
        'academy_knight',
        'academy_mage',
        'academy_builder',
        'academy_sapper',
      ],
      army: [
        { type: 'knight', count: 8 },
        { type: 'archer', count: 8 },
        { type: 'footman', count: 6 },
        { type: 'mage', count: 3 },
        { type: 'builder', count: 4 },
        { type: 'sapper', count: 3 },
        { type: 'scout', count: 2 },
      ],
      extraArmy: [
        { type: 'knight', count: 4 },
        { type: 'archer', count: 4 },
      ],
    },
    {
      wave: 500,
      id: 'conquest_gate',
      name: 'Planet Conquest Gate',
      shortName: 'Conquest',
      tagline: 'True victory nears — sectors loom north while legacies and tech carry forward.',
      color: '#c060ff',
      tpCarryPct: 0.22,
      baseTp: 175,
      scienceBonus: 28,
      wallSpan: 5,
      hamlets: 3,
      guild: true,
      researchLab: true,
      academies: [
        'academy_footman',
        'academy_archer',
        'academy_knight',
        'academy_mage',
        'academy_builder',
        'academy_sapper',
      ],
      army: [
        { type: 'knight', count: 8 },
        { type: 'archer', count: 8 },
        { type: 'footman', count: 6 },
        { type: 'mage', count: 3 },
        { type: 'builder', count: 4 },
        { type: 'sapper', count: 3 },
        { type: 'scout', count: 2 },
      ],
      extraArmy: [
        { type: 'knight', count: 4 },
        { type: 'archer', count: 4 },
      ],
    },
  ];

  const SKIP_MODES = new Set(['academy_era', 'planet_conquest']);

  let fired = new Set();
  let lastRestart = null;

  function getRestartDef(wave) {
    return ESCALATION_RESTARTS.find((d) => d.wave === (wave | 0)) || null;
  }

  function isEscalationWave(wave) {
    return !!getRestartDef(wave);
  }

  function shouldSkip(ctx = {}) {
    if (ctx.creative) return true;
    if (SKIP_MODES.has(ctx.modeId)) return true;
    return false;
  }

  function resetRun() {
    fired = new Set();
    lastRestart = null;
  }

  function syncFiredThroughWave(wave) {
    for (const def of ESCALATION_RESTARTS) {
      if ((wave | 0) >= def.wave) fired.add(def.wave);
    }
  }

  function restoreSnapshot(snap) {
    fired = new Set(snap?.fired || []);
    lastRestart = snap?.lastRestart || null;
  }

  function getSnapshot() {
    return {
      fired: [...fired],
      lastRestart,
    };
  }

  function bootstrapPlayerBase(def, ctx) {
    const cx = ctx.worldW / 2;
    const wy = ctx.rallyY - 50;
    for (let i = -def.wallSpan; i <= def.wallSpan; i++) {
      ctx.bootstrapPlaceComplete('wall', cx + i * 28, wy);
    }
    ctx.bootstrapPlaceComplete('outpost', cx, wy - 35);
    const hamletOffsets = [-130, 130, 0];
    for (let i = 0; i < def.hamlets; i++) {
      ctx.bootstrapPlaceComplete('hamlet', cx + (hamletOffsets[i] ?? i * 90), wy - 90 - i * 8);
    }
    if (def.guild) ctx.bootstrapPlaceComplete('merchant_guild', cx, wy - 120);
    if (def.researchLab) ctx.bootstrapPlaceComplete('research_lab', cx + 160, wy - 85);
    def.academies.forEach((t, i) => {
      ctx.bootstrapPlaceComplete(t, cx - 100 + i * 42, wy - 25);
    });
  }

  function applyKingdomMoraleBonus(ctx) {
    if (typeof getKingdomStageBuffs !== 'function') return 0;
    const kb = getKingdomStageBuffs(ctx.wave);
    if (!kb.veteranMoraleCap) return 0;
    let n = 0;
    for (const u of ctx.units || []) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      u.morale = Math.min(u.maxMorale, u.morale + 2);
      n++;
    }
    return n;
  }

  function performRestart(wave, ctx = {}) {
    const def = getRestartDef(wave);
    if (!def || fired.has(def.wave) || shouldSkip(ctx)) return null;

    const priorTp = Math.max(0, ctx.getTactical?.() || 0);
    const carryTp = Math.floor(priorTp * def.tpCarryPct);
    const researchDone = ctx.getResearchCompletedCount?.() || 0;
    const scienceGrant = def.scienceBonus + Math.min(12, Math.floor(researchDone / 2));

    ctx.releaseAllUnits?.();
    ctx.releaseAllBuildings?.();
    ctx.clearProjectiles?.();
    ctx.applyWorldSize?.(wave);
    ctx.generateBattlefield?.();
    ctx.invalidateObstacles?.();
    ctx.resetCamera?.();

    const rtsWave = typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200;
    if (wave >= rtsWave) ctx.tryRtsMapExpansion?.();

    bootstrapPlayerBase(def, ctx);
    ctx.bootstrapSpawnArmy?.(def.army);
    if (def.extraArmy?.length) ctx.bootstrapSpawnArmy?.(def.extraArmy);
    ctx.bootstrapEnemyEconomyForWave?.(wave);
    ctx.grantBootstrapUnlocks?.(wave);

    const baseTp = def.baseTp + carryTp;
    ctx.setTactical?.(baseTp);

    const legacy = ctx.applyRunStartBonuses?.() || {};
    applyKingdomMoraleBonus(ctx);

    if (scienceGrant > 0) ctx.grantScience?.(scienceGrant);

    fired.add(def.wave);
    lastRestart = {
      wave: def.wave,
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      imported: {
        tp: baseTp + (legacy.startTp || 0),
        carryTp,
        science: scienceGrant,
        heirs: legacy.heirs || 0,
        passives: legacy.activePassives || 0,
        research: researchDone,
        eternalEchoes: legacy.eternalInvested || 0,
      },
    };

    ctx.addHighlight?.('era', `Escalation restart — ${def.name}`);
    const eternalNote = legacy.eternalInvested
      ? `, ${legacy.eternalInvested} eternal echo(s)`
      : '';
    ctx.showMessage?.(
      `Progression Restart — ${def.name}. Tactical map reset; legacies, research (${researchDone} complete)${eternalNote}, and ${baseTp + (legacy.startTp || 0)} TP imported.`,
      440
    );
    ctx.showMessage?.(def.tagline, 360);
    ctx.floatingText?.(ctx.worldW / 2, 56, def.shortName.toUpperCase(), def.color);

    return { performed: true, def, snapshot: lastRestart };
  }

  function onWaveStart(wave, ctx = {}) {
    return performRestart(wave, ctx);
  }

  function getStateSnapshot(ctx = {}) {
    const next = ESCALATION_RESTARTS.find((d) => !fired.has(d.wave) && (ctx.wave | 0) < d.wave);
    return {
      fired: [...fired],
      firedCount: fired.size,
      totalGates: ESCALATION_RESTARTS.length,
      lastRestart,
      nextGate: next
        ? { wave: next.wave, name: next.name, shortName: next.shortName }
        : null,
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    if (!lastRestart) return '';
    const imp = lastRestart.imported;
    const parts = [`${lastRestart.shortName} import`];
    if (imp.passives > 0) parts.push(`${imp.passives} legacy`);
    if (imp.heirs > 0) parts.push(`${imp.heirs} heir`);
    if (imp.research > 0) parts.push(`${imp.research} tech`);
    if (imp.tp > 0) parts.push(`${imp.tp} TP`);
    if (ctx.wave >= 150 && !fired.has(150) && lastRestart.wave < 150) {
      /* no-op — show last import only */
    }
    return parts.join(' · ');
  }

  function formatIntelNote(ctx = {}) {
    const snap = getStateSnapshot(ctx);
    if (!snap.lastRestart && !snap.nextGate) return '';
    if (snap.nextGate && (ctx.wave | 0) >= snap.nextGate.wave - 5) {
      return `Escalation w${snap.nextGate.wave}: map reset, legacies import`;
    }
    if (snap.lastRestart) return `Legacy import: ${snap.lastRestart.shortName}`;
    return '';
  }

  return {
    ESCALATION_RESTARTS,
    getRestartDef,
    isEscalationWave,
    shouldSkip,
    resetRun,
    syncFiredThroughWave,
    restoreSnapshot,
    getSnapshot,
    bootstrapPlayerBase,
    performRestart,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
  };
})();