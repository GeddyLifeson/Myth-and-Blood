/**
 * One field for the whole run:
 *   1. the three top-edge entry sectors (plan, weights, per-sector counts, save shape);
 *   2. the field never grows, and a save made on a grown map still loads;
 *   3. waves 100 and 200 are announced but wipe nothing: army, veterans, buildings and
 *      posts carry straight through 99-101 and 199-201, also across a save and load.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

ok(HEADLESS_FILES.includes('progression-restarts.js'), 'the era module runs in headless sims');
ok(HEADLESS_FILES.includes('multi-front-siege.js'), 'the sector module runs in headless sims');

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed, diff = 'normal') {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameState, MultiFrontSiege, ProgressionRestarts,
      createBuilding, getWorldSize, getLegacyWorldSize, getUnlockedAttackSides, EnemyDefs })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty(diff);
  api.Game.start();
  return api;
}

/** Plays the day out: every enemy is noted as it appears, then killed. Stops at night. */
function playDay(Game, GS, seen = null) {
  for (let i = 0; i < 60000 && GS.timeOfDay !== 'night'; i++) {
    for (const u of GS.units) {
      if (u.team === 'player') u.hp = u.maxHp;
      else if (u.hp > 0) {
        // The host only: not counter-raids, not the beasts of the field.
        if (seen && !u.isCounterRaid && !String(u.type).startsWith('wild_'))
          seen.push({ sector: u.entrySector, x: u.x, y: u.y, type: u.type });
        u.hp = 0;
      }
    }
    Game.update();
  }
  return GS.timeOfDay === 'night';
}

/** Skips the day: the queue is emptied and the field cleared. Stops at night. */
function toNight(Game, GS) {
  for (let i = 0; i < 20000 && GS.timeOfDay !== 'night'; i++) {
    for (const u of GS.units) {
      if (u.team === 'player') u.hp = u.maxHp;
      else u.hp = 0;
    }
    GS.spawnQueue.length = 0;
    Game.update();
  }
  return GS.timeOfDay === 'night';
}

const rngOf = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

// --- 1. the sector planner ----------------------------------------------------------------
{
  const { MultiFrontSiege: MF } = start(3);
  ok(MF.SECTORS.join() === 'left,centre,right', 'three sectors along the top edge');
  ok(
    MF.sectorAt(10, 400) === 'left' &&
      MF.sectorAt(200, 400) === 'centre' &&
      MF.sectorAt(390, 400) === 'right',
    'a third of the width each'
  );
  const rng = rngOf(7);
  let inside = true;
  for (const s of MF.SECTORS) {
    const b = MF.sectorBounds(s, 400);
    for (let i = 0; i < 200; i++) {
      const x = MF.spawnX(s, 400, rng);
      if (x < Math.max(24, b.x0) || x > Math.min(376, b.x1)) inside = false;
    }
  }
  ok(inside, 'spawn x stays inside its sector and off the field edge');

  for (const kind of ['ordinary', 'horde', 'boss']) {
    for (const wave of [1, 5, 10, 20, 40, 80, 150, 250]) {
      const w = MF.sectorCountWeights(wave, kind);
      const sum = w[0] + w[1] + w[2];
      ok(
        Math.abs(sum - 1) < 1e-9 && w.every((p) => p >= 0),
        `${kind} wave ${wave}: weights ${w.map((p) => p.toFixed(2)).join('/')} sum to 1`
      );
    }
  }
  const mean = (wave, kind) => {
    const w = MF.sectorCountWeights(wave, kind);
    return w[0] + 2 * w[1] + 3 * w[2];
  };
  ok(MF.sectorCountWeights(1, 'ordinary')[0] === 1, 'the first waves come by one sector');
  ok(mean(40, 'ordinary') > mean(5, 'ordinary'), 'ordinary waves widen as the war goes on');
  ok(mean(20, 'horde') > mean(20, 'ordinary'), 'a horde comes wider than an ordinary wave');
  ok(mean(20, 'boss') < mean(20, 'ordinary'), 'a boss comes on a narrower front');
  ok(
    mean(20, 'ordinary', 0) <
      (() => {
        const w = MF.sectorCountWeights(20, 'ordinary', 0.5);
        return w[0] + 2 * w[1] + 3 * w[2];
      })(),
    'a host that outranks the commander spreads wider'
  );

  // Rolled plans: every count of sectors appears, shares sum to 1, counts sum to the host.
  const seenN = new Set();
  let good = true;
  let bossOk = true;
  for (let i = 0; i < 400; i++) {
    const kind = ['ordinary', 'horde', 'boss'][i % 3];
    const queue = [];
    const n = 6 + (i % 30);
    for (let j = 0; j < n; j++) queue.push(['goblin', 'orc', 'archer', 'troll'][(j * 7 + i) % 4]);
    if (kind === 'boss') queue.unshift('boss_x');
    const plan = MF.buildPlan({
      wave: 5 + (i % 60),
      kind,
      queue,
      rng: rngOf(i + 1),
      isBossType: (t) => t === 'boss_x',
    });
    seenN.add(plan.sectors.length);
    const share = plan.sectors.reduce((a, s) => a + plan.shares[s], 0);
    const count = plan.sectors.reduce((a, s) => a + plan.counts[s], 0);
    if (Math.abs(share - 1) > 1e-9 || count !== queue.length || plan.total !== queue.length)
      good = false;
    if (
      plan.sectors.some(
        (s) => plan.counts[s] <= 0 || plan.types[s].length < 1 || plan.types[s].length > 2
      )
    )
      good = false;
    if (kind === 'boss' && plan.bossSector !== plan.main) bossOk = false;
    if (kind !== 'boss' && plan.bossSector) bossOk = false;
    // Dawn: the same host gets exactly the night's counts, one sector per enemy.
    const night = { ...plan.counts };
    const sectors = MF.assignQueue(plan, queue, (t) => t === 'boss_x');
    const tally = {};
    for (const s of sectors) tally[s] = (tally[s] || 0) + 1;
    if (sectors.length !== queue.length) good = false;
    for (const s of plan.sectors)
      if (tally[s] !== night[s] || plan.counts[s] !== night[s]) good = false;
    if (kind === 'boss' && sectors[queue.indexOf('boss_x')] !== plan.bossSector) bossOk = false;
  }
  ok(seenN.has(1) && seenN.has(2) && seenN.has(3), 'plans use one, two and three sectors');
  ok(good, 'shares sum to 1, counts sum to the host, and dawn matches the night exactly');
  ok(bossOk, 'the boss enters by the main sector, and only boss waves carry a skull');

  // A host that changed overnight: extras go where the plan is furthest behind.
  const plan = MF.buildPlan({
    wave: 30,
    kind: 'ordinary',
    queue: Array(20).fill('goblin'),
    rng: rngOf(99),
  });
  const dawn = Array(20).fill('goblin').concat(Array(10).fill('orc'));
  const out = MF.assignQueue(plan, dawn, null);
  ok(
    out.length === 30 &&
      plan.sectors.reduce((a, s) => a + plan.counts[s], 0) === 30 &&
      plan.total === 30,
    'a host that grew overnight is still fully assigned, and the counts follow it'
  );

  // Save shape.
  const p2 = MF.buildPlan({
    wave: 12,
    kind: 'horde',
    queue: null,
    count: 31,
    poolTypes: ['goblin', 'orc', 'troll'],
    rng: rngOf(5),
  });
  ok(
    p2.sectors.reduce((a, s) => a + p2.counts[s], 0) === 31 &&
      p2.types[p2.main].join() === 'goblin,orc',
    'without a forecast the plan still splits the expected head count'
  );
  const back = MF.restorePlan(JSON.parse(JSON.stringify(p2)), 12);
  ok(
    back &&
      JSON.stringify(back.sectors) === JSON.stringify(p2.sectors) &&
      JSON.stringify(back.counts) === JSON.stringify(p2.counts) &&
      back.kind === 'horde' &&
      back.main === p2.main,
    'a plan survives a JSON round trip'
  );
  ok(
    MF.restorePlan(JSON.parse(JSON.stringify(p2)), 13) === null,
    'a plan for another wave is refused'
  );
  ok(MF.restorePlan({ wave: 12, sides: ['east'] }, 12) === null, 'an old flank plan is refused');
  ok(
    MF.restorePlan({ wave: 12, sectors: ['left', 'up'] }, 12) === null,
    'an unknown sector is refused'
  );
  const spawn = MF.resolveCounterRaidSpawn(
    'x',
    { x: 350, y: 500 },
    { worldW: 400, worldH: 600, rng: rngOf(1) }
  );
  ok(
    spawn.side === 'north' && spawn.y < 40 && spawn.sector === 'right',
    'counter-raids come from the top edge too'
  );
}

// --- 2. sectors in play ---------------------------------------------------------------------
{
  const { Game, GameState: GS, MultiFrontSiege: MF, SiegeLoop, getUnlockedAttackSides } = start(41);
  ok(
    getUnlockedAttackSides(1).join() === 'north' && getUnlockedAttackSides(400).join() === 'north',
    'the top edge is the only edge, at any wave'
  );
  let allTop = true;
  let allInSector = true;
  let countsReal = true;
  let nightMatches = 0;
  let nightWaves = 0;
  let multi = 0;
  const notes = [];
  // Jump ahead so two- and three-sector plans come up, then play ten waves through.
  ok(playDay(Game, GS), 'wave 1 played to the first night');
  GS.wave = 16;
  toNight(Game, GS);
  for (let n = 0; n < 10; n++) {
    if (!GS.nextWavePlan || GS.nextWavePlan.wave !== GS.wave + 1) {
      // The wave number was set by hand; let the game roll the plan as nightfall would.
      Game.importGameState(
        JSON.parse(JSON.stringify({ ...Game.exportGameState(), nextWavePlan: null }))
      );
      GS.paused = false;
    }
    const night = JSON.parse(JSON.stringify(GS.nextWavePlan));
    Game.updatePresentation?.();
    const marks = SiegeLoop.spawnMarkers({
      isNight: true,
      nextSectorPlan: GS.nextWavePlan,
      worldW: GS.worldW,
    });
    if (
      marks.length !== night.sectors.length ||
      marks.some((m) => m.count !== night.counts[m.sector])
    )
      countsReal = false;
    Game.beginDayPhase(true);
    const dawn = JSON.parse(JSON.stringify(GS.sectorPlan));
    const queued = GS.spawnQueue.length;
    if (GS.spawnSectors.length !== queued) countsReal = false;
    if (dawn.sectors.join() !== night.sectors.join()) countsReal = false;
    const seen = [];
    playDay(Game, GS, seen);
    const tally = {};
    for (const e of seen) {
      tally[e.sector] = (tally[e.sector] || 0) + 1;
      if (e.y > 140) allTop = false;
      const b = MF.sectorBounds(e.sector, GS.worldW);
      if (!(e.x >= b.x0 - 1 && e.x <= b.x1 + 1)) allInSector = false;
    }
    for (const s of dawn.sectors) if ((tally[s] || 0) !== dawn.counts[s]) countsReal = false;
    if (seen.length !== queued) countsReal = false;
    nightWaves++;
    if (
      dawn.sectors.every(
        (s) => Math.abs(dawn.counts[s] - night.counts[s]) <= Math.max(2, night.counts[s] * 0.25)
      )
    )
      nightMatches++;
    if (dawn.sectors.length > 1) multi++;
    notes.push(
      `w${GS.wave} ${dawn.kind} ${dawn.sectors.map((s) => `${s} ${night.counts[s]}→${dawn.counts[s]}`).join(', ')}`
    );
  }
  console.log('  night → dawn per sector:', notes.join(' | '));
  ok(allTop, 'every enemy appears at the top edge');
  ok(allInSector, 'every enemy appears inside its own sector');
  ok(countsReal, 'the enemies that enter a sector are exactly the count the plan gives it');
  ok(
    multi >= 3,
    `waves in the high teens and twenties often use more than one sector (${multi}/10)`
  );
  ok(
    nightMatches >= 7,
    `the night marker is within a quarter of the dawn count in most waves (${nightMatches}/${nightWaves})`
  );
}

// --- 3. one size ---------------------------------------------------------------------------
{
  const { Game, GameState: GS, getWorldSize, getLegacyWorldSize } = start(52);
  for (const w of [0, 1, 9, 10, 50, 99, 100, 101, 199, 200, 201, 500]) {
    const size = getWorldSize(w);
    ok(
      size.w === 400 && size.h === 600 && size.expandTier === 0,
      `wave ${w}: the field is 400×600`
    );
  }
  ok(getWorldSize(50).tier > getWorldSize(1).tier, 'the land tier still rises with the waves');
  ok(toNight(Game, GS), 'first night');
  const rally = GS.rallyY;
  const deploy = GS.deployY;
  for (const w of [11, 31, 61]) {
    GS.wave = w - 1;
    Game.beginDayPhase(true);
    toNight(Game, GS);
    ok(
      GS.worldW === 400 && GS.worldH === 600 && GS.rallyY === rally && GS.deployY === deploy,
      `after wave ${w} the field, the rally line and the deploy line have not moved`
    );
  }
  ok(GS.territoryTier >= 5, `land tier ${GS.territoryTier} at wave ${GS.wave}`);
  ok(
    GS.decorations.every((d) => d.x >= 0 && d.x <= 400 && d.y >= 0 && d.y <= 600),
    'field features left by later tiers are on the field'
  );
  ok(
    GS.decorations.filter((d) => d.isNeutralDen && d.hp > 0).length <= 4,
    'beast dens do not pile up'
  );

  // A save made on a grown map (wave 61 used to be 940×1260).
  const old = getLegacyWorldSize(61);
  ok(old.w === 940 && old.h === 1260, `the old field at wave 61 was ${old.w}×${old.h}`);
  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  const where = new Map(
    snap.units.map((u) => [u.id, { x: u.x, y: u.y, postX: u.postX, postY: u.postY }])
  );
  const dx = (old.w - 400) / 2;
  const dy = (old.h - 600) / 2;
  snap.worldW = old.w;
  snap.worldH = old.h;
  for (const u of snap.units) {
    u.x += dx;
    u.y += dy;
    if (u.targetY != null) u.targetY += dy;
    if (u.postX != null) u.postX += dx;
    if (u.postY != null) u.postY += dy;
  }
  snap.buildings.push(
    {
      id: 'old_wall',
      type: 'wall',
      x: 200 + dx,
      y: 470 + dy,
      hp: 100,
      maxHp: 100,
      complete: true,
      owner: 'player',
      buildProgress: 1,
    },
    {
      id: 'far_wall',
      type: 'wall',
      x: 900,
      y: 1200,
      hp: 100,
      maxHp: 100,
      complete: true,
      owner: 'player',
      buildProgress: 1,
    }
  );
  const stray = {
    ...snap.units.find((u) => u.team === 'player'),
    id: 'stray_1',
    x: 20,
    y: 30,
    postX: 20,
    postY: 30,
  };
  snap.units.push(stray);
  ok(Game.importGameState(snap), 'a save from a grown map loads');
  ok(GS.worldW === 400 && GS.worldH === 600, 'onto the one field');
  let back = true;
  let inField = true;
  for (const u of GS.units) {
    if (u.x < 14 || u.x > 386 || u.y < 20 || u.y > 592) inField = false;
    const was = where.get(u.id);
    if (!was) continue;
    if (Math.hypot(u.x - was.x, u.y - was.y) > 40) back = false;
    if (was.postX != null && Math.hypot(u.postX - was.postX, u.postY - was.postY) > 1) back = false;
  }
  ok(back, 'soldiers and their posts are back where they stood on the home ground');
  ok(
    inField && GS.units.some((u) => u.id === 'stray_1'),
    'a soldier from the added land is brought onto the field'
  );
  const oldWall = GS.buildings.find((b) => b.id === 'old_wall');
  const farWall = GS.buildings.find((b) => b.id === 'far_wall');
  ok(
    oldWall && oldWall.x === 200 && oldWall.y === 470,
    'a building on the home ground keeps its place'
  );
  ok(
    farWall && farWall.x <= 370 && farWall.y <= 570,
    `a building on the added land is brought in (${farWall?.x}, ${farWall?.y})`
  );
  GS.paused = false;
  let threw = null;
  try {
    Game.beginDayPhase(true);
    for (let i = 0; i < 600; i++) Game.update();
  } catch (e) {
    threw = e;
  }
  ok(!threw, `the loaded run plays on${threw ? `: ${threw.message}` : ''}`);
}

// --- 4. eras: 99-101 and 199-201 -----------------------------------------------------------
for (const era of [100, 200]) {
  const { Game, GameState: GS, ProgressionRestarts: PR, createBuilding } = start(60 + era);
  ok(toNight(Game, GS), `era ${era}: first night`);
  // A base worth losing: walls, a mine, a tower, and soldiers with posts and service.
  const mk = (type, x, y) => {
    const b = createBuilding(type, x, y, 'player');
    b.complete = true;
    b.buildProgress = 9999;
    GS.buildings.push(b);
    return b;
  };
  mk('wall', 150, 440);
  mk('wall', 180, 440);
  mk('wall', 210, 440);
  mk('watchtower', 260, 470);
  mk('research_lab', 120, 520);
  GS.tactical = 400;
  const army = GS.units.filter((u) => u.team === 'player' && u.hp > 0);
  ok(army.length >= 3, `era ${era}: an army of ${army.length}`);
  army.forEach((u, i) => {
    u.kills = 20 + i;
    u.wavesSurvived = 30;
    u.postX = u.x;
    u.postY = u.y;
  });
  const vet = army[0];
  vet.honorName = 'Old Hand';
  const ids = () =>
    GS.units
      .filter((u) => u.team === 'player' && u.hp > 0)
      .map((u) => u.id)
      .sort()
      .join();
  const bids = () =>
    GS.buildings
      .filter((b) => b.owner === 'player' && b.hp > 0)
      .map((b) => b.id)
      .sort()
      .join();
  const posts = () =>
    GS.units
      .filter((u) => u.team === 'player' && u.hp > 0)
      .map((u) => `${u.id}:${Math.round(u.postX)},${Math.round(u.postY)}`)
      .sort()
      .join();
  const beforeUnits = ids();
  const beforeBuildings = bids();
  const beforePosts = posts();
  const messages = [];
  const realShow = Game.showMessage;
  let threw = null;
  let savedAt99 = null;
  GS.wave = era - 2;
  try {
    for (const w of [era - 1, era, era + 1]) {
      const tpBefore = GS.tactical;
      Game.beginDayPhase(true);
      ok(GS.wave === w, `wave ${w} begins`);
      if (w === era) {
        ok(
          GS.tactical >= tpBefore - 1,
          `wave ${w}: TP is not taken (${tpBefore} → ${GS.tactical})`
        );
        ok(PR.getSnapshot().fired.includes(era), `wave ${w}: the era is recorded`);
        const snap = Game.getState().progressionRestart;
        ok(
          snap?.lastEra?.wave === era && /era/.test(snap.hudLine),
          `wave ${w}: the HUD names the era (${snap?.hudLine})`
        );
        ok(
          (GS.sessionHighlights || []).some((h) =>
            new RegExp(`wave ${era}`).test(JSON.stringify(h))
          ),
          `wave ${w}: the era is announced in the run's highlights`
        );
      }
      ok(ids() === beforeUnits, `wave ${w}: every soldier is still on the field`);
      ok(bids() === beforeBuildings, `wave ${w}: every building still stands`);
      ok(posts() === beforePosts, `wave ${w}: posts are unchanged`);
      ok(GS.worldW === 400 && GS.worldH === 600, `wave ${w}: the field is 400×600`);
      for (let i = 0; i < 240; i++) {
        for (const u of GS.units) if (u.team === 'player') u.hp = u.maxHp;
        Game.update();
      }
      ok(toNight(Game, GS), `wave ${w} cleared`);
      if (w === era - 1) savedAt99 = JSON.parse(JSON.stringify(Game.exportGameState()));
    }
  } catch (e) {
    threw = e;
  }
  void messages;
  void realShow;
  ok(
    !threw,
    `era ${era}: nothing throws across ${era - 1}-${era + 1}${threw ? `: ${threw.stack}` : ''}`
  );
  const v = GS.units.find((u) => u.id === vet.id);
  ok(
    v && v.honorName === 'Old Hand' && v.kills >= 20,
    `era ${era}: the veteran keeps his name and record`
  );
  ok(
    GS.units.filter((u) => u.team === 'player' && u.hp > 0).length === army.length,
    `era ${era}: no free army was handed out`
  );
  ok(
    !GS.buildings.some(
      (b) => b.owner === 'player' && (b.isAcademy || b.isHamlet || b.isMerchantGuild)
    ),
    `era ${era}: no free base was handed out`
  );

  // The same boundary, crossed from a save made the night before it.
  ok(savedAt99 && savedAt99.wave === era - 1, `era ${era}: saved on the night of wave ${era - 1}`);
  let threw2 = null;
  try {
    ok(Game.importGameState(savedAt99), `era ${era}: that save loads`);
    GS.paused = false;
    ok(!PR.getSnapshot().fired.includes(era), `era ${era}: the loaded run has not met the era yet`);
    const u0 = ids();
    const b0 = bids();
    Game.beginDayPhase(true);
    ok(
      GS.wave === era && PR.getSnapshot().fired.includes(era),
      `era ${era}: reached from the save`
    );
    ok(ids() === u0 && bids() === b0, `era ${era}: army and buildings persist from the save`);
    for (let i = 0; i < 120; i++) Game.update();
    const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
    ok(Game.importGameState(snap), `era ${era}: a save made on the boundary wave loads`);
    ok(
      PR.getSnapshot().fired.includes(era) && ids() === u0 && bids() === b0,
      `era ${era}: and the era is not announced twice`
    );
    GS.paused = false;
    const fired = PR.getSnapshot().fired.length;
    toNight(Game, GS);
    Game.beginDayPhase(true);
    ok(
      PR.getSnapshot().fired.length === fired && GS.wave === era + 1,
      `era ${era}: wave ${era + 1} follows`
    );
    // A save from before eras were recorded, already past the boundary.
    const legacy = JSON.parse(JSON.stringify(Game.exportGameState()));
    delete legacy.progressionRestarts;
    ok(
      Game.importGameState(legacy) && PR.getSnapshot().fired.includes(era),
      `era ${era}: an older save past the boundary counts the era as met`
    );
    // And one that carries the old wipe's record.
    legacy.progressionRestarts = {
      fired: [era],
      lastRestart: {
        wave: era,
        id: 'x',
        name: 'Old',
        shortName: 'Old',
        imported: { tp: 150, science: 9 },
      },
    };
    ok(
      Game.importGameState(legacy) && PR.getSnapshot().lastEra?.science === 9,
      `era ${era}: the old restart record is read`
    );
  } catch (e) {
    threw2 = e;
  }
  ok(!threw2, `era ${era}: saves around the boundary work${threw2 ? `: ${threw2.stack}` : ''}`);
}

if (failures()) {
  console.error(`\n${failures()} one-field test(s) failed.`);
  process.exit(1);
}
console.log('\nAll one-field tests passed.');
