// Full bot run with per-wave logging. usage: node bot.mjs diff seed maxTicks [patchSpec...] [--tent] [--json]
import { PATCHES, buildCode, startGame } from './lib.mjs';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const pos = args.filter((a) => !a.startsWith('--'));
const diff = pos[0] || 'normal';
const seed = Number(pos[1] || 4000);
const MAX = Number(pos[2] || 60000);
const patchSpecs = pos.slice(3);
const patches = patchSpecs.map((s) => {
  const [n, a] = s.split('=');
  return PATCHES[n](a === undefined ? undefined : Number(a));
});
const WITH_TENT = flags.has('--tent');
const MAXWAVE = Number([...flags].find((f) => f.startsWith('--maxwave='))?.split('=')[1] || 99);
const ROSTER = (
  [...flags].find((f) => f.startsWith('--roster='))?.split('=')[1] ||
  'footman,archer,footman,archer,healer,mage,footman,archer,knight'
).split(',');
const code = buildCode(patches);
const api = startGame({ diff, seed, code });
const { Game, GameState: GS, UnitDefs } = api;
let next = 0,
  deployed = 0,
  tentStep = WITH_TENT ? 0 : 2,
  tentTries = 0;
let lastWave = -1,
  lastTod = null,
  waveStartTick = 0,
  lastWaveTick = 0;
const waves = [];
let cur = null;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
function snapshot() {
  const mine = GS.units.filter((u) => u.team === 'player' && u.hp > 0);
  const fight = mine.filter((u) => !['healer', 'builder', 'courier'].includes(u.combatType));
  return {
    army: mine.length,
    xp: +mean(fight.map((u) => u.experience || 0)).toFixed(1),
    xpMax: Math.max(0, ...fight.map((u) => u.experience || 0)),
    tier: +mean(mine.map((u) => u.vetTier || 0)).toFixed(2),
    hpPct: Math.round(mean(mine.map((u) => u.hp / u.maxHp)) * 100),
    hurt: mine.filter((u) => u.hp < u.maxHp * 0.6).length,
    tp: GS.tactical,
  };
}
function vetLines() {
  const out = {};
  for (const type of ['footman', 'archer', 'healer']) {
    const c = GS.units
      .filter((u) => u.team === 'player' && u.hp > 0 && u.type === type)
      .sort(
        (a, b) =>
          (b.wavesSurvived || 0) - (a.wavesSurvived || 0) ||
          (b.experience || 0) - (a.experience || 0)
      )[0];
    if (c)
      out[type] = {
        hp: c.maxHp,
        dmg: c.damage,
        acc: c.accuracy,
        xp: c.experience,
        mor: c.maxMorale,
        kills: c.kills || 0,
        ws: c.wavesSurvived || 0,
        stars: [c.vetBronze, c.vetSilver, c.vetGold],
        tier: c.vetTier,
        range: c.range,
        heal: c.healAmount,
      };
  }
  return out;
}
const seenFoe = new Set();
let t = 0,
  threw = null,
  routs = 0,
  enemyRouts = 0,
  pins = 0,
  epins = 0;
const fleeSeen = new Set();
for (; t < MAX; t++) {
  if (!Game.isPlaying()) break;
  const s = Game.getState();
  if (s.wave !== lastWave || s.timeOfDay !== lastTod) {
    if (s.timeOfDay === 'day' && lastTod !== 'day') {
      cur = {
        vets: vetLines(),
        foe: {},
        wave: s.wave,
        start: t,
        startArmy: snapshot(),
        deaths0: GS.runPlayerDeaths,
        br0: s.siegeLoop?.breaches ?? 0,
        kills0: GS.kills,
        maxFoes: 0,
        routs: 0,
        eRouts: 0,
        woundSamples: 0,
        woundSum: 0,
        dmgTaken: 0,
        lowest: 1,
      };
    } else if (s.timeOfDay === 'night' && lastTod === 'day' && cur) {
      const end = snapshot();
      waves.push({
        wave: cur.wave,
        ticks: t - cur.start,
        army: cur.startArmy.army,
        xp: cur.startArmy.xp,
        xpMax: cur.startArmy.xpMax,
        tier: cur.startArmy.tier,
        deaths: GS.runPlayerDeaths - cur.deaths0,
        breaches: (s.siegeLoop?.breaches ?? 0) - cur.br0,
        kills: GS.kills - cur.kills0,
        maxFoes: cur.maxFoes,
        routs: cur.routs,
        eRouts: cur.eRouts,
        woundPct: cur.woundSamples ? Math.round((cur.woundSum / cur.woundSamples) * 100) : 0,
        endHpPct: end.hpPct,
        tp: end.tp,
        dmg: Math.round(cur.dmgTaken),
        vets: cur.vets,
        foe: Object.fromEntries(
          Object.entries(cur.foe).map(([k, v]) => [
            k,
            {
              n: v.n,
              hp: Math.round(v.hp / v.n),
              dmg: +(v.dmg / v.n).toFixed(1),
              acc: Math.round(v.acc / v.n),
            },
          ])
        ),
        runners: cur.runners || 0,
      });
      cur = null;
    }
    lastWave = s.wave;
    lastTod = s.timeOfDay;
    lastWaveTick = t;
  } else if (t - lastWaveTick > 9000) {
    threw = 'STALL';
    break;
  }
  if (s.wave > MAXWAVE) break;
  try {
    if (s.timeOfDay === 'night') {
      const type = ROSTER[next % ROSTER.length];
      const cost =
        s.deployCosts?.[type] ?? Game.getDeployCost?.(type) ?? UnitDefs[type]?.cost ?? 99;
      if (tentStep < 2 && s.canDeploy && deployed >= 4) {
        if (tentStep === 0 && s.tactical >= (UnitDefs.builder?.cost ?? 99) + 5) {
          Game.selectDeploy('builder');
          Game.handleClick(640, 600);
          tentStep = 1;
        } else if (tentStep === 1 && s.tactical >= 5 && tentTries < 40) {
          Game.selectBuild('medical_tent');
          if (Game.handleClick(560 - (tentTries % 8) * 14, 610 - (tentTries % 3) * 12))
            tentStep = 2;
          else if (++tentTries >= 40) tentStep = 2;
        } else if (t % 20 === 0) Game.beginDayPhase(true);
      } else if (s.canDeploy && s.tactical >= cost) {
        const before = s.army ?? 0;
        Game.selectDeploy(type);
        Game.handleClick(480 + ((deployed * 37) % 320), 520 + ((deployed * 53) % 90));
        if ((Game.getState().army ?? 0) > before) deployed++;
        next++;
      } else if (t % 20 === 0) Game.beginDayPhase(true);
    }
    // hp before
    let hpBefore = 0;
    if (cur) for (const u of GS.units) if (u.team === 'player' && u.hp > 0) hpBefore += u.hp;
    Game.update();
    if (cur) {
      let hpAfter = 0,
        foes = 0;
      for (const u of GS.units) {
        if (u.hp <= 0) continue;
        if (u.team === 'player') {
          hpAfter += u.hp;
          if (u.fleeing && !fleeSeen.has(u.id)) {
            fleeSeen.add(u.id);
            cur.routs++;
          }
        } else if (u.team === 'enemy') {
          foes++;
          if (!seenFoe.has(u.id)) {
            seenFoe.add(u.id);
            const f = (cur.foe[u.type] ||= { n: 0, hp: 0, dmg: 0, acc: 0 });
            f.n++;
            f.hp += u.maxHp;
            f.dmg += u.damage;
            f.acc += u.accuracy;
            if (u.lineBreaker) cur.runners = (cur.runners || 0) + 1;
          }
          if (u.fleeing && !fleeSeen.has(u.id)) {
            fleeSeen.add(u.id);
            cur.eRouts++;
          }
        }
      }
      if (hpAfter < hpBefore) cur.dmgTaken += hpBefore - hpAfter;
      cur.maxFoes = Math.max(cur.maxFoes, foes);
      if (t % 60 === 0) {
        const sn = snapshot();
        cur.woundSamples++;
        cur.woundSum += sn.army ? sn.hurt / sn.army : 0;
      }
    }
  } catch (e) {
    threw = e.stack.split('\n').slice(0, 3).join(' | ');
    break;
  }
}
const fin = Game.getState();
const out = {
  diff,
  seed,
  patches: patchSpecs,
  tent: WITH_TENT,
  wave: fin.wave,
  ended: !Game.isPlaying(),
  ticks: t,
  deployed,
  lost: GS.runPlayerDeaths,
  breaches: fin.siegeLoop?.breaches ?? 0,
  limit: fin.siegeLoop?.breachLimit,
  threw,
  waves,
};
if (flags.has('--json')) console.log(JSON.stringify(out));
else {
  console.log(
    `${diff} seed ${seed} ${patchSpecs.join('+') || 'baseline'}${WITH_TENT ? ' +tent' : ''}: wave ${fin.wave} ${out.ended ? 'DEFEAT' : 'alive'} lost ${out.lost} breaches ${out.breaches}/${out.limit} ${threw || ''}`
  );
  console.log(
    'wave army  xp xpMax tier deaths breach kills maxFoes routs eRouts wound% endHp% dmg ticks tp'
  );
  for (const w of waves)
    console.log(
      [
        w.wave,
        w.army,
        w.xp,
        w.xpMax,
        w.tier,
        w.deaths,
        w.breaches,
        w.kills,
        w.maxFoes,
        w.routs,
        w.eRouts,
        w.woundPct,
        w.endHpPct,
        w.dmg,
        w.ticks,
        w.tp,
      ]
        .map((v) => String(v).padStart(5))
        .join(' ')
    );
}
