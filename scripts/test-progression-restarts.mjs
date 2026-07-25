/**
 * Smoke tests for progression escalation restarts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadProgressionRestarts() {
  const prSrc = readFileSync(join(JS, 'progression-restarts.js'), 'utf8');
  const sb = { Math, Object, Array, JSON, Set };
  sb.RTS_ERA_WAVE = 200;
  sb.getKingdomStageBuffs = (wave) => ({
    veteranMoraleCap: wave >= 31 ? 1 : 0,
    stage: wave >= 200 ? 4 : wave >= 100 ? 3 : 2,
  });
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(`${prSrc}\n({ ProgressionRestarts })`, ctx);
}

const { ProgressionRestarts } = loadProgressionRestarts();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(ProgressionRestarts.ESCALATION_RESTARTS.length === 5, 'five escalation gates');
ok(ProgressionRestarts.isEscalationWave(100), 'wave 100 is escalation');
ok(ProgressionRestarts.isEscalationWave(150), 'wave 150 is escalation');
ok(ProgressionRestarts.isEscalationWave(200), 'wave 200 is escalation');
ok(ProgressionRestarts.isEscalationWave(400), 'wave 400 is escalation');
ok(ProgressionRestarts.isEscalationWave(500), 'wave 500 is escalation');
ok(!ProgressionRestarts.isEscalationWave(99), 'wave 99 is not escalation');
ok(!ProgressionRestarts.isEscalationWave(175), 'wave 175 is not escalation');

ok(ProgressionRestarts.shouldSkip({ creative: true }), 'skip creative');
ok(ProgressionRestarts.shouldSkip({ modeId: 'academy_era' }), 'skip academy era');
ok(ProgressionRestarts.shouldSkip({ modeId: 'planet_conquest' }), 'skip planet conquest');
ok(!ProgressionRestarts.shouldSkip({ modeId: 'campaign' }), 'campaign not skipped');

ProgressionRestarts.resetRun();

function makeCtx(overrides = {}) {
  const units = overrides.units || [{ team: 'player', hp: 50, morale: 10, maxMorale: 20 }];
  const buildings = overrides.buildings || [];
  let tactical = overrides.tactical ?? 200;
  const logs = { released: 0, spawned: 0, science: 0, highlights: [] };
  return {
    wave: overrides.wave ?? 100,
    creative: overrides.creative ?? false,
    modeId: overrides.modeId ?? 'campaign',
    worldW: 800,
    worldH: 600,
    rallyY: 400,
    deployY: 450,
    units,
    getTactical: () => tactical,
    setTactical: (n) => {
      tactical = n;
    },
    releaseAllUnits: () => {
      units.length = 0;
      logs.released++;
    },
    releaseAllBuildings: () => {
      buildings.length = 0;
      logs.released++;
    },
    clearProjectiles: () => {},
    applyWorldSize: () => {},
    generateBattlefield: () => {},
    invalidateObstacles: () => {},
    resetCamera: () => {},
    tryRtsMapExpansion: () => {},
    bootstrapPlaceComplete: (type) => {
      buildings.push({ type, owner: 'player', complete: true, hp: 100 });
    },
    bootstrapSpawnArmy: (rows) => {
      for (const row of rows) {
        for (let i = 0; i < row.count; i++) {
          units.push({ team: 'player', type: row.type, hp: 40, morale: 10, maxMorale: 20 });
          logs.spawned++;
        }
      }
    },
    bootstrapEnemyEconomyForWave: () => {
      buildings.push({ type: 'enemy_trade_outpost', owner: 'enemy', hp: 100 });
    },
    grantBootstrapUnlocks: () => {},
    getResearchCompletedCount: () => overrides.researchDone ?? 4,
    applyRunStartBonuses: () => ({ heirs: 1, startTp: 4, activePassives: 2 }),
    grantScience: (n) => {
      logs.science += n;
    },
    showMessage: () => {},
    addHighlight: (_t, msg) => logs.highlights.push(msg),
    floatingText: () => {},
    get tactical() {
      return tactical;
    },
    get buildings() {
      return buildings;
    },
    logs,
    ...overrides.ctx,
  };
}

const ctx100 = makeCtx({ wave: 100, tactical: 200 });
const r1 = ProgressionRestarts.performRestart(100, ctx100);
ok(r1?.performed, 'performs restart at wave 100');
ok(ctx100.units.length > 0, 'spawns player army after restart');
ok(ctx100.buildings.length > 0, 'seeds buildings after restart');
ok(ctx100.tactical >= 110 + Math.floor(200 * 0.35), 'imports TP carryover');
ok(ctx100.logs.science >= 6, 'grants science bonus');
ok(ctx100.logs.highlights.some((h) => h.includes('Empire')), 'highlights empire restart');

const r1dup = ProgressionRestarts.performRestart(100, ctx100);
ok(!r1dup?.performed, 'does not double-fire same gate');

ProgressionRestarts.resetRun();
const skipCtx = makeCtx({ wave: 100, creative: true });
ok(!ProgressionRestarts.performRestart(100, skipCtx)?.performed, 'skips creative');

ProgressionRestarts.resetRun();
ProgressionRestarts.syncFiredThroughWave(210);
ok(!ProgressionRestarts.performRestart(100, makeCtx({ wave: 100 }))?.performed, 'sync marks 100 fired');
ok(!ProgressionRestarts.performRestart(150, makeCtx({ wave: 150 }))?.performed, 'sync marks 150 fired');
ok(!ProgressionRestarts.performRestart(200, makeCtx({ wave: 200 }))?.performed, 'sync marks 200 fired');

ProgressionRestarts.resetRun();
ProgressionRestarts.performRestart(200, makeCtx({ wave: 200, tactical: 500 }));
const snap = ProgressionRestarts.getSnapshot();
ok(snap.fired.includes(200), 'snapshot records fired gate');
ok(snap.lastRestart?.imported?.tp > 0, 'snapshot records import totals');
ProgressionRestarts.restoreSnapshot(snap);
ok(!ProgressionRestarts.performRestart(200, makeCtx({ wave: 200 }))?.performed, 'restore prevents refire');

ProgressionRestarts.resetRun();
const intelWarn = ProgressionRestarts.formatIntelNote({ wave: 145 });
ok(intelWarn.includes('Escalation'), 'intel warns before next gate');
ProgressionRestarts.performRestart(100, makeCtx({ wave: 100 }));
const intelLegacy = ProgressionRestarts.formatIntelNote({ wave: 160 });
ok(intelLegacy.includes('Legacy import'), 'intel notes last import after restart');

const hud = ProgressionRestarts.formatHudLine({ wave: 200 });
ok(hud.includes('import'), 'hud line describes import');

ProgressionRestarts.resetRun();
ProgressionRestarts.performRestart(200, makeCtx({ wave: 200 }));
const state = ProgressionRestarts.getStateSnapshot({ wave: 200 });
ok(state.firedCount === 1, 'state snapshot fired count');
ok(state.lastRestart?.shortName === 'Dominion', 'state snapshot last restart');

process.exit(failed > 0 ? 1 : 0);