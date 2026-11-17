/**
 * Omens and weather: one seeded deck of two-option cards, weather at nightfall, and no
 * hidden multipliers on the enemy's numbers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const src = (f) => readFileSync(join(JS, f), 'utf8');
const sb = { Math, Object, Array, Set, Map, JSON, String, Number, Uint32Array, console };
sb.window = sb;
sb.globalThis = sb;
const saved = {};
sb.SaveRegistry = { register: (k, h) => (saved[k] = h), tick: () => 0 };
const ctx = vm.createContext(sb);
vm.runInContext(src('game-data-bundle.js'), ctx);
vm.runInContext(
  `const UnitDefs = GameDataBundle.units;
   const BuildDefs = GameDataBundle.buildings;
   const EnemyDefs = GameDataBundle.enemies;`,
  ctx
);
vm.runInContext(src('units.js'), ctx);
const mods = vm.runInContext(
  `${src('strategy-counterplay.js')}
   ${src('dynamic-map-events.js')}
   ${src('asymmetric-warfare.js')}
   ${src('biome-spawn.js')}
   ${src('procgen-obstacles.js')}
   ({ StrategyCounterplay, DynamicMapEvents, AsymmetricWarfare, BiomeSpawn, ProcGenObstacles })`,
  ctx
);
const { StrategyCounterplay: SC, DynamicMapEvents: D, AsymmetricWarfare: AW } = mods;
const { BiomeSpawn: BS, ProcGenObstacles: PG } = mods;

// --- one deck, two options, about one night in four --------------------------------------
{
  let omens = 0;
  let total = 0;
  for (let seed = 1; seed <= 10; seed++) {
    D.resetRun(`s${seed}`);
    for (let w = 3; w <= 200; w++) {
      total++;
      if (D.pickEvent(w)) omens++;
    }
  }
  const share = omens / total;
  ok(share > 0.22 && share < 0.3, `an omen on ${(share * 100).toFixed(1)}% of nights`);
  for (const o of Object.values(D.OMENS)) {
    ok(o.options.length === 2, `${o.id}: two options`);
  }
  D.resetRun('a');
  const a = [];
  for (let w = 3; w < 80; w++) a.push(D.pickEvent(w)?.id ?? '-');
  D.resetRun('b');
  const b = [];
  for (let w = 3; w < 80; w++) b.push(D.pickEvent(w)?.id ?? '-');
  ok(a.join() !== b.join(), 'two seeds deal different decks');
}

/** First wave on seed 'x' whose omen is `id`, with that omen prepared for tonight. */
function dealt(id, seed = 'x') {
  for (let w = 3; w < 4000; w++) {
    D.resetRun(seed);
    if (D.pickEvent(w)?.id === id) {
      D.prepareNextEvent(w, { worldW: 600, rallyY: 700, hooks: {} });
      return w;
    }
  }
  return -1;
}

// --- unanswered cards fall to the free option; raiders join or are turned back --------------
{
  const w = dealt('raiders');
  ok(w > 0, 'raiders are in the deck');
  const snap = D.getStateSnapshot(w, 0, true);
  ok(snap.event.defaultLabel === 'Let them come', 'the card names what happens if unanswered');
  D.applyForWave(w, { hooks: {} });
  const q = D.applyToQueue(w, ['goblin', 'goblin']);
  ok(q.length === 5, `unanswered raiders join the host (${q.length})`);

  dealt('raiders');
  let spent = 0;
  ok(
    !D.respond('turn_back', { tactical: 1, spendTp: (n) => (spent += n) }).ok,
    'a paid option needs the TP'
  );
  ok(D.respond('turn_back', { tactical: 5, spendTp: (n) => (spent += n) }).ok, 'paid answer');
  D.applyForWave(w, { hooks: {} });
  ok(spent === 2 && D.applyToQueue(w, ['goblin']).length === 1, 'raiders turned back for 2 TP');
}

// --- traps are laid only when left to stand ---------------------------------------------------
{
  const w = dealt('host_traps');
  ok(w >= 22 && D.hazardsLaid(w), 'unanswered traps are laid');
  D.respond('sweep', { tactical: 9, spendTp: () => {} });
  ok(!D.hazardsLaid(w), 'sweeping the field stops them');
}

// --- the host counters your build only when you let its scouts look --------------------------
{
  SC.resetRun();
  SC.detect({ signals: { wallCount: 6, castleValue: 100 } }, 25, []);
  ok(SC.getDetected().length > 0, 'the walls are noticed');
  D.resetRun('x');
  ok(SC.getActive().length === 0, 'no counters without the scouting omen');
  const w = dealt('host_scouts');
  ok(w >= 10 && SC.getActive().length > 0, 'unanswered scouts bring counters');
  ok(/Wall Fortress/.test(D.getStateSnapshot(w, 0, true).event.prep), 'the card names them');
  D.respond('hunt', { tactical: 9, spendTp: () => {} });
  ok(SC.getActive().length === 0, 'hunting the scouts keeps the counters away');
}

// --- weather: about a third of nights, and what each one does ------------------------------
{
  D.resetRun('w');
  const kinds = {};
  let wet = 0;
  for (let w = 3; w < 603; w++) {
    const r = D.rollWeather(w);
    if (r) {
      wet++;
      kinds[r.id] = (kinds[r.id] || 0) + 1;
    }
  }
  ok(wet > 150 && wet < 250, `weather on ${wet} of 600 nights`);
  ok(Object.keys(kinds).length === 4, `fog, rain, wind and frost all come (${Object.keys(kinds)})`);

  const nightOf = (id) => {
    for (let w = 3; w < 2000; w++) {
      D.resetRun('w');
      if (D.rollWeather(w)?.id === id) {
        D.prepareNextEvent(w, { hooks: {} });
        ok(D.getStateSnapshot(w, 0, true).weather?.id === id, `${id} is shown on the card`);
        D.applyForWave(w, { hooks: {} });
        return w;
      }
    }
    return -1;
  };
  const archer = { team: 'player', combatType: 'ranged', x: 100, y: 500 };
  const orcArcher = { team: 'enemy', combatType: 'ranged', x: 100, y: 100 };
  nightOf('fog');
  ok(D.rangeMult(archer) === 0.5 && D.rangeMult(orcArcher) === 0.5, 'fog halves reach');
  D.tick(1, 0, {
    units: [],
    buildings: [{ owner: 'player', complete: true, hp: 1, isWatchtower: true, x: 120, y: 500 }],
  });
  ok(D.rangeMult(archer) === 1, 'a watchtower lifts the fog near it');
  ok(D.rangeMult(orcArcher) === 0.5, 'but not for the enemy far from it');
  nightOf('rain');
  ok(D.weatherIs('rain'), 'rain is the weather');
  ok(D.speedMult({ team: 'enemy', combatType: 'cavalry' }) < 1, 'rain slows cavalry');
  ok(D.speedMult({ team: 'enemy', combatType: 'melee', speed: 1 }) === 1, 'not footmen');
  nightOf('frost');
  ok(D.speedMult({ team: 'player', speed: 1 }) < 1, 'frost slows everyone');
  nightOf('wind');
  const up = D.rangeMult(archer);
  const down = D.rangeMult(orcArcher);
  ok(up !== 1 && down !== 1 && up !== down, `wind favours one side (${up} vs ${down})`);
  D.prepareNextEvent(9999, { hooks: {} });
  ok(D.rangeMult(archer) === 1, 'the weather ends with its wave');
}

// --- an old save's three-option planet card still loads --------------------------------------
{
  saved.DynamicMapEvents.load({
    pending: {
      eventId: 'geothermal_surge',
      forWave: 14,
      choices: [{ id: 'tap' }, { id: 'vent' }, { id: 'ignore' }],
    },
    choiceId: 'ignore',
    activeMods: { enemyCountMult: 0.9 },
    deckSeed: 7,
  });
  const snap = D.getStateSnapshot(14, 0, true);
  ok(snap.event.choices.length === 2, 'the old card is rebuilt with two options');
  ok(snap.awaitingChoice, 'an old "ignore" answer is dropped, so the card can be answered');
  ok(D.respond('vent', { tactical: 0 }).ok, 'and answered');
}

// --- the hidden enemy scalers are gone --------------------------------------------------------
{
  const m = AW.getAsymmetricMods(12, 45);
  ok(
    m.enemyCountMult === 1 && m.enemyIntervalMult === 1 && m.eliteSlotBonus === 0,
    'host level no longer grows the enemy'
  );
  ok(BS.adjustSpawnCount(17, 60, { territoryTier: 6 }) === 17, 'terrain adds no bodies');
}

// --- outcrops: up to three per run, seeded, in no-man's-land ---------------------------------
{
  const one = PG.fieldOutcrops({ worldW: 900, rallyY: 700, seed: 42 });
  const two = PG.fieldOutcrops({ worldW: 900, rallyY: 700, seed: 42 });
  ok(one.length >= 1 && one.length <= 3, `${one.length} outcrops`);
  ok(JSON.stringify(one) === JSON.stringify(two), 'the same seed gives the same outcrops');
  ok(
    one.every((r) => r.y > 100 && r.y < 600 && r.radius <= 32 && r.blocksMove),
    'outcrops sit between the entry and the line'
  );
}

process.exit(failures() ? 1 : 0);
