/**
 * Camera input routing + focus guards — mirrors main.js / game.js contracts.
 */
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const insets = { left: 84, right: 78, top: 52, bottom: 40 };
const canvasW = 1280;
const canvasH = 720;
const vp = {
  left: insets.left,
  top: insets.top,
  width: canvasW - insets.left - insets.right,
  height: canvasH - insets.top - insets.bottom,
  centerX: insets.left + (canvasW - insets.left - insets.right) / 2,
  centerY: insets.top + (canvasH - insets.top - insets.bottom) / 2,
};

function isScreenInMapViewport(sx, sy) {
  return (
    sx >= vp.left &&
    sx <= vp.left + vp.width &&
    sy >= vp.top &&
    sy <= vp.top + vp.height
  );
}

function isScreenInMapArea(sx, sy) {
  return (
    sx >= insets.left &&
    sx <= canvasW - insets.right &&
    sy >= insets.top &&
    sy <= canvasH
  );
}

function clampScreenToViewport(sx, sy) {
  return {
    sx: Math.max(vp.left, Math.min(vp.left + vp.width, sx)),
    sy: Math.max(vp.top, Math.min(vp.top + vp.height, sy)),
  };
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

function panelCanWheelScroll(panel, deltaY) {
  if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return false;
  if (deltaY > 0) return panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1;
  return panel.scrollTop > 0;
}

function shouldMapWheelZoom(deltaY, sx, sy, sidePanel = null) {
  const zoomingOut = deltaY > 0;
  if (isScreenInMapArea(sx, sy)) return true;
  if (sidePanel && panelCanWheelScroll(sidePanel, deltaY)) return false;
  return zoomingOut;
}

function makeCamera(opts = {}) {
  const worldW = opts.worldW ?? 800;
  const mapH = opts.mapH ?? 650;
  const baseViewScale = opts.baseViewScale ?? 0.9;
  const minZoom = 0.4;
  const maxZoom = 8;
  let cameraZoomLevel = opts.cameraZoom ?? 1;
  let cameraWorldXPos = opts.cameraWorldX ?? 400;
  let cameraWorldYPos = opts.cameraWorldY ?? 325;
  let viewScale = baseViewScale * cameraZoomLevel;

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

  function mapOverlapsViewport(worldX, worldY) {
    viewScale = baseViewScale * cameraZoomLevel;
    const mapLeft = vp.centerX - worldX * viewScale;
    const mapTop = vp.centerY - worldY * viewScale;
    const mapRight = mapLeft + worldW * viewScale;
    const mapBottom = mapTop + mapH * viewScale;
    const vpRight = vp.left + vp.width;
    const vpBottom = vp.top + vp.height;
    return mapLeft < vpRight && mapRight > vp.left && mapTop < vpBottom && mapBottom > vp.top;
  }

  function clampBounds() {
    viewScale = baseViewScale * cameraZoomLevel;
    const halfW = vp.width / (2 * viewScale);
    const halfH = vp.height / (2 * viewScale);
    const edgeMargin = 2 / Math.max(viewScale, 0.01);
    cameraWorldXPos = clampCameraAxis(cameraWorldXPos, worldW, halfW, edgeMargin);
    cameraWorldYPos = clampCameraAxis(cameraWorldYPos, mapH, halfH, edgeMargin);
  }

  function zoomTo(screenX, screenY, targetZoom) {
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
    if (Math.abs(nextZoom - cameraZoomLevel) < 1e-6) return false;
    ({ sx: screenX, sy: screenY } = resolveZoomAnchor(screenX, screenY));
    const anchorWorldX = cameraWorldXPos + (screenX - vp.centerX) / viewScale;
    const anchorWorldY = cameraWorldYPos + (screenY - vp.centerY) / viewScale;
    cameraZoomLevel = nextZoom;
    viewScale = baseViewScale * cameraZoomLevel;
    cameraWorldXPos = anchorWorldX - (screenX - vp.centerX) / viewScale;
    cameraWorldYPos = anchorWorldY - (screenY - vp.centerY) / viewScale;
    clampBounds();
    return true;
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
    zoomTo,
    clampBounds,
    mapOverlapsViewport: (wx, wy) => mapOverlapsViewport(wx, wy),
  };
}

function makeFocusSelection(hasSelection, unitsAlive = 1) {
  if (!hasSelection) return { ok: false, reason: 'no-selection' };
  if (!unitsAlive) return { ok: false, reason: 'no-living' };
  return { ok: true, worldX: 420, worldY: 300 };
}

// --- map area vs viewport (unit panel / hint bar live in map area, not strict viewport)
const unitPanelY = canvasH - 36;
{
  ok(isScreenInMapViewport(vp.centerX, unitPanelY) === false, 'unit panel row is outside strict viewport');
  ok(isScreenInMapArea(vp.centerX, unitPanelY) === true, 'unit panel row is inside map area for wheel');
}

{
  ok(shouldMapWheelZoom(-120, vp.centerX, unitPanelY) === true, 'zoom-in allowed over unit panel band');
  ok(shouldMapWheelZoom(120, vp.centerX, unitPanelY) === true, 'zoom-out allowed over unit panel band');
}

{
  ok(shouldMapWheelZoom(-120, 40, vp.centerY) === false, 'zoom-in blocked over left panel');
  ok(shouldMapWheelZoom(120, 40, vp.centerY) === true, 'zoom-out allowed over left panel');
}

{
  const panel = { scrollHeight: 2000, clientHeight: 400, scrollTop: 0 };
  ok(
    shouldMapWheelZoom(120, 40, vp.centerY, panel) === false,
    'panel scroll takes priority over map zoom-out'
  );
  ok(
    shouldMapWheelZoom(120, 40, vp.centerY, { ...panel, scrollTop: 1600 }) === true,
    'map zoom-out when panel cannot scroll further'
  );
}

// --- anchor: no spurious recenter on zoom-out from side panel
{
  const wxBefore = 410;
  const cam = makeCamera({ cameraZoom: 2, cameraWorldX: wxBefore, cameraWorldY: 300 });
  const anchor = resolveZoomAnchor(30, vp.centerY);
  ok(anchor.sx === vp.left, 'side-panel zoom anchor clamps to viewport edge not center');
  cam.zoomTo(30, vp.centerY, cam.zoom / 1.2);
  ok(Math.abs(cam.worldX - wxBefore) < 80, 'zoom-out from side panel does not fling camera to map center');
}

// --- in-viewport uses exact cursor (not edge clamp)
{
  const anchor = resolveZoomAnchor(vp.centerX + 40, vp.centerY + 30);
  ok(anchor.sx === vp.centerX + 40 && anchor.sy === vp.centerY + 30, 'in-viewport zoom uses exact cursor');
}

// --- focus guard
{
  ok(makeFocusSelection(false).ok === false, 'focus without selection is rejected');
  ok(makeFocusSelection(true, 0).ok === false, 'focus with dead selection is rejected');
  ok(makeFocusSelection(true, 2).ok === true, 'focus with living selection is allowed');
}

// --- zoom in/out cycle at map center (post-focus)
{
  const cam = makeCamera({ cameraZoom: 1.5, cameraWorldX: 400, cameraWorldY: 520 });
  const z0 = cam.zoom;
  ok(cam.zoomTo(vp.centerX, vp.centerY, z0 * 1.2), 'zoom-in applies at map center');
  ok(cam.zoomTo(vp.centerX, vp.centerY, cam.zoom / 1.2), 'zoom-out applies at map center');
  ok(cam.zoom < z0 * 1.2, 'zoom-out after zoom-in restores lower level');
}

// --- alternating zoom over bottom HUD strip must always change zoom level
{
  const cam = makeCamera({ cameraZoom: 1.8, cameraWorldX: 400, cameraWorldY: 300 });
  const hudY = canvasH - 20;
  ok(isScreenInMapArea(vp.centerX, hudY), 'hint bar band counts as map area');
  const z0 = cam.zoom;
  ok(cam.zoomTo(vp.centerX, hudY, z0 * 1.15), 'zoom-in over bottom HUD band');
  ok(cam.zoomTo(vp.centerX, hudY, cam.zoom / 1.15), 'zoom-out over bottom HUD band');
}

// --- extreme camera drift is pulled back so map stays on screen
{
  const cam = makeCamera({ cameraZoom: 0.4, cameraWorldX: 50000, cameraWorldY: -40000 });
  cam.clampBounds();
  ok(cam.mapOverlapsViewport(cam.worldX, cam.worldY), 'clamped camera keeps map overlapping viewport after drift');
  ok(cam.worldX < 50000 && cam.worldY > -40000, 'drifted camera position was corrected');
}

// --- zoomed-out pan does not snap into narrow center band
{
  const cam = makeCamera({ cameraZoom: 1.24, cameraWorldX: 250, cameraWorldY: 320 });
  cam.clampBounds();
  ok(cam.worldX === 250, 'valid zoomed-out X is not forced to map center');
}

if (failed) {
  console.error(`\n${failed} camera-system test(s) failed`);
  process.exit(1);
}
console.log('\nAll camera-system tests passed.');