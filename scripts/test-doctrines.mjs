/**
 * Doctrines and charters: every troop open from wave 1, charters granted by wave, one
 * either/or doctrine after each tenth wave (five waves sooner with a lab), and saves from
 * before doctrines.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';
import { ok, failures, boot } from './lib/harness.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');

function start(seed) {
  const { sb, cvs } = boot(seed);
  const api = vm.runInContext(
    `${code}\n({ Game, SpriteGen, Research, GameState, UnitDefs, createUnit, Hotkeys })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}

const said = [];
const tick = (Research, wave, isNight, buildings = []) =>
  Research.tick({ wave, isNight, buildings, showMessage: (m) => said.push(m) });
const lab = { type: 'research_lab', owner: 'player', complete: true, hp: 100 };
const soldier = (createUnit, type) => createUnit(type, 100, 100, 'player');

// --- troops and charters -----------------------------------------------------------------
{
  const { Research, Hotkeys } = start(3);
  Research.resetRun();
  // The Hellbane hero is a between-run unlock, not a troop.
  const closed = Hotkeys.DEPLOY_ORDER.filter(
    (t) => t !== 'doomslayer_hero' && !Research.isDeployUnlocked(t)
  );
  ok(closed.length === 0, `every troop is open at wave 1 (closed: ${closed.join(',') || 'none'})`);

  tick(Research, 1, true);
  ok(!Research.isBuildUnlocked('castle'), 'the castle is closed before its charter');
  ok(
    /wave 6/.test(Research.getLockReason('build', 'castle')),
    `a closed building says when it opens (${Research.getLockReason('build', 'castle')})`
  );
  said.length = 0;
  tick(Research, 6, false);
  ok(Research.isBuildUnlocked('castle'), 'Fortification is granted when wave 6 comes');
  ok(
    said.some((m) => /Charter granted/.test(m) && /Fortification/.test(m)),
    'the charter is announced'
  );
  ok(!said.some((m) => /Iron Weapons/.test(m)), 'a charter that opens nothing is not announced');
  ok(!Research.isBuildUnlocked('hamlet'), 'the hamlet waits for wave 40');
  ok(Research.startResearch('fortification') === false, 'a charter cannot be bought');

  // A charter can be retired without breaking saves that hold its id.
  const hamlet = Research.ALL_NODES.find((n) => n.id === 'settlement_charter');
  hamlet.retired = true;
  Research.resetRun();
  Research.restoreSnapshot({ completed: ['settlement_charter', 'fortification'] });
  tick(Research, 60, true);
  ok(
    !Research.isBuildUnlocked('hamlet') && Research.isBuildUnlocked('castle'),
    'a retired charter opens nothing, and a save that holds it still loads'
  );
  hamlet.retired = false;

  // A charter whose only building became a starter drops out by itself.
  Research.STARTER_BUILD.add('quarry');
  ok(
    !Research.getEncyclopediaEntries().some((e) => e.name === 'Prospecting'),
    'a charter with nothing left to open is not listed'
  );
  Research.STARTER_BUILD.delete('quarry');
}

// --- doctrine timing ---------------------------------------------------------------------
{
  const { Research } = start(4);
  Research.resetRun();
  tick(Research, 9, true);
  ok(!Research.getActiveInfo(), 'no doctrine after wave 9');
  tick(Research, 10, false);
  ok(!Research.getActiveInfo(), 'no doctrine while wave 10 is being fought');
  said.length = 0;
  tick(Research, 10, true);
  ok(!!Research.getActiveInfo(), 'a doctrine is ready once wave 10 is cleared');
  ok(
    said.some((m) => /doctrine is ready/i.test(m)),
    'and it is announced'
  );

  ok(!Research.pickDoctrine('shield_wall'), 'a later pair cannot be taken early');
  ok(Research.pickDoctrine('heavy_horse'), 'one side of the pair can be taken');
  ok(!Research.pickDoctrine('pike_and_shot'), 'the other side is then closed');
  ok(!Research.getActiveInfo() && Research.doctrineCount === 1, 'nothing is left waiting');
  const row = Research.getDoctrinesForUI()[0];
  ok(
    row.options.find((o) => o.id === 'heavy_horse').taken &&
      row.options.find((o) => o.id === 'pike_and_shot').passed,
    'the panel shows which was taken and which was passed over'
  );

  tick(Research, 15, true, [lab]);
  ok(!!Research.getActiveInfo(), 'a standing lab brings the second choice to wave 15');
  Research.resetRun();
  tick(Research, 15, true);
  Research.pickDoctrine('heavy_horse');
  ok(!Research.getActiveInfo(), 'without a lab the second choice waits for wave 20');
}

// --- doctrine effects --------------------------------------------------------------------
{
  const { Research, createUnit } = start(5);
  Research.resetRun();
  tick(Research, 10, true);
  const knight = soldier(createUnit, 'knight');
  const archer = soldier(createUnit, 'archer');
  knight.hp = Math.floor(knight.maxHp / 2);
  const before = { max: knight.maxHp, hp: knight.hp, archer: archer.maxHp };
  Research.pickDoctrine('heavy_horse', [knight, archer]);
  ok(
    knight.maxHp === Math.floor(before.max * 1.15) && knight.hp > before.hp,
    `a serving knight changes at the pick (${before.max} to ${knight.maxHp})`
  );
  ok(knight.hp < knight.maxHp, 'a wounded knight is not healed to full by it');
  ok(archer.maxHp === before.archer, 'an archer is untouched');

  const recruit = soldier(createUnit, 'knight');
  const raw = recruit.maxHp;
  Research.applyDoctrines(recruit);
  ok(recruit.maxHp === Math.floor(raw * 1.15), 'a later recruit arrives with the doctrine');

  ok(Research.getDoctrineEffects().tpIncomeMult === 1, 'no income change from Heavy Horse');
  ok(Research.getDoctrinePath() === 'martial', 'the run leans martial after a martial pick');
}

// --- saves -------------------------------------------------------------------------------
{
  const { Research } = start(6);
  Research.resetRun();
  tick(Research, 10, true);
  Research.pickDoctrine('pike_and_shot');
  const snap = JSON.parse(JSON.stringify(Research.getSnapshot()));
  Research.resetRun();
  Research.restoreSnapshot(snap);
  ok(
    Research.doctrineCount === 1 && Research.isBuildUnlocked('castle'),
    'doctrines and charters survive a save and load'
  );

  // A save written before doctrines existed.
  Research.resetRun();
  Research.restoreSnapshot({
    sciencePoints: 41.5,
    reserveScience: 3,
    killScienceThisWave: 2,
    completed: ['iron_weapons', 'fortification', 'no_such_node'],
    activeId: 'prospecting',
    activeProgress: 12,
  });
  ok(Research.isBuildUnlocked('castle'), 'an old save keeps what it had researched');
  ok(Research.completedCount === 2, 'an unknown id in an old save is dropped');
  said.length = 0;
  tick(Research, 22, true);
  ok(said.length === 0, 'catching up after a load announces nothing');
  ok(Research.isBuildUnlocked('quarry'), 'charters due by the loaded wave are granted');
  ok(!!Research.getActiveInfo(), 'an old save at wave 22 is owed a doctrine');
  Research.pickDoctrine('pike_and_shot');
  ok(!!Research.getActiveInfo(), 'and then the second one');
  Research.pickDoctrine('flying_column');
  ok(!Research.getActiveInfo(), 'and no more than the waves cleared allow');
}

// --- every doctrine is well formed -------------------------------------------------------
{
  const { Research, UnitDefs } = start(7);
  const ids = new Set();
  let bad = '';
  for (const pair of Research.DOCTRINES) {
    if (pair.length !== 2) bad = 'a tier without exactly two options';
    for (const o of pair) {
      if (ids.has(o.id)) bad = `duplicate id ${o.id}`;
      ids.add(o.id);
      for (const t of [...(o.types || []), ...(o.dmgTypes || [])]) {
        if (!UnitDefs[t]) bad = `${o.id} names unknown troop ${t}`;
      }
      if (/[—]/.test(o.desc + o.name)) bad = `${o.id} has an em dash`;
    }
  }
  ok(!bad && Research.DOCTRINES.length === 10, `ten well-formed pairs ${bad}`);
}

if (failures()) process.exit(1);
console.log('test-doctrines: ok');
