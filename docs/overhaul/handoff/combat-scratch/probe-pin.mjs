// How long does a pin last, how often are soldiers and enemies pinned, and can a boss rout?
import { startGame } from './lib.mjs';
const api = startGame({ seed: 77 });
const { Game, GameState: GS } = api;
Game.beginDayPhase(true);
for (let i = 0; i < 5; i++) Game.update();
GS.spawnQueue = [];
for (const u of GS.units) {
  if (u.team !== 'player') u.hp = 0;
  else {
    u.x = 10;
    u.y = GS.worldH - 8;
    u.canHunt = false;
    u.huntMode = false;
    u.pinned = true;
    u.pinTimer = 1e9;
    u.maxHp = u.hp = 1e7;
    u.maxMorale = u.morale = 1e6;
  }
}
GS.wave = 5;
const W = GS.worldW,
  H = GS.worldH;
const f = api.createUnit('footman', W / 2, H - 150, 'player');
GS.units.push(f);
f.maxHp = f.hp = 1e6;
const o = api.createUnit('orc', W / 2, H - 180, 'enemy', { spawnSide: 'north' });
o.mustered = true;
o.maxHp = o.hp = 1e6;
o.accuracy = 100;
GS.units.push(o);
api.Roster.onSpawn(o, 5);
o.accuracy = 100;
let pinRuns = [],
  cur = 0,
  pinsF = 0,
  hitsOnF = 0,
  lastHp = f.hp,
  ePins = 0,
  eCur = 0,
  ePinRuns = [],
  hitsOnO = 0,
  lastO = o.hp;
for (let t = 0; t < 6000; t++) {
  Game.update();
  if (f.hp < lastHp) hitsOnF++;
  lastHp = f.hp;
  if (o.hp < lastO) hitsOnO++;
  lastO = o.hp;
  if (f.pinned) cur++;
  else if (cur) {
    pinRuns.push(cur);
    cur = 0;
  }
  if (o.pinned) eCur++;
  else if (eCur) {
    ePinRuns.push(eCur);
    eCur = 0;
  }
}
const mean = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
console.log(
  'footman (morale 15): hits taken',
  hitsOnF,
  'pins',
  pinRuns.length,
  'mean pin ticks',
  mean(pinRuns),
  'share of time pinned',
  (pinRuns.reduce((a, b) => a + b, 0) / 6000).toFixed(2)
);
console.log(
  'orc (morale 12): hits taken',
  hitsOnO,
  'pins',
  ePinRuns.length,
  'mean pin ticks',
  mean(ePinRuns),
  'share of time pinned',
  (ePinRuns.reduce((a, b) => a + b, 0) / 6000).toFixed(2)
);
console.log(
  'footman attacks landed per 100 ticks',
  (hitsOnO / 60).toFixed(2),
  'orc',
  (hitsOnF / 60).toFixed(2)
);

// Boss rout: a named boss with three goblins dying beside it
{
  const api2 = startGame({ seed: 78 });
  const G2 = api2.GameState;
  api2.Game.beginDayPhase(true);
  for (let i = 0; i < 5; i++) api2.Game.update();
  G2.spawnQueue = [];
  for (const u of G2.units) {
    if (u.team !== 'player') u.hp = 0;
  }
  G2.wave = 10;
  const boss = api2.createUnit('boss_gorath', 200, 250, 'enemy', { spawnSide: 'north' });
  boss.mustered = true;
  G2.units.push(boss);
  const troll = api2.createUnit('troll', 230, 250, 'enemy', { spawnSide: 'north' });
  troll.mustered = true;
  G2.units.push(troll);
  const gobs = [];
  for (let i = 0; i < 4; i++) {
    const g = api2.createUnit('goblin', 180 + i * 12, 270, 'enemy', { spawnSide: 'north' });
    g.mustered = true;
    g.hp = 1;
    G2.units.push(g);
    gobs.push(g);
  }
  const archers = [];
  for (let i = 0; i < 6; i++) {
    const a = api2.createUnit('archer', 150 + i * 20, 420, 'player');
    a.accuracy = 100;
    a.experience = 30;
    G2.units.push(a);
    archers.push(a);
  }
  let bossFled = false,
    trollFled = false;
  for (let t = 0; t < 900; t++) {
    api2.Game.update();
    if (boss.fleeing) bossFled = true;
    if (troll.fleeing) trollFled = true;
  }
  console.log(
    'boss morale',
    boss.maxMorale,
    'isNamedBoss',
    boss.isNamedBoss,
    '-> fled after goblins died beside it:',
    bossFled,
    'hp',
    Math.round(boss.hp),
    '/',
    boss.maxHp,
    '| troll fled:',
    trollFled,
    'goblins dead',
    gobs.filter((g) => g.hp <= 0).length
  );
}
