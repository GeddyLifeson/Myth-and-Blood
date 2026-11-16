#!/usr/bin/env node
/**
 * Game modes, mods and share-code play after the rework: one rule per mode, Survival plays
 * leaner, scores come from the siege loop and mark cheats, duel results merge, mods add
 * enemies, waves, spoils and profiles, saves record mods, and simulation rolls are seeded.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');

function loadScript(name) {
  vm.runInThisContext(readFileSync(join(JS, name), 'utf8'), { filename: name });
}

globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener() {},
  head: { appendChild: () => {} },
  createElement: () => ({ appendChild: () => {}, dataset: {} }),
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
globalThis.fetch = async () => ({ ok: false, status: 404 });

for (const f of [
  'save-registry.js',
  'game-data-bundle.js',
  'game-data.js',
  'sprites.js',
  'research.js',
  'roster.js',
  'siege-loop.js',
  'game-modes.js',
  'online-multiplayer.js',
  'mod-loader.js',
]) {
  loadScript(f);
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

// ── Modes: one rule each, and each plays differently ──────────────────────────────────────
const rules = GameModes.MODES.map((m) => m.rule);
assert(
  GameModes.MODES.every((m) => typeof m.rule === 'string' && m.rule.length > 10),
  'every mode states a rule'
);
assert(
  GameModes.MODES.every((m) => !m.rule.includes('\n') && m.rule.length <= 70),
  'each rule fits one line'
);
assert(new Set(rules).size === rules.length, 'no two modes share a rule');
assert(
  GameModes.MODES.every((m) => !/[—]/.test(m.rule + m.desc)),
  'no em dash in mode text'
);
GameModes.init();
GameModes.setMenuMode('survival');
assert(GameModes.beginSession('normal').session.tpTight, 'survival runs on tight TP');
GameModes.setMenuMode('campaign');
assert(!GameModes.beginSession('normal').session.tpTight, 'campaign keeps full TP');
GameModes.setMenuMode('pvp_endless');
const pvpSession = GameModes.beginSession('normal').session;
assert(!pvpSession.tpTight, 'a duel is not a survival run');
assert(pvpSession.onlinePvp, 'duel session is marked');

// ── Duel submits the siege loop score and marks cheats ────────────────────────────────────
const realLast = SiegeLoop.lastScore;
SiegeLoop.lastScore = () => ({ total: 4321 });
globalThis.Game = { cheatsUsed: () => false };
const honest = GameModes.recordResult(12, 80, false, 100);
assert(honest.score === 4321, `duel score is the run score (got ${honest.score})`);
assert(honest.cheated === false, 'honest run not marked');
let match = OnlineMultiplayer.getActivePvpMatch();
const mine = match.entries.find((e) => e.score === 4321);
assert(mine && !mine.cheated, 'duel entry carries the run score');

GameModes.setMenuMode('survival');
GameModes.beginSession('normal');
SiegeLoop.lastScore = () => null;
globalThis.Game = { cheatsUsed: () => true };
const cheat = GameModes.recordResult(30, 500, false, 100);
assert(cheat.cheated === true, 'cheated run is marked');
assert(cheat.score === 30 * 100 + 500 * 2, 'cheated run falls back to waves and kills');
const best = JSON.parse(localStorage.getItem('myth-and-blood-modes-v1')).personalBests;
assert(!best['survival-best'], 'a cheated run never becomes a personal best');
SiegeLoop.lastScore = realLast;
globalThis.Game = { cheatsUsed: () => false };

// ── PVPDATA import merges by commander id ─────────────────────────────────────────────────
match = OnlineMultiplayer.getActivePvpMatch();
const theirs = {
  ...match,
  entries: [{ commanderId: 'cmd-rival', name: 'Rival', wave: 9, score: 9000, at: Date.now() }],
};
const code = OnlineMultiplayer.exportPvpData(theirs);
const res = OnlineMultiplayer.importShareCode(code);
assert(res.ok, 'PVPDATA imports');
const merged = OnlineMultiplayer.getActivePvpMatch();
assert(merged.entries.length === 2, `both results kept (got ${merged.entries.length})`);
assert(merged.status === 'resolved' && merged.winnerId === 'cmd-rival', 'higher score wins');
const cheatCode = OnlineMultiplayer.exportPvpData({
  ...merged,
  entries: [
    {
      commanderId: 'cmd-rival',
      name: 'Rival',
      wave: 50,
      score: 99999,
      cheated: true,
      at: Date.now() + 5,
    },
  ],
});
OnlineMultiplayer.importShareCode(cheatCode);
const afterCheat = OnlineMultiplayer.getActivePvpMatch();
assert(afterCheat.entries.length === 2, 'later submission replaces the same commander');
assert(afterCheat.winnerId !== 'cmd-rival', 'a cheated result never beats an honest one');

// ── Mods add an enemy, a wave, a spoil and roster profiles ────────────────────────────────
const enemies = {
  test_raider: {
    name: 'Test Raider',
    hp: 60,
    accuracy: 30,
    damage: 14,
    range: 20,
    meleeRange: 20,
    speed: 0.9,
    type: 'melee',
    morale: 10,
    trait: 'Wears stolen plate.',
  },
};
const units = {
  test_guard: {
    name: 'Test Guard',
    cost: 5,
    hp: 120,
    accuracy: 40,
    damage: 30,
    range: 22,
    meleeRange: 22,
    speed: 1,
    type: 'ranged',
    morale: 12,
    experience: 5,
  },
};
const waves = [
  { every: 5, from: 5, add: { test_raider: 3 } },
  { wave: 7, add: { goblin: 2 } },
];
const spoils = {
  test_drill: { name: 'Test Drill', desc: 'Take 5% less damage.', fx: { dmgTakenMult: -0.05 } },
  bad_spoil: { name: 'Bad', desc: 'Unknown effect.', fx: { teleport: 1 } },
};
const result = ModLoader.injectMod(
  { id: 'test_mod', name: 'Test' },
  units,
  {},
  {
    enemies,
    waves,
    spoils,
  }
);
assert(EnemyDefs.test_raider?.modId === 'test_mod', 'mod enemy registered');
assert(result.waves.length === 2, 'mod waves registered');
assert(SiegeLoop.EDICTS.test_drill?.modId === 'test_mod', 'mod spoil registered');
assert(!SiegeLoop.EDICTS.bad_spoil, 'spoil with unknown effect refused');
assert(
  result.errors.some((e) => e.includes('teleport')),
  'refused spoil names the bad key'
);
const guardProfile = Roster.describeType('test_guard', 'player');
assert(guardProfile?.role === 'Shooter', 'mod troop gets a default profile from its type');
assert(
  Roster.describeType('test_raider', 'enemy')?.trait === 'Wears stolen plate.',
  'mod enemy keeps its own trait'
);
assert(
  ModLoader.applyModWaves(10, ['orc']).filter((t) => t === 'test_raider').length === 3,
  'every-5 wave adds raiders at wave 10'
);
assert(ModLoader.applyModWaves(11, ['orc']).length === 1, 'no extra enemies off-cycle');
assert(ModLoader.applyModWaves(7, []).length === 2, 'single-wave entry fires on its wave');
const badWave = ModLoader.injectMod(
  { id: 'bad_mod' },
  {},
  {},
  {
    waves: [{ wave: 3, add: { no_such_enemy: 1 } }],
  }
);
assert(
  badWave.waves.length === 0 && badWave.errors.length === 1,
  'wave naming unknown enemy refused'
);

// ── Saves record mod ids and warn when one is missing ─────────────────────────────────────
const sections = SaveRegistry.saveAll();
assert(sections.ModLoader?.data?.ids?.includes('test_mod'), 'save lists the loaded mods');
SaveRegistry.loadAll(sections, null);
assert(ModLoader.missingWarning() === null, 'no warning when every mod is on');
SaveRegistry.loadAll({ ModLoader: { v: 1, data: { ids: ['test_mod', 'gone_mod'] } } }, null);
assert(
  ModLoader.getMissingFromSave().join() === 'gone_mod' &&
    /gone_mod/.test(ModLoader.missingWarning()),
  'missing mod named in the warning'
);
SaveRegistry.loadAll({}, null);
assert(ModLoader.missingWarning() === null, 'an old save without the section loads quietly');

// ── Seeded simulation rolls ───────────────────────────────────────────────────────────────
GameModes.setMenuMode('seed');
GameModes.setMenuSeed('realm-42');
GameModes.beginSession('normal');
const ref = GameModes.createRng('realm-42');
const seq = [globalThis.simRandom(), globalThis.simRandom(), globalThis.simRandom()];
const want = [ref(), ref(), ref()];
assert(
  seq.every((v, i) => v === want[i]),
  'simRandom draws from the seeded stream'
);
GameModes.endSession();

// Every roll that decides the fight goes through simRandom. Ids and looks may use Math.random.
const SIM_FILES = [
  'game-combat.js',
  'game-depth.js',
  'game-field.js',
  'game-movement.js',
  'game-targeting.js',
  'game-unit-ai.js',
  'game-waves.js',
  'game-commands.js',
  'dynamic-map-events.js',
  'neutral-relations.js',
];
for (const f of SIM_FILES) {
  const lines = readFileSync(join(JS, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const bare = line.replace(/globalThis\.simRandom \|\| Math\.random/g, '');
    if (/Math\.random\(\)/.test(bare) && !/toString\(36\)/.test(bare)) {
      assert(false, `${f}:${i + 1} rolls Math.random() directly`);
    }
  });
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('test-modes-rework: all checks passed');
