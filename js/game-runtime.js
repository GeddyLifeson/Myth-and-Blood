/**
 * Shared runtime defs — path state, layer UI hooks, pathfind budgets.
 * Used by Game and any subsystem that receives the same hook bundles.
 */
const GameRuntime = (() => {
  /**
   * Reset unit path / async path state.
   * @param {object} unit
   * @param {{ keepPath?: boolean, keepTargets?: boolean, keepManual?: boolean, keepAsync?: boolean, keepStill?: boolean }} [opts]
   */
  function clearPathTrack(unit, opts = {}) {
    if (!unit) return unit;
    const keepTargets = opts.keepTargets || (opts.keepManual && unit.manualOrder);
    if (!opts.keepPath) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.pathStuck = 0;
    }
    if (!opts.keepStill) unit.stillFrames = 0;
    if (!opts.keepAsync) {
      unit.pathPending = false;
      unit.pathReqId = null;
      unit.pathWaitTicks = 0;
    }
    if (!keepTargets) {
      unit.targetX = null;
      unit.targetY = null;
      unit.pathTargetId = null;
    }
    return unit;
  }

  /** Apply a computed path onto a unit (worker or sync). */
  function applyPathToUnit(unit, path, opts = {}) {
    if (!unit) return unit;
    unit.path = path?.length ? path : [];
    unit.pathIndex = 0;
    unit.pathRecalc = opts.recalc ?? 0;
    unit.pathPending = false;
    unit.pathReqId = null;
    unit.pathWaitTicks = 0;
    if (!opts.keepStuck) unit.pathStuck = 0;
    return unit;
  }

  /** Per-tick pathfind budget from unit count and horde state. */
  function pathfindBudgetFor(unitCount, opts = {}) {
    const mult = opts.pathMult ?? 1;
    const horde = !!opts.hordeActive;
    let base =
      unitCount > 120 ? 8 : unitCount > 80 ? 14 : unitCount > 60 ? 18 : unitCount > 35 ? 24 : 32;
    if (horde) {
      base = Math.floor(base * 1.75);
      base = Math.max(base, 16 + Math.floor(unitCount * 0.18));
    }
    const floor = horde ? 12 : 4;
    return Math.max(floor, Math.floor(base * mult));
  }

  /** Main-thread sync pathfind cap per simulation tick. */
  function syncPathCap(unitCount, hordeActive) {
    if (hordeActive) return 20;
    if (unitCount > 100) return 8;
    if (unitCount > 70) return 12;
    return 16;
  }

  function makeFloatStatus(resolveFloatingText) {
    return (x, y, text, color) => {
      const ft = typeof resolveFloatingText === 'function' ? resolveFloatingText() : resolveFloatingText;
      ft?.status?.(x, y, text, color);
    };
  }

  /** Standard wave/layer announcement bundle (message + highlight + world float text). */
  function makeAnnounceHooks(bindings, extra = {}) {
    const { showMessage, addHighlight, worldW, worldH, wave, floatingText, resolveFloatingText } =
      bindings;
    const ft =
      floatingText ||
      (resolveFloatingText ? makeFloatStatus(resolveFloatingText) : () => {});
    return {
      showMessage,
      addHighlight,
      floatingText: ft,
      worldW,
      worldH,
      wave,
      ...extra,
    };
  }

  /** Lighter hook bundle without world dimensions. */
  function makeLayerHooks(bindings, extra = {}) {
    const { showMessage, addHighlight, floatingText, resolveFloatingText, wave } = bindings;
    const ft =
      floatingText ||
      (resolveFloatingText ? makeFloatStatus(resolveFloatingText) : () => {});
    const out = { showMessage, addHighlight, floatingText: ft, ...extra };
    if (wave != null) out.wave = wave;
    return out;
  }

  /** Clone wave modifier bags for save/export. */
  function cloneWaveMods(mods = {}) {
    return {
      countMult: mods.countMult ?? 1,
      hpMult: mods.hpMult ?? 1,
      noElites: !!mods.noElites,
      stealReduction: mods.stealReduction ?? 0,
      revealed: !!mods.revealed,
      nextPreview: mods.nextPreview ?? '',
    };
  }

  const DEFAULT_WAVE_MODIFIERS = Object.freeze({
    countMult: 1,
    hpMult: 1,
    noElites: false,
    revealed: false,
    nextPreview: '',
  });

  const DEFAULT_PENDING_WAVE_MODS = Object.freeze({
    countMult: 1,
    hpMult: 1,
    noElites: false,
    stealReduction: 0,
  });

  return {
    clearPathTrack,
    applyPathToUnit,
    pathfindBudgetFor,
    syncPathCap,
    makeFloatStatus,
    makeAnnounceHooks,
    makeLayerHooks,
    cloneWaveMods,
    DEFAULT_WAVE_MODIFIERS,
    DEFAULT_PENDING_WAVE_MODS,
  };
})();