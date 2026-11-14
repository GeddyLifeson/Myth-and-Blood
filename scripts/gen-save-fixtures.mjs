#!/usr/bin/env node
/**
 * Builds the save fixtures under scripts/fixtures/saves/ by playing the honest bot headlessly
 * and exporting at chosen points. The committed fixtures were made from older builds (save
 * format 1 and 2) and must keep loading; scripts/test-save-fixtures.mjs checks that.
 *
 * Usage: node scripts/gen-save-fixtures.mjs <tag> [repoRoot]
 *   tag       file-name prefix, e.g. "v2"
 *   repoRoot  a checkout to play (defaults to this one); lets an old commit make old saves
 * Do not regenerate the committed v1/v2 files from a newer build: they would stop being old.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const tag = process.argv[2] || 'dev';
const root = resolve(process.argv[3] || join(HERE, '..'));
const OUT = join(HERE, 'fixtures', 'saves');
const { JS, HEADLESS_FILES } = await import(
  pathToFileURL(join(root, 'scripts', 'headless-manifest.mjs')).href
);
const { boot } = await import(pathToFileURL(join(root, 'scripts', 'lib', 'harness.mjs')).href);

const ROSTER = ['footman', 'archer', 'footman', 'archer', 'healer', 'mage', 'footman', 'knight'];
// label -> [wave, phase]; "day" saves are taken 240 ticks into the wave, mid-fight.
const WANT = [
  ['wave01-day', 1, 'day'],
  ['wave01-night', 1, 'night'],
  ['wave06-day', 6, 'day'],
  ['wave06-night', 6, 'night'],
  ['wave12-day', 12, 'day'],
  ['wave12-night', 12, 'night'],
];

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const { sb, cvs } = boot(4242);
const { Game, SpriteGen, UnitDefs } = vm.runInContext(
  `${code}\n({ Game, SpriteGen, UnitDefs })`,
  vm.createContext(sb)
);
SpriteGen.prewarmCache = () => {};
Game.init(cvs);
Game.setDifficulty('baby');
Game.start();

mkdirSync(OUT, { recursive: true });
const done = new Set();
let next = 0;
let deployed = 0;
let dayTicks = 0;
let tentStep = 0;
let tentTries = 0;
let lastPhase = '';
for (let t = 0; t < 90000 && done.size < WANT.length && Game.isPlaying(); t++) {
  const s = Game.getState();
  if (s.timeOfDay !== lastPhase) {
    lastPhase = s.timeOfDay;
    dayTicks = 0;
  }
  dayTicks++;
  for (const [label, wave, phase] of WANT) {
    if (done.has(label) || s.wave !== wave) continue;
    const isNight = s.timeOfDay === 'night';
    if (phase === 'night' ? !isNight || dayTicks < 4 : isNight || dayTicks < 240) continue;
    const snap = JSON.parse(JSON.stringify(Game.exportGameState()));
    delete snap.thumbnail;
    const file = `${tag}-${label}.json`;
    writeFileSync(
      join(OUT, file),
      JSON.stringify({ fixture: { tag, label, wave, phase, difficulty: 'baby' }, snap }) + '\n'
    );
    console.log(
      `${file}: v${snap.version} wave ${snap.wave} ${snap.timeOfDay} units ${snap.units.length} buildings ${snap.buildings.length} queue ${snap.spawnQueue.length}`
    );
    done.add(label);
  }
  if (s.timeOfDay === 'night') {
    const type = ROSTER[next % ROSTER.length];
    const cost = UnitDefs[type]?.cost ?? 99;
    if (tentStep < 2 && s.canDeploy && deployed >= 4) {
      // A Builder, then a Medical Tent behind the line, so the saves hold a building.
      if (tentStep === 0 && s.tactical >= (UnitDefs.builder?.cost ?? 99) + 5) {
        Game.selectDeploy('builder');
        Game.handleClick(640, 600);
        tentStep = 1;
      } else if (tentStep === 1 && s.tactical >= 5 && tentTries < 40) {
        Game.selectBuild('medical_tent');
        if (Game.handleClick(560 - (tentTries % 8) * 14, 610 - (tentTries % 3) * 12)) tentStep = 2;
        else if (++tentTries >= 40) tentStep = 2;
      } else if (t % 20 === 0) {
        Game.beginDayPhase(true);
      }
    } else if (s.canDeploy && s.tactical >= cost && deployed < 40) {
      const before = s.army ?? 0;
      Game.selectDeploy(type);
      Game.handleClick(480 + ((deployed * 37) % 320), 520 + ((deployed * 53) % 90));
      if ((Game.getState().army ?? 0) > before) deployed++;
      next++;
    } else if (t % 20 === 0) {
      Game.beginDayPhase(true);
    }
  }
  Game.update();
}
if (done.size < WANT.length) {
  console.error(`only ${done.size}/${WANT.length} fixtures written (run ended at wave ${Game.getState().wave})`);
  process.exit(1);
}
