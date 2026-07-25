/**
 * Smoke tests — JoJo unlock via crossover hero stand alliance challenge.
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
    getCrossoverDef: (id) => {
      if (id === 'master_chief') return { faction: 'halo' };
      if (id === 'marcus_fenix') return { faction: 'gears' };
      if (id === 'baki_hanma') return { faction: 'baki' };
      return { faction: 'crossover' };
    },
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

const standAch = ACHIEVEMENT_LIST.find((a) => a.id === 'jojo_stand_victory');
ok(
  standAch && standAch.rule === 'run_stand_alliance:8:0.55:3',
  'jojo stand victory achievement exists'
);

function recruit(...ids) {
  for (const id of ids) Achievements.onEvent('crossover_recruit', { crossoverId: id });
}

function sample(allied, wave, multiFaction = false) {
  Achievements.onEvent('stand_alliance_sample', {
    wave,
    allied,
    heroCount: allied ? 3 : 1,
    factionCount: multiFaction ? 2 : 1,
    multiFaction,
  });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
recruit('master_chief', 'marcus_fenix', 'baki_hanma');
for (let w = 1; w <= 10; w++) sample(w <= 7, w, w % 2 === 0);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(MetaProgress.isJojoUnlocked(), 'victory with stand alliance unlocks JoJo');
ok(Achievements.evaluateRule('run_stand_alliance:8:0.55:3'), 'stand alliance rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
recruit('master_chief', 'marcus_fenix', 'baki_hanma');
for (let w = 1; w <= 10; w++) sample(w <= 3, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isJojoUnlocked(), 'low alliance wave majority blocks JoJo unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
recruit('master_chief', 'marcus_fenix');
for (let w = 1; w <= 10; w++) sample(true, w);
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isJojoUnlocked(), 'fewer than three recruits blocks JoJo unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
recruit('master_chief', 'marcus_fenix', 'baki_hanma');
for (let w = 1; w <= 10; w++) sample(true, w);
Achievements.onEvent('game_end', { victory: false, wave: 80 });
ok(!MetaProgress.isJojoUnlocked(), 'defeat with good alliance does not unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
recruit('master_chief', 'marcus_fenix', 'baki_hanma');
for (let w = 1; w <= 10; w++) sample(true, w, w <= 5);
ok(Achievements.evaluateRule('stand_alliance_waves:10'), 'ten stand alliance wave milestone');
ok(Achievements.evaluateRule('stand_multi_faction_waves:5'), 'five multi-faction pose milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll jojo-unlock tests passed');