# SPEC — UX Polish Pass 1 (live dashboard) · run through TAOS

Size: S–M. Senior-product-designer lens, grounded in concrete observations of the LIVE dashboard
(akram-webook.github.io/tempo) + NN/g heuristics + the WBK design system. Article IV: every item is a
thing actually seen on screen, not a guess. Follow `CLAUDE.md`. No behavior change to data — purely
clarity/craft. All items reversible.

## Observed issues, prioritized (severity → fix)

**S1 — "Team Health 0%" reads as broken, not calm (highest).**
The Team Health card shows a big "0%" with "in healthy zone (41–75%)". On sample/empty data, a giant
0% looks like a bug or an alarm — the opposite of the calm, executive-first feel we want (Design
principle: Calm UI). Fix: when the value is 0 because data is sample/empty, show a neutral state
(e.g. "—" or "No data yet") with a one-line hint, not a red-feeling 0%. Tie to the existing "Sample
data" badge so the zero is clearly *absence of data*, not a real score of zero.

**S2 — KPI card subtitles echo their titles (quick win).**
Cards read "Available / Available" and "Near Capacity / Near Capacity" — the subtitle repeats the
title and adds nothing (wasted line, looks unfinished). Fix: make each subtitle informative —
e.g. Available → "of 13 people", Near Capacity → "76–95% load", Early Warnings → keep "Early burnout
signal" (that one's good). NN/g: every element should carry information.

**S3 — Daily check-in modal auto-interrupts on load.**
The check-in modal pops over the dashboard immediately on entry, before the user orients. It's
dismissible (good) but interruptive (Design: progressive disclosure). Fix: don't auto-open on every
load — surface it as a calm prompt/banner the user opens, or open it at most once per day after the
dashboard has painted. Keep "Skip" effortless.

**S4 — Consistency + hierarchy polish (craft).**
Audit the dashboard against WBK tokens: consistent card padding/radius (radius M 8), one clear primary
action per region, number typography consistent across KPI cards, and the eval banner's intensity
(it's strong pink) dialed so it informs without alarming. Ensure focus states + keyboard nav on cards
(WCAG 2.2), and that band/status cues are label+icon, not color alone.

## Out of scope (this pass)
No new features, no data/logic changes, no backend. Deeper per-screen passes (workload map, profile,
evaluations, wellbeing) come as Pass 2 once these land.

## Acceptance criteria
1. Zero/sample states read as calm "no data yet", never a bare alarming 0% (S1).
2. No KPI subtitle merely repeats its title; each adds information (S2).
3. Check-in does not force-interrupt on every load; calm, ≤once/day, easy skip (S3).
4. Cards consistent on WBK tokens; keyboard-focusable; cues not color-only; EN+AR + dark/RTL intact (S4).
5. Build clean, all suites green, no console errors; PR opened (not merged); Product Health Score recorded.

## Council of Critics — quick pass
Simplifier: keep it to clarity fixes, no redesign. Customer Advocate: the 0% and echoed labels are the
two things a new user would misread first — prioritized. Skeptic: each item was observed live, not assumed.
Adoption: a calmer first screen raises daily trust. Accessibility: focus + non-color cues are part of DoD.
