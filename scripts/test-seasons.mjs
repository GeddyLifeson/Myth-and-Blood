/**
 * Seasons follow the day counter (25 waves each) and change TP, night prep, march speed and weather.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb, cvs } = boot(7);
const api = vm.runInContext(
  `${code}\n({ Game, GameState, Seasons, VisualPolish, SpriteGen, SiegeLoop, GameDayNight, GameMovement })`,
  vm.createContext(sb)
);
const { Game, GameState: GS, Seasons, VisualPolish, GameDayNight, GameMovement } = api;
api.SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('normal');
Game.start();

const id = (d) => Seasons.forDay(d).id;
ok(id(1) === 'spring' && id(25) === 'spring', 'days 1-25 are Spring');
ok(id(26) === 'summer' && id(51) === 'autumn' && id(76) === 'winter', 'season turns every 25 days');
ok(id(101) === 'spring' && Seasons.dayOfSeason(101) === 1, 'the year wraps back to Spring');
ok(
  !Seasons.isTurnDay(1) && Seasons.isTurnDay(26) && !Seasons.isTurnDay(27),
  'turn day only on day 1 of a later season'
);

// Weather: snow only in winter, never in the other seasons, over a long tick span.
const snowIn = (day) => {
  let n = 0;
  for (let t = 0; t < 20000; t += 7) if (VisualPolish.pickWeather(day, t).type === 'snow') n++;
  return n;
};
ok(snowIn(10) === 0 && snowIn(40) === 0 && snowIn(60) === 0, 'no snow outside Winter');
ok(snowIn(80) > 1000, 'Winter snows');

// Nightfall: dawn ledger names the season, and night prep length follows it.
const night = (w) => {
  GS.wave = w;
  GS.tpAwardedForWave = -1;
  GS.timeOfDay = 'day';
  const before = GS.tactical;
  GameDayNight.enterNightPhase();
  return {
    tp: GS.tactical - before,
    ledger: lastLedger,
    secs: GameDayNight.getNightSecondsRemaining(),
  };
};
let lastLedger = null;
const note = api.SiegeLoop.noteLedger;
api.SiegeLoop.noteLedger = (l) => {
  lastLedger = l;
  note(l);
};
const seasonLine = (l) => l?.lines.find((e) => /spring|summer|autumn|winter/.test(e.label));
GS.tactical = 500;
const sp = night(10);
const su = night(30);
const wi = night(80);
ok(!seasonLine(sp.ledger), `spring dawn has no season line: "${sp.ledger.text}"`);
ok(
  seasonLine(su.ledger)?.label === 'summer' && seasonLine(su.ledger).tp > 0,
  `summer harvest: "${su.ledger.text}"`
);
ok(
  seasonLine(wi.ledger)?.label === 'winter' && seasonLine(wi.ledger).tp < 0,
  `winter lean: "${wi.ledger.text}"`
);
ok(
  su.secs < sp.secs && wi.secs > sp.secs,
  `night prep s: summer ${su.secs} < spring ${sp.secs} < winter ${wi.secs}`
);

// Spring dawn mends the wounded.
const hurt = GS.units.find((u) => u.team === 'player' && u.hp > 0 && u.maxHp > 0);
const healAt = (w) => {
  hurt.hp = hurt.maxHp * 0.5;
  night(w);
  return hurt.hp / hurt.maxHp;
};
const hSpring = healAt(5);
const hSummer = healAt(30);
ok(
  hSpring - hSummer > 0.12,
  `spring mends at dawn: ${hSpring.toFixed(3)} vs summer ${hSummer.toFixed(3)}`
);

// March speed: one steer step covers less ground in winter.
const step = (w) => {
  GS.wave = w;
  const u = { ...hurt, hazardSlow: 1, doctrineSpeedTimer: 0, manualOrder: true };
  GameMovement.steerToward(u, hurt.x, hurt.y - 60);
  return Math.hypot(u.x - hurt.x, u.y - hurt.y);
};
const mv = { sp: step(10), su: step(30), wi: step(80) };
ok(
  mv.su > mv.sp && mv.wi < mv.sp,
  `march step summer ${mv.su.toFixed(2)} > spring ${mv.sp.toFixed(2)} > winter ${mv.wi.toFixed(2)}`
);

process.exit(failures() ? 1 : 0);
