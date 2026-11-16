/**
 * Units spawned or shoved onto one spot must spread out instead of freezing as a clump.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot, ok, failures } from './lib/harness.mjs';

const { sb, cvs } = boot(7);
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { Game, SpriteGen } = vm.runInContext(`${code}\n({ Game, SpriteGen })`, vm.createContext(sb));
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start({ creative: true });
Game.setCreativeSetting?.('unlockAll', true);
Game.creativeForceDay?.();

const cx = Game.getWorldCenter();

function spawnStack(spawn) {
  const before = new Set(Game.getUnitsSnapshot().map((u) => u.id));
  for (let i = 0; i < 5; i++) spawn(i * 0.5);
  return Game.getUnitsSnapshot()
    .filter((u) => !before.has(u.id))
    .map((u) => Game.getUnitById(u.id));
}

function minGap(units) {
  let gap = Infinity;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      gap = Math.min(gap, Math.hypot(units[i].x - units[j].x, units[i].y - units[j].y));
    }
  }
  return gap;
}

// Each stack alone: with no foe to chase, only overlap resolution can pull them apart.
const foes = spawnStack((dx) => Game.creativeSpawnEnemyAt('goblin', cx.x + dx, cx.y - 200));
ok(foes.length === 5, 'spawned a stack of five enemies');
for (let t = 0; t < 100; t++) Game.update();
ok(minGap(foes) > 6, `stacked enemies spread out (closest pair ${minGap(foes).toFixed(1)}px)`);

Game.applyCheatEffect('clear_enemies');
const men = spawnStack((dx) => Game.creativeSpawnPlayerAt('footman', cx.x + dx, cx.y + 40));
ok(men.length === 5, 'spawned a stack of five soldiers');
for (let t = 0; t < 100; t++) Game.update();
ok(minGap(men) > 6, `stacked soldiers spread out (closest pair ${minGap(men).toFixed(1)}px)`);

process.exit(failures() ? 1 : 0);
