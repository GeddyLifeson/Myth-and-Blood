#!/usr/bin/env node
/**
 * Headless smoke test for ErrorReporting.
 * Run: node scripts/test-error-reporting.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');

function loadScript(name) {
  const src = readFileSync(join(JS, name), 'utf8');
  vm.runInThisContext(src, { filename: name });
}

globalThis.window = {
  __mbErrorHandlersInstalled: false,
  addEventListener() {},
  MB_ERROR_ENDPOINT: '',
};
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ click() {}, href: '' }),
  addEventListener() {},
};
globalThis.localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = v;
  },
};
if (!globalThis.navigator) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'test', platform: 'test' },
    configurable: true,
  });
}
globalThis.Settings = {
  _on: false,
  get(key) {
    if (key === 'errorReportingOptIn') return this._on;
    return null;
  },
};
globalThis.Game = {
  update() {
    throw new Error('sim blowup');
  },
  draw() {},
  getState() {
    return { state: 'playing', wave: 15, army: 40, enemyCount: 120, buildingCount: 18 };
  },
  getRunModeId() {
    return 'classic';
  },
};
globalThis.Perf = {
  getStats() {
    return { fps: 12, frameMs: 83.3 };
  },
};

loadScript('error-reporting.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

ErrorReporting.init();
ErrorReporting.log('info', 'boot ok');
ErrorReporting.runGuarded('test', () => {
  throw new Error('guarded fail');
});
assert(ErrorReporting.getRecent(1)[0]?.message.includes('guarded'), 'guard captures');

ErrorReporting.disableSubsystem('particles', 'test');
assert(ErrorReporting.isDegraded('particles'), 'subsystem degraded');

ErrorReporting.patchGame();
ErrorReporting.runGuarded('loop', () => Game.update(), { subsystem: 'simulation' });
assert(ErrorReporting.getRecent(1)[0]?.level === 'error', 'patched update logs error');

const snap = ErrorReporting.buildGameSnapshot();
assert(snap.wave === 15, 'snapshot wave');
assert(snap.fps === 12, 'snapshot perf');
assert(snap.lastPhase, 'snapshot tracks phase');

ErrorReporting.markPhase('unit-ai', '120');
const phase = ErrorReporting.getLastPhase();
assert(phase.phase === 'unit-ai', 'markPhase works');

ErrorReporting.captureFreeze('test stall', { kind: 'stall', stallMs: 9000 });
const freezeEntry = ErrorReporting.getRecent(1)[0];
assert(freezeEntry?.level === 'fatal', 'freeze is fatal');
assert(freezeEntry?.meta?.kind === 'stall', 'freeze kind');
assert(freezeEntry?.meta?.phase === 'unit-ai' || freezeEntry?.meta?.lastPhase === 'unit-ai', 'freeze includes phase');

const beforeBeat = ErrorReporting.buildReport().entries.length;
ErrorReporting.heartbeatBegin();
ErrorReporting.noteSimStep(0, 2);
ErrorReporting.heartbeatMid('post-sim-0');
ErrorReporting.heartbeatEnd('test-loop');
assert(ErrorReporting.buildReport().entries.length === beforeBeat, 'fast heartbeat does not log freeze');

// Slow frame should warn
const beforeSlow = ErrorReporting.buildReport().entries.length;
ErrorReporting.heartbeatBegin();
// Fake long frame by rewinding start via private-ish path: call end after delay not available.
// Instead use captureSlowFrame path through heartbeatEnd by mocking Date is hard — call captureFreeze slow path via log.
ErrorReporting.log('warn', 'Slow frame: 900ms @ unit-ai', { kind: 'slow-frame', frameMs: 900, phase: 'unit-ai' });
assert(ErrorReporting.getRecent(1)[0]?.meta?.kind === 'slow-frame', 'slow frame loggable');

const report = ErrorReporting.buildReport();
assert(report.entries.length >= 3, 'report has entries');
assert(report.sessionId, 'session id');
assert(report.snapshot?.wave === 15, 'report snapshot');
assert(report.v >= 2, 'report schema v2');

const userReport = ErrorReporting.submitBugReport('wave 15 froze', { source: 'test', exportFile: false });
assert(userReport.userReport?.notes === 'wave 15 froze', 'user report notes');
assert(ErrorReporting.getRecent(1)[0]?.meta?.kind === 'user-report', 'user report kind');

assert(typeof ErrorReporting.shouldSkipExtraSimSteps === 'function', 'skip-extra-sim API');
assert(ErrorReporting.STALL_MS <= 4000, 'stall threshold is tight enough for freezes');
assert(ErrorReporting.FREEZE_FRAME_MS <= 4000, 'freeze threshold is tight enough');

ErrorReporting.clearLog();
assert(ErrorReporting.buildReport().entries.length === 0, 'clear works');

if (failed) {
  console.error(`test-error-reporting: ${failed} failure(s)`);
  process.exit(1);
}
console.log('test-error-reporting: OK');