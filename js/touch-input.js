/**
 * Consistent tap slop for touch devices — canvas pan, HUD, and menu buttons.
 */
const TouchInput = (() => {
  const SLOP_FINE = 7;
  const SLOP_COARSE = 16;
  const DEDUPE_MS = 320;

  let coarse = false;
  let inited = false;
  const active = new Map();
  let lastClickAt = 0;
  let lastClickEl = null;

  /** Non-button interactive targets that use click listeners (div cards, etc.). */
  const INTERACTIVE_CLASSES = [
    'unit-quick-btn',
    'formation-btn',
    'menu-btn',
    'menu-settings-fab',
    'diff-btn',
    'mode-btn',
    'adv-preset-btn',
    'speed-btn',
    'hint-log-btn',
    'ach-card',
    'challenge-card',
    'recommended-start-card',
  ];

  function isCoarsePointer() {
    return coarse;
  }

  function getTapSlop() {
    return coarse ? SLOP_COARSE : SLOP_FINE;
  }

  /** Alias for map/camera drag — same value as UI tap slop. */
  function getDragThreshold() {
    return getTapSlop();
  }

  function isTouchLike(pointerType) {
    return pointerType === 'touch' || pointerType === 'pen' || (coarse && pointerType !== 'mouse');
  }

  function isInteractive(el) {
    if (!el || el.nodeType !== 1) return false;
    // Disabled form controls (buttons/inputs) — skip.
    if (el.disabled) return false;
    if (el.getAttribute?.('aria-disabled') === 'true') return false;
    // Map canvas is owned by main.js pointer/touch handlers — never synthesize UI clicks.
    if (el.closest?.('#game-canvas')) return false;

    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'A' || tag === 'LABEL' || tag === 'SUMMARY') return true;
    // Submit/image buttons as <input> still need tap synthesis on coarse pointers.
    if (tag === 'INPUT') {
      const t = String(el.type || el.getAttribute?.('type') || '').toLowerCase();
      if (t === 'button' || t === 'submit' || t === 'reset' || t === 'image') return true;
      return false;
    }
    if (el.getAttribute('role') === 'button') return true;
    if (el.dataset?.challenge != null) return true;

    const cl = el.classList;
    if (cl) {
      for (let i = 0; i < INTERACTIVE_CLASSES.length; i++) {
        if (cl.contains(INTERACTIVE_CLASSES[i])) return true;
      }
    }
    return false;
  }

  function findInteractive(el) {
    let node = el;
    // Cap walk so we never hang on odd DOM trees.
    let hops = 0;
    while (node && node !== document.body && hops < 24) {
      if (isInteractive(node)) return node;
      node = node.parentElement;
      hops++;
    }
    return null;
  }

  function fireClick(el) {
    if (!el || el.disabled) return;
    if (el.getAttribute?.('aria-disabled') === 'true') return;
    // Detached nodes (panel re-render between down/up) — skip silent no-op clicks.
    if (typeof el.isConnected === 'boolean' && !el.isConnected) return;

    const now = Date.now();
    if (el === lastClickEl && now - lastClickAt < DEDUPE_MS) return;
    lastClickAt = now;
    lastClickEl = el;
    try {
      el.click();
    } catch (_) {
      /* ignore */
    }
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = findInteractive(e.target);
    if (!el) return;
    active.set(e.pointerId, {
      el,
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
    });
    if (isTouchLike(e.pointerType)) {
      // Block ghost mouse clicks + 300ms delay; map UI still uses synthetic el.click().
      e.preventDefault();
    }
  }

  function clearPointer(id) {
    active.delete(id);
  }

  function onPointerUp(e) {
    const tap = active.get(e.pointerId);
    clearPointer(e.pointerId);
    if (!tap) return;

    const slop = getTapSlop();
    const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
    if (moved > slop) return;

    // Target may have been re-rendered; prefer a still-connected interactive under the finger.
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const hitBtn = hit ? findInteractive(hit) : null;
    const target =
      hitBtn && hitBtn.isConnected !== false
        ? hitBtn
        : tap.el && tap.el.isConnected !== false
          ? tap.el
          : null;
    if (!target) return;

    if (isTouchLike(tap.pointerType)) {
      e.preventDefault();
      e.stopPropagation();
      fireClick(target);
      return;
    }

    // Mouse: if release is still on the same control, let the native click fire.
    if (hitBtn === tap.el && tap.el.isConnected !== false) return;

    // Mouse released slightly off the original control — force the intended click.
    e.preventDefault();
    e.stopPropagation();
    fireClick(target);
  }

  function onPointerCancel(e) {
    clearPointer(e.pointerId);
  }

  function bindUIButtons() {
    document.addEventListener('pointerdown', onPointerDown, { passive: false });
    document.addEventListener('pointerup', onPointerUp, { passive: false });
    document.addEventListener('pointercancel', onPointerCancel);
    // Tab blur / app background — drop in-flight taps so the next press is clean.
    window.addEventListener('blur', () => active.clear());
  }

  function applyTouchDeviceClass() {
    document.documentElement.classList.toggle('touch-device', coarse);
    // Script may run from <head> before <body> if init is forced early.
    document.body?.classList.toggle('touch-device', coarse);
  }

  function init() {
    if (inited) return;
    inited = true;
    coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    applyTouchDeviceClass();
    bindUIButtons();
    const mql = window.matchMedia('(pointer: coarse)');
    const onChange = (mq) => {
      coarse = mq.matches || navigator.maxTouchPoints > 0;
      applyTouchDeviceClass();
    };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, isCoarsePointer, getTapSlop, getDragThreshold, isInteractive, findInteractive };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.TouchInput = TouchInput;
