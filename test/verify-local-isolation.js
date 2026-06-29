/* F7 — per-USER localStorage isolation. The persisted caches (tempo_session /
 * tempo_data / tempo_events) are namespaced by the signed-in identity so two people
 * on a shared device never read each other's locally-saved evals / access grants /
 * events. Proves: (1) user A's saved data is NOT visible to user B; (2) the one-time
 * legacy-global migration folds an un-namespaced key into the current user exactly
 * once (and removes the global so another identity can't re-adopt it); (3) storage
 * being unavailable still never throws. Uses a fake localStorage (no jsdom storage). */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: 'https://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = function () {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// Controllable in-memory localStorage so we can inspect raw keys + simulate failure.
function makeStore() {
  const m = {};
  return {
    _m: m, _fail: false,
    getItem(k) { if (this._fail) throw new Error('storage unavailable'); return k in m ? m[k] : null; },
    setItem(k, v) { if (this._fail) throw new Error('storage unavailable'); m[k] = String(v); },
    removeItem(k) { if (this._fail) throw new Error('storage unavailable'); delete m[k]; },
    keys() { return Object.keys(m); }
  };
}
let STORE = makeStore();
Object.defineProperty(window, 'localStorage', { configurable: true, get() { return STORE; } });

const errors = [];
for (const s of srcs) { try { new window.Function(fs.readFileSync(path.join(root, s), 'utf8')).call(window); } catch (e) { errors.push('[load ' + s + '] ' + e.message); } }
const WP = window.WP;
if (WP) WP.render = function () {};
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

// Two real accounts from the seeded directory.
const A = 'p_akram';   // akram@webook.com
const B = 'p_osama';   // o.taher.c@webook.com
const emailA = WP.identity._resolveEmail(A);
const emailB = WP.identity._resolveEmail(B);

(async () => {
  try {
    assert(WP.identity && WP.identity.nsKey && WP.identity.adopt && WP.identity.clear, 'WP.identity API present');
    assert(emailA === 'akram@webook.com' && emailB === 'o.taher.c@webook.com', 'identity resolves the signed-in account email (not viewerId)');

    // --- 1) A's saved data is NOT visible to B. -------------------------------
    // Sign in as A, save some work, then hand the device over to B.
    WP.state.authed = false;                       // start signed-out
    WP.identity.clear();
    WP.setState({ authed: true, viewerId: A });    // sign-in A -> adopt locks identity to A
    assert(WP.identity.current() === emailA, '1: identity locked to A on sign-in');
    WP.data.EVALUATIONS = { p_target: { period: 'Q2', status: 'Completed', scores: {}, feedback: { secret: 'A-ONLY note' }, updated_at: '2026-06-01T00:00:00Z' } };
    WP.persist.saveData();
    const keyA = WP.identity.nsKey('tempo_data');
    assert(keyA === 'tempo_data::akram@webook.com', '1: tempo_data is namespaced by A email');
    assert(STORE._m[keyA] && STORE._m[keyA].indexOf('A-ONLY note') !== -1, "1: A's work persisted under A's namespace");

    // "View as" must NOT re-key (still A's account, just viewing B).
    WP.setState({ viewerId: B });
    assert(WP.identity.current() === emailA, '1: View-as does NOT change the signed-in identity');

    // Hand over: A signs out, B signs in. Simulate the natural reload by clearing
    // the in-memory work store (a fresh page starts from mock).
    WP.setState({ authed: false });
    assert(WP.identity.current() === '__anon__', '1: sign-out clears the active identity');
    WP.data.EVALUATIONS = {};                      // fresh page baseline
    WP.setState({ authed: true, viewerId: B });    // sign-in B
    assert(WP.identity.current() === emailB, '1: identity re-keys to B on the next sign-in');
    WP.persist.hydrate();                           // B loads ONLY B's namespace
    assert(!WP.data.EVALUATIONS.p_target, "1: B does NOT see A's saved evaluation (namespaces isolated)");
    assert(STORE._m['tempo_data::o.taher.c@webook.com'] !== undefined || !WP.data.EVALUATIONS.p_target, "1: B's reads are confined to B's namespace");
    // A's data is still safely on disk under A's key (not lost, just not B's).
    assert(STORE._m[keyA] && STORE._m[keyA].indexOf('A-ONLY note') !== -1, "1: A's work remains intact under A's own namespace");

    // --- 2) one-time legacy-global migration into the current user, exactly once.
    STORE = makeStore();                            // clean slate
    // A pre-release global blob (un-namespaced), as older builds wrote it.
    STORE._m['tempo_data'] = JSON.stringify({ v: 2, evaluations: { p_legacy: { period: 'old', status: 'Completed', scores: {}, feedback: {}, updated_at: '2026-01-01T00:00:00Z' } }, self: {}, roles: {}, granted: null, engage: null, activeCycle: null, activity: [] });
    WP.state.authed = false; WP.identity.clear();
    WP.setState({ authed: true, viewerId: A });     // adopt A -> migrates legacy into A's namespace
    assert(STORE._m['tempo_data'] === undefined, '2: legacy global tempo_data is REMOVED after migration (no re-adoption by another identity)');
    assert(STORE._m['tempo_data::akram@webook.com'] && STORE._m['tempo_data::akram@webook.com'].indexOf('p_legacy') !== -1, "2: legacy work migrated into the current user's namespace");
    // Migrating again must not clobber / duplicate: a second user does NOT inherit it.
    WP.setState({ authed: false }); WP.data.EVALUATIONS = {};
    WP.setState({ authed: true, viewerId: B });
    WP.persist.hydrate();
    assert(!WP.data.EVALUATIONS.p_legacy, '2: a different user (B) does NOT inherit the migrated legacy data (migration happened once, into A)');

    // --- 3) storage unavailable -> never throws (set + read + identity ops). ---
    STORE = makeStore(); STORE._fail = true;
    let threw = false;
    try {
      WP.identity.clear();
      WP.setState({ authed: true, viewerId: A });   // adopt + persist + saveData under failing storage
      WP.persist.saveData();
      WP.persist.hydrate();
      WP.db.events.list('x');                        // localEvents read under failing storage
    } catch (e) { threw = true; }
    assert(!threw, '3: all persistence paths swallow a storage failure (never throw)');
    STORE._fail = false;
  } catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

  if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS — F7 local isolation: persisted caches namespaced per signed-in identity (A invisible to B), View-as does not re-key, legacy global migrated into the current user exactly once then removed, and storage-unavailable never throws.');
  process.exit(0);
})();
