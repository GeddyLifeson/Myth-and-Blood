/**
 * Eras (waves 100 and 200) are milestones: announced once, with a science grant, and
 * nothing on the field is touched. The full-game crossing of 99-101 and 199-201 is in
 * scripts/test-onefield.mjs; this checks the module on its own.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

function loadProgressionRestarts() {
  const prSrc = readFileSync(join(JS, 'progression-restarts.js'), 'utf8');
  const sb = { Math, Object, Array, JSON, Set };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(`${prSrc}\n({ ProgressionRestarts })`, ctx);
}

const { ProgressionRestarts: PR } = loadProgressionRestarts();

ok(PR.ERAS.length === 2 && PR.ESCALATION_RESTARTS === PR.ERAS, 'two eras (100, 200)');
ok(PR.isEscalationWave(100) && PR.isEscalationWave(200), 'waves 100 and 200 are eras');
for (const w of [99, 101, 150, 175, 400, 500]) ok(!PR.isEscalationWave(w), `wave ${w} is not`);
ok(PR.shouldSkip({ creative: true }), 'skip creative');
ok(PR.shouldSkip({ modeId: 'academy_era' }), 'skip the mode that starts inside an era');
ok(!PR.shouldSkip({ modeId: 'campaign' }), 'campaign not skipped');
for (const era of PR.ERAS) {
  ok(era.opens.length >= 2 && era.tagline, `${era.name} says what it opens`);
  for (const gone of [
    'army',
    'academies',
    'hamlets',
    'guild',
    'tpCarryPct',
    'baseTp',
    'wallSpan',
  ]) {
    ok(!(gone in era), `${era.name} hands out no ${gone}`);
  }
}

function makeCtx(overrides = {}) {
  const units = [
    { id: 'u1', team: 'player', hp: 50 },
    { id: 'u2', team: 'player', hp: 20 },
  ];
  const buildings = [{ id: 'b1', type: 'wall', owner: 'player', hp: 100 }];
  const logs = { science: 0, highlights: [], messages: [], floats: [], forbidden: [] };
  const forbid = (name) => () => logs.forbidden.push(name);
  return {
    wave: overrides.wave ?? 100,
    creative: overrides.creative ?? false,
    modeId: overrides.modeId ?? 'campaign',
    worldW: 400,
    worldH: 600,
    units,
    buildings,
    tactical: 200,
    // Everything the old wipe called. None of it may be touched now.
    releaseAllUnits: forbid('releaseAllUnits'),
    releaseAllBuildings: forbid('releaseAllBuildings'),
    clearProjectiles: forbid('clearProjectiles'),
    applyWorldSize: forbid('applyWorldSize'),
    generateBattlefield: forbid('generateBattlefield'),
    resetCamera: forbid('resetCamera'),
    tryRtsMapExpansion: forbid('tryRtsMapExpansion'),
    bootstrapPlaceComplete: forbid('bootstrapPlaceComplete'),
    bootstrapSpawnArmy: forbid('bootstrapSpawnArmy'),
    bootstrapEnemyEconomyForWave: forbid('bootstrapEnemyEconomyForWave'),
    grantBootstrapUnlocks: forbid('grantBootstrapUnlocks'),
    applyRunStartBonuses: forbid('applyRunStartBonuses'),
    setTactical: forbid('setTactical'),
    captureVeterans: forbid('captureVeterans'),
    restoreVeterans: forbid('restoreVeterans'),
    getResearchCompletedCount: () => overrides.researchDone ?? 4,
    grantScience: (n) => {
      logs.science += n;
    },
    showMessage: (text) => logs.messages.push(text),
    addHighlight: (_t, msg) => logs.highlights.push(msg),
    floatingText: (...a) => logs.floats.push(a),
    logs,
  };
}

PR.resetRun();
const ctx100 = makeCtx({ wave: 100 });
ok(PR.onWaveStart(99, ctx100) === null, 'wave 99: nothing happens');
const r1 = PR.onWaveStart(100, ctx100);
ok(r1?.performed && r1.wiped === false, 'wave 100: the era is entered without a wipe');
ok(
  ctx100.logs.forbidden.length === 0,
  `no wipe or bootstrap hook is called (${ctx100.logs.forbidden})`
);
ok(ctx100.units.length === 2 && ctx100.buildings.length === 1, 'units and buildings untouched');
ok(ctx100.tactical === 200, 'TP untouched');
ok(ctx100.logs.science === 6 + 2, `science bonus granted (${ctx100.logs.science})`);
ok(
  ctx100.logs.highlights.some((h) => h.includes('Empire')),
  'the era is a run highlight'
);
ok(
  ctx100.logs.messages.some((m) => /Wave 100/.test(m)) &&
    ctx100.logs.messages.some((m) => /Now open/.test(m)),
  'it is announced, with what it opens'
);
ok(ctx100.logs.floats.length === 1 && ctx100.logs.floats[0][2] === 'EMPIRE', 'a banner floats');
ok(
  !ctx100.logs.messages.some((m) => /reset|restart|imported/i.test(m)),
  'no message speaks of a reset'
);
ok(PR.onWaveStart(100, ctx100) === null, 'does not fire twice');
ok(PR.onWaveStart(101, ctx100) === null, 'wave 101: nothing happens');

PR.resetRun();
ok(PR.onWaveStart(100, makeCtx({ wave: 100, creative: true })) === null, 'skips creative');

PR.resetRun();
PR.syncFiredThroughWave(210);
ok(PR.onWaveStart(100, makeCtx()) === null, 'sync marks 100 as met');
ok(PR.onWaveStart(200, makeCtx({ wave: 200 })) === null, 'sync marks 200 as met');
ok(PR.getSnapshot().lastEra?.wave === 200, 'sync remembers the latest era');

PR.resetRun();
PR.onWaveStart(200, makeCtx({ wave: 200 }));
const snap = JSON.parse(JSON.stringify(PR.getSnapshot()));
ok(snap.fired.includes(200) && snap.lastEra.shortName === 'Dominion', 'snapshot records the era');
PR.resetRun();
PR.restoreSnapshot(snap);
ok(PR.onWaveStart(200, makeCtx({ wave: 200 })) === null, 'restore prevents a second announcement');
PR.restoreSnapshot({
  fired: [100, 150],
  lastRestart: {
    wave: 100,
    id: 'empire',
    name: 'Empire Ascendant',
    shortName: 'Empire',
    imported: { science: 9 },
  },
});
ok(
  PR.getSnapshot().fired.join() === '100' && PR.getSnapshot().lastEra.science === 9,
  'a snapshot from the old wipe is read, and gates that no longer exist are dropped'
);

PR.resetRun();
ok(PR.formatIntelNote({ wave: 90 }) === '', 'no note far from an era');
const warn = PR.formatIntelNote({ wave: 196 });
ok(
  /Wave 200/.test(warn) && /field stands/.test(warn) && !/reset/i.test(warn),
  `note before an era: ${warn}`
);
ok(PR.formatHudLine({ wave: 50 }) === '', 'no HUD line before any era');
PR.onWaveStart(100, makeCtx());
ok(PR.formatHudLine({ wave: 120 }) === 'Empire era', 'HUD line names the era');
const state = PR.getStateSnapshot({ wave: 120 });
ok(
  state.firedCount === 1 && state.lastEra?.shortName === 'Empire' && state.nextGate?.wave === 200,
  'state snapshot'
);

process.exit(failures() > 0 ? 1 : 0);
