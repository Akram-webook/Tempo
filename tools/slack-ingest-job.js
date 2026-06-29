#!/usr/bin/env node
/* ============================================================
 * Tempo — Slack Daily Check-in ingest JOB (F-034 v1)  ·  SERVER-SIDE ONLY
 * ------------------------------------------------------------
 * This is the scheduled side of F-034. It is NOT part of the app bundle
 * (build.js only inlines src/js/**) and NEVER ships to the front-end — it uses
 * the Supabase SERVICE ROLE key and a Slack bot token, both of which are SECRETS
 * and are read from the environment, never committed:
 *   SLACK_BOT_TOKEN              xoxb-...   (channels:history + users:read.email)
 *   SLACK_CHECKIN_CHANNEL_ID     C0XXXXXX   (#daily-checkin)
 *   SUPABASE_URL                 https://<proj>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    eyJ...     (service_role — server only)
 *   SLACK_FORM_BOT_USER_ID       (optional) the Workflow form's bot user id ->
 *                                posts by it get confidence 'high', else 'med'
 *
 * It reuses the PURE parser (src/js/core/slackIngest.js) verbatim — same code the
 * app tests cover — so parsing behaviour can never drift between client and job.
 *
 * Flow (per run): read #daily-checkin messages since last_run_ts -> parseCheckin ->
 *   unparseable: log "couldn't read <ts>" + skip
 *   resolve Slack author -> directory person_id (fail closed: no match -> drop+log)
 *   toEvents(parsed, ctx) -> append each to public.events, idempotent by dedupeKey.
 * Slack unreachable -> no-op (never throws the schedule). Never hard-deletes.
 *
 * Run: node tools/slack-ingest-job.js   (cron / scheduled task; --dry to preview)
 * ========================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

// ---- load the PURE parser exactly as the browser/tests do (no duplication) ----
const root = path.join(__dirname, '..');
const SI = (function () {
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(path.join(root, 'src/js/core/slackIngest.js'), 'utf8'))(sandbox.window);
  return sandbox.window.WP.slackIngest;
})();

const DRY = process.argv.includes('--dry');
// state file is overridable so the CI mock can point it at a temp path
const STATE_FILE = process.env.TEMPO_INGEST_STATE || path.join(root, '.slack-ingest-state.json'); // { last_run_ts } — not secret
const env = process.env;

function log(msg) { console.log('[slack-ingest] ' + msg); }
function need(k) { const v = env[k]; if (!v && !DRY) throw new Error('missing env ' + k); return v || ''; }

function readState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { return { last_run_ts: '0' }; } }
function writeState(s) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch (e) {} }

// ---- thin Slack + Supabase REST clients (no extra deps; Node 18+ global fetch) ----
async function slack(method, params) {
  const url = 'https://slack.com/api/' + method + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + need('SLACK_BOT_TOKEN') } });
  const json = await res.json();
  if (!json.ok) throw new Error('slack ' + method + ': ' + json.error);
  return json;
}

// Resolve a Slack user -> directory person_id. Reads the Slack user's verified
// email, then looks it up in public.directory (migration 0003). FAIL CLOSED:
// any miss (no email, not in directory) -> null, and the caller drops the post.
const _authorCache = {};
async function resolveSlackAuthor(slackUserId) {
  if (slackUserId in _authorCache) return _authorCache[slackUserId];
  let personId = null;
  try {
    const info = await slack('users.info', { user: slackUserId });
    const email = info.user && info.user.profile && info.user.profile.email;
    if (email) {
      const rows = await supa('GET', '/rest/v1/directory?select=person_id&email=eq=' + encodeURIComponent(email.toLowerCase()));
      if (rows && rows[0] && rows[0].person_id) personId = rows[0].person_id;
    }
  } catch (e) { log('resolve error for ' + slackUserId + ': ' + e.message); }
  _authorCache[slackUserId] = personId;
  return personId;
}

async function supa(verb, pathRel, body) {
  const url = need('SUPABASE_URL') + pathRel.replace('=eq=', '=eq.'); // small ergonomics for callers
  const headers = {
    apikey: need('SUPABASE_SERVICE_ROLE_KEY'),
    Authorization: 'Bearer ' + need('SUPABASE_SERVICE_ROLE_KEY'),
    'Content-Type': 'application/json',
    Prefer: 'resolution=ignore-duplicates,return=minimal' // idempotent insert on PK conflict
  };
  const res = await fetch(url, { method: verb, headers: headers, body: body ? JSON.stringify(body) : undefined });
  if (verb === 'GET') return res.json();
  // 409 = primary-key conflict on id='slack:<dedupeKey>' → already ingested (deduped),
  // not an error. (Prod also uses Prefer:ignore-duplicates, so this is belt-and-braces.)
  if (res.status === 409) return { duplicate: true };
  if (!res.ok) throw new Error('supabase ' + res.status + ' ' + (await res.text()));
  return { duplicate: false };
}

// Map a pure-module event -> the events store row, using dedupeKey as the stable
// primary id so re-runs are idempotent (insert ignores duplicates).
function toRow(ev) {
  return {
    id: 'slack:' + ev.dedupeKey,
    // events.author_email is NOT NULL with a default of auth.email(), which is NULL
    // under the service-role key the job runs as -> set it explicitly to a clear
    // non-person system author (never a real person's email). Matches `actor`.
    author_email: 'system:slack-ingest',
    ts: ev.ts, type: ev.type, actor: ev.actor, subject_id: ev.subjectId,
    category: ev.category, description: ev.description, source: ev.source,
    confidence: ev.confidence, evidence_refs: ev.evidenceRefs || [],
    visibility: 'managers', related: ev.metrics ? { metrics: ev.metrics, checkinId: ev.checkinId } : { checkinId: ev.checkinId }
  };
}

// Read EVERY page of channel history since the cursor. Returns all messages, or
// throws (caller turns that into a clean no-op — never a partial write).
async function readAllHistory(oldest) {
  let messages = [], cursor = '';
  for (let page = 0; page < 100; page++) { // hard page cap (safety bound)
    const params = { channel: need('SLACK_CHECKIN_CHANNEL_ID'), oldest: oldest, limit: '200' };
    if (cursor) params.cursor = cursor;
    const history = await slack('conversations.history', params);
    messages = messages.concat(history.messages || []);
    cursor = (history.response_metadata && history.response_metadata.next_cursor) || '';
    if (!history.has_more || !cursor) break;
  }
  return messages;
}

/* One callable run a cron/scheduler invokes. Returns a structured summary and never
 * throws past this boundary for a runtime fault (Slack/Supabase down → logged no-op).
 * It only throws for real MISCONFIG (missing env when not --dry), surfaced by need(). */
async function run(opts) {
  opts = opts || {};
  const dry = opts.dry || DRY; // CLI --dry OR programmatic (CI smoke) — preview, no writes
  const summary = { scanned: 0, parsed: 0, inserted: 0, skipped: 0, deduped: 0, errors: 0, dry: dry };
  const state = readState();

  // Read all pages BEFORE any write, so a Slack fault mid-pagination = clean no-op
  // (no partial insert, cursor unchanged).
  let messages;
  try {
    messages = await readAllHistory(state.last_run_ts);
  } catch (e) {
    log('Slack unreachable — no-op this run: ' + e.message);
    summary.errors++; summary.cursorAdvanced = false; summary.maxTs = state.last_run_ts;
    return summary;
  }

  const msgs = (messages || [])
    .filter(function (m) { return m.type === 'message' && !m.subtype && m.ts > state.last_run_ts; })
    .sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });

  // Cursor advances over leading processed messages; it HALTS at the first errored
  // message so the tail is retried next run (id-dedupe makes the retry safe).
  let maxTs = state.last_run_ts, advancing = true;

  for (const m of msgs) {
    summary.scanned++;
    try {
      const parsed = SI.parseCheckin(m.text || '');
      if (!parsed.isCheckin) {
        log("couldn't read " + m.ts + ' (not a check-in / too sparse) — skipped'); summary.skipped++;
        if (advancing) maxTs = m.ts; continue;
      }
      summary.parsed++;

      const subjectId = await resolveSlackAuthor(m.user);
      if (!subjectId) {
        // FAIL CLOSED: no directory match → drop. Never insert a NULL/placeholder author.
        log('unmapped author ' + m.user + ' @ ' + m.ts + ' — dropped (fail closed)'); summary.skipped++;
        if (advancing) maxTs = m.ts; continue;
      }

      let permalink = '';
      try { permalink = (await slack('chat.getPermalink', { channel: need('SLACK_CHECKIN_CHANNEL_ID'), message_ts: m.ts })).permalink; } catch (e) {}

      const confidence = (env.SLACK_FORM_BOT_USER_ID && m.user === env.SLACK_FORM_BOT_USER_ID) ? 'high' : 'med';
      const events = SI.toEvents(parsed, { subjectId: subjectId, permalink: permalink, ts: m.ts, checkinId: 'chk:' + subjectId + ':' + m.ts, confidence: confidence });

      for (const ev of events) {
        const row = toRow(ev);
        if (dry) { log('DRY would append ' + row.id); summary.inserted++; continue; }
        const res = await supa('POST', '/rest/v1/events', row); // idempotent (id = slack:<dedupeKey>)
        if (res && res.duplicate) summary.deduped++; else summary.inserted++;
      }
      if (advancing) maxTs = m.ts; // advance only after the message fully processed
    } catch (e) {
      log('error on ' + m.ts + ': ' + e.message + ' — left for retry'); summary.errors++;
      advancing = false; // stop the cursor here; retry this + the tail next run
    }
  }

  summary.cursorAdvanced = (!dry && maxTs !== state.last_run_ts);
  if (summary.cursorAdvanced) writeState({ last_run_ts: maxTs }); // DRY never advances the cursor
  summary.maxTs = maxTs;
  log('done — scanned:' + summary.scanned + ' parsed:' + summary.parsed + ' inserted:' + summary.inserted +
      ' skipped:' + summary.skipped + ' deduped:' + summary.deduped + ' errors:' + summary.errors + (dry ? ' [DRY]' : ''));
  return summary;
}

// Export internals for the CI mock (test/verify-slack-job.js); auto-run only when
// invoked directly so requiring the module does NOT kick off a real run.
module.exports = { run: run, toRow: toRow, resolveSlackAuthor: resolveSlackAuthor, SI: SI, readState: readState };

if (require.main === module) {
  // Runtime faults (Slack/Supabase down) are caught inside run() → no-op, exit 0.
  // Only a real misconfig (missing required env when not --dry) rejects here → exit 1.
  run()
    .then(function (summary) { log('summary ' + JSON.stringify(summary)); process.exit(0); })
    .catch(function (e) { log('fatal (misconfig): ' + e.message); process.exit(1); });
}
