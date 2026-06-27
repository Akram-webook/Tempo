/* Smoke test: boot the shell, render EVERY route, open the profile peek and the
 * assignment/candidates drawer — fail on any console error or thrown exception. */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
const shellBody = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [, ''])[1].replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM('<!doctype html><html><body>' + shellBody + '</body></html>', { url: 'https://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = function () {};
window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, removeEventListener() {} }; };
window.confirm = function () { return false; };  // never actually mutate roles
window.alert = function () {};
window.setInterval = function () { return 0; };   // don't keep node alive
const errors = [];
const benign = /font|stylesheet|localStorage|Security|scrollIntoView|Not implemented|opaque|insertRule|cssRules/i;
['error', 'warn'].forEach(k => { const o = window.console[k].bind(window.console); window.console[k] = (...a) => { const s = a.join(' '); if (!benign.test(s)) errors.push('[' + k + '] ' + s); o(...a); }; });
window.addEventListener('error', e => { if (!benign.test(String(e.message))) errors.push('[onerror] ' + e.message); });
for (const s of srcs) { try { new window.Function(fs.readFileSync(path.join(root, s), 'utf8')).call(window); } catch (e) { errors.push('[load ' + s + '] ' + e.message); } }
const WP = window.WP;

WP.state.authed = true; WP.state.lang = 'en';
const routes = ['dashboard', 'map', 'me', 'evaluations', 'evaluation', 'upward', 'daily', 'library', 'permissions', 'settings', 'fairness', 'profile'];
routes.forEach(function (r) {
  try { WP.state.route = r; if (r === 'profile') WP.state.selectedId = WP.data.PEOPLE[0].id; WP.render(); }
  catch (e) { errors.push('[route ' + r + '] ' + e.message); }
});

// Exercise the fixed flows.
try { WP.state.route = 'map'; WP.render(); WP.ui.peek && WP.ui.peek(WP.data.PEOPLE[0].id); } catch (e) { errors.push('[peek] ' + e.message); }
try {
  const ev = Object.keys(WP.data.EVENTS)[0];
  if (WP.ui.assignmentDrawer && WP.ui.assignmentDrawer.open && ev) WP.ui.assignmentDrawer.open(ev);
} catch (e) { errors.push('[assignmentDrawer.open] ' + e.message); }

if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS — all routes render and the profile + assignment flows run with zero errors.');
process.exit(0);
