/**
 * Smoke tests for Ascension System — era transitions and legacy ascensions.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

function loadAscension(extra = {}) {
  const src = readFileSync(join(JS, 'ascension-system.js'), 'utf8');
  const sb = {
    Math,
    Object,
    Array,
    Set,
    JSON,
    Date,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    MAX_VETERAN_TIER: 6,
    isValidHonorName: (n) => !!n && n.length > 2,
    ...extra,
  };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(`${src}\n({ AscensionSystem })`, ctx);
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const { AscensionSystem } = loadAscension();

AscensionSystem.resetRun();
AscensionSystem.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
const snap150 = AscensionSystem.getStateSnapshot({ wave: 150 });
ok(snap150.legacyPoints >= 18, 'kingdom era grants legacy points');
ok(snap150.era === 'kingdom', 'kingdom era active at 150');

const footman = {
  id: 'u1',
  team: 'player',
  type: 'footman',
  hp: 100,
  maxHp: 100,
  damage: 20,
  range: 40,
  maxMorale: 30,
  morale: 30,
  vetTier: 4,
};
const offer = AscensionSystem.getUnitAscensionOffer(footman, 150);
ok(offer?.stage?.id === 'paragon_realm', 'vet 4 footman offered paragon ascension');

const ascend1 = AscensionSystem.tryAscendUnit(footman, 150, { showMessage: () => {}, addHighlight: () => {} });
ok(ascend1.ok, 'paragon ascension succeeds');
ok(footman.ascensionStageId === 'paragon_realm', 'footman stage set');
ok(footman.damage > 20, 'paragon boosts damage');
ok(AscensionSystem.getDisplayTitle(footman)?.includes('Paragon'), 'display title shows paragon');

const blocked = AscensionSystem.tryAscendUnit(footman, 150, { showMessage: () => {}, addHighlight: () => {} });
ok(!blocked.ok, 'cannot ascend same stage twice');

AscensionSystem.resetRun();
AscensionSystem.grantLegacyPoints(40, 'test');
AscensionSystem.onWaveStart(150, { wave: 150, units: [], showMessage: () => {}, addHighlight: () => {} });
AscensionSystem.tryAscendUnit(footman, 150, { showMessage: () => {}, addHighlight: () => {} });
AscensionSystem.onWaveStart(400, { wave: 400, units: [], showMessage: () => {}, addHighlight: () => {} });
const snap400 = AscensionSystem.getStateSnapshot({ wave: 400 });
ok(snap400.legacyPoints >= 28, 'galactic era grants more legacy points');

const galOffer = AscensionSystem.getUnitAscensionOffer(footman, 400);
ok(galOffer?.stage?.id === 'stellar_warden', 'paragon offered stellar warden at 400');
const ascend2 = AscensionSystem.tryAscendUnit(footman, 400, { showMessage: () => {}, addHighlight: () => {} });
ok(ascend2.ok, 'stellar warden ascension succeeds');
ok(footman.ascensionWeapon === 'Plasma Halberd', 'stellar warden has plasma halberd');
ok(footman.range > 40, 'stellar warden gains range');

const wall = { owner: 'player', type: 'wall', complete: true, hp: 200, maxHp: 200 };
const wallOffer = AscensionSystem.getBuildingAscensionOffer(wall, 150);
ok(wallOffer?.stage?.id === 'bulwark_ages', 'wall offered bulwark ascension');
AscensionSystem.resetRun();
AscensionSystem.grantLegacyPoints(20, 'test');
const wallAsc = AscensionSystem.tryAscendBuilding(wall, 150, { showMessage: () => {} });
ok(wallAsc.ok, 'bulwark ascension succeeds');
ok(wall.maxHp > 200, 'bulwark increases wall HP');

const intel = AscensionSystem.formatIntelNote({ wave: 155 });
ok(intel.includes('legacy') || intel.includes('ascended'), 'intel note mentions ascension');

ok(AscensionSystem.UNIT_CHAINS.footman.kingdom.label === 'Paragon of the Realm', 'footman kingdom label');
ok(AscensionSystem.UNIT_CHAINS.footman.galactic.label === 'Stellar Warden', 'footman galactic label');

process.exit(failed > 0 ? 1 : 0);