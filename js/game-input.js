/**
 * Selection, pointer input and map clicks.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameInput = (() => {
  const { ensurePlayerUnitDef, playSfx, posDistSq, spatialScratchQuery, svc, unitCounts } =
    GameCore;
  const GS = GameState;
  const { clampPos, sanitizeTactical, useSpatialQueries } = GameField;
  const { applyCamera, getCameraViewport } = GameCamera;
  let DRAG_THRESHOLD,
    ach,
    ackInteraction,
    applyPlayerStatMods,
    canDeployUnitType,
    canUseAbility,
    clearPlacementModes,
    clearSelection,
    creativeFillStatEditorFromSelection,
    creativeSpawnEnemyAt,
    creativeSpawnEnemyBuildingAt,
    creativeSpawnPlayerAt,
    creativeSpawnPlayerBuildingAt,
    creativeSpawnSquadAt,
    demolishBuilding,
    findBuildingAt,
    findPlayerBuildingAt,
    findPlayerGeneral,
    getDeployCost,
    getResearchOpts,
    getUnitById,
    orderMove,
    placeBuilding,
    refreshUnitCounts,
    relocateBuilding,
    rotateWall,
    setPaused,
    showMessage,
    siegeCtx,
    spawnUnit,
    syncInteractionState,
    useAbility,
    warCampCtx;
  function bind(api) {
    ({
      DRAG_THRESHOLD,
      ach,
      ackInteraction,
      applyPlayerStatMods,
      canDeployUnitType,
      canUseAbility,
      clearPlacementModes,
      clearSelection,
      creativeFillStatEditorFromSelection,
      creativeSpawnEnemyAt,
      creativeSpawnEnemyBuildingAt,
      creativeSpawnPlayerAt,
      creativeSpawnPlayerBuildingAt,
      creativeSpawnSquadAt,
      demolishBuilding,
      findBuildingAt,
      findPlayerBuildingAt,
      findPlayerGeneral,
      getDeployCost,
      getResearchOpts,
      getUnitById,
      orderMove,
      placeBuilding,
      refreshUnitCounts,
      relocateBuilding,
      rotateWall,
      setPaused,
      showMessage,
      siegeCtx,
      spawnUnit,
      syncInteractionState,
      useAbility,
      warCampCtx,
    } = api);
  }

  function canBoxSelectNow() {
    return (
      !GS.selectedDeploy &&
      !GS.selectedAbility &&
      !GS.selectedBuild &&
      !GS.selectedCourierMsg &&
      !GS.selectedDemolish &&
      !GS.selectedMoveBuilding &&
      !GS.selectedRotateWall &&
      !(GS.creativeMode && GS.creativeTool)
    );
  }

  function getSelectedUnitIds() {
    return GS.selectedUnitIds.length
      ? GS.selectedUnitIds
      : GS.selectedUnitId
        ? [GS.selectedUnitId]
        : [];
  }

  function getSelectedLiveUnits() {
    return getSelectedUnitIds()
      .map((id) => getUnitById(id))
      .filter((u) => u && u.hp > 0);
  }

  /**
   * Move the selection. opts.hold: true = go there and hold (Shift + click, long-press),
   * false/omitted = plain move, hunt from the new post, 'keep' = standing orders unchanged.
   */
  function moveSelectionToWorld(tx, ty, formationId = GS.selectionFormation, opts = {}) {
    const liveUnits =
      typeof Formations !== 'undefined'
        ? Formations.sortUnitsForFormation(getSelectedLiveUnits())
        : getSelectedLiveUnits();
    if (!liveUnits.length) return false;
    const anchor = clampPos(tx, ty);
    const offsets =
      typeof Formations !== 'undefined'
        ? Formations.computeOffsets(liveUnits.length, formationId)
        : liveUnits.map((_, i) => ({
            x: liveUnits.length > 1 ? (i % 3) * 14 - 14 : 0,
            y: liveUnits.length > 1 ? Math.floor(i / 3) * 12 : 0,
          }));
    liveUnits.forEach((unit, i) => {
      const off = offsets[i] || { x: 0, y: 0 };
      orderMove(unit, anchor.x + off.x, anchor.y + off.y, true, { hold: opts.hold ?? false });
    });
    // A move that lands on a war camp is the order to attack it; any other move cancels that.
    if (typeof WarCamps !== 'undefined') WarCamps.onMoveOrder(liveUnits, tx, ty, warCampCtx);
    if (opts.hold === true && liveUnits.some((u) => u.holding)) {
      showMessage('Go there and hold. A plain move or H releases.', 150);
    }
    syncInteractionState();
    return true;
  }

  function setSelectionFormation(id, opts = {}) {
    if (typeof Formations === 'undefined' || !Formations.FORMATIONS[id]) return false;
    GS.selectionFormation = id;
    if (typeof Analytics !== 'undefined') Analytics.onFormationUsed(id);
    if (opts.announce) {
      showMessage(`Move formation: ${Formations.getLabel(id)}`, 100);
    }
    syncInteractionState();
    return true;
  }

  function reformSelectionFormation(formationId = GS.selectionFormation) {
    const live = getSelectedLiveUnits();
    if (live.length < 2) {
      showMessage('Select 2+ units to reform.');
      return false;
    }
    if (typeof Formations !== 'undefined' && !Formations.FORMATIONS[formationId]) {
      formationId = 'box';
    }
    GS.selectionFormation = formationId;
    if (typeof Analytics !== 'undefined') Analytics.onFormationUsed(formationId);
    let cx = 0;
    let cy = 0;
    for (const u of live) {
      cx += u.x;
      cy += u.y;
    }
    cx /= live.length;
    cy /= live.length;
    moveSelectionToWorld(cx, cy, formationId, { hold: 'keep' });
    const label =
      typeof Formations !== 'undefined' ? Formations.getLabel(formationId) : formationId;
    showMessage(`${label} formation — ${live.length} units`, 160);
    playSfx('click');
    syncInteractionState();
    return true;
  }

  function handlePointerDown(sx, sy, button = 0, opts = {}) {
    if (GS.state !== 'playing') return;
    GS.activeDragThreshold = opts.dragThreshold ?? DRAG_THRESHOLD;
    if (button === 0 && canBoxSelectNow()) {
      const world = screenToWorld(sx, sy);
      const onPlayerUnit = !!getUnitAt(world.x, world.y, 'player');
      const hasSelection = getSelectedUnitIds().length > 0;
      const wantBox =
        !!opts.boxSelect ||
        (opts.emptyDragSelect !== false &&
          !onPlayerUnit &&
          !opts.forcePan &&
          !(hasSelection && !opts.boxSelect));
      if (wantBox && !opts.forcePan) {
        GS.boxSelect = {
          startSx: sx,
          startSy: sy,
          endSx: sx,
          endSy: sy,
          additive: !!opts.additive,
        };
        GS.isPanning = false;
        GS.panAnchor = null;
        GS.dragMoved = false;
        return;
      }
    }
    if (button !== 0 && !opts.pan) return;
    GS.isPanning = true;
    GS.dragMoved = false;
    GS.panAnchor = { sx, sy, cx: GS.cameraWorldX, cy: GS.cameraWorldY };
  }

  function trackPointer(sx, sy) {
    GS.pointerScreen = { sx, sy };
  }

  function handlePointerMove(sx, sy) {
    trackPointer(sx, sy);
    if (GS.boxSelect) {
      GS.boxSelect.endSx = sx;
      GS.boxSelect.endSy = sy;
      const dx = sx - GS.boxSelect.startSx;
      const dy = sy - GS.boxSelect.startSy;
      if (
        !GS.dragMoved &&
        (Math.abs(dx) > GS.activeDragThreshold || Math.abs(dy) > GS.activeDragThreshold)
      ) {
        GS.dragMoved = true;
        if (GS.canvas) GS.canvas.style.cursor = 'crosshair';
      }
      return;
    }
    if (!GS.isPanning || !GS.panAnchor) return;
    const dx = sx - GS.panAnchor.sx;
    const dy = sy - GS.panAnchor.sy;
    if (
      !GS.dragMoved &&
      (Math.abs(dx) > GS.activeDragThreshold || Math.abs(dy) > GS.activeDragThreshold)
    ) {
      GS.dragMoved = true;
      GS.canvas.style.cursor = 'grabbing';
    }
    if (!GS.dragMoved) return;
    GS.cameraWorldX = GS.panAnchor.cx - dx / GS.viewScale;
    GS.cameraWorldY = GS.panAnchor.cy - dy / GS.viewScale;
    applyCamera();
  }

  function finalizeBoxSelect() {
    if (!GS.boxSelect) return;
    const x1 = Math.min(GS.boxSelect.startSx, GS.boxSelect.endSx);
    const y1 = Math.min(GS.boxSelect.startSy, GS.boxSelect.endSy);
    const x2 = Math.max(GS.boxSelect.startSx, GS.boxSelect.endSx);
    const y2 = Math.max(GS.boxSelect.startSy, GS.boxSelect.endSy);
    const w1 = screenToWorld(x1, y1);
    const w2 = screenToWorld(x2, y2);
    const minX = Math.min(w1.x, w2.x);
    const maxX = Math.max(w1.x, w2.x);
    const minY = Math.min(w1.y, w2.y);
    const maxY = Math.max(w1.y, w2.y);
    const ids = GS.units
      .filter(
        (u) =>
          u.team === 'player' &&
          u.hp > 0 &&
          u.x >= minX &&
          u.x <= maxX &&
          u.y >= minY &&
          u.y <= maxY
      )
      .map((u) => u.id);
    // Click without drag — preserve selection so handleClick can issue move orders.
    if (!GS.dragMoved && ids.length === 0) return;
    if (GS.boxSelect.additive) {
      const merged = new Set([...GS.selectedUnitIds, ...ids]);
      if (GS.selectedUnitId) merged.add(GS.selectedUnitId);
      GS.selectedUnitIds = [...merged];
    } else {
      GS.selectedUnitIds = ids;
    }
    GS.selectedUnitId = GS.selectedUnitIds[GS.selectedUnitIds.length - 1] || ids[0] || null;
    if (GS.selectedUnitIds.length) {
      showMessage(`${GS.selectedUnitIds.length} unit(s) selected.`, 120);
      playSfx('click');
    }
  }

  function handlePointerUp() {
    if (GS.boxSelect) {
      const dragged = GS.dragMoved;
      if (dragged) finalizeBoxSelect();
      GS.boxSelect = null;
      GS.isPanning = false;
      GS.panAnchor = null;
      GS.dragMoved = false;
      if (GS.canvas) GS.canvas.style.cursor = 'grab';
      // A completed box-select is not a click; only an unmoved press is.
      return !dragged;
    }
    const wasClick = GS.isPanning && !GS.dragMoved;
    GS.isPanning = false;
    GS.panAnchor = null;
    GS.dragMoved = false;
    if (GS.canvas) GS.canvas.style.cursor = 'grab';
    return wasClick;
  }

  function screenToWorld(sx, sy) {
    const vp = getCameraViewport();
    return {
      x: GS.cameraWorldX + (sx - vp.centerX) / GS.viewScale,
      y: GS.cameraWorldY + (sy - vp.centerY) / GS.viewScale,
    };
  }

  function getUnitAt(wx, wy, team = 'player') {
    const hitBonus = svc('UX') ? svc('UX').getHitboxBonus() : 0;
    if (useSpatialQueries()) {
      if (svc('Perf')) svc('Perf').count('spatialQueries');
      const near = spatialScratchQuery(
        wx,
        wy,
        36 + hitBonus,
        (e) => e.kind === 'unit' && e.ref?.team === team
      );
      for (let i = near.length - 1; i >= 0; i--) {
        const u = near[i];
        const sz = (svc('SpriteGen').UNIT_STYLE[u.spriteType] || { size: 9 }).size + 10 + hitBonus;
        if (posDistSq(u.x, u.y, wx, wy) < sz * sz) return u;
      }
      return null;
    }
    for (let i = GS.units.length - 1; i >= 0; i--) {
      const u = GS.units[i];
      if (u.team !== team || u.hp <= 0) continue;
      const sz = (svc('SpriteGen').UNIT_STYLE[u.spriteType] || { size: 9 }).size + 10 + hitBonus;
      if (posDistSq(u.x, u.y, wx, wy) < sz * sz) return u;
    }
    return null;
  }

  function handleClick(sx, sy, opts = {}) {
    if (GS.state !== 'playing') return false;
    if (GS.paused) {
      // Recover from orphaned strong-pause (macro panels removed / tab glitch).
      if (typeof PacingTools !== 'undefined') {
        const snap = PacingTools.getSnapshot?.({ gameSpeed: 1, paused: true });
        if (snap?.macroPanels?.length || snap?.hiddenPause) {
          PacingTools.clearStrongPause?.();
          setPaused(false, { silent: true, reason: 'macro' });
        }
      }
      if (GS.paused) {
        showMessage('Game is paused — press Space or Esc to resume.', 180, {
          priority: 'critical',
          bypassQueue: true,
        });
        return false;
      }
    }
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    if (wx < 0 || wx > GS.worldW || wy < 0 || wy > GS.worldH + 40) {
      if (GS.selectedDeploy) {
        showMessage('Click inside the battlefield to place the unit.', 180);
      }
      return false;
    }
    const pos = clampPos(wx, wy);

    if (GS.creativeMode && GS.creativeTool === 'spawn_enemy') {
      creativeSpawnEnemyAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_enemy_building') {
      creativeSpawnEnemyBuildingAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_player') {
      creativeSpawnPlayerAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_player_building') {
      creativeSpawnPlayerBuildingAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool === 'spawn_squad') {
      creativeSpawnSquadAt(GS.creativeSpawnType, pos.x, pos.y);
      return ackInteraction(true);
    }
    if (GS.creativeMode && GS.creativeTool?.startsWith('level_')) {
      if (typeof LevelEditor !== 'undefined') LevelEditor.onMapClick(pos.x, pos.y);
      return ackInteraction(false);
    }

    if (GS.selectedDemolish) {
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target) {
        showMessage('Click one of your completed structures.');
        return false;
      }
      demolishBuilding(target);
      GS.selectedDemolish = false;
      return true;
    }

    if (GS.selectedMoveBuilding) {
      if (GS.moveBuildingTarget) {
        if (relocateBuilding(GS.moveBuildingTarget, pos.x, pos.y)) {
          GS.moveBuildingTarget = null;
          GS.selectedMoveBuilding = false;
        }
        return true;
      }
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target) {
        showMessage('Click a completed structure to move.');
        return false;
      }
      GS.moveBuildingTarget = target;
      showMessage(
        `Moving ${BuildDefs[target.type]?.name || 'structure'} — click destination.`,
        200
      );
      playSfx('click');
      return ackInteraction(false);
    }

    if (GS.selectedRotateWall) {
      const target = findPlayerBuildingAt(pos.x, pos.y);
      if (!target || target.type !== 'wall') {
        showMessage('Click one of your walls.');
        return false;
      }
      rotateWall(target);
      GS.selectedRotateWall = false;
      return true;
    }

    if (GS.selectedDeploy) {
      if (!canDeployUnitType(GS.selectedDeploy)) {
        showMessage('Creative mode — troop deploy disabled in lab settings (Academy Deploy off).');
        return false;
      }
      const def = ensurePlayerUnitDef(GS.selectedDeploy);
      if (!def) {
        showMessage(`Cannot deploy ${GS.selectedDeploy} — unit data missing.`, 260);
        return false;
      }
      if (
        svc('Research') &&
        !svc('Research').isDeployUnlocked(GS.selectedDeploy, getResearchOpts())
      ) {
        const need =
          GS.selectedDeploy === 'ballista'
            ? 'Research Siege Engineering (Military tree, after Iron Weapons) first!'
            : GS.selectedDeploy === 'bard'
              ? 'Research Morale Arts first!'
              : GS.selectedDeploy === 'scout' || GS.selectedDeploy === 'pikeman'
                ? 'Research Advanced Infantry first!'
                : 'Research this unit at the Research Lab first!';
        showMessage(need, 280);
        return false;
      }
      const deployCost = getDeployCost(GS.selectedDeploy);
      if (GS.tactical < deployCost) {
        showMessage('Not enough TP!');
        return false;
      }
      if (GS.selectedDeploy === 'general' && findPlayerGeneral()) {
        showMessage('You already have a General on the field!');
        return false;
      }
      if (GS.selectedDeploy === 'doomslayer_hero') {
        const doomOk =
          (GS.creativeMode && GS.creativeSettings.unlockAll) ||
          svc('MetaProgress').isAbyssWalkerUnlocked() ||
          (svc('Research') && svc('Research').isDoomResearchUnlocked(getResearchOpts()));
        if (!doomOk) {
          showMessage('Research Hellgate Containment or survive wave 200 on Hellbane difficulty!');
          return false;
        }
        if (GS.units.some((u) => u.isDoomslayer && u.hp > 0)) {
          showMessage('The Hellbane already walks the field!');
          return false;
        }
      }
      const u = spawnUnit(GS.selectedDeploy, pos.x, pos.y, 'player');
      if (!u) {
        showMessage(`Failed to spawn ${def.name || GS.selectedDeploy}.`, 260);
        return false;
      }
      applyPlayerStatMods(u);
      if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
      u.targetY = GS.rallyY;
      u.huntMode = GS.globalHunt && u.canHunt;
      if (u.canHunt && !u.huntMode) {
        u.manualOrder = true;
        u.targetX = u.x;
        u.targetY = u.y;
      }
      GS.units.push(u);
      if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= deployCost;
      playSfx('deploy');
      svc('Particles').dust(pos.x, pos.y);
      ach('deploy', {
        unitType: GS.selectedDeploy,
        armySize: unitCounts.player + 1,
      });
      if (GS.selectedDeploy === 'general' || u.isGeneral) ach('general_fielded', { wave: GS.wave });
      if (svc('Legacy')) svc('Legacy').recordDeploy(GS.selectedDeploy);
      if (typeof FoundationalMedievalLayer !== 'undefined') {
        FoundationalMedievalLayer.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof MartialPathEvolution !== 'undefined') {
        MartialPathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof ArcanePathEvolution !== 'undefined') {
        ArcanePathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof TechPathEvolution !== 'undefined') {
        TechPathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      if (typeof MythicPathEvolution !== 'undefined') {
        MythicPathEvolution.recordDeploy(GS.selectedDeploy, GS.wave);
      }
      // A plain click places one and puts the troop away. Shift-click keeps it armed for
      // the next one, as long as the next one (dearer, with upkeep) can still be paid for.
      const keepDeploy =
        !!(opts.shiftKey || opts.repeatDeploy || opts.selectSameType) &&
        GS.selectedDeploy !== 'general' &&
        GS.selectedDeploy !== 'doomslayer_hero';
      if (!keepDeploy) {
        GS.selectedDeploy = null;
      } else {
        refreshUnitCounts();
        const nextCost = getDeployCost(GS.selectedDeploy);
        if (GS.tactical < nextCost) {
          GS.selectedDeploy = null;
          showMessage(`The next one costs ${nextCost} TP — not enough. Recruiting ended.`, 200);
        }
      }
      return ackInteraction(true);
    }

    if (GS.selectedAbility) {
      const abilityId = GS.selectedAbility;
      const ab = Abilities[abilityId];
      const baseCost = ab?.cost ?? 99;
      const abCost =
        GS.creativeMode && GS.creativeSettings.freeResources
          ? 0
          : svc('ContentExpansion') && svc('ContentExpansion').getAbilityCost
            ? svc('ContentExpansion').getAbilityCost(abilityId, baseCost, GS.wave)
            : baseCost;
      if (GS.tactical < abCost) {
        showMessage('Not enough TP!');
        return false;
      }
      // Gate locked strikes BEFORE spending TP (voice shouts, challenge no-reinforce, etc.).
      if (!canUseAbility(abilityId)) return false;

      if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= abCost;
      const cast = useAbility(abilityId, pos.x, pos.y);
      if (!cast) {
        // Refund if cast still failed after gate (defensive).
        if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical += abCost;
        sanitizeTactical();
        return false;
      }
      GS.selectedAbility = null;
      return ackInteraction(true);
    }

    const clickedBuilding = findBuildingAt(pos.x, pos.y);
    if (clickedBuilding?.isWweAcademy && svc('MetaProgress').isChampionsUnlocked()) {
      ChampionsHall.togglePanel();
      playSfx('click');
      return true;
    }
    if (clickedBuilding?.isCrossoverBarracks && isCompanyHallType(clickedBuilding.type)) {
      FreeCompaniesScreen.togglePanel(clickedBuilding.crossoverFaction);
      playSfx('click');
      return true;
    }

    const clicked = getUnitAt(pos.x, pos.y);
    if (clicked) {
      if (clicked.team === 'player') {
        clearPlacementModes();
        if (opts.touch) {
          const selected = GS.selectedUnitIds.length
            ? GS.selectedUnitIds
            : GS.selectedUnitId
              ? [GS.selectedUnitId]
              : [];
          if (selected.includes(clicked.id)) {
            if (selected.length === 1) {
              clearSelection();
            } else {
              GS.selectedUnitIds = selected.filter((id) => id !== clicked.id);
              GS.selectedUnitId = GS.selectedUnitIds[GS.selectedUnitIds.length - 1] || null;
            }
          } else {
            GS.selectedUnitId = clicked.id;
            GS.selectedUnitIds = [clicked.id];
          }
        } else if (opts.toggleSelection) {
          if (!GS.selectedUnitIds.length && GS.selectedUnitId)
            GS.selectedUnitIds = [GS.selectedUnitId];
          if (GS.selectedUnitIds.includes(clicked.id)) {
            GS.selectedUnitIds = GS.selectedUnitIds.filter((id) => id !== clicked.id);
            GS.selectedUnitId = GS.selectedUnitIds.length
              ? GS.selectedUnitIds[GS.selectedUnitIds.length - 1]
              : null;
          } else {
            GS.selectedUnitIds.push(clicked.id);
            GS.selectedUnitId = clicked.id;
          }
        } else if (opts.selectSameType) {
          GS.selectedUnitIds = GS.units
            .filter((u) => u.team === 'player' && u.hp > 0 && u.type === clicked.type)
            .map((u) => u.id);
          GS.selectedUnitId = clicked.id;
          if (GS.selectedUnitIds.length > 1) {
            showMessage(
              `${GS.selectedUnitIds.length} ${clicked.type.replace(/_/g, ' ')}(s) selected.`,
              120
            );
          }
        } else {
          GS.selectedUnitId = clicked.id;
          GS.selectedUnitIds = [clicked.id];
        }
      } else {
        GS.selectedUnitId = clicked.id;
        GS.selectedUnitIds = [];
      }
      if (GS.creativeMode) creativeFillStatEditorFromSelection();
      playSfx('click');
      return ackInteraction(false);
    }

    if (getSelectedUnitIds().length) {
      // Shift+click at night with a Sapper selected re-sites one of his mines.
      if (
        opts.shiftKey &&
        typeof SapperKit !== 'undefined' &&
        SapperKit.orderMine(getSelectedUnitIds(), pos.x, pos.y, siegeCtx)
      ) {
        return ackInteraction(true);
      }
      // Shift + click (or a long press on touch) = go there and hold.
      moveSelectionToWorld(pos.x, pos.y, undefined, { hold: !!(opts.shiftKey || opts.hold) });
      return true;
    }

    if (GS.selectedBuild) {
      const buildType = GS.selectedBuild;
      const placed = placeBuilding(pos.x, pos.y);
      // Shift-click: keep the same building armed for the next one (a run of walls).
      if (
        placed &&
        opts.shiftKey &&
        !GS.selectedBuild &&
        BuildDefs[buildType] &&
        ((GS.creativeMode && GS.creativeSettings.freeResources) ||
          GS.tactical >= BuildDefs[buildType].cost)
      ) {
        GS.selectedBuild = buildType;
        syncInteractionState();
      }
      return placed;
    }

    return false;
  }

  return {
    bind,
    canBoxSelectNow,
    getSelectedLiveUnits,
    getSelectedUnitIds,
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    moveSelectionToWorld,
    reformSelectionFormation,
    screenToWorld,
    setSelectionFormation,
    trackPointer,
  };
})();
