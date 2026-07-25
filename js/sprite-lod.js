/**
 * Sprite LOD — simplify procedural unit drawing and FX at high unit counts.
 */
const SpriteLod = (() => {
  const LOD = { FULL: 0, MEDIUM: 1, LOW: 2, MINIMAL: 3 };

  function getSceneLod(unitCount, gfxQ) {
    const thresholds = gfxQ?.spriteLodThresholds ?? [42, 68, 92, 118];
    let lod = gfxQ?.spriteLodFloor ?? 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (unitCount >= thresholds[i]) lod = Math.max(lod, i + 1);
    }
    return Math.min(LOD.MINIMAL, lod);
  }

  function isImportantUnit(unit, selectedIds) {
    if (!unit) return false;
    if (selectedIds?.has?.(unit.id)) return true;
    if (unit.isGeneral || unit.isNamedBoss || unit.isDoomslayer) return true;
    if (unit.type === 'war_chief' || unit.type === 'siege_tower') return true;
    if (unit.isWwe && unit.team === 'player') return true;
    return false;
  }

  function getUnitLod(unit, sceneLod, ctx = {}) {
    if (ctx.selectedIds?.has?.(unit.id)) return LOD.FULL;
    if (isImportantUnit(unit, ctx.selectedIds)) return Math.min(sceneLod, LOD.MEDIUM);
    if ((unit.attackAnimTimer || 0) > 0 || unit.animState === 'attack' || unit.animState === 'hurt') {
      return Math.min(sceneLod, LOD.MEDIUM);
    }
    let lod = sceneLod;
    const farPad = ctx.farPad ?? 110;
    if (typeof ctx.isInView === 'function' && !ctx.isInView(unit.x, unit.y, 28, farPad)) {
      lod = Math.min(LOD.MINIMAL, lod + 1);
    }
    return lod;
  }

  function shouldDrawUnitOverlays(lod) {
    return lod <= LOD.MEDIUM;
  }

  function shouldDrawUnitRings(lod) {
    return lod <= LOD.LOW;
  }

  function particleMultForLod(lod) {
    if (lod <= LOD.FULL) return 1;
    if (lod === LOD.MEDIUM) return 0.72;
    if (lod === LOD.LOW) return 0.48;
    return 0.3;
  }

  function spawnCountScale(lod) {
    return particleMultForLod(lod);
  }

  function cacheFrameForLod(lod, frame, animState = 'idle') {
    if (animState === 'attack' || animState === 'hurt' || animState === 'death') return frame;
    return lod >= LOD.LOW ? 0 : frame;
  }

  function cacheAnimForLod(lod, animState) {
    if (animState === 'attack' || animState === 'hurt' || animState === 'death') return animState;
    return lod >= LOD.LOW ? 'idle' : animState;
  }

  return {
    LOD,
    getSceneLod,
    getUnitLod,
    isImportantUnit,
    shouldDrawUnitOverlays,
    shouldDrawUnitRings,
    particleMultForLod,
    spawnCountScale,
    cacheFrameForLod,
    cacheAnimForLod,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SpriteLod = SpriteLod;
