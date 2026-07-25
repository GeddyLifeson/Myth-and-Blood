/**
 * Myth and Blood — encyclopedia (main menu, pause menu, in-game HUD).
 */
const Encyclopedia = (() => {
  let panelOpen = false;
  let returnToPause = false;
    const COLISEUM_TEASE = {
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
  };

  const CATEGORIES = [
    { id: 'allies', label: 'Allies' },
    { id: 'enemies', label: 'Enemies' },
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
    { id: 'doomslayer', label: 'Doomslayer' },
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
      body: 'Demolishes walls and siege engines with bonus siege damage.',
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
      body: 'Blocks movement. 2 footman slots per wall when General commands Keep. Siege priority.',
    },
    {
      cat: 'buildings',
      name: 'Castle Compound',
      body: 'Large footprint: 4 walls, 4 outposts, Keep, med tent, mess hall. Center of command.',
    },
    {
      cat: 'buildings',
      name: 'Medical Tent',
      body: 'Wounded allies at ≤25% HP retreat to the globally nearest med tent. Healers flee here on any damage until safe. Units heal while garrisoned and rejoin the fight once restored.',
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
      body: '14 TP, 2 Builders. +1 TP/round (counts toward 6-site cap with trade posts). Early economy — hamlets outscale it after wave 100.',
    },
    {
      cat: 'buildings',
      name: 'Trade Outpost',
      body: '16 TP, 2 Builders. +1 TP/round and morale aura. Same 6-site cap as quarries.',
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
      body: "Day brings enemy assaults — visibility is best at dawn and fades toward dusk as the wave wears on. Night is prep: no spawns, +35% builder speed, and time to reposition. Bray Wyatt's lantern punishes enemy sight — especially in low light.",
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
      body: 'Your force evolves in four Evolve-style stages shown in the Kingdom HUD: Stage 1 Outpost Realm (waves 1–30) — defensive line, basic troops, first veterans (+5% line HP). Stage 2 Kingdom Rising (31–99) — academies, settlements, evolved allies, +3% army damage. Stage 3 Empire Ascendant (100–199) — loadouts, fortress economy, colony value heavily steers wave pressure; wave 150+ unlocks Settlement Raid missions. Stage 4 Planetary Dominion (200+) — massive map, mirror settlements, Counter-Hold courier, +5% army / +10% siege.',
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
      name: 'Planet Warfare (Wave 200+)',
      body: 'After wave 200 the HOST expands hostile territory south each wave (CONTROL HUD). Unchecked creep brings: closer enemy spawns on all flanks, faster assault cadence, fogged minimap north of the red front line, and hidden enemies until scouts or watchtowers spot them. Push back by destroying enemy economy structures (−6% control each), killing foes north of the front, and clearing all northern holds at wave end. Watchtowers and scouts extend vision into hostile zones.',
    },
    {
      cat: 'campaign',
      name: 'Planet Conquest (Wave 500+)',
      body: 'Endgame sector warfare — active from wave 500 in Campaign or via the Planet Conquest game mode (starts at wave 500). The map splits into horizontal sectors per hostile realm (CONQUEST HUD + colored north overlay). Raze their northern holds and hunt their armies to raise your sector %; undefeated sectors creep back each wave. When enemy control drops below 12% with no live units or buildings, that realm is ELIMINATED. After two realms fall, the Worldheart Tyrant (scaled boss_malachar) awakens in the north. Its ward reduces damage until you field three or more different player unit types; at 75/50/25% HP it summons remnants from fallen factions. True victory at wave 500+ requires shattering the Worldheart Tyrant — economy purge alone no longer ends the campaign. Eliminated factions stop spawning and vanish from the HOST roster.',
    },
    {
      cat: 'campaign',
      name: 'Asymmetric Warfare',
      body: 'Evolve-style opposing roles: YOU are the Kingdom Commander — macro (night builds, hamlets, academies, research, TP) plus micro (HUNT, rally, doctrines, spy/courier). The HOST is an Evolving Threat — auto-spawns, faction kingdoms, levels up (Threat Lv 1–25+), and pressures the whole map. COMMAND HUD shows macro authority vs micro orders; HOST HUD shows threat level; the Kingdom bar compares blue (you) vs red (host). High Commander Authority grants longer nights, faster builders, and bonus TP. High Host Threat adds spawns, faster assaults, multi-flank bias, and elite injections. Raze northern holds to push threat level down.',
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
        name: unlocked ? 'The Doomslayer' : '??? The Doomslayer',
        body:
          unlocked && def
            ? `Deploy for ${def.cost} TP. HP ${def.hp} · near-unkillable damage reduction. Heals half his missing health every 2 waves. Auto-abilities: Rend & Ruin cleave when swarmed, Guardian heal when allies are pressed, mass cleave when hordes gather. His blade one-shots most foes — except in Hellscape.`
            : "A figure in green armor, spoken of only after a commander survives wave 200 on Doomslayer difficulty. Cost: ten thousand TP. They say he heals from the abyss, ripostes entire hordes alone, and carries a sword that ends wars in one swing. Unlock him — or don't — and find out if the legends lie.",
      },
      {
        cat: 'doomslayer',
        tease: true,
        name: 'Rend & Ruin',
        body: unlocked
          ? 'When four or more enemies close on the Doomslayer, he unleashes Rend & Ruin — AoE devastation. Cooldown applies.'
          : '??? When the Slayer is surrounded, witnesses report... something. The reports stop mid-sentence.',
      },
      {
        cat: 'doomslayer',
        tease: true,
        name: 'Guardian Protocol',
        body: unlocked
          ? 'When three or more enemies threaten allies, the Doomslayer heals the army and grants a brief rally.'
          : '??? Allies near him supposedly fight harder when the line breaks. No field manual confirms this.',
      },
      {
        cat: 'doomslayer',
        tease: true,
        name: 'Hellscape (Wave 1001+)',
        body: "Beyond wave 1000, reality thins. Even the Doomslayer's legendary blade falters against hellscape-level threats — damage returns to mortal scale. Survive that far and you have seen the true endgame.",
      },
      {
        cat: 'doomslayer',
        tease: !unlocked,
        name: unlocked ? 'How to Unlock' : '??? How to Unlock',
        body: unlocked
          ? 'Reach wave 200 on Doomslayer difficulty in a single run — or discover another way in. The realm remembers how you unlocked him.'
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

  /** [classified tease, unlocked flavor, optional field tip] */
  const CROSSOVER_HERO_LORE = {
    tank_dempsey: [
      'A gravel-voiced marine who solves every problem with frags first, questions never.',
      'Splinter Vale is the Void Residue breacher — high morale, steady melee DPS, and Grenade Burst bonus damage when enemies cluster. Put him where the horde is thickest.',
      'Lead assaults into packed waves; pair with walls so Dr. Volkov can work behind him.',
    ],
    richtofen: [
      'Scribes mention a laughing doctor and green flashes that chain through elite ranks.',
      'Dr. Volkov brings mad-science ranged DPS. resonance weapon chains lightning on elite hits — devastating from behind cover, fragile if caught in the open.',
      'Garrison in outposts; never leave him exposed to assassins or warg riders.',
    ],
    nikolai: [
      'A stocky soldier who drinks before battle and somehow gets harder to kill.',
      'Brass Kozlov is the Void Residue anchor — huge HP pool and Iron Rage damage reduction when wounded. He outlasts waves other melee units cannot.',
      'Place on the front line and let him soak siege pressure while allies heal.',
    ],
    takeo: [
      'A disciplined swordsman said to strike faster after every star earned on the field.',
      'Blade Sato is the Void Residue duelist — high speed and accuracy with Bushido crit scaling from veteran stars. Elite hunter and morale stabilizer.',
      'Hunt dark knights and bosses; stars make him scarier over long campaigns.',
    ],

    primis_tank: [
      'A harder, angrier version of a famous marine — reports end mid-grenade.',
      'Splinter Vale (Ascended) hits harder than his Void Residue self. Void Slam cleaves on kill — excellent for cleaning up after wall breaks.',
      'Push through breaches after sappers open lanes.',
    ],
    primis_nikolai: [
      'Iron curtains and vodka — veterans swear he refuses to die.',
      'Brass Kozlov (Ascended) is a premium tank with Iron Curtain — brief invulnerability below 35% HP. Best First Circle frontliner for long waves.',
      'Anchor your First Circle line; let Curtain proc before pulling him back to heal.',
    ],
    primis_takeo: [
      'Katana fury against wounded prey — same honor, sharper edge.',
      'Blade Sato (Ascended) is faster and deadlier than Void Residue Sato. Blade Fury stacks rapid strikes on low-HP targets.',
      'Finish elites and fleeing routed enemies.',
    ],
    primis_richtofen: [
      'The doctor who steals life from elites to mend allies — classified.',
      'Dr. Volkov (Ascended) is support-ranged: Void Key drains elite HP to heal nearby allies. Keep him behind Kozlov.',
      'Focus fire elites in his lane to trigger sustain for your army.',
    ],

    master_chief: [
      'A green-armored phantom who shields allies when the wave horn sounds.',
      'Sentinel-7 is the orbital flagship — ranged DPS, high HP, Vanguard Rage shields allies on wave start. Build around him as your ranged core.',
      'Open every wave near your line; pair with Wolf Pack buffs.',
    ],
    noble_six: [
      'Lone wolf operative — stronger when the map around him is empty.',
      'Lance Operative excels at isolated flanks. Lone Wolf bonus damage when no allies are nearby — send him on hunt missions.',
      'Hunt stragglers and back-line archers away from the main blob.',
    ],
    sgt_johnson: [
      'Oorah echoes before the charge — morale spikes wherever he stands.',
      'Sergeant Ashford is melee support — Oorah rally pulse and morale on wave start. Your army fights braver with him on field.',
      'Deploy at wave start beside demoralized troops.',
    ],
    noble_carter: [
      'Wolf Pack leader — vanguard operatives near him shoot straighter and fight longer.',
      'Wolf Leader buffs nearby vanguard operatives. Field him with Heavy Gunner, Cat Operative, and Ember Operative for Wolf Pack synergy.',
      'Keep Wolf Leader mid-line so multiple vanguard operatives catch Wolf Leader.',
    ],
    noble_kat: [
      'Tech specialist — enemy arrows miss more when she is on the battlefield.',
      'Cat Operative debuffs enemy accuracy in her aura. Tech Ops shuts down orc archer lanes.',
      'Place opposite enemy ranged spawns.',
    ],
    noble_emile: [
      'Plasma blade, zero patience — melee finisher against wounded foes.',
      'Ember Operative is fast melee with Plasma Blade executions on low HP. Screen him with Heavy Gunner or Sentinel-7.',
      'Chase fleeing enemies and assassins; do not leave him alone in archer fire.',
    ],
    noble_jorge: [
      'Heavy weapons never tire — every third shot splashes.',
      'Heavy Gunner is slow but devastating — Grenadier splash every third shot. Your anti-cluster ranged platform.',
      'Put behind walls facing the widest enemy approach.',
    ],
    noble_jun: [
      'Sniper cover from extreme range — elites drop before they reach the wall.',
      'Sniper Operative has the longest vanguard range and bonus vs elites. Sniper Cover deletes dark knights.',
      'Garrison outposts for maximum range extension.',
    ],
    spartan_soldier: [
      'Standard-issue Vanguard Trooper — reliable, affordable ranged line-holder.',
      'Vanguard Trooper is the budget orbital recruit — steady ranged DPS without wolf-pack drama. Fill gaps in your gun line.',
      'Cheap ranged filler when TP is tight.',
    ],

    marcus_fenix: [
      'Gruff trench veteran — chainsaw screams mean someone is about to die.',
      'Marcus Ironhart is the trench captain — Burst Lancer chainsaw finishers on low HP. Core of any trench roster.',
      'Center your gun line; Dom heals him when paired.',
    ],
    dom_santiago: [
      'Brothers in arms — Ironhart fights better when Dom is close.',
      "Dom Calder heals Ironhart when nearby and brings Brothers in Arms sustain. Keep Dom within Ironhart's screen.",
      'Never split Dom from Ironhart on hard waves.',
    ],
    damon_baird: [
      'Sarcastic tech head — structures and siege towers fear him.',
      'Damon Gearwright deals bonus damage vs siege and buildings. Tech Head makes him your anti-tower specialist.',
      'Send Gearwright against siege towers and enemy hamlets.',
    ],
    augustus_cole: [
      'The Iron Charge has no brakes — charges through enemy lines.',
      'Augustus Cole is heavy melee — Iron Charge charges through formations. Flank when the line stalls.',
      'Use on open maps after walls pin the horde.',
    ],
    anthony_carmine: [
      'The Ironhelm curse is real — cheap, fragile, beloved.',
      'Anthony Ironhelm is budget burst support — fragile but affordable. Ironhelm Curse: do not expect him to survive focus fire.',
      'Cheap ranged slot; replace when TP allows Clayton.',
    ],
    clayton_carmine: [
      'Heavy weapons Ironhelm — suppression that shreds groups.',
      'Clayton Ironhelm suppresses groups with heavy burst fire. Tankier than Anthony with real DPS.',
      'Backline suppressor behind Ironhart.',
    ],
    benjamin_carmine: [
      'Another Ironhelm — buffs his brothers when clustered.',
      'Benjamin Ironhelm buffs other Ironhelms nearby. Ironhelm Brother synergy rewards fielding multiple Ironhelms.',
      'Deploy with Anthony or Clayton for brotherhood buffs.',
    ],
    cog_soldier: [
      'Standard trench recruit — burst drill and discipline.',
      'Trench Trooper is the affordable trench line-holder — Burst Drill provides steady ranged DPS.',
      'Fill the line when elites are handled elsewhere.',
    ],

    aragorn: [
      'The king returned — Crownblade hunts dark knights and elite armor.',
      'Crownless Ranger is elite-slaying melee with high morale. Crownblade bonus vs elites and dark knights — your boss-wave answer.',
      'Send Crownless Ranger at war chiefs and dark knights.',
    ],
    legolas: [
      'Elven archer — arrows from impossible range find fast prey.',
      'Silvan Archer is extreme-range DPS with bonus vs fast foes. Garrison outposts and watch towers for absurd reach.',
      'Counter warg riders and assassins from safety.',
    ],
    gimli: [
      'Nobody tosses a dwarf — axe cleave splashes siege targets.',
      'Stone Axe Lord is siege melee — Axe Cleave splashes on siege targets. Put him on walls facing towers.',
      'Pair with sappers on structure-heavy waves.',
    ],
    gandalf: [
      'Grey Ward — terror radiates from the grey wanderer.',
      'Grey Pilgrim is support caster — Grey Ward terrifies nearby enemies. Morale weapon and ranged bolt DPS.',
      'Hold the center; enemies near him fight worse.',
    ],
    frodo: [
      'Scout ring — small, evasive, lifts ally morale.',
      'Halfling Scout evades and spreads morale aura. Ring Bearer keeps fragile lines from breaking — not a fighter.',
      'Keep Halfling Scout behind the march company; let others tank.',
    ],
    boromir: [
      'Shield Horn when surrounded — rally pulse turns desperation into steel.',
      'Shield Captain rallies when surrounded — Shield Horn punishes enemies that blob on him.',
      'Let him hold a choke; trigger rally when flanked.',
    ],
    eowyn: [
      'Elite slayer — no quarter given with a grudge against bosses.',
      'Shield Maiden is fast melee with Elite Slayer — devastating finisher vs elite foes. Send her at necromancers and war chiefs.',
      'Hunt elites; she punches above her HP on finishers.',
    ],

    baki_hanma: [
      'Demon Back awakens below half health — the son of the Ogre.',
      'Ironson Baki spikes damage when wounded. Demon Back turns a losing duel into a reversal — risky but explosive.',
      'Let him take some damage before expecting peak output.',
    ],
    yujiro_hanma: [
      'The Ogre himself — near-boss tier, terrifying TP cost.',
      'The Ogre Patriarch is the Iron Pit nuke — near-boss HP and damage. The Ogre deletes melee targets; bankrupts careless commanders.',
      'Save for boss waves; protect from ranged kiting.',
    ],
    doppo_orochi: [
      'Karate precision — Goudou finishes wounded targets cleanly.',
      'Doppo Serpent punishes wounded foes with Goudou precision strikes. Reliable second-line duelist.',
      'Pair with Ironson Baki — soften targets, Doppo executes.',
    ],
    jack_hanma: [
      'Bite first, talk never — bonus damage vs larger enemies.',
      'Jack Ironson chews through bruisers — Bite bonus vs larger enemies. Strong vs trolls and siege.',
      'Send Jack at trolls and tall elites.',
    ],
    oliva_biscuit: [
      'Iron Body — American heavyweight who barely moves, barely bleeds.',
      'Oliva Biscuit is ultra-tank melee with Iron Body damage reduction. Slower than Ironson Baki but nearly unmovable.',
      'Hold a lane alone while strikers rotate.',
    ],
    kaku_kaioh: [
      'Aiki counters reckless attackers — judo on a medieval map.',
      'Kaku Kaioh counters reckless attackers with Aiki — punishes berserkers and warg riders.',
      'Place where enemies charge your line.',
    ],
    pickle: [
      'Primitive fury — prehistoric power, low morale, high carnage.',
      'Pickle is raw prehistoric bruiser — Primitive Fury trades morale for devastation. Chaos unit for emergency holds.',
      'Emergency line plug when TP allows a monster.',
    ],

    jonathan_joestar: [
      'Gentleman fighter — Solar Pulse purges undead elites.',
      'Jonathan Ashford is Part 1 melee — Solar Pulse bonus vs undead elites like necromancers.',
      'Send at necromancer waves.',
    ],
    dio_brando_p1: [
      'Crimson Chill — Part 1 crimson lord slows enemy morale.',
      'Dio Crimson is fast melee that saps enemy morale with Crimson Chill.',
      'Disrupt enemy morale while Jonathan holds the line.',
    ],
    zeppeli: [
      'Solar Heal heals allies when elites fall — solar teacher.',
      'Will Zephyr is Part 1 support — Solar Heal heals allies on elite kill.',
      'Keep near your kill lane to proc sustain.',
    ],
    joseph_joestar_p2: [
      'Oh my God! Trick shots and Violet Snare debuffs.',
      'Joseph Ashford is ranged trickster — Violet Snare scouting debuffs and unpredictable damage.',
      'Ranged harass behind walls.',
    ],
    caesar_zeppeli: [
      'Pressure Cutter crits from range — pressure bubbles find weak points.',
      'Caesar Zephyr is Part 2 ranged crit — Pressure Cutter rewards accurate shots.',
      'Outpost garrison for crit fishing.',
    ],
    stroheim: [
      'Iron science — bonus damage vs siege units.',
      'Rudol Ironclad is heavy ranged anti-siege — Iron Science shreds towers.',
      'Counter siege tower waves.',
    ],
    jotaro_kujo: [
      'Spirit Rush — rapid finisher pins elites and shreds them.',
      'Jotaro Ashen is Part 3 melee powerhouse — Spirit Rush rapid finisher on pinned foes. Elite deletion.',
      "Focus fire elites into Jotaro Ashen's lane.",
    ],
    kakyoin: [
      'Emerald Spray — emerald splash AoE from safety.',
      'Noriaki Emerald provides Part 3 ranged AoE — Emerald Spray hits clusters.',
      'Behind walls vs grouped spawns.',
    ],
    polnareff: [
      'Silver Flurry flurries wounded foes — fast melee skirmisher.',
      'Jean Pierre Silver is speedy Part 3 melee — Silver Flurry flurries low HP targets.',
      'Chase wounded routed enemies.',
    ],
    avdol: [
      "Crimson Flame — fire splash on every hit.",
      "Mohammed Flame is Part 3 support-ranged — Crimson Flame fire splash chips groups.",
      'Mid-line fire support.',
    ],
    josuke_higashikata: [
      'Restorative March — heals allies he passes on the march.',
      'Josuke Diamond is Part 4 support — Restorative March heals allies in his path. Move him through wounded troops.',
      'March Josuke through retreating allies.',
    ],
    okuyasu: [
      'The Hand erases space — burst single-target deletion.',
      'Okuyasu Hand is Part 4 bruiser — The Hand erases space for burst damage. Simple, violent, effective.',
      'Point at high-priority single targets.',
    ],
    rohan_kishibe: [
      "Script Ward — debuffs enemy accuracy from range.",
      "Rohan Artist is Part 4 ranged debuffer — Script Ward ruins enemy accuracy.",
      'Opposite enemy archer lanes.',
    ],
    kira_yoshikage: [
      'Quiet Erase — final toll on wounded prey.',
      'Yoshikage Quiet executes wounded foes with Quiet Erase — quiet, lethal Part 4 finisher.',
      'Mop up after your line softens the wave.',
    ],
    giorno_giovanna: [
      'Golden Pulse — heals allies on kill.',
      'Giorno Gold is Part 5 support — Golden Pulse heals on kill. gold-court sustain engine.',
      'Keep in active kill zones.',
    ],
    bruno_bucciarati: [
      'Zip Fingers — zip reposition and rally allies.',
      'Bruno Zipper rallies and repositions with Zip Fingers — high morale leader.',
      'Use for pep-talk positioning before pushes.',
    ],
    guido_mista: [
      'Ricochet Pistols ricochet — one shot, several targets.',
      "Guido Mista's Ricochet Pistols ricochet hits multiple foes — Part 5 ranged multitarget.",
      'Counter spread formations.',
    ],
    diavolo: [
      'Crimson Erase — deletes wounded targets from time.',
      'Diavolo is Part 5 assassin — Crimson Erase removes wounded enemies. Expensive but decisive.',
      'Elite and assassin hunter.',
    ],
    jolyne_cujoh: [
      'Stone Free strings slow enemies — Part 6 control melee.',
      'Jolyne String slows with Stone Free — Part 6 control fighter.',
      'Hold chokepoints while allies DPS.',
    ],
    weather_report: [
      'Storm Field — AoE lightning pressure from range.',
      'Storm Caller is Part 6 ranged AoE — lightning pressure across lanes.',
      'Wide map AoE supplement.',
    ],
    ermes_costello: [
      'Kiss duplicates pressure — elite kills spawn more pain.',
      'Ermes Costello stacks pressure with Kiss — elite kills duplicate harassment.',
      'Elite-heavy waves.',
    ],
    johnny_joestar: [
      'Rotation ACT4 — Golden Ball Run cavalry with infinite rotation finisher.',
      'Johnny Rotation is Part 7 cavalry — Rotation ACT4 charge finisher. Fastest bound spirit hunter on expanded maps.',
      'Hunt on wide territory; needs open lanes.',
    ],
    gyro_zeppeli: [
      'Steel Ball golden spin — ranged cavalry cleave on charge.',
      'Gyro Ballista is Part 7 ranged cavalry — Steel Ball cleave on charge. Tag-team with Johnny Rotation.',
      'Pair with Johnny Rotation for golden ball hunt missions.',
    ],
    diego_brando: [
      'Predator Form — predatory charge damage.',
      'Diego Brando is Part 7 fast cavalry — Predator Form predatory charges. Aggressive hunter.',
      'Flank and hunt; high speed, lower morale.',
    ],
    lucy_steel: [
      'Ticket to Ride — support cavalry rally aura.',
      'Lucy Steel is Part 7 support cavalry — Ticket to Ride rally aura for mounted allies.',
      'Ride with Johnny Rotation and Gyro Ballista for morale.',
    ],

    kenshiro: [
      'Fate was sealed — North Star Fist finisher legend.',
      'Ken Northstar is the North Star successor — rapid finisher on low HP. Elite and bruiser executioner.',
      'Focus fire until finisher range.',
    ],
    raoh: [
      'Ken-Oh — terror aura and siege bonus. The conqueror walks.',
      'Raoh is slow but terrifying — Ken-Oh aura and siege bonus. Boss-tier melee presence.',
      'Boss waves and structure pushes.',
    ],
    toki: [
      'Hakke Shou heals allies in aura — gentle fist, iron will.',
      'Toki heals allies in aura with Hakke Shou — mandatory North Star support.',
      'Center your melee blob on Toki.',
    ],
    rei: [
      'Nanto Suichō Ken — fast strikes hit multiple foes.',
      'Rei is fast multi-hit melee — Nanto Suichō Ken cleaves several targets.',
      'Counter fast enemy swarms.',
    ],
    jaggi: [
      'Dirty tricks — debuffs enemy morale on every hit.',
      'Jagi fights dirty — morale debuffs on hit. Chaos agent, low morale himself.',
      'Disrupt enemy morale lines.',
    ],
    shin: [
      'Nanto Hakuro Ken — heavy single-target blows.',
      'Shin delivers Nanto Hakuro heavy single-target blows — mini-boss duelist.',
      'Point at high-HP single targets.',
    ],

    goku: [
      'Skyburst Wave when surrounded — skyburst finisher.',
      'Kael Skyburst is balanced melee carry — Skyburst Wave burst when surrounded. Reliable skyburst fighter anchor.',
      'Let him get surrounded for finisher proc.',
    ],
    vegeta: [
      'Prince Beam pride — bonus vs elites when honor demands.',
      'Prince Vex is elite-hunting melee — Prince Beam bonus vs elites. Pride damage spike.',
      'Send Prince Vex at elite waves.',
    ],
    piccolo: [
      'Piercing Beam pierces high-HP targets from range.',
      'Namek Sage is support-ranged — Piercing Beam pierces tanks. Beam sniper.',
      'Focus fire high-HP targets in his lane.',
    ],
    gohan: [
      'Hidden Potential — massive spike below 40% HP.',
      'Scholar Burst explodes when wounded — Hidden Potential below 40% HP. Let him get low, then watch.',
      'Risky anchor — heal after spike.',
    ],
    trunks: [
      'Burning Attack — ranged burst finisher from the future.',
      'Trunks is ranged burst — Burning Attack finisher at distance.',
      'Backline finisher behind tanks.',
    ],
    frieza: [
      'Frost Lance — precision ranged execution.',
      'Frost Tyrant is cold ranged execution — Frost Lance picks off wounded targets.',
      'Sniper from outposts.',
    ],
    cell: [
      'Perfect Form — heals on kill, sustains through long waves.',
      'Perfect Hybrid heals on kill with Perfect Form — sustain melee that grows stronger.',
      'Long waves where kills chain.',
    ],
    beerus: [
      'Cataclysm — god-tier delete on wounded foes. Expensive annihilation.',
      'Cataclysm Lord is the ultimate skyburst fighter — Cataclysm deletes wounded enemies. God-tier cost for god-tier waves.',
      'Save for boss waves; protect from focus fire.',
    ],

    chapter_captain: [
      'Volley discipline — legionnaires fight harder in formation.',
      'Chapter Captain is the crimson legions ranged core — Volley Discipline rewards clustering legionnaires on the line.',
      'Center your gun line with Guardsmen and Librarian support.',
    ],
    chaplain: [
      'Litanies of hate shake enemy morale on every strike.',
      'Chaplain is melee support — Litany of Hate debuffs foes in his aura. Morale weapon for breaking blobs.',
      'Hold the front beside Terminators; let hate do the work.',
    ],
    librarian: [
      'Smite arcs through necromancers and dark mages.',
      'Librarian brings psychic ranged DPS — Smite deletes casters and undead summoners.',
      'Place opposite enemy mage lanes.',
    ],
    commissar: [
      'Summary execution for cowards below a quarter health.',
      'Commissar is morale anchor and finisher — Summary Execution deletes routed low-HP foes.',
      'Backline support; highest morale in the roster.',
    ],
    guardsman: [
      'Rifle volleys — cheap, numerous, surprisingly effective.',
      'Guardsman is budget ranged filler — Rifle Volley splashes every fourth shot.',
      'Spam when TP is tight; pair with Captain for discipline.',
    ],
    terminator: [
      'Storm shield pulses when the warsuit is wounded.',
      'Heavy Terminator is the crimson legions anchor — Storm Shield grants brief soak below 45% HP. Slow but unmovable.',
      'Hold chokepoints; do not chase fast cavalry.',
    ],
    dreadnought: [
      'Autocannon shreds siege towers and deployed engines.',
      'Dreadnought is heavy siege ranged — Autocannon bonus vs structures. Walking artillery platform.',
      'Send against siege towers and enemy hamlets in Planet Warfare.',
    ],

    soldier_of_light: [
      'Cross slash finishers punish wounded foes.',
      'Soldier of Light is the Crystal frontliner — Cross Slash spikes vs enemies below half HP.',
      'Lead the party; pair with White Mage sustain.',
    ],
    black_mage: [
      'Firaga bursts when enemies cluster.',
      'Black Mage is AoE ranged — Firaga fires when multiple foes are near the target.',
      'Backline behind walls facing wide approaches.',
    ],
    white_mage: [
      'Curaga heals allies in combat aura.',
      'White Mage is support caster — Curaga trickle-heals nearby allies on every strike.',
      'Keep mid-line near your melee core.',
    ],
    dragoon_knight: [
      'Jump attack — sky piercer vs fast and flying prey.',
      'Sky Lance is cavalry hunter — Jump Attack bonus vs harpies and warg riders. Can hunt on wide maps.',
      'Hunt flyers after walls pin the ground horde.',
    ],
    summoner: [
      'Aeon strike — extra damage vs elite enemies.',
      'Summoner is elite-slaying ranged — Aeon Strike punishes bosses and dark knights.',
      'Focus fire elites in the Summoner lane.',
    ],
    limit_striker: [
      'Limit break — massive spike when wounded.',
      'Limit Striker is risk-reward melee — Limit Break doubles down below 40% HP. Let them take hits first.',
      'Frontline finisher; heal after the burst window.',
    ],
    crystal_sentinel: [
      'Aether shot — steady budget ranged DPS.',
      'Crystal Sentinel is affordable line-holder — occasional bonus vs elites.',
      'Fill gaps when TP cannot afford full party heroes.',
    ],

    chaos_champion: [
      'Warp fury surges when the champion is bloodied.',
      'Chaos Champion is melee carry — Warp Fury damage spikes below half HP. Aggressive frontliner.',
      'Push when you can heal; thrives in long brawls.',
    ],
    plague_cultist: [
      'Festering curse slows and breaks morale.',
      'Plague Cultist debuffs with Festering Curse — slow and morale shred on every hit.',
      'Aura support beside Daemon Knight.',
    ],
    warp_magus: [
      'Warp bolt arcs to a second nearby foe.',
      'Warp Magus is ranged chaos — Warp Bolt chains to adjacent enemies.',
      'Backline vs clustered waves.',
    ],
    daemon_knight: [
      'Unholy armor soaks damage below 40% HP.',
      'Daemon Knight is heavy melee tank — Unholy Armor pulse when wounded. Slower than Terminator, meaner.',
      'Anchor the cult; protect Magus behind.',
    ],
    heretic_acolyte: [
      'Blood pact — heals on kill.',
      'Heretic Acolyte is budget melee sustain — Blood Pact heals when finishing foes.',
      'Cheap frontline fodder that grows through kills.',
    ],
    possessed_marine: [
      'Daemon fire splashes elite targets.',
      'Possessed Marine is ranged chaos — Daemon Fire AoE vs elites.',
      'Backline finisher for boss waves.',
    ],

    dragonborn: [
      'A warrior whose voice shakes mountains — whispers of the Voice precede every boss fall.',
      'Wyrmcaller is the Voicebound flagship — melee bruiser with Voice Shout cleave. Center your dragon-themed boss kills around them.',
      'Pair with Mountain Hermit; hunt named warlords after softening with shouts.',
    ],
    greybeard_sage: [
      'Ancient monks who teach the Voice — classified until prophecy awakens.',
      'Mountain Hermit is support-ranged — Voice Echo buffs allies and terrifies foes on wave start.',
      'Deploy at dawn beside Wyrmcaller for voice synergy.',
    ],
    nord_huscarl: [
      'Shield-brothers who hold the line when dragons circle overhead.',
      'Frost Huscarl is a durable melee anchor — Shield Wall procs when wounded.',
      'Frontline for Martial path Immortal trials.',
    ],
    battlemage: [
      'Storm-crowned mages who channel dragon aspect against elite prey.',
      'Battlemage is ranged DPS — Dragon Aspect bonus vs elites and bosses (counts for legacy kills).',
      'Backline finisher on war chiefs and named bosses.',
    ],
    nightingale: [
      'Shadow blades from forgotten guilds — strike when the dragon sleeps.',
      'Nightingale is fast melee — Shadow Strike executes wounded foes.',
      'Flank assassins while huscarls hold the shout line.',
    ],
    restoration_saint: [
      'Healers sworn to restoration saints who mend armies between dragon duels.',
      'Restoration Saint is support — Restoration Blessing heals and steadies morale in aura.',
      'Keep near your Immortal mentors during wave 100+ legacy push.',
    ],
  };

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
        ? ' · Golden Ball Run cavalry'
        : def.jojoPart
          ? ` · Bound Spirit Part ${def.jojoPart}`
          : '';
    return `${role}${part} · ${def.cost} TP · HP ${def.hp} · DMG ${def.damage} · ACC ${def.accuracy} · SPD ${def.speed}`;
  }

  function buildCrossoverHeroBody(id, def, unlocked) {
    const lore = CROSSOVER_HERO_LORE[id];
    const tease =
      lore?.[0] ||
      `Travelers whisper of ${def.name}, but no signed contract exists in the Crown's ledgers.`;
    const flavor = lore?.[1] || `${def.name} deploys as ${def.combatTag} ${def.type}.`;
    const tip = lore?.[2] || defaultHeroTip(def);
    if (!unlocked) return tease;
    let body = `${flavor}\n\n${def.abilityDesc}\n\n${formatCrossoverStats(def)}\n\nTip: ${tip}`;
    if (id === 'takeo') body += "\n\nIn memory of a legendary blade-master — thank you for the laughs.";
    return body;
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
          ? ' Survive to wave 150 on Doomslayer without losing a single building to the endless horde — or discover another way in.'
          : '';
      const primisTrial =
        factionId === 'primis'
          ? ' Win a campaign with a castle compound and never let an enemy breach the inner keep — timeline integrity must hold — or discover another way in.'
          : '';
      const haloTrial =
        factionId === 'halo'
          ? ' Win a campaign without losing your General — promote five Footmen to command and crown one as General — never leave a man behind — or discover another way in.'
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
          ? ' Win a campaign after recruiting three evolved heroes and keeping them on the field together for most waves — teamwork, bound spirits, dramatic poses and alliances — or discover another way in.'
          : '';
      const fotnsTrial =
        factionId === 'fotns'
          ? ' Win a campaign after a lone hero — and only that hero — lands the killing blow on a named warlord. One-man-army legend: Your fate was sealed before the strike — or discover another way in.'
          : '';
      const dragonballTrial =
        factionId === 'dragonball'
          ? ' Reach wave 200+, defeat the planetary threat boss, and field a high-ki army when the Worldheart falls — power level escalation, protecting the planet — or discover another way in.'
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
        body: 'Warriors from other worlds sign on through Legion Archive — your evolved allies. See Evolved Allies — Design Philosophy in this tab for early spikes, late-game armies, and Planet Warfare operatives. Each faction needs its barracks completed before recruits deploy.',
      },
      {
        cat: 'crossover_meta',
        name: 'How to Recruit',
        body: "1) Unlock the faction roster. 2) Build that faction's barracks with your Builder. 3) Open Legion Archive from the HUD. 4) Pay TP to deploy operatives onto the rally line. Signed operatives appear in your Legacy roll. Tonic Stations machines unlock after any secret roster (Coliseum, Doomslayer, or evolved allies) is active.",
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
        body: 'Build machines after unlocking a secret roster (Coliseum, Doomslayer, or evolved heroes). Eligible units collect perks during night prep — up to 4 perks based on stars earned. Each perk favors melee, ranged, or support tags.',
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
      { cat: 'perks', name: 'Elemental Pop', body: 'Ranged & melee — splash damage on hits.' },
      { cat: 'perks', name: 'Impact Ward', body: 'Melee only — explosion immunity.' },
      { cat: 'perks', name: "Brawler's Brew", body: 'Melee only — +28% melee damage.' },
      { cat: 'perks', name: "Scavenger's Tonic", body: 'Ranged & support — kills may grant +1 TP.' },
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
        body: 'Build a Research Lab to analyze slain foes for Science Points and unlock the full technology tree. Stronger enemies pay more SP; each wave has an analysis cap (extra labs raise it). Open the Research tab in the encyclopedia after the game loads for all nodes, costs, prerequisites, and unlocks.',
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
    const story =
      typeof StoryLore !== 'undefined' ? StoryLore.getEncyclopediaEntries() : [];
    const legacy = typeof Legacy !== 'undefined' ? Legacy.getLegacyEntries() : [];
    const journey =
      typeof LayerDesign !== 'undefined' && LayerDesign.getEncyclopediaEntries
        ? LayerDesign.getEncyclopediaEntries()
        : [];
    return [
      ...journey,
      ...loreExpanded,
      ...factionLore,
      ...buildResearchEntries(),
      ...buildLoadoutEntries(),
      ...buildNamedBossEntries(),
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

  return { init, open, close, isOpen, togglePanel, renderPanel, getAllEntries };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Encyclopedia = Encyclopedia;
