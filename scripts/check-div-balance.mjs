import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const h = readFileSync(join(root, 'index.html'), 'utf8');

function section(id) {
  const open = h.indexOf(`id="${id}"`);
  if (open < 0) return null;
  const start = h.lastIndexOf('<', open);
  // naive stack from start until balanced
  let i = start;
  let depth = 0;
  let began = false;
  while (i < h.length) {
    if (h.startsWith('<!--', i)) {
      i = h.indexOf('-->', i) + 3;
      continue;
    }
    if (h.startsWith('<script', i)) {
      i = h.indexOf('</script>', i);
      if (i < 0) break;
      i += 9;
      continue;
    }
    const nextOpen = h.indexOf('<', i);
    if (nextOpen < 0) break;
    if (h.startsWith('</', nextOpen)) {
      depth--;
      const end = h.indexOf('>', nextOpen);
      i = end + 1;
      if (began && depth === 0) return { start, end: i, depth: 0, ok: true };
      continue;
    }
    if (h.startsWith('<!', nextOpen) || h.startsWith('<?', nextOpen)) {
      i = h.indexOf('>', nextOpen) + 1;
      continue;
    }
    // open tag
    const end = h.indexOf('>', nextOpen);
    const tag = h.slice(nextOpen, end + 1);
    const selfClose = /\/>$/.test(tag) || /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(tag);
    if (!selfClose) {
      depth++;
      began = true;
    }
    i = end + 1;
  }
  return { start, depth, ok: depth === 0 };
}

for (const id of ['left-panel', 'right-panel', 'top-bar', 'ui-overlay', 'app']) {
  const r = section(id);
  console.log(id, r);
}
