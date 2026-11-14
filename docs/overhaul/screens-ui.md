# Myth and Blood: screens and interface audit

Date: 2026-11-13. Repo read-only. Screenshots are in `/home/claude/audit/shots/`, harness in `/home/claude/audit/harness/` (`shot.cjs`, `run.sh`, step files).

## How this was checked

- Rendered in Electron under xvfb at 1600x1000, 1366x768 and 390x844. A recruiting bot played to wave 12. Each PNG was opened and read.
- Counts come from DOM queries in the running game (visible buttons, computed font sizes, computed colours).
- CSS figures come from two checks: a static token search (class/id names against `index.html` and `js/`), and a runtime check (`document.querySelector` for every selector across 17 UI states in one run).

### Not rendered or not verified

- Real touch. Chrome touch emulation hung the harness, so the 390x844 shots are a narrow window driven by script. No real phone, no pinch, no long-press.
- Victory screen, Creative Lab panel, level editor, Grand Coliseum and Legion Archive screens, online/co-op panel, error-recovery overlay, bug-report dialog.
- Anything past wave 12 (academy era, settlements, raid/expedition/planet sections of the right panel, late top-bar chips).
- Sound, and real frame rate. xvfb has no GPU, so the "Slow UI.updateHUD: 1325ms" warning seen once is not evidence about real machines.
- One anomaly not explained: in three bot runs the game state stayed `playing` while the DOM showed a "realm falls" banner or a filled result panel (shot 70). It may be a harness effect. Someone auditing `js/game.js` should check `checkPlayerElimination` (game.js:5809) against the restart path.

---

## 1. Findings that apply everywhere

1. **The HUD is three desktop columns at every size.** There is no phone layout. `css/style.css` has two media queries (2902, 4536) and `theme-v2.css` has one layout query (1018); none of them rearranges the HUD. The only adaptation is a global `--ui-scale` = min(width/1280, height/800), clamped to 0.6 to 1.5 (index.html:26-46). At 390 px that gives a left panel of 82 px, a right panel of 72 px and a 236 px field, with about 190 text nodes at 4 to 6 px.
2. **Text is too small on desktop too.** At 1366x768 (scale 0.96): stat labels 5.8 px, panel notes 5.8 px, costs 8.2 px, button names 9.1 px, tab labels 8.6 px. At 1600x1000 the second top-bar row is 6.3 px.
3. **Seven visual styles are in use.** Each modal has its own title colour and frame: Settings gold on navy, Encyclopedia blue, Achievements gold, Cheats pink, Research light-blue frame, Threat Map orange, Pause white. Tutorial callout is blue with rounded corners. Unit panel uses rounded pills. Only the menu title, Begin Defense, spoils panel and the score block follow the bone/blood/black comic look. Fonts in CSS: Cinzel (91 rules), Source Sans 3, Pirata One, MedievalSharp, Consolas. 388 distinct hex colours in `style.css`.
4. **Native form controls are unstyled.** Checkboxes, range sliders (blue), `<select>` (white system box) and colour inputs show the browser default in Settings, Advanced Difficulty, Achievements and the menu (shots 07, 42, 45).
5. **The `hidden` attribute does not hide things.** Author rules like `.menu-btn{display:block}` (style.css:1675) and `.pause-quicksave-thumb{display:block}` (style.css:4570) beat it. Visible results: a broken-image icon with alt text in the pause menu (index.html:1470-1475), and HAND OFF KINGDOM shown in a solo campaign (index.html:1489). `theme-v2.css:1597` already patches one case by hand.
6. **Three prices for one recruit.** The button shows the base cost (ui.js:972-980). The tooltip shows base x `getDeployCostMult` (tooltips.js:120-121). The game charges base x the siege upkeep multiplier (siege-loop.js:478-480). Seen at wave 10: Footman button "3", banner "Footman ready (5 TP)"; Healer button "5", banner "(8 TP)"; Archer tooltip "4 TP" with "Recruit cost +91%" on screen. The affordability dimming (ui.js:997) also uses the base cost, so a button can look affordable when it is not.
7. **Screens taller than the window.** Main menu 1943 px of content in a 972 px scroller, inside a second scroller (two scrollbars side by side, shot 01). Pause menu 1625 px: RESUME sits at y=835 and seven more buttons are below the fold (shot 36). Game over 1243 px: FIGHT AGAIN is below the fold (shot 54).
8. **Fonts load from Google at run time** (`@import` at style.css:1 and theme-v2.css:6). The desktop app offline, or a slow phone connection, falls back to a system serif.

---

## 2. Screen by screen

Sizes: S = under a day, M = a few days, L = a week or more.

### 2.1 Main menu (shots 01, 02, 04, 46)

**What is on it.** Title, 4 difficulty buttons, Advanced Difficulty, 10 game-mode buttons, mode description, Ironman checkbox, 5 path presets, Daily and Weekly challenge cards, BEGIN DEFENSE, Creative Mode, How to Play, Tutorial, a "Recommended starts" box with 4 seed cards and a guided-run checkbox, title art, four collapsed sections (Legacies, Ribbons, Best Scores, Share Codes), Achievements, Encyclopedia, Settings, Cheats, and a gear button top right.

**Controls.** 75 visible buttons before any section is opened.

**Problems seen.**

- BEGIN DEFENSE is at y=770 of 1000, below 27 other controls. The title art is below the fold.
- Two vertical scrollbars: `.menu-content` and `#menu-screen` both scroll.
- The HUD is drawn behind the menu, dimmed, with every panel readable (shot 01).
- Mode buttons are 8 to 9 px text; difficulty buttons are small next to a large Advanced Difficulty button.
- Settings appears twice (gear top right and button near the bottom).
- "Path preset (jump-in)", "Daily/Weekly", "Recommended starts" and "Game mode" all change how a run starts and can contradict each other. The selected start ("Steady Campaign, onboard-steady-v1") is printed in small blue text.
- CHEATS is a full-width button on the main menu.
- HOW TO PLAY toggles a 1500 px text block further down the page without scrolling to it, so the click appears to do nothing (shot 05; ui.js:409-411).
- The How to Play text is out of date: "+8, scaling" TP (README says +7); "Fixed battlefield ... no territory expansion" while the Campaign description on the same page says "Land expands on all sides every 10 waves" (shot 46).

**Redesign (M).** One screen, no scrolling: title art as background, then PLAY (continues with last settings), a single line showing "Normal, Campaign" with a Change button, and a row of four small links: Records, Codex, Settings, How to play. Everything else moves to a "New run" sheet (difficulty, mode, seed, Ironman, daily/weekly) and a "Records" sheet (legacies, ribbons, scores, achievements). Cheats moves into Settings. Do not draw the HUD behind the menu.

### 2.2 Advanced Difficulty (shot 06)

**What.** Effective-difficulty table, 12 presets, a list of modifier checkboxes. 59 controls.
**Problems.** The modifier list is a 310 px scroller inside the modal, showing 8 of about 45 rows. Presets are 8 px text. Paired rows ("Ally HP +15%" / "Ally HP -15%") can both be ticked; conflict styling exists in CSS but was not seen.
**Redesign (S).** Make the list fill the modal height; turn each +/- pair into one three-state control.

### 2.3 Settings (shots 07, 40 to 45, 52)

**What.** Seven tabs: Display, Audio, Accessibility, Gameplay, Privacy, Mods, Cosmetics. 62 controls.
**Problems.**

- Tabs wrap to two rows with Cosmetics alone on the second.
- Native controls throughout (finding 4).
- Gameplay, Privacy and Cosmetics tabs scroll inside the modal (1103 to 1356 px in 876 px); Reset and Close scroll away with the content.
- Opened from the HUD gear during play, closing Settings lands in the pause menu, not back in the game (settings.js:510-516 sets `returnToPause = true` whenever the game was running).
- "UI scale: Auto 125%" at 1600x1000 still produces 6 to 12 px HUD text, so the scale control does not solve legibility.
  **Redesign (M).** Style the controls once (checkbox, slider, select) in theme-v2. Pin the tab row and the Close button. Merge Mods and Privacy into "System". Closing returns to wherever it was opened from.

### 2.4 Encyclopedia (shot 11)

**What.** Search box, 35 category tabs, entry list. Opens with I.
**Problems.** The 35 tabs wrap to seven rows and take 230 px; the entry list gets 320 px and shows two entries. Faction names nobody has met yet are listed as tabs. Locked text is drawn as a grey bar with "Unlock: Reach wave 10" in 7 px italics.
**Redesign (M).** Left column of 6 groups (Army, Enemies, Buildings, Spells, Systems, Lore) with sub-lists; entries on the right at full height. Hide groups with nothing unlocked.

### 2.5 Achievements (shot 12)

**What.** Counter, progress bar, search, tier filter, "Unlocked only", 12 category tabs, list.
**Problems.** Header says "1 / 1450" and the line below says "Showing 880 achievement(s)" with all filters off. Locked rows are near-black text on black. The toast fires constantly in play: 39 unlocked by wave 10 in a bot run, each covering the minimap for several seconds (shots 24, 31).
**Redesign (S).** Fix the count. Batch toasts into one line per wave ("5 achievements, view"). Raise locked-row contrast.

### 2.6 Cheats (shot 13)

Small pink-titled modal. The result line under the input reads "Enter a cheat code below." while the input is above it. **S**: fix the text, restyle to the common modal.

### 2.7 Tutorial and teaching (shots 20, 47, 48)

**What.** Five separate teaching systems run at once:

1. "Recommended starts" box on the menu (`js/onboarding.js`).
2. Tutorial callouts, 30 steps (`js/ux.js:44`), a blue rounded box with Next tip / Dismiss.
3. Staged introduction, 7 one-line prompts in waves 1 to 8 (`js/siege-loop.js:270-305`).
4. Hint bar along the bottom (key reminders).
5. Night-prep card tip ("Deploy a Builder to fortify").
   Plus the How to Play text block.

**Problems.**

- The TUTORIAL button starts an ordinary run with system 2 switched on. There is no scripted lesson.
- During the staged introduction the Spells tab and the whole right panel are dimmed to about 30% but still take their full width, and nothing says why or when they open (theme-v2.css:1581-1593). The task brief says these parts are hidden; they are dimmed, and they light up on hover.
- In the tutorial run a blue outline box is drawn around the top bar and field, and a blue line runs down the left edge of the field (shots 47, 50).
- The first-wave banner "WAVE 1 / HOLD THE LINE" overlaps the "FROM THE NORTH" strip and the tutorial box overlaps both.
- The bottom message box showed "Host levels up: Threat Level 1: Grunt Host. Filler swarms..." as the first thing a new player reads (shot 20).

**Redesign (M).** Keep one system: the staged introduction. Its line appears in one fixed place (above the action bar), and locked parts are absent, with a single "Unlocks at wave 6" stub where they will appear. Remove the tutorial callout box and the Tutorial button; fold "Recommended starts" into the New run sheet.

### 2.8 HUD: top bar (shots 20, 23, 24)

**What.** Row 1: TP (with bar), Army, TP/round, Wave (with bar), Strength meter, Cycle (Day/Night, timer, Begin Day button), Kingdom banner block, then Speed, Hunt, pause, settings, sound, threat map, encyclopedia, achievements, perf. From about wave 9 a second row appears: Import, Path, DNA, Crown, Pacing, Command, Threat, Host, Intel, Diff. Below that, chips over the field: Breaches, next-wave text, Spoils, Recruit cost.

**Controls.** 9 or 10 buttons and 17 stat groups at wave 10.

**Problems.**

- Row 2 is 6.3 px labels over 11 px values with text such as "LONGBOW 98 · w10", "1x · 47 queued", "KINGDOM 36 · HUNT·DO..." (cut off). None of it is needed to play a wave. It overlaps the top of the field and the first enemy labels (shot 23).
- BEGIN DAY, the main action of every night, is an 8 px button tucked inside the Cycle group (shot 24). SPEED and HUNT are four times larger.
- The night-prep card drops over row 2 and the Kingdom block (shot 24).
- "Strength I 0.50x" and "You hold macro · Cmd 27 vs Lv1" (7.5 px) are unexplained.
- Icon buttons use emoji (gear, speaker, map, book, trophy, chart), which clash with the inked look and render differently per platform. Four have no accessible name.
- The breach count, which decides defeat, is a small chip at the left edge.

**Redesign (M).** One row, five items, each at least 16 px: TP (+income), Wave, Breaches n/limit as pips, Army, Day/Night with timer. Right side: pause, speed, menu. Everything in row 2 moves to a "War room" sheet opened from the menu button. Begin Day becomes the large primary button in the action bar (see section 9).

### 2.9 HUD: left panel (shots 24, 25, 27, 31)

**What.** Four tab buttons (Troops, Build, Spells, More) over one long scroll: Troops (13), Specialists (2), Build (22 including Research), Academies (14), Spells (10), Kingdom Doctrines (4), Orders and Factions (7).

**Controls.** 72 buttons at wave 10; 37 in view at once; 40 of the 72 disabled.

**Problems.**

- The tabs do not switch content. The code keeps every section visible and scrolls to it (ui.js:139-150, comment: "nothing is hidden"). The list is 1864 px in a 949 px window.
- The highlighted tab is often wrong. After clicking Build, Spells was highlighted (shot 25). The IntersectionObserver callback picks the best of only the entries that changed in that callback (ui.js:180-194).
- More than half the panel is locked items shown dimmed with a small padlock glyph and no reason: Castle, Hamlet 100, Village 180, Town 280, City 420, Metropolis 600, 14 academies. The reason exists only in a hover tooltip.
- Costs are dark red 8 px numbers; on disabled buttons their contrast is 2.6:1.
- Build buttons have no icons while troop and spell buttons do.
- "RESEARCH (0.0 SP)" is a blue-bordered button in the middle of the build grid.
- Two-line notes at 5.8 px ("Settlements: research-gated tiers 5-10...").
- DEMOLISH, MOVE, ROTATE, CLEAR SEL, REPAIR sit at the very bottom of the scroll, about 1800 px down.

**Redesign (L).** Replace with a bottom action bar (section 9). Real tabs: Recruit, Build, Spells. Show only what can be bought or will unlock next; one "Next unlock: Knight, needs Iron Weapons" row replaces the dim grid. Building tools (move, demolish, rotate) appear when a building is selected.

### 2.10 HUD: right panel (shots 23, 30, 31)

**What.** Tabs Spy, Mail, Ops over one list: Spy Network (13), Courier Msgs (12), Planet Event (from wave 12), Faction Intel with Threat Map button.

**Controls.** 29 buttons; 13 disabled at wave 10.

**Problems.**

- Content is 949 px in a 949 px window, so the three tabs scroll nowhere. Clicking Mail or Ops only moves the highlight (shots 30, 31).
- Button labels are cut: "Disrupt Li...", "Scout Rep...", "Poison Ca...", "Settleme...", "Counter-...".
- All 12 courier buttons were dim at wave 10 with no visible reason (a courier unit must be on the field; said only in a 5.8 px note that is itself cut off with "...").
- "War Chest" appears in both Spy and Courier with different prices (4 and 2).
- Rule: one spy action and one message per wave. 25 permanent buttons for two clicks per wave.

**Redesign (M).** Remove the panel. Add one "Intrigue" button to the action bar that opens a sheet at night: left column spy actions, right column messages, each with a one-line effect and the real price, and a badge showing "1 action left".

### 2.11 Field overlays (shots 22, 23, 24)

**What.** Wave banner, boss name card, floating damage and rank text, breach/next-wave/spoils/upkeep chips, message box, hint bar, minimap, night-prep card, spoils panel.

**Problems.**

- The field is a 545 px wide portrait strip in a 1280 px gap between the panels; over half the centre is empty dark margin at 1600 px.
- Text piles up: "COUNTER: RANGED DEATHBALL" over "FROM THE NORTH" over the wave banner; "6 KILL STREAK", "SILVER", "CRIT", damage numbers stacked on one spot (shots 22, 23). `floatingText.js` caps the count at 96 but does not space or merge.
- The boss card "Gorath the Breaker" is a full-width band across the middle of the fight (shot 23).
- The spoils panel covers the lower third of the field, the unit panel's right edge and the message log (shots 33, 35), while the night timer keeps running.
- The hint bar ("Iron Crown · Drag empty map to select · Shift+drag · G formation...") is 9.6 px at 4.0:1 contrast and mostly lists keys.
- The message box is the same control for tutorial lines, combat events, errors and flavour text.

**Redesign (M).** Let the field fill the area between top bar and action bar. One banner slot at the top centre with a queue (wave, boss, streak share it). Merge floating numbers per unit per half second. Spoils becomes a centred modal that pauses the night timer.

### 2.12 Unit info panel (shot 33) and tooltip (shot 34)

**Unit panel.** Name, rank, HP and morale bars, five stat pills, "Tenure and combat pace" with two bars and four lines of 6 px text, traits, weakness, perks, three buttons (Hold Position, Focus, Deselect). It opens at the lower left over the field margin. Rounded pills and thin bars differ from the rest of the HUD. About 20 text lines, most under 8 px. **S/M**: keep name, HP, morale, three stats, one trait line; move tenure maths to the codex.

**Tooltip.** Title, description, a damage-preview line ("vs Goblin W10: 32-41 dmg · 2 hits to kill"), price. Readable (13 px). Price is wrong (finding 6). Touch: long-press 420 ms (tooltips.js:641-652). The `title` attribute is also set on 116 HUD elements, so desktop players get two tooltips. The tooltip stayed above the pause menu in the scripted run (shot 36); the script sent no mouse-leave, so treat as unconfirmed.

### 2.13 Message log (shot 35)

Opens with Tab or the scroll icon. It opened behind the spoils panel with only its title bar and one row showing. **S**: give it a fixed side sheet above other overlays.

### 2.14 Night phase (shots 22, 24)

**What.** Night-prep card (timer, chips "Humble / Lighter host / North approach / Boss", one tip), next-wave chip, spoils panel every fifth wave, Begin Day button, D key.
**Problems.** Three places describe the next wave (card chips, the "Wave 11: about 26 foes..." chip, the Intel stat in row 2). The card sits on top of the top bar. The night-prep timer text and the Begin Day button both show the countdown. The chip words "Humble" and "Lighter host" are internal terms.
**Redesign (S/M).** One "Next wave" card: count, 3 enemy icons, direction, boss. One large BEGIN DAY button with the countdown inside it.

### 2.15 Pause menu (shots 36, 53)

**What.** 13 stat tiles, quick-save preview, recommended path, 7 main buttons, Encyclopedia / Settings / Report Bug, 3 save slots, Perf Monitor, shortcut list. 11 buttons plus slots.
**Problems.**

- 1625 px tall; RESUME is under nine rows of statistics.
- Broken image in the quick-save box (finding 5).
- "Next wave" tile reads "Kingdom 198 (Humble 0.50x, -28% host) · Kingdom 173 (...) · Kingdom 156 (...) ·".
- Save slots cannot be used. An empty slot renders only "Slot n / Empty" with no Save button (save.js:151-153); the Save button exists only on slots that already hold a save. `saveToSlot` has no other caller.
- Deleting a slot has no confirmation (save.js:191-193).
- The shortcut list says "] Cycle speed", which does not work (section 5).
- HAND OFF KINGDOM shows in solo play.
  **Redesign (S/M).** Order: Resume, Save, Load, Restart wave, Settings, Quit to menu, in one column that fits 600 px. Stats and shortcuts go behind "Run details" and "Controls".

### 2.16 Research (shot 50) and Threat Map (shot 51)

**Research.** Light-blue framed modal. A "Giant branching tech" box is 35 px tall with its own scrollbar; the project list has a second scrollbar; three large stacked buttons (Cancel Project, Cancel Branch, Close) take 230 px. Lock reasons are present here ("Wave 8+ · Iron Weapons") in 7 px orange. **M**: one scroller, a tree or two-column list, cancel buttons inline on the active project.
**Threat Map.** Orange-framed modal: sector bars, five faction rows, four of them "Not yet active", including "Mirror Empires, awakens wave 200". **S**: show only active factions plus the next one.

### 2.17 Game over (shots 54, 55)

**What.** Crest, DEFEAT, eight stat tiles, Key Moments, score breakdown, "The siege in brief", the fallen, FIGHT AGAIN.
**Problems.**

- 1243 px tall in a 365 px wide card; the one button is below the fold.
- One button only. No way to the main menu, no change of difficulty or mode (ui.js:420-436 restarts at once).
- Two styles in one card: gold/blue rounded tiles on top, red blackletter score block below.
- Same facts twice ("Losses 15" tile and "Soldiers lost: 15 x 15 = -225").
- Key Moments lists system events ("Evolving Host: Grunt Host", "The Ancient Crown: the Ancient Crown").
- The result title element defaults to "VICTORY" in the HTML (index.html:2428).
  **Redesign (M).** Wide card that fits one screen: left, score with its breakdown and best; right, the fallen (the strongest part). Buttons: Fight again, Change setup, Main menu.

### 2.18 Phone, 390x844 (shots 60 to 67)

- Menu: usable; title wraps to two lines; difficulty buttons are 5 px text; BEGIN DEFENSE is two screens down.
- HUD: unusable. 134 buttons on screen, 124 smaller than 44x44 (tabs 38x16, troop buttons 32x29). Field 236 px wide, and at night the prep card, breach chips, next-wave chip and spoils panel cover nearly all of it (shot 63). The spoils panel is wider than the field and overlaps both side panels.
- Unit panel opens under the spoils panel (shot 64).
- Pause: RESUME is about three screens down (shot 65).
- Top-bar icon row wraps into the field.

---

## 3. CSS: how much of `style.css` is dead or overridden

| Measure                                                               | style.css                | theme-v2.css          |
| --------------------------------------------------------------------- | ------------------------ | --------------------- |
| Lines / rules / selectors                                             | 5,876 / 936 / 1,047      | 1,599 / 182 / 223     |
| Class or id names never found in `index.html` or `js/`                | 22 names, 28 whole rules | 1 (`#game-container`) |
| Selectors that matched nothing in a wave 1-12 run across 17 UI states | 360 (34%)                | 35 (16%)              |
| Same selector also declared in theme-v2                               | 106 (10%)                | n/a                   |
| Declarations re-declared by theme-v2 on the same selector             | 470 of 3,792 (12%)       | n/a                   |
| `!important`                                                          | 31                       | 7                     |
| Distinct hex colours                                                  | 388                      | 84                    |
| `font-size` declarations                                              | 317                      | 49                    |

Reading:

- Provably dead by name: about 3% of rules (`diff-baby/chad/doomslayer`, `night-chip-*`, `skill-node-*`, `strength-tier-*`, `tier-bronze/silver/gold`, `intel-card-dormant/eliminated`). Some of these look like live bugs: the night chips and difficulty colours are styled under names the JS never sets.
- The 34% unmatched figure is an upper bound. It includes late-game, creative, online and victory states that were not reached.
- `body.ui-v2` is added unconditionally at start-up (ui.js:220), so every pre-v2 rule that theme-v2 overrides is dead weight: about 470 declarations.
- theme-v2 overrides all the main HUD pieces (`#left-panel`, `#top-bar`, `.deploy-btn`, `.build-btn`, `.menu-btn`, `.panel-header`...). The modals (settings, encyclopedia, achievements, research, pause stats, game-over tiles) are still styled only by `style.css`, which is why they look different.
- `.side-tab-pane[hidden] { display: grid !important }` (theme-v2.css:1042) is what stops the tabs from ever hiding a pane.

Estimate: 15 to 20% of `style.css` can be deleted today without visible change; after a restyle of the modals, 60% or more.

---

## 4. `alert`, `confirm`, `prompt`

| Where                  | Call                                  | When                                                                                   |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| js/wwe.js:109          | `alert(...)`                          | Clicking the locked GRAND COLISEUM button in the left panel. Reachable in normal play. |
| js/creative.js:405     | `prompt('Scenario name:')`            | Creative Lab, export scenario.                                                         |
| js/level-editor.js:434 | `confirm('Delete this saved level?')` | Level editor.                                                                          |

None in the audited UI files. Destructive actions with no confirmation at all: delete save slot (save.js:191), Main Menu from pause, Restart Wave, Reset to defaults in Settings (not traced).

---

## 5. Keyboard

Handler: js/main.js:502-678. Maps: main.js:15-58.

| Key               | Action                                     | Note                                               |
| ----------------- | ------------------------------------------ | -------------------------------------------------- |
| 1-9, 0            | Recruit (0 = General)                      | Crossbow, Scout, Bard, Ballista, Pikeman have none |
| Q W E R T F J K X | Spells                                     |                                                    |
| ; ' P             | Fire breath, ice form, dispel              | Not in README                                      |
| O L C N M Y B G U | Buildings                                  |                                                    |
| Space             | Pause / resume                             |                                                    |
| Esc               | Close panel, cancel order, else pause menu |                                                    |
| Tab               | Message log                                |                                                    |
| D                 | Begin day (night only)                     |                                                    |
| H                 | Hunt                                       |                                                    |
| [ ]               | General's orders                           |                                                    |
| A / I / `         | Achievements / Encyclopedia / Cheats       | Also fire on the main menu                         |
| V                 | Mute                                       |                                                    |
| Z                 | Loadout "balanced"                         | Not documented                                     |
| F3 / F10          | Perf overlay / bug report                  |                                                    |
| Arrows            | Pan                                        |                                                    |
| Alt+1-5           | Formations                                 |                                                    |

**Conflicts and dead keys.**

- `]` never changes speed. main.js:519-522 sends `[` and `]` to General's orders and returns; the speed code at main.js:647-650 is unreachable. README and the pause shortcut list both say `]` cycles speed.
- `V` is mapped to the `fus_ro_dah` spell (main.js:33) but the mute handler returns first (main.js:665-672).
- `U` selects Merchant Guild and also calls `upgradeSelectedVeteran` in the same press (main.js:674-675).
- `P` toggles the Creative panel and selects Dispel in the same press (main.js:659-663, 673).
- `R` is Reinforcements, and wall rotation while placing a wall. `C`, `G`, `F`, `B` change meaning with a selection (documented).
- No modifier check on most keys: Ctrl+R, Ctrl+W, Ctrl+A also trigger game actions.
- Esc has four independent listeners (main.js, research.js:1223, error-reporting.js:857). With Research open, Esc closes it and main.js then opens the pause menu. Achievements, Cheats, Advanced Difficulty are not in the Esc chain at all (main.js:535-551).
- No keyboard path through the side panels: no arrow navigation, and no visible focus style beyond three `:focus` rules in all CSS.

---

## 6. Touch and phone width

Works (by code reading, not on a device):

- Tap handling with a 16 px slop and double-fire guard (touch-input.js).
- Canvas pan, pinch zoom, hold to cancel an order (main.js:380-470).
- Long-press tooltips (tooltips.js:641).
- `viewport-fit=cover` meta; `touch-action` set on canvas and panels.
- A "Larger touch hitboxes" setting and `body.touch-device` rules exist.

Breaks:

- Layout (finding 1). 124 of 134 targets under 44 px; text 4 to 6 px.
- `100vh` is used for heights (style.css:180, 1579, 3803), which hides the bottom of the screen under mobile browser bars. No `dvh`, no safe-area insets in the HUD.
- Every hotkey-only action has no touch equivalent in view: Begin Day is the 8 px button; General's orders, formation presets, wall rotate while placing, back-to-posts.
- Shift+click to place several units has no touch version.
- Hover-only lock reasons are behind a 420 ms long-press that is likely followed by the tap firing on release (touch-input.js:onPointerUp does not know about the tooltip timer). Unverified.
- The hint bar text is all keyboard and mouse wording on touch.
- No landscape handling; no orientation prompt.

---

## 7. Accessibility basics

- **Contrast** (computed): disabled costs 2.6:1; stat labels, panel notes, hint bar 4.0-4.1:1 at 5.8 to 9.6 px; disabled names 5.8:1 via 0.32 opacity. Active names and values are fine (15:1 and up).
- **Size**: see finding 2. The Font scale and UI scale settings multiply everything, panels included, so raising them shrinks the field.
- **Colour-only signals**: cost in red whether affordable or not; affordability shown by dimming only; faction dots (green/orange/purple); elite enemies "glow purple"; breach-runners marked by a red pennant; strength meter colour. A colour-blind mode select exists in Settings; what it changes was not verified.
- **Names**: four icon buttons have emoji content and only a `title`. The canvas has no label. Tabs carry `role="tab"` and `aria-selected` but do not switch panels, which misreports them.
- **Live regions**: message box, night card and an `sr-live-region` exist. Good base.
- **Motion**: a Reduced motion setting and one `prefers-reduced-motion` block (theme-v2.css:1546). Screen shake, hit-stop and gore have their own toggles.
- **Focus**: three focus rules in total; keyboard focus is invisible on most controls.

---

## 8. Missing motion and feedback

Present: 0.14 s colour transitions on HUD buttons, selected state, click sound, floating numbers, wave banner, achievement toast, confetti on victory.

Missing:

- No pressed (`:active`) state on HUD buttons (three `:active` rules in all CSS).
- No feedback when a click fails for lack of TP: the button is just dim. No shake, no "need 2 more TP" at the cursor.
- No TP change animation: the number swaps. Income at wave end is a small "+7 TP" on the field.
- Day/night change has a sky tint but no HUD transition; the night card appears instantly over the top bar.
- Modals appear and vanish with no transition and different backdrops.
- Tabs: smooth scroll, then the wrong tab lights up.
- Breach: the counter chip changes text; no flash on the edge that was breached, no pulse on the counter.
- Unlocks during the introduction: a text line only; the newly opened panel just stops being dim.
- No placement ghost was seen for an armed recruit in the screenshots (banner text only: "Footman ready, click map"). Not verified with a moving cursor.
- Spoils cards have no hover or chosen state visible.
- One banner slot is shared without a queue, so messages replace each other mid-read.

---

## 9. Proposed layouts

### HUD

- **Top strip, one row, 44 px.** Left to right: TP with "+7" income beside it; Wave number; Breaches as pips (filled = conceded); Army count; Day/Night icon with countdown. Right end: speed, pause, menu. All text 16 px or larger. Nothing else.
- **Field.** Fills everything between the top strip and the bottom bar, full width. No side panels.
- **Banner slot.** Top centre of the field, one line, queued: wave start, boss name, streaks, introduction lines. Bone text on a black inked plate with a red rule.
- **Bottom action bar, about 96 px.** Three real tabs on its left edge: Recruit, Build, Spells. The bar shows one row of large cards (icon, name, real price) for the active tab, scrolling sideways. Only purchasable items and the next unlock appear. Number keys 1-9 map to the visible cards in order.
- **Primary button, bottom right.** At night: BEGIN DAY with the countdown inside. By day: HUNT on/off. This is the largest control on screen.
- **Selection card, bottom left above the bar.** Appears only with a selection: portrait, HP, morale, three stats, Hold / Back to post / Focus. With a building selected it shows Move, Rotate, Demolish.
- **Night sheet.** At night a "Next wave" card sits top right (count, enemy icons, direction, boss). An Intrigue button on the bar opens spy and courier actions as a sheet, with "1 action left" badges.
- **Minimap.** Bottom right above the primary button, hidden on phones until the map is larger than the screen.
- **War room.** Menu button opens a sheet with everything now in top-bar row 2, kingdom, factions, research, threat map, log.
- **Phone.** Same structure. The bar is 2 rows tall, cards 64 px, tabs along the bottom edge, selection card as a bottom sheet. Portrait field matches the game's portrait map.

### Main menu

- Full-screen title art (the red moon keep) with the logo top centre.
- Centre column, three buttons: CONTINUE (if a save exists), NEW SIEGE, and beneath them one line "Normal · Campaign" with Change.
- NEW SIEGE opens one sheet: difficulty (4), mode (list with one-line descriptions), Advanced (modifiers, seed, Ironman, path preset), Daily and Weekly as two cards at the top. First-time players skip this sheet and start on Normal Campaign with the staged introduction.
- Bottom row of four text links: Records (scores, ribbons, legacies, achievements), Codex, Settings, How to play.
- No HUD behind the menu. No scrolling at 1280x720 or 390x844.

---

## 10. The 12 highest-value changes, in order

1. **Show the real price everywhere.** One cost function used by the button, the tooltip, the dimming and the charge (ui.js:972-997, tooltips.js:120, siege-loop.js:478). S.
2. **Make Begin Day the biggest button on screen**, with the countdown in it, and give Hunt the same slot by day. S.
3. **Replace the two side panels with a bottom action bar and real tabs.** Removes about 100 always-visible buttons, gives the field the full width, and is the only route to a usable phone layout. L.
4. **Show only what can be used; replace dim locked grids with one "next unlock" line** that states the requirement. Apply the same to the staged introduction: hide, do not dim. M.
5. **Cut the top bar to one row of five readable numbers**; move row 2 into a War room sheet; make breaches prominent. M.
6. **Set a 12 px floor for all text and 44 px for all touch targets**; stop using global scale as the only responsive tool (index.html:26-46). M.
7. **One modal style.** Shared frame, title, close position, backdrop and styled form controls for Settings, Codex, Achievements, Research, Threat Map, Cheats, Pause, Game over. Add `[hidden]{display:none!important}`. M.
8. **Rebuild the main menu around one Play button** on a single screen; move setup into a New Siege sheet. M.
9. **Pause and game over fit one screen.** Resume first; game over gets Fight again, Change setup, Main menu. Fix save slots so an empty slot can be saved to (save.js:151) and deletes ask first. S/M.
10. **One teaching system.** Keep the staged introduction; remove the tutorial callouts, the Tutorial button and the How to Play text block (or rewrite it; it contradicts the game). M.
11. **Fix the keys.** Restore a speed key, remove the dead `V` spell binding, stop `U` and `P` doing two things, ignore keys when Ctrl/Meta is held, route Esc through one handler (main.js:502-678). S.
12. **Feedback pass.** Pressed states, "need N more TP" on failed clicks, queued banner slot, merged floating numbers, breach flash, one-line achievement batching, modal transitions. M.

Smaller fixes worth doing alongside: tab highlight bug (ui.js:180-194), Settings returning to pause (settings.js:510-516), achievements 1450 vs 880 count, the `alert` on the locked Coliseum button (wwe.js:109), bundling the fonts, the dead CSS names in section 3.
