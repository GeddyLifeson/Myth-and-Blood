/**
 * Scan js/*.js for the names that classic-script load order makes global, and
 * refresh eslint.globals.mjs.
 *
 * Run: node scripts/gen-eslint-globals.mjs
 *
 * This generator used to under-report, so eslint.globals.mjs accumulated
 * hand-added entries and became un-regenerable: running the generator silently
 * deleted them. It now recognises every form the codebase actually uses to
 * create a global:
 *
 *   const Foo = ...        top-level const (module objects, tuning constants)
 *   let/var Foo = ...      top-level mutable
 *   class Foo              top-level class
 *   function foo()         top-level function declaration  <-- was missing; this
 *                          is what dropped coolAbilityNum, coolAbilityInt,
 *                          scaleAbilityDef, isSpecialistLateAbilityUnlocked and
 *                          recordGoldStarEarned
 *   globalThis.Foo = ...   explicit publication from inside an IIFE  <-- was
 *                          missing; this is what dropped Analytics,
 *                          ErrorReporting and ModLoader, whose absence caused
 *                          51 no-undef errors under scripts/**
 *
 * Names are no longer filtered to an uppercase first letter: lowercase top-level
 * helpers in units.js are just as global as the PascalCase module objects. That
 * makes the old EXTRA list of hand-maintained function names unnecessary.
 *
 * Verify regenerability with: node scripts/check-eslint-globals.mjs
 */
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');
const OUT = join(ROOT, 'eslint.globals.mjs');

/** Excluded from eslint entirely (see `ignores` in eslint.config.mjs). */
const SKIP = new Set(['game-data-bundle.js']);

/**
 * Names no js/*.js file declares, because game-data-bundle.js provides them and
 * that file is lint-ignored. Without these, scripts/** would report no-undef.
 */
const FROM_DATA_BUNDLE = [
  'Abilities',
  'BuildDefs',
  'CrossoverFactions',
  'EnemyDefs',
  'SpyActions',
  'UnitDefs',
];

const IDENT = '[A-Za-z_$][A-Za-z0-9_$]*';
const PATTERNS = [
  new RegExp(`^(?:const|let|var)\\s+(${IDENT})\\s*=`, 'gm'),
  new RegExp(`^class\\s+(${IDENT})`, 'gm'),
  new RegExp(`^(?:async\\s+)?function\\s*\\*?\\s*(${IDENT})\\s*\\(`, 'gm'),
  new RegExp(`^\\s*globalThis\\.(${IDENT})\\s*=`, 'gm'),
];

const names = new Set(FROM_DATA_BUNDLE);
for (const file of fs.readdirSync(JS).filter((f) => f.endsWith('.js') && !SKIP.has(f))) {
  const src = fs.readFileSync(join(JS, file), 'utf8');
  for (const re of PATTERNS) for (const m of src.matchAll(re)) names.add(m[1]);
}

const sorted = [...names].sort();
const body = `/**
 * Browser script globals for Myth and Blood (script-tag load order).
 *
 * GENERATED FILE — do not hand-edit. Teach scripts/gen-eslint-globals.mjs about
 * the new source instead, so this file stays reproducible.
 *
 * Regenerate: node scripts/gen-eslint-globals.mjs
 * Verify:     node scripts/check-eslint-globals.mjs
 */

/** @type {Record<string, 'readonly'>} */
export const browserScriptGlobals = Object.fromEntries(
  ${JSON.stringify(sorted, null, 2)}.map((name) => [name, 'readonly'])
);
`;

fs.writeFileSync(OUT, body);
console.log(`Wrote ${sorted.length} globals to eslint.globals.mjs`);
