/* Slack ingest JOB (server-side, F-034) — CI smoke test. Run: `node test/verify-slack-job.js`
 * No real network: global.fetch is stubbed to a FAKE Slack (paginated) + FAKE Supabase
 * (id-keyed store, 409 on duplicate id) so we exercise the REAL run loop end-to-end and
 * assert each production property:
 *   1 cursor advances across a paginated fetch
 *   2 idempotent re-run on the same messages = zero new inserts (dedupe by id)
 *   3 unparseable / sparse message → skipped + counted, never inserted
 *   4 unmapped author → dropped fail-closed, never a NULL/placeholder author leak
 *   5 Slack unreachable → no-op, no partial write, cursor unchanged
 *   6 a well-formed check-in → exactly the expected events with id='slack:'+dedupeKey
 * Plus a --dry pass: full loop runs, nothing written, cursor frozen. */
const fs = require('fs');
const path = require('path');
const os = require('os');

let failed = 0;
function ok(name, cond) { if (!cond) failed++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); }

// --- env (secrets are fake; state file -> temp so we never touch the repo) ------
const STATE = path.join(os.tmpdir(), 'tempo-ingest-test-state.json');
function resetState() { try { fs.unlinkSync(STATE); } catch (e) {} }
resetState();
process.env.TEMPO_INGEST_STATE        = STATE;
process.env.SLACK_BOT_TOKEN           = 'xoxb-test';
process.env.SLACK_CHECKIN_CHANNEL_ID  = 'C_TEST';
process.env.SUPABASE_URL              = 'https://proj.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';

// --- fixtures: a valid check-in (with a count), an unparseable line, an unmapped author.
// Spread across TWO history pages to exercise pagination + cursor advance.
const PAGE1 = [
  { type: 'message', ts: '1782900001.0001', user: 'U_OSAMA',
    text: ['Daily Check-in — Osama — 2026-06-27', 'Done today:', '- issued 40 tickets', 'Blockers / need help:', '- power supply risk', 'Tomorrow:', '- ship the cross-sell fix'].join('\n') },
  { type: 'message', ts: '1782900002.0001', user: 'U_OSAMA', text: 'hey team can someone review my PR? thanks' } // unparseable
];
const PAGE2 = [
  { type: 'message', ts: '1782900003.0001', user: 'U_GHOST',
    text: ['Daily Check-in — Ghost — 2026-06-27', 'Done today:', '- did stuff'].join('\n') } // unmapped author
];
const USERS = { U_OSAMA: { email: 'o.taher.c@webook.com' }, U_GHOST: { email: 'ghost@nowhere.com' } };

function jsonRes(obj, status) { return { ok: (status || 200) < 400, status: status || 200, json: async () => obj, text: async () => JSON.stringify(obj) }; }

// FAKE Supabase: an id-keyed store. POST of a known id → 409 (PK conflict = dedupe);
// new id → 201 and stored. GET /directory resolves the email→person_id mapping.
function makeFetch(db, opts) {
  opts = opts || {};
  return async function (url, init) {
    if (url.indexOf('/api/conversations.history') !== -1) {
      if (opts.slackDown) throw new Error('ENOTFOUND slack.com');
      const cursor = new URL(url).searchParams.get('cursor');
      if (!cursor) return jsonRes({ ok: true, messages: PAGE1.slice(), has_more: true, response_metadata: { next_cursor: 'CUR2' } });
      return jsonRes({ ok: true, messages: PAGE2.slice(), has_more: false, response_metadata: { next_cursor: '' } });
    }
    if (url.indexOf('/api/users.info') !== -1) {
      const u = new URL(url).searchParams.get('user');
      return jsonRes({ ok: true, user: { profile: USERS[u] || {} } });
    }
    if (url.indexOf('/api/chat.getPermalink') !== -1) return jsonRes({ ok: true, permalink: 'https://slack.com/archives/C_TEST/p1' });
    if (url.indexOf('/rest/v1/directory') !== -1) {
      const dec = decodeURIComponent(url);
      if (dec.indexOf('o.taher.c@webook.com') !== -1) return jsonRes([{ person_id: 'p_osama' }]);
      return jsonRes([]); // unmapped → fail closed
    }
    if (url.indexOf('/rest/v1/events') !== -1 && init && init.method === 'POST') {
      const row = JSON.parse(init.body);
      if (db.has(row.id)) return jsonRes({}, 409); // PK conflict → dedupe
      db.set(row.id, row);
      return jsonRes(null, 201);
    }
    return jsonRes({ ok: true });
  };
}

const job = require('../tools/slack-ingest-job.js'); // require.main !== module → no auto-run

(async () => {
  // ===== run 1: normal, two pages =========================================
  resetState();
  const db1 = new Map();
  global.fetch = makeFetch(db1);
  const s1 = await job.run();

  const rows = [...db1.values()];
  // (6) well-formed check-in → Done→delivery(+count), Blockers→risk, Tomorrow→plan
  ok('6a: one mapped check-in produced exactly 3 events', rows.length === 3);
  ok('6b: categories are delivery + plan + risk', rows.map(r => r.category).sort().join(',') === 'delivery,plan,risk');
  ok('6c: delivery row carries the parsed count (40 tickets)', rows.some(r => r.category === 'delivery' && r.related && r.related.metrics && r.related.metrics[0] && r.related.metrics[0].n === 40));
  ok('6d: ids are namespaced + deterministic (slack:<dedupeKey>)', rows.every(r => /^slack:1782900001\.0001:(delivery|risk|plan):0$/.test(r.id)));
  ok('6e: subject resolved via directory (p_osama)', rows.every(r => r.subject_id === 'p_osama'));
  ok('6f: source stamped + visibility gated to managers', rows.every(r => r.source === 'slack:#daily-checkin' && r.visibility === 'managers'));

  // (4) unmapped author dropped — NO ghost/placeholder/NULL author row ever inserted
  ok('4a: every inserted row has the system author (no NULL/placeholder)', rows.every(r => r.author_email === 'system:slack-ingest'));
  ok('4b: nothing inserted for the unmapped (ghost) author', rows.every(r => r.subject_id === 'p_osama'));

  // (3) unparseable/sparse → counted as skipped, never inserted
  ok('3a: unparseable message counted in skipped', s1.skipped >= 1);
  ok('3b: unparseable message produced no row', !rows.some(r => /review my PR/.test(r.description || '')));

  // (1) cursor advanced across the paginated fetch to the newest ts
  ok('1a: summary reports cursor advanced', s1.cursorAdvanced === true);
  ok('1b: state cursor is the newest scanned ts (across both pages)', job.readState().last_run_ts === '1782900003.0001');

  // structured summary shape
  ok('S: summary has the documented fields', ['scanned', 'parsed', 'inserted', 'skipped', 'deduped', 'errors'].every(k => k in s1));
  ok('S2: scanned counts every in-window message (3)', s1.scanned === 3);
  ok('S3: inserted = 3, errors = 0', s1.inserted === 3 && s1.errors === 0);

  // ===== run 2: idempotent re-run, SAME cursor kept =======================
  const before = db1.size;
  global.fetch = makeFetch(db1); // same db, state NOT reset → cursor past all messages
  const s2 = await job.run();
  ok('2a: re-run with advanced cursor scans nothing new', s2.scanned === 0 && s2.inserted === 0);
  ok('2b: DB row count unchanged after re-run', db1.size === before);

  // ===== run 2b: idempotency via ID dedupe (cursor reset) =================
  resetState();
  global.fetch = makeFetch(db1); // same db, but cursor reset → re-sees all messages
  const s2b = await job.run();
  ok('2c: cursor-reset re-run inserts ZERO new rows (id dedupe)', db1.size === before);
  ok('2d: deduped events are counted, not inserted', s2b.deduped === 3 && s2b.inserted === 0);

  // ===== run 3: Slack unreachable → no-op =================================
  resetState();
  const db3 = new Map();
  global.fetch = makeFetch(db3, { slackDown: true });
  let threw = false, s3;
  try { s3 = await job.run(); } catch (e) { threw = true; }
  ok('5a: Slack unreachable does not throw past the boundary', !threw);
  ok('5b: Slack unreachable wrote no rows (no partial write)', db3.size === 0);
  ok('5c: Slack unreachable left the cursor unchanged', !fs.existsSync(STATE) && s3.cursorAdvanced === false);

  // ===== run 4: --dry smoke — full loop, NOTHING written, cursor frozen ===
  resetState();
  const db4 = new Map();
  global.fetch = makeFetch(db4);
  const s4 = await job.run({ dry: true });
  ok('D1: dry run exercises the full loop (would insert 3)', s4.inserted === 3);
  ok('D2: dry run POSTs nothing to Supabase', db4.size === 0);
  ok('D3: dry run advances no cursor (no state file)', !fs.existsSync(STATE) && s4.cursorAdvanced === false);
  ok('D4: dry run reports its mode honestly', s4.dry === true);

  resetState();
  console.log('\n' + (failed ? failed + ' FAILED' : 'ALL PASS'));
  process.exit(failed ? 1 : 0);
})();
