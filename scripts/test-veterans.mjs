/**
 * Veteran deeds, earned traits, the Hall of Veterans roll, raising the fallen, and saves.
 */
import { ok, failures } from './lib/harness.mjs';
import { bootGame } from './lib/save-test-kit.mjs';

const g = bootGame(7, {
  names: ['Veterans', 'Availability', 'GameArmy', 'MAX_VETERAN_TIER', 'SaveFormat'],
});
const { Game, GS, Veterans, Availability, GameArmy, MAX_VETERAN_TIER, SaveFormat, sb } = g;
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.creativeForceDay?.();

const cx = Game.getWorldCenter();
function soldier(type = 'footman') {
  Game.creativeSpawnPlayerAt(type, cx.x, cx.y + 40);
  const list = GS.units.filter((u) => u.team === 'player' && u.type === type);
  return list[list.length - 1];
}
const foe = (type, extra = {}) => ({ team: 'enemy', type, combatType: 'melee', hp: 10, ...extra });
const kill = (u, type, n, extra) => {
  let got = [];
  for (let i = 0; i < n; i++) got = got.concat(Veterans.recordKill(u, foe(type, extra), 5));
  return got;
};

for (const [id, t] of Object.entries(Veterans.TRAITS)) {
  const text = `${t.name} ${t.deed} ${t.gain} ${t.cost}`;
  ok(t.name && t.deed && t.gain && t.cost && t.measure, `${id} names its deed, gain and price`);
  ok(!text.includes('—'), `${id} has no em dash`);
  ok((t.fx || []).length > 0 || t.stats, `${id} changes something`);
  ok(/\d/.test(t.deed) || /^Killed /.test(t.deed), `${id} counts a concrete deed`);
}
ok(Object.keys(Veterans.TRAITS).length >= 60, 'the pool holds at least 60 traits');

const a = soldier();
ok(Veterans.slots(a) === 0, 'a recruit has no trait slot');
ok(kill(a, 'goblin', 30).length === 0, 'a deed done without a slot grants nothing yet');
sb.upgradeVeteranUnit(a);
ok(a.traits.includes('goblin_reaper'), 'rank 1 opens a slot and the earned trait fills it');
ok(Veterans.damageMult(a, foe('goblin')) === 1.25, 'Goblin-Reaper: +25% to goblins');
ok(Veterans.damageMult(a, foe('troll')) === 0.9, 'Goblin-Reaper: -10% to trolls');
ok(Veterans.damageMult(a, foe('orc')) === 1, 'Goblin-Reaper: nothing against orcs');

kill(a, 'orc', 1, { isNamedBoss: true });
ok(!a.traits.includes('giantsbane'), 'a second trait waits for a second slot');
sb.upgradeVeteranUnit(a);
ok(a.traits.includes('giantsbane'), 'rank 2 opens the second slot');
ok(Veterans.damageMult(foe('goblin'), a) === 1.1, 'Giantsbane: +10% taken from goblins');
kill(a, 'orc', 2, { isNamedBoss: true });
ok(
  a.traits.includes('kingslayer') && !a.traits.includes('giantsbane') && a.traits.length === 2,
  'Kingslayer takes the place of Giantsbane'
);

const b = soldier();
b.vetTier = 1;
const d = Veterans.deeds(b);
for (let i = 0; i < 3; i++) {
  b.hp = b.maxHp * 0.2;
  Veterans.endWave(b, 3);
}
ok(
  d.close === 3 && b.traits.includes('last_breath'),
  'three waves ended near death earn Last Breath'
);
ok(Veterans.damageMult(foe('orc'), b) === 0.7, 'Last Breath: -30% taken below a quarter health');
b.hp = b.maxHp;
ok(Veterans.damageMult(foe('orc'), b) === 1, 'Last Breath does nothing at full health');
ok(Veterans.damageMult(b, foe('orc')) === 0.9, 'Last Breath: -10% dealt above 75% health');

const c = soldier();
c.vetTier = 1;
const speed0 = c.speed;
c.holding = true;
for (let i = 0; i < 10; i++) {
  Veterans.recordKill(c, foe('orc'), 4);
  Veterans.endWave(c, 4);
}
ok(
  c.traits.includes('oathkeeper') && c.speed < speed0,
  'Oathkeeper is earned holding and costs speed'
);

ok(Veterans.hallBuildBlock(), 'the Hall cannot be built before any veteran reaches top rank');
const blocked = Availability.check('build', 'hall_of_veterans', {
  ...Game.getState(),
  creativeMode: false,
  hallBuildBlock: Veterans.hallBuildBlock(),
});
ok(!blocked.ok && /rank 6/.test(blocked.reason), 'the build button is blocked with the reason');
while ((a.vetTier || 0) < MAX_VETERAN_TIER) sb.upgradeVeteranUnit(a);
ok(a.hallId && Veterans.getHall().length === 1, 'reaching top rank writes the name on the roll');
ok(!Veterans.hallBuildBlock(), 'a name on the roll allows the Hall');
ok(Veterans.slots(a) === 4, 'top rank holds four trait slots');

const hp6 = a.maxHp;
// Loading reuses unit objects, so the veteran is found again by id.
const aId = a.id;
const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
const savedA = snap.units.find((u) => u.id === aId);
ok(
  savedA.traits.includes('kingslayer') && savedA.deeds.boss === 3,
  'a save keeps traits and deeds'
);
ok(snap.hallOfVeterans.length === 1, 'a save keeps the Hall roll');
ok(Game.importGameState(snap), 'the save loads');
let a2 = GS.units.find((u) => u.id === aId);
ok(a2.maxHp === hp6, `loading does not apply rank steps again (${a2.maxHp} vs ${hp6})`);
ok(a2.traits.includes('kingslayer') && a2.hallId, 'traits and roll place survive a load');

const old = JSON.parse(JSON.stringify(snap));
delete old.hallOfVeterans;
for (const u of old.units) {
  delete u.traits;
  delete u.deeds;
  delete u.hallId;
  delete u.vetStatTierApplied;
}
ok(Game.importGameState(SaveFormat.seal(old)), 'a save from before traits loads');
a2 = GS.units.find((u) => u.id === aId);
ok(a2.vetTier === MAX_VETERAN_TIER && a2.maxHp === hp6, 'an old veteran keeps its rank and health');
ok(Array.isArray(a2.traits) && a2.deeds, 'an old veteran gets an empty record to build on');
Veterans.check(a2, GS.wave);
ok(a2.hallId, 'an old top-rank veteran is written on the roll');

ok(Game.importGameState(snap), 'back to the current save');
a2 = GS.units.find((u) => u.id === aId);
const entry = Veterans.entryOf(a2);
a2.hp = 0;
GameArmy.notifyHallDeath(a2, Veterans.onDeath(a2, GS.wave));
GS.units.splice(GS.units.indexOf(a2), 1);
ok(entry.fallen && entry.deaths === 1, 'death marks the name fallen');
GS.tactical = 1000;
ok(!Game.raiseVeteran(entry.id), 'no raising without a standing Hall');
ok(Game.creativeSpawnPlayerBuildingAt('hall_of_veterans', cx.x + 80, cx.y + 80), 'place the Hall');
const hall = GS.buildings.find((x) => x.type === 'hall_of_veterans');
hall.complete = true;
const cost = Veterans.raiseCost(entry);
GS.tactical = cost - 1;
ok(!Game.raiseVeteran(entry.id), 'no raising without the TP');
GS.tactical = cost;
ok(Game.raiseVeteran(entry.id), 'the Hall raises the fallen veteran');
const r = GS.units.find((u) => u.hallId === entry.id && u.hp > 0);
ok(GS.tactical === 0, 'raising spends the TP');
ok(r && r.vetTier === Veterans.RAISED_TIER, 'the raised veteran is one rank down');
ok(r.maxHp < hp6, 'the raised veteran has less health than before');
ok(
  r.traits.includes('kingslayer') && r.deeds.boss === 3,
  'the raised veteran keeps traits and deeds'
);
ok(!entry.fallen, 'the name is back on the field');

r.hp = 0;
Veterans.onDeath(r, GS.wave);
GS.tactical = 100000;
ok(!Game.raiseVeteran(entry.id), 'one raising a wave');
ok(Veterans.raiseCost(entry) === cost * 2, 'the second raising costs double');

const roll = Veterans.exportHall();
Veterans.setHall([]);
Veterans.importHall(roll);
ok(Veterans.getHall()[0].fallen, 'a roll carried into a new run arrives fallen');

const e = soldier();
e.vetTier = 1;
kill(e, 'troll', 5);
kill(e, 'harpy', 10);
ok(e.traits.length === 1 && e.traits[0] === 'trollfeller', 'one slot holds the first deed');
ok(/ the Trollfeller$/.test(sb.getUnitDisplayName(e)), 'the first trait is worn as an epithet');
ok(Veterans.forgetTrait(e, 'trollfeller', 5), 'a trait can be given up');
ok(e.traits[0] === 'wing_clipper', 'the freed slot goes to the next earned deed');
kill(e, 'troll', 1);
ok(!e.traits.includes('trollfeller'), 'a trait given up is not earned again');
kill(e, 'boss_gorath', 1, { isNamedBoss: true });
ok(
  Veterans.deeds(e).k.boss_gorath === 1 && Veterans.TRAITS.breakers_heir.need(Veterans.deeds(e)),
  'a named boss kill earns the trait of that boss'
);

const n = failures();
console.log(n ? `test-veterans: ${n} FAILED` : 'test-veterans: all passed');
process.exit(n ? 1 : 0);
