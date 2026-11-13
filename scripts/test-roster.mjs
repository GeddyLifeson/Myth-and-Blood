/**
 * Roster: every troop and every enemy has a role, a trait and a weakness, and the
 * trait mechanics change damage the way their descriptions say.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';
import { CLAUSES, clausesFor, mechanicsOf } from './lib/roster-clauses.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb } = boot(21);
const { Roster, EnemyDefs, UnitDefs, CrossoverDefs, WweDefs, roleEntries } = vm.runInContext(
  `${code}\n({ Roster, EnemyDefs, UnitDefs, CrossoverDefs, WweDefs, roleEntries: Encyclopedia.buildRoleEntries() })`,
  vm.createContext(sb)
);

const missingEnemies = Object.keys(EnemyDefs).filter((t) => !Roster.describeType(t, 'enemy'));
ok(
  missingEnemies.length === 0,
  `every enemy has a profile (${Object.keys(EnemyDefs).length} checked) ${missingEnemies.join(',')}`
);
const troops = Object.keys(UnitDefs).filter((t) => t !== 'doomslayer_hero');
const missingTroops = troops.filter((t) => !Roster.describeType(t, 'player'));
ok(
  missingTroops.length === 0,
  `every troop has a profile (${troops.length} checked) ${missingTroops.join(',')}`
);
for (const [t, p] of Object.entries({
  ...Roster.TROOPS,
  ...Roster.ENEMIES,
  ...Roster.ARCHETYPES,
})) {
  if (!p.role || !p.trait || !p.weak) ok(false, `${t} is missing role, trait or weakness`);
}

// Every operative and champion has its own profile.
const opUnit = (type) => ({
  type,
  team: 'player',
  isCrossover: true,
  combatType: CrossoverDefs[type].type,
  range: CrossoverDefs[type].range,
  speed: CrossoverDefs[type].speed,
  maxHp: CrossoverDefs[type].hp,
});
const champUnit = (type) => ({ type, team: 'player', isWwe: true, maxHp: WweDefs[type].hp });
const groups = { champions: Object.keys(WweDefs) };
for (const [type, def] of Object.entries(CrossoverDefs)) {
  (groups[def.faction] = groups[def.faction] || []).push(type);
}
const own = (type) => Roster.PROFILES[type];
const everyone = Object.values(groups).flat();
const unprofiled = everyone.filter((t) => {
  const p = own(t);
  return !p || !p.role || !p.trait || !p.weak;
});
ok(
  unprofiled.length === 0 && everyone.length === 133,
  `every operative and champion has its own role, trait and weakness (${everyone.length} checked) ${unprofiled.join(',')}`
);
const strays = Object.keys(Roster.PROFILES).filter((t) => !CrossoverDefs[t] && !WweDefs[t]);
ok(strays.length === 0, `no profile without a unit ${strays.join(',')}`);
const notOwn = everyone.filter((t) => {
  const unit = WweDefs[t] ? champUnit(t) : opUnit(t);
  return Roster.profileOf(unit) !== own(t) || Roster.describe(unit).trait !== own(t).trait;
});
ok(notOwn.length === 0, `profileOf returns the unit's own profile ${notOwn.join(',')}`);
ok(
  Roster.describeType('kenshiro', 'player')?.role === own('kenshiro').role,
  'describeType finds an operative by type'
);

// The data may only use mechanics the engine implements, and only ones a player unit can use.
const ENEMY_ONLY = ['brace', 'swarm', 'warAura', 'wardAura', 'fearless', 'pounce', 'deathBurst'];
const badKeys = [];
for (const t of everyone) {
  for (const k of Object.keys(mechanicsOf(own(t)))) {
    if (!Roster.MECHANICS.includes(k) || ENEMY_ONLY.includes(k) || !CLAUSES[k]) {
      badKeys.push(`${t}.${k}`);
    }
  }
}
ok(badKeys.length === 0, `every mechanic in the profile data is implemented ${badKeys.join(',')}`);
const mechless = everyone.filter((t) => {
  const n = Object.keys(mechanicsOf(own(t))).length;
  return n < 1 || n > 3;
});
ok(mechless.length === 0, `every profile carries one to three mechanics ${mechless.join(',')}`);

// The text a player reads states every mechanic with the numbers the engine uses.
const untold = [];
for (const t of everyone) {
  const p = own(t);
  const text = `${p.trait} ${p.weak}`.toLowerCase();
  for (const [k, clause] of clausesFor(p)) {
    if (!clause || !text.includes(clause.toLowerCase())) untold.push(`${t}.${k}`);
  }
}
ok(untold.length === 0, `trait text matches the mechanics exactly ${untold.join(',')}`);
const PLACEHOLDER = /todo|tbd|lorem|placeholder|undefined|\bnan\b|null|\[object|xxx|\?\?|\{|\}/i;
const sloppy = everyone.filter((t) => {
  const p = own(t);
  return (
    [p.role, p.trait, p.weak].some((x) => typeof x !== 'string' || PLACEHOLDER.test(x)) ||
    !/^[A-Z][^—]+ — [A-Z+].+\.$/.test(p.trait) ||
    !/\.$/.test(p.weak) ||
    p.role.split(/\s+/).length > 3
  );
});
ok(sloppy.length === 0, `no placeholder or malformed text ${sloppy.join(',')}`);

// Faction-mates play differently: no two share the same mechanics and values, or the same role.
const twins = [];
for (const [faction, types] of Object.entries(groups)) {
  const byMech = new Map();
  const byKeys = new Map();
  for (const t of types) {
    const mech = mechanicsOf(own(t));
    const exact = JSON.stringify(Object.entries(mech).sort(([a], [b]) => a.localeCompare(b)));
    if (byMech.has(exact)) twins.push(`${faction}:${byMech.get(exact)}=${t}`);
    byMech.set(exact, t);
    const keys = Object.keys(mech).sort().join('+');
    byKeys.set(keys, (byKeys.get(keys) || 0) + 1);
  }
  const worst = Math.max(...byKeys.values());
  if (worst > 2) twins.push(`${faction}: ${worst} units share one key set`);
}
ok(twins.length === 0, `no two faction-mates share the same mechanics ${twins.join(' ')}`);

// A unit with no profile of its own (a modded operative) falls back to archetype plus signature.
const stranger = { ...opUnit(Object.keys(CrossoverDefs)[0]), type: 'modded_operative' };
stranger.faction = 'ultimis';
ok(
  Roster.describe(stranger)?.trait.includes(Roster.FACTION_SIGNATURES.ultimis.note),
  'an operative without its own profile falls back to archetype and faction signature'
);
ok(
  Roster.describe({ type: 'modded_champion', team: 'player', isWwe: true, maxHp: 200 })?.role ===
    'Champion',
  'a champion without its own profile falls back to the champion archetype'
);

// The encyclopedia lists every one of them under Roles & Counters.
const roleNames = new Set(roleEntries.map((e) => e.name));
const unlisted = everyone.filter((t) => {
  const def = CrossoverDefs[t] || WweDefs[t];
  return !roleNames.has(`${def.name} — ${own(t).role}`);
});
ok(
  unlisted.length === 0,
  `the encyclopedia lists every operative and champion profile ${unlisted.join(',')}`
);

const hurtLog = [];
const ctx = {
  tick: 100,
  units: [],
  rng: () => 0.99,
  float: () => {},
  shake: () => {},
  playSfx: () => {},
  burst: () => {},
  showMessage: () => {},
  spawnEnemy: (type) => hurtLog.push(['spawn', type]),
  unitName: (u) => u.type,
  hurt: (u, amount) => {
    hurtLog.push([u.type, Math.round(amount)]);
    u.hp -= amount;
  },
};
const mk = (type, team, x, y, extra = {}) => ({
  type,
  team,
  x,
  y,
  hp: 100,
  maxHp: 100,
  id: type + x + y,
  ...extra,
});

// Archer: stronger far away, weaker point-blank.
const archer = mk('archer', 'player', 0, 0, { range: 210 });
const far = Roster.modifyDamage(archer, mk('orc', 'enemy', 0, -180), 100, ctx);
const near = Roster.modifyDamage(archer, mk('orc', 'enemy', 0, -30), 100, ctx);
ok(far === 120 && near === 60, `archer volley and close-range weakness (${far} far, ${near} near)`);

// Cavalry runs down line-breakers.
const cav = mk('cavalry', 'player', 0, 0);
ok(
  Roster.modifyDamage(cav, mk('goblin', 'enemy', 0, -20, { lineBreaker: true }), 100, ctx) === 160,
  'cavalry runs down line-breakers'
);

// Footmen brace beside each other.
const f1 = mk('footman', 'player', 100, 100);
const f2 = mk('footman', 'player', 120, 100);
const f3 = mk('pikeman', 'player', 100, 125);
ctx.units = [f1, f2, f3];
ctx.tick = 30;
Roster.update(ctx);
const braced = Roster.modifyDamageTaken(f1, 100, { attacker: mk('orc', 'enemy', 100, 80) }, ctx);
ok(
  Math.round(braced) === 76,
  `two neighbours brace a footman (${Math.round(braced)} of 100 taken)`
);

// Dark knight plate against arrows; war chief banner; hex.
const knight = mk('dark_knight', 'enemy', 0, 0);
ok(
  Roster.modifyDamageTaken(knight, 100, { attacker: archer }, ctx) === 70,
  'plate cuts arrow damage'
);
ok(Roster.blocksPin(knight), 'dark knights cannot be pinned');
const chief = mk('war_chief', 'enemy', 300, 300);
const orc = mk('orc', 'enemy', 330, 300);
ctx.units = [chief, orc];
ctx.tick = 60;
Roster.update(ctx);
ctx.tick = 61;
ok(
  Roster.modifyDamage(orc, mk('footman', 'player', 330, 320), 100, ctx) === 115,
  'war banner strengthens nearby enemies'
);
const mage = mk('dark_mage', 'enemy', 0, 0, { range: 170 });
const victim = mk('footman', 'player', 0, 100);
Roster.modifyDamage(mage, victim, 10, ctx);
ok(
  Roster.modifyDamage(victim, mk('orc', 'enemy', 0, 110), 100, ctx) === 80,
  'a hexed soldier deals less damage'
);

// Sapper death burst, troll regrowth, boss phase.
const sapper = mk('goblin_sapper', 'enemy', 500, 500);
const bystander = mk('footman', 'player', 520, 500);
ctx.units = [sapper, bystander];
hurtLog.length = 0;
Roster.onDeath(sapper, null, ctx);
ok(
  hurtLog.some(([t]) => t === 'footman'),
  'goblin sappers burst when they die'
);
const troll = mk('troll', 'enemy', 0, 0, { hp: 50, maxHp: 200 });
const boss = mk('boss_morwen', 'enemy', 400, 0, { hp: 40, maxHp: 170 });
ctx.units = [troll, boss];
ctx.tick = 90;
hurtLog.length = 0;
Roster.update(ctx);
ok(troll.hp > 50, `trolls regrow (${troll.hp.toFixed(1)} hp)`);
ok(
  boss.phased && hurtLog.filter(([k]) => k === 'spawn').length === 6,
  'Morwen raises rats at half health'
);

// AI profiles.
ok(Roster.preference(mk('warg_rider', 'enemy', 0, 0)) === 'support', 'wargs go for support troops');
ok(Roster.preference(mk('troll', 'enemy', 0, 0)) === 'building', 'trolls go for buildings');
ok(
  Roster.kiteDistance(mk('orc_archer', 'enemy', 0, 0, { range: 185 })) > 0,
  'orc archers skirmish'
);
ok(Roster.kiteDistance(mk('orc', 'enemy', 0, 0)) === 0, 'orcs do not');

// ------------------------------------------------- operative and champion mechanics
const foe = (x, y, extra = {}) => mk('orc', 'enemy', x, y, extra);
const hero = (type, x = 0, y = 0, extra = {}) =>
  mk(type, 'player', x, y, { isCrossover: true, ...extra });
ctx.units = [];
ctx.tick = 1000;

// execute: marcus_fenix deals +40% to targets below 30% health.
const marcus = hero('marcus_fenix');
ok(
  Roster.modifyDamage(marcus, foe(0, -40, { hp: 29 }), 100, ctx) === 140 &&
    Roster.modifyDamage(marcus, foe(0, -40, { hp: 31 }), 100, ctx) === 100,
  'execute: bonus damage only below the health threshold'
);

// lifesteal: primis_richtofen heals for 10% of the damage dealt, never above full health.
const medic = hero('primis_richtofen', 0, 0, { hp: 50 });
Roster.modifyDamage(medic, foe(0, -40), 100, ctx);
const healthy = hero('primis_richtofen', 0, 0, { hp: 99 });
Roster.modifyDamage(healthy, foe(0, -40), 100, ctx);
ok(medic.hp === 60 && healthy.hp === 100, `lifesteal: heals a share of damage dealt (${medic.hp})`);

// lastStand: nikolai takes 30% less below 40% health.
const wall = hero('nikolai', 0, 0, { hp: 39 });
const fresh = hero('nikolai', 0, 0, { hp: 41 });
const blow = { attacker: foe(0, 20) };
ok(
  Roster.modifyDamageTaken(wall, 100, blow, ctx) === 70 &&
    Roster.modifyDamageTaken(fresh, 100, blow, ctx) === 100,
  'lastStand: damage reduction only below the health threshold'
);

// killHeal: giorno_giovanna restores 8% of own health on a kill.
const giver = hero('giorno_giovanna', 0, 0, { hp: 50, maxHp: 200 });
ctx.units = [giver];
Roster.onDeath(foe(0, -20, { hp: 0 }), giver, ctx);
ok(giver.hp === 66, `killHeal: a kill restores health (${giver.hp})`);

// ramp: chris_benoit gains 10% per consecutive hit on one target, up to +50%, and resets.
const ace = mk('chris_benoit', 'player', 0, 0, { isWwe: true });
const dummy = foe(0, -20, { id: 'dummy' });
const hits = [];
for (let i = 0; i < 8; i++) hits.push(Roster.modifyDamage(ace, dummy, 100, ctx));
const afterSwitch = Roster.modifyDamage(ace, foe(0, -20, { id: 'other' }), 100, ctx);
ok(
  hits.join(',') === '100,110,120,130,140,150,150,150' && afterSwitch === 100,
  `ramp: builds on one target, caps, and resets on a new one (${hits.join(',')})`
);

// stagger: jolyne_cujoh pins each new target once for 1.5 seconds; never a boss.
const snare = hero('jolyne_cujoh');
const pinned = foe(0, -20, { id: 'p1' });
Roster.modifyDamage(snare, pinned, 10, ctx);
const firstPin = pinned.pinned === true && pinned.pinTimer === 90;
pinned.pinned = false;
pinned.pinTimer = 0;
Roster.modifyDamage(snare, pinned, 10, ctx);
const bossTarget = foe(0, -20, { id: 'b1', isNamedBoss: true });
Roster.modifyDamage(snare, bossTarget, 10, ctx);
const plated = mk('dark_knight', 'enemy', 0, -20, { id: 'k1' });
Roster.modifyDamage(snare, plated, 10, ctx);
ok(
  firstPin && !pinned.pinned && !bossTarget.pinned && !plated.pinned,
  'stagger: first hit pins a new target once; bosses and unpinnable enemies are immune'
);

// expose: enemies hit by roddy_piper take 10% more from every source for 3 seconds.
const piper = mk('roddy_piper', 'player', 0, 0, { isWwe: true });
const marked = foe(0, -20, { id: 'm1' });
Roster.modifyDamage(piper, marked, 10, ctx);
const during = Roster.modifyDamageTaken(marked, 100, { attacker: archer }, ctx);
ctx.tick += 181;
const after = Roster.modifyDamageTaken(marked, 100, { attacker: archer }, ctx);
ok(
  Math.round(during) === 110 && after === 100,
  `expose: marked enemies take more damage until it wears off (${during}, ${after})`
);

// guard: dom_santiago takes on 20% of the damage dealt to allies within 50.
const dom = hero('dom_santiago', 100, 100);
const ward = mk('archer', 'player', 130, 100);
const farAlly = mk('archer', 'player', 300, 100);
ctx.units = [dom, ward, farAlly];
ctx.tick = 1200;
Roster.update(ctx);
ctx.tick = 1201;
hurtLog.length = 0;
const wardTook = Roster.modifyDamageTaken(ward, 100, { attacker: foe(130, 80) }, ctx);
const farTook = Roster.modifyDamageTaken(farAlly, 100, { attacker: foe(300, 80) }, ctx);
ok(
  wardTook === 80 &&
    farTook === 100 &&
    hurtLog.length === 1 &&
    hurtLog[0][0] === 'dom_santiago' &&
    hurtLog[0][1] === 20,
  `guard: a share of a nearby ally's damage lands on the guardian (${wardTook}, ${JSON.stringify(hurtLog)})`
);
hurtLog.length = 0;
Roster.modifyDamageTaken(ward, 100, { attacker: foe(130, 80), rosterEcho: true }, ctx);
dom.hp = 0;
const unguarded = Roster.modifyDamageTaken(ward, 100, { attacker: foe(130, 80) }, ctx);
ok(
  hurtLog.length === 0 && unguarded === 100,
  'guard: echo damage is not passed on, and a dead guardian protects no one'
);

process.exit(failures() ? 1 : 0);
