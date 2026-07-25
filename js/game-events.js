'use strict';
/// <reference path="./types.d.ts" />
/**
 * Central game lifecycle event bus — decouples systems from direct callback chains.
 * Source: src/game-events.ts — compile with npm run build:ts
 */
class GameEventsSystem {
  constructor() {
    this._listeners = new Map();
  }
  get GameEvent() {
    return GameEventsSystem.GameEvent;
  }
  on(event, handler, priority = 0) {
    if (!event || typeof handler !== 'function') return this;
    this._add(event, handler, priority, false);
    return this;
  }
  once(event, handler, priority = 0) {
    if (!event || typeof handler !== 'function') return this;
    this._add(event, handler, priority, true);
    return this;
  }
  off(event, handler) {
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
  emit(event, payload) {
    const list = this._listeners.get(event);
    if (!list?.length) return this;
    const sorted = [...list].sort((a, b) => b.priority - a.priority);
    const keep = [];
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
  clear(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
    return this;
  }
  listenerCount(event) {
    if (event) return this._listeners.get(event)?.length ?? 0;
    let n = 0;
    for (const list of this._listeners.values()) n += list.length;
    return n;
  }
  _add(event, handler, priority, once) {
    const list = this._listeners.get(event) ?? [];
    if (list.some((entry) => entry.fn === handler)) return;
    list.push({ fn: handler, priority, once });
    this._listeners.set(event, list);
  }
}
GameEventsSystem.GameEvent = Object.freeze({
  GAME_START: 'gameStart',
  GAME_END: 'gameEnd',
  WAVE_CLEARED: 'waveCleared',
  NIGHT_BEGIN: 'nightBegin',
  DAY_BEGIN: 'dayBegin',
  WAVE_START: 'waveStart',
  BOSS_SLAIN: 'bossSlain',
  ENEMY_SLAIN: 'enemySlain',
  BARRACKS_COMPLETE: 'barracksComplete',
});
const GameEvents = new GameEventsSystem();
/** @deprecated alias — prefer GameEvents.GameEvent */
const GameEvent = GameEventsSystem.GameEvent;
// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.GameEvents = GameEvents;
