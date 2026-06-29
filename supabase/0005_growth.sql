-- ============================================================
-- Tempo — Supabase migration 0005: growth / sensitive fields, server-backed
--   under a STRICTER predicate than the directory (F1 remediation, Phase 2 —
--   the residual-risk closer)
-- ------------------------------------------------------------
-- QA finding F1, the part that actually matters most: the highest-sensitivity data
-- in the product — growth areas, manager notes, EQ (development-only), director
-- impact/potential notes, quarterly reliability, retention/promotion signals — has
-- until now shipped as a BUNDLED MOCK (src/js/data/growth-data.js) gated ONLY by the
-- client-side filter (access.canSeeSensitive). Any signed-in browser receives the
-- whole thing the moment real values replace the mock. Phase 1 (0004) moved the
-- non-sensitive directory server-side; THIS migration moves the sensitive growth
-- record server-side under a predicate that is INTENTIONALLY TIGHTER than the
-- directory read predicate.
--
-- THE STRICTER PREDICATE — public.can_see_sensitive(subject_person_id):
--     self  OR  the subject's DIRECT manager (one hop)  OR  director/admin.
--   NOT skip-level managers. NOT peers. This mirrors access.canSeeSensitive() and
--   exists to protect CANDOR: growth/notes are for the person, their direct manager,
--   and director/HR only.
--
-- Why a SEPARATE function when 0003.can_read_person currently has the same shape?
--   Defence-in-depth + separation of concerns. can_read_person gates the
--   (non-sensitive) directory/evaluations/events reads; it is plausible it will later
--   be WIDENED (e.g. to let any manager-in-chain browse the org directory). If
--   sensitive growth were coupled to that predicate, it would silently widen too.
--   can_see_sensitive has its OWN contract — direct-manager-only, never skip-level —
--   and its own regression test (verify-growth: the skip-level-DENIED assertion).
--   The two coincide today by design; they must be free to diverge safely tomorrow.
--   >>> Do NOT add a manager-CHAIN / skip-level clause to can_see_sensitive. <<<
--
-- SAFETY: clients cannot write (RLS-on + no write policy = service-role/admin only).
-- The app keeps the bundled SYNTHETIC mock as the signed-out / offline / pre-migration
-- fallback; server rows win when present (WP.db.growth). Never-blank, reversible.
--
-- GO-LIVE GUARD: real growth VALUES must NEVER be loaded into the front-end bundle.
-- They live only here, in public.growth, behind can_see_sensitive. The bundled mock
-- stays synthetic. That is the entire point of Phase 2.
--
-- Run in the Supabase SQL editor (project ftkbjsxdrxtjdzcojnve), AFTER 0001-0004.
-- Idempotent — safe to re-run.
-- ============================================================

-- ---- 1) The stricter predicate: direct-manager-only -----------------------
-- SECURITY DEFINER so it can consult the directory regardless of the caller's
-- directory RLS (and to avoid recursion when used inside a policy).
create or replace function public.can_see_sensitive(subject_person_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- (a) you ARE the subject (own development record)
    exists (
      select 1 from public.directory d
      where d.email = auth.email() and d.person_id = subject_person_id
    )
    -- (b) you are a director / admin (HR / exec — career stewardship)
    or public.current_directory_role() in ('director','admin')
    -- (c) you are the subject's DIRECT manager — ONE HOP ONLY.
    --     directory.manager_email is the subject's direct manager's email; this
    --     clause deliberately does NOT walk the chain, so a skip-level manager is
    --     DENIED. Never broaden this to a chain/recursive lookup.
    or exists (
      select 1 from public.directory s
      where s.person_id = subject_person_id and s.manager_email = auth.email()
    );
$$;

-- ---- 2) The growth table (sensitive) --------------------------------------
-- One row per person; each app sub-record kept as jsonb so the in-memory shape the
-- UI already reads (WP.data.GROWTH[id] = { skills, eq, managerNote, directorNote,
-- quarterly, workStyle }) round-trips losslessly. Static vocab (SKILL_LADDER,
-- EQ_DOMAINS, WORK_STAGES) is NOT person data and stays in the bundle.
create table if not exists public.growth (
  person_id     text primary key,
  skills        jsonb,   -- [{name,type,level,required,history[]}]
  eq            jsonb,   -- {selfAwareness,selfManagement,socialAwareness,relationshipManagement} (development-only)
  manager_note  jsonb,   -- {strengths[],growth[],suggestion}  — candor-protected
  director_note jsonb,   -- {impact,potential,suggestion}      — retention/promotion signal
  quarterly     jsonb,   -- [{q,rating,summary,improved[],focus[],reliability{}}]
  work_style    jsonb    -- {stage,followUp,note} — situational-leadership stage (task-specific, temporary)
);

alter table public.growth enable row level security;

-- ---- 3) Read policy: the STRICTER predicate -------------------------------
drop policy if exists growth_select_sensitive on public.growth;
create policy growth_select_sensitive on public.growth
  for select to authenticated
  using (public.can_see_sensitive(person_id));

-- No INSERT/UPDATE/DELETE policies: client writes are impossible while RLS is on.
-- Maintained by this migration + service-role tooling only.

-- ---- 4) Seed from the bundled SYNTHETIC mock (idempotent) -----------------
-- Source: src/js/data/growth-data.js (GROWTH). These are SYNTHETIC demo values; real
-- values are entered out-of-band into this table and must never enter the bundle.
insert into public.growth (person_id, skills, eq, manager_note, director_note, quarterly, work_style) values
  ('p_osama', '[{"name":"On-site operations","type":"hard","level":5,"required":4,"history":[4,4,5,5]},{"name":"Reporting","type":"hard","level":4,"required":3,"history":[2,3,3,4]},{"name":"English","type":"hard","level":4,"required":4,"history":[3,3,4,4]},{"name":"Problem solving","type":"soft","level":5,"required":4,"history":[4,4,5,5]},{"name":"Boundaries / saying no","type":"soft","level":2,"required":4,"history":[2,2,2,2]}]'::jsonb, '{"selfAwareness":4,"selfManagement":3,"socialAwareness":4,"relationshipManagement":4}'::jsonb, '{"strengths":["Calm under pressure","Trusted on the biggest events"],"growth":["Protecting his own capacity","Delegating to juniors"],"suggestion":"Ready for more scope — but pull one event off him first; he is over-relied on."}'::jsonb, '{"impact":"Carries our hardest events without dropping the ball.","potential":"High","suggestion":"Promotion-track. Give him a junior to mentor so he stops being a single point of failure."}'::jsonb, '[{"q":"Q2 2026","rating":"Exceeds","summary":"Delivered MDLBEAST + the international summit in parallel. Quality stayed high.","improved":["Reporting (3→4)","On-site ops (sustained 5)"],"focus":["Boundaries","Delegation"],"reliability":{"attendance":"No attendance concerns.","engagement":"Very active in #daily-checkin; logs late on event nights."}}]'::jsonb, '{"stage":"self_directed","followUp":false,"note":"Owns the biggest events; the risk is over-reliance, not direction."}'::jsonb),
  ('p_talal', '[{"name":"AV setup","type":"hard","level":4,"required":3,"history":[3,3,4,4]},{"name":"Reporting","type":"hard","level":2,"required":3,"history":[1,2,2,2]},{"name":"English","type":"hard","level":3,"required":3,"history":[2,2,3,3]},{"name":"Fast learning","type":"soft","level":5,"required":3,"history":[4,4,5,5]},{"name":"Ownership","type":"soft","level":3,"required":4,"history":[2,3,3,3]}]'::jsonb, '{"selfAwareness":4,"selfManagement":4,"socialAwareness":3,"relationshipManagement":3}'::jsonb, '{"strengths":["Learns fast","Volunteers for anything"],"growth":["Needs a bigger stage to prove ownership"],"suggestion":"Hungry and underused — give him the next Tier-2/Tier-3 solo to build a track record."}'::jsonb, '{"impact":"Reliable support so far; untested on big scope.","potential":"Medium","suggestion":"Has never been handed a Tier-1. Give him a shot before judging readiness — fairness check."}'::jsonb, '[{"q":"Q2 2026","rating":"Meets","summary":"Solid support on the gala. Asked twice for more responsibility.","improved":["AV setup (3→4)","English (2→3)"],"focus":["Lead something end-to-end","Reporting"],"reliability":{"attendance":"Excellent — never a no-show.","engagement":"Consistent daily check-ins."}}]'::jsonb, '{"stage":"capable","followUp":false,"note":"Can do more than he is given — hand him a real decision to prove it."}'::jsonb),
  ('p_akram', '[{"name":"Logistics","type":"hard","level":5,"required":4,"history":[4,4,5,5]},{"name":"Budgeting","type":"hard","level":4,"required":4,"history":[3,4,4,4]},{"name":"Reporting","type":"hard","level":5,"required":4,"history":[4,4,5,5]},{"name":"Team leadership","type":"soft","level":4,"required":4,"history":[3,3,4,4]},{"name":"Delegation","type":"soft","level":3,"required":4,"history":[2,3,3,3]}]'::jsonb, '{"selfAwareness":4,"selfManagement":4,"socialAwareness":4,"relationshipManagement":4}'::jsonb, '{"strengths":["Runs a tight operation","Builds systems"],"growth":["Delegating more to the team"],"suggestion":"Give him a stretch project that forces delegation."}'::jsonb, '{"impact":"Reliable manager; his team is the most organized.","potential":"High","suggestion":"Successor-track for the senior role; develop people-leadership breadth."}'::jsonb, '[{"q":"Q2 2026","rating":"Exceeds","summary":"Ran festival staffing + expo cleanly while building the workload view.","improved":["Reporting (4→5)"],"focus":["Delegation"],"reliability":{"attendance":"No concerns.","engagement":"Active."}}]'::jsonb, '{"stage":"self_directed","followUp":false,"note":"Runs his unit independently."}'::jsonb),
  ('p_motaa', '[{"name":"Ticketing systems","type":"hard","level":5,"required":4,"history":[4,5,5,5]},{"name":"Crisis handling","type":"hard","level":5,"required":4,"history":[4,5,5,5]},{"name":"Cross-team coord.","type":"soft","level":5,"required":4,"history":[4,4,5,5]},{"name":"Documentation","type":"hard","level":3,"required":4,"history":[2,2,3,3]},{"name":"English","type":"hard","level":5,"required":4,"history":[5,5,5,5]}]'::jsonb, '{"selfAwareness":5,"selfManagement":4,"socialAwareness":5,"relationshipManagement":5}'::jsonb, '{"strengths":["Steadies the whole team"],"growth":["Writing things down"],"suggestion":"Lean on him to mentor the leads."}'::jsonb, '{"impact":"Backbone of ticketing & operations.","potential":"High","suggestion":"Successor candidate; needs documentation discipline."}'::jsonb, '[{"q":"Q2 2026","rating":"Exceeds","summary":"Held Riyadh Season ticketing through two vendor failures.","improved":["Documentation (2→3)"],"focus":["Delegation"],"reliability":{"attendance":"No concerns.","engagement":"Active."}}]'::jsonb, '{"stage":"self_directed","followUp":false,"note":"Senior, fully autonomous."}'::jsonb),
  ('p_khaled', '[{"name":"Client relations","type":"soft","level":5,"required":4,"history":[4,5,5,5]},{"name":"On-site operations","type":"hard","level":4,"required":4,"history":[3,4,4,4]},{"name":"Reporting","type":"hard","level":3,"required":3,"history":[2,3,3,3]},{"name":"Scaling teams","type":"soft","level":2,"required":4,"history":[2,2,2,2]}]'::jsonb, '{"selfAwareness":4,"selfManagement":4,"socialAwareness":4,"relationshipManagement":5}'::jsonb, '{"strengths":["Trusted lead","Clients love him"],"growth":["Growing his small team"],"suggestion":"Give him a second report to stretch leadership."}'::jsonb, '{"impact":"Dependable lead with one report.","potential":"Medium","suggestion":"Formalize his lead role if he scales the team."}'::jsonb, '[{"q":"Q2 2026","rating":"Meets","summary":"Flawless corporate gala with Ibrahim.","improved":[],"focus":["Scaling teams"],"reliability":{"attendance":"No concerns.","engagement":"Active."}}]'::jsonb, '{"stage":"capable","followUp":false,"note":"Solid lead; encourage him to make the call without checking first."}'::jsonb),
  ('p_abdulrahman', '[{"name":"Planning","type":"hard","level":4,"required":4,"history":[3,4,4,4]},{"name":"Stakeholder comms","type":"soft","level":4,"required":4,"history":[3,4,4,4]},{"name":"English","type":"hard","level":4,"required":4,"history":[4,4,4,4]},{"name":"Delegation","type":"soft","level":3,"required":4,"history":[2,2,3,3]}]'::jsonb, '{"selfAwareness":4,"selfManagement":4,"socialAwareness":4,"relationshipManagement":4}'::jsonb, '{"strengths":["Organized planner","Mentors his two specialists"],"growth":["Delegation depth"],"suggestion":"Stretch him with a Tier-1 co-lead."}'::jsonb, '{"impact":"Strong senior specialist leading two people.","potential":"High","suggestion":"Manager-track with more team scope."}'::jsonb, '[{"q":"Q2 2026","rating":"Meets","summary":"Strong summit + school-fair planning; good with Shamma & Talal.","improved":["Delegation (2→3)"],"focus":["Tier-1 ownership"],"reliability":{"attendance":"No concerns.","engagement":"Active."}}]'::jsonb, '{"stage":"self_directed","followUp":false,"note":"Leads two people well."}'::jsonb),
  ('p_idris', '[{"name":"Vendor coordination","type":"hard","level":2,"required":3,"history":[null,null,null,2]},{"name":"Reporting","type":"hard","level":1,"required":3,"history":[null,null,null,1]},{"name":"Communication","type":"soft","level":3,"required":3,"history":[null,null,null,3]}]'::jsonb, '{"selfAwareness":3,"selfManagement":3,"socialAwareness":3,"relationshipManagement":3}'::jsonb, '{"strengths":["Eager","Picks things up quickly"],"growth":["Still ramping — everything is new"],"suggestion":"New hire (joined May). Keep load light; pair with a senior this quarter."}'::jsonb, '{"impact":"Too early to tell.","potential":"Medium","suggestion":"Protect ramp-up; revisit next quarter."}'::jsonb, '[{"q":"Q2 2026","rating":"Developing","summary":"Onboarding; shadowing the festival team.","improved":[],"focus":["Learn the tools","Reporting"],"reliability":{"attendance":"No concerns.","engagement":"Building the daily-checkin habit."}}]'::jsonb, '{"stage":"needs_direction","followUp":true,"note":"New hire — needs clear steps and frequent follow-up while ramping."}'::jsonb),
  ('p_gamal', '[{"name":"Ground operations","type":"hard","level":4,"required":3,"history":[3,3,4,4]},{"name":"Vendor coordination","type":"hard","level":4,"required":3,"history":[3,4,4,4]},{"name":"Reporting","type":"hard","level":3,"required":3,"history":[2,3,3,3]},{"name":"Ownership","type":"soft","level":4,"required":4,"history":[3,3,4,4]}]'::jsonb, '{"selfAwareness":4,"selfManagement":4,"socialAwareness":4,"relationshipManagement":4}'::jsonb, '{"strengths":["Strong on the ground","Owns his lane"],"growth":["Ready for a Tier-1 lead role"],"suggestion":"Solid — next step is co-leading a bigger event."}'::jsonb, '{"impact":"Dependable festival operator.","potential":"Medium","suggestion":"Give him a Tier-1 stretch."}'::jsonb, '[{"q":"Q2 2026","rating":"Meets","summary":"Clean festival ground ops + marathon logistics.","improved":["Vendor coordination (3→4)"],"focus":["Tier-1 leadership"],"reliability":{"attendance":"No concerns.","engagement":"Active."}}]'::jsonb, '{"stage":"developing","followUp":false,"note":"Growing fast; coach him toward leading a Tier-1."}'::jsonb),
  ('p_shamma', '[{"name":"Coordination","type":"hard","level":3,"required":3,"history":[2,3,3,3]},{"name":"English","type":"hard","level":4,"required":3,"history":[3,4,4,4]},{"name":"Communication","type":"soft","level":4,"required":4,"history":[3,4,4,4]},{"name":"Ownership","type":"soft","level":3,"required":4,"history":[2,3,3,3]}]'::jsonb, '{"selfAwareness":4,"selfManagement":4,"socialAwareness":4,"relationshipManagement":4}'::jsonb, '{"strengths":["Detail-oriented","Great communicator"],"growth":["Take on bigger scope"],"suggestion":"Ready for a larger event than the school fair."}'::jsonb, '{"impact":"Reliable specialist.","potential":"Medium","suggestion":"Give a Tier-2 to grow."}'::jsonb, '[{"q":"Q2 2026","rating":"Meets","summary":"Solid school-fair coordination.","improved":["English (3→4)"],"focus":["Bigger scope"],"reliability":{"attendance":"No concerns.","engagement":"Active."}}]'::jsonb, '{"stage":"developing","followUp":false,"note":"Reliable on defined tasks; coach toward bigger scope."}'::jsonb),
  ('p_ibrahim', '[{"name":"AV / setup","type":"hard","level":3,"required":3,"history":[2,3,3,3]},{"name":"Reporting","type":"hard","level":2,"required":3,"history":[1,2,2,2]},{"name":"Communication","type":"soft","level":3,"required":3,"history":[2,3,3,3]}]'::jsonb, '{"selfAwareness":3,"selfManagement":4,"socialAwareness":3,"relationshipManagement":3}'::jsonb, '{"strengths":["Dependable support"],"growth":["Reporting","Confidence to lead"],"suggestion":"Keep building fundamentals under Khaled."}'::jsonb, '{"impact":"Steady support specialist.","potential":"Medium","suggestion":"Develop reporting; revisit next quarter."}'::jsonb, '[{"q":"Q2 2026","rating":"Meets","summary":"Good gala support.","improved":["AV (2→3)"],"focus":["Reporting"],"reliability":{"attendance":"No concerns.","engagement":"Active."}}]'::jsonb, '{"stage":"needs_direction","followUp":true,"note":"Does well when tasks are spelled out; check in regularly for now."}'::jsonb),
  ('p_ahmed', '[{"name":"Stakeholder mgmt","type":"soft","level":5,"required":5,"history":[5,5,5,5]},{"name":"Vendor negotiation","type":"hard","level":5,"required":5,"history":[5,5,5,5]},{"name":"Delegation","type":"soft","level":4,"required":5,"history":[3,4,4,4]}]'::jsonb, '{"selfAwareness":5,"selfManagement":5,"socialAwareness":5,"relationshipManagement":5}'::jsonb, '{"strengths":["Owns the C-level relationship"],"growth":["Delegation"],"suggestion":"—"}'::jsonb, '{"impact":"Sets department direction.","potential":"High","suggestion":"—"}'::jsonb, '[{"q":"Q2 2026","rating":"Exceeds","summary":"Department-level leadership.","improved":[],"focus":["Delegation"],"reliability":{"attendance":"—","engagement":"—"}}]'::jsonb, '{"stage":"self_directed","followUp":false,"note":"Sets direction for the department."}'::jsonb)
on conflict (person_id) do update
  set skills = excluded.skills, eq = excluded.eq,
      manager_note = excluded.manager_note, director_note = excluded.director_note,
      quarterly = excluded.quarterly, work_style = excluded.work_style;

-- ---- 5) F2 — honest note on direct-manager read coverage ------------------
-- can_see_sensitive's "direct manager" clause keys on directory.manager_email, set
-- only where BOTH the report and the manager have a verified @webook.com account
-- (same gap documented in 0003/0004). So a direct manager's sensitive read fires
-- TODAY only for managers who have an account AND a populated manager_email for the
-- report — currently p_akram -> {p_idris, p_osama, p_gamal} and p_abdulrahman -> p_talal.
-- Self-reads and director/admin reads always fire. As managers are provisioned in
-- public.directory (account email + their reports' manager_email), their direct
-- sensitive reads light up automatically — no change here. Not silently half-working.
-- ============================================================
