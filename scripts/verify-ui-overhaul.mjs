import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const h = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/theme-v2.css'), 'utf8');
const ui = readFileSync(join(root, 'js/ui.js'), 'utf8');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(h.includes('theme-v2.css'), 'theme-v2 linked');
ok(h.includes('class="ui-v2"') || h.includes("class='ui-v2'"), 'body.ui-v2');
ok((h.match(/side-panel-tabs/g) || []).length === 2, 'two side tab strips');
ok((h.match(/data-side-tab="/g) || []).length >= 7, 'side tab buttons');
ok((h.match(/data-side-pane="/g) || []).length >= 7, 'side panes');
ok(h.includes('top-bar-v2'), 'top bar v2');
ok(h.includes('top-bar-primary'), 'top bar primary row');
ok(h.includes('top-bar-actions'), 'top bar actions');
ok(h.includes('id="left-panel"'), 'left panel id preserved');
ok(h.includes('id="right-panel"'), 'right panel id preserved');
ok(h.includes('data-unit="footman"'), 'deploy buttons preserved');
ok(h.includes('data-build="wall"'), 'build buttons preserved');
ok(h.includes('data-ability="fireball"'), 'ability buttons preserved');
ok(h.includes('data-spy="scout"'), 'spy buttons preserved');
ok(css.includes('body.ui-v2'), 'theme targets ui-v2');
ok(css.length > 5000, 'theme has substantial rules');
ok(ui.includes('initSidePanelTabs'), 'tab JS present');
ok(ui.includes('revealPanelControl'), 'reveal selected tab helper');

// ensure no broken unclosed panels - rough count
const openLeft = (h.match(/id="left-panel"/g) || []).length;
const openRight = (h.match(/id="right-panel"/g) || []).length;
ok(openLeft === 1 && openRight === 1, 'single left/right panels');

console.log(failed ? `\n${failed} failed` : '\nUI overhaul structure OK');
process.exit(failed ? 1 : 0);
