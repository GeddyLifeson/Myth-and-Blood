/**
 * Perk tonic machines — tag-based perk collection for roster heroes.
 */
const PERK_MAX = 4;

const PerkDefs = {
  jugger_nog: {
    name: 'Ironbrew',
    tags: ['melee', 'support'],
    desc: '+35% max HP, but -15% move speed',
    apply(u) {
      u.maxHp = Math.floor(u.maxHp * 1.35);
      u.hp = Math.min(u.hp, u.maxHp);
      u.speed *= 0.85;
    },
  },
  quick_revive: {
    name: 'Field Revival',
    tags: ['support'],
    desc: 'Self-revive once per wave at 40% HP, but -20% max HP',
    apply(u) {
      u.hasQuickRevive = true;
      u.maxHp = Math.floor(u.maxHp * 0.8);
      u.hp = Math.min(u.hp, u.maxHp);
    },
  },
  speed_cola: {
    name: 'Swiftstep Tonic',
    tags: ['melee', 'ranged'],
    desc: '+30% attack speed, but -10 accuracy',
    apply(u) {
      u.attackSpeedMult = (u.attackSpeedMult || 1) * 1.3;
      u.accuracy = Math.max(5, u.accuracy - 10);
    },
  },
  stamin_up: {
    name: 'Endurance Draft',
    tags: ['melee', 'ranged'],
    desc: '+18% move speed',
    apply(u) {
      u.speed *= 1.18;
    },
  },
  deadshot_daiquiri: {
    name: 'Deadeye Elixir',
    tags: ['ranged'],
    desc: '+22 accuracy',
    apply(u) {
      u.accuracy = Math.min(95, u.accuracy + 22);
    },
  },
  elemental_pop: {
    name: 'Storm Fizz',
    tags: ['ranged', 'melee'],
    desc: 'Attacks splash nearby foes, but -15% damage',
    apply(u) {
      u.hasElementalPop = true;
      u.damage = Math.floor(u.damage * 0.85);
    },
  },
  phd_flopper: {
    name: 'Impact Ward',
    tags: ['melee'],
    desc: 'Explosion immunity + retaliatory blast',
    apply(u) {
      u.hasPhdFlopper = true;
    },
  },
  melee_macchiato: {
    name: 'Brawler’s Brew',
    tags: ['melee'],
    desc: '+28% melee damage',
    apply(u) {
      if (!u.projectile) u.damage = Math.floor(u.damage * 1.28);
    },
  },
  vulture_aid: {
    name: 'Scavenger’s Tonic',
    tags: ['ranged', 'support'],
    desc: 'Kills may grant +1 TP, but -15% damage',
    apply(u) {
      u.hasVultureAid = true;
      u.damage = Math.floor(u.damage * 0.85);
    },
  },
  tombstone: {
    name: 'Last Stand',
    tags: ['support'],
    desc: 'General only: raises fallen troops each wave, but the General loses 25% max HP',
    generalOnly: true,
    apply(u) {
      u.hasTombstone = true;
      u.maxHp = Math.floor(u.maxHp * 0.75);
      u.hp = Math.min(u.hp, u.maxHp);
    },
  },
};

/** The six stations still brewed. Each tonic costs the hero something. */
const PerkBuildTypes = [
  'perk_jugger_nog',
  'perk_quick_revive',
  'perk_speed_cola',
  'perk_elemental_pop',
  'perk_vulture_aid',
  'perk_tombstone',
];

/** No longer built; stations already standing in old saves keep working. */
const RETIRED_STATIONS = new Set([
  'perk_stamin_up',
  'perk_deadshot_daiquiri',
  'perk_phd_flopper',
  'perk_melee_macchiato',
  'perk_double_tap',
  'perk_mule_kick',
  'perk_sleight',
]);

function isRetiredStation(type) {
  return RETIRED_STATIONS.has(type);
}

function perkMachinesUnlocked() {
  if (typeof MetaProgress === 'undefined') return false;
  return (
    MetaProgress.isChampionsUnlocked?.() ||
    MetaProgress.isAbyssWalkerUnlocked?.() ||
    MetaProgress.isAnyCompanyUnlocked?.()
  );
}

function getTotalStarCount(unit) {
  return (
    (unit.vetBronze || 0) +
    (unit.vetSilver || 0) * 3 +
    (unit.vetGold || 0) * 9 +
    (unit.generalStars || 0) * 9
  );
}

function getPerkSlots(unit) {
  if (!unit || unit.team !== 'player') return 0;
  if (!isEligibleForPerks(unit)) return 0;
  const stars = getTotalStarCount(unit);
  return Math.min(PERK_MAX, Math.max(1, stars));
}

function isEligibleForPerks(unit) {
  if (!unit || unit.hp <= 0 || unit.team !== 'player') return false;
  if (unit.isDoomslayer || unit.isWwe || unit.isCrossover) return true;
  if (unit.isGeneral) return true;
  return false;
}

function unitHasPerk(unit, perkId) {
  return (unit.perks || []).includes(perkId);
}

// A General's own tag matched no tonic, so Last Stand could never be drunk; he drinks as support.
function perkTag(unit) {
  const tag = getHeroCombatTag(unit);
  return tag === 'general' ? 'support' : tag;
}

function perkMatchesUnit(perkId, unit) {
  const def = PerkDefs[perkId];
  if (!def) return false;
  if (def.generalOnly && !unit.isGeneral) return false;
  if (perkId === 'tombstone' && !unit.isGeneral) return false;
  const tag = perkTag(unit);
  return def.tags.includes(tag);
}

function scorePerkForUnit(perkId, unit) {
  if (!perkMatchesUnit(perkId, unit)) return -1;
  const def = PerkDefs[perkId];
  const tag = perkTag(unit);
  let score = 1;
  if (tag === 'melee' && perkId === 'melee_macchiato') score += 5;
  if (tag === 'melee' && perkId === 'jugger_nog') score += 3;
  if (tag === 'ranged' && perkId === 'deadshot_daiquiri') score += 5;
  if (tag === 'ranged' && perkId === 'vulture_aid') score += 2;
  if (tag === 'support' && (perkId === 'quick_revive' || perkId === 'jugger_nog')) score += 4;
  if (unit.isGeneral && perkId === 'tombstone') score += 10;
  if (def.tags[0] === tag) score += 1;
  return score;
}

function applyPerkToUnit(unit, perkId) {
  if (!unit || unitHasPerk(unit, perkId)) return false;
  const def = PerkDefs[perkId];
  if (!def) return false;
  if (!unit.perks) unit.perks = [];
  unit.perks.push(perkId);
  def.apply(unit);
  return true;
}

function findBestPerkBuilding(unit, buildings) {
  const slots = getPerkSlots(unit);
  if ((unit.perks || []).length >= slots) return null;
  let best = null,
    bestScore = -1;
  for (const b of buildings) {
    if (!b.complete || b.hp <= 0 || b.owner !== 'player' || !b.isPerkMachine) continue;
    const perkId = b.perkId;
    if (!perkId || unitHasPerk(unit, perkId)) continue;
    const score = scorePerkForUnit(perkId, unit);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return bestScore > 0 ? best : null;
}

function handleQuickRevive(unit) {
  if (!unit?.hasQuickRevive || unit._revivedThisWave) return false;
  unit._revivedThisWave = true;
  unit.hp = Math.floor(unit.maxHp * 0.4);
  unit.demoralized = false;
  unit.fleeing = false;
  if (typeof FloatingText !== 'undefined') FloatingText.heal(unit.x, unit.y, unit.hp);
  return true;
}

function applyElementalPopSplash(attacker, target, units, takeDamageFn) {
  if (!attacker?.hasElementalPop || !takeDamageFn) return;
  for (const foe of units) {
    if (foe.team !== 'enemy' || foe.hp <= 0 || foe.id === target.id) continue;
    if (Math.hypot(foe.x - target.x, foe.y - target.y) < 55) {
      takeDamageFn(foe, Math.floor(attacker.damage * 0.35));
    }
  }
}

const Perks = {
  perkMachinesUnlocked,
  getPerkSlots,
  isEligibleForPerks,
  findBestPerkBuilding,
  handleQuickRevive,
  applyElementalPopSplash,
  applyPerkToUnit,
  perkMatchesUnit,
  PerkDefs,
  PerkBuildTypes,
  isRetiredStation,
};

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Perks = Perks;
