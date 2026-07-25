/**
 * Dynamic Map Events — the planet fights back. Volcanic eruptions, awakening ruins,
 * and ley storms that help or hurt based on night-prep choices.
 */
const DynamicMapEvents = (() => {
  const WAVE_MIN = 12;
  const ERUPTION_TICK = 150;

  const EVENTS = {
    volcanic_eruption: {
      id: 'volcanic_eruption',
      name: 'Volcanic Eruption',
      float: 'VOLCANO',
      color: '#ff6040',
      waveMin: 18,
      waveMod: 16,
      prep: 'The northern caldera rumbles — choose a response before dawn.',
      choices: [
        { id: 'harness', label: 'Harness Lava', cost: 4, hint: '+6 TP, +2 SP · light north burns' },
        {
          id: 'evacuate',
          label: 'Evacuate Line',
          cost: 2,
          hint: '−5% player damage taken this wave',
        },
        { id: 'ignore', label: 'Hold Ground', cost: 0, hint: 'Eruption pulses damage the north' },
      ],
    },
    ruins_awakening: {
      id: 'ruins_awakening',
      name: 'Ruins Awakening',
      float: 'RUINS',
      color: '#c0a060',
      waveMin: 25,
      waveMod: 19,
      prep: 'Ancient stones hum beneath the realm — claim, seal, or let them wake.',
      choices: [
        { id: 'claim', label: 'Claim Relic', cost: 3, hint: '+10 morale · guardians hunt enemies' },
        { id: 'seal', label: 'Seal Ruins', cost: 5, hint: '−12% enemy spawns this wave' },
        { id: 'ignore', label: 'Let Awaken', cost: 0, hint: 'Wild stalkers emerge · −4 morale' },
      ],
    },
    geothermal_surge: {
      id: 'geothermal_surge',
      name: 'Geothermal Surge',
      float: 'GEOTHERMAL',
      color: '#e08040',
      waveMin: 12,
      waveMod: 14,
      prep: 'Pressure vents under the battlefield — tap it or bleed it off.',
      choices: [
        {
          id: 'tap',
          label: 'Tap Geothermal',
          cost: 3,
          hint: '+35% night build speed · +6% player damage',
        },
        { id: 'vent', label: 'Vent Pressure', cost: 2, hint: '−10% enemy spawns · safer night' },
        { id: 'ignore', label: 'Uncontrolled', cost: 0, hint: 'Chip damage to both armies' },
      ],
    },
    mana_storm: {
      id: 'mana_storm',
      name: 'Mana Storm',
      float: 'MANA STORM',
      color: '#8060e0',
      waveMin: 30,
      waveMod: 21,
      prep: 'Ley lines crackle overhead — channel the storm or ground it.',
      choices: [
        { id: 'channel', label: 'Channel Storm', cost: 4, hint: 'Mages +30% damage · +4 morale' },
        {
          id: 'ground',
          label: 'Ground Lines',
          cost: 3,
          hint: 'Walls +20% protection · foes −8% accuracy',
        },
        { id: 'ignore', label: 'Ride Wild', cost: 0, hint: 'Morale shocks both sides' },
      ],
    },
    titan_stirring: {
      id: 'titan_stirring',
      name: 'Titan Stirring',
      float: 'TITAN',
      color: '#a09080',
      waveMin: 50,
      waveMod: 23,
      prep: 'The land quakes — anchor your walls or ride the tremor.',
      choices: [
        { id: 'anchor', label: 'Anchor Walls', cost: 4, hint: 'Walls +22% protection · −8% speed' },
        { id: 'ride', label: 'Ride Quake', cost: 2, hint: '+12% player speed · light wall strain' },
        { id: 'ignore', label: 'Unprepared', cost: 0, hint: 'Pinning quake · −6 morale' },
      ],
    },
    mirror_rift: {
      id: 'mirror_rift',
      name: 'Mirror Rift',
      float: 'MIRROR RIFT',
      color: '#80b0d0',
      waveMin: 95,
      waveMod: 25,
      priority: 80,
      prep: 'A mirrored tear in the north — loot the echo or seal it before assassins spill through.',
      choices: [
        { id: 'loot', label: 'Loot Echo', cost: 3, hint: '+10 TP · +2 SP · light assassin probe' },
        { id: 'seal', label: 'Seal Rift', cost: 5, hint: '−14% enemy spawns · walls +10%' },
        { id: 'ignore', label: 'Let Bleed', cost: 0, hint: 'Assassins emerge · −5 morale' },
      ],
    },
    dominion_storm: {
      id: 'dominion_storm',
      name: 'Dominion Storm',
      float: 'DOMINION',
      color: '#d07050',
      waveMin: 175,
      waveMod: 40,
      priority: 90,
      prep: 'RTS-era storm fronts collide — fortify, raid, or weather the surge.',
      choices: [
        { id: 'fortify', label: 'Fortify Realm', cost: 5, hint: 'Walls +18% · night build +20%' },
        { id: 'raid', label: 'Raid Storm', cost: 4, hint: '+14 TP · +3 SP · +8% player damage' },
        { id: 'ignore', label: 'Ride It Out', cost: 0, hint: 'Chip damage · −8% player speed' },
      ],
    },
    worldheart_pulse: {
      id: 'worldheart_pulse',
      name: 'Worldheart Pulse',
      float: 'WORLDHEART',
      color: '#b04080',
      waveMin: 450,
      waveMod: 40,
      priority: 100,
      prep: 'The planet core pulses — channel relic energy or brace for aberrations.',
      choices: [
        { id: 'channel', label: 'Channel Pulse', cost: 6, hint: '+16 TP · +4 SP · guardians rise' },
        { id: 'brace', label: 'Brace North', cost: 4, hint: '−10% damage taken · −10% enemy spawns' },
        { id: 'ignore', label: 'Unshielded', cost: 0, hint: 'Wild stalkers · morale shock' },
      ],
    },
  };

  const EVENT_ORDER = [
    'worldheart_pulse',
    'dominion_storm',
    'mirror_rift',
    'geothermal_surge',
    'volcanic_eruption',
    'ruins_awakening',
    'mana_storm',
    'titan_stirring',
  ];

  let pending = null;
  let choiceId = null;
  let activeMods = null;
  let activeEvent = null;
  let eventSite = null;
  let announced = false;
  let lastEruptionTick = 0;

  function resetRun() {
    pending = null;
    choiceId = null;
    activeMods = null;
    activeEvent = null;
    eventSite = null;
    announced = false;
    lastEruptionTick = 0;
  }

  function emptyMods() {
    return {
      enemyCountMult: 1,
      playerDamageTakenMult: 1,
      playerDamageMult: 1,
      playerSpeedMult: 1,
      wallProtectionMult: 1,
      enemyAccuracyPenalty: 0,
      nightBuildMult: 1,
      moraleBonus: 0,
      eruptionPulse: false,
      eruptionDamage: 0,
      eruptionNorthY: 0,
      surgeChip: false,
      surgeDamage: 0,
      quakePin: false,
      spawnWildStalkers: 0,
      spawnGuardians: 0,
      grantTp: 0,
      grantScience: 0,
      moralePenalty: 0,
    };
  }

  function pickEvent(wave) {
    if (wave < WAVE_MIN) return null;
    let best = null;
    let bestPri = -1;
    for (const id of EVENT_ORDER) {
      const evt = EVENTS[id];
      if (!evt || wave < evt.waveMin) continue;
      if (evt.waveMod && wave % evt.waveMod !== 0) continue;
      const pri = evt.priority ?? 10;
      if (pri > bestPri) {
        bestPri = pri;
        best = evt;
      }
    }
    if (best) return best;
    if (wave >= 20 && wave % 27 === 0) return EVENTS.geothermal_surge;
    return null;
  }

  function placeSite(evt, ctx) {
    const rng = ctx.rng || Math.random;
    const y = Math.max(60, (ctx.rallyY || 500) * 0.35 - rng() * 80);
    return {
      x: ctx.worldW * (0.35 + rng() * 0.3),
      y,
      eventId: evt.id,
      label: evt.name,
      color: evt.color,
      radius: 48 + rng() * 24,
    };
  }

  function prepareNextEvent(nextWave, ctx = {}) {
    if (pending) return pending;
    const evt = pickEvent(nextWave);
    if (!evt) return null;
    eventSite = placeSite(evt, ctx);
    pending = {
      eventId: evt.id,
      name: evt.name,
      prep: evt.prep,
      float: evt.float,
      color: evt.color,
      choices: evt.choices,
      forWave: nextWave,
      site: eventSite,
    };
    choiceId = null;
    ctx.hooks?.showMessage?.(`Planet event — ${evt.name}. ${evt.prep}`, 400);
    ctx.hooks?.floatingText?.(ctx.worldW / 2, 58, evt.float || 'PLANET', evt.color);
    ctx.hooks?.addHighlight?.('era', evt.name);
    if (!announced && nextWave === WAVE_MIN) {
      announced = true;
      ctx.hooks?.showMessage?.(
        'Dynamic map events begin — respond during night prep. Your choice helps or hurts this wave.',
        420
      );
    }
    return pending;
  }

  function getChoiceCost(id) {
    if (!pending) return 0;
    const c = pending.choices.find((ch) => ch.id === id);
    return c?.cost ?? 0;
  }

  function respond(choice, ctx = {}) {
    if (!pending) return { ok: false, reason: 'none_pending' };
    if (choiceId) return { ok: false, reason: 'already_chosen', choice: choiceId };
    const def = pending.choices.find((c) => c.id === choice);
    if (!def && choice !== 'ignore') return { ok: false, reason: 'bad_choice' };
    const cost = def?.cost ?? 0;
    const tactical = ctx.tactical ?? 0;
    if (cost > tactical && !ctx.freeTp)
      return { ok: false, reason: 'need_tp', cost, have: tactical };
    choiceId = choice || 'ignore';
    if (cost > 0 && !ctx.freeTp) ctx.spendTp?.(cost);
    const preview = resolveChoice(choiceId, pending, ctx);
    if (preview.nightBuildMult !== 1) {
      activeMods = { ...emptyMods(), nightBuildMult: preview.nightBuildMult };
    }
    ctx.hooks?.showMessage?.(`${pending.name} — ${def?.label || 'Hold Ground'} chosen.`, 320);
    return { ok: true, choice: choiceId, event: pending };
  }

  function resolveChoice(choice, evt, ctx) {
    const mods = emptyMods();
    const id = evt.eventId;

    if (id === 'volcanic_eruption') {
      if (choice === 'harness') {
        mods.grantTp = 6;
        mods.grantScience = 2;
        mods.eruptionPulse = true;
        mods.eruptionDamage = 0.22;
        mods.eruptionNorthY = eventSite?.y || ctx.rallyY * 0.4;
      } else if (choice === 'evacuate') {
        mods.playerDamageTakenMult = 0.95;
      } else {
        mods.eruptionPulse = true;
        mods.eruptionDamage = 0.45;
        mods.eruptionNorthY = eventSite?.y || ctx.rallyY * 0.4;
        mods.moralePenalty = 4;
      }
    } else if (id === 'ruins_awakening') {
      if (choice === 'claim') {
        mods.moraleBonus = 10;
        mods.spawnGuardians = 2;
      } else if (choice === 'seal') {
        mods.enemyCountMult = 0.88;
      } else {
        mods.spawnWildStalkers = 3;
        mods.moralePenalty = 4;
      }
    } else if (id === 'geothermal_surge') {
      if (choice === 'tap') {
        mods.nightBuildMult = 1.35;
        mods.playerDamageMult = 1.06;
      } else if (choice === 'vent') {
        mods.enemyCountMult = 0.9;
      } else {
        mods.surgeChip = true;
        mods.surgeDamage = 0.35;
      }
    } else if (id === 'mana_storm') {
      if (choice === 'channel') {
        mods.playerDamageMult = 1.3;
        mods.moraleBonus = 4;
        mods.mageOnlyDamage = true;
      } else if (choice === 'ground') {
        mods.wallProtectionMult = 1.2;
        mods.enemyAccuracyPenalty = 8;
      } else {
        mods.moralePenalty = 5;
        mods.surgeChip = true;
        mods.surgeDamage = 0.2;
      }
    } else if (id === 'titan_stirring') {
      if (choice === 'anchor') {
        mods.wallProtectionMult = 1.22;
        mods.playerSpeedMult = 0.92;
      } else if (choice === 'ride') {
        mods.playerSpeedMult = 1.12;
        mods.wallProtectionMult = 0.94;
      } else {
        mods.quakePin = true;
        mods.moralePenalty = 6;
      }
    } else if (id === 'mirror_rift') {
      if (choice === 'loot') {
        mods.grantTp = 10;
        mods.grantScience = 2;
        mods.spawnWildStalkers = 2;
      } else if (choice === 'seal') {
        mods.enemyCountMult = 0.86;
        mods.wallProtectionMult = 1.1;
      } else {
        mods.spawnWildStalkers = 4;
        mods.moralePenalty = 5;
      }
    } else if (id === 'dominion_storm') {
      if (choice === 'fortify') {
        mods.wallProtectionMult = 1.18;
        mods.nightBuildMult = 1.2;
      } else if (choice === 'raid') {
        mods.grantTp = 14;
        mods.grantScience = 3;
        mods.playerDamageMult = 1.08;
      } else {
        mods.surgeChip = true;
        mods.surgeDamage = 0.28;
        mods.playerSpeedMult = 0.92;
      }
    } else if (id === 'worldheart_pulse') {
      if (choice === 'channel') {
        mods.grantTp = 16;
        mods.grantScience = 4;
        mods.spawnGuardians = 3;
        mods.moraleBonus = 6;
      } else if (choice === 'brace') {
        mods.playerDamageTakenMult = 0.9;
        mods.enemyCountMult = 0.9;
      } else {
        mods.spawnWildStalkers = 4;
        mods.moralePenalty = 8;
        mods.surgeChip = true;
        mods.surgeDamage = 0.22;
      }
    }

    return mods;
  }

  function applyForWave(wave, ctx = {}) {
    if (!pending || pending.forWave !== wave) {
      activeMods = emptyMods();
      activeEvent = null;
      return null;
    }
    const choice = choiceId || 'ignore';
    const mods = resolveChoice(choice, pending, ctx);
    activeMods = mods;
    activeEvent = {
      id: pending.eventId,
      name: pending.name,
      choice,
      color: pending.color,
      site: pending.site,
      summary: `${pending.name} · ${pending.choices.find((c) => c.id === choice)?.label || choice}`,
    };

    if (mods.grantTp) ctx.grantTp?.(mods.grantTp);
    if (mods.grantScience) ctx.grantScience?.(mods.grantScience);
    if (mods.enemyCountMult !== 1 && ctx.pendingWaveMods) {
      ctx.pendingWaveMods.countMult *= mods.enemyCountMult;
    }
    if (mods.moraleBonus) {
      for (const u of ctx.units || []) {
        if (u.team === 'player' && u.hp > 0 && u.morale != null) {
          u.morale = Math.min(u.maxMorale, u.morale + mods.moraleBonus);
        }
      }
    }
    if (mods.moralePenalty) {
      for (const u of ctx.units || []) {
        if (u.team === 'player' && u.hp > 0 && u.morale != null) {
          u.morale = Math.max(0, u.morale - mods.moralePenalty);
        }
      }
    }
    if (mods.spawnGuardians > 0 && typeof NeutralWildlife !== 'undefined') {
      for (let i = 0; i < mods.spawnGuardians; i++) {
        const spot = {
          x: (eventSite?.x || ctx.worldW / 2) + (i - 1) * 30,
          y: (eventSite?.y || ctx.rallyY * 0.4) + 20,
        };
        const u = NeutralWildlife.createUnit('wild_stalker', spot.x, spot.y, wave, {
          territoryTier: ctx.territoryTier,
        });
        if (u) {
          u.neutralLabel = 'Ruin Guardian';
          u.lootTp = 1;
          ctx.spawnUnit?.(u);
        }
      }
    }
    if (mods.spawnWildStalkers > 0 && typeof NeutralWildlife !== 'undefined') {
      for (let i = 0; i < mods.spawnWildStalkers; i++) {
        const u = NeutralWildlife.createUnit(
          'wild_stalker',
          eventSite?.x + (Math.random() - 0.5) * 60,
          eventSite?.y + (Math.random() - 0.5) * 40,
          wave,
          { territoryTier: ctx.territoryTier }
        );
        if (u) ctx.spawnUnit?.(u);
      }
    }

    ctx.hooks?.showMessage?.(`Planet fights back — ${activeEvent.summary}`, 360);
    ctx.hooks?.floatingText?.(ctx.worldW / 2, 48, pending.float || 'PLANET', pending.color);

    pending = null;
    choiceId = null;
    return { event: activeEvent, mods };
  }

  function getActiveMods() {
    return activeMods || emptyMods();
  }

  function getCombatDamageMult(unit) {
    const m = getActiveMods();
    if (!m.playerDamageMult || m.playerDamageMult === 1) return 1;
    if (m.mageOnlyDamage && unit?.type !== 'mage' && unit?.combatType !== 'ranged') return 1;
    if (m.mageOnlyDamage && unit?.type === 'mage') return m.playerDamageMult;
    if (!m.mageOnlyDamage && unit?.team === 'player') return m.playerDamageMult;
    return 1;
  }

  function tick(updateTick, wave, ctx = {}) {
    const m = getActiveMods();
    if (!m || !activeEvent) return;

    if (m.eruptionPulse && updateTick - lastEruptionTick >= ERUPTION_TICK) {
      lastEruptionTick = updateTick;
      const northY = m.eruptionNorthY || ctx.rallyY * 0.45;
      for (const u of ctx.units || []) {
        if (u.hp <= 0 || u.y > northY + 40) continue;
        if (u.garrisoned || u.wallGarrisoned || u.stationedKeep) continue;
        ctx.damageUnit?.(u, m.eruptionDamage, { attackerTeam: 'neutral' });
      }
      if (ctx.hooks?.floatingText) {
        ctx.hooks.floatingText(eventSite?.x || ctx.worldW / 2, northY, 'ERUPTION', '#ff6040');
      }
    }

    if (m.surgeChip && updateTick % 200 === 0) {
      for (const u of ctx.units || []) {
        if (u.hp <= 0 || u.team === 'neutral') continue;
        if (Math.random() > 0.35) continue;
        ctx.damageUnit?.(u, m.surgeDamage, { attackerTeam: 'neutral' });
      }
    }

    if (m.quakePin && updateTick % 180 === 0) {
      for (const u of ctx.units || []) {
        if (u.hp <= 0 || u.team !== 'player') continue;
        if (Math.random() > 0.25) continue;
        u.pinned = true;
        u.pinTimer = 40;
      }
    }
  }

  function getStateSnapshot(wave, tactical = 0, isNight = false) {
    const evt = pending || activeEvent;
    return {
      active: !!(pending || activeEvent),
      pending: !!pending,
      awaitingChoice: !!pending && !choiceId,
      isNight,
      forWave: pending?.forWave || activeEvent?.forWave || wave,
      event: evt
        ? {
            id: evt.eventId || evt.id,
            name: evt.name,
            prep: pending?.prep,
            color: evt.color,
            choices: pending?.choices,
            choice: choiceId || activeEvent?.choice,
            summary: activeEvent?.summary || pending?.name,
            site: evt.site || eventSite,
          }
        : null,
      activeSummary: activeEvent?.summary || null,
      waveMin: WAVE_MIN,
      canRespond: !!pending && !choiceId && isNight,
      tactical,
    };
  }

  return {
    WAVE_MIN,
    EVENTS,
    resetRun,
    pickEvent,
    prepareNextEvent,
    respond,
    applyForWave,
    getActiveMods,
    getCombatDamageMult,
    tick,
    getStateSnapshot,
    getChoiceCost,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.DynamicMapEvents = DynamicMapEvents;
