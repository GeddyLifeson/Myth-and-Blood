/**
 * Shared ambient types for gradual TypeScript migration.
 * Declaration-only — no JS emit (see src/*.ts implementations).
 */

/** Embedded fallback from js/game-data-bundle.js (script-tag global). */
declare const GameDataBundle: GameDataPack;

/**
 * Registry keys for GameServices.
 * Globals scanned at boot come from GameServicesSystem.SERVICE_IDS (single
 * source of truth — add new module ids there, in src/game-services.ts).
 * The ids below are registered explicitly by setContext() / registerDefs().
 */
type ServiceId =
  | (typeof GameServicesSystem.SERVICE_IDS)[number]
  | 'ctx'
  | 'UnitDefs'
  | 'BuildDefs'
  | 'EnemyDefs'
  | 'Abilities'
  | 'SpyActions'
  | 'fxLife'
  | 'synergies';

type GameEventName =
  | 'gameStart'
  | 'gameEnd'
  | 'waveCleared'
  | 'nightBegin'
  | 'dayBegin'
  | 'waveStart'
  | 'bossSlain'
  | 'enemySlain'
  | 'barracksComplete';

type WaveStartPhase = 'prep' | 'assault';

/** Minimal defs — tighten as units/buildings migrate to TS. */
interface UnitDef {
  name: string;
  cost?: number;
  hp?: number;
  [key: string]: unknown;
}

interface BuildingDef {
  name: string;
  cost?: number;
  hp?: number;
  [key: string]: unknown;
}

interface EnemyDef {
  name: string;
  hp?: number;
  [key: string]: unknown;
}

interface AbilityDef {
  name: string;
  cost: number;
  [key: string]: unknown;
}

interface SpyActionDef {
  name: string;
  cost: number;
  desc: string;
}

interface SynergyDef {
  id: string;
  factions: string[];
  name: string;
  desc: string;
  bonus: Record<string, number>;
  requiresOtherFaction?: boolean;
  requiresWwe?: boolean;
  minFactions?: number;
}

interface StrikesPack {
  abilities?: Record<string, AbilityDef>;
  spyActions?: Record<string, SpyActionDef>;
  fxLife?: Record<string, number>;
}

interface GameDataPack {
  units?: Record<string, UnitDef>;
  buildings?: Record<string, BuildingDef>;
  enemies?: Record<string, EnemyDef>;
  abilities?: Record<string, AbilityDef>;
  spyActions?: Record<string, SpyActionDef>;
  fxLife?: Record<string, number>;
  synergies?: SynergyDef[];
  strikes?: StrikesPack;
}

interface GameDefsRegistration {
  units?: Record<string, UnitDef>;
  buildings?: Record<string, BuildingDef>;
  enemies?: Record<string, EnemyDef>;
  abilities?: Record<string, AbilityDef>;
  spyActions?: Record<string, SpyActionDef>;
  fxLife?: Record<string, number>;
  synergies?: SynergyDef[];
}

/** Minimal locator surface on GameContext (avoids circular class refs). */
interface GameServicesLike {
  get(id: string): unknown;
  register(id: string, service: unknown): unknown;
  setContext(ctx: GameContext): unknown;
}

/** Bound runtime context passed to depth / expansion systems. */
interface GameContext {
  services: GameServicesLike | null;
  svc: (id: string) => unknown;
  readonly units: unknown[];
  readonly buildings: unknown[];
  readonly wave: number;
  readonly tactical: number;
  showMessage?: (text: string, duration?: number) => void;
  [key: string]: unknown;
}

type GameEventHandler = (payload?: unknown) => void;

interface GameEventListener {
  fn: GameEventHandler;
  priority: number;
  once: boolean;
}
