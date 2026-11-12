/**
 * Shared test helpers. Each test script used to carry its own copy of these.
 */
let failed = 0;

/** Assert and log; failures are counted for the script's exit code. */
export function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

/** Number of failed ok() checks so far. */
export function failures() {
  return failed;
}

/** Minimal browser sandbox (DOM stubs, canvas, storage, seeded Math) for booting the game in vm. */
export function boot(seed) {
  const noop = () => {};
  const store = new Map();
  const ids = new Map();
  const mk = (id) => {
    const e = {
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
      querySelector: () => null,
      querySelectorAll: () => [],
      getContext: (t) =>
        t === '2d'
          ? {
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
              moveTo: noop,
              lineTo: noop,
              arc: noop,
              fill: noop,
              stroke: noop,
              fillRect: noop,
              strokeRect: noop,
              fillText: noop,
              drawImage: noop,
              createLinearGradient: () => ({ addColorStop: noop }),
              measureText: () => ({ width: 10 }),
            }
          : null,
      width: 1280,
      height: 720,
    };
    ids.set(id, e);
    return e;
  };
  ['achievement-toast', 'menu-screen'].forEach(mk);
  let rng = seed;
  const M = Object.create(Math);
  M.random = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };
  const cvs = mk('canvas');
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
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => mk('el'),
      hidden: false,
    },
    canvas: cvs,
  };
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return { sb, cvs };
}
