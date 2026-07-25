/**
 * Smoke tests — Elder Scrolls / Dragonborn Legacy unlock.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModules() {
  const mp = readFileSync(join(JS, 'meta-progress.js'), 'utf8');
  const epf = readFileSync(join(JS, 'eternal-path-framework.js'), 'utf8');
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
    MAX_VETERAN_TIER: 6,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    Game: { isPlaying: () => false },
    WweDefs: {},
    CrossoverDefs: {},
    isCrossoverUnit: () => false,
    isWweUnit: () => false,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(
    `${mp}\n;\n${epf}\n;\n${achData}\n;\n${ach}\n;globalThis.MetaProgress = MetaProgress;\nglobalThis.EternalPathFramework = EternalPathFramework;\nglobalThis.Achievements = Achievements;\nglobalThis.ACHIEVEMENT_LIST = ACHIEVEMENT_LIST;`,
    ctx
  );
  return {
    MetaProgress: ctx.MetaProgress,
    EternalPathFramework: ctx.EternalPathFramework,
    Achievements: ctx.Achievements,
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

const { MetaProgress, EternalPathFramework, Achievements, ACHIEVEMENT_LIST } = loadModules();

const legacyAch = ACHIEVEMENT_LIST.find((a) => a.id === 'tes_dragonborn_victory');
ok(
  legacyAch && legacyAch.rule === 'run_dragonborn_legacy:100',
  'dragonborn legacy victory achievement exists'
);

ok(EternalPathFramework.getPathForUnit('footman') === 'martial', 'footman maps to martial path');
ok(EternalPathFramework.getPathForUnit('mage') === 'arcane', 'mage maps to arcane path');
ok(EternalPathFramework.getPathForUnit('sapper') === 'tech', 'sapper maps to tech path');

function immortal(pathId, unitType) {
  Achievements.onEvent('path_immortal_reached', { pathId, unitType, vetTier: 6, wave: 50 });
}

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 110; w++) Achievements.onEvent('wave_complete', { wave: w });
immortal('martial', 'footman');
immortal('arcane', 'mage');
immortal('tech', 'sapper');
immortal('mythic', 'dragonborn');
Achievements.onEvent('dragon_boss_slay', { wave: 80, bossType: 'war_chief', viaHero: true });
Achievements.onEvent('game_end', { victory: true, wave: 110 });
ok(MetaProgress.isTesUnlocked(), 'victory with four path immortals unlocks TES');
ok(Achievements.evaluateRule('run_dragonborn_legacy:100'), 'dragonborn legacy rule passes');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 110; w++) Achievements.onEvent('wave_complete', { wave: w });
immortal('martial', 'footman');
immortal('arcane', 'mage');
immortal('tech', 'sapper');
Achievements.onEvent('dragon_boss_slay', { wave: 80, bossType: 'war_chief', viaStrike: true });
Achievements.onEvent('game_end', { victory: true, wave: 110 });
ok(!MetaProgress.isTesUnlocked(), 'missing mythic immortal blocks TES unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 90; w++) Achievements.onEvent('wave_complete', { wave: w });
immortal('martial', 'footman');
immortal('arcane', 'mage');
immortal('tech', 'sapper');
immortal('mythic', 'dragonborn');
Achievements.onEvent('dragon_boss_slay', { wave: 80, bossType: 'war_chief', viaHero: true });
Achievements.onEvent('game_end', { victory: true, wave: 90 });
ok(!MetaProgress.isTesUnlocked(), 'wave below 100 blocks TES unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 110; w++) Achievements.onEvent('wave_complete', { wave: w });
immortal('martial', 'footman');
immortal('arcane', 'mage');
immortal('tech', 'sapper');
immortal('mythic', 'dragonborn');
Achievements.onEvent('game_end', { victory: true, wave: 110 });
ok(!MetaProgress.isTesUnlocked(), 'missing dragon boss slay blocks unlock');

MetaProgress.reset();
Achievements.resetSession();
Achievements.onEvent('game_start', { difficulty: 'normal' });
for (let w = 1; w <= 110; w++) Achievements.onEvent('wave_complete', { wave: w });
immortal('martial', 'footman');
immortal('arcane', 'mage');
immortal('tech', 'sapper');
immortal('mythic', 'dragonborn');
Achievements.onEvent('dragon_boss_slay', { wave: 80, bossType: 'war_chief', viaStrike: true });
ok(Achievements.evaluateRule('dragon_boss_slay'), 'dragon boss slay milestone');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tes-unlock tests passed');