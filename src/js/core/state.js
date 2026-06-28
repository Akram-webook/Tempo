/* ============================================================
 * Tempo — App State
 * ------------------------------------------------------------
 * Single source of truth for UI-level state. Views read this
 * and call WP.render() after mutating it via setState().
 * ========================================================== */
(function (WP) {
  'use strict';

  /* ════════════════════════════════════════════════════════════════════
   * THE V3 CUTOVER SWITCH  —  flip this ONE line to throw the default theme.
   *   'dark'  = current look (held through the directors' observation period)
   *   'light' = the WBK PRO V3 light system (navy on white)
   * Pages are built coherent in BOTH themes; the user toggle and saved prefs
   * always win over this default. Reversible at any time — change & redeploy.
   * ════════════════════════════════════════════════════════════════════ */
  var DEFAULT_THEME = 'dark';   // ← Akram: change to 'light' for the V3 cutover
  WP.DEFAULT_THEME = DEFAULT_THEME;

  WP.state = {
    lang: 'en',            // 'en' | 'ar'
    theme: DEFAULT_THEME,  // default honored only when no saved pref exists (see restore())
    authed: false,         // signed in via company email?
    window: 'month',       // 'week' | 'month' | 'year'
    viewerId: 'p_ahmed',   // who is "logged in" (set at sign-in; admin can View-as)
    route: 'dashboard',    // current screen
    selectedId: null,      // person whose profile is open
    refDate: new Date().toISOString().slice(0, 10), // default to TODAY (current period active)
  };

  // Persist the session so a reload keeps you signed in and on the same page
  // (no re-login after every update). Safe if storage is unavailable.
  // NOTE: refDate is intentionally NOT saved — every load defaults to TODAY (active by default).
  const SAVE_KEYS = ['authed', 'viewerId', 'theme', 'lang', 'window', 'route', 'selectedId'];
  const NEEDS_SELECTION = { profile: 1, evaluation: 1, upward: 1 };
  (function restore() {
    try {
      const raw = localStorage.getItem('tempo_session');
      if (!raw) return;
      const s = JSON.parse(raw);
      SAVE_KEYS.forEach(function (k) { if (s[k] !== undefined) WP.state[k] = s[k]; });
      // guard: a detail route with no selection → land on dashboard
      if (NEEDS_SELECTION[WP.state.route] && !WP.state.selectedId) WP.state.route = 'dashboard';
    } catch (e) {}
  })();
  function persist() {
    try {
      const o = {};
      SAVE_KEYS.forEach(function (k) { o[k] = WP.state[k]; });
      localStorage.setItem('tempo_session', JSON.stringify(o));
    } catch (e) {}
  }

  WP.setState = function (patch) {
    Object.assign(WP.state, patch);
    persist();
    if (WP.persist) WP.persist.saveData();   // persist the user's WORK, not just the session
    if (typeof WP.render === 'function') WP.render();
  };

  WP.viewer = function () {
    if (WP.state.viewerId === '__admin__') {
      return { id: '__admin__', level: 'admin', initials: 'SA',
               name: 'Super Admin', nameAr: 'مدير الصلاحيات',
               title: 'Super Admin · Access management', titleAr: 'مدير النظام · إدارة الصلاحيات' };
    }
    // Fall back to the first person if a stale/unknown viewerId was restored,
    // so the app shell never crashes dereferencing an undefined viewer.
    return WP.access.byId(WP.state.viewerId) || (WP.data && WP.data.PEOPLE && WP.data.PEOPLE[0]) || null;
  };

  WP.activityLog = []; // overrides + view-as changes (who/when/why) — provenance
  WP.logEvent = function (entry) {
    WP.activityLog.unshift(Object.assign({ at: new Date().toISOString() }, entry));
  };

  WP.applyDocAttrs = function () {
    document.documentElement.lang = WP.state.lang;
    document.documentElement.dir = WP.i18n.isRTL() ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', WP.state.theme);
  };
})(window.WP = window.WP || {});
