/**
 * Strategy counterplay — detect dominant player builds and apply soft enemy
 * answers plus player tool bonuses (anti-siege, anti-air, anti-cav, etc.).
 */
const StrategyCounterplay = (() => {
  const STRATEGIES = {
    wall_fortress: {
      id: 'wall_fortress',
      label: 'Wall Fortress',
      detect(s, wave) {
        return s.wallCount >= 6 || (s.wallCount >= 4 && s.castleValue > 0);
      },
      pool: ['siege_tower', 'siege_tower', 'goblin_sapper', 'goblin_sapper', 'goblin_engineer', 'goblin_burrower', 'troll'],
      weights: { siege_tower: 2.8, goblin_sapper: 2.4, goblin_engineer: 1.9, goblin_burrower: 1.6, troll: 1.5 },
      playerTools: 'Sappers and ballistas shred siege towers — pikemen catch warg flanks.',
      intervalMult: 0.96,
    },
    garrison_bastion: {
      id: 'garrison_bastion',
      label: 'Garrison Bastion',
      detect(s) {
        return s.wallGarrison >= 4;
      },
      pool: ['siege_tower', 'goblin_sapper', 'warg_rider', 'assassin'],
      weights: { siege_tower: 2.2, warg_rider: 1.7, assassin: 1.5, goblin_sapper: 2 },
      playerTools: 'Scouts and cavalry sorties break garrison stalemates — kill towers first.',
      intervalMult: 0.98,
    },
    settlement_tycoon: {
      id: 'settlement_tycoon',
      label: 'Settlement Economy',
      detect(s) {
        return s.hamletCount >= 2 && s.guildCount >= 2;
      },
      pool: ['goblin_sapper', 'goblin_engineer', 'assassin', 'orc', 'orc'],
      weights: { goblin_sapper: 2, goblin_engineer: 1.8, assassin: 1.6, orc: 1.3 },
      playerTools: 'Raid northern holds or dispatch hunters — assassins probe your hamlets.',
      intervalMult: 0.94,
    },
    academy_spam: {
      id: 'academy_spam',
      label: 'Academy Grid',
      detect(s) {
        return s.academyCount >= 3;
      },
      pool: ['dark_mage', 'necromancer', 'shaman', 'assassin'],
      weights: { dark_mage: 2, necromancer: 2.1, shaman: 1.7, assassin: 1.4 },
      playerTools: 'Mages and bards answer arcane pressure — spread academies behind walls.',
      intervalMult: 1,
    },
    ranged_deathball: {
      id: 'ranged_deathball',
      label: 'Ranged Deathball',
      detect(s) {
        const ranged = (s.rangedCount || 0) + (s.ballistaCount || 0);
        return ranged >= 4 || (s.militaryUnits >= 6 && ranged / Math.max(1, s.militaryUnits) >= 0.45);
      },
      pool: ['harpy', 'sky_drake', 'goblin_burrower', 'warg_rider', 'assassin'],
      weights: { harpy: 2.2, sky_drake: 2, goblin_burrower: 1.6, warg_rider: 1.5, assassin: 1.3 },
      playerTools: 'Pikemen and ballistas counter flyers — scouts reveal burrowers.',
      intervalMult: 0.97,
    },
    cavalry_core: {
      id: 'cavalry_core',
      label: 'Cavalry Core',
      detect(s) {
        return (s.cavalryCount || 0) >= 3;
      },
      pool: ['dark_knight', 'berserker', 'warg_rider', 'iron_colossus'],
      weights: { dark_knight: 2, berserker: 1.8, warg_rider: 1.6, iron_colossus: 1.4 },
      playerTools: 'Enemy bruisers and wargs answer cavalry — keep pikemen on the flanks.',
      intervalMult: 0.95,
    },
    healer_sustain: {
      id: 'healer_sustain',
      label: 'Healer Sustain',
      detect(s) {
        return (s.healerCount || 0) >= 2;
      },
      pool: ['assassin', 'dark_mage', 'necromancer', 'berserker'],
      weights: { assassin: 2.3, dark_mage: 1.7, necromancer: 1.6, berserker: 1.4 },
      playerTools: 'Assassins and dark mages punish heal lines — bodyguard with footmen.',
      intervalMult: 0.96,
    },
    tp_hoard: {
      id: 'tp_hoard',
      label: 'TP Reserve',
      detect(s, wave) {
        const eased = typeof academyEase === 'function' ? academyEase(wave) : Math.min(1, wave / 100);
        const baseline = 24 + eased * 140;
        return (s.liquidTp || 0) >= baseline * 1.35;
      },
      pool: ['assassin', 'goblin_sapper', 'warg_rider'],
      weights: { assassin: 1.8, goblin_sapper: 1.6, warg_rider: 1.4 },
      playerTools: 'Hoarded TP draws faster raids — spend on veterans and counter-tools.',
      intervalMult: 0.9,
    },
    crossover_roster: {
      id: 'crossover_roster',
      label: 'Crossover Roster',
      detect(s) {
        return (s.crossoverCount || 0) + (s.wweCount || 0) >= 3;
      },
      pool: ['troll', 'berserker', 'assassin', 'void_stalker', 'abomination'],
      weights: { troll: 1.9, berserker: 1.8, assassin: 1.7, void_stalker: 1.5 },
      playerTools: 'Host fields faction counters — check INTEL for weak crossover matchups.',
      intervalMult: 0.98,
    },
  };

  let activeStrategies = [];
  let lastIntelKey = '';

  function resetRun() {
    activeStrategies = [];
    lastIntelKey = '';
  }

  function enrichSignals(signals, units = []) {
    const out = { ...signals };
    out.rangedCount = 0;
    out.cavalryCount = 0;
    out.healerCount = 0;
    out.sapperCount = 0;
    out.ballistaCount = 0;
    out.pikemanCount = 0;
    out.scoutCount = 0;
    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      const t = u.type;
      if (t === 'archer' || t === 'mage' || t === 'bard') out.rangedCount++;
      if (t === 'ballista') {
        out.rangedCount++;
        out.ballistaCount++;
      }
      if (t === 'cavalry' || t === 'knight') out.cavalryCount++;
      if (t === 'healer') out.healerCount++;
      if (t === 'sapper') out.sapperCount++;
      if (t === 'pikeman') out.pikemanCount++;
      if (t === 'scout') out.scoutCount++;
    }
    return out;
  }

  function detect(colony, wave = 0, units = []) {
    const signals = enrichSignals(colony?.signals || {}, units);
    const found = [];
    for (const def of Object.values(STRATEGIES)) {
      if (def.detect(signals, wave)) found.push(def);
    }
    activeStrategies = found;
    return found;
  }

  function applyToPressure(pressure, strategies = activeStrategies) {
    if (!pressure || !strategies.length) return pressure;
    const poolExtras = [...(pressure.poolExtras || [])];
    const weights = { ...(pressure.weights || {}) };
    let intervalMult = pressure.intervalMult ?? 1;
    for (const s of strategies) {
      for (const t of s.pool || []) {
        if (typeof EnemyDefs !== 'undefined' && !EnemyDefs[t]) continue;
        poolExtras.push(t);
      }
      for (const [t, w] of Object.entries(s.weights || {})) {
        weights[t] = Math.max(weights[t] || 1, w);
      }
      if (s.intervalMult) intervalMult = Math.min(intervalMult, s.intervalMult);
    }
    return { ...pressure, poolExtras, weights, intervalMult };
  }

  function isSiegeTarget(target) {
    if (!target || target.hp <= 0) return false;
    if (target.type === 'siege_tower' || target.type === 'goblin_sapper') return true;
    if (target.siegeDeployed) return true;
    if (target.type === 'iron_colossus' || target.type === 'boss_karg' || target.type === 'boss_volk')
      return true;
    if (target.combatType === 'siege' && (target.siegeMult || 1) >= 2.2) return true;
    return false;
  }

  function isFlyingTarget(target) {
    return !!(target?.flying || target?.type === 'harpy' || target?.type === 'sky_drake');
  }

  function isCavalryTarget(target) {
    return !!(target?.combatType === 'cavalry' || target?.type === 'warg_rider' || target?.type === 'knight');
  }

  function modifyDamage(unit, target, dmg) {
    if (!unit || !target || dmg <= 0) return dmg;
    let d = dmg;
    if (unit.team === 'player') {
      if (isSiegeTarget(target)) {
        if (unit.type === 'sapper') d = Math.round(d * 1.55);
        else if (unit.type === 'ballista') d = Math.round(d * 1.75);
        else if (unit.type === 'pikeman') d = Math.round(d * 1.22);
      }
      if (unit.type === 'ballista' && isFlyingTarget(target)) d = Math.round(d * 1.45);
      if (unit.type === 'pikeman' && isCavalryTarget(target)) d = Math.round(d * 1.35);
    }
    if (unit.team === 'enemy' && target.team === 'player') {
      if (unit.type === 'assassin' && target.type === 'healer') d = Math.round(d * 1.32);
      if (unit.type === 'dark_mage' && (target.type === 'mage' || target.type === 'healer'))
        d = Math.round(d * 1.18);
      if (isCavalryTarget(target) && (unit.type === 'dark_knight' || unit.type === 'berserker'))
        d = Math.round(d * 1.12);
    }
    return d;
  }

  function modifyBuildingDamage(unit, building, dmg) {
    if (!unit || !building || dmg <= 0) return dmg;
    if (unit.team !== 'player' || building.owner !== 'enemy') return dmg;
    if (unit.type === 'sapper' && (building.type === 'wall' || building.blocksMove)) {
      return Math.round(dmg * 1.12);
    }
    if (unit.type === 'ballista' && (building.isHamlet || building.isMerchantGuild)) {
      return Math.round(dmg * 1.15);
    }
    return dmg;
  }

  function getTargetScoreBias(unit, foe) {
    if (!unit || !foe || unit.team !== 'player') return 0;
    let bias = 0;
    if (unit.type === 'sapper' && isSiegeTarget(foe)) bias -= 220;
    if (unit.type === 'ballista') {
      if (isSiegeTarget(foe)) bias -= 200;
      if (isFlyingTarget(foe)) bias -= 160;
    }
    if (unit.type === 'pikeman') {
      if (isCavalryTarget(foe)) bias -= 180;
      if (foe.type === 'goblin_sapper') bias -= 120;
    }
    if (unit.type === 'scout' && (foe.stealthed || foe.burrowed)) bias -= 140;
    if (unit.type === 'assassin' && foe.type === 'healer') bias -= 100;
    return bias;
  }

  function formatCounterIntel(strategies = activeStrategies) {
    if (!strategies.length) return '';
    const labels = strategies.map((s) => s.label).join(', ');
    const tools = strategies
      .map((s) => s.playerTools)
      .filter(Boolean)
      .slice(0, 2)
      .join(' ');
    return `Host counters (${labels}) — ${tools}`;
  }

  function maybeAnnounce(strategies, hooks = {}) {
    if (!strategies.length) return;
    const key = strategies
      .map((s) => s.id)
      .sort()
      .join('|');
    if (key === lastIntelKey) return;
    lastIntelKey = key;
    const msg = formatCounterIntel(strategies);
    if (msg) hooks.showMessage?.(msg, 340);
    const primary = strategies[0];
    if (primary?.label && hooks.floatingText) {
      hooks.floatingText(hooks.worldW / 2, 72, `COUNTER: ${primary.label.toUpperCase()}`, '#80b0ff');
    }
  }

  function getActive() {
    return activeStrategies.slice();
  }

  return {
    resetRun,
    detect,
    applyToPressure,
    modifyDamage,
    modifyBuildingDamage,
    getTargetScoreBias,
    formatCounterIntel,
    maybeAnnounce,
    getActive,
    isSiegeTarget,
    STRATEGIES,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.StrategyCounterplay = StrategyCounterplay;
