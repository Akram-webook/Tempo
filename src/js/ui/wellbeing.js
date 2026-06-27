/* ============================================================
 * Tempo — Wellbeing Early-Warning (view)   ·  managers / directors / super-admin only
 * ------------------------------------------------------------
 * Support framing, never a ranking of "bad" people (Constitution II). Each flag
 * shows WHY (factors) + a concrete relief action. Band is shown as a LABEL + icon
 * + colour (never colour alone — WCAG 2.2). EN/AR, RTL, dark mode via tokens.
 * Reads only WP.wellbeing (core); no business logic here.
 * ========================================================== */
(function (WP) {
  'use strict';
  var ui = WP.ui;

  var BAND_META = {
    critical: { icon: 'flame',  cls: 'wb-critical', en: 'Critical', ar: 'حرج' },
    atRisk:   { icon: 'alert',  cls: 'wb-atrisk',   en: 'At risk',  ar: 'معرّض للخطر' },
    watch:    { icon: 'eye',    cls: 'wb-watch',    en: 'Watch',    ar: 'مراقبة' }
  };

  function bandChip(band, ar) {
    var m = BAND_META[band]; if (!m) return '';
    // label + icon + colour together (accessibility: never colour as the only cue)
    return '<span class="wb-chip ' + m.cls + '">' + WP.ui.icon(m.icon, 13) + ' ' + (ar ? m.ar : m.en) + '</span>';
  }

  function render(root) {
    var t = WP.i18n.t, ar = WP.state.lang === 'ar';
    var viewer = WP.viewer();

    // ---- audience gate (hard guardrail): managers of someone, directors, super-admin only ----
    if (!viewer || !WP.wellbeing.canView(viewer)) {
      root.innerHTML =
        '<div class="ttl">' + t('navWellbeing') + '</div>' +
        '<div class="section"><div class="sub">' + WP.ui.icon('lock', 14) + ' ' + t('wbDenied') + '</div></div>';
      return;
    }

    var flagged;
    try { flagged = WP.wellbeing.atRisk(viewer.id, WP.state.refDate); }
    catch (e) {
      root.innerHTML =
        '<div class="ttl">' + t('navWellbeing') + '</div>' +
        '<div class="sync-note offline">' + WP.ui.icon('alert', 14) + ' ' + t('wbError') + '</div>';
      return;
    }

    var head =
      '<div class="ttl">' + t('navWellbeing') + '</div>' +
      '<div class="eval-head" style="margin-top:4px">' +
        '<div><h2 style="margin:0 0 2px">' + t('wbTitle') + '</h2>' +
          '<div class="ttl">' + t('wbSubtitle') + '</div></div>' +
      '</div>' +
      '<div class="disclaimer">' + WP.ui.icon('bulb', 13) + ' ' + t('wbFraming') + '</div>';

    // ---- empty state is a GOOD outcome ----
    if (!flagged.length) {
      root.innerHTML = head +
        '<div class="section"><div style="text-align:center;padding:28px 0">' +
          '<div style="color:var(--state-available)">' + WP.ui.icon('check', 32) + '</div>' +
          '<div style="font-weight:600;margin-top:8px">' + t('wbEmptyTitle') + '</div>' +
          '<div class="sub">' + t('wbEmptyNote') + '</div></div></div>';
      return;
    }

    var rows = flagged.map(function (r) {
      var p = WP.access.byId(r.id); if (!p) return '';
      var reasons = r.factors.map(function (f) {
        return '<li>' + ui.esc(ar ? f.ar : f.en) + '</li>';
      }).join('');
      var action = r.suggestedAction ? (ar ? r.suggestedAction.ar : r.suggestedAction.en) : '';
      return '<div class="wb-row">' +
          '<div class="wb-person">' + ui.avatar(p, 'var(--brand)') +
            '<div class="wb-meta"><div class="nm">' + ui.esc(WP.i18n.name(p)) + '</div>' +
              '<div class="ttl">' + ui.esc(WP.i18n.title(p)) + '</div></div>' +
            bandChip(r.band, ar) + '</div>' +
          '<ul class="wb-factors">' + reasons + '</ul>' +
          '<div class="wb-action">' + WP.ui.icon('sprout', 14) + ' <strong>' + t('wbSuggested') + ':</strong> ' + ui.esc(action) + '</div>' +
        '</div>';
    }).join('');

    root.innerHTML = head +
      '<div class="section"><h3>' + t('wbFlagged') + ' · ' + flagged.length + '</h3>' + rows + '</div>';
  }

  WP.ui.wellbeing = { render: render };
})(window.WP = window.WP || {});
