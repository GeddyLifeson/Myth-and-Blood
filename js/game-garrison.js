/**
 * Outpost, keep and wall garrisons.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameGarrison = (() => {
  const {
    ensureWallSlots,
    foeThreatensWallManning,
    isFootmanWallCandidate,
    isGeneralCandidate,
    isPlayerMarchingOrder,
    isRangedGarrisonCandidate,
    playSfx,
    posDistSq,
    shouldReleaseOutpostGarrison,
    unitCounts,
    wallFacingRotation,
  } = GameCore;
  const GS = GameState;
  const { clampPos } = GameField;
  const { applyGlobalHuntState } = GameStance;
  const { findNearestFoeInRange, getStationedGeneral } = GameCombat;
  const { getEffectiveRange } = GameTargeting;
  const { isTerrainBlocked, setUnitPath } = GameMovement;
  let ach, getUnitById, isNightPhase, showMessage;
  function bind(api) {
    ({ ach, getUnitById, isNightPhase, showMessage } = api);
  }

  const castleAnchorCache = new Map();

  const OUTPOST_GARRISON_ENTER_DIST = 20;
  const OUTPOST_GARRISON_FORCE_DIST = 32;
  const OUTPOST_GARRISON_STUCK_SNAP_TICKS = 90;
  const OUTPOST_GARRISON_STUCK_RELEASE_TICKS = 240;

  function releaseFromGarrison(unit) {
    const op = GS.buildings.find((b) => b.id === unit.garrisoned || b.garrisonUnitId === unit.id);
    if (op?.garrisonUnitId === unit.id) op.garrisonUnitId = null;
    unit.garrisoned = null;
    unit.garrisonMarchRecalc = 0;
    unit.garrisonStuckTicks = 0;
    unit.range = unit.baseRange ?? unit.range;
    if (unit.pathTargetId?.startsWith?.('med:') || unit.retreatingToMed || unit.atMedicalTent) {
      // keep med-tent retreat path intact
    } else if (unit.fleeing || unit.demoralized) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.pathTargetId = null;
      unit.targetX = unit.x;
      unit.targetY = unit.y;
    }
    if (
      unit.canHunt &&
      !unit.retreatingToMed &&
      !unit.atMedicalTent &&
      !unit.fleeing &&
      !unit.demoralized
    ) {
      applyGlobalHuntState(unit);
    }
  }

  function getPendingOutpost(unit) {
    if (!unit || unit.garrisoned) return null;
    return (
      GS.buildings.find(
        (b) => b.type === 'outpost' && b.complete && b.garrisonUnitId === unit.id
      ) || null
    );
  }

  function hasPendingOutpostGarrison(unit) {
    return !!getPendingOutpost(unit);
  }

  function getOutpostGarrisonSlot(op, unit) {
    const baseX = op.slotX ?? op.x;
    const baseY = op.slotY ?? op.y - 14;
    // Prefer the stored slot when already assigned — avoid per-frame collision scans.
    if (unit?.garrisoned === op.id) {
      return clampPos(baseX, baseY);
    }
    const stub = unit || { team: 'player', combatType: 'ranged' };
    const offsets = [
      [0, 0],
      [0, 10],
      [0, 14],
      [-12, 6],
      [12, 6],
      [-8, 12],
      [8, 12],
      [0, -6],
    ];
    for (const [ox, oy] of offsets) {
      const pos = clampPos(baseX + ox, baseY + oy);
      // Terrain-only: unit soft-block (isBlocked) made keep courtyards unpathable and
      // re-path every frame when mages stacked near outposts — freeze-level thrash.
      if (!isTerrainBlocked(pos.x, pos.y, stub)) return pos;
    }
    return clampPos(baseX, baseY);
  }

  function outpostMarchDistSq(unit, op) {
    const slot = getOutpostGarrisonSlot(op, unit);
    return posDistSq(unit.x, unit.y, slot.x, slot.y);
  }

  function completeOutpostGarrison(gu, op, slot) {
    if (shouldReleaseOutpostGarrison(gu)) return;
    gu.x = slot.x;
    gu.y = slot.y;
    gu.path = [];
    gu.pathIndex = 0;
    gu.targetX = slot.x;
    gu.targetY = slot.y;
    gu.pathTargetId = null;
    gu.huntMode = false;
    gu.garrisonStuckTicks = 0;
    gu.garrisonMarchRecalc = 0;
    if (!gu.garrisoned) {
      ach('garrison', { count: unitCounts.garrisonedPlayer + 1 });
    }
    gu.garrisoned = op.id;
    gu.range = getEffectiveRange(gu);
    gu.rotation = -90;
    if (gu.attackAnimTimer <= 0) gu.animState = 'idle';
  }

  function clearSiegeLink(unit) {
    if (!unit.linkedWallId) return;
    const wall = GS.buildings.find((b) => b.id === unit.linkedWallId);
    if (wall?.siegeTowerId === unit.id) wall.siegeTowerId = null;
    unit.siegeDeployed = false;
    unit.linkedWallId = null;
  }

  function findNearestPlayerWall(from) {
    let best = null,
      bestD2 = Infinity;
    for (const b of GS.buildings) {
      if (!b.complete || b.type !== 'wall' || b.siegeTowerId) continue;
      const d2 = posDistSq(b.x, b.y, from.x, from.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = b;
      }
    }
    return best;
  }

  function deploySiege(unit, wall) {
    unit.siegeDeployed = true;
    unit.linkedWallId = wall.id;
    unit.path = [];
    unit.pathIndex = 0;
    wall.siegeTowerId = unit.id;
    unit.x = wall.x;
    unit.y = wall.y - 22;
    showMessage('Enemy siege tower is bridging the wall!');
    playSfx('siegeDock');
  }

  function isMarchingToOutpost(unit) {
    const op = getPendingOutpost(unit);
    if (!op) return false;
    return outpostMarchDistSq(unit, op) > OUTPOST_GARRISON_ENTER_DIST * OUTPOST_GARRISON_ENTER_DIST;
  }

  function assignToOutpost(unit, op) {
    op.garrisonUnitId = unit.id;
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.combatTargetId = null;
    unit.pathTargetId = null;
    unit.perkTargetId = null;
    unit.pinned = false;
    unit.pinTimer = 0;
    unit.garrisonStuckTicks = 0;
    unit.garrisonMarchRecalc = 30;
    const slot = getOutpostGarrisonSlot(op, unit);
    setUnitPath(unit, slot.x, slot.y, null, { force: true });
  }

  function updateOutposts() {
    for (const op of GS.buildings) {
      if (!op.complete || op.type !== 'outpost') continue;

      if (op.garrisonUnitId) {
        const gu = getUnitById(op.garrisonUnitId);
        if (!gu || gu.hp <= 0) {
          op.garrisonUnitId = null;
          continue;
        }

        if (shouldReleaseOutpostGarrison(gu)) {
          op.garrisonUnitId = null;
          releaseFromGarrison(gu);
          continue;
        }

        if (gu.garrisoned && gu.garrisoned !== op.id) {
          op.garrisonUnitId = null;
          continue;
        }

        // Already manning the tower — pin in place, no path churn.
        if (gu.garrisoned === op.id) {
          const slot = getOutpostGarrisonSlot(op, gu);
          gu.x = slot.x;
          gu.y = slot.y;
          gu.path = [];
          gu.pathIndex = 0;
          gu.huntMode = false;
          gu.garrisonStuckTicks = 0;
          continue;
        }

        const slot = getOutpostGarrisonSlot(op, gu);
        const dist2 = posDistSq(gu.x, gu.y, slot.x, slot.y);
        const enterR2 = OUTPOST_GARRISON_ENTER_DIST * OUTPOST_GARRISON_ENTER_DIST;
        if (dist2 > enterR2) {
          gu.garrisonStuckTicks = (gu.garrisonStuckTicks || 0) + 1;
          gu.huntMode = false;
          gu.garrisonMarchRecalc = (gu.garrisonMarchRecalc || 0) - 1;
          const destMoved = posDistSq(gu.targetX ?? 0, gu.targetY ?? 0, slot.x, slot.y) > 36;
          // Prefer soft path; force only after repeated failure (avoids path-storm freezes).
          if (!gu.path?.length || gu.garrisonMarchRecalc <= 0 || destMoved) {
            gu.garrisonMarchRecalc = 48;
            const forced = (gu.garrisonStuckTicks || 0) > 60;
            setUnitPath(gu, slot.x, slot.y, null, { force: forced });
            if (!gu.path?.length && gu.garrisonStuckTicks > 45) {
              completeOutpostGarrison(gu, op, slot);
              continue;
            }
          }
          if (
            gu.garrisonStuckTicks > OUTPOST_GARRISON_STUCK_SNAP_TICKS &&
            dist2 < OUTPOST_GARRISON_FORCE_DIST * OUTPOST_GARRISON_FORCE_DIST
          ) {
            completeOutpostGarrison(gu, op, slot);
          } else if (gu.garrisonStuckTicks > OUTPOST_GARRISON_STUCK_RELEASE_TICKS) {
            op.garrisonUnitId = null;
            releaseFromGarrison(gu);
            gu.garrisonMarchRecalc = 0;
          }
        } else {
          completeOutpostGarrison(gu, op, slot);
        }
        continue;
      }

      let best = null,
        bestD2 = Infinity;
      const outpostR2 = 102400;
      for (const u of GS.units) {
        if (!isRangedGarrisonCandidate(u)) continue;
        if (GS.buildings.some((b) => b.garrisonUnitId === u.id)) continue;
        const d2 = posDistSq(u.x, u.y, op.x, op.y);
        if (d2 < outpostR2 && d2 < bestD2) {
          bestD2 = d2;
          best = u;
        }
      }
      if (best) assignToOutpost(best, op);
    }
  }

  function releaseFromKeep(unit) {
    const keep = GS.buildings.find(
      (b) => b.id === unit.stationedKeep || b.generalUnitId === unit.id
    );
    if (keep?.generalUnitId === unit.id) keep.generalUnitId = null;
    unit.stationedKeep = null;
    unit.keepMarchRecalc = 0;
    if (unit.canHunt) applyGlobalHuntState(unit);
  }

  function isMarchingToKeep(unit) {
    return GS.buildings.some((b) => b.generalUnitId === unit.id && !unit.stationedKeep);
  }

  function assignToKeep(unit, keep) {
    keep.generalUnitId = unit.id;
    unit.huntMode = false;
    unit.manualOrder = false;
    unit.combatTargetId = null;
    unit.pathTargetId = null;
    const slot = getKeepGeneralSlot(keep);
    setUnitPath(unit, slot.x, slot.y);
  }

  function updateCastleKeeps() {
    for (const keep of GS.buildings) {
      if (!keep.complete || !keep.isKeep) continue;
      if (keep.slotX === keep.x && keep.slotY === keep.y - 14) {
        const slot = getKeepGeneralSlot(keep);
        keep.slotX = slot.x;
        keep.slotY = slot.y;
      }
      const slot = getKeepGeneralSlot(keep);
      const slotX = slot.x;
      const slotY = slot.y;

      if (keep.generalUnitId) {
        const gu = getUnitById(keep.generalUnitId);
        if (!gu || gu.hp <= 0) {
          keep.generalUnitId = null;
          continue;
        }
        if (gu.rallyTargetId) continue;

        if (gu.manualOrder) {
          if (gu.stationedKeep === keep.id) releaseFromKeep(gu);
          keep.generalUnitId = null;
          continue;
        }

        // Already stationed — no path churn.
        if (gu.stationedKeep === keep.id) {
          gu.x = slotX;
          gu.y = slotY;
          gu.path = [];
          gu.pathIndex = 0;
          gu.huntMode = false;
          gu.rotation = -90;
          if (gu.attackAnimTimer <= 0) gu.animState = 'idle';
          continue;
        }

        const dist2 = posDistSq(gu.x, gu.y, slotX, slotY);
        if (dist2 > 64) {
          gu.huntMode = false;
          gu.keepMarchRecalc = (gu.keepMarchRecalc || 0) - 1;
          const destMoved = posDistSq(gu.targetX ?? 0, gu.targetY ?? 0, slotX, slotY) > 16;
          if (!gu.path?.length || gu.keepMarchRecalc <= 0 || destMoved) {
            gu.keepMarchRecalc = 48;
            setUnitPath(gu, slotX, slotY);
            // Snap if courtyard path is blocked (common after walls finish).
            if (!gu.path?.length && dist2 < 120 * 120) {
              gu.x = slotX;
              gu.y = slotY;
              gu.path = [];
              gu.pathIndex = 0;
              gu.stationedKeep = keep.id;
              showMessage('General commands from the Keep — aura active, footmen man the walls!');
              ach('general_stationed', {});
              gu.keepMarchRecalc = 0;
              gu.rotation = -90;
            }
          }
        } else {
          gu.x = slotX;
          gu.y = slotY;
          gu.path = [];
          gu.pathIndex = 0;
          gu.huntMode = false;
          if (!gu.stationedKeep) {
            gu.stationedKeep = keep.id;
            showMessage('General commands from the Keep — aura active, footmen man the walls!');
            ach('general_stationed', {});
          }
          gu.keepMarchRecalc = 0;
          gu.rotation = -90;
          if (gu.attackAnimTimer <= 0) gu.animState = 'idle';
        }
        continue;
      }

      let best = null,
        bestD2 = Infinity;
      const keepR2 = 160000;
      for (const u of GS.units) {
        if (!isGeneralCandidate(u)) continue;
        if (GS.buildings.some((b) => b.generalUnitId === u.id)) continue;
        const d2 = posDistSq(u.x, u.y, keep.x, keep.y);
        if (d2 < keepR2 && d2 < bestD2) {
          bestD2 = d2;
          best = u;
        }
      }
      if (best) assignToKeep(best, keep);
    }
  }

  function getStationedCastleGroup() {
    const gen = getStationedGeneral();
    if (!gen?.stationedKeep) return null;
    const keep = GS.buildings.find((b) => b.id === gen.stationedKeep);
    return keep?.castleGroup || null;
  }

  /** Castle group for wall manning — active once the General is marching to or stationed in a Keep. */
  function getWallManningCastleGroup() {
    const stationed = getStationedCastleGroup();
    if (stationed) return stationed;
    for (const keep of GS.buildings) {
      if (!keep.complete || !keep.isKeep || !keep.castleGroup || !keep.generalUnitId) continue;
      const gu = getUnitById(keep.generalUnitId);
      if (gu && gu.hp > 0 && !gu.manualOrder && !gu.rallyTargetId) return keep.castleGroup;
    }
    return null;
  }

  function getCastleGroupAnchor(groupId) {
    if (GS.castleAnchorTick !== GS.updateTick) {
      castleAnchorCache.clear();
      GS.castleAnchorTick = GS.updateTick;
    }
    if (castleAnchorCache.has(groupId)) return castleAnchorCache.get(groupId);
    let sx = 0,
      sy = 0,
      n = 0;
    for (let i = 0; i < GS.buildings.length; i++) {
      const b = GS.buildings[i];
      if (b.castleGroup !== groupId || !b.complete || b.hp <= 0) continue;
      sx += b.x;
      sy += b.y;
      n++;
    }
    const anchor = n ? { x: sx / n, y: sy / n } : null;
    castleAnchorCache.set(groupId, anchor);
    return anchor;
  }

  function isWallEligibleForManning(wall, groupId) {
    if (!wall || wall.type !== 'wall' || wall.owner !== 'player' || !wall.complete || wall.hp <= 0)
      return false;
    if (wall.castleGroup === groupId) return true;
    if (wall.hamletFortressRing && groupId) return true;
    if (!wall.castleGroup) {
      const anchor = getCastleGroupAnchor(groupId);
      if (!anchor) return false;
      const seek = getWallManningSeekDist();
      return posDistSq(wall.x, wall.y, anchor.x, anchor.y) <= seek * seek;
    }
    return false;
  }

  function checkCastleCompoundBreaches() {
    if (GS.creativeMode || GS.state !== 'playing' || GS.castleBreachRecorded) return;
    if (typeof isInsideCastleInnerSanctum !== 'function' || !playerHasCastleCompound(GS.buildings))
      return;
    const groups = new Set();
    for (const b of GS.buildings) {
      if (b.owner === 'player' && b.castleGroup && b.complete && b.hp > 0)
        groups.add(b.castleGroup);
    }
    for (const u of GS.units) {
      if (u.team !== 'enemy' || u.hp <= 0) continue;
      for (const gid of groups) {
        if (!isInsideCastleInnerSanctum(u, GS.buildings, gid)) continue;
        GS.castleBreachRecorded = true;
        ach('castle_compound_breach', { groupId: gid, enemyType: u.type, wave: GS.wave });
        if (!GS.castleBreachWarned) {
          GS.castleBreachWarned = true;
          showMessage(
            'Inner keep breached — timeline integrity compromised. Pale Vigil sanctum challenge failed.',
            400
          );
        }
        return;
      }
    }
  }

  function releaseFromWallGarrison(unit) {
    for (const wall of GS.buildings) {
      if (!wall.wallSlots) continue;
      for (const slot of wall.wallSlots) {
        if (slot.unitId === unit.id) slot.unitId = null;
      }
    }
    unit.wallGarrisoned = null;
    unit.wallSlotIndex = null;
    if (unit.canHunt) applyGlobalHuntState(unit);
  }

  function isMarchingToWallSlot(unit) {
    if (unit.wallGarrisoned) return false;
    for (const wall of GS.buildings) {
      if (!wall.wallSlots) continue;
      for (const slot of wall.wallSlots) {
        if (slot.unitId === unit.id) return true;
      }
    }
    return false;
  }

  /** How far a footman will volunteer to man an empty castle wall slot (not map-wide). */
  function getWallManningSeekDist() {
    return Math.min(300, Math.max(200, 195 + GS.worldW * 0.055));
  }

  function footmanCanVolunteerForWall(u, slotX, slotY) {
    if (!isFootmanWallCandidate(u)) return false;
    if (isNightPhase()) return true;
    const foe = findNearestFoeInRange(u);
    return !foeThreatensWallManning(foe, u, slotX, slotY);
  }

  function updateWallGarrison() {
    const groupId = getWallManningCastleGroup();
    if (!groupId) {
      for (const u of GS.units) {
        if (u.wallGarrisoned || isMarchingToWallSlot(u)) releaseFromWallGarrison(u);
      }
      return;
    }

    const seekDist = getWallManningSeekDist();
    const seekR2 = seekDist * seekDist;

    for (const wall of GS.buildings) {
      if (!isWallEligibleForManning(wall, groupId)) continue;
      ensureWallSlots(wall);

      for (let si = 0; si < wall.wallSlots.length; si++) {
        const slot = wall.wallSlots[si];

        if (slot.unitId) {
          const fu = getUnitById(slot.unitId);
          if (!fu || fu.hp <= 0) {
            slot.unitId = null;
            continue;
          }

          if (isPlayerMarchingOrder(fu) || fu.retreatingToMed || !isFootmanWallCandidate(fu)) {
            releaseFromWallGarrison(fu);
            slot.unitId = null;
            continue;
          }

          const foe = findNearestFoeInRange(fu);
          if (foeThreatensWallManning(foe, fu, slot.slotX, slot.slotY)) {
            releaseFromWallGarrison(fu);
            slot.unitId = null;
            if (fu.canHunt) applyGlobalHuntState(fu);
            continue;
          }

          const dist2 = posDistSq(fu.x, fu.y, slot.slotX, slot.slotY);
          if (dist2 > 36) {
            fu.huntMode = false;
            fu.manualOrder = false;
            fu.combatTargetId = null;
            fu.structureTargetId = null;
            const destMoved =
              posDistSq(fu.targetX ?? 0, fu.targetY ?? 0, slot.slotX, slot.slotY) > 16;
            fu.pathRecalc = (fu.pathRecalc || 0) - 1;
            if (!fu.path?.length || destMoved || fu.pathRecalc <= 0) {
              fu.pathRecalc = 40;
              setUnitPath(fu, slot.slotX, slot.slotY);
              // Snap onto wall if path fails (crowded courtyard).
              if (!fu.path?.length && dist2 < 80 * 80) {
                fu.x = slot.slotX;
                fu.y = slot.slotY;
                fu.path = [];
                fu.pathIndex = 0;
                fu.wallGarrisoned = wall.id;
                fu.wallSlotIndex = si;
                fu.rotation = wallFacingRotation(wall.facing);
              }
            }
          } else {
            fu.x = slot.slotX;
            fu.y = slot.slotY;
            fu.path = [];
            fu.pathIndex = 0;
            fu.targetX = slot.slotX;
            fu.targetY = slot.slotY;
            fu.huntMode = false;
            fu.manualOrder = false;
            fu.wallGarrisoned = wall.id;
            fu.wallSlotIndex = si;
            fu.rotation = wallFacingRotation(wall.facing);
            if (fu.attackAnimTimer <= 0) fu.animState = 'idle';
          }
          continue;
        }

        let best = null;
        let bestD2 = Infinity;
        for (const u of GS.units) {
          if (!footmanCanVolunteerForWall(u, slot.slotX, slot.slotY)) continue;
          if (u.wallGarrisoned || isMarchingToWallSlot(u)) continue;
          let onOtherSlot = false;
          for (let wi = 0; wi < wall.wallSlots.length; wi++) {
            if (wall.wallSlots[wi].unitId === u.id) {
              onOtherSlot = true;
              break;
            }
          }
          if (onOtherSlot) continue;
          const d2 = posDistSq(u.x, u.y, slot.slotX, slot.slotY);
          if (d2 > seekR2) continue;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = u;
          }
        }
        if (best) {
          slot.unitId = best.id;
          best.huntMode = false;
          best.manualOrder = false;
          best.combatTargetId = null;
          best.structureTargetId = null;
          best.pathTargetId = null;
          best.pathRecalc = 18;
          setUnitPath(best, slot.slotX, slot.slotY);
        }
      }
    }
  }

  return {
    bind,
    checkCastleCompoundBreaches,
    clearSiegeLink,
    deploySiege,
    findNearestPlayerWall,
    getOutpostGarrisonSlot,
    getStationedCastleGroup,
    hasPendingOutpostGarrison,
    isMarchingToKeep,
    isMarchingToOutpost,
    isMarchingToWallSlot,
    releaseFromGarrison,
    releaseFromKeep,
    releaseFromWallGarrison,
    updateCastleKeeps,
    updateOutposts,
    updateWallGarrison,
  };
})();
