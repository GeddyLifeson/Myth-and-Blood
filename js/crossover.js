/**
 * Crossover cheat rosters — gaming & anime crossovers.
 */
const CROSSOVER_BARRACKS_COST = 280;
const CROSSOVER_BARRACKS_BUILDERS = 4;

const CrossoverFactions = {
  ultimis: { id: 'ultimis', label: 'Element 115', building: 'element_barracks', unlockKey: 'is115Unlocked' },
  primis: { id: 'primis', label: 'Primis Crew', building: 'primis_shrine', unlockKey: 'isPrimusUnlocked' },
  halo: { id: 'halo', label: 'UNSC / Spartans', building: 'spartan_academy', unlockKey: 'isHaloUnlocked' },
  gears: { id: 'gears', label: 'COG Forces', building: 'cog_academy', unlockKey: 'isGearsUnlocked' },
  lotr: { id: 'lotr', label: 'Middle-earth', building: 'rivendell_camp', unlockKey: 'isLotrUnlocked' },
  baki: { id: 'baki', label: 'Hanma Dojo', building: 'hanma_dojo', unlockKey: 'isBakiUnlocked' },
  jojo: { id: 'jojo', label: 'JoJo (Parts 1–7)', building: 'stand_arrow_shrine', unlockKey: 'isJojoUnlocked' },
  fotns: { id: 'fotns', label: 'Fist of the North Star', building: 'north_star_dojo', unlockKey: 'isFotnsUnlocked' },
  dragonball: { id: 'dragonball', label: 'Dragon Ball', building: 'capsule_corp', unlockKey: 'isDragonballUnlocked' },
};

const CrossoverDefs = {
  // Element 115 — Ultimis
  tank_dempsey: {
    name: 'Tank Dempsey', faction: 'ultimis', cost: 72, hp: 210, accuracy: 50, damage: 54,
    range: 28, meleeRange: 28, speed: 1.05, type: 'melee', morale: 28, experience: 12,
    ability: 'frag_out', abilityDesc: 'Frag Out — bonus damage vs clustered foes.',
    color: '#c06030', combatTag: 'melee',
  },
  richtofen: {
    name: 'Richtofen', faction: 'ultimis', cost: 78, hp: 165, accuracy: 52, damage: 48,
    range: 160, meleeRange: 24, speed: 1.0, type: 'ranged', projectile: 'bolt', morale: 24, experience: 13,
    ability: 'wunderwaffe', abilityDesc: 'Mad genius — chain lightning on elite hits.',
    color: '#8040a0', combatTag: 'ranged',
  },
  nikolai: {
    name: 'Nikolai Belinski', faction: 'ultimis', cost: 70, hp: 240, accuracy: 42, damage: 46,
    range: 28, meleeRange: 28, speed: 0.92, type: 'melee', morale: 30, experience: 11,
    ability: 'vodka_rage', abilityDesc: 'Vodka Rage — damage reduction when wounded.',
    color: '#406080', combatTag: 'melee',
  },
  takeo: {
    name: 'Takeo Masaki', faction: 'ultimis', cost: 74, hp: 185, accuracy: 58, damage: 50,
    range: 26, meleeRange: 26, speed: 1.18, type: 'melee', morale: 26, experience: 14,
    ability: 'bushido', abilityDesc: 'Bushido — crit chance rises with stars earned.',
    color: '#308050', combatTag: 'melee',
  },

  // Primis
  primis_tank: {
    name: 'Primis Dempsey', faction: 'primis', cost: 88, hp: 240, accuracy: 54, damage: 58,
    range: 30, meleeRange: 30, speed: 1.08, type: 'melee', morale: 30, experience: 13,
    ability: 'apothicon_slam', abilityDesc: 'Apothicon Slam — cleave on kill.',
    color: '#d07040', combatTag: 'melee',
  },
  primis_nikolai: {
    name: 'Primis Nikolai', faction: 'primis', cost: 86, hp: 270, accuracy: 46, damage: 52,
    range: 30, meleeRange: 30, speed: 0.95, type: 'melee', morale: 32, experience: 12,
    ability: 'iron_curtain', abilityDesc: 'Iron Curtain — brief invulnerability pulse below 35% HP.',
    color: '#5080a0', combatTag: 'melee',
  },
  primis_takeo: {
    name: 'Primis Takeo', faction: 'primis', cost: 90, hp: 200, accuracy: 60, damage: 56,
    range: 28, meleeRange: 28, speed: 1.22, type: 'melee', morale: 28, experience: 15,
    ability: 'katana_fury', abilityDesc: 'Katana Fury — rapid strikes on wounded targets.',
    color: '#40a060', combatTag: 'melee',
  },
  primis_richtofen: {
    name: 'Primis Richtofen', faction: 'primis', cost: 92, hp: 175, accuracy: 55, damage: 52,
    range: 170, meleeRange: 24, speed: 1.02, type: 'ranged', projectile: 'bolt', morale: 26, experience: 14,
    ability: 'summoning_key', abilityDesc: 'Summoning Key — drains elite HP to heal allies.',
    color: '#9040c0', combatTag: 'support',
  },

  // Halo
  master_chief: {
    name: 'Master Chief', faction: 'halo', cost: 120, hp: 320, accuracy: 58, damage: 62,
    range: 180, meleeRange: 28, speed: 1.05, type: 'ranged', projectile: 'arrow', morale: 35, experience: 16,
    ability: 'spartan_rage', abilityDesc: 'Spartan Rage — shields allies near him on wave start.',
    color: '#408040', combatTag: 'ranged',
  },
  noble_six: {
    name: 'Noble Six', faction: 'halo', cost: 95, hp: 220, accuracy: 56, damage: 54,
    range: 175, meleeRange: 26, speed: 1.12, type: 'ranged', projectile: 'arrow', morale: 28, experience: 14,
    ability: 'lone_wolf', abilityDesc: 'Lone Wolf — bonus damage when isolated.',
    color: '#608060', combatTag: 'ranged',
  },
  sgt_johnson: {
    name: 'Sgt. Johnson', faction: 'halo', cost: 88, hp: 250, accuracy: 48, damage: 50,
    range: 30, meleeRange: 30, speed: 0.98, type: 'melee', morale: 38, experience: 12,
    ability: 'oorah', abilityDesc: 'Oorah! — rally pulse and morale on wave start.',
    color: '#a08040', combatTag: 'support',
  },
  noble_carter: {
    name: 'Carter-A259', faction: 'halo', cost: 82, hp: 200, accuracy: 52, damage: 48,
    range: 160, meleeRange: 26, speed: 1.0, type: 'ranged', projectile: 'arrow', morale: 30, experience: 13,
    ability: 'noble_leader', abilityDesc: 'Noble Leader — buffs nearby Spartans.',
    color: '#506050', combatTag: 'support',
  },
  noble_kat: {
    name: 'Kat-B320', faction: 'halo', cost: 80, hp: 175, accuracy: 54, damage: 46,
    range: 165, meleeRange: 24, speed: 1.08, type: 'ranged', projectile: 'arrow', morale: 26, experience: 13,
    ability: 'tech_ops', abilityDesc: 'Tech Ops — debuffs enemy accuracy in aura.',
    color: '#6080a0', combatTag: 'support',
  },
  noble_emile: {
    name: 'Emile-A239', faction: 'halo', cost: 84, hp: 195, accuracy: 50, damage: 58,
    range: 28, meleeRange: 28, speed: 1.1, type: 'melee', morale: 22, experience: 12,
    ability: 'energy_sword', abilityDesc: 'Energy Sword — devastating melee finishers.',
    color: '#804040', combatTag: 'melee',
  },
  noble_jorge: {
    name: 'Jorge-052', faction: 'halo', cost: 100, hp: 340, accuracy: 40, damage: 70,
    range: 140, meleeRange: 30, speed: 0.82, type: 'ranged', projectile: 'bolt', morale: 32, experience: 11,
    ability: 'grenadier', abilityDesc: 'Grenadier — splash damage on every third shot.',
    color: '#705030', combatTag: 'ranged',
  },
  noble_jun: {
    name: 'Jun-A266', faction: 'halo', cost: 86, hp: 180, accuracy: 62, damage: 52,
    range: 220, meleeRange: 24, speed: 1.05, type: 'ranged', projectile: 'arrow', morale: 24, experience: 14,
    ability: 'sniper_cover', abilityDesc: 'Sniper Cover — extreme range, bonus vs elites.',
    color: '#507050', combatTag: 'ranged',
  },
  spartan_soldier: {
    name: 'Spartan-IV', faction: 'halo', cost: 58, hp: 180, accuracy: 50, damage: 42,
    range: 170, meleeRange: 24, speed: 1.05, type: 'ranged', projectile: 'arrow', morale: 22, experience: 10,
    ability: 'spartan_training', abilityDesc: 'Spartan Training — steady ranged DPS.',
    color: '#508050', combatTag: 'ranged',
  },

  // Gears of War
  marcus_fenix: {
    name: 'Marcus Fenix', faction: 'gears', cost: 95, hp: 240, accuracy: 52, damage: 56,
    range: 150, meleeRange: 28, speed: 1.0, type: 'ranged', projectile: 'arrow', morale: 32, experience: 14,
    ability: 'lancer_burst', abilityDesc: 'Lancer Burst — chainsaw finisher on low HP foes.',
    color: '#506080', combatTag: 'ranged',
  },
  dom_santiago: {
    name: 'Dom Santiago', faction: 'gears', cost: 82, hp: 210, accuracy: 48, damage: 48,
    range: 140, meleeRange: 26, speed: 1.02, type: 'ranged', projectile: 'arrow', morale: 34, experience: 12,
    ability: 'brothers_in_arms', abilityDesc: 'Brothers in Arms — heals Marcus when nearby.',
    color: '#6080a0', combatTag: 'support',
  },
  damon_baird: {
    name: 'Damon Baird', faction: 'gears', cost: 78, hp: 175, accuracy: 54, damage: 44,
    range: 160, meleeRange: 24, speed: 1.05, type: 'ranged', projectile: 'arrow', morale: 24, experience: 13,
    ability: 'tech_head', abilityDesc: 'Tech Head — bonus damage vs siege and structures.',
    color: '#a0a040', combatTag: 'ranged',
  },
  augustus_cole: {
    name: 'Augustus Cole', faction: 'gears', cost: 86, hp: 260, accuracy: 44, damage: 58,
    range: 30, meleeRange: 30, speed: 0.95, type: 'melee', morale: 28, experience: 11,
    ability: 'cole_train', abilityDesc: 'Cole Train — charges through enemy lines.',
    color: '#c04040', combatTag: 'melee',
  },
  anthony_carmine: {
    name: 'Anthony Carmine', faction: 'gears', cost: 62, hp: 150, accuracy: 46, damage: 40,
    range: 145, meleeRange: 24, speed: 1.0, type: 'ranged', projectile: 'arrow', morale: 20, experience: 9,
    ability: 'carmine_curse', abilityDesc: 'Carmine Curse — fragile, but cheap lancer support.',
    color: '#608040', combatTag: 'ranged',
  },
  clayton_carmine: {
    name: 'Clayton Carmine', faction: 'gears', cost: 88, hp: 280, accuracy: 42, damage: 62,
    range: 150, meleeRange: 28, speed: 0.88, type: 'ranged', projectile: 'bolt', morale: 30, experience: 11,
    ability: 'heavy_lancer', abilityDesc: 'Heavy Lancer — suppressive fire shreds groups.',
    color: '#708050', combatTag: 'ranged',
  },
  benjamin_carmine: {
    name: 'Benjamin Carmine', faction: 'gears', cost: 68, hp: 165, accuracy: 48, damage: 42,
    range: 145, meleeRange: 24, speed: 1.02, type: 'ranged', projectile: 'arrow', morale: 22, experience: 10,
    ability: 'carmine_brother', abilityDesc: 'Carmine Brother — buffs other Carmines nearby.',
    color: '#508060', combatTag: 'support',
  },
  cog_soldier: {
    name: 'COG Soldier', faction: 'gears', cost: 52, hp: 170, accuracy: 46, damage: 38,
    range: 145, meleeRange: 24, speed: 0.98, type: 'ranged', projectile: 'arrow', morale: 20, experience: 9,
    ability: 'lancer_drill', abilityDesc: 'Lancer Drill — standard COG ranged line-holder.',
    color: '#506070', combatTag: 'ranged',
  },

  // Lord of the Rings
  aragorn: {
    name: 'Aragorn', faction: 'lotr', cost: 98, hp: 250, accuracy: 54, damage: 58,
    range: 30, meleeRange: 30, speed: 1.05, type: 'melee', morale: 36, experience: 15,
    ability: 'anduril', abilityDesc: 'Andúril — bonus damage vs elites and dark knights.',
    color: '#406050', combatTag: 'melee',
  },
  legolas: {
    name: 'Legolas', faction: 'lotr', cost: 92, hp: 180, accuracy: 62, damage: 52,
    range: 220, meleeRange: 26, speed: 1.2, type: 'ranged', projectile: 'arrow', morale: 28, experience: 14,
    ability: 'elven_archer', abilityDesc: 'Elven Archer — extreme range, bonus vs fast foes.',
    color: '#508060', combatTag: 'ranged',
  },
  gimli: {
    name: 'Gimli', faction: 'lotr', cost: 86, hp: 280, accuracy: 44, damage: 56,
    range: 26, meleeRange: 26, speed: 0.88, type: 'melee', morale: 32, experience: 12,
    ability: 'axe_cleave', abilityDesc: 'Axe Cleave — splash on siege targets.',
    color: '#806040', combatTag: 'melee',
  },
  gandalf: {
    name: 'Gandalf', faction: 'lotr', cost: 110, hp: 200, accuracy: 55, damage: 60,
    range: 180, meleeRange: 28, speed: 1.0, type: 'ranged', projectile: 'bolt', morale: 38, experience: 16,
    ability: 'you_shall_not_pass', abilityDesc: 'You Shall Not Pass — terrifies nearby enemies.',
    color: '#c0c0e0', combatTag: 'support',
  },
  frodo: {
    name: 'Frodo', faction: 'lotr', cost: 68, hp: 140, accuracy: 48, damage: 36,
    range: 24, meleeRange: 24, speed: 1.1, type: 'melee', morale: 30, experience: 12,
    ability: 'ring_bearer', abilityDesc: 'Ring Bearer — evasion and morale aura for allies.',
    color: '#608040', combatTag: 'support',
  },
  boromir: {
    name: 'Boromir', faction: 'lotr', cost: 84, hp: 230, accuracy: 46, damage: 54,
    range: 28, meleeRange: 28, speed: 0.95, type: 'melee', morale: 34, experience: 13,
    ability: 'horn_of_gondor', abilityDesc: 'Horn of Gondor — rally pulse when surrounded.',
    color: '#704030', combatTag: 'melee',
  },
  eowyn: {
    name: 'Éowyn', faction: 'lotr', cost: 88, hp: 195, accuracy: 52, damage: 50,
    range: 28, meleeRange: 28, speed: 1.15, type: 'melee', morale: 30, experience: 14,
    ability: 'no_man', abilityDesc: 'I Am No Man — devastating finisher vs elite foes.',
    color: '#a08060', combatTag: 'melee',
  },

  // Baki / Hanma
  baki_hanma: {
    name: 'Baki Hanma', faction: 'baki', cost: 90, hp: 210, accuracy: 56, damage: 58,
    range: 26, meleeRange: 26, speed: 1.18, type: 'melee', morale: 26, experience: 14,
    ability: 'demon_back', abilityDesc: 'Demon Back — damage spikes when below half HP.',
    color: '#c04040', combatTag: 'melee',
  },
  yujiro_hanma: {
    name: 'Yujiro Hanma', faction: 'baki', cost: 130, hp: 380, accuracy: 58, damage: 78,
    range: 32, meleeRange: 32, speed: 1.1, type: 'melee', morale: 18, experience: 16,
    ability: 'ogre', abilityDesc: 'The Ogre — near-boss tier melee devastation.',
    color: '#802020', combatTag: 'melee',
  },
  doppo_orochi: {
    name: 'Doppo Orochi', faction: 'baki', cost: 82, hp: 200, accuracy: 54, damage: 52,
    range: 26, meleeRange: 26, speed: 1.08, type: 'melee', morale: 28, experience: 13,
    ability: 'goudou', abilityDesc: 'Goudou — precision strikes on wounded targets.',
    color: '#504060', combatTag: 'melee',
  },
  jack_hanma: {
    name: 'Jack Hanma', faction: 'baki', cost: 88, hp: 240, accuracy: 42, damage: 62,
    range: 30, meleeRange: 30, speed: 0.92, type: 'melee', morale: 20, experience: 12,
    ability: 'bite', abilityDesc: 'Bite — bonus damage vs larger enemies.',
    color: '#606060', combatTag: 'melee',
  },
  oliva_biscuit: {
    name: 'Oliva Biscuit', faction: 'baki', cost: 95, hp: 340, accuracy: 38, damage: 60,
    range: 28, meleeRange: 28, speed: 0.78, type: 'melee', morale: 24, experience: 11,
    ability: 'iron_body', abilityDesc: 'Iron Body — heavy damage reduction.',
    color: '#806050', combatTag: 'melee',
  },
  kaku_kaioh: {
    name: 'Kaku Kaioh', faction: 'baki', cost: 80, hp: 185, accuracy: 58, damage: 48,
    range: 26, meleeRange: 26, speed: 1.12, type: 'melee', morale: 30, experience: 14,
    ability: 'aiki', abilityDesc: 'Aiki — counters and punishes reckless attackers.',
    color: '#406080', combatTag: 'melee',
  },
  pickle: {
    name: 'Pickle', faction: 'baki', cost: 100, hp: 360, accuracy: 35, damage: 70,
    range: 30, meleeRange: 30, speed: 0.85, type: 'melee', morale: 12, experience: 10,
    ability: 'primitive_fury', abilityDesc: 'Primitive Fury — raw prehistoric power.',
    color: '#605040', combatTag: 'melee',
  },

  // JoJo Parts 1–7 (Part 7 = cavalry)
  jonathan_joestar: {
    name: 'Jonathan Joestar', faction: 'jojo', cost: 82, hp: 220, accuracy: 48, damage: 50,
    range: 28, meleeRange: 28, speed: 1.0, type: 'melee', morale: 34, experience: 13,
    ability: 'hamon_overdrive', abilityDesc: 'Hamon Overdrive — bonus vs undead elites.',
    color: '#4060a0', combatTag: 'melee', jojoPart: 1,
  },
  dio_brando_p1: {
    name: 'Dio Brando (Pt.1)', faction: 'jojo', cost: 90, hp: 200, accuracy: 52, damage: 56,
    range: 28, meleeRange: 28, speed: 1.12, type: 'melee', morale: 22, experience: 14,
    ability: 'vaporization_freeze', abilityDesc: 'Vaporization Freeze — slows enemy morale.',
    color: '#c0c040', combatTag: 'melee', jojoPart: 1,
  },
  zeppeli: {
    name: 'Will A. Zeppeli', faction: 'jojo', cost: 78, hp: 175, accuracy: 50, damage: 44,
    range: 26, meleeRange: 26, speed: 1.05, type: 'melee', morale: 32, experience: 14,
    ability: 'sunlight_yellow', abilityDesc: 'Sunlight Yellow — heals allies on elite kill.',
    color: '#c0a040', combatTag: 'support', jojoPart: 1,
  },
  joseph_joestar_p2: {
    name: 'Joseph Joestar (Pt.2)', faction: 'jojo', cost: 86, hp: 190, accuracy: 50, damage: 48,
    range: 160, meleeRange: 26, speed: 1.1, type: 'ranged', projectile: 'bolt', morale: 30, experience: 13,
    ability: 'hermit_purple', abilityDesc: 'Hermit Purple — trick shots and scouting debuffs.',
    color: '#8040a0', combatTag: 'ranged', jojoPart: 2,
  },
  caesar_zeppeli: {
    name: 'Caesar Zeppeli', faction: 'jojo', cost: 80, hp: 170, accuracy: 52, damage: 46,
    range: 150, meleeRange: 24, speed: 1.15, type: 'ranged', projectile: 'bolt', morale: 28, experience: 13,
    ability: 'bubble_cutter', abilityDesc: 'Bubble Cutter — crit from range.',
    color: '#40a0c0', combatTag: 'ranged', jojoPart: 2,
  },
  stroheim: {
    name: 'Rudol von Stroheim', faction: 'jojo', cost: 84, hp: 240, accuracy: 44, damage: 52,
    range: 140, meleeRange: 26, speed: 0.9, type: 'ranged', projectile: 'arrow', morale: 26, experience: 11,
    ability: 'german_science', abilityDesc: 'German Science — bonus vs siege units.',
    color: '#808080', combatTag: 'ranged', jojoPart: 2,
  },
  jotaro_kujo: {
    name: 'Jotaro Kujo', faction: 'jojo', cost: 105, hp: 260, accuracy: 56, damage: 62,
    range: 30, meleeRange: 30, speed: 1.05, type: 'melee', morale: 28, experience: 15,
    ability: 'star_platinum', abilityDesc: 'Star Platinum — ORA rush on pinned foes.',
    color: '#404080', combatTag: 'melee', jojoPart: 3,
  },
  kakyoin: {
    name: 'Noriaki Kakyoin', faction: 'jojo', cost: 82, hp: 165, accuracy: 54, damage: 48,
    range: 170, meleeRange: 24, speed: 1.0, type: 'ranged', projectile: 'bolt', morale: 26, experience: 13,
    ability: 'hierophant_green', abilityDesc: 'Hierophant Green — emerald splash AoE.',
    color: '#40c040', combatTag: 'ranged', jojoPart: 3,
  },
  polnareff: {
    name: 'Jean Pierre Polnareff', faction: 'jojo', cost: 84, hp: 195, accuracy: 52, damage: 54,
    range: 28, meleeRange: 28, speed: 1.18, type: 'melee', morale: 28, experience: 13,
    ability: 'silver_chariot', abilityDesc: 'Silver Chariot — flurry attacks on low HP foes.',
    color: '#c0c0c0', combatTag: 'melee', jojoPart: 3,
  },
  avdol: {
    name: 'Mohammed Avdol', faction: 'jojo', cost: 86, hp: 180, accuracy: 50, damage: 52,
    range: 160, meleeRange: 26, speed: 1.0, type: 'ranged', projectile: 'bolt', morale: 30, experience: 13,
    ability: 'magicians_red', abilityDesc: 'Magician\'s Red — fire splash on hit.',
    color: '#c04020', combatTag: 'support', jojoPart: 3,
  },
  josuke_higashikata: {
    name: 'Josuke Higashikata', faction: 'jojo', cost: 88, hp: 210, accuracy: 48, damage: 52,
    range: 28, meleeRange: 28, speed: 1.02, type: 'melee', morale: 32, experience: 13,
    ability: 'crazy_diamond', abilityDesc: 'Crazy Diamond — heals allies he passes.',
    color: '#8040a0', combatTag: 'support', jojoPart: 4,
  },
  okuyasu: {
    name: 'Okuyasu Nijimura', faction: 'jojo', cost: 80, hp: 220, accuracy: 40, damage: 58,
    range: 30, meleeRange: 30, speed: 0.95, type: 'melee', morale: 24, experience: 11,
    ability: 'the_hand', abilityDesc: 'The Hand — erases space, bonus single-target burst.',
    color: '#6040a0', combatTag: 'melee', jojoPart: 4,
  },
  rohan_kishibe: {
    name: 'Rohan Kishibe', faction: 'jojo', cost: 84, hp: 160, accuracy: 58, damage: 46,
    range: 175, meleeRange: 24, speed: 1.05, type: 'ranged', projectile: 'arrow', morale: 22, experience: 14,
    ability: 'heavens_door', abilityDesc: 'Heaven\'s Door — debuffs enemy accuracy.',
    color: '#e0e0c0', combatTag: 'ranged', jojoPart: 4,
  },
  kira_yoshikage: {
    name: 'Yoshikage Kira', faction: 'jojo', cost: 92, hp: 185, accuracy: 54, damage: 56,
    range: 26, meleeRange: 26, speed: 1.0, type: 'melee', morale: 20, experience: 14,
    ability: 'killer_queen', abilityDesc: 'Killer Queen — Bites the Dust on wounded foes.',
    color: '#a040c0', combatTag: 'melee', jojoPart: 4,
  },
  giorno_giovanna: {
    name: 'Giorno Giovanna', faction: 'jojo', cost: 100, hp: 200, accuracy: 52, damage: 54,
    range: 28, meleeRange: 28, speed: 1.08, type: 'melee', morale: 34, experience: 15,
    ability: 'gold_experience', abilityDesc: 'Gold Experience — heals allies on kill.',
    color: '#e0c040', combatTag: 'support', jojoPart: 5,
  },
  bruno_bucciarati: {
    name: 'Bruno Bucciarati', faction: 'jojo', cost: 90, hp: 205, accuracy: 52, damage: 52,
    range: 28, meleeRange: 28, speed: 1.1, type: 'melee', morale: 36, experience: 14,
    ability: 'sticky_fingers', abilityDesc: 'Sticky Fingers — zip-line reposition and rally.',
    color: '#4060c0', combatTag: 'melee', jojoPart: 5,
  },
  guido_mista: {
    name: 'Guido Mista', faction: 'jojo', cost: 86, hp: 175, accuracy: 55, damage: 50,
    range: 165, meleeRange: 24, speed: 1.05, type: 'ranged', projectile: 'arrow', morale: 26, experience: 13,
    ability: 'sex_pistols', abilityDesc: 'Sex Pistols — ricochet shots hit multiple foes.',
    color: '#4080c0', combatTag: 'ranged', jojoPart: 5,
  },
  diavolo: {
    name: 'Diavolo', faction: 'jojo', cost: 108, hp: 220, accuracy: 50, damage: 60,
    range: 28, meleeRange: 28, speed: 1.12, type: 'melee', morale: 18, experience: 15,
    ability: 'king_crimson', abilityDesc: 'King Crimson — deletes wounded targets.',
    color: '#802060', combatTag: 'melee', jojoPart: 5,
  },
  jolyne_cujoh: {
    name: 'Jolyne Cujoh', faction: 'jojo', cost: 88, hp: 195, accuracy: 52, damage: 50,
    range: 26, meleeRange: 26, speed: 1.15, type: 'melee', morale: 30, experience: 14,
    ability: 'stone_free', abilityDesc: 'Stone Free — string traps slow enemies.',
    color: '#40a080', combatTag: 'melee', jojoPart: 6,
  },
  weather_report: {
    name: 'Weather Report', faction: 'jojo', cost: 94, hp: 180, accuracy: 54, damage: 56,
    range: 170, meleeRange: 24, speed: 1.0, type: 'ranged', projectile: 'bolt', morale: 26, experience: 14,
    ability: 'weather_stand', abilityDesc: 'Weather Stand — AoE lightning pressure.',
    color: '#80c0e0', combatTag: 'ranged', jojoPart: 6,
  },
  ermes_costello: {
    name: 'Ermes Costello', faction: 'jojo', cost: 80, hp: 170, accuracy: 50, damage: 46,
    range: 26, meleeRange: 26, speed: 1.1, type: 'melee', morale: 28, experience: 13,
    ability: 'kiss', abilityDesc: 'Kiss — duplicates pressure on elite kills.',
    color: '#c04080', combatTag: 'melee', jojoPart: 6,
  },
  johnny_joestar: {
    name: 'Johnny Joestar', faction: 'jojo', cost: 96, hp: 175, accuracy: 52, damage: 54,
    range: 32, meleeRange: 32, speed: 1.45, type: 'cavalry', morale: 28, experience: 15, canHunt: true,
    ability: 'tusk_act4', abilityDesc: 'Tusk ACT4 — infinite rotation charge finisher.',
    color: '#c0a060', combatTag: 'melee', jojoPart: 7,
  },
  gyro_zeppeli: {
    name: 'Gyro Zeppeli', faction: 'jojo', cost: 94, hp: 185, accuracy: 55, damage: 52,
    range: 30, meleeRange: 30, speed: 1.4, type: 'cavalry', morale: 32, experience: 14, canHunt: true,
    ability: 'steel_ball', abilityDesc: 'Steel Ball — golden spin cleave on charge.',
    color: '#c08040', combatTag: 'ranged', jojoPart: 7,
  },
  diego_brando: {
    name: 'Diego Brando', faction: 'jojo', cost: 98, hp: 190, accuracy: 54, damage: 58,
    range: 32, meleeRange: 32, speed: 1.5, type: 'cavalry', morale: 22, experience: 14, canHunt: true,
    ability: 'scary_monsters', abilityDesc: 'Scary Monsters — predatory charge damage.',
    color: '#608040', combatTag: 'melee', jojoPart: 7,
  },
  lucy_steel: {
    name: 'Lucy Steel', faction: 'jojo', cost: 76, hp: 155, accuracy: 48, damage: 40,
    range: 30, meleeRange: 30, speed: 1.35, type: 'cavalry', morale: 34, experience: 13, canHunt: true,
    ability: 'ticket_to_ride', abilityDesc: 'Ticket to Ride — support cavalry rally aura.',
    color: '#c0a0a0', combatTag: 'support', jojoPart: 7,
  },

  // Fist of the North Star
  kenshiro: {
    name: 'Kenshiro', faction: 'fotns', cost: 115, hp: 280, accuracy: 58, damage: 68,
    range: 28, meleeRange: 28, speed: 1.05, type: 'melee', morale: 32, experience: 16,
    ability: 'hidan_shinken', abilityDesc: 'Hokuto Shinken — ATATATA finisher on low HP foes.',
    color: '#c0c0e0', combatTag: 'melee',
  },
  raoh: {
    name: 'Raoh', faction: 'fotns', cost: 120, hp: 350, accuracy: 50, damage: 72,
    range: 32, meleeRange: 32, speed: 0.9, type: 'melee', morale: 28, experience: 15,
    ability: 'hokuto_kaioh', abilityDesc: 'Ken-Oh — terror aura and siege bonus.',
    color: '#404040', combatTag: 'melee',
  },
  toki: {
    name: 'Toki', faction: 'fotns', cost: 88, hp: 190, accuracy: 52, damage: 48,
    range: 26, meleeRange: 26, speed: 1.0, type: 'melee', morale: 36, experience: 14,
    ability: 'hakke_shou', abilityDesc: 'Hakke Shou — heals allies in aura.',
    color: '#e0e0f0', combatTag: 'support',
  },
  rei: {
    name: 'Rei', faction: 'fotns', cost: 86, hp: 175, accuracy: 54, damage: 52,
    range: 28, meleeRange: 28, speed: 1.2, type: 'melee', morale: 26, experience: 13,
    ability: 'nanto_suicho', abilityDesc: 'Nanto Suichō Ken — fast strikes on multiple foes.',
    color: '#4080c0', combatTag: 'melee',
  },
  jaggi: {
    name: 'Jagi', faction: 'fotns', cost: 78, hp: 200, accuracy: 42, damage: 50,
    range: 28, meleeRange: 28, speed: 0.95, type: 'melee', morale: 16, experience: 11,
    ability: 'dirty_tricks', abilityDesc: 'Dirty Tricks — debuffs enemy morale on hit.',
    color: '#605050', combatTag: 'melee',
  },
  shin: {
    name: 'Shin', faction: 'fotns', cost: 82, hp: 210, accuracy: 46, damage: 54,
    range: 30, meleeRange: 30, speed: 1.0, type: 'melee', morale: 22, experience: 12,
    ability: 'nanto_hakuro', abilityDesc: 'Nanto Hakuro Ken — heavy single-target blows.',
    color: '#806080', combatTag: 'melee',
  },

  // Dragon Ball
  goku: {
    name: 'Goku', faction: 'dragonball', cost: 110, hp: 280, accuracy: 52, damage: 64,
    range: 30, meleeRange: 30, speed: 1.12, type: 'melee', morale: 32, experience: 15,
    ability: 'kamehameha', abilityDesc: 'Kamehameha — burst finisher when surrounded.',
    color: '#e06040', combatTag: 'melee',
  },
  vegeta: {
    name: 'Vegeta', faction: 'dragonball', cost: 108, hp: 270, accuracy: 54, damage: 62,
    range: 30, meleeRange: 30, speed: 1.1, type: 'melee', morale: 28, experience: 15,
    ability: 'galick_gun', abilityDesc: 'Galick Gun — bonus vs elites, pride damage boost.',
    color: '#4060c0', combatTag: 'melee',
  },
  piccolo: {
    name: 'Piccolo', faction: 'dragonball', cost: 92, hp: 220, accuracy: 50, damage: 54,
    range: 165, meleeRange: 26, speed: 1.0, type: 'ranged', projectile: 'bolt', morale: 30, experience: 14,
    ability: 'special_beam', abilityDesc: 'Special Beam Cannon — pierces high-HP targets.',
    color: '#40a060', combatTag: 'support',
  },
  gohan: {
    name: 'Gohan', faction: 'dragonball', cost: 95, hp: 240, accuracy: 48, damage: 58,
    range: 28, meleeRange: 28, speed: 1.05, type: 'melee', morale: 30, experience: 14,
    ability: 'hidden_potential', abilityDesc: 'Hidden Potential — massive spike below 40% HP.',
    color: '#8040c0', combatTag: 'melee',
  },
  trunks: {
    name: 'Trunks', faction: 'dragonball', cost: 90, hp: 210, accuracy: 54, damage: 56,
    range: 160, meleeRange: 26, speed: 1.08, type: 'ranged', projectile: 'bolt', morale: 28, experience: 13,
    ability: 'burning_attack', abilityDesc: 'Burning Attack — ranged burst finisher.',
    color: '#a040c0', combatTag: 'ranged',
  },
  frieza: {
    name: 'Frieza', faction: 'dragonball', cost: 100, hp: 230, accuracy: 52, damage: 58,
    range: 155, meleeRange: 26, speed: 1.05, type: 'ranged', projectile: 'bolt', morale: 20, experience: 14,
    ability: 'death_beam', abilityDesc: 'Death Beam — precision ranged execution.',
    color: '#c0c0c0', combatTag: 'ranged',
  },
  cell: {
    name: 'Cell', faction: 'dragonball', cost: 105, hp: 260, accuracy: 50, damage: 60,
    range: 28, meleeRange: 28, speed: 1.08, type: 'melee', morale: 18, experience: 15,
    ability: 'perfect_form', abilityDesc: 'Perfect Form — heals on kill.',
    color: '#40c040', combatTag: 'melee',
  },
  beerus: {
    name: 'Beerus', faction: 'dragonball', cost: 125, hp: 300, accuracy: 56, damage: 70,
    range: 32, meleeRange: 32, speed: 1.15, type: 'melee', morale: 24, experience: 16,
    ability: 'hakai', abilityDesc: 'Hakai — god-tier delete on wounded foes.',
    color: '#6040a0', combatTag: 'melee',
  },
};

function getCrossoverDef(type) {
  return CrossoverDefs[type] || null;
}

function isCrossoverUnit(type) {
  return !!CrossoverDefs[type];
}

function isRosterUnit(type) {
  return (typeof isWweUnit === 'function' && isWweUnit(type)) || isCrossoverUnit(type);
}

function getCrossoverCombatTag(unit) {
  if (!unit) return 'melee';
  if (unit.combatTag) return unit.combatTag;
  const def = getCrossoverDef(unit.type) || (typeof getWweDef === 'function' ? getWweDef(unit.type) : null);
  if (def?.combatTag) return def.combatTag;
  if (def?.type === 'ranged') return 'ranged';
  if (unit.combatType === 'healer' || unit.type === 'healer') return 'support';
  if (unit.combatType === 'builder' || unit.combatType === 'courier' || unit.combatType === 'general') return 'support';
  if (unit.combatType === 'ranged' || unit.projectile) return 'ranged';
  return 'melee';
}

function isFactionUnlocked(factionId) {
  const f = CrossoverFactions[factionId];
  if (!f || typeof MetaProgress === 'undefined') return false;
  const fn = MetaProgress[f.unlockKey];
  return typeof fn === 'function' ? fn() : false;
}

function getUnlockedFactions() {
  return Object.values(CrossoverFactions).filter(f => isFactionUnlocked(f.id));
}

const CROSSOVER_FACTION_TAB_ORDER = [
  'ultimis', 'primis', 'halo', 'gears', 'lotr', 'baki', 'jojo', 'fotns', 'dragonball',
];

const CrossoverHub = (() => {
  let selectedId = null;
  let activeFaction = 'ultimis';

  function rosterForFaction(fid) {
    return Object.entries(CrossoverDefs).filter(([, d]) => d.faction === fid);
  }

  function getFeaturedOperativeId(fid, wave = 0) {
    const roster = rosterForFaction(fid);
    if (!roster.length) return null;
    const seed = (wave || 0) + [...fid].reduce((n, c) => n + c.charCodeAt(0), 0);
    return roster[seed % roster.length][0];
  }

  function sortUnlockedFactions(unlocked) {
    const order = CROSSOVER_FACTION_TAB_ORDER;
    return [...unlocked].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }

  function hasFactionBuilding(fid, gs) {
    const f = CrossoverFactions[fid];
    if (!f) return false;
    return !!gs?.crossoverBuildings?.includes(f.building);
  }

  function renderRoster(gs) {
    const grid = document.getElementById('crossover-roster-grid');
    if (!grid) return;
    const unlocked = sortUnlockedFactions(getUnlockedFactions());
    if (unlocked.length && !unlocked.find(f => f.id === activeFaction)) {
      activeFaction = unlocked[0].id;
    }

    const tabs = document.getElementById('crossover-faction-tabs');
    if (tabs) {
      tabs.innerHTML = unlocked.map(f => {
        const count = rosterForFaction(f.id).length;
        return `
        <button class="crossover-tab ${f.id === activeFaction ? 'active' : ''}" data-faction="${f.id}" title="${count} operatives">${f.label} (${count})</button>
      `;
      }).join('');
      tabs.querySelectorAll('.crossover-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          activeFaction = btn.dataset.faction;
          selectedId = null;
          renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
          AudioEngine?.SFX?.click?.();
        });
      });
    }

    const entries = rosterForFaction(activeFaction);
    const featuredId = getFeaturedOperativeId(activeFaction, gs?.wave || 0);
    const sortedEntries = featuredId
      ? [...entries].sort((a, b) => (a[0] === featuredId ? -1 : b[0] === featuredId ? 1 : 0))
      : entries;
    const recruited = new Set(MetaProgress.getCrossoverRecruited?.() || []);
    grid.innerHTML = sortedEntries.map(([id, def]) => {
      const onField = gs?.crossoverOnField?.includes(id);
      const canAfford = (gs?.tactical ?? 0) >= def.cost;
      const hasBase = hasFactionBuilding(activeFaction, gs);
      const isFeatured = id === featuredId;
      return `
        <div class="wwe-card crossover-card ${selectedId === id ? 'selected' : ''} ${isFeatured ? 'crossover-featured' : ''} ${!canAfford || !hasBase || onField ? 'cant-afford' : ''}" data-crossover="${id}">
          ${isFeatured ? '<div class="crossover-featured-badge">Featured</div>' : ''}
          <div class="wwe-card-name" style="color:${def.color}">${def.name}</div>
          <div class="wwe-card-cost">${def.cost} TP</div>
          <div class="wwe-card-stats">HP ${def.hp} · DMG ${def.damage} · ${def.type}${def.jojoPart ? ` · Pt.${def.jojoPart}` : ''}</div>
          <div class="wwe-card-ability">${def.abilityDesc}</div>
          ${recruited.has(id) ? '<div class="wwe-recruited">★ Signed</div>' : ''}
          ${onField ? '<div class="wwe-on-field">ON FIELD</div>' : ''}
          ${!hasBase ? '<div class="crossover-need-base">Need barracks on field</div>' : ''}
        </div>
      `;
    }).join('') || '<p class="crossover-empty">No operatives available for this faction yet.</p>';

    grid.querySelectorAll('.crossover-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.crossover;
        renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
        AudioEngine?.SFX?.click?.();
      });
    });

    const detail = document.getElementById('crossover-selected-detail');
    const prof = typeof FactionDepth !== 'undefined' ? FactionDepth.getProfile(activeFaction) : null;
    const mastery = typeof FactionDepth !== 'undefined' ? FactionDepth.getMasteryPoints(activeFaction) : 0;
    const title = typeof FactionDepth !== 'undefined' ? FactionDepth.getMasteryTitle(activeFaction) : null;
    const seasonals = typeof FactionDepth !== 'undefined' ? FactionDepth.getSeasonalEvents() : [];
    const seasonal = seasonals.find(e => e.factions?.includes(activeFaction)) || seasonals[0] || null;
    const synHint = typeof FactionDepth !== 'undefined'
      ? FactionDepth.SYNERGIES.filter(s => s.factions.includes(activeFaction)).slice(0, 2).map(s => s.name).join(', ')
      : '';
    const recruitBtn = document.getElementById('crossover-recruit-btn');
    if (recruitBtn) {
      if (!selectedId) {
        recruitBtn.disabled = true;
      } else {
        const selOnField = gs?.crossoverOnField?.includes(selectedId);
        const selDef = CrossoverDefs[selectedId];
        const selAfford = selDef && (gs?.tactical ?? 0) >= selDef.cost;
        const selBase = hasFactionBuilding(activeFaction, gs);
        recruitBtn.disabled = !!(selOnField || !selAfford || !selBase);
      }
    }

    if (detail && selectedId && CrossoverDefs[selectedId]) {
      const d = CrossoverDefs[selectedId];
      const costNote = typeof FactionDepth !== 'undefined' && gs
        ? ` (≈${Math.ceil(d.cost * FactionDepth.getDeployCostMult(activeFaction, gs.wave || 0))} TP)`
        : '';
      const fieldNote = gs?.crossoverOnField?.includes(selectedId)
        ? '<br><em>Already deployed — wait until they fall to recruit again.</em>'
        : '';
      detail.innerHTML = `<strong>${d.name}</strong> — ${d.abilityDesc}<br>Cost: ${d.cost} TP${costNote} · Tag: ${d.combatTag}${fieldNote}`;
    } else if (detail) {
      if (prof) {
        detail.innerHTML = `<strong>${prof.label}</strong>${title ? ` · <em>${title}</em>` : ''}<br>
          Mastery: ${mastery} pts · ${prof.identity}<br>
          <span class="crossover-weakness">Weakness: ${prof.weakness}</span><br>
          ${synHint ? `Synergies: ${synHint}` : ''}${seasonal?.factions?.includes(activeFaction) ? `<br>🎉 ${seasonal.name}` : ''}`;
      } else {
        detail.textContent = unlocked.length
          ? 'Select a crossover operative below.'
          : 'Unlock a crossover roster first — then build its barracks and recruit operatives here.';
      }
    }
  }

  function togglePanel(factionId) {
    const panel = document.getElementById('crossover-screen');
    if (!panel) return;
    if (factionId) activeFaction = factionId;
    const open = panel.classList.toggle('active');
    if (open) renderRoster(typeof Game !== 'undefined' ? Game.getState() : null);
  }

  function getSelected() { return selectedId; }
  function getActiveFaction() { return activeFaction; }

  function init() {
    document.getElementById('crossover-hub-open')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      togglePanel();
    });
    document.getElementById('crossover-close')?.addEventListener('click', () => {
      document.getElementById('crossover-screen')?.classList.remove('active');
    });
    document.getElementById('crossover-recruit-btn')?.addEventListener('click', () => {
      if (!selectedId) return;
      const gs = typeof Game !== 'undefined' ? Game.getState() : null;
      if (gs?.crossoverOnField?.includes(selectedId)) return;
      if (typeof Game !== 'undefined') Game.recruitCrossoverOperative(selectedId);
      renderRoster(Game.getState());
      UI.updateHUD(true);
    });
    document.getElementById('crossover-build-btn')?.addEventListener('click', () => {
      const f = CrossoverFactions[activeFaction];
      if (f && typeof Game !== 'undefined') Game.selectBuild(f.building);
      togglePanel();
      UI.updateHUD(true);
    });
  }

  return {
    init, togglePanel, renderRoster, getSelected, getActiveFaction, rosterForFaction,
    getFeaturedOperativeId, sortUnlockedFactions,
  };
})();