/**
 * Entry sectors. The host always comes from the top edge, which is split into three
 * sectors: left, centre and right. At nightfall a plan is rolled for the coming wave: which
 * one, two or three sectors it uses, what share of the host each gets, and which enemies
 * go where. The night markers show that plan, so the player can read it and shift soldiers
 * sideways before dawn.
 *
 * This replaced the east, west and south flank attacks. The global keeps its old name,
 * `MultiFrontSiege`, because other modules look it up by that name.
 */
const MultiFrontSiege = (() => {
  const SECTORS = ['left', 'centre', 'right'];
  const SECTOR_LABELS = { left: 'left', centre: 'centre', right: 'right' };
  /** Counter-raids come down from the top edge like everything else. */
  const FRONT_LABELS = { north: 'north' };
  const EDGE_MARGIN = 24;

  function isSector(s) {
    return SECTORS.includes(s);
  }

  /** The strip of the field a sector covers, and its middle. */
  function sectorBounds(sector, worldW) {
    const i = Math.max(0, SECTORS.indexOf(sector));
    const w = (worldW || 400) / SECTORS.length;
    return { x0: i * w, x1: (i + 1) * w, cx: (i + 0.5) * w };
  }

  function sectorAt(x, worldW) {
    const w = (worldW || 400) / SECTORS.length;
    return SECTORS[Math.max(0, Math.min(SECTORS.length - 1, Math.floor(x / w)))];
  }

  /** A spawn x inside the sector, clear of the field edge and of the neighbouring sector. */
  function spawnX(sector, worldW, rng = Math.random) {
    const b = sectorBounds(sector, worldW);
    const lo = Math.max(EDGE_MARGIN, b.x0 + 8);
    const hi = Math.min((worldW || 400) - EDGE_MARGIN, b.x1 - 8);
    return lo + rng() * Math.max(1, hi - lo);
  }

  /** Keeps a mustering enemy inside its own third of the muster zone. */
  function clampToSector(x, sector, worldW) {
    if (!isSector(sector)) return x;
    const b = sectorBounds(sector, worldW);
    return Math.max(Math.max(EDGE_MARGIN, b.x0 + 4), Math.min(b.x1 - 4, x));
  }

  function waveKind(flags = {}) {
    if (flags.boss) return 'boss';
    if (flags.horde) return 'horde';
    return 'ordinary';
  }

  /**
   * Chance of the host using one, two or three sectors.
   * Ordinary waves start narrow and widen as the war goes on. Hordes come wide. A boss
   * comes on a narrow front with its guard, and only later brings wings.
   */
  function sectorCountWeights(wave, kind, spreadBias = 0) {
    const w = Math.max(1, wave | 0);
    let one;
    let three;
    if (kind === 'horde') {
      one = w < 10 ? 0.15 : 0.05;
      three = Math.min(0.7, 0.3 + w * 0.012);
    } else if (kind === 'boss') {
      one = Math.max(0.3, 0.7 - w * 0.008);
      three = Math.min(0.2, Math.max(0, (w - 20) * 0.004));
    } else {
      one = w <= 2 ? 1 : Math.max(0.15, 0.75 - w * 0.03);
      three = w < 8 ? 0 : Math.min(0.35, (w - 6) * 0.015);
    }
    // A host that outranks the commander spreads wider.
    const bias = Math.max(0, Math.min(0.6, spreadBias || 0));
    one *= 1 - bias;
    three = Math.min(0.85, three + bias * 0.3);
    const two = Math.max(0, 1 - one - three);
    return [one, two, three];
  }

  function pickWeighted(items, weights, rng) {
    let total = 0;
    for (const w of weights) total += w;
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Which sectors, which one carries the weight, and each one's share of the host. */
  function rollSectors(wave, kind, rng = Math.random, opts = {}) {
    const n = pickWeighted([1, 2, 3], sectorCountWeights(wave, kind, opts.spreadBias), rng);
    // The main thrust: the centre a little more often, and less often where it came last
    // time, so that standing still is not an answer.
    const mainWeights = SECTORS.map((s) => {
      let w = s === 'centre' ? 0.4 : 0.3;
      if (s === opts.prevMain) w *= 0.45;
      return w;
    });
    const main = pickWeighted(SECTORS, mainWeights, rng);
    let sectors;
    if (n === 1) sectors = [main];
    else if (n === 3) sectors = [...SECTORS];
    else {
      const others = SECTORS.filter((s) => s !== main);
      let second;
      if (main === 'centre') second = others[rng() < 0.5 ? 0 : 1];
      else {
        // From a wing: the far wing (a pincer) more often as the war goes on.
        const pincer = Math.min(0.6, 0.25 + (wave | 0) * 0.01);
        second = rng() < pincer ? others.find((s) => s !== 'centre') : 'centre';
      }
      sectors = SECTORS.filter((s) => s === main || s === second);
    }
    const shares = {};
    if (n === 1) shares[main] = 1;
    else if (n === 2) {
      const lead = 0.52 + rng() * 0.2;
      for (const s of sectors) shares[s] = s === main ? lead : 1 - lead;
    } else {
      const lead = 0.4 + rng() * 0.14;
      const split = 0.35 + rng() * 0.3;
      const rest = sectors.filter((s) => s !== main);
      shares[main] = lead;
      shares[rest[0]] = (1 - lead) * split;
      shares[rest[1]] = (1 - lead) * (1 - split);
    }
    return { sectors, main, shares };
  }

  /** Whole-number head counts per sector for a host of `total` (largest remainder). */
  function apportion(total, sectors, shares) {
    const counts = {};
    const parts = sectors.map((s) => ({ s, exact: total * (shares[s] || 0) }));
    let used = 0;
    for (const p of parts) {
      counts[p.s] = Math.floor(p.exact);
      used += counts[p.s];
    }
    parts.sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
    for (let i = 0; used < total; i++, used++) counts[parts[i % parts.length].s]++;
    // A marked sector is never empty while there are enough enemies to go round.
    if (total >= sectors.length) {
      for (const s of sectors) {
        if (counts[s] > 0) continue;
        const donor = sectors.slice().sort((a, b) => counts[b] - counts[a])[0];
        counts[donor]--;
        counts[s]++;
      }
    }
    return counts;
  }

  function topTypes(tally, n = 2) {
    return Object.keys(tally || {})
      .filter((t) => tally[t] > 0)
      .sort((a, b) => tally[b] - tally[a] || (a < b ? -1 : 1))
      .slice(0, n);
  }

  /**
   * Gives every enemy in `queue` a sector. Each sector gets its share of the heads; an
   * enemy type is kept together where it fits, so sectors differ in what they bring. Boss
   * types go to the main sector.
   */
  function allocate(queue, roll, isBossType) {
    const { sectors, main, shares } = roll;
    const targets = apportion(queue.length, sectors, shares);
    const left = { ...targets };
    const byType = {};
    const put = (type, sector, n) => {
      if (n <= 0) return;
      byType[type] = byType[type] || {};
      byType[type][sector] = (byType[type][sector] || 0) + n;
      left[sector] -= n;
    };
    const tally = {};
    for (const t of queue) tally[t] = (tally[t] || 0) + 1;
    const types = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || (a < b ? -1 : 1));
    const roomiest = () => sectors.slice().sort((a, b) => left[b] - left[a])[0];
    let bossSector = null;
    for (const t of types) {
      if (!isBossType || !isBossType(t)) continue;
      bossSector = main;
      // The boss and its pack enter together even if that overfills the sector's share.
      put(t, main, tally[t]);
      tally[t] = 0;
    }
    for (const t of types) {
      let n = tally[t];
      while (n > 0) {
        const s = roomiest();
        const take = left[s] > 0 ? Math.min(n, left[s]) : n;
        put(t, s, take);
        n -= take;
      }
    }
    const counts = {};
    const sectorTypes = {};
    for (const s of sectors) {
      const st = {};
      let c = 0;
      for (const t of Object.keys(byType)) {
        const k = byType[t][s] || 0;
        if (k > 0) st[t] = k;
        c += k;
      }
      counts[s] = c;
      sectorTypes[s] = topTypes(st);
    }
    return { counts, types: sectorTypes, byType, bossSector };
  }

  /**
   * The plan for a wave, rolled at nightfall.
   * @param {object} opts
   * @param {number} opts.wave
   * @param {'ordinary'|'horde'|'boss'} opts.kind
   * @param {string[]|null} opts.queue  the host as forecast tonight (enemy type ids)
   * @param {number} opts.count         head count to use when there is no forecast
   * @param {string[]} [opts.poolTypes] likeliest types when there is no forecast
   * @param {(type: string) => boolean} [opts.isBossType]
   * @param {() => number} [opts.rng]
   * @param {string|null} [opts.prevMain]  main sector of the wave before
   * @param {number} [opts.spreadBias]
   */
  function buildPlan(opts = {}) {
    const rng = opts.rng || Math.random;
    const wave = opts.wave | 0;
    const kind = opts.kind || 'ordinary';
    const roll = rollSectors(wave, kind, rng, opts);
    const plan = {
      wave,
      kind,
      sectors: roll.sectors,
      main: roll.main,
      shares: roll.shares,
      counts: {},
      types: {},
      byType: null,
      bossSector: kind === 'boss' ? roll.main : null,
      total: 0,
      forecast: false,
    };
    if (Array.isArray(opts.queue) && opts.queue.length) {
      const a = allocate(opts.queue, roll, opts.isBossType);
      plan.counts = a.counts;
      plan.types = a.types;
      plan.byType = a.byType;
      if (a.bossSector) plan.bossSector = a.bossSector;
      plan.total = opts.queue.length;
      plan.forecast = true;
    } else {
      const total = Math.max(1, opts.count | 0);
      plan.counts = apportion(total, roll.sectors, roll.shares);
      for (const s of roll.sectors) plan.types[s] = (opts.poolTypes || []).slice(0, 2);
      plan.total = total;
    }
    return plan;
  }

  /**
   * Dawn: the host as it really is gets its sectors, one per queued enemy, in queue order.
   * The night's allocation is honoured type by type; anything the forecast did not have
   * (a late elite, an event's extra pack) goes where the plan is furthest behind its share.
   * The plan's counts and types are rewritten to match what will actually enter.
   */
  function assignQueue(plan, queue, isBossType) {
    if (!plan || !Array.isArray(queue)) return [];
    const sectors = plan.sectors.filter(isSector);
    if (!sectors.length) sectors.push('centre');
    const roll = {
      sectors,
      main: sectors.includes(plan.main) ? plan.main : sectors[0],
      shares: plan.shares || {},
    };
    const byType = plan.byType || allocate(queue, roll, isBossType).byType;
    const remaining = {};
    for (const t of Object.keys(byType)) remaining[t] = { ...byType[t] };
    const targets = apportion(queue.length, sectors, roll.shares);
    const done = {};
    const tallies = {};
    for (const s of sectors) {
      done[s] = 0;
      tallies[s] = {};
    }
    // How far a sector is through its share; the emptiest goes next, so sectors fill together.
    const fill = (s) => done[s] / Math.max(1, targets[s]);
    const out = [];
    let bossSector = null;
    for (const type of queue) {
      const rem = remaining[type];
      let options = rem ? sectors.filter((s) => (rem[s] || 0) > 0) : [];
      const boss = !!(isBossType && isBossType(type));
      let sector;
      if (options.length) {
        sector = options.sort((a, b) => fill(a) - fill(b))[0];
        rem[sector]--;
      } else if (boss) {
        sector = plan.bossSector && sectors.includes(plan.bossSector) ? plan.bossSector : roll.main;
      } else {
        options = sectors.slice();
        sector = options.sort((a, b) => fill(a) - fill(b))[0];
      }
      if (boss) bossSector = bossSector || sector;
      done[sector]++;
      tallies[sector][type] = (tallies[sector][type] || 0) + 1;
      out.push(sector);
    }
    plan.counts = { ...done };
    plan.total = queue.length;
    for (const s of sectors) plan.types[s] = topTypes(tallies[s]);
    if (bossSector) plan.bossSector = bossSector;
    plan.byType = null;
    plan.forecast = true;
    plan.assigned = true;
    return out;
  }

  /** A plan read back from a save, or null if it is not one (older saves named flanks). */
  function restorePlan(raw, wave) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sectors)) return null;
    if (wave != null && raw.wave !== wave) return null;
    const sectors = SECTORS.filter((s) => raw.sectors.includes(s));
    if (!sectors.length || sectors.length !== raw.sectors.length) return null;
    const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    const shares = {};
    const counts = {};
    const types = {};
    let shareSum = 0;
    for (const s of sectors) {
      shares[s] = num(raw.shares?.[s]);
      shareSum += shares[s];
      counts[s] = Math.floor(num(raw.counts?.[s]));
      types[s] = Array.isArray(raw.types?.[s])
        ? raw.types[s].filter((t) => typeof t === 'string').slice(0, 2)
        : [];
    }
    if (shareSum <= 0) for (const s of sectors) shares[s] = 1 / sectors.length;
    else for (const s of sectors) shares[s] /= shareSum;
    let byType = null;
    if (raw.byType && typeof raw.byType === 'object') {
      byType = {};
      for (const t of Object.keys(raw.byType)) {
        const row = {};
        for (const s of sectors) {
          const n = Math.floor(num(raw.byType[t]?.[s]));
          if (n > 0) row[s] = n;
        }
        if (Object.keys(row).length) byType[t] = row;
      }
    }
    const kind = ['ordinary', 'horde', 'boss'].includes(raw.kind) ? raw.kind : 'ordinary';
    const main = sectors.includes(raw.main) ? raw.main : sectors[0];
    return {
      wave: raw.wave | 0,
      kind,
      sectors,
      main,
      shares,
      counts,
      types,
      byType,
      bossSector: sectors.includes(raw.bossSector) ? raw.bossSector : null,
      total: sectors.reduce((a, s) => a + counts[s], 0),
      forecast: !!raw.forecast,
      assigned: !!raw.assigned,
    };
  }

  /** "the left", "the left and right", "the left, centre and right". */
  function describeSectors(sectors) {
    const names = (sectors || []).map((s) => SECTOR_LABELS[s] || s);
    if (!names.length) return '';
    if (names.length === 1) return `the ${names[0]}`;
    return `the ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  function formatIntel(plan) {
    if (!plan?.sectors?.length) return '';
    const parts = plan.sectors.map((s) => `${SECTOR_LABELS[s]} ${plan.counts?.[s] ?? 0}`);
    return `Enters top edge: ${parts.join(' · ')}`;
  }

  // ------------------------------------------------------------ counter-raids
  function pickCounterRaidTarget(factionId, buildings, _plan, rng = Math.random) {
    const live = (buildings || []).filter((b) => b.owner === 'player' && b.complete && b.hp > 0);
    const settlements = live.filter((b) => b.isHamlet || b.isMerchantGuild);
    const lineTargets = live.filter((b) => b.type === 'outpost' || b.type === 'wall' || b.isHamlet);
    const pool = settlements.length ? settlements : lineTargets;
    if (!pool.length) return null;
    return pool[Math.floor(rng() * pool.length)];
  }

  /** A counter-raid enters at the top edge, in the sector above its target. */
  function resolveCounterRaidSpawn(_factionId, target, ctx = {}) {
    const { worldW = 400, rng = Math.random } = ctx;
    const sector = sectorAt(target?.x ?? worldW / 2, worldW);
    return {
      side: 'north',
      sector,
      x: spawnX(sector, worldW, rng),
      y: 12 + rng() * 16,
      doctrine: 'raid',
    };
  }

  /** The plan of the wave being fought, for modules that ask by name. */
  let currentPlan = null;

  function resetRun() {
    currentPlan = null;
  }

  function setCurrentPlan(plan) {
    currentPlan = plan || null;
  }

  function getCurrentPlan() {
    return currentPlan;
  }

  function getStateSnapshot(plan = currentPlan) {
    const p = plan && Array.isArray(plan.sectors) ? plan : null;
    return {
      active: !!p,
      mode: null,
      assignments: [],
      sectors: p ? [...p.sectors] : [],
      main: p?.main || null,
      counts: p ? { ...p.counts } : {},
      bossSector: p?.bossSector || null,
      intel: p ? formatIntel(p) : null,
      summary: p ? `Host enters on ${describeSectors(p.sectors)}` : null,
    };
  }

  return {
    SECTORS,
    SECTOR_LABELS,
    FRONT_LABELS,
    isSector,
    sectorBounds,
    sectorAt,
    spawnX,
    clampToSector,
    waveKind,
    sectorCountWeights,
    rollSectors,
    apportion,
    buildPlan,
    assignQueue,
    restorePlan,
    describeSectors,
    formatIntel,
    pickCounterRaidTarget,
    resolveCounterRaidSpawn,
    resetRun,
    setCurrentPlan,
    getCurrentPlan,
    getStateSnapshot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MultiFrontSiege = MultiFrontSiege;
