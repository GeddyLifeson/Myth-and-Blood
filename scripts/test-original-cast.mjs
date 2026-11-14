/**
 * The cast is this game's own: 29 champions and 104 hired heroes in 13 free companies.
 *
 * Checks that every one of them has a name, a title, a company and a description, that names
 * are unique, that nothing a player can read in the cast data or on the two hero screens uses
 * a name or term from the cast as it was before the rewrite, and that no internal id (a unit
 * type, a faction key, a combat tag) is ever put on screen by the display helpers.
 *
 * Internal ids are deliberately left alone here: saves, unlock flags and achievements key on
 * them. The mapping for the later one-step rename is docs/overhaul's id-migration list.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const champions = readJson('data/champions.json');
const operatives = readJson('data/operatives.json');
const profiles = readJson('data/roster-profiles.json');

// ---------------------------------------------------------------- the blocklist
// Display names the cast carried before the rewrite. Plain on purpose: this file is the record
// of what must not come back.
const OLD_NAMES = [
  'Aether Summoner',
  'Anthony Ironhelm',
  'Augustus Thrash',
  'Benjamin Ironhelm',
  'Black Mage',
  'Blade Sato',
  'Blade Sato (Ascended)',
  'Brass Kozlov',
  'Brass Kozlov (Ascended)',
  'Bruno Clasp',
  'Cassius Zephyr',
  'Cat Operative',
  'Cataclysm Lord',
  'Chaos Champion',
  'Clayton Ironhelm',
  'Crownless Ranger',
  'Crystal Sentinel',
  'Daemon Knight',
  'Daigo Serpent',
  'Dane Calder',
  'Darren Gearwright',
  'Diego Fang',
  'Dorian Crimson',
  'Dr. Volkov',
  'Dr. Volkov (Ascended)',
  'Ember Operative',
  'Erma Kiss',
  'Field Enforcer',
  'Frost Huscarl',
  'Frost Tyrant',
  'Future Blade',
  'Gio Gold',
  'Grey Pilgrim',
  'Guy Pistols',
  'Gyre Ballista',
  'Halfling Scout',
  'Heartland Ace',
  'Heavy Bulwark',
  'Heavy Gunner',
  'Heretic Acolyte',
  'Iron Dreadnought',
  'Ironson Bakari',
  'Jago Traitor',
  'Jax Ironson',
  'Jean-Luc Silver',
  'Jiro Ashen',
  'Johan Rotation',
  'Jolie String',
  'Jonas Ashford',
  'Josiah Ashford',
  'Jun Diamond',
  'Kael Skyburst',
  'Kaku Seastorm',
  'Kenji Sevenstar',
  'Lance Operative',
  'Legion Captain',
  'Limit Striker',
  'Line Guardsman',
  'Lucia Ticket',
  'Mahmoud Flame',
  'Marek Ironhart',
  'Mountain Hermit',
  'Nori Emerald',
  'Oku Hand',
  'Olivar Granite',
  'Perfect Hybrid',
  'Plague Cultist',
  'Possessed Legionary',
  'Prince Vex',
  'Rao the Conqueror',
  'Ren Waterbird',
  'Restoration Saint',
  'Rift Archivist',
  'Ronan Artist',
  'Rudolf Ironclad',
  'Scarlet Regent',
  'Scholar Burst',
  'Sentinel-7',
  'Sergeant Ashford',
  'Shadow Nightjar',
  'Shen Scar',
  'Shield Captain',
  'Shield Maiden',
  'Silvan Archer',
  'Sky Elbow Ace',
  'Sky Lance',
  'Sniper Operative',
  'Soldier of Light',
  'Splinter Vale',
  'Splinter Vale (Ascended)',
  'Stone Axe Lord',
  'Storm Battlemage',
  'Storm Caller',
  'The Ambush Hunter',
  'The Bagpipe Brawler',
  'The Beast Unchained',
  'The Bladed Duke',
  'The Border Liege',
  'The Clean-Living Rebel',
  'The Colossus',
  'The Crow Sentinel',
  'The Freight Tower',
  'The Gaelic Brawler',
  'The Gilded Lord',
  'The Grave Walker',
  'The Inferno Brother',
  'The Island Sovereign',
  'The Lantern Prophet',
  'The Luchador Phantom',
  'The Mountain King',
  'The Ogre Patriarch',
  'The Patriot',
  'The Primal',
  'The Rising Champion',
  'The Schemer',
  'The Scrapyard Bruiser',
  'The Stonebreaker',
  'The Submission Ace',
  'The Technician',
  'The Timber Patriot',
  'The Titan',
  'The Wild Lord',
  'Tomo Healer',
  'Trench Trooper',
  'Vanguard Trooper',
  'Verdant Sage',
  'War Chaplain',
  'Warp Magus',
  'White Mage',
  'Will Zephyr',
  'Wolf Leader',
  'Wyrmcaller',
  'Yoshi Quiet',
];
// Ability and trait names from before the rewrite. Ordinary phrases that were dropped but
// point at nothing (a bite, a shield wall) are not listed.
const OLD_ABILITIES = [
  'Ace Lock',
  'Aether Shot',
  'Aiki',
  'Animal Slam',
  'Apex Drop',
  'Arc Coil',
  'Architect Stomp',
  'Autocannon',
  'Avatar Strike',
  'Axe Cleave',
  'Beam Volley',
  'Beast Toss',
  'Blazing Volley',
  'Borrowed Luck',
  'Brawl Talk',
  'Breaking Point',
  "Brother's Eye",
  'Brothers in Arms',
  'Bruiser Headbutt',
  'Burst Trenchsaw',
  'Bushido',
  'Cataclysm',
  'Celtic Kick',
  'Chin Check',
  'Chin Check Kick',
  'Colossus Might',
  "Conqueror's Tread",
  'Crimson Chill',
  'Crimson Erase',
  'Crimson Flame',
  'Cross Slash',
  'Crownblade',
  'Daemon Fire',
  'Dragon Aspect',
  'Drill Sergeant',
  "Duke's Edge",
  'Duke’s Edge',
  'Elven Archer',
  'Emerald Spray',
  'Festering Curse',
  'Fiend’s Back',
  'Frost Lance',
  'Golden Pulse',
  'Grave Drop',
  'Greater Flame',
  'Greater Mend',
  'Grenade Burst',
  'Grey Ward',
  'Hacksaw Rally',
  'Heavy Trenchsaw',
  'Heron Strike',
  'Hidden Potential',
  'Hitman Lock',
  'Inferno Slam',
  'Infinite Spin',
  'Iron Charge',
  'Iron Curtain',
  'Iron Science',
  'Ironhelm Brother',
  'Ironhelm Curse',
  'Jump Attack',
  'Lantern Prophecy',
  "Liege's Gambit",
  'Litany of Wrath',
  "Lord's Cry",
  'Luchador Spring',
  'Mad genius',
  'Mountain Slam',
  "Nature Lord's Cry",
  'No Man’s Blade',
  'Oorah!',
  'Open Palm Burst',
  'Patriot Resolve',
  'Perfect Form',
  'Piercing Beam',
  'Plasma Blade',
  'Predator Form',
  'Pressure Cutter',
  'Primitive Fury',
  'Prince Beam',
  'Quiet Erase',
  'Rallying Clasp',
  'Rebel Sleeper',
  'Restorative March',
  'Ricochet Pistols',
  'Rising Fury',
  'Royal Pride',
  'Scout Ring',
  'Script Ward',
  'Sentinel Lock',
  'Seven Star Fist',
  'Shadow Strike',
  'Shield Horn',
  'Silver Flurry',
  'Sky Elbow',
  'Skyburst',
  'Skyburst Wave',
  "Slayer's Thrust",
  'Slicing Step',
  'Small and Quick',
  'Sniper Cover',
  'Solar Heal',
  'Solar Pulse',
  'Spin Charge',
  'Spirit Rush',
  'Steel Ball',
  'Stonebreaker',
  'Storm Shield',
  'Summary Execution',
  'Summary Judgement',
  'Tech Head',
  'Tech Ops',
  "Technician's Lock",
  'The Hand',
  'The Ogre',
  'Titan Surge',
  'Tower Drop',
  'Trenchsaw',
  'Trenchsaw Drill',
  'Tribal Charge',
  'Unbound Thread',
  'Unholy Armor',
  'Unholy Armour',
  'Vanguard Rage',
  'Vanguard Shield',
  'Vanguard Training',
  'Violet Snare',
  'Vital Points',
  'Voice Echo',
  'Voice Shout',
  'Void Key',
  'Void Slam',
  'Volley Discipline',
  'Warp Bolt',
  'Warp Fury',
  'Waterbird Fist',
  'Weather Stand',
  'White Heron Fist',
  'Wolf Leader',
  'Zip Fingers',
];
// Company names and screen headings from before the rewrite.
const OLD_COMPANIES = [
  'Grand Coliseum',
  'Coliseum',
  'Void Residue',
  'First Circle',
  'Orbital Vanguard',
  'Iron Trench',
  'Ninefold',
  'Iron Pit',
  'Bound Spirit',
  'Spirit Court',
  'North Star',
  'Skyburst',
  'Crimson Legion',
  'Crystal Vanguard',
  'Rift Cult',
  'Voicebound',
  'Legion Archive',
  'Iron Creed',
  'Evolved Allies',
  'evolved operative',
  'evolved roster',
  'evolved ally',
  'operative',
  'operatives',
  'superstar',
  'showmanship',
  'entrance theme',
  'tag team',
  'main event',
];
// Words that belong to other people's worlds, or to real people. Split so the list reads as
// what it is: the left column is the source, the right what must not be printed.
const SOURCE_TERMS = [
  // wrestling
  'wwe',
  'wrestl\\w*',
  'stone cold',
  'stunner',
  'rock bottom',
  'hulk',
  'macho',
  'scorpion',
  'batista',
  'tombstone',
  'chokeslam',
  'jackknife',
  'piper',
  'hacksaw',
  'junkyard',
  'luchador',
  'crippler',
  'brogue',
  'celtic',
  'gaelic',
  'rko',
  'apex drop',
  'curb stomp',
  'sharpshooter',
  'hitman',
  'nature lord',
  'patriot',
  'tribal',
  'outta nowhere',
  'power bomb',
  'sky elbow',
  // shooters
  'halo',
  'spartan\\w*',
  'master chief',
  'noble',
  'mjolnir',
  'covenant',
  'orbital',
  'plasma',
  'fireteam',
  'fire-team',
  'oorah',
  'gears',
  'lancer burst',
  'chainsaw\\w*',
  'carmine',
  'ironhelm',
  'trenchsaw',
  'coalition',
  'jacinto',
  'ultimis',
  'primis',
  'wunder\\w*',
  'apothicon',
  'vodka',
  'aether',
  'summoning key',
  'void key',
  'residue',
  'multivers\\w*',
  'timeline',
  // fantasy books and games
  'fellowship',
  'gondor',
  'rivendell',
  'halfling',
  'hobbit',
  'elven',
  'elf',
  'dwarf',
  'dwarven',
  'grey pilgrim',
  'ranger',
  'nine walkers',
  'crownless',
  'ring bearer',
  'scout ring',
  'dragonborn',
  'greybeard',
  'nord',
  'huscarl',
  'thu.?um',
  'voice shout',
  'dragon aspect',
  'nightingale',
  'nightjar',
  'wyrmcaller',
  'moot',
  'black mage',
  'white mage',
  'dragoon',
  'limit break',
  'limit striker',
  'firaga',
  'curaga',
  'soldier of light',
  'crystal',
  'aeon',
  'summoner',
  'imperium',
  'astartes',
  'chapter',
  'legion\\w*',
  'bolter',
  'lasgun',
  'commissar',
  'chaplain',
  'librarian',
  'terminator',
  'dreadnought',
  'guardsman',
  'warp',
  'chaos',
  'daemon',
  'heretic\\w*',
  'possessed',
  'transhuman',
  'grimdark',
  'litany',
  // manga and anime
  'baki',
  'hanma',
  'ogre patriarch',
  'demon back',
  'fiend’s back',
  'dojo',
  'jojo',
  'joestar',
  'ashford',
  'zephyr',
  'stand user',
  'stand arrow',
  'hamon',
  'ripple',
  'solar pulse',
  'sunbreath',
  'steel ball',
  'spin',
  'rotation',
  'emerald',
  'star platinum',
  'zip',
  'cohort',
  'part \\d',
  'hokuto',
  'nanto',
  'seven star',
  'sevenstar',
  'pressure point\\w*',
  'waterbird',
  'ki',
  'saiyan',
  'kamehameha',
  'galick',
  'power level',
  'perfect form',
  'hakai',
  'capsule',
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrase = (list) => list.map((s) => esc(s).replace(/['’]/g, "['’]"));
const BLOCK = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...phrase(OLD_NAMES), ...phrase(OLD_ABILITIES), ...phrase(OLD_COMPANIES), ...SOURCE_TERMS].join('|')})(?![\\p{L}\\p{N}])`,
  'iu'
);
/** The first blocked term in a string, or null. */
const blocked = (text) => {
  const m = BLOCK.exec(String(text));
  return m ? m[0] : null;
};
ok(
  blocked('Sergeant Ashford rallies') && blocked('a Coliseum bout') && !blocked('Hold the Gate'),
  'the blocklist catches an old name and passes a new one'
);

// ---------------------------------------------------------------- data files
const everyone = { ...champions, ...operatives };
ok(
  Object.keys(champions).length === 29 && Object.keys(operatives).length === 104,
  '29 champions and 104 hired heroes'
);

const incomplete = Object.entries(everyone).filter(
  ([, d]) =>
    ![d.displayName, d.title, d.description, d.abilityDesc].every(
      (x) => typeof x === 'string' && x.trim().length > 2
    ) ||
    d.name !== d.displayName ||
    !/[.!?]$/.test(d.description) ||
    !/^[^—]+ — .+\.$/.test(d.abilityDesc)
);
ok(
  incomplete.length === 0,
  `every champion and hero has a display name, title, description and ability text ${incomplete.map(([id]) => id).join(',')}`
);

const seen = new Map();
const clashes = [];
for (const [id, d] of Object.entries(everyone)) {
  const key = d.displayName.toLowerCase();
  if (seen.has(key)) clashes.push(`${seen.get(key)}=${id}`);
  seen.set(key, id);
}
ok(clashes.length === 0, `display names are unique ${clashes.join(',')}`);
const titles = Object.values(everyone).map((d) => d.title.toLowerCase());
ok(new Set(titles).size === titles.length, 'titles are unique');

// A name must not be its id in disguise ("master_chief" -> "Master Chief").
const idWords = (id) =>
  id
    .replace(/_p\d$/, '')
    .split('_')
    .filter((w) => w.length > 2 && w !== 'the');
const echoes = Object.entries(everyone).filter(([id, d]) => {
  const shown = `${d.displayName} ${d.title}`.toLowerCase();
  return idWords(id).some((w) => new RegExp(`(?<![a-z])${esc(w)}(?![a-z])`).test(shown));
});
ok(
  echoes.length === 0,
  `no name or title repeats a word of its id ${echoes.map(([id]) => id).join(',')}`
);

// Every string value in the three data files. Keys that hold ids, not text, are skipped.
const ID_KEYS = new Set(['ability', 'faction', 'type', 'projectile', 'combatTag', 'color']);
const dataHits = [];
const walk = (node, path) => {
  if (typeof node === 'string') {
    const hit = blocked(node);
    if (hit) dataHits.push(`${path}: "${hit}"`);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) if (!ID_KEYS.has(k)) walk(v, `${path}.${k}`);
  }
};
walk(champions, 'champions');
walk(operatives, 'operatives');
walk(profiles, 'profiles');
ok(
  dataHits.length === 0,
  `no old name or source term in the cast data ${dataHits.slice(0, 12).join(' | ')}`
);

// The ability name on the card is the trait name in the profile.
const split = [];
for (const [id, d] of Object.entries(everyone)) {
  const p = profiles.champions[id] || profiles.operatives[id];
  if (!p || p.trait.split(' — ')[0] !== d.abilityDesc.split(' — ')[0]) split.push(id);
}
ok(split.length === 0, `card ability and profile trait share one name ${split.join(',')}`);

// ---------------------------------------------------------------- the running game
const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb } = boot(33);
const g = vm.runInContext(
  `${code}\n({ HeroCast, CrossoverFactions, CHAMPION_FACTION, CrossoverHub, WweAcademy, FactionDepth,
    OperativeSkillTrees, MetaProgress, Roster, formatUnitTypeName, getUnitTypeName })`,
  vm.createContext(sb)
);
const { HeroCast, CrossoverFactions, CHAMPION_FACTION, FactionDepth } = g;

// Companies: thirteen, each with a name, a kind, two sentences of lore and a crest colour.
const companies = [...Object.values(CrossoverFactions), CHAMPION_FACTION];
const thin = companies.filter(
  (f) =>
    !f.label ||
    !f.short ||
    !f.kind ||
    !/^#[0-9a-f]{6}$/i.test(f.crest || '') ||
    (f.lore || '').split(/[.!?](?:\s|$)/).filter((x) => x.trim()).length !== 2
);
ok(
  Object.keys(CrossoverFactions).length === 13 && thin.length === 0,
  `thirteen companies and the champions each have a name, kind, crest and two sentences of lore ${thin.map((f) => f.id).join(',')}`
);
ok(
  new Set(companies.map((f) => f.label)).size === companies.length &&
    new Set(companies.map((f) => f.crest)).size === companies.length,
  'company names and crest colours are unique'
);
const homeless = Object.entries(operatives).filter(([, d]) => !CrossoverFactions[d.faction]);
ok(
  homeless.length === 0,
  `every hero belongs to a company ${homeless.map(([id]) => id).join(',')}`
);
// One name per company wherever it is written.
const drift = companies.filter(
  (f) =>
    FactionDepth.PROFILES[f.id]?.label !== f.label ||
    (g.OperativeSkillTrees.FACTION_TREES[f.id] &&
      g.OperativeSkillTrees.FACTION_TREES[f.id].label !== f.label)
);
ok(
  drift.length === 0,
  `company names agree across the screens ${drift.map((f) => f.id).join(',')}`
);

// Display helpers never hand back an id.
const looksLikeId = (text, id) => {
  const t = String(text).toLowerCase();
  return (
    t === id ||
    t.includes('_') ||
    t === id.replace(/_/g, ' ') ||
    idWords(id).some((w) => new RegExp(`(?<![a-z])${esc(w)}(?![a-z])`).test(t))
  );
};
const raw = [];
for (const [id, d] of Object.entries(everyone)) {
  const isChampion = !!champions[id];
  const unit = { type: id, team: 'player', isWwe: isChampion, isCrossover: !isChampion };
  const shown = {
    displayName: HeroCast.displayName(id),
    fullName: HeroCast.fullName(id),
    factionOf: HeroCast.factionOf(id),
    typeLabel: HeroCast.typeLabel(d.type),
    tagLabel: HeroCast.tagLabel(d.combatTag),
    formatUnitTypeName: g.formatUnitTypeName(id),
    getUnitTypeName: g.getUnitTypeName(unit),
  };
  for (const [fn, text] of Object.entries(shown)) {
    if (!text || looksLikeId(text, id) || blocked(text)) raw.push(`${fn}(${id})="${text}"`);
  }
  if (shown.displayName !== d.displayName || shown.formatUnitTypeName !== d.displayName) {
    raw.push(`${id} is not shown by its display name`);
  }
  if (
    d.combatTag &&
    shown.tagLabel === d.combatTag &&
    !['melee', 'ranged', 'support'].includes(d.combatTag)
  ) {
    raw.push(`${id} shows raw tag ${d.combatTag}`);
  }
}
ok(raw.length === 0, `no display helper returns an id ${raw.slice(0, 8).join(' | ')}`);
ok(
  !/modded|thing/.test(
    [
      HeroCast.displayName('modded_thing'),
      HeroCast.fullName('modded_thing'),
      HeroCast.factionOf('modded_thing'),
      HeroCast.factionLabel('modded_thing'),
      HeroCast.factionShort('modded_thing'),
      HeroCast.tagLabel('modded_thing'),
      HeroCast.typeLabel('modded_thing'),
    ].join(' ')
  ),
  'an unknown id falls back to a plain word, never to the id'
);
for (const id of Object.keys(CrossoverFactions).concat('wwe')) {
  const label = HeroCast.factionLabel(id);
  if (label.toLowerCase().split(/\W+/).includes(id))
    ok(false, `company label shows its key: ${id}`);
}

// What the two screens draw, with markup and attributes (which carry ids) stripped.
const visible = (html) =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const el = (id) => sb.document.getElementById(id);
for (const f of Object.values(CrossoverFactions)) g.MetaProgress[f.unlockKey] = () => true;
const gs = {
  wave: 12,
  tactical: 9999,
  crossoverOnField: [],
  wweOnField: [],
  crossoverBuildings: [],
};
const screenHits = [];
const scan = (where, html, ids) => {
  const text = visible(html);
  const hit = blocked(text);
  if (hit) screenHits.push(`${where}: "${hit}"`);
  for (const id of ids) {
    if (
      id.includes('_') &&
      (text.includes(id) || text.toLowerCase().includes(id.replace(/_/g, ' ')))
    ) {
      screenHits.push(`${where}: id ${id}`);
    }
  }
  if (/undefined|null|NaN|\[object/.test(text)) screenHits.push(`${where}: broken text`);
  return text;
};
let cards = 0;
for (const f of Object.values(CrossoverFactions)) {
  const ids = Object.keys(operatives).filter((id) => operatives[id].faction === f.id);
  g.CrossoverHub.select(ids[0]);
  g.CrossoverHub.renderRoster(gs);
  const grid = scan(`${f.id} cards`, el('crossover-roster-grid').innerHTML, ids);
  scan(`${f.id} tabs`, el('crossover-faction-tabs').innerHTML, Object.keys(CrossoverFactions));
  for (const id of ids) {
    if (!grid.includes(operatives[id].displayName) || !grid.includes(operatives[id].title)) {
      screenHits.push(`${id} card lacks name or title`);
    }
    g.CrossoverHub.select(id);
    g.CrossoverHub.renderRoster(gs);
    const detail = scan(`${id} detail`, el('crossover-selected-detail').innerHTML, [id, f.id]);
    if (!detail.includes(operatives[id].description) || !detail.includes(f.label)) {
      screenHits.push(`${id} detail lacks description or company`);
    }
    cards++;
  }
}
g.WweAcademy.renderRoster(gs);
const hall = scan('champion cards', el('wwe-roster-grid').innerHTML, Object.keys(champions));
for (const id of Object.keys(champions)) {
  if (!hall.includes(champions[id].displayName) || !hall.includes(champions[id].title)) {
    screenHits.push(`${id} card lacks name or title`);
  }
  g.WweAcademy.select(id);
  const detail = scan(`${id} detail`, el('wwe-selected-detail').innerHTML, [id]);
  if (!detail.includes(champions[id].description))
    screenHits.push(`${id} detail lacks description`);
  cards++;
}
ok(
  cards === 133 && screenHits.length === 0,
  `both hero screens draw ${cards} cards with names, titles and no id or old term ${screenHits.slice(0, 10).join(' | ')}`
);

// Every other string the cast modules can put on screen.
const textHits = [];
const sweep = (where, node) => {
  if (typeof node === 'string') {
    const hit = blocked(node);
    if (hit) textHits.push(`${where}: "${hit}"`);
  } else if (Array.isArray(node)) node.forEach((x, i) => sweep(`${where}[${i}]`, x));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) sweep(`${where}.${k}`, v);
  }
};
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k]]));
sweep(
  'companies',
  companies.map((f) => pick(f, ['label', 'short', 'kind', 'lore']))
);
for (const [fid, p] of Object.entries(FactionDepth.PROFILES)) {
  sweep(
    `profile.${fid}`,
    pick(p, ['label', 'identity', 'weakness', 'playstyle', 'lore', 'masteryTitle'])
  );
}
sweep(
  'northernOps',
  Object.values(FactionDepth.PLANET_WARFARE_OPERATIVES).map((o) =>
    pick(o, ['label', 'operative', 'desc'])
  )
);
sweep(
  'counters',
  Object.values(FactionDepth.ENEMY_COUNTERS).map((c) => c.note)
);
sweep(
  'challenges',
  FactionDepth.MASTERY_CHALLENGES.map((c) => pick(c, ['name', 'desc']))
);
sweep(
  'seasons',
  FactionDepth.SEASONAL_EVENTS.map((c) => pick(c, ['name', 'desc']))
);
// Synergy names in the encyclopedia table come from data/synergies.json, which this suite
// does not own; the entries are swept without that table.
const synergyTable = FactionDepth.formatSynergyTable();
sweep(
  'encyclopedia',
  FactionDepth.getEncyclopediaEntries()
    .filter((e) => e.name !== 'Company Synergies')
    .map((e) => ({ name: e.name, body: e.body.replace(synergyTable, '') }))
);
for (const [fid, tree] of Object.entries(g.OperativeSkillTrees.FACTION_TREES)) {
  sweep(`training.${fid}`, [tree.label, ...Object.values(tree.nodes).map((n) => [n.name, n.desc])]);
}
sweep('screens', [g.WweAcademy.SCREEN_TEXT, g.CrossoverHub.SCREEN_TEXT]);
ok(
  textHits.length === 0,
  `no old name or source term in company, mastery or screen text ${textHits.slice(0, 12).join(' | ')}`
);

// String literals in the four cast modules: floating barks, toasts and dialog text that the
// sweeps above cannot reach. Identifiers, selectors and markup attributes are not text.
const literalHits = [];
for (const file of ['crossover.js', 'wwe.js', 'operative-skill-trees.js', 'faction-depth.js']) {
  const src = readFileSync(join(JS, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const literals = src.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];
  for (const lit of literals) {
    const text = lit
      .slice(1, -1)
      .replace(/\$\{[^}]*\}/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\w-]+="[^"]*"?/g, ' ');
    // An id, a selector, a colour or a key: no spaces and no capital to start a sentence.
    if (!/\s/.test(text.trim()) && !/^[A-Z]/.test(text.trim())) continue;
    if (/^[\w-]+(\s[\w-]+)*$/.test(text.trim()) && text === text.toLowerCase()) continue;
    const hit = blocked(text);
    if (hit) literalHits.push(`${file}: "${hit}" in ${lit.slice(0, 50)}`);
  }
}
ok(
  literalHits.length === 0,
  `no old name or source term in a string the cast modules print ${literalHits.slice(0, 12).join(' | ')}`
);

// The northern-war table names real heroes and their real abilities.
const byAbility = Object.fromEntries(Object.values(operatives).map((d) => [d.ability, d]));
const stale = Object.entries(FactionDepth.PLANET_WARFARE_OPERATIVES).filter(([ability, o]) => {
  const d = byAbility[ability];
  return !d || o.operative !== d.displayName || o.label !== d.abilityDesc.split(' — ')[0];
});
ok(
  stale.length === 0,
  `northern-war entries match the cast data ${stale.map(([a]) => a).join(',')}`
);

process.exit(failures() ? 1 : 0);
