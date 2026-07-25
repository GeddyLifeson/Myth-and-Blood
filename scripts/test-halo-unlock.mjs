/**
 * Smoke tests — Halo / UNSC unlock via Spartan command challenge.
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

const haloAch = ACHIEVEMENT_LIST.find((a) => a.id === 'halo_spartan_victory');
ok(haloAch && haloAch.rule === 'run_spartan_command:5', 'halo spartan achievement exists');

function elevateFootman(id) {
  Achievements.onEvent('footman_command_elevated', { unitKey: id });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let i = 1; i <= 4; i++) elevateFootman(`fm-${i}`);
Achievements.onEvent('footman_promoted_general', { unitKey: 'fm-5' });
Achievements.onEvent('general_fielded', { wave: 40 });
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(MetaProgress.isHaloUnlocked(), 'victory with general alive and 5 command elevations unlocks Halo');
ok(Achievements.evaluateRule('run_spartan_command:5'), 'spartan command rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let i = 1; i <= 5; i++) elevateFootman(`fm-${i}`);
Achievements.onEvent('footman_promoted_general', { unitKey: 'fm-5' });
Achievements.onEvent('general_fielded', { wave: 40 });
Achievements.onEvent('general_fell', { wave: 55 });
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isHaloUnlocked(), 'general death blocks Halo unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let i = 1; i <= 3; i++) elevateFootman(`fm-${i}`);
Achievements.onEvent('footman_promoted_general', { unitKey: 'fm-4' });
Achievements.onEvent('general_fielded', { wave: 40 });
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isHaloUnlocked(), 'fewer than 5 command elevations blocks unlock');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll halo-unlock tests passed');