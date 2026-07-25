/**
 * Compare AudioEngine.SFX definitions vs call sites.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const JS = 'js';
const audio = readFileSync(join(JS, 'audio.js'), 'utf8');
const sfxBlock = audio.match(/const SFX = \{([\s\S]*?)\n  \};/);
if (!sfxBlock) {
  console.error('Could not parse SFX object');
  process.exit(1);
}
const defs = new Set();
for (const m of sfxBlock[1].matchAll(/\n    ([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
  defs.add(m[1]);
}

const callSet = new Map();
function addCall(name, file) {
  if (!callSet.has(name)) callSet.set(name, new Set());
  callSet.get(name).add(file);
}

for (const f of readdirSync(JS).filter((x) => x.endsWith('.js'))) {
  const t = readFileSync(join(JS, f), 'utf8');
  for (const m of t.matchAll(/(?:AudioEngine\??\.)?SFX\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    addCall(m[1], f);
  }
  for (const m of t.matchAll(
    /svc\(\s*['"]AudioEngine['"]\s*\)\??\.SFX\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g
  )) {
    addCall(m[1], f);
  }
  // Game playSfx('name') / AudioEngine.play('name')
  for (const m of t.matchAll(/(?:playSfx|AudioEngine\.play)\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g)) {
    addCall(m[1], f);
  }
  for (const m of t.matchAll(/eng\.play\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g)) {
    addCall(m[1], f);
  }
}

const missing = [];
const ok = [];
for (const [k, files] of [...callSet.entries()].sort()) {
  if (defs.has(k)) ok.push(k);
  else missing.push({ k, files: [...files] });
}
const unused = [...defs].filter((d) => !callSet.has(d)).sort();

console.log('Defined SFX (' + defs.size + '):', [...defs].sort().join(', '));
console.log('\nCalled SFX (' + callSet.size + '):');
for (const [k, files] of [...callSet.entries()].sort()) {
  const mark = defs.has(k) ? 'OK  ' : 'MISS';
  console.log(mark, k, '<-', [...files].join(', '));
}
console.log('\nMISSING definitions:', missing.length ? missing.map((m) => m.k).join(', ') : 'none');
for (const m of missing) console.log('  ', m.k, 'in', m.files.join(', '));
console.log('UNUSED definitions:', unused.join(', ') || 'none');

// Events that likely should have sound but may not call SFX
const eventHints = [
  [/showMessage\(/g, 'showMessage'],
  [/takeDamage\(/g, 'takeDamage'],
  [/waveStart|beginDay|beginNight|startWave/g, 'wave transitions'],
];
console.log('\nDone.');
if (missing.length) process.exit(1);
