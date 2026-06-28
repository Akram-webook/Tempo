/* Slack ingest JOB (server-side) — CI mock. Run: `node test/verify-slack-job.js`
 * No real network: global.fetch is stubbed to a fake Slack + fake Supabase so we
 * exercise the REAL job logic (parse -> resolve -> toRow -> POST), the fail-closed
 * paths, idempotency, and Slack-down no-op. This closes the untested path that the
 * events.author_email NOT-NULL blocker slipped through. */
const fs = require('fs');
const path = require('path');
const os = require('os');

let failed = 0;
function ok(name, cond) { if (!cond) failed++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); }

// --- env (secrets are fake; state file -> temp so we never touch the repo) ------
const STATE = path.join(os.tmpdir(), 'tempo-ingest-test-state.json');
try { fs.unlinkSync(STATE); } catch (e) {}
process.env.TEMPO_INGEST_STATE        = STATE;
process.env.SLACK_BOT_TOKEN           = 'xoxb-test';
process.env.SLACK_CHECKIN_CHANNEL_ID  = 'C_TEST';
process.env.SUPABASE_URL              = 'https://proj.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';

// --- fixtures: 3 messages — a valid check-in, an unparseable line, an unmapped author
const MESSAGES = [
  { type: 'message', ts: '1782900001.0001', user: 'U_OSAMA',
    text: ['Daily Check-in — Osama — 2026-06-27', 'Done today:', '- issued 40 tickets', 'Blockers / need help:', '- none', 'Tomorrow:', '- ship the cross-sell fix'].join('\n') },
  { type: 'message', ts: '1782900002.0001', user: 'U_OSAMA', text: 'hey team can someone review my PR? thanks' }, // unparseable
  { type: 'message', ts: '1782900003.0001', user: 'U_GHOST',
    text: ['Daily Check-in — Ghost — 2026-06-27', 'Done today:', '- did stuff'].join('\n') }              // unmapped author
];
const USERS = { U_OSAMA: { email: 'o.taher.c@webook.com' }, U_GHOST: { email: 'ghost@nowhere.com' } };

function jsonRes(obj) { return { ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) }; }

function makeFetch(captured, opts) {
  opts = opts || {};
  return async function (url, init) {
    if (opts.slackDown && url.indexOf('/api/conversations.history') !== -1) throw new Error('ENOTFOUND slack.com');
    if (url.indexOf('/api/conversations.history') !== -1) return jsonRes({ ok: true, messages: MESSAGES.slice() });
    if (url.indexOf('/api/users.info') !== -1) {
      const u = new URL(url).searchParams.get('user');
      return jsonRes({ ok: true, user: { profile: USERS[u] || {} } });
    }
    if (url.indexOf('/api/chat.getPermalink') !== -1) return jsonRes({ ok: true, permalink: 'https://slack.com/archives/C_TEST/p1' });
    if (url.indexOf('/rest/v1/directory') !== -1) {
      const dec = decodeURIComponent(url);
      if (dec.indexOf('o.taher.c@webook.com') !== -1) return jsonRes([{ person_id: 'p_osama' }]);
      return jsonRes([]); // unmapped -> fail closed
    }
    if (url.indexOf('/rest/v1/events') !== -1 && init && init.method === 'POST') {
      captured.push({ body: JSON.parse(init.body), prefer: init.headers.Prefer });
      return { ok: true, status: 201, json: async () => null, text: async () => '' };
    }
    return jsonRes({ ok: true });
  };
}

const job = require('../tools/slack-ingest-job.js'); // require.main !== module -> no auto-run

(async () => {
  // --- run 1: normal -------------------------------------------------------
  const cap1 = [];
  global.fetch = makeFetch(cap1);
  await job.run();

  // valid check-in -> 1 delivery (done) + 1 plan (tomorrow); blockers "none" -> 0 risk
  ok('A: emits exactly 2 events for the one mapped check-in', cap1.length === 2);
  ok('B: author_email set to system author (NOT NULL blocker fix)', cap1.every(p => p.body.author_email === 'system:slack-ingest'));
  ok('C: subject resolved via directory (p_osama)', cap1.every(p => p.body.subject_id === 'p_osama'));
  ok('D: source stamped', cap1.every(p => p.body.source === 'slack:#daily-checkin'));
  ok('E: permalink carried as evidence (no fabrication)', cap1.every(p => Array.isArray(p.body.evidence_refs) && p.body.evidence_refs.length === 1));
  ok('F: visibility = managers (gated, not public)', cap1.every(p => p.body.visibility === 'managers'));
  ok('G: categories are delivery + plan', cap1.map(p => p.body.category).sort().join(',') === 'delivery,plan');
  ok('H: insert is idempotent (Prefer ignore-duplicates)', cap1.every(p => /ignore-duplicates/.test(p.prefer || '')));
  ok('I: ids namespaced + deterministic', cap1.every(p => /^slack:1782900001\.0001:(delivery|plan):0$/.test(p.body.id)));
  ok('J: unparseable message produced NO events (skipped)', !cap1.some(p => /review my PR/.test(p.body.description)));
  ok('K: unmapped author dropped — nothing for U_GHOST', cap1.every(p => p.body.subject_id === 'p_osama'));
  ok('L: state advanced to newest ts', job.readState().last_run_ts === '1782900003.0001');

  // --- run 2: idempotency — same input, fresh state -> identical ids --------
  try { fs.unlinkSync(STATE); } catch (e) {}
  const cap2 = [];
  global.fetch = makeFetch(cap2);
  await job.run();
  ok('M: re-run over same messages yields identical event ids', JSON.stringify(cap1.map(p => p.body.id)) === JSON.stringify(cap2.map(p => p.body.id)));

  // --- run 3: Slack unreachable -> no-op, no throw, no state write ----------
  try { fs.unlinkSync(STATE); } catch (e) {}
  const cap3 = [];
  global.fetch = makeFetch(cap3, { slackDown: true });
  let threw = false;
  try { await job.run(); } catch (e) { threw = true; }
  ok('N: Slack unreachable does not throw', !threw);
  ok('O: Slack unreachable emits no events', cap3.length === 0);
  ok('P: Slack unreachable writes no state', !fs.existsSync(STATE));

  try { fs.unlinkSync(STATE); } catch (e) {}
  console.log('\n' + (failed ? failed + ' FAILED' : 'ALL PASS'));
  process.exit(failed ? 1 : 0);
})();
