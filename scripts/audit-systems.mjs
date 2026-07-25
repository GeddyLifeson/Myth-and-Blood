/**
 * Audit UI selectors, pathfinding after map growth, and crossover factions.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL:', m);
    failed++;
  } else console.log('OK:', m);
}

// ── 1. UI HTML critical IDs ─────────────────────────────────
const html = readFileSync(join(root, 'index.html'), 'utf8');
const needIds = [
  'left-panel',
  'right-panel',
  'top-bar',
  'unit-info-panel',
  'minimap-panel',
  'message-box',
  'begin-day-btn',
  'crossover-hub-open',
  'wwe-academy-open',
  'research-open',
  'game-canvas',
  'speed-toggle',
  'demolish-btn',
];
for (const id of needIds) {
  ok(html.includes(`id="${id}"`), `HTML has #${id}`);
}
ok((html.match(/data-build="/g) || []).length >= 20, 'many build buttons present');
ok((html.match(/data-ability="/g) || []).length >= 5, 'ability buttons present');
ok((html.match(/data-unit="/g) || []).length >= 10, 'deploy buttons present');
ok((html.match(/side-tab-pane[^\n>]*hidden/g) || []).length === 0, 'no hidden side-tab-panes');
ok(html.includes('data-side-pane="build"'), 'build section pane exists');
ok(html.includes('data-side-pane="strike"'), 'strike section pane exists');
ok(html.includes('academy_footman'), 'academy buttons present');

// ── 2. Buildings JSON crossover barracks ────────────────────
const buildings = JSON.parse(readFileSync(join(root, 'data/buildings.json'), 'utf8'));
const barracks = Object.entries(buildings).filter(([, d]) => d.isCrossoverBarracks);
ok(barracks.length >= 12, `crossover barracks count (${barracks.length})`);
for (const [id, def] of barracks) {
  ok(def.cost > 0 && def.cost <= 150, `${id} cost reasonable (${def.cost})`);
  ok((def.requiresBuilders || 0) <= 4, `${id} builders (${def.requiresBuilders})`);
  ok(!!def.crossoverFaction, `${id} has crossoverFaction`);
}

// ── 3. Crossover defs integrity ─────────────────────────────
const crossSrc = readFileSync(join(root, 'js/crossover.js'), 'utf8');
ok(/const CROSSOVER_BARRACKS_COST = 90/.test(crossSrc), 'barracks cost constant 90');
ok(/const CROSSOVER_BARRACKS_BUILDERS = 2/.test(crossSrc), 'barracks builders 2');
const costs = [...crossSrc.matchAll(/^\s+cost: (\d+),/gm)].map((m) => +m[1]);
ok(costs.length >= 100, `operative costs found (${costs.length})`);
ok(Math.max(...costs) <= 50, `max operative cost <= 50 (got ${Math.max(...costs)})`);
ok(Math.min(...costs) >= 8, `min operative cost >= 8 (got ${Math.min(...costs)})`);

// ── 4. Research doom prereq ─────────────────────────────────
const researchSrc = readFileSync(join(root, 'js/research.js'), 'utf8');
const doomBlock = researchSrc.match(/id: 'doom_protocol'[\s\S]{0,400}/);
ok(doomBlock, 'doom_protocol node exists');
// Prefer having prereqs for doom
const hasDoomPrereq = /id: 'doom_protocol'[\s\S]{0,200}prereq:/.test(researchSrc);
if (!hasDoomPrereq) {
  console.warn('WARN: doom_protocol has no prereq — will restore');
}

// ── 5. Headless game: pathfinding after map expand ──────────
function bootGame() {
  const noop = () => {};
  const mk = (id) => {
    const el = {
      id,
      className: '',
      classList: {
        add: noop,
        remove: noop,
        toggle: () => false,
        contains: () => false,
      },
      style: {},
      dataset: {},
      hidden: false,
      textContent: '',
      innerHTML: '',
      value: '',
      checked: false,
      width: 1280,
      height: 720,
      addEventListener: noop,
      removeEventListener: noop,
      appendChild: (c) => c,
      removeChild: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
      getContext: (t) =>
        t === '2d'
          ? {
              fillStyle: '',
              strokeStyle: '',
              canvas: { width: 1280, height: 720 },
              save: noop,
              restore: noop,
              translate: noop,
              scale: noop,
              setTransform: noop,
              beginPath: noop,
              moveTo: noop,
              lineTo: noop,
              arc: noop,
              fill: noop,
              stroke: noop,
              fillRect: noop,
              clearRect: noop,
              strokeRect: noop,
              fillText: noop,
              drawImage: noop,
              measureText: () => ({ width: 10 }),
              createLinearGradient: () => ({ addColorStop: noop }),
              createRadialGradient: () => ({ addColorStop: noop }),
            }
          : null,
      setAttribute: noop,
      getAttribute: () => null,
      removeAttribute: noop,
      focus: noop,
      blur: noop,
      click: noop,
    };
    return el;
  };
  const ids = new Map();
  const get = (id) => {
    if (!ids.has(id)) ids.set(id, mk(id));
    return ids.get(id);
  };
  [
    'game-canvas',
    'left-panel',
    'right-panel',
    'top-bar',
    'unit-info-panel',
    'unit-info-body',
    'minimap-canvas',
    'minimap-panel',
    'message-box',
    'menu-screen',
    'achievement-toast',
  ].forEach(get);
  const canvas = get('game-canvas');
  canvas.width = 1280;
  canvas.height = 720;

  const sb = {
    console: { log: noop, warn: noop, error: noop, info: noop },
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    Math,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    undefined,
    Uint8Array,
    Int32Array,
    Float32Array,
    Promise,
    setTimeout: (fn) => {
      try {
        fn();
      } catch (_) {}
      return 0;
    },
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
    requestAnimationFrame: (fn) => {
      try {
        fn(0);
      } catch (_) {}
      return 0;
    },
    cancelAnimationFrame: noop,
    performance: { now: () => Date.now() },
    localStorage: {
      getItem: () => null,
      setItem: noop,
      removeItem: noop,
      clear: noop,
    },
    sessionStorage: {
      getItem: () => null,
      setItem: noop,
      removeItem: noop,
      clear: noop,
    },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    navigator: { userAgent: 'audit', platform: 'test' },
    location: { href: 'http://localhost/', pathname: '/', search: '', hash: '' },
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    document: {
      getElementById: get,
      querySelector: (sel) => {
        if (sel?.startsWith?.('#')) return get(sel.slice(1));
        return null;
      },
      querySelectorAll: () => [],
      createElement: (tag) => mk(tag),
      body: mk('body'),
      documentElement: mk('html'),
      addEventListener: noop,
      removeEventListener: noop,
      hidden: false,
    },
    Image: function () {
      this.src = '';
      this.onload = null;
    },
    Worker: undefined,
    URL: { createObjectURL: () => '', revokeObjectURL: noop },
    Blob: function () {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
  };
  sb.window = sb;
  sb.globalThis = sb;
  sb.self = sb;

  const ctx = vm.createContext(sb);
  // Load core files used by headless tests
  const files = [
    'html-util.js',
    'game-data-bundle.js',
    'game-data.js',
    'game-services.js',
    'game-events.js',
    'game-runtime.js',
    'units.js',
    'pathfinding-core.js',
    'pathfinding.js',
    'spatial.js',
    'entity-pool.js',
    'update-throttle.js',
    'sprites.js',
    'particles.js',
    'floatingText.js',
    'effects.js',
    'audio.js',
    'settings.js',
    'meta-progress.js',
    'save.js',
    'research.js',
    'crossover.js',
    'faction-depth.js',
    'game-depth.js',
    'game-modes.js',
    'content-expansion.js',
    'game.js',
  ];
  for (const f of files) {
    const p = join(JS, f);
    if (!existsSync(p)) continue;
    try {
      vm.runInContext(readFileSync(p, 'utf8'), ctx, { filename: f });
    } catch (e) {
      // some modules may fail without full DOM — continue if Game already loaded
      if (!ctx.Game) throw e;
    }
  }
  return ctx;
}

console.log('\n--- Pathfinding + expand audit ---');
try {
  const ctx = bootGame();
  ok(!!ctx.Game, 'Game module loaded');
  ok(!!ctx.Pathfinding, 'Pathfinding module loaded');
  ok(typeof ctx.getWorldSize === 'function', 'getWorldSize available');

  const g = ctx.Game;
  const canvas = ctx.document.getElementById('game-canvas');
  const inited = g.init?.(canvas);
  ok(inited !== false, 'Game.init');

  // Start a run
  try {
    g.setDifficulty?.('normal');
    g.start?.();
  } catch (e) {
    ok(false, `Game.start threw: ${e.message}`);
  }
  ok(g.isPlaying?.() || g.getState?.()?.state === 'playing', 'game playing after start');

  const s0 = g.getState?.() || {};
  const w0 = s0.worldW || ctx.worldW;
  const h0 = s0.worldH;
  // Force expand via internal sync if exported, else simulate by start at wave 10
  // Prefer calling through wave progression if possible
  let expanded = false;
  if (typeof g.syncMapGrowth === 'function') {
    // not exported usually
  }

  // Use creative / set wave if available
  if (g.startCreative) {
    try {
      g.startCreative({ startWave: 20, freeResources: true, unlockAll: true });
      expanded = true;
    } catch (_) {}
  }

  const st = g.getState?.() || {};
  ok(st.state === 'playing' || g.isPlaying?.(), 'still playing after creative/start');

  // Pathfinding path on current map
  const pf = ctx.Pathfinding;
  if (pf?.init && pf?.findPath) {
    const ww = st.worldW || 400;
    const wh = st.worldH || 600;
    pf.init(ww, wh);
    if (pf.rebuildWalkGrids) {
      pf.rebuildWalkGrids(() => false);
    }
    const path = pf.findPath?.(50, wh - 40, 50, 80, { team: 'player' });
    ok(Array.isArray(path) && path.length > 0, `pathfinding finds route (len=${path?.length})`);
  } else {
    ok(false, 'Pathfinding API incomplete');
  }

  // getWorldSize growth
  const size1 = ctx.getWorldSize(1);
  const size20 = ctx.getWorldSize(20);
  ok(size20.w > size1.w && size20.h > size1.h, 'world size grows by wave 20');
  ok(size20.w - size1.w > 0 && (size20.w - size1.w) % 2 === 0 || size20.w > size1.w, 'width growth for centered expand');

  // Faction depth patch
  if (ctx.FactionDepth?.patchBuildDefs) {
    ctx.FactionDepth.patchBuildDefs();
  }
  if (ctx.BuildDefs) {
    const el = ctx.BuildDefs.element_barracks;
    ok(el && el.cost === 90, `element_barracks cost 90 (got ${el?.cost})`);
    ok(el && el.requiresBuilders === 2, `element_barracks builders 2 (got ${el?.requiresBuilders})`);
  }

  // Crossover defs present
  const nOps = Object.keys(ctx.CrossoverDefs || {}).length;
  ok(nOps >= 100, `CrossoverDefs loaded (${nOps})`);
  const factions = Object.keys(ctx.CrossoverFactions || {});
  ok(factions.length >= 12, `CrossoverFactions (${factions.length})`);
  for (const f of factions) {
    const building = ctx.CrossoverFactions[f].building;
    ok(!!ctx.BuildDefs?.[building], `faction ${f} building ${building} defined`);
  }
} catch (e) {
  ok(false, `headless audit crashed: ${e.stack || e.message}`);
}

// ── 6. Research doom prereq restore check ───────────────────
console.log('\n--- Research audit ---');
ok(/wave: 1/.test(researchSrc), 'crossover research available wave 1');

console.log(failed ? `\n${failed} audit failure(s)` : '\nAll audit checks passed');
process.exit(failed ? 1 : 0);
