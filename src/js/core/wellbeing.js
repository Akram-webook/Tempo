/* ============================================================
 * Tempo — Wellbeing Early-Warning (core)   ·  SPEC: docs/SPEC-burnout-early-warning.md
 * ------------------------------------------------------------
 * A SUPPORT tool, not a score and NOT surveillance (Constitution Article II).
 * Pure functions. No DOM. Rule-based and fully explainable (Article V): every
 * flag lists the exact factors that triggered it and a suggested relief action.
 *
 * Decision it serves (Article IV): "Who is heading toward burnout, so a manager
 * can give relief BEFORE it happens?" — redistribute work / check in / approve leave.
 *
 * Hard rules baked in:
 *  - Inputs are WORKLOAD signals already in the system (capacity, schedule,
 *    voluntary check-ins). NEVER clocked hours or activity tracking.
 *  - If a signal's data doesn't exist, the factor is OMITTED and said so —
 *    never fabricated.
 *  - Audience gating lives in atRisk()/canView() via the existing access model;
 *    risk is never peer-visible.
 * ========================================================== */
(function (WP) {
  'use strict';

  /* Tunable, auditable config — ONE place so weights/thresholds are explainable
   * and Phase-2 calibration is a config change, not a code change. */
  var CONFIG = {
    lookbackWeeks: 4,        // how many weeks of capacity history we read
    overloadPct: 100,        // a week at/above this is "over capacity"
    overloadMinWeeks: 2,     // need at least this many overloaded weeks to flag
    risingDeltaPts: 15,      // recent-vs-earlier load jump that counts as a rising trend
    checkinRatio: 0.6,       // weekDone/weekGoal below this = check-ins dropping
    points: {
      sustainedOverload: 2,  // per overloaded week, capped at 3 weeks' worth
      risingTrend: 2,
      scheduleClash: 2,      // overlapping / back-to-back events (capacity.burnoutSignal)
      missedCheckins: 2
    },
    // bands evaluated high → low; a person below the lowest is NOT flagged (good!)
    bands: [
      { key: 'critical', min: 7 },
      { key: 'atRisk',   min: 4 },
      { key: 'watch',    min: 2 }
    ]
  };

  function bandFor(score) {
    for (var i = 0; i < CONFIG.bands.length; i++) if (score >= CONFIG.bands[i].min) return CONFIG.bands[i].key;
    return null;
  }

  function actionFor(band) {
    if (band === 'critical') return { en: 'Rebalance their workload now and discuss time off / relief.', ar: 'أعد توزيع أعماله الآن وناقش إجازة أو تخفيفاً عاجلاً.' };
    if (band === 'atRisk')   return { en: 'Redistribute one project and schedule a 1:1 this week.', ar: 'انقل أحد المشاريع وحدد جلسة فردية هذا الأسبوع.' };
    if (band === 'watch')    return { en: 'Keep an eye on their load; check in at your next 1:1.', ar: 'تابع حمله؛ اطمئن عليه في جلستكما القادمة.' };
    return null;
  }

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
  function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }

  function weeklyLoads(person, refISO) {
    var loads = [];
    for (var i = 0; i < CONFIG.lookbackWeeks; i++) {
      loads.push(WP.capacity.loadForPerson(person, 'week', shiftISO(refISO, -7 * i)));
    }
    return loads; // [0] = current week … older as index grows
  }

  /* Score a person object directly (testable without registering them). */
  function scoreForPerson(person, ref) {
    var factors = [], omitted = [], score = 0;
    if (!person) return { id: null, band: null, score: 0, factors: factors, omitted: omitted, suggestedAction: null };
    var refISO = toISO(ref);

    // 1) Sustained overload (from the capacity engine — capacity, never hours)
    var loads = weeklyLoads(person, refISO);
    var overWeeks = loads.filter(function (l) { return l >= CONFIG.overloadPct; }).length;
    if (overWeeks >= CONFIG.overloadMinWeeks) {
      var pts = Math.min(overWeeks, 3) * CONFIG.points.sustainedOverload;
      score += pts;
      factors.push({ key: 'sustainedOverload', points: pts,
        en: 'Over capacity ' + overWeeks + ' of the last ' + CONFIG.lookbackWeeks + ' weeks',
        ar: 'فوق الطاقة ' + overWeeks + ' من آخر ' + CONFIG.lookbackWeeks + ' أسابيع' });
    }

    // 2) Rising trend (recent weeks heavier than earlier weeks)
    var half = Math.floor(loads.length / 2);
    if (half >= 1) {
      var newer = avg(loads.slice(0, half)), older = avg(loads.slice(half));
      if (newer - older >= CONFIG.risingDeltaPts) {
        score += CONFIG.points.risingTrend;
        factors.push({ key: 'risingTrend', points: CONFIG.points.risingTrend,
          en: 'Workload trending up (' + Math.round(older) + '% → ' + Math.round(newer) + '%)',
          ar: 'الحِمل في ارتفاع (' + Math.round(older) + '٪ ← ' + Math.round(newer) + '٪)' });
      }
    }

    // 3) Schedule clash (overlapping / back-to-back events — existing signal)
    if (WP.capacity.burnoutSignal(person)) {
      score += CONFIG.points.scheduleClash;
      factors.push({ key: 'scheduleClash', points: CONFIG.points.scheduleClash,
        en: 'Back-to-back / overlapping events with no recovery gap',
        ar: 'فعاليات متتالية أو متداخلة دون فترة تعافٍ' });
    }

    // 4) Check-in decline — ONLY when real voluntary check-in data exists (no fabrication)
    var eng = (WP.engage && WP.engage.snapshot) ? WP.engage.snapshot()[person.id] : null;
    if (eng && eng.weekGoal) {
      if ((eng.weekDone || 0) / eng.weekGoal < CONFIG.checkinRatio) {
        score += CONFIG.points.missedCheckins;
        factors.push({ key: 'missedCheckins', points: CONFIG.points.missedCheckins,
          en: 'Daily check-ins dropping (' + (eng.weekDone || 0) + '/' + eng.weekGoal + ' this week)',
          ar: 'تراجع التحديثات اليومية (' + (eng.weekDone || 0) + '/' + eng.weekGoal + ' هذا الأسبوع)' });
      }
    } else {
      omitted.push({ key: 'checkins', en: 'No check-in history yet — factor skipped', ar: 'لا يوجد سجل تحديثات بعد — تم تخطّي العامل' });
    }

    // 5) Recovery / leave — not tracked yet. Omit transparently (Article V); never invent it.
    omitted.push({ key: 'recovery', en: 'Leave / time-off not tracked yet — factor skipped', ar: 'الإجازات غير مسجّلة بعد — تم تخطّي العامل' });

    var band = bandFor(score);
    return { id: person.id, band: band, score: score, factors: factors, omitted: omitted, suggestedAction: actionFor(band) };
  }

  function scoreFor(personId, ref) { return scoreForPerson(WP.access.byId(personId), ref); }

  /* The people a viewer may see wellbeing for: their DIRECT reports (or, for a
   * director/admin, everyone) — enforced by the existing canSeeSensitive gate,
   * which returns true only for self / direct-manager / director. Peers => none.
   * Self is excluded (this is a manager's relief view, not a self-check). */
  function candidatesFor(viewer) {
    if (!viewer) return [];
    return WP.access.visiblePeople(viewer).filter(function (p) {
      return p.id !== viewer.id && !p.tbc && WP.access.canSeeSensitive(viewer, p.id);
    });
  }

  function canView(viewer) { return candidatesFor(viewer).length > 0; }

  /* Flagged people in the viewer's scope, highest risk first. NEVER peer-visible. */
  function atRisk(viewerId, ref) {
    var viewer = WP.access.byId(viewerId);
    if (!canView(viewer)) return [];
    return candidatesFor(viewer)
      .map(function (p) { return scoreForPerson(p, ref); })
      .filter(function (r) { return r.band; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  WP.wellbeing = {
    CONFIG: CONFIG,
    bandFor: bandFor,
    scoreFor: scoreFor,
    scoreForPerson: scoreForPerson,
    canView: canView,
    atRisk: atRisk
  };
})(window.WP = window.WP || {});
