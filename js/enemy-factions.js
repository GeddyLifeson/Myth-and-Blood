/**
 * Enemy factions. One faction leads each wave and brings its own tactic.
 *
 *   FACTIONS  who they are, and the older four-stage tier data (unit unlocks by wave,
 *             counter-raids) that other modules still read.
 *   HOSTS     what each faction fields when it leads: roster, bosses, crest, tactic.
 *   TACTICS   how a led wave behaves on the field. Plain data; js/host-tactics.js reads it.
 *   HORDES    the horde flavours, each a real recipe with its own behaviour.
 *
 * planWave() picks tomorrow's lead (and at most one ally) at nightfall; composeWave() turns
 * that plan into a spawn queue. Both are pure for a given seed and game state.
 */
const EnemyFactions = (() => {
  const EVOLUTION_STAGES = {
    1: { label: 'Grunts', short: 'Grunts', desc: 'Basic horde filler thickens the lanes.' },
    2: {
      label: 'Elite Host',
      short: 'Elites',
      desc: 'Veteran elites and named sub-bosses join the assault.',
    },
    3: {
      label: 'Fortified',
      short: 'Forts',
      desc: 'Enemy outposts and hamlets rise in the north.',
    },
    4: {
      label: 'Kingdom',
      short: 'Kingdom',
      desc: 'Full mirror settlements — counter-raids strike your hamlets.',
    },
  };

  const FACTIONS = {
    goblin_hordes: {
      id: 'goblin_hordes',
      name: 'Goblin Hordes',
      shortName: 'Goblin',
      color: '#70b848',
      waveMin: 1,
      tiers: [
        {
          tier: 1,
          stage: 1,
          waveMin: 1,
          label: 'Swarm',
          tagline: 'Chittering floods — rats and goblins thicken the lanes.',
          units: ['goblin', 'plague_rat', 'goblin'],
          elites: [],
          subBosses: [],
          weight: 1.15,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 2,
          stage: 2,
          waveMin: 8,
          label: 'Organized',
          tagline: 'Sappers and burrowers — the horde learns to break walls.',
          units: ['goblin', 'goblin_sapper', 'goblin_burrower', 'plague_rat', 'harpy'],
          elites: ['goblin_sapper', 'goblin_burrower', 'goblin_engineer'],
          subBosses: [],
          weight: 1.28,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 3,
          stage: 3,
          waveMin: 18,
          label: 'Siege Crew',
          tagline: 'Engineers claim northern outposts — trade posts and quarries fund the swarm.',
          units: [
            'goblin_sapper',
            'goblin_engineer',
            'goblin_burrower',
            'siege_tower',
            'plague_rat',
          ],
          elites: ['goblin_engineer', 'siege_tower'],
          subBosses: [],
          weight: 1.4,
          buildings: ['enemy_trade_outpost', 'enemy_quarry'],
          buildingCap: 4,
          buildInterval: 9,
          counterRaids: false,
        },
        {
          tier: 4,
          stage: 4,
          waveMin: 40,
          label: 'Goblin Kingdom',
          tagline: 'Hamlets in the north — counter-raids probe your settlements.',
          units: ['goblin_engineer', 'goblin_sapper', 'siege_tower', 'goblin_burrower', 'troll'],
          elites: ['goblin_engineer', 'siege_tower', 'troll'],
          subBosses: [],
          weight: 1.52,
          buildings: ['enemy_hamlet', 'enemy_trade_outpost', 'enemy_quarry'],
          buildingCap: 4,
          buildInterval: 8,
          counterRaids: true,
          counterRaidInterval: 14,
        },
      ],
    },
    orc_warbands: {
      id: 'orc_warbands',
      name: 'Orc Warbands',
      shortName: 'Orc',
      color: '#c07048',
      waveMin: 4,
      tiers: [
        {
          tier: 1,
          stage: 1,
          waveMin: 4,
          label: 'Brute Force',
          tagline: 'Orc shoulders and warg hooves — raw pressure.',
          units: ['orc', 'orc_archer', 'warg_rider'],
          elites: [],
          subBosses: [],
          weight: 1.12,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 2,
          stage: 2,
          waveMin: 15,
          label: 'Warband Captains',
          tagline: 'Berserkers and named warlords — Gorath and Thokk lead the charge.',
          units: ['orc', 'berserker', 'warg_rider', 'troll', 'siege_tower'],
          elites: ['berserker', 'troll', 'war_chief'],
          subBosses: ['boss_gorath', 'boss_thokk'],
          weight: 1.28,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 3,
          stage: 3,
          waveMin: 28,
          label: 'Siege Doctrine',
          tagline: 'Warband quarries and outposts supply the northern siege train.',
          units: ['orc', 'berserker', 'siege_tower', 'goblin_sapper', 'iron_colossus'],
          elites: ['war_chief', 'iron_colossus', 'siege_tower'],
          subBosses: ['boss_volk'],
          weight: 1.38,
          buildings: ['enemy_quarry', 'enemy_trade_outpost'],
          buildingCap: 2,
          buildInterval: 12,
          counterRaids: false,
        },
        {
          tier: 4,
          stage: 4,
          waveMin: 55,
          label: 'War Chief Realm',
          tagline: 'Orc hamlets anchor the north — war chiefs counter-raid your economy.',
          units: ['war_chief', 'berserker', 'troll', 'siege_tower', 'iron_colossus', 'orc'],
          elites: ['war_chief', 'iron_colossus'],
          subBosses: ['boss_karg', 'boss_volk'],
          weight: 1.48,
          buildings: ['enemy_hamlet', 'enemy_quarry'],
          buildingCap: 3,
          buildInterval: 10,
          counterRaids: true,
          counterRaidInterval: 12,
        },
      ],
    },
    dark_legions: {
      id: 'dark_legions',
      name: 'Dark Legions',
      shortName: 'Dark',
      color: '#9070d0',
      waveMin: 10,
      tiers: [
        {
          tier: 1,
          stage: 1,
          waveMin: 10,
          label: 'Legion Grunts',
          tagline: 'Dark knights and mages — the legion stirs.',
          units: ['dark_knight', 'dark_mage', 'assassin'],
          elites: [],
          subBosses: [],
          weight: 1.1,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 2,
          stage: 2,
          waveMin: 22,
          label: 'Necromantic Host',
          tagline: 'Necromancers rise the fallen — Morwen and Grimm lead sub-boss strikes.',
          units: ['necromancer', 'bone_summoner', 'shaman', 'dark_knight', 'dark_mage'],
          elites: ['necromancer', 'bone_summoner', 'dreadborn_champion'],
          subBosses: ['boss_morwen', 'boss_grimm', 'boss_rotfather'],
          weight: 1.26,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 3,
          stage: 3,
          waveMin: 35,
          label: 'Shadow Forts',
          tagline: 'Dark outposts anchor the necromantic supply line.',
          units: ['necromancer', 'bone_summoner', 'grim_revenant', 'dark_knight', 'shaman'],
          elites: ['grim_revenant', 'dreadborn_champion'],
          subBosses: ['boss_rotfather'],
          weight: 1.36,
          buildings: ['enemy_trade_outpost'],
          buildingCap: 2,
          buildInterval: 14,
          counterRaids: false,
        },
        {
          tier: 4,
          stage: 4,
          waveMin: 70,
          label: 'Undead Kingdom',
          tagline: 'Shadow academies and hamlets — undead counter-raids scour your holdings.',
          units: [
            'necromancer',
            'bone_summoner',
            'grim_revenant',
            'dreadborn_champion',
            'shaman',
            'dark_knight',
          ],
          elites: ['grim_revenant', 'dreadborn_champion'],
          subBosses: ['boss_morwen', 'boss_malachar'],
          weight: 1.46,
          buildings: ['enemy_shadow_academy', 'enemy_hamlet'],
          buildingCap: 3,
          buildInterval: 12,
          counterRaids: true,
          counterRaidInterval: 10,
        },
      ],
    },
    void_abyssal: {
      id: 'void_abyssal',
      name: 'The Void Court',
      shortName: 'Void',
      color: '#7040b0',
      waveMin: 12,
      tiers: [
        {
          tier: 1,
          stage: 1,
          waveMin: 32,
          label: 'Stalkers',
          tagline: 'Void stalkers hunt your General — evolved assassins prowl.',
          units: ['void_stalker', 'umbral_stalker', 'assassin'],
          elites: [],
          subBosses: [],
          weight: 1.05,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 2,
          stage: 2,
          waveMin: 45,
          label: 'Horrors',
          tagline: 'Abominations spawn — Vexis and Sylvara lead abyssal sub-boss hunts.',
          units: ['abomination', 'void_stalker', 'behemoth', 'umbral_stalker', 'nightmare_strider'],
          elites: ['abomination', 'behemoth', 'nightmare_strider'],
          subBosses: ['boss_vexis', 'boss_sylvara'],
          weight: 1.18,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 3,
          stage: 3,
          waveMin: 58,
          label: 'Abyssal Pits',
          tagline: 'Void quarries tear reality — northern pits feed the horror line.',
          units: ['abomination', 'void_stalker', 'elder_wyrm', 'behemoth'],
          elites: ['elder_wyrm', 'cinderbound_juggernaut'],
          subBosses: ['boss_sylvara'],
          weight: 1.28,
          buildings: ['enemy_quarry'],
          buildingCap: 2,
          buildInterval: 16,
          counterRaids: false,
        },
        {
          tier: 4,
          stage: 4,
          waveMin: 90,
          label: 'Elder Dominion',
          tagline: 'Elder wyrms nest in foe hamlets — abyssal counter-raids strike deep.',
          units: [
            'elder_wyrm',
            'abomination',
            'void_stalker',
            'cinderbound_juggernaut',
            'iron_colossus',
          ],
          elites: ['elder_wyrm', 'cinderbound_juggernaut'],
          subBosses: ['boss_malachar', 'boss_vexis'],
          weight: 1.38,
          buildings: ['enemy_hamlet', 'enemy_quarry'],
          buildingCap: 2,
          buildInterval: 14,
          counterRaids: true,
          counterRaidInterval: 11,
        },
      ],
    },
    wild_hunt: {
      id: 'wild_hunt',
      name: 'The Wild Hunt',
      shortName: 'Hunt',
      color: '#d0a040',
      waveMin: 6,
      tiers: [
        {
          tier: 1,
          stage: 1,
          waveMin: 6,
          label: 'The Pack',
          tagline: 'Wargs and rats run the edges of the field.',
          units: ['warg_rider', 'plague_rat'],
          elites: [],
          subBosses: [],
          weight: 1.1,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 2,
          stage: 2,
          waveMin: 25,
          label: 'Great Beasts',
          tagline: 'Trolls and behemoths lumber in behind the pack.',
          units: ['warg_rider', 'plague_rat', 'troll', 'behemoth'],
          elites: ['troll', 'behemoth'],
          subBosses: [],
          weight: 1.2,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
      ],
    },
    cinder_flight: {
      id: 'cinder_flight',
      name: 'Cinder Flight',
      shortName: 'Cinder',
      color: '#f07828',
      waveMin: 14,
      tiers: [
        {
          tier: 1,
          stage: 1,
          waveMin: 14,
          label: 'The Roost',
          tagline: 'Harpies, wraiths and drakes come over the top of your line.',
          units: ['harpy', 'wailing_wraith', 'sky_drake'],
          elites: [],
          subBosses: [],
          weight: 1.1,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 2,
          stage: 2,
          waveMin: 50,
          label: 'Wyrm Sky',
          tagline: 'Elder wyrms and hellfire crews set the field alight.',
          units: ['harpy', 'sky_drake', 'hellbound_legionnaire', 'elder_wyrm'],
          elites: ['elder_wyrm', 'cinderbound_juggernaut'],
          subBosses: [],
          weight: 1.2,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
      ],
    },
    mirror_empires: {
      id: 'mirror_empires',
      name: 'Mirror Empires',
      shortName: 'Mirror',
      color: '#e05050',
      waveMin: 200,
      tiers: [
        {
          tier: 1,
          stage: 1,
          waveMin: 200,
          label: 'Mirror Grunts',
          tagline: 'The host copies your roster — engineers and sappers probe your doctrine.',
          units: ['goblin_engineer', 'orc', 'goblin_sapper', 'necromancer'],
          elites: [],
          subBosses: [],
          weight: 1.05,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 2,
          stage: 2,
          waveMin: 215,
          label: 'Mirror Elites',
          tagline:
            'War chiefs and dark knights mirror your veterans — Karg and Volk siege your line.',
          units: ['war_chief', 'goblin_engineer', 'necromancer', 'dark_knight', 'siege_tower'],
          elites: ['war_chief', 'dark_knight', 'necromancer'],
          subBosses: ['boss_karg', 'boss_volk'],
          weight: 1.18,
          buildings: [],
          buildingCap: 0,
          buildInterval: 0,
          counterRaids: false,
        },
        {
          tier: 3,
          stage: 3,
          waveMin: 235,
          label: 'Northern Holds',
          tagline: 'Enemy outposts and hamlets mirror your RTS economy.',
          units: ['war_chief', 'goblin_engineer', 'necromancer', 'siege_tower', 'dark_knight'],
          elites: ['war_chief', 'goblin_engineer'],
          subBosses: ['boss_karg'],
          weight: 1.28,
          buildings: ['enemy_trade_outpost', 'enemy_quarry', 'enemy_hamlet'],
          buildingCap: 4,
          buildInterval: 8,
          counterRaids: false,
        },
        {
          tier: 4,
          stage: 4,
          waveMin: 265,
          label: 'Mirror Kingdom',
          tagline:
            'War academies and full compounds — relentless counter-raids on your settlements.',
          units: [
            'war_chief',
            'dark_knight',
            'necromancer',
            'void_stalker',
            'goblin_engineer',
            'elder_wyrm',
          ],
          elites: ['war_chief', 'elder_wyrm', 'void_stalker'],
          subBosses: ['boss_volk', 'boss_malachar'],
          weight: 1.38,
          buildings: [
            'enemy_hamlet',
            'enemy_merchant_guild',
            'enemy_shadow_academy',
            'enemy_war_academy',
          ],
          buildingCap: 6,
          buildInterval: 6,
          counterRaids: true,
          counterRaidInterval: 8,
        },
      ],
    },
  };

  // ------------------------------------------------------------------ tactics
  /**
   * How a led wave behaves. Every key below is read by a small generic hook in
   * js/host-tactics.js; there is no per-faction code path.
   *
   *   squad      { size }          bodies that arrive together (the arrival rate is unchanged)
   *   runners    0..1              share of eligible bodies that run for the line (0 = none)
   *   formation  shield line: `front` types set the pace, the rest hold behind them, and the
   *              host charges when the line is `chargeAt` px from your soldiers. `horn` types
   *              sound the charge; if the host brought one and it is dead, there is no charge.
   *   dash       share of `types` that run down a field edge and turn in at your ranged troops
   *   rise       the dead get up once after `delay` ticks at `hp` of full, unless destroyed
   *   fearless   never routs
   *   ambush     share of `types` that never cross the field: they step out of a rift behind
   *              your line `warn` ticks after it opens
   *   dive       flyers skip the muster, pick your most isolated soldier and dive at `speed`
   *   burn       fire attacks leave burning ground (radius, ticks, damage per second)
   *   rush       the whole host moves at `speed` x normal from the start
   *   mirror     composition answers your army (see StrategyCounterplay)
   *   bossPhase  what the faction's boss does at half health (HostTactics.onBossPhase)
   *   threat     how much harder a body is to beat under this tactic; the host shrinks to match
   */
  const TACTICS = {
    swarm: {
      id: 'swarm',
      name: 'Swarm and Sappers',
      desc: 'Small packs from every part of the edge. A third of them run straight for the line and the sappers go for your buildings.',
      counter:
        'Mages and splash clear packs; keep cavalry or scouts back for runners; guard your buildings.',
      sign: 'Many small packs, runners in the dust.',
      silhouette: 'a wide scatter of small shapes',
      squad: { size: 3 },
      runners: 0.34,
      bossPhase: 'summon',
    },
    shield_wall: {
      id: 'shield_wall',
      name: 'Shield Wall',
      desc: 'Shieldbearers form a row and the host walks in behind it, archers at the back. When the line is close the horn sounds and they charge.',
      counter:
        'Arrows bounce off the shields: use mages and sappers, or kill the War Chief so the horn never sounds.',
      sign: 'A row of shields at walking pace, then a horn.',
      silhouette: 'one dense block behind a straight front',
      squad: { size: 8 },
      runners: 0,
      formation: {
        front: ['orc_shieldbearer'],
        back: ['orc_archer', 'shaman'],
        horn: ['war_chief', 'boss_gorath', 'boss_volk'],
        pace: 0.34,
        chargeAt: 150,
        chargeSpeed: 1.6,
        chargeTicks: 420,
        patience: 4200,
      },
      bossPhase: 'charge',
    },
    flank_dash: {
      id: 'flank_dash',
      name: 'Flank Dash',
      desc: 'Half the pack sprints down the left and right edges of the field and turns in on your archers, mages and healers.',
      counter:
        'Pikemen or footmen on both ends of the line; do not leave ranged troops on the wings.',
      sign: 'Dust along both edges of the field.',
      silhouette: 'fast shapes hugging both edges',
      squad: { size: 5 },
      dash: {
        share: 0.5,
        types: ['warg_rider', 'plague_rat', 'nightmare_strider'],
        speed: 1.3,
        lane: 34,
      },
      bossPhase: 'stampede',
    },
    risen: {
      id: 'risen',
      name: 'The Dead Rise',
      desc: 'They never rout, and each one that falls gets up again once, a few seconds later, unless the body was destroyed.',
      counter:
        'Mages, ballistae, sapper charges, strikes and healers put them down for good; arrows and blades only knock them over.',
      sign: 'Bone piles that stand back up.',
      silhouette: 'a slow, thin column that does not waver',
      squad: { size: 6 },
      fearless: true,
      rise: { delay: 270, hp: 0.5 },
      threat: 1.3,
      bossPhase: 'raise',
    },
    unseen: {
      id: 'unseen',
      name: 'The Unseen Third',
      desc: 'A third of the host never crosses the field. A rift opens behind your line, by the Medical Tent or the General, and they step out of it.',
      counter:
        'Keep a reserve behind the line and a guard on the tent. A Watchtower shows every rift at dawn.',
      sign: 'A violet rift behind your line, then blades.',
      silhouette: 'fewer shapes than the count suggests',
      squad: { size: 5 },
      ambush: {
        share: 0.34,
        types: ['assassin', 'void_stalker', 'umbral_stalker', 'nightmare_strider'],
        warn: 200,
        perRift: 5,
        style: 'rift',
      },
      bossPhase: 'vanish',
    },
    air_raid: {
      id: 'air_raid',
      name: 'Fire from the Sky',
      desc: 'Flyers skip the muster and dive on whichever soldier stands most alone. Their fire leaves burning ground.',
      counter: 'Keep soldiers together, bring ballistae and archers, and step off the embers.',
      sign: 'A talon mark over one soldier; patches of burning ground.',
      silhouette: 'shapes above the field, not on it',
      squad: { size: 4 },
      dive: { speed: 1.5, within: 170, alone: 70 },
      burn: { r: 26, ticks: 420, dps: 5, max: 10 },
      threat: 1.1,
      bossPhase: 'burn',
    },
    mirror: {
      id: 'mirror',
      name: 'Mirror Doctrine',
      desc: 'They have read your army and bring what beats it.',
      counter: 'Change what you field: the host answers the army it saw last night.',
      sign: 'A host built against your line.',
      silhouette: 'a host shaped like the gaps in yours',
      squad: { size: 6 },
      mirror: true,
      bossPhase: 'charge',
    },
  };

  // -------------------------------------------------------------------- hosts
  /**
   * What a faction fields when it leads. `from` is the first wave a type can appear (no type
   * comes earlier than it did before factions led waves). `core` types are always in the
   * host; `key` types carry the tactic; `heavy` types are the expensive ones the composer
   * leans on to hit the wave's threat; `aux` types may march in support of another faction.
   */
  const HOSTS = {
    goblin_hordes: {
      tactic: 'swarm',
      band: (w) => (w < 10 ? 4 : w < 25 ? 2 : 1.2),
      roster: [
        { type: 'goblin', from: 1, w: 6, core: true, aux: true },
        { type: 'goblin_sapper', from: 4, w: 2.2, key: true, aux: true },
        { type: 'goblin_firebrand', from: 5, w: 1.5 },
        { type: 'goblin_burrower', from: 9, w: 1.5 },
        { type: 'goblin_engineer', from: 12, w: 0.5 },
        { type: 'siege_tower', from: 7, w: 0.6, heavy: true, rear: true, cap: 4 },
        { type: 'iron_colossus', from: 40, w: 0.5, heavy: true, rear: true, cap: 3 },
      ],
      bosses: ['boss_karg'],
      champions: ['siege_tower', 'goblin_engineer', 'goblin_sapper'],
      names: ['Skarn Nine-Fingers', 'Old Mother Gnash', 'Pit-Boss Krel'],
    },
    orc_warbands: {
      tactic: 'shield_wall',
      band: (w) => (w < 30 ? 3 : 2),
      roster: [
        { type: 'orc', from: 1, w: 5, core: true, aux: true },
        { type: 'orc_archer', from: 2, w: 2.2, aux: true },
        { type: 'orc_shieldbearer', from: 7, w: 2.6, key: true, front: true },
        { type: 'berserker', from: 7, w: 1.3, heavy: true },
        { type: 'shaman', from: 9, w: 0.5, cap: 3 },
        { type: 'war_chief', from: 10, w: 0.3, key: true, heavy: true, cap: 2 },
      ],
      bosses: ['boss_gorath', 'boss_volk'],
      champions: ['war_chief', 'berserker', 'orc'],
      names: ['Urzog Red-Hand', 'Brakka the Scarred', 'Dhurn Oathbreaker'],
    },
    wild_hunt: {
      tactic: 'flank_dash',
      band: () => 2,
      roster: [
        { type: 'warg_rider', from: 3, w: 3, core: true, aux: true },
        { type: 'plague_rat', from: 6, w: 4, core: true, aux: true },
        { type: 'troll', from: 6, w: 0.9, heavy: true, cap: 6 },
        { type: 'behemoth', from: 25, w: 0.5, heavy: true, cap: 4 },
      ],
      bosses: ['boss_thokk'],
      champions: ['behemoth', 'troll', 'warg_rider'],
      names: ['The Grey Bitch', 'Hollow-Tusk', 'Ruin-Paw'],
    },
    dark_legions: {
      tactic: 'risen',
      band: (w) => (w < 20 ? 2 : 2.5),
      roster: [
        { type: 'dark_knight', from: 8, w: 2.4, core: true },
        { type: 'necromancer', from: 8, w: 1.4, key: true, aux: true },
        { type: 'bone_summoner', from: 11, w: 1.1, aux: true },
        { type: 'abomination', from: 20, w: 0.6, heavy: true, cap: 5 },
        { type: 'dreadborn_champion', from: 35, w: 0.4, heavy: true, cap: 3 },
        { type: 'grim_revenant', from: 45, w: 0.8 },
      ],
      bosses: ['boss_morwen', 'boss_rotfather', 'boss_malachar'],
      champions: ['dreadborn_champion', 'abomination', 'dark_knight'],
      names: ['Ser Valdric the Unburied', 'The Ashen Abbess', 'Wight-Captain Orm'],
    },
    void_abyssal: {
      tactic: 'unseen',
      band: (w) => (w < 32 ? 1.3 : 2.2),
      roster: [
        { type: 'dark_mage', from: 5, w: 2.6, core: true, aux: true },
        { type: 'assassin', from: 8, w: 2, core: true, key: true },
        { type: 'nightmare_strider', from: 30, w: 1, heavy: true },
        { type: 'void_stalker', from: 32, w: 1, heavy: true },
        { type: 'warp_prophet', from: 40, w: 0.8, aux: true },
        { type: 'umbral_stalker', from: 50, w: 0.8, heavy: true },
      ],
      bosses: ['boss_vexis'],
      champions: ['void_stalker', 'umbral_stalker', 'assassin'],
      names: ['The Quiet Sister', 'Nhal of the Ninth Door', 'Whisper-Without-Face'],
    },
    cinder_flight: {
      tactic: 'air_raid',
      band: (w) => (w < 25 ? 1.5 : 2),
      roster: [
        { type: 'harpy', from: 6, w: 4, core: true, aux: true },
        { type: 'wailing_wraith', from: 12, w: 1.4 },
        { type: 'sky_drake', from: 14, w: 1.5, key: true, heavy: true },
        { type: 'hellbound_legionnaire', from: 25, w: 1.4, aux: true },
        { type: 'elder_wyrm', from: 50, w: 0.5, heavy: true, cap: 4 },
        { type: 'cinderbound_juggernaut', from: 55, w: 0.4, heavy: true, cap: 3 },
        { type: 'hellmortar_pack', from: 60, w: 0.6, rear: true },
      ],
      bosses: ['boss_grimm', 'boss_sylvara'],
      champions: ['elder_wyrm', 'sky_drake', 'harpy'],
      names: ['Ashwing', 'The Red Matron', 'Cinder-Eye'],
    },
    mirror_empires: {
      tactic: 'mirror',
      band: () => 2,
      roster: [
        { type: 'orc', from: 1, w: 3, core: true },
        { type: 'dark_knight', from: 1, w: 2, core: true },
        { type: 'goblin_engineer', from: 1, w: 0.6 },
        { type: 'necromancer', from: 1, w: 1 },
        { type: 'war_chief', from: 1, w: 0.4, heavy: true, cap: 3 },
        { type: 'siege_tower', from: 1, w: 0.5, heavy: true, rear: true, cap: 4 },
      ],
      bosses: [],
      champions: ['war_chief', 'dark_knight'],
      names: ['The Other General', 'Your Shadow in Iron', 'Marshal of the Glass'],
    },
  };

  // ------------------------------------------------------------------- hordes
  /**
   * Horde flavours. Each is a recipe (who comes, in what shares) plus the tactic keys that
   * make it play differently. A flavour is only offered once every type in `needs` is out.
   */
  const HORDES = [
    {
      id: 'goblin_tide',
      label: 'Goblin Tide',
      tagline: 'Goblins in small packs across the whole edge, and a third of them run.',
      faction: 'goblin_hordes',
      mix: [
        { type: 'goblin', w: 8 },
        { type: 'goblin_firebrand', w: 1, from: 5 },
      ],
      tactic: { squad: { size: 4 }, runners: 0.36 },
      counter: 'Splash damage, and something fast kept back for runners.',
    },
    {
      id: 'orc_pack',
      label: 'Orc Pack',
      tagline: 'No shield wall and no waiting: the whole warband comes at a run.',
      faction: 'orc_warbands',
      needs: ['orc'],
      mix: [
        { type: 'orc', w: 6 },
        { type: 'berserker', w: 1.5, from: 8 },
        { type: 'orc_archer', w: 1.5 },
      ],
      tactic: { squad: { size: 8 }, runners: 0, rush: { speed: 1.3 } },
      counter: 'Pikemen and a braced line; they arrive together and fast.',
    },
    {
      id: 'plague_swarm',
      label: 'Plague Swarm',
      tagline: 'Rats pour down both edges of the field. Their bites keep hurting.',
      faction: 'wild_hunt',
      needs: ['plague_rat'],
      from: 6,
      mix: [
        { type: 'plague_rat', w: 8 },
        { type: 'goblin', w: 2 },
      ],
      tactic: {
        squad: { size: 6 },
        dash: { share: 0.6, types: ['plague_rat'], speed: 1.15, lane: 34 },
      },
      counter: 'Splash damage and healers; guard the ends of the line.',
    },
    {
      id: 'warg_run',
      label: 'Warg Run',
      tagline: 'Riders down both wings, straight at your archers and healers.',
      faction: 'wild_hunt',
      needs: ['warg_rider'],
      from: 6,
      mix: [
        { type: 'warg_rider', w: 5 },
        { type: 'goblin', w: 4 },
        { type: 'plague_rat', w: 2, from: 6 },
      ],
      tactic: {
        squad: { size: 5 },
        dash: { share: 0.85, types: ['warg_rider'], speed: 1.3, lane: 34 },
      },
      counter: 'Pikemen on both wings.',
    },
    {
      id: 'sapper_rush',
      label: 'Sapper Rush',
      tagline:
        'A screen of goblins up front; the sappers behind it are all headed for your buildings.',
      faction: 'goblin_hordes',
      needs: ['goblin_sapper'],
      from: 5,
      mix: [
        { type: 'goblin', w: 6, front: true },
        { type: 'goblin_sapper', w: 4 },
        { type: 'goblin_firebrand', w: 1, from: 5 },
      ],
      tactic: { squad: { size: 6 }, runners: 0.15 },
      counter: 'Archers on the sappers before they reach a wall; they burst when they die.',
    },
    {
      id: 'burrower_surge',
      label: 'Burrower Surge',
      tagline: 'Half the host comes up out of the ground behind your line.',
      faction: 'goblin_hordes',
      needs: ['goblin_burrower'],
      from: 9,
      mix: [
        { type: 'goblin_burrower', w: 5 },
        { type: 'goblin', w: 5 },
      ],
      tactic: {
        squad: { size: 5 },
        runners: 0.1,
        ambush: {
          share: 0.5,
          types: ['goblin_burrower'],
          warn: 240,
          perRift: 6,
          style: 'tunnel',
        },
      },
      counter: 'A reserve behind the line; scouts and watchtowers show the tunnel mouths at dawn.',
    },
  ];

  /** The fixed escort a boss wave used to bring, kept only to size the new escort's threat. */
  const LEGACY_BOSS_ESCORT = [
    ['dark_knight', 1],
    ['dark_knight', 1],
    ['berserker', 1],
    ['necromancer', 1],
    ['bone_summoner', 10],
    ['sky_drake', 14],
    ['abomination', 20],
    ['hellbound_legionnaire', 25],
    ['dreadborn_champion', 25],
    ['behemoth', 25],
    ['warp_prophet', 35],
    ['grim_revenant', 35],
    ['void_stalker', 35],
    ['iron_colossus', 40],
    ['umbral_stalker', 45],
    ['hellmortar_pack', 45],
    ['elder_wyrm', 50],
    ['cinderbound_juggernaut', 55],
  ];
  /** The five factions whose tier lists fed the old blended pool. */
  const LEGACY_POOL_FACTIONS = [
    'goblin_hordes',
    'orc_warbands',
    'dark_legions',
    'void_abyssal',
    'mirror_empires',
  ];
  const MAX_LEAD_TYPES = 5;
  const MAX_ALLY_TYPES = 2;
  const COUNT_MIN = 0.75;
  const COUNT_MAX = 1.35;

  const UNIT_FACTION = {};
  for (const [fid, host] of Object.entries(HOSTS)) {
    if (fid === 'mirror_empires') continue;
    for (const e of host.roster) if (!UNIT_FACTION[e.type]) UNIT_FACTION[e.type] = fid;
    for (const b of host.bosses) UNIT_FACTION[b] = fid;
  }
  // Types no host fields any more keep the faction their tier list gave them.
  for (const f of Object.values(FACTIONS)) {
    for (const tier of f.tiers) {
      for (const u of [...tier.units, ...(tier.elites || [])]) {
        if (!UNIT_FACTION[u]) UNIT_FACTION[u] = f.id;
      }
    }
  }
  const BOSS_FACTION = {};
  for (const [fid, host] of Object.entries(HOSTS))
    for (const b of host.bosses) BOSS_FACTION[b] = fid;

  const BUILDING_FACTION = {
    enemy_trade_outpost: 'goblin_hordes',
    enemy_quarry: 'goblin_hordes',
    enemy_hamlet: 'mirror_empires',
    enemy_merchant_guild: 'mirror_empires',
    enemy_shadow_academy: 'dark_legions',
    enemy_war_academy: 'mirror_empires',
  };

  let announcedTiers = new Set();
  /** Plans by wave number, the leads of the waves already fought, and this run's salt. */
  let plans = {};
  let history = [];
  let runSalt = 0;
  let lastHorde = null;

  function resetRun() {
    announcedTiers = new Set();
    plans = {};
    history = [];
    lastHorde = null;
    // Unseeded runs should not all meet the same factions in the same order.
    runSalt = Math.floor(Math.random() * 0x7fffffff);
  }

  function getEvolutionStageDef(stage) {
    return EVOLUTION_STAGES[stage] || null;
  }

  function getFactionDef(id) {
    return FACTIONS[id] || null;
  }

  function getHost(id) {
    return HOSTS[id] || null;
  }

  function getTactic(id) {
    return TACTICS[id] || null;
  }

  function getFactionTactic(factionId) {
    const host = HOSTS[factionId];
    return host ? TACTICS[host.tactic] : null;
  }

  function getFactionTier(factionId, wave) {
    const f = FACTIONS[factionId];
    if (!f || wave < f.waveMin) return null;
    let tier = f.tiers[0];
    for (const t of f.tiers) {
      if (wave >= t.waveMin) tier = t;
    }
    const stageDef = getEvolutionStageDef(tier.stage);
    return {
      ...tier,
      factionId,
      factionName: f.name,
      shortName: f.shortName,
      color: f.color,
      stageLabel: stageDef?.label || tier.label,
      stageShort: stageDef?.short || `S${tier.stage}`,
    };
  }

  function getActiveFactions(wave) {
    return Object.values(FACTIONS)
      .filter((f) => wave >= f.waveMin)
      .map((f) => ({
        ...f,
        currentTier: getFactionTier(f.id, wave),
      }))
      .filter((f) => f.currentTier);
  }

  function getUnitFaction(type) {
    return UNIT_FACTION[type] || null;
  }

  function getBossFaction(type) {
    return BOSS_FACTION[type] || null;
  }

  function getBuildingFaction(type) {
    return BUILDING_FACTION[type] || null;
  }

  function unitExists(type) {
    return typeof EnemyDefs === 'undefined' || !!EnemyDefs[type];
  }

  // ------------------------------------------------------------------- threat
  /** Rough worth of one body: a goblin is about 0.9, an orc 1.8, a troll 4.5. */
  function unitThreat(type) {
    const d = typeof EnemyDefs !== 'undefined' ? EnemyDefs[type] : null;
    if (!d) return 1;
    let t = ((d.hp || 40) / 40) * 0.6 + ((d.damage || 15) / 15) * 0.4;
    if ((d.range || 0) > 60) t *= 1.15;
    if (d.flying) t *= 1.15;
    return t;
  }

  function meanThreat(types) {
    if (!types || !types.length) return 1;
    let sum = 0;
    for (const t of types) sum += unitThreat(t);
    return sum / types.length;
  }

  /** The pool an ordinary wave drew from before factions led waves (all factions blended). */
  function legacyPool(wave) {
    const cfg = typeof getWaveConfig === 'function' ? getWaveConfig(wave) : null;
    const merged = [...((cfg && cfg.pool) || ['goblin'])];
    const seen = new Set(merged);
    for (const id of LEGACY_POOL_FACTIONS) {
      const tier = getFactionTier(id, wave);
      // Factions that now take the field earlier did not feed the old pool until their first tier.
      if (!tier || wave < tier.waveMin) continue;
      for (const u of [...tier.units, ...(tier.elites || [])]) {
        if (!unitExists(u)) continue;
        if (!seen.has(u)) {
          merged.push(u);
          seen.add(u);
        }
        if (tier.stage >= 2 && wave >= tier.waveMin + 4) merged.push(u);
      }
    }
    return merged;
  }

  /** Mean threat per body of the old blended wave: what a led wave is sized against. */
  function legacyMeanThreat(wave) {
    return meanThreat(legacyPool(wave));
  }

  function legacyHordeMeanThreat(wave) {
    const swarm = meanThreat([
      'goblin',
      'goblin',
      'goblin',
      'plague_rat',
      'plague_rat',
      'orc',
      'orc',
    ]);
    const harass = ['goblin_sapper'];
    if (wave >= 6) harass.push('warg_rider', 'orc_archer', 'harpy');
    if (wave >= 9) harass.push('goblin_burrower');
    return swarm * 0.88 + meanThreat(harass) * 0.12;
  }

  function legacyBossEscortThreat(wave) {
    let sum = 0;
    let n = 0;
    for (const [type, from] of LEGACY_BOSS_ESCORT) {
      if (wave < from || !unitExists(type)) continue;
      sum += unitThreat(type);
      n++;
    }
    return { sum, n };
  }

  // ----------------------------------------------------------------- planning
  function rngFor(seed, wave, tag) {
    let h = (Number(seed) || 0) >>> 0;
    const s = `${wave}:${tag}`;
    for (let i = 0; i < s.length; i++)
      h = (Math.imul(h ^ s.charCodeAt(i), 16777619) + 0x9e3779b9) | 0;
    return WaveCompositionCore.mulberry32(h >>> 0);
  }

  function weightedPick(rows, rng) {
    const total = rows.reduce((a, r) => a + r.w, 0);
    if (!(total > 0)) return rows[0] || null;
    let roll = rng() * total;
    for (const r of rows) {
      roll -= r.w;
      if (roll <= 0) return r;
    }
    return rows[rows.length - 1];
  }

  /** Factions that can lead at this wave: active, and with at least one type to field. */
  function leadCandidates(wave) {
    return Object.keys(HOSTS).filter((id) => {
      const f = FACTIONS[id];
      if (!f || wave < f.waveMin) return false;
      return HOSTS[id].roster.some((e) => wave >= e.from && unitExists(e.type));
    });
  }

  /**
   * How strongly the player's build draws each faction. Reads the per-type weights that
   * ColonyValue.deriveWavePressure and StrategyCounterplay already produce (walls draw
   * siege crews, a ranged line draws flyers and wargs, healers draw assassins) and sums
   * them per faction. Returns { factionId: { pull, why } }.
   */
  function buildDraw(ctx = {}) {
    const out = {};
    const add = (weights, why) => {
      for (const [type, w] of Object.entries(weights || {})) {
        const fid = UNIT_FACTION[type];
        if (!fid || !(w > 1)) continue;
        const row = out[fid] || (out[fid] = { pull: 0, why: '' });
        row.pull += w - 1;
        if (why && !row.why) row.why = why;
      }
    };
    for (const s of ctx.strategies || []) add(s.weights, s.label);
    add(ctx.pressureWeights, '');
    return out;
  }

  /**
   * Decide who leads a wave. Called at nightfall for the next wave, so the night can show
   * it; the result is cached per wave and reused at dawn.
   *   ctx.seed           run seed for this wave (getSpawnFillSeed); ctx.seeded: a Seed Run
   *   ctx.boss           the named boss entry on a boss wave ({ type, ... })
   *   ctx.horde          true on a horde wave
   *   ctx.revenge        faction id that is owed a revenge wave (FactionReputation)
   *   ctx.barred         faction ids that will not lead (their avenger was just killed)
   *   ctx.strategies / ctx.pressureWeights   what the player has built (see buildDraw)
   */
  function planWave(wave, ctx = {}) {
    // A Seed Run must give the same factions every time; any other run gets its own salt.
    const seed = ((Number(ctx.seed) || 0) ^ (ctx.seeded ? 0 : runSalt)) >>> 0;
    const rng = rngFor(seed, wave, 'plan');
    const active = leadCandidates(wave);
    const plan = {
      wave,
      seed,
      kind: 'ordinary',
      leadId: 'goblin_hordes',
      allyId: null,
      allyShare: 0,
      tacticId: 'swarm',
      drawnBy: '',
      bossType: null,
      horde: null,
      revenge: null,
    };
    if (!active.length) return plan;

    if (ctx.boss && ctx.boss.type) {
      plan.kind = 'boss';
      plan.bossType = ctx.boss.type;
      const fid = BOSS_FACTION[ctx.boss.type];
      plan.leadId = fid && active.includes(fid) ? fid : active[active.length - 1];
      plan.tacticId = HOSTS[plan.leadId].tactic;
      return plan;
    }

    if (ctx.horde) {
      const open = HORDES.filter(
        (h) =>
          wave >= (h.from || 1) &&
          wave >= (FACTIONS[h.faction]?.waveMin || 1) &&
          (h.needs || []).every(unitExists)
      );
      const rows = open.map((h) => ({ h, w: lastHorde === h.id ? 0.15 : 1 }));
      const pick = (weightedPick(rows, rng) || { h: HORDES[0] }).h;
      plan.kind = 'horde';
      plan.horde = pick.id;
      plan.leadId = pick.faction;
      plan.tacticId = `horde:${pick.id}`;
      return plan;
    }

    // Waves 1-3 are the hand-written opening: goblins lead, whatever the template adds.
    if (wave < 4) return plan;

    const draw = buildDraw(ctx);
    const barred = new Set(ctx.barred || []);
    const last = history.length ? history[history.length - 1].leadId : null;
    const prev = history.length > 1 ? history[history.length - 2].leadId : null;
    let rows = active
      .filter((id) => !barred.has(id) || active.length === 1)
      .map((id) => {
        let w = HOSTS[id].band(wave);
        if (id === last) w *= 0.12;
        else if (id === prev) w *= 0.5;
        const pull = Math.min(1.5, (draw[id]?.pull || 0) * 0.35);
        w *= 1 + pull;
        return { id, w, pull };
      });
    if (!rows.length) rows = active.map((id) => ({ id, w: 1, pull: 0 }));
    let lead = weightedPick(rows, rng);
    if (ctx.revenge && active.includes(ctx.revenge)) {
      lead = rows.find((r) => r.id === ctx.revenge) || { id: ctx.revenge, w: 1, pull: 0 };
      const host = HOSTS[ctx.revenge];
      const type = host.champions.find((t) => {
        const e = host.roster.find((r) => r.type === t);
        return unitExists(t) && (!e || wave >= e.from);
      });
      if (type) {
        plan.revenge = {
          type,
          name: host.names[Math.floor(rng() * host.names.length)] || 'The Avenger',
        };
      }
    }
    plan.leadId = lead.id;
    plan.tacticId = HOSTS[lead.id].tactic;
    if (!plan.revenge && lead.pull >= 0.35 && draw[lead.id]?.why) plan.drawnBy = draw[lead.id].why;

    // At most one ally, and not every day.
    const allies = rows.filter(
      (r) =>
        r.id !== lead.id &&
        r.id !== 'mirror_empires' &&
        HOSTS[r.id].roster.some((e) => e.aux && wave >= e.from && unitExists(e.type))
    );
    const leadTypes = HOSTS[lead.id].roster.filter((e) => wave >= e.from && unitExists(e.type));
    const thin = leadTypes.length < 3;
    if (allies.length && (thin || rng() < 0.6)) {
      plan.allyId = weightedPick(allies, rng).id;
      plan.allyShare = 0.2 + Math.floor(rng() * 3) * 0.05;
    }
    return plan;
  }

  /** Tomorrow's plan, made once and kept until its wave is fought. */
  function planFor(wave, ctx) {
    if (!plans[wave]) plans[wave] = planWave(wave, ctx || {});
    return plans[wave];
  }

  function getPlan(wave) {
    return plans[wave] || null;
  }

  /** Drop a cached plan (the wave is being re-planned: a restart, a forced horde). */
  function forgetPlan(wave) {
    delete plans[wave];
  }

  /** The wave is being fought: its lead goes into the rotation history. */
  function commitPlan(plan) {
    if (!plan) return;
    if (history.length && history[history.length - 1].wave === plan.wave) return;
    history.push({ wave: plan.wave, leadId: plan.leadId });
    if (plan.horde) lastHorde = plan.horde;
    if (history.length > 12) history.shift();
    for (const w of Object.keys(plans)) if (Number(w) < plan.wave - 2) delete plans[w];
  }

  // -------------------------------------------------------------- composition
  function hordeDef(id) {
    return HORDES.find((h) => h.id === id) || null;
  }

  /** The tactic a plan plays: the lead's own, or the horde flavour's keys over a bare base. */
  function tacticForPlan(plan) {
    if (!plan) return null;
    if (plan.kind === 'horde') {
      const h = hordeDef(plan.horde);
      if (!h) return null;
      return {
        id: `horde:${h.id}`,
        name: h.label,
        desc: h.tagline,
        counter: h.counter,
        sign: h.tagline,
        silhouette: 'a flood, far more bodies than usual',
        ...h.tactic,
      };
    }
    return TACTICS[plan.tacticId] || getFactionTactic(plan.leadId);
  }

  function pickLeadEntries(plan, wave, params, rng) {
    const host = HOSTS[plan.leadId];
    const noElites = !!params.noElites;
    let avail = host.roster.filter(
      (e) => wave >= e.from && unitExists(e.type) && !(noElites && e.heavy && !e.core)
    );
    if (!avail.length) avail = [{ type: 'goblin', from: 1, w: 1, core: true }];
    const must = avail.filter((e) => e.core || e.key);
    const rest = avail
      .filter((e) => !(e.core || e.key))
      .map((e) => ({ e, r: rng() * e.w }))
      .sort((a, b) => b.r - a.r)
      .map((x) => x.e);
    const chosen = must.slice(0, MAX_LEAD_TYPES);
    for (const e of rest) {
      if (chosen.length >= MAX_LEAD_TYPES) break;
      chosen.push(e);
    }
    return chosen;
  }

  /** Mirror Doctrine: field what StrategyCounterplay says beats the player's army. */
  function mirrorEntries(params, base) {
    const tally = {};
    for (const s of params.strategies || []) {
      for (const [type, w] of Object.entries(s.weights || {})) {
        if (unitExists(type)) tally[type] = Math.max(tally[type] || 0, w);
      }
    }
    const picks = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, w]) => ({ type, w: w * 2, key: true }));
    if (!picks.length) return base;
    const keep = base.filter((e) => e.core && !picks.some((p) => p.type === e.type)).slice(0, 2);
    return picks.concat(keep);
  }

  function weightedMean(entries) {
    let sum = 0;
    let w = 0;
    for (const e of entries) {
      sum += unitThreat(e.type) * e.w;
      w += e.w;
    }
    return w > 0 ? sum / w : 1;
  }

  /**
   * Turn a plan into a spawn queue.
   *   params.count        bodies the wave would have had (difficulty, colony, spy mods applied)
   *   params.noElites     Assassinate was used: no heavy types, no escort
   *   params.typeWeights  per-type multipliers (difficulty presets)
   *   params.eliteSlots   extra elite pressure (colony value, host threat): raises the target threat
   *   params.strategies   active StrategyCounterplay strategies (Mirror Doctrine)
   *   params.packMinions  boss wave: the boss's own guard, placed right behind him
   *   params.template     waves 1-3: the hand-written pool
   * @returns {{queue, counts, count, leadCount, allyCount, leadShare, typeCount, leadTypes,
   *            allyTypes, threat, targetThreat, countMult}}
   */
  function composeWave(plan, params = {}) {
    const wave = plan.wave;
    const rng = rngFor(plan.seed, wave, 'compose');
    const baseCount = Math.max(1, params.count | 0);
    const tw = params.typeWeights || {};
    const tactic = tacticForPlan(plan) || {};
    let lead;
    let ally = [];
    let allyShare = 0;
    let target;
    let maxAllyShare = 0.4;
    const head = [];

    if (plan.kind === 'horde') {
      const h = hordeDef(plan.horde) || HORDES[0];
      lead = h.mix
        .filter((e) => wave >= (e.from || 1) && unitExists(e.type))
        .map((e) => ({ ...e }));
      if (!lead.length) lead = [{ type: 'goblin', w: 1 }];
      target = legacyHordeMeanThreat(wave);
    } else if (wave < 4 && Array.isArray(params.template) && params.template.length) {
      const tally = {};
      for (const t of params.template) if (unitExists(t)) tally[t] = (tally[t] || 0) + 1;
      const rows = Object.entries(tally).map(([type, w]) => ({ type, w }));
      lead = rows.filter((e) => UNIT_FACTION[e.type] === plan.leadId);
      ally = rows.filter((e) => UNIT_FACTION[e.type] !== plan.leadId);
      if (!lead.length) {
        lead = rows;
        ally = [];
      }
      const aw = ally.reduce((a, e) => a + e.w, 0);
      const lw = lead.reduce((a, e) => a + e.w, 0);
      allyShare = aw / Math.max(1, aw + lw);
      maxAllyShare = 0.75;
      target = 0; // the opening keeps its hand-set head count
    } else {
      lead = pickLeadEntries(plan, wave, params, rng).map((e) => ({ ...e }));
      if (tactic.mirror) lead = mirrorEntries(params, lead);
      if (plan.allyId && HOSTS[plan.allyId]) {
        ally = HOSTS[plan.allyId].roster
          .filter((e) => e.aux && wave >= e.from && unitExists(e.type))
          .filter((e) => !lead.some((l) => l.type === e.type))
          .slice(0, MAX_ALLY_TYPES)
          .map((e) => ({ ...e }));
        allyShare = ally.length ? plan.allyShare || 0.25 : 0;
      }
      target = legacyMeanThreat(wave) * (1 + 0.03 * Math.min(8, params.eliteSlots | 0));
      if (plan.kind === 'boss') {
        // The old escort was a fixed list of elites plus ordinary fill; match its weight.
        const esc = params.noElites ? { sum: 0, n: 0 } : legacyBossEscortThreat(wave);
        const fill = Math.max(0, baseCount - 1 - esc.n);
        target = (esc.sum + fill * target) / Math.max(1, esc.n + fill);
        if (plan.bossType && unitExists(plan.bossType)) head.push(plan.bossType);
        if (!params.noElites) {
          for (const m of params.packMinions || []) if (unitExists(m)) head.push(m);
        }
        ally = [];
        allyShare = 0;
      } else if (plan.revenge && unitExists(plan.revenge.type) && !params.noElites) {
        head.push(plan.revenge.type);
      }
    }
    for (const e of lead) e.w *= tw[e.type] > 0 ? Math.min(3, tw[e.type]) : 1;

    // Lean on the heavy or the light end of the roster until the host's mean threat is near
    // the old wave's, then let the head count take up what is left.
    let countMult = 1;
    if (target > 0) {
      const mult = tactic.threat || 1;
      for (let i = 0; i < 4; i++) {
        const raw = weightedMean(lead);
        const mean = (raw * (1 - allyShare) + weightedMean(ally) * allyShare) * mult;
        const low = mean < target * 0.92;
        if (!low && mean <= target * 1.08) break;
        let moved = false;
        for (const e of lead) {
          const t = unitThreat(e.type);
          if (low ? t > raw * 1.05 : t < raw * 0.95) {
            e.w *= 1.5;
            moved = true;
          }
        }
        if (!moved) break;
      }
      const mean = (weightedMean(lead) * (1 - allyShare) + weightedMean(ally) * allyShare) * mult;
      countMult = Math.max(COUNT_MIN, Math.min(COUNT_MAX, target / Math.max(0.2, mean)));
    }
    const count = Math.max(1, Math.round(baseCount * countMult));
    const front = lead.filter((e) => e.front).map((e) => e.type);
    const rear = lead.filter((e) => e.rear).map((e) => e.type);
    const built = WaveCompositionCore.composeHost({
      count,
      rng,
      lead,
      ally,
      allyShare,
      maxAllyShare,
      head,
      front,
      rear,
      allySquad: Math.max(2, (tactic.squad && tactic.squad.size) || 4),
    });
    const leadTypes = [...new Set(head.concat(lead.map((e) => e.type)))].filter(
      (t) => built.counts[t] > 0
    );
    const allyTypes = ally.map((e) => e.type).filter((t) => built.counts[t] > 0);
    return {
      queue: built.queue,
      counts: built.counts,
      count: built.queue.length,
      baseCount,
      countMult,
      leadCount: built.leadCount,
      allyCount: built.allyCount,
      leadShare: built.queue.length ? built.leadCount / built.queue.length : 1,
      typeCount: Object.keys(built.counts).length,
      leadTypes,
      allyTypes,
      threat: meanThreat(built.queue) * built.queue.length * (tactic.threat || 1),
      targetThreat: (target || meanThreat(built.queue)) * baseCount,
    };
  }

  // ------------------------------------------------------------------ preview
  /**
   * What the night shows about tomorrow. Unscouted: the faction and its crest, a silhouette
   * and "about N". Scouted (a Watchtower stands, or a Scout Report was bought): the tactic
   * by name, its counter, and an exact head count by type.
   */
  function describeHost(plan, comp, scouted) {
    if (!plan) return null;
    const f = FACTIONS[plan.leadId] || {};
    const ally = plan.allyId ? FACTIONS[plan.allyId] : null;
    const tactic = tacticForPlan(plan) || {};
    const count = comp ? comp.count : 0;
    const makeup = comp
      ? Object.entries(comp.counts)
          .map(([type, n]) => ({
            type,
            n,
            name: (typeof EnemyDefs !== 'undefined' && EnemyDefs[type]?.name) || type,
          }))
          .sort((a, b) => b.n - a.n)
      : [];
    const round = count < 10 ? count : Math.round(count / 5) * 5;
    return {
      wave: plan.wave,
      kind: plan.kind,
      factionId: plan.leadId,
      factionName: f.name || plan.leadId,
      shortName: f.shortName || plan.leadId,
      crest: f.color || '#c0c0c0',
      allyName: ally && comp && comp.allyCount > 0 ? ally.name : '',
      allyCrest: ally ? ally.color : '',
      scouted: !!scouted,
      count,
      countText: scouted ? `${count}` : `about ${round}`,
      silhouette: tactic.silhouette || '',
      tacticName: scouted ? tactic.name || '' : '',
      tacticDesc: scouted ? tactic.desc || '' : '',
      counter: tactic.counter || '',
      makeup: scouted ? makeup : [],
      horde: plan.kind === 'horde' ? (hordeDef(plan.horde) || {}).label || 'Horde' : '',
      bossType: plan.bossType || null,
      revenge: plan.revenge ? { ...plan.revenge } : null,
      drawnBy: plan.drawnBy || '',
    };
  }

  /** One line for the HUD chip and the wave banner. */
  function formatHostLine(d) {
    if (!d) return '';
    const parts = [];
    let who = `${d.factionName} lead`;
    if (d.kind === 'boss') who = `${d.factionName} — boss wave`;
    else if (d.kind === 'horde') who = `${d.horde} (${d.factionName} horde)`;
    else if (d.revenge) who = `${d.factionName} come for revenge under ${d.revenge.name}`;
    parts.push(who);
    if (d.allyName) parts.push(`${d.allyName} in support`);
    parts.push(`${d.countText} foes`);
    if (d.scouted) {
      if (d.tacticName) parts.push(`Tactic: ${d.tacticName}`);
      if (d.makeup.length) parts.push(d.makeup.map((m) => `${m.n} ${m.name}`).join(', '));
    } else if (d.silhouette) parts.push(`Unscouted: ${d.silhouette}`);
    if (d.counter) parts.push(`Counter: ${d.counter}`);
    return parts.join(' · ');
  }

  // -------------------------------------------------------- older entry points
  /** Kept for callers outside the wave builder; the pool is no longer blended by faction. */
  function enrichPool(pool) {
    return [...(pool || [])];
  }

  function mergeFactionWeights(_wave, baseWeights = {}) {
    return { ...baseWeights };
  }

  function biasSpawnQueue(queue) {
    return queue;
  }

  function biasHordeQueue(queue) {
    return queue;
  }

  /** Named bosses come on their own wave only; nothing is injected into ordinary waves. */
  function injectSubBosses(queue) {
    return queue;
  }

  function countFactionBuildings(buildings, factionId) {
    if (!buildings) return 0;
    let n = 0;
    for (const b of buildings) {
      if (!b || b.owner !== 'enemy' || b.hp <= 0) continue;
      if ((b.enemyFaction || getBuildingFaction(b.type)) === factionId) n++;
      else if (
        !b.enemyFaction &&
        factionId === 'mirror_empires' &&
        (b.isHamlet || b.isMerchantGuild) &&
        b.owner === 'enemy'
      )
        n++;
    }
    return n;
  }

  function computeHostKingdomMeter(buildings, wave) {
    const active = getActiveFactions(wave);
    const breakdown = {};
    let total = 0;
    for (const f of active) {
      const count = countFactionBuildings(buildings, f.id);
      const stage = f.currentTier?.stage || 1;
      const score = count * (10 + stage * 10);
      breakdown[f.id] = { count, score, tier: f.currentTier };
      total += score;
    }
    return { total, breakdown, activeFactions: active };
  }

  function formatFactionRoster(queue) {
    if (!queue?.length) return '';
    const counts = {};
    for (const t of queue) {
      const fid = getUnitFaction(t);
      if (!fid) continue;
      counts[fid] = (counts[fid] || 0) + 1;
    }
    const parts = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, n]) => {
        const f = FACTIONS[id];
        return `${f?.shortName || id}×${n}`;
      });
    return parts.length ? `Host: ${parts.join(' · ')}` : '';
  }

  function formatActiveFactions(wave) {
    return getActiveFactions(wave)
      .map((f) => f.shortName)
      .join(' · ');
  }

  function getSettlementRaidChance(wave, factionId, baseChance = 0.35) {
    const tier = factionId ? getFactionTier(factionId, wave) : null;
    if (tier) {
      if (tier.stage >= 4) return 0.8;
      if (tier.stage >= 3) return 0.55;
      if (tier.stage >= 2) return 0.44;
      return baseChance;
    }
    const stage4 = getActiveFactions(wave).filter((f) => f.currentTier.stage >= 4);
    if (!stage4.length) return baseChance;
    return Math.min(0.85, baseChance + stage4.length * 0.1);
  }

  function processCounterRaids(wave, ctx = {}) {
    const {
      buildings,
      spawnFn,
      showMessage,
      floatingText,
      worldW,
      worldH,
      rng = Math.random,
      applyScaling,
      frontPlan,
    } = ctx;
    if (!spawnFn || !buildings?.length) return [];
    const hasTargets = buildings.some(
      (b) =>
        b.owner === 'player' &&
        b.complete &&
        b.hp > 0 &&
        (b.isHamlet || b.isMerchantGuild || b.type === 'outpost' || b.type === 'wall')
    );
    if (!hasTargets) return [];

    const spawned = [];
    for (const f of getActiveFactions(wave)) {
      const tier = f.currentTier;
      if (!tier.counterRaids) continue;
      const interval = tier.counterRaidInterval || 12;
      if (wave % interval !== 0) continue;

      const plan =
        frontPlan ||
        (typeof MultiFrontSiege !== 'undefined' ? MultiFrontSiege.getCurrentPlan() : null);
      const target =
        typeof MultiFrontSiege !== 'undefined'
          ? MultiFrontSiege.pickCounterRaidTarget(f.id, buildings, plan)
          : null;
      const fallbackSettlements = buildings.filter(
        (b) => b.owner === 'player' && b.complete && b.hp > 0 && (b.isHamlet || b.isMerchantGuild)
      );
      const resolvedTarget =
        target || fallbackSettlements[Math.floor(rng() * fallbackSettlements.length)];
      if (!resolvedTarget) continue;

      const raidPool = (tier.elites?.length ? tier.elites : tier.units).filter(unitExists);
      if (!raidPool.length) continue;
      const count = Math.min(raidPool.length, 2 + tier.stage);

      let sx;
      let sy;
      let spawnSide = 'south';
      if (typeof MultiFrontSiege !== 'undefined') {
        const spawn = MultiFrontSiege.resolveCounterRaidSpawn(f.id, resolvedTarget, {
          worldW,
          worldH,
          rng,
        });
        sx = spawn.x;
        sy = spawn.y;
        spawnSide = spawn.side;
      } else {
        const angle = rng() * Math.PI * 2;
        const dist = 160 + rng() * 140;
        sx = Math.max(
          40,
          Math.min((worldW || 800) - 40, resolvedTarget.x + Math.cos(angle) * dist)
        );
        sy = Math.max(
          36,
          Math.min((worldH || 600) * 0.55, resolvedTarget.y + Math.sin(angle) * dist * 0.35)
        );
      }

      for (let i = 0; i < count; i++) {
        const type = raidPool[Math.floor(rng() * raidPool.length)];
        const u = spawnFn(type, sx + i * 26 - count * 13, sy, {
          spawnSide,
          isCounterRaid: true,
          raidTargetId: resolvedTarget.id,
          enemyFaction: f.id,
        });
        if (!u) continue;
        applyScaling?.(u);
        u.huntMode = true;
        spawned.push(u);
      }
      const targetName = resolvedTarget.isHamlet
        ? 'hamlet'
        : resolvedTarget.isMerchantGuild
          ? 'guild'
          : resolvedTarget.type === 'outpost'
            ? 'outpost'
            : 'hold';
      const frontNote =
        typeof MultiFrontSiege !== 'undefined'
          ? MultiFrontSiege.FRONT_LABELS?.[spawnSide] || spawnSide
          : null;
      const raidVerb =
        spawnSide === 'north' ? 'sieges' : spawnSide === 'south' ? 'raids' : 'strikes';
      showMessage?.(
        frontNote
          ? `${f.shortName} ${raidVerb} your ${targetName} from the ${frontNote}!`
          : `${f.name} counter-raid — ${count} hostiles strike your ${targetName}!`,
        360
      );
      floatingText?.(
        resolvedTarget.x,
        resolvedTarget.y - 28,
        `${f.shortName.toUpperCase()} RAID`,
        f.color
      );
    }
    return spawned;
  }

  /** A faction's first day on the field is announced once, with what it does. */
  function checkTierAnnouncements(wave, hooks = {}) {
    const { showMessage, addHighlight, floatingText, worldW } = hooks;
    for (const f of getActiveFactions(wave)) {
      const key = `${f.id}:debut`;
      if (announcedTiers.has(key)) continue;
      announcedTiers.add(key);
      if (wave <= 1 && f.id === 'goblin_hordes') continue;
      const tactic = getFactionTactic(f.id);
      addHighlight?.('host', `${f.name} take the field`);
      showMessage?.(
        `${f.name} have joined the war${tactic ? ` — ${tactic.name}: ${tactic.sign}` : '.'}`,
        400
      );
      floatingText?.(worldW / 2, 72, f.name.toUpperCase(), f.color);
    }
  }

  function formatUnitName(type) {
    if (typeof EnemyDefs !== 'undefined' && EnemyDefs[type]?.name) return EnemyDefs[type].name;
    if (typeof MonsterBosses !== 'undefined' && MonsterBosses.BOSS_ROSTER) {
      const boss = MonsterBosses.BOSS_ROSTER.find((b) => b.type === type);
      if (boss) return boss.name;
    }
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatUnitList(types) {
    if (!types?.length) return '—';
    return types.map(formatUnitName).join(', ');
  }

  function rosterLine(host) {
    return host.roster
      .filter((e) => unitExists(e.type))
      .map((e) => `${formatUnitName(e.type)}${e.from > 1 ? ` (wave ${e.from}+)` : ''}`)
      .join(', ');
  }

  function formatFactionBody(f) {
    const host = HOSTS[f.id];
    const tactic = TACTICS[host.tactic];
    return [
      `${f.name} can lead a wave from wave ${f.waveMin}. When they lead they are about three quarters of the host, with at most one other faction in support.`,
      '',
      `Tactic — ${tactic.name}: ${tactic.desc}`,
      `Counter: ${tactic.counter}`,
      `On the field: ${tactic.sign}`,
      '',
      `They field: ${rosterLine(host)}.`,
      host.bosses.length
        ? `Bosses: ${formatUnitList(host.bosses)}. A boss wave is led by the boss's own faction and plays its tactic.`
        : 'No boss of their own.',
    ].join('\n');
  }

  function getEncyclopediaEntries() {
    const factionList = Object.values(FACTIONS)
      .map((f) => `${f.name} (wave ${f.waveMin}+)`)
      .join(' · ');
    const entries = [
      {
        cat: 'enemies',
        name: 'Enemy Factions',
        body: [
          'One faction leads each wave. It is chosen at nightfall and named in the night preview with its crest colour. The leader is about three quarters of the host; at most one ally marches in support, in its own squads. A wave holds four to seven kinds of enemy.',
          '',
          'Every faction has one tactic that changes how its waves behave, and one clear answer to it. The preview always gives the answer; a Watchtower or a Scout Report also names the tactic and gives an exact head count.',
          '',
          `Factions: ${factionList}`,
          '',
          'Who leads rotates: the faction that led yesterday rarely leads today. What you build draws them too. Walls draw siege crews, a line of archers and mages draws flyers and wargs, healers draw assassins.',
          '',
          'Every tenth wave is a boss wave: the boss, his guard and a host of his own faction. Every fifth wave that is not a boss wave is a horde.',
        ].join('\n'),
      },
      {
        cat: 'enemies',
        name: 'Horde Flavours',
        body: [
          'A horde is more bodies, weaker each, arriving faster. Each flavour is a different host that plays differently:',
          '',
          ...HORDES.map((h) => `${h.label} — ${h.tagline} Counter: ${h.counter}`),
        ].join('\n'),
        campaignWave: 5,
      },
      {
        cat: 'enemies',
        name: 'Grudges and Revenge Waves',
        body: [
          'Each faction keeps a grudge that rises with every one of its soldiers you kill. The Faction Intel panel shows it as a bar.',
          '',
          'When a grudge is full, that faction leads the next ordinary wave as a revenge wave under a named avenger: one tougher champion, marked with the faction crest. The night preview says so.',
          '',
          'Kill the avenger and the grudge is settled: that faction will not lead for the next three waves. A Truce message halves the highest grudge.',
        ].join('\n'),
        campaignWave: 6,
      },
    ];
    for (const f of Object.values(FACTIONS)) {
      if (!HOSTS[f.id]) continue;
      entries.push({
        cat: 'enemies',
        name: `${f.name} — ${TACTICS[HOSTS[f.id].tactic].name}`,
        body: formatFactionBody(f),
        campaignWave: f.waveMin,
      });
    }
    return entries;
  }

  function getStateSnapshot(wave, buildings, spawnQueue) {
    const active = getActiveFactions(wave);
    const hostKingdom = computeHostKingdomMeter(buildings, wave);
    const raidingFactions = active
      .filter((f) => f.currentTier.counterRaids)
      .map((f) => f.shortName);
    const today = plans[wave] || null;
    const tomorrow = plans[wave + 1] || null;
    return {
      evolutionStages: EVOLUTION_STAGES,
      activeFactions: active.map((f) => {
        const rep =
          typeof FactionReputation !== 'undefined'
            ? FactionReputation.getFactionModifiers(f.id, wave)
            : null;
        const tactic = getFactionTactic(f.id);
        return {
          id: f.id,
          name: f.name,
          shortName: f.shortName,
          color: f.color,
          tier: f.currentTier.tier,
          stage: f.currentTier.stage,
          tierLabel: f.currentTier.stageLabel || f.currentTier.label,
          tagline: f.currentTier.tagline,
          tacticName: tactic?.name || '',
          tacticDesc: tactic?.desc || '',
          counter: tactic?.counter || '',
          leadsToday: today?.leadId === f.id,
          leadsTomorrow: tomorrow?.leadId === f.id,
          buildingCount: hostKingdom.breakdown[f.id]?.count || 0,
          counterRaids: !!f.currentTier.counterRaids,
          hostility: rep?.hostility,
          stanceLabel: rep?.stanceLabel,
          stanceColor: rep?.stanceColor,
          evolutionOffset: 0,
          economicFocus: false,
        };
      }),
      hostKingdomTotal: hostKingdom.total,
      counterRaidFactions: raidingFactions,
      rosterIntel: formatFactionRoster(spawnQueue),
      activeSummary: formatActiveFactions(wave),
      leadToday: today ? { ...today } : null,
      leadTomorrow: tomorrow ? { ...tomorrow } : null,
    };
  }

  return {
    FACTIONS,
    EVOLUTION_STAGES,
    TACTICS,
    HOSTS,
    HORDES,
    resetRun,
    getFactionDef,
    getHost,
    getTactic,
    getFactionTactic,
    getFactionTier,
    getActiveFactions,
    getUnitFaction,
    getBossFaction,
    getBuildingFaction,
    unitThreat,
    legacyMeanThreat,
    leadCandidates,
    planWave,
    planFor,
    getPlan,
    forgetPlan,
    commitPlan,
    tacticForPlan,
    composeWave,
    describeHost,
    formatHostLine,
    enrichPool,
    mergeFactionWeights,
    biasSpawnQueue,
    biasHordeQueue,
    injectSubBosses,
    countFactionBuildings,
    formatFactionRoster,
    formatActiveFactions,
    getSettlementRaidChance,
    processCounterRaids,
    checkTierAnnouncements,
    getStateSnapshot,
    getEncyclopediaEntries,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.EnemyFactions = EnemyFactions;
