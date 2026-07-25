/**
 * Explicit mutable run-state holder for the Game closure.
 *
 * js/game.js was historically a single IIFE whose ~160 mutable `let` bindings were
 * reachable only from inside that closure. That made every subsystem (units, combat,
 * render, waves…) impossible to move into its own file: any extracted function lost
 * access to the run state it reads and writes.
 *
 * This object breaks that seam. game.js binds it as `GS` and every former closure
 * binding now lives here as a property, so a function that touches run state can be
 * relocated to another script and still reach it via `GameState`.
 *
 * Loaded as a classic script BEFORE js/game.js.
 *
 * Note: this is a plain holder, not an API. Property *names* are the contract;
 * initial values are assigned by game.js at closure-init time in the original
 * declaration order, so evaluation order and inter-dependencies are preserved.
 */
const GameState = {};

globalThis.GameState = GameState;
