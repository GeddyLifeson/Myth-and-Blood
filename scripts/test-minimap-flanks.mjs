/**
 * Smoke tests for minimap flank label helpers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { JS } from './headless-manifest.mjs';

const sb = { Math, Object, Array, document: { getElementById: () => null } };
sb.window = sb;
sb.globalThis = sb;

const code = readFileSync(join(JS, 'visual-polish.js'), 'utf8');
const VP = vm.runInContext(`${code}; VisualPolish;`, vm.createContext(sb));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('OK:', msg);
}

ok(!VP.getMinimapFlankLabel({ unlockedAttackSides: ['north'], attackSides: ['north'] }), 'north-only has no label');

const multi = VP.getMinimapFlankLabel({
  unlockedAttackSides: ['north', 'east', 'west'],
  attackSides: ['north', 'east'],
});
ok(multi && multi.includes('▲') && multi.includes('▶'), 'multi-flank label shows active glyphs');
ok(multi.includes('×2'), 'multi-flank count suffix');

const quiet = VP.getMinimapFlankLabel({
  unlockedAttackSides: ['north', 'east', 'west', 'south'],
  attackSides: ['south'],
});
ok(quiet && quiet.includes('▼') && quiet.includes('·'), 'quiet flanks marked with dot');

process.exit(failed ? 1 : 0);