/**
 * Rebalance crossover operative TP costs and barracks/research gates so
 * meta-unlocked factions are usable from wave 1 at fair prices.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fairCost({ hp = 100, damage = 0, healAmount = 0, range = 0, type = 'melee' }) {
  const isRanged = type === 'ranged' || range > 50;
  let power = hp * 0.35 + damage * 2.2 + healAmount * 1.8;
  if (isRanged) power += Math.min(40, range * 0.08);
  // Knight ~8 TP / power ~140 → crossover mid ~18–28, apex ~36–42
  let cost = Math.round(7 + power / 11.5);
  return Math.max(10, Math.min(42, cost));
}

// --- Parse and reprice CrossoverDefs ---
const crossPath = join(root, 'js/crossover.js');
let cross = readFileSync(crossPath, 'utf8');

// Lower barracks constants
cross = cross.replace(
  /const CROSSOVER_BARRACKS_COST = \d+;/,
  'const CROSSOVER_BARRACKS_COST = 90;'
);
cross = cross.replace(
  /const CROSSOVER_BARRACKS_BUILDERS = \d+;/,
  'const CROSSOVER_BARRACKS_BUILDERS = 2;'
);

// Reprice each operative block between "const CrossoverDefs = {" and the closing "};" before getCrossoverDef
const defsStart = cross.indexOf('const CrossoverDefs = {');
const defsEnd = cross.indexOf('\nfunction getCrossoverDef', defsStart);
if (defsStart < 0 || defsEnd < 0) throw new Error('CrossoverDefs block not found');

let defsBlock = cross.slice(defsStart, defsEnd);
const unitRe =
  /(  ([a-z0-9_]+): \{)([\s\S]*?)(\n  \},?\n)/g;

let count = 0;
const samples = [];
defsBlock = defsBlock.replace(unitRe, (full, open, id, body, close) => {
  if (!/cost:\s*\d+/.test(body)) return full;
  const num = (re) => {
    const m = body.match(re);
    return m ? Number(m[1]) : 0;
  };
  const str = (re) => {
    const m = body.match(re);
    return m ? m[1] : '';
  };
  const stats = {
    hp: num(/hp:\s*(\d+)/),
    damage: num(/damage:\s*(\d+)/),
    healAmount: num(/healAmount:\s*(\d+)/),
    range: num(/range:\s*(\d+)/),
    type: str(/type:\s*'([^']+)'/) || 'melee',
  };
  const oldCost = num(/cost:\s*(\d+)/);
  const newCost = fairCost(stats);
  count++;
  if (samples.length < 8) samples.push({ id, oldCost, newCost, ...stats });
  const newBody = body.replace(/cost:\s*\d+/, `cost: ${newCost}`);
  return open + newBody + close;
});

cross = cross.slice(0, defsStart) + defsBlock + cross.slice(defsEnd);
writeFileSync(crossPath, cross);
console.log(`Repriced ${count} crossover operatives`);
console.log('Samples:', samples);

// --- Barracks buildings ---
const bPath = join(root, 'data/buildings.json');
const buildings = JSON.parse(readFileSync(bPath, 'utf8'));
let bChanged = 0;
for (const [id, def] of Object.entries(buildings)) {
  if (!def.isCrossoverBarracks) continue;
  def.cost = 90;
  def.requiresBuilders = 2;
  def.buildTime = Math.min(def.buildTime || 300, 180);
  bChanged++;
}
writeFileSync(bPath, JSON.stringify(buildings, null, 2) + '\n');
console.log(`Updated ${bChanged} crossover barracks in buildings.json`);

// --- FactionDepth constants ---
const fdPath = join(root, 'js/faction-depth.js');
let fd = readFileSync(fdPath, 'utf8');
fd = fd.replace(
  /static STANDARD_BARRACKS_COST = \d+;/,
  'static STANDARD_BARRACKS_COST = 90;'
);
fd = fd.replace(
  /static STANDARD_BARRACKS_BUILDERS = \d+;/,
  'static STANDARD_BARRACKS_BUILDERS = 2;'
);
// Ensure no early-wave deploy tax
fd = fd.replace(
  /static EARLY_WAVE_COST_BONUS = [^;]+;/,
  'static EARLY_WAVE_COST_BONUS = 1;'
);
fd = fd.replace(
  /static EARLY_WAVE_CAP = [^;]+;/,
  'static EARLY_WAVE_CAP = 0;'
);
writeFileSync(fdPath, fd);
console.log('Updated FactionDepth barracks standards');

// --- Research: wave 1 + lower SP, drop inter-faction prereqs for access ---
const rPath = join(root, 'js/research.js');
let research = readFileSync(rPath, 'utf8');
const xfStart = research.indexOf('const CROSSOVER_FACTION_RESEARCH = [');
const xfEnd = research.indexOf('];', xfStart) + 2;
if (xfStart < 0 || xfEnd < 2) throw new Error('CROSSOVER_FACTION_RESEARCH not found');

let xfBlock = research.slice(xfStart, xfEnd);
// Set all wave: N to wave: 1 for xf entries
xfBlock = xfBlock.replace(/wave:\s*\d+/g, 'wave: 1');
// Soften costs by tier: map old high costs into 70–180 range
xfBlock = xfBlock.replace(/cost:\s*(\d+)/g, (_, c) => {
  const n = Number(c);
  // Keep doom protocol expensive-ish
  if (n >= 1900) return 'cost: 220';
  if (n >= 1400) return 'cost: 160';
  if (n >= 1100) return 'cost: 140';
  if (n >= 900) return 'cost: 120';
  if (n >= 700) return 'cost: 100';
  if (n >= 500) return 'cost: 85';
  return `cost: ${Math.max(70, Math.round(n * 0.2))}`;
});
// Drop inter-faction prereqs so each faction research is independent at wave 1.
// Keep doom_protocol prereqs (jojo + dragonball) — restored after the strip.
xfBlock = xfBlock.replace(/\n\s*prereq:\s*\[[^\]]*\],/g, '');
if (!/id: 'doom_protocol'[\s\S]{0,180}prereq:/.test(xfBlock)) {
  xfBlock = xfBlock.replace(
    /(id: 'doom_protocol',\s*faction: null,\s*name: 'Hellgate Containment',\s*cost: \d+,\s*wave: \d+,\s*tier: \d+,)/,
    `$1\n      prereq: ['xf_jojo', 'xf_dragonball'],`
  );
}

research = research.slice(0, xfStart) + xfBlock + research.slice(xfEnd);

// Encyclopedia/desc blurb about wave 45–90
research = research.replace(
  /Evolved allies ladder \(waves 45–90\) unlocks faction barracks by escalating SP cost\./g,
  'Evolved allies research is available from wave 1 (or instantly if the faction is meta-unlocked). SP costs scale with roster power.'
);
research = research.replace(
  /Independent faction barracks by wave — First Circle requires Void Residue Studies; Coliseum requires Town Charter; Doomslayer requires Spirit Arrow \+ Ki Manipulation\./g,
  'Meta-unlocked factions can build barracks from wave 1. Research is an alternate in-run path (wave 1+). Doomslayer still needs Hellgate Containment.'
);

writeFileSync(rPath, research);
console.log('Updated crossover research gates (wave 1, lower SP, independent nodes)');

console.log('\nDone.');
