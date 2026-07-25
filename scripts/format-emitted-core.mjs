/**
 * Prettier pass on tsc-emitted core JS (tsc does not run Prettier).
 * Invoked automatically after build:ts.
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['js/game-data.js', 'js/game-events.js', 'js/game-services.js', 'tsconfig.json'].map(
  (f) => join(ROOT, f)
);

execSync(`npx prettier --write ${files.map((f) => `"${f}"`).join(' ')}`, {
  stdio: 'inherit',
  cwd: ROOT,
});
