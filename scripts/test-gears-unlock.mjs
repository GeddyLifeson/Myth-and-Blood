/**
 * Smoke tests — Gears / COG unlock via siege structure grind.
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

const siegeAch = ACHIEVEMENT_LIST.find((a) => a.id === 'gears_siege_victory');
ok(siegeAch && siegeAch.rule === 'run_siege_victory:12', 'gears siege achievement exists');

function raze(n) {
  for (let i = 0; i < n; i++) {
    Achievements.onEvent('enemy_structure_razed', {
      buildType: 'enemy_hamlet',
      wave: 40 + i,
      runTotal: i + 1,
    });
  }
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
raze(12);
Achievements.onEvent('game_end', { victory: true, wave: 80, enemyStructuresRazed: 12 });
ok(MetaProgress.isGearsUnlocked(), 'victory with 12 razed structures unlocks Gears');
ok(Achievements.evaluateRule('run_siege_victory:12'), 'siege victory rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
raze(12);
Achievements.onEvent('game_end', { victory: false, wave: 80, enemyStructuresRazed: 12 });
ok(!MetaProgress.isGearsUnlocked(), 'defeat with enough razes does not unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
raze(8);
Achievements.onEvent('game_end', { victory: true, wave: 80, enemyStructuresRazed: 8 });
ok(!MetaProgress.isGearsUnlocked(), 'victory with too few razes blocks unlock');
ok(Achievements.evaluateRule('enemy_structures_razed:6'), 'six raze milestone passes');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll gears-unlock tests passed');