# SPEC — Wellbeing Early-Warning (v1) · run through TAOS

Status: ready for Claude Code. Size: M. Follow `CLAUDE.md` / TAOS. This is a **support** tool, not a
score or a surveillance feature — that framing is a hard requirement, not a nicety (Constitution II).

## Why (decision it serves — Article IV)
"Who is likely heading toward burnout, so a manager can give relief *before* it happens?" Decision:
redistribute work / check in / approve time off. No competitor in the ops-tracker space does this;
it's the flagship Digital-COO capability and it's built on the capacity engine we already have.

## Hard guardrails (Constitution II + Legal/Customer critics) — must be designed in
- **Audience-gated:** visible only to the person's manager, their director, and super-admin. NEVER
  peer-visible. NEVER on a public dashboard.
- **Support framing:** the view is titled around wellbeing/relief, not performance. Every flag is
  paired with a concrete suggested relief action. It is never presented as a ranking of "bad" people.
- **No hours, no surveillance:** never use clocked hours or activity tracking. Inputs are workload
  signals already in the system.
- **Explainable (Article V):** every flag shows the exact factors that triggered it. No black box.

## How it works (transparent, rule-based — Article III/V)
Compute a **Wellbeing Risk score** per person from existing signals, each contributing transparent points:
- Sustained overload: weeks in a row at >100% capacity (from the capacity engine).
- Trend: load rising over the period.
- No recovery: no time off / leave in the last N days (use joining/leave data we have; else skip the factor and say so).
- Check-in signal: declining or missed daily check-ins, if that data exists; otherwise omit (don't fabricate).
Bands: **Watch / At-risk / Critical** (thresholds documented). A person with no risk factors shows
nothing — empty state here is a GOOD outcome, say so.
Each band maps to a suggested action (e.g. At-risk → "redistribute one project / schedule a 1:1").
Keep weights in one documented config so they're tunable and auditable.

## UX / states (Designer lens, WCAG 2.2)
- New manager-scoped view "Wellbeing" (or a card on the manager dashboard): list of flagged people,
  each row = name + band chip + the 2–3 reasons + suggested action. Calm, not alarmist. Inline SVG icons.
- States: **empty** ("No one is showing wellbeing risk right now" — positive), loading, error.
- EN + AR, RTL, dark mode. Color is a *signal* not the only cue (accessibility): band has a label, not just color.

## Architecture (Solutions Architect)
- New `src/js/core/wellbeing.js` — pure functions: `wellbeing.scoreFor(personId)` and `wellbeing.atRisk(viewerId)`
  returning {band, factors[], suggestedAction}. No UI in core. Reuses `capacity.js`.
- New `src/js/ui/wellbeing.js` view, access-gated via `access.js` (managers+). Reversible (additive only).
- Works on current data now; benefits automatically when the Supabase backend lands (no rewrite).

## QA (risk-based — Article VI)
- `test/verify-wellbeing.js`: scoring is deterministic + explainable (factors match the score); access
  gate hides it from non-managers/peers; empty state when no risk; thresholds/bands correct at boundaries.
- Highest risk to test: **access leakage** (a peer must never see another's risk) and **false framing**
  (no factor implies hours/surveillance). All existing suites stay green.

## Acceptance criteria (Definition of Done)
1. `wellbeing.scoreFor` returns band + explainable factors + suggested action; weights in one config.
2. View is manager/director/super-admin only; never peer-visible (proven by test).
3. All states handled, EN+AR, WCAG-safe (label + color), calm support framing, suggested action per flag.
4. No hours/surveillance inputs; every flag fully explainable.
5. Tests green; build clean; PR opened (not merged); Product Health Score recorded; decision logged.

## Council of Critics — resolved
Skeptic: it's a *risk indicator*, not a medical prediction — labeled as such. Simplifier: rule-based, no
ML. Customer/Legal: support-framed, gated, no surveillance. Ops Guardian: auto-computed, zero manual entry.
Adoption: each flag carries an action so managers act, not just observe. Open risk: thresholds need real-data
tuning — ship with documented defaults + a Phase-2 calibration task.

## Out of scope (later)
ML prediction; cross-team aggregate trends; notifications/automation; integrating real check-in sentiment
(until that data is reliable).
