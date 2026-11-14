/**
 * Economy rules — one place for the numbers that price off-field actions and give the
 * starter buildings their jobs. The game calls in here; nothing in this file draws.
 *
 *  - Courier and spy actions: cost, cost growth, cooldown in waves.
 *  - Between-run stacking: Ribbons, Crown Legacies and Crown of Ages share one cap on
 *    bonus starting TP.
 *  - Starter buildings: income at dawn, walls that hold line-breakers, the medical tent's
 *    stretcher bearers, and the either/or Outpost upgrade (Barracks or Granary).
 */
const EconomyRules = (() => {
  /** Ribbons + Crown Legacies + Crown of Ages together add at most this much starting TP. */
  const START_TP_BONUS_CAP = 6;

  /**
   * Priced actions. `cooldown` is in waves: used on the night before wave N+1, an action
   * with cooldown 3 is ready again on the night before wave N+4.
   *  - costStep: extra TP for every earlier use this run.
   *  - waveStep: +1 TP for every `waveStep` waves cleared.
   *  - upkeep: the army surcharge on recruits applies to this price too.
   */
  const ACTIONS = {
    'courier:levy': { cost: 1, cooldown: 3, pay: 5, morale: 2 },
    'courier:banner': { cost: 6, cooldown: 4, costStep: 2, upkeep: true, needsDeploy: 'knight' },
    'courier:reinforce': { cost: 4, cooldown: 2, upkeep: true },
    'courier:war_chest': { cost: 2, cooldown: 3 },
    'spy:disrupt': {
      cost: 5,
      cooldown: 3,
      waveStep: 6,
      countMult: 0.75,
      hpMult: 1.12,
      speedMult: 1.15,
    },
    'spy:war_chest': { cost: 4, cooldown: 3 },
    'spy:infiltrate': { cost: 3, softenShare: 0.3, softenHp: 0.6 },
    'spy:sabotage': { cost: 5, delayTicks: 600 },
    'spy:forge_maps': { cost: 3 },
  };

  /** Buildings: numbers the game and the manual both read. */
  const BUILDINGS = {
    /** A wall stops this many line-breakers per wave within `holdRadius` of it. */
    wall: { holdRadius: 64, holdsPerWave: 3 },
    /** Once per wave, a soldier struck down this close to a tent is carried in alive. */
    medical_tent: { saveRadius: 220, savesPerWave: 1, saveHp: 0.25 },
    /** Free footman at dawn every `musterEvery` waves, per Barracks (first two count). */
    barracks: { musterEvery: 3, maxCounted: 2 },
    /** Soldiers fed before the recruit surcharge starts, per Granary (first three count). */
    granary: { freeArmy: 3, maxCounted: 3 },
    /** Science at dawn per standing lab (first two count). */
    research_lab: { dawnScience: 6, maxCounted: 2 },
  };

  /** Outpost upgrades: an Outpost takes one of these, once. */
  const OUTPOST_UPGRADES = {
    outpost_barracks: {
      id: 'barracks',
      label: 'Barracks',
      note: 'A free footman musters here every third dawn. Two garrison slots.',
    },
    outpost_granary: {
      id: 'granary',
      label: 'Granary',
      note: 'Feeds 3 more soldiers before the recruit surcharge starts.',
    },
  };

  let readyWave = {};
  let uses = {};
  let startBonusLeft = START_TP_BONUS_CAP;
  let softenLeft = 0;

  function resetRun() {
    readyWave = {};
    uses = {};
    startBonusLeft = START_TP_BONUS_CAP;
    softenLeft = 0;
  }

  function rule(key) {
    return ACTIONS[key] || null;
  }

  /** Waves left before the action can be used again (0 = ready). */
  function cooldownLeft(key, wave) {
    const at = readyWave[key];
    return at == null ? 0 : Math.max(0, at - (wave || 0));
  }

  /**
   * Price of an action right now.
   * @param {string} key e.g. 'courier:banner'
   * @param {{wave?: number, upkeepMult?: number, discount?: number}} ctx
   */
  function getCost(key, ctx = {}) {
    const r = ACTIONS[key];
    if (!r) return null;
    let cost = r.cost;
    if (r.costStep) cost += r.costStep * (uses[key] || 0);
    if (r.waveStep) cost += Math.floor((ctx.wave || 0) / r.waveStep);
    if (r.upkeep) cost = Math.ceil(cost * Math.max(1, ctx.upkeepMult || 1));
    return Math.max(0, cost - (ctx.discount || 0));
  }

  /** @returns {{ok: boolean, reason?: string}} */
  function canUse(key, ctx = {}) {
    const r = ACTIONS[key];
    if (!r) return { ok: true };
    const left = cooldownLeft(key, ctx.wave);
    if (left > 0) {
      return {
        ok: false,
        reason: `Ready again in ${left} wave${left === 1 ? '' : 's'}.`,
      };
    }
    if (r.needsDeploy && ctx.isDeployUnlocked && !ctx.isDeployUnlocked(r.needsDeploy)) {
      return {
        ok: false,
        reason: 'Research Iron Weapons first: no knights answer the banner yet.',
      };
    }
    return { ok: true };
  }

  function markUsed(key, wave) {
    const r = ACTIONS[key];
    if (!r) return;
    uses[key] = (uses[key] || 0) + 1;
    if (r.cooldown) readyWave[key] = (wave || 0) + r.cooldown;
  }

  /** Bonus starting TP from any between-run system passes through here. */
  function grantStartTp(amount) {
    const want = Math.max(0, Math.floor(Number(amount) || 0));
    const got = Math.min(want, startBonusLeft);
    startBonusLeft -= got;
    return got;
  }

  function getStartBonusLeft() {
    return startBonusLeft;
  }

  // ------------------------------------------------------------- wave mods
  function onWaveStart(mods = {}) {
    softenLeft = 0;
    if (mods.softenShare > 0 && mods.softenCount > 0) softenLeft = mods.softenCount;
  }

  /** How many of the next wave's first arrivals Deep Infiltration weakens. */
  function softenCountFor(queueLength) {
    const r = ACTIONS['spy:infiltrate'];
    return Math.max(2, Math.round((queueLength || 0) * r.softenShare));
  }

  /**
   * Applied to each enemy as it enters the field.
   * @returns {string|null} a short label to float over the unit, or null
   */
  function onEnemySpawn(unit, mods = {}) {
    if (!unit || unit.team !== 'enemy') return null;
    let label = null;
    if ((mods.speedMult || 1) !== 1 && unit.speed) unit.speed *= mods.speedMult;
    if (softenLeft > 0 && !unit.isNamedBoss) {
      softenLeft--;
      const keep = ACTIONS['spy:infiltrate'].softenHp;
      unit.hp = Math.max(1, Math.floor(unit.hp * keep));
      label = 'AMBUSHED';
    }
    return label;
  }

  /** Remove siege engines from a spawn queue (Sabotage Siege). Returns how many were cut. */
  function stripSiege(queue, replacement = 'goblin') {
    let cut = 0;
    for (let i = 0; i < (queue || []).length; i++) {
      if (queue[i] === 'siege_tower' || queue[i] === 'goblin_engineer') {
        queue[i] = replacement;
        cut++;
      }
    }
    return cut;
  }

  // ------------------------------------------------------------- buildings
  function liveOwn(b) {
    return !!b && (b.owner || 'player') === 'player' && b.complete !== false && b.hp > 0;
  }

  function countUpgrade(buildings, id) {
    let n = 0;
    for (const b of buildings || []) if (liveOwn(b) && b.upgrade === id) n++;
    return n;
  }

  /** Extra soldiers fed before the recruit surcharge (Granaries). */
  function freeArmyBonus(buildings) {
    const g = BUILDINGS.granary;
    return Math.min(g.maxCounted, countUpgrade(buildings, 'granary')) * g.freeArmy;
  }

  /** Free footmen due at this dawn (Barracks). */
  function barracksMuster(buildings, wave) {
    const r = BUILDINGS.barracks;
    if (!(wave > 0) || wave % r.musterEvery !== 0) return [];
    const out = [];
    for (const b of buildings || []) {
      if (liveOwn(b) && b.upgrade === 'barracks' && out.length < r.maxCounted) out.push(b);
    }
    return out;
  }

  /** Science paid at dawn by standing labs. */
  function dawnScience(labCount) {
    const r = BUILDINGS.research_lab;
    return Math.min(r.maxCounted, Math.max(0, labCount || 0)) * r.dawnScience;
  }

  /**
   * A line-breaker that comes within reach of a wall is held: it stops running and has to
   * fight. Each wall holds a few per wave.
   * @returns {object|null} the wall that held it
   */
  function tryHoldRunner(unit, walls, wave) {
    if (!unit || !unit.lineBreaker || unit.hp <= 0 || unit.flying) return null;
    const r = BUILDINGS.wall;
    const reach2 = r.holdRadius * r.holdRadius;
    for (const w of walls || []) {
      if (!liveOwn(w) || w.type !== 'wall') continue;
      if (w.holdWave !== wave) {
        w.holdWave = wave;
        w.holdsUsed = 0;
      }
      if (w.holdsUsed >= r.holdsPerWave) continue;
      const dx = unit.x - w.x;
      const dy = unit.y - w.y;
      if (dx * dx + dy * dy > reach2) continue;
      w.holdsUsed++;
      unit.lineBreaker = false;
      unit.stormLine = false;
      unit.heldByWall = true;
      return w;
    }
    return null;
  }

  /**
   * Stretcher bearers: the tent that can still save a soldier struck down at (x, y).
   * Marks the save as used.
   */
  function claimStretcher(x, y, buildings, wave) {
    const r = BUILDINGS.medical_tent;
    const reach2 = r.saveRadius * r.saveRadius;
    let best = null;
    let bestD = Infinity;
    for (const b of buildings || []) {
      if (!liveOwn(b) || !b.isMedical) continue;
      if (b.saveWave === wave && (b.savesUsed || 0) >= r.savesPerWave) continue;
      const dx = x - b.x;
      const dy = y - b.y;
      const d = dx * dx + dy * dy;
      if (d <= reach2 && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (!best) return null;
    if (best.saveWave !== wave) {
      best.saveWave = wave;
      best.savesUsed = 0;
    }
    best.savesUsed++;
    return best;
  }

  // ------------------------------------------------------------ def syncing
  /**
   * Keep the shared action tables (and the cost labels on the buttons) in step with the
   * live price, so tooltips and the "can afford" state stay truthful.
   */
  function syncActionDefs(ctx = {}) {
    const spy = typeof SpyActions !== 'undefined' ? SpyActions : null;
    const courier = typeof CourierMessages !== 'undefined' ? CourierMessages : null;
    for (const key of Object.keys(ACTIONS)) {
      const [kind, id] = key.split(':');
      const table = kind === 'spy' ? spy : courier;
      const def = table && table[id];
      if (!def) continue;
      if (def.baseDesc == null) def.baseDesc = def.desc || '';
      const cost = getCost(key, ctx);
      def.cost = cost;
      const left = cooldownLeft(key, ctx.wave);
      const r = ACTIONS[key];
      const every = r.cooldown ? ` Once every ${r.cooldown} waves.` : '';
      def.desc = `${def.baseDesc}${every}${left > 0 ? ` Ready again in ${left} wave${left === 1 ? '' : 's'}.` : ''}`;
      if (typeof document !== 'undefined' && document.querySelector) {
        const el = document.querySelector(`.${kind}-btn[data-${kind}="${id}"] .cost`);
        if (el) el.textContent = left > 0 ? `${left}w` : String(cost);
      }
    }
  }

  // ------------------------------------------------------------------ save
  function exportState() {
    return { readyWave: { ...readyWave }, uses: { ...uses }, startBonusLeft };
  }

  function importState(s) {
    resetRun();
    if (!s || typeof s !== 'object') return;
    if (s.readyWave && typeof s.readyWave === 'object') readyWave = { ...s.readyWave };
    if (s.uses && typeof s.uses === 'object') uses = { ...s.uses };
    if (Number.isFinite(s.startBonusLeft)) startBonusLeft = s.startBonusLeft;
  }

  return {
    START_TP_BONUS_CAP,
    ACTIONS,
    BUILDINGS,
    OUTPOST_UPGRADES,
    resetRun,
    rule,
    getCost,
    canUse,
    cooldownLeft,
    markUsed,
    grantStartTp,
    getStartBonusLeft,
    onWaveStart,
    softenCountFor,
    onEnemySpawn,
    stripSiege,
    freeArmyBonus,
    barracksMuster,
    dawnScience,
    tryHoldRunner,
    claimStretcher,
    syncActionDefs,
    exportState,
    importState,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.EconomyRules = EconomyRules;
