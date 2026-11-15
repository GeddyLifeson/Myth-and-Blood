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
    if (
      (unit.attackAnimTimer || 0) > 0 ||
      unit.animState === 'attack' ||
      unit.animState === 'hurt'
    ) {
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

  // Sprites are drawn once and cached, so the nearer tiers keep the real figure and
  // only thin out what multiplies cache entries: idle variations, then the extra states.
  function isKeyAnim(animState) {
    return (
      animState === 'attack' ||
      animState === 'hurt' ||
      animState === 'death' ||
      (typeof animState === 'string' && animState.startsWith('die_'))
    );
  }

  /** States a crowd-tier sprite still shows: they say what the unit is doing. */
  const CROWD_ANIMS = new Set(['walk', 'rout', 'yield', 'throw', 'lay']);

  function cacheFrameForLod(lod, frame, animState = 'idle') {
    if (isKeyAnim(animState)) return frame;
    if (lod >= LOD.MINIMAL) return 0;
    if (lod >= LOD.LOW) return CROWD_ANIMS.has(animState) ? frame : 0;
    return frame;
  }

  function cacheAnimForLod(lod, animState) {
    if (isKeyAnim(animState)) return animState;
    if (lod >= LOD.MINIMAL) return 'idle';
    if (lod >= LOD.LOW) {
      // A crowd still walks and still routs; work poses and cheering fall back to idle.
      return CROWD_ANIMS.has(animState) ? animState : 'idle';
    }
    return animState;
  }

  return {
    getSceneLod,
    getUnitLod,
    isImportantUnit,
    shouldDrawUnitOverlays,
    shouldDrawUnitRings,
    particleMultForLod,
    cacheFrameForLod,
    cacheAnimForLod,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SpriteLod = SpriteLod;
