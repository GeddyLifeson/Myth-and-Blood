/**
 * Thematic Era Synergies — path-specific cross-era mechanics.
 * Arcane → Arcane-Infused Technology (runes, enchanted AI).
 * Martial → Ancestral Weapons (infinite scaling).
 * Mythic → Hero Echoes (immortal advisors / fleet commanders).
 */
const ThematicEraSynergies = (() => {
  const KINGDOM_WAVE = 150;
  const GALACTIC_WAVE = 400;

  const SYNERGY_DEFS = {
    arcane: {
      id: 'arcane',
      label: 'Arcane-Infused Technology',
      short: 'Arcane Tech',
      color: '#9070f0',
      desc: 'Runes on spaceships, enchanted AI — the tech tree becomes arcane-infused stellar science.',
      techTreeLabel: 'Arcane-Infused Technology',
      branches: ['rune_hulls', 'enchanted_ai', 'ley_drives'],
    },
    martial: {
      id: 'martial',
      label: 'Ancestral Weapons',
      short: 'Ancestral Arms',
      color: '#68a878',
      desc: 'Sworn ancestral arms scale without limit — every era sharpens the blade.',
      branches: ['volley_ancestry', 'honor_edge', 'first_stand_blade'],
    },
    mythic: {
      id: 'mythic',
      label: 'Echoes of Heroes',
      short: 'Hero Echoes',
      color: '#e8b050',
      desc: 'Recruit echoes of early champions as immortal advisors and fleet commanders.',
      branches: ['living_advisors', 'fleet_legends', 'dimensional_council'],
    },
  };

  const BRANCH_DEFS = {
    rune_hulls: { label: 'Rune Hulls', desc: 'Enchanted plating on every hull.' },
    enchanted_ai: { label: 'Enchanted AI', desc: 'Scholarch minds steer battle logistics.' },
    ley_drives: { label: 'Ley Drives', desc: 'Ley-fed engines bend transit times.' },
    volley_ancestry: { label: 'Volley Ancestry', desc: 'Longbow spirits stack on every shot.' },
    honor_edge: { label: 'Honor Edge', desc: 'Sworn steel grows sharper each wave.' },
    first_stand_blade: { label: 'First Stand Blade', desc: 'The founding battle empowers all ranks.' },
    living_advisors: { label: 'Living Advisors', desc: 'Echo council whispers strategy.' },
    fleet_legends: { label: 'Fleet Legends', desc: 'Champion echoes command battle groups.' },
    dimensional_council: { label: 'Dimensional Council', desc: 'Crossover gods advise the crown.' },
  };

  const ECHO_DEFS = {
    goku: {
      id: 'goku',
      label: 'Echo of the Saiyan Champion',
      short: 'Kael Skyburst Echo',
      role: 'fleet_commander',
      cost: 16,
      playerDmgMult: 1.06,
      fleetReadiness: 8,
      morale: 4,
    },
    tank_dempsey: {
      id: 'tank_dempsey',
      label: 'Echo of the Siege Legend',
      short: 'Dempsey Echo',
      role: 'advisor',
      cost: 14,
      playerDmgMult: 1.05,
      fleetStrength: 0.08,
      morale: 5,
    },
    doomslayer_hero: {
      id: 'doomslayer_hero',
      label: 'Echo of the Slayer',
      short: 'Slayer Echo',
      role: 'advisor',
      cost: 18,
      playerDmgMult: 1.08,
      morale: 6,
    },
    honored_veteran: {
      id: 'honored_veteran',
      label: 'Echo of the Honored Host',
      short: 'Host Echo',
      role: 'advisor',
      cost: 12,
      hpMult: 1.04,
      morale: 3,
      ancestralBonus: 0.01,
    },
  };

  const ANCESTRAL_TYPES = new Set([
    'footman',
    'archer',
    'pikeman',
    'knight',
    'ballista',
    'general',
    'paladin',
  ]);

  let state = null;
  let kingdomAnnounced = false;
  let galacticAnnounced = false;

  function defaultState() {
    return {
      pathId: null,
      active: false,
      resolvedAtWave: 0,
      ancestralStacks: 0,
      arcaneInfusionTier: 0,
      echoCandidates: [],
      recruitedEchoes: [],
      log: [],
    };
  }

  function resetRun() {
    state = defaultState();
    kingdomAnnounced = false;
    galacticAnnounced = false;
  }

  function mapFoundationToPath(foundationId) {
    if (foundationId === 'arcane_dominion') return 'arcane';
    if (foundationId === 'mythic_alliance') return 'mythic';
    if (foundationId === 'longbow_legacy') return 'martial';
    return null;
  }

  function resolveThematicPath() {
    if (typeof GrandStrategy !== 'undefined') {
      const id = GrandStrategy.getKingdomPathId?.();
      if (id) return id;
    }
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const run = FoundationalMedievalLayer.getRunSnapshot?.();
      if (run?.leading) return mapFoundationToPath(run.leading) || 'martial';
    }
    return 'martial';
  }

  function getPathId() {
    return state?.pathId || null;
  }

  function getSynergyDef() {
    const id = getPathId();
    return id ? SYNERGY_DEFS[id] : null;
  }

  function resolveSynergyFromFoundations(ctx = {}) {
    if (!state || state.active) return null;
    const pathId = resolveThematicPath();
    const def = SYNERGY_DEFS[pathId];
    if (!def) return null;
    state.pathId = pathId;
    state.active = true;
    state.resolvedAtWave = ctx.wave || KINGDOM_WAVE;
    state.log.unshift({
      at: Date.now(),
      text: `Thematic synergy — ${def.label}. ${def.desc}`,
    });
    seedEchoCandidates(ctx.units || []);
    return { pathId, def };
  }

  function seedEchoCandidates(units = []) {
    if (state.pathId !== 'mythic') return;
    const found = new Set(state.echoCandidates.map((e) => e.id));
    if (typeof FoundationalMedievalLayer !== 'undefined') {
      const heroes = FoundationalMedievalLayer.getRunSnapshot?.()?.mythicHeroes || [];
      for (const h of heroes) {
        if (ECHO_DEFS[h] && !found.has(h)) {
          state.echoCandidates.push({ id: h, ...ECHO_DEFS[h], source: 'foundation' });
          found.add(h);
        }
      }
    }
    if (typeof NarrativeThread !== 'undefined') {
      for (const h of NarrativeThread.getMythicLegendIds?.() || []) {
        if (ECHO_DEFS[h] && !found.has(h)) {
          state.echoCandidates.push({ id: h, ...ECHO_DEFS[h], source: 'legend' });
          found.add(h);
        }
      }
    }
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (ECHO_DEFS[u.type] && !found.has(u.type)) {
        state.echoCandidates.push({ id: u.type, ...ECHO_DEFS[u.type], source: 'field' });
        found.add(u.type);
      }
      if (u.honorName && !found.has('honored_veteran')) {
        state.echoCandidates.push({ id: 'honored_veteran', ...ECHO_DEFS.honored_veteran, source: 'honor' });
        found.add('honored_veteran');
      }
    }
  }

  function tickSynergyTiers(wave) {
    if (!state?.active) return;
    if (state.pathId === 'arcane') {
      let tier = 0;
      if (wave >= KINGDOM_WAVE) tier = 1;
      if (wave >= 200) tier = 2;
      if (wave >= GALACTIC_WAVE) tier = 3;
      if (wave >= 500) tier = 4;
      state.arcaneInfusionTier = tier;
    }
    if (state.pathId === 'martial' && wave >= KINGDOM_WAVE) {
      state.ancestralStacks = wave - KINGDOM_WAVE;
    }
  }

  function getAncestralWeaponMult(unit, wave = 0) {
    if (!state?.active || state.pathId !== 'martial' || wave < KINGDOM_WAVE) return 1;
    if (!unit?.type || !ANCESTRAL_TYPES.has(unit.type)) return 1;
    const wavesSince = Math.max(0, wave - KINGDOM_WAVE);
    const vet = unit.vetTier || 0;
    const honor = unit.honorName ? 1.12 : 1;
    const asc = unit.ascensionStageId ? 1.1 : 1;
    const echoBonus =
      state.recruitedEchoes?.find((e) => e.id === 'honored_veteran')?.ancestralBonus || 0;
    const stack = state.ancestralStacks || wavesSince;
    return 1 + stack * (0.0035 + echoBonus) + vet * 0.016 * honor * asc;
  }

  function getAncestralWeaponHpMult(unit, wave = 0) {
    const dmg = getAncestralWeaponMult(unit, wave);
    if (dmg <= 1) return 1;
    return 1 + (dmg - 1) * 0.65;
  }

  function getArcaneInfusionMods(wave = 0) {
    if (!state?.active || state.pathId !== 'arcane') {
      return {
        researchSpeedMult: 1,
        scienceGainMult: 1,
        playerDmgMult: 1,
        fleetDmgMult: 1,
        energyBonus: 0,
        note: '',
      };
    }
    const t = state.arcaneInfusionTier || 0;
    if (t <= 0) return { researchSpeedMult: 1, scienceGainMult: 1, playerDmgMult: 1, fleetDmgMult: 1, energyBonus: 0, note: '' };
    return {
      researchSpeedMult: 1 + 0.04 * t,
      scienceGainMult: 1 + 0.03 * t,
      playerDmgMult: 1 + 0.015 * t,
      fleetDmgMult: 1 + 0.025 * t,
      energyBonus: t * 2,
      enchantedAi: t >= 2,
      runeHulls: t >= 3,
      note: 'arcane-infused tech',
    };
  }

  function getHeroEchoMods() {
    if (!state?.active || state.pathId !== 'mythic' || !state.recruitedEchoes?.length) {
      return { playerDmgMult: 1, hpMult: 1, morale: 0, fleetReadiness: 0, fleetStrength: 0, note: '' };
    }
    let playerDmgMult = 1;
    let hpMult = 1;
    let morale = 0;
    let fleetReadiness = 0;
    let fleetStrength = 0;
    for (const echo of state.recruitedEchoes) {
      if (echo.playerDmgMult) playerDmgMult *= echo.playerDmgMult;
      if (echo.hpMult) hpMult *= echo.hpMult;
      morale += echo.morale || 0;
      fleetReadiness += echo.fleetReadiness || 0;
      fleetStrength += echo.fleetStrength || 0;
    }
    return {
      playerDmgMult,
      hpMult,
      morale,
      fleetReadiness,
      fleetStrength,
      note: `${state.recruitedEchoes.length} hero echo(s)`,
    };
  }

  /** Tactical-layer mods (damage calc, research, fleet) — excludes martial ancestral scaling. */
  function getSynergyTacticalMods(wave = 0) {
    const arcane = getArcaneInfusionMods(wave);
    const echoes = getHeroEchoMods();
    return {
      playerDmgMult: arcane.playerDmgMult * echoes.playerDmgMult,
      researchSpeedMult: arcane.researchSpeedMult,
      scienceGainMult: arcane.scienceGainMult,
      fleetDmgMult: arcane.fleetDmgMult,
      fleetReadiness: echoes.fleetReadiness,
      fleetStrength: echoes.fleetStrength,
      note: [arcane.note, echoes.note].filter(Boolean).join(', '),
    };
  }

  function getCombinedTacticalMods(wave = 0) {
    const tactical = getSynergyTacticalMods(wave);
    const echoes = getHeroEchoMods();
    return { ...tactical, hpMult: echoes.hpMult };
  }

  function applyThematicUnitBonuses(unit, wave = 0) {
    if (!state?.active || !unit || unit.team !== 'player') return unit;
    if (unit.thematicSynergyApplied) return unit;
    const wMult = getAncestralWeaponMult(unit, wave);
    const hMult = getAncestralWeaponHpMult(unit, wave);
    if (wMult > 1 && unit.damage) {
      unit.damage = Math.floor(unit.damage * wMult);
    }
    if (hMult > 1) {
      unit.maxHp = Math.floor(unit.maxHp * hMult);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    const echoes = getHeroEchoMods();
    if (echoes.hpMult > 1) {
      unit.maxHp = Math.floor(unit.maxHp * echoes.hpMult);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    if (echoes.morale > 0) {
      unit.morale = Math.min(unit.maxMorale, unit.morale + Math.floor(echoes.morale / 2));
    }
    unit.thematicSynergyApplied = true;
    if (wMult > 1.05) unit.ancestralWeapon = true;
    return unit;
  }

  function getTechTreeLabel() {
    if (typeof TechTreeBranches !== 'undefined') {
      const branchLabel = TechTreeBranches.getTechTreeLabel?.();
      if (branchLabel) return branchLabel;
    }
    const def = getSynergyDef();
    if (!def || state.pathId !== 'arcane') return null;
    return def.techTreeLabel;
  }

  function getArcaneFleetRuneMult(wave = GALACTIC_WAVE) {
    if (!state?.active || state.pathId !== 'arcane') return 1;
    const arc = getArcaneInfusionMods(wave);
    return arc.runeHulls ? arc.fleetDmgMult : arc.fleetDmgMult > 1 ? arc.fleetDmgMult : 1;
  }

  function recruitHeroEcho(echoId, ctx = {}) {
    if (!state?.active || state.pathId !== 'mythic') {
      return { ok: false, msg: 'Hero Echoes require the Mythic Alliance path.' };
    }
    const candidate = state.echoCandidates.find((e) => e.id === echoId);
    if (!candidate) return { ok: false, msg: 'No echo candidate available.' };
    if (state.recruitedEchoes.some((e) => e.id === echoId)) {
      return { ok: false, msg: 'Echo already recruited.' };
    }
    if (typeof AscensionSystem !== 'undefined') {
      const snap = AscensionSystem.getStateSnapshot({ wave: ctx.wave });
      if ((snap.legacyPoints || 0) < candidate.cost) {
        return { ok: false, msg: `Need ${candidate.cost} Legacy Points to recruit echo.` };
      }
      if (!AscensionSystem.spendLegacyPoints(candidate.cost)) {
        return { ok: false, msg: `Need ${candidate.cost} Legacy Points.` };
      }
    } else {
      return { ok: false, msg: 'Legacy Points required to recruit echo.' };
    }
    state.recruitedEchoes.push({ ...candidate });
    const msg = `Hero Echo recruited — ${candidate.label} (${candidate.role.replace('_', ' ')}).`;
    state.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 360);
    ctx.addHighlight?.('echo', msg);
    return { ok: true, echo: candidate };
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state) resetRun();
    if (ctx.creative) return null;
    if (wave >= KINGDOM_WAVE && !state.active) {
      resolveSynergyFromFoundations(ctx);
    }
    if (wave >= KINGDOM_WAVE) seedEchoCandidates(ctx.units || []);
    tickSynergyTiers(wave);
    if (wave === KINGDOM_WAVE && !kingdomAnnounced && state.active) {
      kingdomAnnounced = true;
      const def = getSynergyDef();
      ctx.showMessage?.(
        `Thematic synergy — ${def?.label}. ${def?.desc}`,
        420
      );
      ctx.addHighlight?.('milestone', `${def?.label} — cross-era path active`);
      if (state.pathId === 'mythic' && state.echoCandidates.length) {
        ctx.showMessage?.(
          `Hero Echoes available — recruit ${state.echoCandidates.length} champion echo(es) with Legacy Points.`,
          400
        );
      }
    }
    if (wave === GALACTIC_WAVE && !galacticAnnounced && state.active) {
      galacticAnnounced = true;
      if (state.pathId === 'arcane') {
        ctx.showMessage?.(
          'Arcane-Infused Technology online — rune hulls and enchanted AI steer the fleet.',
          400
        );
      }
      if (state.pathId === 'martial') {
        ctx.showMessage?.(
          `Ancestral Weapons deepen — +${(getAncestralWeaponMult({ type: 'footman', vetTier: 4 }, wave) * 100 - 100).toFixed(0)}% scaling on sworn arms.`,
          400
        );
      }
    }
    return getStateSnapshot({ wave });
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    const def = getSynergyDef();
    const mods = getCombinedTacticalMods(wave);
    const ancestralSample = getAncestralWeaponMult({ type: 'footman', vetTier: 4 }, wave);
    return {
      active: !!state?.active,
      pathId: state?.pathId || null,
      pathLabel: def?.label || null,
      pathDesc: def?.desc || null,
      pathColor: def?.color || null,
      techTreeLabel: getTechTreeLabel(),
      branches: def?.branches?.map((id) => ({ id, ...BRANCH_DEFS[id] })) || [],
      ancestralStacks: state?.ancestralStacks || 0,
      ancestralSamplePct: Math.round((ancestralSample - 1) * 100),
      arcaneInfusionTier: state?.arcaneInfusionTier || 0,
      arcane: getArcaneInfusionMods(wave),
      echoes: {
        candidates: state?.echoCandidates || [],
        recruited: state?.recruitedEchoes || [],
        mods: getHeroEchoMods(),
      },
      mods,
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    if (!state?.active) return '';
    const def = getSynergyDef();
    const wave = ctx.wave | 0;
    if (state.pathId === 'martial' && wave >= KINGDOM_WAVE) {
      const pct = Math.round((getAncestralWeaponMult({ type: 'archer', vetTier: 3 }, wave) - 1) * 100);
      return `${def?.short || 'Ancestral'} +${pct}%`;
    }
    if (state.pathId === 'arcane' && state.arcaneInfusionTier > 0) {
      return `${def?.short || 'Arcane'} T${state.arcaneInfusionTier}`;
    }
    if (state.pathId === 'mythic') {
      const n = state.recruitedEchoes?.length || 0;
      const c = state.echoCandidates?.length || 0;
      return n > 0 ? `${n} Echo` : c > 0 ? `${c} echo!` : def?.short || 'Echoes';
    }
    return def?.short || '';
  }

  function formatIntelNote(ctx = {}) {
    if (!state?.active) return '';
    const def = getSynergyDef();
    const parts = [def?.label?.toLowerCase() || state.pathId];
    if (state.pathId === 'martial') {
      parts.push(`ancestral +${getStateSnapshot(ctx).ancestralSamplePct}%`);
    }
    if (state.pathId === 'arcane' && state.arcaneInfusionTier > 0) {
      parts.push(`infusion T${state.arcaneInfusionTier}`);
    }
    if (state.pathId === 'mythic' && state.recruitedEchoes?.length) {
      parts.push(`${state.recruitedEchoes.length} echo`);
    }
    return parts.length ? `Synergy: ${parts.join(', ')}` : '';
  }

  resetRun();

  return {
    SYNERGY_DEFS,
    ECHO_DEFS,
    KINGDOM_WAVE,
    GALACTIC_WAVE,
    resetRun,
    resolveThematicPath,
    getPathId,
    getSynergyDef,
    getAncestralWeaponMult,
    getArcaneInfusionMods,
    getHeroEchoMods,
    getSynergyTacticalMods,
    getCombinedTacticalMods,
    getArcaneFleetRuneMult,
    getTechTreeLabel,
    applyThematicUnitBonuses,
    recruitHeroEcho,
    onWaveStart,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.ThematicEraSynergies = ThematicEraSynergies;
