/**
 * In-game performance monitor and lightweight profiler.
 */
const Perf = (() => {
  let enabled = false;
  let overlayVisible = false;
  let frameTimes = [];
  let lastFrameAt = performance.now();
  let fps = 60;
  let frameMs = 16.7;

  const counters = {
    units: 0,
    buildings: 0,
    projectiles: 0,
    particles: 0,
    paths: 0,
    pathMs: 0,
    spatialQueries: 0,
    drawUnits: 0,
  };

  const sections = new Map();
  const active = new Map();

  function init() {
    document.getElementById('perf-toggle')?.addEventListener('click', () => toggleOverlay());
    document.getElementById('pause-perf-toggle')?.addEventListener('click', () => toggleOverlay());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        toggleOverlay();
      }
    });
  }

  function toggleOverlay(force) {
    overlayVisible = typeof force === 'boolean' ? force : !overlayVisible;
    enabled = overlayVisible;
    const el = document.getElementById('perf-overlay');
    if (el) el.classList.toggle('visible', overlayVisible);
  }

  function begin(name) {
    if (!enabled) return;
    active.set(name, performance.now());
  }

  function end(name) {
    if (!enabled) return;
    const start = active.get(name);
    if (start == null) return;
    const ms = performance.now() - start;
    active.delete(name);
    const prev = sections.get(name) || { total: 0, count: 0, max: 0 };
    prev.total += ms;
    prev.count++;
    prev.max = Math.max(prev.max, ms);
    sections.set(name, prev);
    if (name === 'path') {
      counters.pathMs += ms;
      counters.paths++;
    }
  }

  function count(name, n = 1) {
    if (counters[name] !== undefined) counters[name] += n;
  }

  function tick(gs) {
    const now = performance.now();
    const dt = now - lastFrameAt;
    lastFrameAt = now;
    frameTimes.push(dt);
    if (frameTimes.length > 60) frameTimes.shift();
    frameMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    fps = Math.round(1000 / Math.max(1, frameMs));

    if (gs) {
      counters.units = (gs.army ?? 0) + (gs.enemyCount ?? 0);
      counters.buildings = gs.buildingCount ?? 0;
    }

    if (!overlayVisible) return;

    const el = document.getElementById('perf-overlay-body');
    if (!el) return;

    const pathAvg = counters.paths ? (counters.pathMs / counters.paths).toFixed(2) : '0';
    const mem = performance.memory
      ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB`
      : 'n/a';

    let sect = '';
    sections.forEach((v, k) => {
      sect += `<div class="perf-line"><span>${k}</span><span>${(v.total / Math.max(1, v.count)).toFixed(2)}ms · max ${v.max.toFixed(1)}</span></div>`;
    });

    const gfxLabel = typeof GfxQuality !== 'undefined' ? GfxQuality.getLabel() : 'n/a';

    el.innerHTML = `
      <div class="perf-line head"><span>FPS</span><span class="${fps < 45 ? 'perf-warn' : ''}">${fps} (${frameMs.toFixed(1)}ms)</span></div>
      <div class="perf-line"><span>Quality</span><span>${gfxLabel}</span></div>
      <div class="perf-line"><span>Units</span><span>${counters.units}</span></div>
      <div class="perf-line"><span>Buildings</span><span>${counters.buildings}</span></div>
      <div class="perf-line"><span>Paths/frame</span><span>${counters.paths} · avg ${pathAvg}ms</span></div>
      <div class="perf-line"><span>Spatial Q</span><span>${counters.spatialQueries}</span></div>
      <div class="perf-line"><span>Draw units</span><span>${counters.drawUnits}</span></div>
      <div class="perf-line"><span>Heap</span><span>${mem}</span></div>
      ${sect}
    `;

    counters.paths = 0;
    counters.pathMs = 0;
    counters.spatialQueries = 0;
    counters.drawUnits = 0;
    if (updateTick % 120 === 0) sections.clear();
  }

  function isEnabled() {
    return enabled;
  }

  function getStats() {
    return { fps, frameMs, ...counters };
  }

  let updateTick = 0;
  function setUpdateTick(t) { updateTick = t; }

  return {
    init, tick, begin, end, count, toggleOverlay, isEnabled, getStats, setUpdateTick,
  };
})();