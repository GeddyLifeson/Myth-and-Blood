/**
 * Retired: this layer added hidden spawn bonuses and labels the player never chose.
 * The chosen path in js/eternal-path-framework.js (RunPath) replaced it. The global stays
 * so older callers keep working; every call is a no-op. Old saves still carry a
 * 'MartialPathEvolution' section, which the save loader ignores as unclaimed.
 */
const MartialPathEvolution = Object.freeze({
  resetRun() {},
  onWaveStart() {},
  recordBuild() {},
  recordDeploy() {},
  captureGeneFather() {},
  applyLegionUnitBonuses() {},
  getStateSnapshot: () => null,
  formatHudLine: () => '',
  formatIntelNote: () => '',
});

globalThis.MartialPathEvolution = MartialPathEvolution;
