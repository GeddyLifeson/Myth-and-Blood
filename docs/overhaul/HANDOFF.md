# Handoff: Myth and Blood overhaul

Written 2026-11-13 for a fresh Claude Code session. Read this file first, then
`docs/overhaul/README.md` (plan and decisions) and `CLAUDE.md`.

## What the owner wants

Marlon wants the whole game overhauled: every system, screen, visual, sound and animation. His
standing instructions for this work:

- Keep going until it is all done. Where you would ask him a question, answer it yourself,
  apply the answer, and record it in the Decisions table in `docs/overhaul/README.md`.
- Use subagents to go faster, but see "Machine limits" below.
- Never merge or approve a pull request yourself. Open it, get CI green, and he merges.
- Do not delete a whole system without asking. Rework and merge freely.
- No real franchise or real people's names in anything a player can read or see.
- Art is a hand-inked horror-comic look (bone, blood red, black). Style evocation only.
- Write to him plainly. End each reply with a short list of questions only when a question is
  really his to answer.
- `RESUME.md` is gitignored and must never be published.
- End commit messages and PR bodies with your own session's attribution lines.

## Where things stand

`main` has everything through PR #10 (phase 2): fixes, per-state hotkeys, the Spoils modal,
Shift-click hiring, hunt/hold/med tent rules, the economy pass, the rebuilt Sapper, redrawn
buildings and field, and the unit art pass. The full suite passed 85/85 on that merge. The live
site (GitHub Pages) deploys from `main`.

Phase 3 was split across sixteen branches plus one audit. All sixteen were stopped part-way
(first by a server restart, then deliberately to write this handoff). **Every branch below is
unfinished work-in-progress: nothing on them has been run through the test suite or looked at on
screen unless the notes say so.** Each is cut from `main` at PR #10 and pushed to origin.

| Branch               | Task                                                    | State when stopped                                                                           |
| -------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `claude/p3-units`    | Unit sprite leftovers                                   | 5 files, +2200/−1075. About 35 min of work. Untested.                                        |
| `claude/p3-field`    | Buildings, props, weather leftovers                     | New `js/prop-art.js`. +1176. Untested.                                                       |
| `claude/p3-fx`       | Projectiles, spells, banners, floating text             | New `js/projectile-art.js`, `js/banner-art.js`. +3274/−1026. Untested.                       |
| `claude/p3-tabs`     | Real panel tabs, readable text, one modal style         | New `js/panels.js`. +5552/−1454. Resumed once; furthest along of the screens work. Untested. |
| `claude/p3-phone`    | Phone layout and touch                                  | New `css/mobile.css`, `js/mobile-ui.js`. +1471. Untested.                                    |
| `claude/p3-keys`     | Key rebinding, settings sections, save screen           | New `css/settings.css`. +3078. Untested.                                                     |
| `claude/p3-teach`    | One tutorial path, How to Play screen                   | New `js/how-to-play.js`, `css/teach.css`. +2321. Untested.                                   |
| `claude/p3-css`      | Prune `css/style.css` safely                            | Only `scripts/css-audit.mjs` written. No CSS deleted yet.                                    |
| `claude/p3-onefield` | No era resets, one map size, three top-edge sectors     | 16 files, +1777/−1273, new `scripts/test-onefield.mjs`. Resumed once. Untested.              |
| `claude/p3-factions` | One faction leads each wave, a tactic per faction       | New `js/host-tactics.js`. +2814/−997. Resumed once. Untested.                                |
| `claude/p3-camps`    | Enemy war camps, Disrupt trim, rarer events             | New `js/war-camps.js`, `scripts/test-war-camps.mjs`. +1891. Untested.                        |
| `claude/p3-cast`     | Crossover heroes rewritten as original characters       | Data and screens renamed, new `scripts/test-original-cast.mjs`. +2306/−767. Untested.        |
| `claude/p3-achieve`  | Rebuild achievements (1,450 down to a few hundred)      | Only `js/achievements-data.js` rewritten. Logic, panel, migration not started.               |
| `claude/p3-lore`     | Encyclopedia, lore, README, changelog                   | +2518/−3771, new `docs/CHANGELOG.md`, `scripts/gen-readme-keys.mjs`. Untested.               |
| `claude/p3-saves`    | Versioned saves, SaveRegistry, autosave, co-op hand-off | 52 files incl. fixtures. +2738. Resumed once. Untested.                                      |
| `claude/p3-perf`     | Tick performance (spatial grid)                         | New `scripts/bench-tick.mjs`, `scripts/test-spatial-equivalence.mjs`. +1878. Untested.       |

The task brief each agent was given is summarised under "Briefs" below. The shared rules they
were given are in `docs/overhaul/handoff/AGENT_RULES.md`.

Also on this branch:

- `docs/overhaul/combat-core.md`: the sixth audit, covering the fight itself (veterancy, hit
  and damage rolls, morale, pinning, healing, enemy and player AI). It was stopped before its
  last runs finished: eight passages are marked "pending". Its findings and proposal are usable.
- `docs/overhaul/handoff/combat-scratch/`: the scripts that audit used.
- `docs/overhaul/handoff/id-migration.json` and `sprite-brief.md`: from the cast work.
- `docs/overhaul/handoff/achievements-before.md`: the measured state of the old achievements.

## How to resume

1. Clone the repo, `npm ci`, and confirm `main` is green: `npm run check`, `npm run test:all`,
   `npm run build`.
2. For each branch, check it out and find out what state it is really in: read the diff
   against `main`, run `npm run check` and `node scripts/run-all-tests.mjs --skip-sim`, and
   render the game. Do not trust a branch because it compiles.
3. Finish each branch against its brief. Keep each agent inside the files its brief says it
   owns; that is what keeps the merges manageable.
4. Merge in groups and open one pull request per group, in this order:
   1. **Difficulty** (not started, see below), then the war: `p3-onefield`, `p3-factions`,
      `p3-camps`.
   2. **Screens**: `p3-tabs`, then `p3-keys`, `p3-teach`, `p3-phone`, then `p3-css` last.
   3. **Art**: `p3-units`, `p3-field`, `p3-fx`.
   4. **Content**: `p3-cast`, `p3-achieve`, `p3-lore`.
   5. **Engine**: `p3-saves`, `p3-perf`.
5. After each group is merged locally: `node scripts/extract-game-data.mjs`,
   `npm run gen:eslint-globals`, `npm run check`, `npm run test:all` on a quiet machine,
   `npm run build`, then play it in Electron and look before opening the PR.

### Where merges will collide

- `js/game.js` is touched by almost every branch. Edits were meant to be small and local.
- `index.html` (script tags and stylesheet links), `scripts/build-manifest.mjs`,
  `scripts/headless-manifest.mjs` and `eslint.globals.mjs`: additive on every branch. Take
  both sides, then regenerate the globals.
- `js/game-data-bundle.js` is generated. On conflict take either side and regenerate.
- `js/main.js`: `p3-keys` (keydown handler) and `p3-phone` (touch handlers).
- `js/settings.js`: `p3-keys` and `p3-phone`.
- `js/siege-loop.js`: `p3-teach` (introduction), `p3-onefield` (markers), `p3-camps`,
  `p3-keys`.
- `js/ux.js`, `index.html` panel markup: `p3-tabs` and `p3-teach`.
- `js/roster.js`: `p3-units` (`drawOverlays`) and `p3-factions` (enemy entries).
- `js/save.js`: `p3-keys` owns the save screen, `p3-saves` owns the data layer.
- `README.md`: `p3-lore` is doing the full rewrite; others made small edits. Prefer `p3-lore`
  and re-apply the facts from the others.
- `p3-cast` changes display names only. Ids are unchanged on purpose. Other branches must not
  hardcode hero or hero-faction display names.

## Not started

1. **Difficulty rebalance.** The main open gameplay problem: on Normal an army-only player
   barely loses anyone. `combat-core.md` gives four causes that multiply: soldiers' attack rate
   and damage grow without limit; most of the enemy host runs away instead of fighting; one
   healer out-heals the host from about wave 6; and an earlier enemy buff reached only 3 of 46
   enemy types for health and damage. It recommends Option 1 (slow veteran growth, section
   10.1) plus wiring the enemy scale so the existing knobs work and fixing bosses. Target bands
   are in its section 10.4 (Normal: first death by wave 4-6, about one a wave by 11-15, average
   play ends at wave 20-25). Finish the pending runs first, then build it and tune with the bot
   over three or more seeds.
2. **Sound pass.** New recorded cues are wanted for mine blast, satchel blast, fuse hiss, the
   new banners, a theme per enemy faction, and variations of the battle loop. The cues so far
   were scored in MuseScore Studio 4 on Marlon's Windows PC (`tools/sfx/README.md` describes
   the workflow). Nobody has listened to any of the audio except him.
3. **Internal id rename** for champions and operatives, as one step with a save migration,
   using `handoff/id-migration.json`. Do it after `p3-cast` and `p3-saves` are merged.
4. **Split `js/game.js`** (17,000 lines) following the ten-step plan in `engine-content.md`.
   Do this last, when no other branch is open.
5. **Apply the performance hot spots** outside the spatial grid once `p3-perf` reports them.
6. Republish or delete the stale copy of the game that was published as a Claude artifact.

## Machine limits

The cloud machine used for this work had 2 CPUs and 7 GB of memory. Seventeen agents at once,
each rendering in Electron and running tests, took it down. On a machine like that run at most
four or five agents at a time, tell each to run one heavy command at a time, have them commit as
soon as something works, and run the long headless sim only once, after merging, on a quiet
machine. Timing tests (`test-wave15-stability`, the `SLOW_UPDATE` check in `headless-sim`) fail
under load and pass alone.

## Useful commands

| Task                    | Command                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Lint, types, format     | `npm run check`                                                                         |
| Fast tests              | `node scripts/run-all-tests.mjs --skip-sim`                                             |
| All tests               | `npm run test:all`                                                                      |
| Build                   | `npm run build`                                                                         |
| No-cheat bot            | `node scripts/sim-honest-play.mjs` (env `HONEST_TICKS`, `HONEST_SEEDS`, `HONEST_DIFFS`) |
| Regenerate data bundle  | `node scripts/extract-game-data.mjs`                                                    |
| Regenerate lint globals | `npm run gen:eslint-globals`                                                            |
| Render                  | `xvfb-run -a node_modules/.bin/electron --no-sandbox <script.cjs>`                      |

Bot runs are not deterministic per seed. Report ranges, not single numbers.

## Briefs

Each brief is what the branch still has to deliver. "Owns" lists the files it may change
freely.

### p3-units

Owns `js/sprites.js`, `js/sprite-lod.js`, `js/visual-polish.js`, `drawOverlays` in
`js/roster.js`. Make idle variation and walk legs readable at 1x zoom. Status marks legible at
1x, with the missing ones added (burrow, duty stacks, last stand, execute, lifesteal). Rim light
for dark enemies at night. A corpse per monster shape. A proper siege tower and collapse. The
juggernaut gets its own body. Replace the "ROUT" / "GAVE UP" text labels with a pose and mark.
Delete the old red "H" hunt marker. Draw the Sapper with satchel, spade, fuse coil and knife,
with throwing and mine-laying poses. Get crossover units onto a running field and look. Size
the hit-flash disc to the body.

### p3-field

Owns `js/building-art.js`, `js/building-art-types.js`, `js/field-art.js`, new
`js/prop-art.js`. Distinct ruins per perk machine. Scaffolds scaled to the building. Stronger
rain and crisper biome edges. Hazards, barricades, dens, crates and spike traps redrawn in ink
and cached. Mist, ash and each non-plains biome checked on a running field. The real dusk to
dawn sequence checked in play. Mines and the breach line readable on every ground. Soldiers
readable everywhere at night.

### p3-fx

Owns `js/particles.js`, `js/effects.js`, `js/strike-fx.js`, `js/floatingText.js`,
`js/game-feedback.js`, new `js/projectile-art.js` and `js/banner-art.js`. A distinct look and
impact per projectile. Wind-up, strike and aftermath for every spell and strike, with the flash
cap kept at 0.22. One summed number per blast. Consistent floating text that does not pile up.
Ink blood spatter. Queued banners for wave start, boss, nightfall, dawn, breach, spoils,
veteran fallen, defeat. A vignette that tightens as breaches near the limit.

### p3-tabs

Owns the panel and screen markup in `index.html`, `js/ui.js`, `js/ux.js`, `js/tooltips.js`,
`css/theme-v2.css`, new `js/panels.js`. Left panel as real tabs (Troops, Build, Spells, More)
with locked items grouped and explained. Right panel tabs that switch, with cooldowns shown.
Nothing under 12 px at 1366x768; Begin Day a large button. Menu, pause and game over fit the
window. One modal style. Regrouped top HUD. A selection card that never covers prompts. Button
states and short transitions. Contrast and focus outlines.

### p3-phone

Owns new `css/mobile.css` and `js/mobile-ui.js`, `js/touch-input.js`, the touch handlers in
`js/main.js`. Layouts for 390x844, 844x390 and 768x1024: field fills the screen, panels become
sheets and drawers, 44 px tap targets, 14 px text, no page scroll or page pinch-zoom, safe-area
insets. Touch controls for select, move, hold, pan, pinch, box-select, place more, cancel, and
re-siting a mine. Modals that fit. Lower graphics tier on phones. A working way to test touch.

### p3-keys

Owns `js/hotkeys.js`, `js/settings.js`, the save screen in `js/save.js`, the keydown handler in
`js/main.js`, `scripts/test-hotkeys.mjs`, new `css/settings.css`. Rebinding per state with
conflict refusal, reserved keys, persistence and reset. Every action has a key or is listed as
unbound by design; control groups; speed keys. Settings in sections, exposing
`Settings.get('reduceMotion')` and `Settings.get('teamPalette')`. A save screen with slot
details, confirmations, and export/import as text.

### p3-teach

Owns `js/onboarding.js`, the staged introduction in `js/siege-loop.js`, new
`js/how-to-play.js` and `css/teach.css`. The staged introduction becomes the one in-run
teacher: prompts read the real key from `Hotkeys`, point at the thing, wait, and never describe
what the player cannot do. Other teachers folded in. The TUTORIAL button starts a run with the
introduction forced on. A short illustrated How to Play screen.

### p3-css

Owns `css/style.css` and `scripts/css-audit.mjs` only. Delete only rules the script proves dead
or duplicate, and prove no visual change with before/after pixel comparison of a fixed set of
screens. Run this last, after the other screens branches are merged.

### p3-onefield

Owns `js/progression-restarts.js`, `js/multi-front-siege.js`, `js/biome-spawn.js`, map-size and
spawn-side code in `js/game.js`, the sector markers in `js/siege-loop.js`. Remove the wave 100
and 200 field wipes while keeping what those eras unlock. One map size for the whole run, with
old saves clamped. Attacks from three sectors along the top edge only, chosen at nightfall and
shown with real per-sector counts. Headless test across waves 99-101 and 199-201.

### p3-factions

Owns `js/enemy-factions.js`, `js/faction-depth.js`, `js/faction-intel.js`,
`js/faction-reputation.js`, `js/wave-composition-core.js`, `js/monster-bosses.js`, enemy
entries in `js/roster.js`, wave building in `js/game.js` and `js/units.js`, new
`js/host-tactics.js`. One faction leads each wave (70-80% of the host) with 4-7 enemy types. A
tactic per faction as data driving small AI hooks, each with a counter hinted in the preview.
Bosses come from the leading faction. Honest horde flavours. Intel feeds the preview. Seeded
runs made deterministic. Do not change overall difficulty here.

### p3-camps

Owns enemy-building code in `js/game-core.js` and `js/game.js`, `js/settlement-raids.js`,
`js/dynamic-map-events.js`, `js/living-planet.js`, `js/neutral-wildlife.js`,
`js/neutral-relations.js`, `js/economy-rules.js`, `data/strikes.json`, new `js/war-camps.js`.
First establish what enemy structures really spawn today. War camps at the top edge from about
wave 6 that give the next wave one named bonus unless destroyed; soldiers never walk off to
attack them unordered. Settlement Raid targets a camp. Disrupt trimmed so using it every time is
not clearly best. Events about one wave in four, each a real choice or an announced field
condition.

### p3-cast

Owns `data/champions.json`, `data/operatives.json`, `data/roster-profiles.json`,
`js/crossover.js`, `js/wwe.js`, `js/operative-skill-trees.js`, display text in
`js/faction-depth.js`, `scripts/test-roster.mjs`, `scripts/lib/roster-clauses.mjs`. Every
champion, operative and their factions renamed and rewritten as original characters of this
world, with no winks at the originals. Stats and mechanics unchanged. Ids unchanged this pass;
no id may reach the screen. A blocklist test against the old names.

### p3-achieve

Owns `js/achievements.js`, `js/achievements-data.js`, `js/chronicles.js`, achievement parts of
`js/meta-progress.js`, `js/cosmetics.js`, new `css/achievements.css`. Rebuild as 150-250
achievements about the game as it is now, with old unlocks mapped onto the new set and retired
ones dropped without breaking a save. Cheated and creative runs unlock nothing. One small toast
at a time. A grouped panel with progress.

### p3-lore

Owns `js/encyclopedia.js`, `js/lore-data.js`, `js/story-lore.js`, `js/narrative-thread.js`,
`README.md`, `docs/CHANGELOG.md`. Encyclopedia cut to a reference a player would use, with the
missing topics added and dead ones removed; unit entries read from data at runtime. One grim,
spare voice for lore. README rewritten as an accurate manual, with the key table generated by
`scripts/gen-readme-keys.mjs`.

### p3-saves

Owns save serialisation in `js/game.js` and the data layer of `js/save.js`,
`js/online-multiplayer.js`, `js/game-state.js`, `js/error-reporting.js`,
`scripts/headless-manifest.mjs`, new `js/save-registry.js`. A versioned schema with a migration
chain, checksum and validation; fixtures of old saves that must keep loading. A proven
round-trip for all run state, with terrain that matches after load. A `SaveRegistry` so modules
add their own state. Autosave at nightfall. Export/import helpers. The co-op hand-off fixed.
The nine modules the sims never loaded added to the headless manifest.

### p3-perf

Owns `js/spatial.js`, `js/pathfinding*.js`, `js/path-worker*.js`, `js/entity-pool.js`,
`js/update-throttle.js`, `js/perf.js`, `js/formations.js`, `scripts/bench-tick.mjs`. Benchmark
first. Integer-keyed spatial grid with no per-query allocation, proven equivalent to the old
one. Staggered target acquisition without changing outcomes. Less re-pathing. Fewer per-tick
allocations. Hot spots in files it does not own written up for later. Target: 30% lower mean
tick in a 250-unit scene.
