# Myth and Blood

A fantasy wave defense played on one field, in the manner of Mud and Blood 2. The enemy comes from the top. Your line is the bottom edge. You recruit soldiers, raise works and hold for as long as you can. Soldiers who die are gone for good, and the siege has no last wave.

The game runs in a browser, on a laptop or a phone, and as a desktop app. Everything on screen is drawn in code in a hand-inked horror-comic style; there are no image files.

This file is the player manual, followed by notes for developers. Each system has its own short section so it can be changed without touching the rest.

**Contents:** [Quick start](#quick-start) · [How a run goes](#how-a-run-goes) · [Controls](#controls) · [Tactical Points](#tactical-points-tp) · [Recruiting and army upkeep](#recruiting-and-army-upkeep) · [Troops](#troops) · [Posts, Hunt and Hold](#posts-hunt-and-hold) · [The med tent](#the-med-tent) · [Buildings](#buildings) · [Research](#research) · [The enemy](#the-enemy) · [Breaches and line-breakers](#breaches-and-line-breakers) · [Wave preview](#wave-preview-and-the-watchtower) · [Counters](#counters-and-rear-attacks) · [The Sapper](#the-sapper) · [The General's orders](#the-generals-orders) · [Spells](#spells) · [Spy and courier](#spy-and-courier) · [Spoils and edicts](#spoils-and-edicts) · [Supply crates](#supply-crates) · [Veterans and morale](#veterans-and-morale) · [Ribbons](#ribbons) · [Run score](#run-score) · [Difficulty](#difficulty) · [Modes](#modes) · [Champions](#champions-and-companies) · [The late siege](#the-late-siege) · [Saving](#saving) · [Cheats](#cheats) · [Encyclopedia and achievements](#encyclopedia-and-achievements) · [Developer notes](#developer-notes)

---

## Quick start

| How         | What to do                                                   |
| ----------- | ------------------------------------------------------------ |
| Browser     | Open `index.html` in a current browser. No server is needed. |
| Desktop     | `npm install`, then `npm start`.                             |
| Windows     | Double-click `Play Myth and Blood.bat`.                      |
| Install app | Run `Install Desktop App.bat`, then use the shortcut.        |

Click **Begin Defense**. Sound starts on your first click or key press. Music and the set-piece cues are recordings; combat sounds are made in the browser.

Your first five minutes:

1. Press `1`, click the field a few times to place Footmen in a row above the bottom edge. Press `2` and put Archers behind them.
2. Press `D` to start the day. Your soldiers fight on their own and walk back to where you put them.
3. After the wave, place a Builder, then a Wall (`L`) and a Medical Tent (`N`).
4. On wave 3 or 4 build a Research Lab from the Build tab and start Iron Weapons.
5. After wave 5 you are offered spoils. Take one.

Press `?` at any time for the keys that work on the screen in front of you.

---

## How a run goes

- **One field for the whole run.** The field does not reset and does not change size. What you build stays until it is destroyed.
- **Night.** You have about a minute to recruit, build, research and place soldiers. The top of the screen shows what the next wave is likely to bring, and markers on the top edge show where it will enter. Press `D` to sound the horn early: it pays 1 TP for every 10 seconds left, up to 5.
- **Day.** The wave enters from the top edge in up to three sectors (left, centre, right), forms up, and advances. Your soldiers fight from their posts. The day ends when the last enemy is dead.
- **Pay.** Clearing a wave pays TP. Buildings that earn pay at dawn.
- **Every 5th wave** is a horde: more enemies, arriving faster. After it you choose one of three **spoils**.
- **Every 10th wave** a named warlord leads the host in place of the horde.
- **War camps.** The enemy raises camps along the top edge. A camp left standing makes the next wave stronger.
- **The end.** The run ends when too many enemies have crossed your line (the breach limit), or when you have no soldiers left and nothing that can train one. There is no winning wave. Waves 10, 25, 50 and 100 are milestones with ribbons attached; the siege goes on past them and the run is scored when it ends.

On your first runs the game introduces one system per early wave with a line at the bottom of the screen. It stops for good once you have reached wave 10, and **Skip the introduction** in the pause menu turns it off at once.

---

## Controls

### Mouse and touch

| Input                          | Action                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| Click a troop, then map        | Place one soldier                                                 |
| Shift+click the map            | Place one and keep the same troop in hand (also repeats walls)    |
| Click a soldier                | Select him. Drag across empty ground to select several            |
| Click the map (selected)       | Move the selection; the spot becomes their post                   |
| Shift+click (selected)         | Move there and hold                                               |
| Right-click                    | Cancel what is in hand                                            |
| Middle-button drag, arrow keys | Pan                                                               |
| Mouse wheel                    | Over the field: zoom. Over a side panel: scroll that panel        |
| Touch                          | Tap places one; long-press a spot to move and hold; pinch to zoom |

A troop, building, spell or message you cannot use is greyed out and cannot be picked. Its tooltip gives the reason. Game speed has no key; use the SPEED button in the top bar.

### Keys

The game keeps one key map per screen, in `js/hotkeys.js`. No key does two things on the same screen. Space pauses, Tab selects the next soldier and Esc cancels, wherever they are bound. Recruit keys follow what you have unlocked: the starting troops take the first keys in panel order, and each new troop takes the next free key and keeps it for the run. Keys cannot be rebound yet.

The tables below are generated from the key maps. To regenerate them: `node scripts/gen-readme-keys.mjs --write`.

<!-- keys:start (generated by scripts/gen-readme-keys.mjs) -->

**Night — preparing** (the full field map)

| Key                 | Action                                              |
| ------------------- | --------------------------------------------------- |
| ?                   | Show the keys for this screen                       |
| V                   | Mute / unmute sound                                 |
| A                   | Achievements                                        |
| I                   | Encyclopedia                                        |
| `` ` ``             | Cheat codes                                         |
| F3                  | Performance overlay                                 |
| F10                 | Bug report                                          |
| Space               | Pause                                               |
| Tab                 | Select the next soldier                             |
| Shift+Tab           | Message log                                         |
| H                   | Hunt: release Hold                                  |
| Shift+H             | Hold here                                           |
| [                   | War Cry (General)                                   |
| ]                   | Hold the Line (General)                             |
| Z                   | Balanced loadout                                    |
| D                   | Begin the day (night only)                          |
| ↑ ↓ ← →             | Pan the map                                         |
| Q                   | Fireball                                            |
| W                   | Lightning                                           |
| E                   | Healing Rain                                        |
| R                   | Reinforcements                                      |
| T                   | Battle Rally                                        |
| F                   | Meteor Shower                                       |
| J                   | Frost Nova                                          |
| K                   | Scout Flare                                         |
| X                   | Fortify Zone                                        |
| P                   | Arcane Dispel                                       |
| S                   | Voice Shout                                         |
| ;                   | Fire Breath                                         |
| '                   | Ice Form                                            |
| 1–0 Shift+1–Shift+0 | Recruit: one key per unlocked troop, in panel order |
| O                   | Outpost                                             |
| L                   | Wall                                                |
| C                   | Castle                                              |
| N                   | Medical Tent                                        |
| M                   | Mess Hall                                           |
| G                   | Hamlet                                              |
| U                   | Merchant Guild                                      |
| Y                   | Watchtower                                          |
| B                   | Trade Outpost                                       |
| Esc                 | Pause menu                                          |

**Other screens**

| Screen             | Keys                                                                                                                                                                                                                    | The rest                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Main menu          | `?` Show the keys for this screen; `V` Mute / unmute sound; `A` Achievements; `I` Encyclopedia; `` ` `` Cheat codes; `F3` Performance overlay; `F10` Bug report; `Enter` Begin the defense; `Esc` Close the open panel  | Nothing else works              |
| Day — under attack | Same keys as the field                                                                                                                                                                                                  | Off: `D`                        |
| Soldiers selected  | `F` Centre the view on the selection; `C` Clear the selection; `B` Send them back to their posts; `G` Reform the formation (two or more); `U` Promote the selected veteran; `Alt+1–5` Formation presets; `Esc` Deselect | Everything else as on the field |
| Building picked up | `Esc` Put the building back                                                                                                                                                                                             | Everything else as on the field |
| Placing or aiming  | `Esc` Cancel                                                                                                                                                                                                            | Everything else as on the field |
| Placing a wall     | `R` Turn the wall before placing; `Esc` Cancel                                                                                                                                                                          | Everything else as on the field |
| Paused             | `?` Show the keys for this screen; `V` Mute / unmute sound; `A` Achievements; `I` Encyclopedia; `` ` `` Cheat codes; `F3` Performance overlay; `F10` Bug report; `Space` Resume; `Esc` Resume; `Shift+Tab` Message log  | Nothing else works              |
| Spoils of war      | `1` Take the first reward; `2` Take the second reward; `3` Take the third reward; `←` Previous reward; `↑` Previous reward; `→` Next reward; `↓` Next reward; `Tab` Next reward; `Enter` Take the highlighted reward    | Nothing else works              |
| After the battle   | `?` Show the keys for this screen; `V` Mute / unmute sound; `A` Achievements; `I` Encyclopedia; `` ` `` Cheat codes; `F3` Performance overlay; `F10` Bug report; `Enter` Fight again; `Esc` Close the open panel        | Nothing else works              |
| Creative mode      | `P` Creative Lab panel                                                                                                                                                                                                  | Everything else as on the field |

<!-- keys:end -->

---

## Tactical Points (TP)

TP pays for everything. There is no cap on what you can hold.

| Source          | Amount                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| Clearing a wave | 7, rising slowly with the wave number; +3, 0, −1 or −2 by difficulty       |
| Trade Outpost   | +2 at dawn                                                                 |
| Quarry          | +3 at dawn (at most six Trade Outposts and Quarries together)              |
| Early horn      | +1 for every 10 seconds of night left, up to +5                            |
| Supply crates   | A few TP, more in later waves                                              |
| Spoils, ribbons | War Levy and The Hundred add TP per wave; War Chest pays 15 at once        |
| Settlements     | Late game. Hamlet: +5 TP/round; Village 8, Town 10, City 12, Metropolis 15 |

The number in the top bar is what you have, to the point, at all times.

---

## Recruiting and army upkeep

One click places one soldier. Hold Shift to place several of the same troop; it stops when you release Shift, cannot pay, or press Esc. The General is one of a kind.

The first 14 soldiers cost their listed price. Each soldier past 14 makes every new recruit 7% dearer, so the price has roughly doubled by the 28th. The price on a recruit button is always the price you will be charged, with the base price struck through beside it.

- Builders and couriers do not count toward the 14.
- Each Granary feeds 3 more soldiers before the surcharge starts (the first three Granaries count).
- Courier reinforcements and banner knights pay the same surcharge.
- A larger army also draws more line-breakers.

---

## Troops

Every troop has one role, one trait and one weakness. Select a soldier to see his in the unit panel.

| Troop       | TP  | Role           | Trait                                                                                     | Weakness                                     | Needs             |
| ----------- | --- | -------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------- |
| Footman     | 3   | Line holder    | Shield Wall: 12% less damage for each footman or pikeman beside him, up to 36%            | Kills slowly                                 |                   |
| Archer      | 4   | Ranged damage  | Volley: 20% more damage to targets far away                                               | 40% less damage when an enemy is in his face |                   |
| Crossbowman | 5   | Armour piercer | Heavy Quarrel: 40% more damage to armoured enemies and siege engines                      | Reloads slowly; swarms overrun him           | Iron Weapons      |
| Mage        | 6   | Area damage    | Arcane Burst: every fourth attack also hits everything near the target                    | The most fragile soldier on the field        |                   |
| Cavalry     | 7   | Runner hunter  | Run Down: 60% more damage to line-breakers and routing enemies                            | Pikes and trolls stop a charge               |                   |
| Healer      | 5   | Medic          | Field Dressing: soldiers near a healer slowly recover                                     | Cannot fight                                 |                   |
| Knight      | 8   | Heavy infantry | Cleave: each swing also wounds a second enemy beside the target                           | Expensive; mages cut through the armour      | Iron Weapons      |
| Sapper      | 5   | Field engineer | Demolitions: mines at night, satchel charges by day (see [The Sapper](#the-sapper))       | A knife up close; blasts cannot reach flyers | Iron Weapons      |
| Scout       | 4   | Spotter        | Archers, mages and ballistae near a scout deal 12% more; he hits line-breakers 60% harder | Loses a straight fight                       | Advanced Infantry |
| Bard        | 5   | Morale         | Marching Song: soldiers in earshot regain morale                                          | Weak in a fight                              | Morale Arts       |
| Ballista    | 6   | Giant killer   | Heavy Bolt: 35% more damage to bosses, monsters and elites                                | Half damage at close range; slow to move     | Siege Engineering |
| Pikeman     | 4   | Anti-cavalry   | Set Pikes: riders and beasts that strike him take 40% of the blow back                    | Arrows and magic                             | Advanced Infantry |
| General     | 12  | Commander      | Orders: War Cry and Hold the Line; an aura strengthens everyone near him                  | Every enemy on the field wants him dead      | Command Theory    |
| Builder     | 5   | Engineer       | Raises buildings, two projects at a time; soldiers near him take 10% less damage          | Barely armed                                 |                   |
| Courier     | 4   | Messenger      | Carries one message a wave; dodges a third of arrows and bolts                            | Unarmed                                      |                   |

The Crossbowman deals 44 damage a shot against the Archer's 28, and takes 1.8 times as long between shots. He is wasted on goblins and earns his pay against trolls, dark knights, war chiefs, shieldbearers and siege towers.

The numbers in this table come from `data/units.json` and `js/roster.js`. The in-game encyclopedia reads the same sources at run time and is the reference if the two ever differ.

---

## Posts, Hunt and Hold

Every soldier has a **post**: the spot where you placed him, or the place you last sent him.

**Hunt is the default.** A hunting soldier leaves his post to fight what comes near it, goes for line-breakers first, helps a comrade fighting close by, and walks back when the fight is over. He is on a leash: about 240 from his post for a melee soldier, about 140 for an archer or mage, and half as far again after a line-breaker.

**Hold is an order.** A holding soldier stays where you put him and strikes only what comes inside his reach. He keeps holding through saves and visits to the med tent until you move him with a plain click or release him. A small planted shield at his feet marks him.

| Input                   | Action                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| Click the map           | Move the selection; they hunt from the new post                  |
| Shift+click the map     | Move there and hold                                              |
| `Shift+H` / HOLD button | Hold here: the selection, or the whole army if nothing is picked |
| `H` / HUNT button       | Release Hold: the selection, or the whole army                   |
| `B` (with a selection)  | Back to posts now                                                |

A selected soldier's post is drawn as a small bone-coloured diamond. Healers and builders follow their own work and take no Hunt or Hold order. The General keeps his own counsel.

---

## The med tent

Build a Medical Tent (5 TP) close behind the line.

- A wounded soldier who is **not fighting** walks to the nearest tent with a free bed at once, heals to full and returns to his post.
- A soldier **in a fight** stays in it while above half health and breaks off below half.
- A tent has **four beds**. The rest wait outside and still strike what comes in reach.
- Holding soldiers go too, and come back to hold. The General does not go.
- A red cross marks a soldier on his way; amber while he waits.

Expect gaps in the line while men heal.

---

## Buildings

Every building needs a Builder on the field. One Builder runs two projects at a time. Each building has one job.

| Building      | TP  | Job                                                                                | Needs             |
| ------------- | --- | ---------------------------------------------------------------------------------- | ----------------- |
| Outpost       | 4   | Cover for one soldier; an archer inside shoots further. Takes one upgrade, once    |                   |
| Barracks      | 6   | Outpost upgrade: a free Footman every third dawn (first two Barracks count)        | Field Engineering |
| Granary       | 6   | Outpost upgrade: 3 more soldiers before army upkeep starts (first three count)     | Field Engineering |
| Wall          | 5   | Blocks movement; each wall holds up to 3 line-breakers a wave and makes them fight |                   |
| Watchtower    | 4   | The night preview lists the next wave by type and number                           |                   |
| Spike Trap    | 3   | 45 damage to the first enemy crossing, every 1.5 seconds                           | Field Engineering |
| Medical Tent  | 5   | Heals the wounded (see above)                                                      |                   |
| Mess Hall     | 5   | Soldiers near it keep their morale                                                 |                   |
| Research Lab  | 18  | 6 science at every dawn (first two labs count), and a little from kills            |                   |
| Trade Outpost | 10  | +2 TP at dawn                                                                      |                   |
| Quarry        | 14  | +3 TP at dawn                                                                      | Prospecting       |
| Castle        | 46  | A full compound: walls, outposts, a keep, a med tent and a mess hall               | Fortification     |

An Outpost becomes a Barracks **or** a Granary. The choice is final for that Outpost. DEMOLISH removes a building for part of its price, MOVE relocates a finished one, and `R` turns a wall before it is placed.

---

## Research

A Research Lab pays science at each dawn. Open the Research panel and pick a project; one runs at a time. Seven troops are open from the start (Footman, Archer, Mage, Cavalry, Healer, Builder, Courier). The rest are researched.

| Research          | Science | From wave | Opens                          | After             |
| ----------------- | ------- | --------- | ------------------------------ | ----------------- |
| Iron Weapons      | 20      | 3         | Knight, Sapper, Crossbowman    |                   |
| Field Engineering | 18      | 3         | Spike Trap, Barracks, Granary  |                   |
| Morale Arts       | 18      | 4         | Bard                           |                   |
| Command Theory    | 30      | 6         | General                        | Iron Weapons      |
| Fortification     | 30      | 6         | Castle                         |                   |
| Advanced Infantry | 26      | 7         | Scout, Pikeman                 | Iron Weapons      |
| Prospecting       | 30      | 8         | Quarry                         | Field Engineering |
| Siege Engineering | 34      | 9         | Ballista                       | Iron Weapons      |
| Veteran Doctrine  | 34      | 10        | Paying TP to promote a veteran | Iron Weapons      |

A lab built on wave 3 or 4 finishes Iron Weapons around wave 6. Later projects open academies, settlements and the champions' halls; the Research tab of the encyclopedia lists all of them.

---

## The enemy

**Sectors.** The host enters from the top edge only, in three sectors: left, centre and right. At night the top edge shows which sectors the next wave will use, with a rough head count and a skull if a warlord is coming.

**The muster.** Enemies arrive in squads and form up near the top before they advance. Your hunting soldiers wait for a squad to leave that ground, so the fight happens in the open field and your line keeps its shape.

**Factions.** One faction leads each wave and fights its own way. The night preview names it, and the Enemies tab of the encyclopedia gives its tactic and what beats it.

**War camps.** Camps go up along the top edge. A camp still standing when the next wave forms makes that wave stronger. Destroy it and the bonus is gone. Soldiers sent that far north are not holding your line.

**Warlords.** Every tenth wave is led by a named warlord with a pack of his own. There are ten. After the tenth the first returns, stronger. Each changes at half health; the Bosses tab says how.

**Status marks.** Small badges over a unit show what is acting on it (pinned, burning, hexed, under a banner, and so on). The Status marks tab of the encyclopedia draws each one beside its meaning.

---

## Breaches and line-breakers

An enemy that crosses the bottom edge is a **breach**. The count sits at the top of the screen. Reach the limit and the run is over.

| Difficulty | Breach limit |
| ---------- | ------------ |
| Baby       | 14           |
| Normal     | 10           |
| Chad       | 8            |
| Hellbane   | 6            |

From wave 3 some enemies carry a red pennant. These **line-breakers** ignore your soldiers and run for the line. They are 30% faster than the rest and have a little less health.

- Cavalry and Scouts hit them 60% harder. Hunting soldiers go for them first.
- A Wall holds up to three a wave.
- Enemies also go for the line when nobody is left to fight them, or when a standoff drags on.
- Each breach shakes the morale of every soldier. With one breach left, the edges of the screen stay red.
- The Second Wall edict and two ribbons raise the limit.

---

## Wave preview and the watchtower

Each night the top of the screen shows the next wave in rough terms. With a Watchtower standing, or a Scout Report from the spy, it lists the wave by type and number.

---

## Counters and rear attacks

| Troop                  | Strong against                  | Weak against     |
| ---------------------- | ------------------------------- | ---------------- |
| Pikeman                | Riders                          | Arrows and magic |
| Cavalry, Knight, Scout | Archers and casters             |                  |
| Archer                 | Goblins and rats                | Armour           |
| Crossbowman            | Armour and siege engines        | Swarms           |
| Mage, Ballista         | Armour                          |                  |
| Sapper                 | Armour, shields, packed enemies | Flyers           |
| Footman                | Berserkers                      |                  |

Enemy riders hit archers, mages, healers and bards harder, and pikemen take less from them. Any blow from behind lands 25% harder, for both sides.

---

## The Sapper

The Sapper is a field engineer and needs Iron Weapons.

- **At night** he buries 2 mines in front of his post, up to 4 live at once. A mine deals 80 damage to enemies within 46, and 25% more to line-breakers. With a Sapper selected at night, Shift+click re-sites a mine.
- **By day** he lobs a satchel charge up to 110 away every 5 seconds. It deals 46 damage within 40.
- Blasts ignore armour, shields and braced lines. They cannot reach flyers.
- A veteran Sapper buries one more mine and fuses faster.
- Up close he has only a knife. He backs away from a brawl and dies if caught alone.

---

## The General's orders

The General needs Command Theory, costs 12 TP and is one of a kind. Every enemy on the field goes for him. With him on the field, by day:

| Order         | Key | Effect on soldiers within 190 of him               | Ready again |
| ------------- | --- | -------------------------------------------------- | ----------- |
| War Cry       | `[` | Strike 20% harder for 8 seconds, and regain morale | 45 seconds  |
| Hold the Line | `]` | Take 40% less damage for 7 seconds                 | 60 seconds  |

He also walks to soldiers whose nerve has broken and steadies them. Stationed in a Castle keep, he fills the castle walls with footmen.

---

## Spells

Spells are introduced on wave 6. Pick a spell, then click the map.

| Spell            | Key | TP  | Effect                                                 |
| ---------------- | --- | --- | ------------------------------------------------------ |
| Fireball Barrage | `Q` | 9   | 80 damage in a radius of 60                            |
| Lightning Strike | `W` | 6   | 55 damage in a radius of 50                            |
| Healing Rain     | `E` | 6   | Heals 35 in a radius of 150                            |
| Reinforcements   | `R` | 12  | Two Footmen and an Archer arrive                       |
| Battle Rally     | `T` | 6   | Morale for the whole army; ends routing                |
| Meteor Shower    | `F` | 14  | 110 damage in a radius of 75                           |
| Frost Nova       | `J` | 8   | 35 damage and a slow, radius 90                        |
| Scout Flare      | `K` | 4   | Reveals hidden enemies, radius 220                     |
| Fortify Zone     | `X` | 7   | Soldiers inside take 25% less damage                   |
| Arcane Dispel    | `P` | 5   | Clears burning ground, plague and blight; needs a Mage |

Three more spells belong to one of the champion companies and appear when it is sworn.

---

## Spy and courier

Both are introduced on wave 8, in the right-hand panel. An action on cooldown shows the waves left in place of its price.

**Spy** (acts on the next wave):

| Action               | TP                  | Effect                                                             | Limit              |
| -------------------- | ------------------- | ------------------------------------------------------------------ | ------------------ |
| Scout Report         | 2                   | The night preview lists the next wave by type and number           |                    |
| Deep Infiltration    | 3                   | The first 30% of the next wave arrive at 60% health                |                    |
| Forge Maps           | 3                   | A marked crate lands at dawn: never bait, always TP                |                    |
| Raid War Chest       | 4                   | +6 TP now; 2 more enemies next wave                                | once every 3 waves |
| Steal War Chest      | 4                   | +4 TP; 2 fewer enemies next wave                                   |                    |
| Poison Caches        | 4                   | Next wave has 20% less health                                      |                    |
| Disrupt Supply Lines | 5, +1 every 6 waves | 25% fewer enemies, but 12% tougher and 15% faster                  | once every 3 waves |
| Sabotage Siege       | 5                   | No siege towers or engineers next wave; the host arrives 10 s late |                    |
| Assassinate Captain  | 6                   | No elites next wave (a warlord still comes)                        |                    |

**Courier** (needs a Courier on the field):

| Message                | TP                       | Effect                                                | Limit              |
| ---------------------- | ------------------------ | ----------------------------------------------------- | ------------------ |
| Tax Levy               | 1                        | +5 TP at the next wave clear; every soldier −2 morale | once every 3 waves |
| Open War Chest         | 2                        | +4 TP now                                             | once every 3 waves |
| Royal Decree           | 2                        | +5 morale for every soldier                           |                    |
| Supply Train           | 3                        | Heals every soldier 25                                |                    |
| Request Reinforcements | 4 × upkeep               | 2 Footmen at the next dawn                            | once every 2 waves |
| Medical Evac           | 4                        | The wounded fall back to the med tents                |                    |
| Call the Banner        | 6, +2 per call, × upkeep | 1 Knight at once; needs Iron Weapons                  | once every 4 waves |

Prices and cooldowns live in `data/strikes.json`, `js/units.js` and `js/economy-rules.js`.

---

## Spoils and edicts

Every fifth wave pays spoils. When that wave is cleared the field dims and three rewards appear in the middle of the screen. Nothing else can be clicked or pressed until you take one: `1`, `2`, `3`, or the arrow keys and Enter. The night clock waits.

Most rewards are **edicts**, standing rules that last the rest of the run. The same edict can be taken up to **three times** and adds up each time.

| Edict            | Effect                                                           |
| ---------------- | ---------------------------------------------------------------- |
| Sharpened Steel  | Soldiers deal 10% more damage                                    |
| Hardened Shields | Soldiers take 8% less damage                                     |
| War Levy         | +2 TP for every wave cleared                                     |
| Second Wall      | The breach limit rises by 2                                      |
| Field Surgeons   | Soldiers recover an extra 15% health every nightfall             |
| Steady Hearts    | +10 morale every nightfall; breaches shake soldiers half as much |
| Veterans' Due    | Every kill earns one more point of experience                    |
| Scavengers       | Crates land more often and are never bait                        |
| Caltrops         | Line-breakers move 20% slower                                    |
| Giant Killers    | +20% damage against bosses and elites                            |
| War Chest        | +15 TP at once                                                   |
| Flanking Drill   | Blows from behind land 20% harder still                          |
| Early Horn       | Sounding the horn early pays double                              |

---

## Supply crates

From wave 2, crates land on the field by day. Walk a soldier onto one. It holds TP, bandages for those nearby, or rations that lift morale. From wave 3 about one crate in seven is bait and goblins spring from it. Crates are a quick pickup and never stop the game.

---

## Veterans and morale

**Veterans.** Soldiers earn experience from kills; healers, builders and couriers earn it from their work. There are six ranks, each tougher and deadlier. A soldier who lasts long enough is given a name. The unit panel shows each soldier's kills and waves survived, and when a veteran falls the log says who he was.

**Morale.** Soldiers who watch comrades die lose heart, and a soldier with none left runs. A Bard, a Mess Hall, the General, War Cry and Battle Rally restore it. Every breach shakes the whole line. In waves 1 and 2 the opening garrison wavers but does not desert.

---

## Ribbons

Sixteen ribbons are earned across all your runs and listed on the main menu. Each gives a small permanent bonus. Bonus starting TP from all sources together is capped at +6.

| Ribbon        | Earned by                                   | Bonus                            |
| ------------- | ------------------------------------------- | -------------------------------- |
| First Blood   | Clear wave 1                                | +1 starting TP                   |
| Ten Dawns     | Clear wave 10                               | +2 starting TP                   |
| Quarter Siege | Clear wave 25                               | +3 starting TP                   |
| Half Siege    | Clear wave 50                               | +1 breach limit                  |
| The Hundred   | Clear wave 100                              | +1 TP per cleared wave           |
| Bosskiller    | Slay 5 warlords                             | +10% damage to bosses and elites |
| Unbroken Line | 10 waves in one run without a breach        | +1 breach limit                  |
| Clean Hands   | 5 waves in one run without losing a soldier | 3% less damage taken             |
| Quartermaster | Recover 25 crates                           | Crates land more often           |
| Early Riser   | Sound the horn early 20 times               | +1 TP on every early horn        |
| Old Guard     | Keep one soldier alive for 20 waves         | Kills earn +1 experience         |
| Butcher       | Kill 1,000 enemies                          | +3% damage                       |
| Reaper        | Kill 10,000 enemies                         | +3% damage                       |
| Gatekeeper    | Cut down 100 line-breakers                  | Line-breakers move 10% slower    |
| Council Seat  | Claim 10 spoils                             | +2 starting TP                   |
| Warband Oath  | Clear wave 15 in Warband mode               | 3% less damage taken             |

---

## Run score

The after-action report scores the run:

- +100 for every wave cleared and +5 for every kill
- −40 for every breach and −15 for every soldier lost (never below zero)
- multiplied by the difficulty (see below)
- multiplied again by each Advanced Difficulty modifier: one that adds 18% difficulty multiplies by 1.18, one that removes 12% by 0.88

Your best score on each difficulty is kept in this browser and listed on the main menu beside the ribbons. Creative runs, abandoned runs and runs with a cheat are not scored.

---

## Difficulty

| Difficulty | Start TP | TP per wave | Breach limit | Enemy health | Enemy damage | Enemy numbers | Score |
| ---------- | -------- | ----------- | ------------ | ------------ | ------------ | ------------- | ----- |
| Baby       | 10       | +3          | 14           | 72%          | 75%          | 78%           | ×0.5  |
| Normal     | 7        | 0           | 10           | 100%         | 100%         | 100%          | ×1    |
| Chad       | 5        | −1          | 8            | 130%         | 122%         | 122%          | ×1.5  |
| Hellbane   | 4        | −2          | 6            | 170%         | 148%         | 150%          | ×2    |

On the two harder settings the extra enemies are phased in over the first three waves.

**Advanced Difficulty**, on the main menu, stacks optional modifiers (ally and enemy strength, spawn rate, elite frequency, TP income, morale, breach limit). Each changes the effective difficulty shown on screen and the score multiplier.

---

## Modes

Chosen on the main menu.

| Mode             | What changes                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Campaign         | The standard siege                                                                       |
| Survival Endless | Leaderboard score: wave × difficulty % + kills × 2 + a time bonus                        |
| Roguelike        | Random Advanced Difficulty modifiers each run                                            |
| Warband          | Soldiers cost double and are far tougher (+70% health, +35% damage)                      |
| Timed Blitz      | Half the night                                                                           |
| Seed Run         | Spawns follow a seed you can share                                                       |
| Academy Era      | Starts at wave 100 or later                                                              |
| PvE Horde        | Every wave is a horde                                                                    |
| Async Co-op      | Take turns on one siege with a friend by passing a share code                            |
| PvP Endless      | Same seed, highest score wins; compared by share code                                    |
| Daily, Weekly    | A fixed seed and modifiers for the day or the week                                       |
| Ironman          | A toggle: no saving                                                                      |
| Creative         | A sandbox: free TP, spawn tools, no game over, nothing recorded. `P` opens the lab panel |

There is no live networking. Co-op and PvP work by share codes only.

---

## Champions and companies

Champions are fighters from outside the realm, far stronger than line troops and priced to match. They come in companies. A company is first sworn to your line by completing its trial (listed under Achievements), then a Builder raises its hall, and its fighters are recruited from the **Legion Archive** in the left panel. Each company also has a skill tree there.

Every champion has his own role, trait and weakness. Names, prices and profiles are data (`data/champions.json`, `data/operatives.json`, `data/roster-profiles.json`), and the Champions tab of the encyclopedia renders them from that data, so this manual does not list them.

Two things stay secret until earned: a grand arena with its own roster, and one hero who costs 10,000 TP.

---

## The late siege

Past wave 100 the same field and the same rules continue, with more to build:

- **Academies** train one kind of soldier each round while a veteran of that kind is on the field to teach.
- **Settlements** (Hamlet, Village, Town, City, Metropolis) pay TP every round: a Hamlet pays +5 TP/round. A Merchant Guild beside one adds to it.
- **Loadouts** give the whole army one passive bonus.
- The ten warlords return in order, stronger each time.

---

## Saving

Save from the pause menu: a quick save, or one of three slots. Saves are kept in the browser's local storage on this device, along with ribbons, best scores, achievements and settings. Clearing site data deletes them. Ironman, daily and weekly runs and Creative mode do not save.

---

## Cheats

The cheat menu opens from the main menu or with `` ` `` in a run. Using any code voids that run: no score, no ribbon progress, no achievements, and the after-action report says so. A code entered on the menu voids the next run. The codes are in `js/cheats.js`.

---

## Encyclopedia and achievements

- **Encyclopedia** (`I`): twelve tabs. How to play, Your army, Buildings, Research, Orders, Spoils and edicts, Ribbons and score, Enemies, Bosses, Status marks, Champions, World and lore. The search box looks across all tabs. Nearly every entry is built from the game's data when the panel opens.
- **Achievements** (`A`): tracked across runs, with a tab per area.
- **Bug report** (`F10`) and a performance overlay (`F3`).

---

## Developer notes

### Building and testing

| Task                         | Command                                     |
| ---------------------------- | ------------------------------------------- |
| Install                      | `npm install`                               |
| Play (desktop)               | `npm start`                                 |
| Lint, types, formatting      | `npm run check`                             |
| All tests, with the long sim | `npm run test:all` (5 to 17 minutes)        |
| Tests without the long sim   | `node scripts/run-all-tests.mjs --skip-sim` |
| Honest playtest bot          | `npm run sim:honest`                        |
| Production build to `dist/`  | `npm run build`                             |
| Desktop installer            | `npm run dist`                              |
| Regenerate the key tables    | `node scripts/gen-readme-keys.mjs --write`  |

The build concatenates the scripts in `index.html` order and minifies them. A new `js/*.js` file needs a `<script>` tag in `index.html` at the right point, an entry in `scripts/build-manifest.mjs` (and `scripts/headless-manifest.mjs` if tests need it), and then `npm run gen:eslint-globals`. After editing `data/*.json`, run `node scripts/extract-game-data.mjs`.

### How the code is laid out

- Plain JavaScript, no framework. About 110 script files, loaded in order.
- `js/game.js` is the simulation. Run state is `GS` (`js/game-state.js`); modules reach each other through `svc('Name')`.
- `js/siege-loop.js` holds the loop described in this manual: breaches, line-breakers, spoils, crates, orders, ribbons, score.
- `js/roster.js` holds every role, trait and weakness. `js/hotkeys.js` holds every key.
- `js/encyclopedia.js` builds the reference from those at run time. `js/lore-data.js`, `js/story-lore.js` and `js/narrative-thread.js` hold the story text.
- Content is JSON in `data/`.

### Modding

`mods/manifest.json` lists the mods to load. A mod is a folder with a `mod.json`, optional `units.json` and `buildings.json`, and an optional script that receives `ModAPI`. `mods/example-legion/` is a working example that adds one troop and one building.

### Repo layout

```
index.html      the page; loads js/ in order
js/             the game
css/            style.css and the theme-v2.css HUD layer
data/           units, buildings, enemies, spells, champions, profiles (JSON)
assets/sfx/     recorded music and cues (OGG)
tools/sfx/      how the recordings were made
mods/           mod manifest and an example mod
scripts/        build, tests, simulations, generators
src/            TypeScript sources for the service, event and data cores
electron/       desktop shell
docs/           CHANGELOG.md and the overhaul audit and plan
```

### Licence

`package.json` declares MIT. There is no LICENSE file in the repo yet.
