/**
 * Static integrity checks for crossover rosters, buildings, unlocks, and encyclopedia.
 * Run: node scripts/verify-free-companies.js
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
loadScript('free-companies.js');
loadScript('faction-depth.js');

const issues = [];
const warnings = [];

function fail(msg) {
  issues.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

const factionIds = Object.keys(FreeCompanies);
const profileIds = Object.keys(FactionDepth.PROFILES).filter(
  (id) => id !== 'champions' && id !== 'doom'
);
const heroUnitIds = Object.keys(HeroDefs);

// --- Faction ↔ building ↔ unlock ---
for (const [fid, f] of Object.entries(FreeCompanies)) {
  if (!BuildDefs[f.building])
    fail(`FreeCompanies.${fid}.building missing in BuildDefs: ${f.building}`);
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
    !MetaProgress.isCompanyUnlocked(fid) &&
    typeof MetaProgress.isCompanyUnlocked(fid) !== 'boolean'
  ) {
    fail(`isCompanyUnlocked(${fid}) not boolean`);
  }
  if (!FactionDepth.PROFILES[fid]) fail(`FactionDepth.PROFILES missing faction: ${fid}`);
}

for (const pid of profileIds) {
  if (!FreeCompanies[pid] && pid !== 'champions' && pid !== 'doom') {
    warn(`FactionDepth profile "${pid}" has no FreeCompanies entry`);
  }
}

// --- Operatives per faction ---
const rosterByFaction = {};
for (const [id, def] of Object.entries(HeroDefs)) {
  if (!def.faction) fail(`HeroDefs.${id} missing faction`);
  if (!def.name || !def.cost || !def.hp || !def.damage) fail(`HeroDefs.${id} missing core stats`);
  if (!def.ability || !def.abilityDesc) fail(`HeroDefs.${id} missing ability fields`);
  if (!def.combatTag) fail(`HeroDefs.${id} missing combatTag`);
  if (!getPlayerUnitDef(id)) fail(`getPlayerUnitDef(${id}) returned null`);
  if (!isCompanyHeroUnit(id)) fail(`isCompanyHeroUnit(${id}) returned false`);
  const created = createUnit(id, 100, 200, 'player');
  if (!created) fail(`createUnit(${id}) returned null`);
  else if (!created.isCrossover) fail(`createUnit(${id}) missing isCrossover flag`);

  rosterByFaction[def.faction] = (rosterByFaction[def.faction] || 0) + 1;
}

for (const fid of factionIds) {
  if (!rosterByFaction[fid]) fail(`Faction ${fid} has zero operatives in HeroDefs`);
}

// --- Encyclopedia: champions are rendered from data, never named in the source ---
const encSource = fs.readFileSync(path.join(jsDir, 'encyclopedia.js'), 'utf8');
if (!/HeroDefs/.test(encSource) || !/FreeCompanies/.test(encSource)) {
  fail('Encyclopedia no longer reads HeroDefs / FreeCompanies at run time');
}
for (const id of heroUnitIds) {
  const name = HeroDefs[id]?.name;
  if (name && name.length >= 5 && encSource.includes(name)) {
    fail(`Encyclopedia hardcodes the display name of ${id}; render it from data`);
  }
}

// --- Synergies reference valid factions ---
for (const syn of FactionDepth.SYNERGIES) {
  for (const f of syn.factions) {
    if (f === 'champions') continue;
    if (!FactionDepth.PROFILES[f] && !FreeCompanies[f])
      fail(`Synergy "${syn.id}" references unknown faction: ${f}`);
  }
}

// --- Unlock + recruit simulation ---
MetaProgress.unlockAllCheatContent();
for (const fid of factionIds) {
  if (!MetaProgress.isCompanyUnlocked(fid)) fail(`unlockAllCheatContent did not unlock ${fid}`);
}

const sampleId = heroUnitIds[0];
const sampleDef = HeroDefs[sampleId];
if (typeof FreeCompaniesScreen?.rosterForFaction === 'function') {
  const roster = FreeCompaniesScreen.rosterForFaction(sampleDef.faction);
  if (!roster.length) fail(`FreeCompaniesScreen.rosterForFaction(${sampleDef.faction}) empty`);
  if (!roster.find(([id]) => id === sampleId))
    fail(`FreeCompaniesScreen roster missing ${sampleId}`);
}

// --- FactionDepth barracks rules ---
for (const fid of factionIds) {
  const building = FreeCompanies[fid].building;
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
const achHero = achFactionBlocks.filter(([, key]) => FreeCompanies[key]);
for (const [, key, , buildRaw] of achHero) {
  const expected = FreeCompanies[key].building;
  const buildVal = buildRaw === 'null' ? null : buildRaw.replace(/'/g, '');
  if (buildVal !== expected)
    fail(`achievements-data crossover key ${key}: build ${buildVal} !== ${expected}`);
}

// --- Individual unlock cheats ---
global.Achievements = { tryUnlock: () => {} };
global.AudioEngine = { SFX: { reinforce: () => {} } };
loadScript('cheats.js');
const cheatUnlocks = [
  ['void residue', 'powderhorn'],
  ['first circle', 'pale_vigil'],
  ['orbital vanguard', 'greywatch'],
  ['iron trench', 'sawtooth'],
  ['ninefold march', 'thornroad'],
  ['iron pit', 'knucklebone'],
  ['spirit court', 'marrow_choir'],
  ['north star', 'quiet_hand'],
  ['skyburst', 'emberblood'],
  ['crimson legions', 'iron_psalm'],
  ['crystal light', 'saltglass'],
  ['rift cult', 'open_wound'],
  ['eternal crusade', 'warhammer'],
  ['voicebound', 'rimehowl'],
];
for (const [code, fid] of cheatUnlocks) {
  MetaProgress.reset();
  if (!Cheats.submit(code)) fail(`Cheats.submit("${code}") returned false`);
  if (!MetaProgress.isCompanyUnlocked(fid))
    fail(`Cheat code "${code}" did not unlock faction ${fid}`);
}
MetaProgress.reset();

console.log('Crossover verification');
console.log(`  Factions: ${factionIds.length}`);
console.log(`  Operatives: ${heroUnitIds.length}`);
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
