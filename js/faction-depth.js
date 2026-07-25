/**
 * Crossover faction depth — identity, synergies, balance, mastery, seasonal events.
 */
/**
 * Crossover faction identity, synergies, mastery, and ability combat hooks.
 * @class FactionDepthSystem
 * @see FactionDepth — singleton used by crossover/game systems
 *
 * API:
 * - bind(ctx) — wire game context (units, combat helpers, svc/service locator)
 * - PROFILES / ENEMY_COUNTERS — static faction data; SYNERGIES from GameData
 * - getProfile / getSeasonalEvents / getMasteryTier — faction meta
 * - computeSynergies / applyToUnit / modifyDamage — field bonuses
 * - processAbilityHit / onWaveStart — ability proc pipeline
 * - modifyBuildingDamage / isPlanetSiegeSpecialist — Planet Warfare hooks
 * - getEncyclopediaEntries / auditFairRepresentation — content & balance
 */
class FactionDepthSystem {
  static FIELD_SOFT_CAP = 14;

  /** Each additional synergy on the same stat applies at this fraction of the prior. */
  static SYNERGY_DECAY = 0.72;

  /** Distinct evolved factions on field before logistics/combat tax kicks in. */
  static FACTION_SOUP_THRESHOLD = 4;

  static EARLY_WAVE_COST_BONUS = 1;

  static EARLY_WAVE_CAP = 0;

  static STANDARD_BARRACKS_COST = 90;

  static STANDARD_BARRACKS_BUILDERS = 2;

  static PROFILES = {
    wwe: {
      label: 'Grand Coliseum Champions',
      building: 'wwe_academy',
      palette: ['#c04040', '#ffd700'],
      identity: 'Showmanship morale bombs, elite finishers, and tag-team aura.',
      weakness: 'High TP cost; vulnerable to sustained ranged pressure before power-up finishers.',
      weaknessMods: { vsFlying: 0.9, damageTakenRanged: 1.12 },
      playstyle: 'Deploy 2–4 for morale spikes; save finishers for elite waves.',
      lore: 'Beyond the arena gates march champions who trade steel for glory — every siege is a main event and the crowd roars through every clash.',
      sfx: 'wwe',
      requiresWave: 0,
      requiresBuilders: 10,
      masteryTitle: ['Arena Fan', 'Crowd Favorite', 'Coliseum Legend', 'Grand Champion'],
    },
    doom: {
      label: 'Abyss Walker',
      building: null,
      palette: ['#40c040', '#1a3018'],
      identity: 'Single-entity apocalypse — rip, heal, and endure on the Hellbreaker path.',
      weakness: 'Extreme TP cost; hellscape (wave 1001+) normalizes his damage.',
      playstyle:
        'Unlock via Hellbreaker difficulty wave 200; let him anchor, not replace your army.',
      lore: 'They say he walked out of the deepest abyss, blade humming with the wrath of every soul left behind.',
      sfx: 'doom',
      masteryTitle: ['Walker', 'Abyss Hunter', 'Hellbreaker', 'Icon of Wrath'],
    },
    ultimis: {
      label: 'Void Residue Crew',
      building: 'element_barracks',
      palette: ['#c06030', '#8040a0'],
      identity: 'Mad science squad — frags, chain-lightning weapons, fortitude tanking.',
      weakness: 'Arcane specialist is fragile; clustered undead overwhelm without walls.',
      // vsSwarm is damage-taken mult — >1 means weaker vs swarms (not a buff).
      weaknessMods: { vsUndead: 0.88, vsSwarm: 1.12, damageTakenRanged: 1.08 },
      playstyle: 'Brawler anchors front; scientist behind walls; scout hunts elites.',
      lore: 'Four madmen bound by void residue and worse — the original crew that first cracked the multiverse.',
      sfx: 'ultimis',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Residue Recruit', 'Bunker Veteran', 'Ascension Runner', 'Moon Operator'],
    },
    primis: {
      label: 'First Circle',
      building: 'primis_shrine',
      palette: ['#d07040', '#9040c0'],
      identity: 'Upgraded aether knights — slams, barrier curtains, summoning keys.',
      weakness: 'Premium TP; needs shrine investment before spamming recruits.',
      weaknessMods: { vsArcane: 0.9, vsUndead: 0.92 },
      playstyle: 'Barrier tank anchors the line; elite drain specialist heals from fallen foes.',
      lore: "The corrected timeline's warriors — same souls, sharper blades, heavier sins.",
      sfx: 'primis',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      recommendedHamlets: 1,
      masteryTitle: ['Circle Initiate', 'Keeper', 'Void Scholar', 'Cycle Breaker'],
    },
    halo: {
      label: 'Orbital Vanguard',
      building: 'spartan_academy',
      palette: ['#408040', '#80c0ff'],
      identity: 'Shielded ranged core — battle fury, fireteam teamwork, tech debuffs.',
      weakness: 'Melee-only operatives must be screened; expensive academy.',
      weaknessMods: { vsMeleeRush: 0.92, damageTakenMelee: 1.1 },
      playstyle: 'Heavy gunner + sniper backline; commander buffs; sergeant rally on wave start.',
      lore: 'Orbital fireteams dropped into medieval hell — powered armor against goblin steel.',
      sfx: 'halo',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Recruit', 'Vanguard', 'Fireteam', 'Strike Commander'],
    },
    gears: {
      label: 'Iron Trench Coalition',
      building: 'cog_academy',
      palette: ['#506080', '#c04040'],
      identity: 'Lancer discipline — chainsaw finishers, brotherhood bonds, siege busting.',
      weakness: 'Light infantry are fragile; needs veteran anchor for brotherhood synergy.',
      weaknessMods: { vsFlying: 0.9, vsBerserker: 0.9, damageTakenRanged: 1.08 },
      playstyle: 'Veteran + partner core; engineer for towers; bruiser flanks.',
      lore: 'The coalition brought chainsaws to a sword fight. The tunnel horde was already here, wearing goblin faces.',
      sfx: 'gears',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Trencher', 'Tunnel Killer', 'Siege Veteran', 'Last Bastion'],
    },
    lotr: {
      label: 'Ninefold March',
      building: 'rivendell_camp',
      palette: ['#406050', '#c0a040'],
      identity: 'March aura — wizard terror, archer range, king-slayer elite pressure.',
      weakness: 'Scout is soft; expensive camp; slow to field full march.',
      weaknessMods: { vsAssassin: 0.88, damageTakenStealth: 1.12, vsFlying: 0.92 },
      playstyle: 'Wizard mid; archer garrison; axe-fighter on siege waves.',
      lore: 'From the last hidden camp march nine heroes who will not let the realm fall again.',
      sfx: 'lotr',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Marcher', 'Ninefold Bond', 'Relic Bearer', 'Crown Returned'],
    },
    baki: {
      label: 'Iron Pit Guild',
      building: 'hanma_dojo',
      palette: ['#c04040', '#606060'],
      identity: 'Pure melee monsters — demon-back surge, titan deletes, iron bodies.',
      weakness: 'No ranged; kited by harpies and mages; apex predator drains TP.',
      weaknessMods: { vsFlying: 0.8, vsRanged: 0.88, damageTakenRanged: 1.15 },
      playstyle: 'Striker + mentor line; bruiser tanks; apex predator for boss waves only.',
      lore: 'The iron pit guild treats your siege as another round of brutal conditioning.',
      sfx: 'baki',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Pit Novice', 'Fighter', 'Champion', 'Titan Slayer'],
    },
    jojo: {
      label: 'Bound Spirit Court',
      building: 'stand_arrow_shrine',
      palette: ['#8040a0', '#e0c040'],
      identity: 'Spirit-bound operatives across eras — ripple arts, rush finishers, cavalry duels.',
      weakness: 'Cavalry operatives need space; ripple arts weak vs necromancer hordes without walls.',
      weaknessMods: { vsUndead: 0.85, vsNecromancer: 0.88, damageTakenRanged: 1.1 },
      playstyle: 'Mix eras for tags; pin specialist locks elites; cavalry pair hunts on wide maps.',
      lore: 'A spirit-binding shrine on your battlefield? Fate is bizarre, and the waves are stranger.',
      sfx: 'jojo',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Spirit Bound', 'Court Acolyte', 'Bound Duelist', 'Grand Circuit'],
    },
    fotns: {
      label: 'North Star Ascetics',
      building: 'north_star_dojo',
      palette: ['#4080c0', '#c0c0e0'],
      identity: 'Pressure-point arts — rapid finishers, healer sustain, warlord terror.',
      weakness: 'Melee only; warlord is slow; needs healer support for sustain.',
      weaknessMods: { vsFlying: 0.82, vsRanged: 0.9, damageTakenRanged: 1.12 },
      playstyle: 'Successor on elites; healer aura; swift hunter chases fast foes.',
      lore: 'The north star dojo teaches your foes the same lesson — fate was sealed three breaths ago.',
      sfx: 'fotns',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Ascetic Student', 'Successor', 'Master', 'Warlord'],
    },
    dragonball: {
      label: 'Skyburst Order',
      building: 'capsule_corp',
      palette: ['#e06040', '#4060c0'],
      identity: 'Skyburst carries — beam finishers, pride spikes, perfect-form sustain.',
      weakness: 'Burst specialists need TP runway; apex destroyer is god-tier cost.',
      weaknessMods: { vsArcane: 0.88, vsAssassin: 0.9, damageTakenStealth: 1.1 },
      playstyle: 'Twin strikers core; support beams from the rear; save apex destroyer for bosses.',
      lore: 'Skyburst logistics on a medieval map — because raw power demands supply lines.',
      sfx: 'dragonball',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Order Initiate', 'Ascendant', 'Skyburst Master', 'Void Eraser'],
    },
    imperium: {
      label: 'Crimson Legions',
      building: 'astartes_chapel',
      palette: ['#4060a0', '#802030'],
      identity: 'Volleygun legions — commissar executions, heavy-armor anchors, walker siege.',
      weakness: 'Slow heavy armor; expensive chapel; weak to swarm flanks before walls set.',
      weaknessMods: { vsSwarm: 1.12, vsAssassin: 0.9, damageTakenStealth: 1.1 },
      playstyle: 'Captain + Librarian backline; heavy-armor anchors; Commissar for morale.',
      lore: 'Crimson chapels on your map — transhuman warriors who treat goblins as heretics.',
      sfx: 'imperium',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Initiate', 'Legionnaire', 'Captain', 'Chapter Master'],
    },
    crystal: {
      label: 'Crystal Vanguard',
      building: 'crystal_sanctum',
      palette: ['#5080c0', '#c04060'],
      identity: 'Classic party comp — black/white magic, dragoon jumps, limit bursts.',
      weakness: 'Mages are fragile; dragoon needs space; limit striker must take damage first.',
      weaknessMods: { vsMeleeRush: 0.9, damageTakenMelee: 1.1, vsFlying: 0.95 },
      playstyle: 'Soldier of Light front; White Mage mid; Black Mage + Summoner backline.',
      lore: 'Crystal light answered your siege horn — aether heroes from another age of war.',
      sfx: 'crystal',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Recruit', 'Warrior', 'Hero', 'Crystal Champion'],
    },
    warp: {
      label: 'Rift Cult',
      building: 'warp_shrine',
      palette: ['#802040', '#6040c0'],
      identity: 'Chaos warband — warp bolts, plague curses, possessed fire, blood pacts.',
      weakness: 'Low morale baseline; cultists break fast; risky without imperium-style anchors.',
      weaknessMods: { vsArcane: 0.9, damageTakenRanged: 1.1, vsNecromancer: 0.88 },
      playstyle: 'Champion + Daemon Knight front; Magus backline; Cultist debuff aura.',
      lore: 'A warp shrine tears reality — heretics who would rather burn the map than lose it.',
      sfx: 'warp',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Cultist', 'Champion', 'Warlord', 'Dark Apostle'],
    },
    tes: {
      label: 'Voicebound Pact',
      building: 'dragon_moot',
      palette: ['#4068a0', '#a06040'],
      identity: 'Dragon-touched heroes, voice shouts, and prophecy-bound battlemages.',
      weakness: 'Expensive roster; voice champion must be protected; shouts cost TP.',
      weaknessMods: { vsAssassin: 0.9, damageTakenStealth: 1.12, vsSwarm: 1.1 },
      playstyle: 'Voice champion + elder sage core; diversify Eternal Paths for the legacy trial.',
      lore: 'A dragon moot hall answers your horn — voice-bound sages and chosen heroes walk between worlds.',
      sfx: 'tes',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Wanderer', 'Voice Adept', 'Dragon-Touched', 'Pact Champion'],
    },
  };

  static PLANET_WARFARE_WAVE = typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200;

  static PLANET_WARFARE_OPERATIVES = {
    tech_head: {
      label: 'Tech Head',
      operative: 'Baird',
      faction: 'gears',
      siegeMult: 2.25,
      settlementMult: 1.45,
      desc: 'COG tech sabotage — bonus damage vs enemy settlements and siege engines.',
    },
    axe_cleave: {
      label: 'Axe Cleave',
      operative: 'Stone Axe Lord',
      faction: 'lotr',
      siegeMult: 2.15,
      settlementMult: 1.35,
      splashRadius: 55,
      splashMult: 0.28,
      desc: 'Dwarven demolition — cleave splashes to nearby enemy holds.',
    },
    german_science: {
      label: 'Iron Science',
      operative: 'Stroheim',
      faction: 'jojo',
      siegeMult: 1.95,
      outpostMult: 1.55,
      desc: 'Superior engineering — devastates trade posts, quarries, and siege towers.',
    },
    lancer_burst: {
      label: 'Lancer Burst',
      operative: 'Marcus Ironhart',
      faction: 'gears',
      siegeMult: 2.05,
      finisherHp: 0.35,
      finisherMult: 2.15,
      desc: 'Chainsaw raze — executes wounded enemy structures in the north.',
    },
    hokuto_kaioh: {
      label: 'Ken-Oh Terror',
      operative: 'Raoh',
      faction: 'fotns',
      siegeMult: 1.88,
      hamletMult: 1.42,
      desc: 'Imperial pressure — extra damage vs enemy hamlets and guilds.',
    },
    kamehameha: {
      label: 'Skyburst Wave',
      operative: 'Kael Skyburst',
      faction: 'dragonball',
      siegeMult: 1.78,
      splashRadius: 72,
      splashMult: 0.34,
      desc: 'Wave-clearing blast — AoE building damage when striking northern holds.',
    },
    hakai: {
      label: 'Cataclysm',
      operative: 'Cataclysm Lord',
      faction: 'dragonball',
      siegeMult: 1.65,
      deleteHp: 0.25,
      deleteMult: 2.6,
      desc: 'God of Destruction — obliterates structures below 25% HP.',
    },
    weather_stand: {
      label: 'Storm Caller',
      operative: 'Storm Caller',
      faction: 'jojo',
      siegeMult: 1.72,
      splashRadius: 62,
      splashMult: 0.24,
      desc: 'Storm front — lightning arcs to adjacent enemy economy sites.',
    },
    grenadier: {
      label: 'Grenadier',
      operative: 'Heavy Gunner',
      faction: 'halo',
      siegeMult: 1.92,
      everyNth: 3,
      splashRadius: 52,
      splashMult: 0.32,
      desc: 'Explosive ordnance — every third strike splashes clustered outposts.',
    },
    special_beam: {
      label: 'Special Beam Cannon',
      operative: 'Namek Sage',
      faction: 'dragonball',
      siegeMult: 1.88,
      heavyHp: 300,
      heavyMult: 1.48,
      desc: 'Piercing beam — bonus vs high-HP enemy fortifications.',
    },
    energy_sword: {
      label: 'Plasma Blade',
      operative: 'Ember Operative',
      faction: 'halo',
      siegeMult: 1.82,
      academyMult: 1.52,
      desc: 'Academy breach — shredded damage vs shadow and war academies.',
    },
    cole_train: {
      label: 'Iron Charge',
      operative: 'Cole',
      faction: 'gears',
      siegeMult: 1.76,
      chargeBonus: 0.28,
      desc: 'Run-through demolition — bonus while charging enemy lines in the north.',
    },
    autocannon: {
      label: 'Autocannon',
      operative: 'Dreadnought',
      faction: 'imperium',
      siegeMult: 2.1,
      settlementMult: 1.4,
      desc: 'Walking tank — bonus damage vs enemy settlements and siege engines.',
    },
    firaga: {
      label: 'Firaga',
      operative: 'Black Mage',
      faction: 'crystal',
      siegeMult: 1.82,
      splashRadius: 58,
      splashMult: 0.3,
      desc: 'Aether firestorm — AoE building damage when striking northern holds.',
    },
    warp_bolt: {
      label: 'Warp Bolt',
      operative: 'Warp Magus',
      faction: 'warp',
      siegeMult: 1.7,
      splashRadius: 48,
      splashMult: 0.26,
      desc: 'Chaos arc — secondary bolt splashes adjacent enemy economy sites.',
    },
  };

  static ENEMY_COUNTERS = {
    necromancer: {
      weakFactions: ['jojo', 'primis', 'ultimis'],
      mult: 1.22,
      note: 'Undead resist hamon and aether — field walls!',
    },
    shaman: {
      weakFactions: ['fotns', 'baki'],
      mult: 1.16,
      note: 'Enemy healers blunt martial burst.',
    },
    harpy: {
      weakFactions: ['baki', 'fotns', 'wwe', 'halo', 'lotr'],
      mult: 1.14,
      note: 'Flyers kite melee-heavy rosters.',
    },
    sky_drake: {
      weakFactions: ['gears', 'lotr', 'baki', 'fotns'],
      mult: 1.14,
      note: 'Anti-air evolved allies help (orbital, skyburst).',
    },
    war_chief: {
      weakFactions: ['ultimis'],
      mult: 1.1,
      note: 'Boss elites punish reckless 115 rushes.',
    },
    assassin: {
      weakFactions: ['halo', 'dragonball', 'lotr', 'tes'],
      mult: 1.14,
      note: 'Stealth elites pressure ranged carries.',
    },
    dark_mage: {
      weakFactions: ['dragonball', 'primis', 'jojo'],
      mult: 1.12,
      note: 'Arcane shields blunt ki and aether bursts.',
    },
    troll: {
      weakFactions: ['ultimis', 'primis'],
      mult: 1.12,
      note: 'Brute hordes overwhelm mad-science squads.',
    },
    berserker: {
      weakFactions: ['gears', 'lotr', 'halo'],
      mult: 1.12,
      note: 'Berserkers rush disciplined lines.',
    },
    goblin_sapper: {
      weakFactions: ['halo', 'gears'],
      mult: 1.1,
      note: 'Sappers target modern war machines.',
    },
    warg_rider: {
      weakFactions: ['baki', 'fotns', 'lotr', 'wwe'],
      mult: 1.1,
      note: 'Fast cavalry flanks melee-only rosters.',
    },
    bone_summoner: {
      weakFactions: ['crystal', 'imperium'],
      mult: 1.12,
      note: 'Undead summoners resist aether smites and warp curses.',
    },
    dark_knight: {
      weakFactions: ['warp', 'crystal', 'imperium'],
      mult: 1.1,
      note: 'Elite armor tests transhuman and aether finishers.',
    },
  };

  static MASTERY_CHALLENGES = [
    {
      id: 'wwe_show',
      faction: 'wwe',
      name: 'Grand Bout',
      desc: 'Clear wave 30 with 4+ coliseum on field.',
      wave: 30,
      minField: 4,
    },
    {
      id: 'halo_noble',
      faction: 'halo',
      name: 'Wolf Pack',
      desc: 'Clear wave 40 with 3+ orbital operatives, 0 ally losses.',
      wave: 40,
      minField: 3,
      flawless: true,
    },
    {
      id: 'lotr_fellowship',
      faction: 'lotr',
      name: 'Nine Walkers',
      desc: 'Field 5+ LOTR operatives at once.',
      minField: 5,
    },
    {
      id: 'jojo_sbr',
      faction: 'jojo',
      name: 'Golden Ball Run',
      desc: 'Field 2+ Part 7 cavalry operatives.',
      flag: 'jojo_cavalry',
    },
    {
      id: 'db_zenkai',
      faction: 'dragonball',
      name: 'Zenkai Boost',
      desc: 'Score 200 lifetime DB kills.',
      kills: 200,
    },
    {
      id: '115_moon',
      faction: 'ultimis',
      name: 'Moon Rounds',
      desc: 'Trigger 50 Void Residue abilities (lifetime).',
      abilities: 50,
    },
    {
      id: 'primis_cycle',
      faction: 'primis',
      name: 'Cycle Breaker',
      desc: 'Field 3+ First Circle operatives at once.',
      minField: 3,
    },
    {
      id: 'cog_last_stand',
      faction: 'gears',
      name: 'Last Bastion',
      desc: 'Clear wave 35 with 3+ COG on field.',
      wave: 35,
      minField: 3,
    },
    {
      id: 'dojo_champion',
      faction: 'baki',
      name: 'Iron Pit Champion',
      desc: 'Score 150 lifetime Iron Pit kills.',
      kills: 150,
    },
    {
      id: 'hokuto_successor',
      faction: 'fotns',
      name: 'Hokuto Successor',
      desc: 'Trigger 40 Hokuto abilities (lifetime).',
      abilities: 40,
    },
    {
      id: 'astartes_line',
      faction: 'imperium',
      name: 'Astartes Battle Line',
      desc: 'Clear wave 45 with 3+ Imperium operatives on field.',
      wave: 45,
      minField: 3,
    },
    {
      id: 'crystal_hero',
      faction: 'crystal',
      name: 'Crystal Hero',
      desc: 'Score 150 lifetime Crystal Vanguard kills.',
      kills: 150,
    },
    {
      id: 'warp_ritual',
      faction: 'warp',
      name: 'Warp Ritual',
      desc: 'Trigger 35 Rift Cult abilities (lifetime).',
      abilities: 35,
    },
    {
      id: 'tes_dragonborn',
      faction: 'tes',
      name: 'Wyrmcaller Voice',
      desc: 'Clear wave 38 with 2+ TES operatives on field.',
      wave: 38,
      minField: 2,
    },
  ];

  static SEASONAL_EVENTS = [
    {
      id: 'moon_rounds',
      months: [1],
      name: 'Moon Rounds',
      factions: ['ultimis'],
      bonus: { abilityDmg: 0.08 },
      desc: 'Void Residue Crew abilities +8% in January.',
    },
    {
      id: 'primis_ascension',
      months: [2],
      name: 'First Circle Ascension',
      factions: ['primis'],
      bonus: { dmg: 0.08 },
      desc: 'First Circle damage +8% in February.',
    },
    {
      id: 'wrestlemania',
      months: [3, 4],
      name: 'Grand Coliseum Season',
      factions: ['wwe'],
      bonus: { morale: 8 },
      desc: 'Grand Coliseum Champions morale +8 on recruit.',
    },
    {
      id: 'cog_siegebreak',
      months: [5],
      name: 'Trench Siegebreak',
      factions: ['gears'],
      bonus: { siegeDmg: 0.1 },
      desc: 'Iron Trench Coalition siege damage +10% in May.',
    },
    {
      id: 'stand_summer',
      months: [6, 7],
      name: 'Spirit Court Summer',
      factions: ['jojo'],
      bonus: { abilityDmg: 0.1 },
      desc: 'Bound Spirit Court abilities +10% Jun–Jul.',
    },
    {
      id: 'saiyan_saga',
      months: [8],
      name: 'Skyburst Ascendance',
      factions: ['dragonball', 'crystal'],
      bonus: { dmg: 0.1 },
      desc: 'Skyburst Order and Crystal Vanguard damage +10% in August.',
    },
    {
      id: 'fellowship_march',
      months: [9],
      name: 'Ninefold March',
      factions: ['lotr'],
      bonus: { moraleRegen: 3 },
      desc: 'Ninefold March grants +3 morale/round in September.',
    },
    {
      id: 'hanma_open',
      months: [10],
      name: 'Iron Pit Open',
      factions: ['baki'],
      bonus: { meleeDmg: 0.1 },
      desc: 'Iron Pit Guild melee damage +10% in October.',
    },
    {
      id: 'spartan_day',
      months: [11],
      name: 'Vanguard Day',
      factions: ['halo', 'imperium'],
      bonus: { acc: 8 },
      desc: 'Orbital Vanguard and Crimson Legions accuracy +8 during November.',
    },
    {
      id: 'hokuto_winter',
      months: [12],
      name: 'North Star Winter',
      factions: ['fotns', 'warp'],
      bonus: { abilityDmg: 0.08 },
      desc: 'North Star Ascetics and Rift Cult abilities +8% in December.',
    },
    {
      id: 'dragons_dawn',
      months: [7],
      name: "Dragon's Dawn",
      factions: ['tes', 'lotr'],
      bonus: { abilityDmg: 0.09 },
      desc: 'Voicebound Pact and Ninefold March abilities +9% in July.',
    },
  ];

  constructor() {
    this.ctx = null;
    this.activeSynergies = [];
    this.sessionChallenges = new Set();
    this.FIELD_SOFT_CAP = FactionDepthSystem.FIELD_SOFT_CAP;
    this.STANDARD_BARRACKS_COST = FactionDepthSystem.STANDARD_BARRACKS_COST;
    this.STANDARD_BARRACKS_BUILDERS = FactionDepthSystem.STANDARD_BARRACKS_BUILDERS;
    this.PROFILES = FactionDepthSystem.PROFILES;
    this.PLANET_WARFARE_OPERATIVES = FactionDepthSystem.PLANET_WARFARE_OPERATIVES;
    this.SYNERGIES = typeof GameData !== 'undefined' ? GameData.synergies : [];
    this.ENEMY_COUNTERS = FactionDepthSystem.ENEMY_COUNTERS;
    this.MASTERY_CHALLENGES = FactionDepthSystem.MASTERY_CHALLENGES;
    this.SEASONAL_EVENTS = FactionDepthSystem.SEASONAL_EVENTS;
    this.PLANET_WARFARE_WAVE = FactionDepthSystem.PLANET_WARFARE_WAVE;
    this.patchBuildDefs();
  }

  /** Evolved operatives with enhanced northern-hold demolition at wave 200+ (Planet Warfare). */

  bind(gameCtx) {
    this.ctx = gameCtx;
  }

  /** Resolve a module via injected ctx or fall back to globals. */
  _svc(id) {
    if (this.ctx?.svc) return this.ctx.svc(id);
    if (this.ctx?.services?.get) return this.ctx.services.get(id);
    return typeof globalThis !== 'undefined' ? (globalThis[id] ?? null) : null;
  }

  onGameStart() {
    this.sessionChallenges = new Set();
    this.activeSynergies = [];
  }

  getProfile(factionId) {
    return this.PROFILES[factionId] || null;
  }

  getSeasonalEvents(date = new Date()) {
    const m = date.getMonth() + 1;
    return this.SEASONAL_EVENTS.filter((e) => e.months.includes(m));
  }

  getSeasonalEvent(date = new Date()) {
    return this.getSeasonalEvents(date)[0] || null;
  }

  getMasteryPoints(faction) {
    if (!this._svc('Achievements')) return 0;
    try {
      const raw = localStorage.getItem('myth-and-blood-achievements-v3');
      if (!raw) return 0;
      const data = JSON.parse(raw);
      return data.crossoverMastery?.[faction] || 0;
    } catch (_) {
      return 0;
    }
  }

  getMasteryTier(faction) {
    const pts = this.getMasteryPoints(faction);
    if (pts >= 500) return 4;
    if (pts >= 300) return 3;
    if (pts >= 150) return 2;
    if (pts >= 50) return 1;
    return 0;
  }

  getMasteryTitle(faction) {
    const prof = this.PROFILES[faction];
    const tier = this.getMasteryTier(faction);
    return prof?.masteryTitle?.[tier - 1] || null;
  }

  getDeployCostMult(faction, wave, armyUnits) {
    let mult = 1;
    if (wave < FactionDepthSystem.EARLY_WAVE_CAP) mult *= FactionDepthSystem.EARLY_WAVE_COST_BONUS;
    for (const event of this.getSeasonalEvents()) {
      if (event.factions?.includes(faction) && event.bonus.dmg) mult *= 0.95;
    }
    const units = armyUnits || this.ctx?.units;
    if (units) {
      const { byFaction } = this.countCrossoverUnits(units);
      const fc = Object.keys(byFaction).length;
      if (fc >= FactionDepthSystem.FACTION_SOUP_THRESHOLD) {
        mult *= 1 + (fc - (FactionDepthSystem.FACTION_SOUP_THRESHOLD - 1)) * 0.06;
      }
    }
    return mult;
  }

  stackSynergyBonuses(values) {
    if (!values?.length) return 0;
    const sorted = [...values].sort((a, b) => b - a);
    let total = 0;
    let weight = 1;
    for (const v of sorted) {
      total += v * weight;
      weight *= FactionDepthSystem.SYNERGY_DECAY;
    }
    return total;
  }

  getUnitFaction(unit) {
    if (!unit) return null;
    if (unit.isWwe) return 'wwe';
    if (unit.isDoomslayer) return 'doom';
    return getCrossoverDef?.(unit.type)?.faction || null;
  }

  getWeaknessMods(unit) {
    const f = this.getUnitFaction(unit);
    return f ? this.PROFILES[f]?.weaknessMods || null : null;
  }

  isFlyingFoe(target) {
    return !!(target?.flying || target?.type === 'harpy' || target?.type === 'sky_drake');
  }

  isArcaneFoe(target) {
    return ['dark_mage', 'necromancer', 'shaman'].includes(target?.type);
  }

  isUndeadFoe(target) {
    return target?.type === 'necromancer' || !!target?.undead;
  }

  applyWeaknessDealt(unit, target, dmg) {
    const mods = this.getWeaknessMods(unit);
    if (!mods || dmg <= 0) return dmg;
    let d = dmg;
    if (mods.vsFlying && this.isFlyingFoe(target)) d = Math.round(d * mods.vsFlying);
    if (mods.vsRanged && (target?.projectile || target?.combatType === 'ranged'))
      d = Math.round(d * mods.vsRanged);
    if (mods.vsArcane && this.isArcaneFoe(target)) d = Math.round(d * mods.vsArcane);
    if (mods.vsUndead && this.isUndeadFoe(target)) d = Math.round(d * mods.vsUndead);
    if (mods.vsNecromancer && target?.type === 'necromancer') d = Math.round(d * mods.vsNecromancer);
    if (mods.vsAssassin && target?.type === 'assassin') d = Math.round(d * mods.vsAssassin);
    if (mods.vsBerserker && target?.type === 'berserker') d = Math.round(d * mods.vsBerserker);
    if (mods.vsMeleeRush && target?.team === 'enemy' && this.ctx?.units) {
      const rushers = this.ctx.units.filter(
        (u) =>
          u.team === 'enemy' &&
          u.hp > 0 &&
          u.id !== target.id &&
          this.ctx.unitDistance(target, u) < 65 &&
          (u.combatType === 'cavalry' || u.combatType === 'melee')
      ).length;
      if (rushers >= 2) d = Math.round(d * mods.vsMeleeRush);
    }
    return d;
  }

  countCrossoverUnits(units) {
    let n = 0;
    const byFaction = {};
    for (const u of units || []) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (!u.isCrossover && !u.isWwe && !u.isDoomslayer) continue;
      n++;
      const f = u.isWwe ? 'wwe' : u.isDoomslayer ? 'doom' : getCrossoverDef?.(u.type)?.faction;
      if (f) byFaction[f] = (byFaction[f] || 0) + 1;
    }
    return { total: n, byFaction };
  }

  computeSynergies(units) {
    const { byFaction } = this.countCrossoverUnits(units);
    const present = new Set(Object.keys(byFaction));
    const active = [];
    for (const syn of this.SYNERGIES) {
      const needs = syn.factions;
      if (syn.minFactions) {
        if (present.size >= syn.minFactions && needs.every((f) => present.has(f))) active.push(syn);
        continue;
      }
      if (syn.requiresOtherFaction || syn.requiresWwe) {
        if (byFaction.wwe && present.size >= 2) active.push(syn);
        continue;
      }
      if (needs.every((f) => present.has(f))) active.push(syn);
    }
    this.activeSynergies = active;
    return active;
  }

  applySynergyToUnit(unit, synergies) {
    if (!unit || unit.team !== 'player') return;
    unit.synergyMelee = 0;
    unit.synergyAcc = 0;
    unit.synergyAbility = 0;
    unit.synergySiege = 0;
    unit.synergyCrossover = 0;
    unit.synergyCrit = 0;
    unit.synergyMoraleRegen = 0;

    const meleeBonuses = [];
    const accBonuses = [];
    const abilityBonuses = [];
    const siegeBonuses = [];
    const crossoverBonuses = [];
    const critBonuses = [];
    let moraleRegen = 0;

    for (const s of synergies) {
      if (s.bonus.meleeDmg && !unit.projectile) meleeBonuses.push(s.bonus.meleeDmg);
      if (s.bonus.rangedAcc && (unit.projectile || unit.combatType === 'ranged'))
        accBonuses.push(s.bonus.rangedAcc);
      if (s.bonus.abilityDmg) abilityBonuses.push(s.bonus.abilityDmg);
      if (s.bonus.siegeDmg) siegeBonuses.push(s.bonus.siegeDmg);
      if (s.bonus.crossoverDmg && (unit.isCrossover || unit.isWwe))
        crossoverBonuses.push(s.bonus.crossoverDmg);
      if (s.bonus.critChance && !unit.projectile) critBonuses.push(s.bonus.critChance);
      if (s.bonus.moraleRegen) moraleRegen += s.bonus.moraleRegen;
    }

    unit.synergyMelee = this.stackSynergyBonuses(meleeBonuses);
    unit.synergyAcc = Math.round(this.stackSynergyBonuses(accBonuses));
    unit.synergyAbility = this.stackSynergyBonuses(abilityBonuses);
    unit.synergySiege = this.stackSynergyBonuses(siegeBonuses);
    unit.synergyCrossover = this.stackSynergyBonuses(crossoverBonuses);
    unit.synergyCrit = this.stackSynergyBonuses(critBonuses);
    unit.synergyMoraleRegen = moraleRegen;

    const f = this.getUnitFaction(unit);
    for (const event of this.getSeasonalEvents()) {
      if (!f || !event.factions.includes(f)) continue;
      if (event.bonus.acc) accBonuses.push(event.bonus.acc);
      if (event.bonus.dmg && !unit.projectile) meleeBonuses.push(event.bonus.dmg);
      if (event.bonus.meleeDmg && !unit.projectile) meleeBonuses.push(event.bonus.meleeDmg);
      if (event.bonus.abilityDmg) abilityBonuses.push(event.bonus.abilityDmg);
      if (event.bonus.siegeDmg) siegeBonuses.push(event.bonus.siegeDmg);
    }
    if (accBonuses.length) unit.synergyAcc = Math.round(this.stackSynergyBonuses(accBonuses));
    if (meleeBonuses.length) unit.synergyMelee = this.stackSynergyBonuses(meleeBonuses);
    if (abilityBonuses.length) unit.synergyAbility = this.stackSynergyBonuses(abilityBonuses);
    if (siegeBonuses.length) unit.synergySiege = this.stackSynergyBonuses(siegeBonuses);
  }

  applyFieldBalance(unit, crossoverCount, vanillaCount, factionCount = 0) {
    if (!unit?.isCrossover && !unit?.isWwe) return;
    if (crossoverCount > this.FIELD_SOFT_CAP) {
      const over = crossoverCount - this.FIELD_SOFT_CAP;
      unit.fieldBalanceMult = Math.max(0.72, 1 - over * 0.03);
    } else {
      unit.fieldBalanceMult = 1;
    }
    if (factionCount >= FactionDepthSystem.FACTION_SOUP_THRESHOLD) {
      const over = factionCount - (FactionDepthSystem.FACTION_SOUP_THRESHOLD - 1);
      unit.factionSoupMult = Math.max(0.85, 1 - over * 0.04);
    } else {
      unit.factionSoupMult = 1;
    }
    if (vanillaCount >= crossoverCount && vanillaCount >= 4) {
      unit.vanillaSupportAura = 1.05;
    } else {
      unit.vanillaSupportAura = 1;
    }
  }

  isHoldingDefensivePosition(unit) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
    if (unit.garrisoned) return true;
    const buildings = this.ctx?.buildings || [];
    for (const b of buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      const isFort =
        b.type === 'wall' ||
        b.type === 'outpost' ||
        b.isKeep ||
        b.type === 'castle' ||
        (b.isHamlet && ((b.fortressTier || 0) > 0 || b.fortressWallsSpawned));
      if (!isFort) continue;
      if (this.ctx.unitDistance(unit, b) < (b.radius || 40) + 35) return true;
    }
    return false;
  }

  applyWarhammerDuty(unit) {
    if (typeof MetaProgress === 'undefined' || !MetaProgress.isWarhammerUnlocked?.()) return;
    const faction = getCrossoverDef?.(unit.type)?.faction;
    if (faction !== 'imperium' && faction !== 'warp') return;
    if (this.isHoldingDefensivePosition(unit)) {
      unit.dutyStacks = Math.min(8, (unit.dutyStacks || 0) + 1);
      unit.faithFuryActive =
        unit.dutyStacks >= 2 &&
        (unit.wweAbility === 'litany_of_hate' ||
          unit.wweAbility === 'warp_fury' ||
          unit.wweAbility === 'lasgun_volley' ||
          unit.wweAbility === 'bolter_discipline');
    } else {
      unit.dutyStacks = Math.max(0, (unit.dutyStacks || 0) - 1);
      unit.faithFuryActive = false;
    }
  }

  applyToUnit(unit, armyUnits) {
    if (!unit || unit.team !== 'player') return unit;
    this.applyWarhammerDuty(unit);
    const { total, byFaction } = this.countCrossoverUnits(armyUnits || this.ctx?.units || []);
    const factionCount = Object.keys(byFaction).length;
    const vanilla = (armyUnits || this.ctx?.units || []).filter(
      (u) => u.team === 'player' && u.hp > 0 && !u.isCrossover && !u.isWwe && !u.isDoomslayer
    ).length;
    this.applyFieldBalance(unit, total, vanilla, factionCount);
    const syns = this.computeSynergies(armyUnits || this.ctx?.units || []);
    this.applySynergyToUnit(unit, syns);
    const faction = unit.isWwe
      ? 'wwe'
      : unit.isDoomslayer
        ? 'doom'
        : getCrossoverDef?.(unit.type)?.faction;
    const tier = faction ? this.getMasteryTier(faction) : 0;
    if (tier > 0 && (unit.isCrossover || unit.isWwe)) {
      unit.masteryTier = tier;
      unit.maxMorale = Math.min(45, unit.maxMorale + tier);
    }
    if (typeof OperativeSkillTrees !== 'undefined') {
      OperativeSkillTrees.applyToUnit(unit, armyUnits);
    }
    return unit;
  }

  canBuildBarracks(buildType, wave, buildings, units) {
    const faction = Object.entries(CrossoverFactions || {}).find(
      ([, f]) => f.building === buildType
    )?.[0];
    if (!faction) return { ok: true };
    const prof = this.PROFILES[faction];
    if (!prof) return { ok: true };
    const hamletCount = buildings.filter(
      (b) => b.isHamlet && b.complete && b.owner === 'player'
    ).length;
    if (prof.recommendedHamlets && hamletCount < prof.recommendedHamlets) {
      return {
        ok: true,
        warn: `${prof.label} works best with ${prof.recommendedHamlets}+ hamlet(s) — you have ${hamletCount}.`,
      };
    }
    return { ok: true };
  }

  onWaveStart(units) {
    const syns = this.computeSynergies(units);
    for (const syn of syns) {
      if (syn.bonus.waveMorale) {
        for (const u of units) {
          if (u.team === 'player' && u.hp > 0)
            u.morale = Math.min(u.maxMorale, u.morale + syn.bonus.waveMorale);
        }
      }
      if (syn.bonus.moraleRegen) {
        for (const u of units) {
          if (u.team === 'player' && u.hp > 0)
            u.morale = Math.min(u.maxMorale, u.morale + syn.bonus.moraleRegen);
        }
      }
    }
    for (const event of this.getSeasonalEvents()) {
      if (event.bonus.morale) {
        for (const u of units) {
          if (u.team !== 'player' || u.hp <= 0) continue;
          const f = u.isWwe ? 'wwe' : getCrossoverDef?.(u.type)?.faction;
          if (f && event.factions.includes(f))
            u.morale = Math.min(u.maxMorale, u.morale + event.bonus.morale);
        }
      }
      if (event.bonus.moraleRegen) {
        for (const u of units) {
          if (u.team !== 'player' || u.hp <= 0) continue;
          const f = u.isWwe ? 'wwe' : getCrossoverDef?.(u.type)?.faction;
          if (f && event.factions.includes(f))
            u.morale = Math.min(u.maxMorale, u.morale + event.bonus.moraleRegen);
        }
      }
    }
    if (
      typeof MetaProgress !== 'undefined' &&
      MetaProgress.isTesUnlocked?.() &&
      Math.random() < 0.08
    ) {
      for (const u of units) {
        if (u.team !== 'player' || u.hp <= 0) continue;
        u.morale = Math.min(u.maxMorale, u.morale + 6);
        if (u.damage) u.damage = Math.floor(u.damage * 1.12);
        u.prophecyTimer = Math.max(u.prophecyTimer || 0, 120);
      }
      const cx = this.ctx?.worldW ? this.ctx.worldW / 2 : 400;
      FloatingText?.status(cx, 52, 'PROPHECY FULFILLED', '#e8b050');
      this.ctx?.showMessage?.(
        'A Voicebound prophecy ignites — temporary power surges through your army!',
        320
      );
    }
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0 || !u.isCrossover) continue;
      this.applyWarhammerDuty(u);
      if (u.faithFuryActive) {
        u.morale = Math.min(u.maxMorale, u.morale + 3);
        FloatingText?.status(u.x, u.y - 12, 'FAITH & FURY', '#c04040');
      }
      const ab = u.wweAbility;
      const cool = typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2;
      const coolInt = (n, min = 1) =>
        typeof coolAbilityInt === 'function' ? coolAbilityInt(n, min) : Math.max(min, Math.round(n * cool));
      if (ab === 'spartan_rage' || ab === 'oorah') {
        units
          .filter((a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(u, a) < coolInt(100))
          .forEach((a) => {
            a.morale = Math.min(a.maxMorale, a.morale + coolInt(3, 0));
            a.rallyTimer = Math.max(a.rallyTimer || 0, coolInt(60));
          });
        FloatingText?.status(
          u.x,
          u.y,
          ab === 'oorah' ? 'OORAH!' : 'SHIELDS UP',
          this.PROFILES.halo?.palette?.[0] || '#408040'
        );
        this.playFactionSfx('halo');
      }
      if (ab === 'noble_leader') {
        units
          .filter(
            (a) =>
              a.team === 'player' &&
              a.isCrossover &&
              getCrossoverDef?.(a.type)?.faction === 'halo' &&
              this.ctx.unitDistance(u, a) < coolInt(90)
          )
          .forEach((a) => {
            a.damage = Math.floor(a.damage * (1 + 0.08 * cool));
          });
      }
      if (ab === 'tech_ops') {
        for (const e of units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (this.ctx.unitDistance(u, e) < coolInt(110))
            e.lanternBlind = Math.max(e.lanternBlind || 0, coolInt(30));
        }
      }
      if (ab === 'hokuto_kaioh') {
        for (const e of units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (this.ctx.unitDistance(u, e) < coolInt(100))
            e.morale = Math.max(0, e.morale - coolInt(2, 0));
        }
      }
    }
    this.checkSynergyAchievements(syns, units);
  }

  getLifetimeCrossoverStats() {
    try {
      const raw = localStorage.getItem('myth-and-blood-achievements-v3');
      if (!raw) return { kills: {}, abilities: {} };
      const data = JSON.parse(raw);
      return { kills: data.crossoverKills || {}, abilities: data.crossoverAbilities || {} };
    } catch (_) {
      return { kills: {}, abilities: {} };
    }
  }

  checkMasteryChallenges(wave, units, extras = {}) {
    const { byFaction } = this.countCrossoverUnits(units);
    const life = this.getLifetimeCrossoverStats();
    for (const ch of this.MASTERY_CHALLENGES) {
      if (this.sessionChallenges.has(ch.id)) continue;
      let ok = true;
      if (ch.wave != null && wave < ch.wave) ok = false;
      if (ch.minField != null && (byFaction[ch.faction] || 0) < ch.minField) ok = false;
      if (ch.flawless && (extras.playerDeaths ?? extras.misses ?? 0) > 0) ok = false;
      if (ch.kills != null && (life.kills[ch.faction] || 0) < ch.kills) ok = false;
      if (ch.abilities != null && (life.abilities[ch.faction] || 0) < ch.abilities) ok = false;
      if (ch.flag === 'jojo_cavalry') {
        const p7 = (units || []).filter((u) => {
          const d = getCrossoverDef?.(u.type);
          // Part 7 units use type:'cavalry' with melee/ranged combatTags — tag-only check was impossible.
          return (
            u.team === 'player' &&
            u.hp > 0 &&
            d?.jojoPart === 7 &&
            (d?.type === 'cavalry' || d?.combatTag === 'cavalry' || u.combatType === 'cavalry')
          );
        }).length;
        if (p7 < 2) ok = false;
      }
      if (!ok) continue;
      this.sessionChallenges.add(ch.id);
      this.ctx?.ach?.('crossover_mastery_challenge', { challenge: ch.id, faction: ch.faction });
      const prof = this.PROFILES[ch.faction];
      this.ctx?.showMessage?.(
        `${prof?.label || ch.faction} mastery: ${ch.name} — +25 mastery`,
        360
      );
    }
  }

  checkSynergyAchievements(syns, units) {
    if (!this.ctx?.ach) return;
    for (const s of syns) this.ctx.ach('faction_synergy', { synergy: s.id });
    if (syns.length >= 2) this.ctx.ach('faction_synergy_multi', { count: syns.length });
    const fourWorld = syns.find((s) => s.id === 'multiversal_4');
    if (fourWorld) this.ctx.ach('multiversal_synergy', { count: 4 });
    const { byFaction } = this.countCrossoverUnits(units);
    const fc = Object.keys(byFaction).length;
    if (fc >= 3) this.ctx.ach('multiversal_check', { count: fc });
  }

  playFactionSfx(faction) {
    AudioEngine?.SFX?.factionPulse?.(faction);
  }

  procAbilityVfx(unit, label, color) {
    if (!unit) return;
    FloatingText?.status(unit.x, unit.y - 10, label, color || '#ffd700');
    const f = unit.isWwe ? 'wwe' : getCrossoverDef?.(unit.type)?.faction;
    if (f) this.playFactionSfx(f);
  }

  modifyDamage(unit, target, dmg) {
    let d = dmg;
    if (unit.synergyMelee) d = Math.round(d * (1 + unit.synergyMelee));
    if (unit.synergyAbility && unit.wweAbility) d = Math.round(d * (1 + unit.synergyAbility));
    if (unit.synergyCrossover && (unit.isCrossover || unit.isWwe))
      d = Math.round(d * (1 + unit.synergyCrossover));
    if (unit.fieldBalanceMult) d = Math.round(d * unit.fieldBalanceMult);
    if (unit.factionSoupMult) d = Math.round(d * unit.factionSoupMult);
    if (unit.vanillaSupportAura) d = Math.round(d * unit.vanillaSupportAura);
    const synSiege = unit.synergySiege || 0;
    if (synSiege && (target?.type === 'siege_tower' || target?.siegeDeployed))
      d = Math.round(d * (1 + synSiege));

    if (unit.isCrossover || unit.isWwe) d = this.applyWeaknessDealt(unit, target, d);

    if (
      unit.synergyCrit &&
      !unit.projectile &&
      target?.maxHp > 0 &&
      target.hp / target.maxHp < 0.4 &&
      Math.random() < unit.synergyCrit
    ) {
      d = Math.round(d * 1.5);
    }

    const counter = this.ENEMY_COUNTERS[target?.type];
    if (counter && unit.isCrossover) {
      const f = this.getUnitFaction(unit);
      if (counter.weakFactions.includes(f)) d = Math.round(d / counter.mult);
    }

    if (unit.wweAbility === 'lone_wolf') {
      const allies = this.ctx.units.filter(
        (a) =>
          a.team === 'player' && a.hp > 0 && a.id !== unit.id && this.ctx.unitDistance(unit, a) < 80
      ).length;
      if (allies === 0) d = Math.round(d * 1.35);
    }
    if (unit.wweAbility === 'demon_back' && unit.hp / unit.maxHp < 0.5) d = Math.round(d * 1.4);
    if (unit.wweAbility === 'galick_gun' && isEliteEnemy?.(target)) d = Math.round(d * 1.25);
    if (unit.wweAbility === 'warp_fury' && unit.hp / unit.maxHp < 0.5) d = Math.round(d * 1.3);
    if (unit.faithFuryActive) d = Math.round(d * (1 + (unit.dutyStacks || 0) * 0.05));
    if (unit.dutyStacks > 0) d = Math.round(d * (1 + unit.dutyStacks * 0.03));
    if (unit.wweAbility === 'limit_break' && unit.hp / unit.maxHp < 0.4) d = Math.round(d * 1.35);
    if (unit.wweAbility === 'bolter_discipline') {
      const allies = this.ctx.units.filter(
        (a) =>
          a.team === 'player' &&
          a.hp > 0 &&
          a.id !== unit.id &&
          getCrossoverDef?.(a.type)?.faction === 'imperium' &&
          this.ctx.unitDistance(unit, a) < 90
      ).length;
      if (allies >= 1) d = Math.round(d * 1.12);
    }
    if (unit.wweAbility === 'jump_attack' && (target?.flying || target?.speed > 1.05))
      d = Math.round(d * 1.25);
    if (unit.wweAbility === 'aeon_strike' && isEliteEnemy?.(target)) d = Math.round(d * 1.2);
    if (unit.wweAbility === 'anduril' && (target?.type === 'dark_knight' || isEliteEnemy?.(target)))
      d = Math.round(d * 1.3);
    if (unit.wweAbility === 'elven_archer' && (target?.speed > 1 || target?.flying))
      d = Math.round(d * 1.2);
    return d;
  }

  modifyDamageTaken(target, attacker, dmg) {
    if (!target || dmg <= 0) return dmg;
    if (target.dutyStacks > 0) dmg = Math.round(dmg / (1 + target.dutyStacks * 0.03));
    if (!target.isCrossover && !target.isWwe && !target.isDoomslayer) return dmg;
    const mods = this.getWeaknessMods(target);
    if (!mods) return dmg;
    let d = dmg;
    if (mods.damageTakenRanged && (attacker?.projectile || attacker?.combatType === 'ranged'))
      d = Math.round(d * mods.damageTakenRanged);
    if (
      mods.damageTakenMelee &&
      (attacker?.combatType === 'cavalry' ||
        attacker?.combatType === 'melee' ||
        attacker?.type === 'berserker')
    )
      d = Math.round(d * mods.damageTakenMelee);
    if (mods.damageTakenStealth && (attacker?.type === 'assassin' || attacker?.stealthed))
      d = Math.round(d * mods.damageTakenStealth);
    if (mods.vsSwarm && attacker?.team === 'enemy' && this.ctx?.units) {
      const swarm = this.ctx.units.filter(
        (u) => u.team === 'enemy' && u.hp > 0 && this.ctx.unitDistance(target, u) < 70
      ).length;
      if (swarm >= 3) d = Math.round(d * mods.vsSwarm);
    }
    return d;
  }

  processAbilityHit(unit, target, dmg) {
    if (!unit || !this.ctx) return;
    const ab = unit.wweAbility;
    // 20% cooler character abilities — stronger procs, bigger AoEs.
    const cool = typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2;
    const coolInt = (n, min = 1) =>
      typeof coolAbilityInt === 'function' ? coolAbilityInt(n, min) : Math.max(min, Math.round(n * cool));
    const synMult = 1 + (unit.synergyAbility || 0);

    const origTake = this.ctx.takeDamage?.bind(this.ctx);
    const origRad = this.ctx.damageInRadius?.bind(this.ctx);
    if (origTake) {
      // Single cool pass — damageInRadius calls takeDamage, so only scale here.
      this.ctx.takeDamage = (t, amount, opts) =>
        origTake(t, coolInt(Number(amount) || 0), opts);
    }
    if (origRad) {
      // Cool the AoE footprint; damage amount is cooled inside takeDamage.
      this.ctx.damageInRadius = (x, y, r, amount, team, opts) =>
        origRad(x, y, coolInt(Number(r) || 0), amount, team, opts);
    }

    const handlers = {
      frag_out() {
        const orbital = !!unit.cosmicOrbitalStrike;
        const splashMult = orbital ? 0.85 : 0.35;
        const radius = orbital ? 200 : 50;
        let splash = 0;
        for (const e of this.ctx.units) {
          if (e.team !== 'enemy' || e.hp <= 0 || e.id === target.id) continue;
          if (this.ctx.unitDistance(target, e) < radius) {
            this.ctx.takeDamage(e, Math.round(dmg * splashMult * synMult));
            splash++;
          }
        }
        if (splash >= (orbital ? 1 : 2)) {
          this.procAbilityVfx(unit, orbital ? 'ORBITAL FRAG' : 'FRAG!', orbital ? '#ff8040' : '#c06030');
        }
      },
      apothicon_slam() {
        if (target.hp <= 0) {
          for (const e of this.ctx.units) {
            if (e.team !== 'enemy' || e.hp <= 0) continue;
            if (this.ctx.unitDistance(target, e) < 45)
              this.ctx.takeDamage(e, Math.round(dmg * 0.4));
          }
          this.procAbilityVfx(unit, 'SLAM', '#d07040');
        }
      },
      iron_curtain() {
        if (unit.hp / unit.maxHp < 0.35 && (unit.ironCurtainCd || 0) <= 0) {
          unit.ironCurtainCd = 200;
          unit.rallyTimer = 90;
          this.procAbilityVfx(unit, 'CURTAIN', '#5080a0');
        }
      },
      energy_sword() {
        if (target.hp / target.maxHp < 0.45)
          this.ctx.takeDamage(target, Math.round(dmg * 0.8), { crit: true });
      },
      grenadier() {
        unit.grenadeCount = (unit.grenadeCount || 0) + 1;
        if (unit.grenadeCount % 3 === 0) {
          this.ctx.damageInRadius(target.x, target.y, 45, Math.round(dmg * 0.5), 'player');
          this.procAbilityVfx(unit, 'SPLASH', '#705030');
        }
      },
      sniper_cover() {
        if (isEliteEnemy?.(target)) this.ctx.takeDamage(target, Math.round(dmg * 0.45));
      },
      tech_head() {
        if (target?.type === 'siege_tower' || target?.siegeDeployed)
          this.ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      cole_train() {
        if (unit.chargeTimer > 30) this.ctx.takeDamage(target, Math.round(dmg * 0.35));
      },
      axe_cleave() {
        if (target?.type === 'siege_tower')
          this.ctx.damageInRadius(target.x, target.y, 40, Math.round(dmg * 0.4), 'player');
      },
      you_shall_not_pass() {
        for (const e of this.ctx.units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (this.ctx.unitDistance(unit, e) < 80) e.morale = Math.max(0, e.morale - 3);
        }
        this.procAbilityVfx(unit, 'YOU SHALL NOT PASS', '#c0c0e0');
      },
      ring_bearer() {
        if (Math.random() < 0.2) return;
        this.ctx.units
          .filter((a) => a.team === 'player' && this.ctx.unitDistance(unit, a) < 70)
          .forEach((a) => {
            a.morale = Math.min(a.maxMorale, a.morale + 1);
          });
      },
      horn_of_gondor() {
        const foes = this.ctx.units.filter(
          (e) => e.team === 'enemy' && e.hp > 0 && this.ctx.unitDistance(unit, e) < 60
        ).length;
        if (foes >= 3) {
          unit.rallyTimer = 120;
          this.procAbilityVfx(unit, 'HORN!', '#704030');
        }
      },
      no_man() {
        if (isEliteEnemy?.(target) && target.hp / target.maxHp < 0.5)
          this.ctx.takeDamage(target, Math.round(dmg * 1.2), { crit: true });
      },
      ogre() {
        if (target.maxHp > 200) this.ctx.takeDamage(target, Math.round(dmg * 0.4));
      },
      bite() {
        if (target.maxHp > unit.maxHp * 1.2) this.ctx.takeDamage(target, Math.round(dmg * 0.35));
      },
      iron_body() {
        if (unit.hp / unit.maxHp < 0.6) unit.rallyTimer = Math.max(unit.rallyTimer || 0, 30);
      },
      hamon_overdrive() {
        if (target?.type === 'necromancer' || target?.type === 'bone_summoner')
          this.ctx.takeDamage(target, Math.round(dmg * 0.55));
      },
      vaporization_freeze() {
        target.hazardSlow = Math.min(target.hazardSlow || 1, 0.6);
        target.morale = Math.max(0, target.morale - 2);
      },
      sunlight_yellow() {
        if (target.hp <= 0 && isEliteEnemy?.(target)) {
          const ally = this.ctx.units.find(
            (a) =>
              a.team === 'player' &&
              a.hp > 0 &&
              a.hp < a.maxHp &&
              this.ctx.unitDistance(unit, a) < 100
          );
          if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + 20);
        }
      },
      hermit_purple() {
        if (Math.random() < 0.15) target.lanternBlind = Math.max(target.lanternBlind || 0, 25);
      },
      bubble_cutter() {
        if (Math.random() < 0.2) this.ctx.takeDamage(target, Math.round(dmg * 0.6), { crit: true });
      },
      german_science() {
        if (target?.type === 'siege_tower') this.ctx.takeDamage(target, Math.round(dmg * 0.45));
      },
      star_platinum() {
        if (target.pinned) this.ctx.takeDamage(target, Math.round(dmg * 0.7), { crit: true });
      },
      hierophant_green() {
        this.ctx.damageInRadius(target.x, target.y, 35, Math.round(dmg * 0.3), 'player');
      },
      silver_chariot() {
        if (target.hp / target.maxHp < 0.4) this.ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      magicians_red() {
        Particles?.explosion(target.x, target.y);
        this.ctx.damageInRadius(target.x, target.y, 30, Math.round(dmg * 0.25), 'player');
      },
      crazy_diamond() {
        const ally = this.ctx.units.find(
          (a) =>
            a.team === 'player' &&
            a.hp > 0 &&
            a.hp < a.maxHp * 0.9 &&
            this.ctx.unitDistance(unit, a) < 50
        );
        if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + 6);
      },
      the_hand() {
        this.ctx.takeDamage(target, Math.round(dmg * 0.25));
      },
      heavens_door() {
        target.lanternBlind = Math.max(target.lanternBlind || 0, 35);
      },
      killer_queen() {
        if (target.hp / target.maxHp < 0.35)
          this.ctx.takeDamage(target, Math.round(dmg * 0.9), { crit: true });
      },
      gold_experience() {
        if (target.hp <= 0) {
          const ally = this.ctx.units.find(
            (a) => a.team === 'player' && a.hp > 0 && a.hp < a.maxHp
          );
          if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + 12);
        }
      },
      sticky_fingers() {
        unit.rallyTimer = Math.max(unit.rallyTimer || 0, 40);
      },
      sex_pistols() {
        const extra = this.ctx.units.find(
          (e) =>
            e.team === 'enemy' &&
            e.hp > 0 &&
            e.id !== target.id &&
            this.ctx.unitDistance(target, e) < 40
        );
        if (extra) this.ctx.takeDamage(extra, Math.round(dmg * 0.35));
      },
      king_crimson() {
        if (target.hp / target.maxHp < 0.3)
          this.ctx.takeDamage(target, target.hp * 0.5, { crit: true });
      },
      stone_free() {
        target.hazardSlow = Math.min(target.hazardSlow || 1, 0.5);
      },
      weather_stand() {
        this.ctx.damageInRadius(target.x, target.y, 50, Math.round(dmg * 0.35), 'player');
        Particles?.lightning(target.x, target.y);
      },
      kiss() {
        if (target.hp <= 0 && isEliteEnemy?.(target)) unit.damage = Math.floor(unit.damage * 1.05);
      },
      tusk_act4() {
        if (unit.chargeTimer > 40)
          this.ctx.takeDamage(target, Math.round(dmg * 1.1), { crit: true });
      },
      steel_ball() {
        if (unit.chargeTimer > 25)
          this.ctx.damageInRadius(target.x, target.y, 35, Math.round(dmg * 0.4), 'player');
      },
      scary_monsters() {
        if (unit.chargeTimer > 20) this.ctx.takeDamage(target, Math.round(dmg * 0.45));
      },
      hidan_shinken() {
        if (target.hp / target.maxHp < 0.35)
          this.ctx.takeDamage(target, Math.round(dmg * 1.5), { crit: true });
      },
      hakke_shou() {
        this.ctx.units
          .filter((a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(unit, a) < 90)
          .forEach((a) => (a.hp = Math.min(a.maxHp, a.hp + 2)));
      },
      nanto_suicho() {
        const extra = this.ctx.units.filter(
          (e) =>
            e.team === 'enemy' &&
            e.hp > 0 &&
            e.id !== target.id &&
            this.ctx.unitDistance(target, e) < 35
        );
        if (extra.length) extra.forEach((e) => this.ctx.takeDamage(e, Math.round(dmg * 0.2)));
      },
      dirty_tricks() {
        target.morale = Math.max(0, target.morale - 3);
      },
      kamehameha() {
        const foes = this.ctx.units.filter(
          (e) => e.team === 'enemy' && e.hp > 0 && this.ctx.unitDistance(unit, e) < 70
        ).length;
        if (foes >= 3) {
          this.ctx.damageInRadius(unit.x, unit.y, 60, Math.round(dmg * 0.8), 'player');
          this.procAbilityVfx(unit, 'KAMEHAMEHA', '#e06040');
        }
      },
      special_beam() {
        if (target.maxHp > 180) this.ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      hidden_potential() {
        if (unit.hp / unit.maxHp < 0.4)
          this.ctx.takeDamage(target, Math.round(dmg * 0.5), { crit: true });
      },
      burning_attack() {
        if (target.hp / target.maxHp < 0.4)
          this.ctx.takeDamage(target, Math.round(dmg * 0.55), { crit: true });
      },
      death_beam() {
        if (target.hp / target.maxHp < 0.5) this.ctx.takeDamage(target, Math.round(dmg * 0.65));
      },
      perfect_form() {
        if (target.hp <= 0) unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(unit.maxHp * 0.08));
      },
      hakai() {
        if (target.hp / target.maxHp < 0.25)
          this.ctx.takeDamage(target, Math.max(dmg * 2, target.hp * 0.6), { crit: true });
      },
      carmine_curse() {
        if (unit.hp / unit.maxHp < 0.3 && Math.random() < 0.1) unit.hp = Math.max(1, unit.hp - 10);
      },
      heavy_lancer() {
        const nearby = this.ctx.units.filter(
          (e) => e.team === 'enemy' && e.hp > 0 && this.ctx.unitDistance(target, e) < 45
        ).length;
        if (nearby >= 2) this.ctx.takeDamage(target, Math.round(dmg * 0.25));
      },
      vodka_rage() {
        if (unit.hp / unit.maxHp < 0.45) unit.rallyTimer = Math.max(unit.rallyTimer || 0, 40);
      },
      wunderwaffe() {
        if (isEliteEnemy?.(target)) this.ctx.takeDamage(target, Math.round(dmg * 0.4 * synMult));
      },
      bushido() {
        const stars = this.ctx.getStarCount?.(unit) ?? 0;
        if (stars >= 3 && Math.random() < 0.25)
          this.ctx.takeDamage(target, Math.round(dmg * 0.6), { crit: true });
      },
      katana_fury() {
        if (target.hp / target.maxHp < 0.5) this.ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      summoning_key() {
        if (isEliteEnemy?.(target) && target.hp > 0) {
          unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(dmg * 0.5));
        }
      },
      spartan_rage() {
        if (target.team === 'enemy') {
          this.ctx.units
            .filter((a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(unit, a) < 90)
            .forEach((a) => {
              a.morale = Math.min(a.maxMorale, a.morale + 1);
            });
        }
      },
      oorah() {
        if (target.team === 'enemy') {
          this.ctx.units
            .filter((a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(unit, a) < 110)
            .forEach((a) => {
              a.rallyTimer = Math.max(a.rallyTimer || 0, 50);
            });
        }
      },
      lancer_burst() {
        if (target.hp / target.maxHp < 0.3)
          this.ctx.takeDamage(target, Math.round(target.hp * 0.7), { crit: true });
      },
      brothers_in_arms() {
        const marcus = this.ctx.units.find(
          (u) => u.type === 'marcus_fenix' && u.hp > 0 && this.ctx.unitDistance(unit, u) < 100
        );
        if (marcus) marcus.hp = Math.min(marcus.maxHp, marcus.hp + 8);
      },
      carmine_brother() {
        this.ctx.units
          .filter(
            (u) => u.type?.includes('carmine') && u.hp > 0 && this.ctx.unitDistance(unit, u) < 90
          )
          .forEach((c) => {
            c.accuracy = Math.min(95, c.accuracy + 2);
          });
      },
      stunner() {
        if (isEliteEnemy?.(target)) this.ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      f5() {
        if (target.hp / target.maxHp < 0.35) this.ctx.takeDamage(target, target.hp);
      },
      go_to_sleep() {
        if (target.hp / target.maxHp < 0.3)
          this.ctx.takeDamage(target, Math.round(target.hp * 0.8));
      },
      lie_cheat_steal() {
        if (isEliteEnemy?.(target) && target.hp <= 0) this.ctx.addTactical?.(3);
      },
      woo() {
        this.ctx.units
          .filter((u) => u.team === 'player' && u.hp > 0 && this.ctx.unitDistance(unit, u) < 100)
          .forEach((a) => {
            a.morale = Math.min(a.maxMorale, a.morale + 1);
          });
      },
      hulk_up() {
        if (unit.hp / unit.maxHp < 0.4) unit.hp = Math.min(unit.maxHp, unit.hp + 30);
      },
      rko() {
        if (target.team === 'enemy' && target.hp > 0 && target.hp / target.maxHp < 0.45) {
          this.ctx.takeDamage(target, Math.max(target.hp * 0.85, dmg * 2.2), { crit: true });
          FloatingText?.status(target.x, target.y, 'RKO!', '#5080c0');
          AudioEngine?.SFX?.factionFinisher?.();
        }
      },
      lantern() {
        if (target.team === 'enemy') {
          const light = this.ctx.getDayLight?.() ?? 1;
          target.lanternBlind = Math.max(
            target.lanternBlind || 0,
            40 + Math.floor((1 - light) * 30)
          );
        }
      },
      bolter_discipline() {
        const allies = this.ctx.units.filter(
          (a) =>
            a.team === 'player' &&
            a.hp > 0 &&
            a.id !== unit.id &&
            getCrossoverDef?.(a.type)?.faction === 'imperium' &&
            this.ctx.unitDistance(unit, a) < 90
        ).length;
        if (allies >= 2) this.ctx.takeDamage(target, Math.round(dmg * 0.2));
      },
      litany_of_hate() {
        const terror = unit.faithFuryActive ? 4 : 2;
        for (const e of this.ctx.units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (this.ctx.unitDistance(unit, e) < 70) e.morale = Math.max(0, e.morale - terror);
        }
        this.procAbilityVfx(unit, unit.faithFuryActive ? 'FAITH & FURY' : 'LITANY', '#303848');
      },
      smite() {
        if (
          target?.type === 'necromancer' ||
          target?.type === 'dark_mage' ||
          target?.type === 'bone_summoner'
        )
          this.ctx.takeDamage(target, Math.round(dmg * 0.55));
      },
      summary_execution() {
        if (target.hp / target.maxHp < 0.25)
          this.ctx.takeDamage(target, Math.round(target.hp * 0.85), { crit: true });
      },
      lasgun_volley() {
        unit.lasgunCount = (unit.lasgunCount || 0) + 1;
        if (unit.lasgunCount % 4 === 0) {
          this.ctx.damageInRadius(target.x, target.y, 40, Math.round(dmg * 0.35), 'player');
          this.procAbilityVfx(unit, 'VOLLEY', '#506050');
        }
      },
      storm_shield() {
        if (unit.hp / unit.maxHp < 0.45 && (unit.stormShieldCd || 0) <= 0) {
          unit.stormShieldCd = 180;
          unit.rallyTimer = 100;
          this.procAbilityVfx(unit, 'SHIELD', '#384858');
        }
      },
      autocannon() {
        if (target?.type === 'siege_tower' || target?.siegeDeployed)
          this.ctx.takeDamage(target, Math.round(dmg * 0.55));
      },
      cross_slash() {
        if (target.hp / target.maxHp < 0.5)
          this.ctx.takeDamage(target, Math.round(dmg * 0.55), { crit: true });
      },
      firaga() {
        const foes = this.ctx.units.filter(
          (e) => e.team === 'enemy' && e.hp > 0 && this.ctx.unitDistance(target, e) < 55
        ).length;
        if (foes >= 2) {
          this.ctx.damageInRadius(target.x, target.y, 50, Math.round(dmg * 0.45), 'player');
          this.procAbilityVfx(unit, 'FIRAGA', '#802040');
        }
      },
      curaga() {
        this.ctx.units
          .filter((a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(unit, a) < 85)
          .forEach((a) => (a.hp = Math.min(a.maxHp, a.hp + 3)));
      },
      jump_attack() {
        if (unit.chargeTimer > 20 && (target?.flying || target?.speed > 1.05))
          this.ctx.takeDamage(target, Math.round(dmg * 0.5), { crit: true });
      },
      aeon_strike() {
        if (isEliteEnemy?.(target)) this.ctx.takeDamage(target, Math.round(dmg * 0.45));
      },
      limit_break() {
        if (unit.hp / unit.maxHp < 0.4)
          this.ctx.takeDamage(target, Math.round(dmg * 0.65), { crit: true });
      },
      aether_shot() {
        if (isEliteEnemy?.(target) && Math.random() < 0.15)
          this.ctx.takeDamage(target, Math.round(dmg * 0.35));
      },
      warp_fury() {
        const mult = unit.faithFuryActive ? 0.55 : 0.35;
        if (unit.hp / unit.maxHp < 0.5) this.ctx.takeDamage(target, Math.round(dmg * mult));
        if (unit.faithFuryActive) this.procAbilityVfx(unit, 'FAITH & FURY', '#802040');
      },
      festering_curse() {
        target.hazardSlow = Math.min(target.hazardSlow || 1, 0.65);
        target.morale = Math.max(0, target.morale - 3);
      },
      warp_bolt() {
        const extra = this.ctx.units.find(
          (e) =>
            e.team === 'enemy' &&
            e.hp > 0 &&
            e.id !== target.id &&
            this.ctx.unitDistance(target, e) < 45
        );
        if (extra) this.ctx.takeDamage(extra, Math.round(dmg * 0.4));
      },
      unholy_armor() {
        if (unit.hp / unit.maxHp < 0.4 && (unit.unholyArmorCd || 0) <= 0) {
          unit.unholyArmorCd = 200;
          unit.rallyTimer = 90;
          this.procAbilityVfx(unit, 'UNHOLY', '#302030');
        }
      },
      blood_pact() {
        if (target.hp <= 0) unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(unit.maxHp * 0.06));
      },
      daemon_fire() {
        if (isEliteEnemy?.(target))
          this.ctx.damageInRadius(target.x, target.y, 38, Math.round(dmg * 0.3), 'player');
      },
      fus_ro_dah() {
        let splash = 0;
        for (const e of this.ctx.units) {
          if (e.team !== 'enemy' || e.hp <= 0 || e.id === target.id) continue;
          if (this.ctx.unitDistance(target, e) < 55) {
            this.ctx.takeDamage(e, Math.round(dmg * 0.35), { dragonStrike: true });
            splash++;
          }
        }
        if (splash >= 2) this.procAbilityVfx(unit, "FUS RO DAH", '#4068a0');
      },
      thuum_echo() {
        this.ctx.units
          .filter((a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(unit, a) < 95)
          .forEach((a) => {
            a.morale = Math.min(a.maxMorale, a.morale + 3);
            a.rallyTimer = Math.max(a.rallyTimer || 0, 70);
          });
        for (const e of this.ctx.units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (this.ctx.unitDistance(unit, e) < 80) e.morale = Math.max(0, e.morale - 2);
        }
        this.procAbilityVfx(unit, "THU'UM", '#708090');
      },
      shield_wall() {
        if (unit.hp / unit.maxHp < 0.55 && (unit.shieldWallCd || 0) <= 0) {
          unit.shieldWallCd = 200;
          unit.rallyTimer = 90;
          this.procAbilityVfx(unit, 'SHIELD WALL', '#506878');
        }
      },
      dragon_aspect() {
        if (isEliteEnemy?.(target) || target?.isNamedBoss || target?.type === 'war_chief') {
          this.ctx.takeDamage(target, Math.round(dmg * 0.45), { dragonStrike: true, crit: true });
          this.procAbilityVfx(unit, 'DRAGON ASPECT', '#6040a8');
        }
      },
      shadow_strike() {
        if (target.hp / target.maxHp < 0.45)
          this.ctx.takeDamage(target, Math.round(dmg * 0.7), { crit: true });
      },
      mara_blessing() {
        this.ctx.units
          .filter((a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(unit, a) < 85)
          .forEach((a) => {
            a.hp = Math.min(a.maxHp, a.hp + 4);
            a.morale = Math.min(a.maxMorale, a.morale + 1);
          });
      },
    };

    try {
      if (ab && handlers[ab]) handlers[ab].call(this);

      const syns = this.activeSynergies;
      const killHeal = syns.find((s) => s.bonus.killHeal);
      if (killHeal && target.hp <= 0 && unit.isCrossover) {
        const ally = this.ctx.units.find((a) => a.team === 'player' && a.hp > 0 && a.hp < a.maxHp);
        if (ally)
          ally.hp = Math.min(ally.maxHp, ally.hp + coolInt(killHeal.bonus.killHeal, 0));
      }
    } finally {
      if (origTake) this.ctx.takeDamage = origTake;
      if (origRad) this.ctx.damageInRadius = origRad;
    }
  }

  onBarracksComplete(b) {
    const faction = b.crossoverFaction;
    const prof = this.PROFILES[faction];
    if (prof) {
      this.ctx?.showMessage?.(`${prof.label} HQ operational — ${prof.identity}`, 340);
      FloatingText?.status(b.x, b.y - 18, prof.label.split('/')[0].trim(), prof.palette[0]);
      this.playFactionSfx(faction);
    }
  }

  patchBuildDefs() {
    for (const [fid, prof] of Object.entries(this.PROFILES)) {
      if (!prof.building || typeof BuildDefs === 'undefined') continue;
      const def = BuildDefs[prof.building];
      if (!def) continue;
      if (fid !== 'wwe') {
        def.cost = this.STANDARD_BARRACKS_COST;
        def.requiresBuilders = prof.requiresBuilders || this.STANDARD_BARRACKS_BUILDERS;
      }
      if (prof.recommendedHamlets) def.recommendedHamlets = prof.recommendedHamlets;
      def.factionTheme = prof.label;
      def.factionLore = prof.lore;
    }
  }

  /** Audit parity across evolved factions (barracks, mastery, seasonal, synergies, counters). */
  auditFairRepresentation() {
    const factions = Object.keys(CrossoverFactions || {});
    const synergyCount = {};
    for (const f of factions) synergyCount[f] = 0;
    for (const s of this.SYNERGIES) {
      for (const f of s.factions) {
        if (synergyCount[f] != null) synergyCount[f]++;
      }
    }
    const issues = [];
    for (const f of factions) {
      const prof = this.PROFILES[f];
      const def = prof?.building ? BuildDefs?.[prof.building] : null;
      if (
        def &&
        (def.cost !== this.STANDARD_BARRACKS_COST ||
          def.requiresBuilders !== this.STANDARD_BARRACKS_BUILDERS)
      ) {
        issues.push(`${f}: barracks cost/builders not normalized`);
      }
      if (!this.MASTERY_CHALLENGES.some((c) => c.faction === f))
        issues.push(`${f}: missing mastery challenge`);
      if (!this.SEASONAL_EVENTS.some((e) => e.factions.includes(f)))
        issues.push(`${f}: missing seasonal event`);
      if ((synergyCount[f] || 0) < 2) issues.push(`${f}: fewer than 2 synergies`);
      const inCounter = Object.values(this.ENEMY_COUNTERS).some((c) => c.weakFactions.includes(f));
      if (!inCounter) issues.push(`${f}: missing enemy counter matchup`);
      if (f !== 'doom' && !prof?.weaknessMods) issues.push(`${f}: missing mechanical weaknessMods`);
    }
    return { ok: issues.length === 0, issues, synergyCount };
  }

  isPlanetWarfareActive(wave) {
    const w = wave ?? this.ctx?.wave ?? 0;
    const pw = this._svc('PlanetWarfare');
    // Prefer PlanetWarfare module when present; otherwise unlock at PLANET_WARFARE_WAVE
    // so crossover settlement-siege bonuses still work after the macro layer was removed.
    if (pw && typeof pw.isActive === 'function') return !!pw.isActive(w);
    return w >= (this.PLANET_WARFARE_WAVE || 200);
  }

  getPlanetWarfareOp(ability) {
    return ability ? this.PLANET_WARFARE_OPERATIVES[ability] || null : null;
  }

  isPlanetSiegeSpecialist(unit, wave) {
    if (!unit || (!unit.isCrossover && !unit.isWwe)) return false;
    if (!this.isPlanetWarfareActive(wave)) return false;
    return !!this.getPlanetWarfareOp(unit.wweAbility);
  }

  getPlanetStructureMult(unit, building, op) {
    if (!op || !building) return 1;
    let mult = 1;
    if (building.isHamlet || building.isMerchantGuild || building.isEnemySettlement) {
      mult *= op.settlementMult || op.hamletMult || 1;
    }
    if (
      building.type === 'enemy_trade_outpost' ||
      building.type === 'enemy_quarry' ||
      building.type === 'trade_outpost' ||
      building.type === 'quarry'
    ) {
      mult *= op.outpostMult || 1;
    }
    if (building.type === 'enemy_shadow_academy' || building.type === 'enemy_war_academy') {
      mult *= op.academyMult || 1;
    }
    if ((building.maxHp || building.hp || 0) >= (op.heavyHp || 9999)) mult *= op.heavyMult || 1;
    if (unit.chargeTimer > 20 && op.chargeBonus) mult *= 1 + op.chargeBonus;
    return mult;
  }

  modifyBuildingDamage(unit, building, baseDmg, wave) {
    const op = this.getPlanetWarfareOp(unit?.wweAbility);
    if (!op || !this.isPlanetWarfareActive(wave)) return baseDmg;
    let dmg = Math.floor(baseDmg * this.getPlanetStructureMult(unit, building, op));
    const hpRatio = building.hp / Math.max(1, building.maxHp || building.hp || 1);
    if (op.finisherHp && hpRatio <= op.finisherHp) dmg = Math.floor(dmg * (op.finisherMult || 1.5));
    if (op.deleteHp && hpRatio <= op.deleteHp) dmg = Math.floor(dmg * (op.deleteMult || 2));
    return Math.max(6, dmg);
  }

  splashPlanetStructures(unit, building, dmg, wave, op) {
    if (!op?.splashRadius || !this.ctx?.buildings || !this.ctx.damageBuilding) return;
    const radius = op.splashRadius;
    const mult = op.splashMult || 0.25;
    for (const b of this.ctx.buildings) {
      if (!b || b.id === building.id || b.owner !== 'enemy' || b.hp <= 0) continue;
      if (
        !b.isEnemySettlement &&
        !b.isHamlet &&
        !b.isMerchantGuild &&
        !b.isResourceGen &&
        !b.type?.startsWith('enemy_')
      )
        continue;
      const d = this.ctx.unitDistance(building, b);
      if (d > radius) continue;
      const splashDmg = Math.max(4, Math.floor(dmg * mult * (1 - d / (radius + 1))));
      this.ctx.damageBuilding(b, splashDmg);
    }
  }

  onPlanetStructureStrike(unit, building, dmg, wave, opts = {}) {
    const op = this.getPlanetWarfareOp(unit?.wweAbility);
    if (!op || !this.isPlanetWarfareActive(wave) || !building) return;
    unit.planetStrikeCount = (unit.planetStrikeCount || 0) + 1;
    const shouldSplash =
      op.splashRadius && (!op.everyNth || unit.planetStrikeCount % op.everyNth === 0);
    if (shouldSplash) {
      this.splashPlanetStructures(unit, building, dmg, wave, op);
      this.procAbilityVfx(
        unit,
        op.label.toUpperCase(),
        this.PROFILES[op.faction]?.palette?.[0] || '#ffd700'
      );
    }
    if (op.finisherHp && building.hp > 0) {
      const ratio = building.hp / Math.max(1, building.maxHp || building.hp);
      if (ratio <= op.finisherHp && ratio > 0) {
        FloatingText?.status(building.x, building.y - 12, 'RAZE!', '#ff8040');
      }
    }
  }

  formatSynergyTable() {
    return this.SYNERGIES.map((s) => `• ${s.name} (${s.factions.join(' + ')}): ${s.desc}`).join(
      '\n'
    );
  }

  formatPlanetOpsTable() {
    return Object.values(this.PLANET_WARFARE_OPERATIVES)
      .map(
        (op) =>
          `• ${op.operative} — ${op.label} (${this.PROFILES[op.faction]?.label || op.faction}): ${op.desc}`
      )
      .join('\n');
  }

  getEncyclopediaEntries() {
    const entries = [
      {
        cat: 'crossover_meta',
        name: 'Evolved Allies — Design Philosophy',
        body: [
          'Evolved operatives are your evolved allies — rare power spikes early, full faction armies mid-game, and planet-scale demolition experts late.',
          '',
          'The host evolves its factions (Grunts → Kingdom). Your evolved allies mirror that curve: a single bound-spirit operative can flip a siege at wave 15; by wave 80 a mixed roster with synergies feels like fielding evolved monsters of your own; after wave 200, Planet Warfare operatives raze northern holds and push the hostile front line back.',
          '',
          'Vanilla troops still anchor the line — evolved allies reward investment, not replacement. Secret rosters (Coliseum, Doomslayer) and Tonic Stations machines unlock alongside evolved barracks.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Early Game — Rare Power Spikes',
        body: [
          'Waves 1–30 (Outpost Realm): one or two evolved operatives are expensive but fight like mini-bosses.',
          '',
          '• Unlock a faction via secret roster code (or research), build its barracks (90 TP, 2 builders) from wave 1, recruit through Legion Archive.',
          '• Deploy cost is steep vs footmen — treat each operative as a wave-saving spike, not a swarm.',
          `• Field soft cap (${this.FIELD_SOFT_CAP}) rarely matters; mix 1–3 evolved allies with vanilla line-holders for the +5% support aura.`,
          '• Enemy faction counters (necromancers vs bound spirits, harpies vs melee-heavy rosters) start appearing — diversify or accept host answers.',
          '• Coliseum Guest Star and seasonal events can spike morale on wave start — strong opener before academies mature.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Late Game — Faction Armies & Synergies',
        body: [
          'From wave 1 with a meta-unlocked faction: place barracks, recruit operatives (fair TP costs ~18–33). Later waves: more barracks, settlement TP, and veteran stars grow full faction armies.',
          '',
          '• Stack cross-faction synergies — each active pair buffs melee, ranged accuracy, ability damage, siege, or morale:',
          this.formatSynergyTable(),
          '',
          `• Four Worlds (4+ factions): +5% all evolved ally damage — the "evolved monster horde" peak.`,
          '• Mastery tiers (kills, ability procs, challenges) add morale ceiling and Legion Archive titles.',
          '• Kingdom loadouts (wave 100+) and colony value steer enemy composition — tailor synergies to counter the host (March of War vs wall-heavy turtles, Skyburst Spirit for sustain).',
          '• Doomslayer (Doomslayer difficulty, wave 200) and coliseum finishers anchor boss waves while synergies carry the line.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Planet Warfare Operatives (Wave 200+)',
        body: [
          `After wave ${this.PLANET_WARFARE_WAVE}, Planet Warfare expands hostile territory south. Evolved operatives with settlement-siege abilities gain full siege treatment and bonus damage vs enemy holds:`,
          '',
          this.formatPlanetOpsTable(),
          '',
          'Hunt mode + Planet Warfare: operatives prioritize northern hamlets, guilds, trade posts, and academies. Splash abilities (Stone Axe Lord, Kael Skyburst, Heavy Gunner, Storm Caller) clear clustered mirror economy. Razing holds pushes map control back — pair with Settlement Raid strike forces and spy intel.',
          '',
          'Planet Conquest (wave 500+) extends the same logic to sector warfare — evolved armies must shatter the Worldheart Tyrant while holding three+ unit types for ward break.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Secret Content & Meta Unlocks',
        body: [
          'Secret rosters sit outside the standard evolved-allies tree:',
          '• Grand Coliseum Champions (WWE / Iron Creed academy) — showmanship morale bombs and finishers (Guest Star synergy with any second faction).',
          '• Doomslayer — Hell anchor unlocked on Doomslayer difficulty after wave 200; single-entity apocalypse (hellscape wave 1001+ normalizes his damage).',
          '',
          'Meta progression:',
          '• Tonic Stations machines unlock after any secret roster (Coliseum, Doom, or evolved allies) is active — Ironbrew, Tombstone, Twinshot Brew, and hidden machines.',
          '• Multiversal achievements track 3+ and 5+ factions fielded; synergy achievements fire when named pairs deploy.',
          '• Mastery tier 3+ unlocks creative titles; tier 4 unlocks faction skins in Creative Lab.',
          '• Crown Legacies and Honor Heirs carry evolved veterans across runs.',
          '',
          'The Crown does not publish cheat codes in the encyclopedia — discover roster unlocks through play, achievements, and community lore.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Faction Mastery',
        body: 'Earn mastery points from evolved ally kills, ability procs, and wave clears. Tiers unlock titles shown in Legion Archive. Mastery never replaces vanilla troops — it rewards dedication. Mastery challenges (Grand Bout, Wolf Pack, Golden Ball Run, etc.) grant +25 mastery when completed.',
      },
      {
        cat: 'crossover_meta',
        name: 'Cross-Faction Synergies',
        body: this.formatSynergyTable(),
      },
      {
        cat: 'crossover_meta',
        name: 'Balance Philosophy',
        body: `Evolved operatives are powerful but not mandatory. Fielding more than ${this.FIELD_SOFT_CAP} evolved units incurs a soft damage penalty (~3% per operative over cap, floor 72%). Keeping vanilla troops ≥ evolved ally count grants a +5% support bonus when vanilla count ≥ 4. Barracks and recruits are available from wave 1 once unlocked.`,
      },
      {
        cat: 'crossover_meta',
        name: 'Seasonal Events',
        body: this.SEASONAL_EVENTS.map((e) => `${e.name} (${e.months.join('/')}): ${e.desc}`).join(
          '\n'
        ),
      },
    ];
    for (const [id, prof] of Object.entries(this.PROFILES)) {
      if (id === 'doom' || id === 'wwe') continue;
      const planetOps = Object.values(this.PLANET_WARFARE_OPERATIVES)
        .filter((op) => op.faction === id)
        .map((op) => op.operative);
      const planetNote = planetOps.length
        ? `\n\nPlanet Warfare (wave ${this.PLANET_WARFARE_WAVE}+): ${planetOps.join(', ')} gain settlement-siege bonuses.`
        : '';
      entries.push({
        cat: `crossover_${id}`,
        name: `${prof.label} — Faction Profile`,
        body: `${prof.lore}\n\nIdentity: ${prof.identity}\n\nWeakness: ${prof.weakness}\n\nPlaystyle: ${prof.playstyle}${planetNote}`,
      });
    }
    entries.push({
      cat: 'crossover_meta',
      name: 'Coliseum & Doomslayer — Secret Evolved Allies',
      body: [
        `${this.PROFILES.wwe?.lore || 'Grand Coliseum Champions bring the grand arena to your siege.'}`,
        '',
        `Coliseum — ${this.PROFILES.wwe?.identity || 'Showmanship morale bombs and finishers.'} ${this.PROFILES.wwe?.playstyle || ''}`,
        '',
        `${this.PROFILES.doom?.lore || 'The Doomslayer walks from Hell.'}`,
        '',
        `Doomslayer — ${this.PROFILES.doom?.identity || 'Single-entity apocalypse.'} ${this.PROFILES.doom?.playstyle || ''}`,
      ].join('\n'),
    });
    return entries;
  }

  getCreativeUnlocks() {
    const unlocks = [];
    for (const fid of Object.keys(this.PROFILES)) {
      if (this.getMasteryTier(fid) >= 3) unlocks.push(`title_${fid}`);
      if (this.getMasteryTier(fid) >= 4) unlocks.push(`creative_skin_${fid}`);
    }
    return unlocks;
  }

  getActiveSynergies() {
    return this.activeSynergies;
  }

  /** Hot-reload synergies from GameData after mod pack swap. */
  refreshGameData(synergies) {
    this.SYNERGIES = synergies || (typeof GameData !== 'undefined' ? GameData.synergies : []);
    this.patchBuildDefs();
  }
}

/** Singleton — preserves legacy `FactionDepth.method()` API. */
const FactionDepth = new FactionDepthSystem();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.FactionDepth = FactionDepth;
