/* ============================================================
 * Tempo — Fairness / Overload Radar (view)  ·  director / super-admin (+ a manager
 * for their OWN team) only.   SPEC: docs/SPEC-fairness-radar.md
 * ------------------------------------------------------------
 * Balance framing, never a ranking that shames managers (Constitution II). Each
 * team shows its band + the 2–3 numbers behind it + a suggested rebalancing action.
 * Band is shown as a LABEL + icon + colour (never colour alone — WCAG 2.2).
 * EN/AR, RTL, dark mode via tokens. Reads only WP.fairness (core); no logic here.
 * ========================================================== */
(function (WP) {
  'use strict';
  var ui = WP.ui;

  var BAND_META = {
    unbalanced: { icon: 'alert', cls: 'fr-unbalanced', en: 'Unbalanced', ar: 'غير متوازن' },
    watch:      { icon: 'eye',   cls: 'fr-watch',      en: 'Watch',      ar: 'مراقبة' },
    balanced:   { icon: 'check', cls: 'fr-balanced',   en: 'Balanced',   ar: 'متوازن' }
  };

  function bandChip(band, ar) {
    var m = BAND_META[band]; if (!m) return '';
    // label + icon + colour together (accessibility: never colour as the only cue)
    return '<span class="fr-chip ' + m.cls + '">' + WP.ui.icon(m.icon, 13) + ' ' + (ar ? m.ar : m.en) + '</span>';
  }

  function teamCard(team, ar) {
    var t = WP.i18n.t;
    var mgr = WP.access.byId(team.managerId);
    var name = mgr ? ui.esc(WP.i18n.name(mgr)) : '';
    var teamLabel = (mgr && (ar ? mgr.teamAr : mgr.team)) ? ui.esc(ar ? mgr.teamAr : mgr.team) : name;

    var head =
      '<div class="fr-team-head">' +
        '<div class="fr-team-id">' +
          (mgr ? ui.avatar(mgr, 'var(--brand)') : '') +
          '<div class="fr-team-meta"><div class="nm">' + teamLabel + '</div>' +
            '<div class="ttl">' + t('frLedBy') + ' ' + name + ' · ' + team.size + ' ' + t('frMembers') + '</div></div>' +
        '</div>' +
        (team.noData ? '' : bandChip(team.band, ar)) +
      '</div>';

    if (team.noData) {
      return '<div class="fr-team">' + head +
        '<div class="ttl fr-nodata">' + WP.ui.icon('minus', 13) + ' ' + t('frNoData') + '</div></div>';
    }

    var nums = team.factors.map(function (f) {
      return '<li>' + ui.esc(ar ? f.ar : f.en) + '</li>';
    }).join('');

    var action = team.suggestedAction
      ? '<div class="fr-action">' + WP.ui.icon('sprout', 14) + ' <strong>' + t('frSuggested') + ':</strong> ' +
          ui.esc(ar ? team.suggestedAction.ar : team.suggestedAction.en) + '</div>'
      : '';

    return '<div class="fr-team">' + head +
      '<ul class="fr-factors">' + nums + '</ul>' + action + '</div>';
  }

  function render(root) {
    var t = WP.i18n.t, ar = WP.state.lang === 'ar';
    var viewer = WP.viewer();

    // ---- audience gate (hard guardrail): director / super-admin, or a manager
    // for their own team only. Never peer- or employee-facing. ----
    if (!viewer || !WP.fairness.canView(viewer)) {
      root.innerHTML =
        '<div class="ttl">' + t('navFairness') + '</div>' +
        '<div class="section"><div class="sub">' + WP.ui.icon('lock', 14) + ' ' + t('frDenied') + '</div></div>';
      return;
    }

    var teams;
    try { teams = WP.fairness.scan(viewer.id, WP.state.refDate); }
    catch (e) {
      root.innerHTML =
        '<div class="ttl">' + t('navFairness') + '</div>' +
        '<div class="sync-note offline">' + WP.ui.icon('alert', 14) + ' ' + t('frError') + '</div>';
      return;
    }

    var head =
      '<div class="ttl">' + t('navFairness') + '</div>' +
      '<div class="eval-head" style="margin-top:4px">' +
        '<div><h2 style="margin:0 0 2px">' + t('frTitle') + '</h2>' +
          '<div class="ttl">' + t('frSubtitle') + '</div></div>' +
      '</div>' +
      '<div class="disclaimer">' + WP.ui.icon('bulb', 13) + ' ' + t('frFraming') + '</div>';

    // ---- empty state: no team has assignment data yet ----
    var hasData = teams.some(function (tm) { return !tm.noData; });
    if (!teams.length || !hasData) {
      root.innerHTML = head +
        '<div class="section"><div style="text-align:center;padding:28px 0">' +
          '<div style="color:var(--text-muted)">' + WP.ui.icon('minus', 32) + '</div>' +
          '<div style="font-weight:600;margin-top:8px">' + t('frEmptyTitle') + '</div>' +
          '<div class="sub">' + t('frEmptyNote') + '</div></div></div>';
      return;
    }

    var flagged = teams.filter(function (tm) { return !tm.noData && tm.band !== 'balanced'; }).length;
    var cards = teams.map(function (tm) { return teamCard(tm, ar); }).join('');

    root.innerHTML = head +
      '<div class="section">' +
        '<h3>' + t('frTeams') + ' · ' + teams.length +
          (flagged ? ' <span class="fr-flagged-n">(' + flagged + ' ' + t('frNeedAttention') + ')</span>' : '') +
        '</h3>' + cards + '</div>';
  }

  WP.ui.fairness = { render: render };
})(window.WP = window.WP || {});
