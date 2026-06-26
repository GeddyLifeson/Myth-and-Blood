/**
 * Adaptive graphics quality — auto-tiers from FPS + unit load, or manual override.
 */
const GfxQuality = (() => {
  const TIER_ORDER = ['high', 'normal', 'reduced', 'potato'];

  const PROFILE = {
    high: {
      particleMult: 1,
      spatialInterval: 1,
      rotationStep: 1,
      sortFrameShift: 2,
      drawMorale: true,
      drawVet: true,
      drawHonor: true,
      drawAccent: true,
      drawAccessibility: true,
      atmosphere: 'full',
      drawCorpses: true,
      drawBorders: true,
      drawDecor: true,
      drawHazards: true,
      drawLanternAuras: true,
      projectileTrails: true,
      trailEveryN: 1,
      offscreenEnemyMinUnits: 55,
      pathfindMult: 1,
      minimapInterval: 5,
      deathParticleMult: 1,
      weatherParticles: true,
      buildingHpBars: true,
      unitHpBars: 'all',
      eliteRings: true,
      rallyRings: true,
      chargeGlow: true,
      honorGlow: true,
      generalOverlay: true,
    },
    normal: {
      particleMult: 0.85,
      spatialInterval: 1,
      rotationStep: 15,
      sortFrameShift: 2,
      drawMorale: true,
      drawVet: true,
      drawHonor: true,
      drawAccent: true,
      drawAccessibility: true,
      atmosphere: 'full',
      drawCorpses: true,
      drawBorders: true,
      drawDecor: true,
      drawHazards: true,
      drawLanternAuras: true,
      projectileTrails: true,
      trailEveryN: 1,
      offscreenEnemyMinUnits: 50,
      pathfindMult: 0.9,
      minimapInterval: 5,
      deathParticleMult: 0.85,
      weatherParticles: true,
      buildingHpBars: true,
      unitHpBars: 'all',
      eliteRings: true,
      rallyRings: true,
      chargeGlow: true,
      honorGlow: true,
      generalOverlay: true,
    },
    reduced: {
      particleMult: 0.55,
      spatialInterval: 2,
      rotationStep: 30,
      sortFrameShift: 3,
      drawMorale: false,
      drawVet: false,
      drawHonor: 'selected',
      drawAccent: 'selected',
      drawAccessibility: false,
      atmosphere: 'simple',
      drawCorpses: false,
      drawBorders: true,
      drawDecor: true,
      drawHazards: true,
      drawLanternAuras: false,
      projectileTrails: true,
      trailEveryN: 2,
      offscreenEnemyMinUnits: 40,
      pathfindMult: 0.75,
      minimapInterval: 8,
      deathParticleMult: 0.5,
      weatherParticles: false,
      buildingHpBars: true,
      unitHpBars: 'selected',
      eliteRings: 'boss',
      rallyRings: false,
      chargeGlow: false,
      honorGlow: 'selected',
      generalOverlay: true,
    },
    potato: {
      particleMult: 0.32,
      spatialInterval: 3,
      rotationStep: 45,
      sortFrameShift: 4,
      drawMorale: false,
      drawVet: false,
      drawHonor: 'selected',
      drawAccent: false,
      drawAccessibility: false,
      atmosphere: 'none',
      drawCorpses: false,
      drawBorders: false,
      drawDecor: false,
      drawHazards: true,
      drawLanternAuras: false,
      projectileTrails: false,
      trailEveryN: 4,
      offscreenEnemyMinUnits: 28,
      pathfindMult: 0.55,
      minimapInterval: 12,
      deathParticleMult: 0.25,
      weatherParticles: false,
      buildingHpBars: true,
      unitHpBars: 'important',
      eliteRings: 'boss',
      rallyRings: false,
      chargeGlow: false,
      honorGlow: false,
      generalOverlay: true,
    },
  };

  let setting = 'auto';
  let effectiveTier = 'normal';
  let autoTier = 'normal';
  let lastUnitCount = 0;
  let fpsEma = 60;

  function tierIndex(t) {
    const i = TIER_ORDER.indexOf(t);
    return i >= 0 ? i : 1;
  }

  function clampTier(t) {
    return PROFILE[t] ? t : 'normal';
  }

  function worseTier(a, b) {
    return tierIndex(a) >= tierIndex(b) ? a : b;
  }

  function betterTier(a, b) {
    return tierIndex(a) <= tierIndex(b) ? a : b;
  }

  function tierFromFpsAndLoad(fps, units) {
    if (fps < 24 || units > 110) return 'potato';
    if (fps < 32 || units > 85) return 'reduced';
    if (fps < 48 || units > 65) return 'normal';
    return 'high';
  }

  function recomputeEffective() {
    if (setting !== 'auto') {
      effectiveTier = clampTier(setting);
    } else {
      effectiveTier = autoTier;
    }
    if (typeof Settings !== 'undefined' && Settings.get('reducedMotion')) {
      effectiveTier = worseTier(effectiveTier, 'reduced');
    }
  }

  function setMode(mode) {
    setting = mode || 'auto';
    recomputeEffective();
  }

  function tick(fps, unitCount = 0) {
    lastUnitCount = unitCount;
    if (typeof fps === 'number' && fps > 0) {
      fpsEma = fpsEma * 0.88 + fps * 0.12;
    }
    const target = tierFromFpsAndLoad(fpsEma, unitCount);
    if (setting === 'auto') {
      const cur = tierIndex(autoTier);
      const tgt = tierIndex(target);
      if (tgt > cur) autoTier = target;
      else if (tgt < cur && fpsEma > 52 && unitCount < 60) autoTier = betterTier(autoTier, target);
      else if (tgt < cur && fpsEma > 42) autoTier = TIER_ORDER[Math.max(0, cur - 1)];
    }
    recomputeEffective();
  }

  function get() {
    return PROFILE[effectiveTier] || PROFILE.normal;
  }

  function getTier() {
    return effectiveTier;
  }

  function getSetting() {
    return setting;
  }

  function getLabel() {
    const labels = { high: 'High', normal: 'Normal', reduced: 'Reduced', potato: 'Potato' };
    if (setting === 'auto') return `Auto (${labels[effectiveTier] || effectiveTier})`;
    return labels[setting] || setting;
  }

  function quantizeRotation(deg) {
    const step = get().rotationStep || 1;
    if (step <= 1) return Math.round(deg);
    return Math.round(deg / step) * step;
  }

  function flagForUnit(mode, unit, isSelected) {
    if (mode === true || mode === 'all') return true;
    if (!mode || mode === false) return false;
    if (mode === 'selected') return isSelected;
    if (mode === 'important') {
      return isSelected || unit.isGeneral || unit.isDoomslayer || unit.isWwe || isEliteEnemy?.(unit);
    }
    if (mode === 'boss') return unit.type === 'war_chief' || unit.isNamedBoss || unit.isDoomslayer;
    return false;
  }

  function shouldDrawUnitOverlay(unit, selectedIds, mode) {
    const sel = unit.id === selectedIds.primary || selectedIds.list.includes(unit.id);
    return flagForUnit(mode, unit, sel);
  }

  function allowProjectileTrails(projectileCount) {
    const q = get();
    if (!q.projectileTrails) return false;
    if (effectiveTier === 'potato') return projectileCount < 12;
    if (effectiveTier === 'reduced') return projectileCount < 28;
    return true;
  }

  function allowDeathFx() {
    return get().deathParticleMult > 0.2;
  }

  function initFromSettings() {
    if (typeof Settings !== 'undefined') {
      setMode(Settings.get('performanceMode') || 'auto');
    }
  }

  return {
    initFromSettings,
    setMode,
    tick,
    get,
    getTier,
    getSetting,
    getLabel,
    quantizeRotation,
    shouldDrawUnitOverlay,
    allowProjectileTrails,
    allowDeathFx,
    TIER_ORDER,
  };
})();