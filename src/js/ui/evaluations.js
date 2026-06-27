/* ============================================================
 * Webook Workload — Evaluations hub (Performance › Evaluations)
 * ------------------------------------------------------------
 * The home for evaluations: the active cycle, MY pending tasks +
 * deadline, team-progress %, and status per person. Super Admin
 * can open a new cycle. Mirrors a real performance-tool dashboard.
 * ========================================================== */
(function (WP) {
  'use strict';
  const ui = WP.ui;

  function statusChip(s) {
    const cls = s === 'Completed' ? 'Exceeds' : s === 'In progress' ? 'Developing' : 'Meets';
    return '<span class="rating ' + cls + '">' + s + '</span>';
  }

  // Backend sync states (loading / offline-fallback / subtle success). Reads
  // WP.db.status; renders nothing when signed-out/local-only (no backend).
  function syncBanner() {
    const t = WP.i18n.t;
    const db = WP.db;
    if (!db || !db.usingBackend || !db.usingBackend()) return '';
    const s = db.status || {};
    if (s.loading) return '<div class="sync-note loading">' + WP.ui.icon('clock', 14) + ' ' + t('evalSyncing') + '</div>';
    if (s.offline) return '<div class="sync-note offline">' + WP.ui.icon('alert', 14) + ' ' + t('evalLoadError') + '</div>';
    if (s.synced)  return '<div class="sync-note synced">' + WP.ui.icon('check', 14) + ' ' + t('evalSynced') + '</div>';
    return '';
  }

  // Phase 1: re-fetch shared evaluations once per session, then re-render.
  // Realtime subscriptions are a later phase (SPEC P4).
  function ensureLoaded() {
    const db = WP.db;
    if (db && db.usingBackend && db.usingBackend() && !db._evalLoaded) {
      db._evalLoaded = true;
      db.evaluations.list().then(function () { WP.setState({}); });
    }
  }

  function render(root) {
    ensureLoaded();
    const t = WP.i18n.t, ar = WP.state.lang === 'ar';
    const viewer = WP.viewer();
    const cycle = WP.evaluation.activeCycle();
    const isReal = viewer && viewer.id !== '__admin__';
    const reports = isReal ? WP.access.directReports(viewer.id) : [];
    const scope = WP.access.visiblePeople(viewer).filter(function (p) { return p.id !== viewer.id; });

    const dStatus = function (id) { const e = WP.data.EVALUATIONS[id]; return e ? e.status : 'Not started'; };
    const pending = reports.filter(function (p) { return dStatus(p.id) !== 'Completed'; });

    // my self-assessment task
    const selfEv = isReal ? WP.evaluation.ensureSelf(viewer.id) : null;
    const selfPending = selfEv && selfEv.status !== 'Completed';

    // team progress across scope
    const counts = { Completed: 0, 'In progress': 0, 'Not started': 0 };
    scope.forEach(function (p) { counts[dStatus(p.id)] = (counts[dStatus(p.id)] || 0) + 1; });
    const total = scope.length || 1;
    const pct = function (n) { return Math.round((n / total) * 100); };

    // ---- my tasks card ----
    let tasks = '';
    if (!pending.length && !selfPending) {
      tasks = '<div style="text-align:center;padding:24px 0"><div style="color:var(--state-available)">' + WP.ui.icon('check',32) + '</div>' +
        '<div style="font-weight:600;margin-top:6px">' + t('allCaughtUp') + '</div>' +
        '<div class="sub">' + t('allCaughtUpNote') + '</div></div>';
    } else {
      tasks = (selfPending ? '<div class="task-row" data-self="1">' +
          '<span>' + WP.ui.icon('pencil',15) + ' ' + t('mySelfAssessment') + '</span>' + statusChip(selfEv.status) + '</div>' : '') +
        pending.map(function (p) {
          return '<div class="task-row" data-eval="' + p.id + '">' +
            '<span>' + ui.esc(WP.i18n.name(p)) + '</span>' + statusChip(dStatus(p.id)) + '</div>';
        }).join('');
    }

    // ---- employee status list (scope) ----
    const rows = scope.map(function (p) {
      return '<div class="ev-row" data-open="' + p.id + '">' + ui.avatar(p, 'var(--brand)') +
        '<div class="ev-meta"><div class="nm">' + ui.esc(WP.i18n.name(p)) + '</div>' +
          '<div class="ttl">' + ui.esc(WP.i18n.title(p)) + '</div></div>' +
        '<div class="ev-status">' + statusChip(dStatus(p.id)) + '</div></div>';
    }).join('');

    const cycleOptions = WP.evaluation.cycles().map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === cycle.id ? ' selected' : '') + '>' + c.name + ' · ' + c.status + '</option>';
    }).join('');

    root.innerHTML =
      '<div class="ttl">' + t('performance') + ' › ' + t('evaluationsHub') + '</div>' +
      '<div class="eval-head" style="margin-top:4px">' +
        '<div><h2 style="margin:0 0 2px">' + ui.esc(cycle.name) + ' ' + t('evaluation') +
          ' <span class="rating ' + (cycle.status === 'Active' ? 'Exceeds' : 'Meets') + '">' + cycle.status + '</span></h2>' +
          '<div class="ttl">' + cycle.type + ' · ' + cycle.start + ' → ' + cycle.end + '</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<select id="cycle" class="btn">' + cycleOptions + '</select>' +
          (WP.access.canManage(viewer) ? '<button class="btn primary" id="new-cycle">' + WP.ui.icon('plus', 15) + ' ' + t('newCycle') + '</button>' : '') +
        '</div>' +
      '</div>' +

      syncBanner() +

      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + t('myTasks') + '</h3>' + tasks + '</div>' +
        '<div class="section"><h3>' + t('teamProgress') + '</h3>' +
          '<div class="prog"><i class="pg-done" style="width:' + pct(counts.Completed) + '%"></i>' +
            '<i class="pg-prog" style="width:' + pct(counts['In progress']) + '%"></i></div>' +
          '<div class="prog-legend">' +
            '<span><span class="dot" style="background:var(--state-available)"></span> ' + pct(counts.Completed) + '% ' + t('done') + '</span>' +
            '<span><span class="dot" style="background:#2a7de1"></span> ' + pct(counts['In progress']) + '% ' + t('inProgressL') + '</span>' +
            '<span><span class="dot" style="background:var(--text-muted)"></span> ' + pct(counts['Not started']) + '% ' + t('notStartedL') + '</span></div></div>' +
      '</div>' +

      '<div class="section"><h3>' + t('employees') + ' · ' + scope.length + '</h3>' + (rows || '<div class="sub">—</div>') + '</div>';

    // S3-1 + S4-1 — open THIS cycle's evaluation, and remember we came from the hub
    // so the evaluation's back button returns here ("Back to evaluations").
    const openEval = function (id) {
      WP.setState({ route: 'evaluation', selectedId: id, selectedCycle: cycle.id, evalOrigin: 'evaluations' });
    };
    root.querySelectorAll('[data-eval]').forEach(function (el) {
      el.onclick = function () { openEval(el.dataset.eval); };
    });
    root.querySelectorAll('[data-open]').forEach(function (el) {
      el.onclick = function () { openEval(el.dataset.open); };
    });
    const selfTask = root.querySelector('[data-self]');
    if (selfTask) selfTask.onclick = function () { openEval(viewer.id); };
    root.querySelector('#cycle').onchange = function (e) { WP.evaluation.setActiveCycle(e.target.value); WP.setState({}); };
    const nc = root.querySelector('#new-cycle');
    if (nc) nc.onclick = function () {
      const name = prompt(t('newCyclePrompt'));
      if (!name) return;
      const id = 'c_' + Date.now();
      WP.evaluation.addCycle({ id: id, name: name, type: 'Quarterly', start: '—', end: '—', status: 'Active' });
      WP.logEvent({ type: 'cycle-created', by: WP.state.viewerId, target: name });
      WP.setState({});
    };
  }

  WP.ui.evaluations = { render: render };
})(window.WP = window.WP || {});
