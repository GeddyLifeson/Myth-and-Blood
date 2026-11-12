/**
 * Roster: every troop and every enemy has a role, a trait and a weakness, and the
 * trait mechanics change damage the way their descriptions say.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb } = boot(21);
const { Roster, EnemyDefs, UnitDefs, CrossoverDefs, WweDefs } = vm.runInContext(
  `${code}\n({ Roster, EnemyDefs, UnitDefs, CrossoverDefs, WweDefs })`,
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

const seen = {};
for (const [type, def] of Object.entries(CrossoverDefs)) {
  const unit = {
    type,
    team: 'player',
    isCrossover: true,
    combatType: def.type,
    range: def.range,
    speed: def.speed,
    maxHp: def.hp,
  };
  const d = Roster.describe(unit);
  if (!d) ok(false, `operative ${type} has no archetype`);
  else seen[unit.rosterKey] = (seen[unit.rosterKey] || 0) + 1;
}
const factions = new Set(Object.values(CrossoverDefs).map((d) => d.faction));
const unsigned = [...factions].filter((f) => !Roster.FACTION_SIGNATURES[f]);
ok(
  unsigned.length === 0,
  `every operative faction has a signature (${factions.size} factions) ${unsigned.join(',')}`
);
const firstOp = Object.keys(CrossoverDefs)[0];
const sample = {
  type: firstOp,
  team: 'player',
  isCrossover: true,
  combatType: CrossoverDefs[firstOp].type,
  range: CrossoverDefs[firstOp].range,
  speed: CrossoverDefs[firstOp].speed,
  maxHp: CrossoverDefs[firstOp].hp,
};
ok(
  Roster.describe(sample).trait.includes(
    Roster.FACTION_SIGNATURES[CrossoverDefs[firstOp].faction].note
  ),
  'an operative shows its faction signature'
);
ok(Object.keys(seen).length >= 5, `operatives spread over archetypes: ${JSON.stringify(seen)}`);
const champ = { type: Object.keys(WweDefs)[0], team: 'player', isWwe: true, maxHp: 200 };
ok(Roster.describe(champ)?.role === 'Champion', 'champions use the champion archetype');

const hurtLog = [];
const ctx = {
  tick: 100,
  units: [],
  rng: () => 0.99,
  float: () => {},
  shake: () => {},
  playSfx: () => {},
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

process.exit(failures() ? 1 : 0);
