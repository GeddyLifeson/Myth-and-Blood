import { quietField } from './lib.mjs';
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// 1. Mage Arcane Burst counter (swingN) and warg pounce state live on a copy for projectiles?
{
  const api = quietField({ seed: 3, wave: 5 });
  const m = api.ally('mage', 200, 450, { accuracy: 100 });
  const t = api.foe('orc', 200, 330, { set: { speed: 0, damage: 0, maxHp: 1e6, hp: 1e6 } });
  let shots = 0,
    last = t.hp;
  api.step(1500, () => {
    if (t.hp < last) shots++;
    last = t.hp;
  });
  console.log(
    '1. mage hits landed',
    shots,
    'mage.swingN =',
    m.swingN,
    '(undefined means the every-4th-attack burst can never trigger)'
  );
}
// 2. Enemy archer firing from the muster zone: does it become "mustered" (targetable)?
{
  const api = quietField({ seed: 4, wave: 5 });
  const a = api.ally('footman', 200, 410, { maxHp: 1e6, hp: 1e6, canHunt: false, huntMode: false });
  const e = api.foe('orc_archer', 200, 240, { mustered: false, set: { speed: 0 } });
  let fired = 0,
    last = a.hp,
    musteredAt = null;
  api.step(1200, (i) => {
    e.musterAge = 0;
    if (a.hp < last) fired++;
    last = a.hp;
    if (e.mustered && musteredAt == null) musteredAt = i;
  });
  console.log(
    '2. orc archer in muster zone: arrows that hit',
    fired,
    'became mustered at tick',
    musteredAt,
    '(null = still untargetable beyond 140 px while shooting)'
  );
}
// 3. Can a named boss rout? Boss + troll with goblins dying beside them.
{
  const api = quietField({ seed: 5, wave: 10 });
  const types = Object.keys(api.EnemyDefs).filter((t) => t.startsWith('boss_'));
  const boss = api.foe(types[0], 200, 300, { set: { speed: 0 } });
  const troll = api.foe('troll', 230, 300, { set: { speed: 0 } });
  const chief = api.foe('war_chief', 170, 300, { set: { speed: 0 } });
  const gobs = [];
  for (let i = 0; i < 5; i++)
    gobs.push(api.foe('goblin', 160 + i * 20, 320, { set: { hp: 1, speed: 0 } }));
  for (let i = 0; i < 6; i++)
    api.ally('archer', 150 + i * 20, 470, { accuracy: 100, experience: 30 });
  let fled = {};
  api.step(700, () => {
    for (const [n, u] of [
      ['boss', boss],
      ['troll', troll],
      ['war_chief', chief],
    ])
      if (u.fleeing) fled[n] = true;
  });
  console.log(
    '3.',
    types[0],
    'morale',
    boss.maxMorale,
    'fled:',
    !!fled.boss,
    '| troll (morale 18) fled:',
    !!fled.troll,
    '| war chief (25) fled:',
    !!fled.war_chief
  );
}
// 4. Healer rank per wave: heal amount by tier
{
  const api = quietField({ seed: 6, wave: 5 });
  const h = api.ally('healer', 200, 480);
  const row = [];
  for (let t = 0; t <= 6; t++) {
    row.push(`T${t}: heal ${h.healAmount} hp ${h.maxHp} range ${h.range}`);
    if (t < 6) api.upgradeVeteranUnit(h);
  }
  console.log('4.', row.join(' | '));
}
