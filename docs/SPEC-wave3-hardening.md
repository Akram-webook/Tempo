# SPEC — Wave 3 Hardening (from the QA pass) · run through TAOS
Fixes the QA findings before the Slack real-data phase. Two independent parts → two builders, isolated
worktrees. Follow CLAUDE.md + INTELLIGENCE-ETHICS. Part A is the one that matters before real data.

## PART A — Role-scoped RLS (SEV2, security) · size L · Backend builder
Today evaluations + events allow `select ... using(true)` — any signed-in user can read all rows via
the anon key; only the UI gates them. Tighten the DATABASE so reads are role-scoped (the real "move
roles server-side" milestone). This is required before real evaluation/wellbeing data exists.

Design:
1. New migration `supabase/0003_directory_and_rls.sql`:
   - `create table public.directory (email text primary key, person_id text, role text, manager_email text)`.
     `role` ∈ employee | manager | director | admin. Enable RLS; allow each user to read their own
     directory row (and directors/admins to read all) — directory itself is not sensitive.
   - Seed it from the app's known org (the 13 EMAILS + manager relationships in mock-data). Provide a
     documented INSERT block in the migration (idempotent: `on conflict (email) do update`).
   - A SQL helper `can_read_person(subject_person_id text) returns boolean`: true if
     auth.email() owns the row, OR auth.email()'s directory role is director/admin, OR auth.email() is
     the subject's manager (subject's directory.manager_email = auth.email()).
   - Replace the permissive SELECT policies on `evaluations` and `events` with policies that use
     `can_read_person(subject_id)`. Keep insert/update/delete as-is (own rows only).
2. `WP.db` unchanged in shape; it already calls the same tables — just confirm reads still work for a
   manager (own + reports) and return empty for a peer.
3. Tests: extend `test/verify-db.js` (and a SQL note) — a peer's query returns no rows; a manager sees
   own + reports; director sees all. Document in ACCESS-SETUP.md that Phase-2 role-scoped reads are now ON.
Akram will run `0003_*.sql` in Supabase after merge (same as 0001/0002).

## PART B — Correctness + UX fixes (SEV3/4) · size S · Frontend builder
1. **Eval cycle routing (S3-1):** opening an employee from the active cycle hub must open THAT cycle's
   evaluation (it currently opened "2025 Mid-Year" from the "Q2 2026 Active" hub). Fix the selection so
   the active cycle's evaluation is loaded.
2. **Restore the "Sample data" honesty badge (S3-2):** ensure the amber "Sample data" pill shows on the
   dashboard (and ideally app-wide) while data is sample — it's a trust signal. Re-add if the polish dropped it.
3. **Team Health wording (S3-3):** "Team Health 0%" reads as alarm. Reword to make clear it's "0 of N in
   the healthy band" (or show the band split) — informative, not scary. Keep the calm framing.
4. **Back button label (S4-1):** an evaluation opened from Evaluations should say "Back to evaluations"
   (match the origin), not "Back to map".
5. **Eval-Prep copy (S4-2):** when the sparse-state banner ("Not enough evidence yet") shows alongside a
   few real evidence items, adjust copy so they don't read as contradictory (e.g. "Limited evidence so far
   — here's what's on record").

## Both parts
npm run build && npm test green; open separate PRs (don't merge); Product Health Score in each. Worktree
per builder. The F-010 `--text-secondary` token is already in the backlog — optional to fold into Part B.
