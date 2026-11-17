#!/usr/bin/env node
/**
 * Achievements: list rules, every counter is fed, old saves carry over, cheated and
 * creative runs earn nothing, toasts come one at a time.
 * Run: node scripts/test-achievements.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { ok, failures } from './lib/harness.mjs';

const JS = join(dirname(fileURLToPath(import.meta.url)), '..', 'js');
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => {
    store[k] = String(v);
  },
};

// A fake toast element and a timer list we advance by hand.
const toast = {
  shown: 0,
  maxShown: 0,
  names: [],
  classList: {
    add() {
      toast.shown++;
      toast.maxShown = Math.max(toast.maxShown, toast.shown);
    },
    remove() {
      toast.shown = 0;
    },
    toggle() {},
  },
  style: {},
  className: '',
  querySelector(sel) {
    const t = this;
    return {
      style: {},
      className: '',
      set textContent(v) {
        if (sel === '.ach-toast-name') t.names.push(v);
      },
    };
  },
};
const timers = [];
globalThis.setTimeout = (fn, ms) => {
  timers.push({ fn, ms });
  return timers.length;
};
const titleHud = { hidden: true, title: '' };
const titleText = { textContent: '' };
globalThis.document = {
  getElementById: (id) =>
    ({ 'achievement-toast': toast, 'title-hud': titleHud, 'title-text': titleText })[id] ?? null,
  querySelectorAll: () => [],
};
const meta = new Proxy({}, { get: () => () => {} });
globalThis.MetaProgress = meta;
globalThis.getHeroDef = (t) => (t.startsWith('xo_') ? { faction: t.slice(3) } : null);
globalThis.Research = {
  getSnapshot: () => ({ doctrines: Array.from({ length: 40 }, (_, i) => `r${i}`) }),
};
globalThis.SiegeLoop = { lastScore: () => ({ total: 30000 }) };
globalThis.isChampionUnit = (t) => t === 'wwe_star';

function load(name) {
  vm.runInThisContext(readFileSync(join(JS, name), 'utf8'), { filename: name });
}
load('renamed-ids.js');
load('enemy-factions.js');
load('achievements-data.js');
load('achievements.js');

const L = ACHIEVEMENT_LIST;
const ACHIEVEMENT_COMPANY_KEYS = COMPANY_ACH_IDS.map((f) => f.key);
const A = globalThis.Achievements;

// ---------------------------------------------------------------- the list
ok(L.length >= 150 && L.length <= 250, `list size ${L.length} is within 150 to 250`);
ok(new Set(L.map((a) => a.id)).size === L.length, 'ids are unique');
const famIds = new Set(ACHIEVEMENT_FAMILIES.map((f) => f.id));
ok(
  L.every((a) => famIds.has(a.family)),
  'every entry belongs to a known group'
);
ok(
  L.every((a) => a.n > 0 && a.name && a.desc),
  'every entry has a goal, a name and a text'
);
const text = JSON.stringify(L.map((a) => [a.name, a.desc])) + JSON.stringify(ACHIEVEMENT_FAMILIES);
ok(!/[—–]/.test(text), 'no em dash or en dash in any text');
const banned =
  /\b(wwe|wrestl|halo|spartan|master chief|gears of war|lord of the rings|tolkien|frodo|baki|jojo|dragon ?ball|goku|warhammer|space marine|skyrim|elder scrolls|doom ?guy|pokemon|zelda|mario|austin|one piece)\b/i;
ok(!banned.test(text.replace(/\{[a-z]+:[a-z0-9_]+\}/g, '')), 'no real franchise or person in text');
const groupSizes = ACHIEVEMENT_FAMILIES.map((f) => L.filter((a) => a.family === f.id).length);
ok(
  groupSizes.every((n) => n > 0),
  `every group has entries (${groupSizes.join(',')})`
);
ok(
  ACHIEVEMENT_ENEMY_FACTIONS.every((f) => EnemyFactions.getFactionDef(f)),
  'every enemy host named in the list exists in the game'
);
const hosts = new Set(Object.values(EnemyFactions.FACTIONS).map((f) => f.id));
ok(
  ACHIEVEMENT_ENEMY_FACTIONS.every((f) => hosts.has(f)),
  'enemy host ids match the game'
);

// -------------------------------------------------- every counter is written
const need = new Set(L.filter((a) => a.s !== 'x').map((a) => `${a.s}:${a.k}`));
A.resetSession();
const E = (t, d) => A.onEvent(t, d);
E('game_start', { difficulty: 'normal' });
const killVariants = (killerType, enemyType, extra = {}) =>
  E('kill', {
    killerType,
    enemyType,
    elite: true,
    runner: true,
    boss: false,
    held: true,
    hunting: true,
    charging: true,
    cause: 'blast',
    siege: true,
    killerKills: 60,
    killerHonored: true,
    killerGeneral: true,
    ...extra,
  });
for (const t of ACHIEVEMENT_TROOPS) {
  const types = ACHIEVEMENT_SIGNATURES[t]?.types || ['goblin'];
  for (const e of types) killVariants(t, e);
}
for (const b of ACHIEVEMENT_BOSSES) killVariants('sapper', b, { boss: true });
killVariants('xo_x', 'goblin');
for (let i = 0; i < 10; i++) E('mage_splash', { hitCount: 4 });
const units = [];
for (let i = 0; i < 10; i++) {
  units.push({
    team: 'player',
    hp: 5,
    type: i === 0 ? 'general' : i === 1 ? 'healer' : 'footman',
    isGeneral: i === 0,
    wavesSurvived: 60,
    kills: 300,
    holdX: 5,
    stretcherSaves: 1,
  });
}
const enemyTypes = Object.values(EnemyFactions.FACTIONS).flatMap((f) =>
  f.tiers.flatMap((t) => t.units)
);
const hostOf = (t) => EnemyFactions.getUnitFaction(t);
for (const f of ACHIEVEMENT_ENEMY_FACTIONS) {
  const type = enemyTypes.find((t) => hostOf(t) === f);
  if (type) for (let i = 0; i < 6; i++) killVariants('footman', type, { runner: false });
}
E('general_fell', {});
for (const k of [
  'warCry',
  'holdLine',
  'earlyCalls',
  'crates',
  'ambushes',
  'fallenVets',
  'minesLaid',
  'medSaves',
]) {
  E('tally', { k });
}
for (const id of ['war_chest', 'caltrops', 'scavengers']) E('edict', { id, stacks: 3 });
for (const u of ['footman', 'archer']) E('deploy', { unitType: u });
for (const b of ['castle', 'wall']) E('building_complete', { buildType: b });
E('vet_event', { event: 'honored', unitType: 'footman', vetTier: 9 });
E('footman_promoted_general', { unitKey: 'a' });
E('general_stationed', {});
E('enemy_structure_razed', { runTotal: 1 });
for (const a of ['fireball', 'lightning']) E('ability', { ability: a });
E('spy', { action: 'steal' });
E('breach', { total: 1, left: 0 });
E('siege_wave', { cleanStreak: 3, flawless: 3, breaches: 1, left: 0 });
E('wave_complete', {
  wave: 16,
  difficulty: 'normal',
  modeId: 'academy_era',
  ironman: true,
  advancedMods: 2,
  bossWave: true,
  armySize: 1,
  wallCount: 9,
  playerCasualtiesThisWave: 0,
  units: [
    ...units,
    { team: 'player', hp: 5, type: 'xo_halo', wavesSurvived: 1 },
    { team: 'player', hp: 5, type: 'wwe_star' },
  ],
});
E('breach', { total: 1, left: 0 });
E('wave_complete', { wave: 17, difficulty: 'normal', units });
const plain = (n) => Array.from({ length: n }, () => ({ team: 'player', hp: 5, type: 'footman' }));
for (const d of ACHIEVEMENT_DIFFICULTIES)
  E('wave_complete', { wave: 20, difficulty: d, units: [] });
for (const m of ['survival', 'roguelike', 'timed', 'pve_horde', 'warband']) {
  E('wave_complete', { wave: 12, difficulty: 'normal', modeId: m, units: [] });
}
for (let i = 0; i < 3; i++) E('breach', { total: i, left: 3 });
E('siege_wave', { cleanStreak: 0, flawless: 0, breaches: 3, left: 3 });
E('wave_complete', { wave: 21, difficulty: 'normal', units: plain(9) });
E('siege_wave', { cleanStreak: 4, flawless: 4, breaches: 3, left: 3 });
E('wave_complete', {
  wave: 22,
  difficulty: 'normal',
  bossWave: true,
  playerCasualtiesThisWave: 0,
  units: plain(2),
});
for (const f of ACHIEVEMENT_COMPANY_KEYS) {
  E('crossover_recruit', { crossoverId: `xo_${f}` });
}
E('wave_complete', {
  wave: 23,
  difficulty: 'normal',
  units: ACHIEVEMENT_COMPANY_KEYS.map((f) => ({
    team: 'player',
    hp: 5,
    type: f === 'champions' ? 'wwe_star' : f === 'doom' ? 'doomslayer_hero' : `xo_${f}`,
  })),
});
E('campaign_victory', { wave: 100 });
E('game_end', { victory: false, wave: 1 });
const got = A.writtenCounters();
const missing = [...need].filter(
  (k) => !got.has(k) && !(k.startsWith('l:mastery.') && got.has(k)) && !k.startsWith('l:faction.')
);
ok(
  missing.length === 0,
  `every counter is written by an event (missing: ${missing.join(' ') || 'none'})`
);
const hostKeys = ACHIEVEMENT_ENEMY_FACTIONS.map((f) => `l:faction.${f}`);
ok(
  hostKeys.every((k) => got.has(k)),
  'each enemy host counter is written by real host data'
);
ok(
  ACHIEVEMENT_ENEMY_FACTIONS.every((f) => enemyTypes.some((t) => hostOf(t) === f)),
  'each listed host has troops in the game'
);

// ---------------------------------------------------------- a real unlock path
A.resetSession();
ok(A.isUnlocked('life_kills_1') === false, 'a fresh save has no kill unlock');
for (let i = 0; i < 200; i++) E('kill', { enemyType: 'goblin', killerType: 'footman' });
ok(A.isUnlocked('run_kills_1'), '200 kills in a run unlock Red Field');
E('game_start', { difficulty: 'normal' });
ok(!A.isUnlocked('run_kills_2'), 'a new run starts the run counters again');

// ---------------------------------------------------------- old save carries over
store['myth-and-blood-achievements-v3'] = JSON.stringify({
  unlocked: [
    'reach_wave_20',
    'kills_1000',
    'lifetime_kills_5000',
    'honor_name',
    'foe_first_goblin',
    'wwe_recruit_x',
    'doom_hero_unlock',
    'cheat_austin',
    'hunt_master',
    'deploy_all',
  ],
  lifetimeKills: 300,
  lifetimeWavesCleared: 160,
  lifetimeEnemyKills: { goblin: 7 },
  lifetimeSpy: ['steal', 'scout'],
  crossoverMastery: { wwe: 600 },
});
while (timers.length) timers.shift().fn();
toast.names.length = 0;
// The game runs the renamed-id pass over an old profile before achievements load it.
delete store['myth-and-blood-ids-renamed-v1'];
vm.runInThisContext('RenamedIds').migrateStorage({
  get length() {
    return Object.keys(store).length;
  },
  key: (i) => Object.keys(store)[i] ?? null,
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => {
    store[k] = String(v);
  },
});
A.reload();
ok(
  A.isUnlocked('wave_5') && A.isUnlocked('wave_15') && A.isUnlocked('wave_20'),
  'old wave mark maps to the new wave marks'
);
ok(A.isUnlocked('run_kills_2'), 'old 1000-kill run maps onto the 500-kill step');
ok(A.isUnlocked('vet_honored_1'), 'old honour name maps onto the new one');
ok(A.isUnlocked('doom_hero_unlock'), 'an order trial keeps its id');
ok(
  A.isUnlocked('life_kills_1') && A.isUnlocked('life_waves_1'),
  'old lifetime counters unlock the lifetime goals'
);
ok(
  A.isUnlocked('order_champions_1') && A.isUnlocked('order_champions_2'),
  'old mastery points unlock the order ladder'
);
ok(!A.retiredIds().includes('reach_wave_20'), 'a mapped id is not retired');
ok(
  A.retiredIds().includes('foe_first_goblin') && A.retiredIds().includes('wwe_recruit_x'),
  'ids with no equivalent are retired, not lost'
);
ok(
  A.getAll().every((a) => typeof a.unlocked === 'boolean') && A.getCount().unlocked > 0,
  'the loaded save reads back through the public list'
);
ok(A.pendingToasts() === 0 && toast.names.length === 0, 'carrying a save over raises no toast');
const saved = JSON.parse(store['myth-and-blood-achievements-v3']);
ok(
  saved.v === 4 && saved.retired.length > 0,
  'the save is rewritten in the new format with the retired ids kept'
);
A.reload();
ok(A.getCount().unlocked > 0, 'the new format loads again');
ok(!A.isUnlocked('cheat_used'), 'a cheat flag from an old save is not carried over');

// -------------------------------------------------- cheated and creative runs
globalThis.Game = { cheatsUsed: () => true, isCreativeMode: () => false };
const before = A.getCount().unlocked;
A.resetSession();
for (let i = 0; i < 1600; i++) E('kill', { enemyType: 'goblin', killerType: 'footman' });
E('wave_complete', { wave: 100, difficulty: 'normal', units: [] });
ok(A.tryUnlock('wave_75') === null, 'tryUnlock refuses in a cheated run');
ok(A.getCount().unlocked === before, 'a cheated run unlocks nothing');
globalThis.Game = { cheatsUsed: () => false, isCreativeMode: () => true };
for (let i = 0; i < 1600; i++) E('kill', { enemyType: 'goblin', killerType: 'footman' });
ok(
  A.tryUnlock('wave_75') === null && A.getCount().unlocked === before,
  'a creative run unlocks nothing'
);
globalThis.Game = { cheatsUsed: () => false, isCreativeMode: () => false };

// --------------------------------------------------------------- one toast at a time
toast.names.length = 0;
toast.maxShown = 0;
A.tryUnlock('wave_35');
A.tryUnlock('wave_75');
A.tryUnlock('cmp_endless');
ok(
  toast.names.length === 1 && A.pendingToasts() === 2,
  'three unlocks at once show one toast and queue two'
);
let guard = 0;
while (timers.length && guard++ < 20) timers.shift().fn();
ok(toast.names.length === 3, `the queue shows all three in turn (${toast.names.length})`);
ok(toast.maxShown === 1, 'never more than one toast on screen');

// --------------------------------------------------------------- rewards are granted
load('cosmetics.js');
const C = globalThis.Cosmetics;
const skinAch = L.find((a) => a.reward?.type === 'skin' && a.reward.id === 'ash_and_bone');
ok(!!skinAch && !C.isUnlockMet('ach_skin_ash_and_bone'), 'an achievement skin starts locked');
A.tryUnlock(skinAch.id);
ok(C.isUnlockMet('ach_skin_ash_and_bone'), 'earning its achievement unlocks the skin');
const masteryAch = L.find((a) => a.reward?.id === ACHIEVEMENT_MASTERY_SKINS.doom);
A.tryUnlock(masteryAch.id);
ok(C.isUnlockMet('creative_skin_doom'), 'an order mastery skin unlocks from its achievement');
const titleAch = L.find((a) => a.reward?.type === 'title');
A.tryUnlock(titleAch.id);
ok(A.earnedTitles().includes(titleAch.reward.label), 'an earned title is listed');
A.updateTopBar();
ok(
  !titleHud.hidden && titleText.textContent === titleAch.reward.label,
  'the HUD shows the title just earned'
);
while (timers.length) timers.shift().fn();

process.exit(failures() ? 1 : 0);
