/** Analytics: local stats only. No upload code, no network call, and an older store still loads. */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const src = readFileSync(join(JS, 'analytics.js'), 'utf8');
ok(
  !/sendBeacon|fetch\(|MB_ANALYTICS_ENDPOINT/.test(src),
  'analytics.js has no upload or endpoint code'
);

const storage = new Map();
// A store written by the old version, with the upload fields it carried.
storage.set(
  'myth-and-blood-analytics-v1',
  JSON.stringify({
    cohortId: 'anon-x',
    runs: 3,
    outcomes: { victory: 1, defeat: 1, quit: 1 },
    pendingEvents: [{ type: 'run_end' }],
    lastFlushAt: 5,
  })
);
let beacons = 0;
const sb = {
  Date,
  Object,
  Array,
  Math,
  JSON,
  Number,
  String,
  Infinity,
  Blob: class {},
  localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
  Settings: { get: () => true },
  navigator: { sendBeacon: () => (beacons++, true) },
  fetch: () => (beacons++, Promise.resolve()),
};
sb.window = sb;
sb.globalThis = sb;
const A = vm.runInContext(`${src}; Analytics;`, vm.createContext(sb));
A.init();

const kept = JSON.parse(storage.get('myth-and-blood-analytics-v1'));
ok(kept.runs === 3, 'the old run count survives the load');
ok(
  !('pendingEvents' in kept) && !('cohortId' in kept) && !('lastFlushAt' in kept),
  'upload-only fields are dropped'
);

A.onRunStart({ modeId: 'campaign', difficulty: 'normal', loadout: 'balanced' });
A.onWaveReached(12);
A.onRunEnd({ wave: 12, victory: false });
const ins = A.getInsights();
ok(ins.runs === 4 && ins.outcomes.defeat === 2, 'a finished run adds to the local stats');
ok(ins.dropOff.find((d) => d.id === 'w10-24').count === 1, 'the drop-off bucket is counted');
ok(!('hasEndpoint' in ins) && typeof A.flush === 'undefined', 'no endpoint or flush is exposed');
ok(beacons === 0, 'nothing was sent over the network');

process.exit(failures() ? 1 : 0);
