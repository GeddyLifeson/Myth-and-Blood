/**
 * Ground: claiming a plot on foot and by burning a camp, building only on held ground, the
 * settlement ranks and their pay, losing an undefended plot, save and load, old saves.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, GameState, WarCamps, Ground, SaveFormat })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}
const mine = (GS) => GS.units.filter((u) => u.team === 'player' && u.hp > 0);
function deploy(api, type, x, y) {
  const GS = api.GameState;
  GS.tactical = Math.max(GS.tactical, 300);
  const before = new Set(mine(GS).map((u) => u.id));
  api.Game.selectDeploy(type);
  api.Game.handleClick(x, y);
  return mine(GS).find((u) => !before.has(u.id));
}
function toNight(api) {
  const { Game, GameState: GS } = api;
  for (let guard = 0; guard < 4000 && GS.timeOfDay !== 'night'; guard++) {
    GS.spawnQueue.length = 0;
    for (const u of GS.units) if (u.team === 'enemy') u.hp = 0;
    Game.update();
  }
  return GS.timeOfDay === 'night';
}
const plot = (G, id) => G.getSnapshot().find((p) => p.id === id);
/** A bare context for driving Ground directly on a 400 by 600 field. */
function stub(units, wave = 5) {
  const said = [];
  return {
    tick: 0,
    wave,
    worldW: 400,
    worldH: 600,
    units,
    said,
    showMessage: (t) => said.push(t),
  };
}
function tickGround(G, ctx, ticks) {
  for (let i = 0; i < ticks; i++) {
    ctx.tick++;
    G.update(ctx);
  }
}
const man = (x, y, team = 'player', type = 'footman') => ({ x, y, team, type, hp: 10 });

// --- 1. the rules, driven directly -------------------------------------------------------
{
  const { Ground: G } = start(3);
  G.resetRun();
  ok(G.income() === 0 && G.getSnapshot().every((p) => !p.held), 'a run starts with home only');
  ok(G.canBuildAt(200, 500, 400, 600).ok, 'home ground can be built on');
  const no = G.canBuildAt(60, 300, 400, 600);
  ok(
    !no.ok && /Left field/.test(no.reason) && /3 soldiers/.test(no.reason),
    'a field cannot, and says how to take it'
  );
  ok(
    /next to it|war camp/.test(G.canBuildAt(60, 60, 400, 600).reason),
    'a march needs the ground next to it first'
  );

  const two = stub([man(50, 300), man(60, 300)]);
  tickGround(G, two, G.CLAIM_TICKS + 50);
  ok(!G.isHeld('left_mid'), 'two soldiers do not claim a plot');

  const three = stub([man(50, 300), man(60, 300), man(70, 300), man(80, 310, 'player', 'builder')]);
  tickGround(G, three, G.CLAIM_TICKS / 2);
  ok(
    !G.isHeld('left_mid') && plot(G, 'left_mid').meter > 0.3,
    'three soldiers raise the banner over time'
  );
  three.units.push(man(90, 320, 'enemy', 'goblin'));
  tickGround(G, three, 100);
  ok(plot(G, 'left_mid').meter < 0.5, 'an enemy in the plot stops the claim');
  three.units.pop();
  tickGround(G, three, G.CLAIM_TICKS + 50);
  ok(
    G.isHeld('left_mid') && three.said.some((t) => /Left field claimed/.test(t)),
    'the plot is claimed'
  );
  ok(G.canBuildAt(60, 300, 400, 600).ok, 'and can be built on');
  ok(G.income() === 0, 'a fresh claim pays nothing yet');

  const far = stub([man(340, 60), man(350, 60), man(360, 60)]);
  tickGround(G, far, G.CLAIM_TICKS + 50);
  ok(!G.isHeld('right_front'), 'a march that touches no held ground cannot be claimed on foot');
  const near = stub([man(40, 60), man(50, 60), man(60, 60)]);
  tickGround(G, near, G.CLAIM_TICKS + 50);
  ok(G.isHeld('left_front'), 'the march above a held field can');

  // Claimed on wave 5: the night of wave 5 does not count, the night of wave 6 does.
  G.onNightBegin(stub([], 5));
  ok(G.rankOf('left_mid') === 0, 'the night it was claimed is not a day stood');
  const night = stub([], 6);
  G.onNightBegin(night);
  ok(
    G.rankOf('left_mid') === 1 && plot(G, 'left_mid').rankName === 'Hamlet',
    'after one day it is a hamlet'
  );
  ok(G.income() === 3, 'a hamlet field pays 1 and a hamlet march pays 2');
  ok(
    night.said.some((t) => /Hamlet/.test(t)),
    'and the player is told'
  );
  for (let w = 7; w < 7 + 14; w++) G.onNightBegin(stub([], w));
  ok(
    plot(G, 'left_mid').rankName === 'Metropolis' && plot(G, 'left_mid').income === 5,
    'fifteen days make a metropolis that pays 5'
  );

  const held = stub([man(50, 300), man(120, 310, 'enemy', 'goblin')]);
  tickGround(G, held, G.LOSE_TICKS * 2);
  ok(G.isHeld('left_mid'), 'one soldier in the plot holds it against the host');
  const empty = stub([man(50, 300, 'player', 'builder'), man(120, 310, 'enemy', 'goblin')]);
  tickGround(G, empty, G.LOSE_TICKS + 20);
  ok(
    !G.isHeld('left_mid') && plot(G, 'left_mid').days === 0,
    'enemies alone in it take it, and the settlement is gone'
  );
  ok(
    empty.said.some((t) => /Left field is lost and its metropolis/.test(t)),
    'with a message that says why'
  );
  ok(!G.canBuildAt(60, 300, 400, 600).ok, 'lost ground cannot be built on');

  ok(
    G.onCampDestroyed(350, 55, stub([])) && G.isHeld('right_front'),
    'a burned camp hands over its plot'
  );
}

// --- 2. in the game -----------------------------------------------------------------------
{
  const api = start(11);
  const { Game, GameState: GS, Ground: G } = api;
  for (let i = 0; i < 10; i++) Game.update();
  ok(toNight(api), 'the game reaches a night');
  const W = GS.worldW;
  const H = GS.worldH;
  const base = Game.getState().tpPerRound;

  const squad = [0, 1, 2].map((i) => deploy(api, 'footman', 470 + i * 26, 540));
  ok(squad.every(Boolean), 'three soldiers are deployed');
  deploy(api, 'builder', 560, 540);
  // Clicks are in screen space: read the camera off a soldier deployed at a known click.
  const at = { x: squad[0].x, y: squad[0].y };
  const sx = (wx) => 470 + (wx - at.x) * GS.viewScale;
  const sy = (wy) => 540 + (wy - at.y) * GS.viewScale;
  GS.tactical = 300;
  Game.selectBuild('wall');
  const walls = () => GS.buildings.filter((b) => b.type === 'wall' && b.owner === 'player').length;
  Game.handleClick(sx(W * 0.5), sy(H * 0.45));
  for (let i = 0; i < 600; i++) Game.update();
  ok(walls() === 0, 'a wall is refused on ground not held');

  for (let i = 0; i < G.CLAIM_TICKS + 60 && !G.isHeld('centre_mid'); i++) {
    squad.forEach((u, n) => {
      u.x = W * 0.45 + n * 12;
      u.y = H * 0.5;
    });
    Game.update();
  }
  ok(G.isHeld('centre_mid'), 'three soldiers standing in the centre field claim it');
  GS.tactical = 300;
  if (GS.selectedBuild !== 'wall') Game.selectBuild('wall');
  Game.handleClick(sx(W * 0.5), sy(H * 0.45));
  for (let i = 0; i < 3000 && walls() === 0; i++) Game.update();
  ok(walls() === 1, 'and now the wall is accepted there and a builder raises it');

  const camp = Game.warCampHooks.raise({ kind: 'forge', sector: 'left' });
  const b = GS.buildings.find((x) => x.id === camp.id);
  Game.warCampHooks.hit(b, 99999);
  ok(G.isHeld('left_front'), 'burning a war camp claims the left march');

  for (const p of G.getSnapshot()) if (p.held) GS.wave++;
  G.onNightBegin({ wave: GS.wave, showMessage() {} });
  ok(Game.getState().tpPerRound === base + 3, 'held settlements add to the TP each wave');

  GS.buildings = GS.buildings.filter((x) => !api.WarCamps.isCamp(x));
  api.WarCamps.resetRun();
  GS.nextWavePlan = null;
  const sectors = new Set();
  for (let i = 0; i < 6; i++) {
    sectors.add(Game.warCampHooks.raise({ kind: 'drums', silent: true })?.sector);
    GS.buildings = GS.buildings.filter((x) => !api.WarCamps.isCamp(x));
    api.WarCamps.resetRun();
  }
  ok(
    sectors.size === 1 && sectors.has('left'),
    'with every sector open, the host camps on the held top plot'
  );
  GS.buildings = GS.buildings.filter((x) => !api.WarCamps.isCamp(x));
  api.WarCamps.resetRun();

  const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
  G.resetRun();
  ok(Game.importGameState(snap) !== false, 'the save loads');
  ok(
    G.isHeld('centre_mid') && G.isHeld('left_front') && G.rankOf('centre_mid') === 1,
    'held ground and its rank come back'
  );

  // A save from before Ground: no section, but a wall stands in the centre field.
  const old = JSON.parse(JSON.stringify(snap));
  let stripped = 0;
  (function strip(o) {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (k === 'Ground') {
        delete o[k];
        stripped++;
      } else strip(o[k]);
    }
  })(old);
  G.resetRun();
  ok(
    stripped > 0 && Game.importGameState(api.SaveFormat.seal(old)) !== false,
    'an older save without ground loads'
  );
  ok(
    G.isHeld('centre_mid') && !G.isHeld('left_front'),
    'ground under its buildings counts as held, nothing else'
  );
}

process.exit(failures() ? 1 : 0);
