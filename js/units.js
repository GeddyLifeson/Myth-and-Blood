/**
 * Unit, building, wave, and specialist definitions.
 */
const BASE_FIELD_W = 400;
const BASE_FIELD_H = 600;
const FIELD_W = BASE_FIELD_W;
const FIELD_H = BASE_FIELD_H;
const MAP_EXPAND_EVERY = 10;
const ACADEMY_MAP_TIERS = 10;
const MAP_EXPAND_W = 90;
const MAP_EXPAND_H = 110;
const ACADEMY_ERA_WAVE = 100;
const RTS_ERA_WAVE = 200;
const NIGHT_TICKS_PER_SECOND = 60;
const NIGHT_PREP_SECONDS = 60;
const NIGHT_PREP_TICKS = NIGHT_TICKS_PER_SECOND * NIGHT_PREP_SECONDS;
const NIGHT_BUILD_MULT = 1.35;
const ACADEMY_HYBRID_WAVES = 5;
const SETTLEMENT_TP_SOFT_CAP = 18;
const SETTLEMENT_WARN_WAVE = 0;
const HAMLET_BUILDERS_REQUIRED = 5;
const HAMLET_WAVE_BUILD_TIME = 5;
const HAMLET_AURA_RADIUS = 130;
const HAMLET_TP_PER_ROUND = 5;
const VILLAGE_BUILDERS_REQUIRED = 6;
const VILLAGE_WAVE_BUILD_TIME = 6;
const VILLAGE_AURA_RADIUS = 145;
const VILLAGE_TP_PER_ROUND = 8;
const TOWN_BUILDERS_REQUIRED = 7;
const TOWN_WAVE_BUILD_TIME = 7;
const TOWN_AURA_RADIUS = 160;
const TOWN_TP_PER_ROUND = 10;
const CITY_BUILDERS_REQUIRED = 8;
const CITY_WAVE_BUILD_TIME = 8;
const CITY_AURA_RADIUS = 175;
const CITY_TP_PER_ROUND = 12;
const METROPOLIS_BUILDERS_REQUIRED = 10;
const METROPOLIS_WAVE_BUILD_TIME = 10;
const METROPOLIS_AURA_RADIUS = 195;
const METROPOLIS_TP_PER_ROUND = 15;
const RTS_MAP_EXPAND_W = 180;
const RTS_MAP_EXPAND_H = 220;
const ATTACK_SIDE_INTERVAL = 25;
const ATTACK_SIDES = ['north', 'east', 'west', 'south'];
const HEALER_ACADEMY_WAVE_INTERVAL = 5;
const GENERAL_ACADEMY_WAVE_INTERVAL = 10;
const GENERAL_PROMOTE_GOLD_STARS = 3;
/** Highest veteran rank index (Immortal / Saint of the Realm). */
const MAX_VETERAN_TIER = 6;
/** Extra specialist abilities unlock after this many lifetime gold stars. */
const SPECIALIST_LATE_ABILITY_GOLD_STARS = 3;
/**
 * Global “make abilities cooler” mult — strikes, character procs, and specialist passives.
 * 1.2 = 20% stronger effects (damage, heal, radius, duration, etc.).
 */
const ABILITY_COOL_MULT = 1.2;

function coolAbilityNum(n) {
  if (n == null || !Number.isFinite(n)) return n;
  return n * ABILITY_COOL_MULT;
}

function coolAbilityInt(n, min = 1) {
  if (n == null || !Number.isFinite(n)) return n;
  return Math.max(min, Math.round(coolAbilityNum(n)));
}

/** Scale a strike / special ability definition for combat resolution (tooltips use same values). */
function scaleAbilityDef(ab) {
  if (!ab) return ab;
  const out = { ...ab };
  if (out.damage != null) out.damage = coolAbilityInt(out.damage);
  if (out.healAmount != null) out.healAmount = coolAbilityInt(out.healAmount);
  if (out.radius != null) out.radius = coolAbilityInt(out.radius);
  if (out.moraleBoost != null) out.moraleBoost = coolAbilityInt(out.moraleBoost, 0);
  if (out.duration != null) out.duration = coolAbilityInt(out.duration);
  if (out.slowDuration != null) out.slowDuration = coolAbilityInt(out.slowDuration);
  if (out.revealDuration != null) out.revealDuration = coolAbilityInt(out.revealDuration);
  if (out.mitigation != null) out.mitigation = Math.min(0.9, coolAbilityNum(out.mitigation));
  return out;
}

const SPECIALIST_RANKS = {
  healer: ['', 'Acolyte', 'Physicker', 'High Healer', 'Saint', 'Archbishop', 'Saint of the Realm'],
  builder: [
    '',
    'Apprentice',
    'Mason',
    'Architect',
    'Master Builder',
    'Grand Architect',
    'Imperial Engineer',
  ],
  courier: [
    '',
    'Runner',
    'Dispatch Rider',
    'Royal Courier',
    "King's Sworn",
    'Wind Rider',
    'Crown Envoy',
  ],
};

const SPECIALIST_LATE_ABILITIES = {
  mass_mend: {
    name: 'Mass Mend',
    desc: 'Pulse-heals all wounded allies in range (~every 3s) for 72% heal strength.',
    // Base 0.6 × ABILITY_COOL_MULT (1.2)
    healMult: 0.6 * ABILITY_COOL_MULT,
    unlockGoldStars: SPECIALIST_LATE_ABILITY_GOLD_STARS,
    specialistTypes: ['healer'],
  },
  rapid_repair: {
    name: 'Rapid Repair',
    desc: 'While repairing, ~2.4% chance per tick to restore +9.6% of structure max HP.',
    procChance: 0.02 * ABILITY_COOL_MULT,
    patchHpFrac: 0.08 * ABILITY_COOL_MULT,
    unlockGoldStars: SPECIALIST_LATE_ABILITY_GOLD_STARS,
    specialistTypes: ['builder'],
  },
  twin_dispatch: {
    name: 'Twin Dispatch',
    desc: 'Send two messages per wave (20% faster ride cooldown between dispatches).',
    cooldownMult: 1 / ABILITY_COOL_MULT,
    unlockGoldStars: SPECIALIST_LATE_ABILITY_GOLD_STARS,
    specialistTypes: ['courier'],
  },
};

function recordGoldStarEarned(unit) {
  if (!unit || unit.team !== 'player') return;
  unit.goldStarsEarned = (unit.goldStarsEarned || 0) + 1;
  if (
    isSpecialistUnit(unit) &&
    unit.goldStarsEarned >= SPECIALIST_LATE_ABILITY_GOLD_STARS
  ) {
    unit.lateAbilityUnlocked = true;
  }
}

function isSpecialistLateAbilityUnlocked(unit) {
  if (!isSpecialistUnit(unit)) return false;
  if (unit.lateAbilityUnlocked) return true;
  if ((unit.goldStarsEarned || 0) >= SPECIALIST_LATE_ABILITY_GOLD_STARS) return true;
  // Holding 3 gold stars this cycle (before honor conversion resets the counter).
  if ((unit.vetGold || 0) >= SPECIALIST_LATE_ABILITY_GOLD_STARS) return true;
  return false;
}

function getSpecialistLateAbilityInfo(unit) {
  if (!isSpecialistUnit(unit)) return null;
  const id =
    unit.type === 'healer'
      ? 'mass_mend'
      : unit.type === 'builder'
        ? 'rapid_repair'
        : 'twin_dispatch';
  const def = SPECIALIST_LATE_ABILITIES[id];
  if (!def) return null;
  const need = def.unlockGoldStars || SPECIALIST_LATE_ABILITY_GOLD_STARS;
  const gold = Math.max(unit.goldStarsEarned || 0, unit.vetGold || 0);
  const unlocked = isSpecialistLateAbilityUnlocked(unit);
  return {
    id,
    name: def.name,
    desc: def.desc,
    unlockTier: need,
    unlockGoldStars: need,
    unlockRank: `${need} gold stars`,
    unlocked,
    rankNeeded: Math.max(0, need - gold),
    goldStarsEarned: gold,
  };
}

const ACADEMY_BUILD_TYPES = [
  'academy_footman',
  'academy_archer',
  'academy_mage',
  'academy_cavalry',
  'academy_knight',
  'academy_sapper',
  'academy_healer',
  'academy_builder',
  'academy_courier',
  'academy_general',
  'academy_scout',
  'academy_bard',
  'academy_ballista',
  'academy_pikeman',
];
const DEPLOY_Y = BASE_FIELD_H - 20;
const DEFAULT_RALLY_Y = BASE_FIELD_H - 100;

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** 0→1 progress toward Academy Era (wave 100). */
function academyProgress(waveNum) {
  return Math.min(1, Math.max(0, waveNum / ACADEMY_ERA_WAVE));
}

/** 0→1 progress from Academy Era to RTS Era (waves 100–200). */
function postAcademyProgress(waveNum) {
  if (waveNum <= ACADEMY_ERA_WAVE) return 0;
  return Math.min(1, (waveNum - ACADEMY_ERA_WAVE) / (RTS_ERA_WAVE - ACADEMY_ERA_WAVE));
}

function academyEase(waveNum) {
  return smoothstep(academyProgress(waveNum));
}

/** Smoothed 0→1 across the academy band (waves 100–200). */
function postAcademyEase(waveNum) {
  return smoothstep(postAcademyProgress(waveNum));
}

/** 0→1 soft ramp into academy-era scaling (waves 85–115). */
function academyThresholdBlend(waveNum) {
  if (waveNum <= 85) return 0;
  if (waveNum >= 115) return 1;
  return smoothstep((waveNum - 85) / 30);
}

/** 0→1 soft ramp into RTS / planetary scaling (waves 175–205). */
function rtsMapBlend(waveNum) {
  if (waveNum < 175) return 0;
  if (waveNum >= 205) return 1;
  return smoothstep((waveNum - 175) / 30);
}

/** Kingdom Evolution — Evolve-style player force growth across four campaign stages. */
const KINGDOM_STAGE_WAVES = { RISING: 31, EMPIRE: 100, DOMINION: 200 };

/** Chronicle + HUD milestones between major era gates. */
const PROGRESSION_MILESTONES = [
  {
    wave: 10,
    id: 'warlords',
    name: 'Named Warlords',
    shortName: 'Warlords',
    tagline: 'Every tenth dawn fields a legend — break them or the north never quiets.',
    color: '#c0a060',
    kingdomStage: 1,
  },
  {
    wave: 31,
    id: 'rising',
    name: 'Kingdom Rising',
    shortName: 'Rising',
    tagline: 'Academies stir, settlements charter, and evolved dossiers unlock.',
    color: '#b8c848',
    kingdomStage: 2,
  },
  {
    wave: 50,
    id: 'mid_realm',
    name: 'Mid Realm',
    shortName: 'Mid Realm',
    tagline: 'Four winds blow — veterans, crossovers, and charters define the mid campaign.',
    color: '#a8c878',
    kingdomStage: 2,
  },
  {
    wave: 65,
    id: 'veteran_legion',
    name: 'Veteran Legion',
    shortName: 'Veterans',
    tagline: 'Tenure-hardened troops and evolved operatives anchor your battle line.',
    color: '#98b868',
    kingdomStage: 2,
  },
  {
    wave: 75,
    id: 'tombstone_rite',
    name: 'Tombstone Rite',
    shortName: 'Tombstone',
    tagline: 'Fallen names stir — honored dead may rise when a General bears Tombstone.',
    color: '#88a858',
    kingdomStage: 2,
  },
  {
    wave: 85,
    id: 'academy_threshold',
    name: 'Academy Threshold',
    shortName: 'Threshold',
    tagline: 'Pressure builds before the proclamation — economy and training decide survival.',
    color: '#d8b050',
    kingdomStage: 2,
  },
  {
    wave: 100,
    id: 'empire',
    name: 'Empire Ascendant',
    shortName: 'Empire',
    tagline: 'Full academy training, hamlets, guilds, and loadouts shape every dawn.',
    color: '#e8a040',
    kingdomStage: 3,
  },
  {
    wave: 115,
    id: 'empire_consolidation',
    name: 'Empire Consolidation',
    shortName: 'Consolidation',
    tagline: 'Colony value steers assault composition — tailor your realm or suffer the host.',
    color: '#e09038',
    kingdomStage: 3,
  },
  {
    wave: 150,
    id: 'raid_authority',
    name: 'Raid Authority',
    shortName: 'Raids',
    tagline: 'Northern strike missions authorized — hunt enemy holds before their economy compounds.',
    color: '#f08040',
    kingdomStage: 3,
  },
  {
    wave: 175,
    id: 'mirror_pressure',
    name: 'Mirror Pressure',
    shortName: 'Mirror',
    tagline: 'Hostile settlements multiply and the frontier widens before full planetary war.',
    color: '#f06848',
    kingdomStage: 3,
  },
  {
    wave: 200,
    id: 'dominion',
    name: 'Planetary Dominion',
    shortName: 'Dominion',
    tagline: 'Mirror war at scale — raze foe holds or raise counter-settlements in the north.',
    color: '#ff6060',
    kingdomStage: 4,
  },
  {
    wave: 500,
    id: 'planet_conquest',
    name: 'Planet Conquest',
    shortName: 'Conquest',
    tagline:
      'True victory unlocks — conquer sectors, eliminate realms, and shatter the Worldheart Tyrant.',
    color: '#c060ff',
    kingdomStage: 4,
  },
];

function getProgressionMilestone(waveNum) {
  return PROGRESSION_MILESTONES.find((m) => m.wave === (waveNum | 0)) || null;
}

function isProgressionMilestone(waveNum) {
  return PROGRESSION_MILESTONES.some((m) => m.wave === (waveNum | 0));
}

const KINGDOM_EVOLUTION_STAGES = {
  1: {
    stage: 1,
    id: 'outpost',
    name: 'Outpost Realm',
    shortName: 'Outpost',
    tagline: 'Small defensive line — survive and forge first veterans.',
    color: '#88cc88',
    waveMin: 1,
    waveMax: 30,
  },
  2: {
    stage: 2,
    id: 'rising',
    name: 'Kingdom Rising',
    shortName: 'Rising',
    tagline: 'Academies stir, settlements rise, crossovers answer the Crown.',
    color: '#b8c848',
    waveMin: 31,
    waveMax: 99,
  },
  3: {
    stage: 3,
    id: 'empire',
    name: 'Empire Ascendant',
    shortName: 'Empire',
    tagline:
      'Full training, loadouts, fortress rings — from wave 150, raid enemy northern holds for big TP loot.',
    color: '#e8a040',
    waveMin: 100,
    waveMax: 199,
  },
  4: {
    stage: 4,
    id: 'dominion',
    name: 'Planetary Dominion',
    shortName: 'Dominion',
    tagline: 'Mirror war at scale — raid foe holds or raise counter-settlements in the north.',
    color: '#ff6060',
    waveMin: 200,
    waveMax: null,
  },
};

function getKingdomEvolutionStage(waveNum) {
  const w = Math.max(0, waveNum | 0);
  let stage = 1;
  if (w >= KINGDOM_STAGE_WAVES.DOMINION) stage = 4;
  else if (w >= KINGDOM_STAGE_WAVES.EMPIRE) stage = 3;
  else if (w >= KINGDOM_STAGE_WAVES.RISING) stage = 2;
  const def = KINGDOM_EVOLUTION_STAGES[stage];
  let progress = 0;
  if (stage === 1) progress = Math.min(1, w / KINGDOM_STAGE_WAVES.RISING);
  else if (stage === 2)
    progress = Math.min(
      1,
      (w - KINGDOM_STAGE_WAVES.RISING) / (KINGDOM_STAGE_WAVES.EMPIRE - KINGDOM_STAGE_WAVES.RISING)
    );
  else if (stage === 3)
    progress = typeof postAcademyEase === 'function' ? postAcademyEase(w) : 0;
  else progress = Math.min(1, typeof rtsMapBlend === 'function' ? rtsMapBlend(w) : 0);
  return { ...def, progress };
}

/** Mechanical hooks per evolution stage (player-side growth curve). */
function getKingdomStageBuffs(waveNum) {
  const evo = getKingdomEvolutionStage(waveNum);
  const s = evo.stage;
  return {
    stage: s,
    evolution: evo,
    defenseHpMult: s === 1 ? 1.05 : 1,
    armyDmgMult: s >= 4 ? 1.05 : s >= 2 ? 1.03 : 1,
    colonyPressureCurve: s === 3 ? 1.14 : s >= 4 ? 1.1 : s === 2 ? 1.05 : 1,
    siegeMult: s >= 4 ? 1.1 : 1,
    loadoutsUnlocked: s >= 3,
    raidsUnlocked: waveNum >= 150,
    veteranMoraleCap: s >= 2 ? 1 : 0,
  };
}

function isKingdomLoadoutsUnlocked(waveNum) {
  return getKingdomStageBuffs(waveNum).loadoutsUnlocked;
}

function isKingdomRaidsUnlocked(waveNum) {
  return getKingdomStageBuffs(waveNum).raidsUnlocked;
}

/** Army doctrines unlocked at each kingdom evolution stage (one activation per wave). */
const KINGDOM_DOCTRINES = {
  outpost_stand: {
    id: 'outpost_stand',
    name: 'Outpost Stand',
    cost: 4,
    kingdomStage: 1,
    desc: 'The line holds — all allies take 15% less damage for 6 minutes.',
    duration: 360,
    mitigation: 0.15,
  },
  royal_muster: {
    id: 'royal_muster',
    name: 'Royal Muster',
    cost: 5,
    kingdomStage: 2,
    desc: 'Crown levy — +5 TP now and +4 morale to every ally on the field.',
    tpGrant: 5,
    moraleBoost: 4,
  },
  imperial_march: {
    id: 'imperial_march',
    name: 'Imperial March',
    cost: 8,
    kingdomStage: 3,
    desc: 'Map-wide rally — +12 morale, clears routing, +15% damage for 7 minutes.',
    global: true,
    duration: 420,
    moraleBoost: 12,
    damageMult: 1.15,
  },
  hellforge_decree: {
    id: 'hellforge_decree',
    name: 'Hellforge Decree',
    cost: 10,
    kingdomStage: 4,
    desc: 'Hell-forged wrath — map-wide +10 morale, +20% damage, +12% speed for 6 minutes.',
    global: true,
    duration: 360,
    moraleBoost: 10,
    damageMult: 1.2,
    speedMult: 1.12,
  },
};

function getUnlockedKingdomDoctrines(waveNum) {
  const stage = getKingdomStageBuffs(waveNum).stage;
  return Object.values(KINGDOM_DOCTRINES).filter((d) => stage >= d.kingdomStage);
}

/**
 * Content tier — hazards / biomes / wildlife unlock cadence (independent of map size).
 */
function getTerritoryTier(waveNum) {
  const w = waveNum || 0;
  if (w < 12) return 0;
  if (w < 22) return 1;
  if (w < 32) return 2; // hazards + forest content
  if (w < 45) return 3;
  if (w < 60) return 4;
  if (w < 80) return 5; // mountains content
  if (w < 100) return 6;
  if (w < 140) return 7;
  if (w < 180) return 8;
  return Math.min(12, 8 + Math.floor((w - 180) / 40));
}

/**
 * Map growth steps — every MAP_EXPAND_EVERY waves the realm gains land on all sides.
 * Caps soft-limit runaway size pre-RTS; RTS era adds a larger bump.
 */
function getMapExpandTier(waveNum) {
  const w = Math.max(0, waveNum | 0);
  let t = Math.floor(w / MAP_EXPAND_EVERY);
  if (w < RTS_ERA_WAVE) t = Math.min(ACADEMY_MAP_TIERS, t);
  else t = Math.min(16, t);
  return Math.max(0, t);
}

/**
 * Playfield size for the wave. Grows in width and height; callers shift existing
 * content so new strips appear on north, south, east, and west (not only south).
 */
function getWorldSize(waveNum) {
  const expandTier = getMapExpandTier(waveNum);
  let w = BASE_FIELD_W + expandTier * MAP_EXPAND_W;
  let h = BASE_FIELD_H + expandTier * MAP_EXPAND_H;
  if (waveNum >= RTS_ERA_WAVE) {
    w += RTS_MAP_EXPAND_W;
    h += RTS_MAP_EXPAND_H;
  }
  return {
    w,
    h,
    tier: getTerritoryTier(waveNum),
    expandTier,
    baseW: BASE_FIELD_W,
    baseH: BASE_FIELD_H,
    rtsEra: waveNum >= ACADEMY_ERA_WAVE,
    enemyRtsEra: false,
    fixedBattlefield: false,
  };
}

function countLiveBuilders(units) {
  return units.filter((u) => u.team === 'player' && u.type === 'builder' && u.hp > 0).length;
}

function isRtsEra(waveNum) {
  return waveNum >= ACADEMY_ERA_WAVE;
}

/** Enemy RTS / mirror settlements disabled — pure wave pressure instead. */
function isEnemyRtsEra(_waveNum) {
  return false;
}

function isSettlementBuild(type) {
  const def = BuildDefs[type];
  return !!(def?.isSettlement || def?.isHamlet || def?.isMerchantGuild);
}

function getBuildingProgressRatio(b) {
  if (b.complete) return 1;
  if (b.waveBuildRequired) return (b.waveBuildProgress || 0) / b.waveBuildRequired;
  return b.buildProgress / Math.max(1, b.buildTime || 1);
}

function buildingBlocksTerrain(b) {
  if (b.complete) return true;
  return getBuildingProgressRatio(b) > 0.5;
}

/** Movement / pathfinding collision radius (scales with construction progress). */
function terrainBlockRadius(obs) {
  if (!obs) return 0;
  if (obs.hp !== undefined && obs.hp <= 0) return 0;
  if (obs.blocksMove === false) return 0;
  if (obs.buildProgress !== undefined && obs.complete !== undefined) {
    if (!buildingBlocksTerrain(obs)) return 0;
    const prog = getBuildingProgressRatio(obs);
    const r = obs.radius || 14;
    return r * (obs.complete ? 1 : 0.5 + prog * 0.25);
  }
  return obs.radius || obs.size || 14;
}

/** Line-of-sight obstruction radius (independent of blocksMove). */
function terrainLosRadius(obs) {
  if (!obs) return 0;
  if (obs.hp !== undefined && obs.hp <= 0) return 0;
  if (obs.blocksLOS === false) return 0;
  if (obs.buildProgress !== undefined && obs.complete !== undefined) {
    if (!buildingBlocksTerrain(obs)) return 0;
    const prog = getBuildingProgressRatio(obs);
    const r = obs.radius || 14;
    return r * (obs.complete ? 1 : 0.5 + prog * 0.25);
  }
  return obs.radius || obs.size || 14;
}

/** Siege / strike volume — may exceed visual footprint for blocksMove:false sites. */
function getBuildingHitRadius(b) {
  if (!b) return 28;
  const def = typeof BuildDefs !== 'undefined' ? BuildDefs[b.type] : null;
  let r = b.attackRadius ?? b.radius ?? def?.attackRadius ?? def?.radius ?? 28;
  if (
    b.owner === 'enemy' &&
    (b.isEnemySettlement || b.isHamlet || b.isMerchantGuild || b.isResourceGen)
  ) {
    r = Math.max(r, b.blocksMove === false ? 28 : 20);
  }
  return Math.max(14, r);
}

function getDeployY(worldH) {
  return worldH - 20;
}

function getDefaultRallyY(worldH) {
  return worldH - 100;
}
const MISS_LIMIT = 10;
const TP_PER_ROUND = 7;
const STARTING_TP = 7;

const DIFFICULTIES = {
  baby: {
    id: 'baby',
    label: 'Baby',
    tagline: 'Forgiving — extra TP, weaker foes, slower spawns.',
    enemyHpMult: 0.72,
    enemyDmgMult: 0.75,
    enemyCountMult: 0.78,
    spawnIntervalMult: 1.3,
    waveHpScaleMult: 0.82,
    waveDmgScaleMult: 0.82,
    siegeTowerMult: 0.75,
    startingTp: 10,
    tpPerRoundBonus: 3,
    missLimit: 14,
    playerMoraleBonus: 4,
    eliteChanceMult: 0.6,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    tagline: 'Balanced survival — outlast the hordes.',
    enemyHpMult: 1,
    enemyDmgMult: 1,
    enemyCountMult: 1,
    spawnIntervalMult: 1,
    waveHpScaleMult: 1,
    waveDmgScaleMult: 1,
    siegeTowerMult: 1,
    startingTp: 7,
    tpPerRoundBonus: 0,
    missLimit: 10,
    playerMoraleBonus: 0,
    eliteChanceMult: 1,
  },
  chad: {
    id: 'chad',
    label: 'Chad',
    tagline: 'Harder, faster, hungrier hordes.',
    enemyHpMult: 1.3,
    enemyDmgMult: 1.22,
    enemyCountMult: 1.22,
    spawnIntervalMult: 0.82,
    waveHpScaleMult: 1.14,
    waveDmgScaleMult: 1.1,
    siegeTowerMult: 1.25,
    startingTp: 5,
    tpPerRoundBonus: -1,
    missLimit: 8,
    playerMoraleBonus: 0,
    eliteChanceMult: 1.15,
  },
  doomslayer: {
    id: 'doomslayer',
    label: 'Doomslayer',
    tagline: 'Hell marches. No mercy.',
    enemyHpMult: 1.7,
    enemyDmgMult: 1.48,
    enemyCountMult: 1.5,
    spawnIntervalMult: 0.62,
    waveHpScaleMult: 1.38,
    waveDmgScaleMult: 1.32,
    siegeTowerMult: 1.6,
    startingTp: 4,
    tpPerRoundBonus: -2,
    missLimit: 6,
    playerMoraleBonus: -2,
    eliteChanceMult: 1.35,
  },
};

function getDifficultyDef(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

/** UnitDefs — loaded at init from data/units.json via GameData. */

function getPlayerUnitDef(type) {
  if (UnitDefs[type]) return UnitDefs[type];
  if (typeof WweDefs !== 'undefined' && WweDefs[type]) return WweDefs[type];
  if (typeof CrossoverDefs !== 'undefined' && CrossoverDefs[type]) return CrossoverDefs[type];
  return null;
}

/** BuildDefs — loaded at init from data/buildings.json via GameData. */

/**
 * Progressive flanks: North always → East @25 → West @50 → South @75.
 * Each dawn rolls which unlocked flanks are active for the assault.
 */
function getUnlockedAttackSides(waveNum) {
  const w = Math.max(0, waveNum | 0);
  const unlocked = 1 + Math.floor(w / ATTACK_SIDE_INTERVAL);
  return ATTACK_SIDES.slice(0, Math.min(ATTACK_SIDES.length, unlocked));
}

function isAcademyEra(waveNum) {
  return waveNum >= ACADEMY_ERA_WAVE;
}

function isVanillaAcademyType(type) {
  const def = BuildDefs[type];
  return !!(def?.isAcademy && !def?.isCrossoverBarracks && !def?.isWweAcademy);
}

function isCrossoverBarracksType(type) {
  return !!BuildDefs[type]?.isCrossoverBarracks;
}

function isMaxLevelVeteran(unit) {
  return !!unit && unit.team === 'player' && unit.hp > 0 && (unit.vetTier || 0) >= MAX_VETERAN_TIER;
}

function getAcademyMentorUnitType(academyType) {
  const def = BuildDefs[academyType];
  if (!def?.isAcademy) return null;
  if (def.requiresPromotableFootman || academyType === 'academy_general') return 'footman';
  return def.academyUnit || academyType.replace('academy_', '');
}

function getMaxVeteranRankName(unitType) {
  const specRanks = SPECIALIST_RANKS[unitType];
  const combatRanks = ['', 'Veteran', 'Elite', 'Champion', 'Legend', 'Mythic', 'Immortal'];
  const ranks = specRanks || combatRanks;
  return ranks[Math.min(MAX_VETERAN_TIER, ranks.length - 1)] || `V${MAX_VETERAN_TIER}`;
}

function hasAcademyMentorOnField(academyType, units) {
  const mentorType = getAcademyMentorUnitType(academyType);
  // Missing academy def is NOT "mentor ready" — require a real mentor type.
  if (!mentorType) return false;
  return units.some(
    (u) =>
      u &&
      u.team === 'player' &&
      u.hp > 0 &&
      !u._pooled &&
      u.type === mentorType &&
      isMaxLevelVeteran(u)
  );
}

function getAcademyBuildBlockReason(type, waveNum, units) {
  const def = BuildDefs[type];
  if (!def?.isAcademy) return 'Unknown academy type.';
  if (def.academyWaveInterval && waveNum % def.academyWaveInterval !== 0) {
    return `This academy can only be founded on waves divisible by ${def.academyWaveInterval}.`;
  }
  if (!hasAcademyMentorOnField(type, units)) {
    const mentorType = getAcademyMentorUnitType(type);
    const name = getPlayerUnitDef(mentorType)?.name || formatUnitTypeName(mentorType || 'unit');
    const rank = getMaxVeteranRankName(mentorType);
    const need = MAX_VETERAN_TIER;
    return `Need an on-field ${name} at ${rank} (V${need}). Earn gold-star cycles, research Veteran Doctrine, then Promote (U) until Immortal.`;
  }
  if (def.requiresPromotableFootman) {
    if (units.some((u) => u.team === 'player' && u.isGeneral && u.hp > 0)) {
      return 'Cannot found General Academy while a General is on the field.';
    }
    if (!units.some(footmanEligibleForGeneral)) {
      return 'Need a veteran Footman eligible for promotion (completed a gold-star cycle).';
    }
  }
  return null;
}

function canBuildAcademyType(type, waveNum, units) {
  return !getAcademyBuildBlockReason(type, waveNum, units);
}

/** Academies this unit type unlocks as mentor once Immortal. */
function getAcademiesUnlockedByMentorType(unitType) {
  if (!unitType || typeof ACADEMY_BUILD_TYPES === 'undefined') return [];
  return ACADEMY_BUILD_TYPES.filter((t) => getAcademyMentorUnitType(t) === unitType);
}

/** Footman completed a full gold-star cycle (honor granted); vetGold resets after that. */
function footmanEligibleForGeneral(u) {
  return (
    u?.team === 'player' &&
    u.hp > 0 &&
    u.type === 'footman' &&
    ((u.vetTier || 0) >= 1 || !!u.honorName)
  );
}

function findPromotableFootman(units) {
  let best = null,
    bestScore = -1;
  for (const u of units) {
    if (!footmanEligibleForGeneral(u)) continue;
    const score = (u.vetTier || 0) * 100 + (u.experience || 0) + (u.honorName ? 25 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = u;
    }
  }
  return best;
}

function promoteFootmanToGeneral(footman) {
  if (!footman.honorName && footmanEligibleForGeneral(footman)) grantHonorName(footman);
  else if (footman.honorName) repairHonorName(footman);
  footman.type = 'general';
  footman.spriteType = 'general';
  footman.isGeneral = true;
  footman.combatType = 'general';
  footman.canHunt = false;
  footman.huntMode = false;
  footman.generalAliveTimer = footman.generalAliveTimer || 0;
  footman.generalStars = footman.generalStars || 0;
  resetVetStars(footman);
  return footman;
}

const CASTLE_COMPOUND_OFFSET = 72;
const CASTLE_INNER_OFFSET = 32;
/** Courtyard offset from keep center — clears keep + perimeter wall collision radii. */
const KEEP_GENERAL_SLOT_DX = -38;
const KEEP_GENERAL_SLOT_DY = -38;
const BUILDER_MAX_PROJECTS = 2;
const RETREAT_HP_RATIO = 0.25;

const CourierMessages = {
  reinforce: { name: 'Request Reinforcements', cost: 3, desc: 'King sends 2 footmen next round' },
  decree: { name: 'Royal Decree', cost: 2, desc: '+5 morale to all troops' },
  levy: { name: 'Tax Levy', cost: 0, desc: '+6 TP at start of next round' },
  banner: { name: 'Call the Banner', cost: 5, desc: 'Summon 1 knight immediately' },
  supplies: { name: 'Supply Train', cost: 3, desc: 'Heal all allies 25 HP' },
  truce: { name: 'Offer Truce', cost: 4, desc: 'Delay spawns; +8 morale all troops' },
  hunt_pact: {
    name: 'Hunt Pact',
    cost: 3,
    desc: 'Seal wildlife pact — +rep, allied beasts (wave 8+)',
  },
  evacuate: { name: 'Medical Evac', cost: 4, desc: 'Wounded allies retreat to med tents' },
};

/** Abilities / SpyActions — loaded from data/strikes.json via GameData. */

const ELITE_ENEMIES = [
  'dark_knight',
  'war_chief',
  'troll',
  'siege_tower',
  'necromancer',
  'berserker',
  'assassin',
];

const MONSTER_ENEMIES = [
  'abomination',
  'behemoth',
  'iron_colossus',
  'void_stalker',
  'elder_wyrm',
  'cinderbound_juggernaut',
];

function isEliteEnemy(unit) {
  return (
    !!unit &&
    unit.team === 'enemy' &&
    (ELITE_ENEMIES.includes(unit.type) || isMonsterEnemy(unit) || isNamedBoss(unit))
  );
}

function isEvilOperativeEnemy(unit) {
  return (
    !!unit &&
    unit.team === 'enemy' &&
    (unit.isEvilOperative || isEnemyEvilOperativeType(unit.type) || isNamedBoss(unit))
  );
}

function isMonsterEnemy(unit) {
  return !!unit && unit.team === 'enemy' && MONSTER_ENEMIES.includes(unit.type);
}

function isNamedBoss(unit) {
  return !!(
    unit &&
    unit.team === 'enemy' &&
    (unit.isNamedBoss || EnemyDefs[unit.type]?.isNamedBoss)
  );
}

const VET_STAR_COLORS = { bronze: '#b87333', silver: '#c8c8d8', gold: '#ffd700' };

const HONOR_NAME_POOL = [
  'Gwyn',
  'Aldric',
  'Elara',
  'Brenna',
  'Cador',
  'Rhys',
  'Isolde',
  'Percival',
  'Mira',
  'Owain',
  'Branwen',
  'Tomas',
  'Yseult',
  'Emrys',
  'Catrin',
  'Gareth',
  'Morwen',
  'Llew',
  'Angharad',
  'Drystan',
  'Eira',
  'Huw',
  'Seren',
  'Ivor',
];

const HONOR_PREFIX_BY_TYPE = {
  footman: ['Syr', 'Dame', 'Captain'],
  archer: ['Syr', 'Ranger', 'Dame'],
  mage: ['Magister', 'Syr', 'Dame'],
  cavalry: ['Syr', 'Dame', 'Lord'],
  healer: ['Sister', 'Brother', 'Dame'],
  builder: ['Master', 'Syr', 'Craftlord'],
  courier: ['Dispatch', 'Syr', 'Rider'],
  sapper: ['Syr', 'Sapper-Captain', 'Dame'],
  knight: ['Syr', 'Dame', 'Lord'],
  general: ['Lord Marshal', 'Syr', 'High Commander'],
};

function hashUnitId(id) {
  const sid = String(id || '');
  let h = 0;
  for (let i = 0; i < sid.length; i++) h = (h * 31 + sid.charCodeAt(i)) >>> 0;
  return h;
}

function honorPoolIndex(h, poolLen) {
  return (((h >>> 4) % poolLen) + poolLen) % poolLen;
}

function isValidHonorName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed || /undefined|unidentified|null/i.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/);
  return parts.length >= 2 && parts[parts.length - 1].length > 0;
}

function rollHonorName(unit) {
  const h = hashUnitId(unit.id);
  const prefixes = HONOR_PREFIX_BY_TYPE[unit.type] || HONOR_PREFIX_BY_TYPE.footman;
  const prefix = prefixes[h % prefixes.length];
  const given = HONOR_NAME_POOL[honorPoolIndex(h, HONOR_NAME_POOL.length)];
  return `${prefix} ${given}`;
}

function repairHonorName(unit) {
  if (!unit?.id || (unit.honorName && isValidHonorName(unit.honorName)))
    return unit?.honorName || null;
  unit.honorName = rollHonorName(unit);
  return unit.honorName;
}

function grantHonorName(unit) {
  if (unit.honorName && isValidHonorName(unit.honorName)) return false;
  unit.honorName = rollHonorName(unit);
  unit.honorTitleWave = unit.honorTitleWave ?? null;
  return true;
}

function resetVetStars(unit) {
  unit.vetBronze = 0;
  unit.vetSilver = 0;
  unit.vetGold = 0;
}

/** Role bucket for veteran star bumps and TP rank steps. */
function getUnitVeteranRole(unit) {
  if (!unit) return 'melee';
  const type = unit.type || '';
  const combat = unit.combatType || '';
  if (type === 'healer' || combat === 'healer') return 'healer';
  if (type === 'builder' || combat === 'builder') return 'builder';
  if (type === 'courier' || combat === 'courier') return 'courier';
  if (unit.isGeneral || type === 'general' || combat === 'general') return 'general';
  if (combat === 'cavalry' || type === 'cavalry') return 'cavalry';
  if (type === 'sapper' || type === 'ballista' || (unit.siegeMult || 0) > 1.2) return 'siege';
  if (combat === 'ranged' || unit.projectile) return 'ranged';
  return 'melee';
}

function veteranStarScale(starTier) {
  if (starTier === 'gold') return { hp: 1.045, primary: 1.045, secondary: 1.032 };
  if (starTier === 'silver') return { hp: 1.028, primary: 1.028, secondary: 1.016 };
  return { hp: 1.014, primary: 1.014, secondary: 1.008 };
}

function scaleUnitHp(unit, mult) {
  const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
  const next = Math.max(1, Math.floor(unit.maxHp * mult));
  unit.maxHp = unit.maxHp > 0 ? Math.max(unit.maxHp + 1, next) : next;
  unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
}

function bumpScaledStat(current, mult, minGain = 1) {
  if (!current || current <= 0) return current;
  const next = Math.floor(current * mult);
  return Math.max(current + minGain, next);
}

function bumpUnitRange(unit, mult) {
  if (!unit.baseRange && !unit.range) return;
  if (unit.baseRange) unit.baseRange = Math.floor(unit.baseRange * mult);
  if (!unit.garrisoned) unit.range = Math.floor((unit.baseRange || unit.range) * mult);
}

function bumpUnitMorale(unit, amount) {
  if (amount <= 0) return;
  unit.maxMorale = Math.min(45, unit.maxMorale + amount);
  unit.morale = Math.min(unit.maxMorale, unit.morale + Math.max(1, Math.floor(amount * 0.6)));
}

/** Incremental buff per bronze/silver/gold — all roles, scaled to specialty. */
function applyVeteranStarBump(unit, starTier) {
  if (!unit || unit.team !== 'player' || unit.isDoomslayer) return;
  ensureHealerStats(unit);
  const role = getUnitVeteranRole(unit);
  const s = veteranStarScale(starTier);
  scaleUnitHp(unit, s.hp);

  switch (role) {
    case 'healer':
      unit.healAmount = bumpScaledStat(unit.healAmount || 20, s.primary);
      if (unit.range) unit.range = Math.floor(unit.range * s.secondary);
      bumpUnitMorale(unit, starTier === 'gold' ? 2 : 1);
      break;
    case 'builder':
      unit.buildSpeedMult = (unit.buildSpeedMult || 1) * s.primary;
      if (unit.buildRange) unit.buildRange = Math.floor(unit.buildRange * s.secondary);
      if (unit.damage > 0) unit.damage = bumpScaledStat(unit.damage, s.secondary);
      break;
    case 'courier':
      unit.speed = Math.round(unit.speed * s.primary * 100) / 100;
      unit.courierCooldownMult = Math.max(
        0.42,
        (unit.courierCooldownMult || 1) * (1 - (s.primary - 1) * 0.55)
      );
      bumpUnitMorale(unit, 1);
      break;
    case 'general':
      bumpUnitMorale(unit, starTier === 'gold' ? 4 : starTier === 'silver' ? 2 : 1);
      if (unit.damage > 0) unit.damage = bumpScaledStat(unit.damage, s.secondary);
      unit.accuracy = Math.min(72, unit.accuracy + (starTier === 'gold' ? 2 : starTier === 'silver' ? 1 : 0));
      break;
    case 'cavalry':
      unit.speed = Math.max(unit.speed + 0.02, Math.round(unit.speed * s.primary * 100) / 100);
      if (unit.damage > 0) unit.damage = bumpScaledStat(unit.damage, s.primary);
      unit.accuracy = Math.min(68, unit.accuracy + (starTier === 'gold' ? 2 : starTier === 'silver' ? 1 : 0));
      if (unit.meleeRange) unit.meleeRange = Math.floor(unit.meleeRange * s.secondary);
      break;
    case 'siege':
      unit.siegeMult = (unit.siegeMult || 1) * s.primary;
      if (unit.damage > 0) unit.damage = bumpScaledStat(unit.damage, s.secondary);
      if (unit.meleeRange) unit.meleeRange = Math.max(unit.meleeRange + 1, Math.floor(unit.meleeRange * s.secondary));
      break;
    case 'ranged':
      if (unit.damage > 0) unit.damage = bumpScaledStat(unit.damage, s.primary);
      unit.accuracy = Math.min(68, unit.accuracy + (starTier === 'gold' ? 2 : starTier === 'silver' ? 1 : 0));
      bumpUnitRange(unit, s.secondary);
      break;
    default:
      if (unit.damage > 0) unit.damage = bumpScaledStat(unit.damage, s.primary);
      unit.accuracy = Math.min(68, unit.accuracy + (starTier === 'gold' ? 2 : starTier === 'silver' ? 1 : 0));
      if (unit.meleeRange) unit.meleeRange = Math.floor(unit.meleeRange * s.secondary);
      bumpUnitMorale(unit, starTier === 'gold' ? 2 : 1);
      break;
  }
}

/** Earn bronze stars from kills/survival; 3 bronze → 1 silver → 1 gold → veteran upgrade. */
function addVetStar(unit, tier = 'bronze') {
  if (unit.team !== 'player') return null;

  if (tier === 'bronze') {
    unit.vetBronze = (unit.vetBronze || 0) + 1;
    if (unit.vetBronze >= 3) {
      unit.vetBronze = 0;
      return addVetStar(unit, 'silver') || 'silver';
    }
    applyVeteranStarBump(unit, 'bronze');
    return 'bronze';
  }

  if (tier === 'silver') {
    unit.vetSilver = (unit.vetSilver || 0) + 1;
    if (unit.vetSilver >= 3) {
      unit.vetSilver = 0;
      return addVetStar(unit, 'gold') || 'gold';
    }
    applyVeteranStarBump(unit, 'silver');
    return 'silver';
  }

  if (tier === 'gold') {
    unit.vetGold = (unit.vetGold || 0) + 1;
    recordGoldStarEarned(unit);
    if (unit.vetGold >= 3) {
      const honored = grantHonorName(unit);

      if (unit.isGeneral) {
        unit.generalStars = (unit.generalStars || 0) + 1;
        applyVeteranStarBump(unit, 'gold');
        resetVetStars(unit);
        return honored ? 'honored_general_star' : 'general_star';
      }

      resetVetStars(unit);
      if ((unit.vetTier || 0) >= MAX_VETERAN_TIER) {
        applyVeteranStarBump(unit, 'gold');
        return honored ? 'honored_max' : 'max_rank';
      }
      unit.vetUpgradeEligible = true;
      applyVeteranStarBump(unit, 'silver');
      return honored ? 'honored_eligible' : 'upgrade_eligible';
    }
    applyVeteranStarBump(unit, 'gold');
    return 'gold';
  }

  return null;
}

function isSpecialistUnit(unit) {
  const kind = unit?.type || unit?.combatType;
  return unit?.team === 'player' && ['healer', 'builder', 'courier'].includes(kind);
}

function ensureHealerStats(unit) {
  if (!unit || unit.type !== 'healer') return;
  if (!unit.healAmount) {
    const def = getPlayerUnitDef('healer');
    unit.healAmount = def?.healAmount || 20;
  }
}

function applyVeteranTierStep(unit, tier) {
  const t = tier;
  ensureHealerStats(unit);
  const role = getUnitVeteranRole(unit);
  const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;

  switch (role) {
    case 'healer':
      unit.maxHp = Math.floor(unit.maxHp * (1.18 + t * 0.05));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.healAmount = Math.floor((unit.healAmount || 20) * (1.28 + t * 0.06));
      unit.range = Math.floor(unit.range * (1.1 + t * 0.03));
      unit.speed = Math.round(unit.speed * (1.06 + t * 0.02) * 100) / 100;
      bumpUnitMorale(unit, 5);
      break;
    case 'builder':
      unit.maxHp = Math.floor(unit.maxHp * (1.2 + t * 0.05));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.buildRange = Math.floor(unit.buildRange * (1.14 + t * 0.04));
      unit.buildSpeedMult = (unit.buildSpeedMult || 1) * (1.2 + t * 0.05);
      unit.speed = Math.round(unit.speed * (1.1 + t * 0.03) * 100) / 100;
      unit.damage = Math.floor(unit.damage * (1.15 + t * 0.03));
      bumpUnitMorale(unit, 4);
      break;
    case 'courier':
      unit.maxHp = Math.floor(unit.maxHp * (1.15 + t * 0.04));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.speed = Math.round(unit.speed * (1.14 + t * 0.04) * 100) / 100;
      unit.courierCooldownMult = (unit.courierCooldownMult || 1) * Math.max(0.42, 0.86 - t * 0.02);
      bumpUnitMorale(unit, 3);
      break;
    case 'general':
      unit.maxHp = Math.floor(unit.maxHp * (1.2 + t * 0.045));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.damage = Math.floor(unit.damage * (1.16 + t * 0.028));
      unit.accuracy = Math.min(72, unit.accuracy + 4 + t * 2);
      if (unit.meleeRange) unit.meleeRange = Math.floor(unit.meleeRange * (1.04 + t * 0.01));
      bumpUnitMorale(unit, 5 + t);
      break;
    case 'cavalry':
      unit.maxHp = Math.floor(unit.maxHp * (1.2 + t * 0.038));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.damage = Math.floor(unit.damage * (1.22 + t * 0.035));
      unit.speed = Math.round(unit.speed * (1.14 + t * 0.03) * 100) / 100;
      unit.accuracy = Math.min(68, unit.accuracy + 4 + t * 2);
      if (unit.meleeRange) unit.meleeRange = Math.floor(unit.meleeRange * (1.06 + t * 0.012));
      bumpUnitMorale(unit, 4);
      break;
    case 'siege':
      unit.maxHp = Math.floor(unit.maxHp * (1.22 + t * 0.04));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.damage = Math.floor(unit.damage * (1.22 + t * 0.032));
      unit.siegeMult = (unit.siegeMult || 1) * (1.18 + t * 0.04);
      if (unit.meleeRange) unit.meleeRange = Math.floor(unit.meleeRange * (1.05 + t * 0.01));
      bumpUnitMorale(unit, 3);
      break;
    case 'ranged':
      unit.maxHp = Math.floor(unit.maxHp * (1.18 + t * 0.035));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.damage = Math.floor(unit.damage * (1.22 + t * 0.032));
      unit.accuracy = Math.min(68, unit.accuracy + 6 + t * 2);
      if (unit.baseRange) {
        unit.baseRange = Math.floor(unit.baseRange * (1.06 + t * 0.012));
        if (!unit.garrisoned) unit.range = unit.baseRange;
      }
      bumpUnitMorale(unit, 3);
      break;
    default:
      unit.maxHp = Math.floor(unit.maxHp * (1.24 + t * 0.04));
      unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
      unit.damage = Math.floor(unit.damage * (1.2 + t * 0.03));
      unit.speed = Math.round(unit.speed * (1.1 + t * 0.02) * 100) / 100;
      unit.accuracy = Math.min(68, unit.accuracy + 5 + t * 2);
      if (unit.meleeRange) unit.meleeRange = Math.floor(unit.meleeRange * (1.05 + t * 0.01));
      bumpUnitMorale(unit, 4);
      break;
  }
}

/** Apply veteran tier stat steps when vetTier was set without upgradeVeteranUnit (e.g. academy spawn bonus). */
function syncVeteranStatsToTier(unit) {
  if (!unit || unit.team !== 'player') return unit;
  const target = unit.vetTier || 0;
  let applied = unit.vetStatTierApplied || 0;
  while (applied < target) {
    applied++;
    applyVeteranTierStep(unit, applied);
  }
  unit.vetStatTierApplied = target;
  return unit;
}

/** Specialists earn one full rank (V-tier + stats) per wave when they heal, build, or dispatch. */
function trySpecialistRank(unit) {
  if (!isSpecialistUnit(unit) || unit.specialistRankedThisWave) return null;
  unit.specialistRankedThisWave = true;
  if ((unit.vetTier || 0) >= MAX_VETERAN_TIER) {
    applyVeteranStarBump(unit, 'gold');
    // Still credit a gold star toward late abilities at max rank.
    recordGoldStarEarned(unit);
    return 'max_rank';
  }
  upgradeVeteranUnit(unit);
  // Each working wave also earns one gold-star credit toward late specialist abilities.
  recordGoldStarEarned(unit);
  return 'upgrade';
}

function getBuilderBuildTicks(unit, repairing = false) {
  let mult = unit.buildSpeedMult || 1;
  if (typeof Game !== 'undefined' && Game.isNightPhase?.()) {
    const wave = Game.getState?.()?.wave ?? 0;
    const nightProg = Game.getState?.()?.nightProgress ?? 0;
    const nightMult =
      typeof GameDepth !== 'undefined'
        ? GameDepth.getNightBuildMult(wave, nightProg * NIGHT_PREP_TICKS, NIGHT_PREP_TICKS)
        : NIGHT_BUILD_MULT;
    mult *= nightMult;
    const asym =
      typeof Game !== 'undefined' && Game.getAsymmetricMods ? Game.getAsymmetricMods() : null;
    if (asym?.commanderBuilderMult) mult *= asym.commanderBuilderMult;
    if (typeof DynamicMapEvents !== 'undefined') {
      mult *= DynamicMapEvents.getActiveMods().nightBuildMult || 1;
    }
    if (typeof CrownLegacies !== 'undefined' && Game.getState?.()?.creativeMode !== true) {
      mult *= CrownLegacies.getCombinedEffects().builderBuildMult || 1;
    }
  }
  if (repairing) mult *= 0.52;
  return Math.max(1, Math.round(mult + (unit.vetTier || 0) * 0.25));
}

function isVanillaPlayerUnit(unit) {
  return (
    unit?.team === 'player' && unit.hp > 0 && !unit.isCrossover && !unit.isWwe && !unit.isDoomslayer
  );
}

function getVeteranUpgradeCost(unit) {
  const def = getPlayerUnitDef(unit?.type);
  const base = def?.cost || 5;
  const tier = unit?.vetTier || 0;
  return Math.ceil(base * (1.15 + tier * 0.7));
}

function canSpendTpVeteranUpgrade(unit) {
  if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
  if (!isVanillaPlayerUnit(unit)) return false;
  if (unit.isGeneral) return false;
  if ((unit.vetTier || 0) >= MAX_VETERAN_TIER) return false;
  return !!unit.vetUpgradeEligible;
}

function upgradeVeteranUnit(unit) {
  if ((unit.vetTier || 0) >= MAX_VETERAN_TIER) return unit;
  unit.vetTier = (unit.vetTier || 0) + 1;
  applyVeteranTierStep(unit, unit.vetTier);
  unit.vetStatTierApplied = unit.vetTier;
  unit.experience = (unit.experience || 0) + 5;
  return unit;
}

function formatUnitTypeName(type) {
  if (!type) return 'Unit';
  return String(type)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getUnitTypeName(unit) {
  if (!unit) return 'Unit';
  if (unit.bossName) return unit.bossName;
  if (unit.team === 'enemy' && EnemyDefs[unit.type]) {
    return EnemyDefs[unit.type].bossName || EnemyDefs[unit.type].name;
  }
  if (unit.isWwe && typeof WweDefs !== 'undefined' && WweDefs[unit.type])
    return WweDefs[unit.type].name;
  return (
    getPlayerUnitDef(unit.type)?.name || UnitDefs[unit.type]?.name || formatUnitTypeName(unit.type)
  );
}

function getVeteranLabel(unit) {
  const name = getUnitTypeName(unit);
  const specRanks = SPECIALIST_RANKS[unit.type];
  const combatRanks = ['', 'Veteran', 'Elite', 'Champion', 'Legend', 'Mythic', 'Immortal'];
  const ranks = specRanks || combatRanks;
  const rank = unit.vetTier ? ranks[Math.min(unit.vetTier, ranks.length - 1)] : '';
  if (unit.isGeneral && (unit.generalStars || 0) > 0) {
    return rank ? `${rank} ${name}` : `General (${unit.generalStars}★ command)`;
  }
  return rank ? `${rank} ${name}` : null;
}

function getUnitRoleLabel(unit) {
  if (!unit) return 'Unit';
  if (unit.isGeneral) {
    return (unit.generalStars || 0) > 0 ? `General (${unit.generalStars}★ command)` : 'General';
  }
  const vet = getVeteranLabel(unit);
  if (vet) return vet;
  return getUnitTypeName(unit);
}

function getUnitDisplayName(unit) {
  if (!unit) return 'Unit';
  if (typeof AscensionSystem !== 'undefined') {
    const title = AscensionSystem.getDisplayTitle?.(unit);
    if (title) return title;
  }
  if (unit.honorName) {
    if (!isValidHonorName(unit.honorName)) repairHonorName(unit);
    if (isValidHonorName(unit.honorName)) return unit.honorName;
  }
  return getUnitTypeName(unit);
}

function unitDisplayName(unit) {
  return getUnitDisplayName(unit);
}

/** EnemyDefs — loaded at init from data/enemies.json via GameData. */

/** Wave-scaling evil operatives — fantasy mirrors of crossover power roles (not literal gunmen). */
const EVIL_OPERATIVE_WAVES = {
  hellbound_legionnaire: 25,
  nightmare_strider: 30,
  dreadborn_champion: 35,
  warp_prophet: 40,
  grim_revenant: 45,
  umbral_stalker: 50,
  cinderbound_juggernaut: 55,
  hellmortar_pack: 60,
};

function isEnemyHordeGruntType(type) {
  return !!EnemyDefs[type]?.isHordeGrunt;
}

/** CoD Zombies horde — swarm grunts and flagged undead that chew through walls. */
function isZombieTypeEnemy(type) {
  if (!type) return false;
  const def = EnemyDefs[type];
  if (!def) return false;
  return !!(def.isHordeGrunt || def.isZombie || def.undead);
}

function isEnemyEvilOperativeType(type) {
  const def = EnemyDefs[type];
  return !!(def?.isEvilOperative || def?.isNamedBoss);
}

function getUnlockedEvilOperatives(waveNum) {
  return Object.entries(EVIL_OPERATIVE_WAVES)
    .filter(([, minWave]) => waveNum >= minWave)
    .map(([type]) => type);
}

const Waves = [
  { count: 4, pool: ['goblin', 'goblin', 'orc'], interval: 110 },
  { count: 6, pool: ['goblin', 'orc', 'orc_archer'], interval: 95 },
  { count: 7, pool: ['orc', 'goblin', 'warg_rider'], interval: 90 },
  { count: 8, pool: ['orc', 'orc_archer', 'goblin_sapper'], interval: 85 },
  { count: 9, pool: ['orc', 'dark_mage', 'goblin'], interval: 80 },
  { count: 10, pool: ['troll', 'orc', 'goblin_sapper', 'orc_archer'], interval: 75 },
  { count: 11, pool: ['berserker', 'orc', 'warg_rider', 'dark_mage'], interval: 70 },
  { count: 12, pool: ['necromancer', 'dark_knight', 'assassin', 'orc_archer'], interval: 65 },
  { count: 13, pool: ['siege_tower', 'troll', 'shaman', 'goblin_engineer', 'orc'], interval: 60 },
  {
    count: 16,
    pool: ['war_chief', 'dark_knight', 'necromancer', 'siege_tower', 'berserker', 'assassin'],
    interval: 50,
    boss: true,
  },
];

/**
 * Wave scaling centered on Academy Era (wave 100).
 * Pre-100: smooth climb; wave 100 is the difficulty/variety peak before RTS escalation.
 */
function getWaveConfig(waveNum) {
  const idx = Math.min(Math.max(0, waveNum - 1), Waves.length - 1);
  const base = Waves[idx];
  const eased = academyEase(waveNum);
  const post = postAcademyEase(waveNum);

  const pool = [...base.pool];
  if (waveNum >= 4) pool.push('goblin_sapper', 'orc_archer');
  if (waveNum >= 6) pool.push('dark_mage', 'warg_rider');
  if (waveNum >= 7) pool.push('siege_tower');
  if (waveNum >= 8) pool.push('troll', 'berserker');
  if (waveNum >= 10) pool.push('dark_knight', 'necromancer', 'assassin', 'siege_tower');
  if (waveNum >= 12) pool.push('shaman', 'goblin_engineer', 'war_chief');
  if (waveNum >= 15) pool.push('siege_tower', 'siege_tower', 'goblin_sapper');
  if (waveNum >= 20) pool.push('war_chief', 'berserker', 'siege_tower');
  for (const [type, minWave] of Object.entries(EVIL_OPERATIVE_WAVES)) {
    if (waveNum >= minWave) pool.push(type);
  }

  const templateCount = base.count + Math.floor(Math.min(waveNum - 1, Waves.length - 1) * 0.45);
  const academyCount = 8 + eased * 70;
  const count = Math.floor(Math.max(templateCount, academyCount) + post * 38);

  const interval = Math.max(32, base.interval - Math.floor(eased * 38));
  const hpScale = 1 + eased * 3.15 + post * 1.85;
  const dmgScale = 1 + eased * 1.95 + post * 1.15;
  const boss = waveNum % 10 === 0;

  return { count, pool, interval, boss, hpScale, dmgScale };
}

function previewWaveComposition(waveNum, sampleSize = 8) {
  const cfg = getWaveConfig(waveNum);
  const samples = Array.from(
    { length: sampleSize },
    () => cfg.pool[Math.floor(Math.random() * cfg.pool.length)]
  );
  return [...new Set(samples.map((t) => EnemyDefs[t]?.name || t))].join(', ');
}

const ENEMY_SPRITE_MAP = {
  orc_archer: 'orc_archer',
  goblin: 'goblin',
  orc: 'orc',
  dark_knight: 'dark_knight',
  warg_rider: 'warg_rider',
  dark_mage: 'dark_mage',
  troll: 'troll',
  goblin_sapper: 'goblin_sapper',
  necromancer: 'necromancer',
  berserker: 'berserker',
  assassin: 'assassin',
  shaman: 'shaman',
  siege_tower: 'siege_tower',
  goblin_engineer: 'goblin_engineer',
  war_chief: 'war_chief',
  hellbound_legionnaire: 'hellbound_legionnaire',
  nightmare_strider: 'nightmare_strider',
  dreadborn_champion: 'dreadborn_champion',
  warp_prophet: 'warp_prophet',
  grim_revenant: 'grim_revenant',
  umbral_stalker: 'umbral_stalker',
  cinderbound_juggernaut: 'cinderbound_juggernaut',
  hellmortar_pack: 'hellmortar_pack',
  harpy: 'harpy',
  goblin_burrower: 'goblin_burrower',
  bone_summoner: 'bone_summoner',
  sky_drake: 'sky_drake',
  plague_rat: 'plague_rat',
  abomination: 'abomination',
  behemoth: 'behemoth',
  iron_colossus: 'iron_colossus',
  void_stalker: 'void_stalker',
  elder_wyrm: 'elder_wyrm',
};

function resolvePlayerSpriteType(type) {
  if (type === 'doomslayer_hero') return 'doomslayer_hero';
  if (typeof getCrossoverDef === 'function') {
    const cdef = getCrossoverDef(type);
    if (cdef?.faction) return `roster_${cdef.faction}`;
  }
  if (typeof isWweUnit === 'function' && isWweUnit(type)) return 'roster_wwe';
  return type;
}

function allocUnitObject() {
  return typeof EntityPool !== 'undefined' ? EntityPool.acquireUnit() : {};
}

function allocBuildingObject() {
  return typeof EntityPool !== 'undefined' ? EntityPool.acquireBuilding() : {};
}

/** Last-resort defs if data pack / ContentExpansion race wiped expansion roster. */
const EXPANSION_UNIT_FALLBACKS = {
  scout: {
    name: 'Scout',
    cost: 4,
    hp: 55,
    accuracy: 32,
    damage: 18,
    range: 28,
    meleeRange: 24,
    speed: 1.45,
    type: 'melee',
    morale: 11,
    experience: 6,
    canHunt: true,
    revealsStealth: true,
  },
  bard: {
    name: 'Bard',
    cost: 5,
    hp: 58,
    accuracy: 20,
    damage: 12,
    range: 90,
    meleeRange: 22,
    speed: 1.05,
    type: 'ranged',
    projectile: 'arrow',
    morale: 16,
    experience: 7,
    canHunt: false,
    moraleAuraUnit: 3,
  },
  ballista: {
    name: 'Ballista',
    cost: 6,
    hp: 75,
    accuracy: 38,
    damage: 42,
    range: 220,
    meleeRange: 24,
    speed: 0.75,
    type: 'ranged',
    projectile: 'arrow',
    morale: 12,
    experience: 7,
    canHunt: true,
    antiAir: true,
    siegeMult: 2.2,
  },
  pikeman: {
    name: 'Pikeman',
    cost: 4,
    hp: 90,
    accuracy: 30,
    damage: 22,
    range: 32,
    meleeRange: 32,
    speed: 0.95,
    type: 'melee',
    morale: 14,
    experience: 5,
    canHunt: true,
    antiCavalry: true,
    antiAir: true,
  },
};

function resolvePlayerUnitDef(type) {
  let def = getPlayerUnitDef(type);
  if (def) return def;
  // Expansion roster may vanish after async GameData.loadAll — re-register then fall back.
  if (typeof ContentExpansion !== 'undefined' && ContentExpansion.registerDefs) {
    ContentExpansion.registerDefs();
    def = getPlayerUnitDef(type);
    if (def) return def;
  }
  const fallback = EXPANSION_UNIT_FALLBACKS[type];
  if (fallback && typeof UnitDefs === 'object' && UnitDefs) {
    UnitDefs[type] = { ...fallback };
    return UnitDefs[type];
  }
  return null;
}

function createUnit(type, x, y, team, opts = {}) {
  const def = team === 'player' ? resolvePlayerUnitDef(type) : EnemyDefs[type];
  if (!def) return null;

  const spriteType =
    team === 'enemy' ? ENEMY_SPRITE_MAP[type] || type : resolvePlayerSpriteType(type);

  const u = allocUnitObject();
  u.id = Math.random().toString(36).slice(2, 9);
  u.type = type;
  u.spriteType = spriteType;
  u.team = team;
  u.x = x;
  u.y = y;
  u.targetX = x;
  u.targetY = team === 'player' ? DEFAULT_RALLY_Y : y;
  u.hp = def.hp;
  u.maxHp = def.hp;
  u.accuracy = def.accuracy;
  u.damage = def.damage;
  u.range = def.range;
  u.baseRange = def.range;
  u.meleeRange = def.meleeRange;
  u.speed = def.speed;
  u.combatType = def.type;
  // Ranged siege crews (ballista) must always have a projectile or they never fire.
  u.projectile =
    def.projectile ||
    (def.type === 'ranged' || def.type === 'siege' ? 'arrow' : null);
  u.healAmount = def.healAmount ?? (def.type === 'healer' ? 20 : 0);
  u.morale = def.morale || 10;
  u.maxMorale = def.morale || 10;
  u.experience = def.experience || 0;
  u.reward = def.reward || 0;
  u.buildRange = def.buildRange || 0;
  u.canHunt =
    def.canHunt !== false &&
    def.type !== 'healer' &&
    def.type !== 'builder' &&
    def.type !== 'courier' &&
    def.type !== 'general';
  u.huntMode =
    def.canHunt !== false &&
    def.type !== 'healer' &&
    def.type !== 'builder' &&
    def.type !== 'courier' &&
    def.type !== 'general';
  u.isWwe = typeof isWweUnit === 'function' && isWweUnit(type);
  u.isCrossover = typeof isCrossoverUnit === 'function' && isCrossoverUnit(type);
  u.isDoomslayer = !!(def.isDoomslayer || type === 'doomslayer_hero');
  u.wweAbility = def.ability || null;
  u.wweColor = def.color || null;
  u.combatTag = def.combatTag || def.type || null;
  u.perks = [];
  u.attackSpeedMult = 1;
  u.manualOrder = false;
  u.holdX = null;
  u.holdY = null;
  u.pendingHoldX = null;
  u.pendingHoldY = null;
  u.path = [];
  u.pathIndex = 0;
  u.pathRecalc = 0;
  u.pathTargetId = null;
  u.combatTargetId = null;
  u.rotation = team === 'player' ? -90 : 90;
  u.frame = 0;
  u.frameTimer = 0;
  u.animState = 'idle';
  u.attackAnimTimer = 0;
  u.actionTimer = Math.floor(Math.random() * 50);
  u.pinned = false;
  u.fleeing = false;
  u.demoralized = false;
  u.witnessDeaths = 0;
  u.wounded = false;
  u.pinTimer = 0;
  u.building = null;
  u.buildQueue = def.type === 'builder' ? [] : null;
  u.buildProgress = 0;
  u.courierReady = true;
  u.garrisoned = null;
  u.siegeDeployed = false;
  u.linkedWallId = null;
  u.healerFleeing = false;
  u.chargeTimer = 0;
  u.rallyTimer = 0;
  u.vetBronze = 0;
  u.vetSilver = 0;
  u.vetGold = 0;
  u.goldStarsEarned = 0;
  u.lateAbilityUnlocked = false;
  u.vetTier = 0;
  u.vetStatTierApplied = 0;
  u.vetUpgradeEligible = false;
  u.baseMaxHp = null;
  u.baseDamage = null;
  u.ipScaleWave = 0;
  u.specialistRankedThisWave = false;
  u.buildSpeedMult = 1;
  u.courierCooldownMult = 1;
  u.stationedKeep = null;
  u.generalAliveTimer = 0;
  u.generalStars = 0;
  u.isGeneral = def.type === 'general';
  u.rallyTargetId = null;
  u.w2wBuffTimer = 0;
  u.rallyCooldown = 0;
  u.honorName = null;
  u.honorTitleWave = null;
  u.wallGarrisoned = null;
  u.wallSlotIndex = null;
  u.retreatingToMed = null;
  u.atMedicalTent = null;
  u.fightToDeath = false;
  u.spawnSide = opts.spawnSide || null;
  u.spawnWave = opts.spawnWave ?? 0;
  u.tenureApplied = 0;
  u.siegeMult = def.siegeMult || 1;
  u.flying = !!def.flying;
  u.burrower = !!def.burrower;
  u.burrowed = false;
  u.burrowTimer = 0;
  u.summoner = !!def.summoner;
  u.summonTimer = def.summonCooldown || 0;
  u.summonType = def.summonType || 'goblin';
  u.summonCooldown = def.summonCooldown || 280;
  u.antiAir = !!def.antiAir;
  u.antiCavalry = !!def.antiCavalry;
  u.moraleAuraUnit = def.moraleAuraUnit || 0;
  u.revealsStealth = !!def.revealsStealth;
  u.spriteScale = def.spriteScale || 1;
  u.isNamedBoss = !!def.isNamedBoss;
  u.isHordeGrunt = team === 'enemy' && !!def.isHordeGrunt;
  u.isEvilOperative = team === 'enemy' && !!(def.isEvilOperative || def.isNamedBoss);
  u.evilRole = def.evilRole || null;
  u.bossName = def.bossName || null;
  u.bossTitle = def.bossTitle || null;
  u.altitude = def.flying ? 1 : 0;
  u.enrageTimer = 0;
  u.frostTimer = 0;
  u.flareMarked = 0;
  u.hasDoubleTap = false;
  u.hasSleight = false;
  u.enemyFaction = opts.enemyFaction || null;
  u.isCounterRaid = !!opts.isCounterRaid;
  u.raidTargetId = opts.raidTargetId || null;
  return u;
}

const WALL_FACINGS = ['north', 'east', 'south', 'west'];

function cycleWallFacing(facing, steps = 1) {
  const idx = WALL_FACINGS.indexOf(facing || 'north');
  const base = idx >= 0 ? idx : 0;
  return WALL_FACINGS[(base + steps + WALL_FACINGS.length * 4) % WALL_FACINGS.length];
}

function getWallSlotPositions(facing, x, y) {
  const inset = 22;
  const spread = 16;
  let pts;
  switch (facing) {
    case 'north':
      pts = [
        { x: x - spread, y: y + inset },
        { x: x + spread, y: y + inset },
      ];
      break;
    case 'south':
      pts = [
        { x: x - spread, y: y - inset },
        { x: x + spread, y: y - inset },
      ];
      break;
    case 'east':
      pts = [
        { x: x - inset, y: y - spread },
        { x: x - inset, y: y + spread },
      ];
      break;
    case 'west':
      pts = [
        { x: x + inset, y: y - spread },
        { x: x + inset, y: y + spread },
      ];
      break;
    default:
      pts = [
        { x: x - spread, y: y },
        { x: x + spread, y: y },
      ];
  }
  return pts.map((p) => ({ slotX: p.x, slotY: p.y, unitId: null }));
}

function getKeepGeneralSlot(keep) {
  return {
    x: keep.slotX ?? keep.x + KEEP_GENERAL_SLOT_DX,
    y: keep.slotY ?? keep.y + KEEP_GENERAL_SLOT_DY,
  };
}

function createBuilding(type, x, y, owner, opts = {}) {
  const def = BuildDefs[type];
  if (!def) return null;
  const slotX = def.isKeep ? (opts.slotX ?? x + KEEP_GENERAL_SLOT_DX) : (opts.slotX ?? x);
  const slotY = def.isKeep ? (opts.slotY ?? y + KEEP_GENERAL_SLOT_DY) : (opts.slotY ?? y - 14);
  const b = allocBuildingObject();
  b.id = Math.random().toString(36).slice(2, 9);
  b.type = type;
  b.x = x;
  b.y = y;
  b.owner = owner;
  b.hp = def.hp;
  b.maxHp = def.hp;
  b.cover = def.cover;
  b.radius = def.radius;
  b.attackRadius = def.attackRadius ?? def.radius;
  b.blocksMove = def.blocksMove;
  b.blocksLOS = def.blocksLOS;
  b.moraleAura = def.moraleAura || 0;
  b.rangeBonus = def.rangeBonus || 0;
  b.wallProtection = def.wallProtection || 0;
  b.garrisonUnitId = null;
  b.generalUnitId = null;
  b.siegeTowerId = null;
  b.isKeep = def.isKeep || false;
  b.isMedical = def.isMedical || false;
  b.isMessHall = def.isMessHall || false;
  b.isAcademy = def.isAcademy || false;
  b.academyUnit = def.academyUnit || null;
  b.isHamlet = def.isHamlet || false;
  b.settlementTier = def.settlementTier || 0;
  b.isMerchantGuild = def.isMerchantGuild || false;
  b.isEnemySettlement = def.isEnemySettlement || false;
  b.isSettlement = def.isSettlement || false;
  b.isWweAcademy = def.isWweAcademy || false;
  b.isCrossoverBarracks = def.isCrossoverBarracks || false;
  b.crossoverFaction = def.crossoverFaction || null;
  b.isPerkMachine = def.isPerkMachine || false;
  b.perkId = def.perkId || null;
  b.isResearchLab = def.isResearchLab || false;
  b.isWatchtower = def.isWatchtower || false;
  b.visionRadius = def.visionRadius || 0;
  b.isTrap = def.isTrap || false;
  b.trapDamage = def.trapDamage || 0;
  b.trapCooldown = 0;
  b.isResourceGen = def.isResourceGen || false;
  b.tpPerRound = def.tpPerRound || 0;
  b.isFortressUpgrade = def.isFortressUpgrade || false;
  b.fortressTier = def.fortressTier || 0;
  b.waveBuildRequired = def.waveBuildTime || 0;
  b.waveBuildProgress = 0;
  b.hamletAuraRadius = def.hamletAuraRadius || HAMLET_AURA_RADIUS;
  b.healRate = def.healRate || 0;
  b.facing = opts.facing || def.facing || 'north';
  b.slotX = slotX;
  b.slotY = slotY;
  b.castleGroup = opts.castleGroup || null;
  b.wallSlots =
    type === 'wall' ? getWallSlotPositions(opts.facing || def.facing || 'north', x, y) : null;
  b.buildTime = def.buildTime;
  b.buildProgress = 0;
  b.complete = false;
  b.enemyFaction = opts.enemyFaction || null;
  return b;
}

/** Castle compound — four walls face outward (N/E/S/W) so cover and garrison face the assault. */
function getCastleKeepForGroup(buildings, groupId) {
  if (!buildings?.length || !groupId) return null;
  return (
    buildings.find(
      (b) =>
        b.owner === 'player' &&
        b.castleGroup === groupId &&
        b.isKeep &&
        b.complete &&
        b.hp > 0
    ) || null
  );
}

/** Inner courtyard — keep, med tent, mess hall; past the wall ring counts as a breach. */
function isInsideCastleInnerSanctum(unit, buildings, groupId) {
  if (!unit || !groupId || !buildings?.length) return false;
  const keep = getCastleKeepForGroup(buildings, groupId);
  if (!keep) return false;
  const innerReach = CASTLE_INNER_OFFSET + Math.max(keep.radius || 22, 20) + 14;
  return Math.hypot(unit.x - keep.x, unit.y - keep.y) <= innerReach;
}

function playerHasCastleCompound(buildings) {
  return !!buildings?.some(
    (b) => b.owner === 'player' && b.castleGroup && b.isKeep && b.complete && b.hp > 0
  );
}

function getCastleCompoundLayout(cx, cy) {
  const o = CASTLE_COMPOUND_OFFSET;
  const i = CASTLE_INNER_OFFSET;
  return [
    { type: 'outpost', x: cx - o, y: cy - o },
    { type: 'wall', x: cx, y: cy - o, facing: 'north' },
    { type: 'outpost', x: cx + o, y: cy - o },
    { type: 'wall', x: cx - o, y: cy, facing: 'west' },
    { type: 'medical_tent', x: cx - i, y: cy },
    { type: 'castle_keep', x: cx, y: cy },
    { type: 'mess_hall', x: cx + i, y: cy },
    { type: 'wall', x: cx + o, y: cy, facing: 'east' },
    { type: 'outpost', x: cx - o, y: cy + o },
    { type: 'wall', x: cx, y: cy + o, facing: 'south' },
    { type: 'outpost', x: cx + o, y: cy + o },
  ];
}

function getCastleCompoundCost() {
  return getCastleCompoundLayout(0, 0).reduce((sum, part) => {
    return sum + (BuildDefs[part.type]?.cost ?? 0);
  }, 0);
}

BuildDefs.castle.cost = getCastleCompoundCost();
