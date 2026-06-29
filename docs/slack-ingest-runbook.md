# Slack Daily Check-in ingest — operations runbook (F-034)

The scheduled, **server-side-only** job that turns `#daily-checkin` posts into sourced
evidence events. It is never bundled into the app (`build.js` only inlines `src/js/**`) and
uses the Supabase **service-role** key + a Slack bot token — both **secrets, read from the
environment, never committed**. Code: [`tools/slack-ingest-job.js`](../tools/slack-ingest-job.js).

> Ethics: this is operational/evidence-only ingest — it stamps a clear non-person system
> author (`system:slack-ingest`), gates events to `managers`, and **fails closed** (an author it
> can't map to a real person is dropped, never inserted with a NULL/placeholder identity). Same
> Intelligence-Ethics gate as the rest of the layer; nothing about it profiles a person.

## Run it

```bash
npm run ingest        # one real run: read new posts, append events, advance the cursor
npm run ingest:dry    # preview: full loop, logs what it WOULD append, writes nothing
# equivalently:
node tools/slack-ingest-job.js [--dry]
```

## Required environment (names only — never commit values)

| Var | What it is |
|-----|------------|
| `SLACK_BOT_TOKEN` | Slack bot token (`xoxb-…`); scopes `channels:history` + `users:read.email` |
| `SLACK_CHECKIN_CHANNEL_ID` | the `#daily-checkin` channel id (`C0…`) |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key — **server only**, never the front-end |
| `SLACK_FORM_BOT_USER_ID` | *(optional)* the Workflow-form bot user id → its posts get `confidence:'high'` |
| `TEMPO_INGEST_STATE` | *(optional)* path to the cursor state file (defaults to `.slack-ingest-state.json`) |

Set these in the scheduler's secret store. The cursor file (`.slack-ingest-state.json`) holds
only `{ last_run_ts }` — not a secret, and gitignored.

## Cron cadence

Every ~15 minutes is plenty for daily check-ins:

```cron
*/15 * * * *  cd /path/to/tempo && npm run ingest >> /var/log/tempo-ingest.log 2>&1
```

Re-running is **idempotent**: the cursor only advances over fully-processed messages, and each
event id is `slack:<dedupeKey>`, so a duplicate insert is ignored at the DB. A missed tick
self-heals on the next run.

## The run summary

`run()` returns (and the CLI logs) a structured summary:

| Field | Meaning |
|-------|---------|
| `scanned` | in-window messages examined this run |
| `parsed` | messages that parsed as a check-in |
| `inserted` | events newly written (in `--dry`, events that *would* be written) |
| `skipped` | messages turned into no events — unparseable/sparse, or unmapped author (fail-closed) |
| `deduped` | events already present (id conflict) — counted, not re-inserted |
| `errors` | per-message faults caught; the cursor halts there so the tail retries next run |
| `cursorAdvanced` | whether the cursor moved (always `false` in `--dry`) |

**Exit codes:** runtime faults (Slack or Supabase unreachable) are caught → logged **no-op,
exit 0**, no partial write, cursor unchanged. Only a real **misconfig** (a required env var
missing on a non-dry run) exits **non-zero**.

## Run-health heartbeat (`.slack-ingest-health.json`)

Every scheduled (non-`--dry`) run rewrites a tiny, **non-secret** health record next to the
cursor file, so a silently-stuck cursor or a creeping error count is visible without grepping
logs. Path override: `TEMPO_INGEST_HEALTH`. It carries **operational counts only — no message
text, no person/author, no PII.**

| Field | Meaning |
|-------|---------|
| `lastRunAt` | ISO timestamp of the most recent run |
| `lastSuccessAt` | ISO timestamp of the most recent run with `errors === 0` (frozen across error runs) |
| `lastSummary` | the last run's `{ scanned, parsed, inserted, skipped, deduped, errors, cursorAdvanced }` |
| `consecutiveErrorRuns` | count of back-to-back runs with `errors > 0`; resets to 0 on a clean run |
| `cursorStuckSince` | ISO timestamp set when there were messages but the cursor could **not** advance (e.g. the first message keeps erroring); cleared (`null`) once it advances again. An idle channel is **not** flagged. |

Suggested alerts: `consecutiveErrorRuns >= 3`, or `cursorStuckSince` older than ~1h, or
`now − lastSuccessAt` exceeding a few cron intervals. `--dry` previews do **not** write this
file (a manual preview must never clobber the scheduled-run health).

## CI

`npm test` runs `test/verify-slack-job.js` every build — the full loop against a fake paginated
Slack + id-keyed fake Supabase (no network), asserting cursor-advance, idempotent re-run, skip,
fail-closed drop, Slack-down no-op, the exact emitted events, the `--dry` no-op, the **429
Retry-After backoff** (bounded; exhaustion → clean no-op, with mocked timers — no real sleep),
and the **health record** shape/transitions + its no-PII guarantee.

## Go-live dependency (honest)

This job is **built, tested, and runnable now**, but it produces **real events only once
Akram** (a) creates the `#daily-checkin` Slack Workflow form / channel, **and** (b) invites the
app/bot to that channel. Until then every run is a safe no-op (Slack returns nothing / the bot
isn't in the channel → nothing to ingest). No code change is needed at go-live — only the env
vars set + the bot invited.
