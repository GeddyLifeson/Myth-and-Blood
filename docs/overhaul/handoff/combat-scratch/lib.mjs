// Scratch harness for the combat-core audit. Reads the repo, never writes to it.
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
const REPO = '/home/claude/myth-and-blood';
const { JS, HEADLESS_FILES } = await import(join(REPO, 'scripts/headless-manifest.mjs'));
const { boot } = await import(join(REPO, 'scripts/lib/harness.mjs'));
const BASE = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

/** Named source patches (counterfactuals). Each is [find, replace]; must match. */
export const PATCHES = {
  // experience no longer speeds attacks or adds damage beyond the starting value
  xpCap: (cap) => [
    [
      /const baseCd = 90 - \(unit\.experience \|\| 0\) \* 4/g,
      `const baseCd = 90 - Math.min(${cap}, unit.experience || 0) * 4`,
    ],
    [
      /dmg \+= Math\.floor\(\(unit\.experience \|\| 0\) \/ 3\) \* 2;/g,
      `dmg += Math.floor(Math.min(${cap}, unit.experience || 0) / 3) * 2;`,
    ],
  ],
  xpCdOnly: (cap) => [
    [
      /const baseCd = 90 - \(unit\.experience \|\| 0\) \* 4/g,
      `const baseCd = 90 - Math.min(${cap}, unit.experience || 0) * 4`,
    ],
  ],
  xpDmgOnly: (cap) => [
    [
      /dmg \+= Math\.floor\(\(unit\.experience \|\| 0\) \/ 3\) \* 2;/g,
      `dmg += Math.floor(Math.min(${cap}, unit.experience || 0) / 3) * 2;`,
    ],
  ],
  noStars: () => [
    [
      /function applyVeteranStarBump\(unit, starTier\) \{/,
      'function applyVeteranStarBump(unit, starTier) { return;',
    ],
  ],
  noHealerRank: () => [
    [/function trySpecialistRank\(unit\) \{/, 'function trySpecialistRank(unit) { return null;'],
  ],
  noMedSeek: () => [[/const MED_SEEK_HP_RATIO = 1;/, 'const MED_SEEK_HP_RATIO = 0;']],
  noAssist: () => [
    [
      /function findSquadAssistTarget\(unit\) \{/,
      'function findSquadAssistTarget(unit) { return null;',
    ],
  ],
  enemyAcc: (add) => [
    [
      /unit\.accuracy = Math\.min\(85, unit\.accuracy \+ Math\.min\(30, wave \* 1\.5\)\);/,
      `unit.accuracy = Math.min(95, unit.accuracy + Math.min(30, wave * 1.5) + ${add});`,
    ],
  ],
  noPinImmunity: () => [
    [/if \(unit\.team === 'enemy'\) unit\.pinImmuneUntil = GS\.updateTick \+ 290;/, ''],
  ],
  noEnemyPin: () => [
    [
      /!\(unit\.team === 'enemy' && \(unit\.pinImmuneUntil \|\| 0\) > GS\.updateTick\) &&/,
      `unit.team !== 'enemy' &&`,
    ],
  ],
  noBrace: () => [[/if \(p\.brace && unit\.braceN > 0\) \{/, 'if (false) {']],
  noMuster: () => [[/function isMustering\(foe\) \{/, 'function isMustering(foe) { return false;']],
  noEnemyRout: () => [
    [
      /function triggerMoraleBreak\(unit, reason\) \{/,
      "function triggerMoraleBreak(unit, reason) { if (unit.team === 'enemy') return;",
    ],
  ],
  noPlayerRout: () => [
    [
      /function triggerMoraleBreak\(unit, reason\) \{/,
      "function triggerMoraleBreak(unit, reason) { if (unit.team === 'player') return;",
    ],
  ],
  enemyXp: (n) => [
    [
      /u\.experience = def\.experience \|\| 0;/,
      `u.experience = def.experience || (team === 'enemy' ? ${n} : 0);`,
    ],
  ],
};

// ---- rebalance trial patch sets -------------------------------------------------------
const ROUT_FIX = [
  [
    /let moraleLoss = closeWitness \? 3 : 2;/,
    "let moraleLoss = observer.team === 'enemy' ? (closeWitness ? 2 : 1) : closeWitness ? 3 : 2;",
  ],
  [
    /observer\.witnessDeaths >= MORALE_WITNESS_BREAK_COUNT \|\|/,
    "(observer.team !== 'enemy' && observer.witnessDeaths >= MORALE_WITNESS_BREAK_COUNT) ||",
  ],
  [
    /function triggerMoraleBreak\(unit, reason\) \{/,
    "function triggerMoraleBreak(unit, reason) { if (unit.team === 'enemy' && (unit.isEvilOperative || unit.isNamedBoss)) return;",
  ],
  [/\? Math\.max\(4, p\.accuracy - getSightPenaltyForUnit\(shooter\)\)/, '? p.accuracy'],
];
PATCHES.routFix = () => ROUT_FIX;
// Option 1: slow veteran growth. cdCap/cdStep/dmgCap can be overridden: P1=cdStep (default 3)
PATCHES.P1 = (cdStep = 3) => [
  [
    /const baseCd = 90 - \(unit\.experience \|\| 0\) \* 4/g,
    `const baseCd = 90 - Math.min(14, unit.experience || 0) * ${cdStep}`,
  ],
  [
    /dmg \+= Math\.floor\(\(unit\.experience \|\| 0\) \/ 3\) \* 2;/,
    'dmg += Math.floor(Math.min(30, unit.experience || 0) / 3);',
  ],
  [
    /killer\.experience = \(killer\.experience \|\| 0\) \+ 2 \+ SiegeLoop\.killXpBonus\(\);/,
    'killer.experience = (killer.experience || 0) + 1 + SiegeLoop.killXpBonus();',
  ],
  [
    /function applyVeteranStarBump\(unit, starTier\) \{/,
    'function applyVeteranStarBump(unit, starTier) { if (unit && !isSpecialistUnit(unit)) { unit.starBumps = (unit.starBumps || 0) + 1; if (unit.starBumps > 18) return; }',
  ],
  [/return Math\.max\(current \+ minGain, next\);/, 'return current * mult;'],
  [/bumpUnitRange\(unit, s\.secondary\);/, ''],
  [
    /if \(!isSpecialistUnit\(unit\) \|\| unit\.specialistRankedThisWave\) return null;\n  unit\.specialistRankedThisWave = true;/,
    'if (!isSpecialistUnit(unit) || unit.specialistRankedThisWave) return null;\n  unit.specialistRankedThisWave = true;\n  unit.specWaves = (unit.specWaves || 0) + 1; if (unit.specWaves % 3) return null;',
  ],
  [
    /unit\.healAmount = Math\.floor\(\(unit\.healAmount \|\| 20\) \* \(1\.28 \+ t \* 0\.06\)\);/,
    'unit.healAmount = Math.floor((unit.healAmount || 20) * (1.12 + t * 0.02));',
  ],
  [
    /unit\.range = Math\.floor\(unit\.range \* \(1\.1 \+ t \* 0\.03\)\);/,
    'unit.range = Math.floor(unit.range * (1.04 + t * 0.01));',
  ],
  ...ROUT_FIX,
];
// Option 2: keep veteran growth, scale the enemy to match.
PATCHES.P2 = (xpPerWave = 0.9) => [
  [
    /unit\.accuracy = Math\.min\(85, unit\.accuracy \+ Math\.min\(30, wave \* 1\.5\)\);/,
    `unit.accuracy = Math.min(85, unit.accuracy + Math.min(30, wave * 1.5)); unit.experience = Math.min(20, Math.floor(wave * ${xpPerWave}));`,
  ],
  [
    /hp: 1 \+ eased \* 0\.58 \+ post \* 0\.32 \+ early \* 0\.04,/,
    'hp: 1 + eased * 0.58 + post * 0.32 + early * 0.09,',
  ],
  [
    /dmg: 1 \+ eased \* 0\.38 \+ post \* 0\.2 \+ early \* 0\.035,/,
    'dmg: 1 + eased * 0.38 + post * 0.2 + early * 0.06,',
  ],
  [
    /getEvilOperativeWaveScale\(wave\) \{\n    return this\.getIpWaveScale\(wave\);/,
    'getEvilOperativeWaveScale(wave) {\n    const s = this.getIpWaveScale(wave); const e = Math.min(40, Math.max(0, wave - 2)); return { hp: s.hp + e * 0.06, dmg: s.dmg + e * 0.04 };',
  ],
  ...ROUT_FIX,
];

export function buildCode(patchList = []) {
  let code = BASE;
  for (const p of patchList) {
    for (const [find, rep] of p) {
      const before = code;
      code = code.replace(find, rep);
      if (code === before) throw new Error('patch did not match: ' + find);
    }
  }
  return code;
}

export function startGame({ diff = 'normal', seed = 4000, code = BASE, creative = false } = {}) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameState, createUnit, createBuilding, UnitDefs, EnemyDefs, GameDepth, Roster, getWaveConfig, getDifficultyDef, addVetStar, upgradeVeteranUnit, BuildDefs, Research: typeof Research!=='undefined'?Research:null })`,
    vm.createContext(sb)
  );
  api.sb = sb;
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty(diff);
  api.Game.start(creative ? { creative: true } : undefined);
  return api;
}
export { BASE, REPO };

/** A quiet daytime field with the opening squad parked and one inert anchor enemy keeping the wave open. */
export function quietField(opts = {}) {
  const api = startGame(opts);
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
  GS.wave = opts.wave || 5;
  GS.waveEnemyTotal = 0;
  api.step = (n, each) => {
    for (let i = 0; i < n; i++) {
      for (const u of GS.units)
        if (u.isAnchor) {
          u.mustered = false;
          u.musterAge = 0;
        }
      Game.update();
      each?.(i);
    }
  };
  api.foe = (type, x, y, o = {}) => {
    const u = api.createUnit(type, x, y, 'enemy', { spawnSide: 'north', spawnWave: GS.wave });
    if (o.scale !== false) {
      api.GameDepth.applyEnemySpawnScaling(u, GS.wave, {
        cfg: api.getWaveConfig(GS.wave),
        diff: api.getDifficultyDef(opts.diff || 'normal'),
        waveModifiers: {},
      });
      api.Roster.onSpawn(u, GS.wave);
    }
    u.mustered = o.mustered !== false;
    u.huntMode = true;
    u.rotation = 90;
    Object.assign(u, o.set || {});
    GS.units.push(u);
    return u;
  };
  api.ally = (type, x, y, set = {}) => {
    const u = api.createUnit(type, x, y, 'player', { spawnWave: GS.wave });
    Object.assign(u, set);
    GS.units.push(u);
    return u;
  };
  return api;
}
