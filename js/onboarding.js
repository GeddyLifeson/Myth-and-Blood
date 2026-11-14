/**
 * Onboarding — the face of the one in-run teacher, and the practice seeds on the menu.
 *
 * The staged introduction (SiegeLoop, "first steps") decides which prompt is open, what it
 * says and what it points at. This module draws it: one card in a fixed place clear of the
 * selection card, and a ring round the button the prompt is about. (A ring round a soldier
 * or a spot on the field is drawn on the canvas by SiegeLoop.)
 *
 * It also keeps the menu's practice seeds, and starts the tutorial run: an ordinary
 * campaign on the steady seed with the introduction forced on.
 *
 * The separate "guided run" messages and the old tutorial callouts are gone; what they
 * said that is still true is in the introduction or on the How to Play screen.
 */
const Onboarding = (() => {
  const STORAGE_KEY = 'myth-and-blood-onboarding-v1';
  // Shared helper — see js/html-util.js (loaded first).
  const escapeHtml = HtmlUtil.escapeHtml;

  const RECOMMENDED_STARTS = [
    {
      id: 'steady',
      label: 'Steady Siege',
      seed: 'onboard-steady-v1',
      difficulty: 'normal',
      tag: 'Best first run',
      desc: 'Normal difficulty on a fixed seed. The same waves every time.',
      guidedDefault: true,
    },
    {
      id: 'fortify',
      label: 'Fortify First',
      seed: 'onboard-walls-v1',
      difficulty: 'normal',
      tag: 'Defensive',
      desc: 'A seed for practising Builders, walls and night work before wave 5.',
      guidedDefault: false,
    },
    {
      id: 'ranged',
      label: 'Ranged Line',
      seed: 'onboard-archers-v1',
      difficulty: 'baby',
      tag: 'Gentler',
      desc: 'Baby difficulty. A wider breach limit while you learn to place archers.',
      guidedDefault: false,
    },
    {
      id: 'shared',
      label: 'Shared Seed',
      seed: 'community-hero-42',
      difficulty: 'normal',
      tag: 'Replayable',
      desc: 'The same waves for everyone. Share the seed and compare scores.',
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

  /** True while the run in progress was started from a practice seed with the panel open. */
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
    state.guidedRunActive = !!(state.guidedRunEnabled && !state.panelDismissed);
    // Picking a practice seed already applied its seed and difficulty. Re-applying it here
    // on every Begin Defense overrode whatever difficulty the player chose afterwards, so
    // only fill in the seed when the run has none yet.
    const start = getStart(state.selectedStartId);
    if (start && state.guidedRunActive && !menu.seed) GameModes.setMenuSeed(start.seed, start.id);
    save();
  }

  /**
   * A run has begun. The teaching itself is the staged introduction, which SiegeLoop starts
   * on its own for a new commander; nothing is announced or switched on from here.
   */
  function onRunStarted(opts = {}) {
    const session = opts.session;
    if (opts.creative || !session || session.modeId !== 'campaign') {
      state.guidedRunActive = false;
      save();
    }
  }

  function onRunEnded() {
    if (state.guidedRunActive) {
      state.guidedRunActive = false;
      save();
    }
    syncPrompt(null);
  }

  function dismissPanel() {
    state.panelDismissed = true;
    state.guidedRunEnabled = false;
    state.guidedRunActive = false;
    save();
    renderPanel();
  }

  /** Kept for callers of the retired callouts: the practice-seed flag is dropped. */
  function onGuidedTutorialDismissed() {
    state.guidedRunActive = false;
    state.guidedRunEnabled = false;
    save();
  }

  /**
   * The menu's TUTORIAL button: an ordinary campaign on the steady seed with the
   * introduction on, whoever is playing and whatever they skipped before.
   */
  function startTutorial() {
    if (typeof Game !== 'undefined' && Game.isPlaying?.()) return false;
    if (typeof SiegeLoop === 'undefined') return false;
    selectStart('steady');
    SiegeLoop.forceIntroduction();
    document.getElementById('start-btn')?.click();
    return true;
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

    host.innerHTML = `
      <div class="onboarding-head">
        <span class="onboarding-title">Practice seeds</span>
        <button type="button" id="onboarding-dismiss-btn" class="onboarding-dismiss-btn" title="Hide the practice seeds">
          Dismiss
        </button>
      </div>
      <p class="onboarding-lead">
        ${
          newPlayer
            ? 'New here? Your first siege teaches the game as you play, one short prompt at a time. A seed fixes the waves, so a second try meets the same enemy.'
            : 'A seed fixes the waves. Use one to practise, or to share a siege with a friend.'
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
  }

  // ---------------------------------------------------------------- the prompt card
  let card = null;
  let ring = null;
  let shownKey = '';
  let targetSelectors = null;
  let frame = 0;

  const hasDom = () => typeof document !== 'undefined' && !!document.body && !!document.createElement;

  /** Prompt text to HTML: escaped, with `[[Q]]` drawn as a key cap. */
  function promptHtml(text) {
    return escapeHtml(String(text || '')).replace(/\[\[(.+?)\]\]/g, '<kbd>$1</kbd>');
  }

  function ensureCard() {
    if (card || !hasDom()) return card;
    card = document.createElement('div');
    card.id = 'teach-prompt';
    card.hidden = true;
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    card.innerHTML =
      '<div class="teach-prompt-tag">Your first siege</div>' +
      '<p class="teach-prompt-text"></p>' +
      '<div class="teach-prompt-actions">' +
      '<button type="button" id="teach-prompt-ok" class="teach-prompt-ok">Got it</button>' +
      '<button type="button" id="teach-prompt-skip" class="teach-prompt-skip" title="Stop these prompts and show the whole HUD">Skip the introduction</button>' +
      '</div>';
    document.body.appendChild(card);
    ring = document.createElement('div');
    ring.id = 'teach-ring';
    ring.hidden = true;
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    card.addEventListener('click', (e) => {
      const id = e.target && e.target.id;
      if (typeof SiegeLoop === 'undefined') return;
      if (id === 'teach-prompt-ok') {
        AudioEngine?.SFX?.click?.();
        SiegeLoop.dismissPrompt();
      } else if (id === 'teach-prompt-skip') {
        AudioEngine?.SFX?.click?.();
        SiegeLoop.skipIntroduction();
        syncPrompt(null);
      }
    });
    return card;
  }

  /** The first selector whose element is really on screen (not scrolled away or covered). */
  function visibleTarget(selectors) {
    for (const sel of selectors || []) {
      let node = null;
      try {
        node = document.querySelector(sel);
      } catch (_) {
        node = null;
      }
      if (!node || node.hidden) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
      const top = document.elementFromPoint(cx, cy);
      if (top && (top === node || node.contains(top) || top.contains(node))) return r;
    }
    return null;
  }

  const overlaps = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  /**
   * The card sits in one place: under the top bar, against the right-hand panel. That is
   * clear of the selection card, the night card and the wave note. On a narrow screen CSS
   * moves it to the bottom; if the selection card is open there, it goes to the top instead.
   */
  function placeCard() {
    if (!card || card.hidden) return;
    const right = document.getElementById('right-panel')?.getBoundingClientRect();
    const bar = document.getElementById('top-bar')?.getBoundingClientRect();
    const gapRight = right && right.width > 0 ? Math.max(0, window.innerWidth - right.left) : 0;
    card.style.setProperty('--teach-right', `${Math.round(gapRight + 12)}px`);
    card.style.setProperty('--teach-top', `${Math.round((bar ? bar.bottom : 40) + 12)}px`);
    card.classList.remove('teach-dodge');
    const sel = document.getElementById('unit-info-panel');
    if (sel) {
      const s = sel.getBoundingClientRect();
      if (s.width > 0 && s.height > 0 && overlaps(card.getBoundingClientRect(), s)) {
        card.classList.add('teach-dodge');
      }
    }
  }

  function placeRing() {
    if (!ring) return;
    const r = targetSelectors ? visibleTarget(targetSelectors) : null;
    if (!r) {
      ring.hidden = true;
      return;
    }
    ring.hidden = false;
    ring.style.left = `${Math.round(r.left - 4)}px`;
    ring.style.top = `${Math.round(r.top - 4)}px`;
    ring.style.width = `${Math.round(r.width + 8)}px`;
    ring.style.height = `${Math.round(r.height + 8)}px`;
  }

  /** Panels scroll and the window resizes: keep the card and the ring where they belong. */
  function follow() {
    frame = 0;
    if (!card || card.hidden) return;
    placeCard();
    placeRing();
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(follow);
  }

  /**
   * Show this prompt (from SiegeLoop: { id, text, target, action }), or hide the card on null.
   * Called on every HUD sync; it only touches the page when the prompt changes.
   */
  function syncPrompt(prompt) {
    if (!hasDom()) return;
    if (!prompt) {
      if (card) card.hidden = true;
      if (ring) ring.hidden = true;
      shownKey = '';
      targetSelectors = null;
      return;
    }
    ensureCard();
    if (!card) return;
    targetSelectors = prompt.target && Array.isArray(prompt.target.dom) ? prompt.target.dom : null;
    const key = `${prompt.id}|${prompt.text}`;
    if (key !== shownKey) {
      shownKey = key;
      card.querySelector('.teach-prompt-text').innerHTML = promptHtml(prompt.text);
      card.dataset.step = prompt.id;
      // A prompt you act on closes itself; say so on the button that closes it by hand.
      card.querySelector('#teach-prompt-ok').textContent = prompt.action ? 'Dismiss' : 'Got it';
      card.classList.remove('teach-in');
      void card.offsetWidth;
      card.classList.add('teach-in');
    }
    card.hidden = false;
    if (!frame) follow();
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
    startTutorial,
    syncPrompt,
    promptHtml,
  };
})();
