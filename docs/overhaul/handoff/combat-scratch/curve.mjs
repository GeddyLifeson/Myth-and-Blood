// Enemy rank-and-file stat lines per wave and difficulty, straight from the game's own spawn scaling.
import { startGame } from './lib.mjs';
const waves = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40];
const meanCd = (xp, reload = 1) => {
  let s = 0;
  for (let r = 0; r < 20; r++) s += Math.max(12, Math.floor((90 - xp * 4 + r) * reload));
  return s / 20;
};
const out = {};
for (const diff of ['baby', 'normal', 'chad', 'doomslayer']) {
  const api = startGame({ diff, seed: 5 });
  const d = api.getDifficultyDef(diff);
  out[diff] = [];
  for (const w of waves) {
    const cfg = api.getWaveConfig(w);
    const row = {
      wave: w,
      count: Math.floor(
        cfg.count *
          (w >= 3 ? d.enemyCountMult : 1 + (d.enemyCountMult - 1) * (w <= 1 ? 1 / 3 : 2 / 3))
      ),
      cfgHp: +cfg.hpScale.toFixed(2),
      cfgDmg: +cfg.dmgScale.toFixed(2),
      interval: cfg.interval,
    };
    for (const type of ['goblin', 'orc', 'orc_archer', 'troll', 'dark_knight', 'berserker']) {
      const u = api.createUnit(type, 100, 100, 'enemy', { spawnWave: w });
      api.GameDepth.applyEnemySpawnScaling(u, w, { cfg, diff: d, waveModifiers: {} });
      api.Roster.onSpawn(u, w);
      const melee = u.combatType === 'melee';
      const dmg = u.damage + (melee ? 5.5 : 3.5);
      const dps = (((u.accuracy / 100) * dmg) / meanCd(0)) * 60;
      row[type] = {
        hp: u.maxHp,
        dmg: u.damage,
        acc: u.accuracy,
        mor: u.maxMorale,
        dps: +dps.toFixed(1),
      };
    }
    out[diff].push(row);
  }
}
console.log(JSON.stringify(out));
