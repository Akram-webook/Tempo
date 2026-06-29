# SPEC — Slack real data → Evidence Timeline (F-034)

> Status: v1 implemented on `wave/slack-ingest`. This copy was authored from the
> implemented contract because the orchestrator's authoritative copy was not handed
> over at build time — **reconcile / replace with the authoritative version if it
> differs.** Gate: `ai-os/00-governance/INTELLIGENCE-ETHICS.md` (all six points).

## Why
Tempo's Evidence Timeline is real only if it draws on real work signals. The single
highest-trust, lowest-risk real source is the team's **daily check-in** already posted
in Slack. F-034 turns those self-reported, structured posts into evidence events —
**recording what the work is, never how a person behaves.**

## Non-negotiable boundaries (Intelligence-Ethics)
- **Source = the one public channel `#daily-checkin`.** No DMs, no private channels,
  no other channels.
- **Self-reported + opt-in.** We read what the person chose to post against the template.
- **Store only**: the verbatim work-item line, its category, the Slack permalink
  (provenance), the timestamp, and the resolved subject.
- **Never derive or store**: presence/online status, response time, message counts,
  typing, sentiment, tone, "activity", or any behavioural/psychological signal.
- **Never auto-scores.** A check-in is evidence a human reads, not a rating.

## v1 — the daily check-in template
```
Daily Check-in — <name> — <date>
Done today:
- <thing> (counts captured, e.g. "issued 40 tickets")
Blockers / need help:
- <thing>   | or "none"
Tomorrow:
- <focus>
```
Form-generated or hand-typed; EN and AR both parse. Unfilled template hint lines (the
parenthesised examples) are dropped, not stored. `none` blockers produce no risk event.

## Architecture (two parts)
### A) Pure parser — `src/js/core/slackIngest.js` (in the app bundle)
No DOM, no network. Reused verbatim by the server job so behaviour can't drift.
- `parseCheckin(text) -> { isCheckin, name, date, done[], blockers[], tomorrow[] }`
  or `{ isCheckin:false, unparseable:true }`.
- `toEvents(parsed, ctx) -> [event,...]` — one check-in line = one event. **Fails closed:**
  returns `[]` unless `ctx.subjectId` is resolved.
- `extractCounts(line) -> [{ n, unit }]` — convenience totals on delivery lines; the
  verbatim line is always the source of truth.
- `dedupeKey(ts, category, i)` — stable per line.
- Category map: `done → delivery`, `blockers → risk`, `tomorrow → plan`.
- Tested by `test/verify-slack-ingest.js` (33 checks).

### B) Scheduled ingest job — `tools/slack-ingest-job.js` (server-side, NOT bundled)
Runs out-of-band with secrets from **env only** (`SLACK_BOT_TOKEN`,
`SLACK_CHECKIN_CHANNEL_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional
`SLACK_FORM_BOT_USER_ID`). Per run:
1. Read `#daily-checkin` messages since `last_run_ts` (state file, gitignored).
2. `parseCheckin` each; `unparseable` → log "couldn't read <ts>" + skip.
3. **Resolve author fail-closed**: Slack user → verified email → `public.directory`
   (`0003`) → `person_id`. No match → drop the whole post + log "unmapped author".
4. `confidence: 'high'` if posted by the Workflow form bot, else `'med'`.
5. `toEvents` → append to `public.events`, **idempotent** by `id = 'slack:' + dedupeKey`
   (insert uses `Prefer: resolution=ignore-duplicates`).
6. `author_email = 'system:slack-ingest'` (the events table column is NOT NULL with a
   default of `auth.email()`, which is NULL under the service role — set explicitly).
7. Slack unreachable → no-op (no throw, no state write). Never hard-deletes.
- Tested by `test/verify-slack-job.js` (fake **paginated** Slack + id-keyed fake Supabase; 26
  checks proving cursor-advance, idempotent re-run, skip, fail-closed drop, Slack-down no-op,
  exact events, + a `--dry` smoke). Operations runbook: [`docs/slack-ingest-runbook.md`](slack-ingest-runbook.md).

### Running the job (operations runbook)
The job is **server-side only** — `build.js` never bundles `tools/**`, so it never reaches the
front-end. Secrets come from the environment, never the repo:

```bash
# required env (set in the scheduler's secret store — NOT committed)
export SLACK_BOT_TOKEN=xoxb-…             # scopes: channels:history, users:read.email
export SLACK_CHECKIN_CHANNEL_ID=C0XXXXXX  # the #daily-checkin channel id
export SUPABASE_URL=https://<proj>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ…     # service_role — SERVER ONLY, never front-end
export SLACK_FORM_BOT_USER_ID=U0…         # optional: posts by the form bot → confidence 'high'

npm run ingest        # one real run (advances the cursor, appends events idempotently)
npm run ingest:dry    # preview: full loop, logs what it WOULD append, writes nothing
```

- **Schedule it** as a cron / scheduled task (e.g. every 15 min): `*/15 * * * * cd /path/to/tempo && npm run ingest >> /var/log/tempo-ingest.log 2>&1`.
- The cursor lives in `.slack-ingest-state.json` (gitignored, not secret); override its path with
  `TEMPO_INGEST_STATE` (the CI mock points it at a temp file). Re-running over the same messages is
  **idempotent** (event id = `slack:<dedupeKey>`), so a missed tick self-heals on the next run.
- **CI smoke:** `npm test` runs `verify-slack-job.js`, which exercises the entire loop — including a
  `--dry` pass proving the cursor never advances and nothing is POSTed — against a fake Slack +
  Supabase with **no network**.

> **Go-live dependency (honest):** this makes the job *runnable and tested*, but it only produces real
> events once Akram stands up the `#daily-checkin` Slack Workflow form **and** invites the bot to that
> channel. Until then the job is a safe no-op (Slack returns nothing / unreachable → no-op).

## Access — same gate as everything else
Check-in events live in the `events` store and are read through
`can_read_person(subject_id)` (`supabase/0003_directory_and_rls.sql`). A **peer cannot
see another person's check-ins**; the **subject**, their **direct manager**, and
**Director/HR** can. Verified by `test/verify-db.js` scenario J.

## UI
No new view. The Evidence Timeline (`src/js/ui/profile.js`) already renders + filters
events; v1 extends its category vocabulary with `delivery / risk / plan`
(`src/js/core/events.js` `CATEGORIES`, EN/AR labels in `i18n.js`).

## Known limit (v1)
A person not yet in `directory` produces no events — safe and quiet by design (fail
closed); their check-ins are skipped until they're added.

## Out of scope (later)
Other channels, threaded replies, weekly summaries, retro/standup formats, backfill of
historical posts, and an admin UI for the Slack↔directory mapping.
