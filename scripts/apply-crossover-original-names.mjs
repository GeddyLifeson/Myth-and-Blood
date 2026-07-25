/**
 * One-shot: rewrite crossover.js player-facing strings to original game content.
 * Internal IDs unchanged. Run: node scripts/apply-crossover-original-names.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(ROOT, 'js', 'crossover.js');
let src = readFileSync(path, 'utf8');

const factionLabels = [
  ["label: 'Element 115'", "label: 'Void Residue Crew'"],
  ["label: 'Primis Crew'", "label: 'First Circle'"],
  ["label: 'UNSC / Spartans'", "label: 'Orbital Vanguard'"],
  ["label: 'COG Forces'", "label: 'Iron Trench Coalition'"],
  ["label: 'Middle-earth'", "label: 'Ninefold March'"],
  ["label: 'Hanma Dojo'", "label: 'Iron Pit Guild'"],
  ["label: 'JoJo (Parts 1–7)'", "label: 'Bound Spirit Court'"],
  ["label: 'Fist of the North Star'", "label: 'North Star Ascetics'"],
  ["label: 'Dragon Ball'", "label: 'Skyburst Order'"],
  ["label: \"Emperor's Finest\"", "label: 'Crimson Legions'"],
  ["label: 'Warp Legion'", "label: 'Rift Cult'"],
  ["label: 'The Elder Scrolls'", "label: 'Voicebound Pact'"],
];

const names = {
  'Tank Dempsey': 'Splinter Vale',
  Richtofen: 'Dr. Volkov',
  'Nikolai Belinski': 'Brass Kozlov',
  'Takeo Masaki': 'Blade Sato',
  'Primis Dempsey': 'Splinter Vale (Ascended)',
  'Primis Nikolai': 'Brass Kozlov (Ascended)',
  'Primis Takeo': 'Blade Sato (Ascended)',
  'Primis Richtofen': 'Dr. Volkov (Ascended)',
  'Master Chief': 'Sentinel-7',
  'Noble Six': 'Lance Operative',
  'Sgt. Johnson': 'Sergeant Ashford',
  'Carter-A259': 'Wolf Leader',
  'Kat-B320': 'Cat Operative',
  'Emile-A239': 'Ember Operative',
  'Jorge-052': 'Heavy Gunner',
  'Jun-A266': 'Sniper Operative',
  'Spartan-IV': 'Vanguard Trooper',
  'Marcus Fenix': 'Marcus Ironhart',
  'Dom Santiago': 'Dom Calder',
  'Damon Baird': 'Damon Gearwright',
  'Augustus Cole': 'Augustus Cole',
  'Anthony Carmine': 'Anthony Ironhelm',
  'Clayton Carmine': 'Clayton Ironhelm',
  'Benjamin Carmine': 'Benjamin Ironhelm',
  'COG Soldier': 'Trench Trooper',
  Aragorn: 'Crownless Ranger',
  Legolas: 'Silvan Archer',
  Gimli: 'Stone Axe Lord',
  Gandalf: 'Grey Pilgrim',
  Frodo: 'Halfling Scout',
  Boromir: 'Shield Captain',
  'Éowyn': 'Shield Maiden',
  'Baki Hanma': 'Ironson Baki',
  'Yujiro Hanma': 'The Ogre Patriarch',
  'Doppo Orochi': 'Doppo Serpent',
  'Jack Hanma': 'Jack Ironson',
  'Oliva Biscuit': 'Oliva Biscuit',
  'Kaku Kaioh': 'Kaku Kaioh',
  Pickle: 'The Primal',
  'Jonathan Joestar': 'Jonathan Ashford',
  'Dio Brando (Pt.1)': 'Dio Crimson',
  'Will A. Zeppeli': 'Will Zephyr',
  'Joseph Joestar (Pt.2)': 'Joseph Ashford',
  'Caesar Zeppeli': 'Caesar Zephyr',
  'Rudol von Stroheim': 'Rudol Ironclad',
  'Jotaro Kujo': 'Jotaro Ashen',
  'Noriaki Kakyoin': 'Noriaki Emerald',
  'Jean Pierre Polnareff': 'Jean Pierre Silver',
  'Mohammed Avdol': 'Mohammed Flame',
  'Josuke Higashikata': 'Josuke Diamond',
  'Okuyasu Nijimura': 'Okuyasu Hand',
  'Rohan Kishibe': 'Rohan Artist',
  'Yoshikage Kira': 'Yoshikage Quiet',
  'Giorno Giovanna': 'Giorno Gold',
  'Bruno Bucciarati': 'Bruno Zipper',
  'Guido Mista': 'Guido Pistols',
  Diavolo: 'Crimson King',
  'Jolyne Cujoh': 'Jolyne String',
  'Weather Report': 'Storm Caller',
  'Ermes Costello': 'Ermes Kiss',
  'Johnny Joestar': 'Johnny Rotation',
  'Gyro Zeppeli': 'Gyro Ballista',
  'Diego Brando': 'Diego Brando',
  'Lucy Steel': 'Lucy Ticket',
  Kenshiro: 'Ken Northstar',
  Raoh: 'Raoh Ken-Oh',
  Toki: 'Toki Healer',
  Rei: 'Rei Suicho',
  Jagi: 'Jagi Traitor',
  Shin: 'Shin Scar',
  Goku: 'Kael Skyburst',
  Vegeta: 'Prince Vex',
  Piccolo: 'Namek Sage',
  Gohan: 'Scholar Burst',
  Trunks: 'Future Blade',
  Frieza: 'Frost Tyrant',
  Cell: 'Perfect Hybrid',
  Beerus: 'Cataclysm Lord',
  'Chapter Captain': 'Legion Captain',
  Chaplain: 'War Chaplain',
  Librarian: 'Rift Librarian',
  Commissar: 'Field Commissar',
  Guardsman: 'Line Guardsman',
  Terminator: 'Heavy Terminator',
  Dreadnought: 'Iron Dreadnought',
  'Soldier of Light': 'Soldier of Light',
  'Black Mage': 'Black Mage',
  'White Mage': 'White Mage',
  Dragoon: 'Sky Lance',
  Summoner: 'Aether Summoner',
  'Limit Striker': 'Limit Striker',
  'Crystal Sentinel': 'Crystal Sentinel',
  'Chaos Champion': 'Chaos Champion',
  'Plague Cultist': 'Plague Cultist',
  'Warp Magus': 'Warp Magus',
  'Daemon Knight': 'Daemon Knight',
  'Heretic Acolyte': 'Heretic Acolyte',
  'Possessed Marine': 'Possessed Marine',
  Dragonborn: 'Wyrmcaller',
  'Greybeard Sage': 'Mountain Hermit',
  'Nord Huscarl': 'Frost Huscarl',
  Battlemage: 'Storm Battlemage',
  Nightingale: 'Shadow Nightingale',
  'Restoration Saint': 'Restoration Saint',
};

for (const [oldLabel, newLabel] of factionLabels) {
  src = src.replaceAll(oldLabel, newLabel);
}

for (const [oldName, newName] of Object.entries(names)) {
  src = src.replaceAll(`name: '${oldName}'`, `name: '${newName}'`);
}

const abilityDesc = [
  ['Frag Out — bonus damage vs clustered foes.', 'Grenade Burst — bonus damage vs clustered foes.'],
  ['Mad genius — chain lightning on elite hits.', 'Mad genius — chain lightning on elite hits.'],
  ['Vodka Rage — damage reduction when wounded.', 'Iron Rage — damage reduction when wounded.'],
  ['Bushido — crit chance rises with stars earned.', 'Bushido — crit chance rises with stars earned.'],
  ['Apothicon Slam — cleave on kill.', 'Void Slam — cleave on kill.'],
  ['Iron Curtain — brief invulnerability pulse below 35% HP.', 'Iron Curtain — brief invulnerability pulse below 35% HP.'],
  ['Spartan Rage — burst damage when wounded.', 'Vanguard Rage — burst damage when wounded.'],
  ['Lancer Burst — sustained fire vs structures.', 'Burst Lancer — sustained fire vs structures.'],
  ['You Shall Not Pass — terrifies nearby foes.', 'Grey Ward — terrifies nearby foes.'],
  ['Ring Bearer — stealth and evasion bonus.', 'Scout Ring — stealth and evasion bonus.'],
  ['Ogre — terror aura and siege bonus.', 'Ogre — terror aura and siege bonus.'],
  ['Hokuto Shinken — ATATATA finisher on low HP foes.', 'North Star Fist — rapid finisher on low HP foes.'],
  ['Kamehameha — burst finisher when surrounded.', 'Skyburst Wave — burst finisher when surrounded.'],
  ['Galick Gun — bonus vs elites, pride damage boost.', 'Prince Beam — bonus vs elites, pride damage boost.'],
  ['Special Beam Cannon — pierces high-HP targets.', 'Piercing Beam — pierces high-HP targets.'],
  ['Death Beam — precision ranged execution.', 'Frost Lance — precision ranged execution.'],
  ['Hakai — god-tier delete on wounded foes.', 'Cataclysm — god-tier delete on wounded foes.'],
  ['Bolter Discipline — bonus damage with allied Astartes nearby.', 'Volley Discipline — bonus damage with allied legionnaires nearby.'],
  ["Fus Ro Dah — Thu'um force shout devastates clustered foes.", 'Voice Shout — force wave devastates clustered foes.'],
  ["Thu'um Echo — empowers allies and weakens nearby foes on wave start.", 'Voice Echo — empowers allies and weakens nearby foes on wave start.'],
  ['Gold Experience — heals allies on kill.', 'Golden Pulse — heals allies on kill.'],
  ['Sticky Fingers — zip-line reposition and rally.', 'Zip Fingers — zip-line reposition and rally.'],
  ['Sex Pistols — ricochet shots hit multiple foes.', 'Ricochet Pistols — ricochet shots hit multiple foes.'],
  ['King Crimson — deletes wounded targets.', 'Crimson Erase — deletes wounded targets.'],
  ['Tusk ACT4 — infinite rotation charge finisher.', 'Rotation ACT4 — infinite rotation charge finisher.'],
  ['Steel Ball — golden spin cleave on charge.', 'Steel Ball — golden spin cleave on charge.'],
  ['Scary Monsters — predatory charge damage.', 'Predator Form — predatory charge damage.'],
];

for (const [oldD, newD] of abilityDesc) {
  src = src.replaceAll(`abilityDesc: '${oldD}'`, `abilityDesc: '${newD}'`);
}

src = src.replace(
  '/**\n * Crossover cheat rosters — gaming & anime crossovers.\n */',
  '/**\n * Evolved allies — operatives summoned from fractured realms across the multiverse.\n */'
);
src = src.replace('// Element 115 — Ultimis', '// Void Residue Crew');
src = src.replace('// Primis', '// First Circle');
src = src.replace('// UNSC / Halo', '// Orbital Vanguard');
src = src.replace('// Gears of War', '// Iron Trench Coalition');
src = src.replace('// LOTR', '// Ninefold March');
src = src.replace('// Baki', '// Iron Pit Guild');
src = src.replace('// JoJo Parts 1–7 (Part 7 = cavalry)', '// Bound Spirit Court (Part 7 = cavalry)');
src = src.replace('// Fist of the North Star', '// North Star Ascetics');
src = src.replace('// Dragon Ball', '// Skyburst Order');
src = src.replace("// Emperor's Finest (grim sci-fi infantry — inspired by boltgun legions)", '// Crimson Legions');
src = src.replace('// Warp Legion (chaos cult warband — inspired by grimdark heretics)', '// Rift Cult');
src = src.replace("// The Elder Scrolls — Dragonborn & Thu'um", '// Voicebound Pact — Wyrmcaller & Voice');

writeFileSync(path, src);
console.log('Updated', path);