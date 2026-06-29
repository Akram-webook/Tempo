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

  // Localized label for an event category — reuses the timeline cat* keys.
  function catLabel(c, t) {
    var key = 'cat' + c.charAt(0).toUpperCase() + c.slice(1);
    var lbl = t(key);
    return (lbl && lbl !== key) ? lbl : c;
  }

  // One sourced evidence line: text + an attributed source chip (no judgement).
  function lineHTML(ln, t) {
    var when = ln.ts ? new Date(ln.ts).toISOString().slice(0, 10) : '';
    return '<li class="ep-line">' +
        '<span class="ep-text">' + WP.ui.esc(ln.text) + '</span>' +
        '<span class="ep-src">' + WP.ui.icon('eye', 12) + ' ' + t('epSource') + ': ' + WP.ui.esc(ln.source) +
          (when ? ' · ' + when : '') + '</span>' +
      '</li>';
  }

  // Mirror of evalIntel's citeId(): the stable ref string for a cited item. Lets the
  // band's "cites N" chip resolve its refs back to the sourced evidence objects.
  function refOf(e) { return e && (e.id || e.source || ((e.category || '') + '@' + (e.ts || ''))); }

  // "cites N items" as a REAL, keyboard-accessible control (Heuristic #1/#6 — evidence
  // is traceable, not decorative). Carries its refs so a click opens them. Empty refs →
  // no chip (never a dead affordance). Plural-correct via WP.i18n.plural.
  function evChip(refs, prefix, t) {
    var ids = (refs || []).filter(Boolean);
    if (!ids.length) return '';
    return '<button type="button" class="wbk-band-ev" data-refs="' + WP.ui.esc(ids.join('|')) + '"' +
        ' title="' + t('sbViewEvidence') + '">' +
      WP.ui.icon('eye', 12) + ' ' + WP.ui.esc(WP.i18n.plural(prefix, ids.length)) + '</button>';
  }

  // Evidence "timeline" filtered to a point's refs: a calm drawer listing the SOURCED
  // items behind it. De-fabricated — only items actually on record appear.
  function openEvidence(refs, all, t) {
    var set = {}; (refs || []).forEach(function (r) { set[r] = 1; });
    var items = (all || []).filter(function (e) { return set[refOf(e)]; });
    var host = document.getElementById('overlay-host');
    if (!host) return;
    host.innerHTML = '<div class="overlay"><div class="drawer">' +
      '<button class="btn icon-btn" id="ev-close" style="margin-bottom:14px" aria-label="Close">' + WP.ui.icon('x', 14) + '</button>' +
      '<h3>' + WP.ui.icon('eye', 16) + ' ' + t('sbEvTitle') + '</h3>' +
      '<div class="disclaimer">' + t('sbEvIntro') + '</div>' +
      (items.length
        ? '<ul class="ep-list">' + items.map(function (e) {
            return lineHTML({ text: e.text || catLabel(e.category || '', t), source: e.source, ts: e.ts }, t);
          }).join('') + '</ul>'
        : '<div class="ep-empty"><div class="ttl">' + t('sbEvNone') + '</div></div>') +
      '</div></div>';
    host.querySelector('#ev-close').onclick = function () { host.innerHTML = ''; };
    host.querySelector('.overlay').onclick = function (e) { if (e.target.classList.contains('overlay')) host.innerHTML = ''; };
  }

  // Wire the cited-evidence chips inside a freshly-rendered band to the evidence drawer.
  function wireEvidence(host, all, t) {
    host.querySelectorAll('.wbk-band-ev[data-refs]').forEach(function (btn) {
      btn.onclick = function () { openEvidence(btn.dataset.refs.split('|'), all, t); };
    });
  }

  /* Render the evidence-prep summary. PREP ONLY — deliberately renders NO score,
   * rating, or verdict; just sourced lines, growth highlights, and listed gaps. */
  function prepHTML(s, t, ar) {
    var head = '<h3>' + WP.ui.icon('clipboard', 14) + ' ' + t('epTitle') + '</h3>' +
      '<div class="disclaimer">' + t('epIntro') + '</div>';

    // Sparse → say so plainly; still show whatever little is on record.
    // S4-2 — when SOME sourced evidence exists, "Not enough evidence yet" reads as
    // contradictory next to the items shown. Soften to "Limited evidence so far"
    // so the banner and the listed evidence agree. Only a truly empty store keeps
    // the firmer "Not enough evidence yet" line.
    if (!s.enough) {
      var hasSome = s.sourcedCount > 0;
      var thin = s.sections.map(function (sec) {
        return '<div class="ep-cat"><div class="mini-label">' + catLabel(sec.category, t) + '</div>' +
          '<ul class="ep-list">' + sec.lines.map(function (l) { return lineHTML(l, t); }).join('') + '</ul></div>';
      }).join('');
      return head +
        '<div class="ep-empty"><div class="ttl" style="font-weight:600">' + WP.ui.icon('clock', 14) + ' ' +
            (hasSome ? t('epLimited') : t('epNotEnough')) + '</div>' +
          '<div class="ttl">' + (hasSome ? t('epLimitedNote') : t('epNotEnoughNote')) + '</div></div>' +
        thin +
        '<div class="disclaimer">' + t('epHuman') + '</div>';
    }

    var highlights = s.highlights.length
      ? '<div class="ep-cat ep-highlights"><div class="mini-label">' + WP.ui.icon('sprout', 13) + ' ' + t('epHighlights') + '</div>' +
          '<ul class="ep-list">' + s.highlights.map(function (l) { return lineHTML(l, t); }).join('') + '</ul></div>'
      : '';

    var sections = s.sections.map(function (sec) {
      return '<div class="ep-cat"><div class="mini-label">' + catLabel(sec.category, t) +
          ' <span class="ep-count">' + t('epCount').replace('{n}', sec.lines.length) + '</span></div>' +
        '<ul class="ep-list">' + sec.lines.map(function (l) { return lineHTML(l, t); }).join('') + '</ul></div>';
    }).join('');

    var gaps = s.gaps.length
      ? '<div class="ep-gaps"><div class="mini-label">' + WP.ui.icon('alert', 13) + ' ' + t('epGaps') + '</div>' +
          '<ul class="ep-list">' + s.gaps.map(function (g) {
            return '<li class="ep-gap">' + t('epGapLine').replace('{c}', catLabel(g.category, t)) + '</li>';
          }).join('') + '</ul></div>'
      : '';

    return head + highlights + sections + gaps +
      '<div class="disclaimer">' + t('epHuman') + '</div>';
  }

  /* Render the SUGGESTED RANGE as a calm support panel (P3, WP.evalIntel). It shows a
   * /5 BAND [low–high] — never a single number to copy — with confidence, cited
   * reasoning, and risks framed "weigh these". It NEVER replaces the manager's input
   * and carries NO apply button (the human decides). Sensitive-gated by the caller. */
  function bandHTML(s, t) {
    var head = '<h3>' + WP.ui.icon('sparkles', 14) + ' ' + t('sbTitle') + '</h3>' +
      '<div class="disclaimer">' + t('sbIntro') + '</div>';

    // "Not enough evidence yet" is a first-class, honest result — no fabricated band.
    if (!s || s.denied || !s.enoughEvidence || !Array.isArray(s.range)) {
      return head +
        '<div class="wbk-band-empty"><strong>' + WP.ui.icon('clock', 14) + ' ' + t('sbNotEnough') + '</strong>' +
          '<div class="wbk-band-sub">' + t('sbNotEnoughNote') + '</div></div>' +
        '<div class="disclaimer">' + t('sbHuman') + '</div>';
    }

    var lo = s.range[0], hi = s.range[1];
    var pct = function (v) { return ((v - 1) / 4) * 100; }; // /5 → 0–100% across the track
    var left = pct(lo), width = Math.max(pct(hi) - pct(lo), 2);
    var confKey = s.confidence === 'high' ? 'sbConfHigh' : (s.confidence === 'low' ? 'sbConfLow' : 'sbConfMed');

    var track =
      '<div class="wbk-band-val">' + lo.toFixed(1) + '–' + hi.toFixed(1) + '<span>/5</span></div>' +
      // gridlines (1–5) keep the span keyed to the scale, not floating decoration (#4).
      '<div class="wbk-band-track" role="img" aria-label="' + t('sbAria').replace('{lo}', lo).replace('{hi}', hi) + '">' +
        '<span class="wbk-band-grid" aria-hidden="true"></span>' +
        '<span class="wbk-band-span" style="inset-inline-start:' + left + '%;inline-size:' + width + '%"></span></div>' +
      '<div class="wbk-band-scale"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>';

    var reason = s.reasoning && s.reasoning.length
      ? '<ul class="wbk-band-reason">' + s.reasoning.map(function (r) {
          return '<li><span>' + WP.ui.esc(r.text) + '</span>' + evChip(r.evidence, 'sbCites', t) + '</li>';
        }).join('') + '</ul>'
      : '';

    var risks = s.risks && s.risks.length
      ? '<div class="ep-gaps"><div class="mini-label">' + WP.ui.icon('alert', 13) + ' ' + t('sbWeigh') + '</div>' +
          '<ul class="wbk-band-reason">' + s.risks.map(function (rk) {
            return '<li class="wbk-band-risk"><span>' + WP.ui.esc(rk.text) + '</span>' + evChip(rk.evidence, 'sbCites', t) + '</li>';
          }).join('') + '</ul></div>'
      : '';

    var anchor = s.baseline
      ? '<div class="wbk-band-sub">' + (s.baseline.anchoredTo === 'orgMean'
          ? t('sbAnchorOrg').replace('{v}', s.baseline.value) : t('sbAnchorDefault')) + '</div>'
      : '';

    return head +
      '<div class="wbk-band-head"><span class="wbk-band-conf">' + WP.ui.icon('gauge', 12) + ' ' + t(confKey) + '</span></div>' +
      track + anchor + reason + risks +
      '<div class="disclaimer">' + t('sbHuman') + '</div>';
  }

  function render(root) {
    const t = WP.i18n.t, ar = WP.state.lang === 'ar';
    const p = WP.access.byId(WP.state.selectedId);
    const viewer = WP.viewer();
    const selfMode = !!(viewer && p && viewer.id === p.id);
    // S4-1 — the back button must match where the evaluation was opened from.
    // Self-assessments and anything launched from the Evaluations hub return there;
    // an evaluation opened from a person's profile returns to that profile.
    const fromEval = selfMode || WP.state.evalOrigin === 'evaluations';
    const backRoute = fromEval ? 'evaluations' : 'profile';
    const backLabel = fromEval ? t('backToEvaluations') : t('backToProfile');
    const back = function () { WP.setState({ route: backRoute }); };
    if (!p || (!selfMode && !canEvaluate(viewer, p.id))) {
      root.innerHTML = '<button class="btn" id="back" style="margin-bottom:16px"><span class="ar ar-left"></span> ' + backLabel + '</button>' +
        '<div class="section"><div class="sub">' + WP.ui.icon('lock',14) + ' ' + t('evalDenied') + '</div></div>';
      root.querySelector('#back').onclick = back; return;
    }
    // S3-1 — the evaluation belongs to the cycle the user opened it from (the
    // active cycle from the hub, or an explicitly selected one), not a stale
    // hardcoded period. Resolve it and show THAT cycle in the header.
    const cycle = WP.evaluation.cycles().find(function (c) { return c.id === WP.state.selectedCycle; })
      || WP.evaluation.activeCycle();
    const ev = selfMode ? WP.evaluation.ensureSelf(p.id) : WP.evaluation.ensure(p.id);
    const periodLabel = (cycle && cycle.name) ? cycle.name : ev.period;
    const selfCmp = selfMode ? null : WP.data.SELF[p.id]; // manager sees the employee's self-rating beside theirs
    const score = WP.evaluation.overall(ev);
    const evaluator = ev.evaluatorId ? WP.access.byId(ev.evaluatorId) : null;
    // Evaluation prep (P2) — evidence the manager already has, manager-gated and
    // never in self-mode. PREP ONLY: the panel never shows a score/rating/verdict.
    const showPrep = !selfMode && WP.evalPrep && WP.access.canSeeSensitive(viewer, p.id);

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
      '<button class="btn" id="back" style="margin-bottom:14px"><span class="ar ar-left"></span> ' + backLabel + '</button>' +
      '<div class="eval-head">' +
        '<div><div class="ttl">' + t('performance') + ' · ' + ui.esc(periodLabel) + '</div>' +
          '<h2 style="margin:2px 0">' + (selfMode ? t('selfAssessment') : t('evaluation')) + ' — ' + ui.esc(WP.i18n.name(p)) + '</h2>' +
          '<div class="ttl">' + ui.esc(WP.i18n.title(p)) +
            (evaluator ? ' · ' + t('evaluator') + ': ' + ui.esc(WP.i18n.name(evaluator)) : '') + '</div></div>' +
        '<div class="eval-score"><div class="eval-num">' + (score == null ? '–' : score) + '<span>/5</span></div>' +
          '<span class="rating ' + statusClass(ev.status) + '">' + ui.esc(ev.status) + '</span></div>' +
      '</div>' +

      (showPrep ? '<div class="section eval-prep" id="eval-prep-host" aria-live="polite"><div class="ttl">' + WP.ui.icon('clipboard',14) + ' ' + t('epLoading') + '</div></div>' : '') +

      // ANCHORING GUARD (Heuristic #2/#5): the suggested range is COLLAPSED on load —
      // the manager forms their own view first, then reveals it on demand. data-suggested
      // stays EMPTY until reveal, so "shown" == "revealed" for B1's provenance stamp.
      (showPrep ? '<div class="section wbk-band wbk-band--collapsed" id="eval-suggested-band" data-suggested="" aria-live="polite">' +
        '<h3>' + WP.ui.icon('sparkles',14) + ' ' + t('sbTitle') + '</h3>' +
        '<div class="disclaimer">' + t('sbRevealNote') + '</div>' +
        '<button type="button" class="btn" id="sb-reveal" disabled>' + WP.ui.icon('eye',14) + ' ' + t('epLoading') + '</button>' +
      '</div>' : '') +

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

    // AI-acceptance provenance: alongside the prep panel (same sensitive-access gate),
    // pull the engine's SUGGESTED rating band. We stamp acceptance at approval only
    // when a real suggestion exists (enoughEvidence) — never fabricate it on a manual
    // eval with no AI input. Held in a closure the approve handler reads.
    let aiSuggestion = null;
    if (showPrep && WP.evalIntel) {
      // Fetch eagerly so reveal is instant, but DO NOT render or stamp until the
      // manager reveals it. Revealing is the act that makes the suggestion "shown":
      // only then do we fill the band, stamp data-suggested, and arm aiSuggestion for
      // the acceptance flag. A band never revealed = no AI shown = no provenance — which
      // keeps B1's later aiAccepted stamp honest. (CONTRACT: shown == revealed.)
      const revealBand = function (s, host) {
        if (s && s.enoughEvidence && Array.isArray(s.range)) aiSuggestion = s;
        host.classList.remove('wbk-band--collapsed');
        host.innerHTML = bandHTML(s, t);
        host.setAttribute('data-suggested',
          (s && s.enoughEvidence && Array.isArray(s.range)) ? (s.range[0] + '-' + s.range[1]) : '');
        wireEvidence(host, (s && s.evidence) || [], t); // chips → cited-evidence drawer (#1)
      };
      const armReveal = function (s) {
        const host = root.querySelector('#eval-suggested-band');
        if (!host) return;
        const btn = host.querySelector('#sb-reveal');
        if (!btn) return;
        btn.disabled = false;
        btn.innerHTML = WP.ui.icon('eye', 14) + ' ' + t('sbReveal');
        btn.onclick = function () { revealBand(s, host); };
      };
      Promise.resolve(WP.evalIntel.suggestedRange(p.id, ev.period, { viewer: viewer, refDate: WP.state.refDate }))
        .then(armReveal)
        .catch(function () { armReveal(null); });
    }

    // Fill the evidence-prep panel asynchronously (reads the append-only event store).
    if (showPrep) {
      WP.evalPrep.prepare(p.id, {}, WP.state.refDate).then(function (summary) {
        const host = root.querySelector('#eval-prep-host');
        if (host) host.innerHTML = prepHTML(summary, t, ar);
      }).catch(function () {
        const host = root.querySelector('#eval-prep-host');
        if (host) host.innerHTML = '<div class="ttl">' + t('epNotEnough') + '</div>';
      });
    }

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
      const overall = WP.evaluation.overall(ev);
      const entry = { type: 'evaluation', by: WP.state.viewerId, target: p.id, reason: 'approved · ' + (overall || '–') + '/5' };
      // Accepted = the human's final overall landed inside the AI-suggested band.
      // Only when a suggestion was actually shown (enoughEvidence); else no flag.
      if (aiSuggestion && typeof overall === 'number') {
        entry.aiAccepted = (overall >= aiSuggestion.range[0] && overall <= aiSuggestion.range[1]);
      }
      WP.logEvent(entry);
      saveEval();
      WP.setState({});
    };
    const dl = root.querySelector('#dl');
    if (dl) dl.onclick = function () { dl.textContent = t('downloadReport') + ' ' + WP.ui.icon('check',14) + ''; };
  }

  WP.ui.evaluation = { render: render };
})(window.WP = window.WP || {});
