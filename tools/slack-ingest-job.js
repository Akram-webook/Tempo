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
  if (!res.ok && res.status !== 409) throw new Error('supabase ' + res.status + ' ' + (await res.text()));
  return null;
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

async function run() {
  const state = readState();
  let history;
  try {
    history = await slack('conversations.history', {
      channel: need('SLACK_CHECKIN_CHANNEL_ID'), oldest: state.last_run_ts, limit: '200'
    });
  } catch (e) { log('Slack unreachable — no-op this run: ' + e.message); return; }

  const msgs = (history.messages || []).filter(function (m) { return m.type === 'message' && !m.subtype && m.ts > state.last_run_ts; });
  let maxTs = state.last_run_ts, emitted = 0, skipped = 0, dropped = 0;

  for (const m of msgs.sort(function (a, b) { return a.ts < b.ts ? -1 : 1; })) {
    if (m.ts > maxTs) maxTs = m.ts;
    const parsed = SI.parseCheckin(m.text || '');
    if (!parsed.isCheckin) { log("couldn't read " + m.ts + ' (not a check-in) — skipped'); skipped++; continue; }

    const subjectId = await resolveSlackAuthor(m.user);
    if (!subjectId) { log('unmapped author ' + m.user + ' @ ' + m.ts + ' — dropped (fail closed)'); dropped++; continue; }

    let permalink = '';
    try { permalink = (await slack('chat.getPermalink', { channel: need('SLACK_CHECKIN_CHANNEL_ID'), message_ts: m.ts })).permalink; } catch (e) {}

    const confidence = (env.SLACK_FORM_BOT_USER_ID && m.user === env.SLACK_FORM_BOT_USER_ID) ? 'high' : 'med';
    const events = SI.toEvents(parsed, { subjectId: subjectId, permalink: permalink, ts: m.ts, checkinId: 'chk:' + subjectId + ':' + m.ts, confidence: confidence });

    for (const ev of events) {
      if (DRY) { log('DRY would append ' + JSON.stringify(toRow(ev))); emitted++; continue; }
      await supa('POST', '/rest/v1/events', toRow(ev)); // idempotent (id = slack:<dedupeKey>)
      emitted++;
    }
  }

  if (!DRY) writeState({ last_run_ts: maxTs });
  log('done — events:' + emitted + ' skipped(unreadable):' + skipped + ' dropped(unmapped):' + dropped + (DRY ? ' [DRY]' : ''));
}

// Export internals for the CI mock (test/verify-slack-job.js); auto-run only when
// invoked directly so requiring the module does NOT kick off a real run.
module.exports = { run: run, toRow: toRow, resolveSlackAuthor: resolveSlackAuthor, SI: SI, readState: readState };

if (require.main === module) {
  run().catch(function (e) { log('fatal: ' + e.message); process.exit(1); });
}
