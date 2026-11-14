/**
 * Helpers for the save tests: boot a headless game, play the honest bot to a point,
 * and take a normalised snapshot of the live run for deep comparison.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from '../headless-manifest.mjs';
import { boot } from './harness.mjs';

const sources = new Map();
function source(extra) {
  const key = extra.join(',');
  if (!sources.has(key)) {
    const files = [...HEADLESS_FILES, ...extra];
    sources.set(key, files.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n'));
  }
  return sources.get(key);
}

const NAMES = [
  'Game',
  'GameState',
  'SpriteGen',
  'UnitDefs',
  'SaveRegistry',
  'SaveFormat',
  'SiegeLoop',
  'GameModes',
  'PlayerCounterEvolution',
  'FactionReputation',
  'NeutralRelations',
  'OnlineMultiplayer',
];

/**
 * A fresh sandbox with the game loaded and initialised (not started).
 * opts.extra: more js/ files to load after the headless set (e.g. ['save.js']).
 * opts.quota: byte limit for localStorage (setItem throws past it), to test full storage.
 */
export function bootGame(seed = 7, opts = {}) {
  const { sb, cvs } = boot(seed);
  const store = new Map();
  const quota = { limit: opts.quota ?? Infinity };
  const used = (skip) => {
    let n = 0;
    for (const [k, v] of store) if (k !== skip) n += k.length + v.length;
    return n;
  };
  sb.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      const s = String(v);
      if (used(k) + k.length + s.length > quota.limit) {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        throw e;
      }
      store.set(k, s);
    },
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  const extra = opts.extra || [];
  const names = [...NAMES, ...(opts.names || [])];
  const out = vm.runInContext(
    `${source(extra)}\n({ ${names.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : null`).join(', ')} })`,
    vm.createContext(sb)
  );
  out.SpriteGen.prewarmCache = () => {};
  out.Game.init(cvs);
  return { ...out, GS: out.GameState, sb, store, quota, cvs };
}

const ROSTER = ['footman', 'archer', 'footman', 'archer', 'healer', 'mage', 'footman', 'knight'];

/**
 * Play the bot until `stop(state, ticksInPhase)` is true. Returns false if the run ended or
 * the tick budget ran out first. The bot also fields a Builder and starts a Medical Tent.
 */
export function playUntil(g, stop, maxTicks = 60000) {
  const { Game, UnitDefs } = g;
  const bot = (g.bot ||= { next: 0, deployed: 0, tent: 0, tries: 0, phase: '', phaseTicks: 0 });
  for (let t = 0; t < maxTicks && Game.isPlaying(); t++) {
    const s = Game.getState();
    if (s.timeOfDay !== bot.phase) {
      bot.phase = s.timeOfDay;
      bot.phaseTicks = 0;
    }
    bot.phaseTicks++;
    if (stop(s, bot.phaseTicks)) return true;
    if (s.timeOfDay === 'night') {
      const type = ROSTER[bot.next % ROSTER.length];
      const cost = UnitDefs[type]?.cost ?? 99;
      if (bot.tent < 2 && s.canDeploy && bot.deployed >= 4) {
        if (bot.tent === 0 && s.tactical >= (UnitDefs.builder?.cost ?? 99) + 5) {
          Game.selectDeploy('builder');
          Game.handleClick(640, 600);
          bot.tent = 1;
        } else if (bot.tent === 1 && s.tactical >= 5 && bot.tries < 40) {
          Game.selectBuild('medical_tent');
          if (Game.handleClick(560 - (bot.tries % 8) * 14, 610 - (bot.tries % 3) * 12)) bot.tent = 2;
          else if (++bot.tries >= 40) bot.tent = 2;
        } else if (t % 20 === 0) Game.beginDayPhase(true);
      } else if (s.canDeploy && s.tactical >= cost && bot.deployed < 40) {
        const before = s.army ?? 0;
        Game.selectDeploy(type);
        Game.handleClick(480 + ((bot.deployed * 37) % 320), 520 + ((bot.deployed * 53) % 90));
        if ((Game.getState().army ?? 0) > before) bot.deployed++;
        bot.next++;
      } else if (t % 20 === 0) Game.beginDayPhase(true);
    }
    Game.update();
  }
  return false;
}

// GS fields that are caches, camera, pointer and selection state, or handles: never saved.
const GS_TRANSIENT = new Set([
  '_gameEventBusWired',
  'activeDragThreshold',
  'auraCache',
  'auraCacheFrame',
  'baseViewScale',
  'boxSelect',
  'cachedSelectedSet',
  'cachedSelectionSig',
  'cameraPlaced',
  'cameraWorldX',
  'cameraWorldY',
  'cameraZoom',
  'canvas',
  'castleAnchorTick',
  'colonySnapshot',
  'creativeCustomWave',
  'creativeMode',
  'creativeSettings',
  'creativeSettingsSigCache',
  'creativeSettingsSigTick',
  'creativeSpawnType',
  'creativeTool',
  'ctx',
  'dayLightCache',
  'dayLightTick',
  'dragMoved',
  'engagerCacheFrame',
  'evolutionMeterCache',
  'evolutionMeterTick',
  'gameSpeed',
  'gsCtxCache',
  'gsCtxFrame',
  'hudRevision',
  'hudRevisionSig',
  'igCtxCache',
  'igCtxFrame',
  'incompleteBuildSig',
  'isPanning',
  'kingdomStageCache',
  'kingdomStageTick',
  'lastSimWallMs',
  'liveColonyCache',
  'livingPlanetCtxCache',
  'livingPlanetCtxTick',
  'losObstaclesCache',
  'messages',
  'moveBuildingTarget',
  'moveMarkers',
  'obstaclesCache',
  'obstaclesDirty',
  'panAnchor',
  'pathBudgetWarnSuppressed',
  'pathBudgetWarnTick',
  'pathfindBudget',
  'paused',
  'pendingWallFacing',
  'pointerScreen',
  'presentationFrame',
  'selectedAbility',
  'selectedBuild',
  'selectedCourierMsg',
  'selectedDemolish',
  'selectedDeploy',
  'selectedMoveBuilding',
  'selectedRotateWall',
  'selectedUnitId',
  'selectedUnitIds',
  'selectionFormation',
  'snapCacheTick',
  'sortedUnitsCache',
  'sortedUnitsFrame',
  'spatialFrame',
  'spatialStaticDirty',
  'speedAccumulator',
  'stateFrameCache',
  'stateFrameId',
  'syncPathfindsThisTick',
  'tacticalCacheFrame',
  'thematicSynSnapCache',
  'thematicSynSnapTick',
  'unitByIdFrame',
  'updateThrottleCtx',
  'updateTick',
  'viewScale',
  'viewX',
  'viewY',
  'visibleBoundsCore',
  'walkGridRebuildDue',
  'walkGridRebuildTick',
  // Short-lived by rule: reset on load (see applySnapshot).
  'moraleCascadeState',
  'huntFront',
  'huntSweep',
  'huntQuietTicks',
  // Rebuilt from the buildings on load.
  'enemyEconomyEverSpawned',
  'northernHoldEverSpawned',
]);

// Unit fields that are not saved by rule: paths are recomputed, building links are saved as ids.
const UNIT_TRANSIENT = new Set([
  'path',
  'pathIndex',
  'pathRecalc',
  'pathPending',
  'pathReqId',
  'pathWaitTicks',
  'postPath',
  'postPathIndex',
  'building',
  'buildQueue',
  // Drawing state only.
  'frame',
  'frameTimer',
  'hitFlash',
  'hitFlashMax',
  'blockFlash',
]);

function plain(v, depth = 0) {
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object') {
    return typeof v === 'number' && !Number.isFinite(v) ? String(v) : v;
  }
  if (depth > 8) return '[deep]';
  if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
  if (Object.prototype.toString.call(v) === '[object Set]') return { $set: [...v].sort() };
  if (Object.prototype.toString.call(v) === '[object Map]') return { $map: [...v] };
  if ('spriteType' in v && 'id' in v) return { $unit: v.id };
  const out = {};
  for (const k of Object.keys(v).sort()) {
    if (typeof v[k] === 'function' || v[k] === undefined) continue;
    out[k] = plain(v[k], depth + 1);
  }
  return out;
}

function entity(e, skip) {
  const out = {};
  for (const k of Object.keys(e).sort()) {
    if (skip.has(k)) continue;
    const v = e[k];
    if (typeof v === 'function' || v === undefined) continue;
    out[k] = plain(v);
  }
  return out;
}

/**
 * Everything about the live run that a save must carry, read straight from the game (not
 * through the exporter), in a stable order. Two games in the same state give equal output.
 */
export function normalise(g) {
  const { GS, Game } = g;
  const gs = {};
  for (const k of Object.keys(GS).sort()) {
    if (GS_TRANSIENT.has(k)) continue;
    if (['units', 'buildings', 'projectiles', 'decorations'].includes(k)) continue;
    const v = GS[k];
    if (typeof v === 'function') continue;
    gs[k] = plain(v);
  }
  const byId = (a, b) => String(a.id).localeCompare(String(b.id));
  const units = GS.units.filter((u) => u.hp > 0).map((u) => {
    const out = entity(u, UNIT_TRANSIENT);
    out.$buildTarget = u.building?.id || null;
    out.$buildQueue = (u.buildQueue || []).map((q) => q.id || `${q.type}@${q.x},${q.y}`);
    return out;
  });
  const away = (g.PlayerCounterEvolution?.getAwayUnits?.() || []).map((u) =>
    entity(u, UNIT_TRANSIENT)
  );
  return {
    gs,
    units: units.sort(byId),
    away: away.sort(byId),
    buildings: GS.buildings.map((b) => {
      const out = entity(b, new Set());
      if (out.wallSlots) out.wallSlots = out.wallSlots.map((s) => ({ ...s }));
      return out;
    }).sort(byId),
    decorations: GS.decorations.map((d) => entity(d, new Set())),
    projectiles: GS.projectiles.map((p) => entity(p, new Set())),
    modules: g.SaveRegistry.saveAll(),
    session: plain(g.GameModes?.getSession?.() || null),
    rng: g.GameModes?.getRngState?.() ?? null,
    difficulty: Game.getDifficulty?.() ?? null,
  };
}

/** Paths at which two JSON-like values differ (at most `limit`), for readable failures. */
export function diff(a, b, path = '', out = [], limit = 40) {
  if (out.length >= limit) return out;
  if (a === b) return out;
  // A field that is absent on one side and empty (0, false, null) on the other is the same
  // state: creating a unit fills in defaults that an idle unit never had written.
  const empty = (v) => v === undefined || v === null || v === 0 || v === false;
  if ((a === undefined || b === undefined) && empty(a) && empty(b)) return out;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) {
    out.push(`${path || '(root)'}: ${JSON.stringify(a)?.slice(0, 80)} -> ${JSON.stringify(b)?.slice(0, 80)}`);
    return out;
  }
  if (ta === 'array') {
    if (a.length !== b.length) out.push(`${path}.length: ${a.length} -> ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out, limit);
    return out;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    diff(a[k], b[k], path ? `${path}.${k}` : k, out, limit);
  }
  return out;
}
