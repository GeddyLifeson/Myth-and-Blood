/// <reference path="./types.d.ts" />

/**
 * Central game lifecycle event bus — decouples systems from direct callback chains.
 * Source: src/game-events.ts — compile with npm run build:ts
 */
class GameEventsSystem {
  static readonly GameEvent = Object.freeze({
    GAME_START: 'gameStart' as GameEventName,
    GAME_END: 'gameEnd' as GameEventName,
    WAVE_CLEARED: 'waveCleared' as GameEventName,
    NIGHT_BEGIN: 'nightBegin' as GameEventName,
    DAY_BEGIN: 'dayBegin' as GameEventName,
    WAVE_START: 'waveStart' as GameEventName,
    BOSS_SLAIN: 'bossSlain' as GameEventName,
    ENEMY_SLAIN: 'enemySlain' as GameEventName,
    BARRACKS_COMPLETE: 'barracksComplete' as GameEventName,
  });

  private _listeners = new Map<string, GameEventListener[]>();

  get GameEvent(): typeof GameEventsSystem.GameEvent {
    return GameEventsSystem.GameEvent;
  }

  on(event: string, handler: GameEventHandler, priority = 0): this {
    if (!event || typeof handler !== 'function') return this;
    this._add(event, handler, priority, false);
    return this;
  }

  once(event: string, handler: GameEventHandler, priority = 0): this {
    if (!event || typeof handler !== 'function') return this;
    this._add(event, handler, priority, true);
    return this;
  }

  off(event: string, handler?: GameEventHandler): this {
    if (!event) return this;
    if (!handler) {
      this._listeners.delete(event);
      return this;
    }
    const list = this._listeners.get(event);
    if (!list) return this;
    const next = list.filter((entry) => entry.fn !== handler);
    if (next.length) this._listeners.set(event, next);
    else this._listeners.delete(event);
    return this;
  }

  emit(event: string, payload?: unknown): this {
    const list = this._listeners.get(event);
    if (!list?.length) return this;
    const sorted = [...list].sort((a, b) => b.priority - a.priority);
    const keep: GameEventListener[] = [];
    for (const entry of sorted) {
      try {
        entry.fn(payload);
      } catch (err) {
        console.error(`[GameEvents] ${event} handler failed:`, err);
      }
      if (!entry.once) keep.push(entry);
    }
    if (keep.length) this._listeners.set(event, keep);
    else this._listeners.delete(event);
    return this;
  }

  clear(event?: string): this {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
    return this;
  }

  listenerCount(event?: string): number {
    if (event) return this._listeners.get(event)?.length ?? 0;
    let n = 0;
    for (const list of this._listeners.values()) n += list.length;
    return n;
  }

  private _add(event: string, handler: GameEventHandler, priority: number, once: boolean): void {
    const list = this._listeners.get(event) ?? [];
    if (list.some((entry) => entry.fn === handler)) return;
    list.push({ fn: handler, priority, once });
    this._listeners.set(event, list);
  }
}

const GameEvents = new GameEventsSystem();
/** @deprecated alias — prefer GameEvents.GameEvent */
const GameEvent = GameEventsSystem.GameEvent;

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
(globalThis as Record<string, unknown>).GameEvents = GameEvents;
