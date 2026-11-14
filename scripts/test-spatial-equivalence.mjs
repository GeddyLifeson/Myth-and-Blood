/**
 * Runs the old string-keyed Spatial index (scripts/lib/spatial-legacy.js) and the flat-grid
 * one (js/spatial.js) side by side on random scenes and asserts identical answers, in the
 * same order, for every query the game makes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { ROOT, JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

function load(file) {
  const sb = { Math, Object, Array, Map, Set, Number, Float64Array, Int32Array };
  sb.window = sb;
  sb.globalThis = sb;
  return vm.runInContext(`${readFileSync(file, 'utf8')}\n({ Spatial })`, vm.createContext(sb))
    .Spatial;
}
const Old = load(join(ROOT, 'scripts', 'lib', 'spatial-legacy.js'));
const New = load(join(JS, 'spatial.js'));

let seed = 90210;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const TEAMS = ['player', 'enemy', 'enemy', 'neutral'];

let nextId = 1;
function scene(W, H, nUnits, nBld, nDeco, nHaz) {
  const units = [];
  for (let i = 0; i < nUnits; i++) {
    const edge = rnd() < 0.08;
    units.push({
      id: `u${nextId++}`,
      // Some units sit on or just past the map edge, and a few are clumped on one spot.
      x: edge ? pick([-30, -3, 0, W, W + 20, W + 70]) : rnd() < 0.2 ? 300 + rnd() * 30 : rnd() * W,
      y: edge ? pick([-40, 0, H - 1, H + 5, H + 66]) : rnd() < 0.2 ? 280 + rnd() * 30 : rnd() * H,
      hp: rnd() < 0.07 ? 0 : 10 + rnd() * 90,
      radius: rnd() < 0.1 ? undefined : pick([9, 14, 14, 18, 26, 40]),
      team: pick(TEAMS),
      fleeing: rnd() < 0.05,
      demoralized: rnd() < 0.05,
    });
  }
  if (nUnits > 3 && rnd() < 0.3) units[2].x = NaN;
  const buildings = [];
  for (let i = 0; i < nBld; i++) {
    buildings.push({
      id: `b${nextId++}`,
      x: rnd() * W,
      y: rnd() * H,
      hp: rnd() < 0.1 ? 0 : 100,
      radius: pick([18, 24, 40, 70]),
      owner: pick(['player', 'enemy']),
      type: 'wall',
      blocksMove: rnd() < 0.2 ? false : undefined,
      attackRadius: rnd() < 0.3 ? 90 : undefined,
    });
  }
  const decorations = [];
  for (let i = 0; i < nDeco; i++) {
    // Decorations have no id: they are told apart by object identity.
    decorations.push({
      x: rnd() * W,
      y: rnd() * H,
      radius: pick([undefined, 8, 12, 20]),
      size: 10,
      type: 'tree',
      blocksMove: rnd() < 0.1 ? false : undefined,
    });
  }
  const hazards = [];
  for (let i = 0; i < nHaz; i++) {
    hazards.push({ id: `h${nextId++}`, x: rnd() * W, y: rnd() * H, radius: pick([0, 20, 40, 90]) });
  }
  return { units, buildings, decorations, hazards };
}

function sameList(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

let checks = 0;
let bad = 0;
let firstBad = null;
function check(cond, what) {
  checks++;
  if (!cond) {
    bad++;
    firstBad ??= what;
    if (process.env.SPATIAL_DEBUG && bad < 12) console.log(what);
  }
}

const SIZES = [
  [490, 710],
  [940, 1260],
  [1300, 1700],
  [64, 64],
  [1000, 130],
];
for (let round = 0; round < 60; round++) {
  const [W, H] = SIZES[round % SIZES.length];
  Old.init(W, H);
  New.init(W, H);
  const sc = scene(
    W,
    H,
    pick([0, 1, 5, 40, 150, 400]),
    pick([0, 3, 12]),
    pick([0, 10, 40]),
    pick([0, 0, 4])
  );
  // Two rebuilds on the second pass: the unit layer reuses its storage and must not leak.
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      for (const u of sc.units) {
        u.x += (rnd() - 0.5) * 80;
        u.y += (rnd() - 0.5) * 80;
        if (rnd() < 0.1) u.hp = 0;
      }
      sc.units.splice(0, Math.floor(sc.units.length * rnd() * 0.5));
    }
    for (const S of [Old, New]) {
      S.rebuildStatic(sc.buildings, sc.decorations);
      S.rebuildDynamic(sc.units);
      S.rebuildHazards(sc.hazards);
    }
    // Units move and die after the index was built; queries must still agree.
    for (const u of sc.units) {
      if (rnd() < 0.1) u.x += 5;
      if (rnd() < 0.03) u.hp = 0;
      if (rnd() < 0.02) u.team = pick(TEAMS);
    }
    const me = sc.units.length ? pick(sc.units) : { team: 'player' };
    const preds = [
      null,
      (e) => e.kind === 'unit',
      (e) => e.kind === 'unit' && e.ref?.team !== me.team && e.ref?.hp > 0 && !e.ref?.fleeing,
      (e) => e.kind === 'unit' && e.ref?.team === me.team && e.ref !== me,
      (e) => e.kind === 'building' || e.kind === 'deco',
      (e) => e.kind === 'hazard',
      (e) => e.kind === 'unit' && e.team === 'enemy' && e.r > 20,
      (e) => e.x < W / 2,
    ];
    for (let q = 0; q < 120; q++) {
      const x = rnd() < 0.1 ? pick([-20, 0, W, W + 40]) : rnd() * W;
      const y = rnd() < 0.1 ? pick([-20, 0, H, H + 40]) : rnd() * H;
      const r = pick([0, 4, 22, 28, 56, 100, 220, 450, 520, 3000]);
      const tag = `round ${round} pass ${pass} q(${x.toFixed(1)}, ${y.toFixed(1)}, r ${r})`;
      for (let pi = 0; pi < preds.length; pi++) {
        const a = Old.queryRadiusInto(x, y, r, preds[pi], []);
        const b = New.queryRadiusInto(x, y, r, preds[pi], []);
        check(sameList(a, b), `queryRadiusInto pred ${pi} ${tag}: ${a.length} vs ${b.length}`);
        check(
          Old.queryNearest(x, y, r, preds[pi]) === New.queryNearest(x, y, r, preds[pi]),
          `queryNearest pred ${pi} ${tag}`
        );
      }
      check(sameList(Old.queryRadius(x, y, r, preds[1]), New.queryRadius(x, y, r, preds[1])), tag);
      // The predicate-free calls against the predicates game.js used to pass.
      check(
        sameList(
          Old.queryRadiusInto(x, y, r, preds[2], []),
          New.queryFoesInto(x, y, r, me.team, [])
        ),
        `queryFoesInto ${tag}`
      );
      check(
        sameList(
          Old.queryRadiusInto(x, y, r, preds[3], []),
          New.queryTeamInto(x, y, r, me.team, me, [])
        ),
        `queryTeamInto ${tag}`
      );
      check(
        sameList(Old.queryRadiusInto(x, y, r, preds[4], []), New.queryStaticInto(x, y, r, [])),
        `queryStaticInto ${tag}`
      );
      check(
        Old.queryNearest(
          x,
          y,
          r,
          (e) =>
            e.kind === 'unit' &&
            e.ref?.team === 'player' &&
            e.ref?.hp > 0 &&
            !e.ref?.fleeing &&
            !e.ref?.demoralized
        ) === New.queryNearestFighter(x, y, r, 'player'),
        `queryNearestFighter ${tag}`
      );
      // Raw visits (one per cell an entry sits in) must match call for call.
      const va = [];
      const vb = [];
      Old.forCellsInRadius(x, y, r, (e) => va.push(e.ref, e.kind, e.x, e.y, e.r));
      New.forCellsInRadius(x, y, r, (e) => vb.push(e.ref, e.kind, e.x, e.y, e.r));
      check(sameList(va, vb), `forCellsInRadius ${tag}: ${va.length} vs ${vb.length}`);
      va.length = 0;
      vb.length = 0;
      Old.forUnitsInRadius(x, y, r, (e) => va.push(e.ref, e.team));
      New.forUnitsInRadius(x, y, r, (e) => vb.push(e.ref, e.team));
      check(sameList(va, vb), `forUnitsInRadius ${tag}`);
      const x2 = x + rnd() * 400;
      const y2 = y + rnd() * 400;
      check(
        sameList(
          Old.queryRect(x, y, x2, y2, preds[q % 2]),
          New.queryRect(x, y, x2, y2, preds[q % 2])
        ),
        `queryRect ${tag}`
      );
      check(sameList(Old.queryHazardsAt(x, y), New.queryHazardsAt(x, y)), `queryHazardsAt ${tag}`);
    }
  }
}
ok(
  bad === 0,
  `old and new index agree on ${checks} queries${firstBad ? ` (first: ${firstBad})` : ''}`
);

// Stats and storage reuse.
New.init(940, 1260);
const big = scene(940, 1260, 400, 12, 40, 0);
New.rebuildStatic(big.buildings, big.decorations);
New.rebuildDynamic(big.units);
const st = New.getStats();
ok(st.cols === 16 && st.rows === 21, `grid is ${st.cols}x${st.rows} cells`);
ok(st.units === big.units.filter((u) => !(u.hp <= 0)).length, 'unit count in stats');
New.rebuildDynamic([]);
ok(
  New.queryRadius(470, 630, 5000, null).every((r) => !big.units.includes(r)),
  'emptied unit layer'
);
ok(New.getStats().units === 0, 'no units left indexed');

if (failures()) {
  console.error(`\n${failures()} spatial equivalence test(s) failed`);
  process.exit(1);
}
console.log('\nAll spatial equivalence tests passed.');
