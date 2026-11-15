/**
 * Camera, zoom and viewport.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameCamera = (() => {
  const { cameraKeys, clampCameraAxis, getPanelInsets, svc } = GameCore;
  const GS = GameState;
  function bind() {}

  const CAMERA_MIN_ZOOM = 0.4;
  const CAMERA_MAX_ZOOM = 8;
  const CAMERA_ARROW_SPEED = 9;

  function getMapViewH() {
    return GS.worldH + 50;
  }

  function resetCamera() {
    GS.cameraZoom = 1;
    GS.cameraWorldX = GS.worldW / 2;
    GS.cameraWorldY = getMapViewH() / 2;
    GS.cameraPlaced = true;
    applyCamera();
  }

  function getCameraViewport() {
    const insets = getPanelInsets();
    const width = Math.max(1, GS.canvas.width - insets.left - insets.right);
    const height = Math.max(1, GS.canvas.height - insets.top - insets.bottom);
    return {
      left: insets.left,
      top: insets.top,
      width,
      height,
      centerX: insets.left + width / 2,
      centerY: insets.top + height / 2,
    };
  }

  function sanitizeCameraState() {
    const mapH = getMapViewH();
    if (!Number.isFinite(GS.cameraZoom) || GS.cameraZoom <= 0) GS.cameraZoom = 1;
    GS.cameraZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, GS.cameraZoom));
    if (!Number.isFinite(GS.baseViewScale) || GS.baseViewScale <= 0) {
      if (GS.canvas) {
        const insets = getPanelInsets();
        const margin = 16;
        GS.baseViewScale = Math.min(
          (GS.canvas.width - insets.left - insets.right - margin) / Math.max(1, GS.worldW),
          (GS.canvas.height - insets.top - insets.bottom - margin) / Math.max(1, mapH)
        );
      } else {
        GS.baseViewScale = 1;
      }
    }
    if (!Number.isFinite(GS.cameraWorldX)) GS.cameraWorldX = GS.worldW / 2;
    if (!Number.isFinite(GS.cameraWorldY)) GS.cameraWorldY = mapH / 2;
  }

  /** Keep zoom/pan anchors inside the playable map viewport (not HUD chrome). */
  function clampScreenToViewport(sx, sy) {
    const vp = getCameraViewport();
    return {
      sx: Math.max(vp.left, Math.min(vp.left + vp.width, sx)),
      sy: Math.max(vp.top, Math.min(vp.top + vp.height, sy)),
    };
  }

  function isScreenInMapViewport(sx, sy) {
    const vp = getCameraViewport();
    return sx >= vp.left && sx <= vp.left + vp.width && sy >= vp.top && sy <= vp.top + vp.height;
  }

  /** Playable map band — excludes side/top HUD only (bottom hint/unit panel counts as map). */
  function isScreenInMapArea(sx, sy) {
    if (!GS.canvas) return false;
    const insets = getPanelInsets();
    return (
      sx >= insets.left &&
      sx <= GS.canvas.width - insets.right &&
      sy >= insets.top &&
      sy <= GS.canvas.height
    );
  }

  /** Derive canvas transform from camera center + zoom (single source of truth). */
  function syncCameraTransform() {
    if (!GS.canvas) return;
    sanitizeCameraState();
    const vp = getCameraViewport();
    GS.viewScale = GS.baseViewScale * GS.cameraZoom;
    if (!Number.isFinite(GS.viewScale) || GS.viewScale <= 0)
      GS.viewScale = Math.max(0.01, GS.baseViewScale);
    GS.viewX = vp.centerX - GS.cameraWorldX * GS.viewScale;
    GS.viewY = vp.centerY - GS.cameraWorldY * GS.viewScale;
  }

  function isMapOverlappingViewport() {
    if (!GS.canvas) return true;
    const mapH = getMapViewH();
    const vp = getCameraViewport();
    const scale =
      Number.isFinite(GS.viewScale) && GS.viewScale > 0
        ? GS.viewScale
        : GS.baseViewScale * GS.cameraZoom;
    if (!Number.isFinite(scale) || scale <= 0) return false;
    const mapRight = GS.viewX + GS.worldW * scale;
    const mapBottom = GS.viewY + mapH * scale;
    const vpRight = vp.left + vp.width;
    const vpBottom = vp.top + vp.height;
    return GS.viewX < vpRight && mapRight > vp.left && GS.viewY < vpBottom && mapBottom > vp.top;
  }

  function clampCameraToBounds() {
    if (!GS.canvas) return;
    sanitizeCameraState();
    const mapH = getMapViewH();
    const vp = getCameraViewport();
    GS.viewScale = GS.baseViewScale * GS.cameraZoom;
    const halfW = vp.width / (2 * GS.viewScale);
    const halfH = vp.height / (2 * GS.viewScale);
    const edgeMargin = 2 / Math.max(GS.viewScale, 0.01);

    GS.cameraWorldX = clampCameraAxis(GS.cameraWorldX, GS.worldW, halfW, edgeMargin);
    GS.cameraWorldY = clampCameraAxis(GS.cameraWorldY, mapH, halfH, edgeMargin);

    syncCameraTransform();
    GS.visibleBoundsCore = null;
    GS.sortedUnitsFrame = -1;
  }

  function applyCamera() {
    clampCameraToBounds();
  }

  function resize() {
    if (!GS.canvas) return;
    const prevW = GS.canvas.width;
    const prevH = GS.canvas.height;
    const nextW = window.innerWidth;
    const nextH = window.innerHeight;
    const sizeChanged = prevW !== nextW || prevH !== nextH;
    if (sizeChanged) {
      GS.canvas.width = nextW;
      GS.canvas.height = nextH;
    }
    const insets = getPanelInsets();
    const margin = 16;
    const nextBase = Math.min(
      (GS.canvas.width - insets.left - insets.right - margin) / GS.worldW,
      (GS.canvas.height - insets.top - insets.bottom - margin) / getMapViewH()
    );
    const baseChanged = Math.abs(nextBase - GS.baseViewScale) > 1e-6;
    GS.baseViewScale = nextBase;
    if (!GS.cameraPlaced) {
      GS.cameraWorldX = GS.worldW / 2;
      GS.cameraWorldY = getMapViewH() / 2;
      GS.cameraPlaced = true;
    }
    if (sizeChanged || baseChanged) applyCamera();
    else syncCameraTransform();
  }

  function getVisibleBoundsCore() {
    if (GS.visibleBoundsCore) return GS.visibleBoundsCore;
    if (!GS.canvas) {
      return { left: -9999, top: -9999, right: 99999, bottom: 99999 };
    }
    const vp = getCameraViewport();
    GS.visibleBoundsCore = {
      left: (vp.left - GS.viewX) / GS.viewScale,
      top: (vp.top - GS.viewY) / GS.viewScale,
      right: (vp.left + vp.width - GS.viewX) / GS.viewScale,
      bottom: (vp.top + vp.height - GS.viewY) / GS.viewScale,
    };
    return GS.visibleBoundsCore;
  }

  function getVisibleBounds(pad = 90) {
    const core = getVisibleBoundsCore();
    const m = pad / Math.max(0.25, GS.viewScale);
    return {
      left: core.left - m,
      top: core.top - m,
      right: core.right + m,
      bottom: core.bottom + m,
    };
  }

  function isInView(x, y, radius = 0, pad = 90) {
    const b = getVisibleBounds(pad);
    return (
      x + radius >= b.left && x - radius <= b.right && y + radius >= b.top && y - radius <= b.bottom
    );
  }

  function updateCamera() {
    if (GS.state !== 'playing') return;
    let moved = false;
    const step = CAMERA_ARROW_SPEED / Math.max(0.55, GS.cameraZoom);
    if (cameraKeys.up) {
      GS.cameraWorldY -= step;
      moved = true;
    }
    if (cameraKeys.down) {
      GS.cameraWorldY += step;
      moved = true;
    }
    if (cameraKeys.left) {
      GS.cameraWorldX -= step;
      moved = true;
    }
    if (cameraKeys.right) {
      GS.cameraWorldX += step;
      moved = true;
    }
    if (moved) applyCamera();
  }

  function onSettingsChanged(opts = {}) {
    GS.visibleBoundsCore = null;
    if (svc('GfxQuality') && svc('Settings')) {
      svc('GfxQuality').setMode(svc('Settings').get('performanceMode') || 'auto');
    }
    if (opts.soft && GS.canvas) {
      const insets = getPanelInsets();
      const margin = 16;
      GS.baseViewScale = Math.min(
        (GS.canvas.width - insets.left - insets.right - margin) / GS.worldW,
        (GS.canvas.height - insets.top - insets.bottom - margin) / getMapViewH()
      );
      syncCameraTransform();
      return;
    }
    resize();
  }

  function zoomCameraAt(screenX, screenY, deltaY) {
    if (GS.state !== 'playing') return;
    const zoomSpeed = svc('Settings') ? svc('Settings').getCameraZoomSpeed() : 1;
    const step = 1 + 0.11 * zoomSpeed;
    const factor = deltaY < 0 ? step : 1 / step;
    zoomCameraToScale(screenX, screenY, GS.cameraZoom * factor);
  }

  function resolveZoomAnchor(screenX, screenY) {
    const vp = getCameraViewport();
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      return { sx: vp.centerX, sy: vp.centerY };
    }
    if (isScreenInMapViewport(screenX, screenY)) {
      return { sx: screenX, sy: screenY };
    }
    return clampScreenToViewport(screenX, screenY);
  }

  function zoomCameraToScale(screenX, screenY, targetZoom) {
    if (GS.state !== 'playing' || !GS.canvas) return;
    const nextZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, targetZoom));
    if (Math.abs(nextZoom - GS.cameraZoom) < 1e-6) return;

    const vp = getCameraViewport();
    ({ sx: screenX, sy: screenY } = resolveZoomAnchor(screenX, screenY));

    const anchorWorldX = GS.cameraWorldX + (screenX - vp.centerX) / GS.viewScale;
    const anchorWorldY = GS.cameraWorldY + (screenY - vp.centerY) / GS.viewScale;

    GS.cameraZoom = nextZoom;
    GS.viewScale = GS.baseViewScale * GS.cameraZoom;
    GS.cameraWorldX = anchorWorldX - (screenX - vp.centerX) / GS.viewScale;
    GS.cameraWorldY = anchorWorldY - (screenY - vp.centerY) / GS.viewScale;

    clampCameraToBounds();
  }

  function getCameraZoom() {
    return GS.cameraZoom;
  }

  return {
    bind,
    applyCamera,
    clampCameraToBounds,
    getCameraViewport,
    getCameraZoom,
    getMapViewH,
    getVisibleBounds,
    isInView,
    isMapOverlappingViewport,
    isScreenInMapArea,
    onSettingsChanged,
    resetCamera,
    resize,
    sanitizeCameraState,
    syncCameraTransform,
    updateCamera,
    zoomCameraAt,
    zoomCameraToScale,
  };
})();
