/**
 * PanelModel — what the two side panels show, with no DOM in it.
 *
 *  - which tab is open, and which pane that makes visible (exactly one per panel);
 *  - which tab an item belongs to, and whether it sits in the open list or in the pane's
 *    "Locked" group (with the reason it is locked);
 *  - the real price of a spy action or a courier message, and how many waves are left
 *    before it can be used again.
 *
 * js/ui.js draws from this; scripts/test-panel-rules.mjs checks it without a browser.
 */
const PanelModel = (() => {
  const LEFT_TABS = ['troops', 'build', 'strike', 'cmd'];
  const RIGHT_TABS = ['spy', 'courier', 'ops'];
  const TAB_LABELS = {
    troops: 'Troops',
    build: 'Build',
    strike: 'Spells',
    cmd: 'More',
    spy: 'Spy',
    courier: 'Mail',
    ops: 'Ops',
  };

  const SETTLEMENTS = new Set([
    'fortress_upgrade',
    'hamlet',
    'village',
    'town',
    'city',
    'metropolis',
    'merchant_guild',
  ]);

  // ---- tabs ---------------------------------------------------------------------------
  /** A panel's tabs. Selecting a tab shows its pane and hides every other one. */
  function createTabs(ids, initial) {
    const list = ids.slice();
    let active = list.includes(initial) ? initial : list[0];
    return {
      ids: list,
      get active() {
        return active;
      },
      /** @returns {boolean} true when the open tab changed */
      select(id) {
        if (!list.includes(id) || id === active) return false;
        active = id;
        return true;
      },
      /** Arrow keys: the tab `step` places along, wrapping round. */
      step(step) {
        const at = list.indexOf(active);
        return list[(at + step + list.length) % list.length];
      },
      isOpen: (id) => id === active,
      /** { tabId: visible } — one true, the rest false. */
      panes: () => paneState(list, active),
    };
  }

  function paneState(ids, active) {
    const on = ids.includes(active) ? active : ids[0];
    const out = {};
    for (const id of ids) out[id] = id === on;
    return out;
  }

  // ---- where an item goes ---------------------------------------------------------------
  /** 'core' buildings are the Build tab's own; the rest are late-game. */
  function buildGroup(type) {
    const def = typeof BuildDefs !== 'undefined' ? BuildDefs[type] : null;
    if (def?.isPerkMachine || /^perk_/.test(type)) return 'perk';
    if (def?.isAcademy || /^academy_/.test(type)) return 'academy';
    if (SETTLEMENTS.has(type)) return 'settlement';
    return 'core';
  }

  /** Late-game items wait under More while locked and join their own tab once usable. */
  function isLate(kind, id) {
    if (kind === 'build') return buildGroup(id) !== 'core';
    return kind === 'counterDoctrine';
  }

  const HOME_TAB = {
    deploy: 'troops',
    build: 'build',
    ability: 'strike',
    doctrine: 'strike',
    counterDoctrine: 'strike',
    spy: 'spy',
    courier: 'courier',
  };

  /**
   * @param {string} kind deploy | build | ability | doctrine | counterDoctrine | spy | courier
   * @param {{ok: boolean, locked?: boolean, reason?: string}} avail the item's availability
   * @returns {{tab: string, locked: boolean}}
   */
  function place(kind, id, avail) {
    const locked = !!(avail && !avail.ok && avail.locked);
    const home = HOME_TAB[kind] || 'cmd';
    if (locked && isLate(kind, id)) return { tab: 'cmd', locked: true };
    return { tab: home, locked };
  }

  // ---- availability of the two item kinds Availability does not cover -------------------
  function tpOf(gs) {
    return typeof Availability !== 'undefined' ? Availability.tp(gs) : gs?.tactical || 0;
  }

  function stageName(stage) {
    return typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
      ? KINGDOM_EVOLUTION_STAGES[stage]?.name || 'a later stage'
      : `stage ${stage}`;
  }

  /** Kingdom doctrine: one per wave, opened by the kingdom's stage. */
  function doctrine(id, gs = {}) {
    const def =
      typeof KINGDOM_DOCTRINES !== 'undefined' ? KINGDOM_DOCTRINES[id] : gs.kingdomDoctrines?.[id];
    if (!def) return { ok: false, locked: true, reason: 'not available' };
    const cost = def.cost ?? 0;
    const stage = def.kingdomStage || 0;
    if (stage > 0 && (gs.kingdomStage || 1) < stage) {
      return { ok: false, locked: true, reason: `opens in ${stageName(stage)}`, cost };
    }
    if (gs.doctrineUsedThisWave) {
      return {
        ok: false,
        locked: false,
        reason: 'a doctrine was already invoked this wave',
        cost,
        wait: 1,
      };
    }
    if (tpOf(gs) < cost) {
      return {
        ok: false,
        locked: false,
        reason: `needs ${cost} TP, you have ${Math.floor(tpOf(gs))}`,
        cost,
        tp: true,
      };
    }
    return { ok: true, locked: false, reason: '', cost };
  }

  /** Counter-offensive doctrine: one per wave, opened by wave and kingdom stage. */
  function counterDoctrine(id, gs = {}) {
    const table =
      typeof PlayerCounterEvolution !== 'undefined' ? PlayerCounterEvolution.COUNTER_DOCTRINES : {};
    const def = table?.[id];
    if (!def) return { ok: false, locked: true, reason: 'not available' };
    const cost = def.cost ?? 0;
    const waveMin = def.waveMin || 0;
    if (waveMin > 0 && (gs.wave || 0) < waveMin) {
      return { ok: false, locked: true, reason: `opens at wave ${waveMin}`, cost };
    }
    const stage = def.kingdomStage || 0;
    if (stage > 0 && (gs.kingdomStage || 1) < stage) {
      return { ok: false, locked: true, reason: `opens in ${stageName(stage)}`, cost };
    }
    if (gs.counterDoctrineUsedThisWave) {
      return {
        ok: false,
        locked: false,
        reason: 'a counter-offensive was already ordered this wave',
        cost,
        wait: 1,
      };
    }
    if (tpOf(gs) < cost) {
      return {
        ok: false,
        locked: false,
        reason: `needs ${cost} TP, you have ${Math.floor(tpOf(gs))}`,
        cost,
        tp: true,
      };
    }
    return { ok: true, locked: false, reason: '', cost };
  }

  /** One availability answer for every kind of panel item. */
  function check(kind, id, gs) {
    if (kind === 'doctrine') return doctrine(id, gs);
    if (kind === 'counterDoctrine') return counterDoctrine(id, gs);
    return Availability.check(kind, id, gs);
  }

  // ---- the two lists of a pane ----------------------------------------------------------
  /**
   * Sort items into tabs: `open` (usable now, or unlocked but not affordable) and `locked`
   * (each with the reason). Order within a list is the order given.
   * @param {{kind: string, id: string}[]} items
   * @returns {Record<string, {open: object[], locked: object[]}>}
   */
  function layout(items, gs) {
    const out = {};
    for (const tab of [...LEFT_TABS, ...RIGHT_TABS]) out[tab] = { open: [], locked: [] };
    for (const it of items) {
      const avail = check(it.kind, it.id, gs);
      const at = place(it.kind, it.id, avail);
      const row = { kind: it.kind, id: it.id, ok: !!avail.ok, reason: avail.reason || '' };
      (at.locked ? out[at.tab].locked : out[at.tab].open).push(row);
    }
    return out;
  }

  /** "Locked · 6" */
  function lockedLabel(n) {
    return `Locked · ${n}`;
  }

  // ---- spy actions and courier messages -------------------------------------------------
  function waves(n) {
    return `${n} wave${n === 1 ? '' : 's'}`;
  }

  /** "2 waves left", or '' when the action is not waiting on a wave. */
  function waitLabel(n) {
    return n > 0 ? `${waves(n)} left` : '';
  }

  /**
   * A spy action or courier message as its button shows it.
   * @returns {{ok: boolean, locked: boolean, reason: string, cost: number, costText: string,
   *   wait: number, waitText: string, state: 'ready'|'cooldown'|'locked'|'blocked'}}
   */
  function action(kind, id, gs) {
    const avail = Availability.check(kind, id, gs);
    const cost = kind === 'spy' ? Availability.spyCost(id, gs) : Availability.courierCost(id, gs);
    const wait = avail.ok ? 0 : avail.wait || 0;
    const state = avail.ok ? 'ready' : avail.locked ? 'locked' : wait > 0 ? 'cooldown' : 'blocked';
    return {
      ok: !!avail.ok,
      locked: !!avail.locked,
      reason: avail.reason || '',
      cost,
      costText: cost > 0 ? `${cost} TP` : 'Free',
      wait,
      waitText: waitLabel(wait),
      state,
    };
  }

  /** "1 of 1 left this wave" for the header of the Spy or Mail pane. */
  function usesLeft(kind, gs = {}) {
    if (kind === 'spy') return gs.spyUsedThisWave ? 0 : 1;
    const cap = Math.max(1, gs.courierMessagesPerWave || 1);
    return Math.max(0, cap - (gs.courierMessagesUsedThisWave || 0));
  }

  return {
    LEFT_TABS,
    RIGHT_TABS,
    TAB_LABELS,
    createTabs,
    paneState,
    buildGroup,
    isLate,
    place,
    check,
    doctrine,
    counterDoctrine,
    layout,
    lockedLabel,
    waitLabel,
    action,
    usesLeft,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.PanelModel = PanelModel;
