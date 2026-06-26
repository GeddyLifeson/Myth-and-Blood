/**
 * In-game HUD tooltips — rich descriptions for panels and top bar.
 */
const Tooltips = (() => {
  let el = null;
  let anchor = null;
  let hideTimer = null;

  const BUILD_NOTES = {
    outpost: 'Forward cover with one garrison slot. Archers inside gain +55 range.',
    wall: 'Blocks movement. Two footman wall slots per segment when a General commands the Keep. Press R while placing to set facing.',
    castle: 'Compound: 4 walls, 4 outposts, Keep, med tent, and mess hall — your command center.',
    medical_tent: 'Wounded allies below 38% HP retreat here instead of fighting to death.',
    mess_hall: 'Morale aura for nearby troops — stacks with bards and rallies.',
    watchtower: 'Reveals stealth and burrowers. Enemies in range suffer accuracy penalties.',
    spike_trap: 'Hidden spikes — first enemy crossing each cooldown takes heavy damage.',
    quarry: '30 TP, 2 Builders. +1 TP/round (shared 6-site cap with trade posts). Blocks movement.',
    trade_outpost: '38 TP, 2 Builders. +1 TP/round plus morale aura. Counts toward the 6-site economy cap.',
    fortress_upgrade: 'Place on a completed hamlet: +HP, cover, and +1 TP/round.',
    hamlet: '100 TP, 5 Builders, 5-wave build. +5 TP/round. Huge and siegeable — wall it in early.',
    merchant_guild: '150 TP, 5 Builders. +1 TP/round per guild in hamlet aura. Enemy RTS priority target.',
    castle_keep: 'Station your General here to activate command aura and man castle walls.',
  };

  const UNIT_NOTES = {
    footman: 'Cheap melee line-holder. Garrisons walls under General command. Earns combat stars from kills.',
    archer: 'Long-range DPS. Garrison outposts for extended range. Keep behind cover.',
    mage: 'Arcane bolts with splash. Strong vs clustered swarms.',
    cavalry: 'Fast melee with charge bonus. Hunts stragglers and flanks.',
    healer: 'Heals allies in range — including other healers. Retreats to med tents when wounded. Ranks when healing each wave.',
    knight: 'Heavy armored melee with damage resistance. Banner courier can summon one.',
    sapper: 'Bonus siege damage (×2.5) vs walls and siege engines.',
    scout: 'Fast skirmisher with stealth detection. Pair with watchtowers.',
    bard: 'Morale aura support — keeps nearby allies inspired.',
    ballista: 'Long-range siege. Bonus vs flying foes and siege targets.',
    pikeman: 'Anti-cavalry and anti-air melee. Cheap line holder.',
    builder: 'Erects structures within build range. Auto-repair toggle in meta panel.',
    courier: 'Dispatches one royal message per wave. Must be alive on the field.',
    general: 'Command aura buffs nearby troops. Auto-paths to Keep; mans castle walls.',
    doomslayer_hero: 'Legend unlocked at wave 200 on Doomslayer difficulty. One per field.',
  };

  const ACADEMY_NOTE = 'Academy Era — requires a max-rank (Immortal) mentor of that unit type on the field. Trains one free unit each round (Builder/Courier academies train while only the mentor is on the field).';

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtCost(cost, freeTp) {
    if (freeTp) return 'Free (Creative)';
    return cost === 0 ? 'No TP cost' : `${cost} TP`;
  }

  function abilityDesc(id, ab) {
    if (ab.healAmount) return `Heals ${ab.healAmount} HP in radius ${ab.radius}.`;
    if (ab.units) return `Spawns ${ab.units.length} troops at the target.`;
    if (ab.moraleBoost) return `+${ab.moraleBoost} morale to allies for ${Math.round(ab.duration / 60)}s.`;
    if (ab.slowDuration) return `${ab.damage} damage and slow in radius ${ab.radius}.`;
    if (ab.revealDuration) return `Reveals hidden enemies in radius ${ab.radius}.`;
    if (ab.mitigation) return `${Math.round(ab.mitigation * 100)}% damage reduction in zone for ${Math.round(ab.duration / 60)}s.`;
    if (ab.damage) return `${ab.damage} damage in radius ${ab.radius}.`;
    return 'Tactical strike — click the map to cast.';
  }

  function unitStats(def) {
    if (!def) return '';
    const parts = [`HP ${def.hp}`];
    if (def.damage > 0) parts.push(`DMG ${def.damage}`);
    if (def.range > 40) parts.push(`RNG ${def.range}`);
    if (def.type) parts.push(def.type);
    return parts.join(' · ');
  }

  function getDeployTip(type, gs) {
    const def = getPlayerUnitDef(type) || UnitDefs[type];
    if (!def) return null;
    const freeTp = gs?.creativeMode && gs?.creativeSettings?.freeResources;
    const costMult = typeof getDeployCostMult === 'function' ? getDeployCostMult() : 1;
    const cost = freeTp ? 0 : Math.ceil((def.cost ?? 0) * costMult);
    const note = UNIT_NOTES[type] || `${def.name} — deploy onto the rally field.`;
    let footer = fmtCost(cost, freeTp);
    if (type === 'general' && gs?.hasGeneral) footer += ' · Already on field';
    if (type === 'doomslayer_hero' && !gs?.doomslayerUnlocked) footer += ' · Locked';
    return { title: def.name, body: `${note} ${unitStats(def)}`, footer };
  }

  function getBuildTip(type, gs) {
    const def = BuildDefs[type];
    if (!def) return null;
    const freeTp = gs?.creativeMode && gs?.creativeSettings?.freeResources;
    let body = BUILD_NOTES[type];
    if (!body && def.isAcademy) {
      const mentor = typeof getAcademyMentorUnitType === 'function'
        ? getAcademyMentorUnitType(type)
        : (def.academyUnit || type.replace('academy_', ''));
      const mentorName = getPlayerUnitDef(mentor)?.name || mentor;
      const rank = typeof getMaxVeteranRankName === 'function' ? getMaxVeteranRankName(mentor) : 'Immortal';
      body = `${ACADEMY_NOTE} Mentor: max-rank ${mentorName} (${rank}). Trains: ${def.academyUnit || mentor}.`;
    } else if (!body && def.isPerkMachine) {
      const perk = PerkDefs?.[def.perkId];
      body = perk ? `${perk.desc} Heroes collect at night (max 4 perks).` : 'Perk-a-Cola machine for roster heroes.';
    } else if (!body) {
      body = `Build time ${def.buildTime} ticks.`;
    }
    if (def.requiresBuilders) body += ` Requires ${def.requiresBuilders} live Builders.`;
    let footer = fmtCost(def.cost ?? 0, freeTp);
    if (def.isPerkMachine && !gs?.perksUnlocked) footer += ' · Unlock roster cheat first';
    return { title: def.name, body, footer };
  }

  function getAbilityTip(id, gs) {
    const ab = Abilities[id];
    if (!ab) return null;
    const freeTp = gs?.creativeMode && gs?.creativeSettings?.freeResources;
    const base = ab.cost ?? 0;
    const cost = freeTp ? 0
      : (typeof ContentExpansion !== 'undefined' && ContentExpansion.getAbilityCost
        ? ContentExpansion.getAbilityCost(id, base, gs?.wave ?? 0)
        : base);
    return {
      title: ab.name,
      body: abilityDesc(id, ab),
      footer: fmtCost(cost, freeTp) + ' · Click map to strike',
    };
  }

  function getSpyTip(id, gs) {
    const def = SpyActions[id];
    if (!def) return null;
    const base = def.cost ?? 0;
    const cost = typeof ContentExpansion !== 'undefined'
      ? ContentExpansion.getSpyCost(id, base)
      : base;
    let footer = `${cost} TP · One action per wave`;
    if (gs?.spyUsedThisWave) footer += ' · Used this wave';
    if (gs?.tactical < cost) footer += ' · Not enough TP';
    return { title: def.name, body: def.desc, footer };
  }

  function getCourierTip(id, gs) {
    const def = CourierMessages[id];
    if (!def) return null;
    const base = def.cost ?? 0;
    const cost = typeof ContentExpansion !== 'undefined'
      ? ContentExpansion.getCourierCost(id, base)
      : base;
    let footer = `${cost} TP · One message per wave`;
    if (!gs?.hasCourier) footer += ' · Need live Courier';
    if (gs?.courierUsedThisWave) footer += ' · Used this wave';
    if (gs?.courierCooldown > 0) footer += ` · Cooldown ${gs.courierCooldown}`;
    return { title: def.name, body: def.desc, footer };
  }

  function getLoadoutTip(id) {
    const lo = typeof ContentExpansion !== 'undefined' ? ContentExpansion.getLoadouts()?.[id] : null;
    if (!lo) return null;
    return {
      title: lo.label,
      body: lo.desc,
      footer: 'Wave 100+ · Applies to academy-trained troops',
    };
  }

  function getMetaTip(id, gs) {
    const tips = {
      'demolish-btn': {
        title: 'Demolish',
        body: 'Remove a completed player structure. Refunds 50% of its build cost in TP.',
        footer: 'Click structure · Esc to cancel',
      },
      'move-building-btn': {
        title: 'Move Building',
        body: 'Relocate a completed structure for free. Garrisoned troops and stationed General move with it.',
        footer: 'Click structure, then destination · Esc to cancel',
      },
      'rotate-wall-btn': {
        title: 'Rotate Wall',
        body: 'Turn a completed wall 90° clockwise. Wall-garrisoned footmen and cover direction update with it.',
        footer: 'Click wall · Free · Esc to cancel',
      },
      'hunt-toggle': {
        title: 'Global Hunt',
        body: `All hunt-capable troops ${gs?.globalHunt ? 'actively pursue' : 'hold position unless'} enemies.`,
        footer: 'Hotkey: H',
      },
      'builder-repair-toggle': {
        title: 'Builder Auto-Repair',
        body: `Builders ${gs?.builderAutoRepair ? 'automatically repair' : 'ignore'} damaged structures when idle.`,
        footer: 'Toggle anytime',
      },
      'speed-toggle': {
        title: 'Game Speed',
        body: `Simulation runs at ${gs?.gameSpeed ?? 1}×. Click to cycle 1× → 1.5× → 2× → 3× → 4×.`,
        footer: 'Hotkey: ] · Paused always runs 1×',
      },
      'wwe-academy-open': {
        title: 'WWE Academy',
        body: 'Recruit squared-circle superstars from your academy roster.',
        footer: 'Requires WWE Academy on field',
      },
      'crossover-hub-open': {
        title: 'Crossover HQ',
        body: 'Recruit operatives from unlocked crossover factions.',
        footer: 'Requires crossover barracks on field',
      },
    };
    return tips[id] || null;
  }

  function getTopBarTip(target, gs) {
    const group = target.closest?.('.stat-group');
    if (!group) return null;
    const label = group.querySelector('.stat-label')?.textContent?.trim();
    if (label === 'TACTICAL PTS') {
      return {
        title: 'Tactical Points',
        body: 'Spend TP to deploy troops, build, strike, spy, and courier. Refills each round.',
        footer: `Current: ${Math.floor(gs?.tactical ?? 0)} TP`,
      };
    }
    if (label === 'MISSES') {
      return {
        title: 'Breakthroughs',
        body: 'Enemies reaching your deploy line count as misses. Too many ends the run.',
        footer: `${gs?.misses ?? 0} / ${gs?.missLimit ?? 10}`,
      };
    }
    if (label === 'TP/ROUND') {
      const eco = gs?.settlementTpBonus ?? 0;
      return {
        title: 'TP Per Round',
        body: 'Base income each round. Hamlets, guilds, quarries, and trade posts increase it.',
        footer: eco > 0 ? `+${gs?.tpPerRound ?? 8} (${eco} settlement bonus)` : `+${gs?.tpPerRound ?? 8}`,
      };
    }
    if (label === 'WAVE') {
      return {
        title: 'Wave',
        body: 'Assault wave counter. Territory expands every 10 waves.',
        footer: gs?.timeOfDay === 'night' ? 'Night prep — press D or BEGIN DAY' : 'Day — enemies attacking',
      };
    }
    if (label === 'CYCLE') {
      return {
        title: 'Day / Night Cycle',
        body: 'Night: build and reposition (+35% builder speed). Day: enemy assault.',
        footer: gs?.timeOfDay === 'night' ? `Night (${gs?.nightSecondsLeft ?? 0}s left)` : 'Day assault active',
      };
    }
    if (label === 'ARMY') {
      return {
        title: 'Army Size',
        body: 'Living player troops on the field.',
        footer: `${gs?.army ?? 0} units`,
      };
    }
    if (label === 'COMMAND') {
      return {
        title: 'General Command',
        body: 'Aura strength when General is stationed in Keep. Marching General shows → KEEP.',
        footer: gs?.generalBuff > 0 ? `Aura +${gs.generalBuff}%` : (gs?.hasGeneral ? 'General not stationed' : 'No General'),
      };
    }
    if (label === 'THREAT') {
      return {
        title: 'Threat Intel',
        body: 'This wave\'s active flanks (random subset of unlocked sides). Also shows general threat, boss, and last-stand flags.',
        footer: (gs?.attackSides || ['north']).join(', '),
      };
    }
    if (label === 'INTEL') {
      return {
        title: 'Wave Intel',
        body: 'Scout or infiltrate spy actions reveal exact next-wave roster here.',
        footer: gs?.nextWaveIntel || 'No intel — use Scout Report',
      };
    }
    if (label === 'SYN') {
      return {
        title: 'Faction Synergies',
        body: 'Active crossover/WWE synergy bonuses and seasonal events.',
        footer: (gs?.factionSynergies || []).join(', ') || '—',
      };
    }
    if (label === 'DIFF') {
      return {
        title: 'Difficulty',
        body: 'Effective difficulty scales enemy HP, count, and TP economy.',
        footer: `${gs?.difficultyLabel ?? 'Normal'} · ${gs?.difficultyPercent ?? 100}%`,
      };
    }
    const btnTips = {
      'top-pause-btn': { title: 'Pause', body: 'Pause menu — resume, settings, encyclopedia, quit.', footer: 'Esc or Space' },
      'top-settings-btn': { title: 'Settings', body: 'Audio, graphics, UI scale, accessibility.', footer: 'Click to open' },
      'sound-toggle': { title: 'Sound', body: 'Toggle music and SFX.', footer: 'Hotkey: V' },
      'encyclopedia-btn': { title: 'Encyclopedia', body: 'Lore, bestiary, buildings, orders, and classified entries.', footer: 'Hotkey: I' },
      'achievements-btn': { title: 'Achievements', body: '316 Club milestones and run tracking.', footer: 'Hotkey: A' },
      'creative-panel-toggle': { title: 'Creative Lab', body: 'Sandbox playtest — free TP, custom waves, spawn tools.', footer: 'Hotkey: P' },
      'perf-toggle': { title: 'Performance', body: 'Frame time and draw stats overlay.', footer: 'Hotkey: F3' },

      'begin-day-btn': { title: 'Begin Day', body: 'End night prep and start the assault immediately.', footer: 'Hotkey: D' },
      'hint-log-btn': { title: 'Message Log', body: 'Scrollable history of battle messages.', footer: 'Tab also opens log' },
    };
    const id = target.id || target.closest?.('[id]')?.id;
    return btnTips[id] || null;
  }

  function positionTooltip() {
    if (!el || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const pad = 8;
    let left = rect.right + pad;
    let top = rect.top;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    const tr = el.getBoundingClientRect();
    if (tr.right > window.innerWidth - pad) {
      left = rect.left - tr.width - pad;
      el.style.left = `${Math.max(pad, left)}px`;
    }
    if (tr.bottom > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - tr.height - pad);
      el.style.top = `${top}px`;
    }
  }

  function showTip(tip) {
    if (!el || !tip) return;
    clearTimeout(hideTimer);
    el.innerHTML =
      `<div class="game-tooltip-title">${esc(tip.title)}</div>` +
      `<div class="game-tooltip-body">${esc(tip.body)}</div>` +
      (tip.footer ? `<div class="game-tooltip-footer">${esc(tip.footer)}</div>` : '');
    el.hidden = false;
    el.classList.add('visible');
    requestAnimationFrame(positionTooltip);
  }

  function hide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!el) return;
      el.hidden = true;
      el.classList.remove('visible');
      anchor = null;
    }, 80);
  }

  function bindHover(node, getTip) {
    if (!node || node.dataset.tooltipBound) return;
    node.dataset.tooltipBound = '1';
    node.addEventListener('mouseenter', () => {
      const gs = typeof Game !== 'undefined' && Game.isPlaying?.() ? Game.getState() : null;
      const tip = getTip(gs);
      if (!tip) return;
      anchor = node;
      showTip(tip);
    });
    node.addEventListener('mouseleave', hide);
    node.addEventListener('mousedown', hide);
  }

  function bindHudTooltips() {
    document.querySelectorAll('.deploy-btn').forEach(btn => {
      bindHover(btn, (gs) => getDeployTip(btn.dataset.unit, gs));
    });
    document.querySelectorAll('.build-btn').forEach(btn => {
      bindHover(btn, (gs) => getBuildTip(btn.dataset.build, gs));
    });
    document.querySelectorAll('.ability-btn').forEach(btn => {
      bindHover(btn, (gs) => getAbilityTip(btn.dataset.ability, gs));
    });
    document.querySelectorAll('.spy-btn').forEach(btn => {
      bindHover(btn, (gs) => getSpyTip(btn.dataset.spy, gs));
    });
    document.querySelectorAll('.courier-btn').forEach(btn => {
      bindHover(btn, (gs) => getCourierTip(btn.dataset.courier, gs));
    });
    document.querySelectorAll('.loadout-btn').forEach(btn => {
      bindHover(btn, () => getLoadoutTip(btn.dataset.loadout));
    });
    ['demolish-btn', 'move-building-btn', 'rotate-wall-btn', 'hunt-toggle', 'builder-repair-toggle',
      'speed-toggle', 'wwe-academy-open', 'crossover-hub-open'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) bindHover(btn, (gs) => getMetaTip(id, gs));
    });
    const topBar = document.getElementById('top-bar');
    if (topBar) {
      topBar.querySelectorAll('.stat-group, .pause-top-btn, .settings-top-btn, .sound-top-btn, ' +
        '.ency-top-btn, .ach-top-btn, .creative-top-btn, .perf-top-btn, #begin-day-btn').forEach(node => {
        bindHover(node, (gs) => getTopBarTip(node, gs));
      });
    }
    const hintBtn = document.getElementById('hint-log-btn');
    if (hintBtn) bindHover(hintBtn, (gs) => getTopBarTip(hintBtn, gs));

    const panelTips = {
      TROOPS: { title: 'Troops', body: 'Deploy combat units onto the rally field. Costs scale after wave 100.', footer: 'Shift+click to add to selection' },
      SPECIALISTS: { title: 'Specialists', body: 'Builder erects structures; Courier sends one royal message per wave.', footer: 'Both essential for economy and construction' },
      BUILD: { title: 'Build', body: 'Place structures via Builder. Settlements need multiple builders and wide ground.', footer: 'Click build, then click map' },
      ACADEMIES: { title: 'Academies', body: 'Training halls available from wave 1. Each produces one free unit per round when complete (needs max-rank mentor).', footer: 'Works alongside TP deploy' },
      STRIKES: { title: 'Strikes', body: 'One-shot tactical abilities — damage, heal, reinforce, or buff.', footer: 'Click strike, then click map target' },
      'SPY NETWORK': { title: 'Spy Network', body: 'One covert action per wave. Scout and Infiltrate reveal exact next-wave roster.', footer: 'Costs TP immediately' },
      'COURIER MSGS': { title: 'Courier Messages', body: 'One dispatch per wave while a live Courier is on the field.', footer: 'Click message, then click map' },
      LOADOUT: { title: 'Loadouts', body: 'Passive bonuses applied to newly deployed and academy-trained troops.', footer: 'Press Z for Balanced loadout' },
      'PERK-A-COLA': { title: 'Perk-a-Cola', body: 'Machines grant perks to WWE, crossover, and General heroes at night.', footer: 'Max 4 perks per hero' },
    };
    document.querySelectorAll('.panel-header').forEach(hdr => {
      const key = hdr.textContent?.trim();
      const tip = panelTips[key];
      if (tip) bindHover(hdr, () => tip);
    });
    document.querySelectorAll('.panel-hint').forEach(hint => {
      bindHover(hint, () => ({
        title: 'Tip',
        body: hint.textContent?.trim() || '',
        footer: '',
      }));
    });
  }

  function init() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'game-tooltip';
    el.className = 'game-tooltip';
    el.hidden = true;
    document.body.appendChild(el);
    bindHudTooltips();
    document.getElementById('hint-bar')?.addEventListener('mouseleave', hide);
  }

  function refreshDynamic() {
    if (anchor && el?.classList.contains('visible')) {
      const gs = typeof Game !== 'undefined' && Game.isPlaying?.() ? Game.getState() : null;
      const id = anchor.id;
      let tip = null;
      if (anchor.classList.contains('deploy-btn')) tip = getDeployTip(anchor.dataset.unit, gs);
      else if (anchor.classList.contains('build-btn')) tip = getBuildTip(anchor.dataset.build, gs);
      else if (anchor.classList.contains('ability-btn')) tip = getAbilityTip(anchor.dataset.ability, gs);
      else if (anchor.classList.contains('spy-btn')) tip = getSpyTip(anchor.dataset.spy, gs);
      else if (anchor.classList.contains('courier-btn')) tip = getCourierTip(anchor.dataset.courier, gs);
      else if (id) tip = getMetaTip(id, gs) || getTopBarTip(anchor, gs);
      if (tip) showTip(tip);
    }
  }

  return { init, hide, refreshDynamic };
})();