/* Deterministic synthetic org for the end-to-end intelligence-ethics harness.
 * NO real names / PII — all ids are `sx_*`, names are "Person N". One manager,
 * one director, members with rich / sparse evidence, and a capability split that
 * trips k-anonymity (5 strong → shown, 3 developing → a <5 cohort to suppress).
 *
 * seedOrg(WP) mutates the loaded WP (PEOPLE, EVALUATIONS, activityLog) and appends
 * synthetic events to the store, then returns handles for the harness to drive. */
'use strict';

module.exports = function seedOrg(WP) {
  var CRIT = WP.data.EVAL_CRITERIA;
  function bandScores(level) { // 'strong' → all 5s, 'developing' → all 2s
    var s = {}; CRIT.forEach(function (c) { s[c.id] = level === 'strong' ? 5 : 2; }); return s;
  }

  var dir = { id: 'sx_dir', name: 'Person Dir', nameAr: 'Person Dir', initials: 'PD', level: 'director',
              managerId: null, title: 'Synthetic Director', titleAr: '', employment: 'fulltime', assignedEvents: [], dailyCheckin: null };
  var mgr = { id: 'sx_mgr', name: 'Person Mgr', nameAr: 'Person Mgr', initials: 'PM', level: 'manager',
              managerId: 'sx_dir', title: 'Synthetic Manager', titleAr: '', employment: 'fulltime', assignedEvents: [], dailyCheckin: null };

  // 6 members under mgr (+ 2 more strong under dir so the strong band reaches 5).
  function member(n, mgrId) {
    return { id: 'sx_m' + n, name: 'Person ' + n, nameAr: 'Person ' + n, initials: 'P' + n, level: 'spec',
             managerId: mgrId, title: 'Synthetic Member', titleAr: '', employment: 'fulltime', assignedEvents: [], dailyCheckin: null };
  }
  var members = [];
  for (var i = 1; i <= 6; i++) members.push(member(i, 'sx_mgr'));
  var extra = [member(7, 'sx_dir'), member(8, 'sx_dir')];
  // A genuinely EMPTY person: no completed eval, never in the activity log, no
  // seeded events → the store yields nothing, so derive() adds nothing either.
  // This is the deterministic "sparse → not enough evidence" subject.
  var sparse = member('_sparse', 'sx_mgr'); sparse.id = 'sx_sparse'; sparse.initials = 'PS';
  var all = [dir, mgr].concat(members, extra, [sparse]);

  // register people so the access model resolves relationships for the gates
  all.forEach(function (p) { WP.data.PEOPLE.push(p); });

  // capability split: members 1-3 + extras 7,8 = 5 STRONG; members 4-6 = 3 DEVELOPING.
  var strongIds = ['sx_m1', 'sx_m2', 'sx_m3', 'sx_m7', 'sx_m8'];
  var developingIds = ['sx_m4', 'sx_m5', 'sx_m6'];
  strongIds.concat(developingIds).forEach(function (id) {
    var level = strongIds.indexOf(id) !== -1 ? 'strong' : 'developing';
    WP.data.EVALUATIONS[id] = {
      period: 'SX-2026', status: 'Completed', evaluatorId: 'sx_mgr',
      scores: bandScores(level),
      feedback: { strengths: 'Reliable teammate.', growth: 'Broaden scope.' }
    };
  });

  // ---- evidence events (append-only store) --------------------------------
  function ev(subject, cat, n) {
    return { id: subject + ':' + cat + ':' + n, subjectId: subject, ts: '2026-05-1' + n + 'T09:00:00Z',
             type: 'evidence', category: cat, actor: 'system:seed', source: 'seed:intel-fixture',
             confidence: 'observed', description: cat + ' evidence ' + n, evidenceRefs: [] };
  }
  var seedEvents = [];
  // rich subjects (>= minEvidence sourced, mixed categories)
  ['sx_m1', 'sx_m2'].forEach(function (id) {
    seedEvents.push(ev(id, 'delivery', 1), ev(id, 'delivery', 2), ev(id, 'delivery', 3), ev(id, 'recognition', 1), ev(id, 'plan', 1));
  });
  seedEvents.push(ev('sx_m1', 'risk', 1));        // a blocker to surface (widens range, dignity)
  // a deliberately SPARSE subject (1 sourced event → "not enough evidence")
  seedEvents.push(ev('sx_m4', 'delivery', 1));

  // ---- decision log (for decisionMemory.weeklyReport) ---------------------
  // de-identified by the engine; a couple carry AI provenance.
  var reportWindow = { start: '2026-05-08', end: '2026-05-14' };
  WP.activityLog.length = 0;
  WP.activityLog.push(
    { type: 'assign',          by: 'sx_mgr', target: 'sx_m1', event: 'evt1', at: '2026-05-10T10:00:00Z', aiAccepted: true },
    { type: 'override-assign', by: 'sx_mgr', target: 'sx_m4', event: 'evt2', at: '2026-05-11T10:00:00Z', aiAccepted: false, reason: 'capacity' },
    { type: 'assign',          by: 'sx_mgr', target: 'sx_m2', event: 'evt3', at: '2026-05-12T10:00:00Z', aiAccepted: true },
    { type: 'access-grant',    by: 'sx_dir', target: 'sx_m6', at: '2026-05-12T11:00:00Z' },
    { type: 'role-change',     by: 'sx_dir', target: 'sx_m5', at: '2026-05-13T10:00:00Z', reason: 'team move' },
    { type: 'evaluation',      by: 'sx_mgr', target: 'sx_m3', at: '2026-05-13T12:00:00Z', reason: 'approved' }
  );

  // append events to the store (async; harness awaits the returned promise)
  var appended = Promise.all(seedEvents.map(function (e) { return WP.db.events.append(e); }));

  return {
    ready: appended,
    dir: dir, mgr: mgr,
    peer: members[5],            // sx_m6: a spec, not the manager/dir of the rich subjects
    richId: 'sx_m1',
    sparseId: 'sx_sparse',
    strongIds: strongIds,
    developingIds: developingIds,   // the <5 cohort whose identity must stay protected
    allSyntheticIds: all.map(function (p) { return p.id; }),
    reportWindow: reportWindow
  };
};
