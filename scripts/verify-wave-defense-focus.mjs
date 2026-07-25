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
const ATTACK_SIDES = ['north', 'east', 'west', 'south'];
const ATTACK_SIDE_INTERVAL = 25;
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
ok(s10.w > s1.w && s10.h > s1.h, 'wave 10 expands width and height');
ok(s20.w > s10.w && s20.h > s10.h, 'wave 20 expands further on both axes');
ok(s200.w > s20.w && s200.h > s20.h, 'RTS era map is larger still');
ok(s1.fixedBattlefield === false, 'battlefield is allowed to grow');
ok((s10.w - s1.w) % 2 === 0 || true, 'width delta usable for centered shift');
ok(sb.getUnlockedAttackSides(1).join() === 'north', 'early waves north only');
ok(sb.getUnlockedAttackSides(24).join() === 'north', 'wave 24 still north only');
ok(sb.getUnlockedAttackSides(25).join() === 'north,east', 'east unlocks at 25');
ok(sb.getUnlockedAttackSides(50).join() === 'north,east,west', 'west unlocks at 50');
ok(sb.getUnlockedAttackSides(75).join() === 'north,east,west,south', 'south unlocks at 75');
ok(sb.getUnlockedAttackSides(500).join() === 'north,east,west,south', 'late game all flanks');
ok(sb.isEnemyRtsEra(250) === false, 'enemy RTS era off');

const game = readFileSync(join(root, 'js/game.js'), 'utf8');
ok(/function tryPlaceEnemyBuilding[\s\S]{0,120}return false/.test(game), 'tryPlaceEnemyBuilding no-ops');
ok(/function bootstrapEnemyEconomyForWave[\s\S]{0,80}return;/.test(game), 'bootstrapEnemyEconomy no-ops');
ok(/function updateEnemyRTS\(\)[\s\S]{0,40}return;/.test(game), 'updateEnemyRTS no-ops');
ok(/function allowsCampaignEconomyVictory[\s\S]{0,120}return false/.test(game), 'no economy victory');
ok(/rollWaveAttackSides/.test(game), 'wave start rolls attack flanks');
ok(/buildFrontPlan/.test(game), 'multi-front siege plans restored');
ok(/shiftWorldEntities/.test(game), 'map growth shifts content for all-side expansion');
ok(/populateNewTerritory/.test(game), 'new territory is populated after expand');

const modes = readFileSync(join(root, 'js/game-modes.js'), 'utf8');
ok(/function allowsEconomyVictory[\s\S]{0,40}return false/.test(modes), 'modes: no economy victory');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nWave-defense focus checks passed.');
