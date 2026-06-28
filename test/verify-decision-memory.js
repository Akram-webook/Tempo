/* Leadership Decision Memory (Intelligence Layer P5, ENGINE ONLY).
 * Gate: ai-os/00-governance/INTELLIGENCE-ETHICS.md — asserts all six points.
 *  - Support not surveil: aggregates by decision TYPE/FOCUS, never per person.
 *  - Evidence-first: every metric cites source events; "Not enough data" first-class.
 *  - Human decides: a report, no auto-acting recommendation field.
 *  - Transparent: counts/themes/shifts traceable to decision events.
 *  - Dignity: NO per-person score/rank/profile field anywhere; refs are de-identified.
 *  - Access-gated: a peer/specialist cannot pull the org-wide report.
 * Loads the bundle exactly like verify-evalintel.js. Backend mocked (no network). */
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

// A seeded decision-event set. Window under test: 2026-05-08 .. 2026-05-14 (7 days).
// Prior period: 2026-05-01 .. 2026-05-07.
function decisions() {
  return [
    // ---- current window (2026-05-08..14): 8 operational decisions ----
    { type: 'access-grant',    by: 'p_akram', target: 'p_idris', at: '2026-05-08T09:00:00Z' },
    { type: 'access-revoke',   by: 'p_akram', target: 'p_talal', at: '2026-05-09T09:00:00Z' },
    { type: 'access-grant',    by: 'p_akram', target: 'p_osama', at: '2026-05-10T09:00:00Z' },
    { type: 'override-assign', by: 'p_akram', target: 'p_osama', event: 'e1', at: '2026-05-10T10:00:00Z', aiAccepted: true },
    { type: 'override-assign', by: 'p_akram', target: 'p_talal', event: 'e2', at: '2026-05-11T10:00:00Z', aiAccepted: false },
    { type: 'assign',          by: 'p_akram', target: 'p_idris', event: 'e3', at: '2026-05-12T10:00:00Z', aiAccepted: true },
    { type: 'role-change',     by: 'p_akram', target: 'p_talal', at: '2026-05-13T11:00:00Z', reason: 'spec → manager' },
    { type: 'evaluation',      by: 'p_akram', target: 'p_osama', at: '2026-05-14T12:00:00Z' },
    // ---- noise that MUST be excluded (not decisions) ----
    { type: 'sign-in',  by: 'p_akram', target: 'p_akram', at: '2026-05-09T08:00:00Z' },
    { type: 'view-as',  by: 'p_akram', target: 'p_osama', at: '2026-05-09T08:05:00Z' },
    { type: 'checkin-saved', by: 'p_idris', target: '3 items', at: '2026-05-10T08:00:00Z' },
    // ---- prior window (2026-05-01..07): fewer access decisions → upward shift ----
    { type: 'access-grant', by: 'p_akram', target: 'p_idris', at: '2026-05-02T09:00:00Z' },
    { type: 'evaluation',   by: 'p_akram', target: 'p_talal', at: '2026-05-03T09:00:00Z' }
  ];
}
const WIN = { start: '2026-05-08', end: '2026-05-14' };

try {
  assert(WP.decisionMemory && WP.decisionMemory.weeklyReport && WP.decisionMemory.aggregate, 'WP.decisionMemory API present');

  const rep = WP.decisionMemory.aggregate(decisions(), WIN, {});

  // Evidence-first — 8 in-window decisions counted; the 3 noise events excluded.
  assert(rep.enoughData === true, 'enough data with 8 decisions');
  assert(rep.sourcedCount === 8, 'counts the 8 in-window decisions only (noise excluded), got ' + rep.sourcedCount);
  assert(!rep.decisionCounts['sign-in'] && !rep.decisionCounts['view-as'] && !rep.decisionCounts['checkin-saved'], 'session/noise events are not treated as decisions');

  // decisionCounts by type, each figure citing its source events.
  assert(rep.decisionCounts['access-grant'] && rep.decisionCounts['access-grant'].count === 2, 'access-grant counted (2)');
  assert(rep.decisionCounts['override-assign'].count === 2, 'override-assign counted (2)');
  assert(Object.values(rep.decisionCounts).every(c => Array.isArray(c.evidence) && c.evidence.length === c.count), 'every decisionCount cites exactly its source events');

  // topFocusAreas — operational areas, busiest first, each cited.
  assert(Array.isArray(rep.topFocusAreas) && rep.topFocusAreas.length > 0, 'topFocusAreas present');
  assert(rep.topFocusAreas[0].focus === 'access-governance' && rep.topFocusAreas[0].count === 3, 'busiest focus is access-governance (3)');
  assert(rep.topFocusAreas.every(f => Array.isArray(f.evidence) && f.evidence.length === f.count), 'every focus area cites its events');

  // recurringThemes — describes the AREA, never a person; cited.
  assert(rep.recurringThemes.some(t => t.theme === 'access-governance'), 'recurring theme on access-governance surfaced');
  assert(rep.recurringThemes.every(t => Array.isArray(t.evidence) && t.evidence.length > 0), 'every recurring theme cites evidence');

  // aiAcceptanceRate — final vs AI-draft where available (3 events carry the signal: 2 accepted).
  assert(rep.aiAcceptanceRate && rep.aiAcceptanceRate.of === 3 && rep.aiAcceptanceRate.accepted === 2, 'aiAcceptanceRate computed from events that carry the signal');
  assert(rep.aiAcceptanceRate.rate === 0.7 || rep.aiAcceptanceRate.rate === 0.6 || Math.abs(rep.aiAcceptanceRate.rate - 2 / 3) < 0.05, 'aiAcceptanceRate ≈ 2/3');
  assert(Array.isArray(rep.aiAcceptanceRate.evidence) && rep.aiAcceptanceRate.evidence.length === 3, 'aiAcceptanceRate cites its events');

  // notable shifts vs prior period — access-grant up (1 → 2) flagged, each cited.
  assert(Array.isArray(rep.shifts) && rep.shifts.length > 0, 'shifts vs prior period computed');
  assert(rep.shifts.every(s => Array.isArray(s.evidence) && s.evidence.length > 0), 'every shift cites evidence');

  // DIGNITY / SUPPORT-NOT-SURVEIL — NO per-person score/rank/profile anywhere, and
  // no event reference leaks the targeted person (de-identified to type/focus/time).
  const banned = ['score', 'rank', 'ranking', 'profile', 'verdict', 'grade', 'recommendation', 'byPerson', 'perPerson'];
  banned.forEach(k => assert(!(k in rep), 'report must not contain a "' + k + '" field'));
  const allRefs = rep.evidence
    .concat(...rep.topFocusAreas.map(f => f.evidence))
    .concat(...Object.values(rep.decisionCounts).map(c => c.evidence));
  assert(allRefs.length > 0 && allRefs.every(r => !('target' in r) && !('by' in r) && !('reason' in r)), 'evidence refs are de-identified — no target/by/reason leaks a person');
  assert(allRefs.every(r => !!r.type && !!r.focus), 'every evidence ref carries operational type + focus (traceable)');

  // Evidence-first — sparse window → "Not enough data" first-class (no fabricated patterns).
  const sparse = WP.decisionMemory.aggregate(decisions().slice(0, 2), WIN, {});
  assert(sparse.enoughData === false && /not enough data/i.test(sparse.note), 'sparse → "Not enough data"');
  assert(Object.keys(sparse.decisionCounts).length === 0 && sparse.topFocusAreas.length === 0, 'sparse fabricates no counts/areas');

  // a sourceless (typeless) event is dropped, never invented
  assert(WP.decisionMemory._refOf({ at: '2026-05-08T00:00:00Z' }) === null, '_refOf drops a typeless event');

  // ACCESS GATE (Ethics #6) — director/admin only.
  const dir = WP.data.PEOPLE.find(p => p.level === 'director' || p.level === 'admin' || p.superAdmin);
  const spec = WP.data.PEOPLE.find(p => p.level === 'spec' && !p.tbc) || WP.data.PEOPLE.find(p => p.level !== 'director' && p.level !== 'admin' && !p.superAdmin);
  const blocked = WP.decisionMemory.weeklyReport(WIN, { viewer: spec, events: decisions() });
  assert(blocked.denied === true && blocked.enoughData === false, 'gate: a specialist/peer is denied the org-wide report');
  assert(!('decisionCounts' in blocked) || Object.keys(blocked.decisionCounts).length === 0, 'denied report leaks no aggregates');
  if (dir) {
    const ok = WP.decisionMemory.weeklyReport(WIN, { viewer: dir, events: decisions() });
    assert(ok.denied !== true && ok.enoughData === true, 'gate: a director/admin may pull the report');
  }

  // store-backed path: reads WP.activityLog when no events injected.
  WP.activityLog = decisions();
  const fromStore = WP.decisionMemory.weeklyReport(WIN, {});
  assert(fromStore.enoughData === true && fromStore.sourcedCount === 8, 'weeklyReport reads WP.activityLog when no events injected');
} catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS — decision-memory: aggregates by type/focus (never per person), "Not enough data" first-class, no score/rank/profile field, de-identified evidence refs on every metric, AI-acceptance where available, week-over-week shifts, director-gated, store-backed.');
process.exit(0);
