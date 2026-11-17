/**
 * Myth and Blood — game modes, daily/weekly challenges, seeds, leaderboards.
 */
const GameModes = (() => {
  const STORAGE_KEY = 'myth-and-blood-modes-v1';
  const LEADERBOARD_MAX = 25;

  // `rule` is the one line shown on the button: what makes the mode play differently.
  const MODES = [
    {
      id: 'campaign',
      label: 'Campaign',
      rule: 'The whole war: eras, war camps and spoils. No leaderboard.',
      desc: 'Defend a growing realm. The field widens every 10 waves; hold every sector as the host grows. Build, train, survive.',
    },
    {
      id: 'survival',
      label: 'Survival',
      rule: '15% less TP; your run score goes on the leaderboard.',
      desc: 'A lean endless run for the board. Every wave pays 15% less TP, so each soldier counts. Breaches and losses cost score.',
    },
    {
      id: 'roguelike',
      label: 'Roguelike',
      rule: 'Four random modifiers, rolled and locked for the run.',
      desc: 'Each run rolls four advanced modifiers that never clash. You cannot change them once the siege begins.',
    },
    {
      id: 'warband',
      label: 'Warband',
      rule: 'Soldiers cost double but are far tougher.',
      desc: 'Soldiers cost double, and each one is far tougher and hits harder. A small squad where every death hurts.',
    },
    {
      id: 'timed',
      label: 'Timed Blitz',
      rule: 'Night is half as long: less time to build.',
      desc: 'Night preparation lasts half as long. Build fast, then hold.',
    },
    {
      id: 'seed',
      label: 'Seed Run',
      rule: 'Same seed, same waves: race a friend on equal terms.',
      desc: 'Enemy waves, spawn points and field rolls come from the seed, so two players with one seed face the same siege.',
    },
    {
      id: 'academy_era',
      label: 'Academy Era',
      rule: 'Start late, at wave 100, 105 or 200.',
      desc: 'Start at wave 100 to 200 on the grown late-game field, with a Training Ground, hamlets and heavier assaults.',
    },
    {
      id: 'pve_horde',
      label: 'Horde',
      rule: 'Every wave is a horde, 35% larger.',
      desc: 'Every wave is a horde assault, a third larger than usual. Hold the line as long as you can.',
    },
    {
      id: 'async_coop',
      label: 'Co-op by Code',
      rule: 'Share one realm; pass it by copied code. No live link.',
      desc: 'Two players take turns on one realm. Play, hand off from the pause menu, and send the code yourself. Nothing is sent over the internet.',
    },
    {
      id: 'pvp_endless',
      label: 'Duel by Code',
      rule: 'Same seed, best run score wins; swap codes. No live link.',
      desc: 'Both players run the same seed, then swap result codes. The higher run score wins. Cheated runs are marked. Nothing is sent over the internet.',
    },
  ];

  let store = { leaderboards: {}, personalBests: {}, challengeHistory: [] };
  const ACADEMY_START_OPTIONS = [
    {
      wave: 100,
      label: 'Wave 100',
      hint: 'Academy Era opens — advanced academies and settlement economy.',
    },
    {
      wave: 105,
      label: 'Wave 105',
      hint: 'Mid RTS — hamlets, guilds, and academy training online.',
    },
    {
      wave: 200,
      label: 'Wave 200',
      hint: 'Late-war jump — denser northern assaults, academy economy online.',
    },
  ];

  const PATH_PRESETS = [
    { id: '', label: 'Auto / earned' },
    { id: 'martial', label: 'Martial' },
    { id: 'arcane', label: 'Arcane' },
    { id: 'tech', label: 'Tech' },
    { id: 'mythic', label: 'Mythic' },
  ];

  let menu = {
    modeId: 'campaign',
    ironman: false,
    seed: '',
    recommendedStartId: null,
    challengeType: null, // 'daily' | 'weekly' | null
    academyStartWave: 105,
    pathPreset: '',
  };
  let session = null;
  let rng = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store = { ...store, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {
      /* ignore */
    }
  }

  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    // Position in the stream, so a save can carry on where a seeded run left off.
    next.getState = () => a | 0;
    next.setState = (v) => {
      a = v | 0;
    };
    return next;
  }

  function createRng(seed) {
    const n = typeof seed === 'number' ? seed : hashStr(String(seed || 'myth'));
    return mulberry32(n);
  }

  function random() {
    if (rng) return rng();
    return Math.random();
  }

  /** Seeded stream position for saves; null when the run is not seeded. */
  function getRngState() {
    return rng && rng.getState ? rng.getState() : null;
  }

  function setRngState(state) {
    if (!rng || !rng.setState || !Number.isInteger(state)) return false;
    rng.setState(state);
    return true;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function weekKey() {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  function pickFromRng(pool, count, r) {
    const copy = [...pool];
    const out = [];
    while (out.length < count && copy.length) {
      const i = Math.floor(r() * copy.length);
      out.push(copy.splice(i, 1)[0]);
    }
    return out;
  }

  function buildChallenge(id, label, seedStr, opts = {}) {
    const r = createRng(seedStr);
    const allMods =
      typeof AdvancedDifficulty !== 'undefined'
        ? AdvancedDifficulty.getModifiers().map((m) => m.id)
        : [];
    const modCount = opts.modCount ?? 3;
    // Respect conflict groups (same rules as roguelike) so challenges never stack e.g. fog+deep fog.
    const conflicts =
      typeof AdvancedDifficulty !== 'undefined' ? AdvancedDifficulty.getConflictGroups() : [];
    const mods = [];
    const shuffled = pickFromRng(allMods, allMods.length, r);
    for (const id of shuffled) {
      if (mods.length >= modCount) break;
      const group = conflicts.find((g) => g.includes(id));
      if (group && mods.some((p) => group.includes(p))) continue;
      mods.push(id);
    }
    const diffPool = opts.difficulties || ['normal', 'chad', 'doomslayer'];
    const difficulty = diffPool[Math.floor(r() * diffPool.length)];
    const waveGoal = opts.waveGoal ?? 10 + Math.floor(r() * 20);
    const rules = [];
    if (r() > 0.5) rules.push('night_short');
    if (r() > 0.65) rules.push('tp_tight');
    if (r() > 0.7) rules.push('no_reinforce_strike');
    return {
      id,
      label,
      seed: seedStr,
      difficulty,
      mods,
      waveGoal,
      rules,
      bonusScore: opts.bonusScore ?? 0,
    };
  }

  function getDailyChallenge() {
    const key = `daily-${todayKey()}`;
    return buildChallenge(key, `Daily — ${todayKey()}`, key, {
      modCount: 3,
      waveGoal: 15 + (hashStr(key) % 10),
      bonusScore: 500,
    });
  }

  function getWeeklyChallenge() {
    const key = `weekly-${weekKey()}`;
    return buildChallenge(key, `Weekly — ${weekKey()}`, key, {
      modCount: 4,
      difficulties: ['chad', 'doomslayer'],
      waveGoal: 30 + (hashStr(key) % 15),
      bonusScore: 2000,
    });
  }

  function rollRoguelikeMods(seedStr) {
    const r = createRng(seedStr || `rogue-${Date.now()}`);
    const mods =
      typeof AdvancedDifficulty !== 'undefined'
        ? AdvancedDifficulty.getModifiers().map((m) => m.id)
        : [];
    const conflicts =
      typeof AdvancedDifficulty !== 'undefined' ? AdvancedDifficulty.getConflictGroups() : [];
    const picked = [];
    const shuffled = pickFromRng(mods, mods.length, r);
    for (const id of shuffled) {
      if (picked.length >= 4) break;
      const group = conflicts.find((g) => g.includes(id));
      if (group && picked.some((p) => group.includes(p))) continue;
      picked.push(id);
    }
    return picked;
  }

  function resolveSeedString() {
    if (menu.seed?.trim() && (menu.modeId === 'seed' || menu.modeId === 'campaign')) {
      return menu.seed.trim();
    }
    if (menu.challengeType === 'daily') return getDailyChallenge().seed;
    if (menu.challengeType === 'weekly') return getWeeklyChallenge().seed;
    if (session?.seed) return session.seed;
    return null;
  }

  function beginSession(difficultyId) {
    load();
    const challenge =
      menu.challengeType === 'daily'
        ? getDailyChallenge()
        : menu.challengeType === 'weekly'
          ? getWeeklyChallenge()
          : null;

    let modeId = menu.modeId;

    let mods = typeof AdvancedDifficulty !== 'undefined' ? AdvancedDifficulty.getActiveIds() : [];
    let difficulty = difficultyId || 'normal';
    let rules = [];
    let seed = resolveSeedString();
    let waveGoal = null;
    let scoreBonus = 0;

    if (challenge) {
      mods = challenge.mods;
      difficulty = challenge.difficulty;
      rules = challenge.rules;
      seed = challenge.seed;
      waveGoal = challenge.waveGoal;
      scoreBonus = challenge.bonusScore;
      modeId = menu.challengeType === 'daily' ? 'daily' : 'weekly';
    } else if (modeId === 'roguelike') {
      seed = menu.seed?.startsWith('rogue-') ? menu.seed : seed || `rogue-${Date.now()}`;
      menu.seed = seed;
      mods = rollRoguelikeMods(seed);
    } else if (modeId === 'seed' && seed) {
      menu.seed = seed;
    } else if (modeId === 'async_coop' && typeof OnlineMultiplayer !== 'undefined') {
      const room = OnlineMultiplayer.getActiveRoom();
      if (room?.seed) {
        seed = room.seed;
        menu.seed = seed;
      }
      if (!room) OnlineMultiplayer.createCoopRoom({ difficulty: difficultyId || 'normal' });
    } else if (modeId === 'pvp_endless' && typeof OnlineMultiplayer !== 'undefined') {
      let match = OnlineMultiplayer.getActivePvpMatch();
      if (!match)
        match = OnlineMultiplayer.createPvpMatch({ difficulty: difficultyId || 'normal' });
      seed = match.seed;
      menu.seed = seed;
      modeId = 'survival';
    } else if (modeId === 'pve_horde') {
      seed = seed || `horde-${Date.now()}`;
      menu.seed = seed;
    }

    if (typeof AdvancedDifficulty !== 'undefined') {
      AdvancedDifficulty.setActive(mods);
      AdvancedDifficulty.lockForRun(modeId === 'roguelike' || !!challenge);
    }

    rng = seed ? createRng(seed) : null;

    const academyStartWave =
      modeId === 'academy_era'
        ? (ACADEMY_START_OPTIONS.find((o) => o.wave === menu.academyStartWave)?.wave ?? 105)
        : null;

    const ironman =
      !!menu.ironman && !['async_coop', 'pvp_endless', 'pve_horde'].includes(menu.modeId);

    const pathPreset =
      menu.pathPreset && ['martial', 'arcane', 'tech', 'mythic'].includes(menu.pathPreset)
        ? menu.pathPreset
        : null;

    session = {
      modeId,
      ironman,
      seed,
      challengeId: challenge?.id || null,
      challengeLabel: challenge?.label || null,
      mods: [...mods],
      rules: [...rules],
      difficulty,
      waveGoal,
      scoreBonus,
      academyStartWave,
      pathPreset,
      startedAt: Date.now(),
      elapsedMs: 0,
      survivalScore: 0,
      timedNightMult: modeId === 'timed' || rules.includes('night_short') ? 0.5 : 1,
      tpTight: rules.includes('tp_tight') || (!challenge && menu.modeId === 'survival'),
      noReinforceStrike: rules.includes('no_reinforce_strike'),
      forceHorde: menu.modeId === 'pve_horde',
      hordeCountMult: menu.modeId === 'pve_horde' ? 1.35 : 1,
      displayModeId: menu.modeId,
      onlineCoop: modeId === 'async_coop',
      onlinePvp: menu.modeId === 'pvp_endless',
      pvpMatchId:
        menu.modeId === 'pvp_endless' && typeof OnlineMultiplayer !== 'undefined'
          ? OnlineMultiplayer.getActivePvpMatch()?.id
          : null,
    };

    return { difficulty, session };
  }

  function endSession() {
    if (typeof AdvancedDifficulty !== 'undefined') AdvancedDifficulty.unlockForRun();
    session = null;
    rng = null;
  }

  /**
   * Restore a run session from save/quickload (mods, mode rules, seed RNG).
   * Does not re-roll challenge mods — uses the snap as authority.
   */
  function restoreSession(snap) {
    if (!snap || typeof snap !== 'object') return false;
    const modeId = snap.modeId || 'campaign';
    const mods = Array.isArray(snap.mods) ? [...snap.mods] : [];
    if (typeof AdvancedDifficulty !== 'undefined') {
      AdvancedDifficulty.setActive(mods);
      AdvancedDifficulty.lockForRun(
        modeId === 'roguelike' || !!snap.challengeId || !!snap.challengeLabel
      );
    }
    rng = snap.seed ? createRng(snap.seed) : null;
    session = {
      modeId,
      ironman: !!snap.ironman,
      seed: snap.seed || null,
      challengeId: snap.challengeId || null,
      challengeLabel: snap.challengeLabel || null,
      mods,
      rules: Array.isArray(snap.rules) ? [...snap.rules] : [],
      difficulty: snap.difficulty || 'normal',
      waveGoal: snap.waveGoal ?? null,
      scoreBonus: snap.scoreBonus || 0,
      academyStartWave: snap.academyStartWave ?? null,
      pathPreset: snap.pathPreset || null,
      startedAt: snap.startedAt || Date.now(),
      elapsedMs: snap.elapsedMs || 0,
      survivalScore: snap.survivalScore || 0,
      timedNightMult: snap.timedNightMult ?? 1,
      tpTight: !!snap.tpTight || (Array.isArray(snap.rules) && snap.rules.includes('tp_tight')),
      noReinforceStrike:
        !!snap.noReinforceStrike ||
        (Array.isArray(snap.rules) && snap.rules.includes('no_reinforce_strike')),
      forceHorde: !!snap.forceHorde || modeId === 'pve_horde',
      hordeCountMult: snap.hordeCountMult ?? (modeId === 'pve_horde' ? 1.35 : 1),
      displayModeId: snap.displayModeId || modeId,
      onlineCoop: !!snap.onlineCoop,
      onlinePvp: !!snap.onlinePvp,
      pvpMatchId: snap.pvpMatchId || null,
    };
    return true;
  }

  function getSession() {
    return session ? { ...session } : null;
  }

  function isIronman() {
    return !!session?.ironman;
  }

  function canQuickSave() {
    return !isIronman() && session?.modeId !== 'daily' && session?.modeId !== 'weekly';
  }

  function canRestartWave() {
    return !isIronman();
  }

  function getNightPrepMult() {
    return session?.timedNightMult ?? 1;
  }

  function tickElapsed(ms) {
    if (!session) return;
    session.elapsedMs += ms;
  }

  /** Fallback when the siege loop has no score (it voids cheated runs): waves and kills only. */
  function computeScore(wave, kills, difficultyPercent) {
    return Math.floor(wave * difficultyPercent + kills * 2 + (session?.scoreBonus || 0));
  }

  /** The run score from the game-over screen, plus a challenge bonus. */
  function runScore(wave, kills, difficultyPercent) {
    const s = typeof SiegeLoop !== 'undefined' ? SiegeLoop.lastScore?.() : null;
    if (s && Number.isFinite(s.total)) return Math.floor(s.total + (session?.scoreBonus || 0));
    return computeScore(wave, kills, difficultyPercent);
  }

  function isCheatedRun() {
    return typeof Game !== 'undefined' && !!Game.cheatsUsed?.();
  }

  function recordResult(wave, kills, victory, difficultyPercent) {
    if (!session || (session.modeId === 'campaign' && !session.challengeId && !session.onlineCoop))
      return;
    const score = runScore(wave, kills, difficultyPercent);
    const cheated = isCheatedRun();
    if (session.onlinePvp && typeof OnlineMultiplayer !== 'undefined') {
      OnlineMultiplayer.onRunEnded(wave, kills, victory, score, cheated);
    }
    const entry = {
      wave,
      kills,
      score,
      cheated,
      victory: !!victory,
      timeMs: session.elapsedMs,
      difficulty: session.difficulty,
      difficultyPercent,
      modeId: session.modeId,
      challengeId: session.challengeId,
      seed: session.seed,
      ironman: session.ironman,
      at: Date.now(),
    };

    const boardKey =
      session.challengeId ||
      (session.onlinePvp ? 'pvp_endless' : session.displayModeId || session.modeId) ||
      'survival';
    if (!store.leaderboards[boardKey]) store.leaderboards[boardKey] = [];
    store.leaderboards[boardKey].push(entry);
    store.leaderboards[boardKey].sort((a, b) => b.score - a.score || b.wave - a.wave);
    store.leaderboards[boardKey] = store.leaderboards[boardKey].slice(0, LEADERBOARD_MAX);

    const bestKey = `${boardKey}-best`;
    const prev = store.personalBests[bestKey];
    if (!cheated && (!prev || score > prev.score)) store.personalBests[bestKey] = entry;

    store.challengeHistory.unshift({ ...entry, label: session.challengeLabel });
    store.challengeHistory = store.challengeHistory.slice(0, 40);
    save();
    return entry;
  }

  function getLeaderboard(key, limit = 10) {
    return (store.leaderboards[key] || []).slice(0, limit);
  }

  function getPersonalBest(key) {
    return store.personalBests[`${key}-best`] || null;
  }

  function getScalingAdvice(wave, difficultyPercent, difficultyId) {
    const tips = [];
    const pct = difficultyPercent ?? 100;

    if (pct < 75) tips.push('Forgiving pace — invest in builders and wall layout before wave 25.');
    else if (pct < 110)
      tips.push('Balanced scaling — aim for outposts by wave 10 and a General by wave 30.');
    else if (pct < 160)
      tips.push('Harsh scaling — prioritize morale (mess hall, bard) and hunt elites early.');
    else
      tips.push(
        'Extreme scaling — wall hamlets early; crossover barracks and synergies are optional force multipliers.'
      );

    if (wave < 10) tips.push('Waves 1–10: footmen + archers, one med tent.');
    else if (wave < 25)
      tips.push('Waves 10–25: add mage splash, prepare for first territory expansion.');
    else if (wave < 50)
      tips.push('Waves 25–50: multi-front — expect horde waves every 5; bosses every 10.');
    else if (wave < 100)
      tips.push(
        'Waves 50–100: knights, sappers, and academies — hamlets behind walls fund late defense.'
      );
    else if (wave < 200)
      tips.push('Waves 100–200: academy economy — hamlets behind walls, protect guilds.');
    else
      tips.push('Waves 200+: late war. Burn war camps before they dig in and guard your guilds.');

    if (difficultyId === 'doomslayer')
      tips.push('Hellbane base: expect faster spawns — protect academies and barracks.');
    if (session?.ironman)
      tips.push('Ironman: no quick save — scout and rally before committing TP.');

    return tips;
  }

  function getScalingBreakdown(difficultyId) {
    const base = DIFFICULTY_BASE_PERCENT[difficultyId] ?? 100;
    const adv =
      typeof AdvancedDifficulty !== 'undefined'
        ? AdvancedDifficulty.getCombinedMods()
        : { pctDelta: 0 };
    const effective = Math.max(10, Math.round(base + (adv.pctDelta || 0)));
    return {
      base,
      baseLabel: getDifficultyDef?.(difficultyId)?.label || difficultyId,
      modifierDelta: adv.pctDelta || 0,
      effective,
      enemyHp: Math.round(
        (getDifficultyDef?.(difficultyId)?.enemyHpMult || 1) * (adv.enemyHpMult || 1) * 100
      ),
      enemyDmg: Math.round(
        (getDifficultyDef?.(difficultyId)?.enemyDmgMult || 1) * (adv.enemyDmgMult || 1) * 100
      ),
      enemyCount: Math.round(
        (getDifficultyDef?.(difficultyId)?.enemyCountMult || 1) * (adv.enemyCountMult || 1) * 100
      ),
    };
  }

  function exportSeedShare() {
    const s = session || { seed: menu.seed, modeId: menu.modeId };
    if (!s.seed) return null;
    const mods = session?.mods || AdvancedDifficulty?.getActiveIds?.() || [];
    return `MYTH:${s.seed}:${mods.join(',')}`;
  }

  function importSeedShare(code) {
    const m = String(code || '')
      .trim()
      .match(/^MYTH:([^:]+):?(.*)$/i);
    if (!m) return false;
    menu.modeId = 'seed';
    menu.seed = m[1];
    menu.challengeType = null;
    if (m[2] && typeof AdvancedDifficulty !== 'undefined') {
      AdvancedDifficulty.setActive(m[2].split(',').filter(Boolean));
    }
    renderMenuPanel();
    return true;
  }

  function renderMenuPanel() {
    const picker = document.getElementById('game-modes-picker');
    if (!picker) return;

    const daily = getDailyChallenge();
    const weekly = getWeeklyChallenge();
    const dailyBest = getPersonalBest(daily.id);
    const weeklyBest = getPersonalBest(weekly.id);

    const selectedMode = MODES.find((m) => m.id === menu.modeId);
    picker.innerHTML = `
      <div class="modes-header">GAME MODE</div>
      <div class="modes-grid">
        ${MODES.map(
          (m) => `
          <button type="button" class="mode-btn ${menu.modeId === m.id ? 'selected' : ''}"
            data-mode="${m.id}" title="${m.desc}">
            ${m.label}<span class="mode-btn-sub">${m.rule}</span>
          </button>
        `
        ).join('')}
      </div>
      <p id="mode-desc" class="mode-desc">${menu.challengeType ? 'Challenge rules replace the mode for this run.' : selectedMode?.desc || ''}</p>
      <div class="modes-options">
        <label class="mode-check ${menu.ironman ? 'on' : ''}">
          <input type="checkbox" id="mode-ironman" ${menu.ironman ? 'checked' : ''}>
          <span>Ironman — no quick save, no wave restart</span>
        </label>
        <div class="mode-seed-row ${menu.modeId === 'seed' ? '' : 'hidden'}" id="mode-seed-row">
          <input id="mode-seed-input" class="panel-search" type="text" placeholder="Enter seed (e.g. realm-42)" value="${menu.seed}">
          <button type="button" id="mode-seed-share" class="menu-btn small-btn">COPY SHARE CODE</button>
        </div>
        <div class="mode-academy-row ${menu.modeId === 'academy_era' ? '' : 'hidden'}" id="mode-academy-row">
          <span class="mode-academy-label">RTS start wave</span>
          <div class="mode-academy-waves">
            ${ACADEMY_START_OPTIONS.map(
              (o) => `
              <button type="button" class="academy-wave-btn ${menu.academyStartWave === o.wave ? 'selected' : ''}"
                data-academy-wave="${o.wave}" title="${o.hint}">${o.label}</button>
            `
            ).join('')}
          </div>
          <p class="mode-academy-hint">${ACADEMY_START_OPTIONS.find((o) => o.wave === menu.academyStartWave)?.hint || ''}</p>
        </div>
        <div class="mode-path-row ${menu.modeId === 'academy_era' || menu.modeId === 'planet_conquest' ? '' : 'hidden'}" id="mode-path-row">
          <span class="mode-academy-label">Path preset (jump-in)</span>
          <div class="mode-academy-waves">
            ${PATH_PRESETS.map(
              (p) => `
              <button type="button" class="academy-wave-btn ${menu.pathPreset === p.id ? 'selected' : ''}"
                data-path-preset="${p.id}" title="Seed eternal/path systems for jump-in modes">${p.label}</button>
            `
            ).join('')}
          </div>
          <p class="mode-academy-hint">Optional — Martial / Arcane / Tech / Mythic seed endgame path bonuses.</p>
        </div>
      </div>
      <div class="challenge-cards">
        <div class="challenge-card ${menu.challengeType === 'daily' ? 'active' : ''}" data-challenge="daily">
          <div class="challenge-title">${daily.label}</div>
          <div class="challenge-rules">${getDifficultyDef?.(daily.difficulty)?.label || daily.difficulty} · ${daily.mods.length} modifiers · Goal: wave ${daily.waveGoal}</div>
          <div class="challenge-best">${dailyBest ? `Your best: wave ${dailyBest.wave} (score ${dailyBest.score})` : 'No entry yet'}</div>
        </div>
        <div class="challenge-card ${menu.challengeType === 'weekly' ? 'active' : ''}" data-challenge="weekly">
          <div class="challenge-title">${weekly.label}</div>
          <div class="challenge-rules">${getDifficultyDef?.(weekly.difficulty)?.label || weekly.difficulty} · ${weekly.mods.length} modifiers · Goal: wave ${weekly.waveGoal}</div>
          <div class="challenge-best">${weeklyBest ? `Your best: wave ${weeklyBest.wave} (score ${weeklyBest.score})` : 'No entry yet'}</div>
        </div>
      </div>
      <p class="modes-hint">Daily and weekly runs use the same rules and seed for everyone. A MYTH: share code replays someone's Seed Run.</p>
      <div id="modes-leaderboard" class="modes-leaderboard"></div>
    `;

    picker.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        menu.modeId = btn.dataset.mode;
        menu.challengeType = null;
        renderMenuPanel();
        AudioEngine?.SFX?.click?.();
      });
    });

    picker.querySelectorAll('.challenge-card').forEach((card) => {
      card.addEventListener('click', () => {
        const t = card.dataset.challenge;
        menu.challengeType = menu.challengeType === t ? null : t;
        if (menu.challengeType) {
          menu.modeId = 'campaign';
          menu.ironman = true;
        }
        renderMenuPanel();
        AudioEngine?.SFX?.click?.();
      });
    });

    document.getElementById('mode-ironman')?.addEventListener('change', (e) => {
      menu.ironman = e.target.checked;
      renderMenuPanel();
    });

    document.getElementById('mode-seed-input')?.addEventListener('input', (e) => {
      menu.seed = e.target.value;
    });

    document.getElementById('mode-seed-share')?.addEventListener('click', () => {
      const code = exportSeedShare() || (menu.seed ? `MYTH:${menu.seed}:` : null);
      if (code && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code);
        AudioEngine?.SFX?.click?.();
      }
    });

    picker.querySelectorAll('[data-academy-wave]').forEach((btn) => {
      btn.addEventListener('click', () => {
        menu.academyStartWave = Number(btn.dataset.academyWave) || 105;
        renderMenuPanel();
        AudioEngine?.SFX?.click?.();
      });
    });

    picker.querySelectorAll('[data-path-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        menu.pathPreset = btn.dataset.pathPreset || '';
        renderMenuPanel();
        AudioEngine?.SFX?.click?.();
      });
    });

    renderLeaderboardSnippet();
    if (typeof Onboarding !== 'undefined') Onboarding.renderPanel();
    if (typeof OnlineMultiplayer !== 'undefined') OnlineMultiplayer.renderMenuPanel();
  }

  function renderLeaderboardSnippet() {
    const el = document.getElementById('modes-leaderboard');
    if (!el) return;
    const key =
      menu.challengeType === 'daily'
        ? getDailyChallenge().id
        : menu.challengeType === 'weekly'
          ? getWeeklyChallenge().id
          : menu.modeId === 'survival'
            ? 'survival'
            : menu.modeId === 'academy_era'
              ? 'academy_era'
              : menu.modeId === 'planet_conquest'
                ? 'planet_conquest'
                : menu.modeId === 'pve_horde'
                  ? 'pve_horde'
                  : menu.modeId === 'pvp_endless'
                    ? 'pvp_endless'
                    : menu.modeId === 'async_coop'
                      ? 'async_coop'
                      : null;
    if (!key) {
      el.innerHTML = '';
      return;
    }
    const rows = getLeaderboard(key, 5);
    el.innerHTML = rows.length
      ? `<div class="lb-title">Leaderboard — ${key}</div><ol class="lb-list">${rows
          .map(
            (r) =>
              `<li${r.cheated ? ' class="lb-cheated"' : ''}>W${r.wave} · score ${r.score} · ${Math.round(r.timeMs / 1000)}s${r.cheated ? ' · cheats used' : ''}</li>`
          )
          .join('')}</ol>`
      : '<div class="lb-title">Leaderboard empty — be the first entry!</div>';
  }

  function renderScalingPanel(baseDiffId) {
    const el = document.getElementById('scaling-breakdown');
    if (!el || typeof AdvancedDifficulty === 'undefined') return;
    const b = getScalingBreakdown(baseDiffId);
    const advice = getScalingAdvice(0, b.effective, baseDiffId);
    el.innerHTML = `
      <div class="scale-row"><span>Base</span><strong>${b.baseLabel} (${b.base}%)</strong></div>
      <div class="scale-row"><span>Modifiers</span><strong>${b.modifierDelta >= 0 ? '+' : ''}${b.modifierDelta}%</strong></div>
      <div class="scale-row highlight"><span>Effective</span><strong>${b.effective}%</strong></div>
      <div class="scale-row"><span>Enemy HP×</span><strong>${(b.enemyHp / 100).toFixed(2)}</strong></div>
      <div class="scale-row"><span>Enemy DMG×</span><strong>${(b.enemyDmg / 100).toFixed(2)}</strong></div>
      <div class="scale-row"><span>Spawn count×</span><strong>${(b.enemyCount / 100).toFixed(2)}</strong></div>
      <ul class="scale-tips">${advice.map((t) => `<li>${t}</li>`).join('')}</ul>
    `;
  }

  function init() {
    load();
    if (typeof OnlineMultiplayer !== 'undefined') OnlineMultiplayer.init();
    renderMenuPanel();
    document.getElementById('mode-import-seed')?.addEventListener('click', () => {
      const inp = document.getElementById('mode-import-input');
      if (inp?.value && importSeedShare(inp.value)) {
        inp.value = '';
        AudioEngine?.SFX?.click?.();
      }
    });
  }

  function setMenuMode(id) {
    if (MODES.some((m) => m.id === id && !m.future)) menu.modeId = id;
  }

  function getMenu() {
    return { ...menu };
  }

  function setMenuSeed(seed, recommendedStartId = null) {
    menu.seed = String(seed || '').trim();
    menu.recommendedStartId = recommendedStartId || null;
    if (!menu.seed) menu.recommendedStartId = null;
  }

  return {
    MODES,
    load,
    save,
    init,
    renderMenuPanel,
    renderScalingPanel,
    beginSession,
    endSession,
    restoreSession,
    getSession,
    canQuickSave,
    canRestartWave,
    getNightPrepMult,
    tickElapsed,
    recordResult,
    getScalingAdvice,
    random,
    getRngState,
    setRngState,
    createRng,
    setMenuMode,
    getMenu,
    setMenuSeed,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.GameModes = GameModes;
// Every simulation roll goes through this, so Seed Run, daily and weekly replay the same siege.
// Looks and ids keep Math.random so drawing never moves the seeded stream.
globalThis.simRandom = GameModes.random;
