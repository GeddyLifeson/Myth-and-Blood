/**
 * Honest playtest: a simple bot plays without cheats and reports how far it gets.
 * The stress simulation (headless-sim.mjs) clears each wave with a cheat, so it proves
 * stability, not balance. This one deploys troops with the TP it earns and fights.
 *
 * Usage: node scripts/sim-honest-play.mjs            (all difficulties, 3 seeds each)
 *        HONEST_TICKS=40000 HONEST_SEEDS=1 node scripts/sim-honest-play.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { ROOT, JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot } from './lib/harness.mjs';

const MAX_TICKS = Number(process.env.HONEST_TICKS || 60000);
const SEEDS = Number(process.env.HONEST_SEEDS || 3);
const STALL_TICKS = Number(process.env.HONEST_STALL_TICKS || 8000);
const DIFFS = ['baby', 'normal', 'chad', 'doomslayer'];
// Deploy order the bot cycles through; it buys the next one it can afford.
const ROSTER = [
  'footman',
  'archer',
  'footman',
  'archer',
  'healer',
  'mage',
  'footman',
  'archer',
  'knight',
];

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function playOne(diff, seed) {
  const { sb, cvs } = boot(seed);
  const { Game, SpriteGen, UnitDefs } = vm.runInContext(
    `${code}\n({ Game, SpriteGen, UnitDefs })`,
    vm.createContext(sb)
  );
  SpriteGen.prewarmCache = () => {};
  Game.init(cvs);
  Game.setDifficulty(diff);
  Game.start();
  let next = 0;
  let deployed = 0;
  let threw = null;
  let maxArmy = 0;
  let t = 0;
  let lastWave = -1;
  let lastWaveTick = 0;
  let stalledAt = null;
  for (; t < MAX_TICKS; t++) {
    // getState() is cached per presented frame, so ask the game directly whether it ended.
    if (!Game.isPlaying()) break;
    const s = Game.getState();
    // A wave that never ends is a soft-lock (for example an enemy jittering in place).
    if (s.wave !== lastWave) {
      lastWave = s.wave;
      lastWaveTick = t;
    } else if (t - lastWaveTick > STALL_TICKS) {
      stalledAt = s.wave;
      break;
    }
    try {
      if (s.timeOfDay === 'night') {
        const type = ROSTER[next % ROSTER.length];
        const cost = UnitDefs[type]?.cost ?? 99;
        if (s.canDeploy && s.tactical >= cost) {
          const before = s.army ?? 0;
          Game.selectDeploy(type);
          Game.handleClick(480 + ((deployed * 37) % 320), 520 + ((deployed * 53) % 90));
          const after = Game.getState().army ?? 0;
          if (after > before) deployed++;
          next++;
        } else if (t % 20 === 0) {
          Game.beginDayPhase(true);
        }
      }
      Game.update();
    } catch (e) {
      threw = e.message;
      break;
    }
    if (t % 200 === 0) maxArmy = Math.max(maxArmy, Game.getState().army ?? 0);
  }
  Game.updatePresentation?.();
  const fin = Game.getState();
  const ended = !Game.isPlaying();
  return {
    difficulty: diff,
    seed,
    wave: fin.wave,
    outcome: threw
      ? 'THROW'
      : stalledAt != null
        ? `STALLED on wave ${stalledAt}`
        : !ended
          ? 'still alive'
          : fin.state === 'playing'
            ? 'defeat'
            : fin.state,
    stalled: stalledAt != null,
    ticks: t,
    deployed,
    maxArmy,
    kills: fin.kills ?? null,
    campaignWon: !!fin.campaignWon,
    threw,
  };
}

const results = [];
for (const diff of DIFFS) {
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(diff, 4000 + i * 131);
    results.push(r);
    console.log(
      `${diff.padEnd(10)} seed ${r.seed}: wave ${String(r.wave).padStart(3)} · ${r.outcome} · ${r.deployed} deployed · peak army ${r.maxArmy}${r.threw ? ' · ' + r.threw : ''}`
    );
  }
}
const byDiff = {};
for (const d of DIFFS) {
  const rs = results.filter((r) => r.difficulty === d);
  byDiff[d] = {
    avgWave: +(rs.reduce((a, r) => a + r.wave, 0) / rs.length).toFixed(1),
    best: Math.max(...rs.map((r) => r.wave)),
    worst: Math.min(...rs.map((r) => r.wave)),
  };
}
console.log('\nBy difficulty:', JSON.stringify(byDiff));
writeFileSync(
  join(ROOT, 'scripts', 'sim-honest-report.json'),
  JSON.stringify({ maxTicks: MAX_TICKS, byDiff, results }, null, 2)
);
process.exit(results.some((r) => r.threw || r.stalled) ? 1 : 0);
