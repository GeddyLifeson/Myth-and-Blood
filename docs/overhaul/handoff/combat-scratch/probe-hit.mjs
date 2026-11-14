import { buildCode, startGame } from './lib.mjs';
const code = buildCode([
  [
    [
      /const meleeHit = unit\.isDoomslayer \|\| Math\.random\(\) \* 100 <= hit;/,
      'const meleeHit = unit.isDoomslayer || Math.random() * 100 <= hit; if (globalThis.__log) globalThis.__log(unit, target, hit, meleeHit, dist);',
    ],
  ],
]);
const api = startGame({ seed: 77, code });
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
GS.units.push(o);
o.accuracy = 100;
const log = [];
api.sb.__log = (u, t, hit, ok, dist) =>
  log.push([u.team, u.type, t.type, Math.round(hit), ok, Math.round(dist), GS.updateTick]);
for (let t = 0; t < 3000; t++) Game.update();
const e = log.filter((l) => l[0] === 'enemy'),
  p = log.filter((l) => l[0] === 'player');
console.log(
  'enemy swings',
  e.length,
  'hits',
  e.filter((l) => l[4]).length,
  'sample',
  JSON.stringify(e.slice(0, 8))
);
console.log(
  'player swings',
  p.length,
  'hits',
  p.filter((l) => l[4]).length,
  'sample',
  JSON.stringify(p.slice(0, 5))
);
