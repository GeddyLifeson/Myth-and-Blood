import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const missing = [];
for (const m of html.matchAll(/src="(js\/[^"]+)"/g)) {
  if (!existsSync(join(root, m[1]))) missing.push(m[1]);
}
const scripts = [...html.matchAll(/src="js\//g)].length;
console.log(missing.length ? `MISSING: ${missing.join(', ')}` : `OK: all ${scripts} game scripts present`);
console.log('index.html:', existsSync(join(root, 'index.html')));
console.log('electron main:', existsSync(join(root, 'electron/main.js')));
console.log(
  'electron binary:',
  existsSync(join(root, 'node_modules/electron/dist/electron.exe'))
);
process.exit(missing.length ? 1 : 0);
