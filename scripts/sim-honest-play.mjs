/**
 * Honest playtest: a simple bot plays without cheats and reports how far it gets.
 * The stress simulation (headless-sim.mjs) clears each wave with a cheat, so it proves
 * stability, not balance. This one deploys troops with the TP it earns and fights.
 *
 * Usage: node scripts/sim-honest-play.mjs            (all difficulties, 3 seeds each)
 *        HONEST_TICKS=40000 HONEST_SEEDS=1 node scripts/sim-honest-play.mjs
 *        HONEST_TENT=1 ...   the bot also fields a Builder and a Medical Tent behind its line
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { ROOT, JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot } from './lib/harness.mjs';

const MAX_TICKS = Number(process.env.HONEST_TICKS || 60000);
const SEEDS = Number(process.env.HONEST_SEEDS || 3);
const STALL_TICKS = Number(process.env.HONEST_STALL_TICKS || 8000);
const DIFFS = (process.env.HONEST_DIFFS || 'baby,normal,chad,doomslayer').split(',');
// With HONEST_TENT the bot buys a Builder and a Medical Tent as soon as it can afford both.
const WITH_TENT = !!process.env.HONEST_TENT;
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
  let tentStep = WITH_TENT ? 0 : 2;
  let tentTries = 0;
  let deployed = 0;
  let threw = null;
  let maxArmy = 0;
  let woundSamples = 0;
  let woundShare = 0;
  let enemySeen = 0;
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
      if (process.env.HONEST_DEBUG) {
        const live = Game.getUnitsSnapshot?.() || [];
        console.log(
          JSON.stringify({
            timeOfDay: s.timeOfDay,
            enemiesRemaining: s.enemiesRemaining,
            siege: s.siegeLoop && {
              breaches: s.siegeLoop.breaches,
              limit: s.siegeLoop.breachLimit,
            },
            units: live.map((u) =>
              [
                u.team,
                u.type,
                Math.round(u.x),
                Math.round(u.y),
                u.fleeing ? 'fleeing' : '',
                u.pinned ? 'pinned' : '',
                u.lineBreaker ? 'runner' : '',
                `path${u.pathLen}${u.pathPending ? '?' : ''}`,
              ]
                .filter(Boolean)
                .join(' ')
            ),
          })
        );
      }
      break;
    }
    try {
      if (s.timeOfDay === 'night') {
        const type = ROSTER[next % ROSTER.length];
        const cost = UnitDefs[type]?.cost ?? 99;
        if (tentStep < 2 && s.canDeploy && deployed >= 4) {
          // Builder first, then the tent just behind the deploy line.
          if (tentStep === 0 && s.tactical >= (UnitDefs.builder?.cost ?? 99) + 5) {
            Game.selectDeploy('builder');
            Game.handleClick(640, 600);
            tentStep = 1;
          } else if (tentStep === 1 && s.tactical >= 5 && tentTries < 40) {
            // Try a few spots; a failed placement must not hold up the night.
            Game.selectBuild('medical_tent');
            if (Game.handleClick(560 - (tentTries % 8) * 14, 610 - (tentTries % 3) * 12))
              tentStep = 2;
            else if (++tentTries >= 40) tentStep = 2;
          } else if (t % 20 === 0) {
            Game.beginDayPhase(true);
          }
        } else if (s.canDeploy && s.tactical >= cost) {
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
    if (
      process.env.HONEST_TRACE &&
      t % 60 === 0 &&
      Game.getState().wave === Number(process.env.HONEST_TRACE)
    ) {
      const all = Game.getUnitsSnapshot();
      const foes = all.filter((u) => u.team === 'enemy');
      const mine = all.filter((u) => u.team === 'player');
      const st = Game.getState();
      console.log(
        `t${t} ${st.timeOfDay} foes ${foes.length} (hp ${Math.round(foes.reduce((a, u) => a + u.hp, 0))}, avgY ${Math.round(foes.reduce((a, u) => a + u.y, 0) / (foes.length || 1))}) mine ${mine.length} (avgY ${Math.round(mine.reduce((a, u) => a + u.y, 0) / (mine.length || 1))}, minY ${Math.round(Math.min(...mine.map((u) => u.y)))}) hurt ${mine.filter((u) => u.hp < u.maxHp).length} left ${st.enemiesRemaining}`
      );
    }
    if (t % 100 === 0 && Game.getUnitsSnapshot) {
      // How hard the enemy is pressing: the share of soldiers below 60% health, sampled in daylight.
      const mine = Game.getUnitsSnapshot().filter((u) => u.team === 'player');
      if (mine.length && Game.getState().timeOfDay === 'day') {
        woundSamples++;
        woundShare += mine.filter((u) => u.hp < u.maxHp * 0.6).length / mine.length;
        enemySeen += Game.getUnitsSnapshot().length - mine.length;
      }
    }
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
    woundedPct: woundSamples ? Math.round((woundShare / woundSamples) * 100) : 0,
    avgEnemies: woundSamples ? Math.round(enemySeen / woundSamples) : 0,
    kills: fin.kills ?? null,
    lost: fin.playerDeaths ?? 0,
    breaches: fin.siegeLoop?.breaches ?? 0,
    breachLimit: fin.siegeLoop?.breachLimit ?? null,
    spoils: fin.siegeLoop?.edicts?.length ?? 0,
    campaignWon: !!fin.campaignWon,
    threw,
  };
}

const results = [];
for (const diff of DIFFS) {
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(diff, Number(process.env.HONEST_SEED0 || 4000) + i * 131);
    results.push(r);
    console.log(
      `${diff.padEnd(10)} seed ${r.seed}: wave ${String(r.wave).padStart(3)} · ${r.outcome} · ${r.deployed} deployed · peak army ${r.maxArmy} · lost ${r.lost} · wounded ${r.woundedPct}% · avg foes on field ${r.avgEnemies} · breaches ${r.breaches}/${r.breachLimit} · spoils ${r.spoils}${r.threw ? ' · ' + r.threw : ''}`
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
  join(ROOT, 'scripts', WITH_TENT ? 'sim-honest-report-tent.json' : 'sim-honest-report.json'),
  JSON.stringify({ maxTicks: MAX_TICKS, byDiff, results }, null, 2)
);
process.exit(results.some((r) => r.threw || r.stalled) ? 1 : 0);
