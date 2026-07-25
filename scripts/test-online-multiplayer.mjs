#!/usr/bin/env node
/**
 * Headless smoke test for Online Multiplayer — co-op rooms, PvP matches, share codes.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');

function loadScript(name) {
  const src = readFileSync(join(JS, name), 'utf8');
  vm.runInThisContext(src, { filename: name });
}

globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
};
globalThis.localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = v;
  },
};
loadScript('game-modes.js');
loadScript('online-multiplayer.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

GameModes.init();

const room = OnlineMultiplayer.createCoopRoom({ seed: 'test-coop-seed' });
assert(room.id.startsWith('COOP-'), 'coop room id prefix');
assert(room.seed === 'test-coop-seed', 'coop room seed');

const invite = OnlineMultiplayer.exportCoopInvite(room);
assert(invite?.startsWith('COOP:'), 'coop invite prefix');

const fakeState = { version: 1, wave: 7, tactical: 40, kills: 12, units: [], buildings: [] };
const handoff = OnlineMultiplayer.handoffKingdom(fakeState);
assert(handoff.ok, 'handoff should succeed');
assert(handoff.code?.startsWith('KINGDOM:'), 'kingdom code prefix');

const importKingdom = OnlineMultiplayer.importShareCode(handoff.code);
assert(importKingdom.ok && importKingdom.type === 'kingdom', 'kingdom import');
assert(OnlineMultiplayer.hasPendingImport(), 'pending kingdom import');

const match = OnlineMultiplayer.createPvpMatch({ seed: 'pvp-test-seed' });
assert(match.id.startsWith('PVP-'), 'pvp match id');
const pvpData = OnlineMultiplayer.exportPvpData(match);
assert(pvpData?.startsWith('PVPDATA:'), 'pvp data export');

localStorage._data = {};
OnlineMultiplayer.load();
const importPvp = OnlineMultiplayer.importShareCode(pvpData);
assert(importPvp.ok && importPvp.type === 'pvp', 'pvp data import');

const pvpResult = OnlineMultiplayer.submitPvpResult({
  wave: 42,
  kills: 100,
  score: 5000,
  victory: false,
});
assert(pvpResult?.entry?.wave === 42, 'pvp score submit');

OnlineMultiplayer.setPlayerName('Test Commander');
const begun = GameModes.beginSession('normal');
GameModes.setMenuMode('pve_horde');
const hordeBegun = GameModes.beginSession('normal');
assert(hordeBegun.session?.forceHorde, 'pve horde forces horde waves');
assert(hordeBegun.session?.hordeCountMult === 1.35, 'pve horde count mult');

GameModes.setMenuMode('pvp_endless');
const pvpBegun = GameModes.beginSession('chad');
assert(pvpBegun.session?.onlinePvp, 'pvp endless sets onlinePvp');
assert(pvpBegun.session?.modeId === 'survival', 'pvp endless runs as survival');

if (failed) {
  console.error(`test-online-multiplayer: ${failed} failure(s)`);
  process.exit(1);
}
console.log('test-online-multiplayer: OK');