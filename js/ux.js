/**
 * UI/UX, controls, accessibility, onboarding, and pause systems.
 */
const UX = (() => {
  const TUTORIAL_KEY = 'myth-and-blood-tutorial-progress';
  const MESSAGE_LOG_MAX = 80;

  let messageLog = [];
  let tutorialStep = 0;
  let tutorialDismissed = false;
  let pauseOpen = false;
  let pauseOverlayHidden = false;
  let minimapCanvas = null;
  let minimapCtx = null;
  let lastHintKey = '';

  const TUTORIAL_BY_WAVE = [
    { maxWave: 1, title: 'Welcome, Commander', body: 'Deploy Footmen with <kbd>1</kbd> or the left panel, then click the map behind your line. Enemies march from the north.', highlight: 'left-panel' },
    { maxWave: 2, title: 'Tactical Points', body: 'Clear each wave to earn TP. Spend it on troops, walls, and strikes. Watch the top bar for your pool and +TP/round.', highlight: 'top-bar' },
    { maxWave: 3, title: 'Hunt Mode', body: '<kbd>H</kbd> toggles Hunt — soldiers path toward foes. Click a unit, then click the map to override with a manual move.', highlight: 'hunt-toggle' },
    { maxWave: 5, title: 'Build & Defend', body: 'Deploy a Builder (<kbd>7</kbd>), select BUILD, click the map. Walls block foes; outposts extend archer range.', highlight: 'left-panel' },
    { maxWave: 8, title: 'Spy Network', body: 'One spy action per wave from the right panel. Scout reveals the exact next roster — invaluable before big waves.', highlight: 'right-panel' },
    { maxWave: 10, title: 'Territory Grows', body: 'Every 10 waves the realm expands. Use the minimap to orient — drag or click to jump the camera.', highlight: 'minimap-panel' },
    { maxWave: 12, title: 'Courier Orders', body: 'Deploy a Courier, pick a royal message, and they ride to the King. Tax Levy is free TP once per wave.', highlight: 'right-panel' },
    { maxWave: 15, title: 'Veteran Stars', body: 'Fighters earn bronze stars from kills. Three bronze → silver → gold → veteran upgrade. Three gold earns an honor name.', highlight: 'unit-info-panel' },
    { maxWave: 18, title: 'Box Select', body: 'Hold <kbd>Shift</kbd> and drag on the map to select multiple allies. Issue a group move with one click.', highlight: 'game-canvas' },
    { maxWave: 20, title: 'Night Prep', body: 'After each cleared wave, night falls for 1 minute: no spawns, +35% build speed. Press D or BEGIN DAY to start early — or wait for auto dawn.', highlight: 'begin-day-btn' },
  ];

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
    } catch (_) { /* ignore */ }
  }

  function saveTutorialProgress() {
    try {
      localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ step: tutorialStep, dismissed: tutorialDismissed }));
    } catch (_) { /* ignore */ }
  }

  function onMessage(text, source = 'game') {
    if (!text) return;
    const entry = { text, source, time: Date.now(), wave: Game.isPlaying?.() ? Game.getState().wave : 0 };
    messageLog.unshift(entry);
    if (messageLog.length > MESSAGE_LOG_MAX) messageLog.length = MESSAGE_LOG_MAX;
    renderMessageLog();
    announce(text);
  }

  function renderMessageLog() {
    const list = document.getElementById('message-log-list');
    if (!list) return;
    list.innerHTML = messageLog.slice(0, 24).map(m => `
      <div class="msg-log-entry">
        <span class="msg-log-wave">W${m.wave}</span>
        <span class="msg-log-text">${escapeHtml(m.text)}</span>
      </div>
    `).join('') || '<p class="msg-log-empty">No messages yet.</p>';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatStars(u) {
    const parts = [];
    if (u.vetBronze) parts.push(`<span class="star-bronze" title="Bronze">${'★'.repeat(Math.min(9, u.vetBronze))}</span>`);
    if (u.vetSilver) parts.push(`<span class="star-silver" title="Silver">${'◆'.repeat(Math.min(3, u.vetSilver))}</span>`);
    if (u.vetGold) parts.push(`<span class="star-gold" title="Gold">${'♛'.repeat(Math.min(3, u.vetGold))}</span>`);
    if (u.vetTier) parts.push(`<span class="vet-tier">V${u.vetTier}</span>`);
    return parts.join(' ') || '<span class="star-none">—</span>';
  }

  function formatPerks(u) {
    const perks = u.perks || [];
    if (!perks.length) return '<span class="perk-none">None</span>';
    return perks.map(p => {
      const name = (typeof PerkDefs !== 'undefined' && PerkDefs[p]?.name) || p;
      return `<span class="perk-chip">${escapeHtml(name)}</span>`;
    }).join('');
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
      return;
    }
    panel.classList.add('visible');
    panel.setAttribute('aria-hidden', 'false');
    const multi = info.length > 1;
    const body = document.getElementById('unit-info-body');
    if (!body) return;
    if (multi) {
      body.innerHTML = `
        <div class="unit-info-head"><span class="unit-info-name">${info.length} units selected</span></div>
        <div class="unit-info-row">Hold Shift+drag to add · click map to group move</div>
        <div class="unit-info-chips">${info.slice(0, 8).map(u =>
          `<span class="unit-chip">${escapeHtml(u.displayName)}</span>`
        ).join('')}${info.length > 8 ? `<span class="unit-chip">+${info.length - 8}</span>` : ''}</div>
        <div class="unit-info-actions">
          <button class="unit-quick-btn" data-action="hunt-on" title="Enable hunt">Hunt</button>
          <button class="unit-quick-btn" data-action="hunt-off" title="Disable hunt">Hold</button>
          <button class="unit-quick-btn" data-action="focus" title="Center camera">Focus</button>
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
        <div class="unit-info-row perks-row"><span>Perks</span> ${formatPerks(u)}</div>
        ${u.status ? `<div class="unit-info-status">${escapeHtml(u.status)}</div>` : ''}
        <div class="unit-info-actions">
          <button class="unit-quick-btn" data-action="hunt-toggle" title="Toggle hunt">${u.huntMode ? 'Hold Position' : 'Hunt'}</button>
          <button class="unit-quick-btn" data-action="focus" title="Center camera">Focus</button>
          ${u.canPromote ? '<button class="unit-quick-btn" data-action="promote" title="Promote to General">Promote</button>' : ''}
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
    document.querySelectorAll('.unit-quick-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        AudioEngine?.SFX?.click?.();
        if (action === 'focus') Game.focusSelection?.();
        else if (action === 'hunt-toggle') Game.toggleSelectedHunt?.();
        else if (action === 'hunt-on') Game.setSelectedHunt?.(true);
        else if (action === 'hunt-off') Game.setSelectedHunt?.(false);
        else if (action === 'promote') Game.creativePromoteSelectedGeneral?.();
        UI.updateHUD(true);
      };
    });
  }

  function updateHintBar(gs) {
    const bar = document.getElementById('hint-bar');
    if (!bar || gs.creativeMode) return;
    let hint = '';
    if (gs.paused) hint = 'PAUSED — Space or Resume to continue · Esc for pause menu';
    else if (gs.selectedDeploy) hint = `Deploy ${getPlayerUnitDef(gs.selectedDeploy)?.name || gs.selectedDeploy} — click map · Esc cancel`;
    else if (gs.selectedBuild === 'wall') hint = `Build Wall (facing ${gs.pendingWallFacing || 'north'}) — R rotate · click map · Esc cancel`;
    else if (gs.selectedBuild) hint = `Build ${BuildDefs[gs.selectedBuild]?.name || gs.selectedBuild} — click map · Esc cancel`;
    else if (gs.selectedAbility) hint = `Strike: ${Abilities[gs.selectedAbility]?.name || gs.selectedAbility} — click target · Esc cancel`;
    else if (gs.selectedDemolish) hint = 'Demolish — click your structure (50% TP refund) · Esc cancel';
    else if (gs.selectedMoveBuilding) hint = gs.moveBuildingType
      ? `Move ${BuildDefs[gs.moveBuildingType]?.name || 'structure'} — click destination · Esc cancel`
      : 'Move building — click structure, then destination (free) · Esc cancel';
    else if (gs.selectedRotateWall) hint = 'Rotate wall — click a wall to turn 90° (free) · Esc cancel';
    else if (gs.timeOfDay === 'night') hint = `Night prep (${gs.nightSecondsLeft ?? 60}s) — D or BEGIN DAY to skip · builders +35% speed · Shift+drag box-select`;
    else if ((gs.territoryTier ?? 0) > 0) hint = 'Territory expanded — use minimap · Shift+drag to multi-select · Space pause';
    else hint = 'Shift+drag box-select · Drag map to pan · Scroll zoom · Space pause · Tab message log';

    const key = hint + (gs.wave || 0);
    if (key === lastHintKey) return;
    lastHintKey = key;
    const textEl = bar.querySelector('.hint-text') || bar;
    if (textEl.classList?.contains('hint-text')) textEl.textContent = hint;
    else bar.childNodes[0]?.nodeType === 3 ? bar.firstChild.textContent = hint : bar.insertAdjacentHTML('afterbegin', '');
    if (!bar.querySelector('.hint-text')) {
      bar.innerHTML = `<span class="hint-text">${hint}</span><button id="hint-log-btn" class="hint-log-btn" title="Message history" aria-label="Open message log">📜</button>`;
      document.getElementById('hint-log-btn')?.addEventListener('click', toggleMessageLog);
    } else {
      bar.querySelector('.hint-text').textContent = hint;
    }
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
      stats.innerHTML = `
        <div class="pause-stat"><span>Wave</span><strong>${gs.wave}</strong></div>
        <div class="pause-stat"><span>TP</span><strong>${Math.floor(gs.tactical)}</strong></div>
        <div class="pause-stat"><span>Kills</span><strong>${gs.kills ?? 0}</strong></div>
        <div class="pause-stat"><span>Army</span><strong>${gs.army}</strong></div>
        <div class="pause-stat"><span>Misses</span><strong>${gs.misses} / ${gs.missLimit}</strong></div>
        <div class="pause-stat"><span>Land</span><strong>${gs.territoryTier || 0}</strong></div>
        <div class="pause-stat wide"><span>Difficulty</span><strong>${gs.difficultyLabel} ${gs.difficultyPercent}%</strong></div>
        <div class="pause-stat wide"><span>Cycle</span><strong>${gs.timeOfDay === 'night' ? 'Night prep' : 'Day assault'}</strong></div>
        <div class="pause-stat"><span>Speed</span><strong>${gs.gameSpeed ?? 1}×</strong></div>
        ${gs.gameMode ? `<div class="pause-stat wide"><span>Mode</span><strong>${gs.gameMode.challengeLabel || gs.gameMode.modeId}${gs.gameMode.ironman ? ' · Ironman' : ''}</strong></div>` : ''}
      `;
    }
    const tipsEl = document.getElementById('pause-scaling-tips');
    if (tipsEl && gs.scalingTips?.length) {
      tipsEl.innerHTML = `<div class="pause-tips-title">Recommended path</div><ul>${gs.scalingTips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
    }
    const qsBtn = document.getElementById('pause-quicksave');
    const qlBtn = document.getElementById('pause-quickload');
    const rwBtn = document.getElementById('pause-restart-wave');
    const iron = gs.gameMode?.ironman || gs.gameMode?.modeId === 'daily' || gs.gameMode?.modeId === 'weekly';
    if (qsBtn) qsBtn.disabled = iron;
    if (qlBtn) qlBtn.disabled = iron;
    if (rwBtn) rwBtn.disabled = !!gs.gameMode?.ironman;
    const qs = document.getElementById('pause-quicksave-status');
    if (qs) {
      const has = Game.hasQuickSave?.();
      qs.textContent = has ? `Quick save: Wave ${Game.getQuickSaveMeta?.()?.wave ?? '?'}` : 'No quick save yet';
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

    for (const b of data.buildings) {
      minimapCtx.fillStyle = b.owner === 'enemy' ? '#804040' : b.isSettlement ? '#a08040' : '#506050';
      minimapCtx.fillRect(b.x * sx - 1, b.y * sy - 1, 3, 3);
    }
    for (const u of data.units) {
      minimapCtx.fillStyle = u.team === 'player' ? '#60a0ff' : '#ff5050';
      minimapCtx.fillRect(u.x * sx - 1, u.y * sy - 1, 2, 2);
    }

    const vx = data.viewX * sx;
    const vy = data.viewY * sy;
    const vw = data.viewW * sx;
    const vh = data.viewH * sy;
    minimapCtx.strokeStyle = 'rgba(240,200,100,0.9)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(vx, vy, vw, vh);

    if (data.territoryTier > 0) {
      minimapCtx.fillStyle = 'rgba(200,160,80,0.7)';
      minimapCtx.font = '8px Cinzel';
      minimapCtx.textAlign = 'right';
      minimapCtx.fillText(`Land ${data.territoryTier}`, w - 4, 10);
    }
  }

  function bindMinimap() {
    minimapCanvas = document.getElementById('minimap-canvas');
    if (!minimapCanvas) return;
    minimapCtx = minimapCanvas.getContext('2d');
    minimapCanvas.addEventListener('click', (e) => {
      if (!Game.isPlaying?.()) return;
      const rect = minimapCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      Game.panCameraToFraction?.(mx, my);
      AudioEngine?.SFX?.click?.();
    });
  }

  function clearTutorialHighlights() {
    document.querySelectorAll('.tutorial-highlight').forEach((n) => n.classList.remove('tutorial-highlight'));
  }

  function updateTutorial(gs) {
    if (!Settings?.get('tutorialEnabled') || tutorialDismissed || !Game.isPlaying?.() || gs.creativeMode) {
      document.getElementById('tutorial-callout')?.classList.remove('visible');
      clearTutorialHighlights();
      return;
    }
    const step = TUTORIAL_BY_WAVE.find((t, i) => gs.wave <= t.maxWave && i >= tutorialStep);
    const el = document.getElementById('tutorial-callout');
    if (!el || !step) {
      el?.classList.remove('visible');
      clearTutorialHighlights();
      return;
    }
    el.classList.add('visible');
    el.querySelector('.tutorial-title').textContent = step.title;
    el.querySelector('.tutorial-body').innerHTML = step.body;
    clearTutorialHighlights();
    if (step.highlight) {
      const target = document.getElementById(step.highlight);
      target?.classList.add('tutorial-highlight');
    }
  }

  function bindTutorial() {
    document.getElementById('tutorial-next')?.addEventListener('click', () => {
      tutorialStep++;
      saveTutorialProgress();
      AudioEngine?.SFX?.click?.();
      UI.updateHUD(true);
    });
    document.getElementById('tutorial-dismiss')?.addEventListener('click', () => {
      tutorialDismissed = true;
      saveTutorialProgress();
      document.getElementById('tutorial-callout')?.classList.remove('visible');
      clearTutorialHighlights();
      AudioEngine?.SFX?.click?.();
    });
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
      <ul class="result-highlights-list">${highlights.slice(-12).reverse().map(h =>
        `<li><span class="hl-wave">W${h.wave}</span> ${escapeHtml(h.text)}</li>`
      ).join('')}</ul>
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
    getSettings: () => Settings?.get() || {},
    setSetting: (key, value) => Settings?.set(key, value),
    openPauseMenu,
    closePauseMenu,
    suppressPauseForOverlay,
    renderPostGameHighlights,
    drawMinimap,
    resetTutorial,
    clearTutorialHighlights,
    getHitboxBonus: () => Settings?.getHitboxBonus?.() || 0,
  };
})();