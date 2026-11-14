#!/usr/bin/env node
/**
 * The save data layer (js/save.js) and SaveRegistry: slots, autosave at nightfall, export and
 * import as text, refusals in words, full storage, and a module section round trip.
 */
import { bootGame, playUntil } from './lib/save-test-kit.mjs';

let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK' : 'FAIL'}: ${msg}`);
  if (!cond) failed++;
};

// --- SaveRegistry: a module adds its own state ---------------------------------------------
{
  const g = bootGame(3, { extra: ['save.js'], names: ['SaveManager'] });
  const R = g.SaveRegistry;
  let live = { seen: new Set(['a']), marks: new Map([['x', 2]]), n: 4 };
  const loads = [];
  R.register('TestModule', {
    version: 2,
    save: () => live,
    load(data) {
      loads.push(data);
      live = data ? { ...data } : { seen: new Set(), marks: new Map(), n: 0 };
    },
    migrate: (data, from) => (from === 1 ? { ...data, n: data.n * 10 } : data),
  });
  g.Game.start();
  const snap = JSON.parse(JSON.stringify(g.Game.exportGameState()));
  ok(snap.modules?.TestModule?.v === 2, 'the section is saved with its version');
  live = { seen: new Set(), marks: new Map(), n: 0 };
  ok(g.Game.importGameState(snap), 'the save loads');
  ok(
    live.seen.has('a') && live.marks.get('x') === 2 && live.n === 4,
    'Set, Map and numbers come back'
  );
  const old = JSON.parse(JSON.stringify(snap));
  old.modules.TestModule.v = 1;
  g.SaveFormat.seal(old);
  g.Game.importGameState(old);
  ok(live.n === 40, 'an older section runs through its migrate()');
  const none = JSON.parse(JSON.stringify(snap));
  delete none.modules.TestModule;
  g.SaveFormat.seal(none);
  g.Game.importGameState(none);
  ok(loads[loads.length - 1] === null && live.n === 0, 'a save without the section resets it');
  const newer = JSON.parse(JSON.stringify(snap));
  newer.modules.TestModule.v = 9;
  g.SaveFormat.seal(newer);
  const wave = g.GS.wave;
  ok(g.Game.importGameState(newer) === false && g.GS.wave === wave, 'a newer section is refused');
  R.unregister('TestModule');
}

// --- slots, block reasons, export and import -------------------------------------------------
{
  const g = bootGame(4, { extra: ['save.js'], names: ['SaveManager', 'SaveData'] });
  const S = g.SaveManager;
  ok(typeof S.saveBlockReason() === 'string', `no run: ${S.saveBlockReason()}`);
  ok(!S.saveToSlot(0).ok, 'saving with no run is refused');
  g.Game.start();
  ok(S.saveBlockReason() === null, 'a normal run may be saved');
  ok(S.saveToSlot(0, 'First').ok && !S.listSlots()[0].empty, 'save to slot 1');
  const ex = S.exportSlot(0);
  ok(ex.ok && ex.text.startsWith(g.SaveFormat.TEXT_PREFIX), 'export slot 1 as text');
  ok(!S.exportSlot(2).ok, 'an empty slot has nothing to export');
  const im = S.importString(ex.text, { slot: 2 });
  ok(im.ok && im.slot === 2 && im.wave === g.GS.wave, 'import into slot 3');
  ok(S.loadFromSlot(2).ok, 'the imported slot loads');
  ok(!S.importString('hello').ok, `junk is refused: ${S.importString('hello').error}`);
  const cut = S.importString(ex.text.slice(0, ex.text.length - 40));
  ok(!cut.ok && /not complete|damaged/.test(cut.error), `cut text is refused: ${cut.error}`);
  ok(
    S.importString(ex.text).ok && S.listSlots()[1].empty === undefined,
    'no slot given: first empty one'
  );
  ok(!S.importString(ex.text).ok, 'every slot full: refused with a reason');
  for (const k of ['saveBlockReason', 'exportSlot', 'importString', 'listAutosaves']) {
    ok(typeof S[k] === 'function' && typeof g.SaveData[k] === 'function', `${k} is exported`);
  }
}

// --- autosave at nightfall, kept to three, and full storage ---------------------------------
{
  const g = bootGame(6, { extra: ['save.js'], names: ['SaveManager'] });
  const S = g.SaveManager;
  g.Game.setDifficulty('baby');
  g.Game.start();
  ok(S.listAutosaves().length === 0, 'no autosave before the first night');
  ok(
    playUntil(g, (s) => s.wave >= 1 && s.timeOfDay === 'night'),
    'reached the first night'
  );
  const a1 = S.listAutosaves();
  ok(a1.length === 1 && a1[0].timeOfDay === 'night', 'nightfall made an autosave');
  for (let i = 0; i < 4; i++) S.autosave();
  ok(S.listAutosaves().length === S.AUTOSAVE_KEEP, `only ${S.AUTOSAVE_KEEP} are kept`);
  ok(S.exportAutosave(0).ok && S.loadAutosave(0).ok, 'an autosave exports and loads');
  ok(S.deleteAutosave(0) && S.listAutosaves().length === S.AUTOSAVE_KEEP - 1, 'delete one');

  const used = [...g.store].reduce((n, [k, v]) => n + k.length + v.length, 0);
  g.quota.limit = used + 2000;
  const r = S.saveToSlot(0);
  ok(r.ok, 'a slot save makes room by dropping old autosaves');
  ok(S.listAutosaves().length < S.AUTOSAVE_KEEP - 1, 'and the autosaves went first');
  g.quota.limit = 10;
  const full = S.saveToSlot(1);
  ok(
    !full.ok && /Storage is full/.test(full.error),
    `full storage is said in words: ${full.error}`
  );
}

if (failed) {
  console.error(`\n${failed} save data check(s) failed.`);
  process.exit(1);
}
console.log('\nAll save data tests passed.');
