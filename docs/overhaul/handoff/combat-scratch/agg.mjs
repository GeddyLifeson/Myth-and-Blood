// Markdown tables from out/*.json
import { readFileSync, readdirSync } from 'fs';
const load = (f) => {
  try {
    return JSON.parse(readFileSync('out/' + f, 'utf8'));
  } catch {
    return null;
  }
};
const files = readdirSync('out').filter((f) => f.endsWith('.json'));
const runs = Object.fromEntries(
  files.map((f) => [f.replace('.json', ''), load(f)]).filter(([, v]) => v && v.waves)
);
const rng = (a) =>
  a.length
    ? Math.min(...a) === Math.max(...a)
      ? `${a[0]}`
      : `${Math.min(...a)}-${Math.max(...a)}`
    : '-';
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const outcome = (r) =>
  r.ended ? `defeat W${r.wave}` : r.threw ? `${r.threw} W${r.wave}` : `alive W${r.wave}`;
const band = (r, lo, hi, k) =>
  sum(r.waves.filter((w) => w.wave >= lo && w.wave <= hi).map((w) => w[k] || 0));
const mode = process.argv[2] || 'all';
if (mode === 'all' || mode === 'base') {
  console.log('### Baseline by difficulty (bot, 3 seeds)\n');
  console.log(
    '| Difficulty | Outcome per seed | Deaths W1-5 | W6-10 | W11-15 | W16-20 | W21+ | Breaches (limit) | Army at W10 / W15 / W20 | Mean XP at W10 / W15 / W20 |'
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const d of ['baby', 'normal', 'chad', 'doomslayer']) {
    const rs = Object.entries(runs)
      .filter(([k]) => k.startsWith(`base-${d}-`))
      .map(([, v]) => v);
    if (!rs.length) continue;
    const at = (w, k) =>
      rng(
        rs
          .map((r) => r.waves.find((x) => x.wave === w)?.[k])
          .filter((v) => v != null)
          .map((v) => Math.round(v))
      );
    console.log(
      `| ${d} | ${rs.map(outcome).join('; ')} | ${rng(rs.map((r) => band(r, 1, 5, 'deaths')))} | ${rng(rs.map((r) => band(r, 6, 10, 'deaths')))} | ${rng(rs.map((r) => band(r, 11, 15, 'deaths')))} | ${rng(rs.map((r) => band(r, 16, 20, 'deaths')))} | ${rng(rs.map((r) => band(r, 21, 99, 'deaths')))} | ${rs.map((r) => `${r.breaches}/${r.limit}`).join(', ')} | ${at(10, 'army')} / ${at(15, 'army')} / ${at(20, 'army')} | ${at(10, 'xp')} / ${at(15, 'xp')} / ${at(20, 'xp')} |`
    );
  }
  console.log('\n### Normal, per wave (3 seeds; ranges)\n');
  console.log(
    '| Wave | Army | Mean XP | Max XP | Deaths | Wounded share % | Breaches | Enemies seen at once (max) | Kills | Enemies routed | Player routs | HP lost by army | Ticks to clear |'
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const rs = Object.entries(runs)
    .filter(([k]) => k.startsWith('base-normal-'))
    .map(([, v]) => v);
  for (const w of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 22, 24]) {
    const rows = rs.map((r) => r.waves.find((x) => x.wave === w)).filter(Boolean);
    if (!rows.length) continue;
    const g = (k) => rng(rows.map((x) => Math.round(x[k])));
    console.log(
      `| ${w} | ${g('army')} | ${g('xp')} | ${g('xpMax')} | ${g('deaths')} | ${g('woundPct')} | ${g('breaches')} | ${g('maxFoes')} | ${g('kills')} | ${g('eRouts')} | ${g('routs')} | ${g('dmg')} | ${g('ticks')} |`
    );
  }
}
if (mode === 'all' || mode === 'cf') {
  console.log('\n### Counterfactuals (Normal, to wave 16)\n');
  console.log(
    '| Change | Seeds | Outcome | Deaths by W5 | by W10 | by W15 | Breaches | HP lost W1-15 | Enemy routs W1-15 | Mean XP at W15 |'
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  const groups = {};
  for (const [k, v] of Object.entries(runs)) {
    let name = null;
    if (k.startsWith('base-normal-')) name = 'baseline (live game)';
    else if (k.startsWith('cf-')) name = k.replace(/^cf-/, '').replace(/-\d+$/, '');
    else if (/^p[12]-/.test(k)) name = k.replace(/-\d+$/, '').toUpperCase() + ' (rebalance trial)';
    if (name) (groups[name] ||= []).push(v);
  }
  for (const [name, rs] of Object.entries(groups)) {
    const cut = (r, hi, k) => band(r, 1, hi, k);
    const br15 = rs.map((r) => band(r, 1, 15, 'breaches') + (r.ended && r.wave <= 15 ? '+' : ''));
    console.log(
      `| ${name} | ${rs.map((r) => r.seed).join(', ')} | ${rs.map(outcome).join('; ')} | ${rng(rs.map((r) => cut(r, 5, 'deaths')))} | ${rng(rs.map((r) => cut(r, 10, 'deaths')))} | ${rng(rs.map((r) => cut(r, 15, 'deaths')))} | ${br15.join(', ')} | ${rng(rs.map((r) => cut(r, 15, 'dmg')))} | ${rng(rs.map((r) => cut(r, 15, 'eRouts')))} | ${rng(rs.map((r) => Math.round(r.waves.find((x) => x.wave === 15)?.xp ?? -1)))} |`
    );
  }
}
if (mode === 'vets') {
  for (const [k, r] of Object.entries(runs)) {
    if (!r.waves[0]?.vets) continue;
    console.log('== ' + k);
    for (const w of r.waves)
      if ([1, 5, 10, 15, 20, 25, 30].includes(w.wave))
        console.log(
          ' W' + w.wave,
          ['footman', 'archer', 'healer']
            .map((t) => {
              const v = w.vets[t];
              return v
                ? `${t} hp${v.hp} dmg${Math.round(v.dmg)} acc${v.acc} xp${v.xp} mor${v.mor} k${v.kills} r${v.range}${t === 'healer' ? ' heal' + v.heal + ' T' + v.tier : ''}`
                : '';
            })
            .join(' | '),
          w.armyHp
            ? `| army hp ${w.armyHp} dps ${w.armyDps} host hp ${w.hostHp} dps ${w.hostDps} tpIn ${w.tpIn}`
            : ''
        );
  }
}
