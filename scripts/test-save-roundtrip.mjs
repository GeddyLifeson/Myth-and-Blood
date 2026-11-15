#!/usr/bin/env node
/**
 * Save round trip: play to a point, export, import into a fresh game, and compare every piece
 * of run state (GS, units, buildings, terrain, projectiles, module sections, mode session).
 * Then play both copies on for a while: the loaded run must keep going.
 */
import { bootGame, playUntil, normalise, diff } from './lib/save-test-kit.mjs';

let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK' : 'FAIL'}: ${msg}`);
  if (!cond) failed++;
};

function roundTrip(label, stop) {
  const t0 = Date.now();
  const a = bootGame(11);
  a.Game.setDifficulty('baby');
  a.Game.start();
  ok(playUntil(a, stop), `${label}: the bot reached the save point`);
  const snap = JSON.parse(JSON.stringify(a.Game.exportGameState()));
  ok(snap.version === a.SaveFormat.VERSION, `${label}: save carries version ${snap.version}`);
  ok(a.SaveFormat.prepare(snap).ok, `${label}: own save passes checksum and validation`);
  ok(snap.terrain?.decorations?.length > 0, `${label}: terrain is in the save`);

  const b = bootGame(99);
  ok(b.Game.importGameState(snap) === true, `${label}: fresh game accepts the save`);
  const before = normalise(a);
  const after = normalise(b);
  const d = diff(before, after);
  ok(
    d.length === 0,
    `${label}: run state matches after load${d.length ? `\n  ${d.join('\n  ')}` : ''}`
  );
  ok(
    JSON.stringify(before.decorations) === JSON.stringify(after.decorations),
    `${label}: terrain matches (${after.decorations.length} pieces)`
  );
  ok(
    JSON.stringify(a.GS.nextWavePlan ?? null) === JSON.stringify(b.GS.nextWavePlan ?? null),
    `${label}: next wave plan matches`
  );

  const wave = b.Game.getState().wave;
  let ticks = 0;
  playUntil(b, () => ++ticks > 3000);
  ok(b.Game.isPlaying() || b.Game.getState().wave >= wave, `${label}: loaded run plays on`);
  console.log(`  (${label}: ${Date.now() - t0} ms)`);
}

roundTrip('wave 2 day, mid-fight', (s, t) => s.wave >= 2 && s.timeOfDay === 'day' && t > 240);
// The bot ends each night within about 20 ticks, so stop early in it.
roundTrip('wave 6 night', (s, t) => s.wave >= 6 && s.timeOfDay === 'night' && t > 2);

if (failed) {
  console.error(`\n${failed} save round-trip check(s) failed.`);
  process.exit(1);
}
console.log('\nAll save round-trip tests passed.');
