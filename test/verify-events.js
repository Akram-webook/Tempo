/* Evidence/Decision events (Intelligence Layer P1). Gate: INTELLIGENCE-ETHICS.md.
 * Tests: append-only store (no edit/delete of the past), NO fabrication (every
 * derived event carries a source), access gate (a peer can't see another's
 * timeline), filter correctness, and the empty state. Backend mocked (no network). */
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
if (WP) WP.render = function () {};   // async suite — neutralize deferred boot render
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

function fakeSb(server) {
  return { from() { return {
    select() { return { data: server.slice(), error: null, eq(col, val) { return { data: server.filter(r => r[col] === val), error: null }; } }; },
    insert(row) { server.push(row); return { error: null }; }
  }; } };
}

(async () => {
  try {
    assert(WP.events && WP.events.derive && WP.events.query && WP.events.filter, 'WP.events API present');
    assert(WP.db && WP.db.events && WP.db.events.append && WP.db.events.list, 'WP.db.events API present');

    // --- append-only: there is intentionally NO edit/remove of past events ---
    assert(typeof WP.db.events.remove === 'undefined' && typeof WP.db.events.update === 'undefined' && typeof WP.db.events.delete === 'undefined',
      'append-only: no remove/update/delete on WP.db.events');

    // --- NO fabrication: every derived event carries a real source ---
    const someone = WP.data.PEOPLE.find(p => (p.assignedEvents || []).length > 0) || WP.data.PEOPLE[0];
    const derived = WP.events.derive(someone.id, '2026-06-27');
    assert(derived.length > 0, 'derive: produces events for a person with real signals');
    assert(derived.every(e => e.source && e.subjectId === someone.id), 'no-fabrication: every derived event has a source + subject');
    assert(derived.every(e => WP.events.CATEGORIES.indexOf(e.category) !== -1), 'derive: categories are from the known set');

    // --- empty state: a person with no signals yields nothing (honest, not invented) ---
    const empty = WP.data.PEOPLE.find(p => (p.assignedEvents || []).length === 0 && p.level === 'director' && !(WP.engage.snapshot()[p.id]) && !(WP.data.EVALUATIONS[p.id]));
    if (empty) assert(WP.events.derive(empty.id, '2026-06-27').length === 0, 'empty: no fabricated events when there are no signals (' + empty.id + ')');

    // --- filter correctness (category + quarter) ---
    const sample = [
      { id: 'a', ts: '2026-02-10T00:00:00Z', category: 'workload', source: 's', subjectId: 'x' },
      { id: 'b', ts: '2026-05-10T00:00:00Z', category: 'evaluation', source: 's', subjectId: 'x' }
    ];
    assert(WP.events.quarterOf('2026-02-10T00:00:00Z') === 'Q1-2026', 'quarterOf computes Q1');
    assert(WP.events.filter(sample, { category: 'workload' }).length === 1, 'filter by category');
    assert(WP.events.filter(sample, { quarter: 'Q2-2026' }).length === 1, 'filter by quarter');
    assert(WP.events.filter(sample, { category: 'all', quarter: 'all' }).length === 2, 'filter all = passthrough');

    // --- ACCESS GATE: a peer can never see another person's timeline ---
    const spec = WP.data.PEOPLE.find(p => p.level === 'spec' && !p.tbc);
    const peer = WP.data.PEOPLE.find(p => p.id !== spec.id && p.managerId === spec.managerId) || WP.data.PEOPLE.find(p => p.id !== spec.id);
    assert(WP.access.canSeeSensitive(spec, peer.id) === false, 'gate: a peer cannot see another peer’s evidence timeline');
    assert(WP.access.canSeeSensitive(spec, spec.id) === true, 'gate: subject can see their OWN timeline');
    const mgr = WP.access.byId(spec.managerId);
    if (mgr) assert(WP.access.canSeeSensitive(mgr, spec.id) === true, 'gate: a direct manager can see their report’s timeline');

    // --- store: localStorage fallback (no client) append + list, append-only idempotent ---
    WP._sb = null; try { window.localStorage.removeItem(WP.db.events._localKey()); } catch (e) {}
    let r = await WP.db.events.append({ id: 'ap_1', ts: '2026-06-01T00:00:00Z', type: 'decision', subjectId: 'x', category: 'decision', description: 'd', source: 'Activity log' });
    assert(r.ok && r.local, 'store(local): append persists locally');
    let listed = await WP.db.events.list('x');
    assert(listed.length === 1 && listed[0].id === 'ap_1', 'store(local): list returns the appended event');
    r = await WP.db.events.append({ id: 'ap_1', ts: '2026-06-01T00:00:00Z', subjectId: 'x', category: 'decision', description: 'dup', source: 's' });
    assert(r.dedup === true && (await WP.db.events.list('x')).length === 1, 'store: append is idempotent by id (no duplicate)');

    // --- store: backend path (mocked) ---
    const server = [];
    WP._sb = fakeSb(server);
    r = await WP.db.events.append({ id: 'ap_2', ts: '2026-06-02T00:00:00Z', type: 'evidence', subjectId: 'y', category: 'workload', description: 'w', source: 'Capacity engine' });
    assert(r.ok && !r.offline && server.length === 1 && server[0].subject_id === 'y', 'store(backend): append inserts a row with mapped columns');
    const backList = await WP.db.events.list('y');
    assert(backList.length === 1 && backList[0].id === 'ap_2' && backList[0].source === 'Capacity engine', 'store(backend): list reads + maps rows back');
  } catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

  if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS — events: append-only store (no edit/delete), no fabrication (every event sourced), peer access gate, filters, and empty state.');
  process.exit(0);
})();
