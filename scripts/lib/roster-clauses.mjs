/**
 * Plain-language wording for every roster mechanic an operative or champion can carry.
 *
 * The profiles in data/roster-profiles.json are written with these clauses, and
 * scripts/test-roster.mjs checks that each profile's text still contains the clause for
 * every mechanic it carries, so the numbers a player reads are the numbers the engine uses.
 */

/** Enemy groups a `vsType` bonus can name. A profile's vsType must match one group exactly. */
export const VS_GROUPS = {
  horde: {
    label: 'goblins and plague rats',
    types: [
      'goblin',
      'goblin_sapper',
      'goblin_burrower',
      'goblin_engineer',
      'goblin_firebrand',
      'plague_rat',
    ],
  },
  siege: {
    label: 'siege towers, iron colossi and hellmortars',
    types: ['siege_tower', 'iron_colossus', 'hellmortar_pack'],
  },
  casters: {
    label: 'dark mages, necromancers, summoners, prophets and shamans',
    types: ['dark_mage', 'necromancer', 'bone_summoner', 'warp_prophet', 'shaman'],
  },
  undead: {
    label: 'necromancers, bone summoners, wraiths, revenants and abominations',
    types: ['necromancer', 'bone_summoner', 'wailing_wraith', 'grim_revenant', 'abomination'],
  },
  riders: {
    label: 'dark knights, warg riders and nightmare striders',
    types: ['dark_knight', 'warg_rider', 'nightmare_strider'],
  },
  flyers: {
    label: 'harpies, drakes, wyrms and wraiths',
    types: ['harpy', 'sky_drake', 'elder_wyrm', 'wailing_wraith'],
  },
};

const pct = (x) => `${Math.round(x * 100)}%`;
const more = (mult) => `+${Math.round((mult - 1) * 100)}%`;
const less = (mult) => `${Math.round((1 - mult) * 100)}%`;
const num = (x) => String(Math.round(x * 100) / 100);
const secs = (ticks) => {
  const s = Math.round((ticks / 60) * 10) / 10;
  return s === 1 ? '1 second' : `${s} seconds`;
};
const nth = (n) => (n === 2 ? 'second' : n === 3 ? 'third' : `${n}th`);

export function vsGroupOf(vsType) {
  const keys = Object.keys(vsType).sort().join(',');
  for (const [id, g] of Object.entries(VS_GROUPS)) {
    if ([...g.types].sort().join(',') !== keys) continue;
    const mult = vsType[g.types[0]];
    if (g.types.every((t) => vsType[t] === mult)) return { id, label: g.label, mult };
  }
  return null;
}

/** One clause per mechanic key. Keys that operatives and champions never carry are absent. */
export const CLAUSES = {
  farShot: (v) => `${more(v.mult)} damage to targets more than ${v.min} away`,
  closeWeak: (v) => `Deals ${less(v.mult)} less damage to enemies within ${v.within}.`,
  splashEvery: (v) =>
    `${v.n === 1 ? 'every hit' : `every ${nth(v.n)} hit`} also deals ${pct(v.pct)} of its damage to up to 6 enemies within ${v.r} of the target`,
  runDown: (v) => `${more(v)} damage to line-breakers and routing enemies`,
  dressing: (v) => `allies within ${v.r} recover ${num(v.pct * 100)}% of their health each second`,
  bulwarkAura: (v) => `allies within ${v.r} take 10% less damage`,
  dodgeRanged: (v) => `dodges ${pct(v)} of arrows and bolts`,
  spotAura: (v) => `ranged allies within ${v.r} deal 12% more damage`,
  songAura: (v) => `allies within ${v.r} regain ${num(v.morale)} morale each second`,
  bossBane: (v) => `${more(v)} damage to bosses, monsters and elites`,
  reflectCharge: (v) => `riders and beasts that strike in melee take ${pct(v)} of the blow back`,
  vsType: (v) => {
    const g = vsGroupOf(v);
    return g ? `${more(g.mult)} damage to ${g.label}` : null;
  },
  cleave: (v) =>
    `each attack also deals ${pct(v.pct)} of its damage to one more enemy within ${v.r} of the target`,
  flatResist: (v) => `takes ${pct(v)} less damage`,
  thorns: (v) => `melee attackers take ${num(v)} damage for each blow they land`,
  pounceEach: (v) => `the first hit on each new target deals ${more(v)} damage`,
  backstab: (v) => `${more(v)} damage when striking from behind`,
  hex: (v) => `enemies hit deal ${pct(v.pct)} less damage for ${secs(v.ticks)}`,
  plague: (v) => `hits leave a wound that deals ${num(v.dps)} damage a second for ${secs(v.ticks)}`,
  bloodRage: (v) => `${more(v)} damage while below half health`,
  killCheer: (v) => `each kill gives allies within ${v.r} +${num(v.morale)} morale`,
  regen: (v) => `recovers ${num(v * 100)}% of own health each second`,
  armourVsRanged: (v) => `takes ${less(v)} less damage from ranged attacks`,
  noPin: () => 'cannot be pinned',
  frail: (v) => `Takes ${more(v).slice(1)} more damage.`,
  dirgeAura: (v) => `enemies within ${v.r} lose ${num(v.morale)} morale each second`,
  lifesteal: (v) => `heals for ${pct(v)} of the damage dealt`,
  execute: (v) => `${more(v.mult)} damage to targets below ${pct(v.below)} health`,
  lastStand: (v) => `takes ${pct(v.resist)} less damage while below ${pct(v.below)} health`,
  guard: (v) => `takes on ${pct(v.pct)} of the damage dealt to allies within ${v.r}`,
  killHeal: (v) => `each kill restores ${pct(v)} of own health`,
  ramp: (v) =>
    `each consecutive hit on the same target deals ${pct(v.per)} more, up to +${pct(v.max)}`,
  stagger: (v) =>
    `the first hit on each new target pins it for ${secs(v)} (not bosses, monsters or elites)`,
  expose: (v) =>
    `enemies hit take ${pct(v.pct)} more damage from every source for ${secs(v.ticks)}`,
};

/** Mechanics whose clause is a weakness sentence rather than part of the trait. */
export const WEAK_KEYS = ['closeWeak', 'frail'];

/** The profile's mechanics, without its three text fields. */
export function mechanicsOf(profile) {
  const { role: _r, trait: _t, weak: _w, ...mech } = profile;
  return mech;
}

/** Every clause a profile's text must contain, as [key, clause]. A null clause is an error. */
export function clausesFor(profile) {
  return Object.entries(mechanicsOf(profile)).map(([k, v]) => [
    k,
    CLAUSES[k] ? CLAUSES[k](v) : null,
  ]);
}

/**
 * A crude power estimate: how much a profile multiplies a unit's damage output, its staying
 * power and its value to the soldiers around it. The weights are rough guesses at how often
 * each condition holds in a real fight. Used by scripts/roster-power-report.mjs.
 */
export function traitFactors(profile, def) {
  const m = mechanicsOf(profile);
  let off = 1;
  let tough = 1;
  let team = 1;
  if (m.farShot) off *= 1 + (m.farShot.mult - 1) * 0.6;
  if (m.closeWeak) off *= 1 - (1 - m.closeWeak.mult) * 0.2;
  if (m.splashEvery) off *= 1 + (m.splashEvery.pct / m.splashEvery.n) * 1.2;
  if (m.cleave) off *= 1 + m.cleave.pct * 0.7;
  if (m.runDown) off *= 1 + (m.runDown - 1) * 0.15;
  if (m.bossBane) off *= 1 + (m.bossBane - 1) * 0.3;
  if (m.vsType) off *= 1 + (Object.values(m.vsType)[0] - 1) * 0.2;
  if (m.bloodRage) off *= 1 + (m.bloodRage - 1) * 0.35;
  if (m.backstab) off *= 1 + (m.backstab - 1) * 0.25;
  if (m.pounceEach) off *= 1 + (m.pounceEach - 1) * 0.3;
  if (m.execute) off *= 1 + (m.execute.mult - 1) * m.execute.below * 1.2;
  if (m.ramp) off *= 1 + m.ramp.max * 0.55;
  if (m.plague) off *= 1 + ((m.plague.dps * m.plague.ticks) / 60 / def.damage) * 0.5;
  if (m.thorns) off *= 1 + (m.thorns / def.damage) * 0.8;
  if (m.reflectCharge) off *= 1 + m.reflectCharge * 0.1;
  if (m.flatResist) tough /= 1 - m.flatResist;
  if (m.frail) tough /= m.frail;
  if (m.lastStand) tough *= 1 + m.lastStand.below * m.lastStand.resist * 1.6;
  if (m.armourVsRanged) tough /= 1 - (1 - m.armourVsRanged) * 0.35;
  if (m.dodgeRanged) tough /= 1 - m.dodgeRanged * 0.35;
  if (m.regen) tough *= 1 + m.regen * 15;
  if (m.lifesteal) tough *= 1 + m.lifesteal * 1.5;
  if (m.killHeal) tough *= 1 + m.killHeal * 1.5;
  if (m.noPin) tough *= 1.03;
  if (m.stagger) team *= 1 + (m.stagger / 60) * 0.06;
  if (m.hex) team *= 1 + m.hex.pct * 0.6;
  if (m.expose) team *= 1 + m.expose.pct * 1.2;
  if (m.spotAura) team *= 1.1;
  if (m.bulwarkAura) team *= 1.1;
  if (m.guard) team *= 1 + m.guard.pct * 0.4;
  if (m.dressing) team *= 1 + m.dressing.pct * 10;
  if (m.songAura) team *= 1 + m.songAura.morale * 0.05;
  if (m.killCheer) team *= 1 + m.killCheer.morale * 0.012;
  if (m.dirgeAura) team *= 1 + m.dirgeAura.morale * 0.05;
  return { off, tough, team, total: Math.sqrt(off * tough) * team };
}

/** Base power from stats alone: expected damage and health, with a premium for reach and pace. */
export function basePower(def) {
  const hit = def.damage * (def.accuracy / 100);
  const reach = 1 + Math.max(0, def.range - 40) / 600;
  return Math.sqrt(hit * def.hp) * reach * Math.pow(def.speed, 0.3);
}
