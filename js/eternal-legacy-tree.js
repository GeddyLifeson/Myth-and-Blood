/**
 * Crown of Ages — Eternal Legacy Tech Tree + Echoes of the Past.
 * Persistent branching paths from medieval tactics through galactic eras;
 * early units and heroes ascend rather than becoming obsolete.
 */
const EternalLegacyTree = (() => {
  const STORAGE_KEY = 'myth-and-blood-eternal-legacy-v1';

  const BRANCHES = {
    crown_trunk: {
      id: 'crown_trunk',
      label: 'Crown Trunk',
      epithet: 'the Crown of Ages',
      desc: 'Foundational echoes every path shares.',
      color: '#c0a050',
    },
    iron_crown: {
      id: 'iron_crown',
      label: 'Iron Crown',
      epithet: 'the Iron Crown path',
      desc: 'Martial ascension — footmen, knights, and siege memory endure.',
      color: '#c04040',
    },
    silver_diplomat: {
      id: 'silver_diplomat',
      label: 'Silver Diplomat',
      epithet: 'the Silver Echo path',
      desc: 'Walls, archers, and healers echo through every era.',
      color: '#80a0c0',
    },
    arcane_scholar: {
      id: 'arcane_scholar',
      label: 'Arcane Scholar',
      epithet: 'the Arcane Resonance path',
      desc: 'Magic and research compound — nothing fades, only amplifies.',
      color: '#8060e0',
    },
    pragmatist: {
      id: 'pragmatist',
      label: 'Pragmatist',
      epithet: 'the Eternal Champion path',
      desc: 'Crossover heroes and veterans adapt — heroes never retire.',
      color: '#c0a040',
    },
  };

  const TIER_LABELS = {
    1: 'Crown Dawn',
    2: 'Empire Echo',
    3: 'Dominion Resonance',
    4: 'Galactic Memory',
  };

  const CORE_TYPES = new Set(['footman', 'archer', 'pikeman']);
  const MELEE_HERO_TYPES = new Set(['knight', 'general', 'doomslayer_hero', 'paladin']);

  /** @type {Record<string, object>} */
  const TREE_NODES = {
    crown_first_echo: {
      id: 'crown_first_echo',
      branch: 'crown_trunk',
      tier: 1,
      name: 'First Echo',
      hint: 'Complete any campaign run',
      desc: '+2 TP — the Crown remembers your first victory.',
      cost: 0,
      prereq: [],
      unlock: (leg) => (leg.victories || 0) >= 1,
      effects: { startTp: 2 },
    },
    crown_age_mark: {
      id: 'crown_age_mark',
      branch: 'crown_trunk',
      tier: 1,
      name: 'Age Mark',
      hint: 'Reach wave 25 on any run',
      desc: 'Unlocks deeper Crown of Ages branches.',
      cost: 1,
      prereq: ['crown_first_echo'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 25,
      effects: {},
      gate: true,
    },
    seed_longbow_legacy: {
      id: 'seed_longbow_legacy',
      branch: 'iron_crown',
      tier: 1,
      name: 'Longbow Legacy Seed',
      hint: 'Crystallize Longbow path — heavy archer & footman play (waves 1–150)',
      desc: 'Foundational DNA — opens martial echo branches.',
      cost: 1,
      prereq: ['crown_age_mark'],
      foundationPath: 'longbow_legacy',
      effects: { ascendDmgMult: 1.02 },
      ascends: ['archer', 'footman'],
      gate: true,
    },
    seed_arcane_dominion: {
      id: 'seed_arcane_dominion',
      branch: 'arcane_scholar',
      tier: 1,
      name: 'Arcane Dominion Seed',
      hint: 'Crystallize Arcane path — academies & research (waves 1–150)',
      desc: 'Foundational DNA — opens scholarly echo branches.',
      cost: 1,
      prereq: ['crown_age_mark'],
      foundationPath: 'arcane_dominion',
      effects: { scienceCapMult: 1.04 },
      gate: true,
    },
    seed_mythic_alliance: {
      id: 'seed_mythic_alliance',
      branch: 'pragmatist',
      tier: 1,
      name: 'Mythic Alliance Seed',
      hint: 'Crystallize Mythic path — evolved heroes (waves 1–150)',
      desc: 'Foundational DNA — Dempsey, Kael Skyburst, and mythic champions echo forever.',
      cost: 1,
      prereq: ['crown_age_mark'],
      foundationPath: 'mythic_alliance',
      effects: { crossoverMorale: 1 },
      gate: true,
    },
    iron_volley_tradition: {
      id: 'iron_volley_tradition',
      branch: 'iron_crown',
      tier: 1,
      name: 'Volley Tradition',
      hint: '50+ archer kills (lifetime)',
      desc: 'Archers +4% damage — medieval volleys echo forever.',
      cost: 2,
      prereq: ['crown_age_mark'],
      foundationPath: 'longbow_legacy',
      foundationPrereq: ['seed_longbow_legacy'],
      unlock: (leg) => (leg.unitKills?.archer || 0) >= 30,
      ascends: ['archer'],
      effects: { ascendDmgMult: 1.04 },
    },
    iron_shield_wall: {
      id: 'iron_shield_wall',
      branch: 'iron_crown',
      tier: 1,
      name: 'Shield Wall Memory',
      hint: 'Reach wave 30+ or invest Longbow Legacy seed',
      desc: 'Footmen & pikemen +4% HP — the line never breaks.',
      cost: 2,
      prereq: ['crown_age_mark'],
      foundationPath: 'longbow_legacy',
      foundationPrereq: ['seed_longbow_legacy'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 30,
      ascends: ['footman', 'pikeman'],
      effects: { ascendHpMult: 1.04 },
    },
    iron_siege_memory: {
      id: 'iron_siege_memory',
      branch: 'iron_crown',
      tier: 2,
      name: 'Siege Memory',
      hint: '400+ lifetime kills',
      desc: 'Player damage +3% — siege craft carried forward.',
      cost: 3,
      prereq: ['iron_shield_wall'],
      unlock: (leg) => (leg.totalKills || 0) >= 400,
      effects: { playerDmgMult: 1.03 },
    },
    iron_knight_ascendant: {
      id: 'iron_knight_ascendant',
      branch: 'iron_crown',
      tier: 2,
      name: 'Knight Ascendant',
      hint: 'Reach wave 60+',
      desc: 'Knights & melee heroes +5% damage.',
      cost: 3,
      prereq: ['iron_volley_tradition', 'iron_shield_wall'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 60,
      ascends: ['knight', 'general', 'paladin'],
      effects: { ascendDmgMult: 1.05 },
    },
    iron_empire_legion: {
      id: 'iron_empire_legion',
      branch: 'iron_crown',
      tier: 3,
      name: 'Empire Legion',
      hint: 'Reach wave 120+',
      desc: 'Core troops +4% damage at empire scale.',
      cost: 4,
      prereq: ['iron_siege_memory'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 120,
      ascends: ['footman', 'archer', 'pikeman'],
      effects: { ascendDmgMult: 1.04 },
    },
    iron_galactic_spear: {
      id: 'iron_galactic_spear',
      branch: 'iron_crown',
      tier: 4,
      name: 'Galactic Spearpoint',
      hint: 'Reach wave 300+',
      desc: 'All martial ascensions +6% at galactic waves.',
      cost: 5,
      prereq: ['iron_empire_legion', 'iron_knight_ascendant'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 300,
      effects: { martialAscendMult: 1.06 },
    },
    silver_arrow_ward: {
      id: 'silver_arrow_ward',
      branch: 'silver_diplomat',
      tier: 1,
      name: 'Arrow Ward',
      hint: 'Clear 15+ waves (lifetime)',
      desc: 'Archers +5% HP — silver wards protect the line.',
      cost: 2,
      prereq: ['crown_age_mark'],
      unlock: (leg) => (leg.totalWavesCleared || 0) >= 15,
      ascends: ['archer'],
      effects: { ascendHpMult: 1.05 },
    },
    silver_rampart_echo: {
      id: 'silver_rampart_echo',
      branch: 'silver_diplomat',
      tier: 1,
      name: 'Rampart Echo',
      hint: 'Reach wave 40+',
      desc: 'Walls +3% protection.',
      cost: 2,
      prereq: ['crown_age_mark'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 40,
      effects: { wallProtectionBonus: 0.03 },
    },
    silver_healer_chorus: {
      id: 'silver_healer_chorus',
      branch: 'silver_diplomat',
      tier: 2,
      name: 'Healer Chorus',
      hint: 'Deploy healers 20+ times (lifetime)',
      desc: 'Healers & clerics +5% heal potency.',
      cost: 3,
      prereq: ['silver_arrow_ward'],
      unlock: (leg) => (leg.unitDeploys?.healer || 0) >= 20 || (leg.unitDeploys?.cleric || 0) >= 10,
      ascends: ['healer', 'cleric'],
      effects: { ascendHealMult: 1.05 },
    },
    silver_bastion_age: {
      id: 'silver_bastion_age',
      branch: 'silver_diplomat',
      tier: 3,
      name: 'Bastion Age',
      hint: 'Reach wave 100+',
      desc: 'Buildings +5% HP — settlements endure epochs.',
      cost: 4,
      prereq: ['silver_rampart_echo'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 100,
      effects: { buildingHpMult: 1.05 },
    },
    silver_diplomat_pact: {
      id: 'silver_diplomat_pact',
      branch: 'silver_diplomat',
      tier: 3,
      name: 'Diplomat Pact',
      hint: 'Win 2+ campaign victories',
      desc: '+2 morale at run start — silver composure.',
      cost: 3,
      prereq: ['silver_healer_chorus'],
      unlock: (leg) => (leg.victories || 0) >= 2,
      effects: { startMorale: 2 },
    },
    silver_eternal_bulwark: {
      id: 'silver_eternal_bulwark',
      branch: 'silver_diplomat',
      tier: 4,
      name: 'Eternal Bulwark',
      hint: 'Reach wave 350+',
      desc: 'Walls +5%, damage taken −2%.',
      cost: 5,
      prereq: ['silver_bastion_age', 'silver_diplomat_pact'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 350,
      effects: { wallProtectionBonus: 0.05, damageTakenMult: 0.98 },
    },
    arcane_spark: {
      id: 'arcane_spark',
      branch: 'arcane_scholar',
      tier: 1,
      name: 'Arcane Spark',
      hint: 'Deploy mages 15+ times',
      desc: 'Mages +5% damage — first sparks never fade.',
      cost: 2,
      prereq: ['crown_age_mark'],
      foundationPath: 'arcane_dominion',
      foundationPrereq: ['seed_arcane_dominion'],
      unlock: (leg) => (leg.unitDeploys?.mage || 0) >= 15,
      ascends: ['mage', 'wizard', 'warlock'],
      effects: { ascendDmgMult: 1.05 },
    },
    arcane_lore_seep: {
      id: 'arcane_lore_seep',
      branch: 'arcane_scholar',
      tier: 1,
      name: 'Lore Seep',
      hint: 'Clear 30+ waves or invest Arcane Dominion seed',
      desc: '+6% science per wave cap.',
      cost: 2,
      prereq: ['crown_age_mark'],
      foundationPath: 'arcane_dominion',
      foundationPrereq: ['seed_arcane_dominion'],
      unlock: (leg) => (leg.totalWavesCleared || 0) >= 30,
      effects: { scienceCapMult: 1.06 },
    },
    arcane_scholars_tower: {
      id: 'arcane_scholars_tower',
      branch: 'arcane_scholar',
      tier: 2,
      name: "Scholar's Tower",
      hint: 'Reach wave 70+',
      desc: 'Research projects complete 8% faster.',
      cost: 3,
      prereq: ['arcane_lore_seep'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 70,
      effects: { researchSpeedMult: 1.08 },
    },
    arcane_storm_memory: {
      id: 'arcane_storm_memory',
      branch: 'arcane_scholar',
      tier: 3,
      name: 'Storm Memory',
      hint: 'Reach wave 150+',
      desc: 'Arcane ascensions +6% damage.',
      cost: 4,
      prereq: ['arcane_spark', 'arcane_scholars_tower'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 150,
      ascends: ['mage', 'wizard', 'warlock', 'elemental'],
      effects: { ascendDmgMult: 1.06 },
    },
    arcane_ley_resonance: {
      id: 'arcane_ley_resonance',
      branch: 'arcane_scholar',
      tier: 4,
      name: 'Ley Resonance',
      hint: 'Reach wave 400+',
      desc: 'Kill science +10%, arcane troops +4% HP.',
      cost: 5,
      prereq: ['arcane_storm_memory'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 400,
      effects: { scienceGainMult: 1.1, ascendHpMult: 1.04 },
      ascends: ['mage', 'wizard', 'warlock', 'elemental'],
    },
    prag_hero_wake: {
      id: 'prag_hero_wake',
      branch: 'pragmatist',
      tier: 1,
      name: 'Hero Wake',
      hint: 'Field a evolved faction on any run',
      desc: 'Crossover heroes +3 morale at spawn.',
      cost: 2,
      prereq: ['crown_age_mark'],
      foundationPath: 'mythic_alliance',
      foundationPrereq: ['seed_mythic_alliance'],
      unlock: (leg) => (leg.factionsUsed?.length || 0) >= 1,
      effects: { crossoverMorale: 3 },
    },
    prag_veteran_echo: {
      id: 'prag_veteran_echo',
      branch: 'pragmatist',
      tier: 1,
      name: 'Veteran Echo',
      hint: 'Crown 2 honor names or invest Mythic Alliance seed',
      desc: 'Honored troops +3% HP & damage.',
      cost: 2,
      prereq: ['crown_age_mark'],
      foundationPath: 'mythic_alliance',
      foundationPrereq: ['seed_mythic_alliance'],
      unlock: (leg) => (leg.honorCount || 0) >= 2,
      effects: { honorHpMult: 1.03, honorDmgMult: 1.03 },
    },
    prag_crossover_ascend: {
      id: 'prag_crossover_ascend',
      branch: 'pragmatist',
      tier: 2,
      name: 'Crossover Ascend',
      hint: 'Reach wave 90+ with crossover fielded',
      desc: 'Crossover unit types +5% all combat stats.',
      cost: 3,
      prereq: ['prag_hero_wake'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 90 && (leg.factionsUsed?.length || 0) >= 1,
      effects: { crossoverStatMult: 1.05 },
    },
    prag_favorite_eternal: {
      id: 'prag_favorite_eternal',
      branch: 'pragmatist',
      tier: 3,
      name: 'Favorite Eternal',
      hint: '50+ kills with favorite unit type',
      desc: 'Favorite troop +7% damage — never obsolete.',
      cost: 4,
      prereq: ['prag_veteran_echo'],
      unlock: (leg) => {
        const fav = leg.favoriteUnitType;
        return !!fav && (leg.unitKills?.[fav] || 0) >= 50;
      },
      effects: { favoriteDmgMult: 1.07, useFavoriteType: true },
    },
    prag_champion_crown: {
      id: 'prag_champion_crown',
      branch: 'pragmatist',
      tier: 4,
      name: 'Champion Crown',
      hint: 'Reach wave 500+',
      desc: 'Heroes & crossover ascensions +8% at endgame.',
      cost: 5,
      prereq: ['prag_crossover_ascend', 'prag_favorite_eternal'],
      unlock: (leg) => (leg.maxWaveEver || 0) >= 500,
      effects: { heroAscendMult: 1.08 },
    },
  };

  let data = {
    investedIds: [],
    seenUnlockIds: [],
    seenInvestIds: [],
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = { ...data, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    if (!Array.isArray(data.investedIds)) data.investedIds = [];
    if (!Array.isArray(data.seenUnlockIds)) data.seenUnlockIds = [];
    if (!Array.isArray(data.seenInvestIds)) data.seenInvestIds = [];
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      /* ignore */
    }
  }

  function getLegacySnapshot() {
    return typeof Legacy !== 'undefined' ? Legacy.get() : {};
  }

  function computeEchoShards(leg = null) {
    const snap = leg || getLegacySnapshot();
    return (
      (snap.victories || 0) * 3 +
      Math.min(24, Math.floor((snap.maxWaveEver || 0) / 20)) +
      Math.min(12, Math.floor((snap.totalKills || 0) / 250)) +
      Math.min(10, snap.honorCount || 0) +
      Math.min(6, (snap.factionsUsed?.length || 0) * 2)
    );
  }

  function getSpentShards() {
    load();
    let n = 0;
    for (const id of data.investedIds) {
      const def = TREE_NODES[id];
      if (def?.cost) n += def.cost;
    }
    return n;
  }

  function getAvailableShards(leg = null) {
    return Math.max(0, computeEchoShards(leg) - getSpentShards());
  }

  function hasFoundationPath(pathId) {
    return (
      typeof FoundationalMedievalLayer !== 'undefined' &&
      FoundationalMedievalLayer.hasCrystallizedPath(pathId)
    );
  }

  function isUnlockEligible(id, leg = null) {
    const def = TREE_NODES[id];
    if (!def) return false;
    const snap = leg || getLegacySnapshot();
    if (def.foundationPath && hasFoundationPath(def.foundationPath)) {
      if (!def.unlock) return true;
      if (def.foundationPrereq?.length && def.foundationPrereq.every((p) => isInvested(p))) {
        return true;
      }
    }
    return typeof def.unlock === 'function' ? !!def.unlock(snap) : true;
  }

  function prereqsMet(id) {
    load();
    const def = TREE_NODES[id];
    if (!def) return false;
    const invested = data.investedIds;
    const reqs = def.prereq || [];
    if (reqs.every((p) => invested.includes(p))) return true;
    if (def.foundationPrereq?.length && def.foundationPath && hasFoundationPath(def.foundationPath)) {
      return def.foundationPrereq.every((p) => invested.includes(p));
    }
    return false;
  }

  function isInvested(id) {
    load();
    return data.investedIds.includes(id);
  }

  function refreshUnlocks(legacySnap = null) {
    load();
    const leg = legacySnap || getLegacySnapshot();
    const newly = [];
    for (const def of Object.values(TREE_NODES)) {
      if (!isUnlockEligible(def.id, leg)) continue;
      if (!data.seenUnlockIds.includes(def.id) && !isInvested(def.id)) {
        newly.push(def.id);
      }
    }
    save();
    return { newly, invested: [...data.investedIds], shards: getAvailableShards(leg) };
  }

  function canInvest(id, leg = null) {
    load();
    const def = TREE_NODES[id];
    if (!def || isInvested(id)) return { ok: false, reason: 'invested' };
    if (!isUnlockEligible(id, leg)) return { ok: false, reason: 'locked' };
    if (!prereqsMet(id)) return { ok: false, reason: 'prereq' };
    if (getAvailableShards(leg) < (def.cost || 0)) return { ok: false, reason: 'shards' };
    return { ok: true };
  }

  function investNode(id, leg = null) {
    const check = canInvest(id, leg);
    if (!check.ok) return check;
    load();
    data.investedIds.push(id);
    save();
    return { ok: true, invested: true, id };
  }

  function getWaveAscendMult(wave = 0) {
    if (wave >= 400) return 1.12;
    if (wave >= 200) return 1.08;
    if (wave >= 100) return 1.04;
    return 1;
  }

  function getCombinedEffects(legacySnap = null, wave = 0) {
    load();
    const leg = legacySnap || getLegacySnapshot();
    const waveMult = getWaveAscendMult(wave);
    const out = {
      startTp: 0,
      startMorale: 0,
      playerDmgMult: 1,
      wallProtectionBonus: 0,
      damageTakenMult: 1,
      buildingHpMult: 1,
      scienceCapMult: 1,
      researchSpeedMult: 1,
      scienceGainMult: 1,
      crossoverMorale: 0,
      crossoverStatMult: 1,
      honorHpMult: 1,
      honorDmgMult: 1,
      favoriteDmgMult: 1,
      favoriteType: null,
      martialAscendMult: 1,
      heroAscendMult: 1,
      ascendDmgByType: {},
      ascendHpByType: {},
      ascendHealByType: {},
      investedCount: data.investedIds.length,
    };

    for (const id of data.investedIds) {
      const def = TREE_NODES[id];
      if (!def?.effects) continue;
      const e = def.effects;
      const branchMult =
        typeof StoryLore !== 'undefined' &&
        StoryLore.getDominantBranch?.() === def.branch
          ? 1.1
          : 1;

      if (e.startTp) out.startTp += e.startTp;
      if (e.startMorale) out.startMorale += e.startMorale;
      if (e.playerDmgMult) out.playerDmgMult *= e.playerDmgMult;
      if (e.wallProtectionBonus) out.wallProtectionBonus += e.wallProtectionBonus;
      if (e.damageTakenMult) out.damageTakenMult *= e.damageTakenMult;
      if (e.buildingHpMult) out.buildingHpMult *= e.buildingHpMult;
      if (e.scienceCapMult) out.scienceCapMult *= e.scienceCapMult;
      if (e.researchSpeedMult) out.researchSpeedMult *= e.researchSpeedMult;
      if (e.scienceGainMult) out.scienceGainMult *= e.scienceGainMult;
      if (e.crossoverMorale) out.crossoverMorale += e.crossoverMorale;
      if (e.crossoverStatMult) out.crossoverStatMult *= e.crossoverStatMult;
      if (e.honorHpMult) out.honorHpMult *= e.honorHpMult;
      if (e.honorDmgMult) out.honorDmgMult *= e.honorDmgMult;
      if (e.favoriteDmgMult) out.favoriteDmgMult *= e.favoriteDmgMult;
      if (e.martialAscendMult) out.martialAscendMult *= e.martialAscendMult;
      if (e.heroAscendMult) out.heroAscendMult *= e.heroAscendMult;
      if (e.useFavoriteType) out.favoriteType = leg.favoriteUnitType || null;

      if (def.ascends?.length) {
        const dmg = (e.ascendDmgMult || 1) * branchMult;
        const hp = (e.ascendHpMult || 1) * branchMult;
        const heal = (e.ascendHealMult || 1) * branchMult;
        for (const t of def.ascends) {
          if (dmg > 1) out.ascendDmgByType[t] = (out.ascendDmgByType[t] || 1) * dmg;
          if (hp > 1) out.ascendHpByType[t] = (out.ascendHpByType[t] || 1) * hp;
          if (heal > 1) out.ascendHealByType[t] = (out.ascendHealByType[t] || 1) * heal;
        }
      }
    }

    if (waveMult > 1) {
      for (const k of Object.keys(out.ascendDmgByType)) {
        out.ascendDmgByType[k] *= waveMult;
      }
      for (const k of Object.keys(out.ascendHpByType)) {
        out.ascendHpByType[k] *= waveMult;
      }
    }

    return out;
  }

  function isCrossoverUnit(unit) {
    if (!unit?.type) return false;
    if (unit.isCrossover || unit.isWwe) return true;
    if (unit.crossoverFaction || unit.factionId) return true;
    // Global helpers take a type string (crossover.js / wwe.js).
    if (typeof globalThis.isCrossoverUnit === 'function' && globalThis.isCrossoverUnit !== isCrossoverUnit) {
      try {
        if (globalThis.isCrossoverUnit(unit.type)) return true;
      } catch (_) {
        /* ignore */
      }
    }
    if (typeof isWweUnit === 'function' && isWweUnit(unit.type)) return true;
    if (typeof MetaProgress !== 'undefined' && MetaProgress.isCrossoverType?.(unit.type)) return true;
    return unit.type.startsWith('xf_') || unit.type.includes('crossover');
  }

  function applyUnitBonuses(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || unit.eternalLegacyApplied) return unit;
    const fx = getCombinedEffects(null, wave);
    const type = unit.type;

    const dmgMult = fx.ascendDmgByType[type] || 1;
    const hpMult = fx.ascendHpByType[type] || 1;

    let totalDmg = dmgMult;
    let totalHp = hpMult;

    if (CORE_TYPES.has(type) && fx.martialAscendMult > 1) {
      totalDmg *= fx.martialAscendMult;
      totalHp *= fx.martialAscendMult;
    }
    if (MELEE_HERO_TYPES.has(type) && fx.heroAscendMult > 1) {
      totalDmg *= fx.heroAscendMult;
      totalHp *= fx.heroAscendMult;
    }
    if (isCrossoverUnit(unit) && fx.crossoverStatMult > 1) {
      totalDmg *= fx.crossoverStatMult;
      totalHp *= fx.crossoverStatMult;
    }
    if (unit.honorName) {
      totalHp *= fx.honorHpMult;
      totalDmg *= fx.honorDmgMult;
    }
    if (fx.favoriteType && type === fx.favoriteType) {
      totalDmg *= fx.favoriteDmgMult;
    }

    if (totalHp > 1) {
      unit.maxHp = Math.floor(unit.maxHp * totalHp);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    if (totalDmg > 1 && unit.damage) {
      unit.damage = Math.floor(unit.damage * totalDmg);
    }
    if (fx.crossoverMorale > 0 && isCrossoverUnit(unit)) {
      unit.morale = Math.min(unit.maxMorale, unit.morale + fx.crossoverMorale);
    }

    unit.eternalLegacyApplied = true;
    unit.eternalEchoTier = getAscensionTier(unit, wave);
    return unit;
  }

  function getAscensionTier(unit, wave = 0) {
    if (!unit?.type) return 0;
    load();
    let tier = 0;
    for (const id of data.investedIds) {
      const def = TREE_NODES[id];
      if (!def?.ascends?.includes(unit.type)) continue;
      tier = Math.max(tier, def.tier || 1);
    }
    if (wave >= 400) tier = Math.max(tier, 4);
    else if (wave >= 200) tier = Math.max(tier, 3);
    else if (wave >= 100) tier = Math.max(tier, 2);
    return tier;
  }

  function applyRunStartBonuses(ctx = {}) {
    if (ctx.creative) return { startTp: 0, invested: 0 };
    const fx = getCombinedEffects();
    if (fx.startTp > 0) ctx.grantTp?.(fx.startTp);
    if (fx.startMorale > 0) {
      for (const u of ctx.units || []) {
        if (u.team !== 'player' || u.hp <= 0 || u._eternalStartMorale) continue;
        u.morale = Math.min(u.maxMorale, u.morale + fx.startMorale);
        u._eternalStartMorale = true;
      }
    }
    return { startTp: fx.startTp, invested: data.investedIds.length };
  }

  function getBranchNodes(branchId) {
    return Object.values(TREE_NODES)
      .filter((n) => n.branch === branchId)
      .sort((a, b) => (a.tier || 0) - (b.tier || 0) || a.name.localeCompare(b.name));
  }

  function getMenuSnapshot() {
    load();
    refreshUnlocks();
    const leg = getLegacySnapshot();
    const shards = computeEchoShards(leg);
    const spent = getSpentShards();
    const available = Math.max(0, shards - spent);

    const foundationPaths =
      typeof FoundationalMedievalLayer !== 'undefined'
        ? FoundationalMedievalLayer.getCrystallizedPaths()
        : [];

    const nodes = Object.values(TREE_NODES).map((def) => {
      const unlocked = isUnlockEligible(def.id, leg);
      const invested = isInvested(def.id);
      const prereqOk = prereqsMet(def.id);
      const canBuy = canInvest(def.id, leg).ok;
      const branch = BRANCHES[def.branch] || BRANCHES.crown_trunk;
      const foundationLabel =
        def.foundationPath &&
        typeof FoundationalMedievalLayer !== 'undefined' &&
        FoundationalMedievalLayer.PATHS?.[def.foundationPath]?.label;
      return {
        id: def.id,
        name: def.name,
        desc: def.desc,
        hint: def.hint,
        foundationPath: def.foundationPath || null,
        foundationLabel: foundationLabel || null,
        branch: def.branch,
        branchLabel: branch.label,
        branchColor: branch.color,
        tier: def.tier || 1,
        tierLabel: TIER_LABELS[def.tier] || 'Echo',
        cost: def.cost || 0,
        prereq: def.prereq || [],
        ascends: def.ascends || [],
        unlocked,
        invested,
        prereqOk,
        canInvest: canBuy,
        isNewUnlock: unlocked && !invested && !data.seenUnlockIds.includes(def.id),
        isNewInvest: invested && !data.seenInvestIds.includes(def.id),
        gate: !!def.gate,
      };
    });

    const branches = Object.values(BRANCHES).map((b) => {
      const branchNodes = nodes.filter((n) => n.branch === b.id);
      const invested = branchNodes.filter((n) => n.invested).length;
      return {
        ...b,
        nodeCount: branchNodes.length,
        investedCount: invested,
      };
    });

    return {
      title: 'Crown of Ages',
      subtitle: 'Echoes of the Past',
      shards,
      spent,
      available,
      investedCount: data.investedIds.length,
      totalCount: Object.keys(TREE_NODES).length,
      nodes,
      branches,
      foundationPaths,
      summary: data.investedIds.length
        ? `${data.investedIds.length} echoes invested · ${available} shards free`
        : foundationPaths.length
          ? `${foundationPaths.length} path(s) crystallized — invest seeds on the tree`
          : 'Invest Echo Shards to ascend medieval paths through galactic eras',
    };
  }

  function markUnlocksSeen() {
    load();
    const leg = getLegacySnapshot();
    for (const def of Object.values(TREE_NODES)) {
      if (isUnlockEligible(def.id, leg) && !data.seenUnlockIds.includes(def.id)) {
        data.seenUnlockIds.push(def.id);
      }
      if (isInvested(def.id) && !data.seenInvestIds.includes(def.id)) {
        data.seenInvestIds.push(def.id);
      }
    }
    save();
  }

  function getLegacyEntries() {
    const snap = getMenuSnapshot();
    const invested =
      snap.nodes
        .filter((n) => n.invested)
        .map((n) => `${n.name} (${n.branchLabel})`)
        .join(' · ') || 'None invested — earn Echo Shards from lifetime milestones.';
    return [
      {
        cat: 'legacy',
        name: 'Crown of Ages — Echoes of the Past',
        body: `A branching eternal tech tree. Medieval archers, evolved heroes, and early tactics ascend through empire and galactic eras — nothing becomes obsolete. Invested: ${snap.investedCount}/${snap.totalCount}. Echo Shards: ${snap.available} free of ${snap.shards}. Active echoes: ${invested}`,
      },
    ];
  }

  function getStateSnapshot(ctx = {}) {
    const snap = getMenuSnapshot();
    return {
      ...snap,
      combined: getCombinedEffects(null, ctx.wave || 0),
      hudLine: formatHudLine(ctx),
    };
  }

  function formatHudLine(ctx = {}) {
    load();
    if (!data.investedIds.length) return '';
    const wave = ctx.wave || 0;
    const top = data.investedIds.length;
    const ascendNote = wave >= 100 ? ' · echoes ascend' : '';
    return `Crown ${top}${ascendNote}`;
  }

  function formatIntelNote(ctx = {}) {
    load();
    if (!data.investedIds.length) return '';
    const wave = ctx.wave || 0;
    const leg = getLegacySnapshot();
    const avail = getAvailableShards(leg);
    if (avail >= 3 && wave >= 50 && wave % 50 === 0) {
      return `${avail} Echo Shards — invest Crown of Ages on main menu`;
    }
    if (wave >= 100 && data.investedIds.some((id) => TREE_NODES[id]?.ascends?.length)) {
      return 'Echoes of the Past — early units ascend at empire scale';
    }
    return '';
  }

  load();

  return {
    BRANCHES,
    TIER_LABELS,
    TREE_NODES,
    computeEchoShards,
    getSpentShards,
    getAvailableShards,
    refreshUnlocks,
    prereqsMet,
    canInvest,
    investNode,
    isInvested,
    getCombinedEffects,
    applyUnitBonuses,
    applyRunStartBonuses,
    getAscensionTier,
    getBranchNodes,
    getMenuSnapshot,
    getStateSnapshot,
    getLegacyEntries,
    formatHudLine,
    formatIntelNote,
    markUnlocksSeen,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.EternalLegacyTree = EternalLegacyTree;
