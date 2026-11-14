#!/usr/bin/env node
/**
 * Saves made by older builds (scripts/fixtures/saves, format 1 and 2) must keep loading
 * through the migration chain, and must play on afterwards.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { bootGame, playUntil } from './lib/save-test-kit.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'saves');
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK' : 'FAIL'}: ${msg}`);
  if (!cond) failed++;
};

const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
ok(
  files.some((f) => f.startsWith('v1-')) && files.some((f) => f.startsWith('v2-')),
  'v1 and v2 fixtures exist'
);

const g = bootGame(5);
for (const f of files) {
  const { snap } = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  const prep = g.SaveFormat.prepare(snap);
  ok(prep.ok && prep.snap.version === g.SaveFormat.VERSION, `${f}: migrates from v${snap.version}`);
  ok(
    g.Game.importGameState(snap) === true,
    `${f}: loads (${g.Game.getLastLoadReport?.()?.error || 'ok'})`
  );
  const s = g.Game.getState();
  const players = snap.units.filter((u) => (u.team || 'player') === 'player' && u.hp > 0).length;
  const back = g.GS.units.filter((u) => u.team === 'player' && u.hp > 0).length;
  ok(s.wave === snap.wave && s.timeOfDay === snap.timeOfDay, `${f}: wave ${s.wave} ${s.timeOfDay}`);
  ok(back === players, `${f}: every soldier is back (${back}/${players})`);
  ok(g.GS.decorations.length > 0, `${f}: terrain present after load`);
  let t = 0;
  playUntil(g, () => ++t > 600);
  ok(t > 600 || !g.Game.isPlaying(), `${f}: plays on after load`);
}

const { snap } = JSON.parse(readFileSync(join(DIR, files[0]), 'utf8'));
ok(!g.SaveFormat.prepare({ ...snap, version: 99 }).ok, 'a save from a newer version is refused');
const own = g.Game.exportGameState();
ok(
  !g.SaveFormat.prepare({ ...own, wave: own.wave + 5 }).ok,
  'an altered current save fails its checksum'
);
ok(
  !g.SaveFormat.prepare({ ...own, checksum: undefined }).ok,
  'a current save without checksum is refused'
);

if (failed) {
  console.error(`\n${failed} save fixture check(s) failed.`);
  process.exit(1);
}
console.log('\nAll save fixture tests passed.');
