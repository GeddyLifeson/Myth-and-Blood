# Myth and Blood audit: economy, buildings, research, between-run progression

Date: 2026-11-13. Read-only audit of `/home/claude/myth-and-blood`. Nothing in the repo was edited.

## 0. Method and limits

What I did:

- Read `README.md`, `CLAUDE.md`, and every file in the assigned list, plus the economy parts of `js/game.js`, `js/units.js`, `js/siege-loop.js`, `js/content-expansion.js`, `js/game-core.js`, `js/game-depth.js`, `js/ui.js`, `index.html`.
- Checked UI wiring by tracing each system from its button or menu element to the code it calls.
- Searched for every exported function of each module and listed the ones nothing outside the module calls.
- Ran the stock honest bot (`scripts/sim-honest-play.mjs`, Normal, 150,000 ticks, one seed completed) and my own instrumented copies of it kept in `/tmp/econsim/` (outside the repo). Those log TP, army, research and the colony-value ratio per wave, and add bots that use a Courier or build a Research Lab.

What I did not verify:

- I did not play the game in a browser. UI claims come from reading `index.html`, `js/ui.js`, `js/ux.js`.
- Nothing past wave 25 was observed running. Everything said about waves 50, 100, 150, 200, 400, 500 is from reading code.
- I did not measure the combat value of walls, outposts, towers, traps, med tents or mess halls. Their numbers are quoted; their worth in a fight is not judged.
- The machine was shared with other audit jobs and heavily loaded, so sim sample sizes are small (one or two seeds per setup). Treat the sim numbers as direction, not balance data. Combat uses `Math.random`, so the same seed does not reproduce exactly.
- Three army-only runs soft-locked (a wave that never ended): Normal seed 4000 on wave 25 in the stock bot, seed 4000 on wave 12 and seed 4131 on wave 15 in my instrumented copies. The Courier bots ran 70,000 ticks without one. The cause is outside my area; I report it because it limits how far the army-only data goes and because it looks frequent.
- My stock-bot run hit its time limit before writing `scripts/sim-honest-report.json`; `git status` was clean when I finished. Other audit jobs were running tests in the same checkout, so if the scripts folder shows changes later, `git checkout -- scripts` restores it.

## 1. The run economy as it is today

### 1.1 Numbers

| Item                                   | Value                                                                                           | Where                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Starting TP                            | 10 / 7 / 5 / 4 (Baby / Normal / Chad / Hellbane)                                                | `js/units.js:613-665`                                   |
| Opening garrison                       | 4 footmen, free                                                                                 | `js/game.js:7245-7257`                                  |
| TP per cleared wave                    | `7 + floor(ease(w/100)*30) + min(5, floor(ease*5)) + difficulty bonus (+3/0/-1/-2)`             | `js/game.js:4188-4210`, `js/units.js:598`               |
| Result on Normal                       | 7 TP through wave 12, 8 at wave 13, 10 at wave 20, 14 at wave 30, 24 at wave 50, 42 at wave 100 | computed from the formula                               |
| Cumulative TP from wave clears, Normal | 77 by wave 10, 117 by wave 15, 163 by wave 20, 280 by wave 30                                   | computed                                                |
| Early horn                             | `min(5, floor(secondsLeft/10))` TP; night is 60 s, so pressing D at once pays +5 every wave     | `js/siege-loop.js:796-808`                              |
| Supply crates                          | 41% chance of 3-5 TP (+1 per 10 waves, max +6); 14% ambush from wave 3                          | `js/siege-loop.js:839-883`                              |
| Tax Levy (Courier message)             | costs 0 TP, pays +6 TP at the next wave clear, once per wave                                    | `js/units.js:827`, `js/game.js:9351`, `js/game.js:7009` |
| Army upkeep                            | first 14 soldiers free; each one over adds 7% to every recruit's price                          | `js/siege-loop.js:19-20`, `:476-481`                    |
| Spoils                                 | every 5 waves, pick 1 of 3, max 3 copies each, 13 kinds                                         | `js/siege-loop.js:23-91`, `:659-694`                    |
| Demolish refund                        | 50% of list price regardless of the building's health                                           | `js/game-core.js:830-832`                               |
| Research Lab                           | 45 TP + 2 live Builders (5 TP each)                                                             | `data/buildings.json` `research_lab`                    |
| Science per wave                       | capped at `min(22, 3 + floor(wave/5) + 2*labs)`; earned only from kills while a lab stands      | `js/research.js:501-506`, `:576-600`                    |

So on Normal a player who always calls the wave early earns about 12 TP per wave in the first 12 waves, plus crates. A footman costs 3, an archer 4, a mage 6.

### 1.2 What the bots show

Stock honest bot (army only, never builds, never researches), Normal:

- 20,000-tick report already in the repo: wave 13 to 16, still alive, 0 breaches.
- My 150,000-tick run, seed 4000: wave 25, 59 soldiers deployed, peak army 45, 10 lost, 0 breaches of 13, then a soft-lock on wave 25. The second seed was cut off by my time limit.

Instrumented bots, Normal (one seed each unless stated):

| Bot                                                              | Ticks  | Result                                                                                                                                                        |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Army only, seed 4000                                             | 70,000 | wave 31, still alive, 75 deployed, army 66, 8 lost, 0 breaches                                                                                                |
| Army only, seed 4131                                             | 31,000 | wave 15, army 36, 3 lost, 0 breaches, then soft-lock                                                                                                          |
| Courier on wave 1 + Tax Levy every night, seed 4000              | 70,000 | wave 30, still alive, 81 deployed, army 54 to 59, 13 lost, 1 breach                                                                                           |
| Same, seed 4131                                                  | 70,000 | wave 28, still alive, 71 deployed, army 63, 8 lost, 0 breaches                                                                                                |
| Courier + Call the Banner every night, seed 4000                 | 70,000 | wave 27, still alive, 26 knights on the field with no research done, 11 lost, 0 breaches                                                                      |
| Two builders on wave 1, then save for a lab and buy nothing else | -      | defeat on wave 6 (seed 4000) and wave 8 (seed 4131). This bot is deliberately naive; it shows that 55 TP of saving cannot be covered by the opening garrison. |

I did not get a fair "army plus lab from wave 8" run to compare against army only. My lab bots clicked a blocked spot near the deploy line ("Not enough space here!") and never placed the lab; that is my bot's fault, not the game's. A separate check confirmed a lab can be placed on open ground and finishes within one night. The cost and timing of the research path in 2.7 are therefore from the formulas plus one measured science rate, not from a head-to-head result.

Reading these:

- No bot was ever in danger on Normal. Across waves 1 to 31 they conceded 0 or 1 breaches and lost 7 to 13 soldiers. The runs ended on the tick budget, not on defeat. So in this range the economy is not under pressure, and a better economy does not show up as more waves survived.
- The levy bot is ahead on army size early: 23 against 19 at wave 6, 31 against 26 at wave 9, 38 against 31 to 32 at wave 12. By wave 28 to 31 all bots sit at 54 to 66 soldiers, because by then the recruit surcharge is ×4 and income buys one or two soldiers a wave whatever its size.
- Time per wave was about the same for all bots (wave 15 near tick 22,000).

Colony value (the adaptive difficulty layer), logged every wave: the player's strength ratio sat at the 0.5 floor on every wave from 1 to 11 in every run, giving an enemy count multiplier of 0.77 (0.72 from wave 10). After that it depended on the army. The footman-and-archer levy bot stayed between 0.5 and 0.62 through wave 30 with 54 soldiers. The knight bot rose to 0.76 at wave 12, 1.01 at wave 18 and 1.23 at wave 27 (count multiplier 1.13).

### 1.3 Reading of the whole

- Up to about wave 30 the economy is one decision: which soldier to buy next, and on Normal even that is forgiving. Bots that never touch buildings, research or spy reach wave 28 to 31 with 0 or 1 breaches. Nothing in my area can matter to a player until the fight asks for more than "buy the next unit".
- The lab path costs 55 TP, which is 71% of all wave-clear TP earned in the first 10 waves, and pays back with unit unlocks 5 to 11 waves later.
- A 4 TP Courier pays +6 TP per wave from the wave after it is bought. Nothing else in the game is close to that return.
- Everything gated at wave 50, 100, 150, 400 or 500 (branch tech, academies in practice, settlements in practice, ascension, the path layers, hybrid fantasies) sits beyond where an ordinary run ends. About 6,000 lines of the files in this audit serve those waves.
- There are three separate between-run bonus systems on the main menu (Ribbons, Crown Legacies, Crown of Ages), two more persistent stores (operative skills, foundational paths), and achievements. Their bonuses stack: starting TP can go from 7 to 21 on Normal.

---

## 2. Systems

Each section has: what it does, when the player meets it, decision impact, bugs and dead code, overlap, verdict, rework proposal with size (S = under a day, M = a few days, L = a week or more).

### 2.1 Tactical Points income

**What it does.** One currency, TP, pays for soldiers, buildings, strikes, spy and courier actions. It arrives at wave clear (`awardRoundTP`, `js/game.js:6998`), from the early horn, crates, spoils, the Courier's Tax Levy, the spy's Steal War Chest (cost 4, pays 4), wave events, and a few kill bonuses. Storage is uncapped apart from a sanity cap.

**When the player meets it.** Wave 1. TP is in the top bar; the wave-clear message shows the gain.

**Decision impact.** The base income is flat (7) for 12 waves, so nothing the player does to the field changes it. The only income decisions are free ones with an obvious answer: press D at the start of the night (+5), send Tax Levy (+6, costs nothing), use Steal War Chest when nothing else is wanted (net 0 TP and the next wave loses 2 enemies).

**Bugs and dead code.**

- `js/game.js:7005-7008`: the wave-clear payout multiplies by the branch tech `tpIncomeMult`, which only one node sets (`tech_macro`, wave 90, ×1.05). The HUD figure (`getTpPerRound`) does not include it, so shown and paid income differ once it is taken.
- `tech_logistics` (`js/tech-tree-branches.js:379`) lists `tpBonus: 1`. `getCombinedEffects` never reads `tpBonus`; the bonus does nothing.
- War Levy spoils and The Hundred ribbon pay at nightfall through `ctx.addTp` (`js/siege-loop.js:773`), outside `awardRoundTP`, so the "+N TP" wave message and `tpPerRound` in the HUD leave them out.
- Kingdom doctrine Royal Muster costs 5 TP and grants 5 TP plus morale (`js/units.js:433-441`): a free morale button.
- Doctrine text says "for 6 minutes" with `duration: 360` (`js/units.js:429-430`, `:447-449`, `:458-460`). The timers count down one per tick (`js/game.js:13901`), so the real length is 6 seconds.
- Demolish refunds half the list price whatever the building's health (`js/game-core.js:830`), so a building about to fall can be sold for full refund.

**Overlap.** Spoils (War Levy, War Chest, Early Horn), Ribbons (start TP, +1 per wave, +1 per early call), Crown Legacies (+4 start), Crown of Ages (+2 start), Courier, Spy, quarries, settlements, expeditions, tonic "Scavenger's Tonic" (35% chance of +1 TP per kill).

**Verdict.** Rework. The curve is fine as a floor; the sources around it need pruning and a real decision.

**Rework proposal (M).** One pay moment and one visible ledger.

- Pay all income at dawn in one line: base, levy, spoils, buildings, minus upkeep. Files: `js/game.js` (`awardRoundTP`, `getTpPerRound`), `js/siege-loop.js` (`onNightBegin`), `js/ui.js` tooltip.
- Replace "press D at once for +5" with a risk trade: the horn pays for each 10 seconds given up, and the next wave arrives with part of the following wave's host. Files: `js/siege-loop.js` (`earlyCallBonus`, `buildPreview`).
- Give Tax Levy a cost that bites (see 2.4).
- Refund in proportion to remaining health. File: `js/game-core.js:830`.

### 2.2 Army upkeep

**What it does.** Past 14 soldiers, each new recruit costs 7% more per soldier over that mark (`js/siege-loop.js:476-481`); at 28 soldiers prices are ×1.98. Warband mode doubles the base price.

**When the player meets it.** Around wave 4 to 5 for a player who spends everything on troops (the bot had 16 at wave 5). A chip at the top left reads "Recruit cost +N%".

**Decision impact.** It is meant to make each soldier count. In practice it can be walked around:

- The count is `unitCounts.player`, every living player unit. Builders and the Courier raise the price of fighters; a lab's two builders cost the player 14% on every later recruit.
- Free or flat-price sources ignore it: the Reinforcements strike (12 TP for 2 footmen and 1 archer, list value 10; `data/strikes.json`), the Courier's Request Reinforcements (3 TP for 2 footmen) and Call the Banner (5 TP for a knight), academies, expedition returns, Crown heirs. At 28 soldiers the same three units cost 20 TP by hand and 12 by strike.
- The surcharge is paid once at purchase. A large army already on the field costs nothing to keep, so the name "upkeep" is wrong and the best play is to buy early.

**Bugs and dead code.** None found in the function itself. Measured effect: the bots field 54 to 66 soldiers by wave 28 to 31, where the surcharge is ×3.8 to ×4.6. Growth slows from 3 to 4 soldiers a wave early to 1 or 2 late, and extra income (the levy bot) stops turning into extra soldiers. So it works as a brake, well above the 14 to 28 range the README describes.

**Overlap.** Colony value also taxes army size (through enemy count); "a bigger host also draws more line-breakers" (README) is a third tax on the same thing.

**Verdict.** Rework.

**Rework proposal (M).** Make it true upkeep paid at dawn: each soldier over the free number costs wages out of the dawn income, shown in the same ledger as 2.1. Specialists either do not count or count half. All unit sources obey it. Files: `js/siege-loop.js` (`deployCostMult` becomes `dawnWages`), `js/game-core.js:727-733`, `js/game.js` (`awardRoundTP`), `js/ui.js`. Pair it with a hard field cap raised by buildings (a Mess Hall feeds 4 more), which gives buildings a job.

### 2.3 Spoils of war

**What it does.** After every fifth wave three rewards are offered and one is kept for the run; unclaimed spoils are picked at random at dawn (`js/siege-loop.js:814`). There are 13: +10% damage, -8% damage taken, +2 TP per wave, +2 breach limit, +15% night heal, +10 night morale, +1 kill experience, more and safe crates, line-breakers 20% slower, +20% against bosses and elites, +15 TP now, +20% rear damage, early horn pays double. Each can be held three times.

**When the player meets it.** After wave 5, in a card at the top of the screen. The bot claimed 4 by wave 25.

**Decision impact.** This is the one system in my area that asks for a choice at a set moment and is seen every run. The choice is uneven:

- Early Horn against War Levy: a player who presses D at the start of every night gets +5 TP per wave per copy of Early Horn (`base * (1 + earlyCallMult)`), against +2 per copy of War Levy. Early Horn wins by 2.5 times with no cost.
- War Chest (+15 once) loses to both after 3 to 8 waves and is dead unless the run is about to end.
- Veterans' Due (+1 experience per kill) is stronger than it reads. Experience adds flat damage (`floor(exp/3)*2`, `js/game.js:3283`) and shortens the attack timer (`90 - exp*4`, floor 12 ticks, `js/game.js:13340`, `:13372`). A kill gives 2 experience, so a soldier reaches the 12-tick floor after about 10 kills; with Veterans' Due after 7. That code is combat, not my area, but it makes this the dominant spoil for anyone who keeps soldiers alive. Flagging for whoever audits roster and combat.
- Scavengers, Flanking Drill and Caltrops are weak picks next to flat damage and damage reduction, which always apply.

**Bugs and dead code.**

- Auto-claim picks `Math.floor(rng()*3)` (`js/siege-loop.js:814`); if a draft has fewer than 3 entries the index can miss and `claimSpoils` returns false while the `while (run.drafts.length)` loop keeps running. `rollSpoils` pads the pool to three War Chests when it is short, so I could not construct the case, but the loop has no guard.
- `store.stats.edicts` counts auto-claimed spoils toward the Council Seat ribbon.

**Overlap.** Ribbons give the same effects permanently in smaller doses (damage, damage taken, breach limit, crate rate, runner slow, boss damage, kill experience, per-wave TP). Crown Legacies and Crown of Ages give damage and damage taken again.

**Verdict.** Keep, and make it the main in-run upgrade channel.

**Rework proposal (M).** Files: `js/siege-loop.js` only, plus card text.

- Turn each offer into an either/or with a cost attached to the strong ones: "Sharpened Steel: +10% damage, soldiers cost 1 TP more", "War Levy: +2 TP per wave, breach limit -1".
- Drop War Chest or make it scale with the wave. Cap Early Horn at one copy.
- Let the player re-roll once per run for TP.
- Fold the research unlocks into spoils on boss waves: after waves 10, 20, 30 the offer is three unit or building unlocks (see 2.7).

### 2.4 Courier economy (Tax Levy, Request Reinforcements, Call the Banner)

**What it does.** A Courier (4 TP, available from wave 1) sends one royal message per wave. Among them: Tax Levy, 0 TP, +6 TP at the next wave clear; Request Reinforcements, 3 TP, 2 footmen next round; Call the Banner, 5 TP, one knight at once (`js/units.js:824-838`, `js/game.js:9271-9360`).

**When the player meets it.** The right-hand panel. The staged introduction dims it until wave 8 but the README says a dimmed tab still works, and the Courier is on the deploy panel from wave 1.

**Decision impact.** Dominant.

- Tax Levy is +6 TP per wave for a one-off 4 TP, against a base income of 7. It nearly doubles income from wave 2. The levy bot had 38 soldiers at wave 12 against 31 to 32 for the army-only bot. The lead disappears later only because the recruit surcharge swallows it (2.2); a player who spent the extra TP on strikes or buildings would keep it.
- Call the Banner gives a knight for 5 TP. A knight is 8 TP by hand, is locked behind a Research Lab (55 TP) and Iron Weapons (35 SP), and pays the upkeep surcharge. The banner bot had 26 knights at wave 27 with no lab, at a flat 5 TP each while hand-bought recruits cost over four times list price. This skips the research tree's first node and the upkeep rule together.
- The three messages compete for one slot per wave, which is a real choice, but all three are far above every other use of 0 to 5 TP.

**Bugs and dead code.** `getCourierCost` simply calls `getSpyCost` (`js/content-expansion.js:1903`); fine, noted for whoever touches costs.

**Overlap.** Quarry and Trade Outpost (+1 TP per wave each for 14 to 16 TP), War Levy spoil, hamlets, Reinforcements strike, the research gate on knights.

**Verdict.** Rework.

**Rework proposal (S).** Files: `js/units.js:824-838`, `js/game.js:9271-9360`.

- Tax Levy: +6 TP and every soldier loses 3 morale, or +4 TP and the next wave's host is 10% larger. A price the player can read.
- Call the Banner respects research and upkeep, or becomes a spoil.
- Fold the Courier unit into a building (2.6) so a messenger is not a 4 TP body that also counts toward army size.

### 2.5 Defensive and support buildings (Outpost, Wall, Castle, Med Tent, Mess Hall, Watchtower, Spike Trap)

**What it does.** Outpost 4 TP (cover 0.5, one garrison slot, +55 range). Wall 6 TP (350 HP, blocks movement, 0.45 wall protection). Castle 50 TP (the sum of its parts: 4 walls, 4 outposts, keep, med tent, mess hall; `js/units.js:1931-1937`). Med Tent 5 TP. Mess Hall 5 TP (morale aura 4). Watchtower 5 TP (vision 200, +35 range). Spike Trap 3 TP (45 damage, 90-tick cooldown). All need a Builder (5 TP, two projects at a time).

**When the player meets it.** The Build tab on the left. Outpost, Wall, Med Tent, Mess Hall and Research Lab are open from wave 1. Watchtower and Spike Trap need Field Engineering (30 SP, wave 4). Castle needs Fortification (40 SP, wave 6). The README lists all seven as plain buildings and does not mention the research gate for three of them. The staged introduction (`js/siege-loop.js:270-306`) has no step for builders or buildings at all.

**Decision impact.** Not measured in a fight. From the economy side: the bot reaches wave 25 with no buildings, so none is needed on Normal. Colony value adds siege towers and sappers to the enemy pool once the player has 2, 4 and 8 walls (`js/colony-value.js:258-270`), which taxes walls specifically.

**Bugs and dead code.**

- Building definitions exist twice: `data/buildings.json` and inline in `js/content-expansion.js:205-330` (quarry, trade outpost, fortress upgrade, three extra tonic stations). `fortress_upgrade` and `perk_double_tap`, `perk_mule_kick`, `perk_sleight` exist only in the inline copy. Two sources for the same table.
- The sixth-economy-site cap is checked after the money is spent (see 2.6).

**Overlap.** Hold the Line order, Fortify Zone strike, Hardened Shields spoil, healers, bards (all give cover, damage reduction, healing or morale without a building).

**Verdict.** Keep the set, rework what they are for.

**Rework proposal (M).** On one field with permadeath, a building should be a commitment of ground. Give each of the five starter buildings one either/or upgrade bought once: Outpost becomes Archer Platform (+range) or Barricade (blocks line-breakers); Med Tent becomes Surgery (heals faster) or Triage (saves one soldier per wave from death at 1 HP); Mess Hall becomes Kitchens (+4 army before wages) or Tavern (morale). Files: `data/buildings.json` (add `upgrades`), `js/game.js` (`onBuildingComplete`, a new `upgradeBuilding`), `js/ux.js` (building panel), remove the duplicate table in `js/content-expansion.js`. Drop the research gate on Watchtower and Spike Trap.

### 2.6 Economy buildings (Quarry, Trade Outpost)

**What it does.** Quarry 14 TP and Trade Outpost 16 TP each pay +1 TP per wave; both need 2 live Builders. Only the first six sites pay (`js/content-expansion.js:1113-1130`).

**When the player meets it.** Not in an ordinary run. They need Prospecting (48 SP, wave 15), which needs Field Engineering (30 SP), which needs a lab. With one lab from wave 8 the science cap reaches 78 SP around wave 19 if nothing else is researched first.

**Decision impact.** Dead choice. Payback is 14 to 16 waves after wave 19 or later, on top of 55 TP for the lab and builders, and each site raises the colony value (the structure's price plus 3.8 per TP of income, `js/colony-value.js:203`). A 4 TP Courier pays six times as much from wave 2.

**Bugs and dead code.**

- The six-site cap is not checked at placement. A seventh site takes the TP and reports "cap reached, morale/utility only" on completion (`js/content-expansion.js:1870-1882`).
- README says the cap is on "quarries + trade posts combined"; the code caps which six pay by sorting on building id (`:1124-1129`), so which site is the unpaid one is arbitrary.

**Overlap.** Tax Levy, War Levy spoil, hamlets and guilds, expeditions.

**Verdict.** Merge with settlements into one "income building" line, or cut.

**Rework proposal (S to M).** One income building, open from wave 1, placed forward of the line so it must be defended: a Toll Post that pays +2 at dawn while no enemy came within reach during the previous wave. That ties income to holding ground. Files: `data/buildings.json`, `js/content-expansion.js` (`getEconomyTpBonus`), `js/game.js` (`awardRoundTP`), `js/research.js` (remove `prospecting`).

### 2.7 Research Lab and core research

**What it does.** A lab (45 TP, 2 Builders) lets kills earn Science Points, capped per wave at `min(22, 3 + floor(wave/5) + 2*labs)`. One project runs at a time. The core tree has 22 nodes costing 1,454 SP in total; another 15 nodes (13 factions, the Coliseum, the Hellbane) cost 1,975 SP. Research resets every run (`js/research.js:446`, called from `js/game.js:7174`).

Key nodes: Iron Weapons 35 SP at wave 3 (sapper, knight, crossbowman); Field Engineering 30 at wave 4; Morale Arts 32 at wave 5 (bard); Fortification 40 at wave 6 (castle); Command Theory 50 at wave 8 (General); Advanced Infantry 42 at wave 10 (scout, pikeman); Siege Engineering 55 at wave 12 (ballista); Veteran Doctrine 45 at wave 12; Prospecting 48 at wave 15; Academy Charter 65 at wave 20; Settlement Charter 85 at wave 40.

**When the player meets it.** The Research Lab button and a RESEARCH button sit in the Build tab from wave 1. Locked units and buildings show a research-locked style (`js/ui.js:1000`, `:1109`) and clicking one says to research it. No introduction step mentions it.

Best-case timeline with one lab finished on wave 8 and the cap hit every wave: 35 SP by wave 13, 85 by wave 19, 120 by wave 23, 200 by wave 31, 400 by wave 47, the full core tree at wave 102.

Measured rate: in a test run with a lab standing from wave 2 and 12 soldiers (the lab was paid for with debug TP so the rate could be seen early), Iron Weapons had 27 of 35 SP after seven waves, about 3.9 SP per wave against a cap of 5 to 6. Early waves do not have enough kills to reach the cap. So Iron Weapons takes about nine waves from the day the lab stands, and the best-case timeline above is roughly a third too fast in the early game.

**Decision impact.**

- 8 of the 15 troop types are locked at the start: crossbowman, knight, sapper, scout, pikeman, bard, ballista, General. The roster rebuild gave each of them a counter role (pikes against riders, crossbows against armour, ballista against bosses). The research gate means those counters are missing for the first 13 to 25 waves, which is most or all of a normal run.
- The staged introduction's wave-4 line explains the General's orders. A General needs Command Theory (wave 8, 85 SP with its prerequisite), so on wave 4 the player cannot have one.
- The lab is a large early bet (55 TP of 77 earned by wave 10) with a first return about nine waves away, and the bots show it is not needed to reach wave 30 on Normal. The sensible play today is to skip research.
- There is no branching. Every node is eventually taken if the run lasts; order is the only choice, and wave gates fix most of the order.
- At the wave-100 reset every core node with a wave gate of 100 or less is granted free (`grantBootstrapUnlocks`, `js/research.js:602-609`), so research done before wave 100 is refunded as nothing.
- Call the Banner (2.4) hands out knights without it.

**Bugs and dead code.**

- `Research.tick()` is an empty function (`js/research.js:645`).
- `FoundationalMedievalLayer.recordScience` is exported and never called, so `scienceEarned` stays 0. Three things read it: `TechTreeBranches.getTechScore` (`js/tech-tree-branches.js:478`), `EternalPathFramework.recomputeInvestment` (`js/eternal-path-framework.js:288-289`) and the tech path. The "tech" root therefore scores only from lab count, a few build counts and research count.
- `FoundationalMedievalLayer` scores research ids that do not exist in the tree: `academy_knights`, `academy_support`, `academy_elite`, `academy_command`, `arcane_weapons`, `mage_tower` (`js/foundational-medieval-layer.js:64-72`). Only `academy_charter` is real.
- Science gain multiplier and research speed multiplier are separate stats that mean almost the same thing (`js/research.js:538-545`); SP "banked" (`sciencePoints`) is a lifetime counter that buys nothing.
- The README's troop table lists costs for the eight locked troops with no word that they need research.

**Overlap.** Branch tech tree (same SP, same lab, same panel, and the two block each other: `js/research.js:721-727`, and `startInvest` in `js/tech-tree-branches.js`), spoils, academies, Courier banner, MetaProgress faction unlocks (which bypass the faction nodes for good).

**Verdict.** Rework. Cut the lab-and-SP mechanism, keep the unlock list.

**Rework proposal (L).** Files: `js/research.js` (most of it goes), `js/siege-loop.js` (spoils), `js/game.js` (deploy and build gates at `:8704`, `:10588`, `:10215`), `js/ui.js`, `data/buildings.json` (remove `research_lab`), `README.md`.

- All 15 troop types deployable from wave 1 so the counter system works from the first wave that needs it. Price is the gate.
- Replace research with "Doctrines": on each boss wave (10, 20, 30, ...) the player picks one of two doctrines that exclude each other for the run. Examples: Pike and Shot (pikemen and crossbowmen 1 TP cheaper) or Heavy Horse (cavalry and knights +15% health); Field Works (walls and outposts build twice as fast) or Flying Column (no buildings bonus, soldiers move 15% faster). Ten boss waves, ten real decisions, no second currency.
- If a science currency is kept, earn it at dawn from a building the enemy targets, not from a per-kill trickle with a per-wave cap.

### 2.8 Academies

**What it does.** Fourteen academies, 40 to 100 TP, each trains one free unit of its type per round (healer every 5th wave, General every 10th). Building one needs the academy research (Academy Charter 65 SP at wave 20 and later nodes) and an Immortal (rank 6) soldier of that type alive on the field (`js/units.js:743-766`). From wave 100 TP deployment of troops ends and academies are the only source (`js/game-core.js:727`).

**When the player meets it.** The ACADEMIES block in the Build tab is visible from wave 1. Reaching Immortal takes six gold-star cycles: 27 bronze stars per cycle (one per kill, one per wave survived; `js/units.js:1087-1130`), so 162 kills-or-waves, plus a TP promotion each cycle that needs Veteran Doctrine (45 SP) and costs `unit cost * (1.15 + 0.7*rank)` (`js/units.js:1290-1295`), 54 TP in total for a footman. In practice: nobody before wave 30 to 40, and only for the unit type that happened to get the kills. At wave 100 the reset hands the player five academies free (`js/progression-restarts.js:21-27`).

**Decision impact.** Before wave 100, payback is 13 waves for a footman academy (40 TP for 3 TP of unit per wave) and 9 for a mage academy, so it is a weak buy that also needs a mentor. After wave 100 it is forced. The mentor rule sends the player's best veteran to stand next to a building, and the academy stops being buildable if he dies, which is a permadeath hook worth keeping.

**Bugs and dead code.**

- `AscensionSystem` building chains set `academyVetBonus` and `spawnMoraleBonus` on academies, but `tryAscendBuilding` has no caller (2.13).

**Overlap.** Reinforcements strike, Courier reinforcements, upkeep (academy units skip the surcharge), the wave-100 reset.

**Verdict.** Rework and pull forward, or cut with the wave-100 era.

**Rework proposal (M).** Make it a "Training Ground" open by wave 10: a named veteran of rank 2 or more is posted there for a wave (off the line) and one recruit of his type arrives with one rank already. The cost is the veteran's absence, the risk is his death if the building falls. One building instead of fourteen. Files: `data/buildings.json` (collapse 14 entries), `js/units.js:743-766`, `js/game.js` (academy tick, `getAcademyBuildStatus` at `:16540`), `index.html:241-280`.

### 2.9 Settlements (Hamlet, Village, Town, City, Metropolis, Merchant Guild, Fortress Upgrade)

**What it does.** Hamlet 100 TP, 5 Builders, built over 5 waves, pays TP per wave. Larger tiers cost 180, 280, 420, 600 TP and need 6 to 10 Builders. Merchant Guild 150 TP, +1 TP per wave if inside a hamlet's aura. Fortress Upgrade 50 TP on a finished hamlet. Settlement income is soft-capped at 18 with 55% above that (`js/game-depth.js:19-21`, `:124-128`).

**When the player meets it.** The buttons are in the Build tab from wave 1. Hamlet needs Settlement Charter (85 SP, wave 40, after Prospecting and Field Engineering), so wave 40 at the earliest and in practice only for players near wave 100. The wave-100 reset places two hamlets and a guild for free.

**Decision impact.** None in an ordinary run. Where it is reachable, a hamlet is 125 TP with builders and takes 5 waves to finish.

**Bugs and dead code.**

- Hamlet income: `data/buildings.json` says `tpBonusPerHamlet: 5` (village 8, town 10, city 12, metropolis 15) and `HAMLET_TP_PER_ROUND = 5` (`js/units.js:21`). The README, the tooltip lore (`js/lore-data.js:775`) and the manual's table say +1 TP per round. One of them is wrong; the code pays 5.
- With the soft cap at 18, four hamlets (20 raw) already hit it. A metropolis (15) plus one hamlet does too. The four higher tiers have almost no room to matter.
- `settlementWarnBefore: 0` on every settlement, so the "recommended after wave N" warning in `finalizeBuild` (`js/game.js:10322`) never fires.
- The Grand Coliseum's README requirements (40 hamlets, 10 guilds) do not match the data (`recommendedHamlets: 2`, `recommendedGuilds: 1`, and they are only tips; `js/game.js:10231-10245`).

**Overlap.** Quarry and Trade Outpost, colony value (hamlets are weighted ×1.85, guilds ×2.05), settlement raids, the wave-100 and wave-200 resets.

**Verdict.** Cut candidate for the continuous-field game, or merge into the single income building of 2.6. The five-tier ladder and guild are an RTS layer for waves 100 and up.

**Rework proposal (S if cut, M if merged).** If kept in spirit: one "Village" behind the line that grows a tier every 10 waves it survives untouched, pays at dawn, and loses a tier when it is hit. No builder count, no research, one building. Files: `data/buildings.json`, `js/game.js:2775-2845` (settlement counting), `js/game-core.js:555-570`, `index.html:215-236`, `js/research.js` (six nodes removed).

### 2.10 Tonic stations (perks)

**What it does.** Thirteen small buildings, 9 to 14 TP, each gives one tonic to eligible heroes who walk to it at night: +35% health, +30% attack speed, a self-revive per wave, splash, a chance of +1 TP per kill, and so on. A hero holds up to 4 (`js/perks.js`).

**When the player meets it.** Normally never. The buttons are hidden unless a faction, the Coliseum or the Hellbane is unlocked in MetaProgress, or Tonic Stations Science is researched (95 SP, wave 55, after Village Rights). Only Generals, operatives, champions and the Hellbane can drink (`isEligibleForPerks`, `js/perks.js:129-134`); ordinary troops cannot.

**Decision impact.** None for a normal run. For a player with a faction unlocked by cheat or meta, Ironbrew (+35% health for 12 TP, shared by every hero) is an obvious buy.

**Bugs and dead code.**

- `updatePerkCollectionLocal` returns unless `perkMachinesUnlocked()` is true (`js/game.js:13753`). That function looks only at MetaProgress. A player who unlocks tonics through research alone can build the stations (the build gate accepts research, `js/game.js:10266-10273`) and no one will ever drink from them.
- Slots are `min(4, max(1, stars))`, so a hero with no stars still gets one slot.

**Overlap.** Spoils, operative skill trees, veteran ranks, spoils-style buffs in general.

**Verdict.** Cut candidate, or merge into spoils.

**Rework proposal (S).** Remove the 13 buildings; move the six tonics with a clear identity (Ironbrew, Field Revival, Swiftstep, Storm Fizz, Last Stand, Scavenger's) into the spoils pool as rewards that attach to one named veteran chosen by the player. Files: `js/perks.js`, `js/siege-loop.js`, `data/buildings.json`, `index.html:500-537`, `js/game.js:13752-13782`.

### 2.11 Faction barracks, operatives, synergies, operative skill trees

**What it does.** Thirteen faction barracks at 90 TP and 2 Builders each, the Grand Coliseum at 1,000 TP and 10 Builders. Each lets the player recruit that faction's operatives (104 in `data/operatives.json`, 18 to 33 TP each). `data/synergies.json` has 19 bonuses for fielding two (in one case four) factions together, such as +15% melee damage or +10 accuracy. `js/operative-skill-trees.js` gives 8 of the 14 groups a four-node tree (costs 1, 2, 2, 3 points); points come from recruiting (1 each) and every 20th wave.

**When the player meets it.** Not in a first run. A faction opens by cheat code, by a MetaProgress unlock, or by faction research at 85 to 160 SP. The MetaProgress unlocks all require a campaign victory (wave 100) plus a hidden play-style test, for example "enemy structures razed >= 12" or "morale high in 55% of samples" (`js/achievements.js:965-1060`). The only practical path today is the cheat menu, which the README documents.

**Decision impact.** For someone with factions unlocked, one operative costs 3 to 4 waves of early income and a barracks 13. A two-faction synergy needs about 230 TP before it pays anything. Colony value adds counter enemies when crossover units are fielded (`js/colony-value.js:289-310`).

**Bugs and dead code.**

- Skill-tree purchases are saved to localStorage and reloaded every run (`js/operative-skill-trees.js:302-327`), while points are per run. So bought nodes are permanent and free in later runs, and the panel shows "0 of 1 point(s) free" while the player owns 8 points of nodes. The header comment says "spent with run skill points"; the README says "permanent bonuses". The code does a third thing.
- Six factions (fotns, dragonball, imperium, crystal, warp, tes) and the Hellbane have no tree; `getFactionForUnit` returns `'doom'` for the Hellbane, which has no entry.
- `getAvailablePoints`, `purchaseNode`, `grantSkillPoint` are exported and used only inside the module (fine, noted).
- All 9 synergy bonus keys are read by `js/faction-depth.js`. I did not check each application.

**Overlap.** Tonics, spoils, Mythic path layers, colony value, MetaProgress, achievements.

**Verdict.** Out of the core loop. Keep the content as an optional mode or a late unlock; do not let it shape the base economy. Rework the skill tree's persistence either way.

**Rework proposal (M).** One "Mercenary Camp" building, open from wave 10, offering three random operatives each night at their listed price, one hire per night. That puts the 104 operatives in front of the ordinary player without 13 barracks, 13 research nodes and 13 cheat codes. Synergies stay as they are. Skill trees: decide run-only or permanent and make the points match. Files: `data/buildings.json` (13 entries become 1), `js/crossover.js`, `js/faction-depth.js`, `js/operative-skill-trees.js:302-327`, `js/research.js:27-165`.

### 2.12 Branch tech tree (`js/tech-tree-branches.js`)

**What it does.** At wave 50 the game locks one of four roots (Martial, Arcane, Mythic, Tech) from scores it has kept on the player's deploys, kills and builds. Each root has 9 nodes costing 38 to 220 SP with wave gates of 50, 55, 60, 65, 80 to 90, 120, 150, 400 and 500. Effects are small multipliers: damage ×1.03 to ×1.14, health ×1.03 to ×1.12, science gain, research speed, "fleet" damage.

**When the player meets it.** Wave 50, inside the Research panel. A HUD chip appears from wave 35 (`js/ui.js:1432`). The player does not choose the root; `pickLeadingRoot` does (`js/tech-tree-branches.js:501-514`), and falls back to Martial when every score is under 8.

**Decision impact.** None. The root is assigned, the nodes are a straight line, and it shares the SP pool with core research so the two block each other.

**Bugs and dead code.**

- `fx.hpMult` is applied twice to every spawned unit (`js/game.js:4013-4016` and `:4054-4057`), so a ×1.06 health node gives ×1.12.
- `tpBonus`, `academyBonus`, `fleetReadiness`, `fleetStrength`, `fleetCountRelief`, `fleetDmgMult`, `crossoverCostMult`, `echoCostMult`, `legendPowerMult`, `ancestralBonus`, `honorPlate`: `tpBonus`, `academyBonus` and `honorPlate` are not even summed in `getCombinedEffects`. The fleet values are summed, but `js/game.js`, `js/units.js`, `js/siege-loop.js` and `js/ui.js` contain no "fleet" reference at all. `crossoverCostMult`, `echoCostMult` and `legendPowerMult` are summed and read by no other file. `ancestralBonus` is read only inside `js/thematic-era-synergies.js` from its own table. Of the 36 nodes, the ones that do anything are those with damage, health, archer, footman, mage, mythic, siege, build speed, science, and the single `tpIncomeMult`.
- The Tech root's score depends on `scienceEarned`, which is always 0 (2.7).
- `getNodesForBranch`, `completeInvest`, `ROOT_BRANCHES`, `ROOT_LOCK_WAVE` are exported and unused outside.

**Overlap.** Core research, Eternal Path Framework, the four path-evolution files, Thematic Era Synergies, Foundational Medieval Layer (all five compute a "which of four paths is this run" answer).

**Verdict.** Cut. If the wave-50 idea is wanted, merge it into the doctrine picks of 2.7.

**Rework proposal (S to cut).** Remove the `<script>` tag, the 13 call sites in `js/game.js`, the panel mount in `js/research.js:1160`, the HUD chip in `js/ui.js:1425-1440`, and the test `scripts/test-tech-tree-branches.mjs`; run `npm run gen:eslint-globals`.

### 2.13 The path layers (six files that label the run)

Files: `js/foundational-medieval-layer.js` (451 lines), `js/eternal-path-framework.js` (695), `js/martial-path-evolution.js` (476), `js/arcane-path-evolution.js` (494), `js/tech-path-evolution.js` (687), `js/mythic-path-evolution.js` (567), `js/thematic-era-synergies.js` (523), `js/hybrid-power-fantasy.js` (372). About 4,300 lines.

**What they do.** Each keeps a score from what the player deploys, kills and builds, names the run's "path" (Longbow, Arcane or Mythic in the foundational layer; Martial, Arcane, Tech or Mythic in the others), and turns the score into tiers. The live effects are small stat bumps applied when a unit spawns (`js/game.js:3962-4008`): for example +2% archer damage and +2% footman health for Longbow (`js/foundational-medieval-layer.js:395-397`), and `1 + 0.02*tier` damage, `1 + 0.025*tier` health for units on the dominant path (`js/eternal-path-framework.js:464-469`). They also print HUD chips and lines in the night intel text. Thematic Era Synergies starts at wave 150; Hybrid Power Fantasy at 150, 400 and 500; the "kingdom" and "galactic" stages of the four evolution files at 150 and 400.

**When the player meets it.** A HUD chip ("Martial T1" or similar) appears once any path has a score, which is within the first waves because every archer or footman deployed adds 2 to Longbow and every kill adds 1. Nothing explains it. Everything else is at wave 75 (a one-line message), 150, 400 or 500.

**Decision impact.** None. The player cannot pick a path; the labels follow the default army (footmen and archers always lead to Longbow and Martial). The bonuses are applied once at spawn and flagged (`unit.eternalPathBonus`, `unit.crownLegacyApplied`), so a soldier deployed on wave 1 gets a smaller bonus than the same soldier deployed on wave 10 and never catches up.

**Bugs and dead code.**

- Never called from outside their own file: `getTacticalMods` (in martial, arcane, tech, mythic, hybrid), `getUnbreakingLineMods`, `getSingularityMods`, `getFrameworkMods`, `getFleetMods`, `recordAction` (so the signals `order_fortify`, `template_shield_wall`, `decree_legion_oath` and their kin never fire), `evaluatePathPurity`, `getAncestralWeaponMult`, `getArcaneInfusionMods`, `getHeroEchoMods`, `getArcaneFleetRuneMult`, `renderPanelHtml` (three files), `bootstrapForWave` and the `spawnTest*` helpers. The enemy-count, elite-slot and research-speed effects these return are therefore not in the game.
- `FoundationalMedievalLayer.recordScience` never called; six research ids it scores do not exist (2.7).
- Crystallization (the persistent result of the foundational layer) happens at wave 150, or at run end if the run passed wave 50 (`js/foundational-medieval-layer.js:325-330`). Below wave 50 the layer leaves nothing behind.
- Unit spawn runs 13 bonus layers in sequence (`js/game.js:3942-4062`), each flooring to an integer. Order matters and none of it is shown to the player.

**Overlap.** With each other, almost completely; with the branch tech tree; with Crown of Ages (whose seed nodes are unlocked by crystallization); with roster traits, which already give each unit an identity.

**Verdict.** Cut candidate, all eight. If one idea is kept, it is "the game notices how you play and names it", which fits in 50 lines inside the run summary.

**Rework proposal (S to cut, plus S for the replacement).** Remove the eight script tags and their call sites in `js/game.js` (`:3962-4008`, `:7197-7206`, `:7752-7795`, `:8035-8077`, `:8249-8320`, `:10651-10663`, `:11059-11068`, `:16284-16325`), the HUD chips in `js/ui.js:1345-1470` and `index.html:860-880`, and seven test files. Replacement: at game over, one line in the after-action report ("A Longbow host: 61% of kills by archers"). File: `js/siege-loop.js` (`renderAfterAction`).

### 2.14 Ascension system (`js/ascension-system.js`)

**What it does.** At waves 150 and 400 the run is granted Legacy Points (18 and 28, plus 3 per Immortal alive). Rank-4-plus veterans can spend 14 to 24 points to ascend to a titled form with ×1.18 to ×1.38 stats.

**When the player meets it.** Wave 150, through a button in the unit panel (`js/ux.js:643`, `:682`). Never in an ordinary run.

**Decision impact.** At wave 150 there is a real choice of which veteran to raise. Nobody is there.

**Bugs and dead code.** Building ascension (`tryAscendBuilding`, `getBuildingAscensionOffer`, the `BUILDING_CHAINS` table, `academyVetBonus`, `spawnMoraleBonus`) has no caller and no button. `grantLegacyPoints` is exported and unused outside. `meta.totalLegacySpent` and `totalAscensions` are saved to localStorage and read by nothing I found.

**Overlap.** Veteran ranks and honor names, Crown heirs, Crown of Ages "ascends" lists, tonics.

**Verdict.** Merge the idea into veterans and pull it to wave 10 onward; cut the file's wave-150 and wave-400 tables.

**Rework proposal (M).** "Honours": after each boss wave the player may give one honour to one living veteran from a short list (Standard Bearer: morale aura; Captain: nearby soldiers of his type +10% damage; Old Hand: trains recruits, see 2.8). A soldier holds one. It dies with him. Files: `js/ascension-system.js` (rewritten small), `js/roster.js`, `js/ux.js:640-690`, `js/game.js:4065-4082`.

### 2.15 Progression restarts (`js/progression-restarts.js`)

**What it does.** On waves 100 and 200 the field is wiped: all units and buildings are released, the map is regenerated, and the player receives a prebuilt base (7 to 9 walls, an outpost, 2 hamlets, a guild, 5 to 6 academies), a free army of 22 to 38, up to ten veterans, and `110 + 35%` (wave 100) or `140 + 28%` (wave 200) of the TP held. Core research up to that wave is granted.

**When the player meets it.** Wave 100. Not in an ordinary run.

**Decision impact.** It removes decisions. Everything built and every non-veteran soldier before wave 100 is deleted and replaced with a standard kit, and 65% of banked TP is taken. A player who knows this should stop building around wave 90 and spend down to zero.

**Bugs and dead code.**

- `applyRunStartBonuses` is called again at each restart (`js/game.js:3573-3600`), so Crown Legacy start TP and Crown heirs are granted a second and third time. Heirs are new units each time.
- `formatHudLine` contains an `if` whose body is only a comment (`js/progression-restarts.js:244-246`).
- `isEscalationWave`, `shouldSkip`, `performRestart`, `ESCALATION_RESTARTS` unused outside.

**Overlap.** Directly against the brief: one continuous field, permanent losses. Also against academies, settlements, research (all handed out free here).

**Verdict.** Cut. A wave-100 victory already exists (`campaignVictoryDeclared`); the run can simply continue on the same field.

**Rework proposal (S).** Remove the script tag, `ProgressionRestarts.onWaveStart` and its context builder in `js/game.js:3400-3600` region, the snapshot hooks in save and load, and `scripts/test-progression-restarts.mjs`. If a wave-100 event is wanted, make it a boss fight on the player's own ground.

### 2.16 Colony value (`js/colony-value.js`)

**What it does.** Before each wave it scores the player's army, buildings and treasury (`military + structures + tactical*0.38 + settlementTp*9.5 + tpPerRound*3.8`), divides by a baseline for the wave, clamps the ratio to 0.5 to 2.25, and scales the next wave: enemy count by `ratio^0.38` (waves under 10), `^0.48` (under 25) or `^0.55`, clamped 0.7 to 1.55; health and damage by up to ±10 to 14%; spawn interval by treasury size; extra enemy types by what the player has built (siege towers for walls, casters for academies, berserkers and dark knights for a strong army); up to 3 extra elites at ratio 1.65.

**When the player meets it.** A threat tier chip (Humble to Empire) in the HUD with a tooltip, and a line in the night preview. From wave 1.

**Decision impact.** Intended: growing stronger draws a stronger host. Measured:

- Waves 1 to 11: the ratio was 0.5 in every run (value 41 to about 300, baseline 403 to 760), because the baseline includes an "early pad" of `220 + wave*28` through wave 12 (`js/colony-value.js:91`). The count multiplier is a constant 0.77, then 0.72. For the opening the system is a fixed discount on enemy numbers and reports "Humble" whatever the player does.
- Wave 13: the pad drops from 556 to 205 in one step, so the baseline falls by about 350 between waves 12 and 13. For the knight bot the count multiplier went from 0.72 to 0.91 in one wave. That is a difficulty cliff the player cannot see coming.
- Waves 13 to 30: a cheap army stays near the floor (54 footmen, archers and healers: ratio 0.5 to 0.62). An army of knights does not (ratio 1.23 at wave 27), because unit value is list price times 1.35 for knights. So the layer mostly taxes expensive unit types, at up to +13% enemies in what I saw.

Where it does bite (a rich or heavily built player), it punishes exactly the things this audit is about: banked TP shortens spawn intervals, each TP of income adds 3.8 value, each settlement TP adds 9.5, hamlets count ×1.85. A player who understands it should hold no treasury and build nothing.

**Bugs and dead code.**

- `js/game.js:7459`, `:7663`, `:7822` test the bare global `ColonyValue?.mergePool` and then call through `svc('ColonyValue')`. Both resolve to the same object today (`js/colony-value.js:780`). Two access styles in one expression; a tidy-up only.
- The tier descriptions promise behaviour ("the host may probe with lighter assaults") that the floor makes permanent.

**Overlap.** Army upkeep and "bigger host draws more line-breakers" (both tax army size), difficulty settings, wave scaling in `getWaveConfig`, Advanced Difficulty, enemy factions.

**Verdict.** Cut candidate. A fixed wave curve the player can learn suits a permadeath score game better than a hidden rubber band. If kept, show it and make it a choice (2.18 handicaps).

**Rework proposal (S to cut, M to convert).** Cut: stub `deriveWavePressure` to neutral and remove the HUD chip; files `js/colony-value.js`, `js/game.js:7455-7470`, `:7613-7630`, `:7930-7935`, `js/ui.js:1570-1590`. Convert: keep only the "what you build decides what comes" part as a visible rule in the wave preview ("8 walls: siege towers will come").

### 2.17 Player counter-evolution (`js/player-counter-evolution.js`)

**What it does.** From wave 15, counter doctrines: pay 3 to 9 TP once per wave to weaken one enemy faction for 2 to 3 waves (spawns ×0.92 to ×0.75). From wave 25, expeditions: send 1 to 4 selected soldiers off the map at night; they return after the wave with `6 + 3 per survivor + 4 per enemy stage` TP and 1 to 2 SP, and the target faction is weakened.

**When the player meets it.** Sections in the right-hand panel appear two waves before each unlock (`js/ui.js:850`, `:877-881`). Wave 15 is within reach of an ordinary run; wave 25 is at its edge.

**Decision impact.** The expedition is the one mechanism here that asks a permadeath question: who do you risk? As coded it is mostly a TP machine. Four footmen (12 TP of soldiers) return about 21 TP per wave at a 92% survival rate each, which is three times base income at wave 25.

**Bugs and dead code.**

- Soldiers sent are deleted (`js/game.js:9118-9124`) and the survivors come back as newly spawned units of the same type (`js/player-counter-evolution.js:326-336`). Rank, stars, honor name, kills and waves survived are lost. A veteran sent on expedition returns as a recruit. With permadeath and named veterans this is a serious bug.
- Survival uses `Math.random` (`:328`), outside the seeded generator, so Seed Run mode is not deterministic here.
- Returning units skip the upkeep surcharge and reset `wavesSurvived`, which feeds the Old Guard ribbon.
- Counter doctrine targets are "host factions" from `EnemyFactions`; I did not verify what share of an early wave belongs to a faction, so the real effect of a ×0.92 spawn multiplier at wave 15 is unknown.

**Overlap.** Spy actions (Disrupt Supply Lines: 5 TP for -35% enemy count next wave, stronger and available earlier), kingdom doctrines, spoils.

**Verdict.** Keep expeditions, rework; merge counter doctrines into the Spy panel.

**Rework proposal (M).** Expeditions keep the actual unit records (move them to a `GS.awayUnits` list and put them back), roll per-soldier outcomes with the seeded generator, and show the odds. Open at wave 10. The reward is a choice of TP, a crate of supplies, or a rescued soldier. Files: `js/player-counter-evolution.js:255-370`, `js/game.js:9070-9130` and `:6185-6200`, `js/ui.js:880-950`.

### 2.18 Between-run progression

Six stores persist between runs. They are separate modules with separate localStorage keys.

#### a. Ribbons (`js/siege-loop.js:93-225`)

**What it does.** Sixteen lifetime achievements, each with a small permanent bonus: +1, +2, +3, +2 starting TP; +1 and +1 breach limit; +1 TP per wave; +10% boss damage; -3% and -3% damage taken; crates more often; +1 TP per early call; +1 kill experience; +3% and +3% damage; line-breakers 10% slower. All earned ribbons are always on (`computeFx`, `:423-449`).

**When met.** Main menu, "Ribbons" section; a toast in the run when one is earned. First Blood (clear wave 1) on the first run.

**Decision impact.** None; they accumulate. The first four TP ribbons more than double starting TP on Normal (7 to 15).

**Bugs.** Old Guard gives +1 kill experience, which carries the same hidden strength as Veterans' Due (2.3).

**Verdict.** Keep the ribbons as records; rework the bonuses into unlocks for a loadout (below).

#### b. Crown Legacies (`js/crown-legacies.js`)

**What it does.** Ten passives unlocked by lifetime stats (a win, 3 honor names, wave 30, wave 50, wave 100, 400 kills, 25 waves cleared, 50 kills with the favourite unit, any faction fielded, 8 honor names). The player equips up to 3. Effects: +4 start TP, +4% damage, -3% damage taken, +4% wall protection, +8% build speed, +3% core health, +6% damage for the favourite unit type, +2 start morale, honored troops +3% health, a third heir slot. Also "honor heirs": up to 2 (3) named veterans from past runs start the next run as free units with +5% health.

**When met.** Main menu, inside a collapsed "Legacies & carry-over perks" block. Realm Mason (25 lifetime waves) and Northern Grudge (400 kills) arrive within the first few runs.

**Decision impact.** This is already a pre-run loadout with a slot limit, which is the right shape. The choices are weak: +4% damage and -3% damage taken beat everything else, and +4 TP is best for a short run.

**Bugs.**

- `resetRun()` (`js/crown-legacies.js:107-117`) wipes the persistent data and saves. It is exported. I found no caller, but the name invites one; any future "reset all modules on run start" loop would erase the player's legacies.
- Heirs are matched by `name::type`; two honored soldiers with the same generated name and type collapse into one.
- Start bonuses are granted again at the wave-100 and wave-200 restarts (2.15).

**Verdict.** Keep and make it the single pre-run loadout.

#### c. Crown of Ages (`js/eternal-legacy-tree.js`)

**What it does.** A permanent tree of 27 nodes in five branches, bought with Echo Shards: `3 per win + floor(best wave/20) (max 24) + floor(kills/250) (max 12) + honor names (max 10) + 2 per faction used (max 6)`. Nodes cost 0 to 5 and give +2 start TP, +3 to 6% damage or health for unit groups, wall protection, science cap, start morale, building health.

**When met.** Main menu, same collapsed block, under Crown Legacies. A new player has 1 or 2 shards after reaching wave 20 to 40.

**Decision impact.** Order of purchase only; nothing is exclusive and nothing can be undone. Many nodes are gated at waves 100, 120, 300, 350.

**Bugs.**

- Hint says "50+ archer kills", the test is `>= 30` (`js/eternal-legacy-tree.js:129`, `:135`).
- `getCombinedEffects` calls `load()` (a localStorage read and JSON parse) every time, and it is called from the damage path (`js/game.js:3341`, `:12332`) on every hit. Same pattern in `CrownLegacies.getCombinedEffects` (`js/game.js:3337`, `:12329`). A cost on every attack.
- Wave-scaled ascend multipliers (`getWaveAscendMult`) only start at wave 100.
- `TREE_NODES`, `computeEchoShards`, `isInvested` exported and unused outside.

**Verdict.** Merge into Crown Legacies. Two menu systems that both give "+N% damage forever" is one too many.

#### d. Legacy (`js/legacy.js`)

**What it does.** Lifetime statistics: runs, wins, best wave by difficulty, kills by unit type, honor names. Feeds the unlock tests of b and c and six encyclopedia entries.

**Bugs.**

- `recordKill` and `recordDeploy` call `save()` (a full JSON write to localStorage) on every kill and every deploy (`js/legacy.js:91-101`).
- "Last After-Action" reads `lastRun.playerDeaths`, which is never stored; it falls back to `misses`, so breaches are shown as "losses" (`js/legacy.js:241`).

**Verdict.** Keep as the single stats store; write once per wave.

#### e. MetaProgress (`js/meta-progress.js`)

**What it does.** Booleans for 14 faction unlocks, the Coliseum and the Hellbane; lists of recruited heroes and cheats used. Set by achievements at a wave-100 victory with hidden conditions, or by cheat codes.

**Decision impact.** None for an ordinary player; they will not see a faction without the cheat menu.

**Bugs.** `lifetimeKills` and `lifetimeWaves` are in the stored object and nothing writes them (achievements keep their own counters in `js/achievements.js:17-18`). 14 near-identical `unlockX` and `isXUnlocked` functions could be one keyed function. `reset` is unused.

**Verdict.** Keep the store, simplify, and give factions an ordinary unlock path (2.11).

#### f. Score and best scores (`js/siege-loop.js:1189-1300`)

**What it does.** `(100*waves + 5*kills - 40*breaches - 15*losses) * difficulty * modifiers`, best per difficulty kept.

**Decision impact.** Good: it prices breaches and losses. Losses at -15 each are cheap next to +100 per wave, so trading soldiers for waves is right; for a permadeath game the loss weight could be higher.

**Verdict.** Keep.

#### Rework proposal for between-run progression (L)

One screen before "Begin Defense" called the Muster, replacing Ribbons bonuses, Crown Legacies, Crown of Ages, and Advanced Difficulty's separate menu.

- Three perk slots and any number of handicaps. Perks are unlocked by ribbons (the 16 that exist become the unlock conditions). Handicaps are the existing Advanced Difficulty modifiers and raise the score multiplier, which `activeScoreModifiers` already supports (`js/siege-loop.js:1271`).
- Perks change how a run is played, with a cost. Examples: "Old Guard: start with one named veteran from your honor roll, and 3 fewer starting TP"; "Quartermaster: crates every wave, no War Chest spoils"; "Second Wall: +2 breach limit, enemies 10% more numerous".
- No always-on stat growth. Starting TP is the same for a new and an old player unless a perk is slotted.
- Files: `js/crown-legacies.js` (becomes the loadout module), `js/eternal-legacy-tree.js` (removed; its unlock conditions feed perk unlocks), `js/siege-loop.js` (`computeFx` reads the loadout, ribbons stop granting fx), `js/advanced-difficulty.js`, `js/ui.js:300-340`, `:610-740`, `index.html:1564-1600`, `js/legacy.js`.

---

## 3. The ten highest-value changes, in order

1. **Fix expeditions deleting veterans** (`js/game.js:9118-9124`, `js/player-counter-evolution.js:326-336`). A named Immortal comes home as a recruit. S. Do this whatever else is decided.
2. **Price Tax Levy and Call the Banner** (`js/units.js:824-838`). A 4 TP unit should not nearly double income or hand out research-locked knights at 5 TP. S.
3. **Open all 15 troop types from wave 1 and remove the Research Lab gate on them** (`js/research.js` `STARTER_DEPLOY`, `js/game.js:8704`, `:10588`). The roster's counter system cannot work while 8 types are locked for the length of a normal run, and the wave-4 introduction describes a General the player cannot have. S for the unlock, L for item 4.
4. **Replace research with ten either/or doctrine picks on boss waves** and delete the SP currency, the lab, the branch tree. This gives the run its strategic decisions at fixed, visible moments. L. Files in 2.7 and 2.12.
5. **Remove the wave-100 and wave-200 field resets** (`js/progression-restarts.js`). They contradict one continuous field and permanent losses, and make everything before them disposable. S.
6. **Pay everything at dawn through one ledger and turn the recruit surcharge into wages** (2.1, 2.2). Closes the strike, courier, academy and expedition routes around upkeep and makes army size a standing cost. M.
7. **Rebalance spoils into trade-offs and fix the obvious dominations** (Early Horn against War Levy, War Chest, Veterans' Due through the experience formula at `js/game.js:3283` and `:13340`). M. The experience formula itself belongs to the combat audit.
8. **Cut the eight path-layer files and the ascension tables for waves 150 to 500** (2.13, 2.14). About 4,900 lines, 13 stat layers at unit spawn, seven HUD chips, none of which the player chooses or an ordinary run reaches. S to M of careful deletion; the tests for them go too.
9. **One pre-run Muster screen** with three perks and optional handicaps, replacing the three stacking bonus systems (2.18). L.
10. **Cut or expose colony value** (2.16). Today it is a constant ×0.77 on enemy count for 11 waves, a cliff at wave 13, and after that a hidden penalty on expensive troops, saving and building. S to cut.

Smaller fixes worth doing on the way, each S:

- Double `hpMult` at `js/game.js:4013` and `:4054`.
- Tonic collection gate at `js/game.js:13753`.
- Hamlet income text against code (5, not 1).
- Economy-site cap checked before the TP is spent (`js/content-expansion.js:1870`).
- Refund by health (`js/game-core.js:830`).
- Doctrine text "minutes" against 6-second timers (`js/units.js:429-460`).
- `Legacy.recordKill` saving on every kill (`js/legacy.js:96-101`); `getCombinedEffects` loading localStorage on every hit (`js/crown-legacies.js`, `js/eternal-legacy-tree.js:551`).
- Operative skill purchases persisting while points do not (`js/operative-skill-trees.js:302-327`).
- "Last After-Action" showing breaches as losses (`js/legacy.js:241`).
- Royal Muster paying back its own cost (`js/units.js:433-441`).

## 4. New ideas that fit one field with permadeath

- **Either/or building upgrades.** Each starter building takes one of two upgrades, once (2.5). Cheap to build, easy to read, and it makes two players' fields look different.
- **Income at dawn with a ledger line.** "+7 crown, +2 toll post, +6 levy, -4 wages = 11". One number to plan around, and every economy effect is visible in one place.
- **Wages, not surcharges.** Soldiers over the free number cost TP every dawn. Losing men lowers the bill, which softens a bad wave; hoarding veterans has a price.
- **Ground-based income.** A Toll Post or forward camp pays only if no enemy reached it last wave. Income then depends on where the line stands, which is the game's subject.
- **The horn as a bet.** Calling the wave early pays more the earlier it is called, and part of the next wave's host comes with this one.
- **Pre-run Muster.** Three perks with costs, any number of handicaps with score multipliers (2.18).
- **Doctrine picks on boss waves.** Two exclusive options every 10 waves (2.7).
- **Honours for veterans.** After a boss, give one living veteran a role that dies with him (2.14).
- **Training Ground.** Post a veteran off the line for a wave to raise a recruit with a rank (2.8).
- **Mercenary Camp.** Three random operatives offered each night from wave 10, one hire per night (2.11). Puts the 104 operatives into ordinary runs.
- **A will.** When a named veteran dies, the player chooses one thing he leaves: his rank to a recruit of his type, a morale shock avoided, or TP from the Crown. A decision at the moment permadeath hurts most.
- **Salvage choice after each wave.** The field's dead leave salvage; the player picks one of TP, a repair of all buildings, or a heal. Uses the night that already exists and replaces random crates' share of income.

## 5. Appendix

### 5.1 Bug and dead-code list by file

| File:line                                                                                | Finding                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/game.js:9118-9124` + `js/player-counter-evolution.js:326-336`                        | Expedition deletes the soldiers sent and returns new units; rank, name and record lost                                                                  |
| `js/player-counter-evolution.js:328`                                                     | `Math.random` for survival; breaks Seed Run determinism                                                                                                 |
| `js/units.js:827`                                                                        | Tax Levy costs 0 TP for +6 TP per wave                                                                                                                  |
| `js/units.js:828` + `js/game.js:9352-9355`                                               | Call the Banner spawns a knight with no research check and no upkeep                                                                                    |
| `js/game.js:4013`, `:4054`                                                               | Branch `hpMult` applied twice per spawn                                                                                                                 |
| `js/game.js:13753`                                                                       | Tonic pickup requires a MetaProgress unlock even when tonics were researched                                                                            |
| `js/game.js:7005-7008`                                                                   | Paid income includes `tpIncomeMult`; HUD figure does not                                                                                                |
| `js/tech-tree-branches.js:379`, `:390`, `:144`                                           | `tpBonus`, `academyBonus`, `honorPlate` never read                                                                                                      |
| `js/tech-tree-branches.js` (fleet effects)                                               | No "fleet" consumer in `game.js`, `units.js`, `siege-loop.js`, `ui.js`                                                                                  |
| `js/tech-tree-branches.js:478`                                                           | `scienceEarned` always 0 because `recordScience` is never called                                                                                        |
| `js/foundational-medieval-layer.js:64-72`                                                | Six research ids that do not exist                                                                                                                      |
| `js/foundational-medieval-layer.js:185`                                                  | `recordScience` exported, never called                                                                                                                  |
| `js/martial-`, `arcane-`, `tech-`, `mythic-path-evolution.js`, `hybrid-power-fantasy.js` | `getTacticalMods` and related getters, `recordAction`, `renderPanelHtml` never called from outside                                                      |
| `js/eternal-path-framework.js:393`                                                       | `getFrameworkMods` never called                                                                                                                         |
| `js/ascension-system.js:319`, `:419`                                                     | Building ascension has no caller or button                                                                                                              |
| `js/progression-restarts.js:244-246`                                                     | `if` block with only a comment in it                                                                                                                    |
| `js/game.js:3573-3600`                                                                   | Crown start bonuses and heirs granted again at each era restart                                                                                         |
| `js/research.js:645`                                                                     | Empty `tick()`                                                                                                                                          |
| `js/research.js:602-609`                                                                 | Wave-100 bootstrap grants all core research free                                                                                                        |
| `js/content-expansion.js:1870-1882`                                                      | Seventh economy site takes TP, then reports it pays nothing                                                                                             |
| `js/content-expansion.js:205-330`                                                        | Building definitions duplicated outside `data/buildings.json`                                                                                           |
| `data/buildings.json` hamlet..metropolis, `js/units.js:21`                               | Hamlet pays 5 per wave; README and lore say 1                                                                                                           |
| `data/buildings.json` `settlementWarnBefore: 0`                                          | Warning in `js/game.js:10322` can never fire                                                                                                            |
| `js/game-core.js:830`                                                                    | Refund ignores building health                                                                                                                          |
| `js/units.js:429-460`                                                                    | Doctrine text says minutes; timers are 6 to 7 seconds                                                                                                   |
| `js/units.js:433-441`                                                                    | Royal Muster costs 5 TP and grants 5 TP                                                                                                                 |
| `js/siege-loop.js:814`                                                                   | Auto-claim loop has no guard if a claim fails                                                                                                           |
| `js/siege-loop.js:270-306`                                                               | Introduction has no step for builders, buildings or research; wave-4 step describes a research-locked General                                           |
| `js/operative-skill-trees.js:302-327`                                                    | Purchases persist across runs, points do not                                                                                                            |
| `js/eternal-legacy-tree.js:129`, `:135`                                                  | Hint 50 kills, test 30                                                                                                                                  |
| `js/eternal-legacy-tree.js:551`, `js/crown-legacies.js` `getCombinedEffects`             | localStorage read on every damage calculation (`js/game.js:3337-3341`, `:12329-12332`)                                                                  |
| `js/crown-legacies.js:107-117`                                                           | Exported `resetRun` erases persistent legacies                                                                                                          |
| `js/legacy.js:91-101`                                                                    | localStorage write on every kill and deploy                                                                                                             |
| `js/legacy.js:241`                                                                       | `playerDeaths` never stored; breaches shown as losses                                                                                                   |
| `js/meta-progress.js`                                                                    | `lifetimeKills`, `lifetimeWaves` stored, no writer found                                                                                                |
| `js/colony-value.js:91`                                                                  | Early pad keeps the strength ratio at the 0.5 floor through wave 11 (measured), then drops by about 350 in one step at wave 13                          |
| `README.md`                                                                              | Lists Watchtower, Spike Trap, Castle and eight troop types without their research gates; Coliseum needs "40 Hamlets, 10 Guilds" against 2 and 1 in data |

### 5.2 Wave gates in my area, against where runs end

| Wave           | What opens                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1              | TP, deploy (7 of 15 troops), 5 buildings, lab, Courier messages, Crown Legacies and ribbons effects                    |
| 3-12           | Research nodes for knights, traps, bard, castle, General, scout and pikeman, ballista (each also needs the lab and SP) |
| 5, 10, 15, ... | Spoils                                                                                                                 |
| 15             | Counter doctrines; Prospecting research                                                                                |
| 20             | Academy Charter research                                                                                               |
| 25             | Expeditions                                                                                                            |
| about 13-30    | Where the bots are after 20,000 to 150,000 ticks on Normal                                                             |
| 40-100         | Settlement research ladder                                                                                             |
| 50             | Branch tech root lock                                                                                                  |
| 100            | Field reset 1, academy-only deployment, loadouts                                                                       |
| 150            | Ascension, thematic synergies, kingdom stage of the path files, foundational crystallization                           |
| 200            | Field reset 2                                                                                                          |
| 400, 500       | Galactic stages, hybrid fantasies, apex branch nodes                                                                   |

### 5.3 Sim files

Instrumented bots and raw output are in `/tmp/econsim/` (`sim.mjs`, `sim2.mjs`, `*.json`). They are throwaway and not part of the repo.
