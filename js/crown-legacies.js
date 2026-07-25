/**
 * Crown Legacies — multi-run perks and honor heirs from prior campaigns.
 */
const CrownLegacies = (() => {
  const STORAGE_KEY = 'myth-and-blood-crown-legacies-v1';
  const MAX_ACTIVE_PASSIVES = 3;
  const BASE_HEIR_SLOTS = 2;

  const PASSIVE_LEGACIES = {
    crowned_command: {
      id: 'crowned_command',
      name: 'Crowned Command',
      hint: 'Win a campaign run',
      desc: 'Start with +4 TP',
      unlock: (leg) => (leg.victories || 0) >= 1,
      effects: { startTp: 4 },
    },
    honor_bloodline: {
      id: 'honor_bloodline',
      name: 'Honor Bloodline',
      hint: 'Crown 3 honor names (lifetime)',
      desc: 'Honored troops +4 morale, +3% HP',
      unlock: (leg) => (leg.honorCount || 0) >= 3,
      effects: { honorMorale: 4, honorHpMult: 1.03 },
    },
    siege_memory: {
      id: 'siege_memory',
      name: 'Siege Memory',
      hint: 'Reach wave 50+ on any run',
      desc: 'Walls grant +4% protection',
      unlock: (leg) => (leg.maxWaveEver || 0) >= 50,
      effects: { wallProtectionBonus: 0.04 },
    },
    northern_grudge: {
      id: 'northern_grudge',
      name: 'Northern Grudge',
      hint: '400+ lifetime kills',
      desc: 'Player damage +4%',
      unlock: (leg) => (leg.totalKills || 0) >= 400,
      effects: { playerDmgMult: 1.04 },
    },
    realm_mason: {
      id: 'realm_mason',
      name: 'Realm Mason',
      hint: 'Clear 25+ waves (lifetime)',
      desc: 'Builders +8% build speed',
      unlock: (leg) => (leg.totalWavesCleared || 0) >= 25,
      effects: { builderBuildMult: 1.08 },
    },
    veteran_line: {
      id: 'veteran_line',
      name: 'Veteran Line',
      hint: 'Reach wave 30+ on any run',
      desc: 'Footmen, archers, pikemen +3% HP',
      unlock: (leg) => (leg.maxWaveEver || 0) >= 30,
      effects: { coreHpMult: 1.03 },
    },
    favorite_champion: {
      id: 'favorite_champion',
      name: 'Favorite Champion',
      hint: '50+ kills with your legacy favorite unit',
      desc: 'Favorite troop type +6% damage',
      unlock: (leg) => {
        const fav = leg.favoriteUnitType;
        return !!fav && (leg.unitKills?.[fav] || 0) >= 50;
      },
      effects: { favoriteDmgMult: 1.06, useFavoriteType: true },
    },
    crossover_echo: {
      id: 'crossover_echo',
      name: 'Crossover Echo',
      hint: 'Field a evolved faction on any run',
      desc: 'All troops +2 morale at run start',
      unlock: (leg) => (leg.factionsUsed?.length || 0) >= 1,
      effects: { startMorale: 2 },
    },
    deep_survivor: {
      id: 'deep_survivor',
      name: 'Deep Survivor',
      hint: 'Reach wave 100+ on any run',
      desc: 'Player damage taken −3%',
      unlock: (leg) => (leg.maxWaveEver || 0) >= 100,
      effects: { damageTakenMult: 0.97 },
    },
    blood_crown: {
      id: 'blood_crown',
      name: 'Blood Crown',
      hint: 'Crown 8 honor names (lifetime)',
      desc: 'Equip a 3rd honor heir',
      unlock: (leg) => (leg.honorCount || 0) >= 8,
      effects: { extraHeirSlot: 1 },
    },
  };

  const CORE_LINE_TYPES = new Set(['footman', 'archer', 'pikeman']);

  let data = {
    unlockedIds: [],
    activeIds: [],
    activeHeirKeys: [],
    seenUnlockIds: [],
  };

  let cachedFavoriteType = null;
  let lastHonorSnap = [];

  function resetRun() {
    data = {
      unlockedIds: [],
      activeIds: [],
      activeHeirKeys: [],
      seenUnlockIds: [],
    };
    cachedFavoriteType = null;
    lastHonorSnap = [];
    save();
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = { ...data, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      /* ignore */
    }
  }

  function honorKey(entry) {
    return `${entry.name}::${entry.type}`;
  }

  function getLegacySnapshot() {
    return typeof Legacy !== 'undefined' ? Legacy.get() : {};
  }

  function refreshUnlocks(legacySnap = null) {
    load();
    if (!Array.isArray(data.unlockedIds)) data.unlockedIds = [];
    if (!Array.isArray(data.activeIds)) data.activeIds = [];
    if (!Array.isArray(data.activeHeirKeys)) data.activeHeirKeys = [];
    const leg = legacySnap || getLegacySnapshot();
    cachedFavoriteType = leg.favoriteUnitType || null;
    if ((leg.honorNames || []).length) lastHonorSnap = leg.honorNames;
    const newly = [];
    for (const def of Object.values(PASSIVE_LEGACIES)) {
      if (!def.unlock(leg)) continue;
      if (!data.unlockedIds.includes(def.id)) {
        data.unlockedIds.push(def.id);
        newly.push(def.id);
      }
    }
    data.activeIds = data.activeIds.filter((id) => data.unlockedIds.includes(id));
    while (data.activeIds.length > MAX_ACTIVE_PASSIVES) data.activeIds.pop();
    pruneHeirs(leg);
    save();
    return { newly, unlocked: [...data.unlockedIds] };
  }

  function pruneHeirs(leg = null) {
    const snap = leg || getLegacySnapshot();
    const honors = (snap.honorNames || []).length ? snap.honorNames : lastHonorSnap;
    const valid = new Set((honors || []).map(honorKey));
    data.activeHeirKeys = data.activeHeirKeys.filter((k) => valid.has(k));
    while (data.activeHeirKeys.length > getMaxHeirSlots()) data.activeHeirKeys.pop();
  }

  function getMaxHeirSlots() {
    const extra = (data.activeIds || []).includes('blood_crown') ? 1 : 0;
    return BASE_HEIR_SLOTS + extra;
  }

  function getHonorCandidates() {
    const snap = lastHonorSnap.length ? { honorNames: lastHonorSnap } : getLegacySnapshot();
    const seen = new Set();
    const out = [];
    for (const entry of [...(snap.honorNames || [])].reverse()) {
      const key = honorKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        name: entry.name,
        type: entry.type,
        wave: entry.wave || 0,
      });
    }
    return out;
  }

  function getActiveHeirs() {
    const map = new Map(getHonorCandidates().map((h) => [h.key, h]));
    return data.activeHeirKeys.map((k) => map.get(k)).filter(Boolean);
  }

  function getCombinedEffects(legacySnap = null) {
    load();
    const leg = legacySnap || getLegacySnapshot();
    const out = {
      startTp: 0,
      startMorale: 0,
      honorMorale: 0,
      honorHpMult: 1,
      wallProtectionBonus: 0,
      playerDmgMult: 1,
      builderBuildMult: 1,
      coreHpMult: 1,
      favoriteDmgMult: 1,
      favoriteType: null,
      damageTakenMult: 1,
      extraHeirSlot: 0,
    };
    for (const id of data.activeIds) {
      const def = PASSIVE_LEGACIES[id];
      if (!def?.effects) continue;
      const e = def.effects;
      if (e.startTp) out.startTp += e.startTp;
      if (e.startMorale) out.startMorale += e.startMorale;
      if (e.honorMorale) out.honorMorale += e.honorMorale;
      if (e.honorHpMult) out.honorHpMult *= e.honorHpMult;
      if (e.wallProtectionBonus) out.wallProtectionBonus += e.wallProtectionBonus;
      if (e.playerDmgMult) out.playerDmgMult *= e.playerDmgMult;
      if (e.builderBuildMult) out.builderBuildMult *= e.builderBuildMult;
      if (e.coreHpMult) out.coreHpMult *= e.coreHpMult;
      if (e.favoriteDmgMult) out.favoriteDmgMult *= e.favoriteDmgMult;
      if (e.damageTakenMult) out.damageTakenMult *= e.damageTakenMult;
      if (e.extraHeirSlot) out.extraHeirSlot += e.extraHeirSlot;
      if (e.useFavoriteType) out.favoriteType = leg.favoriteUnitType || cachedFavoriteType;
    }
    return out;
  }

  function toggleLegacy(id) {
    load();
    if (!data.unlockedIds.includes(id)) return { ok: false, reason: 'locked' };
    const idx = data.activeIds.indexOf(id);
    if (idx >= 0) {
      data.activeIds.splice(idx, 1);
      save();
      return { ok: true, active: false };
    }
    if (data.activeIds.length >= MAX_ACTIVE_PASSIVES) {
      return { ok: false, reason: 'full', max: MAX_ACTIVE_PASSIVES };
    }
    data.activeIds.push(id);
    save();
    return { ok: true, active: true };
  }

  function toggleHeir(key) {
    load();
    pruneHeirs();
    const valid = getHonorCandidates().some((h) => h.key === key);
    if (!valid) return { ok: false, reason: 'invalid' };
    const idx = data.activeHeirKeys.indexOf(key);
    if (idx >= 0) {
      data.activeHeirKeys.splice(idx, 1);
      save();
      return { ok: true, active: false };
    }
    if (data.activeHeirKeys.length >= getMaxHeirSlots()) {
      return { ok: false, reason: 'full', max: getMaxHeirSlots() };
    }
    data.activeHeirKeys.push(key);
    save();
    return { ok: true, active: true };
  }

  function applyUnitBonuses(unit) {
    if (!unit || unit.team !== 'player' || unit.crownLegacyApplied) return unit;
    const fx = getCombinedEffects();
    if (unit.honorName || unit.honorHeirLegacy) {
      if (fx.honorMorale) unit.morale = Math.min(unit.maxMorale, unit.morale + fx.honorMorale);
      if (fx.honorHpMult > 1) {
        unit.maxHp = Math.floor(unit.maxHp * fx.honorHpMult);
        unit.hp = Math.min(unit.hp, unit.maxHp);
      }
    }
    if (fx.coreHpMult > 1 && CORE_LINE_TYPES.has(unit.type)) {
      unit.maxHp = Math.floor(unit.maxHp * fx.coreHpMult);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    if (fx.favoriteType && unit.type === fx.favoriteType && fx.favoriteDmgMult > 1) {
      unit.damage = Math.floor(unit.damage * fx.favoriteDmgMult);
    }
    unit.crownLegacyApplied = true;
    return unit;
  }

  function applyRunStartBonuses(ctx = {}) {
    if (ctx.creative) return { heirs: 0, startTp: 0 };
    const fx = getCombinedEffects();
    if (fx.startTp > 0) ctx.grantTp?.(fx.startTp);
    let heirs = 0;
    const list = getActiveHeirs();
    for (let i = 0; i < list.length; i++) {
      const heir = list[i];
      const u = ctx.spawnUnit?.(heir.type, 220 + i * 52, ctx.deployY, 'player', {
        crownHeir: true,
      });
      if (!u) continue;
      u.honorName = heir.name;
      u.honorTitleWave = heir.wave;
      u.honorHeirLegacy = true;
      u.crownHeirApplied = true;
      u.vetBronze = 1;
      u.maxHp = Math.floor(u.maxHp * 1.05);
      u.hp = u.maxHp;
      u.morale = Math.min(u.maxMorale, u.morale + 4);
      if (fx.startMorale > 0) {
        u.morale = Math.min(u.maxMorale, u.morale + fx.startMorale);
      }
      u.targetY = ctx.rallyY;
      ctx.pushUnit?.(u);
      heirs++;
      ctx.hooks?.showMessage?.(`Crown heir ${heir.name} marches with your line.`, 280);
    }
    if (fx.startMorale > 0) {
      for (const u of ctx.units || []) {
        if (u.team !== 'player' || u.hp <= 0) continue;
        u.morale = Math.min(u.maxMorale, u.morale + fx.startMorale);
        u._crownStartMoraleApplied = true;
      }
    }
    return { heirs, startTp: fx.startTp, activePassives: data.activeIds.length };
  }

  function getMenuSnapshot() {
    refreshUnlocks();
    const leg = getLegacySnapshot();
    const passives = Object.values(PASSIVE_LEGACIES).map((def) => ({
      id: def.id,
      name: def.name,
      desc: def.desc,
      hint: def.hint,
      unlocked: data.unlockedIds.includes(def.id),
      active: data.activeIds.includes(def.id),
      isNew: data.unlockedIds.includes(def.id) && !data.seenUnlockIds.includes(def.id),
      seen: data.seenUnlockIds.includes(def.id),
    }));
    const heirs = getHonorCandidates().map((h) => ({
      ...h,
      active: data.activeHeirKeys.includes(h.key),
    }));
    return {
      maxPassives: MAX_ACTIVE_PASSIVES,
      maxHeirs: getMaxHeirSlots(),
      activePassiveCount: data.activeIds.length,
      activeHeirCount: data.activeHeirKeys.length,
      passives,
      heirs,
      unlockedCount: data.unlockedIds.length,
      totalCount: Object.keys(PASSIVE_LEGACIES).length,
      honorPool: leg.honorCount || 0,
      summary: data.unlockedIds.length
        ? `${data.activeIds.length}/${MAX_ACTIVE_PASSIVES} legacies · ${data.activeHeirKeys.length}/${getMaxHeirSlots()} heirs`
        : 'Complete runs to unlock Crown Legacies',
    };
  }

  function markUnlocksSeen() {
    for (const id of data.unlockedIds) {
      if (!data.seenUnlockIds.includes(id)) data.seenUnlockIds.push(id);
    }
    save();
  }

  function getLegacyEntries() {
    const snap = getMenuSnapshot();
    const passiveList =
      snap.passives
        .filter((p) => p.unlocked)
        .map((p) => `${p.name}${p.active ? ' ★' : ''}`)
        .join(' · ') || 'None unlocked — win runs and crown veterans.';
    const heirList =
      snap.heirs
        .filter((h) => h.active)
        .map((h) => `${h.name} (${h.type})`)
        .join(' · ') || 'Select honored veterans on the main menu.';
    return [
      {
        cat: 'legacy',
        name: 'Crown Legacies (Passive)',
        body: `Equip up to ${MAX_ACTIVE_PASSIVES} permanent perks before each run. Unlocked: ${snap.unlockedCount}/${snap.totalCount}. Active: ${passiveList}`,
      },
      {
        cat: 'legacy',
        name: 'Honor Heirs',
        body: `Named veterans from past runs can march in new campaigns (${BASE_HEIR_SLOTS} slots, +1 with Blood Crown). Heirs keep their honor name, +1 bronze star, +5% HP, +4 morale. Selected: ${heirList}`,
        classified:
          snap.honorPool >= 3
            ? 'The Crown remembers every honor name — heirs inherit the title but must earn their stars anew.'
            : 'Earn three honor names across runs to unlock heir selection.',
        classifiedRule: 'honor:3',
      },
    ];
  }

  function getStateSnapshot() {
    const snap = getMenuSnapshot();
    return {
      ...snap,
      combined: getCombinedEffects(),
    };
  }

  load();

  return {
    PASSIVE_LEGACIES,
    MAX_ACTIVE_PASSIVES,
    BASE_HEIR_SLOTS,
    load,
    save,
    resetRun,
    refreshUnlocks,
    getCombinedEffects,
    getActiveHeirs,
    getHonorCandidates,
    getMaxHeirSlots,
    toggleLegacy,
    toggleHeir,
    applyUnitBonuses,
    applyRunStartBonuses,
    getMenuSnapshot,
    markUnlocksSeen,
    getLegacyEntries,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.CrownLegacies = CrownLegacies;
