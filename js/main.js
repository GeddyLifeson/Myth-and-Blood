(function () {
  const canvas = document.getElementById('game-canvas');

  // ---------------------------------------------------------------------------
  // Input configuration (pure data — hoisted out of the keydown handler so the
  // maps are built once at load instead of on every keypress).
  // ---------------------------------------------------------------------------

  /** Held camera-pan keys (released on keyup whatever the state). */
  const CAMERA_PAN_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

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
        Game.handleClick(sx, sy, { touch: true });
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
      if (!id) return;
      const res = UI.selectItem(kind, id);
      if (res.ok) UI.revealSelection?.();
    }

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
      cycleSoldier: (_arg, gs) => {
        const mine = (Game.getUnitsSnapshot?.() || [])
          .filter((u) => u.team === 'player')
          .sort((a, b) => a.y - b.y || a.x - b.x || (a.id > b.id ? 1 : -1));
        if (!mine.length) return false;
        const at = mine.findIndex((u) => u.id === gs.selectedUnitId);
        const next = mine[(at + 1) % mine.length];
        if (!Game.selectUnit(next.id)) return false;
        Game.focusSelection?.();
        return true;
      },
      hunt: () => Game.toggleGlobalHunt(),
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
      deploySlot: (slot) => selectByKey('deploy', Hotkeys.deployTypeAt(slot)),
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

    document.addEventListener('keydown', (e) => {
      if (isTypingTarget()) return;
      if (typeof InPageDialog !== 'undefined' && InPageDialog.isOpen()) return;
      const key = Hotkeys.keyOfEvent(e);
      if (!key) return;
      if (e.key === 'Shift') UI.setCursorState?.(lastMouse.x, lastMouse.y, true);
      // The key sheet is its own little modal: ? or Esc closes it, nothing else gets through.
      if (UI.isKeySheetOpen?.()) {
        if (key === '?' || key === 'escape') {
          e.preventDefault();
          UI.closeKeySheet();
        }
        return;
      }
      const state = hotkeyState();
      const binding = Hotkeys.lookup(state, key);
      if (!binding) {
        // A modal state swallows every key it does not use (Tab must not reach the page behind).
        if (state === 'spoils' && key !== 'f3' && key !== 'f10' && key !== 'f12') {
          e.preventDefault();
        }
        return;
      }
      const run = HOTKEY_ACTIONS[binding.action];
      if (!run) return;
      const handled = run(binding.arg, Game.getState(), e);
      if (handled === false) return;
      e.preventDefault();
      UI.updateHUD(true);
    });

    document.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (CAMERA_PAN_KEYS.includes(key)) {
        Game.setCameraKey(key, false);
      }
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
