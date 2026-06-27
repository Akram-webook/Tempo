/* ============================================================
 * Tempo — WP.db : shared-backend data layer (Phase 1: evaluations)
 * ------------------------------------------------------------
 * The ONLY place that talks to Supabase for application data. UI code calls
 * WP.db.evaluations.{list,upsert,remove} and never touches WP._sb directly.
 *
 * Contract:
 *  - Signed in  -> reads/writes go to Supabase (table public.evaluations).
 *  - Signed out / offline / client missing / a call throws -> transparent
 *    fallback to the localStorage path (WP.data.EVALUATIONS + WP.persist),
 *    so the app keeps working and NOTHING is lost. A failed backend write
 *    flips WP.db.status.offline so the UI can show "Saved locally — will
 *    sync when back online".
 *
 * Realtime is out of scope for Phase 1 (re-fetch on view load). Later phases
 * add new WP.db.* namespaces (people/roles/check-ins) with the same shape.
 * ========================================================== */
(function (WP) {
  'use strict';

  var TABLE = 'evaluations';

  // Observable-ish status the evaluations view reads to render states.
  var status = { loading: false, offline: false, synced: false, lastError: null };

  // --- backend availability ------------------------------------------------
  // Usable only when a Supabase client with a query builder is present. When a
  // user is signed out there may be a client but no session; those calls throw
  // and we fall back — which is exactly the offline behaviour we want.
  function client() {
    var c = WP._sb;
    return (c && typeof c.from === 'function') ? c : null;
  }
  function usingBackend() { return !!client(); }

  // --- row <-> app record mapping (lossless) -------------------------------
  // App record (keyed by subject id): { period, status, evaluatorId, scores{}, feedback{} }
  function recToRow(id, rec) {
    rec = rec || {};
    return {
      id: id,
      subject_id: id,
      author_id: rec.evaluatorId || '',
      cycle: rec.period || '',
      scores: rec.scores || {},
      feedback: rec.feedback || {},
      status: rec.status || 'Not started',
      updated_at: rec.updated_at || new Date().toISOString()
      // author_email intentionally omitted — DB default auth.email() stamps it
      // on insert so RLS (author_email = auth.email()) passes.
    };
  }
  function rowToRec(row) {
    row = row || {};
    return {
      period: row.cycle || '',
      status: row.status || 'Not started',
      evaluatorId: row.author_id || null,
      scores: row.scores || {},
      feedback: row.feedback || {},
      updated_at: row.updated_at || null
    };
  }

  function localStore() {
    return (WP.data && WP.data.EVALUATIONS) ? WP.data.EVALUATIONS : (WP.data ? (WP.data.EVALUATIONS = {}) : {});
  }
  function persistLocal() { try { if (WP.persist) WP.persist.saveData(); } catch (e) {} }

  function newer(a, b) {
    // true if record a is strictly newer than b (by updated_at). Missing = oldest.
    var ta = a && a.updated_at ? Date.parse(a.updated_at) : 0;
    var tb = b && b.updated_at ? Date.parse(b.updated_at) : 0;
    return ta > tb;
  }

  // --- one-time import: push local-only / locally-newer evals to backend ---
  var importDone = false;
  function importLocalUp(serverById) {
    if (importDone) return Promise.resolve();
    importDone = true;
    var c = client(); if (!c) return Promise.resolve();
    var local = localStore();
    var pending = [];
    Object.keys(local).forEach(function (id) {
      var lrec = local[id];
      var srec = serverById[id];
      // de-dupe by id: only push when the server lacks it, or local is newer.
      if (!srec || newer(lrec, srec)) pending.push(recToRow(id, lrec));
    });
    if (!pending.length) return Promise.resolve();
    return Promise.resolve(c.from(TABLE).upsert(pending, { onConflict: 'id' }))
      .then(function (res) { if (res && res.error) throw res.error; })
      .catch(function (e) { status.lastError = e; /* keep local; non-fatal */ });
  }

  // --- public API: evaluations --------------------------------------------
  var evaluations = {
    /* Fetch all evaluations the user may see, merge into WP.data.EVALUATIONS,
     * and (first signed-in load only) import local-only rows up. Falls back to
     * the local store on any error. Returns the merged map. */
    list: function () {
      var c = client();
      if (!c) { status.offline = false; return Promise.resolve(localStore()); }
      status.loading = true; status.lastError = null;
      return Promise.resolve(c.from(TABLE).select('*'))
        .then(function (res) {
          if (res && res.error) throw res.error;
          var rows = (res && res.data) || [];
          var serverById = {};
          rows.forEach(function (row) { serverById[row.id] = rowToRec(row); });
          // merge server rows into the local store (server wins when newer)
          var store = localStore();
          Object.keys(serverById).forEach(function (id) {
            if (!store[id] || newer(serverById[id], store[id])) store[id] = serverById[id];
          });
          status.offline = false; status.synced = true;
          return importLocalUp(serverById).then(function () { persistLocal(); return store; });
        })
        .catch(function (e) {
          status.offline = true; status.lastError = e;
          return localStore();               // graceful fallback — no throw
        })
        .then(function (store) { status.loading = false; return store; });
    },

    /* Write a record (already mutated into WP.data.EVALUATIONS by callers, or
     * passed here). Always persists locally first (never lose work), then tries
     * the backend; a backend failure flips status.offline and resolves
     * { ok:false, offline:true } rather than rejecting. */
    upsert: function (id, rec) {
      var store = localStore();
      if (rec && store[id] !== rec) store[id] = rec;     // keep local authoritative copy
      rec = store[id] || rec || {};
      if (!rec.updated_at) rec.updated_at = new Date().toISOString();
      persistLocal();
      var c = client();
      if (!c) { status.offline = false; return Promise.resolve({ ok: true, offline: false, local: true }); }
      return Promise.resolve(c.from(TABLE).upsert(recToRow(id, rec), { onConflict: 'id' }))
        .then(function (res) {
          if (res && res.error) throw res.error;
          status.offline = false; status.synced = true;
          return { ok: true, offline: false };
        })
        .catch(function (e) {
          status.offline = true; status.lastError = e;   // saved locally; will sync later
          return { ok: false, offline: true, error: e };
        });
    },

    /* Remove locally and (best-effort) on the backend. */
    remove: function (id) {
      var store = localStore();
      delete store[id];
      persistLocal();
      var c = client();
      if (!c) return Promise.resolve({ ok: true, offline: false, local: true });
      return Promise.resolve(c.from(TABLE).delete().eq('id', id))
        .then(function (res) {
          if (res && res.error) throw res.error;
          status.offline = false;
          return { ok: true, offline: false };
        })
        .catch(function (e) { status.offline = true; status.lastError = e; return { ok: false, offline: true, error: e }; });
    }
  };

  WP.db = {
    status: status,
    usingBackend: usingBackend,
    evaluations: evaluations,
    _recToRow: recToRow,        // exposed for tests
    _rowToRec: rowToRec,
    _resetImport: function () { importDone = false; }  // tests
  };
})(window.WP = window.WP || {});
