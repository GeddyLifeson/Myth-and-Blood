/**
 * Factions lead waves. Over many waves the leading faction is 70-80% of the host with four
 * to seven kinds of enemy; every faction's tactic hook fires on the field; a boss wave is led
 * by the boss's own faction; a Seed Run builds the same waves every time.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const EXPORTS = `({ Game, SpriteGen, GameState, GameModes, EnemyFactions, HostTactics })`;

function start(mathSeed, runSeed) {
  const { sb, cvs } = boot(mathSeed);
  const api = vm.runInContext(`${code}\n${EXPORTS}`, vm.createContext(sb));
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  if (runSeed) {
    api.GameModes.init();
    api.GameModes.setMenuMode('seed');
    api.GameModes.setMenuSeed(runSeed);
  }
  api.Game.start();
  return api;
}

/** Dawn of wave `w` with nobody left from the last one; what was built is read back. */
function dawn(api, w) {
  const { Game, GameState: GS, EnemyFactions: EF, HostTactics: HT } = api;
  GS.units = GS.units.filter((u) => u.team !== 'enemy');
  GS.spawnQueue.length = 0;
  GS.timeOfDay = 'night';
  GS.wave = w - 1;
  Game.beginDayPhase(true);
  const plan = EF.getPlan(w);
  const state = HT.getState();
  return {
    wave: w,
    plan,
    queue: [...GS.spawnQueue],
    boss: GS.namedBossWave ? GS.namedBossWave.type : null,
    share: state.leadShare,
    kinds: state.kinds,
    state,
  };
}

const LAST_WAVE = 110;
const waves = (api, last = LAST_WAVE) => {
  const rows = [];
  for (let w = 1; w <= last; w++) rows.push(dawn(api, w));
  return rows;
};

// ---------------------------------------------------------------- the host's shape
{
  const api = start(4131);
  const EF = api.EnemyFactions;
  const rows = waves(api).filter((r) => r.wave >= 4);
  const bad = rows.filter((r) => !(r.share >= 0.7 && r.share <= 0.8));
  ok(
    bad.length === 0,
    `the leading faction is 70-80% of the host on waves 4-${LAST_WAVE} (${rows.length} waves; off: ${bad.map((r) => `${r.wave}:${r.share.toFixed(2)}`).join(' ') || 'none'})`
  );
  // The rebalanced opening fields hosts of five; four kinds in five bodies is a row of singles.
  const kinds = rows.filter((r) => r.kinds < (r.queue.length < 8 ? 3 : 4) || r.kinds > 7);
  ok(
    kinds.length === 0,
    `four to seven kinds of enemy on every wave, three in a host under eight (off: ${kinds.map((r) => `${r.wave}:${r.kinds}`).join(' ') || 'none'})`
  );
  const leads = new Set(rows.map((r) => r.plan.leadId));
  ok(leads.size >= 5, `at least five factions get to lead (${[...leads].join(', ')})`);
  const lead = rows.filter((r) => r.plan.kind === 'ordinary').map((r) => r.plan.leadId);
  let repeats = 0;
  for (let i = 1; i < lead.length; i++) if (lead[i] === lead[i - 1]) repeats++;
  ok(repeats <= lead.length * 0.2, `the lead rotates (${repeats} repeats in ${lead.length} waves)`);

  // The opening is hand-written and led by goblins.
  const open = dawn(api, 2);
  ok(open.plan.leadId === 'goblin_hordes', 'wave 2 is led by goblins');

  // Bosses come from the leading faction, on their own wave, and nowhere else.
  const bossWaves = rows.filter((r) => r.boss);
  ok(bossWaves.length >= 10, `${bossWaves.length} boss waves to check`);
  const wrong = bossWaves.filter(
    (r) =>
      r.plan.kind !== 'boss' || EF.getBossFaction(r.boss) !== r.plan.leadId || r.queue[0] !== r.boss
  );
  ok(
    wrong.length === 0,
    `every boss leads his own faction's wave (off: ${wrong.map((r) => r.wave).join(' ') || 'none'})`
  );
  const stray = rows.filter(
    (r) => !r.boss && r.queue.some((t) => t.startsWith('boss_') && t !== r.boss)
  );
  ok(
    stray.length === 0,
    `no named boss in an ordinary wave (off: ${stray.map((r) => r.wave).join(' ') || 'none'})`
  );
  const guards = bossWaves.filter((r) => {
    const own = r.queue.filter((t) => EF.getUnitFaction(t) === r.plan.leadId).length;
    return own / r.queue.length < 0.6;
  });
  ok(guards.length === 0, 'a boss wave is mostly his own faction');
}

// ----------------------------------------------------------------- horde flavours
{
  const api = start(99);
  const EF = api.EnemyFactions;
  const mismatch = [];
  const noKey = [];
  for (const h of EF.HORDES) {
    const plan = { wave: 40, seed: 5, kind: 'horde', horde: h.id, leadId: h.faction };
    plan.allyId = h.faction === 'goblin_hordes' ? 'orc_warbands' : 'goblin_hordes';
    plan.allyShare = 0.25;
    plan.tacticId = `horde:${h.id}`;
    const comp = EF.composeWave(plan, { count: 80 });
    const own = h.mix.map((m) => m.type);
    const n = comp.queue.filter((t) => own.includes(t)).length;
    if (n / comp.queue.length < 0.7) mismatch.push(`${h.id}:${(n / comp.queue.length).toFixed(2)}`);
    const t = EF.tacticForPlan(plan);
    if (!(t.dash || t.ambush || t.rush || t.runners > 0)) noKey.push(h.id);
  }
  ok(mismatch.length === 0, `a horde is what its name says (off: ${mismatch.join(' ') || 'none'})`);
  ok(
    noKey.length === 0,
    `every horde flavour plays differently (off: ${noKey.join(' ') || 'none'})`
  );
  ok(new Set(EF.HORDES.map((h) => h.id)).size >= 6, 'six horde flavours');
}

// ---------------------------------------------------------- a Seed Run is repeatable
{
  const shape = (api) =>
    JSON.stringify(
      waves(api, 70).map((r) => [
        r.plan.leadId,
        r.plan.allyId,
        r.plan.tacticId,
        r.plan.horde,
        r.boss,
        r.queue,
      ])
    );
  const a = shape(start(1, 'repeat-me'));
  const b = shape(start(2, 'repeat-me'));
  ok(a === b, 'a Seed Run builds the same waves twice, whatever else is random');
  const c = shape(start(1, 'a-different-seed'));
  ok(a !== c, 'a different seed builds different waves');
}

// -------------------------------------------------------------- tactic hooks fire
const FORCED_WAVE = 24;
const MAX_TICKS = 4000;

/**
 * Run wave 24 led by `lead` with the soldiers unhurt so the host reaches them. `poke` may act
 * mid-wave; the run ends once `done(fired, state)` is true, or after MAX_TICKS.
 */
function runLed(lead, done, poke) {
  const api = start(4131);
  const { Game, GameState: GS, EnemyFactions: EF, HostTactics: HT } = api;
  GS.timeOfDay = 'night';
  GS.wave = FORCED_WAVE - 1;
  const plan = EF.planFor(FORCED_WAVE, { seed: 7 });
  plan.leadId = lead;
  plan.tacticId = EF.HOSTS[lead].tactic;
  plan.kind = 'ordinary';
  Game.beginDayPhase(true);
  for (let t = 0; t < MAX_TICKS && GS.timeOfDay === 'day'; t++) {
    for (const u of GS.units) if (u.team === 'player') u.hp = u.maxHp;
    if (poke) poke(api, t);
    Game.update();
    if (t % 20 === 0 && done(HT.getState().fired, HT.getState())) break;
  }
  return { fired: HT.getState().fired, state: HT.getState(), tactic: plan.tacticId };
}

/** Put two of the host down: one by an ordinary blow, one by a blast. */
function killTwo(api, t) {
  const { Game, GameState: GS } = api;
  if (t !== 700 && t !== 710) return;
  const target = GS.units.find(
    (u) => u.team === 'enemy' && u.hostLead && u.hp > 0 && !u.risen && u.type !== 'siege_tower'
  );
  const soldier = GS.units.find((u) => u.team === 'player' && u.hp > 0);
  if (!target) return;
  target.hp = 1;
  Game.takeDamage(target, 60, { attacker: soldier, splash: t === 710 });
}

/**
 * Cut down the shieldbearers while the wall advances. Four footmen no longer hold wave 24
 * after the difficulty rebalance, so the test does the killing; what it checks is the break.
 */
function breakWall(api, t) {
  const { Game, GameState: GS, HostTactics: HT } = api;
  const fired = HT.getState().fired;
  if (t % 20 || !(fired.wall >= 3) || fired.charge) return;
  const soldier = GS.units.find((u) => u.team === 'player' && u.hp > 0) || null;
  for (const u of GS.units) {
    if (u.team !== 'enemy' || u.hp <= 0 || u.wallRole !== 'shield') continue;
    u.hp = 1;
    Game.takeDamage(u, 60, { attacker: soldier });
  }
}

const CASES = [
  ['goblin_hordes', 'swarm', (f) => f.runners > 0, null],
  ['orc_warbands', 'shield_wall', (f) => f.wall > 0 && f.broken > 0, breakWall],
  ['wild_hunt', 'flank_dash', (f) => f.dash > 0, null],
  ['dark_legions', 'risen', (f) => f.rise > 0 && f.laidToRest > 0, killTwo],
  ['void_abyssal', 'unseen', (f) => f.rift > 0 && f.ambush > 0, null],
  ['cinder_flight', 'air_raid', (f) => f.dive > 0 && f.burn > 0, null],
];
const WHAT = {
  swarm: 'runners dash for the line',
  shield_wall: 'the shield wall forms, then breaks into a charge',
  flank_dash: 'a pack sprints down the field edge',
  risen: 'a fallen foe rises and a blast lays one to rest',
  unseen: 'a rift opens behind the line and foes step out',
  air_raid: 'flyers dive and leave burning ground',
};
for (const [lead, tactic, done, poke] of CASES) {
  const r = runLed(lead, done, poke);
  ok(r.tactic === tactic, `${lead} plays ${tactic}`);
  ok(done(r.fired, r.state), `${tactic}: ${WHAT[tactic]} (${JSON.stringify(r.fired)})`);
}

process.exit(failures() ? 1 : 0);
