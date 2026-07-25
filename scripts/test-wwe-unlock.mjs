/**
 * Smoke tests — WWE unlock via showmanship army challenge on victory.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const wwe = readFileSync(join(JS, 'wwe.js'), 'utf8');
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
    `${wwe}\n;globalThis.WweDefs = WweDefs;\nglobalThis.isShowmanshipAbility = isShowmanshipAbility;\n${mp}\n;\n${achData}\n;\n${ach}\n;globalThis.MetaProgress = MetaProgress;\nglobalThis.Achievements = Achievements;\nglobalThis.ACHIEVEMENT_LIST = ACHIEVEMENT_LIST;`,
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

const showAch = ACHIEVEMENT_LIST.find((a) => a.id === 'wwe_showmanship_victory');
ok(
  showAch && showAch.rule === 'run_wwe_showmanship:8:0.55',
  'wwe showmanship victory achievement exists'
);

function sample(heavy, wave) {
  Achievements.onEvent('army_showmanship_sample', {
    wave,
    heavy,
    ratio: heavy ? 0.5 : 0.1,
    showmanshipCount: heavy ? 3 : 0,
    combatCount: 6,
  });
}

function showmanshipProc(n = 1) {
  for (let i = 0; i < n; i++) {
    Achievements.onEvent('crossover_ability', {
      unitType: 'stone_cold',
      faction: 'wwe',
      ability: 'stunner',
    });
  }
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(w <= 7, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(MetaProgress.isWweUnlocked(), 'victory with showmanship majority unlocks WWE');
ok(Achievements.evaluateRule('run_wwe_showmanship:8:0.55'), 'wwe showmanship rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(w <= 3, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isWweUnlocked(), 'low showmanship majority blocks WWE unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(true, w);
Achievements.onEvent('game_end', { victory: false, wave: 80 });
ok(!MetaProgress.isWweUnlocked(), 'defeat with showmanship does not unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 10; w++) sample(true, w);
ok(Achievements.evaluateRule('showmanship_heavy_waves:10'), 'ten showmanship wave milestone');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
showmanshipProc(60);
ok(Achievements.evaluateRule('showmanship_ability_uses:60'), 'sixty showmanship ability uses milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll wwe-unlock tests passed');