/**
 * Smoke tests for pacing tools — strong pause, speed 1×–10×, notification queuing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadPacingTools() {
  const src = readFileSync(join(JS, 'pacing-tools.js'), 'utf8');
  const sb = {
    Math,
    Object,
    Array,
    JSON,
    Set,
    Date,
    parseFloat,
    Number,
    document: undefined,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(`${src}\n({ PacingTools })`, ctx);
}

const { PacingTools } = loadPacingTools();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

PacingTools.resetRun();

ok(PacingTools.SPEED_OPTIONS.includes(10), 'speed options include 10×');
ok(PacingTools.SPEED_OPTIONS.includes(1.5), 'speed options include 1.5×');
ok(PacingTools.normalizeSpeed(7) === 6 || PacingTools.normalizeSpeed(7) === 8, 'normalizeSpeed snaps near values');
ok(PacingTools.normalizeSpeed(10) === 10, 'normalizeSpeed keeps 10');
ok(PacingTools.getMaxSimulationSteps(1) === 1, '1× yields one sim step cap');
ok(PacingTools.getMaxSimulationSteps(10) === 10, '10× yields ten sim step cap');
ok(PacingTools.cycleSpeed(10) === 1, 'cycleSpeed wraps from 10× to 1×');

const shown = [];
const ctx = {
  paused: true,
  visibleCount: 0,
  directShow: (text) => shown.push(text),
};

const q1 = PacingTools.processMessage('Queued while paused', 200, { paused: true });
ok(q1.queued === true, 'queues message while paused');
ok(PacingTools.getQueueDepth() === 1, 'queue depth is 1');

const q2 = PacingTools.processMessage('Critical alert', 200, { paused: true, priority: 'critical' });
ok(q2.queued === false && q2.shown === true, 'critical bypasses queue');

ctx.paused = false;
PacingTools.onPauseChanged(false, { ...ctx, reason: 'user' });
ok(shown.length >= 1, 'drains queue on resume');
ok(PacingTools.getQueueDepth() === 0, 'queue drained after resume');

PacingTools.resetRun();
PacingTools.onMacroPanelOpen('grand_strategy', {
  alreadyPaused: false,
  setPaused: (v, o) => {
    ctx.paused = v;
    PacingTools.onPauseChanged(v, { ...ctx, reason: o?.reason || 'user' });
  },
});
const overlay = PacingTools.getPauseOverlay();
ok(overlay.title === 'STRONG PAUSE', 'macro panel shows strong pause title');
ok(overlay.subtitle.includes('Empire planning'), 'macro panel shows empire planning reason');
ok(PacingTools.shouldHoldPause() === true, 'shouldHoldPause while macro panel open');

PacingTools.onMacroPanelClose('grand_strategy', {
  setPaused: (v, o) => {
    ctx.paused = v;
    PacingTools.onPauseChanged(v, { ...ctx, reason: o?.reason || 'user' });
  },
});
ok(ctx.paused === false, 'auto-resumes after macro panel close');
ok(PacingTools.getPauseOverlay().title === 'PAUSED' || PacingTools.getPauseOverlay().title.length > 0, 'overlay after macro close');

PacingTools.resetRun();
PacingTools.onPauseChanged(true, { ...ctx, reason: 'user' });
ctx.paused = true;
PacingTools.onMacroPanelOpen('intergalactic', { alreadyPaused: true, setPaused: () => {} });
ok(PacingTools.getPauseOverlay().subtitle.includes('Player pause'), 'user pause takes priority over macro reason');

const intelFast = PacingTools.formatIntelNote({ gameSpeed: 10 });
ok(intelFast.includes('10'), 'formatIntelNote at 10×');

PacingTools.resetRun();
for (let i = 0; i < 6; i++) {
  PacingTools.processMessage(`msg ${i}`, 100, { paused: true });
}
const intelQueue = PacingTools.formatIntelNote({ gameSpeed: 1 });
ok(intelQueue.includes('queued'), 'formatIntelNote when queue saturated');

const hud = PacingTools.formatHudLine({ gameSpeed: 8, paused: true });
ok(hud.includes('8×') && hud.includes('PAUSED'), 'formatHudLine shows speed and pause');

console.log(failed ? `\n${failed} test(s) failed` : '\nAll pacing-tools tests passed');
process.exit(failed ? 1 : 0);