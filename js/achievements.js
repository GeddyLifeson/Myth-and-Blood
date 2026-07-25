/**
 * Myth and Blood — 1,450 achievements with tiered progression & lifetime tracking.
 */
const Achievements = (() => {
  const STORAGE_KEY = 'myth-and-blood-achievements-v3';
  const LIST = ACHIEVEMENT_LIST;
  const META_316_ID = ACHIEVEMENT_META_316_ID;
  const CLUB_316_ID = ACHIEVEMENT_CLUB_316_ID;
  const MILLENNIUM_ID = ACHIEVEMENT_MILLENNIUM_ID;
  const TARGET = ACHIEVEMENT_TARGET;

  let unlocked = new Set();
  let recentUnlocked = [];
  let lifetimeSpy = new Set();
  let lifetimeCourier = new Set();
  let lifetimeEnemyKills = {};
  let lifetimeKills = 0;
  let lifetimeWavesCleared = 0;
  let lifetimeTrueVictories = 0;
  let crossoverKills = {};
  let crossoverAbilities = {};
  let crossoverMastery = {};
  let doomLifetimeKills = 0;
  let doomAliveWaves = 0;
  let doomMaxAliveWaves = 0;
  let hiddenMilestones = 0;
  let toastQueue = [];
  let toastActive = null;
  let activeCat = 'all';
  let activeCrossover = 'wwe';
  let searchQuery = '';
  let tierFilter = 'all';
  let unlockedOnly = false;

  let session = {
    kills: 0,
    elitesKilled: 0,
    vetUpgrades: 0,
    maxWave: 0,
    deployedTypes: new Set(),
    abilitiesUsed: new Set(),
    buildingsCompleted: new Set(),
    enemyFirst: new Set(),
    flags: new Set(),
    currentDiff: 'normal',
    currentMisses: 0,
    doomKills: 0,
    spyThisWave: 0,
    academyTypes: new Set(),
    crossoverFieldMax: {},
    crossoverFieldNow: {},
    garrisonCount: 0,
    advancedMods: 0,
    maxCrossoverFactions: 0,
    maxSynergyCount: 0,
    zombieBuildingLosses: 0,
    footmanGeneralPipeline: new Set(),
    footmanGeneralPromotions: 0,
    enemyStructuresRazed: 0,
    moraleSamplesTotal: 0,
    moraleSamplesHigh: 0,
    meleeSamplesTotal: 0,
    meleeSamplesFocused: 0,
    crossoverHeroRecruits: new Set(),
    standAllianceSamplesTotal: 0,
    standAllianceSamplesAllied: 0,
    standAllianceMultiFactionSamples: 0,
    planetBossKiRatio: 0,
    showmanshipSamplesTotal: 0,
    showmanshipSamplesHeavy: 0,
    showmanshipAbilityUses: 0,
    namedBossWavesRepelled: 0,
    pathImmortals: new Set(),
  };

  const CROSSOVER_TABS = CROSSOVER_ACH_FACTIONS.map((f) => ({
    id: f.key,
    label: f.label,
    cat: f.cat,
  }));

  const CATS = [
    { id: 'all', label: 'All' },
    { id: 'vanilla', label: 'Vanilla/Core', cats: ['vanilla'] },
    { id: 'waves', label: 'Waves/Eras', cats: ['waves'] },
    { id: 'combat', label: 'Combat/Kills', cats: ['combat'] },
    { id: 'army', label: 'Army/Deploy', cats: ['army'] },
    { id: 'build', label: 'Build/Settle', cats: ['build'] },
    { id: 'specialists', label: 'Specialists', cats: ['specialists'] },
    { id: 'difficulty', label: 'Difficulty', cats: ['difficulty'] },
    { id: 'tactics', label: 'Tactics/Spy', cats: ['tactics'] },
    { id: 'economy', label: 'Economy/TP', cats: ['economy'] },
    { id: 'crossovers', label: 'Evolved Allies', crossover: true },
    { id: 'secrets', label: 'Secrets/Meta', cats: ['secrets', 'meta'] },
  ];

  const VANILLA_CATS = new Set([
    'waves',
    'combat',
    'army',
    'build',
    'specialists',
    'difficulty',
    'tactics',
    'economy',
    'vanilla',
  ]);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        migrateFromV2();
        return;
      }
      const data = JSON.parse(raw);
      unlocked = new Set(data.unlocked || []);
      recentUnlocked = data.recentUnlocked || [];
      lifetimeSpy = new Set(data.lifetimeSpy || []);
      lifetimeCourier = new Set(data.lifetimeCourier || []);
      lifetimeEnemyKills = data.lifetimeEnemyKills || {};
      lifetimeKills = data.lifetimeKills || 0;
      lifetimeWavesCleared = data.lifetimeWavesCleared || 0;
      lifetimeTrueVictories = data.lifetimeTrueVictories || 0;
      crossoverKills = data.crossoverKills || {};
      crossoverAbilities = data.crossoverAbilities || {};
      crossoverMastery = data.crossoverMastery || {};
      doomLifetimeKills = data.doomLifetimeKills || 0;
      doomMaxAliveWaves = data.doomMaxAliveWaves || 0;
      hiddenMilestones = data.hiddenMilestones || 0;
    } catch (_) {
      /* ignore */
    }
  }

  function migrateFromV2() {
    try {
      const raw = localStorage.getItem('myth-and-blood-achievements-v2');
      if (!raw) return;
      const data = JSON.parse(raw);
      unlocked = new Set(data.unlocked || []);
      lifetimeSpy = new Set(data.lifetimeSpy || []);
      lifetimeEnemyKills = data.lifetimeEnemyKills || {};
      save();
    } catch (_) {
      /* ignore */
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          unlocked: [...unlocked],
          recentUnlocked: recentUnlocked.slice(0, 12),
          lifetimeSpy: [...lifetimeSpy],
          lifetimeCourier: [...lifetimeCourier],
          lifetimeEnemyKills,
          lifetimeKills,
          lifetimeWavesCleared,
          lifetimeTrueVictories,
          crossoverKills,
          crossoverAbilities,
          crossoverMastery,
          doomLifetimeKills,
          doomMaxAliveWaves,
          hiddenMilestones,
        })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function unlockedCountExcludingMeta() {
    return [...unlocked].filter((id) => {
      const a = LIST.find((x) => x.id === id);
      return a && !a.meta;
    }).length;
  }

  function effectiveUnlockCount() {
    return unlocked.size;
  }

  function addMastery(faction, pts) {
    crossoverMastery[faction] = (crossoverMastery[faction] || 0) + pts;
    hiddenMilestones = Math.floor(Object.values(crossoverMastery).reduce((s, v) => s + v, 0) / 500);
    save();
  }

  function getUnitFaction(unitType) {
    if (typeof isWweUnit === 'function' && isWweUnit(unitType)) return 'wwe';
    if (unitType === 'doomslayer_hero') return 'doom';
    const def = typeof getCrossoverDef === 'function' ? getCrossoverDef(unitType) : null;
    return def?.faction || null;
  }

  function applyReward(ach) {
    if (!ach?.reward) return;
    const r = ach.reward;
    if (r.type === 'tp' && typeof Game !== 'undefined' && Game.isPlaying?.()) {
      Game.creativeAddTp?.(r.amount) ||
        (Game.getState &&
          (() => {
            const gs = Game.getState();
            if (gs?.creativeMode) Game.creativeAddTp(r.amount);
          })());
    }
    if (r.type === 'unlock' && r.id === 'wwe_academy') MetaProgress.unlockWweAcademy();
    if (r.type === 'creative_buff' && typeof Game !== 'undefined' && Game.isCreativeMode?.()) {
      Game.creativeMaxMorale?.();
    }
  }

  function pushRecent(ach) {
    recentUnlocked = [
      { id: ach.id, name: ach.name, tier: ach.tier, at: Date.now() },
      ...recentUnlocked.filter((r) => r.id !== ach.id),
    ].slice(0, 12);
  }

  function unlock(id) {
    if (unlocked.has(id)) return null;
    const ach = LIST.find((a) => a.id === id);
    if (!ach) return null;
    unlocked.add(id);
    pushRecent(ach);
    save();
    applyReward(ach);
    queueToast(ach);
    checkMilestones();
    if (id === META_316_ID) {
      MetaProgress.unlockWweAcademy();
      tryUnlock('wwe_unlock');
    }
    return ach;
  }

  function tryUnlock(id) {
    return unlock(id);
  }

  function checkMilestones() {
    const count = effectiveUnlockCount();
    const preMeta = [...unlocked].filter(
      (i) => i !== META_316_ID && i !== CLUB_316_ID && i !== MILLENNIUM_ID
    ).length;
    if (preMeta >= 316) {
      tryUnlock(CLUB_316_ID);
      tryUnlock(META_316_ID);
    }
    const nonMillennium = LIST.filter((a) => a.id !== MILLENNIUM_ID);
    if (nonMillennium.every((a) => unlocked.has(a.id))) tryUnlock(MILLENNIUM_ID);
  }

  function queueToast(ach) {
    toastQueue.push(ach);
    if (!toastActive) showNextToast();
  }

  function tierLabel(tier, ach) {
    if (ach?.meta) return 'Meta';
    if (!tier) return '';
    return ACHIEVEMENT_TIERS[tier] || tier;
  }

  function tierBadge(ach) {
    if (ach?.meta) return { cls: 'meta', label: 'Meta' };
    if (!ach?.tier) return null;
    return { cls: ach.tier, label: tierLabel(ach.tier) };
  }

  function showNextToast() {
    if (!toastQueue.length) {
      toastActive = null;
      return;
    }
    toastActive = toastQueue.shift();
    const el = document.getElementById('achievement-toast');
    if (!el) {
      toastActive = null;
      return;
    }
    const labelEl = el.querySelector('.ach-toast-label');
    const nameEl = el.querySelector('.ach-toast-name');
    const descEl = el.querySelector('.ach-toast-desc');
    const tierEl = el.querySelector('.ach-toast-tier');
    const rewardEl = el.querySelector('.ach-toast-reward');
    const progEl = el.querySelector('.ach-toast-progress');
    if (!nameEl || !descEl) {
      toastActive = null;
      return;
    }
    const c = getCount();
    if (labelEl) labelEl.textContent = 'ACHIEVEMENT UNLOCKED';
    nameEl.textContent = toastActive.name;
    descEl.textContent = toastActive.desc;
    if (tierEl) {
      const badge = tierBadge(toastActive);
      tierEl.textContent = badge?.label || '';
      tierEl.className = 'ach-toast-tier' + (badge ? ` tier-${badge.cls}` : '');
      tierEl.style.display = badge ? '' : 'none';
    }
    if (rewardEl) {
      const rw = toastActive.reward;
      rewardEl.textContent =
        rw?.type === 'tp'
          ? `Reward: +${rw.amount} TP (Creative)`
          : rw?.type === 'badge'
            ? 'Iron Creed badge earned!'
            : '';
      rewardEl.style.display = rewardEl.textContent ? '' : 'none';
    }
    if (progEl) progEl.textContent = `${c.unlocked} / ${c.total}`;
    el.classList.add('show');
    if (toastActive.meta || toastActive.tier === 'meta') el.classList.add('toast-meta');
    else if (toastActive.tier === 'gold') el.classList.add('toast-gold');
    else el.classList.remove('toast-gold');
    setTimeout(() => {
      el.classList.remove('show', 'toast-gold');
      setTimeout(showNextToast, 400);
    }, 3400);
  }

  function resetSession() {
    session = {
      kills: 0,
      elitesKilled: 0,
      vetUpgrades: 0,
      maxWave: 0,
      deployedTypes: new Set(),
      abilitiesUsed: new Set(),
      buildingsCompleted: new Set(),
      enemyFirst: new Set(),
      flags: new Set(),
      currentDiff: 'normal',
      currentMisses: 0,
      doomKills: 0,
      spyThisWave: 0,
      academyTypes: new Set(),
      crossoverFieldMax: {},
      crossoverFieldNow: {},
      garrisonCount: 0,
      advancedMods: 0,
      maxCrossoverFactions: 0,
      maxSynergyCount: 0,
      zombieBuildingLosses: 0,
      footmanGeneralPipeline: new Set(),
      footmanGeneralPromotions: 0,
      enemyStructuresRazed: 0,
      moraleSamplesTotal: 0,
      moraleSamplesHigh: 0,
      meleeSamplesTotal: 0,
      meleeSamplesFocused: 0,
      crossoverHeroRecruits: new Set(),
      standAllianceSamplesTotal: 0,
      standAllianceSamplesAllied: 0,
      standAllianceMultiFactionSamples: 0,
      planetBossKiRatio: 0,
      showmanshipSamplesTotal: 0,
      showmanshipSamplesHeavy: 0,
      showmanshipAbilityUses: 0,
      namedBossWavesRepelled: 0,
      pathImmortals: new Set(),
    };
    doomAliveWaves = 0;
  }

  function isChadPlusDiff(diff) {
    return diff === 'chad' || diff === 'doomslayer';
  }

  function countCrossoverField(units) {
    const counts = {};
    const factions = new Set();
    for (const u of units || []) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      const f = getUnitFaction(u.type);
      if (!f) continue;
      counts[f] = (counts[f] || 0) + 1;
      factions.add(f);
    }
    session.crossoverFieldNow = counts;
    for (const [f, n] of Object.entries(counts)) {
      session.crossoverFieldMax[f] = Math.max(session.crossoverFieldMax[f] || 0, n);
    }
    return { counts, factionCount: factions.size, factions: [...factions] };
  }

  function evaluateRule(rule, ctx = {}) {
    if (!rule) return false;
    const [kind, ...rest] = rule.split(':');

    switch (kind) {
      case 'wave':
        return (ctx.wave ?? session.maxWave) >= parseInt(rest[0], 10);
      case 'lifetime_waves':
        return lifetimeWavesCleared >= parseInt(rest[0], 10);
      case 'lifetime_kills':
        return lifetimeKills >= parseInt(rest[0], 10);
      case 'lifetime_enemy_kills':
        return (lifetimeEnemyKills[rest[0]] || 0) >= parseInt(rest[1], 10);
      case 'session_kills':
        return session.kills >= parseInt(rest[0], 10);
      case 'session_elites':
        return session.elitesKilled >= parseInt(rest[0], 10);
      case 'session_army':
        return (ctx.armySize ?? 0) >= parseInt(rest[0], 10);
      case 'session_vet':
        return session.vetUpgrades >= parseInt(rest[0], 10);
      case 'session_deploy_all': {
        const all = [
          'footman',
          'archer',
          'mage',
          'cavalry',
          'healer',
          'knight',
          'sapper',
          'builder',
          'courier',
          'general',
        ];
        return all.every((t) => session.deployedTypes.has(t));
      }
      case 'session_deploy_8':
        return session.deployedTypes.size >= 8;
      case 'enemy_first':
        return session.enemyFirst.has(rest[0]);
      case 'star':
        return session.flags.has(`star_${rest[0]}`);
      case 'honor':
        return session.flags.has('honor');
      case 'honor_max':
        return session.flags.has('honor_max');
      case 'general_stationed':
        return session.flags.has('general_stationed');
      case 'garrison':
        return session.flags.has('garrison');
      case 'garrison_count':
        return (ctx.garrisonCount ?? session.garrisonCount) >= parseInt(rest[0], 10);
      case 'courier':
        return rest[0] ? session.flags.has(`courier_${rest[0]}`) : session.flags.has('courier');
      case 'courier_all':
        return lifetimeCourier.size >= parseInt(rest[0], 10);
      case 'hunt_wave':
        return session.flags.has('hunt_wave');
      case 'last_stand':
        return session.flags.has('last_stand');
      case 'build':
        return rest[0] === 'any'
          ? session.buildingsCompleted.size > 0
          : session.buildingsCompleted.has(rest[0]);
      case 'walls':
        return (ctx.wallCount ?? 0) >= parseInt(rest[0], 10);
      case 'hamlets':
        return (ctx.hamletCount ?? 0) >= parseInt(rest[0], 10);
      case 'guilds':
        return (ctx.guildCount ?? 0) >= parseInt(rest[0], 10);
      case 'academies':
        return (ctx.academyCount ?? session.academyTypes.size) >= parseInt(rest[0], 10);
      case 'academy_types':
        return session.academyTypes.size >= parseInt(rest[0], 10);
      case 'settlement_chain':
        return (
          (ctx.hamletCount ?? 0) >= parseInt(rest[0], 10) &&
          (ctx.guildCount ?? 0) >= parseInt(rest[1], 10)
        );
      case 'support_pair':
        return (
          session.buildingsCompleted.has('medical_tent') &&
          session.buildingsCompleted.has('mess_hall')
        );
      case 'ability':
        return session.abilitiesUsed.has(rest[0]);
      case 'abilities_all':
        return session.abilitiesUsed.size >= parseInt(rest[0], 10);
      case 'spy':
        return session.flags.has('spy');
      case 'spy_all':
        return lifetimeSpy.size >= parseInt(rest[0], 10);
      case 'spy_wave':
        return session.spyThisWave >= parseInt(rest[0], 10);
      case 'siege_clear':
        return session.flags.has('siege_clear');
      case 'horde_clear':
        return session.flags.has('horde_clear');
      case 'boss_clear':
        return session.flags.has('boss_clear');
      case 'boss_flawless':
        return session.flags.has('boss_clear') && session.currentMisses === 0;
      case 'flawless':
        return session.maxWave >= parseInt(rest[0], 10) && session.currentMisses === 0;
      case 'mage_splash':
        return session.flags.has('mage_splash');
      case 'cavalry_charge':
        return session.flags.has('cavalry_charge');
      case 'sapper_siege':
        return session.flags.has('sapper_siege');
      case 'tp':
        return (ctx.tactical ?? 0) >= parseInt(rest[0], 10);
      case 'settle_tp':
        return (ctx.settlementTp ?? 0) >= parseInt(rest[0], 10);
      case 'builders':
        return (ctx.liveBuilders ?? 0) >= parseInt(rest[0], 10);
      case 'diff_wave':
        return session.currentDiff === rest[0] && session.maxWave >= parseInt(rest[1], 10);
      case 'diff_flawless':
        return (
          session.currentDiff === rest[0] &&
          session.maxWave >= parseInt(rest[1], 10) &&
          session.currentMisses === 0
        );
      case 'diff_zombie_fortress':
        return (
          session.currentDiff === rest[0] &&
          session.maxWave >= parseInt(rest[1], 10) &&
          !session.flags.has('zombie_building_lost')
        );
      case 'run_sanctum_victory':
        return (
          session.flags.has('run_victory') &&
          session.flags.has('has_castle_compound') &&
          !session.flags.has('castle_compound_breached')
        );
      case 'sanctum_intact':
        return (
          session.maxWave >= parseInt(rest[0], 10) &&
          session.flags.has('has_castle_compound') &&
          !session.flags.has('castle_compound_breached')
        );
      case 'run_spartan_command':
        return (
          session.flags.has('run_victory') &&
          session.flags.has('had_general') &&
          !session.flags.has('general_fell') &&
          session.flags.has('footman_promoted_general') &&
          session.footmanGeneralPipeline.size >= parseInt(rest[0] || '5', 10)
        );
      case 'footman_command_pipeline':
        return session.footmanGeneralPipeline.size >= parseInt(rest[0], 10);
      case 'run_siege_victory':
        return (
          session.flags.has('run_victory') &&
          session.enemyStructuresRazed >= parseInt(rest[0] || '12', 10)
        );
      case 'enemy_structures_razed':
        return session.enemyStructuresRazed >= parseInt(rest[0], 10);
      case 'run_fellowship_morale': {
        const minSamples = parseInt(rest[0] || '8', 10);
        const needRatio = parseFloat(rest[1] || '0.55');
        if (!session.flags.has('run_victory') || session.moraleSamplesTotal < minSamples) return false;
        return session.moraleSamplesHigh / session.moraleSamplesTotal >= needRatio;
      }
      case 'morale_high_waves':
        return session.moraleSamplesHigh >= parseInt(rest[0], 10);
      case 'run_martial_melee': {
        const minSamples = parseInt(rest[0] || '8', 10);
        const needRatio = parseFloat(rest[1] || '0.55');
        if (!session.flags.has('run_victory') || !isChadPlusDiff(session.currentDiff)) return false;
        if (session.meleeSamplesTotal < minSamples) return false;
        return session.meleeSamplesFocused / session.meleeSamplesTotal >= needRatio;
      }
      case 'melee_focus_waves':
        return session.meleeSamplesFocused >= parseInt(rest[0], 10);
      case 'run_stand_alliance': {
        const minSamples = parseInt(rest[0] || '8', 10);
        const needRatio = parseFloat(rest[1] || '0.55');
        const minRecruits = parseInt(rest[2] || '3', 10);
        if (!session.flags.has('run_victory') || session.crossoverHeroRecruits.size < minRecruits)
          return false;
        if (session.standAllianceSamplesTotal < minSamples) return false;
        return session.standAllianceSamplesAllied / session.standAllianceSamplesTotal >= needRatio;
      }
      case 'stand_alliance_waves':
        return session.standAllianceSamplesAllied >= parseInt(rest[0], 10);
      case 'stand_multi_faction_waves':
        return session.standAllianceMultiFactionSamples >= parseInt(rest[0], 10);
      case 'solo_hero_named_boss':
        return session.flags.has('solo_hero_named_boss');
      case 'run_hokuto_solo':
        return (
          session.flags.has('run_victory') && session.flags.has('solo_hero_named_boss')
        );
      case 'planet_boss_high_ki':
        return session.flags.has('planet_boss_high_ki');
      case 'run_dragonball_ki': {
        const minWave = parseInt(rest[0] || '200', 10);
        const needRatio = parseFloat(rest[1] || '0.55');
        if (!session.flags.has('run_victory') || !session.flags.has('planet_boss_high_ki'))
          return false;
        if (session.maxWave < minWave) return false;
        return (session.planetBossKiRatio ?? 1) >= needRatio;
      }
      case 'run_wwe_showmanship': {
        const minSamples = parseInt(rest[0] || '8', 10);
        const needRatio = parseFloat(rest[1] || '0.55');
        if (!session.flags.has('run_victory')) return false;
        if (session.showmanshipSamplesTotal < minSamples) return false;
        return session.showmanshipSamplesHeavy / session.showmanshipSamplesTotal >= needRatio;
      }
      case 'showmanship_heavy_waves':
        return session.showmanshipSamplesHeavy >= parseInt(rest[0], 10);
      case 'showmanship_ability_uses':
        return session.showmanshipAbilityUses >= parseInt(rest[0], 10);
      case 'run_eternal_crusade': {
        const minBossRepels = parseInt(rest[0] || '3', 10);
        const minForts = parseInt(rest[1] || '8', 10);
        if (!session.flags.has('run_victory') || !isChadPlusDiff(session.currentDiff)) return false;
        if (!session.flags.has('fort_line_established') || session.flags.has('fort_line_breached'))
          return false;
        if (session.flags.has('general_fell') || !session.flags.has('had_general')) return false;
        return (session.namedBossWavesRepelled || 0) >= minBossRepels;
      }
      case 'fort_line_intact':
        return (
          session.flags.has('fort_line_established') && !session.flags.has('fort_line_breached')
        );
      case 'named_boss_repels':
        return (session.namedBossWavesRepelled || 0) >= parseInt(rest[0], 10);
      case 'run_dragonborn_legacy': {
        const minWave = parseInt(rest[0] || '100', 10);
        if (!session.flags.has('run_victory') || session.maxWave < minWave) return false;
        if (!session.flags.has('dragon_boss_slay')) return false;
        return (
          session.pathImmortals.has('martial') &&
          session.pathImmortals.has('arcane') &&
          session.pathImmortals.has('tech') &&
          session.pathImmortals.has('mythic')
        );
      }
      case 'path_immortal_all':
        return (
          session.pathImmortals.has('martial') &&
          session.pathImmortals.has('arcane') &&
          session.pathImmortals.has('tech') &&
          session.pathImmortals.has('mythic')
        );
      case 'dragon_boss_slay':
        return session.flags.has('dragon_boss_slay');
      case 'advanced_mods':
        return (ctx.advancedMods ?? session.advancedMods) >= parseInt(rest[0], 10);
      case 'era':
        if (rest[0] === 'academy') return session.maxWave >= 100;
        if (rest[0] === 'rts') return session.maxWave >= 100 && (ctx.hamletCount ?? 0) >= 1;
        if (rest[0] === 'enemy_rts') return session.maxWave >= 200;
        if (rest[0] === 'hellscape') return session.maxWave >= 1001;
        return false;
      case 'roster_synergy':
        return session.flags.has('roster_synergy');
      case 'wwe':
        return MetaProgress.getWweRecruited().includes(rest[0]);
      case 'wwe_all':
        return Object.keys(WweDefs).every((id) => MetaProgress.getWweRecruited().includes(id));
      case 'cheat':
        if (rest[0] === 'any') return MetaProgress.getCheatsUsed().length > 0;
        if (rest[0] === 'austin') return MetaProgress.getCheatsUsed().includes('austin');
        if (rest[0] === 'one_piece') return MetaProgress.getCheatsUsed().includes('onepiece');
        return false;
      case 'unlock':
        if (rest[0] === 'wwe') return MetaProgress.isWweUnlocked();
        if (rest[0] === 'doom_hero') return MetaProgress.isDoomslayerHeroUnlocked();
        if (rest[0] === 'ultimis' || rest[0] === '115') return MetaProgress.is115Unlocked();
        if (rest[0] === 'primis' || rest[0] === 'primus') return MetaProgress.isPrimusUnlocked();
        if (rest[0] === 'halo') return MetaProgress.isHaloUnlocked();
        if (rest[0] === 'gears') return MetaProgress.isGearsUnlocked();
        if (rest[0] === 'lotr') return MetaProgress.isLotrUnlocked();
        if (rest[0] === 'baki') return MetaProgress.isBakiUnlocked();
        if (rest[0] === 'jojo') return MetaProgress.isJojoUnlocked();
        if (rest[0] === 'fotns') return MetaProgress.isFotnsUnlocked();
        if (rest[0] === 'dragonball') return MetaProgress.isDragonballUnlocked();
        if (rest[0] === 'warhammer') return MetaProgress.isWarhammerUnlocked();
        if (rest[0] === 'tes') return MetaProgress.isTesUnlocked();
        return false;
      case 'deploy':
        return session.flags.has(`deploy_${rest[0]}`);
      case 'spec_rank':
        return session.flags.has(`rank_${rest[0]}_${rest[1]}`);
      case 'unlocked_count': {
        const need = parseInt(rest[0], 10);
        const pre = [...unlocked].filter(
          (i) => i !== META_316_ID && i !== CLUB_316_ID && i !== MILLENNIUM_ID
        ).length;
        return pre >= need;
      }
      case 'crossover_recruit':
        if (rest[0] === 'wwe') return MetaProgress.getWweRecruited().includes(rest[1]);
        return MetaProgress.getCrossoverRecruited().includes(rest[1]);
      case 'crossover_all': {
        const f = rest[0];
        if (f === 'wwe')
          return Object.keys(WweDefs).every((id) => MetaProgress.getWweRecruited().includes(id));
        const ids = getFactionOperativeIds(f);
        return (
          ids.length > 0 && ids.every((id) => MetaProgress.getCrossoverRecruited().includes(id))
        );
      }
      case 'crossover_field':
        return (session.crossoverFieldMax[rest[0]] || 0) >= parseInt(rest[1], 10);
      case 'crossover_wave': {
        const need = parseInt(rest[1], 10);
        const minField = rest[2] != null ? parseInt(rest[2], 10) : rest[0] === 'wwe' ? 3 : 2;
        return session.maxWave >= need && (session.crossoverFieldMax[rest[0]] || 0) >= minField;
      }
      case 'crossover_kills':
        return (crossoverKills[rest[0]] || 0) >= parseInt(rest[1], 10);
      case 'crossover_abilities':
        return (crossoverAbilities[rest[0]] || 0) >= parseInt(rest[1], 10);
      case 'crossover_mastery':
        return (crossoverMastery[rest[0]] || 0) >= parseInt(rest[1], 10);
      case 'crossover_mastery_any': {
        const need = parseInt(rest[0], 10);
        return Object.values(crossoverMastery).some((v) => v >= need);
      }
      case 'synergy':
        return session.flags.has(`synergy_${rest[0]}`);
      case 'crossover_flag':
        return session.flags.has(`crossover_${rest[0]}_${rest[1]}`);
      case 'crossover_grand_slam_all':
        return CROSSOVER_ACH_FACTIONS.every((f) => {
          const ids = getFactionOperativeIds(f.key);
          if (f.key === 'wwe')
            return Object.keys(WweDefs).every((id) => MetaProgress.getWweRecruited().includes(id));
          if (f.key === 'doom') return true;
          return (
            ids.length > 0 && ids.every((id) => MetaProgress.getCrossoverRecruited().includes(id))
          );
        });
      case 'multiversal':
        return (
          Math.max(ctx.crossoverFactionCount ?? 0, session.maxCrossoverFactions) >=
          parseInt(rest[0], 10)
        );
      case 'doom_alive':
        return doomMaxAliveWaves >= parseInt(rest[0], 10);
      case 'doom_session_kills':
        return session.doomKills >= parseInt(rest[0], 10);
      case 'doom_lifetime_kills':
        return doomLifetimeKills >= parseInt(rest[0], 10);
      case 'creative_start':
        return session.flags.has('creative_start');
      case 'perks':
        return (ctx.perkCount ?? 0) >= parseInt(rest[0], 10);
      case 'hidden_milestone':
        return hiddenMilestones >= parseInt(rest[0], 10);
      case 'true_victory':
        return lifetimeTrueVictories >= parseInt(rest[0], 10);
      case 'meta':
        return LIST.filter((a) => !a.meta).every((a) => unlocked.has(a.id));
      default:
        return false;
    }
  }

  function checkAll(ctx = {}) {
    for (const ach of LIST) {
      if (unlocked.has(ach.id)) continue;
      if (evaluateRule(ach.rule, ctx)) tryUnlock(ach.id);
    }
  }

  function onEvent(type, data = {}) {
    switch (type) {
      case 'game_start':
        resetSession();
        session.currentDiff = data.difficulty || 'normal';
        if (typeof AdvancedDifficulty !== 'undefined') {
          session.advancedMods = AdvancedDifficulty.getActiveModCount?.() ?? 0;
        }
        if (data.creative) session.flags.add('creative_start');
        break;

      case 'kill': {
        session.kills++;
        lifetimeKills++;
        if (data.elite) session.elitesKilled++;
        if (data.enemyType) {
          session.enemyFirst.add(data.enemyType);
          lifetimeEnemyKills[data.enemyType] = (lifetimeEnemyKills[data.enemyType] || 0) + 1;
        }
        const kf = getUnitFaction(data.killerType);
        if (kf) {
          crossoverKills[kf] = (crossoverKills[kf] || 0) + 1;
          addMastery(kf, 1);
        }
        if (data.killerType === 'doomslayer_hero') {
          session.doomKills++;
          doomLifetimeKills++;
          addMastery('doom', 2);
        }
        if (data.killerType === 'cavalry' && data.charging) session.flags.add('cavalry_charge');
        if (data.killerType === 'sapper' && data.siege) session.flags.add('sapper_siege');
        break;
      }

      case 'wave_complete': {
        const w = data.wave || 0;
        session.maxWave = Math.max(session.maxWave, w);
        session.currentMisses = data.playerDeaths ?? data.misses ?? 0;
        lifetimeWavesCleared++;
        if (data.siegeWave) session.flags.add('siege_clear');
        if (data.hordeWave) session.flags.add('horde_clear');
        if (data.bossWave) session.flags.add('boss_clear');
        if (data.huntOn) session.flags.add('hunt_wave');
        if (data.armySize === 1) session.flags.add('last_stand');
        session.spyThisWave = 0;
        if (typeof AdvancedDifficulty !== 'undefined') {
          session.advancedMods = AdvancedDifficulty.getActiveModCount?.() ?? session.advancedMods;
        }
        const field = countCrossoverField(data.units);
        data.crossoverFactionCount = field.factionCount;
        session.maxCrossoverFactions = Math.max(session.maxCrossoverFactions, field.factionCount);
        if (w >= 200 && data.difficulty === 'doomslayer') {
          MetaProgress.unlockDoomslayerHero();
          tryUnlock('doom_hero_unlock');
        }
        if (w >= 150 && data.difficulty === 'doomslayer' && !session.flags.has('zombie_building_lost')) {
          MetaProgress.unlock115();
          tryUnlock('ultimis_horde_150');
          tryUnlock('ultimis_unlock');
        }
        const doomOnField = data.units?.some((u) => u.type === 'doomslayer_hero' && u.hp > 0);
        if (doomOnField) {
          doomAliveWaves++;
          doomMaxAliveWaves = Math.max(doomMaxAliveWaves, doomAliveWaves);
        } else {
          doomAliveWaves = 0;
        }
        for (const f of field.factions) addMastery(f, 10);
        showWaveSummary(data);
        break;
      }

      case 'deploy': {
        session.deployedTypes.add(data.unitType);
        if (data.unitType === 'doomslayer_hero') session.flags.add('deploy_doomslayer_hero');
        if (data.unitType?.startsWith('academy_')) session.academyTypes.add(data.unitType);
        break;
      }

      case 'vet_event': {
        if (data.event === 'bronze') session.flags.add('star_bronze');
        if (data.event === 'silver') session.flags.add('star_silver');
        if (data.event === 'gold') session.flags.add('star_gold');
        if (data.event === 'upgrade' || data.event === 'honored_upgrade') {
          session.vetUpgrades++;
          if (data.unitType && data.vetTier >= 3) session.flags.add(`rank_${data.unitType}_3`);
        }
        if (data.event === 'honored_upgrade' || data.event === 'honored_general_star') {
          session.flags.add('honor');
          session.flags.add('honor_max');
        }
        if (data.event === 'honored') session.flags.add('honor');
        if ((data.vetTier || 0) >= (typeof MAX_VETERAN_TIER !== 'undefined' ? MAX_VETERAN_TIER : 6)) {
          const pathId =
            typeof EternalPathFramework !== 'undefined'
              ? EternalPathFramework.getPathForUnit?.(data.unitType, data)
              : null;
          if (pathId) {
            session.pathImmortals.add(pathId);
          }
        }
        break;
      }

      case 'building_complete':
        session.buildingsCompleted.add(data.buildType);
        if (data.buildType?.startsWith('academy_')) session.academyTypes.add(data.buildType);
        if (data.buildType === 'castle' || data.compound) session.flags.add('has_castle_compound');
        break;

      case 'castle_compound_breach':
        session.flags.add('castle_compound_breached');
        break;

      case 'footman_command_elevated':
        if (data.unitKey) session.footmanGeneralPipeline.add(data.unitKey);
        break;

      case 'footman_promoted_general':
        session.footmanGeneralPromotions++;
        session.flags.add('footman_promoted_general');
        if (data.unitKey) session.footmanGeneralPipeline.add(data.unitKey);
        break;

      case 'general_fielded':
        session.flags.add('had_general');
        break;

      case 'general_fell':
        session.flags.add('general_fell');
        break;

      case 'enemy_structure_razed':
        session.enemyStructuresRazed = Math.max(
          session.enemyStructuresRazed || 0,
          data.runTotal ?? (session.enemyStructuresRazed || 0) + 1
        );
        if (session.enemyStructuresRazed >= 1) session.flags.add('siege_active');
        break;

      case 'army_morale_sample':
        session.moraleSamplesTotal++;
        if (data.high) session.moraleSamplesHigh++;
        break;

      case 'army_melee_sample':
        session.meleeSamplesTotal++;
        if (data.focused) session.meleeSamplesFocused++;
        break;

      case 'stand_alliance_sample':
        session.standAllianceSamplesTotal++;
        if (data.allied) session.standAllianceSamplesAllied++;
        if (data.multiFaction) session.standAllianceMultiFactionSamples++;
        break;

      case 'solo_hero_boss_kill':
        if (data.solo) {
          session.flags.add('solo_hero_named_boss');
          if (data.bossType) session.flags.add(`solo_boss_${data.bossType}`);
        }
        break;

      case 'planet_boss_ki_stand':
        if (data.high && (data.wave || 0) >= 200) {
          session.flags.add('planet_boss_high_ki');
          session.planetBossKiRatio = Math.max(session.planetBossKiRatio || 0, data.ratio || 0);
        }
        break;

      case 'army_showmanship_sample':
        session.showmanshipSamplesTotal++;
        if (data.heavy) session.showmanshipSamplesHeavy++;
        break;

      case 'fortification_line_sample': {
        const count = data.count ?? 0;
        const minForts = data.minForts ?? 8;
        if (count >= minForts) session.flags.add('fort_line_established');
        if (session.flags.has('fort_line_established') && count < minForts)
          session.flags.add('fort_line_breached');
        break;
      }

      case 'named_boss_repelled':
        if (!session.flags.has('general_fell')) {
          session.namedBossWavesRepelled = (session.namedBossWavesRepelled || 0) + 1;
        }
        break;

      case 'path_immortal_reached': {
        const pathId = data.pathId;
        const maxTier = typeof MAX_VETERAN_TIER !== 'undefined' ? MAX_VETERAN_TIER : 6;
        if (pathId && (data.vetTier || 0) >= maxTier) session.pathImmortals.add(pathId);
        break;
      }

      case 'dragon_boss_slay':
        session.flags.add('dragon_boss_slay');
        if (data.bossType) session.flags.add(`dragon_boss_${data.bossType}`);
        break;

      case 'game_end':
        if (data.victory) {
          session.flags.add('run_victory');
          if (data.hasCastleCompound) session.flags.add('has_castle_compound');
          if (
            session.flags.has('has_castle_compound') &&
            !session.flags.has('castle_compound_breached')
          ) {
            MetaProgress.unlockPrimus();
            tryUnlock('primis_sanctum_victory');
            tryUnlock('primis_unlock');
          }
          if (
            session.flags.has('had_general') &&
            !session.flags.has('general_fell') &&
            session.flags.has('footman_promoted_general') &&
            session.footmanGeneralPipeline.size >= 5
          ) {
            MetaProgress.unlockHalo();
            tryUnlock('halo_spartan_victory');
            tryUnlock('halo_unlock');
          }
          if (session.enemyStructuresRazed >= 12) {
            MetaProgress.unlockGears();
            tryUnlock('gears_siege_victory');
            tryUnlock('gears_unlock');
          }
          if (
            session.moraleSamplesTotal >= 8 &&
            session.moraleSamplesHigh / session.moraleSamplesTotal >= 0.55
          ) {
            MetaProgress.unlockLotr();
            tryUnlock('lotr_fellowship_victory');
            tryUnlock('lotr_unlock');
          }
          if (
            isChadPlusDiff(session.currentDiff) &&
            session.meleeSamplesTotal >= 8 &&
            session.meleeSamplesFocused / session.meleeSamplesTotal >= 0.55
          ) {
            MetaProgress.unlockBaki();
            tryUnlock('baki_martial_victory');
            tryUnlock('baki_unlock');
          }
          if (
            session.crossoverHeroRecruits.size >= 3 &&
            session.standAllianceSamplesTotal >= 8 &&
            session.standAllianceSamplesAllied / session.standAllianceSamplesTotal >= 0.55
          ) {
            MetaProgress.unlockJojo();
            tryUnlock('jojo_stand_victory');
            tryUnlock('jojo_unlock');
          }
          if (session.flags.has('solo_hero_named_boss')) {
            MetaProgress.unlockFotns();
            tryUnlock('fotns_hokuto_victory');
            tryUnlock('fotns_unlock');
          }
          if (session.flags.has('planet_boss_high_ki')) {
            MetaProgress.unlockDragonball();
            tryUnlock('dragonball_planet_victory');
            tryUnlock('dragonball_unlock');
          }
          if (
            session.showmanshipSamplesTotal >= 8 &&
            session.showmanshipSamplesHeavy / session.showmanshipSamplesTotal >= 0.55
          ) {
            MetaProgress.unlockWweAcademy();
            tryUnlock('wwe_showmanship_victory');
            tryUnlock('wwe_unlock');
          }
          if (
            isChadPlusDiff(session.currentDiff) &&
            session.flags.has('fort_line_established') &&
            !session.flags.has('fort_line_breached') &&
            session.flags.has('had_general') &&
            !session.flags.has('general_fell') &&
            (session.namedBossWavesRepelled || 0) >= 3
          ) {
            MetaProgress.unlockWarhammer();
            tryUnlock('warhammer_eternal_crusade');
            tryUnlock('warhammer_unlock');
          }
          if (
            session.maxWave >= 100 &&
            session.pathImmortals.has('martial') &&
            session.pathImmortals.has('arcane') &&
            session.pathImmortals.has('tech') &&
            session.pathImmortals.has('mythic') &&
            session.flags.has('dragon_boss_slay')
          ) {
            MetaProgress.unlockTes();
            tryUnlock('tes_dragonborn_victory');
            tryUnlock('tes_unlock');
          }
        }
        break;

      case 'zombie_building_lost':
        session.flags.add('zombie_building_lost');
        session.zombieBuildingLosses = (session.zombieBuildingLosses || 0) + 1;
        break;

      case 'garrison':
        session.flags.add('garrison');
        session.garrisonCount = Math.max(session.garrisonCount, data.count ?? 1);
        break;

      case 'ability':
        session.abilitiesUsed.add(data.ability);
        break;

      case 'crossover_ability': {
        const f = data.faction || getUnitFaction(data.unitType);
        if (f) {
          crossoverAbilities[f] = (crossoverAbilities[f] || 0) + 1;
          addMastery(f, 3);
          save();
        }
        if (
          data.ability &&
          typeof isShowmanshipAbility === 'function' &&
          isShowmanshipAbility(data.ability)
        ) {
          session.showmanshipAbilityUses++;
        }
        break;
      }

      case 'spy':
        lifetimeSpy.add(data.action);
        session.flags.add('spy');
        session.spyThisWave++;
        save();
        break;

      case 'courier':
        session.flags.add('courier');
        if (data.message) {
          session.flags.add(`courier_${data.message}`);
          lifetimeCourier.add(data.message);
          save();
        }
        break;

      case 'general_stationed':
        session.flags.add('general_stationed');
        break;

      case 'mage_splash':
        if ((data.hitCount ?? 0) >= 2) session.flags.add('mage_splash');
        break;

      case 'wwe_recruit':
        if (data.wweId) session.crossoverHeroRecruits.add(data.wweId);
        MetaProgress.recordWweRecruit(data.wweId);
        addMastery('wwe', 15);
        tryUnlock(`wwe_recruit_${data.wweId}`);
        if (Object.keys(WweDefs).every((id) => MetaProgress.getWweRecruited().includes(id)))
          tryUnlock('wwe_grand_slam');
        break;

      case 'crossover_mastery_challenge':
        if (data.challenge) session.flags.add(`mastery_${data.challenge}`);
        if (data.faction) addMastery(data.faction, 25);
        break;

      case 'crossover_recruit':
        if (data.crossoverId) session.crossoverHeroRecruits.add(data.crossoverId);
        MetaProgress.recordCrossoverRecruit(data.crossoverId);
        {
          const def = getCrossoverDef?.(data.crossoverId);
          if (def?.faction) {
            addMastery(def.faction, 15);
            tryUnlock(`${def.faction}_recruit_${data.crossoverId}`);
            const ids = getFactionOperativeIds(def.faction);
            if (ids.every((id) => MetaProgress.getCrossoverRecruited().includes(id)))
              tryUnlock(`${def.faction}_grand_slam`);
          }
        }
        break;

      case 'roster_synergy':
        session.flags.add('roster_synergy');
        break;

      case 'faction_synergy':
        if (data.synergy) session.flags.add(`synergy_${data.synergy}`);
        break;

      case 'faction_synergy_multi':
        session.maxSynergyCount = Math.max(session.maxSynergyCount || 0, data.count || 0);
        if ((data.count || 0) >= 2) session.flags.add('faction_synergy_multi');
        break;

      case 'multiversal_synergy':
        session.maxCrossoverFactions = Math.max(session.maxCrossoverFactions, data.count || 0);
        break;

      case 'multiversal_check':
        session.maxCrossoverFactions = Math.max(session.maxCrossoverFactions, data.count || 0);
        data.crossoverFactionCount = Math.max(data.crossoverFactionCount || 0, data.count || 0);
        break;

      case 'jojo_cavalry':
        session.flags.add('crossover_jojo_cavalry');
        break;

      case 'true_victory':
        if (data.bossSlain) {
          lifetimeTrueVictories++;
          save();
        }
        break;

      case 'tp_check':
      case 'state_check': {
        if (data.units) {
          const field = countCrossoverField(data.units);
          data.crossoverFactionCount = field.factionCount;
        }
        break;
      }
    }
    checkAll(data);
  }

  function showWaveSummary(data) {
    const el = document.getElementById('wave-summary-ach');
    if (!el) return;
    const c = getCount();
    const pct = Math.round((c.unlocked / c.total) * 100);
    const newRecent = recentUnlocked.slice(0, 3);
    el.innerHTML = `
      <div class="wave-sum-progress">
        <span>Achievements ${c.unlocked}/${c.total}</span>
        <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct}%"></div></div>
      </div>
      ${newRecent.length ? `<div class="wave-sum-recent">Recent: ${newRecent.map((r) => r.name).join(' · ')}</div>` : ''}
    `;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 4000);
  }

  function matchesTab(ach, tabId) {
    if (tabId === 'all') return true;
    const tab = CATS.find((t) => t.id === tabId);
    if (!tab) return false;
    if (tab.crossover) {
      if (activeCrossover) {
        const ct = CROSSOVER_TABS.find((c) => c.id === activeCrossover);
        return ct && ach.cat === ct.cat;
      }
      return ach.cat?.startsWith('crossover_');
    }
    if (tab.cats)
      return tab.cats.includes(ach.cat) || (tabId === 'vanilla' && VANILLA_CATS.has(ach.cat));
    return ach.cat === tabId;
  }

  function getAll() {
    return LIST.map((a) => ({
      ...a,
      unlocked: unlocked.has(a.id),
      visible: !a.hidden || unlocked.has(a.id),
    }));
  }

  function getCount() {
    return { unlocked: unlocked.size, total: LIST.length, target: TARGET };
  }

  function hasClub316() {
    return unlocked.has(CLUB_316_ID) || unlocked.has(META_316_ID);
  }

  function renderPanel() {
    const grid = document.getElementById('achievements-grid');
    const countEl = document.getElementById('achievements-count');
    const tabsEl = document.getElementById('achievements-tabs');
    const subTabsEl = document.getElementById('achievements-crossover-tabs');
    const progressEl = document.getElementById('achievements-progress-fill');
    const recentEl = document.getElementById('achievements-recent');
    if (!grid) return;
    const c = getCount();
    const pct = Math.round((c.unlocked / c.total) * 100);
    if (countEl) {
      countEl.textContent = `${c.unlocked} / ${c.total}`;
      countEl.classList.toggle('club-316', hasClub316());
    }
    if (progressEl) progressEl.style.width = `${pct}%`;
    const progText = document.getElementById('achievements-progress-text');
    if (progText) progText.textContent = `${pct}% to Millennium`;

    if (tabsEl) {
      tabsEl.innerHTML = CATS.map(
        (cat) => `
        <button class="ach-tab ${activeCat === cat.id ? 'active' : ''}" data-cat="${cat.id}">${cat.label}</button>
      `
      ).join('');
      tabsEl.querySelectorAll('.ach-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeCat = btn.dataset.cat;
          renderPanel();
          AudioEngine?.SFX?.click?.();
        });
      });
    }

    if (subTabsEl) {
      if (activeCat === 'crossovers') {
        subTabsEl.style.display = '';
        subTabsEl.innerHTML = CROSSOVER_TABS.map(
          (ct) => `
          <button class="ach-subtab ${activeCrossover === ct.id ? 'active' : ''}" data-crossover="${ct.id}">${ct.label}</button>
        `
        ).join('');
        subTabsEl.querySelectorAll('.ach-subtab').forEach((btn) => {
          btn.addEventListener('click', () => {
            activeCrossover = btn.dataset.crossover;
            renderPanel();
            AudioEngine?.SFX?.click?.();
          });
        });
      } else {
        subTabsEl.style.display = 'none';
        subTabsEl.innerHTML = '';
      }
    }

    if (recentEl) {
      recentEl.innerHTML = recentUnlocked.length
        ? recentUnlocked
            .map((r) => {
              const ach = LIST.find((a) => a.id === r.id);
              const badge = ach ? tierBadge(ach) : null;
              const tier = badge
                ? `<span class="ach-recent-tier tier-${badge.cls}">${badge.label}</span>`
                : '';
              return `<div class="ach-recent-card ${ach?.unlocked !== false ? 'unlocked' : ''}">${tier}<strong>${r.name}</strong></div>`;
            })
            .join('')
        : '<p class="ach-recent-empty">No recent unlocks yet — your legend begins here.</p>';
    }

    const q = searchQuery.trim().toLowerCase();
    let filtered = getAll().filter((a) => a.visible && matchesTab(a, activeCat));
    if (q) {
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.desc.toLowerCase().includes(q) ||
          a.cat.toLowerCase().includes(q)
      );
    }
    if (tierFilter === 'meta') filtered = filtered.filter((a) => a.meta);
    else if (tierFilter !== 'all')
      filtered = filtered.filter((a) => a.tier === tierFilter || (tierFilter === 'meta' && a.meta));
    if (unlockedOnly) filtered = filtered.filter((a) => a.unlocked);

    const countNote = document.getElementById('ach-filter-count');
    if (countNote) countNote.textContent = `Showing ${filtered.length} achievement(s)`;

    grid.innerHTML = filtered
      .map((a) => {
        const badge = tierBadge(a);
        const badgeHtml = badge
          ? ` <span class="ach-tier-badge tier-${badge.cls}">${badge.label}</span>`
          : '';
        const tierCls = a.meta ? 'tier-meta' : a.tier ? `tier-${a.tier}` : '';
        return `
      <div class="ach-card ${a.unlocked ? 'unlocked' : 'locked'} ${a.meta ? 'meta-ach' : ''} ${tierCls}" data-id="${a.id}" title="${a.unlocked ? 'Click to copy share card' : ''}">
        <div class="ach-card-icon">${a.unlocked ? (a.meta ? '👑' : a.tier === 'gold' ? '🥇' : a.tier === 'silver' ? '🥈' : a.tier === 'bronze' ? '🥉' : '🏆') : '🔒'}</div>
        <div class="ach-card-body">
          <div class="ach-card-name">${a.name}${badgeHtml}</div>
          <div class="ach-card-desc">${a.desc}</div>
          <div class="ach-card-cat">${a.cat}${a.track === 'lifetime' ? ' · lifetime' : ''}</div>
        </div>
      </div>`;
      })
      .join('');
    grid.querySelectorAll('.ach-card.unlocked').forEach((card) => {
      card.addEventListener('click', () => {
        const ach = LIST.find((x) => x.id === card.dataset.id);
        if (!ach) return;
        const badge = tierBadge(ach);
        const tier = badge ? ` [${badge.label}]` : '';
        const text = `Myth and Blood — ${ach.name}${tier}: ${ach.desc}`;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(text)
            .then(() => showShareFlash(card))
            .catch(() => {});
        }
      });
    });
  }

  function showShareFlash(card) {
    card.classList.add('ach-shared');
    setTimeout(() => card.classList.remove('ach-shared'), 900);
  }

  function updateTopBar() {
    const c = getCount();
    const achTop = document.getElementById('ach-top-count');
    const achFill = document.getElementById('ach-top-progress-fill');
    const achBtn = document.getElementById('achievements-btn');
    if (achTop) {
      achTop.textContent = `${c.unlocked}/${c.total}`;
    }
    if (achFill) achFill.style.width = `${Math.round((c.unlocked / c.total) * 100)}%`;
    if (achBtn) achBtn.classList.toggle('club-316', hasClub316());
  }

  function togglePanel() {
    const panel = document.getElementById('achievements-screen');
    if (!panel) return;
    const open = panel.classList.toggle('active');
    if (open) renderPanel();
  }

  function init() {
    MetaProgress.load();
    load();
    checkMilestones();
    if (unlocked.has(META_316_ID)) MetaProgress.unlockWweAcademy();
    updateTopBar();

    document.getElementById('achievements-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      togglePanel();
    });
    document.getElementById('achievements-close')?.addEventListener('click', () => {
      document.getElementById('achievements-screen')?.classList.remove('active');
    });
    document.getElementById('menu-achievements-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      togglePanel();
    });

    document.getElementById('achievements-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPanel();
    });
    document.getElementById('achievements-tier-filter')?.addEventListener('change', (e) => {
      tierFilter = e.target.value;
      renderPanel();
    });
    document.getElementById('achievements-unlocked-only')?.addEventListener('change', (e) => {
      unlockedOnly = e.target.checked;
      renderPanel();
    });
  }

  return {
    init,
    onEvent,
    tryUnlock,
    getAll,
    getCount,
    renderPanel,
    togglePanel,
    resetSession,
    checkAll,
    evaluateRule,
    updateTopBar,
    hasClub316,
    CLUB_316_ID,
    META_316_ID,
    MILLENNIUM_ID,
    TARGET,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Achievements = Achievements;
