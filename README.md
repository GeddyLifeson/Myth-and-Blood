# Myth and Blood — Game Manual

**Myth and Blood** is a browser-based fantasy tactical defense game. You command a growing army, spend Tactical Points (TP) on troops and structures, and hold the line against endless waves of enemies. Survive long enough and the campaign shifts from lane defense into territory control, academy training, settlement economy, crossover operatives, and late-game RTS-scale wars.

Everything is drawn with procedural pixel sprites — units animate in combat, strikes have battlefield FX, and buildings show HP bars when damaged.

---

## Quick Start

| Method | How |
|--------|-----|
| **Desktop (recommended)** | Double-click `Play Myth and Blood.bat` |
| **Browser** | Open `index.html` in any modern browser |
| **Install app** | Run `Install Desktop App.bat`, then launch from the shortcut |

No server is required. Sound is procedural (generated in the browser) — click **Begin Defense** or anywhere on the menu to unlock audio.

### Game modes (main menu)

| Mode | Summary |
|------|---------|
| **Campaign** | Standard endless run with chosen difficulty and optional advanced modifiers |
| **Survival Endless** | Score-focused; leaderboard ranks wave × difficulty% + kills |
| **Roguelike** | Random advanced modifiers each run |
| **Timed Blitz** | Shorter night prep — race the clock |
| **Seed Run** | Deterministic spawns from a shared seed |
| **Academy Era** | Jump to wave 100 / 105 / 200 — skip the early grind |

---

## Creative Mode

A **BTD6-style practice sandbox** for playtesting builds, waves, and unit upgrades — no achievements and no game over.

| How to start | Main menu → **CREATIVE MODE** (uses your selected difficulty) |
|--------------|----------------------------------------------------------------|
| Lab panel | **P** or the 🧪 button in the top bar |

**Defaults:** 9,999 TP · free deploy/build/strikes · instant building · all rosters unlocked · manual day/night · miss limit disabled.

| Lab section | What you can do |
|-------------|-----------------|
| **Sandbox rules** | Toggle free TP, no game over, manual waves, instant build, unlock-all, academy-era troop deploy |
| **Wave & cycle** | Set wave number, add TP, force day/night, start or clear waves |
| **Spawn tools** | Arm an enemy or enemy building type, click the map to place; clear all foes or enemy structures |
| **Selected unit** | Click any unit — rank up, max stars, heal, kill, or promote a Footman to General |

Use normal deploy/build controls alongside the lab. Disarm spawn tools to interact normally. Creative runs do not award achievements.

---

## Objective

- **Win condition:** There is no final wave. Your goal is to survive as long as possible.
- **Lose condition:** Enemies break through your line too many times. Each breakthrough counts as a **miss**. Exceed your miss limit and the realm falls.

Clear every wave to earn TP, expand territory, unlock new systems, and push into the Academy and RTS eras.

---

## Core Loop

1. **Night prep** — deploy troops, build, train academies, send spy/courier orders, and position defenses. Press **D** to begin the day when ready.
2. **Day combat** — waves spawn from unlocked flanks. Troops auto-engage in Hunt mode, or click to move them manually.
3. **Fight** — cast strikes, manage morale, retreat wounded troops to med tents.
4. **Clear the wave** — all enemies defeated.
5. **Earn TP** at round end (+7 base, scaling with wave, settlements, and difficulty).
6. **Repeat** with tougher, more numerous foes.

---

## Tactical Points (TP)

- Awarded once per cleared wave.
- Base income: **+7 TP**, plus scaling from wave number, difficulty, and late-game bonuses.
- **Uncapped storage** — hoard as much as you need.
- Early economy sites (max **6** quarries + trade posts combined):
  - **Quarry (30 TP):** +1 TP/round
  - **Trade Outpost (38 TP):** +1 TP/round and a small morale aura
- Settlement bonuses (late game):
  - **Hamlet:** +1 TP/round each (when complete).
  - **Merchant Guild:** +1 TP/round each, if built within a hamlet’s aura.
  - **Fortress Upgrade** on a completed hamlet: +HP, cover, and +1 TP/round.

Spend TP on troops, buildings, strikes, spy actions, and courier messages.

---

## Controls

### Map navigation
| Input | Action |
|-------|--------|
| Click + drag | Pan the map |
| Mouse wheel | Zoom in/out (toward cursor) |
| Arrow keys | Pan the map (works while paused) |

### Deployment
| Key | Unit |
|-----|------|
| 1 | Footman |
| 2 | Archer |
| 3 | Mage |
| 4 | Cavalry |
| 5 | Healer |
| 6 | Knight |
| 7 | Builder |
| 8 | Sapper |
| 9 | Courier |
| 0 | General |

Scout, Bard, Ballista, and Pikeman are on the deploy panel (no dedicated hotkeys).

### Buildings
| Key | Structure |
|-----|-----------|
| O | Outpost |
| L | Wall |
| C | Castle (full compound) |
| N | Medical Tent |
| M | Mess Hall |
| Y | Watchtower |
| B | Trade Outpost |
| G | Hamlet |
| U | Merchant Guild |

Spike Trap, Quarry, Fortress Upgrade, and Academies are panel-only.

### Strikes
| Key | Ability |
|-----|---------|
| Q | Fireball Barrage |
| W | Lightning Strike |
| E | Healing Rain |
| R | Reinforcements |
| T | Battle Rally |
| F | Meteor Shower |
| J | Frost Nova |
| K | Scout Flare |
| X | Fortify Zone |

Select a strike, then click the map. A targeting ring and icon follow your cursor.

### Structure tools
| Button / key | Action |
|--------------|--------|
| **DEMOLISH** | Click a building to remove it (partial TP refund) |
| **MOVE** | Relocate a completed structure |
| **ROTATE** | Reposition a wall segment |
| **R** (while placing a wall) | Cycle wall facing before placement |

### General
| Key | Action |
|-----|--------|
| D | Begin day phase (during night prep) |
| H | Toggle Hunt mode |
| Space | Pause |
| Esc | Cancel selection / close panels |
| V | Mute/unmute sound |
| A | Achievements |
| I | Encyclopedia |
| ` (backtick) | Cheat menu |
| P | Creative Lab panel (Creative Mode only) |

Click the map to deploy, build, cast strikes, or move selected units. Hover UI buttons for tooltips.

---

## Troops

| Unit | Cost | Role |
|------|------|------|
| Footman | 3 | Cheap melee; garrisons walls when General commands Keep |
| Archer | 4 | Ranged DPS; strong in outposts |
| Mage | 6 | Arcane bolts with splash damage |
| Cavalry | 7 | Fast melee; charge bonus |
| Healer | 5 | Heals allies in range (including other healers); retreats to med tents when wounded |
| Knight | 8 | Armored melee; damage resistant |
| Sapper | 5 | Bonus damage vs walls and siege |
| Scout | 4 | Fast skirmisher; reveals stealth |
| Bard | 5 | Morale aura support |
| Ballista | 6 | Long-range siege; bonus vs flying foes |
| Pikeman | 4 | Anti-cavalry and anti-air line holder |
| General | 12 | Global enemy target; command aura from Keep; auto-rallies demoralized troops |
| Builder | 5 | Constructs buildings (2 projects max); auto-repair toggle |
| Courier | 4 | Sends royal messages once per wave |

**Hunt mode** (on by default): combat troops pathfind toward enemies. Click the map to override with manual orders.

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
- **Quarry (30 TP, 2 Builders)** — +1 TP/round. Counts toward the 6-site cap.
- **Trade Outpost (38 TP, 2 Builders)** — +1 TP/round and morale aura. Same cap.

### Academies (Wave 100+)
Each academy trains **1 free unit per round** when built. TP deployment of troops ends in the Academy Era — you must train through academies.

**Mentor requirement:** You need a **max-rank veteran** (Immortal, tier 6) of that unit type **on the field** before you can found an academy. Hover an academy button for the exact block reason.

| Academy | Cost |
|---------|------|
| Footman / Scout / Courier / Pikeman | 40 TP |
| Archer / Sapper / Bard | 45 TP |
| Healer / Builder | 48 TP |
| Cavalry | 60 TP |
| Knight | 65 TP |
| Mage / Ballista | 55 TP |
| General | 100 TP |

Special rules:
- **Healer Academy** — build only on waves divisible by 5.
- **General Academy** — waves divisible by 10; requires a promotable veteran Footman and no General on field.
- **Builder / Courier Academy** — blocked if two or more of that specialist are on field (one max-level mentor may still train).

### Settlements (RTS Era, Wave 100+)
| Structure | Cost | Requirements | Effect |
|-----------|------|--------------|--------|
| Hamlet | 100 TP | 5 Builders; builds over 5 waves | +1 TP/round |
| Merchant Guild | 150 TP | 5 Builders | +1 TP/round per guild in hamlet aura |
| Fortress Upgrade | 50 TP | Completed hamlet nearby | +HP, cover, +1 TP/round on that hamlet |

All settlements have **large footprints**, **HP bars**, and are **siege targets**. Enemies will attack player and enemy structures. Recommended after wave 100 unless you are confident in your defenses.

---

## General & Command

- Enemies **prioritize** your General globally.
- Station him in the castle **Keep** to grow a **command aura** (buffs nearby allies).
- With a General in the Keep, **footmen auto-fill wall slots** inside the castle compound.
- **Demoralized troops** (routing before wave 100, giving up after wave 100) are detected globally — the General paths to them for a pep talk.
- On promotion from Footman, honor names are kept; combat stars reset and only improve aura.

---

## Strikes, Spy & Courier

All nine strikes have **animated icons** on the HUD and **battlefield FX** when cast.

### Core strikes (fixed cost)
| Strike | Cost | Effect |
|--------|------|--------|
| Fireball | 9 TP | AoE fire damage |
| Lightning | 6 TP | Focused storm damage (smaller radius) |
| Heal Rain | 6 TP | Heals allies in a large radius |
| Reinforcements | 12 TP | Spawns 2 footmen + 1 archer on the battlefield |
| Battle Rally | 6 TP | Army-wide morale boost, +12% damage, clears routing |

### Advanced strikes (cost drops after wave 100; Meteor also drops at 200)
| Strike | Base cost | Effect |
|--------|-----------|--------|
| Meteor Shower | 14 TP | Dual-impact fire devastation |
| Frost Nova | 8 TP | Damage + slow in a wide radius |
| Scout Flare | 4 TP | Reveals burrowed/hidden enemies |
| Fortify Zone | 7 TP | Allies in zone take 25% less damage |

### Spy Network (one action per wave)
Steal TP, disrupt spawns, assassinate elites, scout next wave, poison caches, sabotage siege, deep infiltration, bribe informant — plus **Muster Deserters**, **Raid War Chest**, **Forge Maps**, and **Tunnel Network**.

### Courier Messages (one per wave; Courier must be on field)
Reinforcements, Royal Decree (+morale), Tax Levy (+TP), Call Banner (knight), Supply Train (heal all), Offer Truce, Medical Evac — plus **Royal Herald**, **Emergency Muster**, and **Open War Chest**.

**Sleight of Hand** perk reduces spy and courier costs by 1 TP.

---

## Morale & Routing

- Troops **witness fallen allies** (line of sight) and lose morale.
- Too many casualties cause **routing** — enemies flee off-map; before wave 100 allies may desert; after wave 100 they stop fighting until rallied.
- **Battle Rally**, courier decrees, bards, and the General’s pep talks restore the line.

---

## Waves, Territory & Eras

### Wave milestones
| Wave | Event |
|------|-------|
| Every 5 | **Horde wave** — fast swarms (goblins, rats, orcs); weaker but numerous |
| Every 10 | Map expands (+90 wide, +110 deep); **named boss** leads (replaces horde) |
| Every 15 | Horde wave includes embedded siege tower + sappers |
| Every 25 | New attack flank unlocked (East → West → South) |
| **100** | **Academy Era** — no TP troop deploy; academies and settlements |
| **200** | **Enemy RTS** — map widens; enemies build mirror settlements |
| **1001+** | **Hellscape** — even endgame heroes struggle |

### Flank variety
Once multiple flanks are unlocked, each wave rolls a **random non-empty subset** — you will not face every direction every wave. Spy intel shows possible flanks.

### Loadouts (Wave 100+)
Choose a passive army bonus: **Balanced**, **Shield Wall**, **Arrow Storm**, **Siege Crew**, or **Royal Court**.

### Horde waves (every 5 waves — except boss waves)
Swarm assaults spawn **~30% more foes** on a **faster timer**, mostly goblins, plague rats, and orcs at **slightly reduced HP/damage** — pressure without unfair spikes. Rotating flavors (Goblin Tide, Orc Pack, Warg Run, etc.) announce at dawn. Hunt mode and AoE strikes shine here. After wave 40, a single light elite may appear in the mob.

### Named bosses (every 10 waves)
Each boss wave fields one unique warlord with a title, tagline, crown sprite, and top-bar HP tracker. The roster cycles every 100 waves and scales stronger on return visits.

| Wave | Boss | Title |
|------|------|-------|
| 10 | Gorath the Breaker | Warlord of the Ash March |
| 20 | Morwen the Pale | Queen of the Bone Court |
| 30 | Thokk the Mountain | Walker of Shattered Gates |
| 40 | Grimm Ashborne | Knight of the Cinder Oath |
| 50 | Vexis the Hollow | Shadow That Hungers |
| 60 | Iron Lord Karg | Forge-Walker |
| 70 | Sylvara Wyrm-Mother | Matriarch of the Burning Sky |
| 80 | The Rotfather | Pustulent Patriarch |
| 90 | Dread Marshal Volk | Hammer of the North Host |
| 100 | Malachar the Eternal | Voice of the Endless Siege |

Wave 110 brings Gorath back — tougher. Spy **Assassinate Captain** removes elites but not the named boss.

### Wave events (mid/late game)
Blood Moon (flying predators), Supply Caravan (+TP), Siege Push (extra towers), and more.

### Miss limit
Varies by difficulty. An enemy reaching your breakthrough line counts as a miss.

---

## Star System & Honor Names

### Combat troops
- Earn **bronze stars** from kills.
- 3 bronze → 1 silver → 1 gold → **veteran upgrade** (+HP, damage, speed) up to **Immortal (tier 6)**.

### Specialists (Healer, Builder, Courier)
- Earn one star step per wave when they **work** (heal, build, dispatch).

### Honor names
At **3 gold stars**, the Crown grants a name (e.g. *Syr Gwyn*) plus a veteran upgrade. Generals keep their name on promotion; stars reset and only boost command aura.

---

## Enemies

Standard foes include goblins, orcs, archers, mages, warg riders, harpies, burrowers, plague rats, and more. **Elite enemies glow purple** — dark knights, trolls, war chiefs, necromancers, berserkers, assassins, shamans, siege towers, bone summoners, sky drakes, and goblin engineers.

**Big monsters** (red elite rings, larger sprites, spawn fanfare) appear from mid-late waves:

| Monster | Wave | Threat |
|---------|------|--------|
| Abomination | 20+ | Regenerating flesh horror |
| Behemoth | 25+ | Colossal wall-crusher; enrages when wounded |
| Void Stalker | 32+ | Shadow assassin — always hunts your General |
| Iron Colossus | 40+ | Walking siege engine |
| Elder Wyrm | 50+ | Ancient dragon boss; bigger than sky drakes |

- **Sappers** demolish walls and settlements.
- **Siege towers** deploy against walls every 5 waves.
- **Assassins** hunt your General.
- **Burrowers** hide underground — use Scout Flare, watchtowers, or scouts to surface them.

---

## Difficulty

| Mode | Effective % | Summary |
|------|-------------|---------|
| Baby | 50% | Forgiving — extra TP, weaker foes |
| Normal | 100% | Balanced |
| Chad | 150% | Harder, faster hordes |
| Doomslayer | 200% | Hell marches |

### Advanced Difficulty
From the main menu, stack optional modifiers (ally/enemy buffs, spawn rates, elite frequency, enemy type weighting, TP income, morale, breakthrough limit). Each modifier adjusts your **effective difficulty %** shown on screen.

---

## Crossover HQ, WWE & Perks

### Crossover HQ
Unlock crossover factions via cheat codes or meta progress. Build faction barracks (Element 115, Primis Shrine, Spartan Academy, etc.), then recruit operatives from **CROSSOVER HQ** in the HUD. Each operative has unique abilities and faction synergies.

### Secret: WWE Academy
- Unlocked at the **316 achievement milestone** (316 Club), or by discovering a cheat code (see appendix).
- Build cost: **1000 TP**, **10 Builders**, **40 Hamlets**, **10 Merchant Guilds**.
- Recruit 29 WWE Superstars, each with unique stats and abilities. Click a completed WWE Academy on the map to open the roster.

### Perk-a-Cola (secret roster active)
Build perk machines at night. Heroes collect up to **4 perks** — Jugger-Nog, Speed Cola, Double Tap, Mule Kick, Sleight of Hand, Tombstone (General only), and more.

### Secret: The Doomslayer Hero
- Unlocked by surviving to **wave 200 on Doomslayer difficulty**, or via cheat (see appendix).
- Deploy cost: **10,000 TP**.
- Near-unkillable; heals over time; auto-abilities based on battlefield pressure; one-hit sword (except in Hellscape at wave 1001+).

---

## Encyclopedia, Achievements & Secrets

### Encyclopedia (`I`)
In-game lore for allies, enemies, buildings, orders, stars, eras — plus classified tabs for **WWE Superstars**, **crossover operatives**, and **The Doomslayer** (teaser entries until unlocked).

### Achievements (`A`)
**1,000 total** across tiered Bronze / Silver / Gold challenges, lifetime and session tracking, and crossover sub-tabs per faction.

| Milestone | Achievement | Reward |
|-----------|-------------|--------|
| **316 unlocks** | *316 Club* + *And That's The Bottom Line* | WWE Academy revealed |
| **999 unlocks** | *Millennium Legend* | Ultimate meta completion |

Categories: Vanilla/Core, Waves/Eras, Combat, Army, Build, Specialists, Difficulty, Tactics, Economy, Crossovers (per faction), Secrets/Meta. Progress shows as **X/1000** in the top bar, achievement panel, and post-wave summary.

### Cheat Menu (`` ` ``)
Open from the main menu **CHEATS** button or in-game with backtick. Codes are not listed in the Encyclopedia — check the appendix at the bottom of this README if you want the full list.

---

## Tips for New Commanders

1. **Deploy a Builder early** — walls and outposts define your line.
2. **Protect your General** — he draws all enemy attention; use the Keep.
3. **Med tents save troops** — healers and combat units retreat there when badly wounded.
4. **Save TP before wave 100** — academies (40–100 TP) and settlements are expensive.
5. **Train mentors first** — you need Immortal veterans on field to found academies.
6. **Use Hunt mode** — but click to reposition for flanks; not every wave hits every side.
7. **Scout with spy actions** — know what’s coming on siege and boss waves.
8. **Lightning vs Fireball** — lightning is cheaper for precision; fireball for bigger blobs.
9. **Zoom out on big maps** — pan to flanks as territory grows.
10. **Read the Encyclopedia** — especially before building hamlets in the RTS era.

---

## File Structure

```
myth-and-blood/
├── index.html          # Main game page
├── Play Myth and Blood.bat
├── js/
│   ├── game.js         # Core simulation
│   ├── units.js        # Unit & building definitions
│   ├── content-expansion.js  # Advanced units, strikes, wave events
│   ├── strike-fx.js    # Strike sprites & battlefield animations
│   ├── sprites.js      # Procedural unit/building graphics
│   ├── ui.js           # HUD and menus
│   ├── tooltips.js     # Hover tips for all controls
│   ├── crossover.js    # Crossover operative rosters
│   ├── game-modes.js   # Campaign modes & challenges
│   ├── achievements.js # 1,000 achievements
│   ├── encyclopedia.js # In-game manual/lore
│   └── ...
├── css/style.css
└── electron/           # Desktop wrapper
```

---

## License

MIT — see `package.json`.

---

*Defend the realm. Spend wisely. The waves never end.*

---

## Appendix: Cheat Codes

Open **CHEATS** on the main menu (or press `` ` `` in-game). Unlocks persist between runs. In-game-only codes must be entered during a battle.

### Meta unlocks (persistent)

| Code | Effect |
|------|--------|
| `Austin 3:16` | Unlock WWE Academy |
| `whatcha gonna do` | Unlock WWE Academy (alias) |
| `hell walks` | Unlock Doomslayer hero |
| `Doomslayer` | Unlock Doomslayer hero (alias) |
| `115` | Unlock Element 115 crew + Element 115 Barracks |
| `Primus` | Unlock Primis Origins crew + Primis Shrine |
| `Halo` | Unlock UNSC heroes + Spartan Academy |
| `Gears` | Unlock COG squad + COG Academy |
| `One to Rule Them All` | Unlock LOTR Fellowship + Rivendell Camp |
| `Hanma` | Unlock Baki fighters + Hanma Dojo |
| `ジョジョの奇妙な冒険` | Unlock JoJo Parts 1–7 + Stand Arrow Shrine (Part 7 = cavalry) |
| `jojos bizarre adventure` | Unlock JoJo roster (alias) |
| `FOTNS` | Unlock Fist of the North Star fighters + North Star Dojo |
| `Dragon Soul` | Unlock Dragon Ball Z-Fighters + Capsule Corp |
| `THE ONE PIECE IS REAL` | Unlock **all** cheat content at once |

### In-game only (start a battle first)

| Code | Effect |
|------|--------|
| `IDDQD` | +500 TP and max army morale |
| `Rosebud` | +1000 TP |
| `there can be only one` | Eliminate all enemies on the field |
| `gotta catch em all` | Deploy one of every troop type free |
| `gotta catch 'em all` | Same as above (alias) |
| `it's morphin time` | Spawn 5 knights |
| `its morphin time` | Spawn 5 knights (alias) |