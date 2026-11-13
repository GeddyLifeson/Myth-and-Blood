/**
 * Roster power report: a crude cost-versus-power check for operatives and champions.
 *
 * For each unit it prints base power from stats, the factor its roster trait adds, and
 * power per TP against the median of its faction. Units whose trait factor or whose power
 * per TP sits far from their faction-mates are flagged.
 *
 * Run: node scripts/roster-power-report.mjs          (exit 1 if a trait is out of band)
 *      node scripts/roster-power-report.mjs --all    (print every unit, not just the flagged)
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { traitFactors, basePower } from './lib/roster-clauses.mjs';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const operatives = read('operatives.json');
const champions = read('champions.json');
const profiles = read('roster-profiles.json');

/** A trait should add between 8% and 30% to a unit's estimated power. */
const TRAIT_MIN = 1.08;
const TRAIT_MAX = 1.3;
/** Power per TP more than this far from the faction median is reported. */
const PER_TP_BAND = 0.2;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

function rowsFor(defs, table, groupOf) {
  const rows = [];
  for (const [id, def] of Object.entries(defs)) {
    const profile = table[id];
    if (!profile) continue;
    const f = traitFactors(profile, def);
    const base = basePower(def);
    rows.push({
      id,
      name: def.name,
      group: groupOf(def),
      cost: def.cost,
      base,
      trait: f.total,
      power: base * f.total,
      perTp: (base * f.total) / def.cost,
      basePerTp: base / def.cost,
    });
  }
  return rows;
}

const rows = [
  ...rowsFor(champions, profiles.champions, () => 'champions'),
  ...rowsFor(operatives, profiles.operatives, (d) => d.faction),
];
const groups = new Map();
for (const r of rows) {
  if (!groups.has(r.group)) groups.set(r.group, []);
  groups.get(r.group).push(r);
}

const showAll = process.argv.includes('--all');
let traitOutliers = 0;
let costOutliers = 0;
const line = (r, med, flags) =>
  `  ${r.id.padEnd(20)} ${String(r.cost).padStart(4)} TP  base ${r.base.toFixed(1).padStart(6)}  trait x${r.trait.toFixed(2)}  power ${r.power.toFixed(1).padStart(6)}  per TP ${r.perTp.toFixed(2)} (${((r.perTp / med - 1) * 100).toFixed(0).padStart(3)}% vs faction)${flags.length ? '  <-- ' + flags.join(', ') : ''}`;

for (const [group, list] of groups) {
  const med = median(list.map((r) => r.perTp));
  const baseMed = median(list.map((r) => r.basePerTp));
  const out = [];
  for (const r of list) {
    const flags = [];
    if (r.trait < TRAIT_MIN) flags.push('weak trait');
    if (r.trait > TRAIT_MAX) flags.push('strong trait');
    const off = r.perTp / med - 1;
    if (Math.abs(off) > PER_TP_BAND) {
      const fromStats = Math.abs(r.basePerTp / baseMed - 1) > PER_TP_BAND;
      flags.push(
        `${off > 0 ? 'high' : 'low'} power per TP${fromStats ? ' (already so from base stats)' : ''}`
      );
      costOutliers++;
    }
    if (flags.some((f) => f.endsWith('trait'))) traitOutliers++;
    if (showAll || flags.length) out.push(line(r, med, flags));
  }
  console.log(
    `${group}: ${list.length} units, median power per TP ${med.toFixed(2)}, trait x${Math.min(...list.map((r) => r.trait)).toFixed(2)} to x${Math.max(...list.map((r) => r.trait)).toFixed(2)}`
  );
  for (const l of out) console.log(l);
}
console.log(
  `\n${rows.length} units. ${traitOutliers} with a trait outside x${TRAIT_MIN}-x${TRAIT_MAX}; ${costOutliers} more than ${PER_TP_BAND * 100}% from their faction's median power per TP.`
);
process.exit(traitOutliers ? 1 : 0);
