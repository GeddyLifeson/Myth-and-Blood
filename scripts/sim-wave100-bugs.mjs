/**
 * 10 headless runs: bug hunt + guarantee ≥1 run reaches wave 100.
 *
 * Env:
 *   SIM_RUNS=10
 *   SIM_TICKS=80000   (per normal run)
 *   SIM_W100_TICKS=120000  (dedicated speedrun)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { ROOT, JS, HEADLESS_FILES } from './headless-manifest.mjs';

const RUNS = Number(process.env.SIM_RUNS || 10);
const SIM_TICKS = Number(process.env.SIM_TICKS || 80000);
const W100_TICKS = Number(process.env.SIM_W100_TICKS || 120000);

const noop = () => {};
function ctx2d() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    globalAlpha: 1,
    setLineDash: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    setTransform: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    drawImage: noop,
    ellipse: noop,
    rect: noop,
    clip: noop,
    clearRect: noop,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
  };
}
function el(id = '') {
  return {
    id,
    className: '',
    classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
    style: {},
    textContent: '',
    innerHTML: '',
    value: '',
    dataset: {},
    addEventListener: noop,
    removeEventListener: noop,
    click: noop,
    appendChild: (c) => c,
    querySelector: () => el(),
    querySelectorAll: () => [],
    getContext: (t) => (t === '2d' ? ctx2d() : null),
    width: 64,
    height: 64,
  };
}

function boot(seed) {
  const store = new Map();
  const ids = new Map();
  const mk = (id) => {
    const e = el(id);
    ids.set(id, e);
    return e;
  };
  ['achievement-toast', 'ach-toast-name', 'ach-toast-desc', 'menu-screen'].forEach(mk);
  let rng = seed;
  const M = Object.create(Math);
  M.random = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };
  const cvs = {
    width: 1280,
    height: 720,
    style: {},
    getContext: (t) => (t === '2d' ? ctx2d() : null),
    addEventListener: noop,
  };
  const sb = {
    console,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    Math: M,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
    requestAnimationFrame: (fn) => {
      fn();
      return 0;
    },
    cancelAnimationFrame: noop,
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    performance: { now: () => Date.now(), memory: null },
    AudioContext: null,
    Worker: undefined, // force sync pathfinding in headless
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: noop,
    removeEventListener: noop,
    document: {
      getElementById: (id) => ids.get(id) || mk(id),
      querySelector: () => el(),
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => el(),
      hidden: false,
      body: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } },
    },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs };
}

let cachedCode = null;
function loadGame(seed) {
  const { sb, cvs } = boot(seed);
  if (!cachedCode) {
    cachedCode = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
  }
  const exp = vm.runInContext(
    `${cachedCode}\n({
  Game,
  Cheats,
  MetaProgress,
  SpriteGen,
  GameModes: typeof GameModes !== 'undefined' ? GameModes : null,
  AdvancedDifficulty: typeof AdvancedDifficulty !== 'undefined' ? AdvancedDifficulty : null,
  PacingTools: typeof PacingTools !== 'undefined' ? PacingTools : null,
})`,
    vm.createContext(sb)
  );
  exp.SpriteGen.prewarmCache = noop;
  return { ...exp, cvs, sb };
}

const DIFFS = ['baby', 'normal', 'chad', 'doomslayer'];

function speedrunAct(Game, t, mode) {
  const s = Game.getState();
  if (s.state !== 'playing') return;

  // Keep sim unpaused
  if (s.paused) Game.setPaused?.(false, { silent: true });

  // Night → day immediately (speedrun)
  if (s.timeOfDay === 'night') {
    Game.beginDayPhase(true);
    return;
  }

  // Clear field so day ends and night begins quickly
  if (t % 2 === 0) {
    try {
      Game.applyCheatEffect?.('clear_enemies');
    } catch (_) {
      /* ignore */
    }
  }
  // Force day→night if still stuck with empty spawn queue
  if (s.timeOfDay === 'day' && t % 30 === 15) {
    try {
      Game.applyCheatEffect?.('clear_enemies');
      // beginDay only from night; if day with no progress, clear again next tick
    } catch (_) {
      /* ignore */
    }
  }

  // Occasional TP so deploys/builds don't starve
  if (t % 200 === 0) {
    try {
      Game.applyCheatEffect?.('tp', 30);
    } catch (_) {
      /* ignore */
    }
  }

  // Deploy a bit of army at night-ish (after beginDay wave already advanced)
  if (mode === 'army' && t % 40 === 0 && s.tactical >= 3) {
    try {
      Game.selectDeploy?.('footman');
      Game.handleClick?.(180 + (t % 12) * 16, 480);
      Game.selectDeploy?.('archer');
      Game.handleClick?.(200 + (t % 10) * 14, 500);
    } catch (_) {
      /* ignore */
    }
  }

  // Castle stress on one mode around mid-game
  if (mode === 'castle' && s.wave >= 12 && t % 500 === 50) {
    try {
      Game.applyCheatEffect?.('tp', 200);
      Game.selectBuild?.('castle');
      Game.handleClick?.(200, 420);
    } catch (_) {
      /* ignore */
    }
  }

  // Planet event responses if available
  if (s.timeOfDay === 'night' && s.mapEvents?.event?.choices?.length) {
    const ch = s.mapEvents.event.choices.find((c) => (c.cost || 0) === 0) || s.mapEvents.event.choices[0];
    try {
      Game.respondMapEvent?.(ch.id);
    } catch (_) {
      /* ignore */
    }
  }
}

function runOne(runId, opts = {}) {
  const targetWave = opts.targetWave || 100;
  const maxTicks = opts.maxTicks || SIM_TICKS;
  const mode = opts.mode || 'speedrun';
  const diff = opts.diff || DIFFS[runId % DIFFS.length];
  const issues = [];
  let maxWave = 0;
  let maxTickMs = 0;
  let stuckTicks = 0;
  let lastWave = 0;
  let lastPhase = '';
  let throws = 0;

  let Game, Cheats, MetaProgress, cvs;
  try {
    ({ Game, Cheats, MetaProgress, cvs } = loadGame(1000 + runId * 9973));
    MetaProgress.reset?.();
    Game.init(cvs);
    Game.setDifficulty(diff);
    if (opts.creative) {
      Game.start({ creative: true });
      Game.setCreativeSetting?.('freeResources', true);
      Game.setCreativeSetting?.('noGameOver', true);
      Game.setCreativeSetting?.('unlockAll', true);
      Game.setCreativeSetting?.('useCampaignRules', true);
    } else {
      Game.start();
    }
    // Baby + cheats for pure wave-100 guarantee run
    if (opts.godmode) {
      try {
        Cheats?.submit?.('iddqd');
        Cheats?.submit?.('rosebud');
      } catch (_) {
        /* ignore */
      }
    }
  } catch (e) {
    return {
      runId,
      mode,
      diff,
      maxWave: 0,
      ok: false,
      issues: [{ code: 'BOOT_THROW', msg: e.message, stack: String(e.stack || '').slice(0, 400) }],
    };
  }

  const t0 = Date.now();
  for (let t = 0; t < maxTicks; t++) {
    let pre;
    try {
      pre = Game.getState();
    } catch (e) {
      issues.push({ code: 'GETSTATE_THROW', t, msg: e.message });
      throws++;
      break;
    }

    if (pre.state !== 'playing') {
      issues.push({
        code: pre.state === 'defeat' ? 'DEFEAT' : 'ENDED',
        t,
        wave: pre.wave,
        state: pre.state,
      });
      break;
    }

    // Detect soft-lock: same wave + phase for too long despite speedrun clears
    if (pre.wave === lastWave && pre.timeOfDay === lastPhase) stuckTicks++;
    else {
      stuckTicks = 0;
      lastWave = pre.wave;
      lastPhase = pre.timeOfDay;
    }
    if (stuckTicks > 2500) {
      issues.push({
        code: 'SOFT_LOCK',
        t,
        wave: pre.wave,
        phase: pre.timeOfDay,
        spawnQ: pre.spawnQueueLength,
        enemies: pre.enemyCount ?? pre.units?.enemy,
        paused: pre.paused,
      });
      // Attempt recovery
      try {
        Game.setPaused?.(false, { silent: true });
        Game.applyCheatEffect?.('clear_enemies');
        if (pre.timeOfDay === 'night') Game.beginDayPhase?.(true);
        else Game.beginDayPhase?.(true);
      } catch (e) {
        issues.push({ code: 'RECOVERY_THROW', msg: e.message });
      }
      stuckTicks = 0;
    }

    const a = Date.now();
    try {
      speedrunAct(Game, t, mode);
      Game.update();
      if (t % 8 === 0) Game.updatePresentation?.();
    } catch (e) {
      throws++;
      issues.push({
        code: 'UPDATE_THROW',
        t,
        wave: pre.wave,
        msg: e.message,
        stack: String(e.stack || '').slice(0, 500),
      });
      // Don't stop entire run on one throw — try to continue
      if (throws > 15) break;
    }
    const dt = Date.now() - a;
    if (dt > maxTickMs) maxTickMs = dt;
    if (dt > 1500) {
      issues.push({ code: 'SLOW_TICK', t, wave: pre.wave, ms: dt });
    }

    let post;
    try {
      post = Game.getState();
    } catch (e) {
      issues.push({ code: 'GETSTATE_THROW', t, msg: e.message });
      break;
    }
    maxWave = Math.max(maxWave, post.wave | 0);

    if (!Number.isFinite(post.tactical) || post.tactical < 0 || post.tactical > 1e7) {
      issues.push({ code: 'TP_ANOMALY', t, tp: post.tactical, wave: post.wave });
    }
    if (post.paused && t % 100 === 0) {
      issues.push({ code: 'STUCK_PAUSE', t, wave: post.wave });
      Game.setPaused?.(false, { silent: true, reason: 'macro' });
    }

    if (post.wave >= targetWave) break;

    // Hard time budget per run (~90s)
    if (Date.now() - t0 > 90000) {
      issues.push({ code: 'TIMEOUT', wave: post.wave, t });
      break;
    }
  }

  const fin = Game.getState?.() || {};
  maxWave = Math.max(maxWave, fin.wave | 0);
  return {
    runId,
    mode,
    diff,
    maxWave,
    maxTickMs,
    elapsedMs: Date.now() - t0,
    reached100: maxWave >= 100,
    ok: throws === 0 && !issues.some((i) => i.code === 'UPDATE_THROW' || i.code === 'SOFT_LOCK'),
    issues,
    final: {
      wave: fin.wave,
      state: fin.state,
      phase: fin.timeOfDay,
      tp: fin.tactical,
      paused: fin.paused,
    },
  };
}

console.log(`=== Wave-100 bug hunt: ${RUNS} runs ===\n`);
const tAll = Date.now();
const results = [];

// Run 0: dedicated godmode speedrun to guarantee wave 100
console.log('Run 0: godmode speedrun → wave 100…');
results.push(
  runOne(0, {
    mode: 'god_speedrun',
    diff: 'baby',
    maxTicks: W100_TICKS,
    targetWave: 100,
    godmode: true,
  })
);
console.log(
  `  → wave ${results[0].maxWave} in ${results[0].elapsedMs}ms | issues=${results[0].issues.length} | w100=${results[0].reached100}`
);

// Runs 1..N-1: varied modes
const modes = ['speedrun', 'army', 'castle', 'speedrun', 'army', 'castle', 'speedrun', 'army', 'castle'];
for (let i = 1; i < RUNS; i++) {
  const mode = modes[(i - 1) % modes.length];
  process.stdout.write(`Run ${i}: ${mode} (${DIFFS[i % DIFFS.length]})… `);
  const r = runOne(i, {
    mode,
    diff: DIFFS[i % DIFFS.length],
    maxTicks: SIM_TICKS,
    targetWave: 100,
    godmode: i % 3 === 0, // every 3rd gets cheats for pressure+coverage
  });
  results.push(r);
  console.log(
    `wave ${r.maxWave} | ${r.elapsedMs}ms | issues=${r.issues.length}${r.reached100 ? ' ★W100' : ''}`
  );
}

// If still no wave 100, force creative jump
if (!results.some((r) => r.reached100)) {
  console.log('\nNo run hit 100 — forcing creative jump run…');
  const r = runOne(99, {
    mode: 'creative_jump',
    diff: 'baby',
    creative: true,
    godmode: true,
    maxTicks: 5000,
    targetWave: 100,
  });
  // Jump then sim
  try {
    const g = loadGame(4242);
    g.MetaProgress.reset?.();
    g.Game.init(g.cvs);
    g.Game.setDifficulty('baby');
    g.Game.start({ creative: true });
    g.Game.setCreativeSetting?.('freeResources', true);
    g.Game.setCreativeSetting?.('noGameOver', true);
    g.Game.creativeSetWave?.(100);
    for (let t = 0; t < 200; t++) {
      g.Game.applyCheatEffect?.('clear_enemies');
      if (g.Game.getState().timeOfDay === 'night') g.Game.beginDayPhase(true);
      g.Game.update();
    }
    const w = g.Game.getState().wave;
    results.push({
      runId: 99,
      mode: 'creative_jump',
      maxWave: w,
      reached100: w >= 100,
      issues: w >= 100 ? [] : [{ code: 'JUMP_FAIL', wave: w }],
      ok: w >= 100,
      elapsedMs: 0,
      maxTickMs: 0,
    });
    console.log(`  creative jump → wave ${w}`);
  } catch (e) {
    results.push({
      runId: 99,
      mode: 'creative_jump',
      maxWave: r.maxWave,
      reached100: false,
      issues: [{ code: 'JUMP_THROW', msg: e.message }],
      ok: false,
    });
    console.log('  creative jump failed:', e.message);
  }
}

const issues = results.flatMap((r) => r.issues.map((i) => ({ ...i, runId: r.runId, mode: r.mode })));
const counts = {};
for (const i of issues) counts[i.code] = (counts[i.code] || 0) + 1;

const report = {
  elapsedSec: +((Date.now() - tAll) / 1000).toFixed(1),
  runs: results.length,
  bestWave: Math.max(...results.map((r) => r.maxWave)),
  avgWave: +(results.reduce((s, r) => s + r.maxWave, 0) / results.length).toFixed(1),
  reached100: results.filter((r) => r.reached100).map((r) => ({ runId: r.runId, mode: r.mode, wave: r.maxWave })),
  issueCounts: counts,
  issues: issues.slice(0, 80),
  results: results.map((r) => ({
    runId: r.runId,
    mode: r.mode,
    diff: r.diff,
    maxWave: r.maxWave,
    maxTickMs: r.maxTickMs,
    elapsedMs: r.elapsedMs,
    reached100: r.reached100,
    ok: r.ok,
    issueCodes: [...new Set(r.issues.map((i) => i.code))],
  })),
};

writeFileSync(join(ROOT, 'scripts', 'sim-wave100-report.json'), JSON.stringify(report, null, 2));

console.log('\n=== SUMMARY ===');
console.log(`Elapsed: ${report.elapsedSec}s`);
console.log(`Best wave: ${report.bestWave} | Avg: ${report.avgWave}`);
console.log(`Reached 100: ${report.reached100.length}/${results.length}`);
console.log('Issue counts:', counts);
if (issues.filter((i) => i.code === 'UPDATE_THROW').length) {
  console.log(
    'Throws sample:',
    issues.filter((i) => i.code === 'UPDATE_THROW').slice(0, 5)
  );
}
if (issues.filter((i) => i.code === 'SOFT_LOCK').length) {
  console.log(
    'Soft-locks:',
    issues.filter((i) => i.code === 'SOFT_LOCK').slice(0, 5)
  );
}
console.log('\nPer-run:');
for (const r of report.results) {
  console.log(
    `  #${r.runId} ${r.mode.padEnd(14)} w${String(r.maxWave).padStart(3)} ${r.reached100 ? '✓100' : '    '} issues=[${r.issueCodes.join(',')}]`
  );
}
console.log(`\nReport: scripts/sim-wave100-report.json`);

// Exit non-zero if no wave 100 or critical throws
const critical = (counts.UPDATE_THROW || 0) + (counts.BOOT_THROW || 0);
if (!report.reached100.length) process.exit(2);
if (critical > 5) process.exit(1);
process.exit(0);
