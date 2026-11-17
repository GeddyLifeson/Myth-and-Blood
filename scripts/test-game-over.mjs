/** Game over: the cause of the loss, every dead soldier by name, and no dialog calls outside js/dialog.js. */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb, cvs } = boot(7);
const api = vm.runInContext(`${code}\n({ Game, SpriteGen, SiegeLoop })`, vm.createContext(sb));
api.SpriteGen.prewarmCache = () => {};
api.Game.init(cvs);
api.Game.setDifficulty('normal');
api.Game.start();
const { SiegeLoop } = api;

const msgs = [];
const ctx = {
  wave: 9,
  missLimit: 10,
  outcome: 'defeat',
  unitName: (u) => u.label || 'Footman',
  ach() {},
  playSfx() {},
  showMessage: (m) => msgs.push(m),
};
const soldier = (label, kills, waves) => ({
  team: 'player',
  x: 1,
  y: 1,
  label,
  kills,
  wavesSurvived: waves,
  hp: 0,
});
SiegeLoop.onUnitDeath(soldier('Recruit Aldwin', 0, 1), null, ctx);
SiegeLoop.onUnitDeath(soldier('Old Brannoch', 12, 6), null, ctx);

const doc = sb.document;
SiegeLoop.endRun(ctx);
const dead = doc.getElementById('result-fallen').innerHTML;
ok(dead.includes('Recruit Aldwin'), 'a rank-and-file soldier is named on the game-over screen');
ok(dead.includes('Old Brannoch') && dead.includes('12 kills'), 'a veteran is named with his kills');
ok(msgs.length === 1, 'only the veteran gets a death message in play');
ok(
  doc.getElementById('result-siege').innerHTML.includes('Every soldier and training hall was lost'),
  'a loss with no breach names the wipe-out as the cause'
);

const after = SiegeLoop.exportState();
ok(Array.isArray(after.fallen) && after.fallen.length === 2, 'the dead are saved with the run');
ok(
  after.fallen.every((f) => 'name' in f && 'wave' in f && 'kills' in f),
  'a saved dead entry keeps the old fields (name, wave, kills)'
);

// A save from before this change holds veterans only, with no `vet` flag; it still loads and shows.
SiegeLoop.importState(
  { ...after, fallen: [{ name: 'Old Save Vet', kills: 9, waves: 3, wave: 4 }] },
  { ...ctx, cheatsUsed: false }
);
SiegeLoop.endRun({ ...ctx, outcome: 'victory' });
const old = doc.getElementById('result-fallen').innerHTML;
ok(
  old.includes('Old Save Vet') && old.includes('9 kills'),
  'an older save fixture still shows its veteran'
);
ok(
  !doc.getElementById('result-siege').innerHTML.includes('result-cause'),
  'a win has no cause line'
);

// No alert, confirm or prompt outside the in-page dialog module.
const bad = [];
for (const f of readdirSync(JS).filter((n) => n.endsWith('.js') && n !== 'dialog.js')) {
  const src = readFileSync(join(JS, f), 'utf8');
  if (
    /(^|[^.\w])(alert|confirm|prompt)\(|window\.(alert|confirm|prompt)\(/m.test(
      src.replace(/\/\/.*$/gm, '')
    )
  )
    bad.push(f);
}
ok(bad.length === 0, `no native dialogs outside js/dialog.js ${bad.join(',')}`);

process.exit(failures() ? 1 : 0);
