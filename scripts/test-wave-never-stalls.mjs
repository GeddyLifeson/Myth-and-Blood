/**
 * A wave must always end. Army-only bot runs used to hang (waves 12, 15, 25) when the last
 * enemy alive was one that never advances: a Goblin Engineer or a Shaman standing where it
 * spawned. Here the last enemy of a wave is each of those in turn, then one that cannot move
 * at all, and the wave has to end every time without the player lifting a finger.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(`${code}\n({ Game, SpriteGen, GameState })`, vm.createContext(sb));
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}

/**
 * Start the next wave, replace its host with `types`, and let the game run with the garrison
 * standing at its posts. Returns how the wave went.
 */
function lastEnemies(Game, GS, types, tweak) {
  if (GS.timeOfDay === 'night') Game.beginDayPhase(true);
  const wave = GS.wave;
  for (const u of GS.units) if (u.team === 'enemy') u.hp = 0;
  GS.spawnQueue.length = 0;
  for (const t of types) GS.spawnQueue.push(t);
  let seen = null;
  let startY = null;
  let maxY = 0;
  let ticks = 0;
  for (; ticks < 12000 && GS.timeOfDay === 'day' && GS.wave === wave && Game.isPlaying(); ticks++) {
    // Soldiers hold their posts and cannot be hurt: only the enemy can end this.
    for (const u of GS.units) if (u.team === 'player') u.hp = u.maxHp;
    const foe = GS.units.find((u) => u.team === 'enemy' && u.hp > 0);
    if (foe) {
      if (!seen) {
        seen = foe.type;
        startY = foe.y;
      }
      if (tweak) tweak(foe);
      maxY = Math.max(maxY, foe.y);
    }
    Game.update();
  }
  return {
    ended: GS.timeOfDay === 'night' || GS.wave !== wave,
    ticks,
    seen,
    advanced: maxY - startY,
  };
}

{
  const { Game, GameState: GS } = start(4131);
  // Hunt off: nobody walks up the field to fetch a straggler.
  Game.orderHoldHere();

  let r = lastEnemies(Game, GS, ['goblin_engineer']);
  ok(r.seen === 'goblin_engineer', 'the last enemy of the wave is a Goblin Engineer');
  ok(r.advanced > 120, `the engineer marches down the field (${Math.round(r.advanced)} px)`);
  ok(r.ended, `the wave ends (${r.ticks} ticks)`);
  ok(
    GS.decorations.every((d) => d.type !== 'barricade'),
    'engineers still raise no barricades'
  );
  ok(
    GS.buildings.every((b) => b.owner === 'player'),
    'and build no enemy structures'
  );

  r = lastEnemies(Game, GS, ['shaman']);
  ok(r.seen === 'shaman', 'the last enemy of the wave is a Shaman');
  ok(r.advanced > 120, `the shaman marches down the field (${Math.round(r.advanced)} px)`);
  ok(r.ended, `the wave ends (${r.ticks} ticks)`);

  r = lastEnemies(Game, GS, ['goblin_engineer', 'shaman', 'shaman']);
  ok(r.ended, `engineer and two shamans together: the wave ends (${r.ticks} ticks)`);

  // An enemy that cannot move at all (wedged, pinned for good): the storm is called, nothing
  // comes of it, and the straggler quits the field.
  const pinAt = { x: null, y: null };
  r = lastEnemies(Game, GS, ['orc'], (foe) => {
    if (pinAt.x == null) {
      pinAt.x = foe.x;
      pinAt.y = foe.y;
    }
    foe.x = pinAt.x;
    foe.y = pinAt.y;
    foe.path = [];
  });
  ok(r.seen === 'orc' && r.advanced < 5, 'an orc is held fast where it spawned');
  ok(r.ended, `the wave still ends (${r.ticks} ticks)`);
  ok(r.ticks < 8000, 'and within the stall limit the honest-play bot uses (8000 ticks)');
  ok(Game.isPlaying(), 'the run goes on');

  // The rule does not fire on a host that is fighting: an ordinary wave is fought out.
  if (GS.timeOfDay === 'night') Game.beginDayPhase(true);
  const wave = GS.wave;
  let kills0 = GS.kills;
  let t = 0;
  for (; t < 12000 && GS.wave === wave && GS.timeOfDay === 'day' && Game.isPlaying(); t++) {
    for (const u of GS.units) if (u.team === 'player') u.hp = u.maxHp;
    Game.update();
  }
  ok(
    GS.timeOfDay === 'night' && GS.kills > kills0,
    `an ordinary wave is won by killing (${GS.kills - kills0} kills, ${t} ticks)`
  );
}

if (failures()) {
  console.error(`\n${failures()} stall test(s) failed`);
  process.exit(1);
}
console.log('\nAll stall tests passed.');
