/**
 * Smoke tests for Spatial quadtree (units, hazards) + static grid.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const code = readFileSync(join(JS, 'spatial.js'), 'utf8');
const sb = { Math, Object, Array, Map, Set };
sb.window = sb;
sb.globalThis = sb;

const { Spatial } = vm.runInContext(`${code}\n({ Spatial })`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const W = 1200;
const H = 900;
Spatial.init(W, H);

const units = [
  { id: 'u1', x: 100, y: 100, hp: 50, radius: 14, team: 'player' },
  { id: 'u2', x: 105, y: 102, hp: 50, radius: 14, team: 'player' },
  { id: 'u3', x: 500, y: 400, hp: 50, radius: 14, team: 'enemy' },
  { id: 'u4', x: 800, y: 700, hp: 0, radius: 14, team: 'enemy' },
];
Spatial.rebuildDynamic(units);

const nearPlayer = Spatial.queryRadius(
  100,
  100,
  40,
  (e) => e.kind === 'unit' && e.ref?.team === 'player'
);
ok(nearPlayer.length === 2, 'quadtree finds nearby player units');
ok(!nearPlayer.some((u) => u.id === 'u4'), 'dead units excluded from index');

const foes = Spatial.queryRadius(500, 400, 30, (e) => e.kind === 'unit' && e.ref?.team === 'enemy');
ok(foes.length === 1 && foes[0].id === 'u3', 'quadtree finds enemy at distance');

let collisionHits = 0;
Spatial.forUnitsInRadius(103, 101, 20, () => {
  collisionHits++;
});
ok(collisionHits === 2, 'forUnitsInRadius for collision');

const hazards = [
  { id: 'h1', x: 200, y: 200, radius: 40, damage: 1, slow: 0.5, tickInterval: 10, type: 'test' },
  { id: 'h2', x: 900, y: 100, radius: 30, damage: 1, slow: 1, tickInterval: 10, type: 'test' },
];
Spatial.rebuildHazards(hazards);
ok(Spatial.getMaxHazardRadius() === 40, 'max hazard radius tracked');

const inside = Spatial.queryHazardsAt(210, 205);
ok(inside.length === 1 && inside[0].id === 'h1', 'hazard point query inside zone');

const outside = Spatial.queryHazardsAt(250, 250);
ok(outside.length === 0, 'hazard point query outside all zones');

const mixed = Spatial.queryRadius(200, 200, 50, (e) => e.kind === 'hazard');
ok(mixed.length === 1, 'queryRadius includes hazard layer');

if (failed) {
  console.error(`\n${failed} spatial test(s) failed`);
  process.exit(1);
}
console.log('\nAll spatial tests passed.');