# Myth and Blood audit: engine and content

Audit date 2026-11-13, repo at `ed2eae8` (main). Read-only: nothing in the repo was changed. `scripts/sim-report.json` was rewritten by the test run and restored with `git checkout -- scripts`; `git status` is clean.

Fix sizes: S = under a day, M = a few days, L = a week or more.

## How this was checked

- Read the files in scope. Ran `node scripts/run-all-tests.mjs` once.
- Wrote probes outside the repo in `/home/claude/audit/probes/` (headless VM boots using the repo's own `scripts/lib/harness.mjs`, plus three Electron runs of the real `index.html` under xvfb).
- Test result: **76 of 77 suites passed.** `headless-sim.mjs` failed on its `SLOW_UPDATE` timing check only (6 runs flagged, 7.1 ms/tick average against a committed 2.61 ms). The machine was shared with other heavy jobs, the run took 1,030 s against a normal 300 s, and all three marathons still reached wave 1000 with no logic issue. Treat it as a timing failure caused by load, and re-run on a quiet machine to confirm.

Not verified: Windows `.bat` launchers and `electron-builder` packaging; real frame rate on real hardware (xvfb is software-rendered); plain Chrome from `file://`; the GitHub Pages deploy; touch input; PvP through the menu from start to finish; each of the roughly 35 modules with per-run state for what exactly is lost on load.

---

# A. Engine

## A1. Map of js/game.js

16,741 lines, one IIFE, 474 inner functions, 160 `GS.*` fields, 894 `svc('…')` calls, 190 `typeof X !== 'undefined'` guards. There are no section banners in the file; the sections below are by function grouping.

Columns: lines, size, functions, distinct functions it calls in other sections ("out"), its functions that other sections call ("in"), `GS` fields touched.

| Lines       | Size | Fns | Out | In  | GS  | Section                                                   |
| ----------- | ---- | --- | --- | --- | --- | --------------------------------------------------------- |
| 1-330       | 330  | 0   | 0   | 0   | 146 | GameCore imports, `GS` field initialisation               |
| 331-721     | 391  | 26  | 5   | 16  | 27  | init, world size, camera, zoom                            |
| 722-945     | 224  | 12  | 8   | 5   | 24  | selection, pointer input                                  |
| 946-1352    | 407  | 14  | 10  | 8   | 16  | terrain, decorations, map growth                          |
| 1353-1786   | 434  | 17  | 11  | 12  | 18  | hold stance, posts, hunt state                            |
| 1787-2054   | 268  | 14  | 5   | 14  | 20  | obstacles, walk grids, spatial rebuild, purge dead        |
| 2055-2561   | 507  | 18  | 24  | 14  | 22  | boss/achievement checks, morale, rout, rally, `siegeCtx`  |
| 2562-2910   | 349  | 19  | 6   | 17  | 41  | day/night helpers, caches, HUD revision, unit counts      |
| 2911-3192   | 282  | 5   | 21  | 3   | 23  | victory, night phase, night recovery, dawn                |
| 3193-3358   | 166  | 8   | 1   | 8   | 8   | General aura, `calcDamage`                                |
| 3359-3711   | 353  | 13  | 10  | 12  | 22  | asymmetric/progression context, difficulty                |
| 3712-4094   | 383  | 9   | 8   | 5   | 11  | `spawnUnit`, veteran upgrades, stat mods                  |
| 4095-4266   | 172  | 13  | 4   | 12  | 6   | enemy economy, TP income, build-site checks               |
| 4267-5206   | 940  | 55  | 39  | 9   | 36  | creative mode and level snapshot API                      |
| 5207-5343   | 137  | 5   | 4   | 4   | 4   | highlights, honours, star events, `damageBuilding`        |
| 5344-5651   | 308  | 13  | 7   | 8   | 5   | range, engagers, surround slots, targeting                |
| 5652-5719   | 68   | 8   | 1   | 3   | 4   | research wrappers                                         |
| 5720-5930   | 211  | 13  | 6   | 11  | 8   | spawn sides, wave side plan, era announcements            |
| 5931-6122   | 192  | 7   | 18  | 5   | 18  | era bootstrap, narrative, boss slain, economy victory     |
| 6123-6398   | 276  | 4   | 7   | 4   | 22  | event bus wiring and emitters                             |
| 6399-6632   | 234  | 8   | 16  | 4   | 6   | settlement progress, academy training, enemy target pick  |
| 6633-6998   | 366  | 8   | 7   | 6   | 2   | terrain blocking, steering, separation, overlaps          |
| 6999-7057   | 59   | 2   | 3   | 2   | 10  | TP award, wave modifiers                                  |
| 7058-7419   | 362  | 1   | 25  | 1   | 82  | `start()`                                                 |
| 7420-7641   | 222  | 8   | 7   | 7   | 7   | spawn parameters, worker paths, colony threat             |
| 7642-8125   | 484  | 3   | 12  | 3   | 19  | `buildSpawnQueue`, counter raids                          |
| 8126-8377   | 252  | 1   | 26  | 1   | 29  | `startNextWave`                                           |
| 8378-8474   | 97   | 1   | 3   | 1   | 11  | `endGame`                                                 |
| 8475-8826   | 352  | 23  | 5   | 8   | 24  | messages, placement modes, speed, pause                   |
| 8827-9403   | 577  | 10  | 12  | 2   | 25  | spy, doctrines, expeditions, map events, courier          |
| 9404-9672   | 269  | 10  | 14  | 5   | 8   | building removal, demolish, relocate                      |
| 9673-10132  | 460  | 8   | 31  | 7   | 10  | unit pick, path orders, hunt paths, stuck recovery        |
| 10133-10478 | 346  | 4   | 10  | 2   | 8   | castle compound, `finalizeBuild`, `placeBuilding`         |
| 10479-10793 | 315  | 1   | 31  | 0   | 22  | `handleClick`                                             |
| 10794-10966 | 173  | 4   | 5   | 2   | 8   | strikes                                                   |
| 10967-11055 | 89   | 7   | 2   | 7   | 10  | line of sight, cover, wall protection                     |
| 11056-11704 | 649  | 27  | 13  | 17  | 11  | garrisons: outposts, keep, wall slots                     |
| 11705-11949 | 245  | 10  | 7   | 5   | 3   | medical retreat                                           |
| 11950-12239 | 290  | 13  | 13  | 11  | 4   | structure attack, enemy siege, siege tower                |
| 12240-12293 | 54   | 2   | 11  | 2   | 1   | foe search                                                |
| 12294-12722 | 429  | 6   | 22  | 6   | 14  | `takeDamage`, radius damage, hero AI, on-hit effects      |
| 12723-13002 | 280  | 2   | 23  | 2   | 2   | `fireWeapon`, `followPath`                                |
| 13003-13309 | 307  | 7   | 11  | 3   | 4   | healer and builder AI                                     |
| 13310-13644 | 335  | 4   | 25  | 3   | 7   | unit combat, flyer AI, enemy AI, cavalry charge           |
| 13645-13808 | 164  | 3   | 14  | 2   | 25  | day/night tick and spawner, tonic pickup, diagnostics     |
| 13809-14379 | 571  | 1   | 69  | 0   | 33  | `update()`                                                |
| 14380-15143 | 764  | 3   | 26  | 0   | 44  | presentation, `draw()`                                    |
| 15144-15563 | 420  | 10  | 22  | 1   | 20  | recruit operatives, cheats, selection info, minimap       |
| 15564-16056 | 493  | 6   | 19  | 2   | 49  | save, load, quicksave                                     |
| 16057-16126 | 70   | 4   | 0   | 2   | 9   | quit, highlights, colony                                  |
| 16127-16528 | 402  | 1   | 25  | 1   | 63  | `getState()`                                              |
| 16529-16741 | 213  | 3   | 3   | 0   | 6   | academy status, public API `return`, service registration |

Seven single functions account for 3,131 lines: `draw` 720, `update` 571, `buildSpawnQueue` 439, `getState` 402, `start` 362, `takeDamage` 334, `handleClick` 315.

### What already makes a split possible

- Run state is on `GameState` (`js/game-state.js`), bound as `GS`. Any script can read it.
- `js/game-core.js` (1,268 lines, 132 members) shows the working pattern: an IIFE loaded before `game.js`, which destructures its members at the top (`game.js:7-60`), so call sites did not change.
- `js/siege-loop.js` and `js/roster.js` show the second pattern: a module loaded before `game.js` that receives a context object (`siegeCtx`, built in `game.js` around 2440-2560) on every call.
- The build is plain concatenation in `index.html` order then `esbuild.transform` minify (`scripts/build.mjs:31-55`), so top-level names survive and load order is the only constraint. `scripts/check-manifest-sync.mjs` fails CI if `index.html`, `build-manifest.mjs` and `headless-manifest.mjs` disagree.

### What blocks it

- Closure-only state that is not on `GS`: `snapCache`, `castleAnchorCache`, `overlapNeighborsScratch`, `tacticalTargetCache`, `siegeCtx`, `CREATIVE_DEFAULTS`, camera constants (44 top-level `const`/`let` in the IIFE).
- Back-calls. A moved function that calls `showMessage`, `spawnUnit`, `takeDamage` or `setUnitPath` needs those to exist at call time. They are only called at run time, never at load time, so a late-bound table solves it.

### Ordered plan

Each step is one pull request that keeps `npm run test:all` and `node scripts/check-manifest-sync.mjs` green, adds the new file to `index.html` immediately before `game.js`, to both manifests, and runs `npm run gen:eslint-globals`.

Step 0 (S). Add `js/game-api.js`: an empty object `GameInternals = {}` loaded before every extracted module. At the end of the `game.js` IIFE, assign the inner functions other modules need (`showMessage`, `spawnUnit`, `takeDamage`, `setUnitPath`, `invalidateObstacles`, `refreshUnitCounts`, …) onto it. Extracted modules call `GameInternals.showMessage(...)`. Move the remaining closure state (`snapCache`, `castleAnchorCache`, `tacticalTargetCache`, scratch arrays) onto `GS`. No behaviour change.

Step 1 (S). Save and load, lines 15564-16056, to `js/game-save.js`. Only 2 inbound calls, and it is the piece that most needs its own tests (section A2). Needs `GS`, `createUnit`, `createBuilding`, `generateBattlefield`, `stopPostReturn`, `SiegeLoop`, `wireGameContext`.

Step 2 (M). Creative and level API, 4267-5206 (940 lines, 55 functions), to `js/game-creative.js`. Largest low-risk block: only 9 of its functions are called from elsewhere in `game.js`; the rest are reached through the public `Game.creative*` names, which stay as thin forwards.

Step 3 (S). `getState()`, 16127-16528, to `js/game-view-state.js`. Read-only, 1 inbound call. Needs 63 `GS` fields and nothing mutable.

Step 4 (M). Player commands with almost no inbound calls: spy, doctrines, expeditions, map events and courier (8827-9403) to `js/game-commands.js`; recruit, cheats, selection info, minimap (15144-15563) to `js/game-roster-ui.js`.

Step 5 (M). Camera, zoom, selection and pointer input (331-945) to `js/game-camera.js` and `js/game-input.js`. 21 inbound functions, so more forwards, but no simulation logic.

Step 6 (M). `draw()` and presentation (14380-15143) to `js/game-render.js`. No inbound calls. Split the 720-line body by layer (terrain, buildings, units, overlays, HUD marks) in the same change. The headless sim calls `Game.draw()` every fourth tick, so it is exercised.

Step 7 (M). Wave construction: spawn sides and plan (5720-5930), spawn parameters (7420-7641), `buildSpawnQueue` (7642-8125), `startNextWave` (8126-8377) to `js/game-waves.js`. Guarded by `test-enemy-wave-transition`, `test-horde-wave5`, `test-wave15-stability`, `test-siege-loop`.

Step 8 (L). Buildings and garrisons: 9404-9672, 10133-10478, 11056-11949 (about 1,500 lines) to `js/game-buildings.js` and `js/game-garrison.js`. Guarded by `test-building-combat`, `test-outpost-garrison`, `test-keep-garrison-freeze`.

Step 9 (L). Movement and combat last, because they are the most entangled (23 to 31 outbound calls each) and the hottest: steering and overlaps (6633-6998), targeting (5344-5651, 12240-12293), `takeDamage`/`fireWeapon`/`followPath` (12294-13002), unit AI (13003-13644). Do the spatial fix in A3 first so there is a performance baseline to hold.

Step 10 (M). What is left is `start`, `update`, `endGame`, the day/night cycle and the public API: about 2,500 lines. Break `update()` into named phase functions; the `markUpdatePhase` labels already in it are the seams.

Do not rename `GS` fields or `Game.*` names during the split. Saves, `scripts/` and about 100 other files use them.

## A2. Save format

Two stores, one snapshot shape.

- Quicksave: `localStorage['myth-and-blood-quicksave']`, written by `quickSave` (`game.js:16004`).
- Slots: `localStorage['myth-and-blood-saves-v1']`, three slots with an FNV checksum (`js/save.js:7-9, 59-70`).
- Co-op handoff codes carry the same snapshot, base64 (`js/online-multiplayer.js:155-220`).

**What is saved** (`exportGameState`, `game.js:15665-15775`, 49 keys): wave, TP, kills, time of day, night timer, world size, hunt flag, spawn queue and timer, horde and wave config, courier/spy/doctrine flags, wave modifiers, fallen pool, in-flight projectiles, every live unit (about 70 fields, `serializeUnitSnap` 15564-15652, including post, garrison, perks, veteran data), every building, session highlights, victory flag, research, era-restart state, advanced modifiers, mode session, and the siege-loop block (breaches, spoils taken, drafts, streaks, fallen list, intro steps; `siege-loop.js:1306-1318`). Measured size at wave 6 with 20 units: 23.5 KB; the same snapshot as a co-op code is 31,660 characters.

**Versioning.** `version: 1` is written (`game.js:15668`) and never changes. `importGameState` only tests that it is truthy (`game.js:15778`); `validateSlot` the same (`save.js:77`). There is no migration function. Old fields are patched with ad hoc `??` defaults inside the importer.

**Not saved** (confirmed by a save and load round trip in a probe, wave 6 at night):

| Missing                                                                                                                                           | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Where                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `GS.nextWavePlan`                                                                                                                                 | The flanks rolled at nightfall are thrown away on load and re-rolled at dawn. Before the load: `{wave: 7, sides: ['north']}`; after: `null`. From wave 25 the chevrons a player placed his line against can change. `nextSides` returns null, so the edge markers disappear for that night.                                                                                                                                                                                                              | set null at `game.js:15783`; rolled at 2941; used at 8162 |
| Terrain                                                                                                                                           | `generateBattlefield()` runs with `Math.random` on load. All 8 decorations moved; none of the 8 positions matched. Units are not re-seated afterwards.                                                                                                                                                                                                                                                                                                                                                   | `game.js:15830`, 1291-1300                                |
| `GS.spawnSquadLeft`                                                                                                                               | Mid-wave squad pacing resets (3 before, undefined after).                                                                                                                                                                                                                                                                                                                                                                                                                                                | `game.js:13732-13736`                                     |
| `GS.multiFrontPlan`, `waveAttackSides`, `hazards`, `nextWaveIntel`, `mapsRevealed`, `campaignNarrativeFlags`, `runStructuresRazed`, `bossTrackId` | Mid-wave flank assignments, map hazards and the intel line are lost or rebuilt differently.                                                                                                                                                                                                                                                                                                                                                                                                              | `game.js:284-313`                                         |
| Per-run state of other modules                                                                                                                    | About 35 modules have a `resetRun`/`onRunStart`; only Research, ProgressionRestarts, SiegeLoop and the mode session are in the snapshot. The importer does not reset the others either, so their state is whatever the session held before the load. Affects StoryLore choices, NarrativeThread legends, EnemyFactions, FactionReputation, NeutralRelations, DynamicMapEvents, PlayerCounterEvolution, the four path-evolution modules, and Achievements session counters. Not checked module by module. | —                                                         |
| Creative runs                                                                                                                                     | Quicksave refuses in Creative (`game.js:16005`). Levels use a separate format (`getLevelSnapshot`, 4731).                                                                                                                                                                                                                                                                                                                                                                                                | —                                                         |

**What breaks old saves.**

- A unit whose type is no longer defined is dropped silently: `createUnit` returns null and the loop continues (`game.js:15872-15874`). Probe: a save containing the example mod's Iron Guard, loaded with the mod off, returned `true` and loaded 0 of 1.
- Any rename of unit, building, operative or champion ids. This matters for the overhaul: ids such as `stone_cold`, `master_chief`, `perk_jugger_nog`, `hanma_dojo` are in saves, in `myth-and-blood-achievements-v3`, and in the meta-progress, skill-tree and cosmetics stores. Renaming them without a map loses saved units and unlocks.
- A corrupted or partial snapshot: the importer is one `try` with `catch (_) { return false }` (`game.js:15996`) after it has already cleared units and buildings, so a failed load leaves a half-built field.

**Other save defects.**

1. **The three save slots cannot be used by a new player.** An empty slot renders with no buttons (`save.js:152-155`); Save, Load and Delete are drawn only for a filled slot (160-171). The only thing that ever fills a slot is the one-time migration of an existing quicksave at first boot (`save.js:40-56`), and `saveToSlot` is not exported (203-206). Probe in Electron on a fresh profile: after a successful quicksave, `renderPauseSlots()` produced 0 buttons.
2. `saveToSlot` does not check Ironman, daily/weekly or Creative, which `quickSave` does (`game.js:16005-16012` against `save.js:100-116`). It will matter once the slots are reachable.
3. 17 separate `localStorage` keys with independent ad hoc versions; no export or import of a whole profile. The error log alone was 30 KB after one short session.

**Fixes.**

- S: save `nextWavePlan`, `multiFrontPlan`, `waveAttackSides`, `spawnSquadLeft`, `hazards`, `mapsRevealed`, `campaignNarrativeFlags`, `runStructuresRazed` in `exportGameState`/`importGameState` (`js/game.js`).
- S: save `GS.decorations` (type, x, y, hp, radius) and skip `generateBattlefield()` when present (`js/game.js`; extend `scripts/test-terrain-persistence.mjs`).
- S: give empty slots a Save button and add the Ironman/Creative guard (`js/save.js`).
- M: real versioning: bump to `version: 2`, add `migrateSnapshot(snap)` with one function per step, reject newer versions with a message, build the new field off-screen and swap only on success (`js/game.js` or the new `js/game-save.js`, `js/save.js`).
- M: an id alias table applied on load for every renamed unit/building/achievement id (`js/game-save.js`, `js/achievements.js`, `js/meta-progress.js`).
- M: `exportState`/`importState` on each module that holds run state, called from one registry, and a `resetRun` sweep before import.
- S: `scripts/test-save-roundtrip.mjs`: play to wave 6 night, export, import into a fresh context, assert plan, terrain, squad state and siege state are equal. No such test exists; `importGameState` appears in two tests, both for narrow cases.

## A3. Performance

**Method.** `scripts/headless-sim.mjs` clears waves by cheat, so its per-tick figure (2.61 ms in the committed report) measures a nearly empty field. `sim-honest-play.mjs` reaches about wave 16 in 20,000 ticks. To load high waves I used the repo harness with Creative mode: jump to the wave, place 20 to 40 troops, start the wave, time `Game.update()` only. Times are process CPU time (`process.cpuUsage`), because the machine was shared and wall-clock numbers ran two to five times higher. Caveats: no rendering cost; the harness stubs `performance.now()` to 0; in Creative the army is not reinforced, so enemies pile up, which makes this a stress case.

| Wave             | Field     | Troops placed | Peak units | Avg ms/tick | p95  | p99  | Max |
| ---------------- | --------- | ------------- | ---------- | ----------- | ---- | ---- | --- |
| 10               | 490×710   | 20            | 53         | 3.6         | 9.0  | 15.4 | 29  |
| 30               | 670×930   | 28            | 114        | 10.2        | 17.7 | 26.5 | 66  |
| 60               | 940×1260  | 28            | 143        | 9.7         | 19.8 | 29.3 | 38  |
| 60 (2,000 ticks) | 940×1260  | 28            | 179        | 12.0        | 22.1 | 33.9 | 63  |
| 95               | 1210×1590 | 28            | 217        | 11.0        | 23.3 | 40.0 | 129 |
| 150              | 1300×1700 | 40            | 154        | 8.0         | 17.1 | 24.2 | 164 |

Waves 10 and 30 ran 3,000 ticks, the rest 1,500 unless noted. The budget for 60 ticks per second is 16.7 ms including drawing. From about 110 units the 95th percentile tick is already over budget with nothing drawn. The speed button offers up to 10×; `getSimulationSteps` caps steps per frame at 2 above 150 units (`game.js:8642-8654`), so high speeds silently stop working in large fights. Draw with a stub canvas measured 0.3 ms at waves 10 and 30, which says nothing about real raster cost.

**Hottest paths** (V8 CPU profile, wave 60, 2,000 ticks, 48.6 s sampled):

| Share (inclusive) | Function                             | Location                         |
| ----------------- | ------------------------------------ | -------------------------------- |
| 91.6%             | `update`                             | `game.js:13809`                  |
| 54.9%             | `updateEnemyAI`                      | `game.js:13441`                  |
| 45.3%             | `Spatial.queryRadiusInto`            | `spatial.js:295`                 |
| 40.2%             | `forCellsInMap` (21.1% self)         | `spatial.js:254`                 |
| 27.2%             | `findEnemyMoveTarget`                | `game.js:6584`                   |
| 21.0%             | `findTacticalTarget`                 | `game.js:5508`                   |
| 17.5%             | `setUnitPath`                        | `game.js:9699`                   |
| 14.6%             | `getSurroundSlot`                    | `game.js:5444`                   |
| 13.5%             | `isTerrainBlockedAt`                 | `game.js:6633`                   |
| 13.0%             | `toCell` (self)                      | `spatial.js:26`                  |
| 10.3%             | `findNearestFoeInRange`              | `game.js:12240`                  |
| 9.2%              | `findNearestPlayer` → `queryNearest` | `game.js:5625`, `spatial.js:311` |
| 5.2%              | garbage collector                    | —                                |

Why the spatial index is the cost:

- Buckets are a `Map` keyed by the string `cx + ',' + cy` (`spatial.js:22-24`). Every cell visit builds a string and hashes it.
- `toCell` allocates a new object on each call, twice per query (`spatial.js:26-34`, `255-256`).
- Enemy target searches use radii of 450 to 520 px against a 64 px cell (`game.js:5515-5518`, `5627-5630`): about 15×15 = 225 cells per query, over both the static map and the unit map, with a closure and a `Set` for de-duplication (`spatial.js:282-304`).
- `isTerrainBlockedAt` asks for everything in range, units included, then filters to buildings and decorations in the predicate (`game.js:6636-6641`). It is called from `getSurroundSlot` for every candidate slot.
- An enemy without a target runs `findEnemyMoveTarget` → `findTacticalTarget` → `findNearestPlayer`, two or three wide queries, every tick. `UpdateThrottle.shouldRunUnitAI` exists (`update-throttle.js:64`) and nothing calls it.

**Fixes.**

- S: `js/spatial.js`: integer cell index (`cx + cy * gridW`) into flat arrays, no object from `toCell`, separate entry points for static-only and units-only queries, a per-team unit grid. Use the static-only query in `isTerrainBlockedAt`. Expect most of the 45% back. `scripts/test-spatial.mjs` covers behaviour.
- S: retarget an enemy that has no target every 6 to 10 ticks, staggered by unit id, and cache `findPlayerGeneral()` once per tick (`js/game.js:13441`, `6584`, `3193`).
- M: `getSurroundSlot` (`game.js:5444`): compute ring slots once per target per tick.
- S: add a loaded-field benchmark to `scripts/` (the probe above: Creative, fixed seed, waves 30/60/95, CPU time) and gate on it in place of the wall-clock `SLOW_UPDATE` check, which failed today from machine load alone.

**Determinism, found while profiling.** AI detail depends on the camera and the graphics tier: `getUnitTier` gives off-screen units reduced or "distant" AI (`update-throttle.js:28-56`, used at `game.js:14069`). Game logic in `game.js` calls `Math.random()` 62 times and the seeded `gameRandom()` 22 times (for example target choice at `game.js:6602` and `6614`). Seed Run, the daily and weekly challenges and PvP by seed are therefore not reproducible. Fix (M): seeded RNG for all simulation rolls, throttle by distance to the nearest opposing unit instead of the camera.

## A4. Multiplayer, level editor, Creative, mods after the combat rebuild

| System             | Result                                                                         | Evidence                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creative mode      | Works.                                                                         | Headless: start, 9,999 TP, spawn troops including Crossbowman, custom wave "goblin x10, orc x5, troll x1" parsed to 16 and cleared in 943 ticks, jump to wave 49 and start wave 50 (boss wave, 153 enemies), all 8 templates applied and ran 300 ticks each, no errors. Real page: the same through the DOM buttons. |
| Level editor       | Works.                                                                         | Real page: save to library, clear all (2 units → 0), load (→ 2), undo (→ 0), playtest. Headless: snapshot and reload, version check rejects `v: 99`.                                                                                                                                                                 |
| Mods               | Work, with gaps.                                                               | Headless: `injectMod` of `mods/example-legion` registered `iron_guard` and `iron_bastion`; the unit deployed for 6 TP, fought and scored kills. Electron from `file://`: catalog loaded, ticking the checkbox loaded the mod and added its deploy button.                                                            |
| Online multiplayer | No networking. Co-op turn passing is broken. PvP scoring uses the old formula. | Below.                                                                                                                                                                                                                                                                                                               |

**Creative gaps.** The "Lab Rat" achievement cannot be earned (B1). Achievement TP rewards call `Game.creativeAddTp` in normal runs and print "Creative: +25 TP" (`achievements.js:193-203`, `game.js:4581`). Fix S.

**Mod gaps.**

- A mod unit has no roster profile: `Roster` returned no role, trait or weakness for `iron_guard`, so the unit panel has nothing to show. Fix S: default profile derived from `type` in `js/roster.js`, or accept `role`/`trait`/`weakness` in the mod's `units.json` (`js/mod-loader.js:149`).
- A save holding mod units loads with them deleted and no warning when the mod is off (A2). Fix S: record enabled mod ids in the snapshot and warn.
- Mods load by `fetch` (`mod-loader.js:295-299, 400-413`). It worked in Electron. In a desktop browser opened from `file://` (the README's "Browser" quick start) it normally fails; not tested.
- `ModAPI` offers `onLoad`, `onGameStart`, `registerUnitStyle` and two getters (`mod-loader.js:8-47`). A mod cannot add an enemy, a wave, a spoil, a ribbon or a trait, which are what the rebuilt combat is made of. Fix M.

**Online multiplayer** (`js/online-multiplayer.js`). The header says it plainly: no server, sync by copy and paste. There is no `fetch`, WebSocket or WebRTC in the file. Three modes on the menu (Async Co-op, PvP Endless, PvE Horde).

- **Co-op cannot pass the turn between two people.** Headless probe with two separate browsers' worth of storage: A creates a room; B imports A's invite (B's copy lists 2 commanders, A's still lists 1, because nothing travels back). A hands off: `turnIndex = (0 + 1) % 1 = 0`, so the active commander is still A (`online-multiplayer.js:181-182`). B imports the kingdom code: `isMyCoopTurn()` is false. B plays and hands off: `{ok: false, error: 'Not your turn to hand off'}`. Fix S: on import of a kingdom code, make the importer the active commander, and carry the commander list in every code.
- The handoff snapshot loads and plays on (wave 6 → 8 in the probe), with every save gap from A2: new terrain, re-rolled flanks.
- A code is the whole save as text: 31,660 characters at wave 6.
- PvP results use `GameModes.computeScore` = wave × difficulty% + kills × 2 + a time bonus (`game-modes.js:437-441`), not the run score on the game-over screen (`siege-loop.js:1192-1230`). Breaches and losses do not count. Fix S: submit the SiegeLoop score.
- Importing a `PVPDATA` code replaces the local match record (`online-multiplayer.js:272-275`), so if both players finish before exchanging codes, one entry is overwritten. Fix S: merge entries by commander id.
- PvP relies on a shared seed, and the simulation is not deterministic (A3).
- Cheats are not blocked or flagged in any of these modes.

If real online play is wanted this is an L rewrite on a relay or WebRTC with a deterministic sim. Otherwise rename the menu section to say "share codes" throughout and fix the four S items.

## A5. Test coverage

77 suites. The gaps that matter:

**Shipped modules the headless sim and the honest bot never load** (`scripts/headless-manifest.mjs` leaves them out, and `game.js` guards each with `typeof … !== 'undefined'`, so the sim runs without them): `progression-restarts.js` (the wave 100 and 200 era resets), `ascension-system.js`, `eternal-legacy-tree.js`, `thematic-era-synergies.js`, `hybrid-power-fantasy.js`, `tech-tree-branches.js`, `narrative-thread.js`, `onboarding.js`, `game-feedback.js`. Each has a unit test of its own, but no test runs the game with them in. The three marathons that reach wave 1000 never perform an era reset, and the honest bot's balance numbers are for a game without ascension, legacy-tree or era-synergy bonuses. Fix S: add them to `HEADLESS_FILES` and re-baseline.

**No test at all:**

| System                                       | File                             | Lines |
| -------------------------------------------- | -------------------------------- | ----- |
| HUD                                          | `js/ui.js`                       | 2,379 |
| Input, hotkeys, boot                         | `js/main.js`                     | 759   |
| Tooltips                                     | `js/tooltips.js`                 | 839   |
| Settings                                     | `js/settings.js`                 | 573   |
| Save slots                                   | `js/save.js`                     | 211   |
| Creative panel                               | `js/creative.js`                 | 492   |
| Creative tools (scenario, replay, templates) | `js/creative-tools.js`           | 417   |
| Touch input                                  | `js/touch-input.js`              | 205   |
| Damage preview                               | `js/damage-preview.js`           | 269   |
| Graphics tiers                               | `js/gfx-quality.js`              | 307   |
| Lore text                                    | `js/lore-data.js`                | 1,415 |
| Electron shell                               | `electron/main.js`, `preload.js` | —     |

Also untested: a full save and load round trip; quicksave under Ironman; the encyclopedia rendering (it prints "damage undefined", B2); the hotkey table (the `]` conflict in B3 would have been caught); the achievement list against the rules (B1); `draw()` beyond "does not throw".

`scripts/verify-rotation.mjs` and `scripts/check-playable.mjs` need Electron or a Windows binary and are not part of `test:all`. The committed `scripts/sim-honest-report.json` was produced with `maxTicks: 20000`, not the script's default of 60,000.

**Deploy is not gated on tests.** `.github/workflows/pages.yml` builds and publishes on every push to main; `lint.yml` runs separately. A push that fails tests still goes live. Fix S: make the deploy job depend on the check job.

## A6. Dead files and services

| Item                                                 | Evidence                                                                                                                                                                                                                                                                                                       | Fix                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `js/procgen-obstacles.js` (258 lines)                | Loaded at `index.html:2595` and bundled (`build-manifest.mjs:101`). Nothing references `ProcGenObstacles`; its own header says it is "not wired into the live spawn pipeline". The header also names another project ("Miami Vice RTS").                                                                       | S: remove the tag and manifest entry, or wire it in.     |
| Economy victory                                      | `allowsCampaignEconomyVictory()` returns `false` (`game-core.js:770-773`), so `checkCampaignEconomyVictory` and `triggerCampaignEconomyVictory` (`game.js:6088-6119`), `CAMPAIGN_NARRATIVE.economyVictory` (`lore-data.js:665`) and the encyclopedia entry "Campaign Victory — Northern Purge" can never fire. | S: delete code and text.                                 |
| `GS.misses`                                          | Set to 0 at `game.js:215` and `7083`, saved and loaded, never incremented.                                                                                                                                                                                                                                     | S                                                        |
| `UpdateThrottle.shouldRunUnitAI`                     | `update-throttle.js:64`, no caller.                                                                                                                                                                                                                                                                            | S: use it (A3) or delete.                                |
| `Spatial.queryRadius`, `queryRect`, `queryHazardsAt` | Exported, no caller outside the file.                                                                                                                                                                                                                                                                          | S                                                        |
| `NarrativeThread.scanLegends`, `getLegendPowerMods`  | `narrative-thread.js:181, 207`, no caller. Legends are only created through `onHeroHonored`.                                                                                                                                                                                                                   | S                                                        |
| Analytics and error upload                           | Endpoints come from `window.MB_ANALYTICS_ENDPOINT` / `MB_ERROR_ENDPOINT` (`analytics.js:82`, `error-reporting.js:89-93`), which nothing sets. The upload code never runs; data only accumulates in `localStorage`. Analytics has no events for breaches, spoils or line-breakers.                              | S: remove upload, or set an endpoint and add the events. |
| Shelved macro layers                                 | `faction-depth.js:1894-1967` still looks up a `PlanetWarfare` service that is not registered.                                                                                                                                                                                                                  | S                                                        |
| Comments naming scripts that do not exist            | `scripts/verify-game-core.mjs` (`game-core.js:5`), `scripts/test-service-registry.mjs` (`game-services.js:46`), `scripts/verify-shelved-macro.mjs` (`game-services.js:79`, also `src/game-services.ts`).                                                                                                       | S                                                        |
| `achievements.js` rule kinds with no achievement     | `spec_rank`, `hidden_milestone`, `flawless`, `wwe`, `wwe_all`, `meta`; events `tp_check`, `crossover_mastery_challenge` are handled and never emitted.                                                                                                                                                         | S                                                        |
| Unreferenced exports                                 | `OnlineMultiplayer.hasPendingImport`, `LevelEditor.snapPos`, `SaveThumbnail.captureFromMinimapData`/`buildMetaLines`, `Formations.nextFormationId`, `Game.creativeSpawnEnemyBuildingAt`, `ErrorReporting.captureFreeze`/`patchGame`.                                                                           | S                                                        |

No whole module other than `procgen-obstacles.js` is unreferenced. `js/path-worker.js` is correctly absent from `index.html`; it is the worker file.

Electron notes: `sandbox: false` in `electron/main.js:47` and no Content-Security-Policy in `index.html` (Electron prints its security warning). The eval in the boot path is already gone, so a CSP can be added. Fix S.

---

# B. Content and writing

## B1. Achievements

**Count: 1,450**, generated in `js/achievements-data.js` (the file header still says "exactly 1,000").

| Group                                                                                                    | Count                   |
| -------------------------------------------------------------------------------------------------------- | ----------------------- |
| Faction ("crossover") achievements, 15 factions                                                          | 1,260 (87%)             |
| of which "Earn N mastery points" in 25-point steps                                                       | 642 (44% of everything) |
| Waves 44, combat 114, difficulty 45, build 14, tactics 14, army 13, economy 8, specialists 7, campaign 1 | 260                     |
| Secrets 27, meta 3                                                                                       | 30                      |

An honest bot on Normal that reached wave 12 had unlocked **39 of 1,450** (2.7%): 3 wave marks, 4 kill counts, 19 "first kill of type X", and a handful of others.

**Nothing in the list rewards the new rules.** No achievement mentions a breach, a line-breaker, spoils, a ribbon, upkeep, supply crates, posts, the early horn, the General's orders or the Crossbowman. The only "breach" is the old castle-keep flag.

### Cannot be earned

| Id                                                  | Name              | Why                                                                                                                                                                    |
| --------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creative_sandbox`                                  | Lab Rat           | Needs `game_start` with `creative: true`. The two emitters send `creative: false` (`game.js:7331, 7356`), and `ach()` returns early in Creative (`game.js:4248-4251`). |
| `millennium`                                        | Millennium Legend | Rule `unlocked_count:1449`: every other achievement, including the one above and everything in the next table.                                                         |
| `crossover_completionist` and the 14 `*_grand_slam` | —                 | Only if all 104 operatives and 29 champions are recruited; reachable in practice only through the cheat codes.                                                         |

### Out of reach in honest play (possible in the code, not for a player)

The honest bot averages wave 14.5 on Normal and 7.5 on Hellbane in 20,000 ticks. The campaign is won at wave 100.

| Ids                                                                                                       | Count       | Requirement                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `reach_wave_500` to `reach_wave_2000`                                                                     | 10          | Waves 500 to 2000 in one run                                                                                                         |
| `diff_<difficulty>_500`, `_1000`, `_2000`                                                                 | 12          | The same on each difficulty                                                                                                          |
| `era_hellscape`, `lifetime_wave_1000`                                                                     | 2           | Wave 1001; 1,000 waves lifetime                                                                                                      |
| `kills_5000`, `kills_10000`                                                                               | 2           | Kills in one run                                                                                                                     |
| `doom_hero_unlock`, `doom_hero_50`, `doom_hero_100`, `doom_rip_100`, `doom_rip_1000`, `ultimis_horde_150` | 6           | Wave 150 to 200 on Hellbane, then a 10,000 TP hero                                                                                   |
| `hamlet_40`, `guild_10`, `era_rts_master`                                                                 | 3           | 40 hamlets at 100 TP, 5 builders and 5 waves each, all after wave 100                                                                |
| `tp_10000`                                                                                                | 1           | 10,000 TP banked on +7 a wave                                                                                                        |
| `dragonball_planet_victory`                                                                               | 1           | Victory and wave 200                                                                                                                 |
| `warhammer_eternal_crusade`, `warhammer_fortress_line`                                                    | 2           | Eight fortifications "at all times", while the wave 100 era reset clears the field. Whether the reset trips the flag was not tested. |
| Mastery ladders                                                                                           | most of 642 | 1 point per faction kill; top rungs are 1,225 points and up per faction                                                              |

### Trivially earned

- `hunt_master` (Hunt Master): "clear a wave with Hunt mode on". Hunt is on by default; earned on wave 1.
- `reach_wave_1`, `kills_1`, `kills_10`, `army_10`, `bronze_star`, `first_veteran`, and the 46 `foe_first_*`: arrive by wave 3 to 10 without trying.
- `cheat_used`, `cheat_austin`, `one_piece_real`: typing a code.
- `deploy_all_academy` (Academy Roster): text says "during Academy Era"; the rule is "8 unit types deployed", any time (`achievements.js:411`).
- `all_strikes` (War Mage): text says "every strike"; the rule needs 5, there are 10.
- `spy_all` (Spymaster): "all six spy actions"; there are 12.
- `courier_all` (Royal Messenger): rule needs 5; there are 10 messages.
- **Everything session-based, with cheats.** `clear the field`, `war chest` and `kings ransom` do not mark the run. `run.counted` only looks at Creative (`siege-loop.js:457`), and `applyCheatEffect` (`game.js:15251`) sets no flag. Wave marks, kill counts, ribbons (permanent bonuses) and best scores can all be earned with them. The repo's own marathon sims reach wave 1000 this way.

### Wrong or misleading rules

- `boss_flawless` and the 13 `diff_*_flawless_*`: "zero ally losses" is tested against losses for the whole run (`session.currentMisses`, `achievements.js:793`), so one death on wave 2 rules out "Boss Untouched" on wave 10.
- `club_316` and `bottom_line`: same rule, two achievements.
- Duplicate names: "Officer Corps" (`vet_five`, `halo_command_pipeline`); "Seven Star Fist" (`fotns_omae_wa_mou`, `fotns_unlock`).
- TP rewards on `lifetime_kills_10000`/`50000`/`100000` (+25) and `millennium` (+316) are paid through the Creative helper (A4).

### Duplicates of ribbons

16 ribbons (`siege-loop.js:93-235`). Seven repeat an achievement:

| Ribbon                         | Achievement doing the same thing                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| First Blood (clear wave 1)     | `reach_wave_1` "First Stand"; the name collides with `kills_1` "First Blood"          |
| Ten Dawns (wave 10)            | `reach_wave_10`                                                                       |
| Quarter Siege (wave 25)        | `reach_wave_25`                                                                       |
| Half Siege (wave 50)           | `reach_wave_50`                                                                       |
| The Hundred (wave 100)         | `reach_wave_100`, `era_academy`, `true_victory_worldheart`: four awards for one event |
| Butcher (1,000 kills lifetime) | `lifetime_kills_500`, `lifetime_kills_2000`                                           |
| Reaper (10,000 kills lifetime) | `lifetime_kills_10000` "Lifetime Reaper 10000"; `kills_500` is also "Reaper"          |

Clean Hands overlaps the `diff_*_flawless` set. Bosskiller, Unbroken Line, Quartermaster, Early Riser, Old Guard, Gatekeeper, Council Seat and Warband Oath have no achievement twin.

### Fix

- M: cut the list to about 80 to 120 hand-written entries built on the current rules (breaches held, line-breakers cut down, spoils builds, upkeep discipline, veterans kept alive, each named boss, each difficulty to wave 25/50/100). Drop the mastery ladder, the wave marks above 200 and the per-enemy "first blood" set. Files: `js/achievements-data.js`, `js/achievements.js`, README.
- S: decide ribbons against achievements: ribbons carry the permanent bonuses, achievements are the record; remove the seven overlaps.
- S: mark a run as cheated in `applyCheatEffect` and exclude it from ribbons, scores and achievements (`js/game.js`, `js/siege-loop.js`, `js/cheats.js`).
- S: fix the rule and text mismatches above; emit `game_start` with `creative: true` or delete Lab Rat.
- S: migration from `myth-and-blood-achievements-v3` so existing unlocks map to the new ids.

## B2. Story and lore

### What the player reads, and when

| When                                                  | What                                                                                                                                        | Source                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Waves 10, 31, 50, 65, 75, 85, 100, 115, 150, 175, 200 | "Chronicle —" hook, a second line, and a floating title                                                                                     | `lore-data.js:598-663` via `maybeCampaignNarrative` (`game.js:6031`) |
| Waves 5, 25, 316, 1000                                | One "Chronicle —" line                                                                                                                      | `lore-data.js:522-596`                                               |
| Waves 31, 100, 200, 500                               | A branch beat for one of four "paths" (Iron Crown, Silver Diplomat, Arcane Scholar, Pragmatist), chosen from doctrine and map-event choices | `story-lore.js:61-150`                                               |
| Waves 150, 400, 500                                   | Crown era beats                                                                                                                             | `narrative-thread.js:6-36`                                           |
| First named boss; wave 100                            | "Warlord Slain"; "The Realm Stands"                                                                                                         | `lore-data.js:654-664`                                               |
| Run end                                               | A branch outro in the Story Arc tab; a wave report in Chronicles                                                                            | `story-lore.js:152-178`, `chronicles.js`                             |
| On demand (`I`)                                       | Encyclopedia: **805 entries, about 211,000 characters** across 35 tabs on a fresh profile                                                   | `encyclopedia.js`, `lore-data.js`                                    |
| Waves 1 to 8, first runs                              | One-line introductions of each system                                                                                                       | `siege-loop.js` first steps                                          |

In a normal run to wave 15 the story is one message, at wave 10. The honest bot recorded "0 choices" on every run, so the branch system showed nothing but the default outro ("Iron Crown — W12 Defeat. 0 choices recorded.").

### Tone against a dark, hand-inked horror comic

The strongest writing is short and physical, and it is already in the right voice:

- Enemy and boss lines: "No armor, no fear, no tomorrow." "A squealing tide of teeth and fever." "Walls crumble when he exhales."
- Ally lines: "The windlass is slow; the quarrel does not care about plate."
- `siege-loop.js` messages: "BREACH! One more through the line and the realm falls."

Most of the rest is in a different register:

1. **Rules manual dressed as story.** "Enemy counts swell ~35%. Hamlets and guilds are no longer luxury — they are oxygen." (`lore-data.js:568`, titled "RTS Threshold"). "Loadouts lock in and colony value steers assault composition" (636). "Enemy scaling eases in over the next waves" (631). Titles such as "Empire Consolidation" and "Raid Authority".
2. **Science-fiction escalation on a medieval field.** "Planetary Dominion" (wave 200, `lore-data.js:650`, `story-lore.js`), "full planetary war" (646), "Planet events", "colony value", "Living Planet", "Dynamic Map Events — Planet Fights Back", a main-menu legacy node "T4 Galactic Spearpoint", `GALACTIC_WAVE = 400` (`narrative-thread.js:7`).
3. **Parody and catchphrase.** Achievement names "Can You Taste What The Crown Is Cooking?", "And That Is Final", "Squared Circle Charisma", "This Is My Fighting Spirit!", "You Fell Before You Knew", "Power Level Rising", "The One Piece Is Real", "Lab Rat"; difficulty names Baby and Chad; cheat banners "KNIGHTS ASSEMBLE", "NINE RINGS FALL".
4. **Triumphal strategy-game voice** in every branch beat: "Empire Ascendant — your academies feed an army built to break, not bargain."
5. The menu tagline "HOLD THE LINE · FORGE A DYNASTY" promises a dynasty game.

For the stated direction the text should be about this field, these soldiers and what comes over the hill: short, concrete, grim, with no percentages and no system names inside story lines.

### Text describing systems that no longer exist or work differently

| Text                                                                                                                                                               | Where                                        | Now                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------- |
| "Standard Campaign and Academy Era runs end in victory when every enemy economy structure is destroyed"                                                            | Encyclopedia, Campaign tab                   | Disabled (`game-core.js:770`). Wave 100 wins.                         |
| "Raze every foe structure — the campaign ends when their economy is ash."                                                                                          | `lore-data.js:652` (wave 200)                | Same.                                                                 |
| "The last enemy holdfast is ash … the endless siege ends here."                                                                                                    | `lore-data.js:665-669`                       | Never shown.                                                          |
| "True victory demands shattering the tyrant"                                                                                                                       | `story-lore.js`, wave 500 beats              | Victory is declared at wave 100.                                      |
| "TP per cleared wave (+8 base, scaling)"                                                                                                                           | Encyclopedia "Tactical Points"               | `TP_PER_ROUND = 7` (`units.js:598`).                                  |
| "Wave thirty-one … Academies train, settlements charter"                                                                                                           | `lore-data.js:608, 616`                      | Academies and settlements open at wave 100.                           |
| "Tombstone perk", "Tombstone Rite"                                                                                                                                 | `lore-data.js:199, 624, 690`; `game.js:3067` | The building is called "Last Stand Monument" (`data/buildings.json`). |
| Strike entries "Battle Rally damage undefined radius undefined", "Arcane Dispel damage undefined", "Scout Flare damage undefined", "Fortify Zone damage undefined" | Encyclopedia, Orders & Strikes               | Template bug in `lore-data.js` `buildOrderEntries` (834).             |
| "Game Modes: Campaign — standard defense; destroy al[l]…"                                                                                                          | Encyclopedia, Campaign tab                   | Old win condition.                                                    |
| "Achievements line the road to the grand arena" as a wave 316 beat                                                                                                 | `lore-data.js:584`                           | Tied to an achievement count, not a wave.                             |

**Missing from the encyclopedia entirely:** the breach limit, spoils of war, ribbons, army upkeep, supply crates, posts, the run score. Counts over the 805 rendered entries: "spoils" 0, "ribbon" 0, "upkeep" 0, "crate" 0. Line-breakers and the General's orders appear only inside the Roles & Counters tab.

Many entries on a fresh profile show "CLASSIFIED ████" with unlock hints that do not fit the entry: "Day & Night Cycle" is locked behind "Unlock the Grand Coliseum", "Tactical Points" behind "Survive to Academy Era (wave 100)", and "Kingdom Evolution" prints "Unlock: Unlock era:" with nothing after it.

### Franchise and real names

Display names have been replaced with stand-ins nearly everywhere. What is left, in two groups.

**1. Shown to the player:**

| Text                                                                                                                                                                                                                | Where                                                                                                                                          | Source                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| "Four **Evolve**-style growth stages", "Evolve-style opposing roles"                                                                                                                                                | `encyclopedia.js:446, 461`; `lore-data.js:1118, 1263`                                                                                          | Evolve                                                                     |
| "Baki/FotNS melee"                                                                                                                                                                                                  | `lore-data.js:487`                                                                                                                             | Baki; Fist of the North Star                                               |
| "Doppo executes", "Pickle is raw prehistoric bruiser"                                                                                                                                                               | `encyclopedia.js:808, 827`                                                                                                                     | Baki characters                                                            |
| "Toki heals…", "Center your melee blob on Toki", "Rei is fast…", "Jagi fights dirty", "Shin delivers Nanto Hakuro…"                                                                                                 | `encyclopedia.js:969-984`                                                                                                                      | Fist of the North Star characters and school                               |
| "Ironhart fights better when Dom is close"                                                                                                                                                                          | `encyclopedia.js:724`                                                                                                                          | Gears of War                                                               |
| "Commissar is morale anchor", "beside Terminators"                                                                                                                                                                  | `encyclopedia.js:1046, 1037`                                                                                                                   | Warhammer 40,000                                                           |
| "Nightingale is fast melee"                                                                                                                                                                                         | `encyclopedia.js:1154`                                                                                                                         | The Elder Scrolls                                                          |
| "Part 1" to "Part 7" on every Bound Spirit operative; "Pt.N" on recruit cards; "Parts 1–7 … Part 7 = cavalry"; "Steel Ball"                                                                                         | `encyclopedia.js:833-953, 1199`; `crossover.js:214`; `cheats.js:171, 180`; `data/operatives.json:1164`; `achievements-data.js` (`jojo_unlock`) | JoJo's Bizarre Adventure part numbering                                    |
| "115 — Splinter Vale, Dr. Volkov…"                                                                                                                                                                                  | `cheats.js:117`                                                                                                                                | Call of Duty Zombies                                                       |
| "Fellowship of Ninefold March", "the Fellowship roster", "Elven Archer", "Halfling Scout", "Grey Pilgrim"                                                                                                           | `cheats.js:153`; `achievements-data.js:1153`; `data/operatives.json`                                                                           | The Lord of the Rings                                                      |
| "Coliseum, Doom, or evolved allies"                                                                                                                                                                                 | `faction-depth.js:2066`                                                                                                                        | Doom                                                                       |
| "Imperium mastery tier IV", "3+ Imperium operatives"                                                                                                                                                                | `cosmetics.js:100`; `faction-depth.js:532`                                                                                                     | Warhammer 40,000                                                           |
| Achievement names "Modern Warfare", "The One Piece Is Real", "Doom Gate", "Dragonrend", "Hell Walker"                                                                                                               | `achievements-data.js:1241, 1307, 111` and the faction blocks                                                                                  | Call of Duty; One Piece; Doom; Skyrim                                      |
| Descriptions quoting source catchphrases: "never leave a man behind", "stands, dramatic poses", "power level escalation … high-ki army", "Grimdark endurance", "Voice shout"                                        | `achievements-data.js` faction blocks; `encyclopedia.js:1230-1270`                                                                             | Halo, JoJo, Dragon Ball, Warhammer, Skyrim                                 |
| Operative names one step from the original: Anthony/Clayton/Benjamin Ironhelm, Augustus Thrash, Kaku Seastorm, Bruno Clasp, Diego Fang, Rao the Conqueror, Black Mage, White Mage, Soldier of Light, Chaos Champion | `data/operatives.json`                                                                                                                         | Gears of War, Baki, JoJo, Fist of the North Star, Final Fantasy, Warhammer |
| The "316" milestone and "Iron Creed"; the Stonebreaker's ability "Stonebreaker — bonus damage vs elites, brief pin" (ability id `stunner`)                                                                          | `achievements-data.js:1322-1332`; README:646; `data/champions.json`                                                                            | A real wrestler's catchphrase and finishing move                           |

No real person's name is shown on screen in what I scanned. The 29 Coliseum champions are recognisable portraits of real wrestlers by title and ability ("The Grave Walker — tombstones spread dread", "The Island Sovereign", "The Bagpipe Brawler", "The Clean-Living Rebel").

**2. In ids, file contents and storage (public repo, save files, `localStorage`, share codes):**

- `data/champions.json`: all 29 ids are real wrestlers' ring or legal names: `stone_cold`, `the_rock`, `ric_flair`, `hulk_hogan`, `macho_man`, `sting`, `john_cena`, `bautista`, `roman_reigns`, `shawn_michaels`, `bret_hart`, `undertaker`, `kane`, `andre_giant`, `razor_ramon`, `kevin_nash`, `roddy_piper`, `hacksaw_duggan`, `junkyard_dog`, `rey_mysterio`, `eddie_guerrero`, `chris_benoit`, `oba_femi`, `brock_lesnar`, `cm_punk`, `seth_rollins`, `sheamus`, `bray_wyatt`, `randy_orton`. Ability ids include `rko`, `batista_bomb`, `619`, `nigerian_nightmare`.
- `data/operatives.json`: all 104 ids are the source characters (`master_chief`, `marcus_fenix`, `aragorn`, `gandalf`, `frodo`, `baki_hanma`, `jotaro_kujo`, `dio_brando_p1`, `kenshiro`, `goku`, `vegeta`, `dragonborn`, `richtofen`, …).
- Building ids: `perk_jugger_nog`, `perk_quick_revive`, `perk_speed_cola`, `perk_phd_flopper`, `perk_tombstone`, `hanma_dojo`, `capsule_corp`, `rivendell_camp`, `astartes_chapel`, `spartan_academy`, `cog_academy`, `stand_arrow_shrine` (`data/buildings.json`).
- Faction keys `wwe`, `doom`, `halo`, `gears`, `lotr`, `baki`, `jojo`, `fotns`, `dragonball`, `imperium`, `tes`; file `js/wwe.js`; DOM ids `wwe-screen`, `doomslayer-deploy`; achievement ids `wwe_recruit_stone_cold`, `cheat_austin`; cheat ids `austin`, `onepiece`, `pokemon`, `rosebud`, `highlander`; test names `test-wwe-unlock`, `test-halo-unlock`, `test-lotr-unlock`, and nine more.

The repo is public, so "none" has to include group 2.

### Fixes

- S: remove the group 1 strings listed above (`js/encyclopedia.js`, `js/lore-data.js`, `js/cheats.js`, `js/achievements-data.js`, `js/crossover.js`, `js/cosmetics.js`, `js/faction-depth.js`, `data/operatives.json`, `data/roster-profiles.json`, README).
- L: decide what the 15 factions and 133 hero units are for. They are 87% of the achievements, 16 of 35 encyclopedia tabs, and the source of every name problem. Either rewrite them as original orders native to this world, or cut them. Then rename ids, files, DOM ids and tests with an alias table for saves (A2).
- M: rewrite the 11 chronicle beats, the 16 branch beats and 4 outros, and the narrative-thread beats in the field-level voice; delete the planet and galaxy vocabulary; no numbers in story lines (`js/lore-data.js`, `js/story-lore.js`, `js/narrative-thread.js`).
- M: move the story to where a run actually is. Waves 1 to 30 currently get one beat. Give the ten named bosses an arrival line and a death line; give a breach, a veteran's death and a claimed spoil a line each.
- S: encyclopedia entries for breach limit, line-breakers, spoils, ribbons, upkeep, crates, posts, orders and score; fix "damage undefined", the "+8 base" figure and the misplaced unlock rules (`js/lore-data.js`, `js/encyclopedia.js`).
- M: cut the encyclopedia. 805 entries is a second manual; a Mud and Blood-style game wants a bestiary, the soldier roles and a page of rules.

## B3. README accuracy

Wrong:

| Line         | README says                                      | Code                                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17           | "Sound is procedural (generated in the browser)" | Music and set-piece cues are recordings in `assets/sfx/`; the README says so itself at line 440.                                                                                                                                                                                                  |
| 21-29        | Seven game modes                                 | The menu has ten: Async Co-op, PvP Endless and PvE Horde are missing, as are the Daily and Weekly challenges and the Ironman toggle.                                                                                                                                                              |
| 24           | Survival "ranks wave × difficulty% + kills"      | wave × difficulty% + kills × 2 + time bonus + bonus (`game-modes.js:437-441`).                                                                                                                                                                                                                    |
| 41           | "miss limit disabled"                            | The term is the breach limit.                                                                                                                                                                                                                                                                     |
| 84, 289      | "Hamlet: +1 TP/round"                            | +5 (`data/buildings.json` `tpBonusPerHamlet: 5`, `units.js:21`).                                                                                                                                                                                                                                  |
| 178          | "`]` Cycle game speed"                           | While playing, `]` is caught first as Hold the Line and returns (`main.js:526-529`); the speed branch at `main.js:647` is never reached. Confirmed in the real page: speed stayed at 1. The README assigns `]` to both at lines 178 and 306; the in-game key list repeats the error (`ux.js:30`). |
| 312, 314-331 | "All nine strikes"                               | Ten: Arcane Dispel (5 TP, needs a Mage) is in `data/strikes.json` and the encyclopedia.                                                                                                                                                                                                           |
| 335          | Spy list                                         | Matches by count (12), but "Spymaster" still says six.                                                                                                                                                                                                                                            |
| 606          | "breakthrough limit"                             | Breach limit.                                                                                                                                                                                                                                                                                     |
| 642, 649     | "1,450 total"                                    | Correct, but the generator's header says 1,000.                                                                                                                                                                                                                                                   |
| 646          | "_316 Club_ + _And That's The Bottom Line_"      | Names in the game are "Iron Creed" and "And That Is Final".                                                                                                                                                                                                                                       |
| 647          | "999 unlocks — Millennium Legend"                | Needs 1,449 (`unlocked_count:1449`).                                                                                                                                                                                                                                                              |
| 649          | Categories "Vanilla/Core … Secrets/Meta"         | Real categories: waves, combat, army, build, specialists, tactics, economy, difficulty, campaign, 15 faction tabs, secrets, meta.                                                                                                                                                                 |
| 694          | "MIT — see `package.json`"                       | There is no LICENSE file.                                                                                                                                                                                                                                                                         |
| 688          | Developer commands                               | Does not mention `npm run sim:honest`, or that `test:all` ends with a 5 to 17 minute sim.                                                                                                                                                                                                         |

Checked and correct: unit costs (all 15), Crossbowman 44 against Archer 28 with 1.8× reload, building and academy costs, castle 50 TP (sum of parts), core strike costs, breach limits and upkeep (14 free, 7%), score formula and multipliers, 16 ribbons, map growth of +90 by +110 every 10 waves (490×710 at wave 10, 670×930 at wave 30), flanks at 25/50/75, wave 100 victory, 104 operatives and 29 champions, the cheat table, +7 base TP, Hellbane hero at 10,000 TP.

Not in the README at all: Research Lab (45 TP), Village/Town/City/Metropolis (180/280/420/600 TP), Daily and Weekly challenges, Ironman, the legacy and Crown Legacies trees on the main menu, doctrines and expeditions, share codes, mods, bug report on F10. Not checked: every hotkey, wave-event timings, academy special rules, tonic names.

Fix S: correct the rows above. Fix M: split the README into a short player manual and a `docs/` developer page, and generate the cost tables from `data/*.json` so they cannot drift.

---

# Priorities

## Twelve engine changes, in order

1. **Rewrite the spatial index internals** (`js/spatial.js`; static-only query in `isTerrainBlockedAt`, `js/game.js:6633`). 45% of tick time at wave 60. S.
2. **Save the next-wave plan, terrain and squad state**, and add a round-trip test (`js/game.js:15665-15996`, new `scripts/test-save-roundtrip.mjs`). Loading a save currently changes the map and can change the flanks. S.
3. **Make save slots usable** and guard them for Ironman and Creative (`js/save.js:100-171`). S.
4. **Load the nine missing gameplay modules in the headless sim and honest bot** (`scripts/headless-manifest.mjs`), then re-baseline. Era resets and three bonus systems are untested in play today. S.
5. **Gate the Pages deploy on the test job** (`.github/workflows/pages.yml`). S.
6. **Throttle enemy retargeting and wire or remove `shouldRunUnitAI`** (`js/game.js:13441, 6584`; `js/update-throttle.js`). S.
7. **Save versioning with migrations and an id alias table** (`js/game.js` save block, `js/save.js`, `js/achievements.js`, `js/meta-progress.js`). Required before any id is renamed. M.
8. **Mark cheated runs** and keep them out of ribbons, scores and achievements (`js/game.js:15251`, `js/siege-loop.js:457`, `js/cheats.js`). S.
9. **Start the `game.js` split**: steps 0 to 3 of A1 (internals table, save, Creative API, `getState`), about 2,200 lines out with low risk. M.
10. **Seeded randomness for all simulation rolls, and AI throttling that does not depend on the camera** (62 `Math.random()` calls in `js/game.js`; `js/update-throttle.js:28-56`). Seed Run, daily/weekly and PvP depend on it. M.
11. **Fix or relabel multiplayer**: co-op turn passing, PvP score source, PvP entry merge (`js/online-multiplayer.js:155-185, 272-275`; `js/game-modes.js:437-450`). S each.
12. **Delete dead code**: `procgen-obstacles.js`, economy victory, `GS.misses`, the unused analytics upload, stale script references, unused achievement rule kinds; fix the `]` hotkey (`js/main.js:526, 647`). S.

Then continue the split (A1 steps 4 to 10) with the benchmark from A3 as the guard.

## Ten content changes, in order

1. **Remove every franchise and real-person reference, ids included.** Start with the 29 wrestler ids in `data/champions.json` and the on-screen strings in B2 group 1; then operative ids, building ids, faction keys, file and test names, with the alias table. S for the strings, L for the ids.
2. **Decide the fate of the 15 hero factions** (rewrite as original orders, or cut). Every other content number depends on it. L.
3. **Replace the 1,450 achievements with about 100 written for the current rules**; remove the seven that duplicate ribbons. M.
4. **Rewrite the chronicle, branch and era beats** in a grim, field-level voice with no percentages and no planet or galaxy vocabulary (`js/lore-data.js:522-670`, `js/story-lore.js:61-178`, `js/narrative-thread.js:10-36`). M.
5. **Put story where the run is**: lines for each named boss arriving and dying, for a breach, for a veteran's death, for spoils; waves 1 to 30 currently get one beat. M.
6. **Add encyclopedia entries for the actual core loop** (breach limit, line-breakers, spoils, ribbons, upkeep, crates, posts, orders, score). S.
7. **Delete text for dead or changed systems**: economy victory, "true victory" at wave 500, "+8 base", wave 31 academies, Tombstone naming, "damage undefined", wrong unlock hints. S.
8. **Correct the README**: the 15 rows in B3, most urgently the `]` key, hamlet income, mode list and achievement milestones. S.
9. **Cut the encyclopedia from 805 entries** to a bestiary, soldier roles and one rules page. M.
10. **Rename for tone**: difficulties Baby and Chad, the tagline "Forge a Dynasty", achievement "Genocider", the catchphrase achievement names, cheat banners, and one name for "Tombstone" / "Last Stand Monument". S.

## Open questions for the owner

1. Are the 15 hero factions staying in some original form, or going? Engine items 7 and content items 1 to 3 change size with the answer.
2. Is real online play wanted, or are share codes enough?
3. Should the game end at wave 100, or is the endless tail past 100 (academy era, settlements, enemy RTS at 200) still part of the design? About a third of `game.js`, most of the lore and most of the unreachable achievements live there.
4. Should cheats stay in the shipped game, and if so should they void the run?
