/**
 * Hunt is every soldier's default; Hold is a per-soldier order (Shift + move, Hold here).
 * Also the med tent rule: with a tent on the field the wounded go to it first.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameState, createUnit, createBuilding })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  const GS = api.GameState;
  curGS = GS;
  // A quiet day: no wave of its own, so each scenario places exactly what it needs.
  api.Game.beginDayPhase(true);
  for (let i = 0; i < 5; i++) api.Game.update();
  GS.spawnQueue = [];
  for (const u of GS.units) if (u.team !== 'player') u.hp = 0;
  // Scenarios bring their own men: the opening squad is parked in a corner, out of it.
  let k = 0;
  for (const u of GS.units) {
    if (u.team !== 'player') continue;
    u.canHunt = false;
    u.huntMode = false;
    u.pinned = true;
    u.pinTimer = 1e9;
    u.x = 14 + 10 * k++;
    u.y = GS.worldH - 8;
    u.path = [];
  }
  api.Game.update();
  // One inert enemy in the far corner keeps the day (and the wave) open.
  const anchor = api.createUnit('orc', 6, 6, 'enemy');
  anchor.speed = 0;
  anchor.damage = 0;
  anchor.maxHp = anchor.hp = 1e7;
  GS.units.push(anchor);
  api.Game.beginDayPhase(true); // no-op if it is still day
  GS.spawnQueue = [];
  return api;
}

let curGS = null;
const run = (Game, n, each) => {
  for (let i = 0; i < n; i++) {
    // The anchor stays "forming up", so the host never counts as fully on the field and
    // the straggler sweep (section 6) stays out of the other scenarios.
    for (const u of curGS.units) {
      if (u.maxHp > 1e6 && u.hp > 0) {
        u.mustered = false;
        u.musterAge = 0;
      }
    }
    Game.update();
    each?.(i);
  }
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fromPost = (u) => Math.hypot(u.x - u.postX, u.y - u.postY);

function soldier(api, type, x, y) {
  const u = api.createUnit(type, x, y, 'player');
  api.GameState.units.push(u);
  return u;
}
/** A formed-up enemy that stands still and cannot hurt anyone unless asked to. */
function dummy(api, x, y, opts = {}) {
  const f = api.createUnit(opts.type || 'orc', x, y, 'enemy');
  f.mustered = true;
  f.spawnSide = 'north';
  f.maxHp = f.hp = opts.hp ?? 4000;
  if (!opts.live) {
    f.speed = 0;
    f.damage = 0;
    f.accuracy = 0;
  }
  if (opts.runner) f.lineBreaker = true;
  api.GameState.units.push(f);
  return f;
}
const clearFoes = (GS) => {
  for (const u of GS.units) if (u.team !== 'player' && !(u.maxHp > 1e6)) u.hp = 0;
  GS.spawnQueue = [];
};
function tent(api, x, y) {
  ok(api.Game.creativeSpawnPlayerBuildingAt('medical_tent', x, y), 'a med tent is placed');
  const GS = api.GameState;
  const b = GS.buildings[GS.buildings.length - 1];
  b.complete = true;
  return b;
}

// --- 1. hunt by default, plain move keeps hunt and moves the post -------------------------
{
  const api = start(7);
  const { Game, GameState: GS } = api;
  const W = GS.worldW;
  const H = GS.worldH;
  const a = soldier(api, 'footman', W / 2, H - 80);
  ok(a.canHunt && a.huntMode && !a.holding, 'a deployed soldier hunts by default');
  ok(Game.getState().heldCount === 0, 'nobody is holding at the start');

  const foe = dummy(api, W / 2 + 20, H - 80 - 150);
  let hit = false;
  run(Game, 900, () => {
    if (foe.hp < foe.maxHp) hit = true;
  });
  ok(hit, 'he walks out and strikes an enemy 150 px from his post');
  clearFoes(GS);

  Game.selectUnit(a.id);
  const dest = { x: W / 2 - 90, y: H - 150 };
  Game.moveSelectionToWorld(dest.x, dest.y);
  ok(!a.holding, 'a plain move order is not a hold');
  ok(Math.hypot(a.postX - dest.x, a.postY - dest.y) < 2, 'a plain move makes the spot his post');
  run(Game, 500);
  ok(dist(a, dest) < 22, `he gets there (${Math.round(dist(a, dest))} away)`);
  ok(a.huntMode && !a.manualOrder && !a.holding, 'and hunts again from the new post');
  const foe2 = dummy(api, dest.x, dest.y - 140);
  hit = false;
  run(Game, 900, () => {
    if (foe2.hp < foe2.maxHp) hit = true;
  });
  ok(hit, 'from the new post he goes for an enemy on his own');
}

// --- 2. shift-move holds: no chase, no assist, no drift; survives save/load; release ------
{
  const api = start(8);
  const { Game, GameState: GS } = api;
  const W = GS.worldW;
  const H = GS.worldH;
  const a = soldier(api, 'footman', W / 2, H - 70);
  const mate = soldier(api, 'footman', W / 2 + 70, H - 150);
  Game.selectUnit(a.id);
  const spot = { x: W / 2 - 40, y: H - 150 };
  // The same call the click handler makes for Shift + click (and a touch long-press).
  Game.moveSelectionToWorld(spot.x, spot.y, undefined, { hold: true });
  ok(a.holding, 'Shift + move gives a hold order');
  run(Game, 400);
  ok(dist(a, spot) < 12, `he goes to the spot (${Math.round(dist(a, spot))} away)`);
  ok(a.holding && !a.huntMode, 'and holds there');
  ok(Math.hypot(a.x - a.postX, a.y - a.postY) < 0.5, 'the held spot is his post');
  spot.x = a.x; // formations may offset a single soldier by a few pixels
  spot.y = a.y;
  ok(Game.getState().heldCount === 1, 'the HUD count sees one held soldier');
  ok(Game.getSelectedUnitsInfo()[0].holding === true, 'the selection card is told he is holding');

  // An enemy near, but out of reach: a hunter would go; he must not. His mate fights it.
  const foe = dummy(api, spot.x + 60, spot.y - 60);
  let mateFought = false;
  let drift = 0;
  run(Game, 500, () => {
    if (mate.combatTargetId === foe.id) mateFought = true;
    drift = Math.max(drift, dist(a, spot));
  });
  ok(mateFought, 'a hunting comrade engages the enemy 85 px away');
  ok(
    drift <= 3,
    `the held soldier neither chases nor assists nor drifts (max ${drift.toFixed(1)} px)`
  );

  // What walks into his reach, he hits.
  const close = dummy(api, spot.x + 6, spot.y - 16);
  let struck = false;
  run(Game, 300, () => {
    if (close.hp < close.maxHp) struck = true;
  });
  ok(struck, 'he strikes an enemy that comes into weapon range');
  ok(dist(a, spot) <= 3, 'without leaving his spot');
  clearFoes(GS);

  // Events that used to flip hold back to hunt.
  Game.useAbility('rally', spot.x, spot.y);
  run(Game, 5);
  ok(a.holding && !a.huntMode, 'a Battle Rally does not cancel the hold');

  // Save / load.
  const id = a.id;
  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  ok(snap.units.find((u) => u.id === id)?.holding === true, 'the hold is written to the save');
  ok(Game.importGameState(snap), 'the save loads');
  GS.paused = false; // a load comes back paused
  const b = GS.units.find((u) => u.id === id);
  clearFoes(GS);
  run(Game, 60);
  ok(b.holding && !b.huntMode, 'he is still holding after the load');
  ok(dist(b, spot) <= 6, 'on the same spot');
  const foe3 = dummy(api, spot.x + 60, spot.y - 60);
  drift = 0;
  run(Game, 300, () => {
    drift = Math.max(drift, dist(b, spot));
  });
  ok(drift <= 6, `and still does not chase (max ${drift.toFixed(1)} px)`);

  // Release.
  Game.selectUnit(b.id);
  ok(Game.orderHunt() === 1, 'Hunt releases the hold');
  ok(!b.holding && b.huntMode, 'he hunts again');
  let hit = false;
  run(Game, 900, () => {
    if (foe3.hp < foe3.maxHp) hit = true;
  });
  ok(hit, 'and goes for the enemy he was ignoring');
  clearFoes(GS);

  // Hold here on the whole army, then a plain move releases one man.
  Game.clearSelection();
  const n = Game.orderHoldHere();
  ok(
    n >= 2 && GS.units.filter((u) => u.team === 'player' && u.holding).length === n,
    'Hold here with nothing selected holds the whole army'
  );
  Game.selectUnit(b.id);
  Game.moveSelectionToWorld(b.x + 50, b.y);
  ok(!b.holding, 'a plain move order releases the hold');
  Game.clearSelection();
  Game.orderHunt();
  ok(Game.getState().heldCount === 0, 'Hunt with nothing selected releases everyone');
}

// --- 3. hunt comes back after load mid-march, a blocked order, rout and rally --------------
{
  const api = start(9);
  const { Game, GameState: GS } = api;
  const W = GS.worldW;
  const H = GS.worldH;
  const a = soldier(api, 'footman', W / 2, H - 70);
  Game.selectUnit(a.id);
  const dest = { x: W / 2 - 110, y: H - 190 };
  Game.moveSelectionToWorld(dest.x, dest.y);
  run(Game, 15);
  ok(a.manualOrder && !a.huntMode, 'mid-march he is on the order');
  const id = a.id;
  ok(
    Game.importGameState(JSON.parse(JSON.stringify(Game.exportGameState()))),
    'saved and loaded mid-march'
  );
  GS.paused = false;
  const b = GS.units.find((u) => u.id === id);
  clearFoes(GS);
  ok(b.huntMode && !b.manualOrder, 'after the load he is hunting, not stuck with hunt off');
  run(Game, 700);
  ok(
    dist(b, dest) < 24,
    `and walks on to the post he was sent to (${Math.round(dist(b, dest))} away)`
  );

  // Rout and rally.
  b.demoralized = true;
  b.huntMode = false;
  Game.useAbility('rally', b.x, b.y);
  run(Game, 3);
  ok(!b.demoralized && b.huntMode, 'rallied, he hunts again');

  // An order to a spot he cannot reach ends, and he hunts from where he got to.
  const c = soldier(api, 'footman', W / 2 + 60, H - 70);
  ok(Game.creativeSpawnPlayerBuildingAt('outpost', W / 2 + 60, H - 200), 'an outpost in the way');
  GS.buildings[GS.buildings.length - 1].complete = true;
  Game.selectUnit(c.id);
  Game.moveSelectionToWorld(W / 2 + 60, H - 200);
  run(Game, 900);
  ok(
    !c.manualOrder && c.huntMode,
    'an order onto a building does not leave him on the order for good'
  );
  ok(fromPost(c) < 20, `and his post is where he could get to (${Math.round(fromPost(c))} away)`);

  // The General and healers are never switched to Hunt.
  const g = soldier(api, 'general', W / 2 - 60, H - 60);
  const h = soldier(api, 'healer', W / 2 - 90, H - 60);
  Game.clearSelection();
  Game.orderHoldHere();
  Game.orderHunt();
  ok(!g.canHunt && !g.huntMode && !g.holding, 'the General takes no hunt or hold order');
  ok(!h.canHunt && !h.huntMode && !h.holding, 'nor does a healer');
}

// --- 4. leash, runners, ranged stand off, nobody idle ----------------------------------------
{
  const api = start(10);
  const { Game, GameState: GS } = api;
  const W = GS.worldW;
  const H = GS.worldH;
  const a = soldier(api, 'footman', W / 2, H - 60);
  const post = { x: a.postX, y: a.postY };
  // A string of enemies leading up the field, 110 px apart: the old chain chase.
  const chain = [];
  for (let i = 1; i <= 5; i++)
    chain.push(dummy(api, W / 2 + (i % 2 ? 25 : -25), H - 60 - 110 * i, { hp: 20 }));
  let far = 0;
  const c0 = chain[0];
  const c1 = chain[1];
  const c4 = chain[4];
  let dead0 = false;
  let dead1 = false;
  // Kept under a minute of game time: after a long standoff the enemy storms the line
  // as line-breakers, and those are chased further.
  run(Game, 2400, () => {
    far = Math.max(far, dist(a, post));
    if (c0.hp <= 0 || !GS.units.includes(c0)) dead0 = true;
    if (c1.hp <= 0 || !GS.units.includes(c1)) dead1 = true;
  });
  ok(far > 80, `he does leave his post to fight (${Math.round(far)} px)`);
  ok(
    far <= 240 + a.meleeRange + 12,
    `but never goes past his leash (max ${Math.round(far)} px from post)`
  );
  ok(dead0 && dead1, 'the enemies inside the leash are dead');
  ok(c4.hp === c4.maxHp && c4.team === 'enemy', 'the one far up the field is left alone');
  clearFoes(GS);
  run(Game, 600);
  ok(
    fromPost(a) < 20,
    `with nothing in reach he walks back to his post (${Math.round(fromPost(a))} away)`
  );

  // A line-breaker is preferred over a nearer ordinary enemy.
  const near = dummy(api, a.x - 50, a.y - 70);
  const runner = dummy(api, a.x + 70, a.y - 110, { runner: true });
  run(Game, 80);
  ok(
    a.combatTargetId === runner.id,
    `he picks the runner first (target ${a.combatTargetId === near.id ? 'the nearer orc' : a.combatTargetId})`
  );
  clearFoes(GS);
  run(Game, 600);

  // Ranged: move only as far as needed to shoot.
  const arch = soldier(api, 'archer', W / 2 + 80, H - 60);
  const target = dummy(api, W / 2 + 80, H - 60 - 300);
  let closest = Infinity;
  let shot = false;
  run(Game, 900, () => {
    closest = Math.min(closest, dist(arch, target));
    if (target.hp < target.maxHp) shot = true;
  });
  ok(shot, 'the archer steps forward and shoots an enemy 300 px away');
  ok(
    closest > arch.range * 0.8,
    `without walking into melee (closest ${Math.round(closest)} px, range ${arch.range})`
  );
  ok(fromPost(arch) <= 140 + 12, `and stays near his post (${Math.round(fromPost(arch))} px)`);
  clearFoes(GS);
  run(Game, 600);

  // Five men and one orc: nobody stands idle next to a reachable enemy.
  const squad = [];
  for (let i = 0; i < 5; i++) squad.push(soldier(api, 'footman', W / 2 - 60 + i * 30, H - 100));
  const orc = dummy(api, W / 2, H - 200);
  // A second enemy that is still forming up must not freeze them on an unreachable target.
  const far2 = dummy(api, W / 2, H - 330);
  far2.mustered = false;
  let worstIdle = 0;
  const idle = new Map();
  const last = new Map();
  run(Game, 500, () => {
    for (const u of squad) {
      const p = last.get(u.id);
      const moved = p && Math.hypot(u.x - p.x, u.y - p.y) > 0.2;
      last.set(u.id, { x: u.x, y: u.y });
      const busy = moved || u.attackAnimTimer > 0 || dist(u, orc) <= u.meleeRange + 4;
      const reach = orc.hp > 0 && dist(u, orc) <= u.meleeRange + 140;
      const n = reach && !busy ? (idle.get(u.id) || 0) + 1 : 0;
      idle.set(u.id, n);
      worstIdle = Math.max(worstIdle, n);
    }
  });
  ok(orc.hp < orc.maxHp, 'the squad attacks the orc');
  ok(
    worstIdle < 120,
    `no soldier stands idle with an enemy in reach for long (worst ${worstIdle} ticks)`
  );
}

// --- 5. the med tent rule --------------------------------------------------------------------
{
  const api = start(11);
  const { Game, GameState: GS } = api;
  const W = GS.worldW;
  const H = GS.worldH;

  // No tent: nothing changes.
  const a = soldier(api, 'footman', W / 2, H - 150);
  a.hp = a.maxHp * 0.8;
  run(Game, 120);
  ok(
    !a.retreatingToMed && !a.atMedicalTent && a.huntMode,
    'with no tent a wounded soldier stays on duty'
  );

  const t = tent(api, W / 2 - 120, H - 60);
  const kills = (a.kills = 7);
  a.honorName = 'Aldric the Tested';
  run(Game, 2);
  ok(a.retreatingToMed === t.id, 'with a tent, a wounded idle soldier goes at once');
  let healedAt = -1;
  run(Game, 900, (i) => {
    if (healedAt < 0 && !a.retreatingToMed && !a.atMedicalTent) healedAt = i;
  });
  ok(healedAt >= 0 && a.hp >= a.maxHp - 0.01, `he heals to full (${Math.round(a.hp)}/${a.maxHp})`);
  ok(a.huntMode && !a.holding, 'and hunts again');
  ok(fromPost(a) < 20, `back at his post (${Math.round(fromPost(a))} away)`);
  ok(a.kills === kills && a.honorName === 'Aldric the Tested', 'kills and name are untouched');

  // In melee: above half he stays, below half he leaves.
  const foe = dummy(api, a.x + 4, a.y - 16, { hp: 100000 });
  run(Game, 60);
  a.hp = a.maxHp * 0.7;
  run(Game, 60);
  ok(!a.retreatingToMed, 'in an exchange above 50% health he fights on');
  a.hp = a.maxHp * 0.45;
  run(Game, 3);
  ok(a.retreatingToMed === t.id, 'below 50% he breaks off for the tent');
  foe.hp = 0;
  run(Game, 900);
  ok(a.hp >= a.maxHp - 0.01 && a.huntMode, 'and is back on duty when healed');

  // The General is not sent; a soldier on a move order finishes it first.
  const g = soldier(api, 'general', W / 2 + 80, H - 80);
  g.hp = g.maxHp * 0.6;
  const m = soldier(api, 'footman', W / 2 + 40, H - 80);
  Game.selectUnit(m.id);
  Game.moveSelectionToWorld(W / 2 + 40, H - 260);
  m.hp = m.maxHp * 0.6;
  run(Game, 30);
  ok(!g.retreatingToMed && !g.atMedicalTent, 'the General is left alone');
  ok(!m.retreatingToMed && m.manualOrder, 'a soldier on a move order finishes the move first');
  run(Game, 400);
  ok(m.retreatingToMed || m.atMedicalTent || m.hp >= m.maxHp - 0.01, 'then goes to the tent');
  run(Game, 900);
  g.hp = g.maxHp;

  // A held soldier goes too, and comes back to the same spot, still holding.
  const hSpot = { x: W / 2 + 100, y: H - 170 };
  const h = soldier(api, 'footman', hSpot.x, hSpot.y);
  Game.selectUnit(h.id);
  Game.orderHoldHere();
  ok(h.holding, 'a soldier is told to hold');
  h.hp = h.maxHp * 0.5;
  run(Game, 3);
  ok(
    h.retreatingToMed === t.id && h.holding,
    'wounded, the held soldier goes to the tent and keeps his order'
  );
  run(Game, 1200);
  ok(h.hp >= h.maxHp - 0.01, 'he heals to full');
  ok(
    h.holding && !h.huntMode && dist(h, hSpot) <= 6,
    `and is holding the same spot again (${Math.round(dist(h, hSpot))} away)`
  );

  // A full tent: the extra wounded queue outside and do not wander.
  const many = [];
  for (let i = 0; i < 7; i++) {
    const u = soldier(api, 'footman', W / 2 - 60 + i * 22, H - 120);
    u.hp = u.maxHp * 0.3;
    many.push(u);
  }
  // Slow the cure so the queue can be seen.
  t.healRate = 0.07;
  let maxIn = 0;
  let maxQueued = 0;
  let wander = 0;
  const qPos = new Map();
  run(Game, 500, () => {
    const inside = many.filter((u) => u.atMedicalTent === t.id).length;
    maxIn = Math.max(maxIn, inside);
    const queued = many.filter((u) => u.medQueued && !u.atMedicalTent);
    maxQueued = Math.max(maxQueued, queued.length);
    for (const u of queued) {
      // Give him a moment to take his place in the line, then he must stand still.
      let p = qPos.get(u.id);
      if (!p) qPos.set(u.id, (p = { n: 0 }));
      if (++p.n === 150) {
        p.x = u.x;
        p.y = u.y;
      } else if (p.n > 150) wander = Math.max(wander, Math.hypot(u.x - p.x, u.y - p.y));
    }
  });
  ok(maxIn === 4, `the tent treats four at a time (${maxIn})`);
  ok(maxQueued >= 2, `the rest wait outside (${maxQueued} queued)`);
  ok(wander <= 8, `and stand in line, not walking back and forth (${wander.toFixed(1)} px)`);
  const waiting = many.filter((u) => u.medQueued && !u.atMedicalTent);
  ok(
    waiting.every((u) => dist(u, t) < 110),
    'the queue stands just outside the tent'
  );
  t.healRate = 0.14;
  run(Game, 1500);
  ok(
    many.every((u) => u.hp >= u.maxHp - 0.01 && !u.retreatingToMed),
    'everyone is treated in turn'
  );

  // The tent is destroyed: the wounded go back to duty.
  for (const u of many.slice(0, 3)) u.hp = u.maxHp * 0.4;
  t.healRate = 0.07;
  run(Game, 200);
  ok(
    many.slice(0, 3).every((u) => u.retreatingToMed || u.atMedicalTent),
    'three wounded are at or heading for the tent'
  );
  t.hp = 0;
  run(Game, 5);
  ok(
    many.slice(0, 3).every((u) => !u.retreatingToMed && !u.atMedicalTent && u.huntMode),
    'with the tent destroyed they return to duty and hunt'
  );
}

// --- 6. the leash cannot stall a wave: stragglers are swept up ----------------------------
{
  const api = start(12);
  const { Game, GameState: GS } = api;
  const W = GS.worldW;
  const H = GS.worldH;
  const hunters = [];
  for (let i = 0; i < 4; i++) hunters.push(soldier(api, 'footman', W / 2 - 60 + i * 40, H - 70));
  const holder = soldier(api, 'footman', W / 2, H - 110);
  Game.selectUnit(holder.id);
  Game.orderHoldHere();
  Game.clearSelection();
  const heldAt = { x: holder.x, y: holder.y };
  // The only enemy left sits at the far end and never comes: the old stall.
  for (const u of GS.units) if (u.maxHp > 1e6) u.hp = 0;
  const lurker = dummy(api, W - 50, 70, { hp: 30 });
  let far = 0;
  run(Game, 400, () => {
    for (const u of hunters) far = Math.max(far, fromPost(u));
  });
  ok(
    far < 30 && lurker.hp === lurker.maxHp,
    'at first nobody crosses the field for a far-off straggler'
  );
  let killed = false;
  let holderDrift = 0;
  run(Game, 4000, () => {
    if (lurker.hp <= 0 || !GS.units.includes(lurker)) killed = true;
    holderDrift = Math.max(holderDrift, dist(holder, heldAt));
    return killed;
  });
  ok(killed, 'after ten quiet seconds a party goes out and kills it, so the wave can end');
  ok(holderDrift <= 6, `the held soldier stays where he is (${holderDrift.toFixed(1)} px)`);
}

if (failures()) {
  console.error(`\n${failures()} hunt/hold test(s) failed`);
  process.exit(1);
}
console.log('\nAll hunt/hold tests passed.');
