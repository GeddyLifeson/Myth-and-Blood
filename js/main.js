(function () {
  const canvas = document.getElementById('game-canvas');

  // ---------------------------------------------------------------------------
  // Input configuration (pure data — hoisted out of the keydown handler so the
  // maps are built once at load instead of on every keypress).
  // ---------------------------------------------------------------------------

  /** Camera-pan directions (the keys bound to them are released on keyup whatever the state). */
  const CAMERA_PAN_DIRS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

  // Every other key lives in js/hotkeys.js: one key map per game state. The keydown
  // handler below works out the state, looks the key up there and runs HOTKEY_ACTIONS.

  // ---------------------------------------------------------------------------
  // Selection-mode predicates — previously duplicated verbatim at four sites.
  // ---------------------------------------------------------------------------

  /**
   * A placement/targeting mode is armed (build, deploy, ability, demolish,
   * move-building or wall-rotate). Right-click, Escape and touch-hold cancel these.
   */
  function isPlacementArmed(gs) {
    return !!(
      gs.selectedBuild ||
      gs.selectedDeploy ||
      gs.selectedAbility ||
      gs.selectedDemolish ||
      gs.selectedMoveBuilding ||
      gs.selectedRotateWall
    );
  }

  /** isPlacementArmed plus the courier-message targeting mode. */
  function isPlacementOrCourierArmed(gs) {
    return isPlacementArmed(gs) || !!gs.selectedCourierMsg;
  }

  /** A creative-mode tool is armed. */
  function isCreativeToolArmed(gs) {
    return !!(gs.creativeMode && gs.creativeTool);
  }

  if (typeof AudioEngine !== 'undefined') {
    AudioEngine.init?.();
    AudioEngine.bindUnlock();
  }
  if (typeof TouchInput !== 'undefined') TouchInput.init();

  async function boot() {
    if (typeof ErrorReporting !== 'undefined') ErrorReporting.init();
    if (typeof GameData !== 'undefined') {
      await (typeof ErrorReporting !== 'undefined'
        ? ErrorReporting.runGuarded('GameData.loadAll', () => GameData.loadAll(), {
            label: 'GameData.loadAll',
          })
        : GameData.loadAll());
    }
    if (typeof ModLoader !== 'undefined') {
      await (typeof ErrorReporting !== 'undefined'
        ? ErrorReporting.runGuarded('ModLoader.init', () => ModLoader.init(), {
            subsystem: 'mods',
          })
        : ModLoader.init());
    }
    Game.init(canvas);
    if (typeof Settings !== 'undefined') Settings.init();
    if (typeof ErrorReporting !== 'undefined') ErrorReporting.onSettingsReady();
    if (typeof GfxQuality !== 'undefined') GfxQuality.initFromSettings();
    if (typeof UX !== 'undefined') UX.init();
    if (typeof Perf !== 'undefined') Perf.init();
    if (typeof SaveManager !== 'undefined') SaveManager.init();
    UI.init();
    // Macro layers (GS / IG / planet map) removed — pure wave defense.

    let hudTick = 0;
    let hidden = false;
    let pointerDown = false;
    canvas.style.cursor = 'grab';

    function onAppVisible() {
      hidden = false;
      UI.refreshPanelIcons?.();
      if (Game.isPlaying()) {
        // Re-anchor fixed sim clock so tab-out time does not dump catch-up ticks.
        Game.resetSimClock?.();
        Game.onSettingsChanged?.({ soft: true });
        SpriteGen.invalidateBattlefieldCache?.();
        Game.draw?.();
      }
    }

    document.addEventListener('visibilitychange', () => {
      hidden = document.hidden;
      if (hidden) {
        if (typeof PacingTools !== 'undefined') {
          PacingTools.onVisibilityHidden({
            isPlaying: Game.isPlaying?.(),
            setPaused: (v, o) => Game.setPaused?.(v, o),
          });
        }
      } else {
        if (typeof PacingTools !== 'undefined') {
          PacingTools.onVisibilityVisible({
            setPaused: (v, o) => Game.setPaused?.(v, o),
          });
        }
        onAppVisible();
      }
    });

    window.addEventListener('focus', onAppVisible);

    const uiOverlay = document.getElementById('ui-overlay');

    function screenCoords(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        sx: (e.clientX - rect.left) * (canvas.width / rect.width),
        sy: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    /** True when a HUD element absorbed the click instead of the map (top-bar drag regions, etc.). */
    function isMapPassthroughTarget(el) {
      if (!el || el === canvas) return false;
      if (!uiOverlay?.contains(el)) return false;

      let node = el;
      while (node && node !== uiOverlay) {
        const tag = node.tagName;
        if (
          tag === 'BUTTON' ||
          tag === 'INPUT' ||
          tag === 'SELECT' ||
          tag === 'TEXTAREA' ||
          tag === 'A' ||
          tag === 'LABEL'
        ) {
          return false;
        }
        if (
          node.id === 'left-panel' ||
          node.id === 'right-panel' ||
          node.id === 'window-drag-handle'
        )
          return false;
        if (node.id === 'creative-panel' && node.style.display !== 'none') return false;
        if (node.classList?.contains('minimap-panel')) return false;
        if (node.classList?.contains('unit-info-panel') && node.classList.contains('visible'))
          return false;
        if (node.classList?.contains('message-log-panel') && node.classList.contains('open'))
          return false;
        if (node.classList?.contains('tutorial-callout') && node.classList.contains('visible'))
          return false;
        node = node.parentElement;
      }
      return true;
    }

    function handleContextMenu(e) {
      e.preventDefault();
      if (!Game.isPlaying()) return;
      const gs = Game.getState();
      if (isPlacementOrCourierArmed(gs)) {
        Game.clearPlacementMode();
        UI.updateHUD(true);
      } else if (isCreativeToolArmed(gs)) {
        Game.creativeSetTool?.(null);
        UI.updateHUD(true);
      } else if (gs.selectedUnitId || gs.selectedUnitIds?.length) {
        Game.clearSelection();
        UI.updateHUD(true);
      }
    }

    function handlePointerDownEvent(e) {
      if (e.button === 2) {
        handleContextMenu(e);
        return;
      }
      const { sx, sy } = screenCoords(e);
      const dragSlop = typeof TouchInput !== 'undefined' ? TouchInput.getDragThreshold() : 14;
      if (e.button === 1) {
        e.preventDefault();
        pointerDown = true;
        Game.handlePointerDown(sx, sy, 0, { pan: true, dragThreshold: dragSlop });
        return;
      }
      if (e.button !== 0) return;
      pointerDown = true;
      const boxSelect = e.shiftKey;
      const additive = e.ctrlKey || e.metaKey;
      Game.handlePointerDown(sx, sy, 0, {
        boxSelect,
        additive,
        emptyDragSelect: true,
        dragThreshold: dragSlop,
      });
    }

    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('mousedown', handlePointerDownEvent);

    if (uiOverlay) {
      uiOverlay.addEventListener('contextmenu', (e) => {
        if (!isMapPassthroughTarget(e.target)) return;
        handleContextMenu(e);
      });
      uiOverlay.addEventListener('mousedown', (e) => {
        if (!isMapPassthroughTarget(e.target)) return;
        handlePointerDownEvent(e);
      });
    }

    function trackMapPointer(e) {
      if (!Game.isPlaying()) return;
      const { sx, sy } = screenCoords(e);
      Game.trackPointer?.(sx, sy);
    }

    function clearMapPointer() {
      Game.trackPointer?.(-1, -1);
    }

    canvas.addEventListener('mousemove', (e) => {
      trackMapPointer(e);
      if (!pointerDown) return;
      const { sx, sy } = screenCoords(e);
      Game.handlePointerMove(sx, sy);
    });
    canvas.addEventListener('mouseleave', clearMapPointer);

    if (uiOverlay) {
      uiOverlay.addEventListener('mousemove', (e) => {
        if (!isMapPassthroughTarget(e.target)) return;
        trackMapPointer(e);
      });
      uiOverlay.addEventListener('mouseleave', clearMapPointer);
    }

    window.addEventListener('mousemove', (e) => {
      if (!pointerDown) return;
      const { sx, sy } = screenCoords(e);
      Game.handlePointerMove(sx, sy);
    });

    window.addEventListener('mouseup', (e) => {
      if (!pointerDown) return;
      if (e.button !== 0 && e.button !== 1) return;
      pointerDown = false;
      const wasClick = Game.handlePointerUp();
      if (wasClick && e.button === 0) {
        const { sx, sy } = screenCoords(e);
        const armedBefore = Game.getState();
        const wasPlacing = !!(armedBefore.selectedDeploy || armedBefore.selectedBuild);
        Game.handleClick(sx, sy, {
          selectSameType: e.shiftKey,
          shiftKey: e.shiftKey,
          repeatDeploy: e.shiftKey,
          toggleSelection: e.ctrlKey || e.metaKey,
        });
        // Shift-click kept a troop or building armed: releasing Shift will put it away.
        const armedAfter = Game.getState();
        shiftRepeatArmed =
          wasPlacing && e.shiftKey && !!(armedAfter.selectedDeploy || armedAfter.selectedBuild);
        UI.updateHUD(true);
      }
    });

    function isModalWheelTarget(el) {
      if (el?.closest?.('.screen.active')) return true;
      if (el?.closest?.('#spoils-panel, #key-sheet, .inpage-dialog')) return true;
      const creative = el?.closest?.('#creative-panel');
      if (creative && creative.style.display !== 'none') return true;
      return false;
    }

    /** Wheel distance in pixels whatever unit the device reports. */
    function wheelPixels(e, scroller) {
      if (e.deltaMode === 1) return e.deltaY * 32;
      if (e.deltaMode === 2) return e.deltaY * scroller.clientHeight * 0.9;
      return e.deltaY;
    }

    /**
     * The wheel over a side panel scrolls that panel and never the field, wherever in the
     * panel the pointer is (tabs, headers, gaps) and whether or not it can scroll further.
     */
    function handleSidePanelWheel(e, sidePanel) {
      const scroller = sidePanel.querySelector('.side-panel-scroll');
      if (!scroller) return;
      sidePanel._userScrollAt = performance.now();
      // Inside the scroll area the browser scrolls it (and any nested list) itself.
      if (e.target?.closest?.('.side-panel-scroll') === scroller) return;
      e.preventDefault();
      scroller.scrollTop += wheelPixels(e, scroller);
    }

    function handleWheelEvent(e) {
      if (!Game.isPlaying()) return;
      if (isModalWheelTarget(e.target)) return;

      const sidePanel = e.target?.closest?.('#left-panel, #right-panel');
      if (sidePanel) {
        handleSidePanelWheel(e, sidePanel);
        return;
      }

      const { sx, sy } = screenCoords(e);
      if (!Game.isScreenInMapArea?.(sx, sy) && e.deltaY < 0) return;

      e.preventDefault();
      Game.zoomCameraAt(sx, sy, e.deltaY);
    }

    window.addEventListener('wheel', handleWheelEvent, { passive: false, capture: true });

    let touchHoldTimer = null;
    let touchDownAt = 0;
    let touchHoldStart = null;
    let pinchActive = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    function clearTouchHold() {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
      touchHoldStart = null;
    }

    function touchSpan(touches) {
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function touchMidScreen(touches) {
      const a = touches[0];
      const b = touches[1];
      return screenCoords({
        clientX: (a.clientX + b.clientX) / 2,
        clientY: (a.clientY + b.clientY) / 2,
      });
    }

    function beginPinch(touches) {
      clearTouchHold();
      if (pointerDown) {
        Game.handlePointerUp();
        pointerDown = false;
      }
      pinchActive = true;
      pinchStartDist = touchSpan(touches);
      pinchStartZoom = Game.getCameraZoom?.() ?? 1;
    }

    function endPinch() {
      pinchActive = false;
      pinchStartDist = 0;
      pinchStartZoom = 1;
    }

    function handlePinchMove(e) {
      if (!pinchActive || e.touches.length !== 2 || !Game.isPlaying()) return false;
      e.preventDefault();
      if (pinchStartDist < 8) return true;
      const dist = touchSpan(e.touches);
      const { sx, sy } = touchMidScreen(e.touches);
      Game.zoomCameraToScale(sx, sy, pinchStartZoom * (dist / pinchStartDist));
      return true;
    }

    function handleTouchStart(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        beginPinch(e.touches);
        return;
      }
      if (e.touches.length !== 1 || pinchActive) return;
      e.preventDefault();
      const t = e.touches[0];
      const { sx, sy } = screenCoords(t);
      pointerDown = true;
      touchDownAt = Date.now();
      const dragSlop = typeof TouchInput !== 'undefined' ? TouchInput.getDragThreshold() : 14;
      Game.handlePointerDown(sx, sy, 0, { pan: true, dragThreshold: dragSlop });
      clearTouchHold();
      if (Game.isPlaying()) {
        const gs = Game.getState();
        const armed = isPlacementArmed(gs) || isCreativeToolArmed(gs);
        if (armed) {
          touchHoldStart = { x: t.clientX, y: t.clientY };
          touchHoldTimer = setTimeout(() => {
            if (isPlacementArmed(gs)) {
              Game.clearPlacementMode();
            } else if (isCreativeToolArmed(gs)) {
              Game.creativeSetTool?.(null);
            }
            clearTouchHold();
            UI.updateHUD(true);
          }, 520);
        }
      }
    }

    function handleTouchMove(e) {
      if (handlePinchMove(e)) return;
      if (!pointerDown || e.touches.length !== 1 || pinchActive) return;
      e.preventDefault();
      const t = e.touches[0];
      if (
        touchHoldStart &&
        Math.hypot(t.clientX - touchHoldStart.x, t.clientY - touchHoldStart.y) > 16
      ) {
        clearTouchHold();
      }
      const { sx, sy } = screenCoords(t);
      Game.handlePointerMove(sx, sy);
    }

    function handleTouchEnd(e) {
      if (pinchActive && e.touches.length < 2) {
        endPinch();
        return;
      }
      clearTouchHold();
      if (!pointerDown) return;
      pointerDown = false;
      const wasClick = Game.handlePointerUp();
      if (wasClick && e.changedTouches[0]) {
        const t = e.changedTouches[0];
        const { sx, sy } = screenCoords(t);
        // A long press on the ground is the touch form of Shift + click: go there and hold.
        Game.handleClick(sx, sy, { touch: true, hold: Date.now() - touchDownAt >= 450 });
        UI.updateHUD(true);
      }
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    if (uiOverlay) {
      uiOverlay.addEventListener(
        'touchstart',
        (e) => {
          if (!isMapPassthroughTarget(e.target)) return;
          handleTouchStart(e);
        },
        { passive: false }
      );
      uiOverlay.addEventListener(
        'touchmove',
        (e) => {
          if (!isMapPassthroughTarget(e.target) && !pinchActive) return;
          handleTouchMove(e);
        },
        { passive: false }
      );
      uiOverlay.addEventListener(
        'touchend',
        (e) => {
          if (!isMapPassthroughTarget(e.target) && !pinchActive) return;
          handleTouchEnd(e);
        },
        { passive: false }
      );
    }

    function isTypingTarget() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    /** Soldiers selected right now. */
    function selectionCount(gs) {
      return gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    }

    /** Which key map applies this instant (see Hotkeys.stateOf for the precedence). */
    function hotkeyState() {
      const gs = Game.getState();
      const playing = Game.isPlaying();
      return Hotkeys.stateOf({
        playing,
        ended: gs.state === 'victory' || gs.state === 'defeat',
        spoils: playing && SiegeLoop.isSpoilsHeld(),
        paused: playing && !!gs.paused,
        placingWall: gs.selectedBuild === 'wall',
        placing:
          (isPlacementOrCourierArmed(gs) && !gs.moveBuildingTarget) || isCreativeToolArmed(gs),
        units: playing ? selectionCount(gs) : 0,
        building: !!gs.moveBuildingTarget,
        creative: !!Game.isCreativeMode?.(),
        night: gs.timeOfDay === 'night',
      });
    }

    /** Close the topmost open panel. True when something was closed. */
    function closeTopPanel() {
      if (UI.isKeySheetOpen?.()) {
        UI.closeKeySheet();
        return true;
      }
      const logPanel = document.getElementById('message-log-panel');
      if (logPanel?.classList.contains('open')) {
        logPanel.classList.remove('open');
        return true;
      }
      if (typeof Settings !== 'undefined' && Settings.isOpen()) {
        Settings.close();
        return true;
      }
      if (typeof Encyclopedia !== 'undefined' && Encyclopedia.isOpen()) {
        Encyclopedia.close();
        return true;
      }
      if (typeof FactionIntel !== 'undefined' && FactionIntel.isPanelOpen()) {
        FactionIntel.closePanel();
        return true;
      }
      return false;
    }

    function spoilCards() {
      return [...document.querySelectorAll('#spoils-panel [data-spoil]')];
    }

    /** Select from the keyboard: refused with a reason when unavailable, else shown. */
    function selectByKey(kind, id) {
      if (!id) return false;
      const res = UI.selectItem(kind, id);
      if (res.ok) UI.revealSelection?.();
      return true;
    }

    /** Your living soldiers, top to bottom then left to right (the Tab order). */
    function mySoldiers() {
      return (Game.getUnitsSnapshot?.() || [])
        .filter((u) => u.team === 'player')
        .sort((a, b) => a.y - b.y || a.x - b.x || (a.id > b.id ? 1 : -1));
    }

    function cycleSoldier(gs, step) {
      const mine = mySoldiers();
      if (!mine.length) return false;
      const at = mine.findIndex((u) => u.id === gs.selectedUnitId);
      const next =
        mine[at < 0 ? (step > 0 ? 0 : mine.length - 1) : (at + step + mine.length) % mine.length];
      if (!Game.selectUnit(next.id)) return false;
      Game.focusSelection?.();
      return true;
    }

    /** Select exactly these soldiers. False when none of them is alive. */
    function selectUnits(ids) {
      let any = false;
      for (const id of ids) {
        if (Game.selectUnit(id, { addToSelection: any })) any = true;
      }
      return any;
    }

    // Control groups: Ctrl+1-9 saves the selection, the plain digit recalls it. Kept for the
    // run only (unit ids mean nothing in the next one).
    let controlGroups = {};
    let lastGroupRecalled = 0;

    function recallGroup(n) {
      const ids = controlGroups[n];
      if (!ids) return false;
      const alive = ids.filter((id) => (Game.getUnitById?.(id)?.hp || 0) > 0);
      if (!alive.length) {
        delete controlGroups[n];
        return false;
      }
      controlGroups[n] = alive;
      const sel = Game.getState().selectedUnitIds || [];
      const same = sel.length === alive.length && alive.every((id) => sel.includes(id));
      selectUnits(alive);
      // A second press on the same group centres the view on it.
      if (same && lastGroupRecalled === n) Game.focusSelection?.();
      lastGroupRecalled = n;
      return true;
    }

    function stepSpeed(step) {
      if (!Game.isPlaying()) return false;
      const options = typeof PacingTools !== 'undefined' ? PacingTools.SPEED_OPTIONS : [1, 2, 3, 4];
      const cur =
        typeof PacingTools !== 'undefined'
          ? PacingTools.normalizeSpeed(Settings.get('gameSpeed') ?? 1)
          : Settings.get('gameSpeed') || 1;
      const at = Math.max(0, options.indexOf(cur));
      const next = options[Math.max(0, Math.min(options.length - 1, at + step))];
      if (next !== cur) Game.setGameSpeed(next);
      else Game.showMessage?.(`Game speed ${cur}× (${step > 0 ? 'fastest' : 'slowest'})`, 90);
      return true;
    }

    /** What is on a panel, in panel order: the ids of its buttons. */
    function panelIds(selector, attr) {
      return [...document.querySelectorAll(selector)].map((el) => el.dataset[attr]).filter(Boolean);
    }

    /**
     * Hand the slot keys of the extra buildings, spy actions and courier messages to what
     * is unlocked (recruit slots are assigned by the HUD itself). Cheap; run before a key
     * is looked up and once a second while playing so buttons and tooltips stay current.
     */
    function refreshSlots() {
      if (typeof Availability === 'undefined' || !Game.isPlaying()) return;
      const gs = Game.getState();
      const usable = (kind) => (id) => {
        const r = Availability.check(kind, id, gs);
        return r.ok || !r.locked;
      };
      const lettered = new Set(
        Hotkeys.DEFAULTS.night.filter((b) => b.action === 'build').map((b) => b.arg)
      );
      Hotkeys.assignSlots(
        'build',
        panelIds('.build-btn[data-build]', 'build').filter((id) => !lettered.has(id)),
        usable('build')
      );
      Hotkeys.assignSlots('spy', panelIds('.spy-btn[data-spy]', 'spy'), usable('spy'));
      Hotkeys.assignSlots(
        'courier',
        panelIds('.courier-btn[data-courier]', 'courier'),
        usable('courier')
      );
    }
    /**
     * Key labels on buttons whose markup lives elsewhere: the "(H)" in a title is rewritten
     * from the key map, so it follows a rebind. Any element can opt in with
     * data-hotkey="action" or "action:arg" (and data-hotkey-state, default "night").
     */
    const KEY_TITLES = [
      ['#sound-toggle', 'mute'],
      ['#encyclopedia-btn', 'encyclopedia'],
      ['#achievements-btn', 'achievements'],
      ['#begin-day-btn', 'beginDay'],
      ['#hunt-toggle', 'hunt'],
      ['#hold-here', 'holdHere'],
      ['#speed-toggle', 'speedUp'],
      ['#hint-log-btn', 'messageLog'],
      ['#creative-panel-toggle', 'creativePanel', null, 'creative'],
      ['#creative-close-panel', 'creativePanel', null, 'creative'],
      ['#pause-report-bug-btn', 'bugReport', null, 'pause'],
      ['#siege-warcry', 'order', 'warCry'],
      ['#siege-holdline', 'order', 'holdLine'],
      ...['line', 'column', 'wedge', 'box', 'spread'].map((f) => [
        `.formation-btn[data-formation="${f}"]`,
        'formation',
        f,
        'unit_selected',
      ]),
    ];
    function syncKeyTitles() {
      const put = (el, action, arg, state) => {
        // Recomputed whenever someone else has rewritten the title since our last pass.
        if (el.dataset.keyBase == null || el.getAttribute('title') !== el.dataset.keyTitle) {
          // The first short bracket is the old key note: "(D)", "(hotkey Shift+H)", "([)".
          const bare = (el.getAttribute('title') || '').replace(
            /\s*\((?:hotkey )?[^\s()]{1,9}\)|^(?:Alt|Shift|Ctrl)\+\S+$|^F\d+$/,
            ''
          );
          el.dataset.keyBase = bare.trim();
        }
        const label = Hotkeys.labelFor(state || 'night', action, arg ?? null);
        const base = el.dataset.keyBase;
        const want = label ? (base ? `${base} (${label})` : label) : base;
        if (el.getAttribute('title') !== want) el.setAttribute('title', want);
        el.dataset.keyTitle = want;
      };
      for (const [sel, action, arg, state] of KEY_TITLES) {
        document.querySelectorAll(sel).forEach((el) => put(el, action, arg, state));
      }
      document.querySelectorAll('[data-hotkey]').forEach((el) => {
        const [action, arg] = el.dataset.hotkey.split(':');
        put(el, action, arg || null, el.dataset.hotkeyState);
      });
    }
    Hotkeys.onChange(syncKeyTitles);
    syncKeyTitles();
    setInterval(syncKeyTitles, 1500);

    Hotkeys.setNamer((kind, id) =>
      typeof Availability !== 'undefined' ? Availability.nameOf(kind, id) : id
    );
    setInterval(() => {
      if (!Game.isPlaying()) {
        controlGroups = {};
        return;
      }
      refreshSlots();
    }, 1000);

    /**
     * What each action in the key maps does. A handler returns false when the key should
     * be left to the browser (nothing happened); anything else counts as handled.
     */
    const HOTKEY_ACTIONS = {
      keySheet: () => UI.toggleKeySheet?.(hotkeyState()),
      mute: () => {
        const muted = AudioEngine.toggleMute();
        const btn = document.getElementById('sound-toggle');
        if (btn) btn.textContent = muted ? '🔇' : '🔊';
        if (typeof Settings !== 'undefined') Settings.set('muted', muted);
      },
      achievements: () => Achievements.togglePanel(),
      encyclopedia: () => Encyclopedia.togglePanel(),
      cheats: () => Cheats.togglePanel(),
      // js/perf.js listens for F3 itself; the binding exists so the key is listed and reserved.
      perf: () => false,
      bugReport: () => {
        if (typeof ErrorReporting !== 'undefined' && ErrorReporting.openBugReport) {
          ErrorReporting.openBugReport({ source: 'hotkey-f10' });
        }
      },
      pan: (key) => Game.setCameraKey(key, true),
      pause: () => Game.togglePause(),
      resume: () => {
        if (closeTopPanel()) return;
        if (typeof UX !== 'undefined') UX.closePauseMenu(true);
        else Game.togglePause();
      },
      messageLog: () => {
        if (typeof UX !== 'undefined') UX.toggleMessageLog?.();
      },
      // Tab walks through your soldiers, one at a time, and centres the view on each.
      cycleSoldier: (_arg, gs) => cycleSoldier(gs, 1),
      cycleSoldierBack: (_arg, gs) => cycleSoldier(gs, -1),
      selectAll: () => selectUnits(mySoldiers().map((u) => u.id)),
      selectAllType: (_arg, gs) => {
        const type = Game.getUnitById?.(gs.selectedUnitId)?.type;
        if (!type) return false;
        return selectUnits(
          mySoldiers()
            .filter((u) => u.type === type)
            .map((u) => u.id)
        );
      },
      // Ctrl+digit keeps the selection as a group; with nothing selected it clears the group.
      saveGroup: (n, gs) => {
        const ids = gs.selectedUnitIds?.length
          ? [...gs.selectedUnitIds]
          : gs.selectedUnitId
            ? [gs.selectedUnitId]
            : [];
        if (ids.length) {
          controlGroups[n] = ids;
          Game.showMessage?.(
            `Group ${n} saved (${ids.length}). ${Hotkeys.keyLabel(String(n))} recalls it.`,
            140
          );
        } else if (controlGroups[n]) {
          delete controlGroups[n];
          Game.showMessage?.(`Group ${n} cleared.`, 120);
        } else return false;
        return true;
      },
      centreGeneral: () => {
        const general = mySoldiers().find((u) => Game.getUnitById?.(u.id)?.isGeneral);
        if (!general) {
          Game.showMessage?.('No General on the field.', 120);
          return true;
        }
        Game.selectUnit(general.id);
        Game.focusSelection?.();
        return true;
      },
      centreBreach: (_arg, gs) => {
        const at = gs.siegeLoop?.lastBreachAt;
        const map = Game.getMinimapData?.();
        if (!at || !map?.worldW || !map?.worldH) {
          Game.showMessage?.('Nothing has breached the line.', 120);
          return true;
        }
        // panCameraToFraction takes the view height, which is the world plus a 50 px apron.
        Game.panCameraToFraction(at.x / map.worldW, at.y / (map.worldH + 50));
        return true;
      },
      speedUp: () => stepSpeed(1),
      speedDown: () => stepSpeed(-1),
      quickSave: (_arg, gs) => {
        if (!Game.isPlaying() || SiegeLoop.isSpoilsHeld()) return false;
        Game.quickSave?.();
        if (gs.paused && typeof UX !== 'undefined') UX.updatePauseMenu?.(Game.getState());
        return true;
      },
      quickLoad: () => {
        if (!Game.isPlaying() || !Game.hasQuickSave?.()) return false;
        if (Game.quickLoad?.() && typeof UX !== 'undefined') UX.closePauseMenu?.(false);
        return true;
      },
      demolish: () => Game.selectDemolish?.(),
      moveBuilding: () => Game.selectMoveBuilding?.(),
      hunt: () => Game.orderHunt(),
      holdHere: () => Game.orderHoldHere(),
      order: (id) => SiegeLoop.order(id),
      loadout: (id, gs) => {
        if (!(gs.kingdomLoadoutsUnlocked || gs.wave >= 100)) return false;
        Game.setLoadout?.(id);
        return true;
      },
      beginDay: (_arg, gs) => {
        if (gs.timeOfDay !== 'night') return false;
        Game.beginDayPhase(true);
        return true;
      },
      ability: (id) => selectByKey('ability', id),
      build: (id) => selectByKey('build', id),
      // A saved control group takes over its digit; clear the group to recruit with it again.
      deploySlot: (slot) => {
        if (recallGroup(slot + 1)) return true;
        return selectByKey('deploy', Hotkeys.deployTypeAt(slot));
      },
      buildSlot: (slot) => selectByKey('build', Hotkeys.slotItemAt('build', slot)),
      spySlot: (slot) => selectByKey('spy', Hotkeys.slotItemAt('spy', slot)),
      courierSlot: (slot) => selectByKey('courier', Hotkeys.slotItemAt('courier', slot)),
      pauseMenu: () => {
        if (closeTopPanel()) return;
        if (typeof UX !== 'undefined') UX.openPauseMenu();
        else Game.clearSelection();
      },
      cancel: (_arg, gs) => {
        if (closeTopPanel()) return;
        if (isCreativeToolArmed(gs) && !isPlacementOrCourierArmed(gs)) {
          Game.creativeSetTool?.(null);
        } else {
          Game.clearPlacementMode();
        }
        shiftRepeatArmed = false;
      },
      closePanel: () => {
        if (!closeTopPanel()) Game.clearSelection();
      },
      rotateWall: () => Game.cycleWallPlacementFacing?.(),
      focusSelection: () => Game.focusSelection?.(),
      clearSelection: () => Game.clearSelection(),
      backToPosts: () => Game.returnSelectionToPosts?.(),
      reform: (_arg, gs) => {
        if (selectionCount(gs) < 2) return false;
        Game.reformSelectionFormation?.();
        return true;
      },
      promote: () => Game.upgradeSelectedVeteran?.(),
      formation: (fid, gs) => {
        if (!Game.setSelectionFormation?.(fid)) return false;
        if (selectionCount(gs) >= 2) Game.reformSelectionFormation?.(fid);
        return true;
      },
      creativePanel: () => CreativeMode.togglePanel(),
      startRun: () => {
        const menu = document.getElementById('menu-screen');
        const overlay = document.querySelector('.screen.active:not(#menu-screen)');
        if (!menu?.classList.contains('active') || overlay) return false;
        document.getElementById('start-btn')?.click();
        return true;
      },
      restart: () => {
        const btn = document.getElementById('restart-btn');
        if (!btn || !document.getElementById('gameover-screen')?.classList.contains('active')) {
          return false;
        }
        btn.click();
        return true;
      },
      spoilPick: (i) => spoilCards()[i]?.click(),
      spoilMove: (step) => {
        const cards = spoilCards();
        if (!cards.length) return;
        const at = cards.indexOf(document.activeElement);
        const next = at < 0 ? 0 : (at + step + cards.length) % cards.length;
        cards[next].focus();
      },
      spoilConfirm: () => {
        const cards = spoilCards();
        (cards.includes(document.activeElement) ? document.activeElement : cards[0])?.click();
      },
    };

    // Shift-click placed a troop or building and left it armed: letting go of Shift ends it.
    let shiftRepeatArmed = false;

    /**
     * Run whatever `key` is bound to in the current state. Keyboard and controller both come
     * through here. True when something happened (the caller then swallows the event).
     */
    function dispatchKey(key, e) {
      // The key sheet is its own little modal: ? or Esc closes it, nothing else gets through.
      if (UI.isKeySheetOpen?.()) {
        const closes =
          key === 'escape' || key === 'pad:b' || key === Hotkeys.keyFor('menu', 'keySheet');
        if (closes) UI.closeKeySheet();
        return closes;
      }
      const state = hotkeyState();
      refreshSlots();
      const binding = Hotkeys.lookup(state, key);
      if (!binding) {
        // A modal state swallows every key it does not use (Tab must not reach the page behind).
        return state === 'spoils' && !['f3', 'f10', 'f12'].includes(key) && !key.startsWith('pad:');
      }
      const run = HOTKEY_ACTIONS[binding.action];
      if (!run) return false;
      const handled = run(binding.arg, Game.getState(), e);
      if (handled === false) return false;
      UI.updateHUD(true);
      return true;
    }

    document.addEventListener('keydown', (e) => {
      if (isTypingTarget()) return;
      if (typeof InPageDialog !== 'undefined' && InPageDialog.isOpen()) return;
      if (typeof Settings !== 'undefined' && Settings.isCapturingKey?.()) return;
      // Settings and the Save / Load screen are modal: Escape closes them, nothing else acts.
      const modal =
        typeof Settings !== 'undefined' && Settings.isOpen()
          ? Settings
          : typeof SaveManager !== 'undefined' && SaveManager.isOpen?.()
            ? SaveManager
            : null;
      if (modal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          modal.close();
        }
        return;
      }
      if (e.key === 'Shift') UI.setCursorState?.(lastMouse.x, lastMouse.y, true);
      const key = Hotkeys.keyOfEvent(e);
      if (!key) return;
      if (dispatchKey(key, e)) e.preventDefault();
    });

    function releasePan(base) {
      for (const dir of CAMERA_PAN_DIRS) {
        const held = Hotkeys.STATES.some(
          (s) => base == null || Hotkeys.baseKey(Hotkeys.keyFor(s, 'pan', dir)) === base
        );
        if (held) Game.setCameraKey(dir, false);
      }
    }
    window.addEventListener('blur', () => releasePan(null));

    document.addEventListener('keyup', (e) => {
      // Whatever modifiers are still down, letting go of a pan key stops the pan.
      const base = Hotkeys.baseKey(Hotkeys.keyOfEvent({ key: e.key, code: e.code }));
      if (base) releasePan(base);
      if (e.key === 'Shift') {
        UI.setCursorState?.(lastMouse.x, lastMouse.y, false);
        // Deploy/build placement only: Shift held = keep placing, Shift released = done.
        // (Shift on a move order belongs to the move-order click handler, not to this.)
        if (shiftRepeatArmed) {
          shiftRepeatArmed = false;
          const gs = Game.getState();
          if (Game.isPlaying() && (gs.selectedDeploy || gs.selectedBuild)) {
            Game.clearPlacementMode();
            UI.updateHUD(true);
          }
        }
      }
    });

    // Controller: the same key maps, read by polling. The d-pad or left stick pans, A
    // confirms, B cancels, the bumpers walk through your soldiers, Start pauses. Placing a
    // troop still needs a pointer.
    let padHeld = [];
    function pollGamepad() {
      let pad;
      try {
        pad = [...(navigator.getGamepads?.() || [])].find((p) => p && p.connected) || null;
      } catch (_) {
        pad = null;
      }
      const now = Hotkeys.padKeys(pad);
      if (!now.length && !padHeld.length) return;
      const capturing = typeof Settings !== 'undefined' && Settings.isCapturingKey?.();
      // Settings and Save / Load are modal for the controller too: B closes them.
      const modal =
        typeof Settings !== 'undefined' && Settings.isOpen()
          ? Settings
          : typeof SaveManager !== 'undefined' && SaveManager.isOpen?.()
            ? SaveManager
            : null;
      for (const key of now) {
        if (padHeld.includes(key)) continue;
        if (capturing) Settings.capturePadKey?.(key);
        else if (modal) {
          if (key === 'pad:b') modal.close();
        } else if (
          !isTypingTarget() &&
          !(typeof InPageDialog !== 'undefined' && InPageDialog.isOpen())
        )
          dispatchKey(key, null);
      }
      for (const key of padHeld) {
        if (now.includes(key)) continue;
        for (const dir of CAMERA_PAN_DIRS) {
          if (Hotkeys.STATES.some((s) => Hotkeys.padFor(s, 'pan', dir) === key)) {
            Game.setCameraKey(dir, false);
          }
        }
      }
      padHeld = now;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      setInterval(pollGamepad, 50);
    }

    // Where the pointer is, for the price tag that follows it while something is armed.
    const lastMouse = { x: -1, y: -1 };
    window.addEventListener(
      'mousemove',
      (e) => {
        // Only over the field: the tag has no business on top of the panels.
        const overField = e.target === canvas || isMapPassthroughTarget(e.target);
        lastMouse.x = overField ? e.clientX : -1;
        lastMouse.y = overField ? e.clientY : -1;
        UI.setCursorState?.(lastMouse.x, lastMouse.y, e.shiftKey);
      },
      { passive: true }
    );

    // Was a run in progress on the previous frame? The HUD is only refreshed every fifth
    // frame while playing, so a run that ended on any other frame never showed its result
    // screen. The frame the run ends on now always refreshes it.
    let wasPlaying = false;

    function loop() {
      if (typeof ErrorReporting !== 'undefined') ErrorReporting.heartbeatBegin();
      const guard =
        typeof ErrorReporting !== 'undefined'
          ? (label, fn, opts) => ErrorReporting.runGuarded(label, fn, opts)
          : (_l, fn) => fn();
      guard('gameLoop', () => {
        if (Game.isPlaying()) {
          UI.ensureMenuDismissedForPlay?.();
          Game.beginPresentationFrame?.();
          if (!hidden) {
            let steps = Game.getSimulationSteps?.() ?? 1;
            // Drop catch-up sim steps when the frame is already slow to avoid freezes.
            if (
              steps > 1 &&
              typeof ErrorReporting !== 'undefined' &&
              ErrorReporting.shouldSkipExtraSimSteps?.()
            ) {
              steps = 1;
            }
            for (let i = 0; i < steps; i++) {
              if (typeof ErrorReporting !== 'undefined') {
                ErrorReporting.noteSimStep?.(i, steps);
                if (i > 0 && ErrorReporting.shouldSkipExtraSimSteps?.()) break;
              }
              guard('Game.update', () => Game.update(), {
                subsystem: 'simulation',
                phase: 'Game.update',
                warnMs: 900,
              });
              if (typeof ErrorReporting !== 'undefined') {
                ErrorReporting.heartbeatMid?.(`post-sim-${i}`);
              }
            }
            guard('Game.updatePresentation', () => Game.updatePresentation?.(), {
              subsystem: 'render',
              phase: 'presentation',
              warnMs: 500,
            });
            const minimapEvery =
              typeof GfxQuality !== 'undefined' ? GfxQuality.get().minimapInterval || 5 : 5;
            const skipMinimap =
              typeof ErrorReporting !== 'undefined' && ErrorReporting.isDegraded('minimap');
            if (++hudTick % 5 === 0) {
              guard('UI.updateHUD', () => UI.updateHUD(), { phase: 'hud', warnMs: 400 });
            } else if (!skipMinimap && hudTick % minimapEvery === 0 && typeof UX !== 'undefined') {
              guard('minimap', () => UX.drawMinimap(), { subsystem: 'minimap', phase: 'minimap' });
            }
          }
          if (!hidden) {
            guard('Game.draw', () => Game.draw(), {
              subsystem: 'render',
              phase: 'draw',
              warnMs: 700,
            });
          }
        }
      });
      const nowPlaying = Game.isPlaying();
      if (wasPlaying && !nowPlaying) {
        guard('UI.updateHUD', () => UI.updateHUD(true), { phase: 'hud', warnMs: 400 });
      }
      wasPlaying = nowPlaying;
      if (typeof ErrorReporting !== 'undefined') ErrorReporting.heartbeatEnd('gameLoop');
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  boot().catch((err) => {
    if (typeof ErrorReporting !== 'undefined') {
      ErrorReporting.captureException(err, { label: 'boot', fatal: true });
    } else {
      console.error('Boot failed:', err);
    }
  });
})();
