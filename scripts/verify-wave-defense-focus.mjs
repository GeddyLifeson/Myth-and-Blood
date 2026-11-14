/**
 * Expanding battlefield (all sides) + no enemy buildings + progressive attack flanks.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL:', m);
    failed++;
  } else console.log('OK:', m);
}

// Extract size helpers from units.js without running full file (BuildDefs deps).
const unitsSrc = readFileSync(join(root, 'js/units.js'), 'utf8');
const extract = (name) => {
  const re = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`);
  const m = unitsSrc.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return m[0];
};

const prelude = `
const BASE_FIELD_W = 400;
const BASE_FIELD_H = 600;
const MAP_EXPAND_EVERY = 10;
const ACADEMY_MAP_TIERS = 10;
const MAP_EXPAND_W = 90;
const MAP_EXPAND_H = 110;
const ACADEMY_ERA_WAVE = 100;
const RTS_ERA_WAVE = 200;
const RTS_MAP_EXPAND_W = 180;
const RTS_MAP_EXPAND_H = 220;
const ATTACK_SIDES = ['north'];
function academyEase() { return 1; }
function rtsMapBlend() { return 1; }
`;
const sb = { Math, console };
vm.createContext(sb);
vm.runInContext(
  prelude +
    extract('getTerritoryTier') +
    '\n' +
    extract('getMapExpandTier') +
    '\n' +
    extract('getWorldSize') +
    '\n' +
    extract('isEnemyRtsEra') +
    '\n' +
    extract('getUnlockedAttackSides') +
    '\n; this.getWorldSize=getWorldSize; this.getTerritoryTier=getTerritoryTier; this.getMapExpandTier=getMapExpandTier; this.isEnemyRtsEra=isEnemyRtsEra; this.getUnlockedAttackSides=getUnlockedAttackSides;',
  sb
);

const s1 = sb.getWorldSize(1);
const s10 = sb.getWorldSize(10);
const s20 = sb.getWorldSize(20);
const s200 = sb.getWorldSize(200);
ok(s1.w === 400 && s1.h === 600, 'wave 1 map is base field');
ok(s10.w === s1.w && s10.h === s1.h, 'wave 10 is the same field');
ok(s20.w === s1.w && s20.h === s1.h, 'wave 20 is the same field');
ok(s200.w === s1.w && s200.h === s1.h, 'wave 200 is the same field');
ok(sb.getUnlockedAttackSides(1).join() === 'north', 'early waves come from the top edge');
ok(sb.getUnlockedAttackSides(75).join() === 'north', 'wave 75 comes from the top edge');
ok(sb.getUnlockedAttackSides(500).join() === 'north', 'late game comes from the top edge');
ok(sb.isEnemyRtsEra(250) === false, 'enemy RTS era off');

const game = readFileSync(join(root, 'js/game.js'), 'utf8');
ok(
  /function tryPlaceEnemyBuilding[\s\S]{0,120}return false/.test(game),
  'tryPlaceEnemyBuilding no-ops'
);
ok(
  /function bootstrapEnemyEconomyForWave[\s\S]{0,80}return;/.test(game),
  'bootstrapEnemyEconomy no-ops'
);
ok(/function updateEnemyRTS\(\)[\s\S]{0,40}return;/.test(game), 'updateEnemyRTS no-ops');
ok(
  /function allowsCampaignEconomyVictory[\s\S]{0,120}return false/.test(game),
  'no economy victory'
);
ok(/planWaveSectors/.test(game), 'nightfall rolls the entry sectors');
ok(/assignWaveSectors/.test(game), 'dawn gives every queued enemy a sector');
ok(!/populateNewTerritory|syncMapGrowth/.test(game), 'no map growth code is left');

const modes = readFileSync(join(root, 'js/game-modes.js'), 'utf8');
ok(
  /function allowsEconomyVictory[\s\S]{0,40}return false/.test(modes),
  'modes: no economy victory'
);

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nWave-defense focus checks passed.');
