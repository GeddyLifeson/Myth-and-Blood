/**
 * Smoke tests for GameFeedback module.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'js', 'game-feedback.js'), 'utf8');

const sb = {
  console,
  Math,
  Object,
  Array,
  Number,
  String,
  Date,
  Settings: {
    store: {
      combatShake: true,
      damageNumbers: true,
      hitStop: true,
      gore: true,
      killStreaks: true,
      waveSummary: true,
      autoPauseNight: false,
      dangerVignette: true,
      lowHpPulse: true,
      reducedMotion: false,
    },
    get(k) {
      return this.store[k];
    },
  },
  AudioEngine: {
    SFX: {
      multiKill() {},
      waveClear() {},
      perfectClear() {},
    },
  },
};
sb.window = sb;
sb.globalThis = sb;
const ctx = vm.createContext(sb);
vm.runInContext(`${code}\nthis.GameFeedback = GameFeedback;`, ctx);
const GF = ctx.GameFeedback;

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(typeof GF.onEnemyKilled === 'function', 'onEnemyKilled');
ok(typeof GF.onWaveClear === 'function', 'onWaveClear');
ok(typeof GF.drawBanner === 'function', 'drawBanner');
ok(GF.allowShake() === true, 'allowShake default on');
ok(GF.allowHitStop() === true, 'allowHitStop default on');

GF.resetRun();
GF.onEnemyKilled({ x: 1, y: 1 });
GF.onEnemyKilled({ x: 1, y: 1 });
GF.onEnemyKilled({ x: 1, y: 1 });
ok(GF.getKillStreak() === 3, 'streak reaches 3');
ok(GF.getWaveStats().kills === 3, 'wave kills tracked');

const summary = GF.onWaveClear({ wave: 5, tpGained: 12, waveKills: 3, casualties: 0 });
ok(summary.clean === true, 'clean sweep when 0 deaths');
ok(summary.tp === 12, 'tp recorded');
ok(GF.getBanner()?.text, 'banner set after clear');
ok(GF.getWaveStats().kills === 0, 'wave stats reset after clear');

GF.onWaveStart(6, { boss: true, subtitle: 'Test Boss' });
ok(GF.getBanner()?.text === 'BOSS WAVE', 'boss wave banner');

GF.updateDanger(
  [
    { team: 'enemy', hp: 10, y: 400 },
    { team: 'enemy', hp: 10, y: 450 },
    { team: 'player', hp: 10, y: 500 },
  ],
  600,
  300
);
ok(GF.getDangerLevel() > 0, 'danger level rises with deep enemies');

const tips = GF.buildNightTips({
  tactical: 20,
  army: 2,
  liveBuilders: 0,
  wallCount: 0,
  wave: 4,
  hasHealer: false,
  hasRanged: false,
  hasMelee: true,
  nextWaveIntel: '12 goblins',
});
ok(tips.length > 0, 'night tips generated');
ok(GF.getRunSnapshot().bestStreak >= 3, 'run snapshot has best streak');
ok(Array.isArray(GF.getHighlights()), 'highlights array');

sb.Settings.store.combatShake = false;
ok(GF.allowShake() === false, 'combatShake off');
sb.Settings.store.reducedMotion = true;
ok(GF.allowHitStop() === false, 'hitStop off under reduced motion');

const mockCtx = {
  save() {},
  restore() {},
  setTransform() {},
  fillText() {},
  fillRect() {},
  strokeRect() {},
  beginPath() {},
  arc() {},
  stroke() {},
  createRadialGradient() {
    return { addColorStop() {} };
  },
  font: '',
  fillStyle: '',
  strokeStyle: '',
  globalAlpha: 1,
  textAlign: '',
  textBaseline: '',
  shadowColor: '',
  shadowBlur: 0,
  lineWidth: 1,
};
GF.drawBanner(mockCtx, 800, 600);
GF.drawDangerVignette(mockCtx, 800, 600);
GF.drawLowHpPulse(mockCtx, { x: 10, y: 10, hp: 5, maxHp: 100 }, 10);
ok(true, 'draw helpers run');

console.log(failed ? `\n${failed} failed` : '\nAll game-feedback tests passed.');
process.exit(failed ? 1 : 0);
