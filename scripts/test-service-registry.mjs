#!/usr/bin/env node
/**
 * Differential harness for GameServices.registerFromGlobals().
 *
 * registerFromGlobals() historically fell back to `globalThis.eval(...)` because a
 * top-level `const Foo = ...` in a classic script lands in the global *lexical*
 * environment, not on globalThis — so plain `scope[id]` lookup missed every module.
 *
 * Modules now publish themselves explicitly (`globalThis.Foo = Foo;`), which lets
 * the eval go. This harness proves the swap is behaviour-preserving: it boots the
 * headless VM and prints the exact set of service ids that end up registered.
 * Run it before and after the change — the sets must be identical.
 *
 * Usage: node scripts/test-service-registry.mjs [--json]
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

const noop = () => {};
const stub2d = new Proxy(
  {},
  {
    get: (t, k) =>
      k === 'measureText'
        ? () => ({ width: 10 })
        : k === 'getImageData' || k === 'createImageData'
          ? () => ({ data: new Uint8ClampedArray(4) })
          : k === 'createLinearGradient' || k === 'createRadialGradient'
            ? () => ({ addColorStop: noop })
            : k === 'canvas'
              ? { width: 1280, height: 720 }
              : noop,
  }
);
const mkEl = () => {
  const el = {
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    children: [],
    appendChild: noop,
    removeChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    removeAttribute: noop,
    getAttribute: () => null,
    getContext: () => stub2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    querySelector: () => mkEl(),
    querySelectorAll: () => [],
    focus: noop,
    blur: noop,
    click: noop,
    remove: noop,
    insertAdjacentHTML: noop,
    width: 1280,
    height: 720,
    innerHTML: '',
    textContent: '',
    value: '',
  };
  return el;
};

const sandbox = {
  console,
  Math,
  Date,
  JSON,
  performance: { now: () => Date.now() },
  requestAnimationFrame: noop,
  cancelAnimationFrame: noop,
  setTimeout: noop,
  clearTimeout: noop,
  setInterval: noop,
  clearInterval: noop,
  localStorage: {
    _d: new Map(),
    getItem(k) {
      return this._d.has(k) ? this._d.get(k) : null;
    },
    setItem(k, v) {
      this._d.set(k, String(v));
    },
    removeItem(k) {
      this._d.delete(k);
    },
    clear() {
      this._d.clear();
    },
  },
  document: {
    getElementById: () => mkEl(),
    querySelector: () => mkEl(),
    querySelectorAll: () => [],
    createElement: () => mkEl(),
    body: mkEl(),
    documentElement: mkEl(),
    addEventListener: noop,
    removeEventListener: noop,
    hidden: false,
  },
  navigator: { userAgent: 'node', maxTouchPoints: 0, language: 'en' },
  location: { href: 'file:///headless', protocol: 'file:', search: '' },
  Worker: function () {
    return { postMessage: noop, terminate: noop, addEventListener: noop };
  },
  Blob: function () {
    return {};
  },
  URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: noop },
  fetch: () => Promise.reject(new Error('no network')),
  addEventListener: noop,
  removeEventListener: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  Image: function () {
    return mkEl();
  },
  OffscreenCanvas: function () {
    return mkEl();
  },
  CustomEvent: function () {
    return {};
  },
  dispatchEvent: noop,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const ctx = vm.createContext(sandbox);
const loaded = [];
const failed = [];
for (const f of HEADLESS_FILES) {
  try {
    new vm.Script(readFileSync(join(JS, f), 'utf8'), { filename: f }).runInContext(ctx);
    loaded.push(f);
  } catch (e) {
    failed.push(`${f}: ${e.message}`);
  }
}

const result = vm.runInContext(
  `(() => {
     if (typeof GameServices === 'undefined') return { error: 'GameServices undefined' };
     GameServices.clear();
     GameServices.registerFromGlobals();
     // SERVICE_IDS is de-duplicated here so a stray duplicate entry cannot make
     // two runs look different when the resolved set is in fact the same.
     const ids = [...new Set(GameServicesSystem_IDS)].filter((id) => GameServices.has(id));
     return { ids: ids.sort(), total: ids.length };
   })()`.replace(
    'GameServicesSystem_IDS',
    'Object.getPrototypeOf(GameServices).constructor.SERVICE_IDS'
  ),
  ctx
);

const out = {
  scriptsLoaded: loaded.length,
  scriptsFailed: failed,
  registered: result.ids || [],
  error: result.error,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  if (out.error) {
    console.error('FAIL:', out.error);
    process.exit(1);
  }
  if (failed.length)
    console.error(`WARN: ${failed.length} script(s) failed to load:\n  ${failed.join('\n  ')}`);
  console.log(`scripts loaded: ${loaded.length}`);
  console.log(`services registered: ${out.registered.length}`);
  console.log(out.registered.join('\n'));
}
