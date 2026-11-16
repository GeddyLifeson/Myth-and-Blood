/**
 * Hold stance, posts, manual marches and their map markers.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameStance = (() => {
  const {
    builderHasWork,
    clearHoldPost,
    distToHoldPost,
    hasHoldPost,
    isPlayerMarchingOrder,
    playSfx,
    svc,
  } = GameCore;
  const GS = GameState;
  const { clampPos } = GameField;
  const { isInView } = GameCamera;
  const { getSelectedLiveUnits } = GameInput;
  let enemyNearPost,
    finishManualOrder,
    hasPendingOutpostGarrison,
    isMarchingToKeep,
    isMarchingToWallSlot,
    isTerrainBlockedForPath,
    orderMove,
    showMessage,
    steerToward,
    syncInteractionState;
  function bind(api) {
    ({
      enemyNearPost,
      finishManualOrder,
      hasPendingOutpostGarrison,
      isMarchingToKeep,
      isMarchingToWallSlot,
      isTerrainBlockedForPath,
      orderMove,
      showMessage,
      steerToward,
      syncInteractionState,
    } = api);
  }

  // Thronefall-style hold posts: assigned station, hard plant when home, walk back if displaced.
  const HOLD_AT_DIST = 5;
  const HOLD_SNAP_DIST = 7;
  const HOLD_SETTLE_DIST = 26;
  const HOLD_SETTLE_TICKS = 45;

  /**
   * Standing ground. Hold is a per-soldier order (unit.holding), given by Shift + move
   * or "Hold here"; it is not a global mode. True once he is not mid click-order.
   */
  function isHoldStance(unit) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
    if (!unit.holding || !unit.canHunt) return false;
    // Sent on a raid, he goes; the hold resumes at his post when the raid is over.
    if (unit.raidTargetId || unit.raidMissionId) return false;
    if (unit.fleeing || unit.demoralized || unit.retreatingToMed || unit.atMedicalTent)
      return false;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) return false;
    if (hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit))
      return false;
    if (unit.isGeneral && unit.rallyTargetId) return false;
    // Mid click-to-move: still marching to an unreached destination.
    if (isPlayerMarchingOrder(unit)) return false;
    return true;
  }

  /** On station (close enough to assigned post) — freeze position. */
  function isHoldPlanted(unit) {
    return isHoldStance(unit) && hasHoldPost(unit) && distToHoldPost(unit) <= HOLD_AT_DIST;
  }

  /** Off post and walking home. */
  function isReturningToHold(unit) {
    return isHoldStance(unit) && hasHoldPost(unit) && distToHoldPost(unit) > HOLD_AT_DIST;
  }

  /**
   * Assign / lock a hold post (Thronefall-style station).
   * @param {{ x?: number, y?: number, reassign?: boolean }} [opts]
   */
  function enterHoldStance(unit, opts = {}) {
    if (!unit || !unit.canHunt) return;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) {
      unit.huntMode = false;
      return;
    }
    if (hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit)) {
      unit.huntMode = false;
      return;
    }
    unit.huntMode = false;
    unit.manualOrder = true;
    unit.combatTargetId = null;
    unit.structureTargetId = null;
    unit.pathPending = false;
    unit.pathReqId = null;
    unit.pathWaitTicks = 0;
    unit.pathStuck = 0;
    unit.pathRecalc = 0;
    unit.stillFrames = 0;

    let hx;
    let hy;
    if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) {
      hx = opts.x;
      hy = opts.y;
    } else if (Number.isFinite(unit.pendingHoldX) && Number.isFinite(unit.pendingHoldY)) {
      hx = unit.pendingHoldX;
      hy = unit.pendingHoldY;
    } else if (!opts.reassign && hasHoldPost(unit)) {
      hx = unit.holdX;
      hy = unit.holdY;
    } else if (!opts.reassign && hasPost(unit)) {
      hx = unit.postX;
      hy = unit.postY;
    } else {
      hx = unit.x;
      hy = unit.y;
    }
    const pos = clampPos(hx, hy);
    unit.holdX = pos.x;
    unit.holdY = pos.y;
    // The held spot and the post are the same place: B, the med tent and a load all
    // bring him back to it.
    unit.postX = pos.x;
    unit.postY = pos.y;
    stopPostReturn(unit);
    unit.pendingHoldX = null;
    unit.pendingHoldY = null;
    unit.targetX = unit.holdX;
    unit.targetY = unit.holdY;
    unit.pathTargetId = 'hold';

    const d = distToHoldPost(unit);
    if (d <= HOLD_SNAP_DIST) {
      unit.x = unit.holdX;
      unit.y = unit.holdY;
      unit.path = [];
      unit.pathIndex = 0;
      unit.animState = 'idle';
    } else {
      // Walk home to the assigned post.
      unit.path = [{ x: unit.holdX, y: unit.holdY }];
      unit.pathIndex = 0;
      unit.animState = 'walk';
    }
  }

  /** Snap holders on station; steer anyone knocked off post back home. */
  function updateHoldPosts() {
    for (const unit of GS.units) {
      if (!isHoldStance(unit)) continue;
      // Other systems (raids, reinforcements) switch hunt back on; a held soldier does not hunt.
      unit.huntMode = false;
      unit.manualOrder = true;
      if (!hasHoldPost(unit)) {
        unit.holdX = hasPost(unit) ? unit.postX : unit.x;
        unit.holdY = hasPost(unit) ? unit.postY : unit.y;
      }
      const d = distToHoldPost(unit);
      if (d > HOLD_AT_DIST && d <= HOLD_SETTLE_DIST) {
        // A spot he cannot quite stand on (a tree, a wall, a comrade): he used to step
        // towards it and be pushed off again for ever. Where he ends up is the spot.
        if (d < (unit.holdBest ?? Infinity) - 0.3) {
          unit.holdBest = d;
          unit.holdStall = 0;
        } else if ((unit.holdStall = (unit.holdStall || 0) + 1) > HOLD_SETTLE_TICKS) {
          unit.holdX = unit.x;
          unit.holdY = unit.y;
          unit.postX = unit.x;
          unit.postY = unit.y;
          unit.holdBest = Infinity;
          unit.holdStall = 0;
          continue;
        }
      } else {
        unit.holdBest = Infinity;
        unit.holdStall = 0;
      }
      if (d <= HOLD_AT_DIST) {
        // Hard plant — no micro-drift from separation, combat, or float error.
        unit.x = unit.holdX;
        unit.y = unit.holdY;
        unit.targetX = unit.holdX;
        unit.targetY = unit.holdY;
        unit.pathTargetId = 'hold';
        if (unit.path?.length) {
          unit.path = [];
          unit.pathIndex = 0;
        }
        if (unit.attackAnimTimer <= 0) unit.animState = 'idle';
        continue;
      }
      // Return to assigned spot (Thronefall station).
      unit.targetX = unit.holdX;
      unit.targetY = unit.holdY;
      unit.pathTargetId = 'hold';
      unit.manualOrder = true;
      unit.huntMode = false;
      const end = unit.path?.length ? unit.path[unit.path.length - 1] : null;
      const destOk = end && Math.hypot(end.x - unit.holdX, end.y - unit.holdY) <= 8;
      if (!destOk) {
        unit.path = [{ x: unit.holdX, y: unit.holdY }];
        unit.pathIndex = 0;
      }
      if (unit.pinned || unit.attackAnimTimer > 0) continue;
      if (steerToward(unit, unit.holdX, unit.holdY)) {
        unit.animState = 'walk';
        // Snap once close enough after the step.
        if (distToHoldPost(unit) <= HOLD_AT_DIST) {
          unit.x = unit.holdX;
          unit.y = unit.holdY;
          unit.path = [];
          unit.pathIndex = 0;
          unit.animState = 'idle';
        }
      } else {
        unit.animState = 'walk';
      }
    }
  }

  // ---------------------------------------------------------------- posts (Hunt mode)
  // Mud and Blood style: a soldier remembers where he was put. In Hunt mode he leaves
  // that post to fight and walks back once the fight is over, so the line keeps its shape.
  // This is separate from the hold stance above (holdX/holdY), which never leaves at all.
  const POST_IDLE_TICKS = 120; // about two seconds with nothing to shoot at
  const POST_LEAVE_DIST = 18; // closer than this counts as "at his post"
  const POST_ARRIVE_DIST = 6;
  const POST_GIVE_UP_TICKS = 180;

  function hasPost(unit) {
    return unit != null && Number.isFinite(unit.postX) && Number.isFinite(unit.postY);
  }

  function setUnitPost(unit, x, y) {
    if (!unit || unit.team !== 'player') return;
    const pos = clampPos(x, y);
    unit.postX = pos.x;
    unit.postY = pos.y;
    stopPostReturn(unit);
  }

  function stopPostReturn(unit) {
    unit.postIdle = 0;
    unit.postPath = null;
    unit.postPathIndex = 0;
    unit.postStall = 0;
    unit.postBest = Infinity;
    unit.returningToPost = false;
  }

  /** Soldiers who keep a post at all: Hunt-mode fighters with nothing else to obey. */
  function postReturnAllowed(unit) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return false;
    if (!unit.canHunt || !unit.huntMode || unit.manualOrder || unit.isGeneral) return false;
    if (unit.fleeing || unit.demoralized || unit.retreatingToMed || unit.atMedicalTent)
      return false;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep || unit.siegeDeployed)
      return false;
    if (hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit))
      return false;
    return true;
  }

  function unitIsEngaged(unit) {
    return !!(
      unit.combatTargetId ||
      unit.structureTargetId ||
      unit.pathTargetId ||
      unit.pathPending ||
      (unit.path?.length && unit.pathIndex < unit.path.length) ||
      unit.attackAnimTimer > 0 ||
      unit.pinned
    );
  }

  function planPostPath(unit) {
    const direct = [{ x: unit.postX, y: unit.postY }];
    const pf = svc('Pathfinding');
    if (!pf?.findPath || GS.syncPathfindsThisTick >= 6) return direct;
    GS.syncPathfindsThisTick++;
    try {
      const path = pf.findPath(
        unit.x,
        unit.y,
        unit.postX,
        unit.postY,
        unit,
        isTerrainBlockedForPath,
        { maxNodes: 700 }
      );
      return path?.length ? path : direct;
    } catch (_) {
      return direct;
    }
  }

  /** Walk idle Hunt-mode soldiers back to their posts. Runs every tick, after movement. */
  function updatePostReturn() {
    for (const unit of GS.units) {
      if (unit.team !== 'player' || unit.hp <= 0) continue;
      if (!postReturnAllowed(unit)) {
        if (unit.returningToPost || unit.postIdle) stopPostReturn(unit);
        continue;
      }
      if (!hasPost(unit)) {
        // Old saves and units made by other systems: where he stands is his post.
        unit.postX = unit.x;
        unit.postY = unit.y;
      }
      if (unitIsEngaged(unit)) {
        if (unit.returningToPost || unit.postIdle) stopPostReturn(unit);
        continue;
      }
      const d = Math.hypot(unit.x - unit.postX, unit.y - unit.postY);
      if (!unit.returningToPost) {
        if (d <= POST_LEAVE_DIST) {
          unit.postIdle = 0;
          continue;
        }
        unit.postIdle = (unit.postIdle || 0) + 1;
        if (unit.postIdle < POST_IDLE_TICKS) continue;
        // Do not turn his back on an enemy that is still coming.
        if (enemyNearPost(unit, 300)) {
          unit.postIdle = POST_IDLE_TICKS - 30;
          continue;
        }
        unit.returningToPost = true;
        unit.postPath = planPostPath(unit);
        unit.postPathIndex = 0;
        unit.postStall = 0;
        unit.postBest = d;
      }
      if (d <= POST_ARRIVE_DIST) {
        stopPostReturn(unit);
        unit.animState = 'idle';
        continue;
      }
      const path = unit.postPath || [];
      while (
        unit.postPathIndex < path.length - 1 &&
        Math.hypot(path[unit.postPathIndex].x - unit.x, path[unit.postPathIndex].y - unit.y) < 6
      ) {
        unit.postPathIndex++;
      }
      const wp = path[Math.min(unit.postPathIndex, path.length - 1)] || {
        x: unit.postX,
        y: unit.postY,
      };
      const moved = steerToward(unit, wp.x, wp.y);
      unit.animState = 'walk';
      unit.rotation = Math.round((Math.atan2(wp.y - unit.y, wp.x - unit.x) * 180) / Math.PI);
      const nd = Math.hypot(unit.x - unit.postX, unit.y - unit.postY);
      if (moved && nd < unit.postBest - 0.3) {
        unit.postBest = nd;
        unit.postStall = 0;
      } else {
        unit.postStall++;
      }
      // A comrade standing on the post, or a wall in the way: close enough is good enough,
      // and a soldier who cannot get home stops trying until the next fight moves him.
      if (
        (unit.postStall > 30 && nd <= POST_LEAVE_DIST * 1.6) ||
        unit.postStall > POST_GIVE_UP_TICKS
      ) {
        stopPostReturn(unit);
        unit.postIdle = -600;
        unit.animState = 'idle';
      }
    }
  }

  /** A small inked stake under each selected soldier's post, tied to him when he is away. */
  function drawPostMarkers() {
    const sel = GS.cachedSelectedSet;
    if (!sel || !sel.size || !GS.ctx) return;
    const ctx = GS.ctx;
    const k = 1 / Math.max(0.5, GS.viewScale || 1);
    let drawn = 0;
    for (const u of GS.units) {
      if (drawn >= 40) break;
      if (u.team !== 'player' || u.hp <= 0 || !sel.has(u.id) || !hasPost(u)) continue;
      if (!u.canHunt || u.isGeneral || u.garrisoned || u.wallGarrisoned || u.stationedKeep)
        continue;
      if (!isInView(u.postX, u.postY, 20)) continue;
      drawn++;
      const away = Math.hypot(u.x - u.postX, u.y - u.postY);
      ctx.save();
      if (away > POST_LEAVE_DIST) {
        ctx.strokeStyle = 'rgba(228,220,196,0.45)';
        ctx.lineWidth = 1 * k;
        ctx.setLineDash([4 * k, 5 * k]);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(u.postX, u.postY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const r = 5 * k;
      ctx.translate(u.postX, u.postY);
      ctx.fillStyle = away > POST_LEAVE_DIST ? '#e4dcc4' : 'rgba(228,220,196,0.55)';
      ctx.strokeStyle = '#07050a';
      ctx.lineWidth = 1.5 * k;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * A planted shield at the feet of a soldier under a Hold order, selected or not, so
   * the player can always tell who will not move. Hunting soldiers show nothing.
   */
  function drawHoldMarker(u) {
    const ctx = GS.ctx;
    if (!ctx || u.team !== 'player' || !u.canHunt) return;
    if (u.garrisoned || u.wallGarrisoned || u.stationedKeep) return;
    ctx.save();
    ctx.translate(u.x - 15, u.y + 11);
    ctx.scale(1.25, 1.25);
    // the ground it is planted in
    ctx.fillStyle = 'rgba(7,5,10,0.5)';
    ctx.fillRect(-6, 5.5, 12, 2.5);
    // heater shield, point down
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(5, -6);
    ctx.lineTo(5, 0);
    ctx.lineTo(3.6, 4);
    ctx.lineTo(0, 7);
    ctx.lineTo(-3.6, 4);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-5, -6);
    ctx.fillStyle = '#e4dcc4';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#07050a';
    ctx.stroke();
    // cross
    ctx.fillStyle = '#8a1c1c';
    ctx.fillRect(-0.9, -4.5, 1.8, 9);
    ctx.fillRect(-3.6, -2.6, 7.2, 1.8);
    ctx.restore();
  }

  /** A red cross over a wounded soldier who is walking to, or waiting at, the med tent. */
  function drawMedMark(u) {
    const ctx = GS.ctx;
    if (!ctx) return;
    const x = u.x;
    const y = u.y - 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#f2ecdc';
    ctx.strokeStyle = '#07050a';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-5.5, -5.5, 11, 11);
    ctx.strokeRect(-5.5, -5.5, 11, 11);
    ctx.fillStyle = u.medQueued ? '#b07a1c' : '#b3201c';
    ctx.fillRect(-1.6, -4, 3.2, 8);
    ctx.fillRect(-4, -1.6, 8, 3.2);
    ctx.restore();
  }

  const MARCH_GIVE_UP_TICKS = 150;

  /**
   * End move orders that have arrived or cannot arrive. A soldier sent to a spot he
   * could not quite reach (a building, a crowd) used to stay on the order for good,
   * neither hunting nor holding. Now where he got to becomes his post.
   */
  function updateManualMarches() {
    for (const unit of GS.units) {
      if (unit.team !== 'player' || unit.hp <= 0 || !unit.manualOrder || !unit.canHunt) continue;
      if (unit.pathTargetId === 'hold' || unit.targetX == null || unit.targetY == null) continue;
      if (unit.retreatingToMed || unit.atMedicalTent || unit.fleeing || unit.demoralized) continue;
      if (hasPendingOutpostGarrison(unit) || isMarchingToKeep(unit) || isMarchingToWallSlot(unit))
        continue;
      const d = Math.hypot(unit.x - unit.targetX, unit.y - unit.targetY);
      if (d > 12) {
        if (d < (unit.marchBest ?? Infinity) - 0.4) {
          unit.marchBest = d;
          unit.marchStall = 0;
          continue;
        }
        unit.marchStall = (unit.marchStall || 0) + 1;
        if (unit.marchStall < MARCH_GIVE_UP_TICKS) continue;
        setUnitPost(unit, unit.x, unit.y);
        unit.pendingHoldX = unit.x;
        unit.pendingHoldY = unit.y;
      }
      unit.marchBest = Infinity;
      unit.marchStall = 0;
      unit.path = [];
      unit.pathIndex = 0;
      finishManualOrder(unit);
    }
  }

  /** Order soldiers back to their posts now (hotkey B). A manual march, so nothing distracts them. */
  function returnSelectionToPosts() {
    const live = getSelectedLiveUnits().filter((u) => u.team === 'player' && hasPost(u));
    if (!live.length) {
      showMessage('Select soldiers first, then press B to send them back to their posts.', 160);
      return false;
    }
    let sent = 0;
    for (const u of live) {
      if (u.isGeneral || u.fleeing || u.demoralized) continue;
      if (Math.hypot(u.x - u.postX, u.y - u.postY) <= POST_ARRIVE_DIST) continue;
      orderMove(u, u.postX, u.postY, true, { hold: 'keep' });
      sent++;
    }
    showMessage(
      sent ? `${sent} soldier${sent > 1 ? 's' : ''} back to post.` : 'Already at their posts.',
      120
    );
    if (sent) playSfx('orderRecall');
    syncInteractionState();
    return sent > 0;
  }

  /**
   * Put a soldier back on his standing order after anything that interrupted it (med
   * tent, rout and rally, garrison, load, era reset). Hunt is the default; Hold is kept
   * only for soldiers the player ordered to hold.
   */
  function applyGlobalHuntState(unit) {
    if (!unit?.canHunt) return;
    if (unit.holding) {
      if (isPlayerMarchingOrder(unit)) return; // he plants when he arrives
      enterHoldStance(unit, hasPost(unit) ? { x: unit.postX, y: unit.postY } : { reassign: true });
      return;
    }
    unit.huntMode = true;
    // Don't cancel an active click-to-move destination.
    if (isPlayerMarchingOrder(unit)) {
      unit.huntMode = false;
      return;
    }
    unit.manualOrder = false;
    clearHoldPost(unit);
  }

  function unitHasActiveMarch(unit) {
    if (!unit || unit.hp <= 0) return false;
    // Returning to a hold post counts as a march (soft collision).
    if (isReturningToHold(unit)) return true;
    // Planted hold is not a march.
    if (isHoldStance(unit)) return false;
    return !!(
      unit.path?.length ||
      unit.huntMode ||
      unit.manualOrder ||
      unit.retreatingToMed ||
      (unit.type === 'builder' && builderHasWork(unit)) ||
      hasPendingOutpostGarrison(unit) ||
      isMarchingToKeep(unit) ||
      isMarchingToWallSlot(unit)
    );
  }

  return {
    bind,
    POST_IDLE_TICKS,
    applyGlobalHuntState,
    drawHoldMarker,
    drawMedMark,
    drawPostMarkers,
    enterHoldStance,
    hasPost,
    isHoldPlanted,
    isHoldStance,
    returnSelectionToPosts,
    setUnitPost,
    stopPostReturn,
    unitHasActiveMarch,
    updateHoldPosts,
    updateManualMarches,
    updatePostReturn,
  };
})();
