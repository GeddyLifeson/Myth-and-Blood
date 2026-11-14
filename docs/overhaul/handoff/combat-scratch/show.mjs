import { readFileSync } from 'fs';
for (const f of process.argv.slice(2)) {
  let o;
  try {
    o = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    console.log(f, 'unreadable', readFileSync(f, 'utf8').slice(0, 300));
    continue;
  }
  console.log(
    `${o.diff} seed ${o.seed} ${o.patches.join('+') || 'baseline'}${o.tent ? ' +tent' : ''}: wave ${o.wave} ${o.ended ? 'DEFEAT' : 'alive'} lost ${o.lost} breaches ${o.breaches}/${o.limit} ticks ${o.ticks} ${o.threw || ''}`
  );
  if (process.env.BRIEF) continue;
  console.log(
    'wave army  xp xpMax deaths breach kills maxFoes routs eRouts wound% endHp% dmg ticks tp'
  );
  for (const w of o.waves)
    console.log(
      [
        w.wave,
        w.army,
        w.xp,
        w.xpMax,
        w.deaths,
        w.breaches,
        w.kills,
        w.maxFoes,
        w.routs,
        w.eRouts,
        w.woundPct,
        w.endHpPct,
        w.dmg,
        w.ticks,
        w.tp,
      ]
        .map((v) => String(v).padStart(5))
        .join(' ')
    );
}
