/**
 * Static integrity checks for crossover rosters, buildings, unlocks, and encyclopedia.
 * Run: node scripts/verify-crossover.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const jsDir = path.join(ROOT, 'js');

function loadScript(filename) {
  const code = fs.readFileSync(path.join(jsDir, filename), 'utf8');
  vm.runInThisContext(code, { filename });
}

// Minimal browser / game stubs
global.document = {
  getElementById: () => null,
  addEventListener: () => {},
};
global.window = global;
global.localStorage = {
  _d: {},
  getItem(k) {
    return this._d[k] ?? null;
  },
  setItem(k, v) {
    this._d[k] = String(v);
  },
};

loadScript('game-data-bundle.js');
loadScript('game-data.js');
loadScript('game-services.js');
loadScript('units.js');
loadScript('meta-progress.js');
MetaProgress.load();
loadScript('crossover.js');
loadScript('faction-depth.js');

const issues = [];
const warnings = [];

function fail(msg) {
  issues.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

const factionIds = Object.keys(CrossoverFactions);
const profileIds = Object.keys(FactionDepth.PROFILES).filter((id) => id !== 'wwe' && id !== 'doom');
const crossoverUnitIds = Object.keys(CrossoverDefs);

// --- Faction ↔ building ↔ unlock ---
for (const [fid, f] of Object.entries(CrossoverFactions)) {
  if (!BuildDefs[f.building])
    fail(`CrossoverFactions.${fid}.building missing in BuildDefs: ${f.building}`);
  else {
    const b = BuildDefs[f.building];
    if (!b.isCrossoverBarracks) fail(`BuildDefs.${f.building} missing isCrossoverBarracks`);
    if (b.crossoverFaction !== fid)
      fail(`BuildDefs.${f.building}.crossoverFaction is ${b.crossoverFaction}, expected ${fid}`);
  }
  const unlockFn = MetaProgress[f.unlockKey];
  if (typeof unlockFn !== 'function')
    fail(`MetaProgress missing unlock fn: ${f.unlockKey} for faction ${fid}`);
  if (
    !MetaProgress.isCrossoverFactionUnlocked(fid) &&
    typeof MetaProgress.isCrossoverFactionUnlocked(fid) !== 'boolean'
  ) {
    fail(`isCrossoverFactionUnlocked(${fid}) not boolean`);
  }
  if (!FactionDepth.PROFILES[fid]) fail(`FactionDepth.PROFILES missing faction: ${fid}`);
}

for (const pid of profileIds) {
  if (!CrossoverFactions[pid] && pid !== 'wwe' && pid !== 'doom') {
    warn(`FactionDepth profile "${pid}" has no CrossoverFactions entry`);
  }
}

// --- Operatives per faction ---
const rosterByFaction = {};
for (const [id, def] of Object.entries(CrossoverDefs)) {
  if (!def.faction) fail(`CrossoverDefs.${id} missing faction`);
  if (!def.name || !def.cost || !def.hp || !def.damage)
    fail(`CrossoverDefs.${id} missing core stats`);
  if (!def.ability || !def.abilityDesc) fail(`CrossoverDefs.${id} missing ability fields`);
  if (!def.combatTag) fail(`CrossoverDefs.${id} missing combatTag`);
  if (!getPlayerUnitDef(id)) fail(`getPlayerUnitDef(${id}) returned null`);
  if (!isCrossoverUnit(id)) fail(`isCrossoverUnit(${id}) returned false`);
  const created = createUnit(id, 100, 200, 'player');
  if (!created) fail(`createUnit(${id}) returned null`);
  else if (!created.isCrossover) fail(`createUnit(${id}) missing isCrossover flag`);

  rosterByFaction[def.faction] = (rosterByFaction[def.faction] || 0) + 1;
}

for (const fid of factionIds) {
  if (!rosterByFaction[fid]) fail(`Faction ${fid} has zero operatives in CrossoverDefs`);
}

// --- Encyclopedia lore keys (parse crossover.js CROSSOVER_HERO_LORE via regex from encyclopedia.js) ---
const encSource = fs.readFileSync(path.join(jsDir, 'encyclopedia.js'), 'utf8');
const loreMatch = encSource.match(/const CROSSOVER_HERO_LORE = \{([\s\S]*?)\n {2}\};/);
if (!loreMatch) fail('Could not parse CROSSOVER_HERO_LORE from encyclopedia.js');
else {
  const loreKeys = [...loreMatch[1].matchAll(/^\s+([a-z0-9_]+):/gm)].map((m) => m[1]);
  for (const id of crossoverUnitIds) {
    if (!loreKeys.includes(id)) fail(`Encyclopedia missing CROSSOVER_HERO_LORE entry for ${id}`);
  }
  for (const key of loreKeys) {
    if (!CrossoverDefs[key]) warn(`Encyclopedia lore key "${key}" has no CrossoverDefs entry`);
  }
}

// --- Faction tabs in encyclopedia ---
const catMatch = encSource.match(/const CROSSOVER_CAT = \{([\s\S]*?)\n {2}\};/);
if (!catMatch) fail('Could not parse CROSSOVER_CAT from encyclopedia.js');
else {
  for (const fid of factionIds) {
    if (!catMatch[1].includes(`${fid}:`)) fail(`Encyclopedia CROSSOVER_CAT missing ${fid}`);
  }
}

// --- Synergies reference valid factions ---
for (const syn of FactionDepth.SYNERGIES) {
  for (const f of syn.factions) {
    if (f === 'wwe') continue;
    if (!FactionDepth.PROFILES[f] && !CrossoverFactions[f])
      fail(`Synergy "${syn.id}" references unknown faction: ${f}`);
  }
}

// --- Unlock + recruit simulation ---
MetaProgress.unlockAllCheatContent();
for (const fid of factionIds) {
  if (!MetaProgress.isCrossoverFactionUnlocked(fid))
    fail(`unlockAllCheatContent did not unlock ${fid}`);
}

const sampleId = crossoverUnitIds[0];
const sampleDef = CrossoverDefs[sampleId];
if (typeof CrossoverHub?.rosterForFaction === 'function') {
  const roster = CrossoverHub.rosterForFaction(sampleDef.faction);
  if (!roster.length) fail(`CrossoverHub.rosterForFaction(${sampleDef.faction}) empty`);
  if (!roster.find(([id]) => id === sampleId)) fail(`CrossoverHub roster missing ${sampleId}`);
}

// --- FactionDepth barracks rules ---
for (const fid of factionIds) {
  const building = CrossoverFactions[fid].building;
  const chk = FactionDepth.canBuildBarracks(building, 100, [], []);
  if (!chk || typeof chk.ok !== 'boolean')
    fail(`canBuildBarracks(${building}) returned invalid result`);
}

// --- Achievement roster config ↔ buildings ---
const achSource = fs.readFileSync(path.join(jsDir, 'achievements-data.js'), 'utf8');
const achFactionBlocks = [
  ...achSource.matchAll(
    /\{\s*key:\s*'([^']+)',\s*label:[^,]+,\s*cat:\s*'([^']+)',\s*build:\s*('[^']*'|null)/g
  ),
];
const achCrossover = achFactionBlocks.filter(([, key]) => CrossoverFactions[key]);
for (const [, key, , buildRaw] of achCrossover) {
  const expected = CrossoverFactions[key].building;
  const buildVal = buildRaw === 'null' ? null : buildRaw.replace(/'/g, '');
  if (buildVal !== expected)
    fail(`achievements-data crossover key ${key}: build ${buildVal} !== ${expected}`);
}

// --- Individual unlock cheats ---
global.Achievements = { tryUnlock: () => {} };
global.AudioEngine = { SFX: { reinforce: () => {} } };
loadScript('cheats.js');
const cheatUnlocks = [
  ['115', 'ultimis'],
  ['primus', 'primis'],
  ['halo', 'halo'],
  ['gears', 'gears'],
  ['one to rule them all', 'lotr'],
  ['hanma', 'baki'],
  ['jojos bizarre adventure', 'jojo'],
  ['fotns', 'fotns'],
  ['dragon soul', 'dragonball'],
  ['for the emperor', 'imperium'],
  ['crystal light', 'crystal'],
  ['let the galaxy burn', 'warp'],
  ['eternal crusade', 'warhammer'],
  ['dragonborn legacy', 'tes'],
];
for (const [code, fid] of cheatUnlocks) {
  MetaProgress.reset();
  if (!Cheats.submit(code)) fail(`Cheats.submit("${code}") returned false`);
  if (!MetaProgress.isCrossoverFactionUnlocked(fid))
    fail(`Cheat code "${code}" did not unlock faction ${fid}`);
}
MetaProgress.reset();

console.log('Crossover verification');
console.log(`  Factions: ${factionIds.length}`);
console.log(`  Operatives: ${crossoverUnitIds.length}`);
console.log(`  Roster counts: ${factionIds.map((f) => `${f}=${rosterByFaction[f]}`).join(', ')}`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
if (issues.length) {
  console.log(`\nFAILED (${issues.length}):`);
  issues.forEach((i) => console.log(`  ✗ ${i}`));
  process.exit(1);
}
console.log('\nAll crossover integrity checks passed.');
