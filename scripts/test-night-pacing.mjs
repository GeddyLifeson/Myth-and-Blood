/**
 * Night pacing: every wave gets a real planning window. The night lasts 75 s at 1x, the
 * player's horn is held for its first 25 s, and a horn sounded the moment it is ready
 * still pays the full early-call TP.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb, cvs } = boot(31);
const api = vm.runInContext(
  `${code}\n({ Game, SpriteGen, GameState, GameDayNight, NIGHT_PREP_SECONDS, HORN_LOCK_SECONDS })`,
  vm.createContext(sb)
);
api.SpriteGen.prewarmCache = () => {};
const { Game, GameState: GS, GameDayNight } = api;
Game.init(cvs);
Game.setDifficulty('normal');
Game.start();

ok(api.NIGHT_PREP_SECONDS >= 75, `night prep is ${api.NIGHT_PREP_SECONDS} s (want 75+)`);

// Clear the opening wave so night falls.
for (let i = 0; i < 6000 && GS.timeOfDay !== 'night' && Game.isPlaying(); i++) {
  GS.spawnQueue.length = 0;
  for (const u of GS.units) if (u.team === 'enemy') u.hp = 0;
  Game.update();
}
ok(GS.timeOfDay === 'night', 'night falls after the first wave');
const wave = GS.wave;
ok(GameDayNight.getNightSecondsRemaining() >= 74, 'a fresh night has about 75 s on the clock');

ok(GameDayNight.getHornLockSecondsLeft() === api.HORN_LOCK_SECONDS, 'horn starts held');
ok(Game.soundHorn() === false, 'horn refused at the start of the night');
ok(GS.timeOfDay === 'night' && GS.wave === wave, 'refused horn leaves the night running');

for (let i = 0; i < api.HORN_LOCK_SECONDS * 60 && GS.timeOfDay === 'night'; i++) Game.update();
ok(GameDayNight.getHornLockSecondsLeft() === 0, 'horn ready after the hold');
const tp = GS.tactical;
const left = GameDayNight.getNightSecondsRemaining();
ok(left >= 50, `horn ready with ${left} s of night left, enough for the full early-call bonus`);
ok(Game.soundHorn() === true, 'horn sounds once ready');
ok(GS.timeOfDay === 'day' && GS.wave === wave + 1, 'the next wave begins');
ok(GS.tactical - tp >= 5, `early call still pays +${GS.tactical - tp} TP`);

if (failures()) {
  console.error(`${failures()} night pacing check(s) failed`);
  process.exit(1);
}
console.log('night pacing: all checks passed');
