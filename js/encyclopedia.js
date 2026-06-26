/**
 * Myth and Blood — encyclopedia (main menu, pause menu, in-game HUD).
 */
const Encyclopedia = (() => {
  let panelOpen = false;
  let returnToPause = false;
  const WWE_TEASE = {
    stone_cold: 'A rattlesnake in boots. Court records mention elites falling to a sudden stunner — and the crowd going absolutely silent.',
    the_rock: 'The People\'s Champion. When he lays the smack down, kill streaks apparently get louder.',
    ric_flair: 'Woooo! Allies near him fight with extra swagger. The Nature Boy doesn\'t pay to win — he makes you pay to lose.',
    hulk_hogan: 'Train, say your prayers, eat vitamins. Below half health he hulks up and refuses to stay down.',
    macho_man: 'Oooh yeah! Drops elbows from the high ground. Snap into it — the battlefield will.',
    sting: 'The Stinger strikes from the shadows. Wounded prey don\'t walk away from the Scorpion Deathlock.',
    john_cena: 'Never gives up, never surrenders. Damage seems to bounce off when the fight turns ugly.',
    bautista: 'The Animal. His bomb shakes everyone standing too close.',
    roman_reigns: 'Acknowledge him. The spear ends arguments — and several orcs at once.',
    shawn_michaels: 'The Heartbreak Kid. Sweet Chin Music rings out when the moment is right — usually a crit.',
    bret_hart: 'The best there is, the best there was. Sharpshooter locks a single foe in misery.',
    undertaker: 'The Deadman walks. Tombstones spread dread; enemy morale withers nearby.',
    kane: 'Brother fire. Chokeslams hit harder the bigger the target.',
    andre_giant: 'A living mountain. Footsteps cause splash damage; walls fear him.',
    razor_ramon: 'Chico, the bad guy. Razor\'s Edge — steady, stylish, inevitable DPS.',
    kevin_nash: 'Too sweet. Jackknife power bombs echo through the ranks.',
    roddy_piper: 'Hot tag energy — when Piper scores, allies feel it in their bones.',
    hacksaw_duggan: 'Hoooo! USA! Rally pulses on wave start when he\'s on the roster.',
    junkyard_dog: 'Headbutts stun on impact. The dog keeps coming.',
    rey_mysterio: '619 — too fast to pin, too clever to catch. Evasion rumors are widespread.',
    eddie_guerrero: 'Lie, cheat, steal — and maybe pick the elite\'s pocket for TP when they fall.',
    chris_benoit: 'The Crippler Crossface — surgical, cruel, single-target devastation.',
    oba_femi: 'The Nigerian Nightmare. Surrounded? That\'s when he hits hardest.',
    brock_lesnar: 'F-5. If you\'re wounded, you\'re gone. Next.',
    cm_punk: 'Pipe bomb truth. Go To Sleep finishes anyone already hurting.',
    seth_rollins: 'The Architect. Curb stomps from range — burst finisher at distance.',
    sheamus: 'Brogue Kick — a line of bodies where he walked.',
    bray_wyatt: 'Follow the buzzards. His lantern dims enemy accuracy in the dark — devastating when dusk falls on the battlefield.',
    randy_orton: 'Outta nowhere. The Apex Predator drops the RKO on anyone already hurting.',
  };

  const CATEGORIES = [
    { id: 'allies', label: 'Allies' },
    { id: 'enemies', label: 'Enemies' },
    { id: 'bestiary', label: 'Bestiary' },
    { id: 'buildings', label: 'Buildings' },
    { id: 'orders', label: 'Orders & Strikes' },
    { id: 'stars', label: 'Star System' },
    { id: 'eras', label: 'Eras & Economy' },
    { id: 'campaign', label: 'Campaign' },
    { id: 'honor', label: 'Honor & Veterans' },
    { id: 'wwe', label: 'WWE Superstars' },
    { id: 'doomslayer', label: 'Doomslayer' },
    { id: 'crossover_meta', label: 'Crossover System' },
    { id: 'crossover_ultimis', label: 'Element 115' },
    { id: 'crossover_primis', label: 'Primis Crew' },
    { id: 'crossover_halo', label: 'UNSC / Spartans' },
    { id: 'crossover_gears', label: 'COG Forces' },
    { id: 'crossover_lotr', label: 'Middle-earth' },
    { id: 'crossover_baki', label: 'Hanma Dojo' },
    { id: 'crossover_jojo', label: 'JoJo Stands' },
    { id: 'crossover_fotns', label: 'Hokuto Shinken' },
    { id: 'crossover_dragonball', label: 'Dragon Ball' },
    { id: 'perks', label: 'Perk-a-Cola' },
    { id: 'chronicles', label: 'Chronicles' },
    { id: 'legacy', label: 'Legacy' },
    { id: 'creative', label: 'Creative Lab' },
  ];

  const BASE_ENTRIES = [
    { cat: 'allies', name: 'Footman', body: 'Cheap melee line-holder. Garrisons walls when a General commands the Keep. Earns bronze stars from kills; 3 gold stars may earn an honor name (e.g. Syr Gwyn).' },
    { cat: 'allies', name: 'Archer', body: 'Long-range DPS. Garrison outposts for extended range. Fragile — keep behind cover.' },
    { cat: 'allies', name: 'Mage', body: 'Arcane bolts with splash damage. Strong vs clustered foes.' },
    { cat: 'allies', name: 'Cavalry', body: 'Fast melee with charge bonus. Excellent for hunting stragglers.' },
    { cat: 'allies', name: 'Healer', body: 'Heals allies in range — including other healers. Ranks when healing (once per wave). Retreats to med tents when badly wounded.' },
    { cat: 'allies', name: 'Knight', body: 'Heavy armored melee with damage resistance. Banner courier can summon one.' },
    { cat: 'allies', name: 'Sapper', body: 'Demolishes walls and siege engines with bonus siege damage.' },
    { cat: 'allies', name: 'General', body: 'Global enemy priority target. Station in the castle Keep to grow a command aura and assign footmen to wall slots. Stars after promotion only buff aura.' },
    { cat: 'allies', name: 'Builder', body: 'Erects structures (2 projects max). Required ×5 for Hamlets and Merchant Guilds. Ranks when building.' },
    { cat: 'allies', name: 'Courier', body: 'Dispatches royal messages once per wave. Ranks when sending dispatches.' },

    { cat: 'enemies', name: 'Goblin', body: 'Weak swarm unit. Appears from wave 1.' },
    { cat: 'enemies', name: 'Orc', body: 'Sturdy melee grunt. Backbone of early waves.' },
    { cat: 'enemies', name: 'Orc Archer', body: 'Ranged pressure from the back line.' },
    { cat: 'enemies', name: 'Dark Knight', body: 'Elite armored knight — purple glow. High HP and damage.' },
    { cat: 'enemies', name: 'Warg Rider', body: 'Fast cavalry harasser.' },
    { cat: 'enemies', name: 'Dark Mage', body: 'Ranged arcane attacker.' },
    { cat: 'enemies', name: 'Troll', body: 'Elite bruiser with heavy wall damage.' },
    { cat: 'enemies', name: 'Goblin Sapper', body: 'Demolishes walls and settlements.' },
    { cat: 'enemies', name: 'Necromancer', body: 'Elite caster.' },
    { cat: 'enemies', name: 'Berserker', body: 'Elite high-damage melee.' },
    { cat: 'enemies', name: 'Assassin', body: 'Elite striker — hunts your General.' },
    { cat: 'enemies', name: 'Shaman', body: 'Enemy healer supporting hordes.' },
    { cat: 'enemies', name: 'Siege Tower', body: 'Deploys against walls every 5 waves. Linked to a wall segment for sustained fire.' },
    { cat: 'enemies', name: 'Goblin Engineer', body: 'Drops barricades. After wave 200, enemy economy buildings mirror yours.' },
    { cat: 'enemies', name: 'War Chief', body: 'Boss-tier elite. Appears in late pools when no named boss leads.' },
    { cat: 'enemies', name: 'Named Bosses (Every 10 Waves)', body: 'Waves 10, 20, 30… each field a unique warlord: Gorath the Breaker, Morwen the Pale, Thokk the Mountain, Grimm Ashborne, Vexis the Hollow, Iron Lord Karg, Sylvara Wyrm-Mother, the Rotfather, Dread Marshal Volk, and Malachar the Eternal at wave 100. They scale stronger each cycle.' },
    { cat: 'enemies', name: 'Abomination', body: 'Huge flesh horror with tentacles and many eyes. Regenerates slowly — burst it down.' },
    { cat: 'enemies', name: 'Behemoth', body: 'Colossal elite bruiser. Slow, enormous on the battlefield, smashes walls. Enrages below 40% HP.' },
    { cat: 'enemies', name: 'Iron Colossus', body: 'Massive riveted siege construct. Highest structure damage in the horde.' },
    { cat: 'enemies', name: 'Void Stalker', body: 'Tall shadow assassin — always hunts your General. Kill it before it closes.' },
    { cat: 'enemies', name: 'Elder Wyrm', body: 'Ancient flying dragon, larger than sky drakes. Boss-tier fire from above.' },

    { cat: 'buildings', name: 'Outpost', body: 'Forward cover +1 garrison slot for ranged units. Extends archer range.' },
    { cat: 'buildings', name: 'Wall', body: 'Blocks movement. 2 footman slots per wall when General commands Keep. Siege priority.' },
    { cat: 'buildings', name: 'Castle Compound', body: 'Large footprint: 4 walls, 4 outposts, Keep, med tent, mess hall. Center of command.' },
    { cat: 'buildings', name: 'Medical Tent', body: 'Wounded allies below 38% HP retreat here instead of fighting to the death.' },
    { cat: 'buildings', name: 'Mess Hall', body: 'Morale aura for nearby troops.' },
    { cat: 'buildings', name: 'Academies', body: 'Wave 100+: train 1 free unit per round. Special rules for Healer (÷5 waves), General (÷10 + 3★ footman), Builder/Courier (only if absent).' },
    { cat: 'buildings', name: 'Quarry', body: '30 TP, 2 Builders. +1 TP/round (counts toward 6-site cap with trade posts). Early economy — hamlets outscale it after wave 100.' },
    { cat: 'buildings', name: 'Trade Outpost', body: '38 TP, 2 Builders. +1 TP/round and morale aura. Same 6-site cap as quarries.' },
    { cat: 'buildings', name: 'Hamlet', body: '100 TP, 5 Builders required. Builds over 5 waves. +5 TP/round per completed hamlet. Huge, siegeable — recommended after wave 100.' },
    { cat: 'buildings', name: 'Merchant Guild', body: '150 TP, 5 Builders. +1 TP/round per guild within hamlet aura. Large footprint; enemies will target it.' },
    { cat: 'buildings', name: 'Enemy Settlements', body: 'After wave 200, enemies raise hamlets and guilds in the north. Each completed enemy settlement adds +1 unit to their spawn count.' },

    { cat: 'orders', name: 'Fireball Barrage', body: '9 TP — AoE fire damage at clicked location.' },
    { cat: 'orders', name: 'Lightning Strike', body: '6 TP — focused storm damage in a smaller radius.' },
    { cat: 'orders', name: 'Healing Rain', body: '6 TP — heals allies in a large radius.' },
    { cat: 'orders', name: 'Reinforcements', body: '12 TP — spawns footmen + archer on the battlefield.' },
    { cat: 'orders', name: 'Battle Rally', body: '6 TP — morale and damage boost army-wide. Snaps demoralized troops back to the fight.' },
    { cat: 'orders', name: 'Morale & Routing', body: 'Troops witness fallen allies (line of sight) and lose morale. Too many casualties cause routing — enemies flee off-map; before wave 100 allies may desert; after wave 100 they give up fighting until rallied. The General auto-paths to demoralized soldiers for a wall-to-wall pep talk (global detection, melee delivery). While rallying, he hits harder and shrugs off blows.' },
    { cat: 'orders', name: 'Spy Network', body: 'One action per wave: steal TP, disrupt spawns, assassinate elites, scout, poison, sabotage siege.' },
    { cat: 'orders', name: 'Courier Messages', body: 'One per wave: reinforcements, decree (+morale), tax levy (+TP), call banner (knight), supplies (heal all).' },

    { cat: 'stars', name: 'Bronze Stars', body: 'Combat troops earn bronze from kills. 3 bronze → 1 silver → 1 gold → veteran upgrade.' },
    { cat: 'stars', name: 'Specialist Ranks', body: 'Healers, Builders, and Couriers earn one star step per wave when they work (heal, build, dispatch).' },
    { cat: 'stars', name: 'Gold & Honor Names', body: 'At 3 gold stars, the Crown grants a name (e.g. Syr Gwyn) plus a veteran upgrade. Generals keep the name; stars reset and only improve command aura.' },
    { cat: 'stars', name: 'General Promotion', body: 'A 3-gold-star Footman can be promoted via General Academy — stats kept, stars reset for aura growth.' },

    { cat: 'eras', name: 'Tactical Points', body: 'TP is awarded each cleared wave (+8 base, scaling with wave & difficulty). Storage is uncapped. Settlements add bonus TP/round.' },
    { cat: 'eras', name: 'Territory (Every 10 Waves)', body: 'Map expands +90 wide, +110 deep. More room to build and defend.' },
    { cat: 'eras', name: 'Multi-Front (Every 25 Waves)', body: 'New attack flank until all four sides assault: North → East (25) → West (50) → South (75).' },
    { cat: 'eras', name: 'Academy Era (Wave 100)', body: 'Advanced academies unlock free training each round. TP deploy stays available at normal cost.' },
    { cat: 'eras', name: 'RTS Era (Wave 100+)', body: 'Enemy counts swell ~35%. Game shifts from line defense toward territory control — protect economy buildings.' },
    { cat: 'eras', name: 'Enemy RTS (Wave 200)', body: 'Map widens again. Enemies build hamlets and guilds that mirror your bonuses (+spawns). Siege everything.' },
    { cat: 'eras', name: 'Horde Waves (Every 5)', body: 'Waves 5, 15, 25… spawn faster swarms of goblins, rats, and orcs — slightly weaker individually but numerous. Every 15th horde (15, 45, 75…) embeds a siege tower and sappers. Waves 10, 20, 30… are named boss waves instead.' },
    { cat: 'eras', name: 'Day & Night Cycle', body: 'Day brings enemy assaults — visibility is best at dawn and fades toward dusk as the wave wears on. Night is prep: no spawns, +35% builder speed, and time to reposition. Bray Wyatt\'s lantern punishes enemy sight — especially in low light.' },
  ];

  function buildWweEntries() {
    const unlocked = typeof MetaProgress !== 'undefined' && MetaProgress.isWweUnlocked();
    const entries = [{
      cat: 'wwe',
      tease: !unlocked,
      name: unlocked ? 'WWE Academy' : '??? WWE Academy',
      body: unlocked
        ? `Secret roster unlocked. Build the Academy: ${WWE_ACADEMY_COST} TP, ${WWE_ACADEMY_BUILDERS} Builders (${WWE_ACADEMY_RECOMMENDED_HAMLETS}+ hamlets & ${WWE_ACADEMY_RECOMMENDED_GUILDS}+ guilds recommended). Click the completed academy to recruit Superstars.`
        : 'Scribes whisper of a squared circle hidden beyond the 316 Club milestone — one thousand achievements line the road, but the WWE Academy reveals itself at 316. Build costs are staggering: a thousand TP, ten builders, forty hamlets, ten guilds. Until then, these names are only rumors...',
    }];

    if (typeof WweDefs === 'undefined') return entries;

    for (const [id, def] of Object.entries(WweDefs)) {
      entries.push({
        cat: 'wwe',
        tease: !unlocked,
        name: unlocked ? def.name : `${def.name} (Rumor)`,
        body: unlocked
          ? `${def.abilityDesc} · Cost: ${def.cost} TP · HP ${def.hp} · DMG ${def.damage} · ACC ${def.accuracy} · SPD ${def.speed}`
          : (WWE_TEASE[id] || `Travelers mention ${def.name}, but no living commander has signed them yet.`),
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
        body: unlocked && def
          ? `Deploy for ${def.cost} TP. HP ${def.hp} · near-unkillable damage reduction. Heals half his missing health every 2 waves. Auto-abilities: Rip & Tear cleave when swarmed, Guardian heal when allies are pressed, mass cleave when hordes gather. His blade one-shots most foes — except in Hellscape.`
          : 'A figure in green armor, spoken of only after a commander survives wave 200 on Doomslayer difficulty. Cost: ten thousand TP. They say he heals from the abyss, ripostes entire hordes alone, and carries a sword that ends wars in one swing. Unlock him — or don\'t — and find out if the legends lie.',
      },
      {
        cat: 'doomslayer',
        tease: true,
        name: 'Rip & Tear',
        body: unlocked
          ? 'When four or more enemies close on the Doomslayer, he unleashes Rip & Tear — AoE devastation. Cooldown applies.'
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
        body: 'Beyond wave 1000, reality thins. Even the Doomslayer\'s legendary blade falters against hellscape-level threats — damage returns to mortal scale. Survive that far and you have seen the true endgame.',
      },
      {
        cat: 'doomslayer',
        tease: !unlocked,
        name: unlocked ? 'How to Unlock' : '??? How to Unlock',
        body: unlocked
          ? 'Reach wave 200 on Doomslayer difficulty in a single run — or discover another way in. The realm remembers how you unlocked him.'
          : 'Survive to wave 200 on the hardest named difficulty. Some say forbidden words exist somewhere outside the Crown\'s official records. The field manual does not say where.',
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
  };

  const CROSSOVER_FACTION_ORDER = [
    'ultimis', 'primis', 'halo', 'gears', 'lotr', 'baki', 'jojo', 'fotns', 'dragonball',
  ];

  /** [classified tease, unlocked flavor, optional field tip] */
  const CROSSOVER_HERO_LORE = {
    tank_dempsey: ['A gravel-voiced marine who solves every problem with frags first, questions never.', 'Tank Dempsey is the Ultimis breacher — high morale, steady melee DPS, and Frag Out bonus damage when enemies cluster. Put him where the horde is thickest.', 'Lead assaults into packed waves; pair with walls so Richtofen can work behind him.'],
    richtofen: ['Scribes mention a laughing doctor and green flashes that chain through elite ranks.', 'Edward Richtofen brings mad-science ranged DPS. Wunderwaffe chains lightning on elite hits — devastating from behind cover, fragile if caught in the open.', 'Garrison in outposts; never leave him exposed to assassins or warg riders.'],
    nikolai: ['A stocky soldier who drinks before battle and somehow gets harder to kill.', 'Nikolai Belinski is the Ultimis anchor — huge HP pool and Vodka Rage damage reduction when wounded. He outlasts waves other melee units cannot.', 'Place on the front line and let him soak siege pressure while allies heal.'],
    takeo: ['A disciplined swordsman said to strike faster after every star earned on the field.', 'Takeo Masaki is the Ultimis duelist — high speed and accuracy with Bushido crit scaling from veteran stars. Elite hunter and morale stabilizer.', 'Hunt dark knights and bosses; stars make him scarier over long campaigns.'],

    primis_tank: ['A harder, angrier version of a famous marine — reports end mid-grenade.', 'Primis Dempsey hits harder than his Ultimis self. Apothicon Slam cleaves on kill — excellent for cleaning up after wall breaks.', 'Push through breaches after sappers open lanes.'],
    primis_nikolai: ['Iron curtains and vodka — veterans swear he refuses to die.', 'Primis Nikolai is a premium tank with Iron Curtain — brief invulnerability below 35% HP. Best Primis frontliner for long waves.', 'Anchor your Primis line; let Curtain proc before pulling him back to heal.'],
    primis_takeo: ['Katana fury against wounded prey — same honor, sharper edge.', 'Primis Takeo is faster and deadlier than Ultimis Takeo. Katana Fury stacks rapid strikes on low-HP targets.', 'Finish elites and fleeing routed enemies.'],
    primis_richtofen: ['The doctor who steals life from elites to mend allies — classified.', 'Primis Richtofen is support-ranged: Summoning Key drains elite HP to heal nearby allies. Keep him behind Nikolai.', 'Focus fire elites in his lane to trigger sustain for your army.'],

    master_chief: ['A green-armored phantom who shields allies when the wave horn sounds.', 'Master Chief is the UNSC flagship — ranged DPS, high HP, Spartan Rage shields allies on wave start. Build around him as your ranged core.', 'Open every wave near your line; pair with Noble team buffs.'],
    noble_six: ['Lone wolf operative — stronger when the map around him is empty.', 'Noble Six excels at isolated flanks. Lone Wolf bonus damage when no allies are nearby — send him on hunt missions.', 'Hunt stragglers and back-line archers away from the main blob.'],
    sgt_johnson: ['Oorah echoes before the charge — morale spikes wherever he stands.', 'Sgt. Johnson is melee support — Oorah rally pulse and morale on wave start. Your army fights braver with him on field.', 'Deploy at wave start beside demoralized troops.'],
    noble_carter: ['Noble team leader — Spartans near him shoot straighter and fight longer.', 'Carter-A259 buffs nearby Spartans. Field him with Jorge, Kat, and Emile for Noble synergy.', 'Keep Carter mid-line so multiple Spartans catch Noble Leader.'],
    noble_kat: ['Tech specialist — enemy arrows miss more when she is on the battlefield.', 'Kat-B320 debuffs enemy accuracy in her aura. Tech Ops shuts down orc archer lanes.', 'Place opposite enemy ranged spawns.'],
    noble_emile: ['Energy sword, zero patience — melee finisher against wounded foes.', 'Emile-A239 is fast melee with Energy Sword executions on low HP. Screen him with Jorge or Chief.', 'Chase fleeing enemies and assassins; do not leave him alone in archer fire.'],
    noble_jorge: ['Heavy weapons never tire — every third shot splashes.', 'Jorge-052 is slow but devastating — Grenadier splash every third shot. Your anti-cluster ranged platform.', 'Put behind walls facing the widest enemy approach.'],
    noble_jun: ['Sniper cover from extreme range — elites drop before they reach the wall.', 'Jun-A266 has the longest Spartan range and bonus vs elites. Sniper Cover deletes dark knights.', 'Garrison outposts for maximum range extension.'],
    spartan_soldier: ['Standard-issue Spartan-IV — reliable, affordable ranged line-holder.', 'Spartan-IV is the budget UNSC recruit — steady ranged DPS without Noble drama. Fill gaps in your gun line.', 'Cheap ranged filler when TP is tight.'],

    marcus_fenix: ['Gruff COG veteran — chainsaw screams mean someone is about to die.', 'Marcus Fenix is the COG captain — Lancer Burst chainsaw finishers on low HP. Core of any Gears roster.', 'Center your gun line; Dom heals him when paired.'],
    dom_santiago: ['Brothers in arms — Marcus fights better when Dom is close.', 'Dom Santiago heals Marcus when nearby and brings Brothers in Arms sustain. Keep Dom within Marcus\'s screen.', 'Never split Dom from Marcus on hard waves.'],
    damon_baird: ['Sarcastic tech head — structures and siege towers fear him.', 'Damon Baird deals bonus damage vs siege and buildings. Tech Head makes him your anti-tower specialist.', 'Send Baird against siege towers and enemy hamlets.'],
    augustus_cole: ['The Cole Train has no brakes — charges through enemy lines.', 'Augustus Cole is heavy melee — Cole Train charges through formations. Flank when the line stalls.', 'Use on open maps after walls pin the horde.'],
    anthony_carmine: ['The Carmine curse is real — cheap, fragile, beloved.', 'Anthony Carmine is budget lancer support — fragile but affordable. Carmine Curse: do not expect him to survive focus fire.', 'Cheap ranged slot; replace when TP allows Clayton.'],
    clayton_carmine: ['Heavy weapons Carmine — suppression that shreds groups.', 'Clayton Carmine suppresses groups with Heavy Lancer fire. Tankier than Anthony with real DPS.', 'Backline suppressor behind Marcus.'],
    benjamin_carmine: ['Another Carmine — buffs his brothers when clustered.', 'Benjamin Carmine buffs other Carmines nearby. Carmine Brother synergy rewards fielding multiple Carmines.', 'Deploy with Anthony or Clayton for brotherhood buffs.'],
    cog_soldier: ['Standard COG recruit — lancer drill and discipline.', 'COG Soldier is the affordable Gears line-holder — Lancer Drill provides steady ranged DPS.', 'Fill the line when elites are handled elsewhere.'],

    aragorn: ['The king returned — Andúril hunts dark knights and elite armor.', 'Aragorn is elite-slaying melee with high morale. Andúril bonus vs elites and dark knights — your boss-wave answer.', 'Send Aragorn at war chiefs and dark knights.'],
    legolas: ['Elven archer — arrows from impossible range find fast prey.', 'Legolas is extreme-range DPS with bonus vs fast foes. Garrison outposts and watch towers for absurd reach.', 'Counter warg riders and assassins from safety.'],
    gimli: ['Nobody tosses a dwarf — axe cleave splashes siege targets.', 'Gimli is siege melee — Axe Cleave splashes on siege targets. Put him on walls facing towers.', 'Pair with sappers on structure-heavy waves.'],
    gandalf: ['You shall not pass — terror radiates from the grey wanderer.', 'Gandalf is support caster — You Shall Not Pass terrifies nearby enemies. Morale weapon and ranged bolt DPS.', 'Hold the center; enemies near him fight worse.'],
    frodo: ['Ring-bearer — small, evasive, lifts ally morale.', 'Frodo evades and spreads morale aura. Ring Bearer keeps fragile lines from breaking — not a fighter.', 'Keep Frodo behind the fellowship; let others tank.'],
    boromir: ['Horn of Gondor when surrounded — rally pulse turns desperation into steel.', 'Boromir rallies when surrounded — Horn of Gondor punishes enemies that blob on him.', 'Let him hold a choke; trigger rally when flanked.'],
    eowyn: ['I am no man — elite slayer with a grudge against bosses.', 'Éowyn is fast melee with No Man — devastating finisher vs elite foes. Send her at necromancers and war chiefs.', 'Hunt elites; she punches above her HP on finishers.'],

    baki_hanma: ['Demon Back awakens below half health — the son of the Ogre.', 'Baki Hanma spikes damage when wounded. Demon Back turns a losing duel into a reversal — risky but explosive.', 'Let him take some damage before expecting peak output.'],
    yujiro_hanma: ['The Ogre himself — near-boss tier, terrifying TP cost.', 'Yujiro Hanma is the Hanma nuke — near-boss HP and damage. The Ogre deletes melee targets; bankrupts careless commanders.', 'Save for boss waves; protect from ranged kiting.'],
    doppo_orochi: ['Karate precision — Goudou finishes wounded targets cleanly.', 'Doppo Orochi punishes wounded foes with Goudou precision strikes. Reliable second-line duelist.', 'Pair with Baki — soften targets, Doppo executes.'],
    jack_hanma: ['Bite first, talk never — bonus damage vs larger enemies.', 'Jack Hanma chews through bruisers — Bite bonus vs larger enemies. Strong vs trolls and siege.', 'Send Jack at trolls and tall elites.'],
    oliva_biscuit: ['Iron Body — American heavyweight who barely moves, barely bleeds.', 'Oliva Biscuit is ultra-tank melee with Iron Body damage reduction. Slower than Baki but nearly unmovable.', 'Hold a lane alone while strikers rotate.'],
    kaku_kaioh: ['Aiki counters reckless attackers — judo on a medieval map.', 'Kaku Kaioh counters reckless attackers with Aiki — punishes berserkers and warg riders.', 'Place where enemies charge your line.'],
    pickle: ['Primitive fury — prehistoric power, low morale, high carnage.', 'Pickle is raw prehistoric bruiser — Primitive Fury trades morale for devastation. Chaos unit for emergency holds.', 'Emergency line plug when TP allows a monster.'],

    jonathan_joestar: ['Gentleman fighter — Hamon Overdrive purges undead elites.', 'Jonathan Joestar is Part 1 melee — Hamon Overdrive bonus vs undead elites like necromancers.', 'Send at necromancer waves.'],
    dio_brando_p1: ['Vaporization Freeze — Part 1 Dio slows enemy morale.', 'Dio Brando (Pt.1) is fast melee that saps enemy morale with Vaporization Freeze.', 'Disrupt enemy morale while Jonathan holds the line.'],
    zeppeli: ['Sunlight Yellow heals allies when elites fall — Hamon teacher.', 'Will A. Zeppeli is Part 1 support — Sunlight Yellow heals allies on elite kill.', 'Keep near your kill lane to proc sustain.'],
    joseph_joestar_p2: ['Oh my God! Trick shots and Hermit Purple debuffs.', 'Joseph Joestar (Pt.2) is ranged trickster — Hermit Purple scouting debuffs and unpredictable damage.', 'Ranged harass behind walls.'],
    caesar_zeppeli: ['Bubble Cutter crits from range — Hamon bubbles find weak points.', 'Caesar Zeppeli is Part 2 ranged crit — Bubble Cutter rewards accurate shots.', 'Outpost garrison for crit fishing.'],
    stroheim: ['German science — bonus damage vs siege units.', 'Rudol von Stroheim is heavy ranged anti-siege — German Science shreds towers.', 'Counter siege tower waves.'],
    jotaro_kujo: ['ORA rush — Star Platinum pins elites and shreds them.', 'Jotaro Kujo is Part 3 melee powerhouse — Star Platinum ORA rush on pinned foes. Elite deletion.', 'Focus fire elites into Jotaro\'s lane.'],
    kakyoin: ['Hierophant Green — emerald splash AoE from safety.', 'Noriaki Kakyoin provides Part 3 ranged AoE — Emerald Splash hits clusters.', 'Behind walls vs grouped spawns.'],
    polnareff: ['Silver Chariot flurries wounded foes — fast melee skirmisher.', 'Jean Pierre Polnareff is speedy Part 3 melee — Silver Chariot flurries low HP targets.', 'Chase wounded routed enemies.'],
    avdol: ['Magician\'s Red — fire splash on every hit.', 'Mohammed Avdol is Part 3 support-ranged — Magician\'s Red fire splash chips groups.', 'Mid-line fire support.'],
    josuke_higashikata: ['Crazy Diamond — heals allies he passes on the march.', 'Josuke Higashikata is Part 4 support — Crazy Diamond heals allies in his path. Move him through wounded troops.', 'March Josuke through retreating allies.'],
    okuyasu: ['The Hand erases space — burst single-target deletion.', 'Okuyasu Nijimura is Part 4 bruiser — The Hand erases space for burst damage. Simple, violent, effective.', 'Point at high-priority single targets.'],
    rohan_kishibe: ['Heaven\'s Door — debuffs enemy accuracy from range.', 'Rohan Kishibe is Part 4 ranged debuffer — Heaven\'s Door ruins enemy accuracy.', 'Opposite enemy archer lanes.'],
    kira_yoshikage: ['Killer Queen — Bites the Dust on wounded prey.', 'Yoshikage Kira executes wounded foes with Killer Queen — quiet, lethal Part 4 finisher.', 'Mop up after your line softens the wave.'],
    giorno_giovanna: ['Gold Experience — heals allies on kill.', 'Giorno Giovanna is Part 5 support — Gold Experience heals on kill. Passione sustain engine.', 'Keep in active kill zones.'],
    bruno_bucciarati: ['Sticky Fingers — zip reposition and rally allies.', 'Bruno Bucciarati rallies and repositions with Sticky Fingers — high morale leader.', 'Use for pep-talk positioning before pushes.'],
    guido_mista: ['Sex Pistols ricochet — one shot, several targets.', 'Guido Mista\'s Sex Pistols ricochet hits multiple foes — Part 5 ranged multitarget.', 'Counter spread formations.'],
    diavolo: ['King Crimson — deletes wounded targets from time.', 'Diavolo is Part 5 assassin — King Crimson removes wounded enemies. Expensive but decisive.', 'Elite and assassin hunter.'],
    jolyne_cujoh: ['Stone Free strings slow enemies — Part 6 control melee.', 'Jolyne Cujoh slows with Stone Free — Part 6 control fighter.', 'Hold chokepoints while allies DPS.'],
    weather_report: ['Weather Stand — AoE lightning pressure from range.', 'Weather Report is Part 6 ranged AoE — lightning pressure across lanes.', 'Wide map AoE supplement.'],
    ermes_costello: ['Kiss duplicates pressure — elite kills spawn more pain.', 'Ermes Costello stacks pressure with Kiss — elite kills duplicate harassment.', 'Elite-heavy waves.'],
    johnny_joestar: ['Tusk ACT4 — Steel Ball Run cavalry with infinite rotation finisher.', 'Johnny Joestar is Part 7 cavalry — Tusk ACT4 charge finisher. Fastest JoJo hunter on expanded maps.', 'Hunt on wide territory; needs open lanes.'],
    gyro_zeppeli: ['Steel Ball golden spin — ranged cavalry cleave on charge.', 'Gyro Zeppeli is Part 7 ranged cavalry — Steel Ball cleave on charge. Tag-team with Johnny.', 'Pair with Johnny for SBR hunt missions.'],
    diego_brando: ['Scary Monsters — predatory charge damage.', 'Diego Brando is Part 7 fast cavalry — Scary Monsters predatory charges. Aggressive hunter.', 'Flank and hunt; high speed, lower morale.'],
    lucy_steel: ['Ticket to Ride — support cavalry rally aura.', 'Lucy Steel is Part 7 support cavalry — Ticket to Ride rally aura for mounted allies.', 'Ride with Johnny and Gyro for morale.'],

    kenshiro: ['You are already dead — Hokuto Shinken finisher legend.', 'Kenshiro is the Hokuto successor — ATATATA finisher on low HP. Elite and bruiser executioner.', 'Focus fire until finisher range.'],
    raoh: ['Ken-Oh — terror aura and siege bonus. The conqueror walks.', 'Raoh is slow but terrifying — Ken-Oh aura and siege bonus. Boss-tier melee presence.', 'Boss waves and structure pushes.'],
    toki: ['Hakke Shou heals allies in aura — gentle fist, iron will.', 'Toki heals allies in aura with Hakke Shou — mandatory Hokuto support.', 'Center your melee blob on Toki.'],
    rei: ['Nanto Suichō Ken — fast strikes hit multiple foes.', 'Rei is fast multi-hit melee — Nanto Suichō Ken cleaves several targets.', 'Counter fast enemy swarms.'],
    jaggi: ['Dirty tricks — debuffs enemy morale on every hit.', 'Jagi fights dirty — morale debuffs on hit. Chaos agent, low morale himself.', 'Disrupt enemy morale lines.'],
    shin: ['Nanto Hakuro Ken — heavy single-target blows.', 'Shin delivers Nanto Hakuro heavy single-target blows — mini-boss duelist.', 'Point at high-HP single targets.'],

    goku: ['Kamehameha when surrounded — Saiyan burst finisher.', 'Goku is balanced melee carry — Kamehameha burst when surrounded. Reliable Z-Fighter anchor.', 'Let him get surrounded for finisher proc.'],
    vegeta: ['Galick Gun pride — bonus vs elites when honor demands.', 'Vegeta is elite-hunting melee — Galick Gun bonus vs elites. Pride damage spike.', 'Send Vegeta at elite waves.'],
    piccolo: ['Special Beam Cannon pierces high-HP targets from range.', 'Piccolo is support-ranged — Special Beam pierces tanks. Beam sniper.', 'Focus fire high-HP targets in his lane.'],
    gohan: ['Hidden Potential — massive spike below 40% HP.', 'Gohan explodes when wounded — Hidden Potential below 40% HP. Let him get low, then watch.', 'Risky anchor — heal after spike.'],
    trunks: ['Burning Attack — ranged burst finisher from the future.', 'Trunks is ranged burst — Burning Attack finisher at distance.', 'Backline finisher behind tanks.'],
    frieza: ['Death Beam — precision ranged execution.', 'Frieza is cold ranged execution — Death Beam picks off wounded targets.', 'Sniper from outposts.'],
    cell: ['Perfect Form — heals on kill, sustains through long waves.', 'Cell heals on kill with Perfect Form — sustain melee that grows stronger.', 'Long waves where kills chain.'],
    beerus: ['Hakai — god-tier delete on wounded foes. Expensive annihilation.', 'Beerus is the ultimate Z-Fighter — Hakai deletes wounded enemies. God-tier cost for god-tier waves.', 'Save for boss waves; protect from focus fire.'],
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
    };
    return checks[factionId]?.() ?? false;
  }

  function defaultHeroTip(def) {
    if (def.type === 'cavalry' || def.jojoPart === 7) return 'Cavalry — use hunt mode on wide maps after territory expands.';
    if (def.combatTag === 'ranged') return 'Backline DPS — garrison outposts for extended range.';
    if (def.combatTag === 'support') return 'Support — keep near your core army for auras and procs.';
    return 'Melee — screen with walls and pair with healers or med tent retreats.';
  }

  function formatCrossoverStats(def) {
    const role = `${def.combatTag} ${def.type}`;
    const part = def.jojoPart === 7 ? ' · Steel Ball Run cavalry' : def.jojoPart ? ` · JoJo Part ${def.jojoPart}` : '';
    return `${role}${part} · ${def.cost} TP · HP ${def.hp} · DMG ${def.damage} · ACC ${def.accuracy} · SPD ${def.speed}`;
  }

  function buildCrossoverHeroBody(id, def, unlocked) {
    const lore = CROSSOVER_HERO_LORE[id];
    const tease = lore?.[0] || `Travelers whisper of ${def.name}, but no signed contract exists in the Crown's ledgers.`;
    const flavor = lore?.[1] || `${def.name} deploys as ${def.combatTag} ${def.type}.`;
    const tip = lore?.[2] || defaultHeroTip(def);
    if (!unlocked) return tease;
    let body = `${flavor}\n\n${def.abilityDesc}\n\n${formatCrossoverStats(def)}\n\nTip: ${tip}`;
    if (id === 'takeo') body += '\n\nIn memory of Takeo\'s voice actor — thank you for the laughs.';
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
      return {
        cat,
        tease: true,
        name: `${label} (Classified)`,
        body: prof?.lore
          ? `${prof.lore} Build the faction barracks, discover the unlock code, then recruit from Crossover HQ. The Crown has redacted roster details until you sign them.`
          : `Classified operatives from another world. Unlock their roster, build their barracks on the field, then recruit via Crossover HQ.`,
      };
    }

    const buildLine = bdef
      ? `Build ${bdef.name} (${bdef.cost} TP, ${bdef.requiresBuilders || 3} Builders) on the battlefield, then open Crossover HQ to recruit.`
      : 'Build the faction barracks on the field, then recruit from Crossover HQ.';
    const play = prof?.playstyle ? `Playstyle: ${prof.playstyle}` : '';
    const weak = prof?.weakness ? `Weakness: ${prof.weakness}` : '';
    return {
      cat,
      name: `${label} Roster`,
      body: [prof?.lore || `${label} operatives ready for deployment.`, prof?.identity || '', buildLine, play, weak].filter(Boolean).join('\n\n'),
    };
  }

  function buildCrossoverEntries() {
    const entries = [
      {
        cat: 'crossover_meta',
        name: 'Crossover HQ',
        body: 'Warriors from other worlds sign on through Crossover HQ. Each faction needs its barracks completed on the field before recruits deploy. Unlock rosters via secret codes (the Crown does not publish them here), earn mastery from kills and ability procs, and mix factions carefully — fielding too many crossover operatives at once incurs a soft damage penalty.',
      },
      {
        cat: 'crossover_meta',
        name: 'How to Recruit',
        body: '1) Unlock the faction roster. 2) Build that faction\'s barracks with your Builder. 3) Open Crossover HQ from the HUD. 4) Pay TP to deploy operatives onto the rally line. Signed operatives appear in your Legacy roll. Perk-a-Cola machines unlock after any secret roster (WWE, Doomslayer, or crossover) is active.',
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
      { cat: 'perks', name: 'Perk-a-Cola System', body: 'Build machines after unlocking a secret roster (WWE, Doomslayer, or crossover heroes). Eligible units collect perks during night prep — up to 4 perks based on stars earned. Each perk favors melee, ranged, or support tags.' },
      { cat: 'perks', name: 'Jugger-Nog', body: 'Melee & support — +35% max HP.' },
      { cat: 'perks', name: 'Quick Revive', body: 'Support — self-revive once per wave at 40% HP.' },
      { cat: 'perks', name: 'Speed Cola', body: 'Melee & ranged — faster attacks.' },
      { cat: 'perks', name: 'Stamin-Up', body: 'Melee & ranged — faster movement.' },
      { cat: 'perks', name: 'Deadshot Daiquiri', body: 'Ranged only — +22 accuracy.' },
      { cat: 'perks', name: 'Elemental Pop', body: 'Ranged & melee — splash damage on hits.' },
      { cat: 'perks', name: 'PhD Flopper', body: 'Melee only — explosion immunity.' },
      { cat: 'perks', name: 'Melee Macchiato', body: 'Melee only — +28% melee damage.' },
      { cat: 'perks', name: 'Vulture Aid', body: 'Ranged & support — kills may grant +1 TP.' },
      { cat: 'perks', name: 'Tombstone', body: 'General only — each night resurrects fallen troops equal to total bronze-star count (3 gold stars = 27 resurrections per wave).' },
    ];
  }

  function buildCreativeEntries() {
    return [
      { cat: 'creative', name: 'Creative Lab', body: 'Sandbox mode from the main menu. Press P in-game for the lab panel. Achievements are disabled by default; sandbox stats track separately in local storage. Toggle "campaign rules" to practice with real TP costs and miss limits.' },
      { cat: 'creative', name: 'Wave Composer', body: 'Type enemy lists like goblin*10, orc*5, war_chief*1 then Queue and Launch. Custom intervals control spawn pacing for balance tests.' },
      { cat: 'creative', name: 'Scenario Templates', body: 'Pre-built drills: Siege Drill, Boss Rush, Horde Stress, Wall Defense, Academy Era, and more. Load a template to populate allies, buildings, and custom waves instantly.' },
      { cat: 'creative', name: 'Stress & Perf', body: 'Start Horde spawns enemies from map edges until a cap — pair with F3 perf overlay to profile FPS, pathfinding, and heap usage.' },
      { cat: 'creative', name: 'Export / Import', body: 'Export scenarios or session replays as JSON. Paste into the import box to share setups with other designers or restore a snapshot.' },
    ];
  }

  function getAllEntries() {
    const loreExpanded = typeof LoreData !== 'undefined'
      ? LoreData.getExpandedEntries()
      : [...BASE_ENTRIES];
    const factionLore = typeof FactionDepth !== 'undefined'
      ? FactionDepth.getEncyclopediaEntries()
      : [];
    const chronicles = typeof Chronicles !== 'undefined'
      ? Chronicles.getEncyclopediaEntries()
      : [];
    const legacy = typeof Legacy !== 'undefined'
      ? Legacy.getLegacyEntries()
      : [];
    return [
      ...loreExpanded,
      ...factionLore,
      ...buildWweEntries(),
      ...buildDoomslayerEntries(),
      ...buildCrossoverEntries(),
      ...buildPerkEntries(),
      ...chronicles,
      ...legacy,
      ...buildCreativeEntries(),
    ];
  }

  function renderEntryBody(e) {
    const bodyHtml = (e.body || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
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
        parts.push(`<div class="ency-classified"><span class="ency-classified-label">CLASSIFIED</span>${e.classified}</div>`);
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
      parts.push(`<div class="ency-chronicle-meta">${e.chronicleType === 'run' ? 'Campaign' : 'Wave'} · ${e.chronicleMeta}</div>`);
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

    tabs.innerHTML = CATEGORIES.map(c => `
      <button class="ency-tab ${c.id === activeCat ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>
    `).join('');

    tabs.querySelectorAll('.ency-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioEngine?.SFX?.click?.();
        activeCat = btn.dataset.cat;
        renderPanel();
      });
    });

    const entries = getAllEntries();
    const q = searchQuery.trim().toLowerCase();
    let filtered = entries.filter(e => e.cat === activeCat);
    if (q) {
      filtered = entries.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.cat.toLowerCase().includes(q)
      );
    }
    list.innerHTML = filtered.length ? filtered.map(e => `
      <div class="ency-entry ${e.tease ? 'ency-tease' : ''} ${e.cat === 'bestiary' ? 'ency-bestiary' : ''}">
        <div class="ency-entry-name">${e.name}</div>
        ${renderEntryBody(e)}
      </div>
    `).join('') : '<p class="ency-empty">No entries in this category.</p>';
  }

  function refreshData() {
    if (typeof MetaProgress !== 'undefined') MetaProgress.load();
    if (typeof Legacy !== 'undefined') Legacy.load();
    if (typeof Chronicles !== 'undefined') Chronicles.load();
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
    document.getElementById('pause-encyclopedia-btn')?.addEventListener('click', () => open({ fromPause: true }));
    document.getElementById('encyclopedia-close')?.addEventListener('click', () => close());
    document.getElementById('encyclopedia-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPanel();
    });
  }

  return { init, open, close, isOpen, togglePanel, renderPanel, getAllEntries };
})();