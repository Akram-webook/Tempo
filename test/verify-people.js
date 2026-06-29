/* WP.db.people (F1 Phase 1) — org directory server-backed under RLS, with a
 * bundled-mock fallback. Mocks WP._sb (no network). Proves the four paths the PR
 * promised: signed-out -> mock; server -> server-wins merge (directory fields only,
 * operational fields preserved); error -> graceful fallback, offline flips, NO throw;
 * and role-scoped reads (peer / manager / director) return only the rows RLS allows,
 * mirroring supabase/0004 `using (public.can_read_person(person_id))`. */
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

// Snapshot the bundled mock directory so we can restore it between cases.
const MOCK = JSON.parse(JSON.stringify(WP.data.PEOPLE));
function restoreMock() { WP.data.PEOPLE = JSON.parse(JSON.stringify(MOCK)); }
function byId(id) { return WP.data.PEOPLE.find(p => p.id === id); }
function resetDb() { WP.db.status.offline = false; WP.db.status.synced = false; WP.db.status.loading = false; }

// A people-table row as 0004 stores it (snake_case, non-sensitive fields only).
function row(person_id, over) {
  return Object.assign({ person_id, name: 'srv ' + person_id, name_ar: 'srv-ar', title: 'srv title',
    title_ar: 'srv-ar-title', level: 'spec', manager_id: null, employment: 'fulltime', initials: 'SR', active: true }, over || {});
}

// Fake supabase client: select() returns the given people rows (optionally failing).
function makeFakeSb(rows, opts) {
  opts = opts || {};
  return { from() { return {
    select() { return opts.failSelect ? { data: null, error: { message: 'net' } } : { data: rows.slice(), error: null }; }
  }; } };
}

// Role-scoped fake: select() returns only rows the viewer may read, applying the
// SAME predicate as supabase/0003 can_read_person against a tiny directory fixture.
const DIR = {
  'akram@webook.com':         { person_id: 'p_akram',       role: 'admin',    manager_email: null },
  'ahmed.othman@webook.com':  { person_id: 'p_ahmed',       role: 'director', manager_email: null },
  'maksousa@webook.com':      { person_id: 'p_abdulrahman', role: 'employee', manager_email: null },
  'meshal@webook.com':        { person_id: 'p_meshalB',     role: 'employee', manager_email: null },
  'o.taher.c@webook.com':     { person_id: 'p_osama',       role: 'employee', manager_email: 'akram@webook.com' },
  'm.ali.c@webook.com':       { person_id: 'p_gamal',       role: 'employee', manager_email: 'akram@webook.com' },
  'talal.samir.c@webook.com': { person_id: 'p_talal',       role: 'employee', manager_email: 'maksousa@webook.com' }
};
function canReadPerson(viewerEmail, subjectId) {
  const me = DIR[viewerEmail];
  if (me && me.person_id === subjectId) return true;
  if (me && (me.role === 'director' || me.role === 'admin')) return true;
  const subj = Object.keys(DIR).map(e => DIR[e]).find(r => r.person_id === subjectId);
  if (subj && subj.manager_email === viewerEmail) return true;
  return false;
}
function makeScopedSb(rows, viewerEmail) {
  return { from() { return {
    select() { return { data: rows.filter(r => canReadPerson(viewerEmail, r.person_id)), error: null }; }
  }; } };
}

(async () => {
  try {
    assert(WP.db && WP.db.people && WP.db.people.list, 'WP.db.people.list present');

    // --- A) signed-out (no client): returns the bundled mock, no throw, online.
    restoreMock(); WP._sb = null; resetDb();
    let res = await WP.db.people.list();
    assert(res === WP.data.PEOPLE && res.length === MOCK.length, 'A: signed-out returns the bundled mock directory unchanged');
    assert(WP.db.status.offline === false, 'A: not offline when simply signed out (no client)');
    assert(byId('p_akram').name === 'Mohammed Akram', 'A: mock fields intact when signed out');

    // --- B) server-wins merge: directory fields update; operational fields kept.
    restoreMock();
    const akramBefore = byId('p_akram');
    const photoBefore = akramBefore.photo, checkinBefore = akramBefore.dailyCheckin, eventsBefore = akramBefore.assignedEvents;
    WP._sb = makeFakeSb([ row('p_akram', { name: 'Mohammed Akram (server)', title: 'Promoted Title', level: 'sr_manager', manager_id: 'p_motaa', initials: 'MA' }) ]);
    resetDb();
    res = await WP.db.people.list();
    const akramAfter = byId('p_akram');
    assert(akramAfter.name === 'Mohammed Akram (server)' && akramAfter.title === 'Promoted Title' && akramAfter.level === 'sr_manager', 'B: server wins for directory fields (name/title/level)');
    assert(akramAfter.photo === photoBefore && akramAfter.dailyCheckin === checkinBefore && akramAfter.assignedEvents === eventsBefore, 'B: operational fields (photo/dailyCheckin/assignedEvents) preserved from mock');
    assert(res.length === MOCK.length, 'B: no duplicate person created for an existing id');
    assert(WP.db.status.offline === false && WP.db.status.synced === true, 'B: online + synced after a good server read');

    // --- B2) a server row for an unseen id is appended as a minimal person.
    restoreMock();
    WP._sb = makeFakeSb([ row('p_new_hire', { name: 'New Hire', level: 'spec', manager_id: 'p_akram', initials: 'NH' }) ]);
    resetDb();
    await WP.db.people.list();
    const nh = byId('p_new_hire');
    assert(nh && nh.name === 'New Hire' && nh.managerId === 'p_akram' && Array.isArray(nh.assignedEvents) && nh.dailyCheckin === null, 'B2: unseen server person appended with safe operational defaults');

    // --- B3) active:false marks the person tbc (inactive seat); active:true clears it.
    restoreMock();
    WP._sb = makeFakeSb([ row('p_akram', { active: false }) ]); resetDb();
    await WP.db.people.list();
    assert(byId('p_akram').tbc === true, 'B3: active=false flags the person tbc');
    restoreMock();
    WP._sb = makeFakeSb([ row('p_tbc_sports', { active: true }) ]); resetDb();
    await WP.db.people.list();
    assert(!byId('p_tbc_sports').tbc, 'B3: active=true clears a previously-tbc seat');

    // --- C) error path: select fails -> graceful fallback to mock, offline flips, no throw.
    restoreMock();
    WP._sb = makeFakeSb([], { failSelect: true }); resetDb();
    res = await WP.db.people.list();
    assert(res === WP.data.PEOPLE && res.length === MOCK.length, 'C: failed read falls back to the in-memory directory (no throw)');
    assert(WP.db.status.offline === true, 'C: status.offline flips on a failed read');
    assert(byId('p_akram').name === 'Mohammed Akram', 'C: mock fields intact after a failed read (nothing clobbered)');

    // --- D) role-scoped reads. Server holds rows for these five subjects; the merge
    //         only sees the rows RLS returns for the given viewer.
    function scopedRows() {
      return [ row('p_abdulrahman'), row('p_talal'), row('p_osama'), row('p_gamal'), row('p_meshalB') ];
    }
    function tag(rows) { return rows.map(r => Object.assign(r, { name: 'SCOPED ' + r.person_id })); }
    function mergedScoped() { return scopedRows().map(r => r.person_id).filter(id => byId(id) && byId(id).name === 'SCOPED ' + id); }

    // D1) PEER (meshal): no relationship to the others; sees ONLY own row.
    restoreMock(); WP._sb = makeScopedSb(tag(scopedRows()), 'meshal@webook.com'); resetDb();
    await WP.db.people.list();
    assert(JSON.stringify(mergedScoped().sort()) === JSON.stringify(['p_meshalB']), 'D1: peer (meshal) merges ONLY own row — no peers');

    // D2) MANAGER (maksousa / p_abdulrahman): own + direct report (talal) only —
    //      NOT osama/gamal (akram's reports) nor meshal (peer). Uses a plain-manager
    //      account so the role-scoped (not director) path is exercised.
    restoreMock(); WP._sb = makeScopedSb(tag(scopedRows()), 'maksousa@webook.com'); resetDb();
    await WP.db.people.list();
    assert(JSON.stringify(mergedScoped().sort()) === JSON.stringify(['p_abdulrahman', 'p_talal']), 'D2: manager (maksousa) merges own + direct report (talal) only');

    // D3) DIRECTOR (ahmed): sees every subject row.
    restoreMock(); WP._sb = makeScopedSb(tag(scopedRows()), 'ahmed.othman@webook.com'); resetDb();
    await WP.db.people.list();
    assert(mergedScoped().length === 5, 'D3: director (ahmed) merges ALL subject rows');

    // --- E) row->fields mapping is lossless for the Phase-1 (non-sensitive) columns.
    const f = WP.db._personRowToFields(row('p_x', { manager_id: 'p_y', employment: 'freelance', active: false }));
    assert(f.id === 'p_x' && f.managerId === 'p_y' && f.employment === 'freelance' && f.tbc === true && f.active === false, 'E: personRowToFields maps snake_case -> app shape (incl. active->tbc)');
  } catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

  if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS — WP.db.people: signed-out -> mock, server-wins merge (directory fields only, operational preserved), unseen-id append, error -> graceful fallback (offline, no throw), and role-scoped reads (peer -> own, manager -> own+reports, director -> all).');
  process.exit(0);
})();
