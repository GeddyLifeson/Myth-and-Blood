/**
 * A routed soldier walks off the bottom of the field and is gone, even shoulder to shoulder
 * with another runner. Crowd separation used to clamp both back inside the field every tick,
 * so they stood at the edge for good and a run whose last soldiers they were never ended.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb, cvs } = boot(5);
const api = vm.runInContext(`${code}\n({ Game, SpriteGen, GameState })`, vm.createContext(sb));
api.SpriteGen.prewarmCache = () => {};
api.Game.init(cvs);
api.Game.setDifficulty('normal');
api.Game.start({ creative: true });
const { Game, GameState: GS } = api;
Game.creativeClearDecorations();
const x = GS.worldW / 2;
for (const dx of [0, 1, 2]) Game.creativeSpawnPlayerAt('footman', x + dx, GS.worldH - 40);
const runners = GS.units.filter(
  (u) => u.team === 'player' && u.type === 'footman' && u.y > GS.worldH - 60
);
ok(runners.length === 3, `three footmen stand together at the bottom (${runners.length})`);
for (const u of runners) {
  u.fleeing = true;
  u.fleeTicks = 0;
  u.fledBattle = true;
}
const ids = runners.map((u) => u.id);
const standing = () => GS.units.filter((u) => ids.includes(u.id) && u.hp > 0);
for (let t = 0; t < 600 && standing().length; t++) Game.update();
ok(
  standing().length === 0,
  `every runner leaves the field (${
    standing()
      .map((u) => `still at y ${Math.round(u.y)}`)
      .join(', ') || 'all gone'
  })`
);

process.exit(failures() ? 1 : 0);
