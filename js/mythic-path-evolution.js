/**
 * Retired: this layer added hidden spawn bonuses and labels the player never chose.
 * The chosen path in js/eternal-path-framework.js (RunPath) replaced it. The global stays
 * so older callers keep working; every call is a no-op. Old saves still carry a
 * 'MythicPathEvolution' section, which the save loader ignores as unclaimed.
 */
const MythicPathEvolution = Object.freeze({
  resetRun() {},
  onWaveStart() {},
  recordDeploy() {},
  recordFaction() {},
  recordHeroEcho() {},
  captureFirstChampion() {},
  applyChampionUnitBonuses() {},
  getStateSnapshot: () => null,
  formatHudLine: () => '',
  formatIntelNote: () => '',
});

globalThis.MythicPathEvolution = MythicPathEvolution;
