/**
 * UI controller — panels, HUD, specialists.
 */
const UI = (() => {
  const OVERLAY_SCREEN_IDS = [
    'menu-screen',
    'pause-screen',
    'gameover-screen',
    'settings-screen',
    'achievements-screen',
    'advanced-diff-screen',
    'cheats-screen',
    'encyclopedia-screen',
    'crossover-screen',
    'wwe-screen',
  ];

  function setPlayingUi(active) {
    document.body.classList.toggle('game-playing', active);
    document.body.classList.toggle('menu-dismissed', active);
  }

  function setLaunchOverlayVisible(visible) {
    const el = document.getElementById('launch-overlay');
    if (!el) return;
    el.hidden = !visible;
    el.classList.toggle('visible', visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function dismissMenuScreen() {
    const menu = document.getElementById('menu-screen');
    if (!menu) return;
    menu.classList.remove('active');
    menu.classList.add('menu-dismissed');
    menu.hidden = true;
    menu.style.display = 'none';
    menu.setAttribute('aria-hidden', 'true');
    menu.setAttribute('inert', '');
  }

  function restoreMenuScreen() {
    const menu = document.getElementById('menu-screen');
    if (!menu) return;
    menu.classList.remove('menu-dismissed');
    menu.hidden = false;
    menu.style.display = '';
    menu.removeAttribute('aria-hidden');
    menu.removeAttribute('inert');
    menu.classList.add('active');
  }

  /** Keep the main menu hidden whenever a run is active (self-heals partial boot failures). */
  function ensureMenuDismissedForPlay() {
    if (!Game.isPlaying?.()) return;
    setPlayingUi(true);
    dismissMenuScreen();
    // Do not strip pause/settings/encyclopedia — those are opened intentionally during play.
  }

  function hideMenusForPlay(opts = {}) {
    const showLaunch = opts.showLaunch !== false;
    // Hide menu before closing overlays — Settings/Encyclopedia close must not block dismissal.
    setPlayingUi(true);
    dismissMenuScreen();
    for (const id of OVERLAY_SCREEN_IDS) {
      document.getElementById(id)?.classList.remove('active');
    }
    closeMenuSheets();
    try {
      if (typeof Settings !== 'undefined' && Settings.isOpen?.()) Settings.close?.();
      if (typeof Encyclopedia !== 'undefined' && Encyclopedia.isOpen?.()) Encyclopedia.close?.();
      if (typeof FactionIntel !== 'undefined' && FactionIntel.isPanelOpen?.()) {
        FactionIntel.closePanel?.();
      }
    } catch (err) {
      console.warn('hideMenusForPlay: overlay close failed', err);
    }
    if (showLaunch) setLaunchOverlayVisible(true);
    // Force style/layout commit before long synchronous Game.start (The Long Siege boot).
    void document.body.offsetHeight;
    document.getElementById('menu-screen')?.getBoundingClientRect();
  }

  /** rAF alone can run before paint; yield once more so the menu actually disappears. */
  function deferAfterPaint(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(fn, 0));
    } else {
      setTimeout(fn, 0);
    }
  }

  function showMainMenu() {
    setLaunchOverlayVisible(false);
    for (const id of OVERLAY_SCREEN_IDS) {
      document.getElementById(id)?.classList.remove('active');
    }
    setPlayingUi(false);
    restoreMenuScreen();
  }

  let gameOverShown = false;
  let restartInFlight = false;

  function hideGameOverScreen() {
    const goScreen = document.getElementById('gameover-screen');
    goScreen?.classList.remove(
      'active',
      'gameover-victory',
      'gameover-defeat',
      'gameover-economy',
      'gameover-conquest'
    );
    document.getElementById('gameover-confetti')?.replaceChildren();
  }

  /**
   * The result screen follows the game state, whichever way the state changed: it comes up
   * once when a run ends, and comes down whenever a run is in progress again (restart
   * button, loaded save, a start made from anywhere else).
   */
  function syncGameOverScreen(gs) {
    const ended = gs.state === 'victory' || gs.state === 'defeat';
    if (ended) {
      if (gameOverShown || restartInFlight) return;
      gameOverShown = true;
      if (typeof UX !== 'undefined' && UX.renderVictoryScreen) UX.renderVictoryScreen(gs);
      else {
        const title = document.getElementById('result-title');
        title.textContent = gs.state === 'victory' ? 'VICTORY!' : 'DEFEAT';
        title.className = gs.state;
        document.getElementById('gameover-screen')?.classList.add('active');
      }
      if (typeof CrownLegacies !== 'undefined') refreshCrownLegaciesPanel();
      if (typeof EternalLegacyTree !== 'undefined') refreshEternalLegacyPanel();
      return;
    }
    if (gs.state !== 'playing') return;
    if (gameOverShown && !restartInFlight) gameOverShown = false;
    if (document.getElementById('gameover-screen')?.classList.contains('active')) {
      hideGameOverScreen();
    }
  }
  let defenseStartInFlight = false;
  let selectedDifficulty = 'normal';
  const hudEls = {};
  const hudBtns = {
    deploy: [],
    ability: [],
    build: [],
    spy: [],
    courier: [],
    doctrine: [],
    counterDoctrine: [],
    loadout: [],
    formation: [],
  };

  function updateDifficultyUI(id) {
    selectedDifficulty = id;
    const def = getDifficultyDef(id);
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.diff === id);
    });
    const tagline = document.getElementById('diff-tagline');
    if (tagline && def) tagline.textContent = def.tagline;
    Game.setDifficulty(id);
    refreshSetupSummary();
    if (typeof AdvancedDifficulty !== 'undefined') {
      const pct = AdvancedDifficulty.getDifficultyPercent(id);
      const advPct = document.getElementById('advanced-diff-pct');
      if (advPct) advPct.textContent = `Effective: ${pct}%`;
      if (typeof GameModes !== 'undefined') GameModes.renderScalingPanel(id);
    }
  }

  let lastHudEarly = null;

  /**
   * Side-panel tabs. One pane of a panel is shown at a time; the others carry `hidden`.
   * Left/Right arrows move between tabs, Home/End jump to the first and last.
   */
  function initSidePanelTabs() {
    document.querySelectorAll('.side-panel').forEach((panel) => {
      const tabEls = [...panel.querySelectorAll('.side-tab[data-side-tab]')];
      const panes = [...panel.querySelectorAll('.side-tab-pane[data-side-pane]')];
      const scroller = panel.querySelector('.side-panel-scroll');
      if (!tabEls.length || !panes.length) return;
      const ids = tabEls.map((t) => t.dataset.sideTab);
      const tabs = PanelModel.createTabs(ids, ids[0]);

      function render() {
        const shown = tabs.panes();
        tabEls.forEach((tab) => {
          const on = !!shown[tab.dataset.sideTab];
          tab.classList.toggle('active', on);
          tab.setAttribute('aria-selected', on ? 'true' : 'false');
          tab.tabIndex = on ? 0 : -1;
        });
        panes.forEach((pane) => {
          const on = !!shown[pane.dataset.sidePane];
          pane.hidden = !on;
          pane.classList.toggle('active', on);
        });
      }

      function showTab(id, opts = {}) {
        const changed = tabs.select(id);
        render();
        if (changed && scroller) scroller.scrollTop = 0;
        if (opts.focus) tabEls.find((t) => t.dataset.sideTab === tabs.active)?.focus();
        return changed;
      }

      tabEls.forEach((tab) => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (showTab(tab.dataset.sideTab) && typeof AudioEngine !== 'undefined') {
            AudioEngine.SFX?.click?.();
          }
        });
        tab.addEventListener('keydown', (e) => {
          let to = null;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = tabs.step(1);
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = tabs.step(-1);
          else if (e.key === 'Home') to = ids[0];
          else if (e.key === 'End') to = ids[ids.length - 1];
          if (!to) return;
          e.preventDefault();
          e.stopPropagation();
          showTab(to, { focus: true });
        });
      });

      render();
      panel._showTab = showTab;
      panel._activeTab = () => tabs.active;

      // Remember when the player is scrolling, so nothing scrolls the panel under them.
      if (scroller) {
        const touched = () => {
          panel._userScrollAt = performance.now();
        };
        scroller.addEventListener('wheel', touched, { passive: true });
        scroller.addEventListener('touchstart', touched, { passive: true });
        scroller.addEventListener('touchmove', touched, { passive: true });
        const hold = () => {
          panel._scrollHeld = true;
          touched();
        };
        const release = () => {
          if (panel._scrollHeld) touched();
          panel._scrollHeld = false;
        };
        scroller.addEventListener('pointerdown', hold);
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        scroller.addEventListener('scroll', () => {
          if (panel._scrollHeld) touched();
        });
      }
    });
  }

  // ---- open list and "Locked" group of each pane ------------------------------------------
  /** Every panel button the model places: { btn, kind, id, marker, reasonEl, at, want }. */
  const panelItems = [];
  /** tab id -> { root, toggle, list, title, next, sig } */
  const lockedGroups = {};
  const LOCKED_TABS = ['troops', 'build', 'strike', 'cmd', 'spy', 'courier'];
  /** Sections whose heading goes when every button under it is in a Locked group. */
  const managedSections = new Set();

  function makeLockedGroup(tab) {
    const pane = document.getElementById(`pane-${tab}`);
    if (!pane) return;
    const root = document.createElement('div');
    root.className = 'locked-group';
    root.hidden = true;
    root.innerHTML =
      `<button type="button" class="locked-toggle" aria-expanded="false" aria-controls="locked-${tab}">` +
      '<span class="locked-caret" aria-hidden="true">+</span>' +
      '<span class="locked-title">Locked</span>' +
      '<span class="locked-next"></span></button>' +
      `<div class="locked-list" id="locked-${tab}" hidden></div>`;
    pane.appendChild(root);
    const group = {
      root,
      toggle: root.querySelector('.locked-toggle'),
      list: root.querySelector('.locked-list'),
      title: root.querySelector('.locked-title'),
      next: root.querySelector('.locked-next'),
      caret: root.querySelector('.locked-caret'),
      sig: '',
    };
    group.toggle.addEventListener('click', () => {
      const open = group.list.hidden;
      group.list.hidden = !open;
      group.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      group.caret.textContent = open ? '−' : '+';
      if (typeof AudioEngine !== 'undefined') AudioEngine.SFX?.click?.();
    });
    lockedGroups[tab] = group;
  }

  function indexPanelItems() {
    const add = (selector, kind, attr) => {
      document.querySelectorAll(selector).forEach((btn) => {
        const id = btn.dataset[attr];
        if (!id || btn._item) return;
        const marker = document.createComment(`${kind}:${id}`);
        btn.before(marker);
        const reasonEl = document.createElement('span');
        reasonEl.className = 'lock-reason';
        btn.appendChild(reasonEl);
        const item = {
          btn,
          kind,
          id,
          marker,
          reasonEl,
          section: btn.closest('.pane-section'),
          name: btn.querySelector('span:not(.cost)')?.textContent?.trim() || id,
          at: null,
          want: null,
        };
        if (item.section?.dataset.section) managedSections.add(item.section);
        btn._item = item;
        panelItems.push(item);
      });
    };
    add('#left-panel .deploy-btn', 'deploy', 'unit');
    add('#left-panel .build-btn', 'build', 'build');
    add('#left-panel .ability-btn', 'ability', 'ability');
    add('#left-panel .doctrine-btn', 'doctrine', 'doctrine');
    add('#left-panel .counter-doctrine-btn', 'counterDoctrine', 'counterDoctrine');
    add('#right-panel .spy-btn', 'spy', 'spy');
    add('#right-panel .courier-btn', 'courier', 'courier');
    LOCKED_TABS.forEach(makeLockedGroup);
  }

  /** Note where a button belongs after its availability was worked out. */
  function notePlace(btn, avail) {
    const item = btn._item;
    if (!item) return;
    const reason = avail.ok ? '' : avail.reason || '';
    if (item.reasonEl.textContent !== reason) item.reasonEl.textContent = reason;
    // A button the game keeps out of sight (a secret troop, a section not yet open) stays put.
    const outOfSight =
      btn.style.display === 'none' || (item.section && item.section.style.display === 'none');
    const at = PanelModel.place(item.kind, item.id, avail);
    item.want = at.locked && !outOfSight ? at.tab : null;
  }

  /** Move buttons between their own place and the Locked group of a pane. */
  function syncLockedGroups() {
    const byTab = {};
    for (const item of panelItems) {
      if (item.want) (byTab[item.want] = byTab[item.want] || []).push(item);
      if (item.at && item.at !== item.want && !item.want) {
        item.marker.after(item.btn);
        item.btn.classList.remove('in-locked');
        item.at = null;
      }
    }
    for (const tab of LOCKED_TABS) {
      const group = lockedGroups[tab];
      if (!group) continue;
      const rows = byTab[tab] || [];
      const sig = rows.map((it) => `${it.kind}:${it.id}`).join(',');
      if (sig !== group.sig) {
        group.sig = sig;
        for (const it of rows) {
          group.list.appendChild(it.btn);
          it.btn.classList.add('in-locked');
          it.at = tab;
        }
        group.root.hidden = rows.length === 0;
        group.title.textContent = PanelModel.lockedLabel(rows.length);
      }
      const first = rows[0];
      const next = first ? `Next: ${first.name}, ${first.reasonEl.textContent}` : '';
      if (group.next.textContent !== next) group.next.textContent = next;
    }
    // A heading with nothing left under it is not shown.
    for (const sec of managedSections) {
      const any = [...sec.children].some(
        (n) => n.tagName === 'BUTTON' && n.style.display !== 'none' && !n.hidden
      );
      if (sec.hidden === any) sec.hidden = !any;
    }
  }

  /** Largest price on offer: what a full TP bar stands for (set by updateButtonStates). */
  let tpBarMax = 24;
  let lastTpSeen = null;

  /** The key bound to a spell or building while nothing is selected, or null. */
  function keyFor(action, id) {
    return typeof Hotkeys !== 'undefined' ? Hotkeys.keyFor('night', action, id) : null;
  }

  function shortKey(key) {
    return key ? Hotkeys.keyLabel(key).replace('Shift+', '⇧') : '';
  }

  /**
   * One button's state: dimmed when it cannot be used (the reason is its tooltip), marked
   * when it is the thing selected, and showing its key.
   */
  function markButton(btn, avail, selected, key) {
    btn.classList.toggle('selected', !!selected);
    btn.classList.toggle('disabled', !avail.ok && !selected);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.setAttribute('aria-disabled', !avail.ok && !selected ? 'true' : 'false');
    btn.dataset.reason = avail.ok ? '' : avail.reason || '';
    // Too dear is said in words on the price ("need 5 TP"), not by dimming alone.
    btn.classList.toggle('cant-afford', !avail.ok && !!avail.tp && !selected);
    notePlace(btn, avail);
    const label = shortKey(key);
    let k = btn._keyEl;
    if (!k && label) {
      k = document.createElement('kbd');
      k.className = 'hk';
      k.setAttribute('aria-hidden', 'true');
      btn.appendChild(k);
      btn._keyEl = k;
    }
    if (k) {
      if (k.textContent !== label) k.textContent = label;
      k.hidden = !label;
    }
  }

  /**
   * The spoken name of a panel button: what it is, then its price or why it cannot be used.
   * The rich hover tooltip carries the same text, so no `title` is set (it used to show a
   * second, browser-drawn tooltip on top of ours).
   */
  function setLabel(btn, text) {
    if (btn.getAttribute('aria-label') !== text) btn.setAttribute('aria-label', text);
    if (btn.title) btn.removeAttribute('title');
  }

  const USER_SCROLL_QUIET_MS = 1500;

  /** The player is scrolling this panel (wheel, scroll-bar drag, touch) or just was. */
  function userIsScrolling(panel) {
    if (!panel) return false;
    if (panel._scrollHeld) return true;
    return performance.now() - (panel._userScrollAt || -1e9) < USER_SCROLL_QUIET_MS;
  }

  /**
   * Bring a panel button into view. Only ever called when the selection was changed from
   * the keyboard, and never while the player is scrolling that panel: the panel used to be
   * dragged back to the selection on every HUD refresh.
   */
  function revealPanelControl(el) {
    if (!el) return false;
    const panel = el.closest?.('.side-panel');
    const scroller = el.closest?.('.side-panel-scroll');
    if (!panel || !scroller) return false;
    // The button may be on a tab that is not open: open it.
    const pane = el.closest('.side-tab-pane');
    const switched = !!(pane && pane.hidden && panel._showTab?.(pane.dataset.sidePane));
    if (userIsScrolling(panel) && !switched) return false;
    const box = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top >= box.top + 2 && r.bottom <= box.bottom - 2) return false;
    const top = scroller.scrollTop + (r.top - box.top) - Math.max(8, (box.height - r.height) / 2);
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    return true;
  }

  /** The panel button for a troop, building, spell, spy action or message. */
  function controlFor(kind, id) {
    const sel = {
      deploy: `.deploy-btn[data-unit="${id}"]`,
      build: `.build-btn[data-build="${id}"]`,
      ability: `.ability-btn[data-ability="${id}"]`,
      spy: `.spy-btn[data-spy="${id}"]`,
      courier: `.courier-btn[data-courier="${id}"]`,
    }[kind];
    return sel ? document.querySelector(sel) : null;
  }

  /** A refused click or key: the button (and its price) flashes; the reason is on screen. */
  function flashRefused(kind, id) {
    const btn = controlFor(kind, id);
    if (!btn) return;
    btn.classList.remove('refused');
    void btn.offsetWidth;
    btn.classList.add('refused');
    clearTimeout(btn._refusedTimer);
    btn._refusedTimer = setTimeout(() => btn.classList.remove('refused'), 700);
  }

  /** Click or key on a panel item: selected if it can be, otherwise refused with its reason. */
  function selectItem(kind, id) {
    const res = Availability.trySelect(kind, id);
    updateHUD(true);
    if (!res.ok) flashRefused(kind, id);
    return res;
  }

  /** The panel button of whatever is armed, or null. */
  function selectedControl(gs) {
    if (gs.selectedDeploy) {
      return document.querySelector(`.deploy-btn[data-unit="${gs.selectedDeploy}"]`);
    }
    if (gs.selectedBuild) {
      return document.querySelector(`.build-btn[data-build="${gs.selectedBuild}"]`);
    }
    if (gs.selectedAbility) {
      return document.querySelector(`.ability-btn[data-ability="${gs.selectedAbility}"]`);
    }
    return null;
  }

  /** Called by the hotkey handler after a key changed the selection. */
  function revealSelection() {
    return revealPanelControl(selectedControl(Game.getState()));
  }

  // ---- the key sheet ("?") ----------------------------------------------------------------
  function isKeySheetOpen() {
    return !!document.getElementById('key-sheet');
  }

  function closeKeySheet() {
    document.getElementById('key-sheet')?.remove();
  }

  /** Lists only the keys that do something on this screen, right now. */
  function toggleKeySheet(state) {
    if (isKeySheetOpen()) {
      closeKeySheet();
      return;
    }
    const gs = Game.getState();
    const usable = (kind, id) => {
      const r = Availability.check(kind, id, gs);
      return r.ok || !r.locked;
    };
    const rows = Hotkeys.sheet(state, (b) => {
      if (b.action === 'deploySlot') {
        const type = Hotkeys.deployTypeAt(b.arg);
        return type && usable('deploy', type)
          ? `Recruit ${Availability.nameOf('deploy', type)}`
          : null;
      }
      if (b.action === 'ability') return usable('ability', b.arg) ? `Cast ${b.label}` : null;
      if (b.action === 'build') return usable('build', b.arg) ? `Build ${b.label}` : null;
      if (b.action === 'beginDay') return gs.timeOfDay === 'night' ? 'Begin the day' : null;
      if (b.action === 'order') return gs.hasGeneral ? b.label : null;
      if (b.action === 'loadout') {
        return gs.kingdomLoadoutsUnlocked || gs.wave >= 100 ? b.label : null;
      }
      if (b.action === 'reform') return (gs.selectedUnitIds?.length || 0) >= 2 ? b.label : null;
      if (b.action === 'perf') return b.label;
      return b.label;
    });
    const placing = ['night', 'day', 'placement', 'placement_wall', 'creative'].includes(state);
    if (placing) {
      rows.push({
        keys: 'Shift+click',
        label: 'Place one and keep placing the same troop or building',
      });
      rows.push({ keys: 'Right-click', label: 'Cancel / deselect' });
    }
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const root = document.createElement('div');
    root.id = 'key-sheet';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Keys');
    root.innerHTML =
      '<div class="key-sheet-box"><div class="key-sheet-title">Keys</div>' +
      `<div class="key-sheet-state">${esc(Hotkeys.STATE_LABELS[state] || state)}</div>` +
      '<div class="key-sheet-rows">' +
      rows
        .map(
          (r) =>
            `<div class="key-sheet-row"><kbd>${esc(r.keys)}</kbd><span>${esc(r.label)}</span></div>`
        )
        .join('') +
      '</div><div class="key-sheet-foot">Press ? or Esc to close. The list changes with what you are doing.</div></div>';
    root.addEventListener('click', closeKeySheet);
    document.body.appendChild(root);
  }

  // ---- the price tag that follows the cursor while a troop or building is armed --------
  let cursorTag = null;
  let cursorTagText = '';
  const cursorPos = { x: -1, y: -1, shift: false };

  function setCursorState(x, y, shift) {
    cursorPos.x = x;
    cursorPos.y = y;
    cursorPos.shift = !!shift;
    updateCursorTag(Game.getState());
  }

  function updateCursorTag(gs) {
    const armed = Game.isPlaying?.() && !gs.paused ? Availability.armed(gs) : null;
    const show = armed && armed.kind !== 'ability' && cursorPos.x >= 0;
    if (!show) {
      if (cursorTag && !cursorTag.hidden) cursorTag.hidden = true;
      return;
    }
    if (!cursorTag) {
      cursorTag = document.createElement('div');
      cursorTag.id = 'placement-tag';
      cursorTag.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cursorTag);
    }
    const cost =
      armed.kind === 'deploy'
        ? Availability.deployCost(armed.id, gs)
        : Availability.buildCost(armed.id, gs);
    const single = armed.id === 'general' || armed.id === 'doomslayer_hero';
    const text = single
      ? `${Availability.nameOf(armed.kind, armed.id)} · ${cost} TP`
      : cursorPos.shift
        ? `${Availability.nameOf(armed.kind, armed.id)} · next ${cost} TP · placing more`
        : `${Availability.nameOf(armed.kind, armed.id)} · ${cost} TP · hold Shift to place more`;
    if (text !== cursorTagText) {
      cursorTagText = text;
      cursorTag.textContent = text;
    }
    cursorTag.hidden = false;
    cursorTag.style.transform = `translate(${Math.round(cursorPos.x + 16)}px, ${Math.round(cursorPos.y + 18)}px)`;
  }

  // ---- main-menu sheets (New siege, Records, How to play) ---------------------------------
  let openSheetEl = null;
  let sheetOpener = null;

  function closeMenuSheets() {
    document.querySelectorAll('.menu-sheet').forEach((sh) => {
      sh.hidden = true;
    });
    document.getElementById('howto-panel')?.classList.add('hidden');
    if (openSheetEl) {
      openSheetEl = null;
      try {
        sheetOpener?.focus?.();
      } catch (_) {
        /* the opener may be gone */
      }
      sheetOpener = null;
    }
    refreshSetupSummary();
  }

  function openMenuSheet(id, opener) {
    const sheet = document.getElementById(id);
    if (!sheet) return;
    closeMenuSheets();
    sheet.hidden = false;
    openSheetEl = sheet;
    sheetOpener = opener || document.activeElement;
    if (id === 'menu-howto-sheet')
      document.getElementById('howto-panel')?.classList.remove('hidden');
    (sheet.querySelector('.modal-close') || sheet).focus?.();
  }

  /** "Normal · Campaign": what BEGIN DEFENSE will start. */
  function refreshSetupSummary() {
    const el = document.getElementById('menu-setup-summary');
    if (!el) return;
    const diff = getDifficultyDef(selectedDifficulty);
    const parts = [diff?.label || diff?.name || selectedDifficulty];
    if (typeof GameModes !== 'undefined') {
      const m = GameModes.getMenu();
      if (m.challengeType) {
        parts.push(m.challengeType === 'weekly' ? 'Weekly challenge' : 'Daily challenge');
      } else {
        parts.push(GameModes.MODES.find((x) => x.id === m.modeId)?.label || m.modeId);
      }
      if (m.ironman) parts.push('Ironman');
    }
    const text = parts.filter(Boolean).join(' · ');
    if (el.textContent !== text) el.textContent = text;
  }

  function bindMenuSheets() {
    const openers = {
      'menu-setup-btn': 'menu-setup-sheet',
      'menu-records-btn': 'menu-records-sheet',
      'howto-btn': 'menu-howto-sheet',
    };
    for (const [btnId, sheetId] of Object.entries(openers)) {
      document.getElementById(btnId)?.addEventListener('click', (e) => {
        AudioEngine?.SFX?.click?.();
        openMenuSheet(sheetId, e.currentTarget);
      });
    }
    document.querySelectorAll('.menu-sheet').forEach((sheet) => {
      sheet.addEventListener('click', (e) => {
        // The backdrop and any Close / Done button put the sheet away.
        if (e.target === sheet || e.target.closest?.('[data-sheet-close]')) closeMenuSheets();
        else if (sheet.id === 'menu-setup-sheet') setTimeout(refreshSetupSummary, 0);
      });
      sheet.addEventListener('change', () => setTimeout(refreshSetupSummary, 0));
    });
    document.getElementById('menu-setup-start')?.addEventListener('click', () => {
      closeMenuSheets();
      document.getElementById('start-btn')?.click();
    });
    // Escape closes the open sheet and goes no further.
    document.addEventListener(
      'keydown',
      (e) => {
        if (!openSheetEl || e.key !== 'Escape') return;
        // A screen opened from the sheet (Advanced Difficulty, Cheats) is on top: it goes first.
        if (document.querySelector('.screen.active:not(#menu-screen)')) return;
        e.preventDefault();
        e.stopPropagation();
        closeMenuSheets();
      },
      true
    );
    refreshSetupSummary();
  }

  // ---- the sound button -------------------------------------------------------------------
  /** Other modules write a speaker glyph into the button; the look and the name follow it. */
  function syncSoundButton() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    const muted = btn.textContent.includes('🔇');
    btn.classList.toggle('is-muted', muted);
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', muted ? 'Sound is off. Turn sound on' : 'Sound is on. Mute');
  }

  function watchSoundButton() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    syncSoundButton();
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(syncSoundButton).observe(btn, { childList: true, characterData: true });
    }
  }

  function init() {
    document.body.classList.add('ui-v2');
    initSidePanelTabs();
    MetaProgress.load();
    if (typeof Achievements !== 'undefined') Achievements.init();
    if (typeof Encyclopedia !== 'undefined') Encyclopedia.init();
    if (typeof Cheats !== 'undefined') Cheats.init();
    if (typeof AdvancedDifficulty !== 'undefined') AdvancedDifficulty.init();
    if (typeof Research !== 'undefined') Research.init();
    if (typeof GameModes !== 'undefined') GameModes.init();
    if (typeof Onboarding !== 'undefined') Onboarding.init();
    if (typeof WweAcademy !== 'undefined') WweAcademy.init();
    if (typeof CrossoverHub !== 'undefined') CrossoverHub.init();
    if (typeof CreativeMode !== 'undefined') CreativeMode.init();
    if (typeof Tooltips !== 'undefined') Tooltips.init();
    if (typeof FactionIntel !== 'undefined') FactionIntel.init();
    // Grand Strategy / Intergalactic removed — pure wave defense.

    const titleCanvas = document.getElementById('title-art');
    function paintTitleArt() {
      if (!titleCanvas) return;
      const menu = document.getElementById('menu-screen');
      if (menu?.classList.contains('active')) {
        if (typeof VisualPolish !== 'undefined') VisualPolish.update();
        const tctx = titleCanvas.getContext('2d');
        if (typeof VisualPolish !== 'undefined')
          VisualPolish.drawTitleArt(tctx, titleCanvas.width, titleCanvas.height);
        else SpriteGen.drawTitleArt(tctx, titleCanvas.width, titleCanvas.height);
      }
      requestAnimationFrame(paintTitleArt);
    }
    paintTitleArt();

    function syncMenuMusic() {
      if (typeof AudioEngine === 'undefined') return;
      const menuActive = document.getElementById('menu-screen')?.classList.contains('active');
      const playing = Game.isPlaying?.();
      if (menuActive && !playing) {
        AudioEngine.resume().then((ok) => {
          if (ok && !AudioEngine.isMuted?.()) AudioEngine.startMenuMusic?.();
        });
      } else if (playing) {
        /* battle music handled by Game.start */
      }
    }
    syncMenuMusic();
    // First gesture unlocks Web Audio (browsers block autoplay) and starts menu theme.
    document.addEventListener('pointerdown', () => syncMenuMusic(), { once: false, passive: true });
    document.addEventListener('keydown', () => syncMenuMusic(), { once: false });

    const menuQuitBtn = document.getElementById('menu-quit-btn');
    // Only the desktop shell can quit; in a browser tab the button stays hidden.
    if (menuQuitBtn && window.electronAPI?.quitApp) menuQuitBtn.hidden = false;
    menuQuitBtn?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      if (window.electronAPI?.quitApp) window.electronAPI.quitApp();
      else window.close();
    });

    refreshPanelIcons();
    cacheHudDom();

    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        AudioEngine.SFX.click();
        updateDifficultyUI(btn.dataset.diff);
      });
      btn.addEventListener(
        'pointerenter',
        () => {
          if (!AudioEngine.isMuted?.()) AudioEngine.SFX.uiHover?.();
        },
        { passive: true }
      );
    });
    // Soft hover tick on main HUD action buttons (throttled by engine volume / mute).
    document
      .querySelectorAll('.deploy-btn, .build-btn, .ability-btn, .menu-btn, .start-btn')
      .forEach((btn) => {
        let last = 0;
        btn.addEventListener(
          'pointerenter',
          () => {
            const now = performance.now();
            if (now - last < 80) return;
            last = now;
            if (!AudioEngine.isMuted?.()) AudioEngine.SFX.uiHover?.();
          },
          { passive: true }
        );
      });
    updateDifficultyUI(selectedDifficulty);
    refreshCrownLegaciesPanel();
    refreshEternalLegacyPanel();

    document.getElementById('eternal-legacy-tree')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.eternal-legacy-node-btn');
      if (!btn || typeof EternalLegacyTree === 'undefined') return;
      const result = EternalLegacyTree.investNode(btn.dataset.node);
      if (result.ok) AudioEngine.SFX.click?.();
      refreshEternalLegacyPanel();
      refreshCrownLegaciesPanel();
    });

    document.getElementById('crown-legacies-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.crown-legacy-btn');
      if (!btn || btn.classList.contains('locked') || typeof CrownLegacies === 'undefined') return;
      const result = CrownLegacies.toggleLegacy(btn.dataset.legacy);
      if (!result.ok && result.reason === 'full') {
        AudioEngine.SFX.click?.();
      }
      refreshCrownLegaciesPanel();
    });

    document.getElementById('crown-heirs-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.crown-heir-btn');
      if (!btn || typeof CrownLegacies === 'undefined') return;
      CrownLegacies.toggleHeir(btn.dataset.heir);
      refreshCrownLegaciesPanel();
    });

    function beginDefense() {
      if (defenseStartInFlight) return;
      defenseStartInFlight = true;
      gameOverShown = false;
      if (typeof Onboarding !== 'undefined') Onboarding.prepareCampaignStart();
      Game.setDifficulty(selectedDifficulty);
      hideMenusForPlay({ showLaunch: true });
      AudioEngine.SFX.uiConfirm?.();
      AudioEngine.stopMusic();
      deferAfterPaint(() => {
        try {
          Game.start();
        } catch (err) {
          console.error('Game.start failed', err);
          setLaunchOverlayVisible(false);
          if (Game.isPlaying?.()) {
            ensureMenuDismissedForPlay();
            Game.showMessage?.(
              `Run started with errors — ${err?.message || 'unknown error'}. Press F10 to report if gameplay is wrong.`,
              480
            );
          } else {
            showMainMenu();
            Game.showMessage?.(
              `Could not start — ${err?.message || 'unknown error'}. Check the console for details.`,
              420
            );
            AudioEngine.resume().then((ok) => {
              if (ok && !AudioEngine.isMuted?.()) AudioEngine.startMenuMusic?.();
            });
          }
          defenseStartInFlight = false;
          return;
        }
        setLaunchOverlayVisible(false);
        ensureMenuDismissedForPlay();
        updateHUD(true);
        Game.draw?.();
        AudioEngine.SFX.click();
        AudioEngine.resume().then((ok) => {
          if (ok) {
            AudioEngine.SFX.unlockChime?.();
            if (!AudioEngine.isMuted?.()) AudioEngine.startMusic();
          }
        });
        defenseStartInFlight = false;
      });
    }

    document.getElementById('start-btn').addEventListener('click', beginDefense);

    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioEngine.resume();
        const muted = AudioEngine.toggleMute();
        soundBtn.textContent = muted ? '🔇' : '🔊';
        syncSoundButton();
        if (typeof Settings !== 'undefined') Settings.set('muted', muted);
        if (!muted) {
          AudioEngine.SFX.click();
          if (typeof Game !== 'undefined' && Game.isPlaying()) AudioEngine.startMusic();
          else syncMenuMusic();
        }
      });
    }

    bindMenuSheets();
    watchSoundButton();

    document.getElementById('begin-day-btn')?.addEventListener('click', () => {
      AudioEngine.SFX.click();
      Game.beginDayPhase(true);
      UI.updateHUD(true);
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      // The run is still 'defeat' until the deferred Game.start() below has run. Until
      // then the result screen must stay down, and a second click must not start twice.
      if (restartInFlight) return;
      restartInFlight = true;
      hideGameOverScreen();
      hideMenusForPlay();
      const mode = typeof GameModes !== 'undefined' ? GameModes.getMenu() : null;
      if (mode?.challengeType) {
        /* beginSession applies challenge difficulty */
      } else {
        Game.setDifficulty(selectedDifficulty);
      }
      deferAfterPaint(() => {
        try {
          Game.start();
        } catch (err) {
          console.error('Game.start failed on restart', err);
          restartInFlight = false;
          gameOverShown = false;
          setLaunchOverlayVisible(false);
          showMainMenu();
          return;
        }
        restartInFlight = false;
        gameOverShown = false;
        setLaunchOverlayVisible(false);
        updateHUD(true);
        Game.draw?.();
      });
    });

    document.getElementById('gameover-menu-btn')?.addEventListener('click', () => {
      if (restartInFlight) return;
      AudioEngine.SFX.click?.();
      hideGameOverScreen();
      Game.quitToMenu?.();
    });

    // Every panel button goes through Availability.trySelect: an item that cannot be used
    // is refused with its reason and is never selected.
    document.getElementById('left-panel')?.addEventListener('click', (e) => {
      const deploy = e.target.closest('.deploy-btn');
      if (deploy?.dataset.unit) {
        selectItem('deploy', deploy.dataset.unit);
        return;
      }
      const build = e.target.closest('.build-btn');
      if (build?.dataset.build) {
        selectItem('build', build.dataset.build);
      }
    });

    document.querySelectorAll('.ability-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectItem('ability', btn.dataset.ability);
      });
    });

    document.querySelectorAll('.spy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectItem('spy', btn.dataset.spy);
      });
    });

    document.querySelectorAll('.courier-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectItem('courier', btn.dataset.courier);
      });
    });

    document.querySelectorAll('.loadout-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.setLoadout?.(btn.dataset.loadout);
        updateHUD(true);
      });
    });

    document.querySelectorAll('.doctrine-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.executeDoctrine?.(btn.dataset.doctrine);
        updateHUD(true);
      });
    });

    document.querySelectorAll('.counter-doctrine-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.executeCounterDoctrine?.(btn.dataset.counterDoctrine);
        updateHUD(true);
      });
    });

    document.getElementById('expedition-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.expedition-btn');
      if (
        !btn ||
        btn.classList.contains('disabled') ||
        btn.classList.contains('expedition-dispatched')
      )
        return;
      Game.dispatchExpedition?.(btn.dataset.faction);
      updateHUD(true);
    });

    document.getElementById('planet-event-choices')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.planet-event-btn');
      if (!btn || btn.classList.contains('planet-event-chosen')) return;
      const choiceId = btn.dataset.mapChoice;
      if (!choiceId) return;
      // Always attempt respond — Game shows why it failed (day / TP / none pending).
      // Soft-lock styles must not swallow clicks with a silent return.
      const ok = Game.respondMapEvent?.(choiceId);
      if (ok) AudioEngine.SFX?.click?.();
      updateHUD(true);
    });

    document.getElementById('raid-mission-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.raid-mission-btn');
      if (!btn || btn.classList.contains('disabled') || btn.classList.contains('raid-dispatched'))
        return;
      Game.dispatchRaidStrike?.(btn.dataset.raid);
      updateHUD(true);
    });

    document.getElementById('hunt-toggle').addEventListener('click', () => {
      Game.orderHunt();
      updateHUD(true);
    });
    document.getElementById('hold-here')?.addEventListener('click', () => {
      Game.orderHoldHere();
      updateHUD(true);
    });

    document.getElementById('clear-selection-btn')?.addEventListener('click', () => {
      Game.clearSelection();
      AudioEngine.SFX.click();
      updateHUD(true);
    });

    document.querySelectorAll('.formation-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fid = btn.dataset.formation;
        if (!fid || !Game.setSelectionFormation?.(fid, { announce: true })) return;
        AudioEngine.SFX.click();
        const gs = Game.getState();
        const n = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
        if (n >= 2) Game.reformSelectionFormation?.(fid);
        updateHUD(true);
      });
    });
    document.getElementById('formation-reform-btn')?.addEventListener('click', () => {
      Game.reformSelectionFormation?.();
      AudioEngine.SFX.click();
      updateHUD(true);
    });

    document.getElementById('builder-repair-toggle')?.addEventListener('click', () => {
      Game.toggleBuilderAutoRepair?.();
      updateHUD();
    });

    document.getElementById('speed-toggle')?.addEventListener('click', () => {
      Game.cycleGameSpeed?.();
      updateHUD();
    });

    document.getElementById('demolish-btn')?.addEventListener('click', () => {
      Game.selectDemolish();
      updateHUD();
    });

    document.getElementById('move-building-btn')?.addEventListener('click', () => {
      Game.selectMoveBuilding();
      updateHUD();
    });

    document.getElementById('rotate-wall-btn')?.addEventListener('click', () => {
      Game.selectRotateWall();
      updateHUD();
    });

    const savedSpeed = typeof Settings !== 'undefined' ? Settings.get('gameSpeed') : 1;
    updateSpeedControl(savedSpeed ?? 1);
  }

  function refreshPanelIcons() {
    if (typeof SpriteGen === 'undefined') return;
    document.querySelectorAll('.btn-icon').forEach((icon) => {
      const ictx = icon.getContext('2d');
      if (!ictx) return;
      const w = icon.width || 28;
      const h = icon.height || 28;
      const sprite = icon.dataset.sprite;
      const ability = icon.dataset.abilityIcon;
      if (ability && SpriteGen.drawAbilityIcon) SpriteGen.drawAbilityIcon(ictx, ability);
      else if (sprite && SpriteGen.UNIT_STYLE[sprite]) SpriteGen.drawIcon(ictx, sprite, w, h);
    });
  }

  function refreshCrownLegaciesPanel() {
    const section = document.getElementById('crown-legacies-section');
    const summary = document.getElementById('crown-legacies-summary');
    const list = document.getElementById('crown-legacies-list');
    const heirsBlock = document.getElementById('crown-heirs-block');
    const heirsList = document.getElementById('crown-heirs-list');
    if (!section || !summary || !list || typeof CrownLegacies === 'undefined') return;

    const snap = CrownLegacies.getMenuSnapshot();
    summary.textContent = snap.summary;

    list.innerHTML = snap.passives
      .map((p) => {
        let cls = 'crown-legacy-btn';
        if (!p.unlocked) cls += ' locked';
        else if (p.active) cls += ' active';
        else cls += ' unlocked';
        const status = !p.unlocked ? 'LOCKED' : p.active ? 'EQUIPPED' : 'EQUIP';
        const hint = p.unlocked ? p.desc : p.hint;
        return (
          `<button type="button" class="${cls}" data-legacy="${p.id}"${p.unlocked ? '' : ' disabled'}` +
          ` title="${hint}">` +
          `<span>${p.name}${p.isNew ? ' ★' : ''}</span><span class="crown-legacy-status">${status}</span>` +
          `<span class="crown-legacy-hint">${hint}</span></button>`
        );
      })
      .join('');

    if (heirsBlock && heirsList) {
      const showHeirs = snap.heirs.length > 0;
      heirsBlock.style.display = showHeirs ? '' : 'none';
      if (showHeirs) {
        heirsList.innerHTML = snap.heirs
          .map((h) => {
            const cls = `crown-heir-btn${h.active ? ' active' : ''}`;
            const status = h.active ? 'HEIR' : 'SELECT';
            const typeLabel =
              typeof formatUnitTypeName === 'function' ? formatUnitTypeName(h.type) : h.type;
            return (
              `<button type="button" class="${cls}" data-heir="${h.key}" title="${h.name} — ${typeLabel}">` +
              `<span>${h.name}</span><span class="crown-heir-status">${status}</span>` +
              `<span class="crown-heir-wave">${typeLabel} · crowned W${h.wave}</span></button>`
            );
          })
          .join('');
      }
    }

    CrownLegacies.markUnlocksSeen();
  }

  function refreshEternalLegacyPanel() {
    const section = document.getElementById('eternal-legacy-section');
    const summary = document.getElementById('eternal-legacy-summary');
    const branchesEl = document.getElementById('eternal-legacy-branches');
    const treeEl = document.getElementById('eternal-legacy-tree');
    if (!section || !summary || !treeEl || typeof EternalLegacyTree === 'undefined') return;

    const snap = EternalLegacyTree.getMenuSnapshot();
    const foundationNote =
      snap.foundationPaths?.length > 0
        ? ` · ${snap.foundationPaths.map((p) => p.label).join(', ')} crystallized`
        : '';
    summary.textContent = `${snap.summary}${foundationNote} · ${snap.available}/${snap.shards} Echo Shards`;

    if (branchesEl) {
      const foundationChips =
        snap.foundationPaths?.length > 0
          ? snap.foundationPaths
              .map(
                (p) =>
                  `<span class="eternal-branch-chip foundation-chip" style="border-color:${p.color}" title="Crystallized at wave 150">` +
                  `${p.label} ×${p.count}</span>`
              )
              .join('')
          : '';
      branchesEl.innerHTML =
        foundationChips +
        snap.branches
          .filter((b) => b.id !== 'crown_trunk' || b.investedCount > 0)
          .map(
            (b) =>
              `<span class="eternal-branch-chip" style="border-color:${b.color}" title="${b.desc}">` +
              `${b.label} ${b.investedCount}/${b.nodeCount}</span>`
          )
          .join('');
    }

    treeEl.innerHTML = snap.nodes
      .map((n) => {
        let cls = 'eternal-legacy-node-btn';
        if (n.invested) cls += ' invested';
        else if (!n.unlocked) cls += ' locked';
        else if (n.canInvest) cls += ' ready';
        else if (n.unlocked) cls += ' unlocked';
        const status = n.invested
          ? 'INVESTED'
          : !n.unlocked
            ? 'LOCKED'
            : n.canInvest
              ? `INVEST ${n.cost}◆`
              : n.prereqOk
                ? 'NEED ◆'
                : 'PREREQ';
        const hint = n.unlocked ? n.desc : n.hint;
        const foundationTag = n.foundationLabel ? ` · ${n.foundationLabel}` : '';
        const ascend =
          n.ascends?.length && n.invested
            ? ` · ascends ${n.ascends.slice(0, 2).join(', ')}`
            : n.ascends?.length
              ? ` · ${n.ascends.slice(0, 2).join(', ')}`
              : '';
        return (
          `<button type="button" class="${cls}" data-node="${n.id}"` +
          ` style="border-left-color:${n.branchColor}"` +
          ` title="${hint}"${n.canInvest ? '' : ' disabled'}>` +
          `<span class="eternal-node-tier">T${n.tier}</span>` +
          `<span class="eternal-node-name">${n.name}${n.isNewUnlock || n.isNewInvest ? ' ★' : ''}</span>` +
          `<span class="eternal-node-status">${status}</span>` +
          `<span class="eternal-node-hint">${hint}${foundationTag}${ascend}</span></button>`
        );
      })
      .join('');

    EternalLegacyTree.markUnlocksSeen();
  }

  function refreshRaidPanel(gs) {
    const section = document.getElementById('raid-section');
    const summary = document.getElementById('raid-summary-text');
    const list = document.getElementById('raid-mission-list');
    const raids = gs.settlementRaids;
    if (!section || !summary || !list) return;
    const show = !!(raids?.active || (gs.wave || 0) >= 140);
    section.style.display = show ? '' : 'none';
    if (!show) return;
    summary.textContent = raids?.summary || `Unlocks wave ${raids?.waveMin || 150}`;
    const missions = raids?.missions || [];
    if (!missions.length) {
      list.innerHTML =
        '<p class="panel-hint">No enemy holds spotted — factions build in the north after wave 150.</p>';
      return;
    }
    const selCount = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    const minForce = raids?.minStrikeForce || 2;
    list.innerHTML = missions
      .map((m) => {
        const status = m.dispatched ? 'EN ROUTE' : `+${m.rewardTp} TP`;
        const cls = m.dispatched
          ? 'raid-dispatched disabled'
          : selCount < minForce
            ? 'disabled'
            : '';
        const sci = m.rewardScience ? ` · +${m.rewardScience} SP` : '';
        return (
          `<button type="button" class="raid-mission-btn ${cls}" data-raid="${m.id}" title="Dispatch strike force to raze ${m.label}${sci}">` +
          `<span>${m.label}</span><span class="raid-reward">${status}</span></button>`
        );
      })
      .join('');
  }

  function refreshMapEventPanel(gs) {
    const section = document.getElementById('planet-event-section');
    const summary = document.getElementById('planet-event-summary');
    const list = document.getElementById('planet-event-choices');
    const me = gs.mapEvents;
    if (!section || !summary || !list) return;
    const wave = gs.wave || 0;
    const waveMin = me?.waveMin || 12;
    const show = !!(me?.active || me?.pending || me?.awaitingChoice || wave >= waveMin - 1);
    section.style.display = show ? '' : 'none';
    if (!show) return;

    const nightOk = gs.timeOfDay === 'night';
    const canRespond = !!(me?.canRespond || (me?.pending && me?.awaitingChoice && nightOk));
    const freeTp = gs.creativeMode && gs.creativeSettings?.freeResources;

    if (me?.pending && me?.event?.prep) {
      summary.textContent = `${me.event.name} — ${me.event.prep}${
        nightOk ? '' : ' (night prep only)'
      }`;
    } else if (me?.activeSummary) {
      summary.textContent = me.activeSummary;
    } else {
      summary.textContent = `Planet events unlock wave ${waveMin} (respond at night)`;
    }

    const choices = me?.event?.choices || [];
    const chosen = me?.event?.choice;

    if (!choices.length) {
      list.innerHTML = chosen
        ? '<p class="panel-hint">Response locked — effects apply at dawn.</p>'
        : '<p class="panel-hint">No planet event pending — check again after a wave clears at night.</p>';
      return;
    }

    const colorStyle = me.event?.color ? ` style="border-left-color:${me.event.color}"` : '';
    list.innerHTML = choices
      .map((ch) => {
        const isChosen = chosen === ch.id;
        const needTp = !freeTp && (ch.cost || 0) > 0 && (gs.tactical || 0) < (ch.cost || 0);
        let cls = '';
        let lockHint = '';
        if (isChosen) {
          cls = 'planet-event-chosen';
        } else if (!nightOk) {
          cls = 'planet-event-softlock';
          lockHint = ' Night prep only — wait for night.';
        } else if (!canRespond) {
          cls = 'planet-event-softlock';
          lockHint = ' Already answered or no pending event.';
        } else if (needTp) {
          cls = 'planet-event-softlock';
          lockHint = ` Need ${ch.cost} TP (have ${Math.floor(gs.tactical || 0)}).`;
        }
        const costLabel = ch.cost > 0 ? `${ch.cost} TP` : 'FREE';
        return (
          `<button type="button" class="planet-event-btn ${cls}" data-map-choice="${ch.id}"${colorStyle}` +
          ` title="${(ch.hint || ch.label || '') + lockHint}">` +
          `<span>${ch.label}</span><span class="planet-event-cost">${isChosen ? 'CHOSEN' : costLabel}</span>` +
          `<span class="planet-event-hint">${ch.hint || ''}${lockHint}</span></button>`
        );
      })
      .join('');
  }

  function refreshCounterPanel(gs) {
    const ce = gs.counterEvolution;
    const doctrineSection = document.getElementById('counter-doctrine-section');
    const expeditionSection = document.getElementById('counter-expedition-section');
    const summary = document.getElementById('counter-summary-text');
    const list = document.getElementById('expedition-list');
    const wave = gs.wave || 0;
    const counterDoctrines =
      typeof PlayerCounterEvolution !== 'undefined' ? PlayerCounterEvolution.COUNTER_DOCTRINES : {};

    if (doctrineSection) {
      const showDoctrine = !!(ce?.active || wave >= (ce?.waveMin || 15) - 2);
      doctrineSection.style.display = showDoctrine ? '' : 'none';
      if (showDoctrine) {
        hudBtns.counterDoctrine.forEach((btn) => {
          const id = btn.dataset.counterDoctrine;
          const def = counterDoctrines[id];
          const avail = PanelModel.counterDoctrine(id, gs);
          const costEl = btn._costEl;
          if (costEl && Number.isFinite(avail.cost)) costEl.textContent = String(avail.cost);
          markButton(btn, avail, false, null);
          btn.classList.toggle('kingdom-locked', !!avail.locked);
          const name = def?.name || id;
          setLabel(btn, avail.ok ? `${name}, ${avail.cost} TP` : `${name}, ${avail.reason}`);
        });
      }
    }

    if (!expeditionSection || !summary || !list) return;
    const showExpedition = !!(
      ce?.expeditionUnlocked ||
      ce?.active ||
      wave >= (ce?.expeditionWaveMin || 25) - 2
    );
    expeditionSection.style.display = showExpedition ? '' : 'none';
    if (!showExpedition) return;

    const inFlight = ce?.activeExpeditions || [];
    const inFlightNote = inFlight.length
      ? ` · ${inFlight.map((e) => `${e.factionName} W${e.returnWave}`).join(', ')} en route`
      : '';
    summary.textContent =
      (ce?.summary || `Unlocks wave ${ce?.expeditionWaveMin || 25}`) + inFlightNote;

    const targets = ce?.targets || [];
    if (!targets.length) {
      list.innerHTML =
        '<p class="panel-hint">No host factions active yet — expeditions target evolving enemy realms.</p>';
      return;
    }

    const selCount = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    const minForce = ce?.minExpeditionForce || 1;
    const maxForce =
      typeof PlayerCounterEvolution !== 'undefined'
        ? PlayerCounterEvolution.MAX_EXPEDITION_FORCE
        : 4;
    const nightOk = gs.timeOfDay === 'night';
    const expeditionUsed = !!gs.expeditionUsedThisWave;
    const forceOk = selCount >= minForce && selCount <= maxForce;

    list.innerHTML = targets
      .map((t) => {
        const enRoute = inFlight.some((e) => e.factionId === t.factionId);
        const stageLabel =
          t.effectiveStage < t.stage ? `S${t.stage}→S${t.effectiveStage}` : `S${t.stage}`;
        const status = enRoute ? 'EN ROUTE' : t.debuffed ? 'WEAKENED' : 'STRIKE';
        let cls = '';
        if (enRoute) cls = 'expedition-dispatched disabled';
        else if (expeditionUsed || !nightOk || !forceOk) cls = 'disabled';
        const colorStyle = t.color ? ` style="border-left-color:${t.color}"` : '';
        const lootHint =
          typeof PlayerCounterEvolution !== 'undefined' &&
          PlayerCounterEvolution.computeExpeditionLoot &&
          !enRoute
            ? (() => {
                const preview = PlayerCounterEvolution.computeExpeditionLoot(
                  { targetStage: t.stage, unitIds: Array(selCount || minForce).fill('x') },
                  Math.max(minForce, selCount || minForce),
                  (wave || 0) + 1
                );
                return ` · ~${preview.tp} TP / ${preview.science} SP loot`;
              })()
            : '';
        return (
          `<button type="button" class="expedition-btn ${cls}" data-faction="${t.factionId}"${colorStyle}` +
          ` title="Dispatch ${minForce}–${maxForce} hunters against ${t.name} (${stageLabel})${lootHint}">` +
          `<span>${t.name}</span><span class="expedition-stage">${stageLabel}</span>` +
          `<span class="expedition-status">${status}</span></button>`
        );
      })
      .join('');
  }

  function updateSpeedControl(speed) {
    const n =
      typeof PacingTools !== 'undefined'
        ? PacingTools.normalizeSpeed(speed)
        : parseFloat(speed) || 1;
    const speedBtn = document.getElementById('speed-toggle');
    if (speedBtn) {
      speedBtn.textContent = `Speed ${n}×`;
      speedBtn.classList.toggle('speed-active', n > 1);
    }
    document.querySelectorAll('.settings-speed-control .speed-btn').forEach((btn) => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', btnSpeed === n);
    });
  }

  function updateButtonStates(gs) {
    const prices = [];
    // Recruit keys follow what is unlocked (starting roster first, then each unlock).
    Hotkeys.deploySlots((t) => {
      const r = Availability.deploy(t, gs);
      return !(r.locked && (r.research || t === 'doomslayer_hero'));
    });
    hudBtns.deploy.forEach((btn) => {
      const type = btn.dataset.unit;
      // Recover expansion defs (ballista/bard/…) if a data race wiped UnitDefs.
      if (
        !getPlayerUnitDef?.(type) &&
        !UnitDefs?.[type] &&
        typeof ContentExpansion !== 'undefined' &&
        ContentExpansion.registerDefs
      ) {
        ContentExpansion.registerDefs();
      }
      const def = getPlayerUnitDef(type) || UnitDefs[type];
      const costEl = btn.querySelector?.('.cost') || btn._costEl;
      // One rule decides the price shown, the dimming, the click, the hotkey and the tooltip.
      const avail = Availability.deploy(type, gs);
      if (costEl && Number.isFinite(def?.cost) && costEl.textContent !== String(avail.cost)) {
        costEl.textContent = String(avail.cost);
      }
      // Upkeep (or Warband) is raising it: the base price stays visible, struck through.
      const price = Availability.deployPrice(type, gs);
      let was = btn._wasEl;
      if (!was && price.raised && costEl) {
        was = document.createElement('s');
        was.className = 'cost-was';
        costEl.after(was);
        btn._wasEl = was;
      }
      if (was) {
        const wasText = price.raised ? String(price.base) : '';
        if (was.textContent !== wasText) was.textContent = wasText;
        was.hidden = !price.raised;
        was.title = price.raised ? Availability.deployPriceText(type, gs) : '';
      }
      if (!avail.locked && Number.isFinite(avail.cost)) prices.push(avail.cost);
      const selected = type === gs.selectedDeploy;
      markButton(btn, avail, selected, Hotkeys.deployKey(type));
      btn.classList.toggle('research-locked', !!avail.research);
      if (def?.name) {
        setLabel(
          btn,
          avail.ok
            ? `${def.name}, ${Availability.deployPriceText(type, gs)}`
            : `${def.name}, ${avail.reason}`
        );
      }
    });

    const doomBtn = hudEls['doomslayer-deploy'];
    if (doomBtn) doomBtn.style.display = gs.doomslayerUnlocked ? '' : 'none';

    const wweBtn = hudEls['wwe-academy-open'];
    if (wweBtn) {
      wweBtn.style.display = '';
      wweBtn.classList.toggle('disabled', !gs.wweUnlocked);
      wweBtn.title = gs.wweUnlocked
        ? 'Grand Coliseum — arena champions'
        : 'Grand Coliseum — unlock via research or Iron Creed';
      wweBtn.textContent = gs.wweUnlocked ? 'GRAND COLISEUM' : 'GRAND COLISEUM 🔒';
    }
    const crossBtn = hudEls['crossover-hub-open'];
    if (crossBtn) {
      // Always show the Legion Archive entry; dim when locked so players know where it is.
      crossBtn.style.display = '';
      crossBtn.classList.toggle('disabled', !gs.crossoverUnlocked);
      crossBtn.title = gs.crossoverUnlocked
        ? 'Legion Archive — faction barracks & operatives'
        : 'Legion Archive — unlock a crossover faction (meta or research) to open';
      crossBtn.textContent = gs.crossoverUnlocked ? 'LEGION ARCHIVE' : 'LEGION ARCHIVE 🔒';
    }
    const perkSection = hudEls['perk-build-section'];
    if (perkSection) perkSection.style.display = gs.perksUnlocked ? '' : 'none';
    hudBtns.ability.forEach((btn) => {
      const id = btn.dataset.ability;
      const avail = Availability.ability(id, gs);
      const costEl = btn._costEl;
      if (costEl && Number.isFinite(avail.cost) && costEl.textContent !== String(avail.cost)) {
        costEl.textContent = String(avail.cost);
      }
      if (!avail.locked && Number.isFinite(avail.cost)) prices.push(avail.cost);
      markButton(btn, avail, id === gs.selectedAbility, keyFor('ability', id));
      const name = Abilities[id]?.name || id;
      setLabel(btn, avail.ok ? `${name}, ${avail.cost} TP` : `${name}, ${avail.reason}`);
    });
    hudBtns.build.forEach((btn) => {
      const buildType = btn.dataset.build;
      const def = BuildDefs[buildType];
      const costEl = btn._costEl;
      // Prefer live def; if BuildDefs was wiped mid-boot, keep HTML label — never fake 99 TP.
      if (costEl && Number.isFinite(def?.cost) && costEl.textContent !== String(def.cost)) {
        costEl.textContent = String(def.cost);
      }
      const avail = def
        ? Availability.build(buildType, gs)
        : { ok: false, reason: 'not available', locked: true };
      markButton(btn, avail, buildType === gs.selectedBuild, keyFor('build', buildType));
      btn.classList.toggle('research-locked', !!avail.research && !avail.mentor);
      btn.classList.toggle('mentor-ready', !!avail.mentorReady);
      if (def?.name) {
        setLabel(btn, avail.ok ? `${def.name}, ${avail.cost} TP` : `${def.name}, ${avail.reason}`);
      }
    });
    // The "Recruit cost +N%" chip reads the same price function as the buttons.
    const upkeepChip = document.getElementById('siege-upkeep');
    if (upkeepChip) {
      const pct = Availability.deployPrice('footman', gs).upkeepPct;
      const text = `Recruit cost +${pct}%`;
      if (upkeepChip.textContent !== text) upkeepChip.textContent = text;
      upkeepChip.hidden = pct <= 0;
    }
    // A full bar: enough for the dearest troop or strike on offer.
    tpBarMax = Availability.tpBarMax(prices);
    // Spy actions and messages: the price the game will charge, and waves left to wait.
    const markAction = (btn, kind, id, selected) => {
      const def = kind === 'spy' ? SpyActions[id] : CourierMessages[id];
      const act = PanelModel.action(kind, id, gs);
      markButton(btn, act, selected, null);
      btn.classList.toggle('kingdom-locked', act.locked);
      btn.classList.toggle('on-cooldown', act.state === 'cooldown');
      const costEl = btn._costEl;
      if (costEl && costEl.textContent !== String(act.cost)) costEl.textContent = String(act.cost);
      let wait = btn._waitEl;
      if (!wait) {
        wait = document.createElement('span');
        wait.className = 'wait';
        btn.appendChild(wait);
        btn._waitEl = wait;
      }
      if (wait.textContent !== act.waitText) wait.textContent = act.waitText;
      wait.hidden = !act.waitText;
      const name = def?.name || id;
      setLabel(btn, act.ok ? `${name}, ${act.costText}` : `${name}, ${act.reason}`);
    };
    hudBtns.spy.forEach((btn) => markAction(btn, 'spy', btn.dataset.spy, false));
    hudBtns.courier.forEach((btn) =>
      markAction(btn, 'courier', btn.dataset.courier, btn.dataset.courier === gs.selectedCourierMsg)
    );
    for (const kind of ['spy', 'courier']) {
      const badge = document.getElementById(`${kind}-uses`);
      if (!badge) continue;
      const left = PanelModel.usesLeft(kind, gs);
      const text = left > 0 ? `${left} left this wave` : 'used this wave';
      if (badge.textContent !== text) badge.textContent = text;
      badge.classList.toggle('spent', left <= 0);
    }

    const loadoutSection = hudEls['loadout-section'];
    if (loadoutSection) {
      const showLoadouts = gs.kingdomLoadoutsUnlocked || gs.wave >= 100;
      loadoutSection.style.display = showLoadouts ? '' : 'none';
      hudBtns.loadout.forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.loadout === gs.loadout);
        const tip =
          typeof ContentExpansion !== 'undefined' && ContentExpansion.formatLoadoutTip
            ? ContentExpansion.formatLoadoutTip(btn.dataset.loadout)
            : null;
        if (tip) btn.title = `${tip.body}\n${tip.footer}`;
      });
    }

    const huntBtn = hudEls['hunt-toggle'];
    if (huntBtn) huntBtn.textContent = 'HUNT';
    const holdBtn = hudEls['hold-here'];
    if (holdBtn) holdBtn.textContent = gs.heldCount ? `HOLD · ${gs.heldCount}` : 'HOLD';

    const formSection = hudEls['formation-section'];
    const selCount = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    if (formSection) {
      formSection.style.display = selCount >= 2 ? '' : 'none';
      hudBtns.formation.forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.formation === gs.selectionFormation);
      });
    }

    const researchBtn = hudEls['research-open'];
    if (researchBtn) researchBtn.style.display = '';
    // SP label + open-panel tree handled in updateHudMeters / renderPanel sig path.
    if (
      typeof Research !== 'undefined' &&
      (Research.isPanelOpen?.() ||
        document.getElementById('research-panel')?.classList.contains('open'))
    ) {
      // Prefer live buildings so isResearchLab / complete flags are accurate.
      const blds =
        typeof Game.getBuildingsForResearch === 'function'
          ? Game.getBuildingsForResearch()
          : Game.getBuildingsSnapshot?.() || [];
      Research.renderPanel(gs.wave, blds);
    }

    const repairBtn = hudEls['builder-repair-toggle'];
    if (repairBtn) repairBtn.textContent = `REPAIR: ${gs.builderAutoRepair ? 'ON' : 'OFF'}`;

    updateSpeedControl(gs.gameSpeed ?? 1);

    const demolishBtn = hudEls['demolish-btn'];
    if (demolishBtn) demolishBtn.classList.toggle('selected', gs.selectedDemolish);
    const moveBtn = hudEls['move-building-btn'];
    if (moveBtn) {
      moveBtn.classList.toggle('selected', gs.selectedMoveBuilding);
      moveBtn.classList.toggle('pending', !!gs.moveBuildingTarget);
    }
    const rotateBtn = hudEls['rotate-wall-btn'];
    if (rotateBtn) rotateBtn.classList.toggle('selected', gs.selectedRotateWall);

    const threatEl = hudEls['threat-text'];
    if (threatEl) {
      const sides = gs.attackSides || ['north'];
      const unlocked = gs.unlockedAttackSides || sides;
      const threatKey = `${sides.join(',')}|${unlocked.join(',')}|${gs.generalThreat}|${gs.bossActive}|${gs.lastStandActive}|${gs.multiFrontSiege?.summary || ''}`;
      if (threatKey !== lastThreatKey) {
        lastThreatKey = threatKey;
        const glyphs = { north: '▲', east: '▶', west: '◀', south: '▼' };
        const labels = { north: 'N', east: 'E', west: 'W', south: 'S' };
        const activeSet = new Set(sides);
        let flankHtml = '';
        if (unlocked.length <= 1) {
          flankHtml = '<span class="flank-dir flank-active">▲N</span>';
        } else {
          for (const s of ['north', 'east', 'west', 'south']) {
            if (!unlocked.includes(s)) continue;
            const on = activeSet.has(s);
            flankHtml += `<span class="flank-dir${on ? ' flank-active' : ' flank-quiet'}" title="${on ? 'Assaulting' : 'Quiet this wave'}">${glyphs[s]}${labels[s]}</span>`;
          }
        }
        const threat = gs.generalThreat > 0 ? ` · GEN×${gs.generalThreat}` : '';
        const boss = gs.bossActive ? ' · BOSS' : '';
        const stand = gs.lastStandActive ? ' · STAND' : '';
        threatEl.innerHTML = `${flankHtml}${threat}${boss}${stand}`;
      }
      const multi = sides.length > 1;
      threatEl.className =
        'stat-value threat-value threat-compass' +
        (multi || gs.generalThreat >= 2 || gs.bossActive ? ' threat-high' : '');
      const mf = gs.multiFrontSiege;
      threatEl.title = mf?.summary
        ? `${mf.summary}\nActive flanks: ${sides.join(', ')}`
        : multi
          ? `Active flanks: ${sides.join(', ')}`
          : unlocked.length > 1
            ? `Unlocked flanks: ${unlocked.join(', ')}`
            : 'North only';
      if (mf?.assignments?.length >= 2) {
        threatEl.classList.add('threat-multifront');
      }
    }

    const stageEl = document.getElementById('kingdom-stage-text');
    const evo = gs.kingdomEvolution;
    if (stageEl && evo) {
      stageEl.textContent = evo.shortName || '—';
      stageEl.style.color = evo.color || '';
      const prog = evo.progress != null ? ` · ${Math.round(evo.progress * 100)}%` : '';
      stageEl.title = `${evo.name} (waves ${evo.waveMin}–${evo.waveMax ?? '∞'})${prog}\n${evo.tagline || ''}`;
    } else if (stageEl) {
      stageEl.textContent = '—';
      stageEl.title = 'Kingdom evolution stage';
    }

    const evoMeter = gs.kingdomEvolutionMeter;
    const evoFill = document.getElementById('kingdom-evolution-fill');
    const evoPct = document.getElementById('kingdom-evolution-pct');
    const bannerCanvas = document.getElementById('kingdom-banner-canvas');
    if (evoMeter && evoFill) {
      const pct = evoMeter.stageProgress ?? Math.round((evoMeter.fill || 0) * 100);
      evoFill.style.width = `${Math.max(4, pct)}%`;
      evoFill.style.background = evo?.color
        ? `linear-gradient(90deg, ${evo.color}66, ${evo.color})`
        : '';
      if (evoPct) evoPct.textContent = `${pct}%`;
      const bd = evoMeter.breakdown || {};
      const evoBar = evoFill.parentElement;
      if (evoBar) {
        evoBar.title = `Evolution meter — Colony ${bd.colonyPct ?? 0}% · Buildings ${bd.buildingPct ?? 0}% (${bd.buildingCount ?? 0}) · Veterans ${bd.veteranPct ?? 0}% (${bd.veteranUnits ?? 0} named) · Research ${bd.researchPct ?? 0}% (${bd.researchCompleted ?? 0}/${bd.researchTotal ?? 0})`;
      }
    } else if (evoPct) {
      evoPct.textContent = '—';
    }
    if (bannerCanvas && typeof VisualPolish !== 'undefined' && VisualPolish.drawKingdomBanner) {
      const ctx = bannerCanvas.getContext('2d');
      const stage = evoMeter?.bannerStage || evo?.stage || 1;
      const fill = evoMeter?.fill ?? 0.2;
      const bannerOpts = typeof Cosmetics !== 'undefined' ? Cosmetics.getBannerOpts() : null;
      VisualPolish.drawKingdomBanner(
        ctx,
        bannerCanvas.width,
        bannerCanvas.height,
        stage,
        fill,
        bannerOpts?.primary || evo?.color,
        bannerOpts
      );
      const tierNames = ['Small Pennant', 'Kingdom Crest', 'Empire Banner', 'Hell-Forged Banner'];
      bannerCanvas.title = `${tierNames[stage - 1] || 'Banner'} — stage ${stage} · ${evoMeter?.stageProgress ?? 0}% growth`;
    }

    refreshRaidPanel(gs);
    refreshCounterPanel(gs);
    refreshMapEventPanel(gs);
    if (typeof FactionIntel !== 'undefined') FactionIntel.renderPanel(gs);

    const fmHud = document.getElementById('foundational-medieval-hud');
    const fmText = document.getElementById('foundational-medieval-text');
    const fmSnap = gs.foundationalMedieval;
    if (fmHud && fmText) {
      const line =
        typeof FoundationalMedievalLayer !== 'undefined'
          ? FoundationalMedievalLayer.formatHudLine({ wave: gs.wave })
          : fmSnap?.hudLine || '';
      const show = !!line || !!fmSnap?.inFoundationalEra;
      fmHud.style.display = show ? '' : 'none';
      if (show) {
        fmText.textContent = line || '—';
        if (fmSnap?.leadingColor) {
          fmHud.style.borderColor = fmSnap.leadingColor;
        }
        fmHud.title = fmSnap?.leadingLabel
          ? `Foundational DNA — ${fmSnap.leadingLabel} (waves 1–150)`
          : 'Lay your empire cultural DNA through archers, academies, or evolved heroes';
      }
    }

    const ascHud = document.getElementById('ascension-hud');
    const ascText = document.getElementById('ascension-text');
    const ascSnap = gs.ascension;
    if (ascHud && ascText) {
      const line =
        typeof AscensionSystem !== 'undefined'
          ? AscensionSystem.formatHudLine({ wave: gs.wave })
          : ascSnap?.hudLine || '';
      const show = !!line || (ascSnap?.legacyPoints || 0) > 0 || (ascSnap?.ascendedUnits || 0) > 0;
      ascHud.style.display = show ? '' : 'none';
      if (show) {
        ascText.textContent =
          line || (ascSnap?.legacyPoints ? `${ascSnap.legacyPoints} Legacy` : '—');
        ascHud.title = ascSnap?.eraLabel
          ? `Ascension — ${ascSnap.legacyPoints} Legacy Points (${ascSnap.eraLabel})`
          : 'Ascend max veterans at Kingdom (150) and Galactic (400) era gates';
      }
    }

    const thematicSynHud = document.getElementById('thematic-synergy-hud');
    const thematicSynText = document.getElementById('thematic-synergy-text');
    const thematicSynSnap = gs.thematicSynergy;
    if (thematicSynHud && thematicSynText) {
      const line =
        typeof ThematicEraSynergies !== 'undefined'
          ? ThematicEraSynergies.formatHudLine({ wave: gs.wave })
          : thematicSynSnap?.hudLine || '';
      const show = !!thematicSynSnap?.active || !!line;
      thematicSynHud.style.display = show ? '' : 'none';
      if (show) {
        thematicSynText.textContent = line || thematicSynSnap?.pathLabel || '—';
        if (thematicSynSnap?.pathColor)
          thematicSynHud.style.borderColor = thematicSynSnap.pathColor;
        thematicSynHud.title = thematicSynSnap?.pathDesc
          ? `${thematicSynSnap.pathLabel} — ${thematicSynSnap.pathDesc}`
          : 'Cross-era synergy from your medieval foundation path';
      }
    }

    const epfHud = document.getElementById('epf-hud');
    const epfText = document.getElementById('epf-text');
    const epfSnap = gs.eternalPaths;
    if (epfHud && epfText) {
      const line =
        typeof EternalPathFramework !== 'undefined'
          ? EternalPathFramework.formatHudLine({ wave: gs.wave })
          : epfSnap?.hudLine || '';
      // Only surface once the framework itself has something to say (it returns '' pre-wave-50
      // with no dominant path). A blanket `wave >= 1` forced this into view — and its bare '?'
      // fallback text — from turn one, before any path exists to report on.
      const show = !!line || !!epfSnap?.dominantPathId;
      epfHud.style.display = show ? '' : 'none';
      if (show) {
        epfText.textContent = line || 'Path ?';
        if (epfSnap?.dominantColor) epfHud.style.borderColor = epfSnap.dominantColor;
        epfHud.title = epfSnap?.dominantLabel
          ? `${epfSnap.dominantLabel} — investment strengthens every era`
          : 'Four Eternal Paths evolve Medieval → Kingdom → Galactic';
      }
    }

    const crownHud = document.getElementById('crown-thread-hud');
    const crownText = document.getElementById('crown-thread-text');
    const crownSnap = gs.narrativeThread;
    if (crownHud && crownText) {
      const line =
        typeof NarrativeThread !== 'undefined'
          ? NarrativeThread.formatHudLine({ wave: gs.wave })
          : crownSnap?.hudLine || '';
      const show = !!line || (crownSnap?.legendCount || 0) > 0 || (gs.wave || 0) >= 1;
      crownHud.style.display = show ? '' : 'none';
      if (show) {
        crownText.textContent = line || 'Ancient Crown';
        crownHud.title = crownSnap?.crownEpithet
          ? `${crownSnap.crownEpithet} — ${crownSnap.legendCount || 0} legend(s) grant real power`
          : 'The Ancient Crown endures — heroes become mythic figures';
      }
    }

    const techHud = document.getElementById('tech-branch-hud');
    const techText = document.getElementById('tech-branch-text');
    const techSnap = gs.techTreeBranches;
    if (techHud && techText) {
      const line =
        typeof TechTreeBranches !== 'undefined'
          ? TechTreeBranches.formatHudLine({ wave: gs.wave })
          : techSnap?.hudLine || '';
      const show = !!line || !!techSnap?.rootLocked || (gs.wave || 0) >= 35;
      techHud.style.display = show ? '' : 'none';
      if (show) {
        techText.textContent = line || techSnap?.rootLabel || 'Root ?';
        if (techSnap?.rootColor) techHud.style.borderColor = techSnap.rootColor;
        techHud.title = techSnap?.techTreeLabel
          ? `${techSnap.rootLabel} — ${techSnap.techTreeLabel}`
          : 'Martial / Arcane / Mythic / Tech root locks wave 50';
      }
    }

    const pfHud = document.getElementById('power-fantasy-hud');
    const pfText = document.getElementById('power-fantasy-text');
    const pfSnap = gs.powerFantasy;
    if (pfHud && pfText) {
      const line =
        typeof HybridPowerFantasy !== 'undefined'
          ? HybridPowerFantasy.formatHudLine({ wave: gs.wave })
          : pfSnap?.hudLine || '';
      const show = !!pfSnap?.active || !!pfSnap?.pending || !!line;
      pfHud.style.display = show ? '' : 'none';
      if (show) {
        pfText.textContent = line || pfSnap?.fantasyLabel || '—';
        if (pfSnap?.fantasyColor) pfHud.style.borderColor = pfSnap.fantasyColor;
        pfHud.title = pfSnap?.fantasyDesc
          ? `${pfSnap.fantasyLabel} — ${pfSnap.fantasyDesc}`
          : 'Pure medieval DNA unlocks apex power fantasy at wave 500';
      }
    }

    const elHud = document.getElementById('eternal-legacy-hud');
    const elText = document.getElementById('eternal-legacy-text');
    const elSnap = gs.eternalLegacy;
    if (elHud && elText) {
      const line =
        typeof EternalLegacyTree !== 'undefined'
          ? EternalLegacyTree.formatHudLine({ wave: gs.wave })
          : elSnap?.hudLine || '';
      const show = !!line || (elSnap?.investedCount || 0) > 0;
      elHud.style.display = show ? '' : 'none';
      if (show) {
        elText.textContent =
          line || (elSnap?.investedCount ? `Crown ${elSnap.investedCount}` : '—');
        elHud.title =
          elSnap?.investedCount > 0
            ? `Echoes of the Past — ${elSnap.investedCount} node(s) invested`
            : 'Invest Echo Shards in Crown of Ages on the main menu';
      }
    }

    const ptHud = document.getElementById('pacing-tools-hud');
    const ptText = document.getElementById('pacing-tools-text');
    const ptSnap = gs.pacingTools;
    if (ptHud && ptText) {
      const line =
        typeof PacingTools !== 'undefined'
          ? PacingTools.formatHudLine({ gameSpeed: gs.gameSpeed, paused: gs.paused })
          : ptSnap?.hudLine || '';
      const q = ptSnap?.queueDepth || 0;
      const show = gs.paused || q > 0 || (gs.gameSpeed ?? 1) >= 8 || !!ptSnap?.strongPauseReason;
      ptHud.style.display = show ? '' : 'none';
      if (show) {
        ptText.textContent = line;
        ptHud.classList.toggle('pacing-tools-paused', !!gs.paused);
        ptHud.title = ptSnap?.strongPauseReason
          ? `Strong pause — ${ptSnap.strongPauseReason}${q ? ` · ${q} queued` : ''}`
          : q > 0
            ? `${q} notification(s) queued — will drain on resume`
            : `Simulation running at ${gs.gameSpeed ?? 1}×`;
      }
    }

    const prHud = document.getElementById('progression-restart-hud');
    const prText = document.getElementById('progression-restart-text');
    const prSnap = gs.progressionRestart;
    if (prHud && prText) {
      const line =
        typeof ProgressionRestarts !== 'undefined'
          ? ProgressionRestarts.formatHudLine({ wave: gs.wave })
          : prSnap?.hudLine || '';
      const show = !!line || !!prSnap?.nextGate;
      prHud.style.display = show ? '' : 'none';
      if (show) {
        prText.textContent =
          line ||
          (prSnap?.nextGate ? `Next w${prSnap.nextGate.wave}: ${prSnap.nextGate.shortName}` : '—');
        prHud.title = prSnap?.lastRestart
          ? `Escalation restart — ${prSnap.lastRestart.name}. Legacies, research, and TP imported.`
          : prSnap?.nextGate
            ? `Wave ${prSnap.nextGate.wave} resets the tactical map but imports legacies and tech.`
            : 'Major escalation restarts import legacies, tech, and bonuses';
      }
    }

    hudBtns.doctrine.forEach((btn) => {
      const id = btn.dataset.doctrine;
      const def = gs.kingdomDoctrines?.[id];
      const avail = PanelModel.doctrine(id, gs);
      const costEl = btn._costEl;
      if (costEl && Number.isFinite(avail.cost)) costEl.textContent = String(avail.cost);
      markButton(btn, avail, false, null);
      btn.classList.toggle('kingdom-locked', !!avail.locked);
      const name = def?.name || id;
      setLabel(btn, avail.ok ? `${name}, ${avail.cost} TP` : `${name}, ${avail.reason}`);
    });
    // Every button now knows its place: fill the Locked groups.
    syncLockedGroups();

    const strengthWrap = document.getElementById('strength-meter-wrap');
    const strengthStage = document.getElementById('strength-stage-text');
    const strengthFill = document.getElementById('strength-fill');
    const strengthBaseline = document.getElementById('strength-baseline-mark');
    const strengthRatio = document.getElementById('strength-ratio-text');
    const strengthHud = document.getElementById('strength-hud');
    const cv = gs.colonyValue || 0;
    const ratio = gs.colonyThreatRatio || 1;
    const tier = gs.colonyThreatTier || '—';
    const tierColor = gs.colonyThreatColor || '#88cc88';
    const nextP = gs.colonyNextPressure;
    const barPct = Math.max(0, Math.min(100, ((ratio - 0.5) / 1.75) * 100));
    const baselinePct = ((1 - 0.5) / 1.75) * 100;
    const tierSlug = String(tier)
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    const colonySnap =
      cv > 0
        ? {
            total: cv,
            baseline: gs.colonyBaseline || 0,
            threatRatio: ratio,
            tier: { label: tier, color: tierColor },
            breakdown: gs.colonyBreakdown || {},
          }
        : null;
    const threatTooltip =
      typeof ColonyValue !== 'undefined' && ColonyValue.formatThreatTooltip
        ? ColonyValue.formatThreatTooltip(colonySnap, nextP, gs.wave || 0)
        : gs.colonyThreatTooltip || 'Kingdom strength vs next wave baseline — hover for details.';
    if (strengthFill) {
      strengthFill.style.width = cv > 0 ? `${barPct}%` : '0%';
      strengthFill.style.background = `linear-gradient(90deg, ${tierColor}77, ${tierColor})`;
    }
    if (strengthBaseline) strengthBaseline.style.left = `${baselinePct}%`;
    if (strengthStage) {
      const stageShort =
        typeof ColonyValue !== 'undefined' && ColonyValue.getThreatStageIndex
          ? ColonyValue.THREAT_TIERS[ColonyValue.getThreatStageIndex(ratio)]?.short
          : null;
      strengthStage.textContent = cv > 0 ? stageShort || tier.slice(0, 4) : '—';
      strengthStage.style.color = tierColor;
      strengthStage.style.borderColor = `${tierColor}88`;
      strengthStage.title = cv > 0 ? `${tier} — Kingdom strength stage` : '';
    }
    if (strengthRatio) {
      strengthRatio.textContent = cv > 0 ? `${ratio.toFixed(2)}×` : '—';
      strengthRatio.style.color = tierColor;
    }
    if (strengthWrap) {
      strengthWrap.title = threatTooltip;
      strengthWrap.className = 'strength-meter-wrap' + (cv > 0 ? ` strength-tier-${tierSlug}` : '');
    }
    if (strengthHud) {
      strengthHud.className =
        'stat-group strength-hud' +
        (cv > 0 && ratio >= 1.3 ? ' strength-elevated' : '') +
        (cv > 0 && ratio >= 1.7 ? ' strength-critical' : '');
    }

    const hostEl = document.getElementById('host-faction-text');
    if (hostEl) {
      const ef = gs.enemyFactions;
      const asymHost = gs.asymmetricWarfare;
      if (asymHost || ef?.activeSummary) {
        const summary = asymHost?.hostSummary || ef.activeSummary;
        hostEl.textContent = summary.slice(0, 44) + (summary.length > 44 ? '…' : '');
        const tips = (ef?.activeFactions || [])
          .map((f) => {
            const raid = f.counterRaids ? ' · counter-raids active' : '';
            return `${f.name} Stage ${f.stage} — ${f.tierLabel} (${f.buildingCount} sites${raid})\n${f.tagline}`;
          })
          .join('\n\n');
        const raidNote = ef?.counterRaidFactions?.length
          ? `\n\nCounter-raids: ${ef.counterRaidFactions.join(', ')}`
          : '';
        const ce = gs.counterEvolution;
        const debuffNote = ce?.debuffedFactions
          ? `\n\nCounter-offensive: ${ce.debuffedFactions} faction${ce.debuffedFactions > 1 ? 's' : ''} weakened` +
            ((ce.targets || [])
              .filter((t) => t.debuffed)
              .map((t) => ` · ${t.name} S${t.effectiveStage}`)
              .join('') || '')
          : '';
        const rep = gs.factionReputation;
        const repNote = rep?.factions?.length
          ? `\n\nReputation: ${rep.factions
              .map(
                (f) =>
                  `${f.name} ${f.stanceLabel} (${f.hostility}${f.evolutionOffset ? ` · evo ${f.evolutionOffset > 0 ? '+' : ''}${f.evolutionOffset}` : ''}${f.economicFocus ? ' · eco' : ''})`
              )
              .join(' · ')}`
          : '';
        const hostRole = asymHost
          ? `\n\n${asymHost.hostRole.name} Lv${asymHost.hostThreatLevel} — ${asymHost.hostLevelLabel}\n${asymHost.hostRole.macro}`
          : '';
        hostEl.title =
          (tips || 'Evolving host — levels up and threatens the map') +
          raidNote +
          debuffNote +
          repNote +
          hostRole;
        hostEl.style.color =
          asymHost?.balance === 'host_advantage'
            ? '#ff6060'
            : ef?.activeFactions?.[0]?.color || asymHost?.hostLevelLabel
              ? '#e07050'
              : '';
        hostEl.className =
          'stat-value host-value host-clickable' +
          (ef?.counterRaidFactions?.length || asymHost?.balance === 'host_advantage'
            ? ' host-raiding'
            : '') +
          ((ef?.hostKingdomTotal || 0) >= 40 ? ' host-high' : '');
        hostEl.title = (hostEl.title || '') + '\n\nClick HOST or 🗺 to open Threat Map.';
      } else {
        hostEl.textContent = '—';
        hostEl.title = 'Evolving host — auto-escalates; you build and command to push back';
        hostEl.style.color = '';
        hostEl.className = 'stat-value host-value';
      }
    }

    const controlHud = document.getElementById('control-hud');
    const controlEl = document.getElementById('control-text');
    if (controlHud && controlEl) {
      controlHud.style.display = 'none';
    }

    const realmHud = document.getElementById('realm-hud');
    const realmEl = document.getElementById('realm-biome-text');
    const lp = gs.livingPlanet;
    if (realmHud && realmEl) {
      const show = !!(lp?.active && (lp.unlocked?.length > 1 || (gs.territoryTier ?? 0) >= 2));
      realmHud.style.display = show ? '' : 'none';
      if (show) {
        realmEl.textContent =
          (lp.summary || 'Plains').slice(0, 28) + ((lp.summary || '').length > 28 ? '…' : '');
        const tips = (lp.biomes || []).map((b) => `${b.name}: ${b.desc}`).join('\n');
        realmEl.title = tips || 'Living planet biomes unlock as territory expands.';
        const hasHell = lp.unlocked?.includes('hellscape');
        const hasMount = lp.unlocked?.includes('mountains');
        realmEl.className =
          'stat-value realm-value' +
          (hasHell ? ' realm-hellscape' : hasMount ? ' realm-mountains' : ' realm-forest');
        realmEl.style.color = hasHell ? '#e05070' : hasMount ? '#a0a090' : '#70a878';
      }
    }

    const planetHud = document.getElementById('planet-event-hud');
    const planetEl = document.getElementById('planet-event-text');
    const me = gs.mapEvents;
    if (planetHud && planetEl) {
      const show = !!(me?.active || me?.pending || (gs.wave || 0) >= (me?.waveMin || 12));
      planetHud.style.display = show ? '' : 'none';
      if (show) {
        const label =
          me?.activeSummary ||
          (me?.pending && me?.event?.name ? `${me.event.name} — respond` : null) ||
          me?.event?.name ||
          'Planet';
        planetEl.textContent = (label || '—').slice(0, 28) + ((label || '').length > 28 ? '…' : '');
        planetEl.title =
          me?.event?.prep ||
          me?.activeSummary ||
          'Dynamic map events — volcanic eruptions, awakening ruins, ley storms';
        planetEl.className =
          'stat-value planet-event-value' + (me?.pending ? ' planet-event-active' : '');
        planetEl.style.color = me?.event?.color || '';
      }
    }

    const intelEl = document.getElementById('wave-intel-text');
    if (intelEl) {
      const mf = gs.multiFrontSiege;
      const mfNote = mf?.intel ? mf.intel : '';
      const bossPack = gs.monsterBosses?.currentPack?.packSummary;
      const hazNote = gs.factionHazards?.summary;
      const wildNote = gs.neutralWildlife?.summary;
      const pactNote = gs.neutralRelations?.summary;
      const biomeNote = gs.biomeSpawn?.summary;
      const mapNote =
        me?.activeSummary || (me?.pending && me?.event?.name ? `${me.event.name} pending` : '');
      const repNote = gs.factionReputation?.summary;
      // Prefer short structured brief over nextWaveIntel (which piles meta notes).
      const briefParts = [];
      if (gs.namedBoss) briefParts.push(String(gs.namedBoss));
      else if (bossPack) briefParts.push(String(bossPack).slice(0, 28));
      if (mfNote) briefParts.push(String(mfNote).slice(0, 28));
      else if (mapNote) briefParts.push(String(mapNote).slice(0, 28));
      else if (repNote) briefParts.push(String(repNote).slice(0, 28));
      else if (pactNote || biomeNote || hazNote || wildNote) {
        briefParts.push(String(pactNote || biomeNote || hazNote || wildNote).slice(0, 28));
      }
      if (!briefParts.length && gs.nextWaveIntel) {
        // Fallback: first clause only (before meta · soup)
        briefParts.push(String(gs.nextWaveIntel).split(' · ')[0].slice(0, 40));
      }
      const intel = briefParts.filter(Boolean).join(' · ');
      intelEl.textContent = intel ? intel.slice(0, 48) + (intel.length > 48 ? '…' : '') : '—';
      intelEl.title = intel || '';
      if (mf?.mode) {
        intelEl.className =
          'stat-value intel-value' +
          (mf.mode === 'competing' ? ' intel-competing' : ' intel-coordinated');
      } else {
        intelEl.className = 'stat-value intel-value';
      }
    }

    const synHud = document.getElementById('syn-hud');
    const synEl = document.getElementById('syn-text');
    const syns = gs.factionSynergies || [];
    const skillNote = gs.operativeSkills?.summary;
    const fieldCount = (v) => (Array.isArray(v) ? v.length : v || 0);
    const hasCrossoverField = fieldCount(gs.wweOnField) + fieldCount(gs.crossoverOnField) > 0;
    if (synHud && synEl) {
      const show =
        hasCrossoverField &&
        (syns.length > 0 || gs.seasonalEvent || skillNote || gs.operativeSkills?.active);
      synHud.style.display = show ? '' : 'none';
      if (show) {
        const parts = [];
        if (syns.length) parts.push(syns.slice(0, 2).join(' · '));
        if (skillNote) parts.push(`⚔ ${skillNote}`);
        if (gs.seasonalEvent) parts.push(`★ ${gs.seasonalEvent}`);
        synEl.textContent =
          parts.join(' | ').slice(0, 42) + (parts.join(' | ').length > 42 ? '…' : '');
        const skillTips = (gs.operativeSkills?.factions || [])
          .filter((f) => f.purchased?.length)
          .map(
            (f) => `${f.label}: ${f.purchased.length} node(s) · ${f.availablePoints} SP available`
          )
          .join('\n');
        synEl.title = [
          syns.length ? `Active synergies: ${syns.join(', ')}` : '',
          skillTips || (skillNote ? `Operative skills: ${skillNote}` : ''),
          gs.seasonalEvent ? `Seasonal: ${gs.seasonalEvent}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        synEl.className = 'stat-value syn-value' + (syns.length >= 2 ? ' syn-active' : '');
      }
    }

    const cmdText = document.getElementById('cmd-text');
    if (cmdText && gs.generalAura?.strength > 0) {
      const a = gs.generalAura;
      cmdText.title = `Aura: morale +${(a.morale * 100).toFixed(0)}% · acc +${Math.round(a.accuracy)} · radius ${Math.round(a.radius)}`;
    }

    const tpRoundEl = document.getElementById('tp-round-text');
    if (tpRoundEl && (gs.settlementTpRaw ?? 0) > (gs.settlementTpCapped ?? 0)) {
      tpRoundEl.title = `Settlement bonus capped: ${gs.settlementTpCapped}/${gs.settlementTpRaw} raw`;
    }
  }

  let lastHudKey = '';
  let lastHudRevision = -1;
  let lastThreatKey = '';
  let lastMessageText = '';
  let lastCmdKey = '';
  let lastWaveFillKey = '';
  let lastAsymKey = '';

  let lastResearchBtnKey = '';

  function updateHudMeters(gs) {
    const waveFill = hudEls['wave-fill'];
    if (waveFill) {
      const prog =
        gs.timeOfDay === 'night'
          ? Math.round((gs.nightProgress ?? 0) * 100)
          : Math.round((gs.waveProgress ?? 0) * 100);
      const waveFillKey = `${gs.timeOfDay}:${prog}`;
      if (waveFillKey !== lastWaveFillKey) {
        lastWaveFillKey = waveFillKey;
        waveFill.style.width = `${prog}%`;
        waveFill.classList.toggle('night-fill', gs.timeOfDay === 'night');
      }
    }
    // SP / research progress: update the RESEARCH button without full deploy-bar rebuild.
    const researchBtn = hudEls['research-open'];
    if (researchBtn) {
      const active = gs.researchActive;
      const killSci = gs.scienceKillStatus;
      const spLabel = (gs.sciencePoints ?? 0).toFixed(1);
      const researchKey = [
        active?.pct ?? '',
        spLabel,
        killSci?.labs ?? 0,
        killSci?.earned ?? 0,
        killSci?.cap ?? 0,
        gs.researchCompleted ?? 0,
      ].join('|');
      if (researchKey !== lastResearchBtnKey) {
        lastResearchBtnKey = researchKey;
        researchBtn.textContent = active
          ? `RESEARCH ${active.pct}%`
          : killSci?.labs > 0
            ? `RESEARCH ${spLabel} SP (${killSci.earned}/${killSci.cap})`
            : `RESEARCH (${spLabel} SP)`;
      }
    }
    const asym = gs.asymmetricWarfare;
    const asymPlayerFill = hudEls['asym-player-fill'];
    const asymHostFill = hudEls['asym-host-fill'];
    const asymBalance = hudEls['asym-balance-text'];
    if (asym && asymPlayerFill && asymHostFill) {
      const asymKey = [
        asym.playerBarPct,
        asym.hostBarPct,
        asym.balance,
        asym.commanderAuthority,
        asym.hostThreatLevel,
        asym.playerRole?.name,
        asym.hostRole?.name,
        asym.hostLevelTagline,
      ].join('|');
      if (asymKey !== lastAsymKey) {
        lastAsymKey = asymKey;
        asymPlayerFill.style.width = `${asym.playerBarPct}%`;
        asymHostFill.style.width = `${asym.hostBarPct}%`;
        if (asymBalance) {
          const balanceLabel =
            asym.balance === 'host_advantage'
              ? 'Host pressing'
              : asym.balance === 'player_advantage'
                ? 'You hold macro'
                : 'Contested';
          asymBalance.textContent = `${balanceLabel} · Cmd ${asym.commanderAuthority} vs Lv${asym.hostThreatLevel}`;
          asymBalance.title = `${asym.playerRole.name} vs ${asym.hostRole.name}\n${asym.hostLevelTagline || ''}`;
        }
      }
    }
  }

  function cacheHudDom() {
    const ids = [
      'tp-fill',
      'tp-text',
      'tp-round-text',
      'army-text',
      'upkeep-text',
      'breach-hud',
      'breach-text',
      'breach-pips',
      'wave-text',
      'wave-fill',
      'cycle-text',
      'begin-day-btn',
      'cmd-text',
      'asym-player-fill',
      'asym-host-fill',
      'asym-balance-text',
      'diff-text',
      'advanced-diff-pct',
      'message-box',
      'threat-text',
      'doomslayer-deploy',
      'wwe-academy-open',
      'crossover-hub-open',
      'perk-build-section',
      'loadout-section',
      'hunt-toggle',
      'hold-here',
      'formation-section',
      'research-open',
      'builder-repair-toggle',
      'demolish-btn',
      'move-building-btn',
      'rotate-wall-btn',
    ];
    for (const id of ids) {
      hudEls[id] = document.getElementById(id);
    }
    const bindCost = (selector) => {
      const nodes = [...document.querySelectorAll(selector)];
      for (const btn of nodes) {
        btn._costEl = btn.querySelector('.cost');
      }
      return nodes;
    };
    hudBtns.deploy = bindCost('.deploy-btn');
    hudBtns.ability = bindCost('.ability-btn');
    hudBtns.build = bindCost('.build-btn');
    hudBtns.spy = bindCost('.spy-btn');
    hudBtns.courier = bindCost('.courier-btn');
    hudBtns.doctrine = bindCost('.doctrine-btn');
    hudBtns.counterDoctrine = bindCost('.counter-doctrine-btn');
    indexPanelItems();
    const loadoutSection = hudEls['loadout-section'];
    hudBtns.loadout = loadoutSection ? [...loadoutSection.querySelectorAll('.loadout-btn')] : [];
    const formSection = hudEls['formation-section'];
    hudBtns.formation = formSection ? [...formSection.querySelectorAll('.formation-btn')] : [];
  }

  function hudKey(gs) {
    return [
      gs.state,
      gs.tactical,
      gs.wave,
      gs.army,
      gs.unitProducers,
      gs.selectedDeploy,
      gs.selectedAbility,
      gs.selectedBuild,
      gs.selectedDemolish,
      gs.selectedMoveBuilding,
      gs.selectedRotateWall,
      gs.pendingWallFacing,
      gs.moveBuildingTarget,
      gs.paused,
      gs.heldCount,
      gs.siegeLoop?.breaches,
      gs.siegeLoop?.breachLimit,
      gs.courierUsedThisWave,
      gs.courierMessagesUsedThisWave,
      gs.hasCourier,
      gs.spyUsedThisWave,
      gs.doctrineUsedThisWave,
      gs.counterDoctrineUsedThisWave,
      gs.expeditionUsedThisWave,
      gs.kingdomEvolutionMeter?.stageProgress,
      gs.kingdomEvolutionMeter?.bannerStage,
      gs.waveProgress,
      gs.messages.length,
      gs.achievements?.unlocked,
      gs.difficulty,
      gs.rallyActive,
      gs.generalBuff,
      gs.hasGeneral,
      gs.generalStationed,
      gs.territoryTier,
      gs.academyEra,
      gs.canDeploy,
      gs.rtsEra,
      gs.settlementTpBonus,
      gs.liveBuilders,
      gs.difficultyPercent,
      gs.wweUnlocked,
      gs.doomslayerUnlocked,
      gs.hamletCount,
      gs.guildCount,
      gs.timeOfDay,
      gs.nightProgress,
      gs.nightSecondsLeft,
      // sciencePoints / researchActive.pct / kill SP meters update via updateHudMeters
      // so combat kills don't rebuild every deploy/build button every frame.
      gs.researchLabs,
      gs.researchCompleted,
      gs.selectedUnitsDigest ?? '',
      gs.generalThreat,
      gs.lastStandActive,
      gs.nextWaveIntel,
      gs.bossActive,
      gs.colonyValue,
      gs.colonyBaseline,
      gs.colonyThreatRatio,
      gs.colonyThreatTier,
      gs.colonyThreatColor,
      gs.colonyNextPressure?.countMult,
      gs.colonyNextPressure?.eliteSlots,
      gs.hybridAcademy,
      gs.builderAutoRepair,
      gs.settlementTpRaw,
      gs.creativeMode,
      gs.creativeTool,
      gs.creativeSpawnType,
      gs.selectedUnitId,
      gs.selectedUnitIds?.length,
      gs.selectionFormation,
      gs.creativeSettingsSig ?? JSON.stringify(gs.creativeSettings),
      (gs.factionSynergies || []).join(','),
      gs.seasonalEvent,
      gs.enemyCount,
      gs.replayInfo?.recording,
      gs.replayInfo?.frameCount,
      gs.creativeCustomWave?.count,
      gs.sandboxStats?.spawns,
      gs.asymmetricWarfare?.commanderAuthority,
      gs.asymmetricWarfare?.hostThreatLevel,
      gs.asymmetricWarfare?.balance,
      gs.asymmetricWarfare?.playerMacro,
      gs.asymmetricWarfare?.playerMicro,
      gs.enemyFactions?.activeSummary,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      (gs.buildableAcademies || []).join(','),
      gs.settlementRaids?.summary,
      gs.settlementRaids?.pendingCount,
      gs.settlementRaids?.inFlightCount,
      (gs.settlementRaids?.missions || []).map((m) => `${m.id}:${m.dispatched}`).join(','),
      gs.multiFrontSiege?.mode,
      gs.multiFrontSiege?.intel,
      (gs.multiFrontSiege?.assignments || [])
        .map((a) => `${a.factionId}:${a.doctrine}:${a.frontLabel}`)
        .join(','),
      gs.monsterBosses?.currentPack?.evolution,
      gs.monsterBosses?.currentPack?.packSummary,
      gs.livingPlanet?.summary,
      (gs.livingPlanet?.unlocked || []).join(','),
      gs.factionHazards?.summary,
      gs.factionHazards?.count,
      gs.factionHazards?.voidSpreading,
      gs.neutralWildlife?.summary,
      gs.neutralWildlife?.count,
      gs.neutralWildlife?.event?.id,
      gs.neutralRelations?.summary,
      gs.neutralRelations?.reputation,
      gs.neutralRelations?.stance,
      gs.biomeSpawn?.summary,
      gs.biomeSpawn?.biome,
      gs.operativeSkills?.summary,
      (gs.operativeSkills?.factions || [])
        .map((f) => `${f.factionId}:${f.purchased?.length}`)
        .join(','),
      gs.mapEvents?.activeSummary,
      gs.mapEvents?.pending,
      gs.mapEvents?.event?.id,
      gs.mapEvents?.event?.choice,
      gs.factionReputation?.summary,
      (gs.factionReputation?.factions || [])
        .map((f) => `${f.factionId}:${f.hostility}:${f.stance}`)
        .join(','),
      gs.counterEvolution?.summary,
      gs.counterEvolution?.debuffedFactions,
      (gs.counterEvolution?.targets || [])
        .map((t) => `${t.factionId}:${t.effectiveStage}:${t.debuffed}`)
        .join(','),
      (gs.counterEvolution?.activeExpeditions || [])
        .map((e) => `${e.factionId}:${e.returnWave}`)
        .join(','),
    ].join('|');
  }

  /**
   * Compact night-prep chips: threat tier, host size, flanks, special flags.
   * Avoids dumping nextWaveIntel system-note soup onto the player.
   */
  function buildNightPrepChips(gs) {
    const chips = [];
    const tier = gs.colonyThreatTier;
    if (tier && tier !== '—') {
      chips.push({ label: tier, kind: 'threat' });
    }
    const pressure = gs.colonyNextPressure || gs.colonyThreatMods;
    const countMult = pressure?.countMult || 1;
    const sizePct = Math.round((countMult - 1) * 100);
    if (sizePct > 6) chips.push({ label: 'Larger host', kind: 'warn' });
    else if (sizePct < -6) chips.push({ label: 'Lighter host', kind: 'ok' });
    else chips.push({ label: 'Matched host', kind: 'neutral' });

    const sides = gs.attackSides || ['north'];
    if (sides.length > 1) {
      chips.push({
        label: `${sides.map((s) => String(s).slice(0, 1).toUpperCase()).join('/')} flanks`,
        kind: 'warn',
      });
    } else if (sides[0]) {
      const s = String(sides[0]);
      chips.push({
        label: `${s.charAt(0).toUpperCase()}${s.slice(1)} approach`,
        kind: 'neutral',
      });
    }

    if (gs.namedBoss)
      chips.push({ label: `Boss: ${String(gs.namedBoss).slice(0, 18)}`, kind: 'boss' });
    else if (gs.bossActive) chips.push({ label: 'Boss wave', kind: 'boss' });
    if (gs.multiFrontSiege?.mode === 'competing')
      chips.push({ label: 'Multi-front', kind: 'warn' });
    else if (gs.multiFrontSiege?.mode === 'coordinated')
      chips.push({ label: 'Coordinated', kind: 'warn' });
    if (gs.mapEvents?.pending && gs.mapEvents?.event?.name) {
      chips.push({ label: String(gs.mapEvents.event.name).slice(0, 16), kind: 'event' });
    }

    return chips.slice(0, 4);
  }

  function updateHUD(force = false) {
    if (Game.isPlaying?.()) ensureMenuDismissedForPlay();
    // Before any early return below: the result screen must never depend on which frame
    // the run happened to end in.
    syncGameOverScreen(Game.getState());
    // Tactical Points: the number and bar are written from the live purse on every
    // refresh, before any early return, and a change in it always redraws the buttons.
    // (They used to be written only on a full redraw, which a paused game never reached.)
    {
      const live = Game.getState();
      if (Game.isPlaying?.()) Availability.dropUnavailableSelection(live);
      const owned = Availability.renderTp(
        { text: hudEls['tp-text'], fill: hudEls['tp-fill'] },
        live,
        tpBarMax
      );
      if (owned !== lastTpSeen) {
        lastTpSeen = owned;
        force = true;
      }
      updateCursorTag(Game.getState());
    }
    const hudRev = typeof Game.getHudRevision === 'function' ? Game.getHudRevision() : -1;
    if (!force && hudRev >= 0 && hudRev === lastHudRevision) {
      const gs = Game.getState();
      updateHudMeters(gs);
      if (gs.creativeMode && typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
      if (typeof UX !== 'undefined') UX.onGameUpdate(gs);
      if (typeof Tooltips !== 'undefined') Tooltips.refreshDynamic(gs);
      return;
    }
    const gs = Game.getState();
    const key = hudKey(gs);
    if (!force && key === lastHudKey) {
      lastHudRevision = hudRev;
      updateHudMeters(gs);
      if (gs.creativeMode && typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
      if (typeof UX !== 'undefined') UX.onGameUpdate(gs);
      if (typeof Tooltips !== 'undefined') Tooltips.refreshDynamic(gs);
      return;
    }
    lastHudKey = key;
    lastHudRevision = hudRev;

    const armyEl = hudEls['army-text'];
    if (armyEl) armyEl.textContent = String(gs.army ?? 0);
    const eco = gs.settlementTpBonus ?? 0;
    const tpRoundEl = hudEls['tp-round-text'];
    if (tpRoundEl) {
      tpRoundEl.textContent =
        eco > 0
          ? `+${gs.tpPerRound ?? TP_PER_ROUND} (${eco}▲)`
          : `+${gs.tpPerRound ?? TP_PER_ROUND}`;
    }

    const waveText = hudEls['wave-text'];
    const waveFill = hudEls['wave-fill'];
    const armyText = hudEls['army-text'];
    if (waveText) {
      const land =
        (gs.territoryTier ?? 0) > 0
          ? ` · Land ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][gs.territoryTier] || gs.territoryTier}`
          : '';
      waveText.textContent = gs.infiniteWaves
        ? `${gs.wave}${land}`
        : `${gs.wave} / ${gs.totalWaves}${land}`;
    }
    updateHudMeters(gs);
    if (armyText) armyText.textContent = String(gs.army ?? 0);

    const cycleText = hudEls['cycle-text'];
    const beginDayBtn = hudEls['begin-day-btn'];
    if (cycleText) {
      if (gs.timeOfDay === 'night') {
        const sec = gs.nightSecondsLeft ?? 0;
        const m = Math.floor(sec / 60);
        const s = String(sec % 60).padStart(2, '0');
        cycleText.textContent = `Night ${m}:${s}`;
        cycleText.className = 'stat-value cycle-night' + (sec <= 15 ? ' cycle-urgent' : '');
        cycleText.title =
          'Night prep — no enemy spawns, +35% build speed. Press D to begin day early.';
      } else {
        const light = gs.dayLight ?? 1;
        cycleText.textContent = light < 0.72 ? 'Dusk' : 'Day';
        cycleText.className = light < 0.72 ? 'stat-value cycle-dusk' : 'stat-value cycle-day';
      }
    }
    if (beginDayBtn) {
      const night = gs.timeOfDay === 'night';
      beginDayBtn.style.display = night ? '' : 'none';
      if (night) {
        const sec = gs.nightSecondsLeft ?? 0;
        const m = Math.floor(sec / 60);
        const t = `${m}:${String(sec % 60).padStart(2, '0')}`;
        if (!beginDayBtn._timeEl) {
          beginDayBtn.innerHTML =
            '<span class="bd-label">Begin Day</span><span class="bd-time"></span>' +
            '<kbd class="bd-key" aria-hidden="true"></kbd>' +
            '<span class="night-prep-bar" aria-hidden="true"></span>';
          beginDayBtn._timeEl = beginDayBtn.querySelector('.bd-time');
          beginDayBtn._keyEl = beginDayBtn.querySelector('.bd-key');
          beginDayBtn._barEl = beginDayBtn.querySelector('.night-prep-bar');
        }
        if (beginDayBtn._timeEl.textContent !== t) beginDayBtn._timeEl.textContent = t;
        const key = shortKey(
          typeof Hotkeys !== 'undefined' ? Hotkeys.keyFor('night', 'beginDay') : 'd'
        );
        if (beginDayBtn._keyEl.textContent !== key) beginDayBtn._keyEl.textContent = key;
        beginDayBtn.setAttribute('aria-label', `Begin the day now. The night ends in ${t}`);
        beginDayBtn.classList.toggle('begin-day-urgent', sec <= 15);
        beginDayBtn.classList.toggle('begin-day-ready', sec > 15);
        const maxSec = Math.max(
          1,
          gs.nightPrepSeconds || Math.ceil((gs.nightPrepTicks || 3600) / 60) || 60
        );
        const pct = Math.max(0, Math.min(100, (sec / maxSec) * 100));
        beginDayBtn._barEl.style.width = `${pct}%`;
      } else {
        beginDayBtn.classList.remove('begin-day-urgent', 'begin-day-ready');
      }
    }

    // Army upkeep and breaches: the two numbers that decide what a recruit costs and
    // whether the realm falls.
    const upkeepEl = hudEls['upkeep-text'];
    if (upkeepEl) {
      const pct = Availability.deployPrice('footman', gs).upkeepPct;
      const text = pct > 0 ? `recruits +${pct}%` : 'no upkeep';
      if (upkeepEl.textContent !== text) upkeepEl.textContent = text;
      upkeepEl.classList.toggle('raised', pct > 0);
    }
    const breachHud = hudEls['breach-hud'];
    if (breachHud) {
      const sl = gs.siegeLoop || {};
      const n = sl.breaches || 0;
      const limit = Math.max(1, sl.breachLimit || 10);
      const chip = document.getElementById('siege-breaches');
      const show = chip ? !chip.hidden : !gs.creativeMode && (gs.wave || 0) >= 2;
      breachHud.hidden = !show || gs.state !== 'playing';
      const key = `${n}/${limit}`;
      if (breachHud.dataset.key !== key) {
        const changed = breachHud.dataset.key != null && n > (breachHud._n || 0);
        breachHud.dataset.key = key;
        breachHud._n = n;
        hudEls['breach-text'].textContent = key;
        const pips = hudEls['breach-pips'];
        if (limit <= 14) {
          let html = '';
          for (let i = 0; i < limit; i++) {
            html += `<span class="pip${i < n ? ' on' : ''}"></span>`;
          }
          pips.innerHTML = html;
          pips.hidden = false;
        } else {
          pips.hidden = true;
        }
        const left = limit - n;
        breachHud.classList.toggle('danger', n > 0 && left <= 1);
        breachHud.setAttribute(
          'aria-label',
          `Breaches ${n} of ${limit}. ${left <= 0 ? 'The realm has fallen.' : `${left} more and the realm falls.`}`
        );
        if (changed) {
          breachHud.classList.remove('hit');
          void breachHud.offsetWidth;
          breachHud.classList.add('hit');
        }
      }
    }

    // Kill streak chip
    const streakHud = document.getElementById('streak-hud');
    const streakText = document.getElementById('streak-text');
    const streak = gs.feedback?.killStreak || 0;
    if (streakHud && streakText) {
      if (streak >= 2 && gs.timeOfDay !== 'night') {
        streakHud.style.display = '';
        streakText.textContent = String(streak);
        streakHud.classList.toggle('streak-hot', streak >= 5);
        streakHud.classList.toggle('streak-god', streak >= 12);
      } else {
        streakHud.style.display = 'none';
      }
    }

    // Night prep card — short scannable brief (no intel wall-of-text)
    const nightCard = document.getElementById('night-prep-card');
    if (nightCard) {
      if (gs.state === 'playing' && gs.timeOfDay === 'night' && !gs.paused) {
        nightCard.hidden = false;
        const timer = document.getElementById('night-prep-card-timer');
        const chipsEl = document.getElementById('night-prep-card-chips');
        const tipEl = document.getElementById('night-prep-card-tip');
        const sec = gs.nightSecondsLeft ?? 0;
        if (timer) {
          const m = Math.floor(sec / 60);
          const s = String(sec % 60).padStart(2, '0');
          timer.textContent = `${m}:${s}`;
          timer.classList.toggle('urgent', sec <= 15);
        }
        if (chipsEl) {
          const chips = buildNightPrepChips(gs);
          chipsEl.innerHTML = chips
            .map((c) => {
              const label = String(c.label || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
              const kind = c.kind ? ` night-chip-${c.kind}` : '';
              return `<span class="night-prep-chip${kind}">${label}</span>`;
            })
            .join('');
        }
        if (tipEl) {
          const tip = (gs.feedback?.nightTips || []).find((t) => t?.text && t.id !== 'intel');
          tipEl.textContent = tip?.text
            ? `${tip.icon || '•'} ${tip.text}`
            : '• Reposition · spend TP · D when ready';
        }
        nightCard.classList.toggle('night-prep-urgent', sec <= 15);
      } else {
        nightCard.hidden = true;
      }
    }

    const cmdText = hudEls['cmd-text'];
    const asym = gs.asymmetricWarfare;
    if (cmdText) {
      const cmdKey = asym
        ? `${asym.playerMacro}|${asym.playerMicro}|${asym.balance}|${asym.playerRole?.name}`
        : `${gs.generalBuff}|${gs.hasGeneral}|${gs.generalStationed}`;
      if (cmdKey !== lastCmdKey) {
        lastCmdKey = cmdKey;
        if (asym) {
          cmdText.textContent = `${asym.playerMacro} · ${asym.playerMicro}`;
          cmdText.className =
            'stat-value cmd-value' +
            (asym.balance === 'player_advantage'
              ? ' cmd-active'
              : asym.balance === 'host_advantage'
                ? ' cmd-pressured'
                : '');
          cmdText.title = `${asym.playerRole.name} — Macro: ${asym.playerRole.macro}\nMicro: ${asym.playerRole.micro}`;
        } else if (gs.generalBuff > 0) {
          cmdText.textContent = `${gs.generalBuff}%`;
          cmdText.className = 'stat-value cmd-value cmd-active';
          cmdText.title = '';
        } else if (gs.hasGeneral) {
          cmdText.textContent = gs.generalStationed ? '—' : '→ KEEP';
          cmdText.className = 'stat-value cmd-value cmd-march';
          cmdText.title = '';
        } else {
          cmdText.textContent = '—';
          cmdText.className = 'stat-value cmd-value';
          cmdText.title = '';
        }
      }
    }

    const diffText = hudEls['diff-text'];
    if (diffText) {
      const pct = gs.difficultyPercent ?? 100;
      if (gs.creativeMode) {
        diffText.textContent = `Creative · ${gs.difficultyLabel ?? 'Normal'} ${pct}%`;
        diffText.className = 'stat-value diff-value diff-creative';
      } else {
        diffText.textContent = `${gs.difficultyLabel ?? 'Normal'} ${pct}%`;
        diffText.className = 'stat-value diff-value diff-' + (gs.difficulty ?? 'normal');
      }
    }
    const advPct = hudEls['advanced-diff-pct'];
    if (advPct) advPct.textContent = `Effective: ${gs.difficultyPercent ?? 100}%`;

    if (typeof Achievements !== 'undefined') Achievements.updateTopBar();

    updateButtonStates(gs);
    // The bar's scale (the dearest thing on offer) was just recomputed.
    Availability.renderTp({ text: hudEls['tp-text'], fill: hudEls['tp-fill'] }, gs, tpBarMax);

    // Early waves: hide the long-run meta chips so the top bar shows only what matters now.
    const hudEarly = !gs.creativeMode && (gs.wave || 0) < 10;
    if (hudEarly !== lastHudEarly) {
      lastHudEarly = hudEarly;
      document.body.classList.toggle('hud-early', hudEarly);
    }

    const msgBox = hudEls['message-box'];
    if (msgBox) {
      const msgText = gs.messages.length > 0 ? gs.messages[gs.messages.length - 1].text : '';
      if (msgText !== lastMessageText) {
        lastMessageText = msgText;
        if (msgText) {
          msgBox.textContent = msgText;
          msgBox.classList.add('show');
        } else {
          msgBox.classList.remove('show');
        }
      }
    }

    if (typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
    if (typeof UX !== 'undefined') UX.onGameUpdate(gs);
    if (typeof Tooltips !== 'undefined') Tooltips.refreshDynamic(gs);
  }

  return {
    init,
    updateHUD,
    updateSpeedControl,
    refreshPanelIcons,
    hideMenusForPlay,
    setLaunchOverlayVisible,
    revealSelection,
    selectItem,
    setCursorState,
    toggleKeySheet,
    isKeySheetOpen,
    closeKeySheet,
    ensureMenuDismissedForPlay,
    showMainMenu,
    getSelectedDifficulty: () => selectedDifficulty,
    setSelectedDifficulty: updateDifficultyUI,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.UI = UI;
