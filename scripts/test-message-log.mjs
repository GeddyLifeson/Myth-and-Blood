/** Message log: repeats fold into one counted row, and the filter picks what is shown. */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const els = {};
const el = (id) =>
  (els[id] ||= {
    id,
    innerHTML: '',
    textContent: '',
    classList: { toggle() {}, add() {}, remove() {} },
  });
const sb = {
  Math,
  Object,
  Array,
  Date,
  localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: el, querySelectorAll: () => [] },
  Game: { isPlaying: () => true, getState: () => ({ wave: 4 }) },
  Settings: { get: () => null },
  UI: { updateHUD() {} },
  AudioEngine: { SFX: { click() {} } },
};
sb.window = sb;
sb.globalThis = sb;
const code = readFileSync(join(JS, 'ux.js'), 'utf8');
const UX = vm.runInContext(`${code}; UX;`, vm.createContext(sb));

for (let i = 0; i < 9; i++) UX.onMessage('Crate recovered: +20 gold.');
UX.onMessage('BREACH! The realm can bear 4 more.');
UX.onMessage('Old Brannoch has fallen — 12 kills across 6 waves.');
UX.onMessage('Wave 5 begins from the north.');
UX.onMessage('Quick save stored.', 'system');

const log = UX.getMessageLog();
ok(log.length === 5, `nine identical lines fold into one row (rows: ${log.length})`);
ok(log.find((m) => m.text.startsWith('Crate')).count === 9, 'the folded row counts its repeats');
ok(el('message-log-list').innerHTML.includes('×9'), 'the count shows in the list');

UX.setLogFilter('alert');
const alerts = el('message-log-list').innerHTML;
ok(
  alerts.includes('BREACH') && alerts.includes('Brannoch'),
  'the Alerts filter shows breaches and the fallen'
);
ok(!alerts.includes('Crate') && !alerts.includes('Quick save'), 'the Alerts filter hides the rest');
UX.setLogFilter('system');
ok(el('message-log-list').innerHTML.includes('Quick save'), 'the System filter shows saves');
UX.setLogFilter('all');
ok(el('message-log-list').innerHTML.includes('Wave 5'), 'All shows everything');

process.exit(failures() ? 1 : 0);
