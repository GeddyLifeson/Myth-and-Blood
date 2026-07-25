/**
 * Precise, scope-aware migration of IIFE-level mutable bindings into an explicit
 * state holder object. Uses espree + eslint-scope so every rewritten identifier is
 * a *resolved reference*, never a textual match.
 *
 * Usage: node state-extract.mjs <file> <holder> [--only=a,b,c] [--list] [--write]
 */
import fs from 'fs';
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';

const [, , FILE, HOLDER = 'GS', ...rest] = process.argv;
const flags = new Set(rest.filter((r) => !r.startsWith('--only=')));
const onlyArg = rest.find((r) => r.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(',').filter(Boolean)) : null;

const src = fs.readFileSync(FILE, 'utf8');
const ast = espree.parse(src, {
  ecmaVersion: 'latest',
  sourceType: 'script',
  range: true,
  loc: true,
});
const scopeManager = eslintScope.analyze(ast, {
  ecmaVersion: 'latest',
  sourceType: 'script',
  optimistic: true,
});

// --- parent links -----------------------------------------------------------
const parentOf = new Map();
(function walk(node, parent) {
  if (!node || typeof node.type !== 'string') return;
  parentOf.set(node, parent);
  for (const k of Object.keys(node)) {
    if (k === 'range' || k === 'loc' || k === 'parent') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, node));
    else if (v && typeof v.type === 'string') walk(v, node);
  }
})(ast, null);

// --- locate the `const Game = (() => { ... })()` arrow scope -----------------
let arrow = null;
for (const node of parentOf.keys()) {
  if (node.type !== 'VariableDeclarator' || node.id?.name !== 'Game') continue;
  const init = node.init;
  if (init?.type === 'CallExpression' && /Function/.test(init.callee?.type || ''))
    arrow = init.callee;
}
if (!arrow) throw new Error('could not locate Game IIFE');
const fnScope = scopeManager.acquire(arrow);
if (!fnScope) throw new Error('could not acquire IIFE scope');

const bodyStatements = new Set(arrow.body.body);

// --- select target variables ------------------------------------------------
const targets = [];
for (const v of fnScope.variables) {
  if (!v.defs.length) continue;
  if (
    !v.defs.every(
      (d) => d.type === 'Variable' && (d.parent?.kind === 'let' || d.parent?.kind === 'var')
    )
  )
    continue;
  if (ONLY && !ONLY.has(v.name)) continue;
  // every declaration must be a direct statement of the IIFE body
  const bad = v.defs.find((d) => !bodyStatements.has(d.parent));
  if (bad) {
    console.error(`SKIP ${v.name}: declaration not a direct IIFE body statement`);
    continue;
  }
  targets.push(v);
}

if (flags.has('--list')) {
  console.log(targets.map((v) => `${v.name}\t${v.references.length}`).join('\n'));
  console.log(
    `\n${targets.length} targets, ${targets.reduce((s, v) => s + v.references.length, 0)} refs`
  );
  process.exit(0);
}

const targetNames = new Set(targets.map((v) => v.name));

// --- build edits ------------------------------------------------------------
/** @type {{start:number,end:number,text:string,kind:string}[]} */
const edits = [];
const problems = [];

// 1. declaration statements -> holder assignments
const declStatements = new Set();
for (const v of targets) for (const d of v.defs) declStatements.add(d.parent);
for (const decl of declStatements) {
  const names = decl.declarations.map((d) => d.id.name);
  if (decl.declarations.some((d) => d.id.type !== 'Identifier')) {
    problems.push(`destructuring declaration at line ${decl.loc.start.line}`);
    continue;
  }
  const notTarget = names.filter((n) => !targetNames.has(n));
  if (notTarget.length) {
    problems.push(`mixed declaration at line ${decl.loc.start.line}: ${notTarget.join(',')}`);
    continue;
  }
  const parts = decl.declarations.map((d) => {
    const init = d.init ? src.slice(d.init.range[0], d.init.range[1]) : 'undefined';
    return `${HOLDER}.${d.id.name} = ${init};`;
  });
  edits.push({ start: decl.range[0], end: decl.range[1], text: parts.join('\n  '), kind: 'decl' });
}

// 2. every resolved reference -> holder member access
const declIdRanges = new Set();
for (const decl of declStatements)
  for (const d of decl.declarations) declIdRanges.add(d.id.range.join(':'));

for (const v of targets) {
  for (const ref of v.references) {
    const id = ref.identifier;
    if (declIdRanges.has(id.range.join(':'))) continue; // handled by decl rewrite
    const parent = parentOf.get(id);
    if (parent?.type === 'Property' && parent.shorthand && parent.value === id) {
      if (parent.value.type !== 'Identifier') {
        problems.push(`shorthand w/ default at line ${id.loc.start.line} (${v.name})`);
        continue;
      }
      const inPattern = parentOf.get(parent)?.type === 'ObjectPattern';
      if (inPattern) {
        problems.push(`shorthand destructuring target at line ${id.loc.start.line} (${v.name})`);
        continue;
      }
      edits.push({
        start: id.range[0],
        end: id.range[1],
        text: `${v.name}: ${HOLDER}.${v.name}`,
        kind: 'shorthand',
      });
      continue;
    }
    if (parent?.type === 'Property' && parent.key === id && !parent.computed) {
      problems.push(`unexpected non-shorthand key ref at line ${id.loc.start.line} (${v.name})`);
      continue;
    }
    edits.push({ start: id.range[0], end: id.range[1], text: `${HOLDER}.${v.name}`, kind: 'ref' });
  }
}

if (problems.length) {
  console.error('PROBLEMS:\n' + problems.join('\n'));
  process.exit(2);
}

// --- apply ------------------------------------------------------------------
edits.sort((a, b) => a.start - b.start);
for (let i = 1; i < edits.length; i++)
  if (edits[i].start < edits[i - 1].end) throw new Error('overlapping edits');

let out = '';
let cursor = 0;
for (const e of edits) {
  out += src.slice(cursor, e.start) + e.text;
  cursor = e.end;
}
out += src.slice(cursor);

// insert the holder binding immediately before the first rewritten declaration
const holderDecl =
  `  // Mutable run state lives in the shared holder from js/game-state.js. Every\n` +
  `  // binding below was a closure-local \`let\`; moving them onto an object is what\n` +
  `  // lets subsystems be lifted out of this IIFE into their own files.\n` +
  `  const ${HOLDER} = GameState;\n\n`;
const insertAt = out.indexOf(`${HOLDER}.`, 0);
const lineStart = out.lastIndexOf('\n', insertAt) + 1;
out = out.slice(0, lineStart) + holderDecl + out.slice(lineStart);

const counts = edits.reduce((m, e) => ((m[e.kind] = (m[e.kind] || 0) + 1), m), {});
console.error(`targets=${targets.length} edits=${JSON.stringify(counts)}`);

// verify the result parses
espree.parse(out, { ecmaVersion: 'latest', sourceType: 'script' });

if (flags.has('--write')) fs.writeFileSync(FILE, out);
else process.stdout.write(out);
