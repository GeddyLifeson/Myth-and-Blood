# Combat core audit

Audited at commit `4347711` (branch `claude/phase2`; the tree is identical to `main` at `ade2a52`, which another process checked out during the audit). Nothing in the repository was edited. All scripts and raw results are in `/home/claude/audit/combat/`.

## How this was measured

- **Reading**: `js/game.js`, `js/units.js`, `js/game-core.js`, `js/game-depth.js`, `js/siege-loop.js`, `js/roster.js`, plus the combat hooks in `js/content-expansion.js`, `js/strategy-counterplay.js`, `js/economy-rules.js`, `js/perks.js`. `js/formations.js` only places units on a move order and has no combat effect. `js/spatial.js` is a lookup grid.
- **Bot runs** (`bot.mjs`): the same bot as `scripts/sim-honest-play.mjs`. It buys footman, archer, footman, archer, healer, mage, footman, archer, knight in a loop as TP allows, drops them in a band at the bottom of the field and calls each wave early. It builds nothing, researches nothing, promotes nobody, casts nothing and gives no orders. A knight needs Iron Weapons, so that slot is skipped. Logged per wave: army size, mean and top experience, deaths, wounded share, breaches, enemies routed, health lost, time to clear, the stat line of the oldest footman, archer and healer, and the stat line of every enemy type that spawned.
- **Skirmishes** (`duel.mjs`): fresh or veteran soldiers against wave-N enemies scaled by the game's own spawn code, in full daylight (the best case for the enemy, see 2.2).
- **Counterfactuals**: the game source is patched in memory by the scratch scripts (`lib.mjs`, `PATCHES`), never on disk.
- **Curves** (`curve.mjs`, `vetcurve.mjs`): enemy and veteran stat lines produced by calling the game's own functions.
- The sandbox seeds `Math.random`, so one seed replays the same run, but any change shifts every later roll. Treat single runs as samples and read the ranges.
- The machine was shared with other jobs and heavily loaded. That limited most counterfactuals to one seed; the seeds are listed in every table. Wave 30 was not reached by a live run (the longest reached wave 25); wave-30 figures are computed from the formulas and marked as such.

The field is 400 x 600. Enemies enter at the top, the deploy line is at y = 580, the rally line at y = 500. The muster zone is the top 252 px (42%).

---

## Summary

Normal is too easy for four reasons that multiply each other. A soldier's attack rate and damage grow without limit while the enemy's do not. Most of the enemy host runs away instead of fighting. One healer out-heals the whole host from about wave 6. And the earlier "+53% count, x1.84 health, x1.64 damage" change reached the head count but only 3 of 46 enemy types for health and damage.

Ranked causes are in 9.4, the proposal in section 10, the bug list in section 11.

---

## 1. Veterancy

### 1.1 Every way a soldier gets stronger

| Source                                                | What it does                                                                                                                                                                                                                                                                                                                                                      | Growth and cap                               | Stacks                                    | Where                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| Starting experience                                   | Footman 5, archer 8, crossbowman 7, mage 10, cavalry 6, knight 8, pikeman 5, scout 6, General 15. Enemies start at 0 and never gain any.                                                                                                                                                                                                                          | fixed                                        | n/a                                       | `data/units.json`; `units.js:1678`                                         |
| Experience gained                                     | +1 per wave cleared; +2 per kill (+1 per Veterans' Due spoil, up to 3; +1 with the Old Guard ribbon); +5 per promotion; +1 per crate opened                                                                                                                                                                                                                       | **no cap**                                   | adds                                      | `game.js:3384`, `game.js:13572`, `units.js:1321`, `siege-loop.js:990`      |
| Experience: damage                                    | +2 damage per 3 experience, added before every multiplier                                                                                                                                                                                                                                                                                                         | **no cap**                                   | flat, then multiplied by everything below | `game.js:3640`                                                             |
| Experience: attack rate                               | Ticks between attacks = 90 - 4 x experience + random 0..19, floor 12 (x reload for crossbow and sapper)                                                                                                                                                                                                                                                           | reaches the 12-tick floor at 24.5 experience | n/a                                       | `game.js:14422`, `game.js:14454`                                           |
| Stars                                                 | +1 bronze per kill and per wave cleared; 3 bronze = silver, 3 silver = gold, 3 gold = honor name, promotion unlocked, stars reset. Each star: health x1.014 / 1.028 / 1.045 and the primary stat by the same factor **with a minimum of +1**; accuracy +1 (silver) or +2 (gold) up to 68; melee morale cap +1/+1/+2 up to 45; ranged range x1.008 / 1.016 / 1.032 | **no cap** on health, damage or range        | multiplies the base stat                  | `units.js:997-1096`, `units.js:1099-1148`, `game.js:3386`, `game.js:13576` |
| Promotion (U key)                                     | Needs Veteran Doctrine research and a finished gold cycle; costs `ceil(cost x (1.15 + 0.7 x tier))` TP. Tier t: melee health x(1.24 + 0.04t), damage x(1.2 + 0.03t), accuracy +5 + 2t; ranged health x(1.18 + 0.035t), damage x(1.22 + 0.032t), accuracy +6 + 2t, range x(1.06 + 0.012t); +5 experience; +5 flat damage per tier                                  | 6 tiers                                      | multiplies                                | `units.js:1164-1240`, `units.js:1302-1324`, `game.js:3641`, `game.js:4190` |
| Specialist ranks (healer, builder, courier)           | One full promotion tier, free, in every wave in which he works. Healer tier t: heal x(1.28 + 0.06t), range x(1.1 + 0.03t), health x(1.18 + 0.05t). After tier 6 each working wave adds a gold-star bump (heal x1.045)                                                                                                                                             | 6 tiers, then unbounded bumps                | multiplies                                | `units.js:1257-1272`, `game.js:14149`, `game.js:8879`                      |
| Kills and waves-survived tallies                      | Messages for fallen veterans, the Old Guard ribbon, squad list order. No stat effect                                                                                                                                                                                                                                                                              | -                                            | -                                         | `siege-loop.js:855`, `siege-loop.js:1168`                                  |
| Honor name                                            | A name. No stat effect                                                                                                                                                                                                                                                                                                                                            | -                                            | -                                         | `units.js:969`                                                             |
| Field tenure                                          | Ordinary soldiers get nothing. Operatives and champions get +3.8% health and +2.8% damage per wave survived (cap x2.15 / x1.75). Enemy operatives that live into the next wave get +10% / +7.2% per wave (cap x4.2 / x3.4)                                                                                                                                        | capped                                       | multiplies                                | `game-depth.js:727-776`, `game.js:8784`                                    |
| "Obsolete" penalty                                    | Ordinary soldiers lose damage as the wave number rises: x0.93 for a fresh recruit at wave 30, x0.83 at wave 50; a soldier with tenure is exempt until about wave 40                                                                                                                                                                                               | floor x0.5                                   | multiplies                                | `game-depth.js:715`, `game.js:3704`                                        |
| Spoils                                                | Sharpened Steel +10% damage, Hardened Shields -8% damage taken, Field Surgeons +15% health each night, Steady Hearts +10 morale each night, Veterans' Due +1 experience per kill, Giant Killers +20% to bosses and elites, Flanking Drill +20% from behind. Up to 3 of each                                                                                       | 3 stacks; damage-taken floor 0.5             | stacks add to each other, then multiply   | `siege-loop.js:23-90`, `siege-loop.js:1128-1154`                           |
| Ribbons (permanent)                                   | +3% damage twice, -3% damage taken twice, +1 experience per kill, breach limit +1 twice, starting TP                                                                                                                                                                                                                                                              | fixed                                        | add to spoils                             | `siege-loop.js:93-210`                                                     |
| General                                               | Aura only when stationed in a keep: strength = min(1, 0.08 + 0.18 per minute alive + 0.045 per command star); at full strength +45% melee damage, +38% ranged damage, +18 accuracy, -20% damage taken, radius 165. War Cry: x1.2 damage for 8 s, +20 morale, 45 s cooldown. Hold the Line: x0.6 damage taken for 7 s, 60 s cooldown                               | strength 1                                   | multiplies                                | `game-depth.js:148`, `game.js:3567-3636`, `siege-loop.js:1200-1260`        |
| Doctrines                                             | Outpost Stand -15% damage taken for 6 s (4 TP); Imperial March x1.15 and Hellforge Decree x1.2 damage (kingdom stage 3 and 4, wave 100+)                                                                                                                                                                                                                          | one per wave                                 | multiplies                                | `units.js:423`, `game.js:9628`                                             |
| Kingdom stage 1                                       | Footman, archer, pikeman spawn with +5% health                                                                                                                                                                                                                                                                                                                    | fixed                                        | multiplies                                | `units.js:398`, `game.js:4301`                                             |
| Roster auras                                          | Shield Wall (footman, pikeman): -12% damage taken per neighbour within 42 px, up to -36%. Scout: ranged +12% within 150 px. Builder: -10% within 70 px. Healer: 1.2% health per second within 70 px. Bard: +1 morale per second within 100 px                                                                                                                     | fixed                                        | multiplies                                | `roster.js:17-135`, `roster.js:1084-1175`                                  |
| Last stand                                            | With 2 or fewer soldiers left: x1.28 damage, -22% damage taken                                                                                                                                                                                                                                                                                                    | fixed                                        | multiplies                                | `game-depth.js:31-35`, `game.js:3649`                                      |
| Research                                              | Unlocks only. `research.js` holds no combat multiplier. `tech-tree-branches.js` has up to +12% damage and health                                                                                                                                                                                                                                                  | -                                            | -                                         | not exercised                                                              |
| Academies, operatives, champions, skill trees, tonics | Behind research and between-run unlocks                                                                                                                                                                                                                                                                                                                           | -                                            | -                                         | not exercised                                                              |

Order inside `calcDamage` (`game.js:3638`): (base damage + random + experience bonus + 5 x tier) x General aura x last stand x charge x rally x doctrine x class counter x rear x (1 + spoils and ribbons) x War Cry x roster traits x anti-air and anti-cavalry x legacy bonuses x obsolete penalty. Everything after the first bracket multiplies.

### 1.2 What a survivor from wave 1 looks like

Produced with the game's own `addVetStar` and the formulas above (`vetcurve.mjs`). "Typical" uses the kill rate measured for the oldest soldier of each type in the bot runs: about 0.15 kills a wave for a footman and 1 a wave for an archer. "Top archer" is the army's best shooter (3.5 kills a wave). The measured oldest archer on Normal seed 4262 at wave 20 had 234 health, 135 damage, 68% accuracy, 171 experience and 479 range; the curve gives 242, 140, 68%, 159 and 489. The measured oldest footman at wave 20 had 163 health, 42 damage, 43%, 27 experience; the curve gives 167, 43, 44%, 28. "Blow" is the mean damage of a hit including the experience bonus. Damage per second is accuracy x blow / interval, with the archer's +20% Volley and no other trait. Wave 30 is computed, not played.

| Wave          | Footman, typical: health / damage / accuracy / experience | blow | interval (ticks) | dmg per s | Archer, typical: health / damage / accuracy / experience / range | blow | interval | dmg per s | Top archer: health / damage / accuracy / experience / range | dmg per s |
| ------------- | --------------------------------------------------------- | ---- | ---------------- | --------- | ---------------------------------------------------------------- | ---- | -------- | --------- | ----------------------------------------------------------- | --------- |
| 1             | 120 / 22 / 35% / 5                                        | 30   | 80               | 8         | 60 / 28 / 40% / 8 / 210                                          | 36   | 68       | 15        | 60 / 28 / 40% / 8 / 210                                     | 15        |
| 5             | 126 / 26 / 36% / 9                                        | 38   | 64               | 13        | 68 / 36 / 42% / 20 / 222                                         | 52   | 20       | 79        | 84 / 47 / 48% / 40 / 248                                    | 220       |
| 10            | 138 / 32 / 39% / 16                                       | 48   | 36               | 31        | 84 / 47 / 48% / 35 / 248                                         | 72   | 12       | 209       | 116 / 70 / 56% / 79 / 309                                   | 422       |
| 15            | 151 / 38 / 41% / 23                                       | 58   | 13               | 111       | 97 / 57 / 51% / 50 / 272                                         | 92   | 12       | 283       | 168 / 103 / 66% / 120 / 391                                 | 738       |
| 20            | 167 / 43 / 44% / 28                                       | 66   | 12               | 146       | 112 / 68 / 55% / 65 / 303                                        | 114  | 12       | 375       | 242 / 140 / 68% / 159 / 489                                 | 1018      |
| 30 (computed) | 202 / 55 / 48% / 42                                       | 88   | 12               | 212       | 151 / 94 / 63% / 95 / 367                                        | 160  | 12       | 603       | 555 / 309 / 68% / 239 / 807                                 | 1920      |

A footman who never lands a killing blow: wave 1: 120 health, 22 damage, 5 experience, interval 80, 8 per s; wave 5: 126 health, 26 damage, 9 experience, interval 64, 13 per s; wave 10: 137 health, 31 damage, 14 experience, interval 44, 24 per s; wave 15: 145 health, 36 damage, 19 experience, interval 24, 55 per s; wave 20: 161 health, 41 damage, 24 experience, interval 12, 134 per s; wave 30: 188 health, 51 damage, 34 experience, interval 12, 181 per s.

Enemy rank and file on Normal, from the game's spawn scaling (`curve.mjs`). Every enemy attacks every 90-109 ticks (mean 99.5) at every wave. "Nominal host" is the wave config count times the difficulty multiplier; the hosts that actually appeared are in 8.2 (smaller in the first waves, larger later because of summons and horde waves).

| Wave | Nominal host | Goblin: health / damage / accuracy, dmg per s | Orc                  | Orc archer           | Troll (operative)    | Dark knight (operative) |
| ---- | ------------ | --------------------------------------------- | -------------------- | -------------------- | -------------------- | ----------------------- |
| 1    | 8            | 36 / 12 / 22%, 2.3                            | 85 / 20 / 26%, 4.1   | 50 / 18 / 32%, 4.1   | 294 / 47 / 28%, 9.0  | 211 / 41 / 42%, 11.6    |
| 5    | 14           | 40 / 13 / 28%, 3.1                            | 95 / 22 / 32%, 5.4   | 56 / 19 / 38%, 5.1   | 296 / 47 / 34%, 10.9 | 212 / 41 / 48%, 13.3    |
| 10   | 32           | 48 / 15 / 35%, 4.3                            | 113 / 25 / 40%, 7.4  | 66 / 23 / 45%, 7.2   | 303 / 47 / 42%, 13.3 | 217 / 41 / 55%, 15.4    |
| 15   | 52           | 55 / 17 / 44%, 5.9                            | 132 / 29 / 48%, 10.1 | 77 / 26 / 54%, 9.5   | 314 / 49 / 50%, 16.6 | 226 / 42 / 64%, 18.2    |
| 20   | 72           | 64 / 20 / 51%, 7.8                            | 151 / 33 / 56%, 13.0 | 89 / 30 / 61%, 12.3  | 330 / 50 / 58%, 19.4 | 236 / 44 / 71%, 21.2    |
| 30   | 90           | 80 / 24 / 53%, 9.4                            | 190 / 41 / 58%, 16.3 | 112 / 37 / 63%, 15.4 | 369 / 55 / 60%, 21.9 | 264 / 48 / 73%, 23.6    |

Growth of the same soldier and the same enemy type, wave 1 = 1.0:

| Unit                    | Health x at wave 10 / 20 / 30 | Damage per second x at wave 10 / 20 / 30 |
| ----------------------- | ----------------------------- | ---------------------------------------- |
| Footman, no kills       | 1.14 / 1.34 / 1.57            | 3.1 / 17.2 / 23.2                        |
| Footman, typical        | 1.15 / 1.39 / 1.68            | 4.0 / 18.8 / 27.2                        |
| Archer, no kills        | 1.18 / 1.42 / 1.63            | 3.4 / 13.3 / 17.3                        |
| Archer, typical         | 1.40 / 1.87 / 2.52            | 13.8 / 24.8 / 39.9                       |
| Top archer              | 1.93 / 4.03 / 9.25            | 27.9 / 67.4 / 127.1                      |
| Goblin                  | 1.33 / 1.78 / 2.22            | 1.9 / 3.4 / 4.1                          |
| Orc                     | 1.33 / 1.78 / 2.24            | 1.8 / 3.2 / 4.0                          |
| Orc archer              | 1.32 / 1.78 / 2.24            | 1.8 / 3.0 / 3.8                          |
| Troll (operative)       | 1.03 / 1.12 / 1.26            | 1.5 / 2.2 / 2.4                          |
| Dark knight (operative) | 1.03 / 1.12 / 1.25            | 1.3 / 1.8 / 2.0                          |

### 1.3 Findings

1. **Attack rate is the largest single term.** The interval formula suits a soldier who gains a few points in a run. A footman who never kills anything still reaches the 12-tick floor at wave 20, because he gets +1 a wave on top of a starting 5. Every enemy stays at 90-109 ticks. A veteran attacks 8 times for each enemy attack. `game.js:14422`, `game.js:14454`.
2. **The experience damage bonus has no cap** and is paid on kills, so the best shooter snowballs: 171 experience is +114 damage on a weapon whose base is 28. `game.js:3640`.
3. **The +1 minimum on star bumps** (`units.js:1010-1014`) turns a 1.4% bronze star into +4.5% for a footman (22 damage). Measured: +20 damage after 20 stars (+91%); the multipliers alone would give +44%.
4. **Range grows with every star and has no cap.** A top archer reaches 479 at wave 20 on a field 600 deep. `units.js:1016-1020`, `units.js:1080-1085`. `bumpUnitRange` also applies the factor to `range` twice per star (it scales `baseRange`, then sets `range` to the new base times the factor again), so the range shown on the unit card runs one step ahead of the range used for shooting (`getEffectiveRange` reads `baseRange`).
5. **A healer gains a full promotion tier every wave for free.** Measured: tier 6 by its sixth or seventh wave; at wave 10 heal 212-230 every 70 ticks at range 311-330; at wave 20 heal 296-351 at range 395-446 with 524-622 health. One 5 TP healer covers the whole army. `units.js:1257-1272`.
6. **Promotions compound.** Six tiers take a footman from 115 health and 22 damage to 782 and 103 before stars (computed with `upgradeVeteranUnit`); an archer to 283 health, 146 damage and 372 range; a knight to 1,086 and 189. The bot never promotes, so no run below includes this. A player who researches Veteran Doctrine is far stronger than the bot.
7. Honor names, kill counts and waves survived do nothing mechanically. Ordinary soldiers get no tenure health.

All of this works as coded. It does not work as a difficulty curve: every term above is open-ended and the enemy has no matching term.

---

## 2. To-hit and damage

### 2.1 The roll

`fireWeapon` (`game.js:13785`):

- Hit chance = accuracy + General aura accuracy + operative synergy and skill bonuses. For enemies, minus the sight penalty (2.2), floor 4%.
- A ranged attacker firing beyond 80% of his range has the chance multiplied by 0.6 (`game.js:13808`).
- Melee resolves at once: `Math.random() * 100 <= hit`.
- A ranged attack launches a projectile that flies to where the target stood, then rolls against the target by id wherever he is now (`game.js:15357-15382`). A target cannot step out of a shot; a shot at a target that died is lost.
- Player accuracy: footman 35, archer 40, mage 45, knight 38; stars raise it to at most 68 (General 72).
- Enemy accuracy: base + floor(18 x ease) (`game-depth.js:578`, ease is 0.10 at wave 20) + min(30, 1.5 x wave), cap 85 (`roster.js:728`). Orc 26.5% at wave 1, 40% at wave 10, 56% at wave 20. Goblin 21.5% to 51%.
- Only the Hellbreaker hero always hits. Nothing else never misses.

### 2.2 The sight penalty (hidden, and doubled for arrows)

`getSightPenaltyForUnit` (`game.js:2931`) takes accuracy from enemies only: `floor((1 - light) * 24)`, where light falls from 1.0 to 0.52 as the wave is cleared (`getDayLightLevel`, `game.js:2918`). The first enemies of a wave shoot at full accuracy; the last ones lose 11 points. At night it is 44. A watchtower adds 8 each (up to 24).

**Bug**: an enemy arrow or bolt pays the penalty twice, once when fired (`game.js:13805`) and again when it lands (`game.js:15363`). Late in a wave an orc archer at wave 10 hits 45 - 22 = 23% at best, and 14% at long range.

### 2.3 Damage dealt

`calcDamage` (`game.js:3638`): base damage + random (0..11 melee, 0..7 projectile) + 2 x floor(experience / 3) + 5 x tier, then the multipliers listed in 1.1. Minimum 1.

- **There are no critical hits.** `crit` at `game.js:13421` is true for any blow of 45 or more and only changes the effects shown.
- Class counters (`siege-loop.js:1073`): pikeman x1.6 against riders; cavalry, knight, scout x1.4 against shooters; archer x1.25 against goblins and rats, x0.8 against armour; mage and ballista x1.35 against armour; footman x1.2 against berserkers. Enemy riders x1.3 against archers, mages, healers and bards, x0.75 against pikemen; troll x1.2 against footmen and pikemen. `counterMult` never returns less than 0.75.
- Rear attack (`siege-loop.js:1133`): x1.25 (+0.2 per Flanking Drill for the player), and the target loses 1.5 morale. How often it happens in play was not measured.
- Roster traits on damage dealt (`roster.js:789`): archer +20% at 120 px or more and -40% within 55 px; cavalry and scout +60% against line-breakers; ballista +35% against bosses, monsters and elites; crossbow +40% against armour; orc and berserker +25% and +35% below half health; goblins up to +42% in a pack; warg and harpy first strike +80% and +60%; assassin +50% from behind; war chief aura +15%; hexed attackers -20%.
- Splash: a mage bolt deals 45% to enemies within 40 px of the target (`game.js:15390-15417`); a knight's cleave 45% to one neighbour; a goblin sapper's death burst 34 within 46 px.

### 2.4 Damage taken

`takeDamage` (`game.js:13352`): mitigation = 1 - cover - wall protection - 0.22 (knight) - General aura - 0.22 (last stand) - 0.1 (rallied) - doctrine - 0.08 (elite enemy), floor 0.12, so at most 88% of a blow is removed. Then: spoils and ribbons (floor x0.5), Hold the Line x0.6, and the roster traits (`roster.js:887`): Shield Wall up to -36%, shaman ward and builder aura -10%, dark knight x0.7 and siege tower x0.6 against arrows, berserker x1.15, courier 35% dodge against missiles. A sapper's blast skips all roster reductions.

### 2.5 Bugs

- **A missile's damage is computed on a copy of the shooter** (`game.js:15379-15382`, `{ ...shooter, damage }`). Everything `Roster.modifyDamage` and `SiegeLoop.modifyDamage` write to the attacker is thrown away:
  - The mage's Arcane Burst counter (`roster.js:864`) never reaches 4. Verified: `swingN` is still undefined after the mage's hits. The trait in the unit card never happens; mages only have the 45% missile splash.
  - `attacker.mustered = true` (`siege-loop.js:1131`) is lost for enemy shooters. Verified: an orc archer shooting from inside the muster zone stays untargetable beyond 140 px until it walks out or 25 seconds pass.
  - By the same path a ranged operative with a first-strike bonus gets it on every shot and one with a ramp never ramps. Read from the code, not run.
- Enemies that appear during a wave are not scaled. Summoner minions (necromancer, bone summoner, Morwen) are made with a bare `createUnit` at 70% health (`content-expansion.js:1549-1562`); boss phase adds and crate ambushes come through `siegeCtx.spawnEnemy` (`game.js:2875`). Neither path runs `applyEnemySpawnScaling`, `Roster.onSpawn` or the difficulty multipliers. Measured on Normal at wave 20: summoned goblins have 30 health and 24% accuracy; a goblin spawned with that wave has 64 and 51%. On Hellbane they are the same 25-30 health goblins.
- Cavalry and scout "+60% against routing enemies" cannot apply: a routing enemy is not a valid target (`isValidCombatFoe`, `game-core.js:429`). Only the line-breaker half of the trait works.

### 2.6 Contribution

The to-hit rules themselves are sound. The sight penalty and its doubling cut enemy missile damage by a quarter to a half late in each wave. Raising enemy accuracy by 20 points across the board was tested as a counterfactual: see section 9.

---

## 3. Morale

### 3.1 Rules

- Starting morale: footman 15, archer 12, mage 10, knight 20, General 28. Goblin 8, orc 12, orc archer 10, troll 18, war chief and berserker 25, bosses 28-32.
- Break point: morale at or below `max(4, floor(0.28 x max morale))` (`game-core.js:425`).
- Loss:
  - A comrade dies within 150 px in line of sight: -2, or -3 within 70 px; +3 more if it was the General; +1 more for enemies when an elite died. **Three such deaths break a unit whatever its morale** (`MORALE_WITNESS_BREAK_COUNT`, `game.js:2178`, `game.js:2558-2575`). The count fades by 1 every 250 ticks.
  - Any soldier dies: every soldier on the field loses 1 (4 for the General) (`game.js:2577-2586`).
  - Hit while under 25% health: -2 (`game.js:13672-13686`).
  - Hit from behind: -1.5. A breach: -4 to every soldier (`siege-loop.js:712`).
- Gain (player only): +1 per wave cleared, +1 or +2 at nightfall, morale buildings, bard +1 per second, War Cry +20, rations crate +12, Steady Hearts +10 a night. Star bumps raise a melee soldier's maximum to 45.
- The enemy has no way to regain morale.
- What a break does:
  - Soldier, waves 1-2: STANDS FIRM, morale reset (`game.js:2266`).
  - Soldier, wave 3-99: ROUT. He walks off the bottom edge and is removed. That removal does not go through `takeDamage`, so **a deserter is not counted in the run's losses or the score** (`game.js:2630-2640`).
  - Soldier, wave 100+: GAVE UP, stands idle until the General reaches him.
  - Enemy: ROUT. It runs back up the field at 1.35x speed, cannot be targeted, and is removed after 180 ticks. No kill, no experience, but it counts toward clearing the wave (`game.js:2589-2630`).
- Fearless: only the berserker. **Bosses are not exempt.** Verified: Gorath (32 morale, full health) routed in 5 of 8 trials after goblins died beside him, and vanished.
- Morale is also the pin roll (section 4).

### 3.2 Measured

Normal baseline. "Routed" counts each enemy that started to flee; a few of those are still killed by a missile already in the air, so the share is slightly high.

| Waves | Enemies killed (3 seeds) | Enemies that routed (3 seeds) | Routed as a share of killed + routed | Soldiers routed |
| ----- | ------------------------ | ----------------------------- | ------------------------------------ | --------------- |
| 1-5   | 23-26                    | 13-16                         | 33-41%                               | 0               |
| 6-10  | 69-74                    | 41-48                         | 36-39%                               | 0               |
| 11-15 | 122-127                  | 116-133                       | 48-52%                               | 0               |
| 16-20 | 184-197                  | 152-178                       | 44-49%                               | 0               |
| 21-24 | 135-193                  | 130-187                       | 47-51%                               | 0               |

No soldier routed in any Normal baseline run through wave 24. With no deaths there is nothing to witness, and the oldest footmen have 37-45 morale by wave 20.

### 3.3 Verdict

The player side works but is never tested. The enemy side is the second largest cause of the difficulty problem: a host that loses three men in one place falls apart, and grunts with 8-12 morale break after two or three deaths. Fast veterans produce those deaths in the first seconds of contact, and the rest of the squad leaves without striking a blow.

---

## 4. Pinning and suppression

- Any damage to a fighting unit can pin it (`game.js:13494-13507`): chance = 100 - morale (- 15 while rallied). A fresh footman is pinned by 85% of hits; a goblin by 92%.
- The timer is set to 50 ticks but is counted down twice a tick, once in the main loop (`game.js:15212`) and once in `updateUnitCombat` (`game.js:14405`; healers at `game.js:14100`). **A pin lasts 24-25 ticks** (measured), not 50.
- A pinned unit does not attack and (enemies) does not move. A pinned soldier's attack timer stops.
- Enemies are immune for 290 ticks after a pin (`game.js:13506`). Soldiers have no immunity window.
- Cannot be pinned: dark knight, siege tower, the bosses Volk and Malachar (`noPin` in `roster.js`). Other bosses can be pinned by an ordinary hit; only the operative "stagger" pin checks for bosses (`roster.js:764`).
- Healers, builders and couriers are never pinned.
- A soldier heading for the med tent has his pin cleared (`game.js:12778`).

Measured in a one-on-one probe (`probe-pin.mjs`): pins on the orc lasted 24 ticks; pins on the footman averaged 32 because a new hit re-pins him before the first one ends. The probe ran under the night sight penalty, so its hit rates are not quoted.

Verdict: with the immunity window, pinning no longer holds enemies in place (at most 24 ticks in every 314). For the player it is a tax on fresh troops that veterans largely escape: 85% pin chance at 15 morale falls to 58-63% at 37-42. Small contribution to the difficulty problem. The halved duration is a bug or an undocumented change; decide which and make the constant say what happens.

---

## 5. Healing and attrition

### 5.1 Rules

| Source          | Rate                                                                                                                                                                             | Where                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Healer          | Heals the most wounded ally in range for `healAmount` every 70 ticks. Base 20 at range 100. Two healers do not double up on one soldier.                                         | `game.js:14095-14160`                                        |
| Healer rank     | See 1.3 item 5: 20 / 26 / 36 / 52 / 79 / 124 / 203 by tier, range 100 to 302, health 60 to 356, one tier per working wave                                                        | `units.js:1164-1175`, `units.js:1257`                        |
| Mass Mend       | From the healer's third working wave: every 200 ticks, every wounded ally within 1.1 x range gets 72% of `healAmount`                                                            | `game.js:14104-14128`                                        |
| Field Dressing  | 1.2% of max health per second to every ally within 70 px of a healer                                                                                                             | `roster.js:1148`                                             |
| Med tent (5 TP) | 0.56% of max health per tick per bed: empty to full in 3 seconds by day, 2 by night. 4 beds. Soldiers queue outside and still strike what comes in reach.                        | `game.js:12977`, `game.js:12532`                             |
| Med tent rule   | Go at any missing health when not in an exchange (`MED_SEEK_HP_RATIO = 1`); break off a fight below 50%; at 25% or less always go (`RETREAT_HP_RATIO`). The General does not go. | `game.js:12526-12535`, `game.js:12624-12645`, `units.js:822` |
| Stretcher       | Once per wave per tent, a soldier killed within 220 px is set to 25% health and placed in the tent                                                                               | `game.js:4671`, `economy-rules.js:46`                        |
| Night           | +0.2% health once at nightfall for soldiers near the deploy line; +4% beside a morale building; +15% per Field Surgeons spoil                                                    | `game.js:3474-3511`, `siege-loop.js:858`                     |
| Crate           | 25% of crates are bandages: +35% health within 150 px                                                                                                                            | `siege-loop.js:974`                                          |
| Enemy           | Troll regrows 1.5% a second; shaman heals 15 every 70 ticks and wards -10%                                                                                                       | `roster.js:353`, `roster.js:387`                             |

Without a healer, a tent or a spoil, wounds carry over from wave to wave.

### 5.2 Measured

Normal baseline, 3 seeds. The first healer arrives in wave 3 or 4 (fifth purchase).

| Waves | Health lost by the army per wave | Army health at the end of the wave | Deaths |
| ----- | -------------------------------- | ---------------------------------- | ------ |
| 1-5   | 0-180                            | 80-100%                            | 0      |
| 6-10  | 0-956                            | 99-100%                            | 2-3    |
| 11-15 | 0-957                            | 100%                               | 0-1    |
| 16-20 | 0-1514                           | 99-100%                            | 0-1    |
| 21-24 | 107-831                          | 99-100%                            | 0      |

A tier 6 healer mends 203 or more every 70 ticks, about 170 health a second, which is 500,000 over a 3,000-tick wave if it had work. The whole army lost 0 to 1,500 health in a wave at waves 10-24.

### 5.3 Verdict

Healer ranks are the third cause of the problem. They erase the damage the enemy does land, so nothing carries over. The tent on its own is fast (3 seconds to full) but takes men out of the line, limited to 4 at a time; in the one tent comparison run it changed little because the army was hardly being hurt. Its rate should still come down with everything else, or it will be the next thing that makes soldiers immortal once enemies start to hit.

---

## 6. Enemy AI

### 6.1 What it does

- **Spawn**: squads of `min(10, 2 + floor(wave / 4))` arrive together, then a gap of interval x squad x 0.4 ticks (`game.js:14824-14831`). At wave 20 that is 7 enemies about every 190 ticks. The most enemies alive at once on Normal was 42-43 of a 72-91 host at wave 20.
- **Muster**: an enemy is "mustering" until it leaves the top 252 px or 25 seconds pass (`siege-loop.js:1022-1026`). Soldiers will not target it from more than 140 px (`game.js:2496-2503`). Nothing makes the enemy wait there: each one walks on as soon as it spawns, so a "squad" reaches the line strung out by speed (goblin 0.78, orc 0.5, troll 0.28 px a tick).
- **Target** (`findEnemyMoveTarget`, `game.js:7085`): line-breakers go for the line; assassins go for the General; anything goes for a General outside a keep; 35% chance to go for a hamlet or guild in reach; wargs and harpies go for archers, mages and healers; trolls and goblin sappers go for buildings; otherwise the nearest soldier, with a penalty for targets several enemies are already on (`findTacticalTarget`, `game.js:5971`). The enemy spreads out; it does not focus.
- **In range**: it stops and attacks. Orc archers, dark mages and necromancers back off 70 px when a soldier comes within 40% of their range (`game.js:14544-14566`).
- **Line-breakers** (`siege-loop.js:534`): from wave 3, a spawned grunt with range 60 or less becomes one with chance 0.2 (fast) or 0.1 (slow) + 0.004 x wave + up to 0.25 for a big player army; +30% speed, -10% health. Operatives, bosses, shooters and monsters never do. A burrower always is one.
- **Flyers** (`game.js:14490`) fly straight at prey and ignore terrain.
- **Bosses**: named bosses at wave 10, 20, ...; phases at half health (enrage x1.3-1.35, summons) in `roster.js:1065`. Base health 170-240 before scaling.
- **Unopposed**: with no soldier in reach an enemy becomes a line-breaker (`game.js:14666`).
- **Standoff** (`siege-loop.js:592`): whole host on the field and no enemy hurt for 1,800 + 3 x field height ticks (60 s here): everything storms the line. If 20 s later nobody on either side has been hurt and no enemy has moved 24 px, every enemy left is removed ("quits the field").
- **Hunt sweep** (`game.js:2361`): the player-side answer to the same stall. After 10 s with the host formed up and nothing hurt, the hunters nearest the enemy go out as a party.

### 6.2 Measured

Normal, seed 4262.

| Wave | Host (all that appeared) | Line-breakers among them | Breaches |
| ---- | ------------------------ | ------------------------ | -------- |
| 3    | 5                        | 0                        | 0        |
| 5    | 13                       | 4                        | 0        |
| 8    | 23                       | 3                        | 0        |
| 10   | 35                       | 3                        | 0        |
| 12   | 45                       | 2                        | 0        |
| 15   | 68                       | 24                       | 0        |
| 18   | 70                       | 8                        | 0        |
| 20   | 91                       | 13                       | 0        |

Over waves 1-23: 132 line-breakers spawned, 0 breached. Across the three Normal seeds: 0, 1, 0 breaches in 24 waves.

### 6.3 Findings

1. **Line-breakers almost never get through, and from wave 10 there are few of them.** The wave pool from wave 10 is mostly operatives, which cannot be line-breakers. Breaches on Normal: 0, 1 and 0 in 24 waves. The lose condition of the genre is not in play. Horde waves (5, 15, 25) are the exception: 23-24 runners at wave 15, all cut down.
2. **The host does not arrive as a host.** Squads help, but units walk at their own speed from the first tick. The fast ones die first, and their deaths rout the slow ones behind them (section 3).
3. **Bosses are weak and can run away.** Gorath had 312 health on Normal at wave 10 and Morwen 242 at wave 20; an iron colossus in the same wave had 641. A wave-20 top archer deals about 250 a hit.
4. **A shooting enemy inside the muster zone cannot be shot back** from more than 140 px for up to 25 seconds (bug in 2.5). A player who posts troops forward of y = 440 gives orc archers free volleys. The bot's line sits lower, so the runs do not show it.
5. **Camping the muster edge**: nothing stops it. Soldiers posted just below y = 252 engage each enemy as it steps out, one at a time. Not run as a scenario. The leash (240 melee, 140 ranged, measured from the post) does not prevent it because the post itself is forward.
6. **"Quits the field"** only fires after a storm order that produced no blood and no movement for 20 s. Whether it fired in the bot runs was not logged. It can remove live enemies that are wedged; it cannot be triggered by the player holding back, because a storm sends them at the line.
7. Enemy summons are unscaled (2.5).

---

## 7. Player AI

- **Acquire** (`findCombatTarget`, `game.js:13331`): the nearest enemy inside weapon range first; otherwise `findTacticalTarget`: enemies within weapon range + 140 px, in line of sight (not needed for a target already chased or within 130 px), scored by distance, -160 for a line-breaker, -70 for one past his post, +200 and +90 each if a comrade of the same type is on it, +18 per comrade of any type. So soldiers spread across targets; there is no deliberate focus fire. In practice range does the focusing: every archer in reach shoots whatever has left the muster zone.
- **Leash** (`game.js:2317-2322`): a melee soldier fights up to 240 px from his post, a ranged one 140 px plus his range; x1.5 for line-breakers, x1.2 to keep a target already engaged. With a grown range a veteran archer posted at y = 520 reaches the top of the field without moving.
- **Squad assist** (`game.js:6078`): a hunter with nothing in sight takes the target of a fighting comrade within 260 px if it is within 420 px and inside his own leash.
- **Crowding** (`isCrowdedOut`, `game.js:2478`): a soldier will not join an enemy that three comrades are already striking.
- **Hunt sweep**: see 6.1.
- **Post return**: after 120 idle ticks a hunter walks back to his post (`game.js:1561`, `game.js:1634`).
- **Med tent**: section 5.
- **Formations** (`js/formations.js`) arrange a move order. No combat bonus.

What makes the player's troops fight better than the enemy's, in order of size:

1. Attack interval 12 ticks against 90-109 (section 1).
2. They do not rout in practice; the enemy does (section 3).
3. They are healed; the enemy is not (section 5).
4. Range: archers 210 growing to 290-480, against 185 (orc archer), 170 (dark mage), 150 (necromancer). Enemy shooters stop at their own range and trade at a disadvantage.
5. Enemies lose accuracy as the wave goes on (2.2); soldiers never do.
6. Assist and the leash keep the line together; enemies arrive strung out.

Assist and the leash are the designed behaviour and they work. Their measured effect on losses is in section 9.

---

## 8. Economy of force

### 8.1 Rules

- Income per wave (`getTpPerRound`, `game.js:4549`): 7 + floor(30 x ease) + min(5, floor(5 x ease)) + difficulty (Baby +3, Chad -1, Hellbane -2). On Normal that is 7 until wave 14, 8 at wave 15, 10 at wave 20, 14 at wave 30. Plus hamlets and works (the bot has none).
- Early call (`siege-loop.js:904`): min(5, floor(seconds left / 10)) TP. A player who is ready gets +5 every wave, which is 70% on top of base income.
- Crates: 41% hold 3-5 TP (+1 per 10 waves).
- Spoils every 5 waves: War Levy +2 a wave, War Chest +15.
- Enemies pay nothing when killed (`reward: 0` on every type).
- Starting TP 7 (Baby 10, Chad 5, Hellbane 4), plus the 4 soldiers of the opening squad.
- Cost: footman 3, archer 4, healer 5, crossbow 5, mage 6, cavalry 7, knight 8, General 12. Past 14 soldiers each recruit costs +7% per soldier over 14 (`siege-loop.js:502`): x2.1 at 30 soldiers, x3.2 at 45, x3.9 at 55.

### 8.2 Measured (Normal)

_(pending: this run had not finished when the report was written)_

"Host" counts everything that appeared in the wave, summons included. Health and damage per second are sums of live stat lines at the start of the wave (army) or on arrival (host), by the formula in 1.2, traits ignored.

### 8.3 Findings

- The bot fields 17 soldiers at wave 5, 25-28 at wave 10, 33-36 at wave 15, 45-47 at wave 20. Upkeep slows growth to about 2 soldiers a wave; it does not cap it, because nobody dies and nothing else needs the TP.
- The host outnumbers the army from wave 10 (32 against 26) to about 1.6 to 1 at wave 20. Head count was the one part of the earlier difficulty change that landed.
- The army's summed damage per second passes the host's between waves 5 and 10 and is many times larger by wave 15. Numbers stop mattering when one side attacks eight times as often.
- A human who also builds a tent, researches, promotes and uses strikes has more than the bot. A human who posts troops badly has less. The bot's army-only play is a fair "average" for army strength and a low estimate for everything else.

---

## 9. Measured results

### 9.1 Baseline, the live game

| Difficulty | Seeds            | Outcome                                              | Deaths W1-5 | W6-10 | W11-15 | W16-20 | W21+ | Breaches / limit | Army at W10 / W15 / W20 | Mean experience at W10 / W15 / W20 |
| ---------- | ---------------- | ---------------------------------------------------- | ----------- | ----- | ------ | ------ | ---- | ---------------- | ----------------------- | ---------------------------------- |
| Baby       | 4000, 4131       | alive at wave 21; alive at wave 21                   | 0           | 0     | 0      | 0      | 0    | 0/15, 0/15       | 32 / 41 / 54            | 16-17 / 24-26 / 31-32              |
| Normal     | 4000, 4131, 4262 | alive at wave 25; alive at wave 24; alive at wave 24 | 0           | 2-3   | 0-1    | 0-1    | 0    | 0/11, 1/11, 0/11 | 25-28 / 33-36 / 45-47   | 17-19 / 26-28 / 35-36              |
| Chad       | 4000, 4131       | alive at wave 24; alive at wave 24                   | 0           | 3-4   | 0-3    | 2-3    | 0-1  | 0/11, 0/9        | 22-25 / 31-33 / 40-44   | 21 / 27-35 / 37-47                 |
| Hellbane   | 4000, 4131       | defeat in wave 2; defeat in wave 7                   | 0-2         | 0-5   | 0      | 0      | 0    | 0/6, 3/8         | - / - / -               | - / - / -                          |

Normal, wave by wave (3 seeds, ranges):

| Wave | Army  | Mean experience | Top experience | Deaths | Share of army under 60% health (mean over the wave) | Breaches | Most enemies alive at once | Killed | Routed | Soldiers routed | Health lost by the army | Ticks to clear |
| ---- | ----- | --------------- | -------------- | ------ | --------------------------------------------------- | -------- | -------------------------- | ------ | ------ | --------------- | ----------------------- | -------------- |
| 1    | 4     | 5               | 5              | 0      | 0%                                                  | 0        | 5                          | 3      | 2      | 0               | 8-70                    | 731-950        |
| 2    | 8     | 7               | 8-10           | 0      | 1-5%                                                | 0        | 5                          | 4      | 1      | 0               | 43-55                   | 1063-1557      |
| 3    | 10-11 | 9               | 13-15          | 0      | 1-2%                                                | 0        | 5                          | 3-4    | 1-2    | 0               | 0-52                    | 815-928        |
| 4    | 12-15 | 9-10            | 18-19          | 0      | 0-1%                                                | 0        | 10                         | 6-9    | 2-5    | 0               | 67-180                  | 1363-2024      |
| 5    | 17    | 11              | 23-30          | 0      | 0%                                                  | 0        | 11-13                      | 6-8    | 5-9    | 0               | 0-71                    | 774-964        |
| 6    | 19    | 12-13           | 24-37          | 0      | 0-1%                                                | 0        | 10-12                      | 9-10   | 3-6    | 0               | 219-296                 | 1090-2076      |
| 8    | 23-24 | 14-15           | 32-49          | 0-1    | 0%                                                  | 0        | 18                         | 12-13  | 11-12  | 0               | 201-426                 | 1367-1519      |
| 10   | 25-28 | 17-19           | 53-69          | 0-1    | 0%                                                  | 0        | 24-27                      | 18-21  | 17-19  | 0               | 0-325                   | 2073-2509      |
| 12   | 30    | 21-22           | 69-98          | 0      | 0%                                                  | 0        | 24-25                      | 23-26  | 19-25  | 0               | 0                       | 2124-2656      |
| 15   | 33-36 | 26-28           | 89-129         | 0      | 0%                                                  | 0        | 29-35                      | 26-33  | 36-41  | 0               | 0                       | 1652-2632      |
| 18   | 40-44 | 31-33           | 135-161        | 0      | 0%                                                  | 0        | 34-36                      | 37-39  | 27-34  | 0               | 51-128                  | 3293-3386      |
| 20   | 45-47 | 35-36           | 149-201        | 0-1    | 0%                                                  | 0        | 42-43                      | 45-52  | 49-55  | 0               | 226-1514                | 3299-4112      |
| 22   | 49-50 | 40-42           | 196-257        | 0      | 0%                                                  | 0        | 59-65                      | 39-47  | 48-57  | 0               | 529-831                 | 3649-4002      |
| 24   | 54-55 | 45-47           | 244-319        | 0      | 0%                                                  | 0-1      | 47-54                      | 48-52  | 42-47  | 0               | 325-506                 | 3869-4115      |

Chad:

| Wave | Army  | Mean experience | Deaths | Breaches | Killed | Routed | Health lost by the army | Ticks to clear |
| ---- | ----- | --------------- | ------ | -------- | ------ | ------ | ----------------------- | -------------- |
| 1    | 4     | 5               | 0      | 0        | 2-3    | 2-3    | 11-42                   | 713-947        |
| 2    | 7     | 7               | 0      | 0        | 4      | 2      | 85-94                   | 1196-1823      |
| 3    | 9-10  | 9               | 0      | 0        | 3-4    | 2-3    | 0-88                    | 849-854        |
| 4    | 12    | 10              | 0      | 0        | 8-10   | 4-5    | 253-299                 | 1490-1516      |
| 5    | 15-17 | 11              | 0      | 0        | 7      | 9-10   | 59-116                  | 1422-1767      |
| 6    | 17-19 | 12-13           | 0-1    | 0        | 10-12  | 2-4    | 180-409                 | 1817-2087      |
| 8    | 19-23 | 16-17           | 0-1    | 0        | 13-17  | 12-14  | 725-742                 | 1691-2359      |
| 10   | 22-25 | 21              | 1      | 0        | 19-22  | 19-21  | 143-230                 | 2073-2915      |
| 12   | 26-29 | 21-26           | 0-1    | 0        | 26-27  | 25-31  | 61-98                   | 2458-2577      |
| 15   | 31-33 | 27-35           | 0-1    | 0        | 30     | 42-48  | 0-159                   | 2109-2631      |
| 18   | 36-40 | 34-41           | 0      | 0        | 41-46  | 39-46  | 61-87                   | 2656-3444      |
| 20   | 40-44 | 37-47           | 2      | 0        | 55-59  | 44-47  | 638-752                 | 3890-4339      |
| 22   | 41-46 | 46-55           | 0      | 0        | 50-52  | 55-66  | 473-2330                | 4239-4644      |

Hellbane:

| Wave | Army | Mean experience | Deaths | Breaches | Killed | Routed | Health lost by the army | Ticks to clear |
| ---- | ---- | --------------- | ------ | -------- | ------ | ------ | ----------------------- | -------------- |
| 1    | 4    | 5               | 0      | 0        | 3      | 3      | 45-111                  | 808-1124       |
| 2    | 6    | 7               | 2      | 0        | 5      | 2      | 204                     | 2303           |
| 3    | 7    | 10              | 0      | 0        | 7      | 4      | 303                     | 1433           |
| 4    | 9    | 12              | 0      | 0        | 7      | 9      | 112                     | 2168           |
| 5    | 10   | 14              | 0      | 0        | 7      | 13     | 104                     | 939            |
| 6    | 14   | 13              | 5      | 1        | 11     | 5      | 2403                    | 6291           |

Baby:

| Wave | Army  | Mean experience | Deaths | Breaches | Killed | Routed | Health lost by the army | Ticks to clear |
| ---- | ----- | --------------- | ------ | -------- | ------ | ------ | ----------------------- | -------------- |
| 1    | 4     | 5               | 0      | 0        | 3      | 0      | 0-16                    | 712-829        |
| 2    | 9     | 7               | 0      | 0        | 2-3    | 0-1    | 17-20                   | 847-1123       |
| 3    | 12    | 8               | 0      | 0        | 2-3    | 0-1    | 0                       | 534-569        |
| 4    | 16    | 9               | 0      | 0        | 7-8    | 1-2    | 11-90                   | 1368-1991      |
| 5    | 19    | 10-11           | 0      | 0        | 6-7    | 4-5    | 0-26                    | 1024-1094      |
| 6    | 22-23 | 11-12           | 0      | 0        | 7-8    | 2      | 56-86                   | 1496-1734      |
| 8    | 27    | 14              | 0      | 0        | 12-13  | 7-10   | 71-110                  | 1357-1398      |
| 10   | 32    | 16-17           | 0      | 0        | 13-19  | 15     | 154-233                 | 2136-2402      |
| 12   | 36    | 20              | 0      | 0        | 19-24  | 16-17  | 135-200                 | 2566-2708      |
| 15   | 41    | 24-26           | 0      | 0        | 29-32  | 25-27  | 353-531                 | 2503-2570      |
| 18   | 49    | 29-30           | 0      | 0        | 34-36  | 23     | 651-679                 | 3233-3293      |
| 20   | 54    | 31-32           | 0      | 0        | 40-43  | 38-39  | 504-550                 | 3404-3407      |

_(pending: this run had not finished when the report was written)_

### 9.2 Skirmishes

Fresh soldiers against veterans, on Normal, in daylight. The veteran lines are the oldest footman of Normal seed 4262 and a low-kill oldest archer (Baby seed 4000) at that wave, so they understate a real army's best shooters. The 10-enemy mix is 4 orcs, 2 goblins, 2 orc archers, a berserker and a dark knight, all placed together 300 px from the line (a harder test than live squads, which arrive strung out). "No rout" disables routing for both sides.

| Wave | Skirmish                          | Trials | Player wins | Soldiers dead (mean) | Soldiers routed | Enemies left | Enemies routed | Health lost | Ticks |
| ---- | --------------------------------- | ------ | ----------- | -------------------- | --------------- | ------------ | -------------- | ----------- | ----- |
| 5    | 1v1 fresh footman v orc (no rout) | 20     | 19          | 0.1                  | 0               | 0.1          | 0              | 68          | 1493  |
| 5    | 1v1 vet footman v orc (no rout)   | 20     | 20          | 0                    | 0               | 0            | 0              | 36          | 1258  |
| 5    | 1v1 fresh archer v orc (no rout)  | 20     | 13          | 0.3                  | 0               | 0.3          | 0              | 24          | 696   |
| 5    | 1v1 vet archer v orc (no rout)    | 20     | 20          | 0                    | 0               | 0            | 0              | -1          | 266   |
| 10   | 1v1 fresh footman v orc (no rout) | 10     | 6           | 0.4                  | 0               | 0.4          | 0              | 90          | 1038  |
| 10   | 1v1 vet footman v orc (no rout)   | 10     | 7           | 0.3                  | 0               | 0.3          | 0              | 70          | 660   |
| 5    | 10v10 fresh (live rules)          | 12     | 12          | 0.1                  | 0               | 0            | 5.3            | 119         | 683   |
| 5    | 10v10 fresh (enemy never routs)   | 12     | 12          | 0.5                  | 0.1             | 0            | 0              | 192         | 979   |
| 5    | 10v10 vet (live rules)            | 12     | 12          | 0                    | 0               | 0            | 5.1            | 29          | 434   |
| 10   | 10v10 vet (live rules)            | 5      | 5           | 0                    | 0               | 0            | 5.2            | 14          | 318   |
| 10   | 10v10 fresh (live rules)          | 5      | 5           | 0.2                  | 0               | 0            | 5.8            | 137         | 653   |

_(pending: this run had not finished when the report was written)_

### 9.3 Counterfactuals

Normal, same bot, one change at a time, patched in memory. Runs stop after wave 15.

| Change                | Seeds            | Outcome                                              | Deaths by W5 | by W10 | by W15 | Breaches by W15 | Health lost W1-15 | Enemies routed W1-15 |
| --------------------- | ---------------- | ---------------------------------------------------- | ------------ | ------ | ------ | --------------- | ----------------- | -------------------- |
| Live game             | 4000, 4131, 4262 | alive at wave 25; alive at wave 24; alive at wave 24 | 0            | 2-3    | 2-4    | 0               | 2335-3472         | 178-187              |
| Healers never rank up | 4000             | alive at wave 16                                     | 0            | 4      | 9      | 4               | 6873              | 163                  |

_(pending: this run had not finished when the report was written)_

### 9.4 Causes of "Normal is too easy", ranked

_(pending: this run had not finished when the report was written)_

---

## 10. Rebalance proposal

The aim is the Mud and Blood shape: a veteran is clearly better than a recruit and worth pulling out of the line, he can still die to a bad minute, and a run that loses its veterans can be rebuilt.

### 10.1 Option 1 (recommended): slow veteran growth

Make every veteran term bounded, and make the enemy stand and fight. The enemy numbers on screen stay as they are.

| #   | Change                          | Now                                                                                            | Proposed                                                                                                                                                              | Where                                                  |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Attack interval                 | `90 - 4 * xp`, floor 12                                                                        | `90 - 3 * min(14, xp)`: 75-94 ticks for a new footman, 48-67 at the cap (enemy 90-109)                                                                                | `game.js:14422`, `game.js:14454`                       |
| 2   | Experience damage               | `+2 * floor(xp / 3)`, no cap                                                                   | `+floor(min(30, xp) / 3)`: at most +10                                                                                                                                | `game.js:3640`                                         |
| 3   | Experience per kill             | 2                                                                                              | 1 (spoils and ribbon bonuses unchanged)                                                                                                                               | `game.js:13572`                                        |
| 4   | Star bumps                      | every star, forever; +1 minimum on the primary stat; range grows                               | first 18 bumps only (two gold stars); no +1 minimum (keep the fraction); no range from stars. At the cap: health x1.33, damage x1.44, accuracy +8, footman morale +20 | `units.js:1010-1014`, `units.js:1029`, `units.js:1084` |
| 5   | Enemy rout                      | three deaths seen = rout for anyone; -2 / -3 morale per death seen; bosses and operatives rout | operatives and bosses never rout; no three-deaths rule for enemies; -1 / -2 per death seen. Grunts still break on morale                                              | `game.js:2251`, `game.js:2566`, `game.js:2571`         |
| 6   | Healer rank                     | a tier every working wave; heal x(1.28 + 0.06t), range x(1.1 + 0.03t)                          | a tier every third working wave; heal x(1.12 + 0.02t) (20 to 56 at tier 6), range x(1.04 + 0.01t) (100 to 154)                                                        | `units.js:1174-1175`, `units.js:1257-1259`             |
| 7   | Enemy missile sight penalty     | applied twice                                                                                  | once                                                                                                                                                                  | `game.js:15363`                                        |
| 8   | Promotion tiers (untested)      | melee health x(1.24 + 0.04t), damage x(1.2 + 0.03t); six tiers = x6.8 and x4.9                 | health x1.12 and damage x1.10 per tier (x1.97 and x1.77 at tier 6), accuracy +3 per tier, no range                                                                    | `units.js:1164-1240`                                   |
| 9   | Med tent (untested)             | `healRate` 0.14: full in 3 s                                                                   | 0.03: full in about 14 s                                                                                                                                              | `data/buildings.json`, `game.js:12977`                 |
| 10  | Enemy scaling wiring (untested) | `cfg.hpScale` / `cfg.dmgScale` reach 3 types                                                   | all three branches read one scale, so the knobs in `units.js:1450-1454` work                                                                                          | `game-depth.js:536-575`                                |
| 11  | Bosses (untested)               | 170-240 base health                                                                            | x3 base health; immune to pins                                                                                                                                        | `content-expansion.js:659-760`, `game.js:13494`        |

Items 1-7 are the `P1` patch set in `lib.mjs` and were run. Items 8-11 were not.

What a survivor from wave 1 looks like under items 1-4 (`vetcurve.mjs P1`):

| Wave | Footman, typical: health / damage / accuracy / experience | interval | dmg per s | Archer, typical: health / damage / accuracy / range | interval | dmg per s |
| ---- | --------------------------------------------------------- | -------- | --------- | --------------------------------------------------- | -------- | --------- |
| 1    | 120 / 22 / 35% / 5                                        | 84       | 7         | 60 / 28 / 40% / 210                                 | 76       | 13        |
| 5    | 126 / 24 / 36% / 9                                        | 72       | 10        | 68 / 32 / 42% / 210                                 | 58       | 21        |
| 10   | 138 / 27 / 39% / 15                                       | 58       | 15        | 84 / 40 / 48% / 210                                 | 58       | 31        |
| 15   | 151 / 30 / 41% / 21                                       | 58       | 18        | 84 / 40 / 48% / 210                                 | 58       | 32        |
| 20   | 159 / 32 / 43% / 26                                       | 58       | 20        | 84 / 40 / 48% / 210                                 | 58       | 32        |
| 30   | 159 / 32 / 43% / 38                                       | 58       | 21        | 84 / 40 / 48% / 210                                 | 58       | 32        |

The top archer is the same as the typical one from wave 10 on: every term is at its cap.

Player and enemy power under Option 1, wave 1 = 1.0 (health x damage per second):

| Wave | Veteran footman, now | Veteran footman, Option 1 | Veteran archer (typical), now | Veteran archer, Option 1 | Orc | Goblin | Troll |
| ---- | -------------------- | ------------------------- | ----------------------------- | ------------------------ | --- | ------ | ----- |
| 1    | 1.0                  | 1.0                       | 1.0                           | 1.0                      | 1.0 | 1.0    | 1.0   |
| 5    | 1.7                  | 1.4                       | 6.0                           | 1.9                      | 1.5 | 1.5    | 1.2   |
| 10   | 4.6                  | 2.5                       | 19.4                          | 3.4                      | 2.4 | 2.5    | 1.5   |
| 15   | 17.9                 | 3.2                       | 30.3                          | 3.5                      | 3.8 | 3.9    | 2.0   |
| 20   | 26.1                 | 3.8                       | 46.3                          | 3.5                      | 5.6 | 6.0    | 2.4   |
| 30   | 45.8                 | 4.0                       | 100.5                         | 3.5                      | 8.9 | 9.1    | 3.1   |

A veteran footman keeps pace with the enemy's rank and file to about wave 10 and then falls slowly behind; a recruit bought at wave 20 is about a quarter as good as that veteran. That is the intended shape: veterans are the army's spine, and numbers, positions, tents, promotions and strikes have to make up the rest.

Measured with the bot (Normal):

_This trial did not finish on the shared machine. No measured result._

_(pending: this run had not finished when the report was written)_

### 10.2 Option 2: keep veteran growth, scale the enemy

Leave the soldier formulas alone and give the enemy matching terms.

| #   | Change                 | Proposed                                                                                                             | Where                   |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Enemy experience       | `min(20, floor(0.9 * wave))` set at spawn, so enemy intervals fall from 90-109 to 54-73 at wave 10, 18-37 at wave 20 | `roster.js:725`         |
| 2   | Grunt scale            | health +9% per wave (was 4%), damage +6% (was 3.5%)                                                                  | `game-depth.js:490-499` |
| 3   | Operative scale        | +6% health and +4% damage per wave on top of the present curve                                                       | `game-depth.js:502`     |
| 4   | Rout and missile fixes | as Option 1 items 5 and 7                                                                                            |                         |

This is the `P2` patch set. Measured:

_This trial did not finish on the shared machine. No measured result._

_(pending: this run had not finished when the report was written)_

### 10.3 Recommendation

Option 1.

- It removes the cause. Option 2 leaves a 12-tick veteran and a 479-range archer in the game and builds an enemy to match; every unit, spoil, strike and price then has to be re-tuned against inflated numbers, and again each time one of them changes.
- Under Option 2 a recruit bought late is worthless against enemies that attack three to five times as fast as he does, so a run that loses its veterans cannot be rebuilt. That is the opposite of "mortal veterans".
- Option 2 keeps the snowball: the soldier with the most kills gets the most experience and takes the next kills too.
- Option 1 keeps the unit card honest. A footman with two gold stars has a third more health and hits about half again as hard, which a player can see and reason about.

Parts of Option 2 are still worth taking with Option 1: wiring the enemy scale so the existing knobs work (item 10), and fixing bosses (item 11).

### 10.4 Targets

Deaths are soldiers lost per wave for average play, which the bot approximates. Tune the two dials that are left after Option 1, host size (`MID_PRESSURE_EXTRA`, `units.js:1452`) and the enemy scale (`early * 0.04` and `early * 0.035` in `game-depth.js:496-497`), until the bot lands in these bands over 3 or more seeds.

| Difficulty | First death | Waves 6-10      | Waves 11-15           | Waves 16-20           | Average play ends |
| ---------- | ----------- | --------------- | --------------------- | --------------------- | ----------------- |
| Baby       | wave 8-10   | 0-1 in the band | about 1 every 3 waves | about 1 every 2 waves | past wave 30      |
| Normal     | wave 4-6    | 1 every 2 waves | about 1 a wave        | 1-2 a wave            | wave 20-25        |
| Chad       | wave 3-4    | about 1 a wave  | about 2 a wave        | 2-3 a wave            | wave 14-18        |
| Hellbane   | wave 1-2    | 1-2 a wave      | 2-3 a wave            | -                     | wave 8-12         |

Hellbane needs the opposite correction first: today it ends in wave 2-7 because the opening squad cannot win waves 1-2 (11 item 18). Raise its starting TP from 4 to 7, or apply the opening count easing to health and damage as well, before judging the rest.

Target power curve for Normal after Option 1 (health x damage per second, wave 1 = 1): veteran footman about 2 at wave 5, 3 at wave 10, 4 at wave 20 and flat after; orc 1.5, 2.4, 5.6, 8.9 at waves 5, 10, 20, 30 (unchanged); a recruit stays at 1. The gap between the veteran and the enemy is what the player's other tools have to cover, and it widens from wave 15, which is where the pressure should start to tell.

### 10.5 Order of work

1. Items 1-4 and 6 (veteran and healer growth), with a save migration that clamps existing soldiers.
2. Items 5 and 7 and the bug list in section 11.
3. Re-run `bot.mjs` on four difficulties, 3 or more seeds, and move host size and enemy scale to the targets.
4. Items 8-11, then a bot that researches and promotes, because promotions are a second curve of the same kind.

## 11. Other things in the combat core that are broken, unused or unfair

Bugs, with the fix in a line each:

1. **Enemy health and damage scaling reaches 3 of 46 types.** `applyEnemySpawnScaling` (`game-depth.js:536-575`) has three branches. Grunts (goblin, orc, orc archer, goblin sapper, harpy, burrower, plague rat) use `getHordeGruntWaveScale` (+4% health and +3.5% damage per wave). The 36 operatives and bosses use `getIpWaveScale`, built for a 100-wave arc: +3% health at wave 10, +12% at wave 20. Only orc shieldbearer, goblin firebrand and wailing wraith read `cfg.hpScale` and `cfg.dmgScale`, which is where `EARLY_HP_EXTRA`, `EARLY_DMG_EXTRA` and the "x1.84 / x1.64 at wave 15" live (`units.js:1450-1454`, `units.js:1489-1493`). Measured: a troll has 294 health at wave 1 and 314 at wave 15. Fix: one scale function for all three branches.
2. **Difficulty multipliers are uneven for the same reason.** `waveHpScaleMult` is only read in the third branch, so it does nothing for 43 types. `waveDmgScaleMult` is read in all three and multiplies with `enemyDmgMult`: Baby enemies deal x0.615 damage and have x0.72 health; Hellbane x1.95 damage and x1.7 health (`game-depth.js:548-562`).
3. **Named bosses rout, can be pinned and are thin.** See 3.1, 4 and 6.3. Fix: bosses and operatives skip `triggerMoraleBreak`; give bosses a health scale of their own.
4. **Missiles compute damage on a copy of the shooter** (2.5): mage Arcane Burst never fires, enemy shooters stay "mustering", ranged operative traits misfire. Fix: pass the live shooter and override only `damage`.
5. **Enemy missiles pay the sight penalty twice** (2.2). Fix: drop it at `game.js:15363`.
6. **Units created mid-wave are unscaled** (2.5). Fix: route summons and `spawnEnemy` through the same scaling as a wave spawn.
7. **Pins last half the stated time** (section 4). Fix: count down in one place.
8. **A soldier who deserts is not counted as lost** (3.1). Fix: count it where he is removed.
9. **`bumpUnitRange` scales `range` twice** (1.3 item 4). Fix: set `range = baseRange`.
10. **Ribbons earned during a run switch on at the next spoils claim**, because `computeFx` runs only in `startRun`, in `claimSpoils` and on load (`siege-loop.js:434`, `siege-loop.js:489`, `siege-loop.js:755`). Read from the code, not run. Fix: recompute in `checkRibbons`, or hold them for the next run as the text promises ("on every future run").
11. **Kill credit can go to a bystander.** When the blow has no attacker (poison, death burst), the experience goes to the first soldier found who had the enemy as his target (`game.js:13552-13556`).

Dead or misleading:

12. Cavalry and scout "+60% against routing enemies": routing enemies cannot be targeted (2.5).
13. Enemy `experience` is always 0; the attack-rate formula has no enemy side.
14. `getVanillaObsoleteMult` does nothing before about wave 40 for soldiers with tenure.
15. Every enemy has `reward: 0`. Killing pays nothing; income is the same whether the wave was clean or a disaster, apart from the soldiers lost.
16. `crit` is cosmetic. From about wave 10 most veteran blows are 45 or more, so nearly every hit shows the crit effect.

Unfair or odd, for the owner to decide:

17. **Defeat by elimination.** `isPlayerEliminated` (`game-core.js:763`) ends the run the moment no soldier and no barracks is left, whatever is in the bank. Hellbane seed 4000 ended that way in wave 2 with 0 breaches. In this genre the loss is the breach count.
18. **Hellbane is decided in the first waves.** Four starting soldiers and 4 TP against wave-1 goblins with 58 health and 22 damage (a Normal goblin has 34 and 11 in wave 1). _(pending: this run had not finished when the report was written)_ This is the opposite problem from Normal and needs its own fix (opening count, or starting TP).
19. **Archers and mages never gain morale from stars** (the ranged branch of `applyVeteranStarBump` has no morale bump, `units.js:1078-1086`). A wave-20 archer still has 12 morale: pinned by 88% of hits and broken by two deaths nearby. Footmen go to 45.
20. **Horde waves are the lightest waves by health.** Wave 15 on Normal: 68 enemies with 3,829 health in total; wave 10 had 35 enemies with 3,610; wave 20 had 91 with 12,578.
21. **The early-call bonus is +5 TP every wave**, 70% on top of base income for anyone who is ready. It is effectively part of base income.

## 12. Not verified

- Promotions (U), research, academies, operatives, champions, skill trees, tonics, General aura and orders, doctrines, strikes, spells, walls, outposts, keeps: read, not run. The bot uses none of them.
- Rear attacks, Shield Wall uptime and class counters: formulas read; how often they apply in play was not measured.
- Whether the "host quits the field" rule fired in any bot run: not logged.
- Camping the muster edge and enemy archers shooting from the muster zone at a forward line: the mechanism is verified in a probe; a full run with a forward line was not played.
- Whether enemies attack soldiers lying in the med tent: not checked.
- Wave 30: no live run got there. The longest reached wave 25.
- Baby and Chad have 2 seeds each, Hellbane and Normal 3. Most counterfactuals and both rebalance trials have 1 seed. The direction of each result is clear; the exact counts are samples.
- The rebalance numbers in section 10 are a tested starting point, not a tuned result. The untested items are marked.
