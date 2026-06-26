/**
 * Generates exactly 1,000 achievements.
 * Milestone #316 "And That's The Bottom Line" unlocks at 316 total unlocks (not all others).
 */
const ACHIEVEMENT_TARGET = 1450;
const ACHIEVEMENT_META_316_ID = 'bottom_line';
const ACHIEVEMENT_CLUB_316_ID = 'club_316';
const ACHIEVEMENT_MILLENNIUM_ID = 'millennium';
const ACHIEVEMENT_META_ID = ACHIEVEMENT_META_316_ID;

const ACHIEVEMENT_TIERS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', meta: 'Meta' };

const CROSSOVER_ACH_FACTIONS = [
  { key: 'wwe', label: 'WWE Superstars', cat: 'crossover_wwe', build: 'wwe_academy' },
  { key: 'doom', label: 'Doomslayer / Hell', cat: 'crossover_doom', build: null },
  { key: 'ultimis', label: 'Element 115', cat: 'crossover_ultimis', build: 'element_barracks' },
  { key: 'primis', label: 'Primis / Origins', cat: 'crossover_primis', build: 'primis_shrine' },
  { key: 'halo', label: 'UNSC / Spartans', cat: 'crossover_halo', build: 'spartan_academy' },
  { key: 'gears', label: 'COG / Gears', cat: 'crossover_gears', build: 'cog_academy' },
  { key: 'lotr', label: 'Middle-earth', cat: 'crossover_lotr', build: 'rivendell_camp' },
  { key: 'baki', label: 'Hanma Dojo', cat: 'crossover_baki', build: 'hanma_dojo' },
  { key: 'jojo', label: "JoJo's Bizarre Adventure", cat: 'crossover_jojo', build: 'stand_arrow_shrine' },
  { key: 'fotns', label: 'Fist of the North Star', cat: 'crossover_fotns', build: 'north_star_dojo' },
  { key: 'dragonball', label: 'Dragon Ball Z-Fighters', cat: 'crossover_dragonball', build: 'capsule_corp' },
];

function achEntry(opts) {
  return {
    tier: null,
    hidden: false,
    reward: null,
    meta: false,
    track: 'session',
    ...opts,
  };
}

function getFactionOperativeIds(factionKey) {
  if (factionKey === 'wwe' && typeof WweDefs !== 'undefined') return Object.keys(WweDefs);
  if (factionKey === 'doom') return ['doomslayer_hero'];
  if (typeof CrossoverDefs === 'undefined') return [];
  return Object.entries(CrossoverDefs)
    .filter(([, d]) => d.faction === factionKey)
    .map(([id]) => id);
}

function getOperativeName(factionKey, id) {
  if (factionKey === 'wwe' && WweDefs?.[id]) return WweDefs[id].name;
  if (id === 'doomslayer_hero') return 'Doomslayer';
  if (CrossoverDefs?.[id]) return CrossoverDefs[id].name;
  return id;
}

function buildVanillaAchievements() {
  const list = [];

  const waveMilestones = [
    1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 90, 100, 110, 125, 150, 175, 200,
    225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1250, 1500, 1750, 2000,
  ];
  for (const w of waveMilestones) {
    const tier = w >= 1000 ? 'gold' : w >= 500 ? 'silver' : w >= 100 ? 'bronze' : null;
    list.push(achEntry({
      id: `reach_wave_${w}`,
      name: w === 1 ? 'First Stand' : w === 100 ? 'Academy Threshold' : w === 200 ? 'Doom Gate' : w === 500 ? 'Eternal Siege' : w === 1000 ? 'Millennium March' : `Wave ${w}`,
      desc: `Reach wave ${w} in a single battle.`,
      cat: 'waves',
      rule: `wave:${w}`,
      tier,
      track: 'session',
    }));
  }

  const lifetimeWaves = [50, 100, 200, 500, 1000];
  for (const w of lifetimeWaves) {
    list.push(achEntry({
      id: `lifetime_wave_${w}`,
      name: `Veteran Campaign ${w}`,
      desc: `Clear ${w} waves across all battles (lifetime).`,
      cat: 'waves',
      rule: `lifetime_waves:${w}`,
      tier: w >= 500 ? 'gold' : w >= 200 ? 'silver' : 'bronze',
      track: 'lifetime',
    }));
  }

  const eraMilestones = [
    ['era_academy', 'Scholar King', 'Enter the Academy Era (wave 100+).', 'era:academy', 'waves'],
    ['era_rts', 'Settlement Age', 'Enter the RTS Era with hamlets & guilds.', 'era:rts', 'waves'],
    ['era_enemy_rts', 'Mirror War', 'Survive Enemy RTS era (wave 200+).', 'era:enemy_rts', 'waves'],
    ['era_hellscape', 'Hellscape Breach', 'Reach Hellscape territory (wave 1001+).', 'era:hellscape', 'waves'],
    ['era_academy_master', 'Academy Master', 'Own 5 academies while in Academy Era.', 'academies:5', 'build'],
    ['era_rts_master', 'Lord of Settlements', 'Own 10 hamlets and 5 guilds at once.', 'settlement_chain:10:5', 'build'],
  ];
  for (const [id, name, desc, rule, cat] of eraMilestones) {
    list.push(achEntry({ id, name, desc, cat, rule, tier: 'gold' }));
  }

  const sessionKillTiers = [
    [1, 'First Blood', 'bronze'], [10, 'Skirmisher', 'bronze'], [50, 'Warrior', 'bronze'],
    [100, 'Champion', 'silver'], [250, 'Slayer', 'silver'], [500, 'Reaper', 'silver'],
    [1000, 'Annihilator', 'gold'], [2000, 'Extinction', 'gold'], [5000, 'Genocider', 'gold'],
    [10000, 'Mythic Butcher', 'gold'],
  ];
  for (const [n, name, tier] of sessionKillTiers) {
    list.push(achEntry({
      id: `kills_${n}`, name, desc: `Slay ${n} enemies in one battle.`,
      cat: 'combat', rule: `session_kills:${n}`, tier, track: 'session',
    }));
  }

  const lifetimeKillTiers = [500, 2000, 10000, 50000, 100000];
  for (const n of lifetimeKillTiers) {
    list.push(achEntry({
      id: `lifetime_kills_${n}`,
      name: `Lifetime Reaper ${n}`,
      desc: `Slay ${n.toLocaleString()} enemies across all battles.`,
      cat: 'combat',
      rule: `lifetime_kills:${n}`,
      tier: n >= 10000 ? 'gold' : n >= 2000 ? 'silver' : 'bronze',
      track: 'lifetime',
      reward: n >= 10000 ? { type: 'tp', amount: 25 } : null,
    }));
  }

  if (typeof EnemyDefs !== 'undefined') {
    for (const e of Object.keys(EnemyDefs)) {
      list.push(achEntry({
        id: `foe_first_${e}`,
        name: `${EnemyDefs[e].name} Blood`,
        desc: `Slay your first ${EnemyDefs[e].name}.`,
        cat: 'combat',
        rule: `enemy_first:${e}`,
      }));
      list.push(achEntry({
        id: `foe_lifetime_${e}_100`,
        name: `${EnemyDefs[e].name} Nemesis`,
        desc: `Slay 100 ${EnemyDefs[e].name}s (lifetime).`,
        cat: 'combat',
        rule: `lifetime_enemy_kills:${e}:100`,
        tier: 'silver',
        track: 'lifetime',
      }));
    }
  }

  const eliteTiers = [[10, 'bronze'], [50, 'silver'], [200, 'gold']];
  for (const [n, tier] of eliteTiers) {
    list.push(achEntry({
      id: `session_elites_${n}`,
      name: `Elite Hunter ${n}`,
      desc: `Slay ${n} elite enemies in one battle.`,
      cat: 'combat',
      rule: `session_elites:${n}`,
      tier,
    }));
  }
  list.push(achEntry({ id: 'siege_survive', name: 'Siege Survivor', desc: 'Clear a horde wave with embedded siege.', cat: 'combat', rule: 'siege_clear' }));
  list.push(achEntry({ id: 'horde_survive', name: 'Horde Breaker', desc: 'Clear a horde wave.', cat: 'combat', rule: 'horde_clear', tier: 'bronze' }));
  list.push(achEntry({ id: 'boss_clear', name: 'Boss Breaker', desc: 'Clear a boss wave.', cat: 'combat', rule: 'boss_clear', tier: 'silver' }));
  list.push(achEntry({ id: 'boss_flawless', name: 'Boss Untouched', desc: 'Clear a boss wave with zero breakthroughs.', cat: 'combat', rule: 'boss_flawless', tier: 'gold', hidden: true }));

  const armyRules = [
    ['deploy_all', 'Full Roster', 'Deploy every standard troop type in one battle.', 'session_deploy_all', 'bronze'],
    ['deploy_all_academy', 'Academy Roster', 'Deploy 8+ unit types during Academy Era.', 'session_deploy_8', 'silver'],
    ['army_10', 'Company', 'Field 10 allies at once.', 'session_army:10', 'bronze'],
    ['army_20', 'Battalion', 'Field 20 allies at once.', 'session_army:20', 'silver'],
    ['army_40', 'Legion', 'Field 40 allies at once.', 'session_army:40', 'gold'],
    ['first_veteran', 'Promoted', 'Earn a veteran upgrade.', 'session_vet:1', 'bronze'],
    ['vet_five', 'Officer Corps', '5 veteran upgrades in one battle.', 'session_vet:5', 'silver'],
    ['vet_fifteen', 'Elite Command', '15 veteran upgrades in one battle.', 'session_vet:15', 'gold'],
    ['bronze_star', 'Bronze Star', 'Earn a bronze star.', 'star:bronze', 'bronze'],
    ['silver_star', 'Silver Star', 'Earn a silver star.', 'star:silver', 'silver'],
    ['gold_star', 'Gold Star', 'Earn a gold star.', 'star:gold', 'gold'],
    ['honor_name', 'Crowned', 'Receive an honor name.', 'honor:1', 'silver'],
    ['honor_max', 'Legend of the Realm', 'Max gold stars and honor name on one troop.', 'honor_max', 'gold'],
    ['field_marshal', 'Field Marshal', 'Station your General in the Keep.', 'general_stationed', 'bronze'],
    ['garrison', 'Tower Archer', 'Garrison a ranged unit.', 'garrison', 'bronze'],
    ['garrison_8', 'Wall of Steel', 'Garrison 8 units at once.', 'garrison_count:8', 'silver'],
    ['courier_send', 'Dispatch Rider', 'Send a courier message.', 'courier', 'bronze'],
    ['banner_call', 'Call the Banner', 'Summon a knight via courier.', 'courier:banner', 'silver'],
    ['courier_all', 'Royal Messenger', 'Use every courier message type (lifetime).', 'courier_all:5', 'gold', 'lifetime'],
    ['roster_synergy', 'Combined Arms', 'Field melee, ranged, and support crossover tags at once.', 'roster_synergy:3', 'gold'],
  ];
  for (const row of armyRules) {
    const [id, name, desc, rule, tier, track] = row;
    list.push(achEntry({ id, name, desc, cat: id.startsWith('vet') || id.includes('star') || id.includes('honor') ? 'specialists' : 'army', rule, tier, track: track || 'session' }));
  }

  const buildRules = [
    ['first_build', 'Groundbreaking', 'Complete any building.', 'build:any', 'bronze'],
    ['wall_up', 'Stone Wall', 'Complete a wall.', 'build:wall', 'bronze'],
    ['castle_up', 'Castle Lord', 'Complete a castle compound.', 'build:castle', 'silver'],
    ['fortress', 'Fortress', 'Own 4+ walls.', 'walls:4', 'bronze'],
    ['fortress_12', 'Citadel', 'Own 12+ walls at once.', 'walls:12', 'gold'],
    ['hamlet_1', 'Village Founder', 'Complete a hamlet.', 'build:hamlet', 'bronze'],
    ['hamlet_5', 'Township', 'Own 5 hamlets at once.', 'hamlets:5', 'silver'],
    ['hamlet_40', 'Kingdom of Hamlets', 'Own 40 hamlets at once.', 'hamlets:40', 'gold'],
    ['guild_1', 'Trade Route', 'Complete a merchant guild.', 'build:merchant_guild', 'bronze'],
    ['guild_10', 'Merchant Empire', 'Own 10 merchant guilds at once.', 'guilds:10', 'silver'],
    ['first_academy_set', 'Dean of War', 'Complete 5 different academies.', 'academy_types:5', 'gold'],
    ['med_mess_pair', 'Field Hospital', 'Own med tent and mess hall.', 'support_pair', 'bronze'],
  ];
  for (const [id, name, desc, rule, tier] of buildRules) {
    list.push(achEntry({ id, name, desc, cat: 'build', rule, tier }));
  }

  const tacticRules = [
    ['fireball', 'Inferno', 'Cast Fireball Barrage.', 'ability:fireball'],
    ['lightning', 'Stormcaller', 'Cast Lightning Strike.', 'ability:lightning'],
    ['heal_rain', 'Mercy Rain', 'Cast Healing Rain.', 'ability:heal'],
    ['rally', 'Battle Rally', 'Cast Battle Rally.', 'ability:rally'],
    ['reinforce', 'Reinforcements', 'Call Reinforcements.', 'ability:reinforce'],
    ['all_strikes', 'War Mage', 'Cast every strike in one battle.', 'abilities_all:5', 'gold'],
    ['spy_action', 'Shadow Hand', 'Use the spy network.', 'spy:any'],
    ['spy_all', 'Spymaster', 'Use all six spy actions (lifetime).', 'spy_all:6', 'gold', 'lifetime'],
    ['spy_wave', 'Double Agent', 'Use 3 spy actions in one wave cycle.', 'spy_wave:3', 'silver'],
    ['mage_splash', 'Arcane Splash', 'Mage bolt hits 2+ foes.', 'mage_splash'],
    ['cavalry_charge', 'Thunder Hooves', 'Cavalry kill while charging.', 'cavalry_charge'],
    ['sapper_siege', 'Breacher', 'Sapper destroys siege equipment.', 'sapper_siege'],
    ['hunt_master', 'Hunt Master', 'Clear a wave with Hunt mode on.', 'hunt_wave'],
    ['last_stand', 'Last Stand', 'Clear a wave with one ally left.', 'last_stand', 'gold', null, true],
  ];
  for (const row of tacticRules) {
    const [id, name, desc, rule, tier, track, hidden] = row;
    list.push(achEntry({ id, name, desc, cat: 'tactics', rule, tier, track: track || 'session', hidden: !!hidden }));
  }

  const economyRules = [
    ['tp_100', 'War Chest', 'Hold 100 TP at once.', 'tp:100', 'bronze'],
    ['tp_500', 'Royal Treasury', 'Hold 500 TP at once.', 'tp:500', 'silver'],
    ['tp_2000', 'Dragon Hoard', 'Hold 2000 TP at once.', 'tp:2000', 'gold'],
    ['tp_10000', 'Infinite War', 'Hold 10000 TP at once.', 'tp:10000', 'gold'],
    ['settle_tp_10', 'Trade Baron', '+10 TP/round from settlements.', 'settle_tp:10', 'silver'],
    ['settle_tp_25', 'Trade Emperor', '+25 TP/round from settlements.', 'settle_tp:25', 'gold'],
    ['builders_5', 'Construction Corps', '5 live builders on field.', 'builders:5', 'silver'],
    ['builders_10', 'Industrial Age', '10 live builders on field.', 'builders:10', 'gold'],
  ];
  for (const [id, name, desc, rule, tier] of economyRules) {
    list.push(achEntry({ id, name, desc, cat: 'economy', rule, tier }));
  }

  const diffs = ['baby', 'normal', 'chad', 'doomslayer'];
  const diffLabels = { baby: 'Baby', normal: 'Normal', chad: 'Chad', doomslayer: 'Doomslayer' };
  const diffWaves = [25, 50, 100, 200, 500, 1000, 2000];
  for (const d of diffs) {
    for (const w of diffWaves) {
      const tier = w >= 1000 ? 'gold' : w >= 500 ? 'silver' : w >= 100 ? 'bronze' : null;
      list.push(achEntry({
        id: `diff_${d}_${w}`,
        name: `${diffLabels[d]} Wave ${w}`,
        desc: `Reach wave ${w} on ${diffLabels[d]} difficulty.`,
        cat: 'difficulty',
        rule: `diff_wave:${d}:${w}`,
        tier,
      }));
    }
    for (const [w, tier] of [[20, 'bronze'], [50, 'silver'], [100, 'gold']]) {
      list.push(achEntry({
        id: `diff_${d}_flawless_${w}`,
        name: `${diffLabels[d]} Untouchable ${w}`,
        desc: `Reach wave ${w} on ${diffLabels[d]} with zero breakthroughs.`,
        cat: 'difficulty',
        rule: `diff_flawless:${d}:${w}`,
        tier,
      }));
    }
  }

  for (let mods = 1; mods <= 5; mods++) {
    list.push(achEntry({
      id: `advanced_mods_${mods}`,
      name: `Modifier Stack ${mods}`,
      desc: `Win a wave with ${mods}+ advanced difficulty modifiers active.`,
      cat: 'difficulty',
      rule: `advanced_mods:${mods}`,
      tier: mods >= 4 ? 'gold' : mods >= 2 ? 'silver' : 'bronze',
    }));
  }

  return list;
}

function fairWaveFieldMin(rosterSize) {
  return Math.max(2, Math.min(3, Math.ceil(rosterSize * 0.5)));
}

function buildFactionAchievements(cfg, targetPerFaction) {
  const list = [];
  const ids = getFactionOperativeIds(cfg.key);
  const label = cfg.label;
  const waveFieldMin = fairWaveFieldMin(ids.length);

  for (const id of ids) {
    list.push(achEntry({
      id: `${cfg.key}_recruit_${id}`,
      name: `Signed: ${getOperativeName(cfg.key, id)}`,
      desc: `Recruit ${getOperativeName(cfg.key, id)}.`,
      cat: cfg.cat,
      rule: `crossover_recruit:${cfg.key}:${id}`,
      track: 'lifetime',
    }));
  }

  if (ids.length > 1) {
    list.push(achEntry({
      id: `${cfg.key}_grand_slam`,
      name: `${label} Grand Slam`,
      desc: `Recruit every ${label} operative.`,
      cat: cfg.cat,
      rule: `crossover_all:${cfg.key}`,
      tier: 'gold',
      track: 'lifetime',
      reward: { type: 'tp', amount: 50 },
    }));
  }

  if (cfg.build) {
    list.push(achEntry({
      id: `${cfg.key}_barracks`,
      name: `${label} HQ`,
      desc: `Complete a ${label} barracks or academy.`,
      cat: cfg.cat,
      rule: `build:${cfg.build}`,
      tier: 'bronze',
    }));
  }

  const fieldCounts = [...new Set([2, 3, 5, 8, 10, ids.length].filter(n => n > 0 && n <= Math.max(ids.length, 10)))];
  for (const n of fieldCounts) {
    list.push(achEntry({
      id: `${cfg.key}_field_${n}`,
      name: `${label} Squad ${n}`,
      desc: `Field ${n} ${label} operatives at once.`,
      cat: cfg.cat,
      rule: `crossover_field:${cfg.key}:${n}`,
      tier: n >= 10 ? 'gold' : n >= 5 ? 'silver' : 'bronze',
    }));
  }

  const waveTiers = [
    [10, 'bronze'], [25, 'bronze'], [50, 'silver'], [100, 'silver'], [200, 'gold'], [500, 'gold'],
  ];
  for (const [w, tier] of waveTiers) {
    list.push(achEntry({
      id: `${cfg.key}_wave_${w}`,
      name: `${label} Wave ${w}`,
      desc: `Clear wave ${w} with ${nLabel(cfg.key, waveFieldMin)}+ ${label} operatives on field.`,
      cat: cfg.cat,
      rule: `crossover_wave:${cfg.key}:${w}:${waveFieldMin}`,
      tier,
    }));
  }

  const killTiers = [
    [25, 'bronze'], [100, 'bronze'], [500, 'silver'], [2000, 'silver'], [10000, 'gold'],
  ];
  for (const [n, tier] of killTiers) {
    list.push(achEntry({
      id: `${cfg.key}_kills_${n}`,
      name: `${label} Slayer ${n}`,
      desc: `${label} operatives score ${n} kills (lifetime).`,
      cat: cfg.cat,
      rule: `crossover_kills:${cfg.key}:${n}`,
      tier,
      track: 'lifetime',
    }));
  }

  const abilityTiers = [5, 25, 100, 500];
  for (const n of abilityTiers) {
    list.push(achEntry({
      id: `${cfg.key}_abilities_${n}`,
      name: `${label} Finisher ${n}`,
      desc: `Trigger ${label} abilities ${n} times (lifetime).`,
      cat: cfg.cat,
      rule: `crossover_abilities:${cfg.key}:${n}`,
      tier: n >= 100 ? 'gold' : n >= 25 ? 'silver' : 'bronze',
      track: 'lifetime',
    }));
  }

  if (cfg.key === 'wwe') {
    const wweExtras = [
      ['wwe_squared_circle', 'Squared Circle', 'Build the WWE Academy.', 'build:wwe_academy', 'gold'],
      ['wwe_tag_team', 'Tag Team Champions', 'Field 4 WWE superstars at once.', 'crossover_field:wwe:4', 'silver'],
      ['wwe_showstopper', 'Showstopper', 'Clear wave 50 with 6+ WWE superstars.', 'crossover_wave:wwe:50', 'gold'],
      ['wwe_attitude', 'Attitude Era', 'Clear wave 100 with full WWE roster on field.', 'crossover_wave:wwe:100', 'gold'],
    ];
    for (const [id, name, desc, rule, tier] of wweExtras) {
      if (!list.find(a => a.id === id)) list.push(achEntry({ id, name, desc, cat: cfg.cat, rule, tier }));
    }
  }

  if (cfg.key === 'doom') {
    const doomExtras = [
      ['doom_hero_unlock', 'Rip and Tear', 'Survive to wave 200 on Doomslayer difficulty.', 'unlock:doom_hero', 'gold'],
      ['doom_hero_deploy', 'Hell Walker', 'Deploy the Doomslayer hero.', 'deploy:doomslayer_hero', 'bronze'],
      ['hellscape_1001', 'Hellscape Survivor', 'Reach wave 1001.', 'wave:1001', 'gold'],
      ['doom_hero_50', 'Doom Eternal 50', 'Keep Doomslayer alive for 50 waves.', 'doom_alive:50', 'silver'],
      ['doom_hero_100', 'Doom Eternal 100', 'Keep Doomslayer alive for 100 waves.', 'doom_alive:100', 'gold'],
      ['doom_rip_100', 'Rip & Tear 100', 'Doomslayer scores 100 kills in one battle.', 'doom_session_kills:100', 'silver'],
      ['doom_rip_1000', 'Rip & Tear 1000', 'Doomslayer scores 1000 kills (lifetime).', 'doom_lifetime_kills:1000', 'gold'],
      ['doom_flawless_50', 'Hell Untouched', 'Reach wave 50 on Doomslayer with 0 misses.', 'diff_flawless:doomslayer:50', 'gold'],
      ['doom_bfg', 'BFG Division', 'Clear wave 200 on Doomslayer difficulty.', 'diff_wave:doomslayer:200', 'gold'],
      ['doom_500', 'Hell Walker 500', 'Reach wave 500 on Doomslayer difficulty.', 'diff_wave:doomslayer:500', 'gold'],
    ];
    for (const [id, name, desc, rule, tier] of doomExtras) {
      if (!list.find(a => a.id === id)) list.push(achEntry({ id, name, desc, cat: cfg.cat, rule, tier }));
    }
  }

  if (cfg.key === 'jojo') {
    list.push(achEntry({
      id: 'jojo_steel_ball_run',
      name: 'Steel Ball Run',
      desc: 'Field JoJo Part 7 cavalry operatives.',
      cat: cfg.cat,
      rule: 'crossover_flag:jojo:cavalry',
      tier: 'gold',
      hidden: true,
    }));
  }

  let mastery = 0;
  while (list.length < targetPerFaction) {
    const tier = mastery % 3 === 0 ? 'gold' : mastery % 2 === 0 ? 'silver' : 'bronze';
    list.push(achEntry({
      id: `${cfg.key}_mastery_${mastery}`,
      name: `${label} Mastery ${mastery + 1}`,
      desc: `Earn ${(mastery + 1) * 25} ${label} mastery points.`,
      cat: cfg.cat,
      rule: `crossover_mastery:${cfg.key}:${(mastery + 1) * 25}`,
      tier,
      track: 'lifetime',
      hidden: mastery > 8,
    }));
    mastery++;
  }

  return list.slice(0, targetPerFaction);
}

function nLabel(key, n) { return String(n); }

function buildSynergyAndSecrets() {
  const list = [
    achEntry({ id: 'cheat_used', name: 'Rule Breaker', desc: 'Enter any cheat code.', cat: 'secrets', rule: 'cheat:any', hidden: true }),
    achEntry({ id: 'cheat_austin', name: 'Austin 3:16', desc: 'Enter the Austin 3:16 cheat.', cat: 'secrets', rule: 'cheat:austin', hidden: true }),
    achEntry({ id: 'wwe_unlock', name: 'WWE Universe', desc: 'Unlock the WWE Academy (316 Club).', cat: 'secrets', rule: 'unlock:wwe', tier: 'gold' }),
    achEntry({ id: 'multiversal_3', name: 'Multiversal Alliance', desc: 'Field operatives from 3+ crossover factions in one battle.', cat: 'secrets', rule: 'multiversal:3', tier: 'gold' }),
    achEntry({ id: 'multiversal_5', name: 'Omniversal Coalition', desc: 'Field operatives from 5+ crossover factions in one battle.', cat: 'secrets', rule: 'multiversal:5', tier: 'gold', hidden: true }),
    achEntry({ id: 'crossover_completionist', name: 'Crossover Completionist', desc: 'Earn every crossover Grand Slam.', cat: 'secrets', rule: 'crossover_grand_slam_all', tier: 'gold' }),
    achEntry({ id: 'synergy_temporal', name: 'Temporal Paradox', desc: 'Field Ultimis and Primis operatives together.', cat: 'secrets', rule: 'synergy:temporal_paradox', tier: 'silver' }),
    achEntry({ id: 'synergy_modern', name: 'Modern Warfare', desc: 'Field UNSC and COG operatives together.', cat: 'secrets', rule: 'synergy:modern_warfare', tier: 'silver' }),
    achEntry({ id: 'synergy_martial', name: 'Martial Worlds', desc: 'Field Hanma and Hokuto operatives together.', cat: 'secrets', rule: 'synergy:martial_worlds', tier: 'silver' }),
    achEntry({ id: 'synergy_ki_stand', name: 'Ki & Stand', desc: 'Field Dragon Ball and JoJo operatives together.', cat: 'secrets', rule: 'synergy:ki_stand', tier: 'gold' }),
    achEntry({ id: 'synergy_guest', name: 'Guest Star', desc: 'Field WWE with any other crossover faction.', cat: 'secrets', rule: 'synergy:guest_star', tier: 'bronze' }),
    achEntry({ id: 'faction_mastery_100', name: 'Faction Devotee', desc: 'Earn 100 mastery points in any crossover faction.', cat: 'secrets', rule: 'crossover_mastery_any:100', tier: 'silver' }),
    achEntry({ id: 'faction_mastery_500', name: 'Faction Legend', desc: 'Earn 500 mastery points in any crossover faction.', cat: 'secrets', rule: 'crossover_mastery_any:500', tier: 'gold', hidden: true }),
    achEntry({ id: 'creative_sandbox', name: 'Lab Rat', desc: 'Start a Creative Mode session.', cat: 'secrets', rule: 'creative_start', hidden: true }),
    achEntry({ id: 'perk_collector', name: 'Perk Collector', desc: 'Collect 4 perks on one hero.', cat: 'secrets', rule: 'perks:4', tier: 'silver', hidden: true }),
    achEntry({ id: 'one_piece_real', name: 'The One Piece Is Real', desc: 'Unlock everything at once.', cat: 'secrets', rule: 'cheat:one_piece', hidden: true }),
  ];
  return list;
}

function buildMetaAchievements() {
  return [
    achEntry({
      id: ACHIEVEMENT_CLUB_316_ID,
      name: '316 Club',
      desc: 'Unlock 316 achievements — welcome to the club.',
      cat: 'meta',
      rule: 'unlocked_count:316',
      meta: true,
      tier: 'meta',
      reward: { type: 'badge', id: 'club_316' },
    }),
    achEntry({
      id: ACHIEVEMENT_META_316_ID,
      name: "And That's The Bottom Line",
      desc: 'Reach the 316 achievement milestone — WWE Academy unlocked.',
      cat: 'meta',
      rule: 'unlocked_count:316',
      meta: true,
      tier: 'meta',
      reward: { type: 'unlock', id: 'wwe_academy' },
    }),
    achEntry({
      id: ACHIEVEMENT_MILLENNIUM_ID,
      name: 'Millennium Legend',
      desc: 'Unlock all 1,449 other achievements.',
      cat: 'meta',
      rule: 'unlocked_count:1449',
      meta: true,
      tier: 'meta',
      reward: { type: 'tp', amount: 316 },
    }),
  ];
}

function buildAchievementList() {
  const list = [];
  list.push(...buildVanillaAchievements());

  const vanillaCount = list.length;
  const metaCount = 3;
  const synergyCount = buildSynergyAndSecrets().length;
  const reserved = metaCount + synergyCount;
  const factionSlots = ACHIEVEMENT_TARGET - reserved;
  const perFaction = Math.max(100, Math.floor((factionSlots - vanillaCount) / CROSSOVER_ACH_FACTIONS.length));

  for (const cfg of CROSSOVER_ACH_FACTIONS) {
    list.push(...buildFactionAchievements(cfg, perFaction));
  }
  list.push(...buildSynergyAndSecrets());
  list.push(...buildMetaAchievements());

  const seen = new Set();
  const deduped = [];
  for (const a of list) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    deduped.push(a);
  }

  let result = deduped;
  let filler = 0;
  while (result.length < ACHIEVEMENT_TARGET) {
    result.push(achEntry({
      id: `hidden_milestone_${filler}`,
      name: `Hidden Path ${filler + 1}`,
      desc: 'A secret milestone on the road to 1,450.',
      cat: 'secrets',
      rule: `hidden_milestone:${filler + 1}`,
      hidden: true,
      track: 'lifetime',
    }));
    filler++;
  }
  while (result.length > ACHIEVEMENT_TARGET) {
    const idx = result.findIndex(a => a.id.startsWith('hidden_milestone_') || a.id.includes('_mastery_'));
    if (idx >= 0) result.splice(idx, 1);
    else result.pop();
  }

  if (result.length !== ACHIEVEMENT_TARGET) {
    console.warn(`Achievement count: ${result.length}, target ${ACHIEVEMENT_TARGET}`);
  }

  return result;
}

const ACHIEVEMENT_LIST = buildAchievementList();
if (typeof console !== 'undefined' && ACHIEVEMENT_LIST.length !== ACHIEVEMENT_TARGET) {
  console.warn(`Achievement list: ${ACHIEVEMENT_LIST.length} / ${ACHIEVEMENT_TARGET}`);
}