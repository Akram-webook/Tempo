# Wave D — go-live runbook (turning on REAL data)

The exact, ordered steps for **Akram** to switch Tempo from synthetic mock to real data.
F1 is closed in code (people + growth are server-RLS-enforced); this runbook is the clean
switch. **Every step is reversible** (the bundled synthetic mock stays as the offline /
pre-migration fallback, and server data wins only when present).

> **The one rule that must never break:** real people/growth **values** live ONLY in
> Supabase (under RLS) and in the operator's source file (never committed). They must
> **never** be placed in `src/js/data/**` (the front-end bundle) or any client path.
> The bundle stays synthetic. The loader (`tools/data-load.js`) is the only sanctioned
> write path, and it writes only to Supabase via the service role.

Project: **`ftkbjsxdrxtjdzcojnve`**. Env var **names** only below — never paste secret values.

---

## Step 1 — apply the migrations (Supabase SQL editor), in order
Run each once, in the project's SQL editor. All are idempotent (safe to re-run).

| # | File | What it does |
|---|------|--------------|
| 0001 | `supabase/0001_evaluations.sql` | evaluations table + RLS baseline |
| 0002 | `supabase/0002_events.sql` | append-only events store |
| 0003 | `supabase/0003_directory_and_rls.sql` | `directory`, `can_read_person`, role-scoped reads |
| 0004 | `supabase/0004_people.sql` | `public.people` (non-sensitive) under `can_read_person` |
| 0005 | `supabase/0005_growth.sql` | `public.growth` (sensitive) under the stricter `can_see_sensitive` |
| 0006 | `supabase/0006_directory_manager_email.sql` | F2: populate `directory.manager_email` for known manager accounts |

After this, `people` and `growth` exist with RLS on and **no client write policy** — the
only way to write them is the service role (Step 2).

## Step 2 — load real people + growth (service role, server-side)
The loader UPSERTS into `public.people` + `public.growth` via the **service role** (bypasses
RLS for the write — the sanctioned path). Secrets come from the environment only.

```bash
# required env (set in your shell / secret store — NEVER commit, NEVER paste values)
export SUPABASE_URL=...                 # https://<proj>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...    # service_role — SERVER ONLY, never the front-end
export TEMPO_DATALOAD_SOURCE=...        # path to your real people+growth source (NOT committed)

npm run data-load:dry     # preview: full loop, logs what WOULD upsert, writes NOTHING
npm run data-load         # real: upsert people + growth (idempotent on person_id)
# equivalently: node tools/data-load.js [--dry] [--source <path>]
```

**Source file shape** (`TEMPO_DATALOAD_SOURCE`, JSON — preferred):
```json
{
  "people": [
    { "person_id": "p_x", "name": "...", "name_ar": "...", "title": "...", "title_ar": "...",
      "level": "manager", "manager_id": "p_y", "employment": "fulltime", "initials": "XX", "active": true }
  ],
  "growth": [
    { "person_id": "p_x", "skills": [...], "eq": {...}, "manager_note": {...},
      "director_note": {...}, "quarterly": [...], "work_style": {...} }
  ]
}
```
- camelCase aliases (`nameAr`, `managerId`, `managerNote`, `workStyle`) are accepted.
- A flat **`.csv`** is accepted for the **people** table only (header row = column names);
  growth is nested, so use JSON for it.
- **Idempotent:** upsert on `person_id` (`Prefer: resolution=merge-duplicates`) — re-running
  updates the same rows, never duplicates.
- **Safe:** a row with no `person_id` is skipped + counted (never inserted); a network fault
  is a logged **no-op (exit 0)**; only a real misconfig (missing env / missing source on a
  non-dry run) exits **non-zero**. The structured summary reports
  `{peopleScanned, peopleValid, peopleUpserted, growthScanned, growthValid, growthUpserted, skipped, errors, dry}`.
- **CI:** `npm test` runs `test/verify-data-load.js` — the full loop against a fake source +
  fake upsert (no network), proving shape, skip-counting, dry-writes-nothing, idempotency,
  misconfig→exit-1, runtime-fault→exit-0, no-secret-logged, and that the bundle stays synthetic.

## Step 3 — stand up the Slack daily check-in ingest (F-034)
1. Create the `#daily-checkin` Slack Workflow form / channel.
2. Invite the app/bot to that channel.
3. Set the ingest env + schedule it (see `docs/slack-ingest-runbook.md`):
   `SLACK_BOT_TOKEN`, `SLACK_CHECKIN_CHANNEL_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   Until the channel exists + the bot is invited, every run is a safe no-op.

## Step 4 — two-account RLS spot-check (live; RLS can't be unit-tested)
Sign in as two real accounts in two browsers and confirm the database enforces access:
1. **Manager sees own + direct reports' people rows** (e.g. `akram@webook.com` → own + `p_idris/p_osama/p_gamal`).
2. **Direct manager sees a report's GROWTH; SKIP-LEVEL is denied** — a manager who manages a
   manager who manages X gets **no** growth rows for X (only direct reports).
3. **Peer denied** — a peer reads neither another person's directory-scoped rows nor any growth.
4. **Director sees all.**
5. **No client write** — any non-service account `insert/update/delete` on `people`/`growth` is rejected.

## Step 5 — provision the missing manager accounts (F2, data half)
`can_read_person` / `can_see_sensitive` fire the direct-manager clause only where the manager
has a verified account + `directory.manager_email` for the report. Today only `p_akram` and
`p_abdulrahman` resolve (see `supabase/0006_directory_manager_email.sql` for the exact list of
reports still blocked). For each missing manager: create their verified `@webook.com` account
(directory row), then add an `UPDATE public.directory SET manager_email = '<mgr>' WHERE email = '<report>'`
to 0006 and re-run it. **Do not fake emails.** Until then, those reports are still readable by
the subject and any director/admin — just not by their (account-less) direct manager.

---

### Rollback / safety
- The bundled synthetic mock is always the fallback: if the DB is unreachable or a user is
  signed out, the app shows synthetic data, never blank. Removing/repointing the env reverts.
- Migrations are idempotent; the loader is idempotent. Nothing here is a one-way door.
- **Not in this wave:** the edge auth gate (F3, Cloudflare Access — infra/Akram). The app-level
  filter deters but does not lock a public static host; the real lock is the edge gate or the
  server backend (now in place for people/growth/evaluations/events via RLS).
