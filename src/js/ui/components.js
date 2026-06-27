/* ============================================================
 * Tempo — Shared UI helpers
 * ========================================================== */
(function (WP) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* CSS color value for a capacity state, read live from tokens. */
  function stateColor(stateObj) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(stateObj.token).trim() || 'var(' + stateObj.token + ')';
  }

  function tierColor(tierId) {
    // Tier 1 = overloaded-ish red weight, 2 = orange, 3 = green — purely for chip color.
    return ['', 'var(--state-overloaded)', 'var(--state-near)', 'var(--state-available)'][tierId];
  }

  function avatar(person, accentVar) {
    const inner = person.photo
      ? '<img src="' + esc(person.photo) + '" alt="" referrerpolicy="no-referrer" ' +
        'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'' + esc(person.initials) + '\'}))" />'
      : esc(person.initials);
    return '<div class="avatar" style="--node-accent:' + accentVar + '">' + inner + '</div>';
  }

  /* Honest provenance pill — shows "Sample data" while the app is running on
   * seeded/mock numbers, so KPIs never read as live truth (trust signal). Hidden
   * once a backend is connected AND synced (then the numbers are real). Shared so
   * the badge stays consistent app-wide (dashboard, workload map, …). */
  function provenanceNote() {
    const t = WP.i18n.t;
    const db = WP.db;
    const live = db && db.usingBackend && db.usingBackend() && db.status && db.status.synced;
    if (live) return '';
    return '<div class="provenance-note" title="' + t('sampleDataHint') + '">' +
      WP.ui.icon('alert', 13) + ' ' + t('sampleData') + '</div>';
  }

  WP.ui = WP.ui || {};
  WP.ui.esc = esc;
  WP.ui.stateColor = stateColor;
  WP.ui.tierColor = tierColor;
  WP.ui.avatar = avatar;
  WP.ui.provenanceNote = provenanceNote;
})(window.WP = window.WP || {});
