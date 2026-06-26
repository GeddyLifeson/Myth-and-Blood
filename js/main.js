(function () {
  const canvas = document.getElementById('game-canvas');
  AudioEngine.bindUnlock();
  Game.init(canvas);
  if (typeof Settings !== 'undefined') Settings.init();
  if (typeof GfxQuality !== 'undefined') GfxQuality.initFromSettings();
  if (typeof UX !== 'undefined') UX.init();
  if (typeof Perf !== 'undefined') Perf.init();
  if (typeof SaveManager !== 'undefined') SaveManager.init();
  UI.init();

  let hudTick = 0;
  let hidden = false;
  let pointerDown = false;
  canvas.style.cursor = 'grab';

  function onAppVisible() {
    hidden = false;
    if (Game.isPlaying()) {
      Game.onSettingsChanged?.();
      Game.draw?.();
    }
  }

  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (!hidden) onAppVisible();
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
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A' || tag === 'LABEL') {
        return false;
      }
      if (node.id === 'left-panel' || node.id === 'right-panel' || node.id === 'window-drag-handle') return false;
      if (node.id === 'creative-panel' && node.style.display !== 'none') return false;
      if (node.classList?.contains('minimap-panel')) return false;
      if (node.classList?.contains('unit-info-panel') && node.classList.contains('visible')) return false;
      if (node.classList?.contains('message-log-panel') && node.classList.contains('open')) return false;
      if (node.classList?.contains('tutorial-callout') && node.classList.contains('visible')) return false;
      node = node.parentElement;
    }
    return true;
  }

  function handleContextMenu(e) {
    e.preventDefault();
    if (!Game.isPlaying()) return;
    const gs = Game.getState();
    if (gs.selectedBuild || gs.selectedDeploy || gs.selectedAbility || gs.selectedCourierMsg
      || gs.selectedDemolish || gs.selectedMoveBuilding || gs.selectedRotateWall) {
      Game.clearPlacementMode();
      UI.updateHUD(true);
    } else if (gs.creativeMode && gs.creativeTool) {
      Game.creativeSetTool?.(null);
      UI.updateHUD(true);
    }
  }

  function handlePointerDownEvent(e) {
    if (e.button === 2) {
      handleContextMenu(e);
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      const { sx, sy } = screenCoords(e);
      pointerDown = true;
      Game.handlePointerDown(sx, sy, 0, { pan: true });
      return;
    }
    if (e.button !== 0) return;
    const { sx, sy } = screenCoords(e);
    pointerDown = true;
    Game.handlePointerDown(sx, sy, e.button);
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
        toggleSelection: e.ctrlKey || e.metaKey,
      });
      UI.updateHUD(true);
    }
  });

  function handleWheelEvent(e) {
    if (!Game.isPlaying()) return;
    e.preventDefault();
    const { sx, sy } = screenCoords(e);
    Game.zoomCameraAt(sx, sy, e.deltaY);
  }

  canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
  uiOverlay?.addEventListener('wheel', (e) => {
    if (!isMapPassthroughTarget(e.target)) return;
    handleWheelEvent(e);
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const { sx, sy } = screenCoords(t);
    pointerDown = true;
    Game.handlePointerDown(sx, sy, 0, { pan: true });
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!pointerDown || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const { sx, sy } = screenCoords(t);
    Game.handlePointerMove(sx, sy);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    const wasClick = Game.handlePointerUp();
    if (wasClick && e.changedTouches[0]) {
      const t = e.changedTouches[0];
      const { sx, sy } = screenCoords(t);
      Game.handleClick(sx, sy);
      UI.updateHUD(true);
    }
  }, { passive: false });

  document.getElementById('hint-log-btn')?.addEventListener('click', () => {
    document.getElementById('message-log-panel')?.classList.toggle('open');
  });

  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
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
    if (key === 'escape') {
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
      if (Game.isPlaying()) {
        const gs = Game.getState();
        if (gs.selectedBuild || gs.selectedDeploy || gs.selectedAbility || gs.selectedCourierMsg
          || gs.selectedDemolish || gs.selectedMoveBuilding || gs.selectedRotateWall) {
          Game.clearPlacementMode();
          UI.updateHUD(true);
          return;
        }
        if (gs.creativeMode && gs.creativeTool) {
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
    if (key === 'h') { Game.toggleGlobalHunt(); }
    if (key === ']' && Game.isPlaying()) {
      Game.cycleGameSpeed?.();
      UI.updateHUD(true);
    }
    if (key === 'a') { Achievements.togglePanel(); }
    if (key === 'i') { Encyclopedia.togglePanel(); }
    if (key === '`') { Cheats.togglePanel(); }
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
    }
    const units = {
      '1': 'footman', '2': 'archer', '3': 'mage', '4': 'cavalry',
      '5': 'healer', '6': 'knight', '7': 'builder', '8': 'sapper', '9': 'courier',
      '0': 'general',
    };
    if (units[key] && Game.getState().canDeploy) Game.selectDeploy(units[key]);
    const abilities = {
      'q': 'fireball', 'w': 'lightning', 'e': 'heal', 'r': 'reinforce', 't': 'rally',
      'f': 'meteor', 'j': 'frost_nova', 'k': 'scout_flare', 'x': 'fortify',
    };
    if (abilities[key]) Game.selectAbility(abilities[key]);
    const builds = {
      'o': 'outpost', 'l': 'wall', 'c': 'castle', 'n': 'medical_tent', 'm': 'mess_hall',
      'g': 'hamlet', 'u': 'merchant_guild', 'y': 'watchtower',
      'b': 'trade_outpost',
    };
    if (key === 'z') Game.setLoadout?.('balanced');
    if (builds[key]) Game.selectBuild(builds[key]);
    UI.updateHUD(true);
  });

  document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      Game.setCameraKey(key, false);
    }
  });

  function loop() {
    if (Game.isPlaying()) {
      if (!hidden) {
        const steps = Game.getSimulationSteps?.() ?? 1;
        for (let i = 0; i < steps; i++) Game.update();
        const minimapEvery = typeof GfxQuality !== 'undefined' ? (GfxQuality.get().minimapInterval || 5) : 5;
        if (++hudTick % 5 === 0) UI.updateHUD();
        else if (hudTick % minimapEvery === 0 && typeof UX !== 'undefined') UX.drawMinimap();
      }
      Game.draw();
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();