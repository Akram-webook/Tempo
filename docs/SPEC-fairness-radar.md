# SPEC — Fairness / Overload Radar (Wave 3 supporting drop) · TAOS size M · Builder B
Gated by INTELLIGENCE-ETHICS.md + Constitution Article II. Follow CLAUDE.md. Reuses the capacity
engine. Mostly NEW files to avoid colliding with Builder A.

## Why (decision it serves — Article IV)
"Which teams have workload concentrated/unbalanced, so leadership can rebalance work or coach/support
the manager?" Decision: redistribute load · coach · justify a hire. A fairness/balance support tool —
**NOT** a "bad manager" scoreboard and **NOT** employee surveillance (Article II).

## Hard guardrails (ethics gate)
- Framed as **team balance / fairness**, never a ranking that shames managers. No personality/behavior
  inference — only workload distribution from real capacity signals.
- **Director / super-admin gated** (they see across teams); a manager sees only their own team's balance.
  Never peer-visible, never employee-facing as a judgment. Reuse the existing access model.
- Explainable (Article V): every flag shows the numbers behind it. "Not enough data" when a team has
  no assignments — never inferred.

## How it works (transparent, rule-based — Article III/V) — reuse capacity.js
Per team (a manager + direct reports), compute from existing weekly load %:
- **Overload concentration** — count/% of team members sustained >100% (capacity.loadForPerson).
- **Imbalance / spread** — max member load − min member load (a simple, explainable spread; flag when
  spread is large AND some are overloaded while others are light → work is unevenly distributed).
- **Sustained** — how many weeks the team has shown the pattern (reuse the lookback approach).
Bands: Balanced / Watch / Unbalanced (documented thresholds in one tunable CONFIG). A balanced team
shows "Balanced — work is evenly distributed" (positive empty-state outcome).
Each non-balanced flag → a suggested action (e.g. "2 people >100% while 3 are <40% — rebalance" or
"whole team sustained >100% — consider load relief / a hire").

## UX / states (Designer lens, WCAG 2.2)
Director-gated "Fairness" view (or a card on the director dashboard): list of teams with a band chip,
the 2–3 numbers behind it, and the suggested action. Calm, not accusatory. Band = label+icon+color
(not color alone). States: empty ("Not enough assignment data yet"), loading, error. EN+AR, RTL, dark.
Inline-SVG icons, no emoji.

## Architecture (mostly new files — low collision)
- NEW `src/js/core/fairness.js` — pure: `fairness.teamBalance(managerId)` → {band, metrics, factors,
  suggestedAction}; `fairness.scan(viewerId)` → flagged teams for a director/super-admin (access-gated).
  No DOM. Reuses `capacity.js`. One tunable CONFIG block.
- NEW `src/js/ui/fairness.js` — the gated view, registered as a route.
- Minimal shell touches (coordinate to reduce conflict with Builder A): add the nav/route entry, a
  small CSS block, and your i18n keys in a clearly fenced group. Expect a possible rebase on i18n.js.

## QA (risk-based — Article VI)
NEW `test/verify-fairness.js`: metrics deterministic + explainable (numbers match the band); access
gate (a non-director/non-manager can't open it; a manager sees only their own team); balanced empty
state; band thresholds at boundaries; "not enough data" path. All existing suites stay green.

## Acceptance criteria (Definition of Done)
1. `fairness.teamBalance` / `scan` return band + explainable metrics + suggested action; CONFIG tunable.
2. Director/super-admin gated; manager sees only own team; never employee-facing judgment (tested).
3. All states, EN+AR, WCAG-safe, calm balance framing (not manager-shaming).
4. Rule-based, reuses capacity; no new data sources; no fabrication ("not enough data" when absent).
5. Tests green; build clean; PR opened (don't merge); Product Health Score recorded.

## Out of scope (later)
Trends over quarters, cross-team comparison dashboards, ML, any individual employee judgment.
