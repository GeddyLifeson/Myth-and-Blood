/**
 * Smoke tests for late-game wave events, map hazards, and expedition loot.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';
import { ok, failures } from './lib/harness.mjs';

const dynamic = readFileSync(join(JS, 'dynamic-map-events.js'), 'utf8');
const hazards = readFileSync(join(JS, 'faction-hazards.js'), 'utf8');
const counter = readFileSync(join(JS, 'player-counter-evolution.js'), 'utf8');
const content = readFileSync(join(JS, 'content-expansion.js'), 'utf8');
const depth = readFileSync(join(JS, 'game-depth.js'), 'utf8');

const sb = {
  Math,
  Object,
  Array,
  Set,
  Map,
  JSON,
  FloatingText: { status: () => {} },
  academyThresholdBlend: (w) => Math.max(0, Math.min(1, (w - 85) / 30)),
  rtsMapBlend: (w) => Math.max(0, Math.min(1, (w - 175) / 30)),
};
sb.window = sb;
sb.globalThis = sb;
const ctx = vm.createContext(sb);

ok(!/const WAVE_EVENTS/.test(content), 'field news lives in the omen deck, not content-expansion');

vm.runInContext(
  `const ContentExpansion = { pickWaveEvent(wave) {
  if (wave % 13 === 0) return 'blood_moon';
  return null;
}};`,
  ctx
);
const { GameDepth } = vm.runInContext(`${depth}\n({ GameDepth })`, ctx);
ok(
  GameDepth.pickWaveEvent(13) === 'blood_moon',
  'game-depth delegates wave events to ContentExpansion'
);

const DME = vm.runInContext(`${dynamic}\nDynamicMapEvents`, ctx);
DME.resetRun(5);
const lateWave = (id) => {
  for (let w = 200; w < 4000; w++) if (DME.pickEvent(w)?.id === id) return w;
  return -1;
};
ok(lateWave('dominion_storm') > 0, 'the event deck can pick dominion storm after wave 175');
{
  let early = 0;
  for (let w = 1; w <= 400; w++) {
    const e = DME.pickEvent(w);
    if (e && w < e.waveMin) early++;
  }
  ok(early === 0, 'no event arrives before its wave');
  ok(DME.pickEvent(100)?.id !== 'dominion_storm', 'dominion storm waits for wave 175');
}
ok(!!DME.EVENTS.worldheart_pulse, 'worldheart pulse event exists');
ok(DME.OMENS.hellscape_whisper?.kind === 'field', 'the deck holds hellscape whisper');
ok(DME.OMENS.veteran_muster?.kind === 'field', 'the deck holds veteran muster');
ok(lateWave('mirror_assault') >= 95, 'mirror assault waits for wave 95');

const FH = vm.runInContext(`${hazards}\nFactionHazards`, ctx);
ok(!!FH.HAZARD_TYPES.undead_miasma, 'undead miasma hazard defined');
ok(!!FH.HAZARD_TYPES.mirror_rift_zone, 'mirror rift hazard defined');
ok(FH.HAZARD_TYPES.void_corruption.waveMin === 32, 'void corruption has waveMin');

const PCE = vm.runInContext(`${counter}\nPlayerCounterEvolution`, ctx);
const loot = PCE.computeExpeditionLoot({ targetStage: 3, unitIds: ['a', 'b', 'c'] }, 2, 150);
ok(loot.tp >= 10, 'expedition returns meaningful TP loot');
ok(loot.science >= 1, 'expedition returns science loot');
ok(PCE.getExpeditionLootScale(200) > PCE.getExpeditionLootScale(50), 'loot scales into RTS era');

process.exit(failures() ? 1 : 0);
