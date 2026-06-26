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
const RTS_MAP_EXPAND_W = 180;
const RTS_MAP_EXPAND_H = 220;
const ATTACK_SIDE_INTERVAL = 25;
const ATTACK_SIDES = ['north', 'east', 'west', 'south'];
const HEALER_ACADEMY_WAVE_INTERVAL = 5;
const GENERAL_ACADEMY_WAVE_INTERVAL = 10;
const GENERAL_PROMOTE_GOLD_STARS = 3;
/** Highest veteran rank index (Immortal / Saint of the Realm). */
const MAX_VETERAN_TIER = 6;

const SPECIALIST_RANKS = {
  healer:  ['', 'Acolyte', 'Physicker', 'High Healer', 'Saint', 'Archbishop', 'Saint of the Realm'],
  builder: ['', 'Apprentice', 'Mason', 'Architect', 'Master Builder', 'Grand Architect', 'Imperial Engineer'],
  courier: ['', 'Runner', 'Dispatch Rider', 'Royal Courier', "King's Sworn", 'Wind Rider', 'Crown Envoy'],
};

const ACADEMY_BUILD_TYPES = [
  'academy_footman', 'academy_archer', 'academy_mage', 'academy_cavalry',
  'academy_knight', 'academy_sapper', 'academy_healer', 'academy_builder',
  'academy_courier', 'academy_general',
];
const DEPLOY_Y = BASE_FIELD_H - 20;
const DEFAULT_RALLY_Y = BASE_FIELD_H - 100;

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
  const t = academyProgress(waveNum);
  return t * t * (3 - 2 * t);
}

function getTerritoryTier(waveNum) {
  return Math.max(0, Math.floor(academyProgress(waveNum) * ACADEMY_MAP_TIERS));
}

function getWorldSize(waveNum) {
  const tier = getTerritoryTier(waveNum);
  let w = BASE_FIELD_W + tier * MAP_EXPAND_W;
  let h = BASE_FIELD_H + tier * MAP_EXPAND_H;
  if (waveNum >= RTS_ERA_WAVE) {
    w += RTS_MAP_EXPAND_W;
    h += RTS_MAP_EXPAND_H;
  }
  return {
    w, h, tier,
    baseW: BASE_FIELD_W,
    baseH: BASE_FIELD_H,
    rtsEra: waveNum >= ACADEMY_ERA_WAVE,
    enemyRtsEra: waveNum >= RTS_ERA_WAVE,
  };
}

function countLiveBuilders(units) {
  return units.filter(u => u.team === 'player' && u.type === 'builder' && u.hp > 0).length;
}

function isRtsEra(waveNum) {
  return waveNum >= ACADEMY_ERA_WAVE;
}

function isEnemyRtsEra(waveNum) {
  return waveNum >= RTS_ERA_WAVE;
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

/** Effective collision radius for terrain / pathfinding (scales with construction progress). */
function terrainBlockRadius(obs) {
  if (!obs) return 0;
  if (obs.hp !== undefined && obs.hp <= 0) return 0;
  if (obs.blocksMove === false) return 0;
  if (obs.buildProgress !== undefined && obs.complete !== undefined) {
    if (!buildingBlocksTerrain(obs)) return 0;
    const prog = getBuildingProgressRatio(obs);
    return (obs.radius || 14) * (obs.complete ? 1 : 0.5 + prog * 0.25);
  }
  return obs.radius || obs.size || 14;
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
    id: 'baby', label: 'Baby',
    tagline: 'Forgiving — extra TP, weaker foes, slower spawns.',
    enemyHpMult: 0.72, enemyDmgMult: 0.75, enemyCountMult: 0.78,
    spawnIntervalMult: 1.3, waveHpScaleMult: 0.82, waveDmgScaleMult: 0.82,
    siegeTowerMult: 0.75, startingTp: 10, tpPerRoundBonus: 3, missLimit: 14,
    playerMoraleBonus: 4, eliteChanceMult: 0.6,
  },
  normal: {
    id: 'normal', label: 'Normal',
    tagline: 'Balanced tactical defense.',
    enemyHpMult: 1, enemyDmgMult: 1, enemyCountMult: 1,
    spawnIntervalMult: 1, waveHpScaleMult: 1, waveDmgScaleMult: 1,
    siegeTowerMult: 1, startingTp: 7, tpPerRoundBonus: 0, missLimit: 10,
    playerMoraleBonus: 0, eliteChanceMult: 1,
  },
  chad: {
    id: 'chad', label: 'Chad',
    tagline: 'Harder, faster, hungrier hordes.',
    enemyHpMult: 1.3, enemyDmgMult: 1.22, enemyCountMult: 1.22,
    spawnIntervalMult: 0.82, waveHpScaleMult: 1.14, waveDmgScaleMult: 1.1,
    siegeTowerMult: 1.25, startingTp: 5, tpPerRoundBonus: -1, missLimit: 8,
    playerMoraleBonus: 0, eliteChanceMult: 1.15,
  },
  doomslayer: {
    id: 'doomslayer', label: 'Doomslayer',
    tagline: 'Hell marches. No mercy.',
    enemyHpMult: 1.7, enemyDmgMult: 1.48, enemyCountMult: 1.5,
    spawnIntervalMult: 0.62, waveHpScaleMult: 1.38, waveDmgScaleMult: 1.32,
    siegeTowerMult: 1.6, startingTp: 4, tpPerRoundBonus: -2, missLimit: 6,
    playerMoraleBonus: -2, eliteChanceMult: 1.35,
  },
};

function getDifficultyDef(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

const UnitDefs = {
  footman:  { name: 'Footman',  cost: 3, hp: 100, accuracy: 35, damage: 25, range: 22, meleeRange: 22, speed: 1.0, type: 'melee',  morale: 15, experience: 5,  canHunt: true },
  archer:   { name: 'Archer',   cost: 4, hp: 70,  accuracy: 40, damage: 30, range: 200, meleeRange: 25, speed: 1.0, type: 'ranged', projectile: 'arrow', morale: 12, experience: 8,  canHunt: true },
  mage:     { name: 'Mage',     cost: 6, hp: 50,  accuracy: 45, damage: 40, range: 180, meleeRange: 25, speed: 0.9, type: 'ranged', projectile: 'bolt',  morale: 10, experience: 10, canHunt: true },
  cavalry:  { name: 'Cavalry',  cost: 7, hp: 120, accuracy: 30, damage: 45, range: 28,  meleeRange: 28, speed: 1.4, type: 'melee',  morale: 18, experience: 6,  canHunt: true },
  healer:   { name: 'Healer',   cost: 5, hp: 60,  accuracy: 0,  damage: 0,  range: 100, meleeRange: 25, speed: 1.0, type: 'healer', healAmount: 20, morale: 14, experience: 7, canHunt: false },
  builder:  { name: 'Builder',  cost: 5, hp: 80,  accuracy: 10, damage: 8,  range: 60,  meleeRange: 20, speed: 0.8, type: 'builder', morale: 12, experience: 4, canHunt: false, buildRange: 90 },
  courier:  { name: 'Courier',  cost: 4, hp: 50,  accuracy: 0,  damage: 0,  range: 0,   meleeRange: 0,  speed: 1.3, type: 'courier', morale: 10, experience: 3, canHunt: false },
  sapper:   { name: 'Sapper',   cost: 5, hp: 65,  accuracy: 25, damage: 35, range: 24,  meleeRange: 24, speed: 0.9, type: 'melee',  morale: 13, experience: 6,  canHunt: true, siegeMult: 2.5 },
  knight:   { name: 'Knight',   cost: 8, hp: 140, accuracy: 38, damage: 40, range: 26,  meleeRange: 26, speed: 1.1, type: 'melee',  morale: 20, experience: 8,  canHunt: true },
  general:  { name: 'General',  cost: 12, hp: 200, accuracy: 42, damage: 38, range: 28,  meleeRange: 28, speed: 0.95, type: 'general', morale: 28, experience: 15, canHunt: true },
  doomslayer_hero: {
    name: 'The Doomslayer', cost: 10000, hp: 9999, accuracy: 99, damage: 9999, range: 40, meleeRange: 40,
    speed: 1.2, type: 'melee', morale: 40, experience: 99, canHunt: true,
    isDoomslayer: true, siegeMult: 8,
  },
};

function getPlayerUnitDef(type) {
  if (UnitDefs[type]) return UnitDefs[type];
  if (typeof WweDefs !== 'undefined' && WweDefs[type]) return WweDefs[type];
  if (typeof CrossoverDefs !== 'undefined' && CrossoverDefs[type]) return CrossoverDefs[type];
  return null;
}

const BuildDefs = {
  outpost: {
    name: 'Outpost', cost: 4, hp: 200, cover: 0.5, radius: 22,
    blocksMove: false, blocksLOS: true, buildTime: 120,
    rangeBonus: 55, garrisonSlot: 1, facing: 'north',
  },
  wall: {
    name: 'Wall', cost: 6, hp: 350, cover: 0.6, radius: 28,
    blocksMove: true, blocksLOS: true, buildTime: 180,
    wallProtection: 0.45, facing: 'north',
  },
  castle: {
    name: 'Castle', cost: 0, hp: 800, cover: 0.75, radius: 42,
    blocksMove: true, blocksLOS: true, buildTime: 400,
    isCompound: true, moraleAura: 2,
  },
  castle_keep: {
    name: 'Keep', cost: 0, hp: 500, cover: 0.72, radius: 22,
    blocksMove: true, blocksLOS: true, buildTime: 400,
    isKeep: true, facing: 'north',
  },
  medical_tent: {
    name: 'Medical Tent', cost: 5, hp: 120, cover: 0.25, radius: 18,
    blocksMove: false, blocksLOS: false, buildTime: 100,
    isMedical: true, healRate: 0.14,
  },
  mess_hall: {
    name: 'Mess Hall', cost: 5, hp: 150, cover: 0.3, radius: 20,
    blocksMove: false, blocksLOS: false, buildTime: 120,
    isMessHall: true, moraleAura: 4,
  },
  academy_footman: {
    name: 'Footman Academy', cost: 40, hp: 200, cover: 0.4, radius: 24,
    blocksMove: false, blocksLOS: true, buildTime: 220,
    isAcademy: true, academyUnit: 'footman',
  },
  academy_archer: {
    name: 'Archer Academy', cost: 45, hp: 180, cover: 0.4, radius: 24,
    blocksMove: false, blocksLOS: true, buildTime: 220,
    isAcademy: true, academyUnit: 'archer',
  },
  academy_mage: {
    name: 'Mage Academy', cost: 55, hp: 160, cover: 0.35, radius: 24,
    blocksMove: false, blocksLOS: true, buildTime: 240,
    isAcademy: true, academyUnit: 'mage',
  },
  academy_cavalry: {
    name: 'Cavalry Academy', cost: 60, hp: 190, cover: 0.35, radius: 24,
    blocksMove: false, blocksLOS: true, buildTime: 250,
    isAcademy: true, academyUnit: 'cavalry',
  },
  academy_knight: {
    name: 'Knight Academy', cost: 65, hp: 210, cover: 0.45, radius: 24,
    blocksMove: false, blocksLOS: true, buildTime: 260,
    isAcademy: true, academyUnit: 'knight',
  },
  academy_sapper: {
    name: 'Sapper Academy', cost: 45, hp: 175, cover: 0.35, radius: 24,
    blocksMove: false, blocksLOS: true, buildTime: 230,
    isAcademy: true, academyUnit: 'sapper',
  },
  academy_healer: {
    name: 'Healer Academy', cost: 48, hp: 170, cover: 0.3, radius: 22,
    blocksMove: false, blocksLOS: false, buildTime: 200,
    isAcademy: true, academyUnit: 'healer', academyWaveInterval: HEALER_ACADEMY_WAVE_INTERVAL,
  },
  academy_builder: {
    name: 'Builder Academy', cost: 48, hp: 185, cover: 0.35, radius: 22,
    blocksMove: false, blocksLOS: false, buildTime: 210,
    isAcademy: true, academyUnit: 'builder', requiresAbsentUnit: 'builder',
  },
  academy_courier: {
    name: 'Courier Academy', cost: 40, hp: 150, cover: 0.3, radius: 22,
    blocksMove: false, blocksLOS: false, buildTime: 200,
    isAcademy: true, academyUnit: 'courier', requiresAbsentUnit: 'courier',
  },
  academy_general: {
    name: 'General Academy', cost: 100, hp: 240, cover: 0.5, radius: 26,
    blocksMove: false, blocksLOS: true, buildTime: 300,
    isAcademy: true, academyUnit: 'general', academyWaveInterval: GENERAL_ACADEMY_WAVE_INTERVAL,
    requiresPromotableFootman: true,
  },
  hamlet: {
    name: 'Hamlet', cost: 100, hp: 600, cover: 0.35, radius: 55,
    blocksMove: true, blocksLOS: true, buildTime: 1,
    waveBuildTime: HAMLET_WAVE_BUILD_TIME, requiresBuilders: HAMLET_BUILDERS_REQUIRED,
    isHamlet: true, isSettlement: true, tpBonusPerHamlet: HAMLET_TP_PER_ROUND,
    settlementWarnBefore: SETTLEMENT_WARN_WAVE,
  },
  merchant_guild: {
    name: 'Merchant Guild', cost: 150, hp: 500, cover: 0.3, radius: 48,
    blocksMove: true, blocksLOS: true, buildTime: 280,
    requiresBuilders: HAMLET_BUILDERS_REQUIRED, isMerchantGuild: true, isSettlement: true,
    tpBonusInHamlet: 1, hamletAuraRadius: HAMLET_AURA_RADIUS,
    settlementWarnBefore: SETTLEMENT_WARN_WAVE,
  },
  enemy_hamlet: {
    name: 'Enemy Hamlet', cost: 0, hp: 600, cover: 0.35, radius: 55,
    blocksMove: true, blocksLOS: true, buildTime: 1,
    waveBuildTime: HAMLET_WAVE_BUILD_TIME, isHamlet: true, isEnemySettlement: true,
    tpBonusPerHamlet: 1,
  },
  enemy_merchant_guild: {
    name: 'Enemy Merchant Guild', cost: 0, hp: 500, cover: 0.3, radius: 48,
    blocksMove: true, blocksLOS: true, buildTime: 1,
    waveBuildTime: 3, isMerchantGuild: true, isEnemySettlement: true,
    tpBonusInHamlet: 1, hamletAuraRadius: HAMLET_AURA_RADIUS,
  },
  wwe_academy: {
    name: 'WWE Academy', cost: 1000, hp: 1200, cover: 0.5, radius: 62,
    blocksMove: true, blocksLOS: true, buildTime: 500,
    requiresBuilders: 10, recommendedHamlets: 2, recommendedGuilds: 1,
    isWweAcademy: true, isSettlement: true, secret: true,
  },
  element_barracks: {
    name: 'Element 115 Barracks', cost: 280, hp: 500, cover: 0.4, radius: 48,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'ultimis', secret: true,
  },
  primis_shrine: {
    name: 'Primis Shrine', cost: 280, hp: 520, cover: 0.42, radius: 50,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'primis', secret: true,
  },
  spartan_academy: {
    name: 'Spartan Academy', cost: 280, hp: 600, cover: 0.45, radius: 54,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'halo', secret: true,
  },
  cog_academy: {
    name: 'COG Academy', cost: 280, hp: 580, cover: 0.44, radius: 52,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'gears', secret: true,
  },
  rivendell_camp: {
    name: 'Rivendell Camp', cost: 280, hp: 560, cover: 0.43, radius: 52,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'lotr', secret: true,
  },
  hanma_dojo: {
    name: 'Hanma Dojo', cost: 280, hp: 540, cover: 0.42, radius: 50,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'baki', secret: true,
  },
  stand_arrow_shrine: {
    name: 'Stand Arrow Shrine', cost: 280, hp: 580, cover: 0.44, radius: 54,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'jojo', secret: true,
  },
  north_star_dojo: {
    name: 'North Star Dojo', cost: 280, hp: 550, cover: 0.43, radius: 51,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'fotns', secret: true,
  },
  capsule_corp: {
    name: 'Capsule Corp', cost: 280, hp: 590, cover: 0.45, radius: 54,
    blocksMove: true, blocksLOS: true, buildTime: 300,
    requiresBuilders: 4, isCrossoverBarracks: true,
    crossoverFaction: 'dragonball', secret: true,
  },
  perk_jugger_nog: {
    name: 'Jugger-Nog', cost: 12, hp: 140, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 140,
    isPerkMachine: true, perkId: 'jugger_nog', secret: true,
  },
  perk_quick_revive: {
    name: 'Quick Revive', cost: 10, hp: 130, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 130,
    isPerkMachine: true, perkId: 'quick_revive', secret: true,
  },
  perk_speed_cola: {
    name: 'Speed Cola', cost: 9, hp: 130, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 120,
    isPerkMachine: true, perkId: 'speed_cola', secret: true,
  },
  perk_stamin_up: {
    name: 'Stamin-Up', cost: 9, hp: 130, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 120,
    isPerkMachine: true, perkId: 'stamin_up', secret: true,
  },
  perk_deadshot_daiquiri: {
    name: 'Deadshot Daiquiri', cost: 11, hp: 130, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 130,
    isPerkMachine: true, perkId: 'deadshot_daiquiri', secret: true,
  },
  perk_elemental_pop: {
    name: 'Elemental Pop', cost: 12, hp: 135, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 135,
    isPerkMachine: true, perkId: 'elemental_pop', secret: true,
  },
  perk_phd_flopper: {
    name: 'PhD Flopper', cost: 11, hp: 135, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 135,
    isPerkMachine: true, perkId: 'phd_flopper', secret: true,
  },
  perk_melee_macchiato: {
    name: 'Melee Macchiato', cost: 10, hp: 130, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 125,
    isPerkMachine: true, perkId: 'melee_macchiato', secret: true,
  },
  perk_vulture_aid: {
    name: 'Vulture Aid', cost: 10, hp: 130, cover: 0.2, radius: 16,
    blocksMove: false, blocksLOS: false, buildTime: 125,
    isPerkMachine: true, perkId: 'vulture_aid', secret: true,
  },
  perk_tombstone: {
    name: 'Tombstone', cost: 14, hp: 150, cover: 0.25, radius: 18,
    blocksMove: false, blocksLOS: false, buildTime: 150,
    isPerkMachine: true, perkId: 'tombstone', secret: true,
  },
};

/** All flanks unlocked by wave progression (pool for random selection each wave). */
function getUnlockedAttackSides(waveNum) {
  const extra = Math.min(ATTACK_SIDES.length - 1, Math.floor(waveNum / ATTACK_SIDE_INTERVAL));
  return ATTACK_SIDES.slice(0, 1 + extra);
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
  if (!mentorType) return true;
  return units.some(u =>
    u.team === 'player' && u.hp > 0 && u.type === mentorType && isMaxLevelVeteran(u)
  );
}

function getAcademyBuildBlockReason(type, waveNum, units) {
  const def = BuildDefs[type];
  if (!def?.isAcademy) return null;
  if (def.academyWaveInterval && waveNum % def.academyWaveInterval !== 0) {
    return `This academy can only be founded on waves divisible by ${def.academyWaveInterval}.`;
  }
  if (!hasAcademyMentorOnField(type, units)) {
    const mentorType = getAcademyMentorUnitType(type);
    const name = getPlayerUnitDef(mentorType)?.name || formatUnitTypeName(mentorType);
    const rank = getMaxVeteranRankName(mentorType);
    return `Need a max-level ${name} (${rank}) on the field to found this academy.`;
  }
  if (def.requiresPromotableFootman) {
    if (units.some(u => u.team === 'player' && u.isGeneral && u.hp > 0)) {
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

/** Footman completed a full gold-star cycle (honor granted); vetGold resets after that. */
function footmanEligibleForGeneral(u) {
  return u?.team === 'player' && u.hp > 0 && u.type === 'footman' &&
    ((u.vetTier || 0) >= 1 || !!u.honorName);
}

function findPromotableFootman(units) {
  let best = null, bestScore = -1;
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
const RETREAT_HP_RATIO = 0.38;

const CourierMessages = {
  reinforce:  { name: 'Request Reinforcements', cost: 3, desc: 'King sends 2 footmen next round' },
  decree:     { name: 'Royal Decree',           cost: 2, desc: '+5 morale to all troops' },
  levy:       { name: 'Tax Levy',               cost: 0, desc: '+6 TP at start of next round' },
  banner:     { name: 'Call the Banner',        cost: 5, desc: 'Summon 1 knight immediately' },
  supplies:   { name: 'Supply Train',           cost: 3, desc: 'Heal all allies 25 HP' },
  truce:      { name: 'Offer Truce',            cost: 4, desc: 'Delay spawns; +8 morale all troops' },
  evacuate:   { name: 'Medical Evac',           cost: 4, desc: 'Wounded allies retreat to med tents' },
};

const SpyActions = {
  steal:      { name: 'Steal War Chest',      cost: 4, desc: '+4 TP, enemy loses 2 units next wave' },
  disrupt:    { name: 'Disrupt Supply Lines', cost: 5, desc: 'Next wave -35% enemy count' },
  assassin:   { name: 'Assassinate Captain',  cost: 6, desc: 'No elite enemies next wave' },
  scout:      { name: 'Scout Report',         cost: 2, desc: 'Exact next wave roster revealed' },
  poison:     { name: 'Poison Caches',        cost: 4, desc: 'Next wave enemies -20% HP' },
  sabotage:   { name: 'Sabotage Siege',       cost: 5, desc: 'Delay enemy spawns 2 seconds' },
  infiltrate: { name: 'Deep Infiltration',    cost: 3, desc: 'Exact roster + flank directions' },
  bribery:    { name: 'Bribe Informant',      cost: 6, desc: '50% chance -3 foes; reveals flanks' },
};

const Abilities = {
  fireball:   { name: 'Fireball Barrage', cost: 9, damage: 80, radius: 60 },
  lightning:  { name: 'Lightning Strike', cost: 6, damage: 55, radius: 50 },
  heal:       { name: 'Healing Rain',     cost: 6, healAmount: 35, radius: 150 },
  reinforce:  { name: 'Reinforcements',   cost: 12, units: ['footman', 'footman', 'archer'] },
  rally:      { name: 'Battle Rally',     cost: 6, moraleBoost: 8, duration: 300 },
};

const ELITE_ENEMIES = ['dark_knight', 'war_chief', 'troll', 'siege_tower', 'necromancer', 'berserker', 'assassin'];

const MONSTER_ENEMIES = ['abomination', 'behemoth', 'iron_colossus', 'void_stalker', 'elder_wyrm'];

function isEliteEnemy(unit) {
  return !!unit && unit.team === 'enemy' && ELITE_ENEMIES.includes(unit.type);
}

function isMonsterEnemy(unit) {
  return !!unit && unit.team === 'enemy' && MONSTER_ENEMIES.includes(unit.type);
}

function isNamedBoss(unit) {
  return !!(unit && unit.team === 'enemy' && (unit.isNamedBoss || EnemyDefs[unit.type]?.isNamedBoss));
}

const VET_STAR_COLORS = { bronze: '#b87333', silver: '#c8c8d8', gold: '#ffd700' };

const HONOR_NAME_POOL = [
  'Gwyn', 'Aldric', 'Elara', 'Brenna', 'Cador', 'Rhys', 'Isolde', 'Percival',
  'Mira', 'Owain', 'Branwen', 'Tomas', 'Yseult', 'Emrys', 'Catrin', 'Gareth',
  'Morwen', 'Llew', 'Angharad', 'Drystan', 'Eira', 'Huw', 'Seren', 'Ivor',
];

const HONOR_PREFIX_BY_TYPE = {
  footman:  ['Syr', 'Dame', 'Captain'],
  archer:   ['Syr', 'Ranger', 'Dame'],
  mage:     ['Magister', 'Syr', 'Dame'],
  cavalry:  ['Syr', 'Dame', 'Lord'],
  healer:   ['Sister', 'Brother', 'Dame'],
  builder:  ['Master', 'Syr', 'Craftlord'],
  courier:  ['Dispatch', 'Syr', 'Rider'],
  sapper:   ['Syr', 'Sapper-Captain', 'Dame'],
  knight:   ['Syr', 'Dame', 'Lord'],
  general:  ['Lord Marshal', 'Syr', 'High Commander'],
};

function hashUnitId(id) {
  const sid = String(id || '');
  let h = 0;
  for (let i = 0; i < sid.length; i++) h = (h * 31 + sid.charCodeAt(i)) >>> 0;
  return h;
}

function honorPoolIndex(h, poolLen) {
  return ((h >>> 4) % poolLen + poolLen) % poolLen;
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
  if (!unit?.id || (unit.honorName && isValidHonorName(unit.honorName))) return unit?.honorName || null;
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

/** Earn bronze stars from kills/survival; 3 bronze → 1 silver → 1 gold → veteran upgrade. */
function addVetStar(unit, tier = 'bronze') {
  if (unit.team !== 'player') return null;

  if (tier === 'bronze') {
    unit.vetBronze = (unit.vetBronze || 0) + 1;
    if (unit.vetBronze >= 3) {
      unit.vetBronze = 0;
      return addVetStar(unit, 'silver') || 'silver';
    }
    return 'bronze';
  }

  if (tier === 'silver') {
    unit.vetSilver = (unit.vetSilver || 0) + 1;
    if (unit.vetSilver >= 3) {
      unit.vetSilver = 0;
      return addVetStar(unit, 'gold') || 'gold';
    }
    return 'silver';
  }

  if (tier === 'gold') {
    unit.vetGold = (unit.vetGold || 0) + 1;
    if (unit.vetGold >= 3) {
      const honored = grantHonorName(unit);

      if (unit.isGeneral) {
        unit.generalStars = (unit.generalStars || 0) + 1;
        resetVetStars(unit);
        return honored ? 'honored_general_star' : 'general_star';
      }

      resetVetStars(unit);
      upgradeVeteranUnit(unit);
      return honored ? 'honored_upgrade' : 'upgrade';
    }
    return 'gold';
  }

  return null;
}

function isSpecialistUnit(unit) {
  return unit?.team === 'player' && ['healer', 'builder', 'courier'].includes(unit.type);
}

/** Specialists earn one star step per wave when they heal, build, or dispatch. */
function trySpecialistRank(unit) {
  if (!isSpecialistUnit(unit) || unit.specialistRankedThisWave) return null;
  unit.specialistRankedThisWave = true;
  return addVetStar(unit);
}

function getBuilderBuildTicks(unit, repairing = false) {
  let mult = unit.buildSpeedMult || 1;
  if (typeof Game !== 'undefined' && Game.isNightPhase?.()) {
    const wave = Game.getState?.()?.wave ?? 0;
    const nightProg = Game.getState?.()?.nightProgress ?? 0;
    const nightMult = typeof GameDepth !== 'undefined'
      ? GameDepth.getNightBuildMult(wave, nightProg * NIGHT_PREP_TICKS, NIGHT_PREP_TICKS)
      : NIGHT_BUILD_MULT;
    mult *= nightMult;
  }
  if (repairing) mult *= 0.52;
  return Math.max(1, Math.round(mult + (unit.vetTier || 0) * 0.25));
}

function upgradeVeteranUnit(unit) {
  unit.vetTier = (unit.vetTier || 0) + 1;
  const t = unit.vetTier;
  const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;

  if (unit.type === 'healer') {
    unit.maxHp = Math.floor(unit.maxHp * (1.18 + t * 0.05));
    unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
    unit.healAmount = Math.floor(unit.healAmount * (1.28 + t * 0.06));
    unit.range = Math.floor(unit.range * (1.1 + t * 0.03));
    unit.speed = Math.round(unit.speed * (1.06 + t * 0.02) * 100) / 100;
    unit.maxMorale = Math.min(40, unit.maxMorale + 5);
    unit.morale = Math.min(unit.maxMorale, unit.morale + 8);
  } else if (unit.type === 'builder') {
    unit.maxHp = Math.floor(unit.maxHp * (1.2 + t * 0.05));
    unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
    unit.buildRange = Math.floor(unit.buildRange * (1.14 + t * 0.04));
    unit.buildSpeedMult = (unit.buildSpeedMult || 1) * (1.2 + t * 0.05);
    unit.speed = Math.round(unit.speed * (1.1 + t * 0.03) * 100) / 100;
    unit.damage = Math.floor(unit.damage * (1.15 + t * 0.03));
    unit.maxMorale = Math.min(40, unit.maxMorale + 4);
    unit.morale = Math.min(unit.maxMorale, unit.morale + 6);
  } else if (unit.type === 'courier') {
    unit.maxHp = Math.floor(unit.maxHp * (1.15 + t * 0.04));
    unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
    unit.speed = Math.round(unit.speed * (1.14 + t * 0.04) * 100) / 100;
    unit.courierCooldownMult = (unit.courierCooldownMult || 1) * (0.86 - t * 0.02);
    unit.maxMorale = Math.min(40, unit.maxMorale + 3);
    unit.morale = Math.min(unit.maxMorale, unit.morale + 5);
  } else {
    unit.maxHp = Math.floor(unit.maxHp * (1.24 + t * 0.04));
    unit.hp = Math.max(1, Math.floor(unit.maxHp * hpRatio));
    unit.damage = Math.floor(unit.damage * (1.2 + t * 0.03));
    unit.speed = Math.round(unit.speed * (1.1 + t * 0.02) * 100) / 100;
    unit.accuracy = Math.min(68, unit.accuracy + 5 + t * 2);
    if (unit.meleeRange) unit.meleeRange = Math.floor(unit.meleeRange * (1.05 + t * 0.01));
    if (unit.baseRange) {
      unit.baseRange = Math.floor(unit.baseRange * (1.05 + t * 0.01));
      if (!unit.garrisoned) unit.range = unit.baseRange;
    }
    unit.maxMorale = Math.min(40, unit.maxMorale + 4);
    unit.morale = Math.min(unit.maxMorale, unit.morale + 6);
  }

  unit.experience = (unit.experience || 0) + 5;
  return unit;
}

function formatUnitTypeName(type) {
  if (!type) return 'Unit';
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getUnitTypeName(unit) {
  if (!unit) return 'Unit';
  if (unit.bossName) return unit.bossName;
  if (unit.team === 'enemy' && EnemyDefs[unit.type]) {
    return EnemyDefs[unit.type].bossName || EnemyDefs[unit.type].name;
  }
  if (unit.isWwe && typeof WweDefs !== 'undefined' && WweDefs[unit.type]) return WweDefs[unit.type].name;
  return getPlayerUnitDef(unit.type)?.name || UnitDefs[unit.type]?.name || formatUnitTypeName(unit.type);
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
    return (unit.generalStars || 0) > 0
      ? `General (${unit.generalStars}★ command)`
      : 'General';
  }
  const vet = getVeteranLabel(unit);
  if (vet) return vet;
  return getUnitTypeName(unit);
}

function getUnitDisplayName(unit) {
  if (!unit) return 'Unit';
  if (unit.honorName) {
    if (!isValidHonorName(unit.honorName)) repairHonorName(unit);
    if (isValidHonorName(unit.honorName)) return unit.honorName;
  }
  return getUnitTypeName(unit);
}

function unitDisplayName(unit) {
  return getUnitDisplayName(unit);
}

const EnemyDefs = {
  goblin:        { name: 'Goblin',        hp: 40,  accuracy: 20, damage: 12, range: 20,  meleeRange: 20, speed: 0.7, type: 'melee',  reward: 0, morale: 8 },
  orc:           { name: 'Orc',           hp: 80,  accuracy: 25, damage: 20, range: 24,  meleeRange: 24, speed: 0.5, type: 'melee',  reward: 0, morale: 12 },
  orc_archer:    { name: 'Orc Archer',    hp: 55,  accuracy: 30, damage: 18, range: 180, meleeRange: 25, speed: 0.4, type: 'ranged', projectile: 'arrow', reward: 0, morale: 10 },
  dark_knight:   { name: 'Dark Knight',   hp: 150, accuracy: 35, damage: 35, range: 26,  meleeRange: 26, speed: 0.4, type: 'melee',  reward: 0, morale: 20 },
  warg_rider:    { name: 'Warg Rider',    hp: 90,  accuracy: 28, damage: 28, range: 26,  meleeRange: 26, speed: 0.9, type: 'melee',  reward: 0, morale: 14 },
  dark_mage:     { name: 'Dark Mage',     hp: 45,  accuracy: 40, damage: 35, range: 170, meleeRange: 25, speed: 0.35,type: 'ranged', projectile: 'bolt', reward: 0, morale: 10 },
  troll:         { name: 'Troll',         hp: 200, accuracy: 22, damage: 40, range: 30,  meleeRange: 30, speed: 0.3, type: 'melee',  reward: 0, morale: 18 },
  goblin_sapper: { name: 'Goblin Sapper', hp: 35,  accuracy: 15, damage: 50, range: 20,  meleeRange: 20, speed: 0.8, type: 'melee',  reward: 0, morale: 6 },
  necromancer:   { name: 'Necromancer',   hp: 60,  accuracy: 35, damage: 25, range: 150, meleeRange: 25, speed: 0.3, type: 'ranged', projectile: 'bolt', reward: 0, morale: 15 },
  berserker:     { name: 'Berserker',     hp: 110, accuracy: 25, damage: 45, range: 24,  meleeRange: 24, speed: 0.65,type: 'melee',  reward: 0, morale: 25 },
  assassin:      { name: 'Assassin',      hp: 50,  accuracy: 45, damage: 55, range: 22,  meleeRange: 22, speed: 0.85,type: 'melee',  reward: 0, morale: 12 },
  shaman:        { name: 'Shaman',        hp: 55,  accuracy: 30, damage: 15, range: 130, meleeRange: 25, speed: 0.4, type: 'healer', healAmount: 15, reward: 0, morale: 14 },
  siege_tower:   { name: 'Siege Tower',   hp: 250, accuracy: 20, damage: 30, range: 140, meleeRange: 30, speed: 0.2, type: 'siege',  projectile: 'arrow', reward: 0, morale: 30 },
  goblin_engineer:{ name: 'Goblin Engineer',hp: 50, accuracy: 10, damage: 8, range: 50, meleeRange: 20, speed: 0.5, type: 'builder', reward: 0, morale: 8 },
  war_chief:     { name: 'War Chief',     hp: 180, accuracy: 38, damage: 38, range: 26,  meleeRange: 26, speed: 0.45,type: 'melee',  reward: 0, morale: 25 },
};

const Waves = [
  { count: 4,  pool: ['goblin','goblin','orc'], interval: 110 },
  { count: 6,  pool: ['goblin','orc','orc_archer'], interval: 95 },
  { count: 7,  pool: ['orc','goblin','warg_rider'], interval: 90 },
  { count: 8,  pool: ['orc','orc_archer','goblin_sapper'], interval: 85 },
  { count: 9,  pool: ['orc','dark_mage','goblin'], interval: 80 },
  { count: 10, pool: ['troll','orc','goblin_sapper','orc_archer'], interval: 75 },
  { count: 11, pool: ['berserker','orc','warg_rider','dark_mage'], interval: 70 },
  { count: 12, pool: ['necromancer','dark_knight','assassin','orc_archer'], interval: 65 },
  { count: 13, pool: ['siege_tower','troll','shaman','goblin_engineer','orc'], interval: 60 },
  { count: 16, pool: ['war_chief','dark_knight','necromancer','siege_tower','berserker','assassin'], interval: 50, boss: true },
];

/**
 * Wave scaling centered on Academy Era (wave 100).
 * Pre-100: smooth climb; wave 100 is the difficulty/variety peak before RTS escalation.
 */
function getWaveConfig(waveNum) {
  const idx = Math.min(Math.max(0, waveNum - 1), Waves.length - 1);
  const base = Waves[idx];
  const eased = academyEase(waveNum);
  const post = postAcademyProgress(waveNum);

  const pool = [...base.pool];
  if (waveNum >= 4) pool.push('goblin_sapper', 'orc_archer');
  if (waveNum >= 6) pool.push('dark_mage', 'warg_rider');
  if (waveNum >= 7) pool.push('siege_tower');
  if (waveNum >= 8) pool.push('troll', 'berserker');
  if (waveNum >= 10) pool.push('dark_knight', 'necromancer', 'assassin', 'siege_tower');
  if (waveNum >= 12) pool.push('shaman', 'goblin_engineer', 'war_chief');
  if (waveNum >= 15) pool.push('siege_tower', 'siege_tower', 'goblin_sapper');
  if (waveNum >= 20) pool.push('war_chief', 'berserker', 'siege_tower');

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
  const samples = Array.from({ length: sampleSize }, () =>
    cfg.pool[Math.floor(Math.random() * cfg.pool.length)]
  );
  return [...new Set(samples.map(t => EnemyDefs[t]?.name || t))].join(', ');
}

const ENEMY_SPRITE_MAP = {
  orc_archer: 'orc_archer', goblin: 'goblin', orc: 'orc', dark_knight: 'dark_knight',
  warg_rider: 'cavalry', dark_mage: 'mage', troll: 'orc', goblin_sapper: 'goblin',
  necromancer: 'mage', berserker: 'orc', assassin: 'goblin', shaman: 'healer',
  siege_tower: 'dark_knight', goblin_engineer: 'goblin', war_chief: 'dark_knight',
};

function createUnit(type, x, y, team, opts = {}) {
  const def = team === 'player' ? getPlayerUnitDef(type) : EnemyDefs[type];
  if (!def) return null;

  const spriteType = team === 'enemy'
    ? (ENEMY_SPRITE_MAP[type] || type)
    : ((typeof isRosterUnit === 'function' && isRosterUnit(type)) ? 'knight' : type);

  return {
    id: Math.random().toString(36).slice(2, 9),
    type, spriteType, team,
    x, y,
    targetX: x,
    targetY: team === 'player' ? DEFAULT_RALLY_Y : y,
    hp: def.hp, maxHp: def.hp,
    accuracy: def.accuracy, damage: def.damage,
    range: def.range, baseRange: def.range, meleeRange: def.meleeRange,
    speed: def.speed, combatType: def.type,
    projectile: def.projectile || null,
    healAmount: def.healAmount || 0,
    morale: def.morale || 10, maxMorale: def.morale || 10,
    experience: def.experience || 0, reward: def.reward || 0,
    buildRange: def.buildRange || 0,
    canHunt: def.canHunt !== false && def.type !== 'healer' && def.type !== 'builder' && def.type !== 'courier' && def.type !== 'general',
    huntMode: def.canHunt !== false && def.type !== 'healer' && def.type !== 'builder' && def.type !== 'courier' && def.type !== 'general',
    isWwe: typeof isWweUnit === 'function' && isWweUnit(type),
    isCrossover: typeof isCrossoverUnit === 'function' && isCrossoverUnit(type),
    isDoomslayer: !!(def.isDoomslayer || type === 'doomslayer_hero'),
    wweAbility: def.ability || null,
    wweColor: def.color || null,
    combatTag: def.combatTag || def.type || null,
    perks: [],
    attackSpeedMult: 1,
    manualOrder: false,
    path: [],
    pathIndex: 0,
    pathRecalc: 0,
    pathTargetId: null, combatTargetId: null,
    rotation: team === 'player' ? -90 : 90,
    frame: 0, frameTimer: 0,
    animState: 'idle', attackAnimTimer: 0,
    actionTimer: Math.floor(Math.random() * 50),
    pinned: false, fleeing: false, demoralized: false, witnessDeaths: 0, wounded: false, pinTimer: 0,
    building: null, buildQueue: def.type === 'builder' ? [] : null, buildProgress: 0,
    courierReady: true,
    garrisoned: null, siegeDeployed: false, linkedWallId: null, healerFleeing: false,
    chargeTimer: 0, rallyTimer: 0,
    vetBronze: 0, vetSilver: 0, vetGold: 0, vetTier: 0,
    specialistRankedThisWave: false,
    buildSpeedMult: 1, courierCooldownMult: 1,
    stationedKeep: null, generalAliveTimer: 0, generalStars: 0, isGeneral: def.type === 'general',
    rallyTargetId: null, w2wBuffTimer: 0, rallyCooldown: 0,
    honorName: null, honorTitleWave: null,
    wallGarrisoned: null, wallSlotIndex: null,
    retreatingToMed: null, atMedicalTent: null, fightToDeath: false,
    spawnSide: opts.spawnSide || null,
    spawnWave: opts.spawnWave ?? 0,
    tenureApplied: 0,
    siegeMult: def.siegeMult || 1,
    flying: !!def.flying,
    burrower: !!def.burrower,
    burrowed: false,
    burrowTimer: 0,
    summoner: !!def.summoner,
    summonTimer: def.summonCooldown || 0,
    summonType: def.summonType || 'goblin',
    summonCooldown: def.summonCooldown || 280,
    antiAir: !!def.antiAir,
    antiCavalry: !!def.antiCavalry,
    moraleAuraUnit: def.moraleAuraUnit || 0,
    revealsStealth: !!def.revealsStealth,
    spriteScale: def.spriteScale || 1,
    isNamedBoss: !!def.isNamedBoss,
    bossName: def.bossName || null,
    bossTitle: def.bossTitle || null,
    altitude: def.flying ? 1 : 0,
    enrageTimer: 0,
    frostTimer: 0,
    flareMarked: 0,
    hasDoubleTap: false,
    hasSleight: false,
  };
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
    case 'north': pts = [{ x: x - spread, y: y + inset }, { x: x + spread, y: y + inset }]; break;
    case 'south': pts = [{ x: x - spread, y: y - inset }, { x: x + spread, y: y - inset }]; break;
    case 'east':  pts = [{ x: x - inset, y: y - spread }, { x: x - inset, y: y + spread }]; break;
    case 'west':  pts = [{ x: x + inset, y: y - spread }, { x: x + inset, y: y + spread }]; break;
    default:      pts = [{ x: x - spread, y: y }, { x: x + spread, y: y }];
  }
  return pts.map(p => ({ slotX: p.x, slotY: p.y, unitId: null }));
}

function getKeepGeneralSlot(keep) {
  return {
    x: keep.slotX ?? keep.x + KEEP_GENERAL_SLOT_DX,
    y: keep.slotY ?? keep.y + KEEP_GENERAL_SLOT_DY,
  };
}

function createBuilding(type, x, y, owner, opts = {}) {
  const def = BuildDefs[type];
  const slotX = def.isKeep
    ? (opts.slotX ?? x + KEEP_GENERAL_SLOT_DX)
    : (opts.slotX ?? x);
  const slotY = def.isKeep
    ? (opts.slotY ?? y + KEEP_GENERAL_SLOT_DY)
    : (opts.slotY ?? y - 14);
  return {
    id: Math.random().toString(36).slice(2, 9),
    type, x, y, owner,
    hp: def.hp, maxHp: def.hp,
    cover: def.cover, radius: def.radius,
    blocksMove: def.blocksMove, blocksLOS: def.blocksLOS,
    moraleAura: def.moraleAura || 0,
    rangeBonus: def.rangeBonus || 0,
    wallProtection: def.wallProtection || 0,
    garrisonUnitId: null, generalUnitId: null,
    siegeTowerId: null, isKeep: def.isKeep || false,
    isMedical: def.isMedical || false, isMessHall: def.isMessHall || false,
    isAcademy: def.isAcademy || false, academyUnit: def.academyUnit || null,
    isHamlet: def.isHamlet || false, isMerchantGuild: def.isMerchantGuild || false,
    isSettlement: def.isSettlement || false, isWweAcademy: def.isWweAcademy || false,
    isCrossoverBarracks: def.isCrossoverBarracks || false,
    crossoverFaction: def.crossoverFaction || null,
    isPerkMachine: def.isPerkMachine || false, perkId: def.perkId || null,
    isWatchtower: def.isWatchtower || false,
    visionRadius: def.visionRadius || 0,
    isTrap: def.isTrap || false,
    trapDamage: def.trapDamage || 0,
    trapCooldown: 0,
    isResourceGen: def.isResourceGen || false,
    tpPerRound: def.tpPerRound || 0,
    isFortressUpgrade: def.isFortressUpgrade || false,
    fortressTier: def.fortressTier || 0,
    waveBuildRequired: def.waveBuildTime || 0, waveBuildProgress: 0,
    hamletAuraRadius: def.hamletAuraRadius || HAMLET_AURA_RADIUS,
    healRate: def.healRate || 0,
    facing: opts.facing || def.facing || 'north',
    slotX,
    slotY,
    castleGroup: opts.castleGroup || null,
    wallSlots: type === 'wall'
      ? getWallSlotPositions(opts.facing || def.facing || 'north', x, y)
      : null,
    buildTime: def.buildTime, buildProgress: 0, complete: false,
  };
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