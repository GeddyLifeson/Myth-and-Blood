/**
 * Camera zoom-to-cursor math — world point under cursor must stay fixed while scaling.
 */
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

function makeCamera(opts = {}) {
  const worldW = opts.worldW ?? 800;
  const mapH = opts.mapH ?? 650;
  const baseViewScale = opts.baseViewScale ?? 0.9;
  const canvasW = opts.canvasW ?? 1280;
  const canvasH = opts.canvasH ?? 720;
  const minZoom = opts.minZoom ?? 0.4;
  const maxZoom = opts.maxZoom ?? 8;
  const insets = opts.insets ?? { left: 84, right: 78, top: 52, bottom: 40 };
  const vp = {
    width: canvasW - insets.left - insets.right,
    height: canvasH - insets.top - insets.bottom,
    centerX: insets.left + (canvasW - insets.left - insets.right) / 2,
    centerY: insets.top + (canvasH - insets.top - insets.bottom) / 2,
  };
  let cameraZoomLevel = opts.cameraZoom ?? 1;
  let cameraWorldXPos = opts.cameraWorldX ?? 400;
  let cameraWorldYPos = opts.cameraWorldY ?? 325;
  let viewScale = baseViewScale * cameraZoomLevel;

  function syncTransform() {
    viewScale = baseViewScale * cameraZoomLevel;
  }

  function screenToWorld(sx, sy) {
    return {
      x: cameraWorldXPos + (sx - vp.centerX) / viewScale,
      y: cameraWorldYPos + (sy - vp.centerY) / viewScale,
    };
  }

  function worldToScreen(wx, wy) {
    return {
      x: vp.centerX + (wx - cameraWorldXPos) * viewScale,
      y: vp.centerY + (wy - cameraWorldYPos) * viewScale,
    };
  }

  function clampCameraAxis(pos, worldSize, half, margin = 0) {
    if (!Number.isFinite(pos)) return worldSize / 2;
    if (!Number.isFinite(worldSize) || worldSize <= 0) return pos;
    if (!Number.isFinite(half) || half <= 0) return Math.max(0, Math.min(worldSize, pos));
    const inset = Math.max(0, margin);
    const low = half;
    const high = worldSize - half;
    if (low <= high) return Math.max(low, Math.min(high, pos));
    return Math.max(-half + inset, Math.min(worldSize + half - inset, pos));
  }

  function clampScreenToViewport(sx, sy) {
    return {
      sx: Math.max(vp.centerX - vp.width / 2, Math.min(vp.centerX + vp.width / 2, sx)),
      sy: Math.max(vp.centerY - vp.height / 2, Math.min(vp.centerY + vp.height / 2, sy)),
    };
  }

  function clampBounds() {
    syncTransform();
    const halfW = vp.width / (2 * viewScale);
    const halfH = vp.height / (2 * viewScale);
    const edgeMargin = 2 / Math.max(viewScale, 0.01);
    cameraWorldXPos = clampCameraAxis(cameraWorldXPos, worldW, halfW, edgeMargin);
    cameraWorldYPos = clampCameraAxis(cameraWorldYPos, mapH, halfH, edgeMargin);
    syncTransform();
  }

  function isScreenInMapViewport(sx, sy) {
    const left = vp.centerX - vp.width / 2;
    const top = vp.centerY - vp.height / 2;
    return sx >= left && sx <= left + vp.width && sy >= top && sy <= top + vp.height;
  }

  function isScreenInMapArea(sx, sy) {
    return (
      sx >= insets.left &&
      sx <= canvasW - insets.right &&
      sy >= insets.top &&
      sy <= canvasH
    );
  }

  function resolveZoomAnchor(screenX, screenY) {
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      return { sx: vp.centerX, sy: vp.centerY };
    }
    if (isScreenInMapViewport(screenX, screenY)) {
      return { sx: screenX, sy: screenY };
    }
    return clampScreenToViewport(screenX, screenY);
  }

  function zoomCameraToScale(screenX, screenY, targetZoom) {
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
    if (Math.abs(nextZoom - cameraZoomLevel) < 1e-6) return;

    ({ sx: screenX, sy: screenY } = resolveZoomAnchor(screenX, screenY));

    const anchorWorldX = cameraWorldXPos + (screenX - vp.centerX) / viewScale;
    const anchorWorldY = cameraWorldYPos + (screenY - vp.centerY) / viewScale;

    cameraZoomLevel = nextZoom;
    viewScale = baseViewScale * cameraZoomLevel;
    cameraWorldXPos = anchorWorldX - (screenX - vp.centerX) / viewScale;
    cameraWorldYPos = anchorWorldY - (screenY - vp.centerY) / viewScale;
    clampBounds();
  }

  return {
    get zoom() {
      return cameraZoomLevel;
    },
    get worldX() {
      return cameraWorldXPos;
    },
    get worldY() {
      return cameraWorldYPos;
    },
    vp,
    screenToWorld,
    worldToScreen,
    zoomTo: zoomCameraToScale,
    clamp: clampBounds,
  };
}

const cursorX = 720;
const cursorY = 410;

{
  const cam = makeCamera({ cameraZoom: 1.6, cameraWorldX: 420, cameraWorldY: 300 });
  const anchor = cam.screenToWorld(cursorX, cursorY);
  cam.zoomTo(cursorX, cursorY, cam.zoom * 1.15);
  const screen = cam.worldToScreen(anchor.x, anchor.y);
  ok(Math.abs(screen.x - cursorX) < 1.5, 'zoom-in keeps cursor anchor on screen X');
  ok(Math.abs(screen.y - cursorY) < 1.5, 'zoom-in keeps cursor anchor on screen Y');
}

{
  const cam = makeCamera({ cameraZoom: 2.2, cameraWorldX: 380, cameraWorldY: 310 });
  const anchor = cam.screenToWorld(cursorX, cursorY);
  cam.zoomTo(cursorX, cursorY, cam.zoom / 1.12);
  const screen = cam.worldToScreen(anchor.x, anchor.y);
  ok(Math.abs(screen.x - cursorX) < 2, 'zoom-out keeps cursor anchor on screen X');
  ok(Math.abs(screen.y - cursorY) < 2, 'zoom-out keeps cursor anchor on screen Y');
}

{
  const cam = makeCamera({ cameraZoom: 0.4, cameraWorldX: 430, cameraWorldY: 310 });
  const z0 = cam.zoom;
  const wx0 = cam.worldX;
  const wy0 = cam.worldY;
  cam.zoomTo(cursorX, cursorY, cam.zoom / 1.11);
  ok(cam.zoom === z0, 'zoom-out at minimum zoom is a no-op');
  ok(cam.worldX === wx0 && cam.worldY === wy0, 'min-zoom no-op does not pan camera');
}

{
  const cam = makeCamera({ cameraZoom: 1.8, cameraWorldX: 400, cameraWorldY: 300 });
  const anchor = cam.screenToWorld(cursorX, cursorY);
  cam.zoomTo(cursorX, cursorY, cam.zoom / 1.12);
  const screen = cam.worldToScreen(anchor.x, anchor.y);
  ok(Math.abs(screen.x - cursorX) < 2, 'mid-map zoom-out keeps cursor anchor X');
  ok(Math.abs(screen.y - cursorY) < 2, 'mid-map zoom-out keeps cursor anchor Y');
}

{
  const cam = makeCamera({ cameraZoom: 1.6, cameraWorldX: 420, cameraWorldY: 300 });
  const vpLeft = cam.vp.centerX - cam.vp.width / 2;
  const anchorOff = cam.screenToWorld(0, cursorY);
  const anchorClamped = cam.screenToWorld(vpLeft, cursorY);
  ok(
    Math.abs(anchorOff.x - anchorClamped.x) > 1,
    'off-viewport cursor maps to different world point than viewport edge'
  );
  const camA = makeCamera({ cameraZoom: 1.6, cameraWorldX: 420, cameraWorldY: 300 });
  const camB = makeCamera({ cameraZoom: 1.6, cameraWorldX: 420, cameraWorldY: 300 });
  camA.zoomTo(0, cursorY, camA.zoom * 1.12);
  camB.zoomTo(vpLeft, cursorY, camB.zoom * 1.12);
  ok(
    Math.abs(camA.worldX - camB.worldX) < 1.5,
    'off-viewport zoom uses clamped viewport edge as anchor'
  );
}

{
  const cam = makeCamera({ cameraZoom: 1.24, cameraWorldX: 250, cameraWorldY: 200 });
  cam.clamp();
  ok(cam.worldX === 250, 'zoomed-out view does not snap camera into old locked band');
}

{
  const cam = makeCamera({ cameraZoom: 2.4, cameraWorldX: 410, cameraWorldY: 300 });
  const z0 = cam.zoom;
  cam.zoomTo(20, 360, z0 / 1.15);
  ok(cam.zoom < z0, 'zoom-out from left panel coords reduces zoom');
}

{
  const cam = makeCamera({ cameraZoom: 2.4, cameraWorldX: 410, cameraWorldY: 300 });
  const vpLeft = cam.vp.centerX - cam.vp.width / 2;
  const wxBefore = cam.worldX;
  cam.zoomTo(20, 360, cam.zoom / 1.15);
  ok(cam.zoom < 2.4, 'panel zoom-out reduces zoom level');
  ok(Math.abs(cam.worldX - wxBefore) < 90, 'panel zoom-out does not recenter camera to map middle');
  ok(vpLeft === 84, 'viewport left inset unchanged for panel zoom anchor');
}

{
  const cam = makeCamera({ cameraZoom: 1.2, cameraWorldX: 400, cameraWorldY: 520 });
  const z0 = cam.zoom;
  cam.zoomTo(cam.vp.centerX, cam.vp.centerY, z0 * 1.15);
  ok(cam.zoom > z0, 'zoom-in at map center after focus-style position works');
  cam.zoomTo(cam.vp.centerX, cam.vp.centerY, cam.zoom / 1.15);
  ok(cam.zoom < z0 * 1.15, 'zoom-out at map center after focus-style position works');
}

{
  const cam = makeCamera({ cameraZoom: 0.4, cameraWorldX: 120000, cameraWorldY: -90000 });
  cam.clamp();
  const halfW = cam.vp.width / (2 * 0.9 * cam.zoom);
  ok(cam.worldX - halfW < cam.vp.centerX * 2, 'runaway camera X is pulled back after clamp');
  ok(cam.worldX < 120000, 'extreme zoom-out drift no longer leaves map off-screen');
}

if (failed) {
  console.error(`\n${failed} camera-zoom test(s) failed`);
  process.exit(1);
}
console.log('\nAll camera-zoom tests passed.');