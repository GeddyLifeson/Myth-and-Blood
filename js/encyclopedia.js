/**
 * Myth and Blood — encyclopedia (main menu, pause menu, in-game HUD).
 *
 * A reference a player uses during a siege: how the game works, what each soldier,
 * building and enemy does, and how to beat what is coming.
 *
 * Almost every entry is built at open time from the game's own definitions (UnitDefs,
 * BuildDefs, EnemyDefs, Roster, SiegeLoop, Research, Hotkeys, ...), so numbers, names and
 * keys cannot drift from the game. Only two kinds of text are written here: the short
 * rules in "How to play", and the one-line job of each building. No champion, operative
 * or company name appears in this file; they are read from data when shown.
 */
const Encyclopedia = (() => {
  let panelOpen = false;
  let returnToPause = false;

  const CATEGORIES = [
    { id: 'howto', label: 'How to play' },
    { id: 'army', label: 'Your army' },
    { id: 'buildings', label: 'Buildings' },
    { id: 'research', label: 'Research' },
    { id: 'orders', label: 'Orders' },
    { id: 'spoils', label: 'Spoils and edicts' },
    { id: 'ribbons', label: 'Ribbons and score' },
    { id: 'enemies', label: 'Enemies' },
    { id: 'bosses', label: 'Bosses' },
    { id: 'marks', label: 'Status marks' },
    { id: 'champions', label: 'Champions' },
    { id: 'world', label: 'World and lore' },
  ];

  const SUBTITLE = 'How the siege works, who fights in it, and what comes out of the north';

  // ------------------------------------------------------------------ helpers
  /**
   * The game's definitions, looked up by name at call time. A top-level `const` in a
   * classic script is not a property of globalThis, so each is tested by identifier; one
   * that is not loaded (a test sandbox, a trimmed build) reads as null.
   */
  const SOURCES = {
    UnitDefs: () => (typeof UnitDefs !== 'undefined' ? UnitDefs : null),
    BuildDefs: () => (typeof BuildDefs !== 'undefined' ? BuildDefs : null),
    EnemyDefs: () => (typeof EnemyDefs !== 'undefined' ? EnemyDefs : null),
    Roster: () => (typeof Roster !== 'undefined' ? Roster : null),
    SiegeLoop: () => (typeof SiegeLoop !== 'undefined' ? SiegeLoop : null),
    Research: () => (typeof Research !== 'undefined' ? Research : null),
    Hotkeys: () => (typeof Hotkeys !== 'undefined' ? Hotkeys : null),
    EconomyRules: () => (typeof EconomyRules !== 'undefined' ? EconomyRules : null),
    DIFFICULTIES: () => (typeof DIFFICULTIES !== 'undefined' ? DIFFICULTIES : null),
    GameModes: () => (typeof GameModes !== 'undefined' ? GameModes : null),
    LoreData: () => (typeof LoreData !== 'undefined' ? LoreData : null),
    StoryLore: () => (typeof StoryLore !== 'undefined' ? StoryLore : null),
    Chronicles: () => (typeof Chronicles !== 'undefined' ? Chronicles : null),
    Abilities: () => (typeof Abilities !== 'undefined' ? Abilities : null),
    SpyActions: () => (typeof SpyActions !== 'undefined' ? SpyActions : null),
    CourierMessages: () => (typeof CourierMessages !== 'undefined' ? CourierMessages : null),
    EnemyFactions: () => (typeof EnemyFactions !== 'undefined' ? EnemyFactions : null),
    MonsterBosses: () => (typeof MonsterBosses !== 'undefined' ? MonsterBosses : null),
    MetaProgress: () => (typeof MetaProgress !== 'undefined' ? MetaProgress : null),
    WweDefs: () => (typeof WweDefs !== 'undefined' ? WweDefs : null),
    CrossoverDefs: () => (typeof CrossoverDefs !== 'undefined' ? CrossoverDefs : null),
    CrossoverFactions: () => (typeof CrossoverFactions !== 'undefined' ? CrossoverFactions : null),
    AudioEngine: () => (typeof AudioEngine !== 'undefined' ? AudioEngine : null),
    Legacy: () => (typeof Legacy !== 'undefined' ? Legacy : null),
  };
  const G = (name) => {
    try {
      return SOURCES[name]() ?? null;
    } catch (_) {
      return null;
    }
  };

  function entry(cat, name, body, extras = {}) {
    return { cat, name, body, ...extras };
  }

  /** The label of the key bound to an action, or the fallback when the map lacks it. */
  function key(state, action, arg = null, fallback = '') {
    const H = G('Hotkeys');
    const k = H?.keyFor?.(state, action, arg);
    return k ? H.keyLabel(k) : fallback;
  }

  const unitName = (type) => G('UnitDefs')?.[type]?.name || type;
  const buildName = (id) => G('BuildDefs')?.[id]?.name || id;
  const enemyName = (type) => {
    const d = G('EnemyDefs')?.[type];
    return d?.bossName || d?.name || type;
  };
  const list = (ids, namer) => ids.map(namer).join(', ');
  const pct = (x) => `${Math.round(x * 100)}%`;

  // -------------------------------------------------------------- how to play
  function buildHowToEntries() {
    const out = [];
    const add = (name, body, extras) => out.push(entry('howto', name, body, extras));
    const diffs = G('DIFFICULTIES') || {};
    const limits = Object.values(diffs)
      .map((d) => `${d.label} ${d.missLimit}`)
      .join(', ');
    const granary = G('EconomyRules')?.BUILDINGS?.granary;
    const kBegin = key('night', 'beginDay', null, 'D');
    const kHunt = key('day', 'hunt', null, 'H');
    const kHold = key('day', 'holdHere', null, 'Shift+H');
    const kPosts = key('unit_selected', 'backToPosts', null, 'B');
    const kSheet = key('day', 'keySheet', null, '?');

    add(
      'The siege',
      'One field, one line, no end. The host comes from the top of the field; your line is the bottom edge. Each wave is a day. Clear it and night falls, you are paid, and you prepare for the next. Soldiers who die are gone for good. There is no final wave: the run is over when the line breaks, and what counts is how long it stood.'
    );
    add(
      'Night and day',
      `Night is for preparing: recruit, build, research, send the spy and the courier, and move soldiers to their posts. The top of the screen shows what the next wave is likely to bring. Press ${kBegin} to sound the horn when you are ready. Sounding it early pays 1 TP for every 10 seconds of night left, up to 5. Day is the fight; it ends when the last enemy is dead.`
    );
    add(
      'Tactical Points (TP)',
      'TP pays for everything: soldiers, buildings, spells, spy and courier work. You are paid when a wave is cleared, a little more each wave, and less on the harder difficulties. Trade outposts and quarries pay at dawn. Crates, spoils and early horns add more. There is no cap on what you can hold.'
    );
    add(
      'Recruiting',
      'Pick a troop on the left or press its number key, then click the field. One click places one soldier. Hold Shift while clicking to keep the same troop in hand and place several. A troop you cannot afford or have not researched is greyed out, and its tooltip says why.'
    );
    add(
      'Army upkeep',
      `The first 14 soldiers cost their listed price. Every soldier past that makes each new recruit 7% dearer. The price on the button is always the price you will pay. Builders and couriers do not count toward the 14.${
        granary
          ? ` Each ${buildName('outpost_granary')} feeds ${granary.freeArmy} more before the surcharge starts (the first ${granary.maxCounted} count).`
          : ''
      }`
    );
    add(
      'Breaches',
      `An enemy that crosses your line at the bottom of the field is a breach. The count is shown at the top. Reach the limit and the realm falls.${
        limits ? ` Limit by difficulty: ${limits}.` : ''
      } Some spoils and ribbons raise it.`
    );
    add(
      'Line-breakers',
      `From wave 3 some enemies carry a red pennant. They ignore your soldiers and run for the line. They are quicker than the rest and a little weaker. ${unitName('cavalry')} and ${unitName('scout')} hit them much harder, a ${buildName('wall')} stops a few each wave and makes them fight, and hunting soldiers go for them first.`
    );
    add(
      'Sectors and the muster',
      'The host enters from the top edge in three sectors: left, centre and right. At night, markers on the top edge show which sectors the next wave will use. Enemies form up near the top before they advance, and your soldiers wait for them to leave that muster ground, so the fight happens in the open field.'
    );
    add(
      'War camps',
      'The enemy raises war camps along the top edge. A camp still standing when the next wave forms makes that wave stronger. Send soldiers up to destroy it and the bonus is gone. A camp is far from your line: whoever you send is not holding it.'
    );
    add(
      'Factions',
      'One faction leads each wave and fights its own way. The night preview names it. See the Enemies tab for what each one does and what beats it.'
    );
    add(
      'Posts',
      `Every soldier has a post: the spot where you placed him or last sent him. He fights from it and walks back to it when the fight is over, so the line keeps its shape. Select soldiers and click the field to give them a new post. ${kPosts} sends the selection straight back to its posts.`
    );
    add(
      'Hunt and Hold',
      `Hunt is the default. A hunting soldier leaves his post to fight what comes near, on a leash: about 240 from the post for melee, about 140 for archers and mages, half as far again after a line-breaker. Hold is an order: Shift+click the field to send soldiers to a spot and hold it, or press ${kHold} to hold where they stand. A holding soldier does not chase; he strikes only what comes into reach. ${kHunt} releases Hold. With nothing selected, both keys apply to the whole army. The HUNT and HOLD buttons do the same.`
    );
    add(
      'The med tent',
      `With a ${buildName('medical_tent')} standing, a wounded soldier who is not fighting walks to it at once, heals to full and returns to his post. A soldier in a fight stays in it while above half health and breaks off below. A tent has four beds; the rest wait outside. Holding soldiers go too and come back to hold. The ${unitName('general')} does not go.`
    );
    add(
      'Counters and rear attacks',
      'Every troop is strong against something and weak against something; each page in Your army says what. Any blow from behind lands 25% harder, for both sides. Do not let the line be turned.'
    );
    add(
      'Wave preview and the watchtower',
      `Each night the top of the screen shows what the next wave is likely to bring. With a ${buildName('watchtower')} standing, or a Scout Report from the spy, it lists the wave by type and number.`
    );
    add(
      'Supply crates',
      'From wave 2, crates land on the field by day. Walk a soldier onto one to open it: TP, bandages for those nearby, or rations that lift morale. Now and then a crate is bait and goblins spring from it. Crates are a quick pickup; they never stop the game.'
    );
    add(
      'Veterans',
      'Soldiers earn experience from kills (healers, builders and couriers from their work) and rise through six ranks, each one tougher and deadlier. A soldier who lasts may be given a name by the line. A veteran lost is not replaced by a recruit.'
    );
    add(
      'Morale',
      'Soldiers who watch their comrades die lose heart, and a soldier with none left runs. A bard, a mess hall, the General, War Cry and Battle Rally all restore it. Breaches shake the whole line.'
    );
    if (Object.keys(diffs).length) {
      add(
        'Difficulty',
        Object.values(diffs)
          .map(
            (d) =>
              `${d.label} — start with ${d.startingTp} TP, breach limit ${d.missLimit}, enemy health ${pct(d.enemyHpMult)}, enemy numbers ${pct(d.enemyCountMult)}.`
          )
          .join('\n')
      );
    }
    const modes = G('GameModes')?.MODES;
    if (modes) {
      add(
        'Modes',
        `${Object.values(modes)
          .map((m) => m.label)
          .join(
            ', '
          )}. Each is described on the main menu. Warband halves the army: soldiers cost double and are far tougher.`
      );
    }
    add(
      'Saving',
      'Save from the pause menu: a quick save, or one of three slots. Saves are kept in this browser. Ironman, daily and weekly runs, and Creative mode do not save.'
    );
    add(
      'Cheats',
      'Entering a cheat code voids the run: no score, no ribbons, no achievements. The after-action report says so.'
    );
    add(
      'Keys',
      `Press ${kSheet} at any time for the keys that work on the screen you are looking at. Every button shows its key. Space pauses, Tab selects the next soldier, Esc cancels.`
    );
    return out;
  }

  // ---------------------------------------------------------------- your army
  /** The troops a commander recruits, in panel order when the key map knows it. */
  function troopTypes() {
    const troops = G('Roster')?.TROOPS || {};
    const order = G('Hotkeys')?.DEPLOY_ORDER || [];
    const known = order.filter((t) => troops[t]);
    for (const t of Object.keys(troops)) if (!known.includes(t)) known.push(t);
    return known.filter((t) => G('UnitDefs')?.[t]);
  }

  function researchFor(kind, id) {
    const nodes = G('Research')?.ALL_NODES || [];
    const node = nodes.find((n) => (n[kind] || []).includes(id));
    return node ? node.name : '';
  }

  function buildArmyEntries() {
    const R = G('Roster');
    if (!R) return [];
    const notes = G('SiegeLoop')?.COUNTER_NOTES || {};
    const lines = G('LoreData')?.TROOP_LINES || {};
    const out = [];
    for (const type of troopTypes()) {
      const p = R.TROOPS[type];
      const def = G('UnitDefs')[type];
      const needs = researchFor('deploy', type);
      const stats = [
        `${def.cost} TP`,
        `health ${def.hp}`,
        def.damage ? `damage ${def.damage}` : '',
        def.range > 60 ? `range ${def.range}` : '',
        needs ? `needs ${needs}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      out.push(
        entry('army', def.name, `${p.trait}\n\n${stats}`, {
          unitId: type,
          quote: lines[type] || '',
          tags: [
            { k: 'role', v: p.role },
            { k: 'weak', v: p.weak },
            notes[type] ? { k: 'counter', v: notes[type] } : null,
          ].filter(Boolean),
        })
      );
    }
    return out;
  }

  // ---------------------------------------------------------------- buildings
  /**
   * The one job of each building. Names and prices come from BuildDefs; an id the data
   * no longer has is skipped.
   */
  const BUILDING_JOBS = {
    outpost: () =>
      `Cover for one soldier. An archer inside shoots further. Takes one upgrade, once: ${buildName('outpost_barracks')} or ${buildName('outpost_granary')}.`,
    outpost_barracks: () => {
      const r = G('EconomyRules')?.BUILDINGS?.barracks;
      return `Outpost upgrade. A free ${unitName('footman')} musters here every ${r ? ordinal(r.musterEvery) : 'third'} dawn.${r ? ` The first ${r.maxCounted} count.` : ''} The choice is final for that Outpost.`;
    },
    outpost_granary: () => {
      const r = G('EconomyRules')?.BUILDINGS?.granary;
      return `Outpost upgrade. Feeds ${r ? r.freeArmy : 3} more soldiers before army upkeep starts.${r ? ` The first ${r.maxCounted} count.` : ''} The choice is final for that Outpost.`;
    },
    wall: () => {
      const r = G('EconomyRules')?.BUILDINGS?.wall;
      return `Blocks movement and holds line-breakers: each wall stops ${r ? `up to ${r.holdsPerWave}` : 'a few'} runners a wave that come close, and makes them fight. Turn it before placing.`;
    },
    watchtower: () =>
      'While one stands, the night preview lists the next wave by type and number. Reveals hidden enemies near it.',
    spike_trap: () => 'Wounds the first enemy to cross it, again and again.',
    medical_tent: () =>
      'The wounded walk here on their own, heal to full and go back to their posts. Four beds.',
    mess_hall: () => 'Soldiers near it keep their morale.',
    research_lab: () => {
      const r = G('EconomyRules')?.BUILDINGS?.research_lab;
      return `Pays science at every dawn${r ? ` (${r.dawnScience} per lab, first ${r.maxCounted} labs)` : ''}, and a little from kills. Science buys research.`;
    },
    trade_outpost: () => {
      const d = G('BuildDefs')?.trade_outpost;
      return `Pays ${d?.tpPerRound ?? 2} TP at dawn.`;
    },
    quarry: () => {
      const d = G('BuildDefs')?.quarry;
      return `Pays ${d?.tpPerRound ?? 3} TP at dawn.`;
    },
    castle: () =>
      'A full compound in one order: walls, outposts, a keep, a med tent and a mess hall. A General in the keep commands the walls.',
  };

  function ordinal(n) {
    return { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth' }[n] || `${n}th`;
  }

  function buildBuildingEntries() {
    const defs = G('BuildDefs');
    if (!defs) return [];
    const out = [
      entry(
        'buildings',
        'How building works',
        `Every building needs a ${unitName('builder')} on the field; one builder runs two projects at a time. Open the Build tab or press a build key, then click the field. DEMOLISH removes a building for part of its price; MOVE relocates a finished one. Each building has one job.`
      ),
    ];
    for (const [id, job] of Object.entries(BUILDING_JOBS)) {
      const def = defs[id];
      if (!def) continue;
      const needs = researchFor('build', id);
      out.push(
        entry('buildings', def.name, job(), {
          buildId: id,
          tags: [
            { k: 'role', v: `${def.cost} TP` },
            needs ? { k: 'weak', v: `needs ${needs}` } : null,
          ].filter(Boolean),
        })
      );
    }
    const group = (name, intro, pick) => {
      const members = Object.entries(defs).filter(([id, d]) => pick(id, d));
      if (!members.length) return;
      out.push(
        entry(
          'buildings',
          name,
          `${intro}\n\n${members.map(([, d]) => `${d.name} — ${d.cost} TP`).join('\n')}`
        )
      );
    };
    group(
      'Academies',
      'Late works, opened by research. An academy trains one kind of soldier each round while a veteran of that kind is on the field to teach.',
      (id, d) => d.isAcademy && /^academy_/.test(id)
    );
    group(
      'Settlements',
      'Late works, opened by research. A settlement pays TP every round and can be grown, stage by stage.',
      (id) =>
        [
          'hamlet',
          'village',
          'town',
          'city',
          'metropolis',
          'merchant_guild',
          'fortress_upgrade',
        ].includes(id)
    );
    group(
      'Tonic stands',
      'Late works for commanders who have sworn a company of champions. Soldiers collect a tonic from a stand during the night.',
      (id) => /^perk_/.test(id)
    );
    return out;
  }

  // ----------------------------------------------------------------- research
  function buildResearchEntries() {
    const Rs = G('Research');
    const out = [
      entry(
        'research',
        'How research works',
        `Build a ${buildName('research_lab')}. It pays science at every dawn, and kills add a little. Open the Research panel and choose a project; one runs at a time. A lab built early brings the first iron-armed troops around wave 6.`
      ),
    ];
    const nodes = (Rs?.ALL_NODES || []).filter((n) => !n.faction && !n.crossover);
    for (const n of nodes) {
      const opens = [...(n.deploy || []).map(unitName), ...(n.build || []).map(buildName)];
      out.push(
        entry('research', n.name, n.desc || '', {
          researchId: n.id,
          refs: { units: n.deploy || [], builds: n.build || [] },
          tags: [
            { k: 'role', v: `${n.cost} science` },
            n.wave ? { k: 'weak', v: `from wave ${n.wave}` } : null,
            opens.length ? { k: 'counter', v: `opens ${opens.join(', ')}` } : null,
          ].filter(Boolean),
        })
      );
    }
    return out;
  }

  // ------------------------------------------------------------------- orders
  function describeAbility(a) {
    if (a.desc) return a.desc;
    const bits = [];
    if (a.damage) bits.push(`${a.damage} damage`);
    if (a.healAmount) bits.push(`heals ${a.healAmount}`);
    if (a.moraleBoost) bits.push(`+${a.moraleBoost} morale to the whole army`);
    if (a.mitigation) bits.push(`soldiers inside take ${pct(a.mitigation)} less damage`);
    if (a.slowDuration) bits.push(`slows for ${Math.round(a.slowDuration / 60)} seconds`);
    if (a.revealDuration) bits.push('reveals hidden enemies');
    if (a.units) bits.push(`sends ${list(a.units, unitName)}`);
    if (a.radius) bits.push(`radius ${a.radius}`);
    const s = bits.join(' · ');
    return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}.` : '';
  }

  function buildOrderEntries() {
    const out = [];
    const add = (name, body, extras) => out.push(entry('orders', name, body, extras));
    const general = unitName('general');
    add(
      `The ${general}'s orders`,
      `With a ${general} on the field, by day, two orders reach every soldier near him.\n\nWar Cry (${key('day', 'order', 'warCry', '[')}) — they strike 20% harder for 8 seconds and regain morale. Ready again after 45 seconds.\n\nHold the Line (${key('day', 'order', 'holdLine', ']')}) — they take 40% less damage for 7 seconds. Ready again after 60 seconds.`
    );
    add(
      'Hunt, Hold and posts',
      `${key('day', 'hunt', null, 'H')} — Hunt: release Hold.\n${key('day', 'holdHere', null, 'Shift+H')} — Hold here.\nShift+click the field — move there and hold.\n${key('unit_selected', 'backToPosts', null, 'B')} — back to posts (with soldiers selected).\n\nSee How to play for the rules.`
    );
    const abilities = G('Abilities') || {};
    for (const [id, a] of Object.entries(abilities)) {
      const k = key('day', 'ability', id);
      add(`Spell: ${a.name}`, describeAbility(a), {
        tags: [{ k: 'role', v: `${a.cost} TP` }, k ? { k: 'counter', v: `key ${k}` } : null].filter(
          Boolean
        ),
      });
    }
    const rules = G('EconomyRules')?.ACTIONS || {};
    const cooldown = (rule) =>
      rule?.cooldown ? { k: 'weak', v: `once every ${rule.cooldown} waves` } : null;
    add(
      'The spy',
      'The spy works on the next wave from the right-hand panel: thin it, weaken it, strip its siege engines, or learn what it is. Each action has a price, and the strongest have a cooldown shown on the button.'
    );
    // Actions tied to the far late game are left to their own buttons.
    const early = (a) =>
      !a.kingdomStage && !((a.waveMin || 0) >= 100) && !/Wave \d{3}\+/.test(a.desc || '');
    for (const [id, a] of Object.entries(G('SpyActions') || {})) {
      if (!early(a)) continue;
      add(`Spy: ${a.name}`, a.desc || '', {
        tags: [{ k: 'role', v: `${a.cost} TP` }, cooldown(rules[`spy:${id}`])].filter(Boolean),
      });
    }
    add(
      'The courier',
      `A ${unitName('courier')} on the field carries one message a wave from the right-hand panel: gold, men or heart for the line.`
    );
    for (const [id, a] of Object.entries(G('CourierMessages') || {})) {
      if (!early(a)) continue;
      add(`Courier: ${a.name}`, a.desc || '', {
        tags: [{ k: 'role', v: `${a.cost} TP` }, cooldown(rules[`courier:${id}`])].filter(Boolean),
      });
    }
    return out;
  }

  // ------------------------------------------------------- spoils and edicts
  function buildSpoilsEntries() {
    const out = [
      entry(
        'spoils',
        'Spoils of war',
        `Every fifth wave pays spoils. When that wave is cleared the field dims and three rewards are offered; nothing else happens until you take one (${key('spoils', 'spoilPick', 0, '1')}, ${key('spoils', 'spoilPick', 1, '2')}, ${key('spoils', 'spoilPick', 2, '3')}, or the arrow keys and Enter). What you take lasts for the rest of the run.`
      ),
      entry(
        'spoils',
        'Edicts',
        'Most spoils are edicts: standing rules for your army. The same edict can be taken up to three times, and its effect adds up each time. After that it is no longer offered.'
      ),
    ];
    for (const [id, e] of Object.entries(G('SiegeLoop')?.EDICTS || {})) {
      out.push(entry('spoils', e.name, e.desc, { edictId: id }));
    }
    return out;
  }

  // ------------------------------------------------------- ribbons and score
  function buildRibbonEntries() {
    const S = G('SiegeLoop');
    const ribbons = S?.getRibbons?.() || [];
    const out = [
      entry(
        'ribbons',
        'Ribbons',
        `${ribbons.length || 16} ribbons, each earned once by something the line has done, across all your runs. Each gives a small permanent bonus to every run after. Earned ribbons are marked below and listed on the main menu.`
      ),
    ];
    if (S?.computeScore) {
      const one = S.computeScore({ waves: 1, kills: 1, breaches: 0, lost: 0 });
      const pen = S.computeScore({ waves: 100, kills: 0, breaches: 1, lost: 1 });
      const diffs = Object.values(G('DIFFICULTIES') || {})
        .map((d) => `${d.label} ×${S.computeScore({ waves: 1, difficulty: d.id }).difficultyMult}`)
        .join(', ');
      out.push(
        entry(
          'ribbons',
          'Run score',
          `Scored when the run ends: ${one.wavePoints} for each wave cleared and ${one.killPoints} for each kill, less ${pen.breachPenalty} for each breach and ${pen.lossPenalty} for each soldier lost. The total is multiplied for difficulty${diffs ? ` (${diffs})` : ''} and for each Advanced Difficulty modifier in play.`
        ),
        entry(
          'ribbons',
          'Best scores',
          'Your best runs are kept in this browser and shown on the main menu and in the after-action report.'
        )
      );
    }
    out.push(
      entry(
        'ribbons',
        'Voided runs',
        'A run in which a cheat code was used is not scored and earns no ribbons or achievements. Creative mode is never scored.'
      )
    );
    for (const r of ribbons) {
      out.push(
        entry('ribbons', r.name, r.how, {
          ribbonId: r.id,
          tags: [{ k: 'counter', v: r.perk }, r.earned ? { k: 'role', v: 'earned' } : null].filter(
            Boolean
          ),
        })
      );
    }
    return out;
  }

  // ------------------------------------------------------------------ enemies
  /** Used only when the faction data carries no tactic of its own. Keyed by faction id. */
  const FACTION_FALLBACK = {
    goblin_hordes: {
      tactic: 'Numbers. Many weak bodies, and more line-breakers than any other host.',
      counter: 'Splash damage, walls to hold the runners, riders to cut them down.',
    },
    orc_warbands: {
      tactic: 'Weight. Heavy infantry up the middle, riders on the edges, a chief to drive them.',
      counter: 'Pikes against the riders, crossbows and mages against the armour. Kill the chief.',
    },
    dark_legions: {
      tactic: 'Attrition. Hexes weaken your line while summoners refill theirs.',
      counter: 'Reach the casters with cavalry and scouts. Kill the summoners first.',
    },
    void_abyssal: {
      tactic: 'Murder. Stalkers go for the General and the back rank while brutes pin the front.',
      counter: 'Guard the General. Ballistae and mages on the brutes.',
    },
  };

  const isBoss = (type) => /^boss_/.test(type) || !!G('EnemyDefs')?.[type]?.bossName;

  function factionMembers(f) {
    const seen = new Set();
    const push = (t) => {
      if (t && G('EnemyDefs')?.[t] && !isBoss(t)) seen.add(t);
    };
    for (const t of f.units || []) push(t);
    for (const tier of f.tiers || []) {
      for (const t of tier.units || []) push(t);
      for (const t of tier.elites || []) push(t);
    }
    return [...seen];
  }

  function enemyEntry(type) {
    const p = G('Roster')?.ENEMIES?.[type];
    const def = G('EnemyDefs')[type];
    const stats = `health ${def.hp} · damage ${def.damage}${def.range > 60 ? ` · range ${def.range}` : ''}`;
    return entry('enemies', def.name, `${p ? `${p.trait}\n\n` : ''}${stats}`, {
      enemyId: type,
      quote: G('LoreData')?.ENEMY_LINES?.[type] || '',
      tags: p
        ? [
            { k: 'role', v: p.role },
            { k: 'counter', v: p.weak },
          ]
        : [],
    });
  }

  function buildEnemyEntries() {
    const defs = G('EnemyDefs');
    if (!defs) return [];
    const out = [
      entry(
        'enemies',
        'The host',
        'One faction leads each wave. It brings its own troops and fights its own way; the others fill the ranks behind it. Each enemy below has one job, one trait, and one thing that beats it.'
      ),
    ];
    const placed = new Set();
    for (const f of Object.values(G('EnemyFactions')?.FACTIONS || {})) {
      const members = factionMembers(f);
      if (!members.length) continue;
      const fb = FACTION_FALLBACK[f.id] || {};
      const tactic = f.tactic?.desc || f.tacticDesc || f.tactic || fb.tactic || f.tagline || '';
      const counter = f.counter || f.tactic?.counter || fb.counter || '';
      out.push(
        entry(
          'enemies',
          f.name,
          `${typeof tactic === 'string' ? tactic : ''}\n\nIn its ranks: ${list(members, enemyName)}.`,
          {
            factionId: f.id,
            refs: { enemies: members },
            tags: [
              f.waveMin > 1 ? { k: 'role', v: `from wave ${f.waveMin}` } : null,
              typeof counter === 'string' && counter ? { k: 'counter', v: counter } : null,
            ].filter(Boolean),
          }
        )
      );
      for (const t of members) {
        if (placed.has(t)) continue;
        placed.add(t);
        out.push(enemyEntry(t));
      }
    }
    const rest = Object.keys(defs).filter((t) => !placed.has(t) && !isBoss(t));
    if (rest.length && placed.size) {
      out.push(
        entry(
          'enemies',
          'Others in the host',
          'These march with whichever faction leads the wave.',
          { refs: { enemies: rest } }
        )
      );
    }
    for (const t of rest) out.push(enemyEntry(t));
    return out;
  }

  // ------------------------------------------------------------------- bosses
  function buildBossEntries() {
    const defs = G('EnemyDefs');
    if (!defs) return [];
    const roster = G('MonsterBosses')?.BOSS_ROSTER || [];
    const out = [
      entry(
        'bosses',
        'Warlords',
        'Every tenth wave a named warlord leads the host, with a pack of his own. Ten have names. After the tenth, the first returns, stronger, and each one that comes back brings a larger pack. A warlord changes at half health: read its page before it arrives.'
      ),
    ];
    const types = roster.length
      ? roster.map((b) => b.type)
      : Object.keys(defs).filter((t) => isBoss(t));
    for (const type of types) {
      const def = defs[type];
      if (!def) continue;
      const meta = roster.find((b) => b.type === type);
      const p = G('Roster')?.ENEMIES?.[type];
      const lines = G('LoreData')?.BOSS_LINES?.[type];
      const stats = `health ${def.hp} · damage ${def.damage}${def.range > 60 ? ` · range ${def.range}` : ''}`;
      out.push(
        entry(
          'bosses',
          def.bossName || def.name,
          `${p ? `${p.trait}\n\n` : ''}${stats}${lines?.fall ? `\n\nAt the end: ${lines.fall}` : ''}`,
          {
            enemyId: type,
            quote: lines?.arrive || '',
            tags: [
              meta?.debutWave ? { k: 'role', v: `first at wave ${meta.debutWave}` } : null,
              p ? { k: 'weak', v: p.role.replace(/^Boss — /, '') } : null,
              p ? { k: 'counter', v: p.weak } : null,
            ].filter(Boolean),
          }
        )
      );
    }
    return out;
  }

  // ------------------------------------------------------------- status marks
  const MARK_MEANINGS = {
    pin: ['Pinned', 'Nailed in place. Cannot move until it wears off.'],
    burn: ['Burning', 'Takes fire damage every moment until it goes out.'],
    hex: ['Hexed', 'Deals less damage for a few seconds.'],
    plague: ['Plagued', 'A bite or a cloud that keeps hurting for several seconds.'],
    frost: ['Slowed', 'Moves slowly: frost, mud or a snare.'],
    expose: ['Exposed', 'Armour split. Takes more damage from every blow.'],
    enrage: ['Enraged', 'Hits much harder. Usually a wounded brute or a warlord past half health.'],
    guard: ['Guarded', 'A comrade is taking part of the damage meant for him.'],
    bulwark: ['Bulwark', 'One of yours, taking less damage: fieldworks, an order or a zone.'],
    ward: ['Warded', 'An enemy under a shaman or a shield. Takes less damage.'],
    banner: ['Under a banner', 'An enemy near a chief. Hits harder until the chief is dead.'],
    might: ['Might', 'A doctrine in force: more damage.'],
    iron: ['Iron', 'A doctrine in force: less damage taken.'],
    haste: ['Haste', 'A doctrine in force: moves faster.'],
    prey: ['Hunting', 'Has chosen one target and hits it harder than any other.'],
    ramp: ['Building', 'Hits harder with each blow on the same target. The strokes count how far.'],
    omen: ['Omen', "A seer's word is on this one for a few seconds."],
  };

  function buildMarkEntries() {
    const marks = G('Roster')?.STATUS_MARKS || [];
    const out = [
      entry(
        'marks',
        'Reading the marks',
        'Small badges above a unit show what is acting on it. Up to six are shown at once. Bone and steel marks are protections; blood marks are threats.'
      ),
    ];
    for (const m of marks) {
      const [name, body] = MARK_MEANINGS[m] || [m, 'A condition acting on this unit.'];
      out.push(entry('marks', name, body, { mark: m }));
    }
    return out;
  }

  // ---------------------------------------------- champions and companies
  /**
   * One page per troop, archetype, champion, operative and enemy: its job, its trait and
   * how to beat it. Kept as a flat list for callers that check every profile is listed;
   * the Champions tab folds the same profiles into one page per company.
   */
  function buildRoleEntries() {
    const R = G('Roster');
    if (!R) return [];
    const page = (name, p, weakLabel) => ({
      cat: 'roles',
      name: `${name} — ${p.role}`,
      body: `${p.trait}\n\n${weakLabel}: ${p.weak}`,
    });
    const out = [];
    for (const [type, p] of Object.entries(R.TROOPS)) {
      out.push(page(unitName(type), p, 'Weakness'));
    }
    for (const company of companies()) {
      for (const m of company.members) {
        out.push({
          cat: 'roles',
          name: `${m.def.name} — ${m.profile.role}`,
          body: `${company.label}\n\n${m.profile.trait}\n\nWeakness: ${m.profile.weak}`,
        });
      }
    }
    for (const [type, p] of Object.entries(R.ENEMIES)) {
      out.push(page(enemyName(type), p, 'How to beat it'));
    }
    return out;
  }

  /** Every company of champions, read from data: label, hall, members, whether sworn. */
  function companies() {
    const profiles = G('Roster')?.PROFILES || {};
    const Meta = G('MetaProgress');
    const out = [];
    const members = (defs, keep) =>
      Object.entries(defs)
        .filter(([id, def]) => profiles[id] && keep(def))
        .map(([id, def]) => ({ id, def, profile: profiles[id] }));
    const arena = G('WweDefs');
    if (arena) {
      out.push({
        id: 'arena',
        label: buildName('wwe_academy'),
        hall: 'wwe_academy',
        sworn: !!Meta?.isWweUnlocked?.(),
        members: members(arena, () => true),
      });
    }
    const defs = G('CrossoverDefs');
    const factions = G('CrossoverFactions');
    if (defs) {
      const ids = factions
        ? Object.keys(factions)
        : [...new Set(Object.values(defs).map((d) => d.faction))];
      for (const fid of ids) {
        const f = factions?.[fid] || {};
        out.push({
          id: fid,
          label: f.label || fid,
          hall: f.building || null,
          sworn: !!Meta?.isCrossoverFactionUnlocked?.(fid),
          members: members(defs, (def) => def.faction === fid),
        });
      }
    }
    return out.filter((c) => c.members.length);
  }

  function buildChampionEntries() {
    const all = companies();
    if (!all.length) return [];
    const out = [
      entry(
        'champions',
        'Champions and companies',
        `Champions are fighters from outside the realm, far stronger than line troops and priced to match. They come in companies. A company must first be sworn to your line (each has its own trial, listed under Achievements); then a ${unitName('builder')} raises its hall, and its fighters are recruited from the Legion Archive. Each has his own role, trait and weakness. ${all.filter((c) => c.sworn).length} of ${all.length} companies are sworn to you.`
      ),
    ];
    for (const c of all) {
      const hall = c.hall && G('BuildDefs')?.[c.hall];
      const head = hall ? `Hall: ${hall.name}, ${hall.cost} TP.` : '';
      const refs = { units: c.members.map((m) => m.id), builds: hall ? [c.hall] : [] };
      if (!c.sworn) {
        out.push(
          entry(
            'champions',
            c.label,
            `Not yet sworn to your line. ${c.members.length} fighters keep this company's hall. Their names are not in your ledgers.`,
            { companyId: c.id, refs, tease: true }
          )
        );
        continue;
      }
      out.push(
        entry(
          'champions',
          c.label,
          `${head}\n\n${c.members
            .map(
              (m) =>
                `${m.def.name} — ${m.profile.role}, ${m.def.cost} TP\n${m.profile.trait}\nWeakness: ${m.profile.weak}`
            )
            .join('\n\n')}`,
          { companyId: c.id, refs }
        )
      );
    }
    return out;
  }

  // ------------------------------------------------------------ world and lore
  function buildWorldEntries() {
    const out = [];
    const world = G('LoreData')?.buildWorldEntries?.() || [];
    for (const e of world) out.push({ ...e, cat: 'world' });
    const story = G('StoryLore')?.getEncyclopediaEntries?.() || [];
    for (const e of story) out.push({ ...e, cat: 'world' });
    // The player's own record: the latest reports only, newest first.
    const chronicles = G('Chronicles')?.getEncyclopediaEntries?.() || [];
    for (const e of chronicles.slice(0, 12)) out.push({ ...e, cat: 'world' });
    return out;
  }

  // ---------------------------------------------------------------- assemble
  const BUILDERS = [
    buildHowToEntries,
    buildArmyEntries,
    buildBuildingEntries,
    buildResearchEntries,
    buildOrderEntries,
    buildSpoilsEntries,
    buildRibbonEntries,
    buildEnemyEntries,
    buildBossEntries,
    buildMarkEntries,
    buildChampionEntries,
    buildWorldEntries,
  ];

  function getAllEntries() {
    const out = [];
    for (const build of BUILDERS) {
      try {
        for (const e of build()) {
          if (e && e.name) out.push({ ...e, name: String(e.name), body: String(e.body || '') });
        }
      } catch (err) {
        // One broken section must not blank the whole reference.
        if (typeof console !== 'undefined') console.warn('Encyclopedia section failed', err);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ render
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const TAG_CLASS = { role: 'threat', weak: 'weak', counter: 'counter' };

  function renderEntryBody(e) {
    const parts = [];
    if (e.quote) {
      parts.push(`<div class="ency-entry-body"><em>${esc(e.quote)}</em></div>`);
    }
    parts.push(`<div class="ency-entry-body">${esc(e.body).replace(/\n/g, '<br>')}</div>`);
    if (e.tags && e.tags.length) {
      parts.push(
        `<div class="ency-bestiary-tags">${e.tags
          .map((t) => `<span class="ency-btag ${TAG_CLASS[t.k] || 'threat'}">${esc(t.v)}</span>`)
          .join('')}</div>`
      );
    }
    if (e.chronicleMeta) {
      const kind =
        e.chronicleType === 'run'
          ? 'Run'
          : e.chronicleType === 'choice'
            ? 'Choice'
            : e.chronicleType === 'narrative'
              ? 'Record'
              : 'Wave';
      parts.push(`<div class="ency-chronicle-meta">${kind} · ${esc(e.chronicleMeta)}</div>`);
    }
    if (e.storyMeta) parts.push(`<div class="ency-chronicle-meta">${esc(e.storyMeta)}</div>`);
    return parts.join('');
  }

  function renderEntry(e) {
    const mark = e.mark
      ? `<canvas class="ency-mark" data-mark="${esc(e.mark)}" width="28" height="28" style="vertical-align:middle;margin-right:6px"></canvas>`
      : '';
    return `<div class="ency-entry ${e.tease ? 'ency-tease' : ''}">
        <div class="ency-entry-name">${mark}${esc(e.name)}</div>
        ${renderEntryBody(e)}
      </div>`;
  }

  /** Draws each status mark beside its name, with the same code the field uses. */
  function paintMarks(root) {
    const draw = G('Roster')?.drawStatusMark;
    if (!draw || !root.querySelectorAll) return;
    root.querySelectorAll('canvas.ency-mark').forEach((cv) => {
      try {
        const c = cv.getContext('2d');
        if (!c) return;
        c.clearRect(0, 0, cv.width, cv.height);
        c.save();
        c.translate(cv.width / 2, cv.height / 2);
        c.scale(2, 2);
        draw(c, cv.dataset.mark, 0, 0, 0, cv.dataset.mark === 'ramp' ? 3 : 0);
        c.restore();
      } catch (_) {
        /* a mark that cannot be drawn is left blank */
      }
    });
  }

  let activeCat = 'howto';
  let searchQuery = '';

  function matches(e, q) {
    if (e.name.toLowerCase().includes(q) || e.body.toLowerCase().includes(q)) return true;
    if (e.quote && e.quote.toLowerCase().includes(q)) return true;
    return (e.tags || []).some((t) => String(t.v).toLowerCase().includes(q));
  }

  /** Entries for a search, across every tab; the tab's label counts as a match too. */
  function search(query, entries = getAllEntries()) {
    const q = String(query || '')
      .trim()
      .toLowerCase();
    if (!q) return [];
    const label = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label.toLowerCase()]));
    return entries.filter((e) => matches(e, q) || (label[e.cat] || '').includes(q));
  }

  function renderPanel() {
    if (typeof document === 'undefined') return;
    const tabs = document.getElementById('encyclopedia-tabs');
    const listEl = document.getElementById('encyclopedia-list');
    if (!tabs || !listEl) return;

    const sub = document.querySelector?.('#encyclopedia-screen .ency-subtitle');
    if (sub) sub.textContent = SUBTITLE;

    const entries = getAllEntries();
    const q = searchQuery.trim();
    const counts = {};
    for (const e of entries) counts[e.cat] = (counts[e.cat] || 0) + 1;

    tabs.innerHTML = CATEGORIES.filter((c) => counts[c.id])
      .map(
        (c) =>
          `<button class="ency-tab ${!q && c.id === activeCat ? 'active' : ''}" data-cat="${c.id}">${esc(c.label)}</button>`
      )
      .join('');
    tabs.querySelectorAll('.ency-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        G('AudioEngine')?.SFX?.click?.();
        activeCat = btn.dataset.cat;
        searchQuery = '';
        const box = document.getElementById('encyclopedia-search');
        if (box) box.value = '';
        renderPanel();
        listEl.scrollTop = 0;
      });
    });

    const shown = q ? search(q, entries) : entries.filter((e) => e.cat === activeCat);
    const labelOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
    const head = q
      ? `<p class="ency-empty">${shown.length} ${shown.length === 1 ? 'entry' : 'entries'} for "${esc(q)}"</p>`
      : '';
    listEl.innerHTML = shown.length
      ? head +
        shown
          .map((e) => renderEntry(q ? { ...e, name: `${e.name} · ${labelOf[e.cat] || ''}` } : e))
          .join('')
      : `<p class="ency-empty">${q ? `Nothing found for "${esc(q)}".` : 'No entries here.'}</p>`;
    paintMarks(listEl);
  }

  function refreshData() {
    G('MetaProgress')?.load?.();
    G('Legacy')?.load?.();
    G('Chronicles')?.load?.();
    G('StoryLore')?.load?.();
    renderPanel();
  }

  function open(opts = {}) {
    const panel = document.getElementById('encyclopedia-screen');
    if (!panel) return;
    returnToPause = !!opts.fromPause;
    if (opts.fromPause && typeof UX !== 'undefined') UX.suppressPauseForOverlay();
    if (Game.isPlaying?.() && !Game.getState().paused) {
      Game.setPaused?.(true);
      returnToPause = true;
    }
    if (opts.cat && CATEGORIES.some((c) => c.id === opts.cat)) activeCat = opts.cat;
    panelOpen = true;
    panel.classList.add('active');
    refreshData();
    G('AudioEngine')?.SFX?.click?.();
  }

  function close() {
    const panel = document.getElementById('encyclopedia-screen');
    if (!panel) return;
    panelOpen = false;
    panel.classList.remove('active');
    G('AudioEngine')?.SFX?.click?.();
    if (returnToPause && Game.isPlaying?.() && Game.getState().paused) {
      returnToPause = false;
      if (typeof UX !== 'undefined') UX.openPauseMenu();
    } else {
      returnToPause = false;
    }
  }

  function isOpen() {
    return panelOpen;
  }

  function togglePanel() {
    if (panelOpen) close();
    else open();
  }

  function init() {
    document.getElementById('encyclopedia-btn')?.addEventListener('click', () => togglePanel());
    document.getElementById('menu-encyclopedia-btn')?.addEventListener('click', () => open());
    document
      .getElementById('pause-encyclopedia-btn')
      ?.addEventListener('click', () => open({ fromPause: true }));
    document.getElementById('encyclopedia-close')?.addEventListener('click', () => close());
    document.getElementById('encyclopedia-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPanel();
    });
  }

  return {
    CATEGORIES,
    init,
    open,
    close,
    isOpen,
    togglePanel,
    renderPanel,
    renderEntry,
    getAllEntries,
    search,
    buildRoleEntries,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Encyclopedia = Encyclopedia;
