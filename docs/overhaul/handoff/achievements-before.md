# Achievements before the rebuild

Measured on branch claude/p3-achieve at ade2a52 with /home/claude/p3-achieve-shots/measure-old.mjs
(the honest bot of scripts/sim-honest-play.mjs, Normal, three seeds, stopped after wave 12).

## Count by category

| Category                 | Count    |
| ------------------------ | -------- |
| faction (15 hero groups) | 1160     |
| combat                   | 114      |
| difficulty               | 45       |
| waves                    | 44       |
| secrets                  | 27       |
| build                    | 14       |
| tactics                  | 14       |
| army                     | 13       |
| economy                  | 8        |
| specialists              | 7        |
| meta                     | 3        |
| campaign                 | 1        |
| **Total**                | **1450** |

Of the faction entries, 642 are "earn N mastery points" steps (44% of the whole list).

## Cannot be earned, or no longer mean anything, under the current rules

| Reason                         | Count  | Ids                                                                                                                                                            | Note                                                                                                             |
| ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Enemy structures are off       | 3      | `gears_siege_victory`, `gears_siege_6`, `gears_unlock`                                                                                                         | needs enemy buildings razed; none spawn now (war camps will replace them)                                        |
| Era resets removed             | 13     | `era_academy`, `era_rts`, `era_enemy_rts`, `era_hellscape`, `era_academy_master`, `era_rts_master`, `deploy_all_academy`, `hamlet_5`, …                        | named for the Academy / RTS / Enemy RTS / Hellscape eras or for settlements that only existed after an era reset |
| Old global hunt toggle gone    | 1      | `hunt_master`                                                                                                                                                  | Hunt is the default for every soldier; the flag is always set (earned on wave 1, no longer a choice)             |
| Flank attacks removed          | 0      |                                                                                                                                                                | no entry names a flank; nothing to retire here                                                                   |
| Sapper reworked                | 1      | `sapper_siege`                                                                                                                                                 | still earnable; text was stale. `sapper_siege` now also counts iron colossi and hellmortars                      |
| Creative start                 | 1      | `creative_sandbox`                                                                                                                                             | the emitters send creative:false and Creative blocks achievements                                                |
| Needs every other achievement  | 1      | `millennium`                                                                                                                                                   | rule unlocked_count:1449, includes the unreachable ones                                                          |
| Cheat-only in practice         | 18     | `wwe_grand_slam`, `ultimis_grand_slam`, `primis_grand_slam`, `halo_grand_slam`, `gears_grand_slam`, `lotr_grand_slam`, `baki_grand_slam`, `jojo_grand_slam`, … | all 104 operatives and 29 champions recruited, or typing a code; a cheat now voids the run                       |
| Counts achievements (316 club) | 2      | `club_316`, `bottom_line`                                                                                                                                      | two entries, one rule; 316 is out of reach of an honest player and gates a building                              |
| **Distinct ids**               | **40** |                                                                                                                                                                |                                                                                                                  |

## Possible in code, out of reach of honest play

| Group                                                             | Count |
| ----------------------------------------------------------------- | ----- |
| Wave marks above 100 in one run                                   | 83    |
| Mastery ladder (1 point a kill, 25-point steps)                   | 642   |
| Per-operative recruit / field / kill / ability ladders            | 358   |
| Kill counts of 5,000+ in one run, 10,000 TP banked, doom hero set | 8     |

## Earned by an honest bot

| Seed | Wave reached | Unlocked | Of which by wave 5 |
| ---- | ------------ | -------- | ------------------ |
| 4000 | 12 cleared   | 44       | 18                 |
| 4131 | 12 cleared   | 45       | 17                 |
| 4262 | 12 cleared   | 43       | 14                 |

Earned within the first five waves in every run (14), without trying:

- `army_10` Company: Field 10 allies at once.
- `bronze_star` Bronze Star: Earn a bronze star.
- `first_veteran` Promoted: Earn a veteran upgrade.
- `foe_first_goblin` Goblin Blood: Slay your first Goblin.
- `foe_first_harpy` Harpy Blood: Slay your first Harpy.
- `foe_first_orc` Orc Blood: Slay your first Orc.
- `foe_first_plague_rat` Plague Rat Blood: Slay your first Plague Rat.
- `foe_first_warg_rider` Warg Rider Blood: Slay your first Warg Rider.
- `gold_star` Gold Star: Earn a gold star.
- `hunt_master` Hunt Master: Clear a wave with Hunt mode on.
- `kills_1` First Blood: Slay 1 enemies in one battle.
- `kills_10` Skirmisher: Slay 10 enemies in one battle.
- `reach_wave_1` First Stand: Reach wave 1 in a single battle.
- `silver_star` Silver Star: Earn a silver star.

Earned within the first five waves in some runs (5): `foe_first_assassin`, `foe_first_orc_archer`, `horde_survive`, `mage_splash`, `reach_wave_5`.

Each of these raised its own toast (3.4 s on screen plus 0.4 s gap), so the first five waves showed about 53 seconds of toasts.

## Duplicates of a ribbon

| Ribbon (js/siege-loop.js)        | Achievement doing the same thing                           |
| -------------------------------- | ---------------------------------------------------------- |
| First Blood (clear wave 1)       | `reach_wave_1`, `kills_1 (name clash "First Blood")`       |
| Ten Dawns (wave 10)              | `reach_wave_10`                                            |
| Quarter Siege (wave 25)          | `reach_wave_25`                                            |
| Half Siege (wave 50)             | `reach_wave_50`                                            |
| The Hundred (wave 100)           | `reach_wave_100`, `era_academy`, `true_victory_worldheart` |
| Butcher (1,000 kills lifetime)   | `lifetime_kills_500`, `lifetime_kills_2000`                |
| Reaper (10,000 kills lifetime)   | `lifetime_kills_10000`, `kills_500 (name clash "Reaper")`  |
| Clean Hands (5 waves, no losses) | `boss_flawless`, `the 13 diff_*_flawless_*`                |

Duplicates inside the list: `club_316` and `bottom_line` (same rule); names "Officer Corps" and "Seven Star Fist" used twice.
