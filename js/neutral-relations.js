/**
 * Dynamic alliances with neutral wildlife — reputation, pacts, allied spawns.
 */
const NeutralRelations = (() => {
  const WAVE_MIN = 8;
  const REP_MIN = -100;
  const REP_MAX = 100;
  const DEFAULT_REP = 0;

  const STANCES = [
    {
      max: -55,
      id: 'feral',
      label: 'Feral',
      color: '#ff5050',
      desc: 'Wildlife hunts your troops aggressively.',
    },
    {
      max: -20,
      id: 'wary',
      label: 'Wary',
      color: '#e0a050',
      desc: 'Beasts circle both armies — player kills draw extra wrath.',
    },
    {
      max: 20,
      id: 'neutral',
      label: 'Neutral',
      color: '#a0b0a0',
      desc: 'Standard wildlife — opportunistic, attacks nearest foe.',
    },
    {
      max: 55,
      id: 'sympathetic',
      label: 'Sympathetic',
      color: '#80c8a0',
      desc: 'Hunt pacts possible — fewer random migrations against you.',
    },
    {
      max: 100,
      id: 'symbiotic',
      label: 'Symbiotic',
      color: '#60e0a0',
      desc: 'Allied beasts may join your line under active pact.',
    },
  ];

  let reputation = DEFAULT_REP;
  let pactUntil = 0;
  let huntedThisWave = 0;
  let announced = false;
  let lastDiplomacyWave = 0;

  function resetRun() {
    reputation = DEFAULT_REP;
    pactUntil = 0;
    huntedThisWave = 0;
    announced = false;
    lastDiplomacyWave = 0;
  }

  function isActive(wave) {
    return (wave | 0) >= WAVE_MIN;
  }

  function clampRep(value) {
    return Math.max(REP_MIN, Math.min(REP_MAX, Math.round(value)));
  }

  function getReputation() {
    return reputation;
  }

  function getStance(rep = reputation) {
    return STANCES.find((s) => rep <= s.max) || STANCES[STANCES.length - 1];
  }

  function isPactActive(wave) {
    return pactUntil > (wave | 0);
  }

  function addReputation(amount, wave = 0) {
    if (!amount) return reputation;
    reputation = clampRep(reputation + amount);
    return reputation;
  }

  function reduceReputation(amount, wave = 0) {
    return addReputation(-amount, wave);
  }

  function shouldSkipPlayerAggro(unit, target, wave) {
    if (!target || target.team !== 'player') return false;
    if (unit?.alliedToPlayer) return true;
    if (!isActive(wave)) return false;
    if (isPactActive(wave) && reputation >= 35) return true;
    if (reputation >= 70 && isPactActive(wave)) return true;
    return false;
  }

  function findAggroTarget(unit, units, wave = 0) {
    let best = null;
    let bestD = Infinity;
    const radius = unit.aggroRadius || 140;
    const allied = !!unit.alliedToPlayer;

    for (const u of units) {
      if (!u || u.hp <= 0 || u.fleeing || u.demoralized) continue;
      if (u.team === 'neutral' && u.id !== unit.id) continue;
      if (allied) {
        if (u.team !== 'enemy') continue;
      } else {
        if (u.team === 'neutral') continue;
        if (shouldSkipPlayerAggro(unit, u, wave)) continue;
        if (reputation <= -40 && u.team === 'player') {
          /* feral — slight preference for player */
        }
      }
      const d = Math.hypot(u.x - unit.x, u.y - unit.y);
      if (d > radius || d >= bestD) continue;
      if (reputation <= -40 && !allied && u.team === 'player') {
        bestD = d * 0.92;
      } else {
        bestD = d;
      }
      best = u;
    }
    return best;
  }

  function onWildlifeSlain(unit, ctx = {}) {
    if (!unit?.isNeutral || unit.alliedToPlayer) return null;
    const wave = ctx.wave || 0;
    if (!isActive(wave)) return null;

    const killer = ctx.units?.find(
      (u) => u.combatTargetId === unit.id && u.hp > 0 && u.team !== 'neutral'
    );
    let delta = 0;
    if (killer?.team === 'player') {
      huntedThisWave++;
      delta = isPactActive(wave) ? -4 : -8;
      if (reputation <= -20) delta -= 2;
      addReputation(delta, wave);
      if (delta <= -8 && ctx.hooks?.showMessage && Math.random() < 0.4) {
        ctx.hooks.showMessage(
          `Wildlife remembers the slaughter — ${getStance().label} (${reputation}).`,
          240
        );
      }
    } else if (killer?.team === 'enemy') {
      const nearPlayer = (ctx.units || []).some(
        (u) =>
          u.team === 'player' &&
          u.hp > 0 &&
          Math.hypot(u.x - unit.x, u.y - unit.y) < 220
      );
      if (nearPlayer) {
        delta = 3;
        addReputation(delta, wave);
      }
    }
    return { reputation, delta, killerTeam: killer?.team || null };
  }

  function onWaveEnd(wave, ctx = {}) {
    if (!isActive(wave)) return;
    if (huntedThisWave === 0) {
      const before = reputation;
      addReputation(2, wave);
      if (before < 55 && reputation >= 55 && ctx.hooks?.showMessage) {
        ctx.hooks.showMessage('Wildlife grows sympathetic — hunt pacts now viable.', 320);
      }
    }
    huntedThisWave = 0;
  }

  function rollDiplomacyEvent(wave, ctx = {}) {
    if (!isActive(wave) || wave - lastDiplomacyWave < 6) return null;
    if (wave % 17 !== 0 && Math.random() > 0.22) return null;
    lastDiplomacyWave = wave;

    const stance = getStance();
    if (reputation >= 40 && isPactActive(wave)) {
      ctx.hooks?.showMessage?.(
        'Symbiotic pact holds — allied beasts patrol your flanks this wave.',
        300
      );
      return spawnAlliedPack(wave, ctx, 2);
    }
    if (reputation <= -50) {
      ctx.hooks?.showMessage?.(
        'Feral packs scent blood — extra wildlife may surge from the wilds.',
        280
      );
      return { surge: true };
    }
    if (reputation >= 15 && reputation < 40) {
      ctx.hooks?.showMessage?.(
        `Wild envoys observe from the treeline — ${stance.label} (${reputation}).`,
        260
      );
    }
    return null;
  }

  function spawnAlliedPack(wave, ctx, count = 2) {
    if (typeof NeutralWildlife === 'undefined') return [];
    const types =
      wave >= 40
        ? ['wild_stalker', 'wild_boar']
        : wave >= 20
          ? ['wild_boar', 'wild_stalker']
          : ['wild_boar'];
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      const spot = NeutralWildlife.pickSpawnPoint?.(
        ctx.worldW,
        ctx.worldH,
        ctx.rallyY,
        ctx.rng || Math.random
      ) || { x: ctx.worldW / 2, y: ctx.rallyY - 80 };
      const u = NeutralWildlife.createUnit(type, spot.x, spot.y, wave, {
        territoryTier: ctx.territoryTier,
        eventId: 'wild_pact',
      });
      if (!u) continue;
      u.alliedToPlayer = true;
      u.neutralLabel = `Allied ${u.neutralLabel || type}`;
      u.aggroRadius = (u.aggroRadius || 140) * 1.15;
      u.morale = Math.min(30, (u.morale || 12) + 6);
      ctx.spawnUnit?.(u);
      spawned.push(u);
    }
    if (spawned.length) {
      ctx.hooks?.floatingText?.(ctx.worldW / 2, 96, 'WILD PACT', '#60e0a0');
    }
    return spawned;
  }

  function onHuntPact(wave, ctx = {}) {
    if (!isActive(wave)) return null;
    pactUntil = wave + 3;
    addReputation(22, wave);
    const spawned = reputation >= 50 ? spawnAlliedPack(wave, ctx, 2) : [];
    const stance = getStance();
    ctx.hooks?.showMessage?.(
      `Hunt pact sealed — wildlife ${stance.label} (${reputation}). Allied beasts for ${pactUntil - wave} waves.`,
      380
    );
    ctx.hooks?.floatingText?.(ctx.worldW / 2, 88, 'HUNT PACT', '#80c8a0');
    return { reputation, pactUntil, spawned: spawned.length };
  }

  function onWaveStart(wave, ctx = {}) {
    if (!isActive(wave)) return { spawned: [] };
    huntedThisWave = 0;
    if (!announced && wave === WAVE_MIN) {
      announced = true;
      ctx.hooks?.showMessage?.(
        'Neutral wildlife remembers your conduct — restraint and hunt pacts shift beast allegiance.',
        420
      );
    }
    const dip = rollDiplomacyEvent(wave, ctx);
    return { diplomacy: dip, reputation, stance: getStance().id };
  }

  function getWildlifeSpawnMult(wave) {
    if (!isActive(wave)) return 1;
    if (reputation <= -50) return 1.35;
    if (reputation <= -20) return 1.12;
    if (reputation >= 55 && isPactActive(wave)) return 0.75;
    if (reputation >= 30) return 0.92;
    return 1;
  }

  function formatSummary() {
    const stance = getStance();
    const pact = pactUntil > 0 ? ` · pact ${Math.max(0, pactUntil)}` : '';
    return `Wild ${stance.label} ${reputation}${pact}`;
  }

  function getStateSnapshot(wave, units) {
    const stance = getStance();
    const allied = (units || []).filter((u) => u.team === 'neutral' && u.hp > 0 && u.alliedToPlayer)
      .length;
    return {
      active: isActive(wave),
      waveMin: WAVE_MIN,
      reputation,
      stance: stance.id,
      stanceLabel: stance.label,
      stanceColor: stance.color,
      desc: stance.desc,
      pactActive: isPactActive(wave),
      pactUntil,
      alliedCount: allied,
      wildlifeSpawnMult: getWildlifeSpawnMult(wave),
      summary: formatSummary(),
      stances: STANCES,
    };
  }

  return {
    WAVE_MIN,
    STANCES,
    resetRun,
    isActive,
    getReputation,
    getStance,
    isPactActive,
    addReputation,
    reduceReputation,
    shouldSkipPlayerAggro,
    findAggroTarget,
    onWildlifeSlain,
    onWaveEnd,
    onHuntPact,
    onWaveStart,
    rollDiplomacyEvent,
    spawnAlliedPack,
    getWildlifeSpawnMult,
    getStateSnapshot,
    formatSummary,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.NeutralRelations = NeutralRelations;
