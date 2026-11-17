/** Chronicles: a run is a readable multi-line record, past runs list first, old stored entries still load. */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const storage = new Map();
// An entry saved before this change: no score field, one-line summary.
storage.set(
  'myth-and-blood-chronicles-v1',
  JSON.stringify([
    {
      id: 'old',
      at: Date.now() - 1000,
      type: 'run',
      wave: 7,
      victory: false,
      title: 'Campaign Chronicle — DEFEAT',
      summary: 'DEFEAT — Normal.',
    },
  ])
);
const sb = {
  Date,
  Object,
  Array,
  Number,
  JSON,
  Math,
  localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
  getDifficultyDef: () => ({ label: 'Normal' }),
  getUnitDisplayName: (u) => u.type,
  SiegeLoop: {
    lastResult: () => ({
      cause: 'A Runner crossed the line on wave 14: breach 11, 10 allowed.',
      score: { total: 2225 },
      fallen: [
        { name: 'Recruit Aldwin', kills: 0, vet: false },
        { name: 'Old Brannoch', kills: 12, vet: true },
      ],
    }),
  },
};
sb.globalThis = sb;
const code = readFileSync(join(JS, 'chronicles.js'), 'utf8');
const Chronicles = vm.runInContext(`${code}; Chronicles;`, vm.createContext(sb));

ok(Chronicles.getAll().length === 1, 'an older stored entry still loads');
Chronicles.appendWaveReport(3, { difficulty: 'normal', armySize: 9, tactical: 20, units: [] });
Chronicles.appendRunReport({
  wave: 14,
  difficulty: 'normal',
  victory: false,
  kills: 212,
  playerDeaths: 9,
});

const list = Chronicles.getEncyclopediaEntries();
ok(
  list[0].chronicleType === 'run' && list[0].name === 'Defeat, wave 14',
  'the newest run lists first'
);
ok(list[1].chronicleType === 'run', 'older runs come before wave reports');
ok(list[list.length - 1].chronicleType === 'wave', 'wave reports come after the runs');
const body = list[0].body.split('\n');
ok(body.length >= 4, `a run reads as separate lines (${body.length})`);
ok(
  body.some((l) => l.includes('Score 2,225') && l.includes('212 kills')),
  'the score and kills line is there'
);
ok(
  body.some((l) => l.includes('crossed the line')),
  'what ended the run is recorded'
);
ok(
  body.some((l) => l.includes('Old Brannoch (12)')) && !list[0].body.includes('Aldwin'),
  'only veterans are listed among the fallen'
);

process.exit(failures() ? 1 : 0);
