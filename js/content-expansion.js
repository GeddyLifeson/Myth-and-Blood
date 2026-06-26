/**
 * Content expansion — units, buildings, enemies, abilities, perks, wave events.
 */
const ContentExpansion = (() => {
  let ctx = null;
  let waveEventId = null;
  let fortifyZones = [];
  let activeLoadout = 'balanced';

  const LOADOUTS = {
    balanced:  { label: 'Balanced',  desc: 'No modifiers — standard army.' },
    shield:    { label: 'Shield Wall', desc: 'Footmen & Knights +15% HP.' },
    arrows:    { label: 'Arrow Storm', desc: 'Archers & Mages +12% damage.' },
    siege:     { label: 'Siege Crew',  desc: 'Sappers & Ballistas +25% siege damage.' },
    court:     { label: 'Royal Court', desc: 'Bards & Couriers +6 morale cap; couriers ride faster.' },
  };

  function registerDefs() {
    Object.assign(UnitDefs, {
      scout: {
        name: 'Scout', cost: 4, hp: 55, accuracy: 32, damage: 18, range: 28, meleeRange: 24,
        speed: 1.45, type: 'melee', morale: 11, experience: 6, canHunt: true, revealsStealth: true,
      },
      bard: {
        name: 'Bard', cost: 5, hp: 58, accuracy: 20, damage: 12, range: 90, meleeRange: 22,
        speed: 1.05, type: 'ranged', morale: 16, experience: 7, canHunt: false, moraleAuraUnit: 3,
      },
      ballista: {
        name: 'Ballista', cost: 6, hp: 75, accuracy: 38, damage: 42, range: 220, meleeRange: 24,
        speed: 0.75, type: 'ranged', projectile: 'arrow', morale: 12, experience: 7, canHunt: true,
        antiAir: true, siegeMult: 2.2,
      },
      pikeman: {
        name: 'Pikeman', cost: 4, hp: 90, accuracy: 30, damage: 22, range: 32, meleeRange: 32,
        speed: 0.95, type: 'melee', morale: 14, experience: 5, canHunt: true, antiCavalry: true, antiAir: true,
      },
    });

    Object.assign(BuildDefs, {
      watchtower: {
        name: 'Watchtower', cost: 5, hp: 160, cover: 0.35, radius: 18,
        blocksMove: false, blocksLOS: true, buildTime: 140,
        isWatchtower: true, visionRadius: 200, rangeBonus: 35,
      },
      spike_trap: {
        name: 'Spike Trap', cost: 3, hp: 80, cover: 0.1, radius: 14,
        blocksMove: false, blocksLOS: false, buildTime: 80,
        isTrap: true, trapDamage: 45, trapCooldown: 90,
      },
      quarry: {
        name: 'Quarry', cost: 30, hp: 200, cover: 0.25, radius: 22,
        blocksMove: true, blocksLOS: false, buildTime: 200,
        requiresBuilders: 2, isResourceGen: true, tpPerRound: 1,
      },
      trade_outpost: {
        name: 'Trade Outpost', cost: 38, hp: 140, cover: 0.3, radius: 20,
        blocksMove: false, blocksLOS: false, buildTime: 220,
        requiresBuilders: 2, isResourceGen: true, tpPerRound: 1, moraleAura: 2,
      },
      fortress_upgrade: {
        name: 'Fortress Upgrade', cost: 50, hp: 100, cover: 0, radius: 14,
        blocksMove: false, blocksLOS: false, buildTime: 200,
        isFortressUpgrade: true, requiresHamletNearby: 80,
      },
      academy_scout: {
        name: 'Scout Academy', cost: 40, hp: 170, cover: 0.35, radius: 22,
        blocksMove: false, blocksLOS: true, buildTime: 210,
        isAcademy: true, academyUnit: 'scout',
      },
      academy_bard: {
        name: 'Bard Academy', cost: 45, hp: 165, cover: 0.3, radius: 22,
        blocksMove: false, blocksLOS: false, buildTime: 210,
        isAcademy: true, academyUnit: 'bard',
      },
      academy_ballista: {
        name: 'Ballista Academy', cost: 55, hp: 190, cover: 0.4, radius: 24,
        blocksMove: false, blocksLOS: true, buildTime: 240,
        isAcademy: true, academyUnit: 'ballista',
      },
      academy_pikeman: {
        name: 'Pikeman Academy', cost: 40, hp: 175, cover: 0.35, radius: 22,
        blocksMove: false, blocksLOS: true, buildTime: 220,
        isAcademy: true, academyUnit: 'pikeman',
      },
      perk_double_tap: {
        name: 'Double Tap', cost: 11, hp: 130, cover: 0.2, radius: 16,
        blocksMove: false, blocksLOS: false, buildTime: 130,
        isPerkMachine: true, perkId: 'double_tap', secret: true,
      },
      perk_mule_kick: {
        name: 'Mule Kick', cost: 10, hp: 130, cover: 0.2, radius: 16,
        blocksMove: false, blocksLOS: false, buildTime: 125,
        isPerkMachine: true, perkId: 'mule_kick', secret: true,
      },
      perk_sleight: {
        name: 'Sleight of Hand', cost: 10, hp: 130, cover: 0.2, radius: 16,
        blocksMove: false, blocksLOS: false, buildTime: 125,
        isPerkMachine: true, perkId: 'sleight', secret: true,
      },
    });

    Object.assign(EnemyDefs, {
      harpy: {
        name: 'Harpy', hp: 48, accuracy: 28, damage: 16, range: 24, meleeRange: 22,
        speed: 0.85, type: 'melee', reward: 0, morale: 10, flying: true,
      },
      goblin_burrower: {
        name: 'Goblin Burrower', hp: 42, accuracy: 22, damage: 18, range: 20, meleeRange: 20,
        speed: 0.65, type: 'melee', reward: 0, morale: 8, burrower: true,
      },
      bone_summoner: {
        name: 'Bone Summoner', hp: 58, accuracy: 32, damage: 20, range: 140, meleeRange: 24,
        speed: 0.32, type: 'ranged', projectile: 'bolt', reward: 0, morale: 14,
        summoner: true, summonType: 'goblin', summonCooldown: 280,
      },
      sky_drake: {
        name: 'Sky Drake', hp: 130, accuracy: 34, damage: 38, range: 160, meleeRange: 28,
        speed: 0.55, type: 'ranged', projectile: 'bolt', reward: 0, morale: 22, flying: true,
      },
      plague_rat: {
        name: 'Plague Rat', hp: 28, accuracy: 18, damage: 10, range: 16, meleeRange: 16,
        speed: 1.1, type: 'melee', reward: 0, morale: 5,
      },
      abomination: {
        name: 'Abomination', hp: 260, accuracy: 24, damage: 48, range: 28, meleeRange: 28,
        speed: 0.55, type: 'melee', reward: 0, morale: 22, regen: true, spriteScale: 1.45,
      },
      behemoth: {
        name: 'Behemoth', hp: 380, accuracy: 26, damage: 58, range: 32, meleeRange: 32,
        speed: 0.22, type: 'melee', reward: 0, morale: 28, siegeMult: 3.2, spriteScale: 1.65,
      },
      iron_colossus: {
        name: 'Iron Colossus', hp: 450, accuracy: 20, damage: 46, range: 30, meleeRange: 30,
        speed: 0.18, type: 'siege', reward: 0, morale: 32, siegeMult: 4, spriteScale: 1.75,
      },
      void_stalker: {
        name: 'Void Stalker', hp: 130, accuracy: 48, damage: 68, range: 24, meleeRange: 24,
        speed: 0.95, type: 'melee', reward: 0, morale: 18, huntsGeneral: true, spriteScale: 1.35,
      },
      elder_wyrm: {
        name: 'Elder Wyrm', hp: 300, accuracy: 36, damage: 54, range: 175, meleeRange: 30,
        speed: 0.42, type: 'ranged', projectile: 'bolt', reward: 0, morale: 30, flying: true, spriteScale: 1.6,
      },
      boss_gorath: {
        name: 'Gorath the Breaker', bossName: 'Gorath the Breaker', bossTitle: 'Warlord of the Ash March',
        isNamedBoss: true, hp: 240, accuracy: 36, damage: 44, range: 28, meleeRange: 28,
        speed: 0.42, type: 'melee', reward: 0, morale: 32, enrageBoss: true, spriteScale: 1.75,
      },
      boss_morwen: {
        name: 'Morwen the Pale', bossName: 'Morwen the Pale', bossTitle: 'Queen of the Bone Court',
        isNamedBoss: true, hp: 170, accuracy: 38, damage: 40, range: 155, meleeRange: 26,
        speed: 0.32, type: 'ranged', projectile: 'bolt', reward: 0, morale: 28,
        summoner: true, summonType: 'goblin', summonCooldown: 220, spriteScale: 1.55,
      },
      boss_thokk: {
        name: 'Thokk the Mountain', bossName: 'Thokk the Mountain', bossTitle: 'Walker of Shattered Gates',
        isNamedBoss: true, hp: 440, accuracy: 24, damage: 64, range: 34, meleeRange: 34,
        speed: 0.2, type: 'melee', reward: 0, morale: 34, siegeMult: 3.5, enrageBoss: true, spriteScale: 1.85,
      },
      boss_grimm: {
        name: 'Grimm Ashborne', bossName: 'Grimm Ashborne', bossTitle: 'Knight of the Cinder Oath',
        isNamedBoss: true, hp: 300, accuracy: 40, damage: 50, range: 28, meleeRange: 28,
        speed: 0.38, type: 'melee', reward: 0, morale: 30, fireAura: true, spriteScale: 1.7,
      },
      boss_vexis: {
        name: 'Vexis the Hollow', bossName: 'Vexis the Hollow', bossTitle: 'Shadow That Hungers',
        isNamedBoss: true, hp: 175, accuracy: 50, damage: 74, range: 26, meleeRange: 26,
        speed: 0.9, type: 'melee', reward: 0, morale: 26, huntsGeneral: true, spriteScale: 1.6,
      },
      boss_karg: {
        name: 'Iron Lord Karg', bossName: 'Iron Lord Karg', bossTitle: 'Forge-Walker',
        isNamedBoss: true, hp: 540, accuracy: 22, damage: 54, range: 32, meleeRange: 32,
        speed: 0.16, type: 'siege', reward: 0, morale: 36, siegeMult: 4.5, spriteScale: 1.9,
      },
      boss_sylvara: {
        name: 'Sylvara Wyrm-Mother', bossName: 'Sylvara Wyrm-Mother', bossTitle: 'Matriarch of the Burning Sky',
        isNamedBoss: true, hp: 360, accuracy: 38, damage: 60, range: 180, meleeRange: 32,
        speed: 0.4, type: 'ranged', projectile: 'bolt', reward: 0, morale: 34, flying: true, spriteScale: 1.8,
      },
      boss_rotfather: {
        name: 'The Rotfather', bossName: 'The Rotfather', bossTitle: 'Pustulent Patriarch',
        isNamedBoss: true, hp: 340, accuracy: 26, damage: 54, range: 30, meleeRange: 30,
        speed: 0.48, type: 'melee', reward: 0, morale: 30, regen: true, spriteScale: 1.75,
      },
      boss_volk: {
        name: 'Dread Marshal Volk', bossName: 'Dread Marshal Volk', bossTitle: 'Hammer of the North Host',
        isNamedBoss: true, hp: 400, accuracy: 34, damage: 58, range: 30, meleeRange: 30,
        speed: 0.28, type: 'siege', reward: 0, morale: 35, siegeMult: 3.8, enrageBoss: true, spriteScale: 1.85,
      },
      boss_malachar: {
        name: 'Malachar the Eternal', bossName: 'Malachar the Eternal', bossTitle: 'Voice of the Endless Siege',
        isNamedBoss: true, hp: 520, accuracy: 42, damage: 68, range: 30, meleeRange: 30,
        speed: 0.35, type: 'melee', reward: 0, morale: 40, enrageBoss: true, huntsGeneral: true,
        siegeMult: 2.5, regen: true, spriteScale: 2.0,
      },
    });

    Object.assign(Abilities, {
      meteor:      { name: 'Meteor Shower', cost: 14, damage: 110, radius: 75, upgradeTier: 2 },
      frost_nova:  { name: 'Frost Nova', cost: 8, damage: 35, radius: 90, slowDuration: 180, upgradeTier: 1 },
      scout_flare: { name: 'Scout Flare', cost: 4, radius: 220, revealDuration: 300, upgradeTier: 1 },
      fortify:     { name: 'Fortify Zone', cost: 7, radius: 70, duration: 480, mitigation: 0.25, upgradeTier: 1 },
    });

    Object.assign(SpyActions, {
      muster:     { name: 'Muster Deserters', cost: 5, desc: 'Next wave -2 foes; reveals flanks' },
      war_chest:  { name: 'Raid War Chest', cost: 4, desc: '+6 TP now; next wave +2 enemies' },
      forge_maps: { name: 'Forge Maps', cost: 3, desc: 'Reveal traps & map caches this wave' },
      tunnel:     { name: 'Tunnel Network', cost: 5, desc: 'Burrowers surfaced; -25% burrower HP next wave' },
    });

    Object.assign(CourierMessages, {
      herald:  { name: 'Royal Herald', cost: 3, desc: '+4 morale all; preview next wave event' },
      muster:  { name: 'Emergency Muster', cost: 4, desc: 'Spawn 1 footman now; -2 morale all' },
      war_chest: { name: 'Open War Chest', cost: 2, desc: '+4 TP; courier rides faster next dispatch' },
    });

    let perkDefsReady = false;
    try { perkDefsReady = typeof PerkDefs !== 'undefined'; } catch (_) { /* TDZ when scripts are bundled */ }
    if (perkDefsReady) {
      Object.assign(PerkDefs, {
        double_tap: {
          name: 'Double Tap', tags: ['ranged'],
          desc: 'Second shot at 55% damage on hit',
          apply(u) { u.hasDoubleTap = true; },
        },
        mule_kick: {
          name: 'Mule Kick', tags: ['ranged', 'support'],
          desc: 'Carry a secondary weapon slot (+18% ranged dmg)',
          apply(u) { if (u.projectile) u.damage = Math.floor(u.damage * 1.18); },
        },
        sleight: {
          name: 'Sleight of Hand', tags: ['support', 'ranged'],
          desc: 'Spy/courier actions cost -1 TP (min 0)',
          apply(u) { u.hasSleight = true; },
        },
      });
      let perkBuildReady = false;
      try { perkBuildReady = typeof PerkBuildTypes !== 'undefined'; } catch (_) { /* TDZ when scripts are bundled */ }
      if (perkBuildReady) {
        PerkBuildTypes.push('perk_double_tap', 'perk_mule_kick', 'perk_sleight');
      }
    }

    HONOR_PREFIX_BY_TYPE.scout = ['Ranger', 'Syr', 'Pathfinder'];
    HONOR_PREFIX_BY_TYPE.bard = ['Minstrel', 'Syr', 'Dame'];
    HONOR_PREFIX_BY_TYPE.ballista = ['Artillerist', 'Syr', 'Master Gunner'];
    HONOR_PREFIX_BY_TYPE.pikeman = ['Sergeant', 'Syr', 'Halberdier'];

    ENEMY_SPRITE_MAP.harpy = 'archer';
    ENEMY_SPRITE_MAP.goblin_burrower = 'goblin';
    ENEMY_SPRITE_MAP.bone_summoner = 'mage';
    ENEMY_SPRITE_MAP.sky_drake = 'mage';
    ENEMY_SPRITE_MAP.plague_rat = 'goblin';
    ENEMY_SPRITE_MAP.abomination = 'abomination';
    ENEMY_SPRITE_MAP.behemoth = 'behemoth';
    ENEMY_SPRITE_MAP.iron_colossus = 'iron_colossus';
    ENEMY_SPRITE_MAP.void_stalker = 'void_stalker';
    ENEMY_SPRITE_MAP.elder_wyrm = 'elder_wyrm';
    for (const id of [
      'boss_gorath', 'boss_morwen', 'boss_thokk', 'boss_grimm', 'boss_vexis',
      'boss_karg', 'boss_sylvara', 'boss_rotfather', 'boss_volk', 'boss_malachar',
    ]) {
      ENEMY_SPRITE_MAP[id] = id;
    }

    if (typeof ACADEMY_BUILD_TYPES !== 'undefined') {
      ACADEMY_BUILD_TYPES.push('academy_scout', 'academy_bard', 'academy_ballista', 'academy_pikeman');
    }

    ELITE_ENEMIES.push('sky_drake', 'bone_summoner');
    if (typeof MONSTER_ENEMIES !== 'undefined') {
      MONSTER_ENEMIES.forEach(m => { if (!ELITE_ENEMIES.includes(m)) ELITE_ENEMIES.push(m); });
    }
    for (const id of [
      'boss_gorath', 'boss_morwen', 'boss_thokk', 'boss_grimm', 'boss_vexis',
      'boss_karg', 'boss_sylvara', 'boss_rotfather', 'boss_volk', 'boss_malachar',
    ]) {
      if (!ELITE_ENEMIES.includes(id)) ELITE_ENEMIES.push(id);
      if (typeof MONSTER_ENEMIES !== 'undefined' && !MONSTER_ENEMIES.includes(id)) MONSTER_ENEMIES.push(id);
    }

    if (typeof SpriteGen !== 'undefined' && SpriteGen.UNIT_STYLE) {
      Object.assign(SpriteGen.UNIT_STYLE, {
        scout:    { body: '#607848', accent: '#a0c080', mark: '#405830', size: 8 },
        bard:     { body: '#704878', accent: '#c090d0', mark: '#ffd700', size: 8 },
        ballista: { body: '#585858', accent: '#909090', mark: '#c06030', size: 10 },
        pikeman:  { body: '#486878', accent: '#80a0b0', mark: '#c0c0c0', size: 9 },
        abomination: { body: '#5a2848', accent: '#904070', mark: '#ff4060', size: 16 },
        behemoth: { body: '#3a4828', accent: '#5a6838', mark: '#ff6020', size: 18 },
        iron_colossus: { body: '#484858', accent: '#787890', mark: '#ff8040', size: 19 },
        void_stalker: { body: '#181828', accent: '#303048', mark: '#ff2040', size: 14 },
        elder_wyrm: { body: '#283850', accent: '#5080b0', mark: '#ff6040', size: 17 },
        boss_gorath: { body: '#4a3020', accent: '#8a5030', mark: '#ff4020', size: 19 },
        boss_morwen: { body: '#383050', accent: '#7060a0', mark: '#c0f0ff', size: 17 },
        boss_thokk: { body: '#354028', accent: '#5a6840', mark: '#c06020', size: 20 },
        boss_grimm: { body: '#302028', accent: '#604040', mark: '#ff6020', size: 18 },
        boss_vexis: { body: '#101020', accent: '#282840', mark: '#ff1030', size: 16 },
        boss_karg: { body: '#404050', accent: '#707888', mark: '#ffa040', size: 21 },
        boss_sylvara: { body: '#203040', accent: '#4080a8', mark: '#ff8040', size: 19 },
        boss_rotfather: { body: '#4a2038', accent: '#803060', mark: '#ff3060', size: 18 },
        boss_volk: { body: '#382828', accent: '#684040', mark: '#ffd040', size: 20 },
        boss_malachar: { body: '#281830', accent: '#503070', mark: '#ff2080', size: 22 },
      });
    }

    const _getWaveConfig = getWaveConfig;
    getWaveConfig = function (waveNum) {
      const cfg = _getWaveConfig(waveNum);
      if (waveNum >= 6) cfg.pool.push('harpy', 'plague_rat');
      if (waveNum >= 9) cfg.pool.push('goblin_burrower');
      if (waveNum >= 11) cfg.pool.push('bone_summoner');
      if (waveNum >= 14) cfg.pool.push('sky_drake', 'harpy');
      if (waveNum >= 18) cfg.pool.push('plague_rat', 'goblin_burrower');
      if (waveNum >= 20) cfg.pool.push('abomination');
      if (waveNum >= 25) cfg.pool.push('behemoth');
      if (waveNum >= 32) cfg.pool.push('void_stalker');
      if (waveNum >= 40) cfg.pool.push('iron_colossus');
      if (waveNum >= 50) cfg.pool.push('elder_wyrm', 'behemoth');
      if (waveNum >= 70) cfg.pool.push('abomination', 'iron_colossus', 'elder_wyrm');
      return cfg;
    };
  }

  function bind(gameCtx) {
    ctx = gameCtx;
  }

  const ECONOMY_GEN_TP_CAP = 6;

  function countEconomyGens() {
    if (!ctx) return 0;
    return ctx.buildings.filter(b =>
      b.owner === 'player' && b.complete && b.hp > 0 && b.isResourceGen
    ).length;
  }

  function getEconomyTpBonus() {
    if (!ctx) return 0;
    const gens = ctx.buildings
      .filter(b => b.owner === 'player' && b.complete && b.hp > 0 && b.isResourceGen)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return gens.slice(0, ECONOMY_GEN_TP_CAP)
      .reduce((s, b) => s + (BuildDefs[b.type]?.tpPerRound || b.tpPerRound || 0), 0);
  }

  function pickWaveEvent(wave) {
    if (wave % 13 === 0) return 'blood_moon';
    if (wave % 17 === 0) return 'supply_caravan';
    if (wave % 23 === 0) return 'siege_push';
    return null;
  }

  function applyWaveEvent(wave, spawnQueue) {
    waveEventId = pickWaveEvent(wave);
    if (!waveEventId || !ctx) return spawnQueue;
    const q = [...spawnQueue];
    if (waveEventId === 'blood_moon') {
      q.push('harpy', 'sky_drake', 'berserker');
      ctx.showMessage?.('Blood Moon rises — flying predators join the hunt!', 320);
      FloatingText?.status(ctx.worldW / 2, 56, 'BLOOD MOON', '#c04080');
    } else if (waveEventId === 'supply_caravan') {
      ctx.tactical += 5;
      ctx.showMessage?.('Supply caravan arrived! +5 TP', 240);
      FloatingText?.status(ctx.worldW / 2, 56, 'CARAVAN', '#80c060');
    } else if (waveEventId === 'siege_push') {
      q.push('siege_tower', 'goblin_sapper', 'siege_tower');
      ctx.showMessage?.('Siege Push — extra towers and sappers!', 300);
      FloatingText?.status(ctx.worldW / 2, 56, 'SIEGE PUSH', '#ff8040');
    }
    return q;
  }

  function spawnDestructibles(decorations, worldW, worldH, rallyY, tier) {
    if (tier < 1) return;
    const types = ['supply_crate', 'oil_barrel'];
    const count = 2 + Math.floor(tier / 2);
    for (let i = 0; i < count; i++) {
      const t = types[i % types.length];
      decorations.push({
        type: t,
        id: `dest_${i}_${Date.now()}`,
        x: 70 + Math.random() * (worldW - 140),
        y: rallyY - 100 + Math.random() * (worldH - rallyY - 100),
        size: t === 'supply_crate' ? 16 : 14,
        hp: t === 'supply_crate' ? 40 : 30,
        maxHp: t === 'supply_crate' ? 40 : 30,
        blocksMove: false,
        blocksLOS: false,
        cover: 0.15,
        radius: 14,
        lootTp: t === 'supply_crate' ? 2 : 0,
        explosive: t === 'oil_barrel',
      });
    }
  }

  function applyLoadoutToUnit(unit) {
    if (!unit || unit.team !== 'player' || !ctx) return;
    const lo = activeLoadout;
    if (lo === 'shield' && (unit.type === 'footman' || unit.type === 'knight')) {
      unit.maxHp = Math.floor(unit.maxHp * 1.15);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    } else if (lo === 'arrows' && (unit.type === 'archer' || unit.type === 'mage')) {
      unit.damage = Math.floor(unit.damage * 1.12);
    } else if (lo === 'siege' && (unit.type === 'sapper' || unit.type === 'ballista')) {
      unit.siegeMult = (unit.siegeMult || 1) * 1.25;
    } else if (lo === 'court' && (unit.type === 'bard' || unit.type === 'courier')) {
      unit.maxMorale = Math.min(45, unit.maxMorale + 6);
      unit.morale = Math.min(unit.maxMorale, unit.morale + 3);
      if (unit.type === 'courier') unit.courierCooldownMult = (unit.courierCooldownMult || 1) * 0.82;
    }
  }

  function modifyCalcDamage(unit, target, dmg) {
    let d = dmg;
    if (unit.team === 'player') {
      if (unit.antiAir && target?.flying) d = Math.round(d * 1.65);
      if (unit.antiCavalry && (target?.combatType === 'cavalry' || target?.type === 'warg_rider')) d = Math.round(d * 1.4);
      if (unit.type === 'ballista' && target?.flying) d = Math.round(d * 1.35);
    }
    if (unit.siegeMult > 1 && (target?.type === 'siege_tower' || target?.siegeDeployed)) {
      d = Math.round(d * unit.siegeMult);
    }
    if (unit.type === 'war_chief' || unit.isNamedBoss || EnemyDefs[unit.type]?.enrageBoss) {
      unit.enrageTimer = unit.enrageTimer || 0;
      if (unit.hp / unit.maxHp < 0.5) {
        unit.enrageTimer = 300;
        d = Math.round(d * 1.45);
      } else if (unit.enrageTimer > 0) {
        d = Math.round(d * 1.2);
      }
    }
    if (target?.team === 'player' && fortifyZones.length) {
      for (const z of fortifyZones) {
        if (Math.hypot(target.x - z.x, target.y - z.y) < z.radius) {
          d = Math.round(d * (1 - z.mitigation));
          break;
        }
      }
    }
    return d;
  }

  function getWatchtowerIntelPenalty(enemy) {
    if (!ctx || !enemy || enemy.team !== 'enemy') return 0;
    let pen = 0;
    for (const b of ctx.buildings) {
      if (!b.complete || !b.isWatchtower || b.hp <= 0 || b.owner !== 'player') continue;
      const vr = b.visionRadius || 200;
      if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < vr) pen += 8;
    }
    return Math.min(24, pen);
  }

  function isStealthed(unit) {
    return unit?.burrowed || (unit?.flying && unit.altitude > 0.5);
  }

  function canTargetUnit(attacker, target) {
    if (!target || target.hp <= 0) return true;
    if (attacker?.team === 'player' && isStealthed(target)) {
      if (attacker.revealsStealth) return true;
      for (const b of (ctx?.buildings || [])) {
        if (!b.complete || !b.isWatchtower || b.owner !== 'player') continue;
        if (Math.hypot(target.x - b.x, target.y - b.y) < (b.visionRadius || 200)) return true;
      }
      if (target.burrowed) return false;
      if (target.flying && !attacker.antiAir && !attacker.projectile) return false;
    }
    return true;
  }

  function updatePerTick() {
    if (!ctx) return;
    const { units, buildings, decorations, updateTick } = ctx;

    for (let i = fortifyZones.length - 1; i >= 0; i--) {
      fortifyZones[i].timer--;
      if (fortifyZones[i].timer <= 0) fortifyZones.splice(i, 1);
    }

    for (const b of buildings) {
      if (!b.complete || !b.isTrap || b.hp <= 0) continue;
      if ((b.trapCooldown || 0) > 0) { b.trapCooldown--; continue; }
      for (const u of units) {
        if (u.team !== 'enemy' || u.hp <= 0 || u.flying) continue;
        if (Math.hypot(u.x - b.x, u.y - b.y) > b.radius + 8) continue;
        const dmg = b.trapDamage || 45;
        ctx.takeDamage(u, dmg);
        b.trapCooldown = BuildDefs.spike_trap?.trapCooldown || 90;
        Particles?.explosion(b.x, b.y);
        FloatingText?.status(b.x, b.y, 'TRAP!', '#ff6040');
        break;
      }
    }

    for (const u of units) {
      if (u.team === 'player' && u.type === 'bard' && u.hp > 0 && u.moraleAuraUnit) {
        const rate = 0.008 * u.moraleAuraUnit;
        for (const ally of units) {
          if (ally.team !== 'player' || ally.hp <= 0 || ally.id === u.id) continue;
          if (Math.hypot(ally.x - u.x, ally.y - u.y) < 100) {
            ally.morale = Math.min(ally.maxMorale, ally.morale + rate);
          }
        }
      }

      if (u.team === 'enemy' && u.type === 'abomination' && u.hp > 0 && u.hp < u.maxHp && updateTick % 40 === 0) {
        const heal = Math.max(2, Math.floor(u.maxHp * 0.01));
        u.hp = Math.min(u.maxHp, u.hp + heal);
      }

      if (u.team === 'enemy' && u.burrower) {
        u.burrowTimer = (u.burrowTimer || 0) + 1;
        const nearPlayer = units.some(p =>
          p.team === 'player' && p.hp > 0 && Math.hypot(p.x - u.x, p.y - u.y) < 90
        );
        if (!u.burrowed && u.burrowTimer > 120 && !nearPlayer && Math.random() < 0.02) {
          u.burrowed = true;
          u.speed *= 0.35;
        } else if (u.burrowed && nearPlayer) {
          u.burrowed = false;
          u.speed = EnemyDefs.goblin_burrower?.speed || 0.65;
        }
      }

      if (u.team === 'enemy' && u.flying) {
        u.altitude = u.altitude ?? 1;
        u.y += Math.sin(updateTick * 0.04 + u.id.charCodeAt(0)) * 0.15;
      }

      if (u.team === 'enemy' && u.summoner && u.hp > 0) {
        u.summonTimer = (u.summonTimer || 0) - 1;
        if (u.summonTimer <= 0) {
          u.summonTimer = u.summonCooldown || 280;
          const st = u.summonType || 'goblin';
          const sx = u.x + (Math.random() - 0.5) * 40;
          const sy = u.y + 20;
          const minion = ctx.createUnit(st, sx, sy, 'enemy');
          if (minion) {
            minion.maxHp = Math.floor(minion.maxHp * 0.7);
            minion.hp = minion.maxHp;
            units.push(minion);
            FloatingText?.status(sx, sy, 'RISE!', '#a060c0');
          }
        }
      }

      if ((u.type === 'war_chief' || u.isNamedBoss) && u.hp > 0) {
        if (u.enrageTimer > 0) u.enrageTimer--;
        if (u.hp / u.maxHp < 0.35 && updateTick % 90 === 0) {
          FloatingText?.status(u.x, u.y - 12, 'ENRAGE!', '#ff3030');
        }
      }
      if (u.team === 'enemy' && u.isNamedBoss && EnemyDefs[u.type]?.regen
        && u.hp > 0 && u.hp < u.maxHp && updateTick % 50 === 0) {
        const heal = Math.max(2, Math.floor(u.maxHp * 0.012));
        u.hp = Math.min(u.maxHp, u.hp + heal);
      }
    }

    for (let i = decorations.length - 1; i >= 0; i--) {
      const d = decorations[i];
      if (d.type !== 'supply_crate' && d.type !== 'oil_barrel') continue;
      if (d.hp <= 0) {
        if (d.lootTp && ctx) {
          ctx.tactical += d.lootTp;
          ctx.showMessage?.(`Cache destroyed — +${d.lootTp} TP!`, 160);
        }
        decorations.splice(i, 1);
        ctx?.invalidateObstacles?.();
        continue;
      }
      for (const u of units) {
        if (u.hp <= 0) continue;
        if (Math.hypot(u.x - d.x, u.y - d.y) > (d.radius || 14) + 10) continue;
        if (d.explosive) {
          ctx?.damageInRadius(d.x, d.y, 55, 60, u.team === 'player' ? 'enemy' : 'player');
          Particles?.explosion(d.x, d.y);
          d.hp = 0;
        } else if (u.team === 'player' && u.type === 'sapper') {
          d.hp -= 8;
        }
      }
    }
  }

  function updateEnemyAI(unit) {
    if (!unit || unit.hp <= 0) return false;
    if (unit.flying && unit.combatType !== 'siege') {
      const adv = ctx?.getEnemyAdvancePoint?.(unit);
      if (adv) {
        unit.targetX = adv.x;
        unit.targetY = adv.y - 40;
        unit.x += (unit.targetX - unit.x) * 0.02 * unit.speed;
        unit.y += (unit.targetY - unit.y) * 0.02 * unit.speed;
      }
      return true;
    }
    return false;
  }

  function useAbility(ability, wx, wy) {
    const ab = Abilities[ability];
    if (!ab || !ctx) return false;

    if (ability === 'meteor') {
      AudioEngine.SFX.fireball();
      StrikeFX?.play?.('meteor', wx, wy, ab.radius);
      Particles.explosion(wx, wy);
      ctx.damageInRadius(wx, wy, ab.radius, ab.damage, 'player');
      ctx.damageInRadius(wx, wy - 30, ab.radius * 0.7, Math.floor(ab.damage * 0.6), 'player');
      ctx.showMessage('Meteor shower impacts the field!');
      return true;
    }
    if (ability === 'frost_nova') {
      AudioEngine.SFX.magicCast();
      StrikeFX?.play?.('frost_nova', wx, wy, ab.radius);
      for (const u of ctx.units) {
        if (u.team !== 'enemy' || u.hp <= 0) continue;
        if (Math.hypot(u.x - wx, u.y - wy) < ab.radius) {
          ctx.takeDamage(u, ab.damage);
          u.hazardSlow = 0.4;
          u.frostTimer = ab.slowDuration || 180;
        }
      }
      Particles.lightning(wx, wy);
      ctx.showMessage('Frost nova — enemies slowed!');
      return true;
    }
    if (ability === 'scout_flare') {
      StrikeFX?.play?.('scout_flare', wx, wy, ab.radius);
      for (const u of ctx.units) {
        if (u.team !== 'enemy' || u.hp <= 0) continue;
        if (Math.hypot(u.x - wx, u.y - wy) < ab.radius) {
          u.burrowed = false;
          u.flareMarked = ab.revealDuration || 300;
        }
      }
      FloatingText?.status(wx, wy, 'FLARE', '#ffd700');
      ctx.showMessage('Scout flare reveals hidden foes!');
      return true;
    }
    if (ability === 'fortify') {
      fortifyZones.push({
        x: wx, y: wy, radius: ab.radius,
        mitigation: ab.mitigation || 0.25,
        timer: ab.duration || 480,
      });
      StrikeFX?.play?.('fortify', wx, wy, ab.radius);
      FloatingText?.status(wx, wy, 'FORTIFY', '#80a0c0');
      ctx.showMessage('Fortify zone established — allies take less damage!');
      return true;
    }
    return false;
  }

  function handleSpyAction(action) {
    if (!ctx) return false;
    const def = SpyActions[action];
    if (!def) return false;

    if (action === 'muster') {
      ctx.pendingWaveMods.stealReduction = (ctx.pendingWaveMods.stealReduction || 0) + 2;
      ctx.pendingWaveMods.revealed = true;
      ctx.showMessage('Deserters mustered — next wave lighter; flanks revealed.');
      return true;
    }
    if (action === 'war_chest') {
      ctx.tactical += 6;
      ctx.pendingWaveMods.stealReduction = (ctx.pendingWaveMods.stealReduction || 0) - 2;
      ctx.showMessage('War chest raided! +6 TP — expect reprisal (+2 foes).');
      return true;
    }
    if (action === 'forge_maps') {
      ctx.mapsRevealed = true;
      for (const d of ctx.decorations) {
        if (d.type === 'supply_crate' || d.type === 'oil_barrel') d.revealed = true;
      }
      ctx.showMessage('Maps forged — caches and traps revealed on the battlefield!');
      return true;
    }
    if (action === 'tunnel') {
      ctx.pendingWaveMods.hpMult = (ctx.pendingWaveMods.hpMult || 1) * 0.75;
      for (const u of ctx.units) {
        if (u.burrower) u.burrowed = false;
      }
      ctx.showMessage('Tunnel network collapsed — burrowers flushed; next wave burrowers weaker.');
      return true;
    }
    return false;
  }

  function handleCourierMessage(msg) {
    if (!ctx) return false;
    if (msg === 'herald') {
      for (const u of ctx.units) {
        if (u.team === 'player' && u.hp > 0) {
          u.morale = Math.min(u.maxMorale, u.morale + 4);
        }
      }
      const nextEvt = pickWaveEvent(ctx.wave + 1);
      if (nextEvt) ctx.showMessage(`Herald proclaims: next wave may bring ${nextEvt.replace('_', ' ')}!`, 300);
      else ctx.showMessage('Royal herald spreads courage across the ranks!');
      return true;
    }
    if (msg === 'muster') {
      const u = ctx.createUnit('footman', ctx.worldW / 2, ctx.deployY, 'player');
      if (u) {
        u.targetY = ctx.rallyY;
        ctx.units.push(u);
        applyLoadoutToUnit(u);
      }
      for (const ally of ctx.units) {
        if (ally.team === 'player' && ally.hp > 0) ally.morale = Math.max(0, ally.morale - 2);
      }
      ctx.showMessage('Emergency muster — footman deployed; troops grumble (-2 morale).');
      return true;
    }
    if (msg === 'war_chest') {
      ctx.tactical += 4;
      const courier = ctx.units.find(u => u.type === 'courier' && u.hp > 0);
      if (courier) courier.courierCooldownMult = (courier.courierCooldownMult || 1) * 0.7;
      ctx.showMessage('War chest opened! +4 TP; courier rides swift next dispatch.');
      return true;
    }
    return false;
  }

  function onBuildingComplete(b) {
    if (!ctx || !b) return;
    if (b.type === 'fortress_upgrade' || b.isFortressUpgrade) {
      let best = null, bestD = Infinity;
      for (const h of ctx.buildings) {
        if (!h.isHamlet || h.owner !== 'player' || !h.complete) continue;
        const d = Math.hypot(h.x - b.x, h.y - b.y);
        if (d < bestD && d < 90) { bestD = d; best = h; }
      }
      if (best) {
        best.fortressTier = (best.fortressTier || 0) + 1;
        best.maxHp = Math.floor(best.maxHp * 1.35);
        best.hp = best.maxHp;
        best.cover = Math.min(0.55, (best.cover || 0.35) + 0.08);
        const hamletBase = typeof HAMLET_TP_PER_ROUND !== 'undefined' ? HAMLET_TP_PER_ROUND : 5;
        const curTp = best.tpBonusPerHamlet ?? BuildDefs.hamlet?.tpBonusPerHamlet ?? hamletBase;
        best.tpBonusPerHamlet = curTp + 1;
        ctx.showMessage(`${BuildDefs.hamlet.name} fortified! +HP, cover, and +1 TP/round.`, 300);
        FloatingText?.status(best.x, best.y, 'FORTRESS', '#c0a040');
      }
      const idx = ctx.buildings.indexOf(b);
      if (idx >= 0) ctx.buildings.splice(idx, 1);
      ctx.invalidateObstacles?.();
    }
    if (b.isWatchtower) {
      ctx.showMessage('Watchtower ready — extended vision reveals stealthy foes.', 220);
    }
    if (b.isTrap) {
      ctx.showMessage('Spike trap armed — enemies will bleed on contact.', 200);
    }
    if (b.isResourceGen) {
      const active = countEconomyGens();
      const tp = b.tpPerRound || 1;
      if (active <= ECONOMY_GEN_TP_CAP) {
        ctx.showMessage(`${BuildDefs[b.type]?.name} operational — +${tp} TP/round (${active}/${ECONOMY_GEN_TP_CAP} economy sites).`, 260);
      } else {
        ctx.showMessage(`${BuildDefs[b.type]?.name} built — cap reached (${ECONOMY_GEN_TP_CAP} TP sites). Morale/utility only.`, 280);
      }
    }
  }

  function getAbilityCost(id, baseCost, waveNum = ctx?.wave ?? 0) {
    const ab = Abilities[id];
    if (!ab?.upgradeTier) return baseCost;
    let cost = baseCost;
    if (waveNum >= ACADEMY_ERA_WAVE) cost -= ab.upgradeTier;
    if (waveNum >= RTS_ERA_WAVE && ab.upgradeTier >= 2) cost -= 1;
    const floor = ab.upgradeTier >= 2 ? 8 : 3;
    return Math.max(floor, cost);
  }

  function getSpyCost(action, baseCost) {
    if (!ctx) return baseCost;
    const sleight = ctx.units.some(u => u.team === 'player' && u.hp > 0 && u.hasSleight);
    return sleight ? Math.max(0, baseCost - 1) : baseCost;
  }

  function getCourierCost(msg, baseCost) {
    return getSpyCost(msg, baseCost);
  }

  function setLoadout(id) {
    if (LOADOUTS[id]) {
      activeLoadout = id;
      ctx?.showMessage?.(`Loadout: ${LOADOUTS[id].label} — ${LOADOUTS[id].desc}`, 280);
    }
  }

  function getLoadout() { return activeLoadout; }
  function getLoadouts() { return LOADOUTS; }
  function getWaveEvent() { return waveEventId; }

  function getEncyclopediaEntries() {
    return [
      { cat: 'allies', name: 'Scout', body: 'Fast skirmisher with stealth detection. Pair with watchtowers to reveal burrowers and fliers.' },
      { cat: 'allies', name: 'Bard', body: 'Morale aura support — keeps nearby allies inspired. Weak in direct combat.' },
      { cat: 'allies', name: 'Ballista', body: 'Long-range siege engine. Bonus damage vs flying foes and siege targets.' },
      { cat: 'allies', name: 'Pikeman', body: 'Anti-cavalry and anti-air melee. Cheap line holder vs warg riders and harpies.' },
      { cat: 'enemies', name: 'Harpy', body: 'Flying harasser — hard to melee without anti-air or watchtower intel.' },
      { cat: 'enemies', name: 'Goblin Burrower', body: 'Burrows underground when far from troops. Surfaces near your lines.' },
      { cat: 'enemies', name: 'Bone Summoner', body: 'Elite necromancer — periodically raises goblin minions.' },
      { cat: 'enemies', name: 'Sky Drake', body: 'Elite flying dragon — ranged fire from above. Priority target for ballistas.' },
      { cat: 'enemies', name: 'Plague Rat', body: 'Fast weak swarm — floods lanes in mid waves.' },
      { cat: 'enemies', name: 'Abomination', body: 'Elite flesh horror — many eyes, tentacles, and slow regeneration. Huge on the field.' },
      { cat: 'enemies', name: 'Behemoth', body: 'Colossal melee bruiser. Slow, terrifying, and smashes walls. Appears wave 25+.' },
      { cat: 'enemies', name: 'Iron Colossus', body: 'Walking siege engine of riveted iron. Massive HP and structure damage. Wave 40+.' },
      { cat: 'enemies', name: 'Void Stalker', body: 'Tall shadow assassin with burning eyes — hunts your General like a nightmare.' },
      { cat: 'enemies', name: 'Elder Wyrm', body: 'Ancient dragon larger than sky drakes. Rains fire from above. Boss-tier threat wave 50+.' },
      { cat: 'enemies', name: 'Named Bosses', body: 'Every 10th wave, a unique warlord leads the assault — Gorath, Morwen, Thokk, Grimm, Vexis, Karg, Sylvara, Rotfather, Volk, then Malachar at wave 100. They return stronger each cycle.' },
      { cat: 'buildings', name: 'Watchtower', body: 'Vision radius reveals stealth and extends intel — enemies in range suffer accuracy penalties.' },
      { cat: 'buildings', name: 'Spike Trap', body: 'Hidden spikes damage the first enemy crossing each cooldown.' },
      { cat: 'buildings', name: 'Quarry', body: '30 TP, 2 Builders. +1 TP/round (max 6 quarries + trade posts combined). Blocks movement — early bridge, not a hamlet substitute.' },
      { cat: 'buildings', name: 'Trade Outpost', body: '38 TP, 2 Builders. +1 TP/round and morale aura. Counts toward the 6-site economy cap — hamlets scale better late.' },
      { cat: 'buildings', name: 'Fortress Upgrade', body: 'Place on a completed hamlet to fortify it: +HP, cover, +1 TP/round.' },
      { cat: 'buildings', name: 'Advanced Academies', body: 'Scout, Bard, Ballista, and Pikeman academies train their units each round in Academy Era.' },
      { cat: 'orders', name: 'Meteor Shower', body: '14 TP — massive dual-impact fire strike. Cost drops after wave 100.' },
      { cat: 'orders', name: 'Frost Nova', body: '8 TP — damages and slows enemies in a wide radius. Cost drops after wave 100.' },
      { cat: 'orders', name: 'Scout Flare', body: '4 TP — reveals burrowed/hidden enemies in a large area. Cost drops after wave 100.' },
      { cat: 'orders', name: 'Fortify Zone', body: '7 TP — allies in zone take 25% less damage for a time. Cost drops after wave 100.' },
      { cat: 'orders', name: 'Horde Waves', body: 'Every 5th wave (except boss waves): fast swarm assault. Waves 15/45/75 add siege tower + sappers. Scout intel warns "HORDE expected."' },
      { cat: 'orders', name: 'Wave Events', body: 'Blood Moon (÷13): flying predators. Supply Caravan (÷17): +5 TP. Siege Push (÷23): extra towers.' },
      { cat: 'orders', name: 'Loadouts (Wave 100+)', body: 'Shield Wall, Arrow Storm, Siege Crew, or Royal Court — passive bonuses to trained troops.' },
      { cat: 'orders', name: 'Spy: Muster / War Chest / Maps / Tunnel', body: 'New spy actions with trade-offs: lighter waves, TP now vs reprisal, cache reveal, flush burrowers.' },
      { cat: 'orders', name: 'Courier: Herald / Muster / War Chest', body: 'Morale + event preview; emergency footman at morale cost; TP + faster courier.' },
      { cat: 'perks', name: 'Double Tap', body: 'Ranged — bonus follow-up shot at 55% damage (applied on hit in combat).' },
      { cat: 'perks', name: 'Mule Kick', body: 'Ranged & support — +18% ranged damage.' },
      { cat: 'perks', name: 'Sleight of Hand', body: 'Support & ranged — spy/courier actions cost -1 TP.' },
    ];
  }

  registerDefs();

  function getFortifyZones() {
    return fortifyZones;
  }

  return {
    bind,
    getFortifyZones,
    getEconomyTpBonus,
    applyWaveEvent,
    spawnDestructibles,
    applyLoadoutToUnit,
    modifyCalcDamage,
    getWatchtowerIntelPenalty,
    canTargetUnit,
    updatePerTick,
    updateEnemyAI,
    useAbility,
    handleSpyAction,
    handleCourierMessage,
    onBuildingComplete,
    getAbilityCost,
    getSpyCost,
    getCourierCost,
    setLoadout,
    getLoadout,
    getLoadouts,
    getWaveEvent,
    getEncyclopediaEntries,
    pickWaveEvent,
  };
})();