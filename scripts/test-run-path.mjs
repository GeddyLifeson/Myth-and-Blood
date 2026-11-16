/**
 * The chosen run path (RunPath), Honours, the foundational tally, the retired layer
 * aliases, and old saves that carry the retired sections.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';
import { bootGame } from './lib/save-test-kit.mjs';

const FILES = [
  'foundational-medieval-layer.js',
  'eternal-path-framework.js',
  'ascension-system.js',
  'martial-path-evolution.js',
  'arcane-path-evolution.js',
  'tech-path-evolution.js',
  'mythic-path-evolution.js',
  'hybrid-power-fantasy.js',
  'thematic-era-synergies.js',
];

function loadModules() {
  const store = new Map();
  const sb = {
    Math,
    Object,
    Array,
    Set,
    Map,
    JSON,
    Number,
    String,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    isCompanyHeroUnit: (t) => t === 'tavish_coalheart',
    isChampionUnit: () => false,
    GameState: { wave: 1, units: [], creativeMode: false },
  };
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n'), ctx);
  return sb;
}

const g = loadModules();
const { RunPath, Honours, FoundationalMedievalLayer: FML, GameState } = g;
const msgs = [];
const ctx = (wave, units = GameState.units) => ({
  wave,
  units,
  showMessage: (m) => msgs.push(m),
  addHighlight: () => {},
});

ok(g.EternalPathFramework === RunPath, 'EternalPathFramework is an alias of RunPath');
ok(g.AscensionSystem === Honours, 'AscensionSystem is an alias of Honours');
for (const n of ['MartialPathEvolution', 'HybridPowerFantasy', 'ThematicEraSynergies']) {
  ok(g[n].formatHudLine() === '' && g[n].getStateSnapshot() === null, `${n} is a silent alias`);
}

// --- Choice moment ---------------------------------------------------------------------
RunPath.resetRun();
GameState.wave = 3;
const early = RunPath.getHud(3);
ok(early.locked && /wave 5/i.test(early.title), 'before wave 5 the chip is greyed with the reason');
ok(!RunPath.choose('martial', { wave: 3 }).ok, 'cannot choose before wave 5');

const foot = { id: 1, type: 'footman', team: 'player', hp: 100, maxHp: 100, damage: 10 };
const mage = { id: 2, type: 'mage', team: 'player', hp: 50, maxHp: 50, damage: 20 };
GameState.units = [foot, mage];
GameState.wave = 5;
RunPath.onWaveStart(5, ctx(5));
ok(RunPath.getHud(5).pending, 'at wave 5 the chip asks for a choice');
ok(RunPath.choose('martial', { wave: 5 }).ok, 'martial chosen at wave 5');
ok(!RunPath.choose('arcane', { wave: 5 }).ok, 'the pick lasts the run');
ok(
  foot.maxHp === 110 && foot.hp === 110,
  'a footman already on the field gets step 1 (+10% health)'
);
ok(mage.maxHp === 50 && mage.damage === 20, 'a mage is not on the martial path');

// --- Steps through wave 40, reaching old and new soldiers alike ------------------------
RunPath.onWaveStart(12, ctx(12));
ok(foot.damage === 11, 'step 2 at wave 12 reaches the wave-5 footman (+10% damage)');
const late = { id: 3, type: 'archer', team: 'player', hp: 80, maxHp: 80, damage: 10 };
GameState.units.push(late);
RunPath.applyUnit(late);
ok(late.maxHp === 88 && late.damage === 11, 'a recruit at wave 12 gets the same two steps');
RunPath.applyUnit(late);
ok(late.maxHp === 88, 'applying twice does not stack');
for (const w of [20, 30, 40]) RunPath.onWaveStart(w, ctx(w));
// Health steps 10+10+15 = +35%, damage 10+10 = +20%.
ok(foot.maxHp === 135 && foot.damage === 12, 'all five steps by wave 40 on the oldest soldier');
ok(late.maxHp === 108, 'and on the later recruit');
const hud = RunPath.getHud(40);
ok(hud.text === 'Martial 5/5', `chip text: ${hud.text}`);
ok(
  hud.title.includes('Iron Ranks') && hud.title.includes('+35% health, +20% damage'),
  'tooltip lists every step and the exact total'
);
ok(FML.hasCrystallizedPath('longbow_legacy'), 'finishing martial crystallizes its Crown seed');

// --- Foundational tally still feeds the tech tree root ---------------------------------
FML.resetRun();
FML.onRunStart({ creative: false });
for (let i = 0; i < 5; i++) FML.recordDeploy('mage', 10);
ok(FML.getRunSnapshot().leading === 'arcane_dominion', 'tally still names the leading culture');
ok(FML.getRunModifiers(10).archerDmgMult === 1, 'tally grants no hidden battle bonus');

// --- Honours ---------------------------------------------------------------------------
Honours.resetRun();
const vet = { id: 10, type: 'footman', team: 'player', hp: 100, x: 0, y: 0, vetTier: 1 };
const rook = { id: 11, type: 'footman', team: 'player', hp: 100, x: 50, y: 0, vetTier: 0 };
const far = { id: 12, type: 'footman', team: 'player', hp: 100, x: 900, y: 0, vetTier: 0 };
GameState.units = [vet, rook, far];
ok(Honours.getOffer(vet) === null, 'no honour before a boss falls');
Honours.onWaveStart(11, ctx(11));
ok(Honours.getOffer(vet).pending === 1, 'one honour after the wave 10 boss');
const rookOffer = Honours.getOffer(rook);
ok(
  rookOffer.options.every((o) => !o.enabled && /veteran/i.test(o.reason)),
  'a recruit sees the honours greyed with the reason'
);
ok(!Honours.give(rook, 'captain').ok, 'a recruit cannot be honoured');
ok(Honours.give(vet, 'captain', ctx(11)).ok, 'a veteran becomes Captain');
ok(Honours.getOffer(vet) === null, 'the honour is spent');
ok(Honours.getDisplayTitle(vet).startsWith('Captain'), 'his name carries the honour');
ok(Honours.getDamageMult(rook) === 1.1, 'a footman near the Captain hits 10% harder');
ok(Honours.getDamageMult(far) === 1, 'one far away does not');
vet.hp = 0;
ok(Honours.getDamageMult(rook) === 1, 'the aura ends when he dies');
msgs.length = 0;
Honours.onWaveStart(12, ctx(12));
ok(
  msgs.some((m) => /fallen/.test(m)) && Honours.getStateSnapshot().holders.length === 0,
  'the honour dies with him'
);

// --- Saves: old sections migrate, new state round-trips --------------------------------
const game = bootGame(5, { names: ['RunPath', 'Honours', 'RenamedIds'] });
const old = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'saves', 'v3-old-ids.json'),
    'utf8'
  )
);
ok(old.snap.modules.EternalPathFramework.v === 1, 'fixture carries the old v1 path section');
ok(game.Game.importGameState(old.snap) === true, 'save with the retired sections loads');
ok(game.RunPath.getStateSnapshot().chosen === null, 'an old run gets the path choice');
ok(game.Honours.getStateSnapshot().pending === 0, 'old Legacy Points migrate to no honours');

game.GS.wave = 6;
ok(game.RunPath.choose('arcane', { wave: 6 }).ok, 'choose a path in the loaded run');
const soldier = game.GS.units.find((u) => u.team === 'player' && u.hp > 0);
soldier.vetTier = 2;
game.Honours.onWaveStart(11, { units: game.GS.units });
ok(game.Honours.give(soldier, 'old_hand').ok, 'honour a soldier in the loaded run');
const snap = JSON.parse(JSON.stringify(game.Game.exportGameState()));
ok(snap.modules.EternalPathFramework.v === 2, 'saved at section version 2');
const fresh = bootGame(9, { names: ['RunPath', 'Honours'] });
ok(fresh.Game.importGameState(snap) === true, 'the new save loads in a fresh game');
ok(fresh.RunPath.getStateSnapshot().chosen === 'arcane', 'the chosen path survives save and load');
const back = fresh.GS.units.find((u) => u.id === soldier.id);
ok(back?.honour === 'old_hand', 'the honour survives save and load');
ok(fresh.Honours.getStateSnapshot().holders.length === 1, 'and the holder list with it');

if (failures()) {
  console.error(`\n${failures()} test(s) failed`);
  process.exit(1);
}
console.log('\nAll run path tests passed');
