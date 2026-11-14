/**
 * Availability — can this troop, building, spell or message be used right now, and if not,
 * why. One answer for the button (dimmed or not), the click, the hotkey and the tooltip.
 *
 * Also the one reading of Tactical Points for the HUD: tp() is the live number the game
 * spends from, never a cached snapshot, and renderTp() writes it to the TP number and bar.
 */
const Availability = (() => {
  const OK = Object.freeze({ ok: true, reason: '', locked: false });

  function state() {
    return typeof Game !== 'undefined' && Game.getState ? Game.getState() : {};
  }

  /** Tactical Points owned this instant: the same variable every purchase is charged to. */
  function tp(gs) {
    if (typeof Game !== 'undefined' && typeof Game.getTactical === 'function') {
      const v = Game.getTactical();
      if (Number.isFinite(v)) return v;
    }
    const s = gs || state();
    return Number.isFinite(s.tactical) ? s.tactical : 0;
  }

  /** TP as the player reads it. TP is kept whole, so this is the amount owned. */
  function tpShown(gs) {
    return Math.floor(tp(gs) + 1e-9);
  }

  function freeTp(gs) {
    return !!(gs && gs.creativeMode && gs.creativeSettings && gs.creativeSettings.freeResources);
  }

  function blocked(reason, locked = false, extra = null) {
    return { ok: false, reason, locked, ...(extra || {}) };
  }

  function costReason(cost, gs) {
    return `needs ${cost} TP, you have ${tpShown(gs)}`;
  }

  /** Name of the research node that unlocks a troop ("deploy") or a building ("build"). */
  function researchNeed(field, id) {
    if (typeof Research === 'undefined' || !Array.isArray(Research.ALL_NODES)) return '';
    const node = Research.ALL_NODES.find((n) => Array.isArray(n[field]) && n[field].includes(id));
    return node ? node.name : '';
  }

  // ---- prices (what is charged) ---------------------------------------------------------
  function deployCost(type, gs) {
    if (freeTp(gs)) return 0;
    if (typeof Game !== 'undefined' && Game.getDeployCost) return Game.getDeployCost(type);
    const def =
      (typeof getPlayerUnitDef === 'function' && getPlayerUnitDef(type)) || UnitDefs[type];
    return def && Number.isFinite(def.cost) ? def.cost : 0;
  }

  /**
   * How a recruit's price is made up: base price, the army-upkeep surcharge (7% a head past
   * 14 soldiers) and the Warband doubling. `total` is Game.getDeployCost, the amount charged;
   * edicts, difficulty and research do not change recruit prices.
   */
  function deployPrice(type, gs = state()) {
    const def =
      (typeof getPlayerUnitDef === 'function' && getPlayerUnitDef(type)) || UnitDefs[type];
    const base = def && Number.isFinite(def.cost) ? def.cost : 0;
    const total = deployCost(type, gs);
    const warband = !!gs?.siegeLoop?.warband && !freeTp(gs);
    const mode = warband ? 2 : 1;
    const mult = freeTp(gs)
      ? 1
      : typeof Game !== 'undefined' && Game.getDeployCostMult
        ? Game.getDeployCostMult()
        : typeof SiegeLoop !== 'undefined'
          ? SiegeLoop.deployCostMult(gs?.army || 0)
          : 1;
    const upkeepPct = Math.max(0, Math.round((mult / mode - 1) * 100));
    return { base, upkeepPct, warband, total, raised: total > base };
  }

  /** "5 TP = 3 base +67% army upkeep" (or just "3 TP" when nothing raises it). */
  function deployPriceText(type, gs = state()) {
    const p = deployPrice(type, gs);
    if (freeTp(gs)) return 'Free (Creative)';
    if (!p.raised) return `${p.total} TP`;
    const parts = [`${p.base} base`];
    if (p.upkeepPct > 0) parts.push(`+${p.upkeepPct}% army upkeep`);
    if (p.warband) parts.push('×2 Warband');
    return `${p.total} TP = ${parts.join(' ')}`;
  }

  function abilityCost(id, gs) {
    if (freeTp(gs)) return 0;
    const base = Abilities[id]?.cost ?? 0;
    return typeof ContentExpansion !== 'undefined' && ContentExpansion.getAbilityCost
      ? ContentExpansion.getAbilityCost(id, base, gs?.wave ?? 0)
      : base;
  }

  function buildCost(type, gs) {
    if (freeTp(gs)) return 0;
    const def = typeof BuildDefs !== 'undefined' ? BuildDefs[type] : null;
    return def && Number.isFinite(def.cost) ? def.cost : 0;
  }

  /**
   * Price of a priced off-field action, read from the same rule the game charges by
   * (wave growth, repeat-use growth, army upkeep). Falls back to the action's listed cost.
   */
  function ruleCost(kind, id, listed, gs) {
    if (typeof EconomyRules === 'undefined') return listed;
    const s = gs || state();
    const upkeepMult =
      typeof Game !== 'undefined' && Game.getDeployCostMult ? Game.getDeployCostMult() : 1;
    const cost = EconomyRules.getCost(`${kind}:${id}`, { wave: s.wave || 0, upkeepMult });
    return cost == null ? listed : cost;
  }

  /** Waves left before a spy action or courier message with a cooldown is ready again. */
  function cooldownLeft(kind, id, gs) {
    if (typeof EconomyRules === 'undefined') return 0;
    return EconomyRules.cooldownLeft(`${kind}:${id}`, (gs || state()).wave || 0);
  }

  function waitReason(n) {
    return `ready again in ${n} wave${n === 1 ? '' : 's'}`;
  }

  function spyCost(id, gs) {
    const base = ruleCost('spy', id, SpyActions[id]?.cost ?? 0, gs);
    return typeof ContentExpansion !== 'undefined' && ContentExpansion.getSpyCost
      ? ContentExpansion.getSpyCost(id, base)
      : base;
  }

  function courierCost(id, gs) {
    const base = ruleCost('courier', id, CourierMessages[id]?.cost ?? 0, gs);
    return typeof ContentExpansion !== 'undefined' && ContentExpansion.getCourierCost
      ? ContentExpansion.getCourierCost(id, base)
      : base;
  }

  // ---- rules ----------------------------------------------------------------------------
  function deploy(type, gs = state()) {
    const def =
      (typeof getPlayerUnitDef === 'function' && getPlayerUnitDef(type)) || UnitDefs[type];
    if (!def) return blocked('not available', true);
    const cost = deployCost(type, gs);
    const special = type === 'doomslayer_hero';
    if (!special && gs.creativeMode && gs.creativeSettings && !gs.creativeSettings.academyDeploy) {
      return blocked('recruiting is switched off in the Creative Lab', true, { cost });
    }
    if (special && !gs.doomslayerUnlocked) {
      return blocked('needs Hellgate Containment, or wave 200 on Hellbane', true, { cost });
    }
    const unlocked =
      gs.creativeMode ||
      typeof Research === 'undefined' ||
      Research.isDeployUnlocked(type, {
        creativeUnlockAll: gs.creativeMode && gs.creativeSettings?.unlockAll,
        doomMetaUnlocked: gs.doomslayerUnlocked,
      });
    if (!unlocked) {
      const need = researchNeed('deploy', type);
      return blocked(need ? `needs ${need}` : 'needs research', true, { cost, research: true });
    }
    if (type === 'general' && gs.hasGeneral) {
      return blocked('a General is already on the field', false, { cost });
    }
    if (tp(gs) < cost) return blocked(costReason(cost, gs), false, { cost, tp: true });
    return { ...OK, cost };
  }

  function ability(id, gs = state()) {
    const ab = Abilities[id];
    if (!ab) return blocked('not available', true);
    const cost = abilityCost(id, gs);
    if (ab.dragonStrike) {
      const pact =
        (gs.creativeMode && gs.creativeSettings?.unlockAll) ||
        (typeof MetaProgress !== 'undefined' && MetaProgress.isTesUnlocked?.());
      if (!pact) return blocked('needs the Voicebound Pact', true, { cost });
    }
    if (id === 'reinforce' && gs.gameMode?.noReinforceStrike) {
      return blocked('switched off by this challenge', true, { cost });
    }
    if ((id === 'dispel' || ab.requiresMage) && (gs.mageCount || 0) <= 0) {
      return blocked('needs a living Mage', false, { cost });
    }
    if (tp(gs) < cost) return blocked(costReason(cost, gs), false, { cost, tp: true });
    return { ...OK, cost };
  }

  function build(type, gs = state()) {
    const def = typeof BuildDefs !== 'undefined' ? BuildDefs[type] : null;
    if (!def) return blocked('not available', true);
    const cost = buildCost(type, gs);
    const isAcademy = def.isAcademy && !def.isCrossoverBarracks && !def.isWweAcademy;
    const unlocked =
      gs.creativeMode ||
      typeof Research === 'undefined' ||
      Research.isBuildUnlocked(type, {
        creativeUnlockAll: gs.creativeMode && gs.creativeSettings?.unlockAll,
        perksMetaUnlocked: gs.perksUnlocked,
      });
    let mentorOk = true;
    let mentorReason = '';
    if (!gs.creativeMode && isAcademy) {
      if (typeof Game !== 'undefined' && Game.getAcademyBuildStatus) {
        const st = Game.getAcademyBuildStatus(type);
        mentorOk = !!st?.mentorOk;
        const who = st?.mentorName || def.academyUnit || 'veteran';
        mentorReason = `needs an Immortal ${who} on the field`;
      } else if (gs.buildableAcademies) {
        mentorOk = gs.buildableAcademies.includes(type);
        mentorReason = 'needs an Immortal veteran of that troop on the field';
      }
    }
    if (!mentorOk) return blocked(mentorReason, true, { cost, mentor: true, research: !unlocked });
    if (!unlocked) {
      const perkNode = def.isPerkMachine
        ? Research.ALL_NODES?.find((n) => n.id === 'perk_science')?.name
        : '';
      const need = perkNode || researchNeed('build', type);
      return blocked(need ? `needs ${need}` : 'needs research', true, {
        cost,
        research: true,
        mentorReady: isAcademy,
      });
    }
    if (
      !(gs.creativeMode && gs.creativeSettings?.instantBuild) &&
      def.requiresBuilders &&
      (gs.liveBuilders ?? 0) < def.requiresBuilders
    ) {
      const n = def.requiresBuilders;
      return blocked(`needs ${n} living Builder${n === 1 ? '' : 's'}`, false, { cost });
    }
    if (tp(gs) < cost) return blocked(costReason(cost, gs), false, { cost, tp: true });
    return { ...OK, cost };
  }

  function stageName(stage) {
    return typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
      ? KINGDOM_EVOLUTION_STAGES[stage]?.name || 'a later stage'
      : `stage ${stage}`;
  }

  function spy(id, gs = state()) {
    const def = SpyActions[id];
    if (!def) return blocked('not available', true);
    const cost = spyCost(id, gs);
    const waveMin = def.waveMin || 0;
    if (waveMin > 0 && (gs.wave || 0) < waveMin) {
      return blocked(`opens at wave ${waveMin}`, true, { cost, kingdom: true });
    }
    const stage = def.kingdomStage || 0;
    if (stage > 0 && (gs.kingdomStage || 1) < stage) {
      return blocked(`opens in ${stageName(stage)}`, true, { cost, kingdom: true });
    }
    const wait = cooldownLeft('spy', id, gs);
    if (wait > 0) return blocked(waitReason(wait), false, { cost, wait });
    if (gs.spyUsedThisWave) {
      return blocked('the spy network was already used this wave', false, { cost, wait: 1 });
    }
    if (tp(gs) < cost) return blocked(costReason(cost, gs), false, { cost, tp: true });
    return { ...OK, cost };
  }

  function courier(id, gs = state()) {
    const def = CourierMessages[id];
    if (!def) return blocked('not available', true);
    const cost = courierCost(id, gs);
    const stage = def.kingdomStage || 0;
    if (stage > 0 && (gs.kingdomStage || 1) < stage) {
      return blocked(`opens in ${stageName(stage)}`, true, { cost, kingdom: true });
    }
    const wait = cooldownLeft('courier', id, gs);
    if (wait > 0) return blocked(waitReason(wait), false, { cost, wait });
    if (!gs.hasCourier) return blocked('needs a living Courier', false, { cost });
    const cap = Math.max(1, gs.courierMessagesPerWave || 1);
    if ((gs.courierMessagesUsedThisWave || 0) >= cap) {
      return blocked('the Courier has already ridden this wave', false, { cost, wait: 1 });
    }
    if (gs.courierCooldown > 0) return blocked('the Courier is still riding', false, { cost });
    if (tp(gs) < cost) return blocked(costReason(cost, gs), false, { cost, tp: true });
    return { ...OK, cost };
  }

  const RULES = { deploy, ability, build, spy, courier };

  /** @returns {{ ok: boolean, reason: string, locked: boolean, cost?: number }} */
  function check(kind, id, gs = state()) {
    const rule = RULES[kind];
    return rule ? rule(id, gs) : blocked('not available', true);
  }

  function nameOf(kind, id) {
    if (kind === 'deploy') {
      const def = (typeof getPlayerUnitDef === 'function' && getPlayerUnitDef(id)) || UnitDefs[id];
      return def?.name || id;
    }
    if (kind === 'ability') return Abilities[id]?.name || id;
    if (kind === 'build') return BuildDefs[id]?.name || id;
    if (kind === 'spy') return SpyActions[id]?.name || id;
    if (kind === 'courier') return CourierMessages[id]?.name || id;
    return id;
  }

  /** What is armed for placement right now: { kind, id } or null. */
  function armed(gs = state()) {
    if (gs.selectedDeploy) return { kind: 'deploy', id: gs.selectedDeploy };
    if (gs.selectedBuild) return { kind: 'build', id: gs.selectedBuild };
    if (gs.selectedAbility) return { kind: 'ability', id: gs.selectedAbility };
    return null;
  }

  /**
   * The only way the panel buttons and the hotkeys select or use something. An unavailable
   * item is refused with its reason; nothing is selected. Pressing the armed item again
   * always puts it away.
   */
  function trySelect(kind, id) {
    if (typeof Game === 'undefined') return blocked('not available', true);
    const gs = state();
    const now = armed(gs);
    const isArmed = !!now && now.kind === kind && now.id === id;
    const res = isArmed ? { ...OK } : check(kind, id, gs);
    if (!res.ok) {
      // The answer to a click must not wait behind other messages.
      Game.showMessage?.(`${nameOf(kind, id)} — ${res.reason}.`, 200, {
        priority: 'critical',
        bypassQueue: true,
      });
      if (typeof AudioEngine !== 'undefined') AudioEngine.SFX?.error?.();
      return res;
    }
    if (kind === 'deploy') Game.selectDeploy(id);
    else if (kind === 'ability') Game.selectAbility(id);
    else if (kind === 'build') Game.selectBuild(id);
    else if (kind === 'spy') Game.executeSpyAction(id);
    else if (kind === 'courier') Game.sendCourierMessage(id);
    return res;
  }

  /**
   * An armed item that has stopped being available (the last TP was spent, the Mage fell)
   * is put away, so nothing unavailable ever stays selected. Returns the reason, or ''.
   */
  function dropUnavailableSelection(gs = state()) {
    const now = armed(gs);
    if (!now || typeof Game === 'undefined') return '';
    const res = check(now.kind, now.id, gs);
    if (res.ok) return '';
    Game.clearPlacementMode?.();
    Game.showMessage?.(`${nameOf(now.kind, now.id)} put away — ${res.reason}.`, 200, {
      priority: 'critical',
      bypassQueue: true,
    });
    return res.reason;
  }

  // ---- the TP number and bar --------------------------------------------------------------
  /**
   * What a full TP bar means: enough to pay for the dearest thing on offer (never under 24).
   * @param {number[]} prices prices of everything currently unlocked
   */
  function tpBarMax(prices) {
    let max = 24;
    for (const p of prices || []) if (Number.isFinite(p) && p > max) max = p;
    return max;
  }

  /**
   * Write owned TP to the HUD number and bar. Called on every HUD refresh, paused or not,
   * so the number can never fall behind the purse.
   * @param {{ text?: { textContent: string }, fill?: { style: { width: string } } }} els
   */
  function renderTp(els, gs, barMax) {
    const owned = tpShown(gs);
    const text = String(owned);
    if (els?.text && els.text.textContent !== text) els.text.textContent = text;
    if (els?.fill) {
      const max = Math.max(1, barMax || 24);
      const width = `${Math.round(Math.min(100, (owned / max) * 100))}%`;
      if (els.fill.style.width !== width) els.fill.style.width = width;
    }
    return owned;
  }

  return {
    tp,
    tpShown,
    check,
    deploy,
    ability,
    build,
    spy,
    courier,
    deployCost,
    deployPrice,
    deployPriceText,
    abilityCost,
    buildCost,
    spyCost,
    courierCost,
    armed,
    trySelect,
    dropUnavailableSelection,
    tpBarMax,
    renderTp,
    nameOf,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Availability = Availability;
