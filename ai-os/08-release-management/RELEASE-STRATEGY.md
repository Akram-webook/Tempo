# Book — Release Strategy & Incremental Delivery (Operations Waves) · doctrine
Supreme over "ship everything that's ready." Quality and trust over speed. The goal is not to finish
the roadmap — it is to continuously improve the product. The product is never "finished", always improving.

## The core rule (drip, don't dump)
Do NOT build every feature. Do NOT expose every idea immediately. Do NOT overwhelm directors.
Every release answers ONE question: **"What is the single most valuable improvement we can deliver
right now?"** Sequence later ideas for real reasons (quality, trust, learning) — not to overwhelm.

## Sustainable executive engagement (value velocity, NOT withholding)
Become indispensable by delivering value *faster than new problems appear* — so leaders rely on Tempo
because it consistently delivers measurable value, **not because features are withheld**. We drip for
real reasons: quality, trust-building, and learning from feedback before the next step — never to game
anticipation. Each release should make a leader think "we need the next Tempo release" *because the last
one solved a real problem and the next naturally builds on it.* Optimize for long-term trust, adoption,
and business value — never feature count.

## Curiosity Principle
Every release answers today's question while naturally introducing tomorrow's opportunity. Deliver
enough to solve today's problem and leave clear, meaningful future opportunities on the roadmap — so
leadership feels the product is evolving with their feedback. Tempo should never feel "finished"; it
becomes more valuable as the organization matures. Success = every release opens one new conversation
with leadership — **"what should we improve next?"** — never "there's nothing left to build."

## Naming — Operations Waves (not V1.1)
Releases are **Waves** telling a journey, with small drops inside each:
- 🌊 Wave 1 — Operational Visibility · 🌊 Wave 2 — Daily Execution · 🌊 Wave 3 — Evidence & Performance
- 🌊 Wave 4 — Decision Intelligence · 🌊 Wave 5 — Organizational Intelligence
Small releases inside a wave: `Wave 3.001`, `Wave 3.002`, … Each drop feels complete and immediately useful.

## Every release includes (nothing more)
One primary feature · small supporting improvements · UX polish · performance · bug fixes ·
docs update · QA report · known limitations · success metrics. Never bundle unrelated features just
because they're ready.

## Feature readiness gate (answer before building)
Why now? Who benefits? What problem? How is success measured? Why is this more important than
everything else? If you can't answer clearly — **do not build it; it goes to the backlog (Later).**

## Release gates (all must pass)
Architecture · Product · UX · Frontend · Backend · Security · Performance · Accessibility · QA ·
Documentation · Executive/Business/User/Operational value · Production readiness. (Runs through the
orchestrator + Council of Critics; an Escape after release feeds the Failure Library.)

## Roadmap discipline — three lists
**Now** (current drop) · **Next** (prioritized) · **Later** (the backlog — the master Google Sheet).
Never pull from Later unless priorities change. Approved ideas are *added to the backlog*, not built on sight.

## Product debt (reserve capacity every wave)
Never spend 100% on new features. Each drop reserves room for bug fixes, UX, refactoring, docs, quality.

## After every release — observe before the next
Observation period: measure adoption, usage, director + employee feedback, performance, reliability,
unexpected behavior, support + feature requests. Directors need time to use it, trust it, and ask for
changes. No major feature begins before reviewing these findings (Continuous Improvement, Article VIII).

## Parallel work — worktree-per-builder (mandatory)
When more than one builder/agent works the same wave at once, **each builder MUST run in its own
`git worktree` on its own branch from the start** — never share a single checkout. Sharing a working
directory lets one builder's branch switch revert another's in-flight edits to tracked shell files
(nav/route, i18n, CSS). Keep cross-builder collisions to additive, clearly-fenced edits and expect a
trivial rebase. (Permanent fix for the 2026-06-27 coordination Escape — see Failure Library.)

## Executive communication (each release)
What's New · Why It Matters · Who Benefits · Expected Business Impact · What's Next. Keep leadership
excited about the future without promising unrealistic timelines.
