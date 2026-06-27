/* ============================================================
 * Tempo — Workload Map (home screen)
 * Org chart + metric cards + chart/list toggle + node peek.
 * ========================================================== */
(function (WP) {
  'use strict';
  const ui = WP.ui;
  let listMode = false;
  let collapsed = {};      // person ids whose subtree is collapsed
  let collapseInit = false;
  let focusId = null;      // scope the tree to one team (subtree root)

  // Progressive disclosure: keep the leadership spine open (director + the team-lead
  // row) so the first view actually fills the canvas, and collapse only each team's
  // internals. One click on a team card then drills in.
  function defaultCollapsed(people) {
    const hasKids = {};
    people.forEach(function (p) { if (p.managerId) hasKids[p.managerId] = true; });
    const c = {};
    people.forEach(function (p) {
      // a "team lead" carries a team label; collapse their subtree by default
      if (hasKids[p.id] && p.team) c[p.id] = true;
    });
    return c;
  }

  function metricsBar(m) {
    const t = WP.i18n.t;
    function card(label, value, sub) {
      return '<div class="card"><div class="label">' + label + '</div>' +
             '<div class="value">' + value + '</div>' +
             '<div class="sub">' + sub + '</div></div>';
    }
    const healthSplit = t('healthyBandSplit').replace('{h}', m.healthyCount).replace('{n}', m.size);
    return WP.ui.provenanceNote() +
      '<div class="metrics">' +
      card(t('teamHealth'), m.teamHealth + '%', healthSplit) +
      card(t('available'), m.counts.available, t('available')) +
      card(t('nearCapacity'), m.nearOrOver, t('nearCapacity')) +
      card(t('earlyWarnings'), m.earlyWarnings, t('burnoutFlag').split('—')[0]) +
      '</div>';
  }

  // A "joining" date only counts while it is still in the FUTURE. Once the date
  // arrives (e.g. today is past it), the person is simply active — no stale badge.
  function joiningSoon(person) {
    if (!person.joining) return null;
    return person.joining > todayISO() ? person.joining : null;
  }

  // Employment / status chip (used in the LIST view, where there's room for a full label).
  function empBadge(person) {
    const t = WP.i18n.t;
    if (person.tbc) return '<span class="emp emp-open">' + t('openRole') + '</span>';
    const js = joiningSoon(person);
    if (js) return '<span class="emp emp-join">' + t('joining') + ' ' + WP.i18n.shortDate(js) + '</span>';
    if (person.employment === 'freelance') return '<span class="emp emp-free">' + t('freelance') + '</span>';
    return '<span class="emp emp-ft">' + t('fullTime') + '</span>';
  }

  // Clean one-line status for the TREE card — a small color-coded dot + word, so it's
  // instantly clear whether someone is Full-time or Freelance (or Open / Joining), with
  // none of the bulk of a full pill. Senior-design call: the dot carries the signal,
  // the label stays quiet, every card reads the same height.
  function statusLine(person) {
    const t = WP.i18n.t;
    if (person.tbc) return '<div class="statusline sl-open"><span class="sl-dot"></span>' + t('openRole') + '</div>';
    const js = joiningSoon(person);
    if (js) return '<div class="statusline sl-join"><span class="sl-dot"></span>' + t('joining') + ' ' + WP.i18n.shortDate(js) + '</div>';
    if (person.employment === 'freelance') return '<div class="statusline sl-free"><span class="sl-dot"></span>' + t('freelance') + '</div>';
    return '<div class="statusline sl-ft"><span class="sl-dot"></span>' + t('fullTime') + '</div>';
  }

  // Tier dot color for an account/event (Tier 1 = brand, 2 = near, 3 = muted).
  function tierColor(tier) {
    return tier === 1 ? 'var(--brand)' : tier === 2 ? 'var(--state-near)' : 'var(--text-muted)';
  }

  // Account line — WHICH account(s) this person handles. Shows the primary event
  // (tier-dot + name), "+N" if more, full list on hover. Keeps the tree scannable.
  function acctLine(person) {
    if (person.tbc) return '';
    const ids = person.assignedEvents || [];
    if (!ids.length) return '<div class="acctline acctline-none">' + WP.i18n.t('noAccount') + '</div>';
    const evs = ids.map(function (id) { return WP.data.EVENTS[id]; }).filter(Boolean);
    if (!evs.length) return '';
    const primary = evs[0];
    const more = evs.length > 1 ? ' <span class="acctline-more">+' + (evs.length - 1) + '</span>' : '';
    const names = evs.map(function (e) { return WP.i18n.eventName(e); }).join(' · ');
    return '<div class="acctline" title="' + ui.esc(names) + '">' +
      '<span class="acctline-dot" style="background:' + tierColor(primary.tier) + '"></span>' +
      '<span class="acctline-nm">' + ui.esc(WP.i18n.eventName(primary)) + '</span>' + more + '</div>';
  }

  // Segmented load bar — the load % broken into the accounts that fill it (one
  // colored segment per account), with a full per-account breakdown on hover.
  function loadBar(snap) {
    const parts = snap.breakdown || [];
    const segs = parts.map(function (p) {
      return '<i style="width:' + Math.min(100, p.pct) + '%;background:' + tierColor(p.tier) + '"></i>';
    }).join('');
    const title = parts.length
      ? parts.map(function (p) { return WP.i18n.eventName(WP.data.EVENTS[p.id]) + ' — ' + p.pct + '%'; }).join('\n')
          + '\n' + WP.i18n.t('totalLoad') + ' ' + snap.load + '%'
      : WP.i18n.t('noAccount');
    return '<div class="loadbar" title="' + ui.esc(title) + '">' +
      '<div class="loadbar-track">' + segs + '</div>' +
      '<div class="loadbar-pct" style="color:' + ui.stateColor(snap.state) + '">' +
        '<span class="dot"></span>' + snap.load + '%</div>' +
    '</div>';
  }

  function nodeHTML(person, snap, kidCount, isCol) {
    const accent = ui.stateColor(snap.state);
    const flame = snap.burnout ? '<div class="flame" title="' + WP.i18n.t('burnoutFlag') + '">' + WP.ui.icon('flame', 15) + '</div>' : '';
    // Caret keeps the report COUNT visible and acts as a secondary toggle; the whole
    // card is also clickable to expand (see render). aria-expanded for screen readers.
    const caret = kidCount
      ? '<button class="node-caret' + (isCol ? ' is-col' : '') + '" data-caret="' + person.id +
        '" aria-label="' + (isCol ? 'show team' : 'hide team') + '" aria-expanded="' + (!isCol) + '">' +
        kidCount + '<span class="chev"></span></button>'
      : '';
    // Manager cards expand on click; the avatar is the dedicated "open profile" affordance.
    return '<div class="node' + (person.tbc ? ' is-tbc' : '') + (kidCount ? ' has-kids' : '') + '"' +
        ' data-id="' + person.id + '" style="--node-accent:' + accent + '"' +
        (kidCount ? ' title="' + (isCol ? 'Click to show team' : 'Click to hide team') + '"' : '') + '>' +
      flame +
      '<span class="node-ava" data-profile="' + person.id + '" role="button" tabindex="0"' +
        ' aria-label="' + ui.esc(WP.i18n.name(person)) + ' — open profile">' + ui.avatar(person, accent) + '</span>' +
      '<div class="nm">' + ui.esc(WP.i18n.name(person)) + '</div>' +
      '<div class="ttl">' + ui.esc(WP.i18n.title(person)) + '</div>' +
      statusLine(person) +
      acctLine(person) +
      (person.tbc ? '' : loadBar(snap)) +
      caret +
    '</div>';
  }

  /* Classic top-down org tree: reports grouped beneath their manager,
   * connected by lines. Wrapped in a fit-to-width scaler so the whole
   * chart is visible without zooming the browser; collapse/expand keeps
   * it tidy; horizontal scroll only as a last resort. RTL-neutral. */
  function treeChart(people, snapById, colMap) {
    const inView = {};
    people.forEach(function (p) { inView[p.id] = true; });
    // Fixed business order for the top team sections (matches the official org chart);
    // anything without a defined rank falls back to alphabetical by team name.
    const TEAM_ORDER = ['Automation & Execution', 'Sports', 'Entertainment', 'On Ground', 'Cashless'];
    const LV = WP.data.LEVELS;
    const childrenOf = function (id) {
      return people.filter(function (p) { return p.managerId === id; }).sort(function (a, b) {
        // team leads → fixed section order, not by personal name
        if (a.team || b.team) {
          const ra = a.team ? (TEAM_ORDER.indexOf(a.team) + 1 || 99) : 999;
          const rb = b.team ? (TEAM_ORDER.indexOf(b.team) + 1 || 99) : 999;
          if (ra !== rb) return ra - rb;
          return (a.team || '').localeCompare(b.team || '');
        }
        // within a team → open roles last, then by seniority (rank), then name
        if (!!a.tbc !== !!b.tbc) return a.tbc ? 1 : -1;
        const la = (LV[a.level] && LV[a.level].rank != null) ? LV[a.level].rank : 9;
        const lb = (LV[b.level] && LV[b.level].rank != null) ? LV[b.level].rank : 9;
        if (la !== lb) return la - lb;
        return WP.i18n.name(a).localeCompare(WP.i18n.name(b), undefined, { sensitivity: 'base' });
      });
    };
    const roots = people.filter(function (p) { return !p.managerId || !inView[p.managerId]; });

    function teamTag(p) {
      if (!p.team) return '';
      const label = WP.state.lang === 'ar' ? (p.teamAr || p.team) : p.team;
      return '<div class="team-tag">' + ui.esc(label) + '</div>';
    }
    function li(p) {
      const kids = childrenOf(p.id);
      const isCol = !!colMap[p.id];
      const childUl = (kids.length && !isCol) ? '<ul>' + kids.map(li).join('') + '</ul>' : '';
      // team-lead nodes carry a labeled header so each section is named + separated
      return '<li' + (p.team ? ' class="team-branch"' : '') + '>' +
        teamTag(p) + nodeHTML(p, snapById[p.id], kids.length, isCol) + childUl + '</li>';
    }
    return '<div class="tree-scroll"><div class="tree-fit"><ul class="tree">' +
      roots.map(li).join('') + '</ul></div></div>';
  }

  function listView(people, snapById) {
    return '<div class="list">' + people
      .slice()
      .sort(function (a, b) { return snapById[b.id].load - snapById[a.id].load; })
      .map(function (p) {
        const s = snapById[p.id];
        const c = ui.stateColor(s.state);
        return '<div class="row" data-id="' + p.id + '" style="--node-accent:' + c + '">' +
          ui.avatar(p, c) +
          '<div style="min-width:150px"><div class="nm">' + ui.esc(WP.i18n.name(p)) + '</div>' +
          '<div class="ttl">' + ui.esc(WP.i18n.title(p)) + ' ' + empBadge(p) + '</div></div>' +
          '<div class="lr-acctline">' + acctLine(p) + '</div>' +
          '<div class="bar"><i style="width:' + Math.min(100, s.load) + '%"></i></div>' +
          '<div class="pct">' + s.load + '%</div>' +
          (s.burnout ? '<span title="' + WP.i18n.t('burnoutFlag') + '" style="color:var(--state-overloaded);line-height:0">' + WP.ui.icon('flame', 15) + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
  }

  // Localized team label (team leads carry a team name; everyone else falls back to their name).
  function teamLabel(p) {
    if (p.team) return WP.state.lang === 'ar' ? (p.teamAr || p.team) : p.team;
    return WP.i18n.name(p);
  }
  // The team a person belongs to = nearest ancestor (incl. self) that carries a team label.
  function teamLeadOf(id) {
    let p = WP.access.byId(id), guard = 0;
    while (p && guard++ < 20) { if (p.team) return p; p = p.managerId ? WP.access.byId(p.managerId) : null; }
    return null;
  }
  // The named teams = people who carry a team label (the real teams), in business order.
  // Sub-managers without a team label are NOT listed as "teams" here — they appear under
  // People (and still offer a "View team" chip because they have reports).
  function teamsList(base) {
    const ORDER = ['Automation & Execution', 'Sports', 'Entertainment', 'On Ground', 'Cashless'];
    return base.filter(function (p) { return p.team; }).sort(function (a, b) {
      return (ORDER.indexOf(a.team) + 1 || 99) - (ORDER.indexOf(b.team) + 1 || 99);
    });
  }

  // Generic themed dropdown (button + listbox) — used for View and Period so the
  // toolbar stays compact instead of two rows of segmented buttons.
  function ddMenu(id, btnIcon, label, items) {
    return '<div class="dd" id="' + id + '">' +
      '<button class="dd-btn" id="' + id + '-btn" aria-haspopup="listbox" aria-expanded="false">' +
        (btnIcon ? WP.ui.icon(btnIcon, 15) : '') +
        '<span class="dd-label">' + ui.esc(label) + '</span>' +
        '<span class="dd-caret">' + WP.ui.icon('caret', 14) + '</span></button>' +
      '<div class="dd-menu" id="' + id + '-menu" role="listbox">' +
        items.map(function (o) {
          return '<div class="dd-opt' + (o.sel ? ' selected' : '') + '" role="option" aria-selected="' + (!!o.sel) + '" data-val="' + o.val + '" tabindex="-1">' +
            (o.icon ? WP.ui.icon(o.icon, 15) : '') +
            '<span class="dd-opt-nm">' + ui.esc(o.label) + '</span>' +
            (o.sel ? '<span class="dd-check">' + WP.ui.icon('check', 14) + '</span>' : '') + '</div>';
        }).join('') +
      '</div></div>';
  }

  // Unified Find: ONE control that searches people AND teams. Person rows show the team
  // they sit under (a clickable chip) so you can jump to the person OR their whole team.
  function mapFilters(base) {
    const t = WP.i18n.t;
    const cur = focusId ? base.find(function (p) { return p.id === focusId; }) : null;
    const chip = cur
      ? '<button class="scope-chip" id="scope-clear" title="' + t('showAll') + '">' + WP.ui.icon('users', 14) +
          '<span>' + ui.esc(teamLabel(cur)) + '</span>' + WP.ui.icon('x', 12) + '</button>'
      : '';
    return '<div class="finder' + (cur ? ' has-scope' : '') + '" id="finder">' + chip +
      '<div class="search finder-input">' + WP.ui.icon('search', 15) +
        '<input id="map-search" type="text" placeholder="' + t('findPlaceholder') + '" aria-label="' + t('findPlaceholder') + '"' +
          ' role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="map-suggest" autocomplete="off" />' +
        '<button class="search-clear" id="map-search-clear" aria-label="' + t('showAll') + '">' + WP.ui.icon('x', 13) + '</button>' +
      '</div>' +
      '<div class="predict finder-menu" id="map-suggest" role="listbox"></div>' +
    '</div>';
  }

  const MONTHS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  };
  function pad(n) { return ('0' + n).slice(-2); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function todayISO() { return iso(new Date()); }
  const WEEKDAYS = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  };

  // Apple-Calendar-style label for the current period.
  function periodLabel(win, refDate) {
    const ar = WP.state.lang === 'ar';
    const d = new Date(refDate);
    const y = d.getUTCFullYear(), mo = d.getUTCMonth(), day = d.getUTCDate();
    const mn = MONTHS[ar ? 'ar' : 'en'];
    if (win === 'year') return '' + y;
    if (win === 'month') return mn[mo] + ' ' + y;
    if (win === 'day') {
      // Clean day label — no weekday clutter (e.g. "23 Jun 2026"); the "today" dot already
      // signals when it's the current day, so the weekday + "Today" text are redundant.
      return day + ' ' + mn[mo] + ' ' + y;
    }
    // week → Sunday..Saturday containing refDate
    const dow = new Date(Date.UTC(y, mo, day)).getUTCDay();
    const s = new Date(Date.UTC(y, mo, day - dow));
    const e = new Date(s.getTime() + 6 * 86400000);
    const sm = MONTHS[ar ? 'ar' : 'en'][s.getUTCMonth()], em = MONTHS[ar ? 'ar' : 'en'][e.getUTCMonth()];
    return s.getUTCMonth() === e.getUTCMonth()
      ? s.getUTCDate() + '–' + e.getUTCDate() + ' ' + sm + ' ' + e.getUTCFullYear()
      : s.getUTCDate() + ' ' + sm + ' – ' + e.getUTCDate() + ' ' + em + ' ' + e.getUTCFullYear();
  }

  // Move the reference date by one unit of the granularity (dir = +1 / -1).
  function shiftDate(win, refDate, dir) {
    const d = new Date(refDate);
    const y = d.getUTCFullYear(), mo = d.getUTCMonth(), day = d.getUTCDate();
    if (win === 'day')   return iso(new Date(Date.UTC(y, mo, day + dir)));
    if (win === 'week')  return iso(new Date(Date.UTC(y, mo, day + 7 * dir)));
    if (win === 'year')  return iso(new Date(Date.UTC(y + dir, mo, 15)));
    return iso(new Date(Date.UTC(y, mo + dir, 15))); // month
  }

  // Is the viewed reference date the CURRENT real period for this granularity?
  function isCurrentPeriod(win, refDate) {
    const d = new Date(refDate), n = new Date();
    const y = d.getUTCFullYear(), mo = d.getUTCMonth(), da = d.getUTCDate();
    const ty = n.getFullYear(), tm = n.getMonth(), td = n.getDate();
    if (win === 'year') return y === ty;
    if (win === 'month') return y === ty && mo === tm;
    if (win === 'day') return y === ty && mo === tm && da === td;
    const sun = function (yy, mm, dd) { return Date.UTC(yy, mm, dd - new Date(Date.UTC(yy, mm, dd)).getUTCDay()); };
    return sun(y, mo, da) === sun(ty, tm, td);
  }

  // Apple-Calendar navigator: (Today) · ‹ · current-period label · ›
  // "Today" only appears when you've navigated away from the current period.
  function dateNav(win, refDate) {
    const t = WP.i18n.t;
    const cur = isCurrentPeriod(win, refDate);
    const future = refDate > todayISO();
    // State A (on current period): Today is PASSIVE (muted, no fill) — you're anchored on now.
    // State B (navigated away): Today is an ACTIONABLE "jump back to present" command —
    //   a directional arrow (← when ahead in the future, → when behind in the past), clean
    //   contrast, NOT a filled/selected pill (avoids reading as "this date = today").
    let today;
    if (cur) {
      // On the current period: no "Today" text — the pink dot on the label already says so.
      today = '';
    } else {
      // Arrow points toward "today". In LTR earlier=left / later=right; in RTL it's mirrored,
      // so choose the glyph explicitly per language (not relying on a blanket icon flip).
      const ar = WP.state.lang === 'ar';
      const backToToday = ar ? 'chevR' : 'chevL';  // in the future → go back to present
      const fwdToToday = ar ? 'chevL' : 'chevR';   // in the past   → go forward to present
      const arrow = future
        ? WP.ui.icon(backToToday, 15) + '<span>' + t('today') + '</span>'
        : '<span>' + t('today') + '</span>' + WP.ui.icon(fwdToToday, 15);
      today = '<button class="btn datenav-today is-away" data-nav="today" aria-label="' + t('today') + '">' + arrow + '</button>';
    }
    const dot = cur ? '<span class="today-dot" title="' + t('today') + '" aria-label="' + t('today') + '"></span>' : '';
    return '<div class="datenav">' + today +
      '<button class="btn icon-btn" data-nav="prev" aria-label="' + t('prevPeriod') + '">' + WP.ui.icon('chevL', 16) + '</button>' +
      '<span class="datenav-label' + (cur ? ' is-today' : '') + '" aria-live="polite">' + dot + ui.esc(periodLabel(win, refDate)) + '</span>' +
      '<button class="btn icon-btn" data-nav="next" aria-label="' + t('nextPeriod') + '">' + WP.ui.icon('chevR', 16) + '</button>' +
    '</div>';
  }

  function render(root) {
    const viewer = WP.viewer();
    const base = WP.access.visiblePeople(viewer);
    if (!collapseInit) { collapsed = defaultCollapsed(base); collapseInit = true; }

    // SCOPE → focus the tree on one team (subtree). Search is a predictive
    // quick-jump (typeahead), handled separately so typing never re-renders the tree.
    const inBase = {}; base.forEach(function (p) { inBase[p.id] = true; });
    const focusPerson = (focusId && inBase[focusId]) ? WP.access.byId(focusId) : null;
    const scopeSet = focusPerson ? WP.access.teamOf(focusId).filter(function (p) { return inBase[p.id]; }) : base;
    const people = scopeSet;

    const m = WP.capacity.teamMetrics(scopeSet, WP.state.window, WP.state.refDate);
    const snapById = {};
    m.snaps.forEach(function (s) { snapById[s.id] = s; });
    const colMap = collapsed;

    // snapshots for EVERYONE (so predictive search works across all teams,
    // even while the tree is focused on one team)
    const allSnapById = {};
    WP.capacity.teamMetrics(base, WP.state.window, WP.state.refDate).snaps
      .forEach(function (s) { allSnapById[s.id] = s; });

    const t = WP.i18n.t;
    const win = WP.state.window;
    const viewItems = [
      { val: 'chart', label: t('treeView'), icon: 'tree', sel: !listMode },
      { val: 'list', label: t('listView'), icon: 'list', sel: listMode },
    ];
    const periodItems = ['day', 'week', 'month', 'year'].map(function (k) {
      return { val: k, label: t(k), sel: k === win };
    });
    const toggle = '<div class="toolbar">' +
      ddMenu('view-dd', listMode ? 'list' : 'tree', listMode ? t('listView') : t('treeView'), viewItems) +
      ddMenu('period-dd', null, t(win), periodItems) +
      dateNav(win, WP.state.refDate) +
    '</div>';

    const legend = '<div class="legend">' + WP.data.STATES.map(function (s) {
      return '<span class="legend-item"><span class="dot" style="background:' + ui.stateColor(s) + '"></span>' +
        ui.esc(WP.i18n.stateLabel(s)) + ' <em>' + s.min + '–' + (s.max > 100 ? '100+' : s.max) + '%</em></span>';
    }).join('') +
      '<span class="legend-sep" aria-hidden="true"></span>' +
      '<span class="legend-item"><span class="emp emp-ft">' + t('fullTime') + '</span></span>' +
      '<span class="legend-item"><span class="emp emp-free">' + t('freelance') + '</span></span>' +
      '</div>';

    const body = people.length === 0
      ? '<div class="map-empty">' + WP.ui.icon('users', 18) + ' <span>' + t('emptyTeam') + '</span>' +
          (focusPerson ? ' <button class="btn" id="empty-showall">' + t('showAll') + '</button>' : '') + '</div>'
      : (listMode ? listView(people, snapById) : treeChart(people, snapById, colMap));
    root.innerHTML = metricsBar(m) +
      '<div class="controlbar">' + toggle + mapFilters(base) + '</div>' +
      legend + body;

    // Apple-style date navigator — prev / next / today (keeps the granularity)
    root.querySelectorAll('[data-nav]').forEach(function (b) {
      b.onclick = function () {
        const dir = b.dataset.nav;
        if (dir === 'today') WP.setState({ refDate: todayISO() });
        else WP.setState({ refDate: shiftDate(WP.state.window, WP.state.refDate, dir === 'next' ? 1 : -1) });
      };
    });
    // caret chip — secondary toggle (still shows the report count)
    root.querySelectorAll('[data-caret]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        collapsed[b.dataset.caret] = !collapsed[b.dataset.caret];
        render(root);
      };
    });
    // avatar = dedicated "open profile" affordance (works on every card)
    root.querySelectorAll('[data-profile]').forEach(function (el) {
      el.onclick = function (e) { e.stopPropagation(); WP.ui.peek(el.dataset.profile); };
      el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); WP.ui.peek(el.dataset.profile); } };
    });
    // TREE card: click the body to show/hide the team (one click, no hunting for arrows).
    // Cards with no reports just open the profile.
    root.querySelectorAll('.tree .node[data-id]').forEach(function (el) {
      el.onclick = function (e) {
        if (e.target.closest('[data-caret]') || e.target.closest('[data-profile]')) return;
        const id = el.dataset.id;
        if (el.classList.contains('has-kids')) { collapsed[id] = !collapsed[id]; render(root); }
        else WP.ui.peek(id);
      };
    });
    // LIST rows always open the profile
    root.querySelectorAll('.list .row[data-id]').forEach(function (el) {
      el.onclick = function () { WP.ui.peek(el.dataset.id); };
    });

    // compact toolbar dropdowns (View · Period)
    setupMenu(root, 'view-dd', function (v) { listMode = (v === 'list'); render(root); });
    setupMenu(root, 'period-dd', function (v) { WP.setState({ window: v }); });
    closeMenusOnOutside(root);
    const esa = root.querySelector('#empty-showall');
    if (esa) esa.onclick = function () { focusId = null; render(root); };

    // unified Find — searches people AND teams; jump to a person or their whole team
    setupFinder(root, base, allSnapById);

    // drag-to-pan the org canvas (grab / grabbing cursors)
    setupPan(root);

    // keep the board live — refresh on a light interval (see scheduleAutoRefresh)
    scheduleAutoRefresh(root);
  }

  // Live clock for the "Updated …" indicator.
  function nowClock() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // Auto-refresh every 10s so the board always reflects the latest state. It re-renders
  // ONLY when it's safe: the view is still mounted + visible, no menu open, the user isn't
  // typing in search, and no drag is in progress — and it restores the scroll position so
  // the refresh is invisible. A single shared timer (cleared each render) avoids pile-ups.
  let refreshTimer = null;
  function stopAutoRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }
  function scheduleAutoRefresh(root) {
    stopAutoRefresh();
    refreshTimer = setInterval(function () {
      // Critical: every view shares the same #view container. Only refresh while the
      // Workload map is the ACTIVE route — otherwise we'd repaint the map over whatever
      // page the user navigated to (Evaluations, Daily tasks, …). Stop the timer the
      // moment we're no longer on the map.
      const onMap = WP.state && (WP.state.route === 'map' || WP.state.route == null);
      if (!onMap || !document.body.contains(root)) { stopAutoRefresh(); return; }
      if (document.hidden) return;
      const sc = root.querySelector('.tree-scroll');
      const menuOpen = root.querySelector('.dd.open, .finder.open, .predict.open');
      const search = root.querySelector('#map-search');
      const typing = search && (document.activeElement === search || search.value);
      const dragging = sc && sc.classList.contains('panning');
      if (menuOpen || typing || dragging) return;                 // don't interrupt the user
      const sx = sc ? sc.scrollLeft : 0, sy = sc ? sc.scrollTop : 0;
      render(root);
      const sc2 = root.querySelector('.tree-scroll');
      if (sc2) { sc2.scrollLeft = sx; sc2.scrollTop = sy; }
    }, 10000);
  }

  // Click-and-drag panning on the tree canvas, with native grab/grabbing cursors.
  // Listeners are scoped per-drag (added on mousedown, removed on mouseup) so
  // re-renders never leak handlers. A small move threshold suppresses the click
  // that would otherwise open a profile right after a pan.
  function setupPan(root) {
    const sc = root.querySelector('.tree-scroll');
    if (!sc) return;
    sc.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;                       // left button only
      const sx = e.clientX, sy = e.clientY;
      const sl = sc.scrollLeft, st = sc.scrollTop;
      let moved = false;
      sc.classList.add('panning');                      // → cursor: grabbing
      function mv(ev) {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        sc.scrollLeft = sl - dx;
        sc.scrollTop = st - dy;
        ev.preventDefault();
      }
      function up() {
        sc.classList.remove('panning');                 // → back to cursor: grab
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        if (moved) {                                     // swallow the trailing click
          sc.addEventListener('click', function sw(c) {
            c.stopPropagation(); c.preventDefault();
            sc.removeEventListener('click', sw, true);
          }, true);
        }
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  // Generic dropdown menu wiring (View / Period). One open at a time; full keyboard support.
  function closeMenusOnOutside(root) {
    if (WP._ddDocClose) document.removeEventListener('click', WP._ddDocClose);
    WP._ddDocClose = function (ev) {
      root.querySelectorAll('.dd.open, .finder.open').forEach(function (w) {
        if (!w.contains(ev.target)) {
          w.classList.remove('open');
          const b = w.querySelector('.dd-btn'); if (b) b.setAttribute('aria-expanded', 'false');
          const m = w.querySelector('.finder-menu'); if (m) m.classList.remove('open');
        }
      });
    };
    document.addEventListener('click', WP._ddDocClose);
  }
  function setupMenu(root, id, onChoose) {
    const wrap = root.querySelector('#' + id);
    if (!wrap) return;
    const btn = root.querySelector('#' + id + '-btn');
    const menu = root.querySelector('#' + id + '-menu');
    const opts = [].slice.call(menu.querySelectorAll('.dd-opt'));
    function open() {
      root.querySelectorAll('.dd.open').forEach(function (w) { if (w !== wrap) w.classList.remove('open'); });
      wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      const s = menu.querySelector('.dd-opt.selected') || opts[0]; if (s) s.focus();
    }
    function close() { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.onclick = function (e) { e.stopPropagation(); wrap.classList.contains('open') ? close() : open(); };
    btn.onkeydown = function (e) { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    opts.forEach(function (o, i) {
      o.onclick = function () { close(); onChoose(o.dataset.val); };
      o.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); onChoose(o.dataset.val); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (opts[i - 1] || opts[opts.length - 1]).focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
      };
    });
  }

  function highlight(name, q) {
    const i = name.toLowerCase().indexOf(q);
    if (i < 0) return ui.esc(name);
    return ui.esc(name.slice(0, i)) + '<mark>' + ui.esc(name.slice(i, i + q.length)) + '</mark>' + ui.esc(name.slice(i + q.length));
  }

  // Unified Find: one combobox over people + teams. Person rows carry a clickable team
  // chip, so a director can jump straight to a person OR scope the whole tree to their team.
  function setupFinder(root, base, snapById) {
    const t = WP.i18n.t;
    const finder = root.querySelector('#finder');
    const input = root.querySelector('#map-search');
    const dd = root.querySelector('#map-suggest');
    const clr = root.querySelector('#map-search-clear');
    if (!finder || !input || !dd) return;
    const teams = teamsList(base);
    const hasRep = {};
    base.forEach(function (p) { if (p.managerId) hasRep[p.managerId] = true; });
    let rows = [], active = -1;
    const hay = function (p) { return (p.name + ' ' + (p.nameAr || '') + ' ' + (p.title || '') + ' ' + (p.titleAr || '')).toLowerCase(); };

    function closeDd() { finder.classList.remove('open'); dd.classList.remove('open'); dd.innerHTML = ''; rows = []; active = -1; input.setAttribute('aria-expanded', 'false'); }
    function focusTeam(id) { closeDd(); input.value = ''; focusId = id || null; collapsed = focusId ? {} : defaultCollapsed(base); render(root); }
    function openPerson(id) { closeDd(); input.value = ''; WP.ui.peek(id); }

    // Team row: lead's photo + the TEAM name + who leads it + a clear "View team" action.
    function teamRow(p, q) {
      return '<div class="predict-row pr-team" role="option" data-team="' + p.id + '">' +
        ui.avatar(p, 'var(--brand)') +
        '<span class="predict-meta"><span class="nm">' + (q ? highlight(teamLabel(p), q) : ui.esc(teamLabel(p))) + '</span>' +
        '<span class="ttl">' + t('ledBy') + ' ' + ui.esc(WP.i18n.name(p)) + '</span></span>' +
        '<span class="pr-go">' + t('viewTeam') + '</span></div>';
    }
    // Person row: their photo + name + role, plus ONE team chip — "View team" if they lead
    // a team, otherwise "in <their team>" — so every row says who they are and where they sit.
    function personRow(p, q) {
      const s = snapById[p.id]; const c = s ? ui.stateColor(s.state) : 'var(--brand)';
      const lead = teamLeadOf(p.id);
      let chip = '';
      if (hasRep[p.id]) chip = ' · <button class="pr-teamchip is-lead" data-team="' + p.id + '">' + WP.ui.icon('users', 11) + ' ' + t('viewTeam') + '</button>';
      else if (lead) chip = ' · <button class="pr-teamchip" data-team="' + lead.id + '" title="' + ui.esc(teamLabel(lead)) + '">' + WP.ui.icon('users', 11) + ' ' + t('inTeam') + ' ' + ui.esc(teamLabel(lead)) + '</button>';
      const load = s ? '<span class="predict-load" style="color:' + c + '">' + s.load + '%</span>' : '';
      return '<div class="predict-row pr-person" role="option" data-pick="' + p.id + '">' +
        ui.avatar(p, c) +
        '<span class="predict-meta"><span class="nm">' + (q ? highlight(WP.i18n.name(p), q) : ui.esc(WP.i18n.name(p))) + '</span>' +
        '<span class="ttl">' + ui.esc(WP.i18n.title(p)) + chip + '</span></span>' + load + '</div>';
    }

    function build() {
      const q = input.value.trim().toLowerCase();
      let html = '';
      if (focusId) html += '<div class="predict-row pr-clear" role="option" data-team=""><span class="pr-ico">' + WP.ui.icon('users', 15) + '</span><span class="predict-meta"><span class="nm">' + t('allTeams') + '</span></span></div>';
      const mTeams = teams.filter(function (p) { return !q || teamLabel(p).toLowerCase().indexOf(q) >= 0 || hay(p).indexOf(q) >= 0; });
      const mPeople = q ? base.filter(function (p) { return hay(p).indexOf(q) >= 0; }).slice(0, 8) : [];
      if (mTeams.length) html += '<div class="predict-group">' + t('teams') + '</div>' + mTeams.map(function (p) { return teamRow(p, q); }).join('');
      if (mPeople.length) html += '<div class="predict-group">' + t('people') + '</div>' + mPeople.map(function (p) { return personRow(p, q); }).join('');
      if (!html) html = '<div class="predict-empty">' + t('noResults') + '</div>';
      dd.innerHTML = html;
      finder.classList.add('open'); dd.classList.add('open'); input.setAttribute('aria-expanded', 'true');
      rows = [].slice.call(dd.querySelectorAll('.predict-row')); active = -1;
      dd.querySelectorAll('.pr-teamchip').forEach(function (b) {
        b.onmousedown = function (e) { e.preventDefault(); e.stopPropagation(); focusTeam(b.dataset.team); };
      });
      dd.querySelectorAll('[data-pick]').forEach(function (r) {
        r.onmousedown = function (e) { if (e.target.closest('.pr-teamchip')) return; e.preventDefault(); openPerson(r.dataset.pick); };
      });
      dd.querySelectorAll('.predict-row[data-team]').forEach(function (r) {
        r.onmousedown = function (e) { e.preventDefault(); focusTeam(r.dataset.team || null); };
      });
    }
    function setActive(i) {
      active = i;
      rows.forEach(function (r, idx) { const on = idx === i; r.classList.toggle('active', on); if (on && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); });
    }
    function activate(r) { if (!r) return; if (r.dataset.pick) openPerson(r.dataset.pick); else focusTeam(r.getAttribute('data-team') || null); }

    input.onfocus = build;
    input.oninput = build;
    input.onkeydown = function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) setActive(Math.min(rows.length - 1, active + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) setActive(Math.max(0, active - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); activate(active >= 0 ? rows[active] : rows[0]); }
      else if (e.key === 'Escape') { closeDd(); input.blur(); }
    };
    input.onblur = function () { setTimeout(closeDd, 160); };
    if (clr) clr.onclick = function () { input.value = ''; build(); input.focus(); };
    const sce = root.querySelector('#scope-clear');
    if (sce) sce.onclick = function () { focusTeam(null); };
  }

  WP.ui.workloadMap = { render: render };
})(window.WP = window.WP || {});
