/**
 * Smoke tests for damage preview tooltips.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS, HEADLESS_FILES } from './headless-manifest.mjs';

const code = HEADLESS_FILES.map((f) => readFileSync(join(JS, f), 'utf8')).join('\n;\n');
const sb = {
  console,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Map,
  Set,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  undefined,
  NaN,
  Infinity,
  setTimeout: (fn) => {
    fn();
    return 0;
  },
  clearTimeout: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
sb.window = sb;
sb.globalThis = sb;

const { DamagePreview } = vm.runInContext(`${code}\n({ DamagePreview })`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const gs = {
  wave: 20,
  difficulty: 'normal',
  lastStandActive: false,
  generalStationed: true,
  generalAura: { meleeDmg: 0.2, rangedDmg: 0.15, strength: 0.5 },
  creativeMode: false,
  loadout: 'balanced',
};

ok(typeof DamagePreview?.formatDeployTip === 'function', 'DamagePreview exported');
const footTip = DamagePreview.formatDeployTip('footman', gs);
ok(footTip.includes('vs') && footTip.includes('dmg'), 'footman deploy preview');
ok(footTip.includes('General aura'), 'footman preview notes general aura');

const archTip = DamagePreview.formatDeployTip('archer', gs);
ok(archTip.includes('hits'), 'archer deploy preview has hit estimate');

const fireTip = DamagePreview.formatAbilityTip('fireball', gs);
ok(fireTip.includes('Strike') && fireTip.includes('center'), 'fireball ability preview');

const healTip = DamagePreview.formatAbilityTip('heal', gs);
ok(healTip === '', 'heal has no damage preview');

const ctx = DamagePreview.ctxFromState(gs);
const preview = DamagePreview.previewUnitVsEnemy('footman', ctx);
ok(preview.dmgMin > 0 && preview.dmgMax >= preview.dmgMin, 'previewUnitVsEnemy range');
ok(preview.enemyLabel === 'Orc', 'wave 20 uses Orc reference');

const early = DamagePreview.previewUnitVsEnemy('footman', { ...ctx, wave: 5 });
ok(early.enemyLabel === 'Goblin', 'early wave uses Goblin reference');

const strike = DamagePreview.previewAbility('lightning', ctx);
ok(strike.center > strike.edge, 'lightning center > edge falloff');

process.exit(failed ? 1 : 0);