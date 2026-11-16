/**
 * Steering, overlaps, paths, move orders and stuck recovery.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameMovement = (() => {
  const {
    UNIT_COLLISION,
    builderHasWork,
    clearHoldPost,
    enemyIsAdvancing,
    getGfxQuality,
    isBuildingPathTarget,
    manualMoveReached,
    pathClearanceForUnit,
    posDistSq,
    releaseCombatPursuit,
    svc,
    unitBlocksMovement,
  } = GameCore;
  const GS = GameState;
  const {
    allObstacles,
    buildUpdateThrottleCtx,
    clampPos,
    getBiomeModifiersAt,
    obstacleBlocksForUnit,
    useSpatialQueries,
  } = GameField;
  const { isInView } = GameCamera;
  const { getSelectedLiveUnits, getSelectedUnitIds } = GameInput;
  const {
    applyGlobalHuntState,
    enterHoldStance,
    isHoldPlanted,
    isHoldStance,
    setUnitPost,
    unitHasActiveMarch,
  } = GameStance;
  const { ALLY_MOVE_MARGIN, getPursuitTarget, isCrowdedOut, isPursuableFoe, retargetIfHunting } =
    GameMorale;
  const { findTacticalTarget, getSurroundSlot, inAttackRange } = GameTargeting;
  let findNearestAttackableEnemyBuilding,
    getBuildingApproachPoint,
    getBuildingPursuitTarget,
    getEnemyStructureSeekDist,
    getUnitById,
    hasPendingOutpostGarrison,
    inBuildingAttackRange,
    isMarchingToKeep,
    isMarchingToWallSlot,
    isNightPhase,
    releaseFromGarrison,
    releaseFromKeep,
    releaseFromWallGarrison,
    shouldPrioritizeEnemyStructure,
    showMessage,
    syncInteractionState;
  function bind(api) {
    ({
      findNearestAttackableEnemyBuilding,
      getBuildingApproachPoint,
      getBuildingPursuitTarget,
      getEnemyStructureSeekDist,
      getUnitById,
      hasPendingOutpostGarrison,
      inBuildingAttackRange,
      isMarchingToKeep,
      isMarchingToWallSlot,
      isNightPhase,
      releaseFromGarrison,
      releaseFromKeep,
      releaseFromWallGarrison,
      shouldPrioritizeEnemyStructure,
      showMessage,
      syncInteractionState,
    } = api);
  }

  const overlapNeighborsScratch = [];
  const PATH_BUDGET_WARN_INTERVAL = 120;

  function isTerrainBlockedAt(x, y, unit, clearance) {
    const scanRadius = clearance + 56;
    if (useSpatialQueries()) {
      const near = svc('Spatial').queryStaticInto(x, y, scanRadius, svc('Spatial')._scratch);
      for (let ni = 0; ni < near.length; ni++) {
        const d = near[ni];
        if (!obstacleBlocksForUnit(d, unit)) continue;
        const tr = terrainBlockRadius(d);
        if (tr <= 0) continue;
        const blockR = tr + clearance;
        if (posDistSq(x, y, d.x, d.y) < blockR * blockR) return true;
      }
      return false;
    }
    for (const d of allObstacles()) {
      if (!obstacleBlocksForUnit(d, unit)) continue;
      const blockR = (d.radius || 14) + clearance;
      if (posDistSq(x, y, d.x, d.y) < blockR * blockR) return true;
    }
    return false;
  }

  function isTerrainBlockedForPath(x, y, unit) {
    return isTerrainBlockedAt(x, y, unit, pathClearanceForUnit(unit));
  }

  function isTerrainBlocked(x, y, unit) {
    return isTerrainBlockedAt(x, y, unit, UNIT_COLLISION + 2);
  }

  function isBlocked(x, y, unit, margin = ALLY_MOVE_MARGIN) {
    if (isTerrainBlocked(x, y, unit)) return true;
    // Manual click-to-move: soft-pass through allies, enemies, and neutrals.
    // Only solid terrain/buildings/props hard-block so ordered units never freeze in crowds.
    if (unit?.manualOrder) return false;
    const r = UNIT_COLLISION + margin;
    const r2 = r * r;
    const foeR2 = r * 0.35 * (r * 0.35);
    const hordeTightR2 = foeR2;
    const hordeLooseR2 = r * 0.55 * (r * 0.55);
    // Cache once — unitHasActiveMarch scans all walls/keeps (expensive in castle fights).
    const unitMarching = unit ? unitHasActiveMarch(unit) : false;
    const allyR = unitMarching ? r * 0.4 : r;
    const allyR2 = allyR * allyR;
    if (!useSpatialQueries()) {
      for (const u of GS.units) {
        if (u === unit || !unitBlocksMovement(u)) continue;
        const d2 = posDistSq(x, y, u.x, u.y);
        if (!unit) {
          if (d2 < r2) return true;
          continue;
        }
        if (unit.team === 'enemy' && u.team === 'player') {
          if (d2 < foeR2) return true;
          continue;
        }
        if (unit.team === 'player' && u.team === 'enemy') {
          if (d2 < foeR2) return true;
          continue;
        }
        // Hostile neutrals: soft-block like enemy so units can close to melee at map edges.
        if (
          (u.team === 'neutral' || u.isNeutral) &&
          (unit.team === 'player' || unit.team === 'enemy')
        ) {
          if (d2 < foeR2) return true;
          continue;
        }
        if (
          (unit.team === 'neutral' || unit.isNeutral) &&
          (u.team === 'player' || u.team === 'enemy')
        ) {
          if (d2 < foeR2) return true;
          continue;
        }
        if (u.team === unit.team) {
          if (d2 < allyR2) return true;
          continue;
        }
        if (unit.team === 'enemy' && u.team === 'enemy') {
          const hordeR2 =
            enemyIsAdvancing(unit) || enemyIsAdvancing(u) ? hordeTightR2 : hordeLooseR2;
          if (d2 < hordeR2) return true;
        }
      }
      return false;
    }
    let blocked = false;
    svc('Spatial').forUnitsInRadius(x, y, r + 8, (entry) => {
      if (blocked || entry.kind !== 'unit') return;
      const u = entry.ref;
      if (u === unit || !unitBlocksMovement(u)) return;
      const d2 = posDistSq(x, y, u.x, u.y);
      if (!unit) {
        if (d2 < r2) blocked = true;
        return;
      }
      if (unit.team === 'enemy' && u.team === 'player') {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (unit.team === 'player' && u.team === 'enemy') {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (
        (u.team === 'neutral' || u.isNeutral) &&
        (unit.team === 'player' || unit.team === 'enemy')
      ) {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (
        (unit.team === 'neutral' || unit.isNeutral) &&
        (u.team === 'player' || u.team === 'enemy')
      ) {
        if (d2 < foeR2) blocked = true;
        return;
      }
      if (u.team === unit.team) {
        if (d2 < allyR2) blocked = true;
        return;
      }
      if (unit.team === 'enemy' && u.team === 'enemy') {
        const hordeR2 = enemyIsAdvancing(unit) || enemyIsAdvancing(u) ? hordeTightR2 : hordeLooseR2;
        if (d2 < hordeR2) blocked = true;
      }
    });
    return blocked;
  }

  function nudgeUnitFree(unit) {
    const solidOnly = !!unit?.manualOrder;
    const jammed =
      isTerrainBlocked(unit.x, unit.y, unit) || (!solidOnly && isBlocked(unit.x, unit.y, unit, 0));
    if (!jammed) return false;
    // Prefer sliding toward the ordered destination when stuck on props/buildings.
    let preferAngle = null;
    if (unit.targetX != null && unit.targetY != null) {
      preferAngle = Math.atan2(unit.targetY - unit.y, unit.targetX - unit.x);
    }
    for (let ring = 8; ring <= 56; ring += 8) {
      for (let i = 0; i < 16; i++) {
        const base =
          preferAngle != null ? preferAngle + (i / 16) * Math.PI * 2 : (i / 16) * Math.PI * 2;
        const pos = clampPos(unit.x + Math.cos(base) * ring, unit.y + Math.sin(base) * ring);
        const free = solidOnly
          ? !isTerrainBlocked(pos.x, pos.y, unit)
          : !isTerrainBlocked(pos.x, pos.y, unit) && !isBlocked(pos.x, pos.y, unit, 0);
        if (free) {
          unit.x = pos.x;
          unit.y = pos.y;
          return true;
        }
      }
    }
    return false;
  }

  function separationVector(unit) {
    let sx = 0;
    let sy = 0;
    let allies;
    if (useSpatialQueries()) {
      svc('Spatial').queryTeamInto(
        unit.x,
        unit.y,
        UNIT_COLLISION * 4,
        unit.team,
        unit,
        svc('Spatial')._scratch
      );
      allies = svc('Spatial')._scratch;
    } else {
      allies = GS.units;
    }
    for (const u of allies) {
      if (u === unit || !unitBlocksMovement(u) || u.team !== unit.team) continue;
      const dx = unit.x - u.x,
        dy = unit.y - u.y;
      const d = Math.hypot(dx, dy);
      let minD = UNIT_COLLISION * (unit.team === 'enemy' ? 2.2 : 2.8);
      if (unit.team === 'enemy' && (enemyIsAdvancing(unit) || enemyIsAdvancing(u))) minD *= 0.55;
      if (unit.team === 'player' && unitHasActiveMarch(unit)) minD *= 0.55;
      if (d < minD && d > 0.01) {
        const push = (minD - d) / minD;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }
    return { x: sx, y: sy };
  }

  const AVOID_LOOK = 46;
  const avoidOut = { x: 0, y: 0 };
  // Off the unit object so saves and co-op snapshots never carry it.
  const avoidMemo = new WeakMap();

  // Ally or neutral in the way that is not walking our way; foes are left alone so melee can close.
  function unitIsInTheWay(unit, u, dirX, dirY) {
    if (u === unit || !unitBlocksMovement(u)) return false;
    if (u.team !== unit.team && !(u.team === 'neutral' || u.isNeutral)) return false;
    if (u.targetX == null || u.targetY == null) return true;
    const hx = u.targetX - u.x,
      hy = u.targetY - u.y;
    const hl = Math.hypot(hx, hy);
    return hl < 4 || (hx * dirX + hy * dirY) / hl < 0.7;
  }

  /**
   * Sideways push away from the nearest thing on the line ahead (trees, rocks, buildings,
   * standing people), so units curve around it instead of walking into it. Keeps the side
   * it picked for an obstacle until it is past, so it does not dither left and right.
   */
  function avoidanceVector(unit, dirX, dirY, dist) {
    avoidOut.x = 0;
    avoidOut.y = 0;
    const look = Math.min(AVOID_LOOK, dist);
    if (look < 6) return avoidOut;
    const clear = UNIT_COLLISION + 4;
    let bestT = look,
      bestLat = 0,
      bestR = 0,
      bestKey = null;
    const consider = (ox, oy, r, key) => {
      const rx = ox - unit.x,
        ry = oy - unit.y;
      const t = rx * dirX + ry * dirY;
      // Something standing on the destination itself is for arrival and separation to sort out.
      if (t <= 0 || t - r >= bestT || t >= dist - 4) return;
      const lat = rx * -dirY + ry * dirX;
      const reach = r + clear;
      if (Math.abs(lat) >= reach) return;
      bestT = Math.max(0, t - r);
      bestLat = lat;
      bestR = reach;
      bestKey = key;
    };
    const scanR = look + 40;
    if (useSpatialQueries()) {
      const sp = svc('Spatial');
      const near = sp.queryStaticInto(unit.x, unit.y, scanR, sp._scratch);
      for (let i = 0; i < near.length; i++) {
        const d = near[i];
        if (!obstacleBlocksForUnit(d, unit)) continue;
        const r = terrainBlockRadius(d.ref || d);
        if (r > 0) consider(d.x, d.y, r, d.ref || d);
      }
      // Hordes on the advance push straight through each other; that pace is deliberate.
      if (!(unit.team === 'enemy' && enemyIsAdvancing(unit))) {
        sp.forUnitsInRadius(unit.x, unit.y, look + UNIT_COLLISION, (entry) => {
          if (entry.kind !== 'unit') return;
          const u = entry.ref;
          if (unitIsInTheWay(unit, u, dirX, dirY)) consider(u.x, u.y, UNIT_COLLISION, u);
        });
      }
    } else {
      for (const d of allObstacles()) {
        if (obstacleBlocksForUnit(d, unit)) consider(d.x, d.y, d.radius || 14, d.ref || d);
      }
      if (!(unit.team === 'enemy' && enemyIsAdvancing(unit))) {
        for (const u of GS.units) {
          if (posDistSq(unit.x, unit.y, u.x, u.y) > scanR * scanR) continue;
          if (unitIsInTheWay(unit, u, dirX, dirY)) consider(u.x, u.y, UNIT_COLLISION, u);
        }
      }
    }
    const memo = avoidMemo.get(unit);
    if (!bestKey) {
      if (memo) memo.key = null;
      return avoidOut;
    }
    let side = bestLat > 0 ? -1 : 1;
    if (memo?.key === bestKey) side = memo.side;
    // Dead ahead: keep right, so two people walking at each other pass instead of mirroring.
    else if (Math.abs(bestLat) < 3) side = 1;
    if (memo) {
      memo.key = bestKey;
      memo.side = side;
    } else avoidMemo.set(unit, { key: bestKey, side });
    // Stronger the closer and more head-on the obstacle is.
    const urgency =
      ((1 - bestT / look) * (1 - Math.abs(bestLat) / bestR) + 0.25) * Math.min(1, dist / 48);
    avoidOut.x = -dirY * side * urgency * 1.6;
    avoidOut.y = dirX * side * urgency * 1.6;
    return avoidOut;
  }

  function steerToward(unit, tx, ty) {
    const dx = tx - unit.x,
      dy = ty - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return false;

    const doctrineSpd = (unit.doctrineSpeedTimer || 0) > 0 ? unit.doctrineSpeedMult || 1 : 1;
    const biomeSpd = getBiomeModifiersAt(unit.x, unit.y).speedMult || 1;
    let mapEvtSpd = 1;
    if (unit.team === 'player' && svc('DynamicMapEvents')) {
      mapEvtSpd = svc('DynamicMapEvents').getActiveMods().playerSpeedMult || 1;
    }
    const speed =
      unit.speed *
      (unit.hazardSlow || 1) *
      doctrineSpd *
      biomeSpd *
      mapEvtSpd *
      (unit.combatType === 'cavalry' ? 1.4 : 1.15);
    const sep = separationVector(unit);
    // Manual orders bias hard toward the click; keep light separation so crowds don't pin them.
    const sepWeight = unit.manualOrder
      ? 0.28
      : unit.team === 'enemy' && enemyIsAdvancing(unit)
        ? 0.35
        : unit.team === 'player' && unitHasActiveMarch(unit)
          ? 0.55
          : 1.4;
    const av = avoidanceVector(unit, dx / dist, dy / dist, dist);
    let ux = dx / dist + sep.x * sepWeight + av.x;
    let uy = dy / dist + sep.y * sepWeight + av.y;
    const ulen = Math.hypot(ux, uy) || 1;
    ux /= ulen;
    uy /= ulen;

    const candidates = [{ x: ux, y: uy, w: 4 }];

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const vx = Math.cos(angle),
        vy = Math.sin(angle);
      const dot = vx * ux + vy * uy;
      if (dot > -0.35) candidates.push({ x: vx, y: vy, w: 1.5 + dot });
    }

    candidates.sort((a, b) => b.w - a.w);
    for (const c of candidates) {
      const step = Math.min(speed, dist);
      const pos = clampPos(unit.x + c.x * step, unit.y + c.y * step);
      if (!isBlocked(pos.x, pos.y, unit, 0)) {
        unit.x = pos.x;
        unit.y = pos.y;
        return true;
      }
    }
    // Slide along solid props/buildings with shorter steps (manual or any march).
    if (unit.manualOrder || unitHasActiveMarch(unit)) {
      for (const c of candidates) {
        for (const frac of [0.55, 0.3, 0.12]) {
          const step = Math.min(speed * frac, dist);
          if (step < 0.2) continue;
          const pos = clampPos(unit.x + c.x * step, unit.y + c.y * step);
          if (!isTerrainBlocked(pos.x, pos.y, unit)) {
            if (unit.manualOrder || !isBlocked(pos.x, pos.y, unit, 0)) {
              unit.x = pos.x;
              unit.y = pos.y;
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function resolveOverlaps() {
    const n = GS.units.length;
    if (n < 2) return;
    if (GS.updateTick % 2 !== 0 && n > 24) return;
    if (GS.updateTick % 4 !== 0 && n > 70) return;
    if (GS.updateTick % 6 !== 0 && n > 110) return;
    const cellSize = 36;
    const grid = new Map();
    for (let i = 0; i < n; i++) {
      const u = GS.units[i];
      // Runners leave past the edge; the clamp below would hold them inside the field for good.
      if (!unitBlocksMovement(u) || u.fleeing) continue;
      const key = `${Math.floor(u.x / cellSize)},${Math.floor(u.y / cellSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    const minSep = UNIT_COLLISION + 1;
    const seen = new Set();
    for (const [key, indices] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      overlapNeighborsScratch.length = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get(`${cx + ox},${cy + oy}`);
          if (bucket) {
            for (let bi = 0; bi < bucket.length; bi++) overlapNeighborsScratch.push(bucket[bi]);
          }
        }
      }
      const neighbors = overlapNeighborsScratch;
      for (const i of indices) {
        const a = GS.units[i];
        if (!unitBlocksMovement(a)) continue;
        for (const j of neighbors) {
          if (j <= i) continue;
          const pairKey = i < j ? `${i}:${j}` : `${j}:${i}`;
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);
          const b = GS.units[j];
          if (!unitBlocksMovement(b)) continue;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (dist >= minSep) continue;
          const aHold = isHoldPlanted(a);
          const bHold = isHoldPlanted(b);
          if (dist < 0.01) {
            // Never jitter units planted on a hold post.
            if (aHold || bHold) continue;
            a.x += (Math.random() - 0.5) * 8;
            a.y += (Math.random() - 0.5) * 8;
            continue;
          }
          const sameTeam = a.team === b.team;
          // Planted hold posts: never shove the station-keeper. Other body yields.
          if (aHold && bHold) continue;
          let push = (minSep - dist) * (sameTeam ? 0.45 : 0.25);
          if (sameTeam && (unitHasActiveMarch(a) || unitHasActiveMarch(b))) push *= 0.25;
          if (
            !sameTeam &&
            a.team === 'enemy' &&
            b.team === 'enemy' &&
            (enemyIsAdvancing(a) || enemyIsAdvancing(b))
          )
            push *= 0.3;
          // Manual orders: do not shove the mover back off their click destination.
          if (a.manualOrder || b.manualOrder) push *= 0.12;
          // Engaged pairs (incl. hostile neutrals) must not be shoved apart at map edges.
          if (
            !sameTeam &&
            (a.combatTargetId === b.id ||
              b.combatTargetId === a.id ||
              a.team === 'neutral' ||
              b.team === 'neutral' ||
              a.isNeutral ||
              b.isNeutral)
          ) {
            push *= 0.06;
          }
          const nx = dx / dist,
            ny = dy / dist;
          const ca = clampPos(a.x - nx * push, a.y - ny * push);
          const cb = clampPos(b.x + nx * push, b.y + ny * push);
          if (!aHold && !isBlocked(ca.x, ca.y, a, 0)) {
            a.x = ca.x;
            a.y = ca.y;
          }
          if (!bHold && !isBlocked(cb.x, cb.y, b, 0)) {
            b.x = cb.x;
            b.y = cb.y;
          }
        }
      }
    }
  }

  function expireStalePendingPaths() {
    for (const unit of GS.units) {
      if (!unit.pathPending || unit.hp <= 0) {
        unit.pathWaitTicks = 0;
        continue;
      }
      unit.pathWaitTicks = (unit.pathWaitTicks || 0) + 1;
      // Fail faster — 40 ticks left armies frozen after grid invalidation (castle complete).
      if (unit.pathWaitTicks < 12) continue;
      unit.pathWaitTicks = 0;
      unit.pathPending = false;
      unit.pathReqId = null;
      if (unit.targetX == null || unit.targetY == null) continue;
      if (isBuildingPathTarget(unit.pathTargetId)) {
        const bld = getBuildingPursuitTarget(unit);
        if (bld) pathToEnemyStructure(unit, bld, { force: true, sync: true, recalcInterval: 0 });
        else setUnitPath(unit, unit.targetX, unit.targetY, null, { force: true, sync: true });
        continue;
      }
      const dest =
        unit.pathTargetId && unit.pathTargetId !== 'advance'
          ? getUnitById(unit.pathTargetId)
          : null;
      setUnitPath(unit, unit.targetX, unit.targetY, dest, { force: true, sync: true });
      // Any team still stuck after force sync: direct waypoint so AI never freezes mid-map.
      if (!unit.path?.length && unit.targetX != null && unit.targetY != null) {
        unit.path = [{ x: unit.targetX, y: unit.targetY }];
        unit.pathIndex = 0;
        unit.pathPending = false;
        unit.pathReqId = null;
      }
    }
  }

  function applyWorkerPathResults() {
    const bridge = svc('PathWorkerBridge');
    if (!bridge) return;
    const gridGen = bridge.getGridGen?.() ?? 0;
    for (const msg of bridge.drainPathResults()) {
      const unit = getUnitById(msg.unitId);
      if (!unit || unit.hp <= 0) continue;
      if (msg.gen != null && msg.gen !== gridGen) {
        if (unit.pathPending && (unit.pathReqId == null || unit.pathReqId === msg.id)) {
          GameRuntime.clearPathTrack(unit, { keepTargets: true, keepManual: unit.manualOrder });
          unit.pathRecalc = 0;
        }
        continue;
      }
      if (unit.pathReqId != null && unit.pathReqId !== msg.id) continue;
      let path = [];
      if (msg.path?.length) {
        if (!unit.path) unit.path = [];
        unit.path.length = 0;
        for (let pi = 0; pi < msg.path.length; pi++) {
          const p = msg.path[pi];
          unit.path.push({ x: p.x, y: p.y });
        }
        path = unit.path;
      } else if (unit.targetX != null && unit.targetY != null && svc('Pathfinding')) {
        path = svc('Pathfinding').findPath(
          unit.x,
          unit.y,
          unit.targetX,
          unit.targetY,
          unit,
          isTerrainBlockedForPath
        );
      }
      GameRuntime.applyPathToUnit(unit, path);
    }
  }

  function setUnitPath(unit, tx, ty, targetUnit = null, pathOpts = {}) {
    let destX = tx,
      destY = ty;
    if (targetUnit) {
      const slot = getSurroundSlot(unit, targetUnit);
      destX = slot.x;
      destY = slot.y;
    }
    const gfxQ = getGfxQuality();
    const throttle = svc('UpdateThrottle');
    let tier = 'full';
    if (throttle) {
      const throttleCtx = GS.updateThrottleCtx || buildUpdateThrottleCtx(GS.units.length, gfxQ);
      tier = throttle.getUnitTier(unit, throttleCtx);
      if (!pathOpts.force && !throttle.shouldPathfind(unit, tier, GS.updateTick)) return false;
    }
    const inView = isInView(unit.x, unit.y, 80, 0);
    const viewOffscreen = !inView;
    if (viewOffscreen && GS.pathfindBudget <= 0) return false;
    if (viewOffscreen) GS.pathfindBudget--;
    if (svc('Perf')) svc('Perf').begin('path');
    const maxNodes = throttle
      ? throttle.offscreenPathMaxNodes(tier)
      : viewOffscreen
        ? 600
        : undefined;
    const pathMaxNodes = tier === 'full' && inView ? undefined : maxNodes;
    const bridge = svc('PathWorkerBridge');
    if (unit.pathPending && !pathOpts.force && !pathOpts.sync) {
      if (svc('Perf')) svc('Perf').end('path');
      return false;
    }
    if (bridge?.shouldAsyncPath(unit, pathOpts)) {
      unit.pathReqId = bridge.requestPath({
        unitId: unit.id,
        profile: svc('Pathfinding').getWalkProfile(unit),
        sx: unit.x,
        sy: unit.y,
        ex: destX,
        ey: destY,
        maxNodes: pathMaxNodes,
      });
      unit.pathPending = true;
      unit.pathWaitTicks = 0;
      unit.path = [];
      unit.pathIndex = 0;
      unit.targetX = destX;
      unit.targetY = destY;
      if (pathOpts.buildingId) {
        unit.pathTargetId = `bld:${pathOpts.buildingId}`;
        unit.structureTargetId = pathOpts.buildingId;
      } else {
        unit.pathTargetId = targetUnit?.id ?? null;
        if (!targetUnit) unit.structureTargetId = null;
      }
      if (svc('Perf')) svc('Perf').end('path');
      return false;
    } else {
      const unitCount = GS.units.length;
      const syncCap = GameRuntime.syncPathCap(unitCount, !!GS.currentHordeWave);
      const playerSyncCap = Math.max(10, Math.min(28, Math.ceil(unitCount / 3)));
      // Hard ceiling even for force/sync — unlimited A* is a common freeze source.
      const hardSyncCap = Math.max(syncCap, playerSyncCap) + (pathOpts.critical ? 8 : 4);
      if (
        !pathOpts.force &&
        !pathOpts.sync &&
        unit.team === 'enemy' &&
        GS.syncPathfindsThisTick >= syncCap
      ) {
        if (svc('Perf')) svc('Perf').end('path');
        return false;
      }
      if (
        !pathOpts.force &&
        !pathOpts.sync &&
        unit.team === 'player' &&
        GS.syncPathfindsThisTick >= playerSyncCap
      ) {
        if (svc('Perf')) svc('Perf').end('path');
        return false;
      }
      if (GS.syncPathfindsThisTick >= hardSyncCap) {
        // Over budget: keep a direct waypoint so units still move without A*.
        unit.path = [{ x: destX, y: destY }];
        unit.pathIndex = 0;
        unit.targetX = destX;
        unit.targetY = destY;
        unit.pathPending = false;
        unit.pathReqId = null;
        if (svc('Perf')) svc('Perf').end('path');
        if (typeof ErrorReporting !== 'undefined') {
          // Throttle: this fires for every over-budget unit each tick. Emit at most
          // once per PATH_BUDGET_WARN_INTERVAL ticks and report how many were folded in.
          if (GS.updateTick - GS.pathBudgetWarnTick >= PATH_BUDGET_WARN_INTERVAL) {
            ErrorReporting.log?.('warn', 'Sync pathfind budget exceeded — direct waypoint', {
              kind: 'path-budget',
              team: unit.team,
              type: unit.type,
              syncPathfindsThisTick: GS.syncPathfindsThisTick,
              hardSyncCap,
              unitCount,
              suppressedSinceLast: GS.pathBudgetWarnSuppressed,
            });
            GS.pathBudgetWarnTick = GS.updateTick;
            GS.pathBudgetWarnSuppressed = 0;
          } else {
            GS.pathBudgetWarnSuppressed++;
          }
        }
        return true;
      }
      GS.syncPathfindsThisTick++;
      // Cap node expansion under load even for force paths.
      const loadCap =
        unitCount > 100 ? 700 : unitCount > 70 ? 1000 : unitCount > 45 ? 1400 : undefined;
      const effectiveMax =
        pathMaxNodes != null ? Math.min(pathMaxNodes, loadCap || pathMaxNodes) : loadCap;
      unit.path = svc('Pathfinding').findPath(
        unit.x,
        unit.y,
        destX,
        destY,
        unit,
        isTerrainBlockedForPath,
        { maxNodes: effectiveMax }
      );
      unit.pathPending = false;
      unit.pathReqId = null;
      unit.pathWaitTicks = 0;
      if (svc('Perf')) svc('Perf').end('path');
    }
    unit.pathIndex = 0;
    unit.targetX = destX;
    unit.targetY = destY;
    if (pathOpts.buildingId) {
      unit.pathTargetId = `bld:${pathOpts.buildingId}`;
      unit.structureTargetId = pathOpts.buildingId;
    } else {
      unit.pathTargetId = targetUnit?.id ?? null;
      if (!targetUnit) unit.structureTargetId = null;
    }
    unit.pathRecalc = 0;
    unit.pathStuck = 0;
    unit.stillFrames = 0;
    return !!unit.path?.length;
  }

  function pathToEnemyStructure(unit, bld, opts = {}) {
    if (!bld) return;
    const ap = getBuildingApproachPoint(unit, bld);
    const bldKey = `bld:${bld.id}`;
    const destMoved =
      unit.pathTargetId !== bldKey ||
      Math.hypot(ap.x - (unit.targetX ?? 0), ap.y - (unit.targetY ?? 0)) > 24;
    if (!opts.force && !destMoved && unit.path?.length) return;
    if (!opts.force) {
      unit.structurePathRecalc = (unit.structurePathRecalc || 0) - 1;
      if (unit.structurePathRecalc > 0) return;
      unit.structurePathRecalc = opts.recalcInterval ?? 24;
    }
    setUnitPath(unit, ap.x, ap.y, null, {
      buildingId: bld.id,
      force: !!opts.force,
      sync: !!opts.sync,
    });
  }

  function finishManualOrder(unit) {
    if (!unit.manualOrder) return;
    if (unit.combatType === 'healer') {
      unit.manualOrder = false;
      unit.pathRecalc = 0;
      unit.healTargetId = null;
      unit.path = [];
      unit.pathIndex = 0;
      return;
    }
    if (unit.combatType === 'builder') {
      unit.manualOrder = false;
      unit.pathRecalc = 0;
      unit.path = [];
      unit.pathIndex = 0;
      return;
    }
    if (unit.canHunt) {
      if (!unit.holding) {
        // A plain move: he hunts again from the new post.
        unit.manualOrder = false;
        unit.huntMode = true;
        unit.path = [];
        unit.pathIndex = 0;
        unit.targetX = null;
        unit.targetY = null;
        unit.pathTargetId = null;
        unit.pathRecalc = 0;
        clearHoldPost(unit);
      } else {
        // Shift + move: the destination is where he holds.
        const hx = Number.isFinite(unit.pendingHoldX) ? unit.pendingHoldX : unit.x;
        const hy = Number.isFinite(unit.pendingHoldY) ? unit.pendingHoldY : unit.y;
        enterHoldStance(unit, { x: hx, y: hy, reassign: true });
      }
      return;
    }
    unit.manualOrder = false;
    unit.path = [];
    unit.pathIndex = 0;
  }

  /**
   * Move order. A manual order makes the destination the soldier's post. opts.hold:
   * true = hold there (Shift + move), false = hunt from there (plain move, the default),
   * 'keep' = leave his standing order as it is (B, formations).
   */
  function orderMove(unit, tx, ty, manual = true, opts = {}) {
    const pos = clampPos(tx, ty);
    if (manual && unit.team === 'player' && opts.hold !== 'keep') {
      unit.holding = !!opts.hold && !!unit.canHunt;
    }
    if (manual && (unit.garrisoned || hasPendingOutpostGarrison(unit))) releaseFromGarrison(unit);
    if (manual && unit.stationedKeep) releaseFromKeep(unit);
    if (manual && (unit.wallGarrisoned || isMarchingToWallSlot(unit)))
      releaseFromWallGarrison(unit);
    if (manual && unit.retreatingToMed) {
      unit.retreatingToMed = null;
      unit.atMedicalTent = null;
      unit.medQueued = false;
      unit.fightToDeath = false;
    }
    if (manual) {
      unit.manualOrder = true;
      unit.huntMode = false;
      // New click assigns a new post on arrival; clear the old station while marching.
      unit.holdX = null;
      unit.holdY = null;
      unit.pendingHoldX = pos.x;
      unit.pendingHoldY = pos.y;
      // The destination of the last order is the soldier's post from now on.
      setUnitPost(unit, pos.x, pos.y);
      unit.combatTargetId = null;
      unit.structureTargetId = null;
      unit.pathTargetId = null;
      unit.pathRecalc = 0;
      unit.pathPending = false;
      unit.pathReqId = null;
      unit.pathWaitTicks = 0;
      unit.pinned = false;
      unit.pinTimer = 0;
      unit.marchBest = Infinity;
      unit.marchStall = 0;
      // Ready to fire on the first in-range foe while marching (no leftover attack CD).
      unit.actionTimer = 0;
      unit.attackAnimTimer = 0;
      if (unit.combatType === 'healer') {
        unit.healTargetId = null;
      }
      if (unit.combatType === 'builder') {
        unit.repairTarget = null;
      }
    }
    // Sync force path so a click always yields a path even under pathfind budget pressure.
    const ok = setUnitPath(
      unit,
      pos.x,
      pos.y,
      null,
      manual ? { force: true, sync: true, critical: true } : {}
    );
    if (manual && (!ok || !unit.path?.length)) {
      // Last resort: steer-only march so the unit is never completely stuck.
      unit.path = [{ x: pos.x, y: pos.y }];
      unit.pathIndex = 0;
      unit.targetX = pos.x;
      unit.targetY = pos.y;
      unit.pathPending = false;
    }
    GS.moveMarkers.push({ x: pos.x, y: pos.y, life: 150, unitId: unit.id });
  }

  /** Soldiers a Hunt / Hold command applies to: the selection, or the whole army. */
  function stanceOrderTargets() {
    const sel = getSelectedLiveUnits().filter((u) => u.team === 'player' && u.canHunt);
    if (sel.length) return { units: sel, all: false };
    if (getSelectedUnitIds().length) return { units: [], all: false };
    return {
      units: GS.units.filter((u) => u.team === 'player' && u.hp > 0 && u.canHunt),
      all: true,
    };
  }

  /** "Hunt": release Hold. The soldier hunts again from where he was holding. */
  function orderHunt() {
    const { units, all } = stanceOrderTargets();
    let n = 0;
    for (const u of units) {
      if (!u.holding) continue;
      u.holding = false;
      n++;
      if (u.fleeing || u.demoralized || u.retreatingToMed || u.atMedicalTent) continue;
      if (u.garrisoned || u.wallGarrisoned || u.stationedKeep) continue;
      u.pathRecalc = 0;
      applyGlobalHuntState(u);
    }
    showMessage(
      n
        ? `${all ? 'The army hunts' : n > 1 ? `${n} soldiers hunt` : 'He hunts'} again.`
        : units.length
          ? 'Already hunting. Hold is given with Shift + move or Hold here.'
          : 'No soldiers to order.',
      160
    );
    syncInteractionState();
    return n;
  }

  /** "Hold here": plant each soldier where he stands until released or moved. */
  function orderHoldHere() {
    const { units, all } = stanceOrderTargets();
    let n = 0;
    for (const u of units) {
      if (u.garrisoned || u.wallGarrisoned || u.stationedKeep) continue;
      if (hasPendingOutpostGarrison(u) || isMarchingToKeep(u) || isMarchingToWallSlot(u)) continue;
      u.holding = true;
      n++;
      // Away at the tent or broken: he keeps his post and holds it when he is back.
      if (u.fleeing || u.demoralized || u.retreatingToMed || u.atMedicalTent) continue;
      u.manualOrder = false; // "here" ends a march in progress
      setUnitPost(u, u.x, u.y);
      enterHoldStance(u, { x: u.x, y: u.y, reassign: true });
    }
    showMessage(
      n
        ? `${all ? 'The whole army holds' : n > 1 ? `${n} soldiers hold` : 'He holds'} here. H releases.`
        : 'No soldiers to order.',
      160
    );
    syncInteractionState();
    return n;
  }

  function updateHuntPaths() {
    if (isNightPhase()) return;
    const manyUnits = GS.units.length > 45;
    const crowded = GS.units.length > 80;
    for (const u of GS.units) {
      if (manyUnits && !isInView(u.x, u.y, 120, 0)) continue;
      if (
        u.team !== 'player' ||
        !u.canHunt ||
        !u.huntMode ||
        u.garrisoned ||
        u.wallGarrisoned ||
        hasPendingOutpostGarrison(u) ||
        isMarchingToKeep(u) ||
        isMarchingToWallSlot(u) ||
        u.retreatingToMed ||
        u.demoralized ||
        u.hp <= 0 ||
        u.pinned ||
        u.attackAnimTimer > 0
      )
        continue;
      u.pathRecalc = (u.pathRecalc || 0) - 1;
      if (u.pathRecalc > 0) continue;
      u.pathRecalc = crowded ? 70 : manyUnits ? 58 : 50;
      if (u.manualOrder) continue;

      const seekDist = getEnemyStructureSeekDist(u);
      const bld = findNearestAttackableEnemyBuilding(u, seekDist);
      const foe = findTacticalTarget(u);
      const pursueBld = shouldPrioritizeEnemyStructure(u, foe, bld);

      if (pursueBld && bld) {
        u.combatTargetId = null;
        u.structureTargetId = bld.id;
        if (inBuildingAttackRange(u, bld)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        const bldKey = `bld:${bld.id}`;
        const bldMoved =
          u.pathTargetId !== bldKey ||
          Math.hypot(bld.x - (u.targetX ?? 0), bld.y - (u.targetY ?? 0)) > 35;
        if (!u.path?.length || bldMoved) pathToEnemyStructure(u, bld);
        continue;
      }

      if (foe && isPursuableFoe(u, foe)) {
        u.structureTargetId = null;
        u.combatTargetId = foe.id;
        if (inAttackRange(u, foe)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        if (isCrowdedOut(u, foe) && !inAttackRange(u, foe)) {
          u.path = [];
          u.pathIndex = 0;
          continue;
        }
        const foeMoved =
          u.pathTargetId !== foe.id ||
          Math.hypot(foe.x - (u.targetX ?? 0), foe.y - (u.targetY ?? 0)) > 30;
        if (!u.path?.length || foeMoved) setUnitPath(u, foe.x, foe.y, foe);
        continue;
      }

      if (u.pathTargetId || u.combatTargetId || u.structureTargetId) {
        releaseCombatPursuit(u, { keepManual: u.manualOrder });
        u.structureTargetId = null;
      }
    }
  }

  function updateStuckRecovery() {
    const crowded = GS.units.length > 70;
    for (const u of GS.units) {
      if (crowded && !isInView(u.x, u.y, 60, 0)) continue;
      if (
        u.hp <= 0 ||
        u.garrisoned ||
        u.wallGarrisoned ||
        hasPendingOutpostGarrison(u) ||
        isMarchingToKeep(u) ||
        isMarchingToWallSlot(u) ||
        u.retreatingToMed ||
        u.siegeDeployed ||
        (u.pinned && !(u.type === 'builder' && builderHasWork(u)))
      )
        continue;
      // Planted on hold post: do not repath or nudge.
      // Returning-to-post still uses stuck recovery so crowds can't pin them off-station.
      if (isHoldPlanted(u)) {
        u.stillFrames = 0;
        u.lastMoveX = u.x;
        u.lastMoveY = u.y;
        continue;
      }
      const moved = Math.hypot(u.x - (u.lastMoveX ?? u.x), u.y - (u.lastMoveY ?? u.y)) > 0.25;
      u.stillFrames = moved ? 0 : (u.stillFrames || 0) + 1;
      u.lastMoveX = u.x;
      u.lastMoveY = u.y;

      // Manual click-to-move recovers sooner so units don't freeze on crowds/props.
      if (u.stillFrames < (u.manualOrder ? 10 : 18)) continue;
      const needsMove = u.path?.length || u.huntMode || u.manualOrder || u.pathTargetId;
      if (!needsMove) continue;

      nudgeUnitFree(u);
      if (u.targetX != null && u.targetY != null) {
        const savedKey = u.pathTargetId;
        if (isBuildingPathTarget(savedKey)) {
          const bld = getBuildingPursuitTarget(u);
          if (bld) pathToEnemyStructure(u, bld);
          else {
            releaseCombatPursuit(u, { keepManual: u.manualOrder });
            retargetIfHunting(u);
          }
        } else {
          const dest = savedKey && savedKey !== 'advance' ? getUnitById(savedKey) : null;
          if (dest && !isPursuableFoe(u, dest)) {
            releaseCombatPursuit(u, { keepManual: u.manualOrder });
            retargetIfHunting(u);
          } else if (dest) setUnitPath(u, u.targetX, u.targetY, dest);
          else {
            setUnitPath(u, u.targetX, u.targetY, null, {
              force: !!u.manualOrder,
              sync: !!u.manualOrder,
            });
            if (savedKey === 'advance') u.pathTargetId = 'advance';
            if (savedKey === 'hold') u.pathTargetId = 'hold';
          }
        }
      }
      u.stillFrames = 0;
      u.pathStuck = 0;
    }
  }

  function followPath(unit) {
    // Hold posts are driven by updateHoldPosts (plant / return-to-station).
    if (isHoldStance(unit)) return;
    const pathTgt = getPursuitTarget(unit);
    if (pathTgt && !isPursuableFoe(unit, pathTgt)) {
      releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
      retargetIfHunting(unit);
      return;
    }
    if (isBuildingPathTarget(unit.pathTargetId) && !getBuildingPursuitTarget(unit)) {
      releaseCombatPursuit(unit, { keepManual: unit.manualOrder });
      retargetIfHunting(unit);
      return;
    }
    if (manualMoveReached(unit)) {
      unit.path = [];
      unit.pathIndex = 0;
      finishManualOrder(unit);
      return;
    }
    const onBuilderJob = unit.type === 'builder' && builderHasWork(unit);
    if (!unit.path?.length || unit.pathIndex >= unit.path.length) {
      if (
        unit.manualOrder &&
        unit.targetX != null &&
        unit.targetY != null &&
        !manualMoveReached(unit)
      ) {
        setUnitPath(unit, unit.targetX, unit.targetY, null, { force: true, sync: true });
        // Always keep a direct waypoint so failed pathfind never cancels the order mid-map.
        if (!unit.path?.length) {
          unit.path = [{ x: unit.targetX, y: unit.targetY }];
          unit.pathIndex = 0;
        }
        // Try an immediate step this frame so the unit never idles for a tick.
        if (steerToward(unit, unit.targetX, unit.targetY)) {
          unit.animState = 'walk';
          return;
        }
        unit.animState = 'walk';
        return;
      }
      // Hunt / structure chase: repath instead of idling with a destination still set.
      if (
        !unit.manualOrder &&
        unit.targetX != null &&
        unit.targetY != null &&
        (unit.structureTargetId ||
          unit.huntMode ||
          unit.pathTargetId === 'advance' ||
          (unit.pathTargetId && !isBuildingPathTarget(unit.pathTargetId)))
      ) {
        if (isBuildingPathTarget(unit.pathTargetId) || unit.structureTargetId) {
          const bld = getBuildingPursuitTarget(unit);
          if (bld && !inBuildingAttackRange(unit, bld)) {
            pathToEnemyStructure(unit, bld, { force: true, sync: true, recalcInterval: 0 });
            if (!unit.path?.length) {
              unit.path = [{ x: unit.targetX, y: unit.targetY }];
              unit.pathIndex = 0;
            }
            if (steerToward(unit, unit.targetX, unit.targetY)) {
              unit.animState = 'walk';
              return;
            }
            unit.animState = 'walk';
            return;
          }
          // In siege range — let updatePlayerStructureAttack fire; stay idle.
          unit.animState = 'idle';
          return;
        }
        const dest =
          unit.pathTargetId && unit.pathTargetId !== 'advance'
            ? getUnitById(unit.pathTargetId)
            : null;
        if (dest && inAttackRange(unit, dest)) {
          unit.animState = 'idle';
          return;
        }
        setUnitPath(unit, unit.targetX, unit.targetY, dest, { force: true, sync: true });
        if (!unit.path?.length) {
          unit.path = [{ x: unit.targetX, y: unit.targetY }];
          unit.pathIndex = 0;
        }
        if (steerToward(unit, unit.targetX, unit.targetY)) {
          unit.animState = 'walk';
          return;
        }
        unit.animState = 'walk';
        return;
      }
      unit.animState = 'idle';
      if (!onBuilderJob) finishManualOrder(unit);
      return;
    }

    while (unit.pathIndex < unit.path.length) {
      const wp = unit.path[unit.pathIndex];
      if (Math.hypot(wp.x - unit.x, wp.y - unit.y) >= 3) break;
      unit.pathIndex++;
    }

    if (unit.pathIndex >= unit.path.length) {
      if (
        unit.manualOrder &&
        unit.targetX != null &&
        unit.targetY != null &&
        !manualMoveReached(unit)
      ) {
        unit.path = [{ x: unit.targetX, y: unit.targetY }];
        unit.pathIndex = 0;
        if (steerToward(unit, unit.targetX, unit.targetY)) {
          unit.animState = 'walk';
          return;
        }
        unit.animState = 'walk';
        return;
      }
      unit.animState = 'idle';
      if (!onBuilderJob) finishManualOrder(unit);
      return;
    }

    const wp = unit.path[unit.pathIndex];
    const dx = wp.x - unit.x,
      dy = wp.y - unit.y;
    unit.rotation = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

    if (steerToward(unit, wp.x, wp.y)) {
      unit.animState = 'walk';
      unit.pathStuck = 0;
      return;
    }

    // Manual march: if waypoint is jammed (prop/crowd), keep walking toward final click.
    if (unit.manualOrder && unit.targetX != null && unit.targetY != null) {
      if (steerToward(unit, unit.targetX, unit.targetY)) {
        unit.animState = 'walk';
        unit.pathStuck = 0;
        return;
      }
    }

    unit.pathStuck = (unit.pathStuck || 0) + 1;
    unit.animState = unit.pathStuck > 1 ? 'idle' : 'walk';
    if (unit.pathStuck > 2) nudgeUnitFree(unit);
    if (unit.pathStuck > 3) {
      unit.pathStuck = 0;
      unit.pathIndex = Math.min(unit.pathIndex + 1, unit.path.length);
      if (unit.targetX != null) {
        const dest =
          unit.pathTargetId && unit.pathTargetId !== 'advance'
            ? isBuildingPathTarget(unit.pathTargetId)
              ? null
              : getUnitById(unit.pathTargetId)
            : null;
        if (isBuildingPathTarget(unit.pathTargetId)) {
          const bld = getBuildingPursuitTarget(unit);
          if (bld) pathToEnemyStructure(unit, bld);
          else
            setUnitPath(unit, unit.targetX, unit.targetY, null, {
              force: true,
              sync: !!unit.manualOrder,
            });
        } else {
          setUnitPath(unit, unit.targetX, unit.targetY, dest, {
            force: true,
            sync: !!unit.manualOrder,
          });
        }
      }
    }
  }

  return {
    bind,
    applyWorkerPathResults,
    expireStalePendingPaths,
    finishManualOrder,
    followPath,
    isBlocked,
    isTerrainBlocked,
    isTerrainBlockedForPath,
    nudgeUnitFree,
    orderHoldHere,
    orderHunt,
    orderMove,
    pathToEnemyStructure,
    resolveOverlaps,
    setUnitPath,
    steerToward,
    updateHuntPaths,
    updateStuckRecovery,
  };
})();
