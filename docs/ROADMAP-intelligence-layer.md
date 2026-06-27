# ROADMAP — Tempo Intelligence Layer (unifies 3 visions) · TAOS Strategic (L4)
Sources: Leadership Intelligence Engine, Evaluation Intelligence Workspace, Continuous Performance
Memory. Gated by `ai-os/00-governance/INTELLIGENCE-ETHICS.md`. This is a multi-phase direction; we
ship value each phase, never big-bang.

## The key insight — one spine, three visions
All three read/write ONE append-only event store. Build it once.

```
            ┌───────────────  EVENT STORE (append-only, evidence-linked)  ───────────────┐
            │  event = { id, ts, type: evidence|decision, actor, subject(employee),       │
            │            category, before, after, description, source, relatedKPI/goal/    │
            │            project/event, confidence, evidenceRefs[], visibility }           │
            └───────────────────────────────────────────────────────────────────────────┘
   writes ▲ evidence events                  writes ▲ decision events
   (Continuous Performance Memory)           (Leadership Decision Memory)
            │                                          │
   reads ▼ (consumers)                                 ▼
   • Evaluation Intelligence Workspace  → reads an employee's evidence + KPIs → AI prep, ranges, consistency/bias checks
   • Leadership Intelligence Reports    → aggregates DECISION events → operational patterns (never personality)
   • AI Learning Loop                   → compares AI draft vs final → stores operational preferences (wording/tone/accept-rate)
```
We already have seeds: `WP.activityLog`/`logEvent` (decision events), capacity/wellbeing signals and
evaluations (evidence). Phase 1 formalizes these into the store — no new integrations needed yet.

## Phased plan (each phase is independently valuable + reversible)
- **P1 — Evidence Timeline foundation (BUILD FIRST).** The event store (`WP.db.events`, append-only) +
  a manager-gated, read-only **Evidence Timeline** on the employee profile, seeded from signals we
  already have (workload/capacity, wellbeing flags, evaluations, check-ins, existing activity log).
  Filterable by quarter/category. Delivers "evidence, not memory" immediately. (Spec: SPEC-evidence-timeline.md)
- **P2 — AI Evaluation Preparation.** When a manager opens an evaluation, auto-assemble the evidence
  summary from the timeline (achievements, KPIs, workload, recognition) + suggested discussion topics
  + evidence-coverage/confidence + "missing information". The "80% less effort, evidence-based" core.
- **P3 — Suggested Rating Engine + Consistency/Bias awareness.** Suggested RANGE (never a single score)
  + confidence + reasoning + evidence + risks; consistency + bias *warnings* (never blocking, never accusatory).
- **P4 — AI Draft Writer + Learning Loop.** Draft in selectable styles; learn from manager edits
  (operational preferences only) to improve future drafts.
- **P5 — Leadership Decision Memory + Weekly Intelligence Report.** Structured decision logs →
  private operational-pattern report (focus areas, AI-acceptance, recurring concerns). Operational, not personal.
- **P6 — Promotion / Development / Org Intelligence + Executive Dashboard.** Evidence-based readiness
  (never score-alone), aggregated anonymized org capability/skill-gap/retention insights.
- **P7 — Real source integrations** (Slack, task/project, KPIs, recognition) feeding the event store.

## Council of Critics — applied to the whole layer
- **Customer/Legal:** the ethics amendment is the hard gate; "DNA" = operational prefs only, no profiling.
- **Simplifier:** one event store, not three systems; reuse the existing activity log + signals before new integrations.
- **Skeptic:** evidence-first everywhere; "not enough evidence" is a first-class output.
- **Scalability/Architect:** append-only store scales; consumers are pure read views.
- **Adoption:** P1+P2 give managers an immediate "evidence not memory" win — the hook that makes the rest wanted.

## Recommendation
Build **P1 first** (the spine + Evidence Timeline). It's the foundation every other phase needs, reuses
data we already have, honors the ethics gate, and delivers value on its own. Spec is ready.
