/**
 * One-shot HTML restructure: tabbed side panels + grouped top bar.
 * Keeps all element IDs and data-* attributes intact.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'index.html');
let html = readFileSync(path, 'utf8');

function extractBetween(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('missing start ' + startMarker);
  const e = src.indexOf(endMarker, s + startMarker.length);
  if (e < 0) throw new Error('missing end ' + endMarker);
  return { start: s, end: e, body: src.slice(s + startMarker.length, e) };
}

// --- Link theme stylesheet after style.css ---
if (!html.includes('css/theme-v2.css')) {
  html = html.replace(
    `<link rel="stylesheet" href="css/style.css" />`,
    `<link rel="stylesheet" href="css/style.css" />\n    <link rel="stylesheet" href="css/theme-v2.css" />`
  );
}

// --- Left panel tabs ---
const leftOpen = '<div id="left-panel">';
const leftCloseAt = html.indexOf('<div id="right-panel">');
const leftStart = html.indexOf(leftOpen);
if (leftStart < 0 || leftCloseAt < 0) throw new Error('left panel bounds');
const leftInner = html.slice(leftStart + leftOpen.length, leftCloseAt);

// Split left content by major headers
function splitByHeader(inner, headers) {
  const positions = headers.map((h) => {
    const needle = `class="panel-header">${h}</div>`;
    // also match plain TROOPS without extra attrs
    let idx = inner.indexOf(`>${h}</div>`);
    // walk back to start of header div
    if (idx < 0) return { h, idx: -1 };
    const divStart = inner.lastIndexOf('<div', idx);
    return { h, idx: divStart };
  });
  return positions;
}

// Manual splits using unique markers
const troopsEnd = leftInner.indexOf('<div class="panel-divider"></div>\n          <div class="panel-header">BUILD</div>');
const buildStart = leftInner.indexOf('<div class="panel-header">BUILD</div>');
const strikesStart = leftInner.indexOf('<div class="panel-header">STRIKES</div>');
// cmd section starts at demolish / after doctrines - find first DEMOLISH button
const cmdStart = leftInner.indexOf('<button id="demolish-btn"');

if (buildStart < 0 || strikesStart < 0 || cmdStart < 0) {
  console.error({ buildStart, strikesStart, cmdStart, troopsEnd });
  throw new Error('Could not locate left panel section markers');
}

// Troops pane: from start through specialists (everything before BUILD header, including dividers)
/** Drop trailing closers that belonged to the outer #left-panel / #right-panel. */
function stripTrailingPanelClosers(s) {
  return s.replace(/(?:\s*<\/div>){1,4}\s*$/s, '').trim();
}

const troopsPane = leftInner.slice(0, buildStart).trim();
// Build pane: BUILD through end of academies (before STRIKES divider)
const strikesDiv = leftInner.lastIndexOf('<div class="panel-divider"></div>', strikesStart);
const buildPane = leftInner.slice(buildStart, strikesDiv >= 0 ? strikesDiv : strikesStart).trim();
// Strike pane: STRIKES + doctrines (until demolish)
const strikePane = leftInner.slice(strikesStart, cmdStart).trim();
// Cmd pane: demolish onward (strip original left-panel closer)
const cmdPane = stripTrailingPanelClosers(leftInner.slice(cmdStart));

const newLeft = `<div id="left-panel" class="side-panel">
          <nav class="side-panel-tabs" role="tablist" aria-label="Left command panel">
            <button type="button" class="side-tab active" data-side-tab="troops" role="tab" aria-selected="true">Troops</button>
            <button type="button" class="side-tab" data-side-tab="build" role="tab" aria-selected="false">Build</button>
            <button type="button" class="side-tab" data-side-tab="strike" role="tab" aria-selected="false">Strike</button>
            <button type="button" class="side-tab" data-side-tab="cmd" role="tab" aria-selected="false">Cmd</button>
          </nav>
          <div class="side-panel-scroll">
            <div class="side-tab-pane active" data-side-pane="troops" role="tabpanel">${troopsPane}
            </div>
            <div class="side-tab-pane" data-side-pane="build" role="tabpanel" hidden>${buildPane}
            </div>
            <div class="side-tab-pane" data-side-pane="strike" role="tabpanel" hidden>${strikePane}
            </div>
            <div class="side-tab-pane" data-side-pane="cmd" role="tabpanel" hidden>${cmdPane}
            </div>
          </div>
        </div>

        `;

html = html.slice(0, leftStart) + newLeft + html.slice(leftCloseAt);

// --- Right panel tabs ---
const rightOpen = '<div id="right-panel">';
const rightStart = html.indexOf(rightOpen);
const topBarStart = html.indexOf('<div id="top-bar">');
if (rightStart < 0 || topBarStart < 0) throw new Error('right panel bounds');
const rightInner = html.slice(rightStart + rightOpen.length, topBarStart);

const spyHeader = rightInner.indexOf('<div class="panel-header">SPY NETWORK</div>');
const courierHeader = rightInner.indexOf('<div class="panel-header">COURIER MSGS</div>');
const courierDiv = rightInner.lastIndexOf('<div class="panel-divider"></div>', courierHeader);

const intelPane = rightInner.slice(0, spyHeader).trim();
const spyPane = rightInner.slice(spyHeader, courierDiv >= 0 ? courierDiv : courierHeader).trim();
const courierPane = rightInner.slice(courierHeader).trim();

const newRight = `<div id="right-panel" class="side-panel">
          <nav class="side-panel-tabs" role="tablist" aria-label="Right ops panel">
            <button type="button" class="side-tab active" data-side-tab="spy" role="tab" aria-selected="true">Spy</button>
            <button type="button" class="side-tab" data-side-tab="courier" role="tab" aria-selected="false">Mail</button>
            <button type="button" class="side-tab" data-side-tab="ops" role="tab" aria-selected="false">Ops</button>
          </nav>
          <div class="side-panel-scroll">
            <div class="side-tab-pane active" data-side-pane="spy" role="tabpanel">${spyPane}
            </div>
            <div class="side-tab-pane" data-side-pane="courier" role="tabpanel" hidden>${courierPane}
            </div>
            <div class="side-tab-pane" data-side-pane="ops" role="tabpanel" hidden>
              ${intelPane}
            </div>
          </div>
        </div>

        `;

html = html.slice(0, rightStart) + newRight + html.slice(topBarStart);

// --- Top bar: wrap primary / meta / actions ---
const topOpen = '<div id="top-bar">';
const topStart = html.indexOf(topOpen);
// top-bar ends at next sibling of similar indent - message-box or unit-info or night-prep
// Find closing: look for </div> that closes top-bar after ach/creative buttons
// Simpler: find `<div id="message-box"` or night-prep or unit-info after top
const afterTopCandidates = [
  html.indexOf('<div id="message-box"', topStart),
  html.indexOf('<div id="night-prep-card"', topStart),
  html.indexOf('<div id="unit-info-panel"', topStart),
  html.indexOf('<div id="minimap-panel"', topStart),
].filter((i) => i > 0);
const topEndSibling = Math.min(...afterTopCandidates);
// Walk back to find the closing </div> of top-bar - the last </div> before sibling at same level is hard.
// Instead wrap contents by detecting begin-day through end of action buttons.
const topInnerEnd = html.lastIndexOf('</div>', topEndSibling);
// Find the structure: from after topOpen to the line before unit-info/minimap etc.
// Actually top-bar closes right before the next major absolute element. Search for pattern after creative/perf buttons.
const perfBtn = html.indexOf('id="perf-toggle"', topStart);
if (perfBtn < 0) throw new Error('perf-toggle not found');
// find end of button after perf-toggle
const afterPerf = html.indexOf('</button>', perfBtn) + '</button>'.length;
// skip whitespace then we should hit closing </div> of top-bar
let cursor = afterPerf;
while (html[cursor] === ' ' || html[cursor] === '\n' || html[cursor] === '\r') cursor++;
if (!html.startsWith('</div>', cursor)) {
  // maybe more content after perf
  const nextClose = html.indexOf('\n        </div>', afterPerf);
  if (nextClose < 0) throw new Error('top-bar close not found');
  cursor = nextClose + 1; // points to spaces before </div>
  cursor = html.indexOf('</div>', afterPerf);
}

const topInner = html.slice(topStart + topOpen.length, cursor).trim();

// Split top bar: primary stats (through cycle-hud), kingdom, meta stats, actions
const kingdomIdx = topInner.indexOf('id="kingdom-hud"');
const kingdomStart = topInner.lastIndexOf('<div', kingdomIdx);
const progIdx = topInner.indexOf('id="progression-restart-hud"');
const metaStart = progIdx >= 0 ? topInner.lastIndexOf('<div', progIdx) : -1;
const pauseIdx = topInner.indexOf('id="top-pause-btn"');
const actionsStart = pauseIdx >= 0 ? topInner.lastIndexOf('<button', pauseIdx) : -1;

if (kingdomStart < 0 || actionsStart < 0) {
  console.warn('Top bar wrap skipped — markers missing', { kingdomStart, actionsStart });
} else {
  const primary = topInner.slice(0, kingdomStart).trim();
  const kingdomBlock = topInner.slice(kingdomStart, metaStart > 0 ? metaStart : actionsStart).trim();
  const metaBlock =
    metaStart > 0 ? topInner.slice(metaStart, actionsStart).trim() : '';
  const actions = topInner.slice(actionsStart).trim();

  const newTop = `<div id="top-bar" class="top-bar-v2">
          <div class="top-bar-row top-bar-primary">
            ${primary}
            ${kingdomBlock}
          </div>
          <div class="top-bar-row top-bar-meta">
            ${metaBlock}
          </div>
          <div class="top-bar-row top-bar-actions">
            ${actions}
          </div>
        </div>`;

  html = html.slice(0, topStart) + newTop + html.slice(cursor + '</div>'.length);
}

// Add body class hook
html = html.replace('<body>', '<body class="ui-v2">');

writeFileSync(path, html);
console.log('HTML overhaul applied:', path);
console.log('theme link:', html.includes('theme-v2.css'));
console.log('side-tabs:', (html.match(/side-panel-tabs/g) || []).length);
console.log('top-bar-v2:', html.includes('top-bar-v2'));
