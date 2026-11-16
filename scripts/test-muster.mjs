/**
 * The Muster (js/crown-legacies.js): perk slots bought with Echo Shards, ribbons and echo
 * branches only counting while slotted, v1 store migration, the run's loadout in saves,
 * cached effects on the damage path, and the Legacy record written once per wave.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const src = (f) => readFileSync(join(JS, f), 'utf8');

function boot(initial = {}, ribbons = []) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const counts = { get: 0, set: 0, legacyGet: 0 };
  const localStorage = {
    getItem: (k) => {
      counts.get++;
      return store.has(k) ? store.get(k) : null;
    },
    setItem: (k, v) => {
      counts.set++;
      store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
  };
  const ctx = vm.createContext({
    console,
    Math,
    JSON,
    Date,
    localStorage,
    EnemyDefs: {},
    getDifficultyDef: () => ({ label: 'Normal' }),
    SiegeLoop: { getRibbons: () => ribbons },
  });
  ctx.globalThis = ctx;
  const code = ['save-registry.js', 'legacy.js', 'crown-legacies.js', 'eternal-legacy-tree.js']
    .map(src)
    .join('\n;\n');
  const mods = vm.runInContext(
    `${code}\n({ SaveRegistry, Legacy, CrownLegacies, EternalLegacyTree })`,
    ctx
  );
  const realGet = mods.Legacy.get;
  mods.Legacy.get = () => {
    counts.legacyGet++;
    return realGet();
  };
  return { ...mods, counts, store };
}

const CROWN = 'myth-and-blood-crown-legacies-v1';
const LEGACY = 'myth-and-blood-legacy-v1';
const ETERNAL = 'myth-and-blood-eternal-legacy-v1';

// --- migration: a v1 player keeps every unlock and all three slots, at no shard cost
{
  const m = boot({
    [CROWN]: { unlockedIds: ['crowned_command', 'siege_memory'], activeIds: ['crowned_command'] },
  });
  const snap = m.CrownLegacies.getMenuSnapshot();
  ok(snap.slotsOwned === 3, 'v1 player with unlocks keeps 3 slots');
  ok(snap.activeIds.includes('crowned_command'), 'v1 equipped legacy stays slotted');
  ok(m.CrownLegacies.getSlotSpend() === 0, 'migrated slots cost no shards');
  ok(JSON.parse(m.store.get(CROWN)).version === 2, 'migrated store is written back as v2');
}
{
  const m = boot({ 'myth-and-blood-ribbons-v1': { earned: ['first_blood'], stats: {} } });
  ok(m.CrownLegacies.getMenuSnapshot().slotsOwned === 1, 'no crown store yet: fresh player');
  const m2 = boot({
    [CROWN]: { unlockedIds: [], activeIds: [] },
    'myth-and-blood-ribbons-v1': { earned: ['first_blood'], stats: {} },
  });
  ok(m2.CrownLegacies.getMenuSnapshot().slotsOwned === 3, 'v1 ribbon holder keeps 3 slots');
}

// --- slots are bought with Echo Shards; unavailable says why
{
  const m = boot({ [LEGACY]: { victories: 0, maxWaveEver: 0 } }, [
    { id: 'first_blood', name: 'First Blood', how: 'Clear wave 1.', perk: '+1', earned: true },
    { id: 'ten_dawns', name: 'Ten Dawns', how: 'Clear wave 10.', perk: '+2', earned: true },
  ]);
  ok(m.CrownLegacies.getMenuSnapshot().slotsOwned === 1, 'new player starts with one slot');
  ok(m.CrownLegacies.toggleSlot('ribbon:first_blood').ok, 'earned ribbon can be slotted');
  const full = m.CrownLegacies.toggleSlot('ribbon:ten_dawns');
  ok(!full.ok && full.reason === 'full', 'second perk refused while one slot owned');
  const poor = m.CrownLegacies.buySlot();
  ok(!poor.ok && poor.reason === 'shards' && poor.cost === 3, 'slot 2 needs 3 shards');
  ok(!m.CrownLegacies.toggleSlot('ribbon:quarter_siege').ok, 'unearned ribbon cannot be slotted');

  m.store.set(LEGACY, JSON.stringify({ victories: 1, maxWaveEver: 40 })); // 3 + 2 = 5 shards
  m.Legacy.load();
  const bought = m.CrownLegacies.buySlot();
  ok(bought.ok && bought.slots === 2, 'slot 2 bought with shards');
  ok(m.EternalLegacyTree.getAvailableShards() === 2, 'slot price leaves the shard pool');
  ok(!m.CrownLegacies.buySlot().ok, 'slot 3 (6 shards) refused with 2 left');
  ok(m.CrownLegacies.toggleSlot('ribbon:ten_dawns').ok, 'second slot takes a second perk');
  ok(m.CrownLegacies.isSlotted('ribbon:first_blood'), 'isSlotted sees ribbon perks');
}

// --- Crown of Ages nodes only count while their branch is slotted
{
  const m = boot({ [LEGACY]: { victories: 2, maxWaveEver: 60 } });
  ok(m.EternalLegacyTree.investNode('crown_first_echo').ok, 'invest First Echo');
  ok(m.EternalLegacyTree.getCombinedEffects(null, 1).startTp === 0, 'unslotted echo branch is off');
  ok(m.CrownLegacies.toggleSlot('echo:crown_trunk').ok, 'invested branch can be slotted');
  ok(m.EternalLegacyTree.getCombinedEffects(null, 1).startTp === 2, 'slotted branch applies');
  ok(!m.CrownLegacies.toggleSlot('echo:iron_crown').ok, 'branch with no investment is locked');
}

// --- getCombinedEffects on the damage path: no storage read, no Legacy rebuild per hit
{
  const m = boot({
    [CROWN]: { version: 2, unlockedIds: ['northern_grudge'], activeIds: ['northern_grudge'] },
    [LEGACY]: { victories: 1, unitKills: { archer: 50 } },
    [ETERNAL]: { investedIds: ['crown_first_echo'] },
  });
  m.CrownLegacies.toggleSlot('echo:crown_trunk');
  m.CrownLegacies.getCombinedEffects();
  m.EternalLegacyTree.getCombinedEffects(null, 50);
  const before = { ...m.counts };
  let dmg = 0;
  for (let i = 0; i < 1000; i++) {
    dmg += m.CrownLegacies.getCombinedEffects().playerDmgMult;
    dmg += m.EternalLegacyTree.getCombinedEffects(null, 50).startTp;
  }
  ok(dmg > 1000, 'effects still apply');
  ok(m.counts.get === before.get, '1000 hits read localStorage 0 times');
  ok(m.counts.legacyGet === before.legacyGet, '1000 hits rebuild the Legacy snapshot 0 times');
  m.CrownLegacies.toggleSlot('northern_grudge');
  ok(m.CrownLegacies.getCombinedEffects().playerDmgMult === 1, 'cache drops on a slot change');
}

// --- the run keeps its loadout in the save; old saves without the section fall back
{
  const m = boot({
    [CROWN]: { version: 2, unlockedIds: ['crowned_command', 'siege_memory'], slotsOwned: 3 },
  });
  m.CrownLegacies.toggleSlot('crowned_command');
  m.CrownLegacies.applyRunStartBonuses({ grantTp: () => {} });
  const saved = m.SaveRegistry.saveAll();
  ok(saved.Muster?.data?.slots?.[0] === 'crowned_command', 'save holds the run loadout');
  m.CrownLegacies.toggleSlot('crowned_command'); // edited at the menu after the run began
  m.CrownLegacies.toggleSlot('siege_memory');
  ok(m.SaveRegistry.loadAll(saved).ok, 'save with a Muster section loads');
  ok(m.CrownLegacies.isSlotted('crowned_command'), 'saved run loadout restored');
  ok(!m.CrownLegacies.isSlotted('siege_memory'), 'menu edits do not leak into a loaded run');
  // A save from before the Muster existed: no section at all.
  ok(m.SaveRegistry.loadAll({ Legacy: saved.Legacy }).ok, 'pre-Muster save loads');
  ok(m.CrownLegacies.isSlotted('siege_memory'), 'pre-Muster save uses the menu loadout');
}

// --- Legacy: one write per wave, and breaches are not shown as losses
{
  const m = boot({ [LEGACY]: {} });
  m.Legacy.onRunStart({ difficulty: 'normal' });
  const writes = m.counts.set;
  for (let i = 0; i < 200; i++) m.Legacy.recordKill('archer', 'goblin');
  for (let i = 0; i < 20; i++) m.Legacy.recordDeploy('archer');
  ok(m.counts.set === writes, '200 kills and 20 deploys write nothing');
  m.Legacy.onWaveComplete(1, {});
  ok(m.counts.set === writes + 1, 'wave end writes once');
  ok(JSON.parse(m.store.get(LEGACY)).totalKills === 200, 'kills are in the written record');
  m.Legacy.recordKill('archer', 'goblin');
  m.Legacy.flush();
  ok(JSON.parse(m.store.get(LEGACY)).totalKills === 201, 'flush writes pending kills');

  m.Legacy.onGameEnd(false, { wave: 7, kills: 30, breaches: 4, playerDeaths: 2 });
  const text = m.Legacy.getLegacyEntries().find((e) => e.name === 'Last After-Action').body;
  ok(/4 breaches, 2 soldiers lost/.test(text), `after-action separates breaches: ${text}`);
  const old = m.Legacy.formatLastRun({
    victory: false,
    difficulty: 'normal',
    wave: 5,
    kills: 9,
    misses: 3,
  });
  ok(!/lost|losses/.test(old), 'old record without a losses count shows none');
}

process.exit(failures() ? 1 : 0);
