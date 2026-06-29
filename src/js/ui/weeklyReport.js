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
  function cites(n, t) { return '<span class="wr-cite">' + WP.ui.icon('eye', 12) + ' ' + WP.i18n.plural('wrCites', n) + '</span>'; }

  // ISO date shifted by n days — for the window stepper (no Date.now: we parse refDate).
  function shiftDays(iso, n) {
    var d = new Date((iso || '') + 'T00:00:00');
    if (isNaN(d)) return iso;
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function render(root) {
    var t = WP.i18n.t;
    var viewer = WP.viewer();

    // ACCESS GATE (Ethics #6): director/admin only. Anyone else gets a calm denial,
    // never the data. The nav entry is already hidden for them — this is defence in depth.
    if (!viewer || !WP.access.canManage(viewer)) {
      root.innerHTML = '<div class="section"><div class="sub">' + WP.ui.icon('lock', 14) + ' ' + t('wrDenied') + '</div></div>';
      return;
    }

    // WINDOW (#3): a stepper (‹ older · newer ›) + a 7/30-day toggle. The engine already
    // takes {days, ref}; we shift ref back by `back` whole windows. back=0 = most recent.
    var win = WP.state.weeklyWin || { days: 7, back: 0 };
    var ref = shiftDays(WP.state.refDate, -win.back * win.days);
    var rep = WP.decisionMemory.weeklyReport({ days: win.days, ref: ref }, { viewer: viewer });

    var rangeOpts = [7, 30].map(function (d) {
      return '<button type="button" class="wr-range' + (win.days === d ? ' is-on' : '') +
        '" data-days="' + d + '" aria-pressed="' + (win.days === d) + '">' + t('wrRange' + d) + '</button>';
    }).join('');
    var stepper =
      '<div class="wr-win">' +
        '<button type="button" class="btn icon-btn" id="wr-older" aria-label="' + t('wrOlder') + '">' + WP.ui.icon('arrowLeft', 14) + '</button>' +
        '<span class="wr-win-lbl">' + (rep.period ? rep.period.start + ' → ' + rep.period.end : '') + '</span>' +
        '<button type="button" class="btn icon-btn" id="wr-newer" aria-label="' + t('wrNewer') + '"' + (win.back <= 0 ? ' disabled' : '') + '>' + WP.ui.icon('arrowRight', 14) + '</button>' +
        '<span class="wr-range-group" role="group" aria-label="' + t('wrRangeLbl') + '">' + rangeOpts + '</span>' +
      '</div>';

    var head =
      '<div class="wbk-pageheader"><div class="wbk-ph-main">' +
        '<h2 class="wbk-ph-title">' + t('wrTitle') + '</h2>' +
        '<div class="wbk-ph-sub">' + t('wrSub') +
          (win.back > 0 ? ' · ' + t('wrPast') : '') + '</div>' +
      '</div>' + stepper + '</div>' +
      '<div class="disclaimer">' + WP.ui.icon('bulb', 13) + ' ' + t('wrIntro') + '</div>';

    // EMPTY — "Not enough data" is first-class (sparse window or denied-but-gated).
    if (!rep.enoughData) {
      root.innerHTML = head +
        '<div class="section"><div class="wr-empty">' +
          '<strong>' + WP.ui.icon('clock', 14) + ' ' + t('wrEmpty') + '</strong>' +
          '<div class="wr-empty-note">' + t('wrEmptyNote') + '</div></div></div>';
      wireControls(root); // still let a director step to a populated window
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

    // 4) AI-acceptance rate — a SLIM horizontal bar (#8: no full-width dead space),
    // grouped at the top of the counts column. "—" when null (honest, not 0%).
    var ai = rep.aiAcceptanceRate;
    var aiHTML = '<div class="wr-aibar">' +
        '<div class="wr-aibar-v">' + (ai ? Math.round(ai.rate * 100) + '%' : '—') + '</div>' +
        '<div class="wr-aibar-main"><div class="wr-aibar-l">' + t('wrAiRate') + '</div>' +
          '<div class="ttl">' + (ai ? t('wrAiOf').replace('{a}', ai.accepted).replace('{n}', ai.of) : t('wrAiNone')) + '</div></div>' +
        (ai ? cites(ai.evidence.length, t) : '') +
      '</div>';

    // 5) Week-over-week shifts (per type) — each cites the period's events.
    var shiftsHTML = rep.shifts.length ? rep.shifts.map(function (s) {
      var up = s.delta > 0;
      return '<div class="wbk-li"><span class="wbk-alert-ic" style="color:' + (up ? 'var(--state-positive)' : 'var(--state-watch)') + '">' +
          WP.ui.icon(up ? 'arrowUp' : 'arrowRight', 16) + '</span>' +
        '<div><div class="wbk-li-t">' + ui.esc(typeLabel(s.type, t)) + '</div>' +
          '<div class="wbk-li-m">' + ui.esc(s.text) + '</div></div>' + cites(s.evidence.length, t) + '</div>';
    }).join('') : '<div class="sub">' + t('wrNoShifts') + '</div>';

    root.innerHTML = head +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + t('wrCounts') + '</h3>' + aiHTML + countsHTML + '</div>' +
        '<div class="section"><h3>' + t('wrFocusAreas') + '</h3>' + (focusHTML || '<div class="sub">—</div>') + '</div>' +
      '</div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + t('wrThemes') + '</h3>' + themesHTML + '</div>' +
        '<div class="section"><h3>' + t('wrShifts') + '</h3>' + shiftsHTML + '</div>' +
      '</div>' +
      '<div class="disclaimer">' + t('wrHuman') + '</div>';
    wireControls(root);
  }

  // Wire the window stepper + range toggle. Window lives in WP.state.weeklyWin so a
  // re-render keeps the chosen period; changing the range resets to the most recent.
  function wireControls(root) {
    var win = WP.state.weeklyWin || { days: 7, back: 0 };
    var older = root.querySelector('#wr-older'), newer = root.querySelector('#wr-newer');
    if (older) older.onclick = function () { WP.setState({ weeklyWin: { days: win.days, back: win.back + 1 } }); };
    if (newer) newer.onclick = function () { if (win.back > 0) WP.setState({ weeklyWin: { days: win.days, back: win.back - 1 } }); };
    root.querySelectorAll('.wr-range[data-days]').forEach(function (b) {
      b.onclick = function () { WP.setState({ weeklyWin: { days: parseInt(b.dataset.days, 10), back: 0 } }); };
    });
  }

  WP.ui.weeklyReport = { render: render };
})(window.WP = window.WP || {});
