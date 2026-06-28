/* ============================================================
 * Tempo — Evidence/Decision events (Intelligence Layer P1, core)
 * SPEC: docs/SPEC-evidence-timeline.md · GATE: ai-os/00-governance/INTELLIGENCE-ETHICS.md
 * ------------------------------------------------------------
 * Pure derivation + query over the append-only event store. Every event is
 * derived from a REAL existing signal and carries its `source` — nothing is
 * fabricated (Ethics #2). Risk entries are framed as early support, not
 * punishment (Ethics #5). No DOM, no business logic in views.
 *
 * P1 timeline = events DERIVED from signals we already have (capacity, wellbeing,
 * completed evaluations, check-ins/kudos) + DECISION events from WP.activityLog,
 * merged with any explicitly appended events from WP.db.events.
 * ========================================================== */
(function (WP) {
  'use strict';

  // delivery/risk/plan are the Slack daily check-in categories (F-034) — appended
  // events from WP.db.events flow through the same timeline + filter as derived ones.
  var CATEGORIES = ['workload', 'wellbeing', 'evaluation', 'recognition', 'decision', 'delivery', 'risk', 'plan'];

  function iso(d) { return (d instanceof Date ? d : new Date(d)).toISOString(); }
  function quarterOf(ts) {
    var d = new Date(ts); if (isNaN(d)) return '';
    return 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1) + '-' + d.getUTCFullYear();
  }
  function ev(o) {
    // every event MUST have a source — guard against fabrication at construction
    if (!o.source) throw new Error('event without a source is not allowed (Ethics #2): ' + o.description);
    return {
      id: o.id, ts: o.ts, type: o.type || 'evidence', actor: o.actor || null, subjectId: o.subjectId,
      category: o.category, description: o.description, source: o.source,
      confidence: o.confidence || 'observed', growth: !!o.growth, evidenceRefs: o.evidenceRefs || []
    };
  }

  /* Build evidence/decision events for one person from live signals. Pure +
   * deterministic given the data; emits NOTHING when a signal is absent (we say
   * "no evidence" rather than invent it). */
  function derive(subjectId, refDate) {
    var p = WP.access.byId(subjectId);
    if (!p) return [];
    var refISO = iso((refDate || (WP.state && WP.state.refDate) || new Date().toISOString().slice(0, 10)) + (String(refDate).length === 10 ? 'T12:00:00Z' : ''));
    var out = [];

    // 1) Workload (capacity engine) — only if the person actually has load
    try {
      var snap = WP.capacity.snapshot(p, 'month', (refDate || (WP.state && WP.state.refDate)));
      if (snap && snap.load > 0) {
        out.push(ev({ id: 'der_workload_' + subjectId + '_' + refISO, ts: refISO, type: 'evidence', subjectId: subjectId,
          category: 'workload', confidence: 'observed', source: 'Capacity engine',
          description: 'Workload at ' + snap.load + '% (' + WP.i18n.stateLabel(snap.state) + ') this period' }));
      }
    } catch (e) {}

    // 2) Wellbeing — early SUPPORT signal, never punishment (Ethics #5)
    try {
      if (WP.wellbeing && WP.wellbeing.scoreFor) {
        var w = WP.wellbeing.scoreFor(subjectId, refDate);
        if (w && w.band) {
          out.push(ev({ id: 'der_wellbeing_' + subjectId + '_' + refISO, ts: refISO, type: 'evidence', subjectId: subjectId,
            category: 'wellbeing', confidence: 'signal', source: 'Wellbeing engine',
            description: 'Early support signal (' + w.band + '): ' + w.factors.map(function (f) { return f.en; }).join('; ') }));
        }
      }
    } catch (e) {}

    // 3) Completed evaluation
    try {
      var rec = WP.data.EVALUATIONS && WP.data.EVALUATIONS[subjectId];
      if (rec && rec.status === 'Completed') {
        var overall = (WP.evaluation && WP.evaluation.overall) ? WP.evaluation.overall(rec) : null;
        out.push(ev({ id: 'der_eval_' + subjectId + '_' + (rec.updated_at || rec.period || refISO), ts: iso(rec.updated_at || refISO),
          type: 'evidence', subjectId: subjectId, category: 'evaluation', confidence: 'recorded', source: 'Evaluation', growth: true,
          description: 'Evaluation completed (' + (rec.period || '') + ')' + (overall != null ? ' — overall ' + overall + '/5' : '') }));
      }
    } catch (e) {}

    // 4) Recognition / check-ins (growth highlighted)
    try {
      var eng = (WP.engage && WP.engage.snapshot) ? WP.engage.snapshot()[subjectId] : null;
      if (eng) {
        (eng.kudos || []).forEach(function (k, i) {
          out.push(ev({ id: 'der_kudos_' + subjectId + '_' + i, ts: refISO, type: 'evidence', subjectId: subjectId,
            category: 'recognition', confidence: 'recorded', source: 'Check-in / kudos', growth: true,
            description: 'Recognition: “' + k.text + '”' + (k.from ? ' — ' + WP.i18n.name(WP.access.byId(k.from) || { name: k.from }) : '') }));
        });
        if (eng.weekGoal && eng.weekDone >= eng.weekGoal) {
          out.push(ev({ id: 'der_checkin_' + subjectId + '_' + refISO, ts: refISO, type: 'evidence', subjectId: subjectId,
            category: 'recognition', confidence: 'observed', source: 'Daily check-ins', growth: true,
            description: 'Consistent check-ins (' + eng.weekDone + '/' + eng.weekGoal + ' this week)' }));
        }
      }
    } catch (e) {}

    // 5) Decision events from the existing activity log (role changes, access, eval edits)
    try {
      (WP.activityLog || []).forEach(function (a, i) {
        if (a.target !== subjectId) return;
        out.push(ev({ id: 'der_act_' + subjectId + '_' + (a.at || i) + '_' + i, ts: iso(a.at || refISO),
          type: 'decision', actor: a.by || null, subjectId: subjectId, category: 'decision', confidence: 'recorded',
          source: 'Activity log', description: (a.type || 'decision') + (a.reason ? ' · ' + a.reason : '') }));
      });
    } catch (e) {}

    return out;
  }

  function filter(events, opts) {
    opts = opts || {};
    return events.filter(function (e) {
      if (opts.category && opts.category !== 'all' && e.category !== opts.category) return false;
      if (opts.quarter && opts.quarter !== 'all' && quarterOf(e.ts) !== opts.quarter) return false;
      return true;
    });
  }
  function sortDesc(events) {
    return events.slice().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
  }

  /* Full timeline: derived (from live signals) ∪ appended (persisted), de-duped
   * by id, filtered, newest first. Async because persisted events come from WP.db. */
  function query(subjectId, opts, refDate) {
    var derived = derive(subjectId, refDate);
    var listP = (WP.db && WP.db.events) ? WP.db.events.list(subjectId) : Promise.resolve([]);
    return Promise.resolve(listP).then(function (persisted) {
      var byId = {};
      derived.concat(persisted || []).forEach(function (e) { if (e && e.id) byId[e.id] = e; });
      return sortDesc(filter(Object.keys(byId).map(function (k) { return byId[k]; }), opts));
    });
  }

  function quarters(events) {
    var seen = {}; events.forEach(function (e) { var q = quarterOf(e.ts); if (q) seen[q] = true; });
    return Object.keys(seen).sort().reverse();
  }

  WP.events = {
    CATEGORIES: CATEGORIES,
    derive: derive,
    filter: filter,
    sortDesc: sortDesc,
    query: query,
    quarterOf: quarterOf,
    quarters: quarters
  };
})(window.WP = window.WP || {});
