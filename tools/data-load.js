/* ============================================================
 * Tempo — Real data loader (Wave D go-live tooling)
 * SPEC: docs/WAVE-D-runbook.md · GATE: ai-os/00-governance/INTELLIGENCE-ETHICS.md
 * ------------------------------------------------------------
 * The ONE sanctioned path for real directory/people + growth values to reach the
 * database. It UPSERTS into public.people (0004, non-sensitive) and public.growth
 * (0005, the most sensitive data in the product) using the Supabase SERVICE ROLE
 * key, which bypasses RLS for the write — the only write path those tables have,
 * because by design they carry NO client insert/update/delete policy.
 *
 * >>> ETHICS / SECURITY GUARD — READ THIS <<<
 *  - Real people/growth VALUES must NEVER be placed in src/js/data/** (the front-end
 *    bundle) or any client path. The bundled mock stays SYNTHETIC. Real values live
 *    ONLY in the operator's source file (NOT committed) and, after this loader runs,
 *    in Supabase behind RLS (can_read_person / can_see_sensitive). This tooling is
 *    server-side only — build.js never bundles tools/**, so it never reaches a browser.
 *  - Secrets come from the ENVIRONMENT only (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 *    they are never committed and never logged.
 *
 * Contract (mirrors tools/slack-ingest-job.js):
 *  - env-only secrets; never throws past the boundary for a RUNTIME fault (network /
 *    bad source file) — it logs a no-op and exits 0. Only a real MISCONFIG (missing
 *    required env / missing source path when not --dry) exits non-zero.
 *  - idempotent: upsert on person_id (Prefer: resolution=merge-duplicates), so a
 *    re-run updates the same rows and never duplicates.
 *  - validates each row; a bad row (no person_id) is skipped + counted, never inserted,
 *    never partially corrupts the batch.
 *  - --dry: full loop against the source + a no-op upsert, prints what WOULD upsert,
 *    writes nothing.
 *
 * Run: node tools/data-load.js --source ./real-people-growth.json   (--dry to preview)
 *   source JSON shape: { "people": [ {person_id, name, name_ar, title, title_ar,
 *     level, manager_id, employment, initials, active}... ],
 *     "growth": [ {person_id, skills, eq, manager_note, director_note, quarterly,
 *     work_style}... ] }   (camelCase aliases like nameAr / managerId / managerNote
 *     are accepted). A flat .csv is accepted for people only (see runbook).
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const env = process.env;

const DRY = process.argv.includes('--dry');
function argVal(flag) { var i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; }

function log(msg) { console.log('[data-load] ' + msg); }
function need(k) { var v = env[k]; if (!v && !DRY) throw new Error('missing env ' + k); return v || ''; }

// --- column whitelists (DB-native, snake_case) ---------------------------------
function first() { for (var i = 0; i < arguments.length; i++) { if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i]; } return undefined; }
function idOf(rec) { var id = first(rec && rec.person_id, rec && rec.id); return (id != null && String(id).trim() !== '') ? String(id) : null; }

// Map an input record -> public.people row (non-sensitive directory fields only).
// Returns null for an invalid row (no person_id) so callers skip + count it.
function toPeopleRow(rec) {
  if (!rec || typeof rec !== 'object') return null;
  var id = idOf(rec); if (!id) return null;
  return {
    person_id: id,
    name: first(rec.name) || null,
    name_ar: first(rec.name_ar, rec.nameAr) || null,
    title: first(rec.title) || null,
    title_ar: first(rec.title_ar, rec.titleAr) || null,
    level: first(rec.level) || null,
    manager_id: (function () { var m = first(rec.manager_id, rec.managerId); return m === undefined ? null : m; })(),
    employment: first(rec.employment) || 'fulltime',
    initials: first(rec.initials) || null,
    active: rec.active === false ? false : true
  };
}

// Map an input record -> public.growth row (sensitive jsonb sub-records).
function toGrowthRow(rec) {
  if (!rec || typeof rec !== 'object') return null;
  var id = idOf(rec); if (!id) return null;
  return {
    person_id: id,
    skills: first(rec.skills, null),
    eq: first(rec.eq, null),
    manager_note: first(rec.manager_note, rec.managerNote, null),
    director_note: first(rec.director_note, rec.directorNote, null),
    quarterly: first(rec.quarterly, null),
    work_style: first(rec.work_style, rec.workStyle, null)
  };
}

// --- source reading (JSON canonical; minimal CSV for a flat people table) ------
// ponytail: split-on-comma CSV — handles a plain flat people table only (no quoted
// commas, no embedded newlines, no growth nesting). JSON is the canonical source and
// covers everything; upgrade path if a messy CSV ever appears = swap this one function
// for a real parser (e.g. csv-parse) — callers are unaffected.
function parseCsvPeople(text) {
  var lines = String(text).split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
  if (!lines.length) return [];
  var cols = lines[0].split(',').map(function (c) { return c.trim(); });
  return lines.slice(1).map(function (line) {
    var cells = line.split(',');
    var rec = {};
    cols.forEach(function (c, i) { rec[c] = (cells[i] !== undefined ? cells[i].trim() : ''); });
    return rec;
  });
}
// Resolve the source into { people:[], growth:[] }. Throws on a missing path
// (MISCONFIG) only when called for it; a read/parse error throws too (the caller
// treats THAT as a runtime fault → no-op).
function readSourceFile(p) {
  if (!p) throw new Error('missing source: set TEMPO_DATALOAD_SOURCE or pass --source <path>');
  var text = fs.readFileSync(p, 'utf8');
  if (/\.csv$/i.test(p)) return { people: parseCsvPeople(text), growth: [] };
  var obj = JSON.parse(text);
  return { people: Array.isArray(obj.people) ? obj.people : [], growth: Array.isArray(obj.growth) ? obj.growth : [] };
}

// --- the service-role upsert (the ONLY sanctioned write path) ------------------
async function supaUpsert(table, rows) {
  var url = need('SUPABASE_URL') + '/rest/v1/' + table + '?on_conflict=person_id';
  var key = need('SUPABASE_SERVICE_ROLE_KEY');
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'   // idempotent upsert on person_id
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error('supabase ' + res.status + ' ' + (await res.text()));
  return { ok: true, count: rows.length };
}

// Injectable so the --dry / no-network test can run the full loop without a server.
const HOOKS = { upsert: supaUpsert };

/* One load. Returns a structured summary; never throws for a RUNTIME fault (network /
 * bad source) — logs a no-op. Throws ONLY for misconfig (missing env / source path
 * when not dry), which the entry point surfaces as a non-zero exit. */
async function run(opts) {
  opts = opts || {};
  var dry = opts.dry || DRY;
  var summary = {
    peopleScanned: 0, peopleValid: 0, peopleUpserted: 0,
    growthScanned: 0, growthValid: 0, growthUpserted: 0,
    skipped: 0, errors: 0, dry: !!dry
  };

  // ---- MISCONFIG gate (exit non-zero): required inputs absent. OUTSIDE the
  //      runtime try/catch so it rejects rather than silently no-opping. ----
  var sourcePath = opts.source || env.TEMPO_DATALOAD_SOURCE;
  if (!opts.records && !sourcePath && !dry) throw new Error('missing source: set TEMPO_DATALOAD_SOURCE or pass --source <path>');
  if (!dry && !opts.upsert) { need('SUPABASE_URL'); need('SUPABASE_SERVICE_ROLE_KEY'); }   // throws if missing
  var doUpsert = opts.upsert || HOOKS.upsert;

  // ---- runtime body: faults here are caught → counted → no-op exit 0 ----
  try {
    // dry with no source supplied = a clean empty preview loop (not a fault).
    var src = opts.records || (sourcePath ? readSourceFile(sourcePath) : { people: [], growth: [] });
    var peopleIn = Array.isArray(src.people) ? src.people : [];
    var growthIn = Array.isArray(src.growth) ? src.growth : [];

    var peopleRows = [];
    peopleIn.forEach(function (rec) {
      summary.peopleScanned++;
      var row = toPeopleRow(rec);
      if (row) { peopleRows.push(row); summary.peopleValid++; }
      else { summary.skipped++; log('skip people row — missing person_id'); }
    });
    var growthRows = [];
    growthIn.forEach(function (rec) {
      summary.growthScanned++;
      var row = toGrowthRow(rec);
      if (row) { growthRows.push(row); summary.growthValid++; }
      else { summary.skipped++; log('skip growth row — missing person_id'); }
    });

    if (dry) {
      log('DRY would upsert people=' + peopleRows.length + ' growth=' + growthRows.length + ' (skipped ' + summary.skipped + ') — writing nothing');
    } else {
      if (peopleRows.length) {
        try { await doUpsert('people', peopleRows); summary.peopleUpserted = peopleRows.length; }
        catch (e) { summary.errors++; log('people upsert fault (no-op for this batch): ' + e.message); }
      }
      if (growthRows.length) {
        try { await doUpsert('growth', growthRows); summary.growthUpserted = growthRows.length; }
        catch (e) { summary.errors++; log('growth upsert fault (no-op for this batch): ' + e.message); }
      }
    }
  } catch (e) {
    summary.errors++; log('runtime fault (no-op): ' + e.message);
  }
  return summary;
}

module.exports = { run: run, toPeopleRow: toPeopleRow, toGrowthRow: toGrowthRow, readSourceFile: readSourceFile, parseCsvPeople: parseCsvPeople, HOOKS: HOOKS };

if (require.main === module) {
  // Runtime faults are caught inside run() → exit 0 (no-op). Only a real misconfig
  // (missing env / source path on a non-dry run) rejects here → exit 1.
  run({})
    .then(function (summary) { log('summary ' + JSON.stringify(summary)); process.exit(0); })
    .catch(function (e) { log('fatal (misconfig): ' + e.message); process.exit(1); });
}
