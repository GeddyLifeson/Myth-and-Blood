/**
 * Veteran deeds, the traits they earn, and the Hall of Veterans roll.
 * A trait is earned by one counted deed and changes one narrow thing, with a named price.
 */
const Veterans = (() => {
  // Rank at which each trait slot opens; rank 6 is the highest.
  const SLOT_TIERS = [1, 2, 4, 6];
  // A raised veteran comes back one rank down and weaker for every death.
  const RAISED_TIER = 5;
  const DEATH_HP_MULT = 0.9;
  const RAISE_COST_MULT = 6;

  const GOBLINS = ['goblin', 'goblin_sapper', 'goblin_engineer'];
  const ORCS = ['orc', 'orc_archer'];
  const SAPPERS = ['goblin_sapper', 'goblin_engineer'];

  const sum = (d, types) => types.reduce((n, t) => n + (d.k[t] || 0), 0);

  /**
   * fx: `deal` multiplies damage this veteran deals, `take` damage it takes. `foe` narrows
   * it to enemy types or a kind; `when` to a state of the veteran. `stats` apply once.
   */
  const TRAITS = {
    goblin_reaper: {
      name: 'Goblin-Reaper',
      measure: 'Ruin',
      deed: 'Killed 30 goblins',
      gain: '+25% damage to goblins',
      cost: '-10% damage to trolls',
      need: (d) => sum(d, GOBLINS) >= 30,
      fx: [
        { deal: 1.25, foe: GOBLINS },
        { deal: 0.9, foe: ['troll'] },
      ],
    },
    orc_breaker: {
      name: 'Orc-Breaker',
      measure: 'Ruin',
      deed: 'Killed 25 orcs',
      gain: '+20% damage to orcs and orc archers',
      cost: '+10% damage taken from berserkers',
      need: (d) => sum(d, ORCS) >= 25,
      fx: [
        { deal: 1.2, foe: ORCS },
        { take: 1.1, foe: ['berserker'] },
      ],
    },
    knightsbane: {
      name: 'Knightsbane',
      measure: 'Ruin',
      deed: 'Killed 8 dark knights',
      gain: '+30% damage to dark knights',
      cost: '+15% damage taken from dark mages',
      need: (d) => sum(d, ['dark_knight']) >= 8,
      fx: [
        { deal: 1.3, foe: ['dark_knight'] },
        { take: 1.15, foe: ['dark_mage'] },
      ],
    },
    trollfeller: {
      name: 'Trollfeller',
      measure: 'Ruin',
      deed: 'Killed 5 trolls',
      gain: '+35% damage to trolls',
      cost: '-10% damage to goblins',
      need: (d) => sum(d, ['troll']) >= 5,
      fx: [
        { deal: 1.35, foe: ['troll'] },
        { deal: 0.9, foe: GOBLINS },
      ],
    },
    wolfbane: {
      name: 'Wolfbane',
      measure: 'Ruin',
      deed: 'Killed 10 warg riders',
      gain: '+30% damage to warg riders',
      cost: '-10% damage to siege towers',
      need: (d) => sum(d, ['warg_rider']) >= 10,
      fx: [
        { deal: 1.3, foe: ['warg_rider'] },
        { deal: 0.9, foe: ['siege_tower'] },
      ],
    },
    beast_slayer: {
      name: 'Beast-Slayer',
      measure: 'Ruin',
      deed: 'Killed 5 monsters',
      gain: '+25% damage to monsters',
      cost: '+10% damage taken from dark mages',
      need: (d) => d.monster >= 5,
      fx: [
        { deal: 1.25, foe: 'monster' },
        { take: 1.1, foe: ['dark_mage'] },
      ],
    },
    arrow_catcher: {
      name: 'Arrow-Catcher',
      measure: 'Continuity',
      deed: 'Killed 12 orc archers',
      gain: '-25% damage taken from orc archers',
      cost: '5% slower on the march',
      need: (d) => sum(d, ['orc_archer']) >= 12,
      fx: [{ take: 0.75, foe: ['orc_archer'] }],
      stats: { speed: 0.95 },
    },
    rage_breaker: {
      name: 'Rage-Breaker',
      measure: 'Continuity',
      deed: 'Killed 8 berserkers',
      gain: '-25% damage taken from berserkers',
      cost: '-10% damage to dark knights',
      need: (d) => sum(d, ['berserker']) >= 8,
      fx: [
        { take: 0.75, foe: ['berserker'] },
        { deal: 0.9, foe: ['dark_knight'] },
      ],
    },
    old_guard: {
      name: 'Old Guard',
      measure: 'Continuity',
      deed: 'Lived through 25 waves',
      gain: '-15% damage taken from horde grunts',
      cost: '10% slower on the march',
      need: (d) => d.waves >= 25,
      fx: [{ take: 0.85, foe: 'grunt' }],
      stats: { speed: 0.9 },
    },
    wallguard: {
      name: 'Wallguard',
      measure: 'Continuity',
      deed: 'Made 15 kills from a wall',
      gain: '+20% damage while on a wall',
      cost: '-15% damage off the wall',
      need: (d) => d.wall >= 15,
      fx: [
        { deal: 1.2, when: 'wall' },
        { deal: 0.85, when: 'offwall' },
      ],
    },
    shadow_catcher: {
      name: 'Shadow-Catcher',
      measure: 'Celerity',
      deed: 'Killed 5 assassins',
      gain: '+40% damage to assassins',
      cost: '-10% damage to orcs',
      need: (d) => sum(d, ['assassin']) >= 5,
      fx: [
        { deal: 1.4, foe: ['assassin'] },
        { deal: 0.9, foe: ORCS },
      ],
    },
    bloodied: {
      name: 'Bloodied',
      measure: 'Celerity',
      deed: 'Made 10 kills while below half health',
      gain: '+25% damage while below half health',
      cost: '-10% damage while above 90% health',
      need: (d) => d.hurt >= 10,
      fx: [
        { deal: 1.25, when: 'low50' },
        { deal: 0.9, when: 'high90' },
      ],
    },
    counter_archer: {
      name: 'Counter-Archer',
      measure: 'Reach',
      deed: 'Shot down 20 enemy shooters',
      gain: '+20% damage to enemy shooters',
      cost: '-10% damage to enemies that fight hand to hand',
      need: (d) => d.ranged >= 20,
      fx: [
        { deal: 1.2, foe: 'ranged' },
        { deal: 0.9, foe: 'melee' },
      ],
    },
    tower_toppler: {
      name: 'Tower-Toppler',
      measure: 'Reach',
      deed: 'Destroyed 3 siege towers',
      gain: '+40% damage to siege towers',
      cost: '-10% damage to warg riders',
      need: (d) => sum(d, ['siege_tower']) >= 3,
      fx: [
        { deal: 1.4, foe: ['siege_tower'] },
        { deal: 0.9, foe: ['warg_rider'] },
      ],
    },
    giantsbane: {
      name: 'Giantsbane',
      measure: 'Transgression',
      deed: 'Killed a named boss',
      gain: '+20% damage to named bosses',
      cost: '+10% damage taken from horde grunts',
      need: (d) => d.boss >= 1,
      fx: [
        { deal: 1.2, foe: 'boss' },
        { take: 1.1, foe: 'grunt' },
      ],
    },
    kingslayer: {
      name: 'Kingslayer',
      measure: 'Transgression',
      deed: 'Killed 3 named bosses',
      gain: '+35% damage to named bosses',
      cost: '+20% damage taken from horde grunts',
      replaces: 'giantsbane',
      need: (d) => d.boss >= 3,
      fx: [
        { deal: 1.35, foe: 'boss' },
        { take: 1.2, foe: 'grunt' },
      ],
    },
    chiefslayer: {
      name: 'Chiefslayer',
      measure: 'Transgression',
      deed: 'Killed a war chief',
      gain: '+25% damage to war chiefs',
      cost: '+10% damage taken from orcs',
      need: (d) => sum(d, ['war_chief']) >= 1,
      fx: [
        { deal: 1.25, foe: ['war_chief'] },
        { take: 1.1, foe: ORCS },
      ],
    },
    last_breath: {
      name: 'Last Breath',
      measure: 'Sustain',
      deed: 'Ended 3 waves below a quarter health',
      gain: '-30% damage taken while below a quarter health',
      cost: '-10% damage while above 75% health',
      need: (d) => d.close >= 3,
      fx: [
        { take: 0.7, when: 'low25' },
        { deal: 0.9, when: 'high75' },
      ],
    },
    gravewarden: {
      name: 'Gravewarden',
      measure: 'Sustain',
      deed: 'Killed 5 necromancers',
      gain: '+35% damage to necromancers',
      cost: '+10% damage taken from assassins',
      need: (d) => sum(d, ['necromancer']) >= 5,
      fx: [
        { deal: 1.35, foe: ['necromancer'] },
        { take: 1.1, foe: ['assassin'] },
      ],
    },
    runner_catcher: {
      name: 'Runner-Catcher',
      measure: 'Vector',
      deed: 'Cut down 6 line-breakers',
      gain: '+30% damage to line-breakers',
      cost: '-10% damage to elites',
      need: (d) => d.runner >= 6,
      fx: [
        { deal: 1.3, foe: 'runner' },
        { deal: 0.9, foe: 'elite' },
      ],
    },
    fuse_cutter: {
      name: 'Fuse-Cutter',
      measure: 'Vector',
      deed: 'Killed 8 goblin sappers or engineers',
      gain: '+40% damage to goblin sappers and engineers',
      cost: '+10% damage taken from trolls',
      need: (d) => sum(d, SAPPERS) >= 8,
      fx: [
        { deal: 1.4, foe: SAPPERS },
        { take: 1.1, foe: ['troll'] },
      ],
    },
    line_holder: {
      name: 'Line-Holder',
      measure: 'Volition',
      deed: 'Made 20 kills while ordered to hold',
      gain: '+20% damage while holding',
      cost: '-20% damage while hunting',
      need: (d) => d.held >= 20,
      fx: [
        { deal: 1.2, when: 'holding' },
        { deal: 0.8, when: 'hunting' },
      ],
    },
    oathkeeper: {
      name: 'Oathkeeper',
      measure: 'Suasion',
      deed: 'Ended 10 waves still holding the post',
      gain: '+8 morale',
      cost: '10% slower on the march',
      need: (d) => d.heldWaves >= 10,
      fx: [],
      stats: { maxMorale: 8, speed: 0.9 },
    },
    elite_hunter: {
      name: 'Elite-Hunter',
      measure: 'Acumen',
      deed: 'Killed 15 elites',
      gain: '+15% damage to elites',
      cost: '-10% damage to horde grunts',
      need: (d) => d.elite >= 15,
      fx: [
        { deal: 1.15, foe: 'elite' },
        { deal: 0.9, foe: 'grunt' },
      ],
    },
    witch_hunter: {
      name: 'Witch-Hunter',
      measure: 'Discernment',
      deed: 'Killed 8 dark mages',
      gain: '+30% damage to dark mages and shamans',
      cost: '+15% damage taken from dark knights',
      need: (d) => sum(d, ['dark_mage']) >= 8,
      fx: [
        { deal: 1.3, foe: ['dark_mage', 'shaman'] },
        { take: 1.15, foe: ['dark_knight'] },
      ],
    },
    shaman_silencer: {
      name: 'Shaman-Silencer',
      measure: 'Discernment',
      deed: 'Killed 5 shamans',
      gain: '+50% damage to shamans',
      cost: '+10% damage taken from war chiefs',
      need: (d) => sum(d, ['shaman']) >= 5,
      fx: [
        { deal: 1.5, foe: ['shaman'] },
        { take: 1.1, foe: ['war_chief'] },
      ],
    },
  };

  let hall = [];
  let nextHallId = 1;

  function deeds(unit) {
    const d = unit.deeds || (unit.deeds = {});
    d.k = d.k || {};
    for (const key of ['boss', 'elite', 'monster', 'runner', 'ranged', 'held', 'wall', 'hurt'])
      d[key] = d[key] || 0;
    for (const key of ['close', 'heldWaves', 'waves']) d[key] = d[key] || 0;
    return d;
  }

  function foeIs(foe, kind) {
    if (Array.isArray(kind)) return kind.includes(foe.type);
    const def = typeof EnemyDefs !== 'undefined' ? EnemyDefs[foe.type] : null;
    if (kind === 'boss') return !!(foe.isNamedBoss || def?.isNamedBoss);
    if (kind === 'monster') return isMonsterEnemy(foe);
    if (kind === 'elite') return isEliteEnemy(foe);
    if (kind === 'grunt') return !!def?.isHordeGrunt;
    if (kind === 'runner') return !!foe.lineBreaker;
    if (kind === 'ranged') return foe.combatType === 'ranged';
    if (kind === 'melee') return foe.combatType === 'melee';
    return false;
  }

  function inState(u, when) {
    const pct = u.maxHp > 0 ? u.hp / u.maxHp : 1;
    if (when === 'holding') return !!u.holding;
    if (when === 'hunting') return !u.holding;
    if (when === 'wall') return !!u.wallGarrisoned;
    if (when === 'offwall') return !u.wallGarrisoned;
    if (when === 'low25') return pct < 0.25;
    if (when === 'low50') return pct < 0.5;
    if (when === 'high75') return pct > 0.75;
    if (when === 'high90') return pct > 0.9;
    return false;
  }

  function slots(unit) {
    const tier = unit?.vetTier || 0;
    return SLOT_TIERS.filter((t) => tier >= t).length;
  }

  function applyStats(unit, stats, undo) {
    if (!stats) return;
    if (stats.speed) {
      const m = undo ? 1 / stats.speed : stats.speed;
      unit.speed = Math.round(unit.speed * m * 100) / 100;
    }
    if (stats.maxMorale) {
      const n = undo ? -stats.maxMorale : stats.maxMorale;
      unit.maxMorale = Math.max(1, (unit.maxMorale || 0) + n);
      unit.morale = Math.min(unit.maxMorale, (unit.morale || 0) + Math.max(0, n));
    }
  }

  function grantTrait(unit, id) {
    const t = TRAITS[id];
    if (!t || !unit || unit.team !== 'player') return false;
    const traits = unit.traits || (unit.traits = []);
    if (traits.includes(id)) return false;
    const old = t.replaces ? traits.indexOf(t.replaces) : -1;
    if (old >= 0) {
      applyStats(unit, TRAITS[t.replaces].stats, true);
      traits[old] = id;
    } else {
      if (traits.length >= slots(unit)) return false;
      traits.push(id);
    }
    applyStats(unit, t.stats, false);
    return true;
  }

  /** Grants every trait the unit has earned and has room for; inscribes it at top rank. */
  function check(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || !(unit.hp > 0)) return [];
    const d = deeds(unit);
    const gained = [];
    for (const id of Object.keys(TRAITS)) {
      const t = TRAITS[id];
      if ((unit.traits || []).includes(id) || !t.need(d, unit)) continue;
      // A veteran who already holds the stronger form does not go back to the weaker one.
      if (
        Object.keys(TRAITS).some(
          (o) => TRAITS[o].replaces === id && (unit.traits || []).includes(o)
        )
      )
        continue;
      if (grantTrait(unit, id)) gained.push(id);
    }
    if ((unit.vetTier || 0) >= MAX_VETERAN_TIER && !unit.hallId) inscribe(unit, wave);
    return gained;
  }

  function recordKill(killer, foe, wave = 0) {
    if (!killer || killer.team !== 'player' || !foe) return [];
    const d = deeds(killer);
    d.k[foe.type] = (d.k[foe.type] || 0) + 1;
    if (foeIs(foe, 'boss')) d.boss++;
    if (foeIs(foe, 'elite')) d.elite++;
    if (foeIs(foe, 'monster')) d.monster++;
    if (foeIs(foe, 'runner')) d.runner++;
    if (foeIs(foe, 'ranged') && (killer.combatType === 'ranged' || killer.projectile)) d.ranged++;
    if (killer.holding) {
      d.held++;
      d.heldKillThisWave = true;
    }
    if (killer.wallGarrisoned) d.wall++;
    if (killer.maxHp > 0 && killer.hp / killer.maxHp < 0.5) d.hurt++;
    return check(killer, wave);
  }

  function endWave(unit, wave = 0) {
    if (!unit || unit.team !== 'player' || !(unit.hp > 0)) return [];
    const d = deeds(unit);
    d.waves++;
    if (unit.maxHp > 0 && unit.hp / unit.maxHp < 0.25) d.close++;
    if (unit.holding && d.heldKillThisWave) d.heldWaves++;
    d.heldKillThisWave = false;
    return check(unit, wave);
  }

  /** One multiplier for a hit: the attacker's dealing traits and the target's taking traits. */
  function damageMult(attacker, target) {
    let m = 1;
    if (attacker?.team === 'player' && attacker.traits?.length && target?.team === 'enemy') {
      for (const id of attacker.traits) {
        for (const f of TRAITS[id]?.fx || []) {
          if (!f.deal) continue;
          if (f.foe && !foeIs(target, f.foe)) continue;
          if (f.when && !inState(attacker, f.when)) continue;
          m *= f.deal;
        }
      }
    }
    if (target?.team === 'player' && target.traits?.length) {
      for (const id of target.traits) {
        for (const f of TRAITS[id]?.fx || []) {
          if (!f.take) continue;
          if (f.foe && !(attacker?.team === 'enemy' && foeIs(attacker, f.foe))) continue;
          if (f.when && !inState(target, f.when)) continue;
          m *= f.take;
        }
      }
    }
    return m;
  }

  function describe(unit) {
    const held = (unit?.traits || [])
      .filter((id) => TRAITS[id])
      .map((id) => {
        const t = TRAITS[id];
        return { id, name: t.name, measure: t.measure, deed: t.deed, gain: t.gain, cost: t.cost };
      });
    const open = slots(unit);
    const nextTier = SLOT_TIERS.find((t) => (unit?.vetTier || 0) < t) || null;
    return { traits: held, slots: open, maxSlots: SLOT_TIERS.length, nextSlotTier: nextTier };
  }

  /** Old saves have ranks but no deeds: credit the waves and kills the unit already shows. */
  function migrate(unit) {
    if (!unit || unit.team !== 'player' || unit.deeds) return;
    const d = deeds(unit);
    d.waves = unit.wavesSurvived || 0;
    unit.traits = unit.traits || [];
  }

  function entryOf(unit) {
    return unit?.hallId ? hall.find((e) => e.id === unit.hallId) || null : null;
  }

  function snapshot(entry, unit) {
    entry.type = unit.type;
    entry.name = getUnitDisplayName(unit);
    entry.honorName = unit.honorName || null;
    entry.traits = [...(unit.traits || [])];
    entry.deeds = JSON.parse(JSON.stringify(deeds(unit)));
    entry.kills = unit.kills || 0;
  }

  function inscribe(unit, wave = 0) {
    const entry = { id: nextHallId++, fallen: false, deaths: 0, wave, fellWave: null };
    snapshot(entry, unit);
    unit.hallId = entry.id;
    hall.push(entry);
    return entry;
  }

  /** Call when a unit dies. Only a name already on the roll can be raised later. */
  function onDeath(unit, wave = 0) {
    const entry = entryOf(unit);
    if (!entry) return null;
    snapshot(entry, unit);
    entry.fallen = true;
    entry.deaths++;
    entry.fellWave = wave;
    return entry;
  }

  function raiseCost(entry) {
    const def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(entry.type) : null;
    return Math.ceil(
      (def?.cost || 5) * RAISE_COST_MULT * Math.pow(2, Math.max(0, entry.deaths - 1))
    );
  }

  /** Turns a freshly spawned unit into the raised veteran: one rank down, weaker per death. */
  function restore(unit, entry) {
    unit.vetTier = RAISED_TIER;
    syncVeteranStatsToTier(unit);
    unit.honorName = entry.honorName || unit.honorName;
    unit.deeds = JSON.parse(JSON.stringify(entry.deeds || {}));
    unit.kills = entry.kills || 0;
    unit.traits = [];
    unit.hallId = entry.id;
    unit.timesRaised = entry.deaths;
    for (const id of entry.traits || []) grantTrait(unit, id);
    unit.maxHp = Math.max(1, Math.floor(unit.maxHp * Math.pow(DEATH_HP_MULT, entry.deaths)));
    unit.hp = unit.maxHp;
    entry.fallen = false;
    return unit;
  }

  function getHall() {
    return hall;
  }

  function setHall(list) {
    // A save can be pasted in as text, so every field is coerced before it reaches the page.
    const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
    hall = (Array.isArray(list) ? list : [])
      .filter((e) => e && typeof e.type === 'string')
      .map((e) => ({
        id: num(e.id),
        type: e.type,
        name: String(e.name || ''),
        honorName: e.honorName ? String(e.honorName) : null,
        traits: (Array.isArray(e.traits) ? e.traits : []).filter((id) => TRAITS[id]),
        deeds: e.deeds && typeof e.deeds === 'object' ? e.deeds : {},
        kills: num(e.kills),
        fallen: !!e.fallen,
        deaths: num(e.deaths),
        wave: num(e.wave),
        fellWave: e.fellWave == null ? null : num(e.fellWave),
      }));
    nextHallId = hall.reduce((n, e) => Math.max(n, (e.id || 0) + 1), 1);
  }

  function exportHall() {
    return JSON.parse(JSON.stringify(hall));
  }

  /** Carries a roll into a new run: every name arrives fallen and must be raised again. */
  function importHall(list) {
    setHall(list);
    for (const e of hall) {
      if (!e.fallen) e.deaths = (e.deaths || 0) + 1;
      e.fallen = true;
    }
  }

  /** Why the Hall cannot be built yet, or null. It is raised for a name already on the roll. */
  function hallBuildBlock() {
    return hall.length ? null : `needs a veteran at rank ${MAX_VETERAN_TIER} to raise it for`;
  }

  return {
    TRAITS,
    SLOT_TIERS,
    RAISED_TIER,
    check,
    damageMult,
    deeds,
    describe,
    endWave,
    entryOf,
    exportHall,
    getHall,
    grantTrait,
    hallBuildBlock,
    importHall,
    migrate,
    onDeath,
    raiseCost,
    recordKill,
    restore,
    setHall,
    slots,
  };
})();
