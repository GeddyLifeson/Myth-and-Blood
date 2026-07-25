/**
 * Smoke tests — LOTR unlock via fellowship morale challenge.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const mp = readFileSync(join(JS, 'meta-progress.js'), 'utf8');
  const achData = readFileSync(join(JS, 'achievements-data.js'), 'utf8');
  const ach = readFileSync(join(JS, 'achievements.js'), 'utf8');
  const sb = {
    Math,
    Object,
    Array,
    Set,
    JSON,
    Date,
    parseInt,
    parseFloat,
    Number,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    Game: { isPlaying: () => false },
    WweDefs: {},
    CrossoverDefs: {},
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(
    `${mp}\n;\n${achData}\n;\n${ach}\n;globalThis.MetaProgress = MetaProgress;\nglobalThis.Achievements = Achievements;\nglobalThis.ACHIEVEMENT_LIST = ACHIEVEMENT_LIST;`,
    ctx
  );
  return { MetaProgress: ctx.MetaProgress, Achievements: ctx.Achievements, ACHIEVEMENT_LIST: ctx.ACHIEVEMENT_LIST };
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { MetaProgress, Achievements, ACHIEVEMENT_LIST } = loadModules();

const fellowAch = ACHIEVEMENT_LIST.find((a) => a.id === 'lotr_fellowship_victory');
ok(fellowAch && fellowAch.rule === 'run_fellowship_morale:8:0.55', 'lotr fellowship achievement exists');

function sample(high, wave) {
  Achievements.onEvent('army_morale_sample', { wave, high, ratio: high ? 0.8 : 0.3, combatCount: 4 });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(w <= 7, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(MetaProgress.isLotrUnlocked(), 'victory with majority high-morale waves unlocks LOTR');
ok(Achievements.evaluateRule('run_fellowship_morale:8:0.55'), 'fellowship morale rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(w <= 3, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isLotrUnlocked(), 'low morale majority blocks LOTR unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(true, w);
Achievements.onEvent('game_end', { victory: false, wave: 80 });
ok(!MetaProgress.isLotrUnlocked(), 'defeat with good morale does not unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(true, w);
ok(Achievements.evaluateRule('morale_high_waves:10'), 'ten high morale waves milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll lotr-unlock tests passed');