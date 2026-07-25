(function () {
  const canvas = document.getElementById('game-canvas');

  // ---------------------------------------------------------------------------
  // Input configuration (pure data — hoisted out of the keydown handler so the
  // maps are built once at load instead of on every keypress).
  // ---------------------------------------------------------------------------

  /** Held camera-pan keys. */
  const CAMERA_PAN_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

  /** Alt+1..5 → formation id (index = digit - 1). */
  const FORMATION_HOTKEYS = ['line', 'column', 'wedge', 'box', 'spread'];

  /** Number-row deploy hotkeys. */
  const DEPLOY_HOTKEYS = {
    1: 'footman',
    2: 'archer',
    3: 'mage',
    4: 'cavalry',
    5: 'healer',
    6: 'knight',
    7: 'builder',
    8: 'sapper',
    9: 'courier',
    0: 'general',
  };

  /** Ability hotkeys. */
  const ABILITY_HOTKEYS = {
    q: 'fireball',
    w: 'lightning',
    e: 'heal',
    r: 'reinforce',
    t: 'rally',
    f: 'meteor',
    v: 'fus_ro_dah',
    ';': 'fire_breath',
    "'": 'ice_form',
    j: 'frost_nova',
    k: 'scout_flare',
    x: 'fortify',
    p: 'dispel',
  };

  /** Building placement hotkeys. */
  const BUILD_HOTKEYS = {
    o: 'outpost',
    l: 'wall',
    c: 'castle',
    n: 'medical_tent',
    m: 'mess_hall',
    g: 'hamlet',
    u: 'merchant_guild',
    y: 'watchtower',
    b: 'trade_outpost',
  };

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
        Game.handleClick(sx, sy, {
          selectSameType: e.shiftKey,
          shiftKey: e.shiftKey,
          repeatDeploy: e.shiftKey,
          toggleSelection: e.ctrlKey || e.metaKey,
        });
        UI.updateHUD(true);
      }
    });

    function panelCanWheelScroll(panel, deltaY) {
      if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return false;
      if (deltaY > 0) return panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1;
      return panel.scrollTop > 0;
    }

    function isModalWheelTarget(el) {
      if (el?.closest?.('.screen.active')) return true;
      const creative = el?.closest?.('#creative-panel');
      if (creative && creative.style.display !== 'none') return true;
      return false;
    }

    function shouldMapWheelZoom(e, sx, sy) {
      const zoomingOut = e.deltaY > 0;
      const overMap = Game.isScreenInMapArea?.(sx, sy);
      if (overMap) return true;

      const sidePanel = e.target?.closest?.('#left-panel, #right-panel');
      if (sidePanel && panelCanWheelScroll(sidePanel, e.deltaY)) return false;

      return zoomingOut;
    }

    function handleWheelEvent(e) {
      if (!Game.isPlaying()) return;
      if (isModalWheelTarget(e.target)) return;

      const { sx, sy } = screenCoords(e);
      if (!shouldMapWheelZoom(e, sx, sy)) return;

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

    document.addEventListener('keydown', (e) => {
      if (isTypingTarget()) return;
      const key = e.key.toLowerCase();
      if (CAMERA_PAN_KEYS.includes(key)) {
        if (Game.isPlaying()) {
          e.preventDefault();
          Game.setCameraKey(key, true);
        }
        return;
      }
      if (key === ' ') {
        e.preventDefault();
        if (Game.isPlaying() && Game.getState().paused && typeof UX !== 'undefined') {
          UX.closePauseMenu(true);
        } else {
          Game.togglePause();
        }
        UI.updateHUD(true);
      }
      if (key === 'tab') {
        e.preventDefault();
        if (typeof UX !== 'undefined') UX.toggleMessageLog?.();
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        if (typeof ErrorReporting !== 'undefined' && ErrorReporting.openBugReport) {
          ErrorReporting.openBugReport({ source: 'hotkey-f10' });
        }
        return;
      }
      if (key === 'escape') {
        const logPanel = document.getElementById('message-log-panel');
        if (logPanel?.classList.contains('open')) {
          logPanel.classList.remove('open');
          return;
        }
        if (typeof Settings !== 'undefined' && Settings.isOpen()) {
          Settings.close();
          UI.updateHUD(true);
          return;
        }
        if (typeof Encyclopedia !== 'undefined' && Encyclopedia.isOpen()) {
          Encyclopedia.close();
          UI.updateHUD(true);
          return;
        }
        if (typeof FactionIntel !== 'undefined' && FactionIntel.isPanelOpen()) {
          FactionIntel.closePanel();
          UI.updateHUD(true);
          return;
        }
        if (Game.isPlaying()) {
          const gs = Game.getState();
          if (isPlacementOrCourierArmed(gs)) {
            Game.clearPlacementMode();
            UI.updateHUD(true);
            return;
          }
          if (isCreativeToolArmed(gs)) {
            Game.creativeSetTool?.(null);
            UI.updateHUD(true);
            return;
          }
          if (typeof UX !== 'undefined') {
            if (gs.paused) UX.closePauseMenu(true);
            else UX.openPauseMenu();
          } else {
            Game.clearSelection();
          }
        } else {
          Game.clearSelection();
        }
        UI.updateHUD(true);
      }
      if (key === 'd' && Game.isPlaying() && Game.getState().timeOfDay === 'night') {
        e.preventDefault();
        Game.beginDayPhase(true);
        UI.updateHUD(true);
        return;
      }
      if (key === 'r' && Game.isPlaying() && Game.getState().selectedBuild === 'wall') {
        if (Game.cycleWallPlacementFacing?.()) {
          e.preventDefault();
          UI.updateHUD(true);
          return;
        }
      }
      if (key === 'h') {
        Game.toggleGlobalHunt();
      }
      if (key === 'f' && Game.isPlaying()) {
        e.preventDefault();
        Game.focusSelection?.();
        UI.updateHUD(true);
        return;
      }
      if (key === 'c' && Game.isPlaying() && !e.ctrlKey && !e.metaKey) {
        Game.clearSelection();
        UI.updateHUD(true);
        return;
      }
      if (key === 'g' && Game.isPlaying() && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        Game.reformSelectionFormation?.();
        UI.updateHUD(true);
        return;
      }
      if (e.altKey && Game.isPlaying() && key >= '1' && key <= '5') {
        const fid = FORMATION_HOTKEYS[parseInt(key, 10) - 1];
        if (fid && Game.setSelectionFormation?.(fid)) {
          e.preventDefault();
          const gs = Game.getState();
          if ((gs.selectedUnitIds?.length || 0) + (gs.selectedUnitId ? 1 : 0) >= 2) {
            Game.reformSelectionFormation?.(fid);
          }
          UI.updateHUD(true);
        }
        return;
      }
      if (key === ']' && Game.isPlaying()) {
        Game.cycleGameSpeed?.();
        UI.updateHUD(true);
      }
      if (key === 'a') {
        Achievements.togglePanel();
      }
      if (key === 'i') {
        Encyclopedia.togglePanel();
      }
      if (key === '`') {
        Cheats.togglePanel();
      }
      if (key === 'p' && Game.isCreativeMode?.()) {
        e.preventDefault();
        CreativeMode.togglePanel();
        UI.updateHUD(true);
      }
      if (key === 'v') {
        const muted = AudioEngine.toggleMute();
        const btn = document.getElementById('sound-toggle');
        if (btn) btn.textContent = muted ? '🔇' : '🔊';
        if (typeof Settings !== 'undefined') Settings.set('muted', muted);
        return;
      }
      if (DEPLOY_HOTKEYS[key] && Game.getState().canDeploy) Game.selectDeploy(DEPLOY_HOTKEYS[key]);
      if (ABILITY_HOTKEYS[key]) Game.selectAbility(ABILITY_HOTKEYS[key]);
      if (key === 'z') Game.setLoadout?.('balanced');
      if (BUILD_HOTKEYS[key]) Game.selectBuild(BUILD_HOTKEYS[key]);
      if (key === 'u' && Game.getState().canDeploy) Game.upgradeSelectedVeteran?.();
      UI.updateHUD(true);
    });

    document.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (CAMERA_PAN_KEYS.includes(key)) {
        Game.setCameraKey(key, false);
      }
    });

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
            } else if (
              !skipMinimap &&
              hudTick % minimapEvery === 0 &&
              typeof UX !== 'undefined'
            ) {
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
