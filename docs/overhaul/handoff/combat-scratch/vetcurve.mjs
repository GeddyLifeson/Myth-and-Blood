// Stat line of a soldier who has survived since wave 1, using the game's own star/tier functions.
import { startGame, PATCHES, buildCode } from './lib.mjs';
const patchName = process.argv[2];
const code = patchName ? buildCode([PATCHES[patchName]()]) : undefined;
const api = startGame({ seed: 9, ...(code ? { code } : {}) });
const meanCd = (xp, reload = 1) => {
  let s = 0;
  for (let r = 0; r < 20; r++) s += Math.max(12, Math.floor((90 - xp * 4 + r) * reload));
  return s / 20;
};
const meanCdP1 = (xp) => {
  let s = 0;
  for (let r = 0; r < 20; r++) s += Math.max(12, 90 - Math.min(14, xp) * 3 + r);
  return s / 20;
};
const WAVES = [1, 5, 10, 15, 20, 30];
function grow(type, killsPerWave, killXp = patchName === 'P1' ? 1 : 2) {
  const u = api.createUnit(type, 100, 100, 'player');
  if (type === 'footman') {
    u.maxHp = Math.floor(u.maxHp * 1.05);
    u.hp = u.maxHp;
  } // kingdom stage 1 defence bonus
  const rows = [];
  let carry = 0;
  for (let w = 1; w <= 30; w++) {
    if (WAVES.includes(w)) {
      const melee = u.combatType === 'melee';
      const xpDmg =
        patchName === 'P1'
          ? Math.floor(Math.min(30, u.experience) / 3)
          : Math.floor(u.experience / 3) * 2;
      const perHit = u.damage + (melee ? 5.5 : 3.5) + xpDmg;
      const cd = patchName === 'P1' ? meanCdP1(u.experience) : meanCd(u.experience);
      const dps = (((u.accuracy / 100) * perHit) / cd) * 60 * (type === 'archer' ? 1.2 : 1);
      rows.push({
        wave: w,
        hp: u.maxHp,
        dmg: +u.damage.toFixed(1),
        acc: u.accuracy,
        xp: u.experience,
        mor: u.maxMorale,
        range: u.range,
        baseRange: u.baseRange,
        perHit: +perHit.toFixed(1),
        cd: +cd.toFixed(1),
        dps: +dps.toFixed(1),
        stars: u.vetBronze + 3 * u.vetSilver + 9 * u.vetGold,
        golds: u.goldStarsEarned,
      });
    }
    // this wave: kills then survival
    carry += killsPerWave;
    while (carry >= 1) {
      carry -= 1;
      u.experience += killXp;
      api.addVetStar(u);
    }
    u.experience += 1;
    api.addVetStar(u);
  }
  return rows;
}
const out = {
  footman_0kills: grow('footman', 0),
  footman_typical: grow('footman', 0.15),
  archer_0kills: grow('archer', 0),
  archer_typical: grow('archer', 1),
  archer_top: grow('archer', 3.5),
};
// paid promotions
const tiers = {};
for (const type of ['footman', 'archer', 'knight']) {
  const u = api.createUnit(type, 100, 100, 'player');
  tiers[type] = [];
  for (let t = 0; t <= 6; t++) {
    tiers[type].push({
      t,
      hp: u.maxHp,
      dmg: u.damage,
      acc: u.accuracy,
      xp: u.experience,
      mor: u.maxMorale,
      range: u.baseRange,
    });
    if (t < 6) api.upgradeVeteranUnit(u);
  }
}
out.tiers = tiers;
console.log(JSON.stringify(out));
