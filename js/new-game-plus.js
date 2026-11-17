/**
 * After the wave 100 victory: Continue the same run endlessly, or start New Game+.
 * New Game+ carries the three best surviving veterans into a fresh, harder run; each
 * victory in New Game+ raises the tier by one.
 */
const NewGamePlus = (() => {
  const STORAGE_KEY = 'myth-and-blood-ngplus-v1';
  const MAX_TIER = 10;
  const CARRY_VETERANS = 3;

  // pending: the tier and veterans the next campaign run starts with, or null.
  let data = { bestTier: 0, pending: null };

  function load() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        data = {
          bestTier: clampTier(parsed.bestTier),
          pending: parsed.pending && clampTier(parsed.pending.tier) ? parsed.pending : null,
        };
      }
    } catch (_) {
      data = { bestTier: 0, pending: null };
    }
  }

  function save() {
    try {
      if (typeof localStorage !== 'undefined')
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      /* storage unavailable */
    }
  }

  function clampTier(t) {
    return Math.max(0, Math.min(MAX_TIER, Math.floor(Number(t) || 0)));
  }

  /** Enemy multipliers for a tier; folded into getDifficulty() like any other modifier. */
  function enemyMods(tier) {
    const t = clampTier(tier);
    return {
      enemyHpMult: 1 + 0.2 * t,
      enemyDmgMult: 1 + 0.12 * t,
      enemyCountMult: 1 + 0.08 * t,
    };
  }

  /** Score modifier in the shape siege-loop's computeScore reads ({ label, pct }). */
  function scoreModifier(tier) {
    const t = clampTier(tier);
    return t ? { id: 'ngplus', label: `New Game+ ${t}`, pct: 15 * t } : null;
  }

  function label(tier) {
    const t = clampTier(tier);
    return t ? `NG+${t}` : '';
  }

  /** The best living veterans: highest rank first, kills break ties. Plain data, no unit refs. */
  function pickVeterans(units) {
    return (units || [])
      .filter((u) => u && u.team === 'player' && u.hp > 0 && !u.isBuilding && (u.vetTier || 0) > 0)
      .sort((a, b) => (b.vetTier || 0) - (a.vetTier || 0) || (b.kills || 0) - (a.kills || 0))
      .slice(0, CARRY_VETERANS)
      .map((u) => ({
        type: u.type,
        vetTier: u.vetTier || 0,
        kills: u.kills || 0,
        name: u.honorName || null,
      }));
  }

  /** The Hall of Veterans roll when that system is loaded; else the best living veterans. */
  function queue(fromTier, units) {
    const tier = clampTier((fromTier || 0) + 1);
    const hall =
      typeof Veterans !== 'undefined' && Veterans.exportHall ? Veterans.exportHall() || [] : null;
    // An empty Hall (no veteran reached the top rank) still carries the best living veterans.
    data.pending = hall?.length
      ? { tier, hall, veterans: [] }
      : { tier, veterans: pickVeterans(units) };
    data.bestTier = Math.max(data.bestTier, tier);
    save();
    return data.pending;
  }

  function getPending() {
    return data.pending ? { ...data.pending, veterans: [...(data.pending.veterans || [])] } : null;
  }

  function clearPending() {
    data.pending = null;
    save();
  }

  function getBestTier() {
    return data.bestTier;
  }

  /** Called from Game.start(): consumes the pending run. Returns the tier the run plays at. */
  function applyRunStart(ctx) {
    if (ctx.creative || ctx.jumpIn || !data.pending) return 0;
    const { tier, veterans, hall } = data.pending;
    data.pending = null;
    save();
    // Hall entries arrive as fallen: the player rebuilds the Hall and pays to raise them.
    if (hall?.length && typeof Veterans !== 'undefined' && Veterans.importHall) {
      Veterans.importHall(hall);
      ctx.showMessage?.(
        `New Game+ ${tier}: the host is stronger. ${hall.length} names wait in the Hall of Veterans.`,
        360
      );
      return tier;
    }
    let placed = 0;
    for (const v of veterans || []) {
      const u = ctx.spawnUnit(v.type, 140 + placed * 60, ctx.deployY, 'player');
      if (!u) continue;
      u.vetTier = v.vetTier;
      if (typeof syncVeteranStatsToTier === 'function') syncVeteranStatsToTier(u);
      u.hp = u.maxHp;
      u.kills = v.kills || 0;
      if (v.name) u.honorName = v.name;
      u.ngPlusVeteran = true;
      u.targetY = ctx.rallyY;
      ctx.pushUnit(u);
      placed++;
    }
    ctx.showMessage?.(
      `New Game+ ${tier}: the host is stronger.${placed ? ` ${placed} veteran${placed === 1 ? '' : 's'} march with you again.` : ''}`,
      360
    );
    return tier;
  }

  /**
   * The victory choice. Closing the dialog (Escape) keeps playing, so a stray key never
   * ends the run.
   */
  function offerVictoryChoice({ tier, onContinue, onNewGamePlus }) {
    const next = clampTier((tier || 0) + 1);
    const ngLine =
      next > (tier || 0)
        ? `New Game+ ${next}: end this run as a victory and start again with your ${CARRY_VETERANS} best veterans against a stronger host.`
        : 'New Game+ is at its highest tier.';
    const text = `Wave 100 is cleared and the realm stands.\n\nContinue: fight on in this run. The host keeps growing and the score is marked as an endless run.\n\n${ngLine}`;
    if (typeof InPageDialog === 'undefined') {
      onContinue();
      return Promise.resolve('continue');
    }
    return InPageDialog.confirm(text, {
      title: 'Victory',
      okLabel: next > (tier || 0) ? `New Game+ ${next}` : 'Continue',
      cancelLabel: next > (tier || 0) ? 'Continue' : null,
    }).then((pickedNg) => {
      if (pickedNg && next > (tier || 0)) {
        onNewGamePlus();
        return 'ngplus';
      }
      onContinue();
      return 'continue';
    });
  }

  load();

  return {
    MAX_TIER,
    CARRY_VETERANS,
    load,
    enemyMods,
    scoreModifier,
    label,
    pickVeterans,
    queue,
    getPending,
    clearPending,
    getBestTier,
    applyRunStart,
    offerVictoryChoice,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.NewGamePlus = NewGamePlus;
