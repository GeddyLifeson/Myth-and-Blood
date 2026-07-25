/**
 * Neutral wildlife and environmental events — occasional threats both sides can fight or exploit.
 */
const NeutralWildlife = (() => {
  const WAVE_MIN = 8;
  const DEATH_EVENT_MIN = 7;

  const NEUTRAL_TYPES = {
    wild_boar: {
      id: 'wild_boar',
      name: 'Wild Boar',
      spriteType: 'troll',
      spriteScale: 0.82,
      hp: 95,
      accuracy: 26,
      damage: 24,
      range: 24,
      meleeRange: 24,
      speed: 1.25,
      combatType: 'melee',
      morale: 12,
      aggroRadius: 150,
      lootTp: 2,
      color: '#a08050',
    },
    wild_harpy: {
      id: 'wild_harpy',
      name: 'Harpy Flock',
      spriteType: 'harpy',
      spriteScale: 0.9,
      flying: true,
      hp: 72,
      accuracy: 32,
      damage: 22,
      range: 180,
      meleeRange: 26,
      speed: 1.1,
      combatType: 'ranged',
      projectile: 'arrow',
      morale: 10,
      aggroRadius: 200,
      lootTp: 3,
      color: '#9080c0',
    },
    wild_stalker: {
      id: 'wild_stalker',
      name: 'Brush Stalker',
      spriteType: 'warg_rider',
      spriteScale: 0.88,
      hp: 110,
      accuracy: 30,
      damage: 28,
      range: 28,
      meleeRange: 28,
      speed: 1.15,
      combatType: 'melee',
      morale: 14,
      aggroRadius: 170,
      lootTp: 3,
      color: '#708860',
    },
    wild_treant: {
      id: 'wild_treant',
      name: 'Awakened Treant',
      spriteType: 'troll',
      spriteScale: 1.15,
      hp: 240,
      accuracy: 20,
      damage: 34,
      range: 30,
      meleeRange: 30,
      speed: 0.55,
      combatType: 'melee',
      morale: 22,
      aggroRadius: 130,
      lootTp: 5,
      color: '#508848',
    },
  };

  const EVENTS = {
    beast_migration: {
      id: 'beast_migration',
      label: 'Beast Migration',
      waveMin: 12,
      waveMod: 11,
      types: ['wild_boar', 'wild_boar', 'wild_stalker'],
      count: 3,
      message:
        'Beast migration — wild packs cross the battlefield! Both sides can hunt them for TP.',
      float: 'BEASTS',
      color: '#a08050',
    },
    predator_circle: {
      id: 'predator_circle',
      label: 'Predator Circle',
      waveMin: 20,
      waveMod: 13,
      types: ['wild_harpy', 'wild_harpy'],
      count: 2,
      message: 'Harpy predators circle overhead — they strike whoever is nearest!',
      float: 'HARPYS',
      color: '#9080c0',
    },
    ancient_grove: {
      id: 'ancient_grove',
      label: 'Ancient Grove',
      waveMin: 40,
      waveMod: 17,
      types: ['wild_treant'],
      count: 1,
      message: 'An ancient treant stirs in the northern wilds — high risk, rich spoils.',
      float: 'TREANT',
      color: '#508848',
    },
    carrion_feed: {
      id: 'carrion_feed',
      label: 'Carrion Feed',
      waveMin: 10,
      types: ['wild_boar', 'wild_stalker'],
      count: 2,
      message: 'Carrion beasts drawn to the slaughter — neutral scavengers join the fray!',
      float: 'CARRION',
      color: '#b07040',
      deathTriggered: true,
    },
    den_disturbed: {
      id: 'den_disturbed',
      label: 'Den Disturbed',
      waveMin: 8,
      types: ['wild_boar', 'wild_stalker'],
      count: 2,
      message: 'A wild den erupts — creatures lash out at the nearest troops!',
      float: 'DEN',
      color: '#c0a060',
      denTriggered: true,
    },
  };

  let activeEvent = null;
  let waveDeaths = 0;
  let carrionTriggered = false;
  let announced = false;

  function resetRun() {
    activeEvent = null;
    waveDeaths = 0;
    carrionTriggered = false;
    announced = false;
  }

  function getDef(type) {
    return NEUTRAL_TYPES[type] || null;
  }

  function scaleStat(base, wave, territoryTier = 0) {
    const w = 1 + Math.min(0.65, (wave || 0) / 150);
    const t = 1 + Math.min(0.25, (territoryTier || 0) * 0.04);
    return base * w * t;
  }

  function createUnit(type, x, y, wave = 0, opts = {}) {
    const def = NEUTRAL_TYPES[type];
    if (!def) return null;
    const tier = opts.territoryTier ?? 0;
    const hp = Math.round(scaleStat(def.hp, wave, tier));
    return {
      id: `neutral_${type}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      type: def.id,
      spriteType: def.spriteType,
      team: 'neutral',
      isNeutral: true,
      neutralLabel: def.name,
      x,
      y,
      targetX: x,
      targetY: y,
      hp,
      maxHp: hp,
      accuracy: def.accuracy,
      damage: Math.round(scaleStat(def.damage, wave, tier)),
      range: def.range,
      baseRange: def.range,
      meleeRange: def.meleeRange,
      speed: def.speed,
      combatType: def.combatType,
      projectile: def.projectile || null,
      morale: def.morale,
      maxMorale: def.morale,
      experience: 0,
      reward: 0,
      lootTp: def.lootTp || 2,
      aggroRadius: def.aggroRadius || 140,
      canHunt: false,
      huntMode: false,
      flying: !!def.flying,
      spriteScale: def.spriteScale || 1,
      manualOrder: false,
      path: [],
      pathIndex: 0,
      pathRecalc: 0,
      pathTargetId: null,
      combatTargetId: null,
      rotation: 0,
      frame: 0,
      frameTimer: 0,
      animState: 'idle',
      attackAnimTimer: 0,
      actionTimer: Math.floor(Math.random() * 40),
      pinned: false,
      fleeing: false,
      demoralized: false,
      pinTimer: 0,
      chargeTimer: 0,
      rallyTimer: 0,
      spawnWave: wave,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 40 + Math.floor(Math.random() * 60),
      eventId: opts.eventId || null,
    };
  }

  function pickSpawnPoint(worldW, worldH, rallyY, rng = Math.random, rawCtx = {}) {
    const x = 60 + rng() * (worldW - 120);
    const y = 50 + rng() * Math.max(80, rallyY - 100);
    const pos = { x, y };
    if (typeof BiomeSpawn !== 'undefined') {
      return BiomeSpawn.biasSpawnPosition(pos, 'north', worldW, worldH, {
        ...rawCtx,
        worldW,
        worldH,
        rallyY,
      });
    }
    return pos;
  }

  function spawnPack(types, wave, ctx, eventId = null) {
    const spawned = [];
    const rng = ctx.rng || Math.random;
    for (const type of types) {
      const spot = pickSpawnPoint(ctx.worldW, ctx.worldH, ctx.rallyY, rng);
      const u = createUnit(type, spot.x, spot.y, wave, {
        territoryTier: ctx.territoryTier,
        eventId,
      });
      if (!u) continue;
      ctx.spawnUnit?.(u);
      spawned.push(u);
    }
    return spawned;
  }

  function pickWaveEvent(wave) {
    if (wave < WAVE_MIN) return null;
    for (const evt of Object.values(EVENTS)) {
      if (evt.deathTriggered || evt.denTriggered) continue;
      if (wave < evt.waveMin) continue;
      if (evt.waveMod && wave % evt.waveMod !== 0) continue;
      return evt;
    }
    if (wave >= 15 && wave % 19 === 0) return EVENTS.beast_migration;
    return null;
  }

  function runEvent(evt, wave, ctx) {
    if (!evt || !ctx) return [];
    const count = evt.count || 1;
    const types = [];
    for (let i = 0; i < count; i++) {
      types.push(evt.types[i % evt.types.length]);
    }
    const spawned = spawnPack(types, wave, ctx, evt.id);
    if (spawned.length) {
      activeEvent = { id: evt.id, label: evt.label, wave, count: spawned.length };
      ctx.hooks?.showMessage?.(evt.message, 360);
      ctx.hooks?.floatingText?.(
        ctx.worldW / 2,
        72,
        evt.float || 'WILDLIFE',
        evt.color || '#c0a060'
      );
      ctx.hooks?.addHighlight?.('wildlife', evt.label);
    }
    return spawned;
  }

  function seedDens(decorations, worldW, worldH, rallyY, territoryTier, rng = Math.random) {
    if (territoryTier < 1) return 0;
    const count = 1 + Math.floor(territoryTier / 3);
    let added = 0;
    for (let i = 0; i < count; i++) {
      const spot = pickSpawnPoint(worldW, worldH, rallyY, rng);
      decorations.push({
        type: 'neutral_den',
        id: `nden_${Date.now()}_${i}`,
        x: spot.x,
        y: spot.y,
        size: 20,
        hp: 50,
        maxHp: 50,
        blocksMove: false,
        blocksLOS: false,
        cover: 0.2,
        radius: 18,
        isNeutralDen: true,
        disturbed: false,
      });
      added++;
    }
    return added;
  }

  function disturbDen(den, wave, ctx) {
    if (!den || den.disturbed) return [];
    den.disturbed = true;
    den.hp = 0;
    const evt = EVENTS.den_disturbed;
    const types = evt.types.slice(0, evt.count);
    return spawnPack(types, wave, { ...ctx, hooks: ctx.hooks }, evt.id);
  }

  function onWaveStart(wave, ctx = {}) {
    if (wave < WAVE_MIN) return { spawned: [], event: null };
    waveDeaths = 0;
    carrionTriggered = false;
    const evt = pickWaveEvent(wave);
    const spawned = evt ? runEvent(evt, wave, ctx) : [];
    if (!announced && wave === WAVE_MIN) {
      announced = true;
      ctx.hooks?.showMessage?.(
        'Neutral wildlife roams the wilds — beasts attack both armies; slay them for TP and morale.',
        400
      );
    }
    return { spawned, event: activeEvent };
  }

  function onCombatDeath(wave, ctx = {}) {
    waveDeaths++;
    if (carrionTriggered || wave < EVENTS.carrion_feed.waveMin) return null;
    if (waveDeaths < DEATH_EVENT_MIN) return null;
    carrionTriggered = true;
    return runEvent(EVENTS.carrion_feed, wave, ctx);
  }

  function tick(updateTick, wave, ctx = {}) {
    const { decorations, units } = ctx;
    if (decorations?.length) {
      for (const d of decorations) {
        if (!d.isNeutralDen || d.disturbed || d.hp <= 0) continue;
        let combatNear = false;
        for (const u of units || []) {
          if (u.hp <= 0 || u.team === 'neutral') continue;
          if (!u.combatTargetId && !u.pathTargetId) continue;
          if (Math.hypot(u.x - d.x, u.y - d.y) > 90) continue;
          combatNear = true;
          break;
        }
        if (combatNear) {
          d.hp -= 4;
          if (d.hp <= 0) {
            disturbDen(d, wave, {
              ...ctx,
              spawnUnit: ctx.spawnUnit || ((u) => ctx.units?.push(u)),
            });
          }
        }
      }
    }

    if (updateTick % 120 === 0 && wave >= WAVE_MIN) {
      let spawnChance = 0.08;
      if (typeof NeutralRelations !== 'undefined') {
        spawnChance *= NeutralRelations.getWildlifeSpawnMult(wave);
      }
      if (typeof BiomeSpawn !== 'undefined') {
        const prof = BiomeSpawn.getDominantProfile({
          worldW: ctx.worldW,
          worldH: ctx.worldH,
          rallyY: ctx.rallyY,
          territoryTier: ctx.territoryTier,
          wave,
        });
        spawnChance *= prof.wildlifeMult || 1;
      }
      const neutrals = (units || []).filter((u) => u.team === 'neutral' && u.hp > 0).length;
      if (
        ctx.rng?.() < spawnChance &&
        neutrals < 2 &&
        (units || []).filter((u) => u.team === 'enemy' && u.hp > 0).length >= 3
      ) {
        let type = wave >= 40 ? 'wild_stalker' : 'wild_boar';
        if (typeof BiomeSpawn !== 'undefined') {
          const pick = BiomeSpawn.pickWildlifeType(
            wave,
            {
              worldW: ctx.worldW,
              worldH: ctx.worldH,
              rallyY: ctx.rallyY,
              territoryTier: ctx.territoryTier,
              wave,
            },
            ctx.rng || Math.random
          );
          type = pick.type;
        }
        const spot = pickSpawnPoint(ctx.worldW, ctx.worldH, ctx.rallyY, ctx.rng, {
          territoryTier: ctx.territoryTier,
          wave,
        });
        const u = createUnit(type, spot.x, spot.y, wave, { territoryTier: ctx.territoryTier });
        if (u) ctx.spawnUnit?.(u);
      }
    }
  }

  function findAggroTarget(unit, units, wave = 0) {
    if (typeof NeutralRelations !== 'undefined') {
      return NeutralRelations.findAggroTarget(unit, units, wave);
    }
    let best = null;
    let bestD = Infinity;
    const radius = unit.aggroRadius || 140;
    for (const u of units) {
      if (!u || u.hp <= 0 || u.team === 'neutral' || u.fleeing || u.demoralized) continue;
      const d = Math.hypot(u.x - unit.x, u.y - unit.y);
      if (d > radius || d >= bestD) continue;
      bestD = d;
      best = u;
    }
    return best;
  }

  function updateAI(unit, ctx = {}) {
    if (!unit || unit.hp <= 0 || unit.team !== 'neutral') return;
    const { units, steerToward, inAttackRange, fireWeapon, lineOfSight, wave = 0 } = ctx;

    if (unit.wanderTimer > 0) unit.wanderTimer--;
    const target = unit.combatTargetId
      ? units.find((u) => {
          if (!u || u.hp <= 0 || u.team === 'neutral') return false;
          if (unit.alliedToPlayer && u.team !== 'enemy') return false;
          return u.id === unit.combatTargetId;
        })
      : null;
    const foe = target || findAggroTarget(unit, units, wave);

    if (foe) {
      // Edge-adjacent fights often fail strict LOS through border decorations — still engage.
      const hasLos = lineOfSight?.(unit.x, unit.y, foe.x, foe.y);
      const closeEnough =
        Math.hypot(foe.x - unit.x, foe.y - unit.y) <=
        (unit.aggroRadius || 140) * 1.15;
      if (hasLos === false && !closeEnough) {
        unit.combatTargetId = null;
      } else {
        unit.combatTargetId = foe.id;
        if (inAttackRange?.(unit, foe)) {
          unit.path = [];
          unit.actionTimer = (unit.actionTimer || 0) - 1;
          if (unit.actionTimer <= 0) {
            fireWeapon?.(unit, foe);
            unit.actionTimer = Math.max(14, 80 - (unit.experience || 0) * 2);
          }
          return;
        }
        // Aim slightly inward from the foe so edge clamp does not pin us outside melee.
        const dx = foe.x - unit.x;
        const dy = foe.y - unit.y;
        const d = Math.hypot(dx, dy) || 1;
        const standoff = Math.max(10, (unit.meleeRange || 24) * 0.55);
        const ax = foe.x - (dx / d) * standoff;
        const ay = foe.y - (dy / d) * standoff;
        if (!steerToward?.(unit, ax, ay)) {
          steerToward?.(unit, foe.x, foe.y);
        }
        return;
      }
    }

    unit.combatTargetId = null;
    if (unit.wanderTimer <= 0) {
      unit.wanderAngle += (Math.random() - 0.5) * 1.2;
      unit.wanderTimer = 50 + Math.floor(Math.random() * 40);
    }
    const wx = unit.x + Math.cos(unit.wanderAngle) * unit.speed * 0.6;
    const wy = unit.y + Math.sin(unit.wanderAngle) * unit.speed * 0.6;
    steerToward?.(unit, wx, wy);
  }

  function onSlain(unit, ctx = {}) {
    if (!unit?.isNeutral) return null;
    const killer = ctx.units?.find(
      (u) => u.combatTargetId === unit.id && u.hp > 0 && u.team !== 'neutral'
    );
    const loot = unit.lootTp || 2;
    if (killer?.team === 'player') {
      ctx.grantTp?.(loot);
      killer.experience = (killer.experience || 0) + 1;
      if (killer.morale != null) killer.morale = Math.min(killer.maxMorale, killer.morale + 2);
      ctx.hooks?.floatingText?.(unit.x, unit.y, `+${loot} TP`, '#c0ffa0');
    } else if (killer?.team === 'enemy') {
      ctx.hooks?.floatingText?.(unit.x, unit.y, 'SCAVENGED', '#c0a060');
    }
    return { loot, killerTeam: killer?.team || null };
  }

  function getStateSnapshot(units, wave) {
    const neutrals = (units || []).filter((u) => u.team === 'neutral' && u.hp > 0);
    const byType = {};
    for (const u of neutrals) {
      byType[u.type] = (byType[u.type] || 0) + 1;
    }
    const parts = Object.entries(byType).map(([t, n]) => {
      const def = NEUTRAL_TYPES[t];
      return `${n}× ${def?.name || t}`;
    });
    return {
      active: neutrals.length > 0 || !!activeEvent,
      count: neutrals.length,
      event: activeEvent,
      summary: parts.length ? parts.join(' · ') : activeEvent?.label || null,
      waveDeaths,
      types: Object.values(NEUTRAL_TYPES).map((d) => ({
        id: d.id,
        name: d.name,
        desc: `${d.name} — neutral threat; +${d.lootTp} TP if your troops slay it.`,
        color: d.color,
      })),
      waveMin: WAVE_MIN,
    };
  }

  return {
    WAVE_MIN,
    NEUTRAL_TYPES,
    EVENTS,
    resetRun,
    getDef,
    createUnit,
    seedDens,
    onWaveStart,
    onCombatDeath,
    tick,
    updateAI,
    onSlain,
    getStateSnapshot,
    pickWaveEvent,
    pickSpawnPoint,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.NeutralWildlife = NeutralWildlife;
