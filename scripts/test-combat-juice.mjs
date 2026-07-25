/**
 * Smoke tests for combat juice systems (CombatFX, FloatingText, Particles).
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(root, 'js');

const sb = {
  console,
  Math,
  Object,
  Array,
  Number,
  String,
  Date,
  parseInt,
  parseFloat,
  isNaN,
  JSON,
  performance: { now: () => Date.now() },
  undefined,
};
sb.window = sb;
sb.globalThis = sb;
const ctx = vm.createContext(sb);

for (const f of ['floatingText.js', 'effects.js', 'particles.js']) {
  const code = readFileSync(join(JS, f), 'utf8');
  // Globals are `const` IIFEs — export onto sandbox after eval
  const exportName =
    f === 'floatingText.js' ? 'FloatingText' : f === 'effects.js' ? 'CombatFX' : 'Particles';
  vm.runInContext(`${code}\nthis.${exportName} = ${exportName};`, ctx);
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

const FloatingText = ctx.FloatingText;
const CombatFX = ctx.CombatFX;
const Particles = ctx.Particles;

ok(typeof FloatingText?.damage === 'function', 'FloatingText.damage');
ok(typeof CombatFX?.impact === 'function', 'CombatFX.impact');
ok(typeof CombatFX?.drawScreenFlash === 'function', 'CombatFX.drawScreenFlash');
ok(typeof Particles?.bloodSpray === 'function', 'Particles.bloodSpray');
ok(typeof Particles?.critBurst === 'function', 'Particles.critBurst');

FloatingText.damage(10, 10, 42, true);
FloatingText.damage(10, 10, 5, false);
FloatingText.heal(10, 10, 12);
FloatingText.status(10, 10, 'TEST', '#fff');
FloatingText.update();
ok(FloatingText.getCount() > 0, 'floating texts present after damage');

CombatFX.impact(50, 50, { damage: 40, crit: true });
CombatFX.impact(50, 50, { damage: 10, kill: true });
CombatFX.hitSpark(1, 1, { scale: 1.5 });
CombatFX.meleeSlash(1, 1, 90);
CombatFX.requestHitStop(2);
ok(CombatFX.consumeHitStop() === true, 'hit-stop consumes frame');
CombatFX.update();

Particles.blood(10, 10, { mult: 1.5 });
Particles.bloodSpray(10, 10, 0.5, 1.2);
Particles.impactDust(10, 10, 1);
Particles.critBurst(10, 10);
Particles.deathBurst(20, 20, 'enemy');
Particles.update();
ok(Particles.getCount() > 0, 'particles present');

const mockCtx = {
  save() {},
  restore() {},
  fillText() {},
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  textAlign: '',
  textBaseline: '',
  shadowColor: '',
  shadowBlur: 0,
  lineCap: '',
  setTransform() {},
  translate() {},
  rotate() {},
  scale() {},
  fillRect() {},
  beginPath() {},
  arc() {},
  stroke() {},
  moveTo() {},
  lineTo() {},
  closePath() {},
  fill() {},
  ellipse() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  createRadialGradient() {
    return { addColorStop() {} };
  },
};

FloatingText.draw(mockCtx, null);
CombatFX.draw(mockCtx, null);
CombatFX.drawScreenFlash(mockCtx, 800, 600);
Particles.draw(mockCtx, null);
ok(true, 'draw paths run without throw');

console.log(failed ? `\n${failed} failed` : '\nAll combat-juice tests passed.');
process.exit(failed ? 1 : 0);
