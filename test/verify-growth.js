/* WP.db.growth (F1 Phase 2) — the SENSITIVE development record, server-backed under
 * the STRICTER predicate can_see_sensitive (self / DIRECT-manager-only / director),
 * with a bundled SYNTHETIC mock fallback. Mocks WP._sb (no network). Proves:
 *  - fallback paths: signed-out -> mock; server-wins merge; error -> graceful (offline, no throw).
 *  - predicate logic, mirroring supabase/0005 can_see_sensitive in JS the way
 *    verify-people mirrors can_read_person. THE KEY NEW ASSERTION vs Phase 1:
 *    a SKIP-LEVEL manager is DENIED a report's sensitive growth (direct manager only).
 *  - NO sensitive field leaks into the non-sensitive directory payload (WP.db.people). */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: 'https://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = function () {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const errors = [];
for (const s of srcs) { try { new window.Function(fs.readFileSync(path.join(root, s), 'utf8')).call(window); } catch (e) { errors.push('[load ' + s + '] ' + e.message); } }
const WP = window.WP;
if (WP) WP.render = function () {};   // neutralize deferred boot render (this suite is async)
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

const MOCK = JSON.parse(JSON.stringify(WP.data.GROWTH));
function restoreMock() { WP.data.GROWTH = JSON.parse(JSON.stringify(MOCK)); }
function resetDb() { WP.db.status.offline = false; WP.db.status.synced = false; WP.db.status.loading = false; }

// A growth-table row as 0005 stores it (jsonb columns).
function gRow(person_id, over) {
  return Object.assign({
    person_id,
    skills: [{ name: 'srv skill', type: 'hard', level: 3, required: 3, history: [3] }],
    eq: { selfAwareness: 3, selfManagement: 3, socialAwareness: 3, relationshipManagement: 3 },
    manager_note: { strengths: ['srv strength'], growth: ['srv growth'], suggestion: 'srv suggestion' },
    director_note: { impact: 'srv impact', potential: 'High', suggestion: 'srv dir suggestion' },
    quarterly: [{ q: 'Q2 2026', rating: 'Meets', summary: 'srv summary', improved: [], focus: [], reliability: {} }],
    work_style: { stage: 'capable', followUp: false, note: 'srv note' }
  }, over || {});
}

// --- can_see_sensitive mirror (supabase/0005) against a synthetic directory. ----
// THREE-LEVEL chain with accounts at every level so we can prove that a manager who
// DOES have an account is still DENIED a skip-level report (the denial is the
// predicate, not a missing account):
//   m_top (manager, account)  --direct-->  m_mid (account)  --direct-->  m_low (account)
//   => m_top is SKIP-LEVEL to m_low.  dir_x is a director (sees all).  peer_x sees only self.
const DIR = {
  'top@x':  { person_id: 'm_top',  role: 'manager',  manager_email: null },
  'mid@x':  { person_id: 'm_mid',  role: 'employee', manager_email: 'top@x' },
  'low@x':  { person_id: 'm_low',  role: 'employee', manager_email: 'mid@x' },
  'peer@x': { person_id: 'm_peer', role: 'employee', manager_email: 'top@x' },
  'dir@x':  { person_id: 'm_dir',  role: 'director', manager_email: null }
};
function canSeeSensitive(viewerEmail, subjectId) {
  const me = DIR[viewerEmail];
  if (me && me.person_id === subjectId) return true;                         // (a) self
  if (me && (me.role === 'director' || me.role === 'admin')) return true;    // (b) director/admin
  const subj = Object.keys(DIR).map(e => DIR[e]).find(r => r.person_id === subjectId);
  if (subj && subj.manager_email === viewerEmail) return true;               // (c) DIRECT manager only (one hop)
  return false;                                                              // skip-level + peers DENIED
}
function makeScopedSb(rows, viewerEmail) {
  return { from() { return {
    select() {
      const data = rows.filter(r => canSeeSensitive(viewerEmail, r.person_id));
      return { data, error: null, eq(col, val) { return { data: data.filter(r => r[col] === val), error: null }; } };
    }
  }; } };
}
// Non-scoped fake (fallback/merge cases).
function makeFakeSb(rows, opts) {
  opts = opts || {};
  return { from() { return {
    select() { return opts.failSelect ? { data: null, error: { message: 'net' } }
      : { data: rows.slice(), error: null, eq(col, val) { return { data: rows.filter(r => r[col] === val), error: null }; } }; }
  }; } };
}

(async () => {
  try {
    assert(WP.db && WP.db.growth && WP.db.growth.list && WP.db.growth.get, 'WP.db.growth.list + get present');

    // --- A) signed-out (no client): returns the bundled mock, no throw, online.
    restoreMock(); WP._sb = null; resetDb();
    let res = await WP.db.growth.list();
    assert(res === WP.data.GROWTH && Object.keys(res).length === Object.keys(MOCK).length, 'A: signed-out returns the bundled synthetic mock unchanged');
    assert(WP.db.status.offline === false, 'A: not offline when simply signed out');
    assert(WP.data.GROWTH.p_osama && WP.data.GROWTH.p_osama.managerNote, 'A: mock growth record intact when signed out');

    // --- B) server-wins merge: a present server row REPLACES the person's record.
    restoreMock();
    WP._sb = makeFakeSb([ gRow('p_osama', { director_note: { impact: 'SERVER impact', potential: 'High', suggestion: 'srv' } }) ]); resetDb();
    await WP.db.growth.list();
    assert(WP.data.GROWTH.p_osama.directorNote.impact === 'SERVER impact', 'B: server row wins for a person (record replaced)');
    assert(WP.data.GROWTH.p_osama.managerNote.suggestion === 'srv suggestion' && WP.data.GROWTH.p_osama.skills[0].name === 'srv skill', 'B: full sensitive record mapped from snake_case columns');
    assert(WP.data.GROWTH.p_talal && WP.data.GROWTH.p_talal.managerNote, 'B: people NOT in the server response keep their mock record (no clobber)');
    assert(WP.db.status.offline === false && WP.db.status.synced === true, 'B: online + synced after a good read');

    // --- C) error path: select fails -> graceful fallback to mock, offline, no throw.
    restoreMock(); WP._sb = makeFakeSb([], { failSelect: true }); resetDb();
    res = await WP.db.growth.list();
    assert(res === WP.data.GROWTH && Object.keys(res).length === Object.keys(MOCK).length, 'C: failed read falls back to the in-memory growth store (no throw)');
    assert(WP.db.status.offline === true, 'C: status.offline flips on a failed read');
    assert(WP.data.GROWTH.p_osama.managerNote, 'C: mock record intact after a failed read (nothing clobbered)');

    // --- D) PREDICATE LOGIC (the crux). Server holds growth for the synthetic chain.
    function chainRows() { return ['m_top', 'm_mid', 'm_low', 'm_peer', 'm_dir'].map(id => gRow(id, { director_note: { impact: 'TAG ' + id, potential: 'High', suggestion: 's' } })); }
    function seenIds(viewerEmail) {
      // Run list() against a scoped fake, return which synthetic ids got merged.
      restoreMock(); WP.data.GROWTH = {}; WP._sb = makeScopedSb(chainRows(), viewerEmail); resetDb();
      return WP.db.growth.list().then(() => Object.keys(WP.data.GROWTH).sort());
    }

    // D1) SELF -> own only. m_low (a leaf) sees only their own record.
    assert(JSON.stringify(await seenIds('low@x')) === JSON.stringify(['m_low']), 'D1: self (m_low) sees ONLY own growth');

    // D2) DIRECT manager -> own + direct reports. m_mid directly manages m_low.
    assert(JSON.stringify(await seenIds('mid@x')) === JSON.stringify(['m_low', 'm_mid']), 'D2: direct manager (m_mid) sees own + DIRECT report (m_low)');

    // D3) *** THE KEY NEW ASSERTION *** SKIP-LEVEL manager -> DENIED the skip report.
    //     m_top directly manages m_mid and m_peer; m_low reports to m_mid, so m_top is
    //     SKIP-LEVEL to m_low. Despite having an account and managing the chain above,
    //     m_top must NOT see m_low's sensitive growth — direct manager only.
    const topSees = await seenIds('top@x');
    assert(JSON.stringify(topSees) === JSON.stringify(['m_mid', 'm_peer', 'm_top']), 'D3: skip-level manager (m_top) sees own + DIRECT reports (m_mid, m_peer) ONLY');
    assert(topSees.indexOf('m_low') === -1, 'D3: *** skip-level manager (m_top) is DENIED the skip-level report (m_low) growth ***');

    // D4) PEER -> own only. m_peer is a peer of m_mid (both report to m_top); cannot
    //     see m_mid's or m_low's sensitive growth.
    assert(JSON.stringify(await seenIds('peer@x')) === JSON.stringify(['m_peer']), 'D4: peer (m_peer) sees ONLY own growth — denied peers and their reports');

    // D5) DIRECTOR -> all.
    assert((await seenIds('dir@x')).length === 5, 'D5: director (m_dir) sees ALL growth records');

    // D6) get(personId) honours RLS: m_top can get m_mid (direct) but get(m_low) for
    //     m_top returns null (RLS returns no row; no mock present after wipe -> null).
    restoreMock(); WP.data.GROWTH = {}; WP._sb = makeScopedSb(chainRows(), 'top@x'); resetDb();
    const gotMid = await WP.db.growth.get('m_mid');
    const gotLow = await WP.db.growth.get('m_low');
    assert(gotMid && gotMid.directorNote.impact === 'TAG m_mid', 'D6: get() returns a DIRECT report record for the manager');
    assert(gotLow === null, 'D6: get() returns null for a skip-level report (RLS denied, nothing fabricated)');

    // --- E) NO sensitive leak into the non-sensitive directory payload (WP.db.people).
    //         The people row mapping must carry ONLY directory fields — no growth keys.
    const pf = WP.db._personRowToFields({ person_id: 'p_x', name: 'X', name_ar: 'X', title: 't', title_ar: 't', level: 'spec', manager_id: null, employment: 'fulltime', initials: 'X', active: true });
    const SENSITIVE = ['skills', 'eq', 'managerNote', 'manager_note', 'directorNote', 'director_note', 'quarterly', 'workStyle', 'work_style'];
    assert(SENSITIVE.every(k => !(k in pf)), 'E: directory payload (personRowToFields) carries NO sensitive growth field');
    // And the growth row->rec mapping is lossless for the sensitive shape.
    const gr = WP.db._growthRowToRec(gRow('p_x'));
    assert(gr.skills && gr.eq && gr.managerNote && gr.directorNote && gr.quarterly && gr.workStyle, 'E: growthRowToRec maps every sensitive sub-record (snake_case -> app shape)');
  } catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

  if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS — WP.db.growth: signed-out -> mock, server-wins merge, error -> graceful fallback (offline, no throw); stricter can_see_sensitive predicate (self -> own, DIRECT manager -> own+reports, SKIP-LEVEL manager -> DENIED the report, peer -> own, director -> all); get() honours RLS; and NO sensitive field leaks into the directory payload.');
  process.exit(0);
})();
