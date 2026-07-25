/**
 * Smoke tests for progressive tutorial step resolution.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function boot(step = 0) {
  const sb = {
    Math,
    Object,
    Array,
    localStorage: {
      _data: {
        'myth-and-blood-tutorial-progress': JSON.stringify({ step, dismissed: false }),
      },
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = String(v);
      },
    },
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    Game: { isPlaying: () => true },
    Settings: { get: (k) => (k === 'tutorialEnabled' ? true : null) },
    UI: { updateHUD: () => {} },
    AudioEngine: { SFX: { click: () => {} } },
  };
  sb.window = sb;
  sb.globalThis = sb;
  const code = readFileSync(join(JS, 'ux.js'), 'utf8');
  const UX = vm.runInContext(`${code}; UX;`, vm.createContext(sb));
  UX.init();
  return UX;
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const earlyUx = boot(0);
ok(
  earlyUx.resolveTutorialStep({ wave: 1, creativeMode: false })?.step?.title === 'Welcome, Commander',
  'wave 1 shows welcome step'
);

const midUx = boot(0);
ok(
  midUx.resolveTutorialStep({ wave: 15, creativeMode: false })?.step?.title === 'Veteran Stars',
  'wave 15 reaches veteran step when fresh'
);

const lateUx = boot(13);
ok(
  lateUx.resolveTutorialStep({ wave: 30, creativeMode: false, crossoverUnlocked: true })?.step
    ?.title === 'Crossover Operatives',
  'crossover step when hub unlocked'
);

const wweUx = boot(12);
ok(
  wweUx.resolveTutorialStep({ wave: 30, creativeMode: false, wweUnlocked: true })?.step?.title ===
    'Grand Coliseum',
  'WWE step when academy unlocked'
);

const pwUx = boot(23);
ok(
  pwUx.resolveTutorialStep({ wave: 210, creativeMode: false, planetWarfare: { active: true } })
    ?.step?.title === 'Hostile Map Control',
  'planet warfare step at wave 200+'
);

ok(earlyUx.TUTORIAL_STEPS.length >= 24, 'tutorial catalog expanded');

process.exit(failed ? 1 : 0);