-- ============================================================
-- Tempo — Supabase migration 0004: people directory, server-backed under RLS
--   (F1 remediation, Phase 1 — the safe spine: NON-sensitive directory fields only)
-- ------------------------------------------------------------
-- QA finding F1 (the gate to real rollout): the org directory (people records)
-- ships as a BUNDLED MOCK file (src/js/data/mock-data.js) rendered behind a
-- CLIENT-SIDE access filter (access.js). The moment real people data replaces the
-- mock in the static bundle, EVERY signed-in browser receives the whole org —
-- access.js (presentation-only) cannot prevent it. This migration moves the
-- directory server-side so the DATABASE enforces who may read whom, exactly like
-- evaluations/events already do (migration 0003).
--
-- SCOPE (Phase 1): ONLY non-sensitive directory fields live here — name, title,
-- level, manager, employment, initials, active. NO growth areas, NO manager notes,
-- NO retention/promotion signals: those are Phase 2 (0005_growth.sql) under a
-- STRICTER predicate. This phase carries nothing sensitive — it is the safe spine.
--
-- Reads are gated by the SAME predicate as 0003: public.can_read_person(person_id)
--   true if you ARE the subject, OR a director/admin, OR the subject's DIRECT manager.
-- Writes: none from clients. The directory is maintained out-of-band (this migration
-- / service-role admin tooling), so RLS-on + no write policy = clients cannot mutate.
--
-- Run in the Supabase SQL editor (project ftkbjsxdrxtjdzcojnve), AFTER 0001–0003.
-- Idempotent — safe to re-run.
-- ============================================================

-- ---- 1) The people directory table -------------------------------------
create table if not exists public.people (
  person_id   text primary key,                 -- app person id (p_*) — matches directory.person_id, evaluations/events.subject_id
  name        text,
  name_ar     text,
  title       text,
  title_ar    text,
  level       text,                              -- director | sr_manager | manager | sr_spec | spec
  manager_id  text,                              -- this person's DIRECT manager's person_id (null at the top) — full chain seeded (F2)
  employment  text default 'fulltime',          -- fulltime | freelance
  initials    text,
  active      boolean not null default true      -- false for TBC/placeholder seats
);

-- manager_id is how the org tree is walked; index it so descendant/report
-- lookups do not seq-scan as the directory grows (Scalability lens).
create index if not exists people_manager_id on public.people (manager_id);

alter table public.people enable row level security;

-- ---- 2) Read policy: reuse the 0003 role-scoped predicate ---------------
-- Non-sensitive directory data, but still role-scoped: a peer cannot enumerate
-- the whole org directly via the publishable key. can_read_person already encodes
-- self / director-or-admin / direct-manager (see 0003).
drop policy if exists people_select_scoped on public.people;
create policy people_select_scoped on public.people
  for select to authenticated
  using (public.can_read_person(person_id));

-- No INSERT/UPDATE/DELETE policies on purpose: client writes are impossible while
-- RLS is on. Maintained by this migration + service-role tooling only.

-- ---- 3) Seed from the app's known org (NON-sensitive fields only) -------
-- Source of truth: src/js/data/mock-data.js (PEOPLE). Full manager_id chain is
-- carried so manager-scoped tree walks resolve (F2). Mock stays in the bundle as
-- the signed-out / offline / pre-migration FALLBACK; server rows win when present.
insert into public.people (person_id, name, name_ar, title, title_ar, level, manager_id, employment, initials, active) values
  ('p_hamdi', 'Hamdi Missaoui', 'حمدي المسعودي', 'Chief Commercial Officer', 'الرئيس التجاري', 'director', null, 'fulltime', 'HM', true),
  ('p_ahmed', 'Ahmed Othman', 'أحمد عثمان', 'Event Operations Director', 'مدير عمليات الفعاليات', 'director', 'p_hamdi', 'fulltime', 'AO', true),
  ('p_ayman', 'Ayman Albasha', 'أيمن الباشا', 'Event Operations Sr. Manager', 'مدير أول لعمليات الفعاليات', 'sr_manager', 'p_ahmed', 'fulltime', 'AB', true),
  ('p_shahad', 'Shahad Joudah', 'شهد جوده', 'Event Operations Specialist - Trainer', 'أخصائية عمليات الفعاليات - مدرّبة', 'spec', 'p_ayman', 'fulltime', 'SJ', true),
  ('p_batool', 'Batool Emad', 'بتول عماد', 'Event Operations Manager Anti-Fraud', 'مدير عمليات الفعاليات - مكافحة الاحتيال', 'manager', 'p_ayman', 'fulltime', 'BE', true),
  ('p_tbc_af_spec', 'TBC', 'يُحدّد لاحقاً', 'Event Operations Specialist Anti-Fraud', 'أخصائي عمليات الفعاليات - مكافحة الاحتيال', 'spec', 'p_batool', 'fulltime', 'TBC', false),
  ('p_tbc_af_coord', 'TBC', 'يُحدّد لاحقاً', 'Event Operations Coordinator Anti-Fraud', 'منسّق عمليات الفعاليات - مكافحة الاحتيال', 'spec', 'p_batool', 'fulltime', 'TBC', false),
  ('p_motaa', 'Motaa Aldarra', 'مطاع الدرة', 'Event Operations Sr. Manager', 'مدير أول لعمليات الفعاليات', 'sr_manager', 'p_ahmed', 'fulltime', 'MA', true),
  ('p_akram', 'Mohammed Akram', 'محمد أكرم', 'Event Operations Manager', 'مدير عمليات الفعاليات', 'manager', 'p_motaa', 'fulltime', 'MA', true),
  ('p_abdulrahman', 'A. Maksosah', 'عبدالرحمن مقصوصة', 'Event Operations Sr. Specialist', 'أخصائي أول لعمليات الفعاليات', 'sr_spec', 'p_motaa', 'fulltime', 'AM', true),
  ('p_khaled', 'Khaled Jeneina', 'خالد جنينة', 'Event Operations Sr. Specialist', 'أخصائي أول لعمليات الفعاليات', 'sr_spec', 'p_motaa', 'fulltime', 'KJ', true),
  ('p_shamma', 'Shamma Alsagr', 'شما الصقر', 'Event Operations Specialist', 'أخصائية عمليات الفعاليات', 'spec', 'p_motaa', 'fulltime', 'SA', true),
  ('p_idris', 'Mohammed Adris', 'محمد إدريس', 'Event Operations Specialist', 'أخصائي عمليات الفعاليات', 'spec', 'p_akram', 'fulltime', 'MA', true),
  ('p_tbc_sports', 'TBC', 'يُحدّد لاحقاً', 'Event Operations Specialist', 'أخصائي عمليات الفعاليات', 'spec', 'p_motaa', 'fulltime', 'TBC', false),
  ('p_osama', 'Osama AlBasha', 'أسامة الباشا', 'Event Operations Specialist', 'أخصائي عمليات الفعاليات', 'spec', 'p_akram', 'freelance', 'OA', true),
  ('p_gamal', 'Mohammed Jamal', 'محمد جمال', 'Event Operations Specialist', 'أخصائي عمليات الفعاليات', 'spec', 'p_akram', 'freelance', 'MJ', true),
  ('p_duha', 'Duha Alzahrani', 'ضحى الزهراني', 'Event Operations Specialist', 'أخصائية عمليات الفعاليات', 'spec', 'p_farah', 'freelance', 'DA', true),
  ('p_talal', 'Talal', 'طلال', 'Event Operations Specialist', 'أخصائي عمليات الفعاليات', 'spec', 'p_abdulrahman', 'freelance', 'TA', true),
  ('p_ibrahim', 'Ibrahim Al-bard', 'إبراهيم البارد', 'Event Operations Specialist', 'أخصائي عمليات الفعاليات', 'spec', 'p_khaled', 'freelance', 'IA', true),
  ('p_ayah', 'Aya Nasif', 'آية ناصف', 'Event Operations Sr. Manager', 'مدير أول لعمليات الفعاليات', 'sr_manager', 'p_ahmed', 'fulltime', 'AN', true),
  ('p_farah', 'Farah Alsmay', 'فرح السامي', 'Event Operations Manager', 'مدير عمليات الفعاليات', 'manager', 'p_ayah', 'fulltime', 'FA', true),
  ('p_amen', 'Amen Shannah', 'أمين شنّاح', 'Event Operations Sr. Specialist', 'أخصائي أول لعمليات الفعاليات', 'sr_spec', 'p_ayah', 'fulltime', 'AS', true),
  ('p_meshalB', 'Meshaal Houshan', 'مشعل حوشان', 'Event Operations Sr. Specialist', 'أخصائي أول لعمليات الفعاليات', 'sr_spec', 'p_ayah', 'fulltime', 'MH', true),
  ('p_meshalA', 'Meshaal Alsmari', 'مشعل السمري', 'Event Operations Coordinator', 'منسّق عمليات الفعاليات', 'spec', 'p_ayah', 'fulltime', 'MS', true),
  ('p_raghdaa', 'Raghdaa', 'رغداء', 'Event Operations Coordinator', 'منسّق عمليات الفعاليات', 'spec', 'p_ayah', 'fulltime', 'RG', true),
  ('p_rana', 'Rana Alsalem', 'رنا السالم', 'Event Operations Specialist', 'أخصائية عمليات الفعاليات', 'spec', 'p_ayah', 'fulltime', 'RS', true),
  ('p_hani', 'Hani Ahmed', 'هاني أحمد', 'Event Operations Sr. Manager', 'مدير أول لعمليات الفعاليات', 'sr_manager', 'p_ahmed', 'fulltime', 'HA', true),
  ('p_zaidan', 'Mohammed Zaidan', 'محمد زيدان', 'Event Operations Manager - Execution', 'مدير عمليات الفعاليات - التنفيذ', 'manager', 'p_hani', 'fulltime', 'MZ', true),
  ('p_faraj', 'Ahmed Faraj', 'أحمد فرج', 'Event Operations Manager - Execution', 'مدير عمليات الفعاليات - التنفيذ', 'manager', 'p_hani', 'fulltime', 'AF', true),
  ('p_batarfi', 'Mohammed Batarfi', 'محمد باطرفي', 'Event Operations Sr. Specialist (Logistics)', 'أخصائي أول لعمليات الفعاليات (اللوجستيات)', 'sr_spec', 'p_hani', 'fulltime', 'MB', true),
  ('p_fouda', 'Ahmed Fouda', 'أحمد فودة', 'Event Operations Manager - Execution', 'مدير عمليات الفعاليات - التنفيذ', 'manager', 'p_hani', 'fulltime', 'AF', true),
  ('p_abdelaal', 'Ismail Abdelaal', 'إسماعيل عبدالعال', 'Event Operations Manager - Execution', 'مدير عمليات الفعاليات - التنفيذ', 'manager', 'p_hani', 'fulltime', 'IA', true),
  ('p_zarea', 'Omar Zarei', 'عمر زارع', 'Event Operations Manager', 'مدير عمليات الفعاليات', 'manager', 'p_ahmed', 'fulltime', 'OZ', true),
  ('p_rafah', 'Rafah Alansari', 'رفاه الأنصاري', 'Event Operations Sr. Specialist', 'أخصائية أول لعمليات الفعاليات', 'sr_spec', 'p_zarea', 'fulltime', 'RF', true),
  ('p_aljazi', 'Aljazi Alshubaike', 'الجازي الشبيكي', 'Event Operations Sr. Specialist', 'أخصائي أول لعمليات الفعاليات', 'sr_spec', 'p_zarea', 'fulltime', 'AA', true),
  ('p_rosa', 'Rosa Alansari', 'روزا الأنصاري', 'Event Operations Specialist', 'أخصائية عمليات الفعاليات', 'spec', 'p_zarea', 'fulltime', 'RA', true),
  ('p_altahini', 'Mohammed Altahini', 'محمد الطحيني', 'Event Operations Specialist', 'أخصائي عمليات الفعاليات', 'spec', 'p_zarea', 'fulltime', 'MT', true)
on conflict (person_id) do update
  set name = excluded.name, name_ar = excluded.name_ar,
      title = excluded.title, title_ar = excluded.title_ar,
      level = excluded.level, manager_id = excluded.manager_id,
      employment = excluded.employment, initials = excluded.initials,
      active = excluded.active;

-- ---- 4) F2 — honest note on manager-scoped read coverage ----------------
-- can_read_person's "direct manager" clause (0003) keys on public.directory.
-- manager_email, which is populated ONLY where BOTH the report and the manager have
-- a verified @webook.com account. The people.manager_id chain above is COMPLETE, but
-- the following DIRECT MANAGERS have NO verified account yet, so their reports'
-- manager-scoped reads will NOT fire until the account exists (the subject + any
-- director/admin can still read them):
--   p_hamdi (CCO)  — manages p_ahmed (moot: p_ahmed is a director, reads via role)
--   p_ayman        — manages p_shahad, p_batool
--   p_batool       — manages p_tbc_af_spec, p_tbc_af_coord (inactive seats)
--   p_motaa        — manages p_akram, p_abdulrahman, p_khaled, p_shamma, p_tbc_sports
--   p_khaled       — manages p_ibrahim
--   p_ayah         — manages p_farah, p_amen, p_meshalB, p_meshalA, p_raghdaa, p_rana
--   p_farah        — manages p_duha
--   p_hani         — manages p_zaidan, p_faraj, p_batarfi, p_fouda, p_abdelaal
--   p_zarea        — manages p_rafah, p_aljazi, p_rosa, p_altahini
-- Manager-scope DOES fire today only for the two managers who have accounts AND a
-- populated directory.manager_email for their reports:
--   p_akram         -> p_idris, p_osama, p_gamal
--   p_abdulrahman   -> p_talal
-- We are NOT silently shipping a half-working manager scope: this is the known gap,
-- closed only as those managers are provisioned in public.directory (0003 / admin
-- tooling sets their account email + their reports' manager_email).
-- ============================================================
