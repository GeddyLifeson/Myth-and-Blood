/**
 * Cosmetics — unit skins, kingdom banner customizer, victory themes.
 * Persisted in localStorage; mastery faction skins unlock via MetaProgress creative skins.
 */
const Cosmetics = (() => {
  const STORAGE_KEY = 'myth-and-blood-cosmetics-v1';

  const DEFAULT_STATE = {
    unitSkin: 'classic',
    banner: {
      primary: '#c0a040',
      secondary: '#ffd878',
      pattern: 'auto',
      emblem: 'crown',
    },
    victoryTheme: 'classic',
  };

  const UNIT_SKINS = {
    classic: {
      label: 'Classic Host',
      unlock: 'default',
      desc: 'Default army colors.',
    },
    royal_gold: {
      label: 'Royal Gold',
      unlock: 'default',
      desc: 'Gilded plate and sunlit pennants.',
      body: '#907020',
      accent: '#ffd878',
      mark: '#fff0a0',
    },
    crimson_legion: {
      label: 'Crimson Legion',
      unlock: 'default',
      desc: 'Blood-red armor with brass trim.',
      body: '#802030',
      accent: '#c05060',
      mark: '#ffd0a0',
    },
    frost_guard: {
      label: 'Frost Guard',
      unlock: 'default',
      desc: 'Ice-blue steel for northern holds.',
      body: '#406880',
      accent: '#a0d0f0',
      mark: '#e0f0ff',
    },
    shadow_veil: {
      label: 'Shadow Veil',
      unlock: 'default',
      desc: 'Midnight hues for covert hosts.',
      body: '#282838',
      accent: '#504068',
      mark: '#a080c0',
    },
    verdant_host: {
      label: 'Verdant Host',
      unlock: 'default',
      desc: 'Forest greens for ranger companies.',
      body: '#306040',
      accent: '#60a070',
      mark: '#c0e080',
    },
    ring_champion: {
      label: 'Ring Champion',
      unlock: 'creative_skin_wwe',
      desc: 'Unlocked at coliseum mastery tier IV.',
      body: '#702028',
      accent: '#ffd700',
      mark: '#c04040',
    },
    hell_walker: {
      label: 'Hell Walker',
      unlock: 'creative_skin_doom',
      desc: 'Unlocked at Doom mastery tier IV.',
      body: '#1a3020',
      accent: '#40c060',
      mark: '#80ff80',
    },
    crystal_vanguard: {
      label: 'Crystal Vanguard',
      unlock: 'creative_skin_crystal',
      desc: 'Unlocked at Crystal mastery tier IV.',
      body: '#5080c0',
      accent: '#a0d0f0',
      mark: '#c04060',
    },
    warp_legion: {
      label: 'Rift Cult',
      unlock: 'creative_skin_warp',
      desc: 'Unlocked at Warp mastery tier IV.',
      body: '#402030',
      accent: '#8040a0',
      mark: '#ff4020',
    },
    imperium_herald: {
      label: "Crimson Legions",
      unlock: 'creative_skin_imperium',
      desc: 'Unlocked at Imperium mastery tier IV.',
      body: '#384858',
      accent: '#6080b0',
      mark: '#c04040',
    },
  };

  const BANNER_PATTERNS = {
    auto: { label: 'Follow evolution', tier: null },
    pennant: { label: 'Small Pennant', tier: 1 },
    crest: { label: 'Kingdom Crest', tier: 2 },
    shield: { label: 'Empire Banner', tier: 3 },
    hellforge: { label: 'Hell-Forged Banner', tier: 4 },
  };

  const BANNER_EMBLEMS = {
    crown: { label: 'Crown', glyph: '♛' },
    sun: { label: 'Sun', glyph: '☀' },
    sword: { label: 'Crossed Swords', glyph: '⚔' },
    skull: { label: 'Skull', glyph: '☠' },
    dragon: { label: 'Dragon', glyph: '🐉' },
    star: { label: 'Star', glyph: '✦' },
  };

  const VICTORY_THEMES = {
    classic: {
      label: 'Classic Fanfare',
      unlock: 'default',
      desc: 'Bright gold confetti and a triumphant chime.',
      crest: null,
      confetti: ['#f0c040', '#ffd700', '#80c0ff', '#40e0a0', '#ff8060', '#e8d5b0'],
      notes: [523, 659, 784, 1047],
      backdropClass: null,
    },
    imperial_glory: {
      label: 'Imperial Glory',
      unlock: 'default',
      desc: 'Regal brass tones and a rising march.',
      crest: '♛',
      confetti: ['#ffd878', '#c0a040', '#e8d5b0', '#fff0c0', '#a08050'],
      notes: [392, 523, 659, 784, 988],
      backdropClass: 'theme-imperial',
    },
    crystal_hymn: {
      label: 'Crystal Hymn',
      unlock: 'default',
      desc: 'Shimmering blues and crystalline tones.',
      crest: '◇',
      confetti: ['#80c0ff', '#a0d0f0', '#c0e8ff', '#5080c0', '#e0f0ff'],
      notes: [659, 784, 988, 1175],
      backdropClass: 'theme-crystal',
    },
    blood_oath: {
      label: 'Blood Oath',
      unlock: 'default',
      desc: 'Crimson storm and a fierce war cadence.',
      crest: '⚔',
      confetti: ['#c04040', '#802030', '#ff6040', '#ffd0a0', '#a05050'],
      notes: [330, 440, 554, 659, 880],
      backdropClass: 'theme-blood',
    },
    void_ascendant: {
      label: 'Void Ascendant',
      unlock: 'default',
      desc: 'Dark violet spectacle for late-game triumphs.',
      crest: '☽',
      confetti: ['#6040a0', '#8040c0', '#302040', '#a080ff', '#ff4080'],
      notes: [220, 277, 330, 440, 554],
      backdropClass: 'theme-void',
    },
    conquest_sunrise: {
      label: 'Conquest Sunrise',
      unlock: 'default',
      desc: 'Planet-wide victory palette — dawn over a conquered world.',
      crest: '☀',
      title: 'TRUE VICTORY!',
      subtitle: 'Your banner flies over every realm. The planet kneels.',
      confetti: ['#ff9080', '#50ffa0', '#ffd878', '#80c0ff', '#ff6080'],
      notes: [440, 554, 659, 880, 1109],
      backdropClass: 'theme-conquest',
    },
  };

  let state = { ...DEFAULT_STATE, banner: { ...DEFAULT_STATE.banner } };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = {
          ...DEFAULT_STATE,
          ...parsed,
          banner: { ...DEFAULT_STATE.banner, ...(parsed.banner || {}) },
        };
      }
    } catch (_) {
      /* ignore */
    }
    sanitizeSelections();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      /* ignore */
    }
    notifyChanged();
  }

  function notifyChanged() {
    if (typeof UI !== 'undefined') UI.updateHUD?.(true);
    if (typeof Game !== 'undefined' && Game.isPlaying?.()) Game.draw?.();
  }

  function isUnlockMet(unlock) {
    if (!unlock || unlock === 'default') return true;
    if (unlock.startsWith('creative_skin_')) {
      const fid = unlock.slice('creative_skin_'.length);
      return typeof MetaProgress !== 'undefined' && MetaProgress.hasCreativeSkin?.(fid);
    }
    return true;
  }

  function sanitizeSelections() {
    if (!isUnlockMet(UNIT_SKINS[state.unitSkin]?.unlock)) state.unitSkin = 'classic';
    if (!isUnlockMet(VICTORY_THEMES[state.victoryTheme]?.unlock)) state.victoryTheme = 'classic';
    if (!BANNER_PATTERNS[state.banner.pattern]) state.banner.pattern = 'auto';
    if (!BANNER_EMBLEMS[state.banner.emblem]) state.banner.emblem = 'crown';
  }

  function getState() {
    return {
      unitSkin: state.unitSkin,
      banner: { ...state.banner },
      victoryTheme: state.victoryTheme,
    };
  }

  function getSnapshot() {
    const skin = UNIT_SKINS[state.unitSkin];
    const theme = VICTORY_THEMES[state.victoryTheme];
    return {
      ...getState(),
      unitSkinLabel: skin?.label || state.unitSkin,
      victoryThemeLabel: theme?.label || state.victoryTheme,
    };
  }

  function setUnitSkin(id) {
    if (!UNIT_SKINS[id] || !isUnlockMet(UNIT_SKINS[id].unlock)) return false;
    state.unitSkin = id;
    save();
    return true;
  }

  function setVictoryTheme(id) {
    if (!VICTORY_THEMES[id] || !isUnlockMet(VICTORY_THEMES[id].unlock)) return false;
    state.victoryTheme = id;
    save();
    return true;
  }

  function setBannerField(key, value) {
    if (!(key in state.banner)) return false;
    state.banner[key] = value;
    save();
    return true;
  }

  function applyUnitSkin(baseStyle) {
    const skin = UNIT_SKINS[state.unitSkin];
    if (!skin || !baseStyle) return baseStyle;
    if (!skin.body && !skin.accent && !skin.mark) return baseStyle;
    return {
      ...baseStyle,
      body: skin.body || baseStyle.body,
      accent: skin.accent || baseStyle.accent,
      mark: skin.mark || baseStyle.mark,
    };
  }

  function getBannerOpts() {
    return { ...state.banner };
  }

  function resolveBannerStage(evolutionStage) {
    const pat = BANNER_PATTERNS[state.banner.pattern];
    if (!pat || pat.tier == null) return Math.max(1, Math.min(4, evolutionStage | 0));
    return pat.tier;
  }

  function getVictoryTheme() {
    return VICTORY_THEMES[state.victoryTheme] || VICTORY_THEMES.classic;
  }

  function getVictoryThemeId() {
    return state.victoryTheme;
  }

  function resolveVictoryCopy(reason, baseCopy) {
    const theme = getVictoryTheme();
    const copy = { ...(baseCopy || {}) };
    if (theme.title) copy.title = theme.title;
    if (theme.subtitle) copy.subtitle = theme.subtitle;
    if (theme.crest) copy.crest = theme.crest;
    return copy;
  }

  function spawnVictoryConfetti(host) {
    if (!host) return;
    host.innerHTML = '';
    const theme = getVictoryTheme();
    const colors = theme.confetti || VICTORY_THEMES.classic.confetti;
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

  function getVictoryBackdropClass() {
    return getVictoryTheme().backdropClass || null;
  }

  function drawBannerPreview(ctx, w, h) {
    if (!ctx || typeof VisualPolish === 'undefined' || !VisualPolish.drawKingdomBanner) return;
    VisualPolish.drawKingdomBanner(ctx, w, h, 3, 0.72, state.banner.primary, getBannerOpts());
  }

  function renderSettings() {
    const skinGrid = document.getElementById('cosmetics-skin-grid');
    const themeList = document.getElementById('cosmetics-theme-list');
    const preview = document.getElementById('cosmetics-banner-preview');
    if (!skinGrid && !themeList) return;

    if (skinGrid) {
      skinGrid.innerHTML = Object.entries(UNIT_SKINS)
        .map(([id, def]) => {
          const locked = !isUnlockMet(def.unlock);
          const selected = state.unitSkin === id;
          const swatch = def.body || '#5070a8';
          const accent = def.accent || '#c0c8e0';
          return (
            `<button type="button" class="cosmetic-pick-btn${selected ? ' selected' : ''}${locked ? ' locked' : ''}"` +
            ` data-cosmetic-skin="${id}" ${locked ? 'disabled' : ''} title="${def.desc || ''}">` +
            `<span class="cosmetic-swatch" style="background:linear-gradient(135deg,${swatch},${accent})"></span>` +
            `<span class="cosmetic-pick-label">${def.label}${locked ? ' 🔒' : ''}</span>` +
            `</button>`
          );
        })
        .join('');
    }

    if (themeList) {
      themeList.innerHTML = Object.entries(VICTORY_THEMES)
        .map(([id, def]) => {
          const locked = !isUnlockMet(def.unlock);
          const selected = state.victoryTheme === id;
          const crest = def.crest || '✦';
          return (
            `<button type="button" class="cosmetic-theme-btn${selected ? ' selected' : ''}${locked ? ' locked' : ''}"` +
            ` data-cosmetic-theme="${id}" ${locked ? 'disabled' : ''} title="${def.desc || ''}">` +
            `<span class="cosmetic-theme-crest">${crest}</span>` +
            `<span class="cosmetic-pick-label">${def.label}${locked ? ' 🔒' : ''}</span>` +
            `</button>`
          );
        })
        .join('');
    }

    const patSel = document.getElementById('cosmetics-banner-pattern');
    const embSel = document.getElementById('cosmetics-banner-emblem');
    const pri = document.getElementById('cosmetics-banner-primary');
    const sec = document.getElementById('cosmetics-banner-secondary');
    if (patSel) patSel.value = state.banner.pattern;
    if (embSel) embSel.value = state.banner.emblem;
    if (pri) pri.value = state.banner.primary;
    if (sec) sec.value = state.banner.secondary;

    if (preview) {
      const ctx = preview.getContext('2d');
      drawBannerPreview(ctx, preview.width, preview.height);
    }
  }

  function bindSettings() {
    document.getElementById('cosmetics-skin-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cosmetic-skin]');
      if (!btn || btn.disabled) return;
      AudioEngine?.SFX?.click?.();
      if (setUnitSkin(btn.dataset.cosmeticSkin)) {
        renderSettings();
        UI?.refreshPanelIcons?.();
      }
    });

    document.getElementById('cosmetics-theme-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cosmetic-theme]');
      if (!btn || btn.disabled) return;
      AudioEngine?.SFX?.click?.();
      if (setVictoryTheme(btn.dataset.cosmeticTheme)) renderSettings();
    });

    document.getElementById('cosmetics-banner-pattern')?.addEventListener('change', (e) => {
      setBannerField('pattern', e.target.value);
      renderSettings();
    });
    document.getElementById('cosmetics-banner-emblem')?.addEventListener('change', (e) => {
      setBannerField('emblem', e.target.value);
      renderSettings();
    });
    document.getElementById('cosmetics-banner-primary')?.addEventListener('input', (e) => {
      setBannerField('primary', e.target.value);
      renderSettings();
    });
    document.getElementById('cosmetics-banner-secondary')?.addEventListener('input', (e) => {
      setBannerField('secondary', e.target.value);
      renderSettings();
    });

    document.getElementById('cosmetics-reset')?.addEventListener('click', () => {
      state = { ...DEFAULT_STATE, banner: { ...DEFAULT_STATE.banner } };
      save();
      renderSettings();
      UI?.refreshPanelIcons?.();
      AudioEngine?.SFX?.click?.();
      Settings?.announce?.('Cosmetics reset to defaults');
    });
  }

  function init() {
    load();
    bindSettings();
  }

  return {
    init,
    load,
    save,
    getState,
    getSnapshot,
    setUnitSkin,
    setVictoryTheme,
    setBannerField,
    applyUnitSkin,
    getBannerOpts,
    resolveBannerStage,
    getVictoryTheme,
    getVictoryThemeId,
    resolveVictoryCopy,
    spawnVictoryConfetti,
    getVictoryBackdropClass,
    drawBannerPreview,
    renderSettings,
    bindSettings,
    isUnlockMet,
    UNIT_SKINS,
    VICTORY_THEMES,
    BANNER_PATTERNS,
    BANNER_EMBLEMS,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.Cosmetics = Cosmetics;
