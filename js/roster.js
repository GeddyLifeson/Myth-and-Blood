/**
 * Roster — one clear job, one signature trait and one weakness for every troop,
 * enemy, boss, operative and champion.
 *
 * Profiles are data. The small set of mechanics below reads them at four points:
 * when damage is dealt, when damage is taken, when a unit dies, and on a slow tick
 * that handles auras, regeneration, poison, pack counts and boss phases.
 */
const Roster = (() => {
  const SLOW_TICK = 30;
  const CELL = 96;

  // ------------------------------------------------------------------ troops
  const TROOPS = {
    footman: {
      role: 'Line holder',
      trait:
        'Shield Wall — takes 12% less damage for each footman or pikeman beside him, up to 36%.',
      weak: 'Kills slowly.',
      brace: true,
    },
    archer: {
      role: 'Ranged damage',
      trait: 'Volley — 20% more damage to targets far away.',
      weak: 'Deals 40% less when an enemy is in his face.',
      farShot: { min: 120, mult: 1.2 },
      closeWeak: { within: 55, mult: 0.6 },
    },
    crossbowman: {
      role: 'Armour piercer',
      trait:
        'Heavy Quarrel — 40% more damage to armoured enemies and siege engines; reloads slowly.',
      weak: 'Slow rate of fire; swarms overrun him.',
      vsType: {
        dark_knight: 1.4,
        troll: 1.4,
        war_chief: 1.4,
        siege_tower: 1.4,
        iron_colossus: 1.4,
        orc_shieldbearer: 1.4,
        dreadborn_champion: 1.4,
        cinderbound_juggernaut: 1.4,
      },
      closeWeak: { within: 55, mult: 0.6 },
    },
    mage: {
      role: 'Area damage',
      trait: 'Arcane Burst — every fourth attack also hits everything near the target.',
      weak: 'The most fragile soldier on the field.',
      splashEvery: { n: 4, r: 48, pct: 0.6 },
    },
    cavalry: {
      role: 'Runner hunter',
      trait: 'Run Down — 60% more damage to line-breakers and routing enemies.',
      weak: 'Pikes and trolls stop a charge cold.',
      runDown: 1.6,
    },
    healer: {
      role: 'Medic',
      trait: 'Field Dressing — soldiers standing near a healer slowly recover on their own.',
      weak: 'Cannot fight.',
      dressing: { r: 70, pct: 0.012 },
    },
    builder: {
      role: 'Engineer',
      trait: 'Fieldworks — soldiers near a builder take 10% less damage.',
      weak: 'Barely armed.',
      bulwarkAura: { r: 70 },
    },
    courier: {
      role: 'Messenger',
      trait: 'Fleet — dodges a third of arrows and bolts.',
      weak: 'Unarmed.',
      dodgeRanged: 0.35,
    },
    scout: {
      role: 'Spotter',
      trait:
        'Spotter — archers, mages and ballistae near a scout deal 12% more. Scouts hit line-breakers 60% harder.',
      weak: 'Light armour; loses a straight fight.',
      spotAura: { r: 150 },
      runDown: 1.6,
    },
    bard: {
      role: 'Morale',
      trait: 'Marching Song — soldiers in earshot steadily regain morale.',
      weak: 'Weak in a fight.',
      songAura: { r: 100, morale: 1 },
    },
    ballista: {
      role: 'Giant killer',
      trait: 'Heavy Bolt — 35% more damage to bosses, monsters and elites.',
      weak: 'Half damage at close range, and slow to move.',
      bossBane: 1.35,
      closeWeak: { within: 70, mult: 0.5 },
    },
    pikeman: {
      role: 'Anti-cavalry',
      trait: 'Set Pikes — riders and beasts that strike a pikeman take 40% of the blow back.',
      weak: 'Arrows and magic.',
      reflectCharge: 0.4,
      brace: true,
    },
    sapper: {
      role: 'Demolition',
      trait: 'Blast — every hit splashes nearby enemies. Double damage to siege towers.',
      weak: 'Fragile and short-ranged.',
      splashEvery: { n: 1, r: 36, pct: 0.4 },
      vsType: { siege_tower: 2, iron_colossus: 1.5, hellmortar_pack: 1.5 },
    },
    knight: {
      role: 'Heavy infantry',
      trait: 'Cleave — each swing also wounds a second enemy beside the target.',
      weak: 'Expensive, and mages cut through the armour.',
      cleave: { r: 32, pct: 0.45 },
    },
    general: {
      role: 'Commander',
      trait: 'Orders — War Cry and Hold the Line. His aura strengthens everyone near him.',
      weak: 'Every enemy on the field wants him dead.',
    },
  };

  // Operatives and champions share archetypes, picked from their stats.
  const ARCHETYPES = {
    op_juggernaut: {
      role: 'Juggernaut',
      trait: 'Immovable — takes 12% less damage and hurts anyone who strikes him in melee.',
      weak: 'Slow; line-breakers run past him.',
      flatResist: 0.12,
      thorns: 5,
    },
    op_duelist: {
      role: 'Duelist',
      trait:
        'First Blood — the opening strike on each new target lands 60% harder, and blows from behind hit harder still.',
      weak: 'Thin armour for a front-line fighter.',
      pounceEach: 1.6,
      backstab: 1.3,
    },
    op_vanguard: {
      role: 'Vanguard',
      trait: 'Cleave — each swing also wounds a second enemy beside the target.',
      weak: 'No answer to ranged fire.',
      cleave: { r: 32, pct: 0.35 },
    },
    op_marksman: {
      role: 'Marksman',
      trait: 'Long Shot — 20% more damage at range and 15% more to bosses and elites.',
      weak: 'Deals 40% less when an enemy is in his face.',
      farShot: { min: 130, mult: 1.2 },
      bossBane: 1.15,
      closeWeak: { within: 55, mult: 0.6 },
    },
    op_gunner: {
      role: 'Suppressor',
      trait: 'Suppressing Fire — targets he hits deal 20% less damage for a few seconds.',
      weak: 'Short reach for a ranged fighter.',
      hex: { pct: 0.2, ticks: 180 },
    },
    op_lancer: {
      role: 'Lancer',
      trait: 'Run Down — 60% more damage to line-breakers and routing enemies.',
      weak: 'Pikes and trolls stop a charge cold.',
      runDown: 1.6,
    },
    op_medic: {
      role: 'Medic',
      trait: 'Field Dressing — soldiers standing near him slowly recover on their own.',
      weak: 'A poor fighter.',
      dressing: { r: 70, pct: 0.012 },
    },
    champion: {
      role: 'Champion',
      trait:
        'Crowd Favourite — each kill lifts the morale of soldiers nearby, and he hits 25% harder below half health.',
      weak: 'Costs as much as a squad.',
      bloodRage: 1.25,
      killCheer: { r: 110, morale: 4 },
    },
  };

  // Each operative faction adds one small signature on top of the archetype.
  const FACTION_SIGNATURES = {
    ultimis: {
      note: 'Horde breakers: +20% damage to goblins and rats.',
      fx: { vsType: { goblin: 1.2, plague_rat: 1.2, goblin_sapper: 1.2 } },
    },
    primis: { note: 'Drilled: takes 6% less damage.', fx: { flatResist: 0.06 } },
    halo: { note: 'Marksmanship: +10% damage at range.', fx: { farShot: { min: 120, mult: 1.1 } } },
    gears: {
      note: 'Close-quarters: enemies that strike them in melee are hurt.',
      fx: { thorns: 3 },
    },
    lotr: {
      note: 'Giant slayers: +15% damage to bosses, monsters and elites.',
      fx: { bossBane: 1.15 },
    },
    baki: { note: 'Fighting spirit: hit 20% harder below half health.', fx: { bloodRage: 1.2 } },
    jojo: {
      note: 'Opening move: the first strike on each new target lands 25% harder.',
      fx: { pounceEach: 1.25 },
    },
    fotns: {
      note: 'Pressure points: blows from behind land 25% harder still.',
      fx: { backstab: 1.25 },
    },
    dragonball: {
      note: 'Pursuit: +30% damage to line-breakers and routing enemies.',
      fx: { runDown: 1.3 },
    },
    imperium: { note: 'Power armour: arrows and bolts do 15% less.', fx: { armourVsRanged: 0.85 } },
    crystal: {
      note: 'Mending light: soldiers beside them slowly recover.',
      fx: { dressing: { r: 50, pct: 0.006 } },
    },
    warp: {
      note: 'Dread: enemies they hit deal 10% less damage for a moment.',
      fx: { hex: { pct: 0.1, ticks: 120 } },
    },
    tes: {
      note: 'Renown: each kill lifts the morale of soldiers nearby.',
      fx: { killCheer: { r: 90, morale: 2 } },
    },
  };
  const mergedProfiles = new Map();

  /** Archetype plus faction signature. The archetype wins where both set the same mechanic. */
  function operativeProfile(key, faction) {
    const sig = FACTION_SIGNATURES[faction];
    if (!sig) return ARCHETYPES[key];
    const id = `${key}|${faction}`;
    let merged = mergedProfiles.get(id);
    if (!merged) {
      const base = ARCHETYPES[key];
      merged = { ...sig.fx, ...base, trait: `${base.trait} ${sig.note}` };
      mergedProfiles.set(id, merged);
    }
    return merged;
  }

  function factionOf(unit) {
    if (unit.faction) return unit.faction;
    const def = typeof CrossoverDefs !== 'undefined' ? CrossoverDefs[unit.type] : null;
    return def ? def.faction : null;
  }

  // ----------------------------------------------------------------- enemies
  const ENEMIES = {
    goblin: {
      role: 'Swarm',
      trait: 'Mob — hits harder for every goblin packed around it.',
      weak: 'Dies to anything; splash damage clears them.',
      swarm: { per: 0.06, max: 0.42 },
    },
    orc: {
      role: 'Line infantry',
      trait: 'Blood Rage — hits 25% harder once wounded below half.',
      weak: 'Slow.',
      bloodRage: 1.25,
    },
    orc_archer: {
      role: 'Skirmisher',
      trait: 'Loose Order — backs away when your soldiers close in.',
      weak: 'Cavalry.',
      kite: true,
      farShot: { min: 120, mult: 1.15 },
    },
    dark_knight: {
      role: 'Armoured rider',
      trait: 'Plate — arrows do 30% less, and he cannot be pinned.',
      weak: 'Pikes and magic.',
      armourVsRanged: 0.7,
      noPin: true,
    },
    warg_rider: {
      role: 'Raider',
      trait: 'Pounce — goes for archers, mages and healers; its first bite lands 80% harder.',
      weak: 'Pikes.',
      prefer: 'support',
      pounce: 1.8,
    },
    dark_mage: {
      role: 'Hexer',
      trait: 'Hex — soldiers it hits deal 20% less damage for a few seconds.',
      weak: 'Fragile; cavalry reaches it fast.',
      kite: true,
      hex: { pct: 0.2, ticks: 240 },
    },
    troll: {
      role: 'Wall breaker',
      trait: 'Regrowth — heals constantly, and heads for your buildings.',
      weak: 'Slow; focus fire outpaces the healing. Mages and ballistae.',
      regen: 0.015,
      prefer: 'building',
    },
    goblin_sapper: {
      role: 'Bomber',
      trait: 'Volatile — runs at your buildings and explodes when it dies.',
      weak: 'Kill it at range before it arrives.',
      prefer: 'building',
      deathBurst: { r: 46, dmg: 34 },
    },
    necromancer: {
      role: 'Summoner',
      trait: 'Grave Call — keeps its distance and raises the dead.',
      weak: 'Fragile; kill it first.',
      kite: true,
    },
    berserker: {
      role: 'Shock trooper',
      trait: 'Frenzy — hits 35% harder below half health and never routs.',
      weak: 'No armour; takes 15% more damage.',
      bloodRage: 1.35,
      frail: 1.15,
      fearless: true,
    },
    assassin: {
      role: 'General hunter',
      trait: 'Backstab — hunts your General; blows from behind land 50% harder still.',
      weak: 'Dies to one solid hit.',
      backstab: 1.5,
    },
    shaman: {
      role: 'Healer',
      trait: 'Ward — heals the host, and enemies near it take 10% less damage.',
      weak: 'Unarmed; kill it first.',
      wardAura: { r: 100 },
    },
    siege_tower: {
      role: 'Siege engine',
      trait: 'Rolling Tower — shrugs off arrows and batters walls.',
      weak: 'Sappers do double damage to it.',
      armourVsRanged: 0.6,
      noPin: true,
    },
    goblin_engineer: {
      role: 'Field engineer',
      trait: 'Barricades — throws up cover for the host as it advances.',
      weak: 'Barely fights.',
    },
    war_chief: {
      role: 'Commander',
      trait: 'War Banner — enemies near the chief hit 15% harder.',
      weak: 'Kill him and the bonus is gone.',
      warAura: { r: 100 },
    },
    harpy: {
      role: 'Flying raider',
      trait: 'Dive — flies for archers, mages and healers; its first strike lands 60% harder.',
      weak: 'Low health.',
      prefer: 'support',
      pounce: 1.6,
    },
    goblin_burrower: {
      role: 'Infiltrator',
      trait: 'Tunneller — always a line-breaker.',
      weak: 'Cavalry and scouts run it down.',
      alwaysRunner: true,
    },
    bone_summoner: {
      role: 'Summoner',
      trait: 'Bone Call — keeps its distance and raises the dead.',
      weak: 'Fragile; kill it first.',
      kite: true,
    },
    orc_shieldbearer: {
      role: 'Shield wall',
      trait:
        'Tower Shield — arrows and bolts do 55% less to it, and enemies beside it take 10% less.',
      weak: 'Mages, sappers, and anything that gets behind it.',
      armourVsRanged: 0.45,
      wardAura: { r: 60 },
      noPin: true,
    },
    goblin_firebrand: {
      role: 'Arsonist',
      trait:
        'Firebomb — its bombs splash, keep burning for several seconds, and it prefers your buildings.',
      weak: 'Fragile; cavalry and archers kill it fast.',
      kite: true,
      prefer: 'building',
      splashEvery: { n: 1, r: 34, pct: 0.5 },
      plague: { dps: 4, ticks: 180 },
    },
    wailing_wraith: {
      role: 'Terror',
      trait: 'Dirge — soldiers near it steadily lose morale. It flies, and it never routs.',
      weak: 'Low health. Bards and War Cry restore what it drains.',
      dirgeAura: { r: 120, morale: 2.5 },
      fearless: true,
    },
    sky_drake: {
      role: 'Flying artillery',
      trait: 'Fire Breath — every shot burns everything near the target.',
      weak: 'Ballistae.',
      kite: true,
      splashEvery: { n: 1, r: 40, pct: 0.4 },
    },
    plague_rat: {
      role: 'Swarm',
      trait: 'Plague — bites keep hurting for several seconds.',
      weak: 'Dies to anything.',
      swarm: { per: 0.04, max: 0.32 },
      plague: { dps: 3, ticks: 240 },
    },
    hellbound_legionnaire: {
      role: 'Suppressor',
      trait: 'Suppressing Fire — soldiers it hits deal 15% less damage for a few seconds.',
      weak: 'Cavalry.',
      kite: true,
      hex: { pct: 0.15, ticks: 180 },
    },
    nightmare_strider: {
      role: 'Raider',
      trait: 'Pounce — goes for archers, mages and healers; its first strike lands 80% harder.',
      weak: 'Pikes.',
      prefer: 'support',
      pounce: 1.8,
    },
    dreadborn_champion: {
      role: 'Armoured commander',
      trait: 'Dread Banner — enemies near it hit 15% harder; arrows do 25% less to it.',
      weak: 'Mages and ballistae.',
      warAura: { r: 100 },
      armourVsRanged: 0.75,
    },
    warp_prophet: {
      role: 'Hexer',
      trait: 'Curse — soldiers it hits deal 25% less damage for a few seconds.',
      weak: 'Fragile; cavalry reaches it fast.',
      kite: true,
      hex: { pct: 0.25, ticks: 240 },
    },
    grim_revenant: {
      role: 'Sniper',
      trait: 'Dead Eye — 50% more damage at long range; prefers healers and mages.',
      weak: 'Helpless up close.',
      prefer: 'support',
      farShot: { min: 150, mult: 1.5 },
      closeWeak: { within: 60, mult: 0.5 },
    },
    umbral_stalker: {
      role: 'Assassin',
      trait:
        'Backstab — goes for archers, mages and healers; blows from behind land 50% harder still.',
      weak: 'Low health.',
      prefer: 'support',
      backstab: 1.5,
    },
    cinderbound_juggernaut: {
      role: 'Burning brute',
      trait: 'Cinder Hide — soldiers who strike it in melee are burned.',
      weak: 'Ranged fire; it is very slow.',
      thorns: 8,
      noPin: true,
    },
    hellmortar_pack: {
      role: 'Artillery',
      trait: 'Mortar — every shell hits everything near the target.',
      weak: 'Cavalry and sappers.',
      prefer: 'building',
      splashEvery: { n: 1, r: 44, pct: 0.5 },
    },
    abomination: {
      role: 'Bloated brute',
      trait: 'Rupture — regrows flesh, and bursts when it dies.',
      weak: 'Kill it away from your line.',
      regen: 0.01,
      deathBurst: { r: 56, dmg: 46 },
    },
    behemoth: {
      role: 'Wall breaker',
      trait: 'Trample — every blow also hits soldiers beside the target; it heads for buildings.',
      weak: 'Ballistae and mages.',
      prefer: 'building',
      cleave: { r: 38, pct: 0.5 },
      noPin: true,
    },
    iron_colossus: {
      role: 'Siege construct',
      trait: 'Iron Shell — arrows do 40% less and melee attackers are hurt.',
      weak: 'Sappers and mages.',
      prefer: 'building',
      armourVsRanged: 0.6,
      thorns: 6,
      noPin: true,
    },
    void_stalker: {
      role: 'General hunter',
      trait: 'Void Step — hunts your General; blows from behind land 50% harder still.',
      weak: 'Bodyguards around the General.',
      backstab: 1.5,
    },
    elder_wyrm: {
      role: 'Flying siege',
      trait: 'Wyrmfire — every breath burns everything near the target; it regrows scales.',
      weak: 'Ballistae.',
      splashEvery: { n: 1, r: 46, pct: 0.5 },
      regen: 0.006,
    },
    // Named bosses: two traits each and a second phase at half health.
    boss_gorath: {
      role: 'Boss — warlord',
      trait: 'War Banner and Blood Rage. At half health he enrages.',
      weak: 'Kill his escort first; the banner only helps those near him.',
      warAura: { r: 130 },
      bloodRage: 1.25,
      phase: { enrage: 1.3 },
    },
    boss_morwen: {
      role: 'Boss — hexer',
      trait: 'Hex and Grave Call. At half health she raises a pack of plague rats.',
      weak: 'Cavalry; she is fragile for a boss.',
      kite: true,
      hex: { pct: 0.25, ticks: 300 },
      phase: { summon: ['plague_rat', 6] },
    },
    boss_thokk: {
      role: 'Boss — mountain',
      trait: 'Trample and Regrowth. At half health his regrowth doubles.',
      weak: 'Ballistae and mages; he is very slow.',
      cleave: { r: 42, pct: 0.5 },
      regen: 0.008,
      noPin: true,
      phase: { regen: 0.016 },
    },
    boss_grimm: {
      role: 'Boss — cinder knight',
      trait: 'Plate and Cinder Hide. At half health he enrages.',
      weak: 'Mages; keep melee off him.',
      armourVsRanged: 0.7,
      thorns: 8,
      noPin: true,
      phase: { enrage: 1.3 },
    },
    boss_vexis: {
      role: 'Boss — shadow',
      trait:
        'Pounce and Backstab; hunts archers, mages and healers. At half health it strikes 40% harder.',
      weak: 'Low health for a boss; pin it with a tight formation.',
      prefer: 'support',
      pounce: 2,
      backstab: 1.5,
      phase: { enrage: 1.4 },
    },
    boss_karg: {
      role: 'Boss — forge walker',
      trait: 'Iron Shell; heads for your buildings. At half health it calls goblin sappers.',
      weak: 'Sappers and mages.',
      prefer: 'building',
      armourVsRanged: 0.6,
      thorns: 6,
      noPin: true,
      phase: { summon: ['goblin_sapper', 4] },
    },
    boss_sylvara: {
      role: 'Boss — wyrm mother',
      trait: 'Wyrmfire. At half health she calls a flight of harpies.',
      weak: 'Ballistae.',
      kite: true,
      splashEvery: { n: 1, r: 48, pct: 0.5 },
      phase: { summon: ['harpy', 5] },
    },
    boss_rotfather: {
      role: 'Boss — plague lord',
      trait: 'Plague, Regrowth and Rupture. At half health a swarm of rats pours out of him.',
      weak: 'Kill him far from your line.',
      plague: { dps: 4, ticks: 300 },
      regen: 0.008,
      deathBurst: { r: 70, dmg: 60 },
      phase: { summon: ['plague_rat', 8] },
    },
    boss_volk: {
      role: 'Boss — dread marshal',
      trait: 'War Banner and Suppressing Fire. At half health he enrages.',
      weak: 'Cavalry; break his escort and he is alone.',
      warAura: { r: 140 },
      hex: { pct: 0.2, ticks: 240 },
      noPin: true,
      phase: { enrage: 1.3 },
    },
    boss_malachar: {
      role: 'Boss — the eternal',
      trait: 'Hex, Regrowth and War Banner. At half health he enrages and calls dark knights.',
      weak: 'Everything you have, at once.',
      warAura: { r: 150 },
      hex: { pct: 0.25, ticks: 300 },
      regen: 0.006,
      noPin: true,
      phase: { enrage: 1.35, summon: ['dark_knight', 3] },
    },
  };

  // Stat changes for enemies that are defined in code. Troops and the fifteen core
  // enemies are tuned in data/units.json and data/enemies.json.
  const ENEMY_STATS = {
    harpy: { hp: 44, speed: 0.95 },
    goblin_burrower: { hp: 38, speed: 0.8 },
    plague_rat: { hp: 24, speed: 1.15 },
    sky_drake: { hp: 120, damage: 34 },
    hellbound_legionnaire: { hp: 90 },
    nightmare_strider: { hp: 95, speed: 1.1 },
    grim_revenant: { hp: 76, damage: 48 },
    umbral_stalker: { hp: 80, damage: 58 },
    cinderbound_juggernaut: { hp: 380, speed: 0.22 },
    abomination: { hp: 280, speed: 0.5 },
    behemoth: { hp: 420 },
    iron_colossus: { hp: 480 },
    void_stalker: { hp: 120, damage: 64 },
    elder_wyrm: { hp: 320 },
  };

  function applyStatTable() {
    if (typeof EnemyDefs === 'undefined') return;
    for (const type in ENEMY_STATS) {
      const def = EnemyDefs[type];
      if (def) Object.assign(def, ENEMY_STATS[type]);
    }
  }

  // ---------------------------------------------------------------- profiles
  const SUPPORT = { archer: 1, mage: 1, healer: 1, bard: 1, ballista: 1, courier: 1, builder: 1 };
  const MOUNTED = { warg_rider: 1, dark_knight: 1, nightmare_strider: 1, behemoth: 1 };

  function archetypeKey(unit) {
    if (unit.isWwe) return 'champion';
    const kind = unit.combatType;
    if (kind === 'healer') return 'op_medic';
    if (kind === 'cavalry') return 'op_lancer';
    if (kind === 'ranged' || (unit.range || 0) > 60) {
      return (unit.range || 0) >= 175 ? 'op_marksman' : 'op_gunner';
    }
    if ((unit.maxHp || 0) >= 240) return 'op_juggernaut';
    if ((unit.speed || 0) >= 1.12) return 'op_duelist';
    return 'op_vanguard';
  }

  /** The profile that governs a unit. Cached on the unit; pooled units are wiped on reuse. */
  function profileOf(unit) {
    if (!unit) return null;
    if (unit.rosterKey) return operativeProfile(unit.rosterKey, unit.rosterFaction) || null;
    if (unit.team === 'enemy') return ENEMIES[unit.type] || null;
    if (unit.team !== 'player') return null;
    if (TROOPS[unit.type]) return TROOPS[unit.type];
    if (unit.isCrossover || unit.isWwe) {
      unit.rosterKey = archetypeKey(unit);
      unit.rosterFaction = unit.isWwe ? null : factionOf(unit);
      return operativeProfile(unit.rosterKey, unit.rosterFaction);
    }
    return null;
  }

  function describe(unit) {
    const p = profileOf(unit);
    return p ? { role: p.role, trait: p.trait, weak: p.weak } : null;
  }

  function describeType(type, team) {
    const p = team === 'enemy' ? ENEMIES[type] : TROOPS[type];
    return p ? { role: p.role, trait: p.trait, weak: p.weak } : null;
  }

  // ------------------------------------------------------------------ spawn
  function onSpawn(unit, wave = 0) {
    // Enemies used to land one blow in four all game. Their aim now improves as the siege goes on.
    if (unit.team === 'enemy' && unit.accuracy > 0) {
      unit.accuracy = Math.min(85, unit.accuracy + Math.min(30, wave * 1.5));
    }
    const p = profileOf(unit);
    if (!p) return;
    if (p.alwaysRunner && unit.team === 'enemy') {
      unit.lineBreaker = true;
      unit.stormLine = true;
    }
    if (p.fearless) unit.fightToDeath = true;
  }

  // ----------------------------------------------------------------- combat
  function isBig(target) {
    return (
      target.isNamedBoss ||
      target.isPlanetBoss ||
      (typeof isMonsterEnemy === 'function' && isMonsterEnemy(target)) ||
      (typeof isEliteEnemy === 'function' && isEliteEnemy(target))
    );
  }

  function isBehind(attacker, target) {
    if (target.rotation == null) return false;
    const rad = (target.rotation * Math.PI) / 180;
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return false;
    return (dx * Math.cos(rad) + dy * Math.sin(rad)) / len < -0.5;
  }

  function splash(attacker, target, radius, amount, ctx) {
    if (!(amount >= 1)) return;
    const r2 = radius * radius;
    const units = ctx.units;
    let hits = 0;
    for (let i = 0; i < units.length && hits < 6; i++) {
      const u = units[i];
      if (u === target || u.hp <= 0 || u.team === attacker.team || u.team === 'neutral') continue;
      const dx = u.x - target.x;
      const dy = u.y - target.y;
      if (dx * dx + dy * dy > r2) continue;
      ctx.hurt(u, amount, attacker);
      hits++;
    }
  }

  /** Damage dealt. Also applies on-hit effects, since this runs as the blow lands. */
  function modifyDamage(attacker, target, dmg, ctx) {
    if (!attacker || !target || !(dmg > 0) || attacker.team === target.team) return dmg;
    const p = profileOf(attacker);
    const tick = ctx.tick;
    let mult = 1;
    if ((attacker.hexUntil || 0) > tick) mult *= 1 - (attacker.hexPct || 0.2);
    if (attacker.team === 'enemy' && (attacker.warAuraUntil || 0) > tick) mult *= 1.15;
    if (
      attacker.team === 'player' &&
      (attacker.spotUntil || 0) > tick &&
      (attacker.range || 0) > 60
    ) {
      mult *= 1.12;
    }
    if (attacker.enraged) mult *= attacker.enraged;
    if (!p) return mult === 1 ? dmg : Math.max(1, Math.round(dmg * mult));

    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const dist = Math.hypot(dx, dy);
    if (p.farShot && dist >= p.farShot.min) mult *= p.farShot.mult;
    if (p.closeWeak && dist <= p.closeWeak.within) mult *= p.closeWeak.mult;
    if (p.runDown && (target.lineBreaker || target.fleeing)) mult *= p.runDown;
    if (p.bossBane && isBig(target)) mult *= p.bossBane;
    if (p.vsType && p.vsType[target.type]) mult *= p.vsType[target.type];
    if (p.bloodRage && attacker.hp < attacker.maxHp * 0.5) mult *= p.bloodRage;
    if (p.swarm && attacker.packN > 0)
      mult *= 1 + Math.min(p.swarm.max, attacker.packN * p.swarm.per);
    if (p.backstab && isBehind(attacker, target)) mult *= p.backstab;
    if (p.pounce && !attacker.pounced) {
      attacker.pounced = true;
      mult *= p.pounce;
    }
    if (p.pounceEach && attacker.lastPounceId !== target.id) {
      attacker.lastPounceId = target.id;
      mult *= p.pounceEach;
    }

    const out = mult === 1 ? dmg : Math.max(1, Math.round(dmg * mult));

    if (p.hex) {
      if ((target.hexUntil || 0) <= tick) ctx.playSfx('hexCast');
      target.hexUntil = tick + p.hex.ticks;
      target.hexPct = p.hex.pct;
    }
    if (p.plague) {
      target.poisonUntil = tick + p.plague.ticks;
      target.poisonDps = p.plague.dps;
      // Firebombs burn; bites and boils poison.
      if (FIRE_TYPES[attacker.type]) {
        target.burnUntil = tick + p.plague.ticks;
        ctx.playSfx('firebomb');
        ctx.burst('strikeFire', target.x, target.y, 0.5);
      }
    }
    if (p.pounce === undefined && p.cleave && attacker.team === 'enemy') ctx.shake(1.5);
    if (p.splashEvery) {
      attacker.swingN = (attacker.swingN || 0) + 1;
      if (attacker.swingN % p.splashEvery.n === 0) {
        splash(attacker, target, p.splashEvery.r, out * p.splashEvery.pct, ctx);
      }
    }
    if (p.cleave) splash(attacker, target, p.cleave.r, out * p.cleave.pct, ctxOne(ctx));
    return out;
  }

  /** Cleave wounds one extra enemy; reuse splash with a single-hit budget. */
  function ctxOne(ctx) {
    let used = false;
    return {
      units: ctx.units,
      hurt: (u, amount, attacker) => {
        if (used) return;
        used = true;
        ctx.hurt(u, amount, attacker);
      },
    };
  }

  /** Damage taken. `opts` is the takeDamage options object. */
  function modifyDamageTaken(unit, amount, opts, ctx) {
    if (!(amount > 0)) return amount;
    const tick = ctx.tick;
    const attacker = opts && opts.attacker;
    const ranged = !!attacker && ((attacker.range || 0) > 60 || !!opts.projectile);
    let mult = 1;
    if (unit.team === 'enemy' && (unit.wardUntil || 0) > tick) mult *= 0.9;
    if (unit.team === 'player' && (unit.bulwarkUntil || 0) > tick) mult *= 0.9;
    const p = profileOf(unit);
    if (p) {
      if (p.brace && unit.braceN > 0) {
        mult *= 1 - Math.min(0.36, unit.braceN * 0.12);
        unit.blockFlash = tick + 8;
        ctx.playSfx('shieldBlock');
      }
      if (p.armourVsRanged && ranged) {
        unit.blockFlash = tick + 8;
        ctx.playSfx('arrowThunk');
      }
      if (p.flatResist) mult *= 1 - p.flatResist;
      if (p.frail) mult *= p.frail;
      if (p.armourVsRanged && ranged) mult *= p.armourVsRanged;
      if (p.dodgeRanged && ranged && ctx.rng() < p.dodgeRanged) {
        ctx.float(unit.x, unit.y - 12, 'DODGE', '#80c0ff');
        return 0;
      }
      if (
        attacker &&
        attacker.hp > 0 &&
        !ranged &&
        !opts.rosterEcho &&
        attacker.team !== unit.team
      ) {
        if (p.thorns) ctx.hurt(attacker, p.thorns, unit, true);
        if (p.reflectCharge && (MOUNTED[attacker.type] || attacker.combatType === 'cavalry')) {
          ctx.hurt(attacker, amount * p.reflectCharge, unit, true);
        }
      }
    }
    return mult === 1 ? amount : amount * mult;
  }

  function blocksPin(unit) {
    const p = profileOf(unit);
    return !!(p && p.noPin);
  }

  const FIRE_TYPES = {
    sky_drake: 1,
    elder_wyrm: 1,
    goblin_firebrand: 1,
    boss_sylvara: 1,
    boss_grimm: 1,
    cinderbound_juggernaut: 1,
  };
  const BLAST_TYPES = {
    sapper: 1,
    ballista: 1,
    hellmortar_pack: 1,
    goblin_sapper: 1,
    mage: 1,
    dark_mage: 1,
  };
  const BOW_TYPES = {
    archer: 1,
    orc_archer: 1,
    scout: 1,
    hellbound_legionnaire: 1,
    grim_revenant: 1,
  };
  const CLEAVE_TYPES = {
    knight: 1,
    berserker: 1,
    behemoth: 1,
    troll: 1,
    dark_knight: 1,
    cavalry: 1,
  };

  /** How a unit died, for the death animation and sound: burn, blast, arrow, cleave or fall. */
  function deathCause(unit, opts, amount, tick = 0) {
    const a = opts && opts.attacker;
    if ((unit.burnUntil || 0) > tick || (a && FIRE_TYPES[a.type]) || (opts && opts.dragonStrike)) {
      return 'burn';
    }
    if ((opts && opts.splash) || (a && BLAST_TYPES[a.type]) || (!a && amount >= unit.maxHp * 0.5)) {
      return 'blast';
    }
    if (a && BOW_TYPES[a.type]) return 'arrow';
    if (a && (CLEAVE_TYPES[a.type] || a.isNamedBoss || amount >= unit.maxHp * 0.6)) return 'cleave';
    return 'fall';
  }

  // ------------------------------------------------------------------ deaths
  function onDeath(unit, killer, ctx) {
    const p = profileOf(unit);
    if (p && p.deathBurst && !unit.breachedLine) {
      ctx.float(unit.x, unit.y - 10, 'BURST', '#ff8040');
      ctx.shake(3);
      const r2 = p.deathBurst.r * p.deathBurst.r;
      for (const u of ctx.units) {
        if (u.hp <= 0 || u.team === unit.team || u === unit) continue;
        const dx = u.x - unit.x;
        const dy = u.y - unit.y;
        if (dx * dx + dy * dy <= r2) ctx.hurt(u, p.deathBurst.dmg, null, true);
      }
    }
    const kp = killer ? profileOf(killer) : null;
    if (kp && kp.killCheer) {
      const r2 = kp.killCheer.r * kp.killCheer.r;
      for (const u of ctx.units) {
        if (u.team !== killer.team || u.hp <= 0 || !(u.maxMorale > 0)) continue;
        const dx = u.x - killer.x;
        const dy = u.y - killer.y;
        if (dx * dx + dy * dy <= r2)
          u.morale = Math.min(u.maxMorale, u.morale + kp.killCheer.morale);
      }
    }
  }

  // --------------------------------------------------------------- slow tick
  const grid = new Map();

  function cellKey(x, y) {
    return ((x / CELL) | 0) * 4096 + ((y / CELL) | 0);
  }

  function buildGrid(units) {
    grid.clear();
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.hp <= 0) continue;
      const k = cellKey(u.x, u.y);
      const list = grid.get(k);
      if (list) list.push(u);
      else grid.set(k, [u]);
    }
  }

  function forNear(u, radius, fn) {
    const r2 = radius * radius;
    const cx = (u.x / CELL) | 0;
    const cy = (u.y / CELL) | 0;
    const span = Math.ceil(radius / CELL);
    for (let gx = cx - span; gx <= cx + span; gx++) {
      for (let gy = cy - span; gy <= cy + span; gy++) {
        const list = grid.get(gx * 4096 + gy);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const o = list[i];
          if (o === u || o.hp <= 0) continue;
          const dx = o.x - u.x;
          const dy = o.y - u.y;
          if (dx * dx + dy * dy <= r2) fn(o);
        }
      }
    }
  }

  function runPhase(unit, phase, ctx) {
    unit.phased = true;
    ctx.float(unit.x, unit.y - 34, 'ENRAGED', '#ff3030');
    ctx.shake(6);
    ctx.playSfx('enrage');
    rings.push({ x: unit.x, y: unit.y, max: 150, age: 0, color: '255,40,30' });
    ctx.burst('critBurst', unit.x, unit.y);
    if (phase.enrage) unit.enraged = phase.enrage;
    if (phase.regen) unit.phaseRegen = phase.regen;
    if (phase.summon) {
      const [type, count] = phase.summon;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        ctx.spawnEnemy(type, unit.x + Math.cos(a) * 34, unit.y + Math.sin(a) * 34);
      }
    }
    ctx.showMessage(`${ctx.unitName(unit)} is wounded and turns savage!`, 240);
  }

  function slowTick(ctx) {
    const units = ctx.units;
    const tick = ctx.tick;
    const until = tick + SLOW_TICK + 15;
    buildGrid(units);
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.hp <= 0) continue;
      if ((u.poisonUntil || 0) > tick && u.poisonDps > 0) {
        ctx.hurt(u, u.poisonDps * (SLOW_TICK / 60), null, true);
        if (u.hp <= 0) continue;
      }
      const p = profileOf(u);
      if (!p) continue;
      const regen = u.phaseRegen || p.regen;
      if (regen && u.hp < u.maxHp)
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * regen * (SLOW_TICK / 60));
      if (p.phase && !u.phased && u.hp < u.maxHp * 0.5) runPhase(u, p.phase, ctx);
      if (p.brace) {
        let n = 0;
        forNear(u, 42, (o) => {
          if (o.team === u.team && (o.type === 'footman' || o.type === 'pikeman')) n++;
        });
        u.braceN = Math.min(3, n);
      }
      if (p.swarm) {
        let n = 0;
        forNear(u, 60, (o) => {
          if (o.type === u.type && o.team === u.team) n++;
        });
        u.packN = n;
      }
      if (p.warAura) {
        forNear(u, p.warAura.r, (o) => {
          if (o.team === u.team) o.warAuraUntil = until;
        });
      }
      if (p.wardAura) {
        forNear(u, p.wardAura.r, (o) => {
          if (o.team === u.team) o.wardUntil = until;
        });
      }
      if (p.bulwarkAura) {
        forNear(u, p.bulwarkAura.r, (o) => {
          if (o.team === u.team) o.bulwarkUntil = until;
        });
      }
      if (p.spotAura) {
        forNear(u, p.spotAura.r, (o) => {
          if (o.team === u.team) o.spotUntil = until;
        });
      }
      if (p.dressing) {
        forNear(u, p.dressing.r, (o) => {
          if (o.team === u.team && o.hp < o.maxHp) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * p.dressing.pct * (SLOW_TICK / 60));
          }
        });
      }
      if (p.dirgeAura && tick - (u.wailAt || -9999) > 540) {
        u.wailAt = tick;
        ctx.playSfx('wraithWail');
      }
      if (p.dirgeAura) {
        forNear(u, p.dirgeAura.r, (o) => {
          if (o.team !== u.team && o.maxMorale > 0 && !o.isGeneral && o.morale > 0) {
            o.morale = Math.max(0, o.morale - p.dirgeAura.morale * (SLOW_TICK / 60));
          }
        });
      }
      if (p.songAura) {
        forNear(u, p.songAura.r, (o) => {
          if (o.team === u.team && o.maxMorale > 0 && o.morale < o.maxMorale) {
            o.morale = Math.min(o.maxMorale, o.morale + p.songAura.morale * (SLOW_TICK / 60));
          }
        });
      }
    }
  }

  function update(ctx) {
    if (ctx.tick % SLOW_TICK === 0) slowTick(ctx);
  }

  // ---------------------------------------------------------------- overlays
  const rings = [];

  function auraRing(c, u, radius, rgb, tick, dashed) {
    c.strokeStyle = `rgba(${rgb},${0.28 + Math.sin(tick / 14 + u.x) * 0.08})`;
    c.lineWidth = 1.6;
    if (dashed) c.setLineDash([6, 6]);
    c.beginPath();
    c.arc(u.x, u.y, radius, 0, Math.PI * 2);
    c.stroke();
    if (dashed) c.setLineDash([]);
  }

  /** Everything a trait does is drawn here, so the player can see why a fight is going the way it is. */
  function drawOverlays(c, units, tick) {
    c.save();
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.age++;
      const k = ring.age / 40;
      if (k >= 1) {
        rings.splice(i, 1);
        continue;
      }
      c.strokeStyle = `rgba(${ring.color},${(1 - k) * 0.85})`;
      c.lineWidth = 5 * (1 - k) + 1;
      c.beginPath();
      c.arc(ring.x, ring.y, ring.max * (0.1 + 0.9 * k), 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.hp <= 0) continue;
      const p = profileOf(u);
      // Aura sources: a ring on the ground shows the reach.
      if (p) {
        if (p.warAura) auraRing(c, u, p.warAura.r, '220,40,30', tick, true);
        if (p.wardAura) auraRing(c, u, p.wardAura.r, '120,200,120', tick, true);
        if (p.dirgeAura) auraRing(c, u, p.dirgeAura.r, '150,200,255', tick, false);
        if (p.songAura && u.team === 'player')
          auraRing(c, u, p.songAura.r, '230,200,120', tick, true);
      }
      // Enraged bosses pulse red.
      if (u.enraged) {
        const pulse = 0.25 + Math.abs(Math.sin(tick / 9)) * 0.3;
        c.fillStyle = `rgba(255,30,20,${pulse})`;
        c.beginPath();
        c.arc(u.x, u.y, 26, 0, Math.PI * 2);
        c.fill();
      }
      // War Cry and Hold the Line.
      if ((u.warCryUntil || 0) > tick) {
        c.strokeStyle = 'rgba(255,150,60,0.75)';
        c.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          const a = tick / 10 + (k * Math.PI * 2) / 3;
          c.beginPath();
          c.moveTo(u.x + Math.cos(a) * 11, u.y + Math.sin(a) * 11);
          c.lineTo(u.x + Math.cos(a) * 17, u.y + Math.sin(a) * 17);
          c.stroke();
        }
      }
      if ((u.holdLineUntil || 0) > tick) {
        c.strokeStyle = 'rgba(170,200,255,0.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(u.x, u.y, 14, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      }
      // Braced footmen and pikemen: a bone-white chevron in front of the shield.
      if (u.braceN > 0 && u.team === 'player') {
        c.strokeStyle = (u.blockFlash || 0) > tick ? '#ffffff' : 'rgba(228,220,196,0.55)';
        c.lineWidth = (u.blockFlash || 0) > tick ? 2.5 : 1.3;
        for (let k = 0; k < u.braceN; k++) {
          c.beginPath();
          c.moveTo(u.x - 8, u.y - 15 - k * 3);
          c.lineTo(u.x, u.y - 19 - k * 3);
          c.lineTo(u.x + 8, u.y - 15 - k * 3);
          c.stroke();
        }
      } else if ((u.blockFlash || 0) > tick) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(u.x, u.y, 13, 0, Math.PI * 2);
        c.stroke();
      }
      // Status marks above the head: hex, poison, fire, banner, ward.
      let mx = u.x - 10;
      const my = u.y - 30;
      if ((u.hexUntil || 0) > tick) {
        c.fillStyle = '#b060ff';
        c.strokeStyle = '#07050a';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(mx, my - 4);
        c.lineTo(mx + 4, my);
        c.lineTo(mx, my + 4);
        c.lineTo(mx - 4, my);
        c.closePath();
        c.fill();
        c.stroke();
        mx += 10;
      }
      if ((u.burnUntil || 0) > tick) {
        const fl = Math.sin(tick / 3 + i) * 1.5;
        c.fillStyle = '#ff7a20';
        c.beginPath();
        c.moveTo(mx - 4, my + 4);
        c.lineTo(mx, my - 6 - fl);
        c.lineTo(mx + 4, my + 4);
        c.closePath();
        c.fill();
        c.fillStyle = '#ffd040';
        c.fillRect(mx - 1, my, 2, 3);
        mx += 10;
      } else if ((u.poisonUntil || 0) > tick) {
        c.fillStyle = '#80c040';
        c.strokeStyle = '#07050a';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(mx, my + 1, 3.5, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillRect(mx - 0.8, my - 6, 1.6, 4);
        mx += 10;
      }
      if (u.team === 'enemy' && (u.warAuraUntil || 0) > tick) {
        c.fillStyle = '#c8202a';
        c.fillRect(mx - 3, my - 4, 6, 5);
        c.fillStyle = '#07050a';
        c.fillRect(mx - 4, my - 5, 1.5, 10);
        mx += 10;
      }
      if (u.team === 'enemy' && (u.wardUntil || 0) > tick) {
        c.strokeStyle = '#80e080';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(mx, my, 3.5, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.restore();
  }

  // ---------------------------------------------------------------------- AI
  /** What an enemy goes for first: 'support', 'building' or nothing. */
  function preference(unit) {
    const p = profileOf(unit);
    return p && p.prefer ? p.prefer : null;
  }

  function isSupport(unit) {
    return !!SUPPORT[unit.type] || unit.combatType === 'healer';
  }

  /** Skirmishers give ground when a soldier gets inside this distance. */
  function kiteDistance(unit) {
    const p = profileOf(unit);
    if (!p || !p.kite) return 0;
    return Math.max(50, (unit.range || 0) * 0.4);
  }

  applyStatTable();

  return {
    TROOPS,
    ENEMIES,
    ARCHETYPES,
    FACTION_SIGNATURES,
    profileOf,
    describe,
    describeType,
    onSpawn,
    modifyDamage,
    modifyDamageTaken,
    blocksPin,
    deathCause,
    drawOverlays,
    onDeath,
    update,
    preference,
    isSupport,
    kiteDistance,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Roster = Roster;
