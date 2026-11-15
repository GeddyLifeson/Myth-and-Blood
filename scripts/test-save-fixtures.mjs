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

const g = bootGame(5, { names: ['RenamedIds'] });
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

// v3-old-ids.json was made before the roster ids were renamed (js/renamed-ids.js).
const R = g.RenamedIds;
const old = JSON.parse(readFileSync(join(DIR, 'v3-old-ids.json'), 'utf8'));
const oldIds = new Set(
  ['unit', 'building', 'faction', 'ability', 'tag'].flatMap((k) => Object.keys(R.TABLE[k]))
);
ok(g.Game.importGameState(old.snap) === true, 'old-id save loads');
const players = g.GS.units.filter((u) => u.team === 'player');
const types = players.map((u) => u.type);
ok(
  [
    'hadrek_quarryborn',
    'brother_halvec',
    'dunmar_fusewick',
    'torvald_greyhame',
    'hrafna_stormthroat',
  ].every((t) => types.includes(t)),
  `old champions and heroes come back under their new ids (${types.join(' ')})`
);
const stale = [];
for (const u of players) {
  for (const f of ['type', 'wweAbility', 'combatTag'])
    if (oldIds.has(u[f])) stale.push(`${u.type}.${f}=${u[f]}`);
  if (/^roster_/.test(u.spriteType || '') && oldIds.has(u.spriteType.slice(7)))
    stale.push(u.spriteType);
}
for (const b of g.GS.buildings) {
  if (oldIds.has(b.type) || oldIds.has(b.crossoverFaction))
    stale.push(`${b.type}/${b.crossoverFaction}`);
}
ok(stale.length === 0, `no old id left on a loaded unit or building ${stale.join(' ')}`);
ok(
  ['champions_hall', 'powderhorn_magazine', 'greywatch_hall', 'rimehowl_longhouse'].every((t) =>
    g.GS.buildings.some((b) => b.type === t && b.hp > 0)
  ),
  'every old hall is back under its new id'
);
const modules = JSON.stringify(g.SaveFormat.prepare(old.snap).snap.modules);
const leftover = [...modules.matchAll(/"([a-z0-9_]+)"/g)]
  .map((m) => m[1])
  .filter((s) => oldIds.has(s) && s !== 'summoner');
ok(leftover.length === 0, `no old id left in module sections ${[...new Set(leftover)].join(' ')}`);
let t2 = 0;
playUntil(g, () => ++t2 > 600);
ok(t2 > 600 || !g.Game.isPlaying(), 'old-id save plays on after load');

// The stored profile from the same old build.
const mem = new Map(Object.entries(old.storage));
mem.set('myth-and-blood-settings-v1', '{"crystal":1}');
const store = {
  get length() {
    return mem.size;
  },
  key: (i) => [...mem.keys()][i] ?? null,
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};
ok(R.migrateStorage(store) > 0, 'old profile is migrated');
const get = (k) => JSON.parse(mem.get(`myth-and-blood-${k}`));
const meta = get('meta-v1');
ok(
  meta.wweRecruited.includes('hadrek_quarryborn') &&
    meta.crossoverRecruited.includes('hrafna_stormthroat'),
  'recruit history uses the new ids'
);
ok(
  JSON.stringify(get('operative-skills-v1').purchased) === '{"champions":["play_to_the_crowd"]}',
  `bought training keeps its tree and node (${JSON.stringify(get('operative-skills-v1').purchased)})`
);
ok('brother_halvec' in get('legacy-v1').unitDeploys, 'lifetime deploy counts move to the new ids');
const profileLeft = [...mem.values()]
  .join(' ')
  .match(/"(stone_cold|tank_dempsey|wwe|ultimis|wwe_academy|showmanship)"/);
ok(!profileLeft, `no old id left in the profile ${profileLeft?.[0] || ''}`);
ok(
  mem.get('myth-and-blood-settings-v1') === '{"crystal":1}',
  'stores without roster ids are untouched'
);
const after = JSON.stringify([...mem]);
ok(
  R.migrateStorage(store) === 0 && JSON.stringify([...mem]) === after,
  'the profile pass runs once'
);

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
