/**
 * Story / Lore — the name the men give your way of fighting, from the choices you make,
 * and the lines spoken at the dawns that mark how long the line has stood.
 */
const StoryLore = (() => {
  const STORAGE_KEY = 'myth-and-blood-story-v1';
  const MAX_LIFETIME_CHOICES = 80;

  // Ids are stored in saves and the lifetime log; only the words change.
  const BRANCHES = {
    iron_crown: {
      id: 'iron_crown',
      label: 'The Iron Hand',
      epithet: 'the iron hand',
      desc: 'You answer the north with fire and steel. Nothing is spared, least of all your own.',
      color: '#c04040',
    },
    silver_diplomat: {
      id: 'silver_diplomat',
      label: 'The Shut Gate',
      epithet: 'the shut gate',
      desc: 'You wall, seal and wait. The north may starve before you do.',
      color: '#80a0c0',
    },
    arcane_scholar: {
      id: 'arcane_scholar',
      label: 'The Borrowed Fire',
      epithet: 'the borrowed fire',
      desc: 'You take what the dark offers and count the cost later.',
      color: '#8060e0',
    },
    pragmatist: {
      id: 'pragmatist',
      label: 'The Long Watch',
      epithet: 'the long watch',
      desc: 'No creed. You do what the day asks and bury who it takes.',
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

  /**
   * Beats land where a run actually is: dawns ten, twenty-five, fifty and a hundred.
   * They mark how long the line has stood. Nothing here says the siege is won.
   */
  const BRANCH_BEATS = {
    iron_crown: {
      10: {
        title: 'First Blood Paid',
        hook: 'Ten dawns. You have answered every horn with steel.',
        sub: 'The men have stopped asking for mercy. They have stopped giving it.',
      },
      25: {
        title: 'No Quarter',
        hook: 'The heads on the stakes face north. Your men put them there.',
        sub: 'The enemy has learned your name. It comes anyway.',
      },
      50: {
        title: 'The Red Road',
        hook: 'Fifty dawns, and the field is red to the treeline.',
        sub: 'You have made a slaughter yard and called it a border.',
      },
      100: {
        title: 'Iron and Ash',
        hook: 'A hundred dawns. The Eternal has fallen once. He will come again, and so will you.',
        sub: 'There is no peace to take here. Only the next horn.',
      },
    },
    silver_diplomat: {
      10: {
        title: 'The Gate Holds',
        hook: 'Ten dawns. The gate has not opened once.',
        sub: 'Behind it they count the bread and the arrows. Both run short.',
      },
      25: {
        title: 'Stone and Patience',
        hook: 'The walls are thicker than the ranks behind them.',
        sub: 'Wait, you tell them. The north is hungry too.',
      },
      50: {
        title: 'The Narrow Light',
        hook: 'Fifty dawns behind stone. The children here have never seen the far field.',
        sub: 'What you sealed out still scratches at the seams.',
      },
      100: {
        title: 'Unbroken',
        hook: 'A hundred dawns. The gate is scarred black and still shut.',
        sub: 'Nothing was taken. Nothing was given up. That is the whole of it.',
      },
    },
    arcane_scholar: {
      10: {
        title: 'The First Bargain',
        hook: 'Ten dawns. The storm came when you called it.',
        sub: 'Nobody asks yet what it will want back.',
      },
      25: {
        title: 'Strange Lights',
        hook: 'Lights walk the line at night. The men no longer look at them.',
        sub: 'The relics hum when the dead are counted.',
      },
      50: {
        title: 'The Debt',
        hook: 'Fifty dawns of borrowed fire. The mages have stopped sleeping.',
        sub: 'Something in the north knows the words you use.',
      },
      100: {
        title: 'What Answers',
        hook: 'A hundred dawns. You speak to the dark, and the dark is fluent.',
        sub: 'The line holds. Do not ask what holds it.',
      },
    },
    pragmatist: {
      10: {
        title: 'Ten Dawns',
        hook: 'Ten dawns. Fewer faces at the fire than there were.',
        sub: 'Whatever works, you use. Whoever falls, you bury.',
      },
      25: {
        title: 'The Tally',
        hook: 'The tally sticks are notched through. Someone cuts new ones.',
        sub: 'No banner flies over this line. Only the men on it.',
      },
      50: {
        title: 'Half a Hundred',
        hook: 'Fifty dawns. The oldest soldier here remembers three of them.',
        sub: 'The north has not learned your pattern. You have none.',
      },
      100: {
        title: 'The Hundredth Dawn',
        hook: 'A hundred dawns. The Eternal fell at the line, and the horn sounded again after.',
        sub: 'The siege does not end. You are still here. That is the tally.',
      },
    },
  };

  /** How a run is remembered. `victory` is a run left standing; `defeat` is a line that fell. */
  const RUN_OUTRO = {
    iron_crown: {
      victory: 'You left the field with the stakes still standing.',
      defeat: 'The line broke with its blades still wet. The north walks over what you burned.',
    },
    silver_diplomat: {
      victory: 'The gate was still shut when you set down the horn.',
      defeat: 'The gate opened at last. Not from the inside.',
    },
    arcane_scholar: {
      victory: 'The lights still walk the line. They no longer wait for your word.',
      defeat: 'The fire you borrowed went home. It took the line with it.',
    },
    pragmatist: {
      victory: 'The fire is banked. The watch passes to someone else.',
      defeat: 'The day asked more than there was left to give.',
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
      lifetime.branchTotals = {
        iron_crown: 0,
        silver_diplomat: 0,
        arcane_scholar: 0,
        pragmatist: 0,
      };
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
        title: `How it ended — ${BRANCHES[branch]?.label || branch}`,
        summary: line,
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
        `The men have a name for how you fight: ${BRANCHES[branch]?.label || branch}.`,
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
    // The game speaks the beat itself when it asked for this wave's lines; do not say it twice.
    if (typeof Game !== 'undefined' && session.narratedWave !== wave) {
      Game.showMessage?.(beat.hook, 400);
      if (beat.sub) Game.showMessage?.(beat.sub, 340);
    }
    return beat;
  }

  function getWaveNarrative(wave) {
    const branch = session ? getDominantBranch() : 'pragmatist';
    const branchBeat = BRANCH_BEATS[branch]?.[wave];
    if (session) session.narratedWave = wave;
    if (branchBeat) return branchBeat;
    const framed =
      typeof LoreData !== 'undefined' ? LoreData.CAMPAIGN_NARRATIVE?.waves?.[wave] : null;
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

  /** The player's own record, for the World and lore tab. */
  function getEncyclopediaEntries() {
    const entries = [];
    const life = getLifetimeSummary();
    const dom = BRANCHES[life.dominantLifetimeBranch] || BRANCHES.pragmatist;
    const runs = life.branchTotals[life.dominantLifetimeBranch] || 0;

    entries.push({
      cat: 'story',
      name: 'How you fight',
      body: runs
        ? `Most often: ${dom.label}. ${dom.desc}\n\nThe choices you make when the field offers one decide which of four names the men give you. Each has its own lines at dawns ten, twenty-five, fifty and a hundred.`
        : 'The choices you make when the field offers one decide which of four names the men give you. Each has its own lines at dawns ten, twenty-five, fifty and a hundred. You have no record yet.',
      storyBranch: runs ? dom.id : null,
    });

    for (const b of Object.values(BRANCHES)) {
      entries.push({ cat: 'story', name: b.label, body: b.desc, storyBranch: b.id });
    }

    for (const arc of life.recentArcs) {
      const br = BRANCHES[arc.branch] || BRANCHES.pragmatist;
      const outro = RUN_OUTRO[arc.branch] || RUN_OUTRO.pragmatist;
      entries.push({
        cat: 'story',
        name: `${br.label} — ${arc.victory ? 'stood down at' : 'fell at'} wave ${arc.wave}`,
        body: arc.victory ? outro.victory : outro.defeat,
        storyMeta: new Date(arc.at).toLocaleDateString(),
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
    RUN_OUTRO,
    onRunStart,
    onRunEnd,
    recordChoice,
    getDominantBranch,
    getWaveNarrative,
    getSessionSnapshot,
    getEncyclopediaEntries,
    formatChoiceSummary,
    getRecentChoices,
    checkBranchBeat,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.StoryLore = StoryLore;
