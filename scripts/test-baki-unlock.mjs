/**
 * Smoke tests — Baki / Hanma unlock via martial melee dominance on Chad+.
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

const martialAch = ACHIEVEMENT_LIST.find((a) => a.id === 'baki_martial_victory');
ok(
  martialAch && martialAch.rule === 'run_martial_melee:8:0.55',
  'baki martial victory achievement exists'
);

function sample(focused, wave) {
  Achievements.onEvent('army_melee_sample', {
    wave,
    focused,
    ratio: focused ? 0.8 : 0.3,
    meleeCount: focused ? 4 : 1,
    combatCount: 5,
  });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'chad' });
for (let w = 1; w <= 10; w++) sample(w <= 7, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(MetaProgress.isBakiUnlocked(), 'chad victory with majority melee-focused waves unlocks Baki');
ok(Achievements.evaluateRule('run_martial_melee:8:0.55'), 'martial melee rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'chad' });
for (let w = 1; w <= 10; w++) sample(w <= 3, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isBakiUnlocked(), 'low melee-focus majority blocks Baki unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(true, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isBakiUnlocked(), 'normal difficulty blocks Baki unlock even with melee focus');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'doomslayer' });
for (let w = 1; w <= 10; w++) sample(true, w);
Achievements.onEvent('game_end', { victory: false, wave: 80 });
ok(!MetaProgress.isBakiUnlocked(), 'defeat with good melee focus does not unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'doomslayer' });
for (let w = 1; w <= 10; w++) sample(true, w);
ok(Achievements.evaluateRule('melee_focus_waves:10'), 'ten melee-focused wave milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll baki-unlock tests passed');