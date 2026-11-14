// Skirmish scenarios: N player soldiers (fresh or with a veteran stat line) vs wave-W enemies.
// usage: node duel.mjs '<json config>'
import { PATCHES, buildCode, startGame } from './lib.mjs';
const cfg = JSON.parse(process.argv[2] || '{}');
const patches = (cfg.patches || []).map((s) => {
  const [n, a] = s.split('=');
  return PATCHES[n](a === undefined ? undefined : Number(a));
});
const code = buildCode(patches);
const TRIALS = cfg.trials || 20;
const MAXT = cfg.maxTicks || 5000;

function setup(seed) {
  const api = startGame({ diff: cfg.diff || 'normal', seed, code });
  const { Game, GameState: GS } = api;
  Game.beginDayPhase(true);
  for (let i = 0; i < 5; i++) Game.update();
  GS.spawnQueue = [];
  for (const u of GS.units) if (u.team !== 'player') u.hp = 0;
  let k = 0;
  for (const u of GS.units) {
    if (u.team !== 'player') continue;
    u.canHunt = false;
    u.huntMode = false;
    u.pinned = true;
    u.pinTimer = 1e9;
    u.x = 14 + 10 * k++;
    u.y = GS.worldH - 8;
    u.path = [];
    u.hp = u.maxHp = 1e7;
    u.maxMorale = u.morale = 1e6;
  }
  Game.update();
  const anchor = api.createUnit('orc', 6, 6, 'enemy');
  anchor.speed = 0;
  anchor.damage = 0;
  anchor.maxHp = anchor.hp = 1e7;
  anchor.isAnchor = true;
  GS.units.push(anchor);
  Game.beginDayPhase(true);
  GS.spawnQueue = [];
  GS.wave = cfg.wave || 1;
  GS.waveEnemyTotal = cfg.dusk ? 1000 : 0; // 0 = full daylight (no enemy sight penalty); dusk = worst case (-11)
  return api;
}
function mkPlayer(api, spec, x, y) {
  const GS = api.GameState;
  const u = api.createUnit(spec.type, x, y, 'player', { spawnWave: GS.wave });
  if (spec.line) {
    const l = spec.line;
    if (l.hp) u.maxHp = u.hp = l.hp;
    if (l.dmg != null) u.damage = l.dmg;
    if (l.acc != null) u.accuracy = l.acc;
    if (l.xp != null) u.experience = l.xp;
    if (l.mor != null) u.maxMorale = u.morale = l.mor;
    if (l.range) u.range = u.baseRange = l.range;
    if (l.heal) u.healAmount = l.heal;
  }
  GS.units.push(u);
  return u;
}
function mkEnemy(api, type, x, y) {
  const GS = api.GameState;
  const u = api.createUnit(type, x, y, 'enemy', { spawnSide: 'north', spawnWave: GS.wave });
  api.GameDepth.applyEnemySpawnScaling(u, GS.wave, {
    cfg: api.getWaveConfig(GS.wave),
    diff: api.getDifficultyDef(cfg.diff || 'normal'),
    waveModifiers: {},
  });
  api.Roster.onSpawn(u, GS.wave);
  u.mustered = true;
  u.huntMode = true;
  u.rotation = 90;
  GS.units.push(u);
  return u;
}
const res = {
  wins: 0,
  losses: 0,
  draws: 0,
  ticks: [],
  pLeft: [],
  eLeft: [],
  pHpLost: [],
  eRouted: [],
  pRouted: [],
  pDead: [],
};
let api = null;
for (let tr = 0; tr < TRIALS; tr++) {
  api = setup(1000 + tr * 77 + (cfg.seed0 || 0));
  const { Game, GameState: GS } = api;
  const W = GS.worldW,
    H = GS.worldH;
  const ps = [],
    es = [];
  const P = cfg.players,
    E = cfg.enemies;
  P.forEach((spec, i) =>
    ps.push(
      mkPlayer(
        api,
        spec,
        W / 2 + (i - (P.length - 1) / 2) * 34,
        H -
          150 +
          (spec.type === 'footman' || spec.type === 'knight' || spec.type === 'pikeman' ? 0 : 40)
      )
    )
  );
  E.forEach((type, i) =>
    es.push(
      mkEnemy(
        api,
        type,
        W / 2 + ((i % 10) - Math.min(9, E.length - 1) / 2) * 34,
        H - 150 - (cfg.gap || 300) - Math.floor(i / 10) * 30
      )
    )
  );
  const hp0 = ps.reduce((a, u) => a + u.maxHp, 0);
  let t = 0;
  // Dead units are purged and their objects recycled, so keep our own book per soldier.
  const book = (list) => list.map((u) => ({ u, id: u.id, alive: true, routed: false, hp: u.hp }));
  const pb = book(ps),
    eb = book(es);
  const tickBook = (b) => {
    for (const r of b) {
      if (!r.alive) continue;
      if (r.u.id !== r.id || !(r.u.hp > 0)) {
        r.alive = false;
        if (!r.routed) r.hp = 0;
        continue;
      }
      r.hp = r.u.hp;
      if (r.u.fleeing) r.routed = true;
    }
  };
  for (; t < MAXT; t++) {
    for (const u of GS.units)
      if (u.isAnchor) {
        u.mustered = false;
        u.musterAge = 0;
      }
    Game.update();
    tickBook(pb);
    tickBook(eb);
    const pa = pb.filter((r) => r.alive && !r.routed).length;
    const ea = eb.filter((r) => r.alive && !r.routed).length;
    if (!pa || !ea) break;
  }
  const pa = pb.filter((r) => r.alive && !r.routed).length;
  const ea = eb.filter((r) => r.alive && !r.routed).length;
  if (pa && !ea) res.wins++;
  else if (!pa) res.losses++;
  else res.draws++;
  res.ticks.push(t);
  res.pLeft.push(pa);
  res.eLeft.push(ea);
  res.pHpLost.push(hp0 - pb.reduce((a, r) => a + (r.alive ? r.hp : 0), 0));
  res.eRouted.push(eb.filter((r) => r.routed).length);
  res.pRouted.push(pb.filter((r) => r.routed).length);
  res.pDead.push(pb.filter((r) => !r.alive && !r.routed).length);
}
const mean = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(
  JSON.stringify({
    label: cfg.label,
    wave: cfg.wave,
    trials: TRIALS,
    win: res.wins,
    loss: res.losses,
    draw: res.draws,
    ticks: mean(res.ticks),
    pLeft: mean(res.pLeft),
    pDead: mean(res.pDead),
    pRouted: mean(res.pRouted),
    eLeft: mean(res.eLeft),
    eRouted: mean(res.eRouted),
    pHpLost: mean(res.pHpLost),
    world: [api.GameState.worldW, api.GameState.worldH],
  })
);
