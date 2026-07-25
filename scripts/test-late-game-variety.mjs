/**
 * Smoke tests for late-game wave events, map hazards, and expedition loot.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

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

const waveBlock = content.match(/const WAVE_EVENTS = \{[\s\S]*?\n  \};/);
ok(!!waveBlock, 'WAVE_EVENTS registry present in content-expansion');
if (waveBlock) {
  const pickWaveEvent = vm.runInContext(
    `${waveBlock[0]}
     function pickWaveEvent(wave) {
       let best = null;
       let bestPri = -1;
       for (const evt of Object.values(WAVE_EVENTS)) {
         if (evt.waveMin && wave < evt.waveMin) continue;
         if (evt.waveMod && wave % evt.waveMod !== 0) continue;
         const pri = evt.priority ?? 0;
         if (pri > bestPri) { bestPri = pri; best = evt.id; }
       }
       return best;
     }
     pickWaveEvent`,
    ctx
  );
  ok(pickWaveEvent(100) === 'mirror_assault', 'wave 100 triggers mirror assault');
  ok(pickWaveEvent(200) === 'dominion_surge', 'wave 200 triggers dominion surge');
  ok(pickWaveEvent(13) === 'blood_moon', 'wave 13 triggers blood moon');
  ok(waveBlock[0].includes('hellscape_whisper'), 'registry includes hellscape whisper');
  ok(waveBlock[0].includes('veteran_muster'), 'registry includes veteran muster');
}

vm.runInContext(`const ContentExpansion = { pickWaveEvent(wave) {
  if (wave % 13 === 0) return 'blood_moon';
  return null;
}};`, ctx);
const { GameDepth } = vm.runInContext(`${depth}\n({ GameDepth })`, ctx);
ok(GameDepth.pickWaveEvent(13) === 'blood_moon', 'game-depth delegates wave events to ContentExpansion');

const DME = vm.runInContext(`${dynamic}\nDynamicMapEvents`, ctx);
ok(!!DME.pickEvent(200), 'dynamic map event at wave 200');
ok(DME.pickEvent(200)?.id === 'dominion_storm', 'wave 200 picks dominion storm');
ok(!!DME.EVENTS.worldheart_pulse, 'worldheart pulse event exists');

const FH = vm.runInContext(`${hazards}\nFactionHazards`, ctx);
ok(!!FH.HAZARD_TYPES.undead_miasma, 'undead miasma hazard defined');
ok(!!FH.HAZARD_TYPES.mirror_rift_zone, 'mirror rift hazard defined');
ok(FH.HAZARD_TYPES.void_corruption.waveMin === 32, 'void corruption has waveMin');

const PCE = vm.runInContext(`${counter}\nPlayerCounterEvolution`, ctx);
const loot = PCE.computeExpeditionLoot(
  { targetStage: 3, unitIds: ['a', 'b', 'c'] },
  2,
  150
);
ok(loot.tp >= 10, 'expedition returns meaningful TP loot');
ok(loot.science >= 1, 'expedition returns science loot');
ok(PCE.getExpeditionLootScale(200) > PCE.getExpeditionLootScale(50), 'loot scales into RTS era');

process.exit(failed ? 1 : 0);