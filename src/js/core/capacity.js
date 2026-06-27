/* ============================================================
 * Tempo — Capacity Engine  (the "brain")
 * ------------------------------------------------------------
 * Pure functions. No DOM, no globals beyond reading WP.data.
 * This is the part that must be correct; the UI is replaceable.
 *
 * Philosophy (locked):
 *   - We measure CAPACITY (assigned load vs ceiling), never hours.
 *   - Green/Available = room to grow, not "idle".
 *   - Team Health = % of team in the Balanced band (the headline KPI).
 *
 * Time-window model (TUNABLE — see open question in handoff §10:
 *   "rolling-window vs calendar month"):
 *   Each event has a tier weight = its load over a full month at 100%.
 *   For a window we count the event's active days inside the window and
 *   take a fraction of its weight:
 *       contribution = weight * (overlapDaysInWindow / eventDurationDays)
 *   - Month  : calendar month  → fully-contained events count in full.
 *   - Week   : 7-day window     → only the slice active this week counts.
 *   - Year   : calendar year, then /12 → a smoothed monthly-average load.
 * ========================================================== */
(function (WP) {
  'use strict';

  const MS_DAY = 86400000;

  function parse(d) { return new Date(d + 'T00:00:00Z'); }
  function dayCountInclusive(startMs, endMs) {
    return Math.max(0, Math.round((endMs - startMs) / MS_DAY) + 1);
  }
  function overlapDays(aStart, aEnd, bStart, bEnd) {
    const s = Math.max(aStart, bStart);
    const e = Math.min(aEnd, bEnd);
    if (e < s) return 0;
    return dayCountInclusive(s, e);
  }

  /* Build [start,end] ms bounds for a window around a reference date. */
  function windowBounds(windowKey, refDate) {
    const ref = refDate ? new Date(refDate) : new Date();
    const y = ref.getUTCFullYear(), m = ref.getUTCMonth(), d = ref.getUTCDate();
    if (windowKey === 'day') {
      const start = Date.UTC(y, m, d);
      return { start: start, end: start, divisor: 1 };
    }
    if (windowKey === 'week') {
      // 7-day window starting Sunday of the reference week (KSA week start).
      const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 = Sun
      const start = Date.UTC(y, m, d - dow);
      return { start, end: start + 6 * MS_DAY, divisor: 1 };
    }
    if (windowKey === 'year') {
      return { start: Date.UTC(y, 0, 1), end: Date.UTC(y, 11, 31), divisor: 12 };
    }
    // month (default)
    const start = Date.UTC(y, m, 1);
    const end = Date.UTC(y, m + 1, 0);
    return { start, end, divisor: 1 };
  }

  /* Load (0..100+) for one person in a given window. */
  function loadForPerson(person, windowKey, refDate) {
    const { EVENTS, TIERS } = WP.data;
    const win = windowBounds(windowKey, refDate);
    let total = 0;
    (person.assignedEvents || []).forEach(function (eid) {
      const ev = EVENTS[eid];
      if (!ev) return;
      const evStart = parse(ev.start).getTime();
      const evEnd = parse(ev.end).getTime();
      const evDays = dayCountInclusive(evStart, evEnd);
      const ov = overlapDays(evStart, evEnd, win.start, win.end);
      if (ov === 0 || evDays === 0) return;
      const weight = TIERS[ev.tier].weight;
      total += (weight * (ov / evDays)) / win.divisor;
    });
    return Math.round(total);
  }

  /* Per-account contribution to a person's load in the window — for the
   * segmented load bar + hover breakdown. Same math as loadForPerson, per event. */
  function loadBreakdown(person, windowKey, refDate) {
    const { EVENTS, TIERS } = WP.data;
    const win = windowBounds(windowKey, refDate);
    const parts = [];
    (person.assignedEvents || []).forEach(function (eid) {
      const ev = EVENTS[eid];
      if (!ev) return;
      const evStart = parse(ev.start).getTime();
      const evEnd = parse(ev.end).getTime();
      const evDays = dayCountInclusive(evStart, evEnd);
      const ov = overlapDays(evStart, evEnd, win.start, win.end);
      if (ov === 0 || evDays === 0) return;
      const pct = Math.round((TIERS[ev.tier].weight * (ov / evDays)) / win.divisor);
      if (pct > 0) parts.push({ id: ev.id, tier: ev.tier, pct: pct });
    });
    return parts.sort(function (a, b) { return b.pct - a.pct; });
  }

  /* Map a load number to its state object. */
  function stateForLoad(load) {
    const { STATES } = WP.data;
    return STATES.find(function (s) { return load >= s.min && load <= s.max; }) ||
           STATES[STATES.length - 1];
  }

  function isHealthy(load) {
    return stateForLoad(load).key === WP.data.HEALTHY_STATE;
  }

  /* Early Burnout Signal: overlapping or back-to-back (<=1 day gap)
   * events indicate risky scheduling before load even turns red. */
  function burnoutSignal(person) {
    const { EVENTS } = WP.data;
    const spans = (person.assignedEvents || [])
      .map(function (eid) { return EVENTS[eid]; })
      .filter(Boolean)
      .map(function (ev) { return { id: ev.id, s: parse(ev.start).getTime(), e: parse(ev.end).getTime() }; })
      .sort(function (a, b) { return a.s - b.s; });
    for (let i = 1; i < spans.length; i++) {
      const gap = (spans[i].s - spans[i - 1].e) / MS_DAY;
      if (gap <= 1) return true; // overlap or back-to-back
    }
    return false;
  }

  /* Full computed snapshot for a person. */
  function snapshot(person, windowKey, refDate) {
    const load = loadForPerson(person, windowKey, refDate);
    return {
      id: person.id,
      load: load,
      state: stateForLoad(load),
      burnout: burnoutSignal(person),
      eventCount: (person.assignedEvents || []).length,
      breakdown: loadBreakdown(person, windowKey, refDate),
    };
  }

  /* Team Health KPI + headline counts for a set of people. */
  function teamMetrics(people, windowKey, refDate) {
    const snaps = people.map(function (p) { return snapshot(p, windowKey, refDate); });
    const n = snaps.length || 1;
    const counts = { available: 0, balanced: 0, near: 0, overloaded: 0 };
    let warnings = 0;
    snaps.forEach(function (s) {
      counts[s.state.key]++;
      if (s.burnout || s.state.key === 'near' || s.state.key === 'overloaded') warnings++;
    });
    return {
      snaps: snaps,
      counts: counts,
      teamHealth: Math.round((counts[WP.data.HEALTHY_STATE] / n) * 100),
      healthyCount: counts[WP.data.HEALTHY_STATE],
      availablePct: Math.round((counts.available / n) * 100),
      nearOrOver: counts.near + counts.overloaded,
      earlyWarnings: warnings,
      size: snaps.length,
    };
  }

  /* Simulate adding an event to a person (for the assignment drawer). */
  function simulateAssignment(person, eventId, windowKey, refDate) {
    const before = loadForPerson(person, windowKey, refDate);
    const trial = Object.assign({}, person, {
      assignedEvents: (person.assignedEvents || []).concat([eventId]),
    });
    const after = loadForPerson(trial, windowKey, refDate);
    const afterState = stateForLoad(after);
    return {
      before: before,
      after: after,
      delta: after - before,
      beforeState: stateForLoad(before),
      afterState: afterState,
      softLocked: afterState.key === 'overloaded', // requires logged override
    };
  }

  WP.capacity = {
    loadForPerson, loadBreakdown, stateForLoad, isHealthy, burnoutSignal,
    snapshot, teamMetrics, simulateAssignment, windowBounds,
  };
})(window.WP = window.WP || {});
