/**
 * Creative mode and the level editor API.
 * Lifted out of js/game.js with the code unchanged. Loaded before game.js, which binds the
 * names listed under bind() once every module is in.
 */
const GameCreative = (() => {
  const {
    applyCreativeUnitStats,
    countActiveEnemies,
    ensureBuildingHealth,
    getHeroesOnField,
    playSfx,
    posDistSq,
    releaseBuildingRecord,
    svc,
  } = GameCore;
  const GS = GameState;
  const {
    clampPos,
    ensureInitialBattlefield,
    invalidateObstacles,
    releaseAllUnits,
    sanitizeTactical,
    unitById,
  } = GameField;
  const { findPlayerGeneral } = GameCombat;
  const {
    applyPlayerStatMods,
    canDeployUnitType,
    notifyVetStarEvent,
    recordFootmanCommandElevation,
    spawnUnit,
  } = GameArmy;
  const {
    finalizeBuildingDestroyed,
    isBuildSiteBlocked,
    normalizeEnemyEconomyBuilding,
    noteEnemyEconomyPresence,
    onBuildingComplete,
    resolveFortressUpgradeSite,
    resolveOutpostUpgradeSite,
  } = GameBuildings;
  const { releaseFromGarrison, releaseFromWallGarrison } = GameGarrison;
  const { spawnPosForSide, startNextWave } = GameWaves;
  const { beginDayPhase, enterNightPhase, isDayPhase, isNightPhase } = GameDayNight;
  const { getResearchOpts } = GameCommands;
  let CREATIVE_DEFAULTS,
    applyWorldSize,
    clearSelection,
    getDifficulty,
    invalidateStateCache,
    showMessage,
    start,
    syncInteractionState;
  function bind(api) {
    ({
      CREATIVE_DEFAULTS,
      applyWorldSize,
      clearSelection,
      getDifficulty,
      invalidateStateCache,
      showMessage,
      start,
      syncInteractionState,
    } = api);
  }

  function isCreativeMode() {
    return GS.creativeMode;
  }

  function setCreativeSetting(key, value) {
    if (!(key in GS.creativeSettings)) return;
    GS.creativeSettings[key] = typeof GS.creativeSettings[key] === 'boolean' ? !!value : value;
    GS.creativeSettingsSigTick = -1;
    if (key === 'useCampaignRules' && value) {
      GS.creativeSettings.freeResources = false;
      GS.creativeSettings.noGameOver = false;
      GS.creativeSettings.noAutoCycle = false;
      GS.creativeSettings.instantBuild = false;
      GS.creativeSettings.enableAchievements = false;
    }
  }

  function applyCampaignRulesPreset(on) {
    setCreativeSetting('useCampaignRules', !!on);
    if (on) showMessage('Campaign rules ON — TP, elimination rules, and auto-cycle apply.', 260);
    else showMessage('Sandbox rules restored.', 160);
  }

  function creativeSetTool(tool, spawnType = null) {
    GS.creativeTool = tool;
    GS.creativeSpawnType = spawnType;
    if (tool && !String(tool).startsWith('level_') && typeof LevelEditor !== 'undefined') {
      LevelEditor.clearToolSelection();
    }
    if (tool) clearSelection();
    const label =
      tool === 'spawn_enemy'
        ? EnemyDefs[spawnType]?.name
        : tool === 'spawn_enemy_building'
          ? BuildDefs[spawnType]?.name
          : tool === 'spawn_player'
            ? getPlayerUnitDef(spawnType)?.name
            : tool === 'spawn_player_building'
              ? BuildDefs[spawnType]?.name
              : tool === 'spawn_squad'
                ? `Squad (${spawnType})`
                : tool?.startsWith('level_')
                  ? (typeof LevelEditor !== 'undefined'
                      ? LevelEditor.TOOLS.find((t) => t.id === tool)?.label
                      : null) || 'Level tool'
                  : null;
    if (label) showMessage(`Creative tool armed: ${label} — click the map.`, 200);
    else if (!tool) showMessage('Creative tool cleared.', 120);
  }

  function creativeFinishBuilding(b) {
    const def = BuildDefs[b.type];
    b.buildProgress = def?.buildTime || 0;
    b.complete = true;
    if (def?.waveBuildTime) {
      b.waveBuildRequired = def.waveBuildTime;
      b.waveBuildProgress = def.waveBuildTime;
    }
    onBuildingComplete(b);
  }

  function creativeInstantPlaceBuilding(type, wx, wy) {
    const def = BuildDefs[type];
    if (!def) return false;
    if (!GS.creativeSettings.freeResources && GS.tactical < def.cost) return false;
    if (
      def.isWweAcademy &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('MetaProgress').isChampionsUnlocked()
    )
      return false;
    if (
      def.isCrossoverBarracks &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('MetaProgress').isCompanyUnlocked(def.crossoverFaction)
    )
      return false;
    if (
      def.isPerkMachine &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('Perks').perkMachinesUnlocked()
    )
      return false;
    if (
      svc('Research') &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !svc('Research').isBuildUnlocked(type, getResearchOpts())
    )
      return false;
    if (
      isVanillaAcademyType(type) &&
      !(GS.creativeMode && GS.creativeSettings.unlockAll) &&
      !canBuildAcademyType(type, GS.wave, GS.units)
    )
      return false;
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
      // Creative / tests: nudge off trees and rocks instead of hard-failing the spawn.
      let found = false;
      const radii = [18, 32, 48, 70, 100];
      outer: for (const r of radii) {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const px = buildX + Math.cos(ang) * r;
          const py = buildY + Math.sin(ang) * r;
          const c = clampPos(px, py);
          if (!isBuildSiteBlocked(c.x, c.y, def, excludeBuildId)) {
            buildX = c.x;
            buildY = c.y;
            found = true;
            break outer;
          }
        }
      }
      if (!found) {
        showMessage('Not enough space here!');
        return false;
      }
    }
    if (!GS.creativeSettings.freeResources) GS.tactical -= def.cost;
    GS.selectedBuild = null;
    playSfx('buildPlace');
    if (type === 'castle') {
      const groupId = Math.random().toString(36).slice(2, 9);
      getCastleCompoundLayout(wx, wy).forEach((l) => {
        const b = createBuilding(l.type, l.x, l.y, 'player', {
          facing: l.facing,
          castleGroup: groupId,
        });
        creativeFinishBuilding(b);
        GS.buildings.push(b);
      });
      invalidateObstacles();
      syncInteractionState({ refreshCounts: true });
      showMessage('Castle compound placed (instant).');
      return true;
    }
    const wallOpts = type === 'wall' ? { facing: GS.pendingWallFacing } : {};
    const b = createBuilding(type, buildX, buildY, 'player', wallOpts);
    creativeFinishBuilding(b);
    GS.buildings.push(b);
    invalidateObstacles();
    syncInteractionState({ refreshCounts: true });
    showMessage(`${def.name} placed (instant).`);
    return true;
  }

  function creativeSpawnEnemyAt(type, x, y, opts = {}) {
    const u = spawnUnit(type, x, y, 'enemy');
    if (!u) return false;
    u.rotation = opts.rotation ?? 90;
    u.huntMode = true;
    if (svc('GameDepth')) {
      const cfg = GS.currentWaveConfig || getWaveConfig(GS.wave);
      svc('GameDepth').applyEnemySpawnScaling(u, GS.wave, {
        cfg,
        diff: getDifficulty(),
        waveModifiers: GS.waveModifiers,
        hordeWave: GS.currentHordeWave,
        colonyThreat: GS.colonyThreatMods,
        namedBossScale: u.isNamedBoss ? GS.namedBossWave?.scale : null,
      });
    }
    if (opts.hpMult) {
      u.maxHp = Math.floor(u.maxHp * opts.hpMult);
      u.hp = u.maxHp;
    }
    if (opts.dmgMult) u.damage = Math.floor(u.damage * opts.dmgMult);
    if (opts.elite) {
      u.maxHp = Math.floor(u.maxHp * 1.35);
      u.hp = u.maxHp;
      u.damage = Math.floor(u.damage * 1.2);
    }
    GS.units.push(u);
    svc('Particles').dust(x, y);
    playSfx('deploy');
    svc('CreativeTools') && svc('CreativeTools').bumpStat('spawns');
    svc('CreativeTools') && svc('CreativeTools').recordFrame(`spawn:${type}`);
    return true;
  }

  function creativeSpawnPlayerAt(type, x, y) {
    if (!canDeployUnitType(type) && !GS.creativeSettings.academyDeploy) {
      showMessage('Academy deploy off — cannot spawn troop type.');
      return false;
    }
    if (
      typeof isCompanyHeroUnit === 'function' &&
      isCompanyHeroUnit(type) &&
      getHeroesOnField().includes(type)
    ) {
      const name = typeof getHeroDef === 'function' ? getHeroDef(type)?.name : type;
      showMessage(`${name || type} is already on the field!`);
      return false;
    }
    const u = spawnUnit(type, x, y, 'player');
    if (!u) return false;
    if (typeof ensureHealerStats === 'function') ensureHealerStats(u);
    applyPlayerStatMods(u);
    if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
    if (svc('FactionDepth')) svc('FactionDepth').applyToUnit(u, GS.units);
    u.targetY = GS.rallyY;
    u.huntMode = GS.globalHunt && u.canHunt;
    if (u.canHunt && !u.huntMode) {
      u.manualOrder = true;
      u.holdX = u.x;
      u.holdY = u.y;
      u.targetX = u.x;
      u.targetY = u.y;
      u.pathTargetId = 'hold';
    }
    GS.units.push(u);
    svc('Particles').dust(x, y);
    playSfx('deploy');
    svc('CreativeTools') && svc('CreativeTools').bumpStat('spawns');
    return true;
  }

  function creativeSpawnSquadAt(squadKey, x, y) {
    const squads = {
      line: ['footman', 'footman', 'footman', 'archer', 'archer'],
      cavalry: ['cavalry', 'cavalry', 'knight'],
      siege: ['sapper', 'ballista', 'footman', 'footman'],
      casters: ['mage', 'mage', 'healer', 'bard'],
      elites: ['knight', 'knight', 'pikeman', 'scout'],
    };
    const list = squads[squadKey] || squads.line;
    list.forEach((t, i) =>
      creativeSpawnPlayerAt(t, x + (i % 3) * 20 - 20, y + Math.floor(i / 3) * 22)
    );
    return true;
  }

  function creativeSpawnPlayerBuildingAt(type, x, y) {
    return creativeInstantPlaceBuilding(type, x, y);
  }

  function randomMapEdgePos() {
    const side = ['north', 'east', 'west', 'south'][Math.floor(Math.random() * 4)];
    const p = spawnPosForSide(side);
    return { x: p.x + (Math.random() - 0.5) * 40, y: p.y + (Math.random() - 0.5) * 20 };
  }

  function getWorldCenter() {
    return { x: GS.worldW / 2, y: (GS.deployY + GS.rallyY) / 2 };
  }

  function creativeSetTp(n) {
    GS.tactical = Math.max(0, Math.floor(n));
    sanitizeTactical();
    invalidateStateCache();
  }

  function creativeSpawnEnemyBuildingAt(type, x, y) {
    const def = BuildDefs[type];
    if (!def || def.owner === 'player' || !def.isEnemySettlement) return false;
    if (isBuildSiteBlocked(x, y, def)) {
      showMessage('Blocked — need open ground.');
      return false;
    }
    const b = createBuilding(type, x, y, 'enemy');
    creativeFinishBuilding(b);
    GS.buildings.push(b);
    noteEnemyEconomyPresence(b);
    invalidateObstacles();
    svc('Particles').dust(x, y);
    showMessage(`${def.name} placed.`);
    return true;
  }

  function creativeSetWave(n, opts = {}) {
    GS.wave = Math.max(0, Math.floor(n));
    applyWorldSize(GS.wave);
    if (!opts.skipTerrain) ensureInitialBattlefield(true);
    GS.spawnQueue = [];
    GS.spawnSectors = [];
    GS.spawnTimer = 0;
    GS.waveProgress = 0;
    showMessage(`Creative: wave set to ${GS.wave}.`, 180);
  }

  function creativeAddTp(amount) {
    GS.tactical += amount;
    showMessage(`Creative: +${amount} TP`, 120);
  }

  function creativeForceNight() {
    if (!isNightPhase()) enterNightPhase();
    else showMessage('Already night.', 100);
  }

  function creativeForceDay() {
    beginDayPhase(true);
  }

  function creativeStartWave() {
    if (isDayPhase() && (GS.spawnQueue.length > 0 || countActiveEnemies() > 0)) {
      showMessage('Clear current wave first or use Clear Wave Spawns.', 200);
      return;
    }
    if (isNightPhase()) beginDayPhase(true);
    else startNextWave();
  }

  function setCustomWave(spec) {
    if (!spec) {
      GS.creativeCustomWave = null;
      return;
    }
    const text = spec.text || spec;
    const queue = svc('CreativeTools') ? svc('CreativeTools').parseWaveComposer(text) : [];
    if (!queue.length) {
      showMessage('Wave composer: no valid enemies parsed.');
      return false;
    }
    GS.creativeCustomWave = {
      queue,
      interval: Math.max(12, parseInt(spec.interval, 10) || 50),
      hpMult: parseFloat(spec.hpMult) || 1,
      dmgMult: parseFloat(spec.dmgMult) || 1,
      sector: ['left', 'centre', 'right'].includes(spec.sector) ? spec.sector : null,
      text: typeof text === 'string' ? text : CreativeTools?.formatWaveComposer(queue),
    };
    showMessage(`Custom wave queued: ${queue.length} enemies.`, 220);
    return true;
  }

  function getCustomWave() {
    return GS.creativeCustomWave ? { ...GS.creativeCustomWave } : null;
  }

  function creativeLaunchCustomWave() {
    if (!GS.creativeCustomWave?.queue?.length) {
      showMessage('Build a custom wave in the composer first.');
      return false;
    }
    if (isDayPhase() && (GS.spawnQueue.length > 0 || countActiveEnemies() > 0)) {
      creativeClearWaveSpawns();
    }
    GS.spawnQueue = [...GS.creativeCustomWave.queue];
    // A chosen sector pins every spawn there; otherwise the wave plan spreads them.
    const sector = GS.creativeCustomWave.sector;
    GS.spawnSectors = sector ? GS.spawnQueue.map(() => sector) : [];
    GS.waveEnemyTotal = GS.spawnQueue.length;
    GS.waveProgress = 0;
    GS.spawnTimer = 8;
    GS.currentWaveConfig = {
      count: GS.spawnQueue.length,
      pool: [...new Set(GS.spawnQueue)],
      interval: GS.creativeCustomWave.interval,
      boss: GS.spawnQueue.includes('war_chief'),
      hpScale: GS.creativeCustomWave.hpMult,
      dmgScale: GS.creativeCustomWave.dmgMult,
    };
    GS.nextWaveIntel = `Custom: ${GS.creativeCustomWave.text || GS.spawnQueue.length + ' foes'}`;
    if (isNightPhase()) {
      GS.timeOfDay = 'day';
      GS.nightTimer = 0;
    }
    GS.spawnTimer = 8;
    svc('CreativeTools') && svc('CreativeTools').bumpStat('wavesLaunched');
    svc('CreativeTools') && svc('CreativeTools').recordFrame('custom_wave');
    showMessage(`Launching custom wave (${GS.spawnQueue.length})…`, 240);
    return true;
  }

  function getUnitsSnapshot() {
    return GS.units
      .filter((u) => u.hp > 0)
      .map((u) => ({
        id: u.id,
        type: u.type,
        team: u.team,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHp: u.maxHp,
        damage: u.damage,
        accuracy: u.accuracy,
        speed: u.speed,
        range: u.range,
        morale: u.morale,
        maxMorale: u.maxMorale,
        vetBronze: u.vetBronze,
        vetSilver: u.vetSilver,
        vetGold: u.vetGold,
        fleeing: !!u.fleeing,
        pinned: !!u.pinned,
        lineBreaker: !!u.lineBreaker,
        pathLen: u.path?.length || 0,
        pathPending: !!u.pathPending,
        spawnSide: u.spawnSide,
      }));
  }

  function getBuildingsSnapshot() {
    return GS.buildings
      .filter((b) => b.hp > 0)
      .map((b) => ({
        id: b.id,
        type: b.type,
        owner: b.owner,
        x: b.x,
        y: b.y,
        hp: b.hp,
        maxHp: b.maxHp,
        complete: b.complete,
        facing: b.facing,
        radius: b.radius,
        // Flags needed by Research / academy / economy UIs that read snapshots.
        isResearchLab: !!b.isResearchLab,
        isAcademy: !!b.isAcademy,
        isHamlet: !!b.isHamlet,
        isSettlement: !!b.isSettlement,
        isResourceGen: !!b.isResourceGen,
        academyUnit: b.academyUnit || null,
      }));
  }

  function getDecorationsSnapshot() {
    return GS.decorations
      .filter((d) => d.hp > 0)
      .map((d) => ({
        type: d.type,
        x: d.x,
        y: d.y,
        size: d.size,
        hp: d.hp,
        blocksMove: d.blocksMove,
        blocksLOS: d.blocksLOS,
        cover: d.cover,
        radius: d.radius,
      }));
  }

  function getLevelSnapshot(meta = {}) {
    return {
      v: 1,
      type: 'level',
      id: meta.id || null,
      name: meta.name || 'Untitled Level',
      description: meta.description || '',
      author: meta.author || '',
      wave: GS.wave,
      worldW: GS.worldW,
      worldH: GS.worldH,
      timeOfDay: GS.timeOfDay,
      tactical: GS.tactical,
      settings: { ...GS.creativeSettings },
      customWave: getCustomWave(),
      units: getUnitsSnapshot(),
      buildings: getBuildingsSnapshot(),
      decorations: getDecorationsSnapshot(),
      createdAt: meta.createdAt || null,
      modifiedAt: new Date().toISOString(),
    };
  }

  function clearCreativeEntities(opts = {}) {
    releaseAllUnits();
    GS.spawnQueue = [];
    if (opts.buildings !== false) {
      for (let i = GS.buildings.length - 1; i >= 0; i--) {
        const b = GS.buildings[i];
        if (b.isCastle) continue;
        finalizeBuildingDestroyed(b, { silent: true, playDeath: false });
      }
    }
    if (opts.decorations !== false) GS.decorations = [];
    invalidateObstacles();
  }

  function restoreLevelEntities(frame) {
    for (const su of frame.units || []) {
      const u = spawnUnit(su.type, su.x, su.y, su.team);
      if (!u) continue;
      u.hp = su.hp ?? u.hp;
      u.maxHp = su.maxHp ?? u.maxHp;
      u.damage = su.damage ?? u.damage;
      u.accuracy = su.accuracy ?? u.accuracy;
      u.speed = su.speed ?? u.speed;
      u.range = su.range ?? u.range;
      u.morale = su.morale ?? u.morale;
      u.maxMorale = su.maxMorale ?? u.maxMorale;
      u.vetBronze = su.vetBronze || 0;
      u.vetSilver = su.vetSilver || 0;
      u.vetGold = su.vetGold || 0;
      if (su.team === 'player') {
        u.targetY = GS.rallyY;
        applyPlayerStatMods(u);
        if (svc('ContentExpansion')) svc('ContentExpansion').applyLoadoutToUnit(u);
      } else u.huntMode = true;
      GS.units.push(u);
    }
    for (const sb of frame.buildings || []) {
      if (GS.buildings.some((b) => Math.hypot(b.x - sb.x, b.y - sb.y) < 8 && b.type === sb.type))
        continue;
      const b = createBuilding(sb.type, sb.x, sb.y, sb.owner || 'player', {
        facing: sb.facing,
      });
      creativeFinishBuilding(b);
      Object.assign(b, sb);
      ensureBuildingHealth(b);
      normalizeEnemyEconomyBuilding(b);
      GS.buildings.push(b);
    }
    for (const sd of frame.decorations || []) {
      GS.decorations.push({
        ...sd,
        id: sd.id || `deco_${GS.decorations.length}`,
        blocksMove: sd.blocksMove !== false,
        blocksLOS: sd.blocksLOS !== false,
      });
    }
  }

  function loadCreativeLevel(level) {
    if (!level) return false;
    if (level.settings) {
      for (const [k, v] of Object.entries(level.settings)) setCreativeSetting(k, v);
    }
    if (level.wave != null) creativeSetWave(level.wave, { skipTerrain: true });
    if (level.tactical != null) creativeSetTp(level.tactical);
    clearCreativeEntities();
    restoreLevelEntities(level);
    if (level.customWave) setCustomWave(level.customWave);
    else GS.creativeCustomWave = null;
    if (level.timeOfDay === 'night' && isDayPhase()) creativeForceNight();
    else if (level.timeOfDay === 'day' && isNightPhase()) creativeForceDay();
    invalidateObstacles();
    showMessage(`Level loaded: ${level.name || 'Untitled'}`, 220);
    return true;
  }

  function creativePlaceDecoration(type, x, y) {
    const specs = {
      tree: { size: 20 + Math.random() * 8, hp: 999, radius: 18, cover: 0.45 },
      rock: { size: 12 + Math.random() * 6, hp: 999, radius: 12, cover: 0.3 },
      barricade: { size: 16, hp: 60, radius: 16, cover: 0.4 },
    };
    const spec = specs[type];
    if (!spec) return false;
    if (isBuildSiteBlocked(x, y, { footprint: spec.radius })) {
      showMessage('Terrain blocked — try another tile.');
      return false;
    }
    GS.decorations.push({
      type,
      id: `deco_${Date.now()}_${GS.decorations.length}`,
      x,
      y,
      ...spec,
      blocksMove: true,
      blocksLOS: true,
    });
    invalidateObstacles();
    svc('Particles')?.dust?.(x, y);
    return true;
  }

  function creativeEraseAt(x, y, radius = 30) {
    let best = null;
    let bestDist2 = radius * radius;
    for (let i = GS.decorations.length - 1; i >= 0; i--) {
      const d = GS.decorations[i];
      if (d.hp <= 0) continue;
      const dist2 = posDistSq(d.x, d.y, x, y);
      if (dist2 < bestDist2) {
        best = { kind: 'deco', index: i, dist2 };
        bestDist2 = dist2;
      }
    }
    for (const u of GS.units) {
      if (u.hp <= 0) continue;
      const dist2 = posDistSq(u.x, u.y, x, y);
      if (dist2 < bestDist2) {
        best = { kind: 'unit', id: u.id, dist2 };
        bestDist2 = dist2;
      }
    }
    for (const b of GS.buildings) {
      if (b.hp <= 0 || b.isCastle) continue;
      const dist2 = posDistSq(b.x, b.y, x, y);
      if (dist2 < bestDist2) {
        best = { kind: 'building', id: b.id, dist2 };
        bestDist2 = dist2;
      }
    }
    if (!best) return false;
    if (best.kind === 'deco') GS.decorations.splice(best.index, 1);
    else if (best.kind === 'unit') {
      const u = getUnitById(best.id);
      if (u) u.hp = 0;
    } else if (best.kind === 'building') {
      const b = GS.buildings.find((bb) => bb.id === best.id);
      if (b) finalizeBuildingDestroyed(b, { silent: true, playDeath: false });
    }
    invalidateObstacles();
    return true;
  }

  function creativeMoveUnitTo(id, x, y) {
    const u = getUnitById(id);
    if (!u || u.hp <= 0) return false;
    const pos = clampPos(x, y);
    u.x = pos.x;
    u.y = pos.y;
    u.path = [];
    u.pathIndex = 0;
    u.manualOrder = false;
    return true;
  }

  function creativeMoveBuildingTo(id, x, y) {
    const b = GS.buildings.find((bb) => bb.id === id);
    if (!b || b.hp <= 0) return false;
    const pos = clampPos(x, y);
    b.x = pos.x;
    b.y = pos.y;
    invalidateObstacles();
    return true;
  }

  function creativeMoveDecorationTo(index, x, y) {
    const d = GS.decorations[index];
    if (!d || d.hp <= 0) return false;
    d.x = x;
    d.y = y;
    invalidateObstacles();
    return true;
  }

  function creativeClearDecorations() {
    GS.decorations = [];
    invalidateObstacles();
  }

  function creativeClearAllBuildings() {
    for (let i = GS.buildings.length - 1; i >= 0; i--) {
      const b = GS.buildings[i];
      if (b.isCastle) continue;
      finalizeBuildingDestroyed(b, { silent: true, playDeath: false });
    }
    invalidateObstacles();
  }

  function creativeClearAllUnits() {
    GS.units.forEach((u) => {
      u.hp = 0;
    });
  }

  function restoreCreativeSnapshot(frame) {
    if (!frame) return false;
    if (frame.wave != null) creativeSetWave(frame.wave);
    if (frame.tactical != null) creativeSetTp(frame.tactical);
    releaseAllUnits();
    for (const su of frame.units || []) {
      const u = spawnUnit(su.type, su.x, su.y, su.team);
      if (!u) continue;
      u.hp = su.hp;
      u.maxHp = su.maxHp;
      u.damage = su.damage;
      u.accuracy = su.accuracy;
      u.speed = su.speed;
      u.range = su.range;
      u.morale = su.morale;
      u.maxMorale = su.maxMorale;
      u.vetBronze = su.vetBronze || 0;
      u.vetSilver = su.vetSilver || 0;
      u.vetGold = su.vetGold || 0;
      if (su.team === 'player') {
        u.targetY = GS.rallyY;
        applyPlayerStatMods(u);
      } else u.huntMode = true;
      GS.units.push(u);
    }
    if (frame.decorations?.length) {
      GS.decorations = frame.decorations.map((d, i) => ({
        ...d,
        id: d.id || `deco_${i}`,
        blocksMove: d.blocksMove !== false,
        blocksLOS: d.blocksLOS !== false,
      }));
    }
    if (frame.buildings?.length) {
      for (let i = GS.buildings.length - 1; i >= 0; i--) {
        const b = GS.buildings[i];
        if (b.owner === 'player' && b.isCastle) continue;
        GS.buildings.splice(i, 1);
        releaseBuildingRecord(b);
      }
      for (const sb of frame.buildings) {
        if (GS.buildings.some((b) => Math.hypot(b.x - sb.x, b.y - sb.y) < 8)) continue;
        const b = createBuilding(sb.type, sb.x, sb.y, sb.owner || 'player');
        creativeFinishBuilding(b);
        Object.assign(b, sb);
        ensureBuildingHealth(b);
        normalizeEnemyEconomyBuilding(b);
        GS.buildings.push(b);
      }
      invalidateObstacles();
    }
    if (frame.timeOfDay === 'night' && isDayPhase()) creativeForceNight();
    if (frame.timeOfDay === 'day' && isNightPhase()) creativeForceDay();
    return true;
  }

  function creativeResetUnitToDef() {
    const u = getSelectedUnit();
    if (!u) {
      showMessage('Select a unit first.');
      return false;
    }
    const def = u.team === 'player' ? getPlayerUnitDef(u.type) : EnemyDefs[u.type];
    if (!def) return false;
    u.maxHp = def.hp;
    u.hp = u.maxHp;
    u.damage = def.damage;
    u.accuracy = def.accuracy;
    u.speed = def.speed;
    u.range = def.range;
    u.baseRange = def.range;
    u.morale = def.morale || 10;
    u.maxMorale = u.morale;
    showMessage(`${unitDisplayName(u)} reset to default stats.`, 160);
    return true;
  }

  function creativeApplyStatEditor() {
    const u = getSelectedUnit();
    if (!u) {
      showMessage('Select a unit for stat edit.');
      return false;
    }
    const hp = parseInt(document.getElementById('creative-stat-hp')?.value, 10);
    const dmg = parseInt(document.getElementById('creative-stat-dmg')?.value, 10);
    const acc = parseInt(document.getElementById('creative-stat-acc')?.value, 10);
    const spd = parseFloat(document.getElementById('creative-stat-spd')?.value);
    const rng = parseInt(document.getElementById('creative-stat-rng')?.value, 10);
    return applyCreativeUnitStats(u, {
      hp: Number.isFinite(hp) ? hp : undefined,
      damage: Number.isFinite(dmg) ? dmg : undefined,
      accuracy: Number.isFinite(acc) ? acc : undefined,
      speed: Number.isFinite(spd) ? spd : undefined,
      range: Number.isFinite(rng) ? rng : undefined,
    });
  }

  function creativeFillStatEditorFromSelection() {
    const u = getSelectedUnit();
    if (!u) return;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = String(v ?? '');
    };
    set('creative-stat-hp', u.maxHp);
    set('creative-stat-dmg', u.damage);
    set('creative-stat-acc', u.accuracy);
    set('creative-stat-spd', u.speed);
    set('creative-stat-rng', u.range);
  }

  function creativeRegenerateMap() {
    GS.terrainInitialized = false;
    ensureInitialBattlefield(true);
    showMessage('Battlefield regenerated (decorations & hazards refreshed).', 200);
  }

  function creativeClearWaveSpawns() {
    GS.spawnQueue = [];
    GS.units
      .filter((u) => u.team === 'enemy')
      .forEach((u) => {
        u.hp = 0;
      });
    GS.spawnTimer = 0;
    GS.waveProgress = 0;
    showMessage('Creative: wave spawns and enemies cleared.', 160);
  }

  function creativeClearEnemies() {
    GS.units
      .filter((u) => u.team === 'enemy')
      .forEach((u) => {
        u.hp = 0;
      });
    GS.spawnQueue = [];
    showMessage('All enemies removed.', 140);
  }

  function creativeClearEnemyBuildings() {
    GS.buildings = GS.buildings.filter((b) => b.owner !== 'enemy');
    invalidateObstacles();
    showMessage('Enemy buildings removed.', 140);
  }

  function creativeHealAll() {
    GS.units
      .filter((u) => u.team === 'player' && u.hp > 0)
      .forEach((u) => {
        u.hp = u.maxHp;
        u.demoralized = false;
        u.fleeing = false;
        u.witnessDeaths = 0;
      });
    showMessage('All allies healed.', 140);
  }

  function creativeMaxMorale() {
    GS.units
      .filter((u) => u.team === 'player' && u.hp > 0)
      .forEach((u) => {
        u.morale = u.maxMorale;
        u.demoralized = false;
        u.fleeing = false;
      });
    showMessage('Army morale maxed.', 140);
  }

  function getUnitById(id) {
    if (!id) return null;
    if (GS.unitByIdFrame !== GS.updateTick) {
      unitById.clear();
      for (const u of GS.units) {
        if (u && u.hp > 0 && !u._pooled) unitById.set(u.id, u);
      }
      GS.unitByIdFrame = GS.updateTick;
    }
    const cached = unitById.get(id);
    if (cached && cached.hp > 0 && !cached._pooled && cached.id === id) return cached;
    if (cached) unitById.delete(id);
    const found = GS.units.find((u) => u && u.id === id && u.hp > 0 && !u._pooled) || null;
    if (found) unitById.set(id, found);
    return found;
  }

  function getSelectedUnit() {
    return GS.selectedUnitId ? getUnitById(GS.selectedUnitId) : null;
  }

  function creativeRankUpSelected() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) {
      showMessage('Select a living ally first.');
      return;
    }
    notifyVetStarEvent(u, addVetStar(u));
    showMessage(`${unitDisplayName(u)} earned a star!`, 160);
  }

  function creativeMaxStarsSelected() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.hp <= 0) {
      showMessage('Select a living ally first.');
      return;
    }
    let safety = 0;
    while ((u.vetGold || 0) < 3 && safety++ < 40) addVetStar(u);
    if (u.type === 'general') u.generalStars = Math.max(u.generalStars || 0, 3);
    showMessage(`${unitDisplayName(u)} maxed veteran stars!`, 180);
  }

  function creativeHealSelected() {
    const u = getSelectedUnit();
    if (!u || u.hp <= 0) {
      showMessage('Select a unit first.');
      return;
    }
    u.hp = u.maxHp;
    u.demoralized = false;
    u.fleeing = false;
    svc('FloatingText').heal(u.x, u.y, u.maxHp);
    showMessage(`${unitDisplayName(u)} fully healed.`, 140);
  }

  function creativeKillSelected() {
    const u = getSelectedUnit();
    if (!u) {
      showMessage('Select a unit first.');
      return;
    }
    u.hp = 0;
    showMessage(`${unitDisplayName(u)} removed.`, 120);
  }

  function creativePromoteSelectedGeneral() {
    const u = getSelectedUnit();
    if (!u || u.team !== 'player' || u.type !== 'footman' || u.hp <= 0) {
      showMessage('Select a living Footman to promote.');
      return;
    }
    if (findPlayerGeneral()) {
      showMessage('A General already commands the field.');
      return;
    }
    releaseFromWallGarrison(u);
    releaseFromGarrison(u);
    promoteFootmanToGeneral(u);
    recordFootmanCommandElevation(u, true);
    showMessage(`${u.honorName || 'Footman'} promoted to General!`, 200);
  }

  function startCreative(opts = {}) {
    GS.creativeSettings = { ...CREATIVE_DEFAULTS, ...opts };
    GS.creativeTool = null;
    GS.creativeSpawnType = null;
    if (typeof LevelEditor !== 'undefined') LevelEditor.onSessionStart();
    start({ creative: true });
  }

  return {
    bind,
    applyCampaignRulesPreset,
    creativeAddTp,
    creativeApplyStatEditor,
    creativeClearAllBuildings,
    creativeClearAllUnits,
    creativeClearDecorations,
    creativeClearEnemies,
    creativeClearEnemyBuildings,
    creativeClearWaveSpawns,
    creativeEraseAt,
    creativeFillStatEditorFromSelection,
    creativeForceDay,
    creativeForceNight,
    creativeHealAll,
    creativeHealSelected,
    creativeInstantPlaceBuilding,
    creativeKillSelected,
    creativeLaunchCustomWave,
    creativeMaxMorale,
    creativeMaxStarsSelected,
    creativeMoveBuildingTo,
    creativeMoveDecorationTo,
    creativeMoveUnitTo,
    creativePlaceDecoration,
    creativePromoteSelectedGeneral,
    creativeRankUpSelected,
    creativeRegenerateMap,
    creativeResetUnitToDef,
    creativeSetTool,
    creativeSetTp,
    creativeSetWave,
    creativeSpawnEnemyAt,
    creativeSpawnEnemyBuildingAt,
    creativeSpawnPlayerAt,
    creativeSpawnPlayerBuildingAt,
    creativeSpawnSquadAt,
    creativeStartWave,
    getBuildingsSnapshot,
    getCustomWave,
    getDecorationsSnapshot,
    getLevelSnapshot,
    getSelectedUnit,
    getUnitById,
    getUnitsSnapshot,
    getWorldCenter,
    isCreativeMode,
    loadCreativeLevel,
    randomMapEdgePos,
    restoreCreativeSnapshot,
    setCreativeSetting,
    setCustomWave,
    startCreative,
  };
})();
