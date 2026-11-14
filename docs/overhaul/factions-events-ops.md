# Myth and Blood audit: enemy factions, wave composition, world events, off-field actions

Scope: the files listed in the brief, read at commit `ed2eae8` (main). Nothing in the repo was changed.

## How this was checked

- Code read: every file in the brief except `faction-depth.js`, `crossover.js`, `wwe.js`, `game-modes.js`, `strike-fx.js`, which were skimmed (structure, data tables, call sites).
- Headless probes built on `scripts/lib/harness.mjs` and `scripts/headless-manifest.mjs`. The probe scripts lived outside the repo and were deleted afterwards, so the numbers below cannot be re-run without rewriting them:
  - **Composition probe**: Normal difficulty, cheat-cleared, waves 1 to 126 on seed 4131 and 1 to 61 on seed 4000. Recorded the spawn queue, flanks, wave event, planet event, hazards and neutrals at each dawn. Numbers below marked "probe" come from this.
  - **Honest-bot probe**: the repo's no-cheat bot logic, Normal, seeds 4000 and 4131, 24,000 to 30,000 ticks, with and without Courier Levy and Spy Disrupt, logging hostility and wildlife reputation each wave.
  - **Volcano probe**: one run, wave 32 (eruption, no response) against wave 31 (no event).
- Not run: the browser UI, `npm run test:all`, any wave past 126, any mode other than Campaign. See "Not verified" at the end.

Tick rate is 60 per second (`js/units.js:14`). Night prep is 60 seconds.

---

## Direct answers

**Do the enemy factions play differently?** No. They differ in which unit types they add to one shared pool, and from wave 25 in which map edge their units enter from. There is no per-faction AI, formation, timing or objective. Every ordinary wave is a blend of all active factions: in the probe the largest faction averaged 40% of a wave (range 33 to 52%) from wave 12 on, and ordinary waves from wave 30 held 32 different enemy types on average. Individual enemy types do behave differently, but that lives in `js/roster.js`, per unit type, and is not tied to a faction. Bosses have real per-boss traits and a half-health phase (also `roster.js`), but each boss wave is the same generic escort plus four themed minions.

**Which off-field actions show on the field?**

| Visible on the field                                                                                      | Number change only                                                            | No effect or broken                                                                             |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Strikes: Fireball, Lightning, Meteor, Frost Nova, Heal Rain, Fortify, Scout Flare, Reinforcements, Dispel | Spy: Steal, Disrupt, Assassinate, Poison, Muster, War Chest, Tunnel (HP part) | Spy: Forge Maps, Settlement Raid, Sabotage (2 s), Scout and Infiltrate (report arrives at dawn) |
| Courier: Reinforce, Call Banner, Emergency Muster, Med Evac, Hunt Pact (only at wildlife rep 50+)         | Courier: Levy, War Chest, Decree, Supplies, Herald, Truce                     | Courier: Counter-Hold (wave 200+ only)                                                          |
| Expeditions (soldiers leave the field)                                                                    | Kingdom doctrines (6 to 7 seconds of buff)                                    | Counter-offensive doctrines, Settlement Raid missions                                           |

**How often do events fire, and is there a choice?** Three separate event systems run on fixed wave-number schedules. Over waves 1 to 100 (probe): 58 waves had a wave event, 23 had a planet event, 20 had both, 39 had neither. Wave events offer no choice. Planet events offer three options, but the options are small percentages and the free "do nothing" option is often fine. Wildlife events offer no choice.

---

## 1. Enemy factions (`js/enemy-factions.js`)

- **What it does.** Five factions (Goblin Hordes from wave 1, Orc Warbands 4, Dark Legions 10, Void/Abyssal 32, Mirror Empires 200), each with four tiers unlocked by wave. A tier is a unit list, an elite list, a sub-boss list and a spawn weight of 1.05 to 1.52. The tier lists are merged into the wave pool (`enrichPool`, line 541), then 5% or less of the queue per faction is overwritten with that faction's units (`biasSpawnQueue`, line 584).
- **How the player meets it.** Toasts ("Host evolves — Orc Warbands reach Stage 2"), the Ops tab from wave 4, and the Threat Map button. No field marker says which faction a unit belongs to.
- **Decision impact.** None. The player cannot fight one faction differently from another because they arrive mixed.
- **Bugs and dead code.**
  - Tiers 3 and 4 are defined by enemy buildings ("outposts and hamlets rise in the north"), but enemy buildings are switched off: `tryPlaceEnemyBuilding` returns false and `updateEnemyRTS` is empty (`js/game-core.js:779-790`). In the probe no enemy building existed in 126 waves. `countFactionBuildings`, `computeHostKingdomMeter`, `BUILDING_FACTION` and every stage 3/4 tagline describe something that never happens.
  - Weights barely register. A weight is turned into `floor(w × 10)` tickets (`js/wave-composition-core.js:45`), so 1.15 against a default 1.0 is 11 tickets against 10, in a pool of 40 to 70 entries.
  - `getActiveFactions` contains `.filter((f) => !false)` (line 521), a leftover no-op.
  - `orc_shieldbearer` and `wailing_wraith` have no faction (missing from `UNIT_FACTION`), so they count as "none" in reputation and flank assignment.
  - Void units arrive long before the Void faction does: `sky_drake` at 14, `abomination` at 20, `behemoth` at 25 via the base pool (`js/content-expansion.js:1088-1104`), while the faction "appears" at 32.
- **Overlap.** Faction Reputation, Player Counter-Evolution, Faction Intel, Multi-Front, Asymmetric Warfare, Strategy Counterplay and Biome Spawn all adjust the same pool weights.
- **Verdict.** Rework. Keep the faction names, colours and unit lists; replace the weight blending.
- **Proposal (L).** One lead faction per wave supplies about 70% of the host, with one signature tactic each (see "New ideas"). Files: `enemy-factions.js` (tactic and warband templates), `units.js:getWaveConfig`, `game.js:buildSpawnQueue`, `siege-loop.js` and `roster.js` for the behaviour. Drop Mirror Empires and stages 3 and 4 until enemy structures return.

## 2. Wave composition (`units.js:getWaveConfig`, `wave-composition-core.js`, `game.js:7642-8079`, `content-expansion.js:1086`, `data/enemies.json`)

- **What it does.** Ten hand-written wave templates, then a formula: count is `max(template, 8 + ease × 70, 4 + 2 × wave)`, so 20 at wave 10, 39 at 20, 101 at 50, 167 at 99, 214 at 100 (probe). The pool grows by wave; the queue is a weighted random draw. Enemies arrive in squads of `2 + wave/4` (cap 10).
- **How the player meets it.** Every wave.
- **Decision impact.** Weak. With 20 to 34 types per wave there is nothing to counter-pick. The README counter table cannot be acted on.
- **Bugs.**
  - **Named bosses spawn in ordinary waves.** `SPAWN_ELITE_TYPES` includes all ten `boss_*` types (`js/game.js:7380`), and the elite-slot filter `pool.includes(t) || EnemyDefs[t]` (`js/game.js:7982`) is always true. Host threat adds `floor((level − 4) / 5)` such slots. Probe (seed 4131): 54 of the 90 non-boss waves up to 100 contained at least one named boss; wave 39 had Malachar (the wave 100 boss); wave 98 had eight. First seen at wave 27.
  - Siege towers flood the host: 13 of 84 at wave 40, 17 of 91 at wave 47, 25 of 214 at wave 100 (probe). The base pool lists `siege_tower` six times by wave 20, and every non-boss wave from 7 forces one in (`js/game.js:7935-7944`).
  - `GS.nextWaveIntel` is only cleared at run start (`js/game.js:7143`). Ordinary waves prepend a "Kingdom N…" note to the old text (`js/game.js:7989-7991`), so the string grows every wave and carries the last horde's roster forward. The HUD hides most of it, but the fallback shows its first 40 characters (`js/ui.js:1739`).
  - Fifteen modules each append a note to that string (`js/game.js:8013-8077`), including the debug line "Pacing: 48 messages queued".
  - `data/enemies.json` holds 15 enemies; about 30 more, plus all bosses, are defined in code in `content-expansion.js`. Two sources of truth.
  - `ELITE_ENEMIES.push('sky_drake', 'bone_summoner')` runs on every game start (`js/content-expansion.js:1007`) and grows the array each restart.
- **Verdict.** Rework.
- **Proposal (M).** Replace the single weighted draw with warbands: a wave is 2 to 4 named groups (for example "Orc shield line", "Goblin tunnel party"), each 5 to 12 units of 2 or 3 types, drawn from the lead faction. Move all enemy stats into `data/enemies.json`. Fix the two bugs first (S): remove `boss_*` from `SPAWN_ELITE_TYPES` and drop the `|| EnemyDefs[t]` clause.

## 3. Horde waves (`js/game-depth.js:237-345`)

- **What it does.** Every fifth wave that is not a boss wave: about 28 to 62% more enemies, spawn gaps at 48 to 70% of normal, HP ×0.82 to 0.92, damage ×0.85 to 0.94. 88% swarm (goblin, rat, orc), 12% "harass" types.
- **How the player meets it.** Waves 5, 15, 25 and so on, with a banner.
- **Decision impact.** Some: area damage matters. It is the one wave type that feels different.
- **Bugs.**
  - The eight flavours are labels only. `flavorIdx` is picked from the wave number (line 315) and nothing reads it when building the queue. Probe: "Archer Screen" at wave 35 had 1 archer in 76; "Sapper Rush" and "Goblin Tide" had the same mix.
  - Line 266: `if (wave >= 6 || t === 'goblin_sapper') unlocked.add(t)` unlocks every harass type at wave 6, including `hellbound_legionnaire`, `nightmare_strider`, `warp_prophet` and `grim_revenant`, which are meant for waves 25 to 45. Probe: three of them in the wave 25 horde.
  - Line 269: `unlocked.add('harpy', 'plague_rat')`; `Set.add` takes one argument.
  - Uses `Math.random`, so Seed Run hordes are not reproducible.
- **Verdict.** Keep, fix.
- **Proposal (S).** Make each flavour a real recipe in `game-depth.js` (Warg Run: 60% warg riders from the wings; Sapper Rush: sappers behind a goblin screen; Burrower Surge: half the host surfaces behind the line). Gate harass types with `EVIL_OPERATIVE_WAVES`.

## 4. Named bosses and packs (`js/monster-bosses.js`, `js/game-depth.js:349-383`, `js/roster.js:556-647`)

- **What it does.** Every tenth wave fields one of ten bosses, cycling every 100 waves with +18%, +36%, +55% scale on return. The wave is: the boss, a fixed escort (2 dark knights, berserker, necromancer, bone summoner, then one of every monster unlocked so far), a themed pack of 4 (more on return visits), then normal fill.
- **Boss behaviour.** Real and distinct, from `roster.js`: war banner aura, hex, regrowth, thorns, kiting, target preference, and a half-health phase (enrage ×1.3 to 1.4, or a summon of 4 to 8 units). This is the best-differentiated content in the area.
- **Bugs and dead code.**
  - Pack structures never spawn (enemy buildings are off), but the summary still says "4 pack, 1 hold" (`monster-bosses.js:304`).
  - `bossPackMember`, `bossPackMinion`, `bossPackLeader`, `monsterEvolution` are set (`monster-bosses.js:408-420`) and never read.
  - The same bosses also appear as random "sub-bosses" (9 to 24% per faction per wave, `enemy-factions.js:604`) and through the elite-slot bug above, so by wave 40 a named boss is not an event.
  - `content-expansion.js:1405-1413` applies a second enrage (×1.45 below half health) on top of the `roster.js` phase.
  - Wave 100 stacks Malachar, the Mirror Assault wave event and the Mirror Rift planet event on one dawn.
- **Verdict.** Keep bosses, rework the wave around them.
- **Proposal (M).** A boss wave is that boss's own army only (pack scaled up to the full count), no generic escort. Bosses appear only on their wave. Remove `subBosses` and `injectSubBosses`. Files: `monster-bosses.js`, `game-depth.js:bossWaveComposition`, `enemy-factions.js`.

## 5. Faction reputation (`js/faction-reputation.js`)

- **What it does.** A 0 to 100 hostility score per faction from wave 6, starting at 22. Kills add 2 to 14, spy actions add 4 to all, truce removes 18. High hostility gives up to +35% spawn weight, +46% sub-boss chance and tiers up to 14 waves early.
- **How the player meets it.** Toasts and the Ops tab.
- **Decision impact.** None. Hostility rises because the player kills enemies, which is the whole game. Honest-bot probe: Orc reached 100 by wave 13, all three active factions by wave 16. "Restraint" is not available in a wave defence.
- **Dead code.** `economicFocus`, `buildingIntervalMult`, `buildingCapDelta`, `onEnemyStructureDestroyed` (no enemy buildings).
- **Verdict.** Cut candidate.
- **Proposal (S).** Delete, or replace with a per-warlord grudge shown on the boss banner: a boss who escapes or whose lieutenants were killed returns with one named change. File: `monster-bosses.js`.

## 6. Faction hazards and Arcane Dispel (`js/faction-hazards.js`, `game.js:10924-10960`)

- **What it does.** Coloured ground zones per faction from territory tier 2 (wave 20): plague (slow to 58%), fire pit, miasma, void corruption that grows. Probe: 2 zones at wave 22, 12 at wave 60, 27 at wave 100. Dispel (5 TP, needs a mage in range) removes them.
- **Decision impact.** Low. The slow is real. The damage is `0.2 to 0.42 × scale` hit points every 38 to 48 ticks (`faction-hazards.js:335`): under 1 HP per second against a 115 HP footman. Zones are placed north of the rally line, where the player rarely stands.
- **Bugs.** Damage looks like it was meant as a fraction of max HP and is applied as raw HP. Dispel has no other use, so it is a 5 TP button for a problem that does not hurt.
- **Overlap.** Planet events, biomes and procgen obstacles are all "terrain that changes the fight".
- **Verdict.** Merge with Living Planet and planet events into one terrain layer.
- **Proposal (M).** Hazards become things the lead faction lays during its wave, inside the fighting zone: goblin caltrops and pits, orc fire arrows that burn a patch of ground, legion miasma that blocks healing. Cap at 3 on the field. Builders or mages clear them at night.

## 7. Faction Intel and Threat Map (`js/faction-intel.js`, Ops tab)

- **What it does.** A panel listing each faction's stage, hostility, front and building count, plus a small map. The Ops tab holds nothing else.
- **Decision impact.** None; it reports systems that do not affect play. Building counts are always 0. "Effective stage" after a counter-doctrine is display only (`stagePenalty` is read by no gameplay code).
- **Verdict.** Cut the panel; reuse the Ops tab.
- **Proposal (S).** Ops tab becomes "Tomorrow": lead faction, its tactic, where it enters, the omen in play. All of it true and all of it actionable.

## 8. Multi-front siege and flanks (`js/multi-front-siege.js`, `game.js:5760-5810`)

- **What it does.** Flanks unlock at 25 (east), 50 (west), 75 (south). From wave 12 with two or more factions, each faction gets a doctrine and one edge; a unit spawns on its faction's edge. Counter-raids use the same doctrine to pick a building target.
- **How the player meets it.** "MULTI-FRONT SIEGE" floats every wave from 12. Night chevrons show the edges.
- **Decision impact.** This is the only place faction identity reaches the field. But the plan overrides the random flank roll (`game.js:5792-5795`), so the README's "you will not face every direction every wave" is mostly false. Probe: both edges in 23 of 25 waves from 25 to 49; all three in 21 of 25 from 50 to 74; all four in 19 of 26 from 75 to 100.
- **Bugs.** The banner shows from wave 12 when only north exists ("Goblin raids North · Orc sieges North · Dark flanks North"). `checkWaveAnnouncement` (line 279) is never called. Goblin and Void prefer south, which does not exist before wave 75. `pickCounterRaidTarget` uses `Math.random`.
- **Fit with the brief.** East, west and south flanks plus a field that grows from 400×600 to 1300×1700 by wave 100 (probe) work against "one continuous field, enemies from the top, lose at the bottom line".
- **Verdict.** Rework.
- **Proposal (M).** Keep one edge. Split the top into three sectors (left, centre, right). The lead faction and its allies are assigned sectors at nightfall and the chevrons show them. "Competing" mode becomes real: two factions that share a sector fight each other for a few seconds first. Files: `multi-front-siege.js`, `game.js:spawnPosForSide`, `siege-loop.js:spawnMarkers`.

## 9. Asymmetric warfare (`js/asymmetric-warfare.js`)

- **What it does.** A hidden host "threat level" that grows about 3 to 12 XP per wave (22 XP per level; level 8 at wave 20, 45 at wave 60 in the probe), compared with a "commander authority" score from buildings. Output: enemy count ×0.9 to 1.38, spawn interval ×0.72 to 1.08, extra elite slots, a bias towards using every flank.
- **How the player meets it.** One text fragment, "Cmd 36 vs Host Lv22".
- **Decision impact.** None the player can see or steer before wave 100.
- **Bugs.** Its elite slots are the source of the stray bosses (section 2). `onHostStructureDestroyed` and the `enemySiteCount` and `planetControl` inputs are dead.
- **Overlap.** Colony Value, difficulty, Advanced Difficulty and Faction Reputation all scale enemy count.
- **Verdict.** Cut. Fold any wanted growth into `getWaveConfig`.

## 10. Strategy counterplay (`js/strategy-counterplay.js`)

- **What it does.** Detects nine player builds and adds counter units to the pool; also holds a set of damage bonuses (ballista ×1.75 against siege, pikeman ×1.35 against cavalry, and so on).
- **Decision impact.** The detection is always on. "Ranged Deathball" triggers at 4 ranged units, "Healer Sustain" at 2 healers, "Cavalry Core" at 3. Any normal army trips most of them by wave 8, so it works as a constant.
- **Bugs.** Damage bonuses stack with the same bonuses in `content-expansion.js:1394-1404` and in `roster.js`. A ballista against a flyer can receive ×1.35, ×1.45 and an `antiAir` ×1.65. None of this is shown.
- **Verdict.** Merge the counters into `roster.js`; cut the detector.
- **Proposal (S/M).** If the host should adapt, do it once and say so: at every fifth night the enemy "scouts your line" and the next lead faction is chosen to test your weakest role, with one line of text.

## 11. Wave events (`js/content-expansion.js:1132-1348`)

- **What it does.** Fourteen events on fixed wave multiples; the highest priority wins. Effects: extra units added to the queue, +3 to +8 TP, or ±4 to 8 morale. Night Raid (every 4th wave) adds 2 goblins and a warg.
- **How the player meets it.** A toast and floating text at dawn. Probe: 58 of 100 waves, of which 21 were Night Raid and 10 Village Tithe.
- **Decision impact.** None. No choice, no warning unless the Herald message is bought, and the same waves every run.
- **Bugs.** `dominion_surge.countMult` is applied after the wave's modifiers are fixed, so it lands on the following wave (`content-expansion.js:1328`, called after `resetWaveModifiers`). Herald prints raw ids ("night_raid" with one underscore replaced, line 1776). "Night Raid" happens in daylight.
- **Verdict.** Merge with planet events.

## 12. Planet events (`js/dynamic-map-events.js`)

- **What it does.** Eight events on fixed wave multiples from wave 12 (Geothermal every 14, Volcanic every 16, Ruins every 19, Mana Storm every 21, Titan every 23). At night the Spy tab shows three buttons: two paid (2 to 6 TP), one free.
- **How the player meets it.** Bottom of the Spy tab, plus a HUD chip. Probe: 23 of 100 waves, 10 of them Geothermal (a fallback at waves divisible by 27 produced back-to-back events at 27 and 28).
- **Decision impact.** Weak. Most paid options are 5 to 14%: −5% damage taken for 2 TP, −10% enemies for 2 TP, +6% damage for 3 TP. "Seal Ruins" (−12% enemies, 5 TP) is worse value than Spy Disrupt (−35%, 5 TP).
- **Field effect.** Eruption pulses, random chip damage, quake pins and wild stalkers are real and visible. In the one volcano run, enemies averaged 86 to 89% health against 98 to 100% in the control wave, and the player's troops at the bottom were untouched, so the free option was the best one.
- **Bugs.** "Tap Geothermal" grants +35% night build speed, but the choice is made during the night it is meant to speed up and `activeMods` is replaced at dawn. Chip damage and pins look like they keep ticking through the following night, since the active modifiers are only replaced at the next dawn (read from code, not observed). Tucked under the Spy tab, the panel is easy to miss.
- **Verdict.** Rework and merge with sections 11, 6 and 13.
- **Proposal (M).** One "omen" system in `dynamic-map-events.js`. About one night in three, a card on the field (not in a tab) offers two options that both change how the wave plays: fog (ranged reach halved for both sides) or clear skies; let the river flood the left sector or keep it open; burn the grass (fire barrier for 20 seconds) or save it. No free third option; not choosing picks at random. Roll from a seeded deck so runs differ.

## 13. Living Planet and biome spawn (`js/living-planet.js`, `js/biome-spawn.js`)

- **What it does.** The map grows 90×110 every 10 waves. Land north of the home zone becomes Forest (tier 2: −12% speed, +14% cover, −10% damage taken) and Mountains (tier 5: −26% speed, −22% damage taken) for anyone standing in it.
- **Decision impact.** Low. The biomes are on the enemy's side, so they mainly make enemies slower and tougher on approach.
- **Bugs.** `biome-spawn.js:7` weights `footman` and line 14 weights `archer`; neither is an enemy. `applyWeightBiases` only touches types already in the weight table.
- **Verdict.** Merge into one terrain layer; cut `biome-spawn.js`.
- **Proposal (M).** Fix the field size. Put two or three terrain features inside the fighting zone, rolled per run (a ridge that gives archers reach, a ford that slows, a wood that hides). That is terrain the player places a line around.

## 14. Neutral wildlife and relations (`js/neutral-wildlife.js`, `js/neutral-relations.js`)

- **What it does.** A third team from wave 8: boars, harpies, stalkers, treants, drawn with enemy sprites (troll, harpy, warg rider). They attack the nearest unit of either side and pay 2 to 5 TP. Packs come on wave multiples (11, 13, 17), from dens, after 7 deaths in a wave, and at 8% per 2 seconds. A −100 to +100 reputation falls 8 per kill; the Hunt Pact courier message adds 22.
- **Decision impact.** None. Troops kill wildlife on their own. Honest-bot probe: reputation −35 at wave 12, −100 by wave 15. Allied beasts need 50+, which is out of reach.
- **Bugs.** Neutrals reuse enemy sprites, so they read as enemies. A neutral still alive at the end of a wave stays on the field into the next one (probe: up to 11 carried over).
- **Verdict.** Cut candidate. If kept, one visible event: a herd crosses the field mid-wave and tramples whatever is in its path, both sides.

## 15. Settlement raids, counter-raids, enemy buildings (`js/settlement-raids.js`, `enemy-factions.js:715`, `game-core.js:765-790`)

- **What it does.** Raid missions on enemy holds from wave 150; counter-raids of 3 to 6 elites from stage 4 factions (goblins from wave 40, every 14th wave) aimed at a player building.
- **Status.** Enemy buildings are disabled, so raid missions never exist. The UI still says "factions build in the north after wave 150", Spy "Settlement Raid" can only fail, and the README still promises mirror settlements at wave 200. Counter-raids still spawn.
- **Verdict.** Cut `settlement-raids.js`, the Settlement Raid spy action, the raid panel, and the README lines. Keep counter-raids as a tactic of the lead faction.

## 16. Procgen obstacles (`js/procgen-obstacles.js`)

- Loaded by `index.html`, never called. Its own header says it is not wired in. The header names another game project in a comment (not player-visible).
- **Verdict.** Cut, or use it for the per-run terrain in section 13.

## 17. Pacing tools (`js/pacing-tools.js`)

- **What it does.** Game speed 1× to 10×, pause handling, and a toast queue (3 visible, 48 queued, oldest dropped).
- **Finding.** The queue exists because the systems above produce more toasts than can be read. The headless probe held the queue at its 48 cap from wave 12; headless runs do not expire toasts normally, so treat that as a sign, not a measurement.
- **Verdict.** Keep. Remove `formatIntelNote`.

## 18. Spy network (`game.js:8827-8930`, `content-expansion.js:1707-1764`, `data/strikes.json`)

- **What it does.** Thirteen buttons, one use per wave, no unit needed. Effects apply to the next wave.

| Action          | Cost | Real effect                  | Assessment                                       |
| --------------- | ---- | ---------------------------- | ------------------------------------------------ |
| Steal           | 4    | +4 TP, −2 enemies            | Free. Always better than nothing                 |
| Disrupt         | 5    | −35% enemies                 | Dominant. At wave 20 that is 14 enemies for 5 TP |
| Assassinate     | 6    | no elites                    | Strong on elite-heavy waves                      |
| Poison          | 4    | −20% HP                      | Fair                                             |
| Tunnel          | 5    | −25% HP for all enemies      | Text says burrowers only; better than Poison     |
| Muster          | 5    | −2 enemies                   | Worse than Steal                                 |
| War Chest       | 4    | +6 TP, +2 enemies            | Money button                                     |
| Bribe           | 6    | 50%: −3 enemies; else −2 TP  | Worse than Steal                                 |
| Scout           | 2    | roster toast at dawn         | Too late to act on                               |
| Infiltrate      | 3    | identical code path to Scout | Dead                                             |
| Sabotage        | 5    | spawns start 2 seconds later | Dead                                             |
| Forge Maps      | 3    | crate opacity 0.85 to 1.0    | Dead; `mapsRevealed` is never read               |
| Settlement Raid | 7    | always refused               | Dead                                             |

- **Decision impact.** One real choice (Disrupt, Assassinate or Poison) buried among ten non-choices. In the honest-bot probe, pressing Disrupt every wave took the bot to waves 20 and 23 in 30,000 ticks against 18 and 17 without.
- **Bugs.** `game.js:8861-8864` checks for actions named `deserter` and `maps`, which do not exist (the ids are `muster` and `forge_maps`). Both happen to return true today, so nothing breaks. The free siege-loop preview and edge chevrons already give what Scout sells.
- **Verdict.** Rework.
- **Proposal (M).** Three spy actions that happen on the field. _Ambush_: place a marker in a top sector; the first squad through it arrives at half health and scattered. _Mark the warlord_: the boss or strongest elite is outlined and takes +25% from everything. _Turncoats_: 3 to 5 of the next wave's swarm units change sides when they reach the line. Files: `data/strikes.json`, `game.js:executeSpyAction`, `siege-loop.js`.

## 19. Courier messages (`game.js:9272-9402`, `units.js:824`, `content-expansion.js:1766`)

- **What it does.** Twelve buttons, one per wave (two with a three-gold-star Courier), needs a living Courier (4 TP).

| Message          | Cost | Effect                                        | Assessment                        |
| ---------------- | ---- | --------------------------------------------- | --------------------------------- |
| Tax Levy         | 0    | +6 TP next round                              | Dominant. Base income is 7        |
| Reinforce        | 3    | 2 footmen next dawn (worth 6, ignores upkeep) | Strong                            |
| Call Banner      | 5    | 1 knight now (worth 8, ignores upkeep)        | Strong late                       |
| War Chest        | 2    | +4 TP                                         | Weaker Levy                       |
| Emergency Muster | 4    | 1 footman, −2 morale                          | Worse than Reinforce              |
| Decree           | 2    | +5 morale                                     | Situational                       |
| Supplies         | 3    | +25 HP to all                                 | Situational                       |
| Med Evac         | 4    | wounded retreat                               | Situational                       |
| Herald           | 3    | +4 morale, names next wave event              | Weak                              |
| Truce            | 4    | 1.5 s spawn delay, +8 morale, −18 hostility   | Hostility regrows in a wave       |
| Hunt Pact        | 3    | +22 wildlife rep                              | Cannot reach the useful threshold |
| Counter-Hold     | 5    | wave 200+ only                                | Not met in a normal run           |

- **Decision impact.** A Courier pays for himself in one wave. Honest-bot probe: buying one and pressing Levy every night gave an army of 53 to 54 at 30,000 ticks against 43 to 44. It is a tax on attention.
- **Verdict.** Rework.
- **Proposal (M).** The Courier is a rider. An order sends him off the bottom edge and back (about 20 seconds); if he dies, the order fails. Three orders: _Reinforcements_ (a squad marches in at the muster zone), _Field surgeons_ (wounded at the muster zone heal over 15 seconds), _Fresh arrows_ (ranged troops fire faster for 20 seconds). Remove every TP button.

## 20. Kingdom doctrines, counter-offensive, expeditions (`game.js:8963-9130`, `units.js:423-466`, `js/player-counter-evolution.js`)

- **Kingdom doctrines** (Spells tab, one per wave). Durations are in ticks but the text says minutes: "15% less damage for 6 minutes" is 360 ticks, which is 6 seconds (`units.js:429`, countdown at `game.js:13900`). Same for the 7-minute and 6-minute doctrines. Royal Muster (5 TP for +5 TP and +4 morale) is free morale. They overlap the General's War Cry and Hold the Line.
- **Counter-offensive doctrines** (Spells tab, wave 15+). 3 to 9 TP to "weaken the weakest faction". The stage penalty is display only. The spawn multiplier (0.92 to 0.70) changes a ticket count by 1 or 2. The build halt targets buildings that do not exist. Each use adds 12 hostility. Net effect is slightly negative. Dead option.
- **Expeditions** (Spy tab, wave 25+, night only). Send 1 to 4 soldiers off-map for one wave. Each has a 77 to 92% chance to return (`player-counter-evolution.js:329`); returners are created as new units of the same type (line 333), so stars, name and kill record are lost. Payout is `6 + 3 × survivors + 4 × stage` TP. One footman against a stage 2 faction: 17 TP expected against a 3 TP soldier. Read from code, not executed. As written it is a money exploit and a veteran eraser.
- **Verdict.** Merge doctrines into the General's orders. Cut counter-offensive. Rework expeditions or cut.
- **Proposal (M).** One sortie, on the field: at night, send a picked squad to burn the enemy camp at the top. They walk up, fight a short visible skirmish against the vanguard, and whoever survives walks back with their stars. Success removes one warband from tomorrow's wave. File: `player-counter-evolution.js`.

## 21. Strikes and the Spells tab (`data/strikes.json`, `game.js:10683-10965`, `content-expansion.js:1608-1705`, `js/strike-fx.js`)

- **What it does.** Ten click-to-target abilities, TP cost only, no cooldown, usable day or night. All numbers get a global ×1.2 (`units.js:35`). Fireball 9 TP, 96 damage, radius 72. Lightning 6 TP, 66, radius 60. Meteor 14 TP, 132 plus 79, radius 90. Frost Nova 8 TP, 42 and a 60% slow for 3.6 s. Heal Rain 6 TP, 42 HP, radius 180. Rally 6 TP, +12% damage and morale for 6 s. Fortify 7 TP, −30% damage in radius 84 for 9.6 s. Reinforcements 12 TP for 2 footmen and an archer. Scout Flare 4 TP. Dispel 5 TP.
- **Decision impact.** Real. These are the best off-field actions: aimed, visible, immediate. `strike-fx.js` is visuals only and each strike has its own effect.
- **Issues.** No cooldown means spending is the only limit; a TP hoard buys a wave. Reinforcements ignores army upkeep, so past about 28 soldiers it is the cheapest way to recruit. Lightning is cheaper per damage than Fireball at nearly the same radius. Scout Flare only matters against burrowers. `data/strikes.json` holds 6 abilities and 8 spy actions; the other strikes and spy actions are in code. The README says Fortify is 25% (it is 30% after the ×1.2).
- **Verdict.** Keep, tighten.
- **Proposal (S/M).** Cooldowns in place of pure TP. Cut to six: Fireball, Lightning (single target, bosses), Frost, Heal Rain, Fortify, Flare. Fold Rally into the General. Move everything into `data/strikes.json`.

## 22. Day and night (`game.js:13645-13750`, `game.js:2935-3200`)

- **What it does.** Night lasts 60 seconds (Timed Blitz 30). Sounding the horn early pays +1 TP per 10 seconds left, up to +5. Night is when deploying, building, expeditions and planet responses happen. The wave is "day".
- **Decision impact.** Deploying is a few clicks, so the horn is close to +5 TP per wave for free, on a base income of 7. Nothing fights at night.
- **Verdict.** Keep the rhythm; make night mean something.
- **Proposal (M).** Every so often the lead faction attacks at dusk: the wave starts in darkness, sight is short, torches and watchtowers matter. The enemy camp is drawn at the top during night prep, so the preview is something the player sees on the field.

## 23. Game modes and Advanced Difficulty (`js/game-modes.js`, `js/advanced-difficulty.js`)

- **Modes.** Ten, plus daily and weekly challenges, ironman, and jump-in starts at 100, 105, 200. Skimmed, not played.
- **Seed Run** is not deterministic. `gameRandom` is seeded, but hordes, boss escort fill, spawn positions, wildlife, and planet-event chip damage all call `Math.random()` directly (62 such lines in `game.js` alone).
- **Advanced Difficulty.** 58 modifiers and 10 presets. The themed ones ("Goblin Swarm +30%", "Mage Storm", "Flyer Swarm") use the same faint ticket weights; +30% moves goblins from 10 tickets to 13 in a pool of 40 or more. Fog of War works and hides unspotted enemies.
- **Verdict.** Keep Campaign, Warband, Seed Run, PvE Horde. The rest multiply the test surface while the core is being rebuilt.
- **Proposal (S).** Once warbands exist, themed modifiers pick the lead faction or its tactic, so "Goblin Hell" means goblin-led waves.

## 24. Player-side "factions" (`js/faction-depth.js`, `js/crossover.js`, `js/wwe.js`)

- These three files are about the player's unlockable operative rosters (13 crossover groups and the Coliseum champions), not the enemy. The word "faction" means two unrelated things in the codebase.
- A player meets them only after meta unlocks or cheat codes; the Coliseum costs 1000 TP, 10 builders, 40 hamlets and 10 guilds.
- `faction-depth.js` keeps hooks for attacking enemy structures (`isPlanetSiegeSpecialist`, `getPlanetWarfareOp`, `modifyBuildingDamage`), dead for the same reason as section 15.
- Skimmed only. The roster audit should own these.

---

## Player-visible text with real franchise or real-person references

- "316 Club", "And That's The Bottom Line", "join the 316 Club … attitude, charisma, and entertainment": `README.md:645-646`, `index.html:1760-1761`, `js/wwe.js:110`. These point at a real wrestler's catchphrases.
- "Tombstone" tonic: `index.html:540`, `js/faction-depth.js:2066`, `js/units.js` milestone "Tombstone Rite". A perk name from a real shooter series.
- "Coliseum, Doom, or evolved allies": `js/faction-depth.js:2066`.
- "Imperium operatives": `js/faction-depth.js:532`. "Chaos warband — warp bolts": `js/faction-depth.js:223`. Generic words, but together they read as one tabletop setting.
- Not player-visible, but public in the repo: internal ids and file names such as `wwe`, `halo`, `lotr`, `jojo`, `baki`, `dragonball`, `doomslayer`, `fus_ro_dah`, `rko`, `batista_bomb`, `star_platinum`, and `scripts/test-halo-unlock.mjs` and its siblings. The Herald message prints an internal id on screen (`content-expansion.js:1776`), so ids can leak.

---

## The ten highest-value changes, in order

1. **Stop named bosses and locked monsters spawning in ordinary waves (S).** `game.js:7380` and `7982`; `game-depth.js:266` for hordes. This is a live difficulty and identity bug from about wave 25.
2. **Give every wave a lead faction and build it from warbands (L).** `enemy-factions.js`, `units.js:getWaveConfig`, `game.js:buildSpawnQueue`, `wave-composition-core.js`. Without this nothing else about factions can be felt.
3. **One edge, three sectors, fixed field (M).** Replace east, west and south flanks and the growing map with left, centre and right entry sectors at the top. `multi-front-siege.js`, `game.js`, `siege-loop.js`, `living-planet.js`.
4. **One tactic per faction, executed on the field (L).** `siege-loop.js`, `roster.js`, `enemy-factions.js`. See below.
5. **Cut the off-field menus to about nine actions that show on the field (M).** Spy 13 to 3, Courier 12 to 3, doctrines into the General. Remove every TP button: Levy, Steal, both War Chests, Royal Muster, expedition loot.
6. **Delete the dead enemy-kingdom layer (S/M).** `settlement-raids.js`, counter-offensive doctrines, Settlement Raid, stages 3 and 4, Mirror Empires, Threat Map building counts, pack "holds", the README's wave 200 claims, `procgen-obstacles.js`.
7. **One omen system with a real choice (M).** Merge wave events, planet events, wildlife events and hazards into `dynamic-map-events.js`: a card on the field about one night in three, two options, seeded deck.
8. **Boss waves belong to the boss (M).** Own army, no generic escort, no sub-bosses. `monster-bosses.js`, `game-depth.js`.
9. **Remove the hidden scalers (S).** Faction Reputation, Asymmetric Warfare, the Strategy Counterplay detector, Biome Spawn. Four invisible multipliers on enemy count that the player cannot read or steer.
10. **Fix the text and determinism bugs (S).** Doctrine "minutes" that are seconds; Scout report at dawn; Infiltrate identical to Scout; `nextWaveIntel` never cleared; horde flavours as labels; Seed Run using `Math.random`; hazard damage in raw HP; `biome-spawn.js` player types; Herald printing ids.

## New ideas that fit one field and permadeath

**A tactic per faction.**

- _Goblin Hordes: tunnels._ During the wave, dirt mounds appear behind the front line and goblins climb out 5 seconds later. Scouts and watchtowers show the mound early. Tests depth.
- _Orc Warbands: the push._ Shieldbearers form a row and advance at walking pace with archers behind; when the war chief's horn sounds they charge. Kill the chief first and the charge never comes. Tests armour-piercing and focus fire.
- _Dark Legions: the dead rise._ Every corpse on the field, theirs and yours, can be raised by a necromancer in range. A fallen veteran comes back against you under his own name. Tests killing casters and where you let men die.
- _Void/Abyssal: the hunt._ A small host that ignores the line; stalkers blink between shadows towards the General and healers. Tests bodyguards and formation.
- _Rivals._ When two factions share a sector they fight each other first, and the winner arrives bloodied.

**Weather that changes the fight.** Rolled at nightfall and shown as a card. Fog: ranged reach halved for both sides, scouts and watchtowers restore it nearby. Rain: no fire damage or burning, cavalry and runners slowed. Wind: arrows fly further downwind and shorter upwind. Frost: the ford freezes and opens a new path. The `fogOfWar` flag in `advanced-difficulty.js` and `hazardSlow` on units are existing hooks.

**A steerable General.**

- Move him by hand and his aura moves; the aura radius is drawn at all times.
- Two stances: _Lead from the front_ (larger aura, enemies target him) and _Command from the rear_ (orders recharge faster).
- An order bar that absorbs doctrines and Rally: War Cry, Hold the Line, _Advance_ (line steps forward one rank), _Fall back to muster_ (line withdraws in order, healers first).
- If he falls, the army takes a visible morale shock and loses the order bar until a veteran is promoted. That gives permadeath a centre.

**Smaller pieces.**

- The enemy camp is drawn at the top edge at night: tents per warband, the warlord's banner. This is the wave preview, so Scout becomes "send a scout to walk up and look", with risk.
- Warlords who retreat at low health and return ten waves later with a scar and a grudge against the soldier who wounded them.
- Prisoners: a routed enemy captured at the line can be ransomed for TP or questioned to reveal tomorrow's tactic.
- A wagon or refugee column crosses the field mid-wave now and then; escort it for a reward, or ignore it.
- The Courier's ride is visible and interceptable, so protecting him is part of the fight.

## Not verified

- Nothing was checked in a browser. All UI statements come from `index.html` and `js/ui.js`.
- `npm run test:all` and `npm run check` were not run. `scripts/sim-honest-play.mjs` was not run; my bot probe copies its logic.
- Composition numbers come from cheat-cleared runs on Normal: one seed to wave 126, one to wave 61. Host threat grows per wave regardless of play, so the stray-boss finding should hold in real play, but no honest run reached wave 25 to confirm it.
- The honest-bot comparisons (Levy, Disrupt) are two seeds each at a fixed tick budget. They show direction, not size.
- The volcano result is one run, with flanks active, and the player's army parked; treat it as weak evidence.
- Expedition profit, counter-raid behaviour, Hunt Pact allies, Twin Dispatch and every wave 100+ feature were read from code and not executed.
- `faction-depth.js`, `crossover.js`, `wwe.js`, `game-modes.js` and `strike-fx.js` were skimmed. Colony Value (`js/colony-value.js`) feeds wave composition and was outside this brief.
- Line numbers refer to commit `ed2eae8`.
