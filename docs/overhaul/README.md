# Overhaul

A full audit of the game was run on 2026-11-13, after the combat loop, roster, sprites and
sound had been rebuilt. Five reports cover everything else. Each lists what a system does,
whether a player meets it, bugs with file and line, and a proposed rework.

| Report                                                   | Covers                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| [economy-progression.md](economy-progression.md)         | buildings, income, research, tech paths, between-run progression     |
| [factions-events-ops.md](factions-events-ops.md)         | enemy factions, wave make-up, events, spy, courier, spells, strikes  |
| [screens-ui.md](screens-ui.md)                           | every screen and panel, phone layout, keys, CSS                      |
| [visuals-animation-sound.md](visuals-animation-sound.md) | buildings, field, effects, unit animation, every sound and music cue |
| [engine-content.md](engine-content.md)                   | `game.js` structure, saves, performance, modes, achievements, lore   |

The reports describe the code as it was on that date. Line numbers drift as the work lands.

## Order of work

1. **Fixes and foundations.** Bugs the audit found, prices that match what is charged, usable
   save slots, the dominant courier and spy actions, research pacing against the new roster,
   buildings and the field redrawn, unit animation gaps, status marks.
2. **Screens.** Real tabs, readable text, a phone layout, one modal style.
3. **Research and progression.** One tree with either/or choices, one between-run track.
4. **Enemy factions.** A wave make-up and tactic per faction.
5. **Off-field actions and events.** Fewer actions, each visible on the field.
6. **Content.** Achievements, encyclopedia, lore, README.
7. **Engine.** Split `game.js`, versioned saves, performance.

Sound and music passes run alongside each step.

## Decisions waiting on the owner

- Whether the game past wave 100 (era resets) stays.
- Flank attacks, or the top edge only.
- Enemy structures: bring back or remove.
- Crossover hero factions: keep, rework into original characters, or cut.
- Whether cheats void a run.
- Real online play, or share codes only.
