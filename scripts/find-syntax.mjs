import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const lines = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'game.js'),
  'utf8'
).split(/\n/);
let depth = 0;
let lastDepth1 = 0;
for (let i = 0; i < lines.length; i++) {
  for (const c of lines[i]) {
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  if (depth === 1) lastDepth1 = i + 1;
  if (i + 1 === 5672) {
    console.log('at getState line depth', depth, 'last depth=1 at line', lastDepth1);
    console.log('context:', lines[lastDepth1 - 1]?.trim().slice(0, 70));
    console.log('line after last 1:', lines[lastDepth1]?.trim().slice(0, 70));
  }
}

// walk from lastDepth1 to 5672 and find where depth increases without returning
depth = 0;
for (let i = 0; i < lastDepth1; i++) {
  for (const c of lines[i]) {
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
}
console.log('depth at lastDepth1', depth);
for (let i = lastDepth1; i < 5672; i++) {
  const prev = depth;
  for (const c of lines[i]) {
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  if (depth > prev && depth >= 2) {
    console.log('depth +' + (depth - prev), 'at line', i + 1, ':', lines[i].trim().slice(0, 70));
    if (depth - prev >= 2) break;
  }
}
