import { quietField } from './lib.mjs';
let fledN = 0,
  N = 8;
for (let s = 0; s < N; s++) {
  const api = quietField({ seed: 50 + s, wave: 10 });
  const boss = api.foe('boss_gorath', 200, 300, { set: { speed: 0 } });
  const info = { morale: boss.maxMorale, named: boss.isNamedBoss, hp: boss.maxHp, id: boss.id };
  for (let i = 0; i < 5; i++) api.foe('goblin', 160 + i * 20, 325, { set: { hp: 1, speed: 0 } });
  for (let i = 0; i < 6; i++)
    api.ally('archer', 150 + i * 20, 470, { accuracy: 100, experience: 30, damage: 1 });
  let fledAt = null,
    hpAtFlee = null;
  api.step(900, (i) => {
    if (boss.id === info.id && boss.fleeing && fledAt == null) {
      fledAt = i;
      hpAtFlee = Math.round(boss.hp);
    }
  });
  if (fledAt != null) fledN++;
  if (s < 3) console.log(JSON.stringify(info), 'fled at tick', fledAt, 'with hp', hpAtFlee);
}
console.log(`boss routed in ${fledN}/${N} trials after goblins died beside it`);
