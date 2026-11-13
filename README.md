# Myth and Blood — Game Manual

**Myth and Blood** is a browser-based fantasy tactical defense game. You command a growing army, spend Tactical Points (TP) on troops and structures, and hold the line against endless waves of enemies. Survive long enough and the campaign shifts from lane defense into territory control, academy training, settlement economy, crossover operatives, and late-game RTS-scale wars.

Everything is drawn with procedural pixel sprites — units animate in combat, strikes have battlefield FX, and buildings show HP bars when damaged.

---

## Quick Start

| Method                    | How                                                          |
| ------------------------- | ------------------------------------------------------------ |
| **Desktop (recommended)** | Double-click `Play Myth and Blood.bat`                       |
| **Browser**               | Open `index.html` in any modern browser                      |
| **Install app**           | Run `Install Desktop App.bat`, then launch from the shortcut |

No server is required. Sound is procedural (generated in the browser) — click **Begin Defense** or anywhere on the menu to unlock audio.

### Game modes (main menu)

| Mode                 | Summary                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| **Campaign**         | Standard endless run with chosen difficulty and optional advanced modifiers |
| **Survival Endless** | Score-focused; leaderboard ranks wave × difficulty% + kills                 |
| **Roguelike**        | Random advanced modifiers each run                                          |
| **Warband**          | Small squad: soldiers cost double, and each is far tougher and hits harder  |
| **Timed Blitz**      | Shorter night prep — race the clock                                         |
| **Seed Run**         | Deterministic spawns from a shared seed                                     |
| **Academy Era**      | Jump to wave 100 / 105 / 200 — skip the early grind                         |

---

## Creative Mode

A **practice sandbox** for playtesting builds, waves, and unit upgrades — no achievements and no game over.

| How to start | Main menu → **CREATIVE MODE** (uses your selected difficulty) |
| ------------ | ------------------------------------------------------------- |
| Lab panel    | **P** or the 🧪 button in the top bar                         |

**Defaults:** 9,999 TP · free deploy/build/strikes · instant building · all rosters unlocked · manual day/night · miss limit disabled.

| Lab section       | What you can do                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **Sandbox rules** | Toggle free TP, no game over, manual waves, instant build, unlock-all, academy-era troop deploy |
| **Wave & cycle**  | Set wave number, add TP, force day/night, start or clear waves                                  |
| **Spawn tools**   | Arm an enemy or enemy building type, click the map to place; clear all foes or enemy structures |
| **Selected unit** | Click any unit — rank up, max stars, heal, kill, or promote a Footman to General                |

Use normal deploy/build controls alongside the lab. Disarm spawn tools to interact normally. Creative runs do not award achievements.

---

## Objective

- **Win condition:** Clear **wave 100** to win the campaign. That awards the victory achievements, faction trials and legacy unlocks. The siege itself never ends, so the run continues afterwards for score.
- **Lose condition:** Enemies break through your line too many times, or you have no troops and no training halls left. Each enemy that gets through counts as a **breach**. Pass the breach limit and the realm falls.

Clear every wave to earn TP, expand territory, unlock new systems, and push into the Academy and RTS eras.

---

## Core Loop

1. **Night prep** — deploy troops, build, train academies, send spy/courier orders, and position defenses. The top of the screen shows what the next wave is likely to bring, and red chevrons on the edge of the field show where it will come from. Press **D** to begin the day when ready; sounding the horn early pays **+1 TP for every 10 seconds left** (up to +5).
2. **Day combat** — waves spawn from unlocked flanks. Troops auto-engage in Hunt mode and walk back to their posts when the fight is over, or click to move them manually.
3. **Fight** — cast strikes, manage morale, retreat wounded troops to med tents.
4. **Clear the wave** — all enemies defeated.
5. **Earn TP** at round end (+7 base, scaling with wave, settlements, and difficulty).
6. **Every 5 waves, claim spoils** — choose one of three rewards that last the rest of the run.
7. **Repeat** with tougher, more numerous foes.

---

## Tactical Points (TP)

- Awarded once per cleared wave.
- Base income: **+7 TP**, plus scaling from wave number, difficulty, and late-game bonuses.
- **Uncapped storage** — hoard as much as you need.
- Early economy sites (max **6** quarries + trade posts combined):
  - **Quarry (14 TP):** +1 TP/round
  - **Trade Outpost (16 TP):** +1 TP/round and a small morale aura
- Settlement bonuses (late game):
  - **Hamlet:** +1 TP/round each (when complete).
  - **Merchant Guild:** +1 TP/round each, if built within a hamlet’s aura.
  - **Fortress Upgrade** on a completed hamlet: +HP, cover, and +1 TP/round.

Spend TP on troops, buildings, strikes, spy actions, and courier messages.

---

## Controls

### Map navigation

| Input        | Action                           |
| ------------ | -------------------------------- |
| Click + drag | Pan the map                      |
| Mouse wheel  | Zoom in/out (toward cursor)      |
| Arrow keys   | Pan the map (works while paused) |

### Deployment

| Key | Unit    |
| --- | ------- |
| 1   | Footman |
| 2   | Archer  |
| 3   | Mage    |
| 4   | Cavalry |
| 5   | Healer  |
| 6   | Knight  |
| 7   | Builder |
| 8   | Sapper  |
| 9   | Courier |
| 0   | General |

Crossbowman, Scout, Bard, Ballista, and Pikeman are on the deploy panel (no dedicated hotkeys).

### Posts

Every soldier has a **post**: the spot where you deployed him, or the place you last ordered him to. In Hunt mode he leaves it to fight, helps a comrade who is fighting close by, and walks back about two seconds after the last enemy is gone, so the line you drew keeps its shape from wave to wave.

| Input                  | Action                                                         |
| ---------------------- | -------------------------------------------------------------- |
| Click the map          | Move the selected soldiers; the destination is their new post  |
| **B** (with selection) | Back to posts now, ignoring everything on the way              |
| **H**                  | Hunt off: everyone stands at his post and only fights in reach |

A selected soldier's post is drawn as a small bone-coloured diamond, with a dashed line to him while he is away from it. Soldiers who are retreating to a medical tent, garrisoned, routing or under a manual order are not called back, and the General keeps his own counsel. With nothing selected, **B** is still the Trade Outpost build key.

### Buildings

| Key | Structure              |
| --- | ---------------------- |
| O   | Outpost                |
| L   | Wall                   |
| C   | Castle (full compound) |
| N   | Medical Tent           |
| M   | Mess Hall              |
| Y   | Watchtower             |
| B   | Trade Outpost          |
| G   | Hamlet                 |
| U   | Merchant Guild         |

Spike Trap, Quarry, Fortress Upgrade, and Academies are panel-only.

### Strikes

| Key | Ability          |
| --- | ---------------- |
| Q   | Fireball Barrage |
| W   | Lightning Strike |
| E   | Healing Rain     |
| R   | Reinforcements   |
| T   | Battle Rally     |
| F   | Meteor Shower    |
| J   | Frost Nova       |
| K   | Scout Flare      |
| X   | Fortify Zone     |

Select a strike, then click the map. A targeting ring and icon follow your cursor.

### Structure tools

| Button / key                 | Action                                            |
| ---------------------------- | ------------------------------------------------- |
| **DEMOLISH**                 | Click a building to remove it (partial TP refund) |
| **MOVE**                     | Relocate a completed structure                    |
| **ROTATE**                   | Reposition a wall segment                         |
| **R** (while placing a wall) | Cycle wall facing before placement                |

### General

| Key          | Action                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D            | Begin day phase (during night prep)                                                                                                          |
| H            | Toggle Hunt mode (also the HUNT button in the top bar)                                                                                       |
| ]            | Cycle game speed, 1× to 10× (also the SPEED button in the top bar)                                                                           |
| Space        | Pause                                                                                                                                        |
| Esc          | Cancel selection / close panels                                                                                                              |
| C / G / F    | With units selected: clear selection / reform formation / focus camera. With nothing selected they are the Castle, Hamlet and Meteor hotkeys |
| Alt+1–5      | Formation presets for the selected group                                                                                                     |
| V            | Mute/unmute sound                                                                                                                            |
| A            | Achievements                                                                                                                                 |
| I            | Encyclopedia                                                                                                                                 |
| ` (backtick) | Cheat menu                                                                                                                                   |
| P            | Creative Lab panel (Creative Mode only)                                                                                                      |

Click the map to deploy, build, cast strikes, or move selected units. Hover UI buttons for tooltips.

---

## Troops

| Unit     | Cost | Role                                                                                |
| -------- | ---- | ----------------------------------------------------------------------------------- |
| Footman  | 3    | Cheap melee; garrisons walls when General commands Keep                             |
| Archer   | 4    | Ranged DPS; strong in outposts                                                      |
| Crossbow | 5    | Slow, armour-piercing ranged; unlocks with Iron Weapons                             |
| Mage     | 6    | Arcane bolts with splash damage                                                     |
| Cavalry  | 7    | Fast melee; charge bonus                                                            |
| Healer   | 5    | Heals allies in range (including other healers); retreats to med tents when wounded |
| Knight   | 8    | Armored melee; damage resistant                                                     |
| Sapper   | 5    | Bonus damage vs walls and siege                                                     |
| Scout    | 4    | Fast skirmisher; reveals stealth                                                    |
| Bard     | 5    | Morale aura support                                                                 |
| Ballista | 6    | Long-range siege; bonus vs flying foes                                              |
| Pikeman  | 4    | Anti-cavalry and anti-air line holder                                               |
| General  | 12   | Global enemy target; command aura from Keep; auto-rallies demoralized troops        |
| Builder  | 5    | Constructs buildings (2 projects max); auto-repair toggle                           |
| Courier  | 4    | Sends royal messages once per wave (twice at 3 gold stars — Twin Dispatch)          |

### Roles, traits and weaknesses

Every soldier has one job, one signature trait and one weakness. The unit panel shows all three.

| Troop    | Cost | Role           | Trait                                                                                                   | Weakness                                      |
| -------- | ---- | -------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Footman  | 3    | Line holder    | Shield Wall — takes 12% less damage for each footman or pikeman beside him, up to 36%.                  | Kills slowly.                                 |
| Archer   | 4    | Ranged damage  | Volley — 20% more damage to targets far away.                                                           | Deals 40% less when an enemy is in his face.  |
| Crossbow | 5    | Armour piercer | Heavy Quarrel — 40% more damage to armoured enemies and siege engines; reloads slowly.                  | Slow rate of fire; swarms overrun him.        |
| Mage     | 6    | Area damage    | Arcane Burst — every fourth attack also hits everything near the target.                                | The most fragile soldier on the field.        |
| Cavalry  | 7    | Runner hunter  | Run Down — 60% more damage to line-breakers and routing enemies.                                        | Pikes and trolls stop a charge cold.          |
| Healer   | 5    | Medic          | Field Dressing — soldiers standing near a healer slowly recover on their own.                           | Cannot fight.                                 |
| Builder  | 5    | Engineer       | Fieldworks — soldiers near a builder take 10% less damage.                                              | Barely armed.                                 |
| Courier  | 4    | Messenger      | Fleet — dodges a third of arrows and bolts.                                                             | Unarmed.                                      |
| Scout    | 4    | Spotter        | Spotter — archers, mages and ballistae near a scout deal 12% more. Scouts hit line-breakers 60% harder. | Light armour; loses a straight fight.         |
| Bard     | 5    | Morale         | Marching Song — soldiers in earshot steadily regain morale.                                             | Weak in a fight.                              |
| Ballista | 6    | Giant killer   | Heavy Bolt — 35% more damage to bosses, monsters and elites.                                            | Half damage at close range, and slow to move. |
| Pikeman  | 4    | Anti-cavalry   | Set Pikes — riders and beasts that strike a pikeman take 40% of the blow back.                          | Arrows and magic.                             |
| Sapper   | 5    | Demolition     | Blast — every hit splashes nearby enemies. Double damage to siege towers.                               | Fragile and short-ranged.                     |
| Knight   | 8    | Heavy infantry | Cleave — each swing also wounds a second enemy beside the target.                                       | Expensive, and mages cut through the armour.  |
| General  | 12   | Commander      | Orders — War Cry and Hold the Line. His aura strengthens everyone near him.                             | Every enemy on the field wants him dead.      |

**Operatives and champions** each have their own profile: all 104 operatives and 29 champions carry an individual role, trait and weakness on top of their named ability, written to fit their stats and their faction. Within a faction no two play the same way. The trait text gives the real numbers, for example "+40% damage to targets below 30% health" or "takes on 20% of the damage dealt to allies within 50". Read them in the in-game encyclopedia under Roles & Counters, where they are listed faction by faction, or select a unit to see its profile in the unit panel. The profiles are data, in `data/roster-profiles.json`.

The **Crossbowman** hits hard (44 damage against an archer's 28) but takes 1.8 times as long between shots, so he is wasted on goblins and earns his pay against trolls, dark knights, war chiefs, shieldbearers, siege towers and the Iron Colossus. He is researched with Iron Weapons, alongside the Sapper and the Knight.

**Hunt mode** (on by default): combat troops pathfind toward enemies, then return to their posts. Click the map to override with manual orders.

---

## Buildings

### Defensive

- **Outpost (4 TP)** — Cover, one garrison slot, extends archer range.
- **Wall (6 TP)** — Blocks movement; 2 footman slots per wall when General is in Keep. Rotate facing before placing.
- **Castle (50 TP)** — Full compound: 4 walls, 4 outposts, central Keep, med tent, mess hall.
- **Watchtower (5 TP)** — Vision radius; reveals stealth; enemy accuracy penalty in range.
- **Spike Trap (3 TP)** — Hidden damage on first enemy crossing each cooldown.

### Support

- **Medical Tent (5 TP)** — Wounded allies below 38% HP retreat here to heal. Healers use tents too.
- **Mess Hall (5 TP)** — Morale aura for nearby troops.

### Economy (early)

- **Quarry (14 TP, 2 Builders)** — +1 TP/round. Counts toward the 6-site cap.
- **Trade Outpost (16 TP, 2 Builders)** — +1 TP/round and morale aura. Same cap.

### Academies (Wave 100+)

Each academy trains **1 free unit per round** when built. TP deployment of troops ends in the Academy Era — you must train through academies.

**Mentor requirement:** You need a **max-rank veteran** (Immortal, tier 6) of that unit type **on the field** before you can found an academy. Hover an academy button for the exact block reason.

| Academy                             | Cost   |
| ----------------------------------- | ------ |
| Footman / Scout / Courier / Pikeman | 40 TP  |
| Archer / Sapper / Bard              | 45 TP  |
| Healer / Builder                    | 48 TP  |
| Cavalry                             | 60 TP  |
| Knight                              | 65 TP  |
| Mage / Ballista                     | 55 TP  |
| General                             | 100 TP |

Special rules:

- **Healer Academy** — build only on waves divisible by 5.
- **General Academy** — waves divisible by 10; requires a promotable veteran Footman and no General on field.
- **Builder / Courier Academy** — blocked if two or more of that specialist are on field (one max-level mentor may still train).

### Settlements (RTS Era, Wave 100+)

| Structure        | Cost   | Requirements                    | Effect                                 |
| ---------------- | ------ | ------------------------------- | -------------------------------------- |
| Hamlet           | 100 TP | 5 Builders; builds over 5 waves | +1 TP/round                            |
| Merchant Guild   | 150 TP | 5 Builders                      | +1 TP/round per guild in hamlet aura   |
| Fortress Upgrade | 50 TP  | Completed hamlet nearby         | +HP, cover, +1 TP/round on that hamlet |

All settlements have **large footprints**, **HP bars**, and are **siege targets**. Enemies will attack player and enemy structures. Recommended after wave 100 unless you are confident in your defenses.

---

## General & Command

- Enemies **prioritize** your General globally.
- Station him in the castle **Keep** to grow a **command aura** (buffs nearby allies).
- With a General in the Keep, **footmen auto-fill wall slots** inside the castle compound.
- **Demoralized troops** (routing before wave 100, giving up after wave 100) are detected globally — the General paths to them for a pep talk.
- On promotion from Footman, honor names are kept; combat stars reset and only improve aura.
- **Orders** (buttons at the top of the screen while a General is on the field):
  - **War Cry** (`[`) — soldiers near the General strike 20% harder for 8 seconds and regain morale. 45-second cooldown.
  - **Hold the Line** (`]`) — soldiers near the General take 40% less damage for 7 seconds. 60-second cooldown.

---

## Strikes, Spy & Courier

All nine strikes have **animated icons** on the HUD and **battlefield FX** when cast.

### Core strikes (fixed cost)

| Strike         | Cost  | Effect                                              |
| -------------- | ----- | --------------------------------------------------- |
| Fireball       | 9 TP  | AoE fire damage                                     |
| Lightning      | 6 TP  | Focused storm damage (smaller radius)               |
| Heal Rain      | 6 TP  | Heals allies in a large radius                      |
| Reinforcements | 12 TP | Spawns 2 footmen + 1 archer on the battlefield      |
| Battle Rally   | 6 TP  | Army-wide morale boost, +12% damage, clears routing |

### Advanced strikes (cost drops after wave 100; Meteor also drops at 200)

| Strike        | Base cost | Effect                              |
| ------------- | --------- | ----------------------------------- |
| Meteor Shower | 14 TP     | Dual-impact fire devastation        |
| Frost Nova    | 8 TP      | Damage + slow in a wide radius      |
| Scout Flare   | 4 TP      | Reveals burrowed/hidden enemies     |
| Fortify Zone  | 7 TP      | Allies in zone take 25% less damage |

### Spy Network (one action per wave)

Steal TP, disrupt spawns, assassinate elites, scout next wave, poison caches, sabotage siege, deep infiltration, bribe informant — plus **Muster Deserters**, **Raid War Chest**, **Forge Maps**, and **Tunnel Network**.

### Courier Messages (one per wave; two with Twin Dispatch at 3 gold stars; Courier must be on field)

Reinforcements, Royal Decree (+morale), Tax Levy (+TP), Call Banner (knight), Supply Train (heal all), Offer Truce, Medical Evac — plus **Royal Herald**, **Emergency Muster**, and **Open War Chest**.

One tonic reduces spy and courier costs by 1 TP.

---

## Morale & Routing

- Troops **witness fallen allies** (line of sight) and lose morale.
- Too many casualties cause **routing** — enemies flee off-map; before wave 100 allies may desert; after wave 100 they stop fighting until rallied.
- **Battle Rally**, courier decrees, bards, and the General’s pep talks restore the line.

---

## Waves, Territory & Eras

### Wave milestones

| Wave      | Event                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Every 5   | **Horde wave** — fast swarms (goblins, rats, orcs); weaker but numerous  |
| Every 10  | Map expands (+90 wide, +110 deep); **named boss** leads (replaces horde) |
| Every 15  | Horde wave includes embedded siege tower + sappers                       |
| Every 25  | New attack flank unlocked (East → West → South)                          |
| **100**   | **Academy Era** — no TP troop deploy; academies and settlements          |
| **200**   | **Enemy RTS** — map widens; enemies build mirror settlements             |
| **1001+** | **Hellscape** — even endgame heroes struggle                             |

### Era resets

At waves **100** and **200** the battlefield is redrawn: your field is cleared and you start the new era with a prebuilt base, a fresh army, your veterans and part of your TP carried over. Legacies, research and unlocks carry through. Jump-in modes and Creative skip the resets.

### Flank variety

Once multiple flanks are unlocked, each wave rolls a **random non-empty subset** — you will not face every direction every wave. Spy intel shows possible flanks.

### Loadouts (Wave 100+)

Choose a passive army bonus: **Balanced**, **Shield Wall**, **Arrow Storm**, **Siege Crew**, or **Royal Court**.

### Horde waves (every 5 waves — except boss waves)

Swarm assaults spawn **~30% more foes** on a **faster timer**, mostly goblins, plague rats, and orcs at **slightly reduced HP/damage** — pressure without unfair spikes. Rotating flavors (Goblin Tide, Orc Pack, Warg Run, etc.) announce at dawn. Hunt mode and AoE strikes shine here. After wave 40, a single light elite may appear in the mob.

### Named bosses (every 10 waves)

Each boss wave fields one unique warlord with a title, tagline, crown sprite, and top-bar HP tracker. The roster cycles every 100 waves and scales stronger on return visits.

| Wave | Boss                 | Title                        |
| ---- | -------------------- | ---------------------------- |
| 10   | Gorath the Breaker   | Warlord of the Ash March     |
| 20   | Morwen the Pale      | Queen of the Bone Court      |
| 30   | Thokk the Mountain   | Walker of Shattered Gates    |
| 40   | Grimm Ashborne       | Knight of the Cinder Oath    |
| 50   | Vexis the Hollow     | Shadow That Hungers          |
| 60   | Iron Lord Karg       | Forge-Walker                 |
| 70   | Sylvara Wyrm-Mother  | Matriarch of the Burning Sky |
| 80   | The Rotfather        | Pustulent Patriarch          |
| 90   | Dread Marshal Volk   | Hammer of the North Host     |
| 100  | Malachar the Eternal | Voice of the Endless Siege   |

Wave 110 brings Gorath back — tougher. Spy **Assassinate Captain** removes elites but not the named boss.

### Wave events

From the first few waves: Night Raid (every 4th wave, wargs and goblins join the host) and Village Tithe (+3 TP). Later: Blood Moon (flying predators), Supply Caravan (+TP), Siege Push (extra towers), and more.

### Line-breakers and the breach limit

From wave 3, some enemies carry a **red pennant**. These are line-breakers: they ignore your troops and run for your line, faster than the rest of the host but with less health. One that reaches the bottom of the field (or your rally point, if it came from a flank) is a **breach**.

- The breach counter sits at the top of the screen. The limit is 14 / 10 / 8 / 6 by difficulty.
- Each breach shakes the morale of every soldier. Pass the limit and the realm falls.
- Enemies also go for the line when they have **nobody left to fight**, and when a **standoff** drags on for about a minute with no blood drawn.
- Depth beats a single row: archers behind the line catch what runs past the front.

### Spoils of war

After every fifth wave you are offered three rewards and keep one for the rest of the run: more damage, less damage taken, extra TP per wave, a higher breach limit, night healing, and others. Each can be taken up to three times. The siege does not pause for the choice; spoils left unclaimed at dawn are picked for you.

### Army upkeep

A big host is hard to feed. Past 14 soldiers on the field, every new recruit costs 7% more per soldier over that mark, so around the 28th soldier the price has doubled. The surcharge shows at the top left of the screen. A bigger host also draws more line-breakers.

### How a wave arrives

Enemies come in squads, a handful together with a lull between, and the squads grow as the siege goes on. A squad forms up on its side of the field first. Your troops in Hunt mode hold their ground until it crosses into your half, opens fire, or gets close, so the fight happens in the open field and your line keeps its shape. You can still order an attack by hand at any time. Flying enemies ignore terrain and go straight for their target.

At night the next wave's flanks are already decided. Each edge it will use shows pulsing red chevrons pointing into the field, a rough head count for that side, the two most common enemy types, and a skull if a warlord is coming. Before wave 25 that is always the north; later, check all four edges before you place your line.

### Reading the battlefield

Traits are drawn on the field so you can see why a fight is going the way it is:

- **Rings on the ground** show aura reach: red dashes for a war banner, green dashes for a shaman's ward, pale blue for a wraith's dirge, gold dashes for a bard's song.
- **Marks over a unit's head:** purple diamond (hexed, deals less damage), flame (burning), green drop (poisoned), red flag (strengthened by a banner), green ring (warded).
- **White chevrons** in front of a footman or pikeman show how many neighbours are bracing him; they flash when a blow is turned.
- **A red pulse** under a boss means it is enraged. Orders from the General send a ring across the field.
- **Deaths** show what killed: bodies are blown apart by blasts, cut in two by heavy blows, charred by fire, or left feathered with arrows. Fire and blasts leave scorch marks; the rest leave blood.
- With one breach left before defeat, the edges of the screen stay red.

The set-piece sounds (breach horn, muster drums, warlord's roar, the General's orders, spoils, wave clear, defeat, the wraith's wail and the night drone) are orchestral recordings made in MuseScore Studio with Muse Sounds; they live in `assets/sfx/` and `tools/sfx/` explains how to rebuild them. The music is recorded the same way: one loop for the menus, one for the battle and one that takes over while a warlord is on the field, plus short cues for nightfall, a runner breaking for the line, a horde warning, a fallen veteran, a new ribbon and victory. Combat sounds are synthesized in code, and every recording has a synthesized fallback.

Sound follows the same events: a horn on a breach, drums as a wave forms up, a roar for a warlord, a shriek when a line-breaker joins the host, and wind and crows by day with a low drone at night.

When the run ends, the game-over screen shows the siege in brief: breaches, line-breakers cut down, spoils taken, your deadliest soldier, the veterans who fell and any ribbons earned.

### Supply crates

From wave 2, crates land on the field during the day. Walk any soldier onto one to open it: TP, bandages for nearby troops, or rations that lift morale. Some are bait and spring a goblin ambush.

### Counters and rear attacks

| Troop                  | Strong against                            | Weak against |
| ---------------------- | ----------------------------------------- | ------------ |
| Pikeman                | Riders (wargs, dark knights)              |              |
| Cavalry, Knight, Scout | Archers and casters                       |              |
| Archer                 | Goblins and rats                          | Armour       |
| Mage, Ballista, Sapper | Armour (trolls, dark knights, war chiefs) |              |
| Crossbowman            | Armour and siege engines                  | Swarms       |
| Footman                | Berserkers                                |              |

Enemy riders hit archers, mages, healers and bards harder, and pikemen take less from them. Any attack that lands **from behind** does 25% more damage and shakes the target's morale; this applies to both sides.

### Veterans

The unit panel shows each soldier's kills and waves survived. When a veteran falls, the log names them and their record. At the wave 100 and 200 era resets, your General and up to ten of your most experienced soldiers march into the new era with you.

---

## Your first sieges

On your first runs the game introduces one system per early wave with a single line at the bottom of the screen, and keeps the rest of the HUD quiet until then:

| Wave | Introduced                                                  |
| ---- | ----------------------------------------------------------- |
| 1    | Deploying troops, Hunt mode and posts                       |
| 2    | Supply crates, and calling the wave early with **D**        |
| 3    | Line-breakers and the breach counter                        |
| 4    | The General's orders (War Cry, Hold the Line)               |
| 5    | Spoils of war                                               |
| 6    | Spells and strikes (the Spells tab is dimmed until then)    |
| 8    | Spy and courier (the right-hand panel is dimmed until then) |

Nothing is locked: a dimmed tab still works if you click it. Once you have reached wave 10 the introduction never appears again, and **Skip the introduction** in the pause menu turns it off at once. Creative mode always shows everything.

## Ribbons

Ribbons are earned across all your runs and listed on the main menu. There are 16, and each gives a small permanent bonus: starting TP, a higher breach limit, a little damage, slower line-breakers. Examples: **Ten Dawns** (clear wave 10, +2 starting TP), **Unbroken Line** (10 waves in one run without a breach, +1 breach limit), **Gatekeeper** (cut down 100 line-breakers, they move 10% slower). Creative mode does not earn or use them.

## Score

The game-over screen scores the run:

- **+100** for every wave cleared and **+5** for every kill
- **−40** for every breach conceded and **−15** for every soldier lost (never below zero)
- multiplied by the difficulty: Baby ×0.5, Normal ×1, Chad ×1.5, Hellbane ×2
- multiplied again by each active Advanced Difficulty modifier, by its own percentage: a modifier that adds 18% difficulty multiplies by 1.18, one that removes 12% by 0.88

Your best score on each difficulty is kept and listed under **Best scores** on the main menu, next to the ribbons. Creative runs and runs abandoned from the pause menu are not scored.

---

## Star System & Honor Names

### Combat troops

- Earn **bronze stars** from kills.
- 3 bronze → 1 silver → 1 gold → **veteran upgrade** (+HP, damage, speed) up to **Immortal (tier 6)**.

### Specialists (Healer, Builder, Courier)

- Earn one star step per wave when they **work** (heal, build, dispatch).

### Honor names

At **3 gold stars**, the Crown grants a name (e.g. _Syr Gwyn_) plus a veteran upgrade. Generals keep their name on promotion; stars reset and only boost command aura.

---

## Enemies

Standard foes include goblins, orcs, archers, mages, warg riders, harpies, burrowers, plague rats, and more. **Elite enemies glow purple** — dark knights, trolls, war chiefs, necromancers, berserkers, assassins, shamans, siege towers, bone summoners, sky drakes, and goblin engineers.

**Big monsters** (red elite rings, larger sprites, spawn fanfare) appear from mid-late waves:

| Monster       | Wave | Threat                                      |
| ------------- | ---- | ------------------------------------------- |
| Abomination   | 20+  | Regenerating flesh horror                   |
| Behemoth      | 25+  | Colossal wall-crusher; enrages when wounded |
| Void Stalker  | 32+  | Shadow assassin — always hunts your General |
| Iron Colossus | 40+  | Walking siege engine                        |
| Elder Wyrm    | 50+  | Ancient dragon boss; bigger than sky drakes |

### Enemy roles

Every enemy has a job, a trait and a weakness. Named bosses carry two or three traits and change at half health.

| Enemy                  | Role                 | Trait                                                                                         | How to beat it                                               |
| ---------------------- | -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Goblin                 | Swarm                | Mob — hits harder for every goblin packed around it.                                          | Dies to anything; splash damage clears them.                 |
| Orc                    | Line infantry        | Blood Rage — hits 25% harder once wounded below half.                                         | Slow.                                                        |
| Orc Archer             | Skirmisher           | Loose Order — backs away when your soldiers close in.                                         | Cavalry.                                                     |
| Dark Knight            | Armoured rider       | Plate — arrows do 30% less, and he cannot be pinned.                                          | Pikes and magic.                                             |
| Warg Rider             | Raider               | Pounce — goes for archers, mages and healers; its first bite lands 80% harder.                | Pikes.                                                       |
| Dark Mage              | Hexer                | Hex — soldiers it hits deal 20% less damage for a few seconds.                                | Fragile; cavalry reaches it fast.                            |
| Troll                  | Wall breaker         | Regrowth — heals constantly, and heads for your buildings.                                    | Slow; focus fire outpaces the healing. Mages and ballistae.  |
| Goblin Sapper          | Bomber               | Volatile — runs at your buildings and explodes when it dies.                                  | Kill it at range before it arrives.                          |
| Necromancer            | Summoner             | Grave Call — keeps its distance and raises the dead.                                          | Fragile; kill it first.                                      |
| Berserker              | Shock trooper        | Frenzy — hits 35% harder below half health and never routs.                                   | No armour; takes 15% more damage.                            |
| Assassin               | General hunter       | Backstab — hunts your General; blows from behind land 50% harder still.                       | Dies to one solid hit.                                       |
| Shaman                 | Healer               | Ward — heals the host, and enemies near it take 10% less damage.                              | Unarmed; kill it first.                                      |
| Siege Tower            | Siege engine         | Rolling Tower — shrugs off arrows and batters walls.                                          | Sappers do double damage to it.                              |
| Goblin Engineer        | Field engineer       | Barricades — throws up cover for the host as it advances.                                     | Barely fights.                                               |
| War Chief              | Commander            | War Banner — enemies near the chief hit 15% harder.                                           | Kill him and the bonus is gone.                              |
| Harpy                  | Flying raider        | Dive — flies for archers, mages and healers; its first strike lands 60% harder.               | Low health.                                                  |
| Goblin Burrower        | Infiltrator          | Tunneller — always a line-breaker.                                                            | Cavalry and scouts run it down.                              |
| Bone Summoner          | Summoner             | Bone Call — keeps its distance and raises the dead.                                           | Fragile; kill it first.                                      |
| Orc Shieldbearer       | Shield wall          | Tower Shield — arrows and bolts do 55% less to it, and enemies beside it take 10% less.       | Mages, sappers, and anything that gets behind it.            |
| Goblin Firebrand       | Arsonist             | Firebomb — its bombs splash, keep burning for several seconds, and it prefers your buildings. | Fragile; cavalry and archers kill it fast.                   |
| Wailing Wraith         | Terror               | Dirge — soldiers near it steadily lose morale. It flies, and it never routs.                  | Low health. Bards and War Cry restore what it drains.        |
| Sky Drake              | Flying artillery     | Fire Breath — every shot burns everything near the target.                                    | Ballistae.                                                   |
| Plague Rat             | Swarm                | Plague — bites keep hurting for several seconds.                                              | Dies to anything.                                            |
| Hellbound Legionnaire  | Suppressor           | Suppressing Fire — soldiers it hits deal 15% less damage for a few seconds.                   | Cavalry.                                                     |
| Nightmare Strider      | Raider               | Pounce — goes for archers, mages and healers; its first strike lands 80% harder.              | Pikes.                                                       |
| Dreadborn Champion     | Armoured commander   | Dread Banner — enemies near it hit 15% harder; arrows do 25% less to it.                      | Mages and ballistae.                                         |
| Warp Prophet           | Hexer                | Curse — soldiers it hits deal 25% less damage for a few seconds.                              | Fragile; cavalry reaches it fast.                            |
| Grim Revenant          | Sniper               | Dead Eye — 50% more damage at long range; prefers healers and mages.                          | Helpless up close.                                           |
| Umbral Stalker         | Assassin             | Backstab — goes for archers, mages and healers; blows from behind land 50% harder still.      | Low health.                                                  |
| Cinderbound Juggernaut | Burning brute        | Cinder Hide — soldiers who strike it in melee are burned.                                     | Ranged fire; it is very slow.                                |
| Hellmortar Pack        | Artillery            | Mortar — every shell hits everything near the target.                                         | Cavalry and sappers.                                         |
| Abomination            | Bloated brute        | Rupture — regrows flesh, and bursts when it dies.                                             | Kill it away from your line.                                 |
| Behemoth               | Wall breaker         | Trample — every blow also hits soldiers beside the target; it heads for buildings.            | Ballistae and mages.                                         |
| Iron Colossus          | Siege construct      | Iron Shell — arrows do 40% less and melee attackers are hurt.                                 | Sappers and mages.                                           |
| Void Stalker           | General hunter       | Void Step — hunts your General; blows from behind land 50% harder still.                      | Bodyguards around the General.                               |
| Elder Wyrm             | Flying siege         | Wyrmfire — every breath burns everything near the target; it regrows scales.                  | Ballistae.                                                   |
| Gorath the Breaker     | Boss — warlord       | War Banner and Blood Rage. At half health he enrages.                                         | Kill his escort first; the banner only helps those near him. |
| Morwen the Pale        | Boss — hexer         | Hex and Grave Call. At half health she raises a pack of plague rats.                          | Cavalry; she is fragile for a boss.                          |
| Thokk the Mountain     | Boss — mountain      | Trample and Regrowth. At half health his regrowth doubles.                                    | Ballistae and mages; he is very slow.                        |
| Grimm Ashborne         | Boss — cinder knight | Plate and Cinder Hide. At half health he enrages.                                             | Mages; keep melee off him.                                   |
| Vexis the Hollow       | Boss — shadow        | Pounce and Backstab; hunts archers, mages and healers. At half health it strikes 40% harder.  | Low health for a boss; pin it with a tight formation.        |
| Iron Lord Karg         | Boss — forge walker  | Iron Shell; heads for your buildings. At half health it calls goblin sappers.                 | Sappers and mages.                                           |
| Sylvara Wyrm-Mother    | Boss — wyrm mother   | Wyrmfire. At half health she calls a flight of harpies.                                       | Ballistae.                                                   |
| The Rotfather          | Boss — plague lord   | Plague, Regrowth and Rupture. At half health a swarm of rats pours out of him.                | Kill him far from your line.                                 |
| Dread Marshal Volk     | Boss — dread marshal | War Banner and Suppressing Fire. At half health he enrages.                                   | Cavalry; break his escort and he is alone.                   |
| Malachar the Eternal   | Boss — the eternal   | Hex, Regrowth and War Banner. At half health he enrages and calls dark knights.               | Everything you have, at once.                                |

- **Sappers** demolish walls and settlements.
- **Siege towers** deploy against walls every 5 waves.
- **Assassins** hunt your General.
- **Burrowers** hide underground — use Scout Flare, watchtowers, or scouts to surface them.

---

## Difficulty

| Mode     | Effective % | Summary                           |
| -------- | ----------- | --------------------------------- |
| Baby     | 50%         | Forgiving — extra TP, weaker foes |
| Normal   | 100%        | Balanced                          |
| Chad     | 150%        | Harder, faster hordes             |
| Hellbane | 200%        | Hell marches                      |

On Chad and Hellbane the extra enemies are phased in: a third of the surplus on wave 1, two thirds on wave 2, the full host from wave 3. And on every difficulty the opening garrison does not desert during waves 1 and 2: soldiers whose morale breaks waver but stand, so a run cannot end in its first minutes because the last men walked off the field. They can still be killed.

### Advanced Difficulty

From the main menu, stack optional modifiers (ally/enemy buffs, spawn rates, elite frequency, enemy type weighting, TP income, morale, breakthrough limit). Each modifier adjusts your **effective difficulty %** shown on screen.

---

## Legion Archive, Grand Coliseum & Tonics

### Legion Archive

Unlock allied factions through the Research Lab, meta progress, or cheat codes. Build a faction's barracks, then recruit its operatives from **LEGION ARCHIVE** (under MORE in the left panel). Each operative has unique abilities and faction synergies. The same screen has each faction's **skill tree**: spend the points earned from recruits, waves and mastery on permanent bonuses for that faction's operatives.

### Secret: Grand Coliseum

- Unlocked at the **316 achievement milestone**, by researching Arena Warfare Doctrine, or by a cheat code (see appendix).
- Build cost: **1000 TP**, **10 Builders**, **40 Hamlets**, **10 Merchant Guilds**.
- Recruit 29 champions, each with unique stats and abilities. Click a completed Coliseum on the map to open the roster.

### Tonic Stations

Build tonic machines at night once they are researched or a roster is unlocked. Heroes collect up to **4 tonics** — Ironbrew, Field Revival, Swiftstep Tonic, Endurance Draft, Deadeye Elixir, and more.

### Secret: The Hellbane Hero

- Unlocked by surviving to **wave 200 on Hellbane difficulty**, or via cheat (see appendix).
- Deploy cost: **10,000 TP**.
- Near-unkillable; heals over time; auto-abilities based on battlefield pressure; one-hit sword (except in Hellscape at wave 1001+).

---

## Encyclopedia, Achievements & Secrets

### Encyclopedia (`I`)

In-game lore for allies, enemies, buildings, orders, stars, eras — plus classified tabs for **Coliseum champions**, **Legion operatives**, and **The Hellbane** (teaser entries until unlocked).

### Achievements (`A`)

**1,450 total** across tiered Bronze / Silver / Gold challenges, lifetime and session tracking, and crossover sub-tabs per faction.

| Milestone       | Achievement                               | Reward                   |
| --------------- | ----------------------------------------- | ------------------------ |
| **316 unlocks** | _316 Club_ + _And That's The Bottom Line_ | Grand Coliseum revealed  |
| **999 unlocks** | _Millennium Legend_                       | Ultimate meta completion |

Categories: Vanilla/Core, Waves/Eras, Combat, Army, Build, Specialists, Difficulty, Tactics, Economy, Crossovers (per faction), Secrets/Meta. Progress shows as **X/1450** in the top bar, achievement panel, and post-wave summary.

### Cheat Menu (`` ` ``)

Open from the main menu **CHEATS** button or in-game with backtick. Codes are not listed in the Encyclopedia — check the appendix at the bottom of this README if you want the full list.

---

## Tips for New Commanders

1. **Deploy a Builder early** — walls and outposts define your line.
2. **Protect your General** — he draws all enemy attention; use the Keep.
3. **Med tents save troops** — healers and combat units retreat there when badly wounded.
4. **Save TP before wave 100** — academies (40–100 TP) and settlements are expensive.
5. **Train mentors first** — you need Immortal veterans on field to found academies.
6. **Use Hunt mode** — but click to reposition for flanks; not every wave hits every side. Where you send a soldier becomes his post, and he comes back to it.
7. **Scout with spy actions** — know what’s coming on siege and boss waves.
8. **Lightning vs Fireball** — lightning is cheaper for precision; fireball for bigger blobs.
9. **Zoom out on big maps** — pan to flanks as territory grows.
10. **Read the Encyclopedia** — especially before building hamlets in the RTS era.

---

## File Structure

```
myth-and-blood/
├── index.html          # Main game page; loads js/ in order
├── js/                 # The game (game.js is the core simulation)
├── css/                # style.css plus the theme-v2.css HUD layer
├── data/               # Unit, building, enemy and strike definitions (JSON)
├── assets/sfx/         # Recorded orchestral cues (OGG)
├── tools/sfx/          # How the cues were made
├── mods/               # Mod loader manifest and an example mod
├── scripts/            # Build, tests and the headless simulation
├── src/                # TypeScript sources for the service/event/data cores
└── electron/           # Desktop wrapper
```

Developer commands: `npm run test:all`, `npm run check`, `npm run build`.

---

## License

MIT — see `package.json`.

---

_Defend the realm. Spend wisely. The waves never end._

---

## Appendix: Cheat Codes

Open **CHEATS** on the main menu (or press `` ` `` in-game). Unlocks persist between runs. In-game-only codes must be entered during a battle.

### Meta unlocks (persistent)

| Code               | Effect                                          |
| ------------------ | ----------------------------------------------- |
| `iron creed`       | Unlock the Grand Coliseum                       |
| `arena calls`      | Unlock the Grand Coliseum (alias)               |
| `hell walks`       | Unlock the Hellbane hero                        |
| `hellbane`         | Unlock the Hellbane hero (alias)                |
| `void residue`     | Unlock the Void Residue Crew and its barracks   |
| `first circle`     | Unlock the First Circle and its shrine          |
| `orbital vanguard` | Unlock the Orbital Vanguard and its academy     |
| `iron trench`      | Unlock the Iron Trench Coalition                |
| `ninefold march`   | Unlock the Ninefold March and its camp          |
| `iron pit`         | Unlock the Iron Pit Guild and its dojo          |
| `bound spirit`     | Unlock the Bound Spirit Court and its shrine    |
| `spirit court`     | Unlock the Bound Spirit Court (alias)           |
| `north star`       | Unlock the North Star Ascetics and their dojo   |
| `skyburst`         | Unlock the Skyburst Order and its base          |
| `crimson legions`  | Unlock the Crimson Legions                      |
| `crystal light`    | Unlock the Crystal Vanguard                     |
| `rift cult`        | Unlock the Rift Cult                            |
| `eternal crusade`  | Unlock the Crimson Legions trial reward (alias) |
| `voicebound`       | Unlock the Voicebound Pact                      |
| `open every gate`  | Unlock **all** cheat content at once            |

### In-game only (start a battle first)

| Code               | Effect                              |
| ------------------ | ----------------------------------- |
| `kings ransom`     | +500 TP and max army morale         |
| `war chest`        | +1000 TP                            |
| `clear the field`  | Eliminate all enemies on the field  |
| `muster all`       | Deploy one of every troop type free |
| `knights assemble` | Spawn 5 knights                     |
