/**
 * Smoke tests for campaign onboarding and campaign seeds.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function bootLegacyRuns(runs = 0) {
  const huCode = readFileSync(join(JS, 'html-util.js'), 'utf8');
  const gmCode = readFileSync(join(JS, 'game-modes.js'), 'utf8');
  const obCode = readFileSync(join(JS, 'onboarding.js'), 'utf8');
  const sb = {
    console,
    Math,
    Object,
    Array,
    String,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    document: {
      getElementById: (id) => (id === 'onboarding-panel' ? { hidden: true, innerHTML: '' } : null),
    },
    Legacy: { get: () => ({ totalRuns: runs }) },
    UI: { setSelectedDifficulty: () => {} },
    AudioEngine: { SFX: { click: () => {} } },
    getDifficultyDef: (id) => ({ label: id, tagline: '' }),
    AdvancedDifficulty: {
      getDifficultyPercent: () => 100,
      getActiveIds: () => [],
      setActive: () => {},
      lockForRun: () => {},
    },
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(huCode, ctx);
  const GameModes = vm.runInContext(`${gmCode}\nGameModes;`, ctx);
  const Onboarding = vm.runInContext(`${obCode}\nOnboarding;`, ctx);
  return { GameModes, Onboarding };
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { GameModes, Onboarding } = bootLegacyRuns(0);
ok(Onboarding.RECOMMENDED_STARTS.length >= 3, 'recommended starts defined');
ok(typeof Onboarding.prepareCampaignStart === 'function', 'prepareCampaignStart exported');

GameModes.init();
Onboarding.selectStart('fortify');
const menu = GameModes.getMenu();
ok(menu.modeId === 'campaign' && menu.seed === 'onboard-walls-v1', 'selectStart applies campaign seed');

const begun = GameModes.beginSession('normal');
ok(begun.session?.seed === 'onboard-walls-v1', 'campaign session uses recommended seed');

Onboarding.prepareCampaignStart();
ok(Onboarding.isGuidedRunActive(), 'guided run active when enabled');

Onboarding.dismissPanel();
ok(!Onboarding.shouldShowPanel(), 'panel hidden after dismiss');

process.exit(failed ? 1 : 0);