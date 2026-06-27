/* ============================================================
 * Webook Workload — Performance Evaluation screen (downward)
 * ------------------------------------------------------------
 * The LINE MANAGER (or director/admin) rates 16 weighted criteria
 * 1–5 and writes the qualitative feedback. Weighted overall → /5.
 * Interactive: click a score, type feedback, approve.
 * ========================================================== */
(function (WP) {
  'use strict';
  const ui = WP.ui;

  function canEvaluate(viewer, targetId) {
    const rel = WP.access.relationshipTo(viewer, targetId);
    return rel === 'manager' || rel === 'director'; // direct line manager, director, or admin
  }

  function statusClass(s) {
    return s === 'Completed' ? 'Exceeds' : s === 'In progress' ? 'Developing' : 'Meets';
  }

  function render(root) {
    const t = WP.i18n.t, ar = WP.state.lang === 'ar';
    const p = WP.access.byId(WP.state.selectedId);
    const viewer = WP.viewer();
    const selfMode = !!(viewer && p && viewer.id === p.id);
    const back = function () { WP.setState({ route: selfMode ? 'evaluations' : 'profile' }); };
    if (!p || (!selfMode && !canEvaluate(viewer, p.id))) {
      root.innerHTML = '<button class="btn" id="back" style="margin-bottom:16px"><span class="ar ar-left"></span> ' + t('back') + '</button>' +
        '<div class="section"><div class="sub">' + WP.ui.icon('lock',14) + ' ' + t('evalDenied') + '</div></div>';
      root.querySelector('#back').onclick = back; return;
    }
    const ev = selfMode ? WP.evaluation.ensureSelf(p.id) : WP.evaluation.ensure(p.id);
    const selfCmp = selfMode ? null : WP.data.SELF[p.id]; // manager sees the employee's self-rating beside theirs
    const score = WP.evaluation.overall(ev);
    const evaluator = ev.evaluatorId ? WP.access.byId(ev.evaluatorId) : null;

    const criteria = WP.data.EVAL_CRITERIA.map(function (c, i) {
      const cur = ev.scores[c.id];
      const scale = [1, 2, 3, 4, 5].map(function (n) {
        return '<button class="scale-btn' + (cur === n ? ' on' : '') + '" data-c="' + c.id + '" data-n="' + n + '">' + n + '</button>';
      }).join('');
      const selfBadge = (selfCmp && typeof selfCmp.scores[c.id] === 'number')
        ? '<span class="self-badge" title="self-rating">' + WP.ui.icon('user',13) + ' ' + selfCmp.scores[c.id] + '</span>' : '';
      return '<div class="crit-row">' +
        '<div class="crit-name"><span class="crit-num">' + (i + 1) + '</span> ' + (ar ? c.ar : c.en) +
          '<span class="crit-w">' + c.weight + '%</span>' + selfBadge + '</div>' +
        '<div class="scale">' + scale + '</div></div>';
    }).join('');

    const questions = WP.data.EVAL_QUESTIONS
      .filter(function (q) { return !(selfMode && q.key === 'recommendations'); })
      .map(function (q) {
      return '<div class="eval-q">' +
        '<div class="mini-label">' + (ar ? q.ar : q.en) + (q.sensitive ? ' ' + WP.ui.icon('lock',14) + '' : '') + '</div>' +
        '<div class="ttl" style="margin-bottom:6px">' + (ar ? q.promptAr : q.promptEn) + '</div>' +
        '<textarea class="eval-ta" data-q="' + q.key + '" rows="2" placeholder="…">' + ui.esc(ev.feedback[q.key] || '') + '</textarea>' +
      '</div>';
    }).join('');

    root.innerHTML =
      '<button class="btn" id="back" style="margin-bottom:14px"><span class="ar ar-left"></span> ' + t('back') + '</button>' +
      '<div class="eval-head">' +
        '<div><div class="ttl">' + t('performance') + ' · ' + ui.esc(ev.period) + '</div>' +
          '<h2 style="margin:2px 0">' + (selfMode ? t('selfAssessment') : t('evaluation')) + ' — ' + ui.esc(WP.i18n.name(p)) + '</h2>' +
          '<div class="ttl">' + ui.esc(WP.i18n.title(p)) +
            (evaluator ? ' · ' + t('evaluator') + ': ' + ui.esc(WP.i18n.name(evaluator)) : '') + '</div></div>' +
        '<div class="eval-score"><div class="eval-num">' + (score == null ? '–' : score) + '<span>/5</span></div>' +
          '<span class="rating ' + statusClass(ev.status) + '">' + ui.esc(ev.status) + '</span></div>' +
      '</div>' +

      '<div class="section"><h3>' + (selfMode ? t('selfAssessment') : t('downwardFeedback')) + ' · ' + t('criteriaTitle') +
        '<span class="ttl" style="font-weight:400"> · ' + t('groupWeight') + ' 100% · ' + t('scale') + ' 1–5</span></h3>' +
        (selfCmp ? '<div class="disclaimer">' + WP.ui.icon('user',13) + ' = ' + t('selfRating') + '</div>' : '') +
        criteria + '</div>' +

      '<div class="section"><h3>' + t('feedbackQs') + '</h3>' + questions +
        '<div class="disclaimer">' + t('evalNote') + '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px">' +
          '<button class="btn primary" id="approve">' + (ev.status === 'Completed' ? '' + WP.ui.icon('check',14) + ' ' + t('approved') : t('approve')) + '</button>' +
          '<button class="btn" id="dl">' + t('downloadReport') + '</button></div>' +
      '</div>';

    root.querySelector('#back').onclick = back;
    // Downward evaluations sync through WP.db (shared backend + localStorage
    // fallback). Self-assessments (SELF) stay local in Phase 1 — out of scope.
    const saveEval = function () {
      ev.updated_at = new Date().toISOString();
      if (!selfMode && WP.db && WP.db.evaluations) {
        WP.db.evaluations.upsert(p.id, ev).then(function (r) { if (r && r.offline) WP.setState({}); });
      }
    };
    root.querySelectorAll('.scale-btn').forEach(function (b) {
      b.onclick = function () {
        ev.scores[b.dataset.c] = parseInt(b.dataset.n, 10);
        if (ev.status === 'Not started') ev.status = 'In progress';
        saveEval();
        WP.setState({});
      };
    });
    root.querySelectorAll('.eval-ta').forEach(function (ta) {
      ta.onchange = function () { ev.feedback[ta.dataset.q] = ta.value; saveEval(); };
    });
    const ap = root.querySelector('#approve');
    if (ap) ap.onclick = function () {
      ev.status = 'Completed'; ev.evaluatorId = ev.evaluatorId || WP.state.viewerId;
      WP.logEvent({ type: 'evaluation', by: WP.state.viewerId, target: p.id, reason: 'approved · ' + (WP.evaluation.overall(ev) || '–') + '/5' });
      saveEval();
      WP.setState({});
    };
    const dl = root.querySelector('#dl');
    if (dl) dl.onclick = function () { dl.textContent = t('downloadReport') + ' ' + WP.ui.icon('check',14) + ''; };
  }

  WP.ui.evaluation = { render: render };
})(window.WP = window.WP || {});
