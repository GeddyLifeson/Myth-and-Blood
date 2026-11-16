/**
 * Named bosses' signature moves (js/monster-bosses.js): every boss has one, it is held
 * in place and marked for its wind-up, each counter breaks it and leaves him exposed,
 * the wrong troops do not, phases speed it up, and in the real game loop it fires.
 * Also: a boss below half health is not enraged twice (js/content-expansion.js).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const MB = vm.runInContext(
  `${readFileSync(join(JS, 'monster-bosses.js'), 'utf8')}\nMonsterBosses`,
  vm.createContext({ console, Math })
);

let nextId = 1;
const unit = (type, team, x, y, extra = {}) => ({
  id: nextId++,
  type,
  team,
  x,
  y,
  hp: 100,
  maxHp: 100,
  damage: 10,
  range: 20,
  ...extra,
});
const boss = (type, x = 500, y = 300) =>
  unit(type, 'enemy', x, y, { isNamedBoss: true, hp: 2000, maxHp: 2000, damage: 50 });

function world(units, walls = []) {
  const said = [];
  const ctx = {
    units,
    walls,
    tick: 0,
    worldW: 1200,
    worldH: 900,
    spawned: [],
    said,
    float: () => {},
    playSfx: () => {},
    shake: () => {},
    burst: () => {},
    showMessage: (t) => said.push(t),
    spawnEnemy: (type, x, y) => ctx.spawned.push({ type, x, y }),
    unitName: (u) => u.type,
    hurt: (u, amount) => {
      u.hp -= amount;
    },
    hurtBuilding: (b, amount) => {
      b.hp -= amount;
    },
    blocked: () => false,
  };
  return ctx;
}
const step = (ctx, n = 1) => {
  for (let i = 0; i < n; i++) {
    ctx.tick++;
    MB.update(ctx);
  }
};
/** Run until the boss starts a move; returns ticks waited, or -1. */
function untilWindup(ctx, b, max = 2000) {
  for (let i = 0; i < max; i++) {
    step(ctx);
    if (b.bossMove?.id) return i;
  }
  return -1;
}

// 1. Every named boss has a move, a counter, and his lines.
for (const entry of MB.BOSS_ROSTER) {
  ok(
    entry.moves.length > 0 && entry.moves.every((id) => MB.MOVES[id]),
    `${entry.name}: signature move defined`
  );
  ok(
    !!(entry.counter && entry.arrive && entry.lastStand && entry.death),
    `${entry.name}: counter, arrival, last stand and death lines`
  );
  ok(
    ![entry.counter, entry.arrive, entry.lastStand, entry.death, entry.mechanics].some((t) =>
      t.includes('—')
    ),
    `${entry.name}: no em dash in player text`
  );
}

// 2. Ash Charge, uncountered: telegraphed, he stands still, then everyone in the lane is hit.
{
  const g = boss('boss_gorath', 500, 200);
  const line = [0, 1, 2].map((i) => unit('footman', 'player', 500 + i * 30, 330));
  const ctx = world([g, ...line]);
  const waited = untilWindup(ctx, g);
  ok(waited >= 200, `Gorath waits ${waited} ticks before his first move (no instant opener)`);
  ok(g.bossMove.id === 'ash_charge', 'Gorath winds up Ash Charge');
  ok(g.bossMove.total >= 100, `wind-up lasts ${g.bossMove.total} ticks (readable)`);
  ok(
    ctx.said.some((t) => t.includes('Gorath:')),
    'Gorath speaks when he takes the field'
  );
  const x0 = g.x;
  const y0 = g.y;
  step(ctx, g.bossMove.total - 5);
  ok(g.x === x0 && g.y === y0 && g.pinned, 'he is held in place during the wind-up');
  step(ctx, 10);
  ok(!g.bossMove.id, 'the charge lands');
  ok(
    line.some((u) => u.hp < 100),
    `footmen in the lane hit (${line.map((u) => u.hp)})`
  );
  ok(g.y > y0 + 50, 'Gorath ran down the lane');
  ok(!(g.exposeUntil > ctx.tick), 'an uncountered move does not expose him');
}

// 3. Ash Charge countered by a pikeman in the lane: no damage, stunned and exposed.
{
  const g = boss('boss_gorath', 500, 200);
  const pike = unit('pikeman', 'player', 500, 280);
  const behind = unit('footman', 'player', 500, 340);
  const ctx = world([g, pike, behind]);
  untilWindup(ctx, g);
  const landsAt = ctx.tick + g.bossMove.t;
  step(ctx, g.bossMove.t + 1);
  ok(pike.hp === 100 && behind.hp === 100, 'the pike stops the charge: nobody is hit');
  ok(g.exposeUntil > ctx.tick && g.exposePct >= 0.3, 'Gorath is exposed after the block');
  ok(g.pinned && g.bossMove.stunUntil > landsAt + 100, 'and stunned for a while');
  ok(g.y < pike.y, 'he stops in front of the pike');
  ok(
    ctx.said.some((t) => t.includes('stunned and exposed')),
    'the player is told to strike now'
  );
}

// 4. Hit counters: Thokk's Earthshatter breaks under ballista bolts, not under footmen.
function thokk(attackerType) {
  const t = boss('boss_thokk', 500, 300);
  const near = unit('footman', 'player', 520, 300);
  const shooter = unit(attackerType, 'player', 500, 600);
  const ctx = world([t, near, shooter]);
  untilWindup(ctx, t);
  for (let i = 0; i < 4; i++) MB.onHit(t, t.maxHp * 0.015, shooter, ctx);
  step(ctx, 200);
  return { t, near, ctx };
}
{
  const a = thokk('ballista');
  ok(a.t.bossMove.staggered === 1, 'ballista bolts break Earthshatter');
  ok(a.near.hp === 100, 'a broken Earthshatter hurts nobody');
  const b = thokk('footman');
  ok(!b.t.bossMove.staggered, 'footman blows do not break it');
  ok(b.near.hp < 100 && b.near.pinned, 'an unbroken Earthshatter hurts and stuns those inside');
}

// 5. Guard counter: Vexis pounces on a lone archer, but a footman beside her turns it.
for (const guarded of [false, true]) {
  const v = boss('boss_vexis', 500, 200);
  const archer = unit('archer', 'player', 600, 420, { range: 150 });
  const units = [v, archer];
  if (guarded) units.push(unit('footman', 'player', 620, 425));
  const ctx = world(units);
  untilWindup(ctx, v);
  ok(v.bossMove.targetId === archer.id, 'Vexis marks the archer, not the footman');
  step(ctx, v.bossMove.t + 1);
  ok(Math.hypot(v.x - archer.x, v.y - archer.y) < 40, 'he steps out beside his prey');
  if (guarded) ok(archer.hp === 100 && v.bossMove.staggered === 1, 'the bodyguard turns it');
  else ok(archer.hp < 100, 'an unguarded archer is struck');
}

// 6. Grave Call raises revenants (one more per return visit) and riders break it.
{
  const m = boss('boss_morwen', 500, 200);
  const ctx = world([m, unit('archer', 'player', 500, 500)]);
  untilWindup(ctx, m);
  step(ctx, m.bossMove.t + 1);
  ok(ctx.spawned.length === 3, `Grave Call raises ${ctx.spawned.length} revenants`);
  const m2 = boss('boss_morwen', 500, 200);
  const rider = unit('cavalry', 'player', 500, 240);
  const ctx2 = world([m2, rider]);
  untilWindup(ctx2, m2);
  MB.onHit(m2, m2.maxHp * 0.06, rider, ctx2);
  step(ctx2, 200);
  ok(ctx2.spawned.length === 0 && m2.bossMove.staggered === 1, 'a rider breaks the chant');
}

// 7. Foundry Ram goes for buildings and hits them.
{
  const k = boss('boss_karg', 500, 200);
  k.siegeMult = 4;
  const wall = { x: 500, y: 360, hp: 1000, owner: 'player' };
  const ctx = world([k, unit('archer', 'player', 900, 600)], [wall]);
  untilWindup(ctx, k);
  ok(Math.abs(k.bossMove.ex - 500) < 5, 'Karg aims the ram at the building');
  step(ctx, k.bossMove.t + 1);
  ok(wall.hp < 1000, `the ram smashes the wall (${wall.hp})`);
}

// 8. Phases: II shortens the gap between moves, III starts one at once and winds up faster.
{
  const s = boss('boss_sylvara', 500, 200);
  const ctx = world([s, unit('archer', 'player', 500, 400), unit('archer', 'player', 620, 400)]);
  untilWindup(ctx, s);
  const full = s.bossMove.total;
  step(ctx, s.bossMove.t + 1);
  const cdFull = s.bossMove.cd;
  s.hp = s.maxHp * 0.4;
  untilWindup(ctx, s);
  step(ctx, s.bossMove.t + 1);
  ok(MB.phaseOf(s) === 2 && s.bossMove.cd < cdFull, `phase II: gap ${s.bossMove.cd} < ${cdFull}`);
  s.hp = s.maxHp * 0.15;
  step(ctx, 1);
  ok(MB.phaseOf(s) === 3 && !!s.bossMove.id, 'phase III: the last stand opens with a move');
  ok(s.bossMove.total < full, `last-stand wind-up ${s.bossMove.total} < ${full}`);
  ok(
    ctx.said.some((t) => t.includes('Sylvara:')),
    'she speaks her last-stand line'
  );
}

// 9. Malachar cycles four warlords' moves.
{
  const m = boss('boss_malachar', 500, 200);
  const ctx = world([m, ...[0, 1, 2].map((i) => unit('footman', 'player', 480 + i * 20, 260))]);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    untilWindup(ctx, m);
    seen.push(m.bossMove.id);
    step(ctx, m.bossMove.t + 1);
    for (const u of ctx.units) if (u.team === 'player') u.hp = 100;
  }
  ok(new Set(seen).size === 4, `Malachar uses four moves in turn (${seen.join(', ')})`);
}

// 10. In the real game: the loop runs the moves, the save keeps them, and no double enrage.
{
  const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
  const { sb, cvs } = boot(9);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, GameState, createUnit, ContentExpansion })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  const GS = api.GameState;
  api.Game.beginDayPhase(true);
  GS.spawnQueue = [];
  for (const u of GS.units) if (u.team !== 'player') u.hp = 0;
  const g = api.createUnit('boss_gorath', GS.worldW / 2, GS.rallyY + 40, 'enemy');
  g.isNamedBoss = true;
  g.maxHp = g.hp = 1e6;
  GS.units.push(g);
  let wound = false;
  for (let i = 0; i < 900 && !wound; i++) {
    api.Game.update();
    if (g.bossMove?.id) wound = true;
  }
  ok(wound, 'in the game loop Gorath winds up his charge');
  ok(JSON.parse(JSON.stringify(g.bossMove)).id === g.bossMove.id, 'boss move state is plain data');
  g.hp = g.maxHp * 0.3;
  const dmg = api.ContentExpansion.modifyCalcDamage?.(g, GS.units[0], 100);
  ok(dmg === undefined || dmg === 100, `a wounded boss is not enraged a second time (${dmg})`);
}

process.exit(failures() ? 1 : 0);
