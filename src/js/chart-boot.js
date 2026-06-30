/* ============================================================
 * Tempo — Standalone "Operations Chart" export (chart.html)
 * ------------------------------------------------------------
 * PUBLIC, read-only, SAMPLE DATA only. No login, no app shell, no
 * backend. Reuses the SAME org data + the workloadMap chart renderer
 * + WBK V3 tokens as the app — this only swaps the app shell/router
 * for a slim standalone header and a minimal WP.render. It NEVER
 * loads auth/db/Supabase, so it cannot reach real people.
 * ========================================================== */
(function (WP) {
  'use strict';
  WP.EMBED = true;   // tells workloadMap to skip the in-app page header/breadcrumb

  function bar() {
    const t = WP.i18n.t, ic = WP.ui.icon;
    const el = document.getElementById('chart-bar');
    if (!el) return;
    el.innerHTML =
      '<div class="oc-bar-l">' +
        '<span class="oc-title">' + t('ocTitle') + '</span>' +
        '<span class="oc-sample" title="' + t('sampleDataHint') + '">' + ic('alert', 13) + ' ' + t('sampleData') + '</span>' +
      '</div>' +
      '<div class="oc-bar-r">' +
        '<button type="button" class="btn" id="oc-expand">' + ic('plus', 14) + ' ' + t('ocExpandAll') + '</button>' +
        '<button type="button" class="btn" id="oc-collapse">' + ic('minus', 14) + ' ' + t('ocCollapseAll') + '</button>' +
        '<button type="button" class="btn icon-btn" id="oc-lang" aria-label="' + t('prefsLang') + '" title="' + t('prefsLang') + '">' + (WP.state.lang === 'ar' ? 'EN' : 'ع') + '</button>' +
        '<button type="button" class="btn icon-btn" id="oc-theme" aria-label="' + t('prefsTheme') + '" title="' + t('prefsTheme') + '">' + ic(WP.state.theme === 'light' ? 'moon' : 'sun', 16) + '</button>' +
      '</div>';
    el.querySelector('#oc-expand').onclick = function () { WP.ui.workloadMap.expandAll(); };
    el.querySelector('#oc-collapse').onclick = function () { WP.ui.workloadMap.collapseAll(); };
    el.querySelector('#oc-lang').onclick = function () { WP.setState({ lang: WP.state.lang === 'ar' ? 'en' : 'ar' }); };
    el.querySelector('#oc-theme').onclick = function () { WP.setState({ theme: WP.state.theme === 'light' ? 'dark' : 'light' }); };
  }

  // Minimal render: slim standalone header + the reused workload-map chart.
  WP.render = function () {
    if (WP.applyDocAttrs) WP.applyDocAttrs();
    bar();
    WP.ui.workloadMap.render(document.getElementById('view'));
  };

  function boot() {
    // Viewer = the org root (no manager) so visiblePeople = the whole org → the full
    // chart renders. Sample data only; no auth, no identity, no persistence of a user.
    const people = (WP.data && WP.data.PEOPLE) || [];
    const top = people.filter(function (p) { return !p.managerId; })[0] || people[0];
    WP.state.viewerId = top ? top.id : null;
    WP.state.route = 'map';
    WP.state.authed = true;          // no login gate on this page; render path is local
    if (!WP.state.theme) WP.state.theme = WP.DEFAULT_THEME || 'dark';
    if (!WP.state.lang) WP.state.lang = 'en';
    WP.render();
  }

  // Scripts sit at the end of <body>, so #chart-bar / #view already exist → boot now.
  boot();
})(window.WP = window.WP || {});
