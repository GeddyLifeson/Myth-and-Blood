/**
 * Crown Legacies: the Muster loadout. Before a run the player slots up to three perks
 * (Crown Legacies, earned ribbons, Crown of Ages echo branches), picks honor heirs and
 * handicaps. Slots beyond the first are bought with Echo Shards, the one between-run currency.
 */
const CrownLegacies = (() => {
  const STORAGE_KEY = 'myth-and-blood-crown-legacies-v1';
  const STORE_VERSION = 2;
  const MAX_ACTIVE_PASSIVES = 3;
  // Shard price of slot 1, 2, 3.
  const SLOT_COSTS = [0, 3, 6];
  const BASE_HEIR_SLOTS = 2;
  const RIBBON_PREFIX = 'ribbon:';
  const ECHO_PREFIX = 'echo:';

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
      hint: 'Field an evolved faction on any run',
      desc: 'All troops +2 morale at run start',
      unlock: (leg) => (leg.factionsUsed?.length || 0) >= 1,
      effects: { startMorale: 2 },
    },
    deep_survivor: {
      id: 'deep_survivor',
      name: 'Deep Survivor',
      hint: 'Reach wave 100+ on any run',
      desc: 'Player damage taken -3%',
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

  const freshData = () => ({
    version: STORE_VERSION,
    unlockedIds: [],
    activeIds: [],
    activeHeirKeys: [],
    seenUnlockIds: [],
    slotsOwned: 1,
    slotSpend: 0,
  });

  let data = freshData();
  let cachedFavoriteType = null;
  let lastHonorSnap = [];
  // Slots locked in when the current run began; null at the menu.
  let runSlots = null;
  // getCombinedEffects() is on the damage path: computed once per change, not per hit.
  let fxCache = null;
  // Bumped on every change that can alter effects; other modules key their caches on it.
  let version = 0;
  function invalidate() {
    fxCache = null;
    version++;
  }

  function resetRun() {
    data = freshData();
    cachedFavoriteType = null;
    lastHonorSnap = [];
    runSlots = null;
    save();
  }

  let loadedOnce = false;
  function ensureLoaded() {
    if (!loadedOnce) load();
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * v1 stores had no slots: every unlocked legacy could be equipped and every ribbon was
   * always on. Anyone with progress keeps all three slots, paid for at no cost.
   */
  function migrate(stored) {
    const out = { ...freshData(), ...stored };
    if ((stored.version || 1) >= STORE_VERSION) return out;
    const eternal = readJson('myth-and-blood-eternal-legacy-v1');
    const ribbons = readJson('myth-and-blood-ribbons-v1');
    const hadProgress =
      (stored.unlockedIds?.length || 0) > 0 ||
      (stored.activeIds?.length || 0) > 0 ||
      (eternal?.investedIds?.length || 0) > 0 ||
      (ribbons?.earned?.length || 0) > 0;
    out.slotsOwned = hadProgress ? MAX_ACTIVE_PASSIVES : 1;
    out.slotSpend = 0;
    out.version = STORE_VERSION;
    return out;
  }

  function load() {
    loadedOnce = true;
    const stored = readJson(STORAGE_KEY);
    if (stored) {
      const wasOld = (stored.version || 1) < STORE_VERSION;
      data = migrate(stored);
      if (wasOld) save();
    }
    for (const k of ['unlockedIds', 'activeIds', 'activeHeirKeys', 'seenUnlockIds']) {
      if (!Array.isArray(data[k])) data[k] = [];
    }
    data.slotsOwned = Math.max(1, Math.min(MAX_ACTIVE_PASSIVES, data.slotsOwned | 0 || 1));
    data.slotSpend = Math.max(0, data.slotSpend | 0);
    invalidate();
  }

  function save() {
    invalidate();
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
    data.activeIds = data.activeIds.filter((id) => isPerkUnlocked(id));
    while (data.activeIds.length > data.slotsOwned) data.activeIds.pop();
    pruneHeirs(leg);
    save();
    return { newly, unlocked: [...data.unlockedIds] };
  }

  // ---------------------------------------------------------------- perk catalog
  function ribbonList() {
    return typeof SiegeLoop !== 'undefined' && SiegeLoop.getRibbons ? SiegeLoop.getRibbons() : [];
  }

  function echoBranches() {
    return typeof EternalLegacyTree !== 'undefined' && EternalLegacyTree.getBranchPerks
      ? EternalLegacyTree.getBranchPerks()
      : [];
  }

  function isPerkUnlocked(id) {
    if (PASSIVE_LEGACIES[id]) return data.unlockedIds.includes(id);
    if (id.startsWith(RIBBON_PREFIX)) {
      const rid = id.slice(RIBBON_PREFIX.length);
      return ribbonList().some((r) => r.id === rid && r.earned);
    }
    if (id.startsWith(ECHO_PREFIX)) {
      const bid = id.slice(ECHO_PREFIX.length);
      return echoBranches().some((b) => b.id === bid && b.invested.length > 0);
    }
    return false;
  }

  /** Every perk the Muster can slot, grouped, with why it is or is not available. */
  function getPerks() {
    const legacies = Object.values(PASSIVE_LEGACIES).map((def) => ({
      id: def.id,
      group: 'legacy',
      name: def.name,
      desc: def.desc,
      hint: def.hint,
      unlocked: data.unlockedIds.includes(def.id),
    }));
    const ribbons = ribbonList().map((r) => ({
      id: RIBBON_PREFIX + r.id,
      group: 'ribbon',
      name: r.name,
      desc: r.perk,
      hint: r.how,
      unlocked: !!r.earned,
    }));
    const echoes = echoBranches().map((b) => ({
      id: ECHO_PREFIX + b.id,
      group: 'echo',
      name: b.label,
      desc: b.invested.length ? b.invested.join(', ') : b.desc,
      hint: 'Invest Echo Shards in this branch of the Crown of Ages below',
      unlocked: b.invested.length > 0,
    }));
    return [...ribbons, ...legacies, ...echoes];
  }

  function currentSlots() {
    ensureLoaded();
    return runSlots || data.activeIds;
  }

  function isSlotted(id) {
    return currentSlots().includes(id);
  }

  function getVersion() {
    return version;
  }

  function getAvailableShards() {
    if (typeof EternalLegacyTree === 'undefined' || !EternalLegacyTree.getAvailableShards) return 0;
    return EternalLegacyTree.getAvailableShards();
  }

  function getSlotSpend() {
    ensureLoaded();
    return data.slotSpend;
  }

  function nextSlotCost() {
    return data.slotsOwned >= MAX_ACTIVE_PASSIVES ? null : SLOT_COSTS[data.slotsOwned];
  }

  function buySlot() {
    load();
    const cost = nextSlotCost();
    if (cost === null) return { ok: false, reason: 'max' };
    if (getAvailableShards() < cost) return { ok: false, reason: 'shards', cost };
    data.slotsOwned++;
    data.slotSpend += cost;
    save();
    return { ok: true, slots: data.slotsOwned, cost };
  }

  // ---------------------------------------------------------------- heirs
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

  // ---------------------------------------------------------------- effects
  function computeEffects(leg) {
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
    for (const id of currentSlots()) {
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
      if (e.useFavoriteType) {
        out.favoriteType = leg ? leg.favoriteUnitType || cachedFavoriteType : cachedFavoriteType;
      }
    }
    return out;
  }

  function getCombinedEffects(legacySnap = null) {
    ensureLoaded();
    if (legacySnap) return computeEffects(legacySnap);
    if (!fxCache) {
      if (cachedFavoriteType === null && typeof Legacy !== 'undefined') {
        cachedFavoriteType = Legacy.get().favoriteUnitType || null;
      }
      fxCache = computeEffects(null);
    }
    return fxCache;
  }

  /** Slot or unslot any unlocked perk (name kept from when it only took Crown Legacies). */
  function toggleLegacy(id) {
    load();
    if (!isPerkUnlocked(id)) return { ok: false, reason: 'locked' };
    runSlots = null;
    const idx = data.activeIds.indexOf(id);
    if (idx >= 0) {
      data.activeIds.splice(idx, 1);
      pruneHeirs();
      save();
      return { ok: true, active: false };
    }
    if (data.activeIds.length >= data.slotsOwned) {
      return { ok: false, reason: 'full', max: data.slotsOwned };
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
    load();
    runSlots = [...data.activeIds];
    if (typeof Legacy !== 'undefined') cachedFavoriteType = Legacy.get().favoriteUnitType || null;
    invalidate();
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
    return { heirs, startTp: fx.startTp, activePassives: runSlots.length };
  }

  // ---------------------------------------------------------------- snapshots
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
      maxPassives: data.slotsOwned,
      slotsOwned: data.slotsOwned,
      slotLimit: MAX_ACTIVE_PASSIVES,
      nextSlotCost: nextSlotCost(),
      shards: getAvailableShards(),
      maxHeirs: getMaxHeirSlots(),
      activePassiveCount: data.activeIds.length,
      activeHeirCount: data.activeHeirKeys.length,
      activeIds: [...data.activeIds],
      passives,
      perks: getPerks(),
      heirs,
      unlockedCount: data.unlockedIds.length,
      totalCount: Object.keys(PASSIVE_LEGACIES).length,
      honorPool: leg.honorCount || 0,
      summary: `${data.activeIds.length}/${data.slotsOwned} perks · ${data.activeHeirKeys.length}/${getMaxHeirSlots()} heirs`,
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
    const byId = new Map(snap.perks.map((p) => [p.id, p]));
    const slotted =
      snap.activeIds.map((id) => byId.get(id)?.name || id).join(' · ') ||
      'No perks slotted. Open the Muster before a run.';
    const heirList =
      snap.heirs
        .filter((h) => h.active)
        .map((h) => `${h.name} (${h.type})`)
        .join(' · ') || 'Select honored veterans at the Muster.';
    return [
      {
        cat: 'legacy',
        name: 'The Muster',
        body: `Before each run, slot up to ${MAX_ACTIVE_PASSIVES} perks from your ribbons, Crown Legacies and Crown of Ages branches, and choose handicaps that raise your score. Slots owned: ${snap.slotsOwned}/${MAX_ACTIVE_PASSIVES}. Slotted: ${slotted}`,
      },
      {
        cat: 'legacy',
        name: 'Honor Heirs',
        body: `Named veterans from past runs can march in new campaigns (${BASE_HEIR_SLOTS} slots, +1 with Blood Crown). Heirs keep their honor name, +1 bronze star, +5% HP, +4 morale. Selected: ${heirList}`,
        classified:
          snap.honorPool >= 3
            ? 'The Crown remembers every honor name. Heirs inherit the title but must earn their stars anew.'
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

  // ---------------------------------------------------------------- Muster screen
  const esc = (s) => (typeof HtmlUtil !== 'undefined' ? HtmlUtil.escapeHtml(s) : String(s ?? ''));

  const GROUP_LABELS = {
    ribbon: 'Ribbons',
    legacy: 'Crown Legacies',
    echo: 'Echoes of the Past',
  };

  function perkButton(p, snap) {
    const slotted = snap.activeIds.includes(p.id);
    const full = snap.activeIds.length >= snap.slotsOwned;
    let reason = '';
    if (!p.unlocked) reason = `Locked: ${p.hint}`;
    else if (!slotted && full) reason = 'All slots taken: clear one first';
    const disabled = !!reason;
    const status = slotted ? 'SLOTTED' : p.unlocked ? 'SLOT' : 'LOCKED';
    const cls = `muster-perk${slotted ? ' slotted' : ''}${disabled ? ' unavailable' : ''}`;
    return (
      `<button type="button" class="${cls}" data-perk="${esc(p.id)}"${disabled ? ' disabled' : ''}` +
      ` title="${esc(reason || p.desc)}">` +
      `<span class="muster-perk-name">${esc(p.name)}</span>` +
      `<span class="muster-perk-status">${status}</span>` +
      `<span class="muster-perk-desc">${esc(p.desc)}</span>` +
      (reason ? `<span class="muster-perk-reason">${esc(reason)}</span>` : '') +
      `</button>`
    );
  }

  function renderSlots(snap) {
    const byId = new Map(snap.perks.map((p) => [p.id, p]));
    let html = '';
    for (let i = 0; i < snap.slotLimit; i++) {
      if (i < snap.slotsOwned) {
        const id = snap.activeIds[i];
        const p = id ? byId.get(id) : null;
        html += p
          ? `<button type="button" class="muster-slot filled" data-perk="${esc(p.id)}" title="Clear this slot"><span class="muster-slot-n">${i + 1}</span><span>${esc(p.name)}</span><span class="muster-perk-desc">${esc(p.desc)}</span></button>`
          : `<div class="muster-slot empty"><span class="muster-slot-n">${i + 1}</span><span>Empty: pick a perk below</span></div>`;
      } else if (i === snap.slotsOwned) {
        const cost = snap.nextSlotCost;
        const afford = snap.shards >= cost;
        html +=
          `<button type="button" class="muster-slot buy${afford ? '' : ' unavailable'}" data-buy-slot="1"${afford ? '' : ' disabled'}>` +
          `<span class="muster-slot-n">${i + 1}</span><span>Open slot: ${cost} Echo Shards</span>` +
          `<span class="muster-perk-reason">${afford ? 'Click to buy' : `You have ${snap.shards}. Shards come from wins, depth, kills and honor names`}</span></button>`;
      } else {
        html += `<div class="muster-slot unavailable"><span class="muster-slot-n">${i + 1}</span><span>Locked: open slot ${i} first</span></div>`;
      }
    }
    return html;
  }

  function renderHeirs(snap) {
    if (!snap.heirs.length) {
      return '<p class="muster-empty">No honor names yet. Soldiers crowned in a run can march again as heirs.</p>';
    }
    const full = snap.activeHeirCount >= snap.maxHeirs;
    return snap.heirs
      .map((h) => {
        const typeLabel =
          typeof formatUnitTypeName === 'function' ? formatUnitTypeName(h.type) : h.type;
        const blocked = !h.active && full;
        return (
          `<button type="button" class="muster-perk${h.active ? ' slotted' : ''}${blocked ? ' unavailable' : ''}" data-heir="${esc(h.key)}"${blocked ? ' disabled' : ''}>` +
          `<span class="muster-perk-name">${esc(h.name)}</span><span class="muster-perk-status">${h.active ? 'MARCHING' : 'CALL'}</span>` +
          `<span class="muster-perk-desc">${esc(typeLabel)} · crowned W${h.wave}</span>` +
          (blocked
            ? `<span class="muster-perk-reason">Heir slots full (${snap.maxHeirs})</span>`
            : '') +
          `</button>`
        );
      })
      .join('');
  }

  function renderEchoTree() {
    if (typeof EternalLegacyTree === 'undefined') return '';
    const tree = EternalLegacyTree.getMenuSnapshot();
    return tree.nodes
      .map((n) => {
        const status = n.invested
          ? 'INVESTED'
          : !n.unlocked
            ? 'LOCKED'
            : n.canInvest
              ? `INVEST ${n.cost}`
              : n.prereqOk
                ? `NEED ${n.cost}`
                : 'NEEDS EARLIER ECHO';
        let reason = '';
        if (!n.invested && !n.unlocked) reason = `Locked: ${n.hint}`;
        else if (!n.invested && !n.prereqOk) reason = 'Invest the echo before it first';
        else if (!n.invested && !n.canInvest) reason = `Needs ${n.cost} Echo Shards`;
        const cls = `muster-node${n.invested ? ' invested' : ''}${!n.invested && !n.canInvest ? ' unavailable' : ''}`;
        return (
          `<button type="button" class="${cls}" data-node="${esc(n.id)}" style="border-left-color:${n.branchColor}"${n.canInvest ? '' : ' disabled'}>` +
          `<span class="muster-perk-name">${esc(n.name)}</span><span class="muster-perk-status">${status}</span>` +
          `<span class="muster-perk-desc">${esc(n.branchLabel)} · ${esc(n.desc)}</span>` +
          (reason ? `<span class="muster-perk-reason">${esc(reason)}</span>` : '') +
          `</button>`
        );
      })
      .join('');
  }

  function renderMuster() {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('muster-perks');
    if (!host) return;
    const snap = getMenuSnapshot();
    const groups = ['legacy', 'echo', 'ribbon']
      .map((g) => {
        // Unlocked perks first; locked ones keep their order below with the reason shown.
        const list = snap.perks
          .filter((p) => p.group === g)
          .sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
        if (!list.length) return '';
        const open = list.filter((p) => p.unlocked).length;
        return (
          `<div class="muster-group"><div class="muster-group-head">${GROUP_LABELS[g]} <span>${open}/${list.length}</span></div>` +
          `<div class="muster-grid">${list.map((p) => perkButton(p, snap)).join('')}</div></div>`
        );
      })
      .join('');
    host.innerHTML =
      `<div class="muster-shards">Echo Shards: <b>${snap.shards}</b></div>` +
      `<div class="muster-head">PERK SLOTS <span>${snap.activeIds.length}/${snap.slotsOwned}</span></div>` +
      `<div class="muster-slots">${renderSlots(snap)}</div>` +
      groups +
      `<div class="muster-group"><div class="muster-group-head">Honor heirs <span>${snap.activeHeirCount}/${snap.maxHeirs}</span></div>` +
      `<div class="muster-grid">${renderHeirs(snap)}</div></div>` +
      `<details class="muster-group muster-tree"><summary class="muster-group-head">Crown of Ages: deepen echo perks</summary>` +
      `<div class="muster-grid">${renderEchoTree()}</div></details>`;
    markUnlocksSeen();
    if (typeof EternalLegacyTree !== 'undefined') EternalLegacyTree.markUnlocksSeen?.();
  }

  let musterBound = false;
  function bindMuster() {
    if (musterBound || typeof document === 'undefined') return;
    const host = document.getElementById('muster-perks');
    if (!host) return;
    musterBound = true;
    host.addEventListener('click', (ev) => {
      const el = ev.target.closest('button');
      if (!el || el.disabled) return;
      if (el.dataset.perk) toggleLegacy(el.dataset.perk);
      else if (el.dataset.heir) toggleHeir(el.dataset.heir);
      else if (el.dataset.buySlot) buySlot();
      else if (el.dataset.node && typeof EternalLegacyTree !== 'undefined') {
        EternalLegacyTree.investNode(el.dataset.node);
      } else return;
      const keepTreeOpen = host.querySelector('.muster-tree')?.open;
      renderMuster();
      if (keepTreeOpen) host.querySelector('.muster-tree')?.setAttribute('open', '');
      globalThis.AudioEngine?.SFX?.click?.();
    });
  }

  load();

  // The run keeps the loadout it started with, even if the Muster is changed before a load.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('Muster', {
      save: () => ({ slots: runSlots ? [...runSlots] : null }),
      load(saved) {
        runSlots = saved && Array.isArray(saved.slots) ? saved.slots.map(String) : null;
        invalidate();
      },
    });
  }

  return {
    MAX_ACTIVE_PASSIVES,
    BASE_HEIR_SLOTS,
    SLOT_COSTS,
    load,
    save,
    resetRun,
    refreshUnlocks,
    getCombinedEffects,
    getActiveHeirs,
    getPerks,
    isSlotted,
    getVersion,
    getSlotSpend,
    buySlot,
    toggleLegacy,
    toggleSlot: toggleLegacy,
    toggleHeir,
    applyUnitBonuses,
    applyRunStartBonuses,
    getMenuSnapshot,
    markUnlocksSeen,
    getLegacyEntries,
    getStateSnapshot,
    renderMuster,
    bindMuster,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.CrownLegacies = CrownLegacies;
