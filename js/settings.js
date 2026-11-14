/**
 * Game settings — display scaling, window mode, audio, accessibility, gameplay, keys.
 *
 * The screen is laid out here (buildLayout): the groups in index.html are moved into
 * sections (Sound, Graphics, Controls, Gameplay, Accessibility, then System and
 * Cosmetics), with the section list and the Reset / Close row pinned. The Keys section
 * (Controls) is rendered from js/hotkeys.js and is where keys are rebound.
 *
 * Flags other modules read:
 *   Settings.get('reduceMotion')  boolean — skip shakes, flashes and decorative motion
 *   Settings.get('teamPalette')   'standard' | 'safe' — 'safe' is a colour-blind-safe pair
 *   Settings.getTeamColours()     { player, enemy, neutral } hex for the current palette
 */
const Settings = (() => {
  const SETTINGS_KEY = 'myth-and-blood-settings-v1';
  const LEGACY_KEY = 'myth-and-blood-ux-settings';
  const REF_WIDTH = 1280;
  const REF_HEIGHT = 800;

  const DEFAULT_SETTINGS = {
    uiScaleMode: 'auto',
    uiScaleManual: 1,
    windowMode: 'windowed',
    showHintBar: true,
    panelOpacity: 0.95,
    masterVolume: 0.75,
    musicVolume: 0.28,
    sfxVolume: 0.55,
    muted: false,
    cameraZoomSpeed: 1,
    colorBlind: 'none',
    highContrast: false,
    fontScale: 1,
    reducedMotion: false,
    teamPalette: 'standard',
    screenReader: false,
    largerHitboxes: false,
    showMinimap: true,
    tutorialEnabled: true,
    performanceMode: 'auto',
    gameSpeed: 1,
    analyticsOptIn: false,
    errorReportingOptIn: false,
    // Combat feel / QoL
    combatShake: true,
    damageNumbers: true,
    hitStop: true,
    gore: true,
    killStreaks: true,
    waveSummary: true,
    autoPauseNight: false,
    dangerVignette: true,
    lowHpPulse: true,
  };

  const COLOR_BLIND_PALETTES = {
    none: {},
    deuteranopia: { '--ui-accent': '#6eb5ff', '--ui-danger': '#ff9f43', '--ui-success': '#5ac8fa' },
    protanopia: { '--ui-accent': '#7ec8e3', '--ui-danger': '#ffb347', '--ui-success': '#98d8c8' },
    tritanopia: { '--ui-accent': '#e07a9f', '--ui-danger': '#d4a574', '--ui-success': '#9ed9cc' },
  };

  let settings = { ...DEFAULT_SETTINGS };
  let settingsOpen = false;
  let returnToPause = false;
  let pausedByUs = false;
  let activeTab = 'sound';

  /** Asked-for names that map onto a stored key. */
  const ALIASES = { reduceMotion: 'reducedMotion' };

  /**
   * Team colours. 'safe' is blue against orange (told apart with every common form of
   * colour blindness); 'standard' is the game's own blue against red.
   */
  const TEAM_PALETTES = {
    standard: { player: '#60a0ff', enemy: '#ff5050', neutral: '#c0a040' },
    safe: { player: '#56b4e9', enemy: '#e69f00', neutral: '#f0f0f0' },
  };
  let removeModeListener = null;
  let windowModeSyncPromise = null;

  function load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } else {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(legacy) };
      }
    } catch (_) {
      /* ignore */
    }
    apply();
    /* Defer window recreate so it does not interrupt the first play session. */
    const deferMode = () => queueElectronWindowMode(false);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => deferMode());
    else setTimeout(deferMode, 0);
  }

  function save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {
      /* ignore */
    }
    apply();
  }

  function get(key) {
    if (!key) return { ...settings, reduceMotion: !!settings.reducedMotion };
    key = ALIASES[key] || key;
    if (key === 'teamPalette')
      return TEAM_PALETTES[settings.teamPalette] ? settings.teamPalette : 'standard';
    return settings[key];
  }

  function getTeamColours() {
    return { ...TEAM_PALETTES[get('teamPalette')] };
  }

  function set(key, value) {
    key = ALIASES[key] || key;
    if (!(key in DEFAULT_SETTINGS)) return;
    if (settings[key] === value) return;
    settings[key] = value;
    save();
    if (key === 'windowMode') queueElectronWindowMode(true);
    if (key === 'muted') syncSoundButton();
  }

  function computeAutoScale() {
    const w = window.innerWidth || REF_WIDTH;
    const h = window.innerHeight || REF_HEIGHT;
    const scale = Math.min(w / REF_WIDTH, h / REF_HEIGHT);
    return Math.max(0.6, Math.min(1.5, scale));
  }

  function getEffectiveUIScale() {
    if (settings.uiScaleMode === 'manual') {
      return Math.max(0.6, Math.min(1.5, settings.uiScaleManual));
    }
    return computeAutoScale();
  }

  function getPanelInsets() {
    const s = getEffectiveUIScale();
    return {
      left: Math.round(60 * s),
      right: Math.round(56 * s),
      top: Math.round(46 * s),
      bottom: Math.round(36 * s),
    };
  }

  function apply() {
    const root = document.documentElement;
    updateUIScale();
    root.style.setProperty('--font-scale', String(settings.fontScale));
    root.style.setProperty('--panel-opacity', String(settings.panelOpacity));
    root.style.setProperty('--hud-panel-bg', `rgba(20,16,12,${settings.panelOpacity})`);
    root.style.setProperty('--hud-panel-bg-deep', `rgba(12,10,8,${settings.panelOpacity})`);
    document.body.classList.toggle('window-borderless', settings.windowMode === 'borderless');
    document.body.classList.toggle('window-fullscreen', settings.windowMode === 'fullscreen');
    root.classList.toggle('high-contrast', !!settings.highContrast);
    root.classList.toggle('reduced-motion', !!settings.reducedMotion);
    root.classList.toggle('screen-reader-hints', !!settings.screenReader);
    root.classList.toggle('large-hitboxes', !!settings.largerHitboxes);
    root.classList.toggle('hide-hint-bar', !settings.showHintBar);
    root.dataset.colorBlind = settings.colorBlind;
    root.dataset.teamPalette = get('teamPalette');
    const team = getTeamColours();
    root.style.setProperty('--team-player', team.player);
    root.style.setProperty('--team-enemy', team.enemy);
    root.style.setProperty('--team-neutral', team.neutral);
    root.dataset.uiScaleMode = settings.uiScaleMode;

    const palette = COLOR_BLIND_PALETTES[settings.colorBlind] || {};
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v));

    const minimap = document.getElementById('minimap-panel');
    if (minimap) minimap.style.display = settings.showMinimap ? '' : 'none';

    if (typeof AudioEngine !== 'undefined') {
      AudioEngine.setMasterVolume(settings.masterVolume);
      AudioEngine.setMusicVolume(settings.musicVolume);
      AudioEngine.setSfxVolume(settings.sfxVolume);
      AudioEngine.setMuted(settings.muted);
    }

    syncForm();
    if (typeof GfxQuality !== 'undefined') GfxQuality.setMode(settings.performanceMode || 'auto');
    if (typeof Game !== 'undefined' && Game.onSettingsChanged) Game.onSettingsChanged();
  }

  function updateUIScale() {
    const uiScale = getEffectiveUIScale();
    document.documentElement.style.setProperty('--ui-scale', String(uiScale));
    return uiScale;
  }

  function onWindowResize() {
    updateUIScale();
    if (typeof Game !== 'undefined' && Game.onSettingsChanged) Game.onSettingsChanged();
  }

  function isElectron() {
    return !!window.electronAPI?.isElectron;
  }

  function updateWindowModeNote() {
    const note = document.getElementById('settings-window-note');
    const borderless = document.getElementById('set-window-borderless');
    const windowed = document.getElementById('set-window-windowed');
    if (!isElectron()) {
      if (note)
        note.textContent =
          'Borderless window requires the desktop app (Play Myth and Blood.bat). Browser can use fullscreen only.';
      borderless?.setAttribute('disabled', '');
      windowed?.setAttribute('disabled', '');
      return;
    }
    if (note)
      note.textContent =
        'Borderless = no title bar, fills your monitor. Fullscreen = exclusive fullscreen. Switching borderless reloads once.';
    borderless?.removeAttribute('disabled');
    windowed?.removeAttribute('disabled');
  }

  async function syncElectronWindowMode(force = false) {
    updateWindowModeNote();
    if (!isElectron()) return;
    try {
      const current = await window.electronAPI.getWindowMode();
      if (!force && current === settings.windowMode) return;
      const mode = await window.electronAPI.setWindowMode(settings.windowMode);
      if (mode && mode !== settings.windowMode) {
        settings.windowMode = mode;
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (_) {
          /* ignore */
        }
        syncForm();
        apply();
      }
    } catch (err) {
      console.warn('Settings: window mode sync failed', err);
    }
  }

  function queueElectronWindowMode(force) {
    if (!isElectron()) {
      updateWindowModeNote();
      return;
    }
    windowModeSyncPromise = (windowModeSyncPromise || Promise.resolve())
      .then(() => syncElectronWindowMode(force))
      .catch(() => {});
  }

  function syncSoundButton() {
    const btn = document.getElementById('sound-toggle');
    if (btn) btn.textContent = settings.muted ? '🔇' : '🔊';
  }

  function syncForm() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setCheck = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('set-ui-scale-mode', settings.uiScaleMode);
    setVal('set-ui-scale-manual', settings.uiScaleManual);
    setText('set-ui-scale-val', `${Math.round(getEffectiveUIScale() * 100)}%`);
    setText('set-ui-scale-auto-val', `${Math.round(computeAutoScale() * 100)}%`);

    document.querySelectorAll('[data-window-mode]').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.windowMode === settings.windowMode);
    });

    setVal('set-master-volume', settings.masterVolume);
    setVal('set-music-volume', settings.musicVolume);
    setVal('set-sfx-volume', settings.sfxVolume);
    setText('set-master-volume-val', `${Math.round(settings.masterVolume * 100)}%`);
    setText('set-music-volume-val', `${Math.round(settings.musicVolume * 100)}%`);
    setText('set-sfx-volume-val', `${Math.round(settings.sfxVolume * 100)}%`);
    setCheck('set-muted', settings.muted);

    setVal('set-colorblind', settings.colorBlind);
    setVal('set-team-palette', get('teamPalette'));
    setVal('set-font-scale', settings.fontScale);
    setText('set-font-scale-val', `${Math.round(settings.fontScale * 100)}%`);
    setCheck('set-high-contrast', settings.highContrast);
    setCheck('set-reduced-motion', settings.reducedMotion);
    setCheck('set-screen-reader', settings.screenReader);
    setCheck('set-large-hitboxes', settings.largerHitboxes);

    setCheck('set-show-minimap', settings.showMinimap);
    setCheck('set-show-hint-bar', settings.showHintBar);
    setCheck('set-tutorial', settings.tutorialEnabled);
    setCheck('set-combat-shake', settings.combatShake !== false);
    setCheck('set-damage-numbers', settings.damageNumbers !== false);
    setCheck('set-hit-stop', settings.hitStop !== false);
    setCheck('set-gore', settings.gore !== false);
    setCheck('set-kill-streaks', settings.killStreaks !== false);
    setCheck('set-wave-summary', settings.waveSummary !== false);
    setCheck('set-auto-pause-night', !!settings.autoPauseNight);
    setCheck('set-danger-vignette', settings.dangerVignette !== false);
    setCheck('set-low-hp-pulse', settings.lowHpPulse !== false);
    setVal('set-camera-zoom', settings.cameraZoomSpeed);
    setText('set-camera-zoom-val', `${Math.round(settings.cameraZoomSpeed * 100)}%`);
    setVal('set-panel-opacity', settings.panelOpacity);
    setText('set-panel-opacity-val', `${Math.round(settings.panelOpacity * 100)}%`);
    setVal('set-performance-mode', settings.performanceMode || 'auto');
    if (typeof UI !== 'undefined') UI.updateSpeedControl?.(settings.gameSpeed ?? 1);

    document.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === activeTab);
    });
    document.querySelectorAll('.settings-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.tab === activeTab);
    });
    setCheck('set-analytics-optin', settings.analyticsOptIn);
    setCheck('set-error-reporting-optin', settings.errorReportingOptIn);
    if (!settingsOpen) return;
    // 'mods' and 'privacy' are the tab names of the markup before buildLayout() merges them.
    const system = activeTab === 'system';
    if ((system || activeTab === 'mods') && typeof ModLoader !== 'undefined') {
      ModLoader.renderSettingsList();
    }
    if (activeTab === 'cosmetics' && typeof Cosmetics !== 'undefined') Cosmetics.renderSettings();
    if (system || activeTab === 'privacy') {
      if (typeof Analytics !== 'undefined') Analytics.renderSettings();
      if (typeof ErrorReporting !== 'undefined') ErrorReporting.renderSettings();
    }
    if (activeTab === 'controls') renderKeys();
  }

  function bind() {
    document.getElementById('set-ui-scale-mode')?.addEventListener('change', (e) => {
      set('uiScaleMode', e.target.value);
      const manual = document.getElementById('set-ui-scale-manual-wrap');
      if (manual) manual.style.display = e.target.value === 'manual' ? '' : 'none';
    });

    document.getElementById('set-ui-scale-manual')?.addEventListener('input', (e) => {
      set('uiScaleManual', parseFloat(e.target.value) || 1);
      document.getElementById('set-ui-scale-val').textContent =
        `${Math.round(getEffectiveUIScale() * 100)}%`;
    });

    document.querySelectorAll('[data-window-mode]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        AudioEngine?.SFX?.click?.();
        const mode = btn.dataset.windowMode;
        if (!isElectron()) {
          if (mode === 'fullscreen') await requestBrowserFullscreen();
          else if (mode === 'windowed' && document.fullscreenElement) {
            await document.exitFullscreen();
            set('windowMode', 'windowed');
          } else set('windowMode', mode);
          return;
        }
        set('windowMode', mode);
      });
    });

    const vol = (id, key, valId) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        set(key, v);
        if (valId) document.getElementById(valId).textContent = `${Math.round(v * 100)}%`;
      });
    };
    vol('set-master-volume', 'masterVolume', 'set-master-volume-val');
    vol('set-music-volume', 'musicVolume', 'set-music-volume-val');
    vol('set-sfx-volume', 'sfxVolume', 'set-sfx-volume-val');

    document
      .getElementById('set-muted')
      ?.addEventListener('change', (e) => set('muted', e.target.checked));

    document
      .getElementById('set-colorblind')
      ?.addEventListener('change', (e) => set('colorBlind', e.target.value));
    document.getElementById('set-font-scale')?.addEventListener('input', (e) => {
      set('fontScale', parseFloat(e.target.value) || 1);
      document.getElementById('set-font-scale-val').textContent =
        `${Math.round(settings.fontScale * 100)}%`;
    });
    document
      .getElementById('set-high-contrast')
      ?.addEventListener('change', (e) => set('highContrast', e.target.checked));
    document
      .getElementById('set-reduced-motion')
      ?.addEventListener('change', (e) => set('reducedMotion', e.target.checked));
    document
      .getElementById('set-screen-reader')
      ?.addEventListener('change', (e) => set('screenReader', e.target.checked));
    document
      .getElementById('set-large-hitboxes')
      ?.addEventListener('change', (e) => set('largerHitboxes', e.target.checked));

    document
      .getElementById('set-show-minimap')
      ?.addEventListener('change', (e) => set('showMinimap', e.target.checked));
    document
      .getElementById('set-show-hint-bar')
      ?.addEventListener('change', (e) => set('showHintBar', e.target.checked));
    document.getElementById('set-tutorial')?.addEventListener('change', (e) => {
      set('tutorialEnabled', e.target.checked);
      if (e.target.checked && typeof UX !== 'undefined') UX.resetTutorial?.();
    });
    const bindCheck = (id, key) => {
      document.getElementById(id)?.addEventListener('change', (e) => set(key, e.target.checked));
    };
    bindCheck('set-combat-shake', 'combatShake');
    bindCheck('set-damage-numbers', 'damageNumbers');
    bindCheck('set-hit-stop', 'hitStop');
    bindCheck('set-gore', 'gore');
    bindCheck('set-kill-streaks', 'killStreaks');
    bindCheck('set-wave-summary', 'waveSummary');
    bindCheck('set-auto-pause-night', 'autoPauseNight');
    bindCheck('set-danger-vignette', 'dangerVignette');
    bindCheck('set-low-hp-pulse', 'lowHpPulse');
    document.getElementById('set-analytics-optin')?.addEventListener('change', (e) => {
      set('analyticsOptIn', e.target.checked);
      if (typeof Analytics !== 'undefined') {
        Analytics.setEnabled(e.target.checked);
        Analytics.renderSettings();
      }
    });
    document.getElementById('set-error-reporting-optin')?.addEventListener('change', (e) => {
      set('errorReportingOptIn', e.target.checked);
      if (typeof ErrorReporting !== 'undefined') {
        ErrorReporting.onSettingsReady();
      }
    });
    document.getElementById('set-camera-zoom')?.addEventListener('input', (e) => {
      set('cameraZoomSpeed', parseFloat(e.target.value) || 1);
      document.getElementById('set-camera-zoom-val').textContent =
        `${Math.round(settings.cameraZoomSpeed * 100)}%`;
    });
    document.getElementById('set-performance-mode')?.addEventListener('change', (e) => {
      set('performanceMode', e.target.value);
    });

    function onSpeedPick(speed) {
      AudioEngine?.SFX?.click?.();
      const n = typeof PacingTools !== 'undefined' ? PacingTools.normalizeSpeed(speed) : speed;
      set('gameSpeed', n);
      if (typeof Game !== 'undefined' && Game.isPlaying?.()) {
        Game.setGameSpeed?.(n, { silent: true, skipSettings: true });
      }
      if (typeof UI !== 'undefined') UI.updateSpeedControl?.(n);
    }
    if (typeof PacingTools !== 'undefined') {
      PacingTools.renderSpeedButtons(
        '.settings-speed-control',
        settings.gameSpeed ?? 1,
        onSpeedPick
      );
    } else {
      document.querySelectorAll('.settings-speed-control .speed-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const speed = parseFloat(btn.dataset.speed);
          if (!Number.isFinite(speed)) return;
          onSpeedPick(speed);
        });
      });
    }

    document.getElementById('set-panel-opacity')?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value) || 0.95;
      settings.panelOpacity = v;
      document.documentElement.style.setProperty('--panel-opacity', String(v));
      document.documentElement.style.setProperty('--hud-panel-bg', `rgba(20,16,12,${v})`);
      document.documentElement.style.setProperty('--hud-panel-bg-deep', `rgba(12,10,8,${v})`);
      document.getElementById('set-panel-opacity-val').textContent = `${Math.round(v * 100)}%`;
      save();
    });

    document
      .getElementById('set-team-palette')
      ?.addEventListener('change', (e) => set('teamPalette', e.target.value));

    document.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        cancelCapture();
        activeTab = tab.dataset.tab;
        syncForm();
        const body = document.querySelector('#settings-screen .set-content');
        if (body) body.scrollTop = 0;
        AudioEngine?.SFX?.click?.();
      });
    });

    document.getElementById('settings-close')?.addEventListener('click', () => close());
    document.getElementById('settings-reset')?.addEventListener('click', async () => {
      AudioEngine?.SFX?.click?.();
      const yes =
        typeof InPageDialog === 'undefined' ||
        (await InPageDialog.confirm(
          'Put every setting back to its default? Your keys are kept (reset those under Controls).',
          { title: 'Reset settings', okLabel: 'Reset', danger: true }
        ));
      if (!yes) return;
      settings = { ...DEFAULT_SETTINGS };
      save();
      queueElectronWindowMode(true);
    });
    bindKeys();

    const openFromMenu = () => open();
    document.getElementById('menu-settings-btn')?.addEventListener('click', openFromMenu);
    document.getElementById('menu-settings-fab')?.addEventListener('click', openFromMenu);
    document
      .getElementById('top-settings-btn')
      ?.addEventListener('click', () =>
        open({ fromPause: Game.isPlaying?.() && Game.getState()?.paused })
      );
    document
      .getElementById('pause-settings-btn')
      ?.addEventListener('click', () => open({ fromPause: true }));

    window.addEventListener('resize', onWindowResize);

    if (isElectron()) {
      removeModeListener = window.electronAPI.onWindowModeChanged((mode) => {
        if (mode !== settings.windowMode) {
          settings.windowMode = mode;
          syncForm();
        }
      });
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settings.reducedMotion = true;
      apply();
    }

    const manualWrap = document.getElementById('set-ui-scale-manual-wrap');
    if (manualWrap) manualWrap.style.display = settings.uiScaleMode === 'manual' ? '' : 'none';
  }

  // ---- layout ---------------------------------------------------------------------------
  const SECTIONS = [
    { id: 'sound', label: 'Sound', from: ['audio'] },
    { id: 'graphics', label: 'Graphics', from: ['display'] },
    { id: 'controls', label: 'Controls', from: [] },
    { id: 'gameplay', label: 'Gameplay', from: ['gameplay'] },
    { id: 'accessibility', label: 'Accessibility', from: ['accessibility'] },
    { id: 'system', label: 'System', from: ['privacy', 'mods'], minor: true },
    { id: 'cosmetics', label: 'Cosmetics', from: ['cosmetics'], minor: true },
  ];

  function h(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  const esc = (t) =>
    String(t ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  /**
   * Rearrange the settings markup into sections with a pinned section list and footer.
   * Existing groups are moved, not rebuilt, so their ids and the modules bound to them
   * (mods, cosmetics, analytics) keep working. Runs once; does nothing without the panel.
   */
  function buildLayout() {
    const screen = document.getElementById('settings-screen');
    const panel = screen?.querySelector('.settings-panel');
    if (!screen || !panel || screen.classList.contains('set-v3')) return;
    screen.classList.add('set-v3');

    const old = {};
    panel.querySelectorAll('.settings-tab-panel').forEach((p) => {
      old[p.dataset.tab] = p;
    });
    const nav = h('div', 'set-nav');
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Settings sections');
    const content = h('div', 'set-content');

    for (const sec of SECTIONS) {
      const tab = h(
        'button',
        `settings-tab set-nav-btn${sec.minor ? ' minor' : ''}`,
        esc(sec.label)
      );
      tab.type = 'button';
      tab.dataset.tab = sec.id;
      tab.setAttribute('role', 'tab');
      nav.appendChild(tab);
      const pane = h('div', 'settings-tab-panel set-section');
      pane.dataset.tab = sec.id;
      for (const from of sec.from) {
        const src = old[from];
        if (!src) continue;
        while (src.firstChild) pane.appendChild(src.firstChild);
      }
      content.appendChild(pane);
    }
    Object.values(old).forEach((p) => p.remove());
    panel.querySelector('.settings-tabs')?.remove();

    const pane = (id) => content.querySelector(`.set-section[data-tab="${id}"]`);
    const groupOf = (id) => document.getElementById(id)?.closest('.settings-group') || null;

    // Camera speed is a control, not a rule of play.
    const camera = content.querySelector('#set-camera-zoom')?.closest('.settings-group');
    const keys = h(
      'div',
      'settings-group set-keys',
      '<div class="settings-group-head">KEYS</div><div id="set-keys" class="set-keys-body"></div>'
    );
    pane('controls').appendChild(keys);
    if (camera) pane('controls').appendChild(camera);
    pane('controls').appendChild(
      h(
        'div',
        'settings-group',
        '<div class="settings-group-head">CONTROLLER</div>' +
          '<p class="settings-hint">A controller works with no set-up: the d-pad or left stick pans the map, ' +
          'A confirms, B cancels, the bumpers walk through your soldiers and Start pauses. ' +
          'Placing a troop or building still needs the mouse or a finger. ' +
          'Its buttons are listed under each screen in Keys and can be changed the same way.</p>'
      )
    );

    // Accessibility: reduce motion and the team colours, first.
    const motion = content.querySelector('#set-reduced-motion')?.closest('label');
    if (motion) {
      motion.lastChild.textContent = ' Reduce motion (no shake, flashes or sliding panels)';
    }
    const visual = groupOf('set-colorblind') || pane('accessibility').firstElementChild;
    if (visual) {
      const row = h(
        'label',
        'settings-row',
        '<span>Team colours</span>' +
          '<select id="set-team-palette">' +
          '<option value="standard">Standard (blue against red)</option>' +
          '<option value="safe">Colour-blind safe (blue against orange)</option>' +
          '</select>'
      );
      const swatch = h(
        'p',
        'settings-hint set-team-swatches',
        '<span class="set-swatch" style="background:var(--team-player)"></span> Yours ' +
          '<span class="set-swatch" style="background:var(--team-enemy)"></span> Enemy'
      );
      const head = visual.querySelector('.settings-group-head');
      const anchor = head ? head.nextSibling : visual.firstChild;
      visual.insertBefore(swatch, anchor);
      visual.insertBefore(row, swatch);
      if (motion) visual.insertBefore(motion, row);
    }

    const title = panel.querySelector('.settings-title') || h('h2', 'settings-title', 'SETTINGS');
    const actions = panel.querySelector('.settings-actions');
    const body = h('div', 'set-body');
    body.appendChild(nav);
    body.appendChild(content);
    panel.textContent = '';
    panel.appendChild(title);
    panel.appendChild(body);
    if (actions) panel.appendChild(actions);
  }

  // ---- keys -----------------------------------------------------------------------------
  let keysState = 'night';
  /** The binding waiting for a key press: { state, id }. */
  let capture = null;
  /** A refused rebind that can be swapped: { state, id, key }. */
  let pendingSwap = null;
  let keysNote = { text: '', kind: '' };

  const KEY_GROUPS = [
    [
      'General',
      [
        'keySheet',
        'mute',
        'achievements',
        'encyclopedia',
        'cheats',
        'perf',
        'bugReport',
        'messageLog',
        'quickSave',
        'quickLoad',
        'startRun',
        'restart',
        'resume',
        'closePanel',
        'pauseMenu',
        'cancel',
        'creativePanel',
      ],
    ],
    ['Time', ['pause', 'beginDay', 'speedUp', 'speedDown']],
    [
      'Camera and selection',
      [
        'pan',
        'cycleSoldier',
        'cycleSoldierBack',
        'selectAll',
        'selectAllType',
        'centreGeneral',
        'centreBreach',
        'focusSelection',
        'clearSelection',
      ],
    ],
    [
      'Orders',
      ['hunt', 'holdHere', 'backToPosts', 'reform', 'promote', 'formation', 'order', 'loadout'],
    ],
    ['Spoils', ['spoilPick', 'spoilMove', 'spoilConfirm']],
    ['Strikes and spells', ['ability']],
    ['Recruit (keys go to troops as they unlock)', ['deploySlot']],
    ['Build', ['build', 'rotateWall', 'demolish', 'moveBuilding']],
    ['More buildings (as they unlock)', ['buildSlot']],
    ['Spy actions (as they unlock)', ['spySlot']],
    ['Courier messages (as they unlock)', ['courierSlot']],
    ['Control groups', ['saveGroup']],
  ];

  function hk() {
    return typeof Hotkeys !== 'undefined' ? Hotkeys : null;
  }

  /** What sits on a slot right now, for the row label ("Recruit slot 3 · Mage"). */
  function slotOccupant(b) {
    const H = hk();
    const kind = {
      deploySlot: 'deploy',
      buildSlot: 'build',
      spySlot: 'spy',
      courierSlot: 'courier',
    }[b.action];
    if (!kind || !H.slotItemAt) return '';
    const id = H.slotItemAt(kind, b.arg);
    if (!id) return '';
    return typeof Availability !== 'undefined' ? Availability.nameOf(kind, id) : id;
  }

  function keyRow(b) {
    const H = hk();
    const listening = capture && capture.state === keysState && capture.id === b.id;
    const occ = slotOccupant(b);
    const label = esc(b.label) + (occ ? ` <em>· ${esc(occ)}</em>` : '');
    const keyText = listening ? 'Press a key…' : b.key ? esc(H.keyLabel(b.key)) : 'None';
    const cls = [
      'set-key-btn',
      listening ? 'listening' : '',
      b.custom ? 'custom' : '',
      b.key ? '' : 'unbound',
      b.fixed ? 'fixed' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const title = b.fixed
      ? 'Fixed: this key means the same thing everywhere'
      : b.custom
        ? `Changed. Default: ${b.defaultKey ? H.keyLabel(b.defaultKey) : 'none'}`
        : 'Click, then press a key';
    return (
      `<div class="set-key-row${b.custom ? ' custom' : ''}">` +
      `<span class="set-key-label">${label}</span>` +
      `<button type="button" class="${cls}" data-key-id="${esc(b.id)}" title="${esc(title)}"${b.fixed ? ' disabled' : ''}>${keyText}</button>` +
      '</div>'
    );
  }

  function renderKeys() {
    const host = document.getElementById('set-keys');
    const H = hk();
    if (!host || !H) return;
    const rows = H.bindingsOf(keysState);
    const keyboard = rows.filter((b) => !b.pad);
    const pad = rows.filter((b) => b.pad);
    const used = new Set();
    let groups = '';
    for (const [name, actions] of KEY_GROUPS) {
      const list = keyboard.filter((b) => actions.includes(b.action));
      if (!list.length) continue;
      list.forEach((b) => used.add(b.id));
      groups += `<div class="set-key-group"><div class="set-key-group-head">${esc(name)}</div><div class="set-key-grid">${list.map(keyRow).join('')}</div></div>`;
    }
    const rest = keyboard.filter((b) => !used.has(b.id));
    if (rest.length) {
      groups += `<div class="set-key-group"><div class="set-key-group-head">Other</div><div class="set-key-grid">${rest.map(keyRow).join('')}</div></div>`;
    }
    if (pad.length) {
      groups += `<div class="set-key-group"><div class="set-key-group-head">Controller</div><div class="set-key-grid">${pad.map(keyRow).join('')}</div></div>`;
    }
    const pills = H.STATES.map(
      (s) =>
        `<button type="button" class="set-state-pill${s === keysState ? ' active' : ''}${H.isCustom(s) ? ' custom' : ''}" data-key-state="${s}" role="tab" aria-selected="${s === keysState}">${esc(H.STATE_LABELS[s])}</button>`
    ).join('');
    const swap = pendingSwap
      ? ' <button type="button" class="set-key-act" data-key-act="swap">Swap them</button>' +
        ' <button type="button" class="set-key-act" data-key-act="dismiss">Leave it</button>'
      : '';
    host.innerHTML =
      '<p class="settings-hint">Keys depend on what you are doing. Pick a screen, click an action, then press the new key ' +
      '(Shift, Alt and Ctrl count). Backspace leaves it with no key; Esc cancels. ' +
      'A change follows the action onto every screen where it had the same key.</p>' +
      '<div class="set-key-head">' +
      `<div class="set-state-pills" role="tablist" aria-label="Screens">${pills}</div>` +
      '<div class="set-key-toolbar">' +
      `<div class="set-key-note ${esc(keysNote.kind)}" role="status" aria-live="polite">${esc(keysNote.text)}${swap}</div>` +
      `<button type="button" class="set-key-act" data-key-act="reset-state"${H.isCustom(keysState) ? '' : ' disabled'}>Reset “${esc(H.STATE_LABELS[keysState])}”</button>` +
      `<button type="button" class="set-key-act" data-key-act="reset-all"${H.isCustom() ? '' : ' disabled'}>Reset all keys</button>` +
      '</div></div>' +
      `<div class="set-key-list">${groups}</div>`;
  }

  function note(text, kind = '') {
    keysNote = { text, kind };
  }

  function cancelCapture() {
    if (!capture && !pendingSwap) return;
    capture = null;
    pendingSwap = null;
    renderKeys();
  }

  /** Try a key for the action being rebound, and say what happened. */
  function applyCapturedKey(key, swap = false) {
    const H = hk();
    const target = swap ? pendingSwap : capture;
    if (!H || !target) return;
    const b = H.bindingsOf(target.state).find((x) => x.id === target.id);
    const res = H.rebind(target.state, target.id, key, { swap });
    capture = null;
    pendingSwap = null;
    if (res.ok) {
      const others = (res.states || []).length - 1;
      note(
        key == null
          ? `“${b?.label}” now has no key.`
          : `“${b?.label}” is now ${H.keyLabel(key)}${res.swapped ? ' (swapped)' : ''}${others > 0 ? `, on ${others + 1} screens` : ''}.`,
        'ok'
      );
      AudioEngine?.SFX?.click?.();
    } else {
      if (res.reason === 'conflict' && res.canSwap) {
        pendingSwap = { state: target.state, id: target.id, key };
      }
      note(res.message || 'That key cannot be used.', 'bad');
      AudioEngine?.SFX?.error?.();
    }
    renderKeys();
  }

  /** A controller button pressed while an action waits for a key (called by js/main.js). */
  function capturePadKey(key) {
    if (capture) applyCapturedKey(key);
  }

  function bindKeys() {
    const host = document.getElementById('set-keys');
    const H = hk();
    if (!host || !H) return;
    host.addEventListener('click', async (e) => {
      const el = e.target.closest('button');
      if (!el || !host.contains(el)) return;
      if (el.dataset.keyState) {
        keysState = el.dataset.keyState;
        capture = null;
        pendingSwap = null;
        note('');
        renderKeys();
      } else if (el.dataset.keyId) {
        const same = capture && capture.id === el.dataset.keyId && capture.state === keysState;
        capture = same ? null : { state: keysState, id: el.dataset.keyId };
        pendingSwap = null;
        note(capture ? 'Press the new key. Esc cancels, Backspace clears.' : '');
        renderKeys();
        el.blur();
      } else if (el.dataset.keyAct === 'swap') {
        if (pendingSwap) applyCapturedKey(pendingSwap.key, true);
      } else if (el.dataset.keyAct === 'dismiss') {
        pendingSwap = null;
        note('');
        renderKeys();
      } else if (el.dataset.keyAct === 'reset-state') {
        H.resetState(keysState);
        note(`“${H.STATE_LABELS[keysState]}” keys are back to their defaults.`, 'ok');
        renderKeys();
      } else if (el.dataset.keyAct === 'reset-all') {
        const yes =
          typeof InPageDialog === 'undefined' ||
          (await InPageDialog.confirm('Put every key on every screen back to its default?', {
            title: 'Reset all keys',
            okLabel: 'Reset keys',
            danger: true,
          }));
        if (!yes) return;
        H.resetAll();
        note('All keys are back to their defaults.', 'ok');
        renderKeys();
      }
    });
    // Capture phase, so the game's own key handler never sees a key meant for a rebind.
    document.addEventListener(
      'keydown',
      (e) => {
        if (!capture) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
          capture = null;
          note('');
          renderKeys();
          return;
        }
        if (e.key === 'Backspace') {
          applyCapturedKey(null);
          return;
        }
        const key = H.keyOfEvent(e);
        if (key) applyCapturedKey(key);
        else if (e.metaKey) {
          capture = null;
          note('The Windows / Command key belongs to the system and cannot be bound.', 'bad');
          renderKeys();
        }
      },
      true
    );
  }

  async function requestBrowserFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        set('windowMode', 'windowed');
      } else {
        await document.documentElement.requestFullscreen();
        set('windowMode', 'fullscreen');
      }
    } catch (_) {
      /* ignore */
    }
  }

  /** @param {{ fromPause?: boolean, tab?: string }} [opts] */
  function open(opts = {}) {
    returnToPause = !!opts.fromPause;
    pausedByUs = false;
    // Opened in the middle of play: hold the battle, and give it back on close.
    if (Game.isPlaying?.() && !Game.getState().paused) {
      Game.setPaused?.(true);
      pausedByUs = true;
    }
    if ((returnToPause || pausedByUs) && typeof UX !== 'undefined') UX.suppressPauseForOverlay();
    if (opts.tab && SECTIONS.some((x) => x.id === opts.tab)) activeTab = opts.tab;
    settingsOpen = true;
    document.getElementById('settings-screen')?.classList.add('active');
    syncForm();
    AudioEngine?.SFX?.click?.();
  }

  /** Closing goes back to wherever Settings was opened from: the pause menu, or the battle. */
  function close() {
    cancelCapture();
    settingsOpen = false;
    document.getElementById('settings-screen')?.classList.remove('active');
    AudioEngine?.SFX?.click?.();
    const paused = Game.isPlaying?.() && Game.getState().paused;
    if (pausedByUs && paused) {
      Game.setPaused?.(false);
    } else if (returnToPause && paused) {
      if (typeof UX !== 'undefined') UX.openPauseMenu();
    }
    returnToPause = false;
    pausedByUs = false;
  }

  function isOpen() {
    return settingsOpen;
  }

  function init() {
    buildLayout();
    load();
    bind();
    if (typeof ModLoader !== 'undefined') ModLoader.bindSettings();
    if (typeof Cosmetics !== 'undefined') Cosmetics.init();
    if (typeof Analytics !== 'undefined') {
      Analytics.init();
      Analytics.bindSettings();
      Analytics.syncEnabled();
    }
    updateWindowModeNote();
    syncSoundButton();
  }

  return {
    init,
    get,
    set,
    open,
    close,
    isOpen,
    getPanelInsets,
    getTeamColours,
    isCapturingKey: () => !!capture,
    capturePadKey,
    getCameraZoomSpeed: () => settings.cameraZoomSpeed,
    getHitboxBonus: () => (settings.largerHitboxes ? 8 : 0),
    announce(text) {
      if (!settings.screenReader) return;
      const live = document.getElementById('sr-live-region');
      if (live) live.textContent = text;
    },
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Settings = Settings;
