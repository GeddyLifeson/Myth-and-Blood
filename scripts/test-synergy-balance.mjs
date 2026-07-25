/**
 * Smoke tests for crossover synergy diminishing returns and faction weaknesses.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadFactionDepth() {
  const bundle = readFileSync(join(JS, 'game-data-bundle.js'), 'utf8');
  const crossover = readFileSync(join(JS, 'crossover.js'), 'utf8');
  const depth = readFileSync(join(JS, 'faction-depth.js'), 'utf8');
  const sb = {
    Math,
    Object,
    Array,
    Set,
    Map,
    JSON,
    localStorage: { getItem: () => null },
    AudioEngine: { SFX: {} },
    FloatingText: { status: () => {} },
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(bundle, ctx);
  vm.runInContext(
    `const UnitDefs = GameDataBundle.units;
     const BuildDefs = GameDataBundle.buildings;
     const EnemyDefs = GameDataBundle.enemies;
     const GameData = { synergies: GameDataBundle.synergies || [] };`,
    ctx
  );
  vm.runInContext(crossover, ctx);
  vm.runInContext(
    `CrossoverDefs.baki_hanma = { ...(CrossoverDefs.baki_hanma || {}), faction: 'baki' };
     function getCrossoverDef(type) { return CrossoverDefs[type]; }`,
    ctx
  );
  return { FD: vm.runInContext(`${depth}\nFactionDepth`, ctx), sb: ctx };
}

const { FD, sb } = loadFactionDepth();
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(FD.stackSynergyBonuses([0.15, 0.1]) < 0.25, 'melee synergies diminish instead of stacking linearly');
ok(
  Math.abs(FD.stackSynergyBonuses([0.15, 0.1]) - (0.15 + 0.1 * 0.72)) < 0.001,
  'second synergy applies at decay rate'
);

const baki = {
  team: 'player',
  hp: 100,
  maxHp: 100,
  type: 'baki_hanma',
  isCrossover: true,
  damage: 40,
  projectile: false,
};
const harpy = { team: 'enemy', hp: 80, maxHp: 80, type: 'harpy', flying: true };
const ranged = { team: 'enemy', hp: 80, maxHp: 80, type: 'archer', combatType: 'ranged', projectile: true };

const vsFly = FD.applyWeaknessDealt(baki, harpy, 100);
ok(vsFly < 100, 'baki deals less damage vs flyers');

const vsGround = FD.applyWeaknessDealt(baki, { team: 'enemy', hp: 80, maxHp: 80, type: 'orc' }, 100);
ok(vsGround === 100, 'baki weakness does not nerf vs ground melee');

const taken = FD.modifyDamageTaken(baki, ranged, 50);
ok(taken > 50, 'baki takes extra damage from ranged pressure');

const soupUnit = { team: 'player', hp: 100, isCrossover: true, type: 'op_0' };
FD.applyFieldBalance(soupUnit, 4, 2, 4);
ok(soupUnit.factionSoupMult < 1, 'four-faction soup applies combat logistics tax');

const martialSyn = [
  { bonus: { meleeDmg: 0.15 } },
  { bonus: { meleeDmg: 0.1 } },
  { bonus: { meleeDmg: 0.08 } },
];
const meleeUnit = { team: 'player', hp: 100, isCrossover: true, type: 'baki_hanma', projectile: false };
FD.applySynergyToUnit(meleeUnit, martialSyn);
ok(meleeUnit.synergyMelee < 0.33, 'triple melee synergy uses diminishing returns');

const audit = FD.auditFairRepresentation();
ok(audit.ok, `audit passes: ${audit.issues.join('; ') || 'clean'}`);

process.exit(failed ? 1 : 0);