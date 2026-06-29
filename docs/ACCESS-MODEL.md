# Access & Privacy Model — who sees what

How permissions work in Webook Workload, grounded in RBAC/ReBAC + least-privilege +
GDPR data-minimization. Goal: **everyone can log in and see the situation, but
sensitive individual detail (weaknesses, notes, risk signals) opens only along the
management line.** Now implemented in the app.

## The model (hybrid — best practice)
- **RBAC tiers** for the coarse role: Employee · Manager · Senior Manager · Director/HR.
- **ReBAC ("manager-of", "team-of")** for the "whose data" question — the org tree is the
  relationship graph. A manager sees *their* team because of the relationship, not a static role.
- **Row + field-level rules** to enforce: which *people* you see (rows) and which *fields* of
  their record (columns). Sensitive fields are masked/omitted, not all-or-nothing.

## Two layers (reconciles "everyone sees the situation" with privacy)
1. **Aggregate / status layer — open to all:** team & department rollups (Team Health,
   who's overloaded, who's free, headline KPI status). No sensitive individual detail. Apply a
   **k ≥ 5 minimum group size** so a small "aggregate" can't reverse-engineer one person.
2. **Individual drill-down — relationship-gated:** a person's detailed tasks, growth areas,
   notes, and risk signals open only to their **direct manager**, **themselves**, and
   **Director/HR**. Skip-level senior managers see workload but **not** sensitive detail.

## Permission matrix (implemented)
| Data | Employee | Manager (direct) | Senior (skip-level) | Director/HR |
|---|---|---|---|---|
| Own workload / load % | ✓ | ✓ | ✓ | ✓ |
| Team workload | — | ✓ team | ✓ span | Agg |
| Another team's detail | — | Agg | ✓ span | Agg |
| Daily check-ins | self | ✓ team | Agg | Agg |
| Skills | self | ✓ team | ✓ span | Agg |
| **Growth areas / weaknesses** | self | ✓ direct only | 🔒 hidden | ✓ |
| **Manager notes / suggestions** | — | ✓ own | 🔒 hidden | ✓ |
| **Retention-risk / promo signal** | — | ✓ direct only | 🔒 hidden | ✓ |
| Salary / comp | self | — | — | ✓ |

🔒 = hidden to protect candor (the #1 reason people stop giving honest feedback is fear it's
exposed). Weaknesses/negative feedback go to the **direct manager + the person + HR only** —
never skip-level or peers by default.

## How it's shown in the app (trust, not suspicion)
- **Provenance chip** on every profile: "You can see this because you're their direct manager"
  / "Director view" / "This is your own profile" — makes access legible.
- **Sensitive sections hidden** for skip-level viewers, with a clear "🔒 hidden to protect
  privacy" note (framing restriction as protection).
- **Access matrix in Settings** publishes the rules in plain language (the table above).
- **Activity/override log** records who saw/changed what (auditability).
- Try it: "View as" Akram → open Osama (full detail, he's the direct manager); "View as" Motaa
  → open Osama (skip-level → growth/notes/risk hidden); "View as" Ahmed → full (director).

## Slack daily check-in ingest (F-034) — what we ingest, and what we never touch
The daily check-in feature turns a structured post in **`#daily-checkin` only** into
Evidence Timeline events. It is deliberately narrow, to honour the Intelligence-Ethics gate
(support, never surveil):
- **Source = the one public channel `#daily-checkin`.** NO DMs, NO private channels, NO other
  channels. Self-reported and opt-in — the team posts a template; we read what they chose to share.
- **We store only**: the verbatim work-item line, its category (`delivery` / `risk` / `plan`),
  the Slack **permalink** (provenance), the timestamp, and the resolved subject. Nothing is inferred.
- **We never derive or store**: presence/online status, response time, message counts, typing,
  sentiment, tone, "activity", or any behavioural/psychological signal. No auto-scoring, ever — a
  check-in is evidence a human reads, not a rating.
- **Author resolution is fail-closed**: a Slack user is mapped to a person only via their verified
  email → `public.directory` (migration `0003`). No match → the whole post is dropped and logged
  ("unmapped author"); a person not yet in `directory` simply produces no events (safe and quiet).
- **Same access gate as everything else**: check-in events live in the `events` store and are read
  through `can_read_person(subject_id)` (0003). A **peer cannot see another person's check-ins**;
  the **subject**, their **direct manager**, and **Director/HR** can (verified by `test/verify-db.js`
  scenario J). The ingest job runs server-side with the service-role key — never in the front-end.

## Where the access model is actually ENFORCED (server RLS) vs only PRESENTED (client) — F1
The access rules above are enforced in two very different places, and the difference is the whole
point of finding **F1**. `access.js` is a **client-side filter**: it decides what the signed-in
browser *renders*, but every signed-in browser still *receives* whatever data is in the static
bundle. So for any entity that ships as a bundled mock, the access model is **presentation-only** —
the moment real data replaces that mock in the bundle, every signed-in user receives the whole
thing. The fix is to move the data **server-side under Row-Level Security (RLS)**, so the database
returns only the rows a viewer may read — `access.js` then becomes defence-in-depth, not the lock.

Status by entity (updated per F1 phase — keep honest):

| Entity | Where it lives | Read enforcement | Status |
|--------|----------------|------------------|--------|
| `evaluations` | `public.evaluations` | **server RLS** `can_read_person(subject_id)` (0003) | ✅ server-enforced |
| `events` (incl. Slack check-ins) | `public.events` | **server RLS** `can_read_person(subject_id)` (0003) | ✅ server-enforced |
| **people / directory** (non-sensitive: name, title, level, manager, employment) | `public.people` (**0004**) + bundled mock fallback | **server RLS** `can_read_person(person_id)` (0004) | ✅ server-enforced **(F1 Phase 1)** |
| **growth / sensitive** (skills, EQ, manager notes, director impact/potential, quarterly, retention/promotion signal) | `public.growth` (**0005**) + bundled **synthetic** mock fallback | **server RLS** `can_see_sensitive(person_id)` — **stricter** (0005) | ✅ server-enforced **(F1 Phase 2)** |
| workload / capacity / engagement numbers | bundled mock (`mock-data.js`, `engage-data.js`) | client-side only | ⏳ still mock (operational, lower sensitivity) |

**F1 Phase 1:** the org directory's non-sensitive fields are read through `WP.db.people.list()` from
`public.people` under RLS (`can_read_person`), merged into the in-memory `WP.data.PEOPLE` the UI
already reads. Bundled mock remains the signed-out / offline / pre-migration fallback (server wins
when present) — never blank, fully reversible.

**F1 Phase 2 (this change):** the highest-sensitivity data — skills, EQ, manager notes, director
impact/potential, quarterly reliability, retention/promotion signals — is now read through
`WP.db.growth.list()/get()` from `public.growth` under a predicate **intentionally stricter** than
the directory's: **`can_see_sensitive(person_id)` = self OR DIRECT manager (one hop) OR
director/admin — NOT skip-level, NOT peers** (candor protection; mirrors `access.canSeeSensitive`).
It is a **separate** SECURITY DEFINER function from `can_read_person` on purpose: the directory-read
predicate may later widen (e.g. chain browsing), and sensitive growth must not widen with it. The
bundled growth data stays **synthetic** and is the offline/pre-migration fallback only; **real growth
values must never be loaded into the front-end bundle** — they live only in `public.growth` behind
`can_see_sensitive`. The skip-level-denied guarantee is regression-locked by
`test/verify-growth.js` (D3). With Phase 2, the access model for both the directory **and** the
sensitive growth record is **server-enforced**, not presentation-only — **F1 is fully closed** for
the person-data entities. (Workload/capacity/engagement numbers remain bundled mock — operational,
lower-sensitivity; not part of F1.)

**Manager-scope coverage caveat (F2):** `can_read_person`'s "direct manager" clause keys on
`public.directory.manager_email`, populated only where both the report and the manager have a
verified `@webook.com` account. The `people.manager_id` chain is complete, but several managers
have no account yet, so their reports' manager-scoped reads do not fire until the account exists
(the subject and any director/admin can still read them). The exact gap is documented in
`supabase/0004_people.sql` — we are not silently shipping a half-working manager scope.

## For any department (generalizable)
The model is role + relationship, not hard-coded to events ops. Any department plugs in its own
org tree; the same tiers, the same field-sensitivity, the same aggregate-vs-drilldown split apply.

## Sources
[RBAC vs ABAC — Okta](https://www.okta.com/identity-101/role-based-access-control-vs-attribute-based-access-control/) · [ReBAC / Zanzibar — OpenFGA](https://openfga.dev/docs/authorization-concepts) · [NIST RBAC model](https://csrc.nist.gov/CSRC/media/Publications/conference-paper/2000/07/26/the-nist-model-for-role-based-access-control-towards-a-unified-/documents/sandhu-ferraiolo-kuhn-00.pdf) · [Least privilege — Netwrix](https://netwrix.com/en/cybersecurity-glossary/architectural-concepts/least-privilege/) · [Field-level security & masking — Microsoft](https://learn.microsoft.com/en-us/power-platform/admin/field-level-security) · [App permission UX — NN/g](https://www.nngroup.com/videos/app-permission-requests/) · [Anonymity threshold k≥5 — Betterworks](https://support.betterworks.com/hc/en-us/articles/5001561720461-Anonymity-Threshold) · [HR confidentiality — Lanteria](https://www.lanteria.com/news/is-hr-confidential)

> Contested: whether HR can read managers' private notes, and whether managers see reports'
> comp, vary by company — decide deliberately. Skip-level seeing weaknesses for calibration is
> sometimes allowed behind an explicit calibration context; default here is hidden.
