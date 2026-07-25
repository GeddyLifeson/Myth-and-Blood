/**
 * Headless Myth and Blood — exploit-focused simulation + perf regression checks.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { ROOT, JS, HEADLESS_FILES } from './headless-manifest.mjs';

const RUNS = process.env.HEADLESS_SIM_RUNS != null ? Number(process.env.HEADLESS_SIM_RUNS) : 10;
const MAX_TICKS =
  process.env.HEADLESS_SIM_TICKS != null ? Number(process.env.HEADLESS_SIM_TICKS) : 6000;
const MARATHON_TICKS =
  process.env.HEADLESS_SIM_MARATHON_TICKS != null
    ? Number(process.env.HEADLESS_SIM_MARATHON_TICKS)
    : 120000;
const SKIP_MARATHON = process.env.HEADLESS_SIM_SKIP_MARATHON === '1';

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
    querySelector: (s) => el(s),
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
    performance: { now: () => 0, memory: null },
    AudioContext: null,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: noop,
    removeEventListener: noop,
    document: {
      getElementById: (id) => ids.get(id) || mk(id),
      querySelector: (s) => ids.get(s?.slice(1)) || el(),
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => el(),
      hidden: false,
    },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs };
}

let G = null;

function loadOnce() {
  if (G) return G;
  const { sb } = boot(1);
  const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
  const exp = vm.runInContext(
    `${code}\n({ Game, Cheats, MetaProgress, SpriteGen, Pathfinding, Spatial, GameModes, AdvancedDifficulty, Legacy, Chronicles })`,
    vm.createContext(sb)
  );
  exp.SpriteGen.prewarmCache = noop;
  G = exp;
  return G;
}

const STRATS = [
  [
    'begin_day_spam',
    (Gm) => {
      if (Gm.getState().timeOfDay === 'night') Gm.beginDayPhase(true);
    },
  ],
  [
    'begin_day_early',
    (Gm, t) => {
      if (Gm.getState().timeOfDay === 'night' && t % 4 === 0) Gm.beginDayPhase(true);
    },
  ],
  [
    'pause_at_dusk',
    (Gm) => {
      const s = Gm.getState();
      if (s.timeOfDay === 'day' && s.waveProgress > 0.85) Gm.togglePause();
    },
  ],
  [
    'levy_spam',
    (Gm) => {
      const s = Gm.getState();
      if (s.hasCourier && !s.courierUsedThisWave) Gm.sendCourierMessage('levy');
    },
  ],
  [
    'decree_spam',
    (Gm) => {
      const s = Gm.getState();
      if (s.hasCourier && !s.courierUsedThisWave) Gm.sendCourierMessage('decree');
    },
  ],
  [
    'spy_steal',
    (Gm) => {
      if (!Gm.getState().spyUsedThisWave) Gm.executeSpyAction('steal');
    },
  ],
  [
    'spy_scout',
    (Gm) => {
      if (!Gm.getState().spyUsedThisWave) Gm.executeSpyAction('scout');
    },
  ],
  [
    'rally_spam',
    (Gm) => {
      if (Gm.getState().tactical >= 4) {
        Gm.selectAbility('rally');
        Gm.handleClick(400, 400);
      }
    },
  ],
  [
    'tp_burst',
    (Gm, t) => {
      if (t % 400 === 0) Gm.applyCheatEffect('tp', 40);
    },
  ],
  [
    'deploy_night',
    (Gm, t) => {
      const s = Gm.getState();
      if (s.timeOfDay === 'night' && s.canDeploy && s.tactical >= 3) {
        Gm.selectDeploy('footman');
        Gm.handleClick(200 + (t % 10) * 20, 500);
      }
    },
  ],
  [
    'build_night',
    (Gm, t) => {
      const s = Gm.getState();
      if (s.timeOfDay === 'night' && s.tactical >= 6) {
        Gm.selectBuild('wall');
        Gm.handleClick(300, 450);
      }
    },
  ],
  [
    'hunt_flip',
    (Gm, t) => {
      if (t % 300 === 0) Gm.toggleGlobalHunt();
    },
  ],
  [
    'wwe_cheat',
    (Gm, t, C) => {
      if (t === 1) C.submit('Austin 3:16');
    },
  ],
  [
    'doom_cheat',
    (Gm, t, C) => {
      if (t === 1) C.submit('Doomslayer');
    },
  ],
  [
    'morale_cheat',
    (Gm, t) => {
      if (t % 500 === 0) Gm.applyCheatEffect('morale');
    },
  ],
  [
    'iddqd',
    (Gm, t, C) => {
      if (t % 200 === 0) C.submit('iddqd');
    },
  ],
  [
    'rosebud',
    (Gm, t, C) => {
      if (t % 350 === 0) C.submit('rosebud');
    },
  ],
  [
    'highlander',
    (Gm, t, C) => {
      if (t % 250 === 0) C.submit('there can be only one');
    },
  ],
  [
    'reinforce',
    (Gm) => {
      const s = Gm.getState();
      if (s.timeOfDay === 'day' && s.tactical >= 10 && s.canDeploy) {
        Gm.selectAbility('reinforce');
        Gm.handleClick(400, 400);
      }
    },
  ],
  [
    'save_export',
    (Gm, t) => {
      if (t % 800 === 0 && Gm.exportGameState) Gm.exportGameState();
    },
  ],
  ['passive', () => {}],
];

function sim(runId, maxTicks, fastNight) {
  const { Game, Cheats, MetaProgress } = loadOnce();
  MetaProgress.reset();
  if (typeof G?.GameModes !== 'undefined') G.GameModes.endSession?.();
  if (typeof G?.AdvancedDifficulty !== 'undefined') {
    G.AdvancedDifficulty.setActive([]);
    G.AdvancedDifficulty.unlockForRun?.();
  }
  Game.setDifficulty(['baby', 'normal', 'chad', 'doomslayer'][runId % 4]);
  const { cvs } = boot(1000 + runId * 997);
  Game.init(cvs);
  Game.start();

  const [name, act] = STRATS[runId % STRATS.length];
  const issues = [];
  let maxWave = 0;
  let nights = 0;
  let tpNight = null;
  let lastTp = Game.getState().tactical;
  let updateMs = 0;

  for (let t = 0; t < maxTicks; t++) {
    const pre = Game.getState();
    if (t % 8 === 0 && pre.state === 'playing' && pre.timeOfDay === 'day')
      Game.applyCheatEffect('clear_enemies');
    const t0 = Date.now();
    try {
      if (t % 15 === 0) act(Game, t, Cheats);
      if (fastNight && pre.timeOfDay === 'night') Game.beginDayPhase(true);
      Game.update();
      if (t % 4 === 0) Game.draw();
    } catch (e) {
      issues.push({ runId, t, code: 'THROW', msg: e.message, name });
      break;
    }
    updateMs += Date.now() - t0;

    const post = Game.getState();
    maxWave = Math.max(maxWave, post.wave);
    if (post.timeOfDay === 'night' && pre.timeOfDay === 'day') {
      nights++;
      const tpGain = post.tactical - tpNight;
      const cheatTp = ['rosebud', 'iddqd', 'tp_burst'].includes(name);
      if (tpNight !== null && tpGain > 150 && !cheatTp)
        issues.push({ runId, code: 'DOUBLE_TP', gain: tpGain, name });
      tpNight = post.tactical;
    }
    if (post.tactical > 300000 || Number.isNaN(post.tactical) || !Number.isFinite(post.tactical)) {
      issues.push({ runId, code: 'TP_ANOMALY', tp: post.tactical });
    }
    if (post.tactical - lastTp > 120 && pre.timeOfDay === 'night' && post.timeOfDay === 'night') {
      issues.push({ runId, code: 'TP_SPIKE', delta: post.tactical - lastTp, name });
    }
    lastTp = post.tactical;
    if (post.state !== 'playing') break;
    if (post.wave >= 1000) break;
  }
  const fin = Game.getState();
  const avgUpdateMs = updateMs / Math.max(1, maxTicks);
  if (avgUpdateMs > 8)
    issues.push({ runId, code: 'SLOW_UPDATE', ms: +avgUpdateMs.toFixed(2), name });
  return {
    runId,
    name,
    maxWave: Math.max(maxWave, fin.wave),
    issues,
    reached1000: fin.wave >= 1000,
    nights,
    avgUpdateMs: +avgUpdateMs.toFixed(2),
  };
}

loadOnce();
console.log(`Running ${RUNS} sims...`);
const t0 = Date.now();
const results = [];
const issues = [];

for (let i = 0; i < RUNS; i++) {
  const r = sim(i, MAX_TICKS, true);
  results.push(r);
  issues.push(...r.issues);
  if (r.reached1000) console.log(`*** RUN ${i} WAVE 1000+ ***`);
  if ((i + 1) % 25 === 0) console.log(` ${i + 1}/${RUNS}`);
}

if (!SKIP_MARATHON) {
  console.log('Marathon runs (wave 1000 hunt)...');
  for (let m = 0; m < 3; m++) {
    const r = sim(200 + m, MARATHON_TICKS, true);
    r.name = `marathon_${r.name}`;
    results.push(r);
    issues.push(...r.issues);
    console.log(
      ` Marathon ${m}: wave ${r.maxWave} avg ${r.avgUpdateMs}ms${r.reached1000 ? ' *** 1000+ ***' : ''}`
    );
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const waves = results.map((r) => r.maxWave);
const hit1000 = results.filter((r) => r.reached1000);
const counts = {};
issues.forEach((i) => {
  counts[i.code] = (counts[i.code] || 0) + 1;
});

const report = {
  runs: results.length,
  elapsedSec: +elapsed,
  bestWave: Math.max(...waves),
  avgWave: +(waves.reduce((a, b) => a + b, 0) / waves.length).toFixed(1),
  avgUpdateMs: +(results.reduce((s, r) => s + (r.avgUpdateMs || 0), 0) / results.length).toFixed(2),
  reached1000: hit1000.map((r) => ({ runId: r.runId, name: r.name, wave: r.maxWave })),
  issueCounts: counts,
  issues,
  topRuns: [...results].sort((a, b) => b.maxWave - a.maxWave).slice(0, 12),
};

writeFileSync(join(ROOT, 'scripts', 'sim-report.json'), JSON.stringify(report, null, 2));
console.log(
  `\nDone ${elapsed}s | best=${report.bestWave} avg=${report.avgWave} | wave1000=${hit1000.length}`
);
console.log(`Avg update: ${report.avgUpdateMs}ms/tick`);
if (counts.THROW) console.log('Throws:', issues.filter((i) => i.code === 'THROW').slice(0, 3));
console.log('Issues:', counts);
process.exit(Object.keys(counts).length ? 1 : 0);
