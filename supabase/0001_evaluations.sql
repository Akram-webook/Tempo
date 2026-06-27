-- ============================================================
-- Tempo — Supabase migration 0001: evaluations (Phase 1)
-- ------------------------------------------------------------
-- One vertical slice: move the evaluations entity to a shared backend.
-- The app talks to this table ONLY through WP.db (src/js/core/db.js),
-- which falls back to localStorage when signed out / offline.
--
-- Columns beyond the original SPEC: `feedback jsonb` + `status text`.
-- The app's evaluation record carries 16 weighted `scores` AND 6 qualitative
-- `feedback` answers plus a workflow `status` (Not started / In progress /
-- Completed). Storing those in typed jsonb/text columns makes the row a
-- LOSSLESS round-trip of the app record — the #1 risk in this phase is data
-- loss on the localStorage -> Supabase handoff, so nothing is dropped.
--
-- Run in the Supabase SQL editor (project ftkbjsxdrxtjdzcojnve). Idempotent.
-- ============================================================

create table if not exists public.evaluations (
  id           text primary key,                 -- app id scheme (keyed by subject, e.g. p_akram)
  subject_id   text not null,                    -- person being evaluated (p_*)
  author_id    text not null default '',         -- app person id of the evaluator (p_*), '' until assigned
  cycle        text not null default '',         -- e.g. '2025 Mid-Year'
  scores       jsonb not null default '{}',      -- { criterionId: 1..5 }
  feedback     jsonb not null default '{}',      -- { achievements, strengths, growth, trainings, general, recommendations }
  status       text  not null default 'Not started',
  notes        text,                             -- reserved (freeform); unused in Phase 1
  updated_at   timestamptz not null default now(),
  author_email text not null default auth.email() -- the real auth identity; set server-side via default
);

alter table public.evaluations enable row level security;

-- ---- RLS policies -------------------------------------------------------
-- WRITE (insert/update): you may only write rows stamped as yourself.
-- author_email defaults to auth.email() on insert, so the client never sends it.
drop policy if exists evaluations_insert_self on public.evaluations;
create policy evaluations_insert_self on public.evaluations
  for insert to authenticated
  with check (author_email = auth.email());

drop policy if exists evaluations_update_self on public.evaluations;
create policy evaluations_update_self on public.evaluations
  for update to authenticated
  using (author_email = auth.email())
  with check (author_email = auth.email());

-- READ (Phase 1, PERMISSIVE — see tradeoff in PR / ACCESS-SETUP.md):
-- any authenticated user may read all evaluations. Phase 2 tightens this to
-- role-scoped reads once the role mapping lives server-side.
drop policy if exists evaluations_select_authenticated on public.evaluations;
create policy evaluations_select_authenticated on public.evaluations
  for select to authenticated
  using (true);

-- DELETE: only your own rows.
drop policy if exists evaluations_delete_self on public.evaluations;
create policy evaluations_delete_self on public.evaluations
  for delete to authenticated
  using (author_email = auth.email());

-- Keep updated_at honest on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists evaluations_set_updated_at on public.evaluations;
create trigger evaluations_set_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();
