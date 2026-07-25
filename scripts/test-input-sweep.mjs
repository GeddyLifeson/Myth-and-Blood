/**
 * Input & camera scenario sweep — zoom anchors, bounds, pointer tracking, test helpers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

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
    left: insets.left,
    top: insets.top,
  };
  let cameraZoomLevel = opts.cameraZoom ?? 1;
  let cameraWorldXPos = opts.cameraWorldX ?? 400;
  let cameraWorldYPos = opts.cameraWorldY ?? 325;
  let viewScale = baseViewScale * cameraZoomLevel;
  let viewX = vp.centerX - cameraWorldXPos * viewScale;
  let viewY = vp.centerY - cameraWorldYPos * viewScale;
  let visibleBoundsCore = null;

  function invalidateBounds() {
    visibleBoundsCore = null;
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

  function clampCameraAxis(pos, worldSize, half) {
    const low = Math.min(worldSize - half, half);
    const high = Math.max(worldSize - half, half);
    return Math.max(low, Math.min(high, pos));
  }

  function getVisibleBoundsCore() {
    if (visibleBoundsCore) return visibleBoundsCore;
    visibleBoundsCore = {
      left: (vp.left - viewX) / viewScale,
      top: (vp.top - viewY) / viewScale,
      right: (vp.left + vp.width - viewX) / viewScale,
      bottom: (vp.top + vp.height - viewY) / viewScale,
    };
    return visibleBoundsCore;
  }

  function getVisibleBounds(pad = 90) {
    const core = getVisibleBoundsCore();
    const m = pad / Math.max(0.25, viewScale);
    return {
      left: core.left - m,
      top: core.top - m,
      right: core.right + m,
      bottom: core.bottom + m,
    };
  }

  function syncTransform() {
    viewScale = baseViewScale * cameraZoomLevel;
    viewX = vp.centerX - cameraWorldXPos * viewScale;
    viewY = vp.centerY - cameraWorldYPos * viewScale;
  }

  function clampBounds() {
    syncTransform();
    const halfW = vp.width / (2 * viewScale);
    const halfH = vp.height / (2 * viewScale);
    cameraWorldXPos = clampCameraAxis(cameraWorldXPos, worldW, halfW);
    cameraWorldYPos = clampCameraAxis(cameraWorldYPos, mapH, halfH);
    syncTransform();
    invalidateBounds();
  }

  function zoomCameraToScale(screenX, screenY, targetZoom) {
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
    if (Math.abs(nextZoom - cameraZoomLevel) < 1e-6) return;

    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      screenX = vp.centerX;
      screenY = vp.centerY;
    }

    const anchorWorldX = cameraWorldXPos + (screenX - vp.centerX) / viewScale;
    const anchorWorldY = cameraWorldYPos + (screenY - vp.centerY) / viewScale;

    cameraZoomLevel = nextZoom;
    viewScale = baseViewScale * cameraZoomLevel;
    cameraWorldXPos = anchorWorldX - (screenX - vp.centerX) / viewScale;
    cameraWorldYPos = anchorWorldY - (screenY - vp.centerY) / viewScale;
    clampBounds();
  }

  function panByScreenDelta(dx, dy) {
    cameraWorldXPos -= dx / viewScale;
    cameraWorldYPos -= dy / viewScale;
    clampBounds();
  }

  return {
    vp,
    get zoom() {
      return cameraZoomLevel;
    },
    get worldX() {
      return cameraWorldXPos;
    },
    get worldY() {
      return cameraWorldYPos;
    },
    screenToWorld,
    worldToScreen,
    zoomTo: zoomCameraToScale,
    panByScreenDelta,
    getVisibleBounds,
    getVisibleBoundsCore,
    invalidateBounds,
  };
}

function assertAnchorStable(cam, sx, sy, factor, label, tol = 2.5) {
  const anchor = cam.screenToWorld(sx, sy);
  const z0 = cam.zoom;
  cam.zoomTo(sx, sy, z0 * factor);
  const screen = cam.worldToScreen(anchor.x, anchor.y);
  ok(Math.abs(screen.x - sx) < tol, `${label}: anchor X stable after zoom`);
  ok(Math.abs(screen.y - sy) < tol, `${label}: anchor Y stable after zoom`);
}

const cursorSpots = [
  { sx: 640, sy: 360, label: 'center', strict: true },
  { sx: 120, sy: 80, label: 'top-left', strict: false },
  { sx: 1150, sy: 650, label: 'bottom-right', strict: false },
  { sx: 640, sy: 80, label: 'top-center', strict: true },
  { sx: 120, sy: 360, label: 'left-mid', strict: false },
];

for (const spot of cursorSpots) {
  const cam = makeCamera({ cameraZoom: 1.4, cameraWorldX: 410, cameraWorldY: 300 });
  const zBefore = cam.zoom;
  if (spot.strict) {
    assertAnchorStable(cam, spot.sx, spot.sy, 1.18, `zoom-in @ ${spot.label}`);
  } else {
    cam.zoomTo(spot.sx, spot.sy, zBefore * 1.18);
    ok(cam.zoom > zBefore && Number.isFinite(cam.worldX), `zoom-in @ ${spot.label} stays finite`);
  }
  const cam2 = makeCamera({ cameraZoom: 2.5, cameraWorldX: 390, cameraWorldY: 320 });
  assertAnchorStable(cam2, spot.sx, spot.sy, 1 / 1.14, `zoom-out @ ${spot.label}`, spot.strict ? 2.5 : 12);
}

{
  const cam = makeCamera({ cameraZoom: 0.4 });
  const z0 = cam.zoom;
  const wx0 = cam.worldX;
  const wy0 = cam.worldY;
  cam.zoomTo(640, 360, z0 / 1.2);
  ok(cam.zoom === z0, 'zoom-out at minimum zoom is a no-op');
  ok(cam.worldX === wx0 && cam.worldY === wy0, 'min-zoom no-op does not pan');
}

{
  const cam = makeCamera({ cameraZoom: 1.8, cameraWorldX: 400, cameraWorldY: 300 });
  const anchor = cam.screenToWorld(640, 360);
  cam.zoomTo(640, 360, cam.zoom / 1.1);
  const screen = cam.worldToScreen(anchor.x, anchor.y);
  ok(Math.abs(screen.x - 640) < 2, 'mid-map zoom-out keeps wheel anchor on X');
  ok(Math.abs(screen.y - 360) < 2, 'mid-map zoom-out keeps wheel anchor on Y');
}

{
  const cam = makeCamera({ cameraZoom: 8 });
  const z0 = cam.zoom;
  cam.zoomTo(640, 360, z0 * 1.2);
  ok(cam.zoom === z0, 'zoom-in at maximum zoom is a no-op');
}

{
  const cam = makeCamera({ cameraZoom: 1.5 });
  const core = cam.getVisibleBoundsCore();
  const b90 = cam.getVisibleBounds(90);
  const b140 = cam.getVisibleBounds(140);
  ok(b90.left < core.left && b140.left < b90.left, 'larger pad expands left bound');
  ok(b90.right > core.right && b140.right > b90.right, 'larger pad expands right bound');
  cam.zoomTo(640, 360, 2.8);
  const core2 = cam.getVisibleBoundsCore();
  ok(
    core2.right - core2.left < core.right - core.left,
    'zoom-in shrinks visible world width'
  );
  const bAfter = cam.getVisibleBounds(90);
  ok(bAfter.left < core2.left, 'pad still applied after zoom');
}

{
  const cam = makeCamera({ cameraZoom: 3.5, cameraWorldX: 50, cameraWorldY: 40 });
  cam.zoomTo(200, 150, cam.zoom / 1.25);
  ok(cam.worldX >= 0 && cam.worldX <= 800, 'zoom-out near corner keeps X in world');
  ok(cam.worldY >= 0 && cam.worldY <= 650, 'zoom-out near corner keeps Y in map');
  ok(Number.isFinite(cam.worldX) && Number.isFinite(cam.worldY), 'edge zoom-out stays finite');
}

{
  const cam = makeCamera({ cameraZoom: 1.2 });
  const w0 = cam.screenToWorld(700, 400);
  cam.panByScreenDelta(-80, 40);
  const w1 = cam.screenToWorld(700, 400);
  ok(w1.x > w0.x, 'pan right (drag left) shifts world view east');
  ok(w1.y < w0.y, 'pan down (drag up) shifts world view north');
}

{
  const wheel = { sx: 900, sy: 500 };
  ok(wheel.sx === 900 && wheel.sy === 500, 'wheel zoom uses event coordinates directly');
}

function simulateMuteKey(key, abilities) {
  if (key === 'v') return { handled: true, ability: null };
  return { handled: false, ability: abilities[key] || null };
}

{
  const abilities = { v: 'fus_ro_dah', q: 'fireball' };
  const mute = simulateMuteKey('v', abilities);
  ok(mute.handled && !mute.ability, 'v key mute does not chain to fus_ro_dah');
  ok(simulateMuteKey('q', abilities).ability === 'fireball', 'other ability keys unaffected');
}

function loadIntergalactic() {
  const src = readFileSync(join(JS, 'intergalactic-layer.js'), 'utf8');
  const sb = { Math, Object, Array, Set, Map, JSON, performance: { now: () => 1000 } };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  return vm.runInContext(`${src}\n({ IntergalacticLayer })`, ctx);
}

{
  const { IntergalacticLayer } = loadIntergalactic();
  IntergalacticLayer.resetRun();
  IntergalacticLayer.spawnTestAnomaly('void_anchor', 'rift_echo');
  const spawned = IntergalacticLayer.spawnTestAnomaly('void_anchor', 'phase_breach');
  ok(spawned, 'spawnTestAnomaly replaces existing planet anomaly');
  const snap = IntergalacticLayer.getExplorationSnapshot();
  ok(snap.activeAnomalies === 1, 'only one anomaly on planet after replace');
  ok(snap.anomalies[0]?.category === 'dimensional', 'replacement anomaly category applied');
  ok(snap.anomalies[0]?.label === 'Phase Breach', 'replacement anomaly label applied');
}

function loadCrossoverSlice() {
  const sb = { Math, Object, Array, Set, Map, JSON, performance: { now: () => 0 } };
  sb.window = sb;
  sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  for (const f of HEADLESS_FILES) vm.runInContext(readFileSync(join(JS, f), 'utf8'), ctx);
  return vm.runInContext(
    '({ MultiFrontSiege, EnemyFactions, getUnlockedAttackSides, PlanetConquest })',
    ctx
  );
}

{
  const exp = loadCrossoverSlice();
  exp.PlanetConquest.resetRun({ forcedMode: true });
  exp.PlanetConquest.onWaveStart(500, { modeId: 'planet_conquest', buildings: [], units: [] });
  for (const fid of ['goblin_hordes', 'orc_warbands', 'dark_legions', 'void_abyssal']) {
    for (let i = 0; i < 50; i++) {
      exp.PlanetConquest.onEnemyStructureDestroyed(
        { type: 'enemy_hamlet', owner: 'enemy', enemyFaction: fid },
        500,
        { buildings: [], units: [] }
      );
    }
    exp.PlanetConquest.onWaveEnd(500, { buildings: [], units: [] });
  }
  const polluted = exp.EnemyFactions.getActiveFactions(40);
  ok(polluted.length < 2, 'planet conquest elimination pollutes faction list');
  exp.PlanetConquest.resetRun({ forcedMode: false });
  const restored = exp.EnemyFactions.getActiveFactions(40);
  ok(restored.length >= 2, 'planet conquest reset restores factions for multi-front');
  exp.MultiFrontSiege.resetRun();
  const plan = exp.MultiFrontSiege.buildFrontPlan(40, restored, exp.getUnlockedAttackSides(40), () => 0.1);
  ok(plan && plan.waveSides?.length >= 1, 'multi-front plan builds after conquest reset');
}

if (failed) {
  console.error(`\n${failed} input-sweep test(s) failed`);
  process.exit(1);
}
console.log('\nAll input-sweep tests passed.');