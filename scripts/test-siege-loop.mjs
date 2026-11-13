/**
 * Siege loop: line-breakers run for the line, breaches count toward defeat, spoils are
 * offered every five waves, calling a wave early pays TP, and counters change damage.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed, diff = 'normal') {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(`${code}\n({ Game, SpriteGen, SiegeLoop })`, vm.createContext(sb));
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty(diff);
  api.Game.start();
  return api;
}

// --- counters and rear attacks -------------------------------------------------------
{
  const { SiegeLoop } = start(11);
  const pike = { type: 'pikeman', team: 'player', x: 0, y: 0 };
  const rider = { type: 'warg_rider', team: 'enemy', x: 0, y: -20, rotation: 90 };
  ok(SiegeLoop.counterMult(pike, rider) > 1.4, 'pikemen hit riders harder');
  ok(SiegeLoop.counterMult(rider, pike) < 1, 'riders hit pikemen softer');
  const archer = { type: 'archer', team: 'player', x: 0, y: 0 };
  ok(
    SiegeLoop.counterMult(archer, { type: 'troll', team: 'enemy' }) < 1,
    'arrows are weak against armour'
  );
  const front = SiegeLoop.modifyDamage(
    { type: 'footman', team: 'player', x: 0, y: 20 },
    rider,
    100,
    0
  );
  const rear = SiegeLoop.modifyDamage(
    { type: 'footman', team: 'player', x: 0, y: -60 },
    rider,
    100,
    0
  );
  ok(rear > front, `rear attack hits harder (${front} front, ${rear} rear)`);
}

// --- early call pays, and the preview is filled at night -------------------------------
{
  const { Game } = start(12);
  let guard = 0;
  while (Game.getState().timeOfDay !== 'night' && guard++ < 40000) Game.update();
  Game.updatePresentation?.();
  let s = Game.getState();
  if (s.wave < 1) {
    Game.beginDayPhase(true);
    guard = 0;
    while (guard++ < 60000) {
      Game.update();
      if (guard % 50 === 0) {
        Game.updatePresentation?.();
        s = Game.getState();
        if (s.timeOfDay === 'night' && s.wave >= 1) break;
      }
    }
  }
  Game.updatePresentation?.();
  s = Game.getState();
  ok(s.timeOfDay === 'night' && s.wave >= 1, `reached a night after wave ${s.wave}`);
  ok(
    /Wave \d+: about \d+ foes/.test(s.siegeLoop.preview),
    `next wave preview: ${s.siegeLoop.preview}`
  );
  const before = s.tactical;
  Game.beginDayPhase(true);
  Game.updatePresentation?.();
  const after = Game.getState().tactical;
  ok(after > before, `calling the wave early pays TP (${before} -> ${after})`);
}

// --- line-breakers appear and reach the line when nobody stops them -----------------------
// A run with no recruits can also end by elimination before anything breaches, so several
// seeds are played and at least one must show a breach.
{
  let sawRunner = false;
  let maxBreaches = 0;
  let spoilsOffered = false;
  let bestWave = 0;
  for (const seed of [13, 14, 15, 16]) {
    const { Game } = start(seed, 'normal');
    for (let t = 0; t < 60000 && Game.isPlaying(); t++) {
      Game.update();
      if (t % 60 === 0) {
        Game.updatePresentation?.();
        const s = Game.getState();
        // Spoils left unclaimed are picked automatically when the day begins, so count
        // claimed ones too: checking only the pending offer races with the dawn below.
        if (s.siegeLoop.pendingSpoils > 0 || s.siegeLoop.edicts.length > 0) spoilsOffered = true;
        if (s.timeOfDay === 'night') Game.beginDayPhase(true);
        maxBreaches = Math.max(maxBreaches, s.siegeLoop.breaches);
        if (Game.getUnitsSnapshot().some((u) => u.lineBreaker)) sawRunner = true;
      }
    }
    Game.updatePresentation?.();
    const fin = Game.getState();
    maxBreaches = Math.max(maxBreaches, fin.siegeLoop.breaches);
    if (fin.siegeLoop.pendingSpoils > 0 || fin.siegeLoop.edicts.length > 0) spoilsOffered = true;
    bestWave = Math.max(bestWave, fin.wave);
    if (sawRunner && maxBreaches > 0) break;
  }
  ok(sawRunner, 'line-breakers spawn');
  ok(maxBreaches > 0, `enemies breach an undefended line (${maxBreaches} breaches)`);
  // The wave counter reads 5 while wave 5 is still being fought; spoils come once it is cleared.
  ok(
    spoilsOffered || bestWave <= 5,
    `spoils are offered once wave 5 is cleared (best wave ${bestWave})`
  );
}

// --- Warband mode: fewer, tougher soldiers --------------------------------------------------
{
  const { sb, cvs } = boot(14);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameModes })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.GameModes.setMenuMode('warband');
  api.Game.setDifficulty('normal');
  api.Game.start();
  ok(api.SiegeLoop.isWarband(), 'Warband mode is active after starting in it');
  ok(api.SiegeLoop.deployCostMult() === 2, 'Warband doubles deploy cost');
  ok(
    Math.abs(api.SiegeLoop.deployCostMult(24) - 3.4) < 1e-9,
    'ten soldiers over the free 14 add 70% to recruit cost'
  );
  const footman = api.Game.getUnitsSnapshot().find((u) => u.type === 'footman');
  ok(
    !footman || footman.maxHp >= 160,
    `Warband soldiers are tougher (${footman?.maxHp} HP footman)`
  );
}

process.exit(failures() ? 1 : 0);
