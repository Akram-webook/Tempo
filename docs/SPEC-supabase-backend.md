# SPEC — Supabase backend (shared, multi-user data) · Phase 1

Status: ready for Claude Code. Scope is deliberately small (one entity, end-to-end) to prove the
pattern and de-risk; later phases migrate the rest. Follow `CLAUDE.md`.

## Why (Product lens)
Today all data is sample data in `src/js/data/*`, and the user's work (evaluations, role changes,
check-ins) is saved only in *their own browser* via `localStorage`. That means two people never see
the same data, and nothing survives a device change. The single biggest leap to "real product" is a
shared backend. We already have a Supabase project wired for auth — reuse it for data.

**Job to be done:** "When I record an evaluation (or any tracked work), my teammates and I see the
same, current data from any device — and only people allowed to see it can."

## Scope — Phase 1 ONLY (one vertical slice)
Migrate **evaluations** (the highest-value, write-heavy entity) to Supabase, end to end, behind a
thin data layer, **keeping localStorage as an automatic fallback** when the backend is unreachable
or not signed in. Do NOT migrate people/roles/check-ins yet — those come in later phases once this
pattern is proven and reviewed.

## Architecture (Solutions Architect lens)
- Add **one new module `src/js/core/db.js`** exposing an async data API, e.g.
  `WP.db.evaluations.list()/upsert(rec)/remove(id)`. It uses the existing Supabase client
  (`WP._sb` from `login.js`) when signed in; otherwise it transparently falls back to the current
  `localStorage` path in `persist.js`. **No UI file calls Supabase directly** — they call `WP.db`.
- This keeps the app working offline / signed-out, and means later phases only add new `WP.db.*`
  namespaces — no rewrites.
- Keep the bundler/single-file model intact: `db.js` is just another `<script>` in the core group,
  loaded after `config.js`/`state.js`, before the ui scripts.
- Realtime is **out of scope** for Phase 1 (no live subscriptions yet) — re-fetch on view load is
  enough and far simpler. Note it as a later phase.

## Data model + security (Backend lens)
Create a Supabase table (SQL migration committed to the repo under `supabase/`):
```sql
create table public.evaluations (
  id           text primary key,           -- keep the app's existing id scheme
  subject_id   text not null,              -- person being evaluated (p_*)
  author_id    text not null,              -- who wrote it (p_*)
  cycle        text not null,              -- e.g. 'Q1-2026'
  scores       jsonb not null default '{}',
  notes        text,
  updated_at   timestamptz not null default now(),
  author_email text not null default auth.email()
);
alter table public.evaluations enable row level security;
```
**RLS policies (server-enforced roles — the real lock):**
- Insert/update: only when `author_email = auth.email()` (you can only write as yourself).
- Select: author can read their own; managers/directors/super-admin can read their reports' rows.
  Phase 1 may start with "any authenticated @webook.com user can read" and tighten in Phase 2 once
  the role mapping is moved server-side — **call this tradeoff out in the PR, don't hide it.**
- Never expose the `service_role` key; the app uses only the public publishable key (RLS does the gating).

## UX / states (Designer lens)
Every data call must handle all states — no silent failures:
- **loading** (fetching) → skeleton/spinner in the evaluations view,
- **empty** (no evaluations yet) → the existing empty message,
- **error / offline** → a non-blocking inline notice "Saved locally — will sync when back online"
  (because we fall back to localStorage), styled with existing tokens,
- **success** → normal render; saving shows a subtle confirmation.
EN + AR strings for any new copy. No emojis as icons.

## Testing / QA (QA lens)
- Add `test/verify-db.js` (jsdom) that **mocks `WP._sb`** (no network): asserts `WP.db.evaluations`
  upserts/lists via Supabase when "signed in", and **falls back to localStorage** when the client is
  absent or throws. Assert no data loss on fallback and that a failed write surfaces the offline state.
- All existing suites must still pass. `npm run build` + `npm test` green, zero console errors.
- Risk-based focus: the highest risk is **data loss on the localStorage→Supabase handoff** — test
  that path explicitly (write offline → "sync" → no duplicates, no overwrites of newer data).

## Acceptance criteria (definition of done)
1. `WP.db.evaluations.{list,upsert,remove}` works against Supabase when signed in; falls back to
   localStorage otherwise — proven by `verify-db.js`.
2. The evaluations UI reads/writes only through `WP.db` (no direct Supabase calls in ui/).
3. SQL migration committed under `supabase/`; RLS enabled; documented in `ACCESS-SETUP.md`.
4. All states handled (loading/empty/error-offline/success), EN+AR.
5. All tests pass; bundle builds clean; PR opened (not merged) with the RLS tradeoff noted.
6. Zero change to people/roles/check-ins behavior (out of scope this phase).

## Risks & decisions for Akram (flag, don't assume)
- **Read policy in Phase 1**: start permissive (any signed-in @webook.com can read evaluations) vs.
  strict from day one (needs server-side role mapping first). Recommend permissive now + a Phase-2
  task to move roles server-side. Confirm before shipping.
- **Migrating existing localStorage data**: anyone who already entered evaluations locally — do we
  import theirs on first sign-in? Recommend yes, one-time, with de-dupe by id.

## Later phases (not now)
P2: move role/permission mapping server-side + tighten RLS. P3: migrate people/org + check-ins.
P4: realtime subscriptions (live updates). P5: audit log table.

---
**Paste to Claude Code:** "Implement docs/SPEC-supabase-backend.md (Phase 1 only). Follow CLAUDE.md,
add the WP.db layer + the SQL migration + verify-db.js, handle all UI states with EN+AR, keep
localStorage fallback, run npm run build && npm test, and open a PR (don't merge). Tell me the read-policy
and data-migration decisions you need from me."
