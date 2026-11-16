/**
 * Presentation update and draw().
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameRender = (() => {
  const {
    ensureBuildingHealth,
    getAdvancedMods,
    getGfxQuality,
    isMoraleCombatUnit,
    svc,
    unitCounts,
  } = GameCore;
  const GS = GameState;
  const { clampPos, getLivingPlanetCtx, gfxOverlayFor, isUnitSelected } = GameField;
  const {
    clampCameraToBounds,
    getMapViewH,
    getVisibleBounds,
    isInView,
    isMapOverlappingViewport,
    sanitizeCameraState,
    syncCameraTransform,
  } = GameCamera;
  const { canBoxSelectNow, getSelectedUnitIds, screenToWorld } = GameInput;
  const { drawHoldMarker, drawMedMark, drawPostMarkers } = GameStance;
  const { getGeneralAura, getGeneralBuffStrength } = GameCombat;
  const { isBuildSiteBlocked } = GameBuildings;
  const { getWaveAttackSides } = GameWaves;
  const { getDayLightLevel, getNightSecondsRemaining, isDayPhase, isNightPhase } = GameDayNight;
  let cachedSnap, directShowMessage, getState, isEnemyHiddenByFog, siegeCtx, warCampCtx;
  function bind(api) {
    ({ cachedSnap, directShowMessage, getState, isEnemyHiddenByFog, siegeCtx, warCampCtx } = api);
  }

  /** Visual/presentation tick — runs every frame, separate from simulation logic. */
  function updatePresentation() {
    if (GS.state !== 'playing') return;
    if (typeof PacingTools !== 'undefined') {
      PacingTools.tick({
        paused: GS.paused,
        directShow: directShowMessage,
      });
    }
    svc('Particles').update();
    CombatFX.update();
    StrikeFX?.update?.();
    svc('FloatingText').update();
    if (typeof GameFeedback !== 'undefined') {
      GameFeedback.update();
      GameFeedback.updateDanger(GS.units, GS.worldH, GS.rallyY);
    }
    globalThis.BannerArt?.observe?.(GS, siegeCtx);
    if (svc('VisualPolish')) {
      svc('VisualPolish').update();
      svc('VisualPolish').updateAudioMix({
        wave: GS.wave,
        timeOfDay: GS.timeOfDay,
        bossActive: !!GS.currentWaveConfig?.boss,
        hordeWave: GS.currentHordeWave,
        playerCount: unitCounts.player,
        enemyCount: unitCounts.activeEnemy,
        spawnQueueLen: GS.spawnQueue.length,
        projectileCount: GS.projectiles.length,
      });
    }
  }

  function getSortedAliveUnits() {
    const shift = getGfxQuality()?.sortFrameShift ?? 2;
    const frame = GS.updateTick >> shift;
    if (GS.sortedUnitsFrame === frame && GS.sortedUnitsCache.length) return GS.sortedUnitsCache;
    GS.sortedUnitsCache = [];
    for (const u of GS.units) {
      if (u.hp > 0 && isInView(u.x, u.y, 36)) GS.sortedUnitsCache.push(u);
    }
    GS.sortedUnitsCache.sort((a, b) => a.y - b.y);
    GS.sortedUnitsFrame = frame;
    return GS.sortedUnitsCache;
  }

  function draw() {
    if (!GS.canvas || !GS.ctx) return;
    GS.visibleBoundsCore = null;
    if (svc('Perf')) svc('Perf').begin('draw');
    const gfxQ = getGfxQuality();
    const light = getDayLightLevel();
    const fieldArt = typeof FieldArt !== 'undefined' ? FieldArt : null;
    const buildingArt = typeof BuildingArt !== 'undefined' ? BuildingArt : null;
    const propArt = typeof PropArt !== 'undefined' ? PropArt : null;
    sanitizeCameraState();
    syncCameraTransform();
    if (!isMapOverlappingViewport()) clampCameraToBounds();
    const drawScale =
      Number.isFinite(GS.viewScale) && GS.viewScale > 0
        ? GS.viewScale
        : GS.baseViewScale * GS.cameraZoom;
    GS.ctx.setTransform(1, 0, 0, 1, 0, 0);
    GS.ctx.globalAlpha = 1;
    GS.ctx.setLineDash([]);
    GS.ctx.fillStyle = '#1a1410';
    GS.ctx.fillRect(0, 0, GS.canvas.width, GS.canvas.height);
    let worldLayerDrawn = false;
    try {
      GS.ctx.save();
      const shake = svc('VisualPolish')?.getScreenShakeOffset?.() || { x: 0, y: 0, zoom: 1 };
      const punchZoom = Number.isFinite(shake.zoom) && shake.zoom > 0 ? shake.zoom : 1;
      // Zoom punch toward viewport center so kill hits feel heavier
      if (punchZoom !== 1) {
        const cx = GS.canvas.width / 2;
        const cy = GS.canvas.height / 2;
        GS.ctx.translate(cx, cy);
        GS.ctx.scale(punchZoom, punchZoom);
        GS.ctx.translate(-cx, -cy);
      }
      GS.ctx.translate(GS.viewX + (shake.x || 0), GS.viewY + (shake.y || 0));
      GS.ctx.scale(drawScale, drawScale);
      worldLayerDrawn = true;

      if (fieldArt) {
        // Inked ground; the biomes are painted into it, so there is no tinted region box.
        fieldArt.drawGround(GS.ctx, GS.worldW, getMapViewH(), GS.updateTick, () =>
          svc('LivingPlanet') ? svc('LivingPlanet').getRegionBands(getLivingPlanetCtx()) : []
        );
      } else {
        GS.ctx.drawImage(
          svc('SpriteGen').getBattlefieldCanvas(
            GS.worldW,
            getMapViewH(),
            BASE_FIELD_W,
            BASE_FIELD_H
          ),
          0,
          0
        );
      }
      SiegeLoop.drawGround(GS.ctx);
      svc('Particles')?.drawGround?.(GS.ctx, getVisibleBounds(140));
      if (svc('VisualPolish') && gfxQ?.drawBorders !== false) {
        svc('VisualPolish').drawTerritoryBorders(
          GS.ctx,
          GS.worldW,
          getMapViewH(),
          GS.territoryTier
        );
        if (getAdvancedMods().fogOfWar && gfxQ?.drawFog !== false) {
          const fogTop = Math.max(40, GS.rallyY - 40);
          if (fieldArt) fieldArt.drawFogOfWar(GS.ctx, GS.worldW, fogTop);
          else {
            const grad = GS.ctx.createLinearGradient(0, 0, 0, fogTop);
            grad.addColorStop(0, 'rgba(14, 18, 28, 0.42)');
            grad.addColorStop(0.55, 'rgba(14, 18, 28, 0.16)');
            grad.addColorStop(1, 'rgba(14, 18, 28, 0)');
            GS.ctx.fillStyle = grad;
            GS.ctx.fillRect(0, 0, GS.worldW, fogTop);
          }
        }
      }
      svc('SpriteGen').drawAttackSideMarkers(
        GS.ctx,
        GS.worldW,
        getMapViewH(),
        getWaveAttackSides(),
        GS.wave,
        {
          unlockedSides: getUnlockedAttackSides(GS.wave),
          tick: GS.updateTick,
          phase: GS.timeOfDay,
        }
      );

      if (gfxQ?.drawHazards !== false) {
        for (const h of GS.hazards) {
          if (!isInView(h.x, h.y, h.radius || 30)) continue;
          if (propArt && propArt.drawHazard(GS.ctx, h, GS.updateTick)) continue;
          svc('SpriteGen').drawHazard?.(GS.ctx, h);
        }
      }
      if (svc('DynamicMapEvents') && svc('VisualPolish')) {
        const mapEvt = cachedSnap('mapEventsState', () =>
          svc('DynamicMapEvents').getStateSnapshot(GS.wave, GS.tactical, isNightPhase())
        );
        const site = mapEvt?.event?.site;
        if (site && isInView(site.x, site.y, site.radius || 60)) {
          svc('VisualPolish').drawMapEventSite(GS.ctx, site, GS.updateTick, GS.timeOfDay);
        }
      }

      const stationedGen = unitCounts.stationedGeneral;
      if (stationedGen && isInView(stationedGen.x, stationedGen.y, 200)) {
        const aura = getGeneralAura();
        GS.ctx.strokeStyle = `rgba(255, 215, 0, ${0.12 + aura.strength * 0.18})`;
        GS.ctx.lineWidth = 2 / Math.max(0.5, GS.viewScale);
        GS.ctx.beginPath();
        GS.ctx.arc(stationedGen.x, stationedGen.y, aura.radius, 0, Math.PI * 2);
        GS.ctx.stroke();
      }

      if (gfxQ?.drawDecor !== false) {
        if (propArt) propArt.drawWrecks(GS.ctx, GS.updateTick, isInView);
        for (const d of GS.decorations) {
          if (!isInView(d.x, d.y, d.size || 16)) continue;
          if (fieldArt && fieldArt.drawDecor(GS.ctx, d)) continue;
          if (propArt && propArt.drawDecor(GS.ctx, d, GS.updateTick)) continue;
          if (d.type === 'tree') svc('SpriteGen').drawTree(GS.ctx, d.x, d.y, d.size);
          else if (d.type === 'rock') svc('SpriteGen').drawRock(GS.ctx, d.x, d.y, d.size);
          else if (d.type === 'barricade') svc('SpriteGen').drawBarricade(GS.ctx, d.x, d.y);
          else if (d.type === 'neutral_den')
            svc('SpriteGen').drawNeutralDen?.(GS.ctx, d.x, d.y, d.size);
          else if (d.type === 'supply_crate' || d.type === 'oil_barrel')
            svc('SpriteGen').drawDestructible?.(GS.ctx, d);
        }
      }

      // The line enemies must not cross, then rubble, then the standing buildings.
      if (fieldArt) {
        fieldArt.drawLine(GS.ctx, GS.worldW, GS.worldH, GS.updateTick, {
          dark: fieldArt.darkness(),
        });
      }
      if (buildingArt) buildingArt.drawRubble(GS.ctx, GS.updateTick);
      const artEnv = buildingArt
        ? {
            dark: fieldArt ? fieldArt.darkness() : 0,
            hoverX: null,
            hoverY: null,
            k: 1 / Math.max(0.5, GS.viewScale),
            lowDetail: gfxQ?.drawDecor === false,
          }
        : null;
      if (artEnv && GS.pointerScreen.sx >= 0) {
        const hw = screenToWorld(GS.pointerScreen.sx, GS.pointerScreen.sy);
        artEnv.hoverX = hw.x;
        artEnv.hoverY = hw.y;
      }
      for (const b of GS.buildings) {
        if (b.hp <= 0 || !isInView(b.x, b.y, b.radius || 28)) continue;
        if (artEnv) buildingArt.draw(GS.ctx, b, GS.updateTick, artEnv);
        else svc('SpriteGen').drawBuilding(GS.ctx, b);
        // The drawing shows damage itself; the bar appears only once a building is hurt.
        if (gfxQ?.buildingHpBars !== false && (!artEnv || b.hp < b.maxHp)) {
          const barW = b.isHamlet || b.isMerchantGuild ? 40 : 32;
          ensureBuildingHealth(b);
          const hpRatio = b.maxHp > 0 ? b.hp / b.maxHp : 0;
          svc('SpriteGen').drawHealthBar(
            GS.ctx,
            b.x,
            b.y + b.radius * 0.5,
            barW,
            hpRatio,
            b.owner === 'enemy'
          );
        }
      }
      if (buildingArt) {
        buildingArt.drawCollapses(GS.ctx, GS.updateTick);
        buildingArt.drawHover(GS.ctx, artEnv);
      }

      if (
        GS.selectedBuild === 'wall' &&
        GS.pointerScreen.sx >= 0 &&
        svc('SpriteGen').drawWallPlacementGhost
      ) {
        const pw = screenToWorld(GS.pointerScreen.sx, GS.pointerScreen.sy);
        if (pw.x >= 0 && pw.x <= GS.worldW && pw.y >= 0 && pw.y <= GS.worldH + 40) {
          const pos = clampPos(pw.x, pw.y);
          const wallDef = BuildDefs.wall;
          const valid = wallDef && !isBuildSiteBlocked(pos.x, pos.y, wallDef);
          const ghost = buildingArt
            ? buildingArt.drawWallGhost
            : svc('SpriteGen').drawWallPlacementGhost;
          ghost(GS.ctx, pos.x, pos.y, GS.pendingWallFacing, {
            valid,
            radius: wallDef?.radius,
          });
        }
      }

      const sel = unitCounts.selectedLive;
      if (sel) {
        if (sel.path?.length && isInView(sel.x, sel.y, 60)) {
          GS.ctx.strokeStyle = 'rgba(100,200,255,0.4)';
          GS.ctx.lineWidth = 1.5 / Math.max(0.5, GS.viewScale);
          GS.ctx.beginPath();
          GS.ctx.moveTo(sel.x, sel.y);
          for (let i = sel.pathIndex; i < sel.path.length; i++)
            GS.ctx.lineTo(sel.path[i].x, sel.path[i].y);
          GS.ctx.stroke();
        }
      }

      const selCount = getSelectedUnitIds().length;
      if (
        selCount > 1 &&
        GS.pointerScreen.sx >= 0 &&
        typeof Formations !== 'undefined' &&
        canBoxSelectNow()
      ) {
        const preview = screenToWorld(GS.pointerScreen.sx, GS.pointerScreen.sy);
        const offsets = Formations.computeOffsets(selCount, GS.selectionFormation);
        GS.ctx.save();
        GS.ctx.fillStyle = 'rgba(100,200,255,0.35)';
        GS.ctx.strokeStyle = 'rgba(100,200,255,0.55)';
        GS.ctx.lineWidth = 1 / Math.max(0.5, GS.viewScale);
        for (const off of offsets) {
          const px = preview.x + off.x;
          const py = preview.y + off.y;
          if (!isInView(px, py, 20)) continue;
          GS.ctx.beginPath();
          GS.ctx.arc(px, py, 4 / Math.max(0.5, GS.viewScale), 0, Math.PI * 2);
          GS.ctx.fill();
          GS.ctx.stroke();
        }
        GS.ctx.restore();
      }

      for (const m of GS.moveMarkers) {
        if (isInView(m.x, m.y, 12)) svc('SpriteGen').drawMoveMarker(GS.ctx, m.x, m.y);
      }

      drawPostMarkers();

      if (gfxQ?.drawLanternAuras !== false)
        for (const u of GS.units) {
          if (
            !u.isWwe ||
            u.wweAbility !== 'corpse_candle_omen' ||
            u.hp <= 0 ||
            !isInView(u.x, u.y, 140)
          )
            continue;
          const pulse = 0.1 + Math.sin(GS.updateTick * 0.07) * 0.05;
          const alpha = pulse * (isNightPhase() ? 0.35 : 0.55 + (1 - light) * 0.45);
          GS.ctx.fillStyle = `rgba(48,96,48,${alpha})`;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 132, 0, Math.PI * 2);
          GS.ctx.fill();
          GS.ctx.strokeStyle = `rgba(120,200,80,${alpha * 1.2})`;
          GS.ctx.lineWidth = 1.5;
          GS.ctx.setLineDash([6, 8]);
          GS.ctx.stroke();
          GS.ctx.setLineDash([]);
        }

      const sorted = getSortedAliveUnits();
      const rallyPulse = GS.updateTick * 0.08;
      const heavyScene = sorted.length > 55 || (gfxQ && gfxQ.drawMorale === false);
      const spriteLodSvc = svc('SpriteLod');
      const perfSvc = svc('Perf');
      const sceneSpriteLod = spriteLodSvc ? spriteLodSvc.getSceneLod(sorted.length, gfxQ) : 0;
      const drawSelectedIds = GS.updateThrottleCtx?.selectedIds || GS.cachedSelectedSet;
      const spriteLodCtx = spriteLodSvc
        ? {
            isInView,
            selectedIds: drawSelectedIds,
            farPad: gfxQ?.distantAiPad ?? 120,
          }
        : null;
      for (const u of sorted) {
        if (perfSvc) perfSvc.count('drawUnits');
        const unitLod = spriteLodSvc ? spriteLodSvc.getUnitLod(u, sceneSpriteLod, spriteLodCtx) : 0;
        const drawOverlays = !spriteLodSvc || spriteLodSvc.shouldDrawUnitOverlays(unitLod);
        const drawRings = !spriteLodSvc || spriteLodSvc.shouldDrawUnitRings(unitLod);
        if (u.rallyTimer > 0 && gfxQ?.rallyRings !== false && drawRings) {
          GS.ctx.strokeStyle = `rgba(240,192,64,${0.25 + Math.sin(rallyPulse) * 0.15})`;
          GS.ctx.lineWidth = 2;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
          GS.ctx.stroke();
        }
        if (
          drawRings &&
          gfxOverlayFor(u, gfxQ?.eliteRings) &&
          (isEliteEnemy(u) || u.isEvilOperative || u.type === 'war_chief' || u.isNamedBoss)
        ) {
          const monster = typeof isMonsterEnemy === 'function' && isMonsterEnemy(u);
          const named = u.isNamedBoss || (typeof isNamedBoss === 'function' && isNamedBoss(u));
          const ringR = 15 + (u.spriteScale || 1) * 4 + (named ? 10 : monster ? 6 : 0);
          GS.ctx.strokeStyle = named
            ? 'rgba(255,215,0,0.75)'
            : monster
              ? 'rgba(255,60,80,0.65)'
              : 'rgba(200,80,255,0.55)';
          GS.ctx.lineWidth = named ? 3 : monster ? 3 : 2;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, ringR, 0, Math.PI * 2);
          GS.ctx.stroke();
        }
        if (
          drawRings &&
          u.team === 'player' &&
          u.vetTier > 0 &&
          gfxQ?.drawVet !== false &&
          (!heavyScene || isUnitSelected(u))
        ) {
          GS.ctx.strokeStyle = `rgba(255,215,0,${0.35 + u.vetTier * 0.08})`;
          GS.ctx.lineWidth = 2;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 17 + u.vetTier * 2, 0, Math.PI * 2);
          GS.ctx.stroke();
        }
        if (
          drawOverlays &&
          gfxQ?.chargeGlow !== false &&
          u.combatType === 'cavalry' &&
          u.chargeTimer > 30
        ) {
          GS.ctx.fillStyle = `rgba(255,180,60,${(u.chargeTimer / 90) * 0.35})`;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 13, 0, Math.PI * 2);
          GS.ctx.fill();
        }
        if (drawOverlays && gfxQ?.honorGlow !== false && (u.honorGlowTimer || 0) > 0) {
          const glow = u.honorGlowTimer / 240;
          GS.ctx.fillStyle = `rgba(255, 215, 0, ${0.15 + glow * 0.25})`;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 16 + glow * 4, 0, Math.PI * 2);
          GS.ctx.fill();
        }
        if (isEnemyHiddenByFog(u)) continue;
        const drawRot = svc('GfxQuality')
          ? svc('GfxQuality').quantizeRotation(u.rotation)
          : u.rotation;
        const sprScale = svc('GfxQuality')
          ? svc('GfxQuality').quantizeScale(u.spriteScale || 1)
          : Math.round((u.spriteScale || 1) * 4) / 4;
        const drawSz = (svc('SpriteGen').UNIT_DRAW_SIZE || 62) * sprScale;
        // spriteType is derived from type at spawn and should always be a string; fall back
        // to u.type if it ever desyncs (see sprites.js drawUnitTopDown for the last-resort
        // guard) so a bad unit renders as itself instead of a hardcoded placeholder.
        // State and frame (gait, idle variation, rout, celebrate, work) come from the sprite clock.
        const anim = svc('SpriteGen').animFor(u, GS.updateTick);
        const img = svc('SpriteGen').getUnitCanvas(
          u.spriteType || u.type,
          drawRot,
          u.team,
          anim.frame,
          sprScale,
          anim.state,
          unitLod
        );
        // Micro hit recoil offset
        let drawX = u.x;
        let drawY = u.y;
        if ((u.hitFlash || 0) > 0) {
          const flashT = u.hitFlash / (u.hitFlashMax || 6);
          const recoil = flashT * 1.6;
          drawX += (Math.random() - 0.5) * recoil;
          drawY += (Math.random() - 0.5) * recoil * 0.6;
        }
        if (typeof GameFeedback !== 'undefined') {
          GameFeedback.drawLowHpPulse(GS.ctx, u, GS.updateTick);
        }
        GS.ctx.drawImage(img, drawX - drawSz / 2, drawY - drawSz / 2, drawSz, drawSz);
        // Hit flash — white/red overlay so damage is instantly readable
        if ((u.hitFlash || 0) > 0) {
          const flashT = u.hitFlash / (u.hitFlashMax || 6);
          GS.ctx.save();
          GS.ctx.globalAlpha = Math.min(0.75, flashT * 0.7);
          GS.ctx.fillStyle = flashT > 0.55 ? '#ffffff' : u.team === 'enemy' ? '#ff5050' : '#ffc080';
          GS.ctx.beginPath();
          // Sized to the body, not to the sprite canvas (which is mostly empty margin).
          const bodyR = svc('SpriteGen').bodyRadius(u.spriteType || u.type, u.team) * sprScale;
          GS.ctx.arc(drawX, drawY, bodyR, 0, Math.PI * 2);
          GS.ctx.fill();
          // Brief outline punch
          if (flashT > 0.4) {
            GS.ctx.strokeStyle = '#ffe8a0';
            GS.ctx.lineWidth = 2;
            GS.ctx.globalAlpha = flashT * 0.55;
            GS.ctx.beginPath();
            GS.ctx.arc(drawX, drawY, bodyR * 1.18, 0, Math.PI * 2);
            GS.ctx.stroke();
          }
          GS.ctx.restore();
        }
        if (
          u.id === GS.selectedUnitId ||
          (drawSelectedIds ? drawSelectedIds.has(u.id) : GS.selectedUnitIds.includes(u.id))
        ) {
          svc('SpriteGen').drawSelectionRing(
            GS.ctx,
            u.x,
            u.y,
            u.id === GS.selectedUnitId ? 14 : 12
          );
        }
        const hpMode = gfxQ?.unitHpBars ?? 'all';
        const showHp = hpMode === 'all' || gfxOverlayFor(u, hpMode);
        if (showHp) {
          const barW = 24 * Math.max(1, (u.spriteScale || 1) * 0.85);
          const barY = u.y - 22 - ((u.spriteScale || 1) - 1) * 10;
          svc('SpriteGen').drawHealthBar(
            GS.ctx,
            u.x,
            barY,
            barW,
            u.hp / u.maxHp,
            u.team === 'enemy'
          );
        }
        if (
          drawOverlays &&
          gfxQ?.drawMorale !== false &&
          isMoraleCombatUnit(u) &&
          u.maxMorale > 0
        ) {
          svc('SpriteGen').drawMoraleBar(GS.ctx, u.x, u.y - 27, 20, u.morale / u.maxMorale);
        }
        if (
          u.team === 'enemy' &&
          u.isNamedBoss &&
          u.hp > 0 &&
          gfxOverlayFor(u, gfxQ?.drawHonor ?? true)
        ) {
          GS.ctx.fillStyle = 'rgba(255,220,120,0.95)';
          GS.ctx.font = 'bold 7px Cinzel';
          GS.ctx.textAlign = 'center';
          const labelY = u.y - 38 - ((u.spriteScale || 1) - 1) * 12;
          GS.ctx.fillText(u.bossName || EnemyDefs[u.type]?.bossName || 'BOSS', u.x, labelY);
          const title = u.bossTitle || EnemyDefs[u.type]?.bossTitle;
          if (title) {
            GS.ctx.font = '6px Cinzel';
            GS.ctx.fillStyle = 'rgba(255,160,160,0.9)';
            GS.ctx.fillText(title, u.x, labelY + 9);
          }
        }
        if (u.team === 'player') {
          if (gfxQ?.drawVet !== false) svc('SpriteGen').drawVetStars(GS.ctx, u.x, u.y, u);
          if (u.honorName && gfxOverlayFor(u, gfxQ?.drawHonor ?? true)) {
            if (typeof repairHonorName === 'function') repairHonorName(u);
            if (u.honorName && (!heavyScene || isUnitSelected(u))) {
              GS.ctx.fillStyle = 'rgba(240,232,176,0.92)';
              GS.ctx.font = '6px Cinzel';
              GS.ctx.textAlign = 'center';
              const nameY = u.isGeneral && u.stationedKeep ? u.y - 44 : u.y - 38;
              GS.ctx.fillText(u.honorName, u.x, nameY);
            }
          }
        }
        if (u.retreatingToMed && u.hp > 0) drawMedMark(u);
        if (u.holding && u.hp > 0) drawHoldMarker(u);
        if (svc('VisualPolish')) {
          if (gfxOverlayFor(u, gfxQ?.drawAccent ?? true))
            svc('VisualPolish').drawFactionAccent(GS.ctx, u);
          if (gfxQ?.drawAccessibility !== false)
            svc('VisualPolish').drawAccessibilityCue(GS.ctx, u);
        } else if (u.isWwe && u.wweColor) {
          GS.ctx.strokeStyle = u.wweColor;
          GS.ctx.lineWidth = 2;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
          GS.ctx.stroke();
        }
        if (u.isDoomslayer && u.hp > 0) {
          GS.ctx.strokeStyle = 'rgba(255,64,32,0.85)';
          GS.ctx.lineWidth = 3;
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 18, 0, Math.PI * 2);
          GS.ctx.stroke();
          GS.ctx.fillStyle = '#ff4020';
          GS.ctx.font = '6px Cinzel';
          GS.ctx.textAlign = 'center';
          GS.ctx.fillText('BANE', u.x, u.y - 22);
        }
        if (gfxQ?.generalOverlay !== false && u.isGeneral && u.hp > 0) {
          GS.ctx.strokeStyle = 'rgba(255,215,0,0.7)';
          GS.ctx.lineWidth = 2;
          GS.ctx.setLineDash([3, 3]);
          GS.ctx.beginPath();
          GS.ctx.arc(u.x, u.y, 20, 0, Math.PI * 2);
          GS.ctx.stroke();
          GS.ctx.setLineDash([]);
          if (u.stationedKeep) {
            const str = getGeneralBuffStrength();
            GS.ctx.fillStyle = '#ffd700';
            GS.ctx.font = '7px Cinzel';
            GS.ctx.textAlign = 'center';
            const stars = u.generalStars ? ` ★${u.generalStars}` : '';
            GS.ctx.fillText(`CMD ${Math.round(str * 100)}%${stars}`, u.x, u.y - 30);
          } else if (u.rallyTargetId) {
            GS.ctx.fillStyle = '#ffd700';
            GS.ctx.font = '7px Cinzel';
            GS.ctx.textAlign = 'center';
            GS.ctx.fillText('WALL TO WALL', u.x, u.y - 34);
          }
          if ((u.w2wBuffTimer || 0) > 0) {
            GS.ctx.strokeStyle = `rgba(255,215,0,${0.35 + Math.sin(GS.updateTick * 0.12) * 0.2})`;
            GS.ctx.lineWidth = 3;
            GS.ctx.beginPath();
            GS.ctx.arc(u.x, u.y, 24, 0, Math.PI * 2);
            GS.ctx.stroke();
          }
        }
      }

      // Units behind a tree were drawn over its canopy and looked like they walked into it.
      if (fieldArt && gfxQ?.drawDecor !== false && sorted.length) {
        GS.ctx.save();
        GS.ctx.globalAlpha = 0.72;
        for (const d of GS.decorations) {
          if (d.type !== 'tree' || !isInView(d.x, d.y, d.size || 16)) continue;
          const s = (d.size || 14) * 1.2;
          for (const u of sorted) {
            if (u.y >= d.y - 2) break;
            if (u.y > d.y - s * 1.4 && Math.abs(u.x - d.x) < s * 0.7) {
              fieldArt.drawDecor(GS.ctx, d);
              break;
            }
          }
        }
        GS.ctx.restore();
      }

      const vBounds = getVisibleBounds(140);
      if (svc('ContentExpansion') && svc('ContentExpansion').getFortifyZones) {
        StrikeFX?.drawFortifyZones?.(
          GS.ctx,
          svc('ContentExpansion').getFortifyZones(),
          GS.updateTick
        );
      }
      StrikeFX?.draw?.(GS.ctx, vBounds);
      if (GS.selectedAbility && GS.pointerScreen.sx >= 0) {
        const ab = Abilities[GS.selectedAbility];
        const pw = screenToWorld(GS.pointerScreen.sx, GS.pointerScreen.sy);
        StrikeFX?.drawTargeting?.(
          GS.ctx,
          GS.selectedAbility,
          pw.x,
          pw.y,
          ab?.radius || 50,
          GS.updateTick
        );
      }
      CombatFX.draw(GS.ctx, vBounds);
      for (const p of GS.projectiles) {
        if (isInView(p.x, p.y, 20, 0))
          (globalThis.ProjectileArt || svc('SpriteGen')).drawProjectile(GS.ctx, p, GS.updateTick);
      }
      globalThis.ProjectileArt?.drawOver?.(GS.ctx, vBounds, GS.updateTick);
      if (svc('VisualPolish') && gfxQ?.drawCorpses !== false)
        svc('VisualPolish').drawDeathCorpses(GS.ctx);
      SiegeLoop.drawWorld(GS.ctx, GS.units, GS.updateTick);
      if (typeof WarCamps !== 'undefined') WarCamps.draw(GS.ctx, warCampCtx, GS.updateTick);
      Roster.drawOverlays(GS.ctx, GS.units, GS.updateTick);
      svc('Particles').draw(GS.ctx, vBounds);
      svc('FloatingText').draw(GS.ctx, vBounds);

      if (svc('VisualPolish')) {
        const atm = gfxQ?.atmosphere ?? 'full';
        // With FieldArt, VisualPolish keeps the weather clock, particles and boss dread
        // (asked for as plain day), and FieldArt lays the weather and the light map over it.
        if (atm === 'full') {
          svc('VisualPolish').drawAtmosphere(
            GS.ctx,
            GS.worldW,
            getMapViewH(),
            fieldArt ? 1 : light,
            fieldArt ? 'day' : GS.timeOfDay,
            GS.wave,
            GS.updateTick,
            {
              weatherParticles: gfxQ?.weatherParticles !== false,
              bossActive: unitCounts.bossActive,
            }
          );
          if (fieldArt) {
            fieldArt.drawWeather(GS.ctx, GS.worldW, getMapViewH(), GS.wave, GS.updateTick, {
              lowDetail: gfxQ?.weatherParticles === false,
            });
          }
        } else if (atm === 'simple' && !fieldArt) {
          svc('VisualPolish').drawAtmosphere(
            GS.ctx,
            GS.worldW,
            getMapViewH(),
            light,
            GS.timeOfDay,
            GS.wave,
            GS.updateTick,
            { simple: true }
          );
        }
        if (fieldArt && (atm === 'full' || atm === 'simple')) {
          fieldArt.drawLight(GS.ctx, GS.worldW, getMapViewH(), {
            light,
            phase: GS.timeOfDay,
            tick: GS.updateTick,
            buildings: GS.buildings,
            units: GS.units,
            hazards: GS.hazards,
            simple: atm === 'simple',
            inView: isInView,
          });
        }
        if (GS.currentHordeWave && isDayPhase() && gfxQ?.drawOverlay !== false) {
          svc('VisualPolish').drawHordeIntensity(
            GS.ctx,
            GS.worldW,
            getMapViewH(),
            GS.currentHordeWave,
            GS.updateTick
          );
        }
      } else if (isNightPhase()) {
        GS.ctx.fillStyle = 'rgba(6,10,32,0.62)';
        GS.ctx.fillRect(0, 0, GS.worldW, getMapViewH());
      } else if (light < 0.92) {
        const dusk = 1 - light;
        GS.ctx.fillStyle = `rgba(24,14,48,${dusk * 0.42})`;
        GS.ctx.fillRect(0, 0, GS.worldW, getMapViewH());
      }

      // Status marks go over the night and weather layers so they read in the dark.
      Roster.drawMarks(GS.ctx, GS.units, GS.updateTick, getDayLightLevel());

      GS.ctx.globalAlpha = 1;
      GS.ctx.setLineDash([]);
    } catch (drawErr) {
      console.error('draw world layer error', drawErr);
    } finally {
      if (worldLayerDrawn) {
        try {
          GS.ctx.restore();
        } catch (_) {
          GS.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
    }

    StrikeFX?.drawScreenFx?.(GS.ctx, GS.canvas.width, GS.canvas.height);
    CombatFX?.drawScreenFlash?.(GS.ctx, GS.canvas.width, GS.canvas.height);
    if (typeof GameFeedback !== 'undefined') {
      GameFeedback.drawDangerVignette(GS.ctx, GS.canvas.width, GS.canvas.height);
      GameFeedback.drawBanner(GS.ctx, GS.canvas.width, GS.canvas.height);
    }

    if (GS.rallyTimer > 0) {
      GS.ctx.fillStyle = 'rgba(240,192,64,0.85)';
      GS.ctx.font = '11px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText('RALLY ACTIVE', GS.canvas.width / 2, GS.canvas.height - 28);
    }

    if (isNightPhase()) {
      const secLeft = getNightSecondsRemaining();
      const m = Math.floor(secLeft / 60);
      const s = String(secLeft % 60).padStart(2, '0');
      GS.ctx.fillStyle = 'rgba(140,160,220,0.92)';
      GS.ctx.font = '13px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText('NIGHT: PREPARE DEFENSES', GS.canvas.width / 2, 52);
      GS.ctx.font = '10px Cinzel';
      GS.ctx.fillStyle = 'rgba(180,190,230,0.75)';
      GS.ctx.fillText(
        `Builders +35% speed · Auto dawn ${m}:${s} · D or BEGIN DAY to skip`,
        GS.canvas.width / 2,
        68
      );
    } else if (light < 0.75) {
      GS.ctx.fillStyle = 'rgba(200,180,120,0.8)';
      GS.ctx.font = '10px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText('DUSK — visibility fading', GS.canvas.width / 2, 52);
    }

    const bossUnit = GS.units.find(
      (u) => u.team === 'enemy' && u.hp > 0 && (u.isNamedBoss || u.type === 'war_chief')
    );
    if (bossUnit && bossUnit.isNamedBoss && svc('MonsterBosses')) {
      svc('MonsterBosses').drawBar(GS.ctx, bossUnit, GS.canvas.width, GS.updateTick);
    } else if (bossUnit) {
      const bossLabel =
        bossUnit.bossName ||
        EnemyDefs[bossUnit.type]?.bossName ||
        (bossUnit.type === 'war_chief' ? 'WAR CHIEF' : 'BOSS');
      const barW = Math.min(220, 140 + bossLabel.length * 4);
      GS.ctx.fillStyle = 'rgba(20,8,8,0.8)';
      GS.ctx.fillRect(GS.canvas.width / 2 - barW / 2, 76, barW, 16);
      GS.ctx.fillStyle = bossUnit.isNamedBoss ? '#a04020' : '#c04040';
      GS.ctx.fillRect(
        GS.canvas.width / 2 - barW / 2 + 2,
        79,
        (barW - 4) * (bossUnit.hp / bossUnit.maxHp),
        10
      );
      GS.ctx.fillStyle = bossUnit.isNamedBoss ? '#ffe8a0' : '#ffd0d0';
      GS.ctx.font = '9px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText(bossLabel.toUpperCase(), GS.canvas.width / 2, 74);
      if (bossUnit.bossTitle) {
        GS.ctx.font = '7px Cinzel';
        GS.ctx.fillStyle = 'rgba(255,180,180,0.85)';
        GS.ctx.fillText(bossUnit.bossTitle, GS.canvas.width / 2, 96);
      }
    }

    if (GS.boxSelect && GS.dragMoved) {
      const x = Math.min(GS.boxSelect.startSx, GS.boxSelect.endSx);
      const y = Math.min(GS.boxSelect.startSy, GS.boxSelect.endSy);
      const w = Math.abs(GS.boxSelect.endSx - GS.boxSelect.startSx);
      const h = Math.abs(GS.boxSelect.endSy - GS.boxSelect.startSy);
      GS.ctx.strokeStyle = 'rgba(100,200,255,0.85)';
      GS.ctx.fillStyle = 'rgba(100,200,255,0.12)';
      GS.ctx.lineWidth = 1.5;
      GS.ctx.fillRect(x, y, w, h);
      GS.ctx.strokeRect(x, y, w, h);
    }

    if (GS.creativeMode && GS.creativeTool) {
      const levelLabel =
        typeof LevelEditor !== 'undefined' ? LevelEditor.getToolOverlayLabel(getState()) : null;
      const label =
        levelLabel ||
        (GS.creativeTool === 'spawn_enemy'
          ? EnemyDefs[GS.creativeSpawnType]?.name || GS.creativeSpawnType
          : BuildDefs[GS.creativeSpawnType]?.name || GS.creativeSpawnType);
      const isLevel = !!levelLabel || GS.creativeTool.startsWith('level_');
      GS.ctx.strokeStyle = isLevel ? 'rgba(120,200,140,0.9)' : 'rgba(255,120,80,0.9)';
      GS.ctx.setLineDash([6, 4]);
      GS.ctx.lineWidth = 2;
      const cx = GS.canvas.width / 2;
      const cy = GS.canvas.height / 2;
      GS.ctx.beginPath();
      GS.ctx.moveTo(cx - 14, cy);
      GS.ctx.lineTo(cx + 14, cy);
      GS.ctx.moveTo(cx, cy - 14);
      GS.ctx.lineTo(cx, cy + 14);
      GS.ctx.stroke();
      GS.ctx.setLineDash([]);
      GS.ctx.fillStyle = isLevel ? 'rgba(120,200,140,0.92)' : 'rgba(255,120,80,0.92)';
      GS.ctx.font = '11px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText(isLevel ? label : `SPAWN: ${label}`, cx, cy + 28);
    }

    if (GS.paused) {
      const overlay =
        typeof PacingTools !== 'undefined'
          ? PacingTools.getPauseOverlay()
          : { title: 'PAUSED', subtitle: 'Space resume · Esc menu' };
      GS.ctx.fillStyle = 'rgba(0,0,0,0.52)';
      GS.ctx.fillRect(0, 0, GS.canvas.width, GS.canvas.height);
      GS.ctx.fillStyle = '#f0d890';
      GS.ctx.font = '22px Cinzel';
      GS.ctx.textAlign = 'center';
      GS.ctx.fillText(overlay.title || 'PAUSED', GS.canvas.width / 2, GS.canvas.height / 2 - 8);
      GS.ctx.font = '10px Cinzel';
      GS.ctx.fillStyle = 'rgba(200,180,140,0.75)';
      GS.ctx.fillText(
        overlay.subtitle || 'Space resume · Esc menu',
        GS.canvas.width / 2,
        GS.canvas.height / 2 + 14
      );
    }
    if (svc('Perf')) svc('Perf').end('draw');
  }

  return {
    bind,
    draw,
    updatePresentation,
  };
})();
