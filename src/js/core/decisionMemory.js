/* ============================================================
 * Tempo — Leadership Decision Memory (Intelligence Layer P5, core · ENGINE ONLY)
 * SPEC: docs/SPEC-decision-memory.md · GATE: ai-os/00-governance/INTELLIGENCE-ETHICS.md
 * ------------------------------------------------------------
 * Aggregates the DECISION events already in the store (WP.activityLog via
 * WP.logEvent: role changes, access grants/revokes, assignments/overrides, eval
 * approvals, cycle/config changes) into OPERATIONAL patterns a leader can act on —
 * focus areas, recurring concerns, AI-acceptance rate, week-over-week shifts.
 *
 * It reports on the SHAPE OF DECISIONS, never on people. Hard guardrails
 * (enforced here + asserted in test/verify-decision-memory.js):
 *  - Support, not surveil — operational decision patterns only; NEVER a profile,
 *    personality read, or behaviour judgement of any individual. (Ethics #1)
 *  - Evidence-first — every figure cites the source decision events it came from;
 *    "Not enough data" is a first-class result when the window is sparse. (Ethics #2)
 *  - Human decides — this INFORMS; it carries no auto-acting recommendation. (#3)
 *  - Transparent — every metric is traceable to the decision events behind it. (#4)
 *  - Dignity — everything is aggregate/rolled-up by decision TYPE, never keyed by a
 *    person; NO per-person score/rank/profile field. No naming-and-shaming. (#5)
 *  - Access-gated — director/admin only (reuse canManage); never peer-visible. (#6)
 *
 * NO DOM, NO network. The Weekly Report VIEW surfaces this in a later wave.
 * ========================================================== */
(function (WP) {
  'use strict';

  var CONFIG = {
    minData: 3,        // fewer than this many decision events → "not enough data"
    windowDays: 7,     // default report window
    shiftThreshold: 2, // a type's count must move by >= this vs prior period to be "notable"
    topFocusN: 5
  };

  // Decision types we treat as OPERATIONAL leadership decisions, mapped to a
  // focus area. Session/noise events (sign-in/out, view-as) are intentionally
  // excluded — they are not decisions and tracking them would drift to surveilling.
  var TYPE_FOCUS = {
    'role-change':     'org-structure',
    'access-grant':    'access-governance',
    'access-revoke':   'access-governance',
    'assign':          'staffing',
    'override-assign': 'staffing',
    'request-created': 'staffing',
    'evaluation':      'evaluations',
    'cycle-created':   'evaluations',
    'config':          'configuration'
  };
  // explicitly ignored (not decisions)
  var IGNORE = { 'view-as': 1, 'sign-in': 1, 'sign-out': 1, 'win-logged': 1, 'win-backfill': 1, 'checkin-saved': 1, 'upward-feedback': 1 };

  function r1(x) { return Math.round(x * 10) / 10; }
  function dayOf(ts) { return ts ? String(ts).slice(0, 10) : ''; }

  /* A citable, de-identified reference to one decision event. We keep the TYPE and
   * timestamp (operational), and a stable index — but NOT the person targeted, so
   * nothing downstream can re-key the aggregate back to an individual (Ethics #1/#5). */
  function refOf(e, i) {
    if (!e || !e.type) return null; // anti-fabrication boundary — no type, no decision
    return { type: e.type, at: e.at || e.ts || null, focus: TYPE_FOCUS[e.type] || 'other', idx: i };
  }

  function inWindow(ts, win) {
    if (!win) return true;
    var d = dayOf(ts);
    if (win.start && d < win.start) return false;
    if (win.end && d > win.end) return false;
    return true;
  }

  // Resolve a window spec → { start, end } (inclusive day strings). Accepts
  // { start, end } | { days, ref } | undefined (→ last CONFIG.windowDays from ref/today).
  function resolveWindow(win, ref) {
    if (win && win.start && win.end) return { start: dayOf(win.start), end: dayOf(win.end) };
    var days = (win && win.days) || CONFIG.windowDays;
    var endStr = dayOf((win && win.ref) || ref) || dayOf(new Date().toISOString());
    var end = new Date(endStr + 'T00:00:00Z');
    var start = new Date(end.getTime() - (days - 1) * 86400000);
    return { start: dayOf(start.toISOString()), end: endStr };
  }
  // The equal-length period immediately before `win` — for week-over-week shifts.
  function priorWindow(win) {
    var s = new Date(win.start + 'T00:00:00Z'), e = new Date(win.end + 'T00:00:00Z');
    var days = Math.round((e - s) / 86400000) + 1;
    var pe = new Date(s.getTime() - 86400000);
    var ps = new Date(pe.getTime() - (days - 1) * 86400000);
    return { start: dayOf(ps.toISOString()), end: dayOf(pe.toISOString()) };
  }

  // Count decisions by type + by focus area over a set of cited refs.
  function tally(refs) {
    var byType = {}, byFocus = {};
    refs.forEach(function (r) {
      byType[r.type] = (byType[r.type] || 0) + 1;
      byFocus[r.focus] = (byFocus[r.focus] || 0) + 1;
    });
    return { byType: byType, byFocus: byFocus };
  }

  /* PURE + DETERMINISTIC. Aggregate a decision-event array into the weekly report.
   * Everything rolled up by TYPE / FOCUS — never by person. */
  function aggregate(events, winSpec, opts) {
    opts = opts || {};
    var win = resolveWindow(winSpec, opts.ref);
    var allRefs = (events || []).map(refOf).filter(Boolean).filter(function (r) { return !IGNORE[r.type]; });
    var refs = allRefs.filter(function (r) { return inWindow(r.at, win); });

    if (refs.length < CONFIG.minData) {
      return {
        period: win,
        enoughData: false,
        note: 'Not enough data',
        decisionCounts: {},
        topFocusAreas: [],
        recurringThemes: [],
        aiAcceptanceRate: null,
        shifts: [],
        sourcedCount: refs.length,
        evidence: refs
      };
    }

    var cur = tally(refs);

    // decisionCounts: { type: { count, evidence:[refs] } } — every figure cites its events.
    var decisionCounts = {};
    Object.keys(cur.byType).forEach(function (type) {
      decisionCounts[type] = { count: cur.byType[type], evidence: refs.filter(function (r) { return r.type === type; }) };
    });

    // topFocusAreas: operational areas leaders spent decisions on, busiest first.
    var topFocusAreas = Object.keys(cur.byFocus).map(function (focus) {
      return { focus: focus, count: cur.byFocus[focus], evidence: refs.filter(function (r) { return r.focus === focus; }) };
    }).sort(function (a, b) { return b.count - a.count || (a.focus < b.focus ? -1 : 1); }).slice(0, CONFIG.topFocusN);

    // recurringThemes: a focus area is a "recurring concern" when it repeats (>=3
    // decisions) in the window. Operational + anonymized — describes the AREA, never a person.
    var recurringThemes = topFocusAreas.filter(function (f) { return f.count >= 3; }).map(function (f) {
      return { theme: f.focus, count: f.count, text: 'Recurring focus on ' + f.focus + ' (' + f.count + ' decisions this period)', evidence: f.evidence };
    });

    // aiAcceptanceRate: final vs AI-draft, ONLY where the events carry that signal.
    // No AI provenance on an event → it simply isn't counted (honest "where available").
    var aiSeen = 0, aiAccepted = 0, aiRefs = [];
    (events || []).forEach(function (e, i) {
      if (!e || !inWindow(e.at || e.ts, win) || IGNORE[e.type]) return;
      if (typeof e.aiAccepted === 'boolean') { aiSeen++; if (e.aiAccepted) aiAccepted++; aiRefs.push(refOf(e, i)); }
      else if (e.aiDraft !== undefined && e.final !== undefined) { aiSeen++; if (e.aiDraft === e.final) aiAccepted++; aiRefs.push(refOf(e, i)); }
    });
    var aiAcceptanceRate = aiSeen ? { rate: r1(aiAccepted / aiSeen), of: aiSeen, accepted: aiAccepted, evidence: aiRefs } : null;

    // notable shifts vs the prior equal-length period (week-over-week), per type.
    var prior = (events || []).map(refOf).filter(Boolean).filter(function (r) { return !IGNORE[r.type] && inWindow(r.at, priorWindow(win)); });
    var priorByType = tally(prior).byType;
    var shifts = [];
    var allTypes = {};
    Object.keys(cur.byType).forEach(function (t) { allTypes[t] = 1; });
    Object.keys(priorByType).forEach(function (t) { allTypes[t] = 1; });
    Object.keys(allTypes).forEach(function (type) {
      var now = cur.byType[type] || 0, was = priorByType[type] || 0, delta = now - was;
      if (Math.abs(delta) >= CONFIG.shiftThreshold) {
        shifts.push({
          type: type, delta: delta, now: now, was: was,
          text: type + ' ' + (delta > 0 ? 'up' : 'down') + ' ' + Math.abs(delta) + ' vs prior period (' + was + ' → ' + now + ')',
          evidence: refs.filter(function (r) { return r.type === type; })
        });
      }
    });
    shifts.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });

    return {
      period: win,
      priorPeriod: priorWindow(win),
      enoughData: true,
      decisionCounts: decisionCounts,
      topFocusAreas: topFocusAreas,
      recurringThemes: recurringThemes,
      aiAcceptanceRate: aiAcceptanceRate,
      shifts: shifts,
      sourcedCount: refs.length,
      total: (events || []).length,
      evidence: refs
      // NOTE: intentionally NO per-person breakdown, score, rank, or profile.
    };
  }

  /* ACCESS GATE (Ethics #6): the org-wide decision report is director/admin only.
   * No viewer supplied → trusted server/report context (same contract as evalPrep). */
  function denied(reason) {
    return { enoughData: false, denied: true, note: reason || 'Access not permitted', decisionCounts: {}, topFocusAreas: [], recurringThemes: [], aiAcceptanceRate: null, shifts: [], evidence: [] };
  }
  function gateOk(opts) {
    if (!opts || !opts.viewer) return true;
    return !!(WP.access && WP.access.canManage && WP.access.canManage(opts.viewer));
  }

  /* The report: pull decision events from the store (WP.activityLog) and aggregate.
   * Core stays data-only; the Weekly Report view handles presentation + framing. */
  function weeklyReport(winSpec, opts) {
    opts = opts || {};
    if (!gateOk(opts)) return denied();
    var events = (opts.events || WP.activityLog || []).slice();
    return aggregate(events, winSpec, opts);
  }

  WP.decisionMemory = {
    CONFIG: CONFIG,
    aggregate: aggregate,         // pure: decision events -> report
    weeklyReport: weeklyReport,   // store-backed + access-gated
    _refOf: refOf,                // exposed for tests
    _resolveWindow: resolveWindow,
    _priorWindow: priorWindow,
    TYPE_FOCUS: TYPE_FOCUS
  };
})(window.WP = window.WP || {});
