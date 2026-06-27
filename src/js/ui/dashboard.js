/* ============================================================
 * Webook Workload — Role dashboard (Director / Senior / Manager / Employee)
 * ------------------------------------------------------------
 * One route that adapts to the viewer's role, built from REAL computed
 * data (capacity engine + growth signals + access scope). No mock numbers.
 * ========================================================== */
(function (WP) {
  'use strict';
  const ui = WP.ui;

  function kpi(label, value, sub, color) {
    return '<div class="card"><div class="label">' + label + '</div>' +
      '<div class="value"' + (color ? ' style="color:' + color + '"' : '') + '>' + value + '</div>' +
      '<div class="sub">' + (sub || '') + '</div></div>';
  }
  /* Team Health on sample/empty data: a bare "0%" reads as broken/alarming, not
   * calm. When no real load signal exists yet, show a neutral "no data" state
   * instead of a misleading 0% (S1 — Calm UI). A real 0% with load is still shown. */
  function teamHealthKpi(m) {
    const t = WP.i18n.t;
    const hasData = m.snaps.some(function (s) { return s.load > 0; });
    if (!hasData) return kpi(t('teamHealth'), '—', t('noDataYet'), 'var(--text-muted)');
    // S3-3 — frame the headline as "{h} of {n} in healthy band" so a low/zero
    // percentage reads as informative (band split) rather than an alarm.
    const split = t('healthyBandSplit').replace('{h}', m.healthyCount).replace('{n}', m.size);
    return kpi(t('teamHealth'), m.teamHealth + '%', split, 'var(--state-balanced)');
  }
  function ofPeople(n) { return WP.i18n.t('ofPeople').replace('{n}', n); }
  function loadBar(pct) {
    const c = ui.stateColor(WP.capacity.stateForLoad(pct));
    return '<span class="bar"><i style="width:' + Math.min(100, pct) + '%;background:' + c + '"></i></span>';
  }
  function personRow(p, snap, rightHtml) {
    const c = ui.stateColor(snap.state);
    return '<div class="dash-row" data-open="' + p.id + '" style="--node-accent:' + c + '">' +
      ui.avatar(p, c) +
      '<div class="dash-meta"><div class="nm">' + ui.esc(WP.i18n.name(p)) + '</div>' +
        '<div class="ttl">' + ui.esc(WP.i18n.title(p)) + '</div></div>' +
      (rightHtml || '') + '</div>';
  }
  function stateChip(snap) {
    const c = ui.stateColor(snap.state);
    return '<span class="dash-pct" style="color:' + c + '">' + snap.load + '%</span>';
  }

  function director(root, viewer) {
    const t = WP.i18n.t, win = WP.state.window, ref = WP.state.refDate;
    const people = WP.access.visiblePeople(viewer);
    const m = WP.capacity.teamMetrics(people, win, ref);
    const attn = m.snaps.filter(function (s) {
      return s.state.key === 'overloaded' || s.state.key === 'near' || s.burnout;
    }).sort(function (a, b) { return b.load - a.load; }).slice(0, 6);

    let risk = 0, promo = 0, ramp = 0;
    people.forEach(function (p) {
      if (WP.growth.flightRisk(p).risk) risk++;
      if (WP.growth.promotionReadiness(p).pct >= 70) promo++;
      if (WP.growth.isRamping(p)) ramp++;
    });

    const leads = WP.access.directReports(viewer.id);
    const teamRows = leads.map(function (lead) {
      const team = WP.access.teamOf(lead.id);
      const tm = WP.capacity.teamMetrics(team, win, ref);
      const avg = Math.round(tm.snaps.reduce(function (a, s) { return a + s.load; }, 0) / (tm.snaps.length || 1));
      return '<div class="lr"><span class="nm">' + ui.esc(WP.i18n.name(lead).split(' ')[0]) +
        '<span class="ttl"> · ' + team.length + '</span></span>' + loadBar(avg) +
        '<span class="dash-pct">' + avg + '%</span>' +
        '<span class="tag">' + tm.teamHealth + '% ' + t('healthy') + '</span></div>';
    }).join('');

    const attnHtml = attn.length ? attn.map(function (s) {
      const p = WP.access.byId(s.id);
      const reason = s.burnout ? t('burnoutShort') : t('overloadedShort');
      return personRow(p, s, stateChip(s) +
        '<span class="tag" style="color:var(--state-' + (s.state.key === 'overloaded' || s.burnout ? 'overloaded' : 'near') + ')">' + reason + '</span>');
    }).join('') : '<div class="sub">' + t('allClear') + '</div>';

    root.innerHTML =
      '<div class="ttl">' + t('navDashboard') + ' · ' + t('director') + '</div>' +
      '<h2 style="margin:2px 0 16px">' + t('hi') + (WP.state.lang === 'ar' ? '، ' : ', ') + ui.esc(WP.i18n.name(viewer).split(' ')[0]) + '</h2>' +
      '<div class="metrics">' +
        teamHealthKpi(m) +
        kpi(t('available'), m.counts.available, ofPeople(people.length)) +
        kpi(t('nearCapacity'), m.nearOrOver, t('nearCapSub')) +
        kpi(t('earlyWarnings'), m.earlyWarnings, t('burnoutShort')) +
      '</div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + WP.ui.icon('alert', 16) + ' ' + t('needsAttention') + '</h3>' + attnHtml + '</div>' +
        '<div class="section"><h3>' + WP.ui.icon('sprout', 16) + ' ' + t('talent') + '</h3>' +
          '<div class="metrics" style="grid-template-columns:repeat(3,1fr)">' +
            kpi(t('newSkillShort'), promo, t('promoReady'), 'var(--state-available)') +
            kpi(t('flightRisk').split(' ')[0], risk, t('flightRisk'), 'var(--state-overloaded)') +
            kpi(t('rampingShort'), ramp, t('rampingUp').split('—')[0]) +
          '</div></div>' +
      '</div>' +
      '<div class="section"><h3>' + WP.ui.icon('users', 16) + ' ' + t('teamLoad') + '</h3>' + (teamRows || '<div class="sub">—</div>') + '</div>';
  }

  function leader(root, viewer) {
    const t = WP.i18n.t, win = WP.state.window, ref = WP.state.refDate;
    const team = WP.access.teamOf(viewer.id);
    const reports = team.filter(function (p) { return p.id !== viewer.id; });
    const m = WP.capacity.teamMetrics(team, win, ref);
    const snaps = {}; m.snaps.forEach(function (s) { snaps[s.id] = s; });

    const free = reports.slice().sort(function (a, b) { return snaps[a.id].load - snaps[b.id].load; }).slice(0, 5);
    const attn = reports.filter(function (p) {
      const s = snaps[p.id]; return s.state.key === 'overloaded' || s.state.key === 'near' || s.burnout;
    });
    const develop = reports.filter(function (p) { return WP.growth.promotionReadiness(p).fairnessGap || WP.growth.isRamping(p); });

    const freeHtml = free.length ? free.map(function (p) {
      const s = snaps[p.id];
      return personRow(p, s, stateChip(s) + (WP.access.canAct(viewer) && s.state.key !== 'overloaded'
        ? '<button class="btn" data-assign="' + p.id + '">' + t('assign') + '</button>'
        : '<span class="tag">' + WP.i18n.stateLabel(s.state) + '</span>'));
    }).join('') : '<div class="sub">—</div>';
    const attnHtml = attn.length ? attn.map(function (p) {
      const s = snaps[p.id];
      return personRow(p, s, stateChip(s) + '<span class="tag" style="color:var(--state-overloaded)">' + (s.burnout ? t('burnoutShort') : t('overloadedShort')) + '</span>');
    }).join('') : '<div class="sub">' + t('allClear') + '</div>';
    const devHtml = develop.length ? develop.map(function (p) {
      const pr = WP.growth.promotionReadiness(p);
      return personRow(p, snaps[p.id], '<span class="tag" style="color:var(--state-balanced)">' +
        (WP.growth.isRamping(p) ? t('rampingShort') : t('toDevelop')) + '</span>');
    }).join('') : '<div class="sub">—</div>';

    root.innerHTML =
      '<div class="ttl">' + t('navDashboard') + ' · ' + (viewer.level === 'sr_manager' ? t('director') : t('manager')) + '</div>' +
      '<h2 style="margin:2px 0 16px">' + t('hi') + (WP.state.lang === 'ar' ? '، ' : ', ') + ui.esc(WP.i18n.name(viewer).split(' ')[0]) + '</h2>' +
      '<div class="metrics">' +
        teamHealthKpi(m) +
        kpi(t('freeForWork'), m.counts.available, ofPeople(reports.length), 'var(--state-available)') +
        kpi(t('nearCapacity'), m.nearOrOver, t('nearCapSub'), 'var(--state-overloaded)') +
        kpi(t('toDevelop'), develop.length, t('talent')) +
      '</div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="section"><h3>' + WP.ui.icon('user', 16) + ' ' + t('whoCanTake') + '</h3>' + freeHtml + '</div>' +
        '<div class="section"><h3>' + WP.ui.icon('alert', 16) + ' ' + t('needsAttention') + '</h3>' + attnHtml + '</div>' +
      '</div>' +
      '<div class="section"><h3>' + WP.ui.icon('bulb', 16) + ' ' + t('toDevelop') + '</h3>' + devHtml + '</div>';
  }

  function employee(root, viewer) {
    const t = WP.i18n.t, win = WP.state.window, ref = WP.state.refDate;
    const snap = WP.capacity.snapshot(viewer, win, ref);
    const pr = WP.growth.promotionReadiness(viewer);
    const c = ui.stateColor(snap.state);

    root.innerHTML =
      '<div class="ttl">' + t('navDashboard') + ' · ' + t('employee') + '</div>' +
      '<h2 style="margin:2px 0 16px">' + t('hi') + (WP.state.lang === 'ar' ? '، ' : ', ') + ui.esc(WP.i18n.name(viewer).split(' ')[0]) + ' 👋</h2>' +
      '<div class="metrics">' +
        kpi(t('myLoad'), snap.load + '%', WP.i18n.stateLabel(snap.state), c) +
        kpi(t('currentProjects'), snap.eventCount, '') +
        kpi(t('promoReady'), pr.pct + '%', t('devOnly').split('—')[0]) +
      '</div>' +
      (snap.burnout ? '<div class="section" style="border-color:var(--state-overloaded)"><h3>' + WP.ui.icon('flame', 16) + ' ' + t('burnoutFlag') + '</h3><div class="sub">' + t('talkToManager') + '</div></div>' : '') +
      '<div class="section"><h3>' + WP.ui.icon('sprout', 16) + ' ' + t('yourGrowth') + '</h3><div class="sub">' + ui.esc(pr.note) + '</div></div>' +
      '<div class="section"><h3>' + WP.ui.icon('arrowRight', 16) + ' ' + t('quickLinks') + '</h3>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn" data-go="me">' + WP.ui.icon('target', 15) + ' ' + t('myProgress') + '</button>' +
          '<button class="btn" data-go="evaluations">' + WP.ui.icon('chart', 15) + ' ' + t('evaluationsHub') + '</button>' +
          '<button class="btn" data-go="daily">' + WP.ui.icon('clipboard', 15) + ' ' + t('dailyTasks') + '</button>' +
        '</div></div>';
  }

  function render(root) {
    const viewer = WP.viewer();
    const lvl = (viewer && viewer.level) || 'spec';
    if (lvl === 'director' || lvl === 'admin') director(root, viewer);
    else if (lvl === 'sr_manager' || lvl === 'manager') leader(root, viewer);
    else employee(root, viewer);

    // S3-2 — honest "Sample data" badge while KPIs are seeded, not live.
    root.insertAdjacentHTML('afterbegin', WP.ui.provenanceNote());

    root.querySelectorAll('[data-open]').forEach(function (el) {
      const open = function () { WP.setState({ route: 'profile', selectedId: el.dataset.open }); };
      // keyboard-accessible: clickable rows are divs, so make them real controls (WCAG 2.2)
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      const who = WP.access.byId(el.dataset.open);
      if (who) el.setAttribute('aria-label', WP.i18n.t('openProfile') + ' — ' + WP.i18n.name(who));
      el.onclick = open;
      el.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } };
    });
    root.querySelectorAll('[data-assign]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); if (WP.ui.assignmentDrawer) WP.ui.assignmentDrawer.openRequest(); };
    });
    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { WP.setState({ route: b.dataset.go, selectedId: null }); };
    });
  }

  WP.ui.dashboard = { render: render };
})(window.WP = window.WP || {});
