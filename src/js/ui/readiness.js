/* ============================================================
 * Tempo — Development & growth panel + Org-capability view (P6 · VIEW)
 * SPEC: docs/SPEC-readiness.md · GATE: ai-os/00-governance/INTELLIGENCE-ETHICS.md
 * ------------------------------------------------------------
 * Surfaces WP.readiness — the MOST ethics-sensitive engine (it touches careers).
 * The engine already refuses to produce a verdict; this RENDER BOUNDARY refuses to
 * LABEL one. Two surfaces, both V3 .wbk-*, both themes, LTR+RTL, all states:
 *
 *   developmentPanel(p)  — one person's evidence-based DEVELOPMENT bundle on their
 *     profile. Titled "Development & growth (evidence)" — NEVER "Readiness" as a
 *     score/verdict. NO number, NO rank, NO promote/hold. Gaps are framed as "what to
 *     put on record next", never a deficiency. Access-gated to canSeeSensitive
 *     (self / direct manager / director) — the caller (profile.js) only mounts it
 *     when sensitive is allowed; we re-assert via the engine's own viewer gate.
 *   orgRender(root)      — director/admin (canManage) aggregated + k-anonymized org
 *     capability view. Re-checks the gate (defence in depth). Never re-introduces a
 *     name or per-person row; suppressed cohorts render "too few to show".
 *
 * Every figure cites its sourced evidence via a keyboard-accessible chip → a calm
 * drawer (the P3 evidence-drawer pattern). "Not enough evidence yet" / "Not enough
 * data" are first-class. NO score / rank / verdict / percentage anywhere.
 * ========================================================== */
(function (WP) {
  'use strict';
  var ui = WP.ui;

  /* Stable ref for one cited evidence object — mirrors readiness._refOf's identity so
   * a chip can resolve its refs back to the sourced items behind a point. */
  function refOf(e) { return e && (e.id || e.source || ((e.category || '') + '@' + (e.ts || ''))); }

  /* One sourced evidence line in the drawer — text + source + date. No score. */
  function lineHTML(e, t) {
    var d = e.ts ? String(e.ts).slice(0, 10) : '';
    return '<li class="ep-line">' +
        '<span class="ep-text">' + ui.esc(e.text || e.category || '') + '</span>' +
        '<span class="ep-src">' + WP.ui.icon('eye', 12) + ' ' + t('epSource') + ': ' + ui.esc(e.source || '—') +
          (d ? ' · ' + d : '') + (e.confidence ? ' · ' + ui.esc(e.confidence) : '') + '</span>' +
      '</li>';
  }

  /* "N items" as a REAL, keyboard-accessible control (evidence is traceable, not
   * decorative). Carries an index into the per-render evidence registry. Empty → no
   * chip (never a dead affordance). Plural-correct via WP.i18n.plural. */
  function evChip(evk, count, t) {
    if (!count) return '';
    return '<button type="button" class="wbk-band-ev" data-evk="' + evk + '" title="' + t('rdViewEvidence') + '">' +
      WP.ui.icon('eye', 12) + ' ' + WP.ui.esc(WP.i18n.plural('rdCites', count)) + '</button>';
  }

  /* Open the cited-evidence drawer for one point — lists ONLY the sourced items
   * actually on record behind it (de-fabricated). */
  function openEvidence(items, t) {
    var host = document.getElementById('overlay-host');
    if (!host) return;
    var list = (items || []).filter(Boolean);
    host.innerHTML = '<div class="overlay"><div class="drawer">' +
      '<button class="btn icon-btn" id="rd-ev-close" style="margin-bottom:14px" aria-label="Close">' + WP.ui.icon('x', 14) + '</button>' +
      '<h3>' + WP.ui.icon('eye', 16) + ' ' + t('rdEvTitle') + '</h3>' +
      '<div class="disclaimer">' + t('rdEvIntro') + '</div>' +
      (list.length
        ? '<ul class="ep-list">' + list.map(function (e) { return lineHTML(e, t); }).join('') + '</ul>'
        : '<div class="ep-empty"><div class="ttl">' + t('rdEvNone') + '</div></div>') +
      '</div></div>';
    host.querySelector('#rd-ev-close').onclick = function () { host.innerHTML = ''; };
    host.querySelector('.overlay').onclick = function (e) { if (e.target.classList.contains('overlay')) host.innerHTML = ''; };
  }

  /* ---- DEVELOPMENT PANEL (one person, on their profile) -------------------- */

  // Flatten the profile's strengths + growthAreas into one indexed list so each chip
  // can resolve its OWN evidence (built identically at render + wire time).
  function evidenceGroups(prof) {
    var groups = [];
    (prof.strengths || []).forEach(function (s) { groups.push(s.evidence || []); });
    (prof.growthAreas || []).forEach(function (g) { groups.push(g.evidence || []); });
    return groups;
  }

  function itemRow(item, evk, t) {
    var n = (item.evidence || []).filter(Boolean).length;
    return '<div class="rd-item"><div class="rd-item-t">' + ui.esc(item.text) + '</div>' +
      (n ? '<div class="rd-item-ev">' + evChip(evk, n, t) + '</div>' : '') + '</div>';
  }

  // Synchronous render from cache; kicks the async load if absent. Loading state is a
  // calm placeholder, never fabricated content. ALWAYS titled "Development & growth
  // (evidence)" — never "Readiness", never a score/rank/verdict.
  function developmentPanel(p) {
    var t = WP.i18n.t;
    var cached = (WP._devCache && WP._devCache.id === p.id) ? WP._devCache.prof : null;
    if (!cached) {
      WP.readiness.developmentProfile(p.id, { viewer: WP.viewer(), refDate: WP.state.refDate }).then(function (prof) {
        WP._devCache = { id: p.id, prof: prof };
        WP.setState({});
      });
    }
    var head = '<div class="section"><h3>' + WP.ui.icon('sprout', 16) + ' ' + t('rdTitle') + '</h3>' +
      '<div class="disclaimer" style="margin-top:0">' + WP.ui.icon('bulb', 13) + ' ' + t('rdIntro') + '</div>';

    if (!cached) {
      return head + '<div class="sub" id="rd-loading">' + t('epLoading') + '</div></div>';
    }
    // Denied (defence in depth) or genuinely sparse → first-class "Not enough evidence yet".
    if (cached.denied || !cached.enoughEvidence) {
      return head +
        '<div class="rd-empty"><strong>' + WP.ui.icon('clock', 14) + ' ' + t('rdEmpty') + '</strong>' +
        '<div class="rd-empty-note">' + t('rdEmptyNote') + '</div></div></div>';
    }

    var ev = 0; // running index across the flattened evidence groups
    var strengths = (cached.strengths || []).length
      ? (cached.strengths || []).map(function (s) { return itemRow(s, ev++, t); }).join('')
      : '<div class="sub">' + t('rdNoneStrength') + '</div>';
    var growth = (cached.growthAreas || []).length
      ? (cached.growthAreas || []).map(function (g) { return itemRow(g, ev++, t); }).join('')
      : '<div class="sub">' + t('rdNoneGrowth') + '</div>';

    // Evidence coverage — transparent COUNTS, explicitly NOT a score.
    var cov = cached.evidenceCoverage || { byCategory: {} };
    var catKeys = Object.keys(cov.byCategory || {});
    var coverage = catKeys.length
      ? '<div class="rd-cov">' + catKeys.map(function (k) {
          return '<span class="rd-cov-cell"><span class="rd-cov-n">' + cov.byCategory[k] + '</span> ' + ui.esc(k) + '</span>';
        }).join('') + '</div>'
      : '<div class="sub">—</div>';

    // Gaps — framed as "what to put on record next", never a deficiency.
    var gaps = (cached.gaps || []).length
      ? '<ul class="rd-gaps">' + cached.gaps.map(function (g) { return '<li>' + ui.esc(g) + '</li>'; }).join('') + '</ul>'
      : '<div class="sub">—</div>';

    return head +
      '<div class="rd-block"><div class="mini-label">' + t('rdStrengths') + '</div>' + strengths + '</div>' +
      '<div class="rd-block"><div class="mini-label">' + t('rdGrowth') + '</div>' + growth + '</div>' +
      '<div class="rd-block"><div class="mini-label">' + t('rdCoverage') + '</div>' +
        '<div class="disclaimer" style="margin-top:0">' + t('rdCoverageNote') + '</div>' + coverage + '</div>' +
      '<div class="rd-block"><div class="mini-label">' + t('rdNext') + '</div>' +
        '<div class="disclaimer" style="margin-top:0">' + t('rdNextNote') + '</div>' + gaps + '</div>' +
      '<div class="disclaimer">' + t('rdHuman') + '</div></div>';
  }

  // Wire the cited-evidence chips inside the freshly-rendered dev panel.
  function wireDevPanel(root, p) {
    var t = WP.i18n.t;
    var cached = (WP._devCache && WP._devCache.id === p.id) ? WP._devCache.prof : null;
    if (!cached || cached.denied || !cached.enoughEvidence) return;
    var groups = evidenceGroups(cached);
    root.querySelectorAll('.rd-item .wbk-band-ev[data-evk]').forEach(function (btn) {
      var idx = parseInt(btn.dataset.evk, 10);
      btn.onclick = function () { openEvidence(groups[idx] || [], t); };
    });
  }

  /* ---- ORG-CAPABILITY VIEW (director/admin only) --------------------------- */

  function bandLabel(key, t) {
    return { developing: t('orgDeveloping'), proficient: t('orgProficient'), strong: t('orgStrong') }[key] || key;
  }
  function groupLabel(g, t) {
    var k = 'orgGroup_' + g;
    var v = t(k);
    return v === k ? g : v;
  }
  // Render one k-anonymized cell: a count, or a calm "too few to show" — never a 1..4
  // that could re-identify. The engine already suppressed; we only render its verdict.
  function cellText(cell, t) {
    if (!cell) return '—';
    if (cell.suppressed) return '<span class="rd-suppressed">' + WP.ui.icon('lock', 12) + ' ' + t('orgTooFew') + '</span>';
    return '<b style="font-variant-numeric:tabular-nums">' + cell.count + '</b>';
  }

  function orgRender(root) {
    var t = WP.i18n.t;
    var viewer = WP.viewer();
    // ACCESS GATE (Ethics #6): director/admin only — defence in depth (nav already hidden).
    if (!viewer || !WP.access.canManage(viewer)) {
      root.innerHTML = '<div class="section"><div class="sub">' + WP.ui.icon('lock', 14) + ' ' + t('orgDenied') + '</div></div>';
      return;
    }
    var cap = WP.readiness.orgCapability({ viewer: viewer });

    var head =
      '<div class="wbk-pageheader"><div class="wbk-ph-main">' +
        '<h2 class="wbk-ph-title">' + t('orgTitle') + '</h2>' +
        '<div class="wbk-ph-sub">' + t('orgSub') + '</div>' +
      '</div></div>' +
      '<div class="disclaimer">' + WP.ui.icon('bulb', 13) + ' ' + t('orgIntro') + '</div>';

    // EMPTY / suppressed-whole-cohort → "Not enough data" is first-class.
    if (!cap.enoughData) {
      root.innerHTML = head +
        '<div class="section"><div class="wr-empty">' +
          '<strong>' + WP.ui.icon('clock', 14) + ' ' + t('orgEmpty') + '</strong>' +
          '<div class="wr-empty-note">' + t('orgEmptyNote') + '</div></div></div>';
      return;
    }

    var cohort = cap.cohortSize;
    // Capability distribution — bands as labelled bars. A suppressed band shows
    // "too few to show" with no bar fill (no re-identifiable count leaks).
    var dist = cap.capabilityDistribution || {};
    var maxBand = Object.keys(dist).reduce(function (m, k) {
      var c = dist[k]; return (c && !c.suppressed) ? Math.max(m, c.count) : m;
    }, 1);
    var distHTML = ['strong', 'proficient', 'developing'].map(function (b) {
      var cell = dist[b];
      var wide = (cell && !cell.suppressed) ? Math.round((cell.count / maxBand) * 100) : 0;
      return '<div class="lr"><div class="nm"><div>' + ui.esc(bandLabel(b, t)) + '</div></div>' +
        '<div class="prog" style="flex:1;margin:0 12px"><i class="pg-prog" style="width:' + wide + '%"></i></div>' +
        cellText(cell, t) + '</div>';
    }).join('');

    // Skill-gap areas — per competency GROUP, each a k-anonymized cell. Describes the
    // AREA to invest in, never a person.
    var gaps = cap.skillGapAreas || {};
    var gapHTML = (WP.readiness.GROUPS || Object.keys(gaps)).map(function (g) {
      return '<div class="wbk-li"><div><div class="wbk-li-t">' + ui.esc(groupLabel(g, t)) + '</div></div>' +
        cellText(gaps[g], t) + '</div>';
    }).join('');

    root.innerHTML = head +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + t('orgDistribution') + '</h3>' +
          '<div class="ttl" style="margin-bottom:8px">' + t('orgCohort').replace('{n}', cohort) + '</div>' +
          distHTML + '</div>' +
        '<div class="section"><h3>' + t('orgSkillGaps') + '</h3>' +
          '<div class="ttl" style="margin-bottom:8px">' + t('orgCohort').replace('{n}', cohort) + '</div>' +
          gapHTML + '</div>' +
      '</div>' +
      '<div class="disclaimer">' + t('orgHuman') + '</div>';
  }

  WP.ui.readiness = {
    developmentPanel: developmentPanel,
    wireDevPanel: wireDevPanel,
    orgRender: orgRender,
    _refOf: refOf
  };
})(window.WP = window.WP || {});
