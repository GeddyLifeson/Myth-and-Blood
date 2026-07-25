/**
 * Smoke tests — Ultimis / Element 115 unlock via Doomslayer horde-fortress challenge.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const bundle = readFileSync(join(JS, 'game-data-bundle.js'), 'utf8');
  const units = readFileSync(join(JS, 'units.js'), 'utf8');
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
    BuildDefs: { castle: { cost: 0 } },
    MetaProgress: null,
    Achievements: null,
    ACHIEVEMENT_LIST: null,
    ACHIEVEMENT_TARGET: null,
    ACHIEVEMENT_META_316_ID: null,
    ACHIEVEMENT_CLUB_316_ID: null,
    ACHIEVEMENT_MILLENNIUM_ID: null,
    CROSSOVER_ACH_FACTIONS: null,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(
    `${bundle}\nEnemyDefs = GameDataBundle.enemies;\n${units}\n;\n${mp}\n;\n${achData}\n;\n${ach}\n;globalThis.MetaProgress = MetaProgress;\nglobalThis.Achievements = Achievements;\nglobalThis.isZombieTypeEnemy = isZombieTypeEnemy;\nglobalThis.ACHIEVEMENT_LIST = ACHIEVEMENT_LIST;`,
    ctx
  );
  return {
    MetaProgress: ctx.MetaProgress,
    Achievements: ctx.Achievements,
    isZombieTypeEnemy: ctx.isZombieTypeEnemy,
    ACHIEVEMENT_LIST: ctx.ACHIEVEMENT_LIST,
  };
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { MetaProgress, Achievements, isZombieTypeEnemy, ACHIEVEMENT_LIST } = loadModules();

MetaProgress.reset();

ok(isZombieTypeEnemy('goblin'), 'goblin is zombie-type horde');
ok(isZombieTypeEnemy('orc'), 'orc is zombie-type horde');
ok(!isZombieTypeEnemy('dark_knight'), 'evil operative is not zombie-type horde');
ok(!isZombieTypeEnemy('troll'), 'troll brute is not zombie-type horde');

const hordeAch = ACHIEVEMENT_LIST.find((a) => a.id === 'ultimis_horde_150');
ok(hordeAch && hordeAch.rule === 'diff_zombie_fortress:doomslayer:150', 'ultimis horde achievement exists');

Achievements.onEvent('game_start', { difficulty: 'doomslayer' });
for (let w = 1; w <= 150; w++) {
  Achievements.onEvent('wave_complete', { wave: w, difficulty: 'doomslayer', units: [] });
}
ok(MetaProgress.is115Unlocked(), 'wave 150 doomslayer unlocks Element 115');
ok(Achievements.evaluateRule('diff_zombie_fortress:doomslayer:150'), 'horde fortress rule passes');
ok(Achievements.evaluateRule('unlock:ultimis'), 'ultimis unlock rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'doomslayer' });
Achievements.onEvent('zombie_building_lost', { buildType: 'wall', attackerType: 'goblin', wave: 12 });
for (let w = 1; w <= 150; w++) {
  Achievements.onEvent('wave_complete', { wave: w, difficulty: 'doomslayer', units: [] });
}
ok(!MetaProgress.is115Unlocked(), 'horde building loss blocks Element 115 unlock');
ok(!Achievements.evaluateRule('diff_zombie_fortress:doomslayer:150'), 'horde loss fails fortress rule');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'doomslayer' });
for (let w = 1; w <= 149; w++) {
  Achievements.onEvent('wave_complete', { wave: w, difficulty: 'doomslayer', units: [] });
}
ok(!MetaProgress.is115Unlocked(), 'wave 149 does not unlock Element 115 yet');
Achievements.onEvent('wave_complete', { wave: 150, difficulty: 'doomslayer', units: [] });
ok(MetaProgress.is115Unlocked(), 'wave 150 triggers Element 115 unlock');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll ultimis-unlock tests passed');