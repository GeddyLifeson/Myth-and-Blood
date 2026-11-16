/**
 * Honours: after each boss wave the player may give one honour to one living veteran.
 * A soldier holds one honour, shown in his name, and it dies with him.
 *   Standard Bearer: soldiers near him do not lose morale from seeing comrades fall.
 *   Captain: soldiers of his type near him deal +10% damage.
 *   Old Hand: new recruits of his type arrive with 6 experience.
 * This replaced wave-150/400 Legacy Point ascension; AscensionSystem stays as an alias.
 */
const Honours = (() => {
  const RADIUS = 160;
  const CAPTAIN_MULT = 1.1;
  const OLD_HAND_XP = 6;

  const HONOURS = {
    standard_bearer: {
      id: 'standard_bearer',
      label: 'Standard Bearer',
      desc: 'Soldiers near him do not lose morale from seeing comrades fall.',
    },
    captain: {
      id: 'captain',
      label: 'Captain',
      desc: 'Soldiers of his type near him deal +10% damage.',
    },
    old_hand: {
      id: 'old_hand',
      label: 'Old Hand',
      desc: `New recruits of his type arrive with ${OLD_HAND_XP} experience.`,
    },
  };

  let state = null;
  // id -> live unit, rebuilt when honours change or a save loads.
  let live = new Map();

  function resetRun() {
    state = { pending: 0, holders: [] };
    live = new Map();
  }

  function units() {
    return globalThis.GameState?.units || [];
  }

  function relink(list = units()) {
    live = new Map();
    for (const h of state.holders) {
      const u = list.find((x) => x.id === h.id && x.hp > 0 && x.honour === h.honour);
      if (u) live.set(h.id, u);
    }
  }

  function isBossWave(wave) {
    const w = wave | 0;
    return globalThis.GameDepth?.isBossWave?.(w) ?? (w >= 10 && w % 10 === 0);
  }

  function nameOf(u) {
    const base =
      u.honorName || (typeof getUnitTypeName === 'function' ? getUnitTypeName(u) : u.type);
    return `${HONOURS[u.honour]?.label || ''} ${base}`.trim();
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state || ctx.creative) return;
    relink(ctx.units || units());
    const fallen = state.holders.filter((h) => !live.has(h.id));
    for (const h of fallen) {
      ctx.showMessage?.(
        `${h.name} has fallen. The ${HONOURS[h.honour].label} honour dies with him.`,
        280
      );
    }
    state.holders = state.holders.filter((h) => live.has(h.id));
    if (isBossWave((wave | 0) - 1)) {
      state.pending++;
      ctx.showMessage?.('The boss is down. Select a veteran to give him an honour.', 300);
    }
  }

  /** Honour buttons for the unit panel; null when no honour is waiting. */
  function getOffer(u) {
    if (!state?.pending || !u || u.team !== 'player') return null;
    let reason = null;
    if (u.hp <= 0) reason = 'He is dead.';
    else if (u.honour) reason = `Already the ${HONOURS[u.honour].label}.`;
    else if ((u.vetTier || 0) < 1) reason = 'Needs a veteran: rank I or higher.';
    return {
      pending: state.pending,
      options: Object.values(HONOURS).map((h) => ({
        id: h.id,
        label: h.label,
        desc: h.desc,
        enabled: !reason,
        reason,
      })),
    };
  }

  function give(u, honourId, ctx = {}) {
    const offer = getOffer(u);
    if (!offer) return { ok: false, msg: 'No honour to give. One is earned after each boss wave.' };
    if (!HONOURS[honourId]) return { ok: false, msg: 'Choose an honour.' };
    if (offer.options[0].reason) return { ok: false, msg: offer.options[0].reason };
    u.honour = honourId;
    state.pending--;
    state.holders.push({ id: u.id, honour: honourId, name: nameOf(u) });
    live.set(u.id, u);
    ctx.showMessage?.(`${nameOf(u)}: ${HONOURS[honourId].desc}`, 280);
    ctx.addHighlight?.('honour', nameOf(u));
    return { ok: true };
  }

  function near(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }

  function holdersOf(honourId) {
    const out = [];
    for (const u of live.values()) if (u.hp > 0 && u.honour === honourId) out.push(u);
    return out;
  }

  /** Damage multiplier for a player attacker from a nearby Captain of his type. */
  function getDamageMult(attacker) {
    if (!attacker || attacker.team !== 'player' || !live.size) return 1;
    for (const c of holdersOf('captain')) {
      if (c.type === attacker.type && near(c, attacker)) return CAPTAIN_MULT;
    }
    return 1;
  }

  /** True when a Standard Bearer stands near this soldier. */
  function shieldsMorale(observer) {
    if (!observer || !live.size) return false;
    return holdersOf('standard_bearer').some((b) => b.team === observer.team && near(b, observer));
  }

  /** Called once when a player soldier is recruited. */
  function onRecruit(u) {
    if (!u || u.team !== 'player' || !live.size) return;
    if (holdersOf('old_hand').some((h) => h.type === u.type && h.id !== u.id)) {
      u.experience = Math.max(u.experience || 0, OLD_HAND_XP);
    }
  }

  function getDisplayTitle(u) {
    if (u?.honour && HONOURS[u.honour]) return nameOf(u);
    // Soldiers ascended under the old system keep their title.
    return u?.ascensionLabel || null;
  }

  function getStateSnapshot() {
    if (!state) return null;
    return { pending: state.pending, holders: state.holders.map((h) => ({ ...h })) };
  }

  function formatIntelNote() {
    return state?.pending ? `Honours: ${state.pending} to give` : '';
  }

  resetRun();

  // Run state in saves: see js/save-registry.js. Version 1 held Legacy Points.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('AscensionSystem', {
      version: 2,
      save: () => ({ pending: state.pending, holders: state.holders }),
      load(data) {
        resetRun();
        if (!data) return;
        state.pending = Math.max(0, data.pending | 0);
        state.holders = (Array.isArray(data.holders) ? data.holders : []).filter(
          (h) => h && HONOURS[h.honour]
        );
        relink();
      },
      // Legacy Points had no use below wave 150 and do not carry over.
      migrate: () => ({ pending: 0, holders: [] }),
    });
  }

  return {
    HONOURS,
    resetRun,
    onRunStart: resetRun,
    onWaveStart,
    getOffer,
    give,
    getDamageMult,
    shieldsMorale,
    onRecruit,
    getDisplayTitle,
    getStateSnapshot,
    formatHudLine: () => '',
    formatIntelNote,
  };
})();

// The old name; callers (waves, HUD, unit names, saves) still use it.
const AscensionSystem = Honours;

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Honours = Honours;
globalThis.AscensionSystem = AscensionSystem;
