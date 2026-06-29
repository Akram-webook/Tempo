# Tempo Intelligence Layer — what it is, and what it will NOT do

The Intelligence Layer turns the evidence Tempo already holds into **support for a human's
judgement**. It never rates, ranks, profiles, or decides anything about a person. Five pure
engines (no DOM, no network) sit between the data and the (later) UI, each gated by
[`ai-os/00-governance/INTELLIGENCE-ETHICS.md`](../ai-os/00-governance/INTELLIGENCE-ETHICS.md).

## The five engines

| # | Engine | Module | Input | Output (read-only) |
|---|--------|--------|-------|--------------------|
| P1 | **Evidence Timeline** | `core/events.js` (`WP.events`) | live signals + appended events | a person's append-only, **sourced** event timeline (delivery, risk, plan, workload, wellbeing, recognition, evaluation, decision) |
| P2 | **Eval-Prep** | `core/evalPrep.js` (`WP.evalPrep`) | one person's events | grouped, **sourced** prep summary + honest gaps. No score/verdict. |
| P3 | **Evaluation Intelligence** | `core/evalIntel.js` (`WP.evalIntel`) | one person's events + evaluations | `suggestedRange` → a **/5 RANGE** + reasoning + evidence + risks (never one number); `consistencyCheck` → awareness **warnings** over an evaluator's *own* reviews (never ranks people) |
| P5 | **Decision Memory** | `core/decisionMemory.js` (`WP.decisionMemory`) | the decision log (`WP.activityLog`) | `weeklyReport` → **de-identified** decision patterns: focus areas, recurring themes, AI-acceptance rate, week-over-week shifts |
| P6 | **Readiness / Org Capability** | `core/readiness.js` (`WP.readiness`) | events + completed evaluations | `developmentProfile` → evidenced strengths/growth/gaps for **one** person (no score, no verdict); `orgCapability` → **anonymized** capability distribution + skill-gap areas with **k-anonymity** |

The chain composes: timeline → evalPrep → evalIntel → decisionMemory → readiness.

## The six invariants (enforced in code + asserted every build)

1. **Support, not surveil** — operational work-evidence + anonymized planning only; never presence, behaviour, sentiment, or a personality profile.
2. **Evidence-first** — every figure cites real sourced events. `"Not enough evidence yet"` and `"too few to show"` are valid, first-class results — never a fabricated inference.
3. **Human decides** — output informs; there is **no** promote/hold verdict, no rank, no auto-acting recommendation. `suggestedRange` is a *range*, never a single score.
4. **Transparent** — every insight is traceable to its source events / decisions.
5. **Dignity & k-anonymity** — growth is framed constructively; any aggregate cohort/cell smaller than `minCohort` (default **5**) is suppressed, so no individual is re-identifiable.
6. **Access-gated** — per-person views require `canSeeSensitive` (self / direct manager / director); org aggregates require `canManage` (director/admin). Never peer-visible.

These are not just per-engine unit tests. **`test/verify-intelligence-layer.js`** seeds one
deterministic synthetic org (no PII), runs the *whole* chain, and recursively scans every
output for any leak — including a **cross-engine reconstruction test**: an observer holding the
combined leadership aggregates (orgCapability + weeklyReport) cannot identify *or count* the
suppressed sub-5 cohort. If any future change leaks a verdict, score, or identity across the
layer, that suite fails CI.

## What this layer will NOT do

- **No readiness/performance score, rank, grade, percentage, or percentile** of a person.
- **No promote / hold / hire / fire verdict or recommendation** that acts on its own.
- **No per-person profile, personality read, or behaviour/presence/sentiment tracking.**
- **No re-identification** of individuals through aggregates (k-anonymity, de-identified refs).
- **No fabrication** — sparse evidence yields an honest "not enough", never an invented pattern.
- **No auto-decisions** — a human always makes the call; the engines only prepare evidence.
