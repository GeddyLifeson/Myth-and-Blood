/**
 * Encyclopedia, lore and README:
 *  - every entry renders, and none names a unit, building or enemy the game lacks;
 *  - every troop, enemy, boss, edict, ribbon and status mark has its page;
 *  - the topics that used to be missing are there, and search finds them;
 *  - text for removed concepts, and franchise or champion names, are not in the owned files;
 *  - the README key tables match scripts/gen-readme-keys.mjs.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';
import { generate, readBlock, normalize } from './gen-readme-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb } = boot(33);
const g = vm.runInContext(
  `${code}\n({ Encyclopedia, LoreData, StoryLore, Roster, UnitDefs, BuildDefs,
     EnemyDefs, CrossoverDefs, WweDefs, CrossoverFactions, SiegeLoop, Research, Hotkeys })`,
  vm.createContext(sb)
);
const { Encyclopedia, LoreData, StoryLore, Roster, UnitDefs, BuildDefs, EnemyDefs } = g;
const { CrossoverDefs, WweDefs, CrossoverFactions, SiegeLoop } = g;

// --- every entry renders -------------------------------------------------------------------
const entries = Encyclopedia.getAllEntries();
ok(
  entries.length >= 150 && entries.length <= 320,
  `a reference, not a second manual (${entries.length} entries)`
);
{
  let threw = 0;
  let junk = [];
  for (const e of entries) {
    let html = '';
    try {
      html = Encyclopedia.renderEntry(e);
    } catch (err) {
      threw++;
      console.error(`render threw for "${e.name}": ${err.message}`);
    }
    const text = `${e.name}\n${e.body}\n${e.quote || ''}\n${(e.tags || []).map((t) => t.v).join('\n')}`;
    if (/undefined|NaN|\[object|\bnull\b/.test(text) || !html.includes('ency-entry'))
      junk.push(e.name);
    if (!e.body.trim() && !(e.tags || []).length) junk.push(`${e.name} (empty)`);
  }
  ok(threw === 0, 'every entry renders without throwing');
  ok(junk.length === 0, `no entry prints undefined, NaN or nothing ${junk.join(' | ')}`);
  const cats = new Set(Encyclopedia.CATEGORIES.map((c) => c.id));
  ok(
    entries.every((e) => cats.has(e.cat)),
    'every entry sits in a listed tab'
  );
  for (const c of Encyclopedia.CATEGORIES) {
    ok(
      entries.some((e) => e.cat === c.id),
      `tab "${c.label}" has entries`
    );
  }
  const names = entries.map((e) => `${e.cat}:${e.name}`);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  ok(dup.length === 0, `no entry appears twice in a tab ${dup.join(' | ')}`);
}

// --- ids ---------------------------------------------------------------------------------
{
  const bad = [];
  const unitOk = (id) => UnitDefs[id] || CrossoverDefs[id] || WweDefs[id];
  for (const e of entries) {
    if (e.unitId && !UnitDefs[e.unitId]) bad.push(`${e.name}: unit ${e.unitId}`);
    if (e.buildId && !BuildDefs[e.buildId]) bad.push(`${e.name}: building ${e.buildId}`);
    if (e.enemyId && !EnemyDefs[e.enemyId]) bad.push(`${e.name}: enemy ${e.enemyId}`);
    for (const id of e.refs?.units || []) if (!unitOk(id)) bad.push(`${e.name}: unit ${id}`);
    for (const id of e.refs?.builds || [])
      if (!BuildDefs[id]) bad.push(`${e.name}: building ${id}`);
    for (const id of e.refs?.enemies || []) if (!EnemyDefs[id]) bad.push(`${e.name}: enemy ${id}`);
  }
  ok(bad.length === 0, `no entry references a missing unit, building or enemy ${bad.join(' | ')}`);

  const has = (field, id) => entries.some((e) => e[field] === id);
  const troops = Object.keys(Roster.TROOPS).filter((t) => UnitDefs[t]);
  ok(
    troops.every((t) => has('unitId', t)),
    `every troop has a page (${troops.length})`
  );
  const army = entries.filter((e) => e.cat === 'army');
  ok(
    army.every((e) => {
      const p = Roster.TROOPS[e.unitId];
      return (
        e.body.includes(p.trait) &&
        e.tags.some((t) => t.v === p.role) &&
        e.tags.some((t) => t.v === p.weak)
      );
    }),
    'troop pages carry the role, trait and weakness from the roster, not a copy'
  );
  const foes = Object.keys(EnemyDefs);
  const missing = foes.filter((t) => !has('enemyId', t));
  ok(missing.length === 0, `every enemy and boss has a page (${foes.length}) ${missing.join(',')}`);
  const bosses = foes.filter((t) => EnemyDefs[t].bossName);
  ok(
    bosses.every((t) => entries.some((e) => e.cat === 'bosses' && e.enemyId === t)),
    `every warlord is under Bosses (${bosses.length})`
  );
  ok(
    Object.keys(SiegeLoop.EDICTS).every((id) => has('edictId', id)),
    'every edict has a page'
  );
  ok(
    SiegeLoop.getRibbons().every((r) => has('ribbonId', r.id)),
    `every ribbon has a page (${SiegeLoop.getRibbons().length})`
  );
  ok(
    Roster.STATUS_MARKS.every((m) => has('mark', m)),
    `every status mark is in the legend (${Roster.STATUS_MARKS.length})`
  );
  const companies = entries.filter((e) => e.companyId);
  const listed = new Set(companies.flatMap((e) => e.refs.units));
  const everyone = [...Object.keys(CrossoverDefs), ...Object.keys(WweDefs)].filter(
    (t) => Roster.PROFILES[t]
  );
  ok(
    everyone.every((t) => listed.has(t)),
    `every champion belongs to a company page (${everyone.length} in ${companies.length})`
  );
}

// --- topics that were missing, and search -------------------------------------------------
{
  for (const q of [
    'spoils',
    'ribbon',
    'upkeep',
    'crate',
    'hunt',
    'hold',
    'med tent',
    'sapper',
    'war camp',
    'sector',
    'breach',
    'edict',
    'score',
    'post',
  ]) {
    ok(Encyclopedia.search(q, entries).length > 0, `search finds "${q}"`);
  }
  ok(Encyclopedia.search('zzzqqq', entries).length === 0, 'search finds nothing for nonsense');
  ok(Encyclopedia.search('', entries).length === 0, 'an empty search matches nothing');
  ok(
    Encyclopedia.search('GOBLIN', entries).some((e) => e.enemyId === 'goblin'),
    'search ignores case and reaches enemy pages'
  );
  ok(
    Encyclopedia.search('status marks', entries).some((e) => e.cat === 'marks'),
    'search matches a tab by its label'
  );
  const how = entries.filter((e) => e.cat === 'howto');
  ok(how.length <= 25, `How to play is short (${how.length})`);
  const roles = Encyclopedia.buildRoleEntries();
  ok(
    roles.length > 100 && roles.every((e) => e.name && e.body),
    'role pages still built for callers'
  );
}

// --- lore ------------------------------------------------------------------------------------
{
  const troops = Object.keys(Roster.TROOPS).filter((t) => UnitDefs[t]);
  ok(
    troops.every((t) => LoreData.TROOP_LINES[t]),
    'every troop has a line'
  );
  const foes = Object.keys(EnemyDefs).filter((t) => !EnemyDefs[t].bossName);
  const noLine = foes.filter((t) => !LoreData.ENEMY_LINES[t]);
  ok(noLine.length === 0, `every enemy has a line ${noLine.join(',')}`);
  const bosses = Object.keys(EnemyDefs).filter((t) => EnemyDefs[t].bossName);
  ok(
    bosses.every((t) => LoreData.bossLine(t, 'arrive') && LoreData.bossLine(t, 'fall')),
    'every warlord has an arrival line and a death line'
  );
  const stale = [
    ...Object.keys(LoreData.TROOP_LINES).filter((t) => !UnitDefs[t]),
    ...Object.keys(LoreData.ENEMY_LINES).filter((t) => !EnemyDefs[t]),
    ...Object.keys(LoreData.BOSS_LINES).filter((t) => !EnemyDefs[t]),
  ];
  ok(stale.length === 0, `no lore line is keyed to a missing id ${stale.join(',')}`);
  ok(
    LoreData.line('breach') && LoreData.line('veteranFalls') && LoreData.line('spoils'),
    'field lines exist'
  );
  ok(LoreData.line('breach') !== LoreData.line('breach'), 'a field line is not said twice running');

  const beats = Object.entries(LoreData.CAMPAIGN_NARRATIVE.waves);
  ok(
    beats.filter(([w]) => Number(w) <= 30).length >= 6,
    'the story sits where a run is: six beats by wave 30'
  );
  const spoken = [
    ...beats.map(([, b]) => b),
    LoreData.CAMPAIGN_NARRATIVE.firstBoss,
    ...Object.values(StoryLore.BRANCH_BEATS).flatMap((byWave) => Object.values(byWave)),
    ...Object.values(StoryLore.RUN_OUTRO).flatMap((o) => [
      { title: 'outro', hook: o.victory, sub: o.defeat },
    ]),
  ];
  ok(
    spoken.every((b) => b.title && b.hook && typeof b.sub === 'string'),
    'every beat has a title and a line'
  );
  const numbered = spoken.filter((b) => /\d|%/.test(`${b.hook} ${b.sub}`));
  ok(
    numbered.length === 0,
    `no digits or percentages in a story line ${numbered.map((b) => b.title)}`
  );
  const won = spoken.filter((b) =>
    /\b(victory|won|win|triumph)\b/i.test(`${b.title} ${b.hook} ${b.sub}`)
  );
  ok(won.length === 0, `no beat says the siege is won ${won.map((b) => b.title)}`);
  ok(
    !LoreData.CAMPAIGN_NARRATIVE.trueVictory && !LoreData.CAMPAIGN_NARRATIVE.economyVictory,
    'no victory framing left'
  );
  ok(
    LoreData.ERA_BEATS.every((b) => LoreData.CAMPAIGN_NARRATIVE.waves[b.wave].title === b.name),
    'wave markers match the beats'
  );
}

// --- removed concepts and names in the owned files ---------------------------------------
{
  const OWNED = [
    'js/encyclopedia.js',
    'js/lore-data.js',
    'js/story-lore.js',
    'js/narrative-thread.js',
    'README.md',
  ];
  const src = Object.fromEntries(OWNED.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));
  const REMOVED = [
    /economy structure is destroyed/i,
    /campaign ends when/i,
    /campaign (is )?won/i,
    /true victory/i,
    /win condition/i,
    /kingdom evolution/i,
    /evolution stages?/i,
    /enemy kingdoms?/i,
    /kingdom stages?/i,
    /\bflanks?\b/i,
    /multi-?front/i,
    /era resets?/i,
    /\bRTS\b/,
    /planet/i,
    /galactic/i,
    /cosmic/i,
    /colony value/i,
    /mirror (war|settlements?)/i,
    /hunt mode/i,
    /hunt (is )?(on|off)\b/i,
    /global hunt/i,
    /hunt toggle/i,
    /miss limit/i,
    /breakthrough limit/i,
    /CLASSIFIED/,
    /tombstone/i,
  ];
  const FRANCHISE = [
    /\bEvolve\b/,
    /\bBaki\b/,
    /\bFotNS\b/,
    /\bToki\b/,
    /\bJagi\b/,
    /\bNanto\b/,
    /\bDoppo\b/,
    /\bCommissar\b/,
    /\bTerminators?\b/,
    /\bNightingale\b/,
    /\bJoJo\b/i,
    /Steel Ball/,
    /\bWarhammer\b/i,
    /\bSkyrim\b/i,
    /Gears of War/i,
    /Call of Duty/i,
    /Stone Cold/i,
    /\b316\b/,
    /Woooo/,
    /\bPart [1-7]\b/,
  ];
  const hits = [];
  for (const [file, text] of Object.entries(src)) {
    for (const re of [...REMOVED, ...FRANCHISE]) {
      const m = text.match(re);
      if (m) hits.push(`${file}: "${m[0]}"`);
    }
  }
  ok(
    hits.length === 0,
    `no removed concept or franchise name in the owned files ${hits.join(' | ')}`
  );

  // Rendered text that is written by hand (not read from data another module owns).
  const hand = entries.filter((e) => e.cat === 'howto' || e.cat === 'world' || e.cat === 'marks');
  const rendered = hand.filter((e) =>
    [...REMOVED, ...FRANCHISE].some((re) => re.test(`${e.name} ${e.body}`))
  );
  ok(
    rendered.length === 0,
    `hand-written pages are clean ${rendered.map((e) => e.name).join(' | ')}`
  );

  // Champion and company names must come from data at run time, never from these files.
  const names = [
    ...Object.values(CrossoverDefs).map((d) => d.name),
    ...Object.values(WweDefs).map((d) => d.name),
    ...Object.values(CrossoverFactions).map((f) => f.label),
  ].filter((n) => n && n.length >= 5);
  const hard = [];
  for (const [file, text] of Object.entries(src)) {
    for (const n of names) if (text.includes(n)) hard.push(`${file}: ${n}`);
  }
  ok(
    hard.length === 0,
    `no champion or company name is hardcoded (${names.length} checked) ${hard.join(' | ')}`
  );
}

// --- README ------------------------------------------------------------------------------
{
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const block = readBlock(readme);
  ok(block != null, 'README has the generated key block');
  ok(
    block != null && normalize(block) === normalize(generate()),
    'README key tables match gen-readme-keys.mjs'
  );
  for (const h of [
    'Quick start',
    'How a run goes',
    'Controls',
    'Recruiting and army upkeep',
    'Posts, Hunt and Hold',
    'The med tent',
    'Spoils and edicts',
    'Supply crates',
    'The Sapper',
    'Ribbons',
    'Run score',
    'Difficulty',
    'Modes',
    'Saving',
    'Cheats',
    'Developer notes',
  ]) {
    ok(new RegExp(`^##+ ${h}$`, 'm').test(readme), `README has a section "${h}"`);
  }
  const edicts = Object.values(SiegeLoop.EDICTS).filter(
    (e) => !readme.includes(e.name.replace('’', "'"))
  );
  ok(edicts.length === 0, `README lists every edict ${edicts.map((e) => e.name)}`);
  const ribbons = SiegeLoop.getRibbons().filter((r) => !readme.includes(`| ${r.name} `));
  ok(ribbons.length === 0, `README lists every ribbon ${ribbons.map((r) => r.name)}`);
  const costs = Object.keys(Roster.TROOPS)
    .filter((t) => UnitDefs[t])
    .filter(
      (t) => !new RegExp(`\\| ${UnitDefs[t].name} +\\| ${UnitDefs[t].cost} +\\|`).test(readme)
    );
  ok(costs.length === 0, `README troop prices match the data ${costs.join(',')}`);
  const builds = [
    'outpost',
    'wall',
    'watchtower',
    'spike_trap',
    'medical_tent',
    'mess_hall',
    'research_lab',
    'trade_outpost',
    'quarry',
    'castle',
  ].filter(
    (b) => !new RegExp(`\\| ${BuildDefs[b].name} +\\| ${BuildDefs[b].cost} +\\|`).test(readme)
  );
  ok(builds.length === 0, `README building prices match the data ${builds.join(',')}`);
  ok(
    !/procedural \(generated in the browser\)|All nine strikes|MIT — see/.test(readme),
    'the audited wrong statements are gone'
  );
}

if (failures()) {
  console.error(`\n${failures()} test(s) failed`);
  process.exit(1);
}
console.log('\nAll encyclopedia, lore and README tests passed');
