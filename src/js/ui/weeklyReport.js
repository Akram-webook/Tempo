/* ============================================================
 * Tempo — Weekly Intelligence Report (Intelligence Layer P5 · VIEW)
 * SPEC: docs/SPEC-decision-memory.md · GATE: ai-os/00-governance/INTELLIGENCE-ETHICS.md
 * ------------------------------------------------------------
 * Surfaces WP.decisionMemory.weeklyReport() — the SHAPE of leadership decisions
 * (counts by type, top focus areas, recurring themes, AI-acceptance, week-over-week
 * shifts), each with cited evidence. Director/admin only (canManage). De-identified
 * by construction: the engine strips people; this view NEVER re-introduces a name,
 * per-person row, score, or rank. Built on V3 .wbk-* tokens; both themes; LTR+RTL.
 * ========================================================== */
(function (WP) {
  'use strict';
  var ui = WP.ui;

  function focusLabel(focus, t) {
    var k = 'wrFocus_' + focus.replace(/-/g, '_');
    var v = t(k);
    return v === k ? focus.replace(/-/g, ' ') : v;
  }
  function typeLabel(type, t) {
    var k = 'wrType_' + type.replace(/-/g, '_');
    var v = t(k);
    return v === k ? type.replace(/-/g, ' ') : v;
  }
  function cites(n, t) { return '<span class="wr-cite">' + WP.ui.icon('eye', 12) + ' ' + t('wrCites').replace('{n}', n) + '</span>'; }

  function render(root) {
    var t = WP.i18n.t;
    var viewer = WP.viewer();

    // ACCESS GATE (Ethics #6): director/admin only. Anyone else gets a calm denial,
    // never the data. The nav entry is already hidden for them — this is defence in depth.
    if (!viewer || !WP.access.canManage(viewer)) {
      root.innerHTML = '<div class="section"><div class="sub">' + WP.ui.icon('lock', 14) + ' ' + t('wrDenied') + '</div></div>';
      return;
    }

    var rep = WP.decisionMemory.weeklyReport({ days: 7, ref: WP.state.refDate }, { viewer: viewer });

    var head =
      '<div class="wbk-pageheader"><div class="wbk-ph-main">' +
        '<h2 class="wbk-ph-title">' + t('wrTitle') + '</h2>' +
        '<div class="wbk-ph-sub">' + t('wrSub') +
          (rep.period ? ' · ' + rep.period.start + ' → ' + rep.period.end : '') + '</div>' +
      '</div></div>' +
      '<div class="disclaimer">' + WP.ui.icon('bulb', 13) + ' ' + t('wrIntro') + '</div>';

    // EMPTY — "Not enough data" is first-class (sparse window or denied-but-gated).
    if (!rep.enoughData) {
      root.innerHTML = head +
        '<div class="section"><div class="wr-empty">' +
          '<strong>' + WP.ui.icon('clock', 14) + ' ' + t('wrEmpty') + '</strong>' +
          '<div class="wr-empty-note">' + t('wrEmptyNote') + '</div></div></div>';
      return;
    }

    // 1) Decision counts by TYPE (each cites its events) — no person anywhere.
    var counts = Object.keys(rep.decisionCounts).sort(function (a, b) {
      return rep.decisionCounts[b].count - rep.decisionCounts[a].count;
    });
    var countsHTML = counts.length ? '<div class="wbk-table-wrap"><table class="wbk-table">' +
      '<thead><tr><th>' + t('wrColType') + '</th><th class="wbk-th-num">' + t('wrColCount') + '</th><th>' + t('wrColEvidence') + '</th></tr></thead>' +
      '<tbody>' + counts.map(function (type) {
        var d = rep.decisionCounts[type];
        return '<tr><td>' + ui.esc(typeLabel(type, t)) + '</td>' +
          '<td class="wbk-td-num">' + d.count + '</td>' +
          '<td>' + cites(d.evidence.length, t) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="sub">—</div>';

    // 2) Top focus areas (busiest first) — as labelled bars.
    var maxFocus = rep.topFocusAreas.reduce(function (m, f) { return Math.max(m, f.count); }, 1);
    var focusHTML = rep.topFocusAreas.map(function (f) {
      return '<div class="lr"><div class="nm"><div>' + ui.esc(focusLabel(f.focus, t)) + '</div>' +
          '<div class="ttl">' + cites(f.evidence.length, t) + '</div></div>' +
        '<div class="prog" style="flex:1;margin:0 12px"><i class="pg-prog" style="width:' + Math.round((f.count / maxFocus) * 100) + '%"></i></div>' +
        '<b style="font-variant-numeric:tabular-nums">' + f.count + '</b></div>';
    }).join('');

    // 3) Recurring themes (operational areas, never people).
    var themesHTML = rep.recurringThemes.length ? rep.recurringThemes.map(function (th) {
      return '<div class="wbk-li"><div><div class="wbk-li-t">' + ui.esc(focusLabel(th.theme, t)) + '</div>' +
        '<div class="wbk-li-m">' + ui.esc(th.text) + '</div></div>' + cites(th.evidence.length, t) + '</div>';
    }).join('') : '<div class="sub">' + t('wrNoThemes') + '</div>';

    // 4) AI-acceptance rate — "— / not yet available" when null (honest).
    var ai = rep.aiAcceptanceRate;
    var aiHTML = '<div class="wr-kpi">' +
      '<div class="wr-kpi-v">' + (ai ? Math.round(ai.rate * 100) + '%' : '—') + '</div>' +
        '<div class="wr-kpi-l">' + t('wrAiRate') + '</div>' +
        '<div class="ttl">' + (ai ? t('wrAiOf').replace('{a}', ai.accepted).replace('{n}', ai.of) + ' · ' + cites(ai.evidence.length, t) : t('wrAiNone')) + '</div></div>';

    // 5) Week-over-week shifts (per type) — each cites the period's events.
    var shiftsHTML = rep.shifts.length ? rep.shifts.map(function (s) {
      var up = s.delta > 0;
      return '<div class="wbk-li"><span class="wbk-alert-ic" style="color:' + (up ? 'var(--state-positive)' : 'var(--state-watch)') + '">' +
          WP.ui.icon(up ? 'arrowUp' : 'arrowRight', 16) + '</span>' +
        '<div><div class="wbk-li-t">' + ui.esc(typeLabel(s.type, t)) + '</div>' +
          '<div class="wbk-li-m">' + ui.esc(s.text) + '</div></div>' + cites(s.evidence.length, t) + '</div>';
    }).join('') : '<div class="sub">' + t('wrNoShifts') + '</div>';

    root.innerHTML = head +
      '<div class="section">' + aiHTML + '</div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + t('wrCounts') + '</h3>' + countsHTML + '</div>' +
        '<div class="section"><h3>' + t('wrFocusAreas') + '</h3>' + (focusHTML || '<div class="sub">—</div>') + '</div>' +
      '</div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + t('wrThemes') + '</h3>' + themesHTML + '</div>' +
        '<div class="section"><h3>' + t('wrShifts') + '</h3>' + shiftsHTML + '</div>' +
      '</div>' +
      '<div class="disclaimer">' + t('wrHuman') + '</div>';
  }

  WP.ui.weeklyReport = { render: render };
})(window.WP = window.WP || {});
