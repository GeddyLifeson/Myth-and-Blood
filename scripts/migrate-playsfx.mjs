import { readFileSync, writeFileSync } from 'fs';

const path = 'js/game.js';
let t = readFileSync(path, 'utf8');
const before = t;

t = t.replace(
  /svc\('AudioEngine'\)\?\.SFX\?\.([a-zA-Z_][a-zA-Z0-9_]*)\?\.\(([^)]*)\)/g,
  (_, name, args) => (args.trim() ? `playSfx('${name}', ${args})` : `playSfx('${name}')`)
);
t = t.replace(
  /svc\('AudioEngine'\)\.SFX\.([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)/g,
  (_, name, args) => (args.trim() ? `playSfx('${name}', ${args})` : `playSfx('${name}')`)
);
t = t.replace(
  /if \(typeof AudioEngine !== 'undefined'\) AudioEngine\.SFX\.([a-zA-Z_]+)\?\.\(([^)]*)\);/g,
  (_, name, args) =>
    args.trim() ? `playSfx('${name}', ${args});` : `playSfx('${name}');`
);
// Ternary victory/defeat
t = t.replace(
  /\? svc\('AudioEngine'\)\.SFX\.victory\(/g,
  `? playSfx('victory', `
);
// That might break if already converted - skip complex cases

writeFileSync(path, t);
const remain = (t.match(/svc\('AudioEngine'\)\.SFX\./g) || []).length;
const opt = (t.match(/svc\('AudioEngine'\)\?\.SFX/g) || []).length;
const plays = (t.match(/playSfx\(/g) || []).length;
console.log({ remain, opt, plays, changed: before !== t });
