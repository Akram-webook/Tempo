-- ============================================================
-- Tempo — Supabase migration 0006: directory.manager_email completion (F2, code half)
-- ------------------------------------------------------------
-- QA finding F2: can_read_person (0003) and can_see_sensitive (0005) both resolve the
-- "direct manager" clause via public.directory.manager_email. That column fires a
-- manager-scoped read ONLY where BOTH the report AND the manager have a verified
-- @webook.com account in the directory. This migration populates manager_email for
-- every report whose manager's account email we KNOW — so the direct-manager clause
-- lights up the moment each manager's account exists. We do NOT fake emails.
--
-- Idempotent — safe to re-run. Run in project ftkbjsxdrxtjdzcojnve AFTER 0001–0005.
--
-- NOTE: this is the CODE half of F2. The DATA half — provisioning the missing manager
-- accounts (so the rows below that currently can't resolve start working) — is Akram's
-- go-live step (create the verified @webook.com accounts, then extend this file). See
-- docs/WAVE-D-runbook.md step 5.
-- ============================================================

-- ---- 1) Resolvable today: report account + manager account both exist ----------
-- These mirror what 0003 already seeded; re-asserted here idempotently as the single
-- canonical home for the manager_email map (extend this block as accounts are added).
update public.directory set manager_email = 'akram@webook.com'
  where email in ('o.taher.c@webook.com', 'm.ali.c@webook.com', 'mohammed.adris.c@webook.com');  -- p_osama, p_gamal, p_idris -> p_akram
update public.directory set manager_email = 'maksousa@webook.com'
  where email = 'talal.samir.c@webook.com';                                                       -- p_talal -> p_abdulrahman

-- ---- 2) NOT yet resolvable — manager has NO verified account (Akram, step 5) ----
-- Every line here is a report WITH an account whose DIRECT manager has NO account, so
-- manager_email stays NULL and their manager-scoped reads cannot fire until the
-- manager is provisioned. We deliberately set NOTHING (no fake emails):
--   report (has acct)            direct manager (NO acct yet)
--   maksousa@webook.com   (p_abdulrahman) -> p_motaa
--   shamma@webook.com     (p_shamma)      -> p_motaa
--   zaidan@webook.com     (p_zaidan)      -> p_hani
--   faraj@webook.com      (p_faraj)       -> p_hani
--   fouda@webook.com      (p_fouda)       -> p_hani
--   abdelaal@webook.com   (p_abdelaal)    -> p_hani
--   meshal@webook.com     (p_meshalB)     -> p_ayah
-- (ahmed.othman@webook.com / p_ahmed reports to p_hamdi but is a director — reads via role.)
-- And every person WITHOUT an account has no directory row at all, so they neither read
-- nor are manager-resolvable until provisioned. To close these: create the manager's
-- verified account (directory row), then add an UPDATE … set manager_email above.
-- ============================================================
