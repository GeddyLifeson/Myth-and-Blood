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
 * - modifyBuildingDamage / isPlanetSiegeSpecialist — the northern war hooks
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
      label: 'Bloodsand Champions',
      building: 'wwe_academy',
      palette: ['#c04040', '#ffd700'],
      identity:
        'Pit champions: morale for the line, finishing blows for elites, and strength in pairs.',
      weakness: 'High TP cost; exposed to sustained ranged fire before their finishing blows land.',
      weaknessMods: { vsFlying: 0.9, damageTakenRanged: 1.12 },
      playstyle: 'Deploy 2–4 for morale; save finishing blows for elite waves.',
      lore: 'Every champion in the hall won freedom on the bloodsand and sold it again for a better price. They fight for the name carved on the wall, and the siege is one more bout.',
      sfx: 'wwe',
      requiresWave: 0,
      requiresBuilders: 10,
      masteryTitle: ['Pit Hand', 'Crowd Favourite', 'Name on the Wall', 'First of the Hall'],
    },
    doom: {
      label: 'Abyss Walker',
      building: null,
      palette: ['#40c040', '#1a3018'],
      identity: 'One fighter worth an army: he kills, mends himself on the kill, and endures.',
      weakness: 'Extreme TP cost; hellscape (wave 1001+) normalizes his damage.',
      playstyle:
        'Unlock via Hellbreaker difficulty wave 200; let him anchor, not replace your army.',
      lore: 'They say he walked out of the deepest abyss, blade humming with the wrath of every soul left behind.',
      sfx: 'doom',
      masteryTitle: ['Walker', 'Abyss Hunter', 'Hellbreaker', 'Wrath Unburied'],
    },
    ultimis: {
      label: 'Powderhorn Company',
      building: 'element_barracks',
      palette: ['#c06030', '#8040a0'],
      identity:
        'Four powder-men: fused pots for crowds, bottled lightning for elites, and a cooper who will not fall.',
      weakness: 'The storm-bottler is fragile; clustered undead overwhelm them without walls.',
      // vsSwarm is damage-taken mult — >1 means weaker vs swarms (not a buff).
      weaknessMods: { vsUndead: 0.88, vsSwarm: 1.12, damageTakenRanged: 1.08 },
      playstyle:
        'The cooper anchors the front; the storm-bottler stays behind walls; the fencer hunts elites.',
      lore: 'Four sellswords who learned black powder from a mine that killed everyone else in it. They hire out to any wall that can pay, and leave before the smoke clears.',
      sfx: 'ultimis',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Powder Monkey', 'Fuse-Cutter', 'Mine Veteran', 'Master of the Horn'],
    },
    primis: {
      label: 'The Pale Vigil',
      building: 'primis_shrine',
      palette: ['#d07040', '#9040c0'],
      identity:
        'Barrow knights: sweeping blows, a bulwark who hardens when hurt, and a leech who heals from the enemy.',
      weakness: 'Costly; needs its shrine built before recruits can be called.',
      weaknessMods: { vsArcane: 0.9, vsUndead: 0.92 },
      playstyle: 'The bulwark anchors the line; the leech mends the others from what he drains.',
      lore: 'An order of knights sworn to watch the old barrows so that nothing climbs out. When the dead began to march anyway, the Vigil came down to meet them.',
      sfx: 'primis',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      recommendedHamlets: 1,
      masteryTitle: ['Vigil Novice', 'Barrow Keeper', 'Tomb Scholar', 'Warden of the Last Door'],
    },
    halo: {
      label: 'The Greywatch',
      building: 'spartan_academy',
      palette: ['#408040', '#80c0ff'],
      identity: 'Armoured crossbow wardens: a shield line, called targets, and hobbling bolts.',
      weakness: 'Its melee heroes must be screened; the citadel hall is expensive.',
      weaknessMods: { vsMeleeRush: 0.92, damageTakenMelee: 1.1 },
      playstyle:
        'Springald and marksman at the back; the lieutenant calls targets; the serjeant rallies at wave start.',
      lore: 'The Greywatch has held one mountain citadel for three hundred years and has never opened its gate to an enemy. Its wardens come down only when a wall elsewhere is about to fail.',
      sfx: 'halo',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Recruit', 'Warden', 'Watch-Serjeant', 'Warden-Captain'],
    },
    gears: {
      label: 'Sawtooth Company',
      building: 'cog_academy',
      palette: ['#506080', '#c04040'],
      identity:
        'Ditch-fighting crossbowmen: saw-edged finishers, shield-mates, and engine-breaking.',
      weakness: 'The recruits are fragile; the company fights best around its captain.',
      weaknessMods: { vsFlying: 0.9, vsBerserker: 0.9, damageTakenRanged: 1.08 },
      playstyle:
        'Captain and shield-mate at the core; the artificer for towers; the battering man on the flank.',
      lore: 'A mercenary company that has fought every war from the bottom of a ditch. Its saw-backed glaives were made for cutting stakes and turned out to cut goblins as well.',
      sfx: 'gears',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Ditcher', 'Tunnel Killer', 'Siege Veteran', 'Last in the Ditch'],
    },
    lotr: {
      label: 'Thornroad Company',
      building: 'rivendell_camp',
      palette: ['#406050', '#c0a040'],
      identity:
        'Road-wardens: a priest who breaks nerve, a longbow for range, and a captain who kills elites.',
      weakness: 'The runner is soft; the camp is expensive; slow to field the whole company.',
      weaknessMods: { vsAssassin: 0.88, damageTakenStealth: 1.12, vsFlying: 0.92 },
      playstyle: 'Priest in the middle; longbow in the garrison; axeman on siege waves.',
      lore: 'Seven guards-for-hire who keep the pilgrim road through the thorn country. The shrines they were paid to protect are burning, so they have come to the source.',
      sfx: 'lotr',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Wayfarer', 'Road-Sworn', 'Shrine Keeper', 'Warden of the Road'],
    },
    baki: {
      label: 'Knucklebone Lodge',
      building: 'hanma_dojo',
      palette: ['#c04040', '#606060'],
      identity:
        'Bare-handed melee: stronger when hurt, bodies like iron, and a master who cannot be stopped.',
      weakness: 'No ranged; kited by harpies and mages; the master is costly.',
      weaknessMods: { vsFlying: 0.8, vsRanged: 0.88, damageTakenRanged: 1.15 },
      playstyle:
        'Prodigy and instructor in the line; the Anvil soaks; keep the master for boss waves.',
      lore: 'A fighting guild that settles rank by bouts and marks it in knucklebones worn at the belt. The lodge treats your siege as one more bout, and it does not forfeit.',
      sfx: 'baki',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Pit Novice', 'Fighter', 'Knucklebone Holder', 'Ogre Breaker'],
    },
    jojo: {
      label: 'The Marrow Choir',
      building: 'stand_arrow_shrine',
      palette: ['#8040a0', '#e0c040'],
      identity:
        'Relic-singers of every trade: hymns that burn the dead, snares, finishers, and four outriders.',
      weakness:
        'The outriders need space; the hymns falter against necromancer hordes without walls.',
      weaknessMods: { vsUndead: 0.85, vsNecromancer: 0.88, damageTakenRanged: 1.1 },
      playstyle: 'Mix their trades; the enforcer pins elites; the outriders hunt on open ground.',
      lore: "A cult that carries its saints' bones into battle and sings over them. The hymns work, which is the only reason the church has not burned the choir.",
      sfx: 'jojo',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Bone Carrier', 'Choir Acolyte', 'Cantor', 'Voice of the Reliquary'],
    },
    fotns: {
      label: 'Order of the Quiet Hand',
      building: 'north_star_dojo',
      palette: ['#4080c0', '#c0c0e0'],
      identity:
        'Monks who kill bare-handed: fast finishers, a healer, and an abbot who breaks nerve.',
      weakness: 'Melee only; the abbot is slow; needs its healer to last.',
      weaknessMods: { vsFlying: 0.82, vsRanged: 0.9, damageTakenRanged: 1.12 },
      playstyle:
        'The order’s Hand on elites; the infirmarian’s aura; the sweeping monk chases fast foes.',
      lore: 'An ascetic order that gave up weapons and then found it did not need them. Its monks speak rarely and strike once.',
      sfx: 'fotns',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Novice', 'Brother', 'Master', 'Abbot-Militant'],
    },
    dragonball: {
      label: 'Emberblood Warband',
      building: 'capsule_corp',
      palette: ['#e06040', '#4060c0'],
      identity:
        'Fire in the blood: burst finishers, fury when wounded, and a flame that feeds on kills.',
      weakness: 'Its burst fighters need TP to field; the Pyre is the costliest of all.',
      weaknessMods: { vsArcane: 0.88, vsAssassin: 0.9, damageTakenStealth: 1.1 },
      playstyle:
        'Champion and rival at the core; seers throw from the rear; save the Pyre for bosses.',
      lore: 'A hill warband whose blood runs hot enough to scorch. They follow whoever burns brightest, and they came south because the cold was leaving them.',
      sfx: 'dragonball',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Kindling', 'Emberblood', 'Flame-Bearer', 'The Pyre'],
    },
    imperium: {
      label: 'Order of the Iron Psalm',
      building: 'astartes_chapel',
      palette: ['#4060a0', '#802030'],
      identity:
        'A militant church order: ordered volleys, a provost for the routed, tower shields, and a bombard.',
      weakness:
        'Slow heavy armour; an expensive chapel; weak to swarm flanks before walls are set.',
      weaknessMods: { vsSwarm: 1.12, vsAssassin: 0.9, damageTakenStealth: 1.1 },
      playstyle:
        'Castellan and hex-finder at the back; tower shields in front; the provost for morale.',
      lore: 'A church order that sings its psalms in armour and counts every enemy an unbeliever. It tithes its levies from villages that would rather not be asked.',
      sfx: 'imperium',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Initiate', 'Brother', 'Castellan', 'Master of the Order'],
    },
    crystal: {
      label: 'Saltglass Guild',
      building: 'crystal_sanctum',
      palette: ['#5080c0', '#c04060'],
      identity:
        'Glassmakers at war: kiln-fire, a physic, a vaulting lancer, and a blade that peaks when breaking.',
      weakness:
        'The casters are fragile; the lancer needs space; the Flawed Blade must be hurt first.',
      weaknessMods: { vsMeleeRush: 0.9, damageTakenMelee: 1.1, vsFlying: 0.95 },
      playstyle:
        'Guild Blade in front; physic in the middle; Kiln-Witch and Lens-Caller at the back.',
      lore: 'The glassmakers of the salt coast guard their furnace secrets with hired blades and their own burned hands. A lens that can light a ship at a mile lights a goblin just as well.',
      sfx: 'crystal',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Apprentice', 'Journeyman', 'Guild Master', 'Master of the Furnace'],
    },
    warp: {
      label: 'Cult of the Open Wound',
      building: 'warp_shrine',
      palette: ['#802040', '#6040c0'],
      identity:
        'A blood cult: forked curses, weeping sores, burning bolts, and healing on the kill.',
      weakness: 'Low morale; cultists break fast; risky without a steadier company beside them.',
      weaknessMods: { vsArcane: 0.9, damageTakenRanged: 1.1, vsNecromancer: 0.88 },
      playstyle:
        'The Chosen and the Healed-Over in front; the Wound-Seer behind; the Pox-Sister for her aura.',
      lore: 'The cult believes the world has a wound that must be kept open, and that it bleeds power for those who tend it. It fights beside you because the host would close the wound for good.',
      sfx: 'warp',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Cultist', 'Wound-Tender', 'Chosen', 'Mouth of the Wound'],
    },
    tes: {
      label: 'Rimehowl Warband',
      building: 'dragon_moot',
      palette: ['#4068a0', '#a06040'],
      identity:
        'Northern raiders: a war-howl that breaks crowds, a cairn-chanter, and a storm-seer.',
      weakness: 'An expensive roster; the Voice must be protected; howls cost TP.',
      weaknessMods: { vsAssassin: 0.9, damageTakenStealth: 1.12, vsSwarm: 1.1 },
      playstyle:
        'The Voice and the cairn-chanter at the core; diversify Eternal Paths for the legacy trial.',
      lore: 'A warband from the ice coast whose war-skalds howl before the charge. The howl carries a mile over snow, and what hears it tends not to wait.',
      sfx: 'tes',
      requiresWave: 0,
      requiresBuilders: FactionDepthSystem.STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Wanderer', 'Howl-Sworn', 'Skald', 'Voice of the Warband'],
    },
  };

  static PLANET_WARFARE_WAVE = typeof RTS_ERA_WAVE !== 'undefined' ? RTS_ERA_WAVE : 200;

  static PLANET_WARFARE_OPERATIVES = {
    tech_head: {
      label: 'Pry and Spike',
      operative: 'Pell Rivetson',
      faction: 'gears',
      siegeMult: 2.25,
      settlementMult: 1.45,
      desc: 'Finds the weak joint — bonus damage vs enemy settlements and siege engines.',
    },
    axe_cleave: {
      label: 'Splitting Stroke',
      operative: 'Dorn Quarrykin',
      faction: 'lotr',
      siegeMult: 2.15,
      settlementMult: 1.35,
      splashRadius: 55,
      splashMult: 0.28,
      desc: "Quarryman's demolition — cleave splashes to nearby enemy holds.",
    },
    german_science: {
      label: "Ram's Canticle",
      operative: 'Gaunt Ironrib',
      faction: 'jojo',
      siegeMult: 1.95,
      outpostMult: 1.55,
      desc: 'Walks through walls — devastates trade posts, quarries, and siege towers.',
    },
    lancer_burst: {
      label: 'Sawback Glaive',
      operative: 'Hale Brandreth',
      faction: 'gears',
      siegeMult: 2.05,
      finisherHp: 0.35,
      finisherMult: 2.15,
      desc: 'Saws through the timbers — finishes wounded enemy structures in the north.',
    },
    hokuto_kaioh: {
      label: 'Heavy Tread',
      operative: 'Gorhame the Unbowed',
      faction: 'fotns',
      siegeMult: 1.88,
      hamletMult: 1.42,
      desc: 'Settlements empty ahead of him — extra damage vs enemy hamlets and guilds.',
    },
    kamehameha: {
      label: 'Ember Burst',
      operative: 'Tavish Coalheart',
      faction: 'dragonball',
      siegeMult: 1.78,
      splashRadius: 72,
      splashMult: 0.34,
      desc: 'A burst of fire — area damage to buildings when striking northern holds.',
    },
    hakai: {
      label: "Pyre's End",
      operative: 'Mother Scoria',
      faction: 'dragonball',
      siegeMult: 1.65,
      deleteHp: 0.25,
      deleteMult: 2.6,
      desc: 'What she touches burns down — destroys structures below 25% HP.',
    },
    weather_stand: {
      label: 'Thunder Response',
      operative: 'Harrow Cloudcall',
      faction: 'jojo',
      siegeMult: 1.72,
      splashRadius: 62,
      splashMult: 0.24,
      desc: 'Storm front — lightning arcs to adjacent enemy economy sites.',
    },
    grenadier: {
      label: 'Springald Shot',
      operative: 'Hulbrand Oxbow',
      faction: 'halo',
      siegeMult: 1.92,
      everyNth: 3,
      splashRadius: 52,
      splashMult: 0.32,
      desc: 'A bolt the size of a fence post — every third strike splashes clustered outposts.',
    },
    special_beam: {
      label: 'Lancing Ember',
      operative: 'Varrow Cindersight',
      faction: 'dragonball',
      siegeMult: 1.88,
      heavyHp: 300,
      heavyMult: 1.48,
      desc: 'A coal thrown like a lance — bonus vs high-HP enemy fortifications.',
    },
    energy_sword: {
      label: 'Scaling Knife',
      operative: 'Rask Notchblade',
      faction: 'halo',
      siegeMult: 1.82,
      academyMult: 1.52,
      desc: 'First over the wall — bonus damage vs shadow and war academies.',
    },
    cole_train: {
      label: 'Downhill Charge',
      operative: 'Jorram Brakeless',
      faction: 'gears',
      siegeMult: 1.76,
      chargeBonus: 0.28,
      desc: 'Run-through demolition — bonus while charging enemy lines in the north.',
    },
    autocannon: {
      label: 'Bronze Bombard',
      operative: 'Tobiah Bronzeback',
      faction: 'imperium',
      siegeMult: 2.1,
      settlementMult: 1.4,
      desc: 'A church bell recast as a gun — bonus damage vs enemy settlements and siege engines.',
    },
    firaga: {
      label: 'Kiln Burst',
      operative: 'Obsidia Kiln',
      faction: 'crystal',
      siegeMult: 1.82,
      splashRadius: 58,
      splashMult: 0.3,
      desc: 'Furnace heat in a bottle — area damage to buildings when striking northern holds.',
    },
    warp_bolt: {
      label: 'Forked Curse',
      operative: 'Ezrin Splitveil',
      faction: 'warp',
      siegeMult: 1.7,
      splashRadius: 48,
      splashMult: 0.26,
      desc: 'The curse forks — a second bolt splashes adjacent enemy economy sites.',
    },
  };

  static ENEMY_COUNTERS = {
    necromancer: {
      weakFactions: ['jojo', 'primis', 'ultimis'],
      mult: 1.22,
      note: 'The dead resist hymns and powder — field walls!',
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
      note: 'Free companies that shoot help here (Greywatch, Emberblood).',
    },
    war_chief: {
      weakFactions: ['ultimis'],
      mult: 1.1,
      note: 'Boss elites punish a reckless rush.',
    },
    assassin: {
      weakFactions: ['halo', 'dragonball', 'lotr', 'tes'],
      mult: 1.14,
      note: 'Stealth elites pressure ranged carries.',
    },
    dark_mage: {
      weakFactions: ['dragonball', 'primis', 'jojo'],
      mult: 1.12,
      note: 'Arcane shields blunt ember and kiln bursts.',
    },
    troll: {
      weakFactions: ['ultimis', 'primis'],
      mult: 1.12,
      note: 'Brute hordes overwhelm the powder-men.',
    },
    berserker: {
      weakFactions: ['gears', 'lotr', 'halo'],
      mult: 1.12,
      note: 'Berserkers rush disciplined lines.',
    },
    goblin_sapper: {
      weakFactions: ['halo', 'gears'],
      mult: 1.1,
      note: 'Sappers go for crossbow lines and engines.',
    },
    warg_rider: {
      weakFactions: ['baki', 'fotns', 'lotr', 'wwe'],
      mult: 1.1,
      note: 'Fast cavalry flanks melee-only rosters.',
    },
    bone_summoner: {
      weakFactions: ['crystal', 'imperium'],
      mult: 1.12,
      note: 'Undead summoners resist psalms and curses alike.',
    },
    dark_knight: {
      weakFactions: ['warp', 'crystal', 'imperium'],
      mult: 1.1,
      note: 'Elite armour tests every finishing blow.',
    },
  };

  static MASTERY_CHALLENGES = [
    {
      id: 'wwe_show',
      faction: 'wwe',
      name: 'Four on the Sand',
      desc: 'Clear wave 30 with 4+ champions on the field.',
      wave: 30,
      minField: 4,
    },
    {
      id: 'halo_noble',
      faction: 'halo',
      name: 'Unbroken Watch',
      desc: 'Clear wave 40 with 3+ Greywatch heroes and no allies lost.',
      wave: 40,
      minField: 3,
      flawless: true,
    },
    {
      id: 'lotr_fellowship',
      faction: 'lotr',
      name: 'Full Company',
      desc: 'Field 5+ Thornroad heroes at once.',
      minField: 5,
    },
    {
      id: 'jojo_sbr',
      faction: 'jojo',
      name: 'Outriders',
      desc: 'Field 2+ Marrow Choir outriders.',
      flag: 'jojo_cavalry',
    },
    {
      id: 'db_zenkai',
      faction: 'dragonball',
      name: 'Burning Tally',
      desc: 'Score 200 lifetime Emberblood kills.',
      kills: 200,
    },
    {
      id: '115_moon',
      faction: 'ultimis',
      name: 'Spent Powder',
      desc: 'Trigger 50 Powderhorn abilities (lifetime).',
      abilities: 50,
    },
    {
      id: 'primis_cycle',
      faction: 'primis',
      name: 'Three at the Door',
      desc: 'Field 3+ Pale Vigil heroes at once.',
      minField: 3,
    },
    {
      id: 'cog_last_stand',
      faction: 'gears',
      name: 'Last in the Ditch',
      desc: 'Clear wave 35 with 3+ Sawtooth heroes on the field.',
      wave: 35,
      minField: 3,
    },
    {
      id: 'dojo_champion',
      faction: 'baki',
      name: 'Knucklebones Won',
      desc: 'Score 150 lifetime Knucklebone Lodge kills.',
      kills: 150,
    },
    {
      id: 'hokuto_successor',
      faction: 'fotns',
      name: 'The Quiet Hand',
      desc: 'Trigger 40 Quiet Hand abilities (lifetime).',
      abilities: 40,
    },
    {
      id: 'astartes_line',
      faction: 'imperium',
      name: 'Psalm Line',
      desc: 'Clear wave 45 with 3+ Iron Psalm heroes on the field.',
      wave: 45,
      minField: 3,
    },
    {
      id: 'crystal_hero',
      faction: 'crystal',
      name: 'Guild Honours',
      desc: 'Score 150 lifetime Saltglass Guild kills.',
      kills: 150,
    },
    {
      id: 'warp_ritual',
      faction: 'warp',
      name: 'Tending the Wound',
      desc: 'Trigger 35 Open Wound abilities (lifetime).',
      abilities: 35,
    },
    {
      id: 'tes_dragonborn',
      faction: 'tes',
      name: 'Howl at the Gate',
      desc: 'Clear wave 38 with 2+ Rimehowl heroes on the field.',
      wave: 38,
      minField: 2,
    },
  ];

  static SEASONAL_EVENTS = [
    {
      id: 'moon_rounds',
      months: [1],
      name: 'Spent Powder',
      factions: ['ultimis'],
      bonus: { abilityDmg: 0.08 },
      desc: 'Powderhorn Company abilities +8% in January.',
    },
    {
      id: 'primis_ascension',
      months: [2],
      name: 'Barrow Vigil',
      factions: ['primis'],
      bonus: { dmg: 0.08 },
      desc: 'Pale Vigil damage +8% in February.',
    },
    {
      id: 'wrestlemania',
      months: [3, 4],
      name: 'Bloodsand Season',
      factions: ['wwe'],
      bonus: { morale: 8 },
      desc: 'Bloodsand Champions morale +8 on recruit.',
    },
    {
      id: 'cog_siegebreak',
      months: [5],
      name: 'Ditch Season',
      factions: ['gears'],
      bonus: { siegeDmg: 0.1 },
      desc: 'Sawtooth Company siege damage +10% in May.',
    },
    {
      id: 'stand_summer',
      months: [6, 7],
      name: 'High Summer Hymn',
      factions: ['jojo'],
      bonus: { abilityDmg: 0.1 },
      desc: 'Marrow Choir abilities +10% Jun–Jul.',
    },
    {
      id: 'saiyan_saga',
      months: [8],
      name: 'Dog-Day Fires',
      factions: ['dragonball', 'crystal'],
      bonus: { dmg: 0.1 },
      desc: 'Emberblood Warband and Saltglass Guild damage +10% in August.',
    },
    {
      id: 'fellowship_march',
      months: [9],
      name: 'Pilgrim Month',
      factions: ['lotr'],
      bonus: { moraleRegen: 3 },
      desc: 'Thornroad Company grants +3 morale/round in September.',
    },
    {
      id: 'hanma_open',
      months: [10],
      name: 'Lodge Bouts',
      factions: ['baki'],
      bonus: { meleeDmg: 0.1 },
      desc: 'Knucklebone Lodge melee damage +10% in October.',
    },
    {
      id: 'spartan_day',
      months: [11],
      name: 'Muster of the Walls',
      factions: ['halo', 'imperium'],
      bonus: { acc: 8 },
      desc: 'Greywatch and Iron Psalm accuracy +8 during November.',
    },
    {
      id: 'hokuto_winter',
      months: [12],
      name: 'Fasting Winter',
      factions: ['fotns', 'warp'],
      bonus: { abilityDmg: 0.08 },
      desc: 'Quiet Hand and Open Wound abilities +8% in December.',
    },
    {
      id: 'dragons_dawn',
      months: [7],
      name: 'Thaw Raid',
      factions: ['tes', 'lotr'],
      bonus: { abilityDmg: 0.09 },
      desc: 'Rimehowl Warband and Thornroad Company abilities +9% in July.',
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

  /** Evolved operatives with enhanced northern-hold demolition at wave 200+ (the northern war). */

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
    if (mods.vsNecromancer && target?.type === 'necromancer')
      d = Math.round(d * mods.vsNecromancer);
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
        'The cairn-chanter’s chant comes true — your army surges for a short while!',
        320
      );
    }
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0 || !u.isCrossover) continue;
      this.applyWarhammerDuty(u);
      if (u.faithFuryActive) {
        u.morale = Math.min(u.maxMorale, u.morale + 3);
        FloatingText?.status(u.x, u.y - 12, 'PSALM AND IRON', '#c04040');
      }
      const ab = u.wweAbility;
      const cool = typeof ABILITY_COOL_MULT === 'number' ? ABILITY_COOL_MULT : 1.2;
      const coolInt = (n, min = 1) =>
        typeof coolAbilityInt === 'function'
          ? coolAbilityInt(n, min)
          : Math.max(min, Math.round(n * cool));
      if (ab === 'spartan_rage' || ab === 'oorah') {
        units
          .filter(
            (a) => a.team === 'player' && a.hp > 0 && this.ctx.unitDistance(u, a) < coolInt(100)
          )
          .forEach((a) => {
            a.morale = Math.min(a.maxMorale, a.morale + coolInt(3, 0));
            a.rallyTimer = Math.max(a.rallyTimer || 0, coolInt(60));
          });
        FloatingText?.status(
          u.x,
          u.y,
          ab === 'oorah' ? 'ROAR!' : 'PAVISES UP',
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
      typeof coolAbilityInt === 'function'
        ? coolAbilityInt(n, min)
        : Math.max(min, Math.round(n * cool));
    const synMult = 1 + (unit.synergyAbility || 0);

    const origTake = this.ctx.takeDamage?.bind(this.ctx);
    const origRad = this.ctx.damageInRadius?.bind(this.ctx);
    if (origTake) {
      // Single cool pass — damageInRadius calls takeDamage, so only scale here.
      this.ctx.takeDamage = (t, amount, opts) => origTake(t, coolInt(Number(amount) || 0), opts);
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
          this.procAbilityVfx(
            unit,
            orbital ? 'POT AND VOLLEY' : 'FUSED POT!',
            orbital ? '#ff8040' : '#c06030'
          );
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
          this.procAbilityVfx(unit, 'SEALED', '#5080a0');
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
        this.procAbilityVfx(unit, 'WARDED', '#c0c0e0');
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
          this.procAbilityVfx(unit, 'EMBER BURST', '#e06040');
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
          FloatingText?.status(target.x, target.y, 'AMBUSH!', '#5080c0');
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
        this.procAbilityVfx(unit, unit.faithFuryActive ? 'PSALM AND IRON' : 'PSALM', '#303848');
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
          this.procAbilityVfx(unit, 'KILN BURST', '#802040');
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
          this.procAbilityVfx(unit, 'SCABBED', '#302030');
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
        if (splash >= 2) this.procAbilityVfx(unit, 'BREAKING HOWL', '#4068a0');
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
        this.procAbilityVfx(unit, 'THE CHANT', '#708090');
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
          this.procAbilityVfx(unit, 'HAIL CALL', '#6040a8');
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
        if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + coolInt(killHeal.bonus.killHeal, 0));
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
      this.ctx?.showMessage?.(`${prof.label} hall raised — ${prof.identity}`, 340);
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
        name: 'Free Companies — How They Fit',
        body: [
          'The free companies are hired heroes — rare power spikes early, whole companies mid-game, and hold-breakers late.',
          '',
          'The host grows as the waves go on (Grunts → Kingdom). The free companies grow with it: a single Marrow Choir hero can turn a siege at wave 15; by wave 80 a mixed roster with synergies is an army of its own; after wave 200, northern-war heroes raze northern holds and push the hostile front line back.',
          '',
          'Your own troops still anchor the line — the free companies reward investment, not replacement. Secret rosters (Champions’ Hall, Hellbane) and Tonic Stations machines unlock alongside company barracks.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Early Game — Rare Power Spikes',
        body: [
          'Waves 1–30 (Outpost Realm): one or two hired heroes are expensive but fight like mini-bosses.',
          '',
          '• Unlock a faction via secret roster code (or research), build its barracks (90 TP, 2 builders) from wave 1, recruit through the Free Companies screen.',
          '• Deploy cost is steep vs footmen — treat each hero as a wave-saving spike, not a swarm.',
          `• Field soft cap (${this.FIELD_SOFT_CAP}) rarely matters; mix 1–3 heroes with your own line-holders for the +5% support aura.`,
          '• Enemy faction counters (necromancers against the Marrow Choir, harpies against melee-heavy rosters) start appearing — diversify or accept host answers.',
          '• The Guest Champion synergy and seasonal events can spike morale on wave start — strong opener before academies mature.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Late Game — Whole Companies & Synergies',
        body: [
          'From wave 1 with a meta-unlocked faction: place barracks, recruit heroes (fair TP costs ~18–33). Later waves: more barracks, settlement TP, and veteran stars grow whole companies.',
          '',
          '• Stack cross-faction synergies — each active pair buffs melee, ranged accuracy, ability damage, siege, or morale:',
          this.formatSynergyTable(),
          '',
          '• Four Banners (4+ companies): +5% damage for every hired hero.',
          '• Mastery tiers (kills, ability procs, challenges) add morale ceiling and titles on the Free Companies screen.',
          '• Kingdom loadouts (wave 100+) and colony value steer enemy composition — tailor synergies to counter the host (pick the pairs that answer what the host is sending).',
          '• Hellbane (Hellbane difficulty, wave 200) and the champions’ finishing blows anchor boss waves while synergies carry the line.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Northern War Heroes (Wave 200+)',
        body: [
          `After wave ${this.PLANET_WARFARE_WAVE}, the host presses south. Heroes with settlement-siege abilities gain full siege treatment and bonus damage vs enemy holds:`,
          '',
          this.formatPlanetOpsTable(),
          '',
          'Hunt mode in the northern war: heroes prioritize northern hamlets, guilds, trade posts, and academies. Splash abilities (Dorn Quarrykin, Tavish Coalheart, Hulbrand Oxbow, Harrow Cloudcall) clear clustered enemy holdings. Razing holds pushes map control back — pair with Settlement Raid strike forces and spy intel.',
          '',
          'Past wave 500 the same logic holds — the companies must shatter the endless host while holding three+ unit types for ward break.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Secret Content & Meta Unlocks',
        body: [
          'Secret rosters sit outside the free-company tree:',
          '• Bloodsand Champions (Champions’ Hall) — morale for the line and finishing blows (Guest Champion synergy with any second company).',
          '• Hellbane — Hell anchor unlocked on Hellbane difficulty after wave 200; one fighter worth an army (hellscape wave 1001+ normalizes his damage).',
          '',
          'Meta progression:',
          '• Tonic Stations machines unlock after any secret roster (Champions’ Hall, Hellbane, or a free company) is active.',
          '• Many-banners achievements track 3+ and 5+ companies fielded; synergy achievements fire when named pairs deploy.',
          '• Mastery tier 3+ unlocks creative titles; tier 4 unlocks faction skins in Creative Lab.',
          '• Crown Legacies and Honor Heirs carry veteran heroes across runs.',
          '',
          'The Crown does not publish cheat codes in the encyclopedia — discover roster unlocks through play, achievements, and community lore.',
        ].join('\n'),
      },
      {
        cat: 'crossover_meta',
        name: 'Faction Mastery',
        body: 'Earn mastery points from hired-hero kills, ability procs, and wave clears. Tiers unlock titles shown on the Free Companies screen. Mastery never replaces your own troops — it rewards dedication. Mastery challenges (Four on the Sand, Unbroken Watch, Outriders, etc.) grant +25 mastery when completed.',
      },
      {
        cat: 'crossover_meta',
        name: 'Company Synergies',
        body: this.formatSynergyTable(),
      },
      {
        cat: 'crossover_meta',
        name: 'Balance Philosophy',
        body: `Hired heroes are powerful but not mandatory. Fielding more than ${this.FIELD_SOFT_CAP} of them incurs a soft damage penalty (~3% per hero over the cap, floor 72%). Keeping your own troops ≥ the hero count grants a +5% support bonus when you have 4 or more of your own. Barracks and recruits are available from wave 1 once unlocked.`,
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
        ? `\n\nNorthern war (wave ${this.PLANET_WARFARE_WAVE}+): ${planetOps.join(', ')} gain settlement-siege bonuses.`
        : '';
      entries.push({
        cat: `crossover_${id}`,
        name: `${prof.label} — Company Profile`,
        body: `${prof.lore}\n\nIdentity: ${prof.identity}\n\nWeakness: ${prof.weakness}\n\nPlaystyle: ${prof.playstyle}${planetNote}`,
      });
    }
    entries.push({
      cat: 'crossover_meta',
      name: 'Champions’ Hall & Hellbane — Secret Rosters',
      body: [
        `${this.PROFILES.wwe?.lore || 'The Bloodsand Champions bring the fighting pit to your siege.'}`,
        '',
        `Champions’ Hall — ${this.PROFILES.wwe?.identity || 'Morale for the line and finishing blows.'} ${this.PROFILES.wwe?.playstyle || ''}`,
        '',
        `${this.PROFILES.doom?.lore || 'The Hellbane walks from Hell.'}`,
        '',
        `Hellbane — ${this.PROFILES.doom?.identity || 'One fighter worth an army.'} ${this.PROFILES.doom?.playstyle || ''}`,
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
