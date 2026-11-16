/**
 * Retired: this layer added hidden spawn bonuses and labels the player never chose.
 * The chosen path in js/eternal-path-framework.js (RunPath) replaced it. The global stays
 * so older callers keep working; every call is a no-op. Old saves still carry a
 * 'ArcanePathEvolution' section, which the save loader ignores as unclaimed.
 */
const ArcanePathEvolution = Object.freeze({
  resetRun() {},
  onWaveStart() {},
  recordBuild() {},
  recordDeploy() {},
  captureFoundingMage() {},
  applyWeaverUnitBonuses() {},
  getStateSnapshot: () => null,
  formatHudLine: () => '',
  formatIntelNote: () => '',
});

globalThis.ArcanePathEvolution = ArcanePathEvolution;
