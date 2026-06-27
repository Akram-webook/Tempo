/* ============================================================
 * Tempo — App shell: top bar controls + render router
 * Loaded LAST (after data, core, ui modules).
 * ========================================================== */
(function (WP) {
  'use strict';

  // Sidebar open/closed — remembered like Claude's sidebar. Default: open on
  // desktop, closed on mobile.
  let navClosed = (function () {
    try { const v = localStorage.getItem('tempo_nav'); if (v != null) return v === '1'; } catch (e) {}
    return (typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1200) < 821;
  })();
  function persistNav() { try { localStorage.setItem('tempo_nav', navClosed ? '1' : '0'); } catch (e) {} }
  function applyNav() {
    document.body.classList.toggle('nav-closed', navClosed);
    const tg = document.getElementById('nav-toggle');
    if (tg) {
      tg.setAttribute('aria-expanded', navClosed ? 'false' : 'true');
      const lbl = navClosed ? WP.i18n.t('expandNav') : WP.i18n.t('collapseNav');
      tg.setAttribute('aria-label', lbl);
      tg.setAttribute('title', lbl);
    }
  }
  function isMobile() { return window.innerWidth < 821; }

  function topbar() {
    const t = WP.i18n.t;
    const ic = WP.ui.icon;
    const ui = WP.ui;
    const bar = document.getElementById('topbar');
    const viewer = WP.viewer();
    const route = WP.state.route;
    const canManage = WP.access.canManage(viewer);

    // primary navigation (vertical sidebar) — role-aware
    const nav = [
      { id: 'dashboard',   routes: ['dashboard'],      icon: 'gauge',     label: t('navDashboard') },
      { id: 'map',         routes: ['map', 'profile'], icon: 'users',     label: t('navHome') },
      { id: 'me',          routes: ['me'],             icon: 'target',    label: t('myProgress') },
      { id: 'evaluations', routes: ['evaluations', 'evaluation', 'upward'], icon: 'chart', label: t('evaluationsHub') },
      { id: 'daily',       routes: ['daily'],          icon: 'clipboard', label: t('dailyTasks') },
      { id: 'library',     routes: ['library'],        icon: 'grid',      label: t('navLibrary') },
    ];
    // Wellbeing relief view — only for people who manage someone (line managers,
    // directors, super-admin). Never shown to peers (guardrail, Constitution II).
    if (WP.wellbeing && WP.wellbeing.canView(viewer)) {
      nav.splice(4, 0, { id: 'wellbeing', routes: ['wellbeing'], icon: 'sprout', label: t('navWellbeing') });
    }
    if (canManage) {
      nav.push({ id: 'permissions', routes: ['permissions'], icon: 'key',      label: t('permsTitle') });
      nav.push({ id: 'settings',    routes: ['settings'],    icon: 'settings', label: t('settings') });
    }
    const navHTML = nav.map(function (n) {
      const active = n.routes.indexOf(route) >= 0 ? ' active' : '';
      const cur = active ? ' aria-current="page"' : '';
      return '<button type="button" class="nav-item' + active + '" data-go="' + n.id + '"' + cur + '>' + ic(n.icon) + '<span>' + n.label + '</span></button>';
    }).join('');

    // account dropdown (bottom of sidebar, opens upward)
    const email = (viewer && viewer.name && WP.auth) ? WP.auth.emailOf(viewer) : '';
    const viewAsHTML = canManage
      ? '<div class="acct-section"><div class="acct-mini">' + t('viewAs') + '</div>' +
          '<select id="acct-viewas" class="btn" style="width:100%">' +
            WP.data.PEOPLE.map(function (p) {
              return '<option value="' + p.id + '"' + (p.id === WP.state.viewerId ? ' selected' : '') + '>' +
                WP.ui.esc(WP.i18n.name(p)) + ' · ' + WP.ui.esc(WP.i18n.title(p)) + '</option>';
            }).join('') +
          '</select></div>'
      : '';

    const menu =
      '<div class="acct-head">' + ui.avatar(viewer, 'var(--brand)') +
        '<div class="acct-id"><div class="acct-nm">' + WP.ui.esc(WP.i18n.name(viewer)) + '</div>' +
          '<div class="acct-ml">' + WP.ui.esc(email) + '</div></div></div>' +
      '<button class="acct-item" id="acct-lang"><span class="acct-k">' + t('prefsLang') + '</span><span class="acct-v">' + t('lang') + '</span></button>' +
      '<button class="acct-item" id="acct-theme"><span class="acct-k">' + t('prefsTheme') + '</span><span class="acct-v">' + ic(WP.state.theme === 'light' ? 'moon' : 'sun') + '</span></button>' +
      (viewAsHTML ? '<div class="acct-sep"></div>' + viewAsHTML : '') +
      '<div class="acct-sep"></div>' +
      '<button class="acct-item danger" id="acct-signout">' + ic('logout') + ' ' + t('signOut') + '</button>';

    const appbar = document.getElementById('appbar');

    // sidebar = New request + nav (pushes content like Claude's sidebar)
    bar.innerHTML =
      '<div class="sb-wrap">' +
        (WP.access.canAct(viewer) ? '<button class="btn primary sb-new" id="assign">' + ic('plus') + ' ' + t('newRequest') + '</button>' : '') +
        '<nav class="sb-nav" aria-label="' + t('navDashboard') + '">' + navHTML + '</nav>' +
      '</div>';

    // top app bar = panel toggle + brand + profile in the corner
    appbar.innerHTML =
      '<button class="btn icon-btn appbar-toggle" id="nav-toggle" aria-controls="topbar"' +
        ' aria-expanded="' + (navClosed ? 'false' : 'true') + '"' +
        ' aria-label="' + (navClosed ? t('expandNav') : t('collapseNav')) + '"' +
        ' title="' + (navClosed ? t('expandNav') : t('collapseNav')) + '">' + ic('panel') + '</button>' +
      '<button class="appbar-brand" id="brand-home" aria-label="' + t('goHome') + '">' +
        '<img class="brand-logo" src="src/assets/' + (WP.state.theme === 'dark' ? 'wbk-white.svg' : 'wbk-pink.svg') + '" alt="Webook" />' +
        '<span class="brand-sub">' + t('subtitle') + '</span>' +
      '</button>' +
      '<div class="spacer"></div>' +
      '<div class="account" id="account">' +
        '<button class="account-btn" id="acct-btn" aria-haspopup="true" aria-expanded="false" aria-label="' + t('account') + '">' +
          ui.avatar(viewer, 'var(--brand)') +
          '<span class="account-nm">' + WP.ui.esc(WP.i18n.name(viewer).split(' ')[0]) + '</span>' +
          '<span class="ar ar-dn"></span>' +
        '</button>' +
        '<div class="account-menu" id="acct-menu" role="menu">' + menu + '</div>' +
      '</div>';

    // reflect remembered open/closed state
    applyNav();

    // navigate (on mobile the drawer closes after picking)
    function go(id) {
      if (isMobile()) { navClosed = true; persistNav(); applyNav(); }
      WP.setState({ route: id, selectedId: null });
    }
    bar.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
    const bh = appbar.querySelector('#brand-home');
    if (bh) bh.onclick = function () { go('dashboard'); };
    const a = bar.querySelector('#assign');
    if (a) a.onclick = function () { if (isMobile()) { navClosed = true; persistNav(); applyNav(); } WP.ui.assignmentDrawer.openRequest(); };

    // sidebar collapse / expand (remembered)
    const toggle = appbar.querySelector('#nav-toggle');
    const backdrop = document.getElementById('nav-backdrop');
    toggle.onclick = function (e) {
      e.stopPropagation();
      navClosed = !navClosed; persistNav(); applyNav();
    };
    if (backdrop) backdrop.onclick = function () { navClosed = true; persistNav(); applyNav(); };
    // single shared handler (removed before re-adding) so it never accumulates across renders
    if (WP._navEscHandler) document.removeEventListener('keydown', WP._navEscHandler);
    WP._navEscHandler = function (ev) {
      if (ev.key === 'Escape' && isMobile() && !navClosed) { navClosed = true; persistNav(); applyNav(); }
    };
    document.addEventListener('keydown', WP._navEscHandler);

    // account dropdown (top corner)
    const acct = appbar.querySelector('#account');
    const acctBtn = appbar.querySelector('#acct-btn');
    acctBtn.onclick = function (e) {
      e.stopPropagation();
      const open = acct.classList.toggle('open');
      acctBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    if (WP._acctDocClose) document.removeEventListener('click', WP._acctDocClose);
    WP._acctDocClose = function (ev) { const a = document.getElementById('account'); if (a && !a.contains(ev.target)) a.classList.remove('open'); };
    document.addEventListener('click', WP._acctDocClose);

    appbar.querySelector('#acct-lang').onclick = function () { WP.setState({ lang: WP.state.lang === 'en' ? 'ar' : 'en' }); };
    appbar.querySelector('#acct-theme').onclick = function () { WP.setState({ theme: WP.state.theme === 'light' ? 'dark' : 'light' }); };
    appbar.querySelector('#acct-signout').onclick = function () { WP.auth.signOut(); };
    const va = appbar.querySelector('#acct-viewas');
    if (va) va.onchange = function (e) {
      WP.logEvent({ type: 'view-as', by: WP.state.viewerId, target: e.target.value });
      WP.setState({ viewerId: e.target.value, route: 'dashboard', selectedId: null });
    };
  }

  WP.render = function () {
    WP.applyDocAttrs();
    const bar = document.getElementById('topbar');
    const appbar = document.getElementById('appbar');
    const backdrop = document.getElementById('nav-backdrop');
    const root = document.getElementById('view');

    // Not signed in → show the company-email sign-in, hide the app chrome.
    if (!WP.state.authed) {
      document.body.classList.remove('nav-open', 'nav-closed');
      bar.innerHTML = ''; bar.style.display = 'none';
      if (appbar) { appbar.innerHTML = ''; appbar.style.display = 'none'; }
      if (backdrop) backdrop.style.display = 'none';
      const ebx = document.getElementById('eval-banner'); if (ebx) { ebx.innerHTML = ''; ebx.hidden = true; }
      document.getElementById('overlay-host').innerHTML = '';
      renderSignatureBar();   // hidden on the sign-in screen
      WP.ui.login.render(root);
      return;
    }
    bar.style.display = '';
    if (appbar) appbar.style.display = '';
    if (backdrop) backdrop.style.display = '';
    topbar();
    if (WP.state.route === 'dashboard') WP.ui.dashboard.render(root);
    else if (WP.state.route === 'profile') WP.ui.profile.render(root);
    else if (WP.state.route === 'settings') WP.ui.settings.render(root);
    else if (WP.state.route === 'daily') WP.ui.dailyTasks.render(root);
    else if (WP.state.route === 'permissions') WP.ui.permissions.render(root);
    else if (WP.state.route === 'evaluation') WP.ui.evaluation.render(root);
    else if (WP.state.route === 'upward') WP.ui.upward.render(root);
    else if (WP.state.route === 'evaluations') WP.ui.evaluations.render(root);
    else if (WP.state.route === 'wellbeing') WP.ui.wellbeing.render(root);
    else if (WP.state.route === 'me') WP.ui.me.render(root);
    else if (WP.state.route === 'library') WP.ui.wbkLibrary.render(root);
    else WP.ui.workloadMap.render(root);

    // mandatory evaluation banner — follows a manager across every page until done
    renderEvalBanner();

    // Signature / credits bar — decorative footer, authed app only
    renderSignatureBar();

    // Gentle daily check-in — at most ONCE PER DAY (not every load/session), and
    // only after the dashboard has painted, so it never interrupts orientation
    // (S3 — progressive disclosure / calm UI). Skip stays effortless.
    if (!WP._promptShown) {
      WP._promptShown = true;
      const today = new Date().toISOString().slice(0, 10);
      let last = null;
      try { last = localStorage.getItem('tempo_checkin_prompt'); } catch (e) {}
      const viewer = WP.viewer();
      if (last !== today && viewer && viewer.id !== '__admin__' && WP.state.route === 'dashboard') {
        try { localStorage.setItem('tempo_checkin_prompt', today); } catch (e) {}
        setTimeout(function () { if (WP.ui.dailyPrompt) WP.ui.dailyPrompt.open(); }, 700);
      }
    }
  };

  // Signature / credits bar — a thin decorative footer across the bottom of the authed
  // app (department + the two credit signatures). Credit-only: no data, no logic. Hidden
  // on the sign-in screen. Names are proper nouns, kept verbatim in both languages.
  function renderSignatureBar() {
    const host = document.getElementById('sig-bar');
    if (!host) return;
    if (!WP.state.authed) { host.innerHTML = ''; return; }
    const t = WP.i18n.t;
    host.innerHTML =
      '<div class="sig-bar">' +
        '<div class="sig-dept">' + t('sigDept') + '</div>' +
        '<div class="sig-sep"></div>' +
        '<div class="sig-credit">' +
          '<div class="sig-role">' + t('sigManaged') + '</div>' +
          '<div class="sig-name sig-name--accent">M. Akram</div>' +
        '</div>' +
        '<div class="sig-sep"></div>' +
        '<div class="sig-credit">' +
          '<div class="sig-role">' + t('sigDirected') + '</div>' +
          '<div class="sig-name">Ahmed Othman</div>' +
        '</div>' +
      '</div>';
  }

  // Mandatory evaluation banner — a manager with outstanding reviews for the ACTIVE cycle
  // sees a persistent, non-dismissible bar on every page (red once overdue) that links
  // straight to their pending reviews. Lives in its own host above #view, so navigating
  // and the workload auto-refresh never wipe it.
  function renderEvalBanner() {
    // Host lives INSIDE the content column (above #view), never as a child of the row-flex
    // shell — otherwise it stretches to full height. Created in index.html; create as a
    // fallback inside .view-main if missing.
    let host = document.getElementById('eval-banner');
    if (!host) {
      host = document.createElement('div'); host.id = 'eval-banner';
      const main = document.querySelector('.view-main'); const root = document.getElementById('view');
      if (main && root) main.insertBefore(host, root);
    }
    const t = WP.i18n.t, viewer = WP.viewer();
    const cyc = WP.evaluation && WP.evaluation.activeCycle && WP.evaluation.activeCycle();
    const req = (viewer && WP.evaluation && WP.evaluation.requiredFor) ? WP.evaluation.requiredFor(viewer.id) : null;
    if (!viewer || viewer.id === '__admin__' || !cyc || cyc.status !== 'Active' || !req || req.total === 0 || req.pending === 0) {
      host.innerHTML = ''; host.hidden = true; return;
    }
    const di = WP.evaluation.dueInfo && WP.evaluation.dueInfo();
    const overdue = !!(di && di.overdue);
    let when = '';
    if (di) when = overdue ? t('overdueBy').replace('{d}', Math.abs(di.daysLeft))
      : di.daysLeft === 0 ? t('dueToday') : t('dueInDays').replace('{d}', di.daysLeft);
    host.hidden = false;
    host.className = 'eval-banner' + (overdue ? ' is-overdue' : '');
    host.innerHTML =
      '<div class="eb-in">' + WP.ui.icon(overdue ? 'flame' : 'chart', 16) +
        '<span class="eb-msg"><b>' + WP.ui.esc(cyc.name) + ' ' + t('reviewsDue') + '</b> · ' +
          req.done + '/' + req.total + ' ' + t('done') + (when ? ' · ' + when : '') + '</span>' +
        '<button class="btn primary eb-cta" id="eb-go">' + t('reviewNow') + '</button>' +
      '</div>';
    const go = document.getElementById('eb-go');
    if (go) go.onclick = function () { WP.setState({ route: 'evaluations', selectedId: null }); };
  }

  // Esc closes any open overlay (peek popover / assignment drawer) — user control & freedom.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const host = document.getElementById('overlay-host');
      if (host && host.innerHTML) host.innerHTML = '';
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (WP.persist) WP.persist.hydrate();   // restore the user's saved work before first paint
    // Verified sign-in: consume a magic-link token from the URL and restore any
    // persisted Supabase session, so returning from the email link signs the user in.
    if (WP.auth && WP.auth.initSession) WP.auth.initSession();
    WP.render();
  });
  // safety net — also flush on unload in case a mutation didn't go through setState
  window.addEventListener('beforeunload', function () { if (WP.persist) WP.persist.saveData(); });
})(window.WP = window.WP || {});
