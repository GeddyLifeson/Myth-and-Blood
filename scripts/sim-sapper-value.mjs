/**
 * Sapper value report: what a Sapper is worth beside a Crossbowman in a real siege.
 *
 * The no-cheat bot from sim-honest-play.mjs plays Normal. Iron Weapons is granted at wave 3
 * (the bot cannot build a Research Lab), and at wave 6 the bot buys a squad of the unit under
 * test, paid for with its own TP. From wave 8 to wave 15 every point of damage the squad deals
 * is counted, with overkill clipped to the health the target had left.
 *
 * Usage: node scripts/sim-sapper-value.mjs
 *        VALUE_UNITS=sapper,crossbowman VALUE_POSTS=rear,front VALUE_SEEDS=2 node scripts/sim-sapper-value.mjs
 *
 * "rear" posts the squad a few steps behind the footmen; "front" posts it alone, well ahead
 * of the line, which is how an unprotected soldier is used.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { boot } from './lib/harness.mjs';

const UNITS = (process.env.VALUE_UNITS || 'sapper,crossbowman').split(',');
const POSTS = (process.env.VALUE_POSTS || 'rear,front').split(',');
const SEEDS = Number(process.env.VALUE_SEEDS || 2);
const SQUAD = Number(process.env.VALUE_SQUAD || 3);
const BUY_WAVE = Number(process.env.VALUE_BUY_WAVE || 6);
const FROM_WAVE = Number(process.env.VALUE_FROM || 8);
const TO_WAVE = Number(process.env.VALUE_TO || 15);
const MAX_TICKS = Number(process.env.VALUE_TICKS || 26000);
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
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

function playOne(type, post, seed) {
  const { sb, cvs } = boot(seed);
  const { Game, SpriteGen, UnitDefs, Roster, Research } = vm.runInContext(
    `${code}\n({ Game, SpriteGen, UnitDefs, Roster, Research })`,
    vm.createContext(sb)
  );
  SpriteGen.prewarmCache = () => {};
  Game.init(cvs);
  Game.setDifficulty('normal');
  Game.start();

  const squad = new Set();
  const stats = { dmg: 0, kills: 0, swings: 0, hits: 0, firstDeathWave: null };
  let counting = false;
  // Every blow in the game passes through here with its attacker, after armour is applied.
  const taken = Roster.modifyDamageTaken;
  Roster.modifyDamageTaken = (unit, amount, opts, ctx) => {
    const out = taken(unit, amount, opts, ctx);
    const a = opts && opts.attacker;
    if (counting && a && squad.has(a.id) && unit.team === 'enemy' && out > 0) {
      stats.dmg += Math.min(out, unit.hp);
      if (!opts.splash) stats.hits++;
      if (out >= unit.hp) stats.kills++;
    }
    return out;
  };

  let next = 0;
  let deployed = 0;
  let bought = 0;
  let cost = 0;
  let unlocked = false;
  const anim = new Map();
  let t = 0;
  for (; t < MAX_TICKS; t++) {
    if (!Game.isPlaying()) break;
    const s = Game.getState();
    if (s.wave > TO_WAVE) break;
    counting = s.wave >= FROM_WAVE && s.wave <= TO_WAVE && s.timeOfDay === 'day';
    if (!unlocked && s.wave >= 3) {
      Research.completeResearch('iron_weapons');
      unlocked = true;
    }
    if (s.timeOfDay === 'night') {
      const wantSquad = unlocked && s.wave >= BUY_WAVE && bought < SQUAD;
      const pick = wantSquad ? type : ROSTER[next % ROSTER.length];
      const price = UnitDefs[pick]?.cost ?? 99;
      if (s.canDeploy && s.tactical >= price) {
        const before = new Set(Game.getUnitsSnapshot().map((u) => u.id));
        const tp = s.tactical;
        Game.selectDeploy(pick);
        Game.handleClick(480 + ((deployed * 37) % 320), 520 + ((deployed * 53) % 90));
        const fresh = Game.getUnitsSnapshot().find((u) => !before.has(u.id) && u.team === 'player');
        if (fresh) {
          deployed++;
          if (wantSquad) {
            const mine = Game.getUnitsSnapshot().filter((u) => u.team === 'player');
            const line = mine.filter((u) => u.type === 'footman');
            const lineY = median(line.map((u) => u.y));
            const lineX = median(line.map((u) => u.x));
            const live = Game.getUnitById(fresh.id);
            live.x = lineX + (bought - (SQUAD - 1) / 2) * 46;
            live.y = post === 'front' ? lineY - 110 : lineY + 26;
            live.postX = live.x;
            live.postY = live.y;
            squad.add(fresh.id);
            bought++;
            cost += tp - Game.getState().tactical;
          }
        }
        if (!wantSquad) next++;
      } else if (t % 20 === 0) {
        Game.beginDayPhase(true);
      }
    }
    Game.update();
    if (process.env.VALUE_TRACE && bought > 0 && t % 300 === 0) {
      const st = Game.getState();
      const all = Game.getUnitsSnapshot();
      const foes = all.filter((u) => u.team === 'enemy');
      console.log(
        `  t${t} w${st.wave} ${st.timeOfDay} squad ${[...squad]
          .map((id) => Game.getUnitById(id))
          .map((u) =>
            u && u.hp > 0 ? `${Math.round(u.x)},${Math.round(u.y)}(${Math.round(u.hp)})` : 'dead'
          )
          .join(
            ' '
          )} · foes ${foes.length} minY ${Math.round(Math.min(...foes.map((u) => u.y)))} maxY ${Math.round(Math.max(...foes.map((u) => u.y)))} · ${foes
          .slice(0, 4)
          .map((u) => {
            const l = Game.getUnitById(u.id);
            return `${u.type}@${Math.round(u.x)},${Math.round(u.y)}${l.flying ? ' fly' : ''}${l.mustered ? '' : ' muster'}${u.pinned ? ' pin' : ''}`;
          })
          .join(
            ' '
          )} · dmg ${Math.round(stats.dmg)}${sb.SapperKit ? ` · mines ${sb.SapperKit.getMines().length}` : ''}`
      );
    }
    if (counting) {
      for (const id of squad) {
        const u = Game.getUnitById(id);
        if (!u || u.hp <= 0) continue;
        const was = anim.get(id) || 0;
        if ((u.attackAnimTimer || 0) > was) stats.swings++;
        anim.set(id, u.attackAnimTimer || 0);
      }
    }
    if (stats.firstDeathWave == null && bought > 0) {
      for (const id of squad) {
        const u = Game.getUnitById(id);
        if (!u || u.hp <= 0) {
          stats.firstDeathWave = Game.getState().wave;
          break;
        }
      }
    }
  }
  const alive = [...squad].filter((id) => (Game.getUnitById(id)?.hp || 0) > 0).length;
  const fin = Game.getState();
  return {
    type,
    post,
    seed,
    wave: fin.wave,
    bought,
    cost,
    alive,
    firstDeathWave: stats.firstDeathWave,
    damage: Math.round(stats.dmg),
    perTp: cost ? Math.round((stats.dmg / cost) * 10) / 10 : 0,
    kills: stats.kills,
    swings: stats.swings,
    hits: stats.hits,
    breaches: fin.siegeLoop?.breaches ?? 0,
    ticks: t,
  };
}

const rows = [];
for (const type of UNITS) {
  for (const post of POSTS) {
    for (let i = 0; i < SEEDS; i++) {
      const r = playOne(type, post, Number(process.env.VALUE_SEED0 || 4000) + i * 131);
      rows.push(r);
      console.log(
        `${r.type.padEnd(12)} ${r.post.padEnd(5)} seed ${r.seed}: reached wave ${r.wave} · ${r.bought} bought for ${r.cost} TP · ${r.alive} alive (first death wave ${r.firstDeathWave ?? '—'}) · damage ${r.damage} = ${r.perTp}/TP · kills ${r.kills} · attacks ${r.swings}, blows landed ${r.hits} · breaches ${r.breaches}`
      );
    }
  }
}
console.log('\nAverages (waves ' + FROM_WAVE + '–' + TO_WAVE + ', Normal):');
for (const type of UNITS) {
  for (const post of POSTS) {
    const mine = rows.filter((r) => r.type === type && r.post === post);
    const avg = (k) => Math.round((mine.reduce((a, r) => a + r[k], 0) / mine.length) * 10) / 10;
    console.log(
      `  ${type.padEnd(12)} ${post.padEnd(5)} ${avg('perTp')} damage/TP · ${avg('damage')} damage · ${avg('alive')}/${SQUAD} alive · ${avg('kills')} kills`
    );
  }
}
