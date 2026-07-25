/**
 * Convert IIFE module pattern to ES6 class + singleton export.
 * Constants become static class fields (no module-level const pollution).
 */
import fs from 'fs';

const [file, className, optsPath] = process.argv.slice(2);
if (!file || !className) {
  console.error('Usage: node iife-to-class.mjs <file> <ClassName> [options.json]');
  process.exit(1);
}

const opts = optsPath ? JSON.parse(fs.readFileSync(optsPath, 'utf8')) : {};
const src = fs.readFileSync(file, 'utf8');

const footerStart = src.lastIndexOf('\n  return {');
if (footerStart < 0) {
  console.error('Could not find return block in', file);
  process.exit(1);
}

const header = src.slice(0, src.indexOf('const '));
const iifeStart = src.indexOf('= (() => {');
let body = src.slice(iifeStart + '= (() => {'.length, footerStart);
const footer = src.slice(footerStart);

const exportInner = footer.match(/return \{([\s\S]*?)\};/)[1];
const exportedNames = [];
for (const part of exportInner.split(',')) {
  const trimmed = part.trim();
  if (!trimmed) continue;
  const arrow = trimmed.match(/^(\w+)\s*:/);
  if (arrow) {
    exportedNames.push({
      name: arrow[1],
      kind: 'arrow',
      expr: trimmed.slice(trimmed.indexOf(':') + 1).trim(),
    });
  } else {
    exportedNames.push({ name: trimmed.replace(/,$/, '').trim(), kind: 'ident' });
  }
}

const fnNames = [...body.matchAll(/^ {2}function (\w+)\(/gm)].map((m) => m[1]);

function extractTopLevelConsts(text) {
  const names = [];
  const blocks = {};
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^ {2}const (\w+) = (.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const name = m[1];
    let chunk = m[2];
    let j = i;
    while (!chunk.trimEnd().endsWith(';')) {
      j++;
      if (j >= lines.length) break;
      chunk += '\n' + lines[j];
    }
    blocks[name] = chunk.replace(/;\s*$/, '');
    names.push(name);
    i = j + 1;
  }
  return { names, blocks };
}

const { names: constNames, blocks: constBlocks } = extractTopLevelConsts(body);
for (const name of constNames) {
  const re = new RegExp(`^  const ${name} = [\\s\\S]*?;\\n`, 'm');
  body = body.replace(re, '');
}

body = body
  .replace(/^ {2}let ctx = null;\n/m, '')
  .replace(/^ {2}let activeSynergies = \[\];\n/m, '')
  .replace(/^ {2}let sessionChallenges = new Set\(\);\n/m, '')
  .replace(/^ {2}patchBuildDefs\(\);\n\n/m, '')
  .replace(/^ {2}patchBuildDefs\(\);\n/m, '');

const exportIdentNames = new Set(
  exportedNames.filter((e) => e.kind === 'ident').map((e) => e.name)
);
const instanceConsts = [
  ...new Set([
    ...constNames.filter((c) => exportIdentNames.has(c)),
    ...(opts.instanceConsts || []),
  ]),
];

const ctxField = opts.ctxField || '_ctx';
const constructorLines = [`this.${ctxField} = null;`];
if (opts.extraConstructor) constructorLines.push(...opts.extraConstructor);
for (const c of instanceConsts) {
  constructorLines.push(`this.${c} = ${className}.${c};`);
}
if (fnNames.includes('patchBuildDefs')) constructorLines.push('this.patchBuildDefs();');

const staticFields = constNames.map((n) => `  static ${n} = ${constBlocks[n]};`).join('\n\n');

body = body.replace(/^ {2}function (\w+)\(/gm, '  $1(');

const methodPh = {};
for (const fn of fnNames) {
  methodPh[fn] = `__METH_${fn}__`;
  body = body.replace(new RegExp(`^  ${fn}\\(`, 'gm'), `  ${methodPh[fn]}(`);
}

body = body.replace(/\bctx\b/g, `this.${ctxField}`);
body = body.replace(/\bactiveSynergies\b/g, 'this.activeSynergies');
body = body.replace(/\bsessionChallenges\b/g, 'this.sessionChallenges');

for (const fn of fnNames) {
  body = body.replace(new RegExp(`(?<!this\\.)(?<![\\w$])${fn}\\(`, 'g'), `this.${fn}(`);
}
for (const fn of fnNames) {
  body = body.replaceAll(methodPh[fn], fn);
}

for (const c of instanceConsts) {
  body = body.replace(new RegExp(`(?<!this\\.)(?<![\\w$])${c}\\b`, 'g'), `this.${c}`);
}
for (const c of constNames.filter((c) => !instanceConsts.includes(c))) {
  body = body.replace(
    new RegExp(`(?<!${className}\\.)(?<![\\w.])${c}\\b`, 'g'),
    `${className}.${c}`
  );
}
for (const c of instanceConsts) {
  body = body.replace(new RegExp(`${className}\\.${c}\\b`, 'g'), `this.${c}`);
}

const arrowMethods = exportedNames.filter((e) => e.kind === 'arrow');
for (const exp of arrowMethods) {
  let expr = exp.expr;
  if (expr.startsWith('() =>')) expr = expr.replace(/^\(\)\s*=>\s*/, '');
  expr = expr
    .replace(/\bactiveSynergies\b/g, 'this.activeSynergies')
    .replace(/\bsessionChallenges\b/g, 'this.sessionChallenges');
  body += `\n\n  ${exp.name}() {\n    return ${expr};\n  }`;
}

const actualExport = opts.exportConst || className.replace(/System$/, '');

const out = `${header}class ${className} {
${staticFields}

  constructor() {
    ${constructorLines.join('\n    ')}
  }

${body.trimEnd()}
}

/** Singleton — preserves legacy \`${actualExport}.method()\` API. */
const ${actualExport} = new ${className}();
`;

fs.writeFileSync(file, out);
console.log(`OK ${file} -> ${className} / ${actualExport}`);
