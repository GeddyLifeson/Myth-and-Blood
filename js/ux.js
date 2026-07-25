/**
 * UI/UX, controls, accessibility, onboarding, and pause systems.
 */
const UX = (() => {
  const TUTORIAL_KEY = 'myth-and-blood-tutorial-progress';
  const MESSAGE_LOG_MAX = 80;

  let messageLog = [];
  let tutorialStep = 0;
  let tutorialDisplayIndex = -1;
  let tutorialDismissed = false;
  let tutorialRevealEl = null;
  let pauseOpen = false;
  let pauseOverlayHidden = false;
  let minimapCanvas = null;
  let minimapCtx = null;
  let lastHintKey = '';
  let lastUnitPanelKey = '';
  let lastUnitPanelStructure = '';

  const PAUSE_SHORTCUTS = [
    { keys: 'Space', label: 'Resume' },
    { keys: 'Esc', label: 'Pause / cancel order' },
    { keys: 'Tab', label: 'Message log' },
    { keys: 'F', label: 'Focus selection' },
    { keys: 'C', label: 'Clear selection' },
    { keys: 'Right-click', label: 'Deselect / cancel order' },
    { keys: 'H', label: 'Toggle hunt' },
    { keys: 'D', label: 'Begin day (night)' },
    { keys: ']', label: 'Cycle speed' },
    { keys: 'I', label: 'Encyclopedia' },
    { keys: 'F3', label: 'Perf monitor' },
    { keys: '1–9', label: 'Deploy unit' },
    { keys: '0', label: 'General' },
    { keys: 'Shift+drag', label: 'Box select' },
    { keys: 'Drag (empty)', label: 'Box select' },
    { keys: 'G', label: 'Reform selection' },
    { keys: 'Alt+1–5', label: 'Formation presets' },
    { keys: 'Pinch', label: 'Zoom map' },
    { keys: 'Hold', label: 'Cancel armed order' },
    { keys: 'Research btn', label: 'Tech tree' },
  ];

  const TUTORIAL_STEPS = [
    {
      maxWave: 1,
      title: 'Welcome, Commander',
      body: 'Deploy Footmen with <kbd>1</kbd> or the left panel, then click the map to position them. Enemies march from the north — survive as long as you can.',
      highlight: 'left-panel',
    },
    {
      maxWave: 2,
      title: 'Tactical Points',
      body: 'Clear each wave to earn TP. Spend it on troops, walls, and strikes. Watch the top bar for your pool and +TP/round.',
      highlight: 'top-bar',
    },
    {
      maxWave: 3,
      title: 'Hunt Mode',
      body: '<kbd>H</kbd> toggles Hunt — soldiers path toward foes. Click a unit, then click the map to override with a manual move.',
      highlight: 'hunt-toggle',
    },
    {
      maxWave: 5,
      title: 'Build & Defend',
      body: 'Deploy a Builder (<kbd>7</kbd>), select BUILD, click the map. Build a <strong>Research Lab</strong> (45 TP) to unlock advanced troops and evolved barracks over time.',
      highlight: 'left-panel',
    },
    {
      maxWave: 8,
      title: 'Spy Network',
      body: 'One spy action per wave from the right panel. Scout reveals the exact next roster — invaluable before big waves.',
      highlight: 'right-panel',
    },
    {
      maxWave: 10,
      title: 'Territory Grows',
      body: 'Every 10 waves the realm expands. The minimap shows biomes, your view box, and (from wave 25+) a <strong>flank compass</strong> — glowing edges mark active assault directions.',
      highlight: 'minimap-panel',
    },
    {
      maxWave: 12,
      title: 'Courier Orders',
      body: 'Deploy a Courier, pick a royal message, and they ride to the King. Tax Levy is free TP once per wave.',
      highlight: 'right-panel',
    },
    {
      maxWave: 15,
      title: 'Veteran Stars',
      body: 'Core troops earn stars from kills — three gold makes them eligible for a <strong>TP promotion</strong> (research Veteran Doctrine). Evolved operatives scale with waves automatically; footmen do not.',
      highlight: 'unit-info-panel',
    },
    {
      maxWave: 18,
      title: 'Box Select & Formations',
      body: 'Drag empty map to box-select allies (or <kbd>Shift</kbd>+drag anywhere). <kbd>Ctrl</kbd>+drag adds to selection. Pick a <strong>FORMATION</strong> in the right panel — Line, Column, Wedge, Box, or Spread — then click to move. <kbd>G</kbd> reforms the group; <kbd>Alt+1–5</kbd> quick presets.',
      highlight: 'right-panel',
    },
    {
      maxWave: 20,
      title: 'Night Prep',
      body: 'After each cleared wave, night falls for 1 minute: no spawns, +35% build speed. Press D or BEGIN DAY to start early — or wait for auto dawn.',
      highlight: 'begin-day-btn',
    },
    {
      minWave: 8,
      maxWave: 35,
      when: (gs) => gs.wave >= 8,
      title: 'Neutral Wildlife',
      body: 'Wild beasts roam from wave 8 — they attack whichever army is nearest. Slay them for TP, but over-hunting turns them <strong>feral</strong>. Dispatch a <strong>Hunt Pact</strong> courier message to ally with wildlife instead.',
      highlight: 'right-panel',
    },
    {
      minWave: 10,
      maxWave: 60,
      when: (gs) => gs.hasResearchLab || (gs.sciencePoints ?? 0) > 0,
      title: 'Science & Research',
      body: 'Your Research Lab analyzes fallen foes for <strong>Science Points</strong>. Open <strong>RESEARCH</strong> to unlock settlements, academies, and evolved barracks — each node gates new power.',
      highlight: 'research-open',
    },
    {
      when: (gs) => gs.wweUnlocked,
      title: 'Grand Coliseum',
      body: 'The grand arena is yours — open <strong>GRAND COLISEUM</strong>, build the hall on the field, then sign champions. They scale with waves and bring morale bombs and finishers.',
      highlight: 'wwe-academy-open',
    },
    {
      when: (gs) => gs.crossoverUnlocked,
      title: 'Crossover Operatives',
      body: 'Open <strong>CROSSOVER HUB</strong> to browse factions, place barracks, and recruit operatives. One copy of each hero per field — combine tags (melee, ranged, support) for research perks.',
      highlight: 'crossover-hub-open',
    },
    {
      minWave: 20,
      when: (gs) =>
        (gs.crossoverOnField?.length ?? 0) > 0 ||
        (gs.wweOnField?.length ?? 0) > 0 ||
        gs.operativeSkills?.active,
      title: 'Operative Skill Trees',
      body: 'Recruiting operatives earns <strong>skill points</strong> each run — spend them on faction skill nodes (accuracy, damage, morale). Lifetime mastery from achievements raises your budget. Watch the <strong>SYN</strong> chip for unlocked nodes.',
      highlight: 'syn-hud',
    },
    {
      minWave: 22,
      when: (gs) => (gs.factionSynergies?.length ?? 0) > 0,
      title: 'Faction Synergies',
      body: 'Field operatives from matching factions to activate <strong>synergy bonuses</strong> — extra damage, accuracy, morale, and siege power. Too many factions at once triggers soup penalties; anchor with 2–4 core tags.',
      highlight: 'syn-hud',
    },
    {
      minWave: 20,
      when: (gs) => gs.livingPlanet?.active || (gs.territoryTier ?? 0) >= 2,
      title: 'Living Planet Biomes',
      body: 'Expanded territory unlocks <strong>forest, mountain, and corrupted</strong> bands. Biomes change cover, speed, and which enemies spawn where. Check the <strong>REALM</strong> chip as your borders grow.',
      highlight: 'realm-hud',
    },
    {
      minWave: 6,
      when: (gs) => gs.factionReputation?.active,
      title: 'Faction Reputation',
      body: 'Host realms track hostility from wave 6 — aggressive kills and raids raise evolution pressure. <strong>Truce</strong> couriers and quiet waves ease threats toward economic probes instead of military surges.',
      highlight: 'host-faction-text',
    },
    {
      minWave: 25,
      maxWave: 40,
      title: 'Multi-Front Sieges',
      body: 'New flanks open every 25 waves — East, West, then South. Wave intel shows coordinated vs competing assaults. Split garrisons or lean on hunt mode and strikes per front.',
      highlight: 'wave-intel-text',
    },
    {
      minWave: 12,
      maxWave: 18,
      title: 'Dynamic Planet Events',
      body: 'Volcanic eruptions, ley storms, and ruin awakenings appear on the map. Respond during night prep — ignore them and both armies suffer; exploit them for TP and tempo.',
      highlight: 'planet-event-hud',
    },
    {
      minWave: 30,
      maxWave: 80,
      when: (gs) => gs.kingdomRaidsUnlocked || (gs.hamletCount ?? 0) > 0 || gs.hasResearchLab,
      title: 'Settlement Economy',
      body: 'Hamlets through Metropolises plus Merchant Guilds fuel your TP/round. Wall them in — enemy settlement raids (wave 150+) and northern holds target economy sites first.',
      highlight: 'left-panel',
    },
    {
      minWave: 100,
      when: (gs) => gs.wave >= 100 || gs.rtsEra,
      title: 'RTS Escalation',
      body: 'Wave 100+ swells horde counts and raid pressure. Enemy <strong>evil operatives</strong> mirror your crossover scaling — promote core veterans or field more operatives to keep pace.',
      highlight: 'wave-intel-text',
    },
    {
      minWave: 150,
      when: (gs) => gs.settlementRaids?.active,
      title: 'Settlement Raids',
      body: 'Host counter-raids now target your hamlets and guilds. Watch wave intel for inbound strikes — keep builders repairing and footmen garrisoned on economy tiles.',
      highlight: 'wave-intel-text',
    },
    {
      minWave: 200,
      when: (gs) => gs.planetWarfare?.active,
      title: 'Hostile Map Control',
      body: 'From wave 200 the map creeps red — hostile control tightens vision, spawn pace, and northern fog. Push back with counter-offensives and hold multiple unit types to pierce wards.',
      highlight: 'control-hud',
    },
    {
      when: (gs) => gs.planetConquest?.active,
      title: 'Planet Conquest',
      body: 'From wave 500, <strong>true victory</strong> requires shattering the <strong>Worldheart Tyrant</strong>. Eliminate two or more realms to awaken it, field three+ unit types to pierce its ward, then finish the boss — check the <strong>CONQUEST</strong> chip.',
      highlight: 'conquest-hud',
    },
    {
      minWave: 80,
      maxWave: 140,
      when: (gs) =>
        (gs.counterEvolution?.activeExpeditions?.length ?? 0) > 0 ||
        !!gs.counterEvolution?.summary,
      title: 'Counter-Offensives',
      body: 'Launch expeditions from the right panel to debuff host factions temporarily. Pair with spy disruption and settlement raids to collapse a realm before evolution outpaces you.',
      highlight: 'right-panel',
    },
  ];

  function tutorialStepExpired(step, wave) {
    return step.maxWave != null && wave > step.maxWave;
  }

  function tutorialStepMatches(step, gs) {
    if (step.when && !step.when(gs)) return false;
    if (step.minWave != null && gs.wave < step.minWave) return false;
    if (step.maxWave != null && gs.wave > step.maxWave) return false;
    return true;
  }

  function pruneTutorialProgress(gs) {
    let changed = false;
    while (tutorialStep < TUTORIAL_STEPS.length && tutorialStepExpired(TUTORIAL_STEPS[tutorialStep], gs.wave)) {
      tutorialStep++;
      changed = true;
    }
    if (changed) saveTutorialProgress();
  }

  function resolveTutorialStep(gs) {
    pruneTutorialProgress(gs);
    for (let i = tutorialStep; i < TUTORIAL_STEPS.length; i++) {
      const step = TUTORIAL_STEPS[i];
      if (tutorialStepExpired(step, gs.wave)) continue;
      if (!tutorialStepMatches(step, gs)) continue;
      return { step, index: i };
    }
    return null;
  }

  function announce(text) {
    Settings?.announce?.(text);
  }

  function loadTutorialProgress() {
    try {
      const raw = localStorage.getItem(TUTORIAL_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        tutorialStep = data.step || 0;
        tutorialDismissed = !!data.dismissed;
      }
    } catch (_) {
      /* ignore */
    }
  }

  function saveTutorialProgress() {
    try {
      localStorage.setItem(
        TUTORIAL_KEY,
        JSON.stringify({ step: tutorialStep, dismissed: tutorialDismissed })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function onMessage(text, source = 'game') {
    if (!text) return;
    const entry = {
      text,
      source,
      time: Date.now(),
      wave: Game.isPlaying?.() ? Game.getState().wave : 0,
    };
    messageLog.unshift(entry);
    if (messageLog.length > MESSAGE_LOG_MAX) messageLog.length = MESSAGE_LOG_MAX;
    renderMessageLog();
    announce(text);
  }

  function formatLogTime(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function renderMessageLog() {
    const list = document.getElementById('message-log-list');
    if (!list) return;
    list.innerHTML =
      messageLog
        .slice(0, 40)
        .map(
          (m) => `
      <div class="msg-log-entry">
        <span class="msg-log-wave">W${m.wave}</span>
        <span class="msg-log-time">${formatLogTime(m.time)}</span>
        <span class="msg-log-text">${escapeHtml(m.text)}</span>
      </div>
    `
        )
        .join('') || '<p class="msg-log-empty">No messages yet.</p>';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatStars(u) {
    const parts = [];
    if (u.vetBronze)
      parts.push(
        `<span class="star-bronze" title="Bronze">${'★'.repeat(Math.min(9, u.vetBronze))}</span>`
      );
    if (u.vetSilver)
      parts.push(
        `<span class="star-silver" title="Silver">${'◆'.repeat(Math.min(3, u.vetSilver))}</span>`
      );
    if (u.vetGold)
      parts.push(
        `<span class="star-gold" title="Gold">${'♛'.repeat(Math.min(3, u.vetGold))}</span>`
      );
    if (u.vetTier) parts.push(`<span class="vet-tier">V${u.vetTier}</span>`);
    return parts.join(' ') || '<span class="star-none">—</span>';
  }

  function formatPerks(u) {
    const perks = u.perks || [];
    if (!perks.length) return '<span class="perk-none">None</span>';
    return perks
      .map((p) => {
        const name = (typeof PerkDefs !== 'undefined' && PerkDefs[p]?.name) || p;
        return `<span class="perk-chip">${escapeHtml(name)}</span>`;
      })
      .join('');
  }

  function formatPctMult(pct) {
    const s = (Math.round(pct) / 100).toFixed(2);
    return s.replace(/\.?0+$/, '') || '1';
  }

  function tenureBarFill(pct, capPct) {
    if (!pct || pct <= 100) return 0;
    return Math.min(100, Math.round(((pct - 100) / (capPct - 100)) * 100));
  }

  function formatTenureBar(s) {
    if (!s || s.tenure <= 0) return '';
    const hpCap = s.tenureCapPct || 215;
    const dmgCap = s.tenureDmgCapPct || 175;
    if (s.tenureHpPct && s.tenureDmgPct) {
      const hpFill = tenureBarFill(s.tenureHpPct, hpCap);
      const dmgFill = tenureBarFill(s.tenureDmgPct, dmgCap);
      return `<div class="tenure-meter dual">
        <span class="tenure-meter-label">Field tenure · ${s.tenure} wave${s.tenure > 1 ? 's' : ''}${s.spawnWave != null ? ` (since W${s.spawnWave})` : ''}</span>
        <div class="tenure-bar-row">
          <span class="tenure-bar-key">HP</span>
          <div class="tenure-bar-track"><div class="tenure-bar-fill hp" style="width:${hpFill}%"></div></div>
          <span class="tenure-bar-val">×${formatPctMult(s.tenureHpPct)}</span>
        </div>
        <div class="tenure-bar-row">
          <span class="tenure-bar-key">DMG</span>
          <div class="tenure-bar-track"><div class="tenure-bar-fill dmg" style="width:${dmgFill}%"></div></div>
          <span class="tenure-bar-val">×${formatPctMult(s.tenureDmgPct)}</span>
        </div>
        <span class="tenure-meter-note">Caps at ×${formatPctMult(hpCap)} HP · ×${formatPctMult(dmgCap)} DMG</span>
      </div>`;
    }
    const bonus = s.tenureCombatBonus || Math.round(Math.min(10, s.tenure * 0.6));
    const fill = Math.min(100, s.tenure * 10);
    return `<div class="tenure-meter">
      <span class="tenure-meter-label">Field tenure · ${s.tenure} wave${s.tenure > 1 ? 's' : ''}${s.spawnWave != null ? ` (since W${s.spawnWave})` : ''}</span>
      <div class="tenure-bar-track"><div class="tenure-bar-fill tenure-soft" style="width:${fill}%"></div></div>
      <span class="tenure-meter-note">+${bonus}% combat pace offset vs wave pressure</span>
    </div>`;
  }

  function formatScaling(u) {
    const s = u.scaling;
    if (!s) return '';
    if (s.kind === 'doomslayer') {
      return `<div class="unit-info-scaling">
        <span class="scaling-title">Scaling</span>
        <span class="scaling-chip doom">Hellwalker — fixed blade; heals 50% missing HP every 2 waves</span>
      </div>`;
    }
    if (s.kind === 'ip') {
      const tenureLine =
        s.tenure > 0
          ? `<span class="scaling-chip tenure">Tenure ${s.tenure}w · HP ×${formatPctMult(s.tenureHpPct)} · DMG ×${formatPctMult(s.tenureDmgPct)}</span>`
          : `<span class="scaling-chip tenure-dim">New deploy (W${s.spawnWave ?? '?'}) — tenure bonus grows each survived wave</span>`;
      return `<div class="unit-info-scaling">
        <span class="scaling-title">Tenure &amp; Wave Scaling</span>
        <span class="scaling-chip wave">Wave HP ×${formatPctMult(s.waveHpPct)} · DMG ×${formatPctMult(s.waveDmgPct)}</span>
        ${tenureLine}
        ${formatTenureBar(s)}
        <span class="scaling-chip combined">Effective ${s.hpPct}% HP · ${s.dmgPct}% DMG</span>
        <span class="scaling-chip tenure-dim">Evolved operatives auto-scale with wave + tenure each dawn.</span>
      </div>`;
    }
    if (s.kind === 'vanilla') {
      const warn = s.combatPct < 85 ? ' warn' : '';
      const tenure =
        s.tenure > 0
          ? `<span class="scaling-chip tenure">Field ${s.tenure} wave${s.tenure > 1 ? 's' : ''}${s.tenureCombatBonus ? ` (+${s.tenureCombatBonus}% eff.)` : ''}</span>`
          : '<span class="scaling-chip tenure-dim">Fresh deploy — tenure softens obsolete pressure over time</span>';
      const vet = s.vetOffsetPct
        ? `<span class="scaling-chip vet">Vet −${s.vetOffsetPct}% pressure</span>`
        : '';
      return `<div class="unit-info-scaling">
        <span class="scaling-title">Tenure &amp; Combat Pace</span>
        <span class="scaling-chip combat${warn}">Combat ${s.combatPct}% vs wave</span>
        ${tenure}${vet}
        ${formatTenureBar(s)}
        <span class="scaling-chip tenure-dim">Promote with TP (Veteran Doctrine) to restore full combat %.</span>
      </div>`;
    }
    if (s.kind === 'specialist') {
      const rankPct =
        s.rankProgressPct ??
        (s.maxRankTier > 0 ? Math.round((s.rankTier / s.maxRankTier) * 100) : 0);
      const lateHint =
        s.lateAbilityName && !s.lateAbilityUnlocked
          ? `<span class="scaling-chip tenure-dim">${s.lateAbilityTier || 3} gold stars unlocks ${escapeHtml(s.lateAbilityName)}</span>`
          : s.lateAbilityUnlocked
            ? `<span class="scaling-chip specialist-active">✦ ${escapeHtml(s.lateAbilityName)} active</span>`
            : '';
      return `<div class="unit-info-scaling">
        <span class="scaling-title">Specialist Rank &amp; Tenure</span>
        <span class="scaling-chip tenure">${escapeHtml(s.rankLabel || 'Unranked')} · V${s.rankTier || 0}/${s.maxRankTier || 6}</span>
        <div class="tenure-meter">
          <span class="tenure-meter-label">Rank progress to V${s.maxRankTier || 6}</span>
          <div class="tenure-bar-track"><div class="tenure-bar-fill specialist" style="width:${rankPct}%"></div></div>
        </div>
        ${s.tenureNote ? `<span class="scaling-chip tenure">${escapeHtml(s.tenureNote)}</span>` : '<span class="scaling-chip tenure-dim">Fresh deploy — work each wave to earn ranks.</span>'}
        <span class="scaling-chip tenure-dim">Heal, build, or dispatch once per wave — or promote with TP after Veteran Doctrine.</span>
        ${lateHint}
      </div>`;
    }
    return '';
  }

  function formatLateAbility(u) {
    const a = u.lateAbility;
    if (!a) return '';
    const needStars = a.unlockGoldStars || a.unlockTier || 3;
    const header = `<span class="scaling-title">Extra Ability (${needStars} gold stars)</span>`;
    if (a.unlocked) {
      return `<div class="unit-info-ability unlocked">
        ${header}
        <span class="ability-chip unlocked active" title="${escapeHtml(a.desc)}">✦ ${escapeHtml(a.name)} — ACTIVE</span>
        <span class="ability-desc">${escapeHtml(a.desc)}</span>
        <span class="scaling-chip tenure-dim">Unlocked at ${escapeHtml(a.unlockRank || `${needStars} gold stars`)}</span>
      </div>`;
    }
    const earned = a.goldStarsEarned || 0;
    const need =
      a.rankNeeded === 1 ? '1 gold star to unlock' : `${a.rankNeeded} gold stars to unlock`;
    const prog =
      needStars > 0 ? Math.min(100, Math.round((earned / needStars) * 100)) : 0;
    const promoteHint = u.canVetUpgrade
      ? ' — eligible for TP promotion now'
      : ' — work each wave (gold-star credit) or earn gold stars in battle';
    return `<div class="unit-info-ability locked">
      ${header}
      <span class="ability-chip locked">◇ ${escapeHtml(a.name)} · ${needStars} gold stars</span>
      <div class="tenure-meter">
        <span class="tenure-meter-label">♛${earned} → ♛${needStars} · ${need}</span>
        <div class="tenure-bar-track"><div class="tenure-bar-fill ability" style="width:${prog}%"></div></div>
      </div>
      <span class="ability-desc">${escapeHtml(a.desc)}</span>
      <span class="scaling-chip tenure-dim">${escapeHtml(promoteHint.trim())}</span>
    </div>`;
  }

  function updateUnitPanel(gs) {
    const panel = document.getElementById('unit-info-panel');
    if (!panel) return;
    if (!Game.isPlaying?.() || gs.state !== 'playing') {
      panel.classList.remove('visible');
      return;
    }
    const info = Game.getSelectedUnitsInfo?.() || [];
    if (!info.length) {
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
      lastUnitPanelKey = '';
      lastUnitPanelStructure = '';
      return;
    }
    panel.classList.add('visible');
    panel.setAttribute('aria-hidden', 'false');
    const multi = info.length > 1;
    const body = document.getElementById('unit-info-body');
    if (!body) return;

    // Include vet stars / promote eligibility so rank-ups refresh the panel while selected.
    const structureKey = multi
      ? `m:${info.length}:${gs.selectionFormationLabel || 'Box'}`
      : `s:${info[0].id}:${info[0].huntMode ? 1 : 0}:${info[0].vetBronze || 0}:${info[0].vetSilver || 0}:${info[0].vetGold || 0}:${info[0].vetTier || 0}:${info[0].canVetUpgrade ? 1 : 0}:${info[0].vetUpgradeEligible ? 1 : 0}:${info[0].canPromote ? 1 : 0}:${info[0].honorName || ''}`;

    if (!multi) {
      const u = info[0];
      const barKey = `${u.id}:${Math.floor(u.hp)}:${Math.floor(u.morale ?? 0)}:${u.damage || 0}`;
      if (structureKey === lastUnitPanelStructure) {
        if (barKey === lastUnitPanelKey) return;
        const hpFill = body.querySelector('.unit-bar-fill.hp');
        if (hpFill) {
          const hpPct = Math.round((u.hp / u.maxHp) * 100);
          const moralePct = u.maxMorale > 0 ? Math.round((u.morale / u.maxMorale) * 100) : 0;
          hpFill.style.width = `${hpPct}%`;
          const moraleFill = body.querySelector('.unit-bar-fill.morale');
          if (moraleFill) moraleFill.style.width = `${moralePct}%`;
          const barLabels = body.querySelectorAll('.unit-info-bars .unit-bar > span:last-child');
          if (barLabels[0]) barLabels[0].textContent = `${Math.ceil(u.hp)}/${u.maxHp}`;
          if (barLabels[1] && u.maxMorale > 0) barLabels[1].textContent = `${Math.ceil(u.morale)}`;
          // Keep combat chips in sync when damage rises from star bumps.
          const dmgChip = body.querySelector('.unit-info-combat .combat-chip');
          if (dmgChip && dmgChip.textContent.startsWith('DMG')) {
            dmgChip.textContent = `DMG ${u.damage ?? '—'}`;
          }
          lastUnitPanelKey = barKey;
          return;
        }
      }
      lastUnitPanelKey = barKey;
    } else if (structureKey === lastUnitPanelStructure) {
      return;
    }

    lastUnitPanelStructure = structureKey;

    if (multi) {
      const avgHp = Math.round(
        info.reduce((s, u) => s + (u.hp / Math.max(1, u.maxHp)) * 100, 0) / info.length
      );
      const totalDmg = info.reduce((s, u) => s + (u.damage || 0), 0);
      const wounded = info.filter((u) => u.hp / u.maxHp < 0.35).length;
      body.innerHTML = `
        <div class="unit-info-head"><span class="unit-info-name">${info.length} units selected</span></div>
        <div class="unit-info-combat multi">
          <span class="combat-chip">AVG HP ${avgHp}%</span>
          <span class="combat-chip">Σ DMG ${Math.round(totalDmg)}</span>
          ${wounded ? `<span class="combat-chip warn">${wounded} wounded</span>` : ''}
        </div>
        <div class="unit-info-row">Drag-select · ${escapeHtml(Game.getState?.()?.selectionFormationLabel || 'Box')} formation · G reform · click map to move</div>
        <div class="unit-info-chips">${info
          .slice(0, 8)
          .map((u) => `<span class="unit-chip">${escapeHtml(u.displayName)}</span>`)
          .join(
            ''
          )}${info.length > 8 ? `<span class="unit-chip">+${info.length - 8}</span>` : ''}</div>
        <div class="unit-info-actions formation-quick-row">
          <button class="unit-quick-btn" data-action="form-line" title="Line (Alt+1)">Line</button>
          <button class="unit-quick-btn" data-action="form-column" title="Column (Alt+2)">Col</button>
          <button class="unit-quick-btn" data-action="form-wedge" title="Wedge (Alt+3)">Wedge</button>
          <button class="unit-quick-btn" data-action="form-box" title="Box (Alt+4)">Box</button>
          <button class="unit-quick-btn" data-action="form-spread" title="Spread (Alt+5)">Spread</button>
        </div>
        <div class="unit-info-actions">
          <button class="unit-quick-btn" data-action="form-reform" title="Reform in place (G)">Reform</button>
          <button class="unit-quick-btn" data-action="hunt-on" title="Enable hunt">Hunt</button>
          <button class="unit-quick-btn" data-action="hunt-off" title="Disable hunt">Hold</button>
          <button class="unit-quick-btn" data-action="focus" title="Center camera">Focus</button>
          <button class="unit-quick-btn" data-action="deselect" title="Clear selection">Deselect</button>
        </div>
      `;
    } else {
      const u = info[0];
      const hpPct = Math.round((u.hp / u.maxHp) * 100);
      const moralePct = u.maxMorale > 0 ? Math.round((u.morale / u.maxMorale) * 100) : 0;
      body.innerHTML = `
        <div class="unit-info-head">
          <canvas class="unit-info-icon" data-sprite="${u.spriteType}" width="32" height="32"></canvas>
          <div>
            <div class="unit-info-name">${escapeHtml(u.displayName)}${u.honorName ? ' <span class="honor-badge">Honor</span>' : ''}</div>
            <div class="unit-info-role">${escapeHtml(u.roleLabel || u.type)}</div>
          </div>
        </div>
        <div class="unit-info-stars">${formatStars(u)}</div>
        <div class="unit-info-bars">
          <div class="unit-bar"><span>HP</span><div class="unit-bar-track"><div class="unit-bar-fill hp" style="width:${hpPct}%"></div></div><span>${Math.ceil(u.hp)}/${u.maxHp}</span></div>
          ${u.maxMorale > 0 ? `<div class="unit-bar"><span>MR</span><div class="unit-bar-track"><div class="unit-bar-fill morale" style="width:${moralePct}%"></div></div><span>${Math.ceil(u.morale)}</span></div>` : ''}
        </div>
        <div class="unit-info-combat">
          <span class="combat-chip" title="Damage per hit">DMG ${u.damage ?? '—'}</span>
          <span class="combat-chip" title="Attack range">${(u.combatType || '') === 'ranged' || (u.range || 0) > (u.meleeRange || 0) + 2 ? 'RNG' : 'MEL'} ${u.range ?? u.meleeRange ?? '—'}</span>
          <span class="combat-chip" title="Accuracy">ACC ${u.accuracy ?? '—'}%</span>
          <span class="combat-chip" title="Move speed">SPD ${u.speed ?? '—'}</span>
          ${u.experience > 0 ? `<span class="combat-chip" title="Combat experience">XP ${u.experience}</span>` : ''}
        </div>
        ${formatScaling(u)}
        ${formatLateAbility(u)}
        <div class="unit-info-row perks-row"><span>Perks</span> ${formatPerks(u)}</div>
        ${u.status ? `<div class="unit-info-status">${escapeHtml(u.status)}</div>` : ''}
        ${
          u.scaling?.kind === 'vanilla' && u.obsoletePct != null && u.obsoletePct < 90
            ? (() => {
                let hint =
                  u.obsoletePct < 85
                    ? 'Below wave pace — promote with TP or deploy evolved operatives.'
                    : `Combat ${u.obsoletePct}% — promote to close the gap.`;
                return `<div class="unit-info-status obsolete-hint">${escapeHtml(hint)}</div>`;
              })()
            : ''
        }
        ${
          u.scaling?.kind === 'specialist' && u.lateAbility && !u.lateAbility.unlocked
            ? (() => {
                const need = u.lateAbility.unlockGoldStars || u.lateAbility.unlockTier || 3;
                const earned = u.lateAbility.goldStarsEarned || 0;
                let hint = `Earn ${need} gold stars to unlock ${u.lateAbility.name} (${earned}/${need}).`;
                if (u.canVetUpgrade)
                  hint = `Promote now (${u.vetUpgradeCost} TP). ${u.lateAbility.name} unlocks at ${need} gold stars.`;
                else hint += ' Work each wave for a gold-star credit toward the ability.';
                return `<div class="unit-info-status specialist-hint">${escapeHtml(hint)}</div>`;
              })()
            : ''
        }
        <div class="unit-info-actions">
          <button class="unit-quick-btn" data-action="hunt-toggle" title="Toggle hunt">${u.huntMode ? 'Hold Position' : 'Hunt'}</button>
          <button class="unit-quick-btn" data-action="focus" title="Center camera">Focus</button>
          <button class="unit-quick-btn" data-action="deselect" title="Clear selection">Deselect</button>
          ${u.ascensionLabel ? `<div class="unit-info-status ascension-badge">${escapeHtml(u.ascensionLabel)}${u.ascensionWeapon ? ` · ${escapeHtml(u.ascensionWeapon)}` : ''}</div>` : ''}
          ${u.ancestralWeapon ? '<div class="unit-info-status ancestral-badge">Ancestral Arms</div>' : ''}
          ${u.wizardKing ? '<div class="unit-info-status wizard-king-badge">Wizard-King</div>' : ''}
          ${
            u.honorLegion
              ? `<div class="unit-info-status honor-legion-badge">Honor Legion${u.honorMeleeOnly ? ' · sword & shield' : ''}</div>`
              : ''
          }
          ${u.crownLegend ? `<div class="unit-info-status crown-legend-badge">Legend: ${escapeHtml(u.crownLegend)}</div>` : ''}
          ${
            u.ascensionOffer
              ? `<button class="unit-quick-btn ascension-btn" data-action="ascend" title="${escapeHtml(u.ascensionOffer.stage.desc || u.ascensionOffer.stage.label)}">Ascend — ${escapeHtml(u.ascensionOffer.stage.label)} (${u.ascensionOffer.cost} Legacy)</button>`
              : ''
          }
          ${
            u.echoOffer
              ? `<button class="unit-quick-btn echo-btn" data-action="recruit-echo" title="${escapeHtml(u.echoOffer.label)}">Echo — ${escapeHtml(u.echoOffer.short)} (${u.echoOffer.cost} LP)</button>`
              : ''
          }
          ${
            u.canVetUpgrade
              ? `<button class="unit-quick-btn vet-upgrade-btn" data-action="vet-upgrade" title="Spend TP to promote (U)">Promote (${u.vetUpgradeCost} TP)</button>`
              : u.vetUpgradeEligible
                ? `<button class="unit-quick-btn vet-upgrade-btn locked" data-action="vet-upgrade" title="Research Veteran Doctrine (wave 12+) to spend TP">Promote — need Veteran Doctrine</button>`
                : ''
          }
          ${u.canPromote ? '<button class="unit-quick-btn" data-action="promote" title="Promote to General">General</button>' : ''}
        </div>
      `;
      const icon = body.querySelector('.unit-info-icon');
      if (icon && SpriteGen?.UNIT_STYLE?.[u.spriteType]) {
        SpriteGen.drawIcon(icon.getContext('2d'), u.spriteType);
      }
    }
    bindUnitQuickActions();
  }

  function bindUnitQuickActions() {
    document.querySelectorAll('.unit-quick-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        AudioEngine?.SFX?.click?.();
        if (action === 'focus') Game.focusSelection?.();
        else if (action === 'deselect') Game.clearSelection?.();
        else if (action === 'hunt-toggle') Game.toggleSelectedHunt?.();
        else if (action === 'hunt-on') Game.setSelectedHunt?.(true);
        else if (action === 'hunt-off') Game.setSelectedHunt?.(false);
        else if (action === 'promote') Game.creativePromoteSelectedGeneral?.();
        else if (action === 'vet-upgrade') Game.upgradeSelectedVeteran?.();
        else if (action === 'ascend') Game.ascendSelectedUnit?.();
        else if (action === 'recruit-echo') Game.recruitSelectedEcho?.();
        else if (action?.startsWith('form-')) {
          const map = {
            'form-line': 'line',
            'form-column': 'column',
            'form-wedge': 'wedge',
            'form-box': 'box',
            'form-spread': 'spread',
            'form-reform': null,
          };
          if (action === 'form-reform') Game.reformSelectionFormation?.();
          else if (map[action]) {
            Game.setSelectionFormation?.(map[action]);
            Game.reformSelectionFormation?.(map[action]);
          }
        }
        UI.updateHUD(true);
      };
    });
  }

  function hasActiveOrder(gs) {
    return !!(
      gs.selectedDeploy ||
      gs.selectedBuild ||
      gs.selectedAbility ||
      gs.selectedDemolish ||
      gs.selectedMoveBuilding ||
      gs.selectedRotateWall
    );
  }

  function bindHintBarActions() {
    document.getElementById('hint-cancel-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      Game.clearPlacementMode?.();
      UI.updateHUD(true);
    });
    document.getElementById('hint-log-btn')?.addEventListener('click', toggleMessageLog);
  }

  function updateHintBar(gs) {
    const bar = document.getElementById('hint-bar');
    if (!bar || gs.creativeMode) return;
    if (Settings?.get('showHintBar') === false) return;
    let hint = '';
    if (gs.paused) hint = 'PAUSED — Space or Resume to continue · Esc for pause menu';
    else if (gs.selectedDeploy)
      hint = `Deploy ${getPlayerUnitDef(gs.selectedDeploy)?.name || gs.selectedDeploy} — click map · Shift+click place more · Esc/Cancel`;
    else if (gs.selectedBuild === 'wall')
      hint = `Build Wall (facing ${gs.pendingWallFacing || 'north'}) — R rotate · click map · Esc/Cancel`;
    else if (gs.selectedBuild)
      hint = `Build ${BuildDefs[gs.selectedBuild]?.name || gs.selectedBuild} — click map · Esc/Cancel`;
    else if (gs.selectedAbility)
      hint = `Strike: ${Abilities[gs.selectedAbility]?.name || gs.selectedAbility} — click target · Esc/Cancel`;
    else if (gs.selectedDemolish)
      hint = 'Demolish — click your structure (50% TP refund) · Esc/Cancel';
    else if (gs.selectedMoveBuilding)
      hint = gs.moveBuildingType
        ? `Move ${BuildDefs[gs.moveBuildingType]?.name || 'structure'} — click destination · Esc/Cancel`
        : 'Move building — click structure, then destination (free) · Esc/Cancel';
    else if (gs.selectedRotateWall)
      hint = 'Rotate wall — click a wall to turn 90° (free) · Esc/Cancel';
    else if (gs.timeOfDay === 'night') {
      const tip = gs.feedback?.nightTips?.[0]?.text;
      hint = tip
        ? `Night (${gs.nightSecondsLeft ?? 60}s) — ${tip} · D begins day`
        : `Night prep (${gs.nightSecondsLeft ?? 60}s) — D or BEGIN DAY · builders +35% · Shift+drag select`;
    } else if ((gs.territoryTier ?? 0) > 0)
      hint = 'Drag empty map to box-select · Shift+drag · G reform · F focus · Tab log · Space pause';
    else
      hint =
        'Drag empty map to select · Shift+drag · G formation · Right-click deselect · C clear · Tab log';

    if (gs.story?.branchLabel) {
      hint = `${gs.story.branchLabel}${gs.story.summary ? ` — ${gs.story.summary}` : ''} · ${hint}`;
    } else if (gs.online?.statusLine) {
      hint = `${gs.online.statusLine} · ${hint}`;
    }

    const showCancel = hasActiveOrder(gs);
    const key = `${hint}|${showCancel}|${gs.wave || 0}`;
    if (key === lastHintKey) return;
    lastHintKey = key;
    const cancelBtn = showCancel
      ? '<button id="hint-cancel-btn" class="hint-cancel-btn" type="button" title="Cancel order (Esc)">Cancel</button>'
      : '';
    bar.innerHTML = `<span class="hint-text">${hint}</span>${cancelBtn}<button id="hint-log-btn" class="hint-log-btn" title="Message history (Tab)" aria-label="Open message log">📜</button>`;
    bindHintBarActions();
  }

  function toggleMessageLog() {
    const panel = document.getElementById('message-log-panel');
    if (!panel) return;
    const open = panel.classList.toggle('open');
    if (open) renderMessageLog();
    AudioEngine?.SFX?.click?.();
  }

  function updatePauseMenu(gs) {
    const screen = document.getElementById('pause-screen');
    if (!screen) return;
    const shouldShow = gs.state === 'playing' && gs.paused && pauseOpen && !pauseOverlayHidden;
    screen.classList.toggle('active', shouldShow);
    if (!shouldShow) return;

    if (typeof SaveManager !== 'undefined') SaveManager.renderPauseSlots();

    const stats = document.getElementById('pause-stats');
    if (stats) {
      const fb = gs.feedback || {};
      const last = fb.lastSummary;
      const losses = gs.playerDeaths ?? gs.misses ?? 0;
      const kd = losses > 0 ? ((gs.kills || 0) / losses).toFixed(1) : String(gs.kills ?? 0);
      stats.innerHTML = `
        <div class="pause-stat"><span>Wave</span><strong>${gs.wave}</strong></div>
        <div class="pause-stat"><span>TP</span><strong>${Math.floor(gs.tactical)}</strong></div>
        <div class="pause-stat"><span>Kills</span><strong>${gs.kills ?? 0}</strong></div>
        <div class="pause-stat"><span>K/D</span><strong>${kd}</strong></div>
        <div class="pause-stat"><span>Army</span><strong>${gs.army}</strong></div>
        <div class="pause-stat"><span>Training</span><strong>${gs.unitProducers ?? 0}</strong></div>
        <div class="pause-stat"><span>Land</span><strong>${gs.territoryTier || 0}</strong></div>
        <div class="pause-stat"><span>Best streak</span><strong>${fb.bestStreak || 0}</strong></div>
        <div class="pause-stat"><span>Clean sweeps</span><strong>${fb.cleanSweeps || 0}</strong></div>
        <div class="pause-stat wide"><span>Difficulty</span><strong>${gs.difficultyLabel} ${gs.difficultyPercent}%</strong></div>
        <div class="pause-stat wide"><span>Cycle</span><strong>${gs.timeOfDay === 'night' ? 'Night prep' : 'Day assault'}</strong></div>
        <div class="pause-stat"><span>Speed</span><strong>${gs.gameSpeed ?? 1}×</strong></div>
        ${
          last
            ? `<div class="pause-stat wide"><span>Last clear</span><strong>W${last.wave}: +${last.tp} TP · ${last.kills}k / ${last.deaths}d${last.perfect ? ' · CLEAN' : ''}</strong></div>`
            : ''
        }
        ${gs.gameMode ? `<div class="pause-stat wide"><span>Mode</span><strong>${gs.gameMode.challengeLabel || gs.gameMode.modeId}${gs.gameMode.ironman ? ' · Ironman' : ''}</strong></div>` : ''}
        ${
          gs.timeOfDay === 'night' && gs.nextWaveIntel
            ? `<div class="pause-stat wide"><span>Next wave</span><strong>${escapeHtml(String(gs.nextWaveIntel).slice(0, 120))}</strong></div>`
            : ''
        }
      `;
    }
    const tipsEl = document.getElementById('pause-scaling-tips');
    if (tipsEl && gs.scalingTips?.length) {
      tipsEl.innerHTML = `<div class="pause-tips-title">Recommended path</div><ul>${gs.scalingTips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
    }
    const shortcutsEl = document.getElementById('pause-shortcuts');
    if (shortcutsEl) {
      shortcutsEl.innerHTML = `
        <div class="pause-shortcuts-title">Shortcuts</div>
        <div class="pause-shortcuts-items">
          ${PAUSE_SHORTCUTS.map(
            (s) => `
            <div class="pause-shortcut">
              <kbd>${escapeHtml(s.keys)}</kbd><span>${escapeHtml(s.label)}</span>
            </div>
          `
          ).join('')}
        </div>`;
    }
    const qsBtn = document.getElementById('pause-quicksave');
    const qlBtn = document.getElementById('pause-quickload');
    const rwBtn = document.getElementById('pause-restart-wave');
    const iron =
      gs.gameMode?.ironman || gs.gameMode?.modeId === 'daily' || gs.gameMode?.modeId === 'weekly';
    if (qsBtn) qsBtn.disabled = iron;
    if (qlBtn) qlBtn.disabled = iron;
    if (rwBtn) rwBtn.disabled = !!gs.gameMode?.ironman;
    const qsPanel = document.getElementById('pause-quicksave-panel');
    if (qsPanel && typeof SaveThumbnail !== 'undefined') {
      SaveThumbnail.renderQuickSavePanel(qsPanel, Game.getQuickSaveMeta?.());
    }

    const handoffBtn = document.getElementById('pause-coop-handoff');
    const onlinePanel = document.getElementById('pause-online-panel');
    const isCoop =
      gs.online?.type === 'coop' ||
      gs.gameMode?.onlineCoop ||
      gs.gameMode?.displayModeId === 'async_coop';
    if (handoffBtn) {
      handoffBtn.hidden = !isCoop;
      handoffBtn.disabled = isCoop && gs.online && !gs.online.myTurn;
    }
    if (onlinePanel) {
      if (gs.online?.statusLine) {
        onlinePanel.hidden = false;
        onlinePanel.innerHTML = `<div class="pause-online-title">Online</div><p>${escapeHtml(gs.online.statusLine)}</p>`;
      } else {
        onlinePanel.hidden = true;
        onlinePanel.innerHTML = '';
      }
    }
  }

  function openPauseMenu() {
    if (!Game.isPlaying?.()) return;
    const gs = Game.getState();
    if (!gs.paused) Game.setPaused?.(true);
    pauseOpen = true;
    pauseOverlayHidden = false;
    updatePauseMenu(gs);
    announce('Game paused. Pause menu open.');
  }

  function suppressPauseForOverlay() {
    pauseOverlayHidden = true;
    document.getElementById('pause-screen')?.classList.remove('active');
  }

  function closePauseMenu(resume = false) {
    pauseOpen = false;
    pauseOverlayHidden = false;
    document.getElementById('pause-screen')?.classList.remove('active');
    if (resume) Game.setPaused?.(false);
  }

  function resetTutorial() {
    tutorialDismissed = false;
    tutorialStep = 0;
    tutorialDisplayIndex = -1;
    saveTutorialProgress();
  }

  function bindPauseMenu() {
    document.getElementById('pause-resume')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      closePauseMenu(true);
    });
    document.getElementById('pause-quicksave')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      if (Game.quickSave?.()) onMessage('Quick save stored.', 'system');
    });
    document.getElementById('pause-quickload')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      if (Game.quickLoad?.()) closePauseMenu(false);
    });
    document.getElementById('pause-restart-wave')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      Game.restartCurrentWave?.();
      UI.updateHUD(true);
    });
    document.getElementById('pause-menu')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      closePauseMenu(false);
      Game.quitToMenu?.();
    });
    document.getElementById('top-pause-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      if (pauseOpen) closePauseMenu(true);
      else openPauseMenu();
    });
  }

  function drawMinimap() {
    if (!Settings?.get('showMinimap') || !minimapCtx || !Game.isPlaying?.()) return;
    const data = Game.getMinimapData?.();
    if (!data) return;
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    minimapCtx.clearRect(0, 0, w, h);
    minimapCtx.fillStyle = 'rgba(12,10,8,0.92)';
    minimapCtx.fillRect(0, 0, w, h);
    const sx = w / data.worldW;
    const sy = h / data.worldH;

    minimapCtx.strokeStyle = 'rgba(90,72,48,0.8)';
    minimapCtx.strokeRect(0.5, 0.5, w - 1, h - 1);

    const lp = data.livingPlanet;
    if (lp?.bands?.length) {
      for (const band of lp.bands) {
        if (band.x0 != null) {
          minimapCtx.fillStyle = band.tint || 'rgba(60,80,50,0.2)';
          minimapCtx.fillRect(
            band.x0 * sx,
            band.y0 * sy,
            (band.x1 - band.x0) * sx,
            (band.y1 - band.y0) * sy
          );
        } else if (band.y1 > band.y0) {
          minimapCtx.fillStyle = band.tint || 'rgba(60,80,50,0.2)';
          minimapCtx.fillRect(0, band.y0 * sy, w, (band.y1 - band.y0) * sy);
        }
      }
    }

    const pw = data.planetWarfare;
    if (pw?.active && pw.hostileLineY) {
      const ly = pw.hostileLineY * sy;
      const grad = minimapCtx.createLinearGradient(0, 0, 0, ly + 4);
      grad.addColorStop(0, `rgba(140, 30, 40, ${0.35 + (pw.hostileControl || 0) * 0.3})`);
      grad.addColorStop(1, 'rgba(60, 20, 28, 0)');
      minimapCtx.fillStyle = grad;
      minimapCtx.fillRect(0, 0, w, ly + 2);
      minimapCtx.strokeStyle = 'rgba(255, 80, 70, 0.65)';
      minimapCtx.setLineDash([3, 3]);
      minimapCtx.beginPath();
      minimapCtx.moveTo(0, ly);
      minimapCtx.lineTo(w, ly);
      minimapCtx.stroke();
      minimapCtx.setLineDash([]);
    }

    let flankLabel = null;
    if (typeof VisualPolish !== 'undefined') {
      flankLabel = VisualPolish.drawMinimapOverlay(minimapCtx, w, h, data, 'bands');
    }

    for (const b of data.buildings) {
      minimapCtx.fillStyle =
        b.owner === 'enemy' ? '#804040' : b.isSettlement ? '#a08040' : '#506050';
      minimapCtx.fillRect(b.x * sx - 1, b.y * sy - 1, 3, 3);
    }
    for (const u of data.units) {
      minimapCtx.fillStyle =
        u.team === 'player' ? '#60a0ff' : u.team === 'neutral' ? '#c0a040' : '#ff5050';
      minimapCtx.fillRect(u.x * sx - 1, u.y * sy - 1, 2, 2);
    }

    if (typeof VisualPolish !== 'undefined') {
      flankLabel = VisualPolish.drawMinimapOverlay(minimapCtx, w, h, data, 'overlay') || flankLabel;
    }

    const vx = data.viewX * sx;
    const vy = data.viewY * sy;
    const vw = data.viewW * sx;
    const vh = data.viewH * sy;
    minimapCtx.strokeStyle = 'rgba(240,200,100,0.9)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(vx, vy, vw, vh);

    minimapCtx.font = '7px Cinzel';
    minimapCtx.textAlign = 'right';
    minimapCtx.textBaseline = 'top';
    let labelY = 8;
    if (flankLabel) {
      minimapCtx.fillStyle = 'rgba(255,150,100,0.9)';
      minimapCtx.fillText(flankLabel, w - 4, labelY);
      labelY += 10;
    }
    if (pw?.active) {
      minimapCtx.fillStyle = pw.tierColor || 'rgba(255,120,100,0.85)';
      minimapCtx.fillText(`Host ${pw.hostileControlPct}%`, w - 4, labelY);
    } else if (lp?.summary) {
      minimapCtx.fillStyle = 'rgba(120,160,110,0.8)';
      minimapCtx.fillText(lp.summary.slice(0, 18), w - 4, labelY);
    } else if (data.territoryTier > 0) {
      minimapCtx.fillStyle = 'rgba(200,160,80,0.7)';
      minimapCtx.fillText(`Land ${data.territoryTier}`, w - 4, labelY);
    }

    const panel = document.getElementById('minimap-panel');
    if (panel) {
      const unlocked = data.unlockedAttackSides || ['north'];
      const sides = data.attackSides || ['north'];
      if (unlocked.length > 1) {
        const active = sides.join(', ');
        const quiet = unlocked.filter((s) => !sides.includes(s));
        panel.title =
          `Minimap — active: ${active}` +
          (quiet.length ? ` · quiet: ${quiet.join(', ')}` : '') +
          (data.multiFront?.intel ? ` · ${data.multiFront.intel}` : '') +
          ' — click to pan';
      } else {
        panel.title = 'Strategic overview — assaults from the north — click to pan';
      }
    }
  }

  function minimapFractionFromEvent(e) {
    const rect = minimapCanvas.getBoundingClientRect();
    return {
      fx: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      fy: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function bindMinimap() {
    minimapCanvas = document.getElementById('minimap-canvas');
    if (!minimapCanvas) return;
    minimapCtx = minimapCanvas.getContext('2d');
    let dragging = false;
    minimapCanvas.addEventListener('pointerdown', (e) => {
      if (!Game.isPlaying?.()) return;
      dragging = true;
      minimapCanvas.setPointerCapture?.(e.pointerId);
      const { fx, fy } = minimapFractionFromEvent(e);
      Game.panCameraToFraction?.(fx, fy);
    });
    minimapCanvas.addEventListener('pointermove', (e) => {
      if (!dragging || !Game.isPlaying?.()) return;
      const { fx, fy } = minimapFractionFromEvent(e);
      Game.panCameraToFraction?.(fx, fy);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        minimapCanvas.releasePointerCapture?.(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      AudioEngine?.SFX?.click?.();
    };
    minimapCanvas.addEventListener('pointerup', endDrag);
    minimapCanvas.addEventListener('pointercancel', endDrag);
  }

  function clearTutorialHighlights() {
    document
      .querySelectorAll('.tutorial-highlight')
      .forEach((n) => n.classList.remove('tutorial-highlight'));
    if (tutorialRevealEl) {
      tutorialRevealEl.style.display = '';
      tutorialRevealEl = null;
    }
  }

  function revealTutorialTarget(target) {
    if (!target) return;
    const hidden =
      target.style.display === 'none' ||
      getComputedStyle(target).display === 'none' ||
      target.offsetParent === null;
    if (hidden && !tutorialRevealEl) {
      target.style.display = '';
      tutorialRevealEl = target;
    }
    target.classList.add('tutorial-highlight');
  }

  function updateTutorial(gs) {
    if (
      !Settings?.get('tutorialEnabled') ||
      tutorialDismissed ||
      !Game.isPlaying?.() ||
      gs.creativeMode
    ) {
      document.getElementById('tutorial-callout')?.classList.remove('visible');
      clearTutorialHighlights();
      tutorialDisplayIndex = -1;
      return;
    }
    const resolved = resolveTutorialStep(gs);
    const el = document.getElementById('tutorial-callout');
    if (!el || !resolved) {
      el?.classList.remove('visible');
      clearTutorialHighlights();
      tutorialDisplayIndex = -1;
      return;
    }
    const { step, index } = resolved;
    tutorialDisplayIndex = index;
    el.classList.add('visible');
    const guided =
      typeof Onboarding !== 'undefined' && Onboarding.isGuidedRunActive?.();
    el.classList.toggle('guided-run', !!guided);
    el.querySelector('.tutorial-title').textContent = guided
      ? `Guided campaign · ${step.title}`
      : step.title;
    el.querySelector('.tutorial-body').innerHTML = step.body;
    clearTutorialHighlights();
    if (step.highlight) {
      revealTutorialTarget(document.getElementById(step.highlight));
    }
    const nextBtn = document.getElementById('tutorial-next');
    if (nextBtn) {
      const remaining = TUTORIAL_STEPS.length - index - 1;
      nextBtn.textContent = remaining > 0 ? 'Next tip' : 'Got it';
    }
  }

  function bindTutorial() {
    document.getElementById('tutorial-next')?.addEventListener('click', () => {
      tutorialStep = Math.max(tutorialStep, tutorialDisplayIndex + 1);
      saveTutorialProgress();
      AudioEngine?.SFX?.click?.();
      UI.updateHUD(true);
    });
    document.getElementById('tutorial-dismiss')?.addEventListener('click', () => {
      dismissTutorial();
      AudioEngine?.SFX?.click?.();
    });
  }

  function dismissTutorial() {
    tutorialDismissed = true;
    saveTutorialProgress();
    document.getElementById('tutorial-callout')?.classList.remove('visible');
    document.getElementById('tutorial-callout')?.classList.remove('guided-run');
    clearTutorialHighlights();
    if (typeof Onboarding !== 'undefined') Onboarding.onGuidedTutorialDismissed?.();
  }

  function bindHowToInteractive() {
    document.getElementById('howto-interactive-btn')?.addEventListener('click', () => {
      resetTutorial();
      Settings?.set('tutorialEnabled', true);
      document.getElementById('howto-panel')?.classList.add('hidden');
      AudioEngine?.SFX?.click?.();
      if (!Game.isPlaying?.()) {
        document.getElementById('start-btn')?.click();
      } else {
        UI.updateHUD(true);
      }
    });
  }

  const VICTORY_COPY = {
    economy: {
      title: 'CAMPAIGN WON!',
      subtitle: 'The northern host is broken — their war economy lies in ruins.',
      crest: '⚔',
    },
    planet_conquest: {
      title: 'TRUE VICTORY!',
      subtitle: 'The Worldheart Tyrant is shattered — every hostile realm is broken. The planet is yours.',
      crest: '☀',
    },
    default: {
      title: 'VICTORY!',
      subtitle: 'Your banner holds. The assault is turned.',
      crest: '✦',
    },
  };

  function spawnVictoryConfetti(host) {
    if (typeof Cosmetics !== 'undefined' && Cosmetics.spawnVictoryConfetti) {
      Cosmetics.spawnVictoryConfetti(host);
      return;
    }
    if (!host) return;
    host.innerHTML = '';
    const colors = ['#f0c040', '#ffd700', '#80c0ff', '#40e0a0', '#ff8060', '#e8d5b0'];
    for (let i = 0; i < 48; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 2.8}s`;
      piece.style.animationDuration = `${2.4 + Math.random() * 2}s`;
      piece.style.background = colors[i % colors.length];
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      host.appendChild(piece);
    }
  }

  function renderVictoryScreen(gs) {
    const screen = document.getElementById('gameover-screen');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const crest = document.getElementById('result-crest');
    const stats = document.getElementById('result-stats');
    const confetti = document.getElementById('gameover-confetti');
    if (!screen || !title || !stats) return;

    const isVictory = gs.state === 'victory';
    const reason = gs.victoryReason || 'default';
    const copy = isVictory ? VICTORY_COPY[reason] || VICTORY_COPY.default : null;

    screen.className = 'screen active';
    screen.classList.toggle('gameover-victory', isVictory);
    screen.classList.toggle('gameover-defeat', !isVictory);
    screen.classList.toggle('gameover-economy', isVictory && reason === 'economy');
    screen.classList.toggle('gameover-conquest', isVictory && reason === 'planet_conquest');
    const themeBackdrop =
      isVictory && typeof Cosmetics !== 'undefined' ? Cosmetics.getVictoryBackdropClass() : null;
    screen.classList.toggle('gameover-theme-imperial', themeBackdrop === 'theme-imperial');
    screen.classList.toggle('gameover-theme-crystal', themeBackdrop === 'theme-crystal');
    screen.classList.toggle('gameover-theme-blood', themeBackdrop === 'theme-blood');
    screen.classList.toggle('gameover-theme-void', themeBackdrop === 'theme-void');
    screen.classList.toggle('gameover-theme-conquest', themeBackdrop === 'theme-conquest');

    if (isVictory) {
      const themedCopy =
        typeof Cosmetics !== 'undefined' && Cosmetics.resolveVictoryCopy
          ? Cosmetics.resolveVictoryCopy(reason, copy)
          : copy;
      title.textContent = themedCopy.title;
      title.className = 'victory';
      if (subtitle) subtitle.textContent = themedCopy.subtitle;
      if (crest) {
        crest.textContent = themedCopy.crest;
        crest.hidden = false;
      }
      spawnVictoryConfetti(confetti);
    } else {
      title.textContent = 'DEFEAT';
      title.className = 'defeat';
      if (subtitle) subtitle.textContent = 'The line broke. Rally again when you are ready.';
      if (crest) {
        crest.textContent = '†';
        crest.hidden = false;
      }
      if (confetti) confetti.innerHTML = '';
    }

    const losses = gs.playerDeaths ?? gs.misses ?? 0;
    const ach = gs.achievements || { unlocked: 0, total: 316 };
    const kd = losses > 0 ? (gs.kills / losses).toFixed(1) : gs.kills;
    const fb = gs.feedback || {};
    stats.innerHTML = `
      <div class="result-stat-card"><span>Difficulty</span><strong>${escapeHtml(gs.difficultyLabel ?? 'Normal')}</strong><em>${gs.difficultyPercent ?? 100}%</em></div>
      <div class="result-stat-card"><span>Waves</span><strong>${gs.wave - 1}</strong><em>survived</em></div>
      <div class="result-stat-card"><span>Kills</span><strong>${gs.kills ?? 0}</strong><em>${kd} ratio</em></div>
      <div class="result-stat-card"><span>Losses</span><strong>${losses}</strong><em>fallen allies</em></div>
      <div class="result-stat-card"><span>Best streak</span><strong>${fb.bestStreak || 0}</strong><em>chain kills</em></div>
      <div class="result-stat-card"><span>Clean sweeps</span><strong>${fb.cleanSweeps || 0}</strong><em>0-casualty clears</em></div>
      <div class="result-stat-card wide"><span>Achievements</span><strong>${ach.unlocked} / ${ach.total}</strong><em>Iron Creed</em></div>
      ${
        gs.tpPerRound
          ? `<div class="result-stat-card wide"><span>Peak economy</span><strong>+${gs.tpPerRound} TP/round</strong><em>settlements ${gs.settlementTpBonus || 0}</em></div>`
          : ''
      }
    `;

    renderPostGameHighlights(gs);
  }

  function renderPostGameHighlights(gs) {
    const el = document.getElementById('result-highlights');
    if (!el) return;
    const highlights = Game.getSessionHighlights?.() || [];
    if (!highlights.length) {
      el.innerHTML = '<p class="result-highlights-empty">No recorded highlights this run.</p>';
      return;
    }
    el.innerHTML = `
      <div class="result-highlights-title">Key Moments</div>
      <ul class="result-highlights-list">${highlights
        .slice(-12)
        .reverse()
        .map((h) => `<li><span class="hl-wave">W${h.wave}</span> ${escapeHtml(h.text)}</li>`)
        .join('')}</ul>
    `;
  }

  function onGameUpdate(gs) {
    updateUnitPanel(gs);
    updateHintBar(gs);
    updatePauseMenu(gs);
    updateTutorial(gs);
    drawMinimap();
  }

  function onPauseChanged(paused) {
    if (!paused) {
      pauseOpen = false;
      document.getElementById('pause-screen')?.classList.remove('active');
    }
    announce(paused ? 'Game paused' : 'Game resumed');
  }

  function init() {
    loadTutorialProgress();
    bindPauseMenu();
    bindMinimap();
    bindTutorial();
    bindHowToInteractive();
    document.getElementById('message-log-close')?.addEventListener('click', () => {
      document.getElementById('message-log-panel')?.classList.remove('open');
    });
  }

  return {
    init,
    onGameUpdate,
    onPauseChanged,
    onMessage,
    updatePauseMenu,
    getSettings: () => Settings?.get() || {},
    setSetting: (key, value) => Settings?.set(key, value),
    openPauseMenu,
    closePauseMenu,
    suppressPauseForOverlay,
    renderVictoryScreen,
    renderPostGameHighlights,
    drawMinimap,
    resetTutorial,
    dismissTutorial,
    clearTutorialHighlights,
    resolveTutorialStep,
    tutorialStepMatches,
    TUTORIAL_STEPS,
    toggleMessageLog,
    getHitboxBonus: () => Settings?.getHitboxBonus?.() || 0,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.UX = UX;
