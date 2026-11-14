/**
 * Phone and small-tablet layout. css/mobile.css restyles the existing HUD containers by id
 * inside one media query; this module adds what the desktop HUD has no element for: a
 * one-row status strip, a bottom action bar, sheet open/close state for the two side
 * panels, a "more" sheet that forwards to the desktop top-bar buttons, and a context bar
 * for placing (place more, cancel) and for a selection (re-site a mine, deselect).
 *
 * It never rebuilds the side panels. Buttons here forward a click to the desktop control
 * with the same job, so rules stay in one place (js/ui.js).
 */
const MobileUI = (() => {
  /** Must match the media query that wraps every rule in css/mobile.css. */
  const QUERY = '(max-width: 820px), (max-height: 520px), (pointer: coarse) and (max-width: 1100px)';
  /** Short landscape: the strip and the bar move to the sides, the field keeps the height. */
  const SHORT_QUERY = '(max-height: 520px) and (orientation: landscape)';
  const SYNC_MS = 200;

  let active = false;
  let built = false;
  let mql = null;
  let shortMql = null;
  let syncTimer = null;
  let insets = null;
  let placeMore = false;
  let selectMode = false;
  let mineMode = false;
  let wasArmed = false;
  let lastSig = '';
  const els = {};

  const root = () => document.documentElement;
  const byId = (id) => document.getElementById(id);

  function isActive() {
    return active;
  }

  function make(tag, attrs, text) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  }

  function button(id, label, title, onTap) {
    const b = make('button', { id, type: 'button', class: 'm-btn', title }, label);
    b.addEventListener('click', onTap);
    return b;
  }

  /** Click the desktop control with this id (hidden on phones, still wired by js/ui.js). */
  function forward(id) {
    const target = byId(id);
    if (!target || target.disabled) return false;
    target.click();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  function build() {
    if (built) return;
    const app = byId('app');
    if (!app) return;
    built = true;

    // Status strip: phase and wave, TP, army, breaches, pause, more.
    const hud = make('div', { id: 'm-hud', role: 'status' });
    els.phase = make('span', { id: 'm-phase', class: 'm-stat' });
    els.tp = make('span', { id: 'm-tp', class: 'm-stat', title: 'Tactical points' });
    els.army = make('span', { id: 'm-army', class: 'm-stat', title: 'Soldiers on the field' });
    els.breach = make('span', {
      id: 'm-breach',
      class: 'm-stat',
      title: 'Enemies that got through, of the number the realm survives',
    });
    els.pause = button('m-pause', '⏸', 'Pause', () => forward('top-pause-btn'));
    els.pause.setAttribute('aria-label', 'Pause menu');
    els.more = button('m-more-btn', '☰', 'More', () => toggleSheet('more'));
    els.more.setAttribute('aria-label', 'More: speed, settings, sound, log');
    const spacer = make('span', { class: 'm-spacer' });
    hud.append(els.phase, els.tp, els.army, els.breach, spacer, els.pause, els.more);

    // Bottom bar: the two sheets, Hunt, Hold, box-select.
    const bar = make('div', { id: 'm-bar' });
    els.armyBtn = button('m-open-left', 'ARMY', 'Troops, buildings and spells', () =>
      toggleSheet('left')
    );
    els.hunt = button('m-hunt', 'HUNT', 'Hunt: release Hold for the selection, or everyone', () =>
      forward('hunt-toggle')
    );
    els.hold = button('m-hold', 'HOLD', 'Hold: the selection, or everyone, stays put', () =>
      forward('hold-here')
    );
    els.select = button(
      'm-select',
      'SELECT',
      'Drag a box on the field to select soldiers',
      () => setSelectMode(!selectMode)
    );
    els.select.setAttribute('aria-pressed', 'false');
    els.opsBtn = button('m-open-right', 'OPS', 'Spies, couriers and intel', () =>
      toggleSheet('right')
    );
    bar.append(els.armyBtn, els.hunt, els.hold, els.select, els.opsBtn);

    // Thumb button: Begin Day at night, game speed by day.
    els.primary = button('m-primary', 'BEGIN DAY', 'Start the assault now', () => {
      if (els.primary.dataset.mode === 'day') forward('speed-toggle');
      else forward('begin-day-btn');
      sync();
    });

    // Context bar: placing, or a selection.
    const ctx = make('div', { id: 'm-ctx', hidden: '' });
    els.ctx = ctx;
    els.ctxLabel = make('span', { id: 'm-ctx-label' });
    els.placeMore = button(
      'm-place-more',
      'PLACE MORE',
      'Keep this armed after each one is placed',
      () => setPlaceMore(!placeMore)
    );
    els.placeMore.setAttribute('aria-pressed', 'false');
    els.rotate = button('m-rotate', 'TURN', 'Turn the wall before placing', () =>
      forward('rotate-wall-btn')
    );
    els.mine = button(
      'm-mine',
      'MOVE MINE',
      'Then tap the field: the nearest Sapper re-sites one of his mines there (night only)',
      () => setMineMode(!mineMode)
    );
    els.mine.setAttribute('aria-pressed', 'false');
    els.cancel = button('m-cancel', 'CANCEL', 'Cancel', cancelContext);
    ctx.append(els.ctxLabel, els.placeMore, els.rotate, els.mine, els.cancel);

    // More sheet: forwards to the desktop top-bar buttons.
    const more = make('div', { id: 'm-more', role: 'dialog', 'aria-label': 'More' });
    els.moreSheet = more;
    const moreItems = [
      ['speed-toggle', 'SPEED', 'Game speed', true],
      ['top-settings-btn', 'SETTINGS', 'Settings'],
      ['sound-toggle', 'SOUND', 'Sound on or off', true],
      ['hint-log-btn', 'MESSAGE LOG', 'Message history'],
      ['encyclopedia-btn', 'ENCYCLOPEDIA', 'Encyclopedia'],
      ['faction-intel-btn', 'THREAT MAP', 'Faction intel'],
      ['achievements-btn', 'ACHIEVEMENTS', 'Achievements'],
      ['research-open', 'RESEARCH', 'Research'],
    ];
    els.moreBtns = {};
    for (const [target, label, title, stay] of moreItems) {
      const b = button(`m-more-${target}`, label, title, () => {
        forward(target);
        if (!stay) closeSheets();
        sync();
      });
      els.moreBtns[target] = b;
      more.append(b);
    }
    more.append(
      button('m-more-centre', 'WHOLE FIELD', 'Show the whole field', () => {
        showWholeField();
        closeSheets();
      })
    );

    els.scrim = make('div', { id: 'm-scrim' });
    els.scrim.addEventListener('click', closeSheets);

    app.append(hud, bar, els.primary, ctx, els.scrim, more);

    // Sheet heads for the two side panels: a title and a close button.
    addSheetHead('left-panel', 'ARMY');
    addSheetHead('right-panel', 'OPS');

    // Picking something to place closes the sheet so the field is in view.
    for (const id of ['left-panel', 'right-panel']) {
      byId(id)?.addEventListener('click', () => setTimeout(sync, 0));
    }
  }

  function addSheetHead(panelId, title) {
    const panel = byId(panelId);
    if (!panel || panel.querySelector(':scope > .m-sheet-head')) return;
    const head = make('div', { class: 'm-sheet-head' });
    head.append(make('span', { class: 'm-sheet-title' }, title));
    const close = make(
      'button',
      { type: 'button', class: 'm-btn m-sheet-close', 'aria-label': 'Close', title: 'Close' },
      '✕'
    );
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSheets();
    });
    head.append(close);
    panel.prepend(head);
  }

  // ---------------------------------------------------------------------------
  // Sheets
  // ---------------------------------------------------------------------------

  const SHEETS = ['left', 'right', 'more'];

  function openSheet(name) {
    for (const s of SHEETS) root().classList.toggle(`m-sheet-${s}`, s === name);
    root().classList.toggle('m-sheet-open', SHEETS.includes(name));
  }

  function closeSheets() {
    openSheet(null);
  }

  function toggleSheet(name) {
    openSheet(root().classList.contains(`m-sheet-${name}`) ? null : name);
  }

  function openSheetName() {
    return SHEETS.find((s) => root().classList.contains(`m-sheet-${s}`)) || null;
  }

  // ---------------------------------------------------------------------------
  // Modes read by the touch handlers in js/main.js
  // ---------------------------------------------------------------------------

  function setPlaceMore(on) {
    placeMore = !!on;
    els.placeMore?.setAttribute('aria-pressed', String(placeMore));
  }

  function setSelectMode(on) {
    selectMode = !!on;
    els.select?.setAttribute('aria-pressed', String(selectMode));
    if (selectMode) closeSheets();
  }

  function setMineMode(on) {
    mineMode = !!on;
    els.mine?.setAttribute('aria-pressed', String(mineMode));
  }

  function isPlaceMore() {
    return active && placeMore;
  }

  function isSelectMode() {
    return active && selectMode;
  }

  function isMineMode() {
    return active && mineMode;
  }

  /** A box-select finished: the toggle is one use, so the next drag pans again. */
  function onBoxSelectDone() {
    setSelectMode(false);
    sync();
  }

  function armed(gs) {
    return !!(
      gs.selectedBuild ||
      gs.selectedDeploy ||
      gs.selectedAbility ||
      gs.selectedDemolish ||
      gs.selectedMoveBuilding ||
      gs.selectedRotateWall ||
      gs.selectedCourierMsg
    );
  }

  function cancelContext() {
    if (typeof Game === 'undefined') return;
    const gs = Game.getState();
    if (armed(gs)) Game.clearPlacementMode?.();
    else Game.clearSelection?.();
    setMineMode(false);
    if (typeof UI !== 'undefined') UI.updateHUD?.(true);
    sync();
  }

  /** Reset the camera to the whole field, centred. */
  function showWholeField() {
    if (typeof Game === 'undefined' || !Game.isPlaying?.()) return;
    const c = byId('game-canvas');
    Game.zoomCameraToScale?.(c.width / 2, c.height / 2, 1);
    Game.panCameraToFraction?.(0.5, 0.5);
  }

  // ---------------------------------------------------------------------------
  // Field insets: the part of the canvas the HUD covers
  // ---------------------------------------------------------------------------

  function measureInsets() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const hud = byId('m-hud')?.getBoundingClientRect();
    const bar = byId('m-bar')?.getBoundingClientRect();
    if (!hud || !bar || !hud.width || !bar.width) return { left: 0, right: 0, top: 52, bottom: 64 };
    if (shortMql?.matches) {
      // Strip down the left edge, bar down the right.
      return {
        left: Math.round(hud.right),
        right: Math.round(w - bar.left),
        top: 0,
        bottom: 0,
      };
    }
    return { left: 0, right: 0, top: Math.round(hud.bottom), bottom: Math.round(h - bar.top) };
  }

  /** Called by Settings.getPanelInsets() while the phone layout is on. */
  function getPanelInsets() {
    if (!insets) insets = measureInsets();
    return insets;
  }

  function relayout() {
    insets = null;
    if (typeof Game !== 'undefined') Game.onSettingsChanged?.();
  }

  // ---------------------------------------------------------------------------
  // Sync: copy live state into the strip, the bar and the context bar
  // ---------------------------------------------------------------------------

  function label(type) {
    if (!type) return '';
    const def =
      (typeof UnitDefs !== 'undefined' && UnitDefs[type]) ||
      (typeof BuildDefs !== 'undefined' && BuildDefs[type]);
    const name = def?.name || def?.label || String(type).replace(/_/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function show(node, on) {
    if (node && node.hidden === !!on) node.hidden = !on;
  }

  function selectedSapperAtNight(gs) {
    if (gs.timeOfDay !== 'night') return false;
    const ids = gs.selectedUnitIds?.length
      ? gs.selectedUnitIds
      : gs.selectedUnitId
        ? [gs.selectedUnitId]
        : [];
    if (!ids.length) return false;
    const units = Game.getUnitsSnapshot?.() || [];
    return units.some((u) => ids.includes(u.id) && /sapper/.test(String(u.type)));
  }

  function sync() {
    if (!active || !built || typeof Game === 'undefined') return;
    const playing = !!Game.isPlaying?.();
    root().classList.toggle('m-playing', playing);
    if (!playing) {
      if (openSheetName()) closeSheets();
      return;
    }
    const gs = Game.getState();
    const night = gs.timeOfDay === 'night';
    root().classList.toggle('m-night', night);

    const cycle = byId('cycle-text')?.textContent?.trim() || (night ? 'NIGHT' : 'DAY');
    setText(els.phase, `W${gs.wave ?? 0} · ${cycle}`);
    setText(els.tp, `${Math.floor(gs.tactical ?? 0)} TP`);
    setText(els.army, `⚔ ${gs.army ?? 0}`);
    const siege = gs.siegeLoop;
    const chip = byId('siege-breaches');
    const showBreach = !!siege && !(chip && chip.hidden);
    show(els.breach, showBreach);
    if (showBreach) {
      setText(els.breach, `☠ ${siege.breaches}/${siege.breachLimit}`);
      els.breach.classList.toggle('danger', siege.breaches >= siege.breachLimit - 1);
    }

    setText(els.hold, gs.heldCount ? `HOLD · ${gs.heldCount}` : 'HOLD');

    // Begin Day at night; by day the same spot cycles game speed.
    const begin = byId('begin-day-btn');
    const canBegin = night && begin && begin.style.display !== 'none';
    els.primary.dataset.mode = canBegin ? 'night' : 'day';
    setText(els.primary, canBegin ? 'BEGIN DAY' : `${gs.gameSpeed || 1}×`);
    els.primary.title = canBegin ? 'Start the assault now' : 'Game speed';

    const speed = byId('speed-toggle')?.textContent?.trim();
    if (speed) setText(els.moreBtns['speed-toggle'], speed);
    const snd = byId('sound-toggle')?.textContent?.trim();
    setText(els.moreBtns['sound-toggle'], snd === '🔇' ? 'SOUND: OFF' : 'SOUND: ON');

    // Context bar.
    const isArmed = armed(gs);
    const selCount = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    const placing = !!(gs.selectedDeploy || gs.selectedBuild);
    if (isArmed && !wasArmed) closeSheets();
    if (!isArmed && wasArmed) setPlaceMore(false);
    wasArmed = isArmed;
    const sapper = !isArmed && selCount > 0 && selectedSapperAtNight(gs);
    if (!sapper && mineMode) setMineMode(false);

    let text = '';
    if (gs.selectedDeploy) text = `Place: ${label(gs.selectedDeploy)}`;
    else if (gs.selectedBuild) text = `Build: ${label(gs.selectedBuild)}`;
    else if (gs.selectedAbility) text = 'Tap a target';
    else if (gs.selectedDemolish) text = 'Tap a building to demolish';
    else if (gs.selectedMoveBuilding) text = 'Tap a building, then its new spot';
    else if (gs.selectedRotateWall) text = 'Tap a wall to turn it';
    else if (gs.selectedCourierMsg) text = 'Tap where to send it';
    else if (mineMode) text = 'Tap where the mine goes';
    else if (selCount) text = selCount === 1 ? '1 selected · tap to move' : `${selCount} selected`;
    else if (selectMode) text = 'Drag a box over soldiers';

    const showCtx = isArmed || selCount > 0 || selectMode;
    show(els.ctx, showCtx);
    root().classList.toggle('m-ctx-open', showCtx);
    setText(els.ctxLabel, text);
    show(els.placeMore, placing);
    show(els.rotate, gs.selectedBuild === 'wall');
    show(els.mine, sapper);
    show(els.cancel, isArmed || selCount > 0);
    setText(els.cancel, isArmed ? 'CANCEL' : 'DESELECT');

    // A change in what covers the field edge needs the camera viewport re-measured.
    const sig = `${showBreach}|${shortMql?.matches}|${window.innerWidth}x${window.innerHeight}`;
    if (sig !== lastSig) {
      lastSig = sig;
      relayout();
    }
  }

  // ---------------------------------------------------------------------------
  // Activation
  // ---------------------------------------------------------------------------

  function blockPageZoom(e) {
    if (!active) return;
    // Safari pinch (gesture*) and any two-finger move outside the canvas handlers.
    if (e.type !== 'touchmove' || (e.touches && e.touches.length > 1)) {
      if (e.cancelable) e.preventDefault();
    }
  }

  function setActive(on) {
    on = !!on;
    if (on === active) return;
    active = on;
    root().classList.toggle('mobile-ui', active);
    if (active) {
      build();
      clearInterval(syncTimer);
      syncTimer = setInterval(sync, SYNC_MS);
      sync();
    } else {
      clearInterval(syncTimer);
      syncTimer = null;
      closeSheets();
      setSelectMode(false);
      setMineMode(false);
      setPlaceMore(false);
      root().classList.remove('m-playing', 'm-night', 'm-ctx-open');
    }
    relayout();
  }

  function init() {
    if (mql || typeof window === 'undefined' || !window.matchMedia) return;
    mql = window.matchMedia(QUERY);
    shortMql = window.matchMedia(SHORT_QUERY);
    const onChange = () => {
      setActive(mql.matches);
      requestAnimationFrame(relayout);
    };
    for (const q of [mql, shortMql]) {
      if (q.addEventListener) q.addEventListener('change', onChange);
      else if (q.addListener) q.addListener(onChange);
    }
    window.addEventListener('resize', () => {
      insets = null;
    });
    window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(type, blockPageZoom, { passive: false });
    }
    document.addEventListener('touchmove', blockPageZoom, { passive: false });
    setActive(mql.matches);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  return {
    init,
    isActive,
    getPanelInsets,
    openSheet,
    closeSheets,
    openSheetName,
    isPlaceMore,
    isSelectMode,
    isMineMode,
    setPlaceMore,
    setSelectMode,
    setMineMode,
    onBoxSelectDone,
    showWholeField,
    sync,
    QUERY,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MobileUI = MobileUI;
