/**
 * Story / Lore — branching narratives from player choices, chronicles integration.
 */
const StoryLore = (() => {
  const STORAGE_KEY = 'myth-and-blood-story-v1';
  const MAX_LIFETIME_CHOICES = 80;

  const BRANCHES = {
    iron_crown: {
      id: 'iron_crown',
      label: 'Iron Crown',
      epithet: 'the Iron Crown path',
      desc: 'Aggressive decrees, storm raids, and harnessed fury — the realm expands by force.',
      color: '#c04040',
    },
    silver_diplomat: {
      id: 'silver_diplomat',
      label: 'Silver Diplomat',
      epithet: 'the Silver Diplomat path',
      desc: 'Sealed rifts, fortified walls, and cautious evacuations — survival through restraint.',
      color: '#80a0c0',
    },
    arcane_scholar: {
      id: 'arcane_scholar',
      label: 'Arcane Scholar',
      epithet: 'the Arcane Scholar path',
      desc: 'Channelled storms, tapped ley lines, and claimed relics — power bought with risk.',
      color: '#8060e0',
    },
    pragmatist: {
      id: 'pragmatist',
      label: 'Pragmatist',
      epithet: 'the Pragmatist path',
      desc: 'Measured musters and weathered crises — no single doctrine, only what works.',
      color: '#c0a040',
    },
  };

  const CHOICE_WEIGHTS = {
    harness: { arcane_scholar: 2, iron_crown: 1 },
    evacuate: { silver_diplomat: 2, pragmatist: 1 },
    claim: { arcane_scholar: 2, iron_crown: 1 },
    seal: { silver_diplomat: 3 },
    tap: { arcane_scholar: 2, pragmatist: 1 },
    vent: { silver_diplomat: 1, pragmatist: 2 },
    channel: { arcane_scholar: 3 },
    ground: { silver_diplomat: 2 },
    anchor: { silver_diplomat: 2, pragmatist: 1 },
    ride: { iron_crown: 2 },
    loot: { iron_crown: 2, pragmatist: 1 },
    fortify: { silver_diplomat: 3 },
    raid: { iron_crown: 3 },
    brace: { silver_diplomat: 2, pragmatist: 1 },
    ignore: { pragmatist: 1 },
    outpost_stand: { silver_diplomat: 2 },
    royal_muster: { pragmatist: 2 },
    imperial_march: { iron_crown: 3 },
    hellforge_decree: { iron_crown: 4 },
  };

  const BRANCH_BEATS = {
    iron_crown: {
      31: {
        title: 'Iron Proclamation',
        hook: 'Wave thirty-one. The Crown rules by decree — your kingdom rises on martial law and veteran steel.',
        sub: 'Scribes note a hard edge in your chronicle. The north will answer in blood.',
      },
      100: {
        title: 'Empire of Conquest',
        hook: 'Wave one hundred. Empire Ascendant — your academies feed an army built to break, not bargain.',
        sub: 'Settlement raids and imperial marches define this era in the royal ledger.',
      },
      200: {
        title: 'Dominion by Fire',
        hook: 'Wave two hundred. Planetary Dominion — you mirror the host’s cruelty and outpace their economy by razing first.',
        sub: 'Counter-holds and couriers carry ultimatums, not petitions.',
      },
      500: {
        title: 'Worldheart Assault',
        hook: 'Wave five hundred. Sectors fall to spearpoint — the Worldheart Tyrant awakens to a crown that never kneels.',
        sub: 'True victory demands shattering the tyrant; the chronicles already call this a war of annihilation.',
      },
    },
    silver_diplomat: {
      31: {
        title: 'Measured Rising',
        hook: 'Wave thirty-one. Kingdom Rising — walls thicken, seals hold, and the Crown favors endurance over gambits.',
        sub: 'Your scribes praise caution; the host must erode you — they cannot shock you.',
      },
      100: {
        title: 'Fortress Empire',
        hook: 'Wave one hundred. Empire Ascendant — hamlets and guilds behind layered defenses decide every dawn.',
        sub: 'The chronicle speaks of a realm that trades ground only to reclaim it at dusk.',
      },
      200: {
        title: 'Guarded Dominion',
        hook: 'Wave two hundred. Planetary Dominion — you brace the north while couriers negotiate from strength.',
        sub: 'Enemy mirror settlements rise, but your sealed lines and fortified holds buy time.',
      },
      500: {
        title: 'Worldheart Vigil',
        hook: 'Wave five hundred. Sectors are taken methodically — the Worldheart Tyrant finds no crack in your patience.',
        sub: 'True victory will be recorded as discipline, not frenzy.',
      },
    },
    arcane_scholar: {
      31: {
        title: 'Arcane Ascension',
        hook: 'Wave thirty-one. Kingdom Rising — relics claimed, ley lines tapped, and mages stride beside knights.',
        sub: 'The Crown’s chronicle glows with storm-light; power is your currency.',
      },
      100: {
        title: 'Empire of Wonders',
        hook: 'Wave one hundred. Empire Ascendant — science and sorcery steer colony value and assault composition.',
        sub: 'Planet events answered with channelled fury echo in every wave report.',
      },
      200: {
        title: 'Dominion of Relics',
        hook: 'Wave two hundred. Planetary Dominion — mirrored rifts looted, storms ridden, ruins claimed.',
        sub: 'The north burns with borrowed power; the ledger warns of debts yet unpaid.',
      },
      500: {
        title: 'Worldheart Channel',
        hook: 'Wave five hundred. You channel the planet’s pulse while realms crumble — the Tyrant faces a crown that speaks its language.',
        sub: 'Field diverse unit types to pierce the ward; arcane reckoning awaits.',
      },
    },
    pragmatist: {
      31: {
        title: 'Kingdom Rising',
        hook: 'Wave thirty-one. The Outpost Realm hardens into a kingdom — no single doctrine, only what survived.',
        sub: 'Chronicles mark a commander who adapts faster than the host expects.',
      },
      100: {
        title: 'Empire Ascendant',
        hook: 'Wave one hundred. Full academy training and colony value steer assaults — you bend without breaking.',
        sub: 'The royal ledger shows balanced choices; the north cannot read your pattern.',
      },
      200: {
        title: 'Planetary Dominion',
        hook: 'Wave two hundred. Mirror war at scale — raids when profitable, walls when necessary.',
        sub: 'Economy purge or counter-holds: the chronicle says you chose what the wave demanded.',
      },
      500: {
        title: 'Planet Conquest',
        hook: 'Wave five hundred. Sectors fracture — you eliminate realms pragmatically until the Worldheart Tyrant stands alone.',
        sub: 'True victory requires shattering the tyrant; your path remains uncommitted until the end.',
      },
    },
  };

  const RUN_OUTRO = {
    iron_crown: {
      victory:
        'The chronicles close on an iron reign — northern ash and a crown that brooks no rival.',
      defeat: 'The iron crown slips — the host broke your momentum before the final decree.',
    },
    silver_diplomat: {
      victory: 'The chronicles praise a patient crown — walls held until the north had nothing left.',
      defeat: 'Caution could not outlast the tide — the silver ledger ends in retreat.',
    },
    arcane_scholar: {
      victory: 'Storms fade; the chronicles record a realm that bent ley lines to its will.',
      defeat: 'Borrowed power exacted its price — the arcane thread snaps in the ledger.',
    },
    pragmatist: {
      victory: 'No single myth — the chronicles say you did what was needed, wave by wave.',
      defeat: 'Adaptation was not enough — the host found a pattern in your pragmatism.',
    },
  };

  let lifetime = {
    branchTotals: { iron_crown: 0, silver_diplomat: 0, arcane_scholar: 0, pragmatist: 0 },
    choiceLog: [],
    arcsCompleted: [],
  };
  let session = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) lifetime = { ...lifetime, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    if (!lifetime.branchTotals || typeof lifetime.branchTotals.iron_crown !== 'number') {
      lifetime.branchTotals = { iron_crown: 0, silver_diplomat: 0, arcane_scholar: 0, pragmatist: 0 };
    }
    if (!lifetime.choiceLog) lifetime.choiceLog = [];
    if (!lifetime.arcsCompleted) lifetime.arcsCompleted = [];
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lifetime));
    } catch (_) {
      /* ignore */
    }
  }

  function emptyScores() {
    return { iron_crown: 0, silver_diplomat: 0, arcane_scholar: 0, pragmatist: 0 };
  }

  function onRunStart(ctx = {}) {
    session = {
      runId: `${Date.now()}`,
      difficulty: ctx.difficulty || 'normal',
      modeId: ctx.modeId || 'campaign',
      scores: emptyScores(),
      branch: 'pragmatist',
      choices: [],
      flags: {},
      beatsShown: new Set(),
      startedAt: Date.now(),
    };
  }

  function onRunEnd(ctx = {}) {
    if (!session) return;
    const branch = getDominantBranch();
    const outro = RUN_OUTRO[branch] || RUN_OUTRO.pragmatist;
    const line = ctx.victory ? outro.victory : outro.defeat;
    lifetime.branchTotals[branch] = (lifetime.branchTotals[branch] || 0) + 1;
    lifetime.arcsCompleted.unshift({
      branch,
      wave: ctx.wave,
      victory: !!ctx.victory,
      victoryReason: ctx.victoryReason,
      at: Date.now(),
      choiceCount: session.choices.length,
    });
    lifetime.arcsCompleted = lifetime.arcsCompleted.slice(0, 12);
    save();

    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendNarrativeBeat({
        title: `Story Arc — ${BRANCHES[branch]?.label || branch}`,
        summary: `${line} ${session.choices.length} recorded choices shaped ${BRANCHES[branch]?.epithet || branch}.`,
        branch,
        wave: ctx.wave,
        victory: ctx.victory,
      });
    }
    session = null;
  }

  function applyWeights(choiceId) {
    const weights = CHOICE_WEIGHTS[choiceId] || { pragmatist: 1 };
    for (const [branch, pts] of Object.entries(weights)) {
      session.scores[branch] = (session.scores[branch] || 0) + pts;
    }
  }

  function getDominantBranch(sess = session) {
    if (!sess) return 'pragmatist';
    let best = 'pragmatist';
    let bestScore = -1;
    for (const id of Object.keys(BRANCHES)) {
      const s = sess.scores[id] || 0;
      if (s > bestScore) {
        bestScore = s;
        best = id;
      }
    }
    sess.branch = best;
    return best;
  }

  function recordChoice(opts = {}) {
    if (!session || opts.creative) return null;
    const { source, choiceId, label, wave, eventId, meta } = opts;
    if (!choiceId) return null;

    const prevBranch = session.branch;
    applyWeights(choiceId);
    const branch = getDominantBranch();
    const entry = {
      wave: wave ?? 0,
      source: source || 'unknown',
      choiceId,
      label: label || choiceId,
      eventId: eventId || null,
      branch,
      at: Date.now(),
      meta: meta || null,
    };
    session.choices.push(entry);

    lifetime.choiceLog.unshift({
      ...entry,
      runId: session.runId,
    });
    lifetime.choiceLog = lifetime.choiceLog.slice(0, MAX_LIFETIME_CHOICES);
    save();

    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendChoiceReport(entry);
    }

    const shifted = prevBranch !== branch && session.choices.length >= 2;
    if (shifted && typeof Game !== 'undefined') {
      Game.showMessage?.(
        `Chronicle — your choices bend toward ${BRANCHES[branch]?.label || branch}.`,
        320
      );
    }

    checkBranchBeat(wave, branch, shifted);
    return { branch, shifted, entry };
  }

  function checkBranchBeat(wave, branch, force = false) {
    if (!session || !wave) return null;
    const beat = BRANCH_BEATS[branch]?.[wave];
    if (!beat || session.beatsShown.has(`${branch}:${wave}`)) return null;
    if (!force && session.choices.length < 2) return null;
    session.beatsShown.add(`${branch}:${wave}`);

    if (typeof Chronicles !== 'undefined') {
      Chronicles.appendNarrativeBeat({
        title: beat.title,
        summary: `${beat.hook} ${beat.sub}`,
        branch,
        wave,
        type: 'branch_beat',
      });
    }
    if (typeof Game !== 'undefined') {
      Game.showMessage?.(`Chronicle — ${beat.hook}`, 400);
      if (beat.sub) Game.showMessage?.(beat.sub, 340);
    }
    return beat;
  }

  function getWaveNarrative(wave) {
    const branch = session ? getDominantBranch() : 'pragmatist';
    const branchBeat = BRANCH_BEATS[branch]?.[wave];
    if (branchBeat) return branchBeat;
    const framed = typeof LoreData !== 'undefined' ? LoreData.CAMPAIGN_NARRATIVE?.waves?.[wave] : null;
    if (framed) return framed;
    return null;
  }

  function getRecentChoices(limit = 5) {
    return session ? session.choices.slice(-limit) : [];
  }

  function formatChoiceSummary(limit = 3) {
    const recent = getRecentChoices(limit);
    if (!recent.length) return '';
    return recent.map((c) => `${c.label} (W${c.wave})`).join(' · ');
  }

  function getSessionSnapshot() {
    if (!session) return null;
    const branch = getDominantBranch();
    const b = BRANCHES[branch];
    return {
      branch,
      branchLabel: b?.label || branch,
      branchColor: b?.color,
      choiceCount: session.choices.length,
      recentChoices: getRecentChoices(4),
      summary: formatChoiceSummary(3),
    };
  }

  function getLifetimeSummary() {
    const totals = lifetime.branchTotals || {};
    const dominant = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'pragmatist';
    return {
      dominantLifetimeBranch: dominant,
      branchTotals: { ...totals },
      recentArcs: lifetime.arcsCompleted.slice(0, 6),
      choiceLog: lifetime.choiceLog.slice(0, 12),
    };
  }

  function getEncyclopediaEntries() {
    const entries = [];
    const life = getLifetimeSummary();
    const dom = BRANCHES[life.dominantLifetimeBranch] || BRANCHES.pragmatist;

    entries.push({
      cat: 'story',
      name: 'Your Story Arc',
      body: `Lifetime tendency: ${dom.label} (${life.branchTotals[life.dominantLifetimeBranch] || 0} runs). ${dom.desc} Choices during planet events and kingdom doctrines shift the chronicle branch mid-campaign.`,
      storyBranch: dom.id,
    });

    for (const b of Object.values(BRANCHES)) {
      entries.push({
        cat: 'story',
        name: `${b.label} Path`,
        body: b.desc,
        classified: `Recorded when planet responses and doctrines favor this style. Wave 31, 100, 200, and 500 chronicle beats branch based on your dominant path.`,
        classifiedRule: 'wave:31',
        storyBranch: b.id,
      });
    }

    for (const arc of life.recentArcs) {
      const br = BRANCHES[arc.branch] || BRANCHES.pragmatist;
      entries.push({
        cat: 'story',
        name: `${br.label} — W${arc.wave} ${arc.victory ? 'Victory' : 'Defeat'}`,
        body: `${arc.choiceCount} choices recorded. ${RUN_OUTRO[arc.branch]?.[arc.victory ? 'victory' : 'defeat'] || ''}`,
        storyMeta: new Date(arc.at).toLocaleDateString(),
      });
    }

    if (!life.recentArcs.length) {
      entries.push({
        cat: 'story',
        name: 'Branching Chronicles',
        body: 'Finish a campaign run with recorded choices — planet event responses and kingdom doctrines write alternate chronicle beats at waves 31, 100, 200, and 500.',
      });
    }

    return entries;
  }

  function init() {
    load();
  }

  load();

  return {
    init,
    load,
    save,
    BRANCHES,
    BRANCH_BEATS,
    onRunStart,
    onRunEnd,
    recordChoice,
    getDominantBranch,
    getWaveNarrative,
    getSessionSnapshot,
    getLifetimeSummary,
    getEncyclopediaEntries,
    formatChoiceSummary,
    getRecentChoices,
    checkBranchBeat,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.StoryLore = StoryLore;
