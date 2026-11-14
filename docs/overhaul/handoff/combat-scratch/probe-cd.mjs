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
f.damage = 0;
const o = api.createUnit('orc', W / 2, H - 180, 'enemy', { spawnSide: 'north' });
o.mustered = true;
o.maxHp = o.hp = 1e6;
GS.units.push(o);
o.accuracy = 100;
let last = o.actionTimer,
  fires = [],
  lastFire = 0,
  prevAnim = 0;
for (let t = 0; t < 3000; t++) {
  Game.update();
  if (o.actionTimer > last + 5) {
    fires.push([t - lastFire, o.actionTimer]);
    lastFire = t;
  }
  last = o.actionTimer;
}
console.log(
  'orc xp',
  o.experience,
  'reload',
  o.reloadMult,
  'asm',
  o.attackSpeedMult,
  'fires',
  fires.length,
  JSON.stringify(fires.slice(0, 12))
);
