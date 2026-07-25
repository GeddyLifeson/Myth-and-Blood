/// <reference path="./types.d.ts" />

/**
 * Service locator — resolve game modules without scattered global typeof checks.
 * Source: src/game-services.ts — compile with npm run build:ts
 */
class GameServicesSystem {
  /**
   * Single source of truth for the globals scanned by registerFromGlobals().
   * `ServiceId` in src/types.d.ts is derived from this array — add ids here only.
   *
   * Every id here must be published by some js/ module (`globalThis.X = X;`).
   * Nine ids that no module backed were removed: the six shelved macro layers
   * (GrandStrategy, GrandStrategyMidBranches, IntergalacticLayer,
   * IntergalacticLateBranches, PlanetWarfare, PlanetConquest — see
   * scripts/verify-shelved-macro.mjs, which asserts those files stay deleted),
   * plus Effects, WWE and Crossover, whose files declare CombatFX, WweAcademy
   * and CrossoverHub respectively and which had zero `svc()` call sites. The
   * shelved-macro ids still have guarded `svc('PlanetWarfare') && …` call sites
   * in game.js; those already resolved to null and continue to.
   * 'Research' was also listed twice.
   */
  static readonly SERVICE_IDS = [
    'Game',
    'GameData',
    'GameEvents',
    'GameDepth',
    'GameModes',
    'GameServices',
    'ColonyValue',
    'StrategyCounterplay',
    'FactionDepth',
    'ContentExpansion',
    'NeutralWildlife',
    'NeutralRelations',
    'BiomeSpawn',
    'OperativeSkillTrees',
    'Pathfinding',
    'PathfindingCore',
    'PathWorkerBridge',
    'WaveCompositionCore',
    'Spatial',
    'EntityPool',
    'UpdateThrottle',
    'SpriteLod',
    'GfxQuality',
    'Settings',
    'LivingPlanet',
    'AdvancedDifficulty',
    'EnemyFactions',
    'Research',
    'CrownLegacies',
    'EternalLegacyTree',
    'AscensionSystem',
    'ThematicEraSynergies',
    'HybridPowerFantasy',
    'NarrativeThread',
    'TechTreeBranches',
    'EternalPathFramework',
    'MartialPathEvolution',
    'ArcanePathEvolution',
    'TechPathEvolution',
    'MythicPathEvolution',
    'FoundationalMedievalLayer',
    'DynamicMapEvents',
    'Legacy',
    'Chronicles',
    'StoryLore',
    'AsymmetricWarfare',
    'SettlementRaids',
    'FactionReputation',
    'PlayerCounterEvolution',
    'MonsterBosses',
    'MultiFrontSiege',
    'FactionIntel',
    'FactionHazards',
    'Perks',
    'Cheats',
    'ModLoader',
    'ModAPI',
    'Cosmetics',
    'OnlineMultiplayer',
    'MetaProgress',
    'Achievements',
    'AudioEngine',
    'StrikeFX',
    'FloatingText',
    'SpriteGen',
    'VisualPolish',
    'Particles',
    'SaveManager',
    'UI',
    'UX',
    'Perf',
    'Tooltips',
    'Encyclopedia',
    'CreativeTools',
    'TouchInput',
  ] as const;

  private _services = new Map<string, unknown>();
  private _ctx: GameContext | null = null;

  register(id: string, service: unknown): this {
    if (id != null && service != null) this._services.set(id, service);
    return this;
  }

  get<T = unknown>(id: string): T | null {
    return (this._services.get(id) as T | undefined) ?? null;
  }

  has(id: string): boolean {
    return this._services.has(id);
  }

  require<T = unknown>(id: string): T {
    const s = this.get<T>(id);
    if (s == null) throw new Error(`GameServices: missing "${id}"`);
    return s;
  }

  get ctx(): GameContext | null {
    return this._ctx;
  }

  setContext(ctx: GameContext): this {
    this._ctx = ctx;
    if (ctx) this.register('ctx', ctx);
    return this;
  }

  /**
   * Register every module listed in SERVICE_IDS that is present on `scope`.
   *
   * This used to fall back to `globalThis.eval("typeof X !== 'undefined' ? X : null")`
   * for each id, because a top-level `const X = ...` in a classic script lives in the
   * global *lexical* environment and never becomes a property of globalThis — so a
   * plain `scope[id]` lookup found nothing. Every module now publishes itself
   * (`globalThis.X = X;` at the end of its file), which makes the plain lookup work
   * and lets the eval go. That removes the last eval from the boot path, so the game
   * no longer needs `unsafe-eval` in a Content-Security-Policy.
   *
   * Covered by scripts/test-service-registry.mjs, which asserts the resolved id set.
   */
  registerFromGlobals(
    scope: Record<string, unknown> = globalThis as Record<string, unknown>
  ): this {
    for (const id of GameServicesSystem.SERVICE_IDS) {
      const ref: unknown = scope[id];
      if (ref != null) this.register(id, ref);
    }
    return this;
  }

  registerDefs(defs: GameDefsRegistration = {}): this {
    if (defs.units) this.register('UnitDefs', defs.units);
    if (defs.buildings) this.register('BuildDefs', defs.buildings);
    if (defs.enemies) this.register('EnemyDefs', defs.enemies);
    if (defs.abilities) this.register('Abilities', defs.abilities);
    if (defs.spyActions) this.register('SpyActions', defs.spyActions);
    if (defs.fxLife) this.register('fxLife', defs.fxLife);
    if (defs.synergies) this.register('synergies', defs.synergies);
    return this;
  }

  clear(): this {
    this._services.clear();
    this._ctx = null;
    return this;
  }
}

const GameServices = new GameServicesSystem();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
(globalThis as Record<string, unknown>).GameServices = GameServices;
