#!/usr/bin/env node
/**
 * Co-op by share code: two players, each with their own browser storage, pass one game
 * back and forth. Reproduces the audit's bug ("Not your turn to hand off" for the second
 * player) and checks the code format: full versioned save, newer versions refused politely.
 */
import { ok, failures } from './lib/harness.mjs';
import { bootGame, playUntil, normalise, diff } from './lib/save-test-kit.mjs';

function player(seed, name) {
  const g = bootGame(seed);
  g.OnlineMultiplayer.load();
  g.OnlineMultiplayer.setPlayerName(name);
  return g;
}

const A = player(31, 'Aldric');
const B = player(32, 'Branwen');
const OA = A.OnlineMultiplayer;
const OB = B.OnlineMultiplayer;

// --- A starts a shared game and plays the first wave -------------------------------------
A.GameModes.setMenuMode('async_coop');
A.Game.setDifficulty('baby');
A.Game.start();
ok(!!OA.getActiveRoom(), 'starting a co-op run opens a room for player A');
ok(OA.isMyCoopTurn(), 'it is A’s turn in the room A made');
ok(
  playUntil(A, (s) => s.wave === 1 && s.timeOfDay === 'night'),
  'A plays to the first night'
);
const beforeA = JSON.parse(JSON.stringify(normalise(A)));

const h1 = OA.handoffKingdom(A.Game.exportGameState());
ok(
  h1.ok && typeof h1.code === 'string' && h1.code.startsWith('KINGDOM:'),
  'A hands off with a code'
);
ok(!OA.isMyCoopTurn(), 'after handing off it is no longer A’s turn');
const again = OA.handoffKingdom(A.Game.exportGameState());
ok(!again.ok && /turn/i.test(again.error || ''), `A cannot hand off twice (${again.error})`);

// --- B takes the code, loads the same game, plays, and hands back ------------------------
const i1 = OB.importShareCode(h1.code);
ok(i1.ok && i1.type === 'kingdom', `B imports A’s code (${i1.error || 'ok'})`);
ok(OB.isMyCoopTurn(), 'it is B’s turn after importing the hand-off');
B.Game.start();
ok(B.GS.wave === 1 && B.GS.timeOfDay === 'night', 'B’s game opens on the handed-off night');
const d1 = diff(beforeA, JSON.parse(JSON.stringify(normalise(B))));
ok(d1.length === 0, `B has exactly A’s game (${d1.slice(0, 6).join(' | ') || 'no differences'})`);
if (B.GS.paused) B.Game.togglePause?.();
B.GS.paused = false;
ok(
  playUntil(B, (s) => s.wave === 2 && s.timeOfDay === 'night'),
  'B plays wave 2'
);
const beforeB = JSON.parse(JSON.stringify(normalise(B)));

const h2 = OB.handoffKingdom(B.Game.exportGameState());
ok(h2.ok, `the second player can hand off (${h2.error || 'ok'})`);
ok(h2.ok && h2.nextCommander === 'Aldric', `B’s hand-off names A as next (${h2.nextCommander})`);
ok(!OB.isMyCoopTurn(), 'after handing off it is no longer B’s turn');

// --- back to A, and round again -----------------------------------------------------------
const i2 = OA.importShareCode(h2.code || '');
ok(i2.ok, `A imports B’s code (${i2.error || 'ok'})`);
ok(OA.isMyCoopTurn(), 'it is A’s turn again');
ok(
  (OA.getActiveRoom()?.commanders || []).map((c) => c.name).join(',') === 'Aldric,Branwen',
  'A’s room now lists both commanders'
);
const pend = OA.consumePendingImport();
ok(!!pend && A.Game.importGameState(pend), 'A loads the game B handed back');
const d2 = diff(beforeB, JSON.parse(JSON.stringify(normalise(A))));
ok(d2.length === 0, `A has exactly B’s game (${d2.slice(0, 6).join(' | ') || 'no differences'})`);
A.GS.paused = false;
ok(
  playUntil(A, (s) => s.wave === 3 && s.timeOfDay === 'night'),
  'A plays wave 3'
);
const h3 = OA.handoffKingdom(A.Game.exportGameState());
ok(h3.ok && h3.nextCommander === 'Branwen', 'A hands off a second time, to B');
const i3 = OB.importShareCode(h3.code || '');
ok(i3.ok && OB.isMyCoopTurn(), 'B takes the third hand-off');
ok(OB.getActiveRoom()?.wave === 3, 'B’s room is at wave 3');

// --- codes that must be refused, with words a player can act on --------------------------
const stale = OB.importShareCode(h1.code);
ok(!stale.ok && /older/i.test(stale.error || ''), `an old code is refused (${stale.error})`);
ok(OB.isMyCoopTurn() && OB.getActiveRoom()?.wave === 3, 'the old code changed nothing');

const own = OA.importShareCode(h3.code);
ok(!own.ok && /partner/i.test(own.error || ''), `your own code is refused (${own.error})`);

const C = player(33, 'Catrin');
const OC = C.OnlineMultiplayer;
const cut = OC.importShareCode(h3.code.slice(0, Math.floor(h3.code.length / 2)));
ok(!cut.ok && !!cut.error, `half a code is refused (${cut.error})`);
ok(!OC.getActiveRoom(), 'a refused code does not create a room');

// A code from a newer version of the game.
const body = C.SaveFormat.fromText(h3.code.slice('KINGDOM:'.length));
ok(
  !!body && body.state && body.state.version === C.SaveFormat.VERSION,
  'the code holds the full versioned save'
);
ok(typeof body.state.checksum === 'string', 'the save inside the code carries its checksum');
const newerSave = JSON.parse(JSON.stringify(body));
newerSave.state.version = C.SaveFormat.VERSION + 1;
const r1 = OC.importShareCode('KINGDOM:' + C.SaveFormat.toText(newerSave));
ok(
  !r1.ok && /newer version/i.test(r1.error || ''),
  `a newer save is refused politely (${r1.error})`
);
const newerCode = JSON.parse(JSON.stringify(body));
newerCode.v = 99;
const r2 = OC.importShareCode('KINGDOM:' + C.SaveFormat.toText(newerCode));
ok(
  !r2.ok && /newer version/i.test(r2.error || ''),
  `a newer code format is refused politely (${r2.error})`
);
const tampered = JSON.parse(JSON.stringify(body));
tampered.state.tactical += 5000;
const r3 = OC.importShareCode('KINGDOM:' + C.SaveFormat.toText(tampered));
ok(!r3.ok && /damaged/i.test(r3.error || ''), `an altered save is refused (${r3.error})`);
ok(!OC.getActiveRoom() && !OC.hasPendingImport(), 'none of the refused codes left anything behind');

// A third player may join by taking a valid hand-off.
const i4 = OC.importShareCode(h3.code);
ok(i4.ok && OC.isMyCoopTurn(), 'a third player can take a hand-off');
ok((OC.getActiveRoom()?.commanders || []).length === 3, 'and is added to the commander list');

if (failures()) {
  console.error(`\n${failures()} co-op hand-off test(s) failed`);
  process.exit(1);
}
console.log('\nAll co-op hand-off tests passed.');
