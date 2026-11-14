/**
 * Myth and Blood — encyclopedia (main menu, pause menu, in-game HUD).
 */
const Encyclopedia = (() => {
  let panelOpen = false;
  let returnToPause = false;
  const COLISEUM_TEASE = {
    stone_cold:
      'The Wall-Splitter: old bailiff rolls say elites fall to one keystone blow, and the yard goes quiet.',
    the_rock: 'The Cairn-Maker raises a stone over every foe he drops; his kill streaks ring loud.',
    ric_flair: 'The Gilded Bastard: allies near him fight with a boasting nerve.',
    hulk_hogan:
      'The Unfelled: below half health his stubborn blood surges and he will not stay down.',
    macho_man:
      'The Javelin of Spite hurls from the high ground, and the crit lands before the cheer.',
    sting: 'The Gaoler drags the wounded back by the chain. Few slip his hold.',
    john_cena: 'The Oathkeeper never yields: blows seem to glance off when the fight turns ugly.',
    bautista: 'The Bull of Marrowgate: his goring sweep scatters everyone standing too close.',
    roman_reigns: 'The Fen Warden: his shoulder ram ends arguments and several orcs at once.',
    shawn_michaels:
      'The Tourney Darling: a spinning heel rings out when the moment is right, usually a crit.',
    bret_hart: 'The Lockwright: one hold, one foe, no way out.',
    undertaker:
      'The Bell of Low Hallow: a passing bell spreads dread; enemy morale withers nearby.',
    kane: 'The Troll-Flayer: his barbed hide bites harder the bigger the target.',
    andre_giant: 'The Walking Keep: footsteps splash damage; walls fear him.',
    razor_ramon: 'The Patient Blade: steady, stylish, inevitable edge damage.',
    kevin_nash: 'The Lintel: every fourth blow brings the roof down on the ranks.',
    roddy_piper: 'The Heckler: when he scores, allies feel it.',
    hacksaw_duggan:
      'The Colour-Serjeant: raises the colours and rallies the line at the start of each wave.',
    junkyard_dog: "The Ram of Tanner's Row: his brow stuns on a crit.",
    rey_mysterio: 'The Rope-Dancer: too quick to pin, too clever to catch.',
    eddie_guerrero:
      'The Light-Fingered: lie, cheat, steal; maybe lift a purse from an elite for TP.',
    chris_benoit: 'The Vise: surgical, cruel, single-target devastation.',
    oba_femi: 'The Unbeaten Novice: surrounded is when he hits hardest.',
    brock_lesnar: 'The Butcher of the Bloodsand: if you are wounded, you are gone.',
    cm_punk: 'The Hedge-Preacher: the last word finishes anyone already hurting.',
    seth_rollins: 'The Poacher: a long cast at wounded targets.',
    sheamus: 'The Peat-Cutter: his sweep leaves a line of bodies.',
    bray_wyatt:
      'The Bog Oracle: her corpse-candle dims enemy accuracy when dusk falls on the field.',
    randy_orton: 'The Still Hand: a sudden fall on anyone already hurting.',
  };

  const CATEGORIES = [
    { id: 'allies', label: 'Allies' },
    { id: 'enemies', label: 'Enemies' },
    { id: 'roles', label: 'Roles & Counters' },
    { id: 'bestiary', label: 'Bestiary' },
    { id: 'buildings', label: 'Buildings' },
    { id: 'orders', label: 'Orders & Strikes' },
    { id: 'stars', label: 'Star System' },
    { id: 'eras', label: 'Eras & Economy' },
    { id: 'colony', label: 'Kingdom Strength' },
    { id: 'research', label: 'Research' },
    { id: 'loadouts', label: 'Loadouts' },
    { id: 'bosses', label: 'Named Bosses' },
    { id: 'campaign', label: 'Campaign' },
    { id: 'honor', label: 'Honor & Veterans' },
    { id: 'wwe', label: 'Grand Coliseum Champions' },
    { id: 'doomslayer', label: 'Hellbane' },
    { id: 'crossover_meta', label: 'Evolved Allies System' },
    { id: 'crossover_ultimis', label: 'Void Residue' },
    { id: 'crossover_primis', label: 'First Circle' },
    { id: 'crossover_halo', label: 'Orbital Vanguard' },
    { id: 'crossover_gears', label: 'Iron Trench Coalition' },
    { id: 'crossover_lotr', label: 'Ninefold March' },
    { id: 'crossover_baki', label: 'Iron Pit Guild' },
    { id: 'crossover_jojo', label: 'Bound Spirit Court' },
    { id: 'crossover_fotns', label: 'North Star Ascetics' },
    { id: 'crossover_dragonball', label: 'Skyburst Order' },
    { id: 'crossover_imperium', label: 'Crimson Legions' },
    { id: 'crossover_crystal', label: 'Crystal Vanguard' },
    { id: 'crossover_warp', label: 'Rift Cult' },
    { id: 'crossover_tes', label: 'Voicebound Pact' },
    { id: 'perks', label: 'Tonic Stations' },
    { id: 'chronicles', label: 'Chronicles' },
    { id: 'story', label: 'Story Arc' },
    { id: 'legacy', label: 'Legacy' },
    { id: 'creative', label: 'Creative Lab' },
  ];

  const BASE_ENTRIES = [
    {
      cat: 'allies',
      name: 'Footman',
      body: 'Cheap melee line-holder. Garrisons walls when a General commands the Keep. Earns bronze stars from kills; 3 gold stars may earn an honor name (e.g. Syr Gwyn).',
    },
    {
      cat: 'allies',
      name: 'Archer',
      body: 'Long-range DPS. Garrison outposts for extended range. Fragile — keep behind cover.',
    },
    {
      cat: 'allies',
      name: 'Mage',
      body: 'Arcane bolts with splash damage. Strong vs clustered foes.',
    },
    {
      cat: 'allies',
      name: 'Cavalry',
      body: 'Fast melee with charge bonus. Excellent for hunting stragglers.',
    },
    {
      cat: 'allies',
      name: 'Healer',
      body: 'Heals allies in range — including other healers. Ranks when healing (once per wave). On any damage, retreats to the nearest med tent until enemies stop targeting them. At ≤25% HP they also follow the standard wounded retreat.',
    },
    {
      cat: 'allies',
      name: 'Knight',
      body: 'Heavy armored melee with damage resistance. Banner courier can summon one.',
    },
    {
      cat: 'allies',
      name: 'Sapper',
      body: 'Field engineer. Buries mines at night that blow under the first enemy to step on them, and lobs satchel charges by day. Blasts ignore armour and shields. Only a knife up close — keep him behind the line.',
    },
    {
      cat: 'allies',
      name: 'General',
      body: 'Global enemy priority target. Station in the castle Keep to grow a command aura and assign footmen to wall slots. Stars after promotion only buff aura.',
    },
    {
      cat: 'allies',
      name: 'Builder',
      body: 'Erects structures (2 projects max). Required ×5 for Hamlets and Merchant Guilds. Ranks when building.',
    },
    {
      cat: 'allies',
      name: 'Courier',
      body: 'Dispatches royal messages once per wave (twice with Twin Dispatch at 3 gold stars). Ranks when sending dispatches.',
    },

    {
      cat: 'enemies',
      name: 'Enemy Faction Evolution',
      body: 'Five hostile realms evolve on a 4-stage track (Grunts → Elites → Forts → Kingdom). Open the Enemies tab after the game loads for full per-faction stage pages with unit pools, northern builds, and counter-raid rules.',
    },
    {
      cat: 'enemies',
      name: 'Horde Grunts',
      body: 'Goblins, orcs, plague rats, and sappers scale slowly — filler that falls behind as waves climb. The host replaces them with evil operatives.',
    },
    {
      cat: 'enemies',
      name: 'Evil Operatives',
      body: 'Fantasy horrors that scale with waves like your evolved roster — hellbound legionnaires, grim revenants, cinderbound juggernauts, and more. Purple glow marks operatives.',
    },
    {
      cat: 'enemies',
      name: 'Goblin',
      body: 'Weak horde grunt. Appears from wave 1 — does not scale like operatives.',
    },
    {
      cat: 'enemies',
      name: 'Orc',
      body: 'Sturdy horde grunt. Backbone of early waves; obsolete filler late game.',
    },
    {
      cat: 'enemies',
      name: 'Hellbound Legionnaire',
      body: 'Wave 25+ operative. Infernal bolt-caster — fantasy mirror of modern rifle lines.',
    },
    {
      cat: 'enemies',
      name: 'Grim Revenant',
      body: 'Wave 45+ operative. Soul-harvest sniper with extreme range.',
    },
    {
      cat: 'enemies',
      name: 'Cinderbound Juggernaut',
      body: 'Wave 55+ operative. Walking furnace armor — counters your late-game walls.',
    },
    { cat: 'enemies', name: 'Orc Archer', body: 'Ranged pressure from the back line.' },
    {
      cat: 'enemies',
      name: 'Dark Knight',
      body: 'Elite armored knight — purple glow. High HP and damage.',
    },
    { cat: 'enemies', name: 'Warg Rider', body: 'Fast cavalry harasser.' },
    { cat: 'enemies', name: 'Dark Mage', body: 'Ranged arcane attacker.' },
    { cat: 'enemies', name: 'Troll', body: 'Elite bruiser with heavy wall damage.' },
    { cat: 'enemies', name: 'Goblin Sapper', body: 'Demolishes walls and settlements.' },
    { cat: 'enemies', name: 'Necromancer', body: 'Elite caster.' },
    { cat: 'enemies', name: 'Berserker', body: 'Elite high-damage melee.' },
    { cat: 'enemies', name: 'Assassin', body: 'Elite striker — hunts your General.' },
    { cat: 'enemies', name: 'Shaman', body: 'Enemy healer supporting hordes.' },
    {
      cat: 'enemies',
      name: 'Siege Tower',
      body: 'Deploys against walls every 5 waves. Linked to a wall segment for sustained fire.',
    },
    {
      cat: 'enemies',
      name: 'Goblin Engineer',
      body: 'Drops barricades. After wave 200, enemy economy buildings mirror yours.',
    },
    {
      cat: 'enemies',
      name: 'War Chief',
      body: 'Boss-tier elite. Appears in late pools when no named boss leads.',
    },
    {
      cat: 'enemies',
      name: 'Named Bosses (Every 10 Waves)',
      body: 'Waves 10, 20, 30… each field a unique warlord who leads the assault personally. See the Named Bosses tab for full lore, mechanics, and counters. Monster bosses evolve each return: Prime → Returned → Ascendant → Eternal — stronger stats plus a themed pack of minions and northern holds.',
    },
    {
      cat: 'enemies',
      name: 'Abomination',
      body: 'Huge flesh horror with tentacles and many eyes. Regenerates slowly — burst it down.',
    },
    {
      cat: 'enemies',
      name: 'Behemoth',
      body: 'Colossal elite bruiser. Slow, enormous on the battlefield, smashes walls. Enrages below 40% HP.',
    },
    {
      cat: 'enemies',
      name: 'Iron Colossus',
      body: 'Massive riveted siege construct. Highest structure damage in the horde.',
    },
    {
      cat: 'enemies',
      name: 'Void Stalker',
      body: 'Tall shadow assassin — always hunts your General. Kill it before it closes.',
    },
    {
      cat: 'enemies',
      name: 'Elder Wyrm',
      body: 'Ancient flying dragon, larger than sky drakes. Boss-tier fire from above.',
    },

    {
      cat: 'buildings',
      name: 'Outpost',
      body: 'Forward cover +1 garrison slot for ranged units. Extends archer range.',
    },
    {
      cat: 'buildings',
      name: 'Wall',
      body: '5 TP. Blocks movement and holds line-breakers: each wall stops up to 3 runners per wave that come within reach, and they have to stand and fight. 2 footman slots per wall when General commands Keep. Siege priority.',
    },
    {
      cat: 'buildings',
      name: 'Castle Compound',
      body: 'Large footprint: 4 walls, 4 outposts, Keep, med tent, mess hall. Center of command.',
    },
    {
      cat: 'buildings',
      name: 'Medical Tent',
      body: 'Wounded allies at ≤25% HP retreat to the globally nearest med tent. Healers flee here on any damage until safe. Units heal while garrisoned and rejoin the fight once restored. Stretcher bearers: once per wave, a soldier struck down within 220 of a tent is carried in alive at a quarter health instead of dying.',
    },
    { cat: 'buildings', name: 'Mess Hall', body: 'Morale aura for nearby troops.' },
    {
      cat: 'buildings',
      name: 'Academies',
      body: 'Training halls unlocked through research. Each complete academy trains 1 free unit per round alongside normal TP deploy. Special cadence: Healer Academy every 5 waves, General Academy every 10 waves (needs a promotable Footman, not an active General), Builder/Courier Academies only while none of that type is on the field.',
    },
    {
      cat: 'buildings',
      name: 'Academy Mentors (Immortal Veterans)',
      body: 'You cannot found an academy until its mentor walks the field. Find an Immortal veteran first: promote a troop of the matching type to max rank (Immortal for combat troops; Saint of the Realm for specialists) using Veteran Doctrine research and TP promotions. Deploy that mentor alive, then place the academy — e.g. Footman Academy needs an Immortal Footman, Archer Academy needs an Immortal Archer. General Academy instead needs a Footman who completed a gold-star honor cycle. The mentor must stay alive; if they fall, the academy keeps training but you cannot rebuild that hall without a new mentor.',
    },
    {
      cat: 'buildings',
      name: 'Quarry',
      body: '14 TP, 1 Builder, needs Prospecting. +3 TP at dawn, shown over the building (counts toward 6-site cap with trade posts).',
    },
    {
      cat: 'buildings',
      name: 'Trade Outpost',
      body: '10 TP, 1 Builder, no research. +2 TP at dawn, shown over the building, and a small morale aura. Same 6-site cap as quarries.',
    },
    {
      cat: 'buildings',
      name: 'Hamlet',
      body: '100 TP, 5 Builders, 5-wave build. +5 TP/round. First settlement tier — requires Settlement Charter research.',
    },
    {
      cat: 'buildings',
      name: 'Village',
      body: '180 TP, 6 Builders, 6-wave build. +8 TP/round. Requires Village Rights research.',
    },
    {
      cat: 'buildings',
      name: 'Town',
      body: '280 TP, 7 Builders, 7-wave build. +10 TP/round. Requires Town Charter research.',
    },
    {
      cat: 'buildings',
      name: 'City',
      body: '420 TP, 8 Builders, 8-wave build. +12 TP/round. Requires Urban Planning research.',
    },
    {
      cat: 'buildings',
      name: 'Metropolis',
      body: '600 TP, 10 Builders, 10-wave build. +15 TP/round. Requires Imperial Metropolis research.',
    },
    {
      cat: 'buildings',
      name: 'Merchant Guild',
      body: '150 TP, 5 Builders. +1 TP/round per guild within settlement aura. Requires Merchant Charter research.',
    },
    {
      cat: 'buildings',
      name: 'Enemy Settlements',
      body: 'After wave 200, enemies raise hamlets and guilds in the north. Each completed enemy settlement adds +1 unit to their spawn count.',
    },

    {
      cat: 'orders',
      name: 'Fireball Barrage',
      body: '9 TP — AoE fire damage at clicked location.',
    },
    {
      cat: 'orders',
      name: 'Lightning Strike',
      body: '6 TP — focused storm damage in a smaller radius.',
    },
    { cat: 'orders', name: 'Healing Rain', body: '6 TP — heals allies in a large radius.' },
    {
      cat: 'orders',
      name: 'Reinforcements',
      body: '12 TP — spawns footmen + archer on the battlefield.',
    },
    {
      cat: 'orders',
      name: 'Battle Rally',
      body: '6 TP — morale and damage boost army-wide. Snaps demoralized troops back to the fight.',
    },
    {
      cat: 'orders',
      name: 'Morale & Routing',
      body: 'Troops witness fallen allies (line of sight) and lose morale. Too many casualties cause routing — enemies flee off-map; before wave 100 allies may desert; after wave 100 they give up fighting until rallied. The General auto-paths to demoralized soldiers for a wall-to-wall pep talk (global detection, melee delivery). While rallying, he hits harder and shrugs off blows.',
    },
    {
      cat: 'orders',
      name: 'Spy Network',
      body: 'One action per wave: steal TP, disrupt spawns, assassinate elites, scout, poison, sabotage siege.',
    },
    {
      cat: 'orders',
      name: 'Courier Messages',
      body: 'One per wave (two with Twin Dispatch): reinforcements, decree (+morale), tax levy (+TP), call banner (knight), supplies (heal all).',
    },

    {
      cat: 'stars',
      name: 'Bronze Stars',
      body: 'Combat troops earn bronze from kills. 3 bronze → 1 silver → 1 gold → TP promotion eligibility (Veteran Doctrine research required).',
    },
    {
      cat: 'stars',
      name: 'Specialist Ranks',
      body: 'Healers, Builders, and Couriers earn one star step per wave when they work (heal, build, dispatch).',
    },
    {
      cat: 'stars',
      name: 'Specialist Extra Abilities (3 gold stars)',
      body: 'At 3 gold stars specialists unlock passive masteries — Mass Mend, Rapid Repair, and Twin Dispatch (two messages per wave). The selected unit panel shows gold-star progress, lock/unlock state, and promote hints.',
    },
    {
      cat: 'stars',
      name: 'Gold & Honor Names',
      body: 'At 3 gold stars, the Crown grants a name (e.g. Syr Gwyn) and promotion eligibility. Research Veteran Doctrine, then spend TP to promote — core troops do not auto-scale with waves.',
    },
    {
      cat: 'stars',
      name: 'Immortal Mentors for Academies',
      body: 'Max-rank veterans (Immortal / Saint of the Realm) are not just powerful fighters — they are the only commanders the Crown recognizes as academy founders. Without an Immortal mentor of the matching type deployed on the field, the build button stays locked and the map will refuse placement. Hover any academy in the build panel for the exact mentor required.',
    },
    {
      cat: 'stars',
      name: 'Evolved Ally Scaling',
      body: 'Coliseum and evolved operatives scale with wave number automatically. Core footmen, archers, and knights stay viable longer through veteran promotions and field tenure — but after wave ~40, TP promotions under Veteran Doctrine are how you keep pace with evil operatives.',
    },
    {
      cat: 'stars',
      name: 'General Promotion',
      body: 'A 3-gold-star Footman can be promoted via General Academy — stats kept, stars reset for aura growth.',
    },

    {
      cat: 'eras',
      name: 'Kingdom Strength (Colony Value)',
      body: 'Your live kingdom score sums Army, Works, and Treasury ledgers. The STRENGTH HUD in the top bar (after WAVE) shows the current stage — Humble I, Rising II, Formidable III, Dominant IV, Empire V — your ratio vs baseline (1.00× at the gold tick), and a tooltip explaining threat level and next-wave host pressure. See the Kingdom Strength tab for full formulas. Above 1.00× swells the host; below eases assaults.',
    },
    {
      cat: 'eras',
      name: 'Wave Pressure from Kingdom Strength',
      body: "Each night, kingdom strength feeds the next wave's adaptive pressure — host size, siege weight, elite slots, and faction counters. Full breakdown in Kingdom Strength tab. Core enemy hpScale/dmgScale still comes from wave number; kingdom strength layers on top.",
    },
    {
      cat: 'eras',
      name: 'Tactical Points',
      body: 'TP is awarded each cleared wave (+8 base, scaling with wave & difficulty). Storage is uncapped. Settlements add bonus TP/round. Large TP stockpiles raise Treasury in kingdom strength and can slightly accelerate enemy spawn cadence.',
    },
    {
      cat: 'eras',
      name: 'Territory (Every 10 Waves)',
      body: 'Every 10 waves the map expands +90 wide and +110 deep, centered so new land appears on north, south, east, and west. More room to build, hunt, and defend every flank.',
    },
    {
      cat: 'eras',
      name: 'Multi-Front (Every 25 Waves)',
      body: 'New attack flank until all four sides assault: North → East (25) → West (50) → South (75). Each dawn rolls which unlocked flanks are active — glowing edge bands, marching chevrons, and the corner compass show assaulting sides; dim "quiet" badges mark flanks in the pool but resting this wave. THREAT HUD uses the same ▲▶◀▼ compass.',
    },
    {
      cat: 'eras',
      name: 'Academy Era (Wave 100)',
      body: 'Advanced academies unlock free training each round. TP deploy stays available at normal cost.',
    },
    {
      cat: 'eras',
      name: 'RTS Era (Wave 100+)',
      body: 'Enemy counts swell ~35%. The war becomes territory control — protect economy buildings and training halls.',
    },
    {
      cat: 'eras',
      name: 'Enemy RTS (Wave 200)',
      body: 'Map widens again. Enemies build hamlets and guilds that mirror your bonuses (+spawns). Siege everything.',
    },
    {
      cat: 'eras',
      name: 'Horde Waves (Every 5)',
      body: 'Waves 5, 15, 25… spawn faster swarms of goblins, rats, and orcs — slightly weaker individually but numerous. A pulsing red edge and intensity meter (Swarm → Heavy → Critical) telegraph how brutal the tide is; listen for the drum stomp as spawns accelerate. Every 15th horde (15, 45, 75…) embeds a siege tower and sappers. Waves 10, 20, 30… are named boss waves instead.',
    },
    {
      cat: 'eras',
      name: 'Day & Night Cycle',
      body: "Day brings enemy assaults — visibility is best at dawn and fades toward dusk as the wave wears on. Night is prep: no spawns, +35% builder speed, and time to reposition. Lantern Prophet's lantern punishes enemy sight — especially in low light.",
    },

    {
      cat: 'campaign',
      name: 'Campaign Victory — Northern Purge',
      body: 'Campaign and Academy Era runs end when all enemy northern holds (hamlets, guilds, academies) are razed after wave 40 — trade posts and quarries are outposts you can sack for tactical gain but they do not end the war alone. From wave 200 (Enemy RTS), every hostile economy site must fall for total purge victory. Survival, seed, timed, and challenge modes remain endless.',
    },
    {
      cat: 'campaign',
      name: 'Campaign Chronicle Beats',
      body: 'Major milestones trigger Chronicle messages: wave 10 (named warlords + enemy trade posts), wave 31 (Kingdom Rising), wave 100 (Empire Ascendant / Academy Era), wave 200 (Planetary Dominion — raids authorized). Your first named boss kill earns a special chronicle entry. Destroy all enemy northern holds to win.',
    },
    {
      cat: 'campaign',
      name: 'Kingdom Evolution (Player Growth)',
      body: 'Your force evolves in four stages shown in the Kingdom HUD: Stage 1 Outpost Realm (waves 1–30) — defensive line, basic troops, first veterans (+5% line HP). Stage 2 Kingdom Rising (31–99) — academies, settlements, evolved allies, +3% army damage. Stage 3 Empire Ascendant (100–199) — loadouts, fortress economy, colony value heavily steers wave pressure; wave 150+ unlocks Settlement Raid missions. Stage 4 Planetary Dominion (200+) — massive map, mirror settlements, Counter-Hold courier, +5% army / +10% siege.',
    },
    {
      cat: 'campaign',
      name: 'Settlement Raid Missions (Wave 150+)',
      body: 'After wave 150, enemy factions accelerate northern outposts and hamlets. The SETTLEMENT RAIDS panel lists active targets with TP and science rewards. Select 2+ hunters (archers, knights, sappers, etc.), then dispatch a strike force — they path north and siege the hold. Razing via strike force pays the full loot bonus (+10–32 TP, +1–4 science by tier); organic hunts pay a smaller scavenger cut. Spy Settlement Raid (wave 150+) still sabotages the weakest hold for 45% HP. Enemy counter-raids at Stage 4 kingdom tiers strike your hamlets — keep a home guard.',
    },
    {
      cat: 'campaign',
      name: 'Multi-Front Siege Warfare',
      body: 'From wave 12 with 2+ active hostile factions, the host runs coordinated or competing multi-front sieges. Each faction gets a doctrine: Siege Line (north — breaks your wall), Economy Raid (south — hits hamlets/guilds), Wide Flank (east/west), or Opportunist (competes anywhere). Coordinated waves split fronts — e.g. Orc sieges North while Goblins raid South. Competing waves may stack multiple factions on one flank. Spawns follow faction doctrine; Stage 4 counter-raids use the same fronts (north siege vs south economy raid). INTEL HUD shows the plan; THREAT compass highlights multi-front waves.',
    },
    {
      cat: 'campaign',
      name: 'Asymmetric Warfare',
      body: 'Opposing roles: YOU are the Kingdom Commander — macro (night builds, hamlets, academies, research, TP) plus micro (HUNT, rally, doctrines, spy/courier). The HOST is an Evolving Threat — auto-spawns, faction kingdoms, levels up (Threat Lv 1–25+), and pressures the whole map. COMMAND HUD shows macro authority vs micro orders; HOST HUD shows threat level; the Kingdom bar compares blue (you) vs red (host). High Commander Authority grants longer nights, faster builders, and bonus TP. High Host Threat adds spawns, faster assaults, multi-flank bias, and elite injections. Raze northern holds to push threat level down.',
    },
    {
      cat: 'campaign',
      name: 'Player Counter-Evolution (Wave 15+)',
      body: 'Strike the host before it fully evolves. COUNTER-OFFENSIVE doctrines (left panel, separate from kingdom doctrines) spend TP to debuff the weakest active faction — reduced effective stage, fewer spawns, skipped northern builds, and host threat reduction on higher tiers. One offensive doctrine per wave. From wave 25, night EXPEDITIONS (right panel) send 1–4 hunters off-map against a chosen faction; they return next wave with survivors and apply a heavier debuff. Weakened factions show in the HOST HUD tooltip. Probing Raid (wave 15) → Border Sortie (35) → Northern Campaign (60) → Dominion Offensive (120), each gated by kingdom evolution stage.',
    },
    {
      cat: 'campaign',
      name: 'Living Planet (Map Biomes)',
      body: 'Territory expansion reveals a living world — biomes unlock as Land tiers grow (every 10 waves). Plains (home rally) grant +5% march speed. Forest Reaches (Land II+) add +14% cover but −12% speed in expanded north/side bands. Mountain Frontier (Land V+) grants −22% damage taken but −26% speed on high ground. Corrupted Border (Land VIII+ / hostile creep after wave 200) punishes defenders (+10% damage taken, enemies hit harder). Wave 1001+ bleeds the Corrupted Hellscape across the northern realm. REALM HUD lists active biomes; the minimap tints regions. Position troops deliberately — mountains anchor defensive lines, forests ambush, plains rush reinforcements.',
    },
    {
      cat: 'campaign',
      name: 'Faction Environmental Hazards',
      body: 'From Land II onward, the battlefield fills with scaling faction hazards tied to active host realms. Goblin Plague Zones (green) slow troops, drain morale, and chip HP — goblins and plague rats are immune. Orc Fire Pits (ember rings) burn player units; orcs ignore the flames. Void Corruption (purple) wounds all non-void units and spreads each wave — radius grows during combat and may seed satellite blights in the north. Hazard count, radius, and damage scale with faction evolution stage, territory tier, and wave. INTEL HUD lists active zones when no spy report is showing. Route armies around hazards, or cast Arcane Dispel (Spells, 5 TP — requires a living Mage in cast range) to purge void, burn, plague, and other blight zones. Void creep also slows when you drive the host back.',
    },
    {
      cat: 'campaign',
      name: 'Neutral Wildlife & Environmental Events',
      body: 'From wave 8, neutral beasts roam the wilds (amber rings on the minimap). They attack whichever army is closest — player or host — and do not count toward wave clear. Slay them for TP and morale: Wild Boar (+2 TP), Harpy Flock (+3), Brush Stalker (+3), Awakened Treant (+5). Events: Beast Migration (wave 12+), Predator Circle (harpy waves), Ancient Grove (treant), Carrion Feed (after heavy casualties), Den Disturbed (combat near wild dens). Stats scale with wave and territory tier. Both sides can hunt neutrals — race the host to the kill or lure beasts into enemy lines.',
    },
    {
      cat: 'campaign',
      name: 'Dynamic Map Events — Planet Fights Back',
      body: 'From wave 12, the living world strikes on a cadence — volcanic eruptions, awakening ruins, geothermal surges, mana storms, and titan quakes. Each event site appears on the battlefield (pulsing marker). During night prep, the PLANET EVENT panel offers three responses (some cost TP): harness power for rewards, evacuate or seal for safety, or hold ground and weather the worst. Your choice applies at dawn — fewer enemy spawns, wall protection, mage damage, builder speed, eruption pulses, ruin guardians, or wild stalkers. PLANET HUD and INTEL show the active threat. Ignoring events is free but punishing. Events scale with wave; geothermal returns on long cycles after wave 20.',
    },
    {
      cat: 'campaign',
      name: 'Faction Reputation & Hostility',
      body: "From wave 6 each hostile realm tracks how aggressively you fight it. Kills, razing northern holds, counter-offensives, expeditions, settlement raids, and harsh spy work raise hostility — Cordial → Wary → Hostile → Vengeful → Blood Feud. High hostility pulls evolution forward (stronger tiers spawn earlier), thickens spawn weights, injects more sub-bosses, and keeps counter-raids likely. Low hostility from restraint or Courier Truce (−18 for the angriest faction, −8 for others) slows military evolution and shifts pressure toward economic probes — extra trade posts and quarries in the north, lighter spawns, fewer counter-raids. Quiet waves without fighting a faction ease hostility −2. HOST HUD tooltip lists each realm's stance and evolution offset. Truces last 1–2 waves and dampen hostility gains.",
    },
    {
      cat: 'campaign',
      name: 'Crown Legacies (Multi-Run)',
      body: 'Past campaigns unlock permanent perks on the main menu — up to 3 active before each run. Milestones: win a run (Crowned Command +4 TP), 3 honor names (Honor Bloodline), wave 50 (Siege Memory walls), 400 kills (Northern Grudge damage), 25 waves cleared (Realm Mason builders), wave 30 (Veteran Line HP), 50 kills on favorite unit (Favorite Champion), evolved ally service (Evolved Echo morale), wave 100 (Deep Survivor mitigation), 8 honors (Blood Crown +1 heir slot). HONOR HEIRS: select up to 2 named veterans from your lifetime honor roll — they spawn at dawn with their title, +1 bronze star, +5% HP, and +4 morale. Legacies persist in local storage; Creative Mode ignores them.',
    },
    {
      cat: 'campaign',
      name: 'Kingdom Evolution Meter',
      body: 'The banner beside the Kingdom label grows as you fill the evolution meter (0–100% within each stage). The meter blends four signals: Colony Value (35%) — kingdom strength vs wave baseline; Buildings (25%) — completed player structures; Veterans (25%) — stars, ranks, and honor names on the field; Research (15%) — completed research projects. Pennant → Crest → Empire Banner → Hell-Forged Banner as stages advance.',
    },
    {
      cat: 'orders',
      name: 'Kingdom Doctrines',
      body: 'One kingdom doctrine per wave from the left panel (unlocks with evolution stage): Stage 1 Outpost Stand (4 TP) — 15% damage reduction 6 min. Stage 2 Royal Muster (5 TP) — +5 TP and +4 morale all allies. Stage 3 Imperial March (8 TP) — map-wide rally: +12 morale, clears routing, +15% damage 7 min. Stage 4 Hellforge Decree (10 TP) — map-wide +10 morale, +20% damage, +12% speed 6 min.',
    },
    {
      cat: 'stars',
      name: 'Field Tenure (All Troops)',
      body: 'Units track spawn wave — each dawn survived adds tenure. Evolved operatives gain dual HP/DMG tenure bars (caps ×2.15 HP / ×1.75 DMG). Core troops show combat % vs wave and a combat-pace offset bar. Select any unit to read tenure in the unit info panel.',
    },
    {
      cat: 'stars',
      name: 'Selected Unit Panel',
      body: 'Click a living ally to open the unit info panel: HP/morale bars, veteran stars, tenure scaling, specialist rank progress, late-ability status (locked or ACTIVE), perks, obsolete hints, and quick actions (Hunt, Focus, Promote). Multi-select shows a compact chip summary.',
    },
  ];

  function buildWweEntries() {
    const unlocked = typeof MetaProgress !== 'undefined' && MetaProgress.isWweUnlocked();
    const entries = [
      {
        cat: 'wwe',
        tease: !unlocked,
        name: unlocked ? 'Grand Coliseum' : '??? Grand Coliseum',
        body: unlocked
          ? `Secret roster unlocked. Build the Academy: ${WWE_ACADEMY_COST} TP, ${WWE_ACADEMY_BUILDERS} Builders (${WWE_ACADEMY_RECOMMENDED_HAMLETS}+ hamlets & ${WWE_ACADEMY_RECOMMENDED_GUILDS}+ guilds recommended). Click the completed academy to recruit Champions.`
          : 'Scribes whisper of a grand arena beyond the Iron Creed — or win a campaign while showmanship champions headline your army for most waves. Attitude, charisma, entertainment. Build costs are staggering: a thousand TP, ten builders. Until then, these names are only rumors...',
      },
    ];

    if (typeof WweDefs === 'undefined') return entries;

    for (const [id, def] of Object.entries(WweDefs)) {
      entries.push({
        cat: 'wwe',
        tease: !unlocked,
        name: unlocked ? def.name : `${def.name} (Rumor)`,
        body: unlocked
          ? `${def.abilityDesc} · Cost: ${def.cost} TP · HP ${def.hp} · DMG ${def.damage} · ACC ${def.accuracy} · SPD ${def.speed}`
          : COLISEUM_TEASE[id] ||
            `Travelers mention ${def.name}, but no living commander has signed them yet.`,
      });
    }
    return entries;
  }

  function buildDoomslayerEntries() {
    const unlocked = typeof MetaProgress !== 'undefined' && MetaProgress.isDoomslayerHeroUnlocked();
    const def = typeof UnitDefs !== 'undefined' ? UnitDefs.doomslayer_hero : null;

    return [
      {
        cat: 'doomslayer',
        tease: !unlocked,
        name: unlocked ? 'The Hellbane' : '??? The Hellbane',
        body:
          unlocked && def
            ? `Deploy for ${def.cost} TP. HP ${def.hp} · near-unkillable damage reduction. Heals half his missing health every 2 waves. Auto-abilities: Rend & Ruin cleave when swarmed, Guardian heal when allies are pressed, mass cleave when hordes gather. His blade one-shots most foes — except in Hellscape.`
            : "A figure in green armor, spoken of only after a commander survives wave 200 on Hellbane difficulty. Cost: ten thousand TP. They say he heals from the abyss, ripostes entire hordes alone, and carries a sword that ends wars in one swing. Unlock him — or don't — and find out if the legends lie.",
      },
      {
        cat: 'doomslayer',
        tease: true,
        name: 'Rend & Ruin',
        body: unlocked
          ? 'When four or more enemies close on the Hellbane, he unleashes Rend & Ruin — AoE devastation. Cooldown applies.'
          : '??? When the Slayer is surrounded, witnesses report... something. The reports stop mid-sentence.',
      },
      {
        cat: 'doomslayer',
        tease: true,
        name: 'Guardian Protocol',
        body: unlocked
          ? 'When three or more enemies threaten allies, the Hellbane heals the army and grants a brief rally.'
          : '??? Allies near him supposedly fight harder when the line breaks. No field manual confirms this.',
      },
      {
        cat: 'doomslayer',
        tease: true,
        name: 'Hellscape (Wave 1001+)',
        body: "Beyond wave 1000, reality thins. Even the Hellbane's legendary blade falters against hellscape-level threats — damage returns to mortal scale. Survive that far and you have seen the true endgame.",
      },
      {
        cat: 'doomslayer',
        tease: !unlocked,
        name: unlocked ? 'How to Unlock' : '??? How to Unlock',
        body: unlocked
          ? 'Reach wave 200 on Hellbane difficulty in a single run — or discover another way in. The realm remembers how you unlocked him.'
          : "Survive to wave 200 on the hardest named difficulty. Some say forbidden words exist somewhere outside the Crown's official records. The field manual does not say where.",
      },
    ];
  }

  const CROSSOVER_CAT = {
    ultimis: 'crossover_ultimis',
    primis: 'crossover_primis',
    halo: 'crossover_halo',
    gears: 'crossover_gears',
    lotr: 'crossover_lotr',
    baki: 'crossover_baki',
    jojo: 'crossover_jojo',
    fotns: 'crossover_fotns',
    dragonball: 'crossover_dragonball',
    imperium: 'crossover_imperium',
    crystal: 'crossover_crystal',
    warp: 'crossover_warp',
    tes: 'crossover_tes',
  };

  const CROSSOVER_FACTION_ORDER = [
    'ultimis',
    'primis',
    'halo',
    'gears',
    'lotr',
    'baki',
    'jojo',
    'fotns',
    'dragonball',
    'imperium',
    'crystal',
    'warp',
    'tes',
  ];

  function crossoverFactionUnlocked(factionId) {
    if (typeof MetaProgress === 'undefined') return false;
    const checks = {
      ultimis: () => MetaProgress.is115Unlocked(),
      primis: () => MetaProgress.isPrimusUnlocked(),
      halo: () => MetaProgress.isHaloUnlocked(),
      gears: () => MetaProgress.isGearsUnlocked(),
      lotr: () => MetaProgress.isLotrUnlocked(),
      baki: () => MetaProgress.isBakiUnlocked(),
      jojo: () => MetaProgress.isJojoUnlocked(),
      fotns: () => MetaProgress.isFotnsUnlocked(),
      dragonball: () => MetaProgress.isDragonballUnlocked(),
      imperium: () => MetaProgress.isImperiumUnlocked(),
      crystal: () => MetaProgress.isCrystalUnlocked(),
      warp: () => MetaProgress.isWarpUnlocked(),
      tes: () => MetaProgress.isTesUnlocked(),
    };
    return checks[factionId]?.() ?? false;
  }

  function defaultHeroTip(def) {
    if (def.type === 'cavalry' || def.jojoPart === 7)
      return 'Cavalry — use hunt mode on wide maps after territory expands.';
    if (def.combatTag === 'ranged') return 'Backline DPS — garrison outposts for extended range.';
    if (def.combatTag === 'support')
      return 'Support — keep near your core army for auras and procs.';
    return 'Melee — screen with walls and pair with healers or med tent retreats.';
  }

  function formatCrossoverStats(def) {
    const role = `${def.combatTag} ${def.type}`;
    const part =
      def.jojoPart === 7
        ? ' · Gilded Derby cavalry'
        : def.jojoPart
          ? ` · Bound Spirit Cohort ${def.jojoPart}`
          : '';
    return `${role}${part} · ${def.cost} TP · HP ${def.hp} · DMG ${def.damage} · ACC ${def.accuracy} · SPD ${def.speed}`;
  }

  function buildCrossoverHeroBody(id, def, unlocked) {
    // Lore reads from the unit's own data so a rename never leaves a stale entry behind.
    const profile = (typeof GameDataBundle !== 'undefined' && GameDataBundle.rosterProfiles) || {};
    const prof = profile.operatives?.[id] || profile.champions?.[id];
    const tease = def.description
      ? `${def.title ? `${def.title}: ` : ''}${def.description}`
      : `Travelers whisper of ${def.name}, but no signed contract exists in the Crown's ledgers.`;
    if (!unlocked) return tease;
    const flavor =
      `${def.name}${def.title ? `, ${def.title}` : ''}. ${def.description || ''}`.trim();
    const tip = prof?.weak ? `${prof.role}. Weakness: ${prof.weak}` : defaultHeroTip(def);
    return `${flavor}\n\n${def.abilityDesc}\n\n${formatCrossoverStats(def)}\n\nTip: ${tip}`;
  }

  function buildCrossoverFactionIntro(factionId) {
    const cat = CROSSOVER_CAT[factionId];
    const faction = typeof CrossoverFactions !== 'undefined' ? CrossoverFactions[factionId] : null;
    const prof = typeof FactionDepth !== 'undefined' ? FactionDepth.PROFILES?.[factionId] : null;
    const buildingKey = faction?.building;
    const bdef = buildingKey && typeof BuildDefs !== 'undefined' ? BuildDefs[buildingKey] : null;
    const unlocked = crossoverFactionUnlocked(factionId);
    const label = faction?.label || prof?.label || factionId;

    if (!unlocked) {
      const ultimisTrial =
        factionId === 'ultimis'
          ? ' Survive to wave 150 on Hellbane without losing a single building to the endless horde — or discover another way in.'
          : '';
      const primisTrial =
        factionId === 'primis'
          ? ' Win a campaign with a castle compound and never let an enemy breach the inner keep — timeline integrity must hold — or discover another way in.'
          : '';
      const haloTrial =
        factionId === 'halo'
          ? ' Win a campaign without losing your General — promote five Footmen to command and crown one as General — or discover another way in.'
          : '';
      const gearsTrial =
        factionId === 'gears'
          ? ' Win a campaign after razing twelve enemy structures — hamlets, guilds, outposts, and academies — grind them down with siege focus — or discover another way in.'
          : '';
      const lotrTrial =
        factionId === 'lotr'
          ? ' Win a campaign while your entire fighting force holds high morale for most waves — hope against overwhelming darkness — or discover another way in.'
          : '';
      const bakiTrial =
        factionId === 'baki'
          ? ' Win on Chad difficulty or higher with a primarily melee army for most waves — pure martial arts dominance, one-on-one spirit — or discover another way in.'
          : '';
      const jojoTrial =
        factionId === 'jojo'
          ? ' Win a campaign after recruiting three evolved heroes and keeping them on the field together for most waves — teamwork, bound spirits and alliances — or discover another way in.'
          : '';
      const fotnsTrial =
        factionId === 'fotns'
          ? ' Win a campaign after a lone hero — and only that hero — lands the killing blow on a named warlord. One-man-army legend: Your fate was sealed before the strike — or discover another way in.'
          : '';
      const dragonballTrial =
        factionId === 'dragonball'
          ? ' Reach wave 200+, defeat the planetary threat boss, and field a skyburst army when the warlord falls — protecting the planet — or discover another way in.'
          : '';
      const warhammerTrial =
        factionId === 'imperium' || factionId === 'warp'
          ? ' Win on Chad difficulty or higher while maintaining eight active fortifications at all times — castles, walls, outposts, or upgraded hamlets — repel three named boss waves, and never lose your General. The Eternal March — hold the line against impossible odds — or discover another way in.'
          : '';
      const tesTrial =
        factionId === 'tes'
          ? ' Win after wave 100+ with one Immortal veteran from each Eternal Path — Martial, Arcane, Tech, and Mythic — and defeat a major boss using a voice shout strike or wyrmcaller-style hero ability. Wyrmcaller Legacy — heroic destiny across every school of power — or discover another way in.'
          : '';
      return {
        cat,
        tease: true,
        name: `${label} (Classified)`,
        body: prof?.lore
          ? `${prof.lore}${ultimisTrial}${primisTrial}${haloTrial}${gearsTrial}${lotrTrial}${bakiTrial}${jojoTrial}${fotnsTrial}${dragonballTrial}${warhammerTrial}${tesTrial} Build the faction barracks, discover the unlock code, then recruit from Legion Archive. The Crown has redacted roster details until you sign them.`
          : `Classified operatives from another world.${ultimisTrial}${primisTrial}${haloTrial}${gearsTrial}${lotrTrial}${bakiTrial}${jojoTrial}${fotnsTrial}${dragonballTrial}${warhammerTrial}${tesTrial} Unlock their roster, build their barracks on the field, then recruit via Legion Archive.`,
      };
    }

    const buildLine = bdef
      ? `Build ${bdef.name} (${bdef.cost} TP, ${bdef.requiresBuilders || 3} Builders) on the battlefield, then open Legion Archive to recruit.`
      : 'Build the faction barracks on the field, then recruit from Legion Archive.';
    const play = prof?.playstyle ? `Playstyle: ${prof.playstyle}` : '';
    const weak = prof?.weakness ? `Weakness: ${prof.weakness}` : '';
    return {
      cat,
      name: `${label} Roster`,
      body: [
        prof?.lore || `${label} operatives ready for deployment.`,
        prof?.identity || '',
        buildLine,
        play,
        weak,
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  }

  function buildCrossoverEntries() {
    const entries = [
      {
        cat: 'crossover_meta',
        name: 'Legion Archive',
        body: 'Warriors from other worlds sign on through Legion Archive — your evolved allies. See Evolved Allies — Design Philosophy in this tab for early spikes, late-game armies, and Northern war operatives. Each faction needs its barracks completed before recruits deploy.',
      },
      {
        cat: 'crossover_meta',
        name: 'How to Recruit',
        body: "1) Unlock the faction roster. 2) Build that faction's barracks with your Builder. 3) Open Legion Archive from the HUD. 4) Pay TP to deploy operatives onto the rally line. Signed operatives appear in your Legacy roll. Tonic Stations machines unlock after any secret roster (Coliseum, Hellbane, or evolved allies) is active.",
      },
    ];

    if (typeof CrossoverDefs === 'undefined') return entries;

    for (const factionId of CROSSOVER_FACTION_ORDER) {
      entries.push(buildCrossoverFactionIntro(factionId));
      const cat = CROSSOVER_CAT[factionId];
      const factionUnlocked = crossoverFactionUnlocked(factionId);
      for (const [id, def] of Object.entries(CrossoverDefs)) {
        if (def.faction !== factionId) continue;
        entries.push({
          cat,
          tease: !factionUnlocked,
          name: factionUnlocked ? def.name : `${def.name} (Classified)`,
          body: buildCrossoverHeroBody(id, def, factionUnlocked),
        });
      }
    }
    return entries;
  }

  function buildPerkEntries() {
    return [
      {
        cat: 'perks',
        name: 'Tonic Stations System',
        body: 'Build machines after unlocking a secret roster (Coliseum, Hellbane, or evolved heroes). Eligible units collect perks during night prep — up to 4 perks based on stars earned. Each perk favors melee, ranged, or support tags.',
      },
      { cat: 'perks', name: 'Ironbrew', body: 'Melee & support — +35% max HP.' },
      {
        cat: 'perks',
        name: 'Field Revival',
        body: 'Support — self-revive once per wave at 40% HP.',
      },
      { cat: 'perks', name: 'Swiftstep Tonic', body: 'Melee & ranged — faster attacks.' },
      { cat: 'perks', name: 'Endurance Draft', body: 'Melee & ranged — faster movement.' },
      { cat: 'perks', name: 'Deadeye Elixir', body: 'Ranged only — +22 accuracy.' },
      { cat: 'perks', name: 'Storm Fizz', body: 'Ranged & melee — splash damage on hits.' },
      { cat: 'perks', name: 'Impact Ward', body: 'Melee only — explosion immunity.' },
      { cat: 'perks', name: 'Brawler’s Brew', body: 'Melee only — +28% melee damage.' },
      {
        cat: 'perks',
        name: 'Scavenger’s Tonic',
        body: 'Ranged & support — kills may grant +1 TP.',
      },
      {
        cat: 'perks',
        name: 'Last Stand Monument',
        body: 'General only — each night resurrects fallen troops equal to total bronze-star count (3 gold stars = 27 resurrections per wave).',
      },
    ];
  }

  function buildResearchEntries() {
    if (typeof Research !== 'undefined' && Research.getEncyclopediaEntries) {
      return Research.getEncyclopediaEntries();
    }
    return [
      {
        cat: 'research',
        name: 'Research Lab',
        body: 'Build a Research Lab (18 TP, 1 Builder) to earn Science Points: +6 SP per lab at every dawn (first two labs), plus analysis of slain foes up to a per-wave cap (extra labs raise it). Iron Weapons costs 20 SP, so knights, sappers and crossbowmen arrive two or three waves after the lab stands. Open the Research tab in the encyclopedia after the game loads for all nodes, costs, prerequisites, and unlocks.',
      },
    ];
  }

  function buildLoadoutEntries() {
    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.getLoadoutEncyclopediaEntries) {
      return ContentExpansion.getLoadoutEncyclopediaEntries();
    }
    return [
      {
        cat: 'loadouts',
        name: 'Army Loadouts',
        body: 'Kingdom loadouts unlock at wave 100+. Open the Loadouts tab after the game loads for full bonus tables and strategy notes.',
      },
    ];
  }

  /** One page per troop, archetype and enemy: its job, its trait and how to beat it. */
  function buildRoleEntries() {
    if (typeof Roster === 'undefined') return [];
    const page = (name, p, weakLabel) => ({
      cat: 'roles',
      name: `${name} — ${p.role}`,
      body: `${p.trait}\n\n${weakLabel}: ${p.weak}`,
    });
    const out = [
      {
        cat: 'roles',
        name: 'How roles work',
        body: 'Every soldier and every enemy has one job, one signature trait and one weakness. Pikes beat riders, cavalry beats archers and casters, arrows are weak against armour, and any blow from behind lands 25% harder. Champions and operatives each have their own role, trait and weakness, listed here by faction after the troops. Select a soldier to see his role in the unit panel.',
      },
    ];
    for (const [type, p] of Object.entries(Roster.TROOPS)) {
      const def = typeof UnitDefs !== 'undefined' ? UnitDefs[type] : null;
      out.push(page(def?.name || type, p, 'Weakness'));
    }
    // Champions and operatives each have their own profile, listed faction by faction.
    const profiles = Roster.PROFILES || {};
    const group = (label, defs, keep) => {
      const members = Object.entries(defs).filter(([id, def]) => profiles[id] && keep(def));
      if (!members.length) return;
      out.push({
        cat: 'roles',
        name: `${label} — ${members.length} profiles`,
        body: members.map(([id, def]) => `${def.name} — ${profiles[id].role}`).join('\n'),
      });
      for (const [id, def] of members) {
        const p = profiles[id];
        out.push({
          cat: 'roles',
          name: `${def.name} — ${p.role}`,
          body: `${label}\n\n${p.trait}\n\nWeakness: ${p.weak}`,
        });
      }
    };
    if (typeof WweDefs !== 'undefined') group('Grand Coliseum champions', WweDefs, () => true);
    if (typeof CrossoverDefs !== 'undefined') {
      const factions =
        typeof CROSSOVER_FACTION_ORDER !== 'undefined'
          ? CROSSOVER_FACTION_ORDER
          : [...new Set(Object.values(CrossoverDefs).map((d) => d.faction))];
      for (const fid of factions) {
        const label =
          (typeof CrossoverFactions !== 'undefined' && CrossoverFactions[fid]?.label) || fid;
        group(label, CrossoverDefs, (def) => def.faction === fid);
      }
    }
    for (const [type, p] of Object.entries(Roster.ENEMIES)) {
      const def = typeof EnemyDefs !== 'undefined' ? EnemyDefs[type] : null;
      out.push(page(def?.bossName || def?.name || type, p, 'How to beat it'));
    }
    return out;
  }

  function buildNamedBossEntries() {
    if (typeof MonsterBosses !== 'undefined' && MonsterBosses.getEncyclopediaEntries) {
      return MonsterBosses.getEncyclopediaEntries();
    }
    return [
      {
        cat: 'bosses',
        name: 'Named Bosses',
        body: 'Every 10th wave fields a named warlord with Monster Evolution tiers (Prime → Returned → Ascendant → Eternal). Open the Bosses tab after the game loads for full lore, packs, and counters.',
      },
    ];
  }

  function buildColonyValueEntries() {
    if (typeof ColonyValue !== 'undefined' && ColonyValue.getEncyclopediaEntries) {
      return ColonyValue.getEncyclopediaEntries();
    }
    return [
      {
        cat: 'colony',
        name: 'Kingdom Strength & Enemy Adaptation',
        body: "Your kingdom's strength directly shapes the enemy's aggression and composition. Open the Kingdom Strength tab after the game loads for full ledger formulas, threat tiers, composition counters, and elite injection rules.",
      },
    ];
  }

  function buildCreativeEntries() {
    return [
      {
        cat: 'creative',
        name: 'Creative Lab',
        body: 'Sandbox mode from the main menu. Press P in-game for the lab panel. Achievements are disabled by default; sandbox stats track separately in local storage. Toggle "campaign rules" to practice with real TP costs and miss limits.',
      },
      {
        cat: 'creative',
        name: 'Wave Composer',
        body: 'Type enemy lists like goblin*10, orc*5, war_chief*1 then Queue and Launch. Custom intervals control spawn pacing for balance tests.',
      },
      {
        cat: 'creative',
        name: 'Scenario Templates',
        body: 'Pre-built drills: Siege Drill, Boss Rush, Horde Stress, Wall Defense, Academy Era, and more. Load a template to populate allies, buildings, and custom waves instantly.',
      },
      {
        cat: 'creative',
        name: 'Stress & Perf',
        body: 'Start Horde spawns enemies from map edges until a cap — pair with F3 perf overlay to profile FPS, pathfinding, and heap usage.',
      },
      {
        cat: 'creative',
        name: 'Export / Import',
        body: 'Export scenarios or session replays as JSON. Paste into the import box to share setups with other designers or restore a snapshot.',
      },
    ];
  }

  function getAllEntries() {
    const loreExpanded =
      typeof LoreData !== 'undefined' ? LoreData.getExpandedEntries() : [...BASE_ENTRIES];
    const factionLore =
      typeof FactionDepth !== 'undefined' ? FactionDepth.getEncyclopediaEntries() : [];
    const chronicles = typeof Chronicles !== 'undefined' ? Chronicles.getEncyclopediaEntries() : [];
    const story = typeof StoryLore !== 'undefined' ? StoryLore.getEncyclopediaEntries() : [];
    const legacy = typeof Legacy !== 'undefined' ? Legacy.getLegacyEntries() : [];
    const journey = [];
    return [
      ...journey,
      ...loreExpanded,
      ...factionLore,
      ...buildResearchEntries(),
      ...buildLoadoutEntries(),
      ...buildNamedBossEntries(),
      ...buildRoleEntries(),
      ...buildColonyValueEntries(),
      ...buildWweEntries(),
      ...buildDoomslayerEntries(),
      ...buildCrossoverEntries(),
      ...buildPerkEntries(),
      ...story,
      ...chronicles,
      ...legacy,
      ...(typeof CrownLegacies !== 'undefined' ? CrownLegacies.getLegacyEntries() : []),
      ...(typeof EternalLegacyTree !== 'undefined' ? EternalLegacyTree.getLegacyEntries() : []),
      ...(typeof FoundationalMedievalLayer !== 'undefined'
        ? FoundationalMedievalLayer.getLegacyEntries()
        : []),
      ...buildCreativeEntries(),
    ];
  }

  function renderEntryBody(e) {
    const bodyHtml = (e.body || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    const parts = [`<div class="ency-entry-body">${bodyHtml}</div>`];
    if (e.bestiaryWeak) {
      parts.push(`<div class="ency-bestiary-tags">
        <span class="ency-btag threat">${e.bestiaryThreat || 'Threat'}</span>
        <span class="ency-btag weak">Weak: ${e.bestiaryWeak}</span>
        <span class="ency-btag counter">Counter: ${e.bestiaryCounter}</span>
      </div>`);
    }
    if (e.classified && typeof LoreData !== 'undefined') {
      const unlocked = LoreData.checkUnlock(e.classifiedRule);
      if (unlocked) {
        parts.push(
          `<div class="ency-classified"><span class="ency-classified-label">CLASSIFIED</span>${e.classified}</div>`
        );
      } else {
        const hint = LoreData.getUnlockHint(e.classifiedRule);
        parts.push(`<div class="ency-classified-locked">
          <span class="ency-classified-label">CLASSIFIED</span>
          <span class="ency-redacted">${'█'.repeat(36)}</span>
          <span class="ency-unlock-hint">Unlock: ${hint}</span>
        </div>`);
      }
    }
    if (e.chronicleMeta) {
      const ctype =
        e.chronicleType === 'run'
          ? 'Campaign'
          : e.chronicleType === 'choice'
            ? 'Choice'
            : e.chronicleType === 'narrative'
              ? 'Narrative'
              : 'Wave';
      parts.push(`<div class="ency-chronicle-meta">${ctype} · ${e.chronicleMeta}</div>`);
    }
    if (e.storyMeta) {
      parts.push(`<div class="ency-chronicle-meta">Story Arc · ${e.storyMeta}</div>`);
    }
    if (e.storyBranch && typeof StoryLore !== 'undefined') {
      const br = StoryLore.BRANCHES?.[e.storyBranch];
      if (br) {
        parts.push(
          `<div class="ency-story-branch" style="color:${br.color}">Path: ${br.label}</div>`
        );
      }
    }
    if (e.campaignWave) {
      parts.push(`<div class="ency-campaign-wave">Milestone · Wave ${e.campaignWave}</div>`);
    }
    if (e.tease) {
      parts.push('<div class="ency-tease-tag">CLASSIFIED</div>');
    }
    return parts.join('');
  }

  let activeCat = 'allies';
  let searchQuery = '';

  function renderPanel() {
    const tabs = document.getElementById('encyclopedia-tabs');
    const list = document.getElementById('encyclopedia-list');
    if (!tabs || !list) return;

    tabs.innerHTML = CATEGORIES.map(
      (c) => `
      <button class="ency-tab ${c.id === activeCat ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>
    `
    ).join('');

    tabs.querySelectorAll('.ency-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        AudioEngine?.SFX?.click?.();
        activeCat = btn.dataset.cat;
        renderPanel();
      });
    });

    const entries = getAllEntries();
    const q = searchQuery.trim().toLowerCase();
    let filtered = entries.filter((e) => e.cat === activeCat);
    if (q) {
      filtered = entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          e.cat.toLowerCase().includes(q)
      );
    }
    list.innerHTML = filtered.length
      ? filtered
          .map(
            (e) => `
      <div class="ency-entry ${e.tease ? 'ency-tease' : ''} ${e.cat === 'bestiary' ? 'ency-bestiary' : ''}">
        <div class="ency-entry-name">${e.name}</div>
        ${renderEntryBody(e)}
      </div>
    `
          )
          .join('')
      : '<p class="ency-empty">No entries in this category.</p>';
  }

  function refreshData() {
    if (typeof MetaProgress !== 'undefined') MetaProgress.load();
    if (typeof Legacy !== 'undefined') Legacy.load();
    if (typeof Chronicles !== 'undefined') Chronicles.load();
    if (typeof StoryLore !== 'undefined') StoryLore.load();
    renderPanel();
  }

  function open(opts = {}) {
    const panel = document.getElementById('encyclopedia-screen');
    if (!panel) return;
    returnToPause = !!opts.fromPause;
    if (opts.fromPause && typeof UX !== 'undefined') UX.suppressPauseForOverlay();
    if (Game.isPlaying?.() && !Game.getState().paused) {
      Game.setPaused?.(true);
      returnToPause = true;
    }
    panelOpen = true;
    panel.classList.add('active');
    refreshData();
    AudioEngine?.SFX?.click?.();
  }

  function close() {
    const panel = document.getElementById('encyclopedia-screen');
    if (!panel) return;
    panelOpen = false;
    panel.classList.remove('active');
    AudioEngine?.SFX?.click?.();
    if (returnToPause && Game.isPlaying?.() && Game.getState().paused) {
      returnToPause = false;
      if (typeof UX !== 'undefined') UX.openPauseMenu();
    } else {
      returnToPause = false;
    }
  }

  function isOpen() {
    return panelOpen;
  }

  function togglePanel() {
    if (panelOpen) close();
    else open();
  }

  function init() {
    document.getElementById('encyclopedia-btn')?.addEventListener('click', () => togglePanel());
    document.getElementById('menu-encyclopedia-btn')?.addEventListener('click', () => open());
    document
      .getElementById('pause-encyclopedia-btn')
      ?.addEventListener('click', () => open({ fromPause: true }));
    document.getElementById('encyclopedia-close')?.addEventListener('click', () => close());
    document.getElementById('encyclopedia-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPanel();
    });
  }

  return { init, open, close, isOpen, togglePanel, renderPanel, buildRoleEntries };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Encyclopedia = Encyclopedia;
