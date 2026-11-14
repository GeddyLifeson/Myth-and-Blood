import { startGame } from './lib.mjs';
const api = startGame({ seed: 4000 });
const { Game, GameState: GS } = api;
// build an army of 30 to make it representative
Game.beginDayPhase(true);
for (let i = 0; i < 26; i++) {
  const u = api.createUnit(
    i % 2 ? 'archer' : 'footman',
    60 + ((i * 11) % 280),
    500 + (i % 4) * 15,
    'player'
  );
  GS.units.push(u);
}
const cpu = () => process.cpuUsage().user / 1000;
let c0 = cpu();
for (let t = 0; t < 600; t++) Game.update();
const upd = cpu() - c0;
c0 = cpu();
for (let t = 0; t < 600; t++) Game.getState();
const gs = cpu() - c0;
c0 = cpu();
for (let t = 0; t < 600; t++) {
  Game.getState();
  Game.update();
}
const both = cpu() - c0;
console.log(
  '600 updates',
  upd.toFixed(0),
  'ms cpu; 600 getState',
  gs.toFixed(0),
  'ms; interleaved',
  both.toFixed(0),
  'units',
  GS.units.length
);
