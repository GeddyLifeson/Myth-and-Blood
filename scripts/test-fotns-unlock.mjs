/**
 * Smoke tests — FOTNS unlock via solo hero named boss kill on victory.
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

const hokutoAch = ACHIEVEMENT_LIST.find((a) => a.id === 'fotns_hokuto_victory');
ok(hokutoAch && hokutoAch.rule === 'run_hokuto_solo', 'fotns hokuto victory achievement exists');

function soloKill(bossType = 'boss_gorath') {
  Achievements.onEvent('solo_hero_boss_kill', {
    solo: true,
    heroType: 'master_chief',
    bossType,
    bossName: 'Gorath the Breaker',
    wave: 50,
  });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
soloKill();
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(MetaProgress.isFotnsUnlocked(), 'victory with solo hero boss kill unlocks FOTNS');
ok(Achievements.evaluateRule('run_hokuto_solo'), 'hokuto solo victory rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
soloKill();
Achievements.onEvent('game_end', { victory: false, wave: 80 });
ok(!MetaProgress.isFotnsUnlocked(), 'defeat with solo kill does not unlock FOTNS');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
Achievements.onEvent('game_end', { victory: true, wave: 80 });
ok(!MetaProgress.isFotnsUnlocked(), 'victory without solo boss kill blocks FOTNS unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
soloKill();
ok(Achievements.evaluateRule('solo_hero_named_boss'), 'solo hero named boss milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll fotns-unlock tests passed');