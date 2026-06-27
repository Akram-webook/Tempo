/* Fairness / Overload Radar — a TEAM-BALANCE support tool, not a manager scoreboard
 * and not surveillance (Constitution II). Tests the highest risks (SPEC):
 *   - ACCESS GATE: a non-manager can't open it; a manager sees ONLY their own team;
 *     a director sees across teams.
 *   - EXPLAINABLE + DETERMINISTIC: the band matches the numbers behind it.
 *   - BAND THRESHOLDS at boundaries (balanced / watch / unbalanced).
 *   - "NOT ENOUGH DATA" when a team has no assignments — never inferred.
 * capacity.loadForPerson is stubbed so the distribution math is fully deterministic. */
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
  const F = WP.fairness;
  assert(F && F.teamBalance && F.scan && F.canView, 'WP.fairness API present');

  const REF = '2026-06-27';

  // ---- deterministic stub: each person carries __load (current) and optional
  // __hist (past weeks). loadForPerson reads them so distribution is exact. ----
  function shiftISO(refISO, days) { const d = new Date(refISO + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
  WP.capacity.loadForPerson = function (person, win, iso) {
    if (iso === REF || iso == null) return person.__load || 0;
    // map a past-week iso back to its index for the sustained check
    for (let i = 0; i < 8; i++) { if (iso === shiftISO(REF, -7 * i)) return (person.__hist && person.__hist[i] != null) ? person.__hist[i] : (person.__load || 0); }
    return person.__load || 0;
  };

  // Build a synthetic org we fully control, then point the access model at it.
  const REAL_PEOPLE = WP.data.PEOPLE.slice();
  function setOrg(people) { WP.data.PEOPLE.length = 0; people.forEach(p => WP.data.PEOPLE.push(p)); }
  function P(o) { return Object.assign({ assignedEvents: o.__load ? ['e'] : [], tbc: false }, o); }

  // mgr A: 2 over (120,110), 2 light (20,10) → big spread + uneven, sustained → UNBALANCED
  // mgr B: all balanced around 60 → BALANCED
  // mgr C: no assignments → NOT ENOUGH DATA
  const dir = P({ id: 'p_dir', level: 'director', managerId: null });
  const mgrA = P({ id: 'p_a', level: 'manager', managerId: 'p_dir', name: 'A', nameAr: 'أ' });
  const mgrB = P({ id: 'p_b', level: 'manager', managerId: 'p_dir', name: 'B', nameAr: 'ب' });
  const mgrC = P({ id: 'p_c', level: 'manager', managerId: 'p_dir', name: 'C', nameAr: 'ج' });
  const spec = P({ id: 'p_s', level: 'spec', managerId: 'p_c', __load: 0 }); // a peer / IC (parked under the no-data team so it never skews a measured team)

  const a1 = P({ id: 'a1', level: 'spec', managerId: 'p_a', __load: 120, __hist: [120, 120, 120, 120] });
  const a2 = P({ id: 'a2', level: 'spec', managerId: 'p_a', __load: 110, __hist: [110, 110, 110, 110] });
  const a3 = P({ id: 'a3', level: 'spec', managerId: 'p_a', __load: 20,  __hist: [20, 20, 20, 20] });
  const a4 = P({ id: 'a4', level: 'spec', managerId: 'p_a', __load: 10,  __hist: [10, 10, 10, 10] });
  const b1 = P({ id: 'b1', level: 'spec', managerId: 'p_b', __load: 60 });
  const b2 = P({ id: 'b2', level: 'spec', managerId: 'p_b', __load: 65 });
  const b3 = P({ id: 'b3', level: 'spec', managerId: 'p_b', __load: 55 });
  const c1 = P({ id: 'c1', level: 'spec', managerId: 'p_c', __load: 0 }); // no assignment
  const c2 = P({ id: 'c2', level: 'spec', managerId: 'p_c', __load: 0 });
  const tbc = P({ id: 'c_tbc', level: 'spec', managerId: 'p_b', tbc: true, __load: 0 }); // placeholder, must be ignored

  setOrg([dir, mgrA, mgrB, mgrC, spec, a1, a2, a3, a4, b1, b2, b3, c1, c2, tbc]);

  // ---- band correctness + explainability ----
  const balA = F.teamBalance('p_a', REF);
  assert(balA.band === 'unbalanced', 'team A: 2 over + 2 light + big spread + sustained → unbalanced (got ' + balA.band + ')');
  assert(balA.metrics.overloaded === 2 && balA.metrics.light === 2, 'team A: counts match (2 over, 2 light)');
  assert(balA.metrics.spread === 110, 'team A: spread is max−min = 120−10 = 110');
  assert(!!balA.suggestedAction && /rebalance|relief|hire/i.test(balA.suggestedAction.en), 'team A: carries a concrete suggested action');
  assert(balA.factors.every(f => f.en && f.ar), 'team A: every factor has EN + AR');
  // explainable: the spread factor states the exact numbers that drove the band
  assert(balA.factors.some(f => f.key === 'spread' && /110/.test(f.en)), 'team A: spread factor shows the numbers (explainable)');

  const balB = F.teamBalance('p_b', REF);
  assert(balB.band === 'balanced', 'team B: tight spread, none over → balanced (got ' + balB.band + ')');
  assert(balB.suggestedAction === null, 'team B: a balanced team needs no action');
  assert(balB.size === 3, 'team B: TBC placeholder excluded from members (3 real, not 4)');

  const balC = F.teamBalance('p_c', REF);
  assert(balC.noData === true && balC.band === null, 'team C: no assignments → not enough data (never inferred)');

  // ---- band thresholds at the boundaries (CONFIG-driven) ----
  const CFG = F.CONFIG;
  // a watch-only team: one just over capacity but no light members, modest spread
  const w1 = P({ id: 'w1', level: 'spec', managerId: 'p_w', __load: CFG.overloadPct, __hist: [CFG.overloadPct, 50, 50, 50] });
  const w2 = P({ id: 'w2', level: 'spec', managerId: 'p_w', __load: 80 });
  const mgrW = P({ id: 'p_w', level: 'manager', managerId: 'p_dir' });
  setOrg([dir, mgrW, w1, w2]);
  const balW = F.teamBalance('p_w', REF);
  assert(balW.band === 'watch', 'boundary: one over capacity, no light member, one-off → watch (got ' + balW.band + ')');

  // whole-team overload (≥75% over) → unbalanced with a "relief / hire" action
  const o1 = P({ id: 'o1', level: 'spec', managerId: 'p_o', __load: 130, __hist: [130, 130, 130, 130] });
  const o2 = P({ id: 'o2', level: 'spec', managerId: 'p_o', __load: 120, __hist: [120, 120, 120, 120] });
  const mgrO = P({ id: 'p_o', level: 'manager', managerId: 'p_dir' });
  setOrg([dir, mgrO, o1, o2]);
  const balO = F.teamBalance('p_o', REF);
  assert(balO.band === 'unbalanced' && /relief|hire/i.test(balO.suggestedAction.en), 'whole-team overload → unbalanced + relief/hire action');

  // ---- ACCESS GATE (the #1 risk) ----
  setOrg([dir, mgrA, mgrB, mgrC, spec, a1, a2, a3, a4, b1, b2, b3, c1, c2, tbc]);
  assert(F.canView(spec) === false, 'gate: a specialist (IC / peer) cannot open the radar');
  assert(F.scan(spec.id, REF).length === 0, 'gate: scan() returns nothing for a non-manager');

  assert(F.canView(mgrA) === true, 'gate: a line manager can open the radar');
  const scanA = F.scan(mgrA.id, REF);
  assert(scanA.length === 1 && scanA[0].managerId === 'p_a', 'gate: a manager sees ONLY their own team (not B or C)');

  assert(F.canView(dir) === true, 'gate: a director can open the radar');
  const scanDir = F.scan(dir.id, REF);
  const dirTeams = scanDir.map(x => x.managerId);
  assert(dirTeams.indexOf('p_a') !== -1 && dirTeams.indexOf('p_b') !== -1 && dirTeams.indexOf('p_c') !== -1, 'gate: a director sees across all teams');
  // worst-first ordering: the unbalanced team comes before the balanced one
  assert(scanDir[0].band === 'unbalanced', 'scan: worst balance is surfaced first');

  // ---- restore the real org so any later suite sees untouched data ----
  setOrg(REAL_PEOPLE);
} catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS — fairness: explainable deterministic bands, correct thresholds, "not enough data" honoured, and a tight access gate (peers/non-managers see nothing; a manager sees only their own team).');
process.exit(0);
