/**
 * In-game HUD tooltips — rich descriptions for panels and top bar.
 */
const Tooltips = (() => {
  let el = null;
  let anchor = null;
  let hideTimer = null;
  let autoFadeTimer = null;
  let fadeOutTimer = null;
  const SHOW_MS = 3500;
  const FADE_MS = 400;

  const BUILD_NOTES = {
    outpost: 'Forward cover with one garrison slot. Archers inside gain +55 range.',
    wall: 'Blocks movement. Two footman slots per segment when a General commands the Keep. Castle walls face N/E/S/W. Press R while placing to set facing; ROTATE tool turns completed walls.',
    castle:
      'Compound: 4 walls, 4 outposts, Keep, med tent, and mess hall — requires Fortification research.',
    medical_tent:
      'All wounded allies at ≤25% HP retreat here when damaged instead of fighting to the death.',
    mess_hall: 'Morale aura for nearby troops — stacks with bards and rallies.',
    watchtower:
      '5 TP. Reveals stealth and burrowers; enemies nearby suffer accuracy penalties. Archers gain +35 range. Requires Field Engineering.',
    spike_trap:
      '3 TP. Hidden spikes — first enemy crossing each cooldown takes heavy damage. Requires Field Engineering.',
    quarry:
      '14 TP, 2 Builders. +1 TP/round (shared 6-site cap with trade posts). Blocks movement. Requires Prospecting.',
    trade_outpost:
      '16 TP, 2 Builders. +1 TP/round plus morale aura. Counts toward the 6-site economy cap. Requires Prospecting.',
    research_lab:
      '45 TP, 2 Builders. Analyzes slain foes for Science Points — stronger enemies yield more SP (wave cap). Required to research.',
    fortress_upgrade:
      'Place on a completed settlement: +HP, cover, +1 TP/round, and raises a palisade wall ring.',
    hamlet: '100 TP, 5 Builders, 5-wave build. +5 TP/round. Requires Settlement Charter research.',
    village: '180 TP, 6 Builders, 6-wave build. +8 TP/round. Requires Village Rights research.',
    town: '280 TP, 7 Builders, 7-wave build. +10 TP/round. Requires Town Charter research.',
    city: '420 TP, 8 Builders, 8-wave build. +12 TP/round. Requires Urban Planning research.',
    metropolis:
      '600 TP, 10 Builders, 10-wave build. +15 TP/round. Requires Imperial Metropolis research.',
    merchant_guild:
      '150 TP, 5 Builders. +1 TP/round per guild in settlement aura. Requires Merchant Charter research.',
    castle_keep: 'Station your General here to activate command aura and man castle walls.',
  };

  const UNIT_NOTES = {
    footman:
      'Cheap melee line-holder. Garrisons walls under General command. Earns combat stars from kills.',
    archer: 'Long-range DPS. Garrison outposts for extended range. Keep behind cover.',
    mage: 'Arcane bolts with splash. Strong vs clustered swarms.',
    cavalry: 'Fast melee with charge bonus. Hunts stragglers and flanks.',
    healer:
      'Heals allies in range — including other healers. At ≤25% HP, retreats to med tents on damage like all allies. Ranks when healing each wave.',
    knight: 'Heavy armored melee with damage resistance. Banner courier can summon one.',
    sapper: 'Bonus siege damage (×2.5) vs walls and siege engines.',
    scout: 'Fast skirmisher with stealth detection. Pair with watchtowers.',
    bard:
      '5 TP morale aura support. Unlock: Research Lab → Morale Arts (wave 5+), then deploy (or Bard Academy with Immortal bard mentor).',
    ballista:
      '6 TP long-range siege crew. Bonus vs flyers and structures. Unlock: Research Lab → Iron Weapons → Siege Engineering (wave 12+), then click Ballista and place on the map (Shift-click to place more). Academy needs an Immortal ballista mentor.',
    pikeman:
      '4 TP anti-cavalry and anti-air line. Unlock: Research Lab → Iron Weapons → Advanced Infantry.',
    builder: 'Erects structures within build range. Auto-repair toggle in meta panel.',
    courier: 'Dispatches one royal message per wave. Must be alive on the field.',
    general: 'Command aura buffs nearby troops. Auto-paths to Keep; mans castle walls.',
    doomslayer_hero: 'Legend unlocked at wave 200 on Doomslayer difficulty. One per field.',
  };

  const ACADEMY_NOTE =
    'Find an Immortal veteran first — each academy needs a max-rank mentor of that unit type alive on the field before you can found it. Once complete, trains one free unit each round (Builder/Courier academies train while only the mentor is on the field).';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtCost(cost, freeTp) {
    if (freeTp) return 'Free (Creative)';
    return cost === 0 ? 'No TP cost' : `${cost} TP`;
  }

  function abilityDesc(id, ab) {
    if (id === 'dispel' || ab.requiresMage)
      return (
        ab.desc ||
        `Purge void, burn pits, plague, and other blight zones in radius ${ab.radius}. Requires a living Mage in cast range.`
      );
    if (ab.healAmount) return `Heals ${ab.healAmount} HP in radius ${ab.radius}.`;
    if (ab.units) return `Spawns ${ab.units.length} troops at the target.`;
    if (ab.moraleBoost)
      return `+${ab.moraleBoost} morale to allies for ${Math.round(ab.duration / 60)}s.`;
    if (ab.slowDuration) return `${ab.damage} damage and slow in radius ${ab.radius}.`;
    if (ab.revealDuration) return `Reveals hidden enemies in radius ${ab.radius}.`;
    if (ab.mitigation)
      return `${Math.round(ab.mitigation * 100)}% damage reduction in zone for ${Math.round(ab.duration / 60)}s.`;
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

  function withDamagePreview(tip, line) {
    if (!tip || !line) return tip;
    return { ...tip, damage: line };
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
    const tip = { title: def.name, body: `${note} ${unitStats(def)}`, footer };
    if (typeof DamagePreview !== 'undefined') {
      return withDamagePreview(tip, DamagePreview.formatDeployTip(type, gs));
    }
    return tip;
  }

  function getBuildTip(type, gs) {
    const def = typeof BuildDefs !== 'undefined' ? BuildDefs[type] : null;
    // Always show notes even if BuildDefs was wiped mid-boot (async GameData load).
    if (!def && !BUILD_NOTES[type]) return null;
    const freeTp = gs?.creativeMode && gs?.creativeSettings?.freeResources;
    let body = BUILD_NOTES[type];
    if (!body && def?.isAcademy && !def.isCrossoverBarracks && !def.isWweAcademy) {
      const status =
        typeof Game !== 'undefined' && Game.getAcademyBuildStatus
          ? Game.getAcademyBuildStatus(type)
          : null;
      const mentor =
        status?.mentorType ||
        (typeof getAcademyMentorUnitType === 'function'
          ? getAcademyMentorUnitType(type)
          : def.academyUnit || type.replace('academy_', ''));
      const mentorName = status?.mentorName || getPlayerUnitDef(mentor)?.name || mentor;
      const rank =
        status?.mentorRank ||
        (typeof getMaxVeteranRankName === 'function' ? getMaxVeteranRankName(mentor) : 'Immortal');
      const trains = def.academyUnit || mentor;
      body = `${ACADEMY_NOTE} This hall trains ${trains} — requires an on-field ${mentorName} at ${rank} (V${status?.mentorNeed || 6}).`;
      if (status?.hasMentor) {
        body += ` Mentor ready: Immortal ${mentorName} is on the field.`;
        if (status.researchOk === false) {
          body += ' Still need the matching research node to place this academy.';
        } else {
          body += ' You can found this academy now.';
        }
      } else if (status?.mentorProgress > 0) {
        body += ` Progress: V${status.mentorProgress}/${status.mentorNeed || 6} on field — keep promoting after each gold-star cycle.`;
      } else if (status?.reason) {
        body += ` ${status.reason}`;
      }
    } else if (!body && def?.isAcademy) {
      body = ACADEMY_NOTE;
    } else if (!body && def?.isPerkMachine) {
      const perk = PerkDefs?.[def.perkId];
      body = perk
        ? `${perk.desc} Heroes collect at night (max 4 perks).`
        : 'Tonic Stations machine for roster heroes.';
    } else if (!body) {
      body = def?.buildTime
        ? `Build time ${def.buildTime} ticks.`
        : 'Field structure — place with a Builder.';
    }
    if (def?.requiresBuilders) body += ` Requires ${def.requiresBuilders} live Builders.`;
    if (def?.tpPerRound) body += ` +${def.tpPerRound} TP/round.`;
    if (def?.isWatchtower) body += ` Vision ${def.visionRadius || 200}.`;
    if (def?.isTrap) body += ` Trap damage ${def.trapDamage || 45}.`;
    let footer = fmtCost(def?.cost ?? 0, freeTp);
    if (def?.isAcademy && !def.isCrossoverBarracks && !def.isWweAcademy) {
      const status =
        typeof Game !== 'undefined' && Game.getAcademyBuildStatus
          ? Game.getAcademyBuildStatus(type)
          : null;
      if (status?.canBuild) footer += ` · Ready to build`;
      else if (status?.hasMentor && status.researchOk === false)
        footer += ` · Mentor OK · need research`;
      else if (status?.hasMentor) footer += ` · Mentor on field`;
      else if (status?.mentorProgress > 0)
        footer += ` · Mentor V${status.mentorProgress}/${status.mentorNeed || 6}`;
      else if (status?.reason) footer = status.reason;
      else footer += ' · Find an Immortal veteran first';
    }
    if (def?.isPerkMachine && !gs?.perksUnlocked) footer += ' · Unlock roster cheat first';
    return { title: def?.name || type.replace(/_/g, ' '), body, footer };
  }

  function getAbilityTip(id, gs) {
    const raw = Abilities[id];
    if (!raw) return null;
    // Tooltips show the 20% cooler combat values players actually get.
    const ab = typeof scaleAbilityDef === 'function' ? scaleAbilityDef(raw) : raw;
    const freeTp = gs?.creativeMode && gs?.creativeSettings?.freeResources;
    const base = ab.cost ?? 0;
    const cost = freeTp
      ? 0
      : typeof ContentExpansion !== 'undefined' && ContentExpansion.getAbilityCost
        ? ContentExpansion.getAbilityCost(id, base, gs?.wave ?? 0)
        : base;
    const tip = {
      title: ab.name,
      body: abilityDesc(id, ab),
      footer: fmtCost(cost, freeTp) + ' · Click map to strike',
    };
    if (typeof DamagePreview !== 'undefined') {
      return withDamagePreview(tip, DamagePreview.formatAbilityTip(id, gs));
    }
    return tip;
  }

  function getSpyTip(id, gs) {
    const def = SpyActions[id];
    if (!def) return null;
    const base = def.cost ?? 0;
    const cost =
      typeof ContentExpansion !== 'undefined' ? ContentExpansion.getSpyCost(id, base) : base;
    let footer = `${cost} TP · One action per wave`;
    const stageReq = def.kingdomStage || 0;
    if (stageReq > 0 && (gs?.kingdomStage || 1) < stageReq) {
      const name =
        typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? KINGDOM_EVOLUTION_STAGES[stageReq]?.name
          : `stage ${stageReq}`;
      footer += ` · Unlocks in ${name}`;
    }
    if (gs?.spyUsedThisWave) footer += ' · Used this wave';
    if (gs?.tactical < cost) footer += ' · Not enough TP';
    return { title: def.name, body: def.desc, footer };
  }

  function getCourierTip(id, gs) {
    const def = CourierMessages[id];
    if (!def) return null;
    const base = def.cost ?? 0;
    const cost =
      typeof ContentExpansion !== 'undefined' ? ContentExpansion.getCourierCost(id, base) : base;
    const perWave = Math.max(1, gs?.courierMessagesPerWave || 1);
    const used = gs?.courierMessagesUsedThisWave || 0;
    let footer =
      perWave > 1
        ? `${cost} TP · ${perWave} messages per wave (Twin Dispatch)`
        : `${cost} TP · One message per wave`;
    if (perWave > 1 && used > 0) footer += ` · ${used}/${perWave} sent`;
    const stageReq = def.kingdomStage || 0;
    if (stageReq > 0 && (gs?.kingdomStage || 1) < stageReq) {
      const name =
        typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? KINGDOM_EVOLUTION_STAGES[stageReq]?.name
          : `stage ${stageReq}`;
      footer += ` · Unlocks in ${name}`;
    }
    if (!gs?.hasCourier) footer += ' · Need live Courier';
    if (used >= perWave) footer += ' · Used this wave';
    if (gs?.courierCooldown > 0) footer += ` · Cooldown ${gs.courierCooldown}`;
    return { title: def.name, body: def.desc, footer };
  }

  function getDoctrineTip(id, gs) {
    const def =
      typeof KINGDOM_DOCTRINES !== 'undefined' ? KINGDOM_DOCTRINES[id] : gs?.kingdomDoctrines?.[id];
    if (!def) return null;
    let footer = `${def.cost} TP · One doctrine per wave`;
    const stageReq = def.kingdomStage || 0;
    if (stageReq > 0 && (gs?.kingdomStage || 1) < stageReq) {
      const name =
        typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? KINGDOM_EVOLUTION_STAGES[stageReq]?.name
          : `stage ${stageReq}`;
      footer += ` · Unlocks in ${name}`;
    }
    if (gs?.doctrineUsedThisWave) footer += ' · Used this wave';
    if (gs?.tactical < def.cost) footer += ' · Not enough TP';
    return { title: def.name, body: def.desc, footer };
  }

  function getLoadoutTip(id) {
    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.formatLoadoutTip) {
      return ContentExpansion.formatLoadoutTip(id);
    }
    const lo =
      typeof ContentExpansion !== 'undefined' ? ContentExpansion.getLoadouts()?.[id] : null;
    if (!lo) return null;
    return {
      title: lo.label,
      body: lo.desc,
      footer: 'Wave 100+ · New deploys & academy graduates',
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
        body: 'Turn any completed player wall 90° clockwise (castle ring, hamlet palisade, or standalone). Garrisoned footmen and cover direction update with it.',
        footer: 'Click wall · Free · Esc to cancel',
      },
      'hunt-toggle': {
        title: 'Global Hunt',
        body: `All hunt-capable troops ${gs?.globalHunt ? 'actively pursue' : 'hold position unless'} foes and enemy hamlets/guilds.`,
        footer: 'Hotkey: H',
      },
      'clear-selection-btn': {
        title: 'Clear Selection',
        body: 'Deselect all units on the battlefield. On touch: tap a selected unit again to deselect it.',
        footer: 'Right-click or C · Esc cancels armed orders first',
      },
      'formation-reform-btn': {
        title: 'Reform Formation',
        body: 'Snap the selected group into the active formation around their center.',
        footer: 'Hotkey: G · Requires 2+ units',
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
        title: 'Grand Coliseum',
        body: 'Recruit squared-circle champions from your academy roster.',
        footer: 'Requires Grand Coliseum on field',
      },
      'crossover-hub-open': {
        title: 'Legion Archive',
        body: 'Recruit operatives from unlocked evolved factions.',
        footer: 'Requires evolved barracks on field',
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
    if (label === 'ARMY') {
      const producers = gs?.unitProducers ?? 0;
      return {
        title: 'Forces on field',
        body: 'Allies currently fighting. You lose when the army is wiped out and no academy or barracks remains.',
        footer: `${gs?.army ?? 0} troops · ${producers} training hall${producers === 1 ? '' : 's'}`,
      };
    }
    if (label === 'TP/ROUND') {
      const eco = gs?.settlementTpBonus ?? 0;
      const total = gs?.tpPerRound ?? 8;
      const baseEst = Math.max(0, total - eco);
      return {
        title: 'TP Per Round',
        body: 'Income awarded when you clear a wave. Scales with wave number, difficulty, settlements, quarries, trade posts, and commander bonuses.',
        footer:
          eco > 0
            ? `+${total} total · ~${baseEst} base · +${eco} settlements`
            : `+${total} total (no settlement bonus yet)`,
      };
    }
    if (label === 'STREAK') {
      return {
        title: 'Kill Streak',
        body: 'Chain enemy kills without long gaps. Higher streaks trigger banners and combat fanfare.',
        footer: `Current: ${gs?.feedback?.killStreak || 0} · Best this run: ${gs?.feedback?.bestStreak || 0}`,
      };
    }
    if (label === 'WAVE') {
      return {
        title: 'Wave',
        body: 'Assault wave counter. The map expands every 10 waves on all sides; pressure rises with wave number.',
        footer:
          gs?.timeOfDay === 'night'
            ? 'Night prep — press D or BEGIN DAY'
            : 'Day — enemies attacking',
      };
    }
    if (label === 'CYCLE') {
      return {
        title: 'Day / Night Cycle',
        body: 'Night: build and reposition (+35% builder speed). Day: enemy assault.',
        footer:
          gs?.timeOfDay === 'night'
            ? `Night (${gs?.nightSecondsLeft ?? 0}s left)`
            : 'Day assault active',
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
        footer:
          gs?.generalBuff > 0
            ? `Aura +${gs.generalBuff}%`
            : gs?.hasGeneral
              ? 'General not stationed'
              : 'No General',
      };
    }
    if (label === 'THREAT') {
      return {
        title: 'Threat Intel',
        body: "This wave's active flanks (random subset of unlocked sides). Also shows general threat, boss, and last-stand flags.",
        footer: (gs?.attackSides || ['north']).join(', '),
      };
    }
    if (label === 'INTEL') {
      const brief = [];
      if (gs?.namedBoss) brief.push(`Boss: ${gs.namedBoss}`);
      const sides = gs?.attackSides || [];
      if (sides.length) brief.push(`Flanks: ${sides.join(', ')}`);
      if (gs?.colonyThreatTier && gs.colonyThreatTier !== '—') {
        brief.push(String(gs.colonyThreatTier));
      }
      return {
        title: 'Wave Intel',
        body: 'Incoming assault snapshot — flanks, boss flags, and threat tier. Use Scout Report for a full roster.',
        footer: brief.length ? brief.join(' · ') : 'No intel — use Scout Report',
      };
    }
    if (label === 'SYN') {
      return {
        title: 'Faction Synergies',
        body: 'Active evolved/coliseum synergy bonuses and seasonal events.',
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
      'top-pause-btn': {
        title: 'Pause',
        body: 'Pause menu — resume, settings, encyclopedia, quit.',
        footer: 'Esc or Space',
      },
      'top-settings-btn': {
        title: 'Settings',
        body: 'Audio, graphics, UI scale, accessibility.',
        footer: 'Click to open',
      },
      'sound-toggle': { title: 'Sound', body: 'Toggle music and SFX.', footer: 'Hotkey: V' },
      'faction-intel-btn': {
        title: 'Threat Map',
        body: 'Faction evolution intel — active realms, stages, hostility, and north-sector map.',
        footer: 'Click HOST HUD · Esc to close',
      },
      'encyclopedia-btn': {
        title: 'Encyclopedia',
        body: 'Lore, bestiary, buildings, orders, and classified entries.',
        footer: 'Hotkey: I',
      },
      'achievements-btn': {
        title: 'Achievements',
        body: 'Iron Creed milestones and run tracking.',
        footer: 'Hotkey: A',
      },
      'creative-panel-toggle': {
        title: 'Creative Lab',
        body: 'Sandbox playtest — free TP, custom waves, spawn tools.',
        footer: 'Hotkey: P',
      },
      'perf-toggle': {
        title: 'Performance',
        body: 'Frame time and draw stats overlay.',
        footer: 'Hotkey: F3',
      },

      'begin-day-btn': {
        title: 'Begin Day',
        body: 'End night prep and start the assault immediately.',
        footer: 'Hotkey: D',
      },
      'hint-log-btn': {
        title: 'Message Log',
        body: 'Scrollable history of battle messages.',
        footer: 'Tab also opens log',
      },
    };
    const id = target.id || target.closest?.('[id]')?.id;
    return btnTips[id] || null;
  }

  function positionTooltip() {
    if (!el || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const pad = 8;
    let top = rect.top;
    el.style.top = `${top}px`;

    const placement = anchor.dataset.tooltipPlacement || 'auto';
    if (placement === 'panel-left') {
      const panel = anchor.closest('#right-panel');
      const panelRect = panel?.getBoundingClientRect();
      el.style.left = `${panelRect ? panelRect.left : rect.left}px`;
      let tr = el.getBoundingClientRect();
      const left = (panelRect ? panelRect.left : rect.left) - tr.width - pad;
      el.style.left = `${Math.max(pad, left)}px`;
      tr = el.getBoundingClientRect();
      if (tr.bottom > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - tr.height - pad);
        el.style.top = `${top}px`;
      }
      return;
    }

    let left = rect.right + pad;
    el.style.left = `${left}px`;
    let tr = el.getBoundingClientRect();
    if (tr.right > window.innerWidth - pad) {
      left = rect.left - tr.width - pad;
      el.style.left = `${Math.max(pad, left)}px`;
      tr = el.getBoundingClientRect();
    }
    if (tr.bottom > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - tr.height - pad);
      el.style.top = `${top}px`;
    }
  }

  function clearFadeTimers() {
    clearTimeout(autoFadeTimer);
    clearTimeout(fadeOutTimer);
    autoFadeTimer = null;
    fadeOutTimer = null;
  }

  function finishHide() {
    if (!el) return;
    el.hidden = true;
    el.classList.remove('visible', 'fading');
    anchor = null;
  }

  function scheduleAutoFade() {
    clearFadeTimers();
    if (!el) return;
    el.classList.remove('fading');
    autoFadeTimer = setTimeout(() => {
      if (!el || !anchor) return;
      el.classList.add('fading');
      fadeOutTimer = setTimeout(finishHide, FADE_MS);
    }, SHOW_MS);
  }

  function renderTipContent(tip) {
    el.innerHTML =
      `<div class="game-tooltip-title">${esc(tip.title)}</div>` +
      `<div class="game-tooltip-body">${esc(tip.body)}</div>` +
      (tip.damage ? `<div class="game-tooltip-damage">${esc(tip.damage)}</div>` : '') +
      (tip.footer ? `<div class="game-tooltip-footer">${esc(tip.footer)}</div>` : '');
  }

  function showTip(tip, opts = {}) {
    if (!el || !tip) return;
    const persist = !!opts.persist;
    clearTimeout(hideTimer);
    clearFadeTimers();
    renderTipContent(tip);
    el.hidden = false;
    el.classList.remove('fading');
    el.classList.add('visible');
    requestAnimationFrame(positionTooltip);
    if (!persist) scheduleAutoFade();
  }

  function refreshTipContent(tip) {
    if (!el || !tip || !anchor || el.hidden || !el.classList.contains('visible')) return;
    renderTipContent(tip);
    requestAnimationFrame(positionTooltip);
  }

  function hide() {
    clearTimeout(hideTimer);
    clearFadeTimers();
    if (!el || el.hidden || !el.classList.contains('visible')) {
      finishHide();
      return;
    }
    el.classList.add('fading');
    hideTimer = setTimeout(finishHide, FADE_MS);
  }

  function bindHover(node, getTip, opts = {}) {
    if (!node || node.dataset.tooltipBound) return;
    node.dataset.tooltipBound = '1';
    if (opts.placement) node.dataset.tooltipPlacement = opts.placement;
    node.addEventListener('mouseenter', () => {
      const gs = typeof Game !== 'undefined' && Game.isPlaying?.() ? Game.getState() : null;
      const tip = getTip(gs);
      if (!tip) return;
      anchor = node;
      showTip(tip, { persist: true });
    });
    node.addEventListener('mouseleave', hide);
    node.addEventListener('mousedown', hide);

    let touchTimer = null;
    let touchStart = null;
    node.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      touchStart = { x: e.clientX, y: e.clientY };
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => {
        const gs = typeof Game !== 'undefined' && Game.isPlaying?.() ? Game.getState() : null;
        const tip = getTip(gs);
        if (!tip) return;
        anchor = node;
        showTip(tip);
      }, 420);
    });
    const clearTouch = (e) => {
      clearTimeout(touchTimer);
      touchTimer = null;
      if (e?.pointerType !== 'mouse' && touchStart) {
        const moved = Math.hypot(
          (e.clientX ?? touchStart.x) - touchStart.x,
          (e.clientY ?? touchStart.y) - touchStart.y
        );
        if (moved > 14) hide();
      }
      touchStart = null;
    };
    node.addEventListener('pointerup', clearTouch);
    node.addEventListener('pointercancel', clearTouch);
    node.addEventListener('pointerleave', () => {
      clearTimeout(touchTimer);
      touchTimer = null;
    });
  }

  function bindHudTooltips() {
    document.querySelectorAll('.deploy-btn').forEach((btn) => {
      bindHover(btn, (gs) => getDeployTip(btn.dataset.unit, gs));
    });
    document.querySelectorAll('.build-btn').forEach((btn) => {
      bindHover(btn, (gs) => getBuildTip(btn.dataset.build, gs));
    });
    document.querySelectorAll('.ability-btn').forEach((btn) => {
      bindHover(btn, (gs) => getAbilityTip(btn.dataset.ability, gs));
    });
    document.querySelectorAll('.spy-btn').forEach((btn) => {
      bindHover(btn, (gs) => getSpyTip(btn.dataset.spy, gs), { placement: 'panel-left' });
    });
    document.querySelectorAll('.courier-btn').forEach((btn) => {
      bindHover(btn, (gs) => getCourierTip(btn.dataset.courier, gs), { placement: 'panel-left' });
    });
    document.querySelectorAll('.loadout-btn').forEach((btn) => {
      bindHover(btn, () => getLoadoutTip(btn.dataset.loadout));
    });
    document.querySelectorAll('.doctrine-btn').forEach((btn) => {
      bindHover(btn, (gs) => getDoctrineTip(btn.dataset.doctrine, gs), { placement: 'panel-left' });
    });
    document.querySelectorAll('.formation-btn').forEach((btn) => {
      const fid = btn.dataset.formation;
      const def = typeof Formations !== 'undefined' ? Formations.getFormation(fid) : null;
      bindHover(
        btn,
        (gs) => ({
          title: def?.label || fid,
          body: def?.desc || 'Formation preset for group moves.',
          footer: `Alt+${['line', 'column', 'wedge', 'box', 'spread'].indexOf(fid) + 1} · ${gs?.selectionFormation === fid ? 'Active' : 'Click to set'}`,
        }),
        { placement: 'panel-left' }
      );
    });
    [
      'demolish-btn',
      'move-building-btn',
      'rotate-wall-btn',
      'hunt-toggle',
      'clear-selection-btn',
      'formation-reform-btn',
      'builder-repair-toggle',
      'speed-toggle',
      'wwe-academy-open',
      'crossover-hub-open',
    ].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) bindHover(btn, (gs) => getMetaTip(id, gs));
    });
    const topBar = document.getElementById('top-bar');
    if (topBar) {
      topBar
        .querySelectorAll(
          '.stat-group, .pause-top-btn, .settings-top-btn, .sound-top-btn, ' +
            '.ency-top-btn, .ach-top-btn, .creative-top-btn, .perf-top-btn, #begin-day-btn'
        )
        .forEach((node) => {
          bindHover(node, (gs) => getTopBarTip(node, gs));
        });
    }
    const hintBtn = document.getElementById('hint-log-btn');
    if (hintBtn) bindHover(hintBtn, (gs) => getTopBarTip(hintBtn, gs));

    const panelTips = {
      TROOPS: {
        title: 'Troops',
        body: 'Deploy combat units onto the rally field. Costs scale after wave 100.',
        footer: 'Shift+click to add to selection',
      },
      SPECIALISTS: {
        title: 'Specialists',
        body: 'Builder erects structures; Courier sends one royal message per wave.',
        footer: 'Both essential for economy and construction',
      },
      BUILD: {
        title: 'Build',
        body: 'Place structures via Builder. Settlements need multiple builders and wide ground.',
        footer: 'Click build, then click map',
      },
      ACADEMIES: {
        title: 'Academies',
        body: 'Find an Immortal veteran first — you cannot found an academy until a max-rank mentor of that unit type is alive on the field. Promote troops via Veteran Doctrine, deploy the mentor, then build. Each complete academy trains one free unit per round.',
        footer: 'Hover each academy button for mentor requirements',
      },
      STRIKES: {
        title: 'Strikes',
        body: 'One-shot tactical abilities — damage, heal, reinforce, or buff.',
        footer: 'Click strike, then click map target',
      },
      'SPY NETWORK': {
        title: 'Spy Network',
        body: 'One covert action per wave. Scout and Infiltrate reveal exact next-wave roster.',
        footer: 'Costs TP immediately',
      },
      'COURIER MSGS': {
        title: 'Courier Messages',
        body: 'One dispatch per wave while a live Courier is on the field.',
        footer: 'Click message, then click map',
      },
      LOADOUT: {
        title: 'Loadouts',
        body: 'Passive bonuses applied to newly deployed and academy-trained troops.',
        footer: 'Press Z for Balanced loadout',
      },
      'TONIC STATIONS': {
        title: 'Tonic Stations',
        body: 'Machines grant perks to Coliseum, evolved allies, and General heroes at night.',
        footer: 'Max 4 perks per hero',
      },
    };
    document.querySelectorAll('.panel-header').forEach((hdr) => {
      const key = hdr.textContent?.trim();
      const tip = panelTips[key];
      if (!tip) return;
      const placement = key === 'SPY NETWORK' || key === 'COURIER MSGS' ? 'panel-left' : undefined;
      bindHover(hdr, () => tip, placement ? { placement } : {});
    });
    document.querySelectorAll('.panel-hint').forEach((hint) => {
      const placement = hint.closest('#right-panel') ? 'panel-left' : undefined;
      bindHover(
        hint,
        () => ({
          title: 'Tip',
          body: hint.textContent?.trim() || '',
          footer: '',
        }),
        placement ? { placement } : {}
      );
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

  function refreshDynamic(gsState) {
    if (anchor && el?.classList.contains('visible')) {
      const gs =
        gsState ??
        (typeof Game !== 'undefined' && Game.isPlaying?.() ? Game.getState() : null);
      const id = anchor.id;
      let tip = null;
      if (anchor.classList.contains('deploy-btn')) tip = getDeployTip(anchor.dataset.unit, gs);
      else if (anchor.classList.contains('build-btn')) tip = getBuildTip(anchor.dataset.build, gs);
      else if (anchor.classList.contains('ability-btn'))
        tip = getAbilityTip(anchor.dataset.ability, gs);
      else if (anchor.classList.contains('spy-btn')) tip = getSpyTip(anchor.dataset.spy, gs);
      else if (anchor.classList.contains('courier-btn'))
        tip = getCourierTip(anchor.dataset.courier, gs);
      else if (id) tip = getMetaTip(id, gs) || getTopBarTip(anchor, gs);
      if (tip) refreshTipContent(tip);
    }
  }

  return { init, hide, refreshDynamic };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Tooltips = Tooltips;
