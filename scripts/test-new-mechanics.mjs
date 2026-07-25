/**
 * Smoke tests for operative skill trees, biome spawn, and neutral relations.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const sb = {
  Math,
  Object,
  Array,
  Set,
  localStorage: {
    _data: {},
    getItem(k) {
      return this._data[k] ?? null;
    },
    setItem(k, v) {
      this._data[k] = String(v);
    },
  },
  document: { getElementById: () => null, querySelectorAll: () => [] },
};
sb.window = sb;
sb.globalThis = sb;

const vmCtx = vm.createContext(sb);

function load(name, exportName) {
  const code = readFileSync(join(JS, name), 'utf8');
  return vm.runInContext(`${code}\n${exportName}`, vmCtx);
}

const LP = load('living-planet.js', 'LivingPlanet');
load('neutral-wildlife.js', 'NeutralWildlife');
const NR = load('neutral-relations.js', 'NeutralRelations');
const BS = load('biome-spawn.js', 'BiomeSpawn');
const OST = load('operative-skill-trees.js', 'OperativeSkillTrees');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

NR.resetRun();
ok(NR.getReputation() === 0, 'neutral relations starts neutral');
NR.addReputation(30);
ok(NR.getStance().id === 'sympathetic', 'sympathetic stance at +30');
NR.onHuntPact(10, { worldW: 400, worldH: 600, rallyY: 500, hooks: {} });
ok(NR.isPactActive(11), 'hunt pact active next wave');
ok(NR.getReputation() >= 50, 'hunt pact raises reputation');

const player = { team: 'player', hp: 100, x: 100, y: 400, fleeing: false };
const enemy = { team: 'enemy', hp: 100, x: 110, y: 410, fleeing: false };
const neutral = { team: 'neutral', hp: 100, x: 105, y: 405, aggroRadius: 200, fleeing: false };
const allied = {
  team: 'neutral',
  hp: 100,
  x: 105,
  y: 405,
  aggroRadius: 200,
  alliedToPlayer: true,
  fleeing: false,
};
ok(NR.findAggroTarget(neutral, [player, enemy], 12)?.team === 'enemy', 'pact wildlife targets enemy not player');
ok(NR.findAggroTarget(allied, [player, enemy], 12)?.team === 'enemy', 'allied wildlife targets enemy');

const ctx = { worldW: 400, worldH: 600, baseW: 400, baseH: 600, territoryTier: 3, wave: 20 };
const forestBiome = LP.getBiomeAt(200, 80, ctx);
ok(['forest', 'mountains', 'plains'].includes(forestBiome), 'living planet biome resolves');

const profile = BS.getDominantProfile(ctx);
ok(profile.biome && profile.countMult >= 1, 'dominant spawn profile');
const merged = BS.mergeSpawnWeights({ goblin: 1, archer: 1 }, 20, ctx);
ok(merged.weights.goblin >= 1, 'biome merge preserves weights');
const biased = BS.biasSpawnPosition({ x: 200, y: 10 }, 'north', 400, 600, ctx);
ok(biased.y > 10, 'spawn position biased by biome depth');

OST.resetRun();
OST.grantSkillPoint('ultimis', 2);
ok(OST.getAvailablePoints('ultimis') >= 1, 'skill tree budget readable');
const buy = OST.purchaseNode('ultimis', 'frag_drill');
ok(buy.ok, 'purchase first skill node');
const unit = {
  team: 'player',
  isCrossover: true,
  type: 'dempsey',
  maxHp: 100,
  hp: 100,
  maxMorale: 20,
  morale: 20,
  projectile: null,
  combatType: 'melee',
};
vmCtx.getCrossoverDef = () => ({ faction: 'ultimis' });
OST.applyToUnit(unit, [unit]);
ok((unit.skillAcc || 0) >= 6, 'skill tree applies accuracy bonus');
const dmg = OST.modifyDamage({ ...unit, skillMelee: 0.1, projectile: null, combatType: 'melee' }, {}, 100);
ok(dmg === 110, 'skill melee modifier');

ok(Object.keys(OST.FACTION_TREES).length >= 8, 'eight faction trees defined');
ok(BS.BIOME_PROFILES.forest.wildlifeMult > 1, 'forest boosts wildlife');

process.exit(failed ? 1 : 0);