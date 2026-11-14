/**
 * Panel rules that need the running game but no browser:
 *  - unavailable troops, buildings, spells and messages cannot be selected, and say why;
 *  - the TP number on the HUD is the TP owned, after every way of gaining or spending it;
 *  - Shift-click keeps a troop armed and charges each soldier the right (rising) price;
 *  - the spoils choice holds the game until a reward is taken.
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
    `${code}\n({ Game, SpriteGen, SiegeLoop, GameState, UnitDefs, BuildDefs, Abilities, Cheats, Availability, Hotkeys, Research })`,
    vm.createContext(sb)
  );
  api.SpriteGen.prewarmCache = () => {};
  api.Game.init(cvs);
  api.Game.setDifficulty('normal');
  api.Game.start();
  return api;
}

/** Clear the current wave by hand and stop at the following night. */
function toNight(Game, GS) {
  if (GS.timeOfDay === 'night') Game.beginDayPhase(true);
  for (let i = 0; i < 20000; i++) {
    if (GS.timeOfDay === 'night' && i > 5) break;
    for (const u of GS.units) {
      if (u.team === 'player') u.hp = u.maxHp;
      else u.hp = 0;
    }
    GS.spawnQueue.length = 0;
    Game.update();
  }
  return GS.timeOfDay === 'night';
}

const armyOf = (GS) => GS.units.filter((u) => u.team === 'player' && u.hp > 0).length;

// --- 13. unavailable items cannot be selected -------------------------------------------------
{
  const { Game, GameState: GS, Availability, UnitDefs, BuildDefs, Abilities } = start(7);
  ok(toNight(Game, GS), 'reached the first night');

  // Locked by research.
  let r = Availability.check('deploy', 'knight');
  ok(!r.ok && r.locked && r.reason === 'needs Iron Weapons', `Knight: ${r.reason}`);
  r = Availability.trySelect('deploy', 'knight');
  ok(!r.ok && GS.selectedDeploy == null, 'a locked troop is not selected');
  r = Availability.check('deploy', 'general');
  ok(!r.ok && r.reason === 'needs Command Theory', `General: ${r.reason}`);
  r = Availability.check('build', 'castle');
  ok(!r.ok && r.reason === 'needs Fortification', `Castle: ${r.reason}`);
  r = Availability.trySelect('build', 'castle');
  ok(!r.ok && GS.selectedBuild == null, 'a locked building is not selected');
  r = Availability.check('build', 'academy_footman');
  ok(!r.ok && /^needs an Immortal /.test(r.reason), `Footman Academy: ${r.reason}`);
  r = Availability.check('ability', 'fus_ro_dah');
  ok(!r.ok && r.locked && r.reason === 'needs the Voicebound Pact', `Voice Shout: ${r.reason}`);
  ok(
    !Availability.trySelect('ability', 'fus_ro_dah').ok && GS.selectedAbility == null,
    'a locked strike is not selected'
  );

  // Too dear.
  GS.tactical = 2;
  r = Availability.check('deploy', 'footman');
  ok(
    !r.ok && !r.locked && r.reason === `needs ${UnitDefs.footman.cost} TP, you have 2`,
    `Footman at 2 TP: ${r.reason}`
  );
  ok(
    !Availability.trySelect('deploy', 'footman').ok && GS.selectedDeploy == null,
    'an unaffordable troop is not selected'
  );
  r = Availability.check('ability', 'fireball');
  ok(
    !r.ok && r.reason === `needs ${Abilities.fireball.cost} TP, you have 2`,
    `Fireball at 2 TP: ${r.reason}`
  );
  ok(
    !Availability.trySelect('ability', 'fireball').ok && GS.selectedAbility == null,
    'an unaffordable strike is not selected'
  );
  r = Availability.check('build', 'outpost');
  ok(
    !r.ok && r.reason === `needs ${BuildDefs.outpost.cost} TP, you have 2`,
    `Outpost at 2 TP: ${r.reason}`
  );
  ok(
    !Availability.trySelect('build', 'outpost').ok && GS.selectedBuild == null,
    'an unaffordable building is not selected'
  );
  ok(!Availability.check('spy', 'steal').ok, 'an unaffordable spy action is refused');
  const tpBefore = GS.tactical;
  Availability.trySelect('spy', 'steal');
  ok(GS.tactical === tpBefore && !GS.spyUsedThisWave, 'and nothing was spent or used');

  // Other reasons.
  GS.tactical = 500;
  for (const u of GS.units) if (u.type === 'mage') u.hp = 0;
  Game.update();
  r = Availability.check('ability', 'dispel');
  ok(!r.ok && r.reason === 'needs a living Mage', `Dispel without a Mage: ${r.reason}`);
  r = Availability.check('build', 'research_lab');
  const builders = GS.units.filter((u) => u.type === 'builder' && u.hp > 0).length;
  ok(builders < BuildDefs.research_lab.requiresBuilders, 'the run starts without two Builders');
  ok(!r.ok && r.reason === 'needs 1 living Builder', `Research Lab: ${r.reason}`);
  if (!GS.units.some((u) => u.type === 'courier' && u.hp > 0)) {
    r = Availability.check('courier', 'levy');
    ok(!r.ok && r.reason === 'needs a living Courier', `Tax Levy without a Courier: ${r.reason}`);
  }

  // Available: selected, and pressing it again puts it away even when it is now too dear.
  r = Availability.trySelect('deploy', 'footman');
  ok(r.ok && GS.selectedDeploy === 'footman', 'an available troop is selected');
  GS.tactical = 0;
  ok(
    Availability.dropUnavailableSelection() !== '' && GS.selectedDeploy == null,
    'a selection that became unaffordable is put away'
  );
  GS.tactical = 500;
  Availability.trySelect('ability', 'fireball');
  ok(GS.selectedAbility === 'fireball', 'an available strike is selected');
  Availability.trySelect('ability', 'fireball');
  ok(GS.selectedAbility == null, 'selecting it again puts it away');
  Availability.trySelect('build', 'wall');
  ok(
    GS.selectedBuild === 'wall' && Availability.dropUnavailableSelection() === '',
    'an available building stays selected'
  );
  Game.clearPlacementMode();
}

// --- 18. the TP shown is the TP owned --------------------------------------------------------------
{
  const { Game, GameState: GS, Availability, SiegeLoop, Cheats, BuildDefs } = start(19);
  const els = { text: { textContent: '?' }, fill: { style: { width: '' } } };
  const routes = [];
  /** After a gain or a spend, with no new frame presented: HUD number === purse, a whole number. */
  const same = (route) => {
    routes.push(route);
    const shown = Availability.renderTp(els, Game.getState(), 24);
    ok(
      Number.isInteger(GS.tactical) &&
        els.text.textContent === String(GS.tactical) &&
        shown === GS.tactical &&
        Game.getState().tactical === GS.tactical &&
        Availability.tp() === GS.tactical,
      `${route}: HUD shows ${els.text.textContent}, purse holds ${GS.tactical}`
    );
  };
  same('start of the run');
  ok(toNight(Game, GS), 'reached the first night');
  same('wave reward');
  let before = GS.tactical;
  Game.selectDeploy('footman');
  Game.handleClick(520, 560);
  ok(GS.tactical < before, 'recruiting spent TP');
  same('recruit');
  before = GS.tactical;
  GS.tactical += 30;
  Game.selectAbility('fireball');
  Game.handleClick(400, 200);
  same('strike');
  Game.selectDeploy('builder');
  Game.handleClick(560, 600);
  Game.selectDeploy('builder');
  Game.handleClick(590, 600);
  same('specialists');
  before = GS.tactical;
  Game.selectBuild('outpost');
  Game.handleClick(520, 520);
  ok(GS.tactical === before - BuildDefs.outpost.cost, 'building spent its price');
  same('building');
  before = GS.tactical;
  Game.executeSpyAction('disrupt');
  ok(GS.tactical < before, `spy action spent TP (${before} → ${GS.tactical})`);
  same('spy action');
  Game.selectDeploy('courier');
  Game.handleClick(620, 600);
  Game.update();
  before = GS.tactical;
  ok(Game.sendCourierMessage('levy'), 'Tax Levy sent');
  same('courier: Tax Levy (cost)');
  // While paused nothing ticks, and the HUD must still follow the purse.
  Game.togglePause();
  Cheats.submit('war chest');
  same('cheat code while paused');
  Game.applyCheatEffect('tp', 13);
  same('cheat effect while paused');
  Game.togglePause();
  before = GS.tactical;
  Game.beginDayPhase(true);
  ok(GS.tactical >= before, 'the horn was sounded early');
  same('early-call bonus');
  ok(toNight(Game, GS), 'reached the second night');
  same('wave reward with the levy');
  // Spoils with instant TP.
  SiegeLoop.setSpoilsModalForTest(false);
  for (let w = 0; w < 6 && !Game.getState().siegeLoop.pendingSpoils; w++) toNight(Game, GS);
  const choices = Game.getState().siegeLoop.spoilsChoices;
  ok(choices.length === 3, `spoils offered on wave ${GS.wave}`);
  before = GS.tactical;
  ok(SiegeLoop.claimSpoils(0), 'spoils claimed');
  same('spoils claimed');
  // Demolish refund (half price: an odd price must not leave half a point).
  const post =
    GS.buildings.find(
      (b) => b.owner === 'player' && b.complete && b.hp > 0 && BuildDefs[b.type]?.cost % 2 === 1
    ) || GS.buildings.find((b) => b.owner === 'player' && b.complete && b.hp > 0);
  if (post) {
    before = GS.tactical;
    Game.selectDemolish();
    Game.handleClick(post.x, post.y);
    ok(GS.tactical >= before, `demolished ${post.type} for a refund of ${GS.tactical - before}`);
    same('demolish refund');
  }
  // The bar: full means "enough for the dearest thing on offer", and never over 100%.
  GS.tactical = 12;
  Availability.renderTp(els, Game.getState(), Availability.tpBarMax([3, 9, 48]));
  ok(
    els.fill.style.width === '25%',
    `12 TP of 48 fills a quarter of the bar (${els.fill.style.width})`
  );
  GS.tactical = 400;
  Availability.renderTp(els, Game.getState(), 48);
  ok(
    els.fill.style.width === '100%' && els.text.textContent === '400',
    'a rich purse fills the bar and still shows the full number'
  );
  ok(
    Availability.tpBarMax([]) === 24 && Availability.tpBarMax([3, 5]) === 24,
    'the bar never stands for less than 24 TP'
  );
  ok(routes.length >= 12, `${routes.length} routes checked`);
}

// --- 20. Shift-click places several, a plain click places one ----------------------------------------
{
  const { Game, GameState: GS, SiegeLoop, UnitDefs, Availability } = start(41);
  ok(toNight(Game, GS), 'reached the first night');
  // Grow the army to the point where each recruit raises the next price.
  GS.tactical = 5000;
  // 27 soldiers and a Builder: at 28 a Footman costs 6, at 29 it costs 7.
  for (let i = 0; i < 80 && armyOf(GS) < 28; i++) {
    Game.selectDeploy(armyOf(GS) === 27 ? 'builder' : 'footman');
    Game.handleClick(460 + ((i * 37) % 320), 520 + ((i * 53) % 90));
    if (GS.selectedDeploy) Game.clearPlacementMode();
  }
  Game.update();
  ok(armyOf(GS) === 28, `army of ${armyOf(GS)}`);
  GS.tactical = 1000;
  Game.selectDeploy('footman');
  const paid = [];
  const due = [];
  for (let i = 0; i < 3; i++) {
    const want = Math.ceil(UnitDefs.footman.cost * Game.getDeployCostMult());
    ok(Game.getDeployCost('footman') === want, `soldier ${i + 1}: the price shown is ${want}`);
    const before = GS.tactical;
    const n = armyOf(GS);
    Game.handleClick(500 + i * 40, 560 + i * 12, { shiftKey: true, repeatDeploy: true });
    ok(armyOf(GS) === n + 1, `soldier ${i + 1} placed`);
    paid.push(before - GS.tactical);
    due.push(want);
    ok(GS.selectedDeploy === 'footman', `soldier ${i + 1}: Footman is still armed`);
  }
  {
    const p = Availability.deployPrice('footman', (Game.beginPresentationFrame(), Game.getState()));
    ok(
      p.raised &&
        p.base === UnitDefs.footman.cost &&
        p.total === Game.getDeployCost('footman') &&
        p.upkeepPct > 0,
      `price breakdown: ${Availability.deployPriceText('footman', Game.getState())}`
    );
    ok(
      Math.ceil(p.base * (1 + p.upkeepPct / 100)) === p.total,
      'base price plus the upkeep percentage shown gives the price charged'
    );
    GS.tactical = p.total - 1;
    const r = Availability.check('deploy', 'archer', Game.getState());
    const archer = Game.getDeployCost('archer');
    ok(
      archer > UnitDefs.archer.cost &&
        (GS.tactical >= archer ? r.ok : r.reason === `needs ${archer} TP, you have ${GS.tactical}`),
      `affordability uses the charged price: Archer ${archer} TP (base ${UnitDefs.archer.cost}), ${r.ok ? 'affordable' : r.reason}`
    );
    GS.tactical = UnitDefs.footman.cost;
    const f = Availability.check('deploy', 'footman', Game.getState());
    ok(
      !f.ok && f.reason === `needs ${p.total} TP, you have ${UnitDefs.footman.cost}`,
      `holding only the base price: ${f.reason}`
    );
    GS.tactical = 1000 - paid.reduce((a, b) => a + b, 0);
  }
  ok(
    paid.join() === due.join(),
    `three Shift-clicks charged ${paid.join(', ')} (due ${due.join(', ')})`
  );
  ok(new Set(paid).size > 1, 'the price rose from one soldier to the next (upkeep)');
  ok(
    GS.tactical === 1000 - paid.reduce((a, b) => a + b, 0),
    'the purse is down by exactly the three prices'
  );
  const n = armyOf(GS);
  Game.handleClick(660, 600);
  ok(armyOf(GS) === n + 1 && GS.selectedDeploy == null, 'a plain click places one and disarms');
  // Shift-placing stops by itself when the next one cannot be paid for.
  Game.selectDeploy('footman');
  GS.tactical = Game.getDeployCost('footman');
  Game.handleClick(700, 570, { shiftKey: true, repeatDeploy: true });
  ok(
    GS.selectedDeploy == null && GS.tactical === 0,
    'Shift-placing ends when the next one is too dear'
  );
  // The General is one of a kind: never kept armed.
  // Buildings: Shift keeps the wall armed.
  GS.tactical = 200;
  Game.selectBuild('wall');
  const placed = Game.handleClick(560, 500, { shiftKey: true });
  ok(placed === true, 'the wall is placed (or its Builder sent to the site)');
  ok(GS.selectedBuild === 'wall', 'Shift-click keeps the wall armed');
  ok(
    Game.handleClick(640, 500) === true && GS.selectedBuild == null,
    'a plain click places the next wall and disarms'
  );
}

// --- 19. the spoils choice holds the game ----------------------------------------------------------
{
  const { Game, GameState: GS, SiegeLoop } = start(53);
  SiegeLoop.setSpoilsModalForTest(false);
  for (let w = 0; w < 6 && !Game.getState().siegeLoop.pendingSpoils; w++) toNight(Game, GS);
  ok(
    Game.getState().siegeLoop.pendingSpoils === 1 && GS.timeOfDay === 'night',
    `spoils pending on the night after wave ${GS.wave}`
  );
  // No modal (headless, bots): the game runs on, as it always did.
  ok(!SiegeLoop.isSpoilsHeld(), 'with no page to show it, the choice does not hold the game');
  let t0 = GS.updateTick;
  Game.update();
  ok(GS.updateTick === t0 + 1, 'the game advances');

  // In front of a player: nothing moves until a reward is taken.
  SiegeLoop.setSpoilsModalForTest(true);
  ok(SiegeLoop.isSpoilsHeld(), 'shown to a player, the choice holds the game');
  t0 = GS.updateTick;
  const timer = GS.nightTimer;
  const wave = GS.wave;
  for (let f = 0; f < 600; f++) {
    Game.beginPresentationFrame();
    for (let s = 0; s < 10; s++) Game.update();
  }
  ok(GS.updateTick === t0, 'ten seconds of frames at 10x speed: the game has not advanced a tick');
  ok(GS.nightTimer === timer, 'the night timer has not run down');
  Game.beginDayPhase(true);
  ok(GS.timeOfDay === 'night' && GS.wave === wave, 'the day cannot be begun');
  ok(Game.getState().siegeLoop.pendingSpoils === 1, 'the choice is still there');
  const held = Game.getState().siegeLoop.edicts?.length ?? 0;
  ok(SiegeLoop.claimSpoils(1), 'a reward is taken');
  Game.beginPresentationFrame();
  ok(
    !SiegeLoop.isSpoilsHeld() && (Game.getState().siegeLoop.edicts?.length ?? 0) === held + 1,
    'the choice is closed and the reward kept'
  );
  Game.beginPresentationFrame();
  Game.update();
  ok(GS.updateTick === t0 + 1, 'the game resumes');
  Game.beginDayPhase(true);
  ok(GS.timeOfDay === 'day' && GS.wave === wave + 1, 'and the day can be begun');

  // A bot stepping a live page without presenting frames is not stalled: it gets a pick.
  for (let w = 0; w < 6 && !Game.getState().siegeLoop.pendingSpoils; w++) {
    SiegeLoop.setSpoilsModalForTest(false);
    toNight(Game, GS);
  }
  SiegeLoop.setSpoilsModalForTest(true);
  ok(SiegeLoop.isSpoilsHeld(), 'a second choice is pending');
  t0 = GS.updateTick;
  for (let i = 0; i < 400; i++) Game.update();
  ok(
    !SiegeLoop.isSpoilsHeld() && GS.updateTick > t0,
    'a caller stepping the game itself gets a reward picked and is not stalled'
  );
  SiegeLoop.setSpoilsModalForTest(null);
}

if (failures()) {
  console.error(`\n${failures()} panel-rule test(s) failed`);
  process.exit(1);
}
console.log('\nAll panel-rule tests passed.');
