/**
 * Omens and weather. One seeded deck: about one night in four an omen card offers two
 * options that change how the next wave plays (planet stirrings, raiders, beasts, the host
 * scouting your line, traps laid in the dark). Weather is rolled at nightfall and shown on
 * the same card. Nothing here changes the wave unless the card says so.
 */
const DynamicMapEvents = (() => {
  const WAVE_MIN = 3;
  const SCOUT_WAVE = 10;
  const PLANET_WAVE = 12;
  /** Territory tier 2, the first at which faction hazards can be placed. */
  const HAZARD_WAVE = 22;
  const ERUPTION_TICK = 150;

  /** Two options per omen; at most one costs TP, so an unanswered card falls to the free one. */
  const pay = (id, label, cost, hint, fx = {}) => ({ id, label, cost, hint, fx });
  const free = (id, label, hint, fx = {}) => ({ id, label, cost: 0, hint, fx });
  const turnBack = (cost) => pay('turn_back', 'Strike first', cost, 'They never reach the field');
  const letCome = (spawns, extra = {}) =>
    free('let_come', 'Let them come', `${spawns.length} more foes join the host`, {
      spawns,
      ...extra,
    });

  const OMENS = {
    // Planet: the land itself stirs. These leave a marked site on the field.
    volcanic_eruption: {
      kind: 'planet',
      name: 'Volcanic Eruption',
      float: 'VOLCANO',
      color: '#ff6040',
      waveMin: 18,
      text: 'The northern caldera rumbles.',
      options: [
        pay('harness', 'Stoke the vents', 3, 'Lava scorches the north all wave', {
          eruption: 0.3,
          sp: 2,
        }),
        free('evacuate', 'Cap and sell the sulphur', '+6 TP', { tp: 6 }),
      ],
    },
    ruins_awakening: {
      kind: 'planet',
      name: 'Ruins Awakening',
      float: 'RUINS',
      color: '#c0a060',
      waveMin: 25,
      text: 'Ancient stones hum beneath the field.',
      options: [
        pay('claim', 'Claim the relic', 3, '+10 morale · 2 guardians wake by the ruins', {
          morale: 10,
          guardians: 2,
        }),
        free('seal', 'Seal them in blood', '12% of the host turned back · -4 morale', {
          cut: 0.12,
          morale: -4,
        }),
      ],
    },
    geothermal_surge: {
      kind: 'planet',
      name: 'Geothermal Surge',
      float: 'GEOTHERMAL',
      color: '#e08040',
      waveMin: 12,
      text: 'Pressure builds in the vents under the field.',
      options: [
        pay('tap', 'Tap the heat', 3, '+35% build speed tonight · +6% damage next wave', {
          nightBuild: 1.35,
          dmg: 1.06,
        }),
        free('vent', 'Vent the steam', '10% of the host turned back · steam scalds your line', {
          cut: 0.1,
          chip: 0.2,
          chipTeam: 'player',
        }),
      ],
    },
    mana_storm: {
      kind: 'planet',
      name: 'Mana Storm',
      float: 'MANA STORM',
      color: '#8060e0',
      waveMin: 30,
      text: 'Ley lines crackle overhead.',
      options: [
        pay('channel', 'Channel the storm', 4, 'Mages +30% damage · +4 morale', {
          dmg: 1.3,
          mageOnly: true,
          morale: 4,
        }),
        free('ground', 'Ground the lines', 'Walls +20% protection · foes -8 accuracy', {
          walls: 1.2,
          accuracy: 8,
        }),
      ],
    },
    titan_stirring: {
      kind: 'planet',
      name: 'Titan Stirring',
      float: 'TITAN',
      color: '#a09080',
      waveMin: 50,
      text: 'The land quakes.',
      options: [
        pay('anchor', 'Anchor the walls', 3, 'Walls +22% protection · your troops -8% speed', {
          walls: 1.22,
          speed: 0.92,
        }),
        free('ride', 'Ride the quake', 'Your troops +12% speed · walls -6% protection', {
          speed: 1.12,
          walls: 0.94,
        }),
      ],
    },
    mirror_rift: {
      kind: 'planet',
      name: 'Mirror Rift',
      float: 'MIRROR RIFT',
      color: '#80b0d0',
      waveMin: 95,
      text: 'A mirrored tear opens in the north.',
      options: [
        free('loot', 'Loot the echo', '+10 TP · stalkers spill out', {
          tp: 10,
          sp: 2,
          stalkers: 2,
        }),
        pay('seal', 'Seal the rift', 5, '14% of the host turned back · walls +10%', {
          cut: 0.14,
          walls: 1.1,
        }),
      ],
    },
    dominion_storm: {
      kind: 'planet',
      name: 'Dominion Storm',
      float: 'DOMINION',
      color: '#d07050',
      waveMin: 175,
      text: 'Storm fronts collide over the field.',
      options: [
        pay('fortify', 'Fortify', 5, 'Walls +18% · +20% build speed tonight', {
          walls: 1.18,
          nightBuild: 1.2,
        }),
        free('raid', 'Raid the storm', '+14 TP · lightning strikes both armies', {
          tp: 14,
          sp: 3,
          chip: 0.28,
        }),
      ],
    },
    worldheart_pulse: {
      kind: 'planet',
      name: 'Deepearth Pulse',
      float: 'WORLDHEART',
      color: '#b04080',
      waveMin: 450,
      text: 'The deep earth pulses.',
      options: [
        pay('channel', 'Channel the pulse', 6, '+16 TP · +6 morale · 3 guardians wake', {
          tp: 16,
          sp: 4,
          morale: 6,
          guardians: 3,
        }),
        free('brace', 'Brace', '-10% damage taken · 10% of the host turned back', {
          dmgTaken: 0.9,
          cut: 0.1,
        }),
      ],
    },

    // Field: news from the roads.
    village_tithe: {
      kind: 'field',
      name: 'Village Tithe',
      float: 'TITHE',
      color: '#80c060',
      waveMin: 3,
      text: 'A village sends its tithe.',
      options: [
        free('coin', 'Take the coin', '+3 TP', { tp: 3 }),
        free('feast', 'Feast the line', '+6 morale', { morale: 6 }),
      ],
    },
    raiders: {
      kind: 'field',
      name: 'Raiders on the Flank',
      float: 'RAIDERS',
      color: '#ff7050',
      waveMin: 4,
      text: 'Goblin raiders shadow the host.',
      options: [turnBack(2), letCome(['goblin', 'goblin', 'warg_rider'])],
    },
    blood_moon: {
      kind: 'field',
      name: 'Blood Moon',
      float: 'BLOOD MOON',
      color: '#c04080',
      waveMin: 13,
      text: 'A blood moon rises. Flyers hunt by it.',
      options: [
        pay('turn_back', 'Light watchfires', 2, 'The flyers keep away'),
        letCome(['harpy', 'sky_drake', 'berserker']),
      ],
    },
    supply_caravan: {
      kind: 'field',
      name: 'Supply Caravan',
      float: 'CARAVAN',
      color: '#80c060',
      waveMin: 17,
      text: 'A supply caravan reaches camp.',
      options: [
        free('sell', 'Sell the cargo', '+5 TP', { tp: 5 }),
        free('arm', 'Arm the line', '+8% damage next wave', { dmg: 1.08 }),
      ],
    },
    siege_push: {
      kind: 'field',
      name: 'Siege Push',
      float: 'SIEGE PUSH',
      color: '#ff8040',
      waveMin: 23,
      text: 'Siege engines are being dragged up in the dark.',
      options: [
        pay('turn_back', 'Burn the engines', 3, 'The engines never arrive'),
        letCome(['siege_tower', 'goblin_sapper', 'siege_tower']),
      ],
    },
    gold_rush: {
      kind: 'field',
      name: 'Gold Rush',
      float: 'GOLD RUSH',
      color: '#e0c040',
      waveMin: 30,
      text: 'Gold is found in the northern hills.',
      options: [
        free('tax', 'Tax the miners', '+8 TP · -4 morale', { tp: 8, morale: -4 }),
        free('share', 'Share the find', '+8 morale', { morale: 8 }),
      ],
    },
    aerial_swarm: {
      kind: 'field',
      name: 'Aerial Swarm',
      float: 'AERIAL',
      color: '#60a0d0',
      waveMin: 35,
      text: 'Wings darken the northern sky.',
      options: [
        pay('turn_back', 'Raise nets', 3, 'The swarm turns away'),
        letCome(['harpy', 'sky_drake', 'harpy', 'warg_rider']),
      ],
    },
    necromancer_conclave: {
      kind: 'field',
      name: 'Necromancer Conclave',
      float: 'CONCLAVE',
      color: '#7040a0',
      waveMin: 40,
      text: 'Undead casters gather behind the host.',
      options: [turnBack(3), letCome(['necromancer', 'dark_mage', 'shaman'])],
    },
    veteran_muster: {
      kind: 'field',
      name: 'Veteran Muster',
      float: 'MUSTER',
      color: '#c0a040',
      waveMin: 50,
      text: 'Old soldiers ride in from the villages.',
      options: [
        pay('pay', 'Pay them to stand', 3, '+10 morale · -5% damage taken', {
          morale: 10,
          dmgTaken: 0.95,
        }),
        free('send_home', 'Take their gifts', '+6 TP', { tp: 6 }),
      ],
    },
    morale_crisis: {
      kind: 'field',
      name: 'Morale Crisis',
      float: 'CRISIS',
      color: '#a06060',
      waveMin: 60,
      text: 'Whispers of defeat spread through camp.',
      options: [
        pay('turn_back', 'Hold a feast', 3, 'The whispers die down'),
        letCome(['assassin', 'assassin'], { morale: -8 }),
      ],
    },
    siege_breach: {
      kind: 'field',
      name: 'Siege Breach',
      float: 'BREACH',
      color: '#c08050',
      waveMin: 75,
      text: 'Tunnellers are digging toward your walls.',
      options: [
        pay('turn_back', 'Countermine', 4, 'The tunnels collapse'),
        letCome(['goblin_burrower', 'goblin_engineer', 'goblin_sapper', 'siege_tower']),
      ],
    },
    mirror_assault: {
      kind: 'field',
      name: 'Mirror Assault',
      float: 'MIRROR',
      color: '#80a0c0',
      waveMin: 95,
      text: 'Assassins have studied your line.',
      options: [turnBack(4), letCome(['assassin', 'dark_knight', 'berserker', 'assassin'])],
    },
    dominion_surge: {
      kind: 'field',
      name: 'Dominion Surge',
      float: 'DOMINION',
      color: '#e06040',
      waveMin: 175,
      text: 'The host calls up its elites.',
      options: [turnBack(5), letCome(['war_chief', 'dark_knight', 'siege_tower', 'goblin_sapper'])],
    },
    hellscape_whisper: {
      kind: 'field',
      name: 'Hellscape Whisper',
      float: 'HELLSCAPE',
      color: '#8040a0',
      waveMin: 480,
      text: 'Something whispers from below.',
      options: [
        pay('turn_back', 'Ward the line', 6, 'The breach stays shut'),
        letCome(['void_stalker', 'abomination', 'necromancer'], { morale: -6 }),
      ],
    },

    // The host adapts once, and says so.
    host_scouts: {
      kind: 'scouts',
      name: 'Scouts in the Dark',
      float: 'SCOUTS',
      color: '#80b0ff',
      waveMin: SCOUT_WAVE,
      text: 'Enemy scouts are watching your line.',
      options: [
        pay('hunt', 'Hunt their scouts', 3, 'The host learns nothing'),
        free('look', 'Let them look', 'The host brings answers to your army', { scouted: true }),
      ],
    },

    // Traps the lead faction lays in the dark.
    host_traps: {
      kind: 'hazard',
      name: 'Traps in the Dark',
      float: 'TRAPS',
      color: '#c06030',
      waveMin: HAZARD_WAVE,
      text: 'The host is laying traps across the field.',
      options: [
        pay('sweep', 'Sweep the field', 2, 'No traps are laid'),
        free('leave', 'Leave them', 'Up to 2 hazards laid · mages can dispel them', {
          hazards: true,
        }),
      ],
    },

    // Wildlife: beasts cross the field; the choice is where they come out.
    beast_migration: {
      kind: 'wildlife',
      name: 'Beast Migration',
      float: 'BEASTS',
      color: '#a08050',
      waveMin: PLANET_WAVE,
      text: 'A herd of wild beasts is on the move.',
      beasts: ['wild_boar', 'wild_boar', 'wild_stalker'],
    },
    predator_circle: {
      kind: 'wildlife',
      name: 'Predator Circle',
      float: 'HARPIES',
      color: '#9080c0',
      waveMin: 20,
      text: 'Wild harpies circle the field.',
      beasts: ['wild_harpy', 'wild_harpy'],
    },
    ancient_grove: {
      kind: 'wildlife',
      name: 'Ancient Grove',
      float: 'TREANT',
      color: '#508848',
      waveMin: 40,
      text: 'An ancient treant stirs in the north.',
      beasts: ['wild_treant'],
    },
  };
  for (const [id, o] of Object.entries(OMENS)) {
    o.id = id;
    if (o.beasts) {
      o.options = [
        pay('drive', 'Drive them at the host', 2, 'They come out among the enemy', {
          beasts: o.beasts,
          at: 'host',
        }),
        free('graze', 'Let them graze', 'They come out by your line · each pays TP when slain', {
          beasts: o.beasts,
          at: 'line',
        }),
      ];
    }
  }

  const WEATHER = {
    fog: {
      name: 'Fog',
      color: '#a0a8b0',
      text: 'Ranged reach halved on both sides. Your archers near a scout or watchtower still see.',
    },
    rain: {
      name: 'Rain',
      color: '#6080b0',
      text: 'Nothing burns. Cavalry and fast runners are slowed.',
    },
    wind: { name: 'Wind', color: '#b0c0a0' },
    frost: {
      name: 'Frost',
      color: '#a0d0f0',
      text: 'Everyone moves slower on the ice, and laid hazards freeze over.',
    },
  };
  const WEATHER_KINDS = ['fog', 'rain', 'wind', 'frost'];
  const FOG_MULT = 0.5;
  const WIND_MULT = 0.2;
  const RAIN_SLOW = 0.75;
  const FROST_SLOW = 0.88;

  let pending = null;
  let choiceId = null;
  let activeMods = null;
  let activeEvent = null;
  let eventSite = null;
  let announced = false;
  let lastEruptionTick = 0;
  let deckSeed = 1;
  let pendingWeather = null;
  let activeWeather = null;
  /** Scouts and watchtowers this tick: fog lifts around them. */
  let fogLights = [];

  function mix(a, b) {
    let h =
      Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    return h >>> 0;
  }

  /**
   * One wave in every block of four carries an omen, and the slot says what kind.
   * @returns {'planet'|'field'|'wildlife'|'hazard'|'scouts'|null}
   */
  function eventSlot(wave) {
    if (wave < WAVE_MIN) return null;
    const h = mix(deckSeed, Math.floor(wave / 4));
    if (wave % 4 !== h % 4) return null;
    const kinds = ['field'];
    if (wave >= SCOUT_WAVE) kinds.push('scouts');
    if (wave >= PLANET_WAVE) kinds.push('planet', 'wildlife');
    if (wave >= HAZARD_WAVE) kinds.push('hazard');
    return kinds[(h >>> 2) % kinds.length];
  }

  /** A stable pick from a list for this wave and system. */
  function deckPick(list, wave, salt) {
    return list.length ? list[mix(deckSeed + salt, wave) % list.length] : null;
  }

  const KIND_SALT = { planet: 11, field: 23, wildlife: 37, hazard: 41, scouts: 43 };

  function omensOf(kind, wave) {
    return Object.values(OMENS).filter((o) => o.kind === kind && wave >= o.waveMin);
  }

  /** The host scouts only when it has something to counter; otherwise the road brings news. */
  function counterNames() {
    if (typeof StrategyCounterplay === 'undefined' || !StrategyCounterplay.getDetected) return [];
    return StrategyCounterplay.getDetected().map((s) => s.label);
  }

  function pickEvent(wave) {
    let kind = eventSlot(wave);
    if (!kind) return null;
    if (kind === 'scouts' && !counterNames().length) kind = 'field';
    return deckPick(omensOf(kind, wave), wave, KIND_SALT[kind]);
  }

  /** Weather for a wave: about one night in three is not clear. */
  function rollWeather(wave) {
    if (wave < WAVE_MIN) return null;
    const h = mix(deckSeed + 71, wave);
    if (h % 3 !== 0) return null;
    const id = WEATHER_KINDS[(h >>> 2) % WEATHER_KINDS.length];
    const w = { id, forWave: wave, ...WEATHER[id] };
    if (id === 'wind') {
      w.from = (h >>> 5) & 1 ? 'north' : 'south';
      w.name = w.from === 'north' ? 'North Wind' : 'South Wind';
      w.text =
        w.from === 'north'
          ? 'Enemy arrows carry further; yours fall short.'
          : 'Your arrows carry further; theirs fall short.';
    }
    return w;
  }

  /**
   * @param {string|number} [seed] a seeded run's seed; otherwise the browser's own entropy,
   *   which leaves the game's random stream alone (headless runs without it use seed 1)
   */
  function resetRun(seed) {
    deckSeed = 1;
    if (seed != null && seed !== '') {
      for (const ch of String(seed)) deckSeed = mix(deckSeed, ch.charCodeAt(0));
    } else if (globalThis.crypto?.getRandomValues) {
      deckSeed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    pending = null;
    choiceId = null;
    activeMods = null;
    activeEvent = null;
    eventSite = null;
    announced = false;
    lastEruptionTick = 0;
    pendingWeather = null;
    activeWeather = null;
    fogLights = [];
  }

  function emptyMods() {
    return {
      playerDamageTakenMult: 1,
      playerDamageMult: 1,
      playerSpeedMult: 1,
      wallProtectionMult: 1,
      enemyAccuracyPenalty: 0,
      nightBuildMult: 1,
      eruptionPulse: false,
      eruptionDamage: 0,
      eruptionNorthY: 0,
      surgeChip: false,
      surgeDamage: 0,
      surgeTeam: 'all',
      quakePin: false,
    };
  }

  function modsFor(fx = {}, ctx = {}) {
    const m = emptyMods();
    if (fx.dmgTaken) m.playerDamageTakenMult = fx.dmgTaken;
    if (fx.dmg) m.playerDamageMult = fx.dmg;
    if (fx.mageOnly) m.mageOnlyDamage = true;
    if (fx.speed) m.playerSpeedMult = fx.speed;
    if (fx.walls) m.wallProtectionMult = fx.walls;
    if (fx.accuracy) m.enemyAccuracyPenalty = fx.accuracy;
    if (fx.nightBuild) m.nightBuildMult = fx.nightBuild;
    if (fx.eruption) {
      m.eruptionPulse = true;
      m.eruptionDamage = fx.eruption;
      m.eruptionNorthY = eventSite?.y || (ctx.rallyY || 500) * 0.4;
    }
    if (fx.chip) {
      m.surgeChip = true;
      m.surgeDamage = fx.chip;
      m.surgeTeam = fx.chipTeam || 'all';
    }
    return m;
  }

  function optionOf(evtId, choice) {
    return OMENS[evtId]?.options.find((o) => o.id === choice) || null;
  }

  /** What an unanswered card becomes at dawn: the free option, or a coin toss if both are free. */
  function defaultChoice(evt) {
    const opts = OMENS[evt?.eventId]?.options;
    if (!opts) return null;
    const frees = opts.filter((o) => !o.cost);
    if (frees.length === 1) return frees[0].id;
    return opts[mix(deckSeed + 97, evt.forWave) % opts.length].id;
  }

  function placeSite(evt, ctx) {
    const rng = ctx.rng || Math.random;
    const y = Math.max(60, (ctx.rallyY || 500) * 0.35 - rng() * 80);
    return {
      x: (ctx.worldW || 500) * (0.35 + rng() * 0.3),
      y,
      eventId: evt.id,
      label: evt.name,
      color: evt.color,
      radius: 48 + rng() * 24,
    };
  }

  function cardText(evt) {
    if (evt.id !== 'host_scouts') return evt.text;
    const names = counterNames();
    return names.length
      ? `${evt.text} They would answer your ${names.join(', ')}.`
      : `${evt.text} They have little to learn.`;
  }

  function makePending(evt, wave, site) {
    return {
      eventId: evt.id,
      name: evt.name,
      prep: cardText(evt),
      float: evt.float,
      color: evt.color,
      choices: evt.options.map(({ id, label, cost, hint }) => ({ id, label, cost, hint })),
      forWave: wave,
      site,
    };
  }

  /** Nightfall: the last wave's omen and weather end; tomorrow's are dealt. */
  function prepareNextEvent(nextWave, ctx = {}) {
    if (!pending || pending.forWave !== nextWave) {
      activeMods = null;
      activeEvent = null;
      activeWeather = null;
    }
    if (!pendingWeather || pendingWeather.forWave !== nextWave) {
      pendingWeather = rollWeather(nextWave);
      if (pendingWeather) {
        ctx.hooks?.floatingText?.(
          (ctx.worldW || 500) / 2,
          76,
          pendingWeather.name.toUpperCase(),
          pendingWeather.color
        );
      }
    }
    if (pending) return pending;
    const evt = pickEvent(nextWave);
    if (!evt) return null;
    eventSite = evt.kind === 'planet' ? placeSite(evt, ctx) : null;
    pending = makePending(evt, nextWave, eventSite);
    choiceId = null;
    ctx.hooks?.floatingText?.((ctx.worldW || 500) / 2, 58, evt.float || 'OMEN', evt.color);
    ctx.hooks?.addHighlight?.('era', evt.name);
    if (!announced) {
      announced = true;
      ctx.hooks?.showMessage?.(
        'An omen card is on the field. Pick before dawn, or the omen picks for you.',
        360
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
    const def = optionOf(pending.eventId, choice);
    if (!def) return { ok: false, reason: 'bad_choice' };
    const tactical = ctx.tactical ?? 0;
    if (def.cost > tactical && !ctx.freeTp)
      return { ok: false, reason: 'need_tp', cost: def.cost, have: tactical };
    choiceId = choice;
    if (def.cost > 0 && !ctx.freeTp) ctx.spendTp?.(def.cost);
    // Build speed is a night effect: it starts now, not at dawn.
    if (def.fx.nightBuild) activeMods = { ...emptyMods(), nightBuildMult: def.fx.nightBuild };
    ctx.hooks?.showMessage?.(`${pending.name}: ${def.label}.`, 260);
    return { ok: true, choice: choiceId, event: pending };
  }

  function shiftMorale(units, n) {
    for (const u of units || []) {
      if (u.team === 'player' && u.hp > 0 && u.morale != null) {
        u.morale = Math.max(0, Math.min(u.maxMorale, u.morale + n));
      }
    }
  }

  function spawnWild(type, x, y, wave, ctx, label) {
    if (typeof NeutralWildlife === 'undefined') return;
    const u = NeutralWildlife.createUnit(type, x, y, wave, { territoryTier: ctx.territoryTier });
    if (!u) return;
    if (label) u.neutralLabel = label;
    ctx.spawnUnit?.(u);
  }

  /** Dawn: the card's answer (or its default) takes effect for this wave. */
  function applyForWave(wave, ctx = {}) {
    activeWeather = pendingWeather?.forWave === wave ? pendingWeather : null;
    pendingWeather = null;
    if (!pending || pending.forWave !== wave) {
      activeMods = emptyMods();
      activeEvent = null;
      return null;
    }
    const answered = !!choiceId;
    const choice = optionOf(pending.eventId, choiceId) ? choiceId : defaultChoice(pending);
    const opt = optionOf(pending.eventId, choice);
    const fx = opt?.fx || {};
    const mods = modsFor(fx, ctx);
    activeMods = mods;
    activeEvent = {
      id: pending.eventId,
      name: pending.name,
      choice,
      color: pending.color,
      site: pending.site,
      forWave: wave,
      summary: `${pending.name}: ${opt?.label || choice}`,
    };

    if (fx.tp) ctx.grantTp?.(fx.tp);
    if (fx.sp) ctx.grantScience?.(fx.sp);
    if (fx.morale) shiftMorale(ctx.units, fx.morale);
    const site = eventSite || { x: (ctx.worldW || 500) / 2, y: (ctx.rallyY || 500) * 0.4 };
    for (let i = 0; i < (fx.guardians || 0); i++) {
      spawnWild('wild_stalker', site.x + (i - 1) * 30, site.y + 20, wave, ctx, 'Ruin Guardian');
    }
    for (let i = 0; i < (fx.stalkers || 0); i++) {
      spawnWild('wild_stalker', site.x + (i - 0.5) * 40, site.y, wave, ctx);
    }
    const w = ctx.worldW || 500;
    (fx.beasts || []).forEach((type, i, all) => {
      const x = w * (0.25 + (0.5 * (i + 0.5)) / all.length);
      const y = fx.at === 'host' ? 40 : (ctx.rallyY || 500) - 90;
      spawnWild(type, x, y, wave, ctx);
    });

    ctx.hooks?.showMessage?.(
      answered ? activeEvent.summary : `No answer by dawn. ${activeEvent.summary}`,
      300
    );
    ctx.hooks?.floatingText?.(w / 2, 48, pending.float || 'OMEN', pending.color);

    pending = null;
    choiceId = null;
    return { event: activeEvent, mods };
  }

  /**
   * Dawn, once the host is built: add the foes the card let through, or turn back the share
   * it cut. Bosses are never cut.
   * @returns {string[]} the queue, changed or not
   */
  function applyToQueue(wave, queue) {
    if (!activeEvent || activeEvent.forWave !== wave) return queue;
    const fx = optionOf(activeEvent.id, activeEvent.choice)?.fx || {};
    const q = [...queue];
    for (const t of fx.spawns || []) {
      if (typeof EnemyDefs !== 'undefined' && !EnemyDefs[t]) continue;
      q.push(t);
    }
    if (fx.cut > 0) {
      let n = Math.round(q.length * fx.cut);
      for (let i = q.length - 1; i >= 0 && n > 0; i--) {
        const def = typeof EnemyDefs !== 'undefined' ? EnemyDefs[q[i]] : null;
        if (def?.isBoss || def?.boss) continue;
        q.splice(i, 1);
        n--;
      }
    }
    return q;
  }

  function chosenFor(wave) {
    if (activeEvent && activeEvent.forWave === wave) return activeEvent;
    if (pending && pending.forWave === wave) {
      return { id: pending.eventId, choice: choiceId || defaultChoice(pending) };
    }
    return null;
  }

  /** True while the scouting omen stands at "let them look" (tonight's answer, or the wave's). */
  function hostScouted() {
    const c = pending ? chosenFor(pending.forWave) : activeEvent;
    return c?.id === 'host_scouts' && c.choice === 'look';
  }

  /** True when the trap omen for this wave was left to stand. */
  function hazardsLaid(wave) {
    const c = chosenFor(wave);
    return c?.id === 'host_traps' && c.choice === 'leave';
  }

  /** The Herald's news for a wave: the omen's name, never an id. */
  function heraldNews(wave) {
    return pickEvent(wave)?.name || null;
  }

  function weatherIs(id) {
    return activeWeather?.id === id;
  }

  /** Ranged reach under fog and wind. Fog lifts near a scout or watchtower for your troops. */
  function rangeMult(unit) {
    if (!activeWeather || unit?.combatType !== 'ranged') return 1;
    if (activeWeather.id === 'fog') {
      if (unit.team === 'player') {
        for (const l of fogLights) {
          const dx = unit.x - l.x;
          const dy = unit.y - l.y;
          if (dx * dx + dy * dy <= l.r * l.r) return 1;
        }
      }
      return FOG_MULT;
    }
    if (activeWeather.id === 'wind') {
      // Enemies shoot south, the player north; a north wind carries southward shots.
      const downwind = (activeWeather.from === 'north') === (unit.team === 'enemy');
      return downwind ? 1 + WIND_MULT : 1 - WIND_MULT;
    }
    return 1;
  }

  /** Movement: the omen's speed for your troops, then the weather for everyone. */
  function speedMult(unit) {
    let m = unit?.team === 'player' ? getActiveMods().playerSpeedMult || 1 : 1;
    if (weatherIs('rain') && (unit?.combatType === 'cavalry' || (unit?.speed || 0) >= 1.4)) {
      m *= RAIN_SLOW;
    }
    if (weatherIs('frost')) m *= FROST_SLOW;
    return m;
  }

  function getActiveMods() {
    return activeMods || emptyMods();
  }

  function getCombatDamageMult(unit) {
    const m = getActiveMods();
    if (!m.playerDamageMult || m.playerDamageMult === 1) return 1;
    if (m.mageOnlyDamage) return unit?.type === 'mage' ? m.playerDamageMult : 1;
    return unit?.team === 'player' ? m.playerDamageMult : 1;
  }

  function tick(updateTick, _wave, ctx = {}) {
    if (weatherIs('fog')) {
      fogLights = [];
      for (const u of ctx.units || []) {
        if (u.team === 'player' && u.hp > 0 && u.type === 'scout') {
          fogLights.push({ x: u.x, y: u.y, r: 200 });
        }
      }
      for (const b of ctx.buildings || []) {
        if (b.owner === 'player' && b.complete && b.hp > 0 && b.isWatchtower) {
          fogLights.push({ x: b.x, y: b.y, r: b.visionRadius || 200 });
        }
      }
    }
    const m = getActiveMods();
    if (!activeEvent) return;

    if (m.eruptionPulse && updateTick - lastEruptionTick >= ERUPTION_TICK) {
      lastEruptionTick = updateTick;
      const northY = m.eruptionNorthY || (ctx.rallyY || 500) * 0.45;
      for (const u of ctx.units || []) {
        if (u.hp <= 0 || u.y > northY + 40) continue;
        if (u.garrisoned || u.wallGarrisoned || u.stationedKeep) continue;
        ctx.damageUnit?.(u, m.eruptionDamage, { attackerTeam: 'neutral' });
      }
      ctx.hooks?.floatingText?.(
        eventSite?.x || (ctx.worldW || 500) / 2,
        northY,
        'ERUPTION',
        '#ff6040'
      );
    }

    if (m.surgeChip && updateTick % 200 === 0) {
      for (const u of ctx.units || []) {
        if (u.hp <= 0 || u.team === 'neutral') continue;
        if (m.surgeTeam === 'player' && u.team !== 'player') continue;
        if ((globalThis.simRandom || Math.random)() > 0.35) continue;
        ctx.damageUnit?.(u, m.surgeDamage, { attackerTeam: 'neutral' });
      }
    }
  }

  function weatherCard(w) {
    return w ? { id: w.id, name: w.name, text: w.text, color: w.color } : null;
  }

  function getStateSnapshot(wave, tactical = 0, isNight = false) {
    const evt = pending || activeEvent;
    const def = pending ? defaultChoice(pending) : null;
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
            defaultLabel: def ? optionOf(pending.eventId, def)?.label : null,
          }
        : null,
      activeSummary: activeEvent?.summary || null,
      weather: weatherCard(isNight ? pendingWeather : activeWeather),
      waveMin: WAVE_MIN,
      canRespond: !!pending && !choiceId && isNight,
      tactical,
    };
  }

  // Run state in saves: see js/save-registry.js.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('DynamicMapEvents', {
      save: () => ({
        pending,
        choiceId,
        activeMods,
        activeEvent,
        eventSite,
        announced,
        deckSeed,
        pendingWeather,
        activeWeather,
        // A tick stamp, saved as an offset from now (the tick counter is not restored).
        eruptionAgo: lastEruptionTick ? SaveRegistry.tick() - lastEruptionTick : null,
      }),
      load(data) {
        resetRun();
        if (!data) return;
        // Older saves have no deck seed: keep the one resetRun picked.
        if (Number.isInteger(data.deckSeed)) deckSeed = data.deckSeed >>> 0;
        eventSite = data.eventSite ?? null;
        // Older saves held three-option planet cards: rebuild the card from today's omen.
        const p = data.pending;
        if (p && OMENS[p.eventId] && Number.isFinite(p.forWave)) {
          pending = makePending(OMENS[p.eventId], p.forWave, p.site ?? eventSite);
          choiceId = optionOf(p.eventId, data.choiceId) ? data.choiceId : null;
        }
        activeMods = data.activeMods ? { ...emptyMods(), ...data.activeMods } : null;
        activeEvent = data.activeEvent ?? null;
        announced = !!data.announced;
        pendingWeather = data.pendingWeather ?? null;
        activeWeather = data.activeWeather ?? null;
        lastEruptionTick = Number.isFinite(data.eruptionAgo)
          ? SaveRegistry.tick() - data.eruptionAgo
          : 0;
      },
    });
  }

  return {
    WAVE_MIN,
    EVENTS: OMENS,
    OMENS,
    WEATHER,
    resetRun,
    pickEvent,
    eventSlot,
    deckPick,
    rollWeather,
    prepareNextEvent,
    respond,
    applyForWave,
    applyToQueue,
    hostScouted,
    hazardsLaid,
    heraldNews,
    weatherIs,
    rangeMult,
    speedMult,
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
