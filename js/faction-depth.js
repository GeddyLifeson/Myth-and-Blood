/**
 * Crossover faction depth — identity, synergies, balance, mastery, seasonal events.
 */
const FactionDepth = (() => {
  const FIELD_SOFT_CAP = 14;
  const EARLY_WAVE_COST_BONUS = 1;
  const EARLY_WAVE_CAP = 0;
  const STANDARD_BARRACKS_COST = 280;
  const STANDARD_BARRACKS_BUILDERS = 4;

  const PROFILES = {
    wwe: {
      label: 'WWE Superstars', building: 'wwe_academy', palette: ['#c04040', '#ffd700'],
      identity: 'Showmanship morale bombs, elite finishers, and tag-team aura.',
      weakness: 'High TP cost; vulnerable to sustained ranged pressure before Hulk Up.',
      playstyle: 'Deploy 2–4 for morale spikes; save finishers for elite waves.',
      lore: 'Beyond the 316 Club lies the squared circle — where legends trade steel for glory and the crowd roars through every siege.',
      sfx: 'wwe', requiresWave: 0, requiresBuilders: 10,
      masteryTitle: ['Fan', 'Superfan', 'Hall of Famer', 'Grand Champion'],
    },
    doom: {
      label: 'Hell / Doomslayer', building: null, palette: ['#40c040', '#1a3018'],
      identity: 'Single-entity apocalypse — rip, heal, and endure.',
      weakness: 'Extreme TP cost; hellscape (wave 1001+) normalizes his damage.',
      playstyle: 'Unlock via Doomslayer difficulty wave 200; let him anchor, not replace your army.',
      lore: 'They say he walked out of Hell itself, blade humming with the wrath of every fallen marine.',
      sfx: 'doom', masteryTitle: ['Slayer', 'Doom Guy', 'Hell Walker', 'Icon of Sin'],
    },
    ultimis: {
      label: 'Element 115', building: 'element_barracks', palette: ['#c06030', '#8040a0'],
      identity: 'Mad science squad — frags, wunderwaffe chains, vodka tanking.',
      weakness: 'Richtofen is fragile; clustered undead overwhelm without walls.',
      playstyle: 'Tank Dempsey front, Richtofen behind walls, Takeo hunts elites.',
      lore: 'Four madmen bound by Element 115 and worse — the original crew that first cracked the multiverse.',
      sfx: 'ultimis', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['115 Recruit', 'Kino Veteran', 'Ascension Runner', 'Moon Operator'],
    },
    primis: {
      label: 'Primis Crew', building: 'primis_shrine', palette: ['#d07040', '#9040c0'],
      identity: 'Upgraded aether knights — slams, curtains, summoning keys.',
      weakness: 'Premium TP; needs shrine investment before spamming recruits.',
      playstyle: 'Iron Curtain Nikolai anchors; Primis Richtofen drains elites to heal.',
      lore: 'The corrected timeline\'s warriors — same souls, sharper blades, heavier sins.',
      sfx: 'primis', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS, recommendedHamlets: 1,
      masteryTitle: ['Primis Initiate', 'Keeper', 'Apothicon Scholar', 'Cycle Breaker'],
    },
    halo: {
      label: 'UNSC / Spartans', building: 'spartan_academy', palette: ['#408040', '#80c0ff'],
      identity: 'Shielded ranged core — Spartan Rage, Noble teamwork, tech debuffs.',
      weakness: 'Melee-only Spartans (Emile) must be screened; expensive academy.',
      playstyle: 'Jorge + Jun backline; Carter buffs; Johnson oorah on wave start.',
      lore: 'UNSC fireteams dropped into medieval hell — MJOLNIR against goblin steel.',
      sfx: 'halo', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Recruit', 'Spartan', 'Noble', 'Master Chief'],
    },
    gears: {
      label: 'COG Forces', building: 'cog_academy', palette: ['#506080', '#c04040'],
      identity: 'Lancer discipline — chainsaw finishers, Carmine brotherhood, siege busting.',
      weakness: 'Carmines are fragile; needs Marcus anchor for Dom synergy.',
      playstyle: 'Marcus + Dom core; Baird for towers; Cole Train flanks.',
      lore: 'The COG brought chainsaws to a sword fight. The Locust... were already here, wearing goblin faces.',
      sfx: 'gears', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Gear', 'Grub Killer', 'Sera Veteran', 'Last Jacinto'],
    },
    lotr: {
      label: 'Middle-earth', building: 'rivendell_camp', palette: ['#406050', '#c0a040'],
      identity: 'Fellowship aura — Gandalf terror, Legolas range, Aragorn elite slayer.',
      weakness: 'Frodo is soft; expensive camp; slow to field full fellowship.',
      playstyle: 'Gandalf mid, Legolas garrison, Gimli on siege waves.',
      lore: 'From Rivendell\'s last camp march heroes who will not let the West fall again.',
      sfx: 'lotr', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Companion', 'Fellowship', 'Ring-Bearer', 'King Returned'],
    },
    baki: {
      label: 'Hanma Dojo', building: 'hanma_dojo', palette: ['#c04040', '#606060'],
      identity: 'Pure melee monsters — Demon Back, Ogre deletes, iron bodies.',
      weakness: 'No ranged; kited by harpies and mages; Yujiro drains TP.',
      playstyle: 'Baki + Doppo line; Oliva tanks; Yujiro for boss waves only.',
      lore: 'The Hanma bloodline treats your siege as calisthenics.',
      sfx: 'baki', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Dojo Student', 'Fighter', 'Champion', 'Ogre Slayer'],
    },
    jojo: {
      label: 'JoJo (Parts 1–7)', building: 'stand_arrow_shrine', palette: ['#8040a0', '#e0c040'],
      identity: 'Stand users across eras — hamon, ORA rushes, SBR cavalry.',
      weakness: 'Part 7 cavalry needs space; hamon weak vs necromancer hordes without walls.',
      playstyle: 'Mix parts for tags; Jotaro pins elites; Johnny/Gyro hunt on wide maps.',
      lore: 'A Stand Arrow shrine on your battlefield? Fate is bizarre, and the waves are stranger.',
      sfx: 'jojo', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Stand User', 'Joestar', 'Passione', 'Steel Ball Run'],
    },
    fotns: {
      label: 'Fist of the North Star', building: 'north_star_dojo', palette: ['#4080c0', '#c0c0e0'],
      identity: 'Hokuto pressure — ATATATA finishers, Toki heals, Raoh terror.',
      weakness: 'Melee only; Raoh is slow; needs Toki support for sustain.',
      playstyle: 'Kenshiro on elites; Toki aura; Rei hunts fast foes.',
      lore: 'You are already dead — the dojo teaches your foes the same lesson.',
      sfx: 'fotns', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Hokuto Student', 'Successor', 'Master', 'Ken-Oh'],
    },
    dragonball: {
      label: 'Dragon Ball', building: 'capsule_corp', palette: ['#e06040', '#4060c0'],
      identity: 'Ki burst carries — beam finishers, pride spikes, perfect form sustain.',
      weakness: 'Ki users need TP runway; Beerus is god-tier cost.',
      playstyle: 'Goku/Vegeta core; Piccolo support beams; save Beerus for bosses.',
      lore: 'Capsule Corp logistics on a medieval map — because power levels demand it.',
      sfx: 'dragonball', requiresWave: 0, requiresBuilders: STANDARD_BARRACKS_BUILDERS,
      masteryTitle: ['Z Fighter', 'Super Saiyan', 'God Ki', 'Hakai'],
    },
  };

  const SYNERGIES = [
    { id: 'temporal_paradox', factions: ['ultimis', 'primis'], name: 'Temporal Paradox',
      desc: 'Ultimis + Primis on field: +12% ability proc damage.',
      bonus: { abilityDmg: 0.12 } },
    { id: 'modern_warfare', factions: ['halo', 'gears'], name: 'Modern Warfare',
      desc: 'UNSC + COG: +10 accuracy to ranged crossover operatives.',
      bonus: { rangedAcc: 10 } },
    { id: 'last_alliance', factions: ['lotr', 'halo'], name: 'Last Alliance',
      desc: 'Middle-earth + UNSC: +4 morale/round to all allies.',
      bonus: { moraleRegen: 4 } },
    { id: 'martial_worlds', factions: ['baki', 'fotns'], name: 'Martial Worlds',
      desc: 'Hanma + Hokuto: +15% melee crossover damage.',
      bonus: { meleeDmg: 0.15 } },
    { id: 'bizarre_martial', factions: ['jojo', 'baki'], name: 'Bizarre Martial Arts',
      desc: 'JoJo + Hanma: +8% crit chance on melee finishers.',
      bonus: { critChance: 0.08 } },
    { id: 'ki_stand', factions: ['dragonball', 'jojo'], name: 'Ki & Stand',
      desc: 'Dragon Ball + JoJo: crossover kills heal nearest ally 8 HP.',
      bonus: { killHeal: 8 } },
    { id: 'fellowship_gears', factions: ['lotr', 'gears'], name: 'Fellowship of War',
      desc: 'Middle-earth + COG: +20% siege damage from crossover units.',
      bonus: { siegeDmg: 0.2 } },
    { id: 'guest_star', factions: ['wwe'], name: 'Guest Star',
      desc: 'Any WWE + second faction: +6 morale on wave start.',
      bonus: { waveMorale: 6 }, requiresOtherFaction: true },
    { id: 'aether_unsc', factions: ['primis', 'halo'], name: 'Aether & MJOLNIR',
      desc: 'Primis + UNSC: +6 accuracy to ranged crossover operatives.',
      bonus: { rangedAcc: 6 } },
    { id: 'ki_pressure', factions: ['fotns', 'dragonball'], name: 'Ki Pressure Point',
      desc: 'Hokuto + Dragon Ball: +10% melee crossover damage.',
      bonus: { meleeDmg: 0.1 } },
    { id: 'ppv_siege', factions: ['wwe', 'gears'], name: 'Pay-Per-View Siege',
      desc: 'WWE + COG: +12% siege damage from crossover units.',
      bonus: { siegeDmg: 0.12 }, requiresWwe: true },
    { id: 'multiversal_4', factions: ['ultimis', 'halo', 'lotr', 'jojo'], name: 'Four Worlds',
      desc: 'Four distinct crossover factions: +5% all crossover damage.',
      bonus: { crossoverDmg: 0.05 }, minFactions: 4 },
  ];

  const ENEMY_COUNTERS = {
    necromancer: { weakFactions: ['jojo', 'primis'], mult: 1.2, note: 'Undead resist hamon and aether — field walls!' },
    shaman: { weakFactions: ['fotns', 'baki'], mult: 1.15, note: 'Enemy healers blunt martial burst.' },
    harpy: { weakFactions: ['baki', 'fotns', 'wwe', 'halo'], mult: 1.1, note: 'Flyers kite melee-heavy rosters.' },
    sky_drake: { weakFactions: ['gears', 'lotr'], mult: 1.12, note: 'Anti-air crossover helps (Halo, DB).' },
    war_chief: { weakFactions: ['ultimis'], mult: 1.08, note: 'Boss elites punish reckless 115 rushes.' },
    assassin: { weakFactions: ['halo', 'dragonball'], mult: 1.12, note: 'Stealth elites pressure ranged carries.' },
    dark_mage: { weakFactions: ['dragonball', 'primis'], mult: 1.1, note: 'Arcane shields blunt ki and aether bursts.' },
    troll: { weakFactions: ['ultimis', 'primis'], mult: 1.1, note: 'Brute hordes overwhelm mad-science squads.' },
    berserker: { weakFactions: ['gears', 'lotr'], mult: 1.1, note: 'Berserkers rush disciplined lines.' },
    goblin_sapper: { weakFactions: ['halo', 'gears'], mult: 1.08, note: 'Sappers target modern war machines.' },
  };

  const MASTERY_CHALLENGES = [
    { id: 'wwe_show', faction: 'wwe', name: 'Main Event', desc: 'Clear wave 30 with 4+ WWE on field.', wave: 30, minField: 4 },
    { id: 'halo_noble', faction: 'halo', name: 'Noble Team', desc: 'Clear wave 40 with 3+ Halo operatives, 0 misses.', wave: 40, minField: 3, flawless: true },
    { id: 'lotr_fellowship', faction: 'lotr', name: 'Nine Walkers', desc: 'Field 5+ LOTR operatives at once.', minField: 5 },
    { id: 'jojo_sbr', faction: 'jojo', name: 'Steel Ball Run', desc: 'Field 2+ Part 7 cavalry operatives.', flag: 'jojo_cavalry' },
    { id: 'db_zenkai', faction: 'dragonball', name: 'Zenkai Boost', desc: 'Score 200 lifetime DB kills.', kills: 200 },
    { id: '115_moon', faction: 'ultimis', name: 'Moon Rounds', desc: 'Trigger 50 Ultimis abilities (lifetime).', abilities: 50 },
    { id: 'primis_cycle', faction: 'primis', name: 'Cycle Breaker', desc: 'Field 3+ Primis operatives at once.', minField: 3 },
    { id: 'cog_last_stand', faction: 'gears', name: 'Last Jacinto', desc: 'Clear wave 35 with 3+ COG on field.', wave: 35, minField: 3 },
    { id: 'dojo_champion', faction: 'baki', name: 'Hanma Champion', desc: 'Score 150 lifetime Hanma kills.', kills: 150 },
    { id: 'hokuto_successor', faction: 'fotns', name: 'Hokuto Successor', desc: 'Trigger 40 Hokuto abilities (lifetime).', abilities: 40 },
  ];

  const SEASONAL_EVENTS = [
    { id: 'moon_rounds', months: [1], name: 'Moon Rounds', factions: ['ultimis'], bonus: { abilityDmg: 0.08 }, desc: 'Element 115 abilities +8% in January.' },
    { id: 'primis_ascension', months: [2], name: 'Primis Ascension', factions: ['primis'], bonus: { dmg: 0.08 }, desc: 'Primis damage +8% in February.' },
    { id: 'wrestlemania', months: [3, 4], name: 'WrestleMania Season', factions: ['wwe'], bonus: { morale: 8 }, desc: 'WWE morale +8 on recruit.' },
    { id: 'cog_siegebreak', months: [5], name: 'COG Siegebreak', factions: ['gears'], bonus: { siegeDmg: 0.1 }, desc: 'COG siege damage +10% in May.' },
    { id: 'stand_summer', months: [6, 7], name: 'Stand Summer', factions: ['jojo'], bonus: { abilityDmg: 0.1 }, desc: 'JoJo abilities +10% Jun–Jul.' },
    { id: 'saiyan_saga', months: [8], name: 'Saiyan Saga', factions: ['dragonball'], bonus: { dmg: 0.1 }, desc: 'Dragon Ball damage +10% in August.' },
    { id: 'fellowship_march', months: [9], name: 'Fellowship March', factions: ['lotr'], bonus: { moraleRegen: 3 }, desc: 'Middle-earth grants +3 morale/round in September.' },
    { id: 'hanma_open', months: [10], name: 'Hanma Open', factions: ['baki'], bonus: { meleeDmg: 0.1 }, desc: 'Hanma melee damage +10% in October.' },
    { id: 'spartan_day', months: [11], name: 'Spartan Day', factions: ['halo'], bonus: { acc: 8 }, desc: 'UNSC accuracy +8 during November.' },
    { id: 'hokuto_winter', months: [12], name: 'Hokuto Winter', factions: ['fotns'], bonus: { abilityDmg: 0.08 }, desc: 'Hokuto abilities +8% in December.' },
  ];

  let ctx = null;
  let activeSynergies = [];
  let sessionChallenges = new Set();

  function bind(gameCtx) { ctx = gameCtx; }

  function onGameStart() {
    sessionChallenges = new Set();
    activeSynergies = [];
  }

  function getProfile(factionId) {
    return PROFILES[factionId] || null;
  }

  function getSeasonalEvents(date = new Date()) {
    const m = date.getMonth() + 1;
    return SEASONAL_EVENTS.filter(e => e.months.includes(m));
  }

  function getSeasonalEvent(date = new Date()) {
    return getSeasonalEvents(date)[0] || null;
  }

  function getMasteryPoints(faction) {
    if (typeof Achievements === 'undefined') return 0;
    try {
      const raw = localStorage.getItem('myth-and-blood-achievements-v3');
      if (!raw) return 0;
      const data = JSON.parse(raw);
      return data.crossoverMastery?.[faction] || 0;
    } catch (_) { return 0; }
  }

  function getMasteryTier(faction) {
    const pts = getMasteryPoints(faction);
    if (pts >= 500) return 4;
    if (pts >= 300) return 3;
    if (pts >= 150) return 2;
    if (pts >= 50) return 1;
    return 0;
  }

  function getMasteryTitle(faction) {
    const prof = PROFILES[faction];
    const tier = getMasteryTier(faction);
    return prof?.masteryTitle?.[tier - 1] || null;
  }

  function getDeployCostMult(faction, wave) {
    let mult = 1;
    if (wave < EARLY_WAVE_CAP) mult *= EARLY_WAVE_COST_BONUS;
    for (const event of getSeasonalEvents()) {
      if (event.factions?.includes(faction) && event.bonus.dmg) mult *= 0.95;
    }
    return mult;
  }

  function countCrossoverUnits(units) {
    let n = 0;
    const byFaction = {};
    for (const u of units || []) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (!u.isCrossover && !u.isWwe && !u.isDoomslayer) continue;
      n++;
      const f = u.isWwe ? 'wwe' : u.isDoomslayer ? 'doom' : (getCrossoverDef?.(u.type)?.faction);
      if (f) byFaction[f] = (byFaction[f] || 0) + 1;
    }
    return { total: n, byFaction };
  }

  function computeSynergies(units) {
    const { byFaction } = countCrossoverUnits(units);
    const present = new Set(Object.keys(byFaction));
    const active = [];
    for (const syn of SYNERGIES) {
      const needs = syn.factions;
      if (syn.minFactions) {
        if (present.size >= syn.minFactions && needs.every(f => present.has(f))) active.push(syn);
        continue;
      }
      if (syn.requiresOtherFaction || syn.requiresWwe) {
        if (byFaction.wwe && present.size >= 2) active.push(syn);
        continue;
      }
      if (needs.every(f => present.has(f))) active.push(syn);
    }
    activeSynergies = active;
    return active;
  }

  function applySynergyToUnit(unit, synergies) {
    if (!unit || unit.team !== 'player') return;
    unit.synergyMelee = 0;
    unit.synergyAcc = 0;
    unit.synergyAbility = 0;
    unit.synergySiege = 0;
    unit.synergyMorale = 0;
    for (const s of synergies) {
      if (s.bonus.meleeDmg && !unit.projectile) unit.synergyMelee = (unit.synergyMelee || 0) + s.bonus.meleeDmg;
      if (s.bonus.rangedAcc && (unit.projectile || unit.combatType === 'ranged')) unit.synergyAcc = (unit.synergyAcc || 0) + s.bonus.rangedAcc;
      if (s.bonus.abilityDmg) unit.synergyAbility = (unit.synergyAbility || 0) + s.bonus.abilityDmg;
      if (s.bonus.siegeDmg) unit.synergySiege = (unit.synergySiege || 0) + s.bonus.siegeDmg;
    }
    const f = unit.isWwe ? 'wwe' : getCrossoverDef?.(unit.type)?.faction;
    for (const event of getSeasonalEvents()) {
      if (!f || !event.factions.includes(f)) continue;
      if (event.bonus.acc) unit.synergyAcc = (unit.synergyAcc || 0) + event.bonus.acc;
      if (event.bonus.dmg) unit.synergyMelee = (unit.synergyMelee || 0) + event.bonus.dmg;
      if (event.bonus.meleeDmg && !unit.projectile) unit.synergyMelee = (unit.synergyMelee || 0) + event.bonus.meleeDmg;
      if (event.bonus.abilityDmg) unit.synergyAbility = (unit.synergyAbility || 0) + event.bonus.abilityDmg;
      if (event.bonus.siegeDmg) unit.synergySiege = (unit.synergySiege || 0) + event.bonus.siegeDmg;
    }
  }

  function applyFieldBalance(unit, crossoverCount, vanillaCount) {
    if (!unit?.isCrossover && !unit?.isWwe) return;
    if (crossoverCount > FIELD_SOFT_CAP) {
      const over = crossoverCount - FIELD_SOFT_CAP;
      unit.fieldBalanceMult = Math.max(0.72, 1 - over * 0.03);
    } else {
      unit.fieldBalanceMult = 1;
    }
    if (vanillaCount >= crossoverCount && vanillaCount >= 4) {
      unit.vanillaSupportAura = 1.05;
    } else {
      unit.vanillaSupportAura = 1;
    }
  }

  function applyToUnit(unit, armyUnits) {
    if (!unit || unit.team !== 'player') return unit;
    const { total, byFaction } = countCrossoverUnits(armyUnits || ctx?.units || []);
    const vanilla = (armyUnits || ctx?.units || []).filter(u => u.team === 'player' && u.hp > 0 && !u.isCrossover && !u.isWwe && !u.isDoomslayer).length;
    applyFieldBalance(unit, total, vanilla);
    const syns = computeSynergies(armyUnits || ctx?.units || []);
    applySynergyToUnit(unit, syns);
    const faction = unit.isWwe ? 'wwe' : unit.isDoomslayer ? 'doom' : getCrossoverDef?.(unit.type)?.faction;
    const tier = faction ? getMasteryTier(faction) : 0;
    if (tier > 0 && (unit.isCrossover || unit.isWwe)) {
      unit.masteryTier = tier;
      unit.maxMorale = Math.min(45, unit.maxMorale + tier);
    }
    return unit;
  }

  function canBuildBarracks(buildType, wave, buildings, units) {
    const faction = Object.entries(CrossoverFactions || {}).find(([, f]) => f.building === buildType)?.[0];
    if (!faction) return { ok: true };
    const prof = PROFILES[faction];
    if (!prof) return { ok: true };
    const hamletCount = buildings.filter(b => b.isHamlet && b.complete && b.owner === 'player').length;
    if (prof.recommendedHamlets && hamletCount < prof.recommendedHamlets) {
      return {
        ok: true,
        warn: `${prof.label} works best with ${prof.recommendedHamlets}+ hamlet(s) — you have ${hamletCount}.`,
      };
    }
    return { ok: true };
  }

  function onWaveStart(units) {
    const syns = computeSynergies(units);
    for (const syn of syns) {
      if (syn.bonus.waveMorale) {
        for (const u of units) {
          if (u.team === 'player' && u.hp > 0) u.morale = Math.min(u.maxMorale, u.morale + syn.bonus.waveMorale);
        }
      }
    }
    for (const event of getSeasonalEvents()) {
      if (event.bonus.morale) {
        for (const u of units) {
          if (u.team !== 'player' || u.hp <= 0) continue;
          const f = u.isWwe ? 'wwe' : getCrossoverDef?.(u.type)?.faction;
          if (f && event.factions.includes(f)) u.morale = Math.min(u.maxMorale, u.morale + event.bonus.morale);
        }
      }
      if (event.bonus.moraleRegen) {
        for (const u of units) {
          if (u.team !== 'player' || u.hp <= 0) continue;
          const f = u.isWwe ? 'wwe' : getCrossoverDef?.(u.type)?.faction;
          if (f && event.factions.includes(f)) u.morale = Math.min(u.maxMorale, u.morale + event.bonus.moraleRegen);
        }
      }
    }
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0 || !u.isCrossover) continue;
      const ab = u.wweAbility;
      if (ab === 'spartan_rage' || ab === 'oorah') {
        units.filter(a => a.team === 'player' && a.hp > 0 && ctx.unitDistance(u, a) < 100)
          .forEach(a => { a.morale = Math.min(a.maxMorale, a.morale + 3); a.rallyTimer = Math.max(a.rallyTimer || 0, 60); });
        FloatingText?.status(u.x, u.y, ab === 'oorah' ? 'OORAH!' : 'SHIELDS UP', PROFILES.halo?.palette?.[0] || '#408040');
        playFactionSfx('halo');
      }
      if (ab === 'noble_leader') {
        units.filter(a => a.team === 'player' && a.isCrossover && getCrossoverDef?.(a.type)?.faction === 'halo' && ctx.unitDistance(u, a) < 90)
          .forEach(a => { a.damage = Math.floor(a.damage * 1.08); });
      }
      if (ab === 'tech_ops') {
        for (const e of units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (ctx.unitDistance(u, e) < 110) e.lanternBlind = Math.max(e.lanternBlind || 0, 30);
        }
      }
      if (ab === 'hokuto_kaioh') {
        for (const e of units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (ctx.unitDistance(u, e) < 100) e.morale = Math.max(0, e.morale - 2);
        }
      }
    }
    checkSynergyAchievements(syns, units);
  }

  function getLifetimeCrossoverStats() {
    try {
      const raw = localStorage.getItem('myth-and-blood-achievements-v3');
      if (!raw) return { kills: {}, abilities: {} };
      const data = JSON.parse(raw);
      return { kills: data.crossoverKills || {}, abilities: data.crossoverAbilities || {} };
    } catch (_) { return { kills: {}, abilities: {} }; }
  }

  function checkMasteryChallenges(wave, units, extras = {}) {
    const { byFaction } = countCrossoverUnits(units);
    const life = getLifetimeCrossoverStats();
    for (const ch of MASTERY_CHALLENGES) {
      if (sessionChallenges.has(ch.id)) continue;
      let ok = true;
      if (ch.wave != null && wave < ch.wave) ok = false;
      if (ch.minField != null && (byFaction[ch.faction] || 0) < ch.minField) ok = false;
      if (ch.flawless && (extras.misses ?? 0) > 0) ok = false;
      if (ch.kills != null && (life.kills[ch.faction] || 0) < ch.kills) ok = false;
      if (ch.abilities != null && (life.abilities[ch.faction] || 0) < ch.abilities) ok = false;
      if (ch.flag === 'jojo_cavalry') {
        const p7 = (units || []).filter(u => {
          const d = getCrossoverDef?.(u.type);
          return u.team === 'player' && u.hp > 0 && d?.jojoPart === 7 && d?.combatTag === 'cavalry';
        }).length;
        if (p7 < 2) ok = false;
      }
      if (!ok) continue;
      sessionChallenges.add(ch.id);
      ctx?.ach?.('crossover_mastery_challenge', { challenge: ch.id, faction: ch.faction });
      const prof = PROFILES[ch.faction];
      ctx?.showMessage?.(`${prof?.label || ch.faction} mastery: ${ch.name} — +25 mastery`, 360);
    }
  }

  function checkSynergyAchievements(syns, units) {
    if (!ctx?.ach) return;
    for (const s of syns) ctx.ach('faction_synergy', { synergy: s.id });
    if (syns.length >= 2) ctx.ach('faction_synergy_multi', { count: syns.length });
    const fourWorld = syns.find(s => s.id === 'multiversal_4');
    if (fourWorld) ctx.ach('multiversal_synergy', { count: 4 });
    const { byFaction } = countCrossoverUnits(units);
    const fc = Object.keys(byFaction).length;
    if (fc >= 3) ctx.ach('multiversal_check', { count: fc });
  }

  function playFactionSfx(faction) {
    AudioEngine?.SFX?.factionPulse?.(faction);
  }

  function procAbilityVfx(unit, label, color) {
    if (!unit) return;
    FloatingText?.status(unit.x, unit.y - 10, label, color || '#ffd700');
    const f = unit.isWwe ? 'wwe' : getCrossoverDef?.(unit.type)?.faction;
    if (f) playFactionSfx(f);
  }

  function modifyDamage(unit, target, dmg) {
    let d = dmg;
    if (unit.synergyMelee) d = Math.round(d * (1 + unit.synergyMelee));
    if (unit.synergyAbility && unit.wweAbility) d = Math.round(d * (1 + unit.synergyAbility));
    if (unit.fieldBalanceMult) d = Math.round(d * unit.fieldBalanceMult);
    if (unit.vanillaSupportAura) d = Math.round(d * unit.vanillaSupportAura);
    const synSiege = unit.synergySiege || 0;
    if (synSiege && (target?.type === 'siege_tower' || target?.siegeDeployed)) d = Math.round(d * (1 + synSiege));

    const counter = ENEMY_COUNTERS[target?.type];
    if (counter && unit.isCrossover) {
      const f = getCrossoverDef?.(unit.type)?.faction;
      if (counter.weakFactions.includes(f)) d = Math.round(d / counter.mult);
    }

    if (unit.wweAbility === 'lone_wolf') {
      const allies = ctx.units.filter(a => a.team === 'player' && a.hp > 0 && a.id !== unit.id && ctx.unitDistance(unit, a) < 80).length;
      if (allies === 0) d = Math.round(d * 1.35);
    }
    if (unit.wweAbility === 'demon_back' && unit.hp / unit.maxHp < 0.5) d = Math.round(d * 1.4);
    if (unit.wweAbility === 'galick_gun' && isEliteEnemy?.(target)) d = Math.round(d * 1.25);
    if (unit.wweAbility === 'anduril' && (target?.type === 'dark_knight' || isEliteEnemy?.(target))) d = Math.round(d * 1.3);
    if (unit.wweAbility === 'elven_archer' && (target?.speed > 1 || target?.flying)) d = Math.round(d * 1.2);
    return d;
  }

  function processAbilityHit(unit, target, dmg) {
    if (!unit || !ctx) return;
    const ab = unit.wweAbility;
    const synMult = 1 + (unit.synergyAbility || 0);

    const handlers = {
      frag_out() {
        let splash = 0;
        for (const e of ctx.units) {
          if (e.team !== 'enemy' || e.hp <= 0 || e.id === target.id) continue;
          if (ctx.unitDistance(target, e) < 50) { ctx.takeDamage(e, Math.round(dmg * 0.35 * synMult)); splash++; }
        }
        if (splash >= 2) procAbilityVfx(unit, 'FRAG!', '#c06030');
      },
      apothicon_slam() {
        if (target.hp <= 0) {
          for (const e of ctx.units) {
            if (e.team !== 'enemy' || e.hp <= 0) continue;
            if (ctx.unitDistance(target, e) < 45) ctx.takeDamage(e, Math.round(dmg * 0.4));
          }
          procAbilityVfx(unit, 'SLAM', '#d07040');
        }
      },
      iron_curtain() {
        if (unit.hp / unit.maxHp < 0.35 && (unit.ironCurtainCd || 0) <= 0) {
          unit.ironCurtainCd = 200;
          unit.rallyTimer = 90;
          procAbilityVfx(unit, 'CURTAIN', '#5080a0');
        }
      },
      energy_sword() {
        if (target.hp / target.maxHp < 0.45) ctx.takeDamage(target, Math.round(dmg * 0.8), { crit: true });
      },
      grenadier() {
        unit.grenadeCount = (unit.grenadeCount || 0) + 1;
        if (unit.grenadeCount % 3 === 0) {
          ctx.damageInRadius(target.x, target.y, 45, Math.round(dmg * 0.5), 'player');
          procAbilityVfx(unit, 'SPLASH', '#705030');
        }
      },
      sniper_cover() {
        if (isEliteEnemy?.(target)) ctx.takeDamage(target, Math.round(dmg * 0.45));
      },
      tech_head() {
        if (target?.type === 'siege_tower' || target?.siegeDeployed) ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      cole_train() {
        if (unit.chargeTimer > 30) ctx.takeDamage(target, Math.round(dmg * 0.35));
      },
      axe_cleave() {
        if (target?.type === 'siege_tower') ctx.damageInRadius(target.x, target.y, 40, Math.round(dmg * 0.4), 'player');
      },
      you_shall_not_pass() {
        for (const e of ctx.units) {
          if (e.team !== 'enemy' || e.hp <= 0) continue;
          if (ctx.unitDistance(unit, e) < 80) e.morale = Math.max(0, e.morale - 3);
        }
        procAbilityVfx(unit, 'YOU SHALL NOT PASS', '#c0c0e0');
      },
      ring_bearer() {
        if (Math.random() < 0.2) return;
        ctx.units.filter(a => a.team === 'player' && ctx.unitDistance(unit, a) < 70)
          .forEach(a => { a.morale = Math.min(a.maxMorale, a.morale + 1); });
      },
      horn_of_gondor() {
        const foes = ctx.units.filter(e => e.team === 'enemy' && e.hp > 0 && ctx.unitDistance(unit, e) < 60).length;
        if (foes >= 3) {
          unit.rallyTimer = 120;
          procAbilityVfx(unit, 'HORN!', '#704030');
        }
      },
      no_man() {
        if (isEliteEnemy?.(target) && target.hp / target.maxHp < 0.5) ctx.takeDamage(target, Math.round(dmg * 1.2), { crit: true });
      },
      ogre() {
        if (target.maxHp > 200) ctx.takeDamage(target, Math.round(dmg * 0.4));
      },
      bite() {
        if (target.maxHp > unit.maxHp * 1.2) ctx.takeDamage(target, Math.round(dmg * 0.35));
      },
      iron_body() {
        if (unit.hp / unit.maxHp < 0.6) unit.rallyTimer = Math.max(unit.rallyTimer || 0, 30);
      },
      hamon_overdrive() {
        if (target?.type === 'necromancer' || target?.type === 'bone_summoner') ctx.takeDamage(target, Math.round(dmg * 0.55));
      },
      vaporization_freeze() {
        target.hazardSlow = Math.min(target.hazardSlow || 1, 0.6);
        target.morale = Math.max(0, target.morale - 2);
      },
      sunlight_yellow() {
        if (target.hp <= 0 && isEliteEnemy?.(target)) {
          const ally = ctx.units.find(a => a.team === 'player' && a.hp > 0 && a.hp < a.maxHp && ctx.unitDistance(unit, a) < 100);
          if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + 20);
        }
      },
      hermit_purple() {
        if (Math.random() < 0.15) target.lanternBlind = Math.max(target.lanternBlind || 0, 25);
      },
      bubble_cutter() {
        if (Math.random() < 0.2) ctx.takeDamage(target, Math.round(dmg * 0.6), { crit: true });
      },
      german_science() {
        if (target?.type === 'siege_tower') ctx.takeDamage(target, Math.round(dmg * 0.45));
      },
      star_platinum() {
        if (target.pinned) ctx.takeDamage(target, Math.round(dmg * 0.7), { crit: true });
      },
      hierophant_green() {
        ctx.damageInRadius(target.x, target.y, 35, Math.round(dmg * 0.3), 'player');
      },
      silver_chariot() {
        if (target.hp / target.maxHp < 0.4) ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      magicians_red() {
        Particles?.explosion(target.x, target.y);
        ctx.damageInRadius(target.x, target.y, 30, Math.round(dmg * 0.25), 'player');
      },
      crazy_diamond() {
        const ally = ctx.units.find(a => a.team === 'player' && a.hp > 0 && a.hp < a.maxHp * 0.9 && ctx.unitDistance(unit, a) < 50);
        if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + 6);
      },
      the_hand() {
        ctx.takeDamage(target, Math.round(dmg * 0.25));
      },
      heavens_door() {
        target.lanternBlind = Math.max(target.lanternBlind || 0, 35);
      },
      killer_queen() {
        if (target.hp / target.maxHp < 0.35) ctx.takeDamage(target, Math.round(dmg * 0.9), { crit: true });
      },
      gold_experience() {
        if (target.hp <= 0) {
          const ally = ctx.units.find(a => a.team === 'player' && a.hp > 0 && a.hp < a.maxHp);
          if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + 12);
        }
      },
      sticky_fingers() {
        unit.rallyTimer = Math.max(unit.rallyTimer || 0, 40);
      },
      sex_pistols() {
        const extra = ctx.units.find(e => e.team === 'enemy' && e.hp > 0 && e.id !== target.id && ctx.unitDistance(target, e) < 40);
        if (extra) ctx.takeDamage(extra, Math.round(dmg * 0.35));
      },
      king_crimson() {
        if (target.hp / target.maxHp < 0.3) ctx.takeDamage(target, target.hp * 0.5, { crit: true });
      },
      stone_free() {
        target.hazardSlow = Math.min(target.hazardSlow || 1, 0.5);
      },
      weather_stand() {
        ctx.damageInRadius(target.x, target.y, 50, Math.round(dmg * 0.35), 'player');
        Particles?.lightning(target.x, target.y);
      },
      kiss() {
        if (target.hp <= 0 && isEliteEnemy?.(target)) unit.damage = Math.floor(unit.damage * 1.05);
      },
      tusk_act4() {
        if (unit.chargeTimer > 40) ctx.takeDamage(target, Math.round(dmg * 1.1), { crit: true });
      },
      steel_ball() {
        if (unit.chargeTimer > 25) ctx.damageInRadius(target.x, target.y, 35, Math.round(dmg * 0.4), 'player');
      },
      scary_monsters() {
        if (unit.chargeTimer > 20) ctx.takeDamage(target, Math.round(dmg * 0.45));
      },
      hidan_shinken() {
        if (target.hp / target.maxHp < 0.35) ctx.takeDamage(target, Math.round(dmg * 1.5), { crit: true });
      },
      hakke_shou() {
        ctx.units.filter(a => a.team === 'player' && a.hp > 0 && ctx.unitDistance(unit, a) < 90)
          .forEach(a => a.hp = Math.min(a.maxHp, a.hp + 2));
      },
      nanto_suicho() {
        const extra = ctx.units.filter(e => e.team === 'enemy' && e.hp > 0 && e.id !== target.id && ctx.unitDistance(target, e) < 35);
        if (extra.length) extra.forEach(e => ctx.takeDamage(e, Math.round(dmg * 0.2)));
      },
      dirty_tricks() {
        target.morale = Math.max(0, target.morale - 3);
      },
      kamehameha() {
        const foes = ctx.units.filter(e => e.team === 'enemy' && e.hp > 0 && ctx.unitDistance(unit, e) < 70).length;
        if (foes >= 3) {
          ctx.damageInRadius(unit.x, unit.y, 60, Math.round(dmg * 0.8), 'player');
          procAbilityVfx(unit, 'KAMEHAMEHA', '#e06040');
        }
      },
      special_beam() {
        if (target.maxHp > 180) ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      hidden_potential() {
        if (unit.hp / unit.maxHp < 0.4) ctx.takeDamage(target, Math.round(dmg * 0.5), { crit: true });
      },
      burning_attack() {
        if (target.hp / target.maxHp < 0.4) ctx.takeDamage(target, Math.round(dmg * 0.55), { crit: true });
      },
      death_beam() {
        if (target.hp / target.maxHp < 0.5) ctx.takeDamage(target, Math.round(dmg * 0.65));
      },
      perfect_form() {
        if (target.hp <= 0) unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(unit.maxHp * 0.08));
      },
      hakai() {
        if (target.hp / target.maxHp < 0.25) ctx.takeDamage(target, Math.max(dmg * 2, target.hp * 0.6), { crit: true });
      },
      carmine_curse() {
        if (unit.hp / unit.maxHp < 0.3 && Math.random() < 0.1) unit.hp = Math.max(1, unit.hp - 10);
      },
      heavy_lancer() {
        const nearby = ctx.units.filter(e => e.team === 'enemy' && e.hp > 0 && ctx.unitDistance(target, e) < 45).length;
        if (nearby >= 2) ctx.takeDamage(target, Math.round(dmg * 0.25));
      },
      vodka_rage() {
        if (unit.hp / unit.maxHp < 0.45) unit.rallyTimer = Math.max(unit.rallyTimer || 0, 40);
      },
      wunderwaffe() {
        if (isEliteEnemy?.(target)) ctx.takeDamage(target, Math.round(dmg * 0.4 * synMult));
      },
      bushido() {
        const stars = ctx.getStarCount?.(unit) ?? 0;
        if (stars >= 3 && Math.random() < 0.25) ctx.takeDamage(target, Math.round(dmg * 0.6), { crit: true });
      },
      katana_fury() {
        if (target.hp / target.maxHp < 0.5) ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      summoning_key() {
        if (isEliteEnemy?.(target) && target.hp > 0) {
          unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(dmg * 0.5));
        }
      },
      spartan_rage() {
        if (target.team === 'enemy') {
          ctx.units.filter(a => a.team === 'player' && a.hp > 0 && ctx.unitDistance(unit, a) < 90)
            .forEach(a => { a.morale = Math.min(a.maxMorale, a.morale + 1); });
        }
      },
      oorah() {
        if (target.team === 'enemy') {
          ctx.units.filter(a => a.team === 'player' && a.hp > 0 && ctx.unitDistance(unit, a) < 110)
            .forEach(a => { a.rallyTimer = Math.max(a.rallyTimer || 0, 50); });
        }
      },
      lancer_burst() {
        if (target.hp / target.maxHp < 0.3) ctx.takeDamage(target, Math.round(target.hp * 0.7), { crit: true });
      },
      brothers_in_arms() {
        const marcus = ctx.units.find(u => u.type === 'marcus_fenix' && u.hp > 0 && ctx.unitDistance(unit, u) < 100);
        if (marcus) marcus.hp = Math.min(marcus.maxHp, marcus.hp + 8);
      },
      carmine_brother() {
        ctx.units.filter(u => u.type?.includes('carmine') && u.hp > 0 && ctx.unitDistance(unit, u) < 90)
          .forEach(c => { c.accuracy = Math.min(95, c.accuracy + 2); });
      },
      stunner() {
        if (isEliteEnemy?.(target)) ctx.takeDamage(target, Math.round(dmg * 0.5));
      },
      f5() {
        if (target.hp / target.maxHp < 0.35) ctx.takeDamage(target, target.hp);
      },
      go_to_sleep() {
        if (target.hp / target.maxHp < 0.3) ctx.takeDamage(target, Math.round(target.hp * 0.8));
      },
      lie_cheat_steal() {
        if (isEliteEnemy?.(target) && target.hp <= 0) ctx.addTactical?.(3);
      },
      woo() {
        ctx.units.filter(u => u.team === 'player' && u.hp > 0 && ctx.unitDistance(unit, u) < 100)
          .forEach(a => { a.morale = Math.min(a.maxMorale, a.morale + 1); });
      },
      hulk_up() {
        if (unit.hp / unit.maxHp < 0.4) unit.hp = Math.min(unit.maxHp, unit.hp + 30);
      },
      rko() {
        if (target.team === 'enemy' && target.hp > 0 && target.hp / target.maxHp < 0.45) {
          ctx.takeDamage(target, Math.max(target.hp * 0.85, dmg * 2.2), { crit: true });
          FloatingText?.status(target.x, target.y, 'RKO!', '#5080c0');
          AudioEngine?.SFX?.factionFinisher?.();
        }
      },
      lantern() {
        if (target.team === 'enemy') {
          const light = ctx.getDayLight?.() ?? 1;
          target.lanternBlind = Math.max(target.lanternBlind || 0, 40 + Math.floor((1 - light) * 30));
        }
      },
    };

    if (ab && handlers[ab]) handlers[ab]();

    const syns = activeSynergies;
    const killHeal = syns.find(s => s.bonus.killHeal);
    if (killHeal && target.hp <= 0 && unit.isCrossover) {
      const ally = ctx.units.find(a => a.team === 'player' && a.hp > 0 && a.hp < a.maxHp);
      if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + killHeal.bonus.killHeal);
    }
  }

  function onBarracksComplete(b) {
    const faction = b.crossoverFaction;
    const prof = PROFILES[faction];
    if (prof) {
      ctx?.showMessage?.(`${prof.label} HQ operational — ${prof.identity}`, 340);
      FloatingText?.status(b.x, b.y - 18, prof.label.split('/')[0].trim(), prof.palette[0]);
      playFactionSfx(faction);
    }
  }

  function patchBuildDefs() {
    for (const [fid, prof] of Object.entries(PROFILES)) {
      if (!prof.building || typeof BuildDefs === 'undefined') continue;
      const def = BuildDefs[prof.building];
      if (!def) continue;
      if (fid !== 'wwe') {
        def.cost = STANDARD_BARRACKS_COST;
        def.requiresBuilders = prof.requiresBuilders || STANDARD_BARRACKS_BUILDERS;
      }
      if (prof.recommendedHamlets) def.recommendedHamlets = prof.recommendedHamlets;
      def.factionTheme = prof.label;
      def.factionLore = prof.lore;
    }
  }

  /** Audit parity across crossover factions (barracks, mastery, seasonal, synergies, counters). */
  function auditFairRepresentation() {
    const factions = Object.keys(CrossoverFactions || {});
    const synergyCount = {};
    for (const f of factions) synergyCount[f] = 0;
    for (const s of SYNERGIES) {
      for (const f of s.factions) {
        if (synergyCount[f] != null) synergyCount[f]++;
      }
    }
    const issues = [];
    for (const f of factions) {
      const prof = PROFILES[f];
      const def = prof?.building ? BuildDefs?.[prof.building] : null;
      if (def && (def.cost !== STANDARD_BARRACKS_COST || def.requiresBuilders !== STANDARD_BARRACKS_BUILDERS)) {
        issues.push(`${f}: barracks cost/builders not normalized`);
      }
      if (!MASTERY_CHALLENGES.some(c => c.faction === f)) issues.push(`${f}: missing mastery challenge`);
      if (!SEASONAL_EVENTS.some(e => e.factions.includes(f))) issues.push(`${f}: missing seasonal event`);
      if ((synergyCount[f] || 0) < 2) issues.push(`${f}: fewer than 2 synergies`);
      const inCounter = Object.values(ENEMY_COUNTERS).some(c => c.weakFactions.includes(f));
      if (!inCounter) issues.push(`${f}: missing enemy counter matchup`);
    }
    return { ok: issues.length === 0, issues, synergyCount };
  }

  function getEncyclopediaEntries() {
    const entries = [
      { cat: 'crossover_meta', name: 'Faction Mastery', body: 'Earn mastery points from crossover kills, ability procs, and wave clears. Tiers unlock titles shown in Crossover HQ. Mastery never replaces vanilla troops — it rewards dedication.' },
      { cat: 'crossover_meta', name: 'Cross-Faction Synergies', body: SYNERGIES.map(s => `${s.name}: ${s.desc}`).join(' ') },
      { cat: 'crossover_meta', name: 'Balance Philosophy', body: `Crossover operatives are powerful but not mandatory. Fielding more than ${FIELD_SOFT_CAP} crossover units incurs a soft damage penalty. Keeping vanilla troops ≥ crossover count grants a small support bonus. Barracks and recruits are available from wave 1 once unlocked.` },
      { cat: 'crossover_meta', name: 'Seasonal Events', body: SEASONAL_EVENTS.map(e => `${e.name} (${e.months.join('/')}): ${e.desc}`).join(' ') },
    ];
    for (const [id, prof] of Object.entries(PROFILES)) {
      if (id === 'doom' || id === 'wwe') continue;
      entries.push({
        cat: `crossover_${id}`,
        name: `${prof.label} — Faction Profile`,
        body: `${prof.lore}\n\nIdentity: ${prof.identity}\n\nWeakness: ${prof.weakness}\n\nPlaystyle: ${prof.playstyle}`,
      });
    }
    return entries;
  }

  function getCreativeUnlocks() {
    const unlocks = [];
    for (const fid of Object.keys(PROFILES)) {
      if (getMasteryTier(fid) >= 3) unlocks.push(`title_${fid}`);
      if (getMasteryTier(fid) >= 4) unlocks.push(`creative_skin_${fid}`);
    }
    return unlocks;
  }

  patchBuildDefs();

  return {
    PROFILES, SYNERGIES, SEASONAL_EVENTS, MASTERY_CHALLENGES, ENEMY_COUNTERS,
    STANDARD_BARRACKS_COST, STANDARD_BARRACKS_BUILDERS,
    bind, onGameStart, getProfile, getSeasonalEvent, getSeasonalEvents, getMasteryPoints, getMasteryTier, getMasteryTitle,
    auditFairRepresentation,
    getDeployCostMult, computeSynergies, applyToUnit, applyFieldBalance,
    canBuildBarracks, onWaveStart, processAbilityHit, modifyDamage,
    onBarracksComplete, playFactionSfx, getEncyclopediaEntries, getCreativeUnlocks,
    checkMasteryChallenges,
    getActiveSynergies: () => activeSynergies,
    FIELD_SOFT_CAP,
  };
})();