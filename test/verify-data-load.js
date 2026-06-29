/* Wave-D data loader (tools/data-load.js) — the service-role-only path for real
 * people + growth to reach Supabase. Full loop against a fake source + fake upsert
 * (NO network). Asserts: people+growth upsert shape; bad row skipped+counted (never
 * inserted); --dry writes nothing; idempotent re-run = same intent (no dup); missing
 * env -> non-zero (rejects); runtime fault -> no-op (resolves, exit-0 path); NO secret
 * in output; and a guard that the bundle (src/js/data/**) stays synthetic. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const job = require(path.join(root, 'tools', 'data-load.js'));

const errors = [];
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

// Capture stdout so we can assert no secret is ever logged.
const logged = [];
const realLog = console.log;
console.log = function () { logged.push(Array.prototype.join.call(arguments, ' ')); };

// A fake upsert that records what WOULD be written (no network).
function recorder() {
  const calls = [];
  const fn = async function (table, rows) { calls.push({ table: table, ids: rows.map(r => r.person_id) }); return { ok: true, count: rows.length }; };
  fn.calls = calls;
  return fn;
}

const SOURCE = {
  people: [
    { person_id: 'p_real1', name: 'Real One', nameAr: 'حقيقي', title: 'Manager', titleAr: 'مدير', level: 'manager', managerId: 'p_real2', employment: 'fulltime', initials: 'RO', active: true },
    { id: 'p_real2', name: 'Real Two', name_ar: 'اثنان', title: 'Director', title_ar: 'مدير عام', level: 'director', manager_id: null, initials: 'RT' },   // snake + id alias
    { name: 'No Id Person' }   // BAD: no person_id -> skipped
  ],
  growth: [
    { person_id: 'p_real1', skills: [{ name: 'Ops', level: 4 }], eq: { selfAwareness: 4 }, managerNote: { strengths: ['x'] }, directorNote: { potential: 'High' }, quarterly: [], workStyle: { stage: 'capable' } },
    { skills: [] }   // BAD: no person_id -> skipped
  ]
};

(async () => {
  try {
    assert(job.run && job.toPeopleRow && job.toGrowthRow && job.HOOKS, 'data-load exports run/mappers/HOOKS');

    // --- mapping shape (camel + snake aliases, active default, skip no-id) ------
    const pr = job.toPeopleRow(SOURCE.people[0]);
    assert(pr.person_id === 'p_real1' && pr.name_ar === 'حقيقي' && pr.title_ar === 'مدير' && pr.manager_id === 'p_real2' && pr.active === true, 'toPeopleRow maps camelCase -> snake_case columns');
    const pr2 = job.toPeopleRow(SOURCE.people[1]);
    assert(pr2.person_id === 'p_real2' && pr2.manager_id === null && pr2.employment === 'fulltime' && pr2.active === true, 'toPeopleRow: id alias + null manager + employment default + active default');
    assert(job.toPeopleRow({ name: 'x' }) === null, 'toPeopleRow returns null for a row with no person_id');
    const gr = job.toGrowthRow(SOURCE.growth[0]);
    assert(gr.person_id === 'p_real1' && gr.manager_note && gr.director_note && gr.work_style, 'toGrowthRow maps sensitive sub-records (camel -> snake)');
    assert(job.toGrowthRow({ skills: [] }) === null, 'toGrowthRow returns null for a row with no person_id');

    // --- --dry: full loop, writes NOTHING ---------------------------------------
    let rec = recorder();
    let s = await job.run({ dry: true, records: SOURCE, upsert: rec });
    assert(s.dry === true, 'dry: summary flags dry');
    assert(s.peopleScanned === 3 && s.peopleValid === 2 && s.growthScanned === 2 && s.growthValid === 1, 'dry: scans all, validates the good rows');
    assert(s.skipped === 2 && s.peopleUpserted === 0 && s.growthUpserted === 0, 'dry: 2 bad rows skipped; nothing upserted');
    assert(rec.calls.length === 0, 'dry: the upsert hook is NEVER called');

    // --- real run (injected upsert): correct table + mapped rows ----------------
    rec = recorder();
    s = await job.run({ records: SOURCE, upsert: rec });
    assert(s.peopleUpserted === 2 && s.growthUpserted === 1 && s.skipped === 2 && s.errors === 0, 'run: 2 people + 1 growth upserted, 2 skipped, no errors');
    const pCall = rec.calls.find(c => c.table === 'people');
    const gCall = rec.calls.find(c => c.table === 'growth');
    assert(pCall && JSON.stringify(pCall.ids.sort()) === JSON.stringify(['p_real1', 'p_real2']), 'run: people upsert carries exactly the valid ids');
    assert(gCall && JSON.stringify(gCall.ids) === JSON.stringify(['p_real1']), 'run: growth upsert carries exactly the valid id (bad row excluded)');

    // --- idempotent re-run: same intent, no duplication -------------------------
    const rec2 = recorder();
    const s2 = await job.run({ records: SOURCE, upsert: rec2 });
    const pCall2 = rec2.calls.find(c => c.table === 'people');
    assert(s2.peopleUpserted === 2 && JSON.stringify(pCall2.ids.sort()) === JSON.stringify(['p_real1', 'p_real2']), 'idempotent: a re-run upserts the SAME ids (on_conflict=person_id → no dup intent)');

    // --- missing env -> MISCONFIG -> rejects (non-zero exit) --------------------
    const savedUrl = process.env.SUPABASE_URL, savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    let rejected = false;
    try { await job.run({ records: SOURCE }); } catch (e) { rejected = true; }   // not dry, no injected upsert -> need() throws
    assert(rejected, 'misconfig: a non-dry run with no SUPABASE env REJECTS (entry point would exit non-zero)');

    // --- runtime fault -> no-op (resolves, errors counted, NO throw -> exit 0) --
    const boom = async function () { throw new Error('network down'); };
    process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'SECRET_RoleKey_DO_NOT_LOG_42';
    let threw = false, s3 = null;
    try { s3 = await job.run({ records: SOURCE, upsert: boom }); } catch (e) { threw = true; }
    assert(!threw && s3 && s3.errors > 0, 'runtime fault: run RESOLVES with errors counted (never throws past boundary → exit 0)');

    // --- NO secret in any logged output -----------------------------------------
    assert(logged.join('\n').indexOf('SECRET_RoleKey_DO_NOT_LOG_42') === -1, 'secrets: the service-role key NEVER appears in logged output');
    process.env.SUPABASE_URL = savedUrl; process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;

    // --- GUARD: the loader cannot write into the bundle; bundle stays synthetic --
    const loaderSrc = fs.readFileSync(path.join(root, 'tools', 'data-load.js'), 'utf8');
    // The loader writes NO files at all — it only reads the source and POSTs to the
    // Supabase REST endpoint. So it structurally cannot write into the bundle (or anywhere).
    assert(loaderSrc.indexOf('writeFileSync') === -1 && loaderSrc.indexOf('writeFile(') === -1, 'guard: data-load.js writes NO files — it cannot write into the bundle');
    assert(loaderSrc.indexOf('/rest/v1/') !== -1, 'guard: the loader\'s only write destination is the Supabase REST API (service role)');
    const growthData = fs.readFileSync(path.join(root, 'src', 'js', 'data', 'growth-data.js'), 'utf8');
    assert(/All data mocked/i.test(growthData), 'guard: src/js/data/growth-data.js still self-declares SYNTHETIC ("All data mocked") — not replaced by real values');
  } catch (e) { errors.push('[run] ' + e.message + '\n' + e.stack); }

  console.log = realLog;
  if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS — data-load: people+growth upsert shape correct, bad rows skipped+counted, --dry writes nothing, idempotent re-run = same intent (no dup), missing-env rejects (exit 1), runtime fault no-ops (exit 0), no secret logged, and the bundle stays synthetic.');
  process.exit(0);
})();
