/**
 * The Sapper: mines buried at night, satchel charges by day, blasts that ignore armour,
 * a knife and a retreat up close, veterancy, and mines that survive a save.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { spawnSync } from 'child_process';
import { ROOT, JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';
import { clausesFor } from './lib/roster-clauses.mjs';

const { sb, cvs } = boot(31);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen, SapperKit, Roster, UnitDefs, SiegeLoop, Encyclopedia } = vm.runInContext(
  `${code}\n({ Game, SpriteGen, SapperKit, Roster, UnitDefs, SiegeLoop, Encyclopedia })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.setCreativeSetting?.('freeResources', true);
Game.creativeSetWave?.(8);

const P = Roster.TROOPS.sapper;
const M = P.mines;
const S = P.satchel;
const c = Game.getWorldCenter();
const live = (type, team) =>
  Game.getUnitsSnapshot()
    .filter((u) => u.type === type && u.team === team)
    .map((u) => Game.getUnitById(u.id));
const spawnFoe = (type, x, y) => {
  const before = new Set(Game.getUnitsSnapshot().map((u) => u.id));
  Game.creativeSpawnEnemyAt(type, x, y);
  return Game.getUnitById(Game.getUnitsSnapshot().find((u) => !before.has(u.id)).id);
};
const clearFoes = () => {
  for (const u of Game.getUnitsSnapshot()) if (u.team === 'enemy') Game.getUnitById(u.id).hp = 0;
  Game.update();
};
/** Daylight with no wave on the way: the test brings its own enemies. */
const quietDay = () => {
  Game.creativeForceDay();
  Game.creativeClearWaveSpawns();
  clearFoes();
};
const run = (n) => {
  for (let i = 0; i < n; i++) Game.update();
};

// --- profile and data ---------------------------------------------------------------------
{
  const text = `${P.trait} ${P.weak}`.toLowerCase();
  const untold = clausesFor(P).filter(
    ([k, cl]) => k !== 'kite' && (!cl || !text.includes(cl.toLowerCase()))
  );
  ok(
    untold.length === 0,
    `trait text states the mine and satchel numbers ${untold.map((x) => x[0])}`
  );
  ok(
    /^[A-Z][^—]+ — [A-Z+].+\.$/.test(P.trait) && /\.$/.test(P.weak),
    'trait and weakness are well formed'
  );
  ok(P.role === 'Field engineer' && P.kite === true, 'role is Field engineer and he gives ground');
  ok(
    Roster.MECHANICS.includes('mines') && Roster.MECHANICS.includes('satchel'),
    'mines and satchel are listed mechanics'
  );
  const d = UnitDefs.sapper;
  ok(
    d.type === 'ranged' && d.range === S.reach && !d.projectile,
    'unit data: reach matches the satchel, no projectile'
  );
  ok(d.damage <= 15 && d.meleeRange <= 24, `the knife is weak (${d.damage} damage)`);
  ok(d.hp <= 70, `fragile (${d.hp} hp)`);
  const entry = Encyclopedia.buildRoleEntries().find(
    (e) => /sapper/i.test(e.name) && !/goblin/i.test(e.name)
  );
  ok(
    !entry || !/splash|double damage to siege towers/i.test(entry.body || ''),
    'encyclopedia no longer describes the old Sapper'
  );
}

// --- mines: laid at night, per-night count and cap ----------------------------------------
Game.creativeForceNight();
ok(Game.creativeSpawnPlayerAt('sapper', c.x, c.y + 80), 'spawn a Sapper');
const sapper = live('sapper', 'player')[0];
run(25);
ok(
  SapperKit.getMines().length === M.perNight,
  `he buries ${M.perNight} mines on the night he arrives (${SapperKit.getMines().length})`
);
ok(
  SapperKit.getMines().every(
    (m) => m.y < sapper.y && Math.hypot(m.x - sapper.x, m.y - sapper.y) <= SapperKit.LAY_REACH
  ),
  'in front of his post, towards the enemy'
);
run(60);
ok(SapperKit.getMines().length === M.perNight, 'and no more that night');
ok(live('sapper', 'player')[0].hp === sapper.maxHp, 'mines do not hurt the Sapper');

quietDay();
Game.creativeForceNight();
run(25);
ok(
  SapperKit.getMines().length === 2 * M.perNight,
  `a second night adds ${M.perNight} more (${SapperKit.getMines().length})`
);
quietDay();
Game.creativeForceNight();
run(25);
ok(
  SapperKit.getMines().length === M.cap,
  `never more than ${M.cap} live (${SapperKit.getMines().length})`
);

// --- re-siting a mine with Shift+click ----------------------------------------------------
{
  Game.selectUnit(sapper.id);
  const fake = {
    isNight: true,
    units: [sapper],
    worldW: 4000,
    worldH: 4000,
    wave: 8,
    showMessage: () => {},
    burst: () => {},
    playSfx: () => {},
    float: () => {},
  };
  const tx = sapper.x + 70;
  const ty = sapper.y - 20;
  ok(SapperKit.orderMine([sapper.id], tx, ty, fake), 'a mine order is taken at night');
  ok(
    SapperKit.getMines().some((m) => m.x === tx && m.y === ty && m.placed),
    'and a mine moves to the clicked spot'
  );
  ok(SapperKit.getMines().length === M.cap, 'without adding one');
  const far = SapperKit.orderMine([sapper.id], sapper.x + 600, sapper.y, fake);
  ok(
    far && !SapperKit.getMines().some((m) => m.x === sapper.x + 600),
    'out of reach is refused, and is not a move order'
  );
  ok(
    !SapperKit.orderMine([sapper.id], tx + 60, ty, { ...fake, isNight: false }),
    'by day Shift+click is an ordinary order'
  );
  const foot = { id: 'f1', type: 'footman', team: 'player', hp: 10 };
  ok(
    !SapperKit.orderMine(['f1'], tx, ty, { ...fake, units: [foot] }),
    'other soldiers are not affected'
  );
}

// --- mines trigger on enemies only --------------------------------------------------------
quietDay();
{
  const mine = SapperKit.getMines()[0];
  const n0 = SapperKit.getMines().length;
  Game.creativeSpawnPlayerAt('footman', mine.x, mine.y);
  const foot = live('footman', 'player')[0];
  foot.x = mine.x;
  foot.y = mine.y;
  foot.manualOrder = true;
  run(10);
  ok(SapperKit.getMines().length === n0, 'a footman standing on a mine does not set it off');
  const hpFoot = foot.hp;

  // A flyer overhead does not trip it either.
  const bird = spawnFoe('goblin', mine.x, mine.y - 4);
  bird.flying = true;
  bird.pinned = true;
  bird.pinTimer = 30;
  run(6);
  ok(SapperKit.getMines().length === n0, 'nor does a flyer overhead');
  bird.hp = 0;

  // --- blast damage, radius, stagger -----------------------------------------------------
  const tripper = spawnFoe('orc', mine.x + 3, mine.y);
  const inside = spawnFoe('orc', mine.x + M.r - 6, mine.y);
  const outside = spawnFoe('orc', mine.x + M.r + 14, mine.y);
  for (const u of [tripper, inside, outside]) {
    u.maxHp = u.hp = 1000;
    u.pinned = true;
    u.pinTimer = 3;
  }
  const scorch0 = SapperKit.getScorches().length;
  run(3);
  ok(SapperKit.getMines().length === n0 - 1, 'an orc stepping on it sets it off, once');
  const dealt = 1000 - tripper.hp;
  ok(
    dealt > M.dmg * 0.6 && dealt <= M.dmg * 1.01,
    `the blast deals about ${M.dmg} at its centre (${dealt.toFixed(1)})`
  );
  ok(inside.hp < 1000 && 1000 - inside.hp < dealt, 'less at the rim');
  ok(outside.hp === 1000, 'and nothing beyond the radius');
  ok(tripper.pinned && tripper.pinTimer > 20, 'the blast staggers those it catches');
  ok(
    foot.hp === hpFoot && sapper.hp === sapper.maxHp,
    'no harm to the footman on top of it or to the Sapper'
  );
  ok(
    SapperKit.getBlasts().length >= 1 && SapperKit.getScorches().length === scorch0 + 1,
    'it leaves a blast effect and a scorch mark'
  );
  foot.hp = 0;
  clearFoes();
}

// --- blasts ignore armour; ordinary blows do not -------------------------------------------
{
  const ctx = { tick: 5, hurt: () => {}, playSfx: () => {}, rng: () => 0.9, float: () => {} };
  const brute = {
    type: 'iron_colossus',
    team: 'enemy',
    hp: 400,
    maxHp: 400,
    x: 0,
    y: 0,
    wardUntil: 99,
  };
  const shield = { type: 'orc_shieldbearer', team: 'enemy', hp: 100, maxHp: 100, x: 0, y: 0 };
  const thrower = { type: 'sapper', team: 'player', range: 110, hp: 10, x: 50, y: 0 };
  const plain = Roster.modifyDamageTaken(shield, 100, { attacker: thrower }, ctx);
  const blown = Roster.modifyDamageTaken(shield, 100, { attacker: thrower, demolition: true }, ctx);
  ok(
    plain < 100 && blown === 100,
    `a tower shield stops a bolt (${plain}) but not a blast (${blown})`
  );
  const blown2 = Roster.modifyDamageTaken(brute, 100, { attacker: thrower, demolition: true }, ctx);
  const plain2 = Roster.modifyDamageTaken(brute, 100, { attacker: thrower }, ctx);
  ok(
    blown2 === 100 && plain2 < 100,
    `an iron shell and a ward do not blunt it either (${plain2} vs ${blown2})`
  );
  const foot = { type: 'footman', team: 'player', hp: 100, maxHp: 100, braceN: 3, x: 0, y: 0 };
  ok(
    Roster.modifyDamageTaken(foot, 100, { demolition: true }, ctx) === 100,
    'brace is skipped the same way'
  );

  // Heavy targets and siege engines take more; line-breakers take more from mines only.
  const hits = [];
  const mk = (type, extra) => ({
    id: type,
    type,
    team: 'enemy',
    hp: 9999,
    maxHp: 9999,
    x: 100,
    y: 100,
    ...extra,
  });
  const field = [
    mk('goblin'),
    mk('troll'),
    mk('siege_tower'),
    mk('orc', { lineBreaker: true }),
    mk('harpy', { flying: true }),
  ];
  const bctx = {
    tick: 1,
    units: field,
    hurt: (u, amt, a, echo, extra) => hits.push([u.type, amt, extra]),
    playSfx: () => {},
    shake: () => {},
    burst: () => {},
    float: () => {},
  };
  SapperKit.blast(100, 100, 40, 50, { ...thrower, siegeMult: 2 }, bctx, 'mine');
  const by = Object.fromEntries(hits.map((h) => [h[0], h[1]]));
  ok(by.goblin === 50, `ordinary against a goblin (${by.goblin})`);
  ok(by.troll === 50 * SapperKit.HEAVY_MULT, `heavier against a troll (${by.troll})`);
  ok(by.siege_tower === 100, `siegeMult against a siege tower (${by.siege_tower})`);
  ok(
    Math.abs(by.orc - 50 * M.runner) < 0.01,
    `a mine hits a line-breaker ${M.runner}x (${by.orc})`
  );
  ok(by.harpy === undefined, 'flyers are out of reach');
  ok(
    hits.every((h) => h[2] && h[2].demolition),
    'every blast blow is flagged as demolition'
  );
  hits.length = 0;
  SapperKit.blast(100, 100, 40, 50, thrower, bctx, 'satchel');
  ok(hits.find((h) => h[0] === 'orc')[1] === 50, 'a satchel has no line-breaker bonus');
  // Bosses shrug off most of the stagger.
  const boss = mk('orc', { isNamedBoss: true });
  const grunt = mk('orc');
  SapperKit.blast(100, 100, 40, 50, thrower, { ...bctx, units: [boss, grunt] }, 'mine');
  ok(
    boss.pinTimer > 0 && boss.pinTimer < grunt.pinTimer / 2,
    `a boss is staggered for less (${boss.pinTimer} vs ${grunt.pinTimer})`
  );
  SapperKit.getBlasts().length = 0;
}

// --- satchel: targets the thickest knot, respects its cooldown -----------------------------
{
  const me = {
    id: 's',
    type: 'sapper',
    team: 'player',
    hp: 60,
    x: 500,
    y: 500,
    meleeRange: 22,
    wavesSurvived: 0,
  };
  const foe = (id, x, y, extra) => ({
    id,
    type: 'orc',
    team: 'enemy',
    hp: 80,
    maxHp: 80,
    x,
    y,
    mustered: true,
    ...extra,
  });
  const lone = foe('lone', 500, 440);
  const knot = [foe('k1', 560, 430), foe('k2', 568, 436), foe('k3', 556, 440)];
  const farKnot = [
    foe('f1', 500, 200),
    foe('f2', 505, 205),
    foe('f3', 495, 204),
    foe('f4', 500, 210),
  ];
  const ctx = {
    tick: 1000,
    units: [me, lone, ...knot, ...farKnot],
    playSfx: () => {},
    hurt: (u, amt) => (u.hp -= amt),
    shake: () => {},
    burst: () => {},
    float: () => {},
  };
  const n0 = SapperKit.getSatchels().length;
  ok(SapperKit.fire(me, lone, ctx) === true, 'beyond knife range the attack is a satchel');
  const s = SapperKit.getSatchels()[n0];
  ok(
    !!s && Math.hypot(s.x - 561, s.y - 435) < 12,
    `thrown at the knot of three, not the lone orc he was aiming at (${s && Math.round(s.x)},${s && Math.round(s.y)})`
  );
  ok(Math.hypot(s.x - me.x, s.y - me.y) <= S.reach + 0.01, 'within his reach');
  ctx.tick += 60;
  ok(
    SapperKit.fire(me, lone, ctx) === true && SapperKit.getSatchels().length === n0 + 1,
    'no second charge during the reload'
  );
  ctx.tick = 1000 + SapperKit.cooldownOf(me) + 1;
  SapperKit.fire(me, lone, ctx);
  ok(
    SapperKit.getSatchels().length === n0 + 2,
    `ready again after ${SapperKit.cooldownOf(me)} ticks`
  );
  ok(SapperKit.cooldownOf(me) === S.cd, 'a recruit reloads at the profile rate');

  // Flight, fuse, blast.
  const s2 = SapperKit.getSatchels()[n0 + 1];
  ok(s2.blow - s2.t0 === SapperKit.FLIGHT + SapperKit.FUSE, 'it flies, then burns its fuse');
  const hp0 = knot[0].hp;
  SapperKit.getSatchels().splice(n0, 1);
  ctx.tick = s2.blow - 1;
  ctx.isNight = true; // skip kiting; mines and satchels still run
  ctx.worldW = ctx.worldH = 4000;
  ctx.wave = 8;
  SapperKit.update(ctx);
  ok(knot[0].hp === hp0, 'nothing happens while the fuse burns');
  ctx.tick = s2.blow;
  SapperKit.update(ctx);
  ok(
    knot.every((k) => k.hp < 80) && lone.hp === 80 && farKnot.every((k) => k.hp === 80),
    'then the knot is hit and nobody else'
  );

  // Leads a moving pack.
  const runner = foe('r', 500, 420, { skVx: 0, skVy: 1.4, lineBreaker: true });
  ctx.units = [me, runner];
  ctx.tick += 1000;
  SapperKit.fire(me, runner, ctx);
  const s3 = SapperKit.getSatchels().at(-1);
  ok(
    s3.y > runner.y + 40,
    `a charge is thrown ahead of a runner (${Math.round(s3.y - runner.y)} px ahead)`
  );

  // Knife range: the engine jabs, on its own slow timer. Nothing to throw at: nothing thrown.
  const close = foe('c', 510, 505);
  ctx.units = [me, close];
  ctx.tick += 1000;
  const n1 = SapperKit.getSatchels().length;
  ok(SapperKit.fire(me, close, ctx) === false, 'in knife range he jabs instead');
  ok(SapperKit.fire(me, close, ctx) === true, 'and cannot jab again at once');
  ctx.tick += SapperKit.KNIFE_CD;
  ok(SapperKit.fire(me, close, ctx) === false, 'until the knife is ready');
  ok(SapperKit.getSatchels().length === n1, 'no charge is thrown at his own feet');
  const flyer = foe('h', 500, 430, { flying: true });
  ctx.units = [me, flyer];
  ctx.tick += 1000;
  SapperKit.fire(me, flyer, ctx);
  ok(SapperKit.getSatchels().length === n1, 'nor at a flyer');
  ok(
    SapperKit.fire({ type: 'archer', team: 'player' }, lone, ctx) === false,
    'other troops are untouched'
  );
  SapperKit.getSatchels().length = 0;
  SapperKit.getBlasts().length = 0;

  // --- veterancy ---------------------------------------------------------------------------
  ok(SapperKit.gradeOf(me) === 0, 'a recruit has no grade');
  const vet = { ...me, id: 'v', wavesSurvived: 4 };
  const old = { ...me, id: 'o', kills: 20 };
  ok(
    SapperKit.gradeOf(vet) === 1 && SapperKit.gradeOf(old) === 2,
    'nights survived or kills raise it'
  );
  ok(
    SapperKit.fuseOf(vet) < SapperKit.fuseOf(me) && SapperKit.fuseOf(old) < SapperKit.fuseOf(vet),
    'a veteran cuts a shorter fuse'
  );
  ok(SapperKit.cooldownOf(old) < SapperKit.cooldownOf(me), 'and reloads faster');
  const nctx = { ...ctx, isNight: true, units: [vet], wave: 30, worldW: 4000, worldH: 4000 };
  vet.x = 2000;
  vet.y = 2000;
  const before = SapperKit.getMines().length;
  ok(SapperKit.layFor(vet, nctx) === M.perNight + 1, `a veteran buries ${M.perNight + 1} a night`);
  SapperKit.layFor(vet, nctx);
  SapperKit.layFor(vet, nctx);
  ok(SapperKit.getMines().length - before === M.cap + 1, `and keeps ${M.cap + 1} live`);
  for (let i = SapperKit.getMines().length - 1; i >= 0; i--) {
    if (SapperKit.getMines()[i].o === 'v') SapperKit.getMines().splice(i, 1);
  }
}

// --- in the real engine: he throws, the charge lands, he backs off, he dies alone ----------
{
  clearFoes();
  run(5);
  SapperKit.getMines().length = 0;
  sapper.x = c.x;
  sapper.y = c.y + 80;
  sapper.postX = sapper.x;
  sapper.postY = sapper.y;
  sapper.manualOrder = false;
  sapper.satchelReadyAt = 0;
  const pack = [0, 1, 2].map((i) => spawnFoe('orc', sapper.x - 10 + i * 10, sapper.y - 96));
  for (const u of pack) {
    u.maxHp = u.hp = 500;
    u.pinned = true;
    u.pinTimer = 400;
  }
  let threw = false;
  let arrows = 0;
  for (let i = 0; i < 200; i++) {
    Game.update();
    if (SapperKit.getSatchels().length) threw = true;
    arrows = Math.max(arrows, Game.getState().projectileCount || 0);
    if (threw && !SapperKit.getSatchels().length) break;
  }
  ok(threw, 'in a real fight he throws a satchel at enemies in reach');
  ok(
    pack.every((u) => u.hp < 500),
    `and it lands on them (${pack.map((u) => Math.round(500 - u.hp))})`
  );
  ok(pack[1].hp > 500 - S.dmg * 1.6, 'for satchel damage, not more');
  for (const u of pack) u.hp = 0;
  run(3);

  // Kite: an enemy in his face makes him give ground.
  sapper.kiteCd = 0;
  sapper.kiteMove = 0;
  sapper.attackAnimTimer = 0;
  const brute = spawnFoe('orc', sapper.x, sapper.y - 24);
  brute.maxHp = brute.hp = 5000;
  brute.damage = 0;
  brute.pinned = true;
  brute.pinTimer = 300;
  const y0 = sapper.y;
  const gap0 = Math.hypot(sapper.x - brute.x, sapper.y - brute.y);
  run(60);
  const gap1 = Math.hypot(sapper.x - brute.x, sapper.y - brute.y);
  ok(
    gap1 > gap0 + 15 && sapper.y > y0,
    `he backs away from an enemy in knife range (${gap0.toFixed(0)} -> ${gap1.toFixed(0)})`
  );
  // Once it is clear he goes back to his post, and he does not chase what he cannot hurt.
  brute.hp = 0;
  run(420);
  const home = Math.hypot(sapper.x - sapper.postX, sapper.y - sapper.postY);
  ok(home < 20, `and is back at his post when the danger is gone (${home.toFixed(1)} away)`);
  const bird = spawnFoe('goblin', sapper.x, sapper.y - 200);
  bird.flying = true;
  bird.pinned = true;
  bird.pinTimer = 400;
  bird.maxHp = bird.hp = 5000;
  run(200);
  ok(
    Math.hypot(sapper.x - sapper.postX, sapper.y - sapper.postY) < 20 &&
      sapper.combatTargetId !== bird.id,
    'he does not chase a flyer he cannot hurt'
  );
  bird.hp = 0;
  run(3);

  // Alone against a pack he dies.
  Game.creativeSetWave?.(10);
  sapper.hp = sapper.maxHp;
  const mob = [0, 1, 2, 3, 4].map((i) =>
    spawnFoe(i < 3 ? 'orc' : 'warg_rider', sapper.x - 40 + i * 20, sapper.y - 60)
  );
  let died = false;
  for (let i = 0; i < 2400 && !died; i++) {
    Game.update();
    if (process.env.SAPPER_TRACE && i % 60 === 0)
      console.log(
        i,
        Math.round(sapper.hp),
        Math.round(sapper.x),
        Math.round(sapper.y),
        mob
          .map(
            (u) => `${Math.round(u.hp)}@${Math.round(u.x)},${Math.round(u.y)}${u.pinned ? 'P' : ''}`
          )
          .join(' ')
      );
    died = !(sapper.hp > 0); // a dead unit goes back to the pool and is wiped
  }
  ok(
    died,
    `an unprotected Sapper dies to a pack (${mob.filter((u) => u.hp > 0).length} of 5 still standing)`
  );
  clearFoes();
}

// --- save and load -------------------------------------------------------------------------
{
  Game.creativeForceNight();
  ok(
    Game.creativeSpawnPlayerAt('sapper', c.x + 120, c.y + 90),
    'a second Sapper for the save test'
  );
  run(25);
  const before = SapperKit.getMines().map((m) => [Math.round(m.x), Math.round(m.y), m.o]);
  ok(before.length >= M.perNight, `mines are live before saving (${before.length})`);
  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  ok(
    Array.isArray(snap.siegeLoop?.sapperKit?.mines) &&
      snap.siegeLoop.sapperKit.mines.length === before.length,
    'the save holds every live mine'
  );
  SapperKit.reset();
  ok(SapperKit.getMines().length === 0, 'cleared');
  ok(Game.importGameState(snap), 'the save loads');
  const after = SapperKit.getMines().map((m) => [Math.round(m.x), Math.round(m.y), m.o]);
  ok(
    JSON.stringify(after) === JSON.stringify(before),
    'and the mines are back where they were, with their owners'
  );
  run(40);
  ok(SapperKit.getMines().length === before.length, 'a loaded night does not lay a second set');
  // The map growing moves them with everything else.
  const m0 = { ...SapperKit.getMines()[0] };
  SapperKit.shift(30, -12);
  ok(
    SapperKit.getMines()[0].x === m0.x + 30 && SapperKit.getMines()[0].y === m0.y - 12,
    'mines move when the map grows'
  );
  // A new siege starts clean.
  SiegeLoop.startRun({
    creative: true,
    tick: 0,
    isNight: true,
    ambience: () => {},
    menuModeId: 'campaign',
  });
  ok(SapperKit.getMines().length === 0, 'a new siege starts with no mines');
}

// --- the roster suite still passes ----------------------------------------------------------
{
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'test-roster.mjs')], {
    encoding: 'utf8',
  });
  ok(
    r.status === 0,
    `scripts/test-roster.mjs still passes ${
      r.status === 0
        ? ''
        : (r.stdout || '')
            .split('\n')
            .filter((l) => l.startsWith('FAIL'))
            .join(' | ')
    }`
  );
}

console.log(failures() ? `\n${failures()} FAILED` : '\nAll Sapper checks passed');
process.exit(failures() ? 1 : 0);
