/**
 * Simulation throttling — decouple logic cadence from draw and skip distant AI/pathing.
 */
const UpdateThrottle = (() => {
  function unitPhase(unit, mod) {
    const id = String(unit?.id ?? '0');
    const a = id.charCodeAt(0) || 48;
    const b = id.charCodeAt(1) || 0;
    const m = Math.max(1, mod | 0);
    return (a + b) % m;
  }

  function isImportantUnit(unit, selectedIds) {
    if (!unit) return false;
    if (selectedIds?.has?.(unit.id)) return true;
    if (unit.isGeneral || unit.isNamedBoss || unit.isDoomslayer) return true;
    if (unit.type === 'war_chief' || unit.type === 'siege_tower') return true;
    if (unit.team === 'player' && unit.type === 'builder' && unit.building) return true;
    if (unit.team === 'player' && unit.combatType === 'healer') return true;
    if (unit.team === 'player' && (unit.garrisoned || unit.stationedKeep || unit.wallGarrisoned))
      return true;
    return false;
  }

  /**
   * @returns {'full'|'reduced'|'distant'}
   */
  function getUnitTier(unit, ctx) {
    if (!unit || unit.hp <= 0) return 'full';
    if (isImportantUnit(unit, ctx.selectedIds)) return 'full';

    const gfxQ = ctx.gfxQ || {};
    const unitCount = ctx.unitCount || 0;
    const minUnits = gfxQ.skipAiMinUnits ?? 35;
    if (unitCount < minUnits) return 'full';

    const isInView = ctx.isInView;
    if (typeof isInView !== 'function') return 'full';

    const nearPad = gfxQ.distantAiNearPad ?? 0;
    const midPad = gfxQ.distantAiPad ?? 120;
    const farPad = gfxQ.distantAiFarPad ?? 240;

    if (isInView(unit.x, unit.y, 56, nearPad)) return 'full';
    if (isInView(unit.x, unit.y, 72, midPad)) return 'reduced';

    if (unit.team === 'player') {
      const playerFar = gfxQ.distantPlayerFarPad ?? 320;
      if (isInView(unit.x, unit.y, 48, playerFar)) return 'reduced';
      return 'distant';
    }

    if (isInView(unit.x, unit.y, 64, farPad)) return 'reduced';
    return 'distant';
  }

  function shouldRunHeavyLogic(updateTick, gfxQ) {
    const interval = gfxQ?.logicInterval ?? 1;
    if (interval <= 1) return true;
    return updateTick % interval === 0;
  }

  /** Full AI + movement decision pass for this unit this tick. */
  function shouldRunUnitAI(unit, tier, updateTick) {
    if (tier === 'full') return true;
    if (unit.fleeing || unit.demoralized) return true;
    const mod = tier === 'reduced' ? 2 : 4;
    return updateTick % mod === unitPhase(unit, mod);
  }

  /** Minimal pass when full AI is skipped — path follow + in-range combat only. */
  function shouldRunUnitAIMinimal(unit, tier, updateTick) {
    if (tier === 'full') return false;
    return !shouldRunUnitAI(unit, tier, updateTick);
  }

  function shouldAnimateUnit(tier, unit) {
    if (tier === 'full' || tier === 'reduced') return true;
    return (unit?.attackAnimTimer || 0) > 0;
  }

  function shouldPathfind(unit, tier, updateTick) {
    if (tier === 'full') return true;
    if (unit.team === 'player' && unit.manualOrder) return true;
    const mod = tier === 'reduced' ? 3 : 6;
    return updateTick % mod === unitPhase(unit, mod);
  }

  function pathRecalcInterval(tier, gfxQ) {
    const base = tier === 'full' ? 40 : tier === 'reduced' ? 58 : 88;
    const mult = gfxQ?.pathfindMult ?? 1;
    return Math.max(24, Math.floor(base / Math.max(0.45, mult)));
  }

  function offscreenPathMaxNodes(tier) {
    if (tier === 'full') return 900;
    if (tier === 'reduced') return 520;
    return 360;
  }

  return {
    getUnitTier,
    shouldRunHeavyLogic,
    shouldRunUnitAI,
    shouldRunUnitAIMinimal,
    shouldAnimateUnit,
    shouldPathfind,
    pathRecalcInterval,
    offscreenPathMaxNodes,
    isImportantUnit,
    unitPhase,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.UpdateThrottle = UpdateThrottle;
