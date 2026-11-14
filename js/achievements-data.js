/**
 * Achievement list, built around the siege as it plays now.
 *
 * Every entry is a counter and a goal: { s: scope, k: counter, n: goal }.
 *   scope 'r' = this run, 'l' = lifetime (kept in the save), 'x' = a legacy rule string
 *   that js/achievements.js evaluates (the order trials, which also unlock an order).
 * Entries that share a `ladder` are the bronze / silver / gold steps of one achievement
 * and are drawn as one card.
 *
 * Names of troops, bosses, enemy factions, allied orders, difficulties and modes are
 * never written here. Text uses {kind:id} tokens that js/achievements.js fills in from
 * the game data when it draws, so a rename in data/*.json shows up by itself.
 *
 * Rewards are cosmetic only (a title, a skin, a victory theme). Nothing here gives TP,
 * damage or any other power; the between-run bonuses are the ribbons' business.
 */
const ACHIEVEMENT_TIERS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

/** Families, in the order the panel shows them. */
const ACHIEVEMENT_FAMILIES = [
  { id: 'line', name: 'The Line', blurb: 'Breaches kept out, and the nights you nearly lost.' },
  { id: 'runners', name: 'Line-Breakers', blurb: 'The ones who run past your troops.' },
  { id: 'veterans', name: 'Veterans', blurb: 'Soldiers kept alive, and what they did with it.' },
  { id: 'troops', name: 'Troops', blurb: 'Each kind of soldier, used for what it is good at.' },
  { id: 'orders', name: 'Orders', blurb: 'Hold, the General, the early horn, spies and strikes.' },
  { id: 'works', name: 'Works and Research', blurb: 'What you built and what you learned.' },
  { id: 'medic', name: 'Medical Tent', blurb: 'The wounded carried off the field alive.' },
  { id: 'spoils', name: 'Spoils of War', blurb: 'Rewards claimed every fifth wave.' },
  { id: 'crates', name: 'Supply Crates', blurb: 'Dropped on the field. Some are bait.' },
  {
    id: 'camps',
    name: 'War Camps',
    blurb: 'Enemy camps at the top edge, burned before they feed a wave.',
  },
  { id: 'foes', name: 'Foes and Warlords', blurb: 'Every host beaten and every warlord slain.' },
  { id: 'trials', name: 'Difficulty and Modes', blurb: 'The same siege, made harder.' },
  { id: 'campaign', name: 'Campaign', blurb: 'Waves, kills and score.' },
  {
    id: 'allies',
    name: 'Allied Orders',
    blurb: 'The orders that march with you, and how you earned them.',
  },
  { id: 'secret', name: 'Secrets', blurb: 'Shown once earned.' },
];

/** The allied hero groups. Display names come from the game data, never from here. */
const CROSSOVER_ACH_FACTIONS = [
  { key: 'wwe', build: 'wwe_academy' },
  { key: 'doom', build: null },
  { key: 'ultimis', build: 'element_barracks' },
  { key: 'primis', build: 'primis_shrine' },
  { key: 'halo', build: 'spartan_academy' },
  { key: 'gears', build: 'cog_academy' },
  { key: 'lotr', build: 'rivendell_camp' },
  { key: 'baki', build: 'hanma_dojo' },
  { key: 'jojo', build: 'stand_arrow_shrine' },
  { key: 'fotns', build: 'north_star_dojo' },
  { key: 'dragonball', build: 'capsule_corp' },
  { key: 'imperium', build: 'astartes_chapel' },
  { key: 'crystal', build: 'crystal_sanctum' },
  { key: 'warp', build: 'warp_shrine' },
  { key: 'tes', build: 'dragon_moot' },
];

/** Mastery points for the two steps of an order's ladder (FactionDepth tiers 2 and 4). */
const ACHIEVEMENT_MASTERY_STEPS = [150, 500];

/** Orders whose top mastery step unlocks a unit skin (js/cosmetics.js). */
const ACHIEVEMENT_MASTERY_SKINS = {
  wwe: 'ring_champion',
  doom: 'hell_walker',
  crystal: 'crystal_vanguard',
  warp: 'warp_legion',
  imperium: 'imperium_herald',
};

const ACHIEVEMENT_ENEMY_FACTIONS = [
  'goblin_hordes',
  'orc_warbands',
  'dark_legions',
  'void_abyssal',
  'mirror_empires',
];

const ACHIEVEMENT_BOSSES = [
  'boss_gorath',
  'boss_morwen',
  'boss_thokk',
  'boss_grimm',
  'boss_vexis',
  'boss_karg',
  'boss_sylvara',
  'boss_rotfather',
  'boss_volk',
  'boss_malachar',
];

const ACHIEVEMENT_DIFFICULTIES = ['baby', 'normal', 'chad', 'doomslayer'];

/** Troop types whose kills are counted one by one. */
const ACHIEVEMENT_TROOPS = [
  'footman',
  'archer',
  'crossbowman',
  'mage',
  'cavalry',
  'knight',
  'pikeman',
  'scout',
  'ballista',
  'sapper',
];

/**
 * What each troop is for. A kill counts toward `sig.<troop>` when the victim is one of
 * these types (or, for `runner` / `charge` / `blast`, when the kill was made that way).
 */
const ACHIEVEMENT_SIGNATURES = {
  footman: { types: ['berserker'] },
  archer: { types: ['goblin', 'plague_rat', 'goblin_sapper'] },
  crossbowman: { types: ['dark_knight', 'iron_colossus', 'cinderbound_juggernaut', 'troll'] },
  mage: { types: ['dark_knight', 'troll', 'iron_colossus', 'abomination'] },
  cavalry: { charge: true },
  knight: { types: ['orc_archer', 'dark_mage', 'necromancer', 'shaman', 'bone_summoner'] },
  pikeman: { types: ['warg_rider'] },
  scout: { runner: true },
  ballista: { types: ['troll', 'siege_tower', 'iron_colossus', 'behemoth', 'abomination'] },
};

function buildAchievementList() {
  const list = [];
  const TIER3 = ['bronze', 'silver', 'gold'];
  const TIER2 = ['silver', 'gold'];

  /** One achievement. */
  function one(family, id, name, desc, s, k, n, opts = {}) {
    list.push({
      id,
      family,
      name,
      desc,
      s,
      k,
      n,
      tier: opts.tier || null,
      hidden: !!opts.hidden,
      reward: opts.reward || null,
      ladder: opts.ladder || null,
      long: s === 'l' && n > 1 && !opts.quick,
      rule: s === 'x' ? k : `${s}:${k}>=${n}`,
    });
  }

  /** Bronze / silver / gold steps of one achievement. `desc` gets the goal. */
  function steps(family, base, names, desc, s, k, goals, opts = {}) {
    const tiers = goals.length === 2 ? TIER2 : TIER3;
    goals.forEach((n, i) => {
      one(family, `${base}_${i + 1}`, names[i], desc(n), s, k, n, {
        tier: tiers[i],
        ladder: base,
        hidden: opts.hidden,
        quick: opts.quick,
        reward: i === goals.length - 1 ? opts.reward : null,
      });
    });
  }

  const title = (label) => ({ type: 'title', label });
  const skin = (id) => ({ type: 'skin', id });
  const theme = (id) => ({ type: 'theme', id });

  // ------------------------------------------------------------------ the line
  steps(
    'line',
    'line_streak',
    ['Shut Gate', 'Nothing Gets Through', 'The Wall That Walks'],
    (n) => `Clear ${n} waves in a row without a breach, in one run.`,
    'r',
    'cleanStreak',
    [5, 15, 25],
    { reward: skin('ash_and_bone') }
  );
  steps(
    'line',
    'line_clean',
    ['Quiet Nights', 'A Hundred Quiet Nights', 'The Realm Sleeps'],
    (n) => `Clear ${n} waves without a breach, across all runs.`,
    'l',
    'cleanWaves',
    [25, 100, 400],
    { reward: title('Warden of the Line') }
  );
  steps(
    'line',
    'line_brink',
    ['One More and We Fall', 'Used to the Edge', 'Lives on the Edge'],
    (n) =>
      n === 1
        ? 'Clear a wave with the realm one breach from falling.'
        : `Clear ${n} waves with the realm one breach from falling, across all runs.`,
    'l',
    'brinkClears',
    [1, 5, 20]
  );
  one(
    'line',
    'line_brink_streak',
    'Three Nights on the Brink',
    'Clear 3 waves in a row with the realm one breach from falling.',
    'r',
    'brinkStreak',
    3,
    { tier: 'gold', reward: title('Last Gate') }
  );
  steps(
    'line',
    'line_boss',
    ['The Warlord Knocks', 'Not Tonight', 'No Way In'],
    (n) =>
      n === 1
        ? 'Clear a boss wave without a breach.'
        : `Clear ${n} boss waves without a breach, across all runs.`,
    'l',
    'bossCleanWaves',
    [1, 5, 15]
  );
  one(
    'line',
    'line_recover',
    'Mended',
    'Take a breach, then clear the next 5 waves without another.',
    'r',
    'recoverStreak',
    5,
    { tier: 'silver' }
  );

  // ------------------------------------------------------------------ runners
  steps(
    'runners',
    'run_runners',
    ['Tripped', 'Nobody Runs Here', 'Dead Sprint'],
    (n) => `Cut down ${n} line-breakers in one run.`,
    'r',
    'runnerKills',
    [10, 25, 60]
  );
  steps(
    'runners',
    'life_runners',
    ['Gate Duty', 'Toll Taker', 'The Last Thing They See'],
    (n) => `Cut down ${n.toLocaleString('en-US')} line-breakers, across all runs.`,
    'l',
    'runnerKills',
    [250, 1000, 3000],
    { reward: title('Gatewarden') }
  );
  one(
    'runners',
    'run_wave_runners',
    'All Six',
    'Cut down 6 line-breakers in a single wave.',
    'r',
    'waveRunnerKills',
    6,
    { tier: 'silver' }
  );
  one(
    'runners',
    'run_held',
    'Doorman',
    'Soldiers on a Hold order cut down 15 line-breakers, across all runs.',
    'l',
    'runnerHeldKills',
    15,
    { tier: 'silver' }
  );
  one(
    'runners',
    'run_blast',
    'Tripwire',
    'Sapper mines and satchels kill 10 line-breakers, across all runs.',
    'l',
    'runnerBlastKills',
    10,
    { tier: 'silver' }
  );

  // ----------------------------------------------------------------- veterans
  steps(
    'veterans',
    'vet_waves',
    ['Still Standing', 'Twelve Dawns', 'Thirty Dawns'],
    (n) => `Keep one soldier alive for ${n} waves.`,
    'r',
    'vetOldest',
    [5, 12, 30],
    { reward: skin('veteran_grey') }
  );
  one(
    'veterans',
    'vet_waves_50',
    'Older Than the War',
    'Keep one soldier alive for 50 waves.',
    'r',
    'vetOldest',
    50,
    { tier: 'gold', reward: title('Father of the Company') }
  );
  steps(
    'veterans',
    'vet_kills',
    ['Blooded', 'A Name Among Them', 'They Know His Face'],
    (n) => `One soldier reaches ${n} kills in one run.`,
    'r',
    'vetKills',
    [25, 75, 200]
  );
  one(
    'veterans',
    'vet_named',
    'Sung About',
    'A soldier you gave an honour name reaches 50 kills.',
    'r',
    'namedVetKills',
    50,
    { tier: 'gold' }
  );
  steps(
    'veterans',
    'vet_boss',
    ['Everyone Came Home', 'Nobody Left Behind', 'The Warlord Took No One'],
    (n) =>
      n === 1
        ? 'Clear a boss wave without losing a soldier.'
        : `Clear ${n} boss waves without losing a soldier, across all runs.`,
    'l',
    'bossFlawlessWaves',
    [1, 5, 15]
  );
  steps(
    'veterans',
    'vet_flawless',
    ['Roll Call', 'Full Muster', 'Not One Grave'],
    (n) => `Clear ${n} waves in a row without losing a soldier, in one run.`,
    'r',
    'flawlessStreak',
    [3, 10, 20]
  );
  one(
    'veterans',
    'vet_company',
    'The Old Company',
    'Have 5 soldiers alive who have each seen 10 waves.',
    'r',
    'vets10',
    5,
    { tier: 'silver' }
  );
  steps(
    'veterans',
    'vet_honored',
    ['A Name Earned', 'Roll of Honour'],
    (n) =>
      n === 1
        ? 'Give a soldier an honour name.'
        : `Give ${n} soldiers an honour name, across all runs.`,
    'l',
    'honored',
    [1, 10]
  );
  one(
    'veterans',
    'vet_promoted',
    'From the Ranks',
    'Promote a {unit:footman} to {unit:general}.',
    'l',
    'footmanGenerals',
    1,
    { tier: 'gold' }
  );
  steps(
    'veterans',
    'vet_general',
    ['The General Lives', 'The General Still Lives'],
    (n) => `End ${n} waves in one run with your {unit:general} alive.`,
    'r',
    'generalWaves',
    [15, 40]
  );
  one(
    'veterans',
    'vet_immortal',
    'As Far As a Soldier Goes',
    'Raise a soldier to the highest veteran rank.',
    'l',
    'immortals',
    1,
    { tier: 'gold' }
  );

  // ------------------------------------------------------------------- troops
  const troopNames = {
    footman: 'Shield Wall',
    archer: 'Rain',
    crossbowman: 'Through the Plate',
    mage: 'Ash and Light',
    cavalry: 'Hooves',
    knight: 'Steel on Steel',
    pikeman: 'Hedge of Points',
    scout: 'Outrider',
    ballista: 'Long Bolt',
    sapper: 'Powder Hands',
  };
  for (const t of ACHIEVEMENT_TROOPS) {
    one(
      'troops',
      `trp_${t}`,
      troopNames[t],
      `{unit:${t}} soldiers score 500 kills, across all runs.`,
      'l',
      `typeKills.${t}`,
      500,
      { tier: 'silver' }
    );
  }
  const sig = (t, id, name, desc, n, tier = 'bronze') =>
    one('troops', id, name, desc, 'l', `sig.${t}`, n, { tier });
  sig(
    'footman',
    'trp_footman_sig',
    'Stand and Take It',
    '{unit:footman} soldiers kill 15 {enemy:berserker}s.',
    15
  );
  sig(
    'archer',
    'trp_archer_sig',
    'Vermin Shoot',
    '{unit:archer} soldiers kill 150 goblins and rats.',
    150
  );
  sig(
    'crossbowman',
    'trp_crossbowman_sig',
    'Can Opener',
    '{unit:crossbowman} soldiers kill 40 armoured enemies ({enemy:dark_knight}s, {enemy:troll}s and heavier).',
    40,
    'silver'
  );
  sig(
    'cavalry',
    'trp_cavalry_sig',
    'Ridden Down',
    '{unit:cavalry} kill 25 enemies at the end of a charge.',
    25
  );
  sig(
    'knight',
    'trp_knight_sig',
    'Among the Bowmen',
    '{unit:knight} soldiers kill 40 enemy archers and casters.',
    40
  );
  sig(
    'pikeman',
    'trp_pikeman_sig',
    'Unhorsed',
    '{unit:pikeman} soldiers kill 25 {enemy:warg_rider}s.',
    25
  );
  sig(
    'scout',
    'trp_scout_sig',
    'Run Down',
    '{unit:scout} soldiers catch and kill 20 line-breakers.',
    20
  );
  sig(
    'ballista',
    'trp_ballista_sig',
    'Big Game',
    '{unit:ballista} crews kill 15 of the largest enemies ({enemy:troll}s, siege towers and bigger).',
    15,
    'silver'
  );
  one(
    'troops',
    'trp_mage_splash',
    'Three in One',
    'A {unit:mage} blast hits 3 or more enemies at once, 10 times.',
    'l',
    'mageSplash3',
    10,
    { tier: 'bronze' }
  );
  steps(
    'troops',
    'trp_sapper_blast',
    ['Fire in the Hole', 'Demolition Man', 'Crater Maker'],
    (n) => `{unit:sapper} mines and satchel charges kill ${n} enemies, across all runs.`,
    'l',
    'blastKills',
    [25, 150, 600],
    { reward: title('Master Sapper') }
  );
  steps(
    'troops',
    'trp_sapper_siege',
    ['Engine Breaker', 'Nothing Rolls Here'],
    (n) =>
      n === 1
        ? 'A {unit:sapper} destroys a siege engine, an {enemy:iron_colossus} or a {enemy:hellmortar_pack}.'
        : `{unit:sapper} soldiers destroy ${n} siege engines, colossi or hellmortars, across all runs.`,
    'l',
    'sapperSiege',
    [1, 15]
  );
  one(
    'troops',
    'trp_sapper_mines',
    'Sown Field',
    'Have your {unit:sapper} soldiers lay 12 mines in one run.',
    'r',
    'minesLaid',
    12,
    { tier: 'silver' }
  );
  one(
    'troops',
    'trp_sapper_wave',
    'One Loud Morning',
    '{unit:sapper} blasts kill 8 enemies in a single wave.',
    'r',
    'waveBlastKills',
    8,
    { tier: 'gold' }
  );
  one(
    'troops',
    'trp_healer',
    'Steady Hands',
    'Keep a {unit:healer} alive for 15 waves.',
    'r',
    'healerOldest',
    15,
    { tier: 'silver' }
  );
  one(
    'troops',
    'trp_roster',
    'Every Trade',
    'Recruit 9 different kinds of troop in one run.',
    'r',
    'deployTypes',
    9,
    { tier: 'silver' }
  );

  // ------------------------------------------------------------------- orders
  steps(
    'orders',
    'ord_warcry',
    ['War Cry', 'Hoarse', 'The Voice'],
    (n) =>
      n === 1 ? "Give the General's War Cry." : `Give the War Cry ${n} times, across all runs.`,
    'l',
    'warCry',
    [1, 15, 60]
  );
  steps(
    'orders',
    'ord_holdline',
    ['Hold the Line', 'They Held', 'Immovable'],
    (n) =>
      n === 1
        ? "Give the General's Hold the Line order."
        : `Give Hold the Line ${n} times, across all runs.`,
    'l',
    'holdLine',
    [1, 15, 60]
  );
  one(
    'orders',
    'ord_both',
    'Both Horns',
    'Give the War Cry and Hold the Line in the same wave.',
    'l',
    'bothOrders',
    1,
    { tier: 'silver' }
  );
  steps(
    'orders',
    'ord_held',
    ['Stay Put', 'Rooted', 'Not One Step'],
    (n) => `Soldiers on a Hold order make ${n} kills, across all runs.`,
    'l',
    'heldKills',
    [25, 150, 600],
    { reward: title('Anvil') }
  );
  one(
    'orders',
    'ord_holdwave',
    'Standing Orders',
    'Clear a wave with 5 or more soldiers on Hold.',
    'l',
    'holdWaves',
    1,
    { tier: 'bronze' }
  );
  one(
    'orders',
    'ord_hunt',
    'Let Slip',
    'Hunting soldiers make 150 kills in one run.',
    'r',
    'huntKills',
    150,
    { tier: 'bronze' }
  );
  one(
    'orders',
    'ord_horn',
    'Come On Then',
    'Call 6 waves early in one run.',
    'r',
    'earlyCalls',
    6,
    { tier: 'silver' }
  );
  one(
    'orders',
    'ord_horn_life',
    'No Time to Waste',
    'Call 75 waves early, across all runs.',
    'l',
    'earlyCalls',
    75,
    { tier: 'gold' }
  );
  one(
    'orders',
    'ord_keep',
    'Field Marshal',
    'Station your {unit:general} in the Keep.',
    'l',
    'generalStationed',
    1,
    { tier: 'bronze' }
  );
  one(
    'orders',
    'ord_strikes',
    'Every Arrow in the Quiver',
    'Use each of the six strikes at least once, across all runs.',
    'l',
    'strikes',
    6,
    { tier: 'silver' }
  );
  one(
    'orders',
    'ord_spy',
    'Spymaster',
    'Use each of the eight spy actions at least once, across all runs.',
    'l',
    'spy',
    8,
    { tier: 'silver' }
  );

  // -------------------------------------------------------- works and research
  steps(
    'works',
    'wrk_types',
    ['Camp', 'Stronghold', 'A Town Behind the Line'],
    (n) => `Finish ${n} different kinds of building in one run.`,
    'r',
    'buildTypes',
    [3, 6, 10]
  );
  steps(
    'works',
    'wrk_walls',
    ['Palisade', 'Curtain Wall'],
    (n) => `Have ${n} walls standing at the end of a wave.`,
    'r',
    'walls',
    [8, 20]
  );
  one('works', 'wrk_castle', 'Raise the Keep', 'Finish a {build:castle}.', 'r', 'build.castle', 1, {
    tier: 'silver',
  });
  one(
    'works',
    'wrk_keep',
    'Inner Ward Untouched',
    'Reach wave 25 with a {build:castle} whose inner ward no enemy has entered.',
    'x',
    'sanctum_intact:25',
    1,
    { tier: 'gold' }
  );
  steps(
    'works',
    'wrk_research',
    ['Scholar', 'Learned', 'Nothing Left to Read'],
    (n) => `Complete ${n} research projects in one run.`,
    'r',
    'research',
    [3, 8, 15]
  );
  one(
    'works',
    'wrk_research_all',
    'The Whole Library',
    'Complete 30 different research projects, across all runs.',
    'l',
    'researchKinds',
    30,
    { tier: 'gold', reward: title('Loremaster') }
  );

  // -------------------------------------------------------------- medical tent
  steps(
    'medic',
    'med_saves',
    ['Carried Off', 'Stretcher Bearers', 'Nobody Dies Today'],
    (n) =>
      n === 1
        ? 'A soldier who would have died is carried to the {build:medical_tent} alive.'
        : `${n} soldiers are carried to the {build:medical_tent} alive, across all runs.`,
    'l',
    'medSaves',
    [1, 15, 75],
    { reward: title('Chirurgeon') }
  );
  one(
    'medic',
    'med_wave',
    'Busy Morning',
    'The {build:medical_tent} saves 3 soldiers in a single wave.',
    'r',
    'waveMedSaves',
    3,
    { tier: 'silver' }
  );
  one(
    'medic',
    'med_run',
    'Field Hospital',
    'The {build:medical_tent} saves 8 soldiers in one run.',
    'r',
    'medSaves',
    8,
    { tier: 'silver' }
  );
  one(
    'medic',
    'med_second_wind',
    'Second Wind',
    'A soldier saved by the {build:medical_tent} goes on to see 10 waves.',
    'l',
    'secondWind',
    1,
    { tier: 'gold' }
  );

  // -------------------------------------------------------------------- spoils
  steps(
    'spoils',
    'spl_run',
    ['To the Victor', 'War Chest Full', 'Plunder of Ten Hosts'],
    (n) => `Claim ${n} spoils of war in one run.`,
    'r',
    'edicts',
    [2, 5, 10]
  );
  steps(
    'spoils',
    'spl_life',
    ['Quartermaster General', 'Nothing Wasted'],
    (n) => `Claim ${n} spoils of war, across all runs.`,
    'l',
    'edicts',
    [40, 150]
  );
  one(
    'spoils',
    'spl_stack',
    'Thrice Sworn',
    'Take the same spoil three times in one run.',
    'r',
    'edictStack',
    3,
    { tier: 'silver' }
  );
  one(
    'spoils',
    'spl_kinds',
    'A Bit of Everything',
    'Hold 5 different spoils in one run.',
    'r',
    'edictKinds',
    5,
    { tier: 'silver' }
  );
  one(
    'spoils',
    'spl_all',
    'Seen Every Chest',
    'Claim 12 different spoils at least once, across all runs.',
    'l',
    'edictKinds',
    12,
    { tier: 'gold', reward: title('Reeve of Spoils') }
  );

  // -------------------------------------------------------------------- crates
  steps(
    'crates',
    'crt_run',
    ['Scrounger', 'Forager', 'Picked Clean'],
    (n) => `Recover ${n} supply crates in one run.`,
    'r',
    'crates',
    [3, 6, 12]
  );
  steps(
    'crates',
    'crt_life',
    ['Supply Train', 'Never Short'],
    (n) => `Recover ${n} supply crates, across all runs.`,
    'l',
    'crates',
    [100, 400]
  );
  one(
    'crates',
    'crt_ambush',
    'Seen That Trick',
    'Spring 10 baited crates, across all runs.',
    'l',
    'ambushes',
    10,
    { tier: 'silver' }
  );

  // ----------------------------------------------------------------- war camps
  steps(
    'camps',
    'cmp_camps',
    ['Burn It', 'Camp Breaker', 'Scorched Edge'],
    (n) =>
      n === 1 ? 'Destroy an enemy war camp.' : `Destroy ${n} enemy war camps, across all runs.`,
    'l',
    'warCamps',
    [1, 10, 40],
    { reward: title('Camp Breaker') }
  );
  one(
    'camps',
    'cmp_run',
    'Nowhere to Muster',
    'Destroy 3 enemy war camps in one run.',
    'r',
    'warCamps',
    3,
    { tier: 'silver' }
  );

  // ----------------------------------------------------------- foes and bosses
  const foeNames = {
    goblin_hordes: ['Pest Control', 'Goblin Bane', 'The Warrens Empty'],
    orc_warbands: ['Broke a Warband', 'Orc Bane', 'The Drums Go Quiet'],
    dark_legions: ['Stood Against the Legion', 'Legion Bane', 'The Black Banners Fall'],
    void_abyssal: ['Looked Into It', 'Void Bane', 'The Deep Closes'],
    mirror_empires: ['Broke a Mirror', 'Mirror Bane', 'No Reflection Left'],
  };
  for (const f of ACHIEVEMENT_ENEMY_FACTIONS) {
    steps(
      'foes',
      `foe_${f}`,
      foeNames[f],
      (n) => `Clear ${n} waves led by the {faction:${f}}, across all runs.`,
      'l',
      `faction.${f}`,
      [5, 30, 100]
    );
  }
  for (const b of ACHIEVEMENT_BOSSES) {
    one('foes', `foe_${b}`, `{boss:${b}}`, `Slay {boss:${b}}.`, 'l', `boss.${b}`, 1, {
      tier: 'silver',
    });
  }
  one(
    'foes',
    'foe_boss_all',
    'Ten Warlords',
    'Slay every one of the ten named warlords at least once.',
    'l',
    'bossKinds',
    10,
    { tier: 'gold', reward: theme('warlords_end') }
  );
  steps(
    'foes',
    'foe_boss_kills',
    ['Warlord Hunter', 'Kingdoms of Heads'],
    (n) => `Slay ${n} named warlords, across all runs.`,
    'l',
    'bossKills',
    [15, 50]
  );
  one(
    'foes',
    'foe_boss_blast',
    'Buried Under It',
    'Kill a named warlord with a {unit:sapper} mine or satchel charge.',
    'l',
    'bossBlastKills',
    1,
    { tier: 'gold' }
  );
  steps(
    'foes',
    'foe_elites',
    ['Champion Killer', 'No Champions Left'],
    (n) => `Kill ${n} elite enemies in one run.`,
    'r',
    'elites',
    [15, 60]
  );

  // ------------------------------------------------------ difficulty and modes
  const diffNames = {
    baby: ['First Steps', 'Finding Your Feet', 'A Gentle Victory'],
    normal: ['Fifteen Held', 'Thirty Held', 'The Realm Held'],
    chad: ['Hard Road', 'Harder Road', 'Against the Odds'],
    doomslayer: ['Into the Fire', 'Still Burning', 'Through Hell and Out'],
  };
  for (const d of ACHIEVEMENT_DIFFICULTIES) {
    steps(
      'trials',
      `diff_${d}`,
      diffNames[d],
      (n) =>
        n === 100
          ? `Win the campaign (clear wave 100) on {diff:${d}}.`
          : `Clear wave ${n} on {diff:${d}}.`,
      'l',
      `diff.${d}`,
      [15, 30, 100],
      { quick: true, reward: d === 'doomslayer' ? title('Hellwalker') : null }
    );
  }
  steps(
    'trials',
    'mod_wave',
    ['Handicap', 'Three Stones in the Boot'],
    (n) =>
      n === 1
        ? 'Clear wave 15 with an advanced modifier on.'
        : `Clear wave 15 with ${n} advanced modifiers on.`,
    'l',
    'modsAtWave15',
    [1, 3],
    { quick: true }
  );
  const modeNames = {
    survival: 'No End in Sight',
    roguelike: 'One Life',
    timed: 'Against the Glass',
    pve_horde: 'Flood',
    academy_era: 'Late to the War',
  };
  for (const [m, name] of Object.entries(modeNames)) {
    one(
      'trials',
      `mode_${m}`,
      name,
      m === 'academy_era' ? `Clear 10 waves in {mode:${m}}.` : `Clear wave 10 in {mode:${m}}.`,
      'l',
      m === 'academy_era' ? `modeCleared.${m}` : `mode.${m}`,
      10,
      { tier: 'silver', quick: true }
    );
  }
  steps(
    'trials',
    'mode_warband',
    ['Sworn Band', 'The Band Endures'],
    (n) => `Clear wave ${n} in {mode:warband}.`,
    'l',
    'mode.warband',
    [8, 30],
    { quick: true }
  );
  one(
    'trials',
    'mode_ironman',
    'No Second Chances',
    'Clear wave 20 with Ironman on.',
    'l',
    'ironmanWave',
    20,
    { tier: 'gold', quick: true, reward: title('Ironbound') }
  );

  // ------------------------------------------------------------------ campaign
  const waveMarks = [
    [5, 'Five Dawns', 'bronze'],
    [15, 'Fifteen Dawns', 'bronze'],
    [20, 'Twenty Dawns', 'silver'],
    [35, 'Thirty-Five Dawns', 'silver'],
    [75, 'Seventy-Five Dawns', 'gold'],
  ];
  for (const [w, name, tier] of waveMarks) {
    one('campaign', `wave_${w}`, name, `Clear wave ${w}.`, 'r', 'wave', w, {
      tier,
      ladder: 'wave_marks',
    });
  }
  steps(
    'campaign',
    'cmp_victory',
    ['The Realm Stands', 'It Was Not Luck'],
    (n) => (n === 1 ? 'Win the campaign: clear wave 100.' : `Win the campaign ${n} times.`),
    'l',
    'victories',
    [1, 3],
    { reward: theme('iron_dawn') }
  );
  one(
    'campaign',
    'cmp_endless',
    'Past the End',
    'Clear wave 150. The siege does not stop at victory.',
    'r',
    'wave',
    150,
    { tier: 'gold', reward: title('The Unrelieved') }
  );
  steps(
    'campaign',
    'life_waves',
    ['Seasoned', 'A Lifetime at the Wall'],
    (n) => `Clear ${n.toLocaleString('en-US')} waves, across all runs.`,
    'l',
    'waves',
    [150, 1000]
  );
  steps(
    'campaign',
    'life_kills',
    ['Bloodied', 'Charnel', 'A Sea of Them'],
    (n) => `Kill ${n.toLocaleString('en-US')} enemies, across all runs.`,
    'l',
    'kills',
    [250, 5000, 50000]
  );
  steps(
    'campaign',
    'run_kills',
    ['Red Field', 'Heaped', 'The Crows Give Up'],
    (n) => `Kill ${n.toLocaleString('en-US')} enemies in one run.`,
    'r',
    'kills',
    [200, 500, 1500]
  );
  steps(
    'campaign',
    'run_score',
    ['On the Board', 'Worth Writing Down', 'A Score to Beat'],
    (n) => `Finish a run with a score of ${n.toLocaleString('en-US')} or more.`,
    'r',
    'score',
    [1500, 4000, 10000]
  );
  one(
    'campaign',
    'run_score_top',
    'The Scribes Run Out of Ink',
    'Finish a run with a score of 25,000 or more.',
    'r',
    'score',
    25000,
    { tier: 'gold', reward: title('Chronicled') }
  );

  // -------------------------------------------------------------- allied orders
  const trial = (id, name, desc, rule, tier = 'gold') =>
    one('allies', id, name, desc, 'x', rule, 1, { tier });
  trial(
    'wwe_showmanship_victory',
    'Trial of the {order:wwe}',
    'Win the campaign with two or more of your showmen leading the army for most of it. Opens the {order:wwe}.',
    'run_wwe_showmanship:8:0.55'
  );
  trial(
    'doom_hero_unlock',
    'Trial of the {order:doom}',
    'Clear wave 200 on {diff:doomslayer}. Opens the {order:doom}.',
    'unlock:doom_hero'
  );
  trial(
    'ultimis_horde_150',
    'Trial of the {order:ultimis}',
    'Clear wave 150 on {diff:doomslayer} without losing a building to horde grunts. Opens the {order:ultimis}.',
    'diff_zombie_fortress:doomslayer:150'
  );
  trial(
    'primis_sanctum_victory',
    'Trial of the {order:primis}',
    'Win the campaign with a {build:castle} whose inner ward no enemy has entered. Opens the {order:primis}.',
    'run_sanctum_victory'
  );
  trial(
    'halo_spartan_victory',
    'Trial of the {order:halo}',
    'Win the campaign with your {unit:general} alive, after raising five {unit:footman} soldiers to command. Opens the {order:halo}.',
    'run_spartan_command:5'
  );
  trial(
    'gears_siege_victory',
    'Trial of the {order:gears}',
    'Win the campaign after destroying twelve enemy war camps or structures. Opens the {order:gears}.',
    'run_siege_victory:12'
  );
  trial(
    'lotr_fellowship_victory',
    'Trial of the {order:lotr}',
    'Win the campaign with army morale high at the end of most waves. Opens the {order:lotr}.',
    'run_fellowship_morale:8:0.55'
  );
  trial(
    'baki_martial_victory',
    'Trial of the {order:baki}',
    'Win the campaign on {diff:chad} or harder with a mostly melee army. Opens the {order:baki}.',
    'run_martial_melee:8:0.55'
  );
  trial(
    'jojo_stand_victory',
    'Trial of the {order:jojo}',
    'Win the campaign with three or more allied heroes recruited and fielded together for most of it. Opens the {order:jojo}.',
    'run_stand_alliance:8:0.55:3'
  );
  trial(
    'fotns_hokuto_victory',
    'Trial of the {order:fotns}',
    'Win the campaign after a lone hero kills a named warlord. Opens the {order:fotns}.',
    'run_hokuto_solo'
  );
  trial(
    'dragonball_planet_victory',
    'Trial of the {order:dragonball}',
    'Past wave 200, bring down a warlord with an army of mostly high-energy fighters. Opens the {order:dragonball}.',
    'run_dragonball_ki:200:0.55'
  );
  trial(
    'warhammer_eternal_crusade',
    'Trial of the {order:imperium}',
    'Win the campaign on {diff:chad} or harder holding eight fortifications throughout, with three boss waves beaten and your {unit:general} alive. Opens the {order:imperium}, {order:crystal} and {order:warp}.',
    'run_eternal_crusade:3:8'
  );
  trial(
    'tes_dragonborn_victory',
    'Trial of the {order:tes}',
    'Win the campaign with a top-rank veteran on each of the four paths and a dragon-kind warlord slain. Opens the {order:tes}.',
    'run_dragonborn_legacy:100'
  );
  for (const f of CROSSOVER_ACH_FACTIONS) {
    steps(
      'allies',
      `order_${f.key}`,
      [`{order:${f.key}}: Trusted`, `{order:${f.key}}: Master`],
      (n) =>
        `Earn ${n} mastery with the {order:${f.key}}: a point for each kill by its fighters, more for abilities, recruits and waves cleared with them.`,
      'l',
      `mastery.${f.key}`,
      ACHIEVEMENT_MASTERY_STEPS,
      {
        reward: ACHIEVEMENT_MASTERY_SKINS[f.key]
          ? skin(ACHIEVEMENT_MASTERY_SKINS[f.key])
          : { type: 'order_title', order: f.key },
      }
    );
  }

  // ------------------------------------------------------------------- secrets
  const secret = (id, name, desc, s, k, n, opts = {}) =>
    one('secret', id, name, desc, s, k, n, { hidden: true, ...opts });
  secret(
    'cheat_used',
    'The Scribe Looks Away',
    'Use a cheat code. Nothing else from that run is written down.',
    'l',
    'cheated',
    1
  );
  secret(
    'sec_first_breach',
    'It Got Past Me',
    'Let your first enemy through the line.',
    'l',
    'breaches',
    1
  );
  secret(
    'sec_leaky',
    'Sieve',
    'Let 3 through in a single wave and clear it anyway.',
    'l',
    'leakyWaves',
    1
  );
  secret(
    'sec_last_one',
    'Last One Standing',
    'Clear a wave with exactly one soldier left alive.',
    'l',
    'lastOneWaves',
    1
  );
  secret(
    'sec_headless',
    'Headless Host',
    'Lose your {unit:general}, then clear 5 more waves in the same run.',
    'r',
    'wavesAfterGeneralFell',
    5
  );
  secret(
    'sec_general_runner',
    'Do It Yourself',
    'Your {unit:general} personally cuts down a line-breaker.',
    'l',
    'generalRunnerKills',
    1
  );
  secret(
    'sec_one_kind',
    'One Trick',
    'Clear a wave past wave 8 with 8 or more soldiers, all of the same kind.',
    'l',
    'oneKindWaves',
    1
  );
  secret(
    'sec_war_chest',
    'Just the Money',
    'Take the {edict:war_chest} three times in one run.',
    'r',
    'edict.war_chest',
    3
  );
  secret(
    'sec_fallen',
    'Carved on the Wall',
    'Lose a veteran. The field remembers the name.',
    'l',
    'fallenVets',
    1
  );
  secret(
    'sec_short_reign',
    'Short Reign',
    'Lose the realm before the second wave.',
    'l',
    'fellEarly',
    1
  );

  return list;
}

const ACHIEVEMENT_LIST = buildAchievementList();
const ACHIEVEMENT_TARGET = ACHIEVEMENT_LIST.length;

// Old ids kept so older builds and tests that name them still load.
const ACHIEVEMENT_META_316_ID = 'bottom_line';
const ACHIEVEMENT_CLUB_316_ID = 'club_316';
const ACHIEVEMENT_MILLENNIUM_ID = 'millennium';
const ACHIEVEMENT_META_ID = ACHIEVEMENT_META_316_ID;

/**
 * Old achievement id -> the ids in this list that it proves.
 *
 * The 1,450-entry list is gone, but saves made with it are not. An old unlock is carried
 * over when it shows the player already did what a new achievement asks; everything else
 * is retired: remembered in the save, never shown, never counted.
 *
 * Lifetime counters in the old save (kills, waves, kills per enemy type, spy and courier
 * sets, order mastery) are kept as they are, so the lifetime achievements built on them
 * unlock from the numbers and need no entry here.
 */
function mapLegacyAchievementId(id) {
  const ids = new Set(ACHIEVEMENT_LIST.map((a) => a.id));
  // Same id, same meaning: the order trials and the cheat joke.
  if (ids.has(id)) return [id];
  const out = [];
  const upTo = (pairs, value) => {
    for (const [goal, newId] of pairs) if (value >= goal) out.push(newId);
  };
  let m;
  if ((m = /^reach_wave_(\d+)$/.exec(id))) {
    const w = +m[1];
    upTo(
      [
        [5, 'wave_5'],
        [15, 'wave_15'],
        [20, 'wave_20'],
        [35, 'wave_35'],
        [75, 'wave_75'],
        [100, 'cmp_victory_1'],
        [150, 'cmp_endless'],
      ],
      w
    );
  } else if ((m = /^diff_(baby|normal|chad|doomslayer)_(?:flawless_)?(\d+)$/.exec(id))) {
    const [, d, w] = m;
    upTo(
      [
        [15, `diff_${d}_1`],
        [30, `diff_${d}_2`],
        [100, `diff_${d}_3`],
      ],
      +w
    );
    // "Flawless" meant no soldier lost in the whole run up to that wave.
    if (id.includes('_flawless_')) {
      upTo(
        [
          [3, 'vet_flawless_1'],
          [10, 'vet_flawless_2'],
          [20, 'vet_flawless_3'],
        ],
        +w
      );
    }
  } else if ((m = /^kills_(\d+)$/.exec(id))) {
    upTo(
      [
        [200, 'run_kills_1'],
        [500, 'run_kills_2'],
        [1500, 'run_kills_3'],
      ],
      +m[1]
    );
  } else if ((m = /^lifetime_kills_(\d+)$/.exec(id))) {
    upTo(
      [
        [250, 'life_kills_1'],
        [5000, 'life_kills_2'],
        [50000, 'life_kills_3'],
      ],
      +m[1]
    );
  } else if ((m = /^lifetime_wave_(\d+)$/.exec(id))) {
    upTo(
      [
        [150, 'life_waves_1'],
        [1000, 'life_waves_2'],
      ],
      +m[1]
    );
  } else if ((m = /^session_elites_(\d+)$/.exec(id))) {
    upTo(
      [
        [15, 'foe_elites_1'],
        [60, 'foe_elites_2'],
      ],
      +m[1]
    );
  } else {
    const direct = {
      true_victory_worldheart: ['cmp_victory_1'],
      era_academy: ['cmp_victory_1'],
      honor_name: ['vet_honored_1'],
      honor_max: ['vet_honored_1'],
      field_marshal: ['ord_keep'],
      castle_up: ['wrk_castle'],
      fortress_12: ['wrk_walls_1'],
      sapper_siege: ['trp_sapper_siege_1'],
      boss_flawless: ['vet_boss_1'],
      last_stand: ['sec_last_one'],
      primis_sanctum_wave_50: ['wrk_keep'],
      deploy_all: ['trp_roster'],
      cheat_austin: ['cheat_used'],
      one_piece_real: ['cheat_used'],
    };
    if (direct[id]) out.push(...direct[id]);
  }
  return out.filter((n) => ids.has(n));
}
