# Overhaul

Picking this work up? Start with [HANDOFF.md](HANDOFF.md).

A full audit of the game was run on 2026-11-13, after the combat loop, roster, sprites and
sound had been rebuilt. Five reports cover everything else. Each lists what a system does,
whether a player meets it, bugs with file and line, and a proposed rework.

| Report                                                   | Covers                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [economy-progression.md](economy-progression.md)         | buildings, income, research, tech paths, between-run progression                           |
| [factions-events-ops.md](factions-events-ops.md)         | enemy factions, wave make-up, events, spy, courier, spells, strikes                        |
| [screens-ui.md](screens-ui.md)                           | every screen and panel, phone layout, keys, CSS                                            |
| [visuals-animation-sound.md](visuals-animation-sound.md) | buildings, field, effects, unit animation, every sound and music cue                       |
| [combat-core.md](combat-core.md)                         | the fight itself: veterancy, hit and damage rolls, morale, healing, AI (some runs pending) |
| [engine-content.md](engine-content.md)                   | `game.js` structure, saves, performance, modes, achievements, lore                         |

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

## Hotkeys and keybinds

Added by the owner after the audit. Every action gets a key, and keys depend on the state the
game is in:

- A key map per state: main menu, night (deploy and build), day (battle), a unit selected, a
  building selected, placement armed, pause, spoils choice, game over, creative mode.
- No key does two things in the same state. The audit found `U` and `P` doubled, `V`
  unreachable and a dead speed binding ([screens-ui.md](screens-ui.md)).
- Deploy and build keys follow what is unlocked, so new troops such as the Crossbowman are not
  left without one.
- Rebinding in settings, saved per browser, with a reset to defaults.
- The current key for each action shown on its button and tooltip, and a key sheet on `?` that
  lists only the keys that work in the current state.
- Controller and touch equivalents where they fit.

## Decisions

The owner left these to recommendation on 2026-11-13. Each can be reversed.

| Question                          | Decision                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deleting systems                  | Rework and merge freely. Nothing is deleted outright without asking.                                                                                 |
| The game past wave 100            | The era resets that wipe the field go. One field for the whole run; later waves keep scaling and keep their content.                                 |
| Flank attacks                     | Top edge only, in three entry sectors. The map stays one size.                                                                                       |
| Enemy structures                  | Return in a small form: war camps at the top edge that strengthen the next wave unless destroyed.                                                    |
| Crossover hero factions           | Kept, reworked into original characters with new names. Internal ids are renamed with a save migration.                                              |
| Cheats                            | Using one voids that run's score, ribbons and achievements.                                                                                          |
| Online play                       | Share codes only. The broken turn hand-off is fixed; real networking is not built.                                                                   |
| Level editor, creative mode, mods | Kept working, no redesign.                                                                                                                           |
| Unavailable items                 | Greyed out with the reason on hover, not hidden.                                                                                                     |
| Hunt                              | Default for every soldier, on a short leash around the post. Shift + move means hold. The global toggle becomes Hunt and Hold here commands.         |
| Med tent                          | Wounded soldiers go at once when not fighting, and break off below half health when they are. Held soldiers go too and return. The General does not. |
| Hiring                            | One per click; Shift keeps the troop armed.                                                                                                          |
| Spoils choice                     | Centred, field dimmed behind it, nothing else until a choice is made. Event decisions get the same treatment; crates stay quick pickups.             |
| Army upkeep                       | Stays at 7% per soldier past 14, shown on every price.                                                                                               |
| Strong champions                  | Left as marquee picks.                                                                                                                               |
| Fixed keys                        | Space pauses, Tab cycles soldiers, Escape cancels.                                                                                                   |
| Pull requests                     | One per group as it passes the full suite (war, screens, art, content, engine), not one at the end.                                                  |
| Crossover hero ids                | Display names change first; internal ids are renamed later in one step with a save migration.                                                        |

## Hotkeys and keybinds

Added by the owner after the audit. Every action gets a key, and keys depend on the state the
game is in:

- A key map per state: main menu, night (deploy and build), day (battle), a unit selected, a
  building selected, placement armed, pause, spoils choice, game over, creative mode.
- No key does two things in the same state. The audit found `U` and `P` doubled, `V`
  unreachable and a dead speed binding ([screens-ui.md](screens-ui.md)).
- Deploy and build keys follow what is unlocked, so new troops such as the Crossbowman are not
  left without one.
- Rebinding in settings, saved per browser, with a reset to defaults.
- The current key for each action shown on its button and tooltip, and a key sheet on `?` that
  lists only the keys that work in the current state.
- Controller and touch equivalents where they fit.

## Decisions waiting on the owner

- Whether the game past wave 100 (era resets) stays.
- Flank attacks, or the top edge only.
- Enemy structures: bring back or remove.
- Crossover hero factions: keep, rework into original characters, or cut.
- Whether cheats void a run.
- Real online play, or share codes only.

## Reported by the owner

- The scroll bar sometimes gets stuck.
- The mouse wheel should scroll a side menu whenever the pointer is over it.
- Unavailable things (locked or unaffordable troops, buildings and actions) can still be selected. They should not be.
- Cause of the stuck scroll bar, per the owner: an unavailable item had been selected without any sign of it, and the panel kept scrolling back down to it. Fixing the selection bug should fix this; also stop the panel from auto-scrolling to the selected item while the player is scrolling.
