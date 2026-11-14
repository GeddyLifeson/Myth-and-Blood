# Changelog

What changed in the overhaul so far, taken from the history of `main` and grouped by area. Dates are commit dates. Short hashes are given so each line can be traced with `git show`.

Work still on branches is not listed here until it is merged.

## 2026-11-13

### Combat and orders

- Hunt is now the default for every soldier, on a leash around his post, and Hold is an order given to chosen soldiers. The wounded walk to the med tent on their own. (`b4076e9`)
- The Sapper was rebuilt as a field engineer: mines buried at night, satchel charges thrown by day. (`5b554f8`)
- Posts, the Crossbowman, spawn markers on the field edge and the run score were added. A staged introduction teaches one system per early wave. (`a2273a6`)
- Siege depth: real pressure on the line, battles fought in mid-field, three new enemies, boss marks and an after-action report. (`5f2dbbd`)
- Every operative and champion got its own role, trait and weakness. (`69765e8`)

### Economy and research

- Courier and spy actions have prices and cooldowns, research is faster, and each building has one job. An Outpost upgrades to a Barracks or a Granary. (`bccd129`)
- Prices shown on buttons match what is charged, army upkeep included. (`f377b4d`, `f0c8c98`)

### Screens and keys

- One key map per screen, with no key doing two things on one screen. The spoils choice is a blocking choice in the middle of the screen. Locked or unaffordable items can no longer be selected. (`f377b4d`)

### Art and animation

- Units redrawn in a bone-and-blood palette with gaits, new states, deaths by cause and status marks. (`17051af`)
- Buildings and the battlefield redrawn in ink. (`132aed1`)
- Animation passes: monster attacks, troop flinch and shield raise, recurve bows, mounted thrusts, and a hurt pose while a hit flash is up. (`2eb97fe`, `dfce72b`, `e00682d`)

### Sound

- Recorded orchestral cues and music loops replaced the synthesized set-piece sounds. (`3209f26`, `88dd29f`)
- Audio unlocks on the first click or key press in browsers. (`e9df353`)

### Planning and tests

- The overhaul audit reports and plan were added under `docs/overhaul/`, with the owner's decisions, the hotkey requirements and three reported scrolling and selection bugs. (`408755a`, `e81cb8f`, `41255a7`, `b7ed801`, `b4b5c74`, `189d459`)
- A timing race in the siege-loop test was fixed. (`997e770`)
- The sound folders are listed in `CLAUDE.md`. (`cd64557`)

## 2026-11-12

### Combat and the siege loop

- The siege loop arrived: line-breakers and the breach limit, spoils, the early-horn bonus, the wave preview, supply crates, counters, the General's orders, ribbons and Warband mode. (`1c77108`)
- Roster rework: a role, a trait and a weakness for every troop, enemy, boss, operative and champion. (`ef726f0`)
- A wave soft-lock found by honest play was fixed. (`94e3505`)
- Confirmed gameplay and interface bugs from a line-by-line audit were fixed. (`4584acf`)
- Tech-tree bonuses that were only displayed now apply; perk effects and wall garrisons survive save and load. (`ade3acd`)
- A campaign milestone was added at wave 100, and era resets that belonged to deleted layers were dropped. (`1e76d27`)

### Content and text

- Roster stats moved into data files. (`57ec468`)
- Remaining franchise names, moves, perk labels and cheat codes were renamed. (`1dd70e5`)
- Lore, encyclopedia and story text for systems that no longer exist was removed or reworded. (`c374838`)
- A skill-tree shop was added to the Legion Archive and the arena screens. (`97d48e0`)

### Art and interface

- Art pass: an inked horror-comic look for units, battlefield, buildings, menu and HUD. (`cbccf05`)
- HUD pass: readable two-column rails, with Speed and Hunt pinned in the top bar. (`65d91ca`)
- Begin Defense moved to the top of the main menu; legacies and share codes collapse. (`535aa63`)
- 183 CSS rules that matched nothing were removed. (`dae3360`)

### Engine, build and tests

- The theme ships in production builds, the build deploys to Pages, and tests run in CI. (`d18cf34`)
- An honest no-cheat playtest bot was added; it detects stalls and runs in CI. (`57ec468`, `94e3505`)
- The simulation asserts the wave 100 milestone. (`17d2594`)
- Test helpers are shared in place of 65 copies. (`8e4c9e0`, `6fc4580`)
- The test suite and checks were brought to green; applied one-off scripts and dead tests were removed. (`fdd2a61`)
- Dead code removed: hooks for the deleted macro and planet layers, unreferenced functions, exports and class methods. (`226c10b`, `6da53d0`)
- The repo was formatted with Prettier, and the generated lint globals are kept out of the formatter. (`21fb785`, `be16355`, `15c9762`)

## Before the overhaul

- 2026-10-07: an inline favicon, a procedural obstacle adapter, and stale test output removed. (`f93cf07`, `4b13c24`, `4d676af`)
- 2026-09-28 and 2026-09-29: graphics passes 3 and 4 (weather, a dread overlay when a boss is present), a wave-complete stutter fixed, and two small gaps closed. (`3b76509`, `c8d759e`, `8ce14b8`, `fc0a8c6`)
- 2026-08-18: graphics passes 1 and 2 (lit unit sprites, richer terrain, a silhouette per class). (`f870018`, `ae29d45`)
- 2026-08-01 and 2026-08-10: an oversized layout and a render crash fixed. (`8e62796`, `c233bda`)
- 2026-07-25: first public release. (`fe9bb43`)
- 2026-06-25: initial commit and the Pages deploy workflow. (`36d0fa4`, `5468890`)

## In progress (phase 3, not yet merged)

- Encyclopedia cut from 805 entries to about 260, built from game data, with new pages for spoils, ribbons, upkeep, crates, Hunt and Hold, the med tent, the Sapper, war camps and sectors.
- Story and lore rewritten in one voice for an endless siege, with milestones in place of a victory.
- README rewritten as a manual with developer notes; key tables generated by `scripts/gen-readme-keys.mjs`.
