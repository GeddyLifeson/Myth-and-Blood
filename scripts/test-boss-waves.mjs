/**
 * Named bosses belong to boss waves (every 10th) and nowhere else.
 * Plays waves 1-60 on two seeds, clearing each wave by hand, and checks both the spawn
 * queue as built and every enemy that actually reaches the field.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const LAST_WAVE = 60;

function play(seed) {
  const { sb, cvs } = boot(seed);
  const {
    Game,
    SpriteGen,
    GameState: GS,
    EnemyDefs,
  } = vm.runInContext(`${code}\n({ Game, SpriteGen, GameState, EnemyDefs })`, vm.createContext(sb));
  SpriteGen.prewarmCache = () => {};
  Game.init(cvs);
  Game.setDifficulty('normal');
  Game.start();

  const isBossType = (t) => !!EnemyDefs[t]?.isNamedBoss;
  const stray = []; // [wave, type, where]
  const bossWavesWithBoss = new Set();
  let seenWave = 0;
  let ticksInWave = 0;
  let guard = 0;
  while (GS.wave <= LAST_WAVE && guard++ < 400000 && Game.isPlaying()) {
    // Keep the garrison alive: this test is about what the enemy sends.
    for (const u of GS.units) if (u.team === 'player' && u.hp > 0) u.hp = u.maxHp;
    if (GS.timeOfDay === 'night') {
      if (GS.wave >= LAST_WAVE) break;
      Game.beginDayPhase(true);
      Game.update();
      continue;
    }
    if (GS.wave !== seenWave) {
      seenWave = GS.wave;
      ticksInWave = 0;
      const bossWave = seenWave % 10 === 0;
      for (const t of GS.spawnQueue) {
        if (!isBossType(t)) continue;
        if (bossWave) bossWavesWithBoss.add(seenWave);
        else stray.push([seenWave, t, 'queue']);
      }
    }
    for (const u of GS.units) {
      if (u.team !== 'enemy' || !(u.isNamedBoss || isBossType(u.type)) || u._seenByTest) continue;
      u._seenByTest = true;
      if (seenWave % 10 === 0) bossWavesWithBoss.add(seenWave);
      else stray.push([seenWave, u.type, 'field']);
    }
    // Let the host spawn and fight for a while, then clear it to move on.
    if (++ticksInWave > 240) {
      for (const u of GS.units) if (u.team !== 'player') u.hp = 0;
      GS.spawnQueue.length = 0;
    }
    Game.update();
  }
  return { reached: seenWave, stray, bossWavesWithBoss };
}

for (const seed of [4131, 77]) {
  const r = play(seed);
  ok(r.reached >= LAST_WAVE, `seed ${seed}: reached wave ${r.reached} of ${LAST_WAVE}`);
  ok(
    r.stray.length === 0,
    `seed ${seed}: no named boss in an ordinary wave` +
      (r.stray.length ? ` — found ${JSON.stringify(r.stray.slice(0, 8))}` : '')
  );
  const expected = [10, 20, 30, 40, 50, 60].filter((w) => w <= r.reached);
  ok(
    expected.every((w) => r.bossWavesWithBoss.has(w)),
    `seed ${seed}: every boss wave still brings its named boss (${[...r.bossWavesWithBoss].join(', ')})`
  );
}

if (failures()) {
  console.error(`\n${failures()} boss-wave test(s) failed`);
  process.exit(1);
}
console.log('\nAll boss-wave tests passed.');
