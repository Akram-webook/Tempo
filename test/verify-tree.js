/* Headless verify: load all app scripts in jsdom, render the workload map, exercise the
 * readability features (vertical stack, compact/detailed density, focus mode, per-user
 * persistence, RTL), and fail on any console error. */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://localhost/', pretendToBeVisual: true, runScripts: 'outside-only',
});
const { window } = dom;
const errors = [];
// Benign-noise filter (fonts/link/opaque/localStorage/Security/scrollIntoView/stylesheet)
const benign = /font|stylesheet|localStorage|Security|scrollIntoView|Not implemented|opaque|insertRule|cssRules/i;
['error', 'warn'].forEach(k => {
  const orig = window.console[k].bind(window.console);
  window.console[k] = (...a) => { const s = a.join(' '); if (!benign.test(s)) errors.push('[' + k + '] ' + s); orig(...a); };
});
window.addEventListener('error', e => { if (!benign.test(String(e.message))) errors.push('[onerror] ' + e.message); });
// jsdom lacks these — stub so code under test doesn't trip the error channel
window.HTMLElement.prototype.scrollIntoView = function () {};
window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, removeEventListener() {} }; };

for (const s of srcs) {
  const code = fs.readFileSync(path.join(root, s), 'utf8');
  const script = new window.Function(code);
  try { script.call(window); } catch (e) { errors.push('[load ' + s + '] ' + e.message); }
}

const WP = window.WP;
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

// Expand every collapsed branch in the current render so deep subtrees (and their
// vertical stacks) are visible. Clicks each caret once.
function expandAll(el) {
  let guard = 0;
  while (guard++ < 12) {
    const cols = el.querySelectorAll('.node-caret.is-col');
    if (!cols.length) break;
    cols.forEach(c => c.click());
  }
}

try {
  // Force a viewer with full visibility (director) so the whole tree renders.
  if (WP.access && WP.access.grantAccess) { try { WP.access.grantAccess('akram@webook.com'); } catch (e) {} }
  // A signed-in identity so the per-user density key is namespaced (not a global key).
  if (WP.identity && WP.identity.adopt) { try { WP.identity.adopt('akram@webook.com'); } catch (e) {} }
  // Start from a known density (clear any persisted value).
  try { window.localStorage.removeItem(WP.identity.nsKey('tempo_map_density')); } catch (e) {}
  WP.state.lang = 'en';
  const el = window.document.getElementById('app');

  WP.ui.workloadMap.render(el);

  const nodes = el.querySelectorAll('.tree .node');
  assert(nodes.length > 0, 'tree rendered some nodes (' + nodes.length + ')');
  assert(el.querySelector('.node-ava[data-profile]'), 'avatar profile target present');

  // --- COMPACT is the default + the workload COLOR is always shown ---------------
  assert(el.querySelector('.node-compact'), 'compact density is the default (node-compact present)');
  assert(el.querySelector('.loadbar .loadbar-pct'), 'workload color/status indicator present in compact');
  assert(!el.querySelector('.tree .node .ttl'), 'compact hides the detail (no title line) by default');

  // --- VERTICAL STACK: an expanded manager lays reports DOWN (ul.stack), not across ---
  expandAll(el);
  const stacks = el.querySelectorAll('.tree ul.stack');
  assert(stacks.length > 0, 'expanded teams render a vertical stack (ul.stack) — ' + stacks.length);
  // The top-level department row stays horizontal: the FIRST ul under the root is NOT a stack.
  const rootUl = el.querySelector('.tree > li > ul');
  assert(rootUl && !rootUl.classList.contains('stack'), 'top-level departments stay horizontal (root ul is not a stack)');
  // A stack holds its reports as block list items (stacked), each a real card.
  assert(stacks[0].querySelector(':scope > li .node'), 'stacked reports are full cards under their manager');

  // --- DETAIL on peek: the popover reuses WP.ui.peek (no new popover built) ----------
  assert(typeof WP.ui.peek === 'function', 'node-peek popover available (reused)');
  const ava = el.querySelector('.node-ava[data-profile]');
  let peeked = false; const realPeek = WP.ui.peek;
  WP.ui.peek = function (id) { peeked = !!id; };
  ava.click();
  WP.ui.peek = realPeek;
  assert(peeked, 'clicking a card avatar opens the node-peek detail');

  // --- DETAILED density restores the full card (title + employment labels) ----------
  WP.ui.workloadMap.render(el);   // re-render fresh
  const densityBtn = el.querySelector('#density-dd-btn');
  assert(densityBtn, 'density toggle present near the Tree/Period controls');
  densityBtn.click();
  const detailedOpt = el.querySelector('#density-dd-menu .dd-opt[data-val="detailed"]');
  assert(detailedOpt, 'density menu offers a Detailed option');
  detailedOpt.click();
  expandAll(el);
  assert(el.querySelector('.tree .node .ttl'), 'detailed density shows the full card (title line back)');
  const txt = el.textContent;
  assert(/Full-time/.test(txt), 'detailed shows Full-time label');
  assert(/Freelance/.test(txt), 'detailed shows Freelance label');

  // --- toggle PERSISTS per signed-in user (namespaced key, not a global one) ---------
  let stored = null;
  try { stored = window.localStorage.getItem(WP.identity.nsKey('tempo_map_density')); } catch (e) {}
  assert(stored === 'detailed', 'density persists under the per-user namespaced key (got ' + stored + ')');
  assert(WP.identity.nsKey('tempo_map_density').indexOf('::') > 0, 'density key is identity-namespaced (no global key)');

  // --- FOCUS MODE: drilling in hides sibling branches; Back restores them ------------
  WP.ui.workloadMap.render(el);
  expandAll(el);
  const before = el.querySelectorAll('.tree .node').length;
  // Focus a DEPARTMENT (a branch node that itself has a manager), not the root director —
  // focusing the root would change nothing.
  const focusBtns = [].slice.call(el.querySelectorAll('.node-focus[data-focus]'));
  assert(focusBtns.length > 0, 'every branch node carries a Focus action');
  const deptBtn = focusBtns.find(b => { const p = WP.access.byId(b.dataset.focus); return p && p.managerId; });
  assert(deptBtn, 'a department-level Focus action exists');
  deptBtn.click();
  const during = el.querySelectorAll('.tree .node').length;
  assert(during < before, 'focus hides sibling branches (' + before + ' -> ' + during + ')');
  // Back to Organization is wired through the breadcrumb component (#45).
  const back = el.querySelector('.wbk-bc a[data-bc-go="map"]');
  assert(back, 'focus shows a "Back to Organization" breadcrumb link');
  // The map's capture-phase handler clears focus; emulate the app's re-render after nav.
  back.click();
  WP.ui.workloadMap.render(el);
  expandAll(el);
  const after = el.querySelectorAll('.tree .node').length;
  assert(after === before, 'Back restores the whole org (' + during + ' -> ' + after + ')');

  // --- RTL: the whole view re-renders in Arabic without errors -----------------------
  WP.state.lang = 'ar';
  window.document.documentElement.setAttribute('dir', 'rtl');
  WP.ui.workloadMap.render(el);
  assert(el.querySelector('.tree .node'), 'tree still renders in AR/RTL');
  assert(/تركيز على الفريق|العودة إلى المؤسسة|مُوجز|مفصّل/.test(el.innerHTML), 'AR labels present (focus / back / density)');
} catch (e) {
  errors.push('[run] ' + e.message + '\n' + e.stack);
}

if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS — workload map: compact default (+workload color), vertical stack under expanded managers (departments stay horizontal), detail-on-peek, detailed restores full card, density persists per-user (namespaced), focus hides siblings + breadcrumb Back restores, RTL renders.');
process.exit(0);   // stop the 10s auto-refresh timer so the harness exits cleanly
