/**
 * Ascension System — era-transition ascensions using Legacy Points.
 * Max veterans, buildings, and heroes ascend at Kingdom (150) and Galactic (400) gates.
 * Example: Immortal Footman → Paragon of the Realm → Stellar Warden (plasma halberd).
 */
const AscensionSystem = (() => {
  const STORAGE_KEY = 'myth-and-blood-ascension-meta-v1';

  const ERA_GATES = {
    kingdom: {
      id: 'kingdom',
      wave: 150,
      label: 'Kingdom Era',
      pointGrant: 18,
      desc: 'Grand Strategy unlocks — ascend veterans into realm paragons.',
    },
    galactic: {
      id: 'galactic',
      wave: 400,
      label: 'Galactic Era',
      pointGrant: 28,
      desc: 'Intergalactic layer unlocks — ascend paragons into stellar champions.',
    },
  };

  const UNIT_CHAINS = {
    footman: {
      kingdom: {
        id: 'paragon_realm',
        label: 'Paragon of the Realm',
        short: 'Paragon',
        cost: 14,
        minVetTier: 4,
        hpMult: 1.22,
        dmgMult: 1.18,
        moraleBonus: 5,
        desc: 'Royal guard of the empire — never mere fodder.',
      },
      galactic: {
        id: 'stellar_warden',
        label: 'Stellar Warden',
        short: 'Warden',
        weapon: 'Plasma Halberd',
        cost: 24,
        requiresStage: 'paragon_realm',
        hpMult: 1.38,
        dmgMult: 1.28,
        rangeBonus: 14,
        desc: 'Post-human sentinel wielding a plasma halberd across the void.',
      },
    },
    archer: {
      kingdom: {
        id: 'volley_saint',
        label: 'Volley Saint',
        short: 'Saint',
        cost: 14,
        minVetTier: 4,
        dmgMult: 1.24,
        rangeBonus: 18,
        desc: 'Imperial volley canonized — every arrow an edict.',
      },
      galactic: {
        id: 'void_sniper',
        label: 'Void Sniper',
        short: 'Sniper',
        weapon: 'Quantum Longbow',
        cost: 24,
        requiresStage: 'volley_saint',
        dmgMult: 1.32,
        rangeBonus: 28,
        desc: 'Ancestral spirits and quantum aim-assist guide transhuman shots.',
      },
    },
    knight: {
      kingdom: {
        id: 'realm_champion',
        label: 'Champion of the Realm',
        short: 'Champion',
        cost: 16,
        minVetTier: 4,
        hpMult: 1.26,
        dmgMult: 1.2,
        desc: 'Honor-bound knight elevated to imperial champion.',
      },
      galactic: {
        id: 'star_lancer',
        label: 'Star Lancer',
        short: 'Lancer',
        weapon: 'Solar Lance',
        cost: 26,
        requiresStage: 'realm_champion',
        hpMult: 1.4,
        dmgMult: 1.3,
        desc: 'Charges through vacuum in blazing coronal plate.',
      },
    },
    mage: {
      kingdom: {
        id: 'court_scholarch',
        label: 'Court Scholarch',
        short: 'Scholarch',
        cost: 15,
        minVetTier: 3,
        dmgMult: 1.26,
        rangeBonus: 16,
        desc: 'Arcane dominion made flesh — towers bow to their will.',
      },
      galactic: {
        id: 'aether_weaver',
        label: 'Aether Weaver',
        short: 'Weaver',
        weapon: 'Reality Staff',
        cost: 26,
        requiresStage: 'court_scholarch',
        dmgMult: 1.36,
        rangeBonus: 22,
        desc: 'Bends local physics — star-system scale sorcery.',
      },
    },
    healer: {
      kingdom: {
        id: 'sanctuary_keeper',
        label: 'Sanctuary Keeper',
        short: 'Keeper',
        cost: 12,
        minVetTier: 3,
        hpMult: 1.15,
        healMult: 1.3,
        desc: 'Empire-wide healing doctrine personified.',
      },
      galactic: {
        id: 'genesis_medic',
        label: 'Genesis Medic',
        short: 'Medic',
        cost: 22,
        requiresStage: 'sanctuary_keeper',
        healMult: 1.45,
        hpMult: 1.2,
        desc: 'Regenerates tissue at the cellular level across eras.',
      },
    },
    tank_dempsey: {
      kingdom: {
        id: 'siege_legend',
        label: 'Siege Legend',
        short: 'Legend',
        cost: 18,
        minVetTier: 2,
        dmgMult: 1.2,
        hpMult: 1.15,
        desc: 'Crossover champion sworn to the crown.',
      },
      galactic: {
        id: 'orbital_breaker',
        label: 'Orbital Breaker',
        short: 'Breaker',
        weapon: 'Planetary Frag',
        cost: 28,
        requiresStage: 'siege_legend',
        dmgMult: 1.35,
        desc: 'Frag Out scales to orbital bombardment.',
      },
    },
    goku: {
      kingdom: {
        id: 'mythic_champion',
        label: 'Mythic Champion',
        short: 'Champion',
        cost: 20,
        minVetTier: 1,
        dmgMult: 1.22,
        hpMult: 1.18,
        desc: 'Living legend of the mythic alliance.',
      },
      galactic: {
        id: 'pantheon_herald',
        label: 'Pantheon Herald',
        short: 'Herald',
        cost: 30,
        requiresStage: 'mythic_champion',
        dmgMult: 1.4,
        hpMult: 1.28,
        desc: 'Literal god-tier crossover ascendant.',
      },
    },
  };

  const BUILDING_CHAINS = {
    wall: {
      kingdom: {
        id: 'bulwark_ages',
        label: 'Bulwark of Ages',
        cost: 12,
        hpMult: 1.35,
        desc: 'Walls remember every siege.',
      },
      galactic: {
        id: 'stellar_aegis',
        label: 'Stellar Aegis',
        cost: 20,
        requiresStage: 'bulwark_ages',
        hpMult: 1.55,
        desc: 'Orbital shield lattice woven into stone.',
      },
    },
    barracks: {
      kingdom: {
        id: 'regiment_hall',
        label: 'Regiment Hall',
        cost: 14,
        desc: 'Trains paragons — +1 morale to spawned troops.',
        spawnMoraleBonus: 3,
      },
      galactic: {
        id: 'void_muster',
        label: 'Void Muster Yard',
        cost: 22,
        requiresStage: 'regiment_hall',
        spawnMoraleBonus: 5,
        desc: 'Galactic muster — veterans ascend on deploy.',
      },
    },
    academy_footman: {
      kingdom: {
        id: 'paragon_academy',
        label: 'Paragon Academy',
        cost: 16,
        desc: 'Graduates begin one vet tier higher.',
        academyVetBonus: 1,
      },
      galactic: {
        id: 'stellar_academy',
        label: 'Stellar Academy',
        cost: 24,
        requiresStage: 'paragon_academy',
        academyVetBonus: 2,
        desc: 'Post-human drill from day one.',
      },
    },
  };

  let run = null;
  let meta = { totalAscensions: 0, totalLegacySpent: 0 };
  let kingdomAnnounced = false;
  let galacticAnnounced = false;

  function loadMeta() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) meta = { ...meta, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
  }

  function saveMeta() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    } catch (_) {
      /* ignore */
    }
  }

  function resetRun() {
    run = {
      legacyPoints: 0,
      legacyEarned: 0,
      eraClaimed: { kingdom: false, galactic: false },
      ascendedUnits: 0,
      ascendedBuildings: 0,
      log: [],
    };
    kingdomAnnounced = false;
    galacticAnnounced = false;
  }

  function onRunStart(ctx = {}) {
    loadMeta();
    if (!run) resetRun();
    if (ctx.creative) return;
  }

  function getChainKey(unit) {
    if (!unit?.type) return null;
    if (UNIT_CHAINS[unit.type]) return unit.type;
    return null;
  }

  function getEraForWave(wave) {
    if ((wave | 0) >= ERA_GATES.galactic.wave) return 'galactic';
    if ((wave | 0) >= ERA_GATES.kingdom.wave) return 'kingdom';
    return null;
  }

  function getStageDef(chain, era) {
    return chain?.[era] || null;
  }

  function getUnitAscensionOffer(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return null;
    const key = getChainKey(unit);
    const chain = key ? UNIT_CHAINS[key] : null;
    if (!chain) return null;
    const era = getEraForWave(wave);
    if (!era) return null;
    const stage = getStageDef(chain, era);
    if (!stage) return null;
    if (unit.ascensionStageId === stage.id) return null;
    if (stage.requiresStage && unit.ascensionStageId !== stage.requiresStage) {
      const priorEra = era === 'galactic' ? 'kingdom' : null;
      if (!priorEra || unit.ascensionStageId !== getStageDef(chain, priorEra)?.id) return null;
    }
    if ((unit.vetTier || 0) < (stage.minVetTier || 4)) return null;
    if (unit.isGeneral && key === 'footman') return null;
    return { era, stage, chainKey: key, cost: stage.cost };
  }

  function getBuildingAscensionOffer(building, wave = 0) {
    if (!building || building.owner !== 'player' || !building.complete || building.hp <= 0) {
      return null;
    }
    const chain = BUILDING_CHAINS[building.type];
    if (!chain) return null;
    const era = getEraForWave(wave);
    if (!era) return null;
    const stage = getStageDef(chain, era);
    if (!stage) return null;
    if (building.ascensionStageId === stage.id) return null;
    if (stage.requiresStage && building.ascensionStageId !== stage.requiresStage) return null;
    return { era, stage, cost: stage.cost, buildingType: building.type };
  }

  function grantLegacyPoints(amount, reason = '') {
    if (!run || amount <= 0) return 0;
    run.legacyPoints += amount;
    run.legacyEarned += amount;
    if (reason) run.log.unshift({ at: Date.now(), text: `+${amount} Legacy — ${reason}` });
    return amount;
  }

  function spendLegacyPoints(amount) {
    if (!run || amount > run.legacyPoints) return false;
    run.legacyPoints -= amount;
    meta.totalLegacySpent += amount;
    saveMeta();
    return true;
  }

  function countImmortalVeterans(units = []) {
    const maxTier = typeof MAX_VETERAN_TIER !== 'undefined' ? MAX_VETERAN_TIER : 6;
    return units.filter((u) => u.team === 'player' && u.hp > 0 && (u.vetTier || 0) >= maxTier)
      .length;
  }

  function applyStageToUnit(unit, stage, era) {
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
    if (stage.hpMult) {
      unit.maxHp = Math.floor(unit.maxHp * stage.hpMult);
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
    }
    if (stage.dmgMult && unit.damage) {
      unit.damage = Math.floor(unit.damage * stage.dmgMult);
    }
    if (stage.healMult && unit.healAmount) {
      unit.healAmount = Math.floor(unit.healAmount * stage.healMult);
    }
    if (stage.rangeBonus && unit.range) {
      unit.range = Math.floor(unit.range + stage.rangeBonus);
    }
    if (stage.moraleBonus) {
      unit.maxMorale = Math.min(100, unit.maxMorale + stage.moraleBonus);
      unit.morale = Math.min(unit.maxMorale, unit.morale + stage.moraleBonus);
    }
    unit.ascensionStageId = stage.id;
    unit.ascensionLabel = stage.label;
    unit.ascensionShort = stage.short || stage.label;
    unit.ascensionWeapon = stage.weapon || null;
    unit.ascensionEra = era;
    unit.ascensionTitle = stage.weapon
      ? `${stage.label} (${stage.weapon})`
      : stage.label;
    unit.ascensionApplied = true;
  }

  function applyStageToBuilding(building, stage, era) {
    if (stage.hpMult && building.maxHp) {
      const ratio = building.hp / building.maxHp;
      building.maxHp = Math.floor(building.maxHp * stage.hpMult);
      building.hp = Math.max(1, Math.floor(building.maxHp * ratio));
    }
    building.ascensionStageId = stage.id;
    building.ascensionLabel = stage.label;
    building.ascensionEra = era;
    building.spawnMoraleBonus = (building.spawnMoraleBonus || 0) + (stage.spawnMoraleBonus || 0);
    building.academyVetBonus = (building.academyVetBonus || 0) + (stage.academyVetBonus || 0);
    building.ascensionApplied = true;
  }

  function tryAscendUnit(unit, wave, ctx = {}) {
    const offer = getUnitAscensionOffer(unit, wave);
    if (!offer) return { ok: false, msg: 'Not eligible for ascension.' };
    if (!spendLegacyPoints(offer.cost)) {
      return { ok: false, msg: `Need ${offer.cost} Legacy Points (${run.legacyPoints} available).` };
    }
    applyStageToUnit(unit, offer.stage, offer.era);
    run.ascendedUnits += 1;
    meta.totalAscensions += 1;
    saveMeta();
    const msg = `Ascended — ${offer.stage.label}${offer.stage.weapon ? ` (${offer.stage.weapon})` : ''}!`;
    run.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 360);
    ctx.addHighlight?.('ascension', msg);
    if (typeof AudioEngine !== 'undefined') AudioEngine?.SFX?.reinforce?.();
    return { ok: true, stage: offer.stage.id, label: offer.stage.label };
  }

  function tryAscendBuilding(building, wave, ctx = {}) {
    const offer = getBuildingAscensionOffer(building, wave);
    if (!offer) return { ok: false, msg: 'Building not eligible for ascension.' };
    if (!spendLegacyPoints(offer.cost)) {
      return { ok: false, msg: `Need ${offer.cost} Legacy Points (${run.legacyPoints} available).` };
    }
    applyStageToBuilding(building, offer.stage, offer.era);
    run.ascendedBuildings += 1;
    meta.totalAscensions += 1;
    saveMeta();
    const msg = `Ascended — ${building.ascensionLabel}!`;
    run.log.unshift({ at: Date.now(), text: msg });
    ctx.showMessage?.(msg, 320);
    return { ok: true, stage: offer.stage.id };
  }

  function reapplyAscensionBonuses(unit) {
    if (!unit?.ascensionStageId) return unit;
    const key = getChainKey(unit);
    const chain = key ? UNIT_CHAINS[key] : null;
    if (!chain) return unit;
    for (const era of ['kingdom', 'galactic']) {
      const s = getStageDef(chain, era);
      if (s?.id === unit.ascensionStageId) {
        unit.ascensionLabel = s.label;
        unit.ascensionShort = s.short || s.label;
        unit.ascensionWeapon = s.weapon || unit.ascensionWeapon || null;
        unit.ascensionTitle = s.weapon ? `${s.label} (${s.weapon})` : s.label;
      }
    }
    return unit;
  }

  function applySpawnBonusesFromBuildings(unit, buildings = []) {
    if (!unit || unit.team !== 'player') return;
    let morale = 0;
    let vetBonus = 0;
    for (const b of buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      morale += b.spawnMoraleBonus || 0;
      vetBonus = Math.max(vetBonus, b.academyVetBonus || 0);
    }
    if (morale > 0) unit.morale = Math.min(unit.maxMorale, unit.morale + morale);
    if (vetBonus > 0 && (unit.vetTier || 0) < vetBonus) {
      unit.vetTier = Math.max(unit.vetTier || 0, vetBonus);
      if (typeof syncVeteranStatsToTier === 'function') syncVeteranStatsToTier(unit);
    }
  }

  function getDisplayTitle(unit) {
    if (!unit?.ascensionTitle) return null;
    if (unit.honorName && isValidHonorName?.(unit.honorName)) {
      return `${unit.honorName}, ${unit.ascensionShort || unit.ascensionLabel}`;
    }
    return unit.ascensionTitle;
  }

  function getAscensionDmgMult(unit) {
    if (!unit?.ascensionStageId) return 1;
    const key = getChainKey(unit);
    const chain = key ? UNIT_CHAINS[key] : null;
    if (!chain) return 1;
    let mult = 1;
    for (const era of ['kingdom', 'galactic']) {
      const s = getStageDef(chain, era);
      if (!s) continue;
      if (
        unit.ascensionStageId === s.id ||
        (era === 'galactic' && unit.ascensionStageId === chain.galactic?.id)
      ) {
        if (s.dmgMult) mult *= s.dmgMult;
      }
      if (unit.ascensionStageId === chain.kingdom?.id && era === 'kingdom' && s.dmgMult) {
        mult = s.dmgMult;
      }
    }
    const key2 = getChainKey(unit);
    const c = key2 ? UNIT_CHAINS[key2] : null;
    if (!c) return 1;
    if (unit.ascensionStageId === c.kingdom?.id && c.kingdom?.dmgMult) return c.kingdom.dmgMult;
    if (unit.ascensionStageId === c.galactic?.id) {
      return (c.kingdom?.dmgMult || 1) * (c.galactic?.dmgMult || 1);
    }
    return mult;
  }

  function getAscensionHpMult(unit) {
    const key = getChainKey(unit);
    const c = key ? UNIT_CHAINS[key] : null;
    if (!c || !unit?.ascensionStageId) return 1;
    if (unit.ascensionStageId === c.kingdom?.id && c.kingdom?.hpMult) return c.kingdom.hpMult;
    if (unit.ascensionStageId === c.galactic?.id) {
      return (c.kingdom?.hpMult || 1) * (c.galactic?.hpMult || 1);
    }
    return 1;
  }

  function onWaveStart(wave, ctx = {}) {
    if (!run) resetRun();
    if (ctx.creative) return null;
    for (const gate of Object.values(ERA_GATES)) {
      if ((wave | 0) !== gate.wave || run.eraClaimed[gate.id]) continue;
      run.eraClaimed[gate.id] = true;
      let grant = gate.pointGrant;
      const immortals = countImmortalVeterans(ctx.units || []);
      if (immortals > 0) grant += immortals * 3;
      grantLegacyPoints(grant, `${gate.label} transition`);
      const announceKey = gate.id === 'kingdom' ? 'kingdomAnnounced' : 'galacticAnnounced';
      if (gate.id === 'kingdom' && !kingdomAnnounced) {
        kingdomAnnounced = true;
        ctx.showMessage?.(
          `Ascension unlocked — ${grant} Legacy Points. Max veterans can ascend at era transitions (unit panel).`,
          440
        );
        ctx.addHighlight?.('milestone', `${gate.label} — ascend Immortal troops with Legacy Points`);
      }
      if (gate.id === 'galactic' && !galacticAnnounced) {
        galacticAnnounced = true;
        ctx.showMessage?.(
          `Galactic Ascension — ${grant} Legacy Points. Paragons become Stellar Wardens, Void Snipers, and more.`,
          460
        );
        ctx.addHighlight?.('milestone', 'Stellar Ascension — plasma halberds and orbital legends');
      }
    }
    return getStateSnapshot({ wave });
  }

  function getStateSnapshot(ctx = {}) {
    const wave = ctx.wave | 0;
    const era = getEraForWave(wave);
    return {
      active: !!era,
      legacyPoints: run?.legacyPoints || 0,
      legacyEarned: run?.legacyEarned || 0,
      era,
      eraLabel: era ? ERA_GATES[era]?.label : null,
      ascendedUnits: run?.ascendedUnits || 0,
      ascendedBuildings: run?.ascendedBuildings || 0,
      totalAscensions: meta.totalAscensions || 0,
      kingdomGate: ERA_GATES.kingdom.wave,
      galacticGate: ERA_GATES.galactic.wave,
      eraClaimed: { ...(run?.eraClaimed || {}) },
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    if (!run) return '';
    const wave = ctx.wave | 0;
    const era = getEraForWave(wave);
    if (!era && (run.legacyPoints || 0) <= 0) return '';
    const pts = run.legacyPoints || 0;
    const asc = run.ascendedUnits + run.ascendedBuildings;
    if (era) return `${pts} Legacy · ${asc} ascended`;
    return pts > 0 ? `${pts} Legacy` : '';
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave | 0;
    const parts = [];
    if (run?.legacyPoints > 0) parts.push(`${run.legacyPoints} legacy`);
    if (run?.ascendedUnits > 0) parts.push(`${run.ascendedUnits} ascended`);
    const era = getEraForWave(wave);
    if (era && !run?.eraClaimed?.[era]) parts.push(`${ERA_GATES[era].label} gate`);
    return parts.length ? `Ascension: ${parts.join(', ')}` : '';
  }

  loadMeta();
  resetRun();

  return {
    ERA_GATES,
    UNIT_CHAINS,
    BUILDING_CHAINS,
    resetRun,
    onRunStart,
    onWaveStart,
    getUnitAscensionOffer,
    getBuildingAscensionOffer,
    tryAscendUnit,
    tryAscendBuilding,
    reapplyAscensionBonuses,
    applySpawnBonusesFromBuildings,
    getDisplayTitle,
    getAscensionDmgMult,
    getAscensionHpMult,
    grantLegacyPoints,
    spendLegacyPoints,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.AscensionSystem = AscensionSystem;
