/**
 * Fix extra closing divs introduced by overhaul-ui-html.mjs
 * (original panel closers were captured inside pane content).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'index.html');
let html = readFileSync(path, 'utf8');

// Left panel: between last perk hint and right-panel, collapse extra closes.
// Expected structure end:
//   </div> perk-section
//   </div> cmd pane
//   </div> scroll
//   </div> left-panel
// Then right-panel
html = html.replace(
  /(Heroes collect perks at night \(max 4\)\. Tombstone = General only\.\s*<\/p>\s*)(<\/div>\s*)+(?=\s*<div id="right-panel")/s,
  `$1          </div>
          </div>
        </div>

        `
);

// Right panel: ops pane should only wrap faction intel, then close scroll + right-panel.
// Pattern: ops pane content ending with faction intel, then excess closes before top-bar.
html = html.replace(
  /(<div class="side-tab-pane" data-side-pane="ops" role="tabpanel" hidden>)([\s\S]*?)(<\/div>\s*)+(?=\s*<div id="top-bar")/s,
  (match, open, body) => {
    // Keep body but ensure we only close: ops pane, scroll, right-panel
    // Strip trailing closes from body
    let b = body.replace(/(<\/div>\s*)+$/s, '').trimEnd();
    return `${open}
              ${b}
            </div>
          </div>
        </div>

        `;
  }
);

// Spy/courier pane: ensure courier pane closes cleanly before ops.
// Fix double closes after planet event / before courier if present.
html = html.replace(
  /(Your choice helps or hurts dawn\.\s*<\/p>\s*<\/div>\s*)(<\/div>\s*)+(?=\s*<div class="side-tab-pane" data-side-pane="courier")/s,
  `$1            </div>
            `
);

// After courier hint, close courier pane only (ops follows)
html = html.replace(
  /(Courier must be on field\.\s*<\/p>\s*)(<\/div>\s*)+(?=\s*<div class="side-tab-pane" data-side-pane="ops")/s,
  `$1            </div>
            `
);

// After courier if ops already closed path used earlier - also handle courier end when ops is next after closes
html = html.replace(
  /(Courier must be on field\.\s*<\/p>\s*)(<\/div>\s*)+(?=\s*<div class="side-tab-pane" data-side-pane="ops"|<\/div>\s*<\/div>\s*<div id="top-bar")/s,
  `$1            </div>
            `
);

writeFileSync(path, html);

// Balance check helper
function findBalanced(id) {
  const open = html.indexOf(`id="${id}"`);
  if (open < 0) return null;
  const start = html.lastIndexOf('<', open);
  let i = start;
  let depth = 0;
  let began = false;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      i = html.indexOf('-->', i) + 3;
      continue;
    }
    if (html.startsWith('<script', i)) {
      i = html.indexOf('</script>', i);
      if (i < 0) break;
      i += 9;
      continue;
    }
    const nextOpen = html.indexOf('<', i);
    if (nextOpen < 0) break;
    if (html.startsWith('</', nextOpen)) {
      depth--;
      i = html.indexOf('>', nextOpen) + 1;
      if (began && depth === 0) return { ok: true, end: i };
      continue;
    }
    if (html.startsWith('<!', nextOpen) || html.startsWith('<?', nextOpen)) {
      i = html.indexOf('>', nextOpen) + 1;
      continue;
    }
    const end = html.indexOf('>', nextOpen);
    const tag = html.slice(nextOpen, end + 1);
    const selfClose =
      /\/>$/.test(tag) ||
      /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(tag);
    if (!selfClose) {
      depth++;
      began = true;
    }
    i = end + 1;
  }
  return { ok: false, depth };
}

for (const id of ['left-panel', 'right-panel', 'top-bar', 'ui-overlay', 'app']) {
  console.log(id, findBalanced(id));
}

// Show snippet between left and right
const r = html.indexOf('id="right-panel"');
console.log('before right-panel:\n', html.slice(r - 120, r + 30));
const t = html.indexOf('id="top-bar"');
console.log('before top-bar:\n', html.slice(t - 150, t + 30));
