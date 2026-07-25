/**
 * Smoke tests for aggressive FX and chronicle memory pruning.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadModule(file, exportsKey, extra = {}) {
  const code = readFileSync(join(JS, file), 'utf8');
  const sb = { Math, Object, Array, Set, Map, Date, JSON, localStorage: null, ...extra };
  sb.window = sb;
  sb.globalThis = sb;
  return vm.runInContext(`${code}\n({ ${exportsKey} })`, vm.createContext(sb))[exportsKey];
}

const SpriteLod = loadModule('sprite-lod.js', 'SpriteLod');
const FloatingText = loadModule('floatingText.js', 'FloatingText', { SpriteLod });
const Particles = loadModule('particles.js', 'Particles', { SpriteLod });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

FloatingText.setBudget(90, 0.4, 2);
for (let i = 0; i < 200; i++) FloatingText.damage(i, i, i);
FloatingText.update();
ok(FloatingText.getCount() <= 20, 'floating text setBudget caps population');
FloatingText.prune(true);
ok(FloatingText.getCount() <= 20, 'floating text aggressive prune runs');

Particles.setBudget(90, 0.4, 2);
for (let i = 0; i < 120; i++) Particles.dust(i * 3, i * 2);
Particles.update();
ok(Particles.getCount() <= 40, 'particles setBudget caps population');
Particles.prune(true);
ok(Particles.getCount() <= 40, 'particles aggressive prune runs');

const storage = new Map();
const Chronicles = loadModule('chronicles.js', 'Chronicles', {
  localStorage: {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
  },
  getDifficultyDef: () => ({ label: 'Normal' }),
  getPlayerUnitDef: (type) => ({ name: type }),
  getUnitDisplayName: (u) => u.type,
});

for (let i = 0; i < 40; i++) {
  if (i % 5 === 0) {
    Chronicles.appendRunReport({
      wave: i,
      difficulty: 'normal',
      victory: i % 10 === 0,
      kills: i,
      highlights: [{ wave: i, text: 'x'.repeat(200) }],
    });
  } else {
    Chronicles.appendWaveReport(i, {
      difficulty: 'normal',
      armySize: 12,
      tactical: 40,
      playerDeaths: 1,
      units: [{ type: 'footman' }],
      highlights: [{ wave: i, text: 'y'.repeat(200) }],
    });
  }
}
const saved = JSON.parse(storage.get('myth-and-blood-chronicles-v1') || '[]');
ok(saved.length <= 24, 'chronicles cap total entries');
ok(saved.every((e) => (e.summary?.length || 0) <= 720), 'chronicles trim long summaries');
ok(saved.filter((e) => e.type === 'run').length <= 8, 'chronicles cap run entries');

storage.set(
  'myth-and-blood-chronicles-v1',
  JSON.stringify([
    {
      id: 'stale-1',
      at: Date.now() - 120 * 24 * 60 * 60 * 1000,
      type: 'wave',
      wave: 99,
      title: 'Stale',
      summary: 'old',
    },
    ...saved,
  ])
);
Chronicles.load();
const afterStale = Chronicles.getAll();
ok(!afterStale.some((e) => e.title === 'Stale'), 'chronicles drop entries older than max age');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll memory-prune smoke tests passed');