/* F6 — a broken engine must NOT masquerade as "no evidence". events.derive() wraps
 * each signal branch in try/catch; a SILENT catch makes a wiring regression look
 * identical to a genuine absence. This proves: (1) when a derive branch throws, a
 * dev-mode console warning naming the branch is emitted; (2) the OTHER branches'
 * events still come back (one bad engine doesn't blank the timeline); (3) in
 * production mode the warning is silent; (4) user-facing behaviour is unchanged
 * (still no fabricated events). */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: 'https://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = function () {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const errors = [];
for (const s of srcs) { try { new window.Function(fs.readFileSync(path.join(root, s), 'utf8')).call(window); } catch (e) { errors.push('[load ' + s + '] ' + e.message); } }
const WP = window.WP;
if (WP) WP.render = function () {};
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

// Capture console.warn (the dev signal).
const warnings = [];
window.console.warn = function () { warnings.push(Array.prototype.join.call(arguments, ' ')); };

const subject = 'p_osama';   // has workload + a completed eval etc. in the mock

(async () => {
  try {
    assert(WP.events && WP.events.derive, 'WP.events.derive present');

    // Baseline (dev mode = localhost): healthy engines, no warnings, some events.
    WP.config.debug = true;                 // force dev mode deterministically
    warnings.length = 0;
    const healthy = WP.events.derive(subject);
    assert(Array.isArray(healthy), 'baseline: derive returns an array');
    assert(warnings.length === 0, 'baseline: healthy engines emit NO warnings');

    // --- 1+2) Break ONE engine (wellbeing) and confirm: warning fires naming the
    //          branch, AND the other branches' events still return. -------------
    const realScoreFor = WP.wellbeing.scoreFor;
    WP.wellbeing.scoreFor = function () { throw new Error('wiring regression: scoreFor blew up'); };
    warnings.length = 0;
    const withBreak = WP.events.derive(subject);
    WP.wellbeing.scoreFor = realScoreFor;   // restore

    const wellbeingWarn = warnings.find(w => w.indexOf('wellbeing') !== -1);
    assert(wellbeingWarn, '1: a dev warning is emitted naming the "wellbeing" branch');
    assert(wellbeingWarn && wellbeingWarn.indexOf('events.derive') !== -1 && wellbeingWarn.indexOf('NOT absence of evidence') !== -1, '1: the warning is explicit that this is a wiring fault, not absence');
    assert(wellbeingWarn && wellbeingWarn.indexOf('wiring regression: scoreFor blew up') !== -1, '1: the warning includes the underlying error message');

    assert(Array.isArray(withBreak), '2: derive still returns an array when one branch throws');
    assert(!withBreak.some(e => e.category === 'wellbeing'), '2: the broken (wellbeing) branch emits nothing');
    // The healthy branches still produce their events — one bad engine doesn't blank the timeline.
    assert(withBreak.some(e => e.category !== 'wellbeing'), '2: OTHER branches still produce events (timeline not blanked)');
    assert(withBreak.every(e => e.source), '2: still no fabrication — every returned event carries a source (Ethics #2)');

    // --- 3) Production mode: the same break stays SILENT. ---------------------
    WP.config.debug = false;                // explicit production
    WP.wellbeing.scoreFor = function () { throw new Error('boom in prod'); };
    warnings.length = 0;
    const prod = WP.events.derive(subject);
    WP.wellbeing.scoreFor = realScoreFor;
    assert(warnings.length === 0, '3: production mode emits NO warning (silent for users)');
    assert(Array.isArray(prod) && !prod.some(e => e.category === 'wellbeing'), '3: production behaviour unchanged — graceful, no wellbeing event, no throw');
  } catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

  if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS — F6 derive resilience: a thrown engine branch logs a dev warning naming the branch (explicitly a wiring fault, not absence), the other branches still return their events (timeline never blanked), every event still carries a source, and production stays silent.');
  process.exit(0);
})();
