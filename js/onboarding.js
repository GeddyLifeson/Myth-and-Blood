/**
 * Campaign onboarding — seed-based recommended starts and guided first run.
 */
const Onboarding = (() => {
  const STORAGE_KEY = 'myth-and-blood-onboarding-v1';
  // Shared helper — see js/html-util.js (loaded first).
  const escapeHtml = HtmlUtil.escapeHtml;

  const RECOMMENDED_STARTS = [
    {
      id: 'steady',
      label: 'Steady Campaign',
      seed: 'onboard-steady-v1',
      difficulty: 'normal',
      tag: 'Best first run',
      desc: 'Balanced early waves with predictable spawns — learn deploy, TP, and hunt mode.',
      guidedDefault: true,
    },
    {
      id: 'fortify',
      label: 'Fortify First',
      seed: 'onboard-walls-v1',
      difficulty: 'normal',
      tag: 'Defensive',
      desc: 'Goblin-heavy opener — practice Builder, walls, and night prep before wave 5.',
      guidedDefault: false,
    },
    {
      id: 'ranged',
      label: 'Ranged Lane',
      seed: 'onboard-archers-v1',
      difficulty: 'baby',
      tag: 'Gentler',
      desc: 'Softer scaling on Baby difficulty — lean on archers and TP economy.',
      guidedDefault: false,
    },
    {
      id: 'shared',
      label: 'Shared Seed',
      seed: 'community-hero-42',
      difficulty: 'normal',
      tag: 'Replayable',
      desc: 'Fixed spawns every run — share the seed with friends and compare clears.',
      guidedDefault: false,
    },
  ];

  let state = {
    panelDismissed: false,
    selectedStartId: 'steady',
    guidedRunEnabled: true,
    guidedRunActive: false,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = { ...state, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    if (!RECOMMENDED_STARTS.some((s) => s.id === state.selectedStartId)) {
      state.selectedStartId = 'steady';
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      /* ignore */
    }
  }

  function getStart(id) {
    return RECOMMENDED_STARTS.find((s) => s.id === id) || RECOMMENDED_STARTS[0];
  }

  function isNewPlayer() {
    if (typeof Legacy !== 'undefined' && Legacy.get) {
      return (Legacy.get().totalRuns || 0) === 0;
    }
    return true;
  }

  function shouldShowPanel() {
    if (state.panelDismissed) return false;
    if (typeof GameModes === 'undefined') return false;
    const menu = GameModes.getMenu?.();
    if (!menu) return false;
    if (menu.challengeType) return false;
    return menu.modeId === 'campaign';
  }

  function isGuidedRunActive() {
    return !!state.guidedRunActive;
  }

  function selectStart(id) {
    const start = getStart(id);
    if (!start) return;
    state.selectedStartId = start.id;
    if (start.guidedDefault && isNewPlayer()) state.guidedRunEnabled = true;
    save();
    applyStartToMenu(start);
  }

  function applyStartToMenu(start) {
    if (!start || typeof GameModes === 'undefined') return;
    GameModes.setMenuMode('campaign');
    GameModes.setMenuSeed(start.seed, start.id);
    if (typeof UI !== 'undefined' && UI.setSelectedDifficulty && start.difficulty) {
      UI.setSelectedDifficulty(start.difficulty);
    }
    GameModes.renderMenuPanel();
  }

  function prepareCampaignStart() {
    if (typeof GameModes === 'undefined') return;
    const menu = GameModes.getMenu();
    if (menu.modeId !== 'campaign' || menu.challengeType) {
      state.guidedRunActive = false;
      save();
      return;
    }
    const start = getStart(state.selectedStartId);
    if (start) applyStartToMenu(start);
    state.guidedRunActive = !!(state.guidedRunEnabled && !state.panelDismissed);
    save();
  }

  function onRunStarted(opts = {}) {
    if (opts.creative) {
      state.guidedRunActive = false;
      save();
      return;
    }
    const session = opts.session;
    if (!session || session.modeId !== 'campaign') {
      state.guidedRunActive = false;
      save();
      return;
    }
    if (!state.guidedRunActive) return;

    if (typeof Settings !== 'undefined') Settings.set('tutorialEnabled', true);
    if (typeof UX !== 'undefined' && UX.resetTutorial) UX.resetTutorial();

    const start = getStart(state.selectedStartId);
    if (typeof UX !== 'undefined') {
      const seedTxt = session.seed ? ` (seed: ${session.seed})` : '';
      UX.onMessage(
        `Guided campaign — ${start?.label || 'recommended start'}${seedTxt}. Follow the tutorial tips; dismiss anytime.`,
        'system'
      );
    }
    if (typeof Game !== 'undefined' && Game.showMessage) {
      Game.showMessage(
        `Guided campaign: deploy footmen, earn TP, survive wave 1.${session.seed ? ` Seed: ${session.seed}` : ''}`,
        280
      );
    }
  }

  function onRunEnded() {
    if (state.guidedRunActive) {
      state.guidedRunActive = false;
      save();
    }
  }

  function dismissPanel() {
    state.panelDismissed = true;
    state.guidedRunEnabled = false;
    state.guidedRunActive = false;
    save();
    renderPanel();
    if (typeof UX !== 'undefined' && UX.dismissTutorial) UX.dismissTutorial();
  }

  function onGuidedTutorialDismissed() {
    state.guidedRunActive = false;
    state.guidedRunEnabled = false;
    save();
  }

  function setGuidedRunEnabled(on) {
    state.guidedRunEnabled = !!on;
    save();
  }

  function renderPanel() {
    const host = document.getElementById('onboarding-panel');
    if (!host) return;

    if (!shouldShowPanel()) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }

    host.hidden = false;
    const selected = getStart(state.selectedStartId);
    const newPlayer = isNewPlayer();

    const journeyLead =
      typeof LayerDesign !== 'undefined' && LayerDesign.PRINCIPLES
        ? `<p class="onboarding-journey">${LayerDesign.PRINCIPLES.summary}</p>
           <p class="onboarding-journey-steps">1 Defend the north · 2 Academy Era (w100) — train & escalate · 3 Survive denser waves</p>`
        : `<p class="onboarding-journey">One crown across five eras: defense → empire → dynasty → stars → planet.</p>`;

    host.innerHTML = `
      <div class="onboarding-head">
        <span class="onboarding-title">Recommended starts</span>
        <button type="button" id="onboarding-dismiss-btn" class="onboarding-dismiss-btn" title="Hide recommended starts and guided run">
          Dismiss
        </button>
      </div>
      ${journeyLead}
      <p class="onboarding-lead">
        ${
          newPlayer
            ? 'New commander? Pick a curated <strong>campaign seed</strong> for reproducible early waves, then follow the guided tips in-game.'
            : 'Campaign seeds fix spawn patterns — great for practice runs and sharing routes with friends.'
        }
      </p>
      <div class="recommended-starts-grid">
        ${RECOMMENDED_STARTS.map(
          (s) => `
          <button type="button" class="recommended-start-card ${state.selectedStartId === s.id ? 'selected' : ''}"
            data-start-id="${s.id}" title="${escapeHtml(s.desc)}">
            <span class="recommended-start-tag">${escapeHtml(s.tag)}</span>
            <strong class="recommended-start-label">${escapeHtml(s.label)}</strong>
            <span class="recommended-start-desc">${escapeHtml(s.desc)}</span>
            <span class="recommended-start-meta">${escapeHtml(s.difficulty)} · seed ${escapeHtml(s.seed)}</span>
          </button>
        `
        ).join('')}
      </div>
      <label class="onboarding-guided-toggle">
        <input type="checkbox" id="guided-run-toggle" ${state.guidedRunEnabled ? 'checked' : ''} />
        <span><strong>Guided first run</strong> — progressive tutorial callouts during campaign (waves 1–20+)</span>
      </label>
      ${
        selected
          ? `<p class="onboarding-selected">Selected: <strong>${escapeHtml(selected.label)}</strong> — ${escapeHtml(selected.seed)}</p>`
          : ''
      }
    `;

    host.querySelectorAll('.recommended-start-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectStart(btn.dataset.startId);
        AudioEngine?.SFX?.click?.();
      });
    });

    document.getElementById('onboarding-dismiss-btn')?.addEventListener('click', () => {
      dismissPanel();
      AudioEngine?.SFX?.click?.();
    });

    document.getElementById('guided-run-toggle')?.addEventListener('change', (e) => {
      setGuidedRunEnabled(e.target.checked);
    });
  }

  function init() {
    load();
    if (isNewPlayer() && !state.panelDismissed) {
      const steady = getStart('steady');
      if (steady) applyStartToMenu(steady);
    }
    renderPanel();
  }

  load();

  return {
    RECOMMENDED_STARTS,
    init,
    renderPanel,
    prepareCampaignStart,
    onRunStarted,
    onRunEnded,
    isGuidedRunActive,
    shouldShowPanel,
    selectStart,
    dismissPanel,
    onGuidedTutorialDismissed,
    setGuidedRunEnabled,
    getSelectedStart: () => getStart(state.selectedStartId),
  };
})();