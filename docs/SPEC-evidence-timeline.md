# SPEC — Evidence Timeline foundation (Intelligence Layer P1) · run through TAOS
Size: M. Gated by `ai-os/00-governance/INTELLIGENCE-ETHICS.md`. Follow CLAUDE.md. The spine for
Performance Memory + Evaluation Intelligence + Leadership Intelligence. Reversible/additive.

## Why (decision it serves — Article IV)
"At evaluation time, managers review *evidence*, not memory." Reduces recency bias; makes evaluations
fair and evidence-based. Also the foundation all later Intelligence phases read from.

## Scope (P1 only)
1. **Event store** — extend `WP.db` with an append-only `events` namespace (+ SQL migration
   `supabase/0002_events.sql`, RLS like evaluations: insert stamped to author; read gated; never destructive).
   Event shape: id, ts, type(evidence|decision), actor, subjectId, category, before, after, description,
   source, relatedKPI/goal/project/event, confidence, evidenceRefs[], visibility. localStorage fallback.
2. **Seed from existing signals** (NO new integrations): generate evidence events from capacity/workload
   trend, wellbeing flags, completed evaluations, and check-ins; and decision events from the existing
   `WP.activityLog` (role changes, access grants, eval edits). Every event MUST carry a real source — no fabrication.
3. **Evidence Timeline UI** — read-only view on the employee profile, manager/director/super-admin only
   (reuse `canSeeSensitive`; never peer-visible). Chronological, filterable by quarter + category.
   Each entry shows date, category, description, source, confidence; growth highlighted, not just risks.
   Empty state = "No evidence captured yet" (calm, honest).

## Hard rules (ethics gate)
- Operational signals only; no profiling. Risk entries framed as *early support, not punishment*.
- Nothing fabricated — every entry references its source; insufficient data is stated, not inferred.
- Per-person timeline never peer-visible; subject can see their own.

## Architecture
`src/js/core/events.js` (pure: append, query, deriveFromSignals) + `WP.db.events` (backend+fallback) +
`supabase/0002_events.sql`. Timeline UI in profile via a new section, access-gated. No logic in views.

## QA (Article VI)
`test/verify-events.js`: append-only (no edits/deletes of past events), access gate (peer can't see
another's timeline), no-fabrication (every derived event has a source), filter correctness, empty state.
All existing suites stay green.

## Acceptance criteria
1. `WP.db.events` append/query works (backend + localStorage fallback); migration committed.
2. Timeline derived only from real existing signals + activity log; every entry sourced.
3. Manager-gated, never peer-visible (tested); subject sees own; chronological + filterable.
4. All states (loading/empty/error), EN+AR, WCAG-safe; growth-positive framing.
5. Tests green; build clean; PR (not merged); Product Health Score; decision logged.

## Out of scope (later phases)
AI eval prep (P2), rating/consistency/bias (P3), draft writer + learning (P4), leadership reports (P5),
promotion/org intelligence (P6), real Slack/KPI integrations (P7).
