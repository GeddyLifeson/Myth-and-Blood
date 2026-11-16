/**
 * Mercenary Camp offers, one hire a night, readable synergies and run-only company training
 * (including loading a v1 training save, whose purchases lived in localStorage).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const read = (f) => readFileSync(join(JS, f), 'utf8');
const store = new Map([
  ['myth-and-blood-operative-skills-v1', '{"purchased":{"powderhorn":["fuse_drill"]}}'],
]);
const hires = [];
const sb = {
  console,
  localStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
  document: { getElementById: () => null, querySelectorAll: () => [] },
  Game: { getState: () => sb.gs, hireHero: (id, opts) => (hires.push({ id, opts }), true) },
  gs: { wave: 9, tactical: 500, units: [], crossoverOnField: [] },
};
sb.globalThis = sb;
const ctx = vm.createContext(sb);
vm.runInContext(
  `${read('game-data-bundle.js')}\n${read('save-registry.js')}\n${read('free-companies.js')}
  globalThis.FactionDepth = {
    SYNERGIES: GameDataBundle.synergies,
    countHeroUnits(units) {
      const byFaction = {};
      for (const u of units) byFaction[u.company] = (byFaction[u.company] || 0) + 1;
      return { total: units.length, byFaction };
    },
  };
  ${read('company-training.js')}
  Object.assign(globalThis, { SaveRegistry, FreeCompanies, FreeCompaniesScreen, HeroDefs });`,
  ctx
);
const { MercenaryCamp, CompanySynergies, CompanyTraining, SaveRegistry, FreeCompanies } = ctx;
const gs = sb.gs;

// Camp: closed before wave 10, three stable offers a night, one hire a night.
ok(!MercenaryCamp.canHire(Object.keys(ctx.HeroDefs)[0], gs).ok, 'camp closed at wave 9');
ok(/wave 10/.test(MercenaryCamp.canHire('x', gs).reason), 'closed reason names wave 10');
ok(ctx.FreeCompaniesScreen.hudButton(gs).disabled, 'HUD button greyed before wave 10');
gs.wave = 10;
ok(ctx.FreeCompaniesScreen.hudButton(gs).text === 'MERCENARY CAMP', 'HUD button opens the camp');
const offers = MercenaryCamp.getOffers(gs);
ok(offers.length === 3 && new Set(offers).size === 3, 'three distinct offers');
ok(MercenaryCamp.getOffers(gs).join() === offers.join(), 'offers stay put within a night');
gs.tactical = 1;
ok(/Need \d+ TP/.test(MercenaryCamp.canHire(offers[0], gs).reason), 'too poor: says the price');
gs.tactical = 500;
ok(MercenaryCamp.hire(offers[0]).ok, 'first hire of the night goes through');
ok(hires[0].id === offers[0] && hires[0].opts.fromCamp, 'hire skips the company hall');
ok(/hire is taken/.test(MercenaryCamp.canHire(offers[1], gs).reason), 'second hire refused');
ok(!MercenaryCamp.canHire('not_offered', gs).ok, 'cannot hire what is not offered');

const saved = SaveRegistry.saveAll();
MercenaryCamp.reset();
SaveRegistry.loadAll(JSON.parse(JSON.stringify(saved)));
ok(MercenaryCamp.getOffers(gs).join() === offers.join(), 'offers survive save and load');
ok(!MercenaryCamp.canHire(offers[1], gs).ok, 'the night’s hire survives save and load');
gs.wave = 11;
const next = MercenaryCamp.getOffers(gs);
ok(next.length === 3 && MercenaryCamp.canHire(next[0], gs).ok, 'a new night, a new hire');

// Synergies: few, plain, every company has a partner, and a hire previews what it completes.
const syns = CompanySynergies.list();
ok(syns.length <= 16, `synergies cut to ${syns.length}`);
for (const fid of [...Object.keys(FreeCompanies), 'champions']) {
  ok(
    syns.some((s) => s.factions.includes(fid)),
    `${fid} has a synergy`
  );
}
const powder = Object.keys(ctx.HeroDefs).find((id) => ctx.HeroDefs[id].faction === 'powderhorn');
ok(/Pairs with Pale Vigil/.test(CompanySynergies.cardLine(powder, [])), 'card names the partner');
ok(
  /Completes Powder and Candle/.test(
    CompanySynergies.cardLine(powder, [{ company: 'pale_vigil' }])
  ),
  'card says which synergy the hire completes'
);

// Training: v1 purchases are not carried over; the legacy store is cleared.
SaveRegistry.loadAll({
  OperativeSkillTrees: { v: 1, data: { runPoints: { powderhorn: 6 }, lastWaveGrant: {} } },
});
ok(CompanyTraining.getAvailablePoints('powderhorn') === 6, 'v1 save keeps its points');
ok(
  CompanyTraining.getSnapshot(0, []).factions[0].purchased.length === 0,
  'v1 save has no free nodes'
);
ok(!store.has('myth-and-blood-operative-skills-v1'), 'legacy permanent purchases cleared');

// Either/or fork, capstone on either branch, and purchases saved with the run.
ok(CompanyTraining.purchaseNode('powderhorn', 'fuse_drill').ok, 'root bought');
ok(CompanyTraining.purchaseNode('powderhorn', 'barrel_banded').ok, 'one branch bought');
ok(
  /Took Barrel-Banded instead/.test(
    CompanyTraining.canPurchase('powderhorn', 'forked_storm').reason
  ),
  'other branch closed'
);
ok(
  CompanyTraining.purchaseNode('powderhorn', 'master_of_the_horn').ok,
  'capstone needs only one branch'
);
ok(CompanyTraining.getAvailablePoints('powderhorn') === 0, 'points spent match nodes owned');
const run = JSON.parse(JSON.stringify(SaveRegistry.saveAll()));
CompanyTraining.resetRun();
ok(CompanyTraining.getAvailablePoints('powderhorn') === 0, 'new run starts with nothing');
SaveRegistry.loadAll(run);
ok(
  CompanyTraining.getSnapshot(0, []).factions[0].purchased.length === 3,
  'purchases load with the run'
);

// Companies without a tree of their own get the shared one.
CompanyTraining.grantSkillPoint('quiet_hand', 1);
ok(CompanyTraining.purchaseNode('quiet_hand', 'drilled').ok, 'Quiet Hand can train');

process.exit(failures() ? 1 : 0);
