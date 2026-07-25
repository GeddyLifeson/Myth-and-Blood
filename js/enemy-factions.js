/**
 * Enemy Faction Evolution — each major hostile archetype follows a 4-stage track:
 *   Stage 1: Basic grunts
 *   Stage 2: Elites + named sub-bosses
 *   Stage 3: Structures (outposts → quarries → hamlets)
 *   Stage 4: Full settlements + counter-raids on player territory
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
      name: 'Void / Abyssal',
      shortName: 'Void',
      color: '#7040b0',
      waveMin: 32,
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

  const UNIT_FACTION = {};
  for (const f of Object.values(FACTIONS)) {
    for (const tier of f.tiers) {
      for (const u of tier.units) {
        if (!UNIT_FACTION[u]) UNIT_FACTION[u] = f.id;
      }
      for (const u of tier.elites || []) {
        if (!UNIT_FACTION[u]) UNIT_FACTION[u] = f.id;
      }
    }
  }
  Object.assign(UNIT_FACTION, {
    goblin: 'goblin_hordes',
    plague_rat: 'goblin_hordes',
    goblin_sapper: 'goblin_hordes',
    goblin_burrower: 'goblin_hordes',
    goblin_engineer: 'goblin_hordes',
    harpy: 'goblin_hordes',
    orc: 'orc_warbands',
    orc_archer: 'orc_warbands',
    warg_rider: 'orc_warbands',
    berserker: 'orc_warbands',
    troll: 'orc_warbands',
    war_chief: 'orc_warbands',
    iron_colossus: 'orc_warbands',
    dark_knight: 'dark_legions',
    dark_mage: 'dark_legions',
    necromancer: 'dark_legions',
    bone_summoner: 'dark_legions',
    shaman: 'dark_legions',
    assassin: 'dark_legions',
    grim_revenant: 'dark_legions',
    dreadborn_champion: 'dark_legions',
    void_stalker: 'void_abyssal',
    umbral_stalker: 'void_abyssal',
    abomination: 'void_abyssal',
    behemoth: 'void_abyssal',
    elder_wyrm: 'void_abyssal',
    cinderbound_juggernaut: 'void_abyssal',
    siege_tower: 'orc_warbands',
    sky_drake: 'void_abyssal',
    hellbound_legionnaire: 'dark_legions',
    nightmare_strider: 'void_abyssal',
    warp_prophet: 'dark_legions',
    hellmortar_pack: 'orc_warbands',
    boss_gorath: 'orc_warbands',
    boss_thokk: 'orc_warbands',
    boss_karg: 'orc_warbands',
    boss_volk: 'orc_warbands',
    boss_morwen: 'dark_legions',
    boss_grimm: 'dark_legions',
    boss_rotfather: 'dark_legions',
    boss_malachar: 'void_abyssal',
    boss_vexis: 'void_abyssal',
    boss_sylvara: 'void_abyssal',
  });

  const BUILDING_FACTION = {
    enemy_trade_outpost: 'goblin_hordes',
    enemy_quarry: 'goblin_hordes',
    enemy_hamlet: 'mirror_empires',
    enemy_merchant_guild: 'mirror_empires',
    enemy_shadow_academy: 'dark_legions',
    enemy_war_academy: 'mirror_empires',
  };

  const SETTLEMENT_BUILDINGS = new Set([
    'enemy_hamlet',
    'enemy_merchant_guild',
    'enemy_shadow_academy',
    'enemy_war_academy',
  ]);
  const OUTPOST_BUILDINGS = new Set(['enemy_trade_outpost', 'enemy_quarry']);

  let announcedTiers = new Set();

  function resetRun() {
    announcedTiers = new Set();
  }

  function getEvolutionStageDef(stage) {
    return EVOLUTION_STAGES[stage] || null;
  }

  function getFactionDef(id) {
    return FACTIONS[id] || null;
  }

  function getFactionTier(factionId, wave) {
    const f = FACTIONS[factionId];
    if (!f || wave < f.waveMin) return null;
    const effWave =
      typeof FactionReputation !== 'undefined'
        ? FactionReputation.getEffectiveWaveForTier(factionId, wave)
        : wave;
    let tier = f.tiers[0];
    for (const t of f.tiers) {
      if (effWave >= t.waveMin) tier = t;
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
      .filter(
        (f) => !(typeof PlanetConquest !== 'undefined' && PlanetConquest.isFactionEliminated(f.id))
      )
      .map((f) => ({
        ...f,
        currentTier: getFactionTier(f.id, wave),
      }))
      .filter((f) => f.currentTier);
  }

  function getUnitFaction(type) {
    return UNIT_FACTION[type] || null;
  }

  function getBuildingFaction(type) {
    return BUILDING_FACTION[type] || null;
  }

  function unitExists(type) {
    return typeof EnemyDefs === 'undefined' || !!EnemyDefs[type];
  }

  function enrichPool(pool, wave) {
    const merged = [...(pool || [])];
    const seen = new Set(merged);
    for (const f of getActiveFactions(wave)) {
      const tier = f.currentTier;
      const add = [...tier.units, ...(tier.elites || [])];
      for (const u of add) {
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

  function mergeFactionWeights(wave, baseWeights = {}) {
    const out = { ...baseWeights };
    for (const f of getActiveFactions(wave)) {
      const tier = f.currentTier;
      const mods =
        typeof PlayerCounterEvolution !== 'undefined'
          ? PlayerCounterEvolution.getFactionModifiers(f.id, wave)
          : { spawnMult: 1 };
      const rep =
        typeof FactionReputation !== 'undefined'
          ? FactionReputation.getFactionModifiers(f.id, wave)
          : { spawnMult: 1 };
      const weighted = [...tier.units, ...(tier.elites || [])];
      for (const u of weighted) {
        if (!unitExists(u)) continue;
        const eliteBoost = tier.elites?.includes(u) ? 1.12 : 1;
        out[u] = Math.max(
          out[u] || 1,
          tier.weight * eliteBoost * (mods.spawnMult || 1) * (rep.spawnMult || 1)
        );
      }
    }
    return out;
  }

  function biasSpawnQueue(queue, wave, rng = Math.random) {
    if (!queue?.length || wave < 4) return queue;
    const out = [...queue];
    for (const f of getActiveFactions(wave)) {
      const tier = f.currentTier;
      const biasPool =
        tier.stage >= 2 && tier.elites?.length ? [...tier.units, ...tier.elites] : tier.units;
      const slots = Math.max(
        1,
        Math.floor(out.length * 0.05 * (tier.weight - 0.9) * (1 + tier.stage * 0.08))
      );
      for (let i = 0; i < slots; i++) {
        const unit = biasPool[Math.floor(rng() * biasPool.length)];
        if (!unit || !unitExists(unit)) continue;
        out[Math.floor(rng() * out.length)] = unit;
      }
    }
    return out;
  }

  function injectSubBosses(queue, wave, rng = Math.random) {
    if (!queue?.length || wave < 8) return queue;
    const out = [...queue];
    let injected = 0;
    for (const f of getActiveFactions(wave)) {
      const tier = f.currentTier;
      if (tier.stage < 2 || !tier.subBosses?.length) continue;
      if (wave % 10 === 0) continue;
      if (injected >= 2) break;
      const mods =
        typeof PlayerCounterEvolution !== 'undefined'
          ? PlayerCounterEvolution.getFactionModifiers(f.id, wave)
          : { spawnMult: 1 };
      const rep =
        typeof FactionReputation !== 'undefined'
          ? FactionReputation.getFactionModifiers(f.id, wave)
          : { spawnMult: 1, eliteChanceMult: 1 };
      let chance = tier.stage >= 4 ? 0.24 : tier.stage >= 3 ? 0.16 : 0.09;
      chance *= (mods.spawnMult || 1) * (rep.eliteChanceMult || 1);
      if (rng() > chance) continue;
      const boss = tier.subBosses[Math.floor(rng() * tier.subBosses.length)];
      if (!boss || !unitExists(boss)) continue;
      out[Math.floor(rng() * out.length)] = boss;
      injected++;
    }
    return out;
  }

  function biasHordeQueue(queue, wave, rng = Math.random) {
    if (!queue?.length) return queue;
    const tier = getFactionTier('goblin_hordes', wave);
    if (!tier) return queue;
    const goblinUnits = tier.units.filter((u) =>
      ['goblin', 'plague_rat', 'goblin_sapper', 'goblin_burrower', 'goblin_engineer'].includes(u)
    );
    if (!goblinUnits.length) return queue;
    const bias = tier.stage >= 3 ? 0.34 : tier.stage >= 2 ? 0.3 : 0.26;
    return queue.map((t) => {
      if (rng() < bias) return goblinUnits[Math.floor(rng() * goblinUnits.length)];
      return t;
    });
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
      .map((f) => `${f.shortName} S${f.currentTier.stage}`)
      .join(' · ');
  }

  function pickFactionBuilding(factionId, wave, opts = {}) {
    const tier = getFactionTier(factionId, wave);
    if (!tier?.buildings?.length) return null;
    const economicFocus =
      opts.economicFocus ||
      (typeof FactionReputation !== 'undefined' &&
        FactionReputation.getFactionModifiers(factionId, wave).economicFocus);
    if (economicFocus) {
      const trade = tier.buildings.filter(
        (t) => t === 'enemy_trade_outpost' || t === 'enemy_quarry'
      );
      if (trade.length && Math.random() < 0.82) {
        return trade[Math.floor(Math.random() * trade.length)];
      }
    }
    if (tier.stage >= 4) {
      const settlements = tier.buildings.filter((t) => SETTLEMENT_BUILDINGS.has(t));
      if (settlements.length && Math.random() < 0.58) {
        return settlements[Math.floor(Math.random() * settlements.length)];
      }
    }
    if (tier.stage === 3) {
      const outposts = tier.buildings.filter((t) => OUTPOST_BUILDINGS.has(t));
      if (outposts.length && Math.random() < 0.72) {
        return outposts[Math.floor(Math.random() * outposts.length)];
      }
      const hamlets = tier.buildings.filter((t) => t === 'enemy_hamlet');
      if (hamlets.length && wave >= tier.waveMin + 12) {
        return hamlets[0];
      }
    }
    return tier.buildings[Math.floor(Math.random() * tier.buildings.length)];
  }

  function updateFactionKingdoms(wave, buildings, tryPlaceFn, opts = {}) {
    if (!tryPlaceFn || wave < 10) return 0;
    const capBonus = opts.capBonus || 0;
    const intervalMult = opts.intervalMult || 1;
    const forceStage3 = !!opts.forceStage3;
    let placed = 0;
    for (const f of getActiveFactions(wave)) {
      const tier = f.currentTier;
      const mods =
        typeof PlayerCounterEvolution !== 'undefined'
          ? PlayerCounterEvolution.getFactionModifiers(f.id, wave)
          : { stagePenalty: 0, skipBuilding: false };
      const rep =
        typeof FactionReputation !== 'undefined'
          ? FactionReputation.getFactionModifiers(f.id, wave)
          : { buildingCapDelta: 0, buildingIntervalMult: 1, economicFocus: false };
      if (mods.skipBuilding) continue;
      const stage = forceStage3 ? Math.max(3, tier.stage) : tier.stage;
      const effStage =
        typeof PlayerCounterEvolution !== 'undefined'
          ? PlayerCounterEvolution.getEffectiveStage(f.id, wave, stage)
          : stage;
      const buildStage = rep.economicFocus ? Math.max(2, effStage) : effStage;
      if (buildStage < 3 || !tier.buildings?.length || !tier.buildingCap) continue;
      const count = countFactionBuildings(buildings, f.id);
      const cap = Math.max(
        0,
        tier.buildingCap + capBonus + (rep.buildingCapDelta || 0) - (mods.stagePenalty || 0)
      );
      if (count >= cap) continue;
      const interval = Math.max(
        3,
        Math.floor((tier.buildInterval || 10) * intervalMult * (rep.buildingIntervalMult || 1))
      );
      if (wave % interval !== 0) continue;
      const type = pickFactionBuilding(f.id, wave, { economicFocus: rep.economicFocus });
      if (!type) continue;
      if (tryPlaceFn(type, f.id)) placed++;
    }
    return placed;
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
      const rep =
        typeof FactionReputation !== 'undefined'
          ? FactionReputation.getFactionModifiers(f.id, wave)
          : { counterRaidMult: 1 };
      if ((rep.counterRaidMult || 1) < 0.55 && rng() > rep.counterRaidMult) continue;
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

  function checkTierAnnouncements(wave, hooks = {}) {
    const { showMessage, addHighlight, floatingText, worldW, worldH } = hooks;
    for (const f of getActiveFactions(wave)) {
      const tier = f.currentTier;
      const key = `${f.id}:${tier.tier}`;
      if (announcedTiers.has(key)) continue;
      // Reputation can delay tiers so wave !== waveMin forever — announce on first active sighting.
      announcedTiers.add(key);
      const stageName = tier.stageLabel || tier.label;
      addHighlight?.('host', `${f.name} — Stage ${tier.stage}`);
      showMessage?.(
        `Host evolves — ${f.name} reach Stage ${tier.stage} (${stageName}): ${tier.tagline}`,
        400
      );
      floatingText?.(worldW / 2, 72, `${f.shortName.toUpperCase()} STAGE ${tier.stage}`, f.color);
      if (tier.counterRaids) {
        showMessage?.(
          `${f.shortName} kingdom active — counter-raids may strike your settlements.`,
          320
        );
      }
    }
  }

  const BUILDING_LABELS = {
    enemy_trade_outpost: 'Enemy Trade Outpost',
    enemy_quarry: 'Enemy Quarry',
    enemy_hamlet: 'Enemy Hamlet',
    enemy_merchant_guild: 'Enemy Merchant Guild',
    enemy_shadow_academy: 'Enemy Shadow Academy',
    enemy_war_academy: 'Enemy War Academy',
  };

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

  function formatBuildingList(types) {
    if (!types?.length) return '—';
    return types.map((t) => BUILDING_LABELS[t] || t.replace(/_/g, ' ')).join(', ');
  }

  function formatStageMechanics(tier) {
    const lines = [];
    if (tier.elites?.length) {
      lines.push('Elite units receive +12% spawn weight vs grunts in the same tier.');
    }
    if (tier.subBosses?.length) {
      const chance = tier.stage >= 4 ? '24%' : tier.stage >= 3 ? '16%' : '9%';
      lines.push(
        `Named sub-bosses (${formatUnitList(tier.subBosses)}) may replace a spawn on non-boss waves (~${chance} chance per active faction, up to 2 per wave).`
      );
    }
    if (tier.buildings?.length) {
      lines.push(
        `Northern builds unlock at this tier (wave ≥10): up to ${tier.buildingCap} holds, one attempt every ${tier.buildInterval} waves while under cap.`
      );
      if (tier.stage === 3)
        lines.push(
          'Stage 3 favors trade posts and quarries; hamlets appear later in the tier band.'
        );
      if (tier.stage >= 4)
        lines.push('Stage 4 favors full settlements — hamlets, guilds, and academies when listed.');
    }
    if (tier.counterRaids) {
      lines.push(
        `Counter-raids fire every ${tier.counterRaidInterval} waves: ${formatUnitList(tier.elites?.length ? tier.elites : tier.units)} strike your hamlets, guilds, or outposts from hostile flanks.`
      );
    }
    lines.push(
      `Faction spawn weight ×${tier.weight.toFixed(2)} — higher tiers thicken this realm in the nightly queue.`
    );
    if (tier.stage >= 2) {
      lines.push(
        'From waveMin+4 onward, faction units duplicate in enrichPool — expect more of this roster in the host mix.'
      );
    }
    return lines.join('\n');
  }

  function formatStageEntryBody(faction, tier) {
    const stageDef = getEvolutionStageDef(tier.stage);
    return [
      `${faction.name} — ${tier.tagline}`,
      '',
      `Unlocks at wave ${tier.waveMin} (faction debuts wave ${faction.waveMin}). Global stage: ${stageDef?.label || `Stage ${tier.stage}`} — ${stageDef?.desc || ''}`,
      '',
      `Grunt pool: ${formatUnitList(tier.units)}`,
      tier.elites?.length ? `Elite pool: ${formatUnitList(tier.elites)}` : 'Elite pool: none yet',
      tier.subBosses?.length
        ? `Sub-boss roster: ${formatUnitList(tier.subBosses)}`
        : 'Sub-boss roster: none',
      tier.buildings?.length
        ? `Northern structures: ${formatBuildingList(tier.buildings)} (cap ${tier.buildingCap})`
        : 'Northern structures: assault-only — no enemy holds yet',
      tier.counterRaids
        ? 'Counter-raids: ACTIVE — protect hamlets and guilds'
        : 'Counter-raids: inactive',
      '',
      formatStageMechanics(tier),
      '',
      'Hostility (Cordial → Blood Feud) and counter-offensive doctrines can pull this tier earlier or hold evolution back. Check HOST HUD and Threat Map for live stance and evolution offset.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  function formatFactionEvolutionBody(faction) {
    const blocks = faction.tiers.map((tier, i) => {
      const header = `Stage ${tier.stage}: ${tier.label} (Wave ${tier.waveMin}+)`;
      const summary = [
        tier.tagline,
        `Units: ${formatUnitList(tier.units)}`,
        tier.elites?.length ? `Elites: ${formatUnitList(tier.elites)}` : null,
        tier.subBosses?.length ? `Sub-bosses: ${formatUnitList(tier.subBosses)}` : null,
        tier.buildings?.length ? `Builds: ${formatBuildingList(tier.buildings)}` : 'Builds: none',
        tier.counterRaids ? `Counter-raids every ${tier.counterRaidInterval} waves` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return `${header}\n${summary}`;
    });
    return [
      `${faction.name} evolves on an independent 4-stage track from wave ${faction.waveMin}. Each stage reshapes the spawn pool, northern economy, and raid pressure.`,
      '',
      blocks.join('\n\n'),
      '',
      'See individual stage pages in this tab for full unit lists and mechanics. Named boss waves (every 10th) use the Monster Evolution roster — sub-bosses inject on other waves.',
    ].join('\n');
  }

  function getEncyclopediaEntries() {
    const stageTable = Object.entries(EVOLUTION_STAGES)
      .map(([n, s]) => `Stage ${n} — ${s.label} (${s.short}): ${s.desc}`)
      .join('\n');

    const factionList = Object.values(FACTIONS)
      .map((f) => `${f.name} (wave ${f.waveMin}+)`)
      .join(' · ');

    const entries = [
      {
        cat: 'enemies',
        name: 'Enemy Faction Evolution System',
        body: [
          "Five hostile realms evolve independently on a shared 4-stage track. Your HOST HUD and Threat Map show each faction's current stage, tagline, northern building count, and whether counter-raids are active.",
          '',
          'Stage 1 Grunts — basic horde filler thickens the lanes.',
          'Stage 2 Elite Host — veteran elites and named sub-bosses join non-boss waves.',
          'Stage 3 Fortified — enemy trade posts, quarries, and hamlets rise in the north.',
          'Stage 4 Kingdom — full settlements plus counter-raids on your hamlets and guilds.',
          '',
          `Active factions: ${factionList}`,
          '',
          'Faction reputation, counter-offensive doctrines, expeditions, and Planet Conquest elimination all interact with evolution timing — high hostility pulls tiers forward; truces and debuffs hold them back.',
        ].join('\n'),
      },
      {
        cat: 'enemies',
        name: 'Evolution Stages Reference',
        body: [
          'Global stage labels apply to every faction tier:',
          '',
          stageTable,
          '',
          'Each faction also has a named tier label per stage (Swarm, Warband Captains, Shadow Forts, etc.) announced when that wave threshold is first reached.',
        ].join('\n'),
      },
      {
        cat: 'enemies',
        name: 'Threat Map & HOST Intel',
        body: [
          'Open the Threat Map via 🗺 in the top bar, FACTION INTEL in the right panel, or by clicking the HOST HUD.',
          '',
          'Per-realm intel cards show: evolution stage (Grunts → Kingdom), tier tagline, northern building count, hostility stance (Cordial → Blood Feud), counter-offensive debuffs, multi-front flank assignment, and Planet Conquest sector %.',
          '',
          'Dormant factions display their unlock wave. Eliminated realms show CONQUERED and stop spawning. Stage 4 kingdoms badge COUNTER-RAIDS when they can strike your settlements.',
          '',
          'Night spawn queue intel lists faction roster mix (e.g. Goblin×12 · Dark×4). Combine with kingdom strength preview before dawn.',
        ].join('\n'),
      },
    ];

    for (const faction of Object.values(FACTIONS)) {
      entries.push({
        cat: 'enemies',
        name: `${faction.name} — Evolution Track`,
        body: formatFactionEvolutionBody(faction),
        campaignWave: faction.waveMin,
      });
      for (const tier of faction.tiers) {
        entries.push({
          cat: 'enemies',
          name: `${faction.name} — Stage ${tier.stage}: ${tier.label}`,
          body: formatStageEntryBody(faction, tier),
          campaignWave: tier.waveMin,
        });
      }
    }
    return entries;
  }

  function getStateSnapshot(wave, buildings, spawnQueue) {
    const active = getActiveFactions(wave);
    const hostKingdom = computeHostKingdomMeter(buildings, wave);
    const raidingFactions = active
      .filter((f) => f.currentTier.counterRaids)
      .map((f) => f.shortName);
    return {
      evolutionStages: EVOLUTION_STAGES,
      activeFactions: active.map((f) => {
        const rep =
          typeof FactionReputation !== 'undefined'
            ? FactionReputation.getFactionModifiers(f.id, wave)
            : null;
        return {
          id: f.id,
          name: f.name,
          shortName: f.shortName,
          color: f.color,
          tier: f.currentTier.tier,
          stage: f.currentTier.stage,
          tierLabel: f.currentTier.stageLabel || f.currentTier.label,
          tagline: f.currentTier.tagline,
          buildingCount: hostKingdom.breakdown[f.id]?.count || 0,
          counterRaids: !!f.currentTier.counterRaids,
          hostility: rep?.hostility,
          stanceLabel: rep?.stanceLabel,
          stanceColor: rep?.stanceColor,
          evolutionOffset: rep?.evolutionWaveOffset || 0,
          economicFocus: !!rep?.economicFocus,
        };
      }),
      hostKingdomTotal: hostKingdom.total,
      counterRaidFactions: raidingFactions,
      rosterIntel: formatFactionRoster(spawnQueue),
      activeSummary: formatActiveFactions(wave),
    };
  }

  return {
    FACTIONS,
    EVOLUTION_STAGES,
    UNIT_FACTION,
    BUILDING_FACTION,
    resetRun,
    getEvolutionStageDef,
    getFactionDef,
    getFactionTier,
    getActiveFactions,
    getUnitFaction,
    getBuildingFaction,
    enrichPool,
    mergeFactionWeights,
    biasSpawnQueue,
    biasHordeQueue,
    injectSubBosses,
    countFactionBuildings,
    computeHostKingdomMeter,
    formatFactionRoster,
    formatActiveFactions,
    updateFactionKingdoms,
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
