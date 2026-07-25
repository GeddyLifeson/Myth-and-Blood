/**
 * Game core primitives — pure predicates, samplers and small helpers extracted
 * from js/game.js. Every member here is closure-free with respect to game.js's
 * mutable run state: it depends only on its arguments, the constants below, and
 * other GameCore members. Verified by scripts/verify-game-core.mjs.
 *
 * Loaded as a classic script BEFORE js/game.js, which destructures these names
 * back into its own scope so call sites stay unchanged.
 */
const GameCore = (() => {
  const cameraKeys = { up: false, down: false, left: false, right: false };

  const unitCounts = {
    player: 0,
    enemy: 0,
    activeEnemy: 0,
    bossActive: false,
    buildings: 0,
    unitProducers: 0,
    hamlets: 0,
    guilds: 0,
    enemyEconomy: 0,
    northernHolds: 0,
    hasWweAcademy: false,
    liveBuilders: 0,
    hasCourier: false,
    playerGeneral: null,
    stationedGeneral: null,
    academies: 0,
    enemyBuildings: 0,
    researchLabs: 0,
    wweOnField: [],
    crossoverOnField: [],
    crossoverBuildings: [],
    selectedLive: null,
    playerWalls: 0,
    playerFortifications: 0,
    enemyHamlets: 0,
    enemyGuilds: 0,
    enemyEconomySpawnBonus: 0,
    hamletTpBonus: 0,
    merchantGuildTpBonus: 0,
    garrisonedPlayer: 0,
    mageCount: 0,
    livePlayerByType: {},
  };

  const QUICKSAVE_KEY = 'myth-and-blood-quicksave';

  const DECO_GAP = 8;

  const UNIT_COLLISION = 10;

  const MELEE_STANDOFF = 16;

  const FELLOWSHIP_MORALE_HIGH_RATIO = 0.62;

  const MARTIAL_MELEE_FOCUS_RATIO = 0.65;

  const DRAGON_THEMED_ABILITIES = new Set([
    'fus_ro_dah',
    'fire_breath',
    'ice_form',
    'thuum',
    'thuum_echo',
    'dragon_aspect',
  ]);

  const STAND_ALLIANCE_MIN_HEROES = 3;

  const KI_ENERGY_HIGH_RATIO = 0.55;

  const SHOWMANSHIP_HEAVY_MIN_UNITS = 2;

  const SHOWMANSHIP_HEAVY_RATIO = 0.35;

  const KI_ENERGY_ABILITIES = new Set([
    'kamehameha',
    'galick_gun',
    'special_beam',
    'burning_attack',
    'death_beam',
    'hidden_potential',
    'perfect_form',
    'hakai',
    'hamon',
    'sunlight_yellow',
    'energy_sword',
  ]);

  const tacticalFoeCap = 36;

  const tacticalFoeBest = new Array(tacticalFoeCap);

  const tacticalFoeBestD = new Float64Array(tacticalFoeCap);

  /** Resolve a registered module — prefer GameServices over bare globals. */
  function svc(id) {
    if (typeof GameServices !== 'undefined') {
      const s = GameServices.get(id);
      if (s != null) return s;
    }
    return typeof globalThis !== 'undefined' ? (globalThis[id] ?? null) : null;
  }

  /** Safe SFX — never throws if audio is missing or locked. */
  function playSfx(name, ...args) {
    try {
      const eng = svc('AudioEngine') || (typeof AudioEngine !== 'undefined' ? AudioEngine : null);
      if (!eng) return;
      if (typeof eng.play === 'function') {
        eng.play(name, ...args);
        return;
      }
      const fn = eng.SFX?.[name];
      if (typeof fn === 'function') fn(...args);
    } catch (_) {
      /* audio optional */
    }
  }

  function wireGameServices() {
    if (typeof GameServices === 'undefined') return;
    GameServices.registerFromGlobals();
    if (typeof GameData !== 'undefined') {
      GameServices.registerDefs({
        units: GameData.units,
        buildings: GameData.buildings,
        enemies: GameData.enemies,
        abilities: GameData.abilities,
        spyActions: GameData.spyActions,
        fxLife: GameData.fxLife,
        synergies: GameData.synergies,
      });
    }
  }

  function clampCameraAxis(pos, worldSize, half, margin = 0) {
    if (!Number.isFinite(pos)) return worldSize / 2;
    if (!Number.isFinite(worldSize) || worldSize <= 0) return pos;
    if (!Number.isFinite(half) || half <= 0) return Math.max(0, Math.min(worldSize, pos));
    const inset = Math.max(0, margin);
    const low = half;
    const high = worldSize - half;
    if (low <= high) return Math.max(low, Math.min(high, pos));
    // Map fits in viewport — keep at least a sliver on screen (no unbounded drift).
    return Math.max(-half + inset, Math.min(worldSize + half - inset, pos));
  }

  function getPanelInsets() {
    if (svc('Settings')) return svc('Settings').getPanelInsets();
    return { left: 60, right: 56, top: 46, bottom: 36 };
  }

  function setCameraKey(key, pressed) {
    switch (key) {
      case 'arrowup':
        cameraKeys.up = pressed;
        break;
      case 'arrowdown':
        cameraKeys.down = pressed;
        break;
      case 'arrowleft':
        cameraKeys.left = pressed;
        break;
      case 'arrowright':
        cameraKeys.right = pressed;
        break;
      default:
        break;
    }
  }

  function unitFootprint(unit) {
    const scale = unit.spriteScale || 1;
    return (
      ((svc('SpriteGen').UNIT_STYLE[unit.spriteType] || { size: 9 }).size + UNIT_COLLISION + 6) *
      scale
    );
  }

  function overlapsPlacedDecorations(x, y, radius, placed) {
    for (const d of placed) {
      const reach = radius + d.radius + DECO_GAP;
      if (posDistSq(x, y, d.x, d.y) < reach * reach) return true;
    }
    return false;
  }

  function isPlayerFriendlyWall(obs, unit) {
    if (!obs || unit?.team !== 'player') return false;
    const wallType = obs.type || obs.ref?.type;
    if (wallType !== 'wall') return false;
    const owner = obs.owner ?? obs.ref?.owner;
    return owner !== 'enemy';
  }

  /** True while a player click-to-move is still in progress (not yet at destination). */
  function isPlayerMarchingOrder(unit) {
    if (!unit?.manualOrder) return false;
    // Returning to a hold post is not a player click-order.
    if (unit.pathTargetId === 'hold') return false;
    if (unit.targetX != null && unit.targetY != null) {
      return Math.hypot(unit.x - unit.targetX, unit.y - unit.targetY) > 12;
    }
    return !!(unit.path?.length && unit.pathIndex < unit.path.length);
  }

  function clearHoldPost(unit) {
    if (!unit) return;
    unit.holdX = null;
    unit.holdY = null;
    unit.pendingHoldX = null;
    unit.pendingHoldY = null;
    if (unit.pathTargetId === 'hold') unit.pathTargetId = null;
  }

  function hasHoldPost(unit) {
    return unit != null && Number.isFinite(unit.holdX) && Number.isFinite(unit.holdY);
  }

  function distToHoldPost(unit) {
    if (!hasHoldPost(unit)) return 0;
    return Math.hypot(unit.x - unit.holdX, unit.y - unit.holdY);
  }

  function enemyIsAdvancing(unit) {
    return (
      unit?.team === 'enemy' &&
      unit.hp > 0 &&
      (!!unit.path?.length || (unit.targetY != null && unit.y < unit.targetY - 6))
    );
  }

  function getGfxQuality() {
    return svc('GfxQuality') ? svc('GfxQuality').get() : null;
  }

  function spatialScratchQuery(x, y, radius, predicate) {
    const spatial = svc('Spatial');
    return spatial.queryRadiusInto(x, y, radius, predicate, spatial._scratch);
  }

  function releaseUnitRecord(u) {
    if (u) svc('EntityPool')?.releaseUnit(u);
  }

  function releaseBuildingRecord(b) {
    if (b) svc('EntityPool')?.releaseBuilding(b);
  }

  function isKiEnergyCombatUnit(unit) {
    if (!unit || unit.hp <= 0) return false;
    const role = getUnitCombatRole(unit);
    if (!role || role === 'support') return false;
    const def = typeof getCrossoverDef === 'function' ? getCrossoverDef(unit.type) : null;
    if (def?.combatTag === 'ki' || def?.faction === 'dragonball') return true;
    if (unit.type === 'mage' || unit.projectile === 'bolt') return true;
    if (def?.ability && KI_ENERGY_ABILITIES.has(def.ability)) return true;
    return false;
  }

  /** High ki / energy presence — power level escalation for planetary defense. */
  function sampleKiEnergyArmy(playerUnits) {
    let combatCount = 0;
    let kiCount = 0;
    for (const u of playerUnits || []) {
      const role = getUnitCombatRole(u);
      if (!role || role === 'support') continue;
      combatCount++;
      if (isKiEnergyCombatUnit(u)) kiCount++;
    }
    if (!combatCount) return null;
    const ratio = kiCount / combatCount;
    return {
      high: ratio >= KI_ENERGY_HIGH_RATIO,
      ratio,
      kiCount,
      combatCount,
    };
  }

  function isHeroUnit(unit) {
    if (!unit || unit.hp <= 0) return false;
    return !!(unit.isCrossover || unit.isWwe || unit.isDoomslayer);
  }

  /** Showmanship champions on the field — attitude, charisma, entertainment. */
  function sampleShowmanshipArmy(playerUnits) {
    let combatCount = 0;
    let showmanshipCount = 0;
    for (const u of playerUnits || []) {
      const role = getUnitCombatRole(u);
      if (!role || role === 'support') continue;
      combatCount++;
      if (typeof isShowmanshipUnit === 'function' && isShowmanshipUnit(u)) showmanshipCount++;
    }
    if (!combatCount || !showmanshipCount) return null;
    const ratio = showmanshipCount / combatCount;
    const heavy =
      showmanshipCount >= SHOWMANSHIP_HEAVY_MIN_UNITS || ratio >= SHOWMANSHIP_HEAVY_RATIO;
    return { heavy, ratio, showmanshipCount, combatCount };
  }

  /** One hero alone on the field — the killing blow must be theirs. */
  function isMajorBossUnit(unit) {
    return !!(
      unit?.isNamedBoss ||
      unit?.isPlanetBoss ||
      unit?.type === 'war_chief' ||
      unit?.type === 'behemoth'
    );
  }

  function isDragonThemedUnit(unit) {
    if (!unit || unit.team !== 'player') return false;
    if (unit.wweAbility && DRAGON_THEMED_ABILITIES.has(unit.wweAbility)) return true;
    const def = getCrossoverDef?.(unit.type);
    if (def?.combatTag === 'dragon' || def?.faction === 'tes') return true;
    return false;
  }

  function sampleCrossoverHeroAlliance(playerUnits) {
    let heroCount = 0;
    const factions = new Set();
    for (const u of playerUnits || []) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      if (!u.isCrossover && !u.isWwe) continue;
      heroCount++;
      if (typeof isWweUnit === 'function' && isWweUnit(u.type)) {
        factions.add('wwe');
        continue;
      }
      const def = typeof getCrossoverDef === 'function' ? getCrossoverDef(u.type) : null;
      if (def?.faction) factions.add(def.faction);
    }
    if (heroCount < STAND_ALLIANCE_MIN_HEROES) return null;
    return {
      allied: true,
      heroCount,
      factionCount: factions.size,
      multiFaction: factions.size >= 2,
    };
  }

  function getUnitCombatRole(unit) {
    if (!unit || unit.hp <= 0) return null;
    if (
      unit.combatType === 'builder' ||
      unit.combatType === 'courier' ||
      unit.combatType === 'healer' ||
      unit.isGeneral ||
      unit.combatType === 'general'
    )
      return 'support';
    if (typeof getCrossoverCombatTag === 'function') {
      const tag = getCrossoverCombatTag(unit);
      if (tag === 'support') return 'support';
      if (tag === 'ranged') return 'ranged';
      if (tag === 'melee') return 'melee';
    }
    if (
      unit.combatType === 'ranged' ||
      unit.projectile ||
      unit.combatType === 'siege' ||
      unit.combatType === 'rifle'
    )
      return 'ranged';
    if (unit.combatType === 'melee' || unit.combatType === 'cavalry') return 'melee';
    if (unit.type === 'archer' || unit.type === 'mage') return 'ranged';
    return 'melee';
  }

  /** Primarily melee army — pure martial arts dominance, one-on-one spirit. */
  function sampleMeleeFocusedArmy(playerUnits) {
    let combatCount = 0;
    let meleeCount = 0;
    for (const u of playerUnits || []) {
      const role = getUnitCombatRole(u);
      if (!role || role === 'support') continue;
      combatCount++;
      if (role === 'melee') meleeCount++;
    }
    if (!combatCount) return null;
    const ratio = meleeCount / combatCount;
    return {
      focused: ratio >= MARTIAL_MELEE_FOCUS_RATIO,
      ratio,
      meleeCount,
      combatCount,
    };
  }

  function isMoraleCombatUnit(unit) {
    if (!unit || unit.hp <= 0) return false;
    if (unit.isGeneral || unit.isDoomslayer) return false;
    if (
      unit.combatType === 'builder' ||
      unit.combatType === 'courier' ||
      unit.combatType === 'healer'
    )
      return false;
    return true;
  }

  /** Entire combat army at high morale — fellowship standing firm against the dark. */
  function samplePlayerArmyMorale(playerUnits) {
    const combat = (playerUnits || []).filter((u) => isMoraleCombatUnit(u));
    if (!combat.length) return null;
    let minRatio = 1;
    for (const u of combat) {
      if (u.demoralized || u.fleeing) {
        return { high: false, ratio: 0, combatCount: combat.length, minRatio: 0 };
      }
      const max = Math.max(1, u.maxMorale || 10);
      const ratio = (u.morale || 0) / max;
      minRatio = Math.min(minRatio, ratio);
      if (ratio < FELLOWSHIP_MORALE_HIGH_RATIO) {
        return { high: false, ratio, combatCount: combat.length, minRatio };
      }
    }
    return { high: true, ratio: minRatio, combatCount: combat.length, minRatio };
  }

  function moraleBreakThreshold(unit) {
    return Math.max(4, Math.floor((unit.maxMorale || 10) * 0.28));
  }

  function isValidCombatFoe(foe) {
    return foe && foe.hp > 0 && !foe.fleeing;
  }

  function clearUnitPathAsync(unit) {
    GameRuntime.clearPathTrack(unit, { keepPath: true, keepTargets: true });
  }

  function releaseCombatPursuit(unit, opts = {}) {
    const keepManual = !!(opts.keepManual && unit.manualOrder);
    unit.combatTargetId = null;
    if (!keepManual) unit.structureTargetId = null;
    GameRuntime.clearPathTrack(unit, {
      keepManual,
      keepTargets: keepManual,
      keepPath: keepManual,
    });
  }

  function countActiveEnemies() {
    return unitCounts.activeEnemy;
  }

  function isMeleeCombat(unit) {
    return (
      unit.combatType === 'melee' ||
      unit.combatType === 'rifle' ||
      unit.type === 'sapper' ||
      unit.type === 'general'
    );
  }

  function getGeneralBuffStrengthLegacy(gen) {
    const minutes = (gen.generalAliveTimer || 0) / 3600;
    const starBuff = (gen.generalStars || 0) * 0.045;
    return Math.min(1, 0.08 + minutes * 0.18 + starBuff);
  }

  function getAdvancedMods() {
    return svc('AdvancedDifficulty')
      ? svc('AdvancedDifficulty').getCombinedMods()
      : {
          allyHpMult: 1,
          allyDmgMult: 1,
          tpMult: 1,
          enemyHpMult: 1,
          enemyDmgMult: 1,
          enemyCountMult: 1,
          spawnIntervalMult: 1,
          eliteChanceMult: 1,
          enemyWeight: {},
          missLimitDelta: 0,
          playerMoraleDelta: 0,
          allyAccDelta: 0,
          nightPrepMult: 1,
          buildSpeedMult: 1,
          siegeWaveMult: 1,
          settlementTpMult: 1,
          fogOfWar: false,
          fogVisionMult: 1,
          forceNoElites: false,
        };
  }

  function getFogVisionMult() {
    return getAdvancedMods().fogVisionMult || 1;
  }

  function gameRandom() {
    return svc('GameModes') ? svc('GameModes').random() : Math.random();
  }

  function countGarrisoned(playerUnits) {
    let n = 0;
    for (let i = 0; i < playerUnits.length; i++) {
      if (playerUnits[i].garrisoned) n++;
    }
    return n;
  }

  function countPlayerHamlets() {
    return unitCounts.hamlets;
  }

  function countPlayerGuilds() {
    return unitCounts.guilds;
  }

  function getCrossoverBuildingsOnField() {
    return unitCounts.crossoverBuildings;
  }

  function getWweOnField() {
    return unitCounts.wweOnField;
  }

  function getCrossoverOnField() {
    return unitCounts.crossoverOnField;
  }

  function ensurePlayerUnitDef(type) {
    if (!type) return null;
    // Prefer units.js resolver (ContentExpansion re-register + expansion fallbacks).
    if (typeof resolvePlayerUnitDef === 'function') {
      const resolved = resolvePlayerUnitDef(type);
      if (resolved) return resolved;
    }
    let def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(type) : null;
    if (def) return def;
    // Expansion roster (bard/ballista/scout/pikeman) may be missing after a data race — re-register.
    if (svc('ContentExpansion')?.registerDefs) {
      svc('ContentExpansion').registerDefs();
      def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(type) : null;
    }
    if (!def && typeof GameData !== 'undefined' && GameData.refreshDependents) {
      GameData.refreshDependents();
      def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(type) : null;
    }
    return def || null;
  }

  function getHamletTpBonus() {
    return unitCounts.hamletTpBonus;
  }

  function getMerchantGuildTpBonus() {
    return unitCounts.merchantGuildTpBonus;
  }

  function getRawSettlementTpBonus() {
    return unitCounts.hamletTpBonus + unitCounts.merchantGuildTpBonus;
  }

  function getSettlementTpBonus() {
    const raw = getRawSettlementTpBonus();
    const scaled = svc('GameDepth') ? svc('GameDepth').scaleSettlementTp(raw) : raw;
    const mult = getAdvancedMods().settlementTpMult || 1;
    return Math.floor(scaled * mult);
  }

  function getEnemyEconomySpawnBonus() {
    return unitCounts.enemyEconomySpawnBonus;
  }

  function ensureBuildingHealth(b) {
    if (!b) return;
    const def = BuildDefs[b.type];
    if (!b.maxHp || b.maxHp <= 0) b.maxHp = Math.max(1, def?.hp ?? b.hp ?? 100);
    if (!b.hp || b.hp <= 0) b.hp = b.maxHp;
    if (b.hp > b.maxHp) b.hp = b.maxHp;
  }

  function getEnemyEconomyHpMult(waveNum) {
    const w = waveNum || 0;
    if (w < 20) return 1.75;
    if (w < 50) return 1.55 + w / 250;
    if (w < 100) return 1.75 + w / 400;
    return 1.95 + Math.min(0.45, w / 550);
  }

  function isEnemyEconomyUnderConstruction(b) {
    return !!(b?.waveBuildRequired && !b.complete);
  }

  /** Enemy economy / mirror settlements disabled — pure unit wave pressure. */
  function bootstrapEnemyEconomyForWave(_tw) {
    return;
  }

  function countEnemies() {
    return unitCounts.enemy;
  }

  function applyCreativeUnitStats(unit, stats) {
    if (!unit) return false;
    if (stats.hp != null) {
      unit.maxHp = Math.max(1, Math.floor(stats.hp));
      unit.hp = unit.maxHp;
    }
    if (stats.damage != null) unit.damage = Math.max(1, Math.floor(stats.damage));
    if (stats.accuracy != null)
      unit.accuracy = Math.min(99, Math.max(1, Math.floor(stats.accuracy)));
    if (stats.speed != null) unit.speed = Math.max(0.2, parseFloat(stats.speed));
    if (stats.range != null) {
      unit.range = Math.floor(stats.range);
      unit.baseRange = unit.range;
    }
    if (stats.morale != null) {
      unit.maxMorale = Math.max(1, Math.floor(stats.morale));
      unit.morale = unit.maxMorale;
    }
    svc('FloatingText').status(unit.x, unit.y, 'STATS', '#80c0ff');
    return true;
  }

  function applyCreativeUnitPreset(unit, preset) {
    if (!unit || !preset) return false;
    const def = unit.team === 'player' ? getPlayerUnitDef(unit.type) : EnemyDefs[unit.type];
    const baseHp = def?.hp || unit.maxHp;
    const baseDmg = def?.damage || unit.damage;
    if (preset.hpMult) {
      unit.maxHp = Math.floor(baseHp * preset.hpMult);
      unit.hp = unit.maxHp;
    } else if (preset.hp != null) {
      unit.maxHp = preset.hp;
      unit.hp = unit.maxHp;
    }
    if (preset.damageMult) unit.damage = Math.floor(baseDmg * preset.damageMult);
    else if (preset.dmgMult) unit.damage = Math.floor(baseDmg * preset.dmgMult);
    else if (preset.damage != null) unit.damage = preset.damage;
    if (preset.accuracy != null) unit.accuracy = preset.accuracy;
    if (preset.speedMult) unit.speed = (def?.speed || unit.speed) * preset.speedMult;
    else if (preset.speed != null) unit.speed = preset.speed;
    if (preset.rangeMult && unit.range) {
      unit.range = Math.floor((def?.range || unit.range) * preset.rangeMult);
      unit.baseRange = unit.range;
    }
    if (preset.vetGold) {
      unit.vetGold = preset.vetGold;
      unit.vetSilver = 0;
      unit.vetBronze = 0;
    }
    svc('FloatingText').status(unit.x, unit.y, preset.label || 'PRESET', '#ffd080');
    return true;
  }

  function specialistStarColor(unit) {
    if (unit.type === 'healer') return '#60c080';
    if (unit.type === 'builder') return '#c0a060';
    if (unit.type === 'courier') return '#e0c080';
    return VET_STAR_COLORS.bronze;
  }

  function unitDistance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function unitDistSq(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  }

  function posDistSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  function getApproachPoint(from, target, standoff = MELEE_STANDOFF) {
    const dx = from.x - target.x,
      dy = from.y - target.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= standoff || dist < 0.01) return { x: from.x, y: from.y };
    const scale = (dist - standoff) / dist;
    return { x: target.x + dx * scale, y: target.y + dy * scale };
  }

  function slotAngleOffset(unitId, slotIndex) {
    let h = 0;
    for (let i = 0; i < unitId.length; i++) h = (h + unitId.charCodeAt(i) * (i + 1)) % 997;
    return ((h % 5) - 2) * 0.08 + slotIndex * 0.02;
  }

  function getMeleeRing(unit) {
    return Math.max(14, (unit.meleeRange || MELEE_STANDOFF) - 4);
  }

  function trimFoeListToNearest(unit, list, cap = tacticalFoeCap) {
    if (list.length <= cap) return list;
    let filled = 0;
    for (let i = 0; i < list.length; i++) {
      const foe = list[i];
      const d = unitDistSq(unit, foe);
      if (filled < cap) {
        tacticalFoeBest[filled] = foe;
        tacticalFoeBestD[filled] = d;
        filled++;
        continue;
      }
      let worst = 0;
      for (let j = 1; j < cap; j++) {
        if (tacticalFoeBestD[j] > tacticalFoeBestD[worst]) worst = j;
      }
      if (d < tacticalFoeBestD[worst]) {
        tacticalFoeBest[worst] = foe;
        tacticalFoeBestD[worst] = d;
      }
    }
    list.length = 0;
    for (let i = 0; i < filled; i++) list.push(tacticalFoeBest[i]);
    return list;
  }

  function canDeployWithTP() {
    return true;
  }

  function getDeployCostMult() {
    return 1;
  }

  function enemyRotationForSide(side) {
    switch (side) {
      case 'south':
        return -90;
      case 'east':
        return 180;
      case 'west':
        return 0;
      default:
        return 90;
    }
  }

  function isUnitProducingBuilding(b) {
    return !!(
      b &&
      b.owner === 'player' &&
      b.complete &&
      b.hp > 0 &&
      (b.isAcademy || b.isCrossoverBarracks || b.isWweAcademy)
    );
  }

  function countLivePlayerUnits() {
    return unitCounts.player;
  }

  function isPlayerEliminated() {
    return unitCounts.player === 0 && unitCounts.unitProducers === 0;
  }

  function announceRtsEra() {
    // RTS map expansion / enemy settlements removed — academy era message covers wave 100.
  }

  function allowsCampaignEconomyVictory() {
    // Wave-defense focus: no "raze settlements to win" — survive escalating waves.
    return false;
  }

  function getRunModeId() {
    return svc('GameModes') ? svc('GameModes').getSession()?.modeId : 'campaign';
  }

  function tryPlaceEnemyBuilding(_type, _nearX, _nearY, _factionId) {
    // Wave-defense focus: no enemy buildings / mirror settlements.
    return false;
  }

  function updateEnemyEconomy() {
    return;
  }

  function updateEnemyRTS() {
    return;
  }

  function pathClearanceForUnit(unit) {
    if (unit?.spriteScale >= 1.5 || unit?.type === 'behemoth' || unit?.type === 'iron_colossus') {
      return UNIT_COLLISION + 14;
    }
    if (unit?.combatType === 'cavalry' || unit?.type === 'siege_tower') return UNIT_COLLISION + 8;
    return UNIT_COLLISION + 2;
  }

  function unitBlocksMovement(u) {
    if (!u || u.hp <= 0) return false;
    if (u.garrisoned || u.stationedKeep || u.wallGarrisoned) return false;
    if (u.siegeDeployed) return false;
    return true;
  }

  function getSpawnFillSeed(waveNum) {
    const modes = svc('GameModes');
    const session = modes?.getSession?.();
    const base = session?.seed ?? 'myth';
    if (modes?.createRng) {
      return Math.floor(modes.createRng(`${base}:spawn:${waveNum}`)() * 0xffffffff) >>> 0;
    }
    let h = 0;
    const s = `${base}:spawn:${waveNum}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function normalizeGameSpeed(speed) {
    if (typeof PacingTools !== 'undefined') return PacingTools.normalizeSpeed(speed);
    const n = parseFloat(speed);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function hasCourier() {
    return unitCounts.hasCourier;
  }

  function getBuildingRefund(b) {
    return Math.floor((BuildDefs[b.type]?.cost ?? 0) * 0.5);
  }

  function manualMoveReached(unit) {
    if (!unit.manualOrder || unit.targetX == null || unit.targetY == null) return false;
    return Math.hypot(unit.x - unit.targetX, unit.y - unit.targetY) <= 10;
  }

  function getHamletFortressWallLayout(hamlet) {
    const hx = hamlet.x;
    const hy = hamlet.y;
    const o = Math.floor((hamlet.radius || 55) + 20);
    const spread = 36;
    return [
      { x: hx - spread, y: hy - o, facing: 'north' },
      { x: hx + spread, y: hy - o, facing: 'north' },
      { x: hx - spread, y: hy + o, facing: 'south' },
      { x: hx + spread, y: hy + o, facing: 'south' },
      { x: hx + o, y: hy - spread, facing: 'east' },
      { x: hx + o, y: hy + spread, facing: 'east' },
      { x: hx - o, y: hy - spread, facing: 'west' },
      { x: hx - o, y: hy + spread, facing: 'west' },
    ];
  }

  function strikeImpactFx(type, wx, wy, radius, intensity = 1) {
    StrikeFX?.impact?.(type, wx, wy, radius, intensity);
    if (svc('VisualPolish')) svc('VisualPolish').addScreenShake(3 + intensity * 4);
  }

  function isPlayerMageUnit(u) {
    return !!(
      u &&
      u.team === 'player' &&
      u.hp > 0 &&
      (u.type === 'mage' ||
        u.combatTag === 'mage' ||
        (u.projectile === 'bolt' && u.combatType === 'ranged' && u.type?.includes?.('mage')))
    );
  }

  function isBehindWall(unit, wall) {
    const margin = 10;
    const span = wall.radius + 6;
    switch (wall.facing || 'north') {
      case 'north':
        return unit.y > wall.y + margin && Math.abs(unit.x - wall.x) < span;
      case 'south':
        return unit.y < wall.y - margin && Math.abs(unit.x - wall.x) < span;
      case 'east':
        return unit.x < wall.x - margin && Math.abs(unit.y - wall.y) < span;
      case 'west':
        return unit.x > wall.x + margin && Math.abs(unit.y - wall.y) < span;
      default:
        return false;
    }
  }

  function countPlayerWalls() {
    return unitCounts.playerWalls;
  }

  /** Castles, walls, outposts, and upgraded hamlets — Eternal Crusade fortification line. */
  function countPlayerFortifications() {
    return unitCounts.playerFortifications;
  }

  function shouldReleaseOutpostGarrison(gu) {
    return (
      !gu ||
      gu.fleeing ||
      gu.demoralized ||
      gu.retreatingToMed ||
      gu.atMedicalTent ||
      gu.manualOrder
    );
  }

  function isRangedGarrisonCandidate(u) {
    return (
      u.team === 'player' &&
      u.hp > 0 &&
      getUnitCombatRole(u) === 'ranged' &&
      !u.garrisoned &&
      !u.manualOrder &&
      !u.fleeing &&
      !u.demoralized &&
      !u.retreatingToMed &&
      !u.atMedicalTent &&
      !u.pinned
    );
  }

  function isGeneralCandidate(u) {
    return (
      u.team === 'player' &&
      u.hp > 0 &&
      u.isGeneral &&
      !u.stationedKeep &&
      !u.manualOrder &&
      !u.fleeing &&
      !u.pinned &&
      !u.rallyTargetId
    );
  }

  function foeThreatensWallManning(foe, unit, slotX, slotY) {
    if (!foe) return false;
    return unitDistSq(foe, unit) < 1600 || posDistSq(foe.x, foe.y, slotX, slotY) < 2500;
  }

  function wallFacingRotation(facing) {
    switch (facing) {
      case 'north':
        return -90;
      case 'south':
        return 90;
      case 'east':
        return 0;
      case 'west':
        return 180;
      default:
        return -90;
    }
  }

  function isWallManningExcludedUnit(u) {
    return !!(u?.isGeneral || u?.isDoomslayer || u?.isCrossover || u?.isWwe);
  }

  function isFootmanWallCandidate(u) {
    return (
      u.team === 'player' &&
      u.hp > 0 &&
      u.type === 'footman' &&
      !isWallManningExcludedUnit(u) &&
      !u.garrisoned &&
      !u.stationedKeep &&
      // Hold stance may plant manualOrder; only mid click-to-move blocks wall manning.
      !isPlayerMarchingOrder(u) &&
      !u.fleeing &&
      !u.demoralized &&
      !u.pinned &&
      !u.retreatingToMed &&
      !u.fightToDeath
    );
  }

  function ensureWallSlots(wall) {
    if (!wall || wall.type !== 'wall') return;
    const facing = wall.facing || 'north';
    const fresh = getWallSlotPositions(facing, wall.x, wall.y);
    if (!wall.wallSlots?.length) {
      wall.wallSlots = fresh;
      return;
    }
    for (let i = 0; i < fresh.length; i++) {
      fresh[i].unitId = wall.wallSlots[i]?.unitId ?? null;
    }
    wall.wallSlots = fresh;
  }

  function isMedicalTentBuilding(b) {
    return (
      !!b &&
      b.hp > 0 &&
      b.complete &&
      (b.isMedical || b.type === 'medical_tent') &&
      (b.owner === 'player' || b.owner == null)
    );
  }

  function getMedicalTentSlot(tent) {
    return { x: tent.slotX ?? tent.x, y: tent.slotY ?? tent.y - 8 };
  }

  function needsMedicalRetreat(unit) {
    return (
      unit?.team === 'player' &&
      unit.hp > 0 &&
      !unit.isDoomslayer &&
      unit.hp / unit.maxHp <= RETREAT_HP_RATIO
    );
  }

  function isSiegeableStructure(b) {
    if (!b || b.owner !== 'player' || b.hp <= 0 || b.isTrap) return false;
    if (!b.complete && !buildingBlocksTerrain(b)) return false;
    const def = BuildDefs[b.type];
    if (!def) return false;
    return true;
  }

  function structureEdgeDistance(unit, b) {
    const hitR =
      typeof getBuildingHitRadius === 'function' ? getBuildingHitRadius(b) : b.radius || 28;
    return Math.max(0, Math.hypot(b.x - unit.x, b.y - unit.y) - hitR);
  }

  function inEnemyStructureAttackRange(unit, b, opts = {}) {
    const edge = structureEdgeDistance(unit, b);
    const standoff = (unit.meleeRange || unit.range || 28) + (opts.siege ? 10 : 8);
    return edge <= standoff;
  }

  function isEnemySiegeAttacker(unit) {
    if (unit.type === 'goblin_sapper') return true;
    if (unit.type === 'siege_tower' && unit.siegeDeployed) return true;
    if (unit.type === 'iron_colossus' || unit.type === 'boss_karg' || unit.type === 'boss_volk')
      return true;
    if (unit.combatType === 'siege' && (unit.siegeMult || 1) >= 2.5) return true;
    return false;
  }

  function calcEnemySiegeDamage(unit, b) {
    if (unit.type === 'siege_tower' && unit.siegeDeployed) return 18;
    if (unit.type === 'goblin_sapper') {
      return b.isHamlet ? 32 : b.isMerchantGuild ? 26 : 28;
    }
    let dmg = Math.floor((unit.damage || 20) * (unit.siegeMult || 2.5) * 0.5);
    if (b.isHamlet) dmg = Math.floor(dmg * 1.2);
    if (b.isMerchantGuild) dmg = Math.floor(dmg * 1.1);
    if (b.type === 'wall') dmg = Math.floor(dmg * 0.95);
    return Math.max(14, dmg + Math.floor(Math.random() * 4));
  }

  function isBuildingPathTarget(id) {
    return typeof id === 'string' && id.startsWith('bld:');
  }

  function getTotalStarCount(unit) {
    return (
      (unit.vetBronze || 0) +
      (unit.vetSilver || 0) * 3 +
      (unit.vetGold || 0) * 9 +
      (unit.generalStars || 0) * 9
    );
  }

  function countBuilderProjects(builder) {
    let n = 0;
    if (builder.building && !builder.building.complete && !builder.building.pending) n++;
    if (builder.building?.pending) n++;
    if (builder.buildQueue?.length) n += builder.buildQueue.length;
    if (builder.repairTarget) n++;
    return n;
  }

  function assignBuildingToBuilder(builder, b) {
    if (!builder || !b) return;
    // Never overwrite an active project or pending march site — queue instead.
    if (!builder.building || builder.building.complete) {
      builder.building = b;
    } else if (!builder.buildQueue) {
      builder.buildQueue = [b];
    } else {
      builder.buildQueue.push(b);
    }
  }

  function builderHasWork(unit) {
    return !!(
      unit.building?.pending ||
      (unit.building && !unit.building.complete) ||
      unit.buildQueue?.length ||
      unit.repairTarget
    );
  }

  function markUpdatePhase(phase, detail) {
    if (typeof ErrorReporting !== 'undefined' && ErrorReporting.markPhase) {
      ErrorReporting.markPhase(phase, detail);
    }
  }

  function getQuickSaveMeta() {
    try {
      const raw = localStorage.getItem(QUICKSAVE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      const army = Array.isArray(snap.units)
        ? snap.units.filter((u) => u.team === 'player').length
        : null;
      return {
        wave: snap.wave,
        savedAt: snap.savedAt,
        tactical: snap.tactical,
        timeOfDay: snap.timeOfDay,
        kills: snap.kills,
        army,
        thumbnail: snap.thumbnail || null,
      };
    } catch (_) {
      return null;
    }
  }

  function hasQuickSave() {
    return !!getQuickSaveMeta();
  }

  return {
    cameraKeys,
    unitCounts,
    QUICKSAVE_KEY,
    DECO_GAP,
    UNIT_COLLISION,
    MELEE_STANDOFF,
    FELLOWSHIP_MORALE_HIGH_RATIO,
    MARTIAL_MELEE_FOCUS_RATIO,
    DRAGON_THEMED_ABILITIES,
    STAND_ALLIANCE_MIN_HEROES,
    KI_ENERGY_HIGH_RATIO,
    SHOWMANSHIP_HEAVY_MIN_UNITS,
    SHOWMANSHIP_HEAVY_RATIO,
    KI_ENERGY_ABILITIES,
    tacticalFoeCap,
    tacticalFoeBest,
    tacticalFoeBestD,
    svc,
    playSfx,
    wireGameServices,
    clampCameraAxis,
    getPanelInsets,
    setCameraKey,
    unitFootprint,
    overlapsPlacedDecorations,
    isPlayerFriendlyWall,
    isPlayerMarchingOrder,
    clearHoldPost,
    hasHoldPost,
    distToHoldPost,
    enemyIsAdvancing,
    getGfxQuality,
    spatialScratchQuery,
    releaseUnitRecord,
    releaseBuildingRecord,
    isKiEnergyCombatUnit,
    sampleKiEnergyArmy,
    isHeroUnit,
    sampleShowmanshipArmy,
    isMajorBossUnit,
    isDragonThemedUnit,
    sampleCrossoverHeroAlliance,
    getUnitCombatRole,
    sampleMeleeFocusedArmy,
    isMoraleCombatUnit,
    samplePlayerArmyMorale,
    moraleBreakThreshold,
    isValidCombatFoe,
    clearUnitPathAsync,
    releaseCombatPursuit,
    countActiveEnemies,
    isMeleeCombat,
    getGeneralBuffStrengthLegacy,
    getAdvancedMods,
    getFogVisionMult,
    gameRandom,
    countGarrisoned,
    countPlayerHamlets,
    countPlayerGuilds,
    getCrossoverBuildingsOnField,
    getWweOnField,
    getCrossoverOnField,
    ensurePlayerUnitDef,
    getHamletTpBonus,
    getMerchantGuildTpBonus,
    getRawSettlementTpBonus,
    getSettlementTpBonus,
    getEnemyEconomySpawnBonus,
    ensureBuildingHealth,
    getEnemyEconomyHpMult,
    isEnemyEconomyUnderConstruction,
    bootstrapEnemyEconomyForWave,
    countEnemies,
    applyCreativeUnitStats,
    applyCreativeUnitPreset,
    specialistStarColor,
    unitDistance,
    unitDistSq,
    posDistSq,
    getApproachPoint,
    slotAngleOffset,
    getMeleeRing,
    trimFoeListToNearest,
    canDeployWithTP,
    getDeployCostMult,
    enemyRotationForSide,
    isUnitProducingBuilding,
    countLivePlayerUnits,
    isPlayerEliminated,
    announceRtsEra,
    allowsCampaignEconomyVictory,
    getRunModeId,
    tryPlaceEnemyBuilding,
    updateEnemyEconomy,
    updateEnemyRTS,
    pathClearanceForUnit,
    unitBlocksMovement,
    getSpawnFillSeed,
    normalizeGameSpeed,
    hasCourier,
    getBuildingRefund,
    manualMoveReached,
    getHamletFortressWallLayout,
    strikeImpactFx,
    isPlayerMageUnit,
    isBehindWall,
    countPlayerWalls,
    countPlayerFortifications,
    shouldReleaseOutpostGarrison,
    isRangedGarrisonCandidate,
    isGeneralCandidate,
    foeThreatensWallManning,
    wallFacingRotation,
    isWallManningExcludedUnit,
    isFootmanWallCandidate,
    ensureWallSlots,
    isMedicalTentBuilding,
    getMedicalTentSlot,
    needsMedicalRetreat,
    isSiegeableStructure,
    structureEdgeDistance,
    inEnemyStructureAttackRange,
    isEnemySiegeAttacker,
    calcEnemySiegeDamage,
    isBuildingPathTarget,
    getTotalStarCount,
    countBuilderProjects,
    assignBuildingToBuilder,
    builderHasWork,
    markUpdatePhase,
    getQuickSaveMeta,
    hasQuickSave,
  };
})();

globalThis.GameCore = GameCore;
