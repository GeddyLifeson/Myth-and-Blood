/**
 * Retired: this layer added hidden spawn bonuses and labels the player never chose.
 * The chosen path in js/eternal-path-framework.js (RunPath) replaced it. The global stays
 * so older callers keep working; every call is a no-op. Old saves still carry a
 * 'ThematicEraSynergies' section, which the save loader ignores as unclaimed.
 */
const ThematicEraSynergies = Object.freeze({
  resetRun() {},
  onWaveStart() {},
  applyThematicUnitBonuses() {},
  recruitHeroEcho: () => ({ ok: false, msg: 'Hero echoes are no longer offered.' }),
  getStateSnapshot: () => null,
  formatHudLine: () => '',
  formatIntelNote: () => '',
});

globalThis.ThematicEraSynergies = ThematicEraSynergies;
