# Rules for every phase 3 agent

Game: Myth and Blood, a fantasy wave defense in the style of Mud and Blood 2. ONE continuous
top-down field, enemies come from the top, muster, then advance; the player loses when too many
breach the line at the bottom; soldiers die permanently. Plain JS, canvas drawn in code (no image
files), ~110 script files loaded in order by index.html, core in js/game.js (state `GS`,
services via `svc('Name')`), data in data/*.json bundled by `node scripts/extract-game-data.mjs`.
Live on a public web page; played on laptops and phones.

Read first: CLAUDE.md, docs/overhaul/README.md (plan and DECISIONS table), and the audit report
named in your task (docs/overhaul/*.md; it has file:line, which may have drifted).

Hard rules

- Work ONLY in your own git worktree (given in your task). Commit locally. Do NOT push, open a
  PR, switch branches, or touch any other directory under /home/claude except your own scratch
  and screenshot folders.
- About fifteen other agents are editing the same repo on other branches right now. Stay inside
  the files your task says you own. Anywhere else (especially js/game.js, index.html, README.md)
  make the smallest possible local edit and list every such edit exactly in your final message.
- A new js/_.js module needs a `<script>` tag in index.html at the right point, then
  `npm run gen:eslint-globals`, plus scripts/build-manifest.mjs (and scripts/headless-manifest.mjs
  if it must run in tests/sims). After editing data/_.json run `node scripts/extract-game-data.mjs`.
- RESUME.md must never be committed. No real franchise or real people's names in any
  player-visible text. Art is hand-inked horror-comic (bone, blood red, black): style evocation
  only, never copy specific artwork, no sexual content, no likeness of real or franchise characters.
- Do not delete a whole system; rework it. Do not weaken or skip tests to get green.
- Commit messages end with these two lines:
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Q3r8pb6gBDgVtjyrNmAXRY

Verifying

- The machine is heavily loaded. Run `npm run check`, `node scripts/run-all-tests.mjs --skip-sim`,
  your own new tests, and `npm run build`. Do NOT run the long headless sim (`npm run test:all`);
  the coordinator runs it after merging. Timing-threshold failures (e.g. test-wave15-stability
  "max tick") under load: re-run that suite alone once and report.
- Restore rewritten reports before committing: `git checkout -- scripts/*report*.json`.
- Rendering: Electron is installed. Run a harness with
  `xvfb-run -a node_modules/.bin/electron --no-sandbox <script.cjs>` (the script needs
  `app.commandLine.appendSwitch('no-sandbox')` and `disable-gpu`). Example that plays a
  recruiting bot to a wave and screenshots: /tmp/probe2.cjs (env SHOT_REPO, WAVE, AFTER; writes
  /tmp/probe2.png — copy it and change the output path so you do not clash with others). More
  harnesses may exist under /home/claude/audit/. LOOK at every image you render (Read the PNG).
- Bots: `node scripts/sim-honest-play.mjs` (env HONEST_TICKS, HONEST_SEEDS, HONEST_DIFFS).
  Runs are not deterministic per seed; report ranges.

Final message: under 350 words. What you built (one line each), what you saw or measured, what
is unfinished or unverified, test results, every file touched, exact edits outside your files.
Write plainly, no filler.
