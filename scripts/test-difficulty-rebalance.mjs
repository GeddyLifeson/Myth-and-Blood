/**
 * Difficulty rebalance: veteran growth is bounded, the enemy wave scale reaches every enemy
 * type, and named bosses are tougher, cannot be pinned and do not rout.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const opt = (name) => `typeof ${name} !== 'undefined' ? ${name} : null`;

function start(seed = 4000) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, GameState, createUnit, addVetStar, upgradeVeteranUnit,
      trySpecialistRank, EnemyDefs, GameDepth, getWaveConfig, getDifficultyDef,
      getAttackBaseTicks: ${opt('getAttackBaseTicks')},
      getExperienceDamageBonus: ${opt('getExperienceDamageBonus')} })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}

/** A quiet day: the opening squad is parked in a corner and one inert anchor keeps the wave open. */
function quietField(seed) {
  const api = start(seed);
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
  api.step = (n, each) => {
    for (let i = 0; i < n; i++) {
      for (const u of GS.units) {
        if (u.isAnchor) {
          u.mustered = false;
          u.musterAge = 0;
        }
      }
      Game.update();
      each?.(i);
    }
  };
  return api;
}

const player = (api, type, x, y, set = {}) => {
  const u = api.createUnit(type, x, y, 'player', { spawnWave: api.GameState.wave });
  Object.assign(u, set);
  api.GameState.units.push(u);
  return u;
};
const enemy = (api, type, x, y, set = {}) => {
  const u = api.createUnit(type, x, y, 'enemy', { spawnSide: 'north' });
  u.mustered = true;
  u.huntMode = true;
  Object.assign(u, set);
  api.GameState.units.push(u);
  return u;
};

// 1. Veteran growth is bounded.
{
  const api = start();
  const stats = (u) => ({ hp: u.maxHp, dmg: u.damage, acc: u.accuracy, range: u.range });
  const grown = (type, stars) => {
    const u = api.createUnit(type, 100, 100, 'player');
    const fresh = stats(u);
    for (let i = 0; i < stars; i++) api.addVetStar(u, 'bronze');
    return { fresh, now: stats(u), unit: u };
  };

  const a = grown('footman', 120);
  const b = grown('footman', 1200);
  ok(
    JSON.stringify(a.now) === JSON.stringify(b.now),
    `footman stats stop growing with stars (${JSON.stringify(a.now)} vs ${JSON.stringify(b.now)})`
  );
  ok(b.now.hp <= a.fresh.hp * 1.5, `footman health at the star cap stays under x1.5 (${b.now.hp})`);
  ok(
    b.now.dmg <= a.fresh.dmg * 1.6,
    `footman damage at the star cap stays under x1.6 (${b.now.dmg})`
  );

  const archer = grown('archer', 1200);
  ok(
    archer.now.range === archer.fresh.range,
    `stars give an archer no range (${archer.fresh.range} -> ${archer.now.range})`
  );
  ok(
    archer.now.acc <= archer.fresh.acc + 12,
    `archer accuracy at the star cap stays near its start (${archer.fresh.acc} -> ${archer.now.acc})`
  );

  const promoted = api.createUnit('archer', 100, 100, 'player');
  const base = stats(promoted);
  for (let i = 0; i < 6; i++) api.upgradeVeteranUnit(promoted);
  ok(promoted.maxHp <= base.hp * 2.1, `six promotions at most double health (${promoted.maxHp})`);
  ok(promoted.damage <= base.dmg * 2, `six promotions at most double damage (${promoted.damage})`);
  ok(promoted.range <= base.range, `promotion gives no range (${base.range} -> ${promoted.range})`);

  const rank = (waves) => {
    const h = api.createUnit('healer', 100, 100, 'player');
    for (let w = 0; w < waves; w++) {
      h.specialistRankedThisWave = false;
      api.trySpecialistRank(h);
    }
    return h;
  };
  ok(rank(2).vetTier === 0, 'a healer is still unranked after two working waves');
  ok(rank(3).vetTier === 1, 'a healer earns its first rank on the third working wave');
  const old = rank(60);
  ok(old.vetTier === 6, `a healer reaches the top rank (${old.vetTier})`);
  ok(old.healAmount <= 130, `a top rank healer's heal stays bounded (${old.healAmount})`);

  ok(typeof api.getAttackBaseTicks === 'function', 'attack interval comes from one helper');
  if (api.getAttackBaseTicks) {
    ok(
      api.getAttackBaseTicks(14) === api.getAttackBaseTicks(5000),
      'experience past the cap does not speed attacks'
    );
    ok(api.getAttackBaseTicks(14) >= 40, 'a capped veteran still takes 40 ticks or more');
    ok(api.getExperienceDamageBonus(5000) <= 10, 'experience adds at most 10 damage');
  }

  const swings = (xp) => {
    const f = quietField(7);
    const dummy = enemy(f, 'orc', 200, 300, { speed: 0, damage: 0, maxHp: 1e9, hp: 1e9 });
    dummy.mustered = false;
    player(f, 'footman', 200, 316, {
      experience: xp,
      accuracy: 100,
      huntMode: true,
      canHunt: true,
      morale: 1e6,
      maxMorale: 1e6,
      hp: 1e6,
      maxHp: 1e6,
    });
    f.step(3000);
    return 1e9 - dummy.hp;
  };
  const capped = swings(14);
  const huge = swings(5000);
  ok(
    huge <= capped * 1.5,
    `a footman with 5000 experience hits no harder than one with 14 (${Math.round(huge)} vs ${Math.round(capped)})`
  );
}

// 2. The enemy scale reaches every enemy type.
{
  const api = start();
  const types = Object.keys(api.EnemyDefs);
  ok(types.length >= 40, `enemy roster has ${types.length} types`);
  const WAVE = 15;
  const cfg = api.getWaveConfig(WAVE);
  const scaled = (type, cfgOverride, diffOverride) => {
    const u = api.createUnit(type, 100, 100, 'enemy');
    api.GameDepth.ensureEnemyBaseStats(u);
    const base = { hp: u.maxHp, dmg: u.damage };
    api.GameDepth.applyEnemySpawnScaling(u, WAVE, {
      cfg: cfgOverride || cfg,
      diff: diffOverride || api.getDifficultyDef('normal'),
      waveModifiers: {},
    });
    return { base, hp: u.maxHp, dmg: u.damage };
  };
  const below = [];
  const hpDead = [];
  const dmgDead = [];
  const diffDead = [];
  for (const type of types) {
    const lo = scaled(type, { hpScale: 1, dmgScale: 1 });
    const hi = scaled(type, { hpScale: 6, dmgScale: 6 });
    const normal = scaled(type);
    if (lo.base.hp > 0 && normal.hp < Math.floor(lo.base.hp * cfg.hpScale) - 1) below.push(type);
    if (!(hi.hp > lo.hp)) hpDead.push(type);
    if (lo.base.dmg > 0 && !(hi.dmg > lo.dmg)) dmgDead.push(type);
    const tough = scaled(type, null, { ...api.getDifficultyDef('normal'), waveHpScaleMult: 2 });
    if (!(tough.hp >= normal.hp * 1.9)) diffDead.push(type);
  }
  ok(below.length === 0, `every type has at least the wave health scale (short: ${below})`);
  ok(hpDead.length === 0, `cfg.hpScale moves every type's health (dead: ${hpDead})`);
  ok(dmgDead.length === 0, `cfg.dmgScale moves every type's damage (dead: ${dmgDead})`);
  ok(
    diffDead.length === 0,
    `difficulty waveHpScaleMult moves every type's health (dead: ${diffDead})`
  );

  const goblin = scaled('goblin');
  const troll = scaled('troll');
  ok(
    troll.hp / troll.base.hp >= cfg.hpScale * 0.98,
    `a wave-15 troll carries the wave scale (x${(troll.hp / troll.base.hp).toFixed(2)} of x${cfg.hpScale.toFixed(2)})`
  );
  ok(goblin.hp > goblin.base.hp, 'a wave-15 goblin is stronger than its base');
}

// 3. Bosses scale, cannot be pinned and do not rout.
{
  const api = start();
  const bossType = api.GameDepth.NAMED_BOSS_ROSTER[0].type;
  const boss = api.createUnit(bossType, 100, 100, 'enemy');
  api.GameDepth.ensureEnemyBaseStats(boss);
  api.GameDepth.applyEnemySpawnScaling(boss, 10, {
    cfg: api.getWaveConfig(10),
    diff: api.getDifficultyDef('normal'),
    waveModifiers: {},
    namedBossScale: 1,
  });
  const hpScale = api.getWaveConfig(10).hpScale;
  ok(boss.isNamedBoss, `${bossType} is a named boss`);
  ok(
    boss.maxHp >= boss.baseMaxHp * hpScale * 2.9,
    `a wave-10 boss has three times the wave scaled base health (${boss.maxHp} from ${boss.baseMaxHp})`
  );

  const probe = (type, withMates, set = {}) => {
    const f = quietField(11);
    const target = enemy(f, type, 200, 300, { hp: 1e6, maxHp: 1e6, morale: 0, ...set });
    target.mustered = false;
    const mates = [];
    for (let i = 0; withMates && i < 4; i++) {
      mates.push(enemy(f, 'goblin', 170 + i * 20, 308, { hp: 1, maxHp: 1 }));
    }
    for (let i = 0; i < 4; i++) {
      player(f, 'footman', 150 + i * 30, 330, {
        damage: 400,
        accuracy: 100,
        huntMode: true,
        canHunt: true,
        morale: 1e6,
        maxMorale: 1e6,
        hp: 1e6,
        maxHp: 1e6,
      });
    }
    let fled = false;
    let pinned = false;
    f.step(900, () => {
      if (target.fleeing) fled = true;
      if (target.pinned) pinned = true;
    });
    return { fled, pinned };
  };
  ok(probe('orc', true).fled, 'control: a grunt at zero morale routs when its mates die');
  ok(probe('orc', false).pinned, 'control: a grunt at zero morale is pinned when hit');
  ok(!probe('dark_knight', true).fled, 'an operative does not rout');
  ok(!probe(bossType, true).fled, 'a named boss does not rout');
  ok(!probe(bossType, false).pinned, 'a named boss cannot be pinned');
}

if (failures()) {
  console.error(`${failures()} check(s) failed`);
  process.exit(1);
}
console.log('difficulty rebalance: all checks passed');
