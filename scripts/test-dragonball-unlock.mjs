/**
 * Smoke tests — Dragon Ball unlock via planetary boss ki stand challenge.
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

const planetAch = ACHIEVEMENT_LIST.find((a) => a.id === 'dragonball_planet_victory');
ok(
  planetAch && planetAch.rule === 'run_dragonball_ki:200:0.55',
  'dragonball planet victory achievement exists'
);

function kiStand(wave = 520, ratio = 0.8) {
  Achievements.onEvent('planet_boss_ki_stand', {
    wave,
    high: true,
    ratio,
    kiCount: 4,
    combatCount: 5,
    bossType: 'boss_malachar',
  });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
kiStand();
Achievements.onEvent('wave_complete', { wave: 520, playerDeaths: 0, units: [] });
Achievements.onEvent('game_end', { victory: true, wave: 520 });
ok(MetaProgress.isDragonballUnlocked(), 'victory with planet boss ki stand unlocks Dragon Ball');
ok(Achievements.evaluateRule('run_dragonball_ki:200:0.55'), 'dragonball ki rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
kiStand(150, 0.8);
Achievements.onEvent('wave_complete', { wave: 150, playerDeaths: 0, units: [] });
Achievements.onEvent('game_end', { victory: true, wave: 150 });
ok(!MetaProgress.isDragonballUnlocked(), 'planet boss ki stand before wave 200 blocks unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
kiStand();
Achievements.onEvent('wave_complete', { wave: 520, playerDeaths: 0, units: [] });
Achievements.onEvent('game_end', { victory: false, wave: 520 });
ok(!MetaProgress.isDragonballUnlocked(), 'defeat with ki stand does not unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
Achievements.onEvent('wave_complete', { wave: 520, playerDeaths: 0, units: [] });
Achievements.onEvent('game_end', { victory: true, wave: 520 });
ok(!MetaProgress.isDragonballUnlocked(), 'victory without planet boss ki stand blocks unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
kiStand();
ok(Achievements.evaluateRule('planet_boss_high_ki'), 'planet boss high ki milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll dragonball-unlock tests passed');