/* Wellbeing Early-Warning — support tool, not surveillance (Constitution II).
 * Tests the two highest risks (SPEC): ACCESS LEAKAGE (a peer must never see
 * another's risk) and FALSE FRAMING (no factor implies hours/surveillance),
 * plus deterministic + explainable scoring and correct band boundaries.
 * capacity/engage are stubbed so scoring is fully deterministic. */
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
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

try {
  const W = WP.wellbeing;
  assert(W && W.scoreForPerson && W.atRisk && W.canView, 'WP.wellbeing API present');

  // ---- deterministic stubs (isolate wellbeing's own logic) ----
  const REF = '2026-06-27';
  function shiftISO(refISO, days) { const d = new Date(refISO + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
  const WK = [0, 1, 2, 3].map(i => shiftISO(REF, -7 * i)); // current → older
  WP.capacity.loadForPerson = function (person, win, iso) { return (person.__loads && person.__loads[iso] != null) ? person.__loads[iso] : 0; };
  WP.capacity.burnoutSignal = function (person) { return !!person.__clash; };
  const ENG = {};
  WP.engage.snapshot = function () { return ENG; };
  function loads(arr) { const m = {}; WK.forEach((iso, i) => { m[iso] = arr[i]; }); return m; }

  // ---- band boundaries ----
  assert(W.bandFor(0) === null && W.bandFor(1) === null, 'band: <2 = not flagged');
  assert(W.bandFor(2) === 'watch' && W.bandFor(3) === 'watch', 'band: 2–3 = watch');
  assert(W.bandFor(4) === 'atRisk' && W.bandFor(6) === 'atRisk', 'band: 4–6 = atRisk');
  assert(W.bandFor(7) === 'critical', 'band: >=7 = critical');

  // ---- scoring + explainability (score === sum of factor points) ----
  const allKeys = [];
  function check(person, label) {
    const r = W.scoreForPerson(person, REF);
    const sum = r.factors.reduce((a, f) => a + f.points, 0);
    assert(sum === r.score, label + ': score equals sum of factor points (explainable)');
    if (r.band) assert(!!r.suggestedAction, label + ': a flagged person carries a suggested relief action');
    r.factors.forEach(f => { allKeys.push(f.key); assert(f.en && f.ar, label + ': factor has EN+AR (' + f.key + ')'); });
    return r;
  }

  // sustained overload only: 4 weeks >100% → min(4,3)*2 = 6 → atRisk
  const rOver = check({ id: 'x_over', __loads: loads([120, 120, 120, 120]) }, 'overload');
  assert(rOver.band === 'atRisk' && rOver.factors.length === 1 && rOver.factors[0].key === 'sustainedOverload', 'overload: single factor, atRisk band');

  // rising + sustained + clash → 4 + 2 + 2 = 8 → critical
  const rCrit = check({ id: 'x_crit', __clash: true, __loads: loads([130, 120, 60, 50]) }, 'critical');
  assert(rCrit.band === 'critical', 'critical: rising+sustained+clash lands critical');
  assert(rCrit.factors.some(f => f.key === 'risingTrend') && rCrit.factors.some(f => f.key === 'scheduleClash'), 'critical: includes rising + clash factors');

  // check-in decline only → watch (and proves the factor fires only with real data)
  ENG.x_check = { weekGoal: 8, weekDone: 1 };
  const rCheck = check({ id: 'x_check', __loads: loads([40, 40, 40, 40]) }, 'checkins');
  assert(rCheck.band === 'watch' && rCheck.factors.length === 1 && rCheck.factors[0].key === 'missedCheckins', 'checkins: single factor, watch band');

  // clean person → no band (empty state is a GOOD outcome)
  const rClean = check({ id: 'x_clean', __loads: loads([40, 40, 40, 40]) }, 'clean');
  assert(rClean.band === null && rClean.factors.length === 0, 'clean: no risk, not flagged');

  // ---- no surveillance / no hours: factor keys are a known, safe set ----
  const ALLOWED = ['sustainedOverload', 'risingTrend', 'scheduleClash', 'missedCheckins'];
  const BANNED = ['hours', 'clockedHours', 'activity', 'keystrokes', 'idle', 'screen'];
  assert(allKeys.every(k => ALLOWED.indexOf(k) !== -1), 'no-surveillance: only workload factors are used');
  assert(allKeys.every(k => BANNED.indexOf(k) === -1), 'no-surveillance: no hours/activity factor exists');
  // omitted factors are stated, never fabricated
  assert(rClean.omitted.some(o => o.key === 'recovery'), 'transparency: missing leave data is declared omitted, not invented');

  // ---- ACCESS LEAKAGE (the #1 risk) — uses the REAL access model ----
  const spec = WP.data.PEOPLE.find(p => p.level === 'spec' && !p.tbc);
  const peer = WP.data.PEOPLE.find(p => p.level !== 'spec' && p.managerId === spec.managerId && p.id !== spec.id)
            || WP.data.PEOPLE.find(p => p.id !== spec.id);
  assert(spec, 'found a specialist (peer) to test the gate');
  assert(W.canView(spec) === false, 'gate: a specialist (peer) cannot open the wellbeing view');
  assert(WP.access.canSeeSensitive(spec, peer.id) === false, 'gate: a peer cannot see another peer’s sensitive signal');
  assert(W.atRisk(spec.id, REF).length === 0, 'gate: atRisk() returns nothing for a non-manager');

  const director = WP.data.PEOPLE.find(p => p.level === 'director');
  const lineMgr = WP.data.PEOPLE.find(p => WP.access.directReports(p.id).length > 0 && p.level !== 'director' && p.level !== 'admin');
  assert(director && W.canView(director) === true, 'gate: a director can open the wellbeing view');
  assert(lineMgr && W.canView(lineMgr) === true, 'gate: a line manager (has reports) can open the view');
} catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS — wellbeing: deterministic explainable scoring, correct bands, no-surveillance factors, and no access leakage (peers never see another’s risk).');
process.exit(0);
