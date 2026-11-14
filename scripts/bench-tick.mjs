/**
 * Tick benchmark: builds reproducible heavy scenes headlessly and times Game.update().
 *
 * Scenes (all seeded, Creative mode so nothing is bought):
 *   u150, u250, u400  a standing fight kept at that many units (melee, ranged, flyers,
 *                     walls, towers, an enemy camp and the map's trees and rocks). The dead
 *                     are replaced every few ticks so the load stays level.
 *   w60, w100         jump to the wave, place a garrison, start the real wave and keep the
 *                     garrison reinforced; the next wave starts when one is cleared.
 *
 * Tick time is process CPU time (process.cpuUsage), because the machine is usually shared and
 * wall-clock figures swing two to five times. Wall time is printed beside it.
 *
 * Usage:
 *   node scripts/bench-tick.mjs                       all scenes, 3 runs of 2,000 ticks
 *   node scripts/bench-tick.mjs --scenes=u250 --runs=5 --ticks=3000
 *   node scripts/bench-tick.mjs --breakdown           self time per subsystem (manual timers)
 *   node --expose-gc scripts/bench-tick.mjs --heap    heap growth per 1,000 ticks
 *   node scripts/bench-tick.mjs --hash                print a state hash per run (equivalence)
 *   node scripts/bench-tick.mjs --js=/path/to/other/js   time another checkout's js/ folder
 *   node scripts/bench-tick.mjs --json=out.json
 *
 * Compare two checkouts back to back (alternating runs, so load hits both alike):
 *   node scripts/bench-tick.mjs --compare=/path/to/base/js --scenes=u250 --runs=3
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { performance } from 'perf_hooks';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot } from './lib/harness.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const SCENES = String(args.scenes || 'u150,u250,u400,w60,w100').split(',');
const TICKS = Number(args.ticks || 2000);
const WARMUP = Number(args.warmup || 300);
const RUNS = Number(args.runs || 3);
const SEED = Number(args.seed || 7331);
const BREAKDOWN = !!args.breakdown;
const HEAP = !!args.heap;
const HASH = !!args.hash;

const PLAYER_TYPES = [
  'footman',
  'archer',
  'footman',
  'crossbowman',
  'pikeman',
  'mage',
  'knight',
  'archer',
  'healer',
  'footman',
];
const ENEMY_TYPES = [
  'goblin',
  'orc',
  'orc_archer',
  'goblin',
  'harpy',
  'dark_knight',
  'orc',
  'dark_mage',
  'berserker',
  'sky_drake',
  'troll',
  'goblin',
];

// ---------------------------------------------------------------- subsystem timers
// Functions inside game.js are closures, so the breakdown pass rewrites the source text it
// loads (never the files): each named function gets a timing wrapper. Self time is charged
// to the function's group; time spent in a nested timed call is charged to that call's group.
const GROUPS = [
  'spatial queries',
  'spatial rebuild',
  'target acquisition',
  'pathfinding',
  'movement/separation',
  'roster hooks',
  'siege loop',
  'projectiles',
  'other',
];
const GAME_FN_GROUPS = {
  'target acquisition': [
    'findTacticalTarget',
    'findNearestPlayer',
    'findNearestFoeInRange',
    'findEnemyMoveTarget',
    'getSurroundSlot',
    'trimFoeListToNearest',
    'findPlayerGeneral',
    'enemyNearPost',
    'lineOfSight',
  ],
  pathfinding: [
    'setUnitPath',
    'maybeRebuildWalkGrids',
    'expireStalePendingPaths',
    'applyWorkerPathResults',
    'isTerrainBlockedForPath',
  ],
  'movement/separation': [
    'followPath',
    'separationVector',
    'resolveOverlaps',
    'isBlocked',
    'isTerrainBlocked',
    'isTerrainBlockedAt',
    'nudgeUnitFree',
    'moveUnitToward',
    'tryStep',
    'recoverStuckUnits',
  ],
  'spatial rebuild': ['rebuildSpatialIndex'],
};

function instrument(code) {
  const ids = {};
  let out = code;
  for (const [group, names] of Object.entries(GAME_FN_GROUPS)) {
    const gi = GROUPS.indexOf(group);
    for (const name of names) {
      const re = new RegExp(`\\n  function ${name}\\(`);
      if (!re.test(out)) continue;
      ids[name] = gi;
      out = out.replace(
        re,
        `\n  function ${name}(a, b, c, d, e, f) { const __s = __bench.enter(${gi}); try { return ${name}$raw(a, b, c, d, e, f); } finally { __bench.exit(__s); } }\n  function ${name}$raw(`
      );
    }
  }
  // Phase marks: everything between 'projectiles' and the next mark is the projectile loop.
  out = out.replace(
    /function markUpdatePhase\(phase, detail\) \{/,
    'function markUpdatePhase(phase, detail) { __bench.phase(phase);'
  );
  return { code: out, ids };
}

function makeTimers() {
  const self = new Float64Array(GROUPS.length);
  const calls = new Float64Array(GROUPS.length);
  const phases = new Map();
  const stackStart = [];
  const stackChild = [];
  const stackGroup = [];
  let depth = 0;
  let phaseName = null;
  let phaseStart = 0;
  let projDepthMark = -1;
  let enabled = false;
  const api = {
    enter(g) {
      if (!enabled) return -1;
      stackGroup[depth] = g;
      stackChild[depth] = 0;
      stackStart[depth] = performance.now();
      return depth++;
    },
    exit(s) {
      if (s < 0 || !enabled) return;
      const now = performance.now();
      depth = s;
      const el = now - stackStart[s];
      self[stackGroup[s]] += el - stackChild[s];
      calls[stackGroup[s]]++;
      if (s > 0) stackChild[s - 1] += el;
    },
    phase(name) {
      if (!enabled) return;
      const now = performance.now();
      if (phaseName) phases.set(phaseName, (phases.get(phaseName) || 0) + now - phaseStart);
      // The projectile loop has no single function to wrap: time it as a pseudo call.
      if (projDepthMark >= 0) {
        api.exit(projDepthMark);
        projDepthMark = -1;
      }
      if (name === 'projectiles') projDepthMark = api.enter(GROUPS.indexOf('projectiles'));
      phaseName = name === 'update-end' ? null : name;
      phaseStart = now;
    },
    wrapObject(obj, groupOf) {
      if (!obj) return;
      for (const k of Object.keys(obj)) {
        const fn = obj[k];
        if (typeof fn !== 'function') continue;
        const g = GROUPS.indexOf(groupOf(k));
        if (g < 0) continue;
        try {
          obj[k] = function (a, b, c, d, e, f) {
            const s = api.enter(g);
            try {
              return fn.call(this, a, b, c, d, e, f);
            } finally {
              api.exit(s);
            }
          };
        } catch {
          /* frozen object: leave it */
        }
      }
    },
    set(on) {
      enabled = on;
      depth = 0;
      phaseName = null;
      projDepthMark = -1;
    },
    self,
    calls,
    phases,
  };
  return api;
}

// ---------------------------------------------------------------- scene building
function lcg(seed) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const codeCache = new Map();
function loadCode(jsDir, timed) {
  const k = `${jsDir}|${timed}`;
  if (!codeCache.has(k)) {
    let code = HEADLESS_FILES.map((f) => readFileSync(join(jsDir, f), 'utf8')).join('\n;\n');
    if (timed) code = instrument(code).code;
    codeCache.set(k, code);
  }
  return codeCache.get(k);
}

function bootGame(jsDir, seed, timers) {
  const { sb, cvs } = boot(seed);
  if (timers) sb.__bench = timers;
  const g = vm.runInContext(
    `${loadCode(jsDir, !!timers)}\n({ Game, SpriteGen, GameState, Spatial, Pathfinding, Roster, SiegeLoop, EntityPool,
       PathWorkerBridge: typeof PathWorkerBridge !== 'undefined' ? PathWorkerBridge : null })`,
    vm.createContext(sb)
  );
  g.SpriteGen.prewarmCache = () => {};
  if (timers) {
    timers.wrapObject(g.Spatial, (k) =>
      /^rebuild|^init$|^clear$/.test(k) ? 'spatial rebuild' : 'spatial queries'
    );
    timers.wrapObject(g.Pathfinding, () => 'pathfinding');
    timers.wrapObject(g.Roster, () => 'roster hooks');
    timers.wrapObject(g.SiegeLoop, () => 'siege loop');
  }
  g.Game.init(cvs);
  g.Game.setDifficulty('normal');
  g.Game.start({ creative: true });
  g.Game.setCreativeSetting?.('unlockAll', true);
  return g;
}

function buildScene(name, g, rnd) {
  const { Game, GameState: GS } = g;
  const live = (team) => {
    let n = 0;
    for (const u of GS.units) if (u.team === team && u.hp > 0) n++;
    return n;
  };
  if (name[0] === 'w') {
    const wave = Number(name.slice(1));
    const garrison = wave >= 100 ? 40 : 28;
    Game.creativeSetWave(wave - 1);
    let pi = 0;
    const reinforce = () => {
      let need = garrison - live('player');
      let guard = 0;
      while (need > 0 && guard++ < 200) {
        const x = GS.worldW * (0.2 + 0.6 * rnd());
        const y = GS.deployY - 40 - 220 * rnd();
        if (Game.creativeSpawnPlayerAt(PLAYER_TYPES[pi++ % PLAYER_TYPES.length], x, y)) need--;
      }
    };
    reinforce();
    Game.creativeStartWave();
    return {
      wave,
      maintain(tick) {
        if (tick % 30 !== 0) return;
        reinforce();
        if (live('enemy') === 0 && GS.spawnQueue.length === 0) Game.creativeStartWave();
      },
    };
  }
  const total = Number(name.slice(1));
  const wantPlayers = Math.round(total * 0.28);
  const wantEnemies = total - wantPlayers;
  Game.creativeSetWave(60);
  const W = GS.worldW;
  const lineY = GS.deployY - 150;
  // A broken wall line with towers behind it, and an enemy camp up the field.
  for (let i = 0; i < 9; i++) {
    if (i % 3 === 1) continue;
    Game.creativeSpawnPlayerBuildingAt('wall', W * 0.14 + (i * W * 0.72) / 8, lineY - 90);
  }
  Game.creativeSpawnPlayerBuildingAt('watchtower', W * 0.3, lineY + 40);
  Game.creativeSpawnPlayerBuildingAt('watchtower', W * 0.7, lineY + 40);
  Game.creativeSpawnPlayerBuildingAt('medical_tent', W * 0.5, lineY + 110);
  Game.creativeSpawnEnemyBuildingAt('enemy_hamlet', W * 0.5, 150);
  Game.creativeSpawnEnemyBuildingAt('enemy_war_academy', W * 0.25, 190);
  let pi = 0;
  let ei = 0;
  const topUp = () => {
    let need = wantPlayers - live('player');
    let guard = 0;
    while (need > 0 && guard++ < 400) {
      const x = W * (0.12 + 0.76 * rnd());
      const y = lineY - 60 + 230 * rnd();
      if (Game.creativeSpawnPlayerAt(PLAYER_TYPES[pi++ % PLAYER_TYPES.length], x, y)) need--;
    }
    need = wantEnemies - live('enemy');
    guard = 0;
    while (need > 0 && guard++ < 800) {
      const x = W * (0.06 + 0.88 * rnd());
      const y = 70 + (lineY - 420) * rnd();
      if (Game.creativeSpawnEnemyAt(ENEMY_TYPES[ei++ % ENEMY_TYPES.length], x, y)) need--;
    }
  };
  topUp();
  Game.creativeForceDay();
  Game.creativeClearWaveSpawns?.();
  return {
    wave: 60,
    maintain(tick) {
      if (tick % 15 === 0) topUp();
      if (tick % 15 === 0 && GS.spawnQueue.length) Game.creativeClearWaveSpawns?.();
    },
  };
}

function stateHash(GS) {
  let h = 2166136261;
  const mix = (n) => {
    h = Math.imul(h ^ (n | 0), 16777619);
  };
  mix(GS.units.length);
  mix(GS.updateTick);
  for (const u of GS.units) {
    mix(Math.round(u.x * 1000));
    mix(Math.round(u.y * 1000));
    mix(Math.round((u.hp || 0) * 100));
    mix(u.team === 'player' ? 1 : 2);
  }
  mix(GS.kills | 0);
  mix(GS.projectiles.length);
  return (h >>> 0).toString(16);
}

function pct(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function runOnce(scene, jsDir, opts = {}) {
  const timers = opts.breakdown ? makeTimers() : null;
  const g = bootGame(jsDir, SEED, timers);
  const { Game, GameState: GS } = g;
  const sc = buildScene(scene, g, lcg(SEED + 17));
  for (let t = 0; t < WARMUP; t++) {
    sc.maintain(t);
    Game.update();
  }
  const cpu = new Float64Array(TICKS);
  const wall = new Float64Array(TICKS);
  let unitSum = 0;
  let unitPeak = 0;
  let heap = null;
  if (opts.heap && globalThis.gc) {
    globalThis.gc();
    heap = { start: process.memoryUsage().heapUsed, alloc: 0, last: 0 };
    heap.last = heap.start;
  }
  timers?.set(true);
  const wall0 = performance.now();
  for (let t = 0; t < TICKS; t++) {
    timers?.set(false);
    sc.maintain(WARMUP + t);
    timers?.set(true);
    const c0 = process.cpuUsage();
    const w0 = performance.now();
    Game.update();
    wall[t] = performance.now() - w0;
    const c1 = process.cpuUsage(c0);
    cpu[t] = (c1.user + c1.system) / 1000;
    unitSum += GS.units.length;
    if (GS.units.length > unitPeak) unitPeak = GS.units.length;
    if (heap) {
      const hu = process.memoryUsage().heapUsed;
      if (hu > heap.last) heap.alloc += hu - heap.last;
      heap.last = hu;
    }
  }
  const wallTotal = performance.now() - wall0;
  timers?.set(false);
  const res = {
    scene,
    wave: GS.wave,
    playing: Game.isPlaying(),
    unitsAvg: +(unitSum / TICKS).toFixed(1),
    unitsPeak: unitPeak,
    buildings: GS.buildings.length,
    decorations: GS.decorations.length,
  };
  const s = Array.from(cpu).sort((a, b) => a - b);
  const ws = Array.from(wall).sort((a, b) => a - b);
  res.cpu = {
    mean: s.reduce((a, b) => a + b, 0) / TICKS,
    p50: pct(s, 0.5),
    p95: pct(s, 0.95),
    p99: pct(s, 0.99),
    max: s[s.length - 1],
  };
  res.wall = { mean: ws.reduce((a, b) => a + b, 0) / TICKS, p50: pct(ws, 0.5), p95: pct(ws, 0.95) };
  if (heap) {
    globalThis.gc();
    const end = process.memoryUsage().heapUsed;
    res.heap = {
      allocKBPer1000: +((heap.alloc / 1024 / TICKS) * 1000).toFixed(0),
      retainedKBPer1000: +(((end - heap.start) / 1024 / TICKS) * 1000).toFixed(0),
    };
  }
  if (timers) {
    const timed = Array.from(timers.self).reduce((a, b) => a + b, 0);
    res.breakdown = {};
    GROUPS.forEach((name, i) => {
      if (name === 'other') return;
      res.breakdown[name] = {
        msPerTick: +(timers.self[i] / TICKS).toFixed(3),
        callsPerTick: +(timers.calls[i] / TICKS).toFixed(1),
      };
    });
    res.breakdown.other = { msPerTick: +((wallTotal - timed) / TICKS).toFixed(3), callsPerTick: 0 };
    res.breakdown.total = { msPerTick: +(wallTotal / TICKS).toFixed(3), callsPerTick: 0 };
    res.phases = Object.fromEntries(
      [...timers.phases].map(([k, v]) => [k, +(v / TICKS).toFixed(3)])
    );
  }
  const st = g.Spatial.getStats?.();
  if (st) res.grid = st;
  const ps = g.Pathfinding.getStats?.();
  if (ps) res.paths = ps;
  if (HASH || opts.hash) res.hash = stateHash(GS);
  return res;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function summarise(runs) {
  const out = {};
  for (const k of ['mean', 'p50', 'p95', 'p99', 'max']) {
    const xs = runs.map((r) => r.cpu[k]);
    out[k] = { median: median(xs), min: Math.min(...xs), max: Math.max(...xs) };
  }
  out.wallMean = median(runs.map((r) => r.wall.mean));
  return out;
}

const f2 = (n) => n.toFixed(2);
function line(label, s) {
  const cell = (k) => `${f2(s[k].median)} (${f2(s[k].min)}-${f2(s[k].max)})`;
  return `${label.padEnd(18)} mean ${cell('mean')}  p50 ${cell('p50')}  p95 ${cell('p95')}  p99 ${cell('p99')}  max ${cell('max')}  wall mean ${f2(s.wallMean)}`;
}

const jsDir = typeof args.js === 'string' ? args.js : JS;
const baseDir = typeof args.compare === 'string' ? args.compare : null;
if (baseDir && !existsSync(join(baseDir, 'game.js'))) {
  console.error(`--compare: no game.js in ${baseDir}`);
  process.exit(2);
}
// Read every source up front so an edit made while the benchmark runs cannot leak into it.
loadCode(jsDir, false);
if (baseDir) loadCode(baseDir, false);
if (BREAKDOWN) loadCode(jsDir, true);
const report = { ticks: TICKS, warmup: WARMUP, runs: RUNS, seed: SEED, scenes: {} };
console.log(
  `bench-tick: ${TICKS} ticks after ${WARMUP} warm-up, ${RUNS} run(s) per scene, seed ${SEED}, CPU ms per tick: median (min-max) of the runs`
);
for (const scene of SCENES) {
  const cur = [];
  const base = [];
  for (let i = 0; i < RUNS; i++) {
    // Alternate so both sides see the same machine load.
    if (baseDir) base.push(runOnce(scene, baseDir));
    cur.push(runOnce(scene, jsDir, { heap: HEAP }));
  }
  const s = summarise(cur);
  const r0 = cur[0];
  console.log(
    `\n== ${scene}: wave ${r0.wave}, units avg ${r0.unitsAvg} peak ${r0.unitsPeak}, ${r0.buildings} buildings, ${r0.decorations} decorations${r0.playing ? '' : '  (RUN ENDED)'}`
  );
  const entry = { info: r0, summary: s };
  if (baseDir) {
    const b = summarise(base);
    console.log(line('  base', b));
    console.log(line('  current', s));
    const d = (k) => `${(((s[k].median - b[k].median) / b[k].median) * 100).toFixed(1)}%`;
    console.log(
      `  change             mean ${d('mean')}  p50 ${d('p50')}  p95 ${d('p95')}  p99 ${d('p99')}`
    );
    entry.base = b;
    if (HASH)
      console.log(
        `  hash base ${base.map((r) => r.hash).join(',')} current ${cur.map((r) => r.hash).join(',')}`
      );
  } else {
    console.log(line('  cpu', s));
    if (HASH) console.log(`  hash ${cur.map((r) => r.hash).join(',')}`);
  }
  if (HEAP) {
    if (!globalThis.gc) console.log('  heap: run with node --expose-gc');
    else {
      const a = cur.map((r) => r.heap.allocKBPer1000);
      const rt = cur.map((r) => r.heap.retainedKBPer1000);
      console.log(
        `  heap per 1,000 ticks: allocated ~${median(a)} KB (${Math.min(...a)}-${Math.max(...a)}), retained after GC ${median(rt)} KB (${Math.min(...rt)}-${Math.max(...rt)})`
      );
      entry.heap = { allocKBPer1000: median(a), retainedKBPer1000: median(rt) };
    }
  }
  if (r0.grid) console.log(`  grid: ${JSON.stringify(r0.grid)}`);
  if (r0.paths) console.log(`  paths: ${JSON.stringify(r0.paths)}`);
  if (BREAKDOWN) {
    const b = runOnce(scene, jsDir, { breakdown: true });
    console.log(
      '  subsystem self time (wall ms per tick, timers on; shares matter more than totals):'
    );
    const tot = b.breakdown.total.msPerTick;
    for (const [k, v] of Object.entries(b.breakdown)) {
      if (k === 'total') continue;
      console.log(
        `    ${k.padEnd(22)} ${String(v.msPerTick.toFixed(3)).padStart(8)}  ${((v.msPerTick / tot) * 100).toFixed(1).padStart(5)}%  ${v.callsPerTick ? v.callsPerTick + ' calls/tick' : ''}`
      );
    }
    console.log(`    ${'total'.padEnd(22)} ${String(tot.toFixed(3)).padStart(8)}`);
    console.log(
      `  update phases: ${Object.entries(b.phases)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`
    );
    entry.breakdown = b.breakdown;
    entry.phases = b.phases;
  }
  report.scenes[scene] = entry;
}
if (typeof args.json === 'string') writeFileSync(args.json, JSON.stringify(report, null, 2));
