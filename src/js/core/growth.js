/* ============================================================
 * Tempo — Growth analytics (MOS-side, pure functions)
 * ------------------------------------------------------------
 * Reads tenure (mock-data) + growth-data. NO DOM.
 * These are SIGNALS for a human to review — never auto-decisions.
 * ========================================================== */
(function (WP) {
  'use strict';

  function monthsBetween(iso, refIso) {
    if (!iso) return null;
    const a = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
    const b = new Date((refIso || WP.state.refDate) + 'T00:00:00Z');
    return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24 * 30.44)));
  }

  function tenureMonths(p)  { return monthsBetween(p.joined); }
  function monthsInRole(p)  { return monthsBetween(p.roleStart); }
  function monthsSinceProgression(p) { return monthsBetween(p.lastProgression); }

  /* New-hire ramp-up: ceiling shouldn't start at 100%. Returns a
   * factor 0.5→1.0 over the first ~6 months (research: 3–8 mo to full). */
  function rampFactor(p) {
    const m = monthsInRole(p);
    if (m == null) return 1;
    if (m >= 6) return 1;
    return Math.round((0.5 + (m / 6) * 0.5) * 100) / 100;
  }
  function isRamping(p) { return rampFactor(p) < 1; }

  /* Sustained overload: load in the Near/Overloaded zone across the
   * last 3 weekly windows (the real burnout pattern, not one spike). */
  function sustainedOverload(p) {
    const ref = new Date(WP.state.refDate + 'T00:00:00Z');
    let hot = 0;
    for (let w = 0; w < 3; w++) {
      const d = new Date(ref.getTime() - w * 7 * 86400000).toISOString().slice(0, 10);
      const load = WP.capacity.loadForPerson(p, 'week', d);
      if (WP.capacity.stateForLoad(load).key === 'near' ||
          WP.capacity.stateForLoad(load).key === 'overloaded') hot++;
    }
    return hot >= 3;
  }

  /* Flight risk (predictive-HR signal): stalled in role 16–30 months
   * with no recent promotion/raise, AND under real pressure.
   * Directly serves the "prevent a resignation" goal. */
  function flightRisk(p) {
    const inRole = monthsInRole(p) || 0;
    const sinceProg = monthsSinceProgression(p) || 0;
    const load = WP.capacity.loadForPerson(p, 'month', WP.state.refDate);
    const pressured = load >= 76 || sustainedOverload(p);
    const stalled = inRole >= 16 && inRole <= 36 && sinceProg >= 16;
    const risk = stalled && pressured;
    return {
      risk: risk,
      reasons: risk ? [
        inRole + ' months in role',
        sinceProg + ' months since a promotion/raise',
        pressured ? 'under sustained pressure' : '',
      ].filter(Boolean) : [],
    };
  }

  /* Promotion-readiness SIGNAL (not a score that decides pay).
   * = handles big (Tier-1) work + DELIVERS + sustainably (not chronically
   * red) + over time. Plus a fairness check: has this person even been
   * GIVEN a Tier-1 lately, or always passed over? */
  function promotionReadiness(p) {
    const g = WP.data.GROWTH[p.id];
    const t1 = p.tier1Delivered || 0;
    const inRole = monthsInRole(p) || 0;
    const sustainable = !sustainedOverload(p); // carries scope without burning red
    // components 0..1
    const scope      = Math.min(t1 / 5, 1);               // delivered Tier-1 track record
    const tenure     = Math.min(inRole / 12, 1);          // enough time at level
    const headroom   = sustainable ? 1 : 0.4;             // sustainable handling
    const pct = Math.round((0.45 * scope + 0.25 * tenure + 0.30 * headroom) * 100);
    const fairnessGap = (p.monthsSinceTier1 || 0) >= 4;   // never given big work lately
    return {
      pct: pct,
      sustainable: sustainable,
      tier1Delivered: t1,
      fairnessGap: fairnessGap,
      monthsSinceTier1: p.monthsSinceTier1,
      // Fairness signal flags ORG under-investment (a person not given big work lately),
      // never a verdict on the person. NOTE: pct is an INTERNAL component score only —
      // it is deliberately NOT rendered anywhere (INTELLIGENCE-ETHICS: no per-person
      // readiness/promotion score/rank/threshold in the UI). The `note` carries no score.
      note: fairnessGap
        ? 'Not given a Tier-1 in ' + p.monthsSinceTier1 + ' months — worth a fair shot before judging growth.'
        : 'Building a Tier-1 track record.',
    };
  }

  /* Skill helpers */
  function skillGap(skill)   { return Math.max(0, (skill.required || 0) - skill.level); }
  function skillTrend(skill) {
    const h = (skill.history || []).filter(function (x) { return x != null; });
    if (h.length < 2) return 0;
    return h[h.length - 1] - h[h.length - 2]; // +/- vs previous quarter
  }
  function eqAverage(p) {
    const g = WP.data.GROWTH[p.id];
    if (!g) return null;
    const v = Object.values(g.eq);
    return Math.round((v.reduce(function (a, b) { return a + b; }, 0) / v.length) * 10) / 10;
  }

  WP.growth = {
    tenureMonths, monthsInRole, monthsSinceProgression,
    rampFactor, isRamping, sustainedOverload,
    flightRisk, promotionReadiness,
    skillGap, skillTrend, eqAverage,
  };
})(window.WP = window.WP || {});
