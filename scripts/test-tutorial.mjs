/**
 * Smoke tests for progressive tutorial step resolution.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

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

const earlyUx = boot(0);
ok(
  earlyUx.resolveTutorialStep({ wave: 1, creativeMode: false })?.step?.title ===
    'Welcome, Commander',
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
    ?.title === 'Legion Operatives',
  'crossover step when hub unlocked'
);

const wweUx = boot(12);
ok(
  wweUx.resolveTutorialStep({ wave: 30, creativeMode: false, wweUnlocked: true })?.step?.title ===
    'Grand Coliseum',
  'WWE step when academy unlocked'
);

ok(earlyUx.TUTORIAL_STEPS.length >= 24, 'tutorial catalog expanded');

process.exit(failures() ? 1 : 0);
