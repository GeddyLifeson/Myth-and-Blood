/**
 * Game settings — display scaling, window mode, audio, accessibility, gameplay.
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
    screenReader: false,
    largerHitboxes: false,
    showMinimap: true,
    tutorialEnabled: true,
    performanceMode: 'auto',
    gameSpeed: 1,
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
  let activeTab = 'display';
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
    } catch (_) { /* ignore */ }
    apply();
    /* Defer window recreate so it does not interrupt the first play session. */
    const deferMode = () => queueElectronWindowMode(false);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => deferMode());
    else setTimeout(deferMode, 0);
  }

  function save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) { /* ignore */ }
    apply();
  }

  function get(key) {
    return key ? settings[key] : { ...settings };
  }

  function set(key, value) {
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
      left: Math.round(84 * s),
      right: Math.round(78 * s),
      top: Math.round(52 * s),
      bottom: Math.round(40 * s),
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
      if (note) note.textContent = 'Borderless window requires the desktop app (Play Myth and Blood.bat). Browser can use fullscreen only.';
      borderless?.setAttribute('disabled', '');
      windowed?.setAttribute('disabled', '');
      return;
    }
    if (note) note.textContent = 'Borderless = no title bar, fills your monitor. Fullscreen = exclusive fullscreen. Switching borderless reloads once.';
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
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* ignore */ }
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
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setCheck = (id, val) => document.getElementById(id)?.toggleAttribute('checked', !!val);
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setVal('set-ui-scale-mode', settings.uiScaleMode);
    setVal('set-ui-scale-manual', settings.uiScaleManual);
    setText('set-ui-scale-val', `${Math.round(getEffectiveUIScale() * 100)}%`);
    setText('set-ui-scale-auto-val', `${Math.round(computeAutoScale() * 100)}%`);

    document.querySelectorAll('[data-window-mode]').forEach(btn => {
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
    setVal('set-font-scale', settings.fontScale);
    setText('set-font-scale-val', `${Math.round(settings.fontScale * 100)}%`);
    setCheck('set-high-contrast', settings.highContrast);
    setCheck('set-reduced-motion', settings.reducedMotion);
    setCheck('set-screen-reader', settings.screenReader);
    setCheck('set-large-hitboxes', settings.largerHitboxes);

    setCheck('set-show-minimap', settings.showMinimap);
    setCheck('set-show-hint-bar', settings.showHintBar);
    setCheck('set-tutorial', settings.tutorialEnabled);
    setVal('set-camera-zoom', settings.cameraZoomSpeed);
    setText('set-camera-zoom-val', `${Math.round(settings.cameraZoomSpeed * 100)}%`);
    setVal('set-panel-opacity', settings.panelOpacity);
    setText('set-panel-opacity-val', `${Math.round(settings.panelOpacity * 100)}%`);
    setVal('set-performance-mode', settings.performanceMode || 'auto');
    if (typeof UI !== 'undefined') UI.updateSpeedControl?.(settings.gameSpeed ?? 1);

    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === activeTab);
    });
    document.querySelectorAll('.settings-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.tab === activeTab);
    });
  }

  function bind() {
    document.getElementById('set-ui-scale-mode')?.addEventListener('change', (e) => {
      set('uiScaleMode', e.target.value);
      const manual = document.getElementById('set-ui-scale-manual-wrap');
      if (manual) manual.style.display = e.target.value === 'manual' ? '' : 'none';
    });

    document.getElementById('set-ui-scale-manual')?.addEventListener('input', (e) => {
      set('uiScaleManual', parseFloat(e.target.value) || 1);
      document.getElementById('set-ui-scale-val').textContent = `${Math.round(getEffectiveUIScale() * 100)}%`;
    });

    document.querySelectorAll('[data-window-mode]').forEach(btn => {
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

    document.getElementById('set-muted')?.addEventListener('change', (e) => set('muted', e.target.checked));

    document.getElementById('set-colorblind')?.addEventListener('change', (e) => set('colorBlind', e.target.value));
    document.getElementById('set-font-scale')?.addEventListener('input', (e) => {
      set('fontScale', parseFloat(e.target.value) || 1);
      document.getElementById('set-font-scale-val').textContent = `${Math.round(settings.fontScale * 100)}%`;
    });
    document.getElementById('set-high-contrast')?.addEventListener('change', (e) => set('highContrast', e.target.checked));
    document.getElementById('set-reduced-motion')?.addEventListener('change', (e) => set('reducedMotion', e.target.checked));
    document.getElementById('set-screen-reader')?.addEventListener('change', (e) => set('screenReader', e.target.checked));
    document.getElementById('set-large-hitboxes')?.addEventListener('change', (e) => set('largerHitboxes', e.target.checked));

    document.getElementById('set-show-minimap')?.addEventListener('change', (e) => set('showMinimap', e.target.checked));
    document.getElementById('set-show-hint-bar')?.addEventListener('change', (e) => set('showHintBar', e.target.checked));
    document.getElementById('set-tutorial')?.addEventListener('change', (e) => {
      set('tutorialEnabled', e.target.checked);
      if (e.target.checked && typeof UX !== 'undefined') UX.resetTutorial?.();
    });
    document.getElementById('set-camera-zoom')?.addEventListener('input', (e) => {
      set('cameraZoomSpeed', parseFloat(e.target.value) || 1);
      document.getElementById('set-camera-zoom-val').textContent = `${Math.round(settings.cameraZoomSpeed * 100)}%`;
    });
    document.getElementById('set-performance-mode')?.addEventListener('change', (e) => {
      set('performanceMode', e.target.value);
    });

    document.querySelectorAll('.settings-speed-control .speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioEngine?.SFX?.click?.();
        const speed = parseFloat(btn.dataset.speed);
        if (!Number.isFinite(speed)) return;
        set('gameSpeed', speed);
        if (typeof Game !== 'undefined' && Game.isPlaying?.()) {
          Game.setGameSpeed?.(speed, { silent: true, skipSettings: true });
        }
      });
    });

    document.getElementById('set-panel-opacity')?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value) || 0.95;
      settings.panelOpacity = v;
      document.documentElement.style.setProperty('--panel-opacity', String(v));
      document.documentElement.style.setProperty('--hud-panel-bg', `rgba(20,16,12,${v})`);
      document.documentElement.style.setProperty('--hud-panel-bg-deep', `rgba(12,10,8,${v})`);
      document.getElementById('set-panel-opacity-val').textContent = `${Math.round(v * 100)}%`;
      save();
    });

    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        syncForm();
        AudioEngine?.SFX?.click?.();
      });
    });

    document.getElementById('settings-close')?.addEventListener('click', () => close());
    document.getElementById('settings-reset')?.addEventListener('click', () => {
      settings = { ...DEFAULT_SETTINGS };
      save();
      queueElectronWindowMode(true);
      AudioEngine?.SFX?.click?.();
    });

    const openFromMenu = () => open();
    document.getElementById('menu-settings-btn')?.addEventListener('click', openFromMenu);
    document.getElementById('menu-settings-fab')?.addEventListener('click', openFromMenu);
    document.getElementById('top-settings-btn')?.addEventListener('click', () => open({ fromPause: Game.isPlaying?.() && Game.getState()?.paused }));
    document.getElementById('pause-settings-btn')?.addEventListener('click', () => open({ fromPause: true }));

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

  async function requestBrowserFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        set('windowMode', 'windowed');
      } else {
        await document.documentElement.requestFullscreen();
        set('windowMode', 'fullscreen');
      }
    } catch (_) { /* ignore */ }
  }

  function open(opts = {}) {
    returnToPause = !!opts.fromPause;
    if (Game.isPlaying?.() && !Game.getState().paused) {
      Game.setPaused?.(true);
      returnToPause = true;
    }
    settingsOpen = true;
    document.getElementById('settings-screen')?.classList.add('active');
    syncForm();
    AudioEngine?.SFX?.click?.();
  }

  function close() {
    settingsOpen = false;
    document.getElementById('settings-screen')?.classList.remove('active');
    AudioEngine?.SFX?.click?.();
  }

  function isOpen() {
    return settingsOpen;
  }

  function init() {
    load();
    bind();
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
    getEffectiveUIScale,
    getPanelInsets,
    updateUIScale,
    onWindowResize,
    getCameraZoomSpeed: () => settings.cameraZoomSpeed,
    getHitboxBonus: () => (settings.largerHitboxes ? 8 : 0),
    shouldAnnounce: () => !!settings.screenReader,
    announce(text) {
      if (!settings.screenReader) return;
      const live = document.getElementById('sr-live-region');
      if (live) live.textContent = text;
    },
  };
})();