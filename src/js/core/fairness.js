/* ============================================================
 * Tempo — Fairness / Overload Radar (core)  ·  SPEC: docs/SPEC-fairness-radar.md
 * ------------------------------------------------------------
 * A TEAM-BALANCE support tool, NOT a "bad manager" scoreboard and NOT employee
 * surveillance (Constitution Article II). Pure functions. No DOM. Rule-based and
 * fully explainable (Article V): every flag lists the exact numbers behind it and
 * a suggested rebalancing action.
 *
 * Decision it serves (Article IV): "Which teams have workload concentrated /
 * unevenly distributed, so leadership can rebalance work, coach the manager, or
 * justify a hire?" — redistribute load · coach · justify a hire.
 *
 * Hard rules baked in:
 *  - Inputs are WORKLOAD-distribution signals already in the system (per-person
 *    weekly capacity load %, from capacity.js). NEVER hours, activity, behaviour
 *    or personality. We measure how work is SPREAD across a team, not people.
 *  - No assignments in a team => "not enough data". The balance is NEVER inferred
 *    from an absence of data (Article V).
 *  - Audience gating lives in scan()/canView() via the EXISTING access model: a
 *    director / super-admin sees across teams; a manager sees ONLY their own team.
 *    Never peer-visible, never employee-facing as a judgment.
 * ========================================================== */
(function (WP) {
  'use strict';

  /* Tunable, auditable config — ONE place so thresholds are explainable and any
   * Phase-2 calibration is a config change, not a code change. All in load-% pts. */
  var CONFIG = {
    lookbackWeeks: 4,        // weeks of capacity history we read for the "sustained" check
    overloadPct: 100,        // a member at/above this in the current week is "over capacity"
    lightPct: 40,            // a member at/below this is "light" (matches the 'available' band)
    watchSpreadPts: 30,      // max−min load gap at/above this = worth watching
    bigSpreadPts: 50,        // max−min load gap at/above this = a large imbalance
    wholeTeamRatio: 0.75,    // this share of the team over capacity = whole-team overload
    sustainedMinWeeks: 2     // the imbalance/overload pattern must persist this many weeks to call it sustained
  };

  /* ---- date helpers (mirror capacity/wellbeing: ISO strings, UTC week steps) ---- */
  function toISO(ref) {
    if (!ref) ref = (WP.state && WP.state.refDate) || new Date().toISOString().slice(0, 10);
    if (ref instanceof Date) return ref.toISOString().slice(0, 10);
    return String(ref).slice(0, 10);
  }
  function shiftISO(refISO, days) {
    var d = new Date(refISO + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* The members whose load distribution we balance: a manager's DIRECT reports
   * (the people doing assignable work), excluding unfilled TBC placeholders so an
   * empty seat never fakes a "light" member. */
  function membersOf(managerId) {
    return WP.access.directReports(managerId).filter(function (p) { return !p.tbc; });
  }

  /* Current-week load for one member (reuses the capacity engine — capacity %,
   * never hours). */
  function memberLoad(person, refISO) {
    return WP.capacity.loadForPerson(person, 'week', refISO);
  }

  /* Did the team show the imbalance/overload pattern in a given past week?
   * Pattern = someone over capacity (the thing we want to catch early). */
  function patternInWeek(members, refISO) {
    return members.some(function (p) { return memberLoad(p, refISO) >= CONFIG.overloadPct; });
  }

  function bandActionFor(band, pattern, nums) {
    // pattern: 'wholeTeam' | 'uneven' | null   ·  nums: {over, light, n, spread}
    if (band === 'unbalanced' && pattern === 'wholeTeam') {
      return {
        en: nums.over + ' of ' + nums.n + ' over capacity — the whole team is stretched. Consider load relief or a hire.',
        ar: nums.over + ' من ' + nums.n + ' فوق الطاقة — الفريق كله مضغوط. فكّر بتخفيف الحمل أو بتوظيف.'
      };
    }
    if (band === 'unbalanced') {
      return {
        en: nums.over + ' over 100% while ' + nums.light + ' under ' + CONFIG.lightPct + '% — rebalance work across the team.',
        ar: nums.over + ' فوق 100٪ بينما ' + nums.light + ' تحت ' + CONFIG.lightPct + '٪ — أعد توزيع العمل على الفريق.'
      };
    }
    if (band === 'watch') {
      return {
        en: 'Load is starting to spread unevenly (gap ' + nums.spread + ' pts) — redistribute before it tips.',
        ar: 'الحِمل بدأ يتوزّع بشكل غير متساوٍ (فجوة ' + nums.spread + ' نقطة) — أعد التوزيع قبل أن يختل.'
      };
    }
    return null; // balanced → no action needed (a good outcome)
  }

  /* Balance for ONE team (a manager + their direct reports). Returns band +
   * explainable metrics + factors + a suggested action. Never throws on a missing
   * person; returns a 'noData' shape instead. */
  function teamBalance(managerId, ref) {
    var manager = WP.access.byId(managerId);
    var refISO = toISO(ref);
    var members = manager ? membersOf(managerId) : [];

    var base = {
      managerId: managerId,
      band: null,
      size: members.length,
      metrics: null,
      factors: [],
      suggestedAction: null,
      noData: false
    };
    if (!manager || members.length < 2) {
      // need at least two members to talk about distribution between them
      base.noData = true;
      base.factors.push({ key: 'noTeam', en: 'Not enough team members to assess balance', ar: 'لا يوجد أعضاء كافون لتقييم التوازن' });
      return base;
    }

    var loads = members.map(function (p) { return { id: p.id, load: memberLoad(p, refISO), events: (p.assignedEvents || []).length }; });
    var totalEvents = loads.reduce(function (a, x) { return a + x.events; }, 0);
    if (totalEvents === 0) {
      // genuinely no assignments yet — never infer balance from an absence of data
      base.noData = true;
      base.factors.push({ key: 'noAssignments', en: 'No assignments yet for this team', ar: 'لا توجد مهام مُسندة لهذا الفريق بعد' });
      return base;
    }

    var values = loads.map(function (x) { return x.load; });
    var maxLoad = Math.max.apply(null, values);
    var minLoad = Math.min.apply(null, values);
    var spread = maxLoad - minLoad;
    var n = members.length;
    var over = loads.filter(function (x) { return x.load >= CONFIG.overloadPct; });
    var light = loads.filter(function (x) { return x.load <= CONFIG.lightPct; });

    // how many of the last N weeks showed the pattern (sustained vs one-off)
    var sustainedWeeks = 0;
    for (var i = 0; i < CONFIG.lookbackWeeks; i++) {
      if (patternInWeek(members, shiftISO(refISO, -7 * i))) sustainedWeeks++;
    }

    var wholeTeam = over.length >= Math.ceil(n * CONFIG.wholeTeamRatio);
    var uneven = spread >= CONFIG.bigSpreadPts && over.length >= 1 && light.length >= 1;

    var band, pattern = null;
    if (wholeTeam) { band = 'unbalanced'; pattern = 'wholeTeam'; }
    else if (uneven && sustainedWeeks >= CONFIG.sustainedMinWeeks) { band = 'unbalanced'; pattern = 'uneven'; }
    else if (uneven || over.length >= 1 || spread >= CONFIG.watchSpreadPts) { band = 'watch'; }
    else { band = 'balanced'; }

    // ---- explainable factors: every number that drove the band ----
    var factors = [];
    if (over.length >= 1) {
      factors.push({ key: 'overload', en: over.length + ' of ' + n + ' over capacity (≥' + CONFIG.overloadPct + '%)',
        ar: over.length + ' من ' + n + ' فوق الطاقة (≥' + CONFIG.overloadPct + '٪)' });
    }
    factors.push({ key: 'spread', en: 'Load spread ' + minLoad + '%–' + maxLoad + '% (gap ' + spread + ' pts)',
      ar: 'تفاوت الحِمل ' + minLoad + '٪–' + maxLoad + '٪ (فجوة ' + spread + ' نقطة)' });
    if (over.length >= 1 && light.length >= 1) {
      factors.push({ key: 'unevenSplit', en: light.length + ' under ' + CONFIG.lightPct + '% while ' + over.length + ' over capacity',
        ar: light.length + ' تحت ' + CONFIG.lightPct + '٪ بينما ' + over.length + ' فوق الطاقة' });
    }
    if (band !== 'balanced' && sustainedWeeks >= 1) {
      factors.push({ key: 'sustained', en: 'Pattern seen ' + sustainedWeeks + ' of the last ' + CONFIG.lookbackWeeks + ' weeks',
        ar: 'النمط ظهر ' + sustainedWeeks + ' من آخر ' + CONFIG.lookbackWeeks + ' أسابيع' });
    }
    if (band === 'balanced') {
      factors = [{ key: 'balanced', en: 'Work is evenly distributed (gap ' + spread + ' pts, none over capacity)',
        ar: 'العمل موزّع بالتساوي (فجوة ' + spread + ' نقطة، لا أحد فوق الطاقة)' }];
    }

    var nums = { over: over.length, light: light.length, n: n, spread: spread };
    return {
      managerId: managerId,
      band: band,
      size: n,
      noData: false,
      metrics: {
        overloaded: over.length,
        light: light.length,
        maxLoad: maxLoad,
        minLoad: minLoad,
        spread: spread,
        sustainedWeeks: sustainedWeeks,
        loads: loads
      },
      factors: factors,
      suggestedAction: bandActionFor(band, pattern, nums)
    };
  }

  /* ---- access gate (reuse the existing model) ----
   * A director / super-admin sees balance ACROSS all teams. A line manager (or
   * sr-manager) sees ONLY their own team. Specialists / individual contributors
   * get nothing (never employee-facing as a judgment). */
  function isManagerOf(personId) { return WP.access.directReports(personId).length > 0; }

  function teamsInScope(viewer) {
    if (!viewer) return [];
    if (viewer.level === 'admin' || viewer.level === 'director' || viewer.superAdmin) {
      // every real manager in the org is a team unit
      return WP.data.PEOPLE.filter(function (p) { return !p.tbc && isManagerOf(p.id); }).map(function (p) { return p.id; });
    }
    if (viewer.level === 'manager' || viewer.level === 'sr_manager') {
      return isManagerOf(viewer.id) ? [viewer.id] : []; // own team only
    }
    return [];
  }

  function canView(viewer) { return teamsInScope(viewer).length > 0; }

  /* All teams a viewer may see, worst balance first (unbalanced → watch → balanced
   * → noData). Returns the FULL list in scope (the view shows balanced as a positive
   * outcome); never includes a team outside the viewer's gate. */
  function scan(viewerId, ref) {
    var viewer = WP.access.byId(viewerId);
    var ids = teamsInScope(viewer);
    if (!ids.length) return [];
    var ORDER = { unbalanced: 0, watch: 1, balanced: 2 };
    return ids.map(function (id) { return teamBalance(id, ref); })
      .sort(function (a, b) {
        var oa = a.noData ? 3 : (ORDER[a.band] != null ? ORDER[a.band] : 3);
        var ob = b.noData ? 3 : (ORDER[b.band] != null ? ORDER[b.band] : 3);
        if (oa !== ob) return oa - ob;
        return (b.metrics ? b.metrics.spread : 0) - (a.metrics ? a.metrics.spread : 0);
      });
  }

  WP.fairness = {
    CONFIG: CONFIG,
    teamBalance: teamBalance,
    scan: scan,
    canView: canView
  };
})(window.WP = window.WP || {});
