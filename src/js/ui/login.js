/* ============================================================
 * Tempo — Sign in
 * ------------------------------------------------------------
 * Strongest configured method wins (see src/js/core/config.js):
 *   1. VERIFIED LINK (Supabase): enter @webook.com email → a one-time
 *      sign-in LINK is emailed to the REAL mailbox → open it → signed in.
 *      Typing someone else's email gets you nowhere: the link lands in
 *      THEIR inbox. (Supabase's default email sends a link; a literal typed
 *      6-digit code needs custom SMTP — see ACCESS-SETUP.md.)
 *   2. GOOGLE (GIS): Google proves the @webook.com identity.
 *   3. DIRECTORY GATE (demo default): exact-email match only — convenient,
 *      but NOT a real lock (anyone who types a known email gets in).
 * In every mode the email must match a registered Tempo account, and
 * akram@webook.com is the Super Admin (View-as any account + access mgmt).
 * ========================================================== */
(function (WP) {
  'use strict';
  const ui = WP.ui;
  const DOMAIN = 'webook.com';

  function emailOf(p) {
    if (p && p.email) return p.email;
    return String(p && p.name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.') + '@' + DOMAIN;
  }
  function findByEmail(raw) {
    let email = String(raw || '').trim().toLowerCase();
    if (!email) return { error: 'errNoAccount' };
    if (email.indexOf('@') < 0) email += '@' + DOMAIN;
    const domain = email.slice(email.indexOf('@') + 1);
    if (domain !== DOMAIN) return { error: 'errBadDomain' };
    const p = WP.data.PEOPLE.find(function (x) { return x.email && x.email.toLowerCase() === email; });
    return p ? { person: p } : { error: 'errNoAccount' };
  }

  // Is Supabase configured? This gates the DATA layer (WP.db) and the verified-link
  // option — NOT the same question as "which auth provider do we use".
  function dbConfigured() { return !!(WP.config && WP.config.supabaseUrl && WP.config.supabaseAnonKey); }
  function googleConfigured() { return !!(WP.config && WP.config.googleClientId); }
  // The active AUTH provider. WP.config.authMode wins when set to a known value;
  // otherwise fall back to the legacy precedence (verified-link > google > directory).
  // Decoupled from dbConfigured() so we can pick the directory gate (or Google) while
  // Supabase stays wired for data.
  function mode() {
    var m = WP.config && WP.config.authMode;
    if (m === 'google' || m === 'verified-link' || m === 'directory') return m;
    if (dbConfigured()) return 'verified-link';
    if (googleConfigured()) return 'google';
    return 'directory';
  }
  function modeVerifiedLink() { return mode() === 'verified-link'; }
  function modeGoogle() { return mode() === 'google'; }
  function redirectUrl() { return location.origin + location.pathname; }

  function signIn(personId) {
    WP.logEvent({ type: 'sign-in', by: personId, target: personId });
    WP._login = null; WP._denied = null;
    WP.setState({ authed: true, viewerId: personId, route: 'dashboard', selectedId: null });
  }
  function signOut() {
    WP.logEvent({ type: 'sign-out', by: WP.state.viewerId, target: WP.state.viewerId });
    WP._login = null;
    try { if (WP._sb && WP._sb.auth) WP._sb.auth.signOut(); } catch (e) {}
    WP.setState({ authed: false, selectedId: null });
  }
  function rerender() { const v = document.getElementById('view'); if (v && !WP.state.authed) render(v); }

  /* ---------- Supabase client (verified sign-in link) ---------- */
  function sbClient(cb) {
    if (WP._sb) { cb(WP._sb); return; }
    function make() {
      try {
        WP._sb = window.supabase.createClient(WP.config.supabaseUrl, WP.config.supabaseAnonKey, {
          auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }
        });
        cb(WP._sb);
      } catch (e) { cb(null); }
    }
    if (window.supabase && window.supabase.createClient) { make(); return; }
    if (!document.getElementById('sb-script')) {
      const s = document.createElement('script');
      s.id = 'sb-script';
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = make; s.onerror = function () { cb(null); };
      document.head.appendChild(s);
    } else {
      let n = 0; const iv = setInterval(function () {
        if ((window.supabase && window.supabase.createClient) || ++n > 40) { clearInterval(iv); make(); }
      }, 150);
    }
  }

  // Map a verified Supabase session to a Tempo account and sign in (or deny).
  function handleSession(session) {
    const em = session && session.user && session.user.email ? String(session.user.email).toLowerCase() : '';
    const r = findByEmail(em);
    if (r.error || !r.person) { try { WP._sb.auth.signOut(); } catch (e) {} return; }
    if (!WP.access.hasAccess(r.person.id)) { WP._denied = r.person; WP._login = null; rerender(); try { WP._sb.auth.signOut(); } catch (e) {} return; }
    signIn(r.person.id);
  }

  // Called on boot when verified mode is on: consumes the link's token from the
  // URL (detectSessionInUrl) and restores any persisted session ("stay signed in").
  function initSession() {
    // Create the Supabase client whenever Supabase is configured — WP.db (the data
    // layer) reads through WP._sb, so it must exist even when the AUTH provider is
    // the directory gate or Google. Only the verified-LINK email session wiring below
    // is auth-mode specific.
    if (!dbConfigured()) return;
    sbClient(function (sb) {
      if (!sb) return;
      if (!modeVerifiedLink()) return;   // client is up for WP.db; no email-link auth to wire
      try {
        sb.auth.onAuthStateChange(function (_evt, session) { if (session && !WP.state.authed) handleSession(session); });
        sb.auth.getSession().then(function (res) {
          const session = res && res.data ? res.data.session : null;
          if (session && !WP.state.authed) handleSession(session);
        }).catch(function () {});
      } catch (e) {}
    });
  }

  function sendLink(email) {
    WP._login = { step: 'sent', email: email, sending: true }; rerender();
    sbClient(function (sb) {
      if (!sb) { WP._login = { step: 'email', email: email, err: 'errSendCode' }; rerender(); return; }
      sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: redirectUrl() } })
        .then(function (res) {
          if (res && res.error) { WP._login = { step: 'email', email: email, err: 'errSendCode' }; }
          else { WP._login = { step: 'sent', email: email, sent: true }; }
          rerender();
        })
        .catch(function () { WP._login = { step: 'email', email: email, err: 'errSendCode' }; rerender(); });
    });
  }

  /* ---------- Google Identity Services ---------- */
  function decodeJwt(tok) {
    try {
      const b = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }
  function onGoogleCredential(resp) {
    const claims = resp && resp.credential ? decodeJwt(resp.credential) : null;
    if (!claims) { WP._login = { step: 'email', err: 'errVerify' }; rerender(); return; }
    const em = String(claims.email || '').toLowerCase();
    if (String(claims.hd || '').toLowerCase() !== DOMAIN && em.slice(-('@' + DOMAIN).length) !== '@' + DOMAIN) {
      WP._login = { step: 'email', err: 'errBadDomain' }; rerender(); return;
    }
    const r = findByEmail(em);
    if (r.error) { WP._login = { step: 'email', email: em, err: r.error }; rerender(); return; }
    if (!WP.access.hasAccess(r.person.id)) { WP._denied = r.person; WP._login = null; rerender(); return; }
    signIn(r.person.id);
  }
  function initGoogle(root) {
    if (!modeGoogle()) return;
    function setup() {
      try {
        if (!(window.google && window.google.accounts && window.google.accounts.id)) return;
        window.google.accounts.id.initialize({ client_id: WP.config.googleClientId, callback: onGoogleCredential, hd: DOMAIN });
        const host = root.querySelector('#g-btn-host');
        if (host) window.google.accounts.id.renderButton(host, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
      } catch (e) {}
    }
    if (window.google && window.google.accounts && window.google.accounts.id) { setup(); return; }
    if (!document.getElementById('gis-script')) {
      const s = document.createElement('script');
      s.id = 'gis-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = setup; document.head.appendChild(s);
    } else {
      let n = 0; const iv = setInterval(function () { if ((window.google && window.google.accounts && window.google.accounts.id) || ++n > 30) { clearInterval(iv); setup(); } }, 200);
    }
  }

  /* ---------- Render ---------- */
  function render(root) {
    const t = WP.i18n.t;
    const logo = 'src/assets/' + (WP.state.theme === 'dark' ? 'wbk-white.svg' : 'wbk-pink.svg');
    const st = WP._login || {};
    let body;

    if (WP._denied) {
      const d = WP._denied;
      body =
        '<div class="g-denied"><div class="g-denied-ic">' + WP.ui.icon('lock', 22) + '</div>' +
          '<div class="g-denied-h">' + t('accessDenied') + '</div>' +
          '<div class="g-denied-sub">' + ui.esc(emailOf(d)) + ' — ' + t('accessDeniedSub') + '</div>' +
          '<button class="g-back" id="g-denied-back">' + t('useAnother') + '</button></div>';
    } else if (st.step === 'sent') {
      body =
        '<div class="login-codeto">' + WP.ui.icon('mail', 15) + ' ' + t('linkSentTo') + ' <strong>' + ui.esc(st.email) + '</strong></div>' +
        '<p class="login-sub">' + t('openLinkHint') + '</p>' +
        '<div class="login-err">' + (st.err ? t(st.err) : '') + '</div>' +
        '<div class="login-actions">' +
          '<button class="linkbtn" id="resend-link" ' + (st.sending ? 'disabled' : '') + '>' + (st.sending ? t('sendingCode') : t('resendLink')) + '</button>' +
          '<span class="login-dot">·</span>' +
          '<button class="linkbtn" id="change-email">' + t('changeEmail') + '</button>' +
        '</div>';
    } else {
      const primaryLabel = modeVerifiedLink() ? t('sendLink') : t('continueBtn');
      let note;
      if (modeVerifiedLink()) note = '<div class="login-note">' + WP.ui.icon('lock', 13) + ' ' + t('verifiedNoteLink') + '</div>';
      else if (modeGoogle()) note = '<div class="login-divider">' + t('or') + '</div><div id="g-btn-host"></div>';
      else note = '<div class="login-note">' + WP.ui.icon('lock', 13) + ' ' + t('verifyNote') + '</div>';
      body =
        '<label class="login-lbl" for="login-email">' + t('emailLabel') + '</label>' +
        '<form id="login-form" class="login-row">' +
          '<input id="login-email" class="login-input" type="email" inputmode="email" autocomplete="email" ' +
            'placeholder="' + t('emailPh') + '" value="' + ui.esc(st.email || '') + '" aria-label="' + t('emailLabel') + '" />' +
          '<button class="btn primary" type="submit">' + primaryLabel + '</button>' +
        '</form>' +
        '<div class="login-err">' + (st.err ? t(st.err) : '') + '</div>' +
        note;
    }

    root.innerHTML =
      '<div class="login-wrap"><div class="login-card">' +
        '<img class="login-logo" src="' + logo + '" alt="Webook" />' +
        '<h1 class="login-title">' + t('signInTitle') + '</h1>' +
        '<p class="login-sub">' + t('signInSub') + '</p>' +
        body +
      '</div>' +
      '<div class="login-controls">' +
        '<button class="btn" id="login-lang">' + t('lang') + '</button>' +
        '<button class="btn icon-btn" id="login-theme" aria-label="theme" title="' + t('prefsTheme') + '">' +
          WP.ui.icon(WP.state.theme === 'light' ? 'moon' : 'sun') + '</button>' +
      '</div></div>';

    const form = root.querySelector('#login-form');
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      const v = root.querySelector('#login-email').value;
      const r = findByEmail(v);
      if (r.error) { WP._login = { step: 'email', email: v, err: r.error }; render(root); return; }
      if (!WP.access.hasAccess(r.person.id)) { WP._denied = r.person; WP._login = null; render(root); return; }
      if (modeVerifiedLink()) { sendLink(r.person.email); }   // email a verified sign-in link
      else { signIn(r.person.id); }                            // Google pre-check / demo gate
    };
    const resend = root.querySelector('#resend-link');
    if (resend) resend.onclick = function () { sendLink(st.email); };
    const change = root.querySelector('#change-email');
    if (change) change.onclick = function () { WP._login = { step: 'email', email: st.email }; render(root); };
    const dback = root.querySelector('#g-denied-back');
    if (dback) dback.onclick = function () { WP._denied = null; WP._login = { step: 'email' }; render(root); };
    root.querySelector('#login-lang').onclick = function () { WP.setState({ lang: WP.state.lang === 'en' ? 'ar' : 'en' }); };
    root.querySelector('#login-theme').onclick = function () { WP.setState({ theme: WP.state.theme === 'light' ? 'dark' : 'light' }); };
    initGoogle(root);
  }

  WP.auth = {
    domain: DOMAIN, emailOf: emailOf, findByEmail: findByEmail,
    signIn: signIn, signOut: signOut,
    sendLink: sendLink, initSession: initSession, handleSession: handleSession,
    mode: mode
  };
  WP.ui.login = { render: render };
})(window.WP = window.WP || {});
