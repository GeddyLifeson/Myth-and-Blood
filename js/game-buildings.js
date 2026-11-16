/**
 * Placing, finishing, moving and destroying buildings; structure attacks and sieges.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameBuildings = (() => {
  const {
    DECO_GAP,
    assignBuildingToBuilder,
    calcEnemySiegeDamage,
    countBuilderProjects,
    countPlayerGuilds,
    countPlayerHamlets,
    countPlayerWalls,
    ensureBuildingHealth,
    ensureWallSlots,
    getBuildingRefund,
    getEnemyEconomyHpMult,
    getHamletFortressWallLayout,
    getSettlementTpBonus,
    inEnemyStructureAttackRange,
    isBuildingPathTarget,
    isEnemyEconomyUnderConstruction,
    isEnemySiegeAttacker,
    isSiegeableStructure,
    isUnitProducingBuilding,
    playSfx,
    posDistSq,
    releaseBuildingRecord,
    structureEdgeDistance,
    svc,
    unitDistance,
  } = GameCore;
  const GS = GameState;
  const { clampPos, invalidateObstacles, sanitizeTactical } = GameField;
  const { HUNT_LEASH_STRUCTURE_MULT, isLeashed, pointInHuntLeash } = GameMorale;
  const { findNearestFoeInRange, findPlayerGeneral } = GameCombat;
  const { damageBuilding, getEffectiveRange, inAttackRange, maxAttackRange } = GameTargeting;
  const { followPath, isBlocked, orderMove, pathToEnemyStructure, setUnitPath } = GameMovement;
  const { addHighlight } = GameArmy;
  let TP_SANITY_CAP,
    ach,
    checkCampaignEconomyVictory,
    checkPlayerElimination,
    clearSiegeLink,
    creativeInstantPlaceBuilding,
    deploySiege,
    endMedicalRetreat,
    findNearestPlayerWall,
    floatStatus,
    getAsymmetricMods,
    getDifficulty,
    getOutpostGarrisonSlot,
    getResearchOpts,
    isNightPhase,
    pickBuilderForJob,
    refreshUnitCounts,
    releaseFromGarrison,
    releaseFromKeep,
    releaseFromWallGarrison,
    showMessage,
    siegeCtx,
    syncInteractionState,
    warCampCtx;
  function bind(api) {
    ({
      TP_SANITY_CAP,
      ach,
      checkCampaignEconomyVictory,
      checkPlayerElimination,
      clearSiegeLink,
      creativeInstantPlaceBuilding,
      deploySiege,
      endMedicalRetreat,
      findNearestPlayerWall,
      floatStatus,
      getAsymmetricMods,
      getDifficulty,
      getOutpostGarrisonSlot,
      getResearchOpts,
      isNightPhase,
      pickBuilderForJob,
      refreshUnitCounts,
      releaseFromGarrison,
      releaseFromKeep,
      releaseFromWallGarrison,
      showMessage,
      siegeCtx,
      syncInteractionState,
      warCampCtx,
    } = api);
  }

  function scaleEnemyEconomyBuildingHp(b, waveNum) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return;
    const def = BuildDefs[b.type];
    if (!def?.isEnemySettlement) return;
    const targetWave = waveNum || GS.wave;
    const mult = getEnemyEconomyHpMult(targetWave);
    if (b._economyHpWave != null && b._economyHpWave >= targetWave) return;
    const baseHp = Math.max(1, def.hp ?? b.maxHp ?? 100);
    const ratio = b.maxHp > 0 ? Math.min(1, b.hp / b.maxHp) : 1;
    b.maxHp = Math.max(baseHp, Math.floor(baseHp * mult));
    b.hp = Math.max(1, Math.min(b.maxHp, Math.floor(b.maxHp * ratio)));
    b._economyHpWave = targetWave;
  }

  /** Legacy/engineer spawns may use player economy types with owner enemy — make them siegeable. */
  function normalizeEnemyEconomyBuilding(b) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return;
    if (b.type === 'trade_outpost' || b.type === 'quarry') {
      b.isEnemySettlement = true;
      b.isResourceGen = true;
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
      return;
    }
    if (b.type === 'enemy_trade_outpost' || b.type === 'enemy_quarry') {
      b.isEnemySettlement = true;
      b.isResourceGen = true;
      if (typeof getBuildingHitRadius === 'function') b.attackRadius = getBuildingHitRadius(b);
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
      return;
    }
    if (b.type === 'enemy_shadow_academy' || b.type === 'enemy_war_academy') {
      b.isEnemySettlement = true;
      b.isAcademy = true;
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
      if (!b.enemyFaction && svc('EnemyFactions')) {
        b.enemyFaction = svc('EnemyFactions').getBuildingFaction(b.type);
      }
    }
    if (b.isHamlet || b.isMerchantGuild) {
      ensureBuildingHealth(b);
      scaleEnemyEconomyBuildingHp(b, GS.wave);
    }
  }

  function normalizeEnemyEconomyBuildings() {
    for (const b of GS.buildings) normalizeEnemyEconomyBuilding(b);
  }

  function countEnemyEconomySites(type) {
    let n = 0;
    for (let i = 0; i < GS.buildings.length; i++) {
      const b = GS.buildings[i];
      if (b.owner === 'enemy' && b.hp > 0 && b.type === type) n++;
    }
    return n;
  }

  /** Hamlets, guilds, and academies — campaign win targets (not mere trade posts / quarries). */
  function isNorthernHold(b) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return false;
    normalizeEnemyEconomyBuilding(b);
    if (isEnemyEconomyUnderConstruction(b)) return false;
    return !!(b.isHamlet || b.isMerchantGuild || (b.isAcademy && b.owner === 'enemy'));
  }

  function countLiveNorthernHolds() {
    normalizeEnemyEconomyBuildings();
    let n = 0;
    for (const b of GS.buildings) {
      if (isNorthernHold(b)) n++;
    }
    return n;
  }

  function countLiveEnemyEconomyBuildings() {
    normalizeEnemyEconomyBuildings();
    let n = 0;
    for (const b of GS.buildings) {
      if (isAttackableEnemyStructure(b)) n++;
    }
    return n;
  }

  function noteEnemyEconomyPresence(b) {
    if (!b || b.owner !== 'enemy' || b.hp <= 0) return;
    normalizeEnemyEconomyBuilding(b);
    if (isAttackableEnemyStructure(b)) GS.enemyEconomyEverSpawned = true;
    if (isNorthernHold(b)) GS.northernHoldEverSpawned = true;
  }

  function getTpPerRound() {
    const waveScale = svc('GameDepth') ? svc('GameDepth').waveTpScale(GS.wave) : 1;
    const eased =
      typeof academyEase === 'function'
        ? academyEase(GS.wave)
        : Math.min(1, GS.wave / ACADEMY_ERA_WAVE);
    const post = typeof postAcademyEase === 'function' ? postAcademyEase(GS.wave) : 0;
    const bonus = Math.floor(eased * 30 * waveScale);
    const waveBonus = Math.min(5, Math.floor(eased * 5 * waveScale));
    const postBonus = Math.floor(post * 4 * waveScale);
    const diff = getDifficulty();
    const ecoGen = svc('ContentExpansion') ? svc('ContentExpansion').getEconomyTpBonus() : 0;
    const base =
      TP_PER_ROUND +
      bonus +
      waveBonus +
      postBonus +
      diff.tpPerRoundBonus +
      getSettlementTpBonus() +
      ecoGen;
    const cmdBonus = getAsymmetricMods().commanderTpRoundBonus || 0;
    return Math.floor(base * (diff.tpMult || 1)) + cmdBonus;
  }

  function isBuildSiteBlocked(wx, wy, bdef, excludeBuildingIds = null) {
    const margin = bdef?.radius ? Math.floor(bdef.radius * 0.55) : 12;
    const exclude = excludeBuildingIds
      ? new Set(Array.isArray(excludeBuildingIds) ? excludeBuildingIds : [excludeBuildingIds])
      : null;
    const snapOnHamlet = (bdef?.isFortressUpgrade || bdef?.isOutpostUpgrade) && exclude?.size;
    if (!snapOnHamlet && isBlocked(wx, wy, null, margin)) return true;
    for (const b of GS.buildings) {
      if (exclude?.has(b.id)) continue;
      const br = terrainBlockRadius(b);
      if (br <= 0) continue;
      const reach = (bdef?.radius || 20) + br + DECO_GAP * 2;
      if (posDistSq(wx, wy, b.x, b.y) < reach * reach) return true;
    }
    return false;
  }

  /** Snap fortress upgrade onto a nearby completed hamlet and exclude it from overlap checks. */
  function resolveFortressUpgradeSite(wx, wy, def) {
    if (!def?.isFortressUpgrade) return { x: wx, y: wy, hamlet: null };
    let best = null;
    let bestD = Infinity;
    const maxDist = def.requiresHamletNearby || 80;
    const maxDist2 = maxDist * maxDist;
    for (const b of GS.buildings) {
      if (!b.isHamlet || b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      const d2 = posDistSq(b.x, b.y, wx, wy);
      if (d2 < maxDist2 && d2 < bestD) {
        bestD = d2;
        best = b;
      }
    }
    if (!best) return null;
    return { x: best.x, y: best.y, hamlet: best };
  }

  /**
   * Outpost upgrades (Barracks or Granary) are placed on a finished Outpost that has not
   * been upgraded yet. Each Outpost takes one, once: that is the either/or.
   */
  function resolveOutpostUpgradeSite(wx, wy, def) {
    let best = null;
    let bestD = Infinity;
    const maxDist = def.requiresOutpostNearby || 44;
    for (const b of GS.buildings) {
      if (b.type !== 'outpost' || b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      if (b.upgrade || b.upgradePending) continue;
      const d2 = posDistSq(b.x, b.y, wx, wy);
      if (d2 < maxDist * maxDist && d2 < bestD) {
        bestD = d2;
        best = b;
      }
    }
    return best ? { x: best.x, y: best.y, outpost: best } : null;
  }

  /** The upgrade's scaffolding is done: turn its Outpost into a Barracks or a Granary. */
  function completeOutpostUpgrade(b) {
    const def = BuildDefs[b.type] || {};
    const info = typeof EconomyRules !== 'undefined' ? EconomyRules.OUTPOST_UPGRADES[b.type] : null;
    let host = null;
    let bestD = Infinity;
    for (const o of GS.buildings) {
      if (o.type !== 'outpost' || o.owner !== 'player' || !o.complete || o.hp <= 0) continue;
      if (o.upgrade) continue;
      const d2 = posDistSq(o.x, o.y, b.x, b.y);
      if (d2 < 60 * 60 && d2 < bestD) {
        bestD = d2;
        host = o;
      }
    }
    const idx = GS.buildings.indexOf(b);
    if (idx >= 0) {
      GS.buildings.splice(idx, 1);
      releaseBuildingRecord(b);
    }
    invalidateObstacles();
    if (!host || !info) {
      // The Outpost fell while the work was under way: the price comes back.
      GS.tactical += def.cost || 0;
      sanitizeTactical();
      showMessage('The Outpost was lost before its upgrade finished — TP refunded.', 240);
      return;
    }
    host.upgrade = info.id;
    host.upgradeName = info.label;
    host.upgradePending = false;
    host.maxHp = Math.floor(host.maxHp + (def.hpBonus || 0));
    host.hp = Math.min(host.maxHp, host.hp + (def.hpBonus || 0));
    svc('FloatingText')?.status?.(host.x, host.y - 24, info.label.toUpperCase(), '#ffe080');
    showMessage(`Outpost upgraded to ${info.label}. ${info.note}`, 320);
    refreshUnitCounts();
  }

  function findPlayerBuildingAt(wx, wy) {
    let best = null;
    let bestDist = Infinity;
    for (const b of GS.buildings) {
      if (b.owner !== 'player' || !b.complete || b.hp <= 0) continue;
      const dist = Math.hypot(b.x - wx, b.y - wy);
      const hitR = (b.radius || 20) + 8;
      if (dist <= hitR && dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    return best;
  }

  function findBuildingAt(wx, wy) {
    return findPlayerBuildingAt(wx, wy);
  }

  function detachBuildingFromBuilders(b) {
    for (const u of GS.units) {
      if (u.repairTarget?.id === b.id) u.repairTarget = null;
      if (u.combatType !== 'builder' && u.type !== 'builder') continue;
      const cur = u.building;
      if (cur?.id === b.id) {
        u.building = null;
      } else if (cur?.compound && cur.parts?.some((p) => p.id === b.id)) {
        cur.parts = cur.parts.filter((p) => p.id !== b.id);
        if (cur.parts.length === 0) u.building = null;
      } else if (cur?.pending && cur.type === b.type && Math.hypot(cur.x - b.x, cur.y - b.y) < 4) {
        u.building = null;
      }
      if (u.buildQueue?.length) {
        u.buildQueue = u.buildQueue.filter((item) => {
          if (item.id === b.id) return false;
          if (item.pending && item.type === b.type && Math.hypot(item.x - b.x, item.y - b.y) < 4)
            return false;
          return true;
        });
      }
    }
  }

  function cleanupBuildingOccupants(b) {
    if (b.garrisonUnitId) {
      const gu = GS.units.find((u) => u.id === b.garrisonUnitId);
      if (gu) releaseFromGarrison(gu);
    }
    if (b.generalUnitId) {
      const gen = GS.units.find((u) => u.id === b.generalUnitId);
      if (gen) releaseFromKeep(gen);
    }
    if (b.wallSlots) {
      for (const slot of b.wallSlots) {
        if (!slot.unitId) continue;
        const wu = GS.units.find((u) => u.id === slot.unitId);
        if (wu) releaseFromWallGarrison(wu);
        slot.unitId = null;
      }
    }
    if (b.siegeTowerId) {
      const tower = GS.units.find((u) => u.id === b.siegeTowerId);
      if (tower) clearSiegeLink(tower);
    }
    if (b.isMedical) {
      for (const u of GS.units) {
        if (u.retreatingToMed === b.id || u.atMedicalTent === b.id) {
          // Tent lost: back to duty (hunt or hold), not left standing with hunt off.
          endMedicalRetreat(u);
          u.fightToDeath = false;
        }
      }
    }
  }

  function removeBuildingRecord(b) {
    const idx = GS.buildings.indexOf(b);
    if (idx >= 0) {
      GS.buildings.splice(idx, 1);
      releaseBuildingRecord(b);
    }
  }

  function clearBuildingTargeting(b) {
    const bldKey = `bld:${b.id}`;
    for (const u of GS.units) {
      if (u.structureTargetId === b.id) u.structureTargetId = null;
      if (u.pathTargetId === bldKey) {
        u.pathTargetId = null;
        u.path = [];
        u.pathIndex = 0;
      }
    }
  }

  function isEnemyEconomyStructure(b) {
    if (!b || b.owner !== 'enemy') return false;
    normalizeEnemyEconomyBuilding(b);
    return !!(
      b.isEnemySettlement ||
      b.isHamlet ||
      b.isMerchantGuild ||
      b.isResourceGen ||
      b.type === 'enemy_hamlet' ||
      b.type === 'enemy_merchant_guild' ||
      b.type === 'enemy_trade_outpost' ||
      b.type === 'enemy_quarry'
    );
  }

  function finalizeBuildingDestroyed(b, opts = {}) {
    if (!b || b._destroyed) return false;
    const wasProducer = isUnitProducingBuilding(b);
    const wasEnemyEconomy = isEnemyEconomyStructure(b);
    // The record is wiped when it goes back to the pool, so keep what WarCamps needs.
    const wasWarCamp =
      typeof WarCamps !== 'undefined' && WarCamps.isCamp(b)
        ? { id: b.id, type: b.type, x: b.x, y: b.y }
        : null;
    if (
      b.owner === 'player' &&
      !opts.silent &&
      opts.attacker &&
      typeof isZombieTypeEnemy === 'function' &&
      isZombieTypeEnemy(opts.attacker.type)
    ) {
      ach('zombie_building_lost', {
        buildType: b.type,
        attackerType: opts.attacker.type,
        wave: GS.wave,
      });
    }
    b.hp = 0;
    b._destroyed = true;
    if (!opts.silent && typeof BuildingArt !== 'undefined') {
      BuildingArt.noteDestroyed(b, GS.updateTick);
    }
    cleanupBuildingOccupants(b);
    detachBuildingFromBuilders(b);
    clearBuildingTargeting(b);
    removeBuildingRecord(b);
    invalidateObstacles();
    if (wasWarCamp) {
      // WarCamps announces it (bounty, crate, what the next wave loses).
      if (!opts.packedUp) {
        GS.structuresRazedThisWave++;
        GS.runStructuresRazed++;
        WarCamps.onDestroyed(wasWarCamp, opts.attacker || null, warCampCtx);
      }
    } else if (opts.message) showMessage(opts.message);
    else if (!opts.silent) {
      const name = BuildDefs[b.type]?.name || 'Structure';
      const prefix = b.owner === 'enemy' ? 'Enemy ' : '';
      showMessage(`${prefix}${name} destroyed!`);
    }
    if (!opts.silent && opts.playDeath !== false) playSfx('death');
    if (wasProducer) checkPlayerElimination();
    if (wasEnemyEconomy) {
      GS.structuresRazedThisWave++;
      GS.runStructuresRazed++;
      if (!GS.creativeMode) {
        ach('enemy_structure_razed', {
          buildType: b.type,
          wave: GS.wave,
          runTotal: GS.runStructuresRazed,
        });
      }
      if (svc('FactionReputation')) {
        svc('FactionReputation').onEnemyStructureDestroyed(b, GS.wave, { hooks: { showMessage } });
      }
      if (svc('SettlementRaids')) {
        svc('SettlementRaids').onSettlementDestroyed(b, {
          units: GS.units,
          grantTp: (n) => {
            if (n > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
              GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + n);
              svc('FloatingText').status(b.x, b.y - 8, `+${n} TP`, '#60c0ff');
            }
          },
          grantScience: (n) => {
            if (n > 0 && svc('Research') && svc('Research').grantSciencePoints) {
              svc('Research').grantSciencePoints(n, { showMessage });
            }
          },
          hooks: {
            showMessage,
            addHighlight,
            floatingText: floatStatus,
          },
        });
      }
      if (svc('AsymmetricWarfare')) {
        const lvl = svc('AsymmetricWarfare').onHostStructureDestroyed();
        if (lvl?.delta < 0) {
          showMessage(
            `Host threat recedes — Level ${svc('AsymmetricWarfare').getHostThreatLevel()}.`,
            240
          );
        }
      }
      checkCampaignEconomyVictory();
    }
    return true;
  }

  function demolishBuilding(b) {
    if (!b || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const name = BuildDefs[b.type]?.name || 'Structure';
    const refund = getBuildingRefund(b);
    finalizeBuildingDestroyed(b, { silent: true });
    if (refund > 0 && !(GS.creativeMode && GS.creativeSettings.freeResources)) {
      GS.tactical = Math.min(TP_SANITY_CAP, GS.tactical + refund);
      svc('FloatingText').status(b.x, b.y - 12, `+${refund} TP`, '#80c0ff');
    }
    svc('Particles').dust(b.x, b.y);
    showMessage(`${name} demolished${refund > 0 ? ` — +${refund} TP refunded` : ''}.`);
    playSfx('click');
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function relocateBuilding(b, wx, wy) {
    if (!b || b.owner !== 'player' || !b.complete || b.hp <= 0) return false;
    const def = BuildDefs[b.type];
    if (!def) return false;
    const pos = clampPos(wx, wy);
    if (isBuildSiteBlocked(pos.x, pos.y, def, b.id)) {
      showMessage('Not enough space here!');
      return false;
    }
    b.x = pos.x;
    b.y = pos.y;
    if (b.type === 'outpost') {
      b.slotX = pos.x;
      b.slotY = pos.y - 14;
    } else if (b.isKeep) {
      b.slotX = pos.x + KEEP_GENERAL_SLOT_DX;
      b.slotY = pos.y + KEEP_GENERAL_SLOT_DY;
    }
    if (b.type === 'wall') {
      ensureWallSlots(b);
      for (let i = 0; i < (b.wallSlots?.length || 0); i++) {
        if (!b.wallSlots[i].unitId) continue;
        const wu = GS.units.find((u) => u.id === b.wallSlots[i].unitId);
        if (!wu) continue;
        wu.x = b.wallSlots[i].slotX;
        wu.y = b.wallSlots[i].slotY;
        wu.targetX = wu.x;
        wu.targetY = wu.y;
        wu.path = [];
        wu.pathIndex = 0;
      }
    }
    if (b.garrisonUnitId) {
      const gu = GS.units.find((u) => u.id === b.garrisonUnitId);
      if (gu) {
        const slot = getOutpostGarrisonSlot(b, gu);
        gu.x = slot.x;
        gu.y = slot.y;
        gu.targetX = slot.x;
        gu.targetY = slot.y;
        gu.path = [];
      }
    }
    if (b.generalUnitId) {
      const gen = GS.units.find((u) => u.id === b.generalUnitId);
      if (gen) {
        const slot = getKeepGeneralSlot(b);
        gen.x = slot.x;
        gen.y = slot.y;
        gen.targetX = slot.x;
        gen.targetY = slot.y;
        gen.path = [];
      }
    }
    invalidateObstacles();
    svc('Particles').dust(pos.x, pos.y);
    showMessage(`${def.name} relocated.`);
    playSfx('deploy');
    syncInteractionState();
    return true;
  }

  function spawnHamletFortressWalls(hamlet) {
    if (!hamlet?.isHamlet || hamlet.owner !== 'player' || hamlet.hp <= 0) return 0;
    if (hamlet.fortressWallsSpawned) return 0;
    const wallDef = BuildDefs.wall;
    if (!wallDef) return 0;

    const groupId = `hamlet_fort_${hamlet.id}`;
    let placed = 0;
    for (const slot of getHamletFortressWallLayout(hamlet)) {
      if (isBuildSiteBlocked(slot.x, slot.y, wallDef, hamlet.id)) continue;
      const overlapsHamlet =
        Math.hypot(slot.x - hamlet.x, slot.y - hamlet.y) < (hamlet.radius || 55) + 8;
      if (overlapsHamlet) continue;
      const b = createBuilding('wall', slot.x, slot.y, 'player', {
        facing: slot.facing,
        castleGroup: groupId,
      });
      b.complete = true;
      b.buildProgress = wallDef.buildTime || 1;
      b.hamletFortressRing = hamlet.id;
      GS.buildings.push(b);
      onBuildingComplete(b, { hamletFortress: true });
      placed++;
    }

    if (placed > 0) {
      hamlet.fortressWallsSpawned = true;
      invalidateObstacles();
      svc('Particles').dust(hamlet.x, hamlet.y);
      showMessage(
        `Palisade walls raised around ${BuildDefs.hamlet?.name || 'hamlet'} (${placed} segments).`,
        320
      );
    }
    return placed;
  }

  function spawnCastleCompound(cx, cy, builder) {
    const groupId = Math.random().toString(36).slice(2, 9);
    const parts = getCastleCompoundLayout(cx, cy).map((l) => {
      const b = createBuilding(l.type, l.x, l.y, 'player', {
        facing: l.facing,
        castleGroup: groupId,
      });
      GS.buildings.push(b);
      return b;
    });
    invalidateObstacles();
    builder.building = {
      compound: true,
      parts,
      x: cx,
      y: cy,
      buildTime: BuildDefs.castle.buildTime,
      buildProgress: 0,
    };
    showMessage('Erecting castle compound (4 walls, 4 outposts, Keep, med tent, mess hall)...');
    return true;
  }

  function finalizeBuild(type, wx, wy, buildOpts = {}) {
    if (GS.creativeMode && GS.creativeSettings.instantBuild) {
      return creativeInstantPlaceBuilding(type, wx, wy);
    }
    const def = BuildDefs[type];
    const buildCost = GS.creativeMode && GS.creativeSettings.freeResources ? 0 : (def?.cost ?? 0);
    if (!def) {
      showMessage(`Unknown building: ${type}`);
      return false;
    }
    if (GS.tactical < buildCost) {
      showMessage('Not enough TP!');
      return false;
    }
    if (def.requiresBuilders && countLiveBuilders(GS.units) < def.requiresBuilders) {
      showMessage(`Need ${def.requiresBuilders} live Builders on the field!`);
      return false;
    }
    if (svc('Research') && !svc('Research').isBuildUnlocked(type, getResearchOpts())) {
      showMessage(
        `Not open yet: ${svc('Research').getLockReason('build', type) || 'its charter has not arrived'}.`,
        280
      );
      return false;
    }
    if (def.isWweAcademy) {
      const championOk =
        (GS.creativeMode && GS.creativeSettings.unlockAll) ||
        svc('MetaProgress').isChampionsUnlocked() ||
        (svc('Research') && svc('Research').isFactionUnlocked('champions', getResearchOpts()));
      if (!championOk) {
        showMessage(
          'Research Arena Warfare Doctrine or swear the Quarryman’s Oath to unlock the Champions’ Hall!',
          300
        );
        return false;
      }
      const recHamlets = def.recommendedHamlets ?? 2;
      const recGuilds = def.recommendedGuilds ?? 1;
      if (countPlayerHamlets() < recHamlets) {
        showMessage(
          `Champions’ Hall tip: ${recHamlets}+ hamlets recommended (you have ${countPlayerHamlets()}).`,
          300
        );
      } else if (countPlayerGuilds() < recGuilds) {
        showMessage(
          `Champions’ Hall tip: ${recGuilds}+ merchant guilds recommended (you have ${countPlayerGuilds()}).`,
          300
        );
      }
    }
    if (
      def.isCrossoverBarracks &&
      !isVanillaAcademyType(type) &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll)
    ) {
      const factionOk =
        svc('MetaProgress').isCompanyUnlocked(def.crossoverFaction) ||
        (svc('Research') &&
          svc('Research').isFactionUnlocked(def.crossoverFaction, getResearchOpts()));
      if (!factionOk) {
        showMessage(
          `${def.name} is not open yet: its company charter arrives in a later wave.`,
          300
        );
        return false;
      }
      if (svc('FactionDepth')) {
        const chk = svc('FactionDepth').canBuildBarracks(type, GS.wave, GS.buildings, GS.units);
        if (!chk.ok) {
          showMessage(chk.msg, 300);
          return false;
        }
        if (chk.warn) showMessage(chk.warn, 280);
      }
    }
    if (
      def.isPerkMachine &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('Perks').perkMachinesUnlocked() &&
      !(svc('Research') && svc('Research').isBuildUnlocked(type, getResearchOpts()))
    ) {
      showMessage('Tonic stations open with the Tonic Stations Science charter at wave 55.');
      return false;
    }
    const isAcademyBuild = def?.isAcademy && !def?.isCrossoverBarracks && !def?.isWweAcademy;
    if (
      isAcademyBuild &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !canBuildAcademyType(type, GS.wave, GS.units)
    ) {
      showMessage(
        getAcademyBuildBlockReason(type, GS.wave, GS.units) ||
          'Cannot build this academy right now.'
      );
      return false;
    }
    let buildX = wx;
    let buildY = wy;
    let excludeBuildId = null;
    if (def.isFortressUpgrade) {
      const site = resolveFortressUpgradeSite(wx, wy, def);
      if (!site) {
        showMessage('Fortress upgrade must be placed on a completed settlement!');
        return false;
      }
      buildX = site.x;
      buildY = site.y;
      excludeBuildId = site.hamlet.id;
    }
    let upgradeHost = null;
    if (def.isOutpostUpgrade) {
      const site = resolveOutpostUpgradeSite(wx, wy, def);
      if (!site) {
        showMessage('Place this on a finished Outpost that has no upgrade yet (one per Outpost).');
        return false;
      }
      buildX = site.x;
      buildY = site.y;
      excludeBuildId = site.outpost.id;
      upgradeHost = site.outpost;
    }
    if (isBuildSiteBlocked(buildX, buildY, def, excludeBuildId)) {
      showMessage('Not enough space — settlements need wide ground!');
      return false;
    }

    // Prefer caller-supplied builder (pending march arrival); else nearest free crew.
    const builder =
      buildOpts.builder &&
      buildOpts.builder.team === 'player' &&
      buildOpts.builder.type === 'builder' &&
      buildOpts.builder.hp > 0
        ? buildOpts.builder
        : pickBuilderForJob(buildX, buildY);
    if (!builder) {
      showMessage('Deploy a Builder first (or free a builder under max projects)!');
      return false;
    }
    if (countBuilderProjects(builder) >= BUILDER_MAX_PROJECTS) {
      showMessage(`Builder at max projects (${BUILDER_MAX_PROJECTS})!`);
      return false;
    }

    if (def.settlementWarnBefore && GS.wave < def.settlementWarnBefore) {
      showMessage(
        `Warning: ${def.name} is huge and siegeable — strongly recommended after wave ${def.settlementWarnBefore}!`,
        340
      );
    }

    if (def.isResourceGen && svc('ContentExpansion')?.economySitesFull?.()) {
      // Checked before the TP is spent: a seventh site used to take the money and pay nothing.
      showMessage('All 6 income sites are in use — another one would pay nothing.', 260);
      return false;
    }
    if (upgradeHost) upgradeHost.upgradePending = true;
    if (!(GS.creativeMode && GS.creativeSettings.freeResources)) GS.tactical -= def.cost;
    // Pending-march completion must not wipe a different build tool the player just armed.
    if (!buildOpts.keepSelection) GS.selectedBuild = null;
    playSfx('buildPlace');

    if (type === 'castle') return spawnCastleCompound(buildX, buildY, builder);

    const wallFacing = type === 'wall' ? buildOpts.facing || GS.pendingWallFacing || 'north' : null;
    const b = createBuilding(
      type,
      buildX,
      buildY,
      'player',
      wallFacing ? { facing: wallFacing } : {}
    );
    GS.buildings.push(b);
    invalidateObstacles();

    if (def.waveBuildTime) {
      showMessage(
        `Founding ${def.name} — completes in ${def.waveBuildTime} waves (${countLiveBuilders(GS.units)} builders labor).`
      );
      syncInteractionState({ refreshCounts: true });
      return true;
    }

    assignBuildingToBuilder(builder, b);
    showMessage(`Erecting ${def.name}...`);
    syncInteractionState({ refreshCounts: true });
    return true;
  }

  function placeBuilding(wx, wy) {
    const type = GS.selectedBuild;
    if (!type) return false;
    const bdef = BuildDefs[type];
    if (!bdef) {
      showMessage(`Unknown building: ${type}`);
      return false;
    }
    const buildCost = GS.creativeMode && GS.creativeSettings.freeResources ? 0 : (bdef.cost ?? 0);
    if (GS.tactical < buildCost) {
      showMessage('Not enough TP!');
      return false;
    }
    if (GS.creativeMode && GS.creativeSettings.instantBuild) {
      return finalizeBuild(type, wx, wy);
    }
    if (bdef?.requiresBuilders && countLiveBuilders(GS.units) < bdef.requiresBuilders) {
      showMessage(`Need ${bdef.requiresBuilders} live Builders!`);
      return false;
    }
    const builder = pickBuilderForJob(wx, wy);
    if (!builder) {
      showMessage('Deploy a Builder first (or free a builder under max projects)!');
      return false;
    }
    const unlockAll = GS.creativeMode && GS.creativeSettings.unlockAll;
    const research = svc('Research');
    if (bdef?.isWweAcademy) {
      // Same rule finalizeBuild uses: a Research Lab unlock counts, not just the cheat.
      const pitOk =
        unlockAll ||
        svc('MetaProgress').isChampionsUnlocked() ||
        (research && research.isFactionUnlocked('champions', getResearchOpts()));
      if (!pitOk) {
        showMessage('Research Arena Warfare Doctrine or swear the Quarryman’s Oath first!');
        return false;
      }
      const recHamlets = bdef.recommendedHamlets ?? 2;
      const recGuilds = bdef.recommendedGuilds ?? 1;
      if (countPlayerHamlets() < recHamlets) {
        showMessage(
          `Champions’ Hall tip: ${recHamlets}+ hamlets recommended (you have ${countPlayerHamlets()}).`,
          300
        );
      } else if (countPlayerGuilds() < recGuilds) {
        showMessage(
          `Champions’ Hall tip: ${recGuilds}+ merchant guilds recommended (you have ${countPlayerGuilds()}).`,
          300
        );
      }
    }
    if (bdef?.isCrossoverBarracks && !isVanillaAcademyType(type)) {
      const factionOk =
        unlockAll ||
        svc('MetaProgress').isCompanyUnlocked(bdef.crossoverFaction) ||
        (research && research.isFactionUnlocked(bdef.crossoverFaction, getResearchOpts()));
      if (!factionOk) {
        showMessage(
          `${bdef.name} is not open yet: its company charter arrives in a later wave.`,
          300
        );
        return false;
      }
      if (svc('FactionDepth')) {
        const chk = svc('FactionDepth').canBuildBarracks(type, GS.wave, GS.buildings, GS.units);
        if (!chk.ok) {
          showMessage(chk.msg, 300);
          return false;
        }
        if (chk.warn) showMessage(chk.warn, 280);
      }
    }
    if (
      bdef?.isPerkMachine &&
      !unlockAll &&
      !svc('Perks').perkMachinesUnlocked() &&
      !(research && research.isBuildUnlocked(type, getResearchOpts()))
    ) {
      showMessage('Tonic stations open with the Tonic Stations Science charter at wave 55.');
      return false;
    }
    const isAcademyBuild = bdef?.isAcademy && !bdef?.isCrossoverBarracks && !bdef?.isWweAcademy;
    if (isAcademyBuild && !canBuildAcademyType(type, GS.wave, GS.units)) {
      showMessage(
        getAcademyBuildBlockReason(type, GS.wave, GS.units) ||
          'Cannot build this academy right now.'
      );
      return false;
    }
    if (bdef?.settlementWarnBefore && GS.wave < bdef.settlementWarnBefore) {
      showMessage(
        `Caution: build ${bdef.name} after wave ${bdef.settlementWarnBefore} unless you are confident!`,
        300
      );
    }
    const active = countBuilderProjects(builder);
    if (active >= BUILDER_MAX_PROJECTS) {
      showMessage(`Builder at max projects (${BUILDER_MAX_PROJECTS})!`);
      return false;
    }
    if (isBuildSiteBlocked(wx, wy, bdef)) {
      showMessage('Not enough space here!');
      return false;
    }
    if (Math.hypot(builder.x - wx, builder.y - wy) > builder.buildRange) {
      showMessage(`Builder marching to ${bdef.name} site...`);
      builder.manualOrder = false;
      orderMove(builder, wx, wy, false);
      const pending = { type, x: wx, y: wy, pending: true };
      if (type === 'wall') pending.facing = GS.pendingWallFacing;
      assignBuildingToBuilder(builder, pending);
      GS.selectedBuild = null;
      syncInteractionState({ refreshCounts: true });
      return true;
    }
    return finalizeBuild(type, wx, wy, {
      ...(type === 'wall' ? { facing: GS.pendingWallFacing } : {}),
      builder,
    });
  }

  function onBuildingComplete(b, opts = {}) {
    if (!opts.silent && !opts.skipSfx) playSfx('buildComplete');
    if (typeof FoundationalMedievalLayer !== 'undefined' && b?.type) {
      FoundationalMedievalLayer.recordBuild(b.type, GS.wave);
    }
    if (typeof MartialPathEvolution !== 'undefined' && b?.type) {
      MartialPathEvolution.recordBuild(b.type, GS.wave);
    }
    if (typeof ArcanePathEvolution !== 'undefined' && b?.type) {
      ArcanePathEvolution.recordBuild(b.type, GS.wave);
    }
    if (typeof TechPathEvolution !== 'undefined' && b?.type) {
      TechPathEvolution.recordBuild(b.type, GS.wave);
    }
    if (b.type === 'wall' && GS.firstWallWave === null) GS.firstWallWave = GS.wave;
    if (b.type === 'outpost') {
      b.slotX = b.x;
      b.slotY = b.y - 14;
    }
    if (b.isKeep) {
      const slot = getKeepGeneralSlot(b);
      b.slotX = slot.x;
      b.slotY = slot.y;
    }
    if (b.type === 'wall' && b.complete && b.owner === 'player') {
      ensureWallSlots(b);
    }
    if (b.isWweAcademy) {
      showMessage('Champions’ Hall complete! Click it to recruit Champions.', 320);
      svc('FloatingText').status(b.x, b.y - 20, 'GC', '#c04040');
    }
    if (b.isCrossoverBarracks && isCompanyHallType(b.type)) {
      if (svc('GameEvents')) {
        svc('GameEvents').emit(svc('GameEvents').GameEvent.BARRACKS_COMPLETE, { building: b });
      } else if (svc('FactionDepth')) {
        svc('FactionDepth').onBarracksComplete(b);
      } else {
        showMessage(`${BuildDefs[b.type]?.name} ready — click to recruit evolved operatives!`, 300);
        svc('FloatingText').status(b.x, b.y - 20, 'CROSSOVER', '#60a0c0');
      }
    }
    if (b.isPerkMachine) {
      showMessage(
        `${BuildDefs[b.type]?.name} installed — heroes collect matching perks at night.`,
        260
      );
    }
    if (b.isResearchLab) {
      syncInteractionState({ refreshCounts: true });
      showMessage('Research Lab online. Each doctrine choice now comes five waves sooner.', 320);
      svc('FloatingText').status(b.x, b.y - 20, 'SCIENCE', '#80c0ff');
    }
    if (svc('ContentExpansion')) svc('ContentExpansion').onBuildingComplete(b);
    if (b.isOutpostUpgrade || BuildDefs[b.type]?.isOutpostUpgrade) completeOutpostUpgrade(b);
    // A watchtower finished at night reports on the coming wave straight away.
    if (b.isWatchtower && isNightPhase()) SiegeLoop.refreshPreview?.(siegeCtx);
    ach('building_complete', {
      buildType: b.type,
      wallCount: countPlayerWalls(),
      compound: !!opts.compound,
    });
    if (!opts.skipInvalidate) invalidateObstacles();
  }

  function isAttackableEnemyStructure(b) {
    if (!b || b.owner !== 'enemy') return false;
    normalizeEnemyEconomyBuilding(b);
    if (b.hp <= 0) return false;
    return !!(
      b.isEnemySettlement ||
      b.isHamlet ||
      b.isMerchantGuild ||
      b.isResourceGen ||
      (b.isAcademy && b.owner === 'enemy')
    );
  }

  // War camps are not enemy economy (they must not count toward it), but they can be struck.
  function isTargetableEnemyStructure(b) {
    if (isAttackableEnemyStructure(b)) return true;
    return (
      !!b &&
      b.owner === 'enemy' &&
      b.hp > 0 &&
      typeof WarCamps !== 'undefined' &&
      WarCamps.isCamp(b)
    );
  }

  function getEnemyStructureSeekDist(unit) {
    const mapReach = Math.hypot(GS.worldW * 0.92, GS.worldH * 0.88);
    const rtsReach = isEnemyRtsEra(GS.wave) ? GS.worldH * 0.98 : 0;
    // On a raid he goes wherever the target is; otherwise the post's leash applies
    // (see findNearestAttackableEnemyBuilding).
    if (unit?.huntMode) return Math.max(720, mapReach, rtsReach);
    return Math.max(maxAttackRange(unit) + 200, 480);
  }

  function shouldPrioritizeEnemyStructure(unit, foe, bld) {
    if (!bld || !unit?.huntMode) return !!bld && !foe;
    if (!foe) return true;
    const foeDist = unitDistance(unit, foe);
    const bldDist = Math.hypot(bld.x - unit.x, bld.y - unit.y);
    if (isEnemyRtsEra(GS.wave)) {
      return bldDist <= foeDist * 0.92 || foeDist > 300;
    }
    return bldDist + 120 < foeDist;
  }

  function findNearestAttackableEnemyBuilding(unit, maxDist) {
    if (maxDist == null) maxDist = getEnemyStructureSeekDist(unit);
    let best = null;
    let bestScore = Infinity;
    for (const b of GS.buildings) {
      // Soldiers never walk off to a camp unordered, but one already in reach gets hit.
      if (
        !isAttackableEnemyStructure(b) &&
        !(isTargetableEnemyStructure(b) && inBuildingAttackRange(unit, b))
      )
        continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      if (d > maxDist) continue;
      if (
        isLeashed(unit) &&
        !pointInHuntLeash(unit, b.x, b.y, HUNT_LEASH_STRUCTURE_MULT, b.radius || 28) &&
        !inBuildingAttackRange(unit, b)
      )
        continue;
      let score = d;
      if (b.isHamlet) score -= 100;
      if (b.isMerchantGuild) score -= 80;
      if (b.type === 'enemy_trade_outpost' || b.type === 'trade_outpost') score -= 60;
      if (b.type === 'enemy_quarry' || b.type === 'quarry') score -= 45;
      if (b.type === 'enemy_shadow_academy' || b.type === 'enemy_war_academy') score -= 95;
      if (!b.complete) score -= 50;
      if (unit.type === 'sapper' || (unit.siegeMult || 1) >= 2) score -= 70;
      if (svc('FactionDepth') && svc('FactionDepth').isPlanetSiegeSpecialist?.(unit, GS.wave))
        score -= 85;
      if (unit.type === 'ballista') score -= 40;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  function getBuildingApproachPoint(unit, b) {
    const hitR =
      typeof getBuildingHitRadius === 'function' ? getBuildingHitRadius(b) : b.radius || 28;
    const dx = unit.x - b.x;
    const dy = unit.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return { x: unit.x, y: unit.y + hitR + 12 };
    const ranged = unit.combatType === 'ranged' || unit.projectile;
    const edgeStand = ranged
      ? getEffectiveRange(unit) * 0.86
      : (unit.meleeRange || unit.range || 28) + 8;
    const reach = Math.max(hitR + 8, hitR + edgeStand - (ranged ? 2 : 5));
    const scale = Math.min(1, reach / dist);
    return { x: b.x + dx * scale, y: b.y + dy * scale };
  }

  function inBuildingAttackRange(unit, b) {
    const edge = structureEdgeDistance(unit, b);
    if (unit.combatType === 'ranged' || unit.projectile) {
      return edge <= getEffectiveRange(unit) * 0.92 + 6;
    }
    const standoff = (unit.meleeRange || unit.range || 28) + 12;
    return edge <= standoff;
  }

  function calcBuildingDamage(unit, b) {
    const planetSiege =
      svc('FactionDepth') && svc('FactionDepth').isPlanetSiegeSpecialist?.(unit, GS.wave);
    const op = planetSiege && svc('FactionDepth').getPlanetWarfareOp?.(unit.wweAbility);
    const siege = unit.type === 'sapper' || (unit.siegeMult || 1) >= 2 || planetSiege;
    let dmg = siege
      ? Math.floor(unit.damage * (unit.siegeMult || op?.siegeMult || 2.5))
      : Math.max(8, Math.floor(unit.damage * 0.42));
    if (unit.combatType === 'ranged' || unit.projectile) dmg = Math.floor(dmg * 0.88);
    if (unit.type === 'ballista') dmg = Math.floor(dmg * 1.35);
    if (b.isHamlet) dmg = Math.floor(dmg * 1.08);
    if (b.isMerchantGuild) dmg = Math.floor(dmg * 1.05);
    if (svc('FactionDepth') && svc('FactionDepth').modifyBuildingDamage) {
      dmg = svc('FactionDepth').modifyBuildingDamage(unit, b, dmg, GS.wave);
    }
    if (svc('StrategyCounterplay')) {
      dmg = svc('StrategyCounterplay').modifyBuildingDamage(unit, b, dmg);
    }
    if (b.owner === 'enemy' && GS.wave < 80) {
      const soften = 0.48 + Math.min(0.42, GS.wave / 115);
      dmg = Math.max(4, Math.floor(dmg * soften));
    }
    return Math.max(4, dmg + Math.floor(Math.random() * 4));
  }

  function getBuildingPursuitTarget(unit) {
    if (unit.raidTargetId) {
      const raidBld = GS.buildings.find((x) => x.id === unit.raidTargetId);
      if (isTargetableEnemyStructure(raidBld)) return raidBld;
      unit.raidTargetId = null;
      unit.raidMissionId = null;
    }
    const raw =
      unit.structureTargetId ||
      (isBuildingPathTarget(unit.pathTargetId) ? unit.pathTargetId.slice(4) : null);
    if (!raw) return null;
    const b = GS.buildings.find((x) => x.id === raw);
    return isTargetableEnemyStructure(b) ? b : null;
  }

  function updatePlayerStructureAttack(unit) {
    if (unit.team !== 'player' || unit.hp <= 0) return;
    if (
      unit.combatType === 'builder' ||
      unit.combatType === 'courier' ||
      unit.combatType === 'healer'
    )
      return;
    if (unit.garrisoned || unit.wallGarrisoned || unit.stationedKeep) return;
    if (unit.retreatingToMed || unit.atMedicalTent || unit.pinned || unit.manualOrder) return;
    if (unit.attackAnimTimer > 0) return;

    if (findNearestFoeInRange(unit)) {
      if (!unit.raidTargetId) unit.structureTargetId = null;
      return;
    }

    let target = getBuildingPursuitTarget(unit);
    const seekDist = getEnemyStructureSeekDist(unit);
    if (!target) target = findNearestAttackableEnemyBuilding(unit, seekDist);
    if (!target) return;
    if (!inBuildingAttackRange(unit, target)) {
      if (!unit.manualOrder && (unit.huntMode || unit.structureTargetId || unit.raidTargetId)) {
        pathToEnemyStructure(unit, target);
      }
      return;
    }

    unit.structureTargetId = target.id;
    unit.path = [];
    unit.pathIndex = 0;
    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;

    const siege = unit.type === 'sapper' || (unit.siegeMult || 1) >= 2;
    unit.actionTimer = siege ? 42 : unit.combatType === 'ranged' ? 52 : 58;
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    unit.rotation = Math.round((Math.atan2(target.y - unit.y, target.x - unit.x) * 180) / Math.PI);
    const dmg = calcBuildingDamage(unit, target);
    damageBuilding(target, dmg, unit);
    if (svc('FactionDepth') && svc('FactionDepth').onPlanetStructureStrike) {
      svc('FactionDepth').onPlanetStructureStrike(unit, target, dmg, GS.wave);
    }
    if (unit.type === 'sapper') svc('FloatingText').status(target.x, target.y, 'SIEGE!', '#ff8040');
    else if (FactionDepth?.isPlanetSiegeSpecialist?.(unit, GS.wave)) {
      svc('FloatingText').status(target.x, target.y, 'RAZE', '#c0a040');
    }
    // damageBuilding already plays gateHit/impact
  }

  function updateEnemySiege(unit) {
    if (unit.hp <= 0 || unit.pinned || unit.attackAnimTimer > 0) return;
    if (!isEnemySiegeAttacker(unit)) return;

    let best = null,
      bestD = Infinity;
    for (const b of GS.buildings) {
      if (!isSiegeableStructure(b)) continue;
      if (!inEnemyStructureAttackRange(unit, b, { siege: true })) continue;
      let score = structureEdgeDistance(unit, b);
      if (b.isHamlet) score -= 40;
      if (b.isMerchantGuild) score -= 25;
      if (score < bestD) {
        bestD = score;
        best = b;
      }
    }
    if (!best) return;

    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;
    const isTower = unit.type === 'siege_tower' && unit.siegeDeployed;
    const isMonster =
      unit.type === 'iron_colossus' || unit.type === 'boss_karg' || unit.type === 'boss_volk';
    unit.actionTimer = isTower ? 70 : isMonster ? 62 : 55;
    unit.animState = 'attack';
    unit.attackAnimTimer = 14;
    const dmg = calcEnemySiegeDamage(unit, best);
    damageBuilding(best, dmg, unit);
    // damageBuilding already plays gateHit/impact
  }

  function findNearestSiegeablePlayerStructure(unit, maxDist = 520) {
    let best = null;
    let bestD = Infinity;
    for (const b of GS.buildings) {
      if (!isSiegeableStructure(b)) continue;
      const d = Math.hypot(b.x - unit.x, b.y - unit.y);
      if (d > maxDist) continue;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  function updateEnemyWallAttack(unit) {
    if (unit.hp <= 0 || unit.pinned || unit.attackAnimTimer > 0) return;
    if (isEnemySiegeAttacker(unit)) return;
    if (unit.combatType === 'healer' || unit.combatType === 'builder') return;

    const general = findPlayerGeneral();
    if (general && inAttackRange(unit, general)) return;
    if (findNearestFoeInRange(unit)) return;

    let best = null,
      bestD = Infinity;
    for (const b of GS.buildings) {
      if (!isSiegeableStructure(b)) continue;
      if (!inEnemyStructureAttackRange(unit, b)) continue;
      const score = structureEdgeDistance(unit, b);
      if (score < bestD) {
        bestD = score;
        best = b;
      }
    }
    if (!best) {
      const seek = findNearestSiegeablePlayerStructure(unit);
      if (seek && !unit.path?.length && unit.pathTargetId !== `bld:${seek.id}`) {
        setUnitPath(unit, seek.x, seek.y, null, { buildingId: seek.id, force: true });
        unit.pathTargetId = `bld:${seek.id}`;
      }
      return;
    }

    unit.actionTimer = (unit.actionTimer || 0) - 1;
    if (unit.actionTimer > 0) return;
    unit.actionTimer = unit.type === 'troll' ? 50 : 65;
    unit.animState = 'attack';
    unit.attackAnimTimer = 12;
    let dmg = unit.type === 'troll' ? 22 : unit.type === 'berserker' ? 18 : 12;
    if (best.isHamlet) dmg = Math.floor(dmg * 1.4);
    if (best.isMerchantGuild) dmg = Math.floor(dmg * 1.2);
    damageBuilding(best, dmg, unit);
    playSfx('swordHit');
  }

  function updateSiegeTower(unit) {
    if (unit.type !== 'siege_tower' || unit.hp <= 0) return false;

    if (unit.siegeDeployed) {
      unit.animState = 'idle';
      const wall = GS.buildings.find((b) => b.id === unit.linkedWallId && b.hp > 0);
      if (!wall) clearSiegeLink(unit);
      return true;
    }

    const wall = findNearestPlayerWall(unit);
    if (!wall) return false;

    const dist = Math.hypot(wall.x - unit.x, wall.y - unit.y);
    if (dist <= 48) {
      deploySiege(unit, wall);
      return true;
    }

    unit.pathRecalc = (unit.pathRecalc || 0) - 1;
    if (unit.pathRecalc <= 0) {
      unit.pathRecalc = 35;
      setUnitPath(unit, wall.x, wall.y - 18);
    }
    if (!unit.pinned && unit.attackAnimTimer <= 0) followPath(unit);
    return true;
  }

  return {
    bind,
    calcBuildingDamage,
    countEnemyEconomySites,
    countLiveEnemyEconomyBuildings,
    countLiveNorthernHolds,
    demolishBuilding,
    finalizeBuild,
    finalizeBuildingDestroyed,
    findBuildingAt,
    findNearestAttackableEnemyBuilding,
    findPlayerBuildingAt,
    getBuildingApproachPoint,
    getBuildingPursuitTarget,
    getEnemyStructureSeekDist,
    getTpPerRound,
    inBuildingAttackRange,
    isAttackableEnemyStructure,
    isBuildSiteBlocked,
    isNorthernHold,
    normalizeEnemyEconomyBuilding,
    normalizeEnemyEconomyBuildings,
    noteEnemyEconomyPresence,
    onBuildingComplete,
    placeBuilding,
    relocateBuilding,
    resolveFortressUpgradeSite,
    resolveOutpostUpgradeSite,
    shouldPrioritizeEnemyStructure,
    spawnHamletFortressWalls,
    updateEnemySiege,
    updateEnemyWallAttack,
    updatePlayerStructureAttack,
    updateSiegeTower,
  };
})();
