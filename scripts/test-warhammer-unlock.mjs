/**
 * Smoke tests — Warhammer / Eternal Crusade unlock via fortress line + named boss repels on Chad+.
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

const crusadeAch = ACHIEVEMENT_LIST.find((a) => a.id === 'warhammer_eternal_crusade');
ok(
  crusadeAch && crusadeAch.rule === 'run_eternal_crusade:3:8',
  'eternal crusade victory achievement exists'
);

function sampleForts(count, wave) {
  Achievements.onEvent('fortification_line_sample', { wave, count, minForts: 8 });
}

function repelBoss(wave) {
  Achievements.onEvent('named_boss_repelled', { wave, bossType: 'war_chief' });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'chad' });
Achievements.onEvent('general_fielded', {});
for (let w = 1; w <= 12; w++) sampleForts(9, w);
for (let w = 1; w <= 3; w++) repelBoss(w * 20);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(MetaProgress.isWarhammerUnlocked(), 'chad victory with fortress line unlocks Warhammer');
ok(MetaProgress.isImperiumUnlocked(), 'warhammer unlock grants Imperium');
ok(MetaProgress.isWarpUnlocked(), 'warhammer unlock grants Warp');
ok(Achievements.evaluateRule('run_eternal_crusade:3:8'), 'eternal crusade rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'chad' });
Achievements.onEvent('general_fielded', {});
for (let w = 1; w <= 5; w++) sampleForts(9, w);
sampleForts(6, 6);
for (let w = 1; w <= 3; w++) repelBoss(w * 20);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isWarhammerUnlocked(), 'fort line breach blocks Warhammer unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'chad' });
Achievements.onEvent('general_fielded', {});
for (let w = 1; w <= 12; w++) sampleForts(9, w);
repelBoss(20);
repelBoss(40);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isWarhammerUnlocked(), 'fewer than three boss repels blocks unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'chad' });
Achievements.onEvent('general_fielded', {});
Achievements.onEvent('general_fell', { wave: 30 });
for (let w = 1; w <= 12; w++) sampleForts(9, w);
for (let w = 1; w <= 3; w++) repelBoss(w * 20);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isWarhammerUnlocked(), 'general death blocks Warhammer unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
Achievements.onEvent('general_fielded', {});
for (let w = 1; w <= 12; w++) sampleForts(9, w);
for (let w = 1; w <= 3; w++) repelBoss(w * 20);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isWarhammerUnlocked(), 'normal difficulty blocks Warhammer unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'doomslayer' });
Achievements.onEvent('general_fielded', {});
for (let w = 1; w <= 12; w++) sampleForts(10, w);
for (let w = 1; w <= 3; w++) repelBoss(w * 20);
ok(Achievements.evaluateRule('named_boss_repels:3'), 'three named boss repel milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll warhammer-unlock tests passed');