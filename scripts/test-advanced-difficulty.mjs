/**
 * Smoke tests for advanced difficulty modifiers (fog, scarcity, presets).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const code = readFileSync(join(JS, 'advanced-difficulty.js'), 'utf8');
const sb = { Math, Object, Array, Set, document: { getElementById: () => null, querySelectorAll: () => [] } };
sb.window = sb;
sb.globalThis = sb;
const AD = vm.runInContext(`${code}\nAdvancedDifficulty`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

AD.setActive([]);
const base = AD.getCombinedMods();
ok(!base.fogOfWar && base.settlementTpMult === 1, 'no modifiers baseline');

AD.setActive(['fog_of_war']);
const fog = AD.getCombinedMods();
ok(fog.fogOfWar && fog.fogVisionMult < 1, 'fog of war enables hidden enemies');

const scout = { team: 'player', hp: 100, type: 'scout', x: 100, y: 400 };
const hidden = { team: 'enemy', hp: 100, type: 'goblin', x: 100, y: 120 };
const near = { team: 'enemy', hp: 100, type: 'goblin', x: 130, y: 390 };
ok(AD.isEnemyFogHidden(hidden, { units: [scout], buildings: [], rallyY: 500, isDayPhase: true }), 'distant enemy hidden in fog');
ok(!AD.isEnemyFogHidden(near, { units: [scout], buildings: [], rallyY: 500, isDayPhase: true }), 'nearby enemy spotted in fog');

AD.setActive(['resource_scarcity']);
const scarce = AD.getCombinedMods();
ok(scarce.settlementTpMult < 0.7 && scarce.tpMult < 1, 'resource scarcity cuts income');

AD.setActive([]);
AD.toggle('fog_of_war');
const blockedDeepFog = AD.toggle('deep_fog');
ok(!blockedDeepFog && AD.getActiveIds().includes('fog_of_war'), 'fog tiers conflict on toggle');

// clear_skies must stack with fog (was wrongly conflicted — made the mod a no-op).
AD.setActive(['fog_of_war']);
const clearOk = AD.toggle('clear_skies');
ok(clearOk && AD.getActiveIds().includes('clear_skies'), 'clear skies stacks with fog of war');
const fogClear = AD.getCombinedMods();
ok(fogClear.fogOfWar && fogClear.fogVisionMult > 0.78, 'clear skies boosts fog vision mult');

ok(AD.applyPreset('fog_siege'), 'fog siege preset applies');
ok(AD.getActiveIds().includes('fog_of_war'), 'fog siege includes fog of war');

const ids = AD.getModifiers().map((m) => m.id);
ok(ids.includes('fog_of_war') && ids.includes('resource_scarcity'), 'new modifiers registered');
ok(AD.getModifiers().length >= 40, 'modifier catalog expanded');

process.exit(failed ? 1 : 0);