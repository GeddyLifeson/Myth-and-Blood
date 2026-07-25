/**
 * De-IP encyclopedia.js display strings. Run: node scripts/scrub-encyclopedia.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'encyclopedia.js');
let src = readFileSync(path, 'utf8');
const before = src;

const REPLACEMENTS = [
  ["{ id: 'crossover_meta', label: 'Crossover System' }", "{ id: 'crossover_meta', label: 'Evolved Allies System' }"],
  ["{ id: 'crossover_fotns', label: 'North Star Fist' }", "{ id: 'crossover_fotns', label: 'North Star Ascetics' }"],
  ["name: 'Crossover Scaling'", "name: 'Evolved Ally Scaling'"],
  ['crossover service (Crossover Echo morale)', 'evolved ally service (Evolved Echo morale)'],
  ['academies, crossovers, +3%', 'academies, evolved allies, +3%'],
  ['Coliseum, Doomslayer, or crossover) is active', 'Coliseum, Doomslayer, or evolved allies) is active'],
  ['omae wa mou shindeiru', 'Your fate was sealed before the strike'],
  ['teamwork, stands, dramatic', 'teamwork, bound spirits, dramatic'],
  ['The Eternal Crusade', 'The Eternal March'],
  ['Edward Dr. Volkov', 'Dr. Volkov'],
  ['Wunderwaffe chains', 'resonance weapon chains'],
  ['Frag Out bonus', 'Grenade Burst bonus'],
  ['pair with Noble team buffs', 'pair with Wolf Pack buffs'],
  ['Noble team leader — Spartans near him', 'Wolf Pack leader — vanguard operatives near him'],
  ['Field him with Jorge, Kat, and Emile for Noble synergy', 'Field him with Heavy Gunner, Cat Operative, and Ember Operative for Wolf Pack synergy'],
  ['Keep Carter mid-line so multiple Spartans catch Noble Leader', 'Keep Wolf Leader mid-line so multiple vanguard operatives catch Wolf Leader'],
  ['without Noble drama', 'without wolf-pack drama'],
  ['Screen him with Jorge or Chief', 'Screen him with Heavy Gunner or Sentinel-7'],
  ['Marcus fights better when Dom is close', 'Ironhart fights better when Dom is close'],
  ['Dom heals Marcus when nearby', 'Dom heals Ironhart when nearby'],
  ["Keep Dom within Marcus's screen", "Keep Dom within Ironhart's screen"],
  ['Never split Dom from Marcus on hard waves', 'Never split Dom from Ironhart on hard waves'],
  ['Send Baird against siege', 'Send Gearwright against siege'],
  ['The Carmine curse is real', 'The Ironhelm curse is real'],
  ['Heavy weapons Carmine — suppression', 'Heavy weapons Ironhelm — suppression'],
  ['Another Carmine — buffs his brothers', 'Another Ironhelm — buffs his brothers'],
  ['Lancer Drill provides', 'Burst Drill provides'],
  ['You shall not pass — terror radiates', 'Grey Ward — terror radiates'],
  ['Ring-bearer — small, evasive', 'Scout ring — small, evasive'],
  ['Scout Ring keeps fragile lines', 'Scout Ring keeps fragile lines'],
  ['behind the fellowship', 'behind the march company'],
  ['with No Man — devastating finisher', 'with Elite Slayer — devastating finisher'],
  ['Doppo Orochi punishes', 'Doppo Serpent punishes'],
  ['Slower than Baki but nearly', 'Slower than Ironson Baki but nearly'],
  ['— Hamon teacher', '— solar teacher'],
  ['— Hamon bubbles find', '— pressure bubbles find'],
  ['German science — bonus', 'Iron science — bonus'],
  ['spirit rush — Spirit Rush pins elites and shreds them', 'Spirit Rush — rapid finisher pins elites and shreds them'],
  ['Spirit Rush spirit rush on pinned foes', 'Spirit Rush rapid finisher on pinned foes'],
  ["Focus fire elites into Jotaro's lane", "Focus fire elites into Jotaro Ashen's lane"],
  ['Emerald Splash hits', 'Emerald Spray hits'],
  ["Heaven's Door ruins", "Script Ward ruins"],
  ["Heaven's Door — debuffs", "Script Ward — debuffs"],
  ['Sex Pistols ricochet', 'Ricochet Pistols ricochet'],
  ["Guido Mista's Sex Pistols", "Guido Mista's Ricochet Pistols"],
  ['King Crimson removes wounded', 'Crimson Erase removes wounded'],
  ['Diavolo is Part 5 assassin — King Crimson', 'Crimson King is Part 5 assassin — Crimson Erase'],
  ['Weather Stand — AoE', 'Storm Field — AoE'],
  ['Weather Report is Part 6', 'Storm Caller is Part 6'],
  ['Jolyne Cujoh slows', 'Jolyne String slows'],
  ['Tusk ACT4 charge finisher', 'Rotation ACT4 charge finisher'],
  ['Tag-team with Johnny for SBR', 'Tag-team with Johnny Rotation for golden ball hunts'],
  ['Scary Monsters predatory', 'Predator Form predatory'],
  ['You are already dead — North Star Fist finisher legend', 'Fate was sealed — North Star Fist finisher legend'],
  ['Ken Northstar is the Hokuto successor — ATATATA finisher', 'Ken Northstar is the North Star successor — rapid finisher'],
  ['mandatory Hokuto support', 'mandatory North Star support'],
  ['Skyburst Wave when surrounded — Saiyan burst finisher', 'Skyburst Wave when surrounded — skyburst finisher'],
  ['Special Beam Cannon pierces', 'Piercing Beam pierces'],
  ['Special Beam pierces', 'Piercing Beam pierces'],
  ['Gohan explodes when wounded', 'Scholar Burst explodes when wounded'],
  ['Death Beam picks off', 'Frost Lance picks off'],
  ['Frieza is cold ranged', 'Frost Tyrant is cold ranged'],
  ['Cell heals on kill with Perfect Form', 'Perfect Hybrid heals on kill with Perfect Form'],
  ['Boltgun discipline — Astartes fight harder', 'Volley discipline — legionnaires fight harder'],
  ['clustering Astartes on the line', 'clustering legionnaires on the line'],
  ['Chapter Captain is the Imperium ranged core', 'Chapter Captain is the crimson legions ranged core'],
  ['Terminator is the Imperium anchor', 'Heavy Terminator is the crimson legions anchor'],
  ['Lasgun Volley splashes', 'Rifle Volley splashes'],
  ['Greybeard Sage is support-ranged — Thu\'um Echo', 'Mountain Hermit is support-ranged — Voice Echo'],
  ['Ancient monks who teach the Voice', 'Ancient monks who teach the Voice'],
  ['Wyrmcaller is the TES flagship — melee bruiser with Voice Shout shout cleave', 'Wyrmcaller is the Voicebound flagship — melee bruiser with Voice Shout cleave'],
  ['whispers of the Thu\'um precede', 'whispers of the Voice precede'],
  ['Pair with Greybeard Sage', 'Pair with Mountain Hermit'],
  ['Deploy at dawn beside Wyrmcaller for shout synergy', 'Deploy at dawn beside Wyrmcaller for voice synergy'],
  ['Nord Huscarl is a durable', 'Frost Huscarl is a durable'],
  ['sworn to Mara who mend', 'sworn to restoration saints who mend'],
  ['Rip & Tear cleave', 'Rend & Ruin cleave'],
  ['unleashes Rip & Tear', 'unleashes Rend & Ruin'],
  ["name: 'Rip & Tear'", "name: 'Rend & Ruin'"],
  ['Passione sustain engine', 'gold-court sustain engine'],
  ['Part 1 Dio slows', 'Part 1 crimson lord slows'],
  ['behind Nikolai', 'behind Kozlov'],
  ['Keep him behind Nikolai', 'Keep him behind Kozlov'],
  ['Void Residue Takeo', 'Void Residue Sato'],
  ['Lancer Burst chainsaw', 'Burst Lancer chainsaw'],
  ['behind Marcus', 'behind Ironhelm'],
  ['Clayton Ironhelm suppresses groups with Heavy Lancer fire', 'Clayton Ironhelm suppresses groups with heavy burst fire'],
  ['Anthony Ironhelm is budget lancer support', 'Anthony Ironhelm is budget burst support'],
  ['I am no man — elite slayer', 'Elite slayer — no quarter given'],
  ['Dragoon is cavalry hunter', 'Sky Lance is cavalry hunter'],
  ['Dragoon Knight', 'Sky Lance Knight'],
];

for (const [from, to] of REPLACEMENTS) {
  if (from !== to) src = src.split(from).join(to);
}

// Add missing faction categories before perks
const catInsert = `    { id: 'crossover_dragonball', label: 'Skyburst Order' },
    { id: 'perks', label: 'Tonic Stations' },`;
const catNew = `    { id: 'crossover_dragonball', label: 'Skyburst Order' },
    { id: 'crossover_imperium', label: 'Crimson Legions' },
    { id: 'crossover_crystal', label: 'Crystal Vanguard' },
    { id: 'crossover_warp', label: 'Rift Cult' },
    { id: 'crossover_tes', label: 'Voicebound Pact' },
    { id: 'perks', label: 'Tonic Stations' },`;
if (src.includes(catInsert) && !src.includes("crossover_imperium")) {
  src = src.replace(catInsert, catNew);
}

// Coliseum tease — original arena flavor aligned to renamed champions
const COLISEUM_TEASE = `  const COLISEUM_TEASE = {
    stone_cold:
      'The Stonebreaker — court records say elites fall to a sudden stunner and the crowd goes silent.',
    the_rock:
      'The Mountain King lays the smack down; kill streaks get louder when he headlines.',
    ric_flair:
      'The Nature Lord — allies near him fight with extra swagger. Woooo!',
    hulk_hogan:
      'The Titan — below half health he hulks up and refuses to stay down.',
    macho_man: 'Sky Elbow Ace drops elbows from the high ground. Snap into it.',
    sting:
      'The Crow Sentinel strikes from the shadows. Wounded prey rarely escape the deathlock.',
    john_cena:
      'The Patriot never gives up — damage seems to bounce off when the fight turns ugly.',
    bautista: 'The Animal Lord — his bomb shakes everyone standing too close.',
    roman_reigns: 'The Tribal Chief — the spear ends arguments and several orcs at once.',
    shawn_michaels:
      'Sweet Chin Ace — chin music rings out when the moment is right, usually a crit.',
    bret_hart: 'The Hitman — sharpshooter locks a single foe in misery.',
    undertaker: 'The Grave Walker — tombstones spread dread; enemy morale withers nearby.',
    kane: 'The Inferno Brother — chokeslams hit harder the bigger the target.',
    andre_giant: 'The Colossus — footsteps cause splash damage; walls fear him.',
    razor_ramon: 'The Razor Duke — steady, stylish, inevitable edge damage.',
    kevin_nash: 'The Diesel Tower — power bombs echo through the ranks.',
    roddy_piper: 'The Pit Piper — hot tag energy; when he scores, allies feel it.',
    hacksaw_duggan: 'The Hacksaw Patriot — rally pulses on wave start when he is signed.',
    junkyard_dog: 'The Junkyard Bruiser — headbutts stun on impact.',
    rey_mysterio: 'The Luchador Phantom — too fast to pin, too clever to catch.',
    eddie_guerrero: 'The Latino Liege — lie, cheat, steal; maybe pick an elite pocket for TP.',
    chris_benoit: 'The Crippler Ace — surgical, cruel, single-target devastation.',
    oba_femi: 'The Rising Champion — surrounded is when he hits hardest.',
    brock_lesnar: 'The Beast Incarnate — if you are wounded, you are gone.',
    cm_punk: 'The Straightedge Rebel — go-to-sleep finishes anyone already hurting.',
    seth_rollins: 'The Architect — curb stomps from range at wounded targets.',
    sheamus: 'The Celtic Warrior — brogue kick leaves a line of bodies.',
    bray_wyatt:
      'The Lantern Prophet — his lantern dims enemy accuracy when dusk falls on the field.',
    randy_orton: 'The Apex Predator — outta nowhere on anyone already hurting.',
  };`;

src = src.replace(/const COLISEUM_TEASE = \{[\s\S]*?\n  \};/, COLISEUM_TEASE);

if (src !== before) {
  writeFileSync(path, src);
  console.log('Updated js/encyclopedia.js');
} else {
  console.log('No encyclopedia changes needed.');
}