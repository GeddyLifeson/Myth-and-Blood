#!/usr/bin/env node
// Static audit of css/style.css.
//
//   node scripts/css-audit.mjs                 report only
//   node scripts/css-audit.mjs --json out.json full report as JSON
//   node scripts/css-audit.mjs --apply         delete what is proven dead or duplicate
//   node scripts/css-audit.mjs --deleted f.txt write the list of deleted selectors
//   node scripts/css-audit.mjs --root ../x     also scan another checkout for live names (repeatable)
//
// A class or id is LIVE when its name appears as a whole word anywhere in index.html, js/**,
// mods/**, electron/**, src/** or data/** (comments included, on purpose: it only ever errs
// towards keeping), or when code builds names from a piece that fits it:
//   'unit-' + type, `skill-node-${state}`   word ending in '-'            (prefix)
//   'tier' + n, `tier${n}`                  word directly before a concat (prefix)
//   `${kind}-active`, x + '-on'             word starting with '-'        (suffix)
// Element, attribute and pseudo selectors, and anything inside :not()/:is()/:where()/:has(),
// are always treated as live. A selector is dead when one of its compound parts needs a class
// or id that is not live. A rule is dead when every selector in its list is dead.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const out = [];
  argv.forEach((a, i) => {
    if (a === name && argv[i + 1]) out.push(argv[i + 1]);
  });
  return out;
};
const CSS_FILE = path.resolve(ROOT, opt('--css')[0] || 'css/style.css');
const SCAN_ROOTS = [ROOT, ...opt('--root').map((r) => path.resolve(r))];
const SCAN_DIRS = ['js', 'mods', 'electron', 'src', 'data'];
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.html', '.htm', '.json']);

// ---------------------------------------------------------------- source scan
function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SCAN_EXT.has(path.extname(e.name))) out.push(p);
  }
}

function collectNames() {
  const words = new Set();
  const prefixes = new Set();
  const suffixes = new Set();
  const cssTexts = [];
  for (const root of SCAN_ROOTS) {
    const files = [];
    for (const f of ['index.html']) if (fs.existsSync(path.join(root, f))) files.push(path.join(root, f));
    for (const d of SCAN_DIRS) walk(path.join(root, d), files);
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      const re = /-?[A-Za-z_][\w-]*/g;
      let m;
      while ((m = re.exec(text))) {
        let w = m[0];
        const before = text[m.index - 1] || '';
        const after = text.slice(re.lastIndex, re.lastIndex + 4);
        if (w[0] === '-') {
          // `${x}-on`, x + '-on'
          if (w.length > 2 && (before === '}' || before === "'" || before === '"' || before === '`')) suffixes.add(w);
          w = w.replace(/^-+/, '');
          if (!w) continue;
        }
        words.add(w);
        if (w.endsWith('-')) {
          prefixes.add(w);
          words.add(w.replace(/-+$/, ''));
        } else if (w.length >= 3 && (after.startsWith('${') || /^['"`]\s*\+/.test(after))) {
          prefixes.add(w);
        }
      }
    }
    // other stylesheets (for var() and animation-name use only)
    const cssDir = path.join(root, 'css');
    if (fs.existsSync(cssDir))
      for (const f of fs.readdirSync(cssDir))
        if (f.endsWith('.css') && path.join(cssDir, f) !== CSS_FILE)
          cssTexts.push(fs.readFileSync(path.join(cssDir, f), 'utf8'));
  }
  return { words, prefixes, suffixes, cssTexts };
}

// ---------------------------------------------------------------- css parser
// Returns a tree of { type: 'rule'|'at'|'decl'|'comment', start, end, ... } with source offsets.
function parseCss(src) {
  let i = 0;
  const n = src.length;

  function skipString(q) {
    i++;
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') i++;
      i++;
    }
    i++;
  }
  function skipComment() {
    const e = src.indexOf('*/', i + 2);
    i = e < 0 ? n : e + 2;
  }
  // read up to (not including) the first top-level '{', ';' or '}'
  function readPrelude() {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '"' || c === "'") {
        skipString(c);
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        skipComment();
        continue;
      }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth <= 0 && (c === '{' || c === ';' || c === '}')) return;
      i++;
    }
  }
  function parseBlock(kind) {
    // kind: 'rules' (stylesheet / @media body), 'decls' (declaration block), 'keyframes'
    const nodes = [];
    while (i < n) {
      while (i < n && /\s/.test(src[i])) i++;
      if (i >= n) break;
      if (src[i] === '}') break;
      if (src[i] === '/' && src[i + 1] === '*') {
        const start = i;
        skipComment();
        nodes.push({ type: 'comment', start, end: i, text: src.slice(start, i) });
        continue;
      }
      const start = i;
      readPrelude();
      const prelude = src.slice(start, i).trim();
      if (i >= n || src[i] === '}') {
        if (prelude) nodes.push({ type: 'decl', start, end: i, text: prelude });
        break;
      }
      if (src[i] === ';') {
        i++;
        if (prelude.startsWith('@')) nodes.push({ type: 'at', start, end: i, prelude, children: null });
        else nodes.push({ type: 'decl', start, end: i, text: prelude });
        continue;
      }
      // '{'
      i++;
      let node;
      if (prelude.startsWith('@')) {
        const name = prelude.match(/^@[\w-]+/)[0].toLowerCase();
        const inner =
          name === '@keyframes' || name === '@-webkit-keyframes'
            ? 'keyframes'
            : name === '@font-face' || name === '@page'
              ? 'decls'
              : 'rules';
        node = { type: 'at', name, prelude, start, children: parseBlock(inner) };
      } else if (kind === 'keyframes') {
        node = { type: 'frame', prelude, start, children: parseBlock('decls') };
      } else {
        node = { type: 'rule', prelude, start, children: parseBlock('decls') };
      }
      if (src[i] === '}') i++;
      node.end = i;
      nodes.push(node);
    }
    return nodes;
  }
  return parseBlock('rules');
}

function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  let q = null;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (q) {
      cur += c;
      if (c === '\\') cur += s[++k] || '';
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") q = c;
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const norm = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([>+~,])\s*/g, '$1')
    .trim();

// Class and id names a selector cannot match without (outside brackets and pseudo functions).
function requiredNames(sel) {
  if (sel.includes('\\')) return null; // escapes: do not reason about it
  let s = '';
  let depth = 0;
  for (let k = 0; k < sel.length; k++) {
    const c = sel[k];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0) s += c;
  }
  const out = [];
  const re = /([.#])(-?[_A-Za-z][\w-]*)/g;
  let m;
  while ((m = re.exec(s))) out.push({ kind: m[1], name: m[2] });
  return out;
}

function parseDecl(text) {
  const k = text.indexOf(':');
  if (k < 0) return null;
  const prop = text.slice(0, k).trim();
  let value = text.slice(k + 1).trim();
  const important = /!important\s*$/i.test(value);
  if (important) value = value.replace(/\s*!important\s*$/i, '');
  return { prop: prop.startsWith('--') ? prop : prop.toLowerCase(), value: value.replace(/\s+/g, ' '), important };
}

// ---------------------------------------------------------------- analysis
function analyse(src, names) {
  const tree = parseCss(src);
  const { words, prefixes, suffixes } = names;

  const nameState = new Map(); // name -> 'exact' | 'pieced' | 'dead'
  function liveness(name) {
    if (nameState.has(name)) return nameState.get(name);
    let st = 'dead';
    if (words.has(name)) st = 'exact';
    else {
      for (const p of prefixes)
        if (name.startsWith(p) && name.length > p.length) {
          st = 'pieced';
          break;
        }
      if (st === 'dead')
        for (const sfx of suffixes)
          if (name.endsWith(sfx) && name.length > sfx.length) {
            st = 'pieced';
            break;
          }
    }
    nameState.set(name, st);
    return st;
  }

  const rules = []; // flat, in source order
  const keyframes = [];
  const allDecls = []; // every declaration anywhere, for var()/animation scans
  let ruleTotal = 0;
  (function visit(nodes, ctx, parent) {
    for (const node of nodes) {
      node.parent = parent;
      node.siblings = nodes;
      if (node.type === 'rule') {
        ruleTotal++;
        const sels = splitTop(node.prelude, ',').map((s) => s.trim());
        node.selectors = sels.map((raw) => {
          const req = requiredNames(raw);
          const dead = req ? req.filter((r) => liveness(r.name) === 'dead').map((r) => r.kind + r.name) : [];
          const pieced = req ? req.filter((r) => liveness(r.name) === 'pieced').map((r) => r.kind + r.name) : [];
          return { raw, key: norm(raw), dead, pieced };
        });
        node.ctx = ctx;
        node.decls = node.children.filter((c) => c.type === 'decl').map((c) => ({ node: c, ...parseDecl(c.text) }));
        node.line = src.slice(0, node.start).split('\n').length;
        rules.push(node);
        allDecls.push(...node.decls);
      } else if (node.type === 'at') {
        if (node.name === '@keyframes' || node.name === '@-webkit-keyframes') {
          node.kfName = node.prelude.replace(/^@[\w-]+\s+/, '').trim();
          node.line = src.slice(0, node.start).split('\n').length;
          keyframes.push(node);
          for (const fr of node.children || [])
            if (fr.children)
              allDecls.push(
                ...fr.children.filter((c) => c.type === 'decl').map((c) => ({ node: c, ...parseDecl(c.text) }))
              );
        } else if (node.children) {
          if (node.name === '@font-face' || node.name === '@page') {
            allDecls.push(
              ...node.children.filter((c) => c.type === 'decl').map((c) => ({ node: c, ...parseDecl(c.text) }))
            );
          } else visit(node.children, ctx + ' ' + norm(node.prelude), node);
        }
      }
    }
  })(tree, '', null);

  const remove = new Set(); // nodes to delete
  const report = {
    dead: [],
    partlyDead: [],
    empty: [],
    duplicate: [],
    overridden: [],
    shadowedRules: [],
    unusedKeyframes: [],
    shadowedKeyframes: [],
    unusedProps: [],
    pieced: [],
  };

  // dead / empty / uncertain
  for (const r of rules) {
    if (r.decls.length === 0) {
      report.empty.push({ line: r.line, selector: norm(r.prelude) });
      remove.add(r);
      continue;
    }
    const deadSels = r.selectors.filter((s) => s.dead.length);
    if (deadSels.length === r.selectors.length) {
      report.dead.push({
        line: r.line,
        selector: norm(r.prelude),
        missing: [...new Set(deadSels.flatMap((s) => s.dead))],
      });
      remove.add(r);
    } else {
      for (const s of deadSels) report.partlyDead.push({ line: r.line, selector: s.key, missing: s.dead });
      const piec = [...new Set(r.selectors.flatMap((s) => (s.dead.length ? [] : s.pieced)))];
      if (piec.length) report.pieced.push({ line: r.line, selector: norm(r.prelude), via: piec });
    }
  }

  // duplicates and same-selector overrides (only among rules that survive)
  const live = rules.filter((r) => !remove.has(r));
  const declSig = (r) => r.decls.map((d) => `${d.prop}:${d.value}${d.important ? '!' : ''}`).join(';');
  const listKey = (r) => r.ctx + '|' + r.selectors.map((s) => s.key).join(',');
  const seen = new Map();
  for (const r of live) {
    const k = listKey(r) + '|' + declSig(r);
    if (seen.has(k)) seen.get(k).push(r);
    else seen.set(k, [r]);
  }
  for (const group of seen.values()) {
    if (group.length < 2) continue;
    // The LAST copy wins the cascade for every property it sets, so every earlier copy is inert.
    const keep = group[group.length - 1];
    for (const r of group.slice(0, -1)) {
      report.duplicate.push({ line: r.line, keptLine: keep.line, selector: norm(r.prelude) });
      remove.add(r);
    }
  }

  // declarations overridden later by a rule that carries the very same selector (so the same
  // elements and the same specificity) in the same or no at-rule context
  const later = new Map(); // ctx|selKey -> [{ruleIndex, prop, important}]
  const idx = new Map(live.map((r, k) => [r, k]));
  for (const r of live)
    for (const s of r.selectors) {
      const k = s.key;
      if (!later.has(k)) later.set(k, []);
      for (const d of r.decls)
        later.get(k).push({ at: idx.get(r), ctx: r.ctx, prop: d.prop, important: d.important, line: r.line });
    }
  for (const r of live) {
    if (remove.has(r)) continue;
    let all = r.decls.length > 0;
    for (const d of r.decls) {
      // overridden only if EVERY selector of this rule has a later same-selector winner
      const winners = r.selectors.map((s) =>
        (later.get(s.key) || []).find(
          (o) =>
            o.at > idx.get(r) &&
            o.prop === d.prop &&
            (o.ctx === '' || o.ctx === r.ctx) &&
            (o.important || !d.important)
        )
      );
      // a later duplicate of the property inside the same rule also counts
      const sameRuleLater = r.decls.some(
        (o) => o !== d && o.prop === d.prop && o.node.start > d.node.start && (o.important || !d.important)
      );
      if (winners.every(Boolean) || sameRuleLater) {
        report.overridden.push({
          line: r.line,
          selector: norm(r.prelude),
          decl: `${d.prop}: ${d.value}${d.important ? ' !important' : ''}`,
          byLine: sameRuleLater ? r.line : winners[0].line,
        });
      } else all = false;
    }
    if (all) report.shadowedRules.push({ line: r.line, selector: norm(r.prelude) });
  }

  // keyframes
  const otherCss = names.cssTexts.join('\n');
  const animValues = allDecls
    .filter((d) => d.prop === 'animation' || d.prop === 'animation-name')
    .map((d) => d.value)
    .join(' ');
  const wordIn = (hay, w) => new RegExp(`(^|[^\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w-])`).test(hay);
  const lastKf = new Map();
  for (const k of keyframes) lastKf.set(k.kfName, k);
  for (const k of keyframes) {
    if (lastKf.get(k.kfName) !== k) {
      report.shadowedKeyframes.push({ line: k.line, name: k.kfName, keptLine: lastKf.get(k.kfName).line });
      remove.add(k);
    } else if (!wordIn(animValues, k.kfName) && !wordIn(otherCss, k.kfName) && liveness(k.kfName) === 'dead') {
      report.unusedKeyframes.push({ line: k.line, name: k.kfName });
      remove.add(k);
    }
  }

  // custom properties: defined here, never read by var() in any stylesheet, never named in code
  const allCss = src + '\n' + otherCss;
  const used = new Set();
  for (const m of allCss.matchAll(/var\(\s*(--[\w-]+)/g)) used.add(m[1]);
  for (const d of allDecls) {
    if (!d.prop || !d.prop.startsWith('--')) continue;
    if (used.has(d.prop)) continue;
    if (liveness(d.prop.slice(2)) !== 'dead') continue; // named in code (setProperty / getPropertyValue)
    const line = src.slice(0, d.node.start).split('\n').length;
    report.unusedProps.push({ line, prop: d.prop });
    remove.add(d.node);
  }

  // rules left with nothing after removing unused custom properties
  for (const r of rules)
    if (!remove.has(r) && r.decls.length && r.decls.every((d) => remove.has(d.node))) {
      report.empty.push({ line: r.line, selector: norm(r.prelude), note: 'only unused custom properties' });
      remove.add(r);
    }
  // at-rules left with no rules
  (function prune(nodes) {
    for (const node of nodes) {
      if (node.type !== 'at' || !node.children || node.name === '@keyframes' || node.name === '@font-face') continue;
      prune(node.children);
      const kids = node.children.filter((c) => c.type !== 'comment');
      if (kids.length && kids.every((c) => remove.has(c))) remove.add(node);
    }
  })(tree);

  return { tree, rules, keyframes, ruleTotal, remove, report };
}

// ---------------------------------------------------------------- deletion
function applyRemoval(src, tree, remove) {
  const cuts = [];
  (function visit(nodes) {
    nodes.forEach((node, k) => {
      if (remove.has(node)) {
        let start = node.start;
        // A comment glued to the top of this node goes with it, when nothing else is left under it.
        const prev = nodes[k - 1];
        const next = nodes.slice(k + 1).find((x) => !remove.has(x));
        if (prev && prev.type === 'comment' && node.type !== 'decl') {
          const gap = src.slice(prev.end, node.start);
          const nextGap = next ? src.slice(node.end, next.start) : '\n\n';
          const before = nodes[k - 2];
          const ownLine = !before || /\n/.test(src.slice(before.end, prev.start));
          if (!/\n\s*\n/.test(gap) && ownLine && (!next || next.type === 'comment' || /\n\s*\n/.test(nextGap)))
            start = prev.start;
        }
        cuts.push([start, node.end]);
      } else if (node.children) visit(node.children);
    });
  })(tree);
  cuts.sort((a, b) => a[0] - b[0]);
  let out = '';
  let pos = 0;
  for (const [s, e] of cuts) {
    if (s < pos) continue;
    // swallow the indentation before and the line break after
    let a = s;
    while (a > pos && (src[a - 1] === ' ' || src[a - 1] === '\t')) a--;
    let b = e;
    while (b < src.length && (src[b] === ' ' || src[b] === '\t')) b++;
    if (src[b] === '\r') b++;
    if (src[b] === '\n') b++;
    out += src.slice(pos, a);
    pos = b;
  }
  out += src.slice(pos);
  return out.replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------- main
const src = fs.readFileSync(CSS_FILE, 'utf8');
const names = collectNames();
const res = analyse(src, names);
const { report } = res;

const deletedLines = [
  ...report.dead.map((d) => `dead\tL${d.line}\t${d.selector}\t(no ${d.missing.join(' ')})`),
  ...report.duplicate.map((d) => `duplicate\tL${d.line}\t${d.selector}\t(same as L${d.keptLine})`),
  ...report.empty.map((d) => `empty\tL${d.line}\t${d.selector}`),
  ...report.shadowedKeyframes.map((d) => `keyframes-redefined\tL${d.line}\t@keyframes ${d.name}\t(L${d.keptLine} wins)`),
  ...report.unusedKeyframes.map((d) => `keyframes-unused\tL${d.line}\t@keyframes ${d.name}`),
  ...report.unusedProps.map((d) => `custom-property-unused\tL${d.line}\t${d.prop}`),
];

const declTotal = res.rules.reduce((a, r) => a + r.decls.length, 0);
console.log(`${path.relative(ROOT, CSS_FILE)}: ${src.split('\n').length - 1} lines, ${src.length} bytes`);
console.log(`  rules ${res.ruleTotal}, declarations ${declTotal}, @keyframes ${res.keyframes.length}`);
console.log(`  dead rules                    ${report.dead.length}`);
console.log(`  duplicate rules               ${report.duplicate.length}`);
console.log(`  empty rules                   ${report.empty.length}`);
console.log(`  @keyframes redefined later    ${report.shadowedKeyframes.length}`);
console.log(`  @keyframes unused             ${report.unusedKeyframes.length}`);
console.log(`  custom properties unused      ${report.unusedProps.length}`);
console.log(`  -- reported only, never deleted --`);
console.log(`  declarations overridden later by the same selector   ${report.overridden.length}`);
console.log(`  rules with every declaration overridden              ${report.shadowedRules.length}`);
console.log(`  dead selectors inside a list that has live ones      ${report.partlyDead.length}`);
console.log(`  rules live only through a built-up name (uncertain)  ${report.pieced.length}`);
if (flag('--verbose')) console.log(deletedLines.join('\n'));

for (const f of opt('--json')) fs.writeFileSync(f, JSON.stringify(report, null, 2));
for (const f of opt('--deleted')) fs.writeFileSync(f, deletedLines.join('\n') + '\n');

if (flag('--apply')) {
  const out = applyRemoval(src, res.tree, res.remove);
  fs.writeFileSync(CSS_FILE, out);
  console.log(`applied: ${src.length - out.length} bytes removed, ${out.split('\n').length - 1} lines left`);
}
