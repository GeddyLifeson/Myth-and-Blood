/**
 * Smoke tests — Primis unlock via castle inner-sanctum integrity on victory.
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
    BuildDefs: { castle: { cost: 0 }, castle_keep: { radius: 22 } },
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(
    `${bundle}\nEnemyDefs = GameDataBundle.enemies;\nBuildDefs = { ...BuildDefs, ...GameDataBundle.buildings };\n${units}\n;\n${mp}\n;\n${achData}\n;\n${ach}\n;globalThis.MetaProgress = MetaProgress;\nglobalThis.Achievements = Achievements;\nglobalThis.isInsideCastleInnerSanctum = isInsideCastleInnerSanctum;\nglobalThis.playerHasCastleCompound = playerHasCastleCompound;\nglobalThis.ACHIEVEMENT_LIST = ACHIEVEMENT_LIST;`,
    ctx
  );
  return {
    MetaProgress: ctx.MetaProgress,
    Achievements: ctx.Achievements,
    isInsideCastleInnerSanctum: ctx.isInsideCastleInnerSanctum,
    playerHasCastleCompound: ctx.playerHasCastleCompound,
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

const { MetaProgress, Achievements, isInsideCastleInnerSanctum, playerHasCastleCompound, ACHIEVEMENT_LIST } =
  loadModules();

const keep = {
  owner: 'player',
  castleGroup: 'cg1',
  isKeep: true,
  complete: true,
  hp: 100,
  x: 200,
  y: 200,
  radius: 22,
  type: 'castle_keep',
};
const buildings = [keep];
const innerEnemy = { team: 'enemy', hp: 50, x: 210, y: 200, type: 'goblin' };
const outerEnemy = { team: 'enemy', hp: 50, x: 280, y: 200, type: 'goblin' };

ok(playerHasCastleCompound(buildings), 'detects castle compound');
ok(isInsideCastleInnerSanctum(innerEnemy, buildings, 'cg1'), 'enemy in inner sanctum detected');
ok(!isInsideCastleInnerSanctum(outerEnemy, buildings, 'cg1'), 'enemy outside wall ring ignored');

const sanctumAch = ACHIEVEMENT_LIST.find((a) => a.id === 'primis_sanctum_victory');
ok(sanctumAch && sanctumAch.rule === 'run_sanctum_victory', 'primis sanctum achievement exists');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
Achievements.onEvent('building_complete', { buildType: 'castle', compound: true });
Achievements.onEvent('game_end', { victory: true, hasCastleCompound: true, wave: 80 });
ok(MetaProgress.isPrimusUnlocked(), 'victory with intact sanctum unlocks Primis');
ok(Achievements.evaluateRule('run_sanctum_victory'), 'sanctum victory rule passes');
ok(Achievements.evaluateRule('unlock:primis'), 'primis unlock rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
Achievements.onEvent('building_complete', { buildType: 'castle', compound: true });
Achievements.onEvent('castle_compound_breach', { enemyType: 'goblin', wave: 20 });
Achievements.onEvent('game_end', { victory: true, hasCastleCompound: true, wave: 80 });
ok(!MetaProgress.isPrimusUnlocked(), 'inner keep breach blocks Primis unlock');
ok(!Achievements.evaluateRule('run_sanctum_victory'), 'breach fails sanctum victory rule');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
Achievements.onEvent('building_complete', { buildType: 'castle', compound: true });
for (let w = 1; w <= 50; w++) Achievements.onEvent('wave_complete', { wave: w, units: [] });
ok(Achievements.evaluateRule('sanctum_intact:50'), 'wave 50 with intact sanctum milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll primis-unlock tests passed');